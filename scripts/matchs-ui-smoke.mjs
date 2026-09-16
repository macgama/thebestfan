/**
 * Test de la page /matchs et de la fiche d'un match.
 *
 * Cette page n'en avait aucun, et c'est elle qu'on regarde le plus longtemps —
 * un match en direct se suit pendant deux heures. Trois choses s'y jouent, et
 * aucune ne se lit dans le code :
 *
 *   1. **La minute court.** Le serveur ne parle pas toutes les minutes : il
 *      relève le direct toutes les vingt secondes et garde sa réponse en cache.
 *      Afficher `elapsed` tel quel, c'est un chrono qui saute ou qui se fige.
 *      On le fait donc courir localement — et il faut le voir avancer.
 *
 *   2. **La fiche se relit.** Ouverte sur un match en cours, elle affichait le
 *      score de l'instant où on l'avait ouverte, pour aussi longtemps qu'on la
 *      regardait. C'est l'écran où l'on reste.
 *
 *   3. **On peut en sortir vers le jeu.** Le Grand Virage et le duel existent
 *      pour vivre ce match-là ; aucun chemin n'y menait depuis la fiche.
 *
 * Le serveur est un talon : les vraies routes sont éprouvées par
 * `teletext-smoke`. Ce qu'on veut ici, c'est ce que la page **fait** de la
 * réponse — et un talon permet de faire avancer le temps, ce que l'API ne
 * permet pas.
 *
 * Avant de lancer :  npm install --no-save puppeteer
 */
import { readFileSync } from 'node:fs';
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

/* ------------------------------------------------------------- le talon

   Un match en cours à la dix-neuvième minute, **vu il y a deux minutes**.
   C'est tout l'enjeu : la page doit afficher 21′, pas 19′. Le décalage est
   écrit ici, en clair, parce que c'est lui qu'on éprouve. */

const VU_IL_Y_A_MIN = 2;
const MATCH = 8801;
let etat = {
  status: '2H', elapsed: 19, extra: null,
  home: 0, away: 1, live: true, fini: false,
  evenements: [],
};
const luA = () => Date.now() - VU_IL_Y_A_MIN * 60_000;

const jour = () => ({
  date: new Date().toISOString().slice(0, 10),
  total: 1, enDirect: etat.live ? 1 : 0, stale: false,
  groupes: [{
    ligue: { id: 274, name: 'Liga 1', country: 'Indonesia' },
    mien: true, live: etat.live,
    matchs: [{
      id: MATCH, date: new Date(Date.now() - 25 * 60_000).toISOString(),
      status: etat.status, elapsed: etat.elapsed, extra: etat.extra, luA: luA(),
      home: { id: 11, name: 'Garudayaksa', logo: '', goals: etat.home },
      away: { id: 22, name: 'Persik Kediri', logo: '', goals: etat.away },
      live: etat.live, fini: etat.fini, mien: true,
    }],
  }],
});

const match = () => ({
  fixture: {
    id: MATCH, date: new Date(Date.now() - 25 * 60_000).toISOString(),
    status: etat.status, statusLong: 'Second Half',
    elapsed: etat.elapsed, extra: etat.extra, luA: luA(),
    venue: 'Pakansari Stadium', ville: 'Cibinong', arbitre: 'Untel',
    live: etat.live, fini: etat.fini,
  },
  ligue: { id: 274, nom: 'Liga 1', pays: 'Indonesia', journee: 'Regular Season - 2' },
  equipes: {
    home: { id: 11, name: 'Garudayaksa', logo: '', goals: etat.home, couleur: '#0B1E5B' },
    away: { id: 22, name: 'Persik Kediri', logo: '', goals: etat.away, couleur: null },
  },
  evenements: etat.evenements,
  statistiques: [], compositions: null, stale: false,
});

/**
 * Un Fanzzy qui a **vraiment ses états**, lu sur le manifeste.
 *
 * La suite nommait `G1` en dur. Ce dessin est parti — il montrait un autre
 * personnage — et trois contrôles sont devenus rouges en annonçant que le
 * Fanzzy n'exultait plus, alors qu'il n'avait simplement plus d'image de but.
 *
 * On demande donc au manifeste qui sait faire « but », « encaisse » et
 * « victoire » : ce sont les trois états que ces contrôles éprouvent.
 */
const MANIF = JSON.parse(readFileSync(path.join(RACINE, 'public', 'img', 'fanzzy',
  'index.json'), 'utf8')).fanzzy ?? {};
const AVEC_ETATS = Object.entries(MANIF).find(([, m]) =>
  ['but', 'encaisse', 'victoire'].every((e) =>
    m.evolutions?.e1?.skins?.base?.etats?.includes(e)))?.[0];
if (!AVEC_ETATS) throw new Error(
  'aucun Fanzzy n’a ses états de but : la suite ne peut pas éprouver la scène.');

/**
 * La scène **traverse** un état, elle ne s'y installe pas.
 *
 * Les trois contrôles lisaient `etat()` après l'apparition du bandeau. Ils ne
 * passaient que parce que le Fanzzy d'essai n'avait aucune image d'état :
 * sans rien à jouer, la scène restait sur l'état logique indéfiniment. Avec
 * un Fanzzy réellement dessiné, elle joue son but et revient au repos — en
 * quelques centaines de millisecondes, soit bien avant qu'on regarde.
 *
 * On **attend** l'état au lieu de le lire : c'est « il est passé par là »,
 * qui est la vraie promesse. Un but fait tressaillir le personnage, il ne le
 * fige pas.
 */
const passePar = (e) => jusqua(async () =>
  await page.evaluate(() => FICHE?.scene?.etat?.() ?? null) === e, 4000);
const app = express();
app.get('/api/tt/jour', (_q, s) => s.json(jour()));
app.get('/api/tt/match/:id', (_q, s) => s.json(match()));
// Le joueur suit le club qui reçoit : c'est ce qui décide si le personnage
// exulte ou encaisse.
app.get('/api/football/follows', (_q, s) => s.json({ teams: [{ id: 11, name: 'Garudayaksa' }] }));
app.get('/api/fanzzy/state', (_q, s) => s.json({
  wallet: { active: AVEC_ETATS, scarves: 0, packs: 0 }, stades: {},
  collection: { [AVEC_ETATS]: 1 },
}));
/* Connecté par défaut : tout ce qui précède éprouve le joueur qui a une place.
   Le dernier bloc bascule ce drapeau pour éprouver celui qui n'en a pas. */
let connecte = true;
app.get('/api/auth/me', (_q, s) => (connecte
  ? s.json({ user: { pseudo: 'Momo' } })
  : s.status(401).json({ error: 'auth.required' })));
app.get('/matchs', (_q, s) => s.sendFile(path.join(RACINE, 'public', 'aujourdhui.html')));
/* Les trois destinations qu'on peut atteindre depuis la fiche. Des talons : on
   éprouve **où l'on arrive**, pas ce qu'on y trouve. */
for (const ou of ['/virage', '/duel-nvn', '/compte']) {
  app.get(ou, (_q, s) => s.type('html').send('<h1>' + ou + '</h1>'));
}
app.use(express.static(path.join(RACINE, 'public')));

const http = createServer(app);
await new Promise((r) => http.listen(0, r));
const base = `http://localhost:${http.address().port}`;

const nav = await puppeteer.launch({ args: ['--no-sandbox'] });
const erreurs = [];
const page = await nav.newPage();
page.on('pageerror', (e) => erreurs.push(e.message));
await page.setViewport({ width: 400, height: 880 });
await page.goto(base + '/matchs', { waitUntil: 'networkidle0' });
await jusqua(async () => await page.$('.liste .m') !== null);

check('la page se charge sans erreur de script', erreurs.length === 0);
if (erreurs.length) console.log('   ', erreurs.slice(0, 3));

/* ------------------------------------------------ la minute, dans la liste */

{
  const min = await page.$eval('.m .live', (n) => n.textContent.trim());
  /* Dix-neuf minutes relevées, vues il y a deux minutes : vingt et une. Si la
     page affichait 19′, elle afficherait la minute du serveur — c'est-à-dire
     une minute fausse dès la vingtième seconde. */
  check('la minute court depuis le relevé, pas depuis l’affichage',
    min === '21′' || (console.log('        elle dit :', min), false));

  // Le temps additionnel, et la mi-temps : deux règles que l'horloge partagée
  // porte et que cette page employait à sa façon.
  etat = { ...etat, status: 'HT', elapsed: 45 };
  await page.evaluate(() => charger());
  await jusqua(async () => (await page.$eval('.m .live', (n) => n.textContent.trim())) === 'MT');
  check('à la mi-temps, elle dit MT', true);

  etat = { ...etat, status: '2H', elapsed: 90, extra: 3 };
  await page.evaluate(() => charger());
  await jusqua(async () => /90\+3/.test(await page.$eval('.m .live', (n) => n.textContent.trim())));
  check('au-delà du terme, elle donne le temps additionnel',
    /90\+3/.test(await page.$eval('.m .live', (n) => n.textContent.trim())));

  etat = { ...etat, elapsed: 19, extra: null };
  await page.evaluate(() => charger());
  await dodo(200);
}

/* --------------------------------------------- la compétition, cliquable */

{
  const lien = await page.$eval('.ligue .t', (n) => n.getAttribute('href'));
  /* On regardait un match de Liga 1 sans pouvoir savoir qui mène le
     championnat, alors que la page existe. */
  check('le nom de la compétition mène à sa page',
    lien === '/teletext?ligue=274' || (console.log('        il mène à :', lien), false));
}

/* ------------------------------------------------------------- la fiche */

await page.evaluate(() => document.querySelector('.liste .m').click());
await jusqua(async () => await page.$('#fcorps .aff') !== null);

{
  const f = await page.evaluate(() => ({
    infos: document.querySelector('#fcorps .infos')?.textContent.replace(/\s+/g, ' ').trim() ?? '',
    etat: document.getElementById('fetat')?.textContent.trim() ?? '',
    allers: [...document.querySelectorAll('#fcorps .aller')]
      .map((a) => ({ texte: a.textContent.replace(/\s+/g, ' ').trim(), href: a.getAttribute('href'),
                     eteint: a.classList.contains('eteint') })),
    ligue: document.querySelector('#fcorps .aff .lg')?.getAttribute('href'),
    /* `FICHE` est un `const` de premier niveau d'un script classique : il se
       lit par son nom ici, mais **pas** sur `window` — les déclarations
       lexicales ne s'y attachent pas. Le premier essai cherchait
       `window.FICHE` et lisait `undefined`, ce qui rougissait quatre
       contrôles parfaitement satisfaits. */
    minuterie: Boolean(FICHE.minuterie),
    relecture: RELECTURE_MS,
  }));

  check('la fiche s’ouvre sur la minute courante',
    f.etat === '21′' || (console.log('        elle dit :', f.etat), false));

  /* La date **et l'heure**. L'heure n'était lisible qu'à la place du score, et
     elle disparaissait au coup d'envoi — or c'est elle qu'on cherche pour
     savoir si on a raté le début. */
  check('elle donne la date du match', /\d/.test(f.infos) && /(lun|mar|mer|jeu|ven|sam|dim)/i.test(f.infos));
  check('et son heure', /\d{2}:\d{2}/.test(f.infos)
    || (console.log('        elle dit :', f.infos), false));

  const virage = f.allers.find((a) => /VIRAGE/.test(a.texte));
  const duel = f.allers.find((a) => /DUEL/.test(a.texte));
  check('elle propose d’entrer dans le Grand Virage', Boolean(virage));
  check('et le bouton mène à **ce** match', virage?.href === `/virage?match=${MATCH}`
    || (console.log('        il mène à :', virage?.href), false));
  check('elle propose aussi le duel', duel?.href === '/duel-nvn');
  check('le nom de la compétition y mène aussi', f.ligue === '/teletext?ligue=274');

  /* Tant que le match est en cours, la fiche se relit toute seule. C'est ce
     qui manquait : elle affichait le score de l'instant où on l'avait ouverte,
     pour aussi longtemps qu'on la regardait. */
  check('et elle s’est programmé une relecture', f.minuterie);
  /* Et à la bonne cadence. Sans lire le délai, le contrôle ne verrait pas la
     différence entre trente secondes et huit heures — et « une minuterie
     existe » n'est pas ce qu'on veut promettre. */
  check('toutes les trente secondes', f.relecture === 30_000
    || (console.log('        toutes les', f.relecture, 'ms'), false));
}

/* --------------------------------------- le Fanzzy qui regarde le match */

{
  const monte = await page.evaluate(() =>
    Boolean(document.querySelector('#fwatch .tbf-scene')));
  check('le Fanzzy du joueur regarde le match avec lui', monte);

  /* Il ne réagit qu'à ce qui est **neuf** : ouvrir un match déjà commencé ne
     doit pas rejouer tous ses buts. */
  const auRepos = await page.evaluate(() =>
    document.querySelector('.tbf-moment')?.classList.contains('on') ?? false);
  check('et il ne rejoue pas ce qui est arrivé avant qu’on ouvre', !auRepos);

  // Un but du club suivi, tombé pendant qu'on regarde.
  etat = { ...etat, home: 1,
    evenements: [{ minute: 22, extra: null, equipe: 11, type: 'Goal',
      detail: 'Normal Goal', joueur: 'Diallo', passeur: null }] };
  await page.evaluate(() => relire());
  const vuBut = await passePar('but');
  await jusqua(async () => await page.evaluate(() =>
    document.querySelector('.tbf-moment')?.classList.contains('on') ?? false));

  const moment = await page.evaluate(() => ({
    titre: document.querySelector('.tbf-moment b')?.textContent.trim() ?? '',
    sous: document.querySelector('.tbf-moment small')?.textContent.trim() ?? '',
    couleur: document.querySelector('.tbf-moment')?.style.getPropertyValue('--mc').trim() ?? '',
    etat: FICHE.scene?.etat?.() ?? null,
    score: document.querySelector('#fcorps .sc .n')?.textContent.trim() ?? '',
  }));
  check('un but de ton club le fait exulter', moment.etat === 'but' || vuBut);
  check('et le bandeau dit GOAL !', /GOAL/.test(moment.titre));
  check('avec le buteur et la minute',
    /Diallo/.test(moment.sous) && /22/.test(moment.sous)
    || (console.log('        il dit :', moment.sous), false));
  /* Aux couleurs du club, comme sur l'accueil et dans le virage : la couleur
     du blason, éclaircie pour se lire sur le noir. */
  check('aux couleurs du club', /^#[0-9A-F]{6}$/i.test(moment.couleur)
    || (console.log('        il s’écrit en', moment.couleur), false));
  check('et le score de la fiche a suivi', moment.score === '1 – 1'
    || (console.log('        il dit :', moment.score), false));

  // Un but d'en face, maintenant.
  etat = { ...etat, away: 2,
    evenements: [...etat.evenements, { minute: 30, extra: null, equipe: 22, type: 'Goal',
      detail: 'Normal Goal', joueur: 'Keller', passeur: null }] };
  await page.evaluate(() => relire());
  const vuEncaisse = await passePar('encaisse');
  await jusqua(async () => /ENCAISSE/.test(await page.evaluate(() =>
    document.querySelector('.tbf-moment b')?.textContent ?? '')));
  check('un but d’en face le fait encaisser', vuEncaisse);

  /* Le coup de sifflet final, une fois. La fiche est relue toutes les trente
     secondes : revoir la défaite à chaque relecture serait insupportable. */
  etat = { ...etat, status: 'FT', live: false, fini: true };
  await page.evaluate(() => relire());
  const vuDefaite = await passePar('defaite');
  await jusqua(async () => /DÉFAITE/.test(await page.evaluate(() =>
    document.querySelector('.tbf-moment b')?.textContent ?? '')));
  check('le coup de sifflet final annonce le résultat', vuDefaite);

  await page.evaluate(() => { document.querySelector('.tbf-moment').classList.remove('on'); });
  await page.evaluate(() => relire());
  await dodo(300);
  check('et il ne le rejoue pas à la relecture suivante',
    !(await page.evaluate(() =>
      document.querySelector('.tbf-moment')?.classList.contains('on') ?? false)));

  /* Un match fini ne se relit plus : il ne bougera pas, et redemander toutes
     les trente secondes coûterait un appel par curieux jusqu'à la fin des
     temps. */
  check('un match terminé ne se relit plus',
    !(await page.evaluate(() => Boolean(FICHE.minuterie))));

  const virage = await page.evaluate(() => {
    const a = [...document.querySelectorAll('#fcorps .aller')].find((x) => /VIRAGE/.test(x.textContent));
    return { eteint: a?.classList.contains('eteint'), texte: a?.textContent ?? '' };
  });
  /* Éteint plutôt qu'absent : un bouton qui disparaît laisse croire qu'on a
     mal vu ; un bouton éteint qui dit pourquoi se comprend. */
  check('et le Grand Virage s’y éteint, en disant pourquoi',
    virage.eteint && /match/.test(virage.texte));
}

/* ------------------------------------------------ la page vue sans compte

   Depuis que la vitrine propose « tous les matchs », cette page est le premier
   écran du jeu qu'un visiteur sans compte puisse atteindre. Deux choses y
   changent, et aucune ne se lit dans le code :

     — **« mes clubs » ne paraît pas.** Un filtre qui ne peut rien filtrer est
       un bouton qui ment, et il ment à celui qui ne connaît pas encore le jeu.

     — **les deux portes restent visibles, mais ne s'ouvrent pas.** Ce sont les
       deux seules choses que ce jeu sait faire et qu'aucun autre écran public
       ne montre : les cacher ne proposerait rien à personne. Le geste est donc
       retenu, et remplacé par une invitation qui dit ce qu'il y a derrière.

   Le contrôle qui compte est le quatrième : que le visiteur **ne parte pas**.
   Sans lui, une invitation qui s'affiche pendant que la page change d'adresse
   passerait au vert sans rien empêcher.                                     */

{
  connecte = false;
  // Le bloc précédent a laissé le match terminé ; le Grand Virage s'éteint sur
  // un match fini, et un bouton éteint ne se clique pas.
  etat = { status: '2H', elapsed: 19, extra: null,
           home: 0, away: 1, live: true, fini: false, evenements: [] };

  await page.goto(base + '/matchs', { waitUntil: 'networkidle0' });
  await jusqua(async () => await page.$('.liste .m') !== null);
  await jusqua(async () => await page.evaluate(() =>
    document.getElementById('fMien')?.hidden === true));

  check('sans compte, le filtre « mes clubs » ne paraît pas',
    await page.evaluate(() => document.getElementById('fMien')?.hidden === true));
  check('et il reste les deux filtres qui savent répondre',
    await page.evaluate(() => [...document.querySelectorAll('.filtres button')]
      .filter((b) => !b.hidden).length === 2));

  await page.evaluate(() => document.querySelector('.liste .m').click());
  await jusqua(async () => await page.$('#fcorps .aller') !== null);

  check('mais les deux portes du jeu restent visibles',
    await page.evaluate(() => document.querySelectorAll('#fcorps .aller').length === 2));

  await page.evaluate(() => document.querySelector('[data-porte=virage]').click());
  await jusqua(async () => await page.$('.tbf-dial') !== null);

  const invite = await page.evaluate(() => ({
    titre: document.querySelector('.tbf-dial h3')?.textContent.trim() ?? '',
    texte: document.querySelector('.tbf-dial p')?.textContent.trim() ?? '',
    connexion: document.querySelector('.tbf-dial .deja a')?.getAttribute('href') ?? '',
  }));
  check('le Grand Virage n’ouvre pas, il invite',
    /VIRAGE/.test(invite.titre) || (console.log('        elle dit :', invite.titre), false));
  check('et l’invitation dit ce qu’il y a derrière la porte', invite.texte.length > 60);
  check('sans oublier ceux qui ont déjà une place', invite.connexion === '/compte');
  check('le visiteur, lui, n’est pas parti dans le virage', !page.url().includes('/virage'));

  await page.evaluate(() => document.querySelector('.tbf-dial-bt[data-non]').click());
  await jusqua(async () => await page.$('.tbf-dial') === null);

  await page.evaluate(() => document.querySelector('[data-porte=duel]').click());
  await jusqua(async () => await page.$('.tbf-dial') !== null);
  const titreDuel = await page.evaluate(() =>
    document.querySelector('.tbf-dial h3')?.textContent.trim() ?? '');
  check('le duel a sa propre invitation, pas celle du virage',
    titreDuel.length > 0 && !/VIRAGE/.test(titreDuel));
  check('et le visiteur n’est pas parti en duel non plus', !page.url().includes('/duel'));

  await page.evaluate(() => document.querySelector('.tbf-dial-bt[data-oui]').click());
  await jusqua(async () => page.url().includes('/compte'));
  check('« prendre ma place » mène au compte', page.url().includes('/compte'));

  /* On rend la page telle qu'on l'a trouvée : la capture d'écran et le dernier
     contrôle portent sur la page des matchs, pas sur celle du compte. */
  connecte = true;
  await page.goto(base + '/matchs', { waitUntil: 'networkidle0' });
  await jusqua(async () => await page.$('.liste .m') !== null);
}

if (process.env.CAPTURE) {
  const { tmpdir } = await import('node:os');
  await page.screenshot({ path: path.join(tmpdir(), 'fiche-match.png') });
}
check('aucune erreur de script sur la page des matchs',
  erreurs.length === 0 || (console.log('    ', erreurs.join(' / ')), false));

console.log(`\n${failures ? `${failures} échec(s)` : 'tout est vert'}`);
await nav.close(); http.close();
process.exit(failures ? 1 : 0);
