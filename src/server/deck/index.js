import express from 'express';
import { ACTIONS, ACTIONS_MARQUEES, ACTION_BY_ID, DECK_RULES, validerDeck }
  from '../../shared/duel/actions.js';
/* Ce que les saisons ont ouvert. Renommé à l’import : `publies` désigne déjà
   le catalogue Fanzzy dans les modules voisins. Voir `possessions`. */
import { publies as jouables } from '../contenus/index.js';
import { parIdentifiant, racineDe, lignee } from '../fanzzy/catalogue.js';
import { STUFF_BY_ID, combine } from '../../shared/fanzzy/inventaire.js';
// La prime des grands formats se lit dans les réglages : elle s’ajuste depuis
// /admin, comme le reste du barème. Voir `primeDeFormat`.
import { reglage } from '../../shared/reglages.js';
// Le club qu'on soutient dans une rencontre, et de quel côté il joue :
// la même règle qu'au Virage et qu'au Duel, écrite une seule fois.
import { clubParmi, campDe } from '../football/suivis.js';
// La journée du football : la seule source complète de ce qui se joue
// aujourd'hui. La table `fixtures` ne connaît que les clubs suivis.
import { journeeParId, TERMINE } from '../football/journee.js';
import { ancrerDepuisLaJournee } from '../football/ancrage.js';
import { packsDepart } from '../bourse.js';
import { PALIERS } from '../../shared/niveau.js';

/**
 * Le palier qui ouvrira l'emplacement de tribune suivant.
 *
 * L'écran affichait deux rangs à un joueur de niveau 1 sans jamais lui dire
 * pourquoi — ni qu'un troisième existe, ni quand il arrive. Une limite qu'on
 * subit sans l'expliquer passe pour un bug ; expliquée, elle devient un but.
 *
 * Le calcul vit ici et pas dans la page : la table des paliers est déjà la
 * seule source de cette règle, et la recopier côté client donnerait une
 * deuxième vérité à tenir à jour.
 */
function prochainPalierFanzzy(actuel) {
  const p = PALIERS
    .filter((x) => x.deckFanzzy && x.deckFanzzy > actuel)
    .sort((a, b) => a.niveau - b.niveau)[0];
  return p ? { niveau: p.niveau, places: p.deckFanzzy } : null;
}

/**
 * Decks et choix du match support.
 *
 * Deux règles structurent tout :
 *
 * **Le deck est validé par le serveur, jamais par le client.** Un client
 * modifié enverrait trois couronnes et vingt cartes ; ici on vérifie que
 * chaque Fanzzy, chaque pièce et chaque carte appartient réellement au joueur.
 *
 * **Le match support décide de ce que vaut le duel.** Un match du jour ou en
 * cours donne un duel classé, qui compte au classement. Un match d'un autre
 * jour donne un entraînement, qui ne compte pas. Un match passé est refusé :
 * on ne rejoue pas une soirée qu'on n'a pas vécue, sinon les souvenirs et les
 * classements ne veulent plus rien dire.
 */

export const FORMATS = { '1v1': 1, '2v2': 2, '3v3': 3, '4v4': 4, '5v5': 5 };

/**
 * La prime des grands formats.
 *
 * Un 2v2 demandait de réunir quatre personnes au lieu de deux et payait
 * exactement pareil : le format n'entrait nulle part dans le calcul. Un 3v3
 * était donc un mauvais marché — plus dur à remplir, pas mieux payé — et
 * personne n'avait de raison d'attendre.
 *
 * Elle reste **modeste**, et c'est délibéré : un 3v3 n'est pas trois fois plus
 * d'effort pour un joueur, c'est le même chant avec plus de monde autour. Ce
 * qu'on paie est l'attente et la coordination, pas la peine.
 *
 * Elle vit ici plutôt que dans le duel parce que **deux modules la lisent** :
 * `nvn` pour verser, et cette page-ci pour l'annoncer au moment où le joueur
 * choisit son format. Une règle qu’on découvre en lisant son solde après
 * coup n'est pas une règle, c'est une surprise.
 */
export function primeDeFormat(format) {
  const taille = FORMATS[format] ?? 1;
  return 1 + Math.max(0, taille - 1) * reglage('duel.prime_format');
}

/**
 * Ce qu'un duel rapporte, en écharpes.
 *
 * Le classé paie le double de l'entraînement : c'est ce qui fait préférer un
 * vrai adversaire pendant un vrai match. Le perdant touche quand même — une
 * défaite qui ne rapporte rien pousse à quitter la salle avant la fin, et un
 * duel abandonné gâche la soirée des deux camps.
 *
 * Les montants sont volontairement modestes au regard d'un booster (45) :
 * les écharpes viennent surtout des doublons, le duel est un complément.
 *
 * **Il vit ici, et non plus dans `nvn/index.js`**, pour la même raison que
 * `primeDeFormat` juste au-dessus : deux modules le lisent. `nvn` pour verser
 * à la fin du duel, cette page-ci pour dire **avant** l'entrée en file ce qui
 * est en jeu (`enJeu`, CONTRATS.md § 17). Recopié de l'autre côté, il
 * divergerait au premier barème retouché, et l'écran promettrait un montant
 * que le duel ne paie pas. `nvn` importe déjà `deck` ; l'inverse ferait une
 * boucle d'imports.
 */
export const GAIN = Object.freeze({
  classe: Object.freeze({ gagne: 30, perdu: 12 }),
  entrainement: Object.freeze({ gagne: 15, perdu: 6 }),
});

/**
 * Le double quand on pousse pour son club.
 *
 * On peut jouer pour n'importe quel match — c'est ce qui permet de trouver un
 * adversaire un mardi soir de trêve. Mais pousser pour son club doit rester ce
 * qui rapporte le plus, sinon le suivi d'équipe ne veut plus rien dire et le
 * joueur va simplement là où il y a du monde.
 *
 * Le multiplicateur se calcule **par joueur**, pas par duel : deux adversaires
 * peuvent très bien avoir chacun leur club sur le terrain, ou un seul, ou
 * aucun. C'est justement l'intérêt d'un derby.
 *
 * **Les écharpes seulement.** L'XP ne double pas pour son club (ETAT.md § 3) :
 * le niveau mesure le temps passé à jouer.
 */
export const DOUBLE_CLUB = 2;

/**
 * Les écharpes d'un duel **avant** le double du club : barème du mode × prime
 * du format, arrondi.
 *
 * Écrite une fois, et lue deux fois : par `nvn` au versement — la part du KOP
 * se prend sur ce montant-là, avant le double — et par `enJeuDe` pour
 * l'annoncer. Deux formules finiraient par ne plus dire le même chiffre.
 *
 * @param {'classe'|'entrainement'} mode  un mode inconnu paie l'entraînement
 * @param {string} format                 `1v1` … `5v5` ; inconnu, pas de prime
 * @param {boolean} gagne                 la victoire, ou le barème du perdu
 */
export function baseDuDuel(mode, format, gagne) {
  const bareme = GAIN[mode] ?? GAIN.entrainement;
  return Math.round((gagne ? bareme.gagne : bareme.perdu) * primeDeFormat(format));
}

/**
 * Ce qu'une victoire rapporterait à ce joueur, format par format (`enJeu`,
 * CONTRATS.md § 17) : `{ '1v1': 60, '2v2': 70, … }`.
 *
 * **Le serveur compte, l'écran nomme** (R7). La page écrivait « +40 écharpes
 * en jeu » sans que rien ne le lui dise ; elle n'écrit plus rien sans ce champ.
 *
 * Les mêmes montants pour tous, abonnés compris (R9) : un format qu'un joueur
 * gratuit ne peut pas jouer classé est refusé à l'entrée, jamais payé
 * autrement — et cette fonction ne lit pas l'abonnement. Pas d'XP non plus :
 * elle ne dépend ni du format ni du club.
 *
 * @param {'classe'|'entrainement'} mode  celui que la liste sert pour ce match
 * @param {boolean} mien                  le joueur suit l'un des deux clubs
 */
export function enJeuDe(mode, mien) {
  return Object.fromEntries(Object.keys(FORMATS).map((f) =>
    [f, baseDuDuel(mode, f, true) * (mien ? DOUBLE_CLUB : 1)]));
}
const LIVE = ['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE', 'INT'];

/**
 * Ce que vaut un duel monté sur ce match, en une phrase.
 *
 * **Quatre phrases pour trois moments**, et la nuance compte : ce qui décide
 * est la journée, mais ce que le joueur veut savoir est où en est le match.
 * « Ce duel comptera » sur une rencontre terminée laisse croire à une
 * erreur ; « le match est joué » l'explique.
 *
 * Elle est une fonction, et plus un ternaire posé dans `matchSupport`, parce
 * que les deux producteurs de matchs n'en donnaient pas la même version. La
 * liste n'en donnait aucune : la page en refabriquait une, à deux branches,
 * et sur le mauvais critère — `enCours` au lieu de la journée. Un match
 * **terminé aujourd'hui** compte au classement, et elle lui annonçait
 * « entraînement, sans effet sur le classement ».
 *
 * Une phrase qui existe à deux endroits finit toujours par exister en deux
 * versions, dont une fausse.
 *
 * @param {boolean} duJour  la rencontre est-elle du jour de calendrier courant
 * @param {boolean} enCours le ballon roule-t-il
 * @param {boolean} termine le coup de sifflet final est-il tombé
 */
export function raisonDuMatch(duJour, enCours, termine) {
  if (!duJour) return 'Match à venir : entraînement, sans effet sur le classement.';
  if (enCours) return 'Le match est en cours : ce duel comptera au classement.';
  if (termine) return 'Le match est joué : ce duel compte encore au classement, jusqu’à ce soir.';
  return 'Le match est aujourd’hui : ce duel comptera au classement.';
}

/**
 * Le jour de calendrier d'un instant, en `AAAA-MM-JJ`.
 *
 * **En UTC, comme tout le reste ici.** `kickoff_at` est écrit par un pilote
 * réglé sur `timezone: 'Z'`, les requêtes comparent à `UTC_DATE()`, et mélanger
 * les deux horloges ferait basculer la journée d'un match de vingt-deux heures
 * dans celle de la veille. Une seule horloge, partout.
 *
 * Conséquence assumée, et elle se voit : pour un joueur à l'heure suisse d'été,
 * « la journée du match » court de 2 h du matin à 1 h 59 le lendemain, pas de
 * minuit à minuit. C'est deux heures de décalage, toujours **en faveur** du
 * joueur qui joue tard, et jamais contre celui qui joue dans la journée. La
 * corriger demande de décider d'un fuseau d'affichage pour le jeu entier —
 * c'est une autre décision, et elle est notée dans `IDEES.md`.
 */
const jourDe = (quand) => {
  const d = new Date(quand);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

/**
 * Ce que la journée d'un match décide : son jour (`AAAA-MM-JJ`, UTC), s'il
 * est du jour (le duel est alors classé), et si l'on peut encore y entrer
 * (`ouvert` : aujourd'hui ou plus tard).
 *
 * **Une fonction pour la liste et pour l'entrée en file.** Elles avaient
 * chacune la leur : la liste lisait le jour UTC de l'instant du coup
 * d'envoi ; `matchSupport` les dix premiers caractères de la date servie par
 * la journée, ou `DATE()` et `UTC_DATE()` en base. Les trois disent la même
 * chose tant que la date arrive en UTC et que les deux horloges s'accordent.
 * Une date servie avec son décalage — « 01:30+02:00 », la veille à 23:30 en
 * UTC — faisait annoncer un duel classé et ses écharpes par la liste, puis
 * monter un entraînement à l'entrée. Le mode et `enJeu` d'une ligne sont
 * maintenant ceux que l'entrée décidera, par construction.
 *
 * @param coupDEnvoi  un instant : `Date`, ou chaîne ISO avec son décalage
 * @param maintenant  l'instant de référence, lu une fois par l'appelant
 */
export function journeeDuMatch(coupDEnvoi, maintenant = Date.now()) {
  const jour = jourDe(coupDEnvoi);
  const ajd = jourDe(maintenant);
  return { jour, duJour: jour !== null && jour === ajd, ouvert: jour !== null && jour >= ajd };
}

/**
 * Les statuts qui ne portent jamais un duel : un match **annulé** (`CANC`)
 * ou **reporté** (`PST`) n'a pas eu lieu, il ne peut donc être le support de
 * rien. Ce n'est pas la même chose qu'un match terminé, qui reste ouvert
 * jusqu'à la fin de sa journée.
 *
 * Écrits une fois, et lus aux trois endroits où la règle se joue. La requête
 * de la liste les écartait déjà ; mais la journée du football, qui se
 * superpose à la base, les y remettait — un match reporté le matin même
 * restait proposé, avec ses écharpes en jeu — et `matchSupport` les
 * acceptait, qu'ils viennent de la journée ou de la base : un duel classé se
 * montait sur une rencontre qui n'aurait pas lieu.
 */
export const SANS_DUEL = Object.freeze(['CANC', 'PST']);

export function createDecks({ pool, requireAuth, niveau = null,
                             /* Posée après coup par server.js : le télétexte
                                se monte après les decks. Absente, on retombe
                                sur la base — incomplète, jamais rien. */
                             jourDuFoot = null }) {
  const q = async (sql, params = []) => {
    const [rows] = await pool.execute(sql, params);
    return rows;
  };
  const fail = (code, extra) => Object.assign(new Error(code), { code, extra });

  /* ------------------------------------------------- ce que possède le joueur */

  async function possessions(userId) {
    // Le plafond d’emplacements Fanzzy vient du niveau. Sans module de
    // progression, il vaut la règle — le comportement d’avant, exactement.
    const fanzzyMax = niveau ? (await niveau.droitsDe(userId)).deckFanzzy : DECK_RULES.fanzzy;
    const [fz, st, w] = await Promise.all([
      q(`SELECT fanzzy_id, stage FROM user_fanzzy WHERE user_id = ?`, [userId]),
      // `copies` et non le seul identifiant : le nombre d'exemplaires décide de
      // combien de Fanzzy peuvent porter la pièce. Voir `stuffCopies` plus bas.
      q(`SELECT stuff_id, copies FROM user_stuff WHERE user_id = ?`, [userId]),
      q(`SELECT action_cards FROM user_wallet WHERE user_id = ?`, [userId]),
    ]);
    const brut = w[0]?.action_cards;
    const actions = typeof brut === 'string' ? JSON.parse(brut) : (brut ?? []);
    return {
      fanzzy: new Set(fz.map((f) => f.fanzzy_id)),
      fanzzyMax,
      // Jusqu'où chaque personnage a été fait grandir. Ne sert pas à valider —
      // un deck n'exprime plus de stade — mais à avertir le joueur qui a payé
      // une évolution et oublie la carte qui lui donne accès.
      stades: Object.fromEntries(fz.map((f) => [f.fanzzy_id, Number(f.stage)])),
      stuff: new Set(st.map((s) => s.stuff_id)),
      /* **Combien d'exemplaires de chaque pièce.**
       *
       * Les doublons étaient comptés en base depuis toujours — le booster fait
       * `copies = copies + 1` à chaque fois — et le sac les affichait avec un
       * « ×3 ». Ils ne servaient à rien : la validation du deck ne savait que
       * « possédée ou non », et refusait la même pièce sur deux Fanzzy quel que
       * soit le nombre. Posséder cinq Jumelles valait exactement en posséder
       * une, et le jeu annonçait les cinq.
       *
       * C'est la règle écrite dans `actions.js` qui le voulait, d'ailleurs :
       * « une pièce d'équipement est un objet, pas une licence ». Un objet
       * possédé deux fois se porte deux fois — le code appliquait une règle
       * plus dure que la sienne.
       *
       * `Math.max(1, …)` : une ligne existe parce qu'on possède la pièce. Un
       * `copies` à zéro ou nul serait une ligne fantôme, et la compter pour
       * zéro retirerait au joueur une pièce qu'il a. */
      stuffCopies: new Map(st.map((s) => [s.stuff_id, Math.max(1, Number(s.copies) || 1)])),
      /* Les communes sont offertes à tous : sans elles, un joueur qui débute ne
         pourrait pas remplir ses dix emplacements.

         **Et c'est le seul endroit du jeu où une carte d'action arrive sans
         avoir été tirée.** C'était donc la fuite la plus large : une commune
         ajoutée au code se retrouvait dans la main de tout le monde à la
         livraison, avant la saison censée l'annoncer — sans passer par un
         booster, sans que personne ait rien ouvert. Elles passent maintenant
         par `jouables`, comme tous les autres tirages.

         Ce que le joueur a **vraiment** gagné, lui, n'est pas filtré :
         `actions` vient de son portefeuille et entre entier. Fermer, c'est
         cesser de distribuer, pas confisquer. */
      actions: new Set([...actions,
        ...jouables('action').filter((a) => a.rar === 'commune').map((a) => a.id)]),
    };
  }

  /* ------------------------------------------------------------- lecture */

  /**
   * Un deck entre toujours **au premier âge**.
   *
   * C'est la règle du duel : personne n'arrive avec un personnage déjà grandi.
   * Ce qu'un joueur a débloqué en écharpes lui donne le droit de le faire
   * grandir *pendant* la partie, en y consacrant une carte de ses dix. Deux
   * tribunes se rencontrent donc au même niveau, et l'écart se creuse par ce
   * qu'on joue, pas par ce qu'on a payé.
   *
   * D'où la traduction faite ici : un deck enregistré avant le repliage des
   * âges désigne encore « TR32B ». On le ramène à son personnage à la lecture
   * comme à l'écriture — c'est ce qui répare tout seul les decks existants, et
   * ce qui évite d'aller réécrire du JSON en SQL dans la migration.
   */
  const auPremierAge = (deck) => (!deck ? deck : {
    ...deck,
    fanzzy: (deck.fanzzy ?? []).map((f) => ({ ...f, id: racineDe(f.id) })),
  });

  async function deckDe(userId) {
    const rows = await q(
      `SELECT contenu FROM user_decks WHERE user_id = ? AND actif = 1 LIMIT 1`, [userId]);
    if (!rows.length) return null;
    const c = rows[0].contenu;
    return auPremierAge(typeof c === 'string' ? JSON.parse(c) : c);
  }

  /** Le deck déplié : tout ce dont le moteur a besoin, sans relire la base. */
  async function loadout(userId) {
    const deck = await deckDe(userId);
    if (!deck) return null;

    // Jusqu'où chaque personnage a été fait grandir. Le duel ne s'en sert pas
    // pour renforcer qui que ce soit au coup d'envoi — tout le monde entre au
    // premier âge — mais pour savoir **jusqu'où la carte Relève peut aller**.
    const stades = Object.fromEntries((await q(
      `SELECT fanzzy_id, stage FROM user_fanzzy WHERE user_id = ?`, [userId]))
      .map((r) => [r.fanzzy_id, Number(r.stage)]));

    /* **La tenue portée à chaque âge**, `{ 1: 'carnaval' }` — les âges sans
       tenue sont absents et se dessinent en `base`. La vue du duel la donne
       pour le personnage en tribune de chaque joueur, à son stade du moment :
       celui d'en face apparaissait dans son dessin de base, faute de la
       connaître. Même lecture qu'`avatarsDe`, et même tolérance : une base
       sans `sql/skins.sql` joue en tenue de base plutôt que de refuser le
       duel. */
    const tenues = {};
    try {
      for (const r of await q(
        `SELECT fanzzy_id, stage, skin_id FROM user_skins
          WHERE user_id = ? AND equipped = 1`, [userId])) {
        (tenues[r.fanzzy_id] ??= {})[Number(r.stage) || 1] = r.skin_id;
      }
    } catch (e) {
      if (e?.code !== 'ER_NO_SUCH_TABLE') throw e;
    }

    return {
      fanzzy: deck.fanzzy.map((f) => {
        const stuff = f.stuff ?? [];
        // L'équipement suit le personnage à travers ses âges : c'est déjà ce que
        // promet la carte de remplacement, et il serait incompréhensible qu'il
        // tombe au moment précis où le personnage grandit.
        //
        // Les modificateurs sont combinés ici une fois pour toutes, âge par
        // âge : le moteur ne doit pas refaire ce calcul à chaque geste.
        const habiller = (def, i) => ({
          id: f.id, nom: def?.nom, type: def?.type, cri: def?.cri,
          // `stage` sert au dessin : la silhouette procédurale grandit avec
          // l'âge. Sans lui, l'écran de duel dessine un Fanzzy à l'échelle NaN,
          // c'est-à-dire rien du tout.
          stage: i + 1,
          mods: { id: f.id, ...combine(def?.mods ?? {}, stuff) },
          /* **Les modificateurs du personnage seuls**, avant le sac.
             `mods` est le total, et c'est lui que le moteur applique — mais un
             total ne se décompose pas après coup : on ne peut pas dire au joueur
             « ×1,5 de tempo, dont ×1,2 du Choriste et ×1,25 des Jumelles » à
             partir de 1,5. Les deux écrans de jeu montrent maintenant cette
             ventilation, et c'est ici qu'elle se conserve. */
          modsBase: def?.mods ?? {},
        });

        const ages = lignee(f.id);
        const debloque = Math.min(stades[f.id] ?? 1, ages.length);
        const jouables = ages.slice(0, debloque).map(habiller);

        return {
          // Le premier âge est celui qui entre en tribune, toujours.
          ...(jouables[0] ?? habiller(parIdentifiant(f.id), 0)),
          stuff,
          // Le stade **en jeu**. Il démarre à 1 et c'est la Relève qui le fait
          // monter — à ne pas confondre avec `ages.length`, qui dit jusqu'où ce
          // joueur a le droit d'aller.
          stade: 1,
          ages: jouables,
          tenues: tenues[f.id] ?? {},
        };
      }),
      actions: deck.actions.map((id) => ACTION_BY_ID.get(id)).filter(Boolean),
      mainVisible: DECK_RULES.mainVisible,
    };
  }

  async function enregistrer(userId, deckBrut) {
    const deck = auPremierAge(deckBrut) ?? deckBrut;
    const possede = await possessions(userId);
    const v = validerDeck(deck, possede);
    if (!v.valide) throw fail('deck.error.invalid', v.problemes);

    const propre = {
      fanzzy: deck.fanzzy.map((f) => ({
        id: f.id,
        stuff: (f.stuff ?? []).slice(0, DECK_RULES.stuffParFanzzy),
      })),
      actions: deck.actions.slice(0, DECK_RULES.actions),
      nom: String(deck.nom ?? 'Mon deck').slice(0, 32),
    };

    await q(
      `INSERT INTO user_decks (user_id, nom, contenu, actif) VALUES (?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE nom = VALUES(nom), contenu = VALUES(contenu), maj = NOW(3)`,
      [userId, propre.nom, JSON.stringify(propre)]);

    /* ------------------------------------ le titulaire est « Mon FANZZY »

       Deux notions vivaient côte à côte sans jamais se parler :
       `user_wallet.active_fanzzy`, l'**avatar** que voient l'accueil, les amis
       et l'écran « Mon FANZZY » ; et `fanzzy[0]`, le **titulaire** qui entre
       au coup d'envoi du duel. Un joueur pouvait donc lire « TITULAIRE » sur
       la fiche d'un personnage et en voir un autre partout ailleurs dans
       l'application — sans que rien ne soit en panne, et sans qu'aucun écran
       ne puisse le lui expliquer.

       C'est une notion de trop. Le personnage qu'on met en avant est celui
       qu'on aligne : le titulaire devient donc l'avatar, ici et nulle part
       ailleurs — `enregistrer` est le seul passage obligé, que le changement
       vienne de l'écran de deck ou du bouton « emmener en duel » d'une fiche.

       Pas de `COALESCE` : c'est un **remplacement**. Le premier deck en avait
       besoin, un changement de titulaire demande le contraire.

       `active_evo` — l'âge auquel on se montre — repart à nul **quand le
       titulaire change, et seulement alors**. Deux pièges, un de chaque côté :
       le garder ferait apparaître le nouveau venu à l'âge choisi pour le
       précédent, qu'il n'a peut-être jamais atteint ; l'effacer à chaque
       enregistrement annulerait le choix du joueur dès qu'il touche à une
       carte d'action, ce qui n'a rien à voir. D'où le `<=>` — l'égalité qui
       accepte les nuls — et l'ordre des deux affectations : MariaDB les
       évalue de gauche à droite, donc `active_evo` doit se décider **avant**
       que `active_fanzzy` ne soit écrasé. */
    const titulaire = propre.fanzzy[0]?.id ?? null;
    if (titulaire) {
      await q(
        /* `packs` est **nommé** et non laissé au défaut de la colonne.

           Ce chemin ouvre parfois la bourse : il tourne à l'ouverture du paquet
           de bienvenue, qui pose la tribune de départ. La ligne prenait alors
           la réserve écrite dans le schéma — une valeur figée au jour de
           création de la table, que ni l'administration ni `pack.depart` ne
           peuvent corriger. Voir `src/server/bourse.js`. */
        `INSERT INTO user_wallet (user_id, active_fanzzy, packs) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE
           active_evo = IF(active_fanzzy <=> VALUES(active_fanzzy), active_evo, NULL),
           active_fanzzy = VALUES(active_fanzzy)`,
        [userId, titulaire, packsDepart()]);
    }

    return { deck: propre, avertissements: v.avertissements, titulaire };
  }

  /* ------------------------------------------------------- choix du match */

  /**
   * Décide si un match peut servir de support, et ce que vaut le duel.
   *
   * **La journée l'emporte sur la base.** La table `fixtures` ne connaît que
   * les clubs suivis ; un match qu'elle ignore serait refusé alors qu'il se
   * joue et que la liste vient de le proposer. Voir `football/journee.js`.
   *
   * On compare des jours, pas des heures : un match programmé à 20h45
   * aujourd'hui doit pouvoir être choisi dès le matin.
   */
  async function matchSupport(fixtureId, userId = null) {
    /* Le jour se lit sur `kickoff_at`, par `journeeDuMatch`, comme la liste :
       plus de `DATE()` ni de `UTC_DATE()` ici, qui faisaient de l'entrée la
       seule à lire l'horloge de la base. */
    const rows = await q(
      `SELECT f.id, f.status_short, f.kickoff_at, f.elapsed,
              f.home_goals, f.away_goals,
              h.name AS home_name, h.logo AS home_logo, h.id AS home_id,
              a.name AS away_name, a.logo AS away_logo, a.id AS away_id,
              l.name AS league_name
         FROM fixtures f
         JOIN teams h ON h.id = f.home_id
         JOIN teams a ON a.id = f.away_id
         LEFT JOIN leagues l ON l.id = f.league_id
        WHERE f.id = ?`, [fixtureId]);

    const duJour = (await journeeParId(jourDuFoot)).get(Number(fixtureId));
    if (!rows.length && !duJour) throw fail('duel.error.fixture_unknown');

    /* **Le match n'est pas encore en base : on l'y met.**
     *
     * `fixtures` est un cache des compétitions suivies ; la journée du jour,
     * elle, contient le monde entier. On peut donc lancer un duel sur un match
     * dont aucune ligne n'existe — et c'est ce qui se passait, en silence.
     *
     * `duel_results.fixture_id` pointait alors vers rien. La jointure du
     * parcours rendait `NULL`, et la ligne s'affichait « match inconnu », sans
     * recours : le match était joué, la partie enregistrée, et son identité
     * perdue. Un supporter voyait son virage du soir nommé et son duel du même
     * soir anonyme, parce que le virage, lui, écrivait cette ligne depuis le
     * premier jour.
     *
     * L'écriture est **sous garde et sans conséquence** : elle échoue si la
     * base est indisponible, et un duel ne doit pas refuser de démarrer pour
     * une ligne de cache. On perd alors le nom du match, ce qui est exactement
     * l'état d'avant. */
    if (!rows.length && duJour) {
      try { await ancrerDepuisLaJournee({ q, jourDuFoot }, fixtureId); }
      catch (e) { console.error('[deck] ancrage du match', e.message); }
    }

    const base = rows[0] ?? {};
    const f = duJour ? {
      id: duJour.id,
      status_short: duJour.status,
      elapsed: duJour.elapsed,
      home_goals: duJour.home?.goals ?? 0,
      away_goals: duJour.away?.goals ?? 0,
      kickoff_at: duJour.date,
      home_id: duJour.home.id, home_name: duJour.home.name, home_logo: duJour.home.logo,
      away_id: duJour.away.id, away_name: duJour.away.name, away_logo: duJour.away.logo,
      league_name: duJour.leagueName,
    } : base;

    /* Le jour UTC de l'instant du coup d'envoi, par la fonction même de la
       liste : voir `journeeDuMatch`. Ni les dix premiers caractères d'une
       date (une date servie avec son décalage tombait le lendemain), ni
       `String(date)` (voir src/shared/jour.js : il comparait des noms de
       jours de la semaine). */
    const { jour, duJour: estDuJour, ouvert } = journeeDuMatch(f.kickoff_at);
    const enCours = LIVE.includes(f.status_short);
    // Il ne décide plus de rien — la journée s'en charge — mais il sert encore
    // à le dire : « le match est joué » et « le match n'a pas commencé » sont
    // deux phrases différentes pour un joueur, et la même pour la règle.
    const termine = TERMINE.includes(f.status_short);

    /* Un match d'un jour passé : refusé. On ne rejoue pas une soirée qu'on n'a
       pas vécue.

       **Un match terminé du jour même, en revanche, passe.** Il ne passait pas,
       et c'était cohérent tant que « classé » voulait dire « en cours » : un
       match fini ne pouvait plus rien valoir. Depuis que la règle est la
       journée, le refuser fermerait précisément la soirée — le moment où l'on
       a envie de rejouer le match qu'on vient de regarder.

       Un coup d'envoi illisible n'est d'aucun jour : la colonne est `NOT
       NULL` et la journée sert toujours sa date, mais un match qu'on ne sait
       pas dater ne se classe pas plus qu'il ne s'écarte en silence. */
    if (jour === null) throw fail('duel.error.fixture_unknown');
    if (!ouvert) throw fail('duel.error.fixture_past');
    /* **Reporté ou annulé : refusé**, d'où que vienne le match. La liste ne
       le propose plus ; une page restée ouverte depuis le matin, elle, peut
       encore l'envoyer. Voir `SANS_DUEL`. */
    if (SANS_DUEL.includes(f.status_short)) throw fail('duel.error.fixture_annule');

    /* ======================================= **Classé, c'est le jour du match**

       La règle a fait un aller-retour, et les deux versions avaient raison
       chacune de son côté.

       Elle disait d'abord « le match est aujourd'hui ». On l'a resserrée à
       « le match est en cours » pour une raison d'ambiance : un duel joué à dix
       heures du matin comptait pour une rencontre du soir, et on poussait pour
       une tribune qui n'existait pas encore.

       Ce que cette raison ne pesait pas, c'est **combien de temps la porte
       reste ouverte**. Un match dure deux heures. Hors de ces deux heures, il
       n'existait aucun duel classé du tout — et comme l'onglet des duellistes
       demande trois parties classées avant de montrer quelqu'un, un joueur
       pouvait enchaîner quinze duels contre de vrais adversaires un mardi
       après-midi et ne se voir nulle part. Il en concluait, raisonnablement,
       que les duels ne comptaient pas.

       Une règle juste que personne ne peut satisfaire ne protège rien : elle
       ferme le jeu. La journée du match rouvre la porte sans rien céder sur
       l'essentiel — **on joue le jour de la rencontre, pas un autre jour** —
       et l'entraînement garde sa raison d'être, qui est de jouer sur un match
       qui n'a pas lieu aujourd'hui.

       Après le coup de sifflet final aussi : un match terminé à vingt heures
       reste le support d'un duel jusqu'à la fin de sa journée. C'est le soir
       qu'on en parle. */
    const mode = estDuJour ? 'classe' : 'entrainement';

    /* Le club soutenu, et donc le camp. La page en a besoin **avant**
       l'entrée en file : chez soi le camp est décidé et il n'y a rien à
       demander ; ailleurs, c'est au joueur de dire quelle tribune il vient
       tenir. Lui montrer un choix qu'il n'a pas, ou l'envoyer sans choisir,
       seraient deux façons de lui mentir.

       Les couleurs des deux clubs se lisent en même temps : deux clés
       primaires, par la fonction même de la liste (`teintesDes`, qui rend
       une liste sans couleurs plutôt que de lever). */
    const [suivisIci, teintes] = await Promise.all([
      userId ? q(
        `SELECT team_id, is_main FROM user_follows
          WHERE user_id = ? AND team_id IN (?, ?)
          ORDER BY is_main DESC, created_at`,
        [userId, f.home_id, f.away_id]) : null,
      teintesDes([f.home_id, f.away_id]),
    ]);
    const club = suivisIci ? clubParmi(suivisIci, f.home_id, f.away_id)
      : { teamId: null, neutre: true };
    const mien = !club.neutre;
    return {
      fixture: {
        id: f.id, jour, status: f.status_short, elapsed: f.elapsed,
        /* Le score du terrain au moment où le duel se monte. Le duel le
           tient ensuite à jour lui-même : voir `butReel` dans le moteur. */
        goals: [Number(f.home_goals) || 0, Number(f.away_goals) || 0],
        kickoffAt: f.kickoff_at, league: f.league_name,
        home: { id: f.home_id, name: f.home_name, logo: f.home_logo },
        away: { id: f.away_id, name: f.away_name, logo: f.away_logo },
        /* **Les couleurs des deux clubs**, sous la forme du Virage
           (`virage:state.fixture`) et de la liste : une ou deux couleurs
           `#RRGGBB`, un tableau vide quand on ne les a pas lues. Le duel
           emporte cet objet (`DuelNvN.fixture`) et sa vue le sert à chaque
           état : l'arène, le HUD et le bilan les ont sans relire la liste,
           reprise d'un duel comprise. */
        homeColors: teintes.get(Number(f.home_id)) ?? [],
        awayColors: teintes.get(Number(f.away_id)) ?? [],
      },
      mode,
      enCours,
      termine,
      monCamp: campDe(club.teamId, f.home_id, f.away_id),
      neutre: club.neutre,
      // L'explication est renvoyée au client : il ne doit pas avoir à deviner
      // pourquoi un duel ne compte pas.
      /* Quatre phrases pour trois moments, et la nuance compte : ce qui
         décide est la journée, mais ce que le joueur veut savoir est **où en
         est le match**. « Ce duel comptera » sur une rencontre terminée
         laisserait croire à une erreur ; « le match est joué » l'explique. */
      raison: raisonDuMatch(estDuJour, enCours, termine),
      // Ce match met-il en jeu un club suivi ? Le duel rapporte alors le
      // double. `userId` est facultatif : appelé sans lui — depuis la file du
      // NvN, qui ne veut que le support du duel — la question ne se pose pas.
      mien,
      ...(mien ? { bonus: 2 } : {}),
    };
  }

  /** Les matchs proposables : aujourd'hui d'abord, puis les jours suivants. */
  async function matchsProposables(userId, { tousLesClubs = false } = {}) {
    const filtre = tousLesClubs ? '' :
      `AND (f.home_id IN (SELECT team_id FROM user_follows WHERE user_id = ?)
         OR f.away_id IN (SELECT team_id FROM user_follows WHERE user_id = ?))`;
    const args = [...SANS_DUEL, ...(tousLesClubs ? [] : [userId, userId])];

    const rows = await q(
      `SELECT f.id, f.status_short, f.elapsed, f.kickoff_at, f.home_goals, f.away_goals,
              DATE(f.kickoff_at) = UTC_DATE() AS aujourdhui,
              f.home_id, f.away_id,
              h.name AS home_name, h.logo AS home_logo,
              a.name AS away_name, a.logo AS away_logo, l.name AS league_name
         FROM fixtures f
         JOIN teams h ON h.id = f.home_id
         JOIN teams a ON a.id = f.away_id
         LEFT JOIN leagues l ON l.id = f.league_id
        -- Les matchs finis du jour restent, depuis que « classé » veut dire
        -- « le jour du match » : c'est le soir qu'on a envie de rejouer la
        -- rencontre qu'on vient de regarder. La borne sur la date suffit à
        -- écarter ceux d'hier.
        --
        -- CANC et PST partent toujours : un match annulé ou reporté n'a pas eu
        -- lieu, il ne peut donc être le support de rien. Ce n'est pas la même
        -- chose qu'un match terminé. La liste vient de SANS_DUEL, et la
        -- journée superposée plus bas passe par le même filtre.
        WHERE f.status_short NOT IN (${SANS_DUEL.map(() => '?').join(',')})
          AND DATE(f.kickoff_at) >= UTC_DATE()
          AND f.kickoff_at < (UTC_TIMESTAMP() + INTERVAL 8 DAY)
          ${filtre}
        ORDER BY aujourdhui DESC, f.kickoff_at
        LIMIT 60`, args);

    /* Triés — le club principal d'abord — parce que c'est cet ordre qui
       départage un derby, et que `clubParmi` compte dessus. */
    const suivis = await q(
      `SELECT team_id, is_main FROM user_follows WHERE user_id = ?
        ORDER BY is_main DESC, created_at`, [userId]);
    const mesClubs = new Set(suivis.map((r) => r.team_id));

    const parId = new Map();
    for (const f of rows) parId.set(Number(f.id), { ...f });

    /* **La journée du football se superpose à la base.**
     *
     * La base ne connaît que les clubs suivis : la liste ignorait la moitié
     * des rencontres en direct, et affichait « classé » sur des matchs dont
     * elle croyait encore qu'ils n'avaient pas commencé. La journée a tout ce
     * qui se joue aujourd'hui, et elle l'a juste ; la base garde les huit
     * prochains jours, qu'elle seule connaît. Voir `football/journee.js`. */
    for (const [id, m] of await journeeParId(jourDuFoot)) {
      /* Un match fini **reste** : c'est un support valable jusqu'à la fin de
         sa journée. On l'écrasait auparavant, quand « classé » voulait dire
         « en cours » et qu'une rencontre terminée ne pouvait plus rien valoir.

         Sa ligne est écrasée par celle de la journée dans tous les cas, jamais
         ignorée : la base peut le croire encore en cours, et la laisser
         telle quelle afficherait un score figé à la 67ᵉ minute sur un match
         terminé depuis une heure. */
      parId.set(id, {
        ...parId.get(id),
        id,
        status_short: m.status,
        elapsed: m.elapsed,
        kickoff_at: m.date,
        home_goals: m.home.goals, away_goals: m.away.goals,
        home_id: m.home.id, away_id: m.away.id,
        home_name: m.home.name, home_logo: m.home.logo,
        away_name: m.away.name, away_logo: m.away.logo,
        league_name: m.leagueName,
        tier: m.tier,
      });
    }

    /* L'instant de référence, lu **une fois** pour toute la liste, et passé à
       la fonction même que `matchSupport` emploie (`journeeDuMatch`) : la
       colonne `aujourdhui` de la requête ne vaut que pour les lignes venues de
       la base, et les rencontres injectées par la journée n'en ont pas. Deux
       façons de dire « aujourd'hui » finiraient par se contredire sur un
       match de vingt-trois heures. */
    const maintenant = Date.now();

    /* **Reporté ou annulé : hors de la liste**, d'où que vienne le match. La
       requête les écartait, mais la journée superposée juste au-dessus les y
       remettait — et un match que la base croit à venir, la journée peut le
       savoir reporté. Le filtre passe donc après elle. Voir `SANS_DUEL`. */
    const supportables = [...parId.values()].filter((f) => !SANS_DUEL.includes(f.status_short));

    const liste = supportables.map((f) => {
      const club = clubParmi(suivis, f.home_id, f.away_id);
      const enCours = LIVE.includes(f.status_short);
      // Il ne décide plus de rien — la journée s'en charge — mais il sert
      // encore à le dire : voir `raisonDuMatch`.
      const termine = TERMINE.includes(f.status_short);
      /* **Ce qui est en jeu** (CONTRATS.md § 17), sauf sur un match qu'on ne
         peut plus jouer (`ouvert`) : `matchSupport` refuse un jour passé, et
         promettre des écharpes sur une entrée refusée serait mentir deux
         fois. La requête écarte déjà les jours passés ; c'est la journée du
         football qui peut en rapporter un. Le jour, le mode et `ouvert`
         sortent de la même fonction que ceux de l'entrée : le montant et le
         mode d'une ligne ne peuvent contredire ni l'un l'autre, ni ce que
         l'entrée décidera. */
      const { duJour, ouvert } = journeeDuMatch(f.kickoff_at, maintenant);
      const mode = duJour ? 'classe' : 'entrainement';
      return {
        ...f,
        enCours,
        termine,
        raison: raisonDuMatch(duJour, enCours, termine),
        aujourdhui: duJour ? 1 : 0,
        /* **Classé, c'est le jour du match.** Voir `matchSupport`, qui applique
           la même règle — et qui fait autorité, puisque c'est lui qui décide au
           moment de l'entrée en file. */
        mode,
        // Pousser pour son club rapporte le double. Le dire **avant** le choix :
        // une règle qu'on ne découvre qu'en lisant son solde après coup ne pèse
        // sur aucune décision, et c'est pourtant là qu'elle doit peser.
        mien: !club.neutre,
        // Et de quel côté : la page en fait un camp imposé ou un choix.
        monCamp: campDe(club.teamId, f.home_id, f.away_id),
        // Absent, et non nul, quand on ne peut plus entrer (R1).
        ...(ouvert ? { enJeu: enJeuDe(mode, !club.neutre) } : {}),
      };
    });

    /* L'ordre, maintenant que la liste couvre le monde entier. Ce qui se joue
       d'abord — c'est ce qu'on vient chercher — puis mes clubs, puis les
       grandes compétitions, puis l'heure. Trié par heure seule, une finale de
       Ligue des champions se retrouvait derrière un championnat U19. */
    /* Ce qui se joue d'abord, **puis ce qui se joue aujourd'hui** — c'est
       maintenant la même chose que « ce qui est classé », et c'est ce qu'on
       vient chercher. Sans ce second critère, un match terminé du jour se
       rangeait entre deux rencontres de mercredi prochain. */
    liste.sort((a, b) =>
      (b.enCours - a.enCours) || (b.aujourdhui - a.aujourdhui) || (b.mien - a.mien)
      || ((a.tier ?? 3) - (b.tier ?? 3))
      || (new Date(a.kickoff_at) - new Date(b.kickoff_at)));

    const visibles = tousLesClubs ? liste : liste.filter((f) => f.mien);

    /* Soixante, comme avant : la requête s'arrêtait là, et la journée pourrait
       en ajouter trois cents un samedi soir. Ce qui se joue est en tête, donc
       ce qui tombe est ce qu'on n'allait pas choisir de toute façon. */
    const retenus = visibles.slice(0, 60);

    /* **Les couleurs des deux clubs**, comme les sert la liste du Virage :
       l'affiche du match choisi porte une écharpe à leurs deux couleurs, et
       le camp se choisit sur deux bâches teintes. Elles ne viennent pas de la
       requête du dessus — la moitié des matchs arrivent par la journée, sans
       ligne en base —, mais d'une lecture **par clé primaire** des clubs de
       ces soixante matchs au plus, faite après la coupe : cent vingt clés,
       jamais la journée entière. Une ou deux couleurs, jamais un tableau vide
       déguisé en couleur : la page teste la longueur et garde la sienne. */
    const teintes = await teintesDes(retenus.flatMap((f) => [f.home_id, f.away_id]));
    return retenus.map((f) => ({ ...f,
      homeColors: teintes.get(Number(f.home_id)) ?? [],
      awayColors: teintes.get(Number(f.away_id)) ?? [] }));
  }

  let teintesTues = false;
  /**
   * Les couleurs de ces clubs, lues dans `teams` (`sql/couleurs.sql`).
   *
   * Une base sans les colonnes, ou une lecture qui échoue, rend la liste sans
   * couleurs plutôt que de la faire tomber : une teinte ne vaut pas le choix
   * d'un match. Le journal le dit une fois.
   */
  async function teintesDes(ids) {
    const uniques = [...new Set(ids.map(Number).filter((id) => id > 0))];
    if (!uniques.length) return new Map();
    try {
      const rows = await q(`SELECT id, color1, color2 FROM teams WHERE id IN (${
        uniques.map(() => '?').join(',')})`, uniques);
      return new Map(rows.map((t) => [Number(t.id), [t.color1, t.color2].filter(Boolean)]));
    } catch (e) {
      if (!teintesTues) {
        teintesTues = true;
        console.error('[deck] matchs servis sans les couleurs des clubs :',
          e.sqlMessage ?? e.message, '(applique sql/couleurs.sql)');
      }
      return new Map();
    }
  }


  /* ------------------------------------------------- placer depuis la fiche

     La fiche d'un Fanzzy porte un bouton « EMMENER EN DUEL ». Il écrivait
     `user_wallet.active_fanzzy` — c'est-à-dire **l'avatar**, celui que voient
     les amis et l'accueil. Le personnage n'entrait pas en duel pour autant, et
     la fiche affichait ensuite « DÉJÀ EN DUEL » sur quelqu'un qui n'était dans
     aucun deck. Le bouton disait une chose et en faisait une autre.

     Il fait maintenant ce qu'il dit, et il demande **où** : un deck a un
     titulaire, celui qui entre au coup d'envoi, et des remplaçants que la carte
     Changement fait entrer. Ce n'est pas la même décision, et la fiche ne peut
     pas la prendre à la place du joueur.

     Le reste du deck n'est pas touché : les pièces des autres rangs, les dix
     cartes d'action et le nom restent exactement où ils sont.
  */
  /**
   * Le deck qu'on écrit à quelqu'un qui n'en a jamais monté.
   *
   * ## Pourquoi un deck vide est refusé, et pourquoi c'est un piège
   *
   * `validerDeck` exige **dix cartes d'action**, ni neuf ni onze. La règle est
   * juste — un duel se joue à dix — mais elle s'applique aussi au tout premier
   * enregistrement. Un nouveau venu qui posait son Fanzzy depuis sa fiche
   * partait donc de `{ fanzzy: [lui], actions: [] }`, et le serveur répondait
   * `deck.error.invalid`. La fiche disait « Impossible pour le moment », le
   * deck restait vide, et rien n'expliquait au joueur qu'il lui manquait dix
   * cartes qu'il **possède déjà**.
   *
   * Les communes sont offertes à tout le monde (voir `possessions`) : il y a
   * toujours de quoi remplir les dix places. On les remplit donc, en tournant
   * sur ce qu'il a — un deck de départ jouable, qu'il remaniera à l'écran de
   * deck quand il en aura envie. Ce n'est pas un choix qu'on lui confisque,
   * c'est un choix qu'on ne lui impose pas avant sa première partie.
   */
  function deckNeuf(possede) {
    const dispo = [...possede.actions];
    /* Aucune carte d'action du tout : on rend un deck vide plutôt que de
       boucler sur une liste vide. `validerDeck` le refusera, et c'est la bonne
       réponse — mais elle viendra d'une règle, pas d'un `%` par zéro. */
    const actions = dispo.length
      ? Array.from({ length: DECK_RULES.actions }, (_, i) => dispo[i % dispo.length])
      : [];
    return { fanzzy: [], actions, nom: 'Mon deck' };
  }

  /**
   * Le deck de bienvenue : un titulaire et dix cartes, écrits une seule fois.
   *
   * Appelé à l'ouverture du paquet de bienvenue. Sans lui, le joueur sortait
   * de sa première ouverture avec des cartes, un avatar — et un deck vide :
   * l'écran de duel lui demandait de monter une tribune avant d'avoir compris
   * ce qu'était une tribune.
   *
   * Il ne fait rien si un deck existe déjà : c'est un point de départ, jamais
   * une remise à zéro.
   */
  async function premierDeck(userId, fanzzyId) {
    if (await deckDe(userId)) return null;
    const id = racineDe(String(fanzzyId ?? ''));
    if (!parIdentifiant(id)) return null;
    const possede = await possessions(userId);
    if (!possede.fanzzy.has(id)) return null;
    try {
      return await enregistrer(userId, { ...deckNeuf(possede), fanzzy: [{ id, stuff: [] }] });
    } catch {
      /* Un deck de départ qu'on ne peut pas écrire ne doit pas faire échouer
         l'ouverture du paquet : le joueur perdrait ses cinq cartes pour une
         commodité. Il montera sa tribune lui-même. */
      return null;
    }
  }

  async function placer(userId, { id: brut, place: placeBrute }) {
    const id = racineDe(String(brut ?? ''));
    if (!parIdentifiant(id)) throw fail('deck.error.fanzzy_unknown');

    const possede = await possessions(userId);
    if (!possede.fanzzy.has(id)) throw fail('deck.error.fanzzy_not_owned', { id });

    const places = Math.min(DECK_RULES.fanzzy, possede.fanzzyMax);
    /* `typeof === 'number'` avant tout le reste, et ce n'est pas de la
       pédanterie : `Number(null)`, `Number('')`, `Number(false)` et `Number([])`
       valent tous **zéro**. Un appel sans place, ou avec une place vide, aurait
       donc nommé un titulaire en silence — en sortant celui qui y était.
       C'est le contraire exact de ce que la question « titulaire ou
       remplaçant ? » est là pour obtenir. */
    const place = typeof placeBrute === 'number' ? placeBrute
      : (typeof placeBrute === 'string' && placeBrute.trim() !== '' ? Number(placeBrute) : NaN);
    if (!Number.isInteger(place) || place < 0 || place >= places) {
      throw fail('deck.error.place_hors_deck', { place: placeBrute, places });
    }

    /* Pas encore de deck : on en fabrique un complet plutôt que la coquille
       vide d'avant, que `validerDeck` refusait aussitôt. Voir `deckNeuf`. */
    const deck = (await deckDe(userId)) ?? deckNeuf(possede);
    const rangs = [...(deck.fanzzy ?? [])];

    /* **Le trou au milieu.** Placer en remplaçant 2 quand le remplaçant 1 est
       vide laisserait un trou dans la liste, et le premier rang non vide n'est
       plus le titulaire — c'est `loadout` qui décide, et il lit `fanzzy[0]`.
       On comble donc les places manquantes… avec quoi ? Rien. Alors on refuse,
       et la page n'ouvre ce choix que sur une place atteignable. */
    if (place > rangs.length) throw fail('deck.error.place_vide_avant', { place });

    /* Un personnage déjà au deck qu'on place ailleurs **se déplace**, il ne se
       duplique pas : `validerDeck` refuse les doublons, et le joueur qui glisse
       son titulaire en remplaçant veut à l'évidence l'y déplacer. Il emporte son
       équipement avec lui — c'est le sien. */
    const dejaLa = rangs.findIndex((f) => f.id === id);
    const sortant = rangs[place] ?? null;
    const entrant = dejaLa >= 0 ? rangs[dejaLa] : { id, stuff: [] };

    if (dejaLa >= 0 && dejaLa !== place) {
      /* L'échange plutôt que le décalage : sans lui, déplacer le titulaire en
         remplaçant laisserait le rang 0 vide et le deck invalide. Les deux
         personnages échangent leur place, équipement compris. */
      rangs[dejaLa] = sortant ?? null;
      if (!sortant) rangs.splice(dejaLa, 1);
    }
    rangs[place] = entrant;

    const propre = { ...deck, fanzzy: rangs.filter(Boolean) };
    const r = await enregistrer(userId, propre);
    return {
      ...r,
      place,
      // Qui a cédé sa place, pour que l'écran puisse le dire plutôt que de
      // laisser le joueur s'apercevoir plus tard qu'il a perdu un rang.
      remplace: sortant && sortant.id !== id ? sortant.id : null,
    };
  }

  /* -------------------------------------------------------------- routes */

  const router = express.Router();
  router.use(express.json({ limit: '16kb' }));
  const safe = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => {
    if (!res.headersSent) {
      res.status(400).json({ error: e.code ?? 'deck.error.server', detail: e.extra });
    }
  });

  /** Catalogue et règles : tout ce qu'il faut pour construire l'écran de deck. */
  router.get('/catalogue', (_req, res) => {
    res.set('cache-control', 'public, max-age=3600');
    /* `primes` à côté de `formats` : la page nomme, le serveur compte. Sans
       elles, l'écran devrait refaire le calcul — donc en porter une copie,
       qui divergerait au premier réglage changé depuis /admin. */
    /* `ACTIONS_MARQUEES` et non `ACTIONS` : chaque carte dit où elle se joue.
       C'est l'écran de construction du deck — c'est exactement là que la
       question se pose, et le seul endroit où y répondre coûte zéro. */
    res.json({ actions: ACTIONS_MARQUEES, regles: DECK_RULES, formats: Object.keys(FORMATS),
      primes: Object.fromEntries(Object.keys(FORMATS)
        .map((f) => [f, Number(primeDeFormat(f).toFixed(2))])) });
  });

  router.get('/mien', requireAuth, safe(async (req, res) => {
    const [deck, possede] = await Promise.all([deckDe(req.user.id), possessions(req.user.id)]);
    res.json({
      deck,
      possede: {
        fanzzy: [...possede.fanzzy],
        // Le plafond du moment : la page affiche autant de rangs, ni plus
        // ni moins. Le lui faire déduire du niveau serait une seconde règle
        // à tenir à jour, et elle divergerait.
        fanzzyMax: possede.fanzzyMax,
        // Et à quel niveau le suivant s'ouvre, pour que l'écran puisse le dire
        // au lieu de laisser croire à une limite arbitraire. `null` quand il
        // n'y a plus rien à ouvrir.
        fanzzyProchain: prochainPalierFanzzy(possede.fanzzyMax),
        // Le stade atteint par personnage : la page en a besoin pour avertir
        // celui qui aligne un Fanzzy évolué sans embarquer de Relève.
        stades: possede.stades,
        stuff: [...possede.stuff],
        /* Combien de chaque pièce. L'écran en a besoin pour savoir s'il peut
           proposer une pièce déjà portée ailleurs : un objet possédé deux fois
           se porte deux fois — voir `stuffCopies` et la validation du deck.
           Un objet plutôt qu'une Map : c'est du JSON. */
        stuffCopies: Object.fromEntries(possede.stuffCopies),
        actions: [...possede.actions],
      },
      regles: DECK_RULES,
    });
  }));

  router.put('/mien', requireAuth, safe(async (req, res) =>
    res.json(await enregistrer(req.user.id, req.body ?? {}))));

  /** Poser un Fanzzy à une place précise, depuis sa fiche. Voir `placer`. */
  router.post('/placer', requireAuth, safe(async (req, res) =>
    res.json(await placer(req.user.id, req.body ?? {}))));

  router.get('/loadout', requireAuth, safe(async (req, res) =>
    res.json((await loadout(req.user.id)) ?? { error: 'deck.error.none' })));

  router.get('/matchs', requireAuth, safe(async (req, res) =>
    res.json({ matchs: await matchsProposables(req.user.id,
      { tousLesClubs: req.query.tous === '1' }) })));

  /** Un match, tel que l'entrée en file le décidera — et ce qui y est en jeu
      (`enJeu`, comme sur la liste, CONTRATS.md § 17), calculé sur le mode
      que `matchSupport` vient de décider. Ajouté ici et non dans
      `matchSupport` : le duel emporte ce support tel quel, et un entraînement
      contre les bots, qui le recopie en changeant le mode, y garderait un
      montant classé qu'il ne paiera pas. Un match refusé n'a rien en jeu :
      la route rend alors l'erreur, comme avant. */
  router.get('/match/:id', requireAuth, safe(async (req, res) => {
    const s = await matchSupport(Number(req.params.id), req.user.id);
    res.json({ ...s, enJeu: enJeuDe(s.mode, s.mien) });
  }));

  return { router, deckDe, loadout, enregistrer, placer, premierDeck, matchSupport,
    matchsProposables, possessions };
}
