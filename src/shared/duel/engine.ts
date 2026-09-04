import { Rng } from './rng.js';
import { cardDef } from './cards.js';
import type {
  Ambiance, CardInstance, DuelEvent, FieldGroup, Intent, PublicPlayer, Side, Snapshot,
} from './protocol.js';

/* ------------------------------------------------------------- constantes */

export const RULES = {
  turnMs: 45_000,
  promoteMs: 20_000,
  minutesPerTurn: 5,
  fullTime: 90,
  goalsToWin: 3,
  benchMax: 3,
  handStart: 5,
  deckSize: 20,
  weaknessBonus: 20,
} as const;

/* ------------------------------------------------------------------ état */

export interface PlayerState {
  id: string;
  name: string;
  score: number;
  deck: CardInstance[];
  hand: CardInstance[];
  discard: string[];
  active: FieldGroup | null;
  bench: FieldGroup[];
  ambiances: Ambiance[];
}

export interface DuelState {
  id: string;
  seed: string;
  seq: number;
  minute: number;
  turn: Side;
  turnIndex: number;
  phase: 'playing' | 'ko_promote' | 'over';
  promoteSide: Side | null;
  pendingEndTurn: boolean;
  souffleAvailable: Ambiance | null;
  attached: boolean;
  deadline: number;
  players: [PlayerState, PlayerState];
  winner: Side | 'draw' | null;
  reason: 'goals' | 'time' | 'deck_out' | 'surrender' | 'timeout' | null;
  rng: Rng;
}

export type Ok = { ok: true; events: DuelEvent[] };
export type Err = { ok: false; code: string };
export type Result = Ok | Err;

const other = (s: Side): Side => (s === 0 ? 1 : 0);
/** Lecture non narrowée de la phase : koCheck et finish la modifient au vol. */
const phaseOf = (st: DuelState): DuelState['phase'] => st.phase;
const err = (code: string): Err => ({ ok: false, code });

/* -------------------------------------------------------------- création */

let uidSeq = 0;
const uid = () => `u${(++uidSeq).toString(36)}${Date.now().toString(36).slice(-4)}`;

function makeGroup(card: CardInstance): FieldGroup {
  return { uid: card.uid, cardId: card.cardId, damage: 0, souffle: [], shield: 0, blockedRetreat: false };
}

function buildPlayer(id: string, name: string, deckCardIds: string[], rng: Rng): PlayerState {
  const deck = rng.shuffle(deckCardIds.map((cardId) => ({ uid: uid(), cardId })));
  const ambiances = [...new Set(deckCardIds.map((c) => cardDef(c).type))];
  return { id, name, score: 0, deck, hand: [], discard: [], active: null, bench: [], ambiances };
}

export function createDuel(
  duelId: string,
  a: { id: string; name: string; deck: string[] },
  b: { id: string; name: string; deck: string[] },
  seed: string,
  now: number,
): { state: DuelState; events: DuelEvent[] } {
  const rng = new Rng(seed);
  const state: DuelState = {
    id: duelId,
    seed,
    seq: 0,
    minute: 0,
    turn: rng.int(2) as Side,
    turnIndex: 0,
    phase: 'playing',
    promoteSide: null,
    pendingEndTurn: false,
    souffleAvailable: null,
    attached: false,
    deadline: now + RULES.turnMs,
    players: [buildPlayer(a.id, a.name, a.deck, rng), buildPlayer(b.id, b.name, b.deck, rng)],
    winner: null,
    reason: null,
    rng,
  };

  const events: DuelEvent[] = [];
  // Mise en place : 5 cartes en main, le premier groupe pioché prend la tribune.
  for (const side of [0, 1] as Side[]) {
    const p = state.players[side];
    for (let i = 0; i < RULES.handStart; i++) {
      const c = p.deck.shift();
      if (c) p.hand.push(c);
    }
    const first = p.hand.shift();
    if (!first) throw new Error('deck vide au démarrage');
    p.active = makeGroup(first);
    events.push({ t: 'draw', side, count: RULES.handStart });
    events.push({ t: 'promoted', side, uid: first.uid, cardId: first.cardId });
  }
  events.push(...startTurn(state, now, true));
  return { state, events };
}

/* ----------------------------------------------------------------- tours */

function drawSouffle(state: DuelState): Ambiance {
  const p = state.players[state.turn];
  return state.rng.pick(p.ambiances);
}

function startTurn(state: DuelState, now: number, first = false): DuelEvent[] {
  const events: DuelEvent[] = [];
  const side = state.turn;
  const p = state.players[side];

  if (p.deck.length === 0) {
    return [...finish(state, other(side), 'deck_out')];
  }
  const card = p.deck.shift()!;
  p.hand.push(card);

  state.attached = false;
  state.souffleAvailable = drawSouffle(state);
  state.deadline = now + RULES.turnMs;
  if (p.active) p.active.blockedRetreat = false;
  if (!first) state.turnIndex++;

  events.push({
    t: 'turn_start', side, minute: state.minute,
    deadline: state.deadline, souffle: state.souffleAvailable,
  });
  events.push({ t: 'draw', side, count: 1, card });
  return events;
}

function endTurn(state: DuelState, now: number): DuelEvent[] {
  if (state.phase === 'over') return [];
  state.minute += RULES.minutesPerTurn;
  if (state.minute >= RULES.fullTime) {
    const [a, b] = [state.players[0].score, state.players[1].score];
    const winner: Side | 'draw' = a === b ? 'draw' : a > b ? 0 : 1;
    return [{ t: 'whistle', minute: state.minute }, ...finish(state, winner, 'time')];
  }
  state.turn = other(state.turn);
  return startTurn(state, now);
}

function finish(state: DuelState, winner: Side | 'draw', reason: 'goals' | 'time' | 'deck_out' | 'surrender' | 'timeout'): DuelEvent[] {
  state.phase = 'over';
  state.winner = winner;
  state.reason = reason;
  state.deadline = 0;
  return [{ t: 'over', winner, reason }];
}

/* ------------------------------------------------------------- résolution */

function payCost(group: FieldGroup, cost: readonly ('any' | Ambiance)[]): boolean {
  const pool = [...group.souffle];
  for (const c of cost) {
    if (c === 'any') continue;
    const i = pool.indexOf(c);
    if (i === -1) return false;
    pool.splice(i, 1);
  }
  // Les coûts "any" consomment ce qu'il reste.
  const anyCount = cost.filter((c) => c === 'any').length;
  return pool.length >= anyCount;
}

function koCheck(state: DuelState, victim: Side, now: number): DuelEvent[] {
  const p = state.players[victim];
  const g = p.active;
  if (!g) return [];
  if (g.damage < cardDef(g.cardId).frv) return [];

  const events: DuelEvent[] = [];
  p.active = null;
  p.discard.push(g.cardId);
  events.push({ t: 'ko', side: victim, uid: g.uid, cardId: g.cardId });

  const scorer = other(victim);
  state.players[scorer].score++;
  events.push({
    t: 'goal', side: scorer,
    score: [state.players[0].score, state.players[1].score],
  });

  if (state.players[scorer].score >= RULES.goalsToWin) {
    return [...events, ...finish(state, scorer, 'goals')];
  }
  if (p.bench.length === 0) {
    return [...events, ...finish(state, scorer, 'goals')];
  }
  state.phase = 'ko_promote';
  state.promoteSide = victim;
  state.deadline = now + RULES.promoteMs;
  events.push({ t: 'promote_required', side: victim });
  return events;
}

/* ------------------------------------------------------------- intentions */

export function applyIntent(state: DuelState, side: Side, intent: Intent, now: number): Result {
  if (state.phase === 'over') return err('error.duel_over');

  if (intent.t === 'surrender') {
    return { ok: true, events: finish(state, other(side), 'surrender') };
  }

  if (state.phase === 'ko_promote') {
    if (intent.t !== 'promote') return err('error.promote_first');
    if (side !== state.promoteSide) return err('error.not_your_turn');
    return doPromote(state, side, intent.benchUid, now);
  }

  if (side !== state.turn) return err('error.not_your_turn');
  const me = state.players[side];
  const foe = state.players[other(side)];

  switch (intent.t) {
    case 'play_support': {
      if (me.bench.length >= RULES.benchMax) return err('error.bench_full');
      const i = me.hand.findIndex((c) => c.uid === intent.uid);
      if (i === -1) return err('error.card_not_in_hand');
      const [card] = me.hand.splice(i, 1);
      me.bench.push(makeGroup(card));
      return { ok: true, events: [{ t: 'support_played', side, uid: card.uid, cardId: card.cardId }] };
    }

    case 'attach_souffle': {
      if (state.attached) return err('error.souffle_spent');
      if (!state.souffleAvailable) return err('error.no_souffle');
      const g = findGroup(me, intent.targetUid);
      if (!g) return err('error.group_not_found');
      g.souffle.push(state.souffleAvailable);
      state.attached = true;
      const ev: DuelEvent = { t: 'souffle_attached', side, uid: g.uid, ambiance: state.souffleAvailable };
      state.souffleAvailable = null;
      return { ok: true, events: [ev] };
    }

    case 'retreat': {
      const g = me.active;
      if (!g) return err('error.no_active');
      if (g.blockedRetreat) return err('error.retreat_blocked');
      const i = me.bench.findIndex((b) => b.uid === intent.benchUid);
      if (i === -1) return err('error.group_not_found');
      const cost = cardDef(g.cardId).retreat;
      if (g.souffle.length < cost) return err('error.retreat_too_costly');
      g.souffle.splice(0, cost);
      const [incoming] = me.bench.splice(i, 1);
      me.bench.push(g);
      me.active = incoming;
      return { ok: true, events: [{ t: 'retreated', side, inUid: incoming.uid, outUid: g.uid }] };
    }

    case 'chant': {
      if (state.turnIndex === 0) return err('error.no_chant_first_turn');
      const g = me.active;
      if (!g) return err('error.no_active');
      const target = foe.active;
      if (!target) return err('error.no_target');
      const chant = cardDef(g.cardId).chants.find((c) => c.id === intent.chantId);
      if (!chant) return err('error.unknown_chant');
      if (!payCost(g, chant.cost)) return err('error.not_enough_souffle');

      const events: DuelEvent[] = [];
      let power = chant.power;
      const e = chant.effect;

      if (e?.kind === 'bonus_if_leading' && me.score > foe.score) {
        power += e.amount;
        events.push({ t: 'effect', side, kind: e.kind, amount: e.amount });
      }
      if (e?.kind === 'bonus_late' && state.minute >= e.fromMinute) {
        power += e.amount;
        events.push({ t: 'effect', side, kind: e.kind, amount: e.amount });
      }

      const weak = cardDef(target.cardId).weakness === cardDef(g.cardId).type;
      if (weak) power += RULES.weaknessBonus;

      const absorbed = Math.min(target.shield, power);
      target.shield = Math.max(0, target.shield - power);
      const dealt = Math.max(0, power - absorbed);
      target.damage += dealt;

      events.unshift({
        t: 'chant', side, chantId: chant.id, cardId: g.cardId,
        damage: dealt, weak, targetShield: target.shield,
      });

      if (e?.kind === 'self_damage') {
        g.damage += e.amount;
        events.push({ t: 'effect', side, kind: e.kind, amount: e.amount });
      }
      if (e?.kind === 'heal') {
        g.damage = Math.max(0, g.damage - e.amount);
        events.push({ t: 'effect', side, kind: e.kind, amount: e.amount });
      }
      if (e?.kind === 'shield') {
        g.shield += e.amount;
        events.push({ t: 'effect', side, kind: e.kind, amount: e.amount });
      }
      if (e?.kind === 'block_retreat') {
        target.blockedRetreat = true;
        events.push({ t: 'effect', side, kind: e.kind });
      }

      events.push(...koCheck(state, other(side), now));
      events.push(...koCheck(state, side, now)); // auto-KO possible (self_damage)

      const phase = phaseOf(state);
      if (phase === 'over') return { ok: true, events };
      if (phase === 'ko_promote') {
        state.pendingEndTurn = true;
        return { ok: true, events };
      }
      events.push(...endTurn(state, now));
      return { ok: true, events };
    }

    case 'end_turn':
      return { ok: true, events: endTurn(state, now) };

    case 'promote':
      return err('error.nothing_to_promote');
  }
}

function doPromote(state: DuelState, side: Side, benchUid: string, now: number): Result {
  const p = state.players[side];
  const i = p.bench.findIndex((b) => b.uid === benchUid);
  if (i === -1) return err('error.group_not_found');
  const [g] = p.bench.splice(i, 1);
  p.active = g;
  state.phase = 'playing';
  state.promoteSide = null;
  const events: DuelEvent[] = [{ t: 'promoted', side, uid: g.uid, cardId: g.cardId }];
  if (state.pendingEndTurn) {
    state.pendingEndTurn = false;
    events.push(...endTurn(state, now));
  } else {
    state.deadline = now + RULES.turnMs;
  }
  return { ok: true, events };
}

function findGroup(p: PlayerState, uid: string): FieldGroup | null {
  if (p.active?.uid === uid) return p.active;
  return p.bench.find((b) => b.uid === uid) ?? null;
}

/* ------------------------------------------------------ horloge & live */

/** Appelé par la room ~1×/s. Gère les dépassements de temps. */
export function tick(state: DuelState, now: number): DuelEvent[] {
  if (state.phase === 'over' || now < state.deadline) return [];
  if (state.phase === 'ko_promote' && state.promoteSide !== null) {
    const p = state.players[state.promoteSide];
    const first = p.bench[0];
    if (!first) return finish(state, other(state.promoteSide), 'goals');
    const r = doPromote(state, state.promoteSide, first.uid, now);
    return r.ok ? r.events : [];
  }
  return endTurn(state, now);
}

/**
 * But marqué par le club suivi d'un joueur pendant le duel.
 * Événement estampillé par le serveur : les deux clients voient exactement la
 * même chose, au même numéro de séquence.
 */
export function applyLiveGoal(
  state: DuelState, side: Side, fixtureId: number, team: string, minute: number,
): DuelEvent[] {
  if (state.phase !== 'playing') return [];
  const g = state.players[side].active;
  if (!g) return [];
  const ambiance = cardDef(g.cardId).type;
  g.souffle.push(ambiance);
  return [
    { t: 'live_boost', side, fixtureId, team, minute },
    { t: 'souffle_attached', side, uid: g.uid, ambiance },
  ];
}

/* ------------------------------------------------------------- vues */

function publicPlayer(p: PlayerState): PublicPlayer {
  return {
    id: p.id, name: p.name, score: p.score,
    active: p.active, bench: p.bench,
    handCount: p.hand.length, deckCount: p.deck.length, discard: p.discard,
  };
}

/** Vue d'un joueur : sa main en clair, celle d'en face en compteur. */
export function viewFor(state: DuelState, side: Side): Snapshot {
  return {
    duelId: state.id,
    seq: state.seq,
    you: side,
    minute: state.minute,
    turn: state.turn,
    phase: state.phase,
    deadline: state.deadline,
    souffleAvailable: state.turn === side ? state.souffleAvailable : null,
    hand: state.players[side].hand,
    players: [publicPlayer(state.players[0]), publicPlayer(state.players[1])],
    winner: state.winner,
  };
}

/** Retire d'un événement ce que le spectateur n'a pas le droit de voir. */
export function redact(event: DuelEvent, viewer: Side): DuelEvent {
  if (event.t === 'draw' && event.side !== viewer && event.card) {
    const { card, ...rest } = event;
    return rest as DuelEvent;
  }
  return event;
}
