/**
 * Test de l'écran de duel N contre N.
 *
 * Deux navigateurs, un vrai serveur, une vraie base. On construit un deck pour
 * chacun, on entre en file, le serveur apparie, et on joue : un chant noté, une
 * carte, un but. C'est le seul moyen de vérifier ce qui compte vraiment ici —
 * que l'écran affiche le geste tel que le serveur le note, et qu'une erreur
 * du serveur arrive au joueur avec sa cause.
 *
 * Usage : node scripts/nvn-ui-smoke.mjs
 */
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';
import puppeteer from 'puppeteer';
import { createDecks } from '../src/server/deck/index.js';
import { createNvN } from '../src/server/nvn/index.js';
import { GESTURES, resoudreGeste } from '../src/server/ferveur/gestures.js';
import { ACTIONS } from '../src/shared/duel/actions.js';
import { charger as chargerCatalogue } from '../src/server/fanzzy/catalogue.js';
import { baseDeTest } from './base-de-test.mjs';

const DB = baseDeTest();
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
await raw.query(`DROP TABLE IF EXISTS kop_bulletins, kop_votes, kop_bonus, kop_membres, kops, user_decks, user_stuff, user_skins, user_fanzzy,
  user_souvenirs, virage_presence, souvenirs, user_wallet, api_cache, souvenir_leagues,
  duel_results, duel_events, duels, user_follows, fixture_events, standings, fixtures,
  team_leagues, teams, leagues, api_quota, login_attempts, auth_tokens, sessions, users`);
for (const f of ['auth.sql', 'football.sql', 'souvenirs.sql', 'fanzzy.sql',
                 'inventaire.sql', 'skins.sql', 'deck.sql']) {
  await raw.query(readFileSync(path.join(RACINE, 'sql', f), 'utf8'));
}

const U = ['11111111-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000002'];
const communes = ACTIONS.filter((a) => a.rar === 'commune').map((a) => a.id);
const dix = [...communes, ...communes].slice(0, 10);

for (const [i, id] of U.entries()) {
  await raw.query(`INSERT INTO users (public_id,email,pseudo,password_hash)
                   VALUES (?,?,?,'x')`, [id, `duel${i}@ex.fr`, i ? 'Bâloise' : 'Sédunois']);
  await raw.query(`INSERT INTO user_wallet (user_id,scarves,action_cards) VALUES (?,300,?)`,
    [id, JSON.stringify(['a-silence'])]);
  for (const f of ['V1', 'P1', 'F1']) {
    await raw.query(`INSERT INTO user_fanzzy (user_id,fanzzy_id,copies) VALUES (?,?,1)`, [id, f]);
  }
  // Un joueur équipé de Jumelles : c'est lui qui révèle un barème de geste
  // affiché différemment de celui qui est noté.
  if (i === 0) {
    await raw.query(`INSERT INTO user_stuff (user_id,stuff_id,copies) VALUES (?,'jumelles',1)`, [id]);
  }
  await raw.query(`INSERT INTO user_decks (user_id,nom,contenu,actif) VALUES (?,?,?,1)`,
    [id, 'Test', JSON.stringify({
      nom: 'Test',
      fanzzy: [{ id: 'V1', stuff: i === 0 ? ['jumelles'] : [] }, { id: 'P1', stuff: [] },
               { id: 'F1', stuff: [] }],
      actions: dix })]);
}

await raw.query(`INSERT INTO teams (id,name) VALUES (85,'Sion'),(91,'Bâle'),(60,'Lugano'),(61,'Coire')`);
await raw.query(`INSERT INTO leagues (id,name) VALUES (207,'Super League')`);
// Deux matchs : celui du club suivi, et celui de deux clubs que personne ne
// suit. Le second n'apparaît que sous « tous les matchs », et sans le badge
// ×2 — c’est exactement ce qui distingue les deux portées.
await raw.query(`INSERT INTO fixtures (id,league_id,season,home_id,away_id,status_short,kickoff_at)
  VALUES (7,207,2026,85,91,'1H', UTC_TIMESTAMP() - INTERVAL 20 MINUTE),
         (8,207,2026,60,61,'NS', UTC_TIMESTAMP() + INTERVAL 2 DAY)`);
for (const id of U) {
  await raw.query(`INSERT INTO user_follows (user_id,team_id,is_main) VALUES (?,85,1)`, [id]);
}
await raw.end();

/* ----------------------------------------------------------- le serveur */

const pool = mysql.createPool({ uri: DB, connectionLimit: 8, charset: 'utf8mb4' });
// Le catalogue vit en base depuis qu il se gère par l administration :
// on le charge comme le fait server.js, sinon les modules travaillent
// sur un catalogue vide.
await chargerCatalogue(pool);
const app = express();
const http = createServer(app);
const io = new Server(http, { cors: { origin: true } });

/**
 * L'identité passe par un cookie, comme en production.
 *
 * Premier essai : remplacer `window.io` dans la page pour y glisser un jeton.
 * Raté — socket.io réassigne le global en se chargeant et emportait le
 * remplacement. Le socket arrivait avec `userId: undefined` et l'entrée en
 * file mourait au bind SQL. Le cookie, lui, part sur la poignée de main du
 * websocket comme sur les requêtes HTTP : un seul mécanisme, celui du vrai
 * serveur.
 */
const lireCookie = (entete, nom) => (entete ?? '').split(';')
  .map((c) => c.trim().split('='))
  .find(([k]) => k === nom)?.[1];

// Deux noms distincts, et non « Joueur » des deux côtés : sinon le fil dit
// « Joueur pousse » pour tout le monde et le test ne peut pas vérifier que
// l'écran attribue bien chaque action au bon camp.
const NOMS = { [U[0]]: 'Sédunois', [U[1]]: 'Bâloise' };

io.use((socket, next) => {
  const id = lireCookie(socket.handshake.headers?.cookie, 'tbf_test');
  if (!id) return next(new Error('sans identité'));
  socket.data.user = { userId: id, name: NOMS[id] ?? 'Joueur' };
  next();
});
const requireAuth = (r, s, n) => {
  const id = lireCookie(r.headers.cookie, 'tbf_test');
  if (!id) return s.status(401).json({ error: 'auth.error.unauthenticated' });
  r.user = { id };
  n();
};
const decks = createDecks({ pool, requireAuth });
const nvn = createNvN({ pool, io, decks, requireAuth });
app.use('/api/deck', decks.router);
app.use('/api/nvn', nvn.router);
app.get('/duel-nvn', (_q, s) => s.sendFile(path.join(RACINE, 'public', 'duel-nvn.html')));
app.use(express.static(path.join(RACINE, 'public')));
await new Promise((r) => http.listen(0, r));
const base = `http://localhost:${http.address().port}`;

/* ------------------------------------------------------- les navigateurs */

const nav = await puppeteer.launch({ args: ['--no-sandbox'] });

async function ouvrir(userId) {
  const page = await nav.newPage();
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  await page.setViewport({ width: 400, height: 880 });
  await page.setCookie({ name: 'tbf_test', value: userId,
    domain: 'localhost', path: '/' });
  await page.goto(`${base}/duel-nvn`, { waitUntil: 'networkidle0' });
  await dodo(900);
  return { page, erreurs, userId };
}

const A = await ouvrir(U[0]);
const B = await ouvrir(U[1]);

check('la page se charge sans erreur de script', A.erreurs.length === 0 && B.erreurs.length === 0);

/* ------------------------------------------------------- la préparation */

const prepa = await A.page.evaluate(() => ({
  formats: [...document.querySelectorAll('[data-fmt]')].map((b) => b.textContent.trim()),
  matchs: [...document.querySelectorAll('[data-fixture]')].map((m) => m.textContent.trim()),
  entrerActif: !document.getElementById('entrer')?.disabled,
  texte: document.getElementById('prepaCorps').textContent.replace(/\s+/g, ' '),
}));
check('les cinq formats sont proposés', prepa.formats.length === 5);
check('le match support en cours est proposé', prepa.matchs.some((m) => /Sion/.test(m)));
check('le duel est annoncé classé pour un match en cours',
  /comptera au classement/.test(prepa.texte));
check('avec un deck, l\u2019entrée en file est ouverte', prepa.entrerActif === true);
check('l\u2019écran prévient que des bots complètent',
  /bots complètent/.test(prepa.texte));

/* -------------------------------- la portée, et le double pour son club

   On peut jouer pour n’importe quel match, et pousser pour son club rapporte
   le double. Les deux règles vont ensemble : sans la première, la seconde
   s’appliquerait toujours et ne voudrait rien dire.

   Le serveur savait déjà répondre à `?tous=1` ; aucune page ne le lui
   demandait, ce qui rendait la fonction invisible, donc inexistante. */

const portee = async (quoi) => {
  await A.page.evaluate((q) =>
    document.querySelector(`[data-portee="${q}"]`)?.click(), quoi);
  await dodo(600);
  return A.page.evaluate(() => ({
    matchs: [...document.querySelectorAll('[data-fixture]')].map((m) => m.textContent.trim()),
    doubles: [...document.querySelectorAll('[data-fixture]')]
      .filter((m) => m.querySelector('.q.mien')).length,
    texte: document.getElementById('prepaCorps').textContent.replace(/s+/g, ' '),
  }));
};

const miens = await portee('miens');
check('par défaut, seuls les matchs de ses clubs sont proposés',
  miens.matchs.length === 1 && /Sion/.test(miens.matchs[0]));
check('et celui-là porte le badge du double', miens.doubles === 1);
check('la page explique pourquoi', /rapporte le double/.test(miens.texte));

const tousM = await portee('tous');
check('« tous les matchs » en propose davantage', tousM.matchs.length === 2);
check('dont un match sans club suivi', tousM.matchs.some((m) => /Lugano/.test(m)));
check('et un seul porte le badge du double', tousM.doubles === 1);

// On revient sur ses clubs : la suite du test compte sur ce match-là.
await portee('miens');

/* ---------------------------------------------------- file et appariement */

await A.page.evaluate(() => {
  document.querySelector('[data-fmt="1v1"]')?.click();
  document.querySelector('[data-fixture]')?.click();
  document.getElementById('entrer')?.click();
});
await dodo(400);
check('le premier joueur voit qu\u2019il attend',
  /file/i.test(await A.page.evaluate(() => document.getElementById('voileTitre').textContent)));

await B.page.evaluate(() => {
  document.querySelector('[data-fmt="1v1"]')?.click();
  document.querySelector('[data-fixture]')?.click();
  document.getElementById('entrer')?.click();
});

const apparie = await jusqua(async () =>
  await A.page.evaluate(() => document.getElementById('jeu').classList.contains('on')));
check('les deux joueurs sont appariés et le duel s\u2019ouvre', apparie);

const ouvert = await A.page.evaluate(() => ({
  horloge: document.getElementById('horloge').textContent,
  mode: document.getElementById('modeTag').textContent,
  fouleMoi: document.getElementById('fouleMoi').children.length,
  fouleEux: document.getElementById('fouleEux').children.length,
  cartes: document.querySelectorAll('#mainCartes .ct').length,
  fanzzy: document.querySelectorAll('#equipe .fz').length,
  actif: document.querySelector('#equipe .fz.actif')?.textContent.trim(),
  chanter: document.getElementById('chanterSous').textContent,
}));
check('l\u2019horloge démarre à cinq minutes', /^[45]:/.test(ouvert.horloge));
check('le duel est marqué classé', ouvert.mode === 'CLASSÉ');
check('chaque tribune a sa foule', ouvert.fouleMoi === 1 && ouvert.fouleEux === 1);

// Le nom, et pas seulement le compte : un écran qui met le bon nombre de têtes
// mais intervertit les camps est faux sans que rien ne le montre. Le nom vit
// dans l'infobulle de la tête depuis que le fil de texte a disparu.
{
  const camps = await A.page.evaluate(() => ({
    moi: [...document.querySelectorAll('#fouleMoi .tete')].map((t) => t.title).join(' '),
    eux: [...document.querySelectorAll('#fouleEux .tete')].map((t) => t.title).join(' '),
  }));
  check('ma tribune porte mon nom', /Sédunois/.test(camps.moi));
  check('et la tribune d\u2019en face porte celui de l\u2019adversaire',
    /Bâloise/.test(camps.eux) && !/Sédunois/.test(camps.eux));
}
check('la main montre cinq emplacements', ouvert.cartes === 5);
check('les trois Fanzzy du deck sont là', ouvert.fanzzy === 3);
check('le titulaire est en jeu', /EN JEU/.test(ouvert.actif ?? ''));
check('le bouton annonce le cri et le geste', /TEMPO|MARTELAGE|ENDURANCE/.test(ouvert.chanter));

/* ------------------------------------------ les Fanzzy ont un visage */

/**
 * Un nom seul ne dit pas qui est en jeu. Chaque Fanzzy porte donc son
 * portrait — dessiné pour les trois illustrés, silhouette pour les autres —
 * et il respire, comme partout ailleurs dans le jeu.
 */
{
  const vignettes = await A.page.evaluate(() => {
    const tuiles = [...document.querySelectorAll('#equipe .fz')];
    return tuiles.map((t) => {
      const el = t.querySelector('.vig .illu, .vig [data-vivant]');
      if (!el) return null;
      return {
        balise: el.tagName.toLowerCase(),
        vivant: el.classList.contains('fz-vivant'),
        animation: getComputedStyle(el).animationName,
      };
    });
  });
  check('chaque Fanzzy du deck a sa vignette',
    vignettes.length === 3 && vignettes.every(Boolean));
  check('et elle respire, illustrée ou non',
    vignettes.every((v) => v?.vivant && /fzsouffle/.test(v.animation)));
}

/* ------------------------------------ le barème du geste suit l'équipement */

const bareme = await A.page.evaluate(() => S.vue?.moi?.gestes);
const attendu = resoudreGeste({ tempoWindow: 1.2 * 1.25, tempoInterval: 70 }).tempo;
check('le serveur envoie le barème du geste à l\u2019écran', Boolean(bareme?.tempo));
check('et il tient compte des Jumelles du joueur',
  bareme.tempo.interval === attendu.interval && bareme.tempo.interval > GESTURES.tempo.interval);

const baremeB = await B.page.evaluate(() => S.vue?.moi?.gestes?.tempo?.interval);
check('un joueur sans équipement garde la pulsation de base',
  baremeB === GESTURES.tempo.interval);

/* -------------------------------------------------------------- chanter */

const ferveurAvant = await A.page.evaluate(() =>
  S.vue.equipes[S.vue.moi.side][0].ferveur);

await A.page.evaluate(() => document.getElementById('chanter').click());
check('le mini-jeu s\u2019ouvre', await jusqua(async () =>
  await A.page.evaluate(() => document.getElementById('mini').classList.contains('on'))));

// Décompte de trois, puis huit pulsations à l'intervalle du joueur : on tape
// sur ce que l'écran affiche, ce qui est exactement le cas d'usage cassé.
await jusqua(async () => await A.page.evaluate(() => Boolean(document.getElementById('pad'))), 6000);
const intervalle = bareme.tempo.interval;
for (let i = 0; i < bareme.tempo.beats; i++) {
  await A.page.evaluate(() => document.getElementById('pad')
    ?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
  await dodo(intervalle);
}

const chante = await jusqua(async () => {
  const f = await A.page.evaluate(() => S.vue?.equipes?.[S.vue.moi.side]?.[0]?.ferveur ?? 0);
  return f > ferveurAvant;
}, 12000);
check('taper sur la pulsation affichée fait monter la ferveur', chante);

const bouge = await A.page.evaluate(() => S.vue.rope !== 0);
check('la corde a bougé', bouge);

/**
 * Ce qui a remplacé le fil de texte : on ne lit plus l'état, on le voit.
 * Le territoire d'un camp suit la corde, et l'écart s'affiche en chiffres.
 * Sans ces deux contrôles, la refonte pourrait se figer sans que rien ne le
 * signale — la corde bougerait dans les données, pas à l'écran.
 */
{
  const arene = await A.page.evaluate(() => ({
    partMoi: parseFloat(document.getElementById('coteMoi').style.width),
    partEux: parseFloat(document.getElementById('coteEux').style.width),
    noeud: parseFloat(document.getElementById('noeud').style.left),
    ecart: document.getElementById('ecart').firstChild.textContent,
    mention: document.getElementById('ecart').querySelector('small').textContent,
  }));
  check('le territoire du camp suit la corde', arene.partMoi !== 50);
  check('les deux camps se partagent toute la largeur',
    Math.abs(arene.partMoi + arene.partEux - 100) < 0.2);
  check('le nœud est à la frontière des deux camps',
    Math.abs(arene.noeud - arene.partMoi) < 0.2);
  check('l\u2019écart est annoncé en chiffres', /^[+\u2212]\d+$/.test(arene.ecart));
  check('et il dit qui mène', /MÈNES|TIRENT/.test(arene.mention));
}
/* ---------------------------------------------------------- jouer une carte */

const jouable = await A.page.evaluate(() => {
  // Surtout pas « Arbitre — changement » : le deck de test en contient deux
  // exemplaires sur dix, la main est mélangée, et jouer cette carte-là donne
  // au joueur le droit de changer de Fanzzy — c'est-à-dire exactement le
  // refus que le test vérifie vingt lignes plus bas. L'échec tombait une fois
  // sur trois environ, sans rapport avec ce qui est mesuré.
  const c = document.querySelector('#mainCartes [data-jouer]:not([data-jouer="a-arbitre"])');
  if (!c) return null;
  const id = c.dataset.jouer;
  c.click();
  return id;
});
check('une carte de la main est jouable', Boolean(jouable));
check('la carte quitte la main après avoir été jouée',
  await jusqua(async () => await A.page.evaluate((id) =>
    !(S.vue?.moi?.main ?? []).includes(id), jouable)));
// La carte jouée s\u2019annonce par une étiquette qui monte depuis la corde
// puis disparaît. C'est fugace par construction : on la guette au lieu de la
// lire dans un journal.
check('la carte jouée s\u2019annonce au-dessus de la corde', await jusqua(async () =>
  await A.page.evaluate(() => document.querySelectorAll('.fx-nombre').length > 0), 3000));
/* ------------------------------------------- une erreur nomme sa cause */

// La cadence est limitée sur dix secondes glissantes. Sans cette pause, le
// refus reçu était parfois « trop d'actions » au lieu de la vraie cause, et
// le test devenait instable.
await dodo(1200);
await A.page.evaluate(() => socket.emit('nvn:swap', { index: 1 }));
const messageErreur = await jusqua(async () => {
  const t = await A.page.evaluate(() => document.getElementById('toast').textContent);
  return /Arbitre/.test(t);
}, 5000);
check('changer de Fanzzy sans le droit est refusé avec sa cause', messageErreur);
if (!messageErreur) console.log('    message reçu :',
  await A.page.evaluate(() => document.getElementById('toast').textContent));
check('et ce n\u2019est pas un « impossible » générique',
  !/serveur/i.test(await A.page.evaluate(() =>
    document.getElementById('toast').textContent)));

/* --------------------------------- la barre ne mange pas le bouton */

/**
 * Le bouton de chant est la seule action du jeu. S'il passe sous la barre de
 * navigation, un joueur qui vise « CHANTER » touche « PROFIL » et sort du duel
 * en cours. La barre s'efface pendant le jeu, mais elle revient au moindre
 * arrêt : c'est à ce moment-là qu'il faut qu'elle laisse la place.
 */
{
  const chevauche = await A.page.evaluate(() => {
    const b = document.getElementById('chanter');
    const n = document.getElementById('tbf-nav');
    if (!b) return 'bouton introuvable';
    if (!n || getComputedStyle(n).display === 'none') return 0;
    // On force la barre visible : elle se cache pendant l'action et
    // reviendrait de toute façon dès la première pause.
    n.style.transform = 'none';
    const rb = b.getBoundingClientRect();
    const rn = n.getBoundingClientRect();
    return Math.max(0, Math.round(rb.bottom - rn.top));
  });
  /**
 * Un écran de jeu ne se fait pas défiler. Le bouton de chant est la seule
 * action : s'il passe sous le pli, le joueur ne le trouve pas, et rien à
 * l'écran ne lui dit qu'il faut faire glisser la page.
 */
{
  const defile = await A.page.evaluate(() => ({
    page: document.documentElement.scrollHeight > document.documentElement.clientHeight + 1,
    app: (() => { const a = document.getElementById('app');
      return a.scrollHeight > a.clientHeight + 1; })(),
  }));
  check('l\u2019écran de duel ne défile pas', !defile.page && !defile.app);
}

check('la barre de navigation ne recouvre pas le bouton de chant',
    chevauche === 0);
  if (chevauche) console.log(`    recouvrement : ${chevauche} px`);

  // Le message d'erreur non plus : il apparaît précisément quand le joueur
  // vient d'être refusé, c'est-à-dire au moment où il regarde son bouton.
  const surToast = await A.page.evaluate(() => {
    const b = document.getElementById('chanter');
    const t = document.getElementById('toast');
    t.classList.add('on');
    const rb = b.getBoundingClientRect();
    const rt = t.getBoundingClientRect();
    const h = Math.min(rb.bottom, rt.bottom) - Math.max(rb.top, rt.top);
    const l = Math.min(rb.right, rt.right) - Math.max(rb.left, rt.left);
    return h > 0 && l > 0 ? Math.round(h) : 0;
  });
  check('le message d\u2019erreur ne masque pas le bouton de chant', surToast === 0);
  if (surToast) console.log(`    recouvrement du message : ${surToast} px`);
}

/* ------------------------------------------------------- pas d'erreur JS */

check('aucune erreur de script pendant toute la partie',
  A.erreurs.length === 0 && B.erreurs.length === 0);
if (A.erreurs.length) console.log('   ', A.erreurs.slice(0, 3));

/* ---------------------------------------------------------------- fin */

if (process.env.CAPTURE) {
  // Dans le dossier temporaire du système : « /tmp » en dur ne marche pas sous
  // Windows, et une capture n'a rien à faire dans le dépôt.
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  // Sans `fullPage` : c'est précisément ce qui tient dans l'écran qu'on veut
  // regarder. Une capture pleine page cacherait le défilement au lieu de le
  // montrer.
  await A.page.screenshot({ path: join(tmpdir(), 'nvn-duel.png') });
  await A.page.screenshot({ path: join(tmpdir(), 'nvn-duel-full.png'), fullPage: true });
  console.log(`   captures : ${join(tmpdir(), 'nvn-duel.png')}`);
}
await nav.close();
nvn.stop();
io.close();
await new Promise((r) => http.close(r));
await pool.end();

console.log(failures ? `\n${failures} test(s) en échec` : '\ntout est vert');
process.exit(failures ? 1 : 0);
