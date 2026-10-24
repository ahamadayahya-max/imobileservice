/* ============================================================
   Envoi d'emails depuis le serveur via Gmail (Nodemailer)
   Variables Vercel : GMAIL_USER (ims.tlse@gmail.com) et
   GMAIL_APP_PASSWORD — un « mot de passe d'application » Google,
   jamais le mot de passe du compte. GMAIL_PASSWORD accepté aussi.
   ============================================================ */

const nodemailer = require('nodemailer');
const { ENTREPRISE } = require('./entreprise');

const utilisateur = () => (process.env.GMAIL_USER || '').trim();
const motDePasse = () => (process.env.GMAIL_APP_PASSWORD || process.env.GMAIL_PASSWORD || '').replace(/\s+/g, '');

function emailConfigure() {
  return Boolean(utilisateur() && motDePasse());
}

let transport = null;
function transporteur() {
  if (!transport) {
    transport = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: utilisateur(), pass: motDePasse() },
    });
  }
  return transport;
}

const esc = t => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const euros = n => Number(n).toFixed(2).replace('.', ',') + ' €';

/* Email client : confirmation + facture PDF en pièce jointe */
async function envoyerFactureClient(f, pdf) {
  const prenom = (f.client.nom || '').split(' ')[0] || '';
  const lignes = f.lignes.map(l => `<tr><td style="padding:6px 0;">${esc(l.designation)}</td><td style="padding:6px 8px;text-align:center;">×${l.qte}</td><td style="padding:6px 0;text-align:right;white-space:nowrap;">${euros(l.qte * l.pu)}</td></tr>`).join('');
  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:auto;color:#1a1d29;">
    <h2 style="color:#8b1a1a;margin:0 0 4px;">i-Mobile<span style="color:#0097a7;">Service</span></h2>
    <p>Bonjour ${esc(prenom)},</p>
    <p>Merci pour votre commande ! Votre paiement par carte est bien reçu.</p>
    <h3 style="margin:20px 0 6px;">📦 Récapitulatif — commande ${esc(f.commande || '')}</h3>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">${lignes}
      <tr><td colspan="2" style="padding-top:10px;border-top:2px solid #1a1d29;"><strong>Total payé</strong></td>
          <td style="padding-top:10px;border-top:2px solid #1a1d29;text-align:right;"><strong>${euros(f.ttc)}</strong></td></tr>
    </table>
    <p style="margin-top:14px;"><strong>Réception :</strong> ${esc(f.livraison || 'Retrait en boutique')}</p>
    <p>📎 Votre facture <strong>${esc(f.numero)}</strong> est en pièce jointe.</p>
    <p style="margin-top:20px;">Pour toute question :<br>
      📞 ${ENTREPRISE.telephone}<br>✉️ ${ENTREPRISE.email}<br>🏪 ${ENTREPRISE.adresse}, ${ENTREPRISE.cpVille}<br>
      Mar-Ven 10h-19h / Sam 10h-18h</p>
    <p>Cordialement,<br>L'équipe i-Mobile Service</p>
  </div>`;

  return transporteur().sendMail({
    from: `"i-Mobile Service" <${utilisateur()}>`,
    to: f.client.email,
    replyTo: ENTREPRISE.email,
    subject: `✅ Confirmation commande i-Mobile Service — Facture ${f.numero}`,
    html,
    attachments: [{ filename: `Facture-${f.numero}.pdf`, content: pdf, contentType: 'application/pdf' }],
  });
}

/* Email boutique : alerte commande payée, avec les actions à faire */
async function envoyerAlerteBoutique(f, pdf) {
  const produits = f.lignes.map(l => `• ${l.designation} ×${l.qte} = ${euros(l.qte * l.pu)}`).join('\n');
  const texte = [
    'COMMANDE PAYÉE PAR CARTE (Stripe)',
    '━━━━━━━━━━━━━━━━━━━━',
    `Commande : ${f.commande || '—'}  ·  Facture : ${f.numero}`,
    `Client : ${f.client.nom || '—'} · ${f.client.email || '—'} · ${f.client.tel || '—'}`,
    `Montant : ${euros(f.ttc)}`,
    `Référence Stripe : ${f.referencePaiement}`,
    '',
    'PRODUITS :',
    produits,
    '',
    `LIVRAISON : ${f.livraison || 'Retrait en boutique'}`,
    f.client.adresse ? `Adresse / point relais : ${f.client.adresse}` : '',
    '',
    'ACTION REQUISE :',
    '→ Commander chez Mobilax',
    '→ Préparer la commande',
    '━━━━━━━━━━━━━━━━━━━━',
  ].filter(l => l !== null).join('\n');

  return transporteur().sendMail({
    from: `"Boutique i-Mobile Service" <${utilisateur()}>`,
    to: ENTREPRISE.email,
    replyTo: f.client.email || undefined,
    subject: `🛒 NOUVELLE COMMANDE PAYÉE — ${euros(f.ttc)}`,
    text: texte,
    attachments: [{ filename: `Facture-${f.numero}.pdf`, content: pdf, contentType: 'application/pdf' }],
  });
}

module.exports = { emailConfigure, envoyerFactureClient, envoyerAlerteBoutique };
