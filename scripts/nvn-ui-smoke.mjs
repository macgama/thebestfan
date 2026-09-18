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
import { CHANTS, ORDRE } from '../src/shared/duel/chants.js';
import { charger as chargerCatalogue } from '../src/server/fanzzy/catalogue.js';
import { chargerTenues } from '../src/server/fanzzy/tenues.js';
import { baseDeTest, OPTIONS_BASE } from './base-de-test.mjs';

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
await raw.query(`DROP TABLE IF EXISTS abonnements, achats, kop_invites, amities,
  kop_bulletins, kop_votes, kop_bonus, kop_membres, kops, user_decks, user_stuff, user_skins, user_fanzzy,
  user_souvenirs, virage_presence, souvenirs, user_wallet, api_cache, souvenir_leagues,
  duel_results, duel_events, duels, user_league_follows, user_follows, fixture_events, standings, fixtures,
  team_leagues, teams, leagues, api_quota, login_attempts, auth_tokens, sessions, users`);
for (const f of ['auth.sql', 'football.sql', 'minutes.sql', 'couleurs.sql', 'souvenirs.sql', 'billets.sql', 'fanzzy.sql',
                 /* `duel.sql` manquait : `duel_results` n'existait donc pas, la
                    forme récente de chaque joueur échouait en silence, et
                    l'affiche disait « PREMIER DUEL » à tout le monde — pour une
                    table absente, pas pour un joueur sans passé. */
                 'inventaire.sql', 'skins.sql', 'tenues.sql', 'deck.sql', 'duel.sql',
                 /* `historique.sql` manquait, et cette suite **détruit**
                    `duel_results` au démarrage : elle la reconstruisait donc
                    dans sa forme d'il y a six mois, sans `mode`, `format`,
                    `fanzzy_id`, `xp`, `duree_s` ni `side`.

                    Deux dégâts, et le second est le pire. Ici, la fin de duel
                    n'arrivait plus à se ranger — `Unknown column 'mode' in
                    'WHERE'` — mais `nvn` attrape et journalise, donc la suite
                    restait verte : un duel joué entièrement, et aucune trace.
                    Et comme les suites partagent une base, **toutes celles qui
                    passaient après héritaient de la table amputée**.

                    C'est la seule suite qui laisse la base plus pauvre qu'elle
                    ne l'a trouvée. Le contrôle ajouté à la fin garde la porte :
                    si la ligne ne s'écrit pas, elle rougit ici. */
                 'historique.sql']) {
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
  for (const f of ['TR32', 'MS30', 'TR33']) {
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
      fanzzy: [{ id: 'TR32', stuff: i === 0 ? ['jumelles'] : [] }, { id: 'MS30', stuff: [] },
               { id: 'TR33', stuff: [] }],
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
/* **Chacun son club, et ce sont les deux du match.** Les deux joueurs
   suivaient Sion : depuis que les tribunes d'un duel sont les deux clubs de la
   rencontre, ils seraient tous deux du côté du domicile et ne se
   rencontreraient jamais. C'est le cas ordinaire d'un duel de tribunes —
   quelqu'un de chaque côté — et c'est aussi celui où personne n'a de choix à
   faire. */
await raw.query(`INSERT INTO user_follows (user_id,team_id,is_main) VALUES (?,85,1)`, [U[0]]);
await raw.query(`INSERT INTO user_follows (user_id,team_id,is_main) VALUES (?,91,1)`, [U[1]]);
/* Un passé pour le premier joueur : six duels, dont le plus ancien ne doit
   **pas** apparaître — l'affiche n'en montre que cinq. Les issues sont
   distinctes pour que l'ordre se lise : la plus récente est une victoire, la
   plus ancienne visible un nul. */
{
  const passe = [
    ['win', 3, 1, 1], ['loss', 0, 2, 2], ['win', 2, 2, 3],
    ['loss', 1, 4, 4], ['draw', 2, 2, 5], ['win', 9, 0, 6],
  ];
  for (const [issue, pour, contre, ilYA] of passe) {
    await raw.query(
      `INSERT INTO duel_results (duel_id, user_id, opponent_id, outcome,
         goals_for, goals_against, ended_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW(3) - INTERVAL ? HOUR)`,
      [`passe-${ilYA}`, U[0], U[1], issue, pour, contre, ilYA]);
  }
}

await raw.end();

/* ----------------------------------------------------------- le serveur */

const pool = mysql.createPool({ uri: DB, connectionLimit: 8, ...OPTIONS_BASE });
// Le catalogue vit en base depuis qu il se gère par l administration :
// on le charge comme le fait server.js, sinon les modules travaillent
// sur un catalogue vide.
await chargerCatalogue(pool);
await chargerTenues(pool);
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
/* `nav.js` demande qui est connecté avant de monter quoi que ce soit : sans
   cette route, la barre du haut ne se construit pas et le duel se retrouve
   sans bouton de menu — donc sans aucune sortie depuis que la barre du bas a
   disparu. Le banc doit répondre comme le vrai serveur, sinon il éprouve son
   propre manque plutôt que le jeu. */
app.get('/api/auth/me', requireAuth, (r, s) =>
  s.json({ user: { id: r.user.id, pseudo: 'Testeur' } }));
app.get('/duel-nvn', (_q, s) => s.sendFile(path.join(RACINE, 'public', 'duel-nvn.html')));
app.use(express.static(path.join(RACINE, 'public')));
await new Promise((r) => http.listen(0, r));
const base = `http://localhost:${http.address().port}`;

/* ------------------------------------------------------- les navigateurs */

const nav = await puppeteer.launch({ args: ['--no-sandbox'] });

/**
 * Un joueur, avec son propre navigateur.
 *
 * **Un contexte chacun, et non deux onglets du même navigateur.** Les cookies
 * appartiennent au navigateur, pas à l'onglet : le second `setCookie` écrasait
 * le premier, et la page du premier joueur parlait ensuite au serveur sous
 * l'identité du second. C'est resté invisible tant que les deux suivaient le
 * même club — ils recevaient la même liste de matchs, la même réponse, et
 * personne ne pouvait voir la substitution. Dès qu'ils suivent deux clubs
 * différents, le premier joueur s'est vu annoncer la tribune de l'autre.
 */
async function ouvrir(userId) {
  const contexte = await nav.createBrowserContext();
  const page = await contexte.newPage();
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  await page.setViewport({ width: 400, height: 880 });
  await contexte.setCookie({ name: 'tbf_test', value: userId,
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

/* --------------------------------------------------------- la tribune

   Les deux camps d'un duel sont les deux clubs du match. Le premier joueur
   suit Sion, qui reçoit ; le second suit Bâle. Aucun des deux n'a de choix à
   faire, et c'est ce qu'on éprouve d'abord : un joueur chez lui ne doit pas
   voir de boutons, seulement le nom de sa tribune. */

const chezMoi = await A.page.evaluate(() => ({
  boutons: document.querySelectorAll('[data-camp]').length,
  texte: document.getElementById('prepaCorps').textContent.replace(/\s+/g, ' '),
}));
check('chez soi, aucune tribune à choisir', chezMoi.boutons === 0);
check('mais on dit laquelle est la sienne',
  /Tu es chez toi\s*:\s*Sion/.test(chezMoi.texte)
  || (console.log('        il dit :', chezMoi.texte.slice(-260)), false));

/* Et sur un match dont aucun club n'est suivi, l'inverse : deux boutons, et
   l'entrée fermée tant qu'on n'a pas dit pour qui l'on vient chanter. */

await portee('tous');
const neutre = await A.page.evaluate(() => {
  const m = [...document.querySelectorAll('[data-fixture]')]
    .find((x) => /Lugano/.test(x.textContent));
  m?.click();
  return {
    boutons: [...document.querySelectorAll('[data-camp]')].map((b) => b.textContent.trim()),
    entrerActif: !document.getElementById('entrer')?.disabled,
  };
});
check('sans club dans le match, les deux tribunes sont proposées',
  neutre.boutons.length === 2 && neutre.boutons.some((n) => /Lugano/.test(n)));
check('et l’entrée reste fermée tant qu’on n’a pas choisi',
  neutre.entrerActif === false);

const apresChoix = await A.page.evaluate(() => {
  document.querySelector('[data-camp="1"]')?.click();
  return {
    choisi: document.querySelector('[data-camp="1"]')?.classList.contains('on'),
    entrerActif: !document.getElementById('entrer')?.disabled,
  };
});
check('choisir une tribune la marque', apresChoix.choisi === true);
check('et ouvre l’entrée en file', apresChoix.entrerActif === true);

/* **Le choix se déplie sous le match**, pas au bas de la page.

   La liste fait soixante lignes depuis qu'elle montre tout ce qui se joue : on
   cliquait un match en haut, et ce qu'il fallait faire ensuite se trouvait
   mille pixels plus bas, hors de l'écran. Ce contrôle regarde **où** sont les
   boutons, pas s'ils existent — c'est toute la question. */
const place = await A.page.evaluate(() => {
  const choisi = document.querySelector('.mt.on');
  const sous = choisi?.nextElementSibling;
  const entrer = document.getElementById('entrer');
  return {
    juste: sous?.classList.contains('souscarte') ?? false,
    dedans: Boolean(sous?.contains(entrer)),
    // Et pas d'un écran de haut : le geste suivant doit être sous le doigt.
    ecart: entrer && choisi
      ? Math.round(entrer.getBoundingClientRect().top - choisi.getBoundingClientRect().bottom)
      : null,
  };
});
check('le choix se déplie juste sous le match', place.juste === true);
check('et le bouton d’entrée est dedans', place.dedans === true);
check('à portée de doigt, pas à un écran de là',
  place.ecart !== null && place.ecart >= 0 && place.ecart < 260
  || (console.log('        écart :', place.ecart, 'px'), false));

// On revient sur ses clubs : la suite du test compte sur ce match-là.
await portee('miens');

/* ---------------------------------------------------- file et appariement */

await A.page.evaluate(() => {
  document.querySelector('[data-fmt="1v1"]')?.click();
  document.querySelector('[data-fixture]')?.click();
  document.getElementById('entrer')?.click();
});
await dodo(400);
/* **La salle d'attente**, et non trois phrases.

   Elle disait « 1 sur 3 », « il manque 2 supporters de Vissel Kobe », « des
   bots complètent après 120 secondes ». C'est exact, et ça ne donne envie de
   rien : on attend deux minutes devant un compteur, sans savoir qui est là ni
   voir arriver personne.

   Elle montre maintenant les deux tribunes place par place, avec le portrait
   du Fanzzy que chacun aligne. Et elle dit ce qui manque **des deux côtés** :
   dans un 3v3 entré seul, il manque deux supporters chez soi avant d'en
   manquer trois en face, et le message d'avant ne nommait que le second. */
{
  const salle = await A.page.evaluate(() => {
    const s = document.querySelector('.salle');
    if (!s) return null;
    return {
      tribunes: [...s.querySelectorAll('.tribune-att h4')].map((h) =>
        h.textContent.replace(/\s+/g, ' ').trim()),
      prises: s.querySelectorAll('.place-att.pris').length,
      libres: s.querySelectorAll('.place-att.libre').length,
      portraits: s.querySelectorAll('.place-att.pris img').length,
      rebours: document.getElementById('rebours')?.textContent.trim() ?? '',
    };
  });
  check('le premier joueur arrive dans une salle d’attente', Boolean(salle)
    || (console.log('        voile :', await A.page.evaluate(() =>
      document.getElementById('voileTitre').textContent)), false));
  if (salle) {
    check('elle montre les deux tribunes', salle.tribunes.length === 2
      || (console.log('        ', JSON.stringify(salle.tribunes)), false));
    check('la sienne en premier', /MA TRIBUNE/.test(salle.tribunes[0] ?? ''));
    /* Un 1v1 : une place de chaque côté, la sienne prise et celle d'en face
       libre. C'est le plus petit cas, et c'est celui qui vérifie que les places
       se comptent sur le format et non sur le nombre de présents. */
    check('sa place est prise', salle.prises === 1);
    check('et celle d’en face attend quelqu’un', salle.libres === 1);
    /* Le portrait est **tout l'intérêt** : c'est ce qui distingue une salle
       d'attente d'un compteur. */
    check('on voit le Fanzzy qu’il aligne', salle.portraits === 1);
    check('et le rebours avant les supporters d’appoint tourne',
      /\d+/.test(salle.rebours)
      || (console.log('        il dit :', salle.rebours), false));
  }
}

await B.page.evaluate(() => {
  document.querySelector('[data-fmt="1v1"]')?.click();
  document.querySelector('[data-fixture]')?.click();
  document.getElementById('entrer')?.click();
});

const apparie = await jusqua(async () =>
  await A.page.evaluate(() => document.getElementById('jeu').classList.contains('on')));
check('les deux joueurs sont appariés et le duel s\u2019ouvre', apparie);

/* **On impose un chant de tempo au répertoire de ce duel.**
 *
 * Les cinq chants offerts sont tirés de l identifiant du duel, qui est un
 * uuid : rien ne garantit qu il y ait du tempo dedans. Or le tempo est le seul
 * geste que cette suite sait exécuter — huit frappes sur une pulsation — et
 * c est son barème qui vient d être lu.
 *
 * On l impose donc, plutôt que de relancer le duel jusqu à tomber dessus. Ce
 * qu on éprouve ici est la chaîne « je touche un chant, le mini-jeu s ouvre, le
 * serveur note » ; la variété du répertoire, elle, a son contrôle dans
 * nvn-smoke.
 */
{
  const salle = [...nvn.salles.values()][0];
  const tempo = ORDRE.find((id) => CHANTS[id].gest === 'tempo');
  if (salle && tempo) salle.duel.repertoire[0] = tempo;
  // L état part dix fois par seconde : le prochain porte le nouveau répertoire.
  await dodo(900);
}

const ouvert = await A.page.evaluate(() => ({
  horloge: document.getElementById('horloge').textContent,
  mode: document.getElementById('modeTag').textContent,
  fouleMoi: document.getElementById('fouleMoi').children.length,
  fouleEux: document.getElementById('fouleEux').children.length,
  cartes: document.querySelectorAll('#mainCartes .ct').length,
  fanzzy: document.querySelectorAll('#equipe .fz').length,
  actif: document.querySelector('#equipe .fz.actif')?.textContent.trim(),
  /* La rangée des chants a remplacé le bouton unique. On lit ce qu'elle
     porte : c'est la seule façon de vérifier que le joueur a bien un choix. */
  chants: [...document.querySelectorAll('#chants .chant')].map((c) => ({
    id: c.dataset.chant,
    nom: c.querySelector('b')?.textContent.trim(),
    geste: c.querySelector('.g')?.textContent.trim(),
    cout: Number(c.querySelector('.c')?.textContent),
    pousse: Number(c.querySelector('.p')?.textContent),
    hors: c.classList.contains('dim'),
  })),
}));
/* ============================================== l'affiche du duel

   **Un duel commençait sans qu'on sache contre qui on jouait.** La corde
   apparaissait, et il fallait chanter. Les trois Fanzzy de chacun, la forme
   récente des deux joueurs, le lieu — tout était déjà connu du serveur au coup
   d'envoi, et rien n'en sortait.

   Elle arrive sur `nvn:affiche`, juste après `nvn:start`, et elle se retire
   d'elle-même au bout de six secondes : c'est une affiche, pas une salle
   d'attente. */
{
  const aff = await A.page.evaluate(() => {
    const e = document.getElementById('affiche');
    if (!e || e.hidden) return null;
    return {
      visible: true,
      camps: e.querySelectorAll('.camp-bloc').length,
      vignettes: e.querySelectorAll('.fz-aff').length,
      entrent: e.querySelectorAll('.fz-aff.entre').length,
      noms: [...e.querySelectorAll('.camp-bloc .qui b')].map((b) => b.textContent.trim()),
      lieu: document.getElementById('afficheLieu').textContent.trim(),
      /* Le sien en premier : « en haut » veut dire « moi » sur les deux écrans
         du jeu, et changer cet ordre selon le camp tiré ferait chercher. */
      premier: e.querySelector('.camp-bloc')?.classList.contains('moi'),
      forme: [...e.querySelectorAll('.camp-bloc.moi .forme i')]
        .map((x) => x.textContent.trim()),
      sansPasse: [...e.querySelectorAll('.camp-bloc.eux .forme small')]
        .some((x) => /PREMIER DUEL/.test(x.textContent)),
    };
  });

  /* La regarder vaut mieux que la mesurer : deux \u00e9crans qui encadrent un duel
     sont des images avant d'\u00eatre des chiffres. */
  if (process.env.CAPTURE) {
    await A.page.screenshot({ path: `${process.env.TEMP ?? '/tmp'}/duel-affiche.png` });
  }

  check('l\u2019affiche s\u2019ouvre au coup d\u2019envoi', aff?.visible === true
    || (console.log('        elle est restée cachée'), false));
  if (aff) {
    check('elle montre les deux camps', aff.camps === 2);
    /* Le contrôle qui porte : on doit voir **toute l'équipe**, pas seulement
       celui qui entre. C'est en voyant les trois qu'on comprend qu'on peut
       changer. */
    check(`et les trois Fanzzy de chacun (${aff.vignettes})`, aff.vignettes === 6);
    check('dont celui qui entre, marqué', aff.entrent === 2);
    check('elle nomme les deux joueurs',
      aff.noms.some((n) => /Sédunois/.test(n)) && aff.noms.some((n) => /Bâloise/.test(n)));
    /* **La forme récente, et dans le bon sens.**

       Six duels sont semés, l'affiche n'en montre que cinq — et le plus récent
       en premier, parce que c'est le sens dans lequel on lit une forme : celui
       qui a perdu ses quatre premiers et gagné le dernier ne raconte pas la
       même chose que l'inverse. */
    check(`elle montre la forme récente (${aff.forme.join('')})`,
      aff.forme.length === 5
      || (console.log('        pastilles :', aff.forme.join(' ')), false));
    check('la plus récente d\u2019abord', aff.forme[0] === 'V'
      && aff.forme[4] === 'N'
      || (console.log('        ordre :', aff.forme.join('')), false));
    /* Et l'adversaire, qui n'a pas de passé, le dit au lieu de laisser un vide. */
    check('et un joueur sans passé le dit', aff.sansPasse === true);

    check('elle annonce le lieu de la rencontre', aff.lieu.length > 3
      || (console.log('        lieu :', JSON.stringify(aff.lieu)), false));
    check('et le camp du joueur vient en premier', aff.premier === true);

  /* **L'affiche tient dans la colonne, sur n'importe quel écran.**

     `.grand` est `position: fixed; inset: 0` — c'est juste, pour le fond : un
     duel qui se termine ne doit pas laisser voir sa corde derrière son
     résultat. Mais les enfants héritaient de cette largeur. Sur un écran de
     bureau, l'affiche s'étalait sur mille neuf cents pixels pendant que le
     reste du jeu tenait dans neuf cents : les vignettes de Fanzzy y faisaient
     six cents pixels de large, la troisième sortait du champ, et il fallait
     faire défiler une affiche qui ne reste que six secondes.

     Aucun contrôle ne pouvait le voir : la suite tournait en 400 px de large,
     c'est-à-dire précisément la seule largeur où le défaut n'existe pas. On
     mesure donc **large**, là où le jeu se regarde aussi. */
  {
    const avant = A.page.viewport();
    await A.page.setViewport({ width: 1440, height: 900 });
    const large = await A.page.evaluate(() => {
      const e = document.getElementById('affiche');
      const colonne = parseFloat(getComputedStyle(document.getElementById('app')).width);
      const debords = [...e.querySelectorAll('.camp-bloc, .fz-aff, .grand-haut, .camps')]
        .map((n) => Math.round(n.getBoundingClientRect().width))
        .filter((w) => w > colonne + 1);
      return {
        colonne: Math.round(colonne),
        vignette: Math.round(e.querySelector('.fz-aff')?.getBoundingClientRect().width ?? 0),
        debords: debords.length,
        defileH: document.documentElement.scrollWidth > innerWidth + 1,
      };
    });
    check('sur un grand écran, l’affiche tient dans la colonne du jeu',
      large.debords === 0
      || (console.log('        ', large.debords, 'élément(s) plus larges que',
        large.colonne, 'px'), false));
    check('les vignettes gardent une taille de carte',
      large.vignette > 60 && large.vignette < 340
      || (console.log('        vignette :', large.vignette, 'px'), false));
    check('et rien ne déborde sur le côté', !large.defileH);
    await A.page.setViewport(avant);
  }
  }

  /* Elle se retire seule. Une affiche qui resterait à l'écran cacherait la
     corde pendant qu'elle bouge, et le joueur perdrait le début du duel sans
     comprendre pourquoi. */
  await new Promise((r) => { setTimeout(r, 6400); });
  const partie = await A.page.evaluate(() => document.getElementById('affiche').hidden);
  check('puis se retire d\u2019elle-même', partie === true);
}

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

/* Chaque carte de la main porte son dessin — et le bon.
 *
 * Une main où toutes les cartes montreraient la même image passerait le
 * comptage sans qu'un joueur distingue quoi que ce soit : cinq `.illu` sur
 * cinq cartes. On compare donc, **dans l'ordre**, l'adresse de chaque image à
 * la main que le serveur a réellement distribuée — la carte de l'écran n'a
 * pas toujours son identifiant en attribut, une carte injouable n'en porte
 * pas, alors que la main, elle, est toujours complète.
 *
 * Le fichier doit aussi arriver : `action-art.js` retire toute image qui
 * échoue, donc une image encore présente est une image servie. */
{
  const main = await A.page.evaluate(() => ({
    servies: (S.vue?.moi?.main ?? []),
    vues: [...document.querySelectorAll('#mainCartes .ct')].map((c) => ({
      src: c.querySelector('.illu')?.getAttribute('src') ?? null,
      sceau: Boolean(c.querySelector('.sceau')),
    })),
  }));
  check('chaque carte de la main porte un dessin',
    main.vues.length === 5 && main.vues.every((c) => c.src));
  const alignees = main.servies.length === 5 && main.servies.every((id, i) =>
    main.vues[i]?.src?.startsWith(`/img/action/${id}.`));
  check('et chacune porte le sien, dans l\u2019ordre de la main', alignees);
  if (!alignees) console.log('        distribuée :', main.servies.join(', '),
    '\n        vue :', main.vues.map((c) => c.src).join(', '));
  check('le glyphe de famille reste dessous, en cas de dessin manquant',
    main.vues.every((c) => c.sceau));
}
check('les trois Fanzzy du deck sont là', ouvert.fanzzy === 3);
check('le titulaire est en jeu', /EN JEU/.test(ouvert.actif ?? ''));
/* **Cinq chants, et ils se distinguent.**

   Le duel n'en offrait aucun : un bouton, et le serveur imposait le geste. Tous
   les chants coûtaient dix-huit pour pousser quarante-quatre — choisir n'aurait
   rien changé. Ce qu'on éprouve ici est donc la décision elle-même : cinq
   cartes, des gestes différents, et des prix différents. */
check(`l'écran offre cinq chants (${ouvert.chants.length})`, ouvert.chants.length === 5);
check('chacun porte son nom, son geste, son coût et sa poussée',
  ouvert.chants.every((c) => c.nom && c.geste && c.cout > 0 && c.pousse > 0)
  || (console.log('        ', JSON.stringify(ouvert.chants)), false));
check(`ils ne portent pas tous le même geste (${new Set(ouvert.chants.map((c) => c.geste)).size})`,
  new Set(ouvert.chants.map((c) => c.geste)).size >= 2);
check('ni le même prix',
  new Set(ouvert.chants.map((c) => c.cout)).size >= 2);

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

/* Le barème arrive avec le premier état du duel, qui vient du réseau : le
   lire aussitôt après l'appariement, c'est le lire une fois sur cinq avant
   qu'il soit là. Les deux contrôles tombaient alors ensemble, en accusant
   l'équipement d'un joueur pour une question de milliseconde.

   **On attendait A et on lisait B.** L'attente n'avait été posée que pour le
   premier des deux joueurs : celui d'en face était lu sans rien attendre, et
   son barème arrivait quand il arrivait. Seule, la suite passait — la machine
   n'a rien d'autre à faire. En série derrière quinze autres, elle rougissait
   une fois sur deux, et le message accusait l'équipement.

   La fenêtre passe aussi à quinze secondes : huit suffisent sur une machine au
   repos, et c'est précisément la condition dans laquelle on ne reproduit
   jamais le défaut. */
const attenduA = async () => Boolean(await A.page.evaluate(() => S.vue?.moi?.gestes?.tempo));
const attenduB = async () => Number.isFinite(
  await B.page.evaluate(() => S.vue?.moi?.gestes?.tempo?.interval ?? NaN));
const arriveA = await jusqua(attenduA, 15000);
const arriveB = await jusqua(attenduB, 15000);
check('le barème des deux joueurs arrive à l’écran', arriveA && arriveB
  || (console.log('        A :', arriveA, '· B :', arriveB), false));

const bareme = await A.page.evaluate(() => S.vue?.moi?.gestes);
const attendu = resoudreGeste({ tempoWindow: 1.2 * 1.25, tempoInterval: 70 }).tempo;
check('le serveur envoie le barème du geste à l\u2019écran', Boolean(bareme?.tempo));
check('et il tient compte des Jumelles du joueur',
  bareme?.tempo?.interval === attendu.interval
  && bareme?.tempo?.interval > GESTURES.tempo.interval
  || (console.log('        il dit :', JSON.stringify(bareme?.tempo),
    '· attendu', attendu.interval), false));

const baremeB = await B.page.evaluate(() => S.vue?.moi?.gestes?.tempo?.interval);
check('un joueur sans équipement garde la pulsation de base',
  baremeB === GESTURES.tempo.interval
  || (console.log('        il dit :', baremeB,
    '· attendu', GESTURES.tempo.interval), false));

/* -------------------------------------------------------------- chanter */

const ferveurAvant = await A.page.evaluate(() =>
  S.vue.equipes[S.vue.moi.side][0].ferveur);

/* On choisit **le chant de tempo** : c'est celui dont la suite sait exécuter
   le geste, et c'est son barème qui a été lu juste au-dessus. */
const chantTempo = ouvert.chants.find((c) => /TEMPO/.test(c.geste))?.id;
check('un chant de tempo est offert', Boolean(chantTempo)
  || (console.log('        gestes offerts :',
    ouvert.chants.map((c) => c.geste).join(', ')), false));
await A.page.evaluate((id) => document.querySelector(`[data-chant="${id}"]`)?.click(),
  chantTempo);
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

/* La carte jouée se montre en grand.
 *
 * C'était une étiquette de sept pixels qui montait de la corde, et le contrôle
 * se contentait de compter les `.fx-nombre` présents — c'est-à-dire qu'une
 * poussée survenue au même instant le faisait passer au vert sans qu'aucune
 * carte n'ait rien annoncé. On lit donc **le nom de la carte jouée**, celle-là
 * et pas une autre.
 *
 * C'est fugace par construction : la carte se retire toute seule au bout d'une
 * seconde et quart. On la guette au lieu de la lire dans un journal. */
const annonce = await jusqua(async () => await A.page.evaluate((id) => {
  const el = document.querySelector('.tbf-jouee');
  if (!el) return false;
  window.__annonce = {
    nom: el.querySelector('.nm')?.textContent.trim(),
    attendu: S.catalogue.find((a) => a.id === id)?.nom,
    illu: el.querySelector('.illu')?.getAttribute('src'),
  };
  return true;
}, jouable), 3000);
check('la carte jouée se montre en grand', annonce);
const vue = await A.page.evaluate(() => window.__annonce ?? {});
check('et c\u2019est bien celle qu\u2019on vient de jouer',
  Boolean(vue.attendu) && vue.nom === vue.attendu);
if (vue.nom !== vue.attendu) console.log('    montrée :', vue.nom, '— attendue :', vue.attendu);
check('elle porte son dessin', vue.illu === `/img/action/${jouable}.avif`
  || vue.illu === `/img/action/${jouable}.webp` || vue.illu === `/img/action/${jouable}.jpg`);

/* Et elle s'en va. Une carte restée à l'écran couvrirait la corde pendant tout
   le reste du duel — c'est le genre de panne qu'on ne voit qu'en jouant. */
check('puis elle s\u2019efface', await jusqua(async () =>
  await A.page.evaluate(() => !document.querySelector('.tbf-jouee')), 4000));
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
  /* La barre du bas a disparu, et avec elle le recouvrement qu'elle causait.
     Ce contrôle-ci serait donc vert pour rien : ce qu'il surveillait n'existe
     plus. On le tourne vers ce qui a pris sa place — le bouton de menu, qui
     flotte désormais au-dessus de l'écran de jeu et pourrait tout aussi bien
     se poser sur quelque chose qu'on vise. */
  const chevauche = await A.page.evaluate(() => {
    const b = document.getElementById('chants');
    const m = document.querySelector('.tbf-burger');
    if (!b) return 'rangée des chants introuvable';
    if (!m) return 'bouton de menu introuvable : plus aucune sortie en jeu';
    const rb = b.getBoundingClientRect();
    const rm = m.getBoundingClientRect();
    // Deux rectangles se chevauchent s'ils se croisent sur les deux axes.
    const croise = rb.left < rm.right && rm.left < rb.right
      && rb.top < rm.bottom && rm.top < rb.bottom;
    return croise ? Math.round(Math.min(rb.right, rm.right) - Math.max(rb.left, rm.left)) : 0;
  });
  /**
 * Un écran de jeu ne se fait pas défiler. La rangée des chants est la seule
 * action : si elle passe sous le pli, le joueur ne la trouve pas, et rien à
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

check('le bouton de menu ne recouvre pas les chants',
    chevauche === 0);
  if (chevauche) console.log(`    recouvrement : ${chevauche} px`);

  // Le message d'erreur non plus : il apparaît précisément quand le joueur
  // vient d'être refusé, c'est-à-dire au moment où il regarde son bouton.
  const surToast = await A.page.evaluate(() => {
    const b = document.getElementById('chants');
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


/* =========================================== inviter quelqu'un dans sa file

   Une file de duel ne vit que deux minutes : c'est exactement le moment où
   l'on voudrait dire « viens, je t'attends », et le jeu n'avait aucun moyen de
   le faire.

   Deux choses à éprouver, et la première est celle qui décide de tout :
   **le lien envoie dans le camp d'en face**. Deux joueurs du même côté ne se
   rencontrent jamais — ils attendent ensemble. */

{
  const lien = await A.page.evaluate(() => lienDeMaFile({
    fixtureId: 7, format: '1v1', camp: 0,
    enFaceClub: { id: 91, name: 'Bâle' },
  }));
  check('le lien d’invitation porte le match et le format',
    /match=7/.test(lien) && /format=1v1/.test(lien)
    || (console.log('        il dit :', lien), false));
  check('et il envoie dans le camp d’en face', /camp=1/.test(lien)
    || (console.log('        il dit :', lien), false));
}

/* Et à l'arrivée : format, match et camp déjà posés. Un lien qui ouvrirait la
   page au début du parcours ne serait pas une invitation, ce serait une
   adresse. */
{
  const invite = await ouvrir(U[1]);
  await invite.page.goto(`${base}/duel-nvn?match=7&format=1v1&camp=1`,
    { waitUntil: 'networkidle0' });
  await dodo(900);

  const pose = await invite.page.evaluate(() => ({
    format: S.format, match: S.fixtureId, camp: S.camp,
    formatMarque: document.querySelector('[data-fmt].on')?.textContent.trim(),
  }));
  check('l’invité arrive sur le bon format',
    pose.format === '1v1' && pose.formatMarque === '1v1');
  check('sur le bon match', pose.match === 7);
  check('et dans le camp qu’on lui a réservé', pose.camp === 1);
  await invite.page.close();
}

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
/* ============================================== le bilan de fin de duel

   **Cinq minutes de jeu se terminaient sur un voile gris avec un mot dessus** —
   moins qu'un message d'erreur. Tout ce que montre cet écran était compté
   pendant la partie et n'était raconté à personne : les cartes jouées, les
   changements, la carte préférée, ce que le duel a rapporté.

   On force la fin plutôt que d'attendre cinq minutes : la salle est exposée par
   le module, et son horloge fait le reste. C'est le chemin réel — `fermer()`
   est la seule porte de sortie d'un duel, quelle qu'en soit la raison. */
{
  const salle = [...nvn.salles.values()][0];
  if (!salle) {
    check('une salle est ouverte pour éprouver la fin', false);
  } else {
    /* On avance la fin dans le passé et on laisse l'horloge la constater. Poser
       `termine` à la main court-circuiterait justement ce qu'on veut éprouver. */
    salle.duel.fin = Date.now() - 1;
    await new Promise((r) => { setTimeout(r, 900); });

    const bil = await A.page.evaluate(() => {
      const e = document.getElementById('bilan');
      if (!e || e.hidden) return null;
      return {
        visible: true,
        titre: document.getElementById('bilanTitre').textContent.trim(),
        score: document.getElementById('bilanScore').textContent.trim(),
        lieu: document.getElementById('bilanLieu').textContent.trim(),
        gains: [...e.querySelectorAll('.gain small')].map((x) => x.textContent.trim()),
        lignes: [...e.querySelectorAll('.stat .quoi')].map((x) => x.textContent.trim()),
        sortie: document.getElementById('bilanSortir').textContent.trim(),
        /* Le voile gris de l'ancienne fin ne doit plus se montrer : les deux
           ensemble donneraient deux résultats superposés. */
        voile: document.getElementById('voile').classList.contains('on'),
      };
    });

    check('le bilan s\u2019ouvre à la fin du duel', bil?.visible === true
      || (console.log('        il est resté caché'), false));

    if (bil) {
      check(`il annonce le résultat (${bil.titre})`,
        /VICTOIRE|DÉFAITE|MATCH NUL/.test(bil.titre));
      check(`et le score (${bil.score})`, /\d.*\d/.test(bil.score));
      check('il rappelle le lieu', bil.lieu.length > 2);
      /* Le contrôle qui porte : **ce que le duel a rapporté**. Les écharpes
         étaient versées en silence, et le joueur voyait son solde changer entre
         deux écrans sans savoir ni combien ni pourquoi. */
      check(`il dit ce qu\u2019on a gagné (${bil.gains.join(', ') || 'rien'})`,
        bil.gains.includes('ÉCHARPES'));
      /* Et les chiffres du match, les deux camps côte à côte : c'est la
         comparaison qui intéresse, pas le chiffre isolé. */
      check(`il compte le match (${bil.lignes.length} lignes)`,
        ['CHANTS', 'CARTES JOUÉES', 'CHANGEMENTS'].every((l) => bil.lignes.includes(l))
        || (console.log('        lignes :', bil.lignes.join(' | ')), false));
      check('il offre une sortie', /REVENIR/i.test(bil.sortie));
      check('et l\u2019ancien voile gris ne se montre plus', bil.voile === false);
    }

    if (process.env.CAPTURE) {
      await A.page.screenshot({ path: `${process.env.TEMP ?? '/tmp'}/duel-bilan.png` });
    }
  }
}

/* ================================= le duel s'est-il rangé quelque part ?

   Tout ce qui précède regarde l'écran. Rien ne regardait la base, et c'est
   précisément là que le duel disparaissait en silence : l'écriture est dans un
   `try` qui journalise et continue — à raison, un duel fini ne doit pas casser
   sur une question d'archive — mais personne ne lisait le journal.

   On ne contrôle pas la valeur des colonnes, `nvn:net` s'en charge. On
   contrôle qu'**il y a une ligne**, et qu'elle porte les champs récents : c'est
   ce qui distingue une table à jour d'une table reconstruite de travers. */
{
  const [lignes] = await pool.query(
    `SELECT fanzzy_id, side, mode, duree_s FROM duel_results WHERE user_id = ?`, [U[0]]);
  check('le duel joué laisse une ligne dans l\u2019historique', lignes.length > 0
    || (console.log('        duel_results est vide pour ce joueur'), false));
  if (lignes.length) {
    const l = lignes[lignes.length - 1];
    check('et elle dit le Fanzzy, le camp et la sorte de partie',
      Boolean(l.fanzzy_id) && l.side !== null && Boolean(l.mode)
      || (console.log('        elle dit :', JSON.stringify(l)), false));
  }
}

await nav.close();
nvn.stop();
io.close();
await new Promise((r) => http.close(r));
await pool.end();

console.log(failures ? `\n${failures} test(s) en échec` : '\ntout est vert');
process.exit(failures ? 1 : 0);
