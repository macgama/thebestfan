/**
 * Test de la page /amis, dans un vrai navigateur.
 *
 * `amis-smoke` éprouve déjà les règles côté serveur. Ce qui se joue **ici et
 * nulle part ailleurs** :
 *
 *   - qu'une demande reçue **se voie sans qu'on la cherche**. Elle dort
 *     derrière un onglet fermé : sans pastille, on n'y répond jamais ;
 *   - qu'un refus du serveur soit dit **en français, avec sa cause**. « Erreur »
 *     ne laisse rien faire ; « il ne suit pas ce club » dit exactement quoi ;
 *   - qu'un geste referme la boucle — la liste doit montrer l'état du serveur
 *     après le clic, pas celui qu'on espérait avant ;
 *   - que les trois vues aient chacune leur écran vide, qui dit où aller.
 *
 * Avant de lancer :  npm install --no-save puppeteer
 */
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import puppeteer from 'puppeteer';
import { createAmis } from '../src/server/amis/index.js';
import { createKop } from '../src/server/kop/index.js';
import { charger as chargerCatalogue } from '../src/server/fanzzy/catalogue.js';
import { baseDeTest, OPTIONS_BASE } from './base-de-test.mjs';

const DB = baseDeTest();
const RACINE = fileURLToPath(new URL('..', import.meta.url));

let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };
const dodo = (ms) => new Promise((r) => setTimeout(r, ms));
async function jusqua(fn, ms = 6000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await fn()) return true; await dodo(70); }
  return false;
}

/* ------------------------------------------------------------- la base */

const mysql = await import('mysql2/promise');
const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
await raw.query(`DROP TABLE IF EXISTS achats, kop_invites, amities, kop_bulletins, kop_votes,
  kop_bonus, kop_membres, kops, user_decks, user_stuff, user_skins, user_fanzzy,
  user_souvenirs, virage_presence, souvenirs, user_wallet, api_cache, souvenir_leagues,
  duel_results, duel_events, duels, user_follows, fixture_events, standings, fixtures,
  team_leagues, teams, leagues, api_quota, login_attempts, auth_tokens, sessions, users`);
for (const f of ['auth.sql', 'football.sql', 'minutes.sql', 'couleurs.sql', 'souvenirs.sql',
                 'fanzzy.sql', 'inventaire.sql', 'skins.sql', 'stades.sql',
                 'kop.sql', 'amis.sql']) {
  await raw.query(readFileSync(path.join(RACINE, 'sql', f), 'utf8'));
}

const [MOI, ELLE, LUI] = ['1', '2', '3'].map((i) => `aaaaaaaa-1111-0000-0000-00000000000${i}`);
const NOMS = { [MOI]: 'Momo', [ELLE]: 'Sarah', [LUI]: 'Tarek' };
for (const [id, nom] of Object.entries(NOMS)) {
  await raw.query(`INSERT INTO users (public_id,email,pseudo,password_hash) VALUES (?,?,?,'x')`,
    [id, `${nom.toLowerCase()}@ex.fr`, nom]);
  // `active_fanzzy` : la page montre le personnage de chacun à la place d'une
  // initiale. C'est ce qui fait qu'on se reconnaît avant de lire un pseudo.
  await raw.query(`INSERT INTO user_wallet (user_id,scarves,active_fanzzy) VALUES (?,60,'V1')`,
    [id]);
}
/* Sarah a fait évoluer son Choriste. La page doit montrer le Meneur de chant :
   c'est le personnage qu'elle joue, et celui auquel on la reconnaîtra. */
await raw.query(`INSERT INTO user_fanzzy (user_id,fanzzy_id,copies,stage) VALUES (?,'V1',1,2)`,
  [ELLE]);
await raw.query(`INSERT INTO teams (id,name) VALUES (85,'Sion'),(91,'Bâle'),(99,'Lugano')`);
/* Sarah partage deux clubs avec moi, Tarek un seul, et Tarek suit en plus
   Lugano — que je ne suis pas. La page ne doit jamais l'apprendre : on montre
   les clubs **communs**, pas la vie de quelqu'un. */
await raw.query(`INSERT INTO user_follows (user_id,team_id,is_main) VALUES
  (?,85,1),(?,91,0),(?,85,1),(?,91,0),(?,85,1),(?,99,0)`,
[MOI, MOI, ELLE, ELLE, LUI, LUI]);
await raw.end();

/* ----------------------------------------------------------- le serveur */

const pool = mysql.createPool({ uri: DB, connectionLimit: 6, ...OPTIONS_BASE });
// Sans catalogue, on ne sait pas que le second âge du Choriste s'appelle V2.
await chargerCatalogue(pool);
let moi = MOI;
const requireAuth = (r, _s, n) => { r.user = { id: moi }; n(); };
const kop = createKop({ pool, requireAuth });
const amis = createAmis({ pool, requireAuth, kop });

const app = express();
app.use('/api/amis', amis.router);
app.use('/api/kop', kop.router);
app.get('/api/auth/me', (_q, s) => s.json({ user: { pseudo: NOMS[moi] } }));
app.get('/amis', (_q, s) => s.sendFile(path.join(RACINE, 'public', 'amis.html')));
app.use(express.static(path.join(RACINE, 'public')));

const http = createServer(app);
await new Promise((r) => http.listen(0, r));
const base = `http://localhost:${http.address().port}`;

const nav = await puppeteer.launch({ args: ['--no-sandbox'] });
const erreurs = [];
async function ouvrir() {
  const page = await nav.newPage();
  page.on('pageerror', (e) => erreurs.push(e.message));
  await page.setViewport({ width: 400, height: 900 });
  await page.goto(base + '/amis', { waitUntil: 'networkidle0' });
  await jusqua(async () => !/Chargement/.test(await texte(page)));
  return page;
}
const texte = (p) => p.evaluate(() =>
  document.getElementById('corps').textContent.replace(/\s+/g, ' ').trim());
const onglet = async (p, vue) => {
  await p.evaluate((v) => document.querySelector(`[data-vue="${v}"]`).click(), vue);
  await dodo(180);
};
/** Le dernier message passé, quel qu'il soit. */
const dernierToast = (p) => p.evaluate(() => document.getElementById('toast').textContent.trim());

/* ------------------------------------------------------- les vues vides */

const page = await ouvrir();
check('la page se charge sans erreur de script', erreurs.length === 0);
if (erreurs.length) console.log('   ', erreurs.slice(0, 3));

{
  /* Un écran vide qui ne dit rien est un cul-de-sac : c'est le premier écran
     que voit tout joueur, puisque personne n'a d'amis au départ. */
  const vide = await texte(page);
  check('sans ami, l’écran dit où en trouver', /TROUVER/.test(vide));

  await onglet(page, 'demandes');
  check('sans demande, il le dit aussi', /Rien n’attend/.test(await texte(page)));
}

/* ------------------------------------------------------------- trouver */

{
  await onglet(page, 'trouver');
  const t = await texte(page);
  check('on trouve les supporters des mêmes clubs',
    /Sarah/.test(t) && /Tarek/.test(t));
  check('avec les clubs qu’on partage', /Sion/.test(t) && /Bâle/.test(t));
  /* Tarek suit Lugano, moi non. Ce club n'a rien à faire ici : la nuance
     sépare « on se croise au stade » de « je sais où tu vas le week-end ». */
  check('et seulement ceux-là', !/Lugano/.test(t));

  const ordre = await page.evaluate(() =>
    [...document.querySelectorAll('#corps .gars .qui b')].map((n) => n.textContent.trim()));
  check('celle avec qui on partage le plus est en tête', ordre[0] === 'Sarah');

  /* Le personnage plutôt que l'initiale : on se reconnaît à son Fanzzy. */
  const avatars = await page.evaluate(() => [...document.querySelectorAll('#corps .gars')]
    .map((n) => ({ nom: n.querySelector('b').textContent.trim(),
                   src: n.querySelector('.pastille-nom img')?.getAttribute('src') ?? '' })));
  check('chacun est montré par son Fanzzy',
    avatars.length >= 2 && avatars.every((a) => a.src));
  /* Et **à l'âge atteint**. Sarah joue le Meneur de chant ; montrer le
     Choriste ressemblerait à un personnage parfaitement valide, et personne
     ne verrait jamais l'erreur. */
  check('et à l’âge qu’il a atteint',
    /V2/.test(avatars.find((a) => a.nom === 'Sarah')?.src ?? '')
    || (console.log('        elle montre :',
      avatars.find((a) => a.nom === 'Sarah')?.src), false));

  await page.evaluate(() => document.querySelector('[data-demander]').click());
  await jusqua(async () => /envoyée/i.test(await dernierToast(page)));
  check('ajouter quelqu’un le dit', /envoyée/i.test(await dernierToast(page)));
  check('et il quitte aussitôt les suggestions',
    !/Sarah/.test(await texte(page))
    || (console.log('        elle y est encore'), false));

  await onglet(page, 'demandes');
  check('la demande envoyée apparaît en attente',
    /TU AS DEMANDÉ/.test(await texte(page)));
}

/* -------------------------------------------- la demande reçue se voit

 * Elle dort derrière un onglet fermé. Sans la pastille, on n'y répond jamais —
 * et une demande sans réponse est un joueur qui croit que le jeu est vide.
 */
{
  moi = ELLE;                                  // on regarde depuis l'autre côté
  const chezElle = await ouvrir();
  const pastille = await chezElle.evaluate(() =>
    document.querySelector('[data-vue="demandes"] .pastille')?.textContent.trim() ?? '');
  check('une demande reçue se signale sans qu’on ouvre l’onglet', pastille === '1');

  await onglet(chezElle, 'demandes');
  check('et on y lit qui demande', /Momo/.test(await texte(chezElle)));

  await chezElle.evaluate(() => document.querySelector('[data-oui]').click());
  await jusqua(async () => /amis/i.test(await dernierToast(chezElle)));
  await onglet(chezElle, 'amis');
  check('accepter le fait entrer dans les amis', /Momo/.test(await texte(chezElle)));
  check('et la pastille s’éteint',
    await chezElle.evaluate(() =>
      !document.querySelector('[data-vue="demandes"] .pastille')));
  await chezElle.close();
}

/* --------------------------------------------------------- le KOP à deux */

{
  moi = MOI;
  const leKop = await kop.creer(MOI, 85, 'Le Virage Nord');
  const p = await ouvrir();

  check('un ami peut être emmené dans un KOP',
    await p.evaluate(() => Boolean(document.querySelector('[data-kop]'))));
  await p.evaluate(() => document.querySelector('[data-kop]').click());
  await dodo(150);
  check('le choix du KOP se déplie sous lui',
    /Le Virage Nord/.test(await texte(p)));

  await p.evaluate(() => document.querySelector('[data-inviter]').click());
  await jusqua(async () => /Invitation/i.test(await dernierToast(p)));
  check('l’invitation part et le dit', /Invitation/i.test(await dernierToast(p)));

  moi = ELLE;
  const chezElle = await ouvrir();
  const pastille = await chezElle.evaluate(() =>
    document.querySelector('[data-vue="demandes"] .pastille')?.textContent.trim() ?? '');
  check('l’invitation compte dans ce qui attend une réponse', pastille === '1');
  await onglet(chezElle, 'demandes');
  const t = await texte(chezElle);
  check('elle dit quel KOP, qui invite, et ce que pèse le groupe',
    /Le Virage Nord/.test(t) && /Momo/.test(t) && /membre/.test(t)
    || (console.log('        elle dit :', t.slice(0, 120)), false));

  await chezElle.evaluate(() => document.querySelector('[data-kopoui]').click());
  await jusqua(async () => /KOP/i.test(await dernierToast(chezElle)));
  const membres = await pool.query(
    `SELECT user_id FROM kop_membres WHERE kop_id = ?`, [leKop.id]);
  check('rejoindre depuis l’invitation fait bien entrer',
    membres[0].some((m) => m.user_id === ELLE));
  check('et l’invitation disparaît de l’écran',
    /Rien n’attend/.test(await texte(chezElle)));
  await chezElle.close();
  await p.close();
}

/* ------------------------------------------- un refus dit sa cause

 * Tarek ne suit pas Bâle. L'inviter dans un KOP de Bâle ne peut pas marcher —
 * et le joueur doit lire *pourquoi*, sinon il réessaie. « Le serveur a
 * refusé » ne laisse rien faire.
 */
{
  moi = MOI;
  await kop.creer(MOI, 91, 'Les Rhénans');
  await amis.demander(MOI, LUI);
  await amis.repondre(LUI, MOI, true);

  const p = await ouvrir();
  await p.evaluate(() => {
    const gars = [...document.querySelectorAll('#corps .gars')]
      .find((n) => /Tarek/.test(n.textContent));
    gars.querySelector('[data-kop]').click();
  });
  await dodo(150);
  await p.evaluate(() => {
    const bas = [...document.querySelectorAll('[data-inviter]')]
      .find((b) => /Rhénans/.test(b.textContent));
    bas.click();
  });
  await jusqua(async () => /suit/.test(await dernierToast(p)));
  const message = await dernierToast(p);
  check('un refus est dit en français, avec sa cause',
    /ne suit pas le club/.test(message)
    || (console.log('        il dit :', message), false));
  check('et jamais sous forme de code',
    !/amis\.error|kop\.error/.test(message));
  await p.close();
}

check('aucune erreur de script sur la page des amis',
  erreurs.length === 0 || (console.log('    ', erreurs.join(' / ')), false));

console.log(`\n${failures ? `${failures} échec(s)` : 'tout est vert'}`);
await nav.close(); http.close(); await pool.end();
process.exit(failures ? 1 : 0);
