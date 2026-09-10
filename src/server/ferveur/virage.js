import { grade, applyHeroMods, resoudreGeste, Cheat } from './gestures.js';

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
};

const CARDS = {
  reprise:   { gest: 'tempo', cost: 22, power: 26 },
  roulement: { gest: 'mash',  cost: 26, power: 30 },
  onetaitla: { gest: 'hold',  cost: 30, power: 34 },
  mur:       { gest: 'tempo', cost: 38, power: 46 },
  craquage:  { gest: 'mash',  cost: 34, power: 52, effect: 'fatigue' },
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

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

  join(userId, { side, name, mods = {} }) {
    const m = this.members.get(userId) ?? {
      side: side ? 1 : 0, name, mods,
      breath: 40, ferveur: 0, lastPush: 0, fatigueUntil: 0, joined: Date.now(),
    };
    m.side = side ? 1 : 0;
    m.name = name;
    m.mods = mods;
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
    if (m.breath < card.cost) throw new Cheat('not_enough_breath');

    // La note est calculée ici, à partir des instants de frappe.
    const brut = grade(card.gest, taps, m.mods);
    const { quality, backfire } = applyHeroMods(brut, m.mods);

    m.breath -= card.cost;
    m.lastPush = now;
    if (card.effect === 'fatigue') m.fatigueUntil = now + 4000;

    const surge = now < this.surgeUntil ? RULES.surgeFactor : 1;
    const n = this.crowd();
    /* `pushMult` : la corde. Un bonus de KOP passe par cette clé, comme la
       carte « Prolongations » du duel — même vocabulaire, même endroit. Le
       moteur ne sait pas d’où vient le modificateur, et c’est ce qui permet
       à un KOP de peser sur une mécanique sans la connaître. */
    const amount = card.power * quality * surge * crowdFactor(Math.max(1, n[m.side]))
      * (m.mods.pushMult ?? 1);

    // Divisée par l'effectif : le nombre aide, il ne décide pas.
    const perCapita = amount / Math.max(1, n[m.side]);
    const signed = (backfire ? -1 : 1) * (m.side === 0 ? -perCapita : perCapita);
    this.rope = clamp(this.rope + signed, -RULES.goalAt, RULES.goalAt);
    // `ferveurBonus` : ce qui compte au classement. Séparé de la corde
    // exprès — un KOP peut vouloir peser sur le match sans peser sur le
    // classement, et l’inverse.
    m.ferveur += Math.round(Math.max(0, perCapita) * (m.mods.ferveurBonus ?? 1));
    this.dirty = true;

    // Présence : c'est ce que consulteront les cartes-souvenirs au prochain but.
    this.onPush?.({ userId, fixtureId: this.fixture.id, side: m.side,
      fanzzyId: m.mods.id ?? null, amount: perCapita }).catch?.(() => {});

    if (Math.abs(this.rope) >= RULES.goalAt) this.scoreGoal(this.rope > 0 ? 1 : 0);

    return { quality: Number(quality.toFixed(3)), backfire, breath: Math.round(m.breath),
             ferveur: m.ferveur, push: Math.round(perCapita) };
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
  matchStatus({ status = null, elapsed = null, homeGoals = null, awayGoals = null } = {}) {
    if (elapsed != null) this.minute = elapsed;
    if (homeGoals != null && awayGoals != null) this.scoreReel = [homeGoals, awayGoals];
    const change = status && status !== this.statut;
    if (status) this.statut = status;
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
      you: m ? {
        side: m.side,
        breath: Math.round(m.breath),
        // Le client doit afficher le geste exactement comme le serveur le
        // note. Sans ça il dessinait la pulsation de base et le porteur
        // d'équipement tapait à côté sans jamais comprendre pourquoi.
        gestes: resoudreGeste(m.mods),
        ...this.rankOf(userId),
      } : null,
      cards: Object.entries(CARDS).map(([id, c]) => ({ id, ...c })),
    };
  }

  get size() { return this.members.size; }
}

export { CARDS };
