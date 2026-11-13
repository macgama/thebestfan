/**
 * Les bots d'en face, au Virage (13 novembre 2026, Gaël : « si un User va
 * jouer et qu'il est seul, il faut que l'adversaire soit représenté par un
 * bot » ; « 3 users vs 3 bots »).
 *
 * Sans base : la salle seule, une horloge à la main.
 */
import { VirageRoom, RULES } from '../src/server/ferveur/virage.js';
import { poserReglages, reglagesVivants } from '../src/shared/reglages.js';
import { frappesDuBot } from '../src/server/nvn/bot.js';
import { CHANTS } from '../src/shared/duel/chants.js';
import { GESTES_DU_BOT } from '../src/server/nvn/bot.js';

let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };

const vrai = Date.now;
let horloge = vrai();
Date.now = () => horloge;

function salle({ bots = true, id = 9500 } = {}) {
  const pousses = [];
  const s = new VirageRoom({
    bots,
    fixture: { id, homeId: 1, awayId: 2, homeName: 'A', awayName: 'B', status: '1H', elapsed: 10 },
    emit: () => {}, log: { warn() {}, error() {} },
    onPush: (p) => { pousses.push(p); return Promise.resolve(); },
  });
  s.pousses = pousses;
  return s;
}

/** Un chant d'un humain, avec son adresse : de 0 (au hasard) à 1 (juste). */
function chanter(s, userId, adresse) {
  const m = s.members.get(userId);
  const offre = s.repertoire().filter((id) => GESTES_DU_BOT.has(CHANTS[id]?.gest));
  const id = offre[Math.floor(Math.random() * offre.length)];
  m.breath = RULES.breathMax;
  try {
    s.chant(userId, { cardId: id, taps: frappesDuBot(CHANTS[id].gest, adresse, s.modsDe(m), s.rangRepertoire()) });
  } catch { /* geste refusé : il retentera */ }
}

/** Joue `sec` secondes : chaque humain chante toutes les 4,5 s, le battement tourne. */
function jouer(s, humains, sec) {
  const fin = horloge + sec * 1000;
  const prochain = new Map(humains.map(([u]) => [u, horloge]));
  while (horloge < fin) {
    horloge += RULES.tickMs;
    for (const [u, adresse] of humains) {
      if (horloge >= prochain.get(u)) { chanter(s, u, adresse); prochain.set(u, horloge + 4500); }
    }
    s.tick(horloge);
  }
}

/* ------------------------------------------------------------ combien */
{
  const s = salle();
  s.join('h1', { side: 0, name: 'H1' });
  check('personne n’a chanté : pas de bot', s.bots().join() === '0,0');
  chanter(s, 'h1', 0.9);
  check('un supporter seul qui chante : un bot en face', s.bots().join() === '0,1');
  check('la foule de la corde le compte, la liste des matchs non',
    s.foule().join() === '1,1' && s.crowd().join() === '1,0');
  const vue = s.snapshotFor('h1');
  check('la page reçoit la foule et ses bots', vue.crowd.join() === '1,1' && vue.bots.join() === '0,1');
  check('les deux tribunes disent le bot, sans figure',
    s.tribunesEnFace('h1').tribunes[1].bots === 1 && s.tribunesEnFace('h1').tribunes[1].joueurs.length === 0);

  s.join('h2', { side: 0, name: 'H2' });
  chanter(s, 'h2', 0.9);
  check('deux supporters du même camp : deux bots en face', s.bots().join() === '0,2');
  s.join('h3', { side: 0, name: 'H3' });
  chanter(s, 'h3', 0.9);
  check('trois contre personne : trois bots', s.bots().join() === '0,3');
  s.join('e1', { side: 1, name: 'E1' });
  chanter(s, 'e1', 0.9);
  check('trois contre un : deux bots aux côtés de celui qui est seul', s.bots().join() === '0,2'
    && s.foule().join() === '3,3');
  s.join('e2', { side: 1, name: 'E2' });
  s.join('e3', { side: 1, name: 'E3' });
  chanter(s, 'e2', 0.9); chanter(s, 'e3', 0.9);
  check('trois contre trois : plus de bot', s.bots().join() === '0,0');

  check('les bots ne sont ni membres ni au classement, et n’écrivent aucune présence',
    s.members.size === 6 && s.pousses.length > 0
    && s.pousses.every((p) => ['h1', 'h2', 'h3', 'e1', 'e2', 'e3'].includes(p.userId)));
}

/* ------------------------------------------------------- le réglage */
{
  const avant = reglagesVivants();
  const s = salle();
  s.join('h1', { side: 0, name: 'H1' });
  chanter(s, 'h1', 0.9);
  poserReglages({ 'virage.bots': false });
  check('réglage éteint : pas de bot', s.bots().join() === '0,0');
  poserReglages(avant);
  check('rallumé : le bot revient', s.bots().join() === '0,1');
  s.finA = horloge;
  check('après le coup de sifflet final, les bots se taisent', s.bots().join() === '0,0');
  const sans = salle({ bots: false });
  sans.join('h1', { side: 0, name: 'H1' });
  chanter(sans, 'h1', 0.9);
  check('une salle montée sans bots reste entre humains', sans.bots().join() === '0,0');
}

/* ----------------------------------------------------- ça pousse */
{
  const s = salle({ id: 9501 });
  s.join('h1', { side: 0, name: 'H1' });
  chanter(s, 'h1', 0.9);
  const rope0 = s.rope;
  let botAPousse = false;
  for (let k = 0; k < 100; k++) {
    horloge += RULES.tickMs;
    const avant = s.rope;
    s.tick(horloge);
    if (s.rope > avant) botAPousse = true;
  }
  check('dans les dix secondes, le bot tire la corde vers lui', botAPousse && s.rope !== rope0);
  /* La retombée « personne en face » ne joue plus : il y a quelqu'un. */
  check('la tribune d’en face n’est plus vide', s.foule()[1] === 1);
}

/* --------------------------------------------------- l'équilibre */
{
  /* Une demi-heure de match, un supporter seul, avec et sans bot. Somme sur
     deux matchs : le hasard des gestes est grand. */
  const bilan = (bots, adresse, n = 2) => {
    const total = [0, 0];
    for (let i = 0; i < n; i++) {
      const s = salle({ bots, id: 9600 + i });
      s.join('h1', { side: 0, name: 'H1' });
      jouer(s, [['h1', adresse]], 1800);
      total[0] += s.goals[0]; total[1] += s.goals[1];
    }
    return total;
  };
  const seul = bilan(false, 0.9);
  const contreBot = bilan(true, 0.9);
  console.log(`        appliqué, seul : ${seul.join('–')} ; contre un bot : ${contreBot.join('–')}`);
  check('seul, un supporter appliqué marque moins contre un bot que contre une tribune vide',
    contreBot[0] < seul[0]);
  check('et il bat le bot', contreBot[0] > contreBot[1]);
  const distrait = bilan(true, 0.05);
  console.log(`        au hasard, contre un bot : ${distrait.join('–')}`);
  check('qui tape au hasard ne gagne plus rien sans effort : il ne bat pas le bot',
    distrait[0] <= distrait[1]);
}

/* ------------------------------------------ deux contre deux bots */
{
  const s = salle({ id: 9700 });
  s.join('h1', { side: 0, name: 'H1' });
  s.join('h2', { side: 0, name: 'H2' });
  jouer(s, [['h1', 0.9], ['h2', 0.9]], 120);
  check('deux supporters jouent contre deux bots', s.bots().join() === '0,2' && s.botsEtat[1].length === 2);
}

Date.now = vrai;
console.log(`\n${failures ? `${failures} échec(s)` : 'tout est vert'}`);
process.exitCode = failures ? 1 : 0;
