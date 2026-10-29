/* ============================================================
   i-Mobile Service — Les offres de la semaine
   GET  /api/offres-semaine        → public : offres en cours (3 à 5), prêtes à afficher
   GET  /api/offres-semaine?admin=1 → admin : sélection complète (dates, inactifs…)
   POST /api/offres-semaine        → admin uniquement : { offres: [...] }
   ============================================================ */

const { lireOffres, ecrireOffres, offresPubliques, maintenantParis } = require('./_lib/offresSemaine');
const { sessionAdminValide } = require('./_lib/session');

module.exports = async (req, res) => {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(503).json({ status: 'ERROR', message: 'Stockage non configuré' });
  }
  const admin = sessionAdminValide(req);

  try {
    if (req.method === 'GET') {
      if (req.query && req.query.admin) {
        if (!admin) return res.status(401).json({ status: 'ERROR', message: 'Session admin requise' });
        res.setHeader('Cache-Control', 'no-store');
        return res.status(200).json({ status: 'OK', ...(await lireOffres()), maintenant: maintenantParis() });
      }
      /* Cache court : les dates de début / fin sont prises en compte en moins de 2 minutes */
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
      return res.status(200).json({ status: 'OK', offres: await offresPubliques() });
    }

    if (req.method === 'POST') {
      if (!admin) return res.status(401).json({ status: 'ERROR', message: 'Session admin requise' });
      const valeur = await ecrireOffres((req.body || {}).offres);
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ status: 'OK', ...valeur });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ status: 'ERROR', message: 'Méthode non autorisée' });
  } catch (err) {
    /* Erreurs de validation renvoyées telles quelles à l'admin ; aucune donnée client ici */
    const validation = /invalide|maximum|minimum|Au moins|deux fois|après/.test(err.message);
    if (!validation) console.error('[offres-semaine]', err.message);
    return res.status(validation ? 400 : 502).json({ status: 'ERROR', message: validation ? err.message : 'Offres indisponibles' });
  }
};
