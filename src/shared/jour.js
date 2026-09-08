/**
 * Une date de calendrier, en `AAAA-MM-JJ`.
 *
 * Ce fichier existe à cause d'une comparaison qui a l'air juste :
 *
 * ```js
 * const jour = String(f.jour).slice(0, 10);      // colonne DATE
 * const auj  = String(f.aujourdhui).slice(0, 10);
 * if (jour < auj) …                              // « match passé »
 * ```
 *
 * Le pilote mysql2 rend une colonne `DATE` sous forme d'objet `Date`, pas de
 * chaîne. `String(date)` donne donc `"Fri Sep 11 2026 00:00:00 GMT+0200…"` :
 * les dix premiers caractères sont **le nom du jour de la semaine**, pas la
 * date. La comparaison compare alors `"Fri Sep 11"` à `"Tue Sep 08"`, et comme
 * `F` vient avant `T`, un match dans trois jours est déclaré passé.
 *
 * Le pire est que ça marche la plupart du temps : il faut que les deux dates
 * tombent sur des jours de semaine mal ordonnés alphabétiquement pour que la
 * faute apparaisse. Elle est restée invisible jusqu'à un mardi de septembre
 * 2026, où « dans trois jours » tombait un vendredi.
 *
 * On lit donc les composantes de la date au lieu de son affichage.
 */

const deuxChiffres = (n) => String(n).padStart(2, '0');

/**
 * Normalise en `AAAA-MM-JJ` ce qui sort de la base ou du code.
 *
 * Accepte un `Date`, une chaîne `AAAA-MM-JJ…`, `null`. Renvoie `null` si la
 * valeur ne dit rien — un `null` se compare mal, mais une date fausse se
 * compare *silencieusement*, ce qui est pire.
 *
 * Les composantes sont lues en heure locale, pas en UTC : mysql2 construit une
 * colonne `DATE` comme minuit local. Passer par UTC reculerait la date d'un
 * jour à l'est de Greenwich — la faute qu'on vient de corriger, dans l'autre
 * sens.
 */
export function jourISO(valeur) {
  if (valeur == null) return null;
  if (valeur instanceof Date) {
    if (Number.isNaN(valeur.getTime())) return null;
    return `${valeur.getFullYear()}-${deuxChiffres(valeur.getMonth() + 1)}`
      + `-${deuxChiffres(valeur.getDate())}`;
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(valeur));
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}
