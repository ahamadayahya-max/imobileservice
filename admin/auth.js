/* ============================================================
   i-Mobile Service — Auth Admin (partagé toutes les pages admin)
   ============================================================ */

const ADMIN_EMAIL    = 'admin@imobileservice.fr';
const ADMIN_PWD_B64  = 'aU1vYmlsZTIwMjYh'; /* btoa('iMobile2026!') */
const SESSION_KEY    = 'ims_admin_token';
const EXPIRY_KEY     = 'ims_admin_expiry';
const SESSION_MS     = 8 * 60 * 60 * 1000; /* 8 heures */
const LOCK_KEY       = 'ims_admin_lock';
const ATTEMPT_KEY    = 'ims_admin_attempts';

/* Vérifier si la session est valide */
function isAdminLoggedIn() {
  const token  = sessionStorage.getItem(SESSION_KEY);
  const expiry = sessionStorage.getItem(EXPIRY_KEY);
  if (!token || !expiry) return false;
  if (Date.now() > parseInt(expiry)) {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(EXPIRY_KEY);
    return false;
  }
  return true;
}

/* Rediriger vers login si non connecté */
function requireAuth() {
  if (!isAdminLoggedIn()) {
    window.location.replace('login.html');
    return false;
  }
  return true;
}

/* Créer une session */
function createSession() {
  const token = Array.from(crypto.getRandomValues(new Uint8Array(24)))
    .map(b => b.toString(16).padStart(2, '0')).join('');
  sessionStorage.setItem(SESSION_KEY, token);
  sessionStorage.setItem(EXPIRY_KEY, String(Date.now() + SESSION_MS));
}

/* Déconnexion */
function adminLogout() {
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(EXPIRY_KEY);
  window.location.replace('login.html');
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

/* Vérifier le blocage (3 tentatives → 5 min) */
function isLocked() {
  const lockUntil = parseInt(localStorage.getItem(LOCK_KEY) || '0');
  return Date.now() < lockUntil;
}

function getLockRemaining() {
  const lockUntil = parseInt(localStorage.getItem(LOCK_KEY) || '0');
  return Math.ceil((lockUntil - Date.now()) / 1000);
}

function recordFailedAttempt() {
  let attempts = parseInt(localStorage.getItem(ATTEMPT_KEY) || '0') + 1;
  localStorage.setItem(ATTEMPT_KEY, String(attempts));
  if (attempts >= 3) {
    localStorage.setItem(LOCK_KEY, String(Date.now() + 5 * 60 * 1000));
    localStorage.setItem(ATTEMPT_KEY, '0');
  }
}

function clearAttempts() {
  localStorage.removeItem(LOCK_KEY);
  localStorage.removeItem(ATTEMPT_KEY);
}
