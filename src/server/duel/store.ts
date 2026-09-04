import { Rng } from '../../shared/duel/rng.js';
import type { DuelState } from '../../shared/duel/engine.js';
import type { DuelEvent, Side } from '../../shared/duel/protocol.js';

/** DuelState sérialisable : le PRNG devient un entier. */
export type PersistedDuel = Omit<DuelState, 'rng'> & { rngState: number };

export function serialize(s: DuelState): PersistedDuel {
  const { rng, ...rest } = s;
  return { ...structuredClone(rest), rngState: rng.save() };
}

export function deserialize(p: PersistedDuel): DuelState {
  const { rngState, ...rest } = p;
  const rng = new Rng(rest.seed);
  rng.load(rngState);
  return { ...structuredClone(rest), rng } as DuelState;
}

export interface DuelStore {
  save(d: PersistedDuel): Promise<void>;
  load(duelId: string): Promise<PersistedDuel | null>;
  appendEvents(duelId: string, events: { seq: number; event: DuelEvent }[]): Promise<void>;
  eventsSince(duelId: string, seq: number): Promise<{ seq: number; event: DuelEvent }[]>;
  finish(duelId: string, winner: Side | 'draw' | null, reason: string | null): Promise<void>;
  activeDuelOf(userId: string): Promise<string | null>;
}

/* -------------------------------------------------------------- mémoire */

export class MemoryStore implements DuelStore {
  private duels = new Map<string, PersistedDuel>();
  private events = new Map<string, { seq: number; event: DuelEvent }[]>();

  async save(d: PersistedDuel) {
    this.duels.set(d.id, d);
  }
  async load(duelId: string) {
    return this.duels.get(duelId) ?? null;
  }
  async appendEvents(duelId: string, evs: { seq: number; event: DuelEvent }[]) {
    const log = this.events.get(duelId) ?? [];
    log.push(...evs);
    this.events.set(duelId, log);
  }
  async eventsSince(duelId: string, seq: number) {
    return (this.events.get(duelId) ?? []).filter((e) => e.seq > seq);
  }
  async finish(duelId: string, winner: Side | 'draw' | null, reason: string | null) {
    const d = this.duels.get(duelId);
    if (d) {
      d.winner = winner;
      d.reason = reason as PersistedDuel['reason'];
      d.phase = 'over';
    }
  }
  async activeDuelOf(userId: string) {
    for (const d of this.duels.values()) {
      if (d.phase !== 'over' && d.players.some((p) => p.id === userId)) return d.id;
    }
    return null;
  }
}

/* -------------------------------------------------------------- MariaDB */

/**
 * Nécessite `npm i mysql2`. Schéma dans sql/duel.sql.
 * L'état complet est stocké en JSON : une ligne par duel, réécrite à chaque
 * tour. Le journal d'événements est append-only et sert à la resynchronisation
 * comme au rejeu d'une partie.
 */
export class MysqlStore implements DuelStore {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private pool: any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(pool: any) {
    this.pool = pool;
  }

  static async create(url: string): Promise<MysqlStore> {
    // Import indirect : mysql2 reste une dépendance optionnelle du projet.
    const specifier = 'mysql2/promise';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mysql: any = await import(/* @vite-ignore */ specifier);
    const pool = mysql.createPool({ uri: url, connectionLimit: 10, namedPlaceholders: true });
    return new MysqlStore(pool);
  }

  async save(d: PersistedDuel) {
    await this.pool.execute(
      `INSERT INTO duels (id, player0_id, player1_id, phase, state_json, updated_at)
       VALUES (:id, :p0, :p1, :phase, :state, NOW(3))
       ON DUPLICATE KEY UPDATE phase = :phase, state_json = :state, updated_at = NOW(3)`,
      { id: d.id, p0: d.players[0].id, p1: d.players[1].id, phase: d.phase, state: JSON.stringify(d) },
    );
  }

  async load(duelId: string) {
    const [rows] = await this.pool.execute('SELECT state_json FROM duels WHERE id = :id', { id: duelId });
    const row = (rows as { state_json: string }[])[0];
    return row ? (JSON.parse(row.state_json) as PersistedDuel) : null;
  }

  async appendEvents(duelId: string, evs: { seq: number; event: DuelEvent }[]) {
    if (!evs.length) return;
    const values = evs.map((e) => [duelId, e.seq, JSON.stringify(e.event)]);
    await this.pool.query('INSERT IGNORE INTO duel_events (duel_id, seq, payload) VALUES ?', [values]);
  }

  async eventsSince(duelId: string, seq: number) {
    const [rows] = await this.pool.execute(
      'SELECT seq, payload FROM duel_events WHERE duel_id = :id AND seq > :seq ORDER BY seq',
      { id: duelId, seq },
    );
    return (rows as { seq: number; payload: string }[]).map((r) => ({
      seq: r.seq,
      event: JSON.parse(r.payload) as DuelEvent,
    }));
  }

  async finish(duelId: string, winner: Side | 'draw' | null, reason: string | null) {
    await this.pool.execute(
      `UPDATE duels SET phase = 'over', winner = :w, reason = :r, ended_at = NOW(3) WHERE id = :id`,
      { id: duelId, w: winner === null ? null : String(winner), r: reason },
    );
  }

  async activeDuelOf(userId: string) {
    const [rows] = await this.pool.execute(
      `SELECT id FROM duels WHERE phase <> 'over' AND (player0_id = :u OR player1_id = :u)
       ORDER BY updated_at DESC LIMIT 1`,
      { u: userId },
    );
    const row = (rows as { id: string }[])[0];
    return row?.id ?? null;
  }
}
