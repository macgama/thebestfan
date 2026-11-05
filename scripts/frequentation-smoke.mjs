/** Le compteur de joueurs connectés de l'administration : fenêtres et ménage. */
import assert from 'node:assert/strict';
import { createFrequentation } from '../src/server/frequentation/index.js';

let t = Date.UTC(2026, 10, 5, 12);
const f = createFrequentation({ horloge: () => t });
const MIN = 60_000;

assert.deepEqual({ ...f.compter(), depuis: undefined }, { maintenant: 0, heure: 0, jour: 0, depuis: undefined });
f.noter('a'); f.noter('b'); f.noter('a'); f.noter(null);
assert.equal(f.compter().maintenant, 2, 'un joueur vu deux fois compte une fois');

t += 5 * MIN;                       // borne stricte : à 5 min pile, plus en ligne
f.noter('c');
let n = f.compter();
assert.equal(n.maintenant, 1); assert.equal(n.heure, 3); assert.equal(n.jour, 3);

t += 2 * 60 * MIN;
n = f.compter();
assert.equal(n.maintenant, 0); assert.equal(n.heure, 0); assert.equal(n.jour, 3);

t += 24 * 60 * MIN;
f.noter('d');                       // déclenche le ménage
n = f.compter();
assert.equal(n.jour, 1, 'les marques de plus de 24 h sont oubliées');
assert.equal(typeof n.depuis, 'string');
console.log('frequentation-smoke : ok');
