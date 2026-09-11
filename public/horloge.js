/**
 * L'horloge d'un match en direct.
 *
 * ## Le problème qu'elle résout
 *
 * Le serveur ne parle pas toutes les minutes. Il relève le direct toutes les
 * vingt secondes, garde sa réponse en cache trois quarts de minute, et la page
 * la redemande quand elle y pense. Afficher `elapsed` tel quel, c'est donc
 * afficher une minute qui saute de trois en trois ou reste figée — et le
 * lecteur, lui, regarde un match dont il connaît le rythme.
 *
 * On fait donc **courir le chrono localement** à partir de l'instant où la
 * donnée a été lue chez l'API. Aucun appel réseau, une minute juste.
 *
 * ## Pourquoi un fichier à part
 *
 * Cette règle était écrite **trois fois** : dans le Grand Virage, dans la page
 * des matchs, et dans la fiche d'un match. Trois versions du même calcul, avec
 * déjà trois listes de périodes différentes — celle du virage connaissait les
 * tirs au but, celle des matchs non. Une horloge qui ne dit pas la même chose
 * d'un écran à l'autre est pire qu'une horloge absente : elle fait douter des
 * deux.
 *
 * ## Ce qu'elle refuse de dire
 *
 * Trois silences, et chacun vaut mieux qu'un chiffre faux :
 *
 *   — **le match est fini.** « 90' EN DIRECT » sur une rencontre terminée
 *     depuis dix minutes est le genre de mensonge qu'on repère tout de suite ;
 *   — **la période est arrêtée** — mi-temps, interruption. Le chrono s'affiche
 *     mais cesse de courir ;
 *   — **on n'a plus de nouvelles.** Un match dont le relevé n'a rien dit
 *     depuis un quart d'heure n'est pas un match à la centième minute : c'est
 *     un match dont on ne sait plus rien.
 *
 * Script classique, pas module : comme tout ce qui vit dans `public/`.
 */
(() => {
  /** Périodes où le chrono s'affiche mais ne court plus. */
  const ARRETEES = new Set(['HT', 'BT', 'PST', 'SUSP', 'INT']);

  /** Périodes où il n'y a plus de minute du tout. */
  const FINIES = new Set(['FT', 'AET', 'PEN', 'CANC', 'ABD', 'AWD', 'WO']);

  /**
   * Le terme de chaque période.
   *
   * Au-delà, on est dans le temps additionnel : le chrono s'arrête sur le
   * terme et affiche le supplément quand le relevé le connaît. Sans ces
   * bornes, une première période affichait « 52' » — ce qui n'existe pas.
   */
  const TERME = { '1H': 45, '2H': 90, ET: 120, P: 120 };

  /** Au-delà de ce silence, on ne dit plus rien. */
  const SILENCE_MAX_MS = 12 * 60_000;

  /**
   * L'état de l'horloge, ou `null` quand il n'y a rien à dire.
   *
   * @param {object} m  { statut, minute, extra, vuA } — `vuA` est l'instant où
   *   la donnée a été lue chez l'API, en millisecondes. Sans lui, on prend
   *   maintenant : le chrono ne court pas, mais il ne ment pas non plus.
   * @returns {{n:number, extra:number|null, arret:boolean, terme:boolean}|null}
   */
  function etat(m) {
    if (!m || m.minute == null) return null;
    if (FINIES.has(m.statut)) return null;
    if (ARRETEES.has(m.statut)) {
      return { n: m.minute, extra: null, arret: true, terme: false };
    }

    const vuA = m.vuA ?? Date.now();
    if (Date.now() - vuA > SILENCE_MAX_MS) return null;

    const ecoule = Math.max(0, Math.floor((Date.now() - vuA) / 60_000));
    const brut = m.minute + ecoule;
    const terme = TERME[m.statut];
    if (terme && brut >= terme) {
      return { n: terme, extra: m.extra ?? null, arret: false, terme: true };
    }
    return { n: brut, extra: null, arret: false, terme: false };
  }

  /**
   * Ce qu'on écrit à l'écran.
   *
   * `mots` laisse chaque page nommer les arrêts comme elle le fait déjà : la
   * page des matchs écrit « MT », le virage montre la minute. C'est le seul
   * endroit où les deux divergent, et c'est un choix de vocabulaire — pas une
   * règle de calcul.
   */
  function texte(m, mots = {}) {
    const e = etat(m);
    if (!e) return '';
    if (e.arret && mots[m.statut]) return mots[m.statut];
    if (e.terme) return e.extra != null ? `${e.n}+${e.extra}′` : `${e.n}+′`;
    return `${e.n}′`;
  }

  window.TBF_HORLOGE = { etat, texte, ARRETEES, FINIES, TERME, SILENCE_MAX_MS };
})();
