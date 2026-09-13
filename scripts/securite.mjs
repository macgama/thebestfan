/**
 * L'audit de sécurité : les invariants qui doivent rester vrais.
 *
 * ## Ce qu'il vérifie, et pourquoi ceux-là
 *
 * Il ne cherche pas des failles — aucun script ne fait ça. Il vérifie que les
 * **décisions** déjà prises tiennent encore, parce que ce sont elles qui
 * protègent le jeu, et parce qu'elles se défont sans bruit : une requête
 * assemblée à la main un soir de hâte, un `requireAdmin` oublié sur une route
 * neuve, un identifiant lu dans le corps de la requête « juste pour ce cas-là ».
 *
 * ## La règle qui gouverne toutes les autres
 *
 * **Le serveur ne croit rien sur parole.** C'est la seule défense qui vaille
 * dans un jeu web, parce que le client appartient au joueur : il peut le lire,
 * le modifier, le remplacer par un script. Minifier, obscurcir, désactiver le
 * clic droit ne ralentissent que les curieux. La question n'est jamais
 * « comment cacher le code » mais « que se passe-t-il si le client ment ».
 *
 * Concrètement, trois choses ne doivent jamais venir du client :
 *   — **qui il est** (l'identité vient de la session) ;
 *   — **combien il a marqué** (les gestes sont notés côté serveur) ;
 *   — **combien coûte ce qu'il achète** (le prix vient du catalogue).
 *
 * Ce script éprouve les trois, et six autres choses.
 */
import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

let fautes = 0;
let alertes = 0;
const ko = (quoi) => { fautes++; console.log(` FAIL  ${quoi}`); };
const ok = (quoi) => console.log(`  ok   ${quoi}`);
const hmm = (quoi) => { alertes++; console.log(`  ⚠    ${quoi}`); };

/** Tous les fichiers `.js` du serveur, avec leur chemin. */
async function sourcesServeur(dossier = 'src/server', acc = []) {
  for (const e of await readdir(dossier, { withFileTypes: true })) {
    const p = path.join(dossier, e.name);
    if (e.isDirectory()) await sourcesServeur(p, acc);
    else if (e.name.endsWith('.js')) acc.push([p, await readFile(p, 'utf8')]);
  }
  return acc;
}

const SERVEUR = await sourcesServeur();
const serverJs = await readFile('server.js', 'utf8');
const tout = SERVEUR.map(([, c]) => c).join('\n') + serverJs;

console.log('\n— ce qui part au navigateur —\n');

/* 1. Aucun secret dans le dépôt. Un secret versionné est un secret public :
      l'historique de git le garde même effacé, et il faut alors le changer
      partout plutôt que le supprimer. */
{
  const gitignore = existsSync('.gitignore') ? await readFile('.gitignore', 'utf8') : '';
  check(/^\.env/m.test(gitignore) || gitignore.includes('.env*'),
    'les fichiers d’environnement sont hors du dépôt',
    '.gitignore n’écarte pas .env — un secret versionné reste dans l’historique');
}

/* 2. Aucune clé écrite en dur. Les vraies clés viennent de l'environnement ;
      une clé littérale dans le code part chez tous ceux qui clonent. */
{
  const durs = [];
  for (const [f, c] of SERVEUR) {
    for (const m of c.matchAll(/(sk_live_|whsec_[A-Za-z0-9]{10,}|AIza[0-9A-Za-z_-]{20,})/g)) {
      if (/process\.env/.test(c.slice(Math.max(0, m.index - 120), m.index))) continue;
      durs.push(`${f} : ${m[1].slice(0, 12)}…`);
    }
  }
  check(durs.length === 0, 'aucune clé secrète n’est écrite en dur',
    'clé(s) en dur : ' + durs.join(', '));
}

console.log('\n— ce que le serveur refuse de croire —\n');

/* 3. L'identité ne vient jamais du client. C'est l'invariant le plus important
      du lot : s'il tombe, un joueur agit au nom d'un autre. */
{
  const suspects = [];
  for (const [f, c] of SERVEUR) {
    for (const m of c.matchAll(/req\.(body|query|params)\??\.(userId|user_id|publicId)\b/g)) {
      suspects.push(`${f} : req.${m[1]}.${m[2]}`);
    }
  }
  check(suspects.length === 0,
    'l’identité du joueur vient de la session, jamais de sa requête',
    'lue dans la requête : ' + suspects.join(', '));
}

/* 4. Le score ne vient jamais du client. Les gestes partent bruts — les
      instants des touchers, le tracé — et c'est le serveur qui note. Un
      handler qui accepterait un score tout fait rendrait le jeu inutile. */
{
  const suspects = [];
  for (const [f, c] of SERVEUR) {
    for (const m of c.matchAll(/\b(?:const|let)\s*\{[^}]*\b(score|points|note|poussee|push)\b[^}]*\}\s*=\s*(?:p|payload|req\.body)\b/g)) {
      suspects.push(`${f} : ${m[1]}`);
    }
  }
  check(suspects.length === 0,
    'la note d’un geste est calculée par le serveur, jamais reçue',
    'reçue du client : ' + suspects.join(', '));
}

/* 5. Tout le SQL est paramétré. Une seule interpolation suffit à ouvrir la
      base : c'est la faille la plus ancienne du métier, et la plus coûteuse. */
{
  const bruts = [];
  const relues = [];
  for (const [f, c] of SERVEUR) {
    for (const m of c.matchAll(/\.(?:query|execute)\(\s*`[^`]*\$\{/g)) {
      /* Une interpolation **relue et justifiée** porte le marqueur `sql-sur`
         dans le commentaire qui la précède. On l'accepte, mais on la compte et
         on la dit : une exception qu'on voit peut être remise en cause, une
         exception qu'on a fait taire est une exception qu'on a oubliée.

         L'alternative aurait été d'affiner l'expression jusqu'à ne plus voir ce
         cas-là — et le jour où quelqu'un écrira une interpolation vraiment
         dangereuse sous une forme voisine, elle passerait avec elle. */
      const avant = c.slice(Math.max(0, m.index - 600), m.index);
      if (/sql-sur\s*:/.test(avant)) { relues.push(f); continue; }
      bruts.push(f);
    }
  }
  check(bruts.length === 0, 'chaque requête SQL est paramétrée'
    + (relues.length ? ` (${relues.length} interpolation relue et justifiée)` : ''),
  'interpolation non justifiée : ' + [...new Set(bruts)].join(', '));
}

/* 6. Ni `eval` ni `new Function` côté serveur. Ils transforment une donnée en
      code, ce qui est précisément ce qu'on passe la journée à empêcher. */
{
  const mauvais = SERVEUR
    .filter(([, c]) => /\beval\s*\(|new\s+Function\s*\(/.test(c))
    .map(([f]) => f);
  check(mauvais.length === 0, 'le serveur n’exécute jamais une chaîne comme du code',
    'eval / new Function dans : ' + mauvais.join(', '));
}

console.log('\n— les portes —\n');

/* 7. Les en-têtes de sécurité. Sans eux, un site tiers nous affiche dans un
      cadre invisible et récolte les clics de nos joueurs connectés. */
for (const [entete, pourquoi] of [
  ['X-Frame-Options', 'un site tiers pourrait nous afficher dans un cadre invisible'],
  ['X-Content-Type-Options', 'un fichier servi comme image pourrait s’exécuter comme script'],
  ['Content-Security-Policy', 'rien ne limiterait ce qu’un script injecté peut faire'],
  ['Referrer-Policy', 'nos adresses fuiteraient dans les journaux des sites tiers'],
]) {
  check(tout.includes(entete), `l’en-tête ${entete} est posé`,
    `${entete} manque : ${pourquoi}`);
}

/* 8. Le cookie de session. `httpOnly` le met hors de portée de tout script —
      c'est ce qui fait qu'un script injecté ne peut pas voler la session. */
{
  const auth = await readFile('src/server/auth/routes.js', 'utf8');
  check(/httpOnly:\s*true/.test(auth), 'le cookie de session est httpOnly',
    'sans httpOnly, un script peut lire la session');
  check(/sameSite:/.test(auth), 'le cookie de session porte une politique sameSite',
    'sans sameSite, un site tiers peut faire agir le joueur à son insu');
}

/* 9. Les mots de passe et les jetons ne sont pas stockés en clair. */
{
  const mdp = await readFile('src/server/auth/password.js', 'utf8');
  check(/scrypt|argon2|bcrypt/.test(mdp),
    'les mots de passe passent par une fonction de dérivation lente',
    'un condensat rapide (sha, md5) se casse par force brute');

  const store = await readFile('src/server/auth/store.js', 'utf8');
  check(/token_hash/.test(store),
    'les jetons de session sont stockés hachés',
    'une base lue donnerait des sessions utilisables telles quelles');
}

/* 10. Les cadences. Les sockets étaient bridées avant les routes HTTP ; les
       deux doivent l'être, parce que l'une sans l'autre laisse la porte
       ouverte du côté qu'on ne surveille pas. */
check(/rate_limited/.test(tout), 'les événements de jeu sont bridés',
  'aucune limite de cadence sur les sockets');
check(/debitMaximal|429/.test(tout), 'les routes HTTP ont un débit maximal',
  'aucune limite : un script peut appeler mille fois par seconde');

/* 11. L'administration est fermée. Une route d'administration montée sans son
       garde ouvre la base à n'importe quel joueur connecté. */
{
  const admin = await readFile('src/server/admin/index.js', 'utf8');
  const iGarde = admin.indexOf('router.use(requireAdmin)');
  check(iGarde > 0, 'l’administration est derrière requireAdmin',
    'aucun router.use(requireAdmin) : les routes sont ouvertes');

  /* Et il doit venir **avant** les routes : monté après, il ne garde rien de
     ce qui le précède. Seule `/suis-je` est légitimement au-dessus — elle
     répond « es-tu administrateur ? » à tout connecté, et c'est ce qui permet
     à l'accueil de cacher l'entrée. */
  if (iGarde > 0) {
    const avant = admin.slice(0, iGarde).match(/router\.(get|post|put|patch|delete)\(/g) ?? [];
    check(avant.length <= 1,
      'aucune route d’administration n’est déclarée avant son garde',
      `${avant.length} routes déclarées avant requireAdmin — elles ne sont pas gardées`);
  }
}

function check(vrai, siOui, siNon) {
  if (vrai) ok(siOui); else ko(siNon);
}

/* ------------------------------------------- ce qu'on ne peut pas contrôler */

console.log('\n— ce qui ne se contrôle pas ici —\n');
hmm('Le code envoyé au navigateur est **lisible par tout le monde**, et il n’y a '
  + 'rien à y faire : c’est la nature du web.');
console.log('       Ce n’est pas une faille tant qu’il ne contient ni secret ni décision.');
hmm('Les accès à la base sont ceux du fichier d’environnement du serveur.');
console.log('       Aucun contrôle d’ici ne peut dire si ce mot de passe est fort, ni qui '
  + 'le connaît.');

console.log(fautes
  ? `\n${fautes} invariant(s) rompu(s)`
  : `\ntout est vert (${alertes} point(s) d’attention, par nature)`);
process.exit(fautes ? 1 : 0);
