/* ============================================================
   Réglages boutique partagés (Vercel Blob privé)
   Un seul fichier JSON, source de vérité pour le site ET l'admin :
     prix       { [idProduit]: prixTTC }   — prix fixé à la main
     masques    [idProduit, …]             — retirés de la boutique
     photos     { [idProduit]: url }       — photo remplaçant celle de Mobilax
     historique [{ id, nom, ancien, nouveau, date }] — 50 derniers changements de prix
   ============================================================ */

const { get, put, BlobNotFoundError } = require('@vercel/blob');

const CHEMIN = 'reglages/boutique.json';
const VIDE = () => ({ prix: {}, masques: [], photos: {}, historique: [], maj: null });

/* Cache mémoire court : chaque visiteur lit les réglages, inutile de
   solliciter le stockage à chaque requête */
let cache = { valeur: null, jusqua: 0 };
const CACHE_MS = 15 * 1000;

function normaliser(r) {
  const v = VIDE();
  if (!r || typeof r !== 'object') return v;
  if (r.prix && typeof r.prix === 'object') v.prix = r.prix;
  if (Array.isArray(r.masques)) v.masques = r.masques;
  if (r.photos && typeof r.photos === 'object') v.photos = r.photos;
  if (Array.isArray(r.historique)) v.historique = r.historique;
  v.maj = r.maj || null;
  return v;
}

async function lireReglages({ fraisDuStockage = false } = {}) {
  if (!fraisDuStockage && cache.valeur && Date.now() < cache.jusqua) return cache.valeur;
  let res = null;
  try {
    res = await get(CHEMIN, { access: 'private', useCache: false });
  } catch (err) {
    /* Premier lancement : le fichier n'existe pas encore, réglages vides */
    if (!(err instanceof BlobNotFoundError)) throw err;
  }
  const valeur = res && res.statusCode === 200 ? normaliser(await new Response(res.stream).json()) : VIDE();
  cache = { valeur, jusqua: Date.now() + CACHE_MS };
  return valeur;
}

async function ecrireReglages(r) {
  const valeur = normaliser({ ...r, maj: new Date().toISOString() });
  await put(CHEMIN, JSON.stringify(valeur), {
    access: 'private',
    allowOverwrite: true,
    addRandomSuffix: false,
    contentType: 'application/json',
    cacheControlMaxAge: 60,
  });
  cache = { valeur, jusqua: Date.now() + CACHE_MS };
  return valeur;
}

module.exports = { lireReglages, ecrireReglages };
