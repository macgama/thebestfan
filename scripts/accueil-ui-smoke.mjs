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
import { createOnboarding } from '../src/server/onboarding/index.js';
import { createNiveau } from '../src/server/niveau/index.js';
import { seuil } from '../src/shared/niveau.js';
import { charger as chargerCatalogue } from '../src/server/fanzzy/catalogue.js';
import { baseDeTest } from './base-de-test.mjs';

const DB = baseDeTest();
const RACINE = fileURLToPath(new URL('..', import.meta.url));

let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };

/* ------------------------------------------------------------- la base */

const mysql = await import('mysql2/promise');
const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
await raw.query(`DROP TABLE IF EXISTS kop_bulletins, kop_votes, kop_bonus, kop_membres, kops, user_decks, user_stuff, user_skins, user_fanzzy,
  user_souvenirs, virage_presence, souvenirs, user_wallet, api_cache, souvenir_leagues,
  duel_results, duel_events, duels, user_follows, fixture_events, standings, fixtures,
  team_leagues, teams, leagues, api_quota, login_attempts, auth_tokens, sessions, users`);
for (const f of ['auth.sql', 'football.sql', 'souvenirs.sql', 'fanzzy.sql', 'inventaire.sql', 'skins.sql',
                 'niveau.sql']) {
  await raw.query(readFileSync(path.join(RACINE, 'sql', f), 'utf8'));
}

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
for (const id of ['G1', 'V1']) {
  await raw.query(`INSERT INTO user_fanzzy (user_id,fanzzy_id,copies) VALUES (?,?,1)`, [U, id]);
}
await raw.query(`INSERT INTO teams (id,name) VALUES (85,'Sion'),(91,'Bâle')`);
await raw.query(`INSERT INTO user_follows (user_id,team_id,is_main) VALUES (?,85,1)`, [U]);
await raw.end();

const pool = mysql.createPool({ uri: DB, connectionLimit: 6, charset: 'utf8mb4' });
// Le catalogue vit en base depuis qu il se gère par l administration :
// on le charge comme le fait server.js, sinon les modules travaillent
// sur un catalogue vide.
await chargerCatalogue(pool);

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
app.get('/api/virage/live', (_q, s) => s.json({ matchs: direct ? [direct] : [] }));

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

async function ouvrir(largeur = 400, hauteur = 880) {
  const page = await nav.newPage();
  page.on('pageerror', (e) => erreurs.push(e.message));
  await page.setViewport({ width: largeur, height: hauteur });
  await page.goto(base + '/', { waitUntil: 'networkidle0' });
  await page.waitForSelector('#hub.on', { timeout: 8000 }).catch(() => {});
  await page.waitForSelector('#pile .pose.on[src]', { timeout: 8000 }).catch(() => {});
  return page;
}

/** L'état des deux calques : lequel est visible, et sur quel dessin. */
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

    v = await scene(page);
    check('le Fanzzy équipé remplace le supporter',
      new RegExp(`/img/fanzzy/${ID}/e1/base/neutre\\.`).test(v.src ?? ''));
    check('sa révision est dans l’adresse', /\?v=\d+/.test(v.src ?? ''));
    check('il porte son nom pour qui ne voit pas l’écran',
      /Teigneux/.test(await page.$eval('#pile .pose.on', (n) => n.alt)));

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
      await new Promise((r) => setTimeout(r, 600));
      check('au stade 2, c’est le second âge qui s’affiche',
        new RegExp(`/img/fanzzy/${ID}/e2/base/${e2[0]}\\.`).test((await scene(page)).src ?? ''));

      // Et un état que le second âge n'a pas retombe sur le premier plutôt que
      // de laisser un trou : le personnage paraît plus jeune une seconde, il
      // ne disparaît pas.
      const absent = ['neutre', 'but', 'encaisse'].find((x) => !e2.includes(x));
      if (absent) {
        await page.evaluate((etat) => TBF.pose(etat), absent);
        await new Promise((r) => setTimeout(r, 600));
        check('un état absent du second âge retombe sur le premier',
          new RegExp(`/img/fanzzy/${ID}/e1/base/${absent}\\.`).test((await scene(page)).src ?? ''));
      }
      await page.close();
      await equiper(ID, 1);
    }
  }

  /* Un Fanzzy sans illustration ne doit pas laisser l'écran vide : le
     supporter générique reprend sa place, et le joueur ne voit rien
     d'anormal. C'est le cas de la grande majorité du catalogue aujourd'hui. */
  const SANS_ART = Object.keys(catalogue).length
    ? ['G1', 'V1', 'ZZ9'].find((id) => !catalogue[id]) : 'G1';
  await equiper(SANS_ART);
  page = await ouvrir();
  check('un Fanzzy sans dessin laisse la place au supporter',
    /\/img\/supporter\/idle\./.test((await scene(page)).src ?? ''));
  await page.close();
}

/* ------------------------------------------------------------- le menu */

{
  const page = await ouvrir();
  const avant = await page.evaluate(() => ({
    cache: document.getElementById('tiroir').hidden,
    deplie: document.getElementById('burger').getAttribute('aria-expanded'),
  }));
  check('le menu est replié au chargement', avant.cache === true && avant.deplie === 'false');

  await page.click('#burger');
  await new Promise((r) => setTimeout(r, 300));
  const apres = await page.evaluate(() => {
    const t = document.getElementById('tiroir');
    return {
      ouvert: t.classList.contains('on') && !t.hidden,
      deplie: document.getElementById('burger').getAttribute('aria-expanded'),
      liens: [...t.querySelectorAll('a')].filter((a) => !a.hidden)
        .map((a) => a.getAttribute('href')),
      // Un menu qui sort de l'écran est un menu dont la moitié est perdue.
      dansLEcran: t.getBoundingClientRect().right <= innerWidth + 1
        && t.getBoundingClientRect().bottom <= innerHeight + 1,
    };
  });
  check('le bouton l’ouvre', apres.ouvert && apres.deplie === 'true');
  check('et il tient dans l’écran', apres.dansLEcran);

  // Un lien de menu vers une page inexistante est un cul-de-sac silencieux :
  // le joueur atterrit sur une 404 sans comprendre.
  const routes = ['/deck', '/profil', '/equipes', '/kop', '/teletext',
    '/compte', '/admin', '#'];
  const inconnus = apres.liens.filter((h) => !routes.includes(h));
  check('tous ses liens mènent à une page qui existe', inconnus.length === 0);
  if (inconnus.length) console.log('    inconnus :', inconnus.join(', '));
  check('il donne accès au deck et au compte',
    apres.liens.includes('/deck') && apres.liens.includes('/compte'));
  check('l’administration reste cachée à un joueur ordinaire',
    !apres.liens.includes('/admin'));

  await page.click('#voile');
  await new Promise((r) => setTimeout(r, 300));
  check('cliquer à côté le referme', await page.evaluate(() =>
    !document.getElementById('tiroir').classList.contains('on')));
  await page.close();
}

/* --------------------------------------------- le match, et ce qu'il fait */

{
  direct = {
    id: 1, open: true, elapsed: 37, status_short: '2H',
    home_id: 85, away_id: 91, home_name: 'Sion', away_name: 'Bâle',
    home_goals: 1, away_goals: 0, crowd: [12, 9],
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
  await new Promise((r) => setTimeout(r, 700));
  check('mon club marque : il exulte',
    /\/img\/supporter\/goal\./.test((await scene(page)).src ?? ''));

  // L'adversaire égalise : il prend sa tête dans les mains.
  direct = { ...direct, away_goals: 1 };
  await page.evaluate(() => TBF.veiller());
  await new Promise((r) => setTimeout(r, 700));
  check('l’adversaire marque : il encaisse',
    /\/img\/supporter\/sad\./.test((await scene(page)).src ?? ''));

  await page.close();
  direct = null;
}

/* ------------------------------- l’écran de jeu sur un petit téléphone

 * L’accueil ne porte pas la barre commune : ses deux rails la remplacent.
 * Ce qui doit tenir, c’est donc tout l’écran — compteurs, rails, personnage,
 * jauge et bouton d’entrée — sans un pixel de défilement. Sur 320 px, un
 * iPhone SE, c’est la contrainte réelle. */
{
  const page = await ouvrir(320, 640);

  const ecran = await page.evaluate(() => {
    const app = document.getElementById('app');
    const entrer = document.getElementById('entrer');
    return {
      barre: Boolean(document.getElementById('tbf-nav')),
      rails: document.querySelectorAll('.rail').length,
      cases: document.querySelectorAll('.rail .case').length,
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
      rognes: [...document.querySelectorAll('.rail .case .lib')]
        .filter((l) => l.scrollWidth > l.clientWidth + 1).map((l) => l.textContent.trim()),
    };
  });

  check('la barre commune ne s’affiche pas sur l’accueil', ecran.barre === false);
  check('les deux rails portent les six sections',
    ecran.rails === 2 && ecran.cases === 6);
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
  const hud = await page.evaluate(() => ({
    pseudo: document.getElementById('pseudo').textContent,
    initiale: document.getElementById('initiale').textContent,
    club: document.getElementById('clubline').textContent,
    ecarpes: document.getElementById('scarves').textContent,
    boosters: document.getElementById('packs').textContent,
    collec: document.getElementById('collecTxt').textContent,
    jauge: document.getElementById('collecBar').style.width,
    entrer: document.getElementById('entrer').getAttribute('href'),
  }));
  check('le pseudo et son initiale sont posés',
    hud.pseudo === 'Momo' && hud.initiale === 'm');
  check('le club suivi est nommé', /Sion/.test(hud.club));
  /* Le niveau : un chiffre sur l’avatar, une jauge sous le pseudo. Rien ne
     doit s'afficher tant que le module n'a pas répondu — une pastille « 1 »
     posée par défaut mentirait pendant la seconde du chargement, et c’est
     précisément le moment où on la regarde. */
  const niv = await page.evaluate(() => ({
    pastille: document.getElementById('nivPastille')?.textContent ?? '',
    visible: document.getElementById('nivPastille')?.hidden === false,
    jauge: document.getElementById('nivBar')?.firstElementChild?.style.width ?? '',
  }));
  check('le niveau est affiché sur l’avatar', niv.visible && niv.pastille === '4');
  check('et la jauge du palier est remplie à moitié',
    /^4[5-9]%$|^5[0-5]%$/.test(niv.jauge));

  check('la bourse affiche écharpes et boosters',
    hud.ecarpes === '90' && hud.boosters === '12');
  /* Le compte vient du serveur, et on le compare à la base plutôt qu'à un
     chiffre écrit ici. Il valait « 2 » tant que la suite ne posait que deux
     Fanzzy ; depuis qu'elle en équipe d'autres pour éprouver l'accueil, il en
     vaut quatre — et un test qui fige un total finit toujours par mesurer sa
     propre mise en scène plutôt que le comportement. */
  const [[{ n: possedes }]] = await pool.query(
    'SELECT COUNT(*) n FROM user_fanzzy WHERE user_id = ?', [U]);
  check(`la collection est chiffrée (${possedes} possédés)`,
    new RegExp(`^${possedes}/\\d+$`).test(hud.collec));
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
  for (const [nom, etat] of [['repos', null], ['match', {
    id: 1, open: true, elapsed: 37, status_short: '2H',
    home_id: 85, away_id: 91, home_name: 'Sion', away_name: 'Bâle',
    home_goals: 1, away_goals: 0, crowd: [12, 9],
  }]]) {
    direct = etat;
    const p = await ouvrir();
    await new Promise((r) => setTimeout(r, 800));
    const f = path.join(tmpdir(), `accueil-${nom}.png`);
    await p.screenshot({ path: f, fullPage: false });
    console.log(`   capture : ${f}`);
    await p.close();
  }
}
await nav.close();
http.close();
await pool.end();

console.log(`\n${failures ? `${failures} échec(s)` : 'tout est vert'}`);
process.exitCode = failures ? 1 : 0;
