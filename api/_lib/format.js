/* Mise en forme d'affichage côté serveur — même règle que js/format.js.
   « 0633330643 » → « 06 33 33 06 43 » ; « +33633330643 » → « +33 6 33 33 06 43 ». */
function formaterTelephone(numero) {
  const brut = String(numero == null ? '' : numero).trim();
  const chiffres = brut.replace(/[\s.\-()]/g, '').replace(/^0033/, '+33');
  if (/^0\d{9}$/.test(chiffres)) return chiffres.replace(/(\d{2})(?=\d)/g, '$1 ');
  if (/^\+33\d{9}$/.test(chiffres)) return '+33 ' + chiffres.slice(3, 4) + ' ' + chiffres.slice(4).replace(/(\d{2})(?=\d)/g, '$1 ');
  return brut;
}

module.exports = { formaterTelephone };
