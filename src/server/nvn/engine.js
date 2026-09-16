import { reglage } from '../../shared/reglages.js';
import { grade, applyHeroMods, resoudreGeste, Cheat, GESTES, MOTIFS }
  from '../ferveur/gestures.js';
import { ACTION_BY_ID, DECK_RULES } from '../../shared/duel/actions.js';
/* Les chants, partagés avec le Virage. Le duel les impose plus : il les offre,
   comme lui, et c'est la dernière différence entre les deux modes qui tombe. */
import { CHANTS, ORDRE } from '../../shared/duel/chants.js';
import { poserEffet, nettoyerEffets, aEffet, modsAvecEffets } from '../../shared/duel/effets.js';
// Le lieu de la rencontre, et sa règle : voir le constructeur.
import { stadeDeLaRencontre } from '../../shared/stades.js';

/**
 * Moteur de duel N contre N.
 *
 * Deux tribunes tirent sur la même corde. Chacun chante — un geste noté par le
 * serveur — et joue des cartes d'action qui changent les règles pendant
 * quelques secondes. Le nombre n'est pas un avantage : une poussée est divisée
 * par l'effectif de la tribune, donc cinq joueurs mous ne battent pas un bon
 * joueur seul. Ce qui fait la différence à plusieurs, ce sont les cartes
 * collectives, qui ne valent rien jouées dans son coin.
 *
 * Le moteur ne connaît ni socket ni base : on lui donne des intentions, il
 * renvoie des événements. C'est ce qui le rend testable ligne à ligne.
 */

export const RULES = {
  get goalAt() { return reglage('duel.but_a'); },
  get goalsToWin() { return reglage('duel.buts_pour_gagner'); },
  get breathMax() { return reglage('virage.souffle_max'); },
  get breathPerSec() { return reglage('virage.souffle_par_sec'); },
  get decayPerSec() { return reglage('duel.decroissance'); },
  get dureeMs() { return reglage('duel.duree_min') * 60_000; },
  mainVisible: DECK_RULES.mainVisible,
  refillMs: 4000,          // délai avant qu'une carte jouée soit remplacée
  // Poussée d'un chant parfait, avant les modificateurs du Fanzzy.
  get chantPower() { return reglage('duel.chant_puissance'); },
  get chantCost() { return reglage('duel.chant_cout'); },
  butReelSouffle: 25,      // souffle rendu à la tribune du club qui vient de marquer
  butReelSecousse: 55,     // ce qu'un vrai but pousse sur la corde, du côté du buteur
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const now0 = () => Date.now();

/**
 * Un nombre stable tiré d'un identifiant de duel.
 *
 * `stadeDeLaRencontre` attend une graine numérique — le Virage lui donne
 * l'identifiant du match, qui en est un. Celui d'un duel est une chaîne, et
 * `Number('d-7f3a')` vaut `NaN` : la fonction retombe alors sur zéro, donc sur
 * le premier stade, **pour tous les duels du jeu**. Le lieu aurait existé sans
 * jamais changer, ce qui est la façon la plus discrète de ne pas exister.
 */
function hachage(texte) {
  let h = 0;
  for (const c of String(texte ?? '')) h = (h * 31 + c.codePointAt(0)) % 0x7fffffff;
  return h;
}

/* **La rotation des gestes n'existe plus.**
 *
 * Elle imposait le geste du prochain chant : celui du Fanzzy une fois sur deux,
 * les seize autres à tour de rôle. C'était la réponse à un vrai problème — un
 * joueur faisait le même geste pendant cinq minutes — mais c'était la réponse
 * du duel, et le Virage en avait une autre : offrir cinq chants et laisser
 * choisir.
 *
 * Les deux modes ont maintenant celle du Virage. On rencontre les dix-sept
 * gestes en jouant plusieurs duels, puisque les cinq chants offerts changent
 * d'une partie à l'autre — au lieu de les voir tous défiler dans une seule.
 *
 * `GESTES` reste importé : `grade` s'en sert pour refuser un geste inconnu. */

/* ------------------------------------------------------------- joueurs */

function creerJoueur(p, side) {
  const loadout = p.loadout;
  const pioche = [...loadout.actions.map((a) => a.id)];
  // Mélange : deux joueurs avec le même deck ne voient pas les mêmes cartes.
  for (let i = pioche.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pioche[i], pioche[j]] = [pioche[j], pioche[i]];
  }
  return {
    userId: p.userId, nom: p.nom, side,
    // Une copie, pas la référence. Depuis la Relève, le moteur **écrit** dans
    // ces objets — nom, cri, modificateurs changent quand le personnage
    // grandit. Travailler sur ceux du loadout ferait sortir la mutation du
    // duel : un joueur qui en enchaîne deux repartirait avec son Fanzzy déjà
    // grandi, et la règle « tout le monde entre au premier âge » tomberait
    // sans que rien ne le signale.
    fanzzy: loadout.fanzzy.map((f) => ({ ...f })),
    actif: 0,                       // index du Fanzzy en jeu

    /* Le geste du prochain chant, et le motif de l'écho.
     *
     * **Les deux sont décidés par le serveur**, et c'est tout le changement :
     * un joueur faisait le geste de son Fanzzy, toujours le même, pendant les
     * cinq minutes du duel. Ce n'est pas le nombre de gestes qui rendait le
     * jeu répétitif — c'est qu'on n'en découvrait jamais un autre.
     *
     * Le sien reste sa spécialité : il revient une fois sur deux, et ses
     * modificateurs ne paient que sur lui. L'autre moitié fait tourner les
     * neuf restants. */
    geste: loadout.fanzzy[0]?.cri?.gest ?? 'tempo',
    motif: 0,
    chants: 0,

    /* ------------------------------------------------ ce qu'on racontera après

       Un duel ne laissait **aucune trace** de la façon dont il s'était joué :
       un score, un vainqueur, et c'est tout. On ne pouvait donc rien dire au
       joueur de ce qu'il venait de faire — quelles cartes il avait aimées,
       combien de fois il avait changé de Fanzzy, qui avait poussé.

       Trois compteurs et une liste. Ils ne coûtent rien pendant la partie et
       ce sont eux qui font l'écran de fin. */
    cartesJouees: {},               // id de carte d'action -> nombre de fois jouée
    chantsJoues: {},                // id de chant -> nombre de fois chanté
    changements: 0,                 // remplacements : un autre Fanzzy entre
    releves: 0,                     // relèves : celui qui est là grandit
    /* Les Fanzzy réellement montés en tribune, dans l'ordre. Le loadout dit
       qui est **disponible** ; celui-ci dit qui a joué, ce qui n'est pas la
       même chose dès qu'un joueur garde un remplaçant sur le banc. */
    vus: [loadout.fanzzy[0]?.id].filter(Boolean),

    breath: 40,
    ferveur: 0,
    main: pioche.slice(0, RULES.mainVisible),
    pioche: pioche.slice(RULES.mainVisible),
    defausse: [],
    cooldowns: {},                  // cardId -> instant de disponibilité
    effets: [],                     // effets temporaires actifs
    dernierChant: 0,
    connecte: true,
  };
}

/* ------------------------------------------------------------- effets

   La mécanique — poser, nettoyer, interroger, empiler les modificateurs — vit
   dans `src/shared/duel/effets.js` depuis que le Grand Virage joue lui aussi
   des cartes d'action. Ce qui reste ici, c'est ce que **cette arène** en fait :
   `modsDe` sait où trouver le Fanzzy en tribune, et le Virage le sait
   autrement. */

/**
 * Les modificateurs en vigueur : ceux du Fanzzy, ceux du lieu, plus les effets
 * temporaires posés par les cartes.
 *
 * **Le lieu y était absent, et il l'était partout.** `stades.js` décrit dix
 * lieux, chacun avec ses `mods` et une phrase qui dit au joueur ce qu'il va
 * devoir faire autrement — « le souffle revient bien plus lentement », « un
 * geste parfait paie double ». Aucun de ces effets n'était appliqué nulle
 * part : le Virage envoyait le stade au client pour le dessiner, le duel n'en
 * avait même pas, et les `mods` étaient un commentaire.
 *
 * Ils se composent **avant** les effets temporaires et de la même façon que
 * l'équipement : les facteurs se multiplient, les décalages s'additionnent.
 * L'ordre importe peu ici puisque la multiplication commute — ce qui compte est
 * qu'ils soient là, et des deux côtés.
 */
const modsDe = (j, t, stade = null) =>
  modsAvecEffets(avecLieu(j.fanzzy[j.actif]?.mods, stade), j.effets, t);

/**
 * Compose les modificateurs d'un lieu avec ceux d'un Fanzzy.
 *
 * Écrite ici et non dans `stades.js` parce que c'est une règle de moteur et non
 * une description de lieu — et le Virage l'importe, plutôt que d'en écrire une
 * seconde qui finirait par diverger.
 */
export function avecLieu(mods = {}, stade = null) {
  if (!stade?.mods) return mods ?? {};
  const out = { ...(mods ?? {}) };
  /* La même partition que `combine` dans `inventaire.js`. Elle y est écrite
     pour l'équipement ; la répéter serait une seconde vérité, mais l'importer
     obligerait le moteur à connaître l'inventaire. Le jour où un troisième
     porteur de modificateurs apparaît, c'est cette liste-là qu'il faudra
     sortir — pas avant. */
  const facteurs = ['tempoWindow', 'mashBonus', 'holdBonus', 'perfectBonus',
    'parryBonus', 'parryResist', 'breathBonus', 'refundBonus', 'costPenalty',
    'pushMult', 'ferveurBonus'];
  const decalages = ['tempoInterval', 'mashTime', 'holdForgive'];
  for (const [k, v] of Object.entries(stade.mods)) {
    if (facteurs.includes(k)) out[k] = (out[k] ?? 1) * v;
    else if (decalages.includes(k)) out[k] = (out[k] ?? 0) + v;
    else out[k] = v;
  }
  return out;
}

/**
 * L'âge suivant d'un Fanzzy en tribune, ou `undefined`.
 *
 * `ages` ne contient que ce que le joueur a **débloqué** : le loadout coupe la
 * lignée au stade atteint. Un personnage dont le joueur n'a rien payé n'a donc
 * qu'un seul âge, et la Relève n'a rien à y faire — sans que le moteur ait à
 * connaître ni les écharpes ni le catalogue.
 */
const ageSuivant = (f) => f?.ages?.[f.stade ?? 1];


/* ------------------------------------------------------------- duel */

export class DuelNvN {
  /**
   * @param opts.equipes [[joueur…], [joueur…]] — chaque joueur a userId, nom, loadout
   * @param opts.fixture  le match réel support
   * @param opts.mode     'classe' ou 'entrainement'
   */
  constructor({ id, equipes, fixture, mode = 'entrainement', duree = RULES.dureeMs, now = now0() }) {
    this.id = id;
    this.fixture = fixture;
    this.mode = mode;

    /* **Le lieu de la rencontre.**
     *
     * Le duel n'en avait aucun. `stades.js` explique pourtant, en tête, que le
     * stade appartient au match et qu'« en duel, il est tiré parmi ceux que les
     * deux joueurs possèdent » : c'était écrit, documenté, et personne ne
     * l'appelait. Le duel se jouait dans le vide, sans décor et sans règle de
     * lieu, pendant que le Virage en affichait un.
     *
     * Tiré sur l'identifiant du duel, comme le Virage le tire sur celui du
     * match : les deux clients trouvent le même lieu sans avoir à se parler, et
     * la même rencontre rejouée donne le même stade.
     *
     * Les possessions sont vides tant que les stades ne se collectionnent pas —
     * c'est exactement ce que fait le Virage, et la ligne à changer le jour où
     * ils se gagneront est celle-ci. */
    this.stade = stadeDeLaRencontre([], hachage(id));

    /* **Les cinq chants offerts.**
     *
     * Le duel n'en offrait aucun : il imposait le geste par une rotation, et
     * tous les chants coûtaient 18 pour pousser 44. Le Virage, lui, en propose
     * cinq parmi dix-neuf, chacun avec son coût et sa poussée — choisir y est
     * une décision de souffle.
     *
     * Fixes pendant toute la partie : ceux du Virage tournent toutes les dix
     * minutes de match réel, ce qui n'a aucun sens sur un duel qui dure cinq
     * minutes. Tirés de l'identifiant du duel, donc **les mêmes pour les deux
     * joueurs** — la corde est commune, les moyens de la tirer aussi — et
     * différents d'un duel à l'autre, ce qui fait rencontrer les dix-sept
     * gestes en jouant plusieurs parties. */
    const depart = hachage(`${id}:chants`) % ORDRE.length;
    this.repertoire = Array.from({ length: 5 },
      (_, i) => ORDRE[(depart + i) % ORDRE.length]);
    this.rope = 0;
    this.goals = [0, 0];
    this.debut = now;
    this.fin = now + duree;
    this.dernier = now;
    this.seq = 0;
    this.termine = false;
    this.vainqueur = null;
    /* Les camps partis en cours de route. Voir `forfait` : un perdant par
       abandon ne touche rien, un perdant qui est allé au bout touche le
       barème. La différence se décide ici, pas au moment de payer. */
    this.forfaits = new Set();
    this.joueurs = new Map();
    this.rallies = [];               // fenêtres collectives ouvertes
    this.differes = [];              // poussées armées, qui frapperont plus tard

    equipes.forEach((eq, side) => {
      for (const p of eq) this.joueurs.set(p.userId, creerJoueur(p, side));
    });
    this.tailles = [equipes[0].length, equipes[1].length];
  }

  ev(type, data) { return { seq: ++this.seq, t: type, ...data }; }
  joueur(userId) {
    const j = this.joueurs.get(userId);
    if (!j) throw new Cheat('not_in_duel');
    return j;
  }

  /* ------------------------------------------------------------ souffle */

  regen(j, t) {
    const dt = (t - (j.regenAt ?? t)) / 1000;
    j.regenAt = t;
    if (aEffet(j, 'silence', t)) return;
    const m = modsDe(j, t, this.stade);
    const frein = j.effets.find((e) => e.type === 'breath_mult' && e.fin > t)?.valeur ?? 1;
    j.breath = Math.min(RULES.breathMax,
      j.breath + RULES.breathPerSec * dt * (m.breathBonus ?? 1) * frein);
  }

  /* ------------------------------------------------------------- poussée */

  /**
   * Applique une poussée. Elle est divisée par l'effectif de la tribune :
   * c'est ce qui empêche le nombre de décider seul du résultat.
   */
  pousser(j, montant, t, evenements) {
    const m = modsDe(j, t, this.stade);
    let v = montant * (m.pushMult ?? 1);

    // Fenêtre collective ouverte par un coéquipier.
    const rally = this.rallies.find((r) => r.side === j.side && r.fin > t);
    if (rally) v *= rally.bonus;

    v /= Math.max(1, this.tailles[j.side]);

    // Bouclier adverse : il absorbe avant que la corde ne bouge.
    const adverses = [...this.joueurs.values()].filter((x) => x.side !== j.side);
    for (const a of adverses) {
      const b = a.effets.find((e) => e.type === 'shield' && e.valeur > 0);
      if (!b) continue;
      const pris = Math.min(b.valeur, v);
      b.valeur -= pris; v -= pris;
      evenements.push(this.ev('shield', { userId: a.userId, absorbe: Math.round(pris) }));
      if (b.valeur <= 0) a.effets = a.effets.filter((e) => e !== b);
      if (v <= 0) return 0;
    }

    const signe = j.side === 0 ? -1 : 1;
    this.rope = clamp(this.rope + signe * v, -RULES.goalAt, RULES.goalAt);
    j.ferveur += Math.round(v);
    evenements.push(this.ev('push', { userId: j.userId, side: j.side, valeur: Math.round(v) }));

    if (Math.abs(this.rope) >= RULES.goalAt) this.but(this.rope > 0 ? 1 : 0, evenements);
    return v;
  }

  /* ------------------------------------------------------------ but réel */

  /**
   * Le camp d'un club dans ce duel : 0 à domicile, 1 à l'extérieur.
   *
   * Nul quand le club n'est pas de cette rencontre — un but à Lens ne regarde
   * pas une corde tendue sur un match de Super League.
   */
  coteDe(teamId) {
    if (teamId == null || !this.fixture) return null;
    if (Number(teamId) === Number(this.fixture.home?.id)) return 0;
    if (Number(teamId) === Number(this.fixture.away?.id)) return 1;
    return null;
  }

  /**
   * Le vrai match a bougé : un club vient de marquer.
   *
   * **Les deux tribunes d'un duel sont les deux clubs du match.** Elles ne
   * l'étaient pas : les équipes se formaient par ordre d'arrivée en file, et un
   * but réel ne pouvait donc pas « pousser du côté du domicile ». On regardait
   * alors *qui suit le club buteur*, gens qui pouvaient être des deux côtés de
   * la corde — la secousse se calculait en proportion, et à nombre égal elle ne
   * bougeait pas. C'était la meilleure réponse possible à une question mal
   * posée.
   *
   * Depuis que la file se scinde par camp, la question ne se pose plus : le but
   * secoue la corde du côté de la tribune qui l'a marqué, exactement comme au
   * Grand Virage, et c'est ce que « tribune contre tribune » veut dire. Chacun
   * de ce côté reprend son souffle.
   *
   * Les neutres de ce camp en profitent comme les autres. C'est voulu : ils
   * sont venus tenir cette tribune-là, et une tribune qui exulte n'exulte pas
   * à moitié pour ceux qui la renforcent.
   */
  butReel({ teamId, minute = null, joueur = null }, t = now0()) {
    if (this.termine) return [];
    const side = this.coteDe(teamId);
    if (side === null) return [];

    let souffles = 0;
    for (const j of this.joueurs.values()) {
      if (j.side !== side) continue;
      souffles++;
      this.regen(j, t);
      j.breath = clamp(j.breath + RULES.butReelSouffle, 0, RULES.breathMax);
    }

    const evenements = [];
    // La tribune 0 tire vers le négatif : voir `pousser`.
    const secousse = (side === 0 ? -1 : 1) * RULES.butReelSecousse;
    this.rope = clamp(this.rope + secousse, -RULES.goalAt, RULES.goalAt);

    evenements.push(this.ev('but_reel', {
      teamId, minute, joueur, side, souffles,
      secousse: Math.round(secousse),
    }));

    if (Math.abs(this.rope) >= RULES.goalAt) this.but(this.rope > 0 ? 1 : 0, evenements);
    return evenements;
  }

  but(side, evenements) {
    this.goals[side]++;
    this.rope = 0;
    evenements.push(this.ev('goal', { side, goals: [...this.goals] }));
    if (this.goals[side] >= RULES.goalsToWin) this.finir(side, 'buts', evenements);
  }

  /**
   * Un camp abandonne : le duel se termine, et l’autre gagne.
   *
   * `forfaits` retient **qui** est parti, parce que la récompense en dépend :
   * un perdant ordinaire touche le barème du perdu, un forfaitaire ne touche
   * rien. Sans cette mémoire, `recompenser` ne pourrait pas les distinguer —
   * il ne verrait qu’une défaite de plus.
   */
  forfait(side, evenements = []) {
    this.forfaits.add(side);
    this.finir(side ^ 1, 'forfait', evenements);
    return evenements;
  }

  finir(vainqueur, raison, evenements) {
    if (this.termine) return;
    this.termine = true;
    this.vainqueur = vainqueur;
    evenements.push(this.ev('over', {
      vainqueur, raison, goals: [...this.goals], mode: this.mode,
      classement: this.mode === 'classe',
    }));
  }

  /* --------------------------------------------------------------- chant */

  /**
   * Un chant. Le geste est noté ici, et **choisi ici**.
   *
   * Le client l'annonçait — `chanter(userId, { geste, taps })` — alors que le
   * commentaire au-dessus affirmait le contraire. Tant qu'il y avait trois
   * gestes et qu'un joueur gardait le sien, ça ne se voyait pas. Dès que le
   * duel en propose dix à tour de rôle, un client qui choisit son geste
   * choisit sa facilité : il jouerait toujours celui qu'il réussit.
   *
   * Le paramètre reste accepté et **ignoré** : les anciens clients continuent
   * de l'envoyer, et il ne sert plus à rien.
   */
  /**
   * Chanter — **en choisissant son chant**, comme au Virage.
   *
   * Le geste était imposé par une rotation et tous les chants coûtaient 18 pour
   * pousser 44 : appuyer sur le bouton était le seul geste, et il n'y avait
   * rien à décider. Le chant vient maintenant d'une carte du répertoire, avec
   * son coût et sa poussée — ce qui rend le duel identique au Virage, et lui
   * donne la décision de souffle qui lui manquait.
   */
  chanter(userId, { cardId, taps }, t = now0()) {
    if (this.termine) throw new Cheat('duel_over');
    const j = this.joueur(userId);

    const card = CHANTS[cardId];
    if (!card) throw new Cheat('unknown_card');
    /* Le répertoire est une règle, pas une suggestion de la page — même raison
       qu'au Virage : un client modifié demanderait sinon le chant le plus
       rentable des dix-neuf à chaque fois. */
    if (!this.repertoire.includes(cardId)) throw new Cheat('chant_hors_repertoire');

    this.regen(j, t);
    if (aEffet(j, 'silence', t)) throw new Cheat('silenced');
    if (j.breath < card.cost) throw new Cheat('not_enough_breath');

    const m = modsDe(j, t, this.stade);
    const geste = card.gest;
    let q = grade(geste, taps, m, { motif: j.motif });

    // « Second souffle » : un raté compte comme moyen, une seule fois.
    const plancher = j.effets.find((e) => e.type === 'floor_quality' && e.charges > 0);
    if (plancher && q < plancher.valeur) { q = plancher.valeur; plancher.charges--; }

    const { quality, backfire } = applyHeroMods(q, m);
    j.breath -= card.cost;
    j.dernierChant = t;
    /* Ce qu'on racontera après : quels chants ce joueur a aimés. Même compteur
       que les cartes d'action, et il nourrit le même écran de fin. */
    j.chantsJoues[cardId] = (j.chantsJoues[cardId] ?? 0) + 1;

    /* Le craquage fatigue celui qui le pousse — c'est ce qui le distingue d'un
       gros chant ordinaire. La règle vient du Virage, comme le chant lui-même. */
    if (card.effect === 'fatigue') j.fatigueJusqua = t + 4000;

    j.chants++;
    j.motif = (j.motif + 1) % MOTIFS.length;

    const evenements = [this.ev('chant', {
      userId, side: j.side, geste, cardId,
      quality: Number(quality.toFixed(3)), backfire,
    })];

    // Les charges d'un modificateur temporaire se consomment au chant.
    for (const e of j.effets) if (e.charges !== undefined && e.mods) e.charges--;
    nettoyerEffets(j, t);

    /* **La mise.** Elle se résout ici, au chant qui suit la carte, et pas
       ailleurs : c'est le seul endroit où l'on sait si le pari est gagné.
       Un geste au-dessus de la moitié double la poussée ; en dessous, la mise
       est perdue et coûte le souffle promis. Elle se consomme dans les deux
       cas — sinon on la garderait indéfiniment en attendant un bon geste, et
       ce ne serait plus un pari. */
    const mise = j.effets.find((e) => e.type === 'double_next' && e.fin > t);
    let facteur = 1;
    if (mise) {
      const gagne = !backfire && quality >= 0.5;
      facteur = gagne ? 2 : 1;
      if (!gagne) j.breath = Math.max(0, j.breath - (mise.valeur ?? 20));
      mise.fin = 0;                       // consommée, gagnée ou perdue
      evenements.push(this.ev('effect', { userId, type: 'double_next_resolu', gagne }));
    }

    /* La poussée vient de **la carte**, plus d'une constante. C'est toute la
       décision qu'on vient d'ajouter : un gros chant coûte plus et rend plus. */
    if (backfire) {
      const faux = { ...j, side: j.side ^ 1 };
      this.pousser(faux, card.power * 0.35, t, evenements);
    } else {
      this.pousser(j, card.power * quality * facteur, t, evenements);
    }
    return evenements;
  }

  /* -------------------------------------------------------------- carte */

  jouer(userId, cardId, t = now0()) {
    if (this.termine) throw new Cheat('duel_over');
    const j = this.joueur(userId);
    this.regen(j, t);

    if (!j.main.includes(cardId)) throw new Cheat('card_not_in_hand');
    if (aEffet(j, 'lock_actions', t)) throw new Cheat('actions_locked');

    const carte = ACTION_BY_ID.get(cardId);
    if (!carte) throw new Cheat('unknown_card');
    if ((j.cooldowns[cardId] ?? 0) > t) throw new Cheat('card_on_cooldown');

    // Conditions : mené au score, minute du vrai match.
    const c = carte.condition ?? {};
    if (c.mene && this.goals[j.side] + c.mene > this.goals[j.side ^ 1]) {
      throw new Cheat('condition_not_met');
    }
    if (c.minuteReelle && (this.fixture?.elapsed ?? 0) < c.minuteReelle) {
      throw new Cheat('condition_not_met');
    }
    // La Relève ne se joue que s'il reste un âge à atteindre. Le client le sait
    // déjà — l'état lui donne `stade` et `ages` — et grise la carte ; ce
    // contrôle est le filet. Il porte son propre code, parce que ce n'est pas
    // une tricherie mais une carte inutile dans cette main : le joueur doit
    // lire « son âge suivant n'est pas débloqué », pas « condition non
    // remplie ».
    if (c.evolution && !ageSuivant(j.fanzzy[j.actif])) {
      throw new Cheat('evolution_locked');
    }
    /* **La tournée** paie à la place du joueur.
     *
     * Elle est lue **avant** le contrôle de souffle, et c'est tout son intérêt :
     * elle permet de jouer une carte qu'on n'aurait pas les moyens de jouer.
     * Lue après, elle n'aurait fait qu'économiser du souffle qu'on avait déjà,
     * ce qui est ce que fait déjà `refill`. */
    const tournee = j.effets.find((e) => e.type === 'cost_free'
      && e.fin > t && (e.valeur ?? 0) > 0);
    const prix = tournee ? 0 : carte.cost;
    if (j.breath < prix) throw new Cheat('not_enough_breath');

    // Renvoi : la carte se retourne contre celui qui la joue.
    const adverses = [...this.joueurs.values()].filter((x) => x.side !== j.side);
    const miroir = adverses.map((a) => a.effets.find((e) => e.type === 'reflect' && e.charges > 0))
      .find(Boolean);

    j.breath -= prix;
    // Ce qu'on racontera après : quelles cartes ce joueur a réellement aimées.
    j.cartesJouees[cardId] = (j.cartesJouees[cardId] ?? 0) + 1;
    /* La tournée se décompte ici, une fois la carte réellement jouée : un
       refus plus haut — carte en recharge, condition non remplie — ne doit pas
       consommer une gratuité que le joueur n'a pas utilisée. */
    if (tournee) tournee.valeur--;
    j.cooldowns[cardId] = t + carte.cd * 1000;
    j.main = j.main.filter((x) => x !== cardId);
    j.defausse.push(cardId);
    // La carte suivante n'arrive pas tout de suite : jouer coûte aussi du choix.
    j.remplirA = t + RULES.refillMs;

    const evenements = [this.ev('action', { userId, side: j.side, cardId, famille: carte.fam })];

    if (miroir) {
      miroir.charges--;
      evenements.push(this.ev('reflected', { userId, cardId }));
      this.appliquer(adverses[0], carte, t, evenements);   // l'effet part chez l'autre
    } else {
      this.appliquer(j, carte, t, evenements);
    }

    if (carte.revers) this.appliquerEffet(j, carte.revers, t, evenements);
    return evenements;
  }

  /** Résolution d'une carte, famille par famille. */
  appliquer(j, carte, t, evenements) {
    const e = carte.effet ?? {};
    const adverses = [...this.joueurs.values()].filter((x) => x.side !== j.side);
    const allies = [...this.joueurs.values()].filter((x) => x.side === j.side);

    switch (e.type) {
      case 'push': {
        let v = e.valeur;
        if (e.doubleSiMene && this.goals[j.side] < this.goals[j.side ^ 1]) v *= 2;
        this.pousser(j, v, t, evenements);
        break;
      }
      case 'silence':
      case 'blind':
      case 'lock_actions':
        for (const a of adverses) poserEffet(a, { type: e.type, fin: t + e.duree });
        evenements.push(this.ev('effect', { cible: 'adverse', type: e.type, duree: e.duree }));
        break;

      case 'steal': {
        let total = 0;
        for (const a of adverses) {
          const pris = Math.min(e.valeur / adverses.length, a.breath);
          a.breath -= pris; total += pris;
        }
        j.breath = Math.min(RULES.breathMax, j.breath + total * (e.rendu ?? 0.6));
        evenements.push(this.ev('effect', { type: 'steal', valeur: Math.round(total) }));
        break;
      }
      case 'refill':
        j.breath = Math.min(RULES.breathMax,
          j.breath + (RULES.breathMax - j.breath) * (e.part ?? 0.5));
        evenements.push(this.ev('effect', { type: 'refill', userId: j.userId }));
        break;

      case 'team_breath':
        for (const a of allies) a.breath = Math.min(RULES.breathMax, a.breath + e.valeur);
        evenements.push(this.ev('effect', { type: 'team_breath', valeur: e.valeur }));
        break;

      case 'mod_self':
        poserEffet(j, { type: 'mod_self', mods: e.mods,
          fin: e.duree ? t + e.duree : undefined, charges: e.charges });
        evenements.push(this.ev('effect', { type: 'mod_self', userId: j.userId, mods: e.mods }));
        break;

      case 'mod_foe':
        for (const a of adverses) poserEffet(a, { type: 'mod_foe', mods: e.mods, fin: t + e.duree });
        evenements.push(this.ev('effect', { type: 'mod_foe', mods: e.mods }));
        break;

      case 'floor_quality':
        poserEffet(j, { type: 'floor_quality', valeur: e.valeur, charges: e.charges });
        break;

      case 'shield':
        poserEffet(j, { type: 'shield', valeur: e.valeur });
        evenements.push(this.ev('effect', { type: 'shield', userId: j.userId, valeur: e.valeur }));
        break;

      case 'reflect':
        poserEffet(j, { type: 'reflect', charges: e.charges ?? 1 });
        break;

      case 'rally':
        this.rallies.push({ side: j.side, fin: t + e.duree, bonus: e.bonus });
        evenements.push(this.ev('rally', { side: j.side, duree: e.duree, bonus: e.bonus }));
        break;

      case 'per_mate': {
        // Ne compte que les coéquipiers ayant chanté récemment : la carte
        // récompense une tribune qui pousse ensemble, pas un effectif.
        const actifs = allies.filter((a) => a.userId !== j.userId && t - a.dernierChant < e.fenetre);
        const v = e.valeur * actifs.length;
        if (v > 0) this.pousser(j, v, t, evenements);
        evenements.push(this.ev('effect', { type: 'per_mate', mates: actifs.length }));
        break;
      }
      case 'sync':
        this.rallies.push({ side: j.side, fin: t + e.duree, bonus: 1, sync: true, max: e.max });
        evenements.push(this.ev('sync', { side: j.side, duree: e.duree }));
        break;

      case 'swap_fanzzy':
        // Le changement lui-même est demandé ensuite : la carte ouvre le droit.
        poserEffet(j, { type: 'peut_changer', charges: 1 });
        evenements.push(this.ev('effect', { type: 'swap_ready', userId: j.userId }));
        break;

      /* Changement de chant : la main repart dans la pioche, on en reprend
         cinq. Ce qu'on défausse n'est pas perdu — sinon la carte punirait
         celui qui la joue, en vidant son deck pour le reste du duel. */
      case 'refill_hand': {
        j.pioche.push(...j.main);
        j.main = [];
        // Un mélange, sinon on retire exactement ce qu'on vient de rendre.
        for (let i = j.pioche.length - 1; i > 0; i--) {
          const k = Math.floor(Math.random() * (i + 1));
          [j.pioche[i], j.pioche[k]] = [j.pioche[k], j.pioche[i]];
        }
        j.main = j.pioche.splice(0, RULES.mainVisible);
        // La main est pleine tout de suite : c'est tout l'intérêt de la carte.
        j.remplirA = 0;
        evenements.push(this.ev('effect', { type: 'refill_hand', userId: j.userId,
          cartes: j.main.length }));
        break;
      }

      /* Nouveau souffle : toutes les recharges tombent. C'est la réponse au
         « pourquoi je ne peux jouer aucune de mes cartes » — une main pleine
         de cartes encore chaudes est une main vide, et rien ne permettait d'en
         sortir autrement qu'en attendant. */
      case 'clear_cooldowns': {
        const combien = Object.values(j.cooldowns).filter((fin) => fin > t).length;
        j.cooldowns = {};
        evenements.push(this.ev('effect', { type: 'clear_cooldowns', userId: j.userId,
          liberees: combien }));
        break;
      }

      /* Le tifo. Il ne pousse pas maintenant : il s'arme, tout le monde le
         voit, et il frappe plus tard. L'adversaire a le temps de répondre —
         c'est la première carte du jeu qui laisse ce temps-là. */
      case 'delayed_push':
        this.differes.push({ side: j.side, userId: j.userId,
          quand: t + e.delai, valeur: e.valeur });
        evenements.push(this.ev('arme', { userId: j.userId, side: j.side,
          delai: e.delai, cardId: carte.id }));
        break;

      /* --------------------------------------------- les cinq mécaniques neuves

         Elles ne sont pas des variantes : chacune agit sur une chose que rien
         d'autre ne touchait. Les vingt-quatre cartes d'origine se partageaient
         vingt et un types d'effet, donc en ajouter cinq de plus sans mécanique
         neuve aurait fait cinq cartes qu'on reconnaît en une partie et qu'on
         cesse de regarder à la deuxième. */

      /**
       * **L'ancre.** La corde cesse de retomber, pour tout le monde.
       *
       * C'est la seule carte qui touche à la décroissance, et c'est ce qui la
       * rend lisible : elle ne pousse pas, elle **garde**. Une tribune qui mène
       * de cent points et qui tient huit secondes de plus gagne autant qu'avec
       * une grosse poussée — sans avoir eu à réussir un geste.
       *
       * Posée sur la partie et non sur un joueur : la corde est commune, et un
       * gel qui ne vaudrait que pour un camp n'aurait aucun sens physique.
       */
      case 'freeze_decay':
        this.geleeJusqua = Math.max(this.geleeJusqua ?? 0, t + e.duree);
        evenements.push(this.ev('effect', { type: 'freeze_decay', duree: e.duree }));
        break;

      /**
       * **La mise.** Le prochain chant compte double — et s'il rate, il coûte.
       *
       * La seule carte du jeu qui puisse se retourner contre celui qui la joue
       * autrement qu'en souffle. C'est voulu : toutes les autres sont des gains
       * plus ou moins gros, et un paquet sans aucun pari se joue sans réfléchir.
       */
      case 'double_next':
        poserEffet(j, { type: 'double_next', fin: t + e.duree, valeur: e.gage ?? 20 });
        evenements.push(this.ev('effect', { userId: j.userId, type: 'double_next',
          duree: e.duree }));
        break;

      /**
       * **La tournée.** Les prochaines cartes ne coûtent rien.
       *
       * Elle ne donne pas de souffle — `refill` le fait déjà — elle en fait
       * gagner en le dépensant. Deux cartes chères jouées coup sur coup, ce
       * qu'aucun souffle ne permet normalement.
       */
      case 'cost_free':
        poserEffet(j, { type: 'cost_free', fin: t + (e.duree ?? 15_000), valeur: e.cartes ?? 2 });
        evenements.push(this.ev('effect', { userId: j.userId, type: 'cost_free',
          cartes: e.cartes ?? 2 }));
        break;

      /**
       * **Le long chant.** Une poussée étalée, et non un coup.
       *
       * `delayed_push` frappe une fois, plus tard. Celle-ci frappe un peu, dix
       * fois, pendant dix secondes : elle traverse un bouclier qui n'absorbe
       * qu'un coup, et elle se fait manger par la décroissance si l'adversaire
       * tient. Deux façons opposées de miser sur le temps.
       */
      case 'push_over_time': {
        const n = Math.max(1, e.coups ?? 10);
        const pas = (e.duree ?? 10_000) / n;
        for (let k = 1; k <= n; k++) {
          this.differes.push({ side: j.side, userId: j.userId,
            quand: t + k * pas, valeur: e.valeur / n });
        }
        evenements.push(this.ev('arme', { userId: j.userId, side: j.side,
          delai: pas, cardId: carte.id, coups: n }));
        break;
      }

      /**
       * **Le retournement.** L'écart est réduit de moitié, quel qu'il soit.
       *
       * Il ne renverse pas la corde — une carte qui échangerait les positions
       * ferait perdre une partie gagnée à celui qui a bien joué, et c'est la
       * définition d'un mauvais jeu. Elle efface la moitié du travail adverse,
       * ce qui est déjà la carte la plus violente du paquet : d'où son coût, sa
       * recharge, et son unicité.
       *
       * Elle n'agit **que si l'on est mené** : jouée en tête, elle réduirait
       * son propre avantage. Le filtre est ici et non dans le client, pour la
       * même raison que tout le reste — un client modifié la jouerait quand
       * même.
       */
      case 'halve_gap': {
        const mene = j.side === 0 ? this.rope > 0 : this.rope < 0;
        if (!mene) break;
        const avant = this.rope;
        this.rope /= 2;
        evenements.push(this.ev('effect', { type: 'halve_gap',
          valeur: Math.round(Math.abs(avant - this.rope)) }));
        break;
      }

      /**
       * La Relève. Contrairement au remplacement, elle ne demande aucun choix :
       * un personnage n'a qu'un âge suivant. On l'applique donc tout de suite,
       * pour que le moment tombe avec la carte plutôt qu'un aller-retour plus
       * tard — c'est le seul instant où le joueur regarde.
       *
       * Rien à recalculer ensuite : `modsDe` relit le Fanzzy actif à chaque
       * geste. Remplacer nom, cri et modificateurs suffit à ce que tout le
       * reste du moteur suive.
       */
      case 'evolve': {
        const f = j.fanzzy[j.actif];
        const suivant = ageSuivant(f);
        if (!suivant) break;          // filtré par la condition ; on ne casse rien
        f.stade = (f.stade ?? 1) + 1;
        /* Compté à part du remplacement : une relève fait grandir celui qui est
           déjà en tribune, un remplacement en fait entrer un autre. Les mêler
           donnerait un chiffre qui ne veut rien dire. */
        j.releves++;
        f.nom = suivant.nom;
        f.cri = suivant.cri;
        f.mods = suivant.mods;
        f.stage = suivant.stage;
        evenements.push(this.ev('evolve', {
          userId: j.userId, side: j.side, fanzzy: f.id,
          nom: f.nom, stade: f.stade,
          // Le client redessine le personnage : il lui faut de quoi le faire
          // sans redemander l'état complet au serveur.
          encore: Boolean(ageSuivant(f)),
        }));
        break;
      }

      default:
        break;
    }
  }

  appliquerEffet(j, revers, t, evenements) {
    if (revers.type === 'breath_mult') {
      poserEffet(j, { type: 'breath_mult', valeur: revers.valeur, fin: t + revers.duree });
      evenements.push(this.ev('effect', { type: 'breath_mult', userId: j.userId }));
    }
  }

  /* ------------------------------------------------------ changement */

  changer(userId, index, t = now0()) {
    const j = this.joueur(userId);
    const droit = j.effets.find((e) => e.type === 'peut_changer' && e.charges > 0);
    if (!droit) throw new Cheat('no_substitution');
    if (!j.fanzzy[index] || index === j.actif) throw new Cheat('bad_fanzzy');
    droit.charges--;
    nettoyerEffets(j, t);
    j.actif = index;
    j.changements++;
    // Un Fanzzy qu'on remonte une seconde fois n'est pas un participant de plus.
    if (!j.vus.includes(j.fanzzy[index].id)) j.vus.push(j.fanzzy[index].id);
    return [this.ev('swap', { userId, index, fanzzy: j.fanzzy[index].id })];
  }

  /* ------------------------------------------------------------- bilan */

  /**
   * Ce qui s'est passé, joueur par joueur.
   *
   * **Un duel ne laissait aucune trace de la façon dont il s'était joué.** Il
   * rendait un score et un vainqueur ; on ne pouvait donc rien dire au joueur
   * de ce qu'il venait de faire, et la fin d'un duel se résumait à un mot sur
   * un voile gris.
   *
   * Rien n'est calculé ici : tout est déjà compté pendant la partie, et cette
   * méthode ne fait que le mettre en forme. Elle est appelée une fois, à la
   * fermeture — ce qui la rend gratuite pendant les cinq minutes qui comptent.
   *
   * La carte préférée est celle qu'on a **jouée le plus souvent**, et non la
   * plus chère ou la plus décisive : c'est un souvenir, pas une analyse. À
   * égalité, la première rencontrée — il n'y a pas de départage qui vaille la
   * peine d'être expliqué.
   */
  bilan() {
    const par = (j) => {
      const paires = Object.entries(j.cartesJouees);
      const [prefId, prefN] = paires.reduce(
        (m, p) => (p[1] > m[1] ? p : m), [null, 0]);
      return {
        userId: j.userId, nom: j.nom, side: j.side,
        buts: this.goals[j.side],
        ferveur: j.ferveur,
        chants: j.chants,
        /* Le nombre de cartes **jouées**, pas le nombre de cartes différentes :
           c'est ce que le joueur a fait, pas ce qu'il possédait. */
        cartes: paires.reduce((n, p) => n + p[1], 0),
        preferee: prefId ? { id: prefId, fois: prefN } : null,
        /* Et le chant préféré, depuis que le duel en offre le choix. Il ne
           voulait rien dire tant que le geste était imposé : un joueur ne
           choisissait pas, il subissait une rotation. */
        chantPrefere: (() => {
          const [id, n] = Object.entries(j.chantsJoues)
            .reduce((m, p) => (p[1] > m[1] ? p : m), [null, 0]);
          return id ? { id, nom: CHANTS[id]?.nom ?? id, fois: n } : null;
        })(),
        changements: j.changements,
        releves: j.releves,
        /* Les Fanzzy réellement montés, avec le nom qu'ils portaient à la fin :
           un personnage qui a grandi pendant le duel n'a plus le même. */
        fanzzy: j.vus.map((id) => {
          const f = j.fanzzy.find((x) => x.id === id);
          return { id, nom: f?.nom ?? id, stade: f?.stade ?? 1 };
        }),
        /* Celui qui était en tribune au coup de sifflet. C'est lui que l'écran
           de fin met en avant, dans l'état du résultat. */
        dernier: j.fanzzy[j.actif]?.id ?? null,
        connecte: j.connecte,
        bot: String(j.userId).startsWith('bot:'),
      };
    };
    return {
      id: this.id, mode: this.mode,
      goals: [...this.goals],
      vainqueur: this.vainqueur,
      stade: this.stade ? { id: this.stade.id, nom: this.stade.nom } : null,
      dureeMs: Math.max(0, this.dernier - this.debut),
      joueurs: [...this.joueurs.values()].map(par),
    };
  }

  /* ---------------------------------------------------------- horloge */

  tick(t = now0()) {
    if (this.termine) return [];
    const evenements = [];
    const dt = (t - this.dernier) / 1000;
    this.dernier = t;

    /* L'ancre suspend la décroissance, pour les deux camps. La corde est
       commune : un gel qui ne vaudrait que d'un côté n'aurait aucun sens. */
    const retour = t < (this.geleeJusqua ?? 0) ? 0 : RULES.decayPerSec * dt;
    if (this.rope > 0) this.rope = Math.max(0, this.rope - retour);
    else if (this.rope < 0) this.rope = Math.min(0, this.rope + retour);

    for (const j of this.joueurs.values()) {
      this.regen(j, t);
      nettoyerEffets(j, t);
      // Remplacement des cartes jouées, une fois le délai passé.
      if (j.remplirA && t >= j.remplirA && j.main.length < RULES.mainVisible) {
        if (!j.pioche.length) { j.pioche = j.defausse.splice(0); }
        const c = j.pioche.shift();
        if (c) { j.main.push(c); evenements.push(this.ev('draw', { userId: j.userId, cardId: c })); }
        j.remplirA = j.main.length < RULES.mainVisible ? t + RULES.refillMs : null;
      }
    }
    this.rallies = this.rallies.filter((r) => r.fin > t);

    /* Les poussées armées qui arrivent à échéance. Elles passent par le même
       `pousser` que tout le reste — bouclier adverse compris : un tifo qu'on
       a vu venir pendant huit secondes doit pouvoir être bâché. */
    const dus = this.differes.filter((d) => d.quand <= t);
    if (dus.length) {
      this.differes = this.differes.filter((d) => d.quand > t);
      for (const d of dus) {
        const j = this.joueurs.get(d.userId);
        if (!j) continue;            // il a quitté : le tifo tombe avec lui
        evenements.push(this.ev('deplie', { userId: d.userId, side: d.side }));
        this.pousser(j, d.valeur, t, evenements);
      }
    }

    if (t >= this.fin) {
      const [a, b] = this.goals;
      const v = a === b ? (this.rope < 0 ? 0 : this.rope > 0 ? 1 : null) : (a > b ? 0 : 1);
      this.finir(v, 'temps', evenements);
    }
    return evenements;
  }

  /* --------------------------------------------------------- snapshot */

  vue(userId) {
    const moi = this.joueurs.get(userId);
    const t = now0();
    const equipe = (side) => [...this.joueurs.values()].filter((j) => j.side === side).map((j) => ({
      userId: j.userId, nom: j.nom, ferveur: j.ferveur, connecte: j.connecte,
      fanzzy: j.fanzzy[j.actif]?.id,
      // Le souffle des autres est visible : c'est une information de jeu.
      breath: Math.round(j.breath),
    }));
    const aveugle = moi ? aEffet(moi, 'blind', t) : false;

    return {
      id: this.id, mode: this.mode, fixture: this.fixture,
      /* Le lieu. Le client en tire le décor de la corde, et sa phrase d'effet :
         un stade qui change les règles sans le dire est un stade qui donne
         l'impression que le jeu triche. */
      /* Les cinq chants offerts, décrits et non seulement nommés — exactement
         comme les envoie le Virage. La page n'a pas à connaître la table des
         chants : le jour où l'un change de coût, les deux écrans suivent sans
         déploiement du client. */
      chants: this.repertoire.map((id) => ({ id, ...CHANTS[id] })),
      stade: this.stade
        ? { id: this.stade.id, nom: this.stade.nom, effet: this.stade.effet }
        : null,
      rope: Math.round(this.rope), goals: [...this.goals],
      resteMs: Math.max(0, this.fin - t),
      termine: this.termine, vainqueur: this.vainqueur,
      equipes: [equipe(0), equipe(1)],
      seq: this.seq,
      moi: moi ? {
        side: moi.side,
        breath: Math.round(moi.breath),
        ferveur: moi.ferveur,
        // Aveuglé : le joueur ne voit plus sa propre main, il joue de mémoire.
        main: aveugle ? [] : moi.main,
        aveugle,
        // Recalculée à chaque vue, et non une fois pour toutes : le Métronome
        // et le Vent de face changent la fenêtre en cours de partie, et
        // l'affichage doit suivre le barème sous peine de mentir au joueur.
        gestes: resoudreGeste(modsDe(moi, t, this.stade), { motif: moi.motif }),
        /* Le geste de son Fanzzy. Il ne décide plus de rien — c'est la carte
           choisie qui porte le geste — mais il reste affiché : c'est la
           spécialité du personnage, et savoir laquelle aide à choisir. */
        sienGeste: moi.fanzzy[moi.actif]?.cri?.gest ?? 'tempo',
        fanzzy: moi.fanzzy.map((f, i) => ({ ...f, actif: i === moi.actif })),
        cooldowns: Object.fromEntries(Object.entries(moi.cooldowns)
          .filter(([, fin]) => fin > t).map(([k, fin]) => [k, Math.round((fin - t) / 100) / 10])),
        effets: moi.effets.map((e) => ({ type: e.type, reste: e.fin ? e.fin - t : null })),
      } : null,
    };
  }
}
