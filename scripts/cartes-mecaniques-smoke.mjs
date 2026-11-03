/**
 * Les mécaniques neuves des cartes d'action (Gaël, 3 novembre 2026 : « Ok
 * pour les nouvelles mécaniques »).
 *
 * Chambrage, Écho, Piège à la buvette, Tribune chaude, Recrue, Sang-froid,
 * À domicile, Maillot du club, Kop plein, Télécommande, Péage, Parcage
 * visiteur, Fantôme, Malédiction : chacune éprouvée dans le moteur du duel,
 * et celles qui entrent au Virage dans sa salle. Sans base ni serveur.
 *
 *     npm run cartes-mecaniques:smoke
 */
import { ACTION_BY_ID, ACTIONS, dansLeVirage } from '../src/shared/duel/actions.js';
import { DuelNvN, RULES } from '../src/server/nvn/engine.js';
import { VirageRoom, EFFETS_CONNUS } from '../src/server/ferveur/virage.js';

let rouges = 0;
const check = (nom, ok, ...detail) => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${nom}`);
  if (!ok) { rouges++; if (detail.length) console.log('       ', ...detail); }
};

const NEUVES = ['a-chambrage', 'a-echo', 'a-piege', 'a-tribune-chaude', 'a-recrue', 'a-sangfroid',
  'a-domicile', 'a-maillot', 'a-kop-plein', 'a-hc-telecommande', 'a-gd-peage',
  'a-gd-parcage-visiteur', 'a-rv-fantome', 'a-rv-malediction'];

console.log('\n  le catalogue');
check('les quatorze cartes existent', NEUVES.every((id) => ACTION_BY_ID.has(id)),
  NEUVES.filter((id) => !ACTION_BY_ID.has(id)));
check('les identifiants restent uniques', new Set(ACTIONS.map((a) => a.id)).size === ACTIONS.length);
{
  const auVirage = ACTIONS.filter(dansLeVirage);
  const muettes = auVirage.filter((a) => !EFFETS_CONNUS.has(a.effet.type)).map((a) => a.id);
  check('toute carte admise au Virage y a un effet connu', muettes.length === 0, muettes);
  check('Chambrage, Piège, Télécommande, Péage, Malédiction restent au duel',
    ['a-chambrage', 'a-piege', 'a-hc-telecommande', 'a-gd-peage', 'a-rv-malediction']
      .every((id) => !dansLeVirage(ACTION_BY_ID.get(id))));
  check('Écho, Tribune chaude, Recrue, Sang-froid, Kop plein entrent au Virage',
    ['a-echo', 'a-tribune-chaude', 'a-recrue', 'a-sangfroid', 'a-kop-plein']
      .every((id) => dansLeVirage(ACTION_BY_ID.get(id))));
}

/* ------------------------------------------------------------- le duel */

console.log('\n  le duel');
const DIX = ['a-fumigene', 'a-thermos', 'a-bache', 'a-torche', 'a-vol',
  'a-fumigene', 'a-thermos', 'a-bache', 'a-torche', 'a-vol'];
const loadout = (club = null) => ({
  fanzzy: [{ id: club ? 'ZZ1' : 'TR32', nom: 'J', stade: 1, club,
    cri: { gest: 'tempo', label: 'x' }, mods: {} }],
  actions: DIX.map((id) => ACTION_BY_ID.get(id)),
});
function duel(t = 1_000_000, { club0 = null } = {}) {
  return new DuelNvN({ id: 'dm', mode: 'entrainement', now: t,
    equipes: [[{ userId: 'a', nom: 'A', loadout: loadout(club0) }],
      [{ userId: 'b', nom: 'B', loadout: loadout() }]],
    fixture: { id: 7201, elapsed: 30, status: '1H',
      home: { id: 85, name: 'Sion' }, away: { id: 91, name: 'Bâle' } } });
}
const prep = (d, uid, id) => {
  const j = d.joueurs.get(uid);
  j.breath = 100; j.cooldowns = {};
  if (!j.main.includes(id)) j.main[0] = id;
  return j;
};
const jouer = (d, uid, id, t) => {
  prep(d, uid, id);
  try { return d.jouer(uid, id, t); } catch (e) { return e.message; }
};
{
  let t = 1_000_000;
  let d = duel(t);
  jouer(d, 'b', 'a-thermos', t);
  const a = prep(d, 'a', 'a-chambrage');
  d.jouer('a', 'a-chambrage', t + 10);
  check('Chambrage : la dernière carte d’en face arrive dans ta main', a.main.includes('a-thermos'));
  const avant = a.defausse.length;
  a.breath = 100;
  d.jouer('a', 'a-thermos', t + 20);
  check('et elle part sans entrer dans ton deck', a.defausse.length === avant, avant, a.defausse);

  d = duel(t);
  jouer(d, 'a', 'a-fumigene', t);
  const rope1 = d.rope;
  jouer(d, 'a', 'a-echo', t + 100);
  check('Écho : la dernière carte rejouée pousse encore', d.rope < rope1, rope1, d.rope);

  d = duel(t);
  jouer(d, 'b', 'a-piege', t);
  const r0 = d.rope;
  const ev = jouer(d, 'a', 'a-fumigene', t + 100);
  check('Piège : la prochaine poussée d’en face est perdue', d.rope === r0
    && Array.isArray(ev) && ev.some((e) => e.t === 'piege'), d.rope, ev);
  const ev2 = jouer(d, 'a', 'a-thermos', t + 200);
  check('et une seule fois', Array.isArray(ev2) && !ev2.some((e) => e.t === 'piege'));

  d = duel(t);
  const j = jouer(d, 'a', 'a-recrue', t) && d.joueurs.get('a');
  d.tick(t + RULES.refillMs + 10);
  d.tick(t + 2 * RULES.refillMs + 20);
  check('Recrue : six cartes en main', j.main.length === 6, j.main.length);
  check('la taille revient à cinq ensuite', d.tailleMain(j, t + 20_000) === 5);

  d = duel(t);
  jouer(d, 'a', 'a-sangfroid', t);
  jouer(d, 'a', 'a-bache', t + 10);
  const cd = d.joueurs.get('a').cooldowns['a-bache'] - (t + 10);
  check('Sang-froid : la recharge est deux fois plus courte',
    Math.abs(cd - ACTION_BY_ID.get('a-bache').cd * 500) < 2, cd);

  d = duel(t);
  check('À domicile : refusée à l’extérieur', jouer(d, 'b', 'a-domicile', t) === 'condition_not_met');
  check('et jouable à domicile', Array.isArray(jouer(d, 'a', 'a-domicile', t)));

  d = duel(t);
  const sansClub = d.fanzzyDuClub(d.joueurs.get('a'));
  const dc = duel(t, { club0: 85 });
  check('Maillot du club : reconnaît un Fanzzy du club de sa tribune',
    !sansClub && dc.fanzzyDuClub(dc.joueurs.get('a')));

  d = duel(t);
  const b = d.joueurs.get('b');
  const mainAvant = [...b.main];
  jouer(d, 'a', 'a-hc-telecommande', t);
  check('Télécommande : la main d’en face change, toujours cinq cartes',
    b.main.length === 5 && b.main.length + b.pioche.length === mainAvant.length + 5);

  d = duel(t);
  jouer(d, 'a', 'a-gd-peage', t);
  const bb = prep(d, 'b', 'a-bache');
  bb.breath = 30;
  check('Péage : une Bâche à 24 coûte 36, refusée avec 30 de souffle',
    (() => { try { d.jouer('b', 'a-bache', t + 10); return false; } catch (e) { return e.message === 'not_enough_breath'; } })());

  d = duel(t);
  jouer(d, 'b', 'a-gd-parcage-visiteur', t);
  check('Parcage visiteur : 60 pour la tribune qui se déplace',
    d.joueurs.get('b').effets.find((e) => e.type === 'shield')?.valeur === 60);

  d = duel(t);
  const fa = prep(d, 'a', 'a-rv-fantome');
  d.jouer('a', 'a-rv-fantome', t);
  check('Fantôme : revient dans la main une fois', fa.main.includes('a-rv-fantome'));
  fa.breath = 100; fa.cooldowns = {};
  d.jouer('a', 'a-rv-fantome', t + 30_000);
  check('pas deux fois', !fa.main.includes('a-rv-fantome') && fa.defausse.includes('a-rv-fantome'));

  d = duel(t);
  jouer(d, 'a', 'a-rv-malediction', t);
  check('Malédiction : posée chez l’adversaire',
    d.joueurs.get('b').effets.some((e) => e.type === 'malediction' && e.charges === 1));

  d = duel(t);
  jouer(d, 'a', 'a-tribune-chaude', t);
  check('Tribune chaude : la série démarre à zéro',
    d.joueurs.get('a').effets.some((e) => e.type === 'serie' && e.n === 0));

  d = duel(t);
  const r1 = d.rope;
  jouer(d, 'a', 'a-kop-plein', t);
  check('Kop plein : pousse en 1v1 (14)', d.rope < r1);
}

/* ------------------------------------------------------------ le Virage */

console.log('\n  le Virage');
{
  const room = new VirageRoom({
    fixture: { id: 9951, homeId: 1, awayId: 2, homeName: 'A', awayName: 'B', leagueId: 1,
      kickoffAt: new Date(), status: '1H', elapsed: 20 },
    emit: () => {}, log: { warn() {}, error() {} },
  });
  room.join('u1', { side: 1, name: 'U1', actions: ['a-fumigene', 'a-echo', 'a-recrue', 'a-sangfroid',
    'a-domicile', 'a-kop-plein', 'a-tribune-chaude', 'a-thermos', 'a-fumigene', 'a-thermos'] });
  const m = room.members.get('u1');
  const tenter = (id) => {
    m.breath = 100; m.cooldowns = {};
    if (!m.main.includes(id)) m.main[0] = id;
    try { room.jouer('u1', id); return 'ok'; } catch (e) { return e.message; }
  };
  check('Écho se joue', tenter('a-fumigene') === 'ok' && tenter('a-echo') === 'ok');
  check('Recrue se joue et agrandit la main', tenter('a-recrue') === 'ok' && room.tailleMain(m) === 6);
  check('Sang-froid se joue', tenter('a-sangfroid') === 'ok');
  check('Tribune chaude se joue', tenter('a-tribune-chaude') === 'ok');
  check('Kop plein se joue', tenter('a-kop-plein') === 'ok');
  check('À domicile refusée pour l’extérieur', tenter('a-domicile') === 'condition_not_met');
}

console.log(rouges ? `\n  ${rouges} rouge(s)\n` : '\ntout est vert\n');
process.exit(rouges ? 1 : 0);
