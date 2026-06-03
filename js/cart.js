/* ============================================================
   i-Mobile Service — Gestion du panier
   localStorage, drawer, modal récapitulatif, calcul totaux
   ============================================================ */

/* Clé de stockage localStorage */
const CART_KEY = 'ims_cart';
const SHIPPING_THRESHOLD = 50; /* Livraison offerte dès 50€ */
const SHIPPING_PRICE = 4.90;

/* ---------- Données Points Relais Pickup ------------------- */
const POINTS_RELAIS = [
  { id:'PR001', nom:'Carrefour Market Seysses',     adresse:'Route de Seysses, 31600 Seysses',           distance:'0.8 km', horaires:'Lun–Sam 8h–20h / Dim 9h–13h',      disponible:true },
  { id:'PR002', nom:'Tabac Presse Les Pradettes',   adresse:'15 Rue des Pradettes, 31100 Toulouse',       distance:'1.2 km', horaires:'Lun–Sam 7h–20h / Dim 8h–13h',      disponible:true },
  { id:'PR003', nom:'Supérette Casino',             adresse:'45 Route de Seysses, 31100 Toulouse',        distance:'1.5 km', horaires:'Lun–Dim 7h–22h',                    disponible:true },
  { id:'PR004', nom:'Pressing Central',             adresse:'8 Allée des Glières, 31100 Toulouse',        distance:'0.3 km', horaires:'Lun–Sam 9h–19h',                    disponible:true },
  { id:'PR005', nom:'Pharmacie des Glières',        adresse:'2 Place des Glières, 31100 Toulouse',        distance:'0.4 km', horaires:'Lun–Ven 9h–19h30 / Sam 9h–18h',    disponible:true },
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
  /* Retrait boutique, Point Relais et Vinted Locker = toujours gratuit */
  if (deliveryMode === 'store' || deliveryMode === 'pickup' || deliveryMode === 'vinted') return 0;
  /* Livraison domicile = gratuite dès 50€ */
  return subtotal >= SHIPPING_THRESHOLD ? 0 : SHIPPING_PRICE;
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

/* ---------- Afficher / masquer section Points Relais ------- */
function toggleRelaisSection(mode) {
  const section  = document.getElementById('pickup-relais-section');
  const subLabel = document.getElementById('pickup-sub-label');
  if (!section) return;
  if (mode === 'pickup') {
    section.style.display = 'block';
    /* Afficher la liste si un relais est déjà sélectionné */
    if (selectedRelais) {
      afficherRelaisSelectionne();
    } else {
      rechercherRelais();
    }
  } else {
    section.style.display = 'none';
  }
}

/* ---------- Rechercher et afficher les points relais ------- */
function rechercherRelais() {
  const cp   = (document.getElementById('relais-cp')?.value || '31100').trim();
  const list = document.getElementById('relais-list');
  if (!list) return;

  /* Animation de chargement */
  list.innerHTML = '<div style="text-align:center;padding:.75rem;color:#888;font-size:.85rem;">🔍 Recherche en cours…</div>';

  setTimeout(() => {
    /* Filtrer les relais selon le CP (simulation) */
    const relais = POINTS_RELAIS.filter(r =>
      r.adresse.includes(cp) || cp.startsWith('31') || cp === ''
    );

    if (!relais.length) {
      list.innerHTML = '<div style="text-align:center;padding:.75rem;color:#888;font-size:.85rem;">Aucun point relais trouvé pour ce code postal.</div>';
      return;
    }

    list.innerHTML = relais.map(r => buildRelaisCard(r)).join('');
  }, 400);
}

/* Construire une carte point relais */
function buildRelaisCard(r) {
  const isSelected = selectedRelais && selectedRelais.id === r.id;
  return `
    <div class="relais-card ${isSelected ? 'selected' : ''}" id="relais-card-${r.id}">
      <div class="relais-info">
        <div class="relais-nom">📦 ${r.nom}</div>
        <div class="relais-adresse">📍 ${r.adresse}</div>
        <div class="relais-meta">⏱️ ${r.distance} — ${r.horaires}</div>
        ${r.disponible ? '<div class="relais-dispo">✅ Disponible</div>' : '<div style="font-size:.72rem;color:#dc2626;">❌ Indisponible</div>'}
      </div>
      ${isSelected
        ? '<span class="relais-selected-badge">✓ Sélectionné</span>'
        : `<button class="relais-select-btn" onclick="choisirRelais('${r.id}')" ${!r.disponible ? 'disabled' : ''}>Choisir</button>`
      }
    </div>`;
}

/* Sélectionner un point relais */
function choisirRelais(id) {
  const relais = POINTS_RELAIS.find(r => r.id === id);
  if (!relais) return;
  selectedRelais = relais;

  /* Mettre à jour toutes les cartes affichées */
  const list = document.getElementById('relais-list');
  if (list) list.innerHTML = POINTS_RELAIS.filter(r => {
    const cp = (document.getElementById('relais-cp')?.value || '31100').trim();
    return r.adresse.includes(cp) || cp.startsWith('31') || cp === '';
  }).map(r => buildRelaisCard(r)).join('');

  /* Mettre à jour le sous-label de l'option pickup */
  const subLabel = document.getElementById('pickup-sub-label');
  if (subLabel) subLabel.textContent = relais.nom + ' (' + relais.distance + ')';

  /* Mettre à jour les totaux */
  updateTotals();

  if (typeof showToast === 'function') showToast('Point relais sélectionné : ' + relais.nom, 'success');
}

function afficherRelaisSelectionne() {
  const list = document.getElementById('relais-list');
  if (!list) return;
  rechercherRelais();
}

/* Exposer globalement (appelé depuis onclick HTML) */
window.rechercherRelais = rechercherRelais;
window.choisirRelais    = choisirRelais;

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

  if (subtotalEl) subtotalEl.textContent = subtotal.toFixed(2).replace('.', ',') + '€';
  if (shippingEl) {
    if (deliveryMode === 'store' || deliveryMode === 'pickup' || deliveryMode === 'vinted') {
      shippingEl.textContent = 'Gratuit';
    } else if (shipping === 0) {
      shippingEl.textContent = 'Offerte ✓';
    } else {
      shippingEl.textContent = shipping.toFixed(2).replace('.', ',') + '€';
    }
  }
  if (totalEl) totalEl.textContent = total.toFixed(2).replace('.', ',') + '€';

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
function openOrderModal() {
  const cart = getCart();
  if (cart.length === 0) {
    showToast('Votre panier est vide', 'error');
    return;
  }
  /* Vérifier qu'un point relais est sélectionné si pickup */
  const mode = getDeliveryMode();
  if (mode === 'pickup' && !selectedRelais) {
    showToast('⚠️ Veuillez choisir un point relais Pickup', 'error');
    /* Ouvrir la section relais si nécessaire */
    const section = document.getElementById('pickup-relais-section');
    if (section) section.style.display = 'block';
    rechercherRelais();
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
  const deliveryLabels = {
    store:    '🏪 Retrait en boutique (gratuit)',
    pickup:   '📦 Retrait Point Relais Pickup (gratuit)',
    vinted:   '🔁 Vinted Locker (gratuit)',
    delivery: '🚚 Livraison à domicile',
  };
  const deliveryLabel = deliveryLabels[deliveryMode] || '🏪 Retrait en boutique';
  const deliveryResume = document.getElementById('modal-delivery-resume');
  if (deliveryResume) deliveryResume.textContent = deliveryLabel;

  /* Totaux modal */
  const modalSubtotal = document.getElementById('modal-subtotal');
  const modalShipping = document.getElementById('modal-shipping-cost');
  const modalTotal = document.getElementById('modal-grand-total');
  if (modalSubtotal) modalSubtotal.textContent = subtotal.toFixed(2).replace('.', ',') + '€';
  if (modalShipping) {
    modalShipping.textContent = deliveryMode === 'store'
      ? 'Gratuit'
      : (shipping === 0 ? 'Offerte ✓' : shipping.toFixed(2).replace('.', ',') + '€');
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

/* ---------- Valider et confirmer la commande ---------- */
function confirmStorePickup() {
  const form = document.getElementById('order-form');
  if (!validateOrderForm(form)) return;

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

  const modeLabels = {
    store:    'Retrait en boutique — 221 Route de Seysses, Toulouse',
    pickup:   selectedRelais
      ? `Point Relais Pickup — ${selectedRelais.nom}\nAdresse : ${selectedRelais.adresse}\nHoraires : ${selectedRelais.horaires}`
      : 'Retrait Point Relais Pickup',
    vinted:   'Vinted Locker',
    delivery: `Livraison à domicile — ${addr} ${cp} ${ville}`,
  };
  const modeLabel = modeLabels[mode] || mode;

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
      relais: (mode === 'pickup' && selectedRelais) ? selectedRelais : null
    },
    soustotal: subtotal.toFixed(2),
    frais: shipping.toFixed(2),
    total: total.toFixed(2),
    statut: 'en_attente'
  });
  localStorage.setItem('ims_commandes', JSON.stringify(commandes));

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
  document.querySelectorAll('.delivery-options input[name="delivery"]').forEach(radio => {
    radio.addEventListener('change', () => {
      updateTotals();
      toggleRelaisSection(radio.value);
      /* Réinitialiser le relais si on change de mode */
      if (radio.value !== 'pickup') {
        selectedRelais = null;
        const subLabel = document.getElementById('pickup-sub-label');
        if (subLabel) subLabel.textContent = 'Proche de chez vous';
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

  /* Fermer le drawer via bouton */
  const cartCloseBtn = document.getElementById('cart-close-btn');
  if (cartCloseBtn) cartCloseBtn.addEventListener('click', closeCart);
});

/* Exposer les fonctions globalement */
window.openOrderModal = openOrderModal;
window.closeOrderModal = closeOrderModal;
window.updateTotals = updateTotals;
window.addToCart = addToCart;
