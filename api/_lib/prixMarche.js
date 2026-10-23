/* ============================================================
   Prix « marché » d'une boutique de téléphonie de quartier (Toulouse)
   Repères relevés en octobre 2026 : chargeur 20 W générique 13-20 € en
   ligne (19-50 € chez Apple/Samsung), verre trempé 5-13 € en ligne mais
   15-25 € posé en boutique, batterie 10 000 mAh 25-50 €, chargeur sans
   fil 20-40 €, chargeur GaN multi-ports 30-60 €.

   Principe : on reconnaît le type de produit à son nom, chaque type a une
   fourchette de prix réaliste ; à l'intérieur, le prix suit le coût d'achat
   (un produit de marque coûte plus cher qu'un générique). Prix arrondis
   « comme en boutique ». Garde-fou : jamais sous l'achat + 20 % TTC.
   ============================================================ */

const TVA = 1.20;
const MARGE_SECURITE = 0.20;

/* Ordre important : le premier type reconnu l'emporte.
   coef = multiplicateur du coût d'achat HT (avant TVA), min/max en € TTC. */
const TYPES = [
  /* --- Protection d'écran (pose offerte en boutique) --- */
  { nom: 'Verre trempé premium', cat: ['protection'], motif: /privacy|int[ée]gral|lumi[èe]re bleue|magn[ée]tique|auto.?r[ée]g[ée]n|applicateur|cam[ée]ra|lentille|vitre arri[èe]re|pack|\(x2\)/i, coef: 2.5, min: 15, max: 25 },
  { nom: 'Verre trempé',          cat: ['protection'], coef: 2.5, min: 10, max: 15 },

  /* --- Coques & housses --- */
  { nom: 'Coque premium', cat: ['coque'], motif: /magsafe|renforc|antichoc|360|portefeuille|housse|cuir|anneau|dux ducis|cordon|bandouli[èe]re|pack de 10/i, coef: 2.5, min: 15, max: 30 },
  { nom: 'Coque',         cat: ['coque'], coef: 2.5, min: 10, max: 20 },

  /* --- Charge --- */
  { nom: 'Batterie externe',      motif: /batterie externe|power ?bank/i, coef: 1.8, min: 25, max: 70 },
  { nom: 'Chargeur sans fil',     motif: /sans fil|induction|magsafe|qi2?\b|station de charge|socle/i, cat: ['chargeur', 'accessoire'], coef: 1.9, min: 20, max: 50 },
  { nom: 'Chargeur voiture',      motif: /voiture|allume.?cigare/i, cat: ['chargeur'], coef: 2.0, min: 15, max: 35 },
  { nom: 'Chargeur GaN / PC',     motif: /gan|65 ?w|100 ?w|140 ?w|macbook|pc portable|universel/i, cat: ['chargeur', 'pc'], coef: 1.8, min: 30, max: 69 },
  { nom: 'Chargeur secteur',      cat: ['chargeur'], coef: 2.0, min: 15, max: 40 },

  /* --- Câbles & adaptateurs --- */
  { nom: 'Câble',       cat: ['cable'], motif: /c[aâ]ble|cordon/i, coef: 2.3, min: 10, max: 25 },
  { nom: 'Adaptateur',  cat: ['cable'], coef: 2.2, min: 10, max: 25 },

  /* --- Audio --- */
  { nom: 'Écouteurs / casque Bluetooth', cat: ['audio'], motif: /bluetooth|sans fil|tws|anc|casque/i, coef: 1.7, min: 20, max: 90 },
  { nom: 'Écouteurs filaires & adaptateurs audio', cat: ['audio'], coef: 1.8, min: 10, max: 25 },

  /* --- Objets connectés & accessoires --- */
  { nom: 'Bracelet de montre', motif: /bracelet/i, cat: ['accessoire'], coef: 2.2, min: 12, max: 30 },
  { nom: 'Montre connectée', motif: /montre connect|smartwatch|watch/i, cat: ['accessoire'], coef: 1.6, min: 30, max: 149 },
  { nom: 'Support voiture & vélo', motif: /voiture|v[ée]lo|moto|trottinette|tableau de bord|grille/i, cat: ['accessoire'], coef: 2.5, min: 15, max: 35 },
  { nom: 'Support & accessoire', cat: ['accessoire'], coef: 2.5, min: 10, max: 45 },

  /* --- Petits accessoires informatiques --- */
  { nom: 'Stockage', motif: /carte m[ée]moire|micro ?sd|cl[ée] usb|flash drive|ssd externe|disque dur externe|bo[iî]tier/i, cat: ['pc'], coef: 1.9, min: 10, max: 60 },
  { nom: 'Souris & clavier', motif: /souris|clavier|tapis/i, cat: ['pc'], coef: 1.8, min: 12, max: 60 },
  { nom: 'Câble & hub informatique', motif: /c[aâ]ble|hub|adaptateur|rallonge|hdmi|displayport|rj45|wi-?fi|r[ée]seau|cl[ée] bluetooth/i, cat: ['pc'], coef: 2.0, min: 10, max: 45 },
];

/* Appareils : le marché, ce sont les prix neufs/occasion des grandes enseignes.
   Marge modérée, arrondi en …9 €, plancher bas pour rester crédible. */
const APPAREILS = {
  telephone: { nom: 'Téléphone', coef: 1.20, plancher: 59 },
  pc:        { nom: 'Tablette / PC / écran', coef: 1.20, plancher: 79 },
};
/* Catégories Mobilax des appareils du rayon PC (le reste du rayon = accessoires) */
const IDS_APPAREILS_PC = new Set([1997, 2136, 377, 2065, 405]);

/* Arrondi « boutique » : 10, 15, 20… jusqu'à 50 € ; 59, 69… 99 € ; puis 119, 129, 149… */
function arrondiBoutique(x) {
  if (x <= 50) return Math.max(5, Math.ceil(x / 5) * 5);
  if (x <= 99) return Math.min(99, Math.ceil((x + 1) / 10) * 10 - 1);
  return Math.ceil((x + 1) / 10) * 10 - 1;
}

/* Renvoie { prix, type } pour un produit Mobilax */
function prixMarche({ nom, categorie, achatHT, idCategorieMobilax }) {
  const plancherSecurite = Math.ceil(achatHT * (1 + MARGE_SECURITE) * TVA);
  let prix;
  let type;

  const appareil = categorie === 'telephone' || (categorie === 'pc' && IDS_APPAREILS_PC.has(idCategorieMobilax))
    ? APPAREILS[categorie] : null;

  if (appareil) {
    type = appareil.nom;
    prix = Math.max(appareil.plancher, arrondiBoutique(achatHT * appareil.coef * TVA));
  } else {
    const t = TYPES.find(t => (!t.cat || t.cat.includes(categorie)) && (!t.motif || t.motif.test(nom)))
      || { nom: 'Accessoire', coef: 2.0, min: 10, max: 45 };
    type = t.nom;
    const brut = arrondiBoutique(achatHT * t.coef * TVA);
    prix = Math.min(t.max, Math.max(t.min, brut));
  }

  /* Garde-fou : la fourchette « marché » ne doit jamais faire vendre à perte */
  if (prix < plancherSecurite) prix = arrondiBoutique(plancherSecurite);
  return { prix, type };
}

module.exports = { prixMarche, arrondiBoutique, TYPES };
