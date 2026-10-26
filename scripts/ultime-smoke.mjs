/**
 * L'Ultimate, le coup fatal d'un Fanzzy (`src/shared/ultime.js`).
 *
 * Demande de Gaël du 26 octobre 2026, et son choix du même jour : « Visuel à
 * collectionner » — tout le monde a l'Ultimate et il pousse pareil, la carte
 * du booster ne débloque que la grande scène. Cette suite garde la règle :
 *
 *   - la jauge se remplit avec les chants réussis (BON 1, PARFAIT 2), et
 *     seulement avec eux ;
 *   - le coup se lance une fois par duel, par le geste de la spécialité ;
 *   - il pousse plus fort avec l'âge, Relève comprise ;
 *   - la carte Ultimate change la scène (`grande`), jamais la poussée ;
 *   - le Virage suit la même règle, au premier âge.
 *
 * Moteurs seuls : ni base ni socket.
 */
import { DuelNvN } from '../src/server/nvn/engine.js';
import { VirageRoom } from '../src/server/ferveur/virage.js';
import { ACTION_BY_ID } from '../src/shared/duel/actions.js';
import { BY_ID } from '../src/shared/fanzzy/dex.js';
import { combine } from '../src/shared/fanzzy/inventaire.js';
import { CHANTS } from '../src/shared/duel/chants.js';
import { pousseeUltime, seuilUltime, pointsDuChant, chargerJauge, nouvelleJauge }
  from '../src/shared/ultime.js';
import { poserReglages, reglagesVivants } from '../src/shared/reglages.js';

let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };
const jitter = (t, a = 20) => Math.max(0, t + (Math.random() * a * 2 - a));
const tempoParfait = () => Array.from({ length: 8 }, (_, i) => jitter(i * 560, 20));
const tempoRate = () => Array.from({ length: 8 }, (_, i) => jitter(i * 560 + 280, 20));
// Le code du refus, sans son préfixe (`ferveur.error.`).
const refus = (f) => {
  try { f(); return null; } catch (e) { return String(e.code ?? e.message).replace(/^ferveur\.error\./, ''); }
};

const lignee = (id) => {
  const ch = [BY_ID.get(id)];
  while (ch.at(-1)?.evo) ch.push(BY_ID.get(ch.at(-1).evo));
  return ch;
};

/* Un Fanzzy dont la spécialité est le tempo : le geste qu'on sait taper juste
   ici. Trouvé dans le catalogue plutôt qu'écrit en dur. */
const TEMPO = [...BY_ID.values()].find((f) => f?.cri?.gest === 'tempo' && f.evo
  && lignee(f.id).length >= 3)?.id;
check(`un Fanzzy au tempo et à trois âges existe (${TEMPO})`, Boolean(TEMPO));

function loadout(id, { debloque = 1, ultimes = {} } = {}) {
  const lign = lignee(id);
  const habiller = (d, i) => ({ id, nom: d.nom, type: d.type, cri: d.cri, stage: i + 1,
    mods: { id, ...combine(d.mods, []) } });
  const jouables = lign.slice(0, Math.min(debloque, lign.length)).map(habiller);
  return {
    fanzzy: [{ ...jouables[0], stuff: [], stade: 1, ages: jouables, ultimes }],
    actions: ['a-releve', 'a-releve', 'a-silence', 'a-silence', 'a-fumigene']
      .map((c) => ACTION_BY_ID.get(c)),
  };
}

function duel(opts0 = {}, opts1 = {}, id = 'u1') {
  return new DuelNvN({ id, mode: 'entrainement', now: 1_000_000,
    equipes: [[{ userId: 'a', nom: 'A', loadout: loadout(TEMPO, opts0) }],
      [{ userId: 'b', nom: 'B', loadout: loadout(TEMPO, opts1) }]],
    fixture: { id: 7001, elapsed: 20, home: { id: 85, name: 'Sion' }, away: { id: 91, name: 'Bâle' } } });
}

/** Un chant au tempo, parfait ou raté, avec le souffle qu'il faut. */
function chanter(d, userId, taps, t) {
  const j = d.joueurs.get(userId);
  j.breath = 100;
  let cardId = d.offreDe(j).find((c) => CHANTS[c].gest === 'tempo');
  if (!cardId) {
    cardId = Object.keys(CHANTS).find((c) => CHANTS[c].gest === 'tempo');
    d.repertoire[0] = cardId;
  }
  return d.chanter(userId, { cardId, taps }, t);
}

/* ------------------------------------------------------------- la règle */

check(`le seuil par défaut est de 8 points (${seuilUltime()})`, seuilUltime() === 8);
check('un PARFAIT vaut 2, un BON 1, un raté 0',
  pointsDuChant(0.95) === 2 && pointsDuChant(0.75) === 1 && pointsDuChant(0.2) === 0);
check('un Ultimate raté pousse encore la moitié',
  Math.abs(pousseeUltime(1, 0) - pousseeUltime(1, 1) / 2) < 1e-9);
check('le troisième âge pousse plus que le premier',
  pousseeUltime(3, 1) > pousseeUltime(2, 1) && pousseeUltime(2, 1) > pousseeUltime(1, 1));
{
  const u = nouvelleJauge();
  u.utilise = true;
  check('une jauge déjà lancée ne se remplit plus', chargerJauge(u, 1) === false && u.points === 0);
}

/* --------------------------------------------------------------- le duel */

let t = 1_000_000;
let d = duel();
let v = d.vue('a');
check('la vue sert la jauge : vide, pas prête', v.moi.ultime?.points === 0
  && v.moi.ultime.seuil === 8 && v.moi.ultime.pret === false && v.moi.ultime.utilise === false);
check('elle dit le nom du coup : le cri de l’âge', v.moi.ultime.nom === BY_ID.get(TEMPO).cri.label);
check('et son geste : celui de la spécialité', v.moi.ultime.geste === 'tempo');
check('jauge vide : le coup est refusé',
  refus(() => d.ultimer('a', { taps: tempoParfait() }, t)) === 'ultime_pas_pret');

// Des chants ratés ne remplissent rien.
for (let i = 0; i < 3; i++) chanter(d, 'a', tempoRate(), (t += 5000));
check(`des chants ratés ne remplissent pas la jauge (${d.vue('a').moi.ultime.points})`,
  d.vue('a').moi.ultime.points === 0);

let pret = [];
for (let i = 0; i < 6 && !d.vue('a').moi.ultime.pret; i++) {
  pret.push(...chanter(d, 'a', tempoParfait(), (t += 5000)).filter((e) => e.t === 'ultime_pret'));
}
v = d.vue('a');
check(`des chants parfaits la remplissent (${v.moi.ultime.points}/${v.moi.ultime.seuil})`, v.moi.ultime.pret);
check('le chant qui la remplit l’annonce, une fois', pret.length === 1 && pret[0].side === 0);
check('la tribune d’en face voit le coup venir',
  d.vue('b').equipes[0][0].ultimePret === true && d.vue('b').equipes[1][0].ultimePret === false);

// Silence radio : on ne hurle pas la bouche barrée.
d.joueurs.get('a').effets.push({ type: 'silence', fin: t + 4000 });
check('sous Silence radio, le coup attend',
  refus(() => d.ultimer('a', { taps: tempoParfait() }, t + 10)) === 'silenced');
d.joueurs.get('a').effets = [];

const avant = d.rope;
let ev = d.ultimer('a', { taps: tempoParfait() }, (t += 5000));
const u = ev.find((e) => e.t === 'ultime');
check('l’Ultimate part : un évènement « ultime »', Boolean(u));
check('il porte le cri, l’âge et la famille', u?.cri === BY_ID.get(TEMPO).cri.label
  && u.stade === 1 && u.famille === BY_ID.get(TEMPO).type && typeof u.couleur === 'string');
check('sans carte Ultimate, la scène est la courte', u?.grande === false);
check(`la corde part vers le camp d’en face (${avant} → ${Math.round(d.rope)})`, d.rope < avant - 30);
check('une seule fois par duel',
  refus(() => d.ultimer('a', { taps: tempoParfait() }, t + 10)) === 'ultime_utilise');
v = d.vue('a');
check('la vue le dit lancé', v.moi.ultime.utilise === true && v.moi.ultime.pret === false);
check('et la jauge ne remonte plus', (chanter(d, 'a', tempoParfait(), (t += 5000)),
  d.vue('a').moi.ultime.points === v.moi.ultime.points));
check('le bilan le raconte', d.bilan().joueurs.find((j) => j.userId === 'a').ultime === true);

/* ------------------------------------------- la carte : la scène, pas la force */

function poussee({ ultimes = {}, releves = 0, debloque = 1 } = {}, id = 'p') {
  const dd = duel({ ultimes, debloque }, {}, id);
  const j = dd.joueurs.get('a');
  let tt = 2_000_000;
  for (let i = 0; i < releves; i++) {
    j.breath = 100;
    j.main.push('a-releve');
    j.cooldowns = {};
    dd.jouer('a', 'a-releve', (tt += 100));
  }
  j.ultime.points = j.ultime.seuil;
  /* Un tempo exact **à la pulsation de cet âge** : le Capo bat plus lentement
     que le Choriste (`tempoInterval`), et c'est la vue qui le dit. */
  const { beats, interval } = dd.vue('a').moi.gestes.tempo;
  const taps = Array.from({ length: beats }, (_, i) => i * interval);
  const e = dd.ultimer('a', { taps }, (tt += 100));
  return { push: e.find((x) => x.t === 'push')?.valeur ?? 0, ev: e.find((x) => x.t === 'ultime') };
}
const sans = poussee({}, 'p1');
const avec = poussee({ ultimes: { 1: true } }, 'p2');
check('avec la carte Ultimate de l’âge, la grande scène', avec.ev?.grande === true);
check(`et exactement la même poussée (${sans.push} = ${avec.push})`, sans.push === avec.push && sans.push > 0);
const age3 = poussee({ debloque: 3, releves: 2 }, 'p3');
check(`après deux Relèves, l’Ultimate du troisième âge pousse plus (${sans.push} → ${age3.push})`,
  age3.ev?.stade === 3 && age3.push > sans.push);
check('et il porte le cri du troisième âge', age3.ev?.cri === lignee(TEMPO)[2]?.cri?.label);
const carte3 = poussee({ debloque: 3, releves: 2, ultimes: { 1: true } }, 'p4');
check('la carte du premier âge ne donne pas la scène du troisième', carte3.ev?.grande === false);

/* ------------------------------------------------------- le réglage vit */

{
  const avantR = reglagesVivants();
  poserReglages({ ...avantR, 'ultime.charge': 0 });
  const d0 = duel({}, {}, 'r0');
  check('à zéro, l’Ultimate est prêt dès le coup d’envoi', d0.vue('a').moi.ultime.pret === true);
  poserReglages(avantR);
}

/* --------------------------------------------------------------- le Virage */

{
  const salle = new VirageRoom({
    fixture: { id: 9941, homeId: 1, awayId: 2, homeName: 'A', awayName: 'B',
      leagueId: 1, kickoffAt: new Date() },
    emit: () => {}, log: { warn() {}, error() {} },
  });
  const f = BY_ID.get(TEMPO);
  const info = { fanzzy: TEMPO, geste: 'tempo', nom: f.cri.label, couleur: '#F5C33B', grande: false };
  salle.join('va', { side: 0, name: 'VA', mods: { id: TEMPO }, ultime: info });
  salle.join('vb', { side: 1, name: 'VB', mods: {} });
  let snap = salle.snapshotFor('va').you;
  check('Virage : la vue sert la jauge et le cri', snap.ultime?.seuil === 8 && snap.ultime.nom === f.cri.label);
  check('Virage : sans Fanzzy équipé, pas d’Ultimate', salle.snapshotFor('vb').you.ultime === null
    && refus(() => salle.ultimer('vb', { taps: tempoParfait() })) === 'ultime_sans_fanzzy');
  check('Virage : jauge vide, le coup est refusé',
    refus(() => salle.ultimer('va', { taps: tempoParfait() })) === 'ultime_pas_pret');

  // Un chant au tempo dans le répertoire du moment.
  let rang = 0;
  while (!salle.repertoire(rang).some((c) => CHANTS[c].gest === 'tempo') && rang < 60) rang++;
  salle.minute = rang * 10;
  salle.rangChangeA = 0;
  const carte = salle.repertoire().find((c) => CHANTS[c].gest === 'tempo');
  let annonce = false;
  for (let i = 0; i < 8 && !salle.snapshotFor('va').you.ultime.pret; i++) {
    salle.members.get('va').breath = 100;
    const r = salle.chant('va', { cardId: carte, taps: tempoParfait() });
    annonce ||= r.ultimePret === true;
  }
  snap = salle.snapshotFor('va').you;
  check(`Virage : les chants réussis remplissent la jauge (${snap.ultime.points}/${snap.ultime.seuil})`,
    snap.ultime.pret);
  check('Virage : le chant qui la remplit le dit', annonce);
  const corde = salle.rope;
  const { resultat, evenements } = salle.ultimer('va', { taps: tempoParfait() });
  check('Virage : le coup part, la salle reçoit l’évènement',
    evenements[0]?.t === 'ultime' && evenements[0].cri === f.cri.label && evenements[0].side === 0);
  check(`Virage : la corde part du bon côté (${Math.round(corde)} → ${Math.round(salle.rope)})`,
    salle.rope < corde);
  check('Virage : le résultat rapporte de la ferveur', resultat.ferveur > 0 && resultat.push > 0);
  check('Virage : une seule fois par match',
    refus(() => salle.ultimer('va', { taps: tempoParfait() })) === 'ultime_utilise');
  salle.leave('va');
  salle.join('va', { side: 0, name: 'VA', mods: { id: TEMPO }, ultime: info });
  check('Virage : ressortir et revenir ne rend pas le coup',
    salle.snapshotFor('va').you.ultime.utilise === true);
}

console.log(failures ? `\n${failures} échec(s)` : '\nL’Ultimate tient sa règle.');
process.exit(failures ? 1 : 0);
