/**
 * Test des répliques du Fanzzy — sans base ni serveur.
 *
 * `fanzzy-repliques.js` porte ce que dit le Fanzzy de l'accueil, moment par
 * moment. Ce qui s'y casse ne se voit pas à la lecture : une ligne de cinq
 * mots, un chiffre glissé dans une réplique, une famille mal orthographiée qui
 * ne parle jamais, un Fanzzy dont la réplique est rangée sous un identifiant
 * qui n'existe pas. On vérifie donc chaque ligne, et le tirage.
 *
 * Usage : node scripts/repliques-smoke.mjs
 */
import { readFile } from 'node:fs/promises';
import { Script, createContext } from 'node:vm';
import { BY_ID, TYPES } from '../src/shared/fanzzy/dex.js';
import { DEX_SAISON } from '../src/shared/fanzzy/dex-saison.js';

let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };

const bac = { console };
bac.window = bac;
const code = await readFile(new URL('../public/fanzzy-repliques.js', import.meta.url), 'utf8');
new Script(code, { filename: 'fanzzy-repliques.js' }).runInContext(createContext(bac));
const R = bac.window.TBF_REPLIQUES;

check('le module s’expose', typeof R?.dire === 'function');

/* ## Les règles du marqueur, ligne par ligne

   Les mêmes que l'accueil (`ecrivable`, dans `index.html`) : au plus quatre
   mots — un mot est ce qui porte une lettre —, et aucun chiffre. Une ligne
   qui les enfreint ne serait jamais dite, et personne ne le remarquerait. */
const mots = (s) => s.split(/\s+/).filter((m) => /\p{L}/u.test(m)).length;
const toutes = [];
const ranger = (ou, l) => { for (const x of l ?? []) toutes.push([ou, x]); };
for (const [h, l] of Object.entries(R.COMMUN.salut)) ranger(`commun.salut.${h}`, l);
for (const [m, l] of Object.entries(R.COMMUN)) if (m !== 'salut') ranger(`commun.${m}`, l);
for (const [f, t] of Object.entries(R.FAMILLES)) for (const [m, l] of Object.entries(t)) ranger(`${f}.${m}`, l);
for (const [p, t] of Object.entries(R.PERSO)) for (const [m, l] of Object.entries(t)) ranger(`${p}.${m}`, l);

const trop = toutes.filter(([, x]) => mots(x) > 4);
check(`aucune ligne de plus de quatre mots (${toutes.length} lignes)`, !trop.length);
for (const [ou, x] of trop) console.log(`        ${ou} : « ${x} »`);
const chiffres = toutes.filter(([, x]) => /\d/.test(x));
check('aucune ligne n’a de chiffre', !chiffres.length);
for (const [ou, x] of chiffres) console.log(`        ${ou} : « ${x} »`);
check('aucune ligne vide', toutes.every(([, x]) => typeof x === 'string' && x.trim()));
check('l’apostrophe typographique, partout', toutes.every(([, x]) => !x.includes("'")));

/* ## Ce qui est rangé existe */
const MOMENTS = new Set(R.MOMENTS);
const momentsEcrits = [
  ...Object.keys(R.COMMUN),
  ...Object.values(R.FAMILLES).flatMap(Object.keys),
  ...Object.values(R.PERSO).flatMap(Object.keys),
];
check('chaque moment écrit est un moment connu', momentsEcrits.every((m) => MOMENTS.has(m)));
check('tout le monde a une ligne pour chaque moment',
  R.MOMENTS.every((m) => (m === 'salut'
    ? ['matin', 'jour', 'soir', 'nuit'].every((h) => R.COMMUN.salut[h]?.length)
    : R.COMMUN[m]?.length)));
check('les six familles parlent, sous leur nom de `dex.js`',
  Object.keys(TYPES).every((t) => R.FAMILLES[t]) && Object.keys(R.FAMILLES).every((t) => TYPES[t]));
check('chaque réplique personnelle est rangée sous une carte du catalogue',
  Object.keys(R.PERSO).every((id) => BY_ID.has(id)));
const premiers = DEX_SAISON.filter((f) => f.stage === 1);
check(`les ${premiers.length} Fanzzy de LA REPRISE ont leur réplique`,
  premiers.every((f) => R.PERSO[f.id]?.calme?.length));

/* ## Le tirage */
const suite = (vals) => { let i = 0; return () => vals[i++ % vals.length]; };
check('sa réplique à lui, quand le sort le veut',
  R.PERSO.RP1.calme.includes(R.dire('calme', { carte: 'RP1', type: 'voix', hasard: suite([0.1, 0]) })));
check('sinon celle de sa famille',
  R.FAMILLES.voix.calme.includes(R.dire('calme', { carte: 'RP1', type: 'voix', hasard: suite([0.9, 0.1, 0]) })));
check('sinon celle de tout le monde',
  R.COMMUN.calme.includes(R.dire('calme', { carte: 'RP1', type: 'voix', hasard: suite([0.9, 0.9, 0]) })));
check('un autre âge n’a pas la réplique du premier',
  !R.PERSO.RP1.calme.includes(R.dire('calme', { carte: 'RP1C', type: 'voix', hasard: suite([0.1, 0.9, 0]) })));
check('le supporter générique parle comme tout le monde',
  R.COMMUN.victoire.includes(R.dire('victoire', {})));
check('le salut suit l’heure',
  R.COMMUN.salut.nuit.includes(R.dire('salut', { heure: 2 }))
  && R.COMMUN.salut.matin.includes(R.dire('salut', { heure: 8 }))
  && R.COMMUN.salut.soir.includes(R.dire('salut', { heure: 21 })));
check('un moment inconnu ne dit rien', R.dire('sieste', {}) === null);
let redit = false;
for (let i = 0, avant = null; i < 200; i++) {
  const x = R.dire('encore', { type: 'perc' });
  if (x === avant) redit = true;
  avant = x;
}
check('jamais deux fois la même ligne d’affilée', !redit);

console.log(failures ? `\n${failures} échec(s)` : '\nTout est vert.');
process.exit(failures ? 1 : 0);
