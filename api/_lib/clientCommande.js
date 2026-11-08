/* ============================================================
   Validation serveur des coordonnées d'une commande — mêmes règles
   que le formulaire du panier (js/cart.js) : le navigateur peut être
   contourné, le serveur refuse donc lui aussi une commande incomplète.
   ============================================================ */

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/* Mobile ou fixe français : 0X XX XX XX XX ou +33 X XX XX XX XX */
const RE_TEL = /^(?:\+33|0033|0)[1-9]\d{8}$/;
const RE_CP = /^\d{5}$/;

const propre = v => String(v == null ? '' : v).trim();

/* Retourne { champ: message } ; objet vide = commande valide */
function erreursCommande(client, livraison) {
  const c = client && typeof client === 'object' ? client : {};
  const l = livraison && typeof livraison === 'object' ? livraison : {};
  const mode = l.mode || 'store';
  const err = {};

  if (mode !== 'store' && !['M.', 'Mme'].includes(c.civilite)) err.civilite = 'Civilité obligatoire';
  if (!propre(c.prenom)) err.prenom = 'Prénom obligatoire';
  if (!propre(c.nom)) err.nom = 'Nom obligatoire';
  if (!RE_EMAIL.test(propre(c.email))) err.email = 'Email invalide';
  if (!RE_TEL.test(propre(c.phone).replace(/[\s.-]/g, ''))) err.phone = 'Téléphone invalide';

  if (mode === 'delivery') {
    const a = l.adresseLivraison && typeof l.adresseLivraison === 'object' ? l.adresseLivraison : {};
    if (!propre(a.ligne1)) err.adresse = 'Adresse obligatoire';
    if (!RE_CP.test(propre(a.codePostal))) err.codePostal = 'Code postal à 5 chiffres';
    if (!propre(a.ville)) err.ville = 'Ville obligatoire';
  }
  if (mode === 'pickup' && !(l.relais && propre(l.relais.id) && propre(l.relais.nom))) {
    err.relais = 'Point relais à choisir';
  }
  return err;
}

/* Réception pour les emails : { mode: libellé court, details: une ligne « Libellé : valeur » par information } */
function texteLivraison(livraison) {
  const l = livraison || {};
  if (l.mode === 'delivery' && l.adresseLivraison) {
    const a = l.adresseLivraison;
    return {
      mode: 'Livraison à domicile (Colissimo 2-3 jours ouvrés)',
      details: ['Adresse : ' + a.ligne1, a.complement ? 'Complément : ' + a.complement : '', 'Code postal : ' + a.codePostal, 'Ville : ' + a.ville].filter(Boolean).join('\n'),
    };
  }
  if (l.mode === 'pickup' && l.relais) {
    return {
      mode: 'Point Relais La Poste',
      details: ['Point relais : ' + l.relais.nom, 'Adresse : ' + l.relais.adresse, l.relais.horaires ? 'Horaires : ' + l.relais.horaires : ''].filter(Boolean).join('\n'),
    };
  }
  if (l.mode === 'store' || !l.mode) {
    return { mode: 'Retrait en boutique', details: 'Adresse : 221 Route de Seysses, 31100 Toulouse\nHoraires : Mar-Ven 10h-19h / Sam 10h-18h' };
  }
  return { mode: l.adresse || '', details: '' };
}

module.exports = { erreursCommande, texteLivraison };
