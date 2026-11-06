/** L'usage du jeu : quelles pages se comptent, et pour qui. */
import assert from 'node:assert/strict';
import { createUsage, pageDe, NOMS } from '../src/server/usage/index.js';

assert.equal(pageDe('/'), 'accueil');
assert.equal(pageDe('/collection'), 'collection');
assert.equal(pageDe('/collection/'), 'collection', 'la barre finale ne change rien');
assert.equal(pageDe('/boutique.html?x=1'), 'boutique');
assert.equal(pageDe('/matchs'), 'matchs');
assert.equal(pageDe('/fanzzy/RP4'), 'fiche');
assert.equal(pageDe('/admin'), null, 'l’administration ne se compte pas');
assert.equal(pageDe('/api/me'), null, 'une requête de l’API n’est pas une page');
assert.equal(pageDe('/img/a.webp'), null);
for (const p of ['/', '/matchs', '/duel-nvn', '/virage', '/boosters', '/boutique', '/collection',
  '/fanzzy', '/classement', '/amis', '/kop', '/jeux', '/carnet', '/equipes', '/profil', '/aide']) {
  const nom = pageDe(p);
  assert.ok(NOMS[nom], `la page ${p} a un nom lisible`);
  assert.ok(('v:' + nom).length <= 16, `la clé de ${p} tient dans compteurs_jour.cle`);
}

const ecrit = [];
const pool = { execute: async (sql, params) => { ecrit.push([sql.replace(/\s+/g, ' ').trim(), params]); return [[]]; } };
const u = createUsage({ pool, horloge: () => Date.UTC(2026, 10, 6, 9) });
const passe = (req) => new Promise((r) => u.noter(req, {}, r));
await passe({ method: 'GET', path: '/collection', user: { id: 'p1' } });
await passe({ method: 'GET', path: '/collection' });                          // sans compte
await passe({ method: 'POST', path: '/collection', user: { id: 'p1' } });     // pas une ouverture
await passe({ method: 'GET', path: '/api/fanzzy', user: { id: 'p1' } });      // l'API
await passe({ method: 'GET', path: '/virage', user: { id: 'p2' } });
await new Promise((r) => setTimeout(r, 10));
const comptes = ecrit.filter(([s]) => s.startsWith('INSERT'));
assert.deepEqual(comptes.map(([, p]) => p), [['p1', 'v:collection'], ['p2', 'v:virage']],
  'seules les ouvertures de page d’un joueur connecté se comptent');
assert.equal(ecrit.filter(([s]) => s.startsWith('DELETE')).length, 1, 'le ménage passe une fois par jour');
assert.match(ecrit.find(([s]) => s.startsWith('DELETE'))[0], /cle LIKE 'v:%'.*INTERVAL 90 DAY/,
  'le ménage ne touche que les pages, après 90 jours');
console.log('usage-smoke : ok');
