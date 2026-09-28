/* ============================================================
   i-Mobile Service — Authentification admin côté serveur
   Le mot de passe n'est plus dans le code du site : il vit dans la
   variable d'environnement Vercel ADMIN_PASSWORD (jamais envoyée au navigateur).

   POST /api/admin-auth?action=login   { email, password } → cookie de session
   POST /api/admin-auth?action=logout                      → efface le cookie

   Le cookie est signé (HMAC) avec une clé dérivée du mot de passe :
   changer ADMIN_PASSWORD déconnecte donc toutes les sessions ouvertes.
   La vérification des pages /admin/* se fait dans middleware.js.
   ============================================================ */

const crypto = require('crypto');

const COOKIE = 'ims_admin';
const DUREE_SESSION_S = 8 * 60 * 60;
/* Emails acceptés (séparés par des virgules dans ADMIN_EMAIL) : l'adresse admin
   historique et l'email de la boutique, pour éviter les refus par simple confusion */
const EMAILS_ADMIN = (process.env.ADMIN_EMAIL || 'admin@imobileservice.fr,ims.tlse@gmail.com')
  .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

/* Anti force brute : 5 échecs par IP → blocage 15 min (par instance, best effort) */
const MAX_ECHECS = 5;
const BLOCAGE_MS = 15 * 60 * 1000;
const echecs = new Map();

function signer(exp, motDePasse) {
  return crypto.createHmac('sha256', 'ims-admin-session:' + motDePasse).update(String(exp)).digest('hex');
}

/* Comparaison à temps constant : ne révèle pas la longueur commune */
function egal(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function ipDe(req) {
  return String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'inconnue';
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, message: 'Méthode non autorisée' });
  }

  const action = req.query && req.query.action;

  if (action === 'logout') {
    res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
    return res.status(200).json({ ok: true });
  }

  if (action !== 'login') return res.status(400).json({ ok: false, message: 'Action inconnue' });

  /* trim : un espace ou retour à la ligne collé dans Vercel ne doit pas bloquer l'accès */
  const motDePasse = (process.env.ADMIN_PASSWORD || '').trim();
  if (!motDePasse) {
    return res.status(503).json({ ok: false, message: "Connexion admin non configurée (ADMIN_PASSWORD manquant sur Vercel)" });
  }

  const ip = ipDe(req);
  const etat = echecs.get(ip);
  if (etat && etat.jusqua > Date.now()) {
    const min = Math.ceil((etat.jusqua - Date.now()) / 60000);
    return res.status(429).json({ ok: false, message: `Trop de tentatives. Réessayez dans ${min} min.` });
  }

  const corps = req.body || {};
  const email = String(corps.email || '').trim().toLowerCase();
  const password = String(corps.password || '').trim();

  /* Délai fixe pour ralentir les essais automatisés */
  await new Promise(r => setTimeout(r, 500));

  const emailOk = EMAILS_ADMIN.reduce((ok, e) => ok | egal(email, e), 0);
  const ok = emailOk & egal(password, motDePasse);
  if (!ok) {
    const n = (etat && etat.jusqua <= Date.now() ? 0 : (etat ? etat.n : 0)) + 1;
    echecs.set(ip, n >= MAX_ECHECS ? { n: 0, jusqua: Date.now() + BLOCAGE_MS } : { n, jusqua: 0 });
    return res.status(401).json({ ok: false, message: 'Identifiants incorrects', restant: Math.max(0, MAX_ECHECS - n) });
  }

  echecs.delete(ip);
  const exp = Math.floor(Date.now() / 1000) + DUREE_SESSION_S;
  const jeton = `${exp}.${signer(exp, motDePasse)}`;
  res.setHeader('Set-Cookie', `${COOKIE}=${jeton}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${DUREE_SESSION_S}`);
  return res.status(200).json({ ok: true });
};
