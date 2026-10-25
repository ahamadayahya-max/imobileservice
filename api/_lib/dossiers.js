/* ============================================================
   Commandes et devis enregistrés côté serveur (Vercel Blob privé)
   Un fichier par dossier : dossiers/<type>/<horodatage>_<numéro>.json
   → pas de conflit si deux clients commandent en même temps.
   Les données client (nom, email, téléphone) ne sont lisibles que
   par l'admin connecté (voir api/dossiers.js).
   ============================================================ */

const { get, put, list, del, BlobNotFoundError } = require('@vercel/blob');

const TYPES = {
  commande: { statuts: ['en_attente', 'confirmee', 'expediee', 'livree', 'annulee'], initial: 'en_attente' },
  devis:    { statuts: ['nouveau', 'envoye', 'accepte', 'repare', 'rendu', 'refuse'], initial: 'nouveau' },
  rdv:      { statuts: ['nouveau', 'confirme', 'honore', 'absent', 'annule'], initial: 'nouveau' },
  message:  { statuts: ['nouveau', 'repondu', 'archive'], initial: 'nouveau' },
};

const txt = (v, max = 200) => String(v == null ? '' : v).replace(/[<>"`]/g, '').trim().slice(0, max);
const num = v => { const n = Math.round(Number(v) * 100) / 100; return Number.isFinite(n) && n >= 0 && n < 1e6 ? n : 0; };

/* Ne garde que les champs attendus, bornés en taille : le corps vient d'un visiteur */
function nettoyer(type, d) {
  d = d && typeof d === 'object' ? d : {};
  const c = d.client && typeof d.client === 'object' ? d.client : {};
  if (type === 'commande') {
    const liv = d.livraison && typeof d.livraison === 'object' ? d.livraison : {};
    const relais = liv.relais && typeof liv.relais === 'object' ? liv.relais : null;
    return {
      id: txt(d.id, 30),
      date: txt(d.date, 40),
      client: {
        civilite: ['M.', 'Mme'].includes(c.civilite) ? c.civilite : '',
        prenom: txt(c.prenom, 80),
        nomFamille: txt(c.nomFamille, 80),
        nom: txt(c.nom, 120),
        email: txt(c.email, 160), phone: txt(c.phone, 40),
      },
      articles: (Array.isArray(d.articles) ? d.articles : []).slice(0, 50).map(a => ({
        id: txt(a && a.id, 20), name: txt(a && a.name, 200), price: num(a && a.price), qty: Math.min(9999, Math.max(1, Math.floor(Number(a && a.qty) || 1))),
      })),
      livraison: {
        mode: txt(liv.mode, 20),
        adresse: txt(liv.adresse, 600),
        adresseLivraison: liv.adresseLivraison && typeof liv.adresseLivraison === 'object' ? {
          ligne1: txt(liv.adresseLivraison.ligne1, 200), complement: txt(liv.adresseLivraison.complement, 200),
          codePostal: txt(liv.adresseLivraison.codePostal, 10), ville: txt(liv.adresseLivraison.ville, 100),
        } : null,
        relais: relais ? {
          id: txt(relais.id, 40), nom: txt(relais.nom, 120), categorie: txt(relais.categorie, 60),
          adresse: txt(relais.adresseComplete || relais.adresse, 200),
          horaires: txt(relais.horairesTexte, 300),
        } : null,
      },
      soustotal: num(d.soustotal), frais: num(d.frais), total: num(d.total),
      /* boutique = payé au retrait ; carte_attente → carte_payee via Stripe */
      paiement: ['boutique', 'carte_attente', 'carte_payee'].includes(d.paiement) ? d.paiement : 'boutique',
    };
  }
  if (type === 'message') {
    return {
      id: txt(d.id, 30),
      date: txt(d.date, 40),
      sujet: txt(d.sujet, 80),
      message: txt(d.message, 3000),
      client: { prenom: txt(c.prenom, 80), nom: txt(c.nom, 80), email: txt(c.email, 160), tel: txt(c.tel, 40) },
    };
  }
  if (type === 'rdv') {
    return {
      id: txt(d.id, 30),
      date: txt(d.date, 40),
      jour: /^\d{4}-\d{2}-\d{2}$/.test(String(d.jour)) ? String(d.jour) : '',
      heure: /^\d{1,2}[:h]\d{2}$/.test(String(d.heure)) ? String(d.heure) : '',
      appareil: txt(d.appareil, 80), marque: txt(d.marque, 80),
      pannes: txt(d.pannes, 400), description: txt(d.description, 1500), message: txt(d.message, 1500),
      client: { prenom: txt(c.prenom, 80), nom: txt(c.nom, 80), email: txt(c.email, 160), tel: txt(c.tel, 40) },
    };
  }
  return {
    id: txt(d.numero || d.id, 30),
    date: txt(d.date, 40),
    appareil: txt(d.appareil, 80), modele: txt(d.modele, 120),
    pannes: txt(d.pannes, 400), description: txt(d.description, 1500),
    client: { prenom: txt(c.prenom, 80), nom: txt(c.nom, 80), email: txt(c.email, 160), tel: txt(c.tel, 40) },
  };
}

async function lireBlob(pathname) {
  let res;
  try {
    res = await get(pathname, { access: 'private', useCache: false });
  } catch (err) {
    if (err instanceof BlobNotFoundError) return null;
    throw err;
  }
  return res && res.statusCode === 200 ? new Response(res.stream).json() : null;
}

async function ecrireBlob(pathname, valeur) {
  await put(pathname, JSON.stringify(valeur), {
    access: 'private', allowOverwrite: true, addRandomSuffix: false, contentType: 'application/json', cacheControlMaxAge: 60,
  });
}

async function creerDossier(type, donnees) {
  const d = nettoyer(type, donnees);
  const creeLe = new Date().toISOString();
  const numero = d.id.replace(/[^A-Za-z0-9-]/g, '') || ({ devis: 'DEV', rdv: 'RDV', message: 'MSG' }[type] || 'IMS') + '-' + Date.now().toString(36).toUpperCase();
  const cle = `dossiers/${type}/${creeLe.replace(/[:.]/g, '-')}_${numero}.json`;
  const dossier = { ...d, id: numero, type, statut: TYPES[type].initial, creeLe, cle };
  await ecrireBlob(cle, dossier);
  return dossier;
}

/* Liste complète d'un type, du plus récent au plus ancien */
async function listerDossiers(type) {
  const blobs = [];
  let cursor;
  do {
    const page = await list({ prefix: `dossiers/${type}/`, limit: 1000, cursor });
    blobs.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  blobs.sort((a, b) => b.pathname.localeCompare(a.pathname));
  /* Lecture par petits paquets pour ne pas saturer le stockage */
  const dossiers = [];
  for (let i = 0; i < blobs.length; i += 20) {
    const lot = await Promise.all(blobs.slice(i, i + 20).map(b => lireBlob(b.pathname).catch(() => null)));
    dossiers.push(...lot.filter(Boolean).map((d, j) => ({ ...d, cle: blobs[i + j].pathname })));
  }
  return dossiers;
}

function cleValide(type, cle) {
  return typeof cle === 'string' && cle.startsWith(`dossiers/${type}/`) && /^[\w\-/.]+\.json$/.test(cle) && !cle.includes('..');
}

async function changerStatut(type, cle, statut) {
  if (!cleValide(type, cle) || !TYPES[type].statuts.includes(statut)) throw new Error('Paramètres invalides');
  const dossier = await lireBlob(cle);
  if (!dossier) throw new Error('Dossier introuvable');
  dossier.statut = statut;
  dossier.majLe = new Date().toISOString();
  await ecrireBlob(cle, dossier);
  return { ...dossier, cle };
}

/* Paiement Stripe confirmé : commande confirmée et marquée payée par carte */
async function marquerCommandePayee(cle, referencePaiement) {
  if (!cleValide('commande', cle)) throw new Error('Paramètres invalides');
  const dossier = await lireBlob(cle);
  if (!dossier) throw new Error('Dossier introuvable');
  if (dossier.paiement === 'carte_payee') return { dossier: { ...dossier, cle }, dejaFait: true };
  Object.assign(dossier, {
    paiement: 'carte_payee',
    statut: dossier.statut === 'en_attente' ? 'confirmee' : dossier.statut,
    referencePaiement: String(referencePaiement || '').slice(0, 80),
    payeLe: new Date().toISOString(),
  });
  await ecrireBlob(cle, dossier);
  return { dossier: { ...dossier, cle }, dejaFait: false };
}

async function supprimerDossier(type, cle) {
  if (!cleValide(type, cle)) throw new Error('Paramètres invalides');
  await del(cle);
}

/* Créneaux de rendez-vous déjà réservés (à venir, ni annulés ni absents).
   Uniquement date + heure : aucune donnée client ne sort de cette fonction.
   Cache court : le calendrier est consulté par chaque visiteur. */
let cacheCreneaux = { valeur: null, jusqua: 0 };

async function creneauxPris({ frais = false } = {}) {
  if (!frais && cacheCreneaux.valeur && Date.now() < cacheCreneaux.jusqua) return cacheCreneaux.valeur;
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const valeur = (await listerDossiers('rdv'))
    .filter(r => r.jour && r.heure && r.jour >= aujourdhui && !['annule', 'absent'].includes(r.statut))
    .map(r => `${r.jour} ${r.heure.replace('h', ':')}`);
  cacheCreneaux = { valeur: [...new Set(valeur)].sort(), jusqua: Date.now() + 30 * 1000 };
  return cacheCreneaux.valeur;
}

/* Un changement de statut (ex. annulation) libère ou bloque un créneau : on vide le cache */
function invaliderCreneaux() { cacheCreneaux = { valeur: null, jusqua: 0 }; }

/* Lecture d'un dossier précis (ex. commande liée à un paiement Stripe) */
async function lireDossier(type, cle) {
  if (!cleValide(type, cle)) return null;
  const d = await lireBlob(cle);
  return d ? { ...d, cle } : null;
}

module.exports = { TYPES, creerDossier, listerDossiers, changerStatut, supprimerDossier, creneauxPris, invaliderCreneaux, marquerCommandePayee, lireDossier };
