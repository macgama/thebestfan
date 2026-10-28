/**
 * Test du camp des buts : la liste de l'API remise d'accord avec le tableau.
 * Sans base : `remettreLesCamps` est une fonction pure.
 */
import { remettreLesCamps } from '../src/server/football/camps.js';
import { estUnBut } from '../src/server/football/poller.js';

let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };

const SION = 85;
const LS = 92;
const but = (teamId, minute, player, detail = 'Normal Goal') => ({ type: 'Goal', detail, teamId, minute, player });
const camps = (liste, home, away) =>
  remettreLesCamps(liste, { homeId: SION, awayId: LS, home, away }, estUnBut);
const equipes = (r) => r.evenements.filter(estUnBut).map((e) => e.teamId).join(',');

/* Le 1-0 de Sion du 25 octobre 2026 : le but de Blin rangé sous Lausanne. */
let r = camps([{ type: 'Card', detail: 'Yellow Card', teamId: LS, minute: 12 }, but(LS, 30, 'A. Blin')], 1, 0);
check('le but de Blin revient à Sion', r.corriges === 1 && equipes(r) === `${SION}`);
check('le carton ne bouge pas', r.evenements[0].teamId === LS);

r = camps([but(SION, 30, 'A. Blin')], 1, 0);
check('une liste juste reste telle quelle', r.corriges === 0);

r = camps([but(LS, 30, 'A. Blin')], 0, 0);
check('une liste en avance sur le tableau ne bouge pas', r.corriges === 0);
r = camps([but(LS, 30, 'A. Blin')], 1, 1);
check('une liste en retard sur le tableau non plus', r.corriges === 0);

/* Un contre son camp rangé sous l'équipe du joueur : c'est lui qu'on retourne. */
r = camps([but(SION, 10, 'Un'), but(SION, 50, 'Deux', 'Own Goal'), but(LS, 70, 'Trois')], 1, 2);
check('le contre son camp est retourné en premier', r.corriges === 1 && equipes(r) === `${SION},${LS},${LS}`);

/* 2-0 de Sion, le second but mal rangé. */
r = camps([but(SION, 10, 'Un'), but(LS, 60, 'Deux')], 2, 0);
check('dans un match à sens unique, tout revient au vainqueur', r.corriges === 1 && equipes(r) === `${SION},${SION}`);

/* Les noms de la base (`team_id`) sont lus aussi, et gardés. */
r = camps([{ type: 'Goal', detail: 'Normal Goal', team_id: LS, minute: 30, player: 'A. Blin' }], 1, 0);
check('une ligne de la base garde la forme de la base',
  r.corriges === 1 && r.evenements[0].team_id === SION && !('teamId' in r.evenements[0]));

/* Un penalty manqué n'est pas un but : il ne prend pas de place au tableau. */
r = camps([but(LS, 20, 'Raté', 'Missed Penalty'), but(LS, 30, 'A. Blin')], 1, 0);
check('un penalty manqué ne compte pas', r.corriges === 1 && r.evenements[0].teamId === LS);

console.log(`\n${failures ? `${failures} échec(s)` : 'tout est vert'}`);
process.exitCode = failures ? 1 : 0;
