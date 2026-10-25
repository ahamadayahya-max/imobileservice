/* ============================================================
   i-Mobile Service — Bandeau cookies (recommandations CNIL)
   Le choix (accepté / refusé) est mémorisé dans localStorage :
   le bandeau ne réapparaît plus ensuite, quel que soit le choix.
   ============================================================ */
(function () {
  const CLE = 'ims_cookies';

  function lireChoix() {
    try { return localStorage.getItem(CLE); } catch { return null; }
  }
  function enregistrerChoix(valeur) {
    try {
      localStorage.setItem(CLE, JSON.stringify({ choix: valeur, date: new Date().toISOString() }));
    } catch { /* navigation privée : le bandeau reviendra, sans gravité */ }
  }

  function afficher() {
    if (lireChoix() || document.getElementById('cookie-banner')) return;

    const style = document.createElement('style');
    style.textContent = `
      #cookie-banner{position:fixed;left:0;right:0;bottom:0;z-index:1050;background:#fff;color:#1a1a2e;
        border-top:1px solid #e5e7eb;box-shadow:0 -6px 24px rgba(0,0,0,.12);padding:14px 16px;
        font-family:inherit;font-size:.92rem;line-height:1.45;animation:ckIn .3s ease-out}
      #cookie-banner .ck-inner{max-width:1100px;margin:0 auto;display:flex;align-items:center;gap:14px 24px;flex-wrap:wrap;justify-content:space-between}
      #cookie-banner p{margin:0;flex:1 1 420px}
      #cookie-banner .ck-btns{display:flex;gap:10px;flex-wrap:wrap}
      #cookie-banner button{border:0;border-radius:8px;padding:10px 18px;font:inherit;font-weight:600;cursor:pointer}
      #cookie-banner .ck-accept{background:#8b1a1a;color:#fff}
      #cookie-banner .ck-accept:hover{background:#6f1414}
      #cookie-banner .ck-refuse{background:#e5e7eb;color:#000}
      #cookie-banner .ck-refuse:hover{background:#d1d5db}
      @media (max-width:520px){#cookie-banner .ck-btns{width:100%}#cookie-banner button{flex:1}}
      @keyframes ckIn{from{transform:translateY(100%)}to{transform:none}}`;
    document.head.appendChild(style);

    const bandeau = document.createElement('div');
    bandeau.id = 'cookie-banner';
    bandeau.setAttribute('role', 'dialog');
    bandeau.setAttribute('aria-label', 'Information cookies');
    bandeau.innerHTML = `
      <div class="ck-inner">
        <p>🍪 Ce site utilise des cookies nécessaires au fonctionnement du panier et du paiement sécurisé (Stripe). Pas de cookies publicitaires.</p>
        <div class="ck-btns">
          <button type="button" class="ck-refuse">Continuer sans accepter</button>
          <button type="button" class="ck-accept">Accepter</button>
        </div>
      </div>`;
    document.body.appendChild(bandeau);

    const fermer = (valeur) => { enregistrerChoix(valeur); bandeau.remove(); };
    bandeau.querySelector('.ck-accept').addEventListener('click', () => fermer('accepte'));
    bandeau.querySelector('.ck-refuse').addEventListener('click', () => fermer('refuse'));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', afficher);
  else afficher();
})();
