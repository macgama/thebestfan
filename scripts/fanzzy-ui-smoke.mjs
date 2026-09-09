/**
 * Test du classeur Fanzzy.
 *
 * Cette page ne contient plus de catalogue : elle le lit sur
 * `/api/fanzzy/dex`. Ce qui était une constante immédiate est devenu un appel
 * réseau, et tout le rendu en dépend. Ce test existe pour ça — vérifier que
 * la grille, le kiosque et l'écran de duel se peuplent bien depuis la
 * réponse du serveur, et qu'un catalogue absent ou amputé le dise au lieu de
 * laisser une page vide.
 *
 * Il attrape aussi la faute qui a coûté le plus cher ici : une carte tirée
 * d'un booster que la page ne saurait pas afficher.
 *
 * Usage : node scripts/fanzzy-ui-smoke.mjs
 */
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import puppeteer from 'puppeteer';
import { createFanzzy } from '../src/server/fanzzy/index.js';
import { DEX } from '../src/shared/fanzzy/dex.js';
import { charger as chargerCatalogue } from '../src/server/fanzzy/catalogue.js';

const DB = process.env.DATABASE_URL ?? 'mysql://tbf:tbfpass@127.0.0.1:3307/tbf';
// Voir deck-ui-smoke : `.pathname` donne « /C:/… » sous Windows, ce qui rend
// la suite inutilisable là où elle est justement censée tourner avant livraison.
const RACINE = fileURLToPath(new URL('..', import.meta.url));

let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };
const dodo = (ms) => new Promise((r) => setTimeout(r, ms));
async function jusqua(fn, ms = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await fn()) return true; await dodo(60); }
  return false;
}

/* ------------------------------------------------------------- la base */

const mysql = await import('mysql2/promise');
const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
await raw.query(`DROP TABLE IF EXISTS user_decks, user_stuff, user_skins, user_fanzzy,
  user_souvenirs, virage_presence, souvenirs, user_wallet, api_cache, souvenir_leagues,
  duel_results, duel_events, duels, user_follows, fixture_events, standings, fixtures,
  team_leagues, teams, leagues, api_quota, login_attempts, auth_tokens, sessions, users`);
for (const f of ['auth.sql', 'football.sql', 'souvenirs.sql', 'fanzzy.sql',
                 'inventaire.sql', 'deck.sql']) {
  await raw.query(readFileSync(path.join(RACINE, 'sql', f), 'utf8'));
}

const U = 'bbbbbbbb-0000-0000-0000-000000000001';
await raw.query(`INSERT INTO users (public_id,email,pseudo,password_hash)
                 VALUES (?,?,?,'x')`, [U, 'classeur@ex.fr', 'Classeuse']);
// Assez d'écharpes et de boosters pour ouvrir sans attendre la régénération.
await raw.query(`INSERT INTO user_wallet (user_id,scarves,packs,active_fanzzy)
                 VALUES (?,900,9,'G1')`, [U]);
// G1 est possédé : c'est le Fanzzy illustré, et c'est lui qui cassait la page.
for (const f of ['G1', 'X7', 'X8', 'V1', 'P1']) {
  await raw.query(`INSERT INTO user_fanzzy (user_id,fanzzy_id,copies) VALUES (?,?,1)`, [U, f]);
}
await raw.end();

/* ----------------------------------------------------------- le serveur */

const pool = mysql.createPool({ uri: DB, connectionLimit: 6, charset: 'utf8mb4' });
// Le catalogue vit en base depuis qu il se gère par l administration :
// on le charge comme le fait server.js, sinon les modules travaillent
// sur un catalogue vide.
await chargerCatalogue(pool);
const requireAuth = (q, _s, n) => { q.user = { id: U }; n(); };
const fanzzy = createFanzzy({ pool, requireAuth });

/**
 * Un interrupteur pour amputer la réponse du catalogue.
 * Il sert au dernier contrôle : une page privée de catalogue doit nommer la
 * cause, pas afficher une grille vide sans un mot.
 */
let amputer = null;
const app = express();
app.use('/api/fanzzy', (q, s, n) => {
  if (amputer && q.path === '/dex') {
    const envoyer = s.json.bind(s);
    s.json = (v) => envoyer({ ...v, [amputer]: undefined });
  }
  n();
}, fanzzy.router);
app.get('/fanzzy', (_q, s) => s.sendFile(path.join(RACINE, 'public', 'fanzzy.html')));
app.use(express.static(path.join(RACINE, 'public')));

const http = createServer(app);
await new Promise((r) => http.listen(0, r));
const base = `http://localhost:${http.address().port}`;

const nav = await puppeteer.launch({ args: ['--no-sandbox'] });
const erreurs = [];

async function ouvrir({ sansCache = false } = {}) {
  const page = await nav.newPage();
  page.on('pageerror', (e) => erreurs.push(e.message));
  // /api/fanzzy/dex est servie avec un cache d'une heure. Sans cette coupure,
  // le second chargement rejouait la réponse mise en cache et n'atteignait
  // jamais le serveur : le test croyait avoir amputé le catalogue alors que
  // la page recevait toujours le bon.
  if (sansCache) await page.setCacheEnabled(false);
  await page.setViewport({ width: 400, height: 880, deviceScaleFactor: 1 });
  await page.goto(base + '/fanzzy', { waitUntil: 'networkidle0' });
  return page;
}

/* ------------------------------------------ le catalogue vient du réseau

   `PUBLIE` et non `DEX` : trente-deux anciennes cartes sont dépubliées parce
   qu'elles refont un personnage du lot de 2026. Le classeur ne doit montrer que
   ce qui se joue — une carte retirée qui resterait dans la grille laisserait
   une case impossible à remplir, et la progression n'atteindrait jamais 100 %. */

const PUBLIE = DEX.filter((f) => f.publie !== false);


{
  const reponse = await (await fetch(base + '/api/fanzzy/dex')).json();
  check('la route sert le catalogue publié', reponse.dex?.length === PUBLIE.length);
  check('et tout ce que la page utilisait en dur',
    Boolean(reponse.types && reponse.sets && reponse.rar
            && reponse.scarves && reponse.evoCost && reponse.rates));
  check('les taux de tirage couvrent les deux emplacements rares',
    Boolean(reponse.rates?.[4] && reponse.rates?.[5]));
}

const page = await ouvrir();

check('la page se charge sans erreur de script', erreurs.length === 0);
if (erreurs.length) console.log('   ', erreurs.slice(0, 3));

check('le catalogue est arrivé du serveur',
  await page.evaluate(() => DEX.length) === PUBLIE.length);
check('la table des identifiants est reconstruite',
  await page.evaluate(() => BY_ID.size) === PUBLIE.length);
check('les types sont là, sinon aucune carte n\u2019a de couleur',
  await page.evaluate(() => Object.keys(TYPES).length) === 6);

/* --------------------------------------------------------- le classeur */

await page.evaluate(() => [...document.querySelectorAll('button')]
  .find((b) => /CLASSEUR/i.test(b.textContent))?.click());
await jusqua(async () => await page.evaluate(() =>
  document.querySelectorAll('#grid .slot').length > 0));

const grille = await page.evaluate(() => ({
  cases: document.querySelectorAll('#grid .slot').length,
  possedees: document.querySelectorAll('#grid .slot:not(.locked)').length,
  progression: document.getElementById('progTxt')?.textContent ?? '',
}));
check('la grille affiche tout le catalogue publié', grille.cases === PUBLIE.length);
check('les cartes possédées sont distinguées', grille.possedees === 5);
check('la progression compte sur le catalogue du serveur',
  grille.progression === `5/${PUBLIE.length}`);

// La grille se peuplait déjà mal quand une seule chose manquait : ce contrôle
// vaut pour toutes les cartes non possédées, celles qui passent par `esc`.
check('les Fanzzy non possédés portent leur nom',
  await page.evaluate(() => {
    const v = document.querySelector('#grid .slot.locked');
    return Boolean(v && v.textContent.trim().length > 2);
  }));

/* ----------------------------------------------------------- le kiosque */

await page.evaluate(() => [...document.querySelectorAll('button')]
  .find((b) => /KIOSQUE/i.test(b.textContent))?.click());
await dodo(400);
check('le kiosque annonce le bon nombre de Fanzzy par set',
  await page.evaluate(() => /\d+ Fanzzy/.test(
    document.getElementById('setLine')?.textContent ?? '')));

/* ---------------------------------------- ouvrir un booster ne casse rien */

const ouverture = await page.evaluate(async () => {
  const r = await fetch('/api/fanzzy/open', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    credentials: 'same-origin', body: JSON.stringify({ set: 'VN' }),
  });
  const j = await r.json();
  // Chaque carte tirée doit être connue de la page, sinon l'ouverture casse.
  return (j.cards ?? []).filter((c) => c.type !== 'skin' && !BY_ID.has(c.id));
});
check('toutes les cartes tirées sont connues de la page', ouverture.length === 0);
if (ouverture.length) console.log('    inconnues :', ouverture);

/* --------------------------- un catalogue amputé nomme sa cause */

/**
 * Le texte réellement affiché.
 *
 * `body.textContent` inclut le contenu des balises <script> : une recherche
 * de message y trouve la chaîne dans le code source de la page et passe même
 * quand rien n'est affiché. Ce test s'y est laissé prendre.
 */
const texteAffiche = (p) => p.evaluate(() => {
  const corps = document.body.cloneNode(true);
  for (const s of corps.querySelectorAll('script,style')) s.remove();
  return corps.textContent.replace(/\s+/g, ' ');
});

amputer = 'types';
const page2 = await ouvrir({ sansCache: true });
const messageAmputé = await jusqua(async () =>
  /catalogue incomplet/i.test(await texteAffiche(page2)), 6000);
check('un catalogue amputé est refusé en nommant le champ manquant', messageAmputé);
if (!messageAmputé) {
  console.log('    affiché :', (await texteAffiche(page2)).slice(0, 200));
}
check('la grille ne se remplit pas avec un catalogue amputé',
  await page2.evaluate(() => document.querySelectorAll('#grid .slot').length) === 0);
check('et elle explique pourquoi au lieu de rester vide',
  /n\u2019a pas pu charger le catalogue/.test(await texteAffiche(page2)));

/* ------------------------------- la barre commune sur un petit téléphone

 * Ce contrôle vivait dans accueil-ui-smoke. L’accueil est devenu un écran de
 * jeu plein cadre qui ne porte plus la barre : le contrôle a déménagé ici,
 * sur une page qui l’affiche encore. Sept entrées sur 320 px — un iPhone SE —
 * font quarante-cinq pixels chacune. Une barre qui déborde ne se voit pas en
 * développement, seulement sur le téléphone d’un joueur.
 */
{
  const petit = await nav.newPage();
  petit.on('pageerror', (e) => erreurs.push(e.message));
  await petit.setViewport({ width: 320, height: 640 });
  await petit.goto(base + '/fanzzy', { waitUntil: 'networkidle0' });
  await petit.waitForSelector('#tbf-nav', { timeout: 6000 }).catch(() => {});

  const barre = await petit.evaluate(() => {
    const n = document.getElementById('tbf-nav');
    if (!n) return null;
    const liens = [...n.querySelectorAll('a')];
    return {
      entrees: liens.length,
      debordePage: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      debordeBarre: n.scrollWidth > n.clientWidth,
      rognes: liens.filter((a) => a.scrollWidth > a.clientWidth + 1).map((a) => a.textContent.trim()),
    };
  });

  check('la barre commune porte ses sept entrées', barre?.entrees === 7);
  check('elle tient dans 320 px sans déborder',
    barre?.debordePage === false && barre?.debordeBarre === false);
  check('aucun libellé de la barre n’est rogné', (barre?.rognes ?? []).length === 0);
  if (barre?.rognes?.length) console.log('   rognés :', barre.rognes);
  await petit.close();
}
if (process.env.CAPTURE) {
  // Dossier temporaire du système : « /tmp » en dur ne marche pas sous Windows.
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const pause = (ms) => new Promise((r) => setTimeout(r, ms));

  // On bascule sur le classeur : c'est la grille de cartes qu'on veut voir,
  // pas le kiosque où le test s'arrête.
  await page.evaluate(() => [...document.querySelectorAll('button,[data-tab],[data-onglet]')]
    .find((b) => /CLASSEUR/i.test(b.textContent))?.click());
  await pause(500);
  await page.screenshot({ path: join(tmpdir(), 'classeur.png'), fullPage: true });

  // Et la fiche de détail, l'écran dont les cadres pesaient le plus.
  // La grille ouvre par `data-open`, et seulement pour un Fanzzy possédé :
  // les autres mènent directement à la fiche complète.
  // La grille est `#grid`, et elle n'ouvre l'aperçu que pour un Fanzzy
  // possédé : les autres mènent directement à la fiche complète.
  // Le premier de la grille est un Fanzzy possédé — le classeur les met en
  // tête —, donc il ouvre l'aperçu plutôt que la fiche complète.
  await page.evaluate(() => document.querySelector('#grid [data-open]')?.click());
  await pause(500);
  await page.screenshot({ path: join(tmpdir(), 'classeur-detail.png') });
  console.log(`   captures : ${join(tmpdir(), 'classeur.png')}`);
}

await nav.close();
await new Promise((r) => http.close(r));
await pool.end();

console.log(failures ? `\n${failures} test(s) en échec` : '\ntout est vert');
process.exit(failures ? 1 : 0);
