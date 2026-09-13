/**
 * Le tour des écrans : les vingt pages, une par une.
 *
 * ## Pourquoi cette suite existe
 *
 * Onze pages avaient une suite d'interface. **Neuf n'en avaient aucune** — dont
 * la boutique et l'inscription, c'est-à-dire l'écran où l'on prend l'argent et
 * celui qui accueille les nouveaux. Elles compilaient, leurs adresses
 * existaient, et personne ne vérifiait qu'elles affichaient quoi que ce soit.
 *
 * Écrire neuf suites complètes n'aurait pas été tenable. Celle-ci fait l'autre
 * chose, celle qui manquait vraiment : elle **ouvre chaque page** et vérifie ce
 * qui doit être vrai partout, quelle que soit la page.
 *
 * ## Ce qu'elle contrôle, et pourquoi ces cinq-là
 *
 * 1. **Aucune erreur de script.** Une exception non rattrapée arrête le rendu
 *    au milieu : la page reste à moitié construite, sans rien qui le signale.
 * 2. **La page affiche quelque chose.** Une coquille vide s'affiche
 *    exactement comme une page qui charge encore.
 * 3. **Aucun `undefined`, `NaN` ou `[object Object]` sous les yeux du joueur.**
 *    C'est la trace visible d'une donnée manquante, et elle passe les suites
 *    qui ne regardent que des sélecteurs.
 * 4. **Rien ne déborde à 360 px.** Le jeu se joue au téléphone. Un tableau
 *    trop large ne casse rien — il rend la page inutilisable, en silence.
 * 5. **Les liens internes mènent quelque part.** Un `href` vers une route qui
 *    n'existe pas est une impasse qu'on ne découvre qu'en cliquant.
 *
 * ## Ce qu'elle ne contrôle pas
 *
 * Que chaque écran fasse son travail. C'est le rôle des suites dédiées, et
 * celle-ci ne les remplace pas : elle garantit le plancher.
 *
 * Avant de lancer :  npm install --no-save puppeteer
 */
import { createServer } from 'node:http';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import express from 'express';
import puppeteer from 'puppeteer';
import { createFanzzy } from '../src/server/fanzzy/index.js';
import { createNiveau } from '../src/server/niveau/index.js';
import { createOnboarding } from '../src/server/onboarding/index.js';
import { createDecks } from '../src/server/deck/index.js';
import { createKop } from '../src/server/kop/index.js';
import { createAmis } from '../src/server/amis/index.js';
import { createClassements } from '../src/server/classements/index.js';
import { createSouvenirs } from '../src/server/souvenirs/index.js';
import { createBoutique } from '../src/server/boutique/index.js';
import { createAdmin } from '../src/server/admin/index.js';
import { charger as chargerCatalogue } from '../src/server/fanzzy/catalogue.js';
import { chargerTenues } from '../src/server/fanzzy/tenues.js';
import { chargerReglages, reglagesPublics } from '../src/server/reglages/index.js';
import { entetesDeSecurite } from '../src/server/garde/index.js';
import { baseDeTest, OPTIONS_BASE } from './base-de-test.mjs';

const DB = baseDeTest();
const RACINE = fileURLToPath(new URL('..', import.meta.url));

let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };

/* ------------------------------------------------------------- la base */

const mysql = await import('mysql2/promise');
const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
await raw.query('SET FOREIGN_KEY_CHECKS = 0');
await raw.query(`DROP TABLE IF EXISTS achats, admin_journal, reglages, competitions,
  kop_membres, kops, amis, user_stuff, user_skins, user_fanzzy, user_souvenirs,
  user_decks, virage_presence, user_niveau, tenues, fanzzy, user_wallet,
  team_leagues, teams, leagues, sessions, users`);
await raw.query('SET FOREIGN_KEY_CHECKS = 1');

for (const f of ['auth.sql', 'football.sql', 'minutes.sql', 'couleurs.sql', 'duel.sql',
  'souvenirs.sql', 'billets.sql', 'fanzzy.sql', 'teletext.sql', 'inventaire.sql',
  'skins.sql', 'tenues.sql', 'deck.sql', 'admin.sql', 'kop.sql', 'amis.sql',
  'niveau.sql', 'raretes.sql', 'stades.sql', 'boutique.sql']) {
  await raw.query(await readFile(`sql/${f}`, 'utf8'));
}

await raw.query(
  `INSERT INTO users (email, pseudo, password_hash, status, role, public_id, email_verified_at)
   VALUES ('tour@test.local','Tour','x','active','admin', UUID(), NOW())`);
const [[u]] = await raw.query('SELECT public_id FROM users LIMIT 1');
const U = u.public_id;
/* `onboarded_at` : sans lui, la moitié des écrans renvoient vers
   l'inscription — c'est leur travail, et le tour mesurerait alors la page
   d'accueil vingt fois de suite au lieu des vingt écrans. */
await raw.query(
  `INSERT INTO user_wallet (user_id, scarves, billets, packs, onboarded_at)
   VALUES (?, 900, 600, 4, NOW(3))`, [U]);
await raw.end();

const pool = mysql.createPool({ uri: DB, connectionLimit: 8, ...OPTIONS_BASE });

/* Les catalogues vivent en base et se lisent en mémoire : chargés avant les
   modules qui s'en servent, sinon ceux-ci travaillent sur du vide. */
await chargerReglages(pool);
await chargerCatalogue(pool);
await chargerTenues(pool);

/* Le joueur possède quelques Fanzzy : une collection vide ferait passer pour
   « page blanche » des écrans qui n'ont simplement rien à montrer. */
const [cartes] = await pool.query('SELECT id FROM fanzzy WHERE publie = 1 LIMIT 4');
for (const c of cartes) {
  await pool.query(
    `INSERT IGNORE INTO user_fanzzy (user_id, fanzzy_id, stage, copies) VALUES (?,?,1,1)`,
    [U, c.id]);
}

/* ---------------------------------------------------------- le serveur */

const requireAuth = (r, _s, n) => { r.user = { id: U }; n(); };
const app = express();

/* Les vingt écrans passent sous **les en-têtes réels**. Une politique de
   contenu ne casse pas bruyamment : le navigateur refuse la ressource, écrit
   une ligne dans une console que personne ne lit, et la page s'affiche sans sa
   police ou sans son script. Sans ce montage, la politique n'était éprouvée
   sur aucune vraie page — et une politique trop stricte est une panne, pas une
   protection.

   Le débit maximal n'est **pas** monté ici : le tour ouvre vingt pages en
   rafale depuis une seule adresse, ce qu'aucun joueur ne fait. Il a sa propre
   suite, `garde:smoke`, où les nombres sont éprouvés pour eux-mêmes. */
app.use(entetesDeSecurite({ https: false }));
app.use(express.json());

const niveau = createNiveau({ pool, requireAuth });
const fanzzy = createFanzzy({ pool, requireAuth, niveau });
const kop = createKop({ pool, requireAuth });
const decks = createDecks({ pool, requireAuth, niveau });

app.use('/api/niveau', niveau.router);
app.use('/api/fanzzy', fanzzy.router);
app.use('/api/me', createOnboarding({ pool, requireAuth, niveau }).router);
app.use('/api/deck', decks.router);
app.use('/api/kop', kop.router);
app.use('/api/amis', createAmis({ pool, requireAuth, kop }).router);
app.use('/api/rank', createClassements({ pool, requireAuth }).router);
app.use('/api/souvenirs', createSouvenirs({ pool, requireAuth }).router);
app.use('/api/boutique', createBoutique({ pool, requireAuth, fanzzy }).router);
app.use('/api/admin', createAdmin({ pool, requireAuth, deps: {} }).router);
app.get('/api/public/reglages', (_q, s) => s.json(reglagesPublics()));

/* La barre commune se construit sur `/api/auth/me` : sans identité, elle ne
   se monte pas du tout, et **les vingt écrans** perdaient leur barre. Ce n'était
   pas une faute des pages, c'était le banc qui ne servait pas l'identité. */
app.get('/api/auth/me', (_q, s) => s.json({
  user: { id: U, pseudo: 'Tour', email: 'tour@test.local', locale: 'fr',
    verified: true, mainTeamId: null, createdAt: new Date().toISOString() },
}));

/* Le direct passe par socket.io, que ce banc ne monte pas. Sans ce fichier, le
   navigateur refuse d'exécuter une page HTML servie à la place d'un script, et
   trois écrans rougissaient pour une raison qui ne les concerne pas. On sert un
   `io` qui ne se connecte à rien : les pages se rendent, et le direct reste
   éprouvé par les suites qui le montent pour de vrai. */
app.get('/socket.io/socket.io.js', (_q, s) => {
  s.type('application/javascript').send(
    'window.io = function () { return { on(){}, off(){}, emit(){}, disconnect(){},'
    + ' connected: false }; };');
});

/* Ce que le tour ne monte pas — le football, le télétexte, le direct — répond
   une forme **vide mais plausible** plutôt qu'un objet nu. Une page qui reçoit
   `{}` là où elle attend une liste tombe sur `.slice` de `undefined`, et
   c'est le banc qui l'a cassée, pas elle. */
app.use('/api', (_q, s) => s.json({
  items: [], liste: [], matchs: [], countries: [], leagues: [], equipes: [],
  fixtures: [], pays: [], rows: [], data: [], ok: true,
}));

app.use(express.static(path.join(RACINE, 'public')));

/* Les pages, avec leur adresse réelle. */
const ECRANS = [
  ['/', 'accueil'],
  ['/fanzzy', 'Fanzzy'],
  ['/boosters', 'boosters'],
  ['/deck', 'deck'],
  ['/boutique', 'boutique'],
  ['/virage', 'Virage'],
  ['/duel-nvn', 'duel'],
  ['/kop', 'KOP'],
  ['/amis', 'amis'],
  ['/equipes', 'clubs'],
  ['/matchs', 'matchs'],
  ['/classement', 'classement'],
  ['/carnet', 'carnet'],
  ['/profil', 'profil'],
  ['/compte', 'compte'],
  ['/teletext', 'télétexte'],
  ['/bienvenue', 'inscription'],
  ['/diagnostic', 'diagnostic'],
  ['/admin', 'administration'],
];
for (const [route, nom] of ECRANS) {
  const fichier = route === '/' ? 'index.html'
    : route === '/matchs' ? 'aujourdhui.html'
      : route.slice(1) + '.html';
  app.get(route, (_q, s) => s.sendFile(path.join(RACINE, 'public', fichier)));
  void nom;
}
app.get('/fanzzy/:id', (_q, s) =>
  s.sendFile(path.join(RACINE, 'public', 'fanzzy-fiche.html')));

const http = createServer(app);
await new Promise((r) => http.listen(0, r));
const base = `http://127.0.0.1:${http.address().port}`;

/* ------------------------------------------------------- le navigateur */

const nav = await puppeteer.launch({ args: ['--no-sandbox'] });

/** Les mots qui ne doivent jamais atteindre l'œil d'un joueur. */
const FUITES = [
  ['undefined', /(^|[\s>«(])undefined([\s<»).,!?]|$)/],
  ['NaN', /(^|[\s>«(])NaN([\s<»).,!?%]|$)/],
  ['[object Object]', /\[object Object\]/],
  ['un code d’erreur', /\b[a-z]+\.error\.[a-z_]+\b/],
];

/* Les pages qui n'ont délibérément pas la barre commune : l'inscription et le
   compte se jouent avant d'avoir une place, l'administration n'est pas le jeu. */
/* Les écrans qui n'ont pas la barre commune, **par décision** et non par
   oubli — la liste est celle de `nav.js`, plus les deux écrans qui ne sont pas
   le jeu. L'accueil en fait partie : ses deux rails portent la navigation, et
   une barre de plus y ferait double emploi. */
const SANS_BARRE = new Set(['/', '/bienvenue', '/compte', '/admin', '/diagnostic']);

const tousLesEcrans = [...ECRANS, ['/fanzzy/' + (cartes[0]?.id ?? 'x'), 'fiche']];

console.log(`\nLe tour : ${tousLesEcrans.length} écrans.\n`);

for (const [route, nom] of tousLesEcrans) {
  const page = await nav.newPage();
  await page.setViewport({ width: 360, height: 780 });

  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(String(e.message)));
  /* Une violation de la politique de contenu est une panne, même si la page
     paraît aller bien : elle signifie qu'une ressource a été refusée. */
  page.on('console', (m) => {
    const t = m.text();
    if (/Content Security Policy|Refused to (load|execute|apply)/i.test(t)) {
      erreurs.push('CSP — ' + t.slice(0, 140));
    }
  });
  /* On ne retient que les exceptions et les erreurs écrites par la page.
     Les échecs de réseau sont écartés : le tour ne monte pas le football ni le
     direct, et ce n'est pas ce qu'il éprouve. */
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/Failed to load resource|net::ERR|404|favicon/i.test(t)) return;
    erreurs.push(t);
  });

  await page.goto(base + route, { waitUntil: 'networkidle0' }).catch(() => {});
  // Le temps que les rendus différés se posent : plusieurs écrans dessinent
  // après leur premier `fetch`.
  await new Promise((r) => setTimeout(r, 450));

  const vu = await page.evaluate(() => {
    const app = document.getElementById('app') ?? document.body;
    return {
      texte: (app.innerText ?? '').trim(),
      // La largeur réellement occupée, contre celle de l'écran.
      large: document.documentElement.scrollWidth,
      ecran: document.documentElement.clientWidth,
      barre: Boolean(document.querySelector('.tbf-haut')),
      liens: [...document.querySelectorAll('a[href^="/"]')]
        .map((a) => a.getAttribute('href').split('?')[0].split('#')[0])
        .filter((h) => h && !h.startsWith('//')),
      titres: document.querySelectorAll('h1,h2,.titre,.title').length,

      /* Le texte coupé en plein mot. On ne regarde que les éléments qui
         portent du texte et rien d'autre — un conteneur dont le contenu
         déborde légitimement (une liste qui défile) n'est pas concerné.

         `scrollWidth > clientWidth` dit que le contenu ne tient pas ; on
         écarte ce qui défile pour de bon (`overflow` explicite) et ce qui
         annonce sa coupure par des points de suspension. */
      /* Ce qui se touche doit être **visible**. Un bouton rogné aux
         quatre cinquièmes est un bouton qu'on ne trouve pas, et aucune mesure
         de débordement ne le voit : un parent qui rogne absorbe le dépassement
         au lieu de le rendre. C'est ainsi que le rail droit de l'accueil est
         sorti de l'écran sans faire rougir un seul contrôle.

         On compare ce que l'élément occupe à ce qu'il en reste dans le cadre
         de l'écran. Les éléments cachés, hors flux ou de taille nulle sont
         écartés : un menu fermé n'est pas un bouton perdu. */
      invisibles: [...document.querySelectorAll('a[href],button')]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          if (r.width < 8 || r.height < 8) return false;
          if (getComputedStyle(el).visibility === 'hidden') return false;
          if (el.closest('[hidden],[aria-hidden="true"]')) return false;
          /* Deux rognages, et un seul est un défaut. Ce qui est **coupé**
             (`hidden`, `clip`) est hors d'atteinte : le joueur ne le trouvera
             jamais. Ce qui **défile** (`auto`, `scroll`) est simplement plus
             loin — un bandeau de jours, une rangée d'âges — et c'est un choix
             de mise en page, pas une perte. */
          for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
            const o = getComputedStyle(p).overflowX;
            if (o === 'auto' || o === 'scroll') return false;
          }
          const bord = document.documentElement.clientWidth;
          const vu = Math.min(r.right, bord) - Math.max(r.left, 0);
          return vu < r.width * 0.9;
        })
        .slice(0, 5)
        .map((el) => ((el.textContent ?? '').trim() || el.getAttribute('aria-label')
          || el.className || el.tagName).slice(0, 22)),

      /* Les étiquettes de navigation se lisent **en entier**. Des points de
         suspension conviennent à une phrase ; sur un libellé qui dit où l'on
         va, ils font deviner. On lisait « CLASSEME… » et « BOUTIQ… » sur le
         rail de l'accueil. */
      libelles: [...document.querySelectorAll('.lib,.tbf-tiroir a,[data-onglet],[data-go]')]
        .filter((el) => el.scrollWidth > el.clientWidth + 1)
        .slice(0, 5).map((el) => (el.textContent ?? '').trim().slice(0, 20)),

      rognes: [...document.querySelectorAll('body *')].filter((el) => {
        if (el.children.length) return false;
        const t = (el.textContent ?? '').trim();
        if (t.length < 3) return false;
        if (el.scrollWidth <= el.clientWidth + 1) return false;
        const st = getComputedStyle(el);
        if (st.overflowX !== 'hidden' && st.overflowX !== 'clip') return false;
        if (st.textOverflow === 'ellipsis') return false;
        return true;
      }).slice(0, 4).map((el) => (el.textContent ?? '').trim().slice(0, 24)),

      /* La gouttière. Rien de ce qui porte du texte ne doit toucher le bord :
         un titre collé au bord ne casse rien, il finit seulement par donner à
         tout l'écran un air de brouillon.

         On mesure **l'encre** et non la boîte. Une boîte commence à zéro dès
         que sa marge est intérieure — `h1{padding:16px}` pose son texte à
         seize pixels et sa boîte à zéro — et prendre la boîte signalait trois
         pages parfaitement correctes. Un `Range` rend les rectangles du texte
         réellement dessiné, ce qui est exactement ce que l'œil voit. */
      auBord: (() => {
        const bord = document.documentElement.clientWidth;
        const fautifs = [];
        for (const el of document.querySelectorAll('h1,h2,h3,p,.titre,.title,.lib')) {
          const t = (el.textContent ?? '').trim();
          if (!t) continue;
          const r = document.createRange();
          r.selectNodeContents(el);
            /* Un ancêtre qui rogne rend cette mesure sans objet : le `Range`
             donne la géométrie du texte **avant** rognage, donc un libellé
             coupé par sa tuile paraîtrait toucher le bord alors que l'œil ne
             voit rien y arriver. Le défaut existe, mais c'est l'autre — celui
             du libellé trop long, contrôlé juste après. */
          let rogne = false;
          for (let p = el; p && p !== document.body; p = p.parentElement) {
            const o = getComputedStyle(p).overflowX;
            if (o === 'hidden' || o === 'clip' || o === 'auto' || o === 'scroll') {
              rogne = true; break;
            }
          }
          if (rogne) continue;

          for (const b of r.getClientRects()) {
            if (b.width < 2 || b.height < 2) continue;
            if (b.left >= 6 && b.right <= bord - 6) continue;
            fautifs.push(t.slice(0, 24));
            break;
          }
          if (fautifs.length >= 4) break;
        }
        return fautifs;
      })(),
    };
  });

  console.log(`— ${nom} (${route})`);

  check(`  aucune erreur de script`, erreurs.length === 0
    || (console.log('        ', erreurs.slice(0, 2).join(' | ')), false));

  /* Un écran qui n'écrit rien s'affiche exactement comme un écran qui charge
     encore : c'est le défaut le plus facile à laisser passer. */
  check(`  la page affiche du contenu`, vu.texte.length > 40
    || (console.log('        texte vu :', JSON.stringify(vu.texte.slice(0, 60))), false));

  for (const [libelle, motif] of FUITES) {
    if (!motif.test(vu.texte)) continue;
    const extrait = vu.texte.split('\n').find((l) => motif.test(l)) ?? '';
    check(`  aucun « ${libelle} » à l’écran`,
      false || (console.log('        ligne :', extrait.slice(0, 90)), false));
  }

  /* Le jeu se joue au téléphone. Un débordement horizontal ne casse rien — il
     rend la page inutilisable, et personne ne s'en aperçoit sur un écran large.
     Deux pixels de tolérance : les arrondis de sous-pixel en produisent un. */
  check(`  rien ne déborde à 360 px`, vu.large <= vu.ecran + 2
    || (console.log(`        ${vu.large} px occupés pour ${vu.ecran} px d’écran`), false));

  check(`  aucun libellé n’est coupé en plein mot`, vu.rognes.length === 0
    || (console.log('        coupés :', vu.rognes.join(' | ')), false));

  check(`  les étiquettes de navigation se lisent en entier`, vu.libelles.length === 0
    || (console.log('        tronquées :', vu.libelles.join(' | ')), false));

  check(`  tout ce qui se touche est visible à l’écran`, vu.invisibles.length === 0
    || (console.log('        hors cadre :', vu.invisibles.join(' | ')), false));

  check(`  rien ne touche le bord de l’écran`, vu.auBord.length === 0
    || (console.log('        au bord :', vu.auBord.join(' | ')), false));

  if (!SANS_BARRE.has(route)) {
    check(`  la barre du haut est là`, vu.barre);
  }

  /* Un lien interne vers une route absente est une impasse qu'on ne découvre
     qu'en cliquant — c'est-à-dire jamais, pendant les tests. */
  const connues = new Set([...ECRANS.map(([r]) => r), '/fanzzy']);
  /* Un `href` vers `/api/...` est un départ de circuit — la connexion Google,
     un téléchargement — et non un écran. Le compter comme une impasse était une
     faute de lecture du contrôle, pas de la page. */
  const morts = [...new Set(vu.liens)].filter((h) =>
    !connues.has(h) && !h.startsWith('/fanzzy/') && !h.startsWith('/img/')
    && !h.startsWith('/api/'));
  check(`  les liens internes mènent à un écran connu`, morts.length === 0
    || (console.log('        impasses :', morts.join(', ')), false));

  if (process.env.CAPTURE) {
    const f = path.join(tmpdir(), 'tour' + route.replace(/\//g, '-') + '.png');
    await page.screenshot({ path: f, fullPage: true });
  }

  await page.close();
}

if (process.env.CAPTURE) console.log(`\n   captures dans ${tmpdir()}`);

await nav.close();
await new Promise((r) => http.close(r));
await pool.end();

console.log(failures ? `\n${failures} test(s) en échec` : '\ntout est vert');
process.exitCode = failures ? 1 : 0;
