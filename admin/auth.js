/* ============================================================
   i-Mobile Service — Auth Admin (partagé toutes les pages admin)
   Aucun identifiant ici : la vérification se fait côté serveur
   (/api/admin-auth) et chaque page /admin/* est gardée par middleware.js.
   ============================================================ */

/* Les pages admin ne sont servies qu'avec une session valide (middleware.js) :
   rien à vérifier côté navigateur. Conservée pour les pages qui l'appellent. */
function requireAuth() {
  return true;
}

/* Connexion : renvoie { ok, message?, restant? } */
async function adminLogin(email, password) {
  try {
    const res = await fetch('/api/admin-auth?action=login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ email, password }),
    });
    return await res.json();
  } catch {
    return { ok: false, message: 'Serveur injoignable, réessayez.' };
  }
}

/* Déconnexion : le cookie HttpOnly ne peut être effacé que par le serveur */
async function adminLogout() {
  try {
    await fetch('/api/admin-auth?action=logout', { method: 'POST', credentials: 'same-origin' });
  } finally {
    window.location.replace('login.html');
  }
}

/* Toast partagé */
function adminToast(msg, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  container.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}
