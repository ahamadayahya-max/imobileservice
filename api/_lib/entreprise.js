/* ============================================================
   Informations légales — version serveur (factures PDF automatiques).
   DOIT rester identique à js/entreprise.js (factures et bons de commande
   générés dans le navigateur).
   ============================================================ */

const ENTREPRISE = {
  nom:       'i-Mobile Service',
  forme:     'SASU',
  adresse:   '221 Route de Seysses',
  cpVille:   '31100 Toulouse',
  telephone: '05 31 21 71 38',
  email:     'ims.tlse@gmail.com',
  site:      'imobileservice.fr',
  siret:     '842 299 240 00015',
  rcs:       'RCS Toulouse 842 299 240',
  capital:   '100 €',
  tvaApplicable: true,
  tauxTva:       0.20,
  numeroTva:     'FR08842299240',
};

/* Les prix sont TTC : on en déduit HT et TVA au centime près */
function ventilerTTC(totalTTC) {
  const ttc = Math.round(totalTTC * 100) / 100;
  if (!ENTREPRISE.tvaApplicable) return { ht: ttc, tva: 0, ttc };
  const ht = Math.round((ttc / (1 + ENTREPRISE.tauxTva)) * 100) / 100;
  return { ht, tva: Math.round((ttc - ht) * 100) / 100, ttc };
}

module.exports = { ENTREPRISE, ventilerTTC };
