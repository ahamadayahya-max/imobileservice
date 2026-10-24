/* ============================================================
   Grille de livraison côté serveur — DOIT rester identique à
   LIVRAISON dans js/cart.js (affichage du panier).
   Utilisée pour le paiement par carte : les frais sont recalculés ici.
   ============================================================ */

const LIVRAISON = {
  store:    { label: 'Retrait en boutique',         prix: 0,    seuil: null },
  pickup:   { label: 'Retrait Point Relais Pickup', prix: 1.90, seuil: 40 },
  vinted:   { label: 'Vinted Locker',               prix: 1.90, seuil: 40 },
  delivery: { label: 'Livraison à domicile',        prix: 4.90, seuil: 50 },
};

function fraisLivraison(sousTotal, mode) {
  const regle = LIVRAISON[mode] || LIVRAISON.store;
  if (!regle.prix) return 0;
  return regle.seuil != null && sousTotal >= regle.seuil ? 0 : regle.prix;
}

module.exports = { LIVRAISON, fraisLivraison };
