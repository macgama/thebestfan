/**
 * Test de la page /teletext — « Toutes les compétitions ».
 *
 * Cette page n'en avait aucun, et elle vient de changer sur cinq points qui
 * ne se lisent nulle part dans le code :
 *
 *   1. **Le pays est écrit dans la langue du lecteur.** La page ne tient pas
 *      de table : elle reçoit un code ISO et laisse `Intl` faire le reste.
 *      Si le serveur cessait de l'envoyer, tout continuerait — en anglais.
 *
 *   2. **On cherche un pays dans sa langue.** « suisse » doit retrouver les
 *      compétitions rangées sous « Switzerland ». C'est le navigateur qui
 *      retraduit, et le contrôle vérifie ce qu'il envoie au serveur.
 *
 *   3. **Le titre n'est plus écrit deux fois.** La barre du haut le dit déjà
 *      pour un joueur connecté ; elle ne se monte pas pour un visiteur, qui
 *      doit donc le garder. Deux cas contraires, une seule règle CSS.
 *
 *   4. **L'étoile suit une compétition.** Elle est dans la ligne qui ouvre la
 *      compétition : sans un arrêt net, un clic dessus ferait les deux.
 *
 *   5. **Les résultats donnent toutes les journées**, s'ouvrent sur celle du
 *      jour, font courir la minute d'un match en cours, et mènent à la fiche.
 *
 *   6. **La ferveur** est le seul onglet qui parle du jeu : ce que les
 *      supporters ont donné dans cette compétition. Il transmet la saison,
 *      et il n'interroge le serveur qu'une fois pour trois échelles.
 *
 * Le serveur est un talon : les vraies routes sont éprouvées par
 * `teletext-smoke`. Ce qu'on veut ici, c'est ce que la page **fait** de la
 * réponse.
 *
 * Avant de lancer :  npm install --no-save puppeteer
 */
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import puppeteer from 'puppeteer';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };
const dodo = (ms) => new Promise((r) => setTimeout(r, ms));
async function jusqua(fn, ms = 6000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await fn()) return true; await dodo(70); }
  return false;
}

/* --------------------------------------------------------------- le talon */

const LIGUES = [
  { league_id: 207, name: 'Super League', country: 'Switzerland', country_code: 'CH',
    type: 'League', family: 'championnat', season: 2026, tier: 2,
    has_standings: 1, has_top_scorers: 1, en_cours: true, favori: false },
  { league_id: 1, name: 'World Cup', country: 'World', country_code: null,
    type: 'Cup', family: 'international', season: 2022, tier: 1,
    has_standings: 0, has_top_scorers: 0, en_cours: false, favori: false },
  /* Sans code ISO, et avec le tiret que l'API met partout. Tant que
     `coverage.mjs` n'a pas rempli la colonne, c'est le cas de **toutes** les
     compétitions : la page doit traduire quand même, par le nom anglais. */
  { league_id: 292, name: 'K League 1', country: 'South-Korea', country_code: null,
    type: 'League', family: 'championnat', season: 2026, tier: 3,
    has_standings: 1, has_top_scorers: 1, en_cours: true, favori: false },
];

/** Ce que le navigateur a demandé la dernière fois. C'est ça qu'on éprouve. */
let derniereRequete = null;
let connecte = true;
const suivies = new Set();

/**
 * Un match en cours à la dix-neuvième minute, **vu il y a deux minutes**.
 * C'est tout l'enjeu de la minute : la page doit afficher 21′, pas 19′.
 */
const VU_IL_Y_A_MIN = 2;
const luA = () => Date.now() - VU_IL_Y_A_MIN * 60_000;

const JOURNEES = [
  { round: 'Regular Season - 4', debut: new Date(Date.now() - 8 * 864e5).toISOString(),
    fin: new Date(Date.now() - 8 * 864e5).toISOString(), joues: 1, total: 1 },
  { round: 'Regular Season - 5', debut: new Date(Date.now() - 36e5).toISOString(),
    fin: new Date(Date.now() - 36e5).toISOString(), joues: 0, total: 1 },
  { round: 'Regular Season - 6', debut: new Date(Date.now() + 6 * 864e5).toISOString(),
    fin: new Date(Date.now() + 6 * 864e5).toISOString(), joues: 0, total: 1 },
];

const MATCHS = {
  'Regular Season - 4': [{
    id: 401, date: new Date(Date.now() - 8 * 864e5).toISOString(), status: 'FT',
    elapsed: 90, extra: null, round: 'Regular Season - 4', live: false, fini: true,
    home: { id: 85, name: 'Sion', logo: '', goals: 1 },
    away: { id: 91, name: 'Bâle', logo: '', goals: 0 },
  }],
  'Regular Season - 5': [{
    id: 501, date: new Date(Date.now() - 36e5).toISOString(), status: '2H',
    elapsed: 19, extra: null, round: 'Regular Season - 5', live: true, fini: false,
    home: { id: 85, name: 'Sion', logo: '', goals: 0 },
    away: { id: 91, name: 'Bâle', logo: '', goals: 1 },
  }],
  'Regular Season - 6': [{
    id: 601, date: new Date(Date.now() + 6 * 864e5).toISOString(), status: 'NS',
    elapsed: null, extra: null, round: 'Regular Season - 6', live: false, fini: false,
    home: { id: 91, name: 'Bâle', logo: '', goals: null },
    away: { id: 85, name: 'Sion', logo: '', goals: null },
  }],
};

const app = express();

app.get('/api/tt/leagues', (q, s) => {
  derniereRequete = q.query;
  const favoris = q.query.favoris === '1';
  s.json({
    leagues: LIGUES
      .filter((l) => !favoris || suivies.has(l.league_id))
      .map((l) => ({ ...l, favori: suivies.has(l.league_id) })),
  });
});
app.get('/api/tt/countries', (_q, s) => s.json({
  countries: [{ country: 'Switzerland', code: 'CH', n: 4 },
              { country: 'Germany', code: 'DE', n: 3 }],
}));
app.get('/api/tt/favoris', (_q, s) => (connecte
  ? s.json({ leagues: [...suivies] })
  : s.status(401).json({ error: 'auth.error.unauthenticated' })));
app.post('/api/tt/favoris/:id', (q, s) => {
  suivies.add(Number(q.params.id));
  s.json({ leagues: [...suivies] });
});
app.delete('/api/tt/favoris/:id', (q, s) => {
  suivies.delete(Number(q.params.id));
  s.json({ leagues: [...suivies] });
});

const LIGUE = { season: 2026, name: 'Super League', country: 'Switzerland',
                country_code: 'CH', family: 'championnat', type: 'League' };

app.get('/api/tt/league/:id', (_q, s) => s.json({
  league: LIGUE,
  groups: [[{ rank: 1, name: 'FC Sion', logo: '', played: 12, win: 9, draw: 0,
              lose: 3, gf: 24, ga: 11, points: 27 }]],
  stale: false,
}));
app.get('/api/tt/league/:id/results', (q, s) => {
  /* La journée en cours est la cinquième : c'est elle qui se joue. Le talon
     la choisit quand on ne demande rien, comme le fait le vrai service. */
  const voulue = MATCHS[q.query.journee] ? q.query.journee : 'Regular Season - 5';
  s.json({
    league: LIGUE,
    journees: JOURNEES.map((j) => ({ ...j, en: j.round === voulue })),
    journee: voulue,
    // Nul hors du direct : la minute n'a alors rien à faire courir.
    luA: voulue === 'Regular Season - 5' ? luA() : null,
    matchs: MATCHS[voulue],
    stale: false,
  });
});
/* Les classements de ferveur. Ils ne viennent pas du télétexte : c'est notre
   propre base, et le talon compte ce que la page lui demande — c'est ça qu'on
   éprouve, pas le contenu. */
let derniereRang = null;
let appelsRang = 0;
let ferveurVide = false;
app.get('/api/rank/competition/:id', (q, s) => {
  derniereRang = { id: q.params.id, ...q.query };
  appelsRang++;
  if (ferveurVide) {
    return s.json({ saison: 2026, joueurs: [], tribunes: [], kops: [], moi: null });
  }
  s.json({
    saison: 2026,
    joueurs: [
      { public_id: 'u1', pseudo: 'Momo', ferveur: 1000, seances: 4, club: 'FC Sion' },
      { public_id: 'u2', pseudo: 'Sarah', ferveur: 800, seances: 3, club: 'FC Sion' },
    ],
    tribunes: [
      { id: 85, name: 'FC Sion', logo: '', ferveur: 1800, supporters: 2, moyenne: 900 },
      { id: 91, name: 'FC Bâle', logo: '', ferveur: 900, supporters: 4, moyenne: 225 },
    ],
    kops: [
      { id: 'k1', nom: 'Les Fidèles', club: 'FC Sion', logo: '',
        membres: 2, ferveur: 1800, moyenne: 900 },
    ],
    moi: { ferveur: 120, seances: 2, rang: 6, sur: 6 },
  });
});

app.get('/api/auth/me', (_q, s) => (connecte
  ? s.json({ user: { pseudo: 'Momo' } })
  : s.status(401).json({ error: 'auth.required' })));

app.get('/teletext', (_q, s) => s.sendFile(path.join(RACINE, 'public', 'teletext.html')));
// La fiche d'un match vit sur la page des matchs : on éprouve qu'on y arrive,
// pas ce qu'on y trouve — c'est le sujet de `matchs-ui-smoke`.
app.get('/matchs', (_q, s) => s.type('html').send('<h1>matchs</h1>'));
app.use(express.static(path.join(RACINE, 'public')));

const http = createServer(app);
await new Promise((r) => http.listen(0, r));
const base = `http://localhost:${http.address().port}`;

const nav = await puppeteer.launch({ args: ['--no-sandbox'] });
const erreurs = [];
const page = await nav.newPage();
page.on('pageerror', (e) => erreurs.push(e.message));
await page.setViewport({ width: 400, height: 880 });

/* La langue du joueur, posée avant que la page s'exécute : c'est bien la clé
   que `compte.html` écrit, pas un réglage inventé pour la suite. */
await page.evaluateOnNewDocument(() => {
  try { localStorage.setItem('tbf_locale', 'fr'); } catch { /* refusé : tant pis */ }
});
await page.goto(base + '/teletext', { waitUntil: 'networkidle0' });
await jusqua(async () => await page.$('.lg') !== null);

check('la page se charge sans erreur de script', erreurs.length === 0);
if (erreurs.length) console.log('   ', erreurs.slice(0, 3));

/* ------------------------------------------------------------- les pays */

{
  const pays = await page.$$eval('.lg small', (ns) => ns.map((n) => n.textContent.trim()));
  check('le pays est écrit dans la langue du lecteur',
    pays.some((p) => p.startsWith('Suisse')) || (console.log('        il dit :', pays), false));
  check('un pays sans code ISO se dit quand même',
    pays.some((p) => p.startsWith('International')));
  check('et un pays dont le code manque encore se traduit par son nom',
    pays.some((p) => p.startsWith('Corée du Sud')));

  const pastilles = await page.$$eval('.chips .chip', (ns) => ns.map((n) => n.textContent.trim()));
  check('les pastilles de pays sont traduites aussi',
    pastilles.includes('Suisse') && pastilles.includes('Allemagne'));
}

/* --------------------------------------------------- « en cours », ou non */

{
  const enCours = await page.$$eval('.lg', (ns) => ns.map((n) => ({
    nom: n.querySelector('b').textContent.trim(),
    enc: Boolean(n.querySelector('.enc')),
  })));
  check('ce qui se joue porte la mention « en cours »',
    enCours.find((l) => l.nom === 'Super League')?.enc === true);
  check('et une compétition close ne la porte pas',
    enCours.find((l) => l.nom === 'World Cup')?.enc === false);
}

/* ------------------------------------------------- chercher un pays en français

   Le contrôle porte sur **ce que la page demande au serveur**, pas sur ce
   qu'elle reçoit : le talon rend toujours la même liste. Si la page n'envoyait
   que le mot tapé, le serveur chercherait « suisse » dans une colonne qui dit
   « Switzerland » et ne trouverait rien — c'est exactement la panne qu'on
   répare, et elle serait invisible autrement.                                */

{
  await page.evaluate(() => {
    const q = document.getElementById('q');
    q.value = 'suisse';
    q.dispatchEvent(new Event('input'));
  });
  await dodo(500);
  check('le mot tapé part tel quel', derniereRequete?.q === 'suisse');
  check('le pays cherché part retraduit en anglais',
    String(derniereRequete?.pays ?? '').split(',').includes('Switzerland'));
  check('et son code ISO l’accompagne',
    String(derniereRequete?.codes ?? '').split(',').includes('CH'));

  /* Sans accent, et le nom anglais aussi : personne ne compose « é » dans un
     champ de recherche, et personne ne devine dans quelle langue chercher. */
  await page.evaluate(() => {
    const q = document.getElementById('q');
    q.value = 'allemagne';
    q.dispatchEvent(new Event('input'));
  });
  await dodo(500);
  check('un autre pays trouve le sien',
    String(derniereRequete?.codes ?? '').split(',').includes('DE'));

  await page.evaluate(() => {
    const q = document.getElementById('q');
    q.value = '';
    q.dispatchEvent(new Event('input'));
  });
  await dodo(500);
}

/* ---------------------------------------------------------- l'étoile */

{
  await jusqua(async () => (await page.$$('.lg .fav')).length === 3);
  check('un joueur connecté voit l’étoile',
    (await page.$$('.lg .fav')).length === 3);

  await page.evaluate(() => document.querySelector('.lg .fav').click());
  await jusqua(async () => await page.$('.lg .fav.on') !== null);
  check('elle s’allume au clic', await page.$('.lg .fav.on') !== null);
  check('et elle n’ouvre pas la compétition au passage',
    await page.$('#tabs') === null);
  check('le serveur l’a bien retenue', suivies.has(207));

  /* Le filtre qui donne son sens à l'étoile : retrouver les siennes sans les
     chercher parmi neuf cent cinquante. */
  await page.evaluate(() => document.querySelector('[data-mien]').click());
  await jusqua(async () => (await page.$$('.lg')).length === 1);
  check('« mes compétitions » ne montre que celles-là',
    (await page.$$eval('.lg b', (ns) => ns.map((n) => n.textContent))).join() === 'Super League');

  await page.evaluate(() => document.querySelector('[data-mien]').click());
  await jusqua(async () => (await page.$$('.lg')).length === 3);
}

/* ------------------------------------------------------------ le titre

   **La page est nommée, une fois.** C'est la règle, et les deux cas d'en
   dessous la mesurent des deux côtés : jamais deux fois, jamais zéro.

   Ce bloc disait « la barre du haut ne se monte que pour un joueur connecté »,
   et le second contrôle mesurait donc le titre écrit dans la page. Ce n'est
   plus vrai : la barre se monte pour tout le monde depuis qu'elle porte la
   flèche de retour — la vitrine envoie les visiteurs sur la page des matchs,
   et ils s'y retrouvaient sans aucun moyen de revenir.

   Le contrôle rougissait donc en annonçant « la page perd son titre » alors
   que la page était nommée, par l'autre source. Il compte maintenant les
   titres au lieu d'en désigner un : la règle survit au changement de celui
   qui la porte. */

{
  const visible = (s) => page.evaluate((sel) => {
    const n = document.querySelector(sel);
    return Boolean(n) && getComputedStyle(n).display !== 'none';
  }, s);

  await jusqua(async () => await page.$('.tbf-haut') !== null);
  check('avec la barre du haut, le titre n’est pas écrit deux fois',
    await visible('#tnom') === false);
  check('mais ce que la liste montre reste dit', await visible('#tsous') === true);

  connecte = false;
  await page.goto(base + '/teletext', { waitUntil: 'networkidle0' });
  await jusqua(async () => await page.$('.lg') !== null);

  const nomme = await page.evaluate(() => [...document.querySelectorAll('.tbf-ou, #tnom')]
    .filter((n) => getComputedStyle(n).display !== 'none')
    .map((n) => (n.textContent || '').trim())
    .filter(Boolean));
  check(`sans compte, la page est nommée une fois (${nomme.join(' · ') || 'pas du tout'})`,
    nomme.length === 1);

  /* **Et le visiteur a une sortie.** C'est la raison pour laquelle la barre
     se monte pour lui, et c'est le seul endroit de la suite où l'on est
     déconnecté : si ce contrôle n'est pas ici, il n'est nulle part. */
  check('et il a une sortie vers l’accueil',
    await page.$('.tbf-retour') !== null);
  /* Pas de menu : un tiroir plein de portes fermées est une liste de refus. */
  check('mais pas de menu, qu’il ne pourrait pas emprunter',
    await page.$('.tbf-burger') === null);
  check('et l’étoile ne paraît pas', await page.$('.lg .fav') === null);
  connecte = true;
}

/* ------------------------------------------------------- les journées */

{
  await page.goto(base + '/teletext?ligue=207', { waitUntil: 'networkidle0' });
  await jusqua(async () => await page.$('#tabs') !== null);
  check('une compétition demandée par l’adresse s’ouvre directement',
    await page.$eval('#tnom', (n) => n.textContent.trim()) === 'Super League');
  check('et son pays est traduit dans le titre',
    (await page.$eval('#tsous', (n) => n.textContent)).startsWith('Suisse'));

  await page.evaluate(() => document.querySelector('[data-t=resultats]').click());
  await jusqua(async () => await page.$('#jsel') !== null);

  const menu = await page.$eval('#jsel', (n) => ({
    options: [...n.options].map((o) => o.textContent.trim()),
    choisie: n.value,
  }));
  check('toutes les journées sont au menu', menu.options.length === 3);
  check('« Regular Season - 5 » se lit « Journée 5 »', menu.options[1] === 'Journée 5');
  check('et la page s’ouvre sur celle du jour', menu.choisie === 'Regular Season - 5');

  /* La minute. Dix-neuf relevées, vues il y a deux minutes : vingt et une. Si
     la page affichait 19′, elle afficherait la minute du serveur — c'est-à-dire
     une minute fausse dès la vingtième seconde. */
  const min = await page.$eval('.m .live', (n) => n.textContent.trim());
  check('la minute court depuis le relevé, pas depuis l’affichage',
    /^21\D?$/.test(min) || (console.log('        elle dit :', min), false));

  await page.evaluate(() => document.getElementById('jprec').click());
  const journeeAffichee = () => page.evaluate(() => document.getElementById('jsel')?.value ?? null);
  await jusqua(async () => await journeeAffichee() === 'Regular Season - 4');
  check('la flèche remonte à la journée précédente',
    await page.$eval('.m .sc', (n) => n.textContent.replace(/\s/g, '')) === '1–0');

  await page.select('#jsel', 'Regular Season - 6');
  await jusqua(async () => await journeeAffichee() === 'Regular Season - 6');
  check('et le menu descend au calendrier à venir',
    await page.$eval('.m .when', (n) => n.textContent.trim().length > 0));

  /* Un match mène à sa fiche, qui vit sur la page des matchs : la recopier ici
     aurait fait deux fiches à corriger au lieu d'une. */
  await page.evaluate(() => document.querySelector('.m').click());
  await jusqua(async () => page.url().includes('/matchs'));
  check('un match mène à sa fiche', page.url().includes('/matchs?match=601'));
}


/* --------------------------------------------------------- la ferveur

   Le seul onglet qui parle du jeu et non du football. Trois choses s'y
   jouent, et aucune ne se lit dans le code :

     — la saison que le télétexte a retenue est **transmise** au classement ;
       sans elle, le serveur retomberait sur la plus récente qu'il connaisse et
       la page afficherait une autre année que son propre titre ;
     — changer d'échelle ne **redemande rien** : les trois listes arrivent
       ensemble, et trois allers-retours pour trois onglets se sentiraient ;
     — la place du lecteur est dite même quand il n'est pas dans les cinquante
       premiers. C'est la seule ligne de la page qui parle de lui.            */

{
  await page.goto(base + '/teletext?ligue=207', { waitUntil: 'networkidle0' });
  await jusqua(async () => await page.$('#tabs') !== null);

  await page.evaluate(() => document.querySelector('[data-t=ferveur]').click());
  await jusqua(async () => await page.$('.chips.ech') !== null);

  check('la saison du télétexte part avec la demande', derniereRang?.saison === '2026');
  check('et la compétition aussi', derniereRang?.id === '207');

  const premier = await page.$eval('tbody tr td.club', (n) => n.textContent.trim());
  check('les supporters de la compétition sont classés', premier.startsWith('Momo'));
  check('avec le club qu’ils défendent', premier.includes('FC Sion'));
  check('et leur ferveur', await page.$eval('tbody tr td.pts', (n) => n.textContent.trim()) === '1000');

  const place = await page.$eval('.maplace', (n) => n.textContent.replace(/\s+/g, ' ').trim());
  check('la place du lecteur est dite', /6e sur 6/.test(place)
    || (console.log('        elle dit :', place), false));

  const avant = appelsRang;
  await page.evaluate(() => document.querySelector('[data-e=tribunes]').click());
  await jusqua(async () => (await page.$eval('thead', (n) => n.textContent)).includes('CLUB'));
  check('changer d’échelle ne redemande rien au serveur', appelsRang === avant);
  check('les tribunes sont classées sur leur moyenne',
    (await page.$eval('thead', (n) => n.textContent)).includes('MOYENNE'));

  await page.evaluate(() => document.querySelector('[data-e=kops]').click());
  await jusqua(async () => (await page.$eval('thead', (n) => n.textContent)).includes('KOP'));
  check('et les KOP ont la leur',
    (await page.$eval('tbody tr td.club', (n) => n.textContent)).includes('Les Fidèles'));

  /* Une compétition où personne n'a encore poussé : une phrase, pas un vide.
     Un tableau vide se lit comme une panne. */
  ferveurVide = true;
  await page.evaluate(() => { echelle = 'joueurs'; charger(); });
  await jusqua(async () => await page.$('.empty') !== null);
  check('sans personne, la page le dit au lieu de rester vide',
    (await page.$eval('.empty', (n) => n.textContent)).includes('poussé'));
  ferveurVide = false;
}

check('aucune erreur de script sur la page des compétitions',
  erreurs.length === 0 || (console.log('    ', erreurs.join(' / ')), false));

console.log(`\n${failures ? `${failures} échec(s)` : 'tout est vert'}`);
await nav.close(); http.close();
process.exit(failures ? 1 : 0);
