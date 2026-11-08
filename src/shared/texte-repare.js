/**
 * Un nom abîmé par l'API, remis d'aplomb.
 *
 * API-Football renvoie parfois un nom dont l'UTF-8 a été relu en latin-1 en
 * amont : « Dani MartÃ­nez » au lieu de « Dani Martínez » (fiche
 * Atlético – Barcelone, capture de Gaël du 8 novembre 2026). Le « Ã » suivi
 * d'un caractère de la plage 0x80–0xBF est la signature de cette faute : un
 * vrai nom ne l'écrit jamais.
 *
 * On relit alors la chaîne comme les octets qu'elle aurait dû être. On ne
 * touche à rien d'autre : une chaîne qui porte un caractère au-delà de
 * latin-1 (« Szczęsny ») n'a pas pu subir cette relecture, et un résultat qui
 * contient un caractère de remplacement veut dire qu'on s'est trompé.
 */
const SIGNATURE = /[Â-ô][\u0080-¿]/;

export function reparerTexte(s) {
  if (typeof s !== 'string' || !SIGNATURE.test(s)) return s;
  // eslint-disable-next-line no-control-regex
  if (/[^\u0000-ÿ]/.test(s)) return s;
  const neuf = Buffer.from(s, 'latin1').toString('utf8');
  return neuf.includes('�') ? s : neuf;
}
