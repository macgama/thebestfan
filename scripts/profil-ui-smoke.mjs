/**
 * Test de la page PROFIL, et surtout de ce qu'on vient d'y ajouter.
 *
 * ## Ce qui manquait
 *
 * Le profil listait ce qu'un joueur **possède** — des clubs, un Fanzzy, de
 * l'équipement — et rien de ce qu'il a **fait**. Ni la liste de ses parties,
 * ni ce que chacune avait rapporté, ni même combien il en avait joué. Une
 * carte de membre sans carnet de bord.
 *
 * Tout était en base depuis le premier jour. Rien ne le lisait.
 *
 * ## Pourquoi un vrai navigateur
 *
 * Le parcours arrive **après** le reste de la page : il se demande à part,
 * sans `await`, pour que le profil s'affiche même si les classements ne
 * répondent pas. C'est exactement le genre de rendu qu'une lecture du fichier
 * ne peut pas juger — il faut attendre qu'il arrive, puis regarder ce qui a
 * été écrit.
 *
 * Usage : node scripts/profil-ui-smoke.mjs
 */
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import puppeteer from 'puppeteer';
import { createClassements } from '../src/server/classements/index.js';
import { createOnboarding } from '../src/server/onboarding/index.js';
import { createNiveau } from '../src/server/niveau/index.js';
import { seuil } from '../src/shared/niveau.js';
import { charger as chargerCatalogue } from '../src/server/fanzzy/catalogue.js';
import { chargerTenues } from '../src/server/fanzzy/tenues.js';
import { baseDeTest, OPTIONS_BASE } from './base-de-test.mjs';

const DB = baseDeTest();
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
await raw.query('SET FOREIGN_KEY_CHECKS = 0');
const [tables] = await raw.query('SHOW TABLES');
const noms = tables.map((r) => Object.values(r)[0]);
if (noms.length) await raw.query(`DROP TABLE ${noms.join(',')}`);
await raw.query('SET FOREIGN_KEY_CHECKS = 1');
for (const f of ['auth.sql', 'football.sql', 'minutes.sql', 'couleurs.sql', 'duel.sql',
                 'souvenirs.sql', 'billets.sql', 'fanzzy.sql', 'inventaire.sql', 'skins.sql',
                 'tenues.sql', 'deck.sql', 'kop.sql', 'niveau.sql',
                 // Les deux colonnes qui disent de quelle sorte un duel était.
                 // Sans elles, il n'y a rien à raconter.
                 'historique.sql']) {
  await raw.query(readFileSync(path.join(RACINE, 'sql', f), 'utf8'));
}

const U = 'eeeeeeee-0000-0000-0000-000000000001';
await raw.query(`INSERT INTO users (public_id,email,pseudo,password_hash)
                 VALUES (?,?,?,'x')`, [U, 'parcours@ex.fr', 'Parcoureur']);
/* **Niveau 4 et à mi-palier.** Un compte au niveau 1 avec zéro XP donnerait
   une jauge vide et un chemin dont la première marche est aussi la première
   du jeu : on ne verrait ni que la jauge se remplit, ni qu'un palier déjà
   franchi se distingue de ceux qui viennent. */
await raw.query(`INSERT INTO user_wallet (user_id,scarves,packs,xp,onboarded_at,active_fanzzy)
                 VALUES (?,120,3,?,NOW(3),'TR32')`,
  [U, seuil(4) + Math.round((seuil(5) - seuil(4)) / 2)]);
await raw.query(`INSERT INTO teams (id,name,country) VALUES
  (85,'FC Sion','Suisse'),(91,'FC Bale','Suisse')`);
await raw.query('INSERT INTO leagues (id,name,country) VALUES (207,?,?)',
  ['Super League', 'Suisse']);
await raw.query('INSERT INTO user_follows (user_id,team_id,is_main) VALUES (?,85,1)', [U]);
await raw.query(`INSERT INTO fixtures (id,league_id,season,home_id,away_id,status_short,kickoff_at)
                 VALUES (7001,207,2026,85,91,'FT',NOW())`);

/* Cinq parties : un virage et quatre duels, de quatre sortes différentes.
   C'est le minimum pour que « le parcours sépare les sortes » veuille dire
   quelque chose — et la dernière est jouée en neutre, pour que la mention le
   soit aussi. */
await raw.query(`INSERT INTO virage_presence (user_id,fixture_id,side,team_id,ferveur,joined_at)
                 VALUES (?,7001,0,85,240,NOW(3) - INTERVAL 5 MINUTE)`, [U]);
await raw.query(
  `INSERT INTO duel_results
     (duel_id,user_id,opponent_id,outcome,goals_for,goals_against,
      fixture_id,team_id,ferveur,format,mode,ended_at)
   VALUES ('p1',?,'x','win', 3,1,7001,85, 120,'1v1','classe',       NOW(3) - INTERVAL 1 MINUTE),
          ('p2',?,'x','loss',0,2,7001,85,  60,'2v2','classe',       NOW(3) - INTERVAL 2 MINUTE),
          ('p3',?,'x','draw',1,1,7001,85,  30,'1v1','entrainement', NOW(3) - INTERVAL 3 MINUTE),
          ('p4',?,'x','win', 2,0,7001,NULL,15,'2v2','entrainement', NOW(3) - INTERVAL 4 MINUTE)`,
  [U, U, U, U]);
await raw.end();

/* ----------------------------------------------------------- le serveur */

const pool = mysql.createPool({ uri: DB, connectionLimit: 6, ...OPTIONS_BASE });
await chargerCatalogue(pool);
await chargerTenues(pool);
const requireAuth = (q, _s, n) => { q.user = { id: U }; n(); };

const app = express();
app.use((req, _res, next) => { req.user = { id: U }; next(); });
app.use('/api/rank', createClassements({ pool, requireAuth }).router);
app.use('/api/me', createOnboarding({ pool, requireAuth }).router);
/* La progression est montée comme `server.js` la monte : sans elle, le
   chemin du niveau ne peut pas s'éprouver — il dirait « pas lisible », ce
   qui est le bon comportement mais pas celui qu’on vient mesurer. */
app.use('/api/niveau', createNiveau({ pool, requireAuth }).router);
app.get('/api/auth/me', (_q, s) => s.json({
  user: { id: U, pseudo: 'Parcoureur', email: 'parcours@ex.fr', verified: true },
}));
app.get('/api/souvenirs/mine', (_q, s) => s.json({ souvenirs: [] }));
app.get('/profil', (_q, s) => s.sendFile(path.join(RACINE, 'public', 'profil.html')));
app.use(express.static(path.join(RACINE, 'public')));

const http = createServer(app);
await new Promise((r) => http.listen(0, r));
const base = `http://localhost:${http.address().port}`;

const nav = await puppeteer.launch({ args: ['--no-sandbox'] });
const erreurs = [];
const page = await nav.newPage();
page.on('pageerror', (e) => erreurs.push(e.message));
await page.setViewport({ width: 400, height: 900 });
await page.goto(`${base}/profil`, { waitUntil: 'networkidle0' });

check('le profil s’affiche', await jusqua(async () =>
  page.evaluate(() => document.getElementById('page')?.style.display !== 'none')));

/* ------------------------------------------------------- le parcours */

check('la section du parcours arrive', await jusqua(async () =>
  page.evaluate(() => document.querySelectorAll('#parcours .sorte').length > 0)));

const vu = await page.evaluate(() => ({
  titres: [...document.querySelectorAll('h2')].map((h) => h.textContent.trim()),
  sortes: [...document.querySelectorAll('#parcours .sorte')].map((s) => ({
    q: s.querySelector('.q')?.textContent.trim(),
    n: s.querySelector('.n')?.textContent.replace(/\s+/g, ' ').trim(),
    f: s.querySelector('.f')?.textContent.trim(),
  })),
  lignes: [...document.querySelectorAll('#parcours .part')].map((p) => ({
    jeu: p.querySelector('.jeu')?.textContent.trim(),
    qui: p.querySelector('.qui b')?.textContent.trim(),
    sous: p.querySelector('.qui span')?.textContent.trim(),
    issue: p.querySelector('.issue')?.textContent.trim() ?? null,
    gain: p.querySelector('.gain b')?.textContent.trim(),
  })),
  encore: Boolean(document.getElementById('encore')),
}));

check('le profil annonce le parcours', vu.titres.includes('MON PARCOURS')
  || (console.log('        titres :', vu.titres.join(', ')), false));

/* Les cinq sortes de partie doivent être **séparées** : un 2v2 d'entraînement
   n'est pas un 1v1 classé, et les additionner effacerait la seule chose que le
   joueur vient chercher ici. */
const sortesVues = vu.sortes.map((s) => s.q);
for (const attendu of ['CLASSÉ · 1v1', 'CLASSÉ · 2v2',
                       'ENTRAÎNEMENT · 1v1', 'ENTRAÎNEMENT · 2v2', 'GRAND VIRAGE']) {
  check(`« ${attendu} » est compté à part`, sortesVues.includes(attendu)
    || (console.log('        vues :', sortesVues.join(' | ')), false));
}

const virage = vu.sortes.find((s) => s.q === 'GRAND VIRAGE');
check('le virage dit ce qu’il a rapporté', virage?.f === '240 ferveur'
  || (console.log('        il dit :', virage?.f), false));

/* La liste mêle les deux jeux, la plus récente d'abord. */
check('la liste montre les parties', vu.lignes.length >= 5
  || (console.log('        lignes :', vu.lignes.length), false));
check('elle mêle le duel et le virage',
  vu.lignes.some((l) => l.jeu === 'VIR') && vu.lignes.some((l) => l.jeu === '1v1'));
check('chaque ligne nomme le match', vu.lignes[0]?.qui === 'FC Sion – FC Bale'
  || (console.log('        première :', JSON.stringify(vu.lignes[0])), false));
check('et dit pour qui on poussait', /pour FC Sion/.test(vu.lignes[0]?.sous ?? '')
  || (console.log('        sous-titre :', vu.lignes[0]?.sous), false));
check('l’issue d’un duel se lit', vu.lignes.some((l) => l.issue === 'GAGNÉ'));
check('et ce qu’il a rapporté aussi', vu.lignes.some((l) => /^\+\d+$/.test(l.gain ?? '')));

/* Un neutre — venu pousser sur le match des autres — est **dit** : c'est ce
   qui divise sa ferveur par deux, et une règle qu'on ne découvre qu'en
   comparant deux soirées n'est pas une règle, c'est une surprise. */
check('le neutre est nommé', vu.lignes.some((l) => /neutre/.test(l.sous ?? ''))
  || (console.log('        sous-titres :', vu.lignes.map((l) => l.sous).join(' | ')), false));

/* ---------------------------------------------------------- la suite */

if (vu.encore) {
  const avant = vu.lignes.length;
  await page.evaluate(() => document.getElementById('encore').click());
  const plus = await jusqua(async () => page.evaluate((n) =>
    document.querySelectorAll('#parcours .part').length > n, avant));
  check('« VOIR PLUS » allonge la liste sans la refaire', plus
    || (console.log('        toujours', avant, 'lignes'), false));
} else {
  check('« VOIR PLUS » ne paraît pas quand tout tient en une page', true);
}


/* ------------------------------------------------- le chemin du niveau

 * Le joueur ne voyait de son niveau qu'une pastille sur l'accueil : un chiffre,
 * sans jauge, sans suite, sans rien qui dise à quoi il sert. Monter d'un niveau
 * n'était jamais attendu, et le palier qui ouvre un troisième Fanzzy au deck
 * arrivait comme une surprise chez ceux qui le remarquaient.
 *
 * Le compte du banc est au niveau 4, à mi-palier : c'est ce qui permet de voir
 * à la fois que la jauge se remplit vraiment et qu'un palier déjà franchi se
 * distingue de ceux qui viennent.
 */
{
  const arrive = await jusqua(async () =>
    page.evaluate(() => document.querySelectorAll('#niveau .marche').length > 0));
  check('le chemin du niveau arrive', arrive);

  if (arrive) {
    /* La jauge se remplit **après** le rendu : posée d'emblée à sa largeur
       finale, elle se lirait comme un trait et non comme un progrès. On la
       laisse donc arriver au lieu de la lire tout de suite. */
    const remplie = await jusqua(async () => page.evaluate(() => {
      const i = document.querySelector('#niveau .niv-jauge i');
      return i && parseFloat(i.style.width) > 0;
    }));
    check('et sa jauge se remplit sous les yeux', remplie);

    const niv = await page.evaluate(() => ({
      rond: document.querySelector('#niveau .niv-rond')?.textContent.replace(/\s+/g, ' ').trim(),
      titre: document.querySelector('#niveau .niv-txt b')?.textContent.trim(),
      sous: document.querySelector('#niveau .niv-txt span')?.textContent.trim(),
      marches: [...document.querySelectorAll('#niveau .marche')].map((m) => ({
        n: m.querySelector('.n')?.textContent.trim(),
        ici: m.classList.contains('ici'),
        cle: m.classList.contains('cle'),
        ouvre: [...m.querySelectorAll('li')].map((li) => li.textContent.trim()),
      })),
      large: Math.round(document.getElementById('niveau').getBoundingClientRect().width),
      colonne: Math.round(document.getElementById('app').getBoundingClientRect().width),
    }));

    check('il dit le niveau atteint', /^4/.test(niv.rond ?? '')
      || (console.log('        rond :', niv.rond), false));
    check('et ce qui reste avant le suivant', /XP/.test(niv.sous ?? '')
      || (console.log('        sous :', niv.sous), false));

    /* **Ce qui vient**, et non seulement où l'on est. C'est toute la différence
       entre un compteur et un chemin : on doit pouvoir lire, sans chercher, ce
       que le prochain palier ouvre. */
    check('il montre les marches à venir', niv.marches.length >= 3
      || (console.log('        marches :', niv.marches.length), false));
    check('la marche du moment est marquée', niv.marches.filter((m) => m.ici).length === 1);
    check('et c’est celle où l’on est', niv.marches.find((m) => m.ici)?.n === '4');
    /* Le niveau 5 ouvre le troisième Fanzzy au deck : c'est le palier que ce
       compte a devant lui, et il doit être **nommé**, pas laissé à deviner. */
    const cinq = niv.marches.find((m) => m.n === '5');
    check('un palier qui ouvre quelque chose se distingue', cinq?.cle === true);
    check('et il dit en toutes lettres ce qu’il ouvre',
      (cinq?.ouvre ?? []).some((x) => /Fanzzy au deck/.test(x))
      || (console.log('        il dit :', JSON.stringify(cinq?.ouvre)), false));
    /* Chaque niveau verse des écharpes. Elles tombaient sans que rien ne les
       ait annoncées ; le chemin les annonce. */
    check('chaque marche annonce ses écharpes',
      niv.marches.every((m) => m.ouvre.some((x) => /écharpes/.test(x))));

    check('et le bloc tient dans la colonne', niv.large <= niv.colonne + 1);
  }
}

check('aucune erreur de script sur le profil', erreurs.length === 0
  || (console.log('       ', erreurs.slice(0, 3)), false));

await nav.close();
await new Promise((r) => http.close(r));
await pool.end();

console.log(failures ? `\n${failures} test(s) en échec` : '\ntout est vert');
process.exitCode = failures ? 1 : 0;
