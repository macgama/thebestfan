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
const dodo = (ms) => new Promise((r) => setTimeout(r, ms));
/* La recherche du club est différée de 320 ms : une attente fixe suffirait
   aujourd'hui et lâcherait le jour où le délai bouge. On regarde plutôt. */
async function jusqua(fn, ms = 6000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await fn()) return true; await dodo(60); }
  return false;
}

/* ------------------------------------------------------------- la base */

const mysql = await import('mysql2/promise');
const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
await raw.query('SET FOREIGN_KEY_CHECKS = 0');
await raw.query(`DROP TABLE IF EXISTS parrainages, abonnements, achats, admin_journal, reglages, competitions,
  kop_membres, kops, amis, user_stuff, user_etats, user_skins, user_fanzzy, user_souvenirs,
  user_decks, virage_presence, user_niveau, tenues, fanzzy, user_wallet,
  user_league_follows, team_leagues, teams, leagues, sessions, users`);
await raw.query('SET FOREIGN_KEY_CHECKS = 1');

for (const f of ['auth.sql', 'football.sql', 'minutes.sql', 'couleurs.sql', 'duel.sql',
  'souvenirs.sql', 'billets.sql', 'fanzzy.sql', 'teletext.sql', 'inventaire.sql',
  'skins.sql', 'etats.sql', 'tenues.sql', 'deck.sql', 'admin.sql', 'kop.sql', 'amis.sql',
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
  /* Ajoutée au menu en septembre 2026, et restée hors de cette liste : toutes
     les pages y renvoyaient, et le tour la comptait en impasse — vingt et un
     rouges pour un seul oubli. Elle n’avait par ailleurs aucune suite
     d’interface, alors que c’est la seule page du jeu qui prend de l’argent
     réel. Elle en a une maintenant : celle-ci. */
  ['/abonnement', 'abonnement'],
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
  ['/aide', 'aide'],
  ['/repetition', 'répétition'],
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

      /* **Une plaque peinte en rien.**
       *
       * Toutes les couleurs d'une plaque viennent de cinq variables. Une
       * plaque qui n'y a pas droit — parce que la table des tons ne
       * l'atteignait pas — ne tombe pas en erreur : ses règles deviennent
       * invalides, une par une, et l'objet se rend transparent. Il garde sa
       * taille, sa place, son étiquette et son lien ; il n'a plus de corps.
       *
       * C'est arrivé au bouton de menu de l'accueil : présent, cliquable,
       * mesuré comme visible par le contrôle du dessus — et invisible à l'œil.
       * Rien dans la console, rien dans le rendu, rien dans les mesures de
       * débordement. Seule une couleur sait le dire.
       *
       * On lit donc ce que le navigateur a **résolu** : une plaque dont le fond
       * est transparent et qui n'a aucune ombre n'a pas été peinte. */
      fantomes: [...document.querySelectorAll('.tbf-plaque,.tbf-case,.tbf-onglet.on')]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          if (r.width < 4 || r.height < 4) return false;
          if (el.closest('[hidden],[aria-hidden="true"]')) return false;
          const st = getComputedStyle(el);
          if (st.visibility === 'hidden' || st.display === 'none') return false;
          const fond = st.backgroundImage !== 'none'
            || !/^rgba\(0, 0, 0, 0\)$|^transparent$/.test(st.backgroundColor);
          return !(fond && st.boxShadow !== 'none');
        })
        .slice(0, 5)
        .map((el) => ((el.textContent ?? '').trim() || el.getAttribute('aria-label')
          || el.className).slice(0, 24)),

      /* **Un rail d'onglets dont un enfant n'est pas un onglet.**
       *
       * Le rail creusé et l'onglet qui s'y pose vont par deux : l'un ne veut
       * rien dire sans l'autre. Un enfant qui n'a pas reçu `.tbf-onglet` ne
       * disparaît pas et ne devient pas gris — il reste **un lien nu**, dans
       * le bleu du navigateur, en dehors de la barre, à côté d'elle.
       *
       * C'est arrivé au troisième onglet de la page des Fanzzy. Il portait
       * `class="go"` quand les deux autres n'avaient pas de classe : le
       * remplacement qui a posé `.tbf-onglet` ne l'a pas reconnu, et il n'y
       * avait aucune règle pour `.go` dans cette page. Le contrôle du dessus ne
       * pouvait pas le voir — il ne regarde que les `<button>`, et un `<a>` sans
       * style n'est ni gris ni en relief.
       *
       * Celui-ci est structurel, et c'est ce qui le rend sûr : il ne juge pas
       * une couleur, il vérifie que les deux moitiés d'une même brique sont
       * bien ensemble. */
      orphelins: [...document.querySelectorAll('.tbf-onglets')]
        .flatMap((rail) => [...rail.children]
          .filter((el) => !el.classList.contains('tbf-onglet')))
        .slice(0, 5)
        .map((el) => ((el.textContent ?? '').trim() || el.className
          || el.tagName).slice(0, 24)),

      /* **Un bouton resté au style du navigateur.**
       *
       * Le pendant de la plaque peinte en rien, et il arrive par le chemin
       * inverse : la règle qui habillait le bouton s'en va — déplacée dans la
       * feuille commune, renommée — et le bouton ne devient pas invisible, il
       * redevient un bouton système. Gris clair, bordure en relief, police du
       * système : parfaitement visible, parfaitement à sa place, et étranger au
       * jeu.
       *
       * C'est arrivé aux deux onglets du deck. Ils sont écrits par le
       * JavaScript dans un gabarit de chaîne, donc le remplacement de balisage
       * ne les a pas vus ; ils ont perdu leur règle locale sans gagner la
       * commune, et sont ressortis en deux pastilles blanches.
       *
       * On reconnaît le style système à sa couleur de fond — Chrome rend
       * `buttonface` en `rgb(239, 239, 239)` — et à sa bordure en relief. */
      systeme: [...document.querySelectorAll('button,input[type=button],input[type=submit]')]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          if (r.width < 4 || r.height < 4) return false;
          if (el.closest('[hidden],[aria-hidden="true"]')) return false;
          const st = getComputedStyle(el);
          if (st.visibility === 'hidden') return false;
          return st.backgroundColor === 'rgb(239, 239, 239)'
            || st.borderTopStyle === 'outset';
        })
        .slice(0, 5)
        .map((el) => ((el.textContent ?? '').trim() || el.getAttribute('aria-label')
          || el.className || 'button').slice(0, 24)),

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

  check(`  chaque plaque a bien un corps`, vu.fantomes.length === 0
    || (console.log('        peintes en rien :', vu.fantomes.join(' | ')),
      console.log('        — une variable de ton absente rend toutes leurs '
        + 'règles invalides, en silence'), false));

  check(`  chaque enfant d’un rail d’onglets est un onglet`, vu.orphelins.length === 0
    || (console.log('        hors barre :', vu.orphelins.join(' | ')),
      console.log('        — sans `tbf-onglet`, il reste un lien nu posé à '
        + 'côté de la barre'), false));

  check(`  aucun bouton n’est resté au style du navigateur`, vu.systeme.length === 0
    || (console.log('        gris système :', vu.systeme.join(' | ')),
      console.log('        — leur règle est partie sans que la commune '
        + 'les rattrape'), false));

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
    /* Le rideau d'ouverture dure dix secondes et couvre l'accueil : sans cette
       levée, la capture de l'accueil montrait l'écran de chargement, et non
       l'écran. On le retire comme il se retire lui-même — en annonçant sa fin,
       faute de quoi l'accueil n'aurait jamais joué son bonjour. */
    await page.evaluate(() => {
      document.getElementById('ouverture')?.remove();
      dispatchEvent(new Event('tbf:ouverture-finie'));
    }).catch(() => {});
    await new Promise((r) => { setTimeout(r, 450); });
    const f = path.join(tmpdir(), 'tour' + route.replace(/\//g, '-') + '.png');
    await page.screenshot({ path: f, fullPage: true });
  }

  await page.close();
}

/* ------------------------------------- la carte en grand tient à l'écran

   Le seul endroit du jeu où un panneau s'ouvre par-dessus la page, et celui où
   l'on décide : on regarde une carte, et on l'ajoute — ou pas. Le bouton était
   sous le bord de l'écran, et il fallait faire défiler pour le trouver.

   Cette mesure ne peut se faire qu'ici : `deck:ui` tourne sous jsdom, qui ne
   met rien en page et ne saurait dire si quelque chose dépasse. */
{
  const page = await nav.newPage();
  /* **Six cents pixels, et non sept cent quatre-vingts.** Un panneau de decision
     doit tenir sur le telephone le plus court, pas sur le plus confortable :
     un iPhone SE offre 667 px moins la barre d adresse, un Android d entree de
     gamme a peine plus. La hauteur genereuse cachait le defaut. */
  await page.setViewport({ width: 360, height: 600 });
  await page.goto(base + '/deck', { waitUntil: 'networkidle0' }).catch(() => {});
  await new Promise((r) => setTimeout(r, 600));

  const vu = await page.evaluate(async () => {
    document.querySelector('[data-onglet="cartes"]')?.click();
    await new Promise((r) => setTimeout(r, 200));
    const rangee = document.querySelector('[data-detail]');
    if (!rangee) return { ouvert: false };
    rangee.click();
    await new Promise((r) => setTimeout(r, 300));

    const p = document.querySelector('#panneau');
    const carte = document.querySelector('.grandeCarte');
    if (!p || !carte) return { ouvert: false };

    const r = p.getBoundingClientRect();
    const bas = [...p.querySelectorAll('button,.vide')].pop();
    return {
      ouvert: true,
      hauteur: Math.round(r.height),
      ecran: window.innerHeight,
      // Le panneau lui-même ne doit pas avoir à défiler.
      defile: p.scrollHeight > p.clientHeight + 2,
      // Et ce qui décide — le bouton, ou le refus qui le remplace — doit être
      // visible sans un geste de plus.
      basVisible: bas ? bas.getBoundingClientRect().bottom <= window.innerHeight + 2 : false,
      /* Ce qu on mesure vraiment, dit en clair : sans ces trois nombres, un
         rouge ici n apprend rien et se contourne en elargissant le seuil. */
      quiDecide: bas ? (bas.textContent || '').replace(/s+/g,' ').trim().slice(0,30) : null,
      basBas: bas ? Math.round(bas.getBoundingClientRect().bottom) : null,
      panneauBas: Math.round(r.bottom),
      art: Math.round(document.querySelector('.gcArt')?.getBoundingClientRect().height ?? 0),
    };
  });
  await page.close();

  console.log('— la carte en grand (/deck)');
  check('  le panneau de carte s’ouvre', vu.ouvert === true);
  if (vu.ouvert) {
    check(`  il tient dans l’écran (${vu.hauteur} px sur ${vu.ecran})`,
      vu.hauteur <= vu.ecran);
    check('  et il n’a pas à défiler', vu.defile === false);
    check('  ce qui décide reste sous les yeux, sans défiler', vu.basVisible === true
      || (console.log(`        « ${vu.quiDecide} » finit à ${vu.basBas} px, `
        + `le panneau à ${vu.panneauBas}, l écran à ${vu.ecran}`), false));
    /* Le dessin doit rester **regardable** : le réduire jusqu'à le faire
       disparaître ferait tenir le panneau sans rendre service. */
    check(`  le dessin reste assez grand pour être regardé (${vu.art} px)`, vu.art >= 150);
  }
}

/* ------------------------------------------------- le tour sur tablette

   La colonne du jeu s'élargit avec l'écran depuis que `--colonne` a cessé
   d'être écrite en dur dans chaque page. C'est un changement qu'aucune suite ne
   voyait : toutes visitent le jeu à trois cent soixante pixels, et une page qui
   se casserait à neuf cents serait livrée sans que rien ne proteste.

   On refait donc le tour à la largeur d'une tablette, et on y cherche les deux
   seules choses qui ne se voient pas autrement : **que la colonne remplisse la
   largeur** — sinon l'élargissement n'a servi à rien — et **que rien ne
   déborde**. Une page qui s'étale mal à neuf cents pixels déborde ; une page
   qui ignore la colonne reste à sa largeur de téléphone au milieu du noir. */
{
  const LARGEUR = 834;          // iPad en portrait, l'écran de la capture
  const page = await nav.newPage();
  await page.setViewport({ width: LARGEUR, height: 1112 });

  const etroites = [];
  const debordent = [];
  for (const [route] of tousLesEcrans) {
    await page.goto(base + route, { waitUntil: 'networkidle0' }).catch(() => {});
    await new Promise((r) => setTimeout(r, 400));
    const vu = await page.evaluate(() => {
      const app = document.getElementById('app') ?? document.querySelector('main');
      return {
        colonne: app ? Math.round(app.getBoundingClientRect().width) : 0,
        large: document.documentElement.scrollWidth,
        ecran: document.documentElement.clientWidth,
      };
    });
    /* Le plancher est à sept cents : c'est le seuil où `--colonne` bascule, et
       une page qui reste en dessous est une page qui ne l'emploie pas. */
    if (vu.colonne && vu.colonne < 700) etroites.push(`${route} ${vu.colonne}px`);
    if (vu.large > vu.ecran + 1) debordent.push(`${route} ${vu.large}>${vu.ecran}`);
  }
  await page.close();

  check(`sur tablette, chaque écran remplit la colonne (${LARGEUR} px)`,
    etroites.length === 0
    || (console.log('        restés étroits :', etroites.join(', ')), false));
  check('et aucun ne déborde en largeur',
    debordent.length === 0
    || (console.log('        débordent :', debordent.join(', ')), false));
}


/* ================================ le premier geste du jeu : le paquet

   C'est la première chose qu'un joueur fait, et celle dont il se souviendra.
   Elle se jouait au milieu d'une **carte blanche** : `.pack` est un `<button>`,
   et un bouton arrive avec un fond clair, une bordure en relief et un
   rembourrage que rien ne retirait. Du blanc sur les côtés, et une bande à
   arracher entièrement blanche tant que l'image du haut n'était pas posée.

   Aucune lecture de la feuille de style ne l'attrape : la faute n'est pas dans
   ce qui est écrit, elle est dans ce qui ne l'est pas. Il faut demander au
   navigateur ce qu'il a vraiment calculé. */

{
  const page = await nav.newPage();
  await page.setViewport({ width: 390, height: 844 });
  /* **Sans JavaScript.** La page de bienvenue renvoie ailleurs un joueur déjà
     inscrit — et celui du banc l'est. Or ce qu'on mesure ici est du style, que
     le navigateur calcule sans exécuter une ligne : on coupe donc le script
     plutôt que de simuler une inscription entière pour lire un fond. */
  await page.setJavaScriptEnabled(false);
  await page.goto(`${base}/bienvenue`, { waitUntil: 'domcontentloaded' });

  /* On ne traverse pas l'inscription : ce qu'on mesure est un pixel, pas un
     parcours. Le paquet est dans le document dès le chargement — sa scène est
     seulement transparente — et le navigateur a déjà calculé son fond, sa
     bordure et son rembourrage, qui sont exactement ce qui était faux. */
  const vu = await page.evaluate(() => {
    const paquet = document.getElementById('pack');
    const bande = document.getElementById('packlip');
    if (!paquet || !bande) return { absent: location.pathname };

    const p = getComputedStyle(paquet);
    const l = getComputedStyle(bande);
    // « Clair » : la somme des trois canaux d'un fond de bouton par défaut
    // tourne autour de 700 ; la nuit du stade est sous 60.
    const clarte = (c) => (c.match(/\d+/g) ?? [0, 0, 0])
      .slice(0, 3).reduce((a, b) => a + Number(b), 0);
    return {
      fond: clarte(p.backgroundColor),
      fondBande: clarte(l.backgroundColor),
      bordure: parseFloat(p.borderTopWidth),
      marge: parseFloat(p.paddingTop) + parseFloat(p.paddingLeft),
      large: Math.round(paquet.getBoundingClientRect().width),
    };
  });

  check('la page de bienvenue porte bien le paquet', !vu.absent
    || (console.log('        on est sur', vu.absent), false));
  check('le paquet n’a pas de fond clair derrière lui', vu.fond < 90
    || (console.log('        clarté du fond :', vu.fond), false));
  check('ni la bande qu’on arrache', vu.fondBande < 90);
  check('pas de bordure de bouton', vu.bordure === 0);
  check('ni de rembourrage qui laisse voir les bords', vu.marge === 0);
  /* **Les trois bibliothèques de dessin.** Seul l'équipement était illustré :
     un Fanzzy montrait son identifiant et une carte d'action son nom sur fond
     vide, alors que leurs dessins existent et servent partout ailleurs. Ils
     n'étaient simplement pas chargés sur cette page-ci — la seule où le joueur
     voit ses cartes pour la première fois. */
  const dessins = await page.evaluate(() => [...document.scripts]
    .map((x) => x.getAttribute('src') ?? ''));
  for (const lib of ['/fanzzy-art.js', '/action-art.js', '/stuff-art.js']) {
    check(`le paquet charge ${lib}`, dessins.includes(lib)
      || (console.log('        chargés :', dessins.filter(Boolean).join(' ')), false));
  }

  check('et il occupe l’écran', vu.large >= 200
    || (console.log('        largeur :', vu.large, 'px'), false));

  await page.close();
}

/* ------------------------------ le premier écran cherche dans sa langue

 * « Ton club ». Quelqu'un qui tape « suisse » n'obtenait rien : la base range
 * « Switzerland », et aucun club suisse ne porte le mot dans son nom. Le jeu
 * répondait « Aucun club trouvé » à un mot parfaitement juste, sur l'écran où
 * l'on décide de rester ou de partir.
 *
 * Et ce qu'il trouvait, il l'écrivait en anglais — « Switzerland » sous un
 * drapeau suisse. Le reste de l'application traduit depuis `pays.js` ; cette
 * page-ci, la première de toutes, ne l'avait jamais reçu.
 *
 * On intercepte la recherche plutôt que de monter le football : ce qui se
 * vérifie est ce que la page **demande** et ce qu'elle **écrit**, pas ce que
 * l'API sait répondre.
 */
{
  const page = await nav.newPage();
  await page.setViewport({ width: 390, height: 844 });

  let demande = null;
  await page.setRequestInterception(true);
  page.on('request', (r) => {
    /* Le compte du banc est **déjà inscrit** : la page le renverrait à
       l'accueil au premier chargement. On lui répond qu'il ne l'est pas —
       c'est la recherche du club qu'on éprouve, pas la garde d'entrée. */
    if (r.url().includes('/api/me/state')) {
      r.respond({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ onboarded: false, slots: { used: 0, max: 2 } }) });
      return;
    }
    if (!r.url().includes('/api/football/search')) { r.continue(); return; }
    demande = r.url();
    r.respond({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ teams: [
        { id: 15, name: 'Switzerland', country: 'Switzerland', logo: '', national: 1 },
        { id: 16, name: 'Switzerland W', country: 'Switzerland', logo: '', national: 1 },
        { id: 17, name: 'FC Sion', country: 'Switzerland', logo: '', national: 0 },
      ] }) });
  });

  await page.goto(`${base}/bienvenue`, { waitUntil: 'domcontentloaded' });
  const arrive = await page.evaluate(() => Boolean(document.getElementById('q')));
  check('la recherche du club est bien sur cette page', arrive
    || (console.log('        on est sur', await page.url()), false));

  if (arrive) {
    /* Le mot est tapé en français. La page doit en tirer le pays anglais
       toute seule — le serveur ne traduit rien, il compare. */
    await page.evaluate(() => {
      const q = document.getElementById('q');
      q.value = 'suisse';
      q.dispatchEvent(new Event('input'));
    });
    const venu = await jusqua(async () =>
      page.evaluate(() => document.querySelectorAll('#res .club').length > 0));
    check('taper « suisse » rend des équipes', venu);
    check('et la page a demandé le pays sous son nom anglais',
      /* Sans égard à la casse : `cherches()` rend les noms **pliés** — minuscules
         et sans accents — et la base compare sans casse. C’est la convention de
         `pays.js`, la même sur toutes les pages. */
      /pays=[^&]*switzerland/i.test(demande ?? '')
      || (console.log('        demandé :', demande), false));

    const lignes = await page.evaluate(() => [...document.querySelectorAll('#res .club')]
      .map((b) => ({ nom: b.querySelector('b')?.textContent.trim(),
        sous: b.querySelector('small')?.textContent.trim() })));
    check('le pays est écrit en français sous chaque équipe',
      lignes.every((l) => l.sous === 'Suisse')
      || (console.log('        ', JSON.stringify(lignes)), false));
    /* Une sélection nationale **est** un pays : son nom se traduit, suffixe
       compris. Un nom de club, lui, ne se traduit jamais. */
    check('la sélection nationale porte son nom français', lignes[0]?.nom === 'Suisse'
      || (console.log('        elle s’appelle', lignes[0]?.nom), false));
    check('l’équipe féminine garde son suffixe', lignes[1]?.nom === 'Suisse W'
      || (console.log('        elle s’appelle', lignes[1]?.nom), false));
    check('et le nom du club reste intact', lignes[2]?.nom === 'FC Sion');

    /* Le libellé que le joueur lit avant de chercher : l'écran ne demande pas
       qu'un club, il accepte une sélection nationale. */
    const dit = await page.evaluate(() =>
      (document.getElementById('s2')?.textContent ?? '').replace(/\s+/g, ' '));
    check('l’écran dit qu’on peut aussi choisir son équipe nationale',
      /équipe nationale/i.test(dit)
      || (console.log('        il dit :', dit.slice(0, 120)), false));
  }
  await page.close();
}



/* ================== le paquet de bienvenue montre les cartes du jeu

   La doctrine est écrite dans `carteDuPaquet` : le premier paquet n'a pas
   « la même apparence » que le kiosque, il a **le même code**. Ce qui ne l'y
   obligeait pas, c'est la feuille de style de la page.

   `bienvenue.html` habillait autrefois ses propres tuiles, et deux de ces
   règles portaient des noms que la vraie carte emploie : `illu` et `objet`,
   les images de `cartes.js`. Avec trois classes contre deux, `.face.front
   .illu` battait `.illuwrap .illu` — l'illustration d'une carte d'action,
   d'une pièce d'équipement ou d'une poignée d'écharpes cessait de remplir son
   cadre pour se poser en timbre de cent cinquante pixels dans un coin.

   Personne ne l'a vu en test : le tour ouvre `/bienvenue` mais n'y retourne
   aucune carte, et aucune suite ne mesurait une carte **sur cette page-là**.
   Le défaut n'était visible que sur le premier paquet d'un vrai joueur, sur
   l'écran dont le code dit lui-même qu'il est « celui dont on se souvient ».

   On mesure donc la carte là où elle se pose. Pas une capture d'écran : le
   rapport entre l'image et le cadre qui la porte — c'est lui qui vaut un,
   quelle que soit la taille du paquet, du téléphone ou de la carte. */
{
  const page = await nav.newPage();
  await page.setViewport({ width: 390, height: 844 });

  /* **Le compte du banc est déjà inscrit**, et `/bienvenue` renvoie alors à
     l'accueil — où le catalogue n'est pas chargé. Sans cette réponse, la mesure
     ci-dessous ne portait pas sur la page de bienvenue : elle attendait
     `TBF_CARTES` sur l'accueil, ne le trouvait jamais, et déclarait rouge un
     écran qu'elle n'avait pas ouvert. C'est la même précaution que le bloc
     voisin, pour la même raison. */
  await page.setRequestInterception(true);
  page.on('request', (r) => {
    if (r.url().includes('/api/me/state')) {
      r.respond({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ onboarded: false, slots: { used: 0, max: 2 } }) });
      return;
    }
    r.continue();
  });

  await page.goto(`${base}/bienvenue`, { waitUntil: 'networkidle0' });

  const pret = await jusqua(async () =>
    page.evaluate(() => Boolean(window.TBF_CARTES?.cardHTML)));
  check('la page de bienvenue charge les cartes du jeu', pret);

  if (pret) {
    /* Les trois sortes qui ne sont pas des supporters — ce sont elles que la
       règle atteignait. On les pose dans la **vraie** coque du révélateur :
       c'est la cascade de cette page qu'on éprouve, pas celle de cartes.css. */
    const mesures = await page.evaluate(() => {
      const V = window.TBF_CARTES;
      const sortes = [
        ['action', { id: 'a-arbitre', nom: 'Arbitre', type: 'pyro', rar: 'commune',
          stage: 1, action: true }],
        ['équipement', { id: 'jumelles', nom: 'Jumelles', type: 'depl', rar: 'commune',
          stage: 1, stuff: true }],
        /* `echarpes` et non `scarves` : c'est le drapeau que `dessinDeCarte`
           regarde. Le second est le nom que le serveur emploie dans le paquet,
           et `carteDuPaquet` traduit de l'un à l'autre — s'être trompé ici
           aurait fait retomber la carte sur le bonhomme procédural, donc passer
           le contrôle sans rien éprouver. */
        ['écharpes', { id: 'echarpes', nom: '87 écharpes', type: 'fide', rar: 'commune',
          stage: 1, echarpes: true }],
      ];
      /* **Posé sur le corps, pas dans la scène.** Les scènes de l'inscription
         sont masquées tant qu'on n'y est pas, et une carte dans un conteneur
         masqué n'a aucune dimension : la mesure rendait zéro sur zéro, ce qui
         ressemble à un défaut et n'en est pas un.

         La cascade, elle, ne dépend pas de l'endroit : `.face.front .illu` vaut
         partout où se trouve un `.face.front`, et c'est exactement la règle
         qu'on vient éprouver. On lui donne donc la largeur qu'a le révélateur —
         `min(70%, 250px)` sur un écran de 390 — et rien d'autre. */
      const hote = document.createElement('div');
      hote.id = 'banc-paquet';
      hote.style.cssText = 'position:fixed;left:0;top:0;width:250px;z-index:-1';
      hote.innerHTML = sortes.map(([, f]) => `<div class="reveal"><div class="flip"
        ><div class="face front">${V.cardHTML(f)}</div></div></div>`).join('');
      document.body.appendChild(hote);
      /* Les faces vivent retournées, dos au lecteur : sans annuler la rotation
         et la perspective, tout ce qu'on mesurerait serait un raccourci. */
      for (const el of hote.querySelectorAll('.flip, .face')) el.style.transform = 'none';
      for (const el of hote.querySelectorAll('.reveal')) {
        el.style.position = 'static'; el.style.transform = 'none';
      }

      /**
       * La même carte à deux largeurs.
       *
       * **On ne peut pas juger un rapport isolé**, et l'avoir essayé a coûté
       * deux faux rouges : une illustration de carte d'action remplit son cadre
       * à 100 %, un objet d'équipement détouré y flotte à 84 % — c'est écrit
       * dans `cartes.css` et c'est voulu. Un seuil unique déclare donc soit
       * l'objet fautif, soit le timbre correct.
       *
       * Ce qui distingue vraiment les deux, c'est **comment le rapport se
       * comporte quand la carte grandit**. Une taille en pourcentage ne bouge
       * pas ; une taille en pixels — les 150 px de la règle fautive — fond à
       * mesure que le cadre s'élargit. On mesure donc deux fois, et on regarde
       * l'écart.
       */
      const lire = () => sortes.map(([quoi], i) => {
        const carte = hote.querySelectorAll('.face.front')[i];
        const cadre = carte.querySelector('.illuwrap');
        const img = carte.querySelector('.illu');
        if (!cadre || !img) return { quoi, trouve: false };
        const c = cadre.getBoundingClientRect();
        const m = img.getBoundingClientRect();
        return { quoi, trouve: true,
          large: c.width ? m.width / c.width : 0,
          haut: c.height ? m.height / c.height : 0,
          cadre: Math.round(c.width) };
      });

      const etroit = lire();
      hote.style.width = '440px';
      const large = lire();
      return etroit.map((e, i) => ({ ...e,
        etroitPx: e.cadre, largePx: large[i].cadre,
        derive: Math.max(Math.abs(e.large - large[i].large),
          Math.abs(e.haut - large[i].haut)) }));
    });

    for (const m of mesures) {
      check(`la carte « ${m.quoi} » porte son illustration`, m.trouve
        || (console.log('        pas d’illustration dans la carte'), false));
      if (!m.trouve) continue;
      /* **Le rapport ne bouge pas quand la carte grandit.** C'est la signature
         d'une taille exprimée en pourcentage, donc d'une illustration tenue par
         `cartes.css` ; une règle de page en pixels, elle, garde ses 150 px et
         son rapport fond. Le défaut d'origine passait de 0,86 à 0,51 entre les
         deux largeurs mesurées ici. Trois centièmes de tolérance : c'est
         l'arrondi du navigateur, pas une marge de confort. */
      check(`et son cadrage suit la carte (${m.large.toFixed(2)} × ${m.haut.toFixed(2)}`
        + ` de ${m.etroitPx} à ${m.largePx}px, dérive ${m.derive.toFixed(2)})`,
        m.derive <= 0.03
        || (console.log('        une règle en pixels bat celle de cartes.css'), false));

      /* Et elle occupe vraiment son cadre. Le seuil est bas — un objet détouré
         y flotte à 84 %, et c'est voulu — mais il refuse le timbre : une
         illustration qui n'occuperait pas la moitié de son cadre ne serait plus
         une illustration de carte. */
      check(`et elle n’est pas un timbre (${(m.large * m.haut).toFixed(2)} du cadre)`,
        m.large >= 0.6 && m.haut >= 0.6);
    }

    await page.evaluate(() => document.getElementById('banc-paquet')?.remove());
  }
  await page.close();
}

if (process.env.CAPTURE) console.log(`\n   captures dans ${tmpdir()}`);

await nav.close();
await new Promise((r) => http.close(r));
await pool.end();

console.log(failures ? `\n${failures} test(s) en échec` : '\ntout est vert');
process.exitCode = failures ? 1 : 0;
