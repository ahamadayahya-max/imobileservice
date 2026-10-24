/* ============================================================
   Registre des factures automatiques (paiements carte Stripe)
   Série distincte des factures admin : FC-AAAA-NNNN, numérotation
   CONTINUE par année (obligation légale), sans trou ni doublon.

   factures/compteur.json            { "2026": 12, ... }
   factures/carte/FC-2026-0012.json  données figées de la facture
   factures/carte/FC-2026-0012.pdf   PDF envoyé au client
   factures/session/<cs_…>.json      { numero } — évite toute double facture
                                     si Stripe renvoie la même notification
   ============================================================ */

const { get, put, list, BlobNotFoundError, BlobPreconditionFailedError } = require('@vercel/blob');

const COMPTEUR = 'factures/compteur.json';

async function lireJson(pathname) {
  try {
    const res = await get(pathname, { access: 'private', useCache: false });
    if (!res || res.statusCode !== 200) return null;
    return { valeur: await new Response(res.stream).json(), etag: res.blob && res.blob.etag };
  } catch (err) {
    if (err instanceof BlobNotFoundError) return null;
    throw err;
  }
}

async function ecrire(pathname, contenu, contentType, options = {}) {
  return put(pathname, contenu, {
    access: 'private', addRandomSuffix: false, contentType, cacheControlMaxAge: 60, ...options,
  });
}

/* Réserve le prochain numéro. Écriture conditionnelle (ifMatch) : si deux
   paiements arrivent en même temps, l'un des deux recommence avec la valeur à jour. */
async function reserverNumero(date = new Date()) {
  const annee = String(date.getFullYear());
  for (let essai = 0; essai < 6; essai++) {
    const actuel = await lireJson(COMPTEUR);
    const compteurs = (actuel && actuel.valeur) || {};
    const suivant = (Number(compteurs[annee]) || 0) + 1;
    try {
      await ecrire(COMPTEUR, JSON.stringify({ ...compteurs, [annee]: suivant }), 'application/json',
        actuel ? { allowOverwrite: true, ifMatch: actuel.etag } : { allowOverwrite: false });
      return `FC-${annee}-${String(suivant).padStart(4, '0')}`;
    } catch (err) {
      const conflit = err instanceof BlobPreconditionFailedError || /already exists|precondition/i.test(err.message);
      if (!conflit) throw err;
      await new Promise(r => setTimeout(r, 150 + Math.random() * 300));
    }
  }
  throw new Error('Numéro de facture indisponible (trop de conflits)');
}

async function factureDeSession(sessionId) {
  const r = await lireJson(`factures/session/${sessionId}.json`);
  return r ? r.valeur.numero : null;
}

async function enregistrerFacture(facture, pdf) {
  await ecrire(`factures/carte/${facture.numero}.pdf`, pdf, 'application/pdf', { allowOverwrite: false });
  await ecrire(`factures/carte/${facture.numero}.json`, JSON.stringify(facture), 'application/json', { allowOverwrite: true });
  await ecrire(`factures/session/${facture.sessionId}.json`, JSON.stringify({ numero: facture.numero }), 'application/json', { allowOverwrite: true });
}

async function majFacture(numero, champs) {
  const r = await lireJson(`factures/carte/${numero}.json`);
  if (!r) return;
  await ecrire(`factures/carte/${numero}.json`, JSON.stringify({ ...r.valeur, ...champs }), 'application/json', { allowOverwrite: true });
}

/* Pour l'admin : liste des factures carte, plus récentes d'abord */
async function listerFactures() {
  const blobs = [];
  let cursor;
  do {
    const page = await list({ prefix: 'factures/carte/', limit: 1000, cursor });
    blobs.push(...page.blobs.filter(b => b.pathname.endsWith('.json')));
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  blobs.sort((a, b) => b.pathname.localeCompare(a.pathname));
  const factures = [];
  for (let i = 0; i < blobs.length; i += 20) {
    const lot = await Promise.all(blobs.slice(i, i + 20).map(b => lireJson(b.pathname).catch(() => null)));
    factures.push(...lot.filter(Boolean).map(r => r.valeur));
  }
  return factures;
}

async function lirePdf(numero) {
  if (!/^FC-\d{4}-\d{4,}$/.test(numero)) return null;
  try {
    const res = await get(`factures/carte/${numero}.pdf`, { access: 'private', useCache: false });
    return res && res.statusCode === 200 ? Buffer.from(await new Response(res.stream).arrayBuffer()) : null;
  } catch (err) {
    if (err instanceof BlobNotFoundError) return null;
    throw err;
  }
}

module.exports = { reserverNumero, factureDeSession, enregistrerFacture, majFacture, listerFactures, lirePdf };
