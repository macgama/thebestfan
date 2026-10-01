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
 * Usage :
 *   node scripts/audit-ui.mjs                  toutes les pages, trois formats
 *   node scripts/audit-ui.mjs /virage          une seule page
 *   node scripts/audit-ui.mjs --largeur 360    un seul format
 *   node scripts/audit-ui.mjs --tout           sans couper la liste des défauts
 *   node scripts/audit-ui.mjs --jour           et le contraste au soleil
 *   node scripts/audit-ui.mjs --json a.json    tous les relevés, pour une machine
 *   node scripts/audit-ui.mjs --captures dos   une capture par page et par format
 *   node scripts/audit-ui.mjs --pleine         captures de la page entière
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
const FORMATS = opt('--largeur')
  ? [FORMATS_BASE.find((f) => f.largeur === Number(opt('--largeur')))
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

/** Le contraste d'un texte sur son fond, selon la formule WCAG. */
const MESURE = `(() => {
  const SEUILS = ${JSON.stringify(SEUILS)};
  const LEGAL = ${JSON.stringify(LEGAL.join(','))};
  const JOUR = ${jour};
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

  const fond = (el) => {
    const couches = [];
    let n = el;
    while (n && n !== document.documentElement) {
      const s = getComputedStyle(n);
      if (s.backgroundImage && s.backgroundImage !== 'none') return null;
      const c = lire(s.backgroundColor);
      if (c[3] > 0) {
        couches.push(c);
        if (c[3] >= 0.999) break;   /* opaque : rien derrière ne se voit plus */
      }
      n = n.parentElement;
    }
    /* Le fond de la page ferme la pile : si on est sorti de la boucle sans
       rencontrer d'opaque, c'est lui qu'on voit à travers. */
    let out = [10, 13, 17, 1];
    if (couches.length && couches[couches.length - 1][3] >= 0.999) out = couches.pop();
    for (let i = couches.length - 1; i >= 0; i -= 1) out = [...composer(couches[i], out), 1];
    return \`rgb(\${out[0]}, \${out[1]}, \${out[2]})\`;
  };
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

  const out = { deborde: 0, horsEcran: [], coupes: [], petits: [], pales: [],
    sansAlt: [], cassees: [], surDegrade: 0, sousDecor: [],
    textes: 0, petitTexte: [], opacite: [], toleres: [], backdrop: [],
    jour: [], jourSurDegrade: 0 };

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
     positionné et porter un \`z-index\` supérieur. */
  {
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

  out.deborde = Math.max(0, document.documentElement.scrollWidth - window.innerWidth);

  for (const el of document.querySelectorAll('*')) {
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
        /* Le fond est rappelé dans la trouvaille. « 4.3:1 » sans dire sur quoi
           ne se corrige pas : on ne sait pas laquelle des deux couleurs bouger. */
        if (c < seuil) {
          out.pales.push({ q: nom(el), c: c.toFixed(1), seuil, px: Math.round(taille),
            sur: fond(el), encre: getComputedStyle(el).color });
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
        if (cj < seuil) {
          out.jour.push({ q: nom(el), c: cj.toFixed(1), seuil, px: Math.round(taille),
            sur: fond(el), encre: s.color, legal: Boolean(el.closest(LEGAL)) });
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

  for (const img of document.querySelectorAll('img')) {
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
const rapport = {
  schema: 'audit-ui/1',
  date: new Date().toISOString(),
  commit: git('rev-parse', '--short', 'HEAD'),
  publicModifie: Boolean(git('status', '--porcelain', '--', 'public')),
  options: { jour, pleine, seule: seule ?? null },
  seuils: SEUILS,
  legal: LEGAL,
  formats: FORMATS.map(cleFormat),
  horsLot: [...HORS_LOT],
  nonAuditees: SANS_EXEMPLE,
  /* Une entrée par visite, sous sa clé : la route, ou « / (sans compte) »
     pour la vitrine. Chacune porte ensuite un format par clé « 360x640 ». */
  visites: VISITES.map(({ cle, chemin, qui }) => ({ cle, chemin, qui: qui ?? 'sans compte' })),
  pages: {},
};
if (dossierCaptures) mkdirSync(dossierCaptures, { recursive: true });

console.log(`\nAUDIT D’INTERFACE — ${VISITES.length} page(s), ${
  FORMATS.map((f) => `${f.largeur}×${f.hauteur}`).join(' / ')}${jour ? ', au jour' : ''}\n`);

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

for (const { chemin, cle, qui, nom: nomCapture } of VISITES) {
  rapport.pages[cle] = {};
  for (const format of FORMATS) {
    const { largeur, hauteur } = format;
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

    const m = await page.evaluate(MESURE);

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

    if (m.deborde > 0) note(cle, largeur, 'déborde', `${m.deborde} px de large en trop`);
    for (const x of m.horsEcran.slice(0, 4)) note(cle, largeur, 'hors écran', `${x.q} — ${x.de} px dehors`);
    for (const x of m.coupes.slice(0, 4)) note(cle, largeur, 'coupé', `${x.q} — ${x.de} px tronqués`);
    for (const x of m.petits.slice(0, 4)) note(cle, largeur, 'trop petit', `${x.q} — ${x.l}×${x.h}`);
    for (const x of m.pales.slice(0, 4)) note(cle, largeur, 'pâle', `${x.q} — ${x.c}:1 (il en faut ${x.seuil}) — ${x.encre} sur ${x.sur}`);
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
    }
    for (const e of erreurs.slice(0, 2)) note(cle, largeur, 'script', e.slice(0, 90));

    /* Tous les relevés, sans la coupe à quatre du rapport : le JSON sert à
       compter et à comparer, pas à lire d'une traite. Le contraste au jour
       n'y figure que s'il a été mesuré — un zéro qu'on n'a pas mesuré se
       lirait comme un bon résultat. */
    if (!jour) { delete m.jour; delete m.jourSurDegrade; }
    rapport.pages[cle][cleFormat(format)] = {
      largeur, hauteur, charge: true, essais, capture, qui: qui ?? 'sans compte', arrivee,
      compte: {
        deborde: m.deborde, horsEcran: m.horsEcran.length, coupes: m.coupes.length,
        petits: m.petits.length, pales: m.pales.length, surDegrade: m.surDegrade,
        sansAlt: m.sansAlt.length, cassees: m.cassees.length, sousDecor: m.sousDecor.length,
        scripts: erreurs.length, refus: refus.length, textes: m.textes,
        petitTexte: m.petitTexte.length, opacite: m.opacite.length, toleres: m.toleres.length,
        backdrop: m.backdrop.length,
        ...(jour ? { jour: m.jour.length, jourSurDegrade: m.jourSurDegrade } : {}),
      },
      releves: { ...m, scripts: erreurs, refus },
    };

    const n = m.deborde + m.horsEcran.length + m.coupes.length + m.petits.length
      + m.pales.length + m.cassees.length + m.sousDecor.length + erreurs.length + refus.length
      + m.petitTexte.length + m.opacite.length + m.backdrop.length + (jour ? m.jour.length : 0);
    console.log(`  ${cle.padEnd(16)} ${`${largeur}×${hauteur}`.padStart(9)}   ${
      n === 0 ? 'rien à signaler' : `${n} chose(s)`}${HORS_LOT.has(cle) ? '   (hors lot)' : ''}${
      arrivee !== new URL(base + chemin).pathname ? `   → ${arrivee}` : ''}`);
    await contexte.close();
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
  const ORDRE_GENRES = ['script', 'image cassée', 'chargement', 'refusé (429)', 'renvoyée',
    'déborde', 'hors écran',
    'coupé', 'trop petit', 'pâle', 'sous le décor', 'petit texte', 'opacité',
    'backdrop-filter', 'pâle au jour', 'sans alt', 'capture'];
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
   sans la coupe à quatre du rapport. */
{
  const colonnes = [['<11 px', 'petitTexte'], ['<0,85', 'opacite'], ['flou', 'backdrop'],
    ...(jour ? [['soleil', 'jour']] : []), ['déborde', 'deborde']];
  const largeurCol = FORMATS.length * 4 + 2;
  console.log(`Le socle, page par page — un nombre par format (${
    FORMATS.map((f) => `${f.largeur}×${f.hauteur}`).join(' / ')}) :\n`);
  console.log(`  ${''.padEnd(16)} ${colonnes.map(([t]) => t.padEnd(largeurCol)).join('')}`);
  for (const { cle } of VISITES) {
    const par = rapport.pages[cle] ?? {};
    const cases = colonnes.map(([, k]) => FORMATS
      .map((f) => String(par[cleFormat(f)]?.compte?.[k] ?? '–').padStart(3)).join(' ')
      .padEnd(largeurCol));
    console.log(`  ${cle.padEnd(16)} ${cases.join('')}${HORS_LOT.has(cle) ? '(hors lot)' : ''}`);
  }
  console.log('');
}

if (SANS_EXEMPLE.length) {
  console.log(`  Non auditée(s), faute d’exemple dans EXEMPLES : ${SANS_EXEMPLE.join(', ')}\n`);
}
if (sortieJson) console.log(`  Relevés complets : ${sortieJson}`);
if (dossierCaptures) console.log(`  Captures : ${dossierCaptures}`);
