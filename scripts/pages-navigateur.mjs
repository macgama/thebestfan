/**
 * Chaque écran s'ouvre-t-il sans lever ?
 *
 * ## Le trou que ce contrôle bouche
 *
 * `verif-pages.mjs` vérifie que les pages **compilent** — c'est un contrôle de
 * texte, il ne les exécute pas. Les suites `*-ui-smoke` les exécutent, mais
 * elles montent un vrai serveur sur une vraie base : elles ne tournent que là où
 * MySQL est installé, c'est-à-dire pas sur une machine de développement fraîche
 * ni dans une intégration continue sans service.
 *
 * Entre les deux, rien ne disait si une page **s'ouvre**. Une `ReferenceError`
 * au premier rendu, un `null` déréférencé dans un gestionnaire, une carte dont
 * la famille manque : tout cela compile parfaitement et ne se voit qu'à l'œil,
 * écran par écran, ce que personne ne refait après chaque modification.
 *
 * ## Sans base, et c'est tout l'intérêt
 *
 * Le serveur démarre sans `DATABASE_URL` — il le sait faire, `/diagnostic` le
 * dit — et aucune route `/api` n'est alors montée. **Toutes** les requêtes des
 * pages échouent donc, et c'est précisément la situation qu'on veut éprouver :
 * une page doit se dégrader proprement quand le serveur ne répond pas, jamais
 * s'interrompre au milieu de son rendu. C'est la famille de défauts que la
 * revue de septembre a trouvée partout — une panne serveur déguisée en « il n'y
 * a rien », ou un écran figé sans issue.
 *
 * ## Ce qu'on compte comme faute, et ce qu'on ne compte pas
 *
 * **Faute** : une exception non rattrapée (`pageerror`) et un rejet de promesse
 * non tenu. Les deux arrêtent le rendu là où ils tombent, et aucun des deux ne
 * dépend de la base.
 *
 * **Pas une faute** : les erreurs de console dues aux requêtes qui échouent. Il
 * n'y a pas de serveur d'API : les compter ferait deux cents rouges qui ne
 * disent rien, et un contrôle qu'on apprend à ignorer ne sert plus à rien. On
 * les compte quand même, à part, pour que le nombre se lise.
 *
 * Usage :  node scripts/pages-navigateur.mjs
 *          node scripts/pages-navigateur.mjs --images   (captures dans le temp)
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import puppeteer from 'puppeteer';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const IMAGES = process.argv.includes('--images');

let fautes = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) fautes += 1; };

/* Les écrans, tels que `server.js` les monte. Écrits ici plutôt que relus :
   une liste tirée du fichier qu'elle contrôle serait d'accord avec lui par
   construction, et ne verrait pas une route disparue. */
const ECRANS = [
  '/', '/matchs', '/teletext', '/bienvenue', '/profil', '/collection',
  '/classement', '/boutique', '/abonnement', '/boosters', '/admin',
  '/compte', '/diagnostic', '/equipes', '/kop', '/amis', '/deck',
  '/duel-nvn', '/fanzzy', '/fanzzy/TR32', '/virage', '/carnet', '/aide',
  '/repetition', '/confidentialite',
];

/* ------------------------------------------------------------- le serveur */

const PORT = 3977;
const base = `http://127.0.0.1:${PORT}`;

/* `DATABASE_URL` vidée explicitement : la machine qui lance ceci peut en avoir
   une dans son environnement, et le contrôle mesurerait alors autre chose
   d'une fois sur l'autre. */
const serveur = spawn(process.execPath, ['server.js'], {
  cwd: RACINE,
  env: { ...process.env, PORT: String(PORT), DATABASE_URL: '' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let journal = '';
serveur.stdout.on('data', (d) => { journal += d; });
serveur.stderr.on('data', (d) => { journal += d; });

const dors = (ms) => new Promise((r) => { setTimeout(r, ms); });

/** On attend qu'il réponde, plutôt que de dormir un temps deviné. */
async function attendreLeServeur() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const r = await fetch(`${base}/healthz`);
      if (r.ok) return true;
    } catch { /* pas encore là */ }
    await dors(250);
  }
  return false;
}

const debout = await attendreLeServeur();
check('le serveur démarre sans base', debout);
if (!debout) {
  console.log(journal.split('\n').slice(-12).join('\n'));
  serveur.kill();
  process.exit(1);
}

/* ------------------------------------------------------------ le navigateur */

const navigateur = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--accept-lang=fr-FR'],
});

const dossier = IMAGES ? await mkdtemp(path.join(tmpdir(), 'tbf-ecrans-')) : null;

console.log(`\n${ECRANS.length} écrans, dans un vrai navigateur, sans base.\n`);

const bilan = [];

for (const chemin of ECRANS) {
  const page = await navigateur.newPage();
  await page.setViewport({ width: 400, height: 880 });

  const leves = [];
  const rejets = [];
  let consoleErreurs = 0;

  /* La pile, et pas seulement le message. « Cannot read properties of
     undefined » sans l'endroit oblige à relire un fichier entier ; avec les
     trois premières lignes de pile, on sait où aller. */
  page.on('pageerror', (e) => leves.push(
    [e.message, ...String(e.stack ?? '').split('\n').slice(0, 4)]
      .filter((l, i, t) => l && t.indexOf(l) === i).join('\n            ')));
  page.on('console', (m) => { if (m.type() === 'error') consoleErreurs += 1; });
  /* Un rejet non tenu n'arrive pas par `pageerror` : le navigateur le signale
     sur `window`. C'est pourtant la moitié des fautes de ce dépôt — un `await`
     sur une promesse que personne ne rattrape. */
  await page.evaluateOnNewDocument(() => {
    window.__tbfRejets = [];
    window.addEventListener('unhandledrejection', (e) => {
      window.__tbfRejets.push(String(e.reason?.message ?? e.reason));
    });
  });

  try {
    await page.goto(base + chemin, { waitUntil: 'networkidle2', timeout: 20_000 });
    /* Une seconde de plus : la moitié du code de ce jeu tourne **après** le
       chargement — les promesses d'API qui retombent, les rendus différés, les
       observateurs de taille. C'est là que les fautes se produisent. */
    await dors(1200);
    rejets.push(...(await page.evaluate(() => window.__tbfRejets ?? [])));
  } catch (e) {
    leves.push(`navigation : ${e.message}`);
  }

  /* **Y a-t-il un moyen de revenir ?**
   *
   * Signalé par le propriétaire du jeu sur `/compte` : on y arrivait par le
   * tiroir — « Mon compte » — et l'on s'y retrouvait sans barre, sans titre et
   * sans flèche. Le seul chemin de sortie était le bouton du navigateur.
   *
   * La règle vaut pour tous les écrans sauf deux, et les deux exceptions sont
   * justifiées : l'accueil porte sa navigation dans ses deux rails, et la
   * cérémonie d'arrivée est un parcours qu'on ne quitte pas au milieu.
   *
   * On mesure la **présence** de la flèche et non sa destination : `nav.js`
   * décide d'aller en arrière ou de remonter au parent selon l'historique, et
   * ce contrôle-ci n'a pas à connaître cette règle-là.
   */
  const sortie = await page.$('.tbf-retour').catch(() => null);
  /* **L'adresse où l'on a vraiment atterri.** Sans base, le profil et
     l'administration renvoient vers la connexion : le contrôle mesurait alors
     `/compte` en croyant mesurer `/profil`, et rapportait trois écrans en faute
     là où il y en avait un. Une redirection doit se voir, pas se confondre avec
     la page qu'on avait demandée. */
  const arrivee = page.url().replace(base, '') || '/';

  if (dossier) {
    const nom = (chemin === '/' ? 'accueil' : chemin.slice(1).replace(/\//g, '-'));
    await page.screenshot({ path: path.join(dossier, `${nom}.png`), fullPage: false })
      .catch(() => {});
  }
  await page.close();

  bilan.push({ chemin, arrivee, leves, rejets, consoleErreurs, sortie: Boolean(sortie) });
}

await navigateur.close();
serveur.kill();

/* ---------------------------------------------------------------- le compte */

for (const b of bilan) {
  const casse = b.leves.length + b.rejets.length;
  const detail = `réseau : ${b.consoleErreurs} erreur(s) de console — attendu sans base`;
  check(`${b.chemin.padEnd(16)} s’ouvre sans lever   (${detail})`, casse === 0);
  for (const l of b.leves) console.log(`          ↳ exception : ${l}`);
  for (const r of b.rejets) console.log(`          ↳ rejet non tenu : ${r}`);
}

/* Les deux écrans qui se passent de flèche, et pourquoi — voir `SANS_BARRE`
   dans `nav.js`. La liste est écrite ici plutôt que relue : un contrôle qui
   tire sa référence du fichier qu'il contrôle est d'accord avec lui par
   construction, et laisserait passer un écran qu'on y aurait ajouté. */
const SANS_FLECHE = new Set(['/', '/bienvenue']);
console.log('\n— la sortie');
/* On juge sur l'écran **où l'on a atterri**, redirection comprise : c'est celui
   que le joueur a sous les yeux, et c'est de celui-là qu'il doit pouvoir
   sortir. */
const enferme = bilan.filter((b) => !SANS_FLECHE.has(b.arrivee) && !b.sortie);
check(enferme.length
  ? `${enferme.length} écran(s) sans aucun moyen de revenir : ${
    enferme.map((b) => (b.arrivee === b.chemin ? b.chemin : `${b.chemin} → ${b.arrivee}`)).join(', ')}`
  : 'chaque écran porte sa flèche de retour, sauf les deux qui s’en passent',
enferme.length === 0);

const redirigees = bilan.filter((b) => b.arrivee !== b.chemin);
if (redirigees.length) {
  console.log(`   (sans base, ${redirigees.length} écran(s) renvoient ailleurs : ${
    redirigees.map((b) => `${b.chemin} → ${b.arrivee}`).join(', ')})`);
}

if (dossier) console.log(`\n   captures : ${dossier}`);

console.log(fautes
  ? `\n${fautes} écran(s) en faute — ne pas livrer en l’état.`
  : '\nLes vingt-quatre écrans s’ouvrent sans lever, serveur muet compris.');
process.exit(fautes ? 1 : 0);
