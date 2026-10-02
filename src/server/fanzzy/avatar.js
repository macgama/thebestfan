import { racineDe, auStade, parIdentifiant, estCharge } from './catalogue.js';
import { stadeAffiche } from '../../shared/fanzzy/ages.js';
import { niveauPour } from '../../shared/niveau.js';

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
 *   - `tenuesParAge` — la tenue portée à **chaque** âge atteint, `{ 1: 'base',
 *     2: 'carnaval' }`, les âges sans tenue étant absents. Seul l'accueil en a
 *     besoin, parce qu'il est le seul écran qui fasse défiler les âges avant
 *     d'en valider un : sans elle il gardait la tenue de l'âge affiché et
 *     habillait le Capo avec le déguisement du gamin. Voir plus bas.
 *
 * Chacune porte `id` (la lignée, sous laquelle sont rangés les états) et
 * `age` (la carte du catalogue, sous laquelle est rangé le plein-pied).
 * Les confondre a déjà affiché le Choriste sous le nom du Meneur de chant.
 *
 * @param {Function} q  `(sql, params) => rows`, celui du module appelant.
 * @param {Array<{userId, active_fanzzy, active_evo, active_etat}>} lignes
 *   les lignes de portefeuille, déjà lues par l'appelant.
 * @returns {Promise<Map<string, {avatar, enJeu, tenuesParAge}>>} une entrée par
 *   joueur qui a un personnage ; les autres n'y sont pas. La liste d'amis ne lit
 *   que `avatar` — une clé de plus ne la dérange pas, c'est tout l'intérêt de
 *   rendre l'objet entier.
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

    /* **La tenue de chaque âge, et pas seulement de celui qu'on montre.**
     *
     * L'accueil laisse faire défiler les âges de son Fanzzy avant d'en valider
     * un — c'est un aperçu, rien n'est écrit. Il gardait la tenue de l'âge
     * affiché en changeant d'âge, et montrait donc le Capo dans le déguisement
     * du gamin : **une tenue que le joueur ne possède pas à cet âge-là.** Signalé
     * comme tel — « je vois l'image suivante même si elle ne fait pas partie de
     * ma collection ».
     *
     * La faute n'était pas dans le défilé mais dans ce qu'il avait sous la main :
     * le portefeuille n'envoyait qu'`activeSkin`, la tenue d'**un** âge, et une
     * page qui n'a qu'une valeur pour trois âges finit par la réemployer pour
     * les trois. On envoie donc les trois.
     *
     * La clé de `user_skins` est `(joueur, personnage, stade, tenue)` depuis
     * `sql/skins.sql` — « le Capo n'hérite pas de la garde-robe du gamin » — et
     * un booster ne peut offrir une tenue que pour un âge déjà débloqué. Les
     * trous sont donc normaux : un âge sans tenue portée n'a pas d'entrée, et
     * l'écran retombe sur `base`, exactement comme `forme` juste au-dessus.
     *
     * Bornée à l'âge atteint : proposer la garde-robe d'un âge qu'on n'a pas
     * payé serait le montrer en aperçu, et c'est précisément ce que le défilé
     * refuse de faire pour les âges eux-mêmes. */
    const tenuesParAge = {};
    for (let n = 1; n <= atteint; n += 1) {
      const t = tenues.get(cle(l.userId, l.id, n));
      if (t) tenuesParAge[n] = t;
    }

    res.set(l.userId, { avatar, enJeu, tenuesParAge });
  }
  return res;
}

/* ====================================================== les listes publiques

   **Ce qu'un inconnu a le droit de voir d'un joueur.** Les classements, les
   membres d'un KOP : des listes que n'importe qui lit, et où chacun doit se
   reconnaître à son personnage avant de lire un pseudo.

   `avatarsDe` rend l'objet **entier**, et c'est sa raison d'être : un écran du
   joueur lui-même ne doit rien avoir à improviser. Mais l'objet entier dit
   aussi la garde-robe de chaque âge (`tenuesParAge`), l'avatar d'entrée en
   jeu, le cri — ce qu'un joueur montre à ses amis, pas à un tableau public.
   Une liste publique ne reçoit donc qu'une **liste blanche**, écrite ici et
   nulle part ailleurs : un champ ajouté demain à `avatarsDe` ne doit pas
   partir dans un classement parce que personne n'a pensé à le retenir.
   `CONTRATS.md`, § 3, en donne la forme. */

/** Les champs de l'avatar public, dans l'ordre du contrat. Rien d'autre ne sort. */
export const AVATAR_PUBLIC = Object.freeze(['id', 'age', 'evo', 'nom', 'skin', 'etat', 'rar']);

const RARETES = new Set(['commune', 'rare', 'epique', 'legendaire']);

/** L'avatar réduit à sa liste blanche, ou `null`. */
function avatarPublic(a) {
  if (!a?.id || !a.age) return null;
  return {
    id: String(a.id),
    age: String(a.age),
    evo: Number(a.evo) || 1,
    nom: a.nom ?? null,
    skin: a.skin || 'base',
    etat: a.etat || null,
    /* Une rareté hors de la liste fermée devient nulle plutôt que de partir
       telle quelle : l'écran choisit une couleur par ce mot, et un mot qu'il
       ne connaît pas lui ferait peindre une plaque vide. */
    rar: RARETES.has(a.rar) ? a.rar : null,
  };
}

/* Le schéma incomplet se dit une fois, pas à chaque lecture de classement. */
const dejaDit = new Set();
function direUneFois(cause, message) {
  if (dejaDit.has(cause)) return;
  dejaDit.add(cause);
  console.warn(message);
}

/**
 * L'avatar public et le niveau d'une liste de joueurs, **en trois requêtes**,
 * quelle que soit la longueur de la liste.
 *
 * ## Pourquoi par lots
 *
 * Un classement de cinquante lignes qui lirait chaque joueur à part ferait
 * cent cinquante requêtes à chaque expiration de son mémo. La bourse et le
 * statut se lisent donc ensemble, en une fois, et `avatarsDe` lit déjà par
 * lots les âges atteints et les tenues : une, plus deux.
 *
 * ## Un compte qui n'est plus actif n'a plus de visage
 *
 * Les classements ne listent que les comptes actifs, mais les membres d'un
 * KOP sont lus sans filtre de statut (`kop/index.js`, `etat`) : un compte
 * supprimé garde sa ligne, et c'est juste — son versement au pot a eu lieu.
 * Son personnage, lui, ne doit jamais réapparaître. Le statut est donc lu
 * **ici**, avec la bourse, et pas laissé à la bonne mémoire de chaque appelant.
 * Un identifiant que `users` ne connaît pas reçoit la même réponse.
 *
 * ## Le niveau, ou rien
 *
 * Il se déduit de l'XP (`shared/niveau.js`, `niveauPour`), sans requête de
 * plus. Une XP illisible (pas de bourse, colonne absente) ne donne **pas** de
 * niveau : afficher « NIV. 1 » par défaut mentirait sur quelqu'un qui est
 * peut-être niveau 20.
 *
 * @param {Function} q  `(sql, params) => rows`, celui du module appelant —
 *   c'est lui que les suites instrumentent pour compter les requêtes.
 * @param {string[]} ids  les identifiants publics, doublons tolérés.
 * @returns {Promise<Map<string, { avatar?: object|null, niveau?: number }>>}
 *   une entrée par identifiant demandé. `avatar: null` : pas de Fanzzy
 *   équipé, ou compte inactif. `avatar` absent : le catalogue n'est pas
 *   chargé, ou une table manque — on ne sait pas, donc on ne dit rien.
 */
export async function habillerJoueurs(q, ids) {
  const qui = [...new Set((ids ?? []).filter((x) => typeof x === 'string' && x))];
  const res = new Map();
  if (!qui.length) return res;
  const marques = qui.map(() => '?').join(',');

  /* Une seule lecture pour toute la liste : le statut et la bourse.
     Jointure à gauche : un joueur sans bourse existe, il n'a simplement ni
     personnage ni XP lisible. */
  const lire = (xp) => q(
    `SELECT u.public_id AS userId, u.status,
            w.active_fanzzy, w.active_evo, w.active_etat, ${xp} AS xp
       FROM users u
       LEFT JOIN user_wallet w ON w.user_id = u.public_id
      WHERE u.public_id IN (${marques})`, qui);
  let lignes;
  try {
    lignes = await lire('w.xp');
  } catch (e) {
    /* `xp` arrive avec sql/niveau.sql. Sans elle, les visages restent et
       le niveau se tait : c'est un affichage, pas une raison de vider un
       classement. */
    if (e?.code !== 'ER_BAD_FIELD_ERROR') throw e;
    direUneFois('xp', '[avatar] colonne user_wallet.xp absente : les listes publiques '
      + 'servent les avatars sans niveau (applique sql/niveau.sql)');
    lignes = await lire('NULL');
  }

  const actifs = lignes.filter((l) => l.status === 'active');

  let visages = null;
  if (estCharge()) {
    try {
      visages = await avatarsDe(q, actifs);
    } catch (e) {
      if (e?.code !== 'ER_NO_SUCH_TABLE' && e?.code !== 'ER_BAD_FIELD_ERROR') throw e;
      direUneFois(`table:${e.code}`, `[avatar] les listes publiques servent sans avatar : ${
        e.sqlMessage ?? e.message}`);
    }
  }

  const parId = new Map(lignes.map((l) => [l.userId, l]));
  for (const id of qui) {
    const l = parId.get(id);
    if (!l || l.status !== 'active') { res.set(id, { avatar: null }); continue; }
    const entree = {};
    if (visages) entree.avatar = avatarPublic(visages.get(id)?.avatar);
    const xp = l.xp == null ? NaN : Number(l.xp);
    if (Number.isFinite(xp) && xp >= 0) entree.niveau = niveauPour(xp);
    res.set(id, entree);
  }
  return res;
}
