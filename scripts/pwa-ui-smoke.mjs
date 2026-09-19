/**
 * Test de l'application installable.
 *
 * ## Pourquoi il faut un vrai navigateur
 *
 * Un service worker ne se relit pas : il s'installe, prend le contrôle, et
 * décide ensuite de ce que le joueur reçoit. Une faute dedans ne se voit sur
 * aucune ligne de code — elle se voit le jour où quelqu'un ouvre le jeu et
 * tombe sur une page d'hier, ou sur rien du tout.
 *
 * Quatre choses s'y jouent, et chacune serait une panne silencieuse :
 *
 *   1. **Il s'inscrit et prend la main.** C'est la seule pièce qui manquait
 *      pour que Chrome propose d'installer le jeu.
 *
 *   2. **Il garde les dessins, et rien d'autre.** Un Fanzzy pèse deux cents
 *      kilo-octets et ne change jamais ; une page gardée, c'est un client
 *      d'hier qui parle au serveur d'aujourd'hui par un protocole qui a bougé.
 *
 *   3. **Il ne touche jamais au direct.** `/api/` et `/socket.io/` sont les
 *      scores, l'authentification, la corde. Servir l'un d'eux deux fois
 *      serait le pire de tout, et ça ne se verrait jamais en développement.
 *
 *   4. **Sans réseau, il dit pourquoi.** Plutôt que le dinosaure du
 *      navigateur, qui laisse croire que le jeu est en panne.
 *
 * Avant de lancer :  npm install --no-save puppeteer
 */
import fs, { readFileSync, existsSync } from 'node:fs';
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

/* ------------------------------------------------- le manifeste, à la lecture

   Il ne demande pas de navigateur : ce sont des faits qu'on peut vérifier sur
   le disque, et les vérifier ici évite de découvrir sur un téléphone qu'une
   icône promise n'existe pas. */

const manifeste = JSON.parse(
  readFileSync(path.join(RACINE, 'public', 'manifest.webmanifest'), 'utf8'));

check('le manifeste se lit', Boolean(manifeste.name && manifeste.start_url));
check('il demande le plein écran', manifeste.display === 'standalone');
/* Pas d'orientation ici : le manifeste verrouille pour tout l'appareil ou pour
   aucun, et l'on veut le portrait sur téléphone mais pas sur tablette. C'est
   `pwa.js` qui s'en charge, écran par écran. */
check('et il ne verrouille pas l’orientation',
  manifeste.orientation === undefined);

for (const taille of ['192x192', '512x512']) {
  const i = (manifeste.icons ?? []).find((x) => x.sizes === taille);
  check(`l’icône ${taille} est promise`, Boolean(i));
  check(`et elle existe sur le disque`,
    Boolean(i) && existsSync(path.join(RACINE, 'public', i.src.replace(/^\//, ''))));
}
check('une icône « maskable » pour Android',
  (manifeste.icons ?? []).some((i) => i.purpose === 'maskable'));

/* ===================== la mise à jour arrive-t-elle chez le joueur ?

   **Elle n'arrivait pas.** `public/` partait avec `max-age=1h` et les pages
   appelaient leurs scripts par une adresse fixe — `<script src="/cartes.js">`.
   Après un déploiement, un navigateur qui avait déjà ce fichier le ressortait
   de son cache **sans demander au serveur** : la page était neuve, son code ne
   l'était pas. Les joueurs n'avaient d'autre issue que de vider leur cache,
   pour un jeu dont le client et le serveur doivent parler le même protocole.

   La règle est maintenant : ce qui peut changer n'est jamais gardé, ce qui est
   gardé ne peut plus changer. Ces contrôles éprouvent les deux moitiés — car
   n'en tenir qu'une donne soit un site lent, soit un site périmé, et les deux
   se découvrent tard.

   Voir `src/server/empreintes.js`. */
{
  const { empreinte, estampiller, releverEmpreintes } =
    await import('../src/server/empreintes.js');
  const PUB = path.join(RACINE, 'public');

  const releve = releverEmpreintes(PUB);
  check(`le relevé trouve les fichiers de code (${releve.length})`, releve.length > 10);

  /* **Le service worker ne s'estampille jamais.** Son adresse est écrite dans
     `pwa.js` et dans l'enregistrement du navigateur : la changer ferait croire
     à un second service worker, et les deux cohabiteraient. */
  check('sauf le service worker, qui a sa propre fraîcheur',
    empreinte(PUB, '/sw.js') === null && !releve.includes('/sw.js'));

  /* Une image ne s'estampille pas non plus : elle est déjà servie un an et
     immuable, et son contenu ne change jamais sous la même adresse. */
  check('et les images, qui ont déjà leur règle',
    empreinte(PUB, '/img/fanzzy/index.json') === null);

  /* ------------------------------------------ toutes les pages, toutes leurs adresses

     Une seule adresse oubliée suffit à ramener la panne, sur une seule page,
     et personne ne la trouve : les autres se mettent à jour normalement. */
  const pages = fs.readdirSync(PUB).filter((f) => f.endsWith('.html'));
  const nues = [];
  const etrangeres = new Set();
  let comptees = 0;
  for (const f of pages) {
    const html = fs.readFileSync(path.join(PUB, f), 'utf8');
    const apres = estampiller(html, PUB);
    for (const m of apres.matchAll(/\b(?:src|href)="(\/[^"?#>]*\.(?:js|css))"/gi)) {
      if (m[1] === '/sw.js') continue;
      /* Ce qui n'est pas dans `public/` n'est pas à nous : `/socket.io/socket.io.js`
         est servi par socket.io lui-même, avec sa version dans la bibliothèque
         et ses propres en-têtes. L'estamper voudrait lire un fichier qui
         n'existe pas sur le disque, et le forcer ferait une adresse morte. */
      if (!existsSync(path.join(PUB, m[1]))) { etrangeres.add(m[1]); continue; }
      nues.push(`${f} → ${m[1]}`);
    }
    comptees += [...apres.matchAll(/\?v=[0-9a-f]{10}"/g)].length;
  }
  check(`les ${pages.length} pages sortent estampillées (${comptees} adresses)`,
    nues.length === 0 && comptees > 30
    || (console.log('        nues :', nues.slice(0, 4).join(', ') || '(aucune)',
                    '· estampées :', comptees), false));

  /* **Et rien d'autre ne manque.** Une adresse qui ne désigne aucun fichier
     n'est pas seulement non estampillée : c'est un script qui ne se charge pas.
     Le seul cas légitime est celui de socket.io ; le nommer ici fait que le
     prochain se remarquera. */
  check('et les seules adresses hors du dépôt sont celles de socket.io',
    [...etrangeres].every((x) => x === '/socket.io/socket.io.js')
    || (console.log('        aussi :', [...etrangeres].join(', ')), false));

  /* L'empreinte décrit **le contenu**, et c'est toute la promesse : deux
     contenus différents ne peuvent pas partager une adresse, sinon garder un an
     revient à servir du périmé pour toujours — bien pire que l'heure d'avant. */
  const avant = empreinte(PUB, '/cartes.js');
  const chemin = path.join(PUB, 'cartes.js');
  const copie = fs.readFileSync(chemin);
  try {
    fs.writeFileSync(chemin, Buffer.concat([copie, Buffer.from('\n// \n')]));
    const apres = empreinte(PUB, '/cartes.js');
    check('un fichier qui change change d’empreinte', avant !== apres
      || (console.log('        les deux :', avant, apres), false));
  } finally {
    fs.writeFileSync(chemin, copie);
  }
  check('et il retrouve la sienne quand on le remet',
    empreinte(PUB, '/cartes.js') === avant);

  /* ------------------------------------------ la règle, côté serveur

     Lue dans `server.js` plutôt que demandée à un serveur qu'on démarrerait :
     le vrai serveur veut une base, des sockets et des clés d'API, et ce qu'on
     éprouve ici est une décision écrite noir sur blanc, pas un comportement qui
     dépend de l'état du monde.

     Ce qu'on refuse : qu'une page reparte par `sendFile`. C'est la régression
     probable — ajouter une page se fait en copiant la ligne d'à côté, et la
     ligne d'à côté d'hier contournait l'estampillage sans rien casser
     visiblement. */
  const srv = fs.readFileSync(path.join(RACINE, 'server.js'), 'utf8');
  const parSendFile = [...srv.matchAll(/sendFile\([^)]*'([^']*\.html)'/g)].map((m) => m[1]);
  check('aucune page ne contourne l’estampillage', parSendFile.length === 0
    || (console.log('        par sendFile :', parSendFile.join(', ')), false));
  check('les pages ne se gardent pas', /no-store/.test(srv));
  check('le code estampillé se garde un an et se déclare immuable',
    /max-age=31536000, immutable/.test(srv));
  check('et le code nu se revalide à chaque fois', /'no-cache'/.test(srv));
}

/* ----------------------------------------------------------------- le talon */

const app = express();

/* Une page minuscule, qui ne charge que ce qu'on éprouve. Les vraies pages ont
   leurs propres suites ; celle-ci regarde le service worker, et une page
   chargée d'API à simuler ne ferait qu'ajouter des raisons d'échouer. */
app.get('/', (_q, s) => s.type('html').send(
  `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
   <link rel="manifest" href="/manifest.webmanifest"><title>banc</title></head>
   <body><img id="dessin" alt=""><script src="/pwa.js"></script></body></html>`));

/* Le direct : ce que le service worker ne doit jamais garder. Le compteur est
   le contrôle — s'il cesse de monter, c'est qu'une réponse a été resservie. */
let appelsApi = 0;
app.get('/api/essai', (_q, s) => { appelsApi++; s.json({ n: appelsApi }); });

/* Un dessin. Même chemin que les vrais — c'est `/img/` qui décide — et un
   compteur, parce que « gardé » veut dire « demandé une seule fois ». */
let appelsImage = 0;
app.get('/img/essai.png', (_q, s) => {
  appelsImage++;
  // Un PNG d'un pixel : ce qu'on mesure est le cache, pas le dessin.
  s.type('image/png').send(Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'));
});

app.use(express.static(path.join(RACINE, 'public')));

const http = createServer(app);
await new Promise((r) => http.listen(0, r));
const base = `http://localhost:${http.address().port}`;

const nav = await puppeteer.launch({ args: ['--no-sandbox'] });
const erreurs = [];
const page = await nav.newPage();
page.on('pageerror', (e) => erreurs.push(e.message));
await page.setViewport({ width: 400, height: 880 });

await page.goto(base + '/', { waitUntil: 'networkidle0' });

/* ------------------------------------------------------- il prend la main */

const pris = await jusqua(async () => page.evaluate(
  () => Boolean(navigator.serviceWorker.controller)));
check('le service worker s’inscrit et prend la main', pris
  || (console.log('        état :', await page.evaluate(async () =>
    (await navigator.serviceWorker.getRegistrations()).length)), false));

check('la page ne lève aucune erreur', erreurs.length === 0
  || (console.log('   ', erreurs.slice(0, 2)), false));

check('et la page sait dire si le jeu est déjà installé',
  await page.evaluate(() => typeof window.TBF_PWA?.installe === 'boolean'));

/* --------------------------------------------------------- le direct, jamais

   Deux appels, deux réponses différentes. Si le service worker gardait la
   première, le compteur du serveur cesserait de monter — et le joueur verrait
   un score figé sans que rien ne le signale. */
{
  const un = await page.evaluate(async () => (await (await fetch('/api/essai')).json()).n);
  const deux = await page.evaluate(async () => (await (await fetch('/api/essai')).json()).n);
  check('le direct n’est jamais servi deux fois', deux === un + 1
    || (console.log('        il dit :', un, 'puis', deux), false));
}

/* ------------------------------------------------------------- les dessins */

{
  const charger = () => page.evaluate(() => new Promise((ok) => {
    const i = document.getElementById('dessin');
    i.onload = () => ok(true); i.onerror = () => ok(false);
    // Le même chemin à chaque fois : c'est la condition pour que le cache serve.
    i.src = '/img/essai.png?' + (i.dataset.fige ??= '1');
  }));
  await charger();
  const apresUn = appelsImage;
  await page.reload({ waitUntil: 'networkidle0' });
  await charger();
  check('un dessin déjà vu ne redemande rien au serveur', appelsImage === apresUn
    || (console.log('        demandes :', apresUn, 'puis', appelsImage), false));
}

/* --------------------------------------------------------- sans réseau

   Le contrôle qui compte le plus : c'est le seul moment où le joueur voit le
   service worker, et il doit y lire une phrase, pas un dinosaure.

   **On coupe le serveur** plutôt que de simuler une coupure par le protocole
   de débogage. Avec `setOfflineMode`, Chrome refuse la navigation avant même
   de consulter le service worker : on mesurait alors le navigateur, pas notre
   code. Un serveur qui ne répond plus est aussi la panne réelle — celle d'un
   joueur dans un train.

   C'est la dernière chose qu'on éprouve, forcément : après elle, le banc n'a
   plus de serveur. */
{
  await new Promise((r) => http.close(r));
  http.closeAllConnections?.();

  await page.goto(base + '/', { waitUntil: 'domcontentloaded' }).catch(() => {});
  const texte = await page.evaluate(() => document.body.textContent);
  check('sans réseau, le jeu explique au lieu de disparaître',
    /PAS DE RÉSEAU/.test(texte)
    || (console.log('        il dit :', JSON.stringify(texte.slice(0, 120))), false));
  check('et il dit que ça reprendra tout seul', /reprend/.test(texte));
}


console.log(`\n${failures ? `${failures} échec(s)` : 'tout est vert'}`);
await nav.close();
process.exitCode = failures ? 1 : 0;
