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
/* Les Jumelles sont **lues**, jamais recopiées : la cible d'origine multipliait
   1,2 par 1,25 — une supposition sur l'empilement de l'équipement et du Fanzzy
   que rien n'éprouvait, puisque seul l'intervalle était comparé et que la
   fenêtre n'y entre pas. La pièce donne 1,25 toute seule, et c'est elle qui
   fait foi. */
import { STUFF_BY_ID } from '../src/shared/fanzzy/inventaire.js';
import { CHANTS, ORDRE } from '../src/shared/duel/chants.js';
import { charger as chargerCatalogue } from '../src/server/fanzzy/catalogue.js';
import { chargerTenues } from '../src/server/fanzzy/tenues.js';
/* Le stade d'un match, tel que le serveur le tire pour le Virage et pour
   chacun de ses duels : ce que l'affiche de la préparation doit montrer. */
import { stadeDuMatch } from '../src/server/contenus/index.js';
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
await raw.query(`DROP TABLE IF EXISTS parrainages, abonnements, achats, kop_invites, amities,
  kop_bulletins, kop_votes, kop_bonus, kop_membres, kops, user_decks, user_stuff, user_etats, user_skins, user_fanzzy,
  user_souvenirs, virage_presence, souvenirs, user_wallet, api_cache, souvenir_leagues,
  duel_results, duel_events, duels, user_league_follows, user_follows, fixture_events, standings, fixtures,
  team_leagues, teams, leagues, api_quota, login_attempts, auth_tokens, sessions, users`);
for (const f of ['auth.sql', 'football.sql', 'minutes.sql', 'couleurs.sql', 'souvenirs.sql', 'billets.sql', 'fanzzy.sql',
                 /* `duel.sql` manquait : `duel_results` n'existait donc pas, la
                    forme récente de chaque joueur échouait en silence, et
                    l'affiche disait « PREMIER DUEL » à tout le monde — pour une
                    table absente, pas pour un joueur sans passé. */
                 'inventaire.sql', 'skins.sql', 'etats.sql', 'tenues.sql', 'deck.sql', 'duel.sql',
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

/* **Une tenue mise par celui d'en face** : la Bâloise a habillé son Choriste
   pour Halloween, à son premier âge. Le Choriste n'a pas cette tenue
   dessinée — il reste au dessin de base, et les contrôles de l'arène ne
   bougent pas —, mais la vue doit la dire. */
await raw.query(`INSERT INTO user_skins (user_id,fanzzy_id,stage,skin_id,equipped)
                 VALUES (?,'TR32',1,'halloween',1)`, [U[1]]);

/* Les couleurs des deux clubs du match support (`sql/couleurs.sql`) : la
   liste et la vue les servent, et la page en fait l'écharpe de l'affiche,
   la corde et les bâches du HUD (lot 6). Le second match n'en a pas : sans
   elles, rien ne s'invente. */
await raw.query(`INSERT INTO teams (id,name,color1,color2) VALUES (85,'Sion','#D7141A','#F2EEE4'),
  (91,'Bâle','#C8102E','#003DA5'),(60,'Lugano',NULL,NULL),(61,'Coire',NULL,NULL)`);
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

/* ------------------------------------------- ce que la page demande au son

   **Le son de tribune est branché sur le match** (lot 6) : la rumeur suit
   la partie — le vestiaire, l'entrée, le jeu, la fin — et le chant d'un
   geste de rythme part avec lui, sur les durées servies, et s'arrête à la
   fermeture de la fenêtre. Un banc sans haut-parleur ne l'entend pas : on
   relève donc ce que la page **demande** au moteur, en enveloppant ses deux
   portes. Le moteur arrive en différé (`fx.js` le charge) : on l'attend. */
const espionnerLeSon = (page) => page.evaluate(() => {
  const moteur = window.TBF_SON;
  if (!moteur) return false;
  if (moteur.__espion) return true;
  window.__rumeurs = [];
  window.__chants = [];
  const rumeur = moteur.rumeur?.bind(moteur);
  moteur.rumeur = (m, o) => { window.__rumeurs.push(m); return rumeur?.(m, o); };
  const chant = moteur.chantDuGeste?.bind(moteur);
  moteur.chantDuGeste = (g, gestes, o) => {
    const p = chant?.(g, gestes, o) ?? null;
    /* **Les durées servies, comparées par leur valeur** : le serveur envoie
       une vue neuve dix fois par seconde, et le décompte du geste dure trois
       secondes — l'objet que la page a pris au toucher n'est plus celui de
       la vue courante, mais ses durées sont les mêmes. Comparé à l'identité,
       le contrôle ne passait que sur un banc qui renvoie toujours le même
       objet. */
    const appel = { g, servis: Boolean(gestes)
      && JSON.stringify(gestes) === JSON.stringify(S.vue?.moi?.gestes ?? null),
      origine: typeof o?.origine === 'number', depuis: o?.origine ?? null, arrete: false };
    window.__chants.push(appel);
    if (p && typeof p.arreter === 'function') {
      const arreter = p.arreter.bind(p);
      p.arreter = () => { appel.arrete = true; return arreter(); };
    }
    return p;
  };
  moteur.__espion = true;
  return true;
});
check('le moteur du son est là, et ses deux portes sont relevées',
  await jusqua(() => espionnerLeSon(A.page), 6000));

/* ------------------------------------------------------- la préparation */

const prepa = await A.page.evaluate(() => ({
  formats: [...document.querySelectorAll('[data-fmt]')].map((b) => b.textContent.trim()),
  /* `dataset` et non le texte : le bouton porte sa prime en petit, donc
     son texte dit « 3v3+40 % » et non « 3v3 ». */
  formatChoisi: document.querySelector('[data-fmt].on')?.dataset.fmt ?? null,
  matchs: [...document.querySelectorAll('[data-fixture]')].map((m) => m.textContent.trim()),
  entrerActif: !document.getElementById('entrer')?.disabled,
  regles: document.getElementById('regles')?.textContent.replace(/\s+/g, ' ') ?? '',
}));
check('les cinq formats sont proposés', prepa.formats.length === 5);
/* **Et c'est le 1v1 qui est coché.** Le format décidé d'avance indexe la
   file : la page s’ouvrait sur un 3v3, donc elle mettait d’office celui qui
   n’y touche pas dans le format le plus dur à remplir — six supporters sur
   un même match. Un soir creux, il attend le repli puis joue contre des
   bots. Le 1v1 est le seul qui part à deux. */
check(`et le 1v1 est celui qui est coché (${prepa.formatChoisi})`,
  prepa.formatChoisi === '1v1'
  || (console.log('        la page s’ouvre sur', prepa.formatChoisi), false));
check('le match support en cours est proposé', prepa.matchs.some((m) => /Sion/.test(m)));
/* La phrase du serveur (`raisonDuMatch`) dit pourquoi ce duel compte : elle
   est dans les règles, derrière le « i » — l'affiche le dit d'un mot, CLASSÉ
   en sticker d'or (contrôlé plus bas). */
check('le duel est annoncé classé pour un match en cours, la phrase dans les règles',
  /comptera au classement/.test(prepa.regles) || (console.log('        règles :', prepa.regles), false));
check('avec un deck, l\u2019entrée en file est ouverte', prepa.entrerActif === true);
check('l\u2019écran prévient que des bots complètent',
  /bots complètent/.test(prepa.regles));

/* **La préparation du lot 6** : le match choisi en affiche, chaque format
   avec sa prime en sticker, et sous ENTRER EN FILE **ce qui est en jeu, tel
   que le serveur le sert** (`enJeu`, § 17) — jamais un montant que la page
   aurait compté, et rien sans lui. */
{
  const vu = await A.page.evaluate(() => ({
    affiche: Boolean(document.querySelector('.mt.on.tbf-affiche')),
    classe: Boolean(document.querySelector('.mt.on .tbf-sticker[data-ton="or"]')),
    dit: document.querySelector('#entrer small')?.textContent.trim() ?? null,
    servi: S.matchs.find((m) => m.id === S.fixtureId)?.enJeu?.[S.format] ?? null,
    primes: [...document.querySelectorAll('[data-fmt] .prime')].map((p) => p.textContent.trim()),
    attendues: Object.entries(S.primes ?? {}).filter(([, p]) => p > 1)
      .map(([, p]) => `+${Math.round((p - 1) * 100)} %`),
  }));
  check('le match choisi se pose en affiche, CLASSÉ en sticker d’or', vu.affiche && vu.classe);
  check(`ce qui est en jeu se lit sous ENTRER EN FILE, tel que servi (${vu.dit ?? 'rien'})`,
    vu.servi ? vu.dit === `+${vu.servi} écharpes en jeu` : vu.dit === null);
  check('chaque format porte sa prime, lue dans le catalogue',
    vu.primes.length === vu.attendues.length && vu.primes.every((p, i) => p === vu.attendues[i])
    || (console.log('        ', JSON.stringify(vu)), false));
}

/* **L'écharpe de l'affiche est aux couleurs des deux clubs**, telles que la
   liste les sert (`homeColors`, `awayColors`), éclaircies comme partout par
   `FX.lisible` — le domicile à gauche (`--a1`), l'extérieur à droite
   (`--b1`). Le match support en a (voir la base) : un contrôle qui ne
   verrait que l'absence passerait sur une page qui n'en pose jamais. */
{
  const vu = await A.page.evaluate(() => {
    const m = S.matchs.find((x) => x.id === S.fixtureId);
    const el = document.querySelector('.mt.on');
    const lisible = (c) => (c ? (window.FX?.lisible?.(c) ?? c) : '');
    return { servies: [m?.homeColors?.[0] ?? null, m?.awayColors?.[0] ?? null],
      a1: el?.style.getPropertyValue('--a1') ?? '', b1: el?.style.getPropertyValue('--b1') ?? '',
      attendues: [lisible(m?.homeColors?.[0]), lisible(m?.awayColors?.[0])] };
  });
  check(`l’affiche porte l’écharpe des deux clubs, telle que servie (${vu.a1 || 'rien'} · ${vu.b1 || 'rien'})`,
    vu.servies.every(Boolean) && vu.a1 === vu.attendues[0] && vu.b1 === vu.attendues[1]
    || (console.log('        ', JSON.stringify(vu)), false));
}

/* **Le stade du match, sur son affiche** (décision de Gaël, 6 octobre
   2026 : tous les duels d'un match se jouent dans son stade, celui de son
   Grand Virage, et la préparation le montre avant l'entrée en file). La
   liste le sert avec chaque match (`stade`, § 17) ; l'affiche du match
   choisi en pose le dessin réduit en fond, sous le voile de la brique, et le
   nom au pied ; les règles du « i » disent ce qu'il change. On compare à ce
   que le serveur tire pour ce match (`stadeDuMatch`, la fonction que le
   Virage et le duel appellent) et, plus bas, au stade où le duel se joue
   vraiment, puis à celui d'un autre match choisi : un contrôle qui ne
   verrait qu'un nom passerait sur une page qui montrerait toujours le même.
   Le lieu se lit dans l'adresse du dessin, la seule trace de son
   identifiant dans la page. */
const lireStade = () => {
  const el = document.querySelector('#prepaCorps .mt.on');
  const fond = el?.hasAttribute('data-fond') ? el.style.getPropertyValue('--fond') : '';
  return { match: S.fixtureId, id: fond.match(/\/img\/stade\/([a-z0-9-]+)-mini\./)?.[1] ?? null,
    nom: el?.querySelector('.lieu-match b')?.textContent.trim() ?? null,
    regles: document.getElementById('regles')?.textContent.replace(/\s+/g, ' ') ?? '' };
};
await A.page.evaluate(`window.__lireStade = ${lireStade}`);
const stadeAnnonce = await A.page.evaluate(() => window.__lireStade());
{
  const attendu = stadeDuMatch(stadeAnnonce.match);
  check(`l’affiche du match choisi montre son stade, le dessin en fond et le nom au pied (${
    stadeAnnonce.nom ?? 'rien'})`,
  stadeAnnonce.match === 7 && stadeAnnonce.id === attendu.id && stadeAnnonce.nom === attendu.nom
    || (console.log('        vu', stadeAnnonce.id, stadeAnnonce.nom, '· attendu', attendu.id, attendu.nom), false));
  check('et les règles du « i » disent ce qu’il change',
    stadeAnnonce.regles.includes(`Le stade : ${attendu.nom}. ${attendu.effet}`.replace(/\s+/g, ' '))
    || (console.log('        règles :', stadeAnnonce.regles), false));
}

/* **La préparation ne défile que pour un match qu'on ne voit pas** (lot 6).
   Centré d'office, le match choisi faisait défiler la page alors qu'il était
   déjà à l'écran — de 163 px à 360 × 640 : le titre sortait, et les tuiles
   des formats, le premier choix, passaient sous la flèche et le menu
   flottants. La règle : vu d'au moins cent vingt pixels sans défiler, rien
   ne bouge ; sinon il se pose sous les deux boutons (`scroll-margin-top`).
   **À 360 × 640**, là où le défaut a été vu : à 400 × 880, le centrage
   d'avant ne défilait pas, et le contrôle n'aurait rien prouvé. La page
   rejoue ce qu'elle fait au chargement (`amenerLeMatch`), deux fois : le
   match tel qu'il est, puis repoussé hors de vue sous le titre. */
{
  const mesurer = (pousse) => A.page.evaluate((px) => {
    const prepa = document.getElementById('prepa');
    const choisi = prepa.querySelector('.mt.on');
    const titre = prepa.querySelector('.top');
    if (!choisi || !titre) return null;
    const avant = titre.style.paddingBottom;
    /* Repoussé sous le titre, et une longue liste dessous (une cale en fin
       de préparation) : le défilement n'est pas borné par le bas. */
    const cale = document.createElement('div');
    if (px) { titre.style.paddingBottom = `${px}px`; cale.style.height = `${px}px`; prepa.appendChild(cale); }
    prepa.scrollTop = 0;
    const dansLaPage = choisi.getBoundingClientRect().top - prepa.getBoundingClientRect().top;
    amenerLeMatch();
    const vu = { defile: Math.round(prepa.scrollTop), dansLaPage: Math.round(dansLaPage),
      fenetre: prepa.clientHeight, marge: parseFloat(getComputedStyle(choisi).scrollMarginTop) || 0,
      max: prepa.scrollHeight - prepa.clientHeight,
      // Posé sous la flèche et le menu flottants, jamais dessous.
      sousBoutons: ['.tbf-retour', '.tbf-burger'].every((x) => {
        const q = document.querySelector(x)?.getBoundingClientRect();
        return !q || choisi.getBoundingClientRect().top >= q.bottom - 1;
      }) };
    titre.style.paddingBottom = avant;
    cale.remove();
    prepa.scrollTop = 0;
    return vu;
  }, pousse);
  const juste = (h) => Boolean(h) && Math.abs(h.defile - (h.dansLaPage <= h.fenetre - 120 ? 0
    : Math.min(h.max, Math.round(h.dansLaPage - h.marge)))) <= 2;
  const avant = A.page.viewport();
  await A.page.setViewport({ width: 360, height: 640 });
  await dodo(150);
  const vu = await mesurer(0);
  const loin = await mesurer(900);
  await A.page.setViewport(avant);
  await dodo(150);
  check(`à 360 × 640, la préparation ne défile pas pour un match déjà à l’écran (${vu?.defile ?? '?'} px)`,
    juste(vu) && vu.defile === 0 || (console.log('        ', JSON.stringify(vu)), false));
  check(`et amène sous les boutons un match hors de vue (${loin?.defile ?? '?'} px)`,
    juste(loin) && loin.defile > 0 && loin.sousBoutons
    || (console.log('        ', JSON.stringify(loin)), false));
}

/* **Entre l'affiche et ENTRER EN FILE, rien que ce qui reste à décider**
   (lot 6, critique de la partie B). À 360 × 640, la préparation s'arrêtait
   sur l'affiche du match : ENTRER EN FILE était 150 px sous le bord, derrière
   deux phrases qui redisaient les stickers (« comptera au classement » sous
   CLASSÉ, « le double d'écharpes » sous ×2) et une rubrique TA TRIBUNE qui,
   chez soi, n'a rien à faire choisir. Chez soi, le camp se lit maintenant
   sur l'affiche (« TA TRIBUNE » sur son club), les phrases sont dans les
   règles du « i », et la rangée d'entrée se colle au bas de la préparation
   dans le bloc du match choisi.

   On regarde à 360 × 640, là où le défaut a été vu, et sans rien faire
   défiler : le bouton entier à l'écran, rien entre l'affiche et lui, le
   camp sur l'affiche, rien de lisible sous la rangée. **Puis la rangée
   elle-même**, qu'une affiche courte (ici, pas de blason en base) laisserait
   à sa place sans jamais la coller : une cale glissée entre l'affiche et elle
   la repousse sous le bord, et elle doit tenir au bas de l'écran ; une cale
   après le match, la liste défilée au-delà, et elle doit partir avec son
   match — collée à la page, elle resterait sous les autres matchs, où elle
   se lirait comme la leur. **Enfin le « i »** : ses règles viennent sous les
   yeux, et disent ce que les phrases disaient. */
{
  const avant = A.page.viewport();
  await A.page.setViewport({ width: 360, height: 640 });
  await dodo(200);
  const LIRE = () => {
    const prepa = document.getElementById('prepa');
    const port = prepa.getBoundingClientRect();
    const choisi = document.querySelector('#prepaCorps .mt.on');
    const b = document.getElementById('entrer');
    const rang = b?.closest('.entree');
    const q = rang?.getBoundingClientRect();
    const r = b?.getBoundingClientRect();
    /* Ce que la rangée couvre : un texte de la préparation, hors d'elle et
       hors d'un panneau replié, dont une ligne croise sa bande sombre (le
       fondu du haut, huit pixels, laisse voir ce qui passe dessous). */
    const couvre = [];
    if (q) {
      const marche = document.createTreeWalker(document.getElementById('prepaCorps'), NodeFilter.SHOW_TEXT);
      for (let n = marche.nextNode(); n; n = marche.nextNode()) {
        if (!n.nodeValue.trim() || rang.contains(n) || n.parentElement?.closest('[hidden]')) continue;
        const plage = document.createRange();
        plage.selectNodeContents(n);
        if ([...plage.getClientRects()].some((t) => t.width && t.top < q.bottom - 1 && q.top + 8 < t.bottom
          && t.bottom > port.top && t.top < port.bottom)) couvre.push(n.nodeValue.trim().slice(0, 30));
      }
    }
    const regles = document.getElementById('regles');
    const rr = regles && !regles.hidden ? regles.getBoundingClientRect() : null;
    return { defile: Math.round(prepa.scrollTop), port: [Math.round(port.top), Math.round(port.bottom)],
      entrer: r ? [Math.round(r.top), Math.round(r.bottom)] : null, actif: Boolean(b && !b.disabled),
      rangee: q ? [Math.round(q.top), Math.round(q.bottom)] : null,
      suivant: choisi?.nextElementSibling?.matches('.entree') ?? false,
      marques: choisi ? [...choisi.querySelectorAll('.tbf-affiche-club')]
        .map((c) => c.querySelector('.tribune-mienne')?.textContent.trim() ?? '') : [],
      regles: rr ? [Math.round(rr.top), Math.round(rr.bottom)] : null,
      dit: regles?.textContent.replace(/\s+/g, ' ') ?? '',
      couvre };
  };
  const aLEcran = (v) => Boolean(v?.entrer) && v.entrer[0] >= v.port[0] && v.entrer[1] <= v.port[1];
  /* Posée une fois dans la page : les deux mesures sous cale la rappellent
     entre la pose de la cale et son retrait. */
  await A.page.evaluate(`window.__lirePrepa = ${LIRE}`);

  await A.page.evaluate(() => { document.getElementById('prepa').scrollTop = 0; });
  const vu = await A.page.evaluate(() => window.__lirePrepa());
  check(`à 360 × 640, chez soi, ENTRER EN FILE est à l’écran sans rien faire défiler (${
    vu.entrer?.join('–') ?? 'absent'} dans ${vu.port.join('–')})`,
  vu.defile === 0 && vu.actif && aLEcran(vu) || (console.log('        ', JSON.stringify(vu)), false));
  check('rien entre l’affiche et lui : ni phrase, ni rubrique d’un camp qui ne se choisit pas',
    vu.suivant || (console.log('        ', JSON.stringify(vu)), false));
  check(`l’affiche dit le camp : « TA TRIBUNE » sur Sion, et sur lui seul (${JSON.stringify(vu.marques)})`,
    vu.marques.length === 2 && vu.marques[0] === 'TA TRIBUNE' && vu.marques[1] === '');
  check(`la rangée d’entrée ne cache rien de lisible (${vu.couvre.join(' | ') || 'rien'})`,
    vu.couvre.length === 0);

  /* Repoussée sous le bord par une cale entre l'affiche et elle. */
  const colle = await A.page.evaluate(() => {
    const choisi = document.querySelector('#prepaCorps .mt.on');
    const cale = document.createElement('div');
    cale.style.height = '400px';
    choisi.after(cale);
    document.getElementById('prepa').scrollTop = 0;
    const v = window.__lirePrepa();
    cale.remove();
    return v;
  });
  check(`repoussée sous le bord, la rangée tient au bas de l’écran (${colle.rangee?.join('–') ?? 'absente'})`,
    aLEcran(colle) && colle.rangee && Math.abs(colle.rangee[1] - colle.port[1]) <= 1
    || (console.log('        ', JSON.stringify(colle)), false));

  /* La liste défilée au-delà du match choisi. */
  const partie = await A.page.evaluate(() => {
    const bloc = document.querySelector('#prepaCorps .match-choisi');
    const prepa = document.getElementById('prepa');
    if (!bloc) return null;
    const cale = document.createElement('div');
    cale.style.height = '1200px';
    bloc.after(cale);
    prepa.scrollTop = 0;
    prepa.scrollTop = bloc.getBoundingClientRect().bottom - prepa.getBoundingClientRect().top + 40;
    const v = window.__lirePrepa();
    cale.remove();
    prepa.scrollTop = 0;
    return v;
  });
  check(`la liste défilée au-delà du match, la rangée part avec lui (${partie?.entrer?.join('–') ?? 'absente'})`,
    Boolean(partie?.entrer) && partie.defile > 0 && partie.entrer[1] <= partie.port[0]
    || (console.log('        ', JSON.stringify(partie)), false));

  /* Le « i » : ses règles sous les yeux, au-dessus du bord, et ce qu'elles
     disent — la phrase du serveur, le double, le camp imposé. */
  await A.page.evaluate(() => {
    document.getElementById('prepa').scrollTop = 0;
    document.querySelector('[data-regles]')?.click();
  });
  await dodo(100);
  const lu = await A.page.evaluate(() => window.__lirePrepa());
  check(`le « i » touché, ses règles viennent sous les yeux (${lu.regles?.join('–') ?? 'fermées'} dans ${lu.port.join('–')})`,
    Boolean(lu.regles) && lu.regles[0] >= lu.port[0] && lu.regles[1] <= lu.port[1]
    || (console.log('        ', JSON.stringify(lu)), false));
  check('et elles disent ce que valait la phrase du dessus : classé, le double, le camp',
    /comptera au classement/.test(lu.dit) && /rapporte le double/.test(lu.dit)
      && /Tu es chez toi\s*:\s*Sion/.test(lu.dit)
    || (console.log('        règles :', lu.dit), false));
  await A.page.evaluate(() => {
    if (S.regles) document.querySelector('[data-regles]')?.click();
    document.getElementById('prepa').scrollTop = 0;
  });
  await A.page.setViewport(avant);
  await dodo(150);
}

/* **Le bandeau d'annonce** de l'administration : `nav.js` le pose en tête
   de la colonne, où la flèche et le menu flottants en couvraient les deux
   bouts (et, en partie, il repoussait la rangée du HUD hors de leurs
   cases). La page le range sous son titre en préparation, sous les deux
   rangées du HUD en partie — après le ticket terrain (`#filLigne`), comme
   `nav.js` le fait au Virage : posé entre les deux, il séparait le score du
   vrai match de celui de la corde. On le pose comme `nav.js` le pose, puis
   on regarde où il finit. */
const poserAnnonce = (page) => page.evaluate(() => {
  const b = document.createElement('div');
  b.className = 'tbf-annonce ton-info';
  b.id = 'annonceBanc';
  b.textContent = 'Annonce du banc : maintenance ce soir à 23 h.';
  const haut = document.querySelector('#app > .tbf-haut-jeu');
  if (haut) haut.after(b); else document.getElementById('app').prepend(b);
});
const lireAnnonce = (page) => page.evaluate(async () => {
  await new Promise((r) => { setTimeout(r, 80); });
  const b = document.getElementById('annonceBanc');
  if (!b) return null;
  const r = b.getBoundingClientRect();
  const couvre = ['.tbf-retour', '.tbf-burger'].some((s) => {
    const q = document.querySelector(s)?.getBoundingClientRect();
    return Boolean(q) && r.left < q.right && q.left < r.right && r.top < q.bottom && q.top < r.bottom;
  });
  const apres = b.previousElementSibling;
  const vu = { sousTitre: Boolean(apres?.matches('#prepa > .top')),
    sousHud: Boolean(apres?.matches('#jeu > #filLigne')
      && apres.previousElementSibling?.matches('.tbf-hudm')), couvre };
  b.remove();
  document.getElementById('jeu').removeAttribute('data-annonce');
  return vu;
});
{
  await poserAnnonce(A.page);
  const vu = await lireAnnonce(A.page);
  check('le bandeau d’annonce se range sous le titre de la préparation, hors des deux boutons',
    vu?.sousTitre === true && vu.couvre === false
    || (console.log('        ', JSON.stringify(vu)), false));
}

/* **Un refus d'entrer en file** (lot 6) : un match reporté ou annulé depuis
   que la liste s'est chargée n'est plus proposé, mais une page restée
   ouverte peut encore l'envoyer, et le serveur répond
   `duel.error.fixture_annule`. La page le disait « Refusé par le serveur :
   duel.error.fixture_annule », sous le voile « Dans la file » qui restait
   posé : on ne pouvait pas choisir l'autre match que le message demandait.
   Le refus est rejoué tel que la socket le livre, sans entrer en file pour
   de bon. */
{
  const vu = await A.page.evaluate(async () => {
    S.enFile = true;
    voile('Dans la file', 'Recherche d’adversaires…', { texte: 'Quitter la file', action: quitterFile });
    socket.listeners('nvn:error').forEach((f) => f({ code: 'duel.error.fixture_annule' }));
    await new Promise((r) => { setTimeout(r, 400); });
    return { voile: document.getElementById('voile').classList.contains('on'), enFile: S.enFile,
      toast: document.getElementById('toast').textContent.trim(),
      choisi: Boolean(document.querySelector('#prepaCorps .mt.on')) };
  });
  check('un refus d’entrer en file retire le voile de la file',
    vu.voile === false && vu.enFile === false || (console.log('        ', JSON.stringify(vu)), false));
  check(`et il dit en clair ce qui reste ouvert (${vu.toast})`,
    /reporté ou annulé/.test(vu.toast) && !/Refusé par le serveur/.test(vu.toast) && vu.choisi);
}

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
    /* Les règles du « i » : c'est là que la page dit pourquoi (lot 6). */
    regles: document.getElementById('regles')?.textContent.replace(/\s+/g, ' ') ?? '',
  }));
};

const miens = await portee('miens');
check('par défaut, seuls les matchs de ses clubs sont proposés',
  miens.matchs.length === 1 && /Sion/.test(miens.matchs[0]));
check('et celui-là porte le badge du double', miens.doubles === 1);
check('la page explique pourquoi, dans les règles du « i »', /rapporte le double/.test(miens.regles)
  || (console.log('        règles :', miens.regles), false));

const tousM = await portee('tous');
check('« tous les matchs » en propose davantage', tousM.matchs.length === 2);
check('dont un match sans club suivi', tousM.matchs.some((m) => /Lugano/.test(m)));
check('et un seul porte le badge du double', tousM.doubles === 1);

/* --------------------------------------------------------- la tribune

   Les deux camps d'un duel sont les deux clubs du match. Le premier joueur
   suit Sion, qui reçoit ; le second suit Bâle. Aucun des deux n'a de choix à
   faire, et c'est ce qu'on éprouve d'abord : un joueur chez lui ne doit pas
   voir de boutons, seulement le nom de sa tribune — sur l'affiche, le
   sticker « TA TRIBUNE » sous son club ; dans les règles, le pourquoi. */

const chezMoi = await A.page.evaluate(() => ({
  boutons: document.querySelectorAll('[data-camp]').length,
  marque: [...document.querySelectorAll('.mt.on .tbf-affiche-club')]
    .filter((c) => c.querySelector('.tribune-mienne')).map((c) => c.querySelector('b')?.textContent.trim()),
  regles: document.getElementById('regles')?.textContent.replace(/\s+/g, ' ') ?? '',
}));
check('chez soi, aucune tribune à choisir', chezMoi.boutons === 0);
check(`mais on dit laquelle est la sienne (${chezMoi.marque.join(', ') || 'aucune marquée'})`,
  chezMoi.marque.length === 1 && chezMoi.marque[0] === 'Sion' && /Tu es chez toi\s*:\s*Sion/.test(chezMoi.regles)
  || (console.log('        règles :', chezMoi.regles), false));

/* Et sur un match dont aucun club n'est suivi, l'inverse : deux boutons, et
   l'entrée fermée tant qu'on n'a pas dit pour qui l'on vient chanter. */

await portee('tous');
const neutre = await A.page.evaluate(() => {
  const m = [...document.querySelectorAll('[data-fixture]')]
    .find((x) => /Lugano/.test(x.textContent));
  m?.click();
  return {
    boutons: [...document.querySelectorAll('[data-camp]')].map((b) => b.textContent.trim()),
    /* Deux bâches de club (lot 6) : l'écharpe du club en bord bas. Ces
       deux clubs n'ont pas de couleurs en base : aucune ne doit s'inventer. */
    clubs: [...document.querySelectorAll('[data-camp]')].map((b) => ({
      brique: b.classList.contains('tbf-plaque--club'), e1: b.style.getPropertyValue('--e1') })),
    entrerActif: !document.getElementById('entrer')?.disabled,
    /* Fermée, la rangée d'entrée reste à sa place (lot 6) : collée, elle
       couvrirait les bâches du camp sans rien offrir. Et l'affiche ne
       marque aucun camp tant qu'on n'a pas choisi. */
    position: getComputedStyle(document.getElementById('entrer')?.closest('.entree') ?? document.body).position,
    marques: document.querySelectorAll('.mt.on .tribune-mienne').length,
    stade: window.__lireStade(),
  };
});
/* **Un autre match, un autre stade** : l'affiche suit le match choisi, et
   ne garde pas celui du précédent. Les deux matchs de la base tombent sur
   deux lieux différents — sans quoi ce contrôle ne prouverait rien. */
{
  const attendu = stadeDuMatch(8);
  check(`un autre match choisi, son affiche montre son stade à lui (${neutre.stade.nom ?? 'rien'}, et non ${
    stadeAnnonce.nom})`,
  neutre.stade.match === 8 && attendu.id !== stadeAnnonce.id
      && neutre.stade.id === attendu.id && neutre.stade.nom === attendu.nom
    || (console.log('        vu', neutre.stade.id, '· attendu', attendu.id), false));
}
check('sans club dans le match, les deux tribunes sont proposées',
  neutre.boutons.length === 2 && neutre.boutons.some((n) => /Lugano/.test(n)));
check('en deux bâches de club, sans couleur inventée quand le club n’en a pas',
  neutre.clubs.length === 2 && neutre.clubs.every((c) => c.brique && c.e1 === '')
  || (console.log('        ', JSON.stringify(neutre.clubs)), false));
check('et l’entrée reste fermée tant qu’on n’a pas choisi',
  neutre.entrerActif === false);
check(`fermée, sa rangée reste à sa place, et l’affiche ne marque aucun camp (${neutre.position}, ${neutre.marques})`,
  neutre.position === 'static' && neutre.marques === 0);

const apresChoix = await A.page.evaluate(() => {
  document.querySelector('[data-camp="1"]')?.click();
  return {
    choisi: document.querySelector('[data-camp="1"]')?.classList.contains('on'),
    entrerActif: !document.getElementById('entrer')?.disabled,
    position: getComputedStyle(document.getElementById('entrer')?.closest('.entree') ?? document.body).position,
    marque: [...document.querySelectorAll('.mt.on .tbf-affiche-club')]
      .findIndex((c) => c.querySelector('.tribune-mienne')),
  };
});
check('choisir une tribune la marque', apresChoix.choisi === true);
check('et ouvre l’entrée en file', apresChoix.entrerActif === true);
check(`ouverte, la rangée se colle, et l’affiche marque le camp choisi (${apresChoix.position}, club ${apresChoix.marque})`,
  apresChoix.position === 'sticky' && apresChoix.marque === 1);

/* **Le choix se déplie sous le match**, pas au bas de la page.

   La liste fait soixante lignes depuis qu'elle montre tout ce qui se joue : on
   cliquait un match en haut, et ce qu'il fallait faire ensuite se trouvait
   mille pixels plus bas, hors de l'écran. Ce contrôle regarde **où** sont les
   boutons, pas s'ils existent — c'est toute la question. Le bouton d'entrée
   suit ce qui se déplie, dans le bloc du match choisi (`.match-choisi`,
   lot 6) : c'est à ce bloc qu'il reste collé. */
const place = await A.page.evaluate(() => {
  const choisi = document.querySelector('.mt.on');
  const sous = choisi?.nextElementSibling;
  const entrer = document.getElementById('entrer');
  const bloc = choisi?.parentElement;
  return {
    juste: sous?.classList.contains('souscarte') ?? false,
    dedans: Boolean(bloc?.matches('.match-choisi') && bloc.contains(entrer) && sous
      && sous.compareDocumentPosition(entrer) & Node.DOCUMENT_POSITION_FOLLOWING),
    // Et pas d'un écran de haut : le geste suivant doit être sous le doigt.
    ecart: entrer && choisi
      ? Math.round(entrer.getBoundingClientRect().top - choisi.getBoundingClientRect().bottom)
      : null,
  };
});
check('le choix se déplie juste sous le match', place.juste === true);
check('et le bouton d’entrée le suit, dans le bloc du match choisi', place.dedans === true);
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
    /* **Jamais de points de suspension sur le nom de quelqu'un** (lot 6). À
       cinq places par gradin, un siège n'a que soixante pixels : le gradin
       de la brique abrégeait « LEGRANDD… ». Le vestiaire porte la pièce des
       noms entiers (`.tbf-gradins--entiers`), qui passe le nom à la ligne.
       Un gradin de cinq aux noms longs, rendu par la page elle-même dans la
       salle, à la largeur d'un téléphone. */
    const noms = await A.page.evaluate(() => {
      const s = document.querySelector('.salle');
      const essai = document.createElement('div');
      essai.style.width = '332px';
      essai.innerHTML = tribuneAttente('ESSAI', ['LeGrandDéplacement', 'François Gonçalves',
        'Tambour_Nord_Officiel', 'Bâche-Haute', 'Élodie'].map((nom) => ({ nom })), 5, 'FC SION', 'moi');
      s.appendChild(essai);
      const vu = [...essai.querySelectorAll('.tbf-siege-nom')].map((n) => ({ nom: n.textContent,
        coupe: n.scrollWidth > n.clientWidth + 1 || getComputedStyle(n).whiteSpace === 'nowrap' }));
      essai.remove();
      return vu;
    });
    const coupes = noms.filter((n) => n.coupe).map((n) => n.nom);
    check(`au vestiaire, les noms longs passent à la ligne au lieu de s’abréger (${coupes.join(', ') || 'aucun coupé'})`,
      noms.length === 5 && coupes.length === 0);
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

/* **Et le duel se joue dans le stade que l'affiche annonçait** — la promesse
   de la préparation. Le lieu d'un duel se tirait sur son identifiant, au coup
   d'envoi, et rien ne pouvait l'annoncer avant ; il est celui du match depuis
   le 6 octobre 2026. On lit la vue, que l'arène, l'affiche du coup d'envoi et
   « ce que tu portes » lisent, et le nom posé au pied de l'arène. */
{
  await jusqua(() => A.page.evaluate(() => Boolean(S.vue?.stade
    && document.getElementById('lieu')?.textContent.trim())), 6000);
  const joue = await A.page.evaluate(() => ({ id: S.vue?.stade?.id ?? null, nom: S.vue?.stade?.nom ?? null,
    pied: document.getElementById('lieu')?.textContent.trim() ?? '' }));
  check(`le duel se joue dans le stade que l’affiche annonçait (${joue.nom ?? 'aucun'})`,
    Boolean(stadeAnnonce.id) && joue.id === stadeAnnonce.id && joue.nom === stadeAnnonce.nom
      && joue.pied === stadeAnnonce.nom
    || (console.log('        annoncé', stadeAnnonce.id, '· joué', joue.id, '· au pied', joue.pied), false));
}

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
        /* La hauteur, que rien ne mesurait : des cartes d'un tiers de la
           colonne faisaient deux rangées plus hautes que la fenêtre, et
           l'affiche se lisait en faisant défiler — en six secondes. */
        defileV: (() => { const c = e.querySelector('.camps');
          return c ? c.scrollHeight > c.clientHeight + 1 : false; })(),
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
    check('ni en bas : les deux équipes se lisent sans faire défiler', !large.defileV);
    await A.page.setViewport(avant);
  }

  /* **La ligne de forme tient dans sa propre largeur, à l'étroit aussi.**

     À 320 × 568, à trois par camp, le résumé « 3 V · 1 D · 1 N » ne passait
     pas à la ligne et glissait sous le premier Fanzzy de la rangée : « 3 V ·
     1 », coupé net par son cadre. Rien ne le voyait — l'audit ne cherche
     que les coupes à points de suspension, et cette suite ne regardait
     l'affiche qu'en 1 contre 1, à 400 px et à 1 440. Et en 1 contre 1, la
     forme, qui ne rétrécit pas, prenait au nom toute sa place :
     « LeGrandDéplacement » se lisait sur quatre lignes, cassé au milieu.

     On repose donc l'affiche, dans la forme que le serveur sert
     (`nvn:affiche`), à trois par camp puis en 1 contre 1 avec deux noms
     longs, et l'on mesure les boîtes : aucun morceau de la forme sous un
     portrait ni hors de la colonne, aucun nom cassé au milieu d'un mot. Et
     le contraire, pour qu'une forme muette ne passe pas pour une forme
     rangée : à 320, le résumé des pastilles se tait mais « PREMIER DUEL »
     se lit encore, et à 412 le résumé se lit à côté de ses pastilles.
     L'affiche servie est remise en place après. */
  {
    const avant = A.page.viewport();
    const sauve = await A.page.evaluate(() => {
      const e = document.getElementById('affiche');
      return { camps: document.getElementById('afficheCamps').innerHTML,
        lieu: document.getElementById('afficheLieu').innerHTML,
        fond: e.dataset.fond ?? null, image: e.style.getPropertyValue('--fond') };
    });
    const poser = (format) => A.page.evaluate((format) => {
      const F = [['win', 2, 1], ['loss', 0, 1], ['win', 3, 2], ['draw', 1, 1], ['win', 2, 0]]
        .map(([issue, pour, contre]) => ({ issue, pour, contre }));
      const fanzzy = ['TR32', 'MS30', 'TR33'].map((id) => ({ id, nom: id, stade: 1 }));
      const j = (side, nom, forme, bot = false) => ({ userId: nom, nom, side, bot, fanzzy, forme });
      montrerAffiche({ joueurs: format === 'trois'
        ? [j(0, 'Sédunois', F), j(0, 'Tambour_Nord', F.slice(0, 4)), j(0, 'Supporter d’appoint', [], true),
          j(1, 'Bâloise', F), j(1, 'LeGrandDéplacement', F.slice(0, 4)), j(1, 'Sifflet', [])]
        : [j(0, 'LeGrandDéplacement', F), j(1, 'Mégaphone_Sud_1907', F.slice(0, 4))] });
    }, format);
    const mesurer = () => A.page.evaluate(() => {
      const e = document.getElementById('affiche');
      const colonne = e.querySelector('.camps').getBoundingClientRect();
      const coupe = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5
        && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
      const fautes = [];
      for (const f of e.querySelectorAll('.forme')) {
        const ligne = f.closest('.joueur') ?? f.closest('.camp-bloc');
        const portraits = [...ligne.querySelectorAll('.fz-aff')].map((v) => v.getBoundingClientRect());
        for (const m of f.children) {
          if (!m.getClientRects().length) continue; // retiré de l'écran : il ne couvre rien
          const b = m.getBoundingClientRect();
          const quoi = m.textContent.trim();
          if (portraits.some((v) => coupe(b, v))) fautes.push(`« ${quoi} » sous un portrait`);
          if (b.left < colonne.left - 0.5 || b.right > colonne.right + 0.5) fautes.push(`« ${quoi} » hors de la colonne`);
        }
      }
      /* Un nom cassé au milieu d'un mot prend plus de lignes qu'il n'a de
         mots : « Supporter d'appoint · BOT » peut en prendre trois, pas
         « LeGrandDéplacement » deux. */
      for (const b of e.querySelectorAll('.camp-bloc .qui b')) {
        const s = getComputedStyle(b);
        const ligneH = parseFloat(s.lineHeight) || parseFloat(s.fontSize) * 1.2;
        const lignes = Math.round(b.getBoundingClientRect().height / ligneH);
        const mots = b.textContent.trim().split(/[\s·-]+/).filter(Boolean).length;
        if (lignes > mots) fautes.push(`« ${b.textContent.trim()} » cassé sur ${lignes} lignes`);
      }
      const lus = [...e.querySelectorAll('.forme small')].filter((s) => s.getClientRects().length)
        .map((s) => s.textContent.trim());
      /* « À côté » : le résumé commence sur la ligne de ses pastilles. */
      const cote = [...e.querySelectorAll('.forme i ~ small')].filter((s) => s.getClientRects().length)
        .every((s) => { const i = s.parentElement.querySelector('i').getBoundingClientRect();
          const r = s.getBoundingClientRect(); return r.top < i.bottom && r.bottom > i.top; });
      return { fautes, lus, cote };
    });
    /* Les vignettes glissent en cascade (`.tbf-glisse`, 320 ms après au plus
       800 ms de retard) : on mesure une fois posées. */
    await A.page.setViewport({ width: 320, height: 568 });
    await poser('trois');
    await dodo(1300);
    const etroit = await mesurer();
    await A.page.setViewport({ width: 412, height: 915 });
    await dodo(300);
    const moyen = await mesurer();
    await A.page.setViewport({ width: 320, height: 568 });
    await poser('un');
    await dodo(1300);
    const seul = await mesurer();
    await A.page.setViewport(avant);
    await A.page.evaluate((sauve) => {
      const e = document.getElementById('affiche');
      document.getElementById('afficheCamps').innerHTML = sauve.camps;
      document.getElementById('afficheLieu').innerHTML = sauve.lieu;
      if (sauve.fond !== null) { e.dataset.fond = sauve.fond; e.style.setProperty('--fond', sauve.image); }
    }, sauve);
    check('à 320 × 568, à trois par camp, la forme ne passe sous aucun portrait',
      etroit.fautes.length === 0 || (console.log('        ', etroit.fautes.join(' ; ')), false));
    /* Le résumé des pastilles s'y tait (il allongerait chaque rangée d'une
       ligne qui les redit) ; « PREMIER DUEL », seul dans sa forme, reste. */
    check('le résumé des pastilles s’y tait, « PREMIER DUEL » s’y lit encore',
      etroit.lus.length === 1 && etroit.lus[0] === 'PREMIER DUEL'
      || (console.log('        lus :', JSON.stringify(etroit.lus)), false));
    check('à 412 px, le résumé se lit à côté de ses pastilles',
      moyen.fautes.length === 0 && moyen.cote && moyen.lus.filter((t) => / V/.test(t)).length === 4
      || (console.log('        ', JSON.stringify(moyen)), false));
    check('en 1 contre 1 à 320, un nom long reste entier, et sa forme ne couvre rien',
      seul.fautes.length === 0 || (console.log('        ', seul.fautes.join(' ; ')), false));
  }
  }

  /* Elle se retire seule. Une affiche qui resterait à l'écran cacherait la
     corde pendant qu'elle bouge, et le joueur perdrait le début du duel sans
     comprendre pourquoi. */
  await new Promise((r) => { setTimeout(r, 6400); });
  const partie = await A.page.evaluate(() => document.getElementById('affiche').hidden);
  check('puis se retire d’elle-même', partie === true);

  /* **La rumeur suit la partie** (lot 6) : celle du vestiaire pendant
     l'attente, l'entrée quand l'affiche se retire — une fois —, puis la
     phase de jeu ; **pas de phase de jeu avant l'entrée**, sans quoi la
     rumeur serait déjà montée et l'entrée ne s'entendrait plus. */
  await dodo(300);
  const rumeurs = await A.page.evaluate(() => window.__rumeurs ?? []);
  const entree = rumeurs.indexOf('entree');
  check(`la rumeur du vestiaire, puis l’entrée en tribune (${[...new Set(rumeurs)].join(', ')})`,
    rumeurs.some((r) => r === 'vestiaire' || r === 'arrivee') && entree >= 0
    && rumeurs.filter((r) => r === 'entree').length === 1);
  check('et la phase de jeu seulement après l’entrée',
    rumeurs.includes('jeu') && !rumeurs.slice(0, entree).includes('jeu'));
}

check('l\u2019horloge démarre à cinq minutes', /^[45]:/.test(ouvert.horloge));

/* **Les boutons de la bascule se touchent, dans le duel.**

   Ils portaient la classe `cote`, que le duel emploie déjà pour les deux
   moitiés du terrain : ils devenaient deux moitiés d'écran transparentes,
   et l'épreuve ne se jouait pas. Le contrôle des épreuves ne pouvait pas
   le voir — il les joue sur une page neutre, sans la feuille du duel. On
   ouvre donc la bascule **ici**, sur la vraie page, et l'on demande au
   navigateur ce qu'il y a sous le doigt au centre de chaque bouton. */
{
  const sous = await A.page.evaluate(async () => {
    const signaux = Array.from({ length: 10 }, (_, i) => ({ cote: i % 2, contre: false }));
    ouvrirGeste('bascule', { bascule: { signaux, pas: 820, fenetre: 640, ms: 10000 } });
    await new Promise((r) => setTimeout(r, 2500));
    const out = [...document.querySelectorAll('#miniZone [data-k]')].map((b) => {
      const r = b.getBoundingClientRect();
      const dessous = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { h: Math.round(r.height), w: Math.round(r.width), touche: dessous === b || b.contains(dessous) };
    });
    fermerGeste([]);
    return out;
  });
  check(`les deux boutons de la bascule se touchent dans le duel (${sous.map((b) => `${b.w}×${b.h}`).join(', ')})`,
    sous.length === 2 && sous.every((b) => b.touche && b.h >= 44)
    || (console.log('        ', JSON.stringify(sous)), false));
}

/* **Le stade couvre le terrain.** Il est couché d'un quart de tour pour que
   ses tribunes bordent la corde, et les règles qui le couchent perdaient
   contre celles du décor debout, écrites plus bas : l'image ne se voyait
   que dans une bande à gauche. On mesure donc sa boîte, rotation comprise,
   contre celle de l'arène. */
{
  const couvre = await A.page.evaluate(() => {
    const img = document.querySelector('#stade .tbf-stade-fond');
    const ar = document.getElementById('arene')?.getBoundingClientRect();
    if (!img || !ar) return null;
    const r = img.getBoundingClientRect();
    return { ok: r.left <= ar.left + 2 && r.right >= ar.right - 2
      && r.top <= ar.top + 2 && r.bottom >= ar.bottom - 2,
      img: [r.left, r.top, r.right, r.bottom].map(Math.round),
      arene: [ar.left, ar.top, ar.right, ar.bottom].map(Math.round) };
  });
  check('le stade couvre tout le terrain, pas une bande sur le côté', couvre?.ok === true
    || (console.log('        image', couvre?.img, 'arène', couvre?.arene), false));
  /* Et sur un écran large, où l'arène est couchée : c'est là que la bande
     à gauche a été vue, et le téléphone ne la montrait pas de la même façon. */
  const avant = A.page.viewport();
  await A.page.setViewport({ width: 1440, height: 900 });
  await new Promise((r) => setTimeout(r, 150));
  const large = await A.page.evaluate(() => {
    const img = document.querySelector('#stade .tbf-stade-fond');
    const ar = document.getElementById('arene')?.getBoundingClientRect();
    if (!img || !ar) return null;
    const r = img.getBoundingClientRect();
    return { ok: r.left <= ar.left + 2 && r.right >= ar.right - 2
      && r.top <= ar.top + 2 && r.bottom >= ar.bottom - 2,
      img: [r.left, r.top, r.right, r.bottom].map(Math.round),
      arene: [ar.left, ar.top, ar.right, ar.bottom].map(Math.round) };
  });
  await A.page.setViewport(avant);
  check('et sur un grand écran aussi', large?.ok === true
    || (console.log('        image', large?.img, 'arène', large?.arene), false));
}
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

/* **Le chant de son geste**, au milieu, porte le sceau de sa famille : entier,
   à la couleur de la famille, sans toucher le coût. */
{
  const sien = await A.page.evaluate(() => {
    const cartes = [...document.querySelectorAll('#chants [data-chant]')];
    const i = cartes.findIndex((c) => c.hasAttribute('data-sien'));
    const c = cartes[i];
    const s = c?.querySelector('.carte-sien');
    const r = s?.getBoundingClientRect();
    const cout = c?.querySelector('.tbf-carte-cout')?.getBoundingClientRect();
    // Ce qui est réellement au centre du sceau : lui, et pas une voisine.
    const dessus = r ? document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) : null;
    return { i, n: cartes.filter((x) => x.hasAttribute('data-sien')).length,
      geste: S.vue.moi.sienGeste, gesteCarte: S.vue.chants[i]?.gest,
      famille: S.vue.chants[i]?.sien?.famille ?? null,
      actif: (S.vue.moi.fanzzy ?? []).find((f) => f.actif)?.type ?? null,
      vu: Boolean(r && r.width > 0 && getComputedStyle(s).display !== 'none'),
      chemin: s?.querySelector('path')?.getAttribute('d') ?? '',
      entier: Boolean(dessus && s.contains(dessus)),
      separe: Boolean(r && cout && (r.left >= cout.right || r.right <= cout.left)),
      label: c?.getAttribute('aria-label') ?? '' };
  });
  check(`le chant du geste de son Fanzzy est au milieu, et il est seul marqué (${sien.geste}, place ${sien.i + 1})`,
    sien.i === 2 && sien.n === 1 && sien.gesteCarte === sien.geste && sien.famille === sien.actif
    || (console.log('        ', JSON.stringify(sien)), false));
  check('il porte le sceau de sa famille, entier, sans toucher le coût',
    sien.vu && sien.chemin.length > 10 && sien.entier && sien.separe
    || (console.log('        ', JSON.stringify(sien)), false));
  check(`et il le dit à qui ne le voit pas (« ${sien.label} »)`, /le geste de ton Fanzzy$/.test(sien.label));
  if (process.env.CAPTURE) {
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    await A.page.screenshot({ path: join(tmpdir(), 'nvn-chants.png') });
  }
}

/* ------------------------------------------ les Fanzzy ont un visage */

/**
 * Un nom seul ne dit pas qui est en jeu. Chaque Fanzzy porte donc son
 * portrait — dessiné pour les trois illustrés, silhouette pour les autres.
 *
 * **Seul celui qui est en tribune respire** (lot 6). `fx.js` fait respirer
 * tout portrait, et l'écran en comptait dix sans fin — trois portraits, les
 * dessins de la main, le point du direct — quand la règle en tolère trois.
 * Le banc porte `data-fige` : on vérifie les deux moitiés, sans quoi figer
 * tout le monde passerait pour une réparation.
 */
{
  const vignettes = await A.page.evaluate(() => {
    const tuiles = [...document.querySelectorAll('#equipe .fz')];
    return tuiles.map((t) => {
      const el = t.querySelector('.vig .illu, .vig [data-vivant]');
      if (!el) return null;
      return {
        actif: t.classList.contains('actif'),
        fige: Boolean(el.closest('[data-fige]')),
        animation: getComputedStyle(el).animationName,
      };
    });
  });
  check('chaque Fanzzy du deck a sa vignette',
    vignettes.length === 3 && vignettes.every(Boolean));
  check('celui qui est en tribune respire',
    vignettes.some((v) => v?.actif && !v.fige && /fzsouffle/.test(v.animation))
    || (console.log('        ', JSON.stringify(vignettes)), false));
  check('et le banc est figé',
    vignettes.filter((v) => !v?.actif).every((v) => v?.fige && !/fzsouffle/.test(v.animation))
    || (console.log('        ', JSON.stringify(vignettes)), false));
  /* Le plafond de l'écran : trois animations sans fin, au plus (`FX.sansFin`
     les compte comme la règle les compte). */
  const sansFin = await A.page.evaluate(() => window.FX?.sansFin?.()?.length ?? null);
  check(`l’écran de duel tient sous trois animations sans fin (${sansFin})`,
    sansFin !== null && sansFin <= 3);
}

/* ------------------------------------------------ le HUD de match (lot 6)

   La même rangée qu'au Virage : ma bâche, la plaque de l'horloge et du
   sticker CLASSÉ, la bâche d'en face. Les deux boutons de la barre n'y
   entrent pas : rien du HUD ne doit passer sous eux. Et le bouton de son a
   quitté l'arène — le son se coupe au tiroir. */
{
  const hud = await A.page.evaluate(() => {
    const boites = ['.tbf-retour', '.tbf-burger']
      .map((s) => document.querySelector(s)?.getBoundingClientRect()).filter(Boolean);
    const gene = [...document.querySelectorAll('#jeu .tbf-hudm *')].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width && r.height && boites.some((b) =>
        r.left < b.right - 1 && b.left < r.right - 1 && r.top < b.bottom - 1 && b.top < r.bottom - 1);
    }).map((el) => el.className);
    return {
      hud: Boolean(document.querySelector('#jeu > .score.tbf-hudm')),
      boutons: boites.length,
      gene,
      classe: document.getElementById('modeTag')?.dataset.ton ?? null,
      son: Boolean(document.getElementById('son')),
    };
  });
  check('le duel porte le HUD de match', hud.hud);
  check('rien du HUD ne passe sous la flèche ni sous le menu',
    hud.boutons === 2 && hud.gene.length === 0 || (console.log('        ', JSON.stringify(hud)), false));
  check('CLASSÉ est la face d’or de la plaque', hud.classe === 'or');
  check('le bouton de son a quitté l’arène', hud.son === false);
}

/* **La vue dit qui je suis, et les couleurs du match** (§ 17, lot 6). La
   page reconnaissait son joueur au camp et à la ferveur — trois joueurs du
   même camp en 3 contre 3 — : elle lit maintenant `moi.userId`. Et les
   écharpes de l'arène sont celles des deux clubs : `--e1` pour le mien (le
   foulard, ma moitié de corde, mes barres du bilan), `--eux1` pour celui
   d'en face, sa couleur aussi sur sa bâche du HUD. A suit Sion, qui reçoit. */
{
  const vu = await A.page.evaluate(() => {
    const lisible = (c) => (c ? (window.FX?.lisible?.(c) ?? c) : '');
    const app = document.getElementById('app');
    const eux = document.querySelector('#jeu .tbf-hudm-club[data-tribune=eux]');
    const m = S.matchs.find((x) => x.id === S.vue?.fixture?.id) ?? null;
    const mon = S.vue?.moi?.side ?? 0;
    const servies = (cote) => (S.vue?.fixture?.[cote ? 'awayColors' : 'homeColors']
      ?? m?.[cote ? 'awayColors' : 'homeColors'] ?? [])[0];
    /* Le vestiaire l'a dit aussi (`nvn:file`, `moi`) : on lui fait dire
       autre chose le temps de la lecture, pour voir que c'est bien la vue
       que la page croit. */
    const vestiaire = S.moiId;
    S.moiId = '__vestiaire';
    const id = monId();
    S.moiId = vestiaire;
    return { id, servi: S.vue?.moi?.userId ?? null,
      e1: app.style.getPropertyValue('--e1'), eux1: app.style.getPropertyValue('--eux1'),
      bache: eux?.style.getPropertyValue('--e1') ?? '',
      attendues: [lisible(servies(mon)), lisible(servies(mon ^ 1))] };
  });
  check(`la vue dit qui je suis, et la page le lit (${vu.id})`, vu.servi === U[0] && vu.id === U[0]
    || (console.log('        ', JSON.stringify(vu)), false));
  check(`l’arène et le HUD prennent les couleurs des deux clubs (${vu.e1 || 'rien'} · ${vu.eux1 || 'rien'})`,
    vu.attendues.every(Boolean) && vu.e1 === vu.attendues[0] && vu.eux1 === vu.attendues[1]
    && vu.bache === vu.attendues[1]
    || (console.log('        ', JSON.stringify(vu)), false));
}

/* **Le budget de hauteur** (lot 6) : à 360 × 640 et à 320 × 568, la main et
   les chants sont entiers à l'écran, rien ne défile, et l'arène — la seule
   rangée qui cède — garde au moins 36 % de l'écran à 360 × 640 (elle en
   avait 29 au départ du lot, 33 en partie A ; la direction en vise 45, que
   seuls les écrans plus hauts tiennent). On compte l'arène avec la rangée
   des effets en cours, qui lui prend sa hauteur quand il y en a. */
{
  const avant = A.page.viewport();
  const mesurer = async (w, h) => {
    await A.page.setViewport({ width: w, height: h });
    await dodo(300);
    return A.page.evaluate(() => {
      const r = (id) => document.getElementById(id)?.getBoundingClientRect();
      const entier = (b) => Boolean(b) && b.height > 0 && b.top >= -1 && b.bottom <= innerHeight + 1;
      const effets = r('effets');
      const app = document.getElementById('app');
      return { fenetre: innerHeight, arene: Math.round(r('arene')?.height ?? 0),
        effets: effets?.height ? Math.round(effets.height + 7) : 0,
        main: entier(r('mainCartes')), chants: entier(r('chants')),
        defile: document.documentElement.scrollHeight > innerHeight + 1 || app.scrollHeight > app.clientHeight + 1 };
    });
  };
  const grand = await mesurer(360, 640);
  const petit = await mesurer(320, 568);
  await A.page.setViewport(avant);
  await dodo(300);
  const part = (grand.arene + grand.effets) / grand.fenetre;
  check(`à 360 × 640, l’arène cède avant la main et les chants (${grand.arene} px, ${Math.round(part * 100)} % avec les effets)`,
    grand.main && grand.chants && !grand.defile && part >= 0.36
    || (console.log('        ', JSON.stringify(grand)), false));
  check(`à 320 × 568 aussi : la main et les chants restent entiers (arène ${petit.arene} px)`,
    petit.main && petit.chants && !petit.defile && petit.arene > 0
    || (console.log('        ', JSON.stringify(petit)), false));
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

/**
 * L'équipement change le barème — **mesuré par l'écart, pas par la valeur**.
 *
 * Les deux contrôles comparaient à des nombres absolus : 630 pour le joueur
 * équipé, 560 pour l'autre. Ils tenaient tant qu'aucun stade ne touchait à la
 * pulsation. Or le stade d'un duel se tirait alors sur son identifiant, donc
 * il changeait à chaque partie, et deux des quinze en changeaient : `neige`
 * ajoute 130 ms, `rp-bache` en ajoute 80. Un duel tombé sur la neige lisait
 * donc 690 là où la suite attendait 560 — et les deux contrôles rougissaient
 * ensemble, en accusant l'équipement d'un tirage de stade. Depuis le
 * 6 octobre 2026, le stade est celui du match : le même à chaque passage de
 * cette suite, mais un autre dès que sa base change de match ou qu'une
 * saison ouvre ou ferme un stade — et trois des dix-huit touchent à la
 * pulsation (`caverne` y ajoute 70 ms).
 *
 * Le bon invariant est la **différence entre les deux joueurs** : le stade
 * s'applique aux deux, l'équipement à un seul. Elle vaut exactement ce que les
 * Jumelles donnent, sous la neige comme au Chaudron. Et elle éprouve mieux ce
 * qu'on voulait éprouver — que l'équipement pèse — puisqu'elle ne peut pas
 * passer par accident sur deux barèmes identiques.
 */
const bareme = await A.page.evaluate(() => S.vue?.moi?.gestes);
const baremeB = await B.page.evaluate(() => S.vue?.moi?.gestes?.tempo);
const nu = resoudreGeste({}).tempo;
const JUMELLES = STUFF_BY_ID.get('jumelles').mods;
const equipe = resoudreGeste(JUMELLES).tempo;
const ecartAttendu = equipe.interval - nu.interval;

check('le serveur envoie le barème du geste aux deux écrans',
  Boolean(bareme?.tempo) && Number.isFinite(baremeB?.interval));

check(`et les Jumelles allongent la pulsation de ${ecartAttendu} ms`,
  bareme?.tempo?.interval - baremeB?.interval === ecartAttendu
  || (console.log('        équipé :', bareme?.tempo?.interval,
    '· nu :', baremeB?.interval, '· écart attendu', ecartAttendu), false));

check('et elles élargissent sa fenêtre dans la même proportion',
  Math.abs(bareme?.tempo?.window / baremeB?.window - equipe.window / nu.window) < 0.01
  || (console.log('        équipé :', bareme?.tempo?.window,
    '· nu :', baremeB?.window), false));

/* Le stade s'applique aux deux, et il a le droit de les décaler tous les deux.
   Ce qui ne doit jamais arriver, c'est que le joueur nu soit **plus rapide que
   la base** — il n'existe rien qui raccourcisse la pulsation — ni qu'il
   rattrape l'équipé, ce qui voudrait dire qu'un modificateur a fui d'un joueur
   à l'autre. */
check('le joueur sans équipement n’emprunte rien à son adversaire',
  baremeB?.interval < bareme?.tempo?.interval
  && baremeB?.interval >= GESTURES.tempo.interval
  || (console.log('        nu :', baremeB?.interval,
    '· base', GESTURES.tempo.interval), false));

/* -------------------------------------------------------------- chanter */

const ferveurAvant = await A.page.evaluate(() =>
  S.vue.equipes[S.vue.moi.side][0].ferveur);

/* On choisit **le chant de tempo** : c'est celui dont la suite sait exécuter
   le geste, et c'est son barème qui a été lu juste au-dessus. */
const chantTempo = ouvert.chants.find((c) => /TEMPO/.test(c.geste))?.id;
check('un chant de tempo est offert', Boolean(chantTempo)
  || (console.log('        gestes offerts :',
    ouvert.chants.map((c) => c.geste).join(', ')), false));
/* **Le verdict claque en tampon** (lot 6) : il vient du serveur
   (`verdict`, § 17), la page ne compte aucun seuil. On relève chaque tampon
   posé, et où — dans la fenêtre du geste, ou sur la carte jouée quand la
   réponse est venue trop tard. */
await A.page.evaluate(() => {
  window.__tampons = [];
  // Et le mot que le serveur a servi pour ce chant : le tampon doit être lui.
  window.__servis = [];
  const raconterVrai = raconter;
  // eslint-disable-next-line no-global-assign
  raconter = (e) => {
    if (e?.t === 'chant' && e.side === S.vue?.moi?.side) window.__servis.push(e.verdict ?? null);
    return raconterVrai(e);
  };
  new MutationObserver((lot) => {
    for (const m of lot) for (const n of m.addedNodes) {
      if (n.nodeType !== 1 || !n.matches?.('.tbf-tampon[data-verdict]')) continue;
      window.__tampons.push({ verdict: n.dataset.verdict, mot: n.textContent.trim(),
        ou: n.closest('#miniZone') ? 'fenetre' : n.closest('#chants') ? 'carte' : 'ailleurs' });
    }
  }).observe(document.body, { childList: true, subtree: true });
  /* **Les pulsations, relevées comme le joueur les voit** : l'anneau du pavé
     qui bat (`#ring` prend `beat` ; retirée puis remise dans la même tâche,
     deux mutations pour une pulsation). Posé avant d'ouvrir le geste, pour
     ne pas manquer la première. */
  window.__pulses = [];
  new MutationObserver((ms) => {
    const t = performance.now();
    for (const m of ms) {
      if (m.target.id === 'ring' && m.target.classList.contains('beat')
        && !/\bbeat\b/.test(m.oldValue ?? '')
        && !(window.__pulses.length && t - window.__pulses[window.__pulses.length - 1] < 50)) {
        window.__pulses.push(t);
      }
    }
  }).observe(document.getElementById('miniZone'), { subtree: true, attributes: true,
    attributeFilter: ['class'], attributeOldValue: true });
  /* L'instant que la page prête au pavé (`origine`) : le même que celui du
     chant de la tribune, pour que l'un et l'autre battent ensemble. */
  window.__gestes = [];
  const jouer = window.TBF_GESTE.jouer;
  window.TBF_GESTE.jouer = (kind, gestes, el) => {
    window.__gestes.push({ kind, origine: el?.origine ?? null });
    return jouer(kind, gestes, el);
  };
});
await A.page.evaluate((id) => document.querySelector(`[data-chant="${id}"]`)?.click(),
  chantTempo);
check('le mini-jeu s\u2019ouvre', await jusqua(async () =>
  await A.page.evaluate(() => document.getElementById('mini').classList.contains('on'))));

/* Décompte de trois, puis les pulsations à l'intervalle du joueur : **on tape
   sur ce que l'écran affiche** — la première pulsation de l'anneau, puis la
   grille qu'elle ouvre —, ce qui est exactement le cas d'usage cassé. Le
   pavé ne prend plus les frappes du décompte : taper dès qu'il paraît,
   c'était taper dans le vide. Une attente qui tremble de quelques
   millisecondes, comptée depuis la première pulsation : le moteur refuse
   une régularité mécanique, et des attentes enchaînées dériveraient. */
await jusqua(async () => await A.page.evaluate(() => Boolean(document.getElementById('pad'))), 6000);
const frappe = await A.page.evaluate(async (t) => {
  const dodo = (ms) => new Promise((r) => { setTimeout(r, ms); });
  const t1 = performance.now();
  while (!window.__pulses.length && performance.now() - t1 < 6000) await dodo(4);
  const premier = window.__pulses[0];
  if (premier == null) return { vu: false, n: 0 };
  for (let i = 0; i < t.beats; i++) {
    const quand = premier + i * t.interval + (i ? (Math.random() - 0.5) * 30 : 0);
    if (quand > performance.now()) await dodo(quand - performance.now());
    document.getElementById('pad')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  }
  return { vu: true, n: t.beats };
}, bareme.tempo);
check(`on tape sur les pulsations que l’anneau dessine (${frappe.n} frappes)`, frappe.vu && frappe.n > 0);

const chante = await jusqua(async () => {
  const f = await A.page.evaluate(() => S.vue?.equipes?.[S.vue.moi.side]?.[0]?.ferveur ?? 0);
  return f > ferveurAvant;
}, 12000);
check('taper sur la pulsation affichée fait monter la ferveur', chante);

/* La fenêtre attend le verdict au plus six cents millisecondes après la
   dernière frappe, le laisse lire, puis se ferme : elle ne reste jamais
   ouverte. Le tempo finit sur sa huitième frappe (`geste.js`) : la fenêtre
   s'ouvre moins longtemps qu'avant, et rien ici ne compte sur elle passé le
   verdict. */
const refermee = await jusqua(async () => A.page.evaluate(() =>
  !document.getElementById('mini').classList.contains('on')), 6000);
check('la fenêtre du geste se referme d’elle-même après le verdict', refermee);
{
  const vu = await A.page.evaluate(() => ({ tampons: window.__tampons ?? [], chants: window.__chants ?? [],
    servis: window.__servis ?? [] }));
  const MOTS = { parfait: 'PARFAIT', bon: 'BON', moyen: 'MOYEN', rate: 'RATÉ' };
  check(`le verdict servi claque en tampon, dans le mot de l’échelle (${
    vu.tampons.map((t) => `${t.mot}@${t.ou}`).join(', ') || 'aucun'})`,
    vu.tampons.length >= 1
    && vu.tampons.every((t) => MOTS[t.verdict] === t.mot && t.ou !== 'ailleurs'
      && vu.servis.includes(t.verdict))
    || (console.log('        servis :', JSON.stringify(vu.servis)), false));
  const tempo = vu.chants.filter((c) => c.g === 'tempo');
  check('le chant de la tribune part avec le geste, sur les durées servies',
    tempo.some((c) => c.servis && c.origine)
    || (console.log('        ', JSON.stringify(vu.chants)), false));
  check('et il s’arrête à la fermeture de la fenêtre',
    tempo.length > 0 && tempo.every((c) => c.arrete)
    || (console.log('        ', JSON.stringify(vu.chants)), false));
  /* Le pavé et le chant partent du **même** instant : la page prête au
     geste l'origine qu'elle vient de donner au chant (`origine`). Deux
     lectures de l'horloge, et la pulsation entendue glissait de celle
     qu'on voit. */
  const gestes = await A.page.evaluate(() => window.__gestes ?? []);
  const pave = gestes.filter((g) => g.kind === 'tempo').at(-1);
  const chanteA = tempo.at(-1);
  check('le pavé bat sur l’instant du chant (la même origine)',
    Number.isFinite(pave?.origine) && pave.origine === chanteA?.depuis
    || (console.log('        pavé :', JSON.stringify(pave), '· chant :', JSON.stringify(chanteA)), false));
}

const bouge = await A.page.evaluate(() => S.vue.rope !== 0);
check('la corde a bougé', bouge);

/* **Le verdict attendu est le sien** (lot 6) : la fenêtre du geste prend le
   mot de l'évènement `chant` qui porte **son** identifiant. Un partenaire de
   tribune peut chanter la même carte au même instant : la tribune et la
   carte ne suffisent pas à reconnaître son propre chant. */
{
  const vu = await A.page.evaluate(() => {
    const id = monId();
    const pris = [];
    const avant = [S.verdictCarte, S.verdictAttendu];
    S.verdictCarte = '__banc';
    S.verdictAttendu = (e) => { pris.push(e.userId); };
    const side = S.vue.moi.side;
    raconter({ t: 'chant', userId: '__partenaire', side, cardId: '__banc', verdict: 'bon', quality: 0.8 });
    raconter({ t: 'chant', userId: id, side, cardId: '__banc', verdict: 'parfait', quality: 0.95 });
    [S.verdictCarte, S.verdictAttendu] = avant;
    return { id, pris };
  });
  check(`la fenêtre du geste prend le verdict de son chant, pas celui d’un partenaire (${vu.pris.join(', ') || 'aucun'})`,
    vu.id != null && vu.pris.length === 1 && vu.pris[0] === vu.id);
}

/* **Un but se lit dans la case de BD** (lot 6, `.tbf-moment`, la pièce
   unifiée) : « LA CORDE CÈDE ! », « GOAL ! » avec le buteur et la minute —
   et plus aucun lettrage nu par-dessus (la forme pleine de `FX.but`
   écrivait « BUT ! », `FX.butReel` un second titre une seconde plus tard).
   La corde qui cède est racontée à la page, un vrai but de corde demandant
   trois cents de poussée. **Le but du vrai match, lui, part du serveur**
   (`nvn.butReel`, le chemin du relevé du direct) : raconté à la main, il
   avait la forme que la page attendait — `souffles` en paire — et non celle
   que le moteur émet — un nombre, et `side` —, et la page levait sur chaque
   vrai but sans qu'aucun contrôle le voie. La case passe sous le tiroir
   quand on l'ouvre, comme au Virage. */
{
  const lire = () => A.page.evaluate(() => {
    const m = document.getElementById('moment');
    return { on: Boolean(m?.classList.contains('on')),
      titre: document.getElementById('momentTitre')?.textContent ?? '',
      sous: document.getElementById('momentSous')?.textContent ?? '',
      z: m ? Number(getComputedStyle(m).zIndex) : null };
  });
  const cote = await A.page.evaluate(() => {
    window.__titres = [];
    window.__obsTitres = new MutationObserver((lot) => {
      for (const m of lot) for (const n of m.addedNodes) {
        if (n.nodeType === 1 && n.matches?.('.fx-titre')) window.__titres.push(n.textContent.trim());
      }
    });
    window.__obsTitres.observe(document.body, { childList: true, subtree: true });
    const side = S.vue.moi.side;
    raconter({ t: 'goal', side, goals: side === 0 ? [1, 0] : [0, 1] });
    return side;
  });
  const corde = await lire();
  const erreursAvant = A.erreurs.length;
  // Le club de sa tribune marque : Sion est le domicile du match support.
  const touchees = nvn.butReel({ fixtureId: 7, teamId: cote === 0 ? 85 : 91, minute: 71, player: 'Kabashi' });
  await jusqua(async () => (await lire()).titre === 'GOAL !', 3000);
  const reel = await lire();
  const leve = A.erreurs.slice(erreursAvant);
  const vu = await A.page.evaluate(async () => {
    const lireZ = () => Number(getComputedStyle(document.getElementById('moment')).zIndex);
    const tiroir = document.querySelector('.tbf-tiroir');
    tiroir?.classList.add('on');
    await new Promise((r) => { setTimeout(r, 80); });
    const sousTiroir = lireZ();
    tiroir?.classList.remove('on');
    // `FX.butReel` posait son second titre neuf cents millisecondes après.
    await new Promise((r) => { setTimeout(r, 1300); });
    window.__obsTitres.disconnect();
    couperMoment();
    return { tiroir: Boolean(tiroir), sousTiroir, titres: window.__titres };
  });
  check(`la corde qui cède se lit dans la case de BD (${corde.titre || 'rien'})`,
    corde.on && corde.titre === 'LA CORDE CÈDE !');
  check(`le but du vrai match, tel que le serveur l’émet, aussi — avec le buteur et la minute (${reel.titre} · ${reel.sous})`,
    touchees === 1 && reel.on && reel.titre === 'GOAL !' && reel.sous === 'Kabashi · 71′'
    || (console.log('        salles touchées :', touchees, '· erreurs :', leve.join(' / ')), false));
  check(`et la page ne lève pas en le lisant (${leve.join(' / ') || 'rien'})`, leve.length === 0);
  check(`et aucun lettrage nu par-dessus (${vu.titres.join(', ') || 'aucun'})`, vu.titres.length === 0);
  check(`la case passe sous le tiroir ouvert (calque ${vu.sousTiroir})`,
    vu.tiroir && vu.sousTiroir !== null && vu.sousTiroir < 48);
}

/* **Les deux Fanzzy de l'arène** (lot 7, le duel vivant). Le Fanzzy en
   tribune de chaque camp se tient dans l'arène, sous la corde : le mien à
   gauche, celui d'en face à droite, retourné vers moi. Ils vivent le duel —
   la joie et un saut pour la tribune qui marque, le dépit pour l'autre, la
   poussée de leur tribune, la colère d'un coup d'en face —, et la case de
   BD se pose au-dessus de la corde pour qu'on les voie le vivre.

   Le deck de cette suite n'aligne que des plein-pieds (TR32, MS30, TR33) :
   leur image reste, ce sont la pose et le geste qui changent. Les
   expressions dessinées (LA REPRISE, TR1) passent par la même fonction
   (`imageFz`) et ont été regardées au banc. Aucun geste n'est sans fin : le
   plafond des trois animations est contrôlé plus haut. */
{
  // Les célébrations du but d'avant rendues : on part du repos.
  await jusqua(() => A.page.evaluate(() => ['fzMoi', 'fzEux']
    .every((id) => document.getElementById(id)?.dataset.pose === 'neutre')), 6000);
  const lireFz = () => A.page.evaluate(() => {
    const boite = (el) => {
      const r = el.getBoundingClientRect();
      return { haut: r.top, bas: r.bottom, gauche: r.left, droite: r.right };
    };
    const fig = (id) => {
      const el = document.getElementById(id);
      const img = el?.querySelector('.duel-fz-corps>img.on');
      const corps = el?.querySelector('.duel-fz-corps');
      const style = corps ? getComputedStyle(corps) : null;
      return { vu: Boolean(el && !el.hidden && el.offsetParent), pose: el?.dataset.pose ?? null,
        geste: el?.dataset.geste ?? null, src: img?.getAttribute('src') ?? '', ...(el ? boite(el) : {}),
        miroir: img ? getComputedStyle(img).scale : null,
        animation: style?.animationName ?? null, rotate: style?.rotate ?? null, filtre: style?.filter ?? null };
    };
    const n = document.getElementById('noeud').getBoundingClientRect();
    /* La case par sa boîte de mise en page, pas par son rectangle : elle
       entre en grossissant, et un rectangle pris pendant l'entrée serait
       plus petit qu'elle. */
    const m = document.querySelector('#moment.on');
    const vg = m?.querySelector('.tbf-vignette');
    const v = vg ? { top: m.getBoundingClientRect().top + vg.offsetTop,
      bottom: m.getBoundingClientRect().top + vg.offsetTop + vg.offsetHeight } : null;
    const racine = (id) => /^([A-Z]+\d+)/.exec(String(id ?? ''))?.[1] ?? '';
    return { moi: fig('fzMoi'), eux: fig('fzEux'), corde: n.top + n.height / 2,
      arene: boite(document.getElementById('arene')), vignette: v ? { haut: v.top, bas: v.bottom } : null,
      mien: racine(S.vue.moi.fanzzy.find((f) => f.actif)?.id),
      enFace: racine(S.vue.equipes[S.vue.moi.side ^ 1]?.[0]?.fanzzy) };
  });
  const nom = (src) => src.split('/').pop()?.split('?')[0] || 'rien';

  const repos = await lireFz();
  check(`les deux Fanzzy en tribune se tiennent dans l’arène, chacun le sien (${nom(repos.moi.src)} · ${nom(repos.eux.src)})`,
    repos.moi.vu && repos.eux.vu && Boolean(repos.mien) && Boolean(repos.enFace)
    && repos.moi.src.includes(`/${repos.mien}`) && repos.eux.src.includes(`/${repos.enFace}`)
    || (console.log('        ', JSON.stringify(repos)), false));
  check('sous la corde, le mien à gauche, celui d’en face à droite et retourné vers moi',
    repos.moi.haut > repos.corde && repos.eux.haut > repos.corde
    && repos.moi.bas <= repos.arene.bas + 1 && repos.eux.bas <= repos.arene.bas + 1
    && repos.moi.gauche >= repos.arene.gauche && repos.eux.droite <= repos.arene.droite + 1
    && repos.moi.droite <= repos.eux.gauche && repos.eux.miroir === '-1 1' && repos.moi.miroir === 'none'
    || (console.log('        ', JSON.stringify(repos)), false));

  // Un but de corde pour ma tribune.
  await A.page.evaluate(() => {
    const side = S.vue.moi.side;
    raconter({ t: 'goal', side, goals: side === 0 ? [2, 0] : [0, 2] });
  });
  const but = await lireFz();
  check(`un but de corde : le mien saute de joie, celui d’en face s’affaisse (${but.moi.pose}/${but.moi.geste} · ${but.eux.pose}/${but.eux.geste})`,
    but.moi.pose === 'but' && but.moi.geste === 'saut' && but.eux.pose === 'encaisse' && but.eux.geste === 'affaisse');
  check('et la case de BD se pose au-dessus de la corde : on les voit le vivre',
    Boolean(but.vignette) && but.vignette.bas <= but.corde + 1
    && but.vignette.bas <= Math.min(but.moi.haut, but.eux.haut)
    || (console.log('        ', JSON.stringify({ vignette: but.vignette, corde: but.corde,
      moi: but.moi.haut, eux: but.eux.haut })), false));
  check('un plein-pied sans expression garde son dessin : c’est le geste qui joue',
    but.moi.src === repos.moi.src && but.eux.src === repos.eux.src);

  // Une poussée de ma tribune ne coupe pas ma joie.
  await A.page.evaluate(() => raconter({ t: 'push', side: S.vue.moi.side, valeur: 12 }));
  check('une poussée ne coupe pas la joie d’un but', (await lireFz()).moi.pose === 'but');

  // La célébration finie, la tribune d'en face pousse : son Fanzzy se penche vers moi.
  await jusqua(() => A.page.evaluate(() => ['fzMoi', 'fzEux']
    .every((id) => document.getElementById(id)?.dataset.pose === 'neutre')), 6000);
  await A.page.evaluate(() => raconter({ t: 'push', side: S.vue.moi.side ^ 1, valeur: 12 }));
  await dodo(300);
  const pousse = await lireFz();
  check(`leur poussée : leur Fanzzy se penche vers la corde (${pousse.eux.pose}, ${pousse.eux.rotate})`,
    pousse.eux.pose === 'pousse' && pousse.eux.geste === 'hisse' && /^-4deg$/.test(pousse.eux.rotate ?? '')
    || (console.log('        ', JSON.stringify(pousse.eux)), false));

  /* **Son geste** : le chant réussi de sa spécialité le fait chanter à la
     manière de sa famille — la Percussion frappe —, et la poussée qui suit
     ne le coupe pas pour se pencher. Raté, rien de plus que d'habitude. */
  await jusqua(() => A.page.evaluate(() => ['fzMoi', 'fzEux']
    .every((id) => document.getElementById(id)?.dataset.pose === 'neutre')), 6000);
  await A.page.evaluate(() => {
    const side = S.vue.moi.side;
    raconter({ t: 'chant', side, userId: 'personne', cardId: 'roulement', geste: 'mash',
      verdict: 'bon', sien: true, famille: 'perc' });
    raconter({ t: 'push', side, valeur: 12 });
  });
  await dodo(150);
  const sien = await lireFz();
  check(`son geste réussi : le mien chante à la manière de sa famille (${sien.moi.geste}, ${sien.moi.animation})`,
    sien.moi.pose === 'pousse' && sien.moi.geste === 'frappe' && sien.moi.animation === 'fzDuelFrappe'
    || (console.log('        ', JSON.stringify(sien.moi)), false));
  await jusqua(() => A.page.evaluate(() => document.getElementById('fzEux')?.dataset.pose === 'neutre'), 6000);
  await A.page.evaluate(() => raconter({ t: 'chant', side: S.vue.moi.side ^ 1, userId: 'personne',
    cardId: 'reprise', geste: 'tempo', verdict: 'rate', sien: true, famille: 'voix' }));
  const rate = await lireFz();
  check(`son geste raté : celui d’en face ne crie pas (${rate.eux.geste ?? 'rien'})`, rate.eux.geste !== 'crie');

  /* Un coup d'en face sur ma tribune : la vue le porte (`equipes[][].effets`),
     et c'est **son arrivée** qui met en colère, pas sa durée. */
  await A.page.evaluate(() => {
    const v = JSON.parse(JSON.stringify(S.vue));
    v.moi.effets = [...(v.moi.effets ?? []), { type: 'silence', reste: 4000, duree: 4000 }];
    S.vue = v;
    rendreDuel();
  });
  const coup = await lireFz();
  check(`un silence d’en face : le mien trépigne de colère (${coup.moi.pose}/${coup.moi.geste})`,
    coup.moi.pose === 'decision' && coup.moi.geste === 'rage');

  // Au calme, plus aucun mouvement ; le dépit les ternit encore.
  await jusqua(() => A.page.evaluate(() => ['fzMoi', 'fzEux']
    .every((id) => document.getElementById(id)?.dataset.pose === 'neutre')), 6000);
  await A.page.evaluate(() => {
    document.documentElement.dataset.calme = 'animations';
    const side = S.vue.moi.side ^ 1;
    raconter({ t: 'goal', side, goals: side === 0 ? [1, 0] : [0, 1] });
  });
  // Le dépit se pose en fondu (0,35 s) : on le lit fini, le moment tenant encore.
  await dodo(500);
  const calme = await lireFz();
  await A.page.evaluate(() => { delete document.documentElement.dataset.calme; couperMoment(); });
  const terni = Number(/brightness\(([\d.]+)\)/.exec(calme.moi.filtre ?? '')?.[1] ?? 1);
  check(`au calme, le but d’en face ne fait plus bouger personne, et le dépit ternit encore (${calme.moi.animation} · ${calme.moi.rotate} · ${calme.moi.filtre})`,
    calme.eux.pose === 'but' && calme.moi.pose === 'encaisse'
    && calme.moi.animation === 'none' && calme.eux.animation === 'none'
    && calme.moi.rotate === 'none' && terni < 0.9
    || (console.log('        ', JSON.stringify({ moi: calme.moi, eux: calme.eux })), false));
}

/* **La tenue d'en face** : l'arène et l'affiche dessinaient le Fanzzy
   adverse en tenue de base, faute de connaître la sienne. La vue la dit
   maintenant (`equipes[].skin`, à son âge `equipes[].stade`), et la page la
   dessine. Le Choriste n'a pas de tenue dessinée : on regarde le dessin sur
   un Fanzzy de LA REPRISE, qui a son Halloween à chaque âge. */
{
  const servi = await A.page.evaluate(() => {
    const e = S.vue.equipes[S.vue.moi.side ^ 1]?.[0];
    return { skin: e?.skin ?? null, stade: e?.stade ?? null };
  });
  check(`la vue dit la tenue que celui d’en face a mise, à son âge (${servi.skin}, âge ${servi.stade})`,
    servi.skin === 'halloween' && servi.stade === 1);
  /* Une vue changée et rendue dans la même tâche : la suivante du serveur
     la remplacerait, on lit donc l'image demandée (`voulu`), pas celle qui
     finit de charger. */
  const dessin = await A.page.evaluate(() => {
    const avant = S.vue;
    const habiller = (stade, skin) => {
      const v = JSON.parse(JSON.stringify(avant));
      Object.assign(v.equipes[v.moi.side ^ 1][0], { fanzzy: 'RP1', stade, skin });
      S.vue = v;
      rendreDuel();
      return fzArene.eux.voulu;
    };
    const r = { e1: habiller(1, 'halloween'), e2: habiller(2, 'halloween'), base: habiller(1, 'base') };
    S.vue = avant;
    rendreDuel();
    r.affiche = vignetteFz({ id: 'RP1', nom: 'RP1', stade: 1, skin: 'halloween' }, false, 'var(--or)');
    r.afficheBase = vignetteFz({ id: 'RP1', nom: 'RP1', stade: 1, skin: 'base' }, false, 'var(--or)');
    return r;
  });
  check(`dans l’arène, le Fanzzy d’en face porte sa tenue (${dessin.e1.split('/img/fanzzy/')[1] ?? dessin.e1})`,
    dessin.e1.includes('/RP1/e1/halloween/'));
  check(`et celle de l’âge où sa Relève l’a mené (${dessin.e2.split('/img/fanzzy/')[1] ?? dessin.e2})`,
    dessin.e2.includes('/RP1/e2/halloween/'));
  check('sans tenue mise, sa base', !dessin.base.includes('halloween') && dessin.base.includes('RP1'));
  check('sur l’affiche aussi, chacun paraît comme il l’a habillé',
    dessin.affiche.includes('/RP1/e1/halloween/') && !dessin.afficheBase.includes('halloween')
    || (console.log('        ', dessin.affiche, dessin.afficheBase), false));
}

/* **Ce qu'il porte, accroché à côté de lui** : le Sédunois a mis les
   Jumelles à son Choriste ; la Bâloise n'a rien mis au sien. Chacun voit le
   sac du Fanzzy de son côté et celui d'en face, et un Fanzzy sans pièce n'a
   rien d'accroché — pas un cadre vide. */
{
  const lire = (P) => P.page.evaluate(() => {
    const ids = (id) => [...document.querySelectorAll(`#${id} .tbf-porte .tbf-piece img`)]
      .map((i) => /\/img\/stuff\/([^.]+)\./.exec(i.getAttribute('src'))?.[1] ?? '?');
    const e = S.vue.equipes.flat().find((x) => x.sac?.length);
    return { moi: ids('fzMoi'), eux: ids('fzEux'), servi: e?.sac ?? null,
      vide: document.querySelectorAll('#fzMoi .tbf-porte, #fzEux .tbf-porte').length };
  });
  await jusqua(async () => (await lire(A)).moi.length > 0, 4000);
  const a = await lire(A);
  const b = await lire(B);
  if (process.env.SHOT) {
    await A.page.screenshot({ path: process.env.SHOT + '/duel-sac-moi.png' });
    await B.page.screenshot({ path: process.env.SHOT + '/duel-sac-eux.png' });
  }
  check(`la vue sert le sac de chacun, avec la rareté (${JSON.stringify(a.servi)})`,
    a.servi?.[0]?.id === 'jumelles' && a.servi[0].rar === 'commune' && a.servi[0].nom === 'Jumelles');
  check(`dans mon arène, mes Jumelles sont accrochées à mon Fanzzy (${a.moi.join(',')})`,
    a.moi.join() === 'jumelles' && a.eux.length === 0 && a.vide === 1);
  check(`chez celui d’en face, elles sont accrochées au mien, de son côté à lui (${b.eux.join(',')})`,
    b.eux.join() === 'jumelles' && b.moi.length === 0);
}

/* Le bandeau d'annonce, en partie : sous les deux rangées du HUD, hors des
   deux boutons — voir la préparation. */
{
  await poserAnnonce(A.page);
  const vu = await lireAnnonce(A.page);
  check('en partie, le bandeau d’annonce se range sous les deux rangées du HUD, hors des deux boutons',
    vu?.sousHud === true && vu.couvre === false
    || (console.log('        ', JSON.stringify(vu)), false));
}

/**
 * Ce qui a remplacé le fil de texte : on ne lit plus l'état, on le voit.
 * Le territoire d'un camp suit la corde, et l'écart s'affiche en chiffres.
 * Sans ces deux contrôles, la refonte pourrait se figer sans que rien ne le
 * signale — la corde bougerait dans les données, pas à l'écran.
 */
/* **Depuis le lot 6, une seule variable** : la page pose `--corde` (de −1 à
   1) sur l'arène, et la marée (`.tbf-maree`) et le foulard (`#noeud`) la
   lisent. On mesure donc ce qu'ils dessinent, pas ce que la page écrit : le
   front de la marée, sa part, et le foulard posé dessus. Les transitions
   durent 120 et 200 ms : on attend qu'elles aient fini. */
await dodo(400);
{
  const arene = await A.page.evaluate(() => {
    const ar = document.getElementById('arene');
    const maree = ar.querySelector('.tbf-maree');
    const r = maree.getBoundingClientRect();
    const moi = parseFloat(getComputedStyle(maree, '::before').width);
    const eux = parseFloat(getComputedStyle(maree, '::after').width);
    const n = document.getElementById('noeud').getBoundingClientRect();
    return {
      corde: parseFloat(ar.style.getPropertyValue('--corde')),
      partMoi: (moi / r.width) * 100,
      partEux: (eux / r.width) * 100,
      noeud: ((n.left + n.width / 2 - r.left) / r.width) * 100,
      ecart: document.getElementById('ecart').firstChild.textContent,
      mention: document.getElementById('ecart').querySelector('small').textContent,
    };
  });
  check(`le territoire du camp suit la corde (--corde ${arene.corde})`,
    Number.isFinite(arene.corde) && arene.corde !== 0 && Math.abs(arene.partMoi - 50) > 0.05);
  check('les deux camps se partagent toute la largeur',
    Math.abs(arene.partMoi + arene.partEux - 100) < 0.5
    || (console.log('        ', JSON.stringify(arene)), false));
  check('le foulard est au front de la marée',
    Math.abs(arene.noeud - arene.partMoi) < 1
    || (console.log('        ', JSON.stringify(arene)), false));
  check('l’écart est annoncé en chiffres', /^[+−]\d+$/.test(arene.ecart));
  check('et il dit qui mène', /MÈNES|TIRENT/.test(arene.mention));
}

/* **Les effets des deux camps sont posés sur l'arène** (lot 6, § 17) : la
   vue dit ce que porte chaque joueur (`equipes[][].effets`), et la page en
   fait des objets — le brouillard sur la moitié d'en face, leur bâche
   devant leur tribune, le vent qui souffle vers moi —, chacun avec son
   anneau, **ce qui reste sur la durée servie** (`reste / duree`), et non
   sur la plus longue valeur vue. Le serveur ne pose ces effets qu'au gré
   des cartes : on prend la vue qu'il vient d'envoyer, on y met ce qu'il y
   mettrait, et on la rend à la page dans la même tâche — la vue suivante
   remet tout en place. */
{
  const vu = await A.page.evaluate(() => {
    const v = JSON.parse(JSON.stringify(S.vue));
    const eux = v.moi.side ^ 1;
    const porte = (j) => Array.isArray(j?.effets);
    const servi = (v.equipes ?? []).every((eq) => (eq ?? []).every(porte));
    for (const j of v.equipes[eux] ?? []) {
      j.effets = [{ type: 'blind', reste: 3000, duree: 6000 }, { type: 'shield', reste: null, duree: null }];
    }
    v.moi.effets = [{ type: 'mod_foe', reste: 2000, duree: 8000 }];
    for (const j of v.equipes[v.moi.side] ?? []) if (j.userId === v.moi.userId) j.effets = v.moi.effets;
    S.vue = v;
    rendreDuel();
    const objets = [...document.querySelectorAll('#effetsArene .tbf-effet')].map((o) => ({
      effet: o.dataset.effet, cote: o.dataset.tribune,
      part: o.querySelector('.tbf-recharge')?.style.getPropertyValue('--part') ?? '',
      cache: o.querySelector('.tbf-recharge')?.style.display === 'none' }));
    return { servi, objets };
  });
  const trouve = (effet, cote) => vu.objets.find((o) => o.effet === effet && o.cote === cote);
  check('la vue porte ce que chaque joueur subit, des deux côtés', vu.servi
    || (console.log('        equipes[][].effets absents de la vue'), false));
  check(`le brouillard et la bâche d’en face se posent sur leur moitié (${vu.objets.map((o) => `${o.effet}@${o.cote}`).join(', ')})`,
    Boolean(trouve('brouillard', 'eux')) && Boolean(trouve('bache', 'eux'))
    || (console.log('        ', JSON.stringify(vu.objets)), false));
  check('l’anneau d’un effet se lit sur la durée servie (2 s sur 8, 3 s sur 6)',
    trouve('vent', 'moi')?.part === '0.250' && trouve('brouillard', 'eux')?.part === '0.500'
    && trouve('bache', 'eux')?.cache === true
    || (console.log('        ', JSON.stringify(vu.objets)), false));
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
/* ================= sortir en plein duel doit être annoncé, pas subi

   Partir en cours de duel est un **forfait** : on perd, on ne touche rien, et
   l'autre camp encaisse. Une sanction qu'on découvre après coup n'est pas une
   règle, c'est un piège — c'est écrit dans la page, au-dessus du
   gestionnaire qui intercepte les sorties.

   Rien ne l'éprouvait. On clique donc la flèche pour de vrai, on regarde si
   la question vient, et on répond **RESTER** : le contrôle ne doit pas coûter
   le duel aux blocs qui suivent. */
{
  const p = A.page;
  const enJeu = await p.evaluate(() => document.getElementById('jeu').classList.contains('on'));
  check('le duel est bien en cours pour éprouver la sortie', enJeu
    || (console.log('        l’écran de jeu n’est pas ouvert'), false));

  if (enJeu) {
    await p.evaluate(() => document.querySelector('.tbf-retour')?.click());
    const demande = await jusqua(async () => p.evaluate(() =>
      Boolean(document.querySelector('[data-non]'))), 5000);
    /* **Le contrôle qui porte.** Sans la question, le joueur perd son duel en
       appuyant sur une flèche de retour ordinaire. */
    check('la flèche de retour prévient avant de faire perdre', demande
      || (console.log('        aucune confirmation : on partirait en forfait sans le savoir'), false));

    if (demande) {
      const dit = await p.evaluate(() =>
        document.querySelector('.tbf-dial')?.textContent.replace(/\s+/g, ' ').trim() ?? '');
      /* Elle doit dire **ce qu’on perd**, pas demander deux fois : c’est la
         doctrine des panneaux de ce dépôt. */
      check('et elle dit ce que ça coûte', /forfait/i.test(dit)
        || (console.log('        elle dit :', dit.slice(0, 90)), false));

      await p.evaluate(() => document.querySelector('[data-non]').click());
      await dodo(400);
      const reste = await p.evaluate(() =>
        document.getElementById('jeu').classList.contains('on') && !location.pathname.endsWith('/'));
      check('« RESTER » laisse le duel en place', reste
        || (console.log('        on a quitté le duel malgré le refus'), false));
    }
  }
}
/* ================== le téléphone qui décroche, et ce qu'il laisse levé

   Sur un mobile, la socket tombe chaque fois que l'écran s'éteint ou que le
   réseau change de main. Elle revient, le serveur remet le joueur à sa place,
   et la page prévient alors la barre du haut qu'**une partie tourne**. Ce
   drapeau n'est pas décoratif : c'est lui qui arme l'avertissement du
   navigateur avant un rechargement — voir `ECRANS_DE_JEU` dans nav.js.

   Le chemin d'un joueur assis dans le métro passe donc par ici, et celui de la
   suite n'y passait jamais : elle jouait un duel d'une seule traite. On lève
   le drapeau par le seul geste qui le lève, pour que le contrôle d'après
   puisse regarder s'il retombe. */
{
  await A.page.evaluate(() => { socket.disconnect(); socket.connect(); });
  const revenu = await jusqua(async () => A.page.evaluate(() =>
    Boolean(socket?.connected)), 8000);
  check('la socket revient après une coupure en plein duel', revenu
    || (console.log('        elle ne s’est pas rebranchée'), false));

  const arme = await jusqua(async () => A.page.evaluate(() =>
    document.body.classList.contains('tbf-en-partie')), 3000);
  check('et la page se dit alors « en partie »', arme
    || (console.log('        le drapeau n’est pas levé : le contrôle suivant ne prouverait rien'),
      false));
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
    /* Ce que le serveur a servi, gardé pour le comparer à ce que la page en
       montre : une ligne n'existe que si sa donnée existe (R1). */
    await A.page.evaluate(() => {
      const vrai = montrerBilan;
      // eslint-disable-next-line no-global-assign
      montrerBilan = (b) => { window.__bilan = b; return vrai(b); };
      // Ce que la page annonce à la barre (`tbf:bourse`, R6).
      window.__bourses = [];
      addEventListener('tbf:bourse', (e) => { window.__bourses.push(e.detail ?? null); });
    });
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
      check('et l’ancien voile gris ne se montre plus', bil.voile === false);

      /* **La page kraft du lot 6** : la case de BD au ton du résultat, et
         chaque ligne nouvelle **seulement si sa donnée est servie** — le
         meilleur geste en tampon (§ 17), la cote (§ 4.1), l'XP qui se
         remplit depuis `gains.niveau` (§ 1). Le contrôle compare ce qui est
         à l'écran à ce qui a été servi : une ligne inventée rougit autant
         qu'une ligne oubliée. */
      const k = await A.page.evaluate(() => {
        const b = window.__bilan;
        const e = document.getElementById('bilan');
        const mien = S.vue?.moi?.side ?? 0;
        const miens = (b?.joueurs ?? []).filter((j) => j.side === mien);
        // Sa propre ligne, que le serveur marque dans son envoi (§ 17).
        const marquees = (b?.joueurs ?? []).filter((j) => j.moi === true);
        const moi = marquees[0] ?? miens[0] ?? null;
        const lignes = [...e.querySelectorAll('.tbf-bilan-l > span:first-child')].map((x) => x.textContent.trim());
        return {
          marquees: marquees.map((j) => j.userId),
          kraft: e.classList.contains('tbf-bilan') && Boolean(e.querySelector('.tbf-ticket')),
          ton: document.getElementById('bilanCase')?.dataset.ton ?? null,
          attendu: b?.vainqueur == null ? 'gris' : b.vainqueur === mien ? 'vert' : 'flare',
          meilleur: moi?.meilleur?.verdict ?? null,
          tampon: e.querySelector('.tbf-bilan-l .tbf-tampon[data-verdict]')?.dataset.verdict ?? null,
          cote: Boolean(b?.gains?.cote), ligneCote: lignes.includes('COTE'),
          niveau: Number.isFinite(Number(b?.gains?.niveau?.part)),
          jauge: Boolean(e.querySelector('.tbf-bilan-xp .tbf-jauge')),
          vs: e.querySelectorAll('.tbf-vs .tbf-vs-l').length,
          rejouer: document.getElementById('bilanRejouer')?.textContent.trim() ?? '',
          fin: (window.__rumeurs ?? []).includes('fin'),
        };
      });
      check(`le bilan reconnaît sa ligne à la marque du serveur (${k.marquees.join(', ') || 'aucune'})`,
        k.marquees.length === 1 && k.marquees[0] === U[0]);
      check(`la case de BD prend le ton du résultat (${k.ton})`, k.kraft && k.ton === k.attendu);
      check(`le meilleur geste en tampon, seulement s’il est servi (${k.meilleur ?? 'non servi'})`,
        k.tampon === k.meilleur);
      check(`la cote, seulement si elle est servie (${k.cote ? 'servie' : 'non servie'})`,
        k.cote === k.ligneCote);
      check('l’XP se remplit dans l’écharpe quand le niveau est servi', k.niveau === k.jauge);
      check(`toi contre lui, en barres miroir (${k.vs} lignes)`, k.vs >= 4);
      check('REJOUER à côté de REVENIR', /REJOUER/.test(k.rejouer));
      check('et la tribune se vide au coup de sifflet', k.fin);

      /* **La barre l'apprend** (R6) : le duel a versé des écharpes ou de
         l'XP, la page l'annonce (`tbf:bourse`) une fois — sans quoi le HUD
         garde l'ancien solde, et l'écran suivant avec lui. Rien de versé,
         rien d'annoncé. */
      const bourse = await A.page.evaluate(() => ({ annonces: window.__bourses ?? [],
        verse: Number(window.__bilan?.gains?.echarpes) > 0 || Number(window.__bilan?.gains?.xp) > 0 }));
      check(`le bilan annonce à la barre ce qu’il a versé (${bourse.annonces.length} annonce, ${
        bourse.verse ? 'versé' : 'rien de versé'})`,
        bourse.annonces.length === (bourse.verse ? 1 : 0));

      /* **Le bilan rejoué** : ce que ce banc ne peut pas obtenir du vrai
         serveur, on le rejoue sur le bilan reçu, dans la forme du contrat.

         **Sa ligne est celle que le serveur marque** (`moi: true`, § 17),
         même quand un partenaire de tribune la précède et a la même
         ferveur — un 1 contre 1 ne départage rien, on lui ajoute donc ce
         partenaire, avec un autre meilleur geste.

         **L'XP part de là où elle était, et la fête est fusionnée** (§ 1).
         Ce banc ne branche pas le module de niveau : le serveur n'y sert
         pas `gains.niveau`. On le sert tel que le contrat le décrit — une
         montée de 3 à 4 — et on regarde l'écharpe : elle part de
         `depart.part` (91 %), fait le tour, **et c'est au bout du tour** que
         la fête se pose (et non 1,4 s après le bilan, par-dessus) ; puis
         elle repart de zéro vers `part` (17 %), le sticker au nouveau
         niveau. La fête est relevée sans être jouée. */
      const xp = await A.page.evaluate(async () => {
        const b = JSON.parse(JSON.stringify(window.__bilan));
        const sienne = (b.joueurs ?? []).find((j) => j.moi === true);
        const MOTS = ['parfait', 'bon', 'moyen', 'rate'];
        const autre = MOTS.find((m) => m !== sienne?.meilleur?.verdict);
        if (sienne) {
          b.joueurs.unshift({ ...sienne, moi: undefined, userId: '__partenaire', nom: 'Partenaire',
            ferveur: S.vue?.moi?.ferveur ?? sienne.ferveur,
            meilleur: { chant: sienne.meilleur?.chant ?? 'reprise', nom: 'Le partenaire', verdict: autre } });
        }
        b.gains = { ...(b.gains ?? {}), xp: 35, niveau: { xp: 430, gain: 35, niveau: 4, dans: 30, pour: 180,
          part: 0.167, max: false, avant: 3, monte: true, paliers: [], ecarpes: 0,
          depart: { xp: 395, niveau: 3, dans: 145, pour: 160, part: 0.906, max: false } } };
        const fetes = [];
        const jauge = () => document.querySelector('#bilan .tbf-bilan-xp .tbf-jauge i');
        const vraie = window.TBF_NIVEAU?.feter;
        if (window.TBF_NIVEAU) {
          window.TBF_NIVEAU.feter = (n) => { fetes.push({ niveau: n?.niveau, largeur: jauge()?.style.width ?? null });
            return Promise.resolve(); };
        }
        montrerBilan(b);
        const tampon = document.querySelector('#bilan .tbf-bilan-l .tbf-tampon[data-verdict]')?.dataset.verdict ?? null;
        const depart = { largeur: jauge()?.style.width ?? null,
          sticker: document.getElementById('bilanNiv')?.textContent.trim() ?? null };
        const t0 = performance.now();
        while (performance.now() - t0 < 12000
          && !(fetes.length && document.getElementById('bilanNiv')?.textContent.trim() === 'NIV. 4'
            && jauge()?.style.width === '17%')) {
          await new Promise((r) => { setTimeout(r, 100); });
        }
        if (window.TBF_NIVEAU && vraie) window.TBF_NIVEAU.feter = vraie;
        return { sienne: sienne?.meilleur?.verdict ?? null, autre, tampon, depart, fetes,
          fin: { largeur: jauge()?.style.width ?? null,
            sticker: document.getElementById('bilanNiv')?.textContent.trim() ?? null } };
      });
      check(`le bilan prend sa ligne, pas celle d’un partenaire qui la précède (${xp.tampon ?? 'aucun tampon'})`,
        xp.sienne !== null && xp.tampon === xp.sienne
        || (console.log('        ', JSON.stringify({ sienne: xp.sienne, autre: xp.autre, tampon: xp.tampon })), false));
      check(`l’XP part de là où elle était (${xp.depart.largeur} · ${xp.depart.sticker})`,
        xp.depart.largeur === '91%' && xp.depart.sticker === 'NIV. 3'
        || (console.log('        ', JSON.stringify(xp)), false));
      check(`et la fête de niveau se pose au bout du tour, une fois (${xp.fetes.map((f) => f.largeur).join(', ') || 'jamais'})`,
        xp.fetes.length === 1 && xp.fetes[0].niveau === 4 && xp.fetes[0].largeur === '100%'
        && xp.fin.largeur === '17%' && xp.fin.sticker === 'NIV. 4'
        || (console.log('        ', JSON.stringify(xp)), false));
    }

    if (process.env.CAPTURE) {
      await A.page.screenshot({ path: `${process.env.TEMP ?? '/tmp'}/duel-bilan.png` });
    }
  }
}

/* ====================================== la porte du bilan, et ce qu'il y a derrière

   **« Une fois le duel terminé, il ne se passe plus rien. »** Tout ce qui
   précède éprouve le bilan — son titre, son score, ses gains, sa ligne en base
   — et rien n'éprouvait sa **porte**. Un écran de fin dont on ne sort pas est
   pire qu'une fin sèche : le joueur a gagné, il le lit, et le jeu s'arrête là.

   Deux choses se contrôlent ici, dans l'ordre où elles cassent.

   D'abord le drapeau du bloc précédent. Il est levé à la reconnexion et
   personne ne le baissait : le duel se terminait, le bilan s'affichait, et le
   corps de la page disait toujours qu'une partie tournait. `REVENIR` recharge
   — et un rechargement sous ce drapeau demande d'abord confirmation au
   navigateur. Sur un téléphone, cette demande se solde le plus souvent par un
   refus, et le bouton ne fait **rien**.

   Ensuite la porte elle-même, par un vrai clic de souris et non un `.click()`
   posé depuis le script : c'est l'interaction réelle qui autorise le navigateur
   à poser sa question, donc la seule qui reproduise le défaut. */
{
  const arme = await A.page.evaluate(() =>
    document.body.classList.contains('tbf-en-partie'));
  check('le coup de sifflet range le drapeau « en partie »', arme === false
    || (console.log('        le corps porte encore tbf-en-partie après le bilan'), false));

  /* **Sans rechargement** (lot 6) : un repère posé dans la page doit
     survivre à la sortie — une page rechargée l'aurait perdu. */
  await A.page.evaluate(() => { window.__pasRecharge = true; });
  await A.page.click('#bilanSortir');
  /* On ne demande pas « la page a-t-elle rechargé » mais « le joueur peut-il
     rejouer » : la liste des matchs, dépliée, avec de quoi appuyer. C'est ce
     qu'il attend en sortant, et le seul état dont on ne soit pas prisonnier. */
  const rendu = await jusqua(async () => A.page.evaluate(() => {
    const p = document.getElementById('prepa');
    if (!p || getComputedStyle(p).display === 'none') return false;
    return document.querySelectorAll('#prepaCorps .mt[data-fixture]').length > 0;
  }), 15000);
  check('« REVENIR » ramène à la liste des matchs', rendu
    || (console.log('        on reste sur le bilan : la porte ne s’ouvre pas'), false));

  if (rendu) {
    const propre = await A.page.evaluate(() => ({
      bilan: document.getElementById('bilan')?.hidden !== false,
      jeu: !document.getElementById('jeu')?.classList.contains('on'),
      voile: !document.getElementById('voile')?.classList.contains('on'),
    }));
    check('le bilan est refermé', propre.bilan);
    check('la corde n’est plus à l’écran', propre.jeu);
    check('et aucun voile ne reste par-dessus', propre.voile);
    check('sans recharger la page', await A.page.evaluate(() => window.__pasRecharge === true));
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

/* ==================== l'écran quand la bibliothèque du direct n'arrive pas

   Un joueur a décrit la panne en une phrase : « plus rien dans VIRAGE et
   DUEL — un message de chargement dans l'un, rien dans l'autre ». Les deux
   écrans touchés étaient exactement les deux seuls à charger
   /socket.io/socket.io.js, et tous deux appelaient leur fonction de connexion
   **en première ligne du démarrage, hors de tout rattrapage**. `io` absent,
   l'appel levait, la fonction rejetait, et plus rien ne se jouait : ni les
   appels au serveur, ni le rendu. Le duel restait sur le « Chargement… » de
   son balisage, le Virage restait blanc.

   On reproduit la vraie panne plutôt qu'un symptôme : le fichier est refusé
   au réseau, exactement comme le ferait un mandataire qui ne relaie pas ce
   chemin ou une extension qui le bloque.

   Ce qu'on éprouve n'est pas que le direct marche — il ne marche pas, c'est
   le postulat — mais que **la page vive sans lui** : la liste des matchs
   arrive par des appels ordinaires, et elle n'a jamais eu besoin d'une
   socket. Et que le joueur soit prévenu, plutôt que laissé devant un écran
   qui ne dit rien. */
{
  const ctx = await nav.createBrowserContext();
  const p = await ctx.newPage();
  const erreurs = [];
  p.on('pageerror', (e) => erreurs.push(e.message));
  await p.setViewport({ width: 400, height: 880 });
  await ctx.setCookie({ name: 'tbf_test', value: U[0], domain: 'localhost', path: '/' });
  await p.setRequestInterception(true);
  p.on('request', (r) => (/socket\.io/.test(r.url()) ? r.abort() : r.continue()));

  await p.goto(`${base}/duel-nvn`, { waitUntil: 'domcontentloaded' });

  /* **Le contrôle qui porte.** La liste des matchs doit être là. Sans le
     rattrapage, cette attente expire et le corps de la préparation en est
     encore à son « Chargement… ». */
  const liste = await jusqua(async () => p.evaluate(() =>
    document.querySelectorAll('#prepaCorps .mt[data-fixture]').length > 0), 12000);
  check('sans la bibliothèque du direct, le duel liste quand même les matchs', liste
    || (console.log('        #prepaCorps dit :',
      await p.evaluate(() => document.getElementById('prepaCorps').textContent.trim().slice(0, 60))),
      false));

  /* Et il le dit. Un écran qui marche à moitié sans l'annoncer envoie le
     joueur appuyer sur un bouton qui ne peut pas répondre. */
  const dit = await p.evaluate(() =>
    document.getElementById('prepaCorps').textContent);
  check('et il prévient qu’on ne peut pas entrer en file',
    /PAS DE CONNEXION EN DIRECT/i.test(dit)
    || (console.log('        aucun avertissement dans la préparation'), false));

  await ctx.close();
}
/* ======================= une hésitation du réseau ne voile pas l’écran

   « J'ai le message de connexion impossible alors que la connexion
   fonctionne. » Le défaut était grossier : `connect_error` posait le voile
   sur-le-champ, sur tout l'écran, et il tombait même quand on ne faisait que
   regarder la liste des matchs.

   Or socket.io émet `connect_error` à la moindre hésitation — un WebSocket
   refusé avant le repli en polling, un changement de réseau, un écran de
   téléphone qui s'éteint. Il se rebranche seul dans la foulée. C'est le
   comportement ordinaire du mobile, pas une panne.

   On appelle les vrais écouteurs de la page plutôt que de couper le réseau :
   ce qu'on éprouve est la **règle** — on ne crie pas au loup — et non la
   mécanique de reconnexion de la bibliothèque, qui a ses propres essais.

   Deux contrôles, et il faut les deux : le voile ne doit pas venir tout de
   suite, et il doit venir quand même si ça dure. Sans le second, supprimer
   l'avertissement passerait pour une réparation. */
{
  const p = A.page;
  /* On part d’un écran propre : les blocs précédents ont pu laisser un voile. */
  await p.evaluate(() => document.getElementById('voile').classList.remove('on'));

  const voile = () => p.evaluate(() =>
    document.getElementById('voile').classList.contains('on'));

  await p.evaluate(() => socket.listeners('connect_error')
    .forEach((f) => f(new Error('websocket error'))));
  await dodo(1200);
  check('une coupure d’une seconde ne voile pas l’écran', (await voile()) === false
    || (console.log('        le voile est tombé tout de suite'), false));

  /* Et si ça dure, on le dit. La grâce est de cinq secondes dans la page ;
     on attend au-delà, sans recopier la constante — ce qui compte est
     qu'elle finisse par parler, pas qu'elle parle à la milliseconde. */
  const finit = await jusqua(voile, 9000);
  check('mais une coupure qui dure finit par le dire', finit
    || (console.log('        le voile n’est jamais venu : la panne resterait muette'), false));

  /* Et la reconnexion efface tout, sans laisser le voile derrière. */
  await p.evaluate(() => socket.listeners('connect').forEach((f) => f()));
  const efface = await jusqua(async () => (await voile()) === false, 4000);
  check('et la reconnexion retire le voile', efface
    || (console.log('        le voile est resté après le retour du réseau'), false));
}
/* ====================== la porte de sortie, et où elle mène

   « Si je sors d'un virage ou d'un duel, j'arrive sur une page vide ou sur
   une page 404. » Personne ne regardait jamais **où** la flèche de retour
   dépose le joueur : les suites ouvrent des écrans, en mesurent le contenu,
   et les quittent en fermant le navigateur.

   Hors duel il n'y a rien à confirmer — on n'abandonne rien — donc le lien
   navigue comme partout ailleurs. Ce qu'on éprouve est l'arrivée : un code
   qui répond, et une page qui a quelque chose dedans. Un 404 muet et une page
   blanche se ressemblent beaucoup vus du canapé.

   Sur une page neuve : la flèche mène hors du duel, et les blocs précédents
   ont besoin de la leur. */
{
  const ctx = await nav.createBrowserContext();
  const p = await ctx.newPage();
  const erreurs = [];
  p.on('pageerror', (e) => erreurs.push(e.message));
  await p.setViewport({ width: 400, height: 880 });
  await ctx.setCookie({ name: 'tbf_test', value: U[0], domain: 'localhost', path: '/' });
  await p.goto(`${base}/duel-nvn`, { waitUntil: 'networkidle0' });

  const fleche = await p.evaluate(() => {
    const a = document.querySelector('.tbf-retour');
    return a ? a.getAttribute('href') : null;
  });
  check(`le duel offre une flèche de retour (${fleche})`, Boolean(fleche)
    || (console.log('        aucune .tbf-retour dans la barre'), false));

  if (fleche) {
    const [rep] = await Promise.all([
      p.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => null),
      p.evaluate(() => document.querySelector('.tbf-retour').click()),
    ]);
    check('la flèche emmène quelque part', Boolean(rep)
      || (console.log('        aucune navigation après le clic'), false));
    /* **Le contrôle qui porte.** Un 404 est une page, et `page()` répond au
       404 par un corps **vide** : les deux symptômes décrits par le joueur
       sont les deux faces de la même chose. */
    check(`et la page d’arrivée répond (${rep?.status() ?? 'sans réponse'})`,
      rep?.status() === 200
      || (console.log('        code', rep?.status(), 'sur', p.url()), false));

    await dodo(700);
    const corps = await p.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').trim());
    check(`et elle a quelque chose dedans (${corps.length} caractères)`, corps.length > 20
      || (console.log('        la page d’arrivée est vide :', p.url()), false));
    check('et elle n’a pas jeté d’erreur de script',
      erreurs.length === 0 || (console.log('        ', erreurs.join(' / ')), false));
  }
  await ctx.close();
}
await nav.close();
nvn.stop();
io.close();
await new Promise((r) => http.close(r));
await pool.end();

console.log(failures ? `\n${failures} test(s) en échec` : '\ntout est vert');
process.exit(failures ? 1 : 0);
