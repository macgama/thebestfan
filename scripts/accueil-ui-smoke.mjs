/**
 * Test de l'accueil : la scène du personnage.
 *
 * L'écran d'accueil du joueur connecté est un **écran de jeu** : il tient dans
 * la fenêtre, ne défile jamais, et met au centre, entre deux rails de
 * navigation, le Fanzzy équipé — ou le supporter générique quand ce Fanzzy
 * n'est pas encore illustré. Trois choses s'y vérifient mal à la lecture du
 * HTML.
 *
 *   1. **Le mouvement.** Le personnage doit respirer. C'est une animation CSS,
 *      donc seul le style calculé dans un vrai navigateur le dit.
 *
 *   2. **Le fondu entre les poses.** Deux calques superposés dont on croise les
 *      opacités. S'il n'en reste qu'un allumé, ou si les deux le sont, le
 *      changement de pose clignote — et un clignotement ne se voit pas dans le
 *      code.
 *
 *   3. **Le cadrage commun des quatre poses.** Elles sont produites ensemble
 *      par `scripts/poses-supporter.mjs`, précisément pour qu'un but ne fasse
 *      pas remonter les pieds du personnage. Des dessins de tailles
 *      différentes trahiraient un recadrage individuel.
 *
 * Avant de lancer :  npm install --no-save puppeteer
 */
import { readFileSync, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import express from 'express';
import puppeteer from 'puppeteer';
import { createFanzzy } from '../src/server/fanzzy/index.js';
import { BY_ID } from '../src/shared/fanzzy/dex.js';
import { createOnboarding } from '../src/server/onboarding/index.js';
import { createNiveau } from '../src/server/niveau/index.js';
import { seuil } from '../src/shared/niveau.js';
import { charger as chargerCatalogue } from '../src/server/fanzzy/catalogue.js';
import { chargerTenues } from '../src/server/fanzzy/tenues.js';
import { baseDeTest, OPTIONS_BASE } from './base-de-test.mjs';

const DB = baseDeTest();
const RACINE = fileURLToPath(new URL('..', import.meta.url));

/**
 * Un Fanzzy **réellement dessiné**, lu sur le disque.
 *
 * La suite nommait 'TR37' en dur comme « le Fanzzy illustré ». Le jour où ce
 * dessin est parti — il montrait Le Petit Teigneux sous un autre nom — dix
 * contrôles sont devenus rouges sans que rien ne soit cassé dans le jeu : ils
 * éprouvaient une carte qui ne remplissait plus leur hypothèse.
 *
 * Un test qui écrit en dur un fait sur le contenu se casse dès que le contenu
 * bouge, et — bien pire — il peut cesser de mesurer quoi que ce soit sans le
 * dire. On demande donc au disque, et le contrôle suit le lot.
 *
 * Un **personnage**, jamais un âge supérieur : l'accueil affiche le Fanzzy
 * équipé à l'âge atteint, et équiper directement un second âge éprouverait un
 * état que le jeu ne produit pas.
 */
const IMG_FZ = path.join(RACINE, 'public', 'img', 'fanzzy');
const { DEX: CATALOGUE } = await import('../src/shared/fanzzy/dex.js');
const PUB = CATALOGUE.filter((f) => f.publie !== false);
const AGE_SUP = new Set(PUB.map((f) => f.evo).filter(Boolean));
/* `TR32` est exclu : la suite le possède déjà pour lui-même, et le choisir ici
   l'aurait inséré deux fois dans la collection du compte. */
const ILLUSTRE = PUB.find((f) => !AGE_SUP.has(f.id) && f.id !== 'TR32'
  && existsSync(path.join(IMG_FZ, f.id + '.png'))
  && existsSync(path.join(IMG_FZ, f.id + '-buste.png')))?.id;

/* ==================================== un personnage qui ressemble au catalogue

 * **Les trois personnages que cette suite éprouve sont les trois seuls qui
 * soient complets.** `TR1` et `TR2` ont leurs douze états aux trois âges,
 * `TR32` ses trois cartes : ce sont exactement les cas qui n'apprennent rien,
 * parce qu'aucun repli ne s'y déclenche jamais.
 *
 * Le catalogue, lui, est fait d'autre chose : **cent trente-six lignées sur
 * deux cent cinquante-six** ont la carte de leur premier âge et rien au-dessus.
 * C'est le cas ordinaire, celui que presque tous les joueurs ont sous les yeux,
 * et aucune suite ne le regardait.
 *
 * On en choisit donc un, et on le choisit **à partir du disque** plutôt que de
 * l'écrire en dur : le jour où quelqu'un dessine ses âges supérieurs, ce
 * contrôle doit se déplacer tout seul sur un autre plutôt que de rougir.
 */
const parIdPub = new Map(PUB.map((f) => [f.id, f]));
const lgn = (r) => { const t = [r]; let c = r;
  while (c?.evo && parIdPub.has(c.evo)) { c = parIdPub.get(c.evo); t.push(c); } return t; };
const ORDINAIRE = PUB.filter((f) => !AGE_SUP.has(f.id) && f.id !== 'TR32' && f.id !== ILLUSTRE)
  .map(lgn)
  .find((ages) => ages.length >= 2
    && existsSync(path.join(IMG_FZ, ages[0].id + '.png'))
    && existsSync(path.join(IMG_FZ, ages[0].id + '-buste.png'))
    && !existsSync(path.join(IMG_FZ, ages[1].id + '.png'))
    && !existsSync(path.join(IMG_FZ, ages[0].id)));
if (!ORDINAIRE) throw new Error(
  'plus aucune lignée dont seul le premier âge est dessiné : ce contrôle n’a plus d’objet, '
  + 'et c’est une bonne nouvelle — le retirer.');
if (!ILLUSTRE) throw new Error(
  'aucun Fanzzy dessiné dans public/img/fanzzy : la suite ne peut rien éprouver.');

let failures = 0;
/**
 * Le temps qu'on laisse à l'écran d'ouverture pour s'en aller.
 *
 * **Lu dans `ouverture.js`**, et non recopié : il en tenait 1800 ms, il en
 * tient dix mille, et un délai recopié dans une suite est un délai qui finit
 * par mentir — trois contrôles ont expiré en annonçant « le Fanzzy ne salue
 * pas » alors que l'ouverture était simplement encore là.
 *
 * La marge est large : ce n'est pas la durée qu'on éprouve ici, c'est que
 * l'écran finisse par partir. Le contrôle qui juge vraiment la durée est celui
 * qui la mesure.
 */
const OUVERTURE_MS = (() => {
  const src = readFileSync(new URL('../public/ouverture.js', import.meta.url), 'utf8');
  const m = src.match(/const DUREE = ([\d_]+)/);
  return (m ? Number(m[1].replace(/_/g, '')) : 2000) + 4000;
})();

/**
 * Le retard de la sortie de secours de l'écran d'ouverture.
 *
 * **Lu dans `index.html`**, pour la même raison que `OUVERTURE_MS` juste
 * au-dessus : un délai recopié dans une suite est un délai qui finit par
 * mentir, et celui-ci se mesure en dizaines de secondes — le voir dériver
 * coûterait une minute d'attente par contrôle avant de comprendre.
 */
const SECOURS_MS = (() => {
  const src = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  const m = src.match(/animation:ouvTard [\d.]+s ease ([\d.]+)s/);
  return (m ? Number(m[1]) * 1000 : 12_000) + 5000;
})();

const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };

/* ------------------------------------------------------------- la base */

const mysql = await import('mysql2/promise');
const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
/* `user_nouveautes` part avec les autres, bien que cette suite ne la crée
   pas au démarrage : depuis les lots 3 et 5, le hub suit les nouveautés que
   le serveur sert, et une table laissée là par la suite précédente — avec
   ou sans lignes — décidait en silence du « +N » de FANZZY. La suite
   démarre donc sans elle (le repli, l'accueil que le reste de la suite a
   toujours vu), et le bloc des nouveautés la pose et la retire lui-même. */
await raw.query(`DROP TABLE IF EXISTS pronostics, parrainages, abonnements, achats, kop_invites, amities,
  kop_bulletins, kop_votes, kop_bonus, kop_membres, kops, user_decks, user_stuff, user_etats, user_skins, user_fanzzy,
  user_souvenirs, virage_presence, souvenirs, user_wallet, api_cache, souvenir_leagues,
  duel_results, duel_events, duels, user_league_follows, user_follows, fixture_events, standings, fixtures,
  team_leagues, teams, leagues, api_quota, login_attempts, auth_tokens, sessions, user_nouveautes, users`);
for (const f of ['auth.sql', 'football.sql', 'minutes.sql', 'couleurs.sql', 'souvenirs.sql', 'billets.sql', 'fanzzy.sql', 'inventaire.sql', 'skins.sql', 'etats.sql', 'tenues.sql',
                 'niveau.sql']) {
  await raw.query(readFileSync(path.join(RACINE, 'sql', f), 'utf8'));
}
/* La table des nouveautés, **lue dans `sql/quotidien.sql`** et non recopiée :
   une colonne ajoutée là-bas doit arriver ici sans qu'on y pense. On n'en
   extrait que cette instruction, parce que le fichier ajoute aussi des
   colonnes à des tables que ce banc ne pose pas (`saisons`), et qu'il
   échouerait joué entier. Même extraction que `boutique-smoke`. */
const TABLE_NOUVEAUTES = readFileSync(path.join(RACINE, 'sql', 'quotidien.sql'), 'utf8')
  .match(/CREATE TABLE IF NOT EXISTS user_nouveautes \([\s\S]*?\)[^;]*;/)?.[0];
if (!TABLE_NOUVEAUTES) throw new Error(
  'sql/quotidien.sql ne déclare plus user_nouveautes : le « +N » de FANZZY ne peut plus être '
  + 'éprouvé sur le chemin du serveur.');

const U = 'aaaaaaaa-0000-0000-0000-0000000000a1';
await raw.query(`INSERT INTO users (public_id,email,pseudo,password_hash)
                 VALUES (?,?,?,'x')`, [U, 'accueil@ex.fr', 'Momo']);
// `onboarded_at` renseigné : sans lui l'accueil renvoie vers /bienvenue et la
// scène n'est jamais rendue.
// Niveau 4, à mi-palier : de quoi éprouver la pastille et la jauge à la fois.
// Un joueur à zéro XP donnerait une jauge vide, qui ne prouve rien — une
// jauge cassée est vide elle aussi.
await raw.query(`INSERT INTO user_wallet (user_id,scarves,packs,xp,onboarded_at)
                 VALUES (?,90,12,?,NOW(3))`,
  [U, seuil(4) + Math.round((seuil(5) - seuil(4)) / 2)]);
for (const id of [ILLUSTRE, 'TR32']) {
  await raw.query(`INSERT INTO user_fanzzy (user_id,fanzzy_id,copies) VALUES (?,?,1)`, [U, id]);
}
await raw.query(`INSERT INTO teams (id,name) VALUES (85,'Sion'),(91,'Bâle')`);
await raw.query(`INSERT INTO user_follows (user_id,team_id,is_main) VALUES (?,85,1)`, [U]);
await raw.end();

const pool = mysql.createPool({ uri: DB, connectionLimit: 6, ...OPTIONS_BASE });
// Le catalogue vit en base depuis qu il se gère par l administration :
// on le charge comme le fait server.js, sinon les modules travaillent
// sur un catalogue vide.
await chargerCatalogue(pool);
await chargerTenues(pool);

/* -------------------------------------------- les dessins, sur le disque */

/**
 * Les quatre poses doivent exister dans les trois formats.
 *
 * Une pose absente ne casse rien — la page l'ignore exprès — mais elle ne se
 * jouera jamais, et rien à l'écran ne le dira. C'est le genre de manque qui
 * survit à une mise en ligne.
 */
const POSES = ['idle', 'push', 'goal', 'sad'];
{
  const manque = [];
  for (const p of POSES) {
    for (const ext of ['avif', 'webp', 'png']) {
      const f = path.join(RACINE, 'public', 'img', 'supporter', `${p}.${ext}`);
      if (!existsSync(f)) manque.push(`${p}.${ext}`);
    }
  }
  check('les quatre poses existent dans les trois formats', manque.length === 0);
  if (manque.length) console.log('    manquent :', manque.join(', '));

  const fond = ['avif', 'webp', 'jpg']
    .filter((e) => !existsSync(path.join(RACINE, 'public', 'img', `accueil.${e}`)));
  check('le décor de tribune est là, lui aussi', fond.length === 0);
  if (fond.length) console.log('    manquent : accueil.' + fond.join(', accueil.'));
}

/* ----------------------------------------------------------- le serveur */

const requireAuth = (r, _s, n) => { r.user = { id: U }; n(); };
const app = express();
// L'accueil interroge /api/auth/me pour savoir s'il montre la vitrine ou le hub.
app.get('/api/auth/me', (_q, s) => s.json({ user: { pseudo: 'Momo' } }));

// Le match en direct est simulé ici. La vraie route est éprouvée par
// virage-smoke ; ce qu'on veut mesurer sur cette page, c'est ce qu'elle *fait*
// de la réponse — la carte du bas, le bouton d'entrée, et la pose du
// personnage. Un talon rend le score pilotable, donc le but rejouable.
let direct = null;
/* Les autres matchs en direct, d'aucun club suivi : le bandeau du monde en
   compte la foule. */
let ailleurs = [];
app.get('/api/virage/live', (_q, s) => s.json({ matchs: [...(direct ? [direct] : []), ...ailleurs] }));

/* Ce qui attend un duel. Une file ne vit que deux minutes : c'est ce qui en
   fait un bon signal, et c'est ce que l'accueil doit dire — mais seulement
   quand elle existe. */
let attente = null;
/* Et les autres files, celles que l'alerte ne retient pas : le bandeau du
   monde les compte avec elle. */
let autres = [];
/* Le derby automatique : un supporter de l'autre club d'un match du jour est
   en ligne (`derbyPour`, serveur). */
let derby = null;
app.get('/api/nvn/attentes', (_q, s) => s.json({ attentes: [...(attente ? [attente] : []), ...autres],
                                                 alerte: attente, derby }));

/* Le relevé d'événements, tel que la base le porte. L'accueil y lit le nom du
   buteur et sa minute — sans appel à l'API, le relevé du direct les a déjà
   écrits. Un talon rend le buteur pilotable, donc le but rejouable. */
let evenements = [];
app.get('/api/football/fixture/:id/events', (_q, s) => s.json({ events: evenements }));

/* Le calendrier des clubs suivis et les premiers pas (lot 2). La bâche du
   jour y lit le prochain coup d'envoi, puis l'étape suivante du parcours :
   ce banc ne servait ni l'un ni l'autre, si bien que la bâche n'y montrait
   jamais que son repli et que rien ne vérifiait le reste.

   `null` : la route se tait comme avant (404, la page s'en passe), et les
   blocs qui ne parlent pas de la bâche voient l'accueil qu'ils ont toujours
   vu. `calendrier` est la liste `next` d'un club suivi, telle que
   `/api/football/feed` la sert ; `parcours`, la réponse de
   `/api/aide/parcours`. */
let calendrier = null;
app.get('/api/football/feed', (_q, s, n) => (calendrier === null ? n()
  : s.json({ feed: [{ team: { id: 85, name: 'Sion' }, live: [], next: calendrier, last: [] }] })));
let parcours = null;
app.get('/api/aide/parcours', (_q, s, n) => (parcours === null ? n() : s.json(parcours)));

/* L'état du jour, et le ticket « Depuis ta dernière visite » avec lui
   (contrat § 8). `null` : la route se tait (404), et l'accueil s'en passe,
   comme il l'a toujours fait sur ce banc. `depuis` n'est servi qu'avec
   `?retour=1`, comme le vrai serveur ; la marque de visite répond `ok`. */
let quotidien = null;
app.get('/api/quotidien', (q, s, n) => {
  if (quotidien === null) return n();
  const { depuis, ...reste } = quotidien;
  s.json(q.query.retour === '1' && depuis ? { ...reste, depuis } : reste);
});
app.post('/api/quotidien/visite', (_q, s, n) => (quotidien === null ? n() : s.json({ ok: true })));

/* Le Fanzzy équipé n'est pas simulé : il vit dans `user_wallet.active_fanzzy`
   et le vrai module fanzzy le sert. On l’équipe donc en base, comme le ferait
   le joueur depuis son classeur — c’est précisément le chemin qui était faux,
   l’accueil lisant le premier Fanzzy du deck au lieu de celui-là. */
const equiper = async (id, stade = 1) => {
  await pool.query(
    `INSERT INTO user_fanzzy (user_id, fanzzy_id, copies, stage) VALUES (?, ?, 1, ?)
     ON DUPLICATE KEY UPDATE stage = VALUES(stage)`, [U, id, stade]);
  await pool.query('UPDATE user_wallet SET active_fanzzy = ? WHERE user_id = ?', [id, U]);
};

const niveau = createNiveau({ pool, requireAuth });
app.use('/api/niveau', niveau.router);
/* Un retard que le test allume quand il veut.

   Le défaut filmé se joue **dans l'intervalle** entre le chargement de la
   page et la réponse du serveur : sur une machine locale, cet intervalle dure
   dix millisecondes et rien ne s'y observe. On l'allonge donc à la demande —
   c'est la seule façon de regarder ce qu'un joueur voit sur son téléphone,
   où trois allers-retours prennent une demi-seconde. */
let retardFanzzy = 0;
app.use('/api/fanzzy', (q, s2, n) => {
  if (!retardFanzzy) return n();
  setTimeout(n, retardFanzzy);
});
app.use('/api/fanzzy', createFanzzy({ pool, requireAuth, niveau }).router);
app.use('/api/me', createOnboarding({ pool, requireAuth }).router);
app.get('/', (_q, s) => s.sendFile(path.join(RACINE, 'public', 'index.html')));
app.use(express.static(path.join(RACINE, 'public')));

const http = createServer(app);
await new Promise((r) => http.listen(0, r));
const base = `http://localhost:${http.address().port}`;

/* -------------------------------------------------------------- la page */

const nav = await puppeteer.launch({ args: ['--no-sandbox'] });
const erreurs = [];

/** Le premier dessin qui s'affiche pour de bon, ou '' si rien ne vient. */
/** Attend qu'une condition devienne vraie, ou renonce. */
async function jusqua(fn, ms = 4000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await fn()) return true;
    await new Promise((r) => setTimeout(r, 60));
  }
  return false;
}

async function jusquaSrc(page, ms = 1200) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const src = await page.evaluate(() =>
      document.querySelector('#pile .pose.on')?.getAttribute('src') ?? '');
    if (src) return src;
    await new Promise((r) => setTimeout(r, 40));
  }
  return '';
}

/**
 * Une visite, dans un navigateur qui ne se souvient de rien.
 *
 * Chaque appel ouvre un **contexte isolé** : l'accueil retient désormais, d'une
 * visite à l'autre, quel personnage il a montré — c'est ce qui évite qu'un
 * inconnu occupe l'écran pendant que le serveur répond. Ce souvenir est juste,
 * et il fausserait pourtant tous les contrôles qui décrivent un joueur arrivant
 * pour la première fois. Une page ouverte ici est donc quelqu'un qui n'est
 * jamais venu ; un  sur cette page est un rafraîchissement, avec sa
 * mémoire — et les deux ont chacun leurs contrôles.
 */
async function ouvrir(largeur = 400, hauteur = 880, avant = null) {
  const contexte = await (nav.createBrowserContext?.() ?? nav.createIncognitoBrowserContext());
  const page = await contexte.newPage();
  page.on('pageerror', (e) => erreurs.push(e.message));
  await page.setViewport({ width: largeur, height: hauteur });
  /* On note les gestes joués plutôt que les classes qui les portent.
     Une classe de geste est retirée dès l'animation finie — il le faut, sinon
     elle remplacerait pour toujours la respiration qui tourne en boucle — donc
     la lire après coup ne prouve rien. Le journal, lui, garde la trace, et il
     survit à un rechargement puisqu'il est réinstallé à chaque document.

     **Les visages aussi** (`__visages`) : le dessin du calque visible, à
     chaque fois qu'il change. Le récit d'un match se joue au lever du
     rideau, avant que cette fonction rende la main ; le guetter après coup
     le manquerait. */
  await page.evaluateOnNewDocument(() => {
    window.__gestes = [];
    addEventListener('animationstart', (e) => window.__gestes.push(e.animationName), true);
    window.__visages = [];
    addEventListener('DOMContentLoaded', () => {
      const pile = document.getElementById('pile');
      if (!pile) return;
      const noter = () => {
        const src = pile.querySelector('.pose.on')?.getAttribute('src') ?? '';
        if (src && window.__visages.at(-1)?.src !== src) {
          window.__visages.push({ t: performance.now(), src });
        }
      };
      new MutationObserver(noter).observe(pile,
        { subtree: true, attributes: true, attributeFilter: ['class', 'src'] });
      /* **Et ce qu'il dit** (`__paroles`) : chaque parole du Fanzzy, son
         moment, sa ligne et son adresse, au moment où elle s'écrit. */
      const bulle = document.getElementById('bulle');
      if (!bulle) return;
      window.__paroles = [];
      new MutationObserver(() => {
        const quoi = bulle.dataset.parole;
        const texte = bulle.textContent;
        const der = window.__paroles.at(-1);
        if (quoi && !(der && der.quoi === quoi && der.texte === texte && der.encore)) {
          if (der) der.encore = false;
          window.__paroles.push({ t: performance.now(), quoi, texte,
            href: bulle.getAttribute('href'), encore: true });
        } else if (!quoi && der) der.encore = false;
      }).observe(bulle, { attributes: true, childList: true, characterData: true, subtree: true });
    });
  });
  /* Ce que le navigateur sait avant la première ligne de la page : la marque
     d'une visite d'avant, par exemple. */
  if (avant) await page.evaluateOnNewDocument(avant.fn, ...(avant.args ?? []));
  await page.goto(base + '/', { waitUntil: 'networkidle0' });
  await page.waitForSelector('#hub.on', { timeout: 8000 }).catch(() => {});
  await page.waitForSelector('#pile .pose.on[src]', { timeout: 8000 }).catch(() => {});
  /* L écran d ouverture couvre la page — c est son travail. Tant qu il est
     là, un clic sur le bouton du menu tombe sur lui : les contrôles qui
     suivent éprouveraient donc l ouverture au lieu de l accueil, et le
     rougissement ne dirait pas ce qui ne va pas. On attend qu il parte. */
  await page.waitForFunction(() => !document.getElementById('ouverture'),
    { timeout: OUVERTURE_MS }).catch(() => {});

  /* **La mise en page a fini de bouger.**

     Sans cette attente, cette fonction rendait la page à un instant qui ne
     dépendait de rien de mesurable : elle rendait la main dès que l'écran
     d'ouverture partait, et cet écran tenait dix secondes. Dix secondes
     pendant lesquelles les polices finissaient de charger et le dessin du
     personnage de se décoder — si bien que la suite mesurait toujours une
     page posée, **par accident**.

     Le jour où l'ouverture a retrouvé ses sorties et n'a plus tenu que mille
     deux cents millisecondes, la mesure est tombée à un pixel du seuil :
     557 px sur 844, contre 66 % demandés. Le contrôle a rougi sans qu'une
     seule ligne de l'accueil ait changé.

     Une suite qui s'appuie sur la durée d'une animation pour savoir quand
     regarder n'éprouve pas la page : elle éprouve l'animation. On attend
     donc les deux seules choses qui déplacent encore quelque chose — les
     polices, et le dessin — et plus jamais une horloge. */
  await page.evaluate(async () => {
    await document.fonts?.ready;
    const pose = document.querySelector('#pile .pose.on[src]');
    if (pose && !pose.complete) {
      await new Promise((fini) => {
        pose.addEventListener('load', fini, { once: true });
        pose.addEventListener('error', fini, { once: true });
      });
    }
    /* Deux cadres : le premier applique ce que le chargement vient de
       changer, le second laisse la mise en page se stabiliser dessus. */
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }).catch(() => {});

  return page;
}

/** L'état des deux calques : lequel est visible, et sur quel dessin. */
/**
 * Attend qu'une pose donnée s'affiche.
 *
 * La scène **traverse** un état : un but fait tressaillir le personnage, il ne
 * le fige pas. Entre l'aller-retour réseau et la durée de l'animation, le
 * moment où l'image est à l'écran ne se prédit pas — il se guette.
 */
const posePassePar = async (page, motif, ms = 5000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (motif.test((await scene(page)).src ?? '')) return true;
    await new Promise((r) => setTimeout(r, 60));
  }
  return false;
};

const scene = (page) => page.evaluate(() => {
  const calques = [...document.querySelectorAll('#pile .pose')];
  const visible = calques.find((c) => c.classList.contains('on'));
  const pile = document.getElementById('pile');
  const s = visible ? getComputedStyle(visible) : null;
  return {
    calques: calques.length,
    allumes: calques.filter((c) => c.classList.contains('on')).length,
    src: visible?.getAttribute('src') ?? null,
    // La respiration vit sur la pile, pas sur l'image : c'est elle qui porte
    // l'échelle, et animer les deux calques les désynchroniserait.
    souffle: getComputedStyle(pile).animationName,
    fondu: s?.transitionProperty ?? '',
    // Deux dessins de tailles différentes trahiraient un recadrage individuel.
    taille: calques.filter((c) => c.getAttribute('src'))
      .map((c) => `${c.naturalWidth}x${c.naturalHeight}`),
  };
});

/* ------------------------------------------------ le supporter, au repos */

let page = await ouvrir();

check('le hub s’affiche', await page.$('#hub.on') !== null);

let v = await scene(page);
check('la scène porte deux calques pour le fondu', v.calques === 2);
check('un seul est allumé', v.allumes === 1);
check('au repos, c’est la pose d’attente', /\/img\/supporter\/idle\./.test(v.src ?? ''));
check('le personnage respire', /souffle/.test(v.souffle ?? ''));
check('et le changement de pose se fait en fondu', /opacity/.test(v.fondu));

// Le débordement horizontal est le défaut classique d'un personnage en grand.
check('la page ne déborde pas en largeur', await page.evaluate(() =>
  document.documentElement.scrollWidth <= document.documentElement.clientWidth));

/* ------------------------------------------------------------- l'arrivée

 * `salut` est le seul des douze états que l'accueil déclenche de lui-même :
 * « à l'arrivée sur l'accueil, une fois par session », dit `rendus.js`.
 *
 * Le supporter générique n'a pas ce dessin, et c'est précisément le cas qu'il
 * faut éprouver ici : le geste doit se voir quand même. Sinon l'accueil ne
 * salue que les personnages illustrés — deux cents sur quatre cent soixante —
 * et l'animation ne serait presque jamais jouée. Le dessin, lui, est éprouvé
 * plus bas avec le Fanzzy qui l'a.
 *
 * Ce sont des classes sur la scène et non des boutons : rien ne déclenche un
 * état à la main sur cet écran, c'est le jeu qui les donne. */
{
  await page.waitForFunction(
    () => window.__gestes.includes('coucou'), { timeout: 4000 }).catch(() => {});
  const gestes = await page.evaluate(() => window.__gestes);
  check('le personnage entre dans le cadre à l’arrivée', gestes.includes('arrivee'));
  check('et fait le geste du salut, même sans ce dessin', gestes.includes('coucou'));
  check('sans dessin de salut, il reste sur le sien',
    /\/img\/supporter\/idle\./.test((await scene(page)).src ?? ''));
  /* **Aucun bouton d'état du personnage**, et non plus « aucun `data-etat` ».

     Ce contrôle visait les boutons qui déclencheraient à la main un des douze
     états du personnage — ceux de la fiche portent `data-etat`. Depuis le
     lot 2, les tuiles du hub et du tiroir portent aussi `data-etat`, et c'est
     voulu : le direct, la récompense prête, la nouveauté, la porte fermée,
     c'est-à-dire ce qui attend derrière la tuile, posé par le jeu. Compter
     les `data-etat` faisait donc rougir le contrôle pour une chose qu'il ne
     visait pas.

     Il garde son sens : tout `data-etat` de l'écran doit être une tuile
     (un lien `.tbf-case`, jamais un bouton), et porter un état de tuile.
     Ces états sont **lus dans `ui.css`**, et non recopiés : ce sont ceux que
     la feuille sait dessiner sur une tuile. Une feuille où on ne les trouve
     plus laisse la liste vide, et le contrôle rougit au lieu de tout
     laisser passer. */
  const ETATS_TUILE = [...readFileSync(new URL('../public/ui.css', import.meta.url), 'utf8')
    .matchAll(/\.tbf-case\[data-etat="?([a-z]+)"?\]/g)].map((m) => m[1]);
  const marques = await page.evaluate(() => [...document.querySelectorAll('[data-etat]')]
    .map((n) => ({ tuile: n.matches('a.tbf-case[href]'), etat: n.dataset.etat,
      quoi: `${n.tagName.toLowerCase()}${n.id ? '#' + n.id : ''}`
        + `[${n.getAttribute('class') ?? ''}]=${n.dataset.etat}` })));
  const intrus = marques.filter((m) => !m.tuile || !ETATS_TUILE.includes(m.etat));
  check('aucun bouton d’état sur l’écran', intrus.length === 0
    || (console.log('        ', intrus.map((m) => m.quoi).join(' · '),
      '— états de tuile lus :', ETATS_TUILE.join(', ') || 'aucun'), false));

  /* Un geste fini rend la main à ce qui tournait en boucle.
     La classe qui le porte prend son calque : laissée en place, elle fige le
     personnage sur la dernière image d'un geste terminé. Rien ne casse, rien
     ne se voit — le mouvement manque, c'est tout. Le petit saut avait ce
     défaut depuis toujours : il prenait `.flotte`, où tournait le flottement.

     **Depuis le lot 2, `.flotte` ne tourne plus en boucle**, et c'est voulu.
     Le flottement et la respiration sont une seule animation, `souffle`, sur
     la pile : le hub tient ainsi son budget de trois animations infinies, et
     les deux mouvements restent en phase. Chercher le nom `flotteur` sur
     `.flotte` faisait rougir le contrôle pour une boucle qui a seulement
     changé de calque.

     Il garde ses deux moitiés. Le calque des gestes est rendu : une fois le
     saut joué, `.flotte` ne porte plus aucune animation — un saut ou une
     arrivée restés accrochés y figeraient tous les sauts suivants. Et la
     boucle qui tourne encore sur la pile flotte toujours : sa règle
     `@keyframes`, **lue dans les feuilles de la page** et non recopiée, doit
     déplacer le personnage en hauteur (un `translateY` non nul) et tourner
     sans fin. Une respiration qui aurait perdu son flottement en route — ou
     une règle introuvable — laisse ce contrôle rouge. */
  await page.evaluate(() => TBF.pose('but'));
  await page.evaluate(() => document.getElementById('scene').dispatchEvent(
    new PointerEvent('pointerdown', { bubbles: true })));
  await new Promise((r) => setTimeout(r, 1800));
  const boucles = await page.evaluate(() => {
    const pile = getComputedStyle(document.getElementById('pile'));
    const noms = pile.animationName.split(',').map((n) => n.trim());
    // Les pas des règles @keyframes de la pile, dans toutes les feuilles de la
    // page. Une feuille d'une autre origine (Google Fonts) refuse qu'on lise
    // ses règles : on la saute, elle ne porte aucune animation.
    const pas = [];
    const parcourir = (regles) => {
      for (const r of regles) {
        if (r instanceof CSSKeyframesRule) {
          if (noms.includes(r.name)) pas.push(...[...r.cssRules].map((k) => k.style.transform));
        } else if (r.cssRules) parcourir(r.cssRules);
      }
    };
    for (const f of document.styleSheets) {
      let regles;
      try { regles = f.cssRules; } catch { continue; }
      parcourir(regles);
    }
    return {
      pile: pile.animationName,
      tours: pile.animationIterationCount,
      pas,
      flotte: getComputedStyle(document.querySelector('.flotte')).animationName,
      classes: [...document.getElementById('scene').classList],
    };
  });
  check('après un saut et un coucou, il respire encore', /souffle/.test(boucles.pile));
  check('le saut a rendu son calque', boucles.flotte === 'none'
    || (console.log('        .flotte porte encore', boucles.flotte), false));
  const monte = boucles.pas.some((t) => [...(t ?? '').matchAll(/translateY\(\s*([-\d.]+)/g)]
    .some((m) => Number.parseFloat(m[1]) !== 0));
  check('et il flotte encore', monte && /infinite/.test(boucles.tours)
    || (console.log('        boucle', boucles.pile, boucles.tours, '· pas :',
      boucles.pas.join(' | ') || 'aucune règle lue'), false));
  check('aucune classe de geste ne reste accrochée',
    !boucles.classes.some((c) => ['arrive', 'coucou', 'saute', 'change'].includes(c))
    || (console.log('        il reste', boucles.classes.join(' ')), false));
  await page.evaluate(() => TBF.pose('neutre'));
  await new Promise((r) => setTimeout(r, 400));
}

/* ------------------------------------------------- la place du personnage

 * Il tient le centre de l'écran : c'est lui qu'on vient voir. Les deux
 * moitiés de la même exigence se contrôlent ensemble — assez grand pour être
 * le sujet, jamais plus grand que sa bande.
 *
 * La bande centrale est close par `overflow:hidden` : un personnage trop haut
 * pour elle n'y est pas réduit, il y est décapité. Une tête coupée se lit
 * comme une image cassée, pas comme un cadrage serré, et c'est le seul défaut
 * que grandir le personnage pouvait introduire. */
{
  const m = await page.evaluate(() => {
    const p = document.getElementById('pile').getBoundingClientRect();
    const c = document.querySelector('.centre').getBoundingClientRect();
    return { haut: p.top, bas: p.bottom, hauteur: p.height,
             bandeHaut: c.top, bandeBas: c.bottom, ecran: innerHeight };
  });
  check('le personnage occupe plus de la moitié de la hauteur',
    m.hauteur > m.ecran * 0.55 || (console.log(`        ${Math.round(m.hauteur)} px sur ${m.ecran}`), false));
  check('sans dépasser de sa bande',
    m.haut >= m.bandeHaut - 1 && m.bas <= m.bandeBas + 1
    || (console.log(`        ${Math.round(m.haut)}–${Math.round(m.bas)} dans `
      + `${Math.round(m.bandeHaut)}–${Math.round(m.bandeBas)}`), false));
}

/* **Les calques de gestes tiennent toute la largeur de la scène.** La pile
   tire sa largeur de sa hauteur ; ajustés à leur contenu, ces calques
   demandaient sa largeur à la pile avant que sa hauteur ne soit connue, et
   Firefox (140 ESR) répondait zéro : plus de personnage sur l'accueil, que
   ce Chrome dessinait pourtant. Ce contrôle ne voit pas Firefox ; il garde
   la règle qui l'a réparé (voir `.flotte,.bascule,.salut`).

   **Sur un écran d'ordinateur**, le seul où la scène est plus large que le
   personnage : un calque ajusté à son contenu s'y voit, il fait la largeur
   du personnage. Sur un téléphone, le personnage déborde de sa colonne sous
   les rails, et ses calques s'élargissent avec lui dans les deux cas. */
{
  const p = await ouvrir(1366, 682);
  await p.waitForSelector('#pile .pose.on[src]', { timeout: 8000 }).catch(() => {});
  const m = await p.evaluate(() => {
    // `offsetWidth` : la boîte de mise en page, sans les gestes qui la tournent.
    const scene = document.getElementById('scene').offsetWidth;
    return { scene, calques: ['.flotte', '.bascule', '.salut']
      .map((s) => document.querySelector(s).offsetWidth) };
  });
  check(`les calques de gestes tiennent toute la largeur de la scène (${m.calques.join(', ')} sur ${m.scene})`,
    m.calques.every((l) => l >= m.scene - 1));
  await p.close();
}


/* **Au milieu de sa scène, sur un téléphone.** Il y est plus large que la
   colonne entre les rails et passe dessous ; une colonne qui grandissait avec
   lui le poussait d'une trentaine de pixels vers la droite, loin de son
   ombre, de son décor et de son nom. Mesuré sur la mise en page
   (`offsetLeft`), sans les gestes ni la respiration qui l'inclinent. */
{
  const m = await page.evaluate(() => {
    const scene = document.getElementById('scene');
    const pile = document.getElementById('pile');
    let centre = pile.offsetWidth / 2;
    for (let el = pile; el && el !== scene; el = el.offsetParent) centre += el.offsetLeft;
    return { ecart: centre - scene.clientWidth / 2, pile: pile.offsetWidth, scene: scene.clientWidth };
  });
  check(`le personnage se tient au milieu de sa scène (écart ${Math.round(m.ecart)} px, `
    + `${Math.round(m.pile)} px dans ${Math.round(m.scene)})`, Math.abs(m.ecart) <= 2);
}


/* ------------------------------------- le personnage, sur trois écrans

 * Il est le sujet de l'écran : c'est lui qu'on vient voir, et tout le reste
 * est autour. Sur un téléphone court comme sur une tablette, il doit rester
 * la plus grande chose de la page — et ne jamais dépasser de sa bande, qui
 * est close par `overflow:hidden` et le décapiterait.
 *
 * Trois tailles, parce que la règle qui le dimensionne change entre elles et
 * qu'une seule mesure ne dit rien des deux autres : un écran court, un
 * téléphone ordinaire, une tablette en portrait.
 */
for (const [nom, l, h, plancher] of [
  // Les planchers sont ceux mesurés après l'agrandissement, moins une marge
  // de deux points : ils défendent l'acquis sans rougir au premier pixel de
  // différence entre deux versions de Chrome.
  ['téléphone court', 400, 690, 0.60],
  ['téléphone', 390, 844, 0.66],
  ['tablette', 768, 1024, 0.72],
]) {
  const p = await ouvrir(l, h);
  await p.waitForSelector('#pile .pose.on[src]', { timeout: 8000 }).catch(() => {});
  const m = await p.evaluate(() => {
    /* **On arrête la respiration avant de mesurer.**

       `.pile` porte l'animation `souffle`, qui la met à l'échelle en continu
       — et `getBoundingClientRect` rend la boîte **transformée**. Ce contrôle
       mesurait donc le personnage à l'instant où il se trouvait dans son
       cycle de trois secondes six, et le comparait à un seuil fixe.

       Il passait quand même, et pour une raison qui ne tient à rien : l'écran
       d'ouverture tenait dix secondes, ce qui plaçait la mesure toujours à la
       même phase. Le jour où cet écran a retrouvé ses sorties et n'a plus
       tenu que mille deux cents millisecondes, la même page a rendu 287×557
       au lieu de 280×561 — un rapport qui n'est même pas celui de l'élément,
       preuve qu'on mesurait une respiration.

       Une suite qui dépend de la phase d'une animation ne mesure pas ce
       qu'elle croit. On la suspend, on force le recalcul, on mesure, on la
       remet — et la valeur devient celle de la mise en page, la seule que ce
       contrôle ait jamais voulu juger. */
    const el = document.getElementById('pile');
    const avant = el.style.animation;
    el.style.animation = 'none';
    void el.offsetHeight;                 // force le recalcul

    const pile = el.getBoundingClientRect();
    const bande = document.querySelector('.centre').getBoundingClientRect();
    const vu = {
      hauteur: pile.height, largeur: pile.width, ecran: innerHeight,
      haut: pile.top, bas: pile.bottom, bandeHaut: bande.top, bandeBas: bande.bottom,
      bandeH: bande.height,
    };

    el.style.animation = avant;
    return vu;
  });
  const part = m.hauteur / m.ecran;
  check(`${nom} : le personnage tient la page (${Math.round(part * 100)} %)`,
    part > plancher
    || (console.log(`        ${Math.round(m.hauteur)} px sur ${m.ecran}, `
      + `bande de ${Math.round(m.bandeH)} px`), false));
  check(`${nom} : et il ne dépasse pas de sa bande`,
    m.haut >= m.bandeHaut - 1 && m.bas <= m.bandeBas + 1
    || (console.log(`        ${Math.round(m.haut)}–${Math.round(m.bas)} dans `
      + `${Math.round(m.bandeHaut)}–${Math.round(m.bandeBas)}`), false));
  /* La place perdue au-dessus de lui. C'est elle qu'on voyait sur les
     captures : un personnage petit au milieu d'une bande vide. */
  console.log(`        ${nom} : ${Math.round(m.largeur)}×${Math.round(m.hauteur)} `
    + `dans une bande de ${Math.round(m.bandeH)} px`);
  await p.close();
}


/* --------------------------------- le rafraîchissement, sans intrus

 * **La faute filmée.** À chaque rechargement, le supporter générique occupait
 * l'écran une demi-seconde avant d'être remplacé par le Fanzzy du joueur :
 * l'accueil posait un personnage dès sa première ligne, et n'apprenait lequel
 * qu'après trois allers-retours réseau. Le choix du joueur avait bien été
 * pris ; il arrivait simplement en second, et ce qu'on voyait d'abord était
 * quelqu'un d'autre.
 *
 * On retient donc d'une visite à l'autre qui était à l'écran. Ce contrôle
 * reproduit la scène : une première visite pour apprendre, puis un
 * rechargement pendant lequel **le serveur met une seconde à répondre**. Si
 * un inconnu doit apparaître, il apparaîtra là.
 *
 * Le retard est indispensable au contrôle : sans lui, la réponse arrive trop
 * vite pour qu'on puisse observer l'intervalle — et le contrôle passerait au
 * vert sur le code d'avant, qui avait pourtant le défaut.
 */
{
  /* Un Fanzzy équipé, sans quoi il n'y a pas d'intrus possible : le
     supporter est alors le bon personnage. */
  await equiper(ILLUSTRE);
  const page = await ouvrir();
  await page.waitForSelector('#pile .pose.on[src]', { timeout: 8000 }).catch(() => {});
  const premiere = await page.evaluate(() =>
    document.querySelector('#pile .pose.on')?.getAttribute('src') ?? '');
  check('à la première visite, le Fanzzy équipé finit par s’afficher',
    /\/img\/fanzzy\//.test(premiere)
    || (console.log('        elle montre :', premiere), false));

  /* Et il est **nommé**. Son nom n'existait que dans l'attribut `alt` de son
     image : le personnage tenait le centre de l'accueil sans que rien ne dise
     qui il est. L'âge atteint est ce qu'on paie quatre-vingt-dix écharpes pour
     obtenir — il mérite mieux qu'un dessin qu'il faut reconnaître. */
  const qui = await page.evaluate(() => ({
    visible: document.getElementById('qui')?.classList.contains('on') ?? false,
    nom: document.getElementById('quiNom')?.textContent.trim() ?? '',
    evo: document.getElementById('quiEvo')?.textContent.trim() ?? '',
    dansLEcran: (() => {
      const q = document.getElementById('qui')?.getBoundingClientRect();
      return q ? q.bottom <= innerHeight + 1 && q.left >= -1 : false;
    })(),
  }));
  check('le Fanzzy équipé est nommé à l’écran', qui.visible && qui.nom.length > 2
    || (console.log('        la plaque dit :', JSON.stringify(qui)), false));
  check('et c’est bien son nom, pas son identifiant', qui.nom !== ILLUSTRE);
  /* L'évolution ne s'annonce que si la lignée en a plusieurs : promettre
     « 1 / 3 » à un Fanzzy qui n'évolue jamais est une promesse en l'air. */
  check('son âge est annoncé, et par rapport au nombre d’âges qu’il a',
    /^ÉVOLUTION \d+ \/ \d+$/.test(qui.evo)
    || (console.log('        elle dit :', qui.evo), false));
  check('la plaque tient dans l’écran', qui.dansLEcran);
  /* Et **rien ne la recouvre**. Posée dans la scène, elle tombait sous le
     personnage, qui en occupe toute la hauteur : la mesure disait « dans
     l'écran », et on ne la voyait nulle part. `elementFromPoint` ne dit rien
     ici — la plaque est en `pointer-events:none` et ne gagne jamais — donc on
     compare les rectangles. */
  const libre = await page.evaluate(() => {
    const q = document.getElementById('qui').getBoundingClientRect();
    const img = document.querySelector('#pile .pose.on').getBoundingClientRect();
    return { chevauche: q.top < img.bottom - 1 && img.top < q.bottom - 1,
             haute: q.height > 8 };
  });
  check('et le personnage ne lui passe pas dessus', libre.chevauche === false);
  check('elle a bien une hauteur', libre.haute);

  // Le serveur traîne : c'est l'intervalle qu'on veut regarder.
  retardFanzzy = 1000;
  await page.reload({ waitUntil: 'domcontentloaded' });

  /* On relève **tout ce qui s'affiche**, du premier dessin décodé jusqu'à la
     réponse du serveur. Un seul relevé ne dirait rien : l'intrus durait moins
     d'une seconde, et c'est précisément ce qu'il faut attraper. */
  const vus = new Set();
  let arriveA = null;
  const t0 = Date.now();
  while (Date.now() - t0 < 1400) {
    const src = await page.evaluate(() =>
      document.querySelector('#pile .pose.on')?.getAttribute('src') ?? '');
    if (src) {
      if (arriveA === null) arriveA = Date.now() - t0;
      vus.add(src.replace(/\?.*$/, ''));
    }
    await new Promise((r) => setTimeout(r, 40));
  }
  retardFanzzy = 0;

  const intrus = [...vus].filter((s) => s.includes('/img/supporter/'));
  check('au rechargement, aucun inconnu ne passe devant',
    intrus.length === 0
    || (console.log('        vus :', [...vus].join(' puis ')), false));
  /* **Tout de suite**, et c'est la moitié qui compte. Sans le souvenir, la
     page attendrait la réponse du serveur — une seconde ici — avant de poser
     qui que ce soit : l'écran resterait vide. Ce n'est pas un intrus, mais ce
     n'est pas non plus ce qu'on veut, et le contrôle d'à côté ne le voit pas.

     Six cents millisecondes : largement au-dessus d'un dessin déjà en cache,
     largement en dessous des mille du serveur. */
  check('et sans attendre le serveur',
    arriveA !== null && arriveA < 600
    || (console.log('        il arrive après', arriveA, 'ms'), false));
  check('et c’est bien le Fanzzy du joueur qui est là, tout de suite',
    [...vus].every((s) => /\/img\/fanzzy\//.test(s)) && vus.size > 0
    || (console.log('        vus :', [...vus].join(' puis ')), false));

  await page.close();
}

/* ------------------------------------- et quand il n'y a pas de Fanzzy

   Le supporter n'est pas un intrus : sans Fanzzy équipé, c'est **le bon**
   personnage. Le souvenir retient donc aussi cette réponse-là, pour que la
   visite suivante l'affiche tout de suite lui aussi. */
{
  await pool.query('UPDATE user_wallet SET active_fanzzy = NULL WHERE user_id = ?', [U]);
  const page = await ouvrir();
  await page.waitForSelector('#pile .pose.on[src]', { timeout: 8000 }).catch(() => {});
  check('sans Fanzzy équipé, c’est le supporter qui tient l’écran',
    /\/img\/supporter\//.test(await page.evaluate(() =>
      document.querySelector('#pile .pose.on')?.getAttribute('src') ?? '')));

  retardFanzzy = 1000;
  await page.reload({ waitUntil: 'domcontentloaded' });
  const arrive = await jusquaSrc(page, 1200);
  retardFanzzy = 0;
  check('et au rechargement il est là sans attendre le serveur',
    /\/img\/supporter\//.test(arrive)
    || (console.log('        elle montre :', arrive || '(rien)'), false));
  await page.close();
  await pool.query('UPDATE user_wallet SET active_fanzzy = ? WHERE user_id = ?', [ILLUSTRE, U]);
}


/* ------------------------- un Fanzzy grandi montre son age, pas son enfance

 * Le depot porte deux systemes d'images : les fichiers plats
 * — `/img/fanzzy/TR2.png` — que lisent les cartes, et les dossiers d'etats
 * — `/img/fanzzy/TR2/e2/base/neutre.png` — que lit l'accueil.
 *
 * Sur trois cent quatre-vingt-deux ages superieurs, douze seulement ont leur
 * fichier plat. On payait donc cent quinze echarpes pour faire grandir son
 * supporter, et la carte montrait toujours l'enfant — alors que le dessin
 * d'adulte existe pour une partie d'entre eux, range dans l'autre systeme.
 *
 * TR2 est l'un des deux personnages dont les trois evolutions sont dessinees :
 * c'est donc lui qui permet de verifier qu'un stade 2 se voit.
 */
{
  await equiper('TR2', 2);
  const page = await ouvrir();
  const vu = await jusqua(async () =>
    /\/TR2\/e2\//.test((await scene(page))?.src ?? ''), 9000);
  check('un Fanzzy au stade 2 montre le dessin de son stade', vu
    || (console.log('        la scene montre :',
      (await scene(page))?.src ?? '(rien)'), false));
  await page.close();
  await pool.query('UPDATE user_wallet SET active_fanzzy = ? WHERE user_id = ?', [ILLUSTRE, U]);
}

/* ------------------------------------------- ce qu'il porte, à côté de lui

   Les deux pièces que le deck a mises au Fanzzy montré (`wallet.stuffPorte`,
   éprouvé côté serveur par deck-smoke) sont accrochées à côté de lui, dans
   la scène, dans le cadre de leur rareté. Elles restent dans la scène et ne
   prennent pas le doigt : le personnage, dessous, répond au toucher. */
{
  const page = await ouvrir();
  await jusqua(async () => Boolean((await scene(page))?.src), 9000);
  const r = await page.evaluate(() => {
    poserSac([{ id: 'megaphone', nom: 'Mégaphone', rar: 'epique' },
      { id: 'jumelles', nom: 'Jumelles', rar: 'commune' }]);
    const porte = document.querySelector('#sac .tbf-porte');
    const sc = document.getElementById('scene').getBoundingClientRect();
    const pieces = [...document.querySelectorAll('#sac .tbf-piece')].map((p) => {
      const b = p.getBoundingClientRect();
      return { cls: [...p.classList].find((c) => c.startsWith('r-')),
        src: p.querySelector('img')?.getAttribute('src') ?? '',
        dedans: b.left >= sc.left - 1 && b.right <= sc.right + 1 && b.top >= sc.top && b.bottom <= sc.bottom,
        w: p.offsetWidth };
    });
    const doigt = porte ? getComputedStyle(porte).pointerEvents : '';
    const el = porte;
    poserSac([{ id: 'megaphone', nom: 'Mégaphone', rar: 'epique' },
      { id: 'jumelles', nom: 'Jumelles', rar: 'commune' }]);
    const meme = document.querySelector('#sac .tbf-porte') === el;
    return { pieces, doigt, meme, nom: porte?.getAttribute('aria-label') ?? '' };
  });
  if (process.env.SHOT) {
    await new Promise((res) => setTimeout(res, 900));
    await page.screenshot({ path: process.env.SHOT + '/accueil-sac.png' });
  }
  const vide = await page.evaluate(() => { poserSac([]); return document.querySelectorAll('#sac .tbf-porte').length; });
  check(`ses deux pièces sont accrochées dans la scène (${r.pieces.map((p) => p.cls).join(', ')})`,
    r.pieces.length === 2 && r.pieces[0].cls === 'r-epique' && r.pieces[1].cls === 'r-commune'
    && /\/img\/stuff\/megaphone\./.test(r.pieces[0].src) && r.pieces.every((p) => p.dedans && p.w >= 30)
    || (console.log('        ', JSON.stringify(r.pieces)), false));
  check('elles ne prennent pas le doigt au personnage', r.doigt === 'none');
  check('le même sac ne se redessine pas', r.meme);
  check('sans pièce, rien d’accroché', vide === 0);
  await page.close();
}

/* ------------------------------------------------------ changer de pose */

// `window.TBF` est la poignée que la page expose. On passe par elle plutôt
// que d'attendre un vrai but, qui mettrait vingt-cinq secondes à venir.
//
// Les noms sont ceux du catalogue — `but`, `encaisse` — et non les noms de
// fichiers du supporter. L'accueil parlait sa propre langue tant qu'il n'avait
// que quatre dessins ; depuis qu'il affiche des Fanzzy, il emploie celle de
// `fanzzy-etats.js`, et deux vocabulaires pour la même chose finissent
// toujours par diverger.
await page.evaluate(() => TBF.pose('but'));
await new Promise((r) => setTimeout(r, 500));
v = await scene(page);
check('après un but, le dessin change', /\/img\/supporter\/goal\./.test(v.src ?? ''));
check('et il n’y a toujours qu’un calque allumé', v.allumes === 1);

const tailles = new Set(v.taille);
check('les deux poses ont exactement le même cadrage', tailles.size === 1);
if (tailles.size > 1) console.log('    tailles :', [...tailles].join(' / '));

await page.evaluate(() => TBF.pose('encaisse'));
await new Promise((r) => setTimeout(r, 500));
check('un but encaissé a sa propre pose',
  /\/img\/supporter\/sad\./.test((await scene(page)).src ?? ''));

// Un état inconnu ne doit rien faire : mieux vaut un personnage immobile
// qu'un cadre vide.
await page.evaluate(() => TBF.pose('pizza'));
await new Promise((r) => setTimeout(r, 300));
check('un état inconnu laisse le personnage tranquille',
  /\/img\/supporter\/sad\./.test((await scene(page)).src ?? ''));

await page.close();

/* ------------------------------------------------- le Fanzzy au centre

   Dès que le joueur a un deck, c'est son premier Fanzzy qui tient l'écran, et
   il doit y vivre les mêmes moments que le supporter — sinon les états
   dessinés à grands frais ne servent qu'au classeur.

   Le Fanzzy d'essai est celui dont la chaîne d'images a produit les douze
   états. S'il n'est pas encore passé par elle, on saute la section plutôt que
   d'échouer : c'est de l'art en cours de production, pas du code cassé.      */

{
  const manifeste = path.join(RACINE, 'public', 'img', 'fanzzy', 'index.json');
  const catalogue = existsSync(manifeste)
    ? JSON.parse(readFileSync(manifeste, 'utf8')).fanzzy ?? {}
    : {};
  // On cherche un Fanzzy qui a vraiment les états qu'on va demander : prendre
  // le premier venu ferait échouer le test le jour où quelqu'un produit un
  // stade partiel en premier.
  const ID = Object.keys(catalogue).find((id) => {
    const e = catalogue[id].evolutions?.e1?.skins?.base?.etats ?? [];
    return ['neutre', 'but', 'encaisse'].every((x) => e.includes(x));
  });

  if (!ID) {
    console.log('  --   aucun Fanzzy complet dans index.json : section sautée');
  } else {
    await equiper(ID);
    page = await ouvrir();
    await page.waitForFunction((id) =>
      document.querySelector('#pile .pose.on')?.getAttribute('src')?.includes(`/${id}/`),
    { timeout: 8000 }, ID).catch(() => {});

    /* Le salut, avec son dessin.
       C'est le premier de lui qu'on voit : il salue, puis il rend la main. Le
       salut est un moment, pas un état — un personnage qui reste bras levés
       n'accueille plus, il attend. */
    const attendre = (motif) => page.waitForFunction((id, m) =>
      (document.querySelector('#pile .pose.on')?.getAttribute('src') ?? '')
        .includes(`/${id}/e1/base/${m}.`), { timeout: 6000 }, ID, motif)
      .then(() => true).catch(() => false);

    check('le Fanzzy équipé salue en arrivant', await attendre('salut'));
    check('puis il rend la main au repos', await attendre('neutre'));

    v = await scene(page);
    check('le Fanzzy équipé remplace le supporter',
      new RegExp(`/img/fanzzy/${ID}/e1/base/neutre\\.`).test(v.src ?? ''));
    check('sa révision est dans l’adresse', /\?v=\d+/.test(v.src ?? ''));
    /* **Le nom se lit dans le catalogue, il ne s'écrit pas ici.** `ID` est
       choisi plus haut par ce qui est dessiné — et le jour où une lignée neuve
       passe devant dans `index.json`, c'est elle qu'on équipe. Le contrôle
       attendait « Teigneux » : il a rougi le soir où LA REPRISE est arrivée,
       en annonçant une panne d'accessibilité là où il n'y avait qu'un autre
       personnage. Un test qui nomme sa donnée mesure l'ordre du dossier. */
    const attendu = BY_ID.get(ID)?.nom ?? '';
    const alt = await page.$eval('#pile .pose.on', (n) => n.alt);
    check(`il porte son nom pour qui ne voit pas l’écran — ${attendu}`,
      !!attendu && alt.includes(attendu)
      || (console.log('        alt :', alt), false));

    await page.evaluate(() => TBF.pose('but'));
    await new Promise((r) => setTimeout(r, 600));
    v = await scene(page);
    check('il exulte avec son propre dessin',
      new RegExp(`/img/fanzzy/${ID}/e1/base/but\\.`).test(v.src ?? ''));

    // La promesse du cadrage commun de `fanzzy-art.mjs` : l'union des boîtes de
    // tous les états. Deux tailles différentes ici et les pieds du personnage
    // remonteraient au moment du but.
    const t = new Set(v.taille);
    check('tous ses états partagent un cadrage', t.size === 1);
    if (t.size > 1) console.log('    tailles :', [...t].join(' / '));

    await page.evaluate(() => TBF.pose('neutre'));
    await new Promise((r) => setTimeout(r, 400));
    check('et il revient au repos', /neutre\./.test((await scene(page)).src ?? ''));

    /* Une fois par session, et pas une de plus.
       Un rechargement dans le même onglet ne rejoue rien : c'est ce que
       retient `sessionStorage`, et c'est ce qui sépare un personnage
       accueillant d'un personnage insistant. Quelqu'un qui fait dix
       allers-retours vers son classeur ne veut pas dix coucous. */
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('#pile .pose.on[src]', { timeout: 8000 }).catch(() => {});
    await page.waitForFunction(
      () => window.__gestes.includes('arrivee'), { timeout: 6000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 1200));
    const apres = await page.evaluate(() => window.__gestes);
    check('il ne resalue pas au rechargement suivant', !apres.includes('coucou'));
    check('mais il entre quand même dans le cadre', apres.includes('arrivee'));

    await page.close();

    /* --------------------------------- l'âge atteint, pas le premier

       Chez soi, le personnage se montre tel que le joueur l'a fait grandir :
       celui qui a payé quatre-vingt-dix écharpes doit voir son Capo sur son
       écran d'accueil. C'est l'inverse du duel, où tout le monde entre au
       premier âge — et c'est cohérent, le duel est une rencontre, l'accueil
       est chez soi.

       On ne l'éprouve que si le second âge est dessiné : sinon le repli
       ramènerait au premier, ce qui serait le bon comportement mais ne
       prouverait rien.                                                      */
    const e2 = catalogue[ID].evolutions?.e2?.skins?.base?.etats ?? [];
    if (!e2.length) {
      console.log('  --   pas de second âge dessiné : section sautée');
    } else {
      await equiper(ID, 2);
      page = await ouvrir();
      await page.evaluate((etat) => TBF.pose(etat), e2[0]);
      check('au stade 2, c’est le second âge qui s’affiche',
        await posePassePar(page, new RegExp(`/img/fanzzy/${ID}/e2/base/${e2[0]}\\.`)));

      /* Et un état que le second âge n'a pas ne laisse pas de trou : il retombe
         sur `neutre` du *même* âge, pas sur la bonne pose d'un âge d'avant.

         L'ordre est celui que `fanzzy-etats.js` écrit noir sur blanc — bonne
         pose, quitte à changer de skin ; puis `neutre` ; et descendre d’un âge
         seulement en tout dernier recours. Un skin est un costume : l'échanger
         garde la silhouette. Un âge est un autre personnage : le voir rajeunir
         deux secondes et demie pendant le but, puis vieillir d’un coup, se lit
         comme une panne, pas comme un repli. Le son et la confettis portent le
         moment ; le dessin, lui, doit rester le sien.

         Cette section a dormi tant que TR1 n’avait qu’un âge dessiné. Elle
         parle enfin — et c’est bien pour ça qu’on l’avait écrite. */
      const absent = ['but', 'encaisse', 'salut'].find((x) => !e2.includes(x));
      if (absent) {
        await page.evaluate((etat) => TBF.pose(etat), absent);
        await new Promise((r) => setTimeout(r, 600));
        const src = (await scene(page)).src ?? '';
        check('un état absent du second âge garde l’âge et prend le repos',
          new RegExp(`/img/fanzzy/${ID}/e2/base/neutre\.`).test(src)
          || (console.log('        il affiche', src), false));
      }
      await page.close();
      await equiper(ID, 1);
    }
  }

  /* ------------------------- illustré, mais sans ses douze états

     C'est le cas de deux cents Fanzzy sur quatre cent soixante, et c'était le
     trou : l'accueil n'acceptait le personnage équipé que si ses **douze
     états** étaient dessinés — un seul les a. Tous les autres laissaient la
     place au supporter générique.

     Or le supporter générique n'est pas « le personnage sans animation » :
     c'est **quelqu'un d'autre**. Le joueur qui choisit Le Fumigène et voit un
     inconnu sur son écran d'accueil en conclut, à raison, que son choix n'a
     pas été pris. C'est exactement ce qui a été remonté.

     On retombe donc sur son plein-pied. Immobile — il ne change plus de
     dessin au but — mais c'est bien lui, et la scène bouge quand même. */
  const SANS_ETATS = Object.keys(catalogue).length
    ? [ILLUSTRE, 'TR32', 'TR39'].find((id) => !catalogue[id]) : null;
  if (!SANS_ETATS) {
    console.log('  --   tous les Fanzzy d’essai ont leurs états : section sautée');
  } else {
    await equiper(SANS_ETATS);
    page = await ouvrir();
    const vu = (await scene(page)).src ?? '';
    check('un Fanzzy illustré sans états montre quand même son plein-pied',
      new RegExp(`/img/fanzzy/${SANS_ETATS}\\.`).test(vu)
      || (console.log('        il affiche', vu), false));
    check('et surtout pas le supporter générique, qui est un autre personnage',
      !/\/img\/supporter\//.test(vu));

    /* Le dessin ne change plus au but — il n'y en a qu'un — mais la scène,
       elle, doit réagir. Sans ça le but ne se voit pas du tout. */
    await page.evaluate(() => { window.__gestes.length = 0; TBF.pose('but'); });
    await new Promise((r) => setTimeout(r, 500));
    check('un but le fait quand même tressaillir',
      (await page.evaluate(() => window.__gestes)).includes('bascule'));
    await page.close();
  }

  /* ------------------------- le manifeste des états manquant

     Il est **facultatif** : il n'apporte que les douze poses. Le plein-pied
     n'en a aucun besoin. Or tout le bloc en dépendait — `if (actif && await
     charger())` — si bien qu'un manifeste absent du serveur, ou servi en 404,
     effaçait le personnage de tout le monde et ramenait le supporter
     générique. Une pièce facultative ne doit pas emporter ce qui ne s'appuie
     pas sur elle. */
  if (SANS_ETATS) {
    await equiper(SANS_ETATS);
    const page2 = await nav.newPage();
    page2.on('pageerror', (e) => erreurs.push(e.message));
    await page2.setRequestInterception(true);
    page2.on('request', (r) => {
      if (/\/img\/fanzzy\/index\.json/.test(r.url())) r.respond({ status: 404, body: '' });
      else r.continue();
    });
    await page2.setViewport({ width: 400, height: 880 });
    await page2.goto(base + '/', { waitUntil: 'networkidle0' });
    await page2.waitForSelector('#pile .pose.on[src]', { timeout: 8000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 600));
    const vu2 = (await scene(page2)).src ?? '';
    check('sans manifeste des états, le Fanzzy garde quand même sa place',
      new RegExp(`/img/fanzzy/${SANS_ETATS}\\.`).test(vu2)
      || (console.log('        il affiche', vu2), false));
    await page2.close();
  }

  /* Sans Fanzzy choisi, le supporter générique reprend sa place — et c'est
     là, et seulement là, qu'il a le droit d'être à l'écran. */
  await pool.query('UPDATE user_wallet SET active_fanzzy = NULL WHERE user_id = ?', [U]);
  page = await ouvrir();
  check('sans Fanzzy choisi, le supporter générique tient l’écran',
    /\/img\/supporter\/idle\./.test((await scene(page)).src ?? ''));
  await page.close();
}

/* ------------------------------------------------------------- le menu

   Ce qui se vérifie **ici**, c'est le bouton de cette page et la place que le
   tiroir y trouve : l'accueil est le seul écran plein cadre du jeu, et son
   bouton est une plaque qui suit la hauteur de sa rangée, pas le bouton nu des
   autres pages.

   Ce que ce bloc vérifiait aussi — la liste des destinations, l'entrée
   d'administration, les liens qui mènent quelque part — est parti dans
   `scripts/menu-smoke.mjs`. Le menu est désormais monté par `public/menu.js`
   pour toutes les pages, et une liste relue ici en aurait fait la seconde
   copie : c'est exactement la faute que ce regroupement a corrigée. */

{
  const page = await ouvrir();
  const avant = await page.evaluate(() => ({
    cache: document.querySelector('.tbf-tiroir').hidden,
    deplie: document.getElementById('burger').getAttribute('aria-expanded'),
  }));
  check('le menu est replié au chargement', avant.cache === true && avant.deplie === 'false');

  await page.click('#burger');
  await new Promise((r) => setTimeout(r, 300));
  const apres = await page.evaluate(() => {
    const t = document.querySelector('.tbf-tiroir');
    return {
      ouvert: t.classList.contains('on') && !t.hidden,
      deplie: document.getElementById('burger').getAttribute('aria-expanded'),
      // Un menu qui sort de l'écran est un menu dont la moitié est perdue.
      dansLEcran: t.getBoundingClientRect().right <= innerWidth + 1
        && t.getBoundingClientRect().bottom <= innerHeight + 1,
    };
  });
  check('le bouton l’ouvre', apres.ouvert && apres.deplie === 'true');
  check('et il tient dans l’écran', apres.dansLEcran);

  /* **Le refermer, sur un téléphone : la croix, puis Échap.**

     Ce contrôle cliquait le voile en bas à gauche, en (20, bas − 20), pour ne
     pas viser son centre : Puppeteer clique le centre de l'élément visé, et
     l'ancien tiroir — 268 px ancrés à droite — couvrait celui du voile. Le
     tiroir du lot 2 est une bâche qui prend toute la largeur jusqu'à six
     cents pixels, et la hauteur de l'écran : à 400 × 880, elle couvre la
     fenêtre entière, et il n'y a plus de voile à côté d'elle. Le clic tombait
     sur une tuile, la page partait vers /classement, et le contrôle, ne
     trouvant plus de tiroir ouvert sur la page d'arrivée, passait à tort —
     la panne même que décrivait ce commentaire.

     Sur un téléphone, on referme donc comme un joueur le peut : par la croix
     de la tête de la bâche, puis par Échap. Et chaque fois, on vérifie qu'on
     est resté sur la même page : un tiroir « refermé » sur un autre document
     ne prouve rien. */
  const ici = page.url();
  const ouvert = () => page.evaluate(() =>
    document.querySelector('.tbf-tiroir')?.classList.contains('on') === true);
  await page.click('.tbf-tiroir-fermer');
  await new Promise((r) => setTimeout(r, 300));
  check('sa croix le referme', !(await ouvert()) && page.url() === ici
    || (console.log('        adresse :', page.url()), false));
  await page.click('#burger');
  await new Promise((r) => setTimeout(r, 300));
  const rouvert = await ouvert();
  await page.keyboard.press('Escape');
  await new Promise((r) => setTimeout(r, 300));
  check('Échap le referme aussi', rouvert && !(await ouvert()) && page.url() === ici
    || (console.log('        rouvert :', rouvert, '· adresse :', page.url()), false));
  await page.close();

  /* **Le voile, là où il se voit.** Au-delà de six cent quarante pixels, la
     bâche s'arrête à six cents et le voile paraît à côté d'elle : c'est là,
     et là seulement, qu'un joueur peut toucher « à côté ». On l'éprouve à
     1024 × 768, sur un point pris au milieu de la plus grande marge, et on
     prouve d'abord que ce point est bien le voile (`elementFromPoint`) : sans
     cette preuve, un clic qui atterrit sur autre chose passe pour une
     fermeture — c'est exactement ce qui était arrivé. Le geste reste celui
     d'un joueur : un vrai clic, et non un `.click()` provoqué en script — un
     voile qui ne recevrait pas les clics laisserait la page manipulable
     derrière lui. */
  const large = await ouvrir(1024, 768);
  const adresse = large.url();
  await large.click('#burger');
  await new Promise((r) => setTimeout(r, 300));
  const dehors = await large.evaluate(() => {
    const t = document.querySelector('.tbf-tiroir').getBoundingClientRect();
    const marges = [
      [t.left, [t.left / 2, innerHeight / 2]],
      [innerWidth - t.right, [(t.right + innerWidth) / 2, innerHeight / 2]],
      [innerHeight - t.bottom, [innerWidth / 2, (t.bottom + innerHeight) / 2]],
    ].sort((a, b) => b[0] - a[0]);
    const [x, y] = marges[0][1].map(Math.round);
    return { x, y, voile: document.elementFromPoint(x, y)?.classList.contains('tbf-voile') === true };
  });
  await large.mouse.click(dehors.x, dehors.y);
  await new Promise((r) => setTimeout(r, 300));
  check('cliquer à côté le referme', dehors.voile
    && !(await large.evaluate(() => document.querySelector('.tbf-tiroir')?.classList.contains('on')))
    && large.url() === adresse
    || (console.log(`        point (${dehors.x}, ${dehors.y})`,
      dehors.voile ? 'sur le voile' : 'hors du voile', '· adresse :', large.url()), false));
  await large.close();
}

/* --------------------------------------------- le match, et ce qu'il fait */

{
  direct = {
    id: 1, open: true, elapsed: 37, status_short: '2H',
    home_id: 85, away_id: 91, home_name: 'Sion', away_name: 'Bâle',
    home_goals: 1, away_goals: 0, crowd: [12, 9],
    // `mien` : un de mes clubs joue. Le vrai service le pose sur chaque
    // match de la liste, et l’accueil ne parle que de ceux-là.
    mien: true,
    /* Les couleurs du club, extraites une fois de son blason côté serveur.
       Volontairement sombres : c'est le cas qui compte. Une couleur de blason
       est faite pour du papier blanc, et écrite telle quelle sur le noir de
       l'écran, elle donne un « GOAL ! » invisible — un but célébré que
       personne ne voit. */
    homeColors: ['#0B1E5B', '#FFFFFF'], awayColors: [],
  };
  const page = await ouvrir();
  await new Promise((r) => setTimeout(r, 700));

  const bas = await page.evaluate(() => ({
    tag: document.getElementById('directTag').textContent,
    nom: document.getElementById('directNom').textContent,
    entrer: document.getElementById('entrer').getAttribute('href'),
    libelle: document.getElementById('entrer').textContent,
  }));
  check('la carte du bas annonce le match en cours', /37/.test(bas.tag));
  check('avec le score', /Sion 1 – 0 Bâle/.test(bas.nom));
  check('et le bouton mène au virage',
    bas.entrer === '/virage' && /virage/i.test(bas.libelle));

  check('pendant le match, le supporter pousse',
    /\/img\/supporter\/push\./.test((await scene(page)).src ?? ''));

  // Mon club marque : le personnage exulte. C'est la seule chose que cette
  // page doit savoir faire toute seule.
  direct = { ...direct, home_goals: 2 };
  await page.evaluate(() => TBF.veiller());
  check('mon club marque : il exulte',
    await posePassePar(page, /\/img\/supporter\/goal\./));

  // L'adversaire égalise : il prend sa tête dans les mains.
  direct = { ...direct, away_goals: 1 };
  await page.evaluate(() => TBF.veiller());
  check('l’adversaire marque : il encaisse',
    await posePassePar(page, /\/img\/supporter\/sad\./));

  /* ------------------------------------------- le moment fort tient

   * Les célébrations duraient deux secondes et demie. Le temps de sortir son
   * téléphone de sa poche, le personnage était revenu au repos et le but
   * n'avait laissé aucune trace — or c'est exactement à ce moment-là qu'on
   * ouvre l'application.
   *
   * Quinze secondes, et la durée vit dans `fx.js` : la règle vaut pour tous
   * les écrans où un Fanzzy réagira. Chaque page qui la recopierait finirait
   * par en avoir sa propre version. */
  {
    const tenue = await page.evaluate(() => window.FX?.MOMENT);
    check('la durée d’un moment fort est partagée par fx.js', tenue === 15000);

    direct = { ...direct, home_goals: 3 };
    await page.evaluate(() => TBF.veiller());
    await new Promise((r) => setTimeout(r, 700));

    const m = await page.evaluate(() => {
      const b = document.getElementById('moment');
      return { texte: b.textContent.trim(), visible: b.classList.contains('on') };
    });
    check('un but affiche son bandeau', m.visible && /goal/i.test(m.texte));

    /* Et il est écrit **aux couleurs du club**. Deux choses à la fois : la
       couleur vient bien du serveur (pas l'or par défaut), et elle a été
       éclaircie assez pour se lire sur le noir sans cesser d'être bleue. */
    const teinte = await page.evaluate(() => {
      const mc = document.getElementById('moment').style.getPropertyValue('--mc').trim();
      const hex = /^#([0-9a-f]{6})$/i.exec(mc);
      if (!hex) return { mc, clarte: null, bleu: null };
      const n = parseInt(hex[1], 16);
      const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      return { mc, clarte: (Math.max(r, g, b) + Math.min(r, g, b)) / 510, bleu: b > r + 20 };
    });
    check('le but s’écrit dans la couleur du club',
      /^#[0-9A-F]{6}$/i.test(teinte.mc)
      || (console.log('        il s’écrit en', teinte.mc), false));
    check('éclaircie assez pour se lire, sans cesser d’être la sienne',
      (teinte.clarte ?? 0) > 0.5 && teinte.bleu === true
      || (console.log(`        clarté ${teinte.clarte?.toFixed(2)}, bleu ${teinte.bleu}`), false));

    /* Le buteur et la minute.
       Ils arrivent **après** le score : le relevé du direct écrit l'événement
       un instant plus tard. Le bandeau annonce donc le but tout de suite et se
       complète ensuite — attendre un nom qui ne viendra peut-être jamais
       ferait manquer l'annonce elle-même.

       Le relevé semé est **celui du match tel que le tableau le dit** : les
       quatre buts de Sion, Diallo le dernier, et celui de Bâle. L'accueil ne
       nomme le buteur que d'un relevé qui compte exactement les buts du
       tableau (`buteurDe`, dans index.html). Celui d'avant ne portait que le
       but de Diallo pour un tableau de quatre — un relevé en retard, que la
       règle fait taire à dessein : le contrôle rougissait sur un silence
       voulu, et ne mesurait plus le nom. Le but de Bâle est là parce que le
       vrai relevé l'aurait : compté avec ceux de Sion, il ferait cinq pour
       quatre, et le bandeau se tairait aussi. */
    evenements = [
      { seq: 0, type: 'Goal', detail: 'Normal Goal', team_id: 85, player: 'Rey', minute: 9 },
      { seq: 1, type: 'Card', detail: 'Yellow Card', team_id: 91, player: 'Keller', minute: 12 },
      { seq: 2, type: 'Goal', detail: 'Normal Goal', team_id: 85, player: 'Fontaine', minute: 31 },
      { seq: 3, type: 'Goal', detail: 'Normal Goal', team_id: 91, player: 'Roth', minute: 40 },
      { seq: 4, type: 'Goal', detail: 'Normal Goal', team_id: 85, player: 'Morel', minute: 52 },
      { seq: 5, type: 'Goal', detail: 'Normal Goal', team_id: 85, player: 'Diallo', minute: 63 },
    ];
    direct = { ...direct, home_goals: 4 };
    await page.evaluate(() => TBF.veiller());
    await new Promise((r) => setTimeout(r, 900));
    const sous = await page.$eval('#momentSous', (n) => n.textContent.trim());
    check('le bandeau nomme le buteur et sa minute',
      /Diallo/.test(sous) && /63/.test(sous)
      || (console.log('        il dit :', JSON.stringify(sous)), false));

    /* **Un relevé en retard ne nomme personne.** Le score est écrit en base
       avant que les événements soient demandés : au but suivant, le relevé
       porte encore les quatre buts d'avant, et son dernier buteur est celui du
       but précédent. Le prendre mettait Diallo et sa 63′ sous le cinquième
       « Goal ! » — un nom faux sous une annonce vraie. On garde donc le
       relevé tel quel et Sion marque encore : le bandeau doit annoncer le
       but, et se taire sur le buteur. Lire le titre écarte le silence d'un
       bandeau qui ne serait simplement pas reparti. */
    direct = { ...direct, home_goals: 5 };
    await page.evaluate(() => TBF.veiller());
    await new Promise((r) => setTimeout(r, 900));
    const enRetard = await page.evaluate(() => ({
      titre: document.getElementById('momentTitre').textContent.trim(),
      sous: document.getElementById('momentSous').textContent.trim(),
      on: document.getElementById('moment').classList.contains('on'),
    }));
    check('relevé en retard : le but est annoncé, et personne n’est nommé',
      enRetard.on && /goal/i.test(enRetard.titre) && enRetard.sous === ''
      || (console.log('        il dit :', JSON.stringify(enRetard)), false));

    /* **Un relevé en avance ne nomme personne non plus.** L'API range sous
       « Goal » chaque tir de la séance de tirs au but, et le tableau ne le
       compte jamais : un relevé qui porte un but de Sion de plus que le score
       en contient un qui n'en est pas — ici un tir de la séance, un
       « Penalty » à la 120′, le dernier de la liste —, et rien ne dit lequel.
       C'est sur ce cas que le relevé refuse de garder le commentaire de l'API
       (`serveur/ECARTS.md`) : le compte exact suffit à se taire. Le relevé
       est à jour par ailleurs — Vidal, le cinquième but que le relevé d'avant
       n'avait pas encore, et Bonvin, celui qui tombe —, si bien qu'un `<` à
       la place du `!==` de `buteurDe` nommerait le tireur.

       Le bandeau d'avant est déjà sur « Goal ! » sans nom : sa clé dit qu'un
       nouveau moment est bien parti, sans quoi ce silence serait celui du
       bandeau précédent. */
    const cleAvance = await page.evaluate(() => document.getElementById('moment').dataset.cle);
    evenements = [
      ...evenements,
      { seq: 6, type: 'Goal', detail: 'Normal Goal', team_id: 85, player: 'Vidal', minute: 71 },
      { seq: 7, type: 'Goal', detail: 'Normal Goal', team_id: 85, player: 'Bonvin', minute: 84 },
      { seq: 8, type: 'Goal', detail: 'Penalty', team_id: 85, player: 'Tireur', minute: 120 },
    ];
    direct = { ...direct, home_goals: 6 };
    await page.evaluate(() => TBF.veiller());
    await new Promise((r) => setTimeout(r, 900));
    const enAvance = await page.evaluate(() => ({
      cle: document.getElementById('moment').dataset.cle,
      titre: document.getElementById('momentTitre').textContent.trim(),
      sous: document.getElementById('momentSous').textContent.trim(),
      on: document.getElementById('moment').classList.contains('on'),
    }));
    check('relevé en avance : le but est annoncé, et personne n’est nommé',
      enAvance.on && enAvance.cle !== cleAvance && /goal/i.test(enAvance.titre) && enAvance.sous === ''
      || (console.log('        il dit :', JSON.stringify(enAvance)), false));

    /* **Un penalty manqué n'est pas le dernier but.** L'API le range sous
       « Goal » (`Missed Penalty`). Le relevé compte ici exactement les buts du
       tableau — Gerber vient de marquer le septième —, et Zufferey rate un
       penalty juste après : le bandeau nommait celui qui venait de rater.
       Le tir de la séance du contrôle précédent est retiré du relevé : le
       compte y est alors exact, et c'est le filtre du penalty manqué, seul,
       qui décide du nom. */
    evenements = [
      ...evenements.filter((e) => e.player !== 'Tireur'),
      { seq: 9, type: 'Goal', detail: 'Normal Goal', team_id: 85, player: 'Gerber', minute: 88 },
      { seq: 10, type: 'Goal', detail: 'Missed Penalty', team_id: 85, player: 'Zufferey', minute: 90 },
    ];
    direct = { ...direct, home_goals: 7 };
    await page.evaluate(() => TBF.veiller());
    await new Promise((r) => setTimeout(r, 900));
    const manque = await page.$eval('#momentSous', (n) => n.textContent.trim());
    check('un penalty manqué derrière le dernier but : c’est le buteur qui est nommé',
      /Gerber/.test(manque) && /88/.test(manque)
      || (console.log('        il dit :', JSON.stringify(manque)), false));

    /* Sans événement en base — le cas ordinaire des premières secondes — le
       bandeau reste sur « Goal ! », ce qui est vrai. Il ne doit pas afficher
       le buteur du but précédent. */
    evenements = [];
    direct = { ...direct, home_goals: 8 };
    await page.evaluate(() => TBF.veiller());
    await new Promise((r) => setTimeout(r, 900));
    check('sans buteur connu, il n’invente rien',
      (await page.$eval('#momentSous', (n) => n.textContent.trim())) === '');

    /* ------------------------------- le but refusé par l'arbitrage vidéo

     * Le score **recule**. C'est le seul signal fiable : le libellé de
     * l'événement varie d'une compétition à l'autre, le score non. L'accueil
     * ignorait purement et simplement les écarts négatifs — un but annulé ne
     * produisait donc rien du tout, et le joueur restait sur une célébration
     * pour un but qui n'existait plus. */
    direct = { ...direct, home_goals: 7 };
    await page.evaluate(() => TBF.veiller());
    await new Promise((r) => setTimeout(r, 800));
    const refus = await page.evaluate(() => ({
      titre: document.getElementById('momentTitre').textContent.trim(),
      sous: document.getElementById('momentSous').textContent.trim(),
      pose: document.querySelector('#pile .pose.on')?.getAttribute('src') ?? '',
    }));
    check('un but annulé est annoncé comme refusé',
      /refus/i.test(refus.titre)
      || (console.log('        il dit :', JSON.stringify(refus.titre)), false));
    check('et la vidéo est nommée comme cause', /vidéo/i.test(refus.sous));
    /* `decision` est l'état prévu pour ça — « carton ou but refusé contre ton
       club ». Le supporter générique ne l'a pas dessiné : il retombe alors sur
       son repos, et c'est le bon comportement. Ce qui compte, c'est qu'il ne
       reste **pas** en train d'exulter pour un but annulé. */
    check('et le personnage cesse d’exulter',
      !/\/img\/supporter\/goal\./.test(refus.pose)
      || (console.log('        il affiche', refus.pose), false));

    // On remet un but pour la suite : les contrôles de durée en ont besoin.
    direct = { ...direct, home_goals: 8 };
    await page.evaluate(() => TBF.veiller());
    await new Promise((r) => setTimeout(r, 600));

    /* Trois secondes plus tard, tout est encore là. C'est la panne exacte :
       à deux secondes et demie, il ne restait plus rien à voir. */
    await new Promise((r) => setTimeout(r, 3000));
    const apres = await page.evaluate(() => ({
      pose: document.querySelector('#pile .pose.on')?.getAttribute('src') ?? '',
      bandeau: document.getElementById('moment').classList.contains('on'),
    }));
    check('trois secondes plus tard, il exulte encore',
      /\/img\/supporter\/goal\./.test(apres.pose)
      || (console.log('        il affiche', apres.pose), false));
    check('et le bandeau tient avec lui', apres.bandeau);
  }


  /* Le coup de sifflet final, après une célébration.
   *
   * C'est là qu'était le piège, et il ne se voyait pas : `clearTimeout`
   * annule le rappel mais laisse l'identifiant en place. `retour` restait donc
   * vrai pour toujours dès la première pose tenue, et `poserFond` — qui ne
   * pose que si aucune célébration n'est en cours — cessait définitivement
   * d'agir. Le personnage continuait de pousser une heure après la fin du
   * match, sans qu'aucune erreur ne soit levée.
   *
   * Le salut d'arrivée fait de cette première pose tenue le cas de tout le
   * monde, à chaque session : ce qui était un défaut rare devient la règle.
   * On laisse donc la célébration s'éteindre avant de couper le match — c'est
   * après elle, et seulement après, que la faute apparaissait. */
  /* On provoque une pose tenue **courte** plutôt que d'attendre les quinze
     secondes d'un vrai moment fort. Ce qui est en cause ici, c'est la reprise
     de main — pas la durée, qui a son propre contrôle plus haut. Faire
     dépendre celui-ci de l'autre le rendrait quinze fois plus lent, et il
     rougirait le jour où la durée change sans que la faute soit revenue. */
  await page.evaluate(() => TBF.pose('but', 250));
  await new Promise((r) => setTimeout(r, 800));
  check('la célébration passée, il repousse',
    /\/img\/supporter\/push\./.test((await scene(page)).src ?? '')
    || (console.log('        il affiche', (await scene(page)).src), false));

  direct = null;
  await page.evaluate(() => TBF.veiller());
  await new Promise((r) => setTimeout(r, 700));
  check('le match fini, il revient au repos',
    /\/img\/supporter\/idle\./.test((await scene(page)).src ?? ''));

  /* ------------------------------------------- le coup de sifflet final

   * Un match terminé sort de la liste des matchs **ouverts**. L'accueil
   * passait donc directement de « ton club pousse » à « aucun match en
   * cours » : la victoire — ce qu'un supporter attend le plus — n'était
   * annoncée nulle part.
   *
   * On rejoue la séquence entière, parce que l'annonce est gardée : elle ne
   * se déclenche que pour un match qu'on a vu vivre. Sans cette garde, ouvrir
   * l'accueil le lendemain matin célébrerait la victoire de la veille comme
   * si elle venait de tomber. */
  {
    direct = { id: 9, open: true, elapsed: 88, status_short: '2H', mien: true,
      home_id: 85, away_id: 91, home_name: 'Sion', away_name: 'Bâle',
      home_goals: 3, away_goals: 1, crowd: [4, 2] };
    await page.evaluate(() => TBF.veiller());
    await new Promise((r) => setTimeout(r, 500));

    direct = { ...direct, open: false, status_short: 'FT' };
    await page.evaluate(() => TBF.veiller());
    await new Promise((r) => setTimeout(r, 700));

    const m = await page.evaluate(() => {
      const b = document.getElementById('moment');
      return { texte: b.textContent.trim(), visible: b.classList.contains('on') };
    });
    check('le coup de sifflet final annonce la victoire',
      (m.visible && /victoire/i.test(m.texte))
      || (console.log('        il dit :', JSON.stringify(m)), false));
    check('et le personnage la vit', /\/img\/supporter\//.test((await scene(page)).src ?? ''));

    // Deux tours d'horloge de plus : l'annonce ne doit pas se rejouer.
    await page.evaluate(() => { document.getElementById('moment').classList.remove('on'); });
    await page.evaluate(() => TBF.veiller());
    await new Promise((r) => setTimeout(r, 600));
    check('elle ne se rejoue pas au tour suivant',
      !(await page.evaluate(() => document.getElementById('moment').classList.contains('on'))));
    direct = null;
  }

  await page.close();
}

/* ------------------------------- l’écran de jeu sur un petit téléphone

 * L’accueil ne porte pas la barre commune : ses deux rails la remplacent.
 * Ce qui doit tenir, c’est donc tout l’écran — compteurs, rails, personnage,
 * jauge et bouton d’entrée — sans un pixel de défilement. Sur 320 px, un
 * iPhone SE, c’est la contrainte réelle. */
{
  /* Avec un Fanzzy équipé : c'est le cas le plus chargé, et le seul qui
     éprouve vraiment la tenue de l'écran. La plaque qui le nomme prend de la
     hauteur, et c'est justement à trois cent vingt pixels qu'elle peut faire
     déborder le reste. La mesurer sur un écran où elle est absente ne dirait
     rien du tout. */
  await equiper(ILLUSTRE);
  const page = await ouvrir(320, 640);
  {
    const p3 = await (nav.createBrowserContext?.() ?? nav.createIncognitoBrowserContext())
      .then((c) => c.newPage());
    await p3.setViewport({ width: 400, height: 880 });
    await p3.goto(base + "/", { waitUntil: "domcontentloaded" });
    const d = await p3.evaluate(() => {
      const e = document.getElementById("ouverture");
      if (!e) return { absent: true };
      const st = getComputedStyle(e);
      const r = e.getBoundingClientRect();
      return { fond: st.backgroundColor, opacite: st.opacity, z: st.zIndex,
        couvre: r.width >= innerWidth && r.height >= innerHeight,
        dessus: document.elementFromPoint(innerWidth / 2, 40)?.id
          || document.elementFromPoint(innerWidth / 2, 40)?.className };
    });
    /* L écran d ouverture doit **couvrir**. S il laisse transparaître
       l accueil, on voit deux écrans à la fois et l arrivée est ratée — et
       c est le genre de défaut qu une capture ne tranche pas, puisqu elle
       peut attraper l écran en train de partir. */
    check("l écran d ouverture paraît à l arrivée", d.absent !== true);
    check("il est opaque", d.fond === "rgb(5, 7, 10)" && d.opacite === "1");
    check("il couvre tout l écran", d.couvre === true);
    check("et rien de l accueil ne passe devant", d.dessus === "ouverture");

    /* Et il s en va. Sans ce contrôle, une ouverture qui reste est une porte
       close : le jeu est derrière, et personne ne peut y entrer. */
    const parti = await p3.waitForFunction(() => !document.getElementById("ouverture"),
      { timeout: OUVERTURE_MS }).then(() => true).catch(() => false);
    check("puis il s en va tout seul", parti);

    /* Une fois par session, et pas une fois par visite : l accueil est
       l écran vers lequel tout revient, et rejouer l ouverture à chaque
       retour avalerait un geste à chaque fois. */
    await p3.goto(base + "/", { waitUntil: "domcontentloaded" });
    const encore = await p3.evaluate(() => Boolean(document.getElementById("ouverture")));
    check("et ne revient pas au retour suivant", encore === false);
    await p3.close();
  }

  /* ======================================== quand rien n'arrive que la page

     **C'est la panne, reproduite.** Un joueur a envoyé la capture d'un écran
     d'ouverture bloqué pour toujours. Elle disait tout : titre pas crème,
     « .ONLINE » pas doré, police serif de secours, jauge sans remplissage,
     éventail vide. Ces cinq absences ont une seule cause — `/ui.css` et les
     scripts ne sont jamais arrivés, alors que le document, lui, était là.

     Et `ouverture.js` non plus n'était pas arrivé. Or les trois sorties de
     l'écran vivent dedans : le signal de l'accueil, le doigt, la minuterie.
     **Toutes les clefs étaient restées dehors.**

     On bloque donc les requêtes à la main, ce qu'aucune autre suite ne fait,
     et pour une raison précise : c'est la seule façon d'éprouver ce qui reste
     debout quand le reste tombe. Un contrôle qui ne casse rien ne mesure
     aucun filet. */
  {
    const ctx = await (nav.createBrowserContext?.() ?? nav.createIncognitoBrowserContext());

    /* ---- 1. le plancher : la sortie qui ne dépend d'aucun fichier ----

       On ne coupe qu'`ouverture.js`. Le reste arrive, donc la sonde en ligne
       voit une page saine et ne recharge pas — ce qu'on éprouve ici est la
       sortie de secours toute seule, sans rien pour l'aider. */
    const p4 = await ctx.newPage();
    await p4.setViewport({ width: 400, height: 880 });
    await p4.setRequestInterception(true);
    p4.on('request', (r) => {
      if (/\/ouverture\.js/.test(r.url())) r.abort(); else r.continue();
    });
    await p4.goto(base + "/", { waitUntil: "domcontentloaded" });

    /* Sans son script, l'écran reste : c'est l'hypothèse de tout ce bloc, et
       s'il partait quand même, le contrôle qui suit ne prouverait rien. */
    await new Promise((r) => setTimeout(r, 1200));
    const reste = await p4.evaluate(() => Boolean(document.getElementById("ouverture")));
    check("sans son script, l écran d ouverture n a plus de sortie", reste === true);

    const sorti = await p4.waitForFunction(() => {
      const s = document.querySelector('.ouverture .secours');
      return Boolean(s) && getComputedStyle(s).visibility === 'visible';
    }, { timeout: SECOURS_MS, polling: 400 }).then(() => true).catch(() => false);
    check("mais la sortie de secours paraît quand même", sorti);

    /* Elle ne sert à rien si on ne peut pas la toucher : c'est le seul
       élément de tout le jeu dont on sait déjà que la feuille de style peut
       manquer, donc sa taille est écrite en clair dans la page. */
    const bouton = await p4.evaluate(() => {
      const b = document.querySelector('.ouverture .secours button');
      if (!b) return null;
      const r = b.getBoundingClientRect();
      return { h: Math.round(r.height), l: Math.round(r.width),
        mot: (b.textContent || '').trim() };
    });
    check(`et elle se touche (${bouton?.l}×${bouton?.h})`,
      bouton !== null && bouton.h >= 44 && bouton.l >= 44);
    check("et elle dit quoi faire", /recharger/i.test(bouton?.mot ?? ''));

    /* ---- 1 bis. la photo du couloir ----

       Rien à voir avec la sortie de secours, mais c'est le seul écran
       d'ouverture qui reste : sans `ouverture.js`, rien ne le lève, et on a le
       temps de le mesurer. Trois choses que la lecture du code ne tranche
       pas.

       **Elle se voit.** Posée d'abord sous la classe `.decor`, elle a hérité
       de la règle du décor du hub — opacité nulle tant qu'il manque `.on`, et
       une demi-largeur de décalage — et l'écran montrait le repli sans un
       message (index.html, « La photo du couloir »). On la cherche donc par
       son adresse, pas par sa classe : un contrôle qui suit la classe ne
       verrait pas la même faute revenir sous un autre nom. Et elle remplit le
       tunnel, dont la boîte a ses proportions : ni décalée, ni déformée.

       **Le trou de la photo tombe sur la sortie.** Ses coins sont écrits à la
       main dans la feuille (`--tg`, `--td`, `--th`, `--tb`) : une photo
       refaite ou un coin retouché, et le bout du couloir montre un pan de
       béton ou un croissant noir. Le trou se lit dans l'image elle-même — là
       où elle est plus qu'à moitié transparente —, puis on demande ce qui est
       peint sous son centre.

       **Elle passe devant le sol et derrière le texte.** Sans son
       `z-index:1`, le sol (`.tunnel::after`), peint après les enfants du
       tunnel, recouvrirait le bas de la photo — et la lumière de la sortie
       (`.sortie::before`, elle-même à z 1) passerait devant le bord adouci
       du trou : la mutation l'a montré, d'où l'ordre lu aussi au centre.
       Au-dessus de `.dedans`, elle cacherait le titre.

       `elementsFromPoint` ignore ce qui porte `pointer-events:none` — tout
       l'écran d'ouverture (ETAT.md, § 2, les pièges de test) : on lui rend le
       doigt le temps de la mesure, et l'ordre du survol redevient celui de la
       peinture. */
    const PHOTO = '#ouverture img[src*="/img/ecran/tunnel-"]';
    await p4.waitForFunction((s) => {
      const i = document.querySelector(s);
      return Boolean(i?.complete && i.naturalWidth > 0);
    }, { timeout: 8000 }, PHOTO).catch(() => {});
    const couloir = await p4.evaluate((s) => {
      const img = document.querySelector(s);
      if (!img) return null;
      const tunnel = img.closest('.tunnel');
      const dedans = document.querySelector('#ouverture .dedans');
      const sortie = document.querySelector('#ouverture .sortie');
      /* L'opacité de tout ce qui la porte jusqu'au tunnel : un parent éteint
         l'éteint aussi, et c'était le cas de `.decor`. */
      let opacite = 1;
      for (let n = img; n && n !== tunnel; n = n.parentElement) {
        opacite *= Number(getComputedStyle(n).opacity);
      }
      const ri = img.getBoundingClientRect();
      const rt = tunnel.getBoundingClientRect();
      const so = sortie.getBoundingClientRect();

      // Le trou, dans l'image servie (`currentSrc`), à sa taille naturelle.
      const W = img.naturalWidth, H = img.naturalHeight;
      const toile = document.createElement('canvas');
      toile.width = W; toile.height = H;
      const g = toile.getContext('2d', { willReadFrequently: true });
      g.drawImage(img, 0, 0, W, H);
      const px = g.getImageData(0, 0, W, H).data;
      let x0 = W, x1 = -1, y0 = H, y1 = -1;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if (px[(y * W + x) * 4 + 3] >= 128) continue;
          if (x < x0) x0 = x; if (x > x1) x1 = x;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      }
      const trou = x1 < 0 ? null : {
        g: ri.left + x0 / W * ri.width, d: ri.left + (x1 + 1) / W * ri.width,
        h: ri.top + y0 / H * ri.height, b: ri.top + (y1 + 1) / H * ri.height,
      };

      const nom = (e) => e ? `${e.tagName.toLowerCase()}${e.className && typeof e.className === 'string'
        ? '.' + e.className.trim().split(/\s+/).join('.') : ''}` : 'rien';
      const sonde = document.createElement('style');
      sonde.textContent = '#ouverture, #ouverture *{pointer-events:auto !important}';
      document.head.append(sonde);
      let centre = null, sol = null;
      if (trou) {
        const cx = (trou.g + trou.d) / 2, cy = (trou.h + trou.b) / 2;
        const pile = document.elementsFromPoint(cx, cy);
        // Ce qui est peint sous la photo : ni elle, ni ce qui passe devant elle.
        const dessous = pile.find((e) => !dedans.contains(e) && e !== img && e !== img.parentElement);
        centre = { dedans: pile.indexOf(dedans), photo: pile.indexOf(img),
          dessous: pile.indexOf(dessous), quoi: nom(dessous), sortie: sortie.contains(dessous) };
        /* Un point du sol : sous la sortie, à mi-chemin du bas de l'écran,
           dans l'axe du trou. */
        const pileSol = document.elementsFromPoint(cx, (so.bottom + Math.min(innerHeight, rt.bottom)) / 2);
        sol = { photo: pileSol.indexOf(img), tunnel: pileSol.indexOf(tunnel),
          devant: nom(pileSol.find((e) => !dedans.contains(e))) };
      }
      sonde.remove();
      return {
        src: img.currentSrc.replace(/^.*\/img\//, '/img/'),
        complete: img.complete, largeur: W, hauteur: H, opacite,
        boite: { dx: Math.round(ri.left - rt.left), dy: Math.round(ri.top - rt.top),
          dl: Math.round(ri.width - rt.width), dh: Math.round(ri.height - rt.height) },
        rapports: [W / H, ri.width / ri.height],
        trou, sortie: { g: so.left, d: so.right, h: so.top, b: so.bottom }, centre, sol,
      };
    }, PHOTO);
    check(`la photo du couloir est là, entière et visible (${couloir?.src ?? 'absente'})`,
      couloir !== null && couloir.complete && couloir.largeur > 0 && couloir.opacite === 1
      || (console.log('        elle est :', JSON.stringify(couloir && {
        src: couloir.src, complete: couloir.complete, largeur: couloir.largeur, opacite: couloir.opacite })), false));
    check('elle remplit le tunnel, sans décalage ni déformation',
      couloir !== null && Object.values(couloir.boite).every((v) => Math.abs(v) <= 1)
        && Math.abs(couloir.rapports[0] / couloir.rapports[1] - 1) < 0.01
      || (console.log('        écart à la boîte du tunnel :', JSON.stringify(couloir?.boite),
        '· rapports image / boîte :', JSON.stringify(couloir?.rapports)), false));
    /* Le trou tient dans la sortie, au pixel près : la feuille la fait
       déborder d'un pour cent de la largeur sous le bord adouci, exprès. */
    const trou = couloir?.trou, bout = couloir?.sortie;
    check('au centre de son trou, on voit la sortie, pas un pan de béton',
      Boolean(trou && couloir.centre?.sortie && couloir.centre.photo < couloir.centre.dessous)
        && trou.g >= bout.g - 1 && trou.d <= bout.d + 1 && trou.h >= bout.h - 1 && trou.b <= bout.b + 1
      || (console.log('        sous le trou :', couloir?.centre?.quoi ?? '?',
        '· trou', JSON.stringify(trou && Object.fromEntries(Object.entries(trou).map(([k, v]) => [k, Math.round(v)]))),
        '· sortie', JSON.stringify(bout && Object.fromEntries(Object.entries(bout).map(([k, v]) => [k, Math.round(v)])))), false));
    check('elle passe devant le sol, et derrière le texte de l’écran',
      Boolean(couloir?.centre && couloir.sol)
        && couloir.centre.dedans >= 0 && couloir.centre.dedans < couloir.centre.photo
        && couloir.sol.photo >= 0 && (couloir.sol.tunnel < 0 || couloir.sol.photo < couloir.sol.tunnel)
      || (console.log('        au centre :', JSON.stringify(couloir?.centre),
        '· au sol :', JSON.stringify(couloir?.sol)), false));
    await p4.close();

    /* ---- 1 ter. sans sa photo ----

       Une photo qui manque ne doit pas rester en image cassée de la taille de
       l'écran : Chrome la peindrait avec son icône et un cadre gris,
       par-dessus le repli. Elle s'en va (`onerror`), et le béton peint
       reprend. On ne refuse que les photos du couloir (et `ouverture.js`,
       pour que l'écran reste à mesurer), dans un contexte neuf : une photo
       déjà chargée par la page d'avant pourrait revenir sans requête.

       « Le béton reprend » se lit en pixels, `.dedans` masqué le temps des
       captures, sur le mur de gauche entre la bâche et le bas de la sortie.
       **Par différence, et non contre une couleur** : le halo de la sortie
       éclaire ce coin du tunnel, et un tunnel sans murs n'y est donc pas du
       fond nu — le premier jet, qui comparait au fond, restait vert murs
       éteints. On capture la zone telle quelle, puis murs masqués : si les
       murs peignent, les deux diffèrent ; si leur règle est partie, ou si
       quelque chose les couvre encore, elles sont identiques. */
    const ctxSans = await (nav.createBrowserContext?.() ?? nav.createIncognitoBrowserContext());
    const p4b = await ctxSans.newPage();
    await p4b.setViewport({ width: 400, height: 880 });
    await p4b.setRequestInterception(true);
    let refusees = 0;
    p4b.on('request', (r) => {
      if (/\/ouverture\.js/.test(r.url())) r.abort().catch(() => {});
      else if (/\/img\/ecran\/tunnel-/.test(r.url())) {
        refusees += 1;
        r.respond({ status: 404, contentType: 'text/plain', body: 'absente' }).catch(() => {});
      } else r.continue().catch(() => {});
    });
    await p4b.goto(base + "/", { waitUntil: "domcontentloaded" });
    const retiree = await p4b.waitForFunction((s) => !document.querySelector(s),
      { timeout: 6000 }, PHOTO).then(() => true).catch(() => false);
    const sans = await p4b.evaluate(() => {
      const tunnel = document.querySelector('#ouverture .tunnel');
      const bache = document.querySelector('#ouverture .bache.g')?.getBoundingClientRect();
      const so = document.querySelector('#ouverture .sortie')?.getBoundingClientRect();
      const rt = tunnel?.getBoundingClientRect();
      const zone = bache && so && rt ? {
        x: Math.ceil(Math.max(0, rt.left) + 4), y: Math.ceil(bache.bottom + 4),
        width: Math.floor(so.left - 4 - Math.max(0, rt.left) - 4),
        height: Math.floor(so.bottom - 4 - bache.bottom - 4),
      } : null;
      const dedans = document.querySelector('#ouverture .dedans');
      if (dedans) dedans.style.visibility = 'hidden';
      return { ecran: Boolean(document.getElementById('ouverture')),
        // Seule l'image part : ses sources restent, et le reste de l'écran aussi.
        sources: document.querySelectorAll('#ouverture source[srcset*="/img/ecran/tunnel-"]').length,
        zone };
    });
    let ecartAuTunnelNu = null;
    if (sans.zone && sans.zone.width > 0 && sans.zone.height > 0) {
      const sharp = (await import('sharp')).default;
      const capture = async () => (await sharp(await p4b.screenshot({ clip: sans.zone, encoding: 'binary' }))
        .removeAlpha().raw().toBuffer());
      const avec = await capture();
      await p4b.evaluate(() => {
        const s = document.createElement('style');
        s.textContent = '#ouverture .murs{visibility:hidden !important}';
        document.head.append(s);
      });
      const nu = await capture();
      let somme = 0;
      for (let i = 0; i < avec.length; i += 3) {
        somme += Math.max(...[0, 1, 2].map((c) => Math.abs(avec[i + c] - nu[i + c])));
      }
      ecartAuTunnelNu = somme / (avec.length / 3);
    }
    check(`sans sa photo, elle s’en va au lieu de rester cassée (requêtes refusées : ${refusees})`,
      refusees >= 1 && retiree && sans.ecran && sans.sources > 0
      || (console.log('        écran :', sans.ecran, '· sources :', sans.sources, '· retirée :', retiree), false));
    check(`et le béton peint reprend (écart moyen au tunnel sans murs : ${ecartAuTunnelNu?.toFixed(1) ?? '?'})`,
      ecartAuTunnelNu !== null && ecartAuTunnelNu > 4
      || (console.log('        zone :', JSON.stringify(sans.zone)), false));
    await p4b.close();
    await ctxSans.close?.();

    /* ---- 2. la sonde : elle recharge, et elle s'arrête ----

       On coupe la feuille de style, ce qui est exactement l'état de la
       capture. La sonde doit voir la page vide et la recharger — deux fois
       au plus. **Le compte est ce qui est éprouvé ici** : une boucle de
       rechargement sur un téléphone dans un stade est pire que la panne
       qu'elle essaie de réparer. */
    const p5 = await ctx.newPage();
    await p5.setViewport({ width: 400, height: 880 });

    /* **On compte les chargements, pas les requêtes du document.** Le premier
       jet interceptait la requête de navigation pour la compter : elle ne
       passe pas par l'interception ici, et le compteur restait à zéro pendant
       que la page se rechargeait sous les yeux du contrôle. Un zéro qui
       ressemble à « la sonde ne marche pas » alors qu'elle marchait : la
       mesure était fausse, pas la chose mesurée. L'événement `load` dit
       exactement ce qu'on cherche — une page qui a fini de se charger. */
    let chargements = 0;
    p5.on('load', () => { chargements += 1; });
    await p5.setRequestInterception(true);
    p5.on('request', (r) => {
      if (/\/ui\.css/.test(r.url())) r.abort().catch(() => {});
      else r.continue().catch(() => {});
    });
    await p5.goto(base + "/", { waitUntil: "load" }).catch(() => {});
    await new Promise((r) => setTimeout(r, 4000));
    const apres = chargements;
    check(`la page vide se recharge d'elle-même (${apres} chargements)`,
      apres >= 2 && apres <= 3);

    /* **Et elle s'arrête.** C'est le contrôle qui compte vraiment : une
       boucle de rechargement sur un téléphone dans un stade est pire que la
       panne qu'elle répare. Le compteur de session le dit sans ambiguïté —
       deux essais écrits, et plus personne n'y touche. */
    await new Promise((r) => setTimeout(r, 4000));
    check("puis elle renonce au lieu de boucler", chargements === apres);
    const compteur = await p5.evaluate(() => {
      try { return sessionStorage.getItem('tbf.secours'); } catch { return 'refus'; }
    });
    check(`et elle a compté ses essais (${compteur})`, compteur === '2');

    /* **Renoncer en silence était un trou, et c'est ce contrôle qui l'a
       montré.** On ne coupe ici que la feuille de style : `ouverture.js`
       arrive donc, fait son travail et lève le rideau — sur une page nue.
       La sortie de secours était partie avec l'écran qui la portait, et il
       ne restait rien à l'écran pour dire ce qui s'était passé. */
    const panne = await p5.evaluate(() => {
      const d = document.getElementById('tbf-panne');
      if (!d) return null;
      const b = d.querySelector('button');
      const r = b?.getBoundingClientRect();
      return { mot: (d.textContent || '').trim(),
        h: Math.round(r?.height ?? 0), l: Math.round(r?.width ?? 0),
        role: d.getAttribute('role'), z: getComputedStyle(d).zIndex };
    });
    check("quand elle renonce, elle le dit", panne !== null);
    check("et elle dit quoi faire", /réessayer/i.test(panne?.mot ?? ''));
    check(`et le bouton se touche (${panne?.l}×${panne?.h})`,
      (panne?.h ?? 0) >= 44 && (panne?.l ?? 0) >= 44);
    /* Un lecteur d'écran doit l'apprendre sans avoir à fouiller la page. */
    check("et elle s annonce", panne?.role === 'alert');
    await p5.close();
    await ctx.close?.();
  }
  if (process.env.SHOT) {
    const p2 = await ouvrir(400, 880);
    await new Promise((r) => setTimeout(r, 260));
    await p2.screenshot({ path: process.env.SHOT + "/ouverture.png" });
    await p2.close();
  }
  await page.waitForSelector('#qui.on', { timeout: 8000 }).catch(() => {});

  const ecran = await page.evaluate(() => {
    const app = document.getElementById('app');
    const entrer = document.getElementById('entrer');
    return {
      barre: Boolean(document.getElementById('tbf-nav')),
      rails: document.querySelectorAll('.rail').length,
      cases: document.querySelectorAll('.rail .tbf-case').length,
      defilePage: document.documentElement.scrollHeight > document.documentElement.clientHeight + 1,
      defileApp: app.scrollHeight > app.clientHeight + 1,
      debordeLarge: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      boutonVisible: entrer.getBoundingClientRect().bottom <= innerHeight + 1,
      burger: (() => {
        const b = document.getElementById('burger').getBoundingClientRect();
        return b.width > 0 && b.right <= innerWidth + 1;
      })(),
      // Un libellé de rail rogné ne se voit qu’à l’usage, sur un vrai
      // téléphone. On mesure le libellé et non la case : la pastille de
      // compteur est en position absolue et déborde exprès.
      rognes: [...document.querySelectorAll('.rail .tbf-case .lib')]
        .filter((l) => l.scrollWidth > l.clientWidth + 1).map((l) => l.textContent.trim()),
      ou: [...document.querySelectorAll('.rail .tbf-case')].map((a) => a.getAttribute('href')),
    };
  });

  check('à 320 px aussi, le Fanzzy est nommé sous les rails',
    await page.evaluate(() => {
      const q = document.getElementById('qui');
      return q.classList.contains('on')
        && q.getBoundingClientRect().bottom <= innerHeight + 1;
    }));
  check('la barre commune ne s’affiche pas sur l’accueil', ecran.barre === false);
  check('l’accueil garde ses deux rails', ecran.rails === 2);
  /* Nommées une par une, et non comptées. Un compte laisse passer un
     remplacement : le jour où une case en pousse une autre dehors, « huit
     cases » reste vrai et personne ne voit que le CARNET a disparu.

     Le KOP et les AMIS sont là parce qu'ils n'étaient joignables que par le
     menu, alors que le KOP est au centre du jeu. */
  for (const [href, nom] of [['/virage', 'le Virage'], ['/fanzzy', 'le classeur'],
    ['/carnet', 'le carnet'], ['/kop', 'le KOP'], ['/duel-nvn', 'le duel'],
    ['/matchs', 'les matchs'], ['/classement', 'le classement'],
    ['/amis', 'les amis']]) {
    check(`un rail mène à ${nom}`, (ecran.ou ?? []).includes(href));
  }
  check('l’écran ne défile pas', !ecran.defilePage && !ecran.defileApp);
  check('et ne déborde pas en largeur', !ecran.debordeLarge);
  check('le bouton d’entrée reste visible', ecran.boutonVisible);
  check('le bouton du menu reste atteignable', ecran.burger);
  check('aucun libellé de rail n’est rogné', ecran.rognes.length === 0);
  if (ecran.rognes.length) console.log('   rognés :', ecran.rognes);

  if (process.env.CAPTURE) {
    await page.screenshot({ path: path.join(tmpdir(), 'accueil-320.png'), fullPage: false });
  }
  await page.close();
}

/* ------------------------------------------- ce que le hub doit annoncer */
{
  const page = await ouvrir();
  /* **L'avatar n'est plus une initiale** (lot 2) : c'est le buste du Fanzzy
     équipé, en sticker, sous l'anneau d'XP — on se reconnaît à son
     personnage, pas à une lettre. Le contrôle lisait `#initiale`, qui n'existe
     plus : l'évaluation levait une erreur et la suite s'arrêtait là, sans
     jouer la soixantaine de contrôles qui suivent.

     Le compte porte ILLUSTRE depuis le bloc des 320 px, et son buste est sur
     le disque : l'avatar doit le montrer, **chargé**. La silhouette de repli
     (`.tbf-avatar--vide`) ou une image cassée diraient toutes deux qu'il ne
     l'a pas trouvé. Le buste est posé après les lectures du serveur : on
     l'attend, sans en faire une condition — c'est le contrôle qui juge. */
  await page.waitForFunction(() => {
    const i = document.querySelector('#moi img.tbf-avatar-buste');
    return Boolean(i?.complete && i.naturalWidth > 0);
  }, { timeout: 4000 }).catch(() => {});
  const hud = await page.evaluate(() => ({
    avatar: (() => {
      const a = document.getElementById('moi');
      const i = a?.querySelector('img.tbf-avatar-buste');
      return {
        sticker: Boolean(a?.classList.contains('tbf-avatar')),
        vide: a?.classList.contains('tbf-avatar--vide') ?? true,
        src: i?.getAttribute('src') ?? null,
        charge: Boolean(i?.complete && i.naturalWidth > 0),
      };
    })(),
    /* Partie du document, et pas seulement cachée : même raison que le
       pseudo et le club juste en dessous. */
    initialePartie: document.getElementById('initiale') === null,
    /* Le pseudo et le nom du club ne sont plus dans l'en-tête : ils vivaient
       dans un cadre sombre autour de l'avatar, et sur un compte neuf ces deux
       lignes sont vides — il ne restait qu'un rectangle noir sous la pastille.
       On vérifie donc qu'ils ont bien **disparu du document**, et pas seulement
       qu'ils sont cachés : un élément laissé là se fait réécrire par un script
       qui croit encore parler à quelqu'un. */
    pseudoParti: document.getElementById('pseudo') === null,
    clubParti: document.getElementById('clubline') === null,
    ecarpes: document.getElementById('scarves').textContent,
    boosters: document.getElementById('packs').textContent,
    collec: document.getElementById('collecTxt').textContent,
    // Le total, que la carte ne montre plus : voir le contrôle plus bas.
    collecDit: document.getElementById('collec')?.getAttribute('aria-label') ?? '',
    jauge: document.getElementById('collecBar').style.width,
    entrer: document.getElementById('entrer').getAttribute('href'),
  }));
  check('le buste du Fanzzy équipé est posé sur l’avatar',
    hud.avatar.sticker && !hud.avatar.vide && hud.avatar.charge
      && new RegExp(`/img/fanzzy/${ILLUSTRE}[-/.]`).test(hud.avatar.src ?? '')
    || (console.log('        avatar :', JSON.stringify(hud.avatar)), false));
  check('et l’initiale du pseudo a quitté l’avatar', hud.initialePartie);
  check('le pseudo et le club ont quitté l’en-tête',
    hud.pseudoParti && hud.clubParti);
  /* Le niveau : un chiffre sur l’avatar, et c'est désormais le seul endroit. La
     jauge de palier est partie avec le cadre qui la portait. Rien ne doit
     s'afficher tant que le module n'a pas répondu — une pastille « 1 » posée
     par défaut mentirait pendant la seconde du chargement, et c’est précisément
     le moment où on la regarde. */
  const niv = await page.evaluate(() => ({
    pastille: document.getElementById('nivPastille')?.textContent ?? '',
    visible: document.getElementById('nivPastille')?.hidden === false,
    infobulle: document.getElementById('nivPastille')?.title ?? '',
  }));
  check('le niveau est affiché sur l’avatar', niv.visible && niv.pastille === '4');
  check('et il dit où on en est dans son palier', /XP/.test(niv.infobulle)
    || (console.log('        infobulle :', niv.infobulle), false));

  check('la bourse affiche écharpes et boosters',
    hud.ecarpes === '90' && hud.boosters === '12');

  /* La boutique était servie sur /boutique et rangée dans le menu accordéon,
     au milieu de treize entrées : c'est-à-dire nulle part. Personne n'ouvre un
     menu pour découvrir qu'une boutique existe. Toucher sa monnaie est le
     geste que tout joueur essaie en premier, et les deux jetons étaient des
     div inertes qui affichaient un nombre. */
  const jetons = await page.evaluate(() =>
    [...document.querySelectorAll('.jeton')].map((j) => ({
      ou: j.getAttribute('href'),
      dit: (j.getAttribute('aria-label') ?? '').includes('boutique'),
      plus: Boolean(j.querySelector('.plus')),
    })));
  check('les deux jetons de monnaie mènent à la boutique',
    jetons.length === 2 && jetons.every((j) => j.ou === '/boutique')
    || (console.log('        jetons :', JSON.stringify(jetons)), false));
  check('et ils disent où ils mènent, même sans voir l’écran',
    jetons.length > 0 && jetons.every((j) => j.dit));
  check('un « + » annonce qu’on peut en obtenir davantage',
    jetons.length > 0 && jetons.every((j) => j.plus));
  /* Le compte vient du serveur, et on le compare à la base plutôt qu'à un
     chiffre écrit ici. Il valait « 2 » tant que la suite ne posait que deux
     Fanzzy ; depuis qu'elle en équipe d'autres pour éprouver l'accueil, il en
     vaut quatre — et un test qui fige un total finit toujours par mesurer sa
     propre mise en scène plutôt que le comportement. */
  const [[{ n: possedes }]] = await pool.query(
    'SELECT COUNT(*) n FROM user_fanzzy WHERE user_id = ?', [U]);
  /* **Tout ce qui se gagne**, depuis que la carte compte la bibliothèque et
     plus seulement les personnages : le chiffre attendu est celui du serveur,
     pour la même raison qu'au-dessus. Les personnages possédés y sont, et au
     moins autant — on ne peut pas en avoir gagné moins que ça. */
  const biblio = await page.evaluate(() => fetch('/api/fanzzy/bibliotheque',
    { credentials: 'same-origin' }).then((r) => r.json()).catch(() => null));
  /* **Le palier en cours, et non plus le total** (lot 2, amendement 22) :
     la carte dit « 14 / 25 », puis « 37 / 50 » — un total de cinq mille
     cinq cents ne bougeait pas d'une visite à l'autre, et on avait cessé de
     le lire. Le total n'a pas disparu : il est dit aux lecteurs d'écran, dans
     l'étiquette du lien.

     Les deux exigences restent, chacune là où elle vit désormais : ce qui
     s'affiche est le compte du serveur sur le palier que l'accueil donne à
     ce compte, et l'étiquette porte le compte et le total du serveur. La
     table des paliers est **lue dans `index.html`**, comme les délais en tête
     de cette suite : recopiée ici, elle finirait par mentir. Introuvable,
     elle fait rougir le contrôle au lieu de le laisser passer. */
  const PALIERS = (() => {
    const src = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
    const m = src.match(/const PALIERS = \[([\d\s,_]+)\]/);
    return m ? m[1].split(',').map((x) => Number(x.replace(/[\s_]/g, ''))) : null;
  })();
  const gagnes = biblio?.total?.gagnes;
  const possibles = biblio?.total?.possibles;
  const palier = PALIERS ? (PALIERS.find((p) => p > gagnes && p < possibles) ?? possibles) : null;
  const ditNombres = (hud.collecDit.match(/\d+/g) ?? []).map(Number);
  check(`la collection est chiffrée (${hud.collec}, dont ${possedes} Fanzzy)`,
    palier !== null && hud.collec === `${gagnes} / ${palier}`
      && ditNombres.includes(gagnes) && ditNombres.includes(possibles)
      && biblio.types.fanzzy.gagnes >= Number(possedes)
    || (console.log('        bibliothèque :', JSON.stringify(biblio?.total),
      '· étiquette :', hud.collecDit,
      '· paliers :', PALIERS ? PALIERS.join(' ') : 'introuvables dans index.html'), false));
  check('et sa jauge est remplie d’autant', /^[0-9.]+%$/.test(hud.jauge));
  check('le bouton d’entrée mène au duel hors match', hud.entrer === '/duel-nvn');
  await page.close();
}
check('aucune erreur de script sur l’accueil', erreurs.length === 0);
if (erreurs.length) console.log('   ', erreurs.slice(0, 3));

/* ---------------------------------------------------------------- fin */

if (process.env.CAPTURE) {
  // Dans le dossier temporaire du système, pas dans le dépôt : une capture n'a
  // rien à faire dans un commit, et `/tmp` en dur ne marche pas sous Windows.
  /* Trois tailles, et la tablette en fait partie : c'est l'écran où la colonne
     s'élargit, et c'est le seul endroit où l'on voit si elle remplit vraiment
     la largeur gagnée ou si tout reste à sa taille de téléphone au milieu. */
  for (const [nom, etat, l, h] of [
    ['repos', null, 400, 880],
    ['match', {
      id: 1, open: true, elapsed: 37, status_short: '2H',
      home_id: 85, away_id: 91, home_name: 'Sion', away_name: 'Bâle',
      home_goals: 1, away_goals: 0, crowd: [12, 9],
    // `mien` : un de mes clubs joue. Le vrai service le pose sur chaque
    // match de la liste, et l’accueil ne parle que de ceux-là.
    mien: true,
    }, 400, 880],
    ['tablette', null, 834, 1112],
    /* Cinq cent soixante-dix-huit : l'écran qui tombait dans l'angle mort du
       palier de sept cents et gardait ses bandes noires. */
    ['petite-tablette', null, 578, 828],
    ['large', null, 1362, 940],
  ]) {
    direct = etat;
    const p = await ouvrir(l, h);
    await new Promise((r) => setTimeout(r, 800));
    const f = path.join(tmpdir(), `accueil-${nom}.png`);
    await p.screenshot({ path: f, fullPage: false });
    console.log(`   capture : ${f}`);
    await p.close();
  }
}

/* ================================= quelqu'un attend un duel

   Une file de duel ne vit que deux minutes, le temps qu'un joueur est devant
   son écran : quand elle existe, quelqu'un attend **maintenant**, et le dire
   ici est la seule chance qu'il trouve du monde.

   Deux contrôles, et le second compte autant que le premier : le bouton le dit
   quand c'est vrai, et **ne le dit pas** le reste du temps. Une alerte
   permanente cesse d'être une alerte — c'est la faute qu'on vient de corriger
   sur la pastille du Virage. */

{
  direct = null;                     // aucun match : le bouton propose le duel
  attente = null;
  let page = await ouvrir();
  await new Promise((r) => setTimeout(r, 700));
  /* Le bouton porte, depuis le lot 2, un sous-libellé qui dit ce qu'il fait
     (« Duel de tribunes ») : son texte entier n'est plus son titre seul, et
     le comparer à « Prendre ma place » rougissait pour une précision voulue.
     On lit donc le titre — le premier nœud de texte, comme `bouton()` le
     pose — et on vérifie que rien d'autre ne promet personne : ni le
     sous-libellé (« t'attend », « il manque »), ni le ton, puisque le violet
     dit que des gens attendent (amendement 18), ni un troisième morceau : le
     bouton ne porte que ces deux-là, comme le texte entier le dit. */
  const repos = await page.evaluate(() => {
    const e = document.getElementById('entrer');
    const t = e.firstChild;
    return {
      titre: t?.nodeType === Node.TEXT_NODE ? t.textContent.trim() : '',
      sous: e.querySelector('small')?.textContent.trim() ?? '',
      entier: e.textContent.replace(/\s+/g, ''),
      ton: e.dataset.ton ?? '',
    };
  });
  check('sans personne en file, le bouton ne promet rien',
    repos.titre === 'Prendre ma place' && repos.sous !== ''
      && !/attend|manque/i.test(repos.sous) && repos.ton !== 'violet'
      && repos.entier === (repos.titre + repos.sous).replace(/\s+/g, '')
    || (console.log('        il dit :', JSON.stringify(repos)), false));

  attente = {
    fixtureId: 1, format: '1v1', attendus: 1, camps: [1, 0], mode: 'classe',
    clubs: [{ id: 85, name: 'Sion' }, { id: 91, name: 'Bâle' }],
    mien: true, presents: 1, campQuiManque: 1, manque: 1,
  };
  page = await ouvrir();
  const dit = await jusqua(async () =>
    /attend/.test(await page.evaluate(() =>
      document.getElementById('entrer').textContent)));
  check('quand quelqu’un attend, le bouton le dit', dit
    || (console.log('        il dit :', await page.evaluate(() =>
      document.getElementById('entrer').textContent.trim())), false));
  /* **Le camp qui manque, nommé.** Le serveur calcule `campQuiManque` et
     `manque` depuis longtemps, et rien ne les affichait : « 2 t'attendent » ne
     dit pas où se mettre, alors que « il manque 1 supporter de Bâle » est une
     place précise — et c'est ce qui décide quelqu'un à venir. */
  check('et il nomme la place à tenir',
    /il manque 1 supporter de Bâle/.test(await page.evaluate(() =>
      document.getElementById('entrer').textContent))
    || (console.log('        il dit :', await page.evaluate(() =>
      document.getElementById('entrer').textContent.replace(/\s+/g, ' ').trim())), false));
  check('et le format',
    /1v1/.test(await page.evaluate(() =>
      document.getElementById('entrer').textContent)));
  /* **Le lien porte la place.** Il menait à `/duel-nvn` tout court : on
     arrivait sur la liste de tous les matchs jouables, et il fallait y
     retrouver celui dont on venait de lire le nom, puis le format, puis le
     camp. Trois choix pour une invitation qui en avait déjà fait trois. */
  {
    const href = await page.evaluate(() =>
      document.getElementById('entrer').getAttribute('href'));
    const u = new URL(href, 'http://x');
    check('et il mène directement à cette place', u.pathname === '/duel-nvn'
      && u.searchParams.get('match') === '1'
      && u.searchParams.get('format') === '1v1'
      && u.searchParams.get('camp') === '1'
      || (console.log('        il mène à :', href), false));
  }
  attente = null;
}

/* ================================= le derby automatique

   Un supporter de Bâle est en ligne, Sion–Bâle se joue aujourd'hui, et le
   joueur suit Sion : le bouton propose le derby, sans dire qui. Puis, quand
   l'autre est entré en file, il dit qu'un supporter de Bâle attend. Et une
   file ailleurs, sur un match qui n'est pas le sien, ne passe pas devant. */

{
  direct = null;
  const lire = async (page) => page.evaluate(() => {
    const e = document.getElementById('entrer');
    return { texte: e.textContent.replace(/\s+/g, ' ').trim(), href: e.getAttribute('href'),
      ton: e.dataset.ton ?? '' };
  });
  derby = {
    fixtureId: 7, format: '1v1', mode: 'classe', monCamp: 0,
    clubs: [{ id: 85, name: 'Sion' }, { id: 91, name: 'Bâle' }],
  };
  /* Une file sur un autre match, d'aucun club suivi : l'alerte ordinaire. */
  attente = {
    fixtureId: 2, format: '2v2', attendus: 2, camps: [1, 0], mode: 'classe',
    clubs: [{ id: 1, name: 'Lyon' }, { id: 2, name: 'Nantes' }],
    mien: false, presents: 1, campQuiManque: 1, manque: 2,
  };
  let page = await ouvrir();
  await jusqua(async () => /Derby/.test((await lire(page)).texte));
  let b = await lire(page);
  check('un derby du jour se propose sur le bouton',
    /Derby du jour/.test(b.texte) && /Un supporter de Bâle est en ligne/.test(b.texte)
    || (console.log('        il dit :', JSON.stringify(b)), false));
  check('en violet, sans nommer personne', b.ton === 'violet' && !/Derbyste/.test(b.texte));
  {
    const u = new URL(b.href, 'http://x');
    check('et il mène au match, en 1v1, dans ma tribune', u.pathname === '/duel-nvn'
      && u.searchParams.get('match') === '7' && u.searchParams.get('format') === '1v1'
      && u.searchParams.get('camp') === '0'
      || (console.log('        il mène à :', b.href), false));
  }

  /* L'autre a appuyé : il attend en face, sur un match de mes clubs. */
  derby = null;
  attente = {
    fixtureId: 7, format: '1v1', attendus: 1, camps: [0, 1], mode: 'classe',
    clubs: [{ id: 85, name: 'Sion' }, { id: 91, name: 'Bâle' }],
    mien: true, presents: 1, campQuiManque: 0, manque: 1, derby: true, monCamp: 0,
  };
  page = await ouvrir();
  await jusqua(async () => /Derby/.test((await lire(page)).texte));
  b = await lire(page);
  check('quand il attend, le bouton dit qu’un supporter de Bâle m’attend',
    /Derby !/.test(b.texte) && /un supporter de Bâle t’attend/.test(b.texte)
    || (console.log('        il dit :', JSON.stringify(b)), false));
  check('et il mène à ma tribune', new URL(b.href, 'http://x').searchParams.get('camp') === '0'
    || (console.log('        il mène à :', b.href), false));
  derby = null;
  attente = null;
}

/* ================================= le monde qui joue, ailleurs

   « 37 supporters dans les virages · 3 duels attendent un joueur » (5
   octobre 2026, à la demande de Gaël : rien ne disait, sur l'accueil, qu'on
   jouait au Virage quand ce n'était pas le match d'un de ses clubs, ni qu'un
   duel attendait ailleurs que dans la file du bouton). Une bâche au pied du
   personnage, qui mène là où il y a le plus de monde.

   Elle dit les deux nombres, ceux-là mêmes que le tiroir porte sur ses
   tuiles ; elle mène à la tribune la plus pleine, ou à la file quand celle-ci
   est plus remplie ; elle tient entre les rails sans rien prendre au
   personnage ; et elle se tait quand il n'y a personne, quand le seul duel
   est déjà sur le bouton, et quand un club du joueur joue. */
{
  const match = (id, crowd) => ({
    id, open: true, fini: false, mien: false, elapsed: 30, status_short: '1H',
    home_id: 700 + id, away_id: 800 + id, home_name: 'Lyon', away_name: 'Lens',
    home_goals: 0, away_goals: 0, crowd,
  });
  const file = (fixtureId, format, camps) => ({
    fixtureId, format, attendus: Number(format[0]), camps, mode: 'classe',
    clubs: [{ id: 21, name: 'Metz' }, { id: 22, name: 'Reims' }],
  });
  const lireMonde = (page) => page.evaluate(() => {
    const b = document.getElementById('monde');
    const r = b.getBoundingClientRect();
    const [g, d] = [...document.querySelectorAll('.centre > .rail')]
      .map((n) => n.getBoundingClientRect());
    const qui = document.getElementById('qui').getBoundingClientRect();
    const bas = document.querySelector('.bas').getBoundingClientRect();
    return {
      vu: !b.hidden && r.width > 0 && r.height > 0,
      lignes: [...b.querySelectorAll('span')]
        .map((s) => s.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' | '),
      href: b.getAttribute('href'),
      // Sa hauteur de mise en page : la cible, sans l'entrée qui la penche.
      haut: b.offsetHeight,
      colle: b.classList.contains('tbf-colle'),
      // Entre les deux rails, au-dessus du nom (quand il est là) et de la bande du bas.
      place: r.left >= g.right - 1 && r.right <= d.left + 1
        && (qui.height === 0 || r.bottom <= qui.top + 1) && r.bottom <= bas.top + 1,
      // La taille de mise en page, que la respiration ne fait pas varier.
      pile: document.getElementById('pile').offsetHeight,
      tiroir: Object.fromEntries(['/virage', '/duel-nvn'].map((h) => {
        const n = document.querySelector(`.tbf-tiroir .tbf-case[href="${h}"]`);
        return [h, `${n?.dataset.etat ?? ''}:${n?.dataset.pastille ?? ''}`];
      })),
      rail: document.querySelector('.rail .tbf-case[href="/virage"]')?.dataset.etat ?? null,
      menu: document.getElementById('burger')?.dataset.urgence ?? null,
    };
  });

  direct = null; attente = null; ailleurs = []; autres = [];
  const page = await ouvrir();
  await new Promise((r) => setTimeout(r, 700));
  let m = await lireMonde(page);
  check('personne nulle part : pas de bandeau', !m.vu
    || (console.log('        il dit :', m.lignes), false));
  const pileSans = m.pile;

  ailleurs = [match(41, [20, 11]), match(42, [4, 2])];
  attente = { ...file(51, '3v3', [2, 1]), campQuiManque: 1, manque: 2 };
  autres = [file(52, '1v1', [1, 0]), file(53, '2v2', [0, 1])];
  await page.evaluate(() => TBF.veiller());
  /* Mesurée une fois collée : pendant son entrée (`tbf-colle`), la bâche est
     agrandie et penchée, et son rectangle déborde de ce qu'elle occupe. */
  await jusqua(async () => {
    const x = await lireMonde(page);
    return /duels/.test(x.lignes) && !x.colle;
  }, 3000);
  m = await lireMonde(page);
  check('du monde au Virage et trois duels : le bandeau dit les deux',
    m.vu && m.lignes === '37 supporters dans les virages | 3 duels attendent un joueur ›'
    || (console.log('        il dit :', JSON.stringify(m.lignes)), false));
  check('et il mène à la tribune la plus pleine', m.href === '/virage?match=41'
    || (console.log('        il mène à :', m.href), false));
  check('entre les rails, au-dessus du nom, en une cible de 44 px au moins',
    m.place && m.haut >= 44
    || (console.log('        bandeau :', JSON.stringify(m)), false));
  check('sans rien prendre au personnage', m.pile === pileSans
    || (console.log('        personnage :', pileSans, '→', m.pile), false));
  /* Les mêmes nombres dans le tiroir — la bâche et la tuile ne peuvent pas
     annoncer deux soirées différentes —, et rien sur le rail ni sur le
     bouton du menu : du monde au Virage n'est pas une urgence. */
  check('le tiroir dit les mêmes nombres, et le menu n’en fait pas une urgence',
    m.tiroir['/virage'] === 'monde:37' && m.tiroir['/duel-nvn'] === 'attend:3'
      && m.rail === null && m.menu !== 'monde'
    || (console.log('        tiroir :', JSON.stringify(m.tiroir), '· rail :', m.rail,
      '· menu :', m.menu), false));

  /* La file plus remplie que la tribune : elle passe devant, à la place
     qui y manque. */
  ailleurs = [match(41, [1, 1])];
  await page.evaluate(() => TBF.veiller());
  await jusqua(async () => /^\/duel-nvn/.test((await lireMonde(page)).href ?? ''), 3000);
  m = await lireMonde(page);
  const u = new URL(m.href ?? '/', 'http://x');
  check('une file plus remplie que la tribune : il mène à sa place',
    u.pathname === '/duel-nvn' && u.searchParams.get('match') === '51'
      && u.searchParams.get('format') === '3v3' && u.searchParams.get('camp') === '1'
    || (console.log('        il mène à :', m.href), false));

  /* Un seul duel, et le bouton le propose déjà : le bandeau ne le répète
     pas, et sans personne au Virage il n'a plus rien à dire. */
  ailleurs = []; autres = [];
  await page.evaluate(() => TBF.veiller());
  await jusqua(async () => !(await lireMonde(page)).vu, 3000);
  m = await lireMonde(page);
  check('un seul duel, déjà sur le bouton : le bandeau ne le répète pas', !m.vu
    || (console.log('        il dit :', m.lignes), false));

  /* Un club du joueur joue : le bouton mène déjà au Virage, et ce soir-là
     le duel passe après. */
  direct = { ...match(43, [5, 3]), mien: true, home_id: 85, away_id: 91,
    home_name: 'Sion', away_name: 'Bâle' };
  ailleurs = [match(41, [20, 11])];
  autres = [file(52, '1v1', [1, 0])];
  await page.evaluate(() => TBF.veiller());
  await jusqua(async () => (await lireMonde(page)).tiroir['/virage'] === 'direct:', 3000);
  m = await lireMonde(page);
  check('un club suivi joue : le bandeau se tait', !m.vu && m.tiroir['/virage'] === 'direct:'
    || (console.log('        il dit :', m.lignes, '· tiroir :', JSON.stringify(m.tiroir)), false));
  direct = null; attente = null; ailleurs = []; autres = [];
  await page.close();
}

/* ================================= le Fanzzy vivant (lot 7, point 4)

   Un caractère, avec les dessins qui existent (5 octobre 2026, à la demande
   de Gaël) : il raconte le dernier match de son club en même temps que le
   ticket « Depuis ta dernière visite » — fier et sautant d'une victoire,
   abattu d'une défaite — ; il fête un retour après deux jours, après son
   coucou ; et il répond autrement quand on insiste à le toucher : il exulte
   au troisième toucher d'affilée, proteste au sixième et ne saute plus le
   temps de sa colère. Il ne prend jamais le visage qu'un moment tient.

   Éprouvé sur RP1 et ses cinq expressions (le repos, la poussée, la joie,
   le dépit, la colère : la victoire et la défaite d'un match se montrent
   par leur famille, `fanzzy-etats.js`), puis sur le supporter générique,
   qui n'a pas de colère et doit continuer de sauter. */
{
  const manifeste = JSON.parse(readFileSync(
    path.join(RACINE, 'public', 'img', 'fanzzy', 'index.json'), 'utf8')).fanzzy ?? {};
  const etatsDe = (id) => manifeste[id]?.evolutions?.e1?.skins?.base?.etats ?? [];
  const VOULUS = ['neutre', 'joie', 'depit', 'colere'];
  const VIF = ['RP1', ...Object.keys(manifeste)]
    .find((id) => VOULUS.every((e) => etatsDe(id).includes(e)));
  /* Le nom d'un dessin, de son adresse : `…/RP1/e1/base/victoire.avif?v=2`
     donne `victoire`, `/img/supporter/goal.avif`, `goal`. */
  const nom = (src) => (src ?? '').match(/\/([a-z]+)\.(?:avif|webp|png)(?:\?|$)/)?.[1] ?? '';
  /* L'heure du coucou, pour dire ce qui vient après lui. */
  const heureDuCoucou = { fn: () => {
    addEventListener('animationstart', (e) => {
      if (e.animationName === 'coucou') window.__coucou ??= performance.now();
    }, true);
  } };
  const visages = async (page) => (await page.evaluate(() => window.__visages.map((v) => v.src)))
    .map(nom);
  const sauts = async (page) => (await page.evaluate(() => window.__gestes))
    .filter((g) => g === 'saut').length;
  const toucher = (page) => page.evaluate(() => document.getElementById('scene')
    .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
  const pause = (ms) => new Promise((r) => { setTimeout(r, ms); });
  const visite = (depuis) => ({ actif: true, depuis });
  /* Ce qu'il a dit (voir « la parole du Fanzzy ») : les moments, dans l'ordre. */
  const paroles = (page) => page.evaluate(() => window.__paroles ?? []);
  const ditDe = async (page, quoi) => (await paroles(page)).find((p) => p.quoi === quoi) ?? null;
  /* Une ligne vraiment écrite pour ce moment, et qui ne mène nulle part. */
  const ligneDe = (page, p) => page.evaluate((q) => {
    const R = window.TBF_REPLIQUES;
    const toutes = [...R.etages(q.quoi, {}).flat(),
      ...Object.values(R.FAMILLES).flatMap((f) => f[q.quoi] ?? []),
      ...Object.values(R.PERSO).flatMap((f) => f[q.quoi] ?? []),
      ...(q.quoi === 'salut' ? Object.values(R.COMMUN.salut).flat() : [])];
    return toutes.includes(q.texte) && q.href === null;
  }, p);
  const dit = async (page, quoi, ms = 6000) => {
    await jusqua(async () => Boolean(await ditDe(page, quoi)), ms);
    const p = await ditDe(page, quoi);
    return Boolean(p) && await ligneDe(page, p)
      || (console.log('        paroles :', JSON.stringify(await paroles(page))), false);
  };
  const match = (issue, score) => ({ fixtureId: 9001, domicile: 'FC Sion',
    exterieur: 'FC Bâle', score, club: 'FC Sion', issue });
  const HEURE = 3600e3;
  const [[{ avant: equipeAvant } = {}]] = await pool.query(
    'SELECT active_fanzzy AS avant FROM user_wallet WHERE user_id = ?', [U]);

  if (!VIF) {
    console.log('  --   aucun Fanzzy avec ses expressions dans index.json : section sautée');
  } else {
    await equiper(VIF);

    /* Une victoire depuis la dernière visite : il la raconte avec le ticket. */
    quotidien = visite({ ilYaMs: 18 * HEURE, matchs: [match('gagne', [2, 1])] });
    let page = await ouvrir();
    check('une victoire depuis la dernière visite : il la raconte, fier',
      await jusqua(async () => (await visages(page)).includes('joie'), 6000)
      || (console.log('        visages :', (await visages(page)).join(' → ')), false));
    check('et il saute', await sauts(page) >= 1);
    check('et il le dit, d’une ligne de victoire qui ne mène nulle part', await dit(page, 'victoire'));
    check('le temps du ticket, puis il rend la main à son repos',
      await jusqua(async () => nom((await scene(page)).src) === 'neutre', 6000)
      || (console.log('        il montre :', (await scene(page)).src), false));
    await page.close();

    /* Une défaite : abattu, et il ne saute pas. */
    quotidien = visite({ ilYaMs: 18 * HEURE, matchs: [match('perdu', [0, 1])] });
    page = await ouvrir();
    check('une défaite : il la raconte, abattu',
      await jusqua(async () => (await visages(page)).includes('depit'), 6000)
      || (console.log('        visages :', (await visages(page)).join(' → ')), false));
    check('sans sauter', await sauts(page) === 0);
    check('et il le dit', await dit(page, 'defaite'));
    check('l’arrivée a ses mots : il ne dit pas bonjour par-dessus',
      (await pause(3500), !(await ditDe(page, 'salut')))
      || (console.log('        paroles :', JSON.stringify(await paroles(page))), false));
    await page.close();

    /* Un nul sans rouge : pas de visage pour lui, mais des mots. */
    quotidien = visite({ ilYaMs: 18 * HEURE, matchs: [match('nul', [1, 1])] });
    page = await ouvrir();
    check('un nul : il n’a pas de visage pour lui, il a des mots', await dit(page, 'nul'));
    check('et son visage ne bouge pas',
      !(await visages(page)).some((v) => ['joie', 'depit', 'colere'].includes(v))
      || (console.log('        visages :', (await visages(page)).join(' → ')), false));
    await page.close();

    /* Le carton rouge (6 octobre 2026) : un rouge pris par son club, après
       une défaite, le met en colère, et le ticket l'écrit. */
    const lignesDuTicket = (page) => page.evaluate(() => [...document.querySelectorAll(
      '.tbf-ticket--retour li')].map((li) => li.textContent));
    quotidien = visite({ ilYaMs: 18 * HEURE, matchs: [{ ...match('perdu', [0, 1]), rouges: 1 }] });
    page = await ouvrir();
    check('un rouge dans une défaite : il se fâche',
      await jusqua(async () => (await visages(page)).includes('colere'), 6000)
      || (console.log('        visages :', (await visages(page)).join(' → ')), false));
    check('sans abattement ni saut', !(await visages(page)).includes('depit') && await sauts(page) === 0
      || (console.log('        visages :', (await visages(page)).join(' → ')), false));
    check('et il dit le rouge', await dit(page, 'rouge'));
    let lignes = await lignesDuTicket(page);
    check('le ticket écrit le rouge', lignes.includes('FC Sion perd 0–1 · carton rouge')
      || (console.log('        ticket :', lignes), false));
    await page.close();

    /* Un nul à dix : le rouge suffit à le fâcher. Deux rouges, au pluriel. */
    quotidien = visite({ ilYaMs: 18 * HEURE, matchs: [{ ...match('nul', [1, 1]), rouges: 2 }] });
    page = await ouvrir();
    check('un nul avec deux rouges : il se fâche aussi',
      await jusqua(async () => (await visages(page)).includes('colere'), 6000)
      || (console.log('        visages :', (await visages(page)).join(' → ')), false));
    lignes = await lignesDuTicket(page);
    check('« 2 cartons rouges »', lignes.includes('FC Sion fait nul 1–1 · 2 cartons rouges')
      || (console.log('        ticket :', lignes), false));
    await page.close();

    /* Gagner à dix : la victoire l'emporte. */
    quotidien = visite({ ilYaMs: 18 * HEURE, matchs: [{ ...match('gagne', [2, 1]), rouges: 1 }] });
    page = await ouvrir();
    check('une victoire malgré un rouge : il reste fier',
      await jusqua(async () => (await visages(page)).includes('joie'), 6000)
      && !(await visages(page)).includes('colere')
      || (console.log('        visages :', (await visages(page)).join(' → ')), false));
    await page.close();

    /* Un nom trop long pour le rouge en entier : la ligne raccourcit le
       rouge plutôt que de disparaître, et la colère suit ce qui est écrit.
       La largeur du ticket décide : on allonge le nom jusqu'à trouver
       chaque cas, sur la page même. */
    page = await ouvrir(360, 760);
    await jusqua(async () => nom((await scene(page)).src) === 'neutre', 6000);
    const replis = await page.evaluate(() => {
      const vus = {};
      for (let n = 4; n <= 60; n++) {
        const club = 'FC ' + 'Mönchengladbach'.repeat(4).slice(0, n);
        const m = { fixtureId: 1, domicile: club, exterieur: 'Bâle', score: [0, 1], club,
          issue: 'perdu', rouges: 1 };
        const ecrit = montrerRetour({ matchs: [m] }) || [];
        document.querySelectorAll('.tbf-ticket--retour').forEach((t) => t.remove());
        const l = ecrit[0] ?? '';
        const cas = l.endsWith(' · carton rouge') ? 'complet' : l.endsWith(' · rouge') ? 'court'
          : l ? 'sans' : 'rien';
        vus[cas] ??= { club, l, etat: recitDe({ matchs: [m] }, 0, ecrit)?.etat ?? null };
      }
      return vus;
    });
    check('un nom long : le rouge s’écrit court plutôt que la ligne ne tombe',
      replis.complet && replis.court?.l === `${replis.court.club} perd 0–1 · rouge`
      || (console.log('        replis :', JSON.stringify(replis)), false));
    check('écrit court, le rouge le fâche encore', replis.court?.etat === 'decision'
      || (console.log('        replis :', JSON.stringify(replis)), false));
    check('trop long pour le rouge, la ligne reste et il n’est qu’abattu',
      replis.sans?.l === `${replis.sans.club} perd 0–1` && replis.sans.etat === 'defaite'
      || (console.log('        replis :', JSON.stringify(replis)), false));
    await page.close();

    /* Trois jours sans venir, sans match à raconter : la fête, après le
       coucou — le salut garde son geste. */
    quotidien = visite({ ilYaMs: 72 * HEURE, souvenirs: 2 });
    page = await ouvrir(400, 880, heureDuCoucou);
    await jusqua(async () => (await visages(page)).includes('joie'), 6000);
    const fete = await page.evaluate(() => ({ coucou: window.__coucou ?? null,
      joie: window.__visages.find((v) => /\/joie\./.test(v.src))?.t ?? null }));
    check('trois jours sans venir : il salue, puis il fête le retour',
      fete.coucou !== null && fete.joie !== null && fete.joie - fete.coucou >= 1300
      || (console.log('        coucou à', fete.coucou, '· joie à', fete.joie), false));
    check('d’un saut', await sauts(page) >= 1);
    check('et il dit qu’on lui a manqué', await dit(page, 'retour'));
    await page.close();

    /* Cinq heures : on est simplement repassé. */
    quotidien = visite({ ilYaMs: 5 * HEURE, souvenirs: 1 });
    page = await ouvrir();
    await pause(2500);
    const vus = await visages(page);
    check('cinq heures sans venir, rien à raconter : pas de fête',
      !vus.includes('joie') && await sauts(page) === 0
      || (console.log('        visages :', vus.join(' → ')), false));
    /* Après la phrase du hub, s'il en a une : elle passe d'abord. */
    check('il dit bonjour, selon l’heure', await dit(page, 'salut', 12000)
      && !(await ditDe(page, 'retour')));
    await page.close();

    /* Le serveur ne sert `depuis` que s'il a des nouvelles : sans lui, la
       marque de cet appareil dit l'absence. */
    quotidien = null;
    page = await ouvrir(400, 880, { fn: (t) => {
      try { localStorage.setItem('tbf.arrivee.anonyme', String(t)); } catch { /* rien */ }
    }, args: [Date.now() - 72 * HEURE] });
    check('sans nouvelles du serveur, la marque de l’appareil suffit à la fête',
      await jusqua(async () => (await visages(page)).includes('joie'), 6000)
      || (console.log('        visages :', (await visages(page)).join(' → ')), false));
    await page.close();

    /* Les touchers, sur un accueil sans rien à raconter, et dès l'arrivée :
       le salut tient alors la scène, mais sur le visage de repos — rien qui
       se voie, donc rien qui doive rendre le Fanzzy sourd aux premiers
       touchers d'un joueur. */
    page = await ouvrir();
    await jusqua(async () => nom((await scene(page)).src) === 'neutre', 6000);
    /* Au calme pour de bon : la phrase du hub repliée, et le bonjour dit. Un
       toucher seul cède à ce que la bulle dit déjà. */
    await jusqua(() => page.evaluate(() => document.getElementById('bulle').hidden
      && (window.__paroles ?? []).some((p) => p.quoi === 'salut')), 14000);
    await page.evaluate(() => { window.__gestes.length = 0; window.__visages.length = 0; });
    for (let i = 0; i < 3; i++) { await toucher(page); await pause(150); }
    check('trois touchers d’affilée : il exulte',
      await jusqua(async () => (await visages(page)).includes('joie'), 2000)
      || (console.log('        visages :', (await visages(page)).join(' → ')), false));
    check('en sautant à chacun', await sauts(page) === 3
      || (console.log('        sauts :', await sauts(page)), false));
    check('le premier toucher : sa réplique au calme', await dit(page, 'calme', 1000));
    check('le troisième : il en redemande', await dit(page, 'encore', 1000));
    await jusqua(async () => nom((await scene(page)).src) === 'neutre', 4000);
    await pause(400);

    await page.evaluate(() => { window.__gestes.length = 0; window.__visages.length = 0; });
    for (let i = 0; i < 6; i++) { await toucher(page); await pause(150); }
    check('six : il proteste',
      await jusqua(async () => (await visages(page)).includes('colere'), 2000)
      || (console.log('        visages :', (await visages(page)).join(' → ')), false));
    check('et le sixième ne le fait pas sauter', await sauts(page) === 5
      || (console.log('        sauts :', await sauts(page)), false));
    check('et il le dit', await dit(page, 'boude', 1000));
    for (let i = 0; i < 2; i++) { await toucher(page); await pause(150); }
    check('tant qu’il boude, un toucher ne le fait pas sauter', await sauts(page) === 5
      || (console.log('        sauts :', await sauts(page)), false));
    await pause(1900);
    await toucher(page);
    await pause(200);
    check('sa colère passée, il ressaute', await sauts(page) === 6
      || (console.log('        sauts :', await sauts(page)), false));

    /* Un moment tient la scène : un toucher y reste un petit saut. */
    await jusqua(async () => nom((await scene(page)).src) === 'neutre', 4000);
    await pause(1300);
    await page.evaluate(() => TBF.pose('encaisse', 3000));
    await pause(400);
    await page.evaluate(() => { window.__visages.length = 0; });
    for (let i = 0; i < 3; i++) { await toucher(page); await pause(150); }
    await pause(300);
    check('un moment tient son visage : trois touchers ne le lui prennent pas',
      !(await visages(page)).includes('joie')
      || (console.log('        visages :', (await visages(page)).join(' → ')), false));
    await page.close();
  }

  /* Le supporter générique n'a pas de colère : il saute à chaque toucher. */
  await pool.query('UPDATE user_wallet SET active_fanzzy = NULL WHERE user_id = ?', [U]);
  quotidien = null;
  const page = await ouvrir();
  await pause(2600);
  await page.evaluate(() => { window.__gestes.length = 0; });
  for (let i = 0; i < 6; i++) { await toucher(page); await pause(150); }
  await pause(200);
  check('le supporter, sans colère dessinée, saute à chacun des six touchers',
    await sauts(page) === 6 || (console.log('        sauts :', await sauts(page)), false));
  check('mais il dit qu’il en a assez', await dit(page, 'boude', 1000));
  await page.close();
  await pool.query('UPDATE user_wallet SET active_fanzzy = ? WHERE user_id = ?', [equipeAvant ?? null, U]);
}

/* ======================================== ce que le hub dit sans qu'on l'ouvre

   Le lot 2 a donné la parole au hub : chaque tuile porte l'état de ce qui
   l'attend (`data-etat` : direct, prêt, nouveau), le bouton du menu celui
   du plus urgent (`data-urgence`), le Fanzzy parle dans sa bulle, la bâche
   du jour donne le prochain rendez-vous, et le rideau d'ouverture a ses
   libellés, sa consigne et son astuce. **Aucune suite ne les lisait** : seuls
   `directTag` et `directNom` l'étaient, pour le match en direct. Une
   nouveauté sans contrôle peut repartir sans que personne le voie — et la
   première panne de ces états (une réserve rechargée que la tuile ignorait)
   est passée sous tous les contrôles existants.

   Ce qui se lit dans les sources plutôt que de se recopier, comme les délais
   en tête de cette suite : le délai de repli de la bulle, les jours de la
   bâche, la durée, le plancher et les libellés du rideau. Un repère
   introuvable fait rougir le premier contrôle ; la suite continue sur une
   valeur de secours, pour que le reste dise encore quelque chose. */
const SRC_ACCUEIL = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const SRC_OUV = readFileSync(new URL('../public/ouverture.js', import.meta.url), 'utf8');
const nombreLu = (src, re) => {
  const m = src.match(re);
  return m ? Number(m[1].replace(/_/g, '')) : null;
};
const chainesLues = (src, re) => {
  const m = src.match(re);
  return m ? [...m[1].matchAll(/'([^']*)'/g)].map((x) => x[1]) : null;
};
const REPLI_LU = nombreLu(SRC_ACCUEIL, /setTimeout\(replierBulle,\s*([\d_]+)\)/);
const JOURS_LUS = chainesLues(SRC_ACCUEIL, /const JOURS = \[([^\]]*)\]/);
const DUREE_LUE = nombreLu(SRC_OUV, /const DUREE = ([\d_]+)/);
const PLANCHER_LU = nombreLu(SRC_OUV, /const PLANCHER = ([\d_]+)/);
const MOTS_LUS = chainesLues(SRC_OUV, /const MOTS = \[([^\]]*)\]/);
check('les repères du hub et du rideau se lisent dans leurs sources',
  REPLI_LU > 0 && JOURS_LUS?.length === 7 && DUREE_LUE > 0 && PLANCHER_LU > 0
    && MOTS_LUS?.length === 3
  || (console.log('        repli :', REPLI_LU, '· jours :', JOURS_LUS, '· durée :', DUREE_LUE,
    '· plancher :', PLANCHER_LU, '· libellés :', MOTS_LUS), false));
const REPLI_BULLE = REPLI_LU ?? 6000;
const DUREE_OUV = DUREE_LUE ?? 10_000;
const PLANCHER_OUV = PLANCHER_LU ?? 1200;
const MOTS_OUV = MOTS_LUS ?? [];

/* Les erreurs de script de ces blocs-ci : le contrôle général est posé plus
   haut, avant eux, et ne les verrait pas. */
const erreursAvantLot2 = erreurs.length;

/* Un match d'un club suivi, commencé, et une file de duel qui attend un
   supporter : les deux autres sources d'urgence du hub. */
const LIVE = {
  id: 12, open: true, elapsed: 12, status_short: '1H', mien: true,
  home_id: 85, away_id: 91, home_name: 'Sion', away_name: 'Bâle',
  home_goals: 0, away_goals: 0, crowd: [5, 3],
};
const FILE = {
  fixtureId: 1, format: '1v1', attendus: 1, camps: [1, 0], mode: 'classe',
  clubs: [{ id: 85, name: 'Sion' }, { id: 91, name: 'Bâle' }],
  mien: true, presents: 1, campQuiManque: 1, manque: 1,
};

/**
 * Les états que le hub affiche : ceux des tuiles du rail et du tiroir, celui
 * du bouton de menu, et le jeton des boosters.
 *
 * Chaque sticker est lu **tel qu'il est dessiné** — son état, son chiffre, et
 * la couleur de son `::after` — et pas seulement par ses attributs : le bouton
 * du menu doit porter « le chiffre et la couleur » de l'état le plus urgent,
 * c'est-à-dire le même sticker que la tuile qu'il annonce dans le tiroir. On
 * compare donc les deux couleurs calculées, sans recopier aucune teinte ici.
 */
const lireEtats = (page) => page.evaluate(() => {
  const sticker = (n) => {
    if (!n) return null;
    const s = getComputedStyle(n, '::after');
    return { etat: n.dataset.etat ?? null, pastille: n.dataset.pastille ?? null,
      fond: s.backgroundColor, dessine: !['none', 'normal'].includes(s.content) };
  };
  const tuiles = (ou, liste) => Object.fromEntries(liste.map((h) =>
    [h, sticker(document.querySelector(`${ou} .tbf-case[href="${h}"]`))]));
  const b = document.getElementById('burger');
  const m = sticker(b);
  return {
    rail: tuiles('.rail', ['/virage', '/fanzzy', '/boosters', '/duel-nvn']),
    tiroir: tuiles('.tbf-tiroir', ['/virage', '/boosters', '/duel-nvn']),
    // Les tuiles du rail en état, la porte fermée mise à part : le plafond
    // de trois (amendement 7) ne compte que ce qui attend derrière la tuile.
    enEtat: [...document.querySelectorAll('.rail .tbf-case[data-etat]')]
      .filter((n) => n.dataset.etat !== 'verrouille')
      .map((n) => `${n.getAttribute('href')}=${n.dataset.etat}`).sort(),
    menu: { urgence: b?.dataset.urgence ?? null, pastille: b?.dataset.pastille ?? null,
      fond: m?.fond ?? null, dessine: m?.dessine ?? false },
    jeton: document.getElementById('packs')?.textContent.trim() ?? '',
  };
});

/**
 * La bulle du Fanzzy et son « ! ».
 *
 * `police` : demander d'abord la police du marqueur, pour de bon. Le statut
 * de `document.fonts` dit seulement que plus rien n'est en attente, pas que
 * la police est arrivée — les captures de l'audit l'ont montré, prises en
 * Segoe Print sous un relevé « loaded ». Un nombre de lignes mesuré sur la
 * police de repli ne dirait rien de la bulle qu'un joueur voit. La demande
 * est bornée à une seconde et demie : la bulle se replie en six, et une
 * police qui traîne ne doit pas la laisser se replier pendant qu'on mesure.
 * Sans réseau, elle échoue, et le relevé le dit (`marqueur`).
 */
const lireBulle = (page, police = false) => page.evaluate(async (attendre) => {
  if (attendre && document.fonts?.load) {
    await Promise.race([
      document.fonts.load('16px "Permanent Marker"').catch(() => {}),
      new Promise((r) => { setTimeout(r, 1500); }),
    ]);
  }
  const b = document.getElementById('bulle');
  const p = document.getElementById('bullePli');
  const s = getComputedStyle(b);
  const r = b.getBoundingClientRect();
  const lh = Number.parseFloat(s.lineHeight);
  // `offsetHeight` et non le rectangle : la bulle est tournée, et le
  // rectangle d'un élément tourné est plus haut que lui.
  const dedans = b.offsetHeight - Number.parseFloat(s.paddingTop) - Number.parseFloat(s.paddingBottom)
    - Number.parseFloat(s.borderTopWidth) - Number.parseFloat(s.borderBottomWidth);
  return {
    vue: !b.hidden && r.width > 0 && r.height > 0,
    pli: !p.hidden && p.getBoundingClientRect().width > 0,
    pliDit: p.textContent.trim(),
    texte: b.textContent.trim(),
    href: b.getAttribute('href'),
    police: s.fontFamily,
    taille: Number.parseFloat(s.fontSize),
    lignes: lh > 0 ? Math.round(dedans / lh) : null,
    dansLEcran: r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1,
    marqueur: document.fonts?.check?.('16px "Permanent Marker"') ?? null,
  };
}, police);
/** Les mots de la règle du marqueur : ceux qui portent une lettre (« › » n'en est pas un). */
const motsDe = (t) => t.split(/\s+/).filter((m) => /\p{L}/u.test(m)).length;
/** La bulle s'est repliée : elle est cachée, et le « ! » paraît à sa place. */
const bulleRepliee = (page) => page.evaluate(() =>
  document.getElementById('bulle').hidden && !document.getElementById('bullePli').hidden);

/* Les couleurs des trois urgences, relevées sur le bouton du menu au fil des
   blocs : elles doivent être trois, et non une teinte pour tout. */
const couleurs = {};

/* ---- la réserve rechargée : BOOSTERS dit le chiffre du portefeuille ----

   La réserve des boosters se recharge **à la lecture** (`wallet()`, dans le
   module fanzzy) : la base peut dire zéro pendant que trois boosters
   attendent, simplement parce que personne ne l'a encore demandé.
   `/api/me/state` lit la colonne telle quelle, `/api/fanzzy/state` recharge
   d'abord. La tuile BOOSTERS, le jeton et le tiroir doivent dire le second
   chiffre : un joueur à qui l'on montre « 0 » n'ouvre pas les trois boosters
   qu'il a — c'est le constat bloquant de la relecture du lot 2.

   La mise en scène est un retour après une absence : zéro en base, recharge
   datée de trente-cinq minutes (trois boosters à la cadence par défaut : ni
   zéro, ni le plafond, ni les douze du départ de cette suite). La date est
   écrite en JavaScript, comme le module l'exige (voir le pavé sous
   `wallet`). Et le module fanzzy répond avec un retard de téléphone : sur
   une machine locale, la lecture qui recharge peut passer en base avant
   l'autre, et le défaut ne se montrerait qu'une fois sur deux. Le retard
   fixe l'ordre qu'un joueur a sous les yeux.

   Le chiffre attendu est **celui de la base après la visite** : c'est la
   page elle-même qui a rechargé la réserve, on ne recopie pas la cadence. */
{
  direct = null;
  attente = null;
  await pool.query('UPDATE user_wallet SET packs = 0, packs_at = ? WHERE user_id = ?',
    [new Date(Date.now() - 35 * 60_000), U]);
  retardFanzzy = 400;
  const page = await ouvrir();
  retardFanzzy = 0;
  const [[{ packs: recharges }]] = await pool.query(
    'SELECT packs FROM user_wallet WHERE user_id = ?', [U]);
  const attendu = String(recharges);
  // Le jeton compte jusqu'à son chiffre (`FX.compter`) : on le laisse arriver.
  await jusqua(async () => {
    const e = await lireEtats(page);
    return e.rail['/boosters']?.pastille === attendu && e.jeton === attendu;
  });
  const e = await lireEtats(page);
  check(`la visite a rechargé la réserve (${recharges} en base)`, recharges > 0);
  check('BOOSTERS dit « prêt », au chiffre du portefeuille rechargé',
    recharges > 0 && e.rail['/boosters']?.etat === 'pret' && e.rail['/boosters'].pastille === attendu
    || (console.log('        tuile :', JSON.stringify(e.rail['/boosters']),
      '· portefeuille :', recharges), false));
  check('le jeton des boosters dit le même chiffre', recharges > 0 && e.jeton === attendu
    || (console.log('        jeton :', JSON.stringify(e.jeton), '· portefeuille :', recharges), false));
  check('et la tuile du tiroir aussi', recharges > 0
    && e.tiroir['/boosters']?.etat === 'pret' && e.tiroir['/boosters'].pastille === attendu
    || (console.log('        tiroir :', JSON.stringify(e.tiroir['/boosters'])), false));
  await page.close();
}

/* ---- le menu porte l'urgence, et le Fanzzy parle ----

   Une réserve à jour en base (deux boosters, datés de maintenant) : ici on
   éprouve le bouton du menu et la bulle, pas la recharge, qui a son bloc.
   Le sticker du bouton est celui de l'état le plus urgent — le direct, puis
   la récompense prête, puis le duel qui attend —, à la couleur de la tuile
   qu'il annonce : on retrouve en ouvrant le sticker qu'on a vu fermé. */
{
  await pool.query('UPDATE user_wallet SET packs = 2, packs_at = ? WHERE user_id = ?',
    [new Date(), U]);
  direct = null;
  attente = null;
  const page = await ouvrir();
  await jusqua(async () => (await lireEtats(page)).menu.urgence === 'pret', 3000);
  let e = await lireEtats(page);
  check('le menu porte la récompense prête, avec son chiffre',
    e.menu.urgence === 'pret' && e.menu.pastille === '2' && e.menu.dessine
      && e.rail['/boosters']?.etat === 'pret' && e.rail['/boosters'].pastille === '2'
    || (console.log('        menu :', JSON.stringify(e.menu), '· tuile :',
      JSON.stringify(e.rail['/boosters'])), false));
  check('à la couleur du sticker qu’il annonce dans le tiroir',
    e.tiroir['/boosters']?.etat === 'pret' && e.menu.fond === e.tiroir['/boosters'].fond
    || (console.log('        menu', e.menu.fond, '· tiroir', JSON.stringify(e.tiroir['/boosters'])), false));
  couleurs.pret = e.menu.fond;

  /* **La bulle**, posée au lever du rideau : elle parle de ce que la page
     sait déjà, ici des boosters, et mène là où elle dit. Les règles du
     marqueur (amendement 6) se vérifient sur ce qui est écrit : jamais un
     chiffre, jamais plus de quatre mots, jamais sous quinze pixels. */
  let b = await lireBulle(page);
  check('le Fanzzy parle : sa bulle mène aux boosters qui attendent',
    b.vue && !b.pli && b.href === '/boosters' && b.texte !== ''
    || (console.log('        bulle :', JSON.stringify(b)), false));
  check('au marqueur, sans chiffre et en quatre mots au plus (amendement 6)',
    /Permanent Marker/i.test(b.police) && b.taille >= 15
      && !/\d/.test(b.texte) && motsDe(b.texte) <= 4
    || (console.log('        elle dit', JSON.stringify(b.texte), 'en', b.police, b.taille, 'px'), false));
  const phrase = b.texte;

  /* Elle se replie en « ! » au bout de son délai, et le « ! » la rouvre. Le
     premier repli prouve qu'elle se replie ; la réouverture, faite à un
     instant connu, prouve qu'elle tient son délai — ni repliée aussitôt, ni
     restée ouverte. On touche le « ! » comme un joueur, d'un vrai clic, après
     avoir prouvé qu'il est bien sous le doigt : un clic qui tomberait sur la
     bulle partirait vers les boosters. */
  /* **Le bonjour passe d'abord.** À l'arrivée, il attend que la phrase du hub
     se replie pour dire bonjour (`saluer`, qui réessaie toutes les sept
     dixièmes pendant douze secondes) : selon l'instant où la bulle s'est
     ouverte, le « ! » paraît puis s'efface deux secondes et demie sous
     « Salut, toi ! ». On attend donc un repli qui dure, sans parole, plus
     longtemps que l'intervalle du bonjour : sans quoi le clic visait un
     « ! » caché, et la suite rougissait au gré de l'horloge. */
  const replieDurable = async () => {
    const fini = Date.now() + REPLI_BULLE + 2000 + 3500;
    while (Date.now() < fini) {
      const calme = () => page.evaluate(() => !document.getElementById('bulle').dataset.parole);
      if (await bulleRepliee(page) && await calme()) {
        await new Promise((r) => setTimeout(r, 900));
        if (await bulleRepliee(page) && await calme()) return true;
      }
      await new Promise((r) => setTimeout(r, 80));
    }
    return false;
  };
  const replie = await replieDurable();
  b = await lireBulle(page);
  check('elle se replie en « ! »', replie && !b.vue && b.pli && b.pliDit === '!'
    || (console.log('        bulle :', JSON.stringify(b)), false));
  const sousLeDoigt = await page.evaluate(() => {
    const p = document.getElementById('bullePli');
    const r = p.getBoundingClientRect();
    return p.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2));
  });
  const t0 = Date.now();
  await page.click('#bullePli');
  // Le temps que son entrée (`tbf-colle`, deux dixièmes) finisse : mesurée
  // pendant, la bulle est encore agrandie et penchée.
  await new Promise((r) => setTimeout(r, 400));
  b = await lireBulle(page, true);
  check('le « ! » la rouvre, sur la même phrase',
    sousLeDoigt && b.vue && !b.pli && b.texte === phrase && page.url() === `${base}/`
    || (console.log('        sous le doigt :', sousLeDoigt, '· bulle :', JSON.stringify(b),
      '· adresse :', page.url()), false));
  check('sur deux lignes au plus, et dans l’écran',
    b.lignes >= 1 && b.lignes <= 2 && b.dansLEcran
    || (console.log('        lignes :', b.lignes, '· dans l’écran :', b.dansLEcran,
      '· marqueur chargé :', b.marqueur), false));
  const repliee = await jusqua(() => bulleRepliee(page), REPLI_BULLE + 2500);
  const tenue = Date.now() - t0;
  check(`et elle tient ses ${REPLI_BULLE / 1000} s avant de se replier (${(tenue / 1000).toFixed(1)} s)`,
    repliee && tenue >= REPLI_BULLE - 700 && tenue <= REPLI_BULLE + 1800);

  /* **Une parole passe, la phrase reste** (voir « la parole du Fanzzy ») :
     il dit un mot sur la bulle repliée, sans adresse, puis le « ! » revient,
     qui rouvre la même phrase vers les boosters. */
  const dite = await page.evaluate(() => TBF.parler('victoire'));
  b = await lireBulle(page);
  check('il parle par-dessus le « ! » : un mot qui ne mène nulle part',
    dite && b.vue && !b.pli && b.href === null && b.texte === dite
    || (console.log('        dit :', dite, '· bulle :', JSON.stringify(b)), false));
  const revenu = await jusqua(() => bulleRepliee(page), 4000);
  b = await lireBulle(page);
  check('puis le « ! » revient, sur la phrase des boosters',
    revenu && b.pli && b.texte === phrase && b.href === '/boosters'
    || (console.log('        bulle :', JSON.stringify(b)), false));
  check('un bonjour cède à la phrase ouverte du hub',
    await page.evaluate(() => { document.getElementById('bullePli').click(); return TBF.parler('salut', { cede: true }); }) === null
    && (await lireBulle(page)).href === '/boosters');

  /* **Un club suivi joue** : le direct passe devant la récompense, sur le
     bouton du menu comme dans la bulle, qui parle d'abord du match. */
  direct = { ...LIVE };
  await page.evaluate(() => TBF.veiller());
  await jusqua(async () => (await lireEtats(page)).menu.urgence === 'direct', 3000);
  e = await lireEtats(page);
  b = await lireBulle(page);
  check('un club suivi joue : le direct passe devant la récompense',
    e.menu.urgence === 'direct' && e.menu.dessine && e.rail['/virage']?.etat === 'direct'
      && e.rail['/boosters']?.etat === 'pret'
    || (console.log('        menu :', JSON.stringify(e.menu), '· rail :', e.enEtat.join(' ')), false));
  check('à la couleur du LIVE du tiroir',
    e.tiroir['/virage']?.etat === 'direct' && e.menu.fond === e.tiroir['/virage'].fond
    || (console.log('        menu', e.menu.fond, '· tiroir', JSON.stringify(e.tiroir['/virage'])), false));
  couleurs.direct = e.menu.fond;
  check('et la bulle parle d’abord du match', b.vue && b.href === '/virage'
    || (console.log('        bulle :', JSON.stringify(b)), false));

  /* Le match fini, quelqu'un attend en duel : le tiroir le dit sur sa
     tuile, mais la récompense prête reste devant sur le bouton — le duel
     vient en dernier dans l'ordre d'urgence. */
  direct = null;
  attente = { ...FILE };
  await page.evaluate(() => TBF.veiller());
  await jusqua(async () => (await lireEtats(page)).tiroir['/duel-nvn']?.etat === 'attend', 3000);
  e = await lireEtats(page);
  check('quelqu’un attend en duel : le tiroir le dit, la récompense reste devant',
    e.tiroir['/duel-nvn']?.etat === 'attend' && e.tiroir['/duel-nvn'].pastille === '1'
      && e.menu.urgence === 'pret' && e.menu.pastille === '2' && e.rail['/virage']?.etat === null
    || (console.log('        menu :', JSON.stringify(e.menu), '· duel :',
      JSON.stringify(e.tiroir['/duel-nvn']), '· rail :', e.enEtat.join(' ')), false));
  attente = null;
  await page.close();
}

/* ---- sans réserve : le duel qui attend, puis plus rien ; puis les trois états ---- */
{
  await pool.query('UPDATE user_wallet SET packs = 0, packs_at = ? WHERE user_id = ?',
    [new Date(), U]);
  direct = null;
  attente = { ...FILE };
  const page = await ouvrir();
  await jusqua(async () => (await lireEtats(page)).menu.urgence === 'attend', 3000);
  let e = await lireEtats(page);
  check('sans réserve, le menu annonce le duel qui attend, et combien',
    e.menu.urgence === 'attend' && e.menu.pastille === '1' && e.menu.dessine
      && e.tiroir['/duel-nvn']?.etat === 'attend' && e.menu.fond === e.tiroir['/duel-nvn'].fond
    || (console.log('        menu :', JSON.stringify(e.menu), '· duel :',
      JSON.stringify(e.tiroir['/duel-nvn'])), false));
  couleurs.attend = e.menu.fond;
  check('et BOOSTERS ne promet rien qu’il n’a pas',
    e.rail['/boosters']?.etat === null && e.rail['/boosters'].pastille === null && e.jeton === '0'
    || (console.log('        tuile :', JSON.stringify(e.rail['/boosters']), '· jeton :', e.jeton), false));
  /* Rien à dire — pas de match, pas de réserve, pas de nouvelle carte, un
     Fanzzy équipé : pas de bulle, et pas de « ! » qui rouvrirait du vide. */
  /* Il peut dire bonjour (voir « la parole du Fanzzy ») : une parole n'est
     pas une phrase du hub — elle ne mène nulle part, et ne laisse pas de
     « ! » derrière elle. */
  const b = await lireBulle(page);
  check('rien à dire : ni bulle qui mène quelque part, ni « ! »', (!b.vue || b.href === null) && !b.pli
    || (console.log('        bulle :', JSON.stringify(b)), false));

  /* La file partie, le bouton redevient muet : un état sans donnée ne se
     pose pas, et une pastille permanente cesse d'être une alerte. */
  attente = null;
  await page.evaluate(() => TBF.veiller());
  await jusqua(async () => (await lireEtats(page)).menu.urgence === null, 3000);
  e = await lireEtats(page);
  check('la file partie, le menu se tait',
    e.menu.urgence === null && e.menu.pastille === null && !e.menu.dessine
    || (console.log('        menu :', JSON.stringify(e.menu)), false));
  const teintes = [couleurs.direct, couleurs.pret, couleurs.attend];
  check('trois urgences, trois couleurs', teintes.every(Boolean) && new Set(teintes).size === 3
    || (console.log('        direct', couleurs.direct, '· prêt', couleurs.pret,
      '· attend', couleurs.attend), false));

  /* **« +N » sur FANZZY : deux chemins, et la suite éprouve les deux.**

     Depuis les lots 3 et 5, le hub compte les nouveautés **du serveur** :
     `nouveautes` de `/api/fanzzy/state` (CONTRATS § 2.1), écrites au moment
     du gain, les mêmes sur tous les appareils, et éteintes par la page qui
     les montre (§ 2.2). Le hub en éteint une part, et une seule : les clés
     que sa pastille comptait quand on a touché FANZZY, au retour et jamais
     au toucher (ECARTS, accueil n° 2, révisé le 3 octobre 2026 — un écart
     documenté au « jamais au chargement » du § 2.2). La mémoire de
     l'appareil (`tbf.vus`) n'est plus que le **repli** d'un serveur qui ne
     sert pas le champ : table absente, ou serveur d'avant le contrat.

     Ces contrôles ne lisaient que le repli, et sans le savoir : la suite ne
     posait ni ne vidait `user_nouveautes`, si bien que leur verdict dépendait
     de la suite passée avant elle — la table laissée là, le serveur servait
     `[]` et le « +1 » de la mémoire locale ne venait jamais. La table est
     donc retirée au démarrage (voir la liste des `DROP`) : on éprouve d'abord
     le repli, puis on la pose pour le chemin du serveur, et on la retire en
     partant.

     Les cartes ajoutées sont des cartes que le compte n'a pas encore,
     choisies dans le catalogue publié : écrites en dur, elles finiraient par
     être déjà possédées. */
  const [lignes] = await pool.query('SELECT fanzzy_id FROM user_fanzzy WHERE user_id = ?', [U]);
  const deja = new Set(lignes.map((l) => l.fanzzy_id));
  const [NEUVE, NEUVE2] = PUB.filter((f) => !AGE_SUP.has(f.id) && !deja.has(f.id)).map((f) => f.id);
  await pool.query('UPDATE user_wallet SET packs = 2, packs_at = ? WHERE user_id = ?',
    [new Date(), U]);
  const revenir = async () => {
    await page.goto(`${base}/`, { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => typeof window.TBF?.veiller === 'function',
      { timeout: 8000 }).catch(() => {});
    // BOOSTERS en « prêt » dit que les états ont été posés, avec ou sans « +N ».
    await jusqua(async () => (await lireEtats(page)).rail['/boosters']?.etat === 'pret');
  };
  /* L'état tel que la vraie route le sert à ce joueur — l'attendu du « +N »,
     lu à la source plutôt que supposé. Depuis Node, et non depuis la page :
     ce banc authentifie toute requête, et la page ne doit rien envoyer que
     le hub n'aurait envoyé lui-même. */
  const etatServi = () => fetch(`${base}/api/fanzzy/state`).then((r) => r.json()).catch(() => null);
  /* Les demandes d'extinction parties de la page, sur tout le bloc, gardées
     entières pour en lire le corps. Le hub n'en envoie qu'une, sur le chemin
     du serveur, au retour d'un toucher ; aucune dans le repli, aucune au
     chargement d'une visite sans toucher, aucune au toucher lui-même. La
     liste dit **quand** elles partent (on la mesure avant et après le
     retour), et **quoi** : une demande `{ tout: true }` ferait tomber la
     pastille aussi bien, en éteignant ce que le joueur n'a pas vu. */
  const extinctions = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && new URL(r.url()).pathname === '/api/fanzzy/vu') extinctions.push(r);
  });
  const corpsDe = (r) => { try { return JSON.parse(r.postData() ?? 'null'); } catch { return null; } };
  /* Un vrai clic sur FANZZY, et la preuve qu'il est bien parti vers le
     classeur — sans quoi on éprouverait un clic tombé ailleurs. On guette
     **la demande de navigation**, et non l'adresse d'arrivée : ce banc ne
     sert pas le classeur, et une page d'erreur du navigateur n'aurait pas
     d'adresse à lire. Pour la même raison, rien de ce qu'on retrouve au
     retour n'est l'œuvre du classeur : c'est celle du hub seul. */
  const toucherFanzzy = async () => {
    const versClasseur = page.waitForRequest((r) => r.isNavigationRequest()
      && new URL(r.url()).pathname === '/fanzzy', { timeout: 4000 }).then(() => true, () => false);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 4000 }).catch(() => {}),
      page.click('#caseFanzzy'),
    ]);
    return versClasseur;
  };

  /* ---- le repli : la mémoire de l'appareil ----

     Sans la table, le serveur ne sait pas, et sa réponse n'a pas de champ
     `nouveautes` — ce qui n'est pas « rien de nouveau ». Le hub compte alors
     les cartes arrivées depuis la dernière visite **sur cet appareil**. La
     première visite (l'ouverture de ce bloc) n'en a montré aucune — tout ce
     qu'on possède n'est pas nouveau — et a tout marqué comme vu ; on ajoute
     donc une carte, et on revient **dans le même navigateur**, là où ce
     souvenir vit. Un « +1 » et pas davantage dit aussi que la première visite
     a bien tout retenu. */
  await pool.query('INSERT INTO user_fanzzy (user_id, fanzzy_id, copies) VALUES (?, ?, 1)', [U, NEUVE]);
  await revenir();
  e = await lireEtats(page);
  let servi = await etatServi();
  check('sans nouveautés servies, une carte arrivée depuis la visite d’avant : FANZZY dit « +1 »',
    servi?.collection && !('nouveautes' in servi)
      && e.rail['/fanzzy']?.etat === 'nouveau' && e.rail['/fanzzy'].pastille === '+1'
    || (console.log('        carte', NEUVE, '· nouveautes servies :', JSON.stringify(servi?.nouveautes),
      '· FANZZY :', JSON.stringify(e.rail['/fanzzy'])), false));

  /* Dans le repli, toucher FANZZY marque tout comme vu **sur l'appareil** :
     au retour, le « +1 » ne revient pas, et rien n'est parti au serveur — il
     n'a rien servi, il n'y a rien à lui éteindre. Ce « rien » se lisait
     autrefois au compte final du bloc, qui exigeait zéro demande ; le chemin
     du serveur en envoie une désormais, il se lit donc ici. */
  let parti = await toucherFanzzy();
  await revenir();
  e = await lireEtats(page);
  check('sans nouveautés servies, toucher FANZZY marque tout comme vu : le « +1 » ne revient pas',
    parti && extinctions.length === 0
      && e.rail['/fanzzy']?.etat === null && e.rail['/boosters']?.etat === 'pret'
    || (console.log('        parti vers le classeur :', parti, '· extinctions envoyées :',
      extinctions.length, '· FANZZY :', JSON.stringify(e.rail['/fanzzy'])), false));

  /* ---- le chemin du serveur ----

     La table posée, un booster a donné une carte et une expression : deux
     nouveautés, écrites avec les clés que le serveur écrit au gain
     (`noterNouveautes`, CONTRATS § 2.1). La carte rejoint aussi la
     collection, et la mémoire de l'appareil, qui la voit arriver, dirait
     « +1 » : le « +2 » attendu ne peut venir que du serveur. C'est ce qui
     départage les deux chemins — avec une seule nouveauté, un hub resté sur
     sa mémoire locale passerait le contrôle. */
  await pool.query(TABLE_NOUVEAUTES);
  await pool.query('DELETE FROM user_nouveautes WHERE user_id = ?', [U]);
  await pool.query('INSERT INTO user_fanzzy (user_id, fanzzy_id, copies) VALUES (?, ?, 1)', [U, NEUVE2]);
  await pool.query(
    'INSERT INTO user_nouveautes (user_id, cle, sorte) VALUES (?, ?, ?), (?, ?, ?)',
    [U, `fanzzy:${NEUVE2}`, 'fanzzy', U, `etat:${NEUVE2}:1:joie`, 'etat']);
  await revenir();
  await jusqua(async () => (await lireEtats(page)).rail['/fanzzy']?.etat === 'nouveau', 3000);
  e = await lireEtats(page);
  servi = await etatServi();
  check('nouveautés servies : FANZZY dit « +N », N = nouveautes.length',
    Array.isArray(servi?.nouveautes) && servi.nouveautes.length === 2
      && e.rail['/fanzzy']?.etat === 'nouveau'
      && e.rail['/fanzzy'].pastille === `+${servi.nouveautes.length}`
    || (console.log('        carte', NEUVE2, '· nouveautes servies :', JSON.stringify(servi?.nouveautes),
      '· FANZZY :', JSON.stringify(e.rail['/fanzzy'])), false));

  /* Le direct, la récompense et la nouveauté ensemble : les trois tuiles
     les portent, chacune à sa place, et rien d'autre n'est en état. C'est
     le plafond de l'amendement 7 tenu à son maximum — sur le chemin du
     serveur, celui de la production. */
  direct = { ...LIVE };
  await page.evaluate(() => TBF.veiller());
  await jusqua(async () => (await lireEtats(page)).rail['/virage']?.etat === 'direct', 3000);
  e = await lireEtats(page);
  check('direct, prêt et nouveau tiennent ensemble, et rien de plus',
    e.enEtat.join(' ') === ['/boosters=pret', '/fanzzy=nouveau', '/virage=direct'].sort().join(' ')
      && e.rail['/boosters'].pastille === '2' && e.rail['/fanzzy'].pastille === '+2'
    || (console.log('        en état :', e.enEtat.join(' ')), false));
  direct = null;
  await page.evaluate(() => TBF.veiller());

  /* **Toucher FANZZY éteint, mais au retour** (ECARTS, accueil n° 2, révisé
     le 3 octobre 2026). La première version n'éteignait rien, et ce
     contrôle l'exigeait : comme ni le classeur, ni la collection, ni la
     fiche n'éteignent encore (lot 4), le « +5 » d'un premier booster restait
     allumé jusqu'à la purge des soixante jours — une pastille permanente,
     qu'on cesse de lire, là où celle du lot 2 tombait au toucher. Le hub met
     donc de côté, au toucher, les clés que sa pastille comptait, et les
     éteint à la lecture suivante de l'état. **Pas au toucher** : le
     classeur vers lequel on part doit encore pouvoir coller son NOUVEAU.
     **Par leurs clés**, pas `{ tout: true }` : ce qui arrive entre-temps
     garde son « +N ».

     Pour que ce dernier point se voie, une nouveauté arrive **entre le
     toucher et le retour** — un booster ouvert depuis le classeur. Cinq
     preuves, parce que chacune laisse passer un hub fautif que les autres
     arrêtent :
       - aucune demande partie avant le retour : ni au chargement d'une
         visite sans toucher, ni au toucher lui-même ;
       - une seule après, dont le corps nomme exactement les deux clés que la
         pastille comptait — ni `tout`, ni `sorte`, ni la clé arrivée après ;
       - la base n'a plus que la ligne arrivée après : la demande est allée
         au bout (une demande refusée laisserait les trois) ;
       - FANZZY dit « +1 » : le « +2 » est tombé, et la nouveauté que le
         joueur n'a pas vue est comptée ;
       - le départ vers le classeur, sans quoi on éprouverait un clic tombé
         ailleurs.
     L'extinction part en `keepalive` après la lecture de l'état : on attend
     que la base l'ait reçue plutôt que de supposer qu'elle est arrivée. */
  const COMPTEES = [`fanzzy:${NEUVE2}`, `etat:${NEUVE2}:1:joie`];
  const ARRIVEE = `etat:${NEUVE2}:1:colere`;
  const lignesRestantes = async () => (await pool.query(
    'SELECT cle FROM user_nouveautes WHERE user_id = ? ORDER BY cle', [U]))[0].map((l) => l.cle);
  parti = await toucherFanzzy();
  const avantRetour = extinctions.length;
  await pool.query('INSERT INTO user_nouveautes (user_id, cle, sorte) VALUES (?, ?, ?)',
    [U, ARRIVEE, 'etat']);
  await revenir();
  await jusqua(async () => (await lignesRestantes()).length === 1, 3000);
  await jusqua(async () => (await lireEtats(page)).rail['/fanzzy']?.pastille === '+1', 3000);
  e = await lireEtats(page);
  const gardees = await lignesRestantes();
  const envoyees = extinctions.slice(avantRetour).map(corpsDe);
  const parSesCles = envoyees.length === 1 && envoyees[0] !== null
    && Object.keys(envoyees[0]).join() === 'cles' && Array.isArray(envoyees[0].cles)
    && envoyees[0].cles.length === COMPTEES.length
    && COMPTEES.every((k) => envoyees[0].cles.includes(k));
  check('nouveautés servies : toucher FANZZY les éteint au retour, par leurs clés — le « +2 » tombe, '
    + 'celle d’après reste',
    parti && avantRetour === 0 && parSesCles
      && gardees.length === 1 && gardees[0] === ARRIVEE
      && e.rail['/fanzzy']?.etat === 'nouveau' && e.rail['/fanzzy'].pastille === '+1'
    || (console.log('        parti vers le classeur :', parti, '· extinctions avant le retour :',
      avantRetour, '· après :', JSON.stringify(envoyees), '· lignes gardées :', JSON.stringify(gardees),
      '· FANZZY :', JSON.stringify(e.rail['/fanzzy'])), false));

  /* Ce que le toucher n'a pas compté — la nouveauté arrivée après — reste
     à la page qui la montre (§ 2.2) : ici par la vraie route, comme le
     classeur le fera au lot 4. À la lecture suivante de l'état, le « +1 »
     tombe, et le hub n'envoie rien de plus : une visite sans toucher n'a
     rien à éteindre — c'est le « jamais au chargement » du § 2.2, tenu hors
     du seul écart. */
  const eteint = await fetch(`${base}/api/fanzzy/vu`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tout: true }),
  }).then((r) => r.json()).catch(() => null);
  await revenir();
  e = await lireEtats(page);
  servi = await etatServi();
  check('nouveautés éteintes par la page qui les montre : le « +N » tombe au retour',
    eteint?.restantes === 0 && Array.isArray(servi?.nouveautes) && servi.nouveautes.length === 0
      && extinctions.length === avantRetour + 1
      && e.rail['/fanzzy']?.etat === null && e.rail['/boosters']?.etat === 'pret'
    || (console.log('        extinction :', JSON.stringify(eteint), '· nouveautes servies :',
      JSON.stringify(servi?.nouveautes), '· extinctions envoyées par la page :', extinctions.length,
      '· FANZZY :', JSON.stringify(e.rail['/fanzzy'])), false));
  await page.close();
  /* La base rendue telle qu'on l'a trouvée : sans ces deux cartes, et sans
     la table, que le reste de la suite n'a jamais vue. */
  await pool.query('DROP TABLE IF EXISTS user_nouveautes');
  await pool.query('DELETE FROM user_fanzzy WHERE user_id = ? AND fanzzy_id IN (?, ?)',
    [U, NEUVE, NEUVE2]);
}

/* ---- la bâche du jour : le prochain rendez-vous, sinon la suite du parcours ----

   Le ticket kraft du bas a quatre façons de se remplir, et la première qui
   a ses données l'emporte : le direct (éprouvé plus haut, avec le match),
   le prochain coup d'envoi d'un club suivi, l'étape suivante des premiers
   pas, et « Répéter un geste », qui ne dépend de rien.

   **NS contre TBD.** Le calendrier sert aussi des rencontres « TBD » : la
   date est posée, l'heure ne l'est pas, et `kickoff_at` porte une heure de
   remplissage — souvent minuit. L'annoncer serait donner rendez-vous à une
   heure que personne n'a fixée, avec un compte à rebours vers rien : « un
   état sans donnée ne s'affiche pas ». Deux exigences, donc : l'heure
   provisoire n'est jamais annoncée ; et, comme `prochain()` l'écrit dans
   `index.html`, une « TBD » qui vient la première suspend l'annonce — ni
   son heure fausse, ni le match d'après, qui n'est pas le prochain.

   La disposition du ticket a bougé pendant le lot (l'affiche dans le titre,
   le moment dessous) : les contrôles lisent le ticket entier, et pas une
   ligne précise, pour juger de ce qu'il dit et non de l'endroit où il le
   range.

   Les dates sont prises dans le fuseau du navigateur, qui est celui de ce
   poste : trois jours plus tard à 20:45 pour la rencontre programmée (le
   jour s'écrit alors en abrégé, lu dans `JOURS`), demain à minuit pour
   l'autre, et dans cinq heures pour celle dont on compte les heures. */
{
  const aLHeure = (jours, h, m) => {
    const d = new Date();
    d.setDate(d.getDate() + jours);
    d.setHours(h, m, 0, 0);
    return d;
  };
  const NS = { id: 501, status_short: 'NS', kickoff_at: aLHeure(3, 20, 45).toISOString(),
    home_id: 85, away_id: 92, home_name: 'Sion', away_name: 'Lausanne' };
  const TBD = { id: 502, status_short: 'TBD', kickoff_at: aLHeure(1, 0, 0).toISOString(),
    home_id: 93, away_id: 85, home_name: 'Servette', away_name: 'Sion' };
  const jourNS = (JOURS_LUS ?? [])[new Date(NS.kickoff_at).getDay()] ?? '(jours introuvables)';
  /* Les premiers pas : deux étapes faites sur six, la troisième mène au
     deck, et le parcours rapporte un booster tant qu'il n'est pas payé. */
  const PARCOURS = {
    etapes: [
      { cle: 'fanzzy', titre: 'Ton premier Fanzzy', ou: '/fanzzy', fait: true },
      { cle: 'booster', titre: 'Ouvre un booster', ou: '/boosters', fait: true },
      { cle: 'deck', titre: 'Compose ton deck', ou: '/deck', fait: false },
      { cle: 'virage', titre: 'Pousse dans le Grand Virage', ou: '/virage', fait: false },
      { cle: 'duel', titre: 'Joue un duel', ou: '/duel-nvn', fait: false },
      { cle: 'evolution', titre: 'Fais grandir un Fanzzy', ou: '/fanzzy', fait: false },
    ],
    faites: 2, total: 6, recompense: 1, paye: false,
  };
  /* Dans cinq heures : à moins d'un jour, le ticket compte les heures. */
  const PROCHE = { id: 503, status_short: 'NS', kickoff_at: new Date(Date.now() + 5 * 3_600_000).toISOString(),
    home_id: 85, away_id: 94, home_name: 'Sion', away_name: 'Lugano' };
  const lireBache = (page) => page.evaluate(() => {
    const t = (id) => document.getElementById(id)?.textContent.trim() ?? '';
    const rang = document.getElementById('directRang')?.hidden === false;
    const g = document.getElementById('directGain');
    const v = {
      href: document.getElementById('direct').getAttribute('href'),
      tag: t('directTag'), nom: t('directNom'), sous: t('directSous'),
      aria: document.getElementById('direct').getAttribute('aria-label') ?? '',
      rang,
      v: t('directV'),
      // Le gain vit dans la rangée des premiers pas : caché avec elle, il ne dit rien.
      gain: rang && g && !g.hidden ? t('directGainN') : null,
    };
    // Tout ce que le ticket dit, à l'œil comme à l'oreille.
    v.tout = [v.tag, v.nom, v.sous, v.v, v.aria].join(' ');
    return v;
  });
  /** Une visite neuve sur ce calendrier et ce parcours : la bâche se lit au chargement. */
  const visite = async (cal, parc) => {
    calendrier = cal;
    parcours = parc;
    const page = await ouvrir();
    const v = await lireBache(page);
    await page.close();
    return v;
  };
  direct = null;
  attente = null;
  /** Le ticket annonce cette rencontre-là : son affiche, son jour et son heure. */
  const annonceNS = (v) => v.href === '/matchs' && /PROCHAIN COUP D.ENVOI/i.test(v.tag)
    && [jourNS, '20:45', 'Sion', 'Lausanne'].every((x) => `${v.tag} ${v.nom} ${v.sous}`.includes(x));
  /** Rien de la rencontre sans heure n'est dit : ni son adversaire, ni son minuit. */
  const taitTBD = (v) => !v.tout.includes('Servette') && !v.tout.includes('00:00');

  let v = await visite([NS], PARCOURS);
  check(`la bâche du jour annonce le prochain coup d’envoi (${jourNS} 20:45)`, annonceNS(v)
    || (console.log('        bâche :', JSON.stringify(v)), false));

  v = await visite([PROCHE], PARCOURS);
  check('à moins d’un jour, elle compte les heures jusqu’au coup d’envoi',
    v.href === '/matchs' && /PROCHAIN COUP D.ENVOI/i.test(v.tag) && v.tout.includes('Lugano')
      && /dans \d+ h/.test(`${v.nom} ${v.sous}`)
    || (console.log('        bâche :', JSON.stringify(v)), false));

  v = await visite([TBD, NS], PARCOURS);
  check('l’heure provisoire d’une rencontre « TBD » n’est jamais annoncée', taitTBD(v)
    || (console.log('        bâche :', JSON.stringify(v)), false));
  check('et venue la première, elle suspend l’annonce : ni elle, ni le match d’après',
    !/PROCHAIN/i.test(v.tag) && !v.tout.includes('Lausanne') && v.href === '/deck'
    || (console.log('        bâche :', JSON.stringify(v)), false));

  v = await visite([], PARCOURS);
  check('sans rencontre à venir, elle montre l’étape suivante des premiers pas',
    v.href === '/deck' && v.nom === 'Compose ton deck' && v.rang
      && `${v.tag} ${v.v}`.replace(/\s/g, '').includes('2/6')
    || (console.log('        bâche :', JSON.stringify(v)), false));
  check('et ce que le parcours rapporte, tant qu’il ne l’a pas rapporté',
    (v.gain ?? '').replace(/\D/g, '') === '1'
    || (console.log('        gain :', JSON.stringify(v.gain)), false));

  /* Une « TBD » seule, et plus de premiers pas : rien à annoncer, la case
     retombe sur ce qui ne dépend de rien — sans ligne vide ni tiret. */
  v = await visite([TBD], null);
  check('une rencontre sans heure, seule, ne s’annonce pas non plus',
    !/PROCHAIN/i.test(v.tag) && taitTBD(v)
    || (console.log('        bâche :', JSON.stringify(v)), false));
  check('et la bâche retombe sur « Répéter un geste », sans ligne vide ni tiret',
    v.href === '/repetition' && /répéter un geste/i.test(v.nom) && v.tag === '' && v.sous === '' && !v.rang
    || (console.log('        bâche :', JSON.stringify(v)), false));
  calendrier = null;
  parcours = null;
}

/* ---- le rideau : ses libellés par tiers, sa consigne, son astuce ----

   L'écran d'ouverture du lot 2 parle pendant qu'il couvre : trois libellés
   qui changent par tiers de sa durée, « TOUCHE POUR ENTRER » au bout du
   plancher, l'astuce du jour sur un ticket — et **pas de marqueur** sur le
   rideau (amendement 6). Rien de cela n'était lu.

   Pour les voir, il faut que le rideau reste : il part dès que l'accueil est
   prêt, en un peu plus d'une seconde sur ce banc. On retient donc le module
   fanzzy un peu moins longtemps que la durée du rideau — l'accueil n'est pas
   prêt avant —, et les trois libellés ont le temps de passer. Les instants
   sont relevés **dans la page** (`performance.now()`, au changement même),
   et non devinés depuis ici : c'est ce qui permet de dire « par tiers » sans
   une attente réglée à la main. Puis on laisse le rideau partir avant de
   fermer : les réponses retenues ne doivent pas tomber pendant le bloc
   suivant. */
{
  retardFanzzy = Math.round(DUREE_OUV * 0.85);
  const ctx = await (nav.createBrowserContext?.() ?? nav.createIncognitoBrowserContext());
  const p = await ctx.newPage();
  p.on('pageerror', (er) => erreurs.push(er.message));
  await p.setViewport({ width: 360, height: 640 });
  /* Au premier plan : la jauge et ses libellés avancent au rythme des
     images (`requestAnimationFrame`), et un onglet de fond peut en recevoir
     moins — les pages ouvertes plus haut ne sont pas toutes fermées. */
  await p.bringToFront();
  await p.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
  const debut = await p.evaluate(() => {
    const e = document.getElementById('ouverture');
    if (!e) return null;
    const mot = document.getElementById('ouvMot');
    window.__rideau = [];
    const noter = () => window.__rideau.push({ t: performance.now(),
      mot: mot?.textContent.trim() ?? '', entrable: e.classList.contains('entrable') });
    new MutationObserver(noter).observe(e, { attributes: true, attributeFilter: ['class'] });
    if (mot) new MutationObserver(noter).observe(mot, { childList: true, characterData: true, subtree: true });
    const a = document.getElementById('ouvAstuce');
    return {
      t: performance.now(),
      mot: mot?.textContent.trim() ?? null,
      entrable: e.classList.contains('entrable'),
      marqueur: [...e.querySelectorAll('*')]
        .filter((n) => /Permanent Marker/i.test(getComputedStyle(n).fontFamily))
        .map((n) => n.id || n.getAttribute('class') || n.tagName),
      astuce: a && !a.hidden ? { texte: a.querySelector('p')?.textContent.trim() ?? '',
        cle: a.querySelector('p b')?.textContent.trim() ?? '',
        titre: a.querySelector('.k')?.textContent.trim() ?? '' } : null,
    };
  });
  const dernier = await p.waitForFunction((m) =>
    document.getElementById('ouvMot')?.textContent.trim() === m,
  { timeout: DUREE_OUV + 2000 }, MOTS_OUV[2] ?? '').then(() => true).catch(() => false);
  retardFanzzy = 0;
  const fin = await p.evaluate(() => {
    const c = document.querySelector('.ouverture .consigne');
    const s = c ? getComputedStyle(c) : null;
    return { journal: window.__rideau ?? [],
      consigne: c ? { texte: c.textContent.trim(), vue: s.visibility === 'visible' && s.opacity === '1' } : null };
  });

  check('le rideau couvre l’arrivée, sur son premier libellé',
    debut !== null && debut.mot === MOTS_OUV[0]
    || (console.log('        rideau :', JSON.stringify(debut)), false));
  /* Chaque libellé arrive au tiers qui est le sien : pas avant (le compte
     part au plus tôt avec la page), et pas une seconde trop tard. */
  const quand = (m) => fin.journal.find((x) => x.mot === m)?.t ?? null;
  const t1 = quand(MOTS_OUV[1]);
  const t2 = quand(MOTS_OUV[2]);
  const auTiers = (t, k) => t !== null && t >= (DUREE_OUV * k) / 3 - 50 && t <= (DUREE_OUV * k) / 3 + 2000;
  check('puis ses deux autres libellés, chacun à son tiers',
    dernier && auTiers(t1, 1) && auTiers(t2, 2)
    || (console.log('        libellés :', JSON.stringify(fin.journal.map((x) => [Math.round(x.t), x.mot]))), false));
  /* La consigne paraît au bout du plancher, et pas avant : c'est à partir
     de là que toucher fait partir l'écran. Déjà là à la première lecture,
     elle n'est jugeable que si cette lecture venait après le plancher. */
  const tEntrable = debut?.entrable ? (debut.t >= PLANCHER_OUV - 50 ? debut.t : -1)
    : (fin.journal.find((x) => x.entrable)?.t ?? null);
  check('« TOUCHE POUR ENTRER » paraît au bout du plancher',
    tEntrable !== null && tEntrable >= PLANCHER_OUV - 50 && tEntrable <= PLANCHER_OUV + 2000
      && fin.consigne?.vue === true && /TOUCHE POUR ENTRER/i.test(fin.consigne.texte)
    || (console.log('        entrable à', tEntrable, '· consigne :', JSON.stringify(fin.consigne)), false));
  /* L'astuce du jour : un ticket, son mot-clé mis en valeur, et aucun
     nombre — un nombre réglable depuis l'administration ment toujours en
     premier (voir `ASTUCES`, dans `ouverture.js`). */
  check('l’astuce du jour est posée, avec son mot-clé et sans aucun nombre',
    debut?.astuce !== null && debut?.astuce !== undefined && debut.astuce.cle !== ''
      && debut.astuce.texte.includes(debut.astuce.cle) && !/\d/.test(debut.astuce.texte)
      && debut.astuce.titre !== ''
    || (console.log('        astuce :', JSON.stringify(debut?.astuce)), false));
  check('et pas de marqueur sur le rideau (amendement 6)', debut !== null && debut.marqueur.length === 0
    || (console.log('        au marqueur :', debut?.marqueur.join(' · ')), false));

  await p.waitForFunction(() => !document.getElementById('ouverture'),
    { timeout: OUVERTURE_MS }).catch(() => {});
  await p.close();
  await ctx.close?.();
}

/* La réserve de départ, rendue : les blocs qui suivent ne la lisent pas,
   mais une suite qu'on relit doit retrouver le compte qu'elle a posé. */
await pool.query('UPDATE user_wallet SET packs = 12, packs_at = ? WHERE user_id = ?', [new Date(), U]);
check('aucune erreur de script pendant ces contrôles du hub', erreurs.length === erreursAvantLot2
  || (console.log('   ', erreurs.slice(erreursAvantLot2, erreursAvantLot2 + 3)), false));


/* ============================ installer le jeu sur l'appareil

   Trois cas, et le troisième est celui qu'on oublie toujours :

     — le navigateur sait installer : un bouton, et le geste est fait ;
     — c'est un iPhone : Safari n'envoie aucun événement et n'expose aucune
       commande. On ne peut qu'expliquer le geste, et ne rien dire serait pire,
       puisque aucun autre chemin ne mène à l'icône ;
     — rien des deux : **on ne propose rien du tout**. Une invitation qui ne
       mène nulle part est pire qu'une absence d'invitation, et c'est le cas
       qu'on ne voit jamais en essayant sur son propre téléphone.

   **L'invitation a quitté l'accueil pour le tiroir** (lot 0, chantier 10).
   Elle vivait dans le pied du hub (`#installe`), l'endroit le plus serré du
   jeu, où une ligne qui paraît certains jours et pas d'autres faisait monter
   et descendre le bouton d'entrée. Elle est maintenant l'entrée
   `#tbf-installer` du tiroir de `menu.js`, présent sur tous les écrans, avec
   sa consigne `#tbf-installer-ios` pour l'iPhone.

   Les contrôles la suivent là où elle est, et gardent ce qu'ils protégeaient :
   les trois cas. Relire `#installe`, qui n'existe plus, les aurait laissés
   passer sans rien vérifier — ou rougir sur un défaut qui n'en est pas un.
   Et l'accueil est tenu de **ne pas la reprendre** : c'est la moitié du
   déménagement qui se perd le plus facilement. */

{
  const page = await ouvrir();
  await new Promise((r) => setTimeout(r, 400));

  /* Ce que le hub montre d'une invitation à installer, tiroir fermé.
     `innerText` ne rend que le texte dessiné : le tiroir replié (`hidden`) et
     les commentaires n'y sont pas, une ligne réellement affichée y est. */
  const auHub = () => page.evaluate(() => {
    const t = document.body.innerText.replace(/\s+/g, ' ');
    const m = t.match(/[^.]{0,20}(Installer l|écran d’accueil)[^.]{0,20}/i);
    return m ? m[0].trim() : null;
  });
  /* L'entrée du tiroir, telle que le code la laisse : née cachée, elle ne
     paraît que si elle a quelque chose à faire. Absente, elle rend
     `undefined`, et les contrôles qui l'attendent rougissent. */
  const entree = () => page.evaluate(() => {
    const b = document.getElementById('tbf-installer');
    return b ? { cachee: b.hidden, facon: b.dataset.facon ?? '' } : undefined;
  });

  check('sans rien à proposer, on ne propose rien',
    await auHub() === null && (await entree())?.cachee === true
    || (console.log('        l’accueil dit :', await auHub(),
      '· le tiroir :', JSON.stringify(await entree())), false));

  /* La proposition du navigateur. On la simule telle qu'elle arrive : un
     événement annulable, que `pwa.js` retient et annonce par « tbf-pwa ». */
  await page.evaluate(() => window.dispatchEvent(
    new Event('beforeinstallprompt', { cancelable: true })));
  await new Promise((r) => setTimeout(r, 150));

  /* Le hub ne bouge pas d'une ligne : c'est la raison du déménagement. */
  check('et l’accueil ne la reprend pas quand elle arrive', await auHub() === null
    || (console.log('        l’accueil dit :', await auHub()), false));

  /* On ouvre le tiroir comme un joueur, et on lit ce qu'il voit : un bouton
     dessiné, qui propose d'installer. */
  await page.click('#burger');
  await new Promise((r) => setTimeout(r, 300));
  const vu = await page.evaluate(() => {
    const b = document.getElementById('tbf-installer');
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return {
      texte: r.width > 0 && r.height > 0 ? b.textContent.trim() : null,
      facon: b.dataset.facon ?? '',
    };
  });
  check('quand le navigateur sait installer, le bouton paraît dans le tiroir',
    /Installer/.test(vu?.texte ?? '') && vu.facon === 'proposer'
    || (console.log('        il dit :', JSON.stringify(vu)), false));
  await page.close();
}

{
  /* Un iPhone. `pwa.js` le reconnaît à la signature du navigateur, et
     l'entrée du tiroir explique le geste au lieu d'offrir un bouton qui ne
     ferait rien. */
  const page = await ouvrir();
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) '
    + 'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1');
  await page.reload({ waitUntil: 'networkidle0' });
  /* L'écran d'ouverture ne revient qu'une fois par session, mais tant qu'il
     est là il prend le clic du bouton de menu : voir `ouvrir()`. */
  await page.waitForFunction(() => !document.getElementById('ouverture'),
    { timeout: OUVERTURE_MS }).catch(() => {});
  await new Promise((r) => setTimeout(r, 400));

  /* Le geste du joueur : ouvrir le tiroir, toucher l'entrée. Sur iPhone elle
     ne lance rien — Safari n'a rien à lancer —, elle déplie la consigne. */
  await page.click('#burger');
  await new Promise((r) => setTimeout(r, 300));
  const avant = await page.evaluate(() => {
    const b = document.getElementById('tbf-installer');
    return b ? { cachee: b.hidden, facon: b.dataset.facon ?? '' } : null;
  });
  if (avant && !avant.cachee) await page.click('#tbf-installer');
  await new Promise((r) => setTimeout(r, 150));
  const apres = await page.evaluate(() => {
    const b = document.getElementById('tbf-installer');
    const c = document.getElementById('tbf-installer-ios');
    const r = c?.getBoundingClientRect();
    return {
      texte: c && !c.hidden && r.height > 0 ? c.textContent.replace(/\s+/g, ' ').trim() : null,
      deplie: b?.getAttribute('aria-expanded') ?? null,
      relie: b?.getAttribute('aria-controls') ?? null,
    };
  });
  check('sur iPhone, on explique le geste', /écran d’accueil/.test(apres.texte ?? '')
    || (console.log('        il dit :', apres.texte, '· l’entrée :', JSON.stringify(avant)), false));
  /* Ce que protégeait « pas de bouton qui ne ferait rien » : l'ancien
     `#poser` appelait `TBF_PWA.installer()`, qui ne fait rien sur Safari.
     L'entrée du tiroir est un bouton, donc on vérifie qu'elle ne propose
     **pas** d'installer (`proposer`) mais d'expliquer, et que la toucher
     fait quelque chose de visible — la consigne se déplie, et un lecteur
     d'écran l'entend (`aria-expanded`, `aria-controls`). */
  check('et on ne montre pas de bouton qui ne ferait rien',
    avant?.facon === 'expliquer' && apres.deplie === 'true'
    && apres.relie === 'tbf-installer-ios'
    || (console.log('        l’entrée :', JSON.stringify(avant), JSON.stringify(apres)), false));
  await page.close();
}

/* ------------------------------------------------ faire défiler ses âges

 * Le joueur qui a fait grandir son Fanzzy possède **plusieurs dessins du même
 * personnage**, et l'accueil n'en montrait qu'un : le dernier. Celui qui a payé
 * le troisième âge ne pouvait plus revoir celui avec lequel il a commencé —
 * l'âge 1 n'est pas une version inférieure, c'est un autre dessin.
 *
 * Deux gestes, et la séparation est tout l'objet du contrôle : les flèches
 * **regardent**, le bouton **décide**. Enregistrer à chaque flèche ferait de la
 * curiosité un choix, et on ne pourrait plus regarder sans engager ce que les
 * amis voient de soi.
 *
 * `TR32` est le personnage de la suite et ses trois âges sont dessinés : c'est
 * le seul endroit du catalogue où l'on peut éprouver un défilé qui montre
 * vraiment trois images différentes.
 */
{
  await equiper('TR32', 3);
  await pool.query('UPDATE user_wallet SET active_evo = NULL WHERE user_id = ?', [U]);
  const page = await ouvrir();
  await page.waitForSelector('#pile .pose.on[src]', { timeout: 8000 }).catch(() => {});

  /** Ce que la rangée d'âges montre, et ce que le personnage à l'écran vaut. */
  const lire = () => page.evaluate(() => {
    const b = (id) => document.getElementById(id);
    const vis = (e) => Boolean(e) && !e.hidden && e.getBoundingClientRect().width > 0;
    /* **La coche est une icône, plus un caractère** (lot 0, chantier 6). Le
       « ✓ » accolé à « ÉVOLUTION n / m » se dessinait différemment d'un
       téléphone à l'autre et jurait avec les icônes au trait du jeu ; c'est
       maintenant `<i class="tbf-ico tbf-ico-coche">`, un masque sans texte.
       Chercher « ✓ » dans `textContent` ne la trouve donc plus — et « la
       coche a quitté la plaque » passait sans rien vérifier. On lit l'icône
       elle-même : présente, dessinée (un masque sans règle ne mesure rien),
       et nommée, puisque sans texte c'est son `aria-label` qui dit à un
       lecteur d'écran ce que la coche veut dire (contrat C1). */
    const coche = b('quiEvo')?.querySelector('.tbf-ico-coche') ?? null;
    return {
      src: document.querySelector('#pile .pose.on')?.getAttribute('src') ?? '',
      plaque: b('quiEvo')?.textContent.trim() ?? '',
      coche: Boolean(coche),
      cocheVue: Boolean(coche) && coche.getBoundingClientRect().width > 0,
      cocheDit: coche?.getAttribute('aria-label')?.trim() ?? '',
      avant: vis(b('ageAvant')), apres: vis(b('ageApres')),
      avantMort: b('ageAvant')?.disabled ?? null,
      apresMort: b('ageApres')?.disabled ?? null,
      valider: vis(b('ageValider')),
    };
  });

  /* Par défaut, l'âge atteint : c'est ce que le joueur a payé, et le
     comportement d'avant. Rien ne change pour qui n'a jamais rien choisi. */
  let v = await lire();
  check('sans rien avoir choisi, on voit l’âge atteint',
    /TR32C/.test(v.src) || (console.log('        elle montre :', v.src), false));
  check('les flèches paraissent quand il y a plusieurs âges', v.avant && v.apres);
  /* Au bout de la lignée, estompée et inerte — pas retirée : une flèche qui
     disparaît déplace la plaque sous le doigt entre deux appuis. */
  check('et celle du dernier âge est inerte, pas absente', v.apresMort === true && v.apres);
  check('rien à valider tant qu’on regarde ce qu’on montre déjà', v.valider === false);
  /* L'icône, et non plus « ✓ » : voir `lire()`. */
  check('et la plaque porte la coche de ce qu’on montre',
    v.coche && v.cocheVue && v.cocheDit !== ''
    || (console.log('        elle dit :', v.plaque, '· coche :', v.coche,
      '· dessinée :', v.cocheVue, '· nommée :', JSON.stringify(v.cocheDit)), false));
  /* Et l'émoji ne revient pas à côté d'elle : deux coches, dont une qui
     change d'allure selon le téléphone, c'est le défaut que le chantier 6
     a retiré. */
  check('et c’est l’icône du jeu, pas un émoji', !/[✓✔✅]/.test(v.plaque)
    || (console.log('        elle dit :', v.plaque), false));

  /* On remonte la lignée jusqu'au premier âge. Trois dessins distincts : c'est
     le contrôle qui prouve que le défilé montre autre chose et pas la même
     image trois fois. */
  await page.click('#ageAvant');
  await new Promise((r) => setTimeout(r, 350));
  const deux = (await lire()).src;
  await page.click('#ageAvant');
  await new Promise((r) => setTimeout(r, 350));
  v = await lire();
  check('la flèche remonte d’un âge', /TR32B/.test(deux)
    || (console.log('        elle montre :', deux), false));
  check('et jusqu’au premier, que l’évolution avait rendu invisible',
    /TR32\./.test(v.src) || (console.log('        elle montre :', v.src), false));
  check('arrivé au premier, sa flèche est inerte', v.avantMort === true);
  check('et la plaque suit', /1 \/ 3/.test(v.plaque)
    || (console.log('        elle dit :', v.plaque), false));

  /* **Rien n'a été écrit.** C'est la moitié qui compte : le défilé regarde. */
  const avantChoix = (await pool.query(
    'SELECT active_evo e FROM user_wallet WHERE user_id = ?', [U]))[0][0].e;
  check('faire défiler n’écrit rien', avantChoix === null
    || (console.log('        la base dit :', avantChoix), false));

  /* Le bouton n'est là **que** maintenant : ce qu'on regarde n'est plus ce
     qu'on montre. */
  check('et c’est là que le bouton se propose', v.valider === true);
  /* L'icône a quitté la plaque, et pas seulement un caractère qui n'y est
     plus depuis le chantier 6 : chercher « ✓ » passait ici quoi qu'il arrive. */
  check('la coche a quitté la plaque', v.coche === false
    || (console.log('        elle dit :', v.plaque, '· coche encore là'), false));

  await page.click('#ageValider');
  await page.waitForFunction(
    () => document.getElementById('ageValider')?.hidden === true,
    { timeout: 5000 }).catch(() => {});
  const apresChoix = (await pool.query(
    'SELECT active_evo e FROM user_wallet WHERE user_id = ?', [U]))[0][0].e;
  check('valider écrit l’âge choisi', Number(apresChoix) === 1
    || (console.log('        la base dit :', apresChoix), false));
  v = await lire();
  check('le bouton s’efface, il n’y a plus rien à décider', v.valider === false);
  /* L'icône, dessinée et nommée, comme au premier contrôle : voir `lire()`. */
  check('et la coche revient sur la plaque', v.coche && v.cocheVue && v.cocheDit !== ''
    || (console.log('        elle dit :', v.plaque, '· coche :', v.coche,
      '· dessinée :', v.cocheVue, '· nommée :', JSON.stringify(v.cocheDit)), false));

  /* ------------------------------ et au retour, dans le **même** navigateur

     Le défaut ne se voit que là, et il a failli passer : `ouvrir()` fabrique
     un contexte neuf à chaque appel — c'est ce qu'il faut pour isoler les
     contrôles, et c'est exactement ce qui le masquait. Sans `localStorage`,
     la page repart du serveur et tombe juste ; avec, elle repeint d'abord ce
     qu'elle a retenu.

     Or elle ne retenait que **la lignée** (`TR32`), pas la carte de l'âge
     (`TR32C`) : elle reposait donc le premier âge à chaque retour. Et la
     réponse du serveur ne le corrigeait pas — même personnage, même âge, même
     tenue, donc « rien à redessiner ».

     On refait donc le geste du joueur : on va voir une autre page, et on
     revient. */
  await page.goto(base + '/fanzzy', { waitUntil: 'domcontentloaded' });
  await page.goto(base + '/', { waitUntil: 'networkidle0' });
  await page.waitForSelector('#pile .pose.on[src]', { timeout: 8000 }).catch(() => {});
  /* Le temps que la réponse du serveur passe : c'est justement le moment où le
     souvenir est seul à l'écran, et où l'on veut qu'il ait eu raison. */
  await new Promise((r) => setTimeout(r, 600));
  let src = await page.evaluate(() =>
    document.querySelector('#pile .pose.on')?.getAttribute('src') ?? '');
  check('en revenant d’une autre page, c’est toujours l’âge choisi',
    /TR32\./.test(src) && !/TR32[BC]/.test(src)
    || (console.log('        elle montre :', src), false));

  /* L'autre sens, qui est le cas du joueur : il a choisi un âge **supérieur**,
     et le souvenir reposait la lignée, c'est-à-dire le premier âge. C'est ce
     qu'il a décrit — « il reprend toujours l'évolution 1 ». */
  await page.click('#ageApres');
  await new Promise((r) => setTimeout(r, 300));
  await page.click('#ageApres');
  await new Promise((r) => setTimeout(r, 300));
  await page.click('#ageValider');
  await page.waitForFunction(
    () => document.getElementById('ageValider')?.hidden === true,
    { timeout: 5000 }).catch(() => {});
  await page.goto(base + '/fanzzy', { waitUntil: 'domcontentloaded' });
  await page.goto(base + '/', { waitUntil: 'networkidle0' });
  await page.waitForSelector('#pile .pose.on[src]', { timeout: 8000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 600));
  src = await page.evaluate(() =>
    document.querySelector('#pile .pose.on')?.getAttribute('src') ?? '');
  check('et un âge supérieur choisi ne retombe pas sur le premier',
    /TR32C/.test(src) || (console.log('        elle montre :', src), false));
  await page.close();
}

{
  /* Un Fanzzy qu'on n'a pas fait grandir : pas de flèches. Deux flèches mortes
     autour d'un « 1 / 3 » demandent de comprendre pourquoi elles ne font
     rien — et la réponse, « il faut payer », se dit au classeur, avec le prix,
     pas sur l'écran d'accueil. */
  await equiper('TR32', 1);
  await pool.query('UPDATE user_wallet SET active_evo = NULL WHERE user_id = ?', [U]);
  const page = await ouvrir();
  await page.waitForSelector('#pile .pose.on[src]', { timeout: 8000 }).catch(() => {});
  const v = await page.evaluate(() => {
    const vis = (id) => { const e = document.getElementById(id);
      return Boolean(e) && !e.hidden && e.getBoundingClientRect().width > 0; };
    return { avant: vis('ageAvant'), apres: vis('ageApres'), valider: vis('ageValider'),
      plaque: document.getElementById('quiEvo')?.textContent.trim() ?? '' };
  });
  check('sans âge supérieur atteint, pas de flèches',
    v.avant === false && v.apres === false);
  check('ni de bouton à valider', v.valider === false);
  /* La plaque reste : elle dit ce qu'il est et ce qu'il peut devenir. C'est
     elle qui donne envie d'aller voir le prix. */
  check('mais la plaque dit toujours où il en est', /^ÉVOLUTION 1 \/ 3$/.test(v.plaque)
    || (console.log('        elle dit :', v.plaque), false));
  await page.close();
}

/* --------------------------- le défilé sur un personnage **à états dessinés**

 * `TR1` et `TR2` sont les deux seuls personnages du catalogue dont les états
 * sont dessinés, et ils passent par un **tout autre chemin** que les deux cents
 * autres : `source()` interroge `TBF_ETATS.resoudre` d'abord, et ne retombe sur
 * le plein-pied que s'il ne rend rien. Les contrôles précédents éprouvent
 * `TR32`, qui n'a pas d'états : ils ne disent donc **rien** de ce chemin-là.
 *
 * Deux choses s'y jouent qui ne se jouent nulle part ailleurs :
 *
 *   — le manifeste n'a que `neutre` aux âges 2 et 3. `resoudre` doit rester à
 *     l'âge demandé en retombant sur `neutre`, et non descendre d'un âge en
 *     gardant l'état — descendre rajeunirait le personnage à chaque pose ;
 *   — au premier dessin, `TBF_ETATS` n'est **pas encore chargé** : `resoudre`
 *     rend nul et c'est le plein-pied du souvenir qui est peint. C'est
 *     exactement l'instant où le défaut de l'âge se logeait.
 */
{
  await equiper('TR1', 3);
  await pool.query('UPDATE user_wallet SET active_evo = 2 WHERE user_id = ?', [U]);
  const page = await ouvrir();
  await page.waitForSelector('#pile .pose.on[src]', { timeout: 8000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 600));

  const age = () => page.evaluate(() => {
    const src = document.querySelector('#pile .pose.on')?.getAttribute('src') ?? '';
    /* L'âge se lit dans les deux écritures : `/TR1/e2/base/neutre.webp` pour
       un état dessiné, `/TR1B.webp` pour le plein-pied de la carte. Les deux
       sont des réponses valables — ce qui compte est qu'elles disent **deux**,
       pas **un**. */
    const etat = /\/TR1\/e(\d)\//.exec(src);
    const carte = /\/TR1(B|C)?\.(webp|avif|png)/.exec(src);
    return { src, evo: etat ? Number(etat[1])
      : (carte ? ({ undefined: 1, B: 2, C: 3 })[carte[1]] : null) };
  });

  let v = await age();
  check('un personnage à états dessinés s’affiche à l’âge choisi', v.evo === 2
    || (console.log('        elle montre :', v.src), false));

  /* Le geste du joueur, mot pour mot : « je change de page et je reviens ». */
  await page.goto(base + '/fanzzy', { waitUntil: 'domcontentloaded' });
  await page.goto(base + '/', { waitUntil: 'networkidle0' });
  await page.waitForSelector('#pile .pose.on[src]', { timeout: 8000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 600));
  v = await age();
  check('et il y reste en revenant d’une autre page', v.evo === 2
    || (console.log('        elle montre :', v.src), false));

  /* Le salut se joue à l'arrivée. Le manifeste n'a pas de `salut` aux âges 2
     et 3 : `resoudre` doit retomber sur le `neutre` **du même âge**, et non
     sur le `salut` de l'âge 1. Descendre d'un âge ferait rajeunir le
     personnage au moment précis où il fait coucou. */
  const apresSalut = await page.evaluate(async () => {
    const tous = [];
    for (const e of ['salut', 'pousse', 'but']) {
      const r = window.TBF_ETATS.resoudre('TR1', { evo: 2, skin: 'base', etat: e });
      tous.push(r ? r.evo : null);
    }
    return tous;
  });
  check('un état non dessiné retombe sur le neutre du même âge, pas sur l’âge d’avant',
    apresSalut.every((e) => e === 2)
    || (console.log('        âges rendus :', JSON.stringify(apresSalut)), false));
  await page.close();
}

/* ============================ l'échantillon représentatif, et pas le beau

 * Tout ce qui précède éprouve des personnages complets. Ici on prend celui que
 * le catalogue a vraiment : sa carte du premier âge, et rien au-dessus.
 *
 * Ce que ça attrape : l'accueil laisse choisir un âge, et pour cette lignée-là
 * le dessin de l'âge 2 n'existe pas. `FZART.adresse` redescend alors à l'âge
 * illustré le plus proche — c'est le bon repli, un dessin un peu plus jeune
 * vaut mieux qu'un cadre vide — mais la plaque annonçait « ÉVOLUTION 2 / 3 »
 * par-dessus le dessin de l'âge 1. Le joueur voyait le même personnage sous
 * deux numéros, et en concluait que son choix n'avait pas été pris.
 */
{
  const R = ORDINAIRE[0].id;
  await equiper(R, 2);
  await pool.query('UPDATE user_wallet SET active_evo = NULL WHERE user_id = ?', [U]);
  const page = await ouvrir();
  await page.waitForSelector('#pile .pose.on[src]', { timeout: 8000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 600));

  const v = await page.evaluate(() => ({
    src: document.querySelector('#pile .pose.on')?.getAttribute('src') ?? '',
    plaque: document.getElementById('quiEvo')?.textContent.trim() ?? '',
    dansLEcran: (() => {
      const q = document.getElementById('qui')?.getBoundingClientRect();
      return q ? q.bottom <= innerHeight + 1 && q.left >= -1 : false;
    })(),
  }));

  /* Le repli a bien lieu, et c'est voulu : on montre le dessin qu'on a. */
  check('un âge non dessiné retombe sur le dessin qu’on a',
    new RegExp(`/${R}\\.`).test(v.src)
    || (console.log('        il montre :', v.src), false));
  /* Mais la plaque ne prétend pas montrer autre chose. */
  check('et la plaque ne promet pas un dessin qui n’existe pas',
    /dessin à venir/i.test(v.plaque)
    || (console.log('        elle dit :', v.plaque), false));
  check('elle dit quand même où en est le personnage',
    /ÉVOLUTION 2 \/ \d/.test(v.plaque)
    || (console.log('        elle dit :', v.plaque), false));
  /* La mention rallonge la plaque : elle doit rester dans l'écran. */
  check('et la plaque rallongée tient toujours dans l’écran', v.dansLEcran);

  /* En redescendant au premier âge, la mention disparaît : ce dessin-là existe.
     C'est le contrôle qui prouve que la mention dit quelque chose plutôt que
     d'être affichée tout le temps. */
  await page.click('#ageAvant');
  await new Promise((r) => setTimeout(r, 400));
  const bas = await page.evaluate(() =>
    document.getElementById('quiEvo')?.textContent.trim() ?? '');
  check('au premier âge, la mention s’efface', !/dessin à venir/i.test(bas)
    || (console.log('        elle dit :', bas), false));
  await page.close();
  await equiper(R, 1);
}

await nav.close();
http.close();
await pool.end();

console.log(`\n${failures ? `${failures} échec(s)` : 'tout est vert'}`);
process.exitCode = failures ? 1 : 0;
