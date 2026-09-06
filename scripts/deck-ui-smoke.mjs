/**
 * Test de l'écran de construction de deck.
 *
 * Les autres suites vérifient le serveur ; celle-ci vérifie la page, parce
 * qu'un écran qui compile n'est pas un écran qui marche. On monte le vrai
 * serveur sur la vraie base, on charge public/deck.html dans un DOM et on
 * clique dedans comme un joueur le ferait.
 *
 * Ce qu'elle attrape, et que la relecture ne voit pas :
 *   - un compte neuf a deux Fanzzy et le deck en demande trois : l'écran doit
 *     le dire et pointer le kiosque, pas afficher un formulaire impossible ;
 *   - une pièce d'équipement portée à deux rangs, que le serveur refuse et
 *     que la page doit empêcher avant l'envoi ;
 *   - un refus du serveur affiché en « impossible » au lieu de sa cause.
 *
 * jsdom est une dépendance de test seulement : `npm i --no-save jsdom`.
 *
 * Usage : node scripts/deck-ui-smoke.mjs
 */
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import express from 'express';
import { JSDOM, VirtualConsole } from 'jsdom';
import { createDecks } from '../src/server/deck/index.js';
import { createFanzzy } from '../src/server/fanzzy/index.js';
import { ACTIONS } from '../src/shared/duel/actions.js';

const DB = process.env.DATABASE_URL ?? 'mysql://tbf:tbfpass@127.0.0.1:3307/tbf';
const RACINE = new URL('..', import.meta.url).pathname;

let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

/** Attend qu'une condition devienne vraie : le rendu passe par des fetch. */
async function jusqua(fn, ms = 5000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (fn()) return true; await attendre(25); }
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

const U = 'eeeeeeee-0000-0000-0000-000000000001';
await raw.query(`INSERT INTO users (public_id,email,pseudo,password_hash)
                 VALUES (?,?,?,'x')`, [U, 'ui@ex.fr', 'Deckeuse']);
await raw.query(`INSERT INTO user_wallet (user_id,scarves,action_cards) VALUES (?,300,?)`,
  [U, JSON.stringify(['a-silence', 'a-vol', 'a-metronome'])]);

/** Un compte fraîchement sorti du paquet de bienvenue : deux Fanzzy. */
const donnerFanzzy = (id) =>
  raw.query(`INSERT IGNORE INTO user_fanzzy (user_id,fanzzy_id,copies) VALUES (?,?,1)`, [U, id]);
await donnerFanzzy('V1');
await donnerFanzzy('P1');
for (const s of ['jumelles', 'echarpe', 'tambour']) {
  await raw.query(`INSERT INTO user_stuff (user_id,stuff_id,copies) VALUES (?,?,1)`, [U, s]);
}

const pool = mysql.createPool({ uri: DB, connectionLimit: 6, charset: 'utf8mb4' });

/* ----------------------------------------------------------- le serveur */

const requireAuth = (r, _s, n) => { r.user = { id: U }; n(); };
const app = express();
app.use('/api/deck', createDecks({ pool, requireAuth }).router);
app.use('/api/fanzzy', createFanzzy({ pool, requireAuth }).router);
app.get('/deck', (_q, s) => s.sendFile(path.join(RACINE, 'public', 'deck.html')));
// La page charge fx.js et nav.js en differé : on les sert pour rester au plus
// près du vrai chargement.
app.use(express.static(path.join(RACINE, 'public')));

const http = createServer(app);
await new Promise((r) => http.listen(0, r));
const base = `http://localhost:${http.address().port}`;

/* -------------------------------------------------------------- la page */

/**
 * Charge /deck dans un DOM. jsdom n'a pas de fetch : on lui passe celui de
 * Node, en résolvant les chemins relatifs comme le ferait le navigateur.
 */
async function ouvrirPage() {
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => {
    // Une erreur de script dans la page est une faute, pas un détail.
    console.log(` FAIL  erreur de script dans la page : ${e.message}`);
    failures++;
  });

  const html = readFileSync(path.join(RACINE, 'public', 'deck.html'), 'utf8');
  // `beforeParse` et non après construction : le script de la page appelle
  // charger() dès son exécution, donc fetch doit exister avant l'analyse.
  // Injecté après, la page échouait silencieusement et le test mesurait le
  // mauvais objet.
  return new JSDOM(html, {
    url: base + '/deck',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(window) {
      window.fetch = (u, o) => fetch(new URL(u, base), o);
    },
  });
}

const T = (dom) => dom.window.document;

/**
 * Le texte réellement affiché.
 *
 * `body.textContent` inclut le contenu des balises <script> : toutes les
 * vérifications de texte trouvaient alors leurs chaînes dans le code source
 * de la page, et passaient même quand rien n'était affiché. Ce test a
 * commencé par se tromper exactement là.
 */
function texte(dom) {
  const corps = T(dom).body.cloneNode(true);
  for (const s of corps.querySelectorAll('script,style')) s.remove();
  return corps.textContent.replace(/\s+/g, ' ');
}
const clic = (el) => el.dispatchEvent(new el.ownerDocument.defaultView
  .MouseEvent('click', { bubbles: true }));

/* ============================ 1. compte neuf, deux Fanzzy ============= */

let dom = await ouvrirPage();
await jusqua(() => T(dom).getElementById('corps').querySelector('.tabs'));

check('la page se charge sans erreur de script',
  T(dom).getElementById('corps').querySelector('.tabs') !== null);
check('deux Fanzzy possédés : l\u2019écran le dit au lieu de bloquer',
  /IL TE MANQUE DES FANZZY/.test(texte(dom)));
check('le manque est chiffré, pas vague',
  /demande 3 Fanzzy et tu en as 2/.test(texte(dom)));
check('il indique où en trouver',
  T(dom).querySelector('.avert a[href="/fanzzy"]') !== null);
check('le deck est annoncé incomplet',
  T(dom).getElementById('etat').textContent === 'INCOMPLET');
check('l\u2019enregistrement est fermé tant qu\u2019il manque quelque chose',
  T(dom).getElementById('save').disabled === true);
check('la barre du bas nomme ce qui manque',
  /Fanzzy à choisir/.test(T(dom).getElementById('info').textContent)
  && /cartes à ajouter/.test(T(dom).getElementById('info').textContent));

/* ------------------------- le premier rang est le titulaire ----------- */

const rangs = T(dom).querySelectorAll('.rang');
check('trois emplacements de tribune', rangs.length === 3);
check('le premier annonce qu\u2019il entre au coup d\u2019envoi',
  /coup d\u2019envoi/.test(rangs[0].textContent));

/* -------------------- choisir un Fanzzy dans le panneau --------------- */

clic(rangs[0].querySelector('[data-choisir-fanzzy]'));
await jusqua(() => T(dom).getElementById('voile').classList.contains('on'));
check('le panneau de choix s\u2019ouvre',
  T(dom).getElementById('voile').classList.contains('on'));
check('il ne propose que les Fanzzy possédés',
  T(dom).querySelectorAll('#panneau .choix').length === 2);

clic(T(dom).querySelector('[data-prendre-fanzzy]'));
await jusqua(() => T(dom).querySelectorAll('.rang.vide').length === 2);
check('le Fanzzy choisi occupe le premier rang',
  T(dom).querySelectorAll('.rang.vide').length === 2);
check('il est marqué titulaire',
  T(dom).querySelector('.rang .marque')?.textContent === 'TITULAIRE');

/* -------------------- une pièce ne se porte qu'à un seul rang ---------- */

clic(rangs[0].querySelector('[data-piece]') ?? T(dom).querySelector('[data-piece]'));
await jusqua(() => T(dom).getElementById('voile').classList.contains('on'));
clic(T(dom).querySelector('[data-prendre-piece]'));
await jusqua(() => T(dom).querySelector('.piece.plein'));
check('l\u2019équipement se pose sur le Fanzzy', T(dom).querySelector('.piece.plein') !== null);
check('l\u2019effet combiné est affiché', /Effet ·/.test(texte(dom)));

// deuxième rang, puis on tente d'y remettre la même pièce
clic(T(dom).querySelectorAll('.rang.vide')[0].querySelector('[data-choisir-fanzzy]'));
await jusqua(() => T(dom).getElementById('voile').classList.contains('on'));
clic([...T(dom).querySelectorAll('#panneau .choix')].find((c) => c.dataset.prendreFanzzy));
await jusqua(() => T(dom).querySelectorAll('.rang.vide').length === 1);

const pieces2 = T(dom).querySelectorAll('.rang')[1].querySelectorAll('[data-piece]');
clic(pieces2[0]);
await jusqua(() => T(dom).getElementById('voile').classList.contains('on'));
const dejaPortee = [...T(dom).querySelectorAll('#panneau .choix')]
  .find((c) => /AUTRE RANG/.test(c.textContent));
check('la pièce déjà portée ailleurs est signalée', Boolean(dejaPortee));
check('et elle n\u2019est pas cliquable',
  dejaPortee && !dejaPortee.dataset.prendrePiece);
clic(T(dom).querySelector('[data-fermer]'));

/* ============================ 2. compte complet ======================= */

await donnerFanzzy('F1');
dom.window.close();
dom = await ouvrirPage();
await jusqua(() => T(dom).getElementById('corps').querySelector('.tabs'));
check('avec trois Fanzzy, l\u2019avertissement disparaît',
  !/IL TE MANQUE DES FANZZY/.test(texte(dom)));

// on remplit les trois rangs
for (let i = 0; i < 3; i++) {
  const libre = T(dom).querySelector('.rang.vide [data-choisir-fanzzy]');
  if (!libre) break;
  clic(libre);
  await jusqua(() => T(dom).querySelector('[data-prendre-fanzzy]'));
  clic(T(dom).querySelector('[data-prendre-fanzzy]'));
  await attendre(40);
}
check('les trois rangs sont pourvus', T(dom).querySelectorAll('.rang.vide').length === 0);
check('sans arbitre, l\u2019écran prévient que les remplaçants ne joueront pas',
  /TES REMPLAÇANTS NE JOUERONT PAS/.test(texte(dom)));

/* -------------------------------- les dix cartes ---------------------- */

clic(T(dom).querySelector('[data-onglet="cartes"]'));
await jusqua(() => T(dom).querySelector('.grille'));
check('dix emplacements de cartes', T(dom).querySelectorAll('.emp').length === 10);

const communes = ACTIONS.filter((a) => a.rar === 'd1').map((a) => a.id);
async function ajouter(id) {
  const carte = T(dom).querySelector(`[data-detail="${id}"]`);
  if (!carte) return false;
  clic(carte);
  await jusqua(() => T(dom).getElementById('voile').classList.contains('on'));
  const bouton = T(dom).querySelector('[data-ajouter]');
  if (!bouton) { clic(T(dom).querySelector('[data-fermer]')); return false; }
  clic(bouton);
  await attendre(40);
  return true;
}

// deux exemplaires de chaque commune jusqu'à dix
let pose = 0;
for (const id of communes) {
  for (let k = 0; k < 2 && pose < 10; k++) if (await ajouter(id)) pose++;
}
check('dix cartes posées', T(dom).querySelectorAll('.emp.plein').length === 10);

const troisieme = await ajouter(communes[0]);
check('un troisième exemplaire est refusé par l\u2019écran', troisieme === false);
check('le refus est expliqué', /c\u2019est le maximum|emplacements sont pris/.test(texte(dom)));
clic(T(dom).querySelector('[data-fermer]'));

check('le deck est annoncé prêt', T(dom).getElementById('etat').textContent === 'PRÊT');
check('l\u2019enregistrement est ouvert', T(dom).getElementById('save').disabled === false);

/* -------------------------------- enregistrement ---------------------- */

clic(T(dom).getElementById('save'));
await jusqua(() => T(dom).getElementById('toast').classList.contains('on'), 6000);
check('le deck est enregistré', /enregistré|Arbitre/.test(T(dom).getElementById('toast').textContent));

const [enBase] = await pool.query(
  `SELECT contenu FROM user_decks WHERE user_id = ? AND actif = 1`, [U]);
const stocke = typeof enBase[0]?.contenu === 'string'
  ? JSON.parse(enBase[0].contenu) : enBase[0]?.contenu;
check('la base contient bien trois Fanzzy', stocke?.fanzzy?.length === 3);
check('la base contient bien dix cartes', stocke?.actions?.length === 10);
check('le bouton se referme après enregistrement',
  T(dom).getElementById('save').disabled === true);

/* ================== 3. un refus du serveur nomme sa cause ============= */

// On retire un Fanzzy de la collection dans le dos de la page : au prochain
// envoi, le serveur refusera. C'est exactement le cas qui produisait autrefois
// un « impossible » sans cause.
await pool.query(`DELETE FROM user_fanzzy WHERE user_id = ? AND fanzzy_id = 'F1'`, [U]);
clic(T(dom).querySelector('[data-onglet="tribune"]'));
await jusqua(() => T(dom).querySelector('.rang'));
const nom = T(dom).getElementById('nom');
nom.value = 'Deck refusé';
nom.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
clic(T(dom).getElementById('save'));

const affiche = await jusqua(() =>
  /LE SERVEUR A REFUSÉ CE DECK/.test(texte(dom))
  || /Tu ne possèdes pas/.test(T(dom).getElementById('toast').textContent), 6000);
check('un refus du serveur est affiché', affiche);
check('et il nomme la cause, pas « impossible »',
  /Tu ne possèdes pas ce Fanzzy/.test(texte(dom)));
check('le nom du Fanzzy fautif est donné',
  /Abonné|F1/.test(texte(dom)));

/* ---------------------------------------------------------------- fin */

dom.window.close();
await new Promise((r) => http.close(r));
await pool.end();
await raw.end();

console.log(failures ? `\n${failures} test(s) en échec` : '\ntout est vert');
process.exit(failures ? 1 : 0);
