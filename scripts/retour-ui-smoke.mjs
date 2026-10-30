/**
 * La flèche de retour ne sort jamais du jeu.
 *
 * Gaël, 30 octobre 2026 : « Lorsque je finis un duel et que je clique sur la
 * flèche pour retourner à la page d'accueil, je sors de l'application (soit
 * sur la page de connexion, soit une page d'erreur). » De temps en temps
 * seulement : selon ce qu'il y avait **derrière** le duel dans l'historique.
 *
 * La flèche faisait `history.back()` dès que le référent était « de chez
 * nous ». Mais le référent dit qui a ouvert la page, pas ce qu'il y a derrière.
 * Une notification touchée reprend la fenêtre ouverte et la mène au duel
 * (`sw.js`) : le référent est le service worker, derrière il y a la page où la
 * fenêtre dormait. Une page de connexion, ou d'erreur.
 *
 * Sans base, comme `pages-navigateur.mjs` : la règle est toute dans `nav.js`.
 *
 * Usage :  node scripts/retour-ui-smoke.mjs
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
let fautes = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) fautes += 1; };
const dors = (ms) => new Promise((r) => { setTimeout(r, ms); });

const PORT = 3981;
const base = `http://127.0.0.1:${PORT}`;
/* Une autre origine, qui ne répond pas : la page d'erreur du navigateur. */
const AILLEURS = 'http://127.0.0.1:3982/hors-ligne';

const serveur = spawn(process.execPath, ['server.js'], {
  cwd: RACINE,
  env: { ...process.env, PORT: String(PORT), DATABASE_URL: '' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let journal = '';
serveur.stdout.on('data', (d) => { journal += d; });
serveur.stderr.on('data', (d) => { journal += d; });

let debout = false;
for (let i = 0; i < 60 && !debout; i += 1) {
  try { debout = (await fetch(`${base}/healthz`)).ok; } catch { /* pas encore */ }
  if (!debout) await dors(250);
}
check('le serveur démarre sans base', debout);
if (!debout) {
  console.log(journal.split('\n').slice(-12).join('\n'));
  serveur.kill();
  process.exit(1);
}

const navigateur = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--accept-lang=fr-FR'],
});

/** Ouvre `etapes` dans le même onglet, la dernière avec `referer`, touche la
    flèche et rend l'adresse d'arrivée. */
async function apresLaFleche(etapes, referer) {
  const p = await navigateur.newPage();
  try {
    for (const [i, u] of etapes.entries()) {
      const dernier = i === etapes.length - 1;
      await p.goto(u.startsWith('http') ? u : base + u, {
        waitUntil: 'domcontentloaded', timeout: 15000,
        ...(dernier && referer ? { referer } : {}),
      }).catch(() => null);
    }
    await p.waitForSelector('.tbf-retour', { timeout: 10000 });
    await dors(300);
    await Promise.all([
      p.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => null),
      p.evaluate(() => document.querySelector('.tbf-retour').click()),
    ]);
    await dors(300);
    const u = new URL(p.url());
    return u.origin === base ? u.pathname + u.search : p.url();
  } finally {
    await p.close();
  }
}

const aNav = await (async () => {
  const p = await navigateur.newPage();
  await p.goto(base + '/aide', { waitUntil: 'domcontentloaded' });
  const ok = await p.evaluate(() => typeof window.navigation?.entries === 'function');
  await p.close();
  return ok;
})();
check('ce navigateur connaît l’API Navigation', aNav);

const cas = [
  ['depuis l’accueil, le duel y revient', ['/', '/duel-nvn'], null, '/'],
  ['derrière le duel, la connexion : on rentre à l’accueil', ['/compte', '/duel-nvn'], null, '/'],
  ['ouvert par une notification sur la connexion : accueil',
    ['/compte', '/duel-nvn?duel=ABCD'], `${base}/sw.js`, '/'],
  ['ouvert par une notification sur une page d’erreur : accueil',
    [AILLEURS, '/duel-nvn'], `${base}/sw.js`, '/'],
  ['un duel ouvert sur un autre duel ne ramène pas au vestiaire d’hier',
    ['/', '/duel-nvn', '/duel-nvn?duel=ABCD'], null, '/'],
  ['le Virage derrière l’inscription rentre à l’accueil', ['/bienvenue', '/virage'], null, '/'],
  ['ailleurs, la flèche revient toujours d’où l’on vient', ['/classement', '/aide'], null, '/classement'],
];

for (const [nom, etapes, referer, attendu] of cas) {
  const arrivee = await apresLaFleche(etapes, referer);
  check(`${nom} (${arrivee})`, arrivee === attendu);
}

/* **L'accueil, au retour d'un duel, attend un serveur occupé.** Sans base,
   `/api/auth/me` n'existe pas : c'est la réponse « ni oui ni non » d'un
   serveur qui redémarre. Un visiteur inconnu a droit à trois essais ; un
   joueur déjà reconnu sur cet appareil à davantage, puis à « LE JEU REVIENT »
   au lieu de la vitrine. */
async function demandesQuiEstLa(connu) {
  const p = await navigateur.newPage();
  let n = 0;
  p.on('request', (r) => { if (new URL(r.url()).pathname === '/api/auth/me') n += 1; });
  await p.goto(base + '/aide', { waitUntil: 'domcontentloaded' });
  await p.evaluate((c) => {
    if (c) localStorage.setItem('tbf.connu', '1'); else localStorage.removeItem('tbf.connu');
  }, connu);
  n = 0;
  await p.goto(base + '/', { waitUntil: 'domcontentloaded' });
  await dors(connu ? 16000 : 9000);
  const voile = await p.evaluate(() => Boolean(document.getElementById('tbf-revient')));
  await p.close();
  return { n, voile };
}
const inconnu = await demandesQuiEstLa(false);
const reconnu = await demandesQuiEstLa(true);
check(`un visiteur inconnu : trois essais, puis la vitrine (${inconnu.n})`,
  inconnu.n <= 4 && !inconnu.voile);
check(`un joueur déjà reconnu : on insiste davantage (${reconnu.n})`, reconnu.n >= 8);
check('et on lui dit que le jeu revient, au lieu de la vitrine', reconnu.voile);

await navigateur.close();
serveur.kill();
console.log(fautes ? `\n${fautes} échec(s)` : '\ntout est vert');
process.exit(fautes ? 1 : 0);
