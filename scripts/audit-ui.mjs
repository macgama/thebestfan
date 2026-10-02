/**
 * L'audit d'interface : ce qui déborde, ce qui se touche mal, ce qui se lit mal.
 *
 * ## Pourquoi il mesure au lieu de juger
 *
 * « Cette page est un peu serrée » ne se corrige pas et ne se vérifie pas. « À
 * 360 px, le bouton PRENDRE MA PLACE dépasse de 12 px » se corrige en une ligne
 * et se re-mesure. Cet audit ne rend que des nombres et des sélecteurs.
 *
 * Trois défauts trouvés cette semaine l'ont été comme ça, et aucun ne se voyait
 * en relisant : la plaque qui débordait de son écran, le personnage qui perdait
 * soixante pixels, les quatre onglets qui se coupaient en « ENTRAÎNE… ».
 *
 * ## Il tourne sur le **vrai** serveur
 *
 * Pas sur un banc qui remonte les modules un par un : sur `server.js`, avec la
 * base de test, comme un joueur. Un audit d'interface qui reconstitue
 * l'application mesure la reconstitution — et c'est exactement la faute que
 * cette session a trouvée trois fois ailleurs.
 *
 * ## Ce qu'il regarde, et pourquoi chaque chose
 *
 *   — **le débordement horizontal**. Une page qui déborde se fait glisser de
 *     côté au doigt, et on croit avoir cassé quelque chose.
 *   — **ce qui sort de l'écran.** Un bouton hors cadre est un bouton qui
 *     n'existe pas.
 *   — **les textes coupés.** `text-overflow: ellipsis` tronque sans rien dire :
 *     une destination devinée n'est pas une destination lue.
 *   — **les zones de touche sous 44 px.** C'est la taille d'un doigt, et c'est
 *     la recommandation des deux plateformes.
 *   — **le contraste du petit texte.** Le jeu est sombre et emploie beaucoup
 *     d'`opacity`. En plein jour, sur un téléphone, `.45` disparaît.
 *   — **les images sans `alt`**, et celles qui n'ont pas chargé.
 *   — **les erreurs de script**, qui ne se voient jamais autrement.
 *
 * ## Et ce que le socle FAIT MAIN lui a ajouté
 *
 * Le lot 0 de la refonte promet que tout se lit en plein jour. Une promesse de
 * lisibilité qu'on ne mesure pas se juge à l'œil, sur l'écran de celui qui
 * corrige — un écran d'intérieur, luminosité au maximum. D'où quatre relevés :
 *
 *   — **le petit texte** : tout texte visible sous 11 px, à sa taille **rendue**
 *     (une carte réduite par `transform: scale` écrit plus petit que sa police).
 *   — **l'opacité effective** : le produit des `opacity` de l'élément et de ses
 *     ancêtres, multiplié par l'alpha de sa couleur. Sous 0,85, un texte qui
 *     informe se devine plus qu'il ne se lit. La couleur seule ne le dit pas :
 *     le jeu écrit en craie pleine dans des blocs à `.6`.
 *   — **le `backdrop-filter`** : tout élément dont la valeur calculée n'est pas
 *     « none ». Il recalcule à chaque image ce qui passe derrière lui, et le
 *     socle le remplace par des fonds opaques.
 *   — **le contraste au jour**, avec `--jour` : le même calcul que le contraste
 *     ordinaire, mais sous un voile blanc de 40 %, qui est ce que fait le soleil
 *     à un écran. Relevé à part, parce qu'il ne remplace pas l'autre.
 *
 * Les mentions légales ont droit à moins, et elles seules : voir `LEGAL`.
 *
 * Il regarde aussi deux écrans qu'il manquait : la vitrine (l'accueil sans
 * compte) et la vraie cérémonie de /bienvenue, vue par un nouveau venu — voir
 * `VISITES`. Et chaque visite a son propre navigateur et sa propre adresse,
 * pour qu'aucune ne dépende de celles d'avant : voir « Un navigateur neuf par
 * visite ».
 *
 * ## Le grain, et les écrans qu'aucune route ne montre (lot 2)
 *
 * Depuis le lot 1, toute bâche, tout onglet actif et tout `.pan` portent une
 * tuile de grain, donc une image de fond — et l'audit rangeait tout texte
 * posé sur une image parmi les « non mesurables ». Le compte au soleil
 * **baissait** pendant que la lecture baissait : un angle mort qui se lit
 * comme un progrès. Il lit maintenant à travers la tuile, jusqu'à la couleur
 * posée dessous (voir « Le grain n'est pas un dégradé », dans `MESURE`), et
 * compte ces textes **à part** — `surGrain`, `palesGrain`, `jourSurGrain`,
 * `jourGrain` — pour qu'un relevé d'avant se compare encore : l'ancien « sur
 * dégradé » vaut le nouveau plus `surGrain`. D'où le schéma `audit-ui/2`.
 *
 * Et `--etats` regarde trois écrans que le parcours des routes ne voit
 * jamais, parce qu'il attend qu'ils soient partis ou ne les ouvre pas :
 * l'ouverture du hub au début et vers deux secondes, et le tiroir ouvert.
 * L'ouverture aussi à 320 × 568, le plus petit téléphone, où l'on cherche
 * ce qu'elle pousse sous son bord (« hors fenêtre »). Voir « Les états ».
 *
 * Usage :
 *   node scripts/audit-ui.mjs                  toutes les pages, trois formats
 *   node scripts/audit-ui.mjs /virage          une seule page
 *   node scripts/audit-ui.mjs --largeur 360    un seul format
 *   node scripts/audit-ui.mjs --tout           sans couper la liste des défauts
 *   node scripts/audit-ui.mjs --jour           et le contraste au soleil
 *   node scripts/audit-ui.mjs --json a.json    tous les relevés, pour une machine
 *   node scripts/audit-ui.mjs --captures dos   une capture par page et par format
 *   node scripts/audit-ui.mjs --pleine         captures de la page entière
 *   node scripts/audit-ui.mjs --etats          et l'ouverture, le tiroir ouvert
 *
 * (Sous Git Bash, « /virage » est réécrit en chemin Windows avant d'arriver
 * ici : préfixer la commande de MSYS_NO_PATHCONV=1, ou la lancer depuis
 * PowerShell.)
 */
import { spawn, spawnSync } from 'node:child_process';
import { ORDRE } from './ordre-schema.mjs';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { baseDeTest, OPTIONS_BASE } from './base-de-test.mjs';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
/* Les options qui prennent une valeur. Cette valeur n'est pas une page :
   « --captures /tmp/avant » commence par une barre oblique, et sans cette
   liste l'audit serait parti visiter la route « /tmp/avant » — pour y
   trouver une page d'erreur et la mesurer consciencieusement. */
const A_VALEUR = new Set(['--largeur', '--json', '--captures']);
const seule = args.find((a, i) => a.startsWith('/') && !A_VALEUR.has(args[i - 1]));
/* Le rapport s'arrête à quatorze défauts par genre : c'est ce qu'on lit d'une
   traite un matin. Quand on s'attelle vraiment à une catégorie, on veut les
   quatre-vingts. */
const tout = args.includes('--tout');
const jour = args.includes('--jour');
const pleine = args.includes('--pleine');
const etats = args.includes('--etats');

/* Une option à valeur sans sa valeur est refusée **avant** de vider la base
   et de démarrer un Chrome : découvrir au bout de six minutes que le JSON
   n'a été écrit nulle part, c'est six minutes perdues, et une mesure « avant »
   qu'on ne pourra plus refaire une fois les pages touchées. */
for (const o of ['--json', '--captures', '--largeur']) {
  if (args.includes(o) && (!opt(o) || opt(o).startsWith('--'))) {
    console.error(`\n${o} attend une valeur : ${o === '--largeur' ? 'un nombre de pixels'
      : o === '--json' ? 'le fichier où écrire les relevés' : 'le dossier des captures'}.\n`);
    process.exit(1);
  }
}
const sortieJson = opt('--json') ? path.resolve(opt('--json')) : null;
const dossierCaptures = opt('--captures') ? path.resolve(opt('--captures')) : null;

const DB = baseDeTest();

/* Les trois formats qui décident. 360 est le téléphone le plus étroit encore
   courant, 400 le téléphone ordinaire, 768 la tablette en portrait — et c'est
   là que les mises en page en colonnes changent de règle.

   **La hauteur compte autant que la largeur.** Le téléphone étroit est aussi
   un téléphone court : 640 px, barre du navigateur déployée. Il était mesuré
   à 800, c'est-à-dire avec cent soixante pixels qu'aucun téléphone modeste
   n'a — et c'est dans ces pixels-là que tombent le bouton principal, le bas
   d'une feuille, la dernière rangée d'une arène. Les deux autres formats
   gardent leur hauteur. */
const FORMATS_BASE = [
  { largeur: 360, hauteur: 640 },
  { largeur: 400, hauteur: 800 },
  { largeur: 768, hauteur: 1024 },
];
/* Le plus petit téléphone qu'on promet de tenir, pour le seul écran
   d'ouverture (voir « Les états ») : il n'entre pas dans le socle. Mais
   « --largeur 320 » le désigne, pour toutes les visites : un téléphone de
   320 px de large a aussi 568 px de haut, pas 800. */
const PETIT = { largeur: 320, hauteur: 568 };
const FORMATS = opt('--largeur')
  ? [[...FORMATS_BASE, PETIT].find((f) => f.largeur === Number(opt('--largeur')))
    ?? { largeur: Number(opt('--largeur')), hauteur: Number(opt('--largeur')) >= 768 ? 1024 : 800 }]
  : FORMATS_BASE;
const cleFormat = (f) => `${f.largeur}x${f.hauteur}`;

/* Les seuils du socle, en un seul endroit : la page les reçoit tels quels, et
   le JSON les recopie — une mesure dont on ne sait plus contre quoi elle
   comparait ne se compare plus à rien. */
const SEUILS = {
  petitTexte: 11,      // px rendus : le corps minimal d'un texte qui informe
  opacite: 0.85,       // opacité effective minimale d'un texte qui informe
  opaciteLegal: 0.55,  // … et d'une mention légale
  voileJour: 0.4,      // la part de blanc que le soleil pose sur l'écran
};

/* **Les mentions légales, et elles seules, ont droit à moins.**

   Elles n'informent pas le jeu : elles disent qui fournit les résultats et ce
   qui est fictif. Elles doivent être là et lisibles pour qui les cherche, pas
   se disputer l'écran avec le bouton de jeu. Le socle leur accorde 0,55
   d'opacité au lieu de 0,85, et ne leur applique pas le seuil de 11 px ; elles
   restent **comptées à part** (« tolérés ») pour qu'une mention tombée à 7 px
   se voie quand même dans le JSON.

   La liste est courte exprès. Une tolérance qu'on étend pour faire taire une
   alerte transforme un texte illisible en texte autorisé :

     .legal         le pied de la vitrine — « Résultats fournis par API-Football »
     [data-legal]   la marque à poser sur toute autre mention qui le mérite,
                    dans le balisage, là où un relecteur la verra */
const LEGAL = ['.legal', '[data-legal]'];

/* /admin et /diagnostic sont des écrans de gestion : l'audit les mesure,
   parce qu'une page servie est une page qu'on peut casser, mais le socle ne
   les vise pas. Ils sont marqués comme tels dans le rapport et le JSON, pour
   qu'un compte « avant / après » du lot ne les mélange pas au reste. */
const HORS_LOT = new Set(['/admin', '/diagnostic']);

/* Les pages, telles que `server.js` les sert. On les lit dans le fichier plutôt
   que de les énumérer : une page ajoutée sans être auditée ne se verrait
   nulle part, et c'est exactement le genre d'oubli que cet outil corrige.

   **Deux formes, et la seconde a coûté cet audit.** Les routes rendaient
   leur page par `res.sendFile` ; elles passent désormais par un raccourci
   `page(res, …)` qui estampille le HTML. La recherche n'a pas suivi : elle
   ne trouvait plus rien, la liste était vide, et l'outil annonçait « Rien à
   signaler sur aucune page » — en n'ayant regardé aucune page.

   C'est la pire panne possible pour un contrôle : il ne rougit pas, il
   rassure. D'où le refus plus bas de travailler sur une liste vide. */
/* **Et les routes à paramètre, qui n'ont pas d'adresse tant qu'on ne leur en
   donne pas une.** La fiche d'un Fanzzy — `/fanzzy/:id` — est un écran à part
   entière, et le socle y branche le compteur d'une évolution ; la recherche
   l'écartait en silence, et l'audit mesurait vingt-trois écrans du jeu en
   laissant croire qu'il les mesurait tous. Chaque route à paramètre reçoit
   donc un exemple ici. RP1 vient de LA REPRISE, la seule série ouverte au
   lancement : c'est la fiche qu'un joueur ouvre vraiment.

   Une route à paramètre sans exemple n'est pas visitée, et elle est **nommée**
   en fin de rapport plutôt qu'oubliée. */
const EXEMPLES = { '/fanzzy/:id': '/fanzzy/RP1' };
const ROUTES = [...new Set(
  [...readFileSync(path.join(RACINE, 'server.js'), 'utf8')
    .matchAll(/app\.get\('(\/[a-z-]*(?:\/:[a-z]+)*)',\s*\(_req, res\) => (?:res\.sendFile|page\()/g)]
    .map((m) => m[1]))];
const SANS_EXEMPLE = ROUTES.filter((r) => r.includes(':') && !EXEMPLES[r]);
const PAGES = seule ? [seule] : ROUTES
  .filter((r) => !r.includes(':') || EXEMPLES[r])
  .map((r) => EXEMPLES[r] ?? r);

/* **Une liste vide est une panne, pas un résultat.** Sans ce garde-fou,
   l'outil parcourt zéro page, ne trouve zéro défaut, et le dit sur le ton de
   la bonne nouvelle. Il vaut mieux qu'il s'arrête en nommant la cause. */
if (!PAGES.length) {
  console.error('\nAucune page trouvée dans server.js.\n\n'
    + '  La recherche attend `app.get(\'/x\', (_req, res) => page(res, …))`\n'
    + '  ou la même chose avec `res.sendFile`. Si les routes ont changé de\n'
    + '  forme, c\u2019est ici qu\u2019il faut le dire — sinon cet audit ne regarde\n'
    + '  plus rien tout en se déclarant satisfait.\n');
  process.exit(1);
}

/* Le nom d'une capture : la route, sans sa barre, puis le format. L'accueil
   n'a pas de nom dans son adresse ; il prend celui qu'on lui donne partout
   ailleurs dans le dépôt. */
const nomDeRoute = (chemin) => (chemin === '/' ? 'accueil'
  : chemin.replace(/^\//, '').replace(/[^a-zA-Z0-9-]+/g, '-'));

/* **Qui regarde chaque page.** Le joueur installé, partout, sauf deux cas
   où il ne voit pas l'écran qu'on croit mesurer :

     — **la cérémonie renvoie tout joueur déjà inscrit vers l'accueil.** Visitée
       avec son compte, /bienvenue mesurait le hub une seconde fois sous un autre
       nom, relevé pour relevé — et la cérémonie, que le socle retouche (son
       premier bouton, ses couleurs par type), n'était jamais regardée. Elle
       est donc vue par un nouveau venu, qui n'a pas encore choisi son club.
     — **l'accueil sans compte est un autre écran** : la vitrine, la seule
       chose que voit quelqu'un qui n'est pas encore entré, et la seule page
       qui porte une mention légale. Sans cette visite, la tolérance du légal
       ne serait jamais éprouvée. Elle s'ajoute aux routes, sous sa propre clé.

   `cle` est le nom de la visite dans le rapport et le JSON ; `nom`, celui de
   sa capture quand la route ne suffit pas à la distinguer. */
const QUI = { '/bienvenue': 'nouveau' };
const VISITES = [
  ...PAGES.map((chemin) => ({ chemin, cle: chemin, qui: QUI[chemin] ?? 'joueur' })),
  ...(seule ? [] : [{ chemin: '/', cle: '/ (sans compte)', qui: null, nom: 'vitrine' }]),
];

/* ------------------------------------------------------------- la base */

const mysql = await import('mysql2/promise');
const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
await raw.query('SET FOREIGN_KEY_CHECKS = 0');
const [tables] = await raw.query(
  'SELECT table_name t FROM information_schema.tables WHERE table_schema = DATABASE()');
if (tables.length) {
  await raw.query(`DROP TABLE IF EXISTS ${tables.map((r) => `\`${r.t}\``).join(', ')}`);
}
await raw.query('SET FOREIGN_KEY_CHECKS = 1');

/* L'ordre du déploiement. Il vit dans `ordre-schema.mjs`, que lisent aussi la
   commande qui applique et la suite qui vérifie.

   **Il était recopié ici**, sous un commentaire affirmant qu'il était « lu
   dans la boucle de DEPLOIEMENT.md pour qu'il ne puisse pas diverger de ce
   qui tourne en production ». Il ne l'était pas : c'était une liste écrite à
   la main, et six fichiers y manquaient — dont `etats.sql`. L'audit montait
   donc des écrans sur un schéma que personne ne déploie, et une page qui
   aurait cassé faute de table s'y serait affichée sans rien dire.

   Un commentaire qui décrit une propriété que le code n'a pas est pire que
   pas de commentaire : on cesse d'aller vérifier. */
for (const f of ORDRE) {
  await raw.query(readFileSync(path.join(RACINE, 'sql', `${f}.sql`), 'utf8'));
}

/* Un joueur, avec assez de choses pour que les écrans ne soient pas tous vides :
   un audit qui ne visite que des pages vides ne mesure que des pages vides. */
const U = 'aud00000-0000-0000-0000-000000000001'.slice(0, 36);
await raw.query(`INSERT INTO users (public_id,email,pseudo,password_hash,status,email_verified_at)
                 VALUES (?,?,?,'x','active',NOW(3))`, [U, 'audit@ex.fr', 'Audit']);
await raw.query(`INSERT INTO user_wallet (user_id,scarves,packs,xp,onboarded_at)
                 VALUES (?,500,6,400,NOW(3))`, [U]);
await raw.query(`INSERT INTO teams (id,name) VALUES (85,'Sion'),(91,'Bâle')`);
await raw.query(`INSERT INTO user_follows (user_id,team_id,is_main) VALUES (?,85,1)`, [U]);
/* Le nouveau venu de /bienvenue (voir `QUI`) : un compte vérifié, rien de
   plus. Sa bourse naît à la première lecture de son état, comme pour un vrai
   inscrit — la semer ici ferait un nouveau venu que le jeu ne fabrique pas. */
const N = 'aud00000-0000-0000-0000-000000000002';
await raw.query(`INSERT INTO users (public_id,email,pseudo,password_hash,status,email_verified_at)
                 VALUES (?,?,?,'x','active',NOW(3))`, [N, 'nouveau@ex.fr', 'Nouveau']);
await raw.end();

/* --------------------------------------------------------- le vrai serveur */

const port = 3999;
const serveur = spawn(process.execPath, ['server.js'], {
  cwd: RACINE,
  env: { ...process.env, DATABASE_URL: DB, PORT: String(port), NODE_ENV: 'test' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let journal = '';
serveur.stdout.on('data', (d) => { journal += d; });
serveur.stderr.on('data', (d) => { journal += d; });

const base = `http://localhost:${port}`;
const debout = async () => {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`${base}/healthz`); if (r.ok || r.status === 503) return true; }
    catch { /* pas encore */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
};
if (!await debout()) {
  console.error('Le serveur n’a pas démarré.\n', journal.slice(-1500));
  serveur.kill(); process.exit(1);
}

/* La session, posée directement : on audite les écrans du jeu, pas le
   formulaire de connexion — qui a sa propre page dans la liste. */
const pool = mysql.createPool({ uri: DB, connectionLimit: 4, ...OPTIONS_BASE });
const jeton = 'audit-session-000000000000000000000000000000';
const jetonNouveau = 'audit-session-nouveau-00000000000000000000000';
const { createHash } = await import('node:crypto');
for (const [j, qui] of [[jeton, U], [jetonNouveau, N]]) {
  await pool.query(
    `INSERT INTO sessions (token_hash, user_id, expires_at)
     SELECT ?, id, NOW(3) + INTERVAL 1 DAY FROM users WHERE public_id = ?`,
    [createHash('sha256').update(j).digest('hex'), qui]);
}
const SESSIONS = { joueur: jeton, nouveau: jetonNouveau };

/* ------------------------------------------------------------ la mesure */

const nav = await puppeteer.launch({ args: ['--no-sandbox'] });
const trouvailles = [];
const note = (page, largeur, genre, quoi) =>
  trouvailles.push({ page, largeur, genre, quoi });

/* **Le voile moyen de chaque tuile de grain**, lu sur la tuile que la page a
   vraiment reçue : décodée dans la page, peinte sur un canevas, moyennée
   pixel par pixel. La teinte moyenne pondérée par l'opacité, et l'opacité
   moyenne — posée sur une couleur, cette couche unie donne exactement la
   moyenne de ce que la tuile donne pixel par pixel sur la même couleur.

   Dans la page et non dans ce script : le serveur choisit le format selon
   ce que le navigateur annonce (un AVIF peut remplacer le WebP demandé), et
   c'est la tuile décodée qu'on veut moyenner, pas la recette. Le résultat
   est rangé sur la page pour MESURE, qui ne peut pas attendre une image, et
   rendu pour le JSON. Une tuile qui n'a pas chargé vaut « null » : la
   surface est alors peinte unie, et MESURE la lit ainsi. */
const VOILES = `(async () => {
  const adresses = new Set();
  for (const el of document.querySelectorAll('*')) {
    const v = getComputedStyle(el).backgroundImage;
    if (!v || !v.includes('/img/grain/')) continue;
    for (const m of v.matchAll(/url\\(\\s*["']?([^"')]+)["']?\\s*\\)/g)) {
      if (m[1].includes('/img/grain/')) adresses.add(m[1]);
    }
  }
  const voiles = {};
  for (const adresse of adresses) {
    try {
      const img = new Image();
      img.src = adresse;
      await img.decode();
      const toile = document.createElement('canvas');
      toile.width = img.naturalWidth;
      toile.height = img.naturalHeight;
      const ctx = toile.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, toile.width, toile.height).data;
      let r = 0, g = 0, b = 0, a = 0;
      for (let i = 0; i < d.length; i += 4) {
        const al = d[i + 3] / 255;
        r += d[i] * al; g += d[i + 1] * al; b += d[i + 2] * al; a += al;
      }
      const n = d.length / 4;
      voiles[adresse] = a > 0 ? { c: [r / a, g / a, b / a], a: a / n } : { c: [0, 0, 0], a: 0 };
    } catch { voiles[adresse] = null; }
  }
  window.__auditVoiles = voiles;
  return voiles;
})()`;

/** Le contraste d'un texte sur son fond, selon la formule WCAG.
 *
 * `portee` restreint la mesure à un sélecteur — l'écran d'ouverture, le
 * tiroir : un état posé par-dessus la page se mesure seul, sans relever une
 * seconde fois la page qu'il recouvre (et que la mesure lirait comme si rien
 * ne la couvrait). Sans portée, c'est toute la page, comme avant.
 *
 * Sous une portée **fixée à la fenêtre** (les deux d'aujourd'hui), deux
 * relevés parlent de l'état et non plus de la page : `deborde` est ce que
 * l'état fait glisser de côté, et `horsFenetre` s'ajoute — les textes qu'il
 * pousse hors de l'écran sans pouvoir les y ramener. Voir « Hors de la
 * fenêtre », plus bas.
 *
 * Le gabarit ne reçoit que `SEUILS`, `LEGAL` et `jour` : les bancs du lot 2
 * le tirent de ce fichier et l'évaluent avec ces trois noms seulement. */
const mesure = (portee = null) => `(() => {
  const SEUILS = ${JSON.stringify(SEUILS)};
  const LEGAL = ${JSON.stringify(LEGAL.join(','))};
  const JOUR = ${jour};
  const PORTEE = ${JSON.stringify(portee)};
  const ZONE = PORTEE ? document.querySelector(PORTEE) : null;
  if (PORTEE && !ZONE) return null;
  const VOILES = window.__auditVoiles ?? {};
  /* **« color(srgb 0.95 0.83 0.49) » ne se lit pas comme « rgb(242, 212, 125) ».**
     C'est ce que rend « color-mix », dont le jeu se sert déjà à trois endroits,
     et ses composantes vont de zéro à un là où celles de « rgb() » vont à 255.
     Les diviser par 255 comme les autres donnait du presque-noir, donc
     « 1.1:1 » pour un texte crème parfaitement lisible.

     C'est la même faute que le dégradé quelques lignes plus bas, et elle
     coûte la même chose : une mesure fausse envoie corriger ce qui ne l'est
     pas. Le nom de l'espace est retiré avant de chercher les nombres, sinon
     le « 3 » de « display-p3 » passerait pour une composante. */
  const lire = (c) => {
    const espace = /^color\\(/.test(c);
    const n = ((espace ? c.replace(/^color\\(\\s*[a-z0-9-]+/i, '') : c)
      .match(/[\\d.]+/g) ?? []).map(Number);
    const e = espace ? 255 : 1;
    return [(n[0] ?? 0) * e, (n[1] ?? 0) * e, (n[2] ?? 0) * e,
      n.length > 3 ? n[3] : 1];
  };
  const lum = (c) => {
    const [r, g, b] = lire(c).slice(0, 3)
      .map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  /* Le fond réel du texte : on remonte jusqu'au premier ancêtre qui peint
     quelque chose.

     **Un dégradé n'est pas une couleur.** Les plaques du jeu sont peintes au
     linear-gradient, donc leur backgroundColor vaut transparent : la remontée
     les traversait sans les voir et comparait l'encre crème au fond de page.
     D'où des rapports impossibles — 1.1:1 pour BOOSTERS, qui est du crème sur
     du rouge. Une mesure fausse dans un audit est pire que pas de mesure : on
     va corriger ce qui n'est pas cassé.

     On ne devine pas la couleur moyenne d'un dégradé. On dit « pas mesurable »
     et on le compte à part. */
  /* **Un fond translucide se pose sur ce qu'il y a derrière.** Le jeu s'en sert
     partout — une pastille dorée à 8 %, un bandeau blanc à 6 % — et les lire
     comme des couleurs pleines donnait « du doré sur du doré, 1.0:1 » pour un
     texte parfaitement lisible. La couche se compose donc avec la suivante,
     jusqu'à la première opaque, exactement comme le navigateur la peint. */
  const composer = (dessus, dessous) => dessus.map((v, i) => Math.round(
    v * dessus[3] + dessous[i] * (1 - dessus[3])));

  /* **Le grain n'est pas un dégradé.** Depuis le lot 1, toute bâche, tout
     onglet actif et tout panneau calme portent une tuile de grain — une image
     de fond, que la remontée rangeait avec les dégradés. Leurs textes
     sortaient donc du compte, et le compte au soleil s'améliorait pendant que
     la lecture baissait : soixante et onze textes de /repetition tombés sous
     le seuil sur un panneau passé au parpaing, et pas un de compté.

     Une tuile n'est pourtant pas une image comme les autres. C'est un voile
     presque transparent, d'une seule teinte, répété sans motif ni tache (voir
     scripts/grain-images.mjs) : sa moyenne est le fond qu'on lit. La couche
     est donc remplacée par son **voile moyen**, lu sur la tuile servie (voir
     VOILES), et la remontée continue jusqu'à la couleur posée dessous — la
     face de la bâche, le panneau, le fond de la page. Ce n'est ni le grain le
     plus clair ni le plus sombre : c'est ce que l'œil moyenne sous une
     lettre de onze pixels posée sur un grain d'un pixel.

     **Un vrai dégradé et une photo restent non mesurables.** Leur couleur
     change sous la lettre, et la moyenne d'une photo ne dit rien de ce qui
     passe derrière un mot. Une seule exception, géométrique : une couche de
     dégradé qui ne se répète pas et dont le rectangle ne touche pas le texte
     n'est pas **sous** le texte — la bande d'écharpe peinte au bord haut de
     la grande bâche, au-dessus de PRENDRE MA PLACE. Tout ce qui ne se calcule
     pas à coup sûr (une position en calc, un fond fixé à la fenêtre, un texte
     dont on ne retrouve pas la place dans la boîte) reste non mesurable :
     une mesure fausse est pire que pas de mesure, et c'est la leçon des deux
     paragraphes qui précèdent. */

  /* Une liste de couches, coupée sur les virgules du premier niveau : un
     dégradé porte ses propres virgules, entre parenthèses. */
  const decouper = (v) => {
    const morceaux = [];
    let profondeur = 0, debut = 0;
    for (let i = 0; i < v.length; i += 1) {
      if (v[i] === '(') profondeur += 1;
      else if (v[i] === ')') profondeur -= 1;
      else if (v[i] === ',' && profondeur === 0) { morceaux.push(v.slice(debut, i).trim()); debut = i + 1; }
    }
    morceaux.push(v.slice(debut).trim());
    return morceaux;
  };

  /* La couche est-elle une tuile de grain ? « undefined » : non, c'est une
     autre image. « null » : oui, mais son voile n'a pas été lu — non
     mesurable, plutôt que deviné. Sinon son nom et sa couche unie. Le béton
     vient en image-set : on prend la tuile que le navigateur choisit, la
     plus petite résolution qui couvre la densité de l'écran. */
  const voileDe = (couche) => {
    if (!/^(?:url|(?:-webkit-)?image-set)\\(/.test(couche)) return undefined;
    const adresses = [...couche.matchAll(/url\\(\\s*["']?([^"')]+)["']?\\s*\\)\\s*(?:([\\d.]+)(?:x|dppx))?/g)];
    if (!adresses.length || !adresses.every((m) => m[1].includes('/img/grain/'))) return undefined;
    const dpr = window.devicePixelRatio || 1;
    const rangees = adresses.map((m) => ({ url: m[1], x: Number(m[2] ?? 1) })).sort((p, q) => p.x - q.x);
    const url = (rangees.find((r) => r.x >= dpr) ?? rangees[rangees.length - 1]).url;
    const nomTuile = url.replace(/^.*\\/img\\/grain\\//, '').replace(/[.?#].*$/, '');
    if (!(url in VOILES)) return null;
    const v = VOILES[url];
    /* Une tuile absente ne peint rien : la surface est unie, et on la lit
       ainsi — en le disant dans le nom. */
    return v ? { nom: nomTuile, couche: [...v.c, v.a] } : { nom: nomTuile + ' (absente)', couche: [0, 0, 0, 0] };
  };

  /* La place du texte dans la boîte de l'élément qui peint la couche, en
     pixels de mise en page — avant toute rotation, donc juste aussi sur une
     bâche tournée de quelques dixièmes de degré, où les rectangles de
     l'écran se décalent. Mesurée depuis le bord intérieur de la bordure,
     comme une couche de fond se place.

     **Le peintre n'a pas à être positionné.** La chaîne des parents
     positionnés ne passe par lui que s'il l'est ; sinon elle le saute, et le
     texte se retrouve placé dans un ancêtre commun aux deux. On place alors
     le peintre dans ce même ancêtre, et on retranche. L'audit exigeait la
     première chaîne, et la feuille commune avait dû poser « position:
     relative » sur la rubrique du tiroir pour lui seul : c'est à la mesure
     de suivre la page, pas à la page de se plier à la mesure.

     « null » quand on ne sait pas, et la couche reste alors sous le texte :
     une chaîne coupée par un élément fixé à la fenêtre, ou un peintre sauté
     qui défile lui-même — son contenu bouge, sa couche non, et la chaîne
     ne voit pas ce défilement-là. */
  const boiteDuTexte = (el, n) => {
    if (el === n) {
      const s = getComputedStyle(n);
      return [parseFloat(s.paddingLeft), parseFloat(s.paddingTop),
        n.clientWidth - parseFloat(s.paddingRight), n.clientHeight - parseFloat(s.paddingBottom)];
    }
    /* Le texte, dans le repère du premier parent positionné qui n'est pas à
       l'intérieur du peintre : le peintre lui-même quand il est positionné. */
    let x = 0, y = 0, e = el, p = null;
    for (;;) {
      p = e.offsetParent;
      if (!p) return null;
      x += e.offsetLeft - p.scrollLeft;
      y += e.offsetTop - p.scrollTop;
      if (p === n || !n.contains(p)) break;
      x += p.clientLeft; y += p.clientTop;
      e = p;
    }
    if (p !== n) {
      /* Le peintre, dans le même repère : sa propre chaîne, jusqu'au même
         ancêtre — qu'elle doit rencontrer, sinon on ne sait pas. Le
         défilement de l'ancêtre est retranché des deux côtés, il s'annule. */
      if (n.scrollLeft || n.scrollTop) return null;
      let nx = n.clientLeft, ny = n.clientTop;
      for (let q = n; q !== p;) {
        const r = q.offsetParent;
        if (!r) return null;
        nx += q.offsetLeft - r.scrollLeft;
        ny += q.offsetTop - r.scrollTop;
        if (r !== p) { nx += r.clientLeft; ny += r.clientTop; }
        q = r;
      }
      x -= nx; y -= ny;
    }
    return [x, y, x + el.offsetWidth, y + el.offsetHeight];
  };

  /* La couche i de n laisse-t-elle le texte de el à découvert ? Seulement
     un dégradé, posé une fois, dans la boîte de remplissage, qui défile avec
     elle, et dont le rectangle se calcule en pixels ou en pour cent. */
  const coucheHorsDuTexte = (n, s, i, couche, el) => {
    if (!/^(?:repeating-)?(?:linear|radial|conic)-gradient\\(/.test(couche)) return false;
    const pris = (v) => { const l = decouper(v); return l[i % l.length]; };
    if (!/^no-repeat(?: no-repeat)?$/.test(pris(s.backgroundRepeat))) return false;
    if (pris(s.backgroundOrigin) !== 'padding-box' || pris(s.backgroundAttachment) !== 'scroll') return false;
    const W = n.clientWidth, H = n.clientHeight;
    const longueur = (v, tout) => (v === undefined || v === 'auto' ? tout
      : /^-?[\\d.]+px$/.test(v) ? parseFloat(v)
        : /^-?[\\d.]+%$/.test(v) ? (parseFloat(v) / 100) * tout : NaN);
    const t = pris(s.backgroundSize).split(/\\s+/);
    const [w, h] = /^(?:cover|contain)$/.test(t[0]) ? [W, H] : [longueur(t[0], W), longueur(t[1], H)];
    const MOTS = { left: '0%', top: '0%', center: '50%', right: '100%', bottom: '100%' };
    const place = (v, libre) => {
      const u = MOTS[v] ?? v;
      return /^-?[\\d.]+px$/.test(u) ? parseFloat(u)
        : /^-?[\\d.]+%$/.test(u) ? (parseFloat(u) / 100) * libre : NaN;
    };
    const p = pris(s.backgroundPosition).split(/\\s+/);
    if (p.length !== 2) return false;
    const x = place(p[0], W - w), y = place(p[1], H - h);
    if (![w, h, x, y].every(Number.isFinite)) return false;
    if (w <= 0 || h <= 0) return true;
    const b = boiteDuTexte(el, n);
    if (!b) return false;
    return x >= b[2] || x + w <= b[0] || y >= b[3] || y + h <= b[1];
  };

  /* Le fond, et les tuiles traversées pour l'atteindre. « null » : non
     mesurable. Mémorisé : le contraste ordinaire, celui du jour et le
     rapport le demandent chacun pour le même texte. */
  const memoFond = new Map();
  const fondDetaille = (el) => {
    if (memoFond.has(el)) return memoFond.get(el);
    const couches = [];
    const grains = [];
    let illisible = false;
    let n = el;
    pile: while (n && n !== document.documentElement) {
      const s = getComputedStyle(n);
      if (s.backgroundImage && s.backgroundImage !== 'none') {
        const images = decouper(s.backgroundImage);
        for (let i = 0; i < images.length; i += 1) {
          /* Une couche sans image : « url(…) repeat, var(--face) » en fait
             une, celle qui ne porte que la couleur. */
          if (images[i] === 'none') continue;
          const v = voileDe(images[i]);
          if (v === undefined && coucheHorsDuTexte(n, s, i, images[i], el)) continue;
          if (!v) { illisible = true; break pile; }
          grains.push(v.nom);
          /* La première couche de la liste est peinte au-dessus : l'ordre de
             la pile est celui de la liste, puis la couleur de l'élément. */
          if (v.couche[3] > 0) couches.push(v.couche);
        }
      }
      const c = lire(s.backgroundColor);
      if (c[3] > 0) {
        couches.push(c);
        if (c[3] >= 0.999) break;   /* opaque : rien derrière ne se voit plus */
      }
      n = n.parentElement;
    }
    let r = null;
    if (!illisible) {
      /* Le fond de la page ferme la pile : si on est sorti de la boucle sans
         rencontrer d'opaque, c'est lui qu'on voit à travers. */
      let out = [10, 13, 17, 1];
      if (couches.length && couches[couches.length - 1][3] >= 0.999) out = couches.pop();
      for (let i = couches.length - 1; i >= 0; i -= 1) out = [...composer(couches[i], out), 1];
      r = { rgb: \`rgb(\${out[0]}, \${out[1]}, \${out[2]})\`, grains };
    }
    memoFond.set(el, r);
    return r;
  };
  const fond = (el) => fondDetaille(el)?.rgb ?? null;
  const contraste = (el) => {
    const s = getComputedStyle(el);
    const o = Number(s.opacity);
    const f = fond(el);
    if (f === null) return null;
    /* Le texte aussi peut être translucide : le jeu écrit beaucoup en
       rgba(…, .6). Comme pour le fond, on le pose sur ce qui est derrière
       avant de le mesurer — sinon on note la couleur annoncée, pas celle
       qui arrive à l'œil. */
    const enc = lire(s.color);
    const pose = enc[3] >= 0.999 ? enc : composer(enc, lire(f));
    const a = lum('rgb(' + pose[0] + ',' + pose[1] + ',' + pose[2] + ')'), b = lum(f);
    let r = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    /* L'opacité n'est pas dans la couleur calculée : un texte à .45 se lit
       beaucoup moins bien que ce que la couleur annonce, et c'est justement le
       cas le plus fréquent dans ce jeu. On l'applique à la main. */
    if (o < 1) r = 1 + (r - 1) * o;
    return r;
  };
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
  };
  /* Le conteneur qui défile au-dessus d'un élément, s'il y en a un. Ce qui sort
     d'un carrousel n'est pas « hors écran » : il est **plus loin dans le
     carrousel**, et c'est exactement à ça qu'il sert. La bande des jours de
     /matchs sortait ainsi à 188 px, trois fois, sans qu'il y ait rien à
     corriger. */
  const defilant = (el) => {
    let n = el.parentElement;
    while (n && n !== document.documentElement) {
      const s = getComputedStyle(n);
      /* Qui defile, ou qui coupe. Les deux disent la meme chose : ce qui
         depasse ici ne depasse pas a l ecran. L ecran d ouverture pose une
         photo en plein cadre et la fait respirer de trois pour cent — elle
         sort donc de sept a quinze pixels, et le cadre la coupe exactement
         comme prevu. L audit annoncait un debordement. */
      if (/auto|scroll|hidden|clip/.test(s.overflowX)) return n;
      n = n.parentElement;
    }
    return null;
  };
  /* Plus strict, pour « Hors de la fenêtre » : un conteneur qui défile
     **vraiment** dans ce sens-là, entre le texte et l'état mesuré compris.
     Un cadre qui coupe ne ramène rien, il cache. Au-delà de l'état, rien ne
     compte : il est fixé, et la page qui défile dessous ne le déplace pas. */
  const defileVers = (el, axe) => {
    for (let n = el === ZONE ? el : el.parentElement; n; n = n.parentElement) {
      if (/auto|scroll/.test(getComputedStyle(n)[axe])) return true;
      if (n === ZONE) break;
    }
    return false;
  };

  const nom = (el) => {
    const t = (el.textContent ?? '').replace(/\\s+/g, ' ').trim().slice(0, 40);
    return \`\${el.tagName.toLowerCase()}\${el.id ? '#' + el.id : ''}\${
      el.className && typeof el.className === 'string'
        ? '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.') : ''}\${
      t ? ' « ' + t + ' »' : ''}\`;
  };

  /* ------------------------------------ ce que le socle FAIT MAIN mesure

     **Un texte à lui.** Le contraste ne regarde que les feuilles, pour ne pas
     répéter le défaut d'un enfant dans chaque conteneur. La taille et
     l'opacité ne peuvent pas s'en contenter : « 12 écharpes » écrit dans un
     paragraphe qui contient aussi un lien n'est pas une feuille, et c'est
     pourtant du texte. On retient donc tout élément qui porte **directement**
     un nœud texte avec au moins une lettre ou un chiffre — une puce « · »
     ou une croix « ✕ » sont des signes, pas des phrases. */
  const texteDirect = (el) => {
    let t = '';
    for (const n of el.childNodes) if (n.nodeType === 3) t += n.nodeValue;
    return /[\\p{L}\\p{N}]/u.test(t);
  };
  /* **Caché par un ancêtre qui coupe.** Un tiroir replié à hauteur nulle, un
     texte glissé hors d'un cadre « overflow: hidden » : il a une boîte, il
     n'est ni « display: none » ni « visibility: hidden », et personne ne peut
     le lire. Le compter enverrait corriger un texte que personne ne voit. Un
     conteneur qui défile, lui, ne cache rien : on y fait venir le texte au
     doigt, donc il reste compté. */
  const cache = (el) => {
    const r = el.getBoundingClientRect();
    for (let n = el.parentElement; n && n !== document.documentElement; n = n.parentElement) {
      const s = getComputedStyle(n);
      const ov = s.overflowX + ' ' + s.overflowY;
      if (!/hidden|clip/.test(ov) || /auto|scroll/.test(ov)) continue;
      const c = n.getBoundingClientRect();
      if (r.right <= c.left || r.left >= c.right || r.bottom <= c.top || r.top >= c.bottom) return true;
    }
    return false;
  };
  /* **L'opacité se multiplie en descendant.** Un texte à 0,8 dans un bloc à
     0,7 s'affiche à 0,56, et aucune des deux règles ne le dit seule. On
     remonte donc toute la lignée — filtre « opacity() » compris, qui fait la
     même chose sous un autre nom — en gardant chaque produit : les frères
     partagent leurs ancêtres, inutile de refaire le chemin pour chacun. */
  const memoOpacite = new Map();
  const opacites = (el) => {
    if (!el || el.nodeType !== 1) return 1;
    if (memoOpacite.has(el)) return memoOpacite.get(el);
    const s = getComputedStyle(el);
    let o = Number(s.opacity);
    const f = /opacity\\(([\\d.]+)(%?)\\)/.exec(s.filter);
    if (f) o *= Number(f[1]) / (f[2] ? 100 : 1);
    o *= opacites(el.parentElement);
    memoOpacite.set(el, o);
    return o;
  };
  /* **La taille rendue, pas la taille déclarée.** Une carte de collection est
     une carte de fiche réduite par « transform: scale » : sa police annonce
     14 px et en affiche neuf. On multiplie donc la taille calculée par
     l'échelle de chaque ancêtre — la longueur du premier vecteur de la
     matrice, qui reste juste quand la carte est aussi tournée — et par la
     propriété « scale », qui ne passe pas par « transform ». */
  const memoEchelle = new Map();
  const echelle = (el) => {
    if (!el || el.nodeType !== 1) return 1;
    if (memoEchelle.has(el)) return memoEchelle.get(el);
    const s = getComputedStyle(el);
    let k = 1;
    if (s.transform && s.transform !== 'none') {
      const v = (s.transform.slice(s.transform.indexOf('(') + 1)
        .match(/-?[\\d.]+(?:e-?\\d+)?/g) ?? []).map(Number);
      k = s.transform.startsWith('matrix3d') ? Math.hypot(v[0], v[1], v[2]) : Math.hypot(v[0], v[1]);
    }
    if (s.scale && s.scale !== 'none') k *= Number(s.scale.split(' ')[0]) || 1;
    k *= echelle(el.parentElement);
    memoEchelle.set(el, k);
    return k;
  };
  /* **Au soleil.** Un écran en plein jour se lit comme s'il portait un voile
     blanc : la lumière réfléchie s'ajoute à celle qu'il émet, autant sur le
     texte que sur le fond, et l'écart entre les deux fond. On mêle donc les
     deux à du blanc avant de mesurer.

     L'encre est d'abord posée sur son fond **à travers toutes ses
     opacités** : c'est ce qui arrive à l'œil, soleil ou pas. Le contraste
     ordinaire, plus haut, n'applique que l'opacité de l'élément lui-même ; il
     n'est pas retouché, pour que ses relevés d'avant se comparent encore. */
  const auSoleil = (c) => c.slice(0, 3).map((v) => v * (1 - SEUILS.voileJour) + 255 * SEUILS.voileJour);
  const contrasteJour = (el) => {
    const f = fond(el);
    if (f === null) return null;
    const dessous = lire(f);
    const enc = lire(getComputedStyle(el).color);
    const a = enc[3] * opacites(el);
    if (a < 0.02) return undefined;
    const pose = composer([enc[0], enc[1], enc[2], a], dessous);
    const t = auSoleil(pose), d = auSoleil(dessous);
    const lt = lum('rgb(' + t.join(',') + ')'), ld = lum('rgb(' + d.join(',') + ')');
    return (Math.max(lt, ld) + 0.05) / (Math.min(lt, ld) + 0.05);
  };

  /* Les textes lus à travers une tuile de grain sont **comptés à part** :
     surGrain et palesGrain, jourSurGrain et jourGrain. Le compte « pâle au
     jour » de la fin du lot 1 ne les voyait pas ; les y verser d'un coup
     ferait lire une régression là où un angle mort se ferme. Et « sur
     dégradé » ne compte plus que ce qui reste non mesurable : l'ancien vaut
     le nouveau plus surGrain. */
  /* Un état fixé à la fenêtre ne défile pas avec la page : voir « Hors de
     la fenêtre ». Le relevé n'existe que là — un zéro qu'on n'a pas mesuré
     se lirait comme un bon résultat. */
  const FIXE = Boolean(ZONE) && getComputedStyle(ZONE).position === 'fixed';
  const out = { deborde: 0, horsEcran: [], coupes: [], petits: [], pales: [],
    sansAlt: [], cassees: [], surDegrade: 0, sousDecor: [],
    textes: 0, petitTexte: [], opacite: [], toleres: [], backdrop: [],
    jour: [], jourSurDegrade: 0,
    surGrain: 0, palesGrain: [], jourSurGrain: 0, jourGrain: [],
    ...(FIXE ? { horsFenetre: [] } : {}) };

  /* **Le décor peut passer devant le texte, et rien ne le disait.**

     \`nav.js\` pose deux calques en frères de la colonne — la photo de tribune
     et son voile — en \`position:fixed\`. Un fond fixé crée son propre contexte
     d'empilement et gagne contre un élément statique, même déclaré avant lui.
     \`ui.css\` le sait et relève \`#app\` à \`position:relative;z-index:1\` — mais
     la règle vise un identifiant, et la page de l'abonnement avait un \`main\`
     sans identifiant. Toute sa colonne se lisait à travers une tribune floue :
     titre, liste, intitulés du tableau, colonne « avec ».

     **\`elementFromPoint\` ne peut pas le voir.** Le décor porte
     \`pointer-events:none\` — il doit se laisser traverser au doigt — donc la
     méthode qui dit « qu'y a-t-il à cet endroit » répond le contenu, celui-là
     même qu'on ne voit pas. Une page entièrement illisible passait l'audit
     sans une alerte.

     On compare donc l'empilement plutôt que le pointage : tout bloc de premier
     niveau qui porte du texte doit gagner contre le décor, c'est-à-dire être
     positionné et porter un \`z-index\` supérieur.

     Pas quand la mesure a une portée : l'état mesuré est posé par-dessus la
     page, et c'est la page qu'on relèverait. */
  if (!ZONE) {
    const decors = [...document.querySelectorAll('.tbf-decor,.tbf-grad')];
    if (decors.length) {
      const zDecor = Math.max(...decors.map((d) => Number(getComputedStyle(d).zIndex) || 0));
      for (const el of document.body.children) {
        if (decors.includes(el)) continue;
        if (!(el.textContent ?? '').trim()) continue;
        const s = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        /* Sans boîte, rien à masquer : les balises \`script\` et \`template\`
           portent du texte et n'occupent pas un pixel. */
        if (r.height < 1 || s.display === 'none' || s.visibility === 'hidden') continue;
        const z = s.position === 'static' ? NaN : Number(s.zIndex);
        if (!Number.isFinite(z) || z <= zDecor) {
          out.sousDecor.push({ q: nom(el), z: s.zIndex, pos: s.position, zDecor });
        }
      }
    }
  }

  /* Le débordement de côté. Sous une portée fixée, c'est celui de l'état :
     la page dessous a son propre relevé, et au format de 320 px, où les
     pages ne sont pas visitées, on aurait mis au compte du rideau ce que fait
     l'accueil. Un état qui défile de côté se fait glisser au doigt comme une
     page ; un état qui coupe ne glisse pas, et ce qu'il pousse dehors est
     relevé plus bas, texte par texte. Un élément fixé n'agrandit jamais la
     page : sans cette règle, le relevé ne pouvait rien dire de lui. */
  out.deborde = !FIXE ? Math.max(0, document.documentElement.scrollWidth - window.innerWidth)
    : /auto|scroll/.test(getComputedStyle(ZONE).overflowX)
      ? Math.max(0, ZONE.scrollWidth - ZONE.clientWidth) : 0;

  const tous = ZONE ? [ZONE, ...ZONE.querySelectorAll('*')] : document.querySelectorAll('*');
  for (const el of tous) {
    /* Le flou d'arrière-plan se relève **avant** le filtre de visibilité : un
       dialogue replié qui le porte le recalculera dès qu'il s'ouvrira, et
       c'est la surface qui compte, pas l'instant. Les pseudo-éléments aussi —
       un voile posé en ::before floute aussi bien que la boîte. */
    for (const pseudo of [null, '::before', '::after']) {
      const s = pseudo ? getComputedStyle(el, pseudo) : getComputedStyle(el);
      if (pseudo && (s.content === 'none' || s.content === 'normal')) continue;
      const v = s.backdropFilter || s.webkitBackdropFilter;
      if (v && v !== 'none') {
        out.backdrop.push({ q: nom(el), pseudo, v, visible: visible(el) });
      }
    }

    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();

    /* Hors écran à gauche ou à droite. On tolère un pixel : les bordures et les
       arrondis en font gagner ou perdre un, et une alerte par arrondi est une
       alerte qu'on apprend à ignorer. */
    if (el.children.length === 0 && (r.left < -1 || r.right > window.innerWidth + 1)
        && !defilant(el)) {
      out.horsEcran.push({ q: nom(el), de: Math.round(Math.max(-r.left, r.right - window.innerWidth)) });
    }

    /* **Hors de la fenêtre**, sous une portée fixée. Une page défile : ce qui
       passe sous le bas de l'écran s'y ramène au doigt, et seul le côté
       compte (« hors écran », juste au-dessus). Un état fixé à la fenêtre ne
       défile pas avec elle : un texte poussé sous son bord ne se lira jamais.
       Et comme le rideau coupe ce qui dépasse, « cache » le retire même du
       compte des textes — la panne restait muette. C'est celle qu'on attend
       d'un téléphone de 568 px de haut.

       Les quatre côtés, un pixel de tolérance, tout texte à soi qui n'est pas
       éteint (la sortie de secours attend ses douze secondes à zéro), sauf
       dans un conteneur qui défile dans ce sens-là : le tiroir défile, et ce
       qui dépasse en bas y est plus loin, pas perdu. */
    if (FIXE && texteDirect(el) && opacites(el) * lire(getComputedStyle(el).color)[3] >= 0.02) {
      const cote = Math.max(-r.left, r.right - window.innerWidth);
      const bas = Math.max(-r.top, r.bottom - window.innerHeight);
      const de = Math.max(cote > 1 && !defileVers(el, 'overflowX') ? cote : 0,
        bas > 1 && !defileVers(el, 'overflowY') ? bas : 0);
      if (de > 0) out.horsFenetre.push({ q: nom(el), de: Math.round(de) });
    }

    /* Coupé par une ellipse. \`scrollWidth > clientWidth\` est la seule façon de
       le voir : l'ellipse ne change ni le texte ni le rectangle. */
    /* **Seulement l ellipse.** Un cadre qui coupe une image decorative fait son
       travail ; une phrase coupee par « text-overflow: ellipsis » ment sans le
       dire, et c est celle-la qu on cherche. Restreindre la mesure a l ellipse
       enleve d un coup les faux positifs des conteneurs a overflow:hidden sans
       perdre une seule vraie troncature — elles portent toutes la propriete. */
    if (el.scrollWidth > el.clientWidth + 1
        && getComputedStyle(el).textOverflow === 'ellipsis'
        && (el.textContent ?? '').trim().length > 2) {
      out.coupes.push({ q: nom(el), de: el.scrollWidth - el.clientWidth });
    }

    /* Une zone de touche. On ne regarde que ce qui se touche vraiment. */
    /* Une zone de touche. **Sauf un lien dans une phrase** : la règle des 44 px
       exempte explicitement le lien en ligne, qui n'a pas de taille à lui — il
       a celle de ses mots. Les compter faisait quatre-vingts alertes qu'on ne
       peut pas corriger sans casser la phrase, et elles noyaient les vraies :
       les boutons à 42 px, à deux pixels du compte. */
    if (/^(button|a|input|select)$/.test(el.tagName.toLowerCase())
        && getComputedStyle(el).display !== 'inline'
        && (r.width < 44 || r.height < 44)) {
      out.petits.push({ q: nom(el), l: Math.round(r.width), h: Math.round(r.height) });
    }

    /* Le contraste, sur le texte seul — et seulement sur les feuilles, sinon
       chaque conteneur répète le défaut de son enfant. */
    if (el.children.length === 0 && (el.textContent ?? '').trim().length > 2) {
      const c = contraste(el);
      if (c === null) { out.surDegrade += 1; }
      else {
        const taille = parseFloat(getComputedStyle(el).fontSize);
        const gras = Number(getComputedStyle(el).fontWeight) >= 700;
        /* Le seuil WCAG AA : 4,5 pour le texte ordinaire, 3 pour le grand. */
        const seuil = (taille >= 24 || (taille >= 18.66 && gras)) ? 3 : 4.5;
        /* Lu à travers une tuile ? Alors compté à part, et la tuile nommée :
           « toile » dit une bâche, « beton » un panneau calme. */
        const grains = fondDetaille(el).grains;
        if (grains.length) out.surGrain += 1;
        /* Le fond est rappelé dans la trouvaille. « 4.3:1 » sans dire sur quoi
           ne se corrige pas : on ne sait pas laquelle des deux couleurs bouger. */
        if (c < seuil) {
          const t = { q: nom(el), c: c.toFixed(1), seuil, px: Math.round(taille),
            sur: fond(el), encre: getComputedStyle(el).color };
          if (grains.length) out.palesGrain.push({ ...t, grain: grains.join(' + ') });
          else out.pales.push(t);
        }
      }
    }

    /* Le même texte au soleil, avec le même seuil : c'est la même personne
       qui lit, simplement dehors. Relevé à part, et seulement quand on le
       demande — il ne remplace pas le contraste d'intérieur. */
    if (JOUR && el.children.length === 0 && (el.textContent ?? '').trim().length > 2) {
      const cj = contrasteJour(el);
      if (cj === null) out.jourSurDegrade += 1;
      else if (cj !== undefined) {
        const s = getComputedStyle(el);
        const taille = parseFloat(s.fontSize);
        const seuil = (taille >= 24 || (taille >= 18.66 && Number(s.fontWeight) >= 700)) ? 3 : 4.5;
        const grains = fondDetaille(el).grains;
        if (grains.length) out.jourSurGrain += 1;
        if (cj < seuil) {
          const t = { q: nom(el), c: cj.toFixed(1), seuil, px: Math.round(taille),
            sur: fond(el), encre: s.color, legal: Boolean(el.closest(LEGAL)) };
          if (grains.length) out.jourGrain.push({ ...t, grain: grains.join(' + ') });
          else out.jour.push(t);
        }
      }
    }

    /* Le petit texte et l'opacité effective, sur tout ce qui porte du texte à
       soi. Un texte à moins de deux pour cent n'est pas pâle, il est éteint :
       c'est un toast qui attend son tour ou un calque qui arrive, et le
       compter noierait les vrais. */
    if (texteDirect(el) && !cache(el)) {
      const s = getComputedStyle(el);
      const oe = opacites(el) * lire(s.color)[3];
      if (oe >= 0.02) {
        out.textes += 1;
        const legal = Boolean(el.closest(LEGAL));
        const css = parseFloat(s.fontSize);
        const px = Math.round(css * echelle(el) * 10) / 10;
        if (px < SEUILS.petitTexte) {
          if (legal) out.toleres.push({ q: nom(el), px, css, pourquoi: 'mention légale' });
          else out.petitTexte.push({ q: nom(el), px, css });
        }
        const seuilO = legal ? SEUILS.opaciteLegal : SEUILS.opacite;
        if (oe < seuilO) out.opacite.push({ q: nom(el), o: Math.round(oe * 100) / 100, seuil: seuilO, legal });
      }
    }
  }

  for (const img of (ZONE ?? document).querySelectorAll('img')) {
    if (!visible(img)) continue;
    /* La propriété « alt » rend la chaîne vide quand l'attribut est absent : la
       comparer à « null » ne trouvait donc **jamais rien**, et cette colonne du
       rapport était vide pour une bonne raison qui n'était pas la bonne.

       Un alt vide reste correct, et volontaire : c'est ainsi qu'on dit « cette
       image est décorative, ne la lis pas ». C'est l'attribut manquant qui
       laisse un lecteur d'écran annoncer le nom du fichier.

       (Pas d'accent grave dans ce commentaire : il vit **à l'intérieur** du
        littéral MESURE, et le premier le refermerait.) */
    if (!img.hasAttribute('alt')) out.sansAlt.push({ q: nom(img) });
    /* **Une image sans attribut src n'est pas cassée, elle attend.** Plusieurs
       écrans posent la balise vide et la remplissent au retour de l'appel ; à la
       seconde où l'audit regarde, elle n'a rien chargé parce qu'on ne lui a rien
       demandé. C'étaient les dix-sept « images cassées » du premier rapport,
       dont sept n'avaient même pas de nom à afficher : « ? ».

       Un src présent et non chargé, lui, est une vraie image morte. */
    const src = img.getAttribute('src');
    if (src && img.complete && img.naturalWidth === 0) out.cassees.push({ q: src });
  }
  return out;
})()`;

/* L'état mesuré, écrit dans le JSON. Une mesure « avant » et une mesure
   « après » ne se comparent que si l'on sait sur quoi chacune a été prise :
   le commit, et si public/ portait des modifications non commitées — c'est
   le cas de toute mesure faite au milieu d'un lot. */
const git = (...a) => {
  try { return spawnSync('git', a, { cwd: RACINE, encoding: 'utf8' }).stdout?.trim() ?? null; }
  catch { return null; }
};
/* **audit-ui/2** : « surDegrade » ne compte plus les textes lus à travers une
   tuile de grain, qui ont leurs propres relevés (voir l'en-tête). Une machine
   qui comparerait un relevé /1 et un relevé /2 champ par champ croirait que
   cent textes sont devenus mesurables par miracle : le numéro le lui dit. */
const rapport = {
  schema: 'audit-ui/2',
  date: new Date().toISOString(),
  commit: git('rev-parse', '--short', 'HEAD'),
  publicModifie: Boolean(git('status', '--porcelain', '--', 'public')),
  options: { jour, pleine, etats, seule: seule ?? null },
  seuils: SEUILS,
  legal: LEGAL,
  formats: FORMATS.map(cleFormat),
  horsLot: [...HORS_LOT],
  nonAuditees: SANS_EXEMPLE,
  /* Une entrée par visite, sous sa clé : la route, ou « / (sans compte) »
     pour la vitrine. Chacune porte ensuite un format par clé « 360x640 ». */
  visites: VISITES.map(({ cle, chemin, qui }) => ({ cle, chemin, qui: qui ?? 'sans compte' })),
  /* Le voile moyen de chaque tuile, par adresse : un relevé « sur grain »
     dit ainsi contre quoi il a été pris. */
  voiles: {},
  pages: {},
  ...(etats ? { etats: {} } : {}),
};
if (dossierCaptures) mkdirSync(dossierCaptures, { recursive: true });

console.log(`\nAUDIT D’INTERFACE — ${VISITES.length} page(s), ${
  FORMATS.map((f) => `${f.largeur}×${f.hauteur}`).join(' / ')}${jour ? ', au jour' : ''}${
  etats ? `, et les états${opt('--largeur') ? '' : ` (l’ouverture aussi à ${PETIT.largeur}×${PETIT.hauteur})`}` : ''}\n`);

/* **Un navigateur neuf par visite.** Les pages partageaient un seul
   contexte, donc ses cookies : le cookie de session posé pour une page
   restait sur toutes les suivantes, et « l'accueil sans compte » se mesurait
   connecté — la vitrine n'était jamais vue. Le stockage local suivait le
   même chemin : ce qu'une page y écrivait changeait l'écran de la suivante,
   et une page auditée seule ne donnait pas le même relevé qu'au milieu du
   parcours. Chaque visite a donc son contexte, jeté après elle.

   **Et une adresse à elle.** Le serveur compte les requêtes par adresse —
   deux cent quarante lectures et mille cinq cents fichiers par minute, voir
   `debitMaximal` — et l'audit enchaîne soixante-quinze écrans en six
   minutes depuis la même machine, sans cache puisque chaque contexte est
   neuf : le classeur seul demande des centaines d'images. Aucun joueur ne
   fait ça. `trust proxy` fait lire au serveur l'adresse de X-Forwarded-For ;
   chaque visite en reçoit une, comme autant de joueurs différents.

   Un refus qui passerait quand même est **relevé** (genre « refusé (429) ») :
   une mesure prise sous un refus n'est pas une mesure de la page. La
   première mesure étendue a vu la boutique à 768 px sans son catalogue, et
   rien ne permettait de dire pourquoi ; c'est ce silence-là que le relevé
   supprime. */
let visite = 0;

/** Un contexte neuf, une adresse à lui, un format, et qui regarde. */
async function nouvelleVisite({ largeur, hauteur }, qui) {
  const contexte = await nav.createBrowserContext();
  const page = await contexte.newPage();
  const erreurs = [];
  const refus = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  page.on('response', (r) => { if (r.status() === 429) refus.push(r.url().replace(base, '')); });
  visite += 1;
  await page.setExtraHTTPHeaders({
    'X-Forwarded-For': `10.77.${Math.floor(visite / 250)}.${(visite % 250) + 1}` });
  await page.setViewport({ width: largeur, height: hauteur });
  if (qui) {
    await page.setCookie({ name: 'tbf_session', value: SESSIONS[qui], domain: 'localhost', path: '/' });
  }
  return { contexte, page, erreurs, refus };
}

/** Les voiles d'abord (MESURE ne peut pas attendre une image), puis la mesure. */
async function mesurer(page, portee = null) {
  const voiles = await page.evaluate(VOILES).catch(() => null);
  for (const [adresse, v] of Object.entries(voiles ?? {})) {
    if (adresse in rapport.voiles) continue;
    rapport.voiles[adresse] = v && {
      tuile: adresse.replace(/^.*\/img\/grain\//, '').replace(/[?#].*$/, ''),
      opacite: Math.round(v.a * 10_000) / 10_000,
      teinte: v.c.map((x) => Math.round(x)),
    };
  }
  return page.evaluate(mesure(portee));
}

/** Les trouvailles d'une mesure, coupées à quatre par genre pour le rapport. */
function noterReleves(cle, largeur, m, erreurs) {
  if (m.deborde > 0) note(cle, largeur, 'déborde', `${m.deborde} px de large en trop`);
  for (const x of m.horsEcran.slice(0, 4)) note(cle, largeur, 'hors écran', `${x.q} — ${x.de} px dehors`);
  /* Seulement sous une portée fixée : ailleurs, le relevé n'existe pas. */
  for (const x of (m.horsFenetre ?? []).slice(0, 4)) {
    note(cle, largeur, 'hors fenêtre', `${x.q} — ${x.de} px hors de l’écran, qui ne défile pas`);
  }
  for (const x of m.coupes.slice(0, 4)) note(cle, largeur, 'coupé', `${x.q} — ${x.de} px tronqués`);
  for (const x of m.petits.slice(0, 4)) note(cle, largeur, 'trop petit', `${x.q} — ${x.l}×${x.h}`);
  for (const x of m.pales.slice(0, 4)) note(cle, largeur, 'pâle', `${x.q} — ${x.c}:1 (il en faut ${x.seuil}) — ${x.encre} sur ${x.sur}`);
  /* Le fond rappelé est celui qu'on lit, voile moyen compris ; la tuile est
     nommée pour qu'on sache quelle surface le porte. */
  for (const x of m.palesGrain.slice(0, 4)) {
    note(cle, largeur, 'pâle sur grain',
      `${x.q} — ${x.c}:1 (il en faut ${x.seuil}) — ${x.encre} sur ${x.sur}, sous ${x.grain}`);
  }
  for (const x of m.sansAlt.slice(0, 3)) note(cle, largeur, 'sans alt', x.q);
  for (const x of m.cassees.slice(0, 3)) note(cle, largeur, 'image cassée', x.q);
  for (const x of m.sousDecor.slice(0, 3)) {
    note(cle, largeur, 'sous le décor',
      `${x.q} — ${x.pos}, z-index ${x.z} (le décor est à ${x.zDecor})`);
  }
  for (const x of m.petitTexte.slice(0, 4)) {
    note(cle, largeur, 'petit texte', `${x.q} — ${x.px} px${x.px !== x.css ? ` (police ${x.css} px)` : ''}`);
  }
  for (const x of m.opacite.slice(0, 4)) {
    note(cle, largeur, 'opacité', `${x.q} — ${x.o} (il en faut ${x.seuil})`);
  }
  for (const x of m.backdrop.slice(0, 4)) {
    note(cle, largeur, 'backdrop-filter',
      `${x.q}${x.pseudo ? ` ${x.pseudo}` : ''} — ${x.v}${x.visible ? '' : ' (replié)'}`);
  }
  if (jour) {
    for (const x of m.jour.slice(0, 4)) {
      note(cle, largeur, 'pâle au jour', `${x.q} — ${x.c}:1 au soleil (il en faut ${x.seuil}) — ${x.encre} sur ${x.sur}`);
    }
    for (const x of m.jourGrain.slice(0, 4)) {
      note(cle, largeur, 'pâle au jour sur grain',
        `${x.q} — ${x.c}:1 au soleil (il en faut ${x.seuil}) — ${x.encre} sur ${x.sur}, sous ${x.grain}`);
    }
  }
  for (const e of erreurs.slice(0, 2)) note(cle, largeur, 'script', e.slice(0, 90));
}

/* Tous les relevés, sans la coupe à quatre du rapport : le JSON sert à
   compter et à comparer, pas à lire d'une traite. Le contraste au jour
   n'y figure que s'il a été mesuré — un zéro qu'on n'a pas mesuré se
   lirait comme un bon résultat. */
function compter(m, erreurs, refus) {
  if (!jour) { delete m.jour; delete m.jourSurDegrade; delete m.jourSurGrain; delete m.jourGrain; }
  return {
    deborde: m.deborde, horsEcran: m.horsEcran.length, coupes: m.coupes.length,
    petits: m.petits.length, pales: m.pales.length, surDegrade: m.surDegrade,
    sansAlt: m.sansAlt.length, cassees: m.cassees.length, sousDecor: m.sousDecor.length,
    scripts: erreurs.length, refus: refus.length, textes: m.textes,
    petitTexte: m.petitTexte.length, opacite: m.opacite.length, toleres: m.toleres.length,
    backdrop: m.backdrop.length,
    ...(m.horsFenetre ? { horsFenetre: m.horsFenetre.length } : {}),
    surGrain: m.surGrain, palesGrain: m.palesGrain.length,
    ...(jour ? { jour: m.jour.length, jourSurDegrade: m.jourSurDegrade,
      jourSurGrain: m.jourSurGrain, jourGrain: m.jourGrain.length } : {}),
  };
}

/** Le nombre de choses à dire sur une mesure : la ligne de la console. */
const total = (m, erreurs, refus) => m.deborde + m.horsEcran.length + (m.horsFenetre?.length ?? 0)
  + m.coupes.length + m.petits.length
  + m.pales.length + m.palesGrain.length + m.cassees.length + m.sousDecor.length
  + erreurs.length + refus.length + m.petitTexte.length + m.opacite.length + m.backdrop.length
  + (jour ? m.jour.length + m.jourGrain.length : 0);

for (const { chemin, cle, qui, nom: nomCapture } of VISITES) {
  rapport.pages[cle] = {};
  for (const format of FORMATS) {
    const { largeur, hauteur } = format;
    const { contexte, page, erreurs, refus } = await nouvelleVisite(format, qui);
    /* **Une seconde chance, et une seule.** La vitrine, visitée sans compte et
       sans cache, n'a pas trouvé son calme réseau en vingt secondes une fois
       sur six pendant la mesure « avant » — et une case vide dans un tableau
       avant / après ne se compare à rien. Un second essai la rattrape ; il est
       noté, pour qu'une page qui ne charge qu'au second coup se voie quand
       même. Deux échecs, et la case reste vide, comme avant. */
    let essais = 0;
    let charge = false;
    while (!charge && essais < 2) {
      essais += 1;
      try {
        await page.goto(base + chemin, { waitUntil: 'networkidle0', timeout: 20_000 });
        charge = true;
      } catch { /* on retente une fois */ }
    }
    if (!charge) {
      note(cle, largeur, 'chargement', 'la page n’a pas fini de charger en 20 s, deux fois');
      rapport.pages[cle][cleFormat(format)] = { largeur, hauteur, charge: false, essais };
      await contexte.close();
      continue;
    }
    if (essais > 1) {
      note(cle, largeur, 'chargement', 'chargée au second essai : le réseau ne s’était pas tu en 20 s');
    }
    /* Le temps que l'écran d'ouverture parte et que les appels se posent. Sans
       ça, on mesure un écran de chargement. */
    /* **Et l'ouverture peut tenir dix secondes.** Sur l'accueil connecté,
       elle part dès que le hub a ses données ; sur la vitrine, personne ne
       la congédie et elle tient son plafond (`DUREE` d'ouverture.js). Au bout
       de 1,8 s, la vitrine se mesurait donc sous le rideau, et sa capture
       montrait le titre du jeu au lieu de la page. On attend qu'il soit
       retiré du document — tout de suite sur les pages qui n'en ont pas. */
    await page.waitForFunction(() => !document.getElementById('ouverture'), { timeout: 12_000 })
      .catch(() => note(cle, largeur, 'chargement', 'l’écran d’ouverture était encore là après 12 s'));
    await new Promise((r) => setTimeout(r, 1800));

    const m = await mesurer(page);

    /* La capture après la mesure : la mesure ne touche à rien, et l'image
       montre donc exactement l'écran qui a été mesuré. Celle de l'écran seul
       par défaut — c'est ce que le joueur voit en arrivant, et c'est là que
       le 360 × 640 se distingue du 400 × 800. */
    let capture = null;
    if (dossierCaptures) {
      capture = `${nomCapture ?? nomDeRoute(chemin)}-${cleFormat(format)}.png`;
      try {
        await page.screenshot({ path: path.join(dossierCaptures, capture), fullPage: pleine });
      } catch (e) {
        note(cle, largeur, 'capture', `capture impossible : ${e.message.slice(0, 80)}`);
        capture = null;
      }
    }

    /* Deux façons de ne pas mesurer ce qu'on croit : un refus du serveur, et
       une page qui renvoie ailleurs. La seconde se dit en fin de ligne dans
       le rapport — /bienvenue qui file à l'accueil ne se voit qu'ainsi. */
    const arrivee = new URL(page.url()).pathname;
    if (refus.length) {
      note(cle, largeur, 'refusé (429)', `${refus.length} requête(s) refusée(s), dont ${refus[0]}`);
    }
    if (arrivee !== new URL(base + chemin).pathname) {
      note(cle, largeur, 'renvoyée', `la page renvoie vers ${arrivee} : c’est cet écran-là qui est mesuré`);
    }

    noterReleves(cle, largeur, m, erreurs);

    rapport.pages[cle][cleFormat(format)] = {
      largeur, hauteur, charge: true, essais, capture, qui: qui ?? 'sans compte', arrivee,
      compte: compter(m, erreurs, refus),
      releves: { ...m, scripts: erreurs, refus },
    };

    const n = total(m, erreurs, refus);
    console.log(`  ${cle.padEnd(16)} ${`${largeur}×${hauteur}`.padStart(9)}   ${
      n === 0 ? 'rien à signaler' : `${n} chose(s)`}${HORS_LOT.has(cle) ? '   (hors lot)' : ''}${
      arrivee !== new URL(base + chemin).pathname ? `   → ${arrivee}` : ''}`);
    await contexte.close();
  }
}

/* ------------------------------------------------------------ les états

   **Trois écrans qu'aucune route ne montre.** Le parcours attend que
   l'ouverture soit partie avant de mesurer (voir plus haut), et il n'ouvre
   jamais le tiroir : deux des écrans les plus vus du jeu, que le lot 2
   refait, n'avaient ni capture ni relevé. `--etats` leur donne une visite
   neuve chacun, aux mêmes formats — et l'ouverture aussi à 320 × 568
   (`PETIT`, plus bas) :

     — **l'ouverture du hub, à deux instants** (`INSTANTS_OUVERTURE`) : au
       début, avant le plancher d'1,2 s d'ouverture.js, quand le titre et la
       jauge viennent de paraître ; puis vers deux secondes, quand tout ce
       qui entre est entré et que l'écran attend qu'on le congédie. Sur
       l'accueil connecté, il part dès que le hub émet « tbf:pret » — sur la
       machine de test, avant deux secondes. Le signal est donc **retenu**,
       pour cette visite seulement : ouverture.js en est aujourd'hui le seul
       destinataire, et le retenir revient à un serveur lent, le cas même que
       son plafond prévoit. Ses règles de sortie ne sont pas touchées, et
       l'audit n'attend pas le plafond. (Un écouteur de « tbf:pret » ajouté
       ailleurs serait retenu avec lui, et le hub photographié derrière le
       rideau ne serait plus tout à fait le vrai : c'est ici qu'il faudrait
       le dire.)
     — **le tiroir ouvert**, sur une page ordinaire (`PAGE_TIROIR`) : la
       barre de nav.js, et le bouton qui commande le tiroir — trouvé par son
       « aria-controls », le lien que menu.js pose entre les deux.

   Chaque état est photographié **et mesuré sous sa portée** — le tiroir,
   le rideau : la page qu'il recouvre a déjà son relevé, et la remesurer
   sous un voile la ferait lire comme si rien ne la couvrait. Le premier
   instant n'est que photographié : les visages montent encore, et un texte
   en train de paraître serait compté pâle. (La consigne et l'astuce n'y
   sont pas encore : ouverture.js les pose au plancher, c'est voulu.) Les
   deux sont fixés à la fenêtre : leur relevé « déborde » est le leur, et
   « hors fenêtre » s'y ajoute — voir la mesure.

   Rangés à part dans le JSON (`etats`), jamais dans `pages` : un relevé
   avec `--etats` se compare page à page à un relevé sans. Et toujours la
   capture de l'écran, même avec `--pleine` : un tiroir et un rideau sont
   fixés à la fenêtre, la page entière dessous ne les montrerait pas mieux. */
const INSTANTS_OUVERTURE = [500, 2000];
const PAGE_TIROIR = '/classement';
/* **Le rideau, aussi au plus petit téléphone.** C'est le premier écran que
   voit tout joueur, sur tout appareil, et le lot 2 le refait en demandant
   qu'il tienne à 320 × 568 : rien qui sorte, rien de coupé sous son bord
   (« hors fenêtre »). Le tiroir défile, lui : il n'a pas ce risque-là. Et
   les pages ne sont pas visitées à ce format, qui n'est pas celui du socle.
   Avec `--largeur`, on s'en tient au format demandé. */
const FORMATS_OUVERTURE = opt('--largeur') ? FORMATS : [...FORMATS, PETIT];

async function photographier(page, nomEtat, format, cle) {
  if (!dossierCaptures) return null;
  const fichier = `etat-${nomEtat}-${cleFormat(format)}.png`;
  try {
    await page.screenshot({ path: path.join(dossierCaptures, fichier) });
    return fichier;
  } catch (e) {
    note(cle, format.largeur, 'capture', `capture impossible : ${e.message.slice(0, 80)}`);
    return null;
  }
}

/** Attend la fin des mouvements qui finissent bientôt dans ces éléments et
    leurs descendants — une transition, un ticket qui monte, un tiroir qui se
    déroule —, au plus `plafond` ms. Ni les boucles, qui ne finissent jamais
    (une pastille qui bat, la fumée), ni ce qui dure plus que le plafond : la
    lumière du tunnel grandit pendant les dix secondes du plafond
    d'ouverture.js, c'est du décor, et l'attendre ferait attendre le plafond. */
async function finDesMouvements(page, selecteur, plafond) {
  await page.evaluate(async (sel, max) => {
    const finies = [...document.querySelectorAll(sel)]
      .flatMap((e) => e.getAnimations({ subtree: true }))
      .filter((a) => {
        const t = a.effect?.getComputedTiming?.();
        return t && t.iterations !== Infinity && t.endTime - (t.localTime ?? 0) <= max;
      })
      .map((a) => a.finished.catch(() => {}));
    await Promise.race([Promise.all(finies), new Promise((r) => setTimeout(r, max))]);
  }, selecteur, plafond).catch(() => {});
}

/** Range un état dans le JSON et le dit en console, comme une page. */
function rangerEtat(cle, chemin, format, donnees, m = null, erreurs = [], refus = []) {
  rapport.etats[cle] ??= { chemin };
  const entree = { largeur: format.largeur, hauteur: format.hauteur, ...donnees, mesure: Boolean(m) };
  if (m) {
    noterReleves(cle, format.largeur, m, erreurs);
    if (refus.length) {
      note(cle, format.largeur, 'refusé (429)', `${refus.length} requête(s) refusée(s), dont ${refus[0]}`);
    }
    entree.compte = compter(m, erreurs, refus);
    entree.releves = { ...m, scripts: erreurs, refus };
  }
  rapport.etats[cle][cleFormat(format)] = entree;
  const n = m ? total(m, erreurs, refus) : null;
  console.log(`  ${cle.padEnd(22)} ${`${format.largeur}×${format.hauteur}`.padStart(9)}   ${
    n === null ? (entree.capture ? 'photographié' : 'rien à montrer')
      : n === 0 ? 'rien à signaler' : `${n} chose(s)`}${
    entree.instant !== undefined ? `   (à ${entree.instant} ms${
      entree.instantMesure ? `, mesuré à ${entree.instantMesure}` : ''})` : ''}`);
}

async function etatOuverture(format) {
  const { contexte, page, erreurs, refus } = await nouvelleVisite(format, 'joueur');
  try {
    await page.evaluateOnNewDocument(() => {
      addEventListener('tbf:pret', (e) => e.stopImmediatePropagation(), { capture: true });
    });
    try {
      await page.goto(`${base}/`, { waitUntil: 'domcontentloaded', timeout: 20_000 });
    } catch {
      note('ouverture', format.largeur, 'chargement', 'l’accueil n’a pas répondu en 20 s');
      return;
    }
    for (const instant of INSTANTS_OUVERTURE) {
      const cle = `ouverture@${instant}ms`;
      await page.waitForFunction((t) => performance.now() >= t, { polling: 20, timeout: 15_000 }, instant)
        .catch(() => {});
      /* L'instant réel est relevé : si la page a mis plus d'une demi-seconde
         à répondre, la capture « du début » n'en est pas une, et il faut le
         savoir. Les polices aussi — une capture prise avant Oswald montre le
         rideau dans une police de secours. */
      const ici = await page.evaluate(() => {
        const o = document.getElementById('ouverture');
        return { instant: Math.round(performance.now()), polices: document.fonts?.status ?? null,
          la: Boolean(o) && !o.classList.contains('partie') };
      });
      if (!ici.la) {
        note(cle, format.largeur, 'état', `l’écran d’ouverture n’était plus là à ${ici.instant} ms`);
        rangerEtat(cle, '/', format, { instant: ici.instant, polices: ici.polices, capture: null });
        continue;
      }
      /* La capture d'abord, ici : c'est elle qui tient à l'instant. La
         mesure, elle, attend ce qui finit d'entrer : l'astuce monte de
         quarante pixels en 320 ms, la consigne paraît en 200. Sur une
         machine lente, où ouverture.js arrive tard, l'une prise au vol
         sortait « hors fenêtre », l'autre sous l'opacité minimale (vu au
         banc, à 360 × 640 : le ticket encore 42 px plus bas à 2,6 s). */
      const capture = await photographier(page, `ouverture-${instant}ms`, format, cle);
      const dernier = instant === INSTANTS_OUVERTURE[INSTANTS_OUVERTURE.length - 1];
      let m = null;
      let instantMesure;
      if (dernier) {
        await finDesMouvements(page, '#ouverture', 1500);
        instantMesure = await page.evaluate(() => Math.round(performance.now()));
        m = await mesurer(page, '#ouverture');
      }
      rangerEtat(cle, '/', format, { instant: ici.instant, ...(m ? { instantMesure } : {}),
        polices: ici.polices, capture }, m, erreurs, refus);
    }
  } finally {
    await contexte.close();
  }
}

async function etatTiroir(format) {
  const cle = `tiroir@${PAGE_TIROIR}`;
  const { contexte, page, erreurs, refus } = await nouvelleVisite(format, 'joueur');
  try {
    try {
      await page.goto(base + PAGE_TIROIR, { waitUntil: 'networkidle0', timeout: 20_000 });
    } catch {
      note(cle, format.largeur, 'chargement', 'la page n’a pas fini de charger en 20 s');
      return;
    }
    await new Promise((r) => setTimeout(r, 1800));
    /* Ouvert par le bouton, comme un joueur, puis attendu jusqu'à la fin de
       ses transitions — pas de ses boucles : une pastille qui bat ne finit
       jamais. « aria-expanded » plutôt qu'une classe : c'est le contrat que
       le bouton doit tenir pour un lecteur d'écran, il survivra à un
       changement de feuille de style. */
    const ouvert = await page.evaluate(async () => {
      const b = document.querySelector('[aria-controls="tbf-tiroir"]');
      if (!b) return { faute: 'aucun bouton ne commande le tiroir (aria-controls="tbf-tiroir")' };
      b.click();
      const depart = performance.now();
      while (b.getAttribute('aria-expanded') !== 'true') {
        if (performance.now() - depart > 3000) return { faute: 'le tiroir ne s’est pas ouvert en 3 s' };
        await new Promise((r) => setTimeout(r, 30));
      }
      if (!document.getElementById('tbf-tiroir')) {
        return { faute: 'le bouton dit le tiroir ouvert, et il n’y a pas de #tbf-tiroir' };
      }
      return { faute: null };
    });
    if (ouvert.faute) {
      note(cle, format.largeur, 'état', ouvert.faute);
      rangerEtat(cle, PAGE_TIROIR, format, { capture: null });
      return;
    }
    await finDesMouvements(page, '#tbf-tiroir, .tbf-voile', 2500);
    await new Promise((r) => setTimeout(r, 300));
    const m = await mesurer(page, '#tbf-tiroir');
    const capture = await photographier(page, `tiroir-${nomDeRoute(PAGE_TIROIR)}`, format, cle);
    rangerEtat(cle, PAGE_TIROIR, format, { capture }, m, erreurs, refus);
  } finally {
    await contexte.close();
  }
}

if (etats) {
  console.log('');
  /* Les formats de chaque état, dans le JSON : celui de 320 n'est pas dans
     « formats », qui reste la liste des pages. */
  rapport.formatsEtats = { ouverture: FORMATS_OUVERTURE.map(cleFormat), tiroir: FORMATS.map(cleFormat) };
  for (const format of FORMATS_OUVERTURE) {
    await etatOuverture(format);
    if (FORMATS.includes(format)) await etatTiroir(format);
  }
}

await nav.close();
serveur.kill();
await pool.end();

/* Le JSON d'abord : si le rapport qui suit levait, la mesure — qui a coûté
   plusieurs minutes et ne se refait pas une fois les pages touchées — serait
   quand même sur le disque. */
if (sortieJson) {
  mkdirSync(path.dirname(sortieJson), { recursive: true });
  writeFileSync(sortieJson, `${JSON.stringify(rapport, null, 2)}\n`);
}

/* -------------------------------------------------------------- le rapport */

if (!trouvailles.length) {
  console.log(`\n  Rien à signaler sur les ${VISITES.length} pages auditées.\n`);
} else {
  /* Rangé **par genre** et non par page : une même faute de mise en page se
     répète souvent sur dix écrans, et la corriger une fois les corrige tous. La
     lecture par page ferait croire à dix problèmes. */
  const parGenre = new Map();
  for (const t of trouvailles) {
    if (!parGenre.has(t.genre)) parGenre.set(t.genre, []);
    parGenre.get(t.genre).push(t);
  }

  /* **Un genre absent de cette liste ne s'affichait jamais.** « sous le décor »
     était relevé, compté dans le total de chaque page — et jamais montré,
     parce qu'on avait oublié de l'y inscrire. Les genres de la liste passent
     dans cet ordre, et **tous les autres à leur suite** : un relevé ajouté
     demain se verra même si personne ne pense à cette ligne. */
  const ORDRE_GENRES = ['script', 'image cassée', 'chargement', 'état', 'refusé (429)', 'renvoyée',
    'déborde', 'hors écran', 'hors fenêtre',
    'coupé', 'trop petit', 'pâle', 'pâle sur grain', 'sous le décor', 'petit texte', 'opacité',
    'backdrop-filter', 'pâle au jour', 'pâle au jour sur grain', 'sans alt', 'capture'];
  const genres = [...ORDRE_GENRES, ...[...parGenre.keys()].filter((g) => !ORDRE_GENRES.includes(g))];

  console.log(`\n${trouvailles.length} trouvaille(s), par genre :\n`);
  for (const genre of genres) {
    const liste = parGenre.get(genre);
    if (!liste?.length) continue;
    /* **Le même défaut, une seule ligne.** La flèche de retour fait 42 px sur
       vingt pages et trois largeurs : soixante trouvailles, un sélecteur, une
       ligne de CSS. Les lister une par une donnait un rapport qu'on ne lit pas
       jusqu'au bout — et dont les vraies singularités, celles qui n'arrivent que
       sur un écran, se noient au milieu.

       On regroupe donc sur ce qui est dit, pages mises de côté, et on nomme
       ensuite où ça se voit. Le nombre en tête est le nombre d'écrans touchés :
       c'est lui qui dit par quoi commencer. */
    const memes = new Map();
    for (const t of liste) {
      if (!memes.has(t.quoi)) memes.set(t.quoi, []);
      memes.get(t.quoi).push(t);
    }
    const range = [...memes.entries()].sort((a, b) => b[1].length - a[1].length);
    console.log(`  ── ${genre.toUpperCase()} (${liste.length} sur ${range.length} défaut(s))`);
    for (const [quoi, ou] of range.slice(0, tout ? range.length : 14)) {
      const pages = [...new Set(ou.map((t) => t.page))];
      const largeurs = [...new Set(ou.map((t) => t.largeur))];
      console.log(`     ×${String(ou.length).padStart(2)}  ${quoi}`);
      console.log(`          ${pages.slice(0, 6).join(' ')}${
        pages.length > 6 ? ` … +${pages.length - 6}` : ''}  ·  ${largeurs.join('/')} px`);
    }
    if (!tout && range.length > 14) {
      console.log(`     … et ${range.length - 14} défaut(s) de plus — \`npm run audit:ui -- --tout\``);
    }
    console.log('');
  }
}

/* ----------------------------------------------- le socle, page par page

   Le rapport par genre dit **quoi** corriger ; ce tableau dit **où en est
   chaque écran**, un nombre par format. C'est lui qu'on compare avant et
   après un lot : « /kop, 14 textes sous 11 px à 360 × 640 » se re-mesure,
   « c'est mieux » ne se re-mesure pas. Les relevés s'y comptent en entier,
   sans la coupe à quatre du rapport.

   Les colonnes « grain » et « soleil g » sont les mêmes contrastes, lus à
   travers une tuile : à part, pour que « soleil » se compare encore au
   relevé d'un lot d'avant.

   Les états ont un format de plus (l'ouverture à 320 × 568 : « – » pour le
   tiroir, qui n'y est pas mesuré) et une colonne de plus, « hors fen. »,
   le relevé qui n'existe que pour eux. */
const tableau = (titre, lignes, formats = FORMATS, enPlus = []) => {
  const colonnes = [['<11 px', 'petitTexte'], ['<0,85', 'opacite'], ['flou', 'backdrop'],
    ['grain', 'palesGrain'], ...(jour ? [['soleil', 'jour'], ['soleil g', 'jourGrain']] : []),
    ['déborde', 'deborde'], ...enPlus];
  /* Au moins la place du titre : avec un seul format, « soleil g » et
     « déborde » se collaient au titre voisin. */
  const largeurCol = Math.max(formats.length * 4 + 2, ...colonnes.map(([t]) => t.length + 2));
  const largeurCle = Math.max(16, ...lignes.map(({ cle }) => cle.length));
  console.log(`${titre} — un nombre par format (${
    formats.map((f) => `${f.largeur}×${f.hauteur}`).join(' / ')}) :\n`);
  console.log(`  ${''.padEnd(largeurCle)} ${colonnes.map(([t]) => t.padEnd(largeurCol)).join('')}`);
  for (const { cle, par } of lignes) {
    const cases = colonnes.map(([, k]) => formats
      .map((f) => String(par[cleFormat(f)]?.compte?.[k] ?? '–').padStart(3)).join(' ')
      .padEnd(largeurCol));
    console.log(`  ${cle.padEnd(largeurCle)} ${cases.join('')}${HORS_LOT.has(cle) ? '(hors lot)' : ''}`);
  }
  console.log('');
};
tableau('Le socle, page par page', VISITES.map(({ cle }) => ({ cle, par: rapport.pages[cle] ?? {} })));
if (etats) {
  tableau('Les états', Object.entries(rapport.etats)
    .filter(([, par]) => FORMATS_OUVERTURE.some((f) => par[cleFormat(f)]?.compte))
    .map(([cle, par]) => ({ cle, par })), FORMATS_OUVERTURE, [['hors fen.', 'horsFenetre']]);
}

/* **Ce que la lecture à travers le grain a rendu mesurable**, format par
   format, sur les pages : combien de textes elle a lus, combien restent
   hors mesure (vrais dégradés, photos), et combien de ceux qu'elle a lus
   manquent leur seuil. C'est la ligne à lire avant le compte « soleil » :
   quand « non mesurables » monte, un compte qui baisse ne prouve rien. */
for (const f of FORMATS) {
  const somme = (k) => Object.values(rapport.pages)
    .reduce((s, par) => s + (par[cleFormat(f)]?.compte?.[k] ?? 0), 0);
  console.log(`  Sous le grain, ${f.largeur}×${f.hauteur} : ${somme('surGrain')} texte(s) lu(s), ${
    somme('palesGrain')} pâle(s)${jour ? `, ${somme('jourGrain')} pâle(s) au jour` : ''} ; non mesurables : ${
    somme('surDegrade')}`);
}
console.log('');

if (SANS_EXEMPLE.length) {
  console.log(`  Non auditée(s), faute d’exemple dans EXEMPLES : ${SANS_EXEMPLE.join(', ')}\n`);
}
if (sortieJson) console.log(`  Relevés complets : ${sortieJson}`);
if (dossierCaptures) console.log(`  Captures : ${dossierCaptures}`);
