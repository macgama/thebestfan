import { reglage } from '../../shared/reglages.js';
import { grade, applyHeroMods, resoudreGeste, Cheat } from './gestures.js';
import { ACTION_BY_ID, ACTIONS_VIRAGE, dansLeVirage } from '../../shared/duel/actions.js';
import { CHANTS, ORDRE } from '../../shared/duel/chants.js';
import { stadeDeLaRencontre } from '../../shared/stades.js';
// Les stades qu'une saison a ouverts : voir `stade()`.
import { ouverts } from '../contenus/index.js';
// La composition lieu + Fanzzy vit dans le moteur de duel : une seule règle.
import { avecLieu } from '../nvn/engine.js';
import { poserEffet, nettoyerEffets, modsAvecEffets } from '../../shared/duel/effets.js';
// La ventilation de ce qu'un supporter porte : le lieu s'y ajoute ici, les
// trois autres sources arrivent avec l'entrée. Partagée avec le duel.
import { apportsDe, seulsLesMods } from '../../shared/apports.js';
// L'échelle unique du verdict (`CONTRATS.md`, § 16.1) : le mot, le Cri, le
// PARFAIT qui fait la série, et la note qu'ils mesurent tous les trois.
import { verdictDe, estParfait, criDe, auMoins, noteDuVerdict } from '../../shared/verdict.js';

/**
 * Les trois fins d'un match, celles que le contrat appelle « le coup de
 * sifflet final » (`CONTRATS.md`, § 15.3) : `virage:fin` part une fois à la
 * salle, le bilan devient `fini`, et la tribune se vide `virage.bilan_min`
 * minutes plus tard.
 *
 * Pas l'annulation, le tapis vert ni le forfait : ils sortent du relevé comme
 * eux (`TERMINES`, dans `ferveur/index.js`), mais ce ne sont pas des coups de
 * sifflet, et un bilan « fini » sur un match qui n'a pas été joué mentirait.
 */
export const FINS_DE_MATCH = new Set(['FT', 'AET', 'PEN']);

/**
 * Les paliers de la ferveur, du plus large au plus étroit : « 12ᵉ → TOP 10 »
 * (`CONTRATS.md`, § 16.2). **Une règle, pas un réglage** : ils sont dessinés,
 * comme les seuils du verdict, et ne passent pas par le registre.
 */
export const PALIERS = Object.freeze([100, 50, 10, 3, 1]);

/**
 * L'ordre d'une tribune : la ferveur, puis les chants, puis les PARFAITS.
 *
 * Le même au bilan (`bilan.js`) et en direct : un joueur ne doit pas se voir
 * 11ᵉ dans la tribune et 12ᵉ au bilan pour la même ferveur. Les chants
 * départagent d'abord parce que la ferveur d'une grande tribune s'arrondit
 * vers le plancher (Q4) : sans eux, « 1 + ceux qui font mieux » dirait 1ᵉʳ à
 * tout le monde.
 *
 * @returns un nombre > 0 si `a` fait strictement mieux que `b`
 */
export function comparerTribune(a, b) {
  return (a.ferveur - b.ferveur) || ((a.chants ?? 0) - (b.chants ?? 0))
    || ((a.parfaits ?? 0) - (b.parfaits ?? 0));
}

/** Le plus grand palier strictement meilleur qu'une place ; `null` à la première. */
export function palierAuDessus(rang) {
  for (const p of PALIERS) if (p < rang) return p;
  return null;
}

/**
 * La note du verdict en millièmes, pour `virage_presence.meilleur_q` (0 à
 * 1 200 : certains gestes notent jusqu'à 1,2).
 *
 * **Arrondie vers le haut**, et non au plus proche : le bilan relit le verdict
 * du meilleur geste sur ce nombre (`verdictDe(q / 1000)`), et les seuils sont
 * stricts. Un 0,9004 arrondi au plus proche ferait 900 — BON au bilan pour un
 * geste annoncé PARFAIT en tribune. Vers le haut, « au-dessus de 0,9 » reste
 * « au-dessus de 900 », et 0,9 tout juste reste 900.
 *
 * Le millionième retiré avant d'arrondir efface le bruit des flottants : 0,97
 * vaut 970,0000000000001 une fois multiplié, et ferait sinon 971.
 */
export function enMilliemes(note) {
  const n = Number(note);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.max(0, Math.min(1200, Math.ceil(n * 1000 - 1e-6)));
}

/**
 * Le Grand Virage.
 *
 * Une salle par match réel. Deux tribunes tirent sur la même corde pendant
 * toute la durée du match. Personne ne décide seul du résultat — ce que chacun
 * décide, c'est sa place dans sa propre tribune.
 *
 * Trois principes tiennent tout :
 *   — le serveur agrège et diffuse une position, jamais les gestes individuels ;
 *   — une tribune deux fois plus nombreuse ne pousse pas deux fois plus fort ;
 *   — un but réel secoue la corde et ouvre une fenêtre où tout compte double.
 */

/**
 * Le fil du match.
 *
 * Le joueur pousse sur une corde pendant un vrai match, et rien ne lui disait
 * ce qui se passait sur le terrain : la corde tressaillait, il ne savait pas
 * pourquoi. Le fil est ce qui relie les deux.
 *
 * Quatre sortes d'entrées, et elles n'ont pas du tout le même coût :
 *
 *   — **la période** — coup d'envoi, mi-temps, reprise, fin — est *gratuite* :
 *     le relevé du direct lit déjà le statut du match toutes les vingt
 *     secondes, vingt matchs par appel ;
 *   — **le but réel** est gratuit lui aussi : il arrive par le chemin qui
 *     existait déjà, celui qui secoue la corde et frappe les cartes-souvenirs ;
 *   — **le but de tribune** vient du jeu lui-même, il ne coûte rien ;
 *   — **le reste du terrain** — cartons, remplacements, arbitrage vidéo —
 *     demande un appel par match, et n'est donc demandé que pour un match dont
 *     la salle est peuplée. Voir `createPoller`.
 *
 * Un fil qui ne dit que ce qu'il sait vaut mieux qu'un fil qui vide le quota :
 * la mi-temps s'affiche même les jours où les cartons manquent.
 *
 * Les entrées sortent **structurées**, jamais rédigées. Le serveur envoie un
 * genre et un code — `periode`/`HT`, `terrain`/`Card` — et la page écrit
 * « Mi-temps » ou dessine un rectangle jaune. C'est la règle des messages
 * d'erreur appliquée au reste : le français vit dans la page, qui sait déjà
 * dans quelle langue elle est.
 */
const FIL_MAX = 60;

/**
 * Les effets que ce moteur sait résoudre.
 *
 * **Elle existe pour pouvoir refuser avant de débiter.** `appliquer` lève
 * `unknown_effect` sur un type inconnu, mais il est appelé tout à la fin de
 * `jouer` — après le souffle prélevé, la carte retirée de la main et la
 * recharge armée. Un effet manquant ne faisait donc pas échouer la carte :
 * il la faisait disparaître en la facturant.
 *
 * Elle double le `switch`, et c'est assumé : une liste qu'on oublie de tenir
 * à jour ferait refuser une carte qui marche, ce qui se voit en une partie.
 * L'oubli inverse — ajouter un `case` sans l'inscrire ici — est donc le seul
 * possible, et il est le moins cher des deux. `virage-smoke` vérifie de toute
 * façon que **toute carte jouable au Virage** a son effet dans cette liste.
 */
export const EFFETS_CONNUS = new Set([
  'push', 'refill', 'team_breath', 'mod_self', 'floor_quality',
  'rally', 'per_mate', 'sync', 'refill_hand', 'clear_cooldowns',
  'delayed_push', 'freeze_decay', 'double_next', 'cost_free', 'push_over_time',
]);

/** La minute où placer un changement de période, faute que l'API en donne une. */
const MINUTE_DE_PERIODE = { '1H': 0, HT: 45, '2H': 45, ET: 90, BT: 90, P: 120, FT: 90, AET: 120, PEN: 120 };

/**
 * La mi-temps d'un chant : 1 en première, 2 en seconde, 0 partout ailleurs.
 *
 * Elle se lit sur le **statut du vrai match** que la salle tient déjà — le
 * relevé du direct le lit toutes les vingt secondes, sans un appel de plus —
 * et jamais sur la minute : la minute 45 est à la fois la fin de la première
 * et le début de la seconde, et le temps additionnel la fait déborder.
 *
 * La mi-temps elle-même, les prolongations, les tirs au but, un match dont la
 * compétition ne dit que « en direct » (`LIVE`) : zéro. La mission « dans
 * chaque mi-temps » ne compte que les deux vraies, et un chant à la pause ne
 * doit pas en remplir une.
 */
function miTemps(statut) {
  if (statut === '1H') return 1;
  if (statut === '2H') return 2;
  return 0;
}

/* Des getters, et non des nombres : `RULES.goalAt` s'écrit toujours pareil
   sur les sites qui le lisent, mais il interroge le registre à chaque lecture.
   Ces cinq-là sont réglables depuis l'administration ; les autres restent des
   constantes, parce qu'elles décrivent la mécanique et non son équilibrage. */
export const RULES = {
  get goalAt() { return reglage('virage.but_a'); },
  get decayPerSec() { return reglage('virage.decroissance'); },
  get breathMax() { return reglage('virage.souffle_max'); },
  get breathPerSec() { return reglage('virage.souffle_par_sec'); },
  surgeAfterRealGoalMs: 60_000,
  surgeFactor: 2,
  tickMs: 100,             // diffusion 10 fois par seconde
  broadcastEveryTicks: 1,
  // Sans geste, on ne compte plus dans la foule.
  get idleMs() { return reglage('virage.inactif_sec') * 1000; },
  get realGoalJolt() { return reglage('virage.secousse_but_reel'); },
  /* Le plancher de partage de la ferveur. Voir `partFerveur`. */
  get tribuneMin() { return reglage('virage.tribune_min'); },

  /* ------------------------------------------------- les cartes d'action

     Le Virage n'est pas un duel avec plus de monde. Ce qu'on y joue, ce sont
     les cartes qui agissent sur soi ou sur sa tribune — le tri se fait dans
     `dansLeVirage`, sur la portée de l'effet, pas sur une liste de noms. */
  mainVisible: 5,
  refillMs: 2500,          // la carte suivante n'arrive pas tout de suite
  cardCooldownMult: 1.5,   // une salle dure 90 minutes, un duel 5 : on ralentit

  /**
   * Le plafond d'une fenêtre collective.
   *
   * Mosaïque et Chœur comptent les coéquipiers actifs, et une tribune de trois
   * cents donnerait des nombres sans rapport avec le reste du jeu. La poussée
   * qu'ils produisent passe par la même division par l'effectif que tout le
   * reste : elle mesure donc une **proportion** de tribune active, pas un
   * effectif — ce qui est exactement ce que ces cartes racontent. Ce plafond
   * n'est que le filet, pour le jour où la division changerait.
   */
  collectifMax: 12,

  /**
   * Ce que rapporte un chant quand on soutient un club qu'on ne suit pas.
   *
   * Le virage est ouvert à tous les matchs en direct : on choisit son camp,
   * même sans être de la maison. Mais la ferveur — ce qui compte au classement
   * — ne vaut alors que la moitié. C'est le même principe que le duel, où le
   * souffle offert par un but réel ne va qu'à ceux qui suivent le club
   * buteur : on peut venir pousser partout, on ne se bâtit une réputation que
   * chez soi.
   *
   * **La poussée, elle, n'est pas réduite.** Ce qu'on réduit, c'est ce que le
   * supporter gagne, pas ce qu'il apporte : une tribune qui pousse à moitié
   * serait une tribune qu'on décourage de venir, et le but est l'inverse.
   */
  ferveurNeutre: 0.5,

  /* Le répertoire : cinq chants offerts à la fois, qui changent toutes les dix
     minutes **de match réel**. Dix minutes parce qu'un supporter doit avoir le
     temps d'apprendre un geste avant qu'on le lui retire, et le match réel
     parce que le Virage suit la rencontre — toute la tribune change de
     répertoire au même instant, sans que le serveur ait à le dire. */
  repertoire: 5,
  repertoireMin: 10,
};

/* Les douze chants et leur ordre de rotation vivent dans
   src/shared/duel/chants.js, à côté des cartes d'action : la chaîne
   d'illustrations et les contrôles en ont besoin, et aucun des deux ne peut
   importer un moteur de salle pour lire une table de douze lignes. */
const CARDS = CHANTS;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** Mélange sur place, sans biais — Fisher-Yates. */
function melanger(t) {
  const a = [...t];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* Le lieu était calculé **dans l'état**, à chaque diffusion — dix fois par
   seconde, pour un résultat qui ne change jamais de tout le match. Ce n'était
   pas un coût sensible, mais c'était surtout un endroit où le lieu n'était pas
   consultable : le calcul de poussée en a besoin lui aussi, et il aurait fallu
   le refaire là-bas, avec une seconde chance de le faire autrement. */

/** Une foule deux fois plus nombreuse pèse 18 % de plus, pas 100 %. */
export function crowdFactor(n) {
  return 1 + 0.18 * Math.log2(Math.max(1, n / 100));
}

export class VirageRoom {
  /**
   * @param fixture {id, homeId, awayId, homeName, awayName, leagueId, kickoffAt}
   */
  constructor({ fixture, emit, emitVous, onPush, onGoal, log = console }) {
    this.fixture = fixture;
    this.emit = emit;                 // (event, payload) => void, vers la salle
    /* (userId, you) => void, vers **tous les onglets d'un seul joueur**.
       `emit` parle à la salle entière ; la main, elle, n'appartient qu'à
       celui qui la tient. Sans ce canal, la carte tirée au battement restait
       dans la salle : `virage:vous` ne partait qu'après une carte jouée, donc
       *avant* le tirage, et la page gardait une case vide pour toujours.
       Facultatif : une salle montée sans lui — les suites — tire en silence. */
    this.emitVous = emitVous;
    this.onPush = onPush;             // enregistrement de présence
    this.onGoal = onGoal;             // but de jeu (pas le but réel)
    this.log = log;

    this.rope = 0;                    // <0 = domicile mène, >0 = extérieur
    this.goals = [0, 0];
    this.realGoals = [0, 0];
    this.surgeUntil = 0;
    /* La minute double telle que la salle l'a annoncée pour la dernière fois.
       Voir `tick` : sa fin doit partir, même quand rien d'autre ne bouge. */
    this.surgeDiffusee = false;
    this.members = new Map();         // userId -> état du supporter
    /* **Les partis, gardés autant que la salle.** Un départ supprimait le
       membre, et le retour le recréait à neuf : 40 de souffle, une main
       neuve, les recharges et la fatigue effacées. Recharger la page valait
       donc un « Nouveau souffle » et un « Changement de chant » gratuits — et
       la ferveur ainsi gagnée s'écrit au classement —, pendant que le joueur
       honnête perdait à chaque coupure de réseau son rang et son souffle
       au-delà de 40. Un parti ne compte ni dans la foule, ni dans le rang, ni
       dans le battement ; il retrouve tout à son retour.

       La salle, elle, vit tant que son match peut encore se jouer, vide ou
       non, et une minute après le coup de sifflet : voir la libération, dans
       `ferveur/index.js`. C'est ce qui fait durer les partis tout le match. */
    this.partis = new Map();          // userId -> état du supporter parti
    this.rallies = [];                // fenêtres collectives ouvertes, par camp
    this.differes = [];               // poussées armées, qui frapperont plus tard
    this.geleeJusqua = 0;             // l’Ancre : la corde cesse de retomber
    this.rangChangeA = 0;             // quand le répertoire a tourné pour la dernière fois
    this.seq = 0;
    this.last = Date.now();
    /* `last` est l'horloge du battement : il avance à chaque tour, salle vide
       ou pleine, et ne peut donc pas dire depuis quand la salle est vide. La
       libération lit ceci : le dernier instant où quelqu'un était là. */
    this.occupeeA = Date.now();
    this.dirty = false;

    /* Le fil, et le vrai match derrière lui.
       `scoreReel` et `statut` ne se déduisent pas du fil : une salle ouverte à
       la trente-quatrième minute doit afficher 1–0 tout de suite, sans avoir
       vu le but tomber. Ils sont donc portés à part, et semés à la création. */
    this.fil = [];
    this.rang = 0;                    // départage deux entrées de même minute
    this.scoreReel = [fixture.homeGoals ?? 0, fixture.awayGoals ?? 0];
    /* **Les buts que cette salle connaît déjà** : ceux qui étaient au tableau
       quand elle a ouvert, puis chacun de ceux qu'elle a annoncés. Le relevé
       en apporte de deux sortes, et ni l'une ni l'autre n'est une nouvelle.
       Un but d'avant l'ouverture livré en retard, parce que l'API a publié le
       score avant l'événement ou que le télétexte a rangé le score avant le
       tour du direct : il sonnait « GOAL ! » à la cinquantième pour un but de
       la neuvième. Et un but déjà annoncé qui revient sous une autre
       identité, quand l'API corrige le buteur : il sonnait une seconde fois,
       corde et minute double comprises. Voir `realGoal`, qui les tait et
       fait monter ce compte, et `matchStatus`, qui le fait redescendre quand
       la vidéo retire un but. */
    this.butsConnus = (Number(this.scoreReel[0]) || 0) + (Number(this.scoreReel[1]) || 0);
    /* **Et ce qui les date.** Le rang seul ne suffit pas : le relevé le
       compte dans *sa* liste d'événements, et une liste qui manque un but
       d'avant l'ouverture — jamais publié, ou publié après le suivant — fait
       descendre d'un cran le rang de tous les buts frais. Le premier prenait
       alors le rang du but manquant, et la salle le taisait : ni « GOAL ! »,
       ni corde, ni minute double, pour toute la tribune. La minute de jeu à
       l'ouverture date un but d'avant elle ; les buts annoncés ici, par club
       et par minute, reconnaissent celui qui revient. Lue dans la même ligne
       de base que le score : un but au tableau à l'ouverture a donc une
       minute qui ne la dépasse pas. */
    const ouverte = Number(fixture.elapsed);
    this.minuteOuverture = fixture.elapsed != null && Number.isFinite(ouverte) ? ouverte : null;
    this.butsAnnonces = [];           // {teamId, minute} de chaque but annoncé ici
    this.statut = fixture.status ?? null;
    this.minute = fixture.elapsed ?? null;
    /* Le temps additionnel, et l'instant où le serveur a vu tout ça.
       Sans `vuA`, la page fait courir son horloge à partir du moment où *elle*
       a reçu la donnée — et une donnée vieille d'un quart d'heure repart alors
       de zéro, ce qui est exactement ce qui laissait des matchs finis à
       « 90' EN DIRECT ». */
    this.minuteExtra = fixture.elapsedExtra ?? null;
    this.vuA = fixture.vuA ?? Date.now();

    /* **Le coup de sifflet, tel que la salle l'a vu.** `finA` est l'instant
       où elle a appris la fin du match — par le relevé (`matchStatus`), ou à
       sa création si la base la disait déjà finie. C'est lui que lit la
       fermeture de la tribune (`virage:ferme`, `ferveur/index.js`). Une salle
       ouverte après le coup de sifflet n'annonce pas `virage:fin` : son état
       porte déjà le statut (`CONTRATS.md`, § 15.3). */
    this.finA = FINS_DE_MATCH.has(this.statut) ? Date.now() : 0;
    this.finDiffusee = FINS_DE_MATCH.has(this.statut);

    /* **Le classement en direct, recalculé au plus une fois par seconde**,
       au tour d'horloge et seulement s'il a bougé : mille chants par seconde
       dans une tribune de mille ne paient pas mille tris. Voir `classer`. */
    this.classement = null;
    this.classementSale = true;
    this.classementA = 0;

    /* Ceux dont l'XP de ce match est réglée — versée, ou déjà versée par un
       autre chemin. Le grand livre fait foi ; ceci n'évite que de lui
       redemander ce qu'il a déjà répondu (`ferveur/index.js`, le filet). */
    this.xpReglee = new Set();
  }

  /* ---------------------------------------------------------------- le fil */

  /** De quel côté est cette équipe. `null` quand l'événement n'a pas d'équipe. */
  coteDe(teamId) {
    if (teamId == null) return null;
    if (teamId === this.fixture.homeId) return 0;
    if (teamId === this.fixture.awayId) return 1;
    return null;
  }

  /**
   * Ajoute au fil ce qui n'y est pas déjà, et diffuse le neuf.
   *
   * La clé porte l'identité de l'événement, pas sa place : l'API insère
   * parfois un carton après coup et décale tout ce qui suit. Une entrée
   * identifiée par son rang serait alors annoncée deux fois.
   */
  ajouterAuFil(entrees) {
    const connues = new Set(this.fil.map((e) => e.cle));
    const neuves = [];
    for (const e of entrees) {
      if (!e || connues.has(e.cle)) continue;
      connues.add(e.cle);
      neuves.push({ ...e, rang: ++this.rang });
    }
    if (!neuves.length) return [];

    this.fil.push(...neuves);
    // Par minute, puis par ordre d'arrivée. Sans le rang, deux cartons de la
    // même minute changeaient de place d'un relevé à l'autre et le fil
    // paraissait se réécrire tout seul.
    this.fil.sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0)
      || (a.extra ?? 0) - (b.extra ?? 0) || a.rang - b.rang);
    if (this.fil.length > FIL_MAX) this.fil = this.fil.slice(-FIL_MAX);

    this.push('virage:fil', { entrees: neuves, scoreReel: this.scoreReel, minute: this.minute });
    return neuves;
  }

  /** Une entrée de terrain, telle qu'elle arrive du relevé de l'API. */
  entreeTerrain(e) {
    const teamId = e.teamId ?? e.team_id ?? null;
    return {
      cle: `t|${e.type}|${teamId}|${e.minute ?? '?'}|${e.extra ?? 0}|${e.player ?? ''}|${e.detail ?? ''}`,
      genre: e.type === 'Goal' ? 'but' : 'terrain',
      type: e.type,
      detail: e.detail ?? null,
      side: this.coteDe(teamId),
      minute: e.minute ?? null,
      extra: e.extra ?? null,
      joueur: e.player ?? null,
      passeur: e.assist ?? null,
    };
  }

  /**
   * Le changement de période.
   *
   * Il ne coûte pas un appel : le relevé du direct lit déjà le statut. C'est
   * ce qui fait qu'un fil sans quota reste utile — on sait au moins qu'on est
   * à la mi-temps, ce qui explique pourquoi plus personne ne pousse.
   */
  entreePeriode(statut) {
    if (!statut || !(statut in MINUTE_DE_PERIODE)) return null;
    return {
      cle: `p|${statut}`,
      genre: 'periode',
      type: statut,
      detail: null,
      /* La minute est celle de la **frontière de période**, jamais l'horloge
         du moment. Une salle ouverte à la trente-quatrième minute apprend
         qu'on est en première période : datée à 34, l'entrée « coup d'envoi »
         se rangeait entre le carton de la douzième et celui de la
         soixante-sixième, au milieu du match qu'elle est censée ouvrir. */
      minute: MINUTE_DE_PERIODE[statut],
      side: null,
      extra: null,
      joueur: null,
      passeur: null,
    };
  }

  /* ------------------------------------------------------------ membres */

  /**
   * `perso` : le Fanzzy que le joueur emmène — identifiant, nom, âge atteint,
   * cri. Il n'entre dans aucun calcul, il s'affiche : c'est le personnage qui
   * pousse à l'écran et qui exulte au but réel. Il est séparé de `mods` parce
   * que `mods` est un barème et que celui-ci est un dessin — les mêler ferait
   * prendre un nom de personnage pour un multiplicateur au premier oubli.
   */
  /**
   * @param actions  les cartes d'action du deck de ce joueur, déjà filtrées
   *   par le module qui appelle. Un joueur sans deck entre sans main : le
   *   Virage se joue très bien au chant seul, et c'est d'ailleurs comme ça
   *   qu'il s'est joué jusqu'ici.
   */
  /**
   * @param {object} opt
   * @param {boolean} [opt.classe] ce Virage compte-t-il au classement pour lui ?
   *   Décidé par `ferveur/index.js` à l'entrée, et **posé jusqu'à la première
   *   poussée** : c'est elle qui écrit la ligne de présence, et la ligne ne
   *   change plus de `classe` ensuite. Rejoindre à nouveau — un réseau qui
   *   saute, un onglet rouvert — ne rouvre donc pas la question une fois la
   *   ligne écrite, sinon un match commencé compté cesserait de l'être au
   *   milieu. Avant, la décision n'est qu'une réservation : la garder au parti
   *   laisserait regarder trois tribunes au coup d'envoi, ressortir, et revenir
   *   chanter dans les trois au rang « classé » d'un plafond à une.
   */
  join(userId, { side, name, mods = {}, neutre = false, perso = null, actions = [],
                 classe = true, apports = [] }) {
    /* Présent dans un autre onglet, parti et revenu, ou tout neuf — dans cet
       ordre. Celui qui revient reprend **son** état : souffle, main, pioche,
       recharges, fatigue, effets, ferveur.

       Le camp, lui, est celui que l'entrée décide, et la salle le pose tel
       quel : c'est `ferveur/index.js` qui sait si le joueur l'a choisi, s'il
       revient sans rien demander — la page qui se reconnecte renvoie
       `virage:join` sans camp, et on lui rend alors le sien — ou s'il suit un
       des deux clubs, auquel cas le camp ne se choisit pas.

       Les recharges, la fatigue et la carte suivante sont des instants : elles
       ont couru pendant l'absence, comme elles courent pour qui reste assis.
       Le souffle, lui, ne remonte pas pendant qu'on n'est pas là — `regen`
       lit son multiplicateur au moment où il calcule, et une absence comptée
       au retour effacerait la fatigue ou le revers d'une carte qu'on aurait
       fuis en sortant. */
    const revenu = this.partis.get(userId);
    if (revenu) {
      this.partis.delete(userId);
      revenu.regenAt = Date.now();
    }
    const present = this.members.get(userId);
    const m = present ?? revenu ?? {
      side: side ? 1 : 0, name, mods, neutre, perso,
      classe,
      userId,
      breath: 40, ferveur: 0, lastPush: 0, fatigueUntil: 0, joined: Date.now(),
      /* La main. Mêmes règles qu'au duel : cinq visibles, la suivante n'arrive
         pas tout de suite. Ce qui n'est pas dans la main est dans la pioche. */
      pioche: [], main: [], defausse: [], cooldowns: {}, effets: [], remplirA: 0,
      dernierChant: 0,
      /* Ce que le geste a donné dans cette salle : les chants acceptés, les
         PARFAITS, la série en cours et la meilleure. Ils départagent le rang
         en direct (`comparerTribune`) ; la base garde les siens, tous
         passages compris, pour le bilan. */
      chants: 0, parfaits: 0, serie: 0, serieMax: 0,
      /* Ceux à qui sa présence a été annoncée (`virage:ami`, `virage:amis`) :
         ce sont eux, et eux seuls, qui apprennent son départ. */
      annonceA: new Set(),
    };
    /* L'instant de son arrivée dans la tribune — pas celui d'un second
       onglet. La fermeture d'après le coup de sifflet laisse à qui arrive
       tard le même délai qu'aux autres. */
    if (!present) m.entreA = Date.now();
    m.annonceA ??= new Set();
    this.classementSale = true;
    m.side = side ? 1 : 0;
    /* La réservation se refait tant qu'aucune présence n'est écrite : voir
       `classe`, plus haut, et `crediter`. */
    if (!m.presenceEcrite) m.classe = classe;
    m.name = name;
    m.mods = mods;
    /* **Le lieu, composé une fois pour toutes.**

       Il ne change pas d'un bout à l'autre d'un match — voir `stade()` — et il
       est lu à chaque tour d'horloge, pour chaque supporter de la salle. Le
       recomposer dix fois par seconde et par tête dans une tribune de mille
       serait payer très cher une valeur constante. */
    m.modsLieu = avecLieu(mods, this.stade());
    /* D'où viennent ses modificateurs, source par source. Construit à l'entrée
       — voir `shared/apports.js` — parce que `mods` est un total, et qu'un
       total ne se décompose pas. Le lieu s'y ajoute au moment de l'envoi : il
       appartient à la salle, pas au supporter. */
    m.apports = apports;
    m.perso = perso;
    // `neutre` : il soutient un club qu'il ne suit pas. Sa ferveur vaut moitié.
    m.neutre = neutre;

    /* Le deck n'est monté qu'à la première entrée. Rejoindre à nouveau — un
       réseau qui saute, un onglet rouvert — ne doit pas redistribuer la main :
       ce serait un moyen gratuit de se débarrasser d'un temps de recharge.

       **Ce commentaire disait vrai pour un second onglet, et faux pour tout
       le reste** : un départ supprimait le membre, et le retour arrivait ici
       avec une main vide. Il ne tient que parce que `leave` garde le parti et
       que le haut de `join` le lui rend. */
    if (!m.main.length && !m.pioche.length && !m.defausse.length && actions.length) {
      const ids = actions.map((a) => (typeof a === 'string' ? a : a?.id));
      const jouables = ids.filter((id) => dansLeVirage(ACTION_BY_ID.get(id)));
      m.pioche = melanger(jouables);
      m.main = m.pioche.splice(0, RULES.mainVisible);
      /* **Combien sont restées au duel.**

         Le tri se faisait en silence, et c'est ce silence qui a été signalé
         sous la forme « une carte et quatre cases vides ». Le joueur voyait
         le résultat du tri sans jamais voir le tri, et il en concluait que
         ses cartes ne se rechargeaient pas.

         Le **nombre** part avec l'état, et pas une phrase toute faite : la
         page sait mieux que la salle où et quand le dire, et un serveur qui
         rédige finit par rédiger dans la mauvaise langue. */
      m.ecartees = ids.length - jouables.length;
    }

    this.members.set(userId, m);
    this.occupeeA = Date.now();
    this.dirty = true;
    return this.snapshotFor(userId);
  }

  /**
   * Le supporter quitte la tribune : il passe parmi les partis.
   *
   * Hors de `members`, il sort de tout ce qui se compte en direct — la foule,
   * le rang, le battement, la Collecte d'un coéquipier. Son souffle est arrêté
   * à l'instant du départ ; le reste attend son retour. Les partis vivent
   * autant que la salle — tant que le match peut se jouer, puis une minute
   * après le coup de sifflet — et la libération les emporte avec elle.
   */
  leave(userId, now = Date.now()) {
    const m = this.members.get(userId);
    if (!m) return;
    this.regen(m, now);
    this.members.delete(userId);
    this.partis.set(userId, m);
    this.occupeeA = now;
    this.dirty = true;
    this.classementSale = true;
  }

  /** Les actifs : ceux qui ont poussé récemment. Une app ouverte ne compte pas. */
  /**
   * Le stade où se joue la rencontre.
   *
   * **Il appartient au match, pas à un joueur** — c'est la règle écrite dans
   * `stades.js`, et c'est elle qui empêche un stade de devenir un avantage
   * qu'on achète. Il découle donc de l'identifiant du match : tout le monde
   * dans la salle voit le même, et le même à chaque fois qu'on y revient.
   *
   * L'intersection des possessions n'a pas de sens dans une salle ouverte à
   * tous — on passe donc un tableau vide, ce qui ouvre les quinze. Le jour où
   * le stade viendra du vrai lieu du match, c'est cette ligne-là qui changera,
   * et elle seule.
   *
   * **Les quinze, moins ceux qu'aucune saison n'a ouverts.** Un stade est du
   * contenu qu'une saison livre, au même titre qu'une série : le tirer avant
   * son ouverture, c'est livrer la saison en avance à qui passe par le Virage.
   * Ce filtre-là est la seule chose que `publie` change ici — un stade fermé
   * ne se tire plus, et rien de ce qui a déjà été joué ne bouge.
   *
   * Mémorisé : il ne change pas d'un bout à l'autre d'un match, et il est lu à
   * chaque chant autant qu'à chaque diffusion. Ce qui veut dire qu'une saison
   * lancée en plein match n'en change pas le lieu — c'est voulu : le stade est
   * annoncé aux joueurs dès la première diffusion.
   */
  stade() {
    this._stade ??= stadeDeLaRencontre([], this.fixture.id, ouverts('stade'));
    return this._stade;
  }

  /**
   * **Les modificateurs en vigueur pour ce supporter, à cet instant.**
   *
   * Le Fanzzy, son sac, son KOP, le lieu, et ce que les cartes ont posé. C'est
   * l'équivalent exact de `modsDe` dans le moteur de duel, et il n'existait
   * pas ici : chaque site d'appel composait ce dont il se souvenait.
   *
   * ## Ce que cette absence coûtait
   *
   * `chant` composait tout, et c'est le seul qui le faisait. Partout ailleurs
   * on lisait `m.mods` — le total **d'avant le lieu et d'avant les effets** :
   *
   *   — **le souffle**. `regen` ignorait donc à la fois le stade et les cartes.
   *     Le Nid d'Aigle, dont `breathBonus: 0.8` est l'unique effet, ne changeait
   *     rien au Virage ; et le revers du Craquage — « ton souffle revient deux
   *     fois moins vite pendant 6 s » — ne s'appliquait pas non plus. Une carte
   *     dont le revers ne coûte rien est la carte que tout le monde joue, ce qui
   *     est précisément ce que l'en-tête de `actions.js` interdit ;
   *   — **la poussée d'une carte**, qui sautait le `pushMult` du lieu quand le
   *     chant, lui, le prenait ;
   *   — **ce qu'on envoie à la page** : la fenêtre de tempo dessinée n'était pas
   *     celle contre laquelle le serveur notait. C'est mot pour mot la faute que
   *     `gestures.js` raconte pour les Jumelles, et qu'il dit avoir réglée.
   *
   * `modsLieu` est mémorisé à l'entrée ; seuls les effets, qui changent, se
   * composent à la volée — et seulement quand il y en a.
   */
  modsDe(m, now = Date.now()) {
    const base = m.modsLieu ?? m.mods ?? {};
    return m.effets?.length ? modsAvecEffets(base, m.effets, now) : base;
  }

  crowd() {
    const now = Date.now();
    const n = [0, 0];
    for (const m of this.members.values()) {
      if (now - m.lastPush < RULES.idleMs) n[m.side]++;
    }
    return n;
  }

  /* -------------------------------------------------------------- chant */

  /**
   * Un supporter chante. Le serveur note son geste, débite son souffle,
   * applique la poussée et enregistre sa présence.
   */
  chant(userId, { cardId, taps }) {
    const m = this.members.get(userId);
    if (!m) throw new Cheat('not_in_virage');

    const card = CARDS[cardId];
    if (!card) throw new Cheat('unknown_card');

    const now = Date.now();
    /* Le répertoire est une règle, pas une suggestion de la page. On accepte
       aussi celui d'avant pendant un court moment, pour la même raison que les
       motifs : un chant commencé juste avant que l'horloge tourne. */
    if (!this.motifsAdmis(now).some((r) => this.repertoire(r).includes(cardId))) {
      throw new Cheat('chant_hors_repertoire');
    }
    this.regen(m, now);
    nettoyerEffets(m, now);
    if (m.breath < card.cost) throw new Cheat('not_enough_breath');

    /* Les modificateurs du moment : ceux du Fanzzy et du KOP, plus ceux que
       les cartes ont posés. Sans cette ligne, le Métronome et le Second
       souffle coûtaient du souffle et ne changeaient rien au geste — une
       carte qu'on joue et qui ne fait rien est pire qu'une carte absente. */
    /* Le lieu en fait partie, et il n'en faisait pas partie. La salle envoyait
       son stade au client pour qu'il le dessine, et les `mods` de ce stade —
       « le souffle revient bien plus lentement », « un geste parfait paie
       double » — n'étaient appliqués nulle part. Dix lieux décrits, zéro lieu
       qui change quoi que ce soit. La composition est celle du duel, importée
       et non recopiée — et elle vit maintenant dans `modsDe`, pour que les cinq
       autres endroits qui en ont besoin ne la réinventent pas chacun à moitié. */
    const mods = this.modsDe(m, now);

    /* La note est calculée ici, à partir des instants de frappe.

       Pour l'écho, le motif compte : on retient le meilleur des motifs encore
       admis. Hors de la fenêtre de bascule il n'y en a qu'un, donc ce `max` ne
       rend le geste plus facile à aucun moment — il rattrape seulement les
       quatre secondes où deux motifs coexistent légitimement. */
    const brut = Math.max(...this.motifsAdmis(now)
      .map((motif) => grade(card.gest, taps, mods, { motif })));
    let { quality, backfire } = applyHeroMods(brut, mods);

    /* Second souffle : un geste raté compte comme moyen, une fois. La charge
       se consomme sur le raté, pas sur le prochain geste quel qu'il soit —
       sinon la carte se dépenserait sur un chant déjà réussi. */
    const plancher = (m.effets ?? []).find((e) => e.type === 'floor_quality' && e.charges > 0);
    let plancherMordu = null;
    if (plancher && quality < plancher.valeur) {
      quality = plancher.valeur;
      backfire = false;
      plancher.charges--;
      plancherMordu = plancher.valeur;
    }

    /* **Le verdict, et ce qu'il compte.** Il se mesure sur la note brute du
       geste, relevée par le plancher s'il vient de mordre, **avant** les
       modificateurs du Fanzzy (`CONTRATS.md`, § 16.1 ; défaut D7) : un
       Fanzzy qui paie mal le parfait ne change pas un PARFAIT en BON. La
       note finale, `quality`, pousse la corde ; elle ne nomme plus rien.

       Le mot, le Cri, la série et le meilleur geste lisent tous **la même
       note** : un PARFAIT qui ne compterait pas dans la série serait un mot
       qui ment. La série ne vit qu'ici, sur le chant : une carte ne la coupe
       pas (voir `crediter`), un chant d'un autre verdict la remet à zéro. */
    const mesuree = noteDuVerdict(brut, plancherMordu);
    const verdict = verdictDe(mesuree);
    const parfait = estParfait(mesuree);
    m.chants = (m.chants ?? 0) + 1;
    if (parfait) {
      m.parfaits = (m.parfaits ?? 0) + 1;
      m.serie = (m.serie ?? 0) + 1;
      m.serieMax = Math.max(m.serieMax ?? 0, m.serie);
    } else {
      m.serie = 0;
    }

    /* **La Mise** se résout ici, au chant qui suit la carte, et nulle part
       ailleurs : c’est le seul endroit où l’on sait si le pari est gagné.
       Un geste au-dessus de la moitié double la poussée ; en dessous, la
       mise est perdue et coûte le souffle promis.

       Elle se consomme **dans les deux cas** — sinon on la garderait
       indéfiniment en attendant un bon geste, et ce ne serait plus un pari. */
    const mise = (m.effets ?? []).find((e) => e.type === 'double_next' && e.fin > now);
    let facteurMise = 1;
    if (mise) {
      const gagne = !backfire && quality >= 0.5;
      facteurMise = gagne ? 2 : 1;
      if (!gagne) m.breath = Math.max(0, m.breath - (mise.valeur ?? 20));
      mise.fin = 0;                     // consommée, gagnée ou perdue
    }

    m.breath -= card.cost;
    m.lastPush = now;
    m.dernierChant = now;
    if (card.effect === 'fatigue') m.fatigueUntil = now + 4000;

    const surge = now < this.surgeUntil ? RULES.surgeFactor : 1;
    const n = this.crowd();
    /* `pushMult` : la corde. Un bonus de KOP passe par cette clé, comme la
       carte « Prolongations » du duel — même vocabulaire, même endroit. Le
       moteur ne sait pas d’où vient le modificateur, et c’est ce qui permet
       à un KOP de peser sur une mécanique sans la connaître. */
    /* La fenêtre collective ouverte par un Appel du capo ou un Chœur. C'est
       tout l'intérêt de ces cartes-là : leur effet n'existe que dans le geste
       des autres, et il faut donc le lire ici, au chant, et pas au moment où
       la carte est jouée. */
    const fenetre = this.rallies.find((r) => r.side === m.side && r.fin > now);
    const rally = fenetre ? (fenetre.sync ? RULES.collectifMax : fenetre.bonus) : 1;

    const amount = card.power * quality * surge * crowdFactor(Math.max(1, n[m.side]))
      * (mods.pushMult ?? 1) * rally * facteurMise;

    // Divisée par l'effectif : le nombre aide, il ne décide pas.
    const perCapita = amount / Math.max(1, n[m.side]);
    const signed = (backfire ? -1 : 1) * (m.side === 0 ? -perCapita : perCapita);
    this.rope = clamp(this.rope + signed, -RULES.goalAt, RULES.goalAt);
    // `ferveurBonus` : ce qui compte au classement. Séparé de la corde
    // exprès — un KOP peut vouloir peser sur le match sans peser sur le
    // classement, et l’inverse.
    /* Et le partage n'est pas le même des deux côtés : la corde se pousse à
       l'effectif réel, la ferveur se partage au plancher. Voir `partFerveur`. */
    /* **C'est un chant**, et c'est ici seulement qu'on le sait : `crediter`
       sert aussi aux cartes d'action, qui ne chantent pas. Les missions du
       Virage comptent des chants, pas des poussées — une carte jouée ne doit
       donc pas en remplir une. Un chant raté compte quand même : le serveur
       l'a accepté, il a coûté son souffle, et la cadence le plafonne. */
    /* `plancher` : le plancher de ferveur (Q4, `CONTRATS.md`, § 16.2). Un
       chant noté au moins MOYEN rapporte au moins 1, quelle que soit la
       taille de la tribune — voir `crediter`. `q` et `chantId` : le meilleur
       geste du match, que la base garde par `GREATEST`. */
    this.crediter(m, amount / this.partFerveur(m), mods, {
      chant: true, plancher: auMoins(verdict, 'moyen'),
      parfait, q: enMilliemes(mesuree), chantId: cardId,
    });

    if (Math.abs(this.rope) >= RULES.goalAt) this.scoreGoal(this.rope > 0 ? 1 : 0);

    /* Le rang en direct, sur le classement d'il y a au plus une seconde
       (`CONTRATS.md`, § 16.2 : « une seconde de retard est normale »). */
    const { rang, sur, prochain } = this.placeDe(m, now);
    return { quality: Number(quality.toFixed(3)), backfire, breath: Math.round(m.breath),
             ferveur: m.ferveur, push: Math.round(perCapita),
             verdict, ...(criDe(mesuree) ? { cri: true } : {}),
             serie: m.serie, rang, sur, ...(prochain ? { prochain } : {}) };
  }

  /* --------------------------------------------------------- les cartes

     Le Virage joue les cartes qui agissent sur soi ou sur les siens. Ce qui
     traverse vers l'adversaire reste au duel — voir `dansLeVirage`, où la
     règle est écrite une fois, sur la portée de l'effet.

     La résolution n'est pas celle du duel, et ce n'est pas une négligence :
     ici toute poussée est **divisée par l'effectif de la tribune**, comme un
     chant. C'est ce qui fait qu'un Fumigène vaut la même chose dans une salle
     de dix et dans une salle de mille — et que Mosaïque mesure la *proportion*
     de tribune active plutôt qu'un nombre de têtes. Fondre les deux
     résolutions demanderait une exception à presque chaque ligne. */

  /* ------------------------------------------------------ le répertoire */

  /**
   * Le rang du répertoire courant, d'après la minute du vrai match.
   *
   * Avant le coup d'envoi la minute est nulle : on répond zéro, et la tribune
   * s'échauffe sur les cinq premiers chants. La règle est écrite ici et nulle
   * part ailleurs — la vue, le contrôle du chant et le motif de l'écho
   * l'appellent tous les trois.
   */
  rangRepertoire(minute = this.minute) {
    const m = Math.max(0, Math.floor(Number(minute) || 0));
    return Math.floor(m / RULES.repertoireMin) % ORDRE.length;
  }

  /** Les cinq chants offerts à ce rang : une fenêtre glissante sur `ORDRE`. */
  repertoire(rang = this.rangRepertoire()) {
    const r = ((rang % ORDRE.length) + ORDRE.length) % ORDRE.length;
    return Array.from({ length: RULES.repertoire },
      (_, i) => ORDRE[(r + i) % ORDRE.length]);
  }

  /** Les mêmes, tels que la page les attend : décrits, pas seulement nommés. */
  chantsOfferts(rang = this.rangRepertoire()) {
    return this.repertoire(rang).map((id) => ({ id, ...CARDS[id] }));
  }

  /**
   * Le motif d'écho que la tribune chante en ce moment, et celui d'avant.
   *
   * Les deux, parce qu'un chant dure quatre secondes : celui qui commençait
   * quand le répertoire a tourné a appris l'ancien motif et le tape jusqu'au
   * bout. Le lui compter faux serait le punir d'une horloge qui n'est pas la
   * sienne. Passé le quart de minute, il n'y a plus qu'un motif valable.
   */
  motifsAdmis(now = Date.now()) {
    const r = this.rangRepertoire();
    if (now - this.rangChangeA > 15_000) return [r];
    return [r, r - 1];
  }

  /** Les coéquipiers actifs de ce camp, hors lui-même. */
  actifsDuCamp(m, depuis, now) {
    let n = 0;
    for (const [, x] of this.members) {
      if (x !== m && x.side === m.side && now - x.lastPush < depuis) n++;
    }
    return n;
  }

  /** L'effectif de sa tribune, jamais zéro : on divise par ce nombre. */
  effectif(m) {
    return Math.max(1, this.crowd()[m.side]);
  }

  /**
   * Par combien la ferveur se partage — et ce n'est pas l'effectif réel.
   *
   * **Être seul était l'état le plus rentable du jeu.** `crowdFactor` vaut 1
   * en dessous de cent personnes, donc ce qu'un supporter touche est sa
   * poussée divisée par l'effectif : tout entier à un, un cinquantième à
   * cinquante. Arriver le premier sur un match obscur, pousser une heure sans
   * personne en face — la corde ne retombant que de 1,4 par seconde, les buts
   * s'enchaînent — rapportait cinquante fois ce que rapporte la même heure
   * dans une vraie tribune. Ce n'est pas un détail d'équilibrage : c'est le
   * classement de ferveur qui récompense le contraire de ce que le jeu
   * raconte.
   *
   * **Le plancher ne touche que la récolte, jamais la corde.** Le diviser
   * aussi côté corde rendrait un match désert impraticable, et arriver tôt
   * sur un match est exactement ce qu'on veut encourager. Seul, on joue donc
   * comme avant ; on ne récolte plus comme si l'on portait une tribune.
   */
  partFerveur(m) {
    return Math.max(RULES.tribuneMin, this.effectif(m));
  }

  /**
   * Ce qu'une poussée rapporte à celui qui l'a donnée.
   *
   * **Le même nombre part des deux côtés**, et c'est tout l'objet de cette
   * méthode. La salle ajoutait à `m.ferveur` un montant corrigé — le bonus du
   * Fanzzy, la moitié du neutre — et envoyait à la base le montant brut. Le
   * supporter lisait donc un chiffre à l'écran pendant que le classement en
   * comptait un autre : pour un neutre, exactement le double de ce qui lui
   * était annoncé. La règle « la ferveur d'un neutre vaut moitié » était écrite
   * dans le commentaire de `RULES.ferveurNeutre` et vraie nulle part.
   *
   * **La poussée d'une carte d'action compte enfin.** Elle n'était envoyée à la
   * base par aucun chemin : on pouvait passer un match à jouer des cartes et
   * n'apparaître dans aucun classement.
   *
   * Le club part avec, et c'est **celui qu'on a poussé** — pas ceux qu'on suit.
   * Nul pour un neutre : il chante pour une tribune dont il n'est pas, et sa
   * ferveur ne doit rien rapporter ni à ce club ni à un KOP.
   *
   * **`perCapita` n'est pas celui de la corde.** Les deux appelants passent
   * ici la poussée divisée par `partFerveur`, et la corde garde l'effectif
   * réel : c'est volontaire, et c'est tout le correctif du Virage solitaire.
   */
  /* `mods` par défaut : ceux du moment, lieu et effets compris. Le repli était
     `m.mods` — le total d'avant le lieu — et le `ferveurBonus` d'un stade ne
     comptait donc que sur le chemin du chant. */
  /* `chant` : vrai pour le seul appel de `chant()`. Une carte, un tifo qui se
     déplie, une poussée étalée passent par ici sans lui, et ne comptent donc
     pas comme des chants. */
  /* `plancher` : vrai pour un chant noté au moins MOYEN. **Le plancher de
     ferveur** (Q4, décision du 3 octobre 2026 ; `CONTRATS.md`, § 16.2) : dans
     une tribune de plus de trente-quatre personnes — soixante-sept pour un
     supporter du club —, la part d'un chant s'arrondissait à zéro, et tout le
     monde y finissait le match à zéro de ferveur, « 1ᵉʳ » de sa tribune. Un
     bon chant rapporte donc au moins 1, **tous les facteurs appliqués**
     (Fanzzy, lieu, moitié du neutre) : c'est le résultat qu'on relève, pas
     une étape. Les cartes n'y entrent pas : elles ne passent pas par ici avec
     `plancher`. Une petite tribune ne change pas : sa part dépasse déjà 1.

     `parfait`, `q` (millièmes de la note du verdict) et `chantId` partent à la
     base dans l'écriture de présence qui existe : les PARFAITS, la meilleure
     série et le meilleur geste du match y sont comptés sans une instruction
     de plus (P8). Une carte les laisse à zéro — elle ne coupe pas la série,
     elle n'a pas de note. */
  crediter(m, perCapita, mods = this.modsDe(m),
           { chant = false, plancher = false, parfait = false, q = 0, chantId = null } = {}) {
    const bonus = mods.ferveurBonus ?? 1;
    let gagne = Math.round(Math.max(0, perCapita) * bonus
      * (m.neutre ? RULES.ferveurNeutre : 1));
    /* Un bonus de ferveur nul veut dire « ne compte pas au classement » (un
       KOP peut peser sur la corde sans peser sur le classement) : le plancher
       ne le contredit pas. */
    if (chant && plancher && bonus > 0 && gagne < 1) gagne = 1;
    m.ferveur += gagne;
    this.dirty = true;
    this.classementSale = true;

    /* Présence : c'est ce que consulteront les cartes-souvenirs au prochain
       but, et les classements bien après le match.

       La première écrit la ligne, et `classe` avec elle, pour de bon : la
       décision prise à l'entrée cesse d'être une réservation. Voir `join`. */
    m.presenceEcrite = true;
    this.onPush?.({
      userId: m.userId, fixtureId: this.fixture.id, side: m.side,
      teamId: m.neutre ? null : (m.side ? this.fixture.awayId : this.fixture.homeId),
      fanzzyId: m.mods.id ?? null, amount: gagne,
      /* Compte-t-il au classement ? La salle ne décide pas — elle transporte.
         `!== false` et non un booléen nu : une salle ouverte à la main, ou
         une épreuve qui monte un membre sans le dire, compte comme avant. */
      classe: m.classe !== false,
      /* Les chants, comptés dans la même écriture que la présence : c'est ce
         que lisent les missions du Virage (« chante 10 fois », « dans chaque
         mi-temps »). Un entier et non un booléen, parce qu'il s'additionne
         tel quel dans la colonne. */
      chant: chant ? 1 : 0,
      mt: miTemps(this.statut),
      /* Le bilan de tribune (`CONTRATS.md`, § 15) : un PARFAIT (0 ou 1), la
         meilleure série de la salle (la base garde la plus grande), la note
         du verdict en millièmes et le chant qui l'a donnée. */
      parfait: chant && parfait ? 1 : 0,
      serie: m.serieMax ?? 0,
      q: chant ? q : 0,
      chantId: chant ? chantId : null,
    })?.catch?.(() => {});
    return gagne;
  }

  /**
   * Pousse la corde de la part d'un membre, aux règles du Virage.
   *
   * Le même chemin que le chant : multiplicateur de but réel, taille de foule,
   * bonus de KOP, puis division par l'effectif. Une carte n'échappe à aucune
   * de ces règles — sinon elle deviendrait le seul moyen de pousser, et le
   * Virage cesserait d'être un endroit où l'on chante.
   */
  pousserDepuisCarte(m, valeur, now, evenements) {
    const surge = now < this.surgeUntil ? RULES.surgeFactor : 1;
    const n = this.effectif(m);
    /* Le lieu compte ici comme au chant. Il n'y comptait pas : un Fumigène
       joué au Toit de Tôle poussait comme ailleurs pendant qu'un chant, lui,
       y gagnait 14 %. « Une carte n'échappe à aucune règle » — celle-ci en
       est une. */
    const mods = this.modsDe(m, now);
    const amount = valeur * surge * crowdFactor(n) * (mods.pushMult ?? 1);
    const perCapita = amount / n;
    const signed = m.side === 0 ? -perCapita : perCapita;
    this.rope = clamp(this.rope + signed, -RULES.goalAt, RULES.goalAt);
    /* Le même plancher qu'au chant : une carte n'échappe à aucune règle,
       c'est ce que dit le paragraphe ci-dessus, et celle-ci en est une. */
    this.crediter(m, amount / this.partFerveur(m), mods);
    evenements.push({ t: 'push', side: m.side, valeur: Math.round(perCapita) });
    if (Math.abs(this.rope) >= RULES.goalAt) this.scoreGoal(this.rope > 0 ? 1 : 0);
    return perCapita;
  }

  /**
   * Un supporter joue une carte d'action.
   *
   * Renvoie la liste des événements à diffuser. Les refus lèvent un `Cheat`
   * dont le code nomme sa cause : la page doit pouvoir dire « cette carte se
   * recharge encore » et non « impossible ».
   */
  jouer(userId, cardId) {
    const m = this.members.get(userId);
    if (!m) throw new Cheat('not_in_virage');

    const now = Date.now();
    this.regen(m, now);
    nettoyerEffets(m, now);

    if (!m.main.includes(cardId)) throw new Cheat('card_not_in_hand');

    const carte = ACTION_BY_ID.get(cardId);
    if (!carte) throw new Cheat('unknown_card');
    /* Le filet, pas la règle. La main est déjà construite à partir de cartes
       jouables ; ce contrôle attrape le client modifié, et le jour où une
       carte change de portée sans que les mains ouvertes soient refaites. */
    if (!dansLeVirage(carte)) throw new Cheat('card_not_in_virage');

    /* **On refuse avant de débiter, jamais après.**
     *
     * `appliquer` finit par un `default` qui lève `unknown_effect`, et ce
     * `throw` tombait **après** que le souffle ait été prélevé, la carte
     * retirée de la main, la recharge armée et la défausse remplie. Cinq des
     * vingt-huit cartes du Virage étaient dans ce cas — les quatre de
     * septembre et le Coup d’envoi : le joueur payait, perdait sa carte, et
     * recevait une erreur.
     *
     * C’est ce qui produisait les deux défauts signalés : « cette carte
     * n’est plus dans ta main » au second essai, et « les cartes ne se
     * rechargent pas » — la main ouverte du client ne voyait jamais le
     * remplacement, puisque les événements ne partaient pas.
     *
     * La leçon est plus générale que ces cinq cartes : **une fonction qui
     * mute avant de valider ne peut pas échouer proprement.** Le contrôle
     * remonte donc ici, avec les autres refus, avant la première écriture. */
    if (!EFFETS_CONNUS.has(carte.effet?.type)) throw new Cheat('unknown_effect');

    if ((m.cooldowns[cardId] ?? 0) > now) throw new Cheat('card_on_cooldown');

    const c = carte.condition ?? {};
    /* « Mené d'au moins un but » se lit sur le **vrai match**, pas sur la
       corde. La Remontada raconte une équipe qui court après le score : la
       jouer parce que la corde penche n'aurait aucun sens dans une salle où
       la corde bouge dix fois par seconde.

       **Sur `scoreReel`, et non sur `realGoals`.** Ce second compteur ne
       compte que les buts vus tomber depuis l'ouverture de la salle : une
       tribune ouverte à la soixantième minute d'un 0–2 y lisait 0–0 et
       refusait la Remontada à ceux qui la jouaient à bon droit. `scoreReel`
       est semé depuis la base et recalé à chaque tour du relevé. */
    if (c.mene) {
      const mien = this.scoreReel[m.side] ?? 0;
      const autre = this.scoreReel[m.side ^ 1] ?? 0;
      if (mien + c.mene > autre) throw new Cheat('condition_not_met');
    }
    if (c.minuteReelle && (this.minute ?? 0) < c.minuteReelle) {
      throw new Cheat('condition_not_met');
    }
    /* La Relève demande un âge suivant à atteindre. Le Virage ne met qu'un
       personnage en tribune : on refuse plutôt que de laisser la carte brûler
       du souffle pour rien. */
    if (c.evolution && !(m.perso?.ages ?? [])[m.perso?.stade ?? 1]) {
      throw new Cheat('evolution_locked');
    }
    /* **La Tournée** paie à la place du joueur, et elle est lue **avant** le
       contrôle de souffle : c’est tout son intérêt, elle permet de jouer une
       carte qu’on n’aurait pas les moyens de jouer. Lue après, elle n’aurait
       fait qu’économiser du souffle déjà possédé — ce que `refill` fait
       déjà. Même écriture qu’au duel, et pour la même raison. */
    const tournee = (m.effets ?? []).find((e) => e.type === 'cost_free'
      && e.fin > now && (e.valeur ?? 0) > 0);
    const prix = tournee ? 0 : carte.cost;
    if (m.breath < prix) throw new Cheat('not_enough_breath');

    m.breath -= prix;
    /* Décomptée ici, une fois la carte réellement jouée : un refus plus haut
       ne doit pas consommer une gratuité que le joueur n’a pas utilisée. */
    if (tournee) tournee.valeur--;
    m.cooldowns[cardId] = now + carte.cd * 1000 * RULES.cardCooldownMult;
    /* Un exemplaire, pas tous : voir le même correctif dans `nvn/engine.js`.
       Deux Fumigènes en main, un joué, et l'autre disparaissait du Virage. */
    m.main.splice(m.main.indexOf(cardId), 1);
    m.defausse.push(cardId);
    m.remplirA = now + RULES.refillMs;
    m.lastPush = now;          // jouer, c'est être présent dans la foule

    const evenements = [{ t: 'action', userId, side: m.side, cardId, famille: carte.fam }];
    this.appliquer(m, carte, now, evenements);
    if (carte.revers) this.appliquerEffet(m, carte.revers, now, evenements);
    this.dirty = true;
    return evenements;
  }

  /** Résolution d'une carte, aux règles de la foule. */
  appliquer(m, carte, now, evenements) {
    const e = carte.effet ?? {};
    const userId = m.userId ?? null;
    switch (e.type) {
      case 'push': {
        let v = e.valeur;
        /* « Double si ta tribune recule » : la corde, cette fois, et c'est
           voulu — la Torche parle de la tribune, pas du terrain. */
        const recule = m.side === 0 ? this.rope > 0 : this.rope < 0;
        if (e.doubleSiMene && recule) v *= 2;
        this.pousserDepuisCarte(m, v, now, evenements);
        break;
      }

      case 'refill':
        m.breath = Math.min(RULES.breathMax,
          m.breath + (RULES.breathMax - m.breath) * (e.part ?? 0.5));
        evenements.push({ t: 'effect', type: 'refill', userId });
        break;

      case 'team_breath': {
        let touches = 0;
        for (const [, x] of this.members) {
          if (x.side !== m.side) continue;
          x.breath = Math.min(RULES.breathMax, x.breath + e.valeur);
          touches++;
        }
        evenements.push({ t: 'effect', type: 'team_breath', side: m.side,
          valeur: e.valeur, touches });
        break;
      }

      case 'mod_self':
        poserEffet(m, { type: 'mod_self', mods: e.mods,
          fin: e.duree ? now + e.duree : undefined, charges: e.charges });
        evenements.push({ t: 'effect', type: 'mod_self', userId, mods: e.mods });
        break;

      case 'floor_quality':
        poserEffet(m, { type: 'floor_quality', valeur: e.valeur, charges: e.charges });
        evenements.push({ t: 'effect', type: 'floor_quality', userId });
        break;

      /* Appel du capo : une fenêtre pour toute la tribune. Elle est diffusée à
         la salle — c'est une carte qu'on joue *pour les autres*, et elle ne
         vaut rien si personne ne la voit. */
      case 'rally':
        this.rallies.push({ side: m.side, fin: now + e.duree, bonus: e.bonus });
        evenements.push({ t: 'rally', side: m.side, duree: e.duree, bonus: e.bonus,
          par: m.name });
        break;

      /* Mosaïque : ne vaut rien seul. La poussée passe par la division par
         l'effectif, donc ce qu'elle mesure est la **part** de la tribune qui a
         chanté récemment — pas sa taille. Une tribune de mille dont un dixième
         pousse vaut moins qu'une tribune de dix entièrement debout. */
      case 'per_mate': {
        const mates = this.actifsDuCamp(m, e.fenetre, now);
        if (mates > 0) this.pousserDepuisCarte(m, e.valeur * mates, now, evenements);
        evenements.push({ t: 'effect', type: 'per_mate', userId, mates });
        break;
      }

      /* Chœur : la fenêtre la plus courte du jeu, et la seule qui demande que
         tout le monde tape en même temps. */
      case 'sync':
        this.rallies.push({ side: m.side, fin: now + e.duree, bonus: 1,
          sync: true, max: e.max });
        evenements.push({ t: 'sync', side: m.side, duree: e.duree, par: m.name });
        break;

      /* ------------------------------------------- les quatre de septembre

         Elles étaient déclarées jouables au Virage — leur portée est `soi` —
         et ce `switch` ne les connaissait pas. Elles tombaient donc dans le
         `default`, qui lève, **après** que le souffle ait été débité. Voir le
         filet posé dans `jouer` : il empêche désormais qu’une carte coûte
         quelque chose sans rien rendre. Restait à les écrire.

         L’Arbitre et la Relève, elles, ne sont plus acceptées ici du tout :
         voir `SANS_OBJET_AU_VIRAGE` dans `shared/duel/actions.js`. Un `case`
         qui ne fait rien est une carte morte, et une carte morte dans un deck
         de dix est un emplacement volé. */

      /**
       * **L’Ancre.** La corde cesse de retomber, pour toute la salle.
       *
       * Elle ne pousse pas, elle **garde** — et au Virage ce choix pèse plus
       * qu’au duel : une tribune qui mène voit la décroissance lui manger
       * 1,4 point par seconde sans que personne n’ait rien fait. Huit
       * secondes de gel valent une poussée entière, sans avoir eu à réussir
       * un geste.
       *
       * Posée sur la salle et non sur un supporter : la corde est commune aux
       * deux tribunes, un gel qui ne vaudrait que d’un côté n’aurait aucun
       * sens physique.
       */
      case 'freeze_decay':
        this.geleeJusqua = Math.max(this.geleeJusqua ?? 0, now + e.duree);
        evenements.push({ t: 'effect', type: 'freeze_decay', duree: e.duree });
        break;

      /**
       * **La Mise.** Le prochain chant compte double — et s’il rate, il coûte.
       *
       * Elle se pose ici et se résout au chant suivant, dans `chanter` : c’est
       * le seul endroit où l’on sait si le pari est gagné.
       */
      case 'double_next':
        poserEffet(m, { type: 'double_next', fin: now + e.duree, valeur: e.gage ?? 20 });
        evenements.push({ t: 'effect', userId, type: 'double_next', duree: e.duree });
        break;

      /**
       * **La Tournée.** Les prochaines cartes ne coûtent rien.
       *
       * Elle se consomme dans `jouer`, avant le contrôle de souffle. Ici on ne
       * fait que la poser.
       */
      case 'cost_free':
        poserEffet(m, { type: 'cost_free', fin: now + (e.duree ?? 15000),
          valeur: e.cartes ?? 2 });
        evenements.push({ t: 'effect', userId, type: 'cost_free', cartes: e.cartes ?? 2 });
        break;

      /**
       * **Le Long Chant**, et le **Coup d’envoi**. Une poussée étalée.
       *
       * `delayed_push` frappe une fois, plus tard ; celle-ci frappe un peu, dix
       * fois, pendant dix secondes. Elle passe par `differes` comme le tifo,
       * donc chacun de ses coups est divisé par l’effectif : une poussée
       * étalée n’échappe pas plus à la règle de la foule qu’une poussée sèche.
       */
      case 'push_over_time': {
        const coups = Math.max(1, e.coups ?? 10);
        const pas = (e.duree ?? 10000) / coups;
        for (let k = 1; k <= coups; k++) {
          this.differes.push({ userId, quand: now + k * pas, valeur: e.valeur / coups });
        }
        evenements.push({ t: 'arme', userId, side: m.side, delai: pas,
          cardId: carte.id, par: m.name, coups });
        break;
      }

      /* Changement de chant : la main repart dans la pioche, on en reprend
         cinq. Ce qu'on défausse revient — la carte ne doit pas vider le deck
         de celui qui la joue. */
      case 'refill_hand': {
        m.pioche.push(...m.main, ...m.defausse);
        m.defausse = [];
        m.pioche = melanger(m.pioche);
        m.main = m.pioche.splice(0, RULES.mainVisible);
        m.remplirA = 0;
        evenements.push({ t: 'effect', type: 'refill_hand', userId, cartes: m.main.length });
        break;
      }

      /* Nouveau souffle : toutes les recharges tombent. Au Virage elles durent
         une fois et demie celles du duel, donc la carte y vaut encore plus. */
      case 'clear_cooldowns': {
        const combien = Object.values(m.cooldowns ?? {}).filter((fin) => fin > now).length;
        m.cooldowns = {};
        evenements.push({ t: 'effect', type: 'clear_cooldowns', userId, liberees: combien });
        break;
      }

      /* Le tifo s'arme et frappe plus tard. Il passe par `pousserDepuisCarte`
         le moment venu, donc il est divisé par l'effectif comme tout le reste. */
      case 'delayed_push':
        this.differes.push({ userId, quand: now + e.delai, valeur: e.valeur });
        evenements.push({ t: 'arme', userId, side: m.side, delai: e.delai,
          cardId: carte.id, par: m.name });
        break;

      default:
        throw new Cheat('unknown_effect');
    }
  }

  /** Le revers d'une carte : toujours sur celui qui l'a jouée. */
  appliquerEffet(m, effet, now, evenements) {
    if (effet.type === 'breath_mult') {
      poserEffet(m, { type: 'breath_mult', mods: { breathBonus: effet.valeur },
        fin: now + effet.duree });
      evenements.push({ t: 'effect', type: 'breath_mult',
        valeur: effet.valeur, duree: effet.duree });
      return;
    }
    poserEffet(m, { type: effet.type, mods: effet.mods,
      fin: effet.duree ? now + effet.duree : undefined, charges: effet.charges });
  }

  /**
   * Ce qui se répare tout seul avec le temps : les recharges finies, les
   * effets expirés, les fenêtres refermées, et la carte suivante qui arrive.
   *
   * Appelé au tour d'horloge de la salle, pas à chaque geste : une main qui se
   * remplit doit se remplir même pour quelqu'un qui ne joue plus.
   */
  entretenirCartes(now = Date.now()) {
    this.rallies = this.rallies.filter((r) => r.fin > now);

    /* Les tifos arrivés à échéance. Ils poussent par le chemin ordinaire —
       division par l'effectif comprise : un tifo n'échappe pas plus à la règle
       de la foule qu'un fumigène. */
    const dus = this.differes.filter((d) => d.quand <= now);
    if (dus.length) {
      this.differes = this.differes.filter((d) => d.quand > now);
      for (const d of dus) {
        const m = this.members.get(d.userId);
        if (!m) continue;            // parti : le tifo tombe avec lui
        const ev = [];
        this.pousserDepuisCarte(m, d.valeur, now, ev);
        this.push('virage:events', { evenements: [{ t: 'deplie', side: m.side }, ...ev] });
      }
    }
    for (const [, m] of this.members) {
      if (!m.effets) continue;
      nettoyerEffets(m, now);
      if (m.main.length < RULES.mainVisible && m.remplirA && now >= m.remplirA) {
        /* La pioche vide se refait de la défausse. Un deck de dix cartes dont
           quatorze sont jouables tournerait sinon à sec au bout d'un quart
           d'heure, et le joueur finirait la mi-temps sans main. */
        if (!m.pioche.length && m.defausse.length) {
          m.pioche = melanger(m.defausse);
          m.defausse = [];
        }
        const tiree = m.pioche.shift();
        if (tiree) { m.main.push(tiree); m.dirtyMain = true; }
        m.remplirA = m.main.length < RULES.mainVisible ? now + RULES.refillMs : 0;
      }
    }
  }

  regen(m, now = Date.now()) {
    const dt = (now - (m.regenAt ?? now)) / 1000;
    m.regenAt = now;
    const mult = now < m.fatigueUntil ? 0.35 : 1;
    m.breath = Math.min(RULES.breathMax,
      m.breath + RULES.breathPerSec * dt * mult * (this.modsDe(m, now).breathBonus ?? 1));
  }

  scoreGoal(side) {
    this.goals[side]++;
    this.rope = 0;
    this.push('virage:goal', { side, goals: this.goals, real: false });
    /* La tribune est au fil comme le terrain.
       C'est elle qui explique la corde : sans cette entrée, le joueur voit le
       nœud repartir du milieu sans savoir si sa tribune vient de gagner ou de
       céder. Le fil sert d'abord à ça — relier ce qu'on voit à ce qui arrive. */
    this.ajouterAuFil([{
      cle: `v|${side}|${this.goals[0]}-${this.goals[1]}`,
      genre: 'tribune', type: 'tribune', detail: null, side,
      minute: this.minute, extra: null,
      joueur: null, passeur: null, goals: [...this.goals],
    }]);
    this.onGoal?.({ fixtureId: this.fixture.id, side, goals: this.goals });
  }

  /* ---------------------------------------------------------- but réel */

  /**
   * Un but dans le vrai match. Il secoue la corde du côté qui a marqué et
   * ouvre une minute où tout compte double : c'est le moment où le joueur
   * ouvre son téléphone, et il doit valoir le déplacement.
   *
   * Rend `true` quand la salle l'a annoncé, `false` quand elle l'a tu.
   */
  realGoal({ teamId, minute, player, assist = null, score = null }) {
    /* **Un but que la salle connaît déjà ne sonne pas.** Au tableau à
       l'ouverture, personne ici ne l'a vu tomber ; annoncé ici, il l'a déjà
       été. Le relevé, lui, reconnaît un but à tout ce qui le décrit, buteur
       compris : un nom que l'API corrige le lui renvoie comme neuf.

       Ni « GOAL ! », ni corde, ni minute double ; et ni la minute ni le
       score de la salle ne reculent jusqu'à lui, le relevé du direct les
       tient déjà à jour. Il n'entre pas non plus au fil, pour la raison de
       `semerLeFil` : le score le porte, et l'y glisser maintenant le ferait
       passer pour frais.

       **Deux indices, jamais un seul.** Le rang — les buts au tableau une
       fois qu'il est marqué — dit qu'il peut être connu : on le compare à ce
       que la salle a vu, **pas au score du moment**, qu'au même tour le
       relevé fait monter (`matchStatus`) avant d'apporter le but. Mais ce
       rang, le relevé le compte dans sa liste d'événements : qu'elle manque
       un but plus ancien, et un but frais prend le rang d'un but connu. Il
       faut donc un second indice pour le taire. Sa minute, qui ne dépasse
       pas celle de l'ouverture : il était au tableau — la mi-temps comprise,
       puisque la minute de jeu s'y arrête. Ou un but du même club, à une
       minute près, déjà annoncé ici : c'est lui qui revient, buteur corrigé.
       Le rang garde ce second cas de deux buts du même club en deux minutes
       qui se suivent : le second a un rang neuf.

       Quand rien ne date le but — pas de minute, ou une salle ouverte sans
       la sienne —, le rang décide seul. Sans score, rien ne le situe : on
       l'annonce, comme avant, et il ne compte pas.

       Ce que ça coûte : un but frais encore tu, quand deux hasards rares
       tombent ensemble. Une liste qui manque un but d'avant, et un but frais
       dans la minute même de l'ouverture — ou dans le même temps additionnel,
       que la minute ne distingue pas. Ou une vidéo qui retire un but, et un
       autre du même club marqué la minute suivante, entre deux tours du
       relevé. */
    const rang = Array.isArray(score) && score.length === 2
      ? Number(score[0]) + Number(score[1]) : null;
    const quand = minute == null ? NaN : Number(minute);
    if (Number.isFinite(rang) && rang <= this.butsConnus) {
      const datable = Number.isFinite(quand) && this.minuteOuverture != null;
      const dAvant = !datable || quand <= this.minuteOuverture;
      const revenu = Number.isFinite(quand) && this.butsAnnonces.some(
        (b) => b.teamId === teamId && Math.abs(b.minute - quand) <= 1);
      if (dAvant || revenu) return false;
    }
    /* Un but frais au rang décalé ne fait pas redescendre le compte : les
       buts qu'il connaît restent connus. */
    if (Number.isFinite(rang)) this.butsConnus = Math.max(this.butsConnus, rang);
    if (Number.isFinite(quand)) this.butsAnnonces.push({ teamId, minute: quand });

    const side = teamId === this.fixture.homeId ? 0 : 1;
    this.realGoals[side]++;
    /* Le score du vrai match vient du relevé quand il l'accompagne : le
       compter ici à partir des buts vus donnerait 1–0 à qui entre à la
       soixantième minute d'un 3–2.

       **Sans jamais faire reculer le tableau, ni la minute.** Ce score est
       celui que le relevé reconstitue dans sa liste : en retard d'un but
       quand elle en manque un, ou quand l'API publie ce but après un plus
       tardif. Le tableau que `matchStatus` vient de poser au même tour est
       plus juste — la page affichait 1–0 sous « GOAL ! » d'un 2–0. Il ne
       recule que par lui, quand la vidéo retire un but. La minute non plus :
       celle d'un but est déjà derrière celle que le relevé vient de poser,
       et bien plus pour un but publié en retard. La reprendre ferait tourner
       le répertoire à l'envers, et refuserait une carte de fin de match déjà
       permise. */
    if (Array.isArray(score) && score.length === 2) {
      this.scoreReel = [Math.max(Number(this.scoreReel[0]) || 0, Number(score[0]) || 0),
                        Math.max(Number(this.scoreReel[1]) || 0, Number(score[1]) || 0)];
    } else this.scoreReel[side]++;
    if (Number.isFinite(quand) && !(this.minute > quand)) this.minute = quand;
    this.ajouterAuFil([this.entreeTerrain(
      { type: 'Goal', detail: null, teamId, minute, player, assist })]);
    const jolt = RULES.realGoalJolt * (side === 0 ? -1 : 1);
    this.rope = clamp(this.rope + jolt, -RULES.goalAt, RULES.goalAt);
    this.surgeUntil = Date.now() + RULES.surgeAfterRealGoalMs;
    this.dirty = true;
    this.push('virage:real_goal', {
      side, teamId, minute, player,
      realGoals: this.realGoals,
      scoreReel: this.scoreReel,
      surgeUntil: this.surgeUntil,
      /* La durée qui reste, à côté de l'instant : un téléphone dont l'horloge
         avance d'une demi-minute lirait l'instant de travers. Un compte à
         rebours part de la réception plus `surgeMs`. */
      surgeMs: RULES.surgeAfterRealGoalMs,
    });
    if (Math.abs(this.rope) >= RULES.goalAt) this.scoreGoal(this.rope > 0 ? 1 : 0);
    return true;
  }

  /* -------------------------------------------- le terrain, hors les buts */

  /**
   * Le relevé d'événements du match : cartons, remplacements, arbitrage vidéo.
   *
   * Les buts en sont **retirés**. Ils passent par `realGoal`, qui secoue la
   * corde et ouvre la minute double ; les laisser entrer ici les ferait
   * apparaître une seconde fois au fil, une fois par le chemin du jeu et une
   * fois par celui du relevé — et le fil raconterait un 2–0 sur un but.
   */
  matchEvents(events = []) {
    return this.ajouterAuFil(
      events.filter((e) => e.type !== 'Goal').map((e) => this.entreeTerrain(e)));
  }

  /**
   * L'état du vrai match : score, minute, période.
   *
   * Appelé à chaque tour du relevé du direct, donc sans un appel de plus. Le
   * changement de période écrit au fil ; le score et la minute ne font que se
   * mettre à jour, sinon chaque tour d'horloge produirait une entrée.
   */
  matchStatus({ status = null, elapsed = null, elapsedExtra = null,
                homeGoals = null, awayGoals = null, kickoffAt = null } = {}) {
    /* Le relevé vient de voir le match : son heure vaut désormais mieux que
       celle de la base. Un match avancé ou reculé gardait sinon dans sa salle
       l'heure lue à l'ouverture, et `sallesOccupees` décidait de son relevé —
       la libération, de sa durée de vie — sur une heure fausse. */
    if (kickoffAt != null && Number.isFinite(new Date(kickoffAt).getTime())) {
      this.fixture.kickoffAt = new Date(kickoffAt);
    }

    /* Le score et la minute se diffusent **dès qu'ils bougent**, et pas
       seulement quand la période change.

       Ils ne partaient qu'avec une entrée de fil : un but réel en produit une,
       un changement de période aussi — mais entre les deux, la minute
       n'avançait jamais et le score restait figé sur ce qu'il valait à
       l'entrée. Un supporter voyait donc « 2 – 0 · 65′ » pendant une
       demi-heure. Le relevé du direct lit ces deux valeurs toutes les vingt
       secondes ; il ne manquait qu'un message pour les faire descendre. */
    const bouge = (elapsed != null && elapsed !== this.minute)
      || (homeGoals != null && awayGoals != null
          && (homeGoals !== this.scoreReel[0] || awayGoals !== this.scoreReel[1]));

    /* Le répertoire tourne avec la minute, et toute la tribune doit l'apprendre
       au même instant : la page ne reçoit `virage:state` qu'à l'entrée, donc
       sans ce message les cinq chants offerts restaient ceux du moment où l'on
       est arrivé — pour les quatre-vingt-dix minutes suivantes. */
    const rangAvant = this.rangRepertoire();
    if (elapsed != null) this.minute = elapsed;
    if (this.rangRepertoire() !== rangAvant) {
      this.rangChangeA = Date.now();
      this.push('virage:repertoire', {
        rang: this.rangRepertoire(),
        cards: this.chantsOfferts(),
        /* Le motif de l'écho appartient à la tribune : on le chante ensemble.
           La *fenêtre*, elle, est personnelle — un Métronome ou une écharpe
           l'élargissent — et reste donc celle que la page tient déjà. */
        echo: (({ motif, instants }) => ({ motif, instants }))(
          resoudreGeste({}, { motif: this.rangRepertoire() }).echo),
      });
    }
    this.minuteExtra = elapsedExtra;
    // Le relevé vient de voir le match : l'horloge de la page repart de là, et
    // non de l'instant où elle a reçu le message.
    this.vuA = Date.now();
    if (homeGoals != null && awayGoals != null) {
      this.scoreReel = [homeGoals, awayGoals];
      /* **Un but que la vidéo retire fait redescendre le tableau, et ce compte
         avec lui.** Le vrai but suivant reprend le rang du but refusé, et la
         minute ne le sauve pas toujours : la salle le tairait sinon quand
         rien ne le date, ou quand le même club marque la minute d'après celle
         du but refusé — il passerait pour lui, revenu. Il ne monte jamais
         ici : passé l'ouverture, un but n'y entre qu'annoncé — voir
         `realGoal`. */
      const auTableau = (Number(homeGoals) || 0) + (Number(awayGoals) || 0);
      this.butsConnus = Math.min(this.butsConnus, auTableau);
    }
    const change = status && status !== this.statut;
    if (status) this.statut = status;

    if (bouge || change) {
      this.push('virage:match', {
        scoreReel: this.scoreReel, minute: this.minute,
        minuteExtra: this.minuteExtra, statut: this.statut, vuA: this.vuA,
      });
    }

    /* **Le coup de sifflet final** (`CONTRATS.md`, § 15.3), lu dans le
       statut que le relevé du direct apporte de toute façon : aucun appel de
       plus. `virage:fin` part **une fois** à la salle — la page tire alors un
       délai de 0 à 8 s et demande son bilan, si bien que mille bilans
       s'étalent au lieu de tomber dans la même seconde (P5). `finA` arme la
       fermeture de la tribune, `virage.bilan_min` minutes plus tard.

       Si l'API revient sur une fin (une correction de statut), la tribune
       n'est plus à fermer ; l'annonce, elle, ne se répète pas. */
    if (change && FINS_DE_MATCH.has(status)) {
      this.finA ||= Date.now();
      if (!this.finDiffusee) {
        this.finDiffusee = true;
        this.push('virage:fin', { statut: status });
      }
    } else if (change && !FINS_DE_MATCH.has(status)) {
      this.finA = 0;
    }
    if (!change) return [];
    return this.ajouterAuFil([this.entreePeriode(status)]);
  }

  /* ------------------------------------------------------------ horloge */

  tick(now = Date.now()) {
    const dt = (now - this.last) / 1000;
    this.last = now;
    // Le battement ne repousse la libération que s'il y a quelqu'un.
    if (this.members.size) this.occupeeA = now;

    /* L’Ancre suspend la décroissance, pour toute la salle. La corde est
       commune aux deux tribunes : un gel qui ne vaudrait que d’un côté
       n’aurait aucun sens physique. Même règle qu’au duel. */
    const back = now < this.geleeJusqua ? 0 : RULES.decayPerSec * dt;
    if (this.rope > 0) this.rope = Math.max(0, this.rope - back);
    else if (this.rope < 0) this.rope = Math.min(0, this.rope + back);

    for (const m of this.members.values()) this.regen(m, now);
    /* Les cartes s'entretiennent au tour d'horloge, pas au geste : une main se
       remplit et une recharge se termine même pour quelqu'un qui a posé son
       téléphone. */
    this.entretenirCartes(now);

    /* **La carte tirée, annoncée à celui qui la tient.**
       Le tirage marquait `dirtyMain` et personne ne le lisait : `virage:vous`
       ne partait qu'après une carte jouée — avant le tirage, donc —, la page
       montrait quatre cartes au plus, et une case restait vide jusqu'au
       rechargement. Le message part ici, au tour même du tirage.

       Au plus un par joueur toutes les `refillMs` : un tirage repousse le
       suivant d'autant, et une carte jouée aussi. Les partis n'en reçoivent
       aucun — ils ne sont pas dans `members`, et ne tirent pas : leur main
       repart avec l'état, à leur retour. */
    for (const [userId, m] of this.members) {
      if (!m.dirtyMain) continue;
      m.dirtyMain = false;
      this.emitVous?.(userId, this.snapshotFor(userId).you);
    }

    /* Le classement en direct : au plus une fois par seconde, et seulement
       si une ferveur, une entrée ou un départ l'a fait bouger. */
    if (this.classementSale && now - this.classementA >= 1000) this.classer(now);

    /* **La fin de la minute double part aussi.** La diffusion ne partait que
       si quelque chose avait bougé, et l'expiration ne bouge rien : dans une
       salle calme, la page gardait « TOUT COMPTE DOUBLE » après les soixante
       secondes, jusqu'au chant suivant — qui comptait alors simple. */
    const surge = now < this.surgeUntil;
    if (!this.dirty && surge === this.surgeDiffusee) return;
    this.dirty = false;
    this.surgeDiffusee = surge;
    const n = this.crowd();
    this.push('virage:tick', {
      rope: Math.round(this.rope),
      goals: this.goals,
      crowd: n,
      surge,
    });
  }

  push(event, payload) {
    this.emit(event, { ...payload, seq: ++this.seq });
  }

  /* --------------------------------------------------------- snapshots */

  /**
   * Le classement des présents, tribune par tribune.
   *
   * L'ordre est celui du bilan (`comparerTribune`) : la ferveur, puis les
   * chants, puis les PARFAITS ; deux supporters égaux sur les trois ont la
   * même place — `1 +` ceux qui font strictement mieux. Les partis n'y sont
   * pas : le rang en direct se dit parmi ceux qu'on voit.
   *
   * Appelé au tour d'horloge, au plus une fois par seconde, et par `placeDe`
   * pour un supporter qu'il ne connaît pas encore — une entrée, un retour :
   * c'est rare au regard des chants, et l'entrant doit avoir sa place tout de
   * suite (`rang` n'est jamais absent d'une réponse, § 16.2).
   */
  classer(now = Date.now()) {
    const tribunes = [[], []];
    for (const m of this.members.values()) tribunes[m.side ? 1 : 0].push(m);
    const rangs = new Map();          // membre -> { rang, cote }
    tribunes.forEach((t, cote) => {
      t.sort((a, b) => comparerTribune(b, a));
      for (let i = 0; i < t.length; i++) {
        const egal = i > 0 && comparerTribune(t[i], t[i - 1]) === 0;
        rangs.set(t[i], { rang: egal ? rangs.get(t[i - 1]).rang : i + 1, cote });
      }
    });
    this.classement = { tribunes, rangs };
    this.classementSale = false;
    this.classementA = now;
    return this.classement;
  }

  /**
   * La place d'un présent : `rang`, `sur`, et `prochain`, le palier suivant
   * (`CONTRATS.md`, § 16.2), lus dans le classement de la dernière seconde.
   *
   * `prochain.ecart` est la ferveur qui manque pour passer devant celui qui
   * tient la place du palier — sa ferveur moins la mienne, plus un —, lue
   * **maintenant**, et jamais moins de 1 : le classement peut dater d'une
   * seconde, la ferveur non.
   */
  placeDe(m, now = Date.now()) {
    /* Un membre que le classement ne connaît pas encore, ou qu'il range dans
       l'autre tribune — un neutre qui a rechoisi son camp —, le fait refaire. */
    let c = this.classement;
    const cote = m.side ? 1 : 0;
    if (c?.rangs.get(m)?.cote !== cote) c = this.classer(now);
    const tribune = c.tribunes[cote];
    // Un parti n'a pas de place en direct : on ne l'invente pas.
    if (!c.rangs.has(m)) return { rang: null, sur: tribune.length, prochain: null };
    const { rang } = c.rangs.get(m);
    const palier = palierAuDessus(rang);
    const devant = palier ? tribune[palier - 1] : null;
    const prochain = devant
      ? { rang: palier, ecart: Math.max(1, devant.ferveur - m.ferveur + 1) }
      : null;
    return { rang, sur: tribune.length, prochain };
  }

  /**
   * Classement d'un supporter dans sa tribune. C'est son vrai enjeu.
   *
   * **À l'instant**, et non à la seconde près : c'est la lecture qu'on fait
   * pour savoir où il en est maintenant, un départ ou une ferveur de la
   * dernière seconde compris. Les réponses de chant, elles, lisent le
   * classement de la dernière seconde (`placeDe`).
   */
  rankOf(userId) {
    const m = this.members.get(userId);
    if (!m) return null;
    if (this.classementSale) this.classer();
    const { rang, sur } = this.placeDe(m);
    return { rank: rang, of: sur, ferveur: m.ferveur };
  }

  snapshotFor(userId) {
    const m = this.members.get(userId);
    const n = this.crowd();
    const now = Date.now();
    const surge = now < this.surgeUntil;
    const place = m ? this.placeDe(m, now) : null;
    return {
      fixture: this.fixture,
      rope: Math.round(this.rope),
      goals: this.goals,
      realGoals: this.realGoals,
      crowd: n,
      surge,
      surgeUntil: this.surgeUntil,
      /* Ce qui reste de la minute double : voir `realGoal`. **Toujours servi,
         et 0 hors de la minute** (`CONTRATS.md`, § 16.2 ; le correctif du
         4 octobre 2026) : la page ne décompte que sur une valeur positive, et
         un champ toujours là ne se confond pas avec un serveur d'avant. */
      surgeMs: surge ? this.surgeUntil - now : 0,
      seq: this.seq,
      // Le fil part avec l'état : entrer à la soixantième minute doit donner
      // ce qui s'est passé avant, pas un écran vide qui ne se remplira qu'au
      // prochain carton.
      fil: this.fil,
      scoreReel: this.scoreReel,
      statut: this.statut,
      minute: this.minute,
      minuteExtra: this.minuteExtra,
      vuA: this.vuA,
      you: m ? {
        side: m.side,
        // La page le dit au joueur : venir pousser ailleurs est permis, mais
        // il doit savoir que sa ferveur y compte moitié moins. Une règle qu'on
        // découvre au classement est une règle qu'on prend pour un bug.
        neutre: Boolean(m.neutre),
        ferveurNeutre: RULES.ferveurNeutre,
        breath: Math.round(m.breath),
        /* Le souffle regagné par seconde, **pour ce supporter-ci**.
           Il remonte dix fois par seconde côté serveur, mais la diffusion de
           la corde part à toute la salle : elle ne peut pas porter une valeur
           propre à chacun. La jauge ne bougeait donc qu'au chant suivant — le
           joueur croyait son souffle bloqué et attendait pour rien. Avec ce
           taux, la page l'anime elle-même entre deux vérités du serveur, et
           chaque `virage:result` la remet d'aplomb. */
        regen: RULES.breathPerSec * (this.modsDe(m).breathBonus ?? 1),
        breathMax: RULES.breathMax,
        // Le client doit afficher le geste exactement comme le serveur le
        // note. Sans ça il dessinait la pulsation de base et le porteur
        // d'équipement tapait à côté sans jamais comprendre pourquoi.
        // Le geste tel qu'il sera **vraiment** noté : effets de cartes compris,
        // sinon le Métronome élargirait la fenêtre sans que la page le dessine.
        // **Et le lieu compris** : il manquait ici seul, si bien que le stade
        // resserrait la fenêtre côté notation sans la resserrer à l'écran —
        // la même faute, refaite un cran plus bas.
        gestes: resoudreGeste(this.modsDe(m), { motif: this.rangRepertoire() }),

        /* **Ce qu'il porte, et d'où ça vient.**
         *
         * `apports` est la ventilation — Fanzzy, sac, KOP, lieu — et `mods` le
         * total que le moteur applique vraiment. Les deux partent ensemble et
         * c'est délibéré : la page pourrait additionner la première pour
         * obtenir le second, et elle le ferait **mal** le jour où une règle de
         * composition se nuance. Ici, le total ne se discute pas.
         *
         * Sans étiquettes : `id`, `kopNom` et les siennes ne sont pas des
         * modificateurs, et n'ont rien à faire dans une liste de bonus. */
        apports: [...(m.apports ?? []), ...apportsDe({ stade: this.stade() })],
        mods: seulsLesMods(this.modsDe(m)),

        /* La main, ses recharges et ce qui est posé sur lui. `reste` est en
           secondes plutôt qu'en instant : la page n'a pas à connaître
           l'horloge du serveur pour dessiner un compte à rebours. */
        main: [...m.main],
        mainVisible: RULES.mainVisible,
        cooldowns: Object.fromEntries(Object.entries(m.cooldowns ?? {})
          .map(([id, fin]) => [id, Math.max(0, (fin - Date.now()) / 1000)])
          .filter(([, s]) => s > 0)),
        effets: (m.effets ?? []).map((e) => ({ type: e.type,
          reste: e.fin ? Math.max(0, e.fin - Date.now()) : null,
          charges: e.charges ?? null })),
        /* Le Fanzzy à l'écran. Il manquait entièrement : la page appelait
           `S.you.cri` pour lancer le Cri après un geste parfait, et cette clé
           n'a jamais été envoyée — la vidéo ne s'est donc jamais jouée depuis
           le virage. Le cri vit maintenant avec le reste du personnage, sous
           un seul nom, plutôt qu'en clé isolée qu'on oublie de remplir. */
        fanzzy: m.perso,
        /* Les cartes du deck qui ne sont pas entrées ici. Voir `join` : ce
           nombre existe pour que la rangée d'action puisse expliquer ses
           cases vides au lieu de les laisser passer pour une panne. */
        ecartees: m.ecartees ?? 0,
        /* Sa place, dans l'ordre du bilan : `rank` et `of` gardent leur nom
           d'avant (`CONTRATS.md`, § 16.2) ; `prochain`, le palier suivant,
           absent à la première place. `serie` : les PARFAITS d'affilée en
           cours — le combo du HUD lit ce nombre, jamais un compte à lui. */
        rank: place.rang, of: place.sur, ferveur: m.ferveur,
        serie: m.serie ?? 0,
        ...(place.prochain ? { prochain: place.prochain } : {}),
      } : null,
      // Les cinq chants du moment, pas les douze : voir `repertoire()`.
      cards: this.chantsOfferts(),
      rang: this.rangRepertoire(),

      /* Le stade où se joue la rencontre.
       *
       * **Il appartient au match, pas à un joueur** — c'est la règle écrite
       * dans `stades.js`, et c'est elle qui empêche un stade de devenir un
       * avantage qu'on achète. Ici il découle donc de l'identifiant du match :
       * tout le monde dans la salle voit le même, et le même à chaque fois
       * qu'on y revient.
       *
       * L'intersection des possessions n'a pas de sens dans une salle ouverte
       * à tous — on passe donc un tableau vide, ce qui ouvre les cinq. Le jour
       * où le stade viendra du vrai lieu du match, c'est cette ligne-là qui
       * changera, et elle seule. */
      stade: this.stade(),
      /* Le catalogue des cartes d'action jouables ici. Il part avec l'état
         plutôt que d'être recopié dans la page : le jour où une carte change
         de portée, le Virage suit sans déploiement du client. */
      actions: ACTIONS_VIRAGE,
      /* La fenêtre collective en cours, s'il y en a une. Elle appartient à la
         tribune entière : c'est la seule chose qu'un joueur doit voir arriver
         de la main de quelqu'un d'autre. */
      rally: this.rallies.filter((r) => r.fin > Date.now())
        .map((r) => ({ side: r.side, reste: r.fin - Date.now(), sync: Boolean(r.sync) })),
    };
  }

  get size() { return this.members.size; }
}

export { CARDS };
