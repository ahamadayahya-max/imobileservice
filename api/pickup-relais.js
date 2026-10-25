/* ============================================================
   i-Mobile Service — Recherche de points relais (toute la France)

   GET /api/pickup-relais?q=31100 | Toulouse | 12 rue de la Paix Paris
     → { status, source, reference, relais: [5 points les plus proches] }

   Source actuelle : données ouvertes officielles de La Poste
   (bureaux de poste + relais poste, ~11 000 points, horaires réels),
   sans clé. Quand PICKUP_API_KEY sera fournie, compléter
   chercherViaApiOfficielle() avec la documentation reçue de Pickup :
   le format de réponse reste le même, le panier n'a rien à changer.
   ============================================================ */

const DATANOVA = 'https://datanova.laposte.fr/data-fair/api/v1/datasets';
const POINTS = `${DATANOVA}/laposte-poincont2/lines`;
const HORAIRES = `${DATANOVA}/tjwztt6h44ve52i7fln6rbxz/lines`;
const GEOCODAGE = 'https://data.geopf.fr/geocodage/search';

/* Points qui acceptent le retrait de colis */
const TYPES_RETRAIT = 'caracteristique_du_site:("Bureau de Poste" OR "Relais poste")';
const CHAMPS = 'identifiant_a,libelle_du_site,adresse,complement_d_adresse,code_postal,localite,caracteristique_du_site,latitude,longitude';
const NB_RESULTATS = 5;
const JOURS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

async function lireJson(url, params) {
  const u = new URL(url);
  Object.entries(params || {}).forEach(([k, v]) => u.searchParams.set(k, v));
  const r = await fetch(u, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${u.hostname}`);
  return r.json();
}

/* « 40 AVENUE HENRI BARBUSSE » → « 40 Avenue Henri Barbusse » */
const MOTS_LIAISON = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'l', 'd', 'et', 'en', 'sur', 'aux', 'au']);
const casse = s => String(s || '').toLowerCase().trim()
  .replace(/\p{L}+/gu, (m, i) => (i > 0 && MOTS_LIAISON.has(m)) ? m : m[0].toUpperCase() + m.slice(1));

function distanceKm(a, b) {
  const R = 6371, rad = x => x * Math.PI / 180;
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/* Point de départ de la recherche : centre des bureaux du code postal,
   sinon géocodage de la ville / de l'adresse (Géoplateforme IGN) */
async function pointDeReference(q) {
  if (/^\d{5}$/.test(q)) {
    const d = await lireJson(POINTS, { qs: `code_postal:"${q}"`, size: 50, select: 'latitude,longitude,localite' });
    const pts = (d.results || []).filter(p => Number.isFinite(p.latitude) && Number.isFinite(p.longitude));
    if (pts.length) {
      return {
        lat: pts.reduce((s, p) => s + p.latitude, 0) / pts.length,
        lon: pts.reduce((s, p) => s + p.longitude, 0) / pts.length,
        libelle: `${q} ${casse(pts[0].localite)}`,
      };
    }
  }
  const g = await lireJson(GEOCODAGE, { q, limit: 1 });
  const f = g.features && g.features[0];
  if (!f || f.properties.score < 0.4) return null;
  const [lon, lat] = f.geometry.coordinates;
  return { lat, lon, libelle: f.properties.label };
}

/* Horaires des 7 prochains jours, regroupés : { 'Lun–Ven': '9h00-12h00 · 13h45-17h30', 'Dim': 'Fermé' } */
async function horairesDe(ids) {
  if (!ids.length) return {};
  const auj = new Date();
  const fin = new Date(auj.getTime() + 6 * 864e5);
  const iso = d => d.toISOString().slice(0, 10);
  const d = await lireJson(HORAIRES, {
    qs: `identifiant:(${ids.join(' OR ')}) AND date_calendrier:[${iso(auj)} TO ${iso(fin)}]`,
    size: ids.length * 7,
    select: 'identifiant,date_calendrier,plage_horaire_1,plage_horaire_2',
  });
  const parPoint = {};
  for (const l of d.results || []) {
    const plages = [l.plage_horaire_1, l.plage_horaire_2]
      .filter(p => p && p !== 'FERME')
      .map(p => p.replace(/:/g, 'h').replace(/(^|-)0(\d)/g, '$1$2'));
    const jour = new Date(l.date_calendrier + 'T12:00:00Z').getUTCDay();
    (parPoint[l.identifiant] = parPoint[l.identifiant] || {})[jour] = plages.length ? plages.join(' · ') : 'Fermé';
  }
  const resultat = {};
  for (const [id, jours] of Object.entries(parPoint)) {
    /* Lundi → dimanche, jours consécutifs identiques fusionnés */
    const ordre = [1, 2, 3, 4, 5, 6, 0].filter(j => jours[j]);
    const groupes = [];
    for (const j of ordre) {
      const dernier = groupes[groupes.length - 1];
      if (dernier && dernier.h === jours[j]) dernier.fin = j; else groupes.push({ debut: j, fin: j, h: jours[j] });
    }
    resultat[id] = Object.fromEntries(groupes.map(g =>
      [g.debut === g.fin ? JOURS[g.debut] : `${JOURS[g.debut]}–${JOURS[g.fin]}`, g.h]));
  }
  return resultat;
}

async function chercherViaDonneesLaPoste(q) {
  const ref = await pointDeReference(q);
  if (!ref) return { reference: null, relais: [] };

  let points = [];
  /* Rayon élargi progressivement pour les zones rurales */
  for (const rayon of [5000, 15000, 40000]) {
    const d = await lireJson(POINTS, {
      geo_distance: `${ref.lon},${ref.lat},${rayon}`,
      sort: `_geo_distance:${ref.lon}:${ref.lat}`,
      qs: TYPES_RETRAIT, size: NB_RESULTATS, select: CHAMPS,
    });
    points = d.results || [];
    if (points.length >= NB_RESULTATS) break;
  }

  const horaires = await horairesDe(points.map(p => p.identifiant_a)).catch(() => ({}));
  const relais = points.map(p => {
    const km = distanceKm(ref, { lat: p.latitude, lon: p.longitude });
    const adresse = [casse(p.adresse), casse(p.complement_d_adresse)].filter(Boolean).join(', ');
    return {
      id: 'LP-' + p.identifiant_a,
      type: 'pickup',
      categorie: p.caracteristique_du_site,
      nom: casse(p.libelle_du_site).replace(/ Bp$/, '').replace(/ Rp$/, ' (Relais poste)'),
      adresse,
      codePostal: p.code_postal,
      ville: casse(p.localite),
      adresseComplete: `${adresse}, ${p.code_postal} ${casse(p.localite)}`,
      distance: Math.round(km * 10) / 10,
      distanceLabel: km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1).replace('.', ',')} km`,
      horaires: horaires[p.identifiant_a] || {},
      disponible: true,
    };
  });
  return { reference: ref.libelle, relais };
}

/* À compléter avec la documentation officielle Pickup quand la clé arrive.
   Doit renvoyer le même format que chercherViaDonneesLaPoste, ou null. */
async function chercherViaApiOfficielle(_q) {
  if (!process.env.PICKUP_API_KEY) return null;
  return null;
}

module.exports = async (req, res) => {
  const q = String((req.query && (req.query.q || req.query.adresse)) || '').replace(/[<>"`]/g, '').trim().slice(0, 120);
  if (q.length < 2) return res.status(400).json({ status: 'ERROR', message: 'Saisissez un code postal, une ville ou une adresse' });

  try {
    const officiel = await chercherViaApiOfficielle(q).catch(() => null);
    const r = officiel || await chercherViaDonneesLaPoste(q);
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json({ status: 'OK', source: officiel ? 'pickup' : 'laposte', ...r });
  } catch (err) {
    /* La saisie peut être l'adresse du client : on ne la journalise pas */
    console.error('[pickup-relais]', err.message);
    return res.status(502).json({ status: 'ERROR', message: 'Recherche indisponible pour le moment, réessayez dans un instant.' });
  }
};
