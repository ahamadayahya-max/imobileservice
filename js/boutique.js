/* ============================================================
   i-Mobile Service — Moteur de rendu boutique
   Rendu dynamique depuis CATALOGUE, filtres, recherche, tri
   ============================================================ */

/* État courant de la boutique */
let etatFiltreCategorie = 'all';
let etatRecherche       = '';
let etatTri             = 'defaut'; /* defaut | prix-asc | prix-desc | nouveau */

/* Catégories pour l'affichage */
const LABELS_CATEGORIE = {
  telephone:  '📱 Téléphones',
  pc:         '💻 PC & Tablettes',
  protection: '🛡️ Protection',
  coque:      '🎨 Coques',
  chargeur:   '⚡ Chargeurs',
  cable:      '🔗 Câbles',
  audio:      '🎧 Audio',
  accessoire: '🔧 Accessoires',
};

/* Badges → classes CSS */
const BADGE_CLASSES = {
  bestseller: 'badge-bestseller',
  nouveau:    'badge-nouveau',
  pro:        'badge-pro',
};

/* Étiquettes livraison rapide par catégorie */
function getLivraisonLabel(produit) {
  if (produit.categorie === 'telephone' || produit.categorie === 'pc') {
    return '<span class="dispo-tag dispo-pending">⏳ Disponibilité sous 24h</span>';
  }
  return '<span class="dispo-tag dispo-ok">✅ En stock</span>';
}

/* Génère le bouton principal selon disponibilité Mobilax */
function getBoutonAction(produit) {
  if (!produit.disponible) {
    /* Produit Mobilax — bouton Réserver → mailto */
    const sujet = encodeURIComponent(`Réservation — ${produit.nom}`);
    const corps = encodeURIComponent(
      `Bonjour,\n\nJe souhaite réserver le produit suivant :\n` +
      `${produit.nom} — ${produit.prix}€\n\n` +
      `Merci de me confirmer la disponibilité.\n\nCordialement`
    );
    return `<a href="mailto:ims.tlse@gmail.com?subject=${sujet}&body=${corps}" class="btn-reserver">
      📩 Réserver
    </a>`;
  }
  /* Produit accessoire — bouton Ajouter au panier */
  const nomEchap = produit.nom.replace(/"/g, '&quot;');
  return `<button class="add-to-cart-btn"
      data-id="${produit.id}"
      data-name="${nomEchap}"
      data-price="${produit.prix}"
      data-emoji="${produit.emoji}">
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
         stroke-width="2.5" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/>
    </svg>Ajouter
  </button>`;
}

/* Badge Grade A / Neuf pour téléphones et PC */
function getBadgeGrade(produit) {
  if (produit.categorie !== 'telephone' && produit.categorie !== 'pc') return '';
  if (produit.grade === 'A') {
    return '<span class="grade-badge grade-a">Grade A</span>';
  }
  if (produit.neuf) {
    return '<span class="grade-badge grade-neuf">Neuf</span>';
  }
  return '';
}

/* Construit le HTML d'une carte produit */
function buildCarteHTML(produit) {
  const badgeHTML = produit.badge
    ? `<span class="product-badge ${BADGE_CLASSES[produit.badge] || ''}">${produit.badge.charAt(0).toUpperCase() + produit.badge.slice(1)}</span>`
    : '';

  const categorieLabel = LABELS_CATEGORIE[produit.categorie] || produit.categorie;
  const prixFormate = produit.prix.toFixed(2).replace('.', ',') + '€';

  /* Photo produit : localStorage (admin) en priorité, sinon IMAGES map, sinon emoji */
  const customPhotos = (() => { try { return JSON.parse(localStorage.getItem('ims_photos') || '{}'); } catch { return {}; } })();
  const imgData = customPhotos[produit.id]
    ? { src: customPhotos[produit.id], alt: produit.nom }
    : (typeof IMAGES !== 'undefined' && IMAGES[produit.id])
      || (produit.image ? { src: produit.image, alt: produit.nom } : null);
  /* Photos fournisseur (fond blanc, cadrage serré) : affichées entières, jamais recadrées */
  const isContain = produit.source === 'mobilax' || produit.categorie === 'telephone' || produit.categorie === 'pc';
  const imgHTML = imgData
    ? `<img
         src="${imgData.src}"
         alt="${imgData.alt}"
         loading="lazy"
         class="product-img${isContain ? ' product-img-contain' : ''}"
         onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
       <span class="product-img-fallback" style="display:none">${produit.emoji}</span>`
    : `<span class="product-img-fallback">${produit.emoji}</span>`;

  return `
    <div class="product-card fade-in visible" data-category="${produit.categorie}" data-id="${produit.id}">
      <a href="product.html?id=${produit.id}" class="product-image-link" aria-label="Voir ${produit.nom}">
        <div class="product-image" data-category="${produit.categorie}">
          ${imgHTML}
          ${badgeHTML}
          ${getBadgeGrade(produit)}
        </div>
      </a>
      <div class="product-body">
        <div class="product-category">${categorieLabel}</div>
        <a href="product.html?id=${produit.id}" class="product-name">${produit.nom}</a>
        <div class="product-footer">
          <div>
            <span class="product-price">${prixFormate}</span>
            <span class="badge-prix-garanti">⚡ Meilleur prix garanti</span>
            ${getLivraisonLabel(produit)}
          </div>
          ${getBoutonAction(produit)}
        </div>
      </div>
    </div>`;
}

/* Filtre + trie + affiche les produits */
function afficherProduits() {
  const grille = document.getElementById('products-grid');
  if (!grille || typeof CATALOGUE === 'undefined') return;

  let liste = [...CATALOGUE];

  /* Filtre catégorie */
  if (etatFiltreCategorie !== 'all') {
    liste = liste.filter(p => p.categorie === etatFiltreCategorie);
  }

  /* Filtre recherche */
  if (etatRecherche.trim()) {
    const q = etatRecherche.trim().toLowerCase();
    liste = liste.filter(p =>
      p.nom.toLowerCase().includes(q) ||
      p.marque.toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q)
    );
  }

  /* Tri */
  if (etatTri === 'prix-asc')  liste.sort((a, b) => a.prix - b.prix);
  if (etatTri === 'prix-desc') liste.sort((a, b) => b.prix - a.prix);
  if (etatTri === 'nouveau')   liste = liste.filter(p => p.badge === 'nouveau').concat(
    liste.filter(p => p.badge !== 'nouveau')
  );

  /* Mise à jour compteur filtre actif */
  document.querySelectorAll('.filter-btn').forEach(btn => {
    const cat = btn.dataset.filter;
    const count = cat === 'all'
      ? CATALOGUE.length
      : CATALOGUE.filter(p => p.categorie === cat).length;
    const span = btn.querySelector('.filter-count');
    if (span) span.textContent = count;
  });

  /* Bandeau d'en-tête : suit le catalogue réel (statique ou Mobilax) */
  const heroCountEl = document.getElementById('hero-product-count');
  if (heroCountEl) heroCountEl.textContent = CATALOGUE.length;

  /* Résultats */
  const compteurEl = document.getElementById('results-count');
  if (compteurEl) {
    compteurEl.textContent = liste.length + ' produit' + (liste.length > 1 ? 's' : '');
  }

  if (liste.length === 0) {
    grille.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:4rem 2rem;color:var(--color-text-muted);">
        <div style="font-size:3rem;margin-bottom:1rem;">🔍</div>
        <p style="font-size:1rem;font-weight:600;">Aucun produit trouvé</p>
        <p style="font-size:.88rem;margin-top:.4rem;">Essayez un autre mot-clé ou catégorie</p>
      </div>`;
    return;
  }

  grille.innerHTML = liste.map(buildCarteHTML).join('');

  /* Rebrancher les boutons panier sur les cartes fraîchement rendues */
  grille.querySelectorAll('.add-to-cart-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const produit = {
        id:    parseInt(btn.dataset.id),
        name:  btn.dataset.name,
        price: parseFloat(btn.dataset.price),
        emoji: btn.dataset.emoji,
      };
      if (typeof addToCart === 'function') addToCart(produit);

      /* Feedback visuel */
      btn.classList.add('added');
      const original = btn.innerHTML;
      btn.innerHTML = '✓ Ajouté';
      setTimeout(() => { btn.classList.remove('added'); btn.innerHTML = original; }, 1500);
    });
  });
}

/* Initialisation au chargement du DOM */
document.addEventListener('DOMContentLoaded', () => {

  /* Filtres catégorie */
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      etatFiltreCategorie = btn.dataset.filter;
      afficherProduits();
    });
  });

  /* Barre de recherche */
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      etatRecherche = searchInput.value;
      afficherProduits();
    });
  }

  /* Sélecteur de tri */
  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      etatTri = sortSelect.value;
      afficherProduits();
    });
  }

  /* Premier rendu */
  afficherProduits();
});

/* Re-rendu quand le catalogue Mobilax remplace le catalogue statique */
document.addEventListener('catalogue:charge', afficherProduits);
