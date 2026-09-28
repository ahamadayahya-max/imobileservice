/* ============================================================
   Vérification de la session admin côté fonctions Node.
   Même cookie signé que middleware.js / admin-auth.js : clé HMAC
   dérivée de ADMIN_PASSWORD, format « <expiration>.<signature hex> ».
   ============================================================ */

const crypto = require('crypto');

function signer(exp, motDePasse) {
  return crypto.createHmac('sha256', 'ims-admin-session:' + motDePasse).update(String(exp)).digest('hex');
}

function sessionAdminValide(req) {
  const motDePasse = (process.env.ADMIN_PASSWORD || '').trim();
  if (!motDePasse) return false;

  const m = /(?:^|;\s*)ims_admin=(\d+)\.([a-f0-9]{64})/.exec(String(req.headers.cookie || ''));
  if (!m) return false;
  if (Number(m[1]) * 1000 < Date.now()) return false;

  const attendu = Buffer.from(signer(m[1], motDePasse), 'hex');
  const recu = Buffer.from(m[2], 'hex');
  return attendu.length === recu.length && crypto.timingSafeEqual(attendu, recu);
}

module.exports = { signer, sessionAdminValide };
