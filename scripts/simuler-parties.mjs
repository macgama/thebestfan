/**
 * Simuler des parties : le Grand Virage, les duels de 1v1 à 5v5 et les
 * mini-jeux, joués par des supporters simulés (demande de Gaël, 27 octobre
 * 2026).
 *
 * Aucune base, aucun réseau : les moteurs du jeu (`VirageRoom`, `DuelNvN`,
 * les règles de `shared/mini-jeux.js`) tournent tels quels, sur une horloge
 * simulée. Les supporters envoient de vraies frappes, notées par le serveur ;
 * seules les seize épreuves (dessiner, viser…) reçoivent une note simulée,
 * par `simulation/crochet.mjs`.
 *
 *   node scripts/simuler-parties.mjs              tout
 *   node scripts/simuler-parties.mjs virage        le Virage seulement
 *   node scripts/simuler-parties.mjs duels         les duels seulement
 *   node scripts/simuler-parties.mjs jeux          les mini-jeux seulement
 *   node scripts/simuler-parties.mjs petits        petit club contre gros club,
 *                                                  avec et sans les cartes partagées
 *   node scripts/simuler-parties.mjs miroir        dix Virages entre tribunes égales
 *   node scripts/simuler-parties.mjs --graine=7    un autre tirage
 *
 * Ce n'est pas une suite : rien ne rougit. Le rapport sort à l'écran.
 */
import { register } from 'node:module';

register('./simulation/crochet.mjs', import.meta.url);

const args = process.argv.slice(2);
const graine = Number(args.find((a) => a.startsWith('--graine='))?.split('=')[1] ?? 2026);
const quoi = new Set(args.filter((a) => !a.startsWith('--')));
const tout = quoi.size === 0;

/* ------------------------------------------------- hasard et horloge */

let s = graine >>> 0 || 1;
Math.random = () => {
  s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
  return s / 4294967296;
};
const hasard = Math.random;
const gauss = () => {
  let u = 0; let v = 0;
  while (!u) u = hasard();
  while (!v) v = hasard();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};
const pioche = (t) => t[Math.floor(hasard() * t.length)];

let T = Date.UTC(2026, 9, 27, 19, 0, 0);
Date.now = () => T;

const { VirageRoom, RULES: RV } = await import('../src/server/ferveur/virage.js');
const { DuelNvN, RULES: RD } = await import('../src/server/nvn/engine.js');
const G = await import('../src/server/ferveur/gestures.js');
const { REGLES } = await import('../src/server/ferveur/epreuves.js');
const { CHANTS, puissanceDuChant } = await import('../src/shared/duel/chants.js');
const { ACTIONS, ACTION_BY_ID, dansLeVirage } = await import('../src/shared/duel/actions.js');
const { BY_ID } = await import('../src/shared/fanzzy/dex.js');
const { ultimePret } = await import('../src/shared/ultime.js');
const { verdictDe } = await import('../src/shared/verdict.js');
const MJ = await import('../src/shared/mini-jeux.js');
const { reglage } = await import('../src/shared/reglages.js');
const { frappesDuBot, chantDuBot, adresseDuBot } = await import('../src/server/nvn/bot.js');

/* ---------------------------------------------------------- profils */

/**
 * Cinq sortes de supporters. `sigma` : l'écart de ses frappes, en ms.
 * `epreuve` : sa note moyenne aux épreuves. `pause` : ce qu'il laisse entre
 * deux chants, en secondes. `malin` : il choisit le chant qui rapporte le
 * plus ; sinon au hasard. `cartes` : sa chance de jouer une carte à son tour.
 */
const PROFILS = {
  expert:   { sigma: 22, epreuve: 0.9, pause: 0.8, malin: true, cartes: 0.5 },
  bon:      { sigma: 45, epreuve: 0.78, pause: 1.6, malin: true, cartes: 0.4 },
  moyen:    { sigma: 80, epreuve: 0.62, pause: 3, malin: false, cartes: 0.3 },
  debutant: { sigma: 130, epreuve: 0.42, pause: 5, malin: false, cartes: 0.15 },
  /* Il est là, il chante de temps en temps, le téléphone dans la poche
     entre deux. Il compte dans la foule tant qu'il ne dépasse pas
     `virage.inactif_sec` sans geste. */
  touriste: { sigma: 80, epreuve: 0.62, pause: 30, malin: false, cartes: 0.1 },
};
const MELANGE = ['expert', 'bon', 'bon', 'moyen', 'moyen', 'moyen', 'debutant', 'debutant', 'touriste'];

/* ------------------------------------------------- frappes et durées */

const jit = (p, f = 1) => gauss() * p.sigma * f;
const humain = (taps) => {
  // Deux frappes humaines ne tombent jamais à moins de 40 ms.
  const out = [];
  for (const t of taps.sort((a, b) => a - b)) {
    const x = out.length ? Math.max(t, out.at(-1) + 45) : Math.max(0, t);
    out.push(Math.round(x));
  }
  return out;
};

/** Les frappes d'un geste, à l'adresse du supporter. Une épreuve : sa note. */
function frappes(geste, p, mods = {}, motif = 0) {
  const cfg = G.resoudreGeste(mods, { motif })[geste];
  switch (geste) {
    case 'tempo':
      return humain(Array.from({ length: cfg.beats }, (_, i) => i * cfg.interval + jit(p)));
    case 'contretemps':
      return humain(Array.from({ length: cfg.beats }, (_, i) => (i + 0.5) * cfg.interval + jit(p, 1.2)));
    case 'echo':
      return humain(cfg.instants.map((t) => t + jit(p)));
    case 'crescendo':
      return humain(cfg.instants.map((t) => t + jit(p, 1.1)));
    case 'mash': {
      const n = Math.max(1, Math.round(cfg.target * (1.08 - p.sigma / 400 + gauss() * 0.06)));
      const pas = cfg.ms / (n + 0.5);
      return humain(Array.from({ length: n }, (_, i) => i * pas + gauss() * 12));
    }
    case 'hold':
      return [0, Math.round(G.GESTURES.hold.need * (1 - Math.abs(gauss()) * p.sigma / 900))];
    case 'relance':
      return [0, Math.round(cfg.attente + jit(p, 1.5))];
    case 'tenue': {
      // Il vise un peu sous la limite, plus prudent s'il est moins sûr.
      const vise = cfg.limite * (1 - p.sigma / 1500);
      return [0, Math.round(vise + jit(p, 2))];
    }
    case 'retenue': {
      const n = Math.max(0, Math.round(cfg.exact + gauss() * p.sigma / 60));
      const pas = cfg.ms / (n + 1);
      return humain(Array.from({ length: n }, (_, i) => (i + 1) * pas + gauss() * 30));
    }
    case 'salves': {
      const t = [];
      let x = 0;
      for (let r = 0; r < cfg.rafales; r++) {
        for (let k = 0; k < cfg.parRafale; k++) { t.push(x + jit(p, 0.3)); x += 120; }
        x += cfg.silence - 120 + jit(p, 1.5);
      }
      return humain(t);
    }
    default:
      return { __note: Math.max(0, Math.min(1, p.epreuve + gauss() * 0.12)) };
  }
}

/** Le temps qu'un geste prend à jouer, en ms. */
function duree(geste) {
  const g = G.GESTURES[geste];
  if (geste === 'tempo') return g.beats * g.interval;
  if (geste === 'contretemps') return (g.beats + 1) * g.interval;
  if (geste === 'mash' || geste === 'retenue') return g.ms;
  if (geste === 'hold') return g.need + 300;
  if (geste === 'relance') return g.attente + 300;
  if (geste === 'tenue') return g.limite;
  if (geste === 'echo') return 8 * g.unite + 400;
  if (geste === 'crescendo') return 4500;
  if (geste === 'salves') return 3000;
  const r = REGLES[geste];
  if (r?.ms) return r.ms;
  if (geste === 'ola') return r.tours.reduce((a, b) => a + b, r.depart);
  if (geste === 'rouleaux') return r.lancers * r.parLancer + r.depart;
  return 9000;
}

/** La note qu'un supporter peut espérer d'un geste : son choix de chant. */
function noteEspere(geste, p) {
  if (G.GESTES.slice(0, 10).includes(geste)) return Math.max(0.1, 1 - p.sigma / 220);
  return p.epreuve;
}

function choisirChant(offre, souffle, p, cri) {
  const abordables = offre.filter((id) => CHANTS[id].cost <= souffle);
  if (!abordables.length) return null;
  if (!p.malin) return pioche(abordables);
  /* Il compare ce que le chant pousse par seconde de geste : un chant fort et
     long ne vaut pas toujours un chant moyen et court. */
  const valeur = (id) => (puissanceDuChant(CHANTS[id], cri) * noteEspere(CHANTS[id].gest, p))
    / (duree(CHANTS[id].gest) / 1000 + p.pause);
  return abordables.reduce((a, b) => (valeur(b) > valeur(a) ? b : a));
}

/* ------------------------------------------------------------ Fanzzy */

const DEX = [...BY_ID.values()];
const PREMIERS = DEX.filter((f) => f.stage === 1 && f.cri?.gest && f.rar !== 'legendaire');
const LEGENDES = DEX.filter((f) => f.rar === 'legendaire' && f.cri?.gest);
const ages = (id) => {
  const ch = [BY_ID.get(id)];
  while (ch.at(-1)?.evo && BY_ID.get(ch.at(-1).evo)) ch.push(BY_ID.get(ch.at(-1).evo));
  return ch;
};
/** Un Fanzzy au hasard, avec 8 % de légendaires (le jeu en donne 2 % par booster). */
const unFanzzy = () => (hasard() < 0.08 && LEGENDES.length ? pioche(LEGENDES) : pioche(PREMIERS));

/** Un deck de dix cartes, tirées dans tout le jeu : chacun la sienne. */
const unDeck = (sauf = null) => {
  const ids = ACTIONS.map((a) => a.id).filter((id) => !sauf?.has(ACTION_BY_ID.get(id).effet?.type));
  const d = [];
  while (d.length < 10) d.push(pioche(ids));
  return d;
};

/* ------------------------------------------------------------ compter */

const compte = () => new Map();
/* Les refus qu'un vrai joueur rencontre aussi : sa carte attend sa
   condition, l'adversaire l'a fait taire. Les autres disent un défaut. */
const REFUS_DU_JEU = new Set(['condition_not_met', 'evolution_locked', 'silenced', 'actions_locked',
  'card_on_cooldown', 'no_substitution', 'not_enough_breath']);
const plus = (m, k, n = 1) => m.set(k, (m.get(k) ?? 0) + n);
const pct = (a, b) => (b ? `${Math.round((100 * a) / b)} %` : '—');
const arr = (x, d = 1) => Number(x).toFixed(d);
const ligne = (t = '') => console.log(t);
const titre = (t) => { ligne(); ligne('═'.repeat(78)); ligne(t); ligne('═'.repeat(78)); };

/* ================================================================ Virage */

/**
 * Un Grand Virage, de `minutes` minutes de match réel.
 *
 * @param camps  [[profil…], [profil…]] : un profil par supporter
 * @param opts.buts  les vrais buts : [{ minute, camp }]
 */
function virage(camps, { minutes = 90, buts = [], nom = '', fixture = 9100, sauf = null, sansCartes = false } = {}) {
  T = Date.UTC(2026, 9, 27, 19, 0, 0) + fixture * 1000;
  const debut = T;
  const room = new VirageRoom({
    fixture: { id: fixture, homeId: 1, awayId: 2, homeName: 'Petits', awayName: 'Gros',
      status: '1H', elapsed: 0 },
    emit: () => {}, log: { warn() {}, error() {}, log() {} },
  });
  const refus = compte();
  const cartes = compte();
  const chantsDe = compte();
  const verdicts = compte();
  const joueurs = [];
  camps.forEach((profils, side) => profils.forEach((nomProfil, i) => {
    const f = unFanzzy();
    const id = `${side}-${i}`;
    const p = PROFILS[nomProfil];
    room.join(id, {
      side, name: id, mods: { id: f.id, ...(f.mods ?? {}) }, cri: f.cri,
      perso: { id: f.id, nom: f.nom, stade: 1, ages: [f.id] },
      actions: sansCartes ? [] : unDeck(sauf),
      modsBanc: f.rar === 'legendaire' ? { id: f.id } : null,
      ultime: { fanzzy: f.id, geste: f.cri.gest, nom: f.cri.label, grande: false },
    });
    // Ils n'arrivent pas tous à la même seconde.
    joueurs.push({ id, side, p, nomProfil, f, pret: T + hasard() * 8000, ultimes: 0 });
  }));

  const pas = 100;
  const fin = debut + minutes * 60_000;
  const aFaire = [...buts].sort((a, b) => a.minute - b.minute);
  let corde = { min: 0, max: 0, somme: 0, n: 0, aGauche: 0 };
  while (T < fin) {
    T += pas;
    const minute = Math.floor((T - debut) / 60_000);
    if ((T - debut) % 20_000 === 0) {
      room.matchStatus({ status: minute < 45 ? '1H' : '2H', elapsed: minute,
        homeGoals: room.scoreReel[0], awayGoals: room.scoreReel[1] });
    }
    while (aFaire.length && aFaire[0].minute <= minute) {
      const b = aFaire.shift();
      const score = [...room.scoreReel];
      score[b.camp]++;
      room.matchStatus({ elapsed: minute, homeGoals: score[0], awayGoals: score[1] });
      room.realGoal({ teamId: b.camp === 0 ? 1 : 2, minute, player: 'Buteur', score });
    }
    for (const j of joueurs) {
      if (T < j.pret) continue;
      const m = room.members.get(j.id);
      room.regen(m, T);
      let attente = 1000;
      try {
        if (ultimePret(m.jauge)) {
          room.ultimer(j.id, { taps: frappes(m.ultime.geste, j.p, room.modsDe(m), room.rangRepertoire()) });
          j.ultimes++;
          attente = duree(m.ultime.geste) + j.p.pause * 1000;
        } else if (m.main.length && hasard() < j.p.cartes) {
          const libres = m.main.filter((c) => (m.cooldowns[c] ?? 0) <= T
            && ACTION_BY_ID.get(c).cost <= m.breath);
          const c = libres.length ? pioche(libres) : null;
          if (c) {
            try { room.jouer(j.id, c); plus(cartes, c); } catch (e) { plus(refus, `carte ${c} : ${e.message}`); }
          }
          attente = 600;
        } else {
          const cardId = choisirChant(room.repertoire(), m.breath, j.p, m.cri);
          if (cardId) {
            const g = CHANTS[cardId].gest;
            const r = room.chant(j.id, { cardId, taps: frappes(g, j.p, room.modsDe(m), room.rangRepertoire()) });
            plus(chantsDe, cardId);
            plus(verdicts, r.verdict);
            attente = duree(g) + j.p.pause * 1000;
          } else {
            attente = 1500;                 // il reprend son souffle
          }
        }
      } catch (e) {
        plus(refus, e.message);
      }
      j.pret = T + attente;
    }
    room.tick(T);
    corde.min = Math.min(corde.min, room.rope);
    corde.max = Math.max(corde.max, room.rope);
    corde.somme += room.rope;
    corde.n++;
    if (room.rope < 0) corde.aGauche++;
  }
  room.classer?.(T);
  const ferveur = [0, 1].map((side) => joueurs.filter((j) => j.side === side)
    .map((j) => room.members.get(j.id).ferveur));
  const legendes = joueurs.filter((j) => j.f.rar === 'legendaire');
  return {
    nom, tailles: camps.map((c) => c.length), buts: [...room.goals], corde, refus, cartes,
    chantsDe, verdicts, ferveur, joueurs, room,
    ultimes: joueurs.reduce((n, j) => n + j.ultimes, 0),
    legendes: { n: legendes.length,
      eveillees: legendes.filter((j) => room.members.get(j.id).legende?.eveillee).length },
  };
}

function resumeVirage(r) {
  const [a, b] = r.tailles;
  ligne(`\n▶ ${r.nom}`);
  ligne(`  Tribunes : ${a} contre ${b}. Buts de tribune : ${r.buts[0]} – ${r.buts[1]}.`);
  ligne(`  Corde : penche du côté gauche ${pct(r.corde.aGauche, r.corde.n)} du temps`
    + ` (min ${arr(r.corde.min, 0)}, max ${arr(r.corde.max, 0)}, but à ±${RV.goalAt}).`);
  const moy = (t) => (t.length ? t.reduce((x, y) => x + y, 0) / t.length : 0);
  ligne(`  Ferveur moyenne par supporter : ${arr(moy(r.ferveur[0]), 0)} à gauche,`
    + ` ${arr(moy(r.ferveur[1]), 0)} à droite.`);
  const v = r.verdicts;
  const tot = [...v.values()].reduce((x, y) => x + y, 0);
  ligne(`  Chants : ${tot} (parfait ${pct(v.get('parfait') ?? 0, tot)}, bon ${pct(v.get('bon') ?? 0, tot)},`
    + ` moyen ${pct(v.get('moyen') ?? 0, tot)}, raté ${pct(v.get('rate') ?? 0, tot)}).`
    + ` Cartes : ${[...r.cartes.values()].reduce((x, y) => x + y, 0)}. Ultimates : ${r.ultimes}.`);
  if (r.legendes.n) ligne(`  Légendaires en tribune : ${r.legendes.n}, éveillés : ${r.legendes.eveillees}.`);
  if (r.refus.size) {
    ligne('  Refus du serveur :');
    for (const [k, n] of [...r.refus].sort((x, y) => y[1] - x[1]).slice(0, 8)) ligne(`    ${n} × ${k}`);
  }
}

/* ================================================================= duels */

function loadoutDuel() {
  const fanzzy = [];
  while (fanzzy.length < 3) {
    // Un légendaire n'est jamais titulaire : jamais en premier.
    const f = fanzzy.length === 0 ? pioche(PREMIERS) : unFanzzy();
    if (fanzzy.some((x) => x.id === f.id)) continue;
    const lignee = ages(f.id);
    const debloque = 1 + Math.floor(hasard() * lignee.length);
    const jouables = lignee.slice(0, debloque).map((d, i) => ({
      id: f.id, nom: d.nom, type: d.type, cri: d.cri, stage: i + 1,
      mods: { id: f.id, ...(d.mods ?? {}) } }));
    fanzzy.push({ ...jouables[0], stade: 1, ages: jouables,
      legende: f.rar === 'legendaire', ...(f.rar === 'legendaire' ? { modsBanc: { id: f.id } } : {}) });
  }
  return { fanzzy, actions: unDeck().map((id) => ACTION_BY_ID.get(id)) };
}

/**
 * Un duel. `camps` : [[profil…], [profil…]]. `bot` : le profil « bot
 * d'entraînement », qui reproduit le bot du jeu (`nvn/index.js`, `horloge`) :
 * huit frappes de tempo, quel que soit le chant, toutes les 6 à 11 s.
 */
function duel(camps, { id = 'd', butsReels = 0 } = {}) {
  T += 3_600_000;
  const t0 = T;
  const equipes = camps.map((eq, side) => eq.map((nomProfil, i) => ({
    userId: `${side}-${i}`, nom: `${nomProfil}${i}`, loadout: loadoutDuel() })));
  const d = new DuelNvN({ id, equipes, fixture: { id: 7001, elapsed: 20,
    home: { id: 85, name: 'A' }, away: { id: 91, name: 'B' } }, now: T });
  const refus = compte();
  const joueurs = camps.flatMap((eq, side) => eq.map((nomProfil, i) => ({
    id: `${side}-${i}`, side, nomProfil, p: PROFILS[nomProfil] ?? PROFILS.debutant,
    bot: nomProfil === 'bot', pret: T + 1000 + hasard() * 3000 })));
  const momentsButReel = Array.from({ length: butsReels }, () => t0 + hasard() * RD.dureeMs);
  let cartes = 0; let ultimes = 0; let changements = 0; let releves = 0;
  while (!d.termine) {
    T += 100;
    for (const mt of momentsButReel) {
      if (mt > T - 100 && mt <= T) d.butReel({ teamId: hasard() < 0.5 ? 85 : 91, minute: 30 });
    }
    for (const x of joueurs) {
      if (T < x.pret || d.termine) continue;
      const j = d.joueur(x.id);
      d.regen(j, T);
      try {
        if (x.bot) {
          // Le bot du jeu, avec son code (`nvn/bot.js`) et son rythme (`horloge`).
          x.pret = T + 6000 + hasard() * 5000;
          x.adresse ??= adresseDuBot();
          const tape = (g) => frappesDuBot(g, x.adresse, j.fanzzy[j.actif]?.mods ?? {}, j.motif);
          if (ultimePret(j.ultime) && hasard() < 0.5) {
            d.ultimer(x.id, { taps: tape(j.fanzzy[j.actif]?.cri?.gest ?? 'tempo') }, T); ultimes++; continue;
          }
          const c = pioche(j.main);
          if (c && hasard() < 0.35) { d.jouer(x.id, c, T); cartes++; continue; }
          const chant = chantDuBot(d.offreDe(j));
          d.chanter(x.id, { cardId: chant, taps: tape(CHANTS[chant].gest) }, T);
          continue;
        }
        let attente = 800;
        const f = j.fanzzy[j.actif];
        if (ultimePret(j.ultime)) {
          d.ultimer(x.id, { taps: frappes(f.cri?.gest ?? 'tempo', x.p, f.mods, j.motif) }, T);
          ultimes++;
          attente = duree(f.cri?.gest ?? 'tempo') + x.p.pause * 1000;
        } else if (j.main.length && hasard() < x.p.cartes) {
          const libres = j.main.filter((c) => (j.cooldowns[c] ?? 0) <= T
            && ACTION_BY_ID.get(c).cost <= j.breath);
          const c = libres.length ? pioche(libres) : null;
          if (c) {
            const ev = d.jouer(x.id, c, T);
            cartes++;
            if (c === 'a-releve') releves++;
            // L'arbitre ouvre un changement : il le prend.
            if (c === 'a-arbitre') {
              const k = j.fanzzy.findIndex((z, i) => i !== j.actif && (!z.legende || j.legende?.eveillee));
              if (k >= 0) { d.changer(x.id, k, T); changements++; }
            }
            void ev;
          }
        } else {
          const cardId = choisirChant(d.offreDe(j), j.breath, x.p, f.cri);
          if (cardId) {
            d.chanter(x.id, { cardId, taps: frappes(CHANTS[cardId].gest, x.p, f.mods, j.motif) }, T);
            attente = duree(CHANTS[cardId].gest) + x.p.pause * 1000;
          } else attente = 1500;
        }
        x.pret = T + attente;
      } catch (e) {
        plus(refus, e.message);
        x.pret = T + 1000;
      }
    }
    d.tick(T);
  }
  const b = d.bilan();
  return { goals: b.goals, vainqueur: b.vainqueur, dureeMs: T - t0, refus, cartes, ultimes,
    changements, releves, bilan: b };
}

function serieDeDuels(n, campsDe, opts = {}) {
  const r = { n, v0: 0, v1: 0, nul: 0, buts: 0, minutes: 0, cartes: 0, ultimes: 0,
    changements: 0, releves: 0, refus: compte(), avantTemps: 0 };
  for (let i = 0; i < n; i++) {
    const x = duel(campsDe(i), { id: `d${i}`, ...opts });
    if (x.vainqueur === 0) r.v0++; else if (x.vainqueur === 1) r.v1++; else r.nul++;
    r.buts += x.goals[0] + x.goals[1];
    r.minutes += x.dureeMs / 60_000;
    if (x.dureeMs < RD.dureeMs - 1000) r.avantTemps++;
    r.cartes += x.cartes; r.ultimes += x.ultimes; r.changements += x.changements; r.releves += x.releves;
    for (const [k, v] of x.refus) plus(r.refus, k, v);
  }
  return r;
}

function resumeDuels(nom, r, gauche = 'gauche', droite = 'droite') {
  ligne(`\n▶ ${nom} (${r.n} duels)`);
  ligne(`  ${gauche} gagne ${pct(r.v0, r.n)}, ${droite} gagne ${pct(r.v1, r.n)}, nul ${pct(r.nul, r.n)}.`
    + ` ${arr(r.buts / r.n)} buts par duel, ${arr(r.minutes / r.n)} min en moyenne,`
    + ` ${pct(r.avantTemps, r.n)} finis avant le temps.`);
  ligne(`  Par duel : ${arr(r.cartes / r.n)} cartes, ${arr(r.ultimes / r.n)} Ultimates,`
    + ` ${arr(r.changements / r.n)} changements, ${arr(r.releves / r.n)} Relèves.`);
  const jeu = [...r.refus].filter(([k]) => REFUS_DU_JEU.has(k));
  const autres = [...r.refus].filter(([k]) => !REFUS_DU_JEU.has(k));
  if (jeu.length) ligne(`  Refus normaux (carte qui attend sa condition, joueur réduit au silence…) : `
    + `${jeu.reduce((n, [, v]) => n + v, 0)}.`);
  if (autres.length) ligne(`  Refus anormaux : ${autres.map(([k, v]) => `${k} ×${v}`).join(', ')}`);
}

/* ============================================================ mini-jeux */

function jongles() {
  // Un ballon qui retombe de plus en plus vite : l'écart entre deux frappes
  // raccourcit avec le compte, jusqu'à ce que le joueur rate.
  const partie = (p) => {
    const t = []; let x = 0;
    for (let k = 0; k < 2000; k++) {
      const g = Math.min(MJ.JONGLES.graviteMax, MJ.JONGLES.gravite + k * MJ.JONGLES.graviteParJongle);
      const vol = (2 * MJ.JONGLES.elan / g) * 1000;           // temps de vol, en ms
      x += Math.max(MJ.JONGLES.ECART_MIN_MS, vol);
      // Plus c'est rapide, plus on risque de rater ; l'adresse aide.
      if (hasard() < (p.sigma / 2200) * (1 + k / 40)) break;
      t.push(Math.round(x));
    }
    return t;
  };
  const gains = { parEcharpe: reglage('jeux.jongles_par_echarpe'), maxPartie: reglage('jeux.jongles_max_partie') };
  for (const nom of ['expert', 'moyen', 'debutant']) {
    const scores = Array.from({ length: 200 }, () => partie(PROFILS[nom]));
    const ok = scores.filter((f) => MJ.scoreDeJongles(f.length, f, (f.at(-1) ?? 0) + 500) !== null).length;
    const moy = scores.reduce((a, f) => a + f.length, 0) / scores.length;
    const g = scores.reduce((a, f) => a + MJ.gainDeJongles(f.length, gains), 0) / scores.length;
    ligne(`  Jongles, ${nom} : ${arr(moy, 0)} en moyenne, ${arr(g)} écharpes par partie,`
      + ` ${pct(ok, scores.length)} acceptées par le serveur.`);
  }
  const triche = Array.from({ length: 50 }, (_, i) => i * 250);
  ligne(`  Jongles trop rapides (250 ms) : ${MJ.scoreDeJongles(50, triche, 20000) === null ? 'refusés' : 'ACCEPTÉS'}.`);
}

function tirs() {
  const strat = {
    'au hasard': () => ({ zone: Math.floor(hasard() * 6), force: hasard() }),
    'fort, juste sous la barre': () => ({ zone: Math.floor(hasard() * 6), force: 0.9 }),
    'toujours au même endroit': () => ({ zone: 2, force: 0.8 }),
  };
  for (const [nom, tir] of Object.entries(strat)) {
    let v = 0; let nul = 0; let buts = 0;
    for (let i = 0; i < 2000; i++) {
      const moi = MJ.jeuDeTirs({ tirs: Array.from({ length: 5 }, tir),
        arrets: Array.from({ length: 5 }, () => Math.floor(hasard() * 6)) });
      const r = MJ.reglerTirs(moi, MJ.jeuDeLaMachine(i + 1));
      if (r.gagnant === 'a') v++; else if (r.gagnant === 'nul') nul++;
      buts += r.butsA;
    }
    ligne(`  Tirs au but contre la machine, ${nom} : gagne ${pct(v, 2000)}, nul ${pct(nul, 2000)},`
      + ` ${arr(buts / 2000)} buts sur 5.`);
  }
  // Le gardien qui plonge toujours au même endroit, contre la machine.
  let v = 0;
  for (let i = 0; i < 2000; i++) {
    const moi = MJ.jeuDeTirs({ tirs: Array.from({ length: 5 }, () => ({ zone: Math.floor(hasard() * 6), force: 0.9 })),
      arrets: [0, 0, 0, 0, 0] });
    if (MJ.reglerTirs(moi, MJ.jeuDeLaMachine(i + 1)).gagnant === 'a') v++;
  }
  ligne(`  Tirs, fort et en plongeant toujours à gauche : gagne ${pct(v, 2000)}.`);
}

function chantRythme() {
  const gains = { parEcharpe: reglage('jeux.chant_par_echarpe'), maxPartie: reglage('jeux.chant_max_partie') };
  for (const nom of ['expert', 'bon', 'moyen', 'debutant']) {
    const p = PROFILS[nom];
    let score = 0; let gain = 0;
    for (let i = 0; i < 100; i++) {
      const part = MJ.partitionDuChant(i + 11);
      const frappes = part.notes.filter(() => hasard() > p.sigma / 600)
        .map((n) => ({ c: n.c, t: Math.max(0, n.t + gauss() * p.sigma * 0.8) }))
        .sort((a, b) => a.t - b.t);
      const b = MJ.noterChant(part, frappes);
      score += b.score; gain += MJ.gainDeScore(b.score, gains);
    }
    ligne(`  Chant en rythme, ${nom} : ${arr(score / 100, 0)} points, ${arr(gain / 100)} écharpes par partie.`);
  }
  // Taper partout, sur les trois tambours, toutes les 50 ms.
  const part = MJ.partitionDuChant(5);
  const spam = [];
  for (let t = 0; t < MJ.CHANT.DUREE_MS; t += 150) for (let c = 0; c < 3; c++) spam.push({ c, t: t + c * 50 });
  const b = MJ.noterChant(part, spam);
  ligne(`  Chant en rythme, taper partout : ${b === null ? 'refusé' : `${b.score} points`}.`);
}

function deplacement() {
  const gains = { parEcharpe: reglage('jeux.deplacement_par_echarpe'), maxPartie: reglage('jeux.deplacement_max_partie') };
  /* Il saute un dixième de seconde avant l'obstacle, à quelques centièmes
     près : l'écart de ce « quelques » fait toute la différence entre les
     niveaux. Un instant décidé une fois par obstacle, pas à chaque image. */
  for (const [nom, bruit] of [['expert', 0.012], ['moyen', 0.03], ['debutant', 0.05]]) {
    let score = 0; let gain = 0; let refuse = 0;
    for (let i = 0; i < 60; i++) {
      const course = MJ.nouvelleCourse(i + 101);
      const gestes = [];
      const vise = new Map();
      while (!course.etat.fini) {
        const e = course.etat;
        const devant = e.dist + MJ.COURSE.X + MJ.COURSE.LARGEUR;
        const o = e.route.find((x) => x.type !== 'ticket' && x.x + x.l > e.dist + MJ.COURSE.X);
        let g = 0;
        if (o) {
          if (!vise.has(o)) vise.set(o, 0.11 + gauss() * bruit);
          const ecart = o.x - devant;
          if (o.type === 'peage') { if (ecart > 0 && ecart < e.v * (vise.get(o) + 0.05) && e.glisse < 3) g = 2; }
          else if (ecart > 0 && ecart < e.v * vise.get(o) && e.y === 0) g = 1;
        }
        if (g) gestes.push([e.image, g]);
        course.pas(g);
      }
      const r = MJ.rejouerCourse(i + 101, gestes);
      if (!r || r.score !== MJ.scoreDeCourse(course.etat).score) refuse++;
      score += r?.score ?? 0; gain += MJ.gainDeScore(r?.score ?? 0, gains);
    }
    ligne(`  Déplacement, ${nom} : ${arr(score / 60, 0)} points, ${arr(gain / 60)} écharpes`
      + `${refuse ? `, ${refuse} parties rejouées autrement par le serveur` : ', le serveur retrouve le même score'}.`);
  }
}

function tifo() {
  const casesJour = reglage('jeux.tifo_cases_jour');
  const part = reglage('jeux.tifo_seuil') / 100;
  const motif = MJ.motifDuTifo(MJ.lettresDuClub('FCB', 'Barcelona'));
  const cases = MJ.TIFO.COLONNES * MJ.TIFO.RANGS;
  ligne(`  Tifo : ${cases} cases, ${casesJour} par supporter et par jour, réussi à ${part * 100} %`
    + ' de ce que la tribune peut peindre en une semaine.');
  for (const peintres of [1, 2, 3, 5, 10, 20]) {
    // Comme seuilDuTifo (src/server/jeux/index.js), en part des 240 cases.
    const seuil = Math.ceil(part * 100 * Math.min(cases, peintres * casesJour * 7) / cases) / 100;
    // Ils peignent chaque jour de la semaine, juste à 95 %.
    let jours = null;
    const grille = new Array(cases).fill(null);
    const ordre = [...grille.keys()].sort(() => hasard() - 0.5);
    let k = 0;
    for (let jour = 1; jour <= 7 && jours === null; jour++) {
      for (let n = 0; n < peintres * casesJour && k < cases; n++, k++) {
        const c = ordre[k];
        grille[c] = hasard() < 0.95 ? motif[c] : (motif[c] + 1) % 3;
      }
      if (MJ.fideliteDuTifo(motif, grille) >= seuil) jours = jour;
    }
    ligne(`    ${peintres} peintre(s) assidu(s) : ${jours ? `réussi en ${jours} jour(s)` : 'pas réussi en 7 jours'}.`);
  }
}

function boss() {
  const parSupp = reglage('jeux.boss_voix_par_supporter');
  const min = reglage('jeux.boss_voix_min');
  ligne(`  Boss de la semaine : ${parSupp} chants réussis par supporter du club, au moins ${min}.`);
  for (const n of [1, 3, 5, 20, 200]) {
    const voix = Math.max(min, parSupp * n);
    ligne(`    ${n} supporter(s) : ${voix} chants réussis à faire, soit ${arr(voix / n, 0)} chacun.`);
  }
}

/* ============================================================= le rapport */

const moitie = (n) => Array.from({ length: n }, (_, i) => MELANGE[i % MELANGE.length]);
const de = (profil, n) => Array.from({ length: n }, () => profil);

if (tout || quoi.has('virage')) {
  titre('LE GRAND VIRAGE');
  resumeVirage(virage([moitie(20), moitie(20)], { nom: '20 contre 20, tribunes mêlées, 90 minutes, 3 vrais buts',
    buts: [{ minute: 23, camp: 0 }, { minute: 58, camp: 1 }, { minute: 81, camp: 1 }], fixture: 9101 }));
  resumeVirage(virage([de('bon', 20), de('bon', 20)], { nom: '20 bons contre 20 bons (miroir), 45 minutes',
    minutes: 45, fixture: 9102 }));

  titre('PETIT CLUB CONTRE GROS CLUB (même mélange de niveaux des deux côtés)');
  for (const [a, b, min] of [[1, 20, 45], [3, 20, 45], [5, 50, 45], [20, 200, 20], [60, 1500, 8]]) {
    resumeVirage(virage([moitie(a), moitie(b)], { nom: `${a} contre ${b}, ${min} minutes`, minutes: min,
      fixture: 9200 + a }));
  }
  titre('LE NIVEAU CONTRE LE NOMBRE');
  resumeVirage(virage([de('bon', 3), moitie(40)], { nom: '3 bons contre 40 mêlés, 45 minutes', minutes: 45, fixture: 9301 }));
  resumeVirage(virage([de('moyen', 5), [...de('moyen', 10), ...de('touriste', 30)]],
    { nom: '5 moyens assidus contre 10 moyens + 30 touristes, 45 minutes', minutes: 45, fixture: 9302 }));
  resumeVirage(virage([de('debutant', 3), de('expert', 3)], { nom: '3 débutants contre 3 experts, 30 minutes',
    minutes: 30, fixture: 9303 }));
}

if (quoi.has('petits')) {
  const C = new Set(['per_mate', 'sync']);
  for (const [a, b] of [[3, 20], [5, 50], [20, 200]]) {
    for (const [q2, o] of [['toutes cartes', {}], ['sans Mosaïque, Présentation, Chœur', { sauf: C }], ['sans cartes', { sansCartes: true }]]) {
      const tot = [0, 0];
      for (let k = 0; k < 4; k++) {
        const r = virage([moitie(a), moitie(b)], { nom: '', minutes: 15, fixture: 9950 + k * 7 + a, ...o });
        tot[0] += r.buts[0]; tot[1] += r.buts[1];
      }
      ligne(`${a} contre ${b}, ${q2.padEnd(36)} 4 × 15 min : ${tot[0]} – ${tot[1]}`);
    }
  }
}

if (quoi.has('miroir')) {
  for (let k = 0; k < 10; k++) {
    const r = virage([de('bon', 10), de('bon', 10)], { nom: 'miroir', minutes: 10, fixture: 9900 + k });
    const pw = (side) => { const js = r.joueurs.filter((j) => j.side === side);
      return arr(js.reduce((a, j) => a + (j.f.cri.power ?? 0), 0) / js.length, 0); };
    ligne(`miroir ${k} buts ${r.buts.join('-')} cri moyen ${pw(0)} / ${pw(1)}`);
  }
}

if (tout || quoi.has('duels')) {
  titre('LES DUELS');
  for (const n of [1, 2, 3, 4, 5]) {
    const r = serieDeDuels(60, () => [Array.from({ length: n }, () => pioche(MELANGE.slice(0, 8))),
      Array.from({ length: n }, () => pioche(MELANGE.slice(0, 8)))], { butsReels: 1 });
    resumeDuels(`${n}v${n}, niveaux tirés au hasard, un vrai but pendant le duel`, r);
  }
  for (const n of [1, 3, 5]) {
    resumeDuels(`${n}v${n}, bons contre bons`, serieDeDuels(40, () => [de('bon', n), de('bon', n)]));
  }
  for (const n of [1, 3, 5]) {
    resumeDuels(`${n}v${n}, experts contre débutants`, serieDeDuels(40, () => [de('expert', n), de('debutant', n)]),
      'les experts', 'les débutants');
  }
  resumeDuels('1v1, débutant contre le bot d’entraînement du jeu',
    serieDeDuels(60, () => [['debutant'], ['bot']]), 'le débutant', 'le bot');
  resumeDuels('3v3, moyens contre bots d’entraînement',
    serieDeDuels(40, () => [de('moyen', 3), de('bot', 3)]), 'les moyens', 'les bots');
  /* Ce que le bot du jeu obtient, chant par chant, à adresse moyenne. */
  ligne('\n▶ Le bot d’entraînement, chant par chant (adresse 0,42)');
  const parGeste = [];
  for (const [id, c] of Object.entries(CHANTS)) {
    let q = 0; let err = null;
    for (let i = 0; i < 40; i++) {
      try { q += G.grade(c.gest, frappesDuBot(c.gest, 0.42), {}, { motif: 0 }); } catch (e) { err = e.message; }
    }
    parGeste.push(`${id} ${err ? `refusé (${err})` : arr(q / 40, 2)}`);
  }
  ligne(`  ${parGeste.join(' · ')}`);
}

if (tout || quoi.has('jeux')) {
  titre('LES MINI-JEUX');
  jongles();
  tirs();
  chantRythme();
  deplacement();
  tifo();
  boss();
}
ligne();
