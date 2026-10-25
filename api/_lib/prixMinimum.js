/* ============================================================
   Prix plancher : on ne vend jamais sous le coût d'achat Mobilax TTC.
   Utilisé à l'enregistrement d'un prix manuel (api/reglages.js) et
   au paiement (api/stripe-checkout.js), pour les anciens prix déjà saisis.
   ============================================================ */

const TVA = 1.20;

/* Coût d'achat Mobilax toutes taxes comprises, arrondi au centime supérieur */
function prixMinimum(achatHT) {
  const a = Number(achatHT);
  return Number.isFinite(a) && a > 0 ? Math.ceil(a * TVA * 100) / 100 : 0;
}

module.exports = { prixMinimum };
