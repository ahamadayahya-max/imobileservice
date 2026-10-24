/* ============================================================
   Génération de la facture PDF (A4) — paiements carte Stripe
   Mentions obligatoires d'une facture de SASU assujettie à la TVA :
   n° unique et continu, date, vendeur (forme, capital, SIRET, RCS,
   n° TVA intracom.), client, désignation, quantités, prix unitaires,
   total HT, TVA par taux, total TTC, date et mode de paiement.
   ============================================================ */

const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const { ENTREPRISE } = require('./entreprise');

const BORDEAUX = rgb(0.545, 0.102, 0.102);
const CYAN = rgb(0, 0.59, 0.655);
const ENCRE = rgb(0.1, 0.11, 0.16);
const GRIS = rgb(0.36, 0.38, 0.46);
const TRAIT = rgb(0.87, 0.89, 0.93);

const euros = n => Number(n).toFixed(2).replace('.', ',') + ' €';

async function genererFacturePdf(f) {
  const doc = await PDFDocument.create();
  doc.setTitle(`Facture ${f.numero} — ${ENTREPRISE.nom}`);
  doc.setAuthor(`${ENTREPRISE.forme} ${ENTREPRISE.nom}`);
  const page = doc.addPage([595.28, 841.89]);
  const reg = await doc.embedFont(StandardFonts.Helvetica);
  const gras = await doc.embedFont(StandardFonts.HelveticaBold);

  /* Les polices standard PDF ne connaissent que l'alphabet latin (WinAnsi) :
     on remplace ou retire tout caractère non imprimable (emoji, symboles…) */
  const propre = (t, police = reg) => [...String(t == null ? '' : t)].map(c => {
    try { police.encodeText(c); return c; } catch { return c === '’' ? "'" : ''; }
  }).join('');

  const ecrire = (t, x, y, { taille = 10, police = reg, couleur = ENCRE, droite = false } = {}) => {
    const s = propre(t, police);
    const px = droite ? x - police.widthOfTextAtSize(s, taille) : x;
    page.drawText(s, { x: px, y, size: taille, font: police, color: couleur });
  };

  /* Coupe un texte trop long pour une colonne, sur plusieurs lignes */
  const couper = (t, largeur, taille = 9.5, police = reg) => {
    const mots = propre(t, police).split(/\s+/);
    const lignes = [];
    let ligne = '';
    for (const m of mots) {
      const essai = ligne ? ligne + ' ' + m : m;
      if (police.widthOfTextAtSize(essai, taille) <= largeur) ligne = essai;
      else { if (ligne) lignes.push(ligne); ligne = m; }
    }
    if (ligne) lignes.push(ligne);
    return lignes.slice(0, 3);
  };

  const G = 50, D = 545;
  let y = 790;

  /* --- En-tête --- */
  ecrire('i-Mobile', G, y, { taille: 20, police: gras, couleur: BORDEAUX });
  ecrire('Service', G + gras.widthOfTextAtSize('i-Mobile', 20), y, { taille: 20, police: gras, couleur: CYAN });
  ecrire('FACTURE', D, y, { taille: 20, police: gras, droite: true });
  y -= 18;
  ecrire(`N° ${f.numero}`, D, y, { taille: 11, police: gras, droite: true });
  y -= 14;
  ecrire(`Date : ${f.dateFr}`, D, y, { taille: 9.5, couleur: GRIS, droite: true });
  if (f.commande) { y -= 12; ecrire(`Commande : ${f.commande}`, D, y, { taille: 9.5, couleur: GRIS, droite: true }); }

  let yv = 772 - 16;
  for (const l of [
    `${ENTREPRISE.forme} ${ENTREPRISE.nom} — capital ${ENTREPRISE.capital}`,
    `${ENTREPRISE.adresse}, ${ENTREPRISE.cpVille}`,
    `Tél. ${ENTREPRISE.telephone} · ${ENTREPRISE.email}`,
    `SIRET ${ENTREPRISE.siret} · ${ENTREPRISE.rcs}`,
    `TVA intracommunautaire : ${ENTREPRISE.numeroTva}`,
  ]) { ecrire(l, G, yv, { taille: 8.5, couleur: GRIS }); yv -= 11.5; }

  y = Math.min(y, yv) - 10;
  page.drawLine({ start: { x: G, y }, end: { x: D, y }, thickness: 2, color: BORDEAUX });
  y -= 24;

  /* --- Client / paiement --- */
  const yBloc = y;
  ecrire('FACTURÉ À', G, y, { taille: 8, police: gras, couleur: GRIS });
  y -= 14;
  for (const l of [f.client.nom, f.client.email, f.client.tel, f.client.adresse].filter(Boolean)) {
    for (const ligne of couper(l, 240, 10)) { ecrire(ligne, G, y, { taille: 10 }); y -= 13; }
  }
  let yp = yBloc;
  ecrire('RÈGLEMENT', 320, yp, { taille: 8, police: gras, couleur: GRIS });
  yp -= 14; ecrire(`Payée le ${f.dateFr}`, 320, yp, { taille: 10, police: gras });
  yp -= 13; ecrire('Carte bancaire via Stripe', 320, yp, { taille: 10 });
  yp -= 13;
  for (const ligne of couper(`Réf. ${f.referencePaiement}`, 225, 8.5)) { ecrire(ligne, 320, yp, { taille: 8.5, couleur: GRIS }); yp -= 11; }
  if (f.livraison) { yp -= 2; for (const ligne of couper(`Réception : ${f.livraison}`, 225, 9)) { ecrire(ligne, 320, yp, { taille: 9 }); yp -= 12; } }

  y = Math.min(y, yp) - 18;

  /* --- Tableau des articles --- */
  const colQ = 380, colPU = 465, colT = D;
  ecrire('DÉSIGNATION', G, y, { taille: 8, police: gras, couleur: GRIS });
  ecrire('QTÉ', colQ, y, { taille: 8, police: gras, couleur: GRIS, droite: true });
  ecrire('PRIX UNIT. TTC', colPU, y, { taille: 8, police: gras, couleur: GRIS, droite: true });
  ecrire('TOTAL TTC', colT, y, { taille: 8, police: gras, couleur: GRIS, droite: true });
  y -= 7;
  page.drawLine({ start: { x: G, y }, end: { x: D, y }, thickness: 1, color: TRAIT });
  y -= 15;
  for (const l of f.lignes) {
    const lignesNom = couper(l.designation, 300);
    ecrire(l.qte, colQ, y, { droite: true });
    ecrire(euros(l.pu), colPU, y, { droite: true });
    ecrire(euros(l.qte * l.pu), colT, y, { droite: true });
    lignesNom.forEach((t, i) => ecrire(t, G, y - i * 12, { taille: 9.5 }));
    y -= 12 * Math.max(1, lignesNom.length) + 6;
    page.drawLine({ start: { x: G, y: y + 8 }, end: { x: D, y: y + 8 }, thickness: 0.5, color: TRAIT });
    if (y < 200) break;
  }

  /* --- Totaux --- */
  y -= 10;
  const totaux = [
    ['Total HT', euros(f.ht), false],
    [`TVA ${Math.round(ENTREPRISE.tauxTva * 100)} %`, euros(f.tva), false],
    ['TOTAL TTC', euros(f.ttc), true],
    ['Déjà réglé (carte bancaire)', euros(f.ttc), false],
    ['Reste à payer', euros(0), true],
  ];
  for (const [libelle, valeur, fort] of totaux) {
    if (libelle === 'TOTAL TTC') { page.drawLine({ start: { x: 340, y: y + 11 }, end: { x: D, y: y + 11 }, thickness: 1.2, color: ENCRE }); }
    ecrire(libelle, 340, y, { taille: fort ? 11 : 10, police: fort ? gras : reg });
    ecrire(valeur, D, y, { taille: fort ? 11 : 10, police: fort ? gras : reg, droite: true });
    y -= fort ? 18 : 15;
  }

  /* --- Pied --- */
  let yf = 92;
  page.drawLine({ start: { x: G, y: yf + 14 }, end: { x: D, y: yf + 14 }, thickness: 0.5, color: TRAIT });
  for (const l of [
    `Prix TTC, TVA ${Math.round(ENTREPRISE.tauxTva * 100)} % incluse. Facture acquittée. Pas d'escompte pour paiement anticipé.`,
    'Garantie légale de conformité (art. L217-3 et suivants du Code de la consommation).',
    `Merci pour votre confiance ! ${ENTREPRISE.nom} — ${ENTREPRISE.telephone} — ${ENTREPRISE.site}`,
  ]) { ecrire(l, G, yf, { taille: 8, couleur: GRIS }); yf -= 11; }

  return Buffer.from(await doc.save());
}

module.exports = { genererFacturePdf };
