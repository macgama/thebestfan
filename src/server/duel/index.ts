import { randomUUID } from 'node:crypto';
import type { Server, Socket } from 'socket.io';
import { CARDS } from '../../shared/duel/cards.js';
import { RULES } from '../../shared/duel/engine.js';
import type { Intent } from '../../shared/duel/protocol.js';
import { DuelRoom } from './room.js';
import { MemoryStore, type DuelStore } from './store.js';

export interface DuelServerOptions {
  store?: DuelStore;
  /**
   * Résout le jeton du handshake en identité. Branche ici ta vérification de
   * session (JWT, cookie signé, Firebase Admin…). Doit renvoyer null si le
   * jeton est invalide : sans identité vérifiée, un joueur peut se faire
   * passer pour un autre et reprendre son duel en cours.
   */
  authenticate?: (token: string | undefined, socket: Socket) => Promise<{ userId: string; name: string } | null>;
  /** Deck de 20 cartes du joueur. Par défaut : un deck aléatoire (dev). */
  getDeck?: (userId: string, deckId?: string) => Promise<string[]>;
  tickMs?: number;
}

interface Session {
  userId: string;
  name: string;
  intents: number[];
}

const MAX_INTENTS_PER_5S = 25;

export class DuelServer {
  private io: Server;
  private store: DuelStore;
  private opts: Required<Pick<DuelServerOptions, 'authenticate' | 'getDeck' | 'tickMs'>>;
  private rooms = new Map<string, DuelRoom>();
  private roomOfUser = new Map<string, string>();
  private queue: { userId: string; name: string; deck: string[]; socket: Socket }[] = [];
  private sessions = new WeakMap<Socket, Session>();
  private timer: NodeJS.Timeout | null = null;

  constructor(io: Server, options: DuelServerOptions = {}) {
    this.io = io;
    this.store = options.store ?? new MemoryStore();
    this.opts = {
      authenticate:
        options.authenticate ??
        (async (token) => {
          // Dev uniquement : le jeton EST l'identifiant. À remplacer en prod.
          if (!token) return null;
          return { userId: token, name: token.slice(0, 12) };
        }),
      getDeck: options.getDeck ?? (async () => randomDeck()),
      tickMs: options.tickMs ?? 1000,
    };
  }

  listen() {
    this.io.on('connection', (socket) => void this.onConnection(socket));
    this.timer = setInterval(() => void this.tickAll(), this.opts.tickMs);
    return this;
  }

  async close() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Point d'entrée du worker API-Football : un but du club suivi par ce joueur. */
  async liveGoal(userId: string, fixtureId: number, team: string, minute: number) {
    const roomId = this.roomOfUser.get(userId);
    const room = roomId ? this.rooms.get(roomId) : null;
    await room?.liveGoal(userId, fixtureId, team, minute);
  }

  get stats() {
    return { rooms: this.rooms.size, queue: this.queue.length };
  }

  /* ------------------------------------------------------------ connexion */

  private async onConnection(socket: Socket) {
    const token = (socket.handshake.auth?.token ?? socket.handshake.query?.token) as string | undefined;
    const who = await this.opts.authenticate(token, socket);
    if (!who) {
      socket.emit('duel:error', { code: 'auth.error.unauthenticated' });
      // Couper immédiatement ferait perdre le message : le client ne saurait
      // pas qu'il doit se connecter, il verrait juste une déconnexion.
      setTimeout(() => socket.disconnect(true), 150).unref?.();
      return;
    }
    this.sessions.set(socket, { ...who, intents: [] });

    // Reprise d'un duel en cours après un changement de réseau ou un onglet fermé.
    const existing = this.roomOfUser.get(who.userId) ?? (await this.store.activeDuelOf(who.userId));
    const room = existing ? this.rooms.get(existing) : null;
    if (room) {
      this.roomOfUser.set(who.userId, room.id);
      room.attach(who.userId, socket);
    }

    socket.on('duel:queue', (p: { deckId?: string }) => void this.enqueue(socket, p?.deckId));
    socket.on('duel:cancel_queue', () => this.dequeue(socket));
    socket.on('duel:intent', (p: { duelId: string; intent: Intent }) => void this.onIntent(socket, p));
    socket.on('duel:resync', (p: { duelId: string; sinceSeq: number }) => void this.onResync(socket, p));
    socket.on('duel:leave', () => this.dequeue(socket));
    socket.on('disconnect', () => this.onDisconnect(socket));
  }

  private onDisconnect(socket: Socket) {
    const s = this.sessions.get(socket);
    if (!s) return;
    this.dequeue(socket);
    const roomId = this.roomOfUser.get(s.userId);
    const room = roomId ? this.rooms.get(roomId) : null;
    room?.detach(s.userId);
  }

  /* ---------------------------------------------------------- appariement */

  private async enqueue(socket: Socket, deckId?: string) {
    const s = this.sessions.get(socket);
    if (!s) return;
    if (this.roomOfUser.has(s.userId)) {
      socket.emit('duel:error', { code: 'error.already_in_duel' });
      return;
    }
    if (this.queue.some((q) => q.userId === s.userId)) return;

    const deck = await this.opts.getDeck(s.userId, deckId);
    if (deck.length !== RULES.deckSize) {
      socket.emit('duel:error', { code: 'error.invalid_deck', params: { expected: RULES.deckSize } });
      return;
    }

    this.queue.push({ userId: s.userId, name: s.name, deck, socket });
    socket.emit('duel:queued', { position: this.queue.length });
    this.tryMatch();
  }

  private dequeue(socket: Socket) {
    const s = this.sessions.get(socket);
    if (!s) return;
    this.queue = this.queue.filter((q) => q.userId !== s.userId);
  }

  private tryMatch() {
    while (this.queue.length >= 2) {
      const a = this.queue.shift()!;
      const b = this.queue.shift()!;
      if (!a.socket.connected) { this.queue.unshift(b); continue; }
      if (!b.socket.connected) { this.queue.unshift(a); continue; }

      const id = randomUUID();
      const room = new DuelRoom({
        io: this.io,
        store: this.store,
        id,
        seed: randomUUID(),
        players: [a, b],
        onEnd: (r) => this.closeRoom(r),
      });
      this.rooms.set(id, room);
      this.roomOfUser.set(a.userId, id);
      this.roomOfUser.set(b.userId, id);
    }
  }

  private closeRoom(room: DuelRoom) {
    for (const [userId, roomId] of this.roomOfUser) {
      if (roomId === room.id) this.roomOfUser.delete(userId);
    }
    // On garde la room 30 s pour laisser passer l'écran de fin, puis on libère.
    setTimeout(() => this.rooms.delete(room.id), 30_000).unref?.();
  }

  /* ----------------------------------------------------------- intentions */

  private async onIntent(socket: Socket, p: { duelId: string; intent: Intent }) {
    const s = this.sessions.get(socket);
    if (!s || !p?.intent) return;

    const now = Date.now();
    s.intents = s.intents.filter((t) => now - t < 5_000);
    if (s.intents.length >= MAX_INTENTS_PER_5S) {
      socket.emit('duel:error', { code: 'error.rate_limited' });
      return;
    }
    s.intents.push(now);

    const roomId = this.roomOfUser.get(s.userId);
    if (!roomId || roomId !== p.duelId) {
      socket.emit('duel:error', { code: 'error.not_in_duel' });
      return;
    }
    await this.rooms.get(roomId)?.handleIntent(s.userId, p.intent);
  }

  private async onResync(socket: Socket, p: { duelId: string; sinceSeq: number }) {
    const s = this.sessions.get(socket);
    if (!s) return;
    const roomId = this.roomOfUser.get(s.userId);
    if (!roomId || roomId !== p?.duelId) return;
    await this.rooms.get(roomId)?.resync(s.userId, p.sinceSeq ?? 0);
  }

  private async tickAll() {
    const now = Date.now();
    for (const room of this.rooms.values()) {
      try {
        await room.tick(now);
      } catch (e) {
        console.error(`[duel ${room.id}] tick`, e);
      }
    }
  }
}

/** Deck de dev : 20 cartes tirées du catalogue, doublons autorisés. */
export function randomDeck(): string[] {
  const pool = CARDS.map((c) => c.id);
  return Array.from({ length: RULES.deckSize }, () => pool[Math.floor(Math.random() * pool.length)]);
}

export function attachDuelServer(io: Server, options?: DuelServerOptions) {
  return new DuelServer(io, options).listen();
}
