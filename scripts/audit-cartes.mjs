/**
 * Banc d'audit : chaque carte d'action, une par une, dans le duel et au Virage.
 *
 * Gaël, 5 novembre 2026 : « Est-ce que toutes les cartes actions créées et
 * utilisées fonctionnent bien durant les duels et les virages ? » Ce banc
 * répond carte par carte, **fermées comprises** (les cartes des PASS naissent
 * `publie: false` et s'ouvrent avec leur saison) : il joue la carte dans ses
 * conditions, puis regarde ce qu'elle a réellement changé — la corde, le
 * souffle, la main, les effets posés, le chant suivant.
 *
 * Une carte dont le banc ne sait pas mesurer l'effet est un rouge, pas un
 * silence : la prochaine sorte d'effet ajoutée devra y être écrite.
 *
 *     npm run cartes-audit:test
 */
import { ACTIONS, ACTION_BY_ID, dansLeVirage } from '../src/shared/duel/actions.js';
import { DuelNvN, modsPortes, avecLieu } from '../src/server/nvn/engine.js';
import { VirageRoom } from '../src/server/ferveur/virage.js';
import { modsAvecEffets, aEffet } from '../src/shared/duel/effets.js';
import { resoudreGeste } from '../src/server/ferveur/gestures.js';

let rouges = 0;
const check = (nom, ok, ...detail) => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${nom}`);
  if (!ok) { rouges++; if (detail.length) console.log('       ', ...detail); }
};

/* Le répertoire est fixé : des gestes à frappes, dont le banc sait écrire
   l'exécution parfaite et l'exécution ratée. */
const REPERTOIRE = ['reprise', 'roulement', 'repons', 'onetaitla', 'salves'];
const parfait = (mods = {}) => {
  const g = resoudreGeste(mods).tempo;
  return Array.from({ length: g.beats }, (_, i) => i * g.interval + (i % 2 ? 3 : -2));
};
const RATE = [];

/* ================================================================ le duel */

const FOND = ['a-fumigene', 'a-thermos', 'a-bache', 'a-torche', 'a-vol',
  'a-fumigene', 'a-thermos', 'a-bache', 'a-torche', 'a-vol'];
const fanzzy = (id) => {
  const age = (i) => ({ id, nom: `${id}-${i}`, type: 'voix', stage: i,
    cri: { gest: 'tempo', label: 'x', power: 44 }, mods: { id } });
  return { ...age(1), stade: 1, ages: [age(1), age(2)], stuff: [] };
};
const loadout = (u) => ({ fanzzy: [fanzzy(`${u}F1`), fanzzy(`${u}F2`)],
  actions: FOND.map((id) => ACTION_BY_ID.get(id)) });

function duel(t) {
  const d = new DuelNvN({ id: 'audit', mode: 'entrainement', now: t,
    equipes: [[{ userId: 'a1', nom: 'A1', loadout: loadout('a1') },
      { userId: 'a2', nom: 'A2', loadout: loadout('a2') }],
    [{ userId: 'b1', nom: 'B1', loadout: loadout('b1') },
      { userId: 'b2', nom: 'B2', loadout: loadout('b2') }]],
    fixture: { id: 7201, elapsed: 30, status: '1H',
      home: { id: 85, name: 'Sion' }, away: { id: 91, name: 'Bâle' } } });
  d.repertoire = REPERTOIRE;
  for (const j of d.joueurs.values()) j.regenAt = t;
  return d;
}
const mettre = (d, uid, id) => {
  const j = d.joueurs.get(uid);
  j.breath = 100; delete j.cooldowns[id];
  if (!j.main.includes(id)) j.main[0] = id;
  return j;
};
const essayer = (f) => { try { return f(); } catch (e) { return e.message; } };
const modsDuel = (d, j, t) => modsAvecEffets(avecLieu(modsPortes(j), d.stade), j.effets, t);
const pousseeDe = (evs, uid) => (evs ?? []).filter((e) => e.t === 'push' && e.userId === uid)
  .reduce((s, e) => s + e.valeur, 0);

/** Ce que la carte demande pour être jouée : on le lui donne. */
function conditions(d, carte, t) {
  const c = carte.condition ?? {};
  if (c.mene) d.goals = [0, c.mene];
  if (c.minuteReelle) d.minuteReelle = c.minuteReelle + 1;
  if (c.minuteEntre) d.minuteReelle = c.minuteEntre[0] + 2;
  if (c.minuteMax != null) d.minuteReelle = Math.max(1, c.minuteMax - 2);
  if (c.butRecent) d.dernierButReel[0] = t - 1000;
  if (c.rougeAdverse) d.dernierRougeReel[1] = t - 1000;
  d.minuteLueA = t;
}

/** Un chant parfait de `uid` : la poussée qu'il donne. */
const chant = (d, uid, t, taps) => {
  d.joueurs.get(uid).breath = 100;
  return d.chanter(uid, { cardId: 'reprise', taps: taps ?? parfait(modsDuel(d, d.joueurs.get(uid), t)) }, t);
};

/** La poussée d'un chant parfait de a2 sans rien, pour comparer. */
function temoinChant(uid = 'a2') {
  const t = 2_000_000;
  const d = duel(t);
  return pousseeDe(chant(d, uid, t + 50), uid);
}

const DUEL = {
  push(d, carte, t, evs) {
    return [d.rope < 0, `corde ${d.rope.toFixed(1)}`];
  },
  per_present(d) { return [d.rope < 0, `corde ${d.rope.toFixed(1)}`]; },
  per_mate(d) { return [d.rope < 0, `corde ${d.rope.toFixed(1)}`]; },
  halve_gap(d) { return [Math.abs(d.rope - 50) < 1, `corde ${d.rope} (100 avant)`]; },
  delayed_push(d, carte, t) {
    const avant = d.rope;
    d.tick(t + (carte.effet.delai ?? 0) + 200);
    return [d.rope < avant - 1, `corde ${avant} → ${d.rope.toFixed(1)}`];
  },
  push_over_time(d, carte, t) {
    let r = d.rope;
    for (let k = 1; k <= carte.effet.coups; k++) d.tick(t + k * carte.effet.duree / carte.effet.coups + 5);
    return [d.rope < r - carte.effet.valeur / 2 / 3, `corde ${r} → ${d.rope.toFixed(1)}`];
  },
  silence(d, carte, t) {
    const r = essayer(() => chant(d, 'b1', t + 100));
    return [r === 'silenced', r];
  },
  blind(d, carte, t) {
    const b = d.joueurs.get('b1');
    return [aEffet(b, 'blind', t + 100) && !aEffet(d.joueurs.get('a1'), 'blind', t + 100),
      JSON.stringify(b.effets)];
  },
  lock_actions(d, carte, t) {
    mettre(d, 'b1', 'a-fumigene');
    const r = essayer(() => d.jouer('b1', 'a-fumigene', t + 100));
    return [r === 'actions_locked', r];
  },
  steal(d) {
    const b = d.joueurs.get('b1').breath + d.joueurs.get('b2').breath;
    return [b < 200, `souffle d'en face ${b}`];
  },
  refill(d, carte, t, evs, avant) {
    return [d.joueurs.get('a1').breath > avant.souffle - carte.cost + 0.1,
      `souffle ${avant.souffle} → ${d.joueurs.get('a1').breath}`];
  },
  team_breath(d, carte) {
    const b = d.joueurs.get('a2').breath;
    return [b > 50, `souffle du coéquipier ${b}`];
  },
  mod_self(d, carte, t) {
    const m = modsDuel(d, d.joueurs.get('a1'), t + 10);
    const ok = Object.entries(carte.effet.mods).every(([k, v]) => Math.abs((m[k] ?? 1) - v) < 1e-9);
    return [ok, JSON.stringify(m)];
  },
  mod_foe(d, carte, t) {
    const m = modsDuel(d, d.joueurs.get('b1'), t + 10);
    const ok = Object.entries(carte.effet.mods).every(([k, v]) => Math.abs((m[k] ?? 1) - v) < 1e-9);
    return [ok, JSON.stringify(m)];
  },
  floor_quality(d, carte, t) {
    const evs = chant(d, 'a1', t + 100, RATE);
    const q = evs.find((e) => e.t === 'chant')?.quality;
    return [q >= carte.effet.valeur, `note ${q}`];
  },
  immunite(d, carte, t) {
    mettre(d, 'b1', 'a-silence');
    d.jouer('b1', 'a-silence', t + 100);
    const r = essayer(() => chant(d, 'a1', t + 200));
    return [Array.isArray(r), typeof r === 'string' ? r : 'chant accepté'];
  },
  shield(d, carte, t) {
    const avant = d.rope;
    mettre(d, 'b1', 'a-fumigene');
    d.jouer('b1', 'a-fumigene', t + 100);
    return [d.rope === avant, `corde ${avant} → ${d.rope}`];
  },
  reflect(d, carte, t) {
    mettre(d, 'b1', 'a-fumigene');
    d.jouer('b1', 'a-fumigene', t + 100);
    return [d.rope < 0, `corde ${d.rope}`];
  },
  rally(d, carte, t) {
    const p = pousseeDe(chant(d, 'a2', t + 50), 'a2');
    const temoin = temoinChant();
    return [p > temoin * 1.05, `chant du coéquipier ${p} (sans la carte ${temoin})`];
  },
  /* Le Chœur au duel : toute la tribune ×3 pendant 3 s (choix de Gaël du
     5 novembre 2026). */
  sync(d, carte, t) {
    const p = pousseeDe(chant(d, 'a2', t + 50), 'a2');
    const temoin = temoinChant();
    return [Math.abs(p - temoin * carte.effet.duel) <= 1, `chant du coéquipier ${p} (sans la carte ${temoin})`];
  },
  swap_fanzzy(d, carte, t) {
    const r = essayer(() => d.changer('a1', 1, t + 10));
    return [Array.isArray(r) && d.joueurs.get('a1').actif === 1, typeof r === 'string' ? r : 'changé'];
  },
  evolve(d) {
    const f = d.joueurs.get('a1').fanzzy[0];
    return [f.stade === 2, `stade ${f.stade}`];
  },
  refill_hand(d) {
    const j = d.joueurs.get('a1');
    return [j.main.length === 5, `main ${j.main.length}`];
  },
  clear_cooldowns(d, carte, t) {
    const j = d.joueurs.get('a1');
    const chaudes = Object.entries(j.cooldowns).filter(([id, fin]) => id !== carte.id && fin > t);
    return [chaudes.length === 0, JSON.stringify(chaudes)];
  },
  freeze_decay(d, carte, t) {
    d.rope = -80;
    d.tick(t + 3000);
    return [d.rope === -80, `corde -80 → ${d.rope}`];
  },
  double_next(d, carte, t) {
    const p = pousseeDe(chant(d, 'a1', t + 50), 'a1');
    const temoin = temoinChant('a1');
    return [Math.abs(p - 2 * temoin) <= 1, `chant ${p} (sans la carte ${temoin})`];
  },
  cost_free(d, carte, t) {
    const j = mettre(d, 'a1', 'a-fumigene');
    j.breath = 50;
    d.jouer('a1', 'a-fumigene', t + 100);
    return [Math.abs(j.breath - 50) < 2, `souffle 50 → ${j.breath.toFixed(1)}`];
  },
  steal_card(d) {
    const j = d.joueurs.get('a1');
    return [j.main.includes('a-thermos'), JSON.stringify(j.main)];
  },
  replay_last(d, carte, t, evs, avant) {
    return [d.rope < avant.rope - 1, `corde ${avant.rope} → ${d.rope}`];
  },
  trap(d, carte, t) {
    const avant = d.rope;
    mettre(d, 'b1', 'a-fumigene');
    const evs = d.jouer('b1', 'a-fumigene', t + 100);
    return [d.rope === avant && evs.some((e) => e.t === 'piege'), `corde ${avant} → ${d.rope}`];
  },
  streak(d, carte, t) {
    const p1 = pousseeDe(chant(d, 'a1', t + 50), 'a1');
    const p2 = pousseeDe(chant(d, 'a1', t + 5000), 'a1');
    return [p2 > p1, `premier ${p1}, deuxième ${p2}`];
  },
  extra_hand(d, carte, t) {
    const j = d.joueurs.get('a1');
    for (let k = 1; k <= 3; k++) d.tick(t + k * 4100);
    return [j.main.length === 6, `main ${j.main.length}`];
  },
  cooldown_mult(d, carte, t) {
    const j = mettre(d, 'a1', 'a-fumigene');
    d.jouer('a1', 'a-fumigene', t + 100);
    const cd = (j.cooldowns['a-fumigene'] - (t + 100)) / 1000;
    return [Math.abs(cd - ACTION_BY_ID.get('a-fumigene').cd * carte.effet.valeur) < 0.01, `recharge ${cd} s`];
  },
  shuffle_foe(d, carte, t, evs, avant) {
    const b = d.joueurs.get('b1');
    return [b.main.length === 5 && evs.some((e) => e.type === 'shuffle_foe'), `main ${b.main.length}`];
  },
  cost_mult(d, carte, t) {
    const b = mettre(d, 'b1', 'a-fumigene');
    d.jouer('b1', 'a-fumigene', t + 100);
    const paye = 100 - b.breath;
    return [Math.abs(paye - Math.round(ACTION_BY_ID.get('a-fumigene').cost * carte.effet.valeur)) < 1.5,
      `payé ${paye.toFixed(1)}`];
  },
  curse(d, carte, t) {
    const q = chant(d, 'b1', t + 100).find((e) => e.t === 'chant')?.quality;
    return [q === 0.5, `note ${q}`];
  },
};

console.log('\n  le duel : chaque carte, dans ses conditions');
for (const carte of ACTIONS) {
  const t = 1_000_000;
  const d = duel(t);
  conditions(d, carte, t);
  const type = carte.effet?.type;
  if (type === 'halve_gap') d.rope = 100;
  if (type === 'per_mate') d.joueurs.get('a2').dernierChant = t - 1000;
  if (type === 'clear_cooldowns') d.joueurs.get('a1').cooldowns = { 'a-thermos': t + 30_000 };
  if (type === 'steal_card') { mettre(d, 'b1', 'a-thermos'); d.jouer('b1', 'a-thermos', t - 500); }
  if (type === 'replay_last') { mettre(d, 'a1', 'a-fumigene'); d.jouer('a1', 'a-fumigene', t - 500); }
  const j = mettre(d, 'a1', carte.id);
  if (type === 'refill') j.breath = Math.max(carte.cost, 20);
  const avant = { rope: d.rope, souffle: j.breath };
  const evs = essayer(() => d.jouer('a1', carte.id, t));
  if (!Array.isArray(evs)) { check(`${carte.id} se joue`, false, evs); continue; }
  const mesure = DUEL[type];
  if (!mesure) { check(`${carte.id} : effet ${type} mesuré`, false, 'le banc ne connaît pas cet effet'); continue; }
  const [ok, detail] = mesure(d, carte, t, evs, avant);
  let revers = true;
  if (carte.revers?.type === 'breath_mult') {
    const r = d.joueurs.get('a1').effets.find((e) => e.type === 'breath_mult');
    revers = Boolean(r && r.valeur === carte.revers.valeur);
  }
  check(`${carte.id} (${carte.nom}) : ${type}${carte.revers ? ' + revers' : ''}`, ok && revers,
    detail, revers ? '' : 'revers absent');
}

/* Deux cartes à modificateurs, jouées l'une après l'autre : la seconde ne
   doit pas effacer la première (le Métronome retirait le Réveil du canapé). */
console.log('\n  le duel : deux cartes à modificateurs se cumulent');
{
  const t = 1_000_000;
  const d = duel(t);
  d.goals = [0, 1];
  mettre(d, 'a1', 'a-hc-reveil'); d.jouer('a1', 'a-hc-reveil', t);
  mettre(d, 'a1', 'a-metronome'); d.jouer('a1', 'a-metronome', t + 100);
  const m = modsDuel(d, d.joueurs.get('a1'), t + 200);
  check('Réveil du canapé puis Métronome : poussée ×1,5 et fenêtre ×2 ensemble',
    m.pushMult === 1.5 && m.tempoWindow === 2, JSON.stringify(m));
  mettre(d, 'a1', 'a-mt-averse'); d.jouer('a1', 'a-mt-averse', t + 300);
  mettre(d, 'a1', 'a-mt-tempete-sable'); d.jouer('a1', 'a-mt-tempete-sable', t + 400);
  const f = modsDuel(d, d.joueurs.get('b1'), t + 500);
  const base = modsDuel(duel(t), duel(t).joueurs.get('b1'), t + 500).tempoWindow ?? 1;
  check('Averse puis Tempête de sable : les deux fenêtres se multiplient chez l’adversaire',
    Math.abs(f.tempoWindow - base * 0.75 * 0.82) < 1e-9, JSON.stringify(f));
  mettre(d, 'a1', 'a-mt-averse'); d.jouer('a1', 'a-mt-averse', t + 30_000);
  const g = modsDuel(d, d.joueurs.get('b1'), t + 30_100);
  check('la même carte rejouée se renouvelle, elle ne s’empile pas',
    Math.abs(g.tempoWindow - base * 0.75) < 1e-9, JSON.stringify(g));
}

/* =============================================================== le Virage */

let maintenant = 5_000_000;
const vraiNow = Date.now;
Date.now = () => maintenant;

function salle() {
  const room = new VirageRoom({
    fixture: { id: 9951, homeId: 1, awayId: 2, homeName: 'A', awayName: 'B', leagueId: 1,
      kickoffAt: new Date(maintenant), status: '1H', elapsed: 20 },
    emit: () => {}, log: { warn() {}, error() {} },
  });
  room.repertoire = () => REPERTOIRE;
  room.motifsAdmis = () => [0];
  for (const [u, side] of [['u1', 0], ['u2', 0], ['v1', 1]]) {
    room.join(u, { side, name: u, actions: FOND });
  }
  for (const m of room.members.values()) { m.lastPush = maintenant; m.regenAt = maintenant; }
  return room;
}
const chantV = (room, uid, taps) => {
  const m = room.members.get(uid);
  m.breath = 100;
  return room.chant(uid, { cardId: 'reprise', taps: taps ?? parfait(room.modsDe(m)) });
};
const temoinV = (uid = 'u2') => {
  const avant = maintenant;
  maintenant = 9_000_000;
  const r = salle();
  const p = chantV(r, uid).push;
  maintenant = avant;
  return p;
};
const avancer = (room, ms) => {
  const fin = maintenant + ms;
  while (maintenant < fin) { maintenant = Math.min(fin, maintenant + 100); room.entretenirCartes(maintenant); }
};

const VIRAGE = {
  push(room) { return [room.rope < 0, `corde ${room.rope.toFixed(2)}`]; },
  per_present(room) { return [room.rope < 0, `corde ${room.rope.toFixed(2)}`]; },
  per_mate(room) { return [room.rope < 0, `corde ${room.rope.toFixed(2)}`]; },
  delayed_push(room, carte) {
    const avant = room.rope;
    avancer(room, carte.effet.delai + 200);
    return [room.rope < avant, `corde ${avant} → ${room.rope.toFixed(2)}`];
  },
  push_over_time(room, carte) {
    const avant = room.rope;
    avancer(room, carte.effet.duree + 200);
    return [room.rope < avant, `corde ${avant} → ${room.rope.toFixed(2)}`];
  },
  refill(room, carte, avant) {
    const b = room.members.get('u1').breath;
    return [b > avant.souffle - carte.cost + 0.1, `souffle ${avant.souffle} → ${b}`];
  },
  team_breath(room) {
    const b = room.members.get('u2').breath;
    return [b > 50, `souffle du coéquipier ${b}`];
  },
  mod_self(room, carte) {
    const m = room.modsDe(room.members.get('u1'));
    const ok = Object.entries(carte.effet.mods).every(([k, v]) => Math.abs((m[k] ?? 1) - v) < 1e-9);
    let fin = true;
    /* Une carte « à charges » s'use : le Métronome vaut deux chants, pas le match. */
    if (carte.effet.charges) {
      for (let k = 0; k < carte.effet.charges; k++) { maintenant += 5000; chantV(room, 'u1'); }
      maintenant += 5000;
      const apres = room.modsDe(room.members.get('u1'));
      fin = Object.entries(carte.effet.mods).every(([k]) => (apres[k] ?? 1) === 1);
      return [ok && fin, fin ? JSON.stringify(m) : `toujours actif après ${carte.effet.charges} chants : ${JSON.stringify(apres)}`];
    }
    return [ok, JSON.stringify(m)];
  },
  floor_quality(room, carte) {
    const r = chantV(room, 'u1', RATE);
    return [r.quality >= carte.effet.valeur, `note ${r.quality}`];
  },
  rally(room) {
    const p = chantV(room, 'u2').push;
    const temoin = temoinV();
    return [p > temoin * 1.05, `chant du coéquipier ${p} (sans la carte ${temoin})`];
  },
  sync(room) {
    const p = chantV(room, 'u2').push;
    const temoin = temoinV();
    return [p > temoin * 1.05, `chant du coéquipier ${p} (sans la carte ${temoin})`];
  },
  refill_hand(room) {
    const m = room.members.get('u1');
    return [m.main.length === 5, `main ${m.main.length}`];
  },
  clear_cooldowns(room, carte) {
    const m = room.members.get('u1');
    const chaudes = Object.entries(m.cooldowns).filter(([id, fin]) => id !== carte.id && fin > maintenant);
    return [chaudes.length === 0, JSON.stringify(chaudes)];
  },
  freeze_decay(room) {
    room.rope = -80;
    room.tick(maintenant + 3000);
    return [room.rope === -80, `corde -80 → ${room.rope}`];
  },
  double_next(room) {
    const p = chantV(room, 'u1').push;
    const temoin = temoinV('u1');
    return [Math.abs(p - 2 * temoin) <= 1, `chant ${p} (sans la carte ${temoin})`];
  },
  cost_free(room) {
    const m = room.members.get('u1');
    if (!m.main.includes('a-fumigene')) m.main[0] = 'a-fumigene';
    m.cooldowns = {}; m.breath = 50; m.regenAt = maintenant;
    room.jouer('u1', 'a-fumigene');
    return [Math.abs(m.breath - 50) < 2, `souffle 50 → ${m.breath}`];
  },
  replay_last(room, carte, avant) {
    return [room.rope < avant.rope, `corde ${avant.rope} → ${room.rope}`];
  },
  streak(room) {
    const p1 = chantV(room, 'u1').push;
    maintenant += 5000;
    const p2 = chantV(room, 'u1').push;
    return [p2 > p1, `premier ${p1}, deuxième ${p2}`];
  },
  extra_hand(room) {
    avancer(room, 8000);
    const m = room.members.get('u1');
    return [m.main.length === 6, `main ${m.main.length}`];
  },
  cooldown_mult(room, carte) {
    const m = room.members.get('u1');
    if (!m.main.includes('a-fumigene')) m.main[0] = 'a-fumigene';
    m.cooldowns = {}; m.breath = 100;
    room.jouer('u1', 'a-fumigene');
    const cd = (m.cooldowns['a-fumigene'] - maintenant) / 1000;
    const attendu = ACTION_BY_ID.get('a-fumigene').cd * 1.5 * carte.effet.valeur;
    return [Math.abs(cd - attendu) < 0.01, `recharge ${cd} s (attendu ${attendu})`];
  },
};

console.log('\n  le Virage : chaque carte admise, dans ses conditions');
for (const carte of ACTIONS.filter(dansLeVirage)) {
  maintenant += 600_000;
  const room = salle();
  const c = carte.condition ?? {};
  if (c.mene) room.scoreReel = [0, c.mene];
  if (c.minuteReelle) room.minute = c.minuteReelle + 1;
  if (c.minuteEntre) room.minute = c.minuteEntre[0] + 2;
  if (c.minuteMax != null) { room.minute = Math.max(1, c.minuteMax - 2); }
  if (c.butRecent) room.dernierButReel[0] = maintenant - 1000;
  if (c.rougeAdverse) room.dernierRougeReel[1] = maintenant - 1000;
  const type = carte.effet?.type;
  const m = room.members.get('u1');
  if (type === 'per_mate') room.members.get('u2').dernierChant = maintenant - 1000;
  if (type === 'per_mate' || type === 'per_present') {
    room.members.get('u2').lastPush = maintenant;
  }
  if (type === 'clear_cooldowns') m.cooldowns = { 'a-thermos': maintenant + 30_000 };
  if (type === 'replay_last') {
    if (!m.main.includes('a-fumigene')) m.main[1] = 'a-fumigene';
    m.breath = 100; room.jouer('u1', 'a-fumigene');
  }
  if (!m.main.includes(carte.id)) m.main[0] = carte.id;
  m.cooldowns[carte.id] = 0;
  m.breath = type === 'refill' ? Math.max(carte.cost, 20) : 100;
  const avant = { rope: room.rope, souffle: m.breath };
  const r = essayer(() => room.jouer('u1', carte.id));
  if (!Array.isArray(r)) { check(`${carte.id} se joue au Virage`, false, r); continue; }
  const mesure = VIRAGE[type];
  if (!mesure) { check(`${carte.id} : effet ${type} mesuré au Virage`, false); continue; }
  const [ok, detail] = mesure(room, carte, avant);
  let revers = true;
  if (carte.revers?.type === 'breath_mult') {
    revers = Math.abs((room.modsDe(m).breathBonus ?? 1) - carte.revers.valeur) < 1e-9
      || type === 'mod_self';
  }
  check(`${carte.id} (${carte.nom}) : ${type}${carte.revers ? ' + revers' : ''}`, ok && revers,
    detail, revers ? '' : 'revers absent');
}
Date.now = vraiNow;

console.log(rouges ? `\n  ${rouges} rouge(s)\n` : '\ntout est vert\n');
process.exit(rouges ? 1 : 0);
