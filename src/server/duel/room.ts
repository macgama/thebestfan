import type { Server, Socket } from 'socket.io';
import {
  applyIntent, applyLiveGoal, createDuel, redact, tick, viewFor, RULES,
  type DuelState,
} from '../../shared/duel/engine.js';
import type { DuelEvent, Intent, Side } from '../../shared/duel/protocol.js';
import { serialize, type DuelStore } from './store.js';
import type { DuelBot } from './bot.js';

export const RECONNECT_GRACE_MS = 60_000;

interface Seat {
  userId: string;
  socket: Socket | null;
  disconnectedAt: number | null;
  /** Siège occupé par l'adversaire d'entraînement : pas de socket, pas de forfait. */
  bot: DuelBot | null;
}

/**
 * Une room = une partie. Elle détient l'unique état faisant foi.
 * Le client n'envoie que des intentions ; c'est ici qu'elles sont validées,
 * numérotées et diffusées. Rien de ce que le client affiche n'est cru.
 */
export class DuelRoom {
  readonly id: string;
  state: DuelState;
  private seats: [Seat, Seat];
  private io: Server;
  private store: DuelStore;
  private onEnd: (room: DuelRoom) => void;
  /** Partie d'entraînement : elle ne compte pas au classement. */
  readonly training: boolean = false;

  constructor(opts: {
    io: Server;
    store: DuelStore;
    id: string;
    players: [{ userId: string; name: string; deck: string[]; socket: Socket | null; bot?: DuelBot },
              { userId: string; name: string; deck: string[]; socket: Socket | null; bot?: DuelBot }];
    seed: string;
    onEnd: (room: DuelRoom) => void;
  }) {
    this.io = opts.io;
    this.store = opts.store;
    this.id = opts.id;
    this.onEnd = opts.onEnd;
    this.seats = [
      { userId: opts.players[0].userId, socket: opts.players[0].socket,
        disconnectedAt: null, bot: opts.players[0].bot ?? null },
      { userId: opts.players[1].userId, socket: opts.players[1].socket,
        disconnectedAt: null, bot: opts.players[1].bot ?? null },
    ];
    this.training = this.seats.some((s) => s.bot !== null);

    const now = Date.now();
    const { state, events } = createDuel(
      opts.id,
      { id: opts.players[0].userId, name: opts.players[0].name, deck: opts.players[0].deck },
      { id: opts.players[1].userId, name: opts.players[1].name, deck: opts.players[1].deck },
      opts.seed,
      now,
    );
    this.state = state;

    // Les evenements de mise en place sont journalises mais pas diffuses :
    // le snapshot d'ouverture les contient deja.
    void this.publish(events, false).then(() => {
      for (const side of [0, 1] as Side[]) {
        const sock = opts.players[side].socket;
        if (!sock) continue;
        sock.join(this.room);
        sock.emit('duel:start', { ...viewFor(this.state, side), training: this.training });
      }
    });
  }

  private get room() {
    return `duel:${this.id}`;
  }

  sideOf(userId: string): Side | null {
    if (this.seats[0].userId === userId) return 0;
    if (this.seats[1].userId === userId) return 1;
    return null;
  }

  /* ------------------------------------------------------------ diffusion */

  private async publish(events: DuelEvent[], emit = true) {
    if (!events.length) return;
    const numbered = events.map((event) => ({ seq: ++this.state.seq, event }));

    if (emit) {
      for (const side of [0, 1] as Side[]) {
        const seat = this.seats[side];
        if (!seat.socket) continue;
        for (const { seq, event } of numbered) {
          seat.socket.emit('duel:event', { duelId: this.id, seq, event: redact(event, side) });
        }
      }
    }

    try {
      await this.store.appendEvents(this.id, numbered);
      await this.store.save(serialize(this.state));
    } catch (e) {
      console.error(`[duel ${this.id}] persistance`, e);
    }

    if (this.state.phase === 'over') {
      await this.store.finish(this.id, this.state.winner, this.state.reason);
      this.onEnd(this);
    }
  }

  /* ---------------------------------------------------------- intentions */

  async handleIntent(userId: string, intent: Intent) {
    const side = this.sideOf(userId);
    if (side === null) return;
    const res = applyIntent(this.state, side, intent, Date.now());
    if (!res.ok) {
      this.seats[side].socket?.emit('duel:error', { code: res.code });
      return;
    }
    await this.publish(res.events);
  }

  /** Un but du club suivi par ce joueur, injecté depuis le worker API-Football. */
  async liveGoal(userId: string, fixtureId: number, team: string, minute: number) {
    const side = this.sideOf(userId);
    if (side === null) return;
    await this.publish(applyLiveGoal(this.state, side, fixtureId, team, minute));
  }

  /* -------------------------------------------------------------- horloge */

  /**
   * Lecture non narrowée de la phase : handleIntent peut terminer la partie
   * au milieu de la boucle, et TypeScript ne le voit pas sur un accès direct.
   */
  private phaseNow(): DuelState['phase'] {
    return this.state.phase;
  }

  async tick(now: number) {
    if (this.phaseNow() === 'over') return;

    for (const side of [0, 1] as Side[]) {
      const seat = this.seats[side];
      if (seat.bot) continue;
      if (seat.disconnectedAt && now - seat.disconnectedAt > RECONNECT_GRACE_MS) {
        await this.handleIntent(seat.userId, { t: 'surrender' });
        return;
      }
    }

    // L'adversaire d'entraînement joue avant l'horloge : sinon son tour
    // expirerait sans qu'il ait rien fait.
    for (const side of [0, 1] as Side[]) {
      const seat = this.seats[side];
      if (!seat.bot) continue;
      // Plusieurs gestes par tour d'horloge : poser une carte, attacher un
      // souffle et chanter ne doivent pas prendre trois secondes. Le temps de
      // réflexion du bot reste respecté, il est simplement plus court pour les
      // gestes machinaux.
      for (let step = 0; step < 4; step++) {
        const at = now + step * 5;
        const intent = seat.bot.decide(this.state, side, at);
        if (process.env.DUEL_DEBUG) {
          console.log('[bot]', side, this.phaseNow(), 'tour', this.state.turn, '->', intent?.t ?? 'attend');
        }
        if (!intent) break;
        await this.handleIntent(seat.userId, intent);
        if (this.phaseNow() === 'over') return;
      }
    }

    await this.publish(tick(this.state, now));
  }

  /* --------------------------------------------------------- connexions */

  attach(userId: string, socket: Socket) {
    const side = this.sideOf(userId);
    if (side === null || this.seats[side].bot) return;
    this.seats[side].socket = socket;
    this.seats[side].disconnectedAt = null;
    socket.join(this.room);
    socket.emit('duel:state', { ...viewFor(this.state, side), training: this.training });
    this.seats[side ^ 1].socket?.emit('duel:opponent', { connected: true });
  }

  detach(userId: string) {
    const side = this.sideOf(userId);
    if (side === null) return;
    this.seats[side].socket = null;
    this.seats[side].disconnectedAt = Date.now();
    this.seats[side ^ 1].socket?.emit('duel:opponent', {
      connected: false,
      graceUntil: Date.now() + RECONNECT_GRACE_MS,
    });
  }

  /** Renvoie l'état complet, ou seulement les événements manqués si l'écart est faible. */
  async resync(userId: string, sinceSeq: number) {
    const side = this.sideOf(userId);
    if (side === null) return;
    const seat = this.seats[side];
    if (!seat.socket) return;

    const gap = this.state.seq - sinceSeq;
    if (gap > 0 && gap <= 40) {
      const missed = await this.store.eventsSince(this.id, sinceSeq);
      for (const { seq, event } of missed) {
        seat.socket.emit('duel:event', { duelId: this.id, seq, event: redact(event, side) });
      }
      return;
    }
    seat.socket.emit('duel:state', { ...viewFor(this.state, side), training: this.training });
  }

  get deadline() {
    return this.state.deadline;
  }

  get turnMs() {
    return RULES.turnMs;
  }
}
