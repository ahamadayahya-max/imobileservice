/* ============================================================
   i-Mobile Service — Garde des pages admin (Vercel Routing Middleware)
   S'exécute AVANT l'envoi de toute page /admin/* : sans cookie de
   session valide (émis par /api/admin-auth), redirection vers la
   connexion. Le contenu admin n'atteint donc jamais un visiteur non connecté.
   ============================================================ */

export const config = { matcher: ['/admin', '/admin/:path*'] };

/* Ressources nécessaires à la page de connexion elle-même */
const PUBLIQUES = new Set(['/admin/login.html', '/admin/login', '/admin/admin.css', '/admin/auth.js']);

async function signer(exp, motDePasse) {
  const cle = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode('ims-admin-session:' + motDePasse),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', cle, new TextEncoder().encode(String(exp)));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function sessionValide(request) {
  const motDePasse = process.env.ADMIN_PASSWORD;
  if (!motDePasse) return false;

  const cookie = request.headers.get('cookie') || '';
  const m = /(?:^|;\s*)ims_admin=(\d+)\.([a-f0-9]{64})/.exec(cookie);
  if (!m) return false;

  const exp = Number(m[1]);
  if (exp * 1000 < Date.now()) return false;
  return (await signer(exp, motDePasse)) === m[2];
}

export default async function middleware(request) {
  const url = new URL(request.url);
  if (PUBLIQUES.has(url.pathname)) return;

  if (await sessionValide(request)) return;

  return Response.redirect(new URL('/admin/login.html', url), 302);
}
