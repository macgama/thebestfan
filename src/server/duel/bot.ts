import { cardDef } from '../../shared/duel/cards.js';
import { viewFor, type DuelState } from '../../shared/duel/engine.js';
import type { Ambiance, Cost, Intent, Side } from '../../shared/duel/protocol.js';

export type BotLevel = 'tranquille' | 'chaud' | 'bouillant';

interface Profile {
  /** Réflexion avant un chant ou un repli : c'est là qu'un humain hésite. */
  think: [number, number];
  /** Réflexion avant de poser une carte ou un souffle : presque machinal. */
  quick: [number, number];
  /** Probabilité de choisir le meilleur chant plutôt qu'un au hasard. */
  sharp: number;
  /** Probabilité de laisser passer une occasion de reculer un groupe en danger. */
  sloppy: number;
}

const PROFILES: Record<BotLevel, Profile> = {
  tranquille: { think: [1400, 2600], quick: [500, 900], sharp: 0.55, sloppy: 0.6 },
  chaud:      { think: [900, 1800],  quick: [350, 700], sharp: 0.8,  sloppy: 0.3 },
  bouillant:  { think: [500, 1100],  quick: [220, 480], sharp: 0.97, sloppy: 0.05 },
};

function canPay(souffle: Ambiance[], cost: readonly Cost[]): boolean {
  const pool = [...souffle];
  for (const c of cost) {
    if (c === 'any') continue;
    const i = pool.indexOf(c);
    if (i === -1) return false;
    pool.splice(i, 1);
  }
  return pool.length >= cost.filter((c) => c === 'any').length;
}

/**
 * Adversaire d'entraînement.
 *
 * Il ne triche pas : il ne voit que ce qu'un joueur verrait à sa place, via
 * `viewFor`. Sa main lui est connue, celle d'en face non. C'est ce qui rend
 * ses parties représentatives — un bot qui lit la main adverse produirait des
 * matchs que personne ne peut reproduire contre un humain.
 */
export class DuelBot {
  readonly userId: string;
  readonly name: string;
  private level: BotLevel;
  private nextAt = 0;

  constructor(opts: { userId: string; name: string; level?: BotLevel }) {
    this.userId = opts.userId;
    this.name = opts.name;
    this.level = opts.level ?? 'chaud';
  }

  private get profile() {
    return PROFILES[this.level];
  }

  private schedule(now: number, kind: 'think' | 'quick' = 'think') {
    const [a, b] = this.profile[kind];
    this.nextAt = now + a + Math.random() * (b - a);
  }

  /**
   * Appelé à chaque tour d'horloge de la room. Renvoie l'intention à jouer,
   * ou null s'il réfléchit encore ou si ce n'est pas à lui.
   */
  decide(state: DuelState, side: Side, now: number): Intent | null {
    if (state.phase === 'over') return null;
    if (now < this.nextAt) return null;

    const view = viewFor(state, side);
    const me = view.players[side];
    const foe = view.players[(side ^ 1) as Side];

    if (view.phase === 'ko_promote') {
      if (state.promoteSide !== side) return null;
      // Il remet devant le groupe le plus solide, pas le premier venu.
      const best = [...me.bench].sort((a, b) =>
        (cardDef(b.cardId).frv - b.damage) - (cardDef(a.cardId).frv - a.damage))[0];
      if (!best) return null;
      this.schedule(now);
      return { t: 'promote', benchUid: best.uid };
    }

    if (view.turn !== side) return null;

    // 1. Garnir le banc : sans réserve, un KO fait perdre la partie.
    if (me.bench.length < 3 && view.hand.length > 0) {
      this.schedule(now, 'quick');
      return { t: 'play_support', uid: view.hand[0].uid };
    }

    // 2. Placer le souffle. Sur l'actif en priorité, sinon sur le banc.
    if (view.souffleAvailable && me.active) {
      this.schedule(now, 'quick');
      const target = me.bench.length && Math.random() < 0.2 ? me.bench[0] : me.active;
      return { t: 'attach_souffle', targetUid: target.uid };
    }

    this.schedule(now);

    // 3. Chanter. Le meilleur chant payable, ou un au hasard s'il est distrait.
    if (me.active && foe.active) {
      const payable = cardDef(me.active.cardId).chants
        .filter((c) => canPay(me.active!.souffle, c.cost));
      if (payable.length) {
        const pick = Math.random() < this.profile.sharp
          ? payable.slice().sort((a, b) => b.power - a.power)[0]
          : payable[Math.floor(Math.random() * payable.length)];
        return { t: 'chant', chantId: pick.id };
      }
    }

    // 4. Se replier faute de mieux : un groupe condamné qui ne peut
    //    plus chanter vaut mieux à l'abri qu'en première ligne. si le groupe en place est condamné et qu'un autre tient.
    if (me.active && foe.active && Math.random() > this.profile.sloppy) {
      const def = cardDef(me.active.cardId);
      const left = def.frv - me.active.damage;
      const threat = Math.max(...cardDef(foe.active.cardId).chants.map((c) => c.power), 0);
      const fresher = me.bench.find((b) => cardDef(b.cardId).frv - b.damage > left + 30);
      if (left <= threat && fresher && me.active.souffle.length >= def.retreat && !me.active.blockedRetreat) {
        return { t: 'retreat', benchUid: fresher.uid };
      }
    }

    return { t: 'end_turn' };
  }
}
