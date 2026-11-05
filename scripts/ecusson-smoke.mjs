/**
 * L'écusson du jeu (choix de Gaël du 5 novembre 2026) : dans le jeu, un club
 * se montre à ses couleurs et à ses initiales, jamais avec son logo ; les
 * pages « Matchs » gardent le logo officiel.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import express from 'express';
import { JSDOM } from 'jsdom';
import { createEcusson, dessinerEcusson, initiales } from '../src/server/football/ecusson.js';

let ok = 0;
const check = (nom, v) => { assert.ok(v, nom); ok++; console.log(`  ok  ${nom}`); };

check('les initiales viennent du code du club', initiales({ code: 'liv', name: 'Liverpool' }) === 'LIV');
check('sans code : les initiales du nom, sans « FC »', initiales({ name: 'FC Young Boys' }) === 'YB');
check('un seul mot : ses trois premières lettres', initiales({ name: 'Servette' }) === 'SER');
check('les accents tombent', initiales({ name: 'Atlético Madrid' }) === 'AM');

const svg = dessinerEcusson({ c1: '#C8102E', c2: '#FFFFFF', lettres: 'LIV' });
check('le dessin porte les deux couleurs du club', svg.includes('#C8102E') && svg.includes('#FFFFFF'));
check('et ses initiales', svg.includes('>LIV</text>'));
check('et aucune image extérieure', !/href=|<image/i.test(svg));
check('un texte piégé est échappé', dessinerEcusson({ lettres: '<a>' }).includes('&lt;a'));

const equipes = { 40: { name: 'Liverpool', code: 'LIV', color1: '#C8102E', color2: '#F6EB61' } };
const pool = {
  query: async (sql, [id]) => (/FROM teams/.test(sql)
    ? [equipes[id] ? [equipes[id]] : []]
    : [[{ name: 'Premier League' }]]),
};
const app = express();
app.use('/api/ecusson', createEcusson({ pool, aLaMain: {} }).router);
const srv = app.listen(0);
await new Promise((r) => srv.once('listening', r));
const base = `http://127.0.0.1:${srv.address().port}/api/ecusson`;
try {
  const r = await fetch(`${base}/40.svg`);
  const corps = await r.text();
  check('GET /api/ecusson/40.svg : un SVG aux couleurs de Liverpool', r.status === 200
    && r.headers.get('content-type').startsWith('image/svg+xml')
    && corps.includes('#C8102E') && corps.includes('>LIV<'));
  const inconnu = await fetch(`${base}/999999.svg`);
  check('un club inconnu reçoit quand même un écusson', inconnu.status === 200
    && (await inconnu.text()).startsWith('<svg'));
  const ligue = await (await fetch(`${base}/ligue/39.svg`)).text();
  check('une compétition : écusson neutre à ses initiales', ligue.includes('>PL<'));
} finally { srv.close(); }

/* Le navigateur : `public/ecusson.js` remplace les logos d'API-Football. */
const dom = new JSDOM(`<!doctype html><body>
  <img id="a" src="https://media.api-sports.io/football/teams/40.png">
  <img id="b" src="/img/logo.png"></body>`, { runScripts: 'outside-only' });
dom.window.eval(readFileSync(new URL('../public/ecusson.js', import.meta.url), 'utf8'));
const $ = (id) => dom.window.document.getElementById(id);
check('un logo de club devient l’écusson du jeu', $('a').getAttribute('src') === '/api/ecusson/40.svg');
check('le logo du site ne bouge pas', $('b').getAttribute('src') === '/img/logo.png');
dom.window.document.body.insertAdjacentHTML('beforeend',
  '<img id="c" src="https://media.api-sports.io/football/leagues/39.png">');
await new Promise((r) => setTimeout(r, 0));
check('une image ajoutée ensuite est remplacée aussi', $('c').getAttribute('src') === '/api/ecusson/ligue/39.svg');
$('b').setAttribute('src', 'https://media.api-sports.io/football/teams/7.png');
await new Promise((r) => setTimeout(r, 0));
check('une adresse changée ensuite aussi', $('b').getAttribute('src') === '/api/ecusson/7.svg');

/* Le partage voulu par Gaël : le jeu charge l'écusson, « Matchs » non. */
const page = (n) => readFileSync(new URL(`../public/${n}.html`, import.meta.url), 'utf8');
const JEU = ['bienvenue', 'carnet', 'classement', 'duel-nvn', 'equipes', 'fanzzy-fiche', 'fanzzy',
  'boosters', 'profil', 'virage', 'deck', 'repetition', 'kop'];
const MATCHS = ['aujourdhui', 'teletext'];
check('chaque page du jeu charge l’écusson', JEU.every((n) => page(n).includes('<script src="/ecusson.js">')));
check('les pages Matchs gardent les logos officiels', MATCHS.every((n) => !page(n).includes('/ecusson.js')));

console.log(`\n${ok} contrôles`);
