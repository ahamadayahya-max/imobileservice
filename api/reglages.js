/* ============================================================
   i-Mobile Service — Réglages boutique (prix, masquage, photos)
   GET  /api/reglages  → public : { prix, masques, photos } appliqués par le site
                          (+ historique si la session admin est valide)
   POST /api/reglages  → admin uniquement, modifications partielles :
     { prix:    { [id]: nombre | null },     null = revenir au prix automatique
       masques: { [id]: true | false },
       photos:  { [id]: "https://…" | null },
       historique: [{ id, nom, ancien, nouveau }],  entrées à ajouter
       viderHistorique: true, reinitialiserPhotos: true }
   ============================================================ */

const { lireReglages, ecrireReglages } = require('./_lib/reglages');
const { sessionAdminValide } = require('./_lib/session');

const MAX_HISTORIQUE = 50;
const PRIX_MAX = 20000;

function idValide(id) {
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/* Seules les photos https sont acceptées : pas de javascript:, data:, http: */
function urlPhotoValide(u) {
  try {
    const url = new URL(String(u));
    return url.protocol === 'https:' && String(u).length <= 1000 ? url.toString() : null;
  } catch {
    return null;
  }
}

function texteCourt(s, max = 200) {
  return String(s == null ? '' : s).replace(/[<>]/g, '').slice(0, max);
}

function appliquerModifs(r, corps) {
  if (corps.prix && typeof corps.prix === 'object') {
    for (const [k, v] of Object.entries(corps.prix)) {
      const id = idValide(k);
      if (!id) continue;
      if (v === null) { delete r.prix[id]; continue; }
      const n = Math.round(Number(v) * 100) / 100;
      if (Number.isFinite(n) && n >= 0 && n <= PRIX_MAX) r.prix[id] = n;
    }
  }

  if (corps.masques && typeof corps.masques === 'object') {
    const set = new Set(r.masques.map(Number));
    for (const [k, v] of Object.entries(corps.masques)) {
      const id = idValide(k);
      if (!id) continue;
      if (v) set.add(id); else set.delete(id);
    }
    r.masques = [...set];
  }

  if (corps.reinitialiserPhotos === true) r.photos = {};
  if (corps.photos && typeof corps.photos === 'object') {
    for (const [k, v] of Object.entries(corps.photos)) {
      const id = idValide(k);
      if (!id) continue;
      if (v === null) { delete r.photos[id]; continue; }
      const url = urlPhotoValide(v);
      if (url) r.photos[id] = url;
    }
  }

  if (corps.viderHistorique === true) r.historique = [];
  if (Array.isArray(corps.historique)) {
    const date = new Date().toISOString();
    const ajouts = corps.historique.slice(0, MAX_HISTORIQUE).map(h => ({
      id: idValide(h && h.id),
      nom: texteCourt(h && h.nom),
      ancien: Number(h && h.ancien),
      nouveau: Number(h && h.nouveau),
      date,
    })).filter(h => h.id && Number.isFinite(h.ancien) && Number.isFinite(h.nouveau));
    r.historique = [...ajouts, ...r.historique].slice(0, MAX_HISTORIQUE);
  }
  return r;
}

module.exports = async (req, res) => {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(503).json({ status: 'ERROR', message: 'Stockage des réglages non configuré' });
  }
  const admin = sessionAdminValide(req);

  try {
    if (req.method === 'GET') {
      const r = await lireReglages({ fraisDuStockage: admin });
      if (admin) {
        res.setHeader('Cache-Control', 'no-store');
        return res.status(200).json({ status: 'OK', ...r });
      }
      /* Public : l'historique reste interne ; cache court pour que les
         changements de l'admin apparaissent en moins d'une minute */
      res.setHeader('Cache-Control', 's-maxage=20, stale-while-revalidate=60');
      return res.status(200).json({ status: 'OK', prix: r.prix, masques: r.masques, photos: r.photos, maj: r.maj });
    }

    if (req.method === 'POST') {
      if (!admin) return res.status(401).json({ status: 'ERROR', message: 'Session admin requise' });
      const actuel = await lireReglages({ fraisDuStockage: true });
      const r = await ecrireReglages(appliquerModifs(actuel, req.body || {}));
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ status: 'OK', ...r });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ status: 'ERROR', message: 'Méthode non autorisée' });
  } catch (err) {
    console.error('[reglages]', err.message);
    return res.status(502).json({ status: 'ERROR', message: 'Réglages indisponibles' });
  }
};
