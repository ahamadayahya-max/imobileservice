/* ============================================================
   i-Mobile Service — Proxy sécurisé API Mobilax (Vercel Function)
   La clé MOBILAX_API_KEY ne quitte jamais le serveur. Les prix
   d'achat Mobilax sont convertis en prix de vente ICI, pour que
   le navigateur ne voie jamais nos coûts d'achat.

   GET /api/mobilax?action=catalogue   → produits au format CATALOGUE
   GET /api/mobilax?action=categories  → référentiel catégories (debug mapping)
   ============================================================ */

/* Production (vrais stocks et prix). Pour tester sur la preprod :
   MOBILAX_BASE_URL=https://apiv2.mobilax.pro/v1.0/external avec une clé preprod */
const BASE_URL = process.env.MOBILAX_BASE_URL || 'https://apiv2.mobilax.fr/v1.0/external';

/* Assets publics de la prod (le stockage d'images de la preprod est vide) */
const ASSETS_URL = process.env.MOBILAX_ASSETS_URL || 'https://apiv2.mobilax.fr/v1.0/assets';

/* TVA appliquée au prix d'achat HT avant d'afficher un prix TTC */
const TVA = 1.20;

/* Nombre de produits chargés par catégorie Mobilax (max API : 100) */
const LIMITE_PAR_CATEGORIE = 24;

/* Seuil d'achat HT sous lequel une coque / un verre est vendu 10€ (sinon 15€) */
const SEUIL_PRIX_FIXE_HT = 3;

/* Prix de vente minimum (TTC) pour les produits vendus avec marge */
const PRIX_VENTE_MIN_TTC = 5;

/* Marge des accessoires sans règle dédiée (supports, bracelets, objets pratiques) */
const MARGE_ACCESSOIRES = 0.50;

/* Prix de vente max (TTC) des rayons accessoires et informatique : au-delà,
   article de niche (NAS, serveur…) peu vendable en boutique */
const PRIX_VENTE_MAX_VITRINE = 600;

/* Catégories Mobilax INTERDITES sur la boutique — garde-fou : le proxy
   refuse de démarrer une requête si l'une d'elles se glisse dans la liste blanche */
const CATEGORIES_EXCLUES = new Set([
  6,    // Pièces Détachées (et tous ses enfants)
  260,  // Équipement (outillage, machines)
  1149, // E-Mobility (trottinettes)
  1077, // Magasin
]);

/* Liste blanche : seules ces catégories Mobilax sont interrogées.
   IDs de PRODUCTION (différents de la preprod) ; un categoryId parent inclut
   ses sous-catégories. Vérifier le stock par ID : /api/mobilax?action=compter&ids=… */
const CATEGORIES_SITE = [
  { categorie: 'protection', emoji: '🛡️', ids: [54],                    regle: { type: 'fixe' } },               // Protection › Verre Trempé
  { categorie: 'coque',      emoji: '🎨', ids: [409],                   regle: { type: 'fixe' } },               // Protection › Coques
  { categorie: 'audio',      emoji: '🎧', ids: [139],                   regle: { type: 'marge', taux: 0.50 } },  // Accessoires Audio (écouteurs, casques, adaptateurs jack)
  { categorie: 'cable',      emoji: '🔗', ids: [424, 425],              regle: { type: 'marge', taux: 0.80 } },  // Câbles, Adaptateurs
  { categorie: 'chargeur',   emoji: '⚡', ids: [426, 131, 1122, 2089],   regle: { type: 'marge', taux: 0.60 } },  // Secteur, Sans fil, Power Bank, Voiture
  { categorie: 'accessoire', emoji: '🔧', ids: [1984, 2077, 1121, 1993, 2076], regle: { type: 'marge', taux: MARGE_ACCESSOIRES }, prixMax: PRIX_VENTE_MAX_VITRINE }, // Lunettes connectées (en tête : sinon noyées dans Smart gadgets), Support & Confort, Supports voiture, Montres & bracelets, Smart gadgets
  { categorie: 'telephone',  emoji: '📱', ids: [1986, 1988, 2003],       regle: { type: 'marge', taux: 0.25 } },  // Smartphone Neuf, Smartphone Occasion, Téléphone Neuf
  /* Informatique : PAS la racine 204, qui contient 529 pièces détachées PC.
     Marge faible sur le matériel cher (comparé en ligne), forte sur les petits accessoires. */
  { categorie: 'pc',         emoji: '💻', ids: [1997, 377, 2065, 126, 209, 1117, 2118, 2121, 134],
    regle: { type: 'marge', taux: 0.20 },   // Tablette Occasion, Ordinateur Portable, Moniteur Portable
    reglesParId: {
      126:  { type: 'marge', taux: 0.80 },  // Stockage (cartes mémoire, clés USB)
      209:  { type: 'marge', taux: 0.80 },  // Souris & Claviers
      1117: { type: 'marge', taux: 0.80 },  // Câbles informatique
      2118: { type: 'marge', taux: 0.80 },  // Hubs
      2121: { type: 'marge', taux: 0.80 },  // Réseau sans fil
      134:  { type: 'marge', taux: 0.60 },  // Chargeurs PC & MacBook
    }, prixMax: PRIX_VENTE_MAX_VITRINE },
];

/* Prix d'achat HT minimum crédible par catégorie Mobilax : en dessous, le prix
   est jugé aberrant (erreur de saisie, donnée de test) et le produit est masqué
   plutôt que vendu à perte. Ex : Redmi Note 7 à 16 € HT en preprod. */
const PRIX_ACHAT_MIN_HT = {
  1986: 40, // Smartphone Neuf
  1988: 40, // Smartphone Occasion
  2003: 10, // Téléphone Neuf (portables simples, moins chers)
  1997: 40, // Tablette Occasion
  377:  40, // Ordinateur Portable
};

for (const conf of CATEGORIES_SITE) {
  const interdit = conf.ids.find(id => CATEGORIES_EXCLUES.has(id));
  if (interdit) throw new Error(`Catégorie Mobilax ${interdit} interdite dans la liste blanche`);
}

/* Décalage d'ID pour ne jamais entrer en collision avec le catalogue statique (1–87) */
const ID_OFFSET = 1000000;

/* ---------- Règles de prix de vente ------------------------ */
function calculerPrixVente(prixAchatHT, regle) {
  if (regle.type === 'fixe') {
    return prixAchatHT <= SEUIL_PRIX_FIXE_HT ? 10 : 15;
  }
  /* Marge appliquée sur le coût d'achat (coefficient), puis TVA ; arrondi à l'euro supérieur.
     Plancher : un article à 2 € ne couvre pas le temps de vente et d'emballage */
  return Math.max(PRIX_VENTE_MIN_TTC, Math.ceil(prixAchatHT * (1 + regle.taux) * TVA));
}

/* ---------- Authentification (JWT mis en cache) ------------ */
/* Le cache survit entre invocations tant que l'instance reste chaude,
   ce qui évite de consommer le quota /auth (10 req/min). */
let tokenCache = { token: null, expireAt: 0 };

function dureeEnMs(expireIn) {
  const m = /^(\d+)\s*([smhd])?$/.exec(String(expireIn || '').trim());
  if (!m) return 60 * 60 * 1000;
  const mult = { s: 1e3, m: 6e4, h: 36e5, d: 864e5 }[m[2] || 's'];
  return parseInt(m[1], 10) * mult;
}

async function obtenirToken(forcer = false) {
  if (!forcer && tokenCache.token && Date.now() < tokenCache.expireAt) return tokenCache.token;

  const res = await fetch(`${BASE_URL}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey: process.env.MOBILAX_API_KEY }),
  });
  if (!res.ok) throw new Error(`auth Mobilax HTTP ${res.status}`);

  const json = await res.json();
  /* Marge de sécurité d'une minute avant expiration réelle */
  tokenCache = { token: json.token, expireAt: Date.now() + dureeEnMs(json.expireIn) - 60000 };
  return tokenCache.token;
}

async function appelMobilax(chemin, params = {}, corps = null) {
  const url = new URL(BASE_URL + chemin);
  Object.entries(params).forEach(([k, v]) => v !== undefined && url.searchParams.set(k, v));

  const executer = async (token) => fetch(url, {
    method: corps ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(corps ? { body: JSON.stringify(corps) } : {}),
  });

  let res = await executer(await obtenirToken());
  /* Token expiré côté Mobilax avant notre estimation : on en redemande un */
  if (res.status === 401) res = await executer(await obtenirToken(true));
  if (!res.ok) throw new Error(`Mobilax ${chemin} HTTP ${res.status}`);
  return res.json();
}

/* ---------- Construction du catalogue ---------------------- */
function versProduitSite(p, conf, regle = conf.regle) {
  return {
    id: ID_OFFSET + p.id,
    mobilaxId: p.id,
    nom: p.short_name || p.name,
    categorie: conf.categorie,
    marque: '',
    emoji: conf.emoji,
    prix: calculerPrixVente(Number(p.price) || 0, regle),
    badge: null,
    grade: null,
    neuf: true,
    description: p.name,
    image: p.main_image && p.main_image.image_id
      ? `${ASSETS_URL}/images/products/id-image/${p.main_image.image_id}?size=sm`
      : null,
    disponible: Number(p.quantity) > 0,
    /* Quantité Mobilax : sert aux indicateurs « Stock limité » / « Rupture » */
    stock: Math.max(0, Math.floor(Number(p.quantity) || 0)),
    source: 'mobilax',
  };
}

async function chargerCatalogue() {
  const resultats = await Promise.allSettled(CATEGORIES_SITE.map(async (conf) => {
    /* Une sous-catégorie en échec ne fait pas tomber les autres de la même famille */
    const lots = await Promise.allSettled(conf.ids.map(categoryId =>
      appelMobilax('/products/search', {
        categoryId,
        inStock: 'true',
        limit: LIMITE_PAR_CATEGORIE,
        id_lang: 1,
      })
    ));
    return lots.flatMap((l, i) => {
      if (l.status !== 'fulfilled') return [];
      const plancher = PRIX_ACHAT_MIN_HT[conf.ids[i]] || 0.01;
      return ((l.value.data && l.value.data.products) || [])
        .filter(p => Number(p.price) >= plancher)
        .map(p => versProduitSite(p, conf, (conf.reglesParId && conf.reglesParId[conf.ids[i]]) || conf.regle))
        /* Vitrine ciblée : un NAS à 685 € ne se vend pas en boutique de quartier */
        .filter(p => !conf.prixMax || p.prix <= conf.prixMax);
    });
  }));

  const produits = [];
  const categoriesChargees = [];
  /* Une recherche texte peut remonter le même produit dans deux catégories :
     la première (ordre de CATEGORIES_SITE) l'emporte */
  const vus = new Set();
  resultats.forEach((r, i) => {
    if (r.status === 'fulfilled' && r.value.length) {
      produits.push(...r.value.filter(p => !vus.has(p.id) && vus.add(p.id)));
      categoriesChargees.push(CATEGORIES_SITE[i].categorie);
    }
  });
  return { produits, categoriesChargees };
}

/* ---------- Handler Vercel --------------------------------- */
module.exports = async (req, res) => {
  const action = (req.query && req.query.action) || 'catalogue';
  const methodeAttendue = action === 'check-stock' ? 'POST' : 'GET';

  if (req.method !== methodeAttendue) {
    res.setHeader('Allow', methodeAttendue);
    return res.status(405).json({ status: 'ERROR', message: 'Méthode non autorisée' });
  }
  if (!process.env.MOBILAX_API_KEY) {
    return res.status(503).json({ status: 'ERROR', message: 'API Mobilax non configurée' });
  }

  try {
    if (action === 'check-stock') {
      /* Corps : { items: [{ id, qty }] } avec les IDs du site (décalés de ID_OFFSET).
         Seuls les produits Mobilax sont vérifiés ; le stock boutique n'est pas concerné. */
      const items = (req.body && Array.isArray(req.body.items) ? req.body.items : [])
        .map(it => ({ id: Number(it.id), qty: Math.max(1, Math.floor(Number(it.qty) || 1)) }))
        .filter(it => Number.isInteger(it.id) && it.id > ID_OFFSET)
        .slice(0, 100);
      if (!items.length) return res.status(200).json({ status: 'OK', items: [] });

      const verif = await appelMobilax('/products/check-stock', {}, {
        products: items.map(it => ({ id_product: it.id - ID_OFFSET, quantity: it.qty })),
      });
      const parId = new Map((verif.products || []).map(p => [Number(p.id_product), p]));

      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({
        status: 'OK',
        items: items.map(it => {
          const p = parId.get(it.id - ID_OFFSET);
          const disponible = p ? Number(p.available_quantity) || 0 : 0;
          return { id: it.id, demande: it.qty, disponible, ok: disponible >= it.qty };
        }),
      });
    }

    if (action === 'accessoires') {
      /* Vente additionnelle : coques et verres trempés compatibles avec un modèle
         (ex : ?action=accessoires&modele=Galaxy A17), cherchés chez Mobilax */
      const modele = String(req.query.modele || '').replace(/[^\p{L}\p{N} +]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
      if (modele.length < 3) return res.status(200).json({ status: 'OK', produits: [] });

      const familles = CATEGORIES_SITE.filter(c => c.categorie === 'coque' || c.categorie === 'protection');
      const lots = await Promise.all(familles.map(conf =>
        appelMobilax('/products/search', { categoryId: conf.ids[0], search: modele, inStock: 'true', limit: 1, id_lang: 1 })
          .then(json => ((json.data && json.data.products) || [])
            .filter(p => Number(p.price) > 0)
            .map(p => versProduitSite(p, conf)))
          .catch(() => [])
      ));
      res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=3600');
      return res.status(200).json({ status: 'OK', produits: lots.flat() });
    }

    if (action === 'compter') {
      /* Diagnostic du mapping : nombre de produits en stock par catégorie
         (ex : ?action=compter&ids=54,409). Aucun prix ni donnée sensible. */
      const ids = String(req.query.ids || '').split(',').map(Number)
        .filter(n => Number.isInteger(n) && n > 0 && !CATEGORIES_EXCLUES.has(n)).slice(0, 25);
      const totaux = await Promise.all(ids.map(async categoryId => {
        try {
          const json = await appelMobilax('/products/search', { categoryId, inStock: 'true', limit: 1, id_lang: 1 });
          return [categoryId, (json.data && json.data.total) || 0];
        } catch {
          return [categoryId, null];
        }
      }));
      return res.status(200).json({ status: 'OK', data: Object.fromEntries(totaux) });
    }

    if (action === 'categories') {
      const ref = await appelMobilax('/catalog/categories', { id_lang: 1 });
      return res.status(200).json({ status: 'OK', data: ref.data || [] });
    }

    if (action === 'catalogue') {
      const data = await chargerCatalogue();
      if (!data.produits.length) {
        return res.status(502).json({ status: 'ERROR', message: 'Catalogue Mobilax vide' });
      }
      /* Cache CDN 10 min : protège le quota Mobilax (30 req/min sur /products) */
      res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=3600');
      return res.status(200).json({ status: 'OK', ...data });
    }

    return res.status(400).json({ status: 'ERROR', message: 'Action inconnue' });
  } catch (err) {
    /* Détail technique côté logs uniquement, jamais la clé ni le token */
    console.error('[mobilax]', err.message);
    return res.status(502).json({ status: 'ERROR', message: 'API Mobilax indisponible' });
  }
};
