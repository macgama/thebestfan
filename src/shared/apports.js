/**
 * **D'où vient ce qu'on porte.**
 *
 * ## Le manque que ce fichier comble
 *
 * Le moteur ne connaît qu'un objet : `mods`, le total. C'est très bien pour
 * jouer — `tempoWindow: 1.5` se multiplie sans savoir d'où viennent ses deux
 * facteurs — et c'est inutilisable pour le dire au joueur. **Un total ne se
 * décompose pas après coup** : de 1,5 on ne retrouve ni le ×1,2 du Choriste ni
 * le ×1,25 des Jumelles, et un écran qui essaierait de deviner écrirait des
 * chiffres faux avec assurance.
 *
 * La ventilation se construit donc **là où les morceaux existent encore** —
 * à l'entrée en tribune et à l'ouverture d'un duel — et voyage avec l'état.
 *
 * ## Pourquoi elle est partagée
 *
 * Deux arènes, la même question. Le Grand Virage et le duel composent déjà les
 * mêmes modificateurs, avec `combine` pour l'équipement et `avecLieu` pour le
 * stade ; en laisser chacun ventiler à sa façon donnerait deux panneaux qui ne
 * nomment pas les mêmes choses, et le joueur apprendrait deux fois.
 *
 * ## Ce qu'elle n'est pas
 *
 * **Pas un calcul.** Rien ici ne décide de quoi que ce soit : chaque entrée
 * porte les modificateurs tels que leur source les déclare, et le total reste
 * celui du moteur, envoyé à côté. Si les deux divergeaient un jour, c'est le
 * total qui aurait raison — et c'est pour ça qu'on ne le recalcule pas ici.
 */
import { STUFF_BY_ID } from './fanzzy/inventaire.js';

/**
 * Ce qui voyage dans `mods` sans être un modificateur.
 *
 * `id` y est posé par le deck pour que le moteur sache quel Fanzzy pousse ;
 * les trois clés de KOP par `modsDe`, pour que l'écran puisse nommer le groupe.
 * Aucune n'a de phrase, et les laisser passer ferait apparaître « kopNom » dans
 * la liste des bonus.
 */
const PAS_DES_MODS = new Set(['id', 'kopId', 'kopNom', 'kopBonus']);

/** Les seuls modificateurs, sans les étiquettes qui les accompagnent. */
export function seulsLesMods(mods) {
  const out = {};
  for (const [k, v] of Object.entries(mods ?? {})) {
    if (!PAS_DES_MODS.has(k)) out[k] = v;
  }
  return out;
}

const garni = (mods) => Object.keys(mods ?? {}).length > 0;

/**
 * La ventilation de ce qu'un joueur porte, source par source.
 *
 * @param {object}   o
 * @param {object}  [o.fanzzy]  `{ nom, mods }` — **ses** modificateurs seuls,
 *   ceux que `loadout` garde sous `modsBase`, et jamais le total.
 * @param {string[]} [o.stuff]  les identifiants des pièces portées.
 * @param {object}  [o.kop]     le total des bonus de groupe, tel que
 *   `kop.modsDe` le rend — étiquettes comprises, elles sont retirées ici.
 * @param {object}  [o.stade]   le lieu de la rencontre.
 * @returns {Array<{quoi:string, nom:string, texte?:string, mods:object}>}
 *   dans l'ordre où on les lit : soi, son sac, son groupe, le lieu.
 */
export function apportsDe({ fanzzy = null, stuff = [], kop = null, stade = null } = {}) {
  const out = [];

  const siens = seulsLesMods(fanzzy?.mods);
  if (fanzzy && garni(siens)) {
    out.push({ quoi: 'fanzzy', nom: fanzzy.nom ?? 'Ton Fanzzy', mods: siens });
  }

  /* Deux pièces au plus, dans l'ordre où elles sont portées. La borne est celle
     de `combine` : au-delà, le moteur les ignore, et une ligne annoncée mais
     non appliquée serait pire que pas de ligne. */
  for (const id of (stuff ?? []).slice(0, 2)) {
    const s = STUFF_BY_ID.get(id);
    /* `id` et `rar` : le Virage accroche ces pièces à côté de son Fanzzy, et
       c'est d'ici qu'il les tient — le même sac que celui qui compte. */
    if (s && garni(s.mods)) out.push({ quoi: 'stuff', id: s.id, rar: s.rar, nom: s.nom, mods: s.mods });
  }

  const duKop = seulsLesMods(kop);
  if (garni(duKop)) {
    out.push({ quoi: 'kop', nom: kop?.kopNom ?? 'Ton KOP', mods: duKop });
  }

  if (garni(stade?.mods)) {
    out.push({ quoi: 'lieu', nom: stade.nom, texte: stade.effet, mods: stade.mods });
  }

  return out;
}
