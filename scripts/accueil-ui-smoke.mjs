/**
 * Test de l'accueil : la scène du Fanzzy équipé.
 *
 * Ce qu'on veut vérifier ne se lit pas dans le HTML — c'est du mouvement. Le
 * Fanzzy doit *respirer*, et la respiration vient d'une animation CSS posée par
 * fx.js sur les éléments qu'il reconnaît. On mesure donc le style calculé dans
 * un vrai navigateur : c'est le seul endroit où « ça bouge » est vérifiable.
 *
 * Deux cas, et le second est le plus fréquent :
 *   — un Fanzzy illustré (trois sur vingt-neuf) : une image en pied ;
 *   — un Fanzzy sans illustration (les vingt-six autres) : une silhouette
 *     procédurale, qui n'est pas un `.illu` et qu'il a donc fallu signaler
 *     explicitement à fx.js. C'est exactement le genre de détail qu'on croit
 *     évident et qu'on oublie.
 *
 * Avant de lancer :  npm install --no-save puppeteer
 */
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import express from 'express';
import puppeteer from 'puppeteer';
import { createFanzzy } from '../src/server/fanzzy/index.js';
import { createOnboarding } from '../src/server/onboarding/index.js';
import { charger as chargerCatalogue } from '../src/server/fanzzy/catalogue.js';

const DB = process.env.DATABASE_URL ?? 'mysql://tbf:tbfpass@127.0.0.1:3307/tbf';
const RACINE = fileURLToPath(new URL('..', import.meta.url));

let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };

/* ------------------------------------------------------------- la base */

const mysql = await import('mysql2/promise');
const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
await raw.query(`DROP TABLE IF EXISTS user_decks, user_stuff, user_skins, user_fanzzy,
  user_souvenirs, virage_presence, souvenirs, user_wallet, api_cache, souvenir_leagues,
  duel_results, duel_events, duels, user_follows, fixture_events, standings, fixtures,
  team_leagues, teams, leagues, api_quota, login_attempts, auth_tokens, sessions, users`);
for (const f of ['auth.sql', 'football.sql', 'souvenirs.sql', 'fanzzy.sql', 'inventaire.sql']) {
  await raw.query(readFileSync(path.join(RACINE, 'sql', f), 'utf8'));
}

const U = 'aaaaaaaa-0000-0000-0000-0000000000a1';
await raw.query(`INSERT INTO users (public_id,email,pseudo,password_hash)
                 VALUES (?,?,?,'x')`, [U, 'accueil@ex.fr', 'Momo']);
// `onboarded_at` renseigné : sans lui l'accueil renvoie vers /bienvenue et la
// scène n'est jamais rendue.
await raw.query(`INSERT INTO user_wallet (user_id,scarves,packs,onboarded_at)
                 VALUES (?,90,12,NOW(3))`, [U]);
for (const id of ['G1', 'V1']) {
  await raw.query(`INSERT INTO user_fanzzy (user_id,fanzzy_id,copies) VALUES (?,?,1)`, [U, id]);
}
await raw.end();

const pool = mysql.createPool({ uri: DB, connectionLimit: 6, charset: 'utf8mb4' });
// Le catalogue vit en base depuis qu il se gère par l administration :
// on le charge comme le fait server.js, sinon les modules travaillent
// sur un catalogue vide.
await chargerCatalogue(pool);
const equiper = (id) =>
  pool.execute(`UPDATE user_wallet SET active_fanzzy = ? WHERE user_id = ?`, [id, U]);

/* ----------------------------------------------------------- le serveur */

const requireAuth = (r, _s, n) => { r.user = { id: U }; n(); };
const app = express();
// L'accueil interroge /api/auth/me pour savoir s'il montre la vitrine ou le hub.
app.get('/api/auth/me', (_q, s) => s.json({ user: { pseudo: 'Momo' } }));
app.use('/api/fanzzy', createFanzzy({ pool, requireAuth }).router);
app.use('/api/me', createOnboarding({ pool, requireAuth }).router);
app.get('/', (_q, s) => s.sendFile(path.join(RACINE, 'public', 'index.html')));
app.use(express.static(path.join(RACINE, 'public')));

const http = createServer(app);
await new Promise((r) => http.listen(0, r));
const base = `http://localhost:${http.address().port}`;

/* -------------------------------------------------------------- la page */

const nav = await puppeteer.launch({ args: ['--no-sandbox'] });
const erreurs = [];

async function ouvrir() {
  const page = await nav.newPage();
  page.on('pageerror', (e) => erreurs.push(e.message));
  await page.setViewport({ width: 400, height: 880 });
  await page.goto(base + '/', { waitUntil: 'networkidle0' });
  await page.waitForSelector('#scene.on', { timeout: 8000 }).catch(() => {});
  return page;
}

/** Ce que fx.js a réellement posé sur le personnage. */
const vie = (page) => page.evaluate(() => {
  const el = document.querySelector('#sceneArt .illu, #sceneArt [data-vivant]');
  if (!el) return null;
  const s = getComputedStyle(el);
  return {
    balise: el.tagName.toLowerCase(),
    vivant: el.classList.contains('fz-vivant'),
    animation: s.animationName,
    duree: s.animationDuration,
    src: el.getAttribute('src'),
  };
});

/* ------------------------------------- un Fanzzy illustré : image en pied */

await equiper('G1');
let page = await ouvrir();

check('la scène s’affiche', await page.$('#scene.on') !== null);
check('elle nomme le Fanzzy équipé',
  (await page.$eval('#sceneNom', (e) => e.textContent)) === 'Le Gamin de Devant');
check('et elle annonce son cri',
  /CRIS DE GOSSE/.test(await page.$eval('#sceneCri', (e) => e.textContent)));
check('elle mène à la fiche du Fanzzy',
  (await page.$eval('#scene', (e) => new URL(e.href).pathname)) === '/fanzzy/G1');

let v = await vie(page);
check('le personnage est une illustration', v?.balise === 'img');
check('en pied, pas le buste du classeur', Boolean(v?.src && !v.src.includes('-buste')));
check('il respire', v?.vivant === true && /fzsouffle/.test(v?.animation ?? ''));
check('et il se balance', /fzbalance/.test(v?.animation ?? ''));
check('la respiration a une durée propre au Fanzzy', /[\d.]+s/.test(v?.duree ?? ''));

// Le débordement horizontal est le défaut classique d'un personnage en grand.
check('la page ne déborde pas en largeur', await page.evaluate(() =>
  document.documentElement.scrollWidth <= document.documentElement.clientWidth));

// La barre commune ne doit pas manger la scène : l'accueil n'est pas un écran
// de jeu, elle réserve donc sa hauteur entière.
check('la barre de navigation ne recouvre pas le nom du Fanzzy', await page.evaluate(() => {
  const n = document.getElementById('tbf-nav');
  const t = document.getElementById('sceneNom');
  if (!n || !t) return true;
  return t.getBoundingClientRect().bottom <= n.getBoundingClientRect().top;
}));

await page.close();

/* ----------------------- un Fanzzy sans illustration : silhouette dessinée */

await equiper('V1');
page = await ouvrir();

check('sans illustration, la scène s’affiche quand même', await page.$('#scene.on') !== null);
check('elle nomme le bon Fanzzy',
  (await page.$eval('#sceneNom', (e) => e.textContent)) === 'Choriste');

v = await vie(page);
check('le personnage est la silhouette procédurale', v?.balise === 'svg');
check('elle respire elle aussi', v?.vivant === true && /fzsouffle/.test(v?.animation ?? ''));

await page.close();

/* --------------------------------------- aucun Fanzzy équipé : pas de scène */

await pool.execute(`UPDATE user_wallet SET active_fanzzy = NULL WHERE user_id = ?`, [U]);
page = await ouvrir();
check('sans Fanzzy équipé, la scène reste masquée et l’accueil tient debout',
  await page.$('#scene.on') === null && await page.$('#grid') !== null);
await page.close();

/* ------------------------------- la barre commune sur un petit téléphone */

/**
 * La barre porte sept entrées depuis que le duel y figure. Sur un écran de
 * 320 px — un iPhone SE — chacune dispose de quarante-cinq pixels. On vérifie
 * que rien ne déborde et qu'aucun libellé n'est rogné : une barre qui déborde
 * ne se voit pas en développement, seulement sur le téléphone d'un joueur.
 */
{
  await equiper('G1');
  const page = await nav.newPage();
  await page.setViewport({ width: 320, height: 700 });
  await page.goto(base + '/', { waitUntil: 'networkidle0' });
  await page.waitForSelector('#tbf-nav', { timeout: 5000 }).catch(() => {});

  const barre = await page.evaluate(() => {
    const n = document.getElementById('tbf-nav');
    if (!n) return null;
    const liens = [...n.querySelectorAll('a')];
    return {
      entrees: liens.length,
      debordePage: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      debordeBarre: n.scrollWidth > n.clientWidth,
      // Un libellé rogné a une largeur de rendu supérieure à sa case.
      rognes: liens.filter((a) => a.scrollWidth > a.clientWidth + 1).map((a) => a.textContent.trim()),
    };
  });

  check('la barre porte bien sept entrées', barre?.entrees === 7);
  check('elle tient dans 320 px sans déborder',
    barre?.debordePage === false && barre?.debordeBarre === false);
  check('aucun libellé n’est rogné', (barre?.rognes ?? []).length === 0);
  if (barre?.rognes?.length) console.log('   rognés :', barre.rognes);

  if (process.env.CAPTURE) {
    await page.screenshot({ path: path.join(tmpdir(), 'accueil-320.png'), fullPage: false });
  }
  await page.close();
}

check('aucune erreur de script sur l’accueil', erreurs.length === 0);
if (erreurs.length) console.log('   ', erreurs.slice(0, 3));

/* ---------------------------------------------------------------- fin */

if (process.env.CAPTURE) {
  // Le dernier cas testé laisse le joueur sans Fanzzy équipé : sans ce
  // rééquipement, la capture montrerait un accueil sans scène — c'est-à-dire
  // exactement ce qu'on ne cherche pas à regarder.
  // Dans le dossier temporaire du système, pas dans le dépôt : une capture
  // n'a rien à faire dans un commit, et `/tmp` en dur ne marche pas sous
  // Windows — c'est déjà ce qui empêchait les autres suites d'y tourner.
  for (const [id, nom] of [['G1', 'illustre'], ['V1', 'procedural']]) {
    await equiper(id);
    const p = await ouvrir();
    const f = path.join(tmpdir(), `accueil-${nom}.png`);
    await p.screenshot({ path: f, fullPage: true });
    console.log(`   capture : ${f}`);
    await p.close();
  }
}
await nav.close();
http.close();
await pool.end();

console.log(`\n${failures ? `${failures} échec(s)` : 'tout est vert'}`);
process.exit(failures ? 1 : 0);
