import { grade, applyHeroMods, Cheat } from './gestures.js';

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
    const amount = card.power * quality * surge * crowdFactor(Math.max(1, n[m.side]));

    // Divisée par l'effectif : le nombre aide, il ne décide pas.
    const perCapita = amount / Math.max(1, n[m.side]);
    const signed = (backfire ? -1 : 1) * (m.side === 0 ? -perCapita : perCapita);
    this.rope = clamp(this.rope + signed, -RULES.goalAt, RULES.goalAt);
    m.ferveur += Math.round(Math.max(0, perCapita));
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
    this.onGoal?.({ fixtureId: this.fixture.id, side, goals: this.goals });
  }

  /* ---------------------------------------------------------- but réel */

  /**
   * Un but dans le vrai match. Il secoue la corde du côté qui a marqué et
   * ouvre une minute où tout compte double : c'est le moment où le joueur
   * ouvre son téléphone, et il doit valoir le déplacement.
   */
  realGoal({ teamId, minute, player }) {
    const side = teamId === this.fixture.homeId ? 0 : 1;
    this.realGoals[side]++;
    const jolt = RULES.realGoalJolt * (side === 0 ? -1 : 1);
    this.rope = clamp(this.rope + jolt, -RULES.goalAt, RULES.goalAt);
    this.surgeUntil = Date.now() + RULES.surgeAfterRealGoalMs;
    this.dirty = true;
    this.push('virage:real_goal', {
      side, teamId, minute, player,
      realGoals: this.realGoals,
      surgeUntil: this.surgeUntil,
    });
    if (Math.abs(this.rope) >= RULES.goalAt) this.scoreGoal(this.rope > 0 ? 1 : 0);
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
      you: m ? {
        side: m.side,
        breath: Math.round(m.breath),
        ...this.rankOf(userId),
      } : null,
      cards: Object.entries(CARDS).map(([id, c]) => ({ id, ...c })),
    };
  }

  get size() { return this.members.size; }
}

export { CARDS };
