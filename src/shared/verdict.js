/**
 * L'échelle unique du verdict d'un geste.
 *
 * ## Pourquoi un module, et pourquoi ici
 *
 * Le même geste ne recevait pas le même mot selon l'écran. Le Virage coupait
 * à 0,9 / 0,7 / 0,4, strictement au-dessus ; la salle de répétition à 0,95 /
 * 0,8 / 0,6 / 0,3, bornes comprises, avec d'autres mots ; le duel reprenait
 * 90 et 70 en pourcentage arrondi pour un son et une onde. Un 0,92 était
 * PARFAIT dans la tribune et TRÈS BIEN à l'entraînement. Et le serveur va
 * compter les PARFAITS — le bilan, la série, le combo du HUD : il lui faut une
 * échelle, et une seule.
 *
 * Décision de Gaël, 3 octobre 2026 (Q3) : **une échelle, quatre mots,
 * partout**. PARFAIT au-dessus de 0,9, BON au-dessus de 0,7, MOYEN au-dessus
 * de 0,4, RATÉ en dessous. Les seuils ne se règlent pas : ils sont dessinés
 * (`reglages-smoke` refuse qu'ils entrent au registre).
 *
 * `src/shared/` et rien d'autre : ce module n'importe rien, ne lit ni base ni
 * réglage ni `window`, et se charge des deux côtés. Le serveur le lit pour
 * nommer le verdict qu'il sert (`CONTRATS.md`, § 16.1) ; **aucune page n'écrit
 * un seuil** — elle lit le mot servi. Une page qui importerait ce module pour
 * recalculer le mot à partir de `quality` referait exactement la faute que le
 * module corrige : `quality` est la note après les modificateurs, et le
 * verdict ne se mesure pas sur elle (voir `noteDuVerdict`).
 *
 * ## Strictement « au-dessus de »
 *
 * Comme `perfectBonus` dans `src/server/ferveur/gestures.js` et comme l'écran
 * du Virage l'a toujours fait : 0,9 tout juste est BON, 0,4 tout juste est
 * RATÉ. `verdict` du contrat, les tests de bornes et la page disent la même
 * chose.
 */

/** Les quatre mots, du meilleur au pire. Liste fermée (`CONTRATS.md`, § 16.1). */
export const VERDICTS = Object.freeze(['parfait', 'bon', 'moyen', 'rate']);

/** Les seuils, « au-dessus de ». Dessinés, pas réglables. */
export const SEUILS = Object.freeze({ parfait: 0.9, bon: 0.7, moyen: 0.4 });

/**
 * Le Cri du Fanzzy : au-dessus de 0,95. **Une récompense, pas un verdict** —
 * il ne fait pas un cinquième mot, il part en plus d'un PARFAIT très net. Le
 * serveur le sert en drapeau (`cri: true`, § 16.2) pour qu'aucune page ne
 * garde ce seuil-là non plus.
 */
export const SEUIL_CRI = 0.95;

/** Une note lisible, ou -Infinity : jamais `NaN` dans une comparaison. */
function lire(q) {
  const n = Number(q);
  return Number.isNaN(n) ? -Infinity : n;
}

/**
 * Le mot d'une note.
 *
 * Une note hors de 0–1 ne lève pas : certains gestes notent jusqu'à 1,2
 * (`grade`), et une note au-delà est simplement PARFAIT. Une note illisible
 * (`undefined`, `NaN`, un texte) est RATÉE — un geste dont on ne sait rien ne
 * se fête pas, et une fonction qui lève au milieu d'un chant ferait perdre le
 * chant entier pour un mot.
 *
 * @param {number} q  la note mesurée (`noteDuVerdict`)
 * @returns {'parfait'|'bon'|'moyen'|'rate'}
 */
export function verdictDe(q) {
  const n = lire(q);
  if (n > SEUILS.parfait) return 'parfait';
  if (n > SEUILS.bon) return 'bon';
  if (n > SEUILS.moyen) return 'moyen';
  return 'rate';
}

/** Vrai si la note est un PARFAIT. Ce qui compte les PARFAITS et la série lit ceci. */
export const estParfait = (q) => verdictDe(q) === 'parfait';

/** Vrai si la note fait partir le Cri du Fanzzy (`SEUIL_CRI`, strictement). */
export const criDe = (q) => lire(q) > SEUIL_CRI;

/**
 * Le verdict `v` atteint-il au moins `palier` ?
 *
 * Le plancher de ferveur du Virage (Q4) s'écrit ainsi : un chant accepté
 * « noté au moins MOYEN » rapporte au moins 1 — `auMoins(verdict, 'moyen')`.
 * Un mot hors de la liste n'atteint rien.
 */
export function auMoins(v, palier) {
  const i = VERDICTS.indexOf(v);
  const j = VERDICTS.indexOf(palier);
  if (j < 0) throw new Error(`verdict : palier « ${palier} » hors de la liste (${VERDICTS.join(', ')})`);
  return i >= 0 && i <= j;
}

/**
 * La note que le verdict mesure.
 *
 * **La note brute du geste** — celle que `grade` tire des instants de frappe
 * —, **relevée par le plancher** quand une carte en pose un et qu'il a mordu
 * (« Second souffle » : un raté compte comme moyen), **avant les
 * modificateurs du Fanzzy** (`applyHeroMods`, `perfectBonus`).
 *
 * Pourquoi pas la note finale, que le serveur sert dans `quality` : un Fanzzy
 * qui paie mal le parfait (`perfectBonus` 0,82) faisait d'un 0,95 un 0,779, et
 * l'écran écrivait BON sur un geste que le moteur venait de juger parfait
 * (contre-expertise du 3 octobre 2026, D7). Mesuré ici, le PARFAIT affiché et
 * le « geste parfait » que les modificateurs récompensent sont le même fait.
 *
 * L'ordre des opérations diffère d'une arène à l'autre, et la règle n'en
 * dépend pas : au Virage le plancher se pose après les modificateurs, au duel
 * avant ; dans les deux cas, la note mesurée est la note brute, ou la valeur
 * du plancher si le plancher a mordu et qu'elle est plus haute.
 *
 * Elle rend toujours un nombre fini ≥ 0 : c'est elle qu'on écrit en
 * millièmes dans `virage_presence.meilleur_q`, et un `NaN` ou un négatif n'y
 * a pas sa place. Une note illisible vaut 0.
 *
 * @param {number} brut      la note de `grade`, avant tout modificateur
 * @param {number|null} plancher  la valeur du plancher **s'il a mordu sur ce
 *                           geste** (sa charge consommée), sinon `null`
 */
export function noteDuVerdict(brut, plancher = null) {
  const fini = (x) => { const n = Number(x); return Number.isFinite(n) ? Math.max(0, n) : 0; };
  return plancher == null ? fini(brut) : Math.max(fini(brut), fini(plancher));
}
