/* ============================================================
   i-Mobile Service — Paiement par carte (Stripe Checkout)

   POST /api/stripe-checkout
     corps : { articles: [{ id, qty }], livraison: { mode, adresse, relais },
               client: { nom, email, phone } }
     → { url } de la page de paiement Stripe

   GET  /api/stripe-checkout?session_id=cs_…
     → état du paiement (appelé par success.html) ; marque la commande payée.

   SÉCURITÉ : le navigateur n'envoie QUE des identifiants et des quantités.
   Prix et frais de livraison sont recalculés ici (catalogue Mobilax + réglages
   admin) : un client ne peut pas modifier ce qu'il paie.
   ============================================================ */

const Stripe = require('stripe');
const { chargerCatalogue } = require('./mobilax');
const { lireReglages } = require('./_lib/reglages');
const { creerDossier, marquerCommandePayee } = require('./_lib/dossiers');
const { fraisLivraison, LIVRAISON } = require('./_lib/livraison');
const { emailConfigure } = require('./_lib/email');

/* Seules ces adresses peuvent servir de retour après paiement */
const ORIGINES = ['https://imobileservice.fr', 'https://www.imobileservice.fr', 'https://imobileservice.vercel.app'];

function origineDe(req) {
  const o = String(req.headers.origin || '');
  if (ORIGINES.includes(o)) return o;
  const hote = String(req.headers['x-forwarded-host'] || req.headers.host || '');
  return ORIGINES.find(x => x.endsWith('//' + hote)) || ORIGINES[0];
}

const txt = (v, max = 200) => String(v == null ? '' : v).replace(/[<>"`]/g, '').trim().slice(0, max);

/* Prix de vente actuel de chaque produit, réglages admin compris (prix fixés, masqués) */
async function tarifsActuels() {
  const [{ produits }, reglages] = await Promise.all([chargerCatalogue(), lireReglages().catch(() => null)]);
  const masques = new Set(((reglages && reglages.masques) || []).map(Number));
  const tarifs = new Map();
  for (const p of produits) {
    if (masques.has(p.id) || p.stock === 0) continue;
    const prixFixe = reglages && reglages.prix && reglages.prix[p.id];
    tarifs.set(p.id, { nom: p.nom, prix: prixFixe != null ? Number(prixFixe) : p.prix, image: p.image });
  }
  return tarifs;
}

async function creerPaiement(stripe, req, res) {
  const corps = req.body || {};
  const demandes = (Array.isArray(corps.articles) ? corps.articles : []).slice(0, 50)
    .map(a => ({ id: Number(a && a.id), qty: Math.min(99, Math.max(1, Math.floor(Number(a && (a.qty ?? a.quantite)) || 1))) }))
    .filter(a => Number.isInteger(a.id) && a.id > 0);
  if (!demandes.length) return res.status(400).json({ status: 'ERROR', message: 'Panier vide' });

  const tarifs = await tarifsActuels();
  const lignes = [];
  const indisponibles = [];
  for (const d of demandes) {
    const t = tarifs.get(d.id);
    if (!t) { indisponibles.push(d.id); continue; }
    lignes.push({ ...d, nom: t.nom, prix: t.prix, image: t.image });
  }
  if (indisponibles.length) {
    return res.status(409).json({
      status: 'INDISPONIBLE', indisponibles,
      message: "Certains articles ne sont plus disponibles au paiement par carte. Retirez-les ou choisissez « Payer en boutique ».",
    });
  }

  const mode = LIVRAISON[corps.livraison && corps.livraison.mode] ? corps.livraison.mode : 'store';
  const sousTotal = lignes.reduce((s, l) => s + l.prix * l.qty, 0);
  const frais = fraisLivraison(sousTotal, mode);
  const total = Math.round((sousTotal + frais) * 100) / 100;
  const client = corps.client || {};

  /* La commande est enregistrée AVANT le paiement : elle apparaît dans l'admin
     « en attente de paiement », puis passe en « confirmée » une fois payée. */
  const commande = await creerDossier('commande', {
    id: 'IMS-' + Date.now().toString(36).toUpperCase().slice(-6),
    date: new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }),
    client: { nom: txt(client.nom, 120), email: txt(client.email, 160), phone: txt(client.phone, 40) },
    articles: lignes.map(l => ({ id: l.id, name: l.nom, price: l.prix, qty: l.qty })),
    livraison: {
      mode,
      adresse: txt(corps.livraison && corps.livraison.adresse, 600) || LIVRAISON[mode].label,
      relais: corps.livraison && corps.livraison.relais,
    },
    soustotal: sousTotal, frais, total,
    paiement: 'carte_attente',
  });

  const origine = origineDe(req);
  const lineItems = lignes.map(l => ({
    price_data: {
      currency: 'eur',
      product_data: { name: l.nom.slice(0, 250), ...(l.image ? { images: [l.image] } : {}) },
      unit_amount: Math.round(l.prix * 100),
    },
    quantity: l.qty,
  }));
  if (frais > 0) {
    lineItems.push({
      price_data: { currency: 'eur', product_data: { name: `Livraison — ${LIVRAISON[mode].label}` }, unit_amount: Math.round(frais * 100) },
      quantity: 1,
    });
  }

  const email = txt(client.email, 160);
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    locale: 'fr',
    line_items: lineItems,
    ...(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? { customer_email: email } : {}),
    client_reference_id: commande.id,
    metadata: { commande: commande.id, cle: commande.cle, livraison: mode, boutique: 'i-Mobile Service Toulouse' },
    success_url: `${origine}/success.html?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origine}/cancel.html?commande=${encodeURIComponent(commande.id)}`,
  });

  return res.status(200).json({ status: 'OK', url: session.url, commande: commande.id, total });
}

/* Appelé par success.html : on demande à Stripe si la session est réellement payée */
async function verifierPaiement(stripe, req, res) {
  const id = String(req.query.session_id || '');
  if (!/^cs_(live|test)_[A-Za-z0-9]+$/.test(id)) return res.status(400).json({ status: 'ERROR', message: 'Session invalide' });

  const session = await stripe.checkout.sessions.retrieve(id, { expand: ['line_items'] });
  const paye = session.payment_status === 'paid';
  const cle = session.metadata && session.metadata.cle;

  /* Commande marquée payée une seule fois (le client peut recharger la page) */
  let premiereConfirmation = false;
  if (paye && cle) {
    const { dejaFait } = await marquerCommandePayee(cle, session.payment_intent || session.id);
    premiereConfirmation = !dejaFait;
  }

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    status: 'OK',
    paye,
    premiereConfirmation,
    /* true : facture + emails partent du serveur (webhook) ; la page ne renvoie rien */
    emailsAutomatiques: emailConfigure(),
    commande: session.client_reference_id,
    total: (session.amount_total || 0) / 100,
    email: session.customer_details && session.customer_details.email,
    nom: session.customer_details && session.customer_details.name,
    livraison: session.metadata && session.metadata.livraison,
    articles: ((session.line_items && session.line_items.data) || []).map(l => ({ nom: l.description, qty: l.quantity, total: l.amount_total / 100 })),
  });
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({ status: 'ERROR', message: 'Paiement par carte bientôt disponible. Choisissez « Payer en boutique ».' });
  }
  const stripe = Stripe(process.env.STRIPE_SECRET_KEY.trim());

  try {
    if (req.method === 'POST') return await creerPaiement(stripe, req, res);
    if (req.method === 'GET') return await verifierPaiement(stripe, req, res);
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ status: 'ERROR', message: 'Méthode non autorisée' });
  } catch (err) {
    /* Aucune donnée client ni clé dans les journaux */
    console.error('[stripe]', err.type || '', err.code || '', err.message);
    return res.status(502).json({ status: 'ERROR', message: 'Paiement indisponible pour le moment. Réessayez ou appelez le 05 31 21 71 38.' });
  }
};
