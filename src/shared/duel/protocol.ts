/**
 * Protocole du duel temps réel — partagé client / serveur.
 * Règle d'or : le serveur n'envoie jamais de texte traduit, seulement des codes
 * (`event.chant`, `error.not_your_turn`) que le client rend dans sa langue.
 */

export type Locale = 'fr' | 'en' | 'de' | 'es';

/** Les six ambiances de tribune (l'équivalent des types). */
export type Ambiance = 'pyro' | 'voix' | 'tifo' | 'perc' | 'depl' | 'fide';

export type Cost = Ambiance | 'any';

export type ChantEffect =
  | { kind: 'self_damage'; amount: number }
  | { kind: 'heal'; amount: number }
  | { kind: 'shield'; amount: number }
  | { kind: 'block_retreat' }
  | { kind: 'bonus_if_leading'; amount: number }
  | { kind: 'bonus_late'; amount: number; fromMinute: number };

export interface Chant {
  id: string;
  cost: Cost[];
  power: number;
  effect?: ChantEffect;
}

/** Définition immuable d'une carte supporter. Les libellés vivent dans l'i18n. */
export interface CardDef {
  id: string;
  set: string;
  type: Ambiance;
  frv: number;
  retreat: number;
  weakness: Ambiance;
  rarity: 'd1' | 'd2' | 'd3' | 'star' | 'crown';
  chants: Chant[];
}

/** Un groupe posé sur le terrain (instance, pas définition). */
export interface FieldGroup {
  uid: string;
  cardId: string;
  damage: number;
  souffle: Ambiance[];
  shield: number;
  blockedRetreat: boolean;
}

export interface CardInstance {
  uid: string;
  cardId: string;
}

export type Side = 0 | 1;

/* ---------------------------------------------------------------- intents */

export type Intent =
  | { t: 'play_support'; uid: string }
  | { t: 'attach_souffle'; targetUid: string }
  | { t: 'chant'; chantId: string }
  | { t: 'retreat'; benchUid: string }
  | { t: 'promote'; benchUid: string }
  | { t: 'end_turn' }
  | { t: 'surrender' };

/* ----------------------------------------------------------------- events */

export type DuelEvent =
  | { t: 'turn_start'; side: Side; minute: number; deadline: number; souffle: Ambiance }
  | { t: 'draw'; side: Side; count: number; card?: CardInstance }
  | { t: 'support_played'; side: Side; uid: string; cardId: string }
  | { t: 'souffle_attached'; side: Side; uid: string; ambiance: Ambiance }
  | { t: 'chant'; side: Side; chantId: string; cardId: string; damage: number; weak: boolean; targetShield: number }
  | { t: 'effect'; side: Side; kind: ChantEffect['kind']; amount?: number }
  | { t: 'ko'; side: Side; uid: string; cardId: string }
  | { t: 'goal'; side: Side; score: [number, number] }
  | { t: 'promote_required'; side: Side }
  | { t: 'promoted'; side: Side; uid: string; cardId: string }
  | { t: 'retreated'; side: Side; inUid: string; outUid: string }
  | { t: 'live_boost'; side: Side; fixtureId: number; team: string; minute: number }
  | { t: 'whistle'; minute: number }
  | { t: 'over'; winner: Side | 'draw'; reason: 'goals' | 'time' | 'deck_out' | 'surrender' | 'timeout' };

/* --------------------------------------------------------------- snapshot */

export interface PublicPlayer {
  id: string;
  name: string;
  score: number;
  active: FieldGroup | null;
  bench: FieldGroup[];
  handCount: number;
  deckCount: number;
  discard: string[];
}

/** Vue d'un joueur : sa main en clair, celle de l'adversaire en compteur. */
export interface Snapshot {
  duelId: string;
  seq: number;
  you: Side;
  minute: number;
  turn: Side;
  phase: 'playing' | 'ko_promote' | 'over';
  deadline: number;
  souffleAvailable: Ambiance | null;
  hand: CardInstance[];
  players: [PublicPlayer, PublicPlayer];
  winner: Side | 'draw' | null;
}

/* ---------------------------------------------------- messages socket.io */

export interface ClientToServer {
  'duel:queue': (p: { deckId?: string }) => void;
  'duel:cancel_queue': () => void;
  'duel:intent': (p: { duelId: string; intent: Intent }) => void;
  'duel:resync': (p: { duelId: string; sinceSeq: number }) => void;
  'duel:leave': (p: { duelId: string }) => void;
}

export interface ServerToClient {
  'duel:queued': (p: { position: number }) => void;
  'duel:start': (p: Snapshot) => void;
  'duel:event': (p: { duelId: string; seq: number; event: DuelEvent }) => void;
  'duel:state': (p: Snapshot) => void;
  'duel:error': (p: { code: string; params?: Record<string, string | number> }) => void;
  'duel:opponent': (p: { connected: boolean; graceUntil?: number }) => void;
}
