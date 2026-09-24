import { racineDe, auStade, parIdentifiant } from './catalogue.js';
import { stadeAffiche } from '../../shared/fanzzy/ages.js';

/**
 * **L'avatar d'un joueur — la seule réponse du jeu à « qui montrer ».**
 *
 * ## Pourquoi elle existe
 *
 * La question se posait à six endroits : l'accueil, « Mon Fanzzy », la
 * page des matchs, le duel, le Virage, la liste d'amis. Chacun la résolvait
 * lui-même, à partir de ce qu'il recevait, et chacun avait appris les
 * dimensions pour lesquelles on l'avait corrigé — l'âge ici, la tenue là,
 * l'expression à un seul endroit. Chaque dimension ajoutée devait l'être six
 * fois, on en oubliait à chaque fois une ou deux, et le joueur l'apprenait
 * en capture d'écran. Le même défaut a été corrigé écran par écran
 * pendant une semaine sans jamais disparaître, parce qu'on corrigeait les
 * copies et jamais le fait qu'il y en ait.
 *
 * Ici, la réponse est **calculée une fois, complète**, et les écrans ne font
 * plus que la dessiner. Ajouter une dimension, c'est l'ajouter ici ; un
 * écran qui l'ignorerait n'a plus rien à ignorer, il reçoit l'objet entier.
 *
 * ## Pourquoi plusieurs joueurs à la fois
 *
 * Le portefeuille n'en demande qu'un — le sien. La liste d'amis en demande
 * quarante, et c'est elle qui avait gardé sa propre recette (`ageDe`) : l'âge,
 * sans la tenue ni l'expression. Une version « un joueur » à côté d'une
 * version « une liste » aurait été une septième copie. Il n'y en a donc
 * qu'une, qui lit par lots ; `construireAvatar` lui passe une liste d'un.
 *
 * ## Ce qu'elle rend
 *
 * Pour chaque joueur, deux formes du même personnage :
 *
 *   - `avatar` — ce qu'il a choisi sur la fiche : l'âge (borné par l'âge
 *     atteint), la tenue portée à cet âge, l'expression. C'est ce que
 *     voient l'accueil, « Mon Fanzzy », la page des matchs, les amis.
 *   - `enJeu` — le même, tel qu'il entre sur le terrain : **premier âge, au
 *     repos, dans sa tenue du premier âge**. C'est la règle des effets —
 *     « un deck entre toujours au premier âge » — et le dessin la suit.
 *     L'expression, en partie, c'est le match qui la décide.
 *
 * Chacune porte `id` (la lignée, sous laquelle sont rangés les états) et
 * `age` (la carte du catalogue, sous laquelle est rangé le plein-pied).
 * Les confondre a déjà affiché le Choriste sous le nom du Meneur de chant.
 *
 * @param {Function} q  `(sql, params) => rows`, celui du module appelant.
 * @param {Array<{userId, active_fanzzy, active_evo, active_etat}>} lignes
 *   les lignes de portefeuille, déjà lues par l'appelant.
 * @returns {Promise<Map<string, {avatar, enJeu}>>} une entrée par joueur qui a
 *   un personnage ; les autres n'y sont pas.
 */
export async function avatarsDe(q, lignes) {
  const qui = [];
  for (const l of lignes ?? []) {
    if (!l?.userId || !l.active_fanzzy) continue;
    /* La **lignée**, et non `active_fanzzy` tel quel : une base d'avant le
       repliage des âges y garde « TR32B », et une jointure sur ce nom-là ne
       trouve rien. La liste d'amis joignait justement sur ce nom-là. */
    qui.push({ ...l, id: racineDe(l.active_fanzzy) });
  }
  const res = new Map();
  if (!qui.length) return res;

  const users = [...new Set(qui.map((l) => l.userId))];
  const ids = [...new Set(qui.map((l) => l.id))];
  const cle = (u, id, evo = '') => `${u}|${id}|${evo}`;

  const atteints = new Map();
  for (const r of await q(
    `SELECT user_id, fanzzy_id, stage FROM user_fanzzy
      WHERE user_id IN (${users.map(() => '?').join(',')})
        AND fanzzy_id IN (${ids.map(() => '?').join(',')})`,
    [...users, ...ids])) {
    atteints.set(cle(r.user_id, r.fanzzy_id), Number(r.stage) || 1);
  }

  /* **Une table absente ne fait pas disparaître le personnage.** C'est la
     posture de tout le module fanzzy — `estAbonne` la tient déjà — et elle
     n'est pas théorique : le banc du Grand Virage monte le jeu sans
     `sql/skins.sql`, et la première version de cette lecture y a fait tomber
     la salle entière. Une tenue est du confort ; elle ne doit empêcher
     personne de pousser. */
  const tenues = new Map();
  try {
    for (const r of await q(
      `SELECT user_id, fanzzy_id, stage, skin_id FROM user_skins
        WHERE user_id IN (${users.map(() => '?').join(',')})
          AND fanzzy_id IN (${ids.map(() => '?').join(',')})
          AND equipped = 1`,
      [...users, ...ids])) {
      tenues.set(cle(r.user_id, r.fanzzy_id, Number(r.stage) || 1), r.skin_id);
    }
  } catch (e) {
    if (e?.code !== 'ER_NO_SUCH_TABLE') throw e;
  }

  for (const l of qui) {
    const atteint = Math.max(1, atteints.get(cle(l.userId, l.id)) ?? 1);
    /* Une forme du personnage à un âge donné. `auStade` peut ne rien
       rendre — beaucoup de lignées n'ont qu'un âge écrit — et une base qui
       annonce un stade inexistant ne doit pas faire disparaître le
       personnage de l'écran. */
    const forme = (evo, etat) => {
      const age = auStade(l.id, evo) ?? parIdentifiant(l.id);
      if (!age) return null;
      return { id: l.id, age: age.id, evo, nom: age.nom,
        skin: tenues.get(cle(l.userId, l.id, evo)) ?? 'base', etat,
        cri: age.cri?.label ?? null, rar: age.rar ?? null };
    };
    const evo = stadeAffiche(atteint, l.active_evo);
    const avatar = forme(evo, l.active_etat || null);
    /* Au premier âge, les deux ne diffèrent que par l'expression. */
    const enJeu = evo === 1 ? (avatar && { ...avatar, etat: null }) : forme(1, null);
    res.set(l.userId, { avatar, enJeu });
  }
  return res;
}
