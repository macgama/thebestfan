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
 * Usage :
 *   node scripts/audit-ui.mjs                toutes les pages, trois largeurs
 *   node scripts/audit-ui.mjs /virage        une seule page
 *   node scripts/audit-ui.mjs --largeur 360  une seule largeur
 *   node scripts/audit-ui.mjs --tout        sans couper la liste des défauts
 */
import { spawn } from 'node:child_process';
import { ORDRE } from './ordre-schema.mjs';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { baseDeTest, OPTIONS_BASE } from './base-de-test.mjs';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const DB = baseDeTest();
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const seule = args.find((a) => a.startsWith('/'));
/* Le rapport s'arrête à quatorze défauts par genre : c'est ce qu'on lit d'une
   traite un matin. Quand on s'attelle vraiment à une catégorie, on veut les
   quatre-vingts. */
const tout = args.includes('--tout');

/* Les trois largeurs qui décident. 360 est le téléphone le plus étroit encore
   courant, 400 le téléphone ordinaire, 768 la tablette en portrait — et c'est
   là que les mises en page en colonnes changent de règle. */
const LARGEURS = opt('--largeur') ? [Number(opt('--largeur'))] : [360, 400, 768];

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
const PAGES = seule ? [seule] : [...new Set(
  [...readFileSync(path.join(RACINE, 'server.js'), 'utf8')
    .matchAll(/app\.get\('(\/[a-z-]*)',\s*\(_req, res\) => (?:res\.sendFile|page\()/g)]
    .map((m) => m[1]))];

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
const { createHash } = await import('node:crypto');
await pool.query(
  `INSERT INTO sessions (token_hash, user_id, expires_at)
   SELECT ?, id, NOW(3) + INTERVAL 1 DAY FROM users WHERE public_id = ?`,
  [createHash('sha256').update(jeton).digest('hex'), U]);

/* ------------------------------------------------------------ la mesure */

const nav = await puppeteer.launch({ args: ['--no-sandbox'] });
const trouvailles = [];
const note = (page, largeur, genre, quoi) =>
  trouvailles.push({ page, largeur, genre, quoi });

/** Le contraste d'un texte sur son fond, selon la formule WCAG. */
const MESURE = `(() => {
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

  const out = { deborde: 0, horsEcran: [], coupes: [], petits: [], pales: [],
    sansAlt: [], cassees: [], surDegrade: 0 };

  out.deborde = Math.max(0, document.documentElement.scrollWidth - window.innerWidth);

  for (const el of document.querySelectorAll('*')) {
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

console.log(`\nAUDIT D’INTERFACE — ${PAGES.length} page(s), ${LARGEURS.join(' / ')} px\n`);

for (const chemin of PAGES) {
  for (const largeur of LARGEURS) {
    const page = await nav.newPage();
    const erreurs = [];
    page.on('pageerror', (e) => erreurs.push(e.message));
    await page.setViewport({ width: largeur, height: largeur >= 768 ? 1024 : 800 });
    await page.setCookie({ name: 'tbf_session', value: jeton, domain: 'localhost', path: '/' });
    try {
      await page.goto(base + chemin, { waitUntil: 'networkidle0', timeout: 20_000 });
    } catch {
      note(chemin, largeur, 'chargement', 'la page n’a pas fini de charger en 20 s');
      await page.close();
      continue;
    }
    /* Le temps que l'écran d'ouverture parte et que les appels se posent. Sans
       ça, on mesure un écran de chargement. */
    await new Promise((r) => setTimeout(r, 1800));

    const m = await page.evaluate(MESURE);

    if (m.deborde > 0) note(chemin, largeur, 'déborde', `${m.deborde} px de large en trop`);
    for (const x of m.horsEcran.slice(0, 4)) note(chemin, largeur, 'hors écran', `${x.q} — ${x.de} px dehors`);
    for (const x of m.coupes.slice(0, 4)) note(chemin, largeur, 'coupé', `${x.q} — ${x.de} px tronqués`);
    for (const x of m.petits.slice(0, 4)) note(chemin, largeur, 'trop petit', `${x.q} — ${x.l}×${x.h}`);
    for (const x of m.pales.slice(0, 4)) note(chemin, largeur, 'pâle', `${x.q} — ${x.c}:1 (il en faut ${x.seuil}) — ${x.encre} sur ${x.sur}`);
    for (const x of m.sansAlt.slice(0, 3)) note(chemin, largeur, 'sans alt', x.q);
    for (const x of m.cassees.slice(0, 3)) note(chemin, largeur, 'image cassée', x.q);
    for (const e of erreurs.slice(0, 2)) note(chemin, largeur, 'script', e.slice(0, 90));

    const n = m.deborde + m.horsEcran.length + m.coupes.length + m.petits.length
      + m.pales.length + m.cassees.length + erreurs.length;
    console.log(`  ${chemin.padEnd(16)} ${String(largeur).padStart(4)} px   ${
      n === 0 ? 'rien à signaler' : `${n} chose(s)`}`);
    await page.close();
  }
}

await nav.close();
serveur.kill();
await pool.end();

/* -------------------------------------------------------------- le rapport */

if (!trouvailles.length) {
  console.log(`\n  Rien à signaler sur les ${PAGES.length} pages auditées.\n`);
  process.exit(0);
}

/* Rangé **par genre** et non par page : une même faute de mise en page se
   répète souvent sur dix écrans, et la corriger une fois les corrige tous. La
   lecture par page ferait croire à dix problèmes. */
const parGenre = new Map();
for (const t of trouvailles) {
  if (!parGenre.has(t.genre)) parGenre.set(t.genre, []);
  parGenre.get(t.genre).push(t);
}

const ORDRE_GENRES = ['script', 'image cassée', 'chargement', 'déborde', 'hors écran',
  'coupé', 'trop petit', 'pâle', 'sans alt'];

console.log(`\n${trouvailles.length} trouvaille(s), par genre :\n`);
for (const genre of ORDRE_GENRES) {
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
