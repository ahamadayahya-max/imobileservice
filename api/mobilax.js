/* ============================================================
   i-Mobile Service — Proxy sécurisé API Mobilax (Vercel Function)
   La clé MOBILAX_API_KEY ne quitte jamais le serveur. Les prix
   d'achat Mobilax sont convertis en prix de vente ICI, pour que
   le navigateur ne voie jamais nos coûts d'achat.

   GET /api/mobilax?action=catalogue   → produits au format CATALOGUE
   GET /api/mobilax?action=categories  → référentiel catégories (debug mapping)
   ============================================================ */

/* Preprod par défaut ; passer MOBILAX_BASE_URL en prod le jour venu */
const BASE_URL = process.env.MOBILAX_BASE_URL || 'https://apiv2.mobilax.pro/v1.0/external';

/* TVA appliquée au prix d'achat HT avant d'afficher un prix TTC */
const TVA = 1.20;

/* Nombre de produits chargés par catégorie (max API : 100) */
const LIMITE_PAR_CATEGORIE = 24;

/* Seuil d'achat HT sous lequel une coque / un verre est vendu 10€ (sinon 15€) */
const SEUIL_PRIX_FIXE_HT = 3;

/* Catégories du site → recherche Mobilax.
   `motifCategorie` sert à retrouver l'ID dans /catalog/categories ;
   à défaut on se rabat sur une recherche texte `search`. */
const CATEGORIES_SITE = [
  { categorie: 'coque',      emoji: '🎨', motifCategorie: /coque|housse|etui/i,               search: 'coque',        regle: { type: 'fixe' } },
  { categorie: 'protection', emoji: '🛡️', motifCategorie: /verre|protection|film/i,           search: 'verre trempe', regle: { type: 'fixe' } },
  { categorie: 'cable',      emoji: '🔗', motifCategorie: /c[aâ]ble/i,                         search: 'cable',        regle: { type: 'marge', taux: 0.80 } },
  { categorie: 'chargeur',   emoji: '⚡', motifCategorie: /chargeur|alimentation/i,            search: 'chargeur',     regle: { type: 'marge', taux: 0.60 } },
  { categorie: 'audio',      emoji: '🎧', motifCategorie: /audio|[ée]couteur|casque|enceinte/i, search: 'ecouteurs',    regle: { type: 'marge', taux: 0.50 } },
  { categorie: 'telephone',  emoji: '📱', motifCategorie: /t[ée]l[ée]phone|smartphone/i,       search: 'smartphone',   regle: { type: 'marge', taux: 0.25 } },
  { categorie: 'pc',         emoji: '💻', motifCategorie: /ordinateur|pc portable|tablette/i,  search: 'tablette',     regle: { type: 'marge', taux: 0.20 } },
];

/* Décalage d'ID pour ne jamais entrer en collision avec le catalogue statique (1–87) */
const ID_OFFSET = 1000000;

/* ---------- Règles de prix de vente ------------------------ */
function calculerPrixVente(prixAchatHT, regle) {
  if (regle.type === 'fixe') {
    return prixAchatHT <= SEUIL_PRIX_FIXE_HT ? 10 : 15;
  }
  /* Marge appliquée sur le coût d'achat (coefficient), puis TVA ; arrondi à l'euro supérieur */
  return Math.ceil(prixAchatHT * (1 + regle.taux) * TVA);
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

async function appelMobilax(chemin, params = {}) {
  const url = new URL(BASE_URL + chemin);
  Object.entries(params).forEach(([k, v]) => v !== undefined && url.searchParams.set(k, v));

  const executer = async (token) => fetch(url, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });

  let res = await executer(await obtenirToken());
  /* Token expiré côté Mobilax avant notre estimation : on en redemande un */
  if (res.status === 401) res = await executer(await obtenirToken(true));
  if (!res.ok) throw new Error(`Mobilax ${chemin} HTTP ${res.status}`);
  return res.json();
}

/* ---------- Construction du catalogue ---------------------- */
function versProduitSite(p, conf) {
  return {
    id: ID_OFFSET + p.id,
    mobilaxId: p.id,
    nom: p.short_name || p.name,
    categorie: conf.categorie,
    marque: '',
    emoji: conf.emoji,
    prix: calculerPrixVente(Number(p.price) || 0, conf.regle),
    badge: null,
    grade: null,
    neuf: true,
    description: p.name,
    image: p.main_image ? p.main_image.url : null,
    disponible: Number(p.quantity) > 0,
    source: 'mobilax',
  };
}

async function chargerCatalogue() {
  let categoriesMobilax = [];
  try {
    const ref = await appelMobilax('/catalog/categories', { id_lang: 1 });
    categoriesMobilax = Array.isArray(ref.data) ? ref.data : [];
  } catch {
    /* Référentiel indisponible : on continue en recherche texte */
  }

  const resultats = await Promise.allSettled(CATEGORIES_SITE.map(async (conf) => {
    const cat = categoriesMobilax.find(c => conf.motifCategorie.test(c.name || ''));
    const params = {
      inStock: 'true',
      limit: LIMITE_PAR_CATEGORIE,
      id_lang: 1,
      ...(cat ? { categoryId: cat.id } : { search: conf.search }),
    };
    const json = await appelMobilax('/products/search', params);
    const produits = (json.data && json.data.products) || [];
    return produits
      .filter(p => Number(p.price) > 0)
      .map(p => versProduitSite(p, conf));
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
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ status: 'ERROR', message: 'Méthode non autorisée' });
  }
  if (!process.env.MOBILAX_API_KEY) {
    return res.status(503).json({ status: 'ERROR', message: 'API Mobilax non configurée' });
  }

  const action = (req.query && req.query.action) || 'catalogue';

  try {
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
