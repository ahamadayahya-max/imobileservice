/* ============================================================
   i-Mobile Service — Mise en forme d'affichage partagée
   (emails, admin, bon de commande, factures). Le numéro brut reste
   celui enregistré et utilisé dans les liens tel: ; seul l'affichage change.
   ============================================================ */

/* « 0633330643 », « 06.33.33.06.43 » → « 06 33 33 06 43 » ;
   « +33633330643 » → « +33 6 33 33 06 43 ». Autre format : rendu tel quel. */
function formaterTelephone(numero) {
  const brut = String(numero == null ? '' : numero).trim();
  const chiffres = brut.replace(/[\s.\-()]/g, '').replace(/^0033/, '+33');
  if (/^0\d{9}$/.test(chiffres)) return chiffres.replace(/(\d{2})(?=\d)/g, '$1 ');
  if (/^\+33\d{9}$/.test(chiffres)) return '+33 ' + chiffres.slice(3, 4) + ' ' + chiffres.slice(4).replace(/(\d{2})(?=\d)/g, '$1 ');
  return brut;
}
window.formaterTelephone = formaterTelephone;
