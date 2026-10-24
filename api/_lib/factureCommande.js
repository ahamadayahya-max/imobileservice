/* ============================================================
   Facture automatique d'une commande payée par carte (Stripe)
   Appelé par le webhook. Idempotent : une session Stripe = une seule
   facture, même si Stripe renvoie la notification plusieurs fois.
   ============================================================ */

const { ventilerTTC } = require('./entreprise');
const { genererFacturePdf } = require('./facturePdf');
const { reserverNumero, factureDeSession, enregistrerFacture, majFacture } = require('./facturesServeur');
const { lireDossier } = require('./dossiers');
const { emailConfigure, envoyerFactureClient, envoyerAlerteBoutique } = require('./email');

const LIBELLES_LIVRAISON = {
  store: 'Retrait en boutique — 221 Route de Seysses, Toulouse',
  pickup: 'Retrait Point Relais Pickup',
  vinted: 'Vinted Locker',
  delivery: 'Livraison à domicile (Colissimo 2-3 jours)',
};

async function facturerSession(stripe, session) {
  const existante = await factureDeSession(session.id);
  if (existante) return { numero: existante, dejaFaite: true };

  /* Articles réellement payés, tels que Stripe les a encaissés */
  const items = await stripe.checkout.sessions.listLineItems(session.id, { limit: 100 });
  const lignes = items.data.map(l => ({
    designation: l.description,
    qte: l.quantity,
    pu: Math.round(l.amount_total / l.quantity) / 100,
  }));

  /* Commande enregistrée au moment du paiement : téléphone, adresse, point relais */
  const cle = session.metadata && session.metadata.cle;
  const commande = cle ? await lireDossier('commande', cle).catch(() => null) : null;
  const mode = (session.metadata && session.metadata.livraison) || (commande && commande.livraison && commande.livraison.mode) || 'store';
  const relais = commande && commande.livraison && commande.livraison.relais;
  const adresse = mode === 'delivery'
    ? commande && commande.livraison && commande.livraison.adresse
    : relais && relais.nom ? `Point relais : ${relais.nom}${relais.adresse ? ', ' + relais.adresse : ''}` : '';

  const details = session.customer_details || {};
  const total = (session.amount_total || 0) / 100;
  const maintenant = new Date();

  const facture = {
    numero: await reserverNumero(maintenant),
    date: maintenant.toISOString(),
    dateFr: maintenant.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' }),
    commande: session.client_reference_id || (commande && commande.id) || '',
    sessionId: session.id,
    referencePaiement: session.payment_intent || session.id,
    client: {
      nom: details.name || (commande && commande.client && commande.client.nom) || '',
      email: details.email || (commande && commande.client && commande.client.email) || '',
      tel: details.phone || (commande && commande.client && commande.client.phone) || '',
      adresse: adresse || '',
    },
    livraison: LIBELLES_LIVRAISON[mode] || mode,
    lignes,
    ...ventilerTTC(total),
    emails: { client: false, boutique: false },
  };

  const pdf = await genererFacturePdf(facture);
  await enregistrerFacture(facture, pdf);

  /* Envoi des emails : un échec n'annule pas la facture (déjà archivée) */
  if (emailConfigure()) {
    const resultats = await Promise.allSettled([
      facture.client.email ? envoyerFactureClient(facture, pdf) : Promise.reject(new Error('email client absent')),
      envoyerAlerteBoutique(facture, pdf),
    ]);
    const emails = { client: resultats[0].status === 'fulfilled', boutique: resultats[1].status === 'fulfilled' };
    resultats.forEach((r, i) => { if (r.status === 'rejected') console.error(`[facture] email ${i ? 'boutique' : 'client'} non envoyé (${facture.numero}) :`, r.reason && r.reason.message); });
    await majFacture(facture.numero, { emails });
  } else {
    console.warn(`[facture] ${facture.numero} archivée ; emails non envoyés (GMAIL_USER / GMAIL_APP_PASSWORD absents)`);
  }
  return { numero: facture.numero, dejaFaite: false };
}

module.exports = { facturerSession };
