/**
 * Les promesses des pages : chaque adresse appelée existe-t-elle ?
 *
 * ## Pourquoi ce contrôle
 *
 * Une page qui appelle une route absente ne casse pas : elle reçoit un 404,
 * son `catch` l'avale, et l'écran s'affiche simplement sans la chose qu'il
 * devait montrer. Personne ne le voit, surtout pas en relisant un diff.
 *
 * On l'a déjà payé ici : l'écran d'administration proposait une clé `annonce`
 * « qui affiche un bandeau pour tous les joueurs », et rien, nulle part, ne la
 * lisait. On pouvait l'écrire, la relire, la voir listée — et il ne se passait
 * rien. Ce n'était pas un bug, c'était une promesse sans destinataire, et
 * aucune suite ne pouvait la trouver puisque tout fonctionnait.
 *
 * Ce script croise donc **ce que les pages appellent** avec **ce que le serveur
 * monte**. Il ne lance rien : il lit. C'est ce qui lui permet de couvrir les
 * vingt pages d'un coup, y compris les neuf qui n'ont aucune suite d'interface.
 *
 * ## Ce qu'il ne peut pas dire
 *
 * Qu'une route fait ce qu'elle promet. Il dit qu'elle existe, et c'est déjà la
 * moitié des pannes silencieuses. L'autre moitié demande une suite.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

let fautes = 0;
const ko = (ou, quoi) => { fautes++; console.log(` FAIL  ${ou} — ${quoi}`); };
const ok = (quoi) => console.log(`  ok   ${quoi}`);

/* ------------------------------------------------- ce que le serveur monte

   Les préfixes viennent de `server.js` (`app.use('/api/x', …)`), les routes de
   chaque routeur (`router.get('/y', …)`). On assemble les deux pour obtenir la
   liste réelle. Lire `server.js` seul donnerait les préfixes sans les routes ;
   lire les routeurs seuls donnerait des chemins sans leur préfixe. */

const serveur = await readFile('server.js', 'utf8');

/** Les montages : préfixe → nom du module, tels qu'écrits dans server.js. */
const MONTAGES = [];
for (const m of serveur.matchAll(/app\.use\(\s*['"`](\/api\/[^'"`]*)['"`]\s*,\s*([\w.]+)/g)) {
  MONTAGES.push({ prefixe: m[1], porteur: m[2] });
}

/** Les routes servies directement par server.js, sans routeur. */
const DIRECTES = new Set();
for (const m of serveur.matchAll(/app\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g)) {
  DIRECTES.add(m[2]);
}

/* Chaque module de `src/server` déclare ses routes sur un `router`. On les
   ramasse toutes, sans chercher à savoir lequel est monté où : un même chemin
   déclaré dans deux modules serait de toute façon servi par le premier monté,
   et ce n'est pas ce qu'on éprouve ici. */
const ROUTES_MODULES = new Set();
async function ramasser(dossier) {
  for (const e of await readdir(dossier, { withFileTypes: true })) {
    const p = path.join(dossier, e.name);
    if (e.isDirectory()) { await ramasser(p); continue; }
    if (!e.name.endsWith('.js')) continue;
    const code = await readFile(p, 'utf8');
    for (const m of code.matchAll(/router\.(get|post|put|patch|delete|use)\(\s*['"`]([^'"`]+)['"`]/g)) {
      ROUTES_MODULES.add(m[2]);
    }
  }
}
await ramasser('src/server');

/**
 * Une adresse est-elle servie ?
 *
 * On compare en **segments** et non en texte : `/api/deck/mien` doit
 * reconnaître `router.put('/mien')` monté sur `/api/deck`, et `/api/fanzzy/12`
 * doit reconnaître `router.get('/:id')`. Une comparaison littérale manquerait
 * toutes les routes paramétrées, et le contrôle crierait au loup sur la moitié
 * du jeu.
 */
function servie(adresse) {
  const chemin = adresse.split('?')[0].replace(/\/+$/, '') || '/';
  if (DIRECTES.has(chemin)) return true;
  for (const d of DIRECTES) if (correspond(d, chemin)) return true;

  for (const { prefixe } of MONTAGES) {
    if (!chemin.startsWith(prefixe)) continue;
    const reste = chemin.slice(prefixe.length) || '/';
    for (const r of ROUTES_MODULES) if (correspond(r, reste)) return true;
  }
  return false;
}

/** Compare deux chemins segment par segment, `:param` valant n'importe quoi. */
function correspond(motif, chemin) {
  const a = motif.split('/').filter(Boolean);
  const b = chemin.split('/').filter(Boolean);
  if (a.length !== b.length) return false;
  return a.every((seg, i) => seg.startsWith(':') || seg === b[i]);
}

/* ------------------------------------------------- ce que les pages appellent

   On ne suit que les adresses **écrites en clair**. Une adresse assemblée à
   l'exécution — `'/api/' + module + '/etat'` — n'est pas lisible ici, et
   prétendre la deviner donnerait des faux positifs, qui sont pires que rien :
   on finit par ne plus lire le rapport. */

const pages = (await readdir('public')).filter((f) => f.endsWith('.html'));
const scripts = (await readdir('public')).filter((f) => f.endsWith('.js'));

const APPELS = new Map();          // adresse → pages qui l'appellent

for (const nom of [...pages, ...scripts].sort()) {
  const code = await readFile(path.join('public', nom), 'utf8');
  for (const m of code.matchAll(/['"`](\/api\/[a-zA-Z0-9/_:-]+)(?:\?[^'"`]*)?['"`]/g)) {
    const a = m[1];
    if (!APPELS.has(a)) APPELS.set(a, new Set());
    APPELS.get(a).add(nom);
  }
}

console.log(`\n${APPELS.size} adresse(s) appelée(s) depuis ${pages.length} page(s) `
  + `et ${scripts.length} script(s).\n`);

for (const [adresse, ou] of [...APPELS].sort()) {
  if (servie(adresse)) continue;
  ko([...ou].join(', '), `appelle « ${adresse} », que le serveur ne monte pas`);
}

if (!fautes) ok('chaque adresse appelée par une page est servie par le serveur');

/* ------------------------------------- l'inverse : les pages qu'on ne sert pas

   Une page dans `public/` que `server.js` n'expose pas n'est pas forcément une
   faute — `fanzzy-fiche.html` est servie sous `/fanzzy/:id`. Mais une page
   qu'on a oublié de router est invisible, et rien ne le signale : on la trouve
   des mois plus tard en se demandant pourquoi le lien ne marche pas. */

const SERVIES_A_PART = new Set(['fanzzy-fiche.html', 'aujourdhui.html']);
const servies = new Set();
for (const m of serveur.matchAll(/sendFile\([^)]*'(?:public\/)?([\w-]+\.html)'/g)) {
  servies.add(m[1]);
}
for (const m of serveur.matchAll(/sendFile\(path\.join\(__dirname, 'public', '([\w-]+\.html)'\)\)/g)) {
  servies.add(m[1]);
}

const orphelines = pages.filter((p) => !servies.has(p) && !SERVIES_A_PART.has(p));
if (orphelines.length) {
  ko('public/', `${orphelines.join(', ')} : aucune route ne les sert`);
} else {
  ok('chaque page de public/ est servie par une route, ou l’est volontairement à part');
}

/* --------------------------------------- les pages sans suite d'interface

   Ce n'est pas une faute, c'est une **dette**, et elle mérite d'être dite à
   chaque exécution plutôt que découverte en cherchant pourquoi une régression
   est passée. On la compte, on la nomme, et on ne fait pas échouer le script :
   un avertissement qui fait rougir devient un avertissement qu'on désactive. */

const suites = (await readdir('scripts')).filter((f) => f.endsWith('-ui-smoke.mjs'));
const chargees = new Set();
for (const f of suites) {
  const code = await readFile(path.join('scripts', f), 'utf8');
  for (const m of code.matchAll(/base\s*\}?\s*\+?\s*['"`](\/[a-z-]*)['"`]/g)) chargees.add(m[1]);
  for (const m of code.matchAll(/\$\{base\}(\/[a-z-]*)/g)) chargees.add(m[1]);
}

const CHEMIN = {
  'index.html': '/', 'aujourdhui.html': '/matchs', 'fanzzy-fiche.html': '/fanzzy/:id',
};
const sansSuite = pages.filter((p) => {
  const c = CHEMIN[p] ?? '/' + p.replace('.html', '');
  return !chargees.has(c);
});

console.log('');
if (sansSuite.length) {
  console.log(`  ⚠   ${sansSuite.length} page(s) sans suite d’interface : `
    + sansSuite.map((p) => p.replace('.html', '')).join(', '));
  console.log('      Elles compilent et leurs adresses existent — personne ne vérifie '
    + 'qu’elles affichent quoi que ce soit.');
} else {
  ok('chaque page a une suite d’interface');
}

/* ------------------------------------------- une suite que personne ne lance

   Quatre suites de ce dépôt étaient dans **aucun script npm**. Elles ne se
   lançaient donc que si quelqu'un tapait leur chemin de mémoire, ce que
   personne ne fait — et elles avaient dérivé en silence pendant des semaines :

   — `fanzzy-smoke` tirait dans VIRAGE NORD et NUITS EUROPÉENNES, dissoutes
     depuis. Elle levait au premier booster ;
   — `nvn-net-smoke` chantait en choisissant son geste, ce que le duel refuse
     depuis qu'il a reçu le répertoire du Virage. Sept contrôles tombaient.

   Une suite qu'on ne lance jamais ne protège de rien, et pire : elle donne
   l'impression que la chose est couverte. C'est l'exact équivalent, pour les
   tests, de la promesse sans destinataire que ce script traque par ailleurs. */
{
  const pkg = JSON.parse(await readFile('package.json', 'utf8'));
  const lances = JSON.stringify(pkg.scripts ?? {});
  /* Seules les suites. Les chaînes de production — les images, le manifeste, la
     veille, le déploiement — se lancent à la main par nature, et exiger un
     script pour chacune ferait du bruit sans rien défendre. */
  const orphelines = (await readdir('scripts'))
    .filter((f) => /-smoke\.mjs$/.test(f))
    .filter((f) => !lances.includes(f));

  if (orphelines.length) {
    ko('package.json', `${orphelines.length} suite(s) dans aucun script npm : `
      + `${orphelines.join(', ')}. Personne ne les lance, donc elles dérivent — `
      + 'et une suite qui ne tourne jamais fait croire que la chose est couverte.');
  } else {
    ok('chaque suite est lançable par npm');
  }
}

console.log(fautes ? `\n${fautes} promesse(s) non tenue(s)` : '\ntout est vert');
process.exit(fautes ? 1 : 0);
