import { grade, applyHeroMods, Cheat } from '../ferveur/gestures.js';
import { ACTION_BY_ID, DECK_RULES } from '../../shared/duel/actions.js';

/**
 * Moteur de duel N contre N.
 *
 * Deux tribunes tirent sur la même corde. Chacun chante — un geste noté par le
 * serveur — et joue des cartes d'action qui changent les règles pendant
 * quelques secondes. Le nombre n'est pas un avantage : une poussée est divisée
 * par l'effectif de la tribune, donc cinq joueurs mous ne battent pas un bon
 * joueur seul. Ce qui fait la différence à plusieurs, ce sont les cartes
 * collectives, qui ne valent rien jouées dans son coin.
 *
 * Le moteur ne connaît ni socket ni base : on lui donne des intentions, il
 * renvoie des événements. C'est ce qui le rend testable ligne à ligne.
 */

export const RULES = {
  goalAt: 300,
  goalsToWin: 3,
  breathMax: 100,
  breathPerSec: 13,
  decayPerSec: 2.5,
  dureeMs: 5 * 60 * 1000,
  mainVisible: DECK_RULES.mainVisible,
  refillMs: 4000,          // délai avant qu'une carte jouée soit remplacée
  chantPower: 30,          // poussée d'un chant parfait, avant modificateurs
  chantCost: 18,
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const now0 = () => Date.now();

/* ------------------------------------------------------------- joueurs */

function creerJoueur(p, side) {
  const loadout = p.loadout;
  const pioche = [...loadout.actions.map((a) => a.id)];
  // Mélange : deux joueurs avec le même deck ne voient pas les mêmes cartes.
  for (let i = pioche.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pioche[i], pioche[j]] = [pioche[j], pioche[i]];
  }
  return {
    userId: p.userId, nom: p.nom, side,
    fanzzy: loadout.fanzzy,
    actif: 0,                       // index du Fanzzy en jeu
    breath: 40,
    ferveur: 0,
    main: pioche.slice(0, RULES.mainVisible),
    pioche: pioche.slice(RULES.mainVisible),
    defausse: [],
    cooldowns: {},                  // cardId -> instant de disponibilité
    effets: [],                     // effets temporaires actifs
    dernierChant: 0,
    connecte: true,
  };
}

/* ------------------------------------------------------------- effets */

/** Les modificateurs en vigueur : ceux du Fanzzy, plus les effets temporaires. */
function modsDe(j, t) {
  const base = { ...(j.fanzzy[j.actif]?.mods ?? {}) };
  for (const e of j.effets) {
    if (e.fin && t > e.fin) continue;
    if (!e.mods) continue;
    for (const [k, v] of Object.entries(e.mods)) {
      base[k] = typeof v === 'number' && k !== 'tempoInterval' && k !== 'mashTime'
        ? (base[k] ?? 1) * v
        : (base[k] ?? 0) + v;
    }
  }
  return base;
}

const aEffet = (j, type, t) => j.effets.some((e) => e.type === type && (!e.fin || t > 0 && e.fin > t));

function poserEffet(j, effet) {
  // Un même effet ne s'empile pas : il se renouvelle.
  j.effets = j.effets.filter((e) => e.type !== effet.type);
  j.effets.push(effet);
}

function nettoyerEffets(j, t) {
  j.effets = j.effets.filter((e) => (!e.fin || e.fin > t) && (e.charges === undefined || e.charges > 0));
}

/* ------------------------------------------------------------- duel */

export class DuelNvN {
  /**
   * @param opts.equipes [[joueur…], [joueur…]] — chaque joueur a userId, nom, loadout
   * @param opts.fixture  le match réel support
   * @param opts.mode     'classe' ou 'entrainement'
   */
  constructor({ id, equipes, fixture, mode = 'entrainement', duree = RULES.dureeMs, now = now0() }) {
    this.id = id;
    this.fixture = fixture;
    this.mode = mode;
    this.rope = 0;
    this.goals = [0, 0];
    this.debut = now;
    this.fin = now + duree;
    this.dernier = now;
    this.seq = 0;
    this.termine = false;
    this.vainqueur = null;
    this.joueurs = new Map();
    this.rallies = [];               // fenêtres collectives ouvertes

    equipes.forEach((eq, side) => {
      for (const p of eq) this.joueurs.set(p.userId, creerJoueur(p, side));
    });
    this.tailles = [equipes[0].length, equipes[1].length];
  }

  ev(type, data) { return { seq: ++this.seq, t: type, ...data }; }
  joueur(userId) {
    const j = this.joueurs.get(userId);
    if (!j) throw new Cheat('not_in_duel');
    return j;
  }

  /* ------------------------------------------------------------ souffle */

  regen(j, t) {
    const dt = (t - (j.regenAt ?? t)) / 1000;
    j.regenAt = t;
    if (aEffet(j, 'silence', t)) return;
    const m = modsDe(j, t);
    const frein = j.effets.find((e) => e.type === 'breath_mult' && e.fin > t)?.valeur ?? 1;
    j.breath = Math.min(RULES.breathMax,
      j.breath + RULES.breathPerSec * dt * (m.breathBonus ?? 1) * frein);
  }

  /* ------------------------------------------------------------- poussée */

  /**
   * Applique une poussée. Elle est divisée par l'effectif de la tribune :
   * c'est ce qui empêche le nombre de décider seul du résultat.
   */
  pousser(j, montant, t, evenements) {
    const m = modsDe(j, t);
    let v = montant * (m.pushMult ?? 1);

    // Fenêtre collective ouverte par un coéquipier.
    const rally = this.rallies.find((r) => r.side === j.side && r.fin > t);
    if (rally) v *= rally.bonus;

    v /= Math.max(1, this.tailles[j.side]);

    // Bouclier adverse : il absorbe avant que la corde ne bouge.
    const adverses = [...this.joueurs.values()].filter((x) => x.side !== j.side);
    for (const a of adverses) {
      const b = a.effets.find((e) => e.type === 'shield' && e.valeur > 0);
      if (!b) continue;
      const pris = Math.min(b.valeur, v);
      b.valeur -= pris; v -= pris;
      evenements.push(this.ev('shield', { userId: a.userId, absorbe: Math.round(pris) }));
      if (b.valeur <= 0) a.effets = a.effets.filter((e) => e !== b);
      if (v <= 0) return 0;
    }

    const signe = j.side === 0 ? -1 : 1;
    this.rope = clamp(this.rope + signe * v, -RULES.goalAt, RULES.goalAt);
    j.ferveur += Math.round(v);
    evenements.push(this.ev('push', { userId: j.userId, side: j.side, valeur: Math.round(v) }));

    if (Math.abs(this.rope) >= RULES.goalAt) this.but(this.rope > 0 ? 1 : 0, evenements);
    return v;
  }

  but(side, evenements) {
    this.goals[side]++;
    this.rope = 0;
    evenements.push(this.ev('goal', { side, goals: [...this.goals] }));
    if (this.goals[side] >= RULES.goalsToWin) this.finir(side, 'buts', evenements);
  }

  finir(vainqueur, raison, evenements) {
    if (this.termine) return;
    this.termine = true;
    this.vainqueur = vainqueur;
    evenements.push(this.ev('over', {
      vainqueur, raison, goals: [...this.goals], mode: this.mode,
      classement: this.mode === 'classe',
    }));
  }

  /* --------------------------------------------------------------- chant */

  /** Un chant : le geste est noté ici, jamais annoncé par le client. */
  chanter(userId, { geste, taps }, t = now0()) {
    if (this.termine) throw new Cheat('duel_over');
    const j = this.joueur(userId);
    this.regen(j, t);
    if (aEffet(j, 'silence', t)) throw new Cheat('silenced');
    if (j.breath < RULES.chantCost) throw new Cheat('not_enough_breath');

    const m = modsDe(j, t);
    let q = grade(geste, taps, m);

    // « Second souffle » : un raté compte comme moyen, une seule fois.
    const plancher = j.effets.find((e) => e.type === 'floor_quality' && e.charges > 0);
    if (plancher && q < plancher.valeur) { q = plancher.valeur; plancher.charges--; }

    const { quality, backfire } = applyHeroMods(q, m);
    j.breath -= RULES.chantCost;
    j.dernierChant = t;

    const evenements = [this.ev('chant', {
      userId, side: j.side, geste, quality: Number(quality.toFixed(3)), backfire,
    })];

    // Les charges d'un modificateur temporaire se consomment au chant.
    for (const e of j.effets) if (e.charges !== undefined && e.mods) e.charges--;
    nettoyerEffets(j, t);

    if (backfire) {
      const faux = { ...j, side: j.side ^ 1 };
      this.pousser(faux, RULES.chantPower * 0.35, t, evenements);
    } else {
      this.pousser(j, RULES.chantPower * quality, t, evenements);
    }
    return evenements;
  }

  /* -------------------------------------------------------------- carte */

  jouer(userId, cardId, t = now0()) {
    if (this.termine) throw new Cheat('duel_over');
    const j = this.joueur(userId);
    this.regen(j, t);

    if (!j.main.includes(cardId)) throw new Cheat('card_not_in_hand');
    if (aEffet(j, 'lock_actions', t)) throw new Cheat('actions_locked');

    const carte = ACTION_BY_ID.get(cardId);
    if (!carte) throw new Cheat('unknown_card');
    if ((j.cooldowns[cardId] ?? 0) > t) throw new Cheat('card_on_cooldown');

    // Conditions : mené au score, minute du vrai match.
    const c = carte.condition ?? {};
    if (c.mene && this.goals[j.side] + c.mene > this.goals[j.side ^ 1]) {
      throw new Cheat('condition_not_met');
    }
    if (c.minuteReelle && (this.fixture?.elapsed ?? 0) < c.minuteReelle) {
      throw new Cheat('condition_not_met');
    }
    if (j.breath < carte.cost) throw new Cheat('not_enough_breath');

    // Renvoi : la carte se retourne contre celui qui la joue.
    const adverses = [...this.joueurs.values()].filter((x) => x.side !== j.side);
    const miroir = adverses.map((a) => a.effets.find((e) => e.type === 'reflect' && e.charges > 0))
      .find(Boolean);

    j.breath -= carte.cost;
    j.cooldowns[cardId] = t + carte.cd * 1000;
    j.main = j.main.filter((x) => x !== cardId);
    j.defausse.push(cardId);
    // La carte suivante n'arrive pas tout de suite : jouer coûte aussi du choix.
    j.remplirA = t + RULES.refillMs;

    const evenements = [this.ev('action', { userId, side: j.side, cardId, famille: carte.fam })];

    if (miroir) {
      miroir.charges--;
      evenements.push(this.ev('reflected', { userId, cardId }));
      this.appliquer(adverses[0], carte, t, evenements);   // l'effet part chez l'autre
    } else {
      this.appliquer(j, carte, t, evenements);
    }

    if (carte.revers) this.appliquerEffet(j, carte.revers, t, evenements);
    return evenements;
  }

  /** Résolution d'une carte, famille par famille. */
  appliquer(j, carte, t, evenements) {
    const e = carte.effet ?? {};
    const adverses = [...this.joueurs.values()].filter((x) => x.side !== j.side);
    const allies = [...this.joueurs.values()].filter((x) => x.side === j.side);

    switch (e.type) {
      case 'push': {
        let v = e.valeur;
        if (e.doubleSiMene && this.goals[j.side] < this.goals[j.side ^ 1]) v *= 2;
        this.pousser(j, v, t, evenements);
        break;
      }
      case 'silence':
      case 'blind':
      case 'lock_actions':
        for (const a of adverses) poserEffet(a, { type: e.type, fin: t + e.duree });
        evenements.push(this.ev('effect', { cible: 'adverse', type: e.type, duree: e.duree }));
        break;

      case 'steal': {
        let total = 0;
        for (const a of adverses) {
          const pris = Math.min(e.valeur / adverses.length, a.breath);
          a.breath -= pris; total += pris;
        }
        j.breath = Math.min(RULES.breathMax, j.breath + total * (e.rendu ?? 0.6));
        evenements.push(this.ev('effect', { type: 'steal', valeur: Math.round(total) }));
        break;
      }
      case 'refill':
        j.breath = Math.min(RULES.breathMax,
          j.breath + (RULES.breathMax - j.breath) * (e.part ?? 0.5));
        evenements.push(this.ev('effect', { type: 'refill', userId: j.userId }));
        break;

      case 'team_breath':
        for (const a of allies) a.breath = Math.min(RULES.breathMax, a.breath + e.valeur);
        evenements.push(this.ev('effect', { type: 'team_breath', valeur: e.valeur }));
        break;

      case 'mod_self':
        poserEffet(j, { type: 'mod_self', mods: e.mods,
          fin: e.duree ? t + e.duree : undefined, charges: e.charges });
        evenements.push(this.ev('effect', { type: 'mod_self', userId: j.userId, mods: e.mods }));
        break;

      case 'mod_foe':
        for (const a of adverses) poserEffet(a, { type: 'mod_foe', mods: e.mods, fin: t + e.duree });
        evenements.push(this.ev('effect', { type: 'mod_foe', mods: e.mods }));
        break;

      case 'floor_quality':
        poserEffet(j, { type: 'floor_quality', valeur: e.valeur, charges: e.charges });
        break;

      case 'shield':
        poserEffet(j, { type: 'shield', valeur: e.valeur });
        evenements.push(this.ev('effect', { type: 'shield', userId: j.userId, valeur: e.valeur }));
        break;

      case 'reflect':
        poserEffet(j, { type: 'reflect', charges: e.charges ?? 1 });
        break;

      case 'rally':
        this.rallies.push({ side: j.side, fin: t + e.duree, bonus: e.bonus });
        evenements.push(this.ev('rally', { side: j.side, duree: e.duree, bonus: e.bonus }));
        break;

      case 'per_mate': {
        // Ne compte que les coéquipiers ayant chanté récemment : la carte
        // récompense une tribune qui pousse ensemble, pas un effectif.
        const actifs = allies.filter((a) => a.userId !== j.userId && t - a.dernierChant < e.fenetre);
        const v = e.valeur * actifs.length;
        if (v > 0) this.pousser(j, v, t, evenements);
        evenements.push(this.ev('effect', { type: 'per_mate', mates: actifs.length }));
        break;
      }
      case 'sync':
        this.rallies.push({ side: j.side, fin: t + e.duree, bonus: 1, sync: true, max: e.max });
        evenements.push(this.ev('sync', { side: j.side, duree: e.duree }));
        break;

      case 'swap_fanzzy':
        // Le changement lui-même est demandé ensuite : la carte ouvre le droit.
        poserEffet(j, { type: 'peut_changer', charges: 1 });
        evenements.push(this.ev('effect', { type: 'swap_ready', userId: j.userId }));
        break;

      default:
        break;
    }
  }

  appliquerEffet(j, revers, t, evenements) {
    if (revers.type === 'breath_mult') {
      poserEffet(j, { type: 'breath_mult', valeur: revers.valeur, fin: t + revers.duree });
      evenements.push(this.ev('effect', { type: 'breath_mult', userId: j.userId }));
    }
  }

  /* ------------------------------------------------------ changement */

  changer(userId, index, t = now0()) {
    const j = this.joueur(userId);
    const droit = j.effets.find((e) => e.type === 'peut_changer' && e.charges > 0);
    if (!droit) throw new Cheat('no_substitution');
    if (!j.fanzzy[index] || index === j.actif) throw new Cheat('bad_fanzzy');
    droit.charges--;
    nettoyerEffets(j, t);
    j.actif = index;
    return [this.ev('swap', { userId, index, fanzzy: j.fanzzy[index].id })];
  }

  /* ---------------------------------------------------------- horloge */

  tick(t = now0()) {
    if (this.termine) return [];
    const evenements = [];
    const dt = (t - this.dernier) / 1000;
    this.dernier = t;

    const retour = RULES.decayPerSec * dt;
    if (this.rope > 0) this.rope = Math.max(0, this.rope - retour);
    else if (this.rope < 0) this.rope = Math.min(0, this.rope + retour);

    for (const j of this.joueurs.values()) {
      this.regen(j, t);
      nettoyerEffets(j, t);
      // Remplacement des cartes jouées, une fois le délai passé.
      if (j.remplirA && t >= j.remplirA && j.main.length < RULES.mainVisible) {
        if (!j.pioche.length) { j.pioche = j.defausse.splice(0); }
        const c = j.pioche.shift();
        if (c) { j.main.push(c); evenements.push(this.ev('draw', { userId: j.userId, cardId: c })); }
        j.remplirA = j.main.length < RULES.mainVisible ? t + RULES.refillMs : null;
      }
    }
    this.rallies = this.rallies.filter((r) => r.fin > t);

    if (t >= this.fin) {
      const [a, b] = this.goals;
      const v = a === b ? (this.rope < 0 ? 0 : this.rope > 0 ? 1 : null) : (a > b ? 0 : 1);
      this.finir(v, 'temps', evenements);
    }
    return evenements;
  }

  /* --------------------------------------------------------- snapshot */

  vue(userId) {
    const moi = this.joueurs.get(userId);
    const t = now0();
    const equipe = (side) => [...this.joueurs.values()].filter((j) => j.side === side).map((j) => ({
      userId: j.userId, nom: j.nom, ferveur: j.ferveur, connecte: j.connecte,
      fanzzy: j.fanzzy[j.actif]?.id,
      // Le souffle des autres est visible : c'est une information de jeu.
      breath: Math.round(j.breath),
    }));
    const aveugle = moi ? aEffet(moi, 'blind', t) : false;

    return {
      id: this.id, mode: this.mode, fixture: this.fixture,
      rope: Math.round(this.rope), goals: [...this.goals],
      resteMs: Math.max(0, this.fin - t),
      termine: this.termine, vainqueur: this.vainqueur,
      equipes: [equipe(0), equipe(1)],
      seq: this.seq,
      moi: moi ? {
        side: moi.side,
        breath: Math.round(moi.breath),
        ferveur: moi.ferveur,
        // Aveuglé : le joueur ne voit plus sa propre main, il joue de mémoire.
        main: aveugle ? [] : moi.main,
        aveugle,
        fanzzy: moi.fanzzy.map((f, i) => ({ ...f, actif: i === moi.actif })),
        cooldowns: Object.fromEntries(Object.entries(moi.cooldowns)
          .filter(([, fin]) => fin > t).map(([k, fin]) => [k, Math.round((fin - t) / 100) / 10])),
        effets: moi.effets.map((e) => ({ type: e.type, reste: e.fin ? e.fin - t : null })),
      } : null,
    };
  }
}
