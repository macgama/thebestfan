/**
 * Banc d'audit : chaque chant bien chanté fait-il bouger la corde, dans le
 * duel et au Virage ? Et les bonus/malus du Fanzzy et de l'équipement
 * changent-ils vraiment le geste et la poussée ?
 *
 * Gaël, 5 novembre 2026 : « Est-ce que les gestes font bien bouger la
 * corde ? » et « Est-ce que les bonus/malus du Fanzzy et des objets de stuff
 * fonctionnent bien durant les duels et virages ? »
 *
 * Le banc sait écrire une exécution réussie des seize gestes qu'il mesure à
 * la main (les dix de rythme et les six de novembre) ; les quatorze autres
 * épreuves sont jouées au doigt, dans la vraie page, par `epreuves-ui-smoke`.
 * La poussée qui suit la note est la même pour tous les gestes.
 *
 *     npm run gestes-audit:test
 */
import { CHANTS, ORDRE } from '../src/shared/duel/chants.js';
import { DuelNvN, modsPortes, avecLieu } from '../src/server/nvn/engine.js';
import { VirageRoom } from '../src/server/ferveur/virage.js';
import { ACTION_BY_ID } from '../src/shared/duel/actions.js';
import { modsAvecEffets } from '../src/shared/duel/effets.js';
import { resoudreGeste, grade, GESTES } from '../src/server/ferveur/gestures.js';
import { flammeA } from '../src/server/ferveur/epreuves.js';
import { combine, STUFF } from '../src/shared/fanzzy/inventaire.js';
import { DEX } from '../src/shared/fanzzy/dex.js';

let rouges = 0;
const check = (nom, ok, ...detail) => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${nom}`);
  if (!ok) { rouges++; if (detail.length) console.log('       ', ...detail); }
};

/* ---------------------------------------------- une exécution réussie */

const tremble = (i) => [3, -4, 6, -2, 5, -5, 2][i % 7];
function reussite(geste, mods = {}, motif = 0) {
  const g = resoudreGeste(mods, { motif })[geste];
  const pile = (instants) => instants.map((t, i) => Math.round(t + tremble(i)));
  switch (geste) {
    case 'tempo': return pile(Array.from({ length: g.beats }, (_, i) => i * g.interval));
    case 'contretemps': return pile(Array.from({ length: g.beats }, (_, i) => (i + 0.5) * g.interval));
    case 'echo': case 'crescendo': return pile(g.instants);
    case 'mash': return pile(Array.from({ length: g.target }, (_, i) => i * Math.floor(g.ms / (g.target + 1))));
    case 'hold': return [0, g.need];
    case 'relance': return [0, g.attente];
    case 'tenue': return [0, Math.round(g.limite * 0.98)];
    case 'retenue': return pile(Array.from({ length: g.exact }, (_, i) => (i + 0.5) * Math.floor(g.ms / g.exact)));
    case 'salves': {
      const t = []; let h = 0;
      for (let r = 0; r < g.rafales; r++) {
        for (let i = 0; i < g.parRafale; i++) { t.push(h + tremble(t.length)); h += 120; }
        h += g.silence - 120;
      }
      return t;
    }
    case 'accents': {
      const frappes = [];
      for (const x of g.liste) {
        frappes.push(x.t + tremble(frappes.length));
        if (x.accent) frappes.push(x.t + 140 + tremble(frappes.length));
      }
      return { frappes };
    }
    case 'leurres':
      return { touches: g.signaux.filter((x) => x.vrai).map((x, i) => x.t + 60 + tremble(i) * 3) };
    case 'puzzle': {
      const n = g.colonnes * g.rangees;
      return { poses: Array.from({ length: n }, (_, i) => ({ piece: i, place: i, t: 300 + i * 400 + tremble(i) * 5 })) };
    }
    case 'cortege': {
      const pas = [];
      let voie = Math.floor(g.voies / 2);
      let horloge = 0;
      for (const r of g.rangs) {
        let t = horloge;
        while (voie !== r.libre) {
          voie += r.libre > voie ? 1 : -1;
          t += 90 + pas.length % 3;
          pas.push({ t, voie });
        }
        horloge = r.t + 20;
      }
      return { pas };
    }
    case 'justesse': {
      const pasL = 1 / g.lignes;
      const mesures = [];
      for (let t = 0; t < g.ms; t += g.echantillon) {
        const n = g.notes.find((x) => t >= x.t + g.grace && t < x.t + x.d);
        if (n) mesures.push({ t, v: (n.ligne + 0.5) * pasL + 0.01 });
      }
      return { mesures };
    }
    case 'meche': {
      const mesures = [];
      const debut = g.cles[0].t, fin = g.cles[g.cles.length - 1].t;
      for (let t = debut; t <= fin; t += g.echantillon) {
        const f = flammeA(g, t);
        mesures.push({ t, x: f.x + 0.01, y: f.y });
      }
      return { mesures };
    }
    default: return null;
  }
}

const MESURES = [...new Set(ORDRE.map((id) => CHANTS[id].gest))]
  .filter((g) => reussite(g) !== null);
console.log(`\n  les gestes mesurés ici : ${MESURES.length} sur ${GESTES.length}`);
for (const g of MESURES) {
  let q = null;
  try { q = grade(g, reussite(g)); } catch (e) { q = e.message; }
  check(`${g} : une exécution réussie est notée (${typeof q === 'number' ? q.toFixed(2) : q})`,
    typeof q === 'number' && q >= 0.8);
}

/* ------------------------------------------------------------ le duel */

const FOND = Array(10).fill('a-thermos');
const unFanzzy = (mods = {}, gest = 'tempo') => ({ id: 'X1', nom: 'X', type: 'voix', stage: 1, stade: 1,
  cri: { gest, label: 'x', power: 44 }, mods, ages: [], stuff: [] });
function duel(mods0 = {}, gest = 'tempo') {
  const t = 1_000_000;
  const d = new DuelNvN({ id: 'g', now: t,
    equipes: [[{ userId: 'a', nom: 'A', loadout: { fanzzy: [unFanzzy(mods0, gest)], actions: FOND.map((i) => ACTION_BY_ID.get(i)) } }],
      [{ userId: 'b', nom: 'B', loadout: { fanzzy: [unFanzzy()], actions: FOND.map((i) => ACTION_BY_ID.get(i)) } }]],
    fixture: { id: 7201, elapsed: 30, status: '1H', home: { id: 85 }, away: { id: 91 } } });
  d.stade = null;               // sans lieu : on mesure le Fanzzy seul
  return { d, t };
}
const modsDuel = (d, j, t) => modsAvecEffets(avecLieu(modsPortes(j), d.stade), j.effets, t);

console.log('\n  le duel : un chant réussi tire la corde de son côté');
for (const id of ORDRE.filter((c) => MESURES.includes(CHANTS[c].gest))) {
  const { d, t } = duel();
  d.repertoire = [id, ...ORDRE.filter((x) => x !== id).slice(0, 4)];
  const ja = d.joueurs.get('a'); ja.breath = 100;
  const jb = d.joueurs.get('b'); jb.breath = 100;
  let ra, rb;
  try {
    d.chanter('a', { cardId: id, taps: reussite(CHANTS[id].gest, modsDuel(d, ja, t), ja.motif) }, t);
    ra = d.rope;
    d.chanter('b', { cardId: id, taps: reussite(CHANTS[id].gest, modsDuel(d, jb, t), jb.motif) }, t + 10);
    rb = d.rope;
  } catch (e) { ra = e.message; }
  check(`${id} (${CHANTS[id].gest}) : la tribune 0 tire, puis la tribune 1 la ramène`,
    typeof ra === 'number' && ra < -10 && rb > ra + 10, `corde ${ra} puis ${rb}`);
}

/* ---------------------------------------------------------- le Virage */

let maintenant = 5_000_000;
const vraiNow = Date.now;
Date.now = () => maintenant;
function salle(mods = {}) {
  const room = new VirageRoom({
    fixture: { id: 9951, homeId: 1, awayId: 2, homeName: 'A', awayName: 'B', leagueId: 1,
      kickoffAt: new Date(maintenant), status: '1H', elapsed: 20 },
    emit: () => {}, log: { warn() {}, error() {} },
  });
  room.motifsAdmis = () => [0];
  room.stade = () => null;
  room.join('u', { side: 0, name: 'u', mods });
  room.join('v', { side: 1, name: 'v' });
  return room;
}
console.log('\n  le Virage : un chant réussi tire la corde de son côté');
for (const id of ORDRE.filter((c) => MESURES.includes(CHANTS[c].gest))) {
  maintenant += 60_000;
  const room = salle();
  room.repertoire = () => [id];
  let ra, rb;
  try {
    room.members.get('u').breath = 100;
    room.chant('u', { cardId: id, taps: reussite(CHANTS[id].gest) });
    ra = room.rope;
    room.members.get('v').breath = 100;
    room.chant('v', { cardId: id, taps: reussite(CHANTS[id].gest) });
    rb = room.rope;
  } catch (e) { ra = e.message; }
  check(`${id} (${CHANTS[id].gest}) : le domicile tire, puis l'extérieur la ramène`,
    typeof ra === 'number' && ra < -5 && rb > ra + 5, `corde ${ra} puis ${rb}`);
}

/* ----------------------------------- les bonus et malus, clé par clé

   Chaque clé que portent les Fanzzy et les pièces, posée seule sur le
   Fanzzy en tribune : le même geste, joué de la même façon, doit pousser
   autrement (ou coûter autrement) qu'avec un Fanzzy nu. */

const CLES = new Set();
for (const x of [...DEX, ...STUFF]) for (const k of Object.keys(x.mods ?? {})) CLES.add(k);

/* Pour chaque clé : un mod, le chant qui le révèle, et ce qu'on compare. */
const EPREUVE_DE = {
  tempoWindow: { mod: 1.6, chant: 'reprise', taps: (m) => reussite('tempo').map((t, i) => t + (i % 2 ? 150 : -150)), plus: true },
  tempoInterval: { mod: 80, chant: 'reprise', taps: () => reussite('tempo'), plus: false },
  mashBonus: { mod: 1.2, chant: 'roulement', taps: () => reussite('mash').slice(0, 15), plus: true },
  mashTime: { mod: -800, chant: 'roulement', taps: () => reussite('mash').slice(0, 15), plus: true },
  holdBonus: { mod: 1.2, chant: 'onetaitla', taps: () => [0, 2500], plus: true },
  holdForgive: { mod: 1, chant: 'onetaitla', taps: () => [0, 1500, 1600, 3300], plus: true },
  perfectBonus: { mod: 1.3, chant: 'reprise', taps: () => reussite('tempo'), plus: true },
  /* Un geste à moitié raté (note ~0,3) : avec le retour de flamme, il pousse
     dans le mauvais sens. */
  backfire: { mod: true, chant: 'reprise', taps: () => reussite('tempo').map((t, i) => t + (i % 2 ? 140 : -140)), plus: false },
  breathBonus: { mod: 1.3, souffle: true, plus: true },
  refundBonus: { mod: 1.4, chant: 'reprise', taps: () => reussite('tempo'), souffleApres: true, plus: true },
  costPenalty: { mod: 1.3, chant: 'reprise', taps: () => reussite('tempo'), souffleApres: true, plus: false },
};

function mesureDuel(mods, e) {
  const { d, t } = duel(mods);
  const j = d.joueurs.get('a');
  if (e.souffle) { j.breath = 0; j.regenAt = t; d.regen(j, t + 1000); return j.breath; }
  d.repertoire = [e.chant, ...ORDRE.filter((x) => x !== e.chant).slice(0, 4)];
  j.breath = 100; j.regenAt = t;
  d.chanter('a', { cardId: e.chant, taps: e.taps(mods) }, t);
  return e.souffleApres ? j.breath : -d.rope;
}
function mesureVirage(mods, e) {
  maintenant += 60_000;
  const room = salle(mods);
  const m = room.members.get('u');
  if (e.souffle) { m.breath = 0; m.regenAt = maintenant; maintenant += 1000; room.regen(m, maintenant); return m.breath; }
  room.repertoire = () => [e.chant];
  m.breath = 100; m.regenAt = maintenant;
  room.chant('u', { cardId: e.chant, taps: e.taps(mods) });
  return e.souffleApres ? m.breath : -room.rope;
}

console.log('\n  les bonus et malus, clé par clé (duel puis Virage)');
for (const cle of [...CLES].filter((k) => !['parryBonus', 'parryResist'].includes(k))) {
  const e = EPREUVE_DE[cle];
  if (!e) { check(`${cle} : mesuré`, false, 'le banc ne connaît pas cette clé'); continue; }
  for (const [nom, mesure] of [['duel', mesureDuel], ['Virage', mesureVirage]]) {
    let nu, avec;
    try { nu = mesure({}, e); avec = mesure({ [cle]: e.mod }, e); } catch (x) { nu = x.message; }
    const ok = typeof nu === 'number' && (e.plus ? avec > nu + 0.01 : avec < nu - 0.01);
    check(`${cle} = ${e.mod} change le jeu au ${nom}`, ok, `sans ${nu}, avec ${avec}`);
  }
}

/* Contre et Résistance : la durée d'une entrave posée et subie. */
{
  const t = 1_000_000;
  const dureeSilence = (modsA, modsB) => {
    const { d } = duel(modsA);
    d.joueurs.get('b').fanzzy[0].mods = modsB;
    const a = d.joueurs.get('a'); a.breath = 100; a.main[0] = 'a-silence';
    d.jouer('a', 'a-silence', t);
    return d.joueurs.get('b').effets.find((x) => x.type === 'silence').fin - t;
  };
  const base = dureeSilence({}, {});
  check('parryBonus (Contre) allonge l’entrave posée en duel', dureeSilence({ parryBonus: 1.5 }, {}) > base);
  check('parryResist (Résistance) raccourcit l’entrave subie en duel', dureeSilence({}, { parryResist: 1.5 }) < base);
}

/* L'équipement passe par `combine` : une pièce posée change le total. */
{
  const piece = STUFF.find((s) => s.publie !== false && s.mods?.tempoWindow > 1);
  const total = combine({ tempoWindow: 1.2 }, [piece.id]);
  check(`une pièce portée (${piece.id}) entre dans le total du Fanzzy`,
    Math.abs(total.tempoWindow - 1.2 * piece.mods.tempoWindow) < 1e-9, JSON.stringify(total));
  const deux = STUFF.filter((s) => s.publie !== false && s.mods?.breathBonus).slice(0, 2);
  const t2 = combine({}, deux.map((s) => s.id));
  check('deux pièces se composent (facteurs multipliés)',
    Math.abs(t2.breathBonus - deux[0].mods.breathBonus * deux[1].mods.breathBonus) < 1e-9);
}
Date.now = vraiNow;

console.log(rouges ? `\n  ${rouges} rouge(s)\n` : '\ntout est vert\n');
process.exit(rouges ? 1 : 0);
