import { cardDef } from './cards.js';
import type { DuelEvent, FieldGroup, Side, Snapshot } from './protocol.js';

/**
 * Applique un événement serveur au snapshot local du client.
 * Une seule implémentation, partagée, pour éviter que client et serveur
 * divergent. Le client ne calcule jamais de dégâts : il recopie ce que le
 * serveur a décidé.
 */
export function project(prev: Snapshot, seq: number, event: DuelEvent): Snapshot {
  const s: Snapshot = structuredClone(prev);
  s.seq = seq;
  const me = s.you;
  const P = (side: Side) => s.players[side];
  const group = (side: Side, uid: string): FieldGroup | undefined => {
    const p = P(side);
    if (p.active?.uid === uid) return p.active;
    return p.bench.find((b) => b.uid === uid);
  };

  switch (event.t) {
    case 'turn_start':
      s.turn = event.side;
      s.minute = event.minute;
      s.deadline = event.deadline;
      s.phase = 'playing';
      s.souffleAvailable = event.side === me ? event.souffle : null;
      break;

    case 'draw':
      P(event.side).deckCount = Math.max(0, P(event.side).deckCount - event.count);
      P(event.side).handCount += event.count;
      if (event.card && event.side === me) s.hand.push(event.card);
      break;

    case 'support_played': {
      P(event.side).bench.push({
        uid: event.uid, cardId: event.cardId, damage: 0, souffle: [], shield: 0, blockedRetreat: false,
      });
      P(event.side).handCount = Math.max(0, P(event.side).handCount - 1);
      if (event.side === me) s.hand = s.hand.filter((c) => c.uid !== event.uid);
      break;
    }

    case 'souffle_attached': {
      const g = group(event.side, event.uid);
      if (g) g.souffle.push(event.ambiance);
      if (event.side === me) s.souffleAvailable = null;
      break;
    }

    case 'chant': {
      const foe = (event.side === 0 ? 1 : 0) as Side;
      const target = P(foe).active;
      if (target) {
        target.damage += event.damage;
        target.shield = event.targetShield;
      }
      break;
    }

    case 'effect': {
      const g = P(event.side).active;
      const foe = (event.side === 0 ? 1 : 0) as Side;
      if (!g) break;
      if (event.kind === 'self_damage') g.damage += event.amount ?? 0;
      if (event.kind === 'heal') g.damage = Math.max(0, g.damage - (event.amount ?? 0));
      if (event.kind === 'shield') g.shield += event.amount ?? 0;
      if (event.kind === 'block_retreat') {
        const t = P(foe).active;
        if (t) t.blockedRetreat = true;
      }
      break;
    }

    case 'ko': {
      const p = P(event.side);
      p.active = null;
      p.discard.push(event.cardId);
      break;
    }

    case 'goal':
      P(0).score = event.score[0];
      P(1).score = event.score[1];
      break;

    case 'promote_required':
      s.phase = 'ko_promote';
      break;

    case 'promoted': {
      const p = P(event.side);
      const i = p.bench.findIndex((b) => b.uid === event.uid);
      if (i >= 0) {
        p.active = p.bench.splice(i, 1)[0];
      } else {
        p.active = {
          uid: event.uid, cardId: event.cardId, damage: 0, souffle: [], shield: 0, blockedRetreat: false,
        };
        p.handCount = Math.max(0, p.handCount - 1);
        if (event.side === me) s.hand = s.hand.filter((c) => c.uid !== event.uid);
      }
      s.phase = 'playing';
      break;
    }

    case 'retreated': {
      const p = P(event.side);
      const i = p.bench.findIndex((b) => b.uid === event.inUid);
      if (i >= 0 && p.active) {
        const outgoing = p.active;
        outgoing.souffle.splice(0, cardDef(outgoing.cardId).retreat);
        const incoming = p.bench.splice(i, 1)[0];
        p.bench.push(outgoing);
        p.active = incoming;
      }
      break;
    }

    case 'whistle':
      s.minute = event.minute;
      break;

    case 'over':
      s.phase = 'over';
      s.winner = event.winner;
      s.deadline = 0;
      break;

    case 'live_boost':
      break;
  }
  return s;
}
