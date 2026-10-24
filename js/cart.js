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
  pickup:   { label: 'Retrait Point Relais Pickup', emoji: '📦', prix: 1.90, seuil: 40,   delai: '24-48h' },
  vinted:   { label: 'Vinted Locker',               emoji: '🔁', prix: 1.90, seuil: 40,   delai: 'Consigne automatique 24h/24 · 7j/7' },
  delivery: { label: 'Livraison à domicile',        emoji: '🚚', prix: 4.90, seuil: 50,   delai: 'Colissimo 2-3 jours ouvrés' },
};
const BOUTIQUE_ADRESSE  = '221 Route de Seysses, 31100 Toulouse';
const BOUTIQUE_HORAIRES = 'Mar-Ven 10h-19h / Sam 10h-18h';
window.LIVRAISON = LIVRAISON;

const prixPanier = n => n.toFixed(2).replace('.', ',') + '€';

/* ---------- Base de données Points Relais & Vinted Lockers -- */
const POINTS_RELAIS = [
  /* === PICKUP === */
  { id:'PK001', type:'pickup',  emoji:'🛒', nom:'Carrefour Market Seysses',        adresse:'Route de Seysses',        codePostal:'31600', ville:'Seysses',              adresseComplete:'Route de Seysses, 31600 Seysses',               distance:0.8, distanceLabel:'0.8 km', horaires:{'Lun–Sam':'8h00–20h00','Dim':'9h00–13h00'},              disponible:true },
  { id:'PK002', type:'pickup',  emoji:'🗞️', nom:'Tabac Presse Les Pradettes',      adresse:'15 Rue des Pradettes',    codePostal:'31100', ville:'Toulouse',             adresseComplete:'15 Rue des Pradettes, 31100 Toulouse',           distance:1.2, distanceLabel:'1.2 km', horaires:{'Lun–Sam':'7h00–20h00','Dim':'8h00–13h00'},              disponible:true },
  { id:'PK003', type:'pickup',  emoji:'👔', nom:'Pressing du Quartier',            adresse:'8 Allée des Glières',     codePostal:'31100', ville:'Toulouse',             adresseComplete:'8 Allée des Glières, 31100 Toulouse',            distance:0.3, distanceLabel:'0.3 km', horaires:{'Lun–Sam':'9h00–19h00','Dim':'Fermé'},                   disponible:true },
  { id:'PK004', type:'pickup',  emoji:'💊', nom:'Pharmacie des Glières',           adresse:'2 Place des Glières',     codePostal:'31100', ville:'Toulouse',             adresseComplete:'2 Place des Glières, 31100 Toulouse',            distance:0.4, distanceLabel:'0.4 km', horaires:{'Lun–Ven':'9h00–19h30','Sam':'9h00–18h00','Dim':'Fermé'}, disponible:true },
  { id:'PK005', type:'pickup',  emoji:'🛍️', nom:'Supérette Casino',               adresse:'45 Route de Seysses',     codePostal:'31100', ville:'Toulouse',             adresseComplete:'45 Route de Seysses, 31100 Toulouse',            distance:1.5, distanceLabel:'1.5 km', horaires:{'Lun–Dim':'7h00–22h00'},                                 disponible:true },
  { id:'PK006', type:'pickup',  emoji:'🥖', nom:'Boulangerie Paul',                adresse:'23 Avenue de Muret',      codePostal:'31100', ville:'Toulouse',             adresseComplete:'23 Avenue de Muret, 31100 Toulouse',             distance:2.1, distanceLabel:'2.1 km', horaires:{'Lun–Sam':'7h00–20h00','Dim':'7h00–14h00'},              disponible:true },
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

/* ---------- Recherche intelligente par adresse / CP / ville -- */
function chercherRelais(typeForce) {
  const type  = typeForce || (getDeliveryMode() === 'vinted' ? 'vinted' : 'pickup');
  const inputEl = document.getElementById('adresse-relais-' + type);
  const input   = inputEl ? inputEl.value.trim() : '';
  const listEl  = document.getElementById('relais-liste-' + type);
  if (!listEl) return;

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
    : '<span class="relais-type-badge pickup">📦 Pickup</span>';
  const notresBadge = p.badge
    ? `<span class="relais-notre-badge">⭐ ${p.badge}</span>`
    : '';
  const horairesHTML = Object.entries(p.horaires)
    .map(([j, h]) => `<span>${j} : ${h}</span>`).join(' · ');
  const mapsUrl = 'https://maps.google.com/?q=' + encodeURIComponent(p.adresseComplete);

  return `
    <div class="relais-card${isSelected ? ' selected' : ''}" id="relais-card-${p.id}">
      <div class="relais-card-header">
        ${typeBadge}${notresBadge}
        <span class="relais-distance">📍 ${p.distanceLabel}</span>
      </div>
      <div class="relais-nom">${p.emoji} ${p.nom}</div>
      <div class="relais-adresse">📮 ${p.adresseComplete}</div>
      <div class="relais-horaires">${horairesHTML}</div>
      <div class="relais-actions">
        <button class="btn-choisir${isSelected ? ' active' : ''}"
          onclick="selectionnerRelais('${p.id}')"
          ${!p.disponible ? 'disabled' : ''}>
          ${isSelected ? '✓ Sélectionné' : 'Choisir ce point'}
        </button>
        <a href="${mapsUrl}" target="_blank" rel="noopener" class="btn-maps">
          🗺️ Maps
        </a>
      </div>
    </div>`;
}

/* ---------- Sélectionner un point relais ------------------- */
function selectionnerRelais(id) {
  const relais = POINTS_RELAIS.find(r => r.id === id);
  if (!relais) return;
  selectedRelais = relais;

  /* Re-rendre la liste pour mettre à jour l'état visuels */
  chercherRelais(relais.type);

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
        <button class="btn btn-primary btn-sm" onclick="closeCart()">Voir la boutique</button>
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

  /* Afficher/masquer le champ adresse */
  const addressField = document.getElementById('address-field');
  if (addressField) {
    addressField.classList.toggle('visible', deliveryMode === 'delivery');
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

  /* Afficher/masquer les champs adresse dans la modal (livraison domicile uniquement) */
  const modalAddressFields = document.getElementById('modal-address-fields');
  if (modalAddressFields) {
    modalAddressFields.style.display = deliveryMode === 'delivery' ? '' : 'none';
  }

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
  const adresse = mode === 'delivery'
    ? ['order-address', 'order-postal', 'order-city'].map(id => (document.getElementById(id)?.value || '').trim()).join(' ').trim()
    : (selectedRelais ? `${selectedRelais.nom} — ${selectedRelais.adresseComplete}` : '');

  btn.textContent = '⏳ Redirection vers le paiement…';
  try {
    const res = await fetch('/api/stripe-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        articles: cart.map(item => ({ id: Number(item.id), qty: item.qty })),
        livraison: { mode, adresse, relais: selectedRelais },
        client: {
          nom: `${document.getElementById('order-firstname').value.trim()} ${document.getElementById('order-lastname').value.trim()}`,
          email: document.getElementById('order-email').value.trim(),
          phone: document.getElementById('order-phone').value.trim(),
        },
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
  const prenom = document.getElementById('order-firstname').value.trim();
  const nom    = document.getElementById('order-lastname').value.trim();
  const email  = document.getElementById('order-email').value.trim();
  const phone  = document.getElementById('order-phone').value.trim();
  const addr   = (document.getElementById('order-address')?.value || '').trim();
  const cp     = (document.getElementById('order-postal')?.value  || '').trim();
  const ville  = (document.getElementById('order-city')?.value    || '').trim();

  const nomClient = `${prenom} ${nom}`;
  const orderNum  = genOrderNumber();
  const orderDate = new Date().toLocaleString('fr-FR');

  /* Label livraison avec détails relais si sélectionné */
  let modeLabel;
  if (mode === 'store') {
    modeLabel = 'Retrait en boutique — ' + BOUTIQUE_ADRESSE + ' (' + BOUTIQUE_HORAIRES + ')';
  } else if ((mode === 'pickup' || mode === 'vinted') && selectedRelais) {
    const typeLabel = selectedRelais.type === 'vinted' ? 'Vinted Locker' : 'Point Relais Pickup';
    const horairesStr = Object.entries(selectedRelais.horaires).map(([j,h]) => j + ': ' + h).join(' / ');
    modeLabel = typeLabel + ' — ' + selectedRelais.nom + '\nAdresse : ' + selectedRelais.adresseComplete + '\nHoraires : ' + horairesStr;
  } else if (mode === 'pickup') {
    modeLabel = 'Retrait Point Relais Pickup';
  } else if (mode === 'vinted') {
    modeLabel = 'Vinted Locker';
  } else {
    modeLabel = 'Livraison à domicile (' + LIVRAISON.delivery.delai + ') — ' + addr + ' ' + cp + ' ' + ville;
  }

  /* Articles en texte */
  const articlesTexte = cart.map(i =>
    `• ${i.name} ×${i.qty} = ${(i.price * i.qty).toFixed(2).replace('.', ',')}€`
  ).join('\n');

  /* Sauvegarder dans localStorage */
  const commandes = JSON.parse(localStorage.getItem('ims_commandes') || '[]');
  commandes.unshift({
    id: orderNum, date: orderDate,
    client: { nom: nomClient, email, phone },
    articles: cart,
    livraison: {
      mode, adresse: modeLabel,
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
    order_items:      articlesTexte,
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

/* ---------- Validation du formulaire commande -------------- */
function validateOrderForm(form) {
  let isValid = true;
  const required = form ? form.querySelectorAll('[required]') : [];

  required.forEach(field => {
    const errorEl = field.nextElementSibling;
    if (!field.value.trim()) {
      field.classList.add('error');
      if (errorEl && errorEl.classList.contains('form-error')) {
        errorEl.classList.add('visible');
      }
      isValid = false;
    } else {
      field.classList.remove('error');
      if (errorEl && errorEl.classList.contains('form-error')) {
        errorEl.classList.remove('visible');
      }
    }
  });

  if (!isValid) showToast('Veuillez remplir tous les champs obligatoires', 'error');
  return isValid;
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

  /* Synchroniser les totaux + afficher section relais */
  /* Le mode choisi suit le client d'une page à l'autre (fiche produit → boutique) */
  try {
    const modeMemorise = localStorage.getItem('ims_livraison');
    const radioMemorise = modeMemorise && LIVRAISON[modeMemorise]
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
        if (subPickup) subPickup.textContent = '1,90€ — Offert dès 40€ — 24/48h';
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
