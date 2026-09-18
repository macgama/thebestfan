/**
 * Les gardes : en-têtes de sécurité et débit maximal.
 *
 * ## Pourquoi cette suite existe
 *
 * Un limiteur de débit rate de deux façons opposées, et les deux sont
 * silencieuses. **Trop lâche**, il ne bloque rien et l'on croit être protégé.
 * **Trop serré**, il bloque des joueurs ordinaires, qui ne se plaignent pas —
 * ils s'en vont. Aucune des deux ne se voit en relisant le code, parce que le
 * code est correct dans les deux cas : c'est le *nombre* qui est faux.
 *
 * On éprouve donc les deux bords : qu'une cadence normale passe, et qu'une
 * cadence de script soit refusée — avec un code et un délai, jamais une page
 * qui s'écroule.
 */
import express from 'express';
import { createServer } from 'node:http';
import { entetesDeSecurite, debitMaximal } from '../src/server/garde/index.js';

let rates = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) rates++; };

/* ------------------------------------------------------ les en-têtes */

console.log('\n— les en-têtes —');

{
  const app = express();
  app.use(entetesDeSecurite({ https: false }));
  app.get('/', (_q, s) => s.send('ok'));
  const http = createServer(app);
  await new Promise((r) => http.listen(0, r));
  const base = `http://127.0.0.1:${http.address().port}`;

  const r = await fetch(base + '/');
  const h = (n) => r.headers.get(n) ?? '';

  check('personne ne peut nous afficher dans un cadre', h('x-frame-options') === 'DENY');
  check('et la politique de contenu le redit aux navigateurs récents',
    /frame-ancestors 'none'/.test(h('content-security-policy')));
  check('le navigateur ne devine pas le type des fichiers',
    h('x-content-type-options') === 'nosniff');
  check('nos adresses ne partent pas chez les tiers',
    /strict-origin/.test(h('referrer-policy')));
  check('les permissions inutiles sont fermées',
    /camera=\(\)/.test(h('permissions-policy')) && /geolocation=\(\)/.test(h('permissions-policy')));

  /* La politique doit permettre ce que le jeu fait vraiment, sinon elle casse
     tout en silence : les pages portent leur script en ligne, les images de
     repli sont des `data:`, et le direct passe par des websockets. Une
     politique trop stricte est une panne, pas une protection. */
  const csp = h('content-security-policy');
  check('le jeu peut charger ses propres websockets', /connect-src[^;]*ws:/.test(csp));
  check('les images en ligne restent permises', /img-src[^;]*data:/.test(csp));
  check('les blasons de l’API football restent permis',
    /img-src[^;]*media\.api-sports\.io/.test(csp));

  /* HSTS ne se pose qu'en HTTPS : en clair il n'a aucun effet, et il
     enfermerait un développement local pour six mois. */
  check('HSTS est absent en clair', !r.headers.get('strict-transport-security'));

  await new Promise((r2) => http.close(r2));
}

{
  const app = express();
  app.use(entetesDeSecurite({ https: true }));
  app.get('/', (_q, s) => s.send('ok'));
  const http = createServer(app);
  await new Promise((r) => http.listen(0, r));
  const r = await fetch(`http://127.0.0.1:${http.address().port}/`);
  check('mais présent dès que le site est en HTTPS',
    /max-age=\d+/.test(r.headers.get('strict-transport-security') ?? ''));
  await new Promise((r2) => http.close(r2));
}

/* ------------------------------------------------------ le débit maximal */

console.log('\n— le débit maximal —');

{
  const limiteur = debitMaximal({ fenetreMs: 60_000, maxParFenetre: 10, maxEcritures: 4,
    maxStatiques: 25, exemptes: ['/healthz'] });
  const app = express();
  app.use(limiteur);
  app.get('/healthz', (_q, s) => s.send('ok'));
  app.get('/api/x', (_q, s) => s.json({ ok: true }));
  app.post('/api/x', (_q, s) => s.json({ ok: true }));
  app.get('/ui.css', (_q, s) => s.type('css').send('body{}'));
  app.get('/boutique', (_q, s) => s.type('html').send('<!doctype html><p>boutique'));
  const http = createServer(app);
  await new Promise((r) => http.listen(0, r));
  const base = `http://127.0.0.1:${http.address().port}`;

  const lire = () => fetch(base + '/api/x').then((r) => r.status);
  const ecrire = () => fetch(base + '/api/x', { method: 'POST' }).then((r) => r.status);

  /* La cadence ordinaire passe. C'est le bord qu'on oublie d'éprouver, et
     c'est celui dont l'échec ne se plaint pas : un joueur bloqué s'en va. */
  const dix = [];
  for (let i = 0; i < 10; i++) dix.push(await lire());
  check('dix lectures d’affilée passent', dix.every((s) => s === 200)
    || (console.log('        vu :', dix.join(',')), false));

  const onzieme = await lire();
  check('la onzième est refusée', onzieme === 429);

  const r = await fetch(base + '/api/x');
  check('le refus dit quand réessayer', Number(r.headers.get('retry-after')) > 0);
  check('et il porte un code, pas une page', (await r.json()).error === 'app.error.trop_de_requetes');

  /* Les écritures se comptent à part, et plus serré : ce sont elles qu'on
     rejoue pour tricher, et elles coûtent plus cher au serveur. */
  limiteur.oublier();
  const quatre = [];
  for (let i = 0; i < 4; i++) quatre.push(await ecrire());
  check('quatre écritures passent', quatre.every((s) => s === 200));
  check('la cinquième est refusée', (await ecrire()) === 429);

  /* Et les deux compteurs sont bien séparés : une rafale d'écritures ne doit
     pas fermer la lecture, sinon un joueur qui enregistre son deck ne peut
     plus afficher la page qui suit. */
  check('mais la lecture reste ouverte', (await lire()) === 200);

  /* La sonde de l'hébergeur appelle sans arrêt et a le droit : la compter la
     ferait tomber, et l'hébergeur redémarrerait un serveur qui va bien. */
  limiteur.oublier();
  const sonde = [];
  for (let i = 0; i < 30; i++) sonde.push(await fetch(base + '/healthz').then((r2) => r2.status));
  check('la sonde de l’hébergeur n’est jamais bridée', sonde.every((s) => s === 200));

  /* ------------------------------------------- les fichiers, seau à part

     **Une page de ce jeu, ce n'est pas une requête** : c'est trente à cinquante
     fichiers. Comptés avec les appels de jeu, le plafond tombait au bout de six
     pages, et l'audit d'interface a fini par photographier une boutique servie
     en JSON brut.

     On éprouve donc les deux sens : vingt fichiers ne ferment pas le jeu, et
     une rafale de jeu ne ferme pas les fichiers. C'est la séparation qui
     compte, pas les chiffres. */
  limiteur.oublier();
  const fichiers = [];
  for (let i = 0; i < 20; i++) fichiers.push(await fetch(base + '/ui.css').then((r2) => r2.status));
  check('vingt fichiers d’affilée passent', fichiers.every((x) => x === 200)
    || (console.log('        vu :', fichiers.join(',')), false));
  check('et ils n’ont rien pris au quota du jeu', (await lire()) === 200);

  limiteur.oublier();
  for (let i = 0; i < 11; i++) await lire();
  check('à l’inverse, le jeu bridé laisse passer les fichiers',
    (await fetch(base + '/ui.css').then((r2) => r2.status)) === 200);

  /* ------------------------------------------- le refus d'une navigation

     Le navigateur qui reçoit du JSON en réponse à une barre d'adresse l'affiche
     tel quel. C'est ce que l'audit a mesuré : du texte noir sur fond noir au
     milieu de la boutique, qui disait « app.error.trop_de_requetes » à un
     joueur qui voulait acheter une écharpe. */
  limiteur.oublier();
  for (let i = 0; i < 11; i++) await lire();
  const nav = await fetch(base + '/boutique', { headers: { accept: 'text/html' } });
  check('une navigation refusée reçoit une page, pas du JSON',
    nav.status === 429 && /text\/html/.test(nav.headers.get('content-type') ?? '')
    || (console.log('        il rend :', nav.status, nav.headers.get('content-type')), false));
  const texte = await nav.text();
  check('et cette page est écrite pour un joueur', /Une seconde/.test(texte)
    && !/app\.error/.test(texte));
  check('elle revient d’elle-même quand la minute est passée',
    /http-equiv="refresh"/.test(texte));

  /* L'appel de jeu, lui, garde son objet : l'écran sait le lire et l'afficher
     dans sa langue. Lui servir de l'HTML casserait le `await r.json()` de tous
     les appels du jeu. */
  const api = await fetch(base + '/api/x', { headers: { accept: 'text/html' } });
  check('mais un appel de jeu garde son code',
    api.status === 429 && (await api.json()).error === 'app.error.trop_de_requetes');

  limiteur.arreter();
  await new Promise((r2) => http.close(r2));
}

console.log(rates ? `\n${rates} test(s) en échec` : '\ntout est vert');
process.exit(rates ? 1 : 0);
