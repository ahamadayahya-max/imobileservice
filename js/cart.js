/* ============================================================
   i-Mobile Service — Gestion du panier
   localStorage, drawer, modal récapitulatif, calcul totaux
   ============================================================ */

/* Clé de stockage localStorage */
const CART_KEY = 'ims_cart';
/* Grille de livraison : source unique pour le panier, le récapitulatif,
   les emails, la page de confirmation et l'admin. seuil = offert dès X €. */
const LIVRAISON = {
  store:    { label: 'Retrait en boutique',         emoji: '🏪', prix: 0,    seuil: null, delai: 'Disponible le jour même' },
  /* Points relais réels La Poste via api/pickup-relais.js (toute la France).
     actif: false = mode masqué (Vinted : liste fictive) — à garder aligné sur api/_lib/livraison.js */
  pickup:   { label: 'Point Relais La Poste',       emoji: '📦', prix: 1.90, seuil: 40,   delai: 'Colissimo 2-3 jours ouvrés' },
  vinted:   { label: 'Vinted Locker',               emoji: '🔁', prix: 1.90, seuil: 40,   delai: 'Consigne automatique 24h/24 · 7j/7', actif: false },
  delivery: { label: 'Livraison à domicile',        emoji: '🚚', prix: 4.90, seuil: 50,   delai: 'Colissimo 2-3 jours ouvrés' },
};
const BOUTIQUE_ADRESSE  = '221 Route de Seysses, 31100 Toulouse';
const BOUTIQUE_HORAIRES = 'Mar-Ven 10h-19h / Sam 10h-18h';
window.LIVRAISON = LIVRAISON;

const prixPanier = n => n.toFixed(2).replace('.', ',') + '€';

/* ---------- Base de données Points Relais & Vinted Lockers -- */
const POINTS_RELAIS = [
  /* === VINTED LOCKER === */
  { id:'VL001', type:'vinted',  emoji:'🔁', nom:'Vinted Locker — i-Mobile Service',nom_court:'i-Mobile Service',      codePostal:'31100', ville:'Toulouse',             adresseComplete:'221 Route de Seysses, 31100 Toulouse',           distance:0,   distanceLabel:'0 km — en boutique', horaires:{'Mar–Ven':'10h00–19h00','Sam':'10h00–18h00','Lun & Dim':'Fermé'}, disponible:true, badge:'Notre boutique' },
  { id:'VL002', type:'vinted',  emoji:'🔁', nom:'Vinted Locker — Basso Cambo',     nom_court:'Basso Cambo',           codePostal:'31100', ville:'Toulouse',             adresseComplete:'Route d\'Espagne, 31100 Toulouse',               distance:3.2, distanceLabel:'3.2 km', horaires:{'Lun–Sam':'9h00–20h00','Dim':'10h00–19h00'},             disponible:true },
  { id:'VL003', type:'vinted',  emoji:'🔁', nom:'Vinted Locker — Leclerc Plaisance',nom_court:'Leclerc Plaisance',    codePostal:'31830', ville:'Plaisance-du-Touch',   adresseComplete:'2 Rue de la Poterie, 31830 Plaisance-du-Touch',  distance:5.8, distanceLabel:'5.8 km', horaires:{'Lun–Sam':'8h30–20h00','Dim':'9h00–13h00'},             disponible:true },
];

/* Point relais actuellement sélectionné */
let selectedRelais = null;

/* ---------- Utilitaires localStorage ----------------------- */
function getCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) || '[]');
  } catch { return []; }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

/* ---------- Calculs ---------------------------------------- */
function getCartSubtotal(cart) {
  return cart.reduce((sum, item) => sum + item.price * item.qty, 0);
}

function getShippingCost(subtotal, deliveryMode) {
  const regle = LIVRAISON[deliveryMode] || LIVRAISON.store;
  if (!regle.prix) return 0;
  return regle.seuil != null && subtotal >= regle.seuil ? 0 : regle.prix;
}

/* Texte court du prix de livraison : « Gratuit », « Offerte ✓ » ou « 1,90€ » */
function libelleFrais(deliveryMode, shipping) {
  const regle = LIVRAISON[deliveryMode] || LIVRAISON.store;
  if (!regle.prix) return 'Gratuit';
  return shipping === 0 ? 'Offerte ✓' : prixPanier(shipping);
}

/* Met à jour le prix affiché sur chaque option de livraison du panier */
function majPrixOptions(subtotal) {
  Object.entries(LIVRAISON).forEach(([mode, regle]) => {
    const el = document.getElementById('prix-livraison-' + mode);
    if (!el) return;
    const frais = getShippingCost(subtotal, mode);
    el.textContent = !regle.prix ? 'Gratuit' : (frais === 0 ? 'Offert' : '+' + prixPanier(frais));
    el.classList.toggle('free', frais === 0);
  });
}

function getCartTotal(cart, deliveryMode) {
  const subtotal = getCartSubtotal(cart);
  return subtotal + getShippingCost(subtotal, deliveryMode);
}

function getCartCount(cart) {
  return cart.reduce((sum, item) => sum + item.qty, 0);
}

/* ---------- Mettre à jour le badge panier ------------------ */
function updateBadge() {
  const cart = getCart();
  const count = getCartCount(cart);
  document.querySelectorAll('.cart-badge').forEach(badge => {
    badge.textContent = count > 99 ? '99+' : count;
    badge.classList.toggle('hidden', count === 0);
  });
}

/* ---------- Ajouter au panier ------------------------------ */
function addToCart(product) {
  const cart = getCart();
  /* Normaliser l'id en chaîne pour éviter les comparaisons int vs string */
  const pid = String(product.id);
  const idx = cart.findIndex(item => String(item.id) === pid);
  if (idx >= 0) {
    cart[idx].qty += 1;
  } else {
    cart.push({ ...product, id: pid, qty: 1 });
  }
  saveCart(cart);
  updateBadge();
  renderCartItems();
  showToast(`${product.name} ajouté au panier`, 'success');
}

/* ---------- Modifier quantité ------------------------------ */
function updateQty(id, delta) {
  const cart = getCart();
  const idx = cart.findIndex(item => String(item.id) === String(id));
  if (idx < 0) return;
  cart[idx].qty = Math.max(0, cart[idx].qty + delta);
  if (cart[idx].qty === 0) cart.splice(idx, 1);
  saveCart(cart);
  updateBadge();
  renderCartItems();
}

/* ---------- Supprimer un article --------------------------- */
function removeFromCart(id) {
  const cart = getCart().filter(item => String(item.id) !== String(id));
  saveCart(cart);
  updateBadge();
  renderCartItems();
}

/* ---------- Obtenir le mode de livraison sélectionné ------- */
function getDeliveryMode() {
  const checked = document.querySelector('.delivery-options input[name="delivery"]:checked');
  return checked ? checked.value : 'store';
}

/* ---------- Normaliser une chaîne pour la recherche -------- */
function normaliser(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/* ---------- Afficher / masquer les sections relais --------- */
function toggleRelaisSection(mode) {
  const sectionPickup = document.getElementById('pickup-relais-section');
  const sectionVinted = document.getElementById('vinted-relais-section');
  if (sectionPickup) sectionPickup.style.display = (mode === 'pickup') ? 'block' : 'none';
  if (sectionVinted) sectionVinted.style.display = (mode === 'vinted') ? 'block' : 'none';

  if (mode === 'pickup') {
    chercherRelais('pickup');
  } else if (mode === 'vinted') {
    chercherRelais('vinted');
  }
}

/* Point déjà choisi : on replie la liste sur ce seul point, pour que le panier
   (article, autres modes de réception, bouton Commander) reste visible */
function afficherRelaisChoisi(type) {
  const listEl = document.getElementById('relais-liste-' + type);
  const recherche = listEl && listEl.previousElementSibling;
  if (!listEl || !selectedRelais || selectedRelais.type !== type) return false;
  if (recherche && recherche.classList.contains('relais-search')) recherche.style.display = 'none';
  listEl.innerHTML = '<div class="relais-choisi-titre">✅ Point relais choisi :</div>'
    + buildRelaisCard(selectedRelais)
    + `<button type="button" class="relais-changer" onclick="changerRelais('${type}')">✏️ Modifier</button>`;
  return true;
}

function changerRelais(type) {
  const listEl = document.getElementById('relais-liste-' + type);
  const recherche = listEl && listEl.previousElementSibling;
  if (recherche && recherche.classList.contains('relais-search')) recherche.style.display = '';
  chercherRelais(type, true);
  const champ = document.getElementById('adresse-relais-' + type);
  if (champ) champ.focus();
}
window.changerRelais = changerRelais;

/* Points renvoyés par la dernière recherche serveur, par identifiant */
const relaisTrouves = new Map();

/* Horaires { 'Lun–Ven': '9h00-12h00' } → « Lun–Ven 9h00-12h00 / Sam … » */
function horairesEnTexte(horaires) {
  return Object.entries(horaires || {}).map(([j, h]) => j + ' ' + h).join(' / ');
}

function echapper(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------- Recherche Point Relais La Poste : toute la France (serveur) -- */
let rechercheEnCours = 0;
async function chercherRelaisServeur(listEl, saisie) {
  const numero = ++rechercheEnCours;
  if (saisie.length < 2) {
    listEl.innerHTML = '<div class="relais-msg">📮 Tapez votre code postal, votre ville ou votre adresse puis « Rechercher ».</div>';
    return;
  }
  listEl.innerHTML = '<div class="relais-loading">🔍 Recherche des points relais…</div>';
  try {
    const res = await fetch('/api/pickup-relais?q=' + encodeURIComponent(saisie));
    const json = await res.json().catch(() => ({}));
    /* Une recherche plus récente a été lancée entre-temps : on l'ignore */
    if (numero !== rechercheEnCours) return;
    if (!res.ok) throw new Error(json.message || 'Recherche indisponible');
    const relais = json.relais || [];
    if (!relais.length) {
      listEl.innerHTML = '<div class="relais-msg">Aucun point relais trouvé pour « ' + echapper(saisie) + ' ». Vérifiez le code postal ou essayez le nom de la ville.</div>';
      return;
    }
    relais.forEach(r => relaisTrouves.set(r.id, r));
    listEl.innerHTML = `<div class="relais-msg">Les ${relais.length} points les plus proches de <strong>${echapper(json.reference || saisie)}</strong> :</div>`
      + relais.map(buildRelaisCard).join('');
  } catch (err) {
    if (numero !== rechercheEnCours) return;
    listEl.innerHTML = '<div class="relais-msg">⚠️ ' + echapper(err.message) + '</div>';
  }
}

/* ---------- Recherche intelligente par adresse / CP / ville -- */
function chercherRelais(typeForce, forcerListe) {
  const type  = typeForce || (getDeliveryMode() === 'vinted' ? 'vinted' : 'pickup');
  const inputEl = document.getElementById('adresse-relais-' + type);
  const input   = inputEl ? inputEl.value.trim() : '';
  const listEl  = document.getElementById('relais-liste-' + type);
  if (!listEl) return;
  if (!forcerListe && afficherRelaisChoisi(type)) return;
  /* Liste complète : la zone de recherche doit être visible */
  const zoneRecherche = listEl.previousElementSibling;
  if (zoneRecherche && zoneRecherche.classList.contains('relais-search')) zoneRecherche.style.display = '';

  if (type === 'pickup') {
    chercherRelaisServeur(listEl, input);
    return;
  }

  listEl.innerHTML = '<div class="relais-loading">🔍 Recherche en cours…</div>';

  setTimeout(() => {
    const inputNorm    = normaliser(input);
    const isCodePostal = /^\d{5}$/.test(input);
    const isVille      = /^[a-zA-ZÀ-ÿ\s-]+$/.test(input) && input.length > 2;

    /* Filtrer par type puis par saisie */
    let resultats = POINTS_RELAIS.filter(p => p.type === type);

    if (input) {
      resultats = resultats.filter(p => {
        const adN = normaliser(p.adresseComplete);
        const vlN = normaliser(p.ville);
        if (isCodePostal) return p.codePostal === input || p.codePostal.startsWith(input.slice(0, 3));
        if (isVille)      return vlN.includes(inputNorm);
        return adN.includes(inputNorm) || vlN.includes(inputNorm) || p.codePostal.includes(input);
      });
    }

    /* Fallback : tout afficher */
    if (!resultats.length) {
      resultats = POINTS_RELAIS.filter(p => p.type === type);
      listEl.innerHTML = '<div class="relais-msg">Aucun résultat — voici tous les points disponibles :</div>';
    } else {
      listEl.innerHTML = '';
    }

    /* Trier par distance */
    resultats.sort((a, b) => a.distance - b.distance);

    listEl.innerHTML += resultats.map(buildRelaisCard).join('');
  }, 300);
}

/* ---------- Construire une carte point relais -------------- */
function buildRelaisCard(p) {
  const isSelected = selectedRelais && selectedRelais.id === p.id;
  const typeBadge  = p.type === 'vinted'
    ? '<span class="relais-type-badge vinted">🔁 Vinted Locker</span>'
    : `<span class="relais-categorie">📦 ${echapper(p.categorie || 'Point relais')}</span>`;
  const notresBadge = p.badge
    ? `<span class="relais-notre-badge">⭐ ${p.badge}</span>`
    : '';
  const horairesHTML = Object.entries(p.horaires || {})
    .map(([j, h]) => `<span>${echapper(j)} : ${echapper(h)}</span>`).join(' · ');
  const mapsUrl = 'https://maps.google.com/?q=' + encodeURIComponent(p.adresseComplete);

  return `
    <div class="relais-card${isSelected ? ' selected' : ''}" id="relais-card-${p.id}">
      <div class="relais-card-header">
        ${typeBadge}${notresBadge}
        <span class="relais-distance">📍 ${echapper(p.distanceLabel)}</span>
      </div>
      <div class="relais-nom">${p.emoji || '📦'} ${echapper(p.nom)}</div>
      <div class="relais-adresse">📮 ${echapper(p.adresseComplete)}</div>
      ${horairesHTML ? `<div class="relais-horaires">🕐 ${horairesHTML}</div>` : ''}
      <div class="relais-actions">
        <button type="button" class="btn-choisir${isSelected ? ' active' : ''}"
          onclick="selectionnerRelais('${p.id}')"
          ${!p.disponible ? 'disabled' : ''}>
          ${isSelected ? '✓ Sélectionné' : '✓ Choisir ce point relais'}
        </button>
        <a href="${mapsUrl}" target="_blank" rel="noopener" class="btn-maps">
          🗺️ Maps
        </a>
      </div>
    </div>`;
}

/* ---------- Sélectionner un point relais ------------------- */
function selectionnerRelais(id) {
  const relais = relaisTrouves.get(id) || POINTS_RELAIS.find(r => r.id === id);
  if (!relais) return;
  selectedRelais = { ...relais, horairesTexte: horairesEnTexte(relais.horaires) };

  /* Liste repliée sur le point choisi, puis on montre le bas du panier (bouton Commander) */
  afficherRelaisChoisi(relais.type);
  const footer = document.getElementById('cart-footer');
  if (footer) footer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  /* Mettre à jour le sous-label de l'option radio */
  const subLabel = document.getElementById(relais.type + '-sub-label');
  if (subLabel) subLabel.textContent = (relais.nom_court || relais.nom) + ' (' + relais.distanceLabel + ')';

  updateTotals();
  if (typeof showToast === 'function') showToast('✅ ' + relais.nom, 'success');
}

/* Alias backward-compat */
window.rechercherRelais  = () => chercherRelais();
window.choisirRelais     = selectionnerRelais;
window.selectionnerRelais = selectionnerRelais;
window.chercherRelais    = chercherRelais;

/* ---------- Afficher les articles du panier dans le drawer - */
function renderCartItems() {
  const cart = getCart();
  /* Cible #cart-items uniquement — la delivery-section voisine n'est pas écrasée */
  const itemsEl = document.getElementById('cart-items');
  const deliverySection = document.getElementById('delivery-section');
  const cartFooter = document.getElementById('cart-footer');
  if (!itemsEl) return;

  if (cart.length === 0) {
    itemsEl.innerHTML = `
      <div class="cart-empty">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
        </svg>
        <p>Votre panier est vide</p>
        <a href="boutique.html" class="btn btn-primary btn-sm" onclick="return voirBoutique()">Voir la boutique</a>
      </div>`;
    if (deliverySection) deliverySection.style.display = 'none';
    if (cartFooter) cartFooter.style.display = 'none';
    return;
  }

  if (deliverySection) deliverySection.style.display = '';
  if (cartFooter) cartFooter.style.display = '';

  itemsEl.innerHTML = cart.map(item => `
    <div class="cart-item" data-id="${item.id}">
      <div class="cart-item-thumb">${item.emoji}</div>
      <div class="cart-item-main">
        <div class="cart-item-top">
          <div class="cart-item-name">${item.name}</div>
          <button class="cart-item-remove" onclick="removeFromCart('${item.id}')" aria-label="Supprimer">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div class="cart-item-bottom">
          <span class="cart-item-unit-price">${item.price.toFixed(2).replace('.', ',')}€/u</span>
          <div class="cart-item-qty-row">
            <button class="qty-btn" onclick="updateQty('${item.id}', -1)" aria-label="Diminuer">−</button>
            <span class="qty-display">${item.qty}</span>
            <button class="qty-btn" onclick="updateQty('${item.id}', 1)" aria-label="Augmenter">+</button>
          </div>
          <span class="cart-item-price">${(item.price * item.qty).toFixed(2).replace('.', ',')}€</span>
        </div>
      </div>
    </div>
  `).join('');

  updateTotals();
}


/* ---------- Mettre à jour les totaux dans le drawer -------- */
function updateTotals() {
  const cart = getCart();
  const deliveryMode = getDeliveryMode();
  const subtotal = getCartSubtotal(cart);
  const shipping = getShippingCost(subtotal, deliveryMode);
  const total = subtotal + shipping;

  const subtotalEl = document.getElementById('cart-subtotal');
  const shippingEl = document.getElementById('cart-shipping');
  const totalEl = document.getElementById('cart-total');

  if (subtotalEl) subtotalEl.textContent = prixPanier(subtotal);
  if (shippingEl) shippingEl.textContent = libelleFrais(deliveryMode, shipping);
  if (totalEl) totalEl.textContent = prixPanier(total);
  majPrixOptions(subtotal);

  /* Incitation : combien il manque pour la livraison offerte */
  const hintEl = document.getElementById('cart-shipping-hint');
  if (hintEl) {
    const regle = LIVRAISON[deliveryMode] || LIVRAISON.store;
    if (!regle.prix || regle.seuil == null) {
      hintEl.textContent = '';
    } else if (subtotal >= regle.seuil) {
      hintEl.textContent = '🎉 Livraison offerte !';
    } else {
      hintEl.textContent = `Plus que ${prixPanier(regle.seuil - subtotal)} pour la livraison offerte`;
    }
    hintEl.style.display = hintEl.textContent ? '' : 'none';
  }
}

/* ---------- Ouvrir / fermer le drawer ---------------------- */
window.openCart = function () {
  const overlay = document.getElementById('cart-overlay');
  const drawer = document.getElementById('cart-drawer');
  renderCartItems();
  overlay && overlay.classList.add('open');
  drawer && drawer.classList.add('open');
  document.body.style.overflow = 'hidden';
};

window.closeCart = function () {
  const overlay = document.getElementById('cart-overlay');
  const drawer = document.getElementById('cart-drawer');
  overlay && overlay.classList.remove('open');
  drawer && drawer.classList.remove('open');
  document.body.style.overflow = '';
};

/* Bouton « Voir la boutique » du panier vide : sur la boutique on ferme le
   panier et on remonte aux produits ; ailleurs le lien ouvre boutique.html */
window.voirBoutique = function () {
  const grille = document.getElementById("products-grid");
  if (!grille) return true;
  closeCart();
  grille.scrollIntoView({ behavior: "smooth", block: "start" });
  return false;
};

/* ---------- Modal récapitulatif commande ------------------- */
/* ---------- Vérification stock Mobilax avant commande ------ */
/* Le catalogue affiché peut dater de 10 min (cache) : on revérifie le stock
   fournisseur en temps réel et on ajuste le panier si un article est épuisé.
   Retourne true si la commande peut continuer. */
async function verifierStockPanier() {
  const cart = getCart();
  const items = cart
    .filter(item => Number(item.id) > 1000000)
    .map(item => ({ id: Number(item.id), qty: item.qty }));
  if (!items.length) return true;

  let resultat;
  try {
    const res = await fetch('/api/mobilax?action=check-stock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    resultat = await res.json();
  } catch (err) {
    /* Vérification impossible : on laisse passer, la boutique confirme
       chaque commande manuellement avant de commander chez Mobilax */
    console.warn('[panier] vérification stock indisponible :', err.message);
    return true;
  }

  const problemes = (resultat.items || []).filter(it => !it.ok);
  if (!problemes.length) return true;

  const noms = [];
  problemes.forEach(p => {
    const idx = cart.findIndex(item => Number(item.id) === p.id);
    if (idx < 0) return;
    noms.push(cart[idx].name);
    if (p.disponible > 0) cart[idx].qty = p.disponible;
    else cart.splice(idx, 1);
  });
  saveCart(cart);
  updateBadge();
  renderCartItems();

  showToast(
    'Stock modifié chez notre fournisseur, votre panier a été ajusté : ' + noms.join(', '),
    'error',
    'Stock insuffisant'
  );
  return false;
}

async function openOrderModal() {
  const cart = getCart();
  if (cart.length === 0) {
    showToast('Votre panier est vide', 'error');
    return;
  }

  /* Le formulaire de commande (et la sélection point relais) n'existe que sur
     la boutique : depuis une autre page, on y renvoie avec le panier ouvert */
  if (!document.getElementById('modal-overlay')) {
    location.href = 'boutique.html?panier=1';
    return;
  }

  const checkoutBtn = document.getElementById('cart-checkout-btn');
  if (checkoutBtn) checkoutBtn.disabled = true;
  const stockOk = await verifierStockPanier();
  if (checkoutBtn) checkoutBtn.disabled = false;
  if (!stockOk) return;
  /* Vérifier qu'un point relais est sélectionné si pickup */
  const mode = getDeliveryMode();
  if ((mode === 'pickup' || mode === 'vinted') && !selectedRelais) {
    showToast('⚠️ Veuillez choisir un ' + (mode === 'vinted' ? 'Vinted Locker' : 'point relais'), 'error');
    const sectionId = mode === 'vinted' ? 'vinted-relais-section' : 'pickup-relais-section';
    const section = document.getElementById(sectionId);
    if (section) section.style.display = 'block';
    chercherRelais(mode);
    document.getElementById('adresse-relais-' + mode)?.focus();
    return;
  }

  const deliveryMode = getDeliveryMode();
  const subtotal = getCartSubtotal(cart);
  const shipping = getShippingCost(subtotal, deliveryMode);
  const total = subtotal + shipping;

  /* Remplir la liste des articles dans la modal */
  const itemsContainer = document.getElementById('modal-order-items');
  if (itemsContainer) {
    itemsContainer.innerHTML = cart.map(item => `
      <div class="modal-order-item">
        <span class="modal-item-name">${item.emoji} ${item.name}</span>
        <span class="modal-item-qty">×${item.qty}</span>
        <span class="modal-item-price">${(item.price * item.qty).toFixed(2).replace('.', ',')}€</span>
      </div>
    `).join('');
  }

  /* Mode de livraison résumé */
  const regleMode = LIVRAISON[deliveryMode] || LIVRAISON.store;
  const deliveryLabel = `${regleMode.emoji} ${regleMode.label} — ${regleMode.delai}`;
  const deliveryResume = document.getElementById('modal-delivery-resume');
  if (deliveryResume) deliveryResume.textContent = deliveryLabel;

  /* Totaux modal */
  const modalSubtotal = document.getElementById('modal-subtotal');
  const modalShipping = document.getElementById('modal-shipping-cost');
  const modalTotal = document.getElementById('modal-grand-total');
  if (modalSubtotal) modalSubtotal.textContent = subtotal.toFixed(2).replace('.', ',') + '€';
  if (modalShipping) {
    modalShipping.textContent = libelleFrais(deliveryMode, shipping);
  }
  if (modalTotal) modalTotal.textContent = total.toFixed(2).replace('.', ',') + '€';

  adapterFormulaire(deliveryMode);

  closeCart();
  const overlay = document.getElementById('modal-overlay');
  overlay && overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeOrderModal() {
  const overlay = document.getElementById('modal-overlay');
  overlay && overlay.classList.remove('open');
  document.body.style.overflow = '';
}

/* ---- Configuration EmailJS (renseigner EMAILJS_TEMPLATE quand créé) ---- */
const EMAILJS_SERVICE  = 'service_sgvqdst';
const EMAILJS_KEY      = 'BHp_rzqQOf4Ogh91G';
const EMAILJS_TEMPLATE = 'template_01plkrv';

/* ---------- Génère un numéro de commande unique ---- */
function genOrderNumber() {
  return 'IMS-' + Math.random().toString(36).slice(2, 7).toUpperCase();
}

/* ---------- Paiement par carte (Stripe Checkout) ---------- */
/* Le navigateur n'envoie que les identifiants et quantités : le serveur
   recalcule prix et frais de livraison (api/stripe-checkout.js). */
async function payerStripe() {
  const form = document.getElementById('order-form');
  if (!validateOrderForm(form)) return;

  const btn = document.getElementById('btn-stripe');
  const texte = btn.textContent;
  btn.disabled = true;
  btn.textContent = '⏳ Vérification du stock…';

  const stockOk = await verifierStockPanier();
  if (!stockOk) {
    btn.disabled = false; btn.textContent = texte;
    closeOrderModal(); openCart();
    return;
  }

  const cart = getCart();
  const mode = getDeliveryMode();
  const { client, adresseLivraison } = lireCoordonnees(mode);
  const relais = (mode === 'pickup' || mode === 'vinted') ? selectedRelais : null;

  btn.textContent = '⏳ Redirection vers le paiement…';
  try {
    const res = await fetch('/api/stripe-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        articles: cart.map(item => ({ id: Number(item.id), qty: item.qty })),
        livraison: { mode, adresse: texteReception(mode, adresseLivraison), adresseLivraison, relais },
        client,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.url) throw new Error(json.message || 'Paiement indisponible');

    /* Le panier n'est vidé qu'au retour d'un paiement réussi (success.html) */
    sessionStorage.setItem('ims_paiement_en_cours', JSON.stringify({ commande: json.commande, total: json.total }));
    window.location.href = json.url;
  } catch (err) {
    btn.disabled = false; btn.textContent = texte;
    showToast(err.message + ' — vous pouvez aussi choisir « Payer en boutique ».', 'error', 'Paiement par carte');
  }
}

/* ---------- Valider et confirmer la commande ---------- */
async function confirmStorePickup() {
  if (getDeliveryMode() !== 'store') {
    showToast('Pour un envoi par colis, le paiement se fait par carte.', 'error');
    return;
  }
  const form = document.getElementById('order-form');
  if (!validateOrderForm(form)) return;

  /* Seconde vérification : le client a pu rester longtemps sur le formulaire */
  const storePayBtn = document.getElementById('btn-pay-store');
  if (storePayBtn) storePayBtn.disabled = true;
  const stockOk = await verifierStockPanier();
  if (storePayBtn) storePayBtn.disabled = false;
  if (!stockOk) {
    closeOrderModal();
    openCart();
    return;
  }

  const cart     = getCart();
  const mode     = getDeliveryMode();
  const subtotal = getCartSubtotal(cart);
  const shipping = getShippingCost(subtotal, mode);
  const total    = subtotal + shipping;

  /* Données client */
  const { client, adresseLivraison } = lireCoordonnees(mode);
  const { email, phone } = client;
  const nomClient = [client.civilite, client.nom].filter(Boolean).join(' ');
  const orderNum  = genOrderNumber();
  const orderDate = new Date().toLocaleString('fr-FR');

  /* Label livraison : adresse complète, point relais (horaires compris) ou boutique */
  const modeLabel = texteReception(mode, adresseLivraison);

  /* Articles en texte */
  const articlesTexte = cart.map(i =>
    `• ${i.name} ×${i.qty} = ${(i.price * i.qty).toFixed(2).replace('.', ',')}€`
  ).join('\n');

  /* Sauvegarder dans localStorage */
  const commandes = JSON.parse(localStorage.getItem('ims_commandes') || '[]');
  commandes.unshift({
    id: orderNum, date: orderDate,
    client,
    articles: cart,
    livraison: {
      mode, adresse: modeLabel, adresseLivraison,
      relais: ((mode === 'pickup' || mode === 'vinted') && selectedRelais) ? selectedRelais : null
    },
    soustotal: subtotal.toFixed(2),
    frais: shipping.toFixed(2),
    total: total.toFixed(2),
    statut: 'en_attente'
  });
  localStorage.setItem('ims_commandes', JSON.stringify(commandes));

  /* Enregistrement côté serveur : la commande apparaît dans l'admin même si
     l'email n'arrive pas. keepalive : l'envoi aboutit même si le client quitte la page. */
  fetch('/api/dossiers?type=commande', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(commandes[0]),
    keepalive: true,
  }).catch(err => console.warn('[commande] enregistrement serveur impossible :', err.message));

  /* Corps email */
  const corpsMail =
`NOUVELLE COMMANDE — i-Mobile Service
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
N° ${orderNum}  |  ${orderDate}

CLIENT
Nom    : ${nomClient}
Email  : ${email}
Tél    : ${phone}

ARTICLES
${articlesTexte}

LIVRAISON : ${modeLabel}

Sous-total : ${subtotal.toFixed(2).replace('.', ',')}€
Livraison  : ${shipping === 0 ? 'Gratuit' : shipping.toFixed(2).replace('.', ',') + '€'}
TOTAL      : ${total.toFixed(2).replace('.', ',')}€
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
i-Mobile Service · 05 31 21 71 38
221 Route de Seysses · 31100 Toulouse`;

  const templateParams = {
    to_email:         email,  /* destinataire dynamique */
    order_number:     orderNum,
    order_date:       orderDate,
    customer_name:    nomClient,
    customer_email:   email,
    customer_phone:   phone,
    order_items:      articlesTexte + '\n\nPaiement : à régler auprès de la boutique (non payé en ligne)\nContact : 05 31 21 71 38 / ims.tlse@gmail.com',
    delivery_mode:    modeLabel,
    subtotal:         subtotal.toFixed(2).replace('.', ',') + '€',
    shipping:         shipping === 0 ? 'Gratuit' : shipping.toFixed(2).replace('.', ',') + '€',
    total:            total.toFixed(2).replace('.', ',') + '€',
    reply_to:         email,
  };

  /* Fermer modal + vider panier EN PREMIER (avant tout envoi) */
  closeOrderModal();
  saveCart([]);
  updateBadge();
  renderCartItems();

  /* Afficher l'écran de confirmation */
  afficherConfirmation(orderNum, nomClient, total, orderDate, email, corpsMail, templateParams);
}

/* ---------- Fermer l'écran de confirmation ---------- */
function fermerConfirmation(overlay) {
  overlay.remove();
  document.body.style.overflow = '';
}

/* ---------- Écran de confirmation commande ---------- */
function afficherConfirmation(orderNum, nomClient, total, date, email, corpsMail, templateParams) {
  /* Supprimer un éventuel overlay existant */
  const old = document.getElementById('order-confirm-overlay');
  if (old) old.remove();

  /* Lien mailto de secours (toujours disponible) */
  const sujet  = encodeURIComponent(`Commande ${orderNum} — i-Mobile Service`);
  const corps  = encodeURIComponent(corpsMail || '');
  const mailtoHref = `mailto:ims.tlse@gmail.com?subject=${sujet}&body=${corps}`;

  const overlay = document.createElement('div');
  overlay.id = 'order-confirm-overlay';
  overlay.innerHTML = `
    <div class="order-confirm-box">
      <div class="order-confirm-icon">✅</div>
      <h2>Commande confirmée !</h2>
      <p>Merci <strong>${nomClient}</strong>, votre commande a bien été enregistrée.</p>
      <div class="order-confirm-num">${orderNum}</div>
      <div class="order-confirm-detail">
        <div><span>Total</span><span><strong>${typeof total === 'number' ? total.toFixed(2).replace('.', ',') : total}€</strong></span></div>
        <div><span>Date</span><span>${date}</span></div>
      </div>
      <p class="order-confirm-note" id="confirm-note">
        Nous vous contacterons pour finaliser votre commande.
      </p>
      <a href="bon-commande.html?id=${encodeURIComponent(orderNum)}" target="_blank" rel="noopener" class="order-confirm-mailto">
        📄 Télécharger mon bon de commande
      </a>
      <a href="${mailtoHref}" id="order-confirm-mail-btn" class="order-confirm-mailto">
        📧 Envoyer la confirmation par email
      </a>
      <button id="order-confirm-close-btn" class="order-confirm-btn">
        Continuer mes achats
      </button>
    </div>`;
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  /* Fermer en cliquant à l'extérieur de la box */
  overlay.addEventListener('click', e => {
    if (e.target === overlay) fermerConfirmation(overlay);
  });

  /* Fermer via le bouton */
  document.getElementById('order-confirm-close-btn').addEventListener('click', () => {
    fermerConfirmation(overlay);
  });

  /* Essayer l'envoi EmailJS si le template est configuré */
  if (EMAILJS_TEMPLATE && typeof emailjs !== 'undefined' && templateParams) {
    const opts = { publicKey: EMAILJS_KEY };

    /* --- Email au gérant (toujours envoyé en premier) --- */
    const paramsGerant = { ...templateParams, to_email: 'ims.tlse@gmail.com' };
    emailjs.send(EMAILJS_SERVICE, EMAILJS_TEMPLATE, paramsGerant, opts)
      .then(() => {
        if (typeof showToast === 'function') showToast('Nouvelle commande reçue par email ✅', 'success');
      })
      .catch(err => {
        console.error('EmailJS gérant:', JSON.stringify(err));
      });

    /* --- Email au client (seulement si son email est renseigné) --- */
    const emailClient = templateParams.to_email || '';
    if (emailClient) {
      emailjs.send(EMAILJS_SERVICE, EMAILJS_TEMPLATE, templateParams, opts)
        .then(() => {
          const note = document.getElementById('confirm-note');
          if (note) note.textContent = '📧 Un email de confirmation vous a été envoyé.';
          const mailBtn = document.getElementById('order-confirm-mail-btn');
          if (mailBtn) mailBtn.style.display = 'none';
        })
        .catch(err => {
          console.error('EmailJS client:', JSON.stringify(err));
        });
    }
  }
}

/* ---------- Formulaire adapté au mode de réception --------- */
/* Boutique : prénom/nom/email/tél + adresse rappelée.
   Domicile : civilité + adresse complète. Point relais : civilité + rappel du point. */
function adapterFormulaire(mode) {
  const afficher = (id, oui) => { const el = document.getElementById(id); if (el) el.style.display = oui ? '' : 'none'; };
  afficher('modal-store-info', mode === 'store');
  afficher('modal-address-fields', mode === 'delivery');
  afficher('groupe-civilite', mode !== 'store');
  /* Payer en boutique : seulement si le client vient chercher sa commande ;
     un colis expédié est toujours payé en ligne avant l'envoi */
  afficher('btn-pay-store', mode === 'store');
  afficher('info-paiement-boutique', mode === 'store');

  /* Champs d'adresse obligatoires seulement en livraison à domicile */
  ['order-address', 'order-postal', 'order-city'].forEach(id => {
    const champ = document.getElementById(id);
    if (champ) champ.required = mode === 'delivery';
  });

  const infoRelais = document.getElementById('modal-relais-info');
  if (infoRelais) {
    const r = mode === 'pickup' ? selectedRelais : null;
    infoRelais.style.display = r ? '' : 'none';
    infoRelais.innerHTML = r
      ? `✅ <strong>Point relais choisi :</strong> ${echapper(r.nom)}`
        + `<button type="button" class="relais-modifier" onclick="modifierRelaisDepuisCommande()">Modifier</button><br>`
        + `📮 ${echapper(r.adresseComplete)}`
        + (r.horairesTexte ? `<br>🕐 ${echapper(r.horairesTexte)}` : '')
      : '';
  }
  const titre = document.getElementById('titre-coordonnees');
  if (titre) titre.textContent = mode === 'delivery' ? 'Vos coordonnées et adresse de livraison' : 'Vos coordonnées';
}

/* Retour au panier pour changer de point relais sans perdre la saisie */
function modifierRelaisDepuisCommande() {
  closeOrderModal();
  openCart();
  changerRelais('pickup');
}
window.modifierRelaisDepuisCommande = modifierRelaisDepuisCommande;

/* Mêmes règles que le serveur (api/_lib/clientCommande.js) */
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const RE_TEL   = /^(?:\+33|0033|0)[1-9]\d{8}$/;
const RE_CP    = /^\d{5}$/;

function valeur(id) { return (document.getElementById(id)?.value || '').trim(); }

/* Coordonnées saisies, au format attendu par le serveur */
function lireCoordonnees(mode) {
  const civ = document.querySelector('input[name="order-civilite"]:checked');
  const prenom = valeur('order-firstname');
  const nomFamille = valeur('order-lastname');
  const civilite = mode === 'store' ? '' : (civ ? civ.value : '');
  return {
    client: {
      civilite, prenom, nomFamille,
      nom: `${prenom} ${nomFamille}`.trim(),
      email: valeur('order-email'),
      phone: valeur('order-phone'),
    },
    adresseLivraison: mode === 'delivery' ? {
      ligne1: valeur('order-address'), complement: valeur('order-address2'),
      codePostal: valeur('order-postal'), ville: valeur('order-city'),
    } : null,
  };
}

/* Texte de réception pour l'email, la commande et l'admin */
function texteReception(mode, adresseLivraison) {
  if (mode === 'store') return 'Retrait en boutique — ' + BOUTIQUE_ADRESSE + ' (' + BOUTIQUE_HORAIRES + ')';
  if (mode === 'pickup' && selectedRelais) {
    return 'Point Relais La Poste — ' + selectedRelais.nom + '\nAdresse : ' + selectedRelais.adresseComplete
      + (selectedRelais.horairesTexte ? '\nHoraires : ' + selectedRelais.horairesTexte : '');
  }
  if (mode === 'vinted' && selectedRelais) return 'Vinted Locker — ' + selectedRelais.nom + '\nAdresse : ' + selectedRelais.adresseComplete;
  if (mode === 'delivery' && adresseLivraison) {
    const a = adresseLivraison;
    return 'Livraison à domicile (' + LIVRAISON.delivery.delai + ') — '
      + [a.ligne1, a.complement, a.codePostal + ' ' + a.ville].filter(Boolean).join(', ');
  }
  return (LIVRAISON[mode] || LIVRAISON.store).label;
}

/* ---------- Validation du formulaire commande -------------- */
/* Message d'erreur sous chaque champ ; la saisie est conservée */
function validateOrderForm(form) {
  const mode = getDeliveryMode();
  let premierChampFaux = null;

  const verifier = (id, ok, message) => {
    const champ = document.getElementById(id);
    if (!champ) return;
    const erreur = champ.parentElement.querySelector('.form-error');
    champ.classList.toggle('error', !ok);
    champ.setAttribute('aria-invalid', ok ? 'false' : 'true');
    if (erreur) {
      if (message) erreur.textContent = message;
      erreur.classList.toggle('visible', !ok);
    }
    if (!ok && !premierChampFaux) premierChampFaux = champ;
  };

  if (mode !== 'store') {
    const civOk = !!document.querySelector('input[name="order-civilite"]:checked');
    document.querySelector('.civilite-choix')?.classList.toggle('error', !civOk);
    document.querySelector('[data-pour="civilite"]')?.classList.toggle('visible', !civOk);
    if (!civOk && !premierChampFaux) premierChampFaux = document.querySelector('input[name="order-civilite"]');
  }

  verifier('order-firstname', !!valeur('order-firstname'), 'Prénom obligatoire');
  verifier('order-lastname', !!valeur('order-lastname'), 'Nom obligatoire');
  const email = valeur('order-email');
  verifier('order-email', RE_EMAIL.test(email), email ? 'Adresse email invalide (ex : jean.dupont@email.com)' : 'Email obligatoire');
  const tel = valeur('order-phone');
  verifier('order-phone', RE_TEL.test(tel.replace(/[\s.-]/g, '')), tel ? 'Numéro invalide (ex : 06 12 34 56 78)' : 'Téléphone obligatoire');

  if (mode === 'delivery') {
    verifier('order-address', !!valeur('order-address'), 'Adresse obligatoire');
    const cp = valeur('order-postal');
    verifier('order-postal', RE_CP.test(cp), cp ? 'Code postal : 5 chiffres' : 'Code postal obligatoire');
    verifier('order-city', !!valeur('order-city'), 'Ville obligatoire');
  } else {
    ['order-address', 'order-postal', 'order-city'].forEach(id => verifier(id, true));
  }

  if ((mode === 'pickup' || mode === 'vinted') && !selectedRelais) {
    showToast('⚠️ Choisissez d\'abord votre point relais', 'error');
    modifierRelaisDepuisCommande();
    return false;
  }

  if (premierChampFaux) {
    premierChampFaux.focus();
    premierChampFaux.scrollIntoView({ behavior: 'smooth', block: 'center' });
    showToast('Veuillez corriger les champs en rouge', 'error');
    return false;
  }
  return true;
}

/* ---------- Initialisation --------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  /* Initialiser EmailJS dès le chargement de la page */
  if (typeof emailjs !== 'undefined') {
    emailjs.init({ publicKey: EMAILJS_KEY });
  }

  updateBadge();

  /* Fermer le drawer en cliquant sur l'overlay */
  const cartOverlay = document.getElementById('cart-overlay');
  if (cartOverlay) {
    cartOverlay.addEventListener('click', (e) => {
      if (e.target === cartOverlay) closeCart();
    });
  }

  /* Fermer la modal en cliquant sur l'overlay */
  const modalOverlay = document.getElementById('modal-overlay');
  if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) closeOrderModal();
    });
  }

  /* Modes de réception désactivés : retirés de la page (option + liste de points) */
  Object.entries(LIVRAISON).filter(([, r]) => r.actif === false).forEach(([mode]) => {
    const radio = document.querySelector(`.delivery-options input[name="delivery"][value="${mode}"]`);
    if (radio) radio.closest('label')?.remove();
    document.getElementById(mode + '-relais-section')?.remove();
  });
  if (!document.querySelector('.delivery-options input[name="delivery"]:checked')) {
    const premier = document.querySelector('.delivery-options input[name="delivery"]');
    if (premier) premier.checked = true;
  }

  /* Synchroniser les totaux + afficher section relais */
  /* Le mode choisi suit le client d'une page à l'autre (fiche produit → boutique) */
  try {
    const modeMemorise = localStorage.getItem('ims_livraison');
    const radioMemorise = modeMemorise && LIVRAISON[modeMemorise] && LIVRAISON[modeMemorise].actif !== false
      && document.querySelector(`.delivery-options input[name="delivery"][value="${modeMemorise}"]`);
    if (radioMemorise) { radioMemorise.checked = true; updateTotals(); toggleRelaisSection(modeMemorise); }
  } catch { /* stockage indisponible : mode par défaut */ }

  document.querySelectorAll('.delivery-options input[name="delivery"]').forEach(radio => {
    radio.addEventListener('change', () => {
      try { localStorage.setItem('ims_livraison', radio.value); } catch { /* sans effet */ }
      updateTotals();
      toggleRelaisSection(radio.value);
      /* Réinitialiser le relais si on change de mode */
      if (radio.value !== 'pickup' && radio.value !== 'vinted') {
        selectedRelais = null;
        const subPickup = document.getElementById('pickup-sub-label');
        const subVinted = document.getElementById('vinted-sub-label');
        if (subPickup) subPickup.textContent = 'Bureau de poste ou relais · offert dès 40 €';
        if (subVinted) subVinted.textContent = '1,90€ — Offert dès 40€ — 24h/24 7j/7';
      }
    });
  });

  /* Boutons d'ajout au panier */
  document.querySelectorAll('.add-to-cart-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const product = {
        id:    btn.dataset.id,
        name:  btn.dataset.name,
        price: parseFloat(btn.dataset.price),
        emoji: btn.dataset.emoji,
      };
      addToCart(product);

      /* Feedback visuel sur le bouton */
      btn.classList.add('added');
      const originalHTML = btn.innerHTML;
      btn.innerHTML = '✓ Ajouté';
      setTimeout(() => {
        btn.classList.remove('added');
        btn.innerHTML = originalHTML;
      }, 1500);
    });
  });

  /* Bouton ouverture drawer */
  document.querySelectorAll('.cart-btn').forEach(btn => {
    btn.addEventListener('click', openCart);
  });

  /* Bouton validation commande dans le drawer */
  const checkoutBtn = document.getElementById('cart-checkout-btn');
  if (checkoutBtn) checkoutBtn.addEventListener('click', openOrderModal);

  /* Bouton fermeture modal */
  const modalClose = document.getElementById('modal-close');
  if (modalClose) modalClose.addEventListener('click', closeOrderModal);

  /* Payer en boutique */
  const storePayBtn = document.getElementById('btn-pay-store');
  if (storePayBtn) storePayBtn.addEventListener('click', confirmStorePickup);

  /* Payer par carte (Stripe) */
  const stripeBtn = document.getElementById('btn-stripe');
  if (stripeBtn) stripeBtn.addEventListener('click', payerStripe);

  /* Fermer le drawer via bouton */
  const cartCloseBtn = document.getElementById('cart-close-btn');
  if (cartCloseBtn) cartCloseBtn.addEventListener('click', closeCart);

  /* Arrivée depuis une fiche produit via « Commander » : on rouvre le panier
     pour que le client choisisse son mode de réception avant de valider */
  if (new URLSearchParams(location.search).get('panier') === '1') {
    history.replaceState(null, '', location.pathname);
    openCart();
  }
});

/* Exposer les fonctions globalement */
window.openOrderModal = openOrderModal;
window.closeOrderModal = closeOrderModal;
window.updateTotals = updateTotals;
window.addToCart = addToCart;
