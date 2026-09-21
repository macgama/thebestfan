/**
 * L'écran d'aide : le parcours qui se coche seul, et la FAQ.
 *
 * ## Pourquoi un vrai navigateur
 *
 * Trois choses de cet écran ne se jugent pas en lisant le fichier.
 *
 * **La cérémonie ne doit pas féliciter pour rien.** Un joueur qui arrive pour
 * la première fois a déjà une étape cochée — le paquet de bienvenue lui a donné
 * ses Fanzzy. Lui allumer une case serait le féliciter de ce qu'il n'a pas
 * fait, et ce serait la première chose qu'il verrait de l'aide. La règle
 * — n'allumer que ce qui a changé **sous ses yeux** — tient dans une comparaison
 * avec ce que le navigateur avait retenu, et ne se vérifie donc qu'en chargeant
 * la page deux fois, avec quelque chose de fait entre les deux.
 *
 * **La page ne doit pas pouvoir cocher une étape.** C'est la garantie qui fait
 * tenir tout le reste. On regarde donc ce qu'elle affiche face à un serveur qui
 * dit non, et non ce que son code a l'air de faire.
 *
 * **La FAQ doit rester lisible sans compte.** C'est l'écran qu'on ouvre quand
 * on hésite à s'inscrire, et celui qu'on ouvre quand la session vient
 * d'expirer. Une page d'aide qui exige d'être connecté pour répondre à
 * « comment ça marche » est une porte fermée à clé sur laquelle on a écrit
 * « entrée ».
 *
 * Usage : node scripts/aide-ui-smoke.mjs
 * (npm install --no-save puppeteer)
 */
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import puppeteer from 'puppeteer';
import { createAide } from '../src/server/aide/index.js';
import { ETAPES } from '../src/shared/aide.js';
import { charger as chargerCatalogue } from '../src/server/fanzzy/catalogue.js';
import { baseDeTest, OPTIONS_BASE } from './base-de-test.mjs';

const DB = baseDeTest();
const RACINE = fileURLToPath(new URL('..', import.meta.url));

let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };
const dodo = (ms) => new Promise((r) => setTimeout(r, ms));
async function jusqua(fn, ms = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await fn()) return true; await dodo(60); }
  return false;
}

/* ---------------------------------------------------------------- la base */

const mysql = await import('mysql2/promise');
const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
await raw.query('SET FOREIGN_KEY_CHECKS = 0');
await raw.query(`DROP TABLE IF EXISTS user_decks, user_stuff, user_etats, user_skins, user_fanzzy,
  virage_presence, user_wallet, duel_results, duel_events, duels, souvenirs,
  user_souvenirs, sessions, auth_tokens, login_attempts, users, reglages, fanzzy`);
await raw.query('SET FOREIGN_KEY_CHECKS = 1');
for (const f of ['auth.sql', 'souvenirs.sql', 'fanzzy.sql', 'inventaire.sql',
  'deck.sql', 'duel.sql', 'aide.sql']) {
  await raw.query(readFileSync(path.join(RACINE, 'sql', f), 'utf8'));
}
await raw.end();

const pool = mysql.createPool({ uri: DB, connectionLimit: 6, ...OPTIONS_BASE });
await chargerCatalogue(pool);

const U = 'aide-ui-joueur';
await pool.query(
  `INSERT INTO users (public_id, email, pseudo, password_hash) VALUES (?, ?, ?, 'x')`,
  [U, 'aide-ui@test', 'Guide']);
/* Deux Fanzzy et un titulaire : l'état exact d'un joueur qui sort du paquet de
   bienvenue. C'est celui dont l'écran doit s'occuper le mieux. */
const [dex] = await pool.query(
  `SELECT id FROM fanzzy WHERE stage = 1 AND rar = 'commune' ORDER BY id LIMIT 2`);
const PREMIER = dex[0]?.id ?? 'RP1';
await pool.query(
  `INSERT INTO user_wallet (user_id, packs, active_fanzzy) VALUES (?, 0, ?)`,
  [U, PREMIER]);
for (const f of dex) {
  await pool.query(
    `INSERT INTO user_fanzzy (user_id, fanzzy_id, stage) VALUES (?, ?, 1)`, [U, f.id]);
}

/* -------------------------------------------------------------- le serveur */

let connecte = true;
/* Une réponse **plausible et creuse** : ni erreur, ni parcours. C'est ce que
   rend une route non montée derrière un fourre-tout, et c'est le cas qui a
   cassé la page — voir la section qui l'éprouve, tout en bas. */
let creux = false;
const requireAuth = (q, s, n) => {
  if (!connecte) return s.status(401).json({ error: 'auth.error.required' });
  q.user = { id: U };
  return n();
};
const aide = createAide({ pool, requireAuth });

const app = express();
app.use('/api/aide/parcours', (_q, s, n) =>
  (creux ? s.json({ ok: true, items: [], liste: [] }) : n()));
app.use('/api/aide', aide.router);
app.get('/api/auth/me', (_q, s) => (connecte
  ? s.json({ user: { id: U, pseudo: 'Guide', verified: true } })
  : s.status(401).json({ error: 'auth.error.required' })));
app.get('/api/fanzzy/dex', (_q, s) => s.json({ dex: [], sets: [], types: {} }));
app.get('/api/admin/suis-je', (_q, s) => s.json({ admin: false }));
/* Le fourre-tout : une forme vide mais plausible pour tout ce que la barre du
   haut et le menu demandent en fond. Sans lui, chaque appel manquant part en
   404 et remplit la console d'un bruit qui cacherait une vraie erreur. */
app.use('/api', (_q, s) => s.json({ ok: true, items: [], liste: [] }));
app.get('/aide', (_q, s) => s.sendFile(path.join(RACINE, 'public', 'aide.html')));
app.use(express.static(path.join(RACINE, 'public')));

const http = createServer(app);
await new Promise((r) => http.listen(0, r));
const base = `http://localhost:${http.address().port}`;

const nav = await puppeteer.launch({ args: ['--no-sandbox'] });
const erreurs = [];
const page = await nav.newPage();
page.on('pageerror', (e) => erreurs.push(e.message));
await page.setViewport({ width: 390, height: 860 });

const lire = () => page.evaluate(() => ({
  pas: [...document.querySelectorAll('.pas')].map((p) => ({
    cle: p.dataset.cle,
    ok: p.classList.contains('ok'),
    neuf: p.classList.contains('neuf'),
    nom: p.querySelector('.nom')?.textContent.trim(),
    etat: p.querySelector('.etat')?.textContent.trim(),
    bouton: p.querySelector('.aller')?.getAttribute('href') ?? null,
    quoi: p.querySelector('.texte p')?.textContent.trim() ?? '',
  })),
  compte: document.querySelector('.entete .compte')?.textContent.replace(/\s+/g, '') ?? null,
  jauge: document.getElementById('jauge')?.style.width ?? null,
  vide: document.querySelector('.vide')?.textContent.trim() ?? null,
  texte: document.body.innerText,
}));

/* ======================================================= la première visite */

await page.goto(`${base}/aide`, { waitUntil: 'networkidle0' });
check('les six étapes s’affichent', await jusqua(async () =>
  page.evaluate(() => document.querySelectorAll('.pas').length === 6)));

const un = await lire();
check('elles sont dans l’ordre du parcours',
  JSON.stringify(un.pas.map((p) => p.cle)) === JSON.stringify(ETAPES.map((e) => e.cle))
  || (console.log('        ', un.pas.map((p) => p.cle).join(' ')), false));

check('seule l’étape du premier Fanzzy est cochée',
  JSON.stringify(un.pas.filter((p) => p.ok).map((p) => p.cle)) === JSON.stringify(['fanzzy'])
  || (console.log('        cochées :', un.pas.filter((p) => p.ok).map((p) => p.cle)), false));

check(`la jauge dit un sixième (${un.compte} · ${un.jauge})`,
  un.compte === '1/6' && un.jauge === '17%'
  || (console.log('        elle dit :', un.compte, un.jauge), false));

/* **Rien ne s'allume à la première visite.** Le joueur n'a rien franchi : sa
   carte lui a été donnée. Une cérémonie ici le féliciterait de son inscription,
   et lui apprendrait au passage que les allumages ne veulent rien dire. */
check('et rien ne s’allume, puisque rien n’a été franchi',
  un.pas.every((p) => !p.neuf)
  || (console.log('        allumées :', un.pas.filter((p) => p.neuf).map((p) => p.cle)), false));

/* Une étape faite ne propose plus d'y aller : le bouton disparaît. Une étape
   qui reste ne dit pas « à faire » sans dire **où**. */
check('une étape faite ne propose plus d’y aller',
  un.pas.find((p) => p.cle === 'fanzzy')?.bouton === null);
check('et chacune des cinq autres mène quelque part',
  un.pas.filter((p) => !p.ok).every((p) => p.bouton && p.bouton.startsWith('/'))
  || (console.log('        ', un.pas.filter((p) => !p.ok).map((p) => p.bouton)), false));
check('les textes des étapes sont rendus',
  un.pas.every((p) => p.quoi.length > 40));

/* ============================================ ce qui se fait pendant qu'on joue

   On coche deux signaux en base — comme le ferait une ouverture de booster et
   une évolution — et on revient. C'est tout le contrat de cet écran : rien
   n'aura prévenu l'aide, et les deux lignes doivent s'allumer. */

await pool.query(`UPDATE user_wallet SET packs_ouverts = 3 WHERE user_id = ?`, [U]);
await pool.query(
  `UPDATE user_fanzzy SET stage = 2 WHERE user_id = ? AND fanzzy_id = ?`, [U, PREMIER]);

await page.goto(`${base}/aide`, { waitUntil: 'networkidle0' });
check('au retour, trois étapes sont cochées', await jusqua(async () =>
  page.evaluate(() => document.querySelectorAll('.pas.ok').length === 3)));

check('les deux nouvelles s’allument', await jusqua(async () => page.evaluate(() =>
  ['booster', 'evolution'].every((c) =>
    document.querySelector(`.pas[data-cle="${c}"]`)?.classList.contains('neuf')))));

const deux = await lire();
check('et celle qui était déjà faite ne se rallume pas',
  deux.pas.find((p) => p.cle === 'fanzzy')?.neuf === false
  || (console.log('        elle se rallume'), false));
check(`la jauge a monté (${deux.compte} · ${deux.jauge})`,
  deux.compte === '3/6' && deux.jauge === '50%');

/* Et une troisième visite sans rien faire entre les deux n'allume plus rien :
   c'est la contrepartie, et c'est elle qui rend l'allumage signifiant. */
await page.goto(`${base}/aide`, { waitUntil: 'networkidle0' });
await jusqua(async () => page.evaluate(() => document.querySelectorAll('.pas').length === 6));
await dodo(900);
const trois = await lire();
check('revenir sans avoir rien fait n’allume rien',
  trois.pas.every((p) => !p.neuf)
  || (console.log('        allumées :', trois.pas.filter((p) => p.neuf).map((p) => p.cle)), false));

/* ================================================================= la FAQ */

await page.click('[data-t="faq"]');
check('les questions s’affichent', await jusqua(async () =>
  page.evaluate(() => document.querySelectorAll('.qa').length >= 12)));

const faqVue = await page.evaluate(() => ({
  rubriques: [...document.querySelectorAll('.rub h2')].map((h) => h.textContent.trim()),
  questions: document.querySelectorAll('.qa').length,
  ouvertes: document.querySelectorAll('.qa[open]').length,
  premiere: document.querySelector('.qa summary')?.textContent.trim(),
  reponse: document.querySelector('.qa .r')?.textContent.trim(),
}));
check(`la FAQ a ses rubriques (${faqVue.rubriques.length})`, faqVue.rubriques.length >= 3);
check(`et ses questions (${faqVue.questions})`, faqVue.questions >= 20);
check('tout est replié en arrivant', faqVue.ouvertes === 0);
check('une question porte un texte', (faqVue.premiere ?? '').length > 10);
check('et sa réponse aussi', (faqVue.reponse ?? '').length > 40);

await page.click('.qa summary');
check('une question s’ouvre au toucher', await jusqua(async () =>
  page.evaluate(() => document.querySelectorAll('.qa[open]').length === 1)));

/* ======================================================= rien ne fuit à l'écran

   La règle du tour des écrans, appliquée ici : un `undefined` ou un code
   d'erreur serveur qui atteint la page est une fuite, et sur l'écran d'aide
   c'est la pire des vitrines. */
{
  const t = trois.texte + '\n' + (await page.evaluate(() => document.body.innerText));
  const fuites = ['undefined', 'NaN', '[object Object]', 'aide.error', 'null']
    .filter((m) => t.includes(m));
  check('aucune fuite technique à l’écran', fuites.length === 0
    || (console.log('        ', fuites.join(' · ')), false));
}

/* ====================================================== la FAQ sans compte */

connecte = false;
await page.goto(`${base}/aide`, { waitUntil: 'networkidle0' });
check('sans compte, la page s’affiche quand même', await jusqua(async () =>
  page.evaluate(() => Boolean(document.querySelector('.vide') || document.querySelector('.pas')))));

const hors = await lire();
check('le parcours invite à se connecter au lieu de mentir',
  hors.pas.length === 0 && (hors.vide ?? '').length > 20
  || (console.log('        il montre :', hors.pas.length, 'étapes ·', hors.vide), false));

await page.click('[data-t="faq"]');
check('et les questions restent lisibles', await jusqua(async () =>
  page.evaluate(() => document.querySelectorAll('.qa').length >= 12)));

/* ====================================================== la page ne coche rien

   La garantie centrale, éprouvée par le seul moyen honnête : on demande la
   récompense au serveur avec un parcours incomplet, depuis la page, et l'on
   regarde qu'il refuse. Le reste du fichier pourrait bien être écrit, il ne
   prouverait rien de ce point-là. */
connecte = true;
{
  const r = await page.evaluate(async (u) => {
    const x = await fetch(`${u}/api/aide/recompense`,
      { method: 'POST', credentials: 'same-origin' }).then((y) => y.json());
    return { verse: x.verse, raison: x.raison, faites: x.faites };
  }, base);
  check(`le serveur refuse une récompense non méritée (${r.faites}/6)`,
    r.verse === false && r.raison === 'incomplet');
}

/* =============================== une réponse creuse ne casse pas l'écran

   Le défaut réel, et il n'a pas été trouvé ici : c'est `tour:ui` qui l'a vu, en
   ouvrant la page derrière un fourre-tout qui rend `{ ok: true }` à tout. La
   page ne cherchait qu'un champ `error` — absent — et partait écrire
   `undefined.map`. Écran blanc, sur la seule page dont l'écran blanc n'a aucun
   recours.

   Il vaut pour une route non montée, un serveur derrière un intermédiaire
   bavard, et une version de l'API qui aurait changé de forme. */
{
  creux = true;
  const avant = erreurs.length;
  await page.goto(`${base}/aide`, { waitUntil: 'networkidle0' });
  await jusqua(async () => page.evaluate(() => Boolean(document.querySelector('.vide'))));
  const vu = await lire();
  check('une réponse creuse n’affiche pas un parcours vide',
    vu.pas.length === 0 && (vu.vide ?? '').length > 20);
  check('et elle ne lève pas', erreurs.length === avant
    || (console.log('        ', erreurs.slice(avant).join(' · ')), false));

  await page.click('[data-t="faq"]');
  check('la FAQ reste lisible malgré tout', await jusqua(async () =>
    page.evaluate(() => document.querySelectorAll('.qa').length >= 12)));
  creux = false;
}

check('aucune erreur de script sur l’écran d’aide', erreurs.length === 0
  || (console.log('        ', erreurs.slice(0, 3).join(' · ')), false));

await nav.close();
await new Promise((r) => http.close(r));
await pool.end();
console.log(`\n${failures ? `${failures} échec(s)` : 'tout est vert'}`);
process.exitCode = failures ? 1 : 0;
