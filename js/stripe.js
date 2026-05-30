/* ============================================================
   i-Mobile Service — Intégration Stripe
   Utilise Stripe.js CDN (chargé dans la page boutique)

   CONFIGURATION :
   1. Remplacer 'pk_test_VOTRE_CLE_ICI' par votre clé publique Stripe
      depuis https://dashboard.stripe.com/apikeys
   2. Créer vos produits dans le Dashboard Stripe
   3. Voir README.md pour les instructions complètes
   ============================================================ */

/* Clé publique Stripe — à remplacer par votre vraie clé */
const STRIPE_PUBLIC_KEY = 'pk_test_VOTRE_CLE_ICI';

let stripeInstance = null;

/* ---------- Initialiser Stripe ----------------------------- */
function initStripe() {
  if (typeof Stripe === 'undefined') {
    console.warn('[Stripe] SDK non chargé. Vérifiez le CDN dans boutique.html');
    return null;
  }
  if (!stripeInstance) {
    stripeInstance = Stripe(STRIPE_PUBLIC_KEY);
  }
  return stripeInstance;
}

/* ---------- Construire les line_items depuis le panier ----- */
function buildLineItems(cart) {
  /*
   * En production, vous devez créer les Price IDs dans le Dashboard Stripe
   * et mapper chaque produit à son Price ID.
   *
   * Exemple de mapping :
   * const priceIds = {
   *   'verre-trempe-9h-pro': 'price_1AbCdEfGhIjKlMnO',
   *   'chargeur-45w-usbc': 'price_1PqRsTuVwXyZaBcD',
   *   ...
   * };
   *
   * Pour le prototype, on utilise des Price IDs fictifs.
   * En mode test Stripe, vous pouvez créer des produits directement
   * depuis le Dashboard et copier leurs Price IDs ici.
   */
  return cart.map(item => ({
    price: `price_${item.id}`, /* À remplacer par les vrais Price IDs */
    quantity: item.qty,
  }));
}

/* ---------- Lancer le paiement Stripe Checkout ------------- */
async function launchStripeCheckout(cart, deliveryMode, customerInfo) {
  const stripe = initStripe();

  if (!stripe) {
    showToast('Service de paiement temporairement indisponible. Veuillez payer en boutique.', 'error', 'Paiement en ligne');
    return;
  }

  if (STRIPE_PUBLIC_KEY === 'pk_test_VOTRE_CLE_ICI') {
    /* Mode démo — montrer un message explicatif */
    showStripeConfigModal(cart, deliveryMode, customerInfo);
    return;
  }

  /* Construction de la session Checkout */
  const lineItems = buildLineItems(cart);

  /* Ajouter les frais de port comme ligne si livraison à domicile */
  if (deliveryMode === 'delivery') {
    const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
    if (subtotal < 50) {
      lineItems.push({
        price_data: {
          currency: 'eur',
          product_data: { name: 'Frais de livraison' },
          unit_amount: 490, /* 4,90€ en centimes */
        },
        quantity: 1,
      });
    }
  }

  try {
    const { error } = await stripe.redirectToCheckout({
      lineItems,
      mode: 'payment',
      successUrl: `${window.location.origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl:  `${window.location.origin}/boutique.html`,
      customerEmail: customerInfo.email,
      billingAddressCollection: deliveryMode === 'delivery' ? 'required' : 'auto',
      shippingAddressCollection: deliveryMode === 'delivery'
        ? { allowedCountries: ['FR'] }
        : undefined,
      locale: 'fr',
    });

    if (error) {
      console.error('[Stripe] Erreur checkout:', error.code);
      showToast(error.message || 'Erreur lors du paiement. Veuillez réessayer.', 'error', 'Paiement refusé');
    }
  } catch (err) {
    console.error('[Stripe] Erreur inattendue:', err);
    showToast('Une erreur inattendue est survenue. Veuillez réessayer.', 'error');
  }
}

/* ---------- Modal d'information quand Stripe n'est pas configuré */
function showStripeConfigModal(cart, deliveryMode, customerInfo) {
  const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const shipping = deliveryMode === 'delivery' && total < 50 ? 4.90 : 0;
  const grandTotal = total + shipping;

  const modal = document.createElement('div');
  modal.style.cssText = `
    position:fixed;inset:0;background:rgba(26,26,46,0.7);z-index:9999;
    display:flex;align-items:center;justify-content:center;padding:1rem;
    backdrop-filter:blur(6px);
  `;
  modal.innerHTML = `
    <div style="background:white;border-radius:20px;padding:2rem 2.5rem;max-width:500px;width:100%;box-shadow:0 24px 64px rgba(0,0,0,0.2);">
      <div style="text-align:center;margin-bottom:1.5rem;">
        <div style="font-size:2.5rem;margin-bottom:0.75rem;">💳</div>
        <h2 style="font-family:'Space Grotesk',sans-serif;font-size:1.3rem;margin-bottom:0.4rem;">Paiement en ligne</h2>
        <p style="color:#5a5a7a;font-size:0.9rem;">La clé Stripe n'est pas encore configurée pour ce prototype.</p>
      </div>
      <div style="background:#f8f9fc;border-radius:12px;padding:1.25rem;margin-bottom:1.5rem;">
        <div style="font-size:0.8rem;font-weight:700;color:#9b9bb5;text-transform:uppercase;letter-spacing:.06em;margin-bottom:0.75rem;">Commande simulée</div>
        ${cart.map(item => `
          <div style="display:flex;justify-content:space-between;font-size:0.88rem;margin-bottom:0.3rem;">
            <span>${item.emoji} ${item.name} ×${item.qty}</span>
            <strong>${(item.price * item.qty).toFixed(2).replace('.', ',')}€</strong>
          </div>
        `).join('')}
        ${shipping > 0 ? `<div style="display:flex;justify-content:space-between;font-size:0.88rem;margin-bottom:0.3rem;"><span>Livraison</span><strong>4,90€</strong></div>` : ''}
        <div style="display:flex;justify-content:space-between;font-size:1rem;font-weight:800;font-family:'Space Grotesk',sans-serif;border-top:1.5px solid #e4e7ee;margin-top:0.6rem;padding-top:0.6rem;color:#0097a7;">
          <span>Total</span><span>${grandTotal.toFixed(2).replace('.', ',')}€</span>
        </div>
      </div>
      <div style="background:#e0f7fa;border-radius:10px;padding:1rem;margin-bottom:1.5rem;font-size:0.83rem;color:#006978;">
        <strong>📖 Pour activer le paiement réel :</strong><br>
        1. Obtenez votre clé sur <a href="https://dashboard.stripe.com/apikeys" target="_blank" style="color:#0097a7;">dashboard.stripe.com</a><br>
        2. Remplacez <code>pk_test_VOTRE_CLE_ICI</code> dans <strong>js/stripe.js</strong><br>
        3. Créez vos produits et copiez leurs Price IDs<br>
        <a href="README.md" style="color:#0097a7;font-weight:600;">→ Voir le README.md pour les détails</a>
      </div>
      <button onclick="this.closest('[style*=fixed]').remove();document.body.style.overflow=''"
        style="width:100%;padding:0.85rem;background:#00bcd4;color:white;border:none;border-radius:10px;font-size:1rem;font-weight:700;cursor:pointer;font-family:inherit;">
        Compris — Fermer
      </button>
    </div>
  `;
  document.body.appendChild(modal);
  document.body.style.overflow = 'hidden';
  modal.addEventListener('click', e => {
    if (e.target === modal) { modal.remove(); document.body.style.overflow = ''; }
  });
}

/* ---------- Exposer la fonction de paiement ---------------- */
window.launchStripeCheckout = launchStripeCheckout;
window.initStripe = initStripe;

/* ---------- Attacher au bouton "Confirmer et payer" -------- */
document.addEventListener('DOMContentLoaded', () => {
  /* Initialiser Stripe dès que la page est prête */
  setTimeout(initStripe, 500);

  const payBtn = document.getElementById('btn-pay-stripe');
  if (!payBtn) return;

  payBtn.addEventListener('click', () => {
    /* Récupérer les informations du formulaire de commande */
    const form = document.getElementById('order-form');
    if (!form) return;

    /* Valider le formulaire (défini dans cart.js) */
    if (typeof validateOrderForm === 'function' && !validateOrderForm(form)) return;

    const cart = JSON.parse(localStorage.getItem('ims_cart') || '[]');
    if (!cart.length) { showToast('Votre panier est vide', 'error'); return; }

    const deliveryMode = document.querySelector('input[name="delivery"]:checked')?.value || 'store';
    const customerInfo = {
      firstName: document.getElementById('order-firstname')?.value?.trim(),
      lastName:  document.getElementById('order-lastname')?.value?.trim(),
      email:     document.getElementById('order-email')?.value?.trim(),
      phone:     document.getElementById('order-phone')?.value?.trim(),
    };

    payBtn.disabled = true;
    payBtn.innerHTML = `
      <svg style="width:18px;height:18px;animation:spin 1s linear infinite" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" stroke-width="3"/>
        <path d="M12 2a10 10 0 0 1 10 10" stroke="white" stroke-width="3" stroke-linecap="round"/>
      </svg>
      Redirection vers Stripe…
    `;

    launchStripeCheckout(cart, deliveryMode, customerInfo)
      .finally(() => {
        payBtn.disabled = false;
        payBtn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width:18px;height:18px;">
            <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"/>
          </svg>
          Confirmer et payer
        `;
      });
  });
});

/* Animation spinner pour le bouton */
const style = document.createElement('style');
style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
document.head.appendChild(style);
