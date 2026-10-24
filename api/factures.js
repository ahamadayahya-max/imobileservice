/* ============================================================
   i-Mobile Service — Factures automatiques (paiements carte), admin uniquement
   GET /api/factures                 → liste des factures FC-…
   GET /api/factures?pdf=FC-2026-0001 → le PDF (téléchargement)
   ============================================================ */

const { listerFactures, lirePdf } = require('./_lib/facturesServeur');
const { sessionAdminValide } = require('./_lib/session');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ status: 'ERROR', message: 'Méthode non autorisée' });
  }
  if (!sessionAdminValide(req)) return res.status(401).json({ status: 'ERROR', message: 'Session admin requise' });

  try {
    const numero = req.query && req.query.pdf;
    if (numero) {
      const pdf = await lirePdf(String(numero));
      if (!pdf) return res.status(404).json({ status: 'ERROR', message: 'Facture introuvable' });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="Facture-${numero}.pdf"`);
      return res.status(200).send(pdf);
    }
    return res.status(200).json({ status: 'OK', factures: await listerFactures() });
  } catch (err) {
    console.error('[factures]', err.message);
    return res.status(502).json({ status: 'ERROR', message: 'Factures indisponibles' });
  }
};
