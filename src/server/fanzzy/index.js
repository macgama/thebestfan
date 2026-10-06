import express from 'express';
// Les cartes viennent de la base ; les barèmes — séries, types, raretés, taux,
// coûts — restent du code, parce qu'ils décrivent les règles du jeu et non son
// contenu. On ne change pas un taux de tirage depuis un écran d'administration.
import { SETS, TYPES, RAR, RATES, SCARVES, EVO_COST } from '../../shared/fanzzy/dex.js';
import { tous, publies, parIdentifiant, obtenables, seriesOuvertes, serieOuverte,
  racineDe, lignee, auStade } from './catalogue.js';
import { STUFF, STUFF_BY_ID, combine, piecesPortees } from '../../shared/fanzzy/inventaire.js';
/* Les quatre états dessinés. `rendus.js` fait foi : la même liste sert la
   chaîne d'images, la résolution côté client et, maintenant, le tirage. */
import { ETATS_DESSINES, ETAT_DESSIN } from '../../shared/fanzzy/rendus.js';

/* Le nom d'un état pour le joueur. `rendus.js` décrit le **dessin** — « bras
   levés… » — ce qui sert au dessinateur et ne se met pas sur une carte. Ici
   on nomme le **moment**, et c'est ce que la fiche affiche. */
const ETAT_NOM = {
  joie: 'La joie', depit: 'Le dépit',
  pousse: 'On pousse', colere: 'Pas content',
};
// Les tenues viennent de la base : elles se créent depuis l'administration,
// et une liste figée dans le code redeviendrait une seconde vérité.
import { toutesTenues, tenuesPubliees } from './tenues.js';
import { ACTIONS, DECK_RULES } from '../../shared/duel/actions.js';
/* Ce que les saisons ont ouvert de l'équipement et des cartes d'action.
   Renommé à l'import : `publies` est déjà pris ici par le catalogue Fanzzy, et
   deux fonctions du même nom dans le même fichier finiraient par se confondre
   au premier ajout. `jouables` dit d'ailleurs mieux ce qu'on demande. */
import { publies as jouables } from '../contenus/index.js';
import { DEFAUTS, reglage } from '../../shared/reglages.js';
import { stadeAffiche } from '../../shared/fanzzy/ages.js';
import { avatarsDe } from './avatar.js';
import { XP } from '../../shared/niveau.js';
import { saisonsLancees, saisonEnCours } from './saisons.js';
/* L'espace de noms entier, en plus des noms ci-dessus : `saisonProchaine` et
   `seriesAnnoncees` sont livrées par le périmètre des saisons, et un import
   nommé d'une fonction absente ferait tomber le module au chargement — donc
   toutes les routes du jeu. Lues par l'espace de noms, leur absence éteint
   seulement l'annonce. */
import * as saisons from './saisons.js';
import { assurerBourse } from '../bourse.js';
import { verser, verserTout } from '../recompenses.js';

/* ------------------------------------------------------------ le journal

   Une écriture annexe qui échoue (compteur du jour, nouveauté) ne fait jamais
   échouer l'action qui l'a déclenchée — mais elle se dit, **une fois** par
   cause : un journal qui répète la même ligne à chaque booster ne se lit plus,
   et une panne qui ne se dit pas ne se répare pas. */
const dejaDit = new Set();
const estSchema = (e) => e?.code === 'ER_NO_SUCH_TABLE' || e?.code === 'ER_BAD_FIELD_ERROR';
function signalerAnnexe(table, e) {
  const cause = `${table}:${e?.code ?? e?.message}`;
  if (dejaDit.has(cause) || dejaDit.size > 50) return;
  dejaDit.add(cause);
  console.error(estSchema(e)
    ? `[fanzzy] ${table} absente ou incomplète (${e.sqlMessage ?? e.message}) : l'action a eu `
      + 'lieu, son écriture annexe est sautée. Applique sql/quotidien.sql '
      + '(npm run schema:appliquer), puis redémarre.'
    : `[fanzzy] ${table} : écriture annexe sautée, l'action a eu lieu (${e?.message}).`);
}

/* -------------------------------------------------------- les nouveautés

   Ce que le joueur n'a pas encore regardé (`CONTRATS.md`, § 2). La clé est
   **l'identité** de la chose gagnée, et elle sert deux fois : au serveur pour
   ne pas l'écrire deux fois, à la page pour l'éteindre. Sa forme est fermée :

     fanzzy:RP4 · age:RP4:2 · etat:RP4:1:joie · skin:RP4:1:prehistorique
     stuff:<pièce> · action:<carte>

   Les deux fonctions qui suivent sont les seules à la construire et à la
   lire : une seconde façon d'écrire la même clé ferait deux nouveautés pour un
   seul gain, et une page qui en éteint une verrait l'autre rester allumée. */
export const SORTES_NOUVEAUTE = Object.freeze(['fanzzy', 'age', 'etat', 'skin', 'stuff', 'action']);

/** La clé d'une carte de booster, ou `null` pour une poignée d'écharpes. */
export function cleDeCarte(c) {
  switch (c?.type) {
    case 'fanzzy': return `fanzzy:${c.id}`;
    case 'etat': return `etat:${c.pour}:${c.stade}:${c.id}`;
    case 'skin': return `skin:${c.pour}:${c.stade}:${c.id}`;
    case 'stuff': return `stuff:${c.id}`;
    case 'action': return `action:${c.id}`;
    default: return null;
  }
}

/** La sorte d'une clé : son préfixe, et rien d'autre. */
const sorteDeCle = (cle) => String(cle).split(':')[0];

/**
 * Une clé relue en entrée du contrat (`CONTRATS.md`, § 2.1), ou `null` si elle
 * ne se lit pas — une ligne posée à la main, une sorte d'une version future :
 * mieux vaut ne pas la montrer que montrer une carte sans identité.
 */
export function nouveauteDe(cle) {
  const p = String(cle).split(':');
  const stade = Number(p[2]);
  const stadeLu = Number.isInteger(stade) && stade >= 1 && stade <= 3;
  switch (p[0]) {
    case 'fanzzy': case 'stuff': case 'action':
      return p.length === 2 && p[1] ? { cle, sorte: p[0], id: p[1] } : null;
    case 'age':
      return p.length === 3 && p[1] && stadeLu ? { cle, sorte: 'age', id: p[1], stade } : null;
    case 'etat': case 'skin':
      return p.length === 4 && p[1] && p[3] && stadeLu
        ? { cle, sorte: p[0], id: p[3], pour: p[1], stade } : null;
    default: return null;
  }
}

/**
 * **Qui écrit une nouveauté, et qui n'en écrit pas.**
 *
 * Exporté pour que la suite l'importe au lieu de le lire au motif dans ce
 * fichier : un contrôle qui cherche des noms dans le source rétrécit en
 * silence le jour où un nom change (`ETAT.md`, § 2). La suite éprouve chaque
 * chemin de `ecrivent`, et rougit sur un chemin qu'elle ne sait pas éprouver.
 *
 * Un chemin qui donne un objet et ne figure dans aucune des deux listes est
 * un oubli : la règle est « au moment du gain », et rien d'acquis avant la
 * mise en ligne n'est jamais « nouveau ».
 */
export const CHEMINS_NOUVEAUTES = Object.freeze({
  ecrivent: Object.freeze({
    openPack: Object.freeze(['fanzzy', 'etat', 'skin', 'stuff', 'action']),
    evolve: Object.freeze(['age']),
    remettreStuff: Object.freeze(['stuff']),
    remettreTenue: Object.freeze(['skin']),
  }),
  nEcriventPas: Object.freeze({
    /* `src/server/onboarding/index.js` pose lui-même le paquet de bienvenue :
       le premier Fanzzy, la première pièce et les premières cartes, choisis ou
       montrés à l'écran au moment même. Les annoncer « nouveaux » ensuite
       dirait au joueur ce qu'il vient de choisir. */
    onboarding: 'le paquet de bienvenue est choisi et vu à l’écran même',
    /* Rien ne l'appelle aujourd'hui. La source qui l'appellera décidera si son
       cadeau est une nouveauté, et l'ajoutera alors à `ecrivent`. */
    offrir: 'aucun appelant',
  }),
});

/**
 * Collection Fanzzy, tenue par le serveur.
 *
 * Rien de tout ceci ne peut vivre dans le navigateur : le tirage d'un booster,
 * le solde d'écharpes et les évolutions décident de ce qu'un joueur possède, et
 * un joueur possède des choses qui s'achètent. Le client n'affiche que ce que
 * le serveur lui dit.
 */

export const MAX_PACKS = DEFAUTS['pack.max'];
/**
 * Ce qu'un nouveau joueur trouve dans sa réserve.
 *
 * Trois, et non douze. Douze boosters d'un coup, c'est cinq minutes
 * d'ouverture frénétique puis plus rien à faire pendant deux heures — et
 * soixante cartes vues avant d'avoir compris ce qu'est un Fanzzy. Trois
 * laissent le temps de regarder, et la réserve se remplit ensuite d'elle-même
 * jusqu'à douze.
 */
/* Les valeurs **par défaut**, déduites du registre : elles ne sont plus
   écrites deux fois. Ce sont elles qu'importent les scripts d'analyse et les
   suites ; le jeu, lui, lit `reglage(...)` à chaque fois, pour que l'écran
   d'administration ait un effet réel et immédiat. */
export const PACKS_DEPART = DEFAUTS['pack.depart'];
export const PACK_REGEN_MS = DEFAUTS['pack.regen_min'] * 60_000;
export const PACK_PRICE = DEFAUTS['pack.prix_echarpes'];

/** Les mêmes, mais vivantes. Une fonction et non une constante : une constante
    relue au chargement du module ne bougerait plus jamais. */
const maxPacks = () => reglage('pack.max');
/* La réserve de départ vit dans `src/server/bourse.js`, avec la fonction
   qui ouvre une bourse : quatre autres modules en créaient une sans connaître
   ce nombre, et c'est toujours l'un d'eux qui arrivait le premier. */
const regenMs = () => reglage('pack.regen_min') * 60_000;
const prixPack = () => reglage('pack.prix_echarpes');

const rnd = (a) => a[Math.floor(Math.random() * a.length)];

/**
 * **Ce que les crans de collection ne comptent pas : les tenues.**
 *
 * Un abonné porte n'importe quelle tenue publiée, et la porter l'inscrit dans
 * `user_skins` comme une tenue gagnée : il la garde à l'échéance (`wearSkin`,
 * `onboarding/index.js`). Rien dans la ligne ne dit si la tenue a été tirée,
 * achetée à l'étal ou prise par l'abonnement. Comptées, les tenues faisaient
 * de l'abonnement des écharpes et des boosters : trente-cinq lignées, jusqu'à
 * trois âges, trois tenues publiées, c'est de l'ordre de trois cents objets,
 * une douzaine de crans, obtenus par des clics d'abonné — une récompense
 * achetée en argent réel.
 *
 * Elles sortent donc du compte qui paie, **pour tout le monde** : abonné et
 * non-abonné reçoivent les mêmes montants (`CONTRATS.md`, R9). C'est la règle
 * des divisions (`SERVEUR.md`, § 1, point 8) : ce que l'abonnement ouvre ne
 * paie pas. La jauge de la bibliothèque, elle, les garde — une tenue se
 * collectionne, elle ne se monnaie pas.
 *
 * Un ensemble de types de `compter()`, et non une soustraction écrite dans
 * `paliersDe` et dans le recompte du versement : la route et le grand livre
 * comptent avec la même liste.
 */
const HORS_CRANS = new Set(['tenues']);

/**
 * Quelle saison a ouvert chaque série.
 *
 * Remplace `NIVEAU_DE_SERIE`, qui disait à quel niveau une série se débloquait :
 * le niveau n'ouvre plus de séries, les saisons le font. Déduit des saisons
 * lancées plutôt que recopié — une table de plus à tenir à jour finirait par
 * diverger de celle qui décide vraiment.
 *
 * Une série ouverte par deux saisons est attribuée à la **plus ancienne** :
 * c'est le jour où elle est arrivée dans le jeu qui intéresse le joueur, pas la
 * dernière fois qu'on l'a renommée dans une liste.
 */
function saisonDeSerie() {
  const par = {};
  for (const s of saisonsLancees()) {
    for (const id of s.series) {
      if (!par[id] || s.numero < par[id].numero) {
        par[id] = { numero: s.numero, nom: s.nom };
      }
    }
  }
  return par;
}

/**
 * `niveau` est facultatif : sans lui le module tourne exactement comme avant,
 * boosters compris. C'est ce qui permet aux suites qui n'éprouvent pas la
 * progression de monter le module seul, et à une installation dont
 * `sql/niveau.sql` n'est pas encore appliqué de continuer à distribuer.
 */
/**
 * @param {object} [opts.decks]  le module de deck, s'il est monté. La fiche s'en
 *   sert pour dire **où** ce personnage se trouve dans la tribune du joueur —
 *   titulaire, remplaçant, ou nulle part — et quelles places sont ouvertes. Sans
 *   lui, la fiche reste lisible et le bouton d'entrée en duel disparaît : mieux
 *   vaut pas de bouton qu'un bouton qui ne peut pas tenir sa promesse.
 */
export function createFanzzy({ pool, requireAuth, niveau = null, decks = null,
  /* L’abonnement ouvre le **rythme** des boosters : une réserve plus haute et
     une recharge plus courte. Rien d’autre — voir `abonnement/index.js`, qui
     porte la règle : on vend de la largeur et du confort, jamais de la
     puissance. Absent, tout le monde est joueur inscrit, ce qui est l'état
     d'avant. */
  abonnement = null,
  /* **Pour les suites seulement.** `apresLectureRecharge(userId)` est appelé
     entre la lecture de la réserve et son écriture : c'est l'instant exact où
     un débit concurrent peut se glisser, et une course qu'on ne sait pas
     placer là se gagne au hasard — un contrôle de concurrence qui passe par
     chance ne prouve rien (`RISQUES.md`, E3). */
  crochets = {} }) {
  const q = async (sql, params = []) => {
    const [rows] = await pool.execute(sql, params);
    return rows;
  };
  /** Le même lecteur, sur une connexion donnée (une transaction en cours). */
  const surConnexion = (conn) => async (sql, params = []) => (await conn.execute(sql, params))[0];

  /* -------------------------------------------------------- portefeuille */

  /**
   * **L'avatar d'un joueur**, tel que le rend `avatarsDe` — la règle et
   * son histoire sont là-bas, dans `avatar.js`. Elle n'est plus ici parce
   * que la liste d'amis en a besoin pour quarante joueurs à la fois, et
   * qu'une seconde version « pour une liste » aurait été une septième copie.
   *
   * @param {object} ligne  la ligne du portefeuille, si l'appelant l'a déjà
   *   lue — `active_fanzzy`, `active_evo`, `active_etat`. Relue sinon.
   */
  async function construireAvatar(userId, ligne = null) {
    const w = ligne ?? (await q(
      `SELECT active_fanzzy, active_evo, active_etat FROM user_wallet WHERE user_id = ?`,
      [userId]))[0];
    const r = await avatarsDe(q, [{ ...w, userId }]);
    return r.get(userId) ?? { avatar: null, enJeu: null, tenuesParAge: {} };
  }

  /**
   * Recharge les boosters au prorata du temps ecoule, puis renvoie l'etat.
   * Le calcul se fait a la lecture plutot qu'avec une tache periodique :
   * pas de minuterie a maintenir, et le resultat est le meme.
   *
   * **Le plafond et la cadence dependent de l'abonnement**, et de rien d'autre.
   * Ce sont les deux seules choses que l'abonnement change ici : la reserve est
   * plus haute et le booster revient plus vite. Le contenu d'un booster, lui,
   * est exactement le meme — sans quoi on vendrait de la collection, donc de la
   * puissance par la bande.
   *
   * ## Une seule horloge, et c'est celle de Node
   *
   * Un joueur a envoyé la capture d'un minuteur à **64:28** sur une cadence de
   * dix minutes. Le compte n'était pas faux : `packs_at` était daté d'une heure
   * dans l'avenir, et `cadence - (maintenant - packs_at)` rend alors la cadence
   * **plus** l'écart.
   *
   * Trois endroits écrivaient cette colonne, et pas avec la même horloge : ici
   * en `NOW(3)` — celle de MySQL —, plus bas à l'ouverture d'un booster en
   * `NOW(3)` aussi, et une ligne neuve prenait le `CURRENT_TIMESTAMP(3)` par
   * défaut de la colonne. La lecture, elle, compare à `Date.now()`. Tant que le
   * fuseau de la session MySQL et celui de Node coïncident, tout va bien — et
   * c'est le cas sur une machine de développement, ce qui explique que rien
   * n'ait jamais rougi.
   *
   * **L'autre sens de l'écart est bien pire que le minuteur.** Si l'heure de
   * MySQL est en retard sur celle de Node, `gained` se compte en dizaines : la
   * réserve se remplit d'un coup, à chaque lecture, pour tout le monde. Des
   * boosters gratuits à volonté, sans une ligne d'erreur nulle part.
   *
   * Donc : **cette colonne ne se date qu'en JavaScript**. Ni `NOW(3)`, ni
   * `CURRENT_TIMESTAMP`. Une date écrite par le pilote et relue par le pilote
   * fait l'aller-retour dans le même fuseau, quel qu'il soit.
   *
   * ## La recharge ne peut plus écraser un débit
   *
   * Elle écrivait une valeur **absolue** (`packs = ?`) calculée sur une
   * lecture faite avant. Une recharge due, deux requêtes : l'une ouvre un
   * booster et débite, l'autre réécrit `packs = ancien + 1` après ce débit.
   * Le débit est perdu, et le booster gratuit — l'abonnement vend précisément
   * ce rythme, et le défaut le donnait à qui sait lancer deux requêtes
   * (`RISQUES.md`, E3). La recharge vit maintenant dans `recharger`, plus bas,
   * et son écriture est conditionnelle.
   */
  async function wallet(userId) {
    const regle = regleDe(await abonneDe(userId));
    const { plafond, cadence } = regle;
    await assurerBourse(q, userId);
    /* `uf.stage` : l'âge **atteint** du Fanzzy équipé. Il ne sert pas à la
       recharge, il sert à savoir quelle tenue il porte — une tenue appartient
       à un âge depuis `sql/skins.sql`, et le Capo n'hérite pas de la
       garde-robe du gamin. En jointure plutôt qu'en seconde requête : c'est
       la lecture la plus fréquente du jeu. */
    const w = (await q(
      `SELECT w.scarves, w.billets, w.packs, w.packs_at, w.active_fanzzy, w.active_evo,
              w.active_etat, uf.stage AS atteint
         FROM user_wallet w
         LEFT JOIN user_fanzzy uf
           ON uf.user_id = w.user_id AND uf.fanzzy_id = w.active_fanzzy
        WHERE w.user_id = ?`,
      [userId],
    ))[0];

    /* La ligne lue sert de première lecture à la recharge : une requête de
       moins sur la lecture la plus fréquente du jeu. Si un débit est passé
       entre-temps, l'écriture conditionnelle ne trouve plus cette ligne-là,
       et la recharge relit avant de recompter. */
    const r = await rechargerLigne(pool, userId, regle, w);
    if (r) { w.packs = r.packs; w.packs_at = r.packsAt; }

    /* **L'attente ne peut pas dépasser la cadence.** C'est vrai par
       définition, et l'écrire coûte un `Math.min` : le jour où une horloge
       dérive malgré tout — une bascule d'heure d'été pendant une requête, une
       base restaurée — le joueur voit un minuteur un peu faux au lieu d'un
       minuteur absurde. Un « 64:28 » sur une cadence de dix minutes ne se lit
       pas comme une erreur d'horloge : il se lit comme un jeu cassé. */
    const ecoule = Math.min(cadence,
      Math.max(0, Date.now() - new Date(w.packs_at).getTime()));
    const nextIn = w.packs >= plafond ? null : cadence - ecoule;
    /* **La tenue portée, à l'âge où l'on se montre.**

       Elle était enregistrée depuis toujours — `user_skins.equipped` — et
       n'arrivait nulle part : l'accueil écrivait `skin: 'base'` en dur, avec
       un commentaire qui disait « tant qu'il n'y en a qu'un ». Il y en a deux
       depuis HALLOWEEN, et le joueur qui choisissait son déguisement dans le
       classeur le voyait sur la fiche et nulle part ailleurs.

       Une seule requête de plus, et seulement s'il y a quelqu'un d'équipé :
       c'est une lecture sur clé primaire, et elle rend au choix du joueur le
       seul effet qu'on lui avait promis. */
    /* **L'avatar, d'un seul tenant.** Les trois champs d'en dessous —
       `activeSkin`, `activeStade`, `activeEtat` — en sont tirés, et non plus
       calculés à part : ils restent pour les écrans qui les lisent encore,
       mais ils ne peuvent plus dire autre chose que `avatar`. */
    const [{ avatar, enJeu, tenuesParAge }, stuffPorte] = await Promise.all([
      construireAvatar(userId, w), sacDuDeck(userId, w.active_fanzzy)]);

    return { scarves: w.scarves, billets: w.billets, packs: w.packs,
      nextPackInMs: nextIn,
      /* **La durée d'une recharge, pour ce joueur-là**, en millisecondes :
         celle qui vient de servir au calcul, abonnement compris. L'anneau du
         kiosque en tire sa part écoulée (`1 − reste ⁄ durée`) ; sans elle, la
         page approchait avec dix minutes, faux pour un abonné et faux au
         premier changement du réglage. Toujours présente, réserve pleine
         comprise : la même forme pour tous (`CONTRATS.md`, R9). */
      cadenceMs: cadence,
      /* **Le plafond de la réserve, pour ce joueur-là** (`CONTRATS.md`,
         § 13.1) : celui qui vient de borner la recharge, abonnement compris.
         `maxPacks`, à la racine de `/state`, est celui du joueur gratuit : lu
         pour la réserve, il dessinerait douze places à un abonné qui en a
         vingt-quatre ; sans plafond du tout, le kiosque ne sait jamais
         dessiner les fentes d'une réserve de cinq. Un entier ≥ 1 (les
         réglages le bornent) ; absent sinon (R1), plutôt qu'un plafond qui
         ferait dessiner zéro place. */
      ...(Number.isInteger(plafond) && plafond >= 1 ? { packMax: plafond } : {}),
      active: w.active_fanzzy,
      avatar,
      avatarEnJeu: enJeu,
      activeSkin: avatar?.skin ?? 'base',
      /* **La tenue de chaque âge, pas seulement celle qu'on montre.**
         L'accueil fait défiler les âges avant d'en valider un ; avec la seule
         `activeSkin` il réemployait la tenue de l'âge affiché pour les autres,
         et montrait donc une tenue que le joueur ne possède pas à cet âge-là.
         La règle de possession est par âge depuis `sql/skins.sql`. */
      tenuesParAge: tenuesParAge ?? {},
      /* **L'âge auquel le montrer, déjà calculé.**

         `activeEvo` reste ce qu'il a toujours été : le choix brut, nul quand
         personne n'a choisi. L'accueil en a besoin tel quel pour savoir s'il
         doit proposer de valider.

         `activeStade` est la réponse, bornée par l'âge atteint — la règle est
         dans `shared/fanzzy/ages.js`. Les écrans qui veulent seulement
         dessiner le personnage lisent celle-ci : la page des matchs prenait
         l'âge **atteint** et ignorait le choix, si bien qu'un joueur qui
         préfère se montrer jeune se voyait vieux sur un écran et jeune sur
         l'autre. */
      activeEvo: w.active_evo === null ? null : Number(w.active_evo),
      activeStade: avatar?.evo ?? 1,
      /* **La pose choisie.** Nulle veut dire le repos, et c'est le cas de
         presque tout le monde : l'écran qui la choisit ne sert qu'à celui qui
         a gagné une expression et veut la montrer en permanence. */
      activeEtat: avatar?.etat ?? null,
      /* **Ce qu'il porte** : les deux pièces que le deck lui a mises, si le
         Fanzzy montré y a sa place. L'accueil les accroche à côté de lui.
         C'est le sac du Virage (`ferveur`, `place.stuff`) et du duel : celui
         qui compte en jeu, pas un second choix. Vide sans deck, ou quand le
         Fanzzy montré n'y est pas. */
      stuffPorte };
  }

  /**
   * Les pièces du Fanzzy `fanzzyId` dans le deck actif, prêtes à dessiner.
   * Une lecture sur clé ; un deck illisible rend un sac vide plutôt qu'un
   * portefeuille en erreur — c'est la lecture la plus fréquente du jeu.
   */
  async function sacDuDeck(userId, fanzzyId) {
    if (!decks || !fanzzyId) return [];
    try {
      const deck = await decks.deckDe(userId);
      const racine = racineDe(String(fanzzyId));
      return piecesPortees((deck?.fanzzy ?? []).find((x) => x.id === racine)?.stuff);
    } catch {
      return [];
    }
  }

  /* ------------------------------------------------------------ recharge

     Trois choses à savoir, et elles tiennent toutes à l'abonnement.

     **Le plafond et la cadence dépendent de lui**, et de rien d'autre
     (`abonnement/index.js` porte la règle). On les déduit d'un booléen,
     relu à chaque fois dans les réglages : un plafond changé depuis
     l'administration vaut tout de suite.

     **`estAbonne` passe par le pool**, pas par la connexion de l'appelant.
     Le grand livre appelle `recharger` en tenant le verrou de la bourse ; si
     huit réclamations simultanées du même joueur tiennent les huit
     connexions du pool en attente de ce verrou, celle qui le tient ne
     trouverait plus de connexion pour lire l'abonnement — tout le serveur
     attendrait cinquante secondes l'expiration du verrou. `recharger`
     emploie donc ce qu'on en sait depuis moins de deux minutes, s'il y en a :
     `wallet()`, l'ouverture d'un booster et la réclamation d'un palier le
     relisent **avant** de prendre une connexion, et le notent ici. Le prix
     d'un souvenir un peu vieux : une recharge comptée au rythme d'avant,
     pendant deux minutes, le jour où l'on s'abonne.

     **Sans module d'abonnement**, tout le monde est joueur inscrit : c'est
     l'état d'avant, et aucune requête n'est faite. */
  const MEMOIRE_ABONNE_MS = 120_000;
  const abonnes = new Map();   // userId → { abonne, t }

  async function abonneDe(userId, { memoire = false } = {}) {
    if (!abonnement) return false;
    if (memoire) {
      const m = abonnes.get(userId);
      if (m && Date.now() - m.t < MEMOIRE_ABONNE_MS) return m.abonne;
    }
    const abonne = await abonnement.estAbonne(userId);
    /* Une borne grossière plutôt qu'une éviction fine : la table ne sert qu'à
       éviter une requête sous verrou, la vider de temps en temps ne coûte que
       cette requête. */
    if (abonnes.size > 5000) abonnes.clear();
    abonnes.set(userId, { abonne, t: Date.now() });
    return abonne;
  }

  const regleDe = (abonne) => ({
    plafond: abonnement ? abonnement.plafondPacks(abonne) : maxPacks(),
    cadence: abonnement ? abonnement.regenMs(abonne) : regenMs(),
  });

  /**
   * Ce que la recharge écrirait, ou `null` s'il n'y a rien à écrire. Pur :
   * la même règle qu'avant, ligne pour ligne — seule l'écriture a changé.
   */
  function planRecharge(w, { plafond, cadence }, maintenant) {
    const packs = Number(w.packs);
    const depuis = new Date(w.packs_at).getTime();
    if (packs < plafond) {
      const gagnes = Math.floor((maintenant - depuis) / cadence);
      if (gagnes <= 0) return null;
      return { packs: Math.min(plafond, packs + gagnes), at: new Date(depuis + gagnes * cadence) };
    }
    /* Réserve pleine (ou au-dessus, après un cadeau) : le compte à rebours
       repart d'ici. L'heure de **Node** — voir le pavé de `wallet`. */
    return { packs, at: new Date(maintenant) };
  }

  /**
   * La recharge, sur le lecteur qu'on lui donne (le pool, ou la connexion
   * d'une transaction).
   *
   * **L'écriture est conditionnelle** : elle ne touche la ligne que si elle
   * est encore celle qu'on a lue (`packs` et `packs_at`). Sinon un débit est
   * passé entre la lecture et l'écriture : on relit, sous `FOR UPDATE`, et on
   * recompte. Sous le verrou d'une transaction, la condition est toujours
   * vraie et ne coûte rien ; hors transaction, c'est elle qui protège.
   *
   * @param ligne  une lecture de `packs` et `packs_at` déjà faite, ou `null`
   * @returns { packs, packsAt } — ou `null` si le joueur n'a pas de bourse
   */
  async function rechargerLigne(lecteur, userId, regle, ligne) {
    let w = ligne;
    for (let essai = 0; essai < 4; essai++) {
      if (!w) {
        const [rows] = await lecteur.execute(
          'SELECT packs, packs_at FROM user_wallet WHERE user_id = ? FOR UPDATE', [userId]);
        w = rows[0];
        if (!w) return null;
      }
      const plan = planRecharge(w, regle, Date.now());
      if (!plan) return { packs: Number(w.packs), packsAt: new Date(w.packs_at) };
      if (crochets.apresLectureRecharge) await crochets.apresLectureRecharge(userId);
      const [r] = await lecteur.execute(
        `UPDATE user_wallet SET packs = ?, packs_at = ?
          WHERE user_id = ? AND packs = ? AND packs_at = ?`,
        [plan.packs, plan.at, userId, w.packs, w.packs_at]);
      if (r.affectedRows) return { packs: plan.packs, packsAt: plan.at };
      w = null;   // la ligne a bougé sous nos pieds : relire, recompter
    }
    /* Quatre courses perdues d'affilée : quelqu'un écrit sans cesse cette
       ligne. On rend ce qu'elle porte sans recharger — la prochaine lecture
       rechargera, et rien n'a été écrasé. */
    const [rows] = await lecteur.execute(
      'SELECT packs, packs_at FROM user_wallet WHERE user_id = ?', [userId]);
    return rows[0] ? { packs: Number(rows[0].packs), packsAt: new Date(rows[0].packs_at) } : null;
  }

  /**
   * **La recharge des boosters, sur la connexion de l'appelant.**
   *
   * C'est la porte que le grand livre (`recompenses.js`, étape 7) ouvre avant
   * de créditer un booster offert : la recharge due est comptée d'abord, puis
   * le cadeau entre, même au-dessus du plafond. Sans elle, un sachet reçu à 11
   * sur 12 avec une recharge due laissait le joueur à 12 au lieu de 13 —
   * parce qu'une réserve pleine remet le compte à rebours à zéro.
   *
   * Appelée sous le verrou d'une transaction, elle recharge dans cette
   * transaction (une annulation la défait) ; appelée hors transaction, son
   * écriture conditionnelle la protège quand même.
   *
   * @param conn    une connexion (ou le pool) : `execute(sql, params)`
   * @returns { packs, packsAt } | null
   */
  async function recharger(conn, userId) {
    return rechargerLigne(conn, userId, regleDe(await abonneDe(userId, { memoire: true })), null);
  }

  async function collection(userId) {
    const rows = await q(`SELECT fanzzy_id, copies FROM user_fanzzy WHERE user_id = ?`, [userId]);
    return Object.fromEntries(rows.map((r) => [r.fanzzy_id, r.copies]));
  }

  /**
   * La dernière saison dont ce joueur a vu l'annonce.
   *
   * La colonne vient de `sql/saisons.sql`, que rien n'oblige à appliquer. Sans
   * elle on rend `null` : l'annonce s'affiche, ce qui est le bon défaut — mieux
   * vaut la montrer une fois de trop que de la perdre en silence.
   */
  async function saisonVue(userId) {
    try {
      const r = await q(`SELECT saison_vue FROM user_wallet WHERE user_id = ?`, [userId]);
      return r[0]?.saison_vue ?? null;
    } catch (e) {
      if (e.code !== 'ER_BAD_FIELD_ERROR') throw e;
      return null;
    }
  }

  /**
   * Jusqu'où chaque personnage a été fait grandir.
   *
   * Volontairement à part de `collection`, qui rend un nombre d'exemplaires par
   * identifiant : y glisser un objet aurait cassé en silence tout ce qui lit
   * cette valeur comme un compteur — le classeur en fait un total, l'accueil en
   * fait une jauge. Deux cartes, deux significations, deux champs.
   *
   * Seuls les stades supérieurs à 1 y figurent : le premier âge est le défaut,
   * et une entrée par personnage possédé n'apprendrait rien.
   */
  async function stades(userId) {
    const rows = await q(
      `SELECT fanzzy_id, stage FROM user_fanzzy WHERE user_id = ? AND stage > 1`, [userId]);
    return Object.fromEntries(rows.map((r) => [r.fanzzy_id, Number(r.stage)]));
  }

  /**
   * Les états gagnés, par personnage et par âge.
   *
   * Forme : `{ 'RP21': { 1: ['joie','depit'], 2: ['colere'] } }`. Deux
   * niveaux plutôt qu'une clé composée, parce que les deux écrans qui la
   * lisent posent deux questions différentes — la fiche veut les états d'un
   * âge, le jeu veut savoir si **celui-ci** est gagné — et qu'une clé
   * `'RP21:1:joie'` obligerait les deux à la recomposer à la main.
   *
   * Rendue vide si la table n'existe pas encore. C'est le bon défaut avec
   * `resoudre` en face : rien de gagné veut dire que tout retombe sur le
   * repos, donc un déploiement où `sql/etats.sql` manque montre des
   * personnages au repos — et non une page blanche.
   */
  async function etatsGagnes(userId, lire = q) {
    let rows;
    try {
      rows = await lire(
        `SELECT fanzzy_id, stage, etat FROM user_etats WHERE user_id = ?`, [userId]);
    } catch (e) {
      if (e.code !== 'ER_NO_SUCH_TABLE') throw e;
      return {};
    }
    const out = {};
    for (const r of rows) {
      const parAge = out[r.fanzzy_id] ??= {};
      (parAge[Number(r.stage)] ??= []).push(r.etat);
    }
    return out;
  }

  /* -------------------------------------------------------------- tirage */

  function pickRarity(slot) {
    const r = Math.random();
    let acc = 0;
    for (const [rar, p] of RATES[slot]) { acc += p; if (r < acc) return rar; }
    return 'rare';
  }

  /**
   * Cinq cartes d'une série. Les deux premières tirent leur rareté, les trois
   * suivantes sont communes — et de toute façon remplacées par `openPack`.
   *
   * **Le repli descend l'échelle au lieu de sauter directement aux communes.**
   * L'ancienne version tentait la rareté tirée puis, si elle était vide,
   * `pool_('commune')` — et si la série n'avait aucune commune, elle renvoyait
   * `undefined`. Cinq `undefined` dans un booster ne lèvent pas : ils
   * traversent la transaction, se rangent en base, et ressortent trois écrans
   * plus loin en « Cannot read properties of undefined ».
   *
   * C'est arrivé le jour où les sept lignées ont quitté NUITS EUROPÉENNES : la
   * série a perdu d'un coup toutes ses cartes de stade 1, donc toutes ses
   * communes. Le défaut existait avant, il attendait juste qu'une série se
   * retrouve sans commune — ce qu'un seul clic dans l'administration suffit à
   * provoquer.
   */
  function drawPack(setId) {
    // **Un booster ne donne que des cartes de stade 1.**
    //
    // Depuis que la rareté suit le stade, une rare est un stade 2 et une épique
    // un stade 3 : les tirer directement contournerait les 115 écharpes qu'ils
    // coûtent, et l'évolution ne servirait plus à rien. Le booster donne les
    // personnages, les doublons donnent les écharpes, les écharpes font
    // grandir les personnages. C'est la boucle entière du jeu.
    const base = publies().filter((f) => f.set === setId && f.stage === 1);
    const pool_ = (rar) => base.filter((f) => f.rar === rar);
    // Le dernier filet, qui ne doit jamais être vide.
    const toutes = base;
    if (!toutes.length) {
      throw new Error(`La série « ${setId} » n'a aucune carte de stade 1 publiée : `
        + 'impossible d’en tirer un booster. Les évolutions ne se tirent pas, elles '
        + 's’achètent — il faut donc au moins un personnage de stade 1 publié dans '
        + 'cette série, ou la retirer des boosters proposés.');
    }

    const ECHELLE = ['legendaire', 'epique', 'rare', 'commune'];

    /* **Le tirage de rareté va sur les places qui rendent un supporter.**
     *
     * Il allait sur les deux dernières, et `RATES` le dit encore : « les deux
     * dernières places sont les seules qui peuvent tomber sur une légendaire ».
     * Mais `openPack` a fait des trois dernières places des places ouvertes,
     * qui ne rendent plus jamais de supporter : le tirage de rareté roulait
     * donc sur des cartes systématiquement jetées.
     *
     * Résultat : **aucune légendaire ne pouvait sortir d'un booster**, et les
     * quatorze personnages légendaires publiés étaient hors d'atteinte. Les
     * deux règles étaient justes chacune de son côté et fausses ensemble — ce
     * que ni l'une ni l'autre ne pouvait dire seule, puisqu'elles vivent à cent
     * lignes d'écart. C'est `scripts/economie.mjs` qui l'a vu, en mesurant ce
     * qu'un booster rend au lieu de le supposer.
     *
     * Les deux places conservées portent donc les deux tables : la première au
     * taux le plus prudent, la deuxième au plus généreux. */
    const PLACES_QUI_ROULENT = 2;
    return Array.from({ length: 5 }, (_, i) => {
      const vise = i < PLACES_QUI_ROULENT ? pickRarity(i + 4) : 'commune';
      // On redescend depuis le cran visé : une série sans épique donne une rare
      // plutôt qu'une commune, ce qui reste plus proche de ce qu'on promettait.
      const depart = Math.max(0, ECHELLE.indexOf(vise));
      for (const rar of ECHELLE.slice(depart)) {
        const p = pool_(rar);
        if (p.length) return rnd(p);
      }
      return rnd(toutes);
    });
  }

  /**
   * Ce que peut contenir une place ouverte, c'est-à-dire une place qui n'est
   * pas réservée à un supporter.
   *
   * Sept pièces d'équipement et quinze cartes d'action sur vingt et une
   * n'étaient **obtenables nulle part** : le paquet de bienvenue en donnait une
   * de chaque, au hasard, et c'était tout. Un joueur pouvait ouvrir trois cents
   * boosters sans jamais voir un mégaphone.
   *
   * **Il n'y a plus de supporter dans cette table.** Un booster en donnait
   * quatre sur cinq en moyenne — trois garantis, plus une chance sur deux à
   * chacune des deux dernières places — et l'ouverture se ressemblait d'une
   * fois sur l'autre : une pile de têtes, dont la plupart en double. Les places
   * ouvertes donnent maintenant autre chose, toujours.
   *
   * Les écharpes en font partie, et ce n'est pas un lot de consolation : c'est
   * ce qui paie les évolutions, donc les âges qu'on ne tire jamais. C'est aussi
   * le seul lot qui ne peut pas être vide, et il sert donc de dernier recours à
   * un joueur qui possède déjà toutes les tenues, tout l'équipement et toutes
   * les cartes d'action — à qui l'on rendait un supporter de plus.
   *
   * @returns {{carte, scarves}}
   */
  const PLACES_OUVERTES = [
    ['action', 0.28],
    ['stuff', 0.23],
    ['skin', 0.14],
    /* **Les états.** Quatre dessins par âge — la joie, le dépit,
       l'encouragement, la colère — qui étaient donnés avec le personnage et
       que plus rien ne faisait désirer. Ils se gagnent maintenant, comme les
       tenues et pour la même raison : ça donne une raison de rouvrir un
       booster une fois qu'on a la tête qu'on voulait.

       Douze pour cent, soit un peu moins que les tenues : il y en a quatre
       par âge contre une poignée de tenues, donc la case se remplit vite si
       on tire trop souvent dedans — et une case qui se remplit vite cesse de
       faire envie. */
    ['etat', 0.12],
    ['echarpes', 0.23],
  ];

  /* Trois poignées, de la plus probable à la plus rare. Un booster coûte
     quarante-cinq écharpes ; trois places ouvertes en rendent donc rarement le
     prix, et c'est voulu — on achète des cartes, pas de la monnaie. */
  const POIGNEES = [[6, 0.55], [14, 0.33], [30, 0.12]];

  function tirerCategorie() {
    const r = Math.random();
    let acc = 0;
    for (const [cat, p] of PLACES_OUVERTES) { acc += p; if (r < acc) return cat; }
    return 'echarpes';
  }

  function tirerPoignee() {
    const r = Math.random();
    let acc = 0;
    for (const [n, p] of POIGNEES) { acc += p; if (r < acc) return n; }
    return POIGNEES[0][0];
  }

  async function tirerAutreChose(ctx) {
    const { conn, userId, avant, stadeDe, skinsPris, etatsPris,
      stuffPris, actionsPrises } = ctx;
    const cat = tirerCategorie();

    /* Les écharpes. Le seul lot qui ne peut pas être vide, et donc le recours
       de toutes les autres catégories : voir les `return echarpes()` plus bas,
       qui remplacent les anciens `return null` — lesquels rendaient la main au
       supporter tiré, c'est-à-dire à la carte qu'on cherche justement à ne plus
       donner cinq fois. */
    const echarpes = () => {
      const n = tirerPoignee();
      return { carte: { type: 'echarpes', id: 'echarpes', montant: n, new: false },
               scarves: n };
    };
    if (cat === 'echarpes') return echarpes();

    /* Chaque catégorie peut être vide — tout l'équipement déjà possédé, aucun
       Fanzzy à habiller. On retombe alors sur le supporter plutôt que de rendre
       une place blanche : une carte vide dans un booster est pire qu'une carte
       banale. */

    if (cat === 'skin') {
      // Un skin habille **un âge précis**. On ne propose donc que les âges que
      // le joueur a débloqués : lui donner la tenue d'hiver d'un Capo qu'il
      // n'a pas encore serait un cadeau qu'il ne peut pas ouvrir.
      const places = [];
      for (const id of avant) {
        const stade = stadeDe.get(id) ?? 1;
        for (let s = 1; s <= stade; s++) {
          for (const sk of tenuesPubliees()) {
            if (sk.id === 'base') continue;
            if (!skinsPris.has(`${id}:${s}:${sk.id}`)) places.push({ id, stade: s, skin: sk.id });
          }
        }
      }
      if (!places.length) return echarpes();
      const p = rnd(places);
      skinsPris.add(`${p.id}:${p.stade}:${p.skin}`);
      await conn.query(
        `INSERT IGNORE INTO user_skins (user_id, fanzzy_id, stage, skin_id) VALUES (?, ?, ?, ?)`,
        [userId, p.id, p.stade, p.skin]);
      return { carte: { type: 'skin', id: p.skin, pour: p.id, stade: p.stade, new: true },
        scarves: 0 };
    }

    /* **Un état appartient à un âge**, exactement comme une tenue : le Capo
       n'hérite pas de la joie du gamin. On ne propose donc que les âges
       débloqués, et que les états qui manquent encore.

       Ce qui n'est pas gagné n'est pas perdu pour le jeu : `fanzzy-etats.js`
       retombe sur le repos, et le personnage reste affiché sans son
       expression. Aucun effet sur les règles — un état ne donne pas plus de
       souffle qu'un skin ne donne de puissance. */
    if (cat === 'etat') {
      // Table absente : rien à ranger, donc rien à tirer. Voir la garde posée
      // sur sa lecture dans `openPack`.
      if (!etatsPris) return echarpes();
      const places = [];
      for (const id of avant) {
        const stade = stadeDe.get(id) ?? 1;
        for (let s = 1; s <= stade; s++) {
          for (const e of ETATS_DESSINES) {
            if (!etatsPris.has(`${id}:${s}:${e}`)) places.push({ id, stade: s, etat: e });
          }
        }
      }
      if (!places.length) return echarpes();
      const p = rnd(places);
      etatsPris.add(`${p.id}:${p.stade}:${p.etat}`);
      await conn.query(
        `INSERT IGNORE INTO user_etats (user_id, fanzzy_id, stage, etat) VALUES (?, ?, ?, ?)`,
        [userId, p.id, p.stade, p.etat]);
      return { carte: { type: 'etat', id: p.etat, pour: p.id, stade: p.stade, new: true },
        scarves: 0 };
    }

    if (cat === 'stuff') {
      /* **Ce que la saison a ouvert, et non tout ce que le code connaît.**
         C'est la règle des séries, appliquée à l'équipement : `publies` rend la
         liste du code tant que `sql/contenus.sql` n'est pas appliqué, donc une
         base incomplète joue exactement comme avant au lieu de se vider. */
      const ouvert = jouables('stuff');
      const def = ouvert.find((s) => s.rar === pickRarity(5) && !stuffPris.has(s.id))
        ?? ouvert.find((s) => !stuffPris.has(s.id));
      // Tout possédé : un doublon d'équipement rapporte des écharpes, comme un
      // doublon de supporter. Il ne se perd pas.
      if (!def) {
        /* Le doublon se tire parmi l'**ouvert** lui aussi. Le tirer dans la
           liste entière ne donnerait rien de neuf — un doublon ne donne que des
           écharpes — mais il nommerait au joueur une pièce qu'il ne peut pas
           avoir, et une carte qui passe est une carte qu'on a vue. */
        const dedans = rnd(ouvert.length ? ouvert : STUFF);
        await conn.query(
          `UPDATE user_stuff SET copies = copies + 1 WHERE user_id = ? AND stuff_id = ?`,
          [userId, dedans.id]);
        return { carte: { type: 'stuff', id: dedans.id, new: false },
          scarves: SCARVES[dedans.rar] ?? 1 };
      }
      stuffPris.add(def.id);
      await conn.query(
        `INSERT INTO user_stuff (user_id, stuff_id, copies) VALUES (?, ?, 1)
         ON DUPLICATE KEY UPDATE copies = copies + 1`, [userId, def.id]);
      return { carte: { type: 'stuff', id: def.id, new: true }, scarves: 0 };
    }

    /* La dernière branche est **nommée**, et ce qui reste tombe en écharpes.
       Elle ne l'était pas : toute catégorie sans branche à elle finissait ici,
       en carte d'action, sans que rien ne le dise. Ajouter une ligne à
       `PLACES_OUVERTES` sans écrire la branche qui va avec donnait donc
       silencieusement autre chose que ce qu'on avait déclaré — et un contrôle
       qui remet « fanzzy » dans la table restait vert, puisque le supporter
       promis sortait en carte d'action. */
    if (cat !== 'action') return echarpes();

    // Une carte d'action ne se possède qu'une fois : le deck en accepte dix
    // exemplaires, mais c'est le même droit répété. Un doublon rapporte donc
    // des écharpes plutôt qu'une ligne de plus.
    const libres = jouables('action')
      .filter((a) => a.rar !== 'commune' && !actionsPrises.has(a.id));
    if (!libres.length) return echarpes();
    const vise = pickRarity(5);
    const def = rnd(libres.filter((a) => a.rar === vise).length
      ? libres.filter((a) => a.rar === vise) : libres);
    actionsPrises.add(def.id);
    await conn.query(
      `UPDATE user_wallet SET action_cards = JSON_ARRAY_APPEND(
         COALESCE(action_cards, JSON_ARRAY()), '$', ?) WHERE user_id = ?`,
      [def.id, userId]);
    return { carte: { type: 'action', id: def.id, new: true }, scarves: 0 };
  }

  /**
   * Ouvre un booster. Toute l'opération est transactionnelle : sans cela, deux
   * requêtes lancées en même temps consommeraient un seul booster pour deux
   * tirages.
   */
  async function openPack(userId, setId, { buy = false } = {}) {
    if (!SETS.some((s) => s.id === setId)) throw fail('fanzzy.error.unknown_set');
    // Une série fermée ne distribue plus. Le kiosque ne la propose pas, mais un
    // client modifié — ou un onglet resté ouvert depuis avant la fermeture —
    // peut encore demander son booster : le refus se décide ici.
    if (!serieOuverte(setId)) throw fail('fanzzy.error.set_closed');

    /* **Il n'y a plus de second verrou.** Le niveau du joueur en posait un :
       une série pouvait être ouverte pour tout le monde et hors de portée pour
       celui-là. Deux règles pour une question, et le joueur devait comprendre
       laquelle le refusait.

       Les séries s'ouvrent maintenant par saison, pour tout le monde le même
       jour. `fanzzy.error.set_locked` n'est plus émis nulle part ; le message
       reste traduit côté client le temps qu'un onglet resté ouvert depuis avant
       le déploiement finisse sa session. */

    /* **La recharge se fait sous le verrou, dans la transaction du débit.**
       Elle se faisait avant, par `wallet()`, hors transaction : deux
       ouvertures simultanées rechargeaient chacune la même réserve, et
       l'écriture absolue de la seconde effaçait le débit de la première
       (`RISQUES.md`, E3). La règle de recharge se lit **avant** de prendre
       la connexion : `estAbonne` passe par le pool, et l'attendre en tenant
       un verrou peut affamer le pool. */
    const regle = regleDe(await abonneDe(userId));
    await assurerBourse(q, userId);

    let resultat;
    /* **Ce que cette ouverture a prélevé**, rendu tel quel (`paye`,
       `CONTRATS.md` § 13.2) : le kiosque ne le déduit plus d'un solde qu'il
       n'a relu qu'au chargement,
       qui lui faisait annoncer « −45 » pour un booster gratuit après un achat
       fait dans un autre onglet. Zéro quand la réserve a payé, y compris
       pour un paquet demandé à l'achat. */
    let paye = 0;
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      /* La première lecture de la recharge est le `FOR UPDATE` de la bourse :
         c'est elle qui fait passer les ouvertures d'un même joueur l'une après
         l'autre. */
      const w = await rechargerLigne(conn, userId, regle, null);
      if (!w) {
        throw new Error(`fanzzy : aucune bourse pour ${userId} — le joueur n'existe pas `
          + 'dans users, assurerBourse n’a rien pu ouvrir');
      }

      if (w.packs > 0) {
        /* Le compte à rebours n'a plus à être touché ici : si la réserve était
           pleine, la recharge qu'on vient de faire l'a fait repartir de
           maintenant. L'ancienne écriture comparait au plafond du joueur
           gratuit, et remettait à zéro la minuterie d'un abonné à douze
           boosters sur un plafond plus haut. */
        await conn.query(`UPDATE user_wallet SET packs = packs - 1 WHERE user_id = ?`, [userId]);
      } else if (buy) {
        /* Le prix lu une fois : celui qu'on débite est celui qu'on rend, même
           si l'administration change le réglage entre les deux lectures. */
        const prix = prixPack();
        const [d] = await conn.query(
          `UPDATE user_wallet SET scarves = scarves - ? WHERE user_id = ? AND scarves >= ?`,
          [prix, userId, prix]);
        if (!d.affectedRows) throw fail('fanzzy.error.not_enough_scarves');
        paye = prix;
      } else {
        throw fail('fanzzy.error.no_packs');
      }

      /* **Une trace, pas une ressource.** Ce compteur ne décroît jamais et
         n'entre dans aucun calcul de jeu : il sert au parcours des premiers pas,
         qui a besoin de savoir qu'un booster a été ouvert et ne peut le deviner
         de nulle part ailleurs. Voir `sql/aide.sql`.

         Ici et non après le tirage : il compte les paquets **payés**, et un
         paquet payé l'est même si la suite échoue. C'est d'ailleurs le seul
         endroit du jeu où un paquet se débite.

         **Et il ne peut pas faire échouer l'ouverture.** Sans `sql/aide.sql`, la
         colonne n'existe pas : le joueur perdrait ses cinq cartes pour un
         compteur qui ne sert qu'à cocher une case sur un écran d'aide. Le
         marché est trop mauvais dans ce sens-là. Une instruction qui échoue
         n'annule pas la transaction en cours — seulement elle-même — donc le
         reste du paquet se déroule intact, et le parcours lira simplement
         « pas encore ouvert ». */
      try {
        await conn.query(
          `UPDATE user_wallet SET packs_ouverts = packs_ouverts + 1 WHERE user_id = ?`,
          [userId]);
      } catch (e) {
        if (e?.code !== 'ER_BAD_FIELD_ERROR') throw e;
      }

      const pull = drawPack(setId);

      const [owned] = await conn.query(
        `SELECT fanzzy_id FROM user_fanzzy WHERE user_id = ?`, [userId]);
      const had = new Set(owned.map((o) => o.fanzzy_id));
      // Les stades atteints : un skin se gagne **pour un âge**, et on ne peut
      // en gagner un que pour un âge que le joueur a effectivement débloqué.
      const [stadesOwned] = await conn.query(
        `SELECT fanzzy_id, stage FROM user_fanzzy WHERE user_id = ?`, [userId]);
      const stadeDe = new Map(stadesOwned.map((s) => [s.fanzzy_id, Number(s.stage)]));

      const [skinsOwned] = await conn.query(
        `SELECT fanzzy_id, stage, skin_id FROM user_skins WHERE user_id = ?`, [userId]);
      const skinsPris = new Set(
        skinsOwned.map((s) => `${s.fanzzy_id}:${s.stage}:${s.skin_id}`));

      /* Les états déjà gagnés, lus une fois pour les cinq places : sans ça,
         deux places du même booster pourraient offrir deux fois la même joie
         — l'`INSERT IGNORE` l'absorberait en base, et le joueur verrait deux
         cartes « NOUVEAU » pour un seul gain. */
      let etatsPris = null;
      try {
        const [etatsOwned] = await conn.query(
          `SELECT fanzzy_id, stage, etat FROM user_etats WHERE user_id = ?`, [userId]);
        etatsPris = new Set(
          etatsOwned.map((e) => `${e.fanzzy_id}:${e.stage}:${e.etat}`));
      } catch (e) {
        if (e.code !== 'ER_NO_SUCH_TABLE') throw e;
      }

      const [stuffOwned] = await conn.query(
        `SELECT stuff_id FROM user_stuff WHERE user_id = ?`, [userId]);
      const stuffPris = new Set(stuffOwned.map((s) => s.stuff_id));

      const [wRow] = await conn.query(
        `SELECT action_cards FROM user_wallet WHERE user_id = ?`, [userId]);
      const brutActions = wRow[0]?.action_cards;
      const actionsPrises = new Set(typeof brutActions === 'string'
        ? JSON.parse(brutActions) : (brutActions ?? []));

      // Photographie de la collection avant ouverture : un skin ne peut pas
      // habiller un supporter reçu dans le même paquet. Le joueur n'a pas
      // encore eu le temps de le regarder.
      const avant = new Set(had);

      let scarves = 0;
      const cards = [];

      for (const [i, f] of pull.entries()) {
        /* Un ou deux supporters par booster, jamais plus.
         *
         * La première place en est un : c'est la garantie, et elle tient toute
         * l'ouverture — personne ne doit tomber sur cinq objets et zéro
         * personnage. La deuxième en est un sept fois sur dix, ce qui fait la
         * différence entre deux boosters ouverts à la suite.
         *
         * Les trois dernières n'en sont jamais. Avant, un booster donnait
         * quatre têtes sur cinq en moyenne, dont la plupart en double : la
         * collection avançait, mais l'équipement, les tenues et les cartes
         * d'action n'arrivaient presque jamais, et deux ouvertures se
         * ressemblaient. */
        const ouverte = i >= 2 || (i === 1 && Math.random() >= 0.7);
        if (ouverte) {
          const autre = await tirerAutreChose({
            conn, userId, avant, stadeDe, skinsPris, etatsPris, stuffPris, actionsPrises });
          if (autre) {
            scarves += autre.scarves ?? 0;
            cards.push(autre.carte);
            continue;
          }
        }

        const isNew = !had.has(f.id);
        if (isNew) had.add(f.id); else scarves += SCARVES[f.rar];
        cards.push({ type: 'fanzzy', id: f.id, new: isNew });
        await conn.query(
          `INSERT INTO user_fanzzy (user_id, fanzzy_id, copies) VALUES (?, ?, 1)
           ON DUPLICATE KEY UPDATE copies = copies + 1`,
          [userId, f.id]);
        if (!stadeDe.has(f.id)) stadeDe.set(f.id, 1);
        // Le skin de base accompagne toujours le supporter, au premier âge —
        // le seul qu'il ait en sortant d'un booster.
        await conn.query(
          `INSERT IGNORE INTO user_skins (user_id, fanzzy_id, stage, skin_id, equipped)
           VALUES (?, ?, 1, 'base', 1)`,
          [userId, f.id]);
        skinsPris.add(`${f.id}:1:base`);
      }
      if (scarves) {
        await conn.query(`UPDATE user_wallet SET scarves = scarves + ? WHERE user_id = ?`,
          [scarves, userId]);
      }

      // Premier Fanzzy obtenu : on l'équipe d'office, sinon le duel démarre nu.
      const premierFanzzy = cards.find((c) => c.type === 'fanzzy')?.id ?? pull[0].id;
      await conn.query(
        `UPDATE user_wallet SET active_fanzzy = COALESCE(active_fanzzy, ?) WHERE user_id = ?`,
        [premierFanzzy, userId]);

      await conn.commit();

      /* **La clé de chaque carte**, celle de sa nouveauté (`CONTRATS.md`,
         § 2.3) : la page éteint par elle ce qu'elle vient de montrer. Une
         poignée d'écharpes n'en a pas, elle ne se collectionne pas. */
      for (const c of cards) {
        const cle = cleDeCarte(c);
        if (cle) c.cle = cle;
      }
      resultat = { cards, scarvesGained: scarves, paye, series: progressionSeries(avant, had, cards) };
    } catch (e) {
      await conn.rollback().catch(() => {});
      throw e;
    } finally {
      conn.release();
    }

    /* **Après la validation, jamais dedans**, et la connexion rendue : la
       nouveauté et le compteur du jour sont des écritures annexes. Sans leur
       table (`sql/quotidien.sql` pas encore appliqué), le joueur garde ses
       cinq cartes — perdre un booster pour une pastille serait un marché
       absurde. Une instruction en échec dans la transaction ne l'aurait pas
       annulée, mais elle aurait fait lever l'ouverture entière. */
    await noterNouveautes(userId, resultat.cards.filter((c) => c.new && c.cle).map((c) => c.cle));
    await compterDuJour(userId, 'booster');

    /* L'XP **après** la validation, et hors de la transaction.
       Le booster est ouvert : les cartes sont dans la collection et le
       joueur les a vues. Faire échouer tout ça parce qu'une barre de
       progression n'a pas pu monter serait absurde — `gagner()` avale déjà
       ses propres incidents et rend une progression nulle.

       **Et jamais `gagner()` depuis l'intérieur de la transaction.** Il
       prend sa propre connexion et verrouille la même ligne de `user_wallet`
       que le débit ci-dessus : appelé avant le `COMMIT`, il attendrait ce
       verrou que nous tenons, cinquante secondes, puis perdrait l'XP. Si
       l'XP du booster doit un jour entrer dans la transaction, c'est
       `niveau.gagnerDans(conn, userId, XP.pack)`, sur la même connexion —
       la porte du grand livre. */
    const monte = niveau ? await niveau.gagner(userId, XP.pack) : null;

    const { series, ...reste } = resultat;
    return { ...reste,
      /* Absent si le calcul a échoué : la page garde alors son propre calcul
         de la ligne de série (`CONTRATS.md`, § 2.3). */
      ...(series ? { series } : {}),
      ...(monte?.xp ? { niveau: monte } : {}) };
  }

  /**
   * **La progression des séries touchées par ce booster** (`CONTRATS.md`,
   * § 2.3), calculée en mémoire sur ce que l'ouverture a déjà lu : aucune
   * requête de plus.
   *
   * On compte des **lignées obtenables** — un personnage publié d'une série
   * ouverte, comme la jauge de la collection —, pas des lignes de catalogue :
   * une lignée dépubliée qu'on possède encore ne doit pas faire dépasser le
   * total. `complete` n'est vrai qu'au booster qui complète : celui d'après
   * trouve déjà la série pleine en arrivant.
   *
   * @returns {Array|undefined}  `[]` sans personnage ; `undefined` si le
   *   calcul a échoué, et la réponse n'a alors pas de champ `series`.
   */
  function progressionSeries(avant, apres, cards) {
    try {
      const touchees = [...new Set(cards.filter((c) => c.type === 'fanzzy')
        .map((c) => parIdentifiant(c.id)?.set).filter(Boolean))];
      if (!touchees.length) return [];
      const ob = obtenables();
      return touchees.map((id) => {
        const dans = ob.filter((f) => f.set === id);
        const compte = (s) => dans.filter((f) => s.has(f.id)).length;
        const a = compte(avant);
        const b = compte(apres);
        return { id, avant: a, apres: b, total: dans.length,
          complete: dans.length > 0 && b === dans.length && a < dans.length };
      });
    } catch (e) {
      signalerAnnexe('series', e);
      return undefined;
    }
  }

  /* ------------------------------------------------ nouveautés et compteurs */

  /**
   * Inscrit des nouveautés, **hors transaction**, après la validation de ce
   * qui les a données. Une seule instruction pour tout un booster.
   *
   * `ON DUPLICATE KEY UPDATE got_at = got_at` et non `INSERT IGNORE` : le
   * doublon reste sans effet, mais une autre faute (une clé trop longue) lève
   * au lieu de s'écrire tronquée en silence.
   */
  async function noterNouveautes(userId, cles) {
    if (!cles.length) return;
    try {
      await q(
        `INSERT INTO user_nouveautes (user_id, cle, sorte)
         VALUES ${cles.map(() => '(?, ?, ?)').join(', ')}
         ON DUPLICATE KEY UPDATE got_at = got_at`,
        cles.flatMap((k) => [userId, k, sorteDeCle(k)]));
    } catch (e) {
      signalerAnnexe('user_nouveautes', e);
    }
  }

  /**
   * Inscrit une nouveauté **dans** la transaction de l'appelant : l'étal.
   *
   * Si le débit échoue ensuite, la nouveauté part avec le `rollback` — un
   * objet « nouveau » qu'on n'a pas eu serait une promesse fausse. Seule la
   * table absente est tolérée : une instruction en échec n'annule pas la
   * transaction, et l'achat se fait sans sa nouveauté. Toute autre erreur
   * fait échouer l'achat, comme n'importe quelle écriture de l'étal.
   */
  async function noterNouveauteDans(conn, userId, cle) {
    try {
      await conn.query(
        `INSERT INTO user_nouveautes (user_id, cle, sorte) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE got_at = got_at`, [userId, cle, sorteDeCle(cle)]);
    } catch (e) {
      if (e?.code !== 'ER_NO_SUCH_TABLE') throw e;
      signalerAnnexe('user_nouveautes', e);
    }
  }

  /**
   * Ce qui n'a de ligne datée nulle part ailleurs : un booster ouvert, une
   * évolution. Les missions du jour les comptent (`quotidien`). Le jour est
   * celui de la base, `CURDATE()` — celui des quotas et des missions —,
   * jamais un jour fabriqué ici.
   */
  async function compterDuJour(userId, cle) {
    try {
      await q(
        `INSERT INTO compteurs_jour (user_id, jour, cle, n) VALUES (?, CURDATE(), ?, 1)
         ON DUPLICATE KEY UPDATE n = n + 1`, [userId, cle]);
    } catch (e) {
      signalerAnnexe('compteurs_jour', e);
    }
  }

  /**
   * Les nouveautés du joueur, les plus récentes d'abord, deux cents au plus
   * (`CONTRATS.md`, § 2.1). `undefined` si la table manque : le serveur ne
   * sait pas, et la réponse n'a pas de champ — ce qui n'est pas « rien de
   * nouveau » (`[]`).
   *
   * **Une seule lecture**, qui dit aussi s'il traîne des nouveautés de plus
   * de soixante jours : la purge du joueur ne se fait que quand il y en a,
   * sans tâche périodique à tenir.
   */
  async function nouveautes(userId) {
    let rows;
    try {
      rows = await q(
        `SELECT cle, vieille FROM (
            (SELECT cle, got_at, 0 AS vieille FROM user_nouveautes
              WHERE user_id = ? AND got_at >= NOW(3) - INTERVAL 60 DAY
              ORDER BY got_at DESC, cle LIMIT 200)
            UNION ALL
            (SELECT cle, got_at, 1 AS vieille FROM user_nouveautes
              WHERE user_id = ? AND got_at < NOW(3) - INTERVAL 60 DAY LIMIT 1)
          ) t
          ORDER BY vieille, got_at DESC, cle`, [userId, userId]);
    } catch (e) {
      if (!estSchema(e)) throw e;
      signalerAnnexe('user_nouveautes', e);
      return undefined;
    }
    if (rows.some((r) => Number(r.vieille) === 1)) {
      await q(`DELETE FROM user_nouveautes WHERE user_id = ? AND got_at < NOW(3) - INTERVAL 60 DAY`,
        [userId]).catch((e) => signalerAnnexe('user_nouveautes', e));
    }
    return rows.filter((r) => Number(r.vieille) === 0).map((r) => nouveauteDe(r.cle)).filter(Boolean);
  }

  /** Ce qu'éteindre veut dire, sous les trois formes du contrat (§ 2.2). */
  function lireDemandeVu(corps) {
    const c = corps && typeof corps === 'object' && !Array.isArray(corps) ? corps : {};
    const formes = ['cles', 'sorte', 'tout'].filter((k) => c[k] !== undefined);
    if (formes.length !== 1) throw fail('fanzzy.error.vu_invalide');
    if (formes[0] === 'tout') {
      if (c.tout !== true) throw fail('fanzzy.error.vu_invalide');
      return { tout: true };
    }
    if (formes[0] === 'sorte') {
      if (!SORTES_NOUVEAUTE.includes(c.sorte)) throw fail('fanzzy.error.vu_invalide');
      return { sorte: c.sorte };
    }
    if (!Array.isArray(c.cles) || c.cles.length > 200
      || !c.cles.every((k) => typeof k === 'string' && k.length >= 1 && k.length <= 80)) {
      throw fail('fanzzy.error.vu_invalide');
    }
    return { cles: [...new Set(c.cles)] };
  }

  /**
   * Éteindre des nouveautés, et dire combien il en reste — compté comme la
   * liste les sert (soixante jours, deux cents au plus), pour que la pastille
   * et la liste disent le même nombre.
   */
  async function eteindre(userId, corps) {
    const d = lireDemandeVu(corps);
    try {
      if (d.tout) {
        await q(`DELETE FROM user_nouveautes WHERE user_id = ?`, [userId]);
      } else if (d.sorte) {
        await q(`DELETE FROM user_nouveautes WHERE user_id = ? AND sorte = ?`, [userId, d.sorte]);
      } else if (d.cles.length) {
        await q(`DELETE FROM user_nouveautes WHERE user_id = ? AND cle IN (${
          d.cles.map(() => '?').join(', ')})`, [userId, ...d.cles]);
      }
      const [r] = await q(
        `SELECT LEAST(COUNT(*), 200) AS n FROM user_nouveautes
          WHERE user_id = ? AND got_at >= NOW(3) - INTERVAL 60 DAY`, [userId]);
      return { restantes: Number(r.n) };
    } catch (e) {
      /* Sans la table, il n'y a rien à éteindre et rien qui reste : la page
         n'a de toute façon rien reçu à montrer. */
      if (!estSchema(e)) throw e;
      signalerAnnexe('user_nouveautes', e);
      return { restantes: 0 };
    }
  }

  /* ----------------------------------------------------------- évolution

     Faire évoluer ne remplace plus une carte par une autre : **le personnage
     grandit**. Sa ligne dans la collection reste la même, son compteur d'âge
     avance d'un cran.

     Deux conséquences voulues.

     Les **doublons ne se consomment plus**. L'ancienne version retirait un
     exemplaire du premier âge pour en poser un du second ; quand le joueur n'en
     avait qu'un, elle supprimait sa ligne et en créait une autre. C'était
     invisible tant que les deux âges étaient deux cartes. Ce ne l'est plus :
     décrémenter jusqu'à zéro reviendrait à lui reprendre le personnage qu'il
     vient de payer. Les écharpes sont le seul coût, et c'est sur elles que
     l'économie est calibrée.

     Et le **stade est plafonné par ce qui est écrit**. Cent cinquante-deux
     personnages n'ont encore qu'un âge : leur évolution se refuse avec un code
     que le client sait nommer, au lieu de laisser passer un stade 2 qui ne
     correspond à aucune fiche et dont plus rien ne saurait tirer un nom.      */

  async function evolve(userId, idDemande) {
    // On accepte l'identifiant de n'importe quel âge : un deck ou un lien
    // enregistré avant le repliage désigne encore « TR32B ».
    const id = racineDe(String(idDemande));
    const perso = parIdentifiant(id);
    if (!perso) throw fail('fanzzy.error.unknown');

    let resultat;
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [[have]] = await conn.query(
        `SELECT copies, stage FROM user_fanzzy WHERE user_id = ? AND fanzzy_id = ? FOR UPDATE`,
        [userId, id]);
      if (!have || have.copies < 1) throw fail('fanzzy.error.not_owned');

      const vers = Number(have.stage) + 1;
      const age = auStade(id, vers);
      if (!age) throw fail('fanzzy.error.no_evolution');
      const cost = EVO_COST[vers] ?? 90;

      const [d] = await conn.query(
        `UPDATE user_wallet SET scarves = scarves - ? WHERE user_id = ? AND scarves >= ?`,
        [cost, userId, cost]);
      if (!d.affectedRows) throw fail('fanzzy.error.not_enough_scarves');

      // `AND stage = ?` : la ligne est déjà verrouillée, mais cette condition
      // rend l'écriture juste même si elle ne l'était pas. Deux évolutions
      // lancées en même temps ne peuvent pas faire sauter deux stades pour le
      // prix d'un.
      await conn.query(
        `UPDATE user_fanzzy SET stage = ? WHERE user_id = ? AND fanzzy_id = ? AND stage = ?`,
        [vers, userId, id, have.stage]);

      /* Le nouvel âge a besoin d'une tenue.
         Depuis qu'un skin appartient à un âge et non au personnage, grandir
         sans cette ligne laisserait le Capo sans rien à porter : la fiche
         n'aurait aucun skin à montrer, et l'accueil chercherait un dossier
         `e2/` qu'aucun skin ne désigne. Le skin de base, donc, comme à
         l'acquisition. */
      await conn.query(
        `INSERT IGNORE INTO user_skins (user_id, fanzzy_id, stage, skin_id, equipped)
         VALUES (?, ?, ?, 'base', 1)`,
        [userId, id, vers]);

      await conn.commit();
      resultat = { id, stade: vers, nom: age.nom, rar: age.rar, spent: cost,
        // `from`/`to` restent pour les pages qui les lisent encore. Ils
        // désignent maintenant deux âges du même personnage, pas deux cartes.
        from: id, to: age.id };
    } catch (e) {
      await conn.rollback().catch(() => {});
      throw e;
    } finally {
      conn.release();
    }

    /* Le nouvel âge est une nouveauté, et une évolution compte pour la
       mission « Fais grandir un Fanzzy ». Après la validation, comme au
       booster : ni l'une ni l'autre ne peut défaire ce que le joueur a payé. */
    await noterNouveautes(userId, [`age:${id}:${resultat.stade}`]);
    await compterDuJour(userId, 'evolution');
    return resultat;
  }

  const fail = (code) => Object.assign(new Error(code), { code });

  /**
   * Traduit une erreur technique en code lisible par le client.
   *
   * Sans cela, une table manquante remonte sous le code `ER_NO_SUCH_TABLE`,
   * que le client ne reconnaît pas et affiche en « impossible ». On perd alors
   * la seule information utile : le schéma n'est pas à jour.
   */
  const traduire = (e) => {
    if (e.code && String(e.code).startsWith('fanzzy.')) return e;
    if (/doesn't exist|Unknown column/i.test(e.message ?? '')) {
      const t = Object.assign(new Error(e.message), { code: 'fanzzy.error.schema' });
      t.detail = 'Applique sql/inventaire.sql, sql/deck.sql, sql/admin.sql '
        + 'puis sql/rattrapage.sql';
      console.error('[fanzzy] schéma incomplet :', e.message);
      return t;
    }
    console.error('[fanzzy]', e.message);
    return Object.assign(new Error(e.message), { code: 'fanzzy.error.server' });
  };

  /**
   * La saison annoncée (`CONTRATS.md`, § 7.2), telle que le périmètre des
   * saisons la décide : `saisonProchaine()` (présente jusqu'à la fin du jour
   * annoncé, absente sans date d'ouverture) et `seriesAnnoncees()` (les
   * séries qu'elle ouvrira, `{ série: numéro }`, celles qui sont fermées
   * aujourd'hui seulement).
   *
   * Ce module n'en recalcule rien : une seconde règle pour « quelles séries
   * ouvrira-t-elle » finirait par ne pas dire la même chose que la première.
   * Il ne garde que les champs du contrat — la réponse de `/dex` est publique.
   *
   * @returns {{ contrat: object, parSerie: Object<string, number> } | null}
   */
  function saisonAnnoncee() {
    if (typeof saisons.saisonProchaine !== 'function') return null;
    let p;
    let parSerie = {};
    try {
      p = saisons.saisonProchaine();
      if (p && typeof saisons.seriesAnnoncees === 'function') parSerie = saisons.seriesAnnoncees() ?? {};
    } catch (e) {
      signalerAnnexe('saisonProchaine', e);
      return null;
    }
    if (!p || !Number.isInteger(Number(p.numero))) return null;
    const contrat = {};
    for (const k of ['id', 'numero', 'nom', 'ouvre', 'ouvreDansMs', 'joursAvant']) {
      if (p[k] !== undefined && p[k] !== null) contrat[k] = p[k];
    }
    return { contrat, parSerie };
  }

  /**
   * La saison en cours telle que `/dex` et `/state` la servent : la forme de
   * `CONTRATS.md`, § 7.1 — ses champs d'avant, plus `fin`, `finDansMs`,
   * `joursRestants` et `finie` —, et **sans `carnet`**.
   *
   * `saisonEnCours()` porte le carnet propre de la saison quand
   * l'administration en a saisi un, parce que le quotidien en a besoin pour
   * compter. Ici, il n'a rien à faire : `/dex` est public et mis en cache, le
   * carnet du joueur se lit dans `/api/quotidien` avec l'état de chaque
   * palier, et une seconde copie brute serait une seconde vérité. Un carnet
   * illisible en base y est même gardé tel que la main l'a tapé.
   *
   * `null` sans saison lancée, comme avant. L'objet rendu par
   * `saisonEnCours()` est neuf à chaque appel : le défaire ne touche personne.
   */
  function saisonServie() {
    const s = saisonEnCours();
    if (!s) return s;
    const { carnet: _carnet, ...servie } = s;
    return servie;
  }

  /* ------------------------------------------------------------- routes */

  const router = express.Router();
  router.use(express.json({ limit: '8kb' }));

  const send = (res, p) => p.then((v) => res.json(v))
    .catch((e) => {
      const t = traduire(e);
      res.status(400).json({ error: t.code, detail: t.detail });
    });

  /**
   * Le catalogue : envoyé une fois, mis en cache par le navigateur.
   *
   * Il porte **tout** ce dont une page a besoin pour afficher la collection,
   * y compris les paliers de rareté et les taux de tirage. Ce n'est pas du
   * zèle : tant qu'il manquait une seule de ces constantes, la page en gardait
   * une copie, et une copie finit toujours par diverger. C'est exactement ce
   * qui s'est produit — la lignée du Gamin de Devant manquait au catalogue
   * recopié dans la page alors que le serveur la tirait des boosters.
   */
  router.get('/dex', (_req, res) => {
    // Une minute et non une heure : la liste des séries ouvertes se change
    // depuis l'administration, et un kiosque qui met soixante minutes à
    // s'apercevoir qu'une série vient d'ouvrir n'est pas administrable.
    res.set('cache-control', 'public, max-age=60');
    const ouvertes = seriesOuvertes();
    const annoncee = saisonAnnoncee();
    res.json({
      // Tout le catalogue publié, y compris les séries fermées : un joueur qui
      // possède déjà une carte d'une série refermée doit continuer à la voir
      // dans son classeur et à la jouer. Fermer, c'est cesser de distribuer.
      //
      // `racine` et `stade` sont ajoutés ici plutôt que laissés à déduire. Une
      // page qui doit deviner qu'une entrée est le deuxième âge d'une autre le
      // devinera de travers le jour où la règle bouge, et elle le fera en
      // silence — c'est exactement la faute du catalogue recopié, sous une
      // autre forme.
      dex: publies().map((f) => ({ ...f, racine: racineDe(f.id),
        stade: lignee(f.id).findIndex((x) => x.id === f.id) + 1 })),
      /* `ouverte` porte l'information : le kiosque n'affiche que celles-là, et
         la progression ne se compte que sur elles. `saison` dit **par quelle
         saison** elle est arrivée — ce qui remplace l'ancien `niveau`, et qui
         est désormais la même chose pour tout le monde.

         Une série fermée n'a pas de saison : c'est ce qui permet à l'écran de
         dire « pas encore » plutôt que d'inventer une date. */
      sets: (() => {
        const parSerie = saisonDeSerie();
        return SETS.map((s) => ({ ...s, ouverte: serieOuverte(s.id),
          saison: parSerie[s.id] ?? null,
          /* Le numéro de la saison annoncée qui l'ouvrira, et rien sans
             annonce : le kiosque n'écrit « SAISON 2 » sur une série fermée
             que si ce champ est là (`CONTRATS.md`, § 7.2). */
          ...(Number.isInteger(annoncee?.parSerie[s.id])
            ? { prochaine: annoncee.parSerie[s.id] } : {}) }));
      })(),
      /* La saison en cours, pour que le kiosque puisse l'annoncer. Ici plutôt
         que dans `/state` : elle ne dépend pas du joueur, et cette réponse-ci
         est celle que toutes les pages chargent déjà. */
      saison: saisonServie(),
      /* La saison annoncée, seulement si l'administration a posé sa date
         d'ouverture : poser la date, c'est la promettre. */
      ...(annoncee ? { prochaine: annoncee.contrat } : {}),
      // Ce qu'un joueur peut encore obtenir. La page pourrait le recalculer,
      // mais elle le recalculerait *mal* le jour où la règle se nuance — et
      // c'est précisément le genre de copie que ce projet a déjà payé.
      aCollectionner: obtenables().length,
      seriesOuvertes: ouvertes,
      types: TYPES, scarves: SCARVES, evoCost: EVO_COST, rar: RAR, rates: RATES,
      // Un booster ne tire pas que des supporters : ses places 4 et 5
      // donnent des tenues, de l’équipement et des cartes d’action. La page
      // ne recevait que le catalogue Fanzzy, si bien qu’elle traitait les
      // trois autres comme des cartes inconnues — elle les jetait, prévenait
      // le joueur que sa version était périmée, et lui montrait trois cartes
      // en annonçant « 1 / 5 ». Ce qui se tire doit être servi.
      stuff: STUFF, actions: ACTIONS, tenues: toutesTenues(),
    });
  });

  /**
   * L'état du joueur.
   *
   * `series` y portait **les séries que ce joueur-là avait débloquées**, tirées
   * de son niveau. Il n'y en a plus : les séries s'ouvrent par saison, pour tout
   * le monde le même jour, et `/dex` les sert déjà à tous. Une liste par joueur
   * qui vaudrait la même chose pour tout le monde serait une requête de plus
   * pour redire ce qui est déjà dit.
   *
   * Ce qui reste vrai, et qui valait la peine : **un jeu ne cache pas ce qui
   * vient**. Le kiosque montre les séries fermées, verrouillées, en disant
   * qu'elles attendent une saison — plutôt que de laisser le joueur les
   * découvrir par un refus après avoir appuyé.
   *
   * `saisonVue` sert à ne montrer l'annonce qu'une fois. Ce joueur-là l'a vue
   * ou non : c'est bien un état de joueur, et sa place est ici.
   */
  /**
   * **La bibliothèque : tout ce qui se gagne, par type, et ce qu'on en a.**
   *
   * La carte « Collection » de l'accueil ne comptait que les personnages.
   * Les états, les tenues, l'équipement et les cartes d'action sortent des
   * mêmes boosters et n'étaient comptés nulle part : on croyait avoir
   * presque tout avec trente personnages sur trente-cinq.
   *
   * **L'univers est celui des boosters, et pas un autre.** Chaque ligne
   * reprend la règle de `openPack` :
   *   - les personnages publiés des séries ouvertes (`obtenables`) ;
   *   - pour chacun, ses âges écrits × les quatre états dessinables ;
   *   - pour chacun, ses âges × les tenues publiées, la base mise à part —
   *     elle ne se gagne pas, on l'a ;
   *   - l'équipement et les cartes d'action que la saison a ouverts.
   * Un compteur qui promettrait ce qu'aucun booster ne peut sortir serait
   * une jauge qui n'arrive jamais au bout.
   *
   * Les états et les tenues comptent **tout l'univers**, pas seulement les
   * âges débloqués : sinon le total grandirait à chaque évolution, et l'on
   * reculerait en progressant. Les stades n'y sont pas : ils ne se gagnent
   * pas encore (voir `stadeDeLaRencontre`).
   *
   * **Un seul compte, deux lecteurs.** La route lit par le pool ; la
   * réclamation d'un palier recompte **dans** la transaction du grand livre,
   * sur sa connexion, sous le verrou du joueur. Deux fonctions de compte
   * finiraient par ne pas compter la même chose, et un palier se paierait sur
   * un nombre que l'écran ne montre pas.
   *
   * **Les crans ne comptent pas les tenues** (`crans`, plus bas) : la jauge
   * les montre, les crans ne les paient pas. Voir `HORS_CRANS`.
   *
   * @param lire  `(sql, params) => rows` — le pool par défaut
   * @returns { biblio: { total, types, parFanzzy }, series: [{ id, possedes, total }],
   *            crans: { gagnes, possibles } }
   */
  async function compter(userId, lecteur = q) {
    /* Les tables facultatives ne font pas tomber la page : un joueur sans
       tenue ni pièce a zéro, pas une erreur. */
    const lire = (sql, p) => lecteur(sql, p).catch((e) => {
      if (e?.code === 'ER_NO_SUCH_TABLE' || e?.code === 'ER_BAD_FIELD_ERROR') return [];
      throw e;
    });
    const [fz, sk, st, w, etats] = await Promise.all([
      lecteur(`SELECT fanzzy_id, stage FROM user_fanzzy WHERE user_id = ?`, [userId]),
      lire(`SELECT fanzzy_id, skin_id FROM user_skins WHERE user_id = ?`, [userId]),
      lire(`SELECT stuff_id FROM user_stuff WHERE user_id = ?`, [userId]),
      lire(`SELECT action_cards FROM user_wallet WHERE user_id = ?`, [userId]),
      etatsGagnes(userId, lecteur).catch(() => null),
    ]);

    const persos = obtenables();
    const atteint = new Map(fz.map((r) => [racineDe(r.fanzzy_id), Math.max(1, Number(r.stage) || 1)]));
    const tenues = new Set(tenuesPubliees().filter((t) => t.id !== 'base').map((t) => t.id));
    const agesDe = (id) => Math.max(1, lignee(id).length);
    const tenuesDe = new Map();
    for (const r of sk) {
      if (!tenues.has(r.skin_id)) continue;
      const id = racineDe(r.fanzzy_id);
      tenuesDe.set(id, (tenuesDe.get(id) ?? 0) + 1);
    }

    const T = {
      fanzzy: { gagnes: 0, possibles: persos.length, items: [] },
      etats: { gagnes: 0, possibles: 0 },
      tenues: { gagnes: 0, possibles: 0 },
    };
    const parFanzzy = [];
    for (const f of persos) {
      const ages = agesDe(f.id);
      const possede = atteint.has(f.id);
      if (possede) T.fanzzy.gagnes++;
      T.fanzzy.items.push({ id: f.id, nom: f.nom, rar: f.rar, possede });
      const eP = ages * ETATS_DESSINES.length;
      const eG = Object.values(etats?.[f.id] ?? {})
        .reduce((s, l) => s + l.filter((e) => ETATS_DESSINES.includes(e)).length, 0);
      const tP = ages * tenues.size;
      const tG = tenuesDe.get(f.id) ?? 0;
      T.etats.possibles += eP; T.etats.gagnes += Math.min(eG, eP);
      T.tenues.possibles += tP; T.tenues.gagnes += Math.min(tG, tP);
      if (possede) {
        parFanzzy.push({ id: f.id, nom: f.nom, stade: atteint.get(f.id), ages,
          etats: { gagnes: Math.min(eG, eP), possibles: eP },
          tenues: { gagnes: Math.min(tG, tP), possibles: tP } });
      }
    }

    const aStuff = new Set(st.map((r) => r.stuff_id));
    const stuff = jouables('stuff');
    T.stuff = { possibles: stuff.length,
      items: stuff.map((s) => ({ id: s.id, nom: s.nom, rar: s.rar, possede: aStuff.has(s.id) })) };
    T.stuff.gagnes = T.stuff.items.filter((s) => s.possede).length;

    /* Les communes sont à tout le monde — voir `possessions` dans le deck :
       elles comptent comme gagnées dès le premier jour. */
    const brut = w[0]?.action_cards;
    const tirees = new Set(typeof brut === 'string' ? JSON.parse(brut) : (brut ?? []));
    const actions = jouables('action');
    T.actions = { possibles: actions.length,
      items: actions.map((a) => ({ id: a.id, nom: a.nom, rar: a.rar,
        possede: a.rar === 'commune' || tirees.has(a.id) })) };
    T.actions.gagnes = T.actions.items.filter((a) => a.possede).length;

    const somme = (types) => types.reduce((s, t) => ({
      gagnes: s.gagnes + t.gagnes, possibles: s.possibles + t.possibles }),
    { gagnes: 0, possibles: 0 });
    const total = somme(Object.values(T));
    /* Le compte qui paie, tiré des mêmes `T` que la jauge, dans la même
       fonction : la route et le recompte du versement ne peuvent pas en
       avoir deux versions. */
    const crans = somme(Object.entries(T).filter(([type]) => !HORS_CRANS.has(type)).map(([, t]) => t));
    parFanzzy.sort((a, b) => a.nom.localeCompare(b.nom));

    /* Les personnages possédés, série par série, pour la série complète
       (`CONTRATS.md`, § 5.1). Sur les mêmes `persos` que la jauge : une série
       se dit complète sur ce qu'un booster peut donner aujourd'hui. */
    const series = SETS.filter((s) => serieOuverte(s.id)).map((s) => {
      const dans = persos.filter((f) => f.set === s.id);
      return { id: s.id, total: dans.length, possedes: dans.filter((f) => atteint.has(f.id)).length };
    }).filter((s) => s.total > 0);

    return { biblio: { total, types: T, parFanzzy }, series, crans };
  }

  /* ------------------------------------------------ les paliers de collection

     Un cran tous les `collection.cran` objets gagnés, et une récompense pour
     chaque série complète (`SERVEUR.md`, § 6 ; `CONTRATS.md`, § 5.1). Les
     objets gagnés sont ceux de la bibliothèque, **tenues mises à part**
     (`HORS_CRANS`) : `paliers.gagnes` vaut `total.gagnes` moins
     `types.tenues.gagnes` (`ECARTS.md`, fanzzy).

     **Un cran est payé une fois, au seuil franchi le plus haut.** Le grand
     livre garde les seuils payés (`cran`, clé = le seuil en chiffres). Ce qui
     se paie est au-dessus du plus haut d'entre eux : si la taille du cran
     change (25 → 20), les seuils de l'ancienne taille déjà couverts (20, 40
     sous un 50 payé) ne se repaient pas ; si le compte baisse (une pièce ou
     un personnage dépublié), rien n'est repris, et rien ne se repaie en
     remontant. */

  /** Le plus haut seuil payé, 0 sinon. */
  const plusHautCran = (lignes) => lignes.reduce((m, l) => {
    const n = Number(l.cle);
    return Number.isInteger(n) && n > m ? n : m;
  }, 0);

  /** Le gain d'un cran : ses écharpes, et un booster tous les N crans. */
  function gainCran(seuil, cran) {
    const tous = reglage('collection.cran_booster_tous');
    const rang = seuil / cran;
    return { echarpes: reglage('collection.cran_echarpes'),
      packs: tous > 0 && Number.isInteger(rang) && rang % tous === 0 ? 1 : 0, xp: 0, tampons: 0 };
  }

  const gainSerie = () => ({ echarpes: reglage('collection.serie_echarpes'),
    packs: reglage('collection.serie_packs'), xp: 0, tampons: 0 });

  /**
   * Le bloc `paliers` de la bibliothèque, ou `null` : interrupteur coupé, ou
   * grand livre absent. Une lecture du grand livre de plus, rien d'autre.
   */
  async function paliersDe(userId, compte, lecteur = q) {
    if (!reglage('collection.actif')) return null;
    let payes;
    try {
      payes = await lecteur(
        `SELECT source, cle FROM recompenses WHERE user_id = ? AND source IN ('cran', 'serie')`,
        [userId]);
    } catch (e) {
      if (!estSchema(e)) throw e;
      signalerAnnexe('recompenses', e);
      return null;
    }
    const cran = reglage('collection.cran');
    const haut = plusHautCran(payes.filter((l) => l.source === 'cran'));
    const seriesPayees = new Set(payes.filter((l) => l.source === 'serie').map((l) => l.cle));
    const { gagnes, possibles } = compte.crans;

    const aReclamer = [];
    for (let a = (Math.floor(haut / cran) + 1) * cran; a <= gagnes; a += cran) {
      aReclamer.push({ sorte: 'cran', cle: String(a), gain: gainCran(a, cran) });
    }
    const series = compte.series.map((s) => ({ ...s,
      etat: seriesPayees.has(s.id) ? 'reclame' : (s.possedes >= s.total ? 'pret' : 'a_venir'),
      gain: gainSerie() }));
    for (const s of series) {
      if (s.etat === 'pret') aReclamer.push({ sorte: 'serie', cle: s.id, gain: s.gain });
    }
    /* Le prochain seuil est au-dessus de ce qu'on a **et** de ce qui est
       payé : après une baisse du compte, le cran déjà payé n'est pas un
       objectif. Absent quand l'univers n'en contient plus. */
    const a = (Math.floor(Math.max(haut, gagnes) / cran) + 1) * cran;
    const prochain = a <= possibles ? { a, manque: a - gagnes, gain: gainCran(a, cran) } : null;
    /* `possibles` en plus du contrat : depuis que les tenues sortent du
       compte, `gagnes` n'est plus `total.gagnes`, et une page qui mettrait
       l'un sur l'autre (« 400 / 275 ») mélangerait deux comptes. Le bloc se
       suffit : `gagnes / possibles`, et `prochain.a` entre les deux. */
    return { cran, gagnes, possibles, ...(prochain ? { prochain } : {}), aReclamer,
      series: series.map(({ id, possedes, total, etat, gain }) => ({ id, possedes, total, etat, gain })) };
  }

  async function bibliotheque(userId) {
    const compte = await compter(userId);
    const paliers = await paliersDe(userId, compte);
    return { ...compte.biblio, ...(paliers ? { paliers } : {}) };
  }

  /** Le corps d'une réclamation, sous les trois formes du contrat (§ 5.1). */
  function lireDemandePalier(corps) {
    const c = corps && typeof corps === 'object' && !Array.isArray(corps) ? corps : {};
    if (c.tout !== undefined) {
      if (c.tout !== true || c.sorte !== undefined || c.cle !== undefined) {
        throw fail('fanzzy.error.palier_requete');
      }
      return { tout: true };
    }
    if (c.sorte === 'cran' && typeof c.cle === 'string' && /^[1-9]\d{0,8}$/.test(c.cle)) {
      return { sorte: 'cran', cle: c.cle, seuil: Number(c.cle) };
    }
    if (c.sorte === 'serie' && typeof c.cle === 'string' && /^[A-Za-z0-9]{1,8}$/.test(c.cle)) {
      return { sorte: 'serie', cle: c.cle };
    }
    throw fail('fanzzy.error.palier_requete');
  }

  /**
   * Un versement de palier, prêt pour le grand livre.
   *
   * **Le recompte se fait dans `verifier`**, sur la connexion du versement et
   * sous le verrou du joueur : la jauge qu'a vue la page peut dater, et le
   * serveur ne paie que ce qu'il recompte lui-même. `verifier` et `gain` ne
   * font que lire — le grand livre peut les rappeler une fois s'il rejoue une
   * course perdue (`ECARTS.md`, socle § 2). Les montants viennent des
   * réglages, lus dans la transaction ; jamais du corps de la requête.
   */
  function versementPalier(userId, sorte, cle) {
    const commun = { userId, source: sorte, cle, saisonId: null };
    if (sorte === 'cran') {
      const seuil = Number(cle);
      return { ...commun,
        verifier: async (conn) => {
          if (!reglage('collection.actif')) return 'inactif';
          const cran = reglage('collection.cran');
          if (!Number.isInteger(seuil) || seuil < cran || seuil % cran !== 0) return 'inconnu';
          const lire = surConnexion(conn);
          const payes = await lire(
            `SELECT cle FROM recompenses WHERE user_id = ? AND source = 'cran'`, [userId]);
          /* Sous le plus haut seuil payé : couvert, et non dû. */
          if (seuil <= plusHautCran(payes)) return 'inconnu';
          /* Le compte des crans, tenues mises à part (`HORS_CRANS`) : le même
             que `paliersDe`, sans quoi un client qui demande un seuil que
             seules ses tenues atteignent serait payé sans que la page l'ait
             jamais proposé. */
          const compte = await compter(userId, lire);
          return seuil <= compte.crans.gagnes ? true : 'incomplet';
        },
        gain: () => gainCran(seuil, reglage('collection.cran')) };
    }
    return { ...commun,
      verifier: async (conn) => {
        if (!reglage('collection.actif')) return 'inactif';
        if (!SETS.some((s) => s.id === cle) || !serieOuverte(cle)) return 'inconnu';
        const compte = await compter(userId, surConnexion(conn));
        const s = compte.series.find((x) => x.id === cle);
        if (!s) return 'inconnu';
        return s.possedes >= s.total ? true : 'incomplet';
      },
      gain: () => gainSerie() };
  }

  /**
   * Réclamer un cran, une série complète, ou tout ce qui est dû.
   *
   * **Un cran réclamé verse aussi les crans plus bas encore dus**, du plus bas
   * au plus haut, chacun sous sa clé. Sans cela, récupérer 50 avant 25
   * rendait 25 impayable pour toujours : il passait sous le plus haut seuil
   * payé, que la règle tient pour couvert.
   *
   * Réponse : celle du grand livre (`CONTRATS.md`, R6), avec `paliers` à jour
   * à la racine.
   */
  async function reclamerPalier(userId, corps) {
    const demande = lireDemandePalier(corps);
    if (!reglage('collection.actif')) return { verse: false, raison: 'inactif' };
    /* L'abonnement relu maintenant, hors de tout verrou : la recharge qui
       précède un booster offert le lira dans ce souvenir au lieu d'aller au
       pool en tenant la bourse (voir `abonneDe`). */
    await abonneDe(userId);

    const etat = await paliersDe(userId, await compter(userId));
    if (!etat) return { verse: false, raison: 'schema' };

    let liste;
    if (demande.tout) {
      liste = etat.aReclamer.map((x) => versementPalier(userId, x.sorte, x.cle));
    } else if (demande.sorte === 'cran') {
      /* Les plus bas seulement si celui-ci est dû : une page restée ouverte
         qui demande un cran pas encore atteint reçoit son refus, et non les
         crans d'en dessous à la place de ce qu'elle a demandé. */
      const dus = etat.aReclamer.filter((x) => x.sorte === 'cran');
      const plusBas = dus.some((x) => x.cle === demande.cle)
        ? dus.filter((x) => Number(x.cle) < demande.seuil) : [];
      liste = [...plusBas.map((x) => versementPalier(userId, 'cran', x.cle)),
        versementPalier(userId, 'cran', demande.cle)];
    } else {
      liste = [versementPalier(userId, 'serie', demande.cle)];
    }

    const portes = { niveau: niveau ?? undefined, recharger };
    const r = liste.length === 1
      ? await verser(pool, { ...portes, ...liste[0] })
      : await verserTout(pool, liste, portes);
    const apres = await paliersDe(userId, await compter(userId)).catch(() => null);
    return { ...r, ...(apres ? { paliers: apres } : {}) };
  }

  router.get('/bibliotheque', requireAuth, (req, res) =>
    send(res, bibliotheque(req.user.id)));

  router.post('/palier', requireAuth, (req, res) =>
    send(res, reclamerPalier(req.user.id, req.body)));

  router.get('/state', requireAuth, (req, res) =>
    send(res, Promise.all([
      wallet(req.user.id), collection(req.user.id), stades(req.user.id),
      saisonVue(req.user.id), etatsGagnes(req.user.id), nouveautes(req.user.id),
    ]).then(([w, col, st, vue, etats, nv]) => ({ wallet: w, collection: col, stades: st,
      /* Les états gagnés partent avec le reste de l'état du joueur : toutes
         les pages qui dessinent un Fanzzy en expression lisent déjà cette
         route, et en ajouter une seconde ferait deux vérités. */
      etats,
      /* Ce que le joueur n'a pas encore regardé. Absent quand le serveur ne
         sait pas (table absente) : ce n'est pas la même chose que `[]`. */
      ...(nv ? { nouveautes: nv } : {}),
      saison: saisonServie(), saisonVue: vue,
      maxPacks: maxPacks(), packPrice: prixPack() }))));

  /**
   * Éteindre des nouveautés (`CONTRATS.md`, § 2.2). La page l'envoie **après**
   * les avoir montrées, jamais au chargement.
   */
  router.post('/vu', requireAuth, (req, res) =>
    send(res, eteindre(req.user.id, req.body)));

  /**
   * « J'ai vu l'annonce de cette saison. »
   *
   * Sans cette marque, l'annonce reviendrait à chaque ouverture du kiosque, pour
   * toujours — et une annonce qu'on ne peut pas faire taire est une annonce
   * qu'on apprend à ne plus lire. La suivante ne serait pas lue non plus.
   */
  router.post('/saison-vue', requireAuth, (req, res) => send(res, (async () => {
    const s = saisonEnCours();
    if (!s) return { saisonVue: null };
    await q(`UPDATE user_wallet SET saison_vue = ? WHERE user_id = ?`, [s.id, req.user.id]);
    return { saisonVue: s.id };
  })()));

  /* Le repli est **LA TRIBUNE**, la seule série ouverte au niveau 1 : un joueur
     qui n'en a pas encore débloqué d'autre ne peut ouvrir que celle-là.
     Il valait `VN` — une série qui n'existe plus depuis la dissolution de
     VIRAGE NORD, ce qui faisait d'une requête sans série une ouverture vide.
     Un repli qui nomme une série codée en dur doit nommer celle que tout le
     monde possède. */
  router.post('/open', requireAuth, (req, res) =>
    send(res, openPack(req.user.id, String(req.body?.set ?? 'TR'), { buy: Boolean(req.body?.buy) })
      .then(async (r) => ({ ...r, wallet: await wallet(req.user.id) }))));

  router.post('/evolve', requireAuth, (req, res) =>
    send(res, evolve(req.user.id, String(req.body?.id ?? ''))
      .then(async (r) => ({ ...r, wallet: await wallet(req.user.id) }))));

  router.get('/fiche/:id', requireAuth, (req, res) => {
    // Un identifiant inexistant est une ressource absente, pas une requête
    // invalide : 404, et non 400.
    fiche(req.user.id, String(req.params.id))
      .then((d) => (d ? res.json(d) : res.status(404).json({ error: 'fanzzy.error.unknown' })))
      .catch((e) => {
        const t = traduire(e);
        res.status(400).json({ error: t.code, detail: t.detail });
      });
  });

  /** Le catalogue de l'équipement, pour l'écran de détail. */
  router.get('/stuff', (_req, res) => {
    res.set('cache-control', 'public, max-age=3600');
    res.json({ stuff: STUFF, skins: toutesTenues() });
  });

  /**
   * L'avatar — et depuis la règle du titulaire, un simple raccourci.
   *
   * « Mon FANZZY » et le titulaire du deck étaient deux notions séparées : on
   * pouvait lire « TITULAIRE » sur la fiche d'un personnage et en voir un autre
   * partout ailleurs. C'est une notion de trop ; le personnage qu'on met en
   * avant est celui qu'on aligne, et c'est `enregistrer` qui l'écrit désormais.
   *
   * Cette route reste parce qu'elle est le seul endroit qui pouvait encore les
   * séparer. Elle **passe donc par le deck** quand il est là : demander l'avatar,
   * c'est demander le brassard. Le repli existe pour une installation sans
   * module de deck, et pour le cas où le deck refuse — un joueur sans carte
   * d'action, par exemple : il vaut mieux un avatar posé qu'un refus sur un
   * geste qui n'a jamais rien refusé.
   */
  router.post('/active', requireAuth, (req, res) => send(res, (async () => {
    // On équipe un personnage, jamais un âge : c'est le même individu, et la
    // collection ne connaît que lui. Accepter « TR32B » tel quel poserait dans la
    // bourse un identifiant introuvable au moment de le dessiner.
    const id = racineDe(String(req.body?.id ?? ''));
    if (!parIdentifiant(id)) throw fail('fanzzy.error.unknown');
    const stade = (await q(
      `SELECT stage FROM user_fanzzy WHERE user_id = ? AND fanzzy_id = ?`,
      [req.user.id, id]))[0];
    if (!stade) throw fail('fanzzy.error.not_owned');

    /* ----------------------------------------------------- et à quel âge

       Le même geste dit qui et à quel âge, parce que c'est **une seule
       décision** : « voilà le personnage qu'on voit de moi ». Une seconde
       route pour l'âge aurait demandé deux appels pour un seul choix, et
       laissé exister l'instant où la bourse porte un personnage et l'âge d'un
       autre.

       L'âge demandé ne peut pas dépasser l'âge atteint : on montre ce qu'on a
       fait grandir, et rien de plus. Au-delà, ce serait un aperçu de ce qu'on
       n'a pas payé, exposé aux amis comme s'il était acquis.

       Absent, il vaut **nul**, c'est-à-dire l'âge atteint. C'est aussi ce qui
       remet les compteurs à zéro en changeant de personnage : le classeur
       envoie `{ id }` sans âge, et le nouveau venu se montre donc au sien —
       garder l'âge du précédent l'afficherait à un stade qu'il n'a peut-être
       jamais atteint. */
    const atteint = Math.max(1, Number(stade.stage) || 1);
    const brut = req.body?.evo;
    let evo = null;
    if (brut !== undefined && brut !== null && brut !== '') {
      const n = Number(brut);
      if (!Number.isInteger(n) || n < 1) throw fail('fanzzy.error.age_inconnu');
      if (n > atteint) throw fail('fanzzy.error.age_non_atteint', { atteint });
      /* L'âge atteint s'écrit nul plutôt que son numéro : sans cela, choisir
         « le dernier » aujourd'hui figerait l'affichage sur cet âge-là, et le
         joueur qui fait grandir son Fanzzy demain ne le verrait pas changer. */
      evo = n < atteint ? n : null;
    }

    if (decks) {
      try {
        await decks.placer(req.user.id, { id, place: 0 });
        await q(`UPDATE user_wallet SET active_evo = ? WHERE user_id = ?`, [evo, req.user.id]);
        return { active: id, activeEvo: evo };
      } catch { /* le deck a refusé : on pose au moins l'avatar. */ }
    }
    await q(`UPDATE user_wallet SET active_fanzzy = ?, active_evo = ? WHERE user_id = ?`,
      [id, evo, req.user.id]);
    return { active: id, activeEvo: evo };
  })()));

  /**
   * Fiche complète d'un Fanzzy : ce qu'il est, ce que le joueur en possède,
   * ses tenues, sa lignée et l'effet réel de son équipement.
   *
   * Tout est assemblé côté serveur en une seule fois : la page n'a pas à
   * enchaîner cinq requêtes pour afficher une carte.
   */
  /**
   * Les places de la tribune du deck, et qui les occupe.
   *
   * Une place par rang ouvert : la première est le titulaire — celui qui entre
   * au coup d'envoi — les suivantes sont des remplaçants, que la carte
   * Changement fait entrer en cours de partie.
   *
   * Rend `null` si le module de deck n'est pas monté. La fiche retire alors son
   * bouton plutôt que d'en proposer un qui échouerait.
   */
  async function laTribune(userId, fanzzyId) {
    if (!decks) return null;
    try {
      const [deck, possede] = await Promise.all([
        decks.deckDe(userId), decks.possessions(userId),
      ]);
      const rangs = deck?.fanzzy ?? [];
      /* Le plafond vient du niveau, borné par la règle — exactement comme dans
         l'écran de deck. Le recopier ici donnerait une seconde vérité. */
      const ouvertes = Math.min(DECK_RULES.fanzzy, possede.fanzzyMax);
      return {
        places: Array.from({ length: ouvertes }, (_, i) => {
          const occupant = rangs[i] ? parIdentifiant(rangs[i].id) : null;
          return {
            place: i,
            role: i === 0 ? 'titulaire' : 'remplacant',
            /* **Atteignable ou non.** Poser quelqu'un au rang 2 quand le rang 1
               est vide laisserait un trou, et c'est `fanzzy[0]` qui décide du
               titulaire : le serveur refuse, la page grise. */
            ouverte: i <= rangs.length,
            occupant: occupant ? { id: occupant.id, nom: occupant.nom } : null,
          };
        }),
        /* Où est ce personnage aujourd'hui. `-1` : nulle part. */
        siege: rangs.findIndex((x) => x.id === racineDe(String(fanzzyId ?? ''))),
      };
    } catch {
      /* Un deck illisible ne doit pas emporter la fiche : le joueur perdrait
         l'accès à sa collection entière pour un JSON abîmé. */
      return null;
    }
  }

  async function fiche(userId, fanzzyId) {
    // La fiche d'un âge supérieur est la fiche de son personnage : c'est le
    // même individu, et le joueur n'en possède qu'un.
    const id = racineDe(String(fanzzyId));
    const perso = parIdentifiant(id);
    if (!perso) return null;

    const [mien, skins, etats, stuff, w, tribune] = await Promise.all([
      q(`SELECT copies, stage, first_at FROM user_fanzzy WHERE user_id = ? AND fanzzy_id = ?`,
        [userId, id]),
      q(`SELECT skin_id, stage, equipped, got_at FROM user_skins
          WHERE user_id = ? AND fanzzy_id = ?`, [userId, id]),
      /* Les états gagnés de ce personnage. Sous garde : un déploiement où
         `sql/etats.sql` n'est pas encore appliqué doit montrer une fiche sans
         la rangée, pas une fiche en erreur. */
      q(`SELECT etat, stage, got_at FROM user_etats
          WHERE user_id = ? AND fanzzy_id = ?`, [userId, id])
        .catch((e) => { if (e.code === 'ER_NO_SUCH_TABLE') return []; throw e; }),
      q(`SELECT stuff_id, copies, slot FROM user_stuff WHERE user_id = ?`, [userId]),
      q(`SELECT active_fanzzy, active_evo, active_etat, scarves
           FROM user_wallet WHERE user_id = ?`, [userId]),
      /* La tribune du deck, assemblée ici et pas par la page.
         Elle enchaînerait sinon deux requêtes pour afficher une carte, et la
         seconde arriverait après le premier rendu — le bouton changerait de
         texte sous le doigt du joueur. */
      laTribune(userId, id),
    ]);

    const ages = lignee(id);
    const stade = Number(mien[0]?.stage ?? 1);
    // Ce qu'il est **aujourd'hui** : nom, histoire, bonus et cri de l'âge
    // atteint. Afficher toujours le premier âge donnerait à quelqu'un qui a
    // payé quatre-vingt-dix écharpes une fiche identique à celle d'avant.
    const f = ages[stade - 1] ?? perso;

    const portes = stuff.filter((s) => s.slot).sort((a, b) => a.slot - b.slot)
      .map((s) => s.stuff_id);

    return {
      fanzzy: {
        id,
        /* `ageId` est la carte du catalogue à l'âge atteint — `id`, lui, est la
           lignée. Le dessin est rangé sous la première, les possessions sous la
           seconde. La fiche demandait l'illustration sous le nom de la lignée :
           elle affichait donc le Choriste avec le nom du Meneur de chant. */
        ageId: f.id,
        nom: f.nom, type: f.type, set: f.set, stage: stade, rar: f.rar,
        /* Le nom de la série, et pas seulement son identifiant.
           La fiche d'un Fanzzy qu'on ne possède pas dit maintenant dans quel
           booster il se tire ; sans ce champ elle aurait dû se fabriquer sa
           propre table « TR → LA TRIBUNE », c'est-à-dire une copie de moins en
           moins juste de celle qui vit dans `dex.js`. */
        setNom: SETS.find((s) => s.id === f.set)?.nom ?? null,
        mods: f.mods, cri: f.cri, evo: f.evo ?? null,
        histoire: f.histoire ?? null,
      },
      possede: mien[0]?.copies ?? 0,
      stade,
      /* **Ce qu'il a en poche.**

         La fiche proposait ÉVOLUER sans jamais savoir si le joueur pouvait
         payer : on ouvrait le panneau, on confirmait, et le refus arrivait au
         troisième geste sous la forme d'un petit message. Deux clics pour
         apprendre une chose qui se savait avant le premier.

         C'est la même faute que le bouton d'ouverture du kiosque, et elle se
         corrige de la même façon : le prix et la bourse voyagent ensemble, et
         l'écran dit « il te faut » au lieu de laisser essayer. */
      echarpes: Number(w[0]?.scarves ?? 0),
      depuis: mien[0]?.first_at ?? null,
      /* **L'avatar, et non le deck.** C'est le personnage que voient les amis
         et l'accueil. Le champ s'appelait `equipe` et la fiche en tirait
         « DÉJÀ EN DUEL » — sur quelqu'un qui n'était dans aucun deck. Renommé
         pour ce qu'il est ; ce qui concerne le duel est dans `tribune`. */
      avatar: w[0]?.active_fanzzy === id,
      /* **Ce que l'avatar montre en ce moment**, pour que la fiche s'ouvre
         sur le choix en cours au lieu d'un choix neuf.

         Sans ces deux champs, l'écran ne pouvait pas marquer l'âge et
         l'expression retenus : il fallait valider pour savoir ce qu'on
         avait déjà. La tenue, elle, se lisait déjà dans `porte`. */
      avatarStade: w[0]?.active_fanzzy === id
        ? stadeAffiche(stade, w[0]?.active_evo) : null,
      avatarEtat: w[0]?.active_fanzzy === id ? (w[0]?.active_etat || 'neutre') : null,
      /* Où il est dans la tribune du deck, et quelles places sont ouvertes.
         `null` si le module de deck n'est pas monté. */
      tribune,
      /* Les tenues de **l’âge atteint**, et rien d’autre.

         Un skin appartient désormais à un âge : le Capo n’hérite pas de la
         garde-robe du gamin. Montrer toutes les tenues du personnage ferait
         croire le contraire, et le joueur chercherait longtemps le bouton qui
         ne viendra pas. */
      skins: toutesTenues().map((sk) => {
        const m = skins.find((x) => x.skin_id === sk.id && Number(x.stage) === stade);
        return { ...sk, possede: Boolean(m), porte: Boolean(m?.equipped),
                 depuis: m?.got_at ?? null };
      }),
      // Ce qui est gagné aux autres âges, pour que la fiche puisse le dire
      // plutôt que de laisser croire à une perte.
      skinsAutresAges: skins.filter((x) => Number(x.stage) !== stade)
        .map((x) => ({ id: x.skin_id, stade: Number(x.stage) })),

      /* **Et le tout, âge par âge.**

         `skins` et `etats` ci-dessus ne disent que l'âge **atteint**, et
         c'était juste tant que la fiche ne montrait que celui-là. Mais sa
         rangée ÂGES existe pour regarder les trois visages d'une lignée :
         toucher le deuxième changeait le dessin et laissait les tenues sur
         celles du troisième.

         Un joueur l'a vu avant nous, et en base : sa tenue d'Halloween
         n'existe qu'aux âges un et trois, et la fiche la lui montrait aux
         trois. Le commentaire du clic promettait pourtant que ces rangées
         « parlent de l'âge qu'on regarde » — elles parlaient de l'autre.

         Trois âges, une vingtaine de tenues : la réponse grossit de
         quelques centaines d'octets, et la fiche cesse de mentir. */
      parAge: Object.fromEntries([1, 2, 3].map((n) => [n, {
        skins: toutesTenues().map((sk) => {
          const m = skins.find((x) => x.skin_id === sk.id && Number(x.stage) === n);
          return { ...sk, possede: Boolean(m), porte: Boolean(m?.equipped),
                   depuis: m?.got_at ?? null };
        }),
        etats: ETATS_DESSINES.map((e) => {
          const m = etats.find((x) => x.etat === e && Number(x.stage) === n);
          return { id: e, nom: ETAT_NOM[e] ?? e, dessin: ETAT_DESSIN[e] ?? '',
                   possede: Boolean(m), depuis: m?.got_at ?? null };
        }),
      }])),
      /* **Les quatre états de l'âge atteint.** Même règle que les tenues, et
         pour la même raison : un état appartient à un âge. Ils partent tous
         les quatre, gagnés ou non — c'est la case vide qui donne envie
         d'ouvrir un booster, et une rangée qui ne montrerait que l'acquis ne
         dirait jamais ce qui manque.

         Le libellé vient de `rendus.js` : la phrase qui décrit le dessin est
         écrite une fois, là où la chaîne d'images la lit déjà. */
      etats: ETATS_DESSINES.map((e) => {
        const m = etats.find((x) => x.etat === e && Number(x.stage) === stade);
        return { id: e, nom: ETAT_NOM[e] ?? e, dessin: ETAT_DESSIN[e] ?? '',
                 possede: Boolean(m), depuis: m?.got_at ?? null };
      }),
      etatsAutresAges: etats.filter((x) => Number(x.stage) !== stade)
        .map((x) => ({ id: x.etat, stade: Number(x.stage) })),
      // `possede` par âge veut dire « atteint », pas « détenu à part ». Un âge
      // au-delà du stade actuel se lit donc comme un objectif chiffré, ce qui
      // est exactement ce que la page en fait.
      /* `mods` et `cri` voyagent avec chaque âge, et pas seulement avec l'âge
         atteint : la fiche demande confirmation avant d'évoluer, et une
         confirmation qui ne montre pas ce qu'on gagne ne demande rien du tout.
         Quatre-vingt-dix écharpes se dépensent en connaissance de cause. */
      lignee: ages.map((x, i) => ({
        id: x.id, nom: x.nom, stage: i + 1, rar: x.rar,
        mods: x.mods ?? {}, cri: x.cri ?? null,
        possede: mien.length > 0 && stade >= i + 1,
        cout: i ? (EVO_COST[i + 1] ?? 90) : 0,
      })),
      // L'effet réel : les modificateurs du Fanzzy combinés à l'équipement
      // actuellement porté. C'est ce que le duel utilisera vraiment.
      effetReel: combine(f.mods, portes),
      stuffPorte: portes.map((id) => STUFF_BY_ID.get(id)).filter(Boolean),
    };
  }

  /** Le Fanzzy équipé, lu par le duel au démarrage d'une partie. */
  /**
   * Le Fanzzy équipé, lu par le duel au démarrage d'une partie.
   *
   * Il rend **le premier âge**, toujours, quel que soit le stade atteint. Ce
   * n'est pas un oubli : un duel se joue depuis le début, et le personnage y
   * grandit en jeu, par une carte. Ce que les écharpes ont acheté, c'est le
   * droit de jouer cette carte — pas un avantage acquis au coup d'envoi.
   */
  async function activeFanzzy(userId) {
    const w = (await q(`SELECT active_fanzzy FROM user_wallet WHERE user_id = ?`, [userId]))[0];
    const f = w?.active_fanzzy ? parIdentifiant(racineDe(w.active_fanzzy)) : null;
    return f ?? null;
  }

  /**
   * Le Fanzzy équipé **tel qu'il est à l'écran** : l'identifiant du
   * personnage, l'âge atteint, le nom et le cri de cet âge.
   *
   * `activeFanzzy`, juste au-dessus, rend la racine et sert aux barèmes.
   * Celui-ci sert à l'affichage, et les deux ne peuvent pas être une seule
   * fonction : le barème suit la racine — c'est l'équilibrage d'aujourd'hui —
   * tandis que le dessin, le nom et le cri suivent l'âge atteint. Les
   * confondre ferait pousser un Capo avec les chiffres du Choriste, ou
   * afficher le Choriste à quelqu'un qui a payé quatre-vingt-dix écharpes
   * pour ne plus le voir.
   */
  /**
   * @param {object} [opt]
   * @param {boolean} [opt.enJeu] pour le Virage et le duel, où la règle diffère.
   *
   * **En jeu, on entre au premier âge, au repos, dans sa tenue.**
   *
   * C'est déjà la règle des effets — `deck/index.js` : « un deck entre
   * toujours au premier âge […] deux tribunes se rencontrent donc au même
   * niveau, et l'écart se creuse par ce qu'on joue, pas par ce qu'on a payé ».
   * Le dessin, lui, montrait l'âge choisi : on poussait avec les chiffres du
   * gamin sous les traits du Capo, et rien ne le disait.
   *
   * L'expression ne suit pas non plus : en partie, c'est le **match** qui la
   * décide — bras levés au but, tête dans les mains à l'encaisse. Une pose
   * figée par un réglage empêcherait le seul endroit où les douze états
   * servent à quelque chose.
   *
   * La tenue, elle, suit : elle ne change rien au jeu, c'est le seul des
   * trois réglages qui ne dise rien sur la force de personne.
   */
  async function personnageActif(userId, { enJeu = false } = {}) {
    /* Plus rien à résoudre ici : c'est `construireAvatar` qui sait. Cette
       fonction ne fait que choisir laquelle des deux formes on veut — sans
       quoi le Virage aurait sa propre copie de la règle, et c'est exactement
       ce qui a fait diverger les écrans pendant une semaine. */
    const { avatar, enJeu: surLeTerrain } = await construireAvatar(userId);
    return enJeu ? surLeTerrain : avatar;
  }

  /**
   * Remettre une tenue ou une pièce d'équipement, hors booster.
   *
   * C'est la boutique qui appelle, avec **sa** connexion : la remise doit
   * vivre dans la transaction qui marque la commande livrée, sinon un hoquet
   * entre les deux perd la marchandise ou la donne deux fois.
   *
   * On tire parmi ce qui **manque** au joueur. Tout possédé : des écharpes, au
   * tarif de la rareté — c'est déjà ce que fait un doublon de booster, et
   * rendre une commande blanche serait le seul endroit du jeu où l'on paie
   * pour rien.
   */
  async function offrir(conn, userId, type, combien = 1) {
    const rendu = { skins: [], stuff: [], scarves: 0 };

    for (let k = 0; k < combien; k++) {
      if (type === 'skin') {
        const [avant] = await conn.query(
          `SELECT fanzzy_id, stage FROM user_fanzzy uf
             JOIN user_skins us ON us.user_id = uf.user_id AND us.fanzzy_id = uf.fanzzy_id
            WHERE uf.user_id = ? GROUP BY fanzzy_id, stage`, [userId]);
        const [pris] = await conn.query(
          `SELECT fanzzy_id, stage, skin_id FROM user_skins WHERE user_id = ?`, [userId]);
        const dejaLa = new Set(pris.map((p) => `${p.fanzzy_id}:${p.stage}:${p.skin_id}`));

        const places = [];
        for (const f of avant) {
          for (const sk of tenuesPubliees()) {
            if (sk.id === 'base') continue;
            if (!dejaLa.has(`${f.fanzzy_id}:${f.stage}:${sk.id}`)) {
              places.push({ id: f.fanzzy_id, stade: f.stage, skin: sk.id });
            }
          }
        }
        if (!places.length) { rendu.scarves += SCARVES.rare; continue; }
        const p = places[Math.floor(Math.random() * places.length)];
        await conn.query(
          `INSERT IGNORE INTO user_skins (user_id, fanzzy_id, stage, skin_id)
           VALUES (?, ?, ?, ?)`, [userId, p.id, p.stade, p.skin]);
        rendu.skins.push(p);
        continue;
      }

      if (type === 'stuff') {
        const [ont] = await conn.query(
          `SELECT stuff_id FROM user_stuff WHERE user_id = ?`, [userId]);
        const dejaLa = new Set(ont.map((s) => s.stuff_id));
        /* La boutique livre ce qui est **ouvert**, comme le booster. Une
           commande n'est pas un raccourci vers une saison qui n'a pas commencé :
           c'est le seul endroit où le joueur paie, et ce serait justement là que
           la fuite se remarquerait le moins. */
        const libres = jouables('stuff').filter((s) => !dejaLa.has(s.id));
        if (!libres.length) { rendu.scarves += SCARVES.rare; continue; }
        const def = libres[Math.floor(Math.random() * libres.length)];
        await conn.query(
          `INSERT INTO user_stuff (user_id, stuff_id, copies) VALUES (?, ?, 1)
           ON DUPLICATE KEY UPDATE copies = copies + 1`, [userId, def.id]);
        rendu.stuff.push(def.id);
        continue;
      }

      throw new Error('fanzzy.error.offre_inconnue');
    }

    if (rendu.scarves) {
      await conn.query(`UPDATE user_wallet SET scarves = scarves + ? WHERE user_id = ?`,
        [rendu.scarves, userId]);
    }
    return rendu;
  }

  /* ------------------------------------------------- remettre un objet nommé

     `offrir` tire au sort ; `remettre` donne ce qu'on a demandé. Les deux
     existent parce qu'un booster et un achat ne posent pas la même question :
     « donne-lui quelque chose » et « donne-lui ceci ».

     Elle **refuse** au lieu de rattraper. Chaque refus porte son code, et il
     arrive **avant** le débit : débiter puis découvrir qu'on ne peut pas
     livrer, c'est prendre de l'argent contre rien, et personne ne saura que
     c'est arrivé. */

  /**
   * Remet une pièce d'équipement nommée.
   *
   * Un doublon est permis — l'équipement se porte sur plusieurs Fanzzy, et
   * deux exemplaires de la même pièce ont un usage. La page le dit avant.
   */
  async function remettreStuff(conn, userId, stuffId) {
    if (!STUFF_BY_ID.has(stuffId)) throw fail('boutique.error.objet_inconnu');
    const [r] = await conn.query(
      `INSERT INTO user_stuff (user_id, stuff_id, copies) VALUES (?, ?, 1)
       ON DUPLICATE KEY UPDATE copies = copies + 1`, [userId, stuffId]);
    /* **Une pièce nouvelle, pas un exemplaire de plus.** Une ligne insérée
       compte pour 1, une ligne existante mise à jour pour 2 : c'est la règle
       du booster, où un doublon n'est jamais « nouveau ». Dans la transaction
       de l'étal, pour partir avec elle si le débit échoue. */
    if (r.affectedRows === 1) await noterNouveauteDans(conn, userId, `stuff:${stuffId}`);
    return { stuff: [stuffId] };
  }

  /**
   * Remet une tenue, sur un Fanzzy et à un âge précis.
   *
   * Trois refus, et ils ne sont pas interchangeables — un joueur à qui l'on dit
   * « impossible » cherche au mauvais endroit :
   *   — la tenue n'existe pas, ou n'est plus publiée ;
   *   — le joueur ne possède pas ce Fanzzy à cet âge ;
   *   — il l'a déjà habillé ainsi.
   */
  async function remettreTenue(conn, userId, { tenue, fanzzy, stage }) {
    const t = tenuesPubliees().find((x) => x.id === tenue);
    if (!t || tenue === 'base') throw fail('boutique.error.tenue_inconnue');

    const etage = Number(stage);
    const [[a]] = [await conn.query(
      `SELECT 1 FROM user_fanzzy WHERE user_id = ? AND fanzzy_id = ? AND stage = ?`,
      [userId, fanzzy, etage])];
    if (!a.length) throw fail('boutique.error.fanzzy_non_possede');

    const [pose] = await conn.query(
      `SELECT 1 FROM user_skins WHERE user_id = ? AND fanzzy_id = ? AND stage = ? AND skin_id = ?`,
      [userId, fanzzy, etage, tenue]);
    if (pose.length) throw fail('boutique.error.tenue_deja_posee');

    await conn.query(
      `INSERT INTO user_skins (user_id, fanzzy_id, stage, skin_id) VALUES (?, ?, ?, ?)`,
      [userId, fanzzy, etage, tenue]);
    // Toujours nouvelle : une tenue déjà posée est refusée juste au-dessus.
    await noterNouveauteDans(conn, userId, `skin:${fanzzy}:${etage}:${tenue}`);
    return { skins: [{ id: fanzzy, stade: etage, skin: tenue }] };
  }

  return { router, wallet, collection, stades, openPack, evolve, activeFanzzy,
    personnageActif, construireAvatar, fiche, offrir, remettreStuff, remettreTenue, bibliotheque,
    /* `recharger(conn, userId)` : la porte du grand livre et du quotidien
       avant tout booster offert (`PLAN.md`, § 5, étape 7). */
    recharger,
    nouveautes, reclamerPalier };
}
