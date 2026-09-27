/* ============================================================
   i-Mobile Service — Informations légales de l'entreprise
   Source unique pour le bon de commande et les factures.
   ⚠️ À faire valider par le comptable : TVA et numéro intracom.
   ============================================================ */

const ENTREPRISE = {
  nom:       'i-Mobile Service',
  forme:     'SASU',
  adresse:   '221 Route de Seysses',
  cpVille:   '31100 Toulouse',
  telephone: '05 31 21 71 38',
  email:     'ims.tlse@gmail.com',
  siret:     '842 299 240 00015',
  /* RCS déduit du SIREN et du siège — à vérifier sur le Kbis */
  rcs:       'RCS Toulouse 842 299 240',
  /* Mention obligatoire pour une SASU ; laissée vide tant qu'elle n'est pas connue */
  capital:   '',

  /* true = TVA 20 % facturée ; false = franchise en base (art. 293 B du CGI) */
  tvaApplicable: true,
  tauxTva:       0.20,
  /* Numéro de TVA intracommunautaire (FR…), obligatoire si tvaApplicable */
  numeroTva:     '',
};

/* Les prix du site sont TTC : on en déduit HT et TVA au centime près */
function ventilerTTC(totalTTC) {
  const ttc = Math.round(totalTTC * 100) / 100;
  if (!ENTREPRISE.tvaApplicable) return { ht: ttc, tva: 0, ttc };
  const ht = Math.round((ttc / (1 + ENTREPRISE.tauxTva)) * 100) / 100;
  return { ht, tva: Math.round((ttc - ht) * 100) / 100, ttc };
}

function formatEuro(n) {
  return Number(n).toFixed(2).replace('.', ',') + ' €';
}

/* Échappe le texte saisi (noms clients, désignations) avant insertion HTML */
function echapperHTML(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* Bloc émetteur commun aux documents */
function blocEmetteurHTML() {
  const e = ENTREPRISE;
  return `
    <strong>${e.forme} ${e.nom}</strong><br>
    ${e.adresse}<br>${e.cpVille}<br>
    Tél. ${e.telephone} · ${e.email}<br>
    SIRET ${e.siret}${e.rcs ? ' · ' + e.rcs : ''}
    ${e.capital ? '<br>Capital social : ' + e.capital : ''}
    ${e.tvaApplicable && e.numeroTva ? '<br>TVA intracom. : ' + e.numeroTva : ''}`;
}

/* Mention TVA de pied de document */
function mentionTvaHTML() {
  return ENTREPRISE.tvaApplicable
    ? `Prix TTC, TVA ${Math.round(ENTREPRISE.tauxTva * 100)} % incluse.`
    : 'TVA non applicable, art. 293 B du CGI.';
}

window.ENTREPRISE = ENTREPRISE;
