/* ============================================================
   i-Mobile Service — JavaScript principal
   Navbar, animations, toasts, statistiques animées
   ============================================================ */

/* ---------- Navbar : scroll + active link + hamburger ------ */
(function () {
  const navbar  = document.querySelector('.navbar');
  const hamburger = document.querySelector('.hamburger');
  const mobileMenu = document.querySelector('.mobile-menu');

  /* Ajoute l'ombre au défilement */
  window.addEventListener('scroll', () => {
    if (window.scrollY > 20) {
      navbar && navbar.classList.add('scrolled');
    } else {
      navbar && navbar.classList.remove('scrolled');
    }
  }, { passive: true });

  /* Menu hamburger mobile */
  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', () => {
      hamburger.classList.toggle('open');
      mobileMenu.classList.toggle('open');
      document.body.style.overflow = mobileMenu.classList.contains('open') ? 'hidden' : '';
    });

    /* Fermer le menu si on clique sur un lien */
    mobileMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        hamburger.classList.remove('open');
        mobileMenu.classList.remove('open');
        document.body.style.overflow = '';
      });
    });
  }

  /* Marquer le lien actif selon la page courante */
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a, .mobile-menu a').forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPage || (currentPage === '' && href === 'index.html')) {
      link.classList.add('active');
    }
  });
})();

/* ---------- Système de toasts ------------------------------ */
window.showToast = function (message, type = 'info', title = null) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const icons = {
    success: '✓',
    error:   '✕',
    info:    'ℹ',
  };
  const titles = {
    success: 'Succès',
    error:   'Erreur',
    info:    'Info',
  };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <div class="toast-body">
      <div class="toast-title">${title || titles[type]}</div>
      <div class="toast-msg">${message}</div>
    </div>
  `;

  container.appendChild(toast);

  /* Auto-suppression après 3,5 secondes */
  setTimeout(() => {
    toast.classList.add('removing');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }, 3500);
};

/* ---------- Animations au scroll (IntersectionObserver) ---- */
(function () {
  const animatedEls = document.querySelectorAll('.fade-in, .fade-in-left, .fade-in-right');
  if (!animatedEls.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        /* On arrête d'observer une fois l'animation jouée */
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  animatedEls.forEach(el => observer.observe(el));
})();

/* ---------- Statistiques animées au scroll ----------------- */
(function () {
  const statNumbers = document.querySelectorAll('.stat-number[data-target]');
  if (!statNumbers.length) return;

  function animateNumber(el) {
    const target = parseFloat(el.dataset.target);
    const suffix = el.dataset.suffix || '';
    const prefix = el.dataset.prefix || '';
    const duration = 1800;
    const startTime = performance.now();

    function update(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      /* Fonction d'ease-out cubique */
      const ease = 1 - Math.pow(1 - progress, 3);
      const value = target * ease;

      if (Number.isInteger(target)) {
        el.textContent = prefix + Math.round(value).toLocaleString('fr-FR') + suffix;
      } else {
        el.textContent = prefix + value.toFixed(1) + suffix;
      }

      if (progress < 1) requestAnimationFrame(update);
    }

    requestAnimationFrame(update);
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateNumber(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  statNumbers.forEach(el => observer.observe(el));
})();

/* ---------- Panier : synchroniser le badge sur toutes les pages */
(function syncCartBadge() {
  try {
    const cart = JSON.parse(localStorage.getItem('ims_cart') || '[]');
    const total = cart.reduce((sum, item) => sum + (item.qty || 0), 0);
    document.querySelectorAll('.cart-badge').forEach(badge => {
      if (total > 0) {
        badge.textContent = total > 99 ? '99+' : total;
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    });
  } catch (e) {
    /* Silencieux si localStorage indisponible */
  }

  /* Ouvrir le drawer depuis toute page si on a le cart-btn */
  document.querySelectorAll('.cart-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      /* Sur la page boutique, openCart() est défini dans cart.js */
      if (typeof window.openCart === 'function') {
        window.openCart();
      } else {
        /* Rediriger vers la boutique avec l'ancre #panier */
        window.location.href = 'boutique.html#panier';
      }
    });
  });
})();

/* ---------- Lien de la boutique depuis les autres pages ---- */
document.addEventListener('DOMContentLoaded', () => {
  /* Pré-remplir le type d'appareil dans le formulaire RDV
     si on arrive depuis la page réparations avec un paramètre URL */
  const params = new URLSearchParams(window.location.search);
  const deviceParam = params.get('device');
  if (deviceParam) {
    /* Le script rdv.js lira ce paramètre et pré-sélectionnera le type */
    window._rdvDevice = deviceParam;
  }
});
