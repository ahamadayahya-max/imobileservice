/* ============================================================
   i-Mobile Service — « Nos coups de cœur de la semaine » (page d'accueil)
   Lit /api/offres-semaine (3 à 5 produits réels du catalogue, prix
   identique au paiement) et remplit #ims-offres-semaine.
   Moins de 3 offres ou erreur → rien n'est affiché (aucun espace vide).
   ============================================================ */
(function () {
  const conteneur = document.getElementById('ims-offres-semaine');
  if (!conteneur) return;

  const echapper = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const euros = n => Number(n).toFixed(2).replace('.', ',') + ' €';

  function carte(o) {
    const lien = 'product.html?id=' + encodeURIComponent(o.id);
    const visuel = o.image
      ? `<img src="${echapper(o.image)}" alt="${echapper(o.nom)}" loading="lazy" decoding="async" width="200" height="150">`
      : `<span class="ims-offres-emoji" aria-hidden="true">${echapper(o.emoji || '📦')}</span>`;
    return `
      <li class="ims-offres-carte">
        <a class="ims-offres-visuel" href="${lien}" tabindex="-1" aria-hidden="true">${visuel}</a>
        <div class="ims-offres-corps">
          <a class="ims-offres-nom" href="${lien}">${echapper(o.nom)}</a>
          ${o.description ? `<p class="ims-offres-desc">${echapper(o.description)}</p>` : ''}
          <div class="ims-offres-pied">
            <span class="ims-offres-prix">${euros(o.prix)}<small>TTC</small></span>
            <a class="ims-offres-bouton" href="${lien}" aria-label="Découvrir ${echapper(o.nom)}">Découvrir</a>
          </div>
        </div>
      </li>`;
  }

  function afficher(offres) {
    conteneur.innerHTML = `
      <section class="section ims-offres" aria-labelledby="ims-offres-titre">
        <div class="section-inner">
          <div class="section-header">
            <div class="section-tag ims-offres-tag">SÉLECTION DE LA SEMAINE</div>
            <h2 class="section-title" id="ims-offres-titre">NOS COUPS DE CŒUR DE LA SEMAINE</h2>
            <p class="section-subtitle">Les bons plans i-Mobile Service, sélectionnés pour vous.</p>
            <div class="ims-offres-entete-bas"><a class="ims-offres-lien-boutique" href="boutique.html">Voir toute la boutique →</a></div>
          </div>
          <div class="ims-offres-cadre">
            <button type="button" class="ims-offres-fleche ims-offres-prec" aria-label="Produits précédents">‹</button>
            <ul class="ims-offres-piste" tabindex="0" aria-label="Coups de cœur de la semaine">${offres.map(carte).join('')}</ul>
            <button type="button" class="ims-offres-fleche ims-offres-suiv" aria-label="Produits suivants">›</button>
          </div>
        </div>
      </section>`;

    const piste = conteneur.querySelector('.ims-offres-piste');
    const prec = conteneur.querySelector('.ims-offres-prec');
    const suiv = conteneur.querySelector('.ims-offres-suiv');
    const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* Une flèche fait avancer d'une carte */
    const pas = () => {
      const c = piste.querySelector('.ims-offres-carte');
      return c ? c.getBoundingClientRect().width + parseFloat(getComputedStyle(piste).columnGap || 16) : piste.clientWidth;
    };
    const majFleches = () => {
      prec.disabled = piste.scrollLeft <= 2;
      suiv.disabled = piste.scrollLeft + piste.clientWidth >= piste.scrollWidth - 2;
    };
    prec.addEventListener('click', () => piste.scrollBy({ left: -pas(), behavior: reduit ? 'auto' : 'smooth' }));
    suiv.addEventListener('click', () => piste.scrollBy({ left: pas(), behavior: reduit ? 'auto' : 'smooth' }));
    piste.addEventListener('scroll', majFleches, { passive: true });
    window.addEventListener('resize', majFleches, { passive: true });
    majFleches();
  }

  fetch('/api/offres-semaine')
    .then(r => (r.ok ? r.json() : null))
    .then(json => {
      const offres = (json && json.offres) || [];
      if (offres.length >= 3) afficher(offres.slice(0, 5));
    })
    .catch(() => { /* section simplement absente */ });
})();
