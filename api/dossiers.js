/* ============================================================
   i-Mobile Service — Commandes et devis (enregistrement serveur)
   POST /api/dossiers?type=commande|devis           → public : le site enregistre
                                                       une commande / un devis
   GET  /api/dossiers?type=commande|devis           → admin : liste complète
   POST /api/dossiers?type=…&action=statut  {cle, statut} → admin
   POST /api/dossiers?type=…&action=supprimer {cle}       → admin
   ============================================================ */

const { TYPES, creerDossier, listerDossiers, changerStatut, supprimerDossier } = require('./_lib/dossiers');
const { sessionAdminValide } = require('./_lib/session');

/* Anti-abus sur l'enregistrement public : 20 dossiers / 10 min par IP (par instance) */
const FENETRE_MS = 10 * 60 * 1000;
const MAX_PAR_FENETRE = 20;
const compteurs = new Map();

function limiteAtteinte(ip) {
  const maintenant = Date.now();
  const c = compteurs.get(ip);
  if (!c || maintenant - c.debut > FENETRE_MS) { compteurs.set(ip, { debut: maintenant, n: 1 }); return false; }
  c.n += 1;
  return c.n > MAX_PAR_FENETRE;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(503).json({ status: 'ERROR', message: 'Stockage non configuré' });
  }

  const type = req.query && req.query.type;
  if (!TYPES[type]) return res.status(400).json({ status: 'ERROR', message: 'Type inconnu' });
  const action = req.query.action || '';
  const admin = sessionAdminValide(req);

  try {
    if (req.method === 'GET') {
      if (!admin) return res.status(401).json({ status: 'ERROR', message: 'Session admin requise' });
      return res.status(200).json({ status: 'OK', statuts: TYPES[type].statuts, dossiers: await listerDossiers(type) });
    }

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return res.status(405).json({ status: 'ERROR', message: 'Méthode non autorisée' });
    }

    const corps = req.body || {};

    if (!action) {
      const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'inconnue';
      if (limiteAtteinte(ip)) return res.status(429).json({ status: 'ERROR', message: 'Trop de demandes, réessayez plus tard' });
      const dossier = await creerDossier(type, corps);
      /* Le visiteur ne reçoit que son numéro, jamais la clé de stockage */
      return res.status(201).json({ status: 'OK', id: dossier.id });
    }

    if (!admin) return res.status(401).json({ status: 'ERROR', message: 'Session admin requise' });
    if (action === 'statut') {
      return res.status(200).json({ status: 'OK', dossier: await changerStatut(type, corps.cle, corps.statut) });
    }
    if (action === 'supprimer') {
      await supprimerDossier(type, corps.cle);
      return res.status(200).json({ status: 'OK' });
    }
    return res.status(400).json({ status: 'ERROR', message: 'Action inconnue' });
  } catch (err) {
    /* Jamais de données client dans les logs : seulement le type d'erreur */
    console.error('[dossiers]', type, action || 'creation', err.message);
    const invalide = /invalides|introuvable/.test(err.message);
    return res.status(invalide ? 400 : 502).json({ status: 'ERROR', message: invalide ? err.message : 'Enregistrement indisponible' });
  }
};
