/**
 * La négociation de format : le bon fichier au bon navigateur.
 *
 * ## Le bug que cette suite aurait attrapé
 *
 * L'accueil n'avait plus de personnage sur Firefox et sur iPhone, pendant que
 * Chrome allait très bien. La page choisissait le format en demandant à un
 * canvas ce qu'il savait **écrire** — personne n'encode l'AVIF, Safari
 * n'encode pas le WebP — et servait un `.jpg` à tout ce qui n'est pas Chrome,
 * alors qu'aucun Fanzzy n'est publié en JPEG. Trois formats sur le disque, un
 * quatrième demandé, un 404, et un cadre vide sans un mot dans la console.
 *
 * Le choix est donc passé côté serveur, où la question a une réponse exacte :
 * l'en-tête `Accept` dit ce que le navigateur sait **lire**. Cette suite monte
 * un vrai serveur sur les vraies images et rejoue les en-têtes de quatre
 * navigateurs réels — dont Safari 15, qui annonce un joker sans savoir lire un
 * AVIF, et qui est précisément le piège de cette négociation.
 *
 * Elle vérifie aussi ce qui ne se voit jamais en regardant une page : le
 * `Vary: Accept`. Sans lui, deux navigateurs qui demandent la même adresse et
 * reçoivent deux fichiers différents finissent par recevoir celui de l'autre,
 * par un cache partagé — et la panne revient, un cran plus loin.
 *
 * Aucune base de données ici : c'est une couche de fichiers.
 */
import express from 'express';
import { createServer, request as requeteHttp } from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { negocierAvif, accepteAvif } from '../src/server/images/index.js';

const IMG = fileURLToPath(new URL('../public/img', import.meta.url));

let rates = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) rates++; };

/* ------------------------------------------------- le serveur, comme en vrai

   Mêmes middlewares et même ordre que `server.js` : la négociation avant le
   static, et le `typer` derrière, qui donne son type MIME à l'AVIF — Express
   ne le connaît toujours pas, et sans lui l'image part en
   « application/octet-stream ». Un montage approximatif éprouverait un serveur
   qui n'existe pas. */
const typer = (res, chemin) => {
  if (path.extname(chemin).toLowerCase() === '.avif') res.setHeader('content-type', 'image/avif');
};
const app = express();
app.use('/img', negocierAvif(IMG));
app.use('/img', express.static(IMG, { maxAge: '365d', immutable: true, setHeaders: typer }));

const http = createServer(app);
await new Promise((r) => http.listen(0, r));
const base = `http://127.0.0.1:${http.address().port}`;

/* Les en-têtes `Accept` de quatre navigateurs, relevés tels qu'ils partent. */
const ACCEPT = {
  chrome: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
  firefox: 'image/avif,image/webp,image/png,image/svg+xml,*/*;q=0.8',
  // Safari 15 : il annonce le joker `image/*` et ne sait pas lire un AVIF.
  // C'est lui qui dit si la négociation lit l'en-tête ou si elle l'interprète.
  safari15: 'image/webp,image/png,image/svg+xml,image/*;q=0.8,*/*;q=0.5',
  safari17: 'image/webp,image/avif,video/*;q=0.8,image/png,image/svg+xml,image/*;q=0.8,*/*;q=0.5',
};

const demander = (chemin, accept, methode = 'GET') =>
  fetch(base + chemin, { method: methode, headers: accept ? { accept } : {} });

/**
 * La même chose, en HTTP brut.
 *
 * `fetch` de Node ajoute d'office `cache-control: no-cache` à toutes ses
 * requêtes. Express le lit et déclare la réponse périmée : un `if-none-match`
 * envoyé par `fetch` ne rend **jamais** de 304, quoi qu'on demande. Un contrôle
 * des requêtes conditionnelles écrit avec `fetch` serait donc vert sans rien
 * éprouver — ce qui est pire que pas de contrôle. On passe par `node:http`, qui
 * envoie exactement les en-têtes qu'on lui donne, comme un navigateur.
 */
const demanderBrut = (chemin, entetes) => new Promise((resoudre, rejeter) => {
  const r = requeteHttp(base + chemin, { headers: entetes }, (rep) => {
    rep.resume();                                   // on ne lit pas le corps
    rep.on('end', () => resoudre({ status: rep.statusCode, entetes: rep.headers }));
  });
  r.on('error', rejeter);
  r.end();
});

/* -------------------------------------------- ce que reçoit chaque navigateur

   L'adresse demandée est **la même pour tout le monde** : c'est tout l'intérêt
   de négocier ici plutôt que dans la page. Le HTML, le service worker et le
   manifeste des états continuent de parler de `.webp`. */

const ADRESSE = '/img/fanzzy/TR57.webp';

for (const [nom, accept] of Object.entries(ACCEPT)) {
  const r = await demander(ADRESSE, accept);
  const type = r.headers.get('content-type');
  const veutAvif = nom !== 'safari15';
  check(`${nom} reçoit du ${veutAvif ? 'AVIF' : 'WebP'} sur une adresse en .webp`,
    r.status === 200 && type === (veutAvif ? 'image/avif' : 'image/webp'));
  check(`${nom} reçoit un fichier entier et non vide`,
    (await r.arrayBuffer()).byteLength > 1000);
  check(`${nom} — la réponse est marquée « Vary: Accept »`,
    /accept/i.test(r.headers.get('vary') ?? ''));
}

/* Le même octet à l'octet près : on vérifie que le corps servi à Chrome est
   bien le fichier AVIF du disque, et pas un WebP renommé. Les quatre premiers
   octets d'un AVIF portent `ftyp` en position 4. */
{
  const r = await demander(ADRESSE, ACCEPT.chrome);
  const tete = Buffer.from(await r.arrayBuffer()).subarray(0, 12).toString('latin1');
  check('le corps servi est bien un AVIF (marque ftyp…avif)',
    tete.includes('ftyp') && tete.includes('avif'));
}

/* ------------------------------------------------------------ les détails */

// Un navigateur muet — un client en ligne de commande, un aspirateur de site —
// n'annonce rien : il reçoit le format universel, jamais l'AVIF.
{
  const r = await demander(ADRESSE, '');
  check('sans en-tête Accept, on sert le WebP',
    r.headers.get('content-type') === 'image/webp');
}

// `q=0` est la manière normalisée de dire « surtout pas celui-là ».
check('image/avif;q=0 est un refus', accepteAvif('image/avif;q=0,image/webp') === false);
check('image/avif;q=0.5 reste un oui', accepteAvif('image/avif;q=0.5') === true);
check('un joker ne vaut pas une déclaration de capacité',
  accepteAvif('image/*,*/*') === false);

// Une image rangée dans les dossiers d'états, et non à plat : c'est l'adresse
// que construit `fanzzy-etats.js`, celle de l'accueil et du Virage.
{
  const r = await demander('/img/fanzzy/TR1/e1/base/neutre.webp?v=10', ACCEPT.chrome);
  check('un dessin d’état se négocie comme les autres',
    r.status === 200 && r.headers.get('content-type') === 'image/avif');
}

/* La révision doit survivre à la réécriture — et c'est sur `req.url` qu'on le
   voit, pas sur la réponse : `express.static` sert le même fichier avec ou sans
   requête, la perte serait donc invisible de l'extérieur jusqu'au jour où un
   middleware posé derrière lirait l'adresse. On appelle donc le middleware à la
   main, ce qui est aussi la seule façon de vérifier qu'il **réécrit** au lieu
   de servir lui-même. */
{
  const middleware = negocierAvif(IMG);
  const req = { method: 'GET', url: '/fanzzy/TR1/e1/base/neutre.webp?v=10',
    headers: { accept: ACCEPT.chrome } };
  let passe = false;
  middleware(req, { vary() {} }, () => { passe = true; });
  check('la réécriture garde la révision et passe la main',
    passe && req.url === '/fanzzy/TR1/e1/base/neutre.avif?v=10');
}

/* Et elle ne touche à rien quand le navigateur n'a rien annoncé : l'adresse
   repart intacte, pas « corrigée » vers le format universel. */
{
  const middleware = negocierAvif(IMG);
  const req = { method: 'GET', url: '/fanzzy/TR57.webp', headers: { accept: ACCEPT.safari15 } };
  middleware(req, { vary() {} }, () => {});
  check('sans AVIF annoncé, l’adresse demandée n’est pas touchée',
    req.url === '/fanzzy/TR57.webp');
}

// Une image sans jumeau AVIF part telle quelle. Rien ne doit disparaître parce
// qu'un format manque : c'est exactement la faute qu'on corrige.
{
  const r = await demander('/img/icone-192.png', ACCEPT.chrome);
  check('une image sans jumeau AVIF est servie telle quelle',
    r.status === 200 && r.headers.get('content-type') === 'image/png');
}

// Un AVIF demandé en propre reste servi, avec son type.
{
  const r = await demander('/img/fanzzy/TR57.avif', ACCEPT.safari15);
  check('une adresse en .avif est servie telle quelle, même à qui n’en veut pas',
    r.status === 200 && r.headers.get('content-type') === 'image/avif');
}

// HEAD doit annoncer ce que le GET enverrait : un cache qui se fie à un HEAD
// non négocié garderait le mauvais type.
{
  const r = await demander(ADRESSE, ACCEPT.chrome, 'HEAD');
  check('HEAD annonce le même format que le GET',
    r.status === 200 && r.headers.get('content-type') === 'image/avif');
}

/* ------------------------------------------- les requêtes conditionnelles

   C'est ici qu'une négociation mal posée fait le plus de dégâts : un `304` rendu
   à un navigateur sur l'ETag du fichier de l'autre lui dit « garde ce que tu as
   » à propos d'une image qu'il n'a jamais reçue. `express.static` compare l'ETag
   au fichier qu'il s'apprête à servir, donc au fichier négocié — on le vérifie,
   parce que rien ne le garantirait si la réécriture bougeait. */
{
  const premier = await demanderBrut(ADRESSE, { accept: ACCEPT.chrome });
  const etag = premier.entetes.etag;

  const encore = await demanderBrut(ADRESSE,
    { accept: ACCEPT.chrome, 'if-none-match': etag });
  check('le même navigateur revient avec son ETag et reçoit un 304',
    encore.status === 304);

  const autre = await demanderBrut(ADRESSE,
    { accept: ACCEPT.safari15, 'if-none-match': etag });
  check('l’ETag de l’AVIF ne vaut pas 304 pour qui reçoit le WebP',
    autre.status === 200 && autre.entetes['content-type'] === 'image/webp');
}

// Le relevé ne contient que des fichiers trouvés sur le disque : une adresse
// bricolée ne peut pas y ressembler.
{
  const r = await fetch(`${base}/img/..%2f..%2fserver.js`, { headers: { accept: ACCEPT.chrome } });
  check('une adresse qui remonte hors de /img ne sert rien', r.status >= 400);
}

// Un fichier absent reste un 404 : on ne veut pas qu'une négociation ratée le
// transforme en autre chose.
{
  const r = await demander('/img/fanzzy/NEXISTEPAS.webp', ACCEPT.chrome);
  check('une image absente reste un 404', r.status === 404);
}

http.close();
console.log(rates ? `\n${rates} échec(s)` : '\ntout est vert');
process.exit(rates ? 1 : 0);
