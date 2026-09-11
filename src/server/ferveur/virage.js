import { grade, applyHeroMods, resoudreGeste, Cheat } from './gestures.js';
import { ACTION_BY_ID, ACTIONS_VIRAGE, dansLeVirage } from '../../shared/duel/actions.js';
import { stadeDeLaRencontre } from '../../shared/stades.js';
import { poserEffet, nettoyerEffets, modsAvecEffets } from '../../shared/duel/effets.js';

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

/** La minute où placer un changement de période, faute que l'API en donne une. */
const MINUTE_DE_PERIODE = { '1H': 0, HT: 45, '2H': 45, ET: 90, BT: 90, P: 120, FT: 90, AET: 120, PEN: 120 };

export const RULES = {
  goalAt: 400,             // corde à ±400 : un but de jeu demande un effort collectif
  decayPerSec: 3,
  breathMax: 100,
  breathPerSec: 13,
  surgeAfterRealGoalMs: 60_000,
  surgeFactor: 2,
  tickMs: 100,             // diffusion 10 fois par seconde
  broadcastEveryTicks: 1,
  idleMs: 90_000,          // sans geste, on ne compte plus dans la foule
  realGoalJolt: 90,

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
};

const CARDS = {
  reprise:   { gest: 'tempo', cost: 22, power: 26 },
  roulement: { gest: 'mash',  cost: 26, power: 30 },
  onetaitla: { gest: 'hold',  cost: 30, power: 34 },
  mur:       { gest: 'tempo', cost: 38, power: 46 },
  craquage:  { gest: 'mash',  cost: 34, power: 52, effect: 'fatigue' },
};

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

/** Une foule deux fois plus nombreuse pèse 18 % de plus, pas 100 %. */
export function crowdFactor(n) {
  return 1 + 0.18 * Math.log2(Math.max(1, n / 100));
}

export class VirageRoom {
  /**
   * @param fixture {id, homeId, awayId, homeName, awayName, leagueId, kickoffAt}
   */
  constructor({ fixture, emit, onPush, onGoal, log = console }) {
    this.fixture = fixture;
    this.emit = emit;                 // (event, payload) => void, vers la salle
    this.onPush = onPush;             // enregistrement de présence
    this.onGoal = onGoal;             // but de jeu (pas le but réel)
    this.log = log;

    this.rope = 0;                    // <0 = domicile mène, >0 = extérieur
    this.goals = [0, 0];
    this.realGoals = [0, 0];
    this.surgeUntil = 0;
    this.members = new Map();         // userId -> état du supporter
    this.rallies = [];                // fenêtres collectives ouvertes, par camp
    this.seq = 0;
    this.last = Date.now();
    this.dirty = false;

    /* Le fil, et le vrai match derrière lui.
       `scoreReel` et `statut` ne se déduisent pas du fil : une salle ouverte à
       la trente-quatrième minute doit afficher 1–0 tout de suite, sans avoir
       vu le but tomber. Ils sont donc portés à part, et semés à la création. */
    this.fil = [];
    this.rang = 0;                    // départage deux entrées de même minute
    this.scoreReel = [fixture.homeGoals ?? 0, fixture.awayGoals ?? 0];
    this.statut = fixture.status ?? null;
    this.minute = fixture.elapsed ?? null;
    /* Le temps additionnel, et l'instant où le serveur a vu tout ça.
       Sans `vuA`, la page fait courir son horloge à partir du moment où *elle*
       a reçu la donnée — et une donnée vieille d'un quart d'heure repart alors
       de zéro, ce qui est exactement ce qui laissait des matchs finis à
       « 90' EN DIRECT ». */
    this.minuteExtra = fixture.elapsedExtra ?? null;
    this.vuA = fixture.vuA ?? Date.now();
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
  join(userId, { side, name, mods = {}, neutre = false, perso = null, actions = [] }) {
    const m = this.members.get(userId) ?? {
      side: side ? 1 : 0, name, mods, neutre, perso,
      userId,
      breath: 40, ferveur: 0, lastPush: 0, fatigueUntil: 0, joined: Date.now(),
      /* La main. Mêmes règles qu'au duel : cinq visibles, la suivante n'arrive
         pas tout de suite. Ce qui n'est pas dans la main est dans la pioche. */
      pioche: [], main: [], defausse: [], cooldowns: {}, effets: [], remplirA: 0,
      dernierChant: 0,
    };
    m.side = side ? 1 : 0;
    m.name = name;
    m.mods = mods;
    m.perso = perso;
    // `neutre` : il soutient un club qu'il ne suit pas. Sa ferveur vaut moitié.
    m.neutre = neutre;

    /* Le deck n'est monté qu'à la première entrée. Rejoindre à nouveau — un
       réseau qui saute, un onglet rouvert — ne doit pas redistribuer la main :
       ce serait un moyen gratuit de se débarrasser d'un temps de recharge. */
    if (!m.main.length && !m.pioche.length && !m.defausse.length && actions.length) {
      const jouables = actions.map((a) => (typeof a === 'string' ? a : a?.id))
        .filter((id) => dansLeVirage(ACTION_BY_ID.get(id)));
      m.pioche = melanger(jouables);
      m.main = m.pioche.splice(0, RULES.mainVisible);
    }

    this.members.set(userId, m);
    this.dirty = true;
    return this.snapshotFor(userId);
  }

  leave(userId) {
    this.members.delete(userId);
    this.dirty = true;
  }

  /** Les actifs : ceux qui ont poussé récemment. Une app ouverte ne compte pas. */
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
    this.regen(m, now);
    nettoyerEffets(m, now);
    if (m.breath < card.cost) throw new Cheat('not_enough_breath');

    /* Les modificateurs du moment : ceux du Fanzzy et du KOP, plus ceux que
       les cartes ont posés. Sans cette ligne, le Métronome et le Second
       souffle coûtaient du souffle et ne changeaient rien au geste — une
       carte qu'on joue et qui ne fait rien est pire qu'une carte absente. */
    const mods = modsAvecEffets(m.mods, m.effets, now);

    // La note est calculée ici, à partir des instants de frappe.
    const brut = grade(card.gest, taps, mods);
    let { quality, backfire } = applyHeroMods(brut, mods);

    /* Second souffle : un geste raté compte comme moyen, une fois. La charge
       se consomme sur le raté, pas sur le prochain geste quel qu'il soit —
       sinon la carte se dépenserait sur un chant déjà réussi. */
    const plancher = (m.effets ?? []).find((e) => e.type === 'floor_quality' && e.charges > 0);
    if (plancher && quality < plancher.valeur) {
      quality = plancher.valeur;
      backfire = false;
      plancher.charges--;
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
      * (mods.pushMult ?? 1) * rally;

    // Divisée par l'effectif : le nombre aide, il ne décide pas.
    const perCapita = amount / Math.max(1, n[m.side]);
    const signed = (backfire ? -1 : 1) * (m.side === 0 ? -perCapita : perCapita);
    this.rope = clamp(this.rope + signed, -RULES.goalAt, RULES.goalAt);
    // `ferveurBonus` : ce qui compte au classement. Séparé de la corde
    // exprès — un KOP peut vouloir peser sur le match sans peser sur le
    // classement, et l’inverse.
    m.ferveur += Math.round(Math.max(0, perCapita) * (mods.ferveurBonus ?? 1)
      * (m.neutre ? RULES.ferveurNeutre : 1));
    this.dirty = true;

    // Présence : c'est ce que consulteront les cartes-souvenirs au prochain but.
    this.onPush?.({ userId, fixtureId: this.fixture.id, side: m.side,
      fanzzyId: m.mods.id ?? null, amount: perCapita }).catch?.(() => {});

    if (Math.abs(this.rope) >= RULES.goalAt) this.scoreGoal(this.rope > 0 ? 1 : 0);

    return { quality: Number(quality.toFixed(3)), backfire, breath: Math.round(m.breath),
             ferveur: m.ferveur, push: Math.round(perCapita) };
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
    const amount = valeur * surge * crowdFactor(n) * (m.mods.pushMult ?? 1);
    const perCapita = amount / n;
    const signed = m.side === 0 ? -perCapita : perCapita;
    this.rope = clamp(this.rope + signed, -RULES.goalAt, RULES.goalAt);
    m.ferveur += Math.round(Math.max(0, perCapita) * (m.mods.ferveurBonus ?? 1)
      * (m.neutre ? RULES.ferveurNeutre : 1));
    this.dirty = true;
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
    if ((m.cooldowns[cardId] ?? 0) > now) throw new Cheat('card_on_cooldown');

    const c = carte.condition ?? {};
    /* « Mené d'au moins un but » se lit sur le **vrai match**, pas sur la
       corde. La Remontada raconte une équipe qui court après le score : la
       jouer parce que la corde penche n'aurait aucun sens dans une salle où
       la corde bouge dix fois par seconde. */
    if (c.mene) {
      const mien = this.realGoals[m.side] ?? 0;
      const autre = this.realGoals[m.side ^ 1] ?? 0;
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
    if (m.breath < carte.cost) throw new Cheat('not_enough_breath');

    m.breath -= carte.cost;
    m.cooldowns[cardId] = now + carte.cd * 1000 * RULES.cardCooldownMult;
    m.main = m.main.filter((x) => x !== cardId);
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

      /* Ces deux-là n'ont pas d'objet ici : le Virage ne met qu'un personnage
         en tribune et n'a pas de banc. On le dit au lieu de les laisser tomber
         en silence — un cas manquant dans ce `switch` serait une carte qui
         coûte du souffle et ne fait rien. */
      case 'swap_fanzzy':
      case 'evolve':
        evenements.push({ t: 'effect', type: 'sans_objet', userId });
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
      m.breath + RULES.breathPerSec * dt * mult * (m.mods.breathBonus ?? 1));
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
   */
  realGoal({ teamId, minute, player, assist = null, score = null }) {
    const side = teamId === this.fixture.homeId ? 0 : 1;
    this.realGoals[side]++;
    // Le score du vrai match vient du relevé quand il l'accompagne : le
    // compter ici à partir des buts vus donnerait 1–0 à qui entre à la
    // soixantième minute d'un 3–2.
    if (Array.isArray(score) && score.length === 2) this.scoreReel = [...score];
    else this.scoreReel[side]++;
    if (minute != null) this.minute = minute;
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
    });
    if (Math.abs(this.rope) >= RULES.goalAt) this.scoreGoal(this.rope > 0 ? 1 : 0);
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
                homeGoals = null, awayGoals = null } = {}) {
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

    if (elapsed != null) this.minute = elapsed;
    this.minuteExtra = elapsedExtra;
    // Le relevé vient de voir le match : l'horloge de la page repart de là, et
    // non de l'instant où elle a reçu le message.
    this.vuA = Date.now();
    if (homeGoals != null && awayGoals != null) this.scoreReel = [homeGoals, awayGoals];
    const change = status && status !== this.statut;
    if (status) this.statut = status;

    if (bouge || change) {
      this.push('virage:match', {
        scoreReel: this.scoreReel, minute: this.minute,
        minuteExtra: this.minuteExtra, statut: this.statut, vuA: this.vuA,
      });
    }
    if (!change) return [];
    return this.ajouterAuFil([this.entreePeriode(status)]);
  }

  /* ------------------------------------------------------------ horloge */

  tick(now = Date.now()) {
    const dt = (now - this.last) / 1000;
    this.last = now;

    const back = RULES.decayPerSec * dt;
    if (this.rope > 0) this.rope = Math.max(0, this.rope - back);
    else if (this.rope < 0) this.rope = Math.min(0, this.rope + back);

    for (const m of this.members.values()) this.regen(m, now);
    /* Les cartes s'entretiennent au tour d'horloge, pas au geste : une main se
       remplit et une recharge se termine même pour quelqu'un qui a posé son
       téléphone. */
    this.entretenirCartes(now);

    if (!this.dirty) return;
    this.dirty = false;
    const n = this.crowd();
    this.push('virage:tick', {
      rope: Math.round(this.rope),
      goals: this.goals,
      crowd: n,
      surge: now < this.surgeUntil,
    });
  }

  push(event, payload) {
    this.emit(event, { ...payload, seq: ++this.seq });
  }

  /* --------------------------------------------------------- snapshots */

  /** Classement d'un supporter dans sa tribune. C'est son vrai enjeu. */
  rankOf(userId) {
    const m = this.members.get(userId);
    if (!m) return null;
    const meme = [...this.members.values()].filter((x) => x.side === m.side);
    meme.sort((a, b) => b.ferveur - a.ferveur);
    return { rank: meme.indexOf(m) + 1, of: meme.length, ferveur: m.ferveur };
  }

  snapshotFor(userId) {
    const m = this.members.get(userId);
    const n = this.crowd();
    return {
      fixture: this.fixture,
      rope: Math.round(this.rope),
      goals: this.goals,
      realGoals: this.realGoals,
      crowd: n,
      surge: Date.now() < this.surgeUntil,
      surgeUntil: this.surgeUntil,
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
        regen: RULES.breathPerSec * (m.mods.breathBonus ?? 1),
        breathMax: RULES.breathMax,
        // Le client doit afficher le geste exactement comme le serveur le
        // note. Sans ça il dessinait la pulsation de base et le porteur
        // d'équipement tapait à côté sans jamais comprendre pourquoi.
        // Le geste tel qu'il sera **vraiment** noté : effets de cartes compris,
        // sinon le Métronome élargirait la fenêtre sans que la page le dessine.
        gestes: resoudreGeste(modsAvecEffets(m.mods, m.effets, Date.now())),

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
        ...this.rankOf(userId),
      } : null,
      cards: Object.entries(CARDS).map(([id, c]) => ({ id, ...c })),

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
      stade: stadeDeLaRencontre([], this.fixture.id),
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
