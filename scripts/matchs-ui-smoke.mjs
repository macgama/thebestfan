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

const app = express();
app.get('/api/tt/jour', (_q, s) => s.json(jour()));
app.get('/api/tt/match/:id', (_q, s) => s.json(match()));
// Le joueur suit le club qui reçoit : c'est ce qui décide si le personnage
// exulte ou encaisse.
app.get('/api/football/follows', (_q, s) => s.json({ teams: [{ id: 11, name: 'Garudayaksa' }] }));
app.get('/api/fanzzy/state', (_q, s) => s.json({
  wallet: { active: 'G1', scarves: 0, packs: 0 }, stades: {}, collection: { G1: 1 },
}));
app.get('/api/auth/me', (_q, s) => s.json({ user: { pseudo: 'Momo' } }));
app.get('/matchs', (_q, s) => s.sendFile(path.join(RACINE, 'public', 'aujourdhui.html')));
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
  await jusqua(async () => await page.evaluate(() =>
    document.querySelector('.tbf-moment')?.classList.contains('on') ?? false));

  const moment = await page.evaluate(() => ({
    titre: document.querySelector('.tbf-moment b')?.textContent.trim() ?? '',
    sous: document.querySelector('.tbf-moment small')?.textContent.trim() ?? '',
    couleur: document.querySelector('.tbf-moment')?.style.getPropertyValue('--mc').trim() ?? '',
    etat: FICHE.scene?.etat?.() ?? null,
    score: document.querySelector('#fcorps .sc .n')?.textContent.trim() ?? '',
  }));
  check('un but de ton club le fait exulter', moment.etat === 'but');
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
  await jusqua(async () => /ENCAISSE/.test(await page.evaluate(() =>
    document.querySelector('.tbf-moment b')?.textContent ?? '')));
  check('un but d’en face le fait encaisser',
    await page.evaluate(() => FICHE.scene?.etat?.()) === 'encaisse');

  /* Le coup de sifflet final, une fois. La fiche est relue toutes les trente
     secondes : revoir la défaite à chaque relecture serait insupportable. */
  etat = { ...etat, status: 'FT', live: false, fini: true };
  await page.evaluate(() => relire());
  await jusqua(async () => /DÉFAITE/.test(await page.evaluate(() =>
    document.querySelector('.tbf-moment b')?.textContent ?? '')));
  check('le coup de sifflet final annonce le résultat',
    await page.evaluate(() => FICHE.scene?.etat?.()) === 'defaite');

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

if (process.env.CAPTURE) {
  const { tmpdir } = await import('node:os');
  await page.screenshot({ path: path.join(tmpdir(), 'fiche-match.png') });
}
check('aucune erreur de script sur la page des matchs',
  erreurs.length === 0 || (console.log('    ', erreurs.join(' / ')), false));

console.log(`\n${failures ? `${failures} échec(s)` : 'tout est vert'}`);
await nav.close(); http.close();
process.exit(failures ? 1 : 0);
