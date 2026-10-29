/* ============================================================
   « Les offres de la semaine » — sélection de 3 à 5 produits du
   catalogue Mobilax, enregistrée dans un fichier dédié (Vercel Blob privé) :
     offres/semaine.json → { offres: [{ produitId, position, actif, debut, fin }], maj }
   debut / fin : heure de Paris au format « AAAA-MM-JJTHH:MM » ('' = sans limite).
   Aucune autre donnée du site n'est lue en écriture ni modifiée ici.
   ============================================================ */

const { get, put, BlobNotFoundError } = require('@vercel/blob');
const { chargerCatalogue } = require('../mobilax');
const { lireReglages } = require('./reglages');
const { prixMinimum } = require('./prixMinimum');

const CHEMIN = 'offres/semaine.json';
const MIN_ACTIVES = 3;
const MAX_OFFRES = 5;
const RE_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

async function lireOffres() {
  let res = null;
  try {
    res = await get(CHEMIN, { access: 'private', useCache: false });
  } catch (err) {
    /* Premier lancement : aucune sélection enregistrée */
    if (!(err instanceof BlobNotFoundError)) throw err;
  }
  const v = res && res.statusCode === 200 ? await new Response(res.stream).json() : null;
  return { offres: Array.isArray(v && v.offres) ? v.offres : [], maj: (v && v.maj) || null };
}

/* Contrôle la sélection envoyée par l'admin ; lève une erreur lisible si invalide */
function valider(liste) {
  if (!Array.isArray(liste)) throw new Error('Sélection invalide');
  if (liste.length > MAX_OFFRES) throw new Error(`${MAX_OFFRES} produits maximum`);
  const vus = new Set();
  const offres = liste.map((o, i) => {
    const produitId = Number(o && o.produitId);
    if (!Number.isInteger(produitId) || produitId <= 0) throw new Error('Produit invalide');
    if (vus.has(produitId)) throw new Error('Un produit est sélectionné deux fois');
    vus.add(produitId);
    const debut = String((o && o.debut) || '');
    const fin = String((o && o.fin) || '');
    if (debut && !RE_DATE.test(debut)) throw new Error('Date de début invalide');
    if (fin && !RE_DATE.test(fin)) throw new Error('Date de fin invalide');
    if (debut && fin && fin <= debut) throw new Error('La date de fin doit être après la date de début');
    return { produitId, position: i + 1, actif: o.actif !== false, debut, fin };
  });
  const actives = offres.filter(o => o.actif).length;
  /* 0 active = section désactivée volontairement ; sinon 3 à 5 */
  if (actives && actives < MIN_ACTIVES) throw new Error(`Au moins ${MIN_ACTIVES} produits actifs (ou aucun pour masquer la section)`);
  return offres;
}

async function ecrireOffres(liste) {
  const valeur = { offres: valider(liste), maj: new Date().toISOString() };
  await put(CHEMIN, JSON.stringify(valeur), {
    access: 'private', allowOverwrite: true, addRandomSuffix: false,
    contentType: 'application/json', cacheControlMaxAge: 60,
  });
  return valeur;
}

/* Heure actuelle à Paris, même format que debut / fin : comparaison par chaîne */
function maintenantParis() {
  const p = Object.fromEntries(new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date()).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

const enCours = (o, maintenant) => o.actif && (!o.debut || o.debut <= maintenant) && (!o.fin || maintenant < o.fin);

/* Offres visibles par le public, complétées avec les données réelles du catalogue.
   Prix = celui que le serveur facture au paiement (api/stripe-checkout.js) :
   prix fixé dans l'admin (jamais sous le coût Mobilax TTC), sinon prix automatique.
   Produits masqués ou épuisés retirés ; moins de 3 → liste vide (section cachée). */
async function offresPubliques() {
  const { offres } = await lireOffres();
  const maintenant = maintenantParis();
  const retenues = offres.filter(o => enCours(o, maintenant)).sort((a, b) => a.position - b.position);
  if (retenues.length < MIN_ACTIVES) return [];

  const [{ produits }, reglages] = await Promise.all([chargerCatalogue(), lireReglages().catch(() => null)]);
  const parId = new Map(produits.map(p => [p.id, p]));
  const masques = new Set(((reglages && reglages.masques) || []).map(Number));

  const cartes = retenues.map(o => {
    const p = parId.get(o.produitId);
    if (!p || masques.has(p.id) || p.stock === 0) return null;
    const prixFixe = reglages && reglages.prix && reglages.prix[p.id];
    const prix = prixFixe != null ? Math.max(Number(prixFixe), prixMinimum(p._achatHT)) : p.prix;
    return {
      id: p.id,
      nom: p.nom,
      prix,
      image: (reglages && reglages.photos && reglages.photos[p.id]) || p.image || null,
      emoji: p.emoji,
      description: p.description && p.description !== p.nom ? String(p.description).slice(0, 140) : '',
    };
  }).filter(Boolean);
  return cartes.length >= MIN_ACTIVES ? cartes.slice(0, MAX_OFFRES) : [];
}

module.exports = { lireOffres, ecrireOffres, offresPubliques, maintenantParis, MIN_ACTIVES, MAX_OFFRES };
