/* ============================================================
   i-Mobile Service — Notifications automatiques de Stripe (webhook)

   Stripe appelle POST /api/stripe-webhook dès qu'un paiement Checkout est
   validé, même si le client a fermé la page avant de revenir sur le site.
   La commande passe alors en « Payé par carte » dans l'admin.

   SÉCURITÉ : chaque appel est signé par Stripe ; la signature est vérifiée
   avec STRIPE_WEBHOOK_SECRET (whsec_…) sur le corps BRUT de la requête.
   Un appel non signé ou falsifié est refusé.
   ============================================================ */

const Stripe = require('stripe');
const { marquerCommandePayee } = require('./_lib/dossiers');
const { facturerSession } = require('./_lib/factureCommande');

/* Événements qui signifient « argent encaissé » */
const PAIEMENT_VALIDE = new Set(['checkout.session.completed', 'checkout.session.async_payment_succeeded']);

/* Corps brut indispensable à la vérification de signature : on lit le flux
   nous-mêmes au lieu de laisser Vercel le transformer en JSON */
function lireCorpsBrut(req) {
  return new Promise((resolve, reject) => {
    const morceaux = [];
    req.on('data', m => morceaux.push(Buffer.isBuffer(m) ? m : Buffer.from(m)));
    req.on('end', () => resolve(Buffer.concat(morceaux)));
    req.on('error', reject);
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }
  const secret = (process.env.STRIPE_WEBHOOK_SECRET || '').trim();
  if (!secret || !process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({ error: 'Webhook Stripe non configuré' });
  }

  let evenement;
  try {
    const brut = await lireCorpsBrut(req);
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY.trim());
    evenement = stripe.webhooks.constructEvent(brut, req.headers['stripe-signature'], secret);
  } catch (err) {
    console.warn('[stripe-webhook] signature refusée :', err.message);
    return res.status(400).json({ error: 'Signature invalide' });
  }

  try {
    if (PAIEMENT_VALIDE.has(evenement.type)) {
      const session = evenement.data.object;
      const cle = session.metadata && session.metadata.cle;
      if (session.payment_status === 'paid') {
        if (cle) {
          const { dejaFait } = await marquerCommandePayee(cle, session.payment_intent || session.id);
          /* Journal sans donnée client : uniquement le numéro de commande */
          console.log(`[stripe-webhook] commande ${session.client_reference_id} ${dejaFait ? 'déjà marquée payée' : 'marquée payée'}`);
        }
        /* Facture PDF + emails client et boutique (une seule fois par paiement) */
        const stripe = Stripe(process.env.STRIPE_SECRET_KEY.trim());
        const { numero, dejaFaite } = await facturerSession(stripe, session);
        console.log(`[stripe-webhook] facture ${numero} ${dejaFaite ? 'déjà émise' : 'émise'}`);
      }
    }
    /* 200 = « bien reçu » : sinon Stripe réessaie pendant plusieurs jours */
    return res.status(200).json({ recu: true });
  } catch (err) {
    console.error('[stripe-webhook] traitement impossible :', err.message);
    /* 500 : Stripe renverra la notification plus tard */
    return res.status(500).json({ error: 'Traitement impossible, réessai attendu' });
  }
};

/* Indique à Vercel de ne pas transformer le corps (nécessaire à la signature) */
module.exports.config = { api: { bodyParser: false } };
