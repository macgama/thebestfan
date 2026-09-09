/**
 * Contrôle des pages, à passer avant toute livraison front.
 *
 * Il attrape trois fautes que la relecture ne voit pas :
 *
 *   1. **Un script de page qui ne compile pas.** Une page cassée ne prévient
 *      pas : elle s'affiche à moitié et rend la main sans rien dire. On
 *      compile donc chaque bloc <script> inline, plus les fichiers autonomes
 *      de public/.
 *
 *   2. **Un accent grave égaré dans un bloc CSS écrit en gabarit de chaîne.**
 *      Un seul caractère ` au milieu d'une règle CSS ferme le gabarit et
 *      transforme la suite en code. Cette faute a cassé nav.js deux fois. Elle
 *      est invisible à la lecture parce que le reste du fichier a l'air normal,
 *      et le message du moteur pointe cinquante lignes plus bas.
 *
 *   3. **Une page qui oublie la barre commune.** Une page sans nav.js est un
 *      cul-de-sac sur téléphone : plus aucun moyen d'en sortir sans le bouton
 *      retour du navigateur.
 *
 *   4. **Un module serveur déposé dans public/.** Tout ce qui traîne dans ce
 *      dossier est servi tel quel par express.static, donc téléchargeable par
 *      n'importe qui. Une copie du télétexte y a séjourné et exposait ses
 *      requêtes SQL sur https://thebestfan.online/index.js. Le contrôle la
 *      voyait déjà, mais il n'en disait que « ne compile pas : Cannot use
 *      import statement outside a module » — un message qui décrit le symptôme
 *      et cache la fuite.
 *
 * Usage : node scripts/verif-pages.mjs
 * Sortie : 0 si tout va bien, 1 sinon — utilisable tel quel avant un déploiement.
 */
import { readdir, readFile } from 'node:fs/promises';
import { Script } from 'node:vm';
import path from 'node:path';

const DOSSIER = 'public';

/** Pages où la barre commune n'a délibérément pas sa place. */
const SANS_BARRE = new Set(['compte.html', 'bienvenue.html', 'admin.html',
  // L'accueil porte sa navigation dans ses deux rails : la barre du bas y
  // ferait doublon et passerait sous le bouton d'entrée.
  'index.html']);

let fautes = 0;
const ko = (fichier, message) => { fautes++; console.log(` FAIL  ${fichier} — ${message}`); };
const ok = (fichier, message) => console.log(`  ok   ${fichier} — ${message}`);

/**
 * Cherche un accent grave à l'intérieur d'un gabarit de chaîne qui contient du
 * CSS. On ne signale que ce cas précis : un accent grave ailleurs dans le
 * fichier est légitime, c'est justement ce qui rend la faute discrète.
 */
function accentGraveDansCss(code) {
  const soucis = [];
  // Un gabarit qui commence par du CSS reconnaissable : un sélecteur suivi
  // d'une accolade, ou une déclaration de variable personnalisée.
  const gabarits = code.matchAll(/`([^`\\]|\\.)*`/g);
  for (const g of gabarits) {
    const contenu = g[0];
    if (!/[{;]\s*(--|[a-z-]+\s*:)/i.test(contenu)) continue;
    // À l'intérieur du gabarit, un accent grave échappé est suspect : il n'a
    // aucune raison d'être dans du CSS et signale presque toujours une chaîne
    // refermée trop tôt puis rafistolée.
    const idx = contenu.indexOf('\\`');
    if (idx > 0) {
      const ligne = code.slice(0, g.index + idx).split('\n').length;
      soucis.push(`accent grave échappé dans un bloc CSS, ligne ${ligne}`);
    }
  }
  return soucis;
}

/**
 * Reconnaît un module serveur à ce qu'il importe.
 *
 * Un fichier de `public/` est chargé en script classique par le navigateur : il
 * ne peut rien importer du tout. S'il importe `express`, `mysql2` ou un module
 * `node:`, ce n'est pas un script de page mal écrit — c'est du code serveur
 * posé au mauvais endroit, et il part en ligne à la vue de tous.
 */
function moduleServeur(code) {
  const m = /^\s*import\s[^\n]*?from\s*['"](express|mysql2[^'"]*|nodemailer|socket\.io|node:[a-z/]+)['"]/m
    .exec(code);
  return m ? m[1] : null;
}

/** Compile un morceau de code et renvoie le message d'erreur, ou null. */
function compile(code, nom) {
  try { new Script(code, { filename: nom }); return null; }
  catch (e) { return e.message; }
}

const fichiers = await readdir(DOSSIER);

/* ------------------------------------------------------------ les pages */

for (const nom of fichiers.filter((f) => f.endsWith('.html')).sort()) {
  const html = await readFile(path.join(DOSSIER, nom), 'utf8');
  let blocs = 0;
  let propre = true;

  for (const m of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (/\bsrc\s*=/.test(m[1])) continue;
    blocs++;
    const erreur = compile(m[2], `${nom} bloc ${blocs}`);
    if (erreur) { ko(nom, `bloc ${blocs} ne compile pas : ${erreur}`); propre = false; }
    for (const s of accentGraveDansCss(m[2])) { ko(nom, s); propre = false; }
  }

  // La feuille commune porte la palette, la coque et le décor. Une page qui
  // l'oublie s'affiche quand même — en noir et blanc système, sans stade et
  // sans barre du haut. C'est un oubli qu'on ne voit pas en relisant un diff.
  if (!/href\s*=\s*["']\/ui\.css/.test(html)) {
    ko(nom, 'ui.css n’est pas chargée : la page perd la palette commune');
    propre = false;
  }

  if (!SANS_BARRE.has(nom) && !/src\s*=\s*["']\/nav\.js/.test(html)) {
    ko(nom, 'la barre commune (nav.js) n\u2019est pas chargée : la page est un cul-de-sac');
    propre = false;
  }

  if (propre) ok(nom, `${blocs} bloc${blocs > 1 ? 's' : ''} de script`);
}

/* -------------------------------------------------- les scripts autonomes */

for (const nom of fichiers.filter((f) => f.endsWith('.js')).sort()) {
  // Le paquet du duel est produit par esbuild : il n'est pas relu ici.
  if (nom.endsWith('.bundle.js')) continue;
  const code = await readFile(path.join(DOSSIER, nom), 'utf8');

  // Contrôlé avant la compilation : sinon c'est l'erreur de compilation qui
  // parle, et elle parle d'autre chose.
  const paquet = moduleServeur(code);
  if (paquet) {
    ko(nom, `module serveur dans public/ : il importe « ${paquet} ». Tout ce `
      + 'dossier est servi par express.static, donc ce fichier est '
      + 'téléchargeable par n’importe qui. À déplacer dans src/server/ ou à supprimer.');
    continue;
  }

  const erreur = compile(code, nom);
  if (erreur) { ko(nom, `ne compile pas : ${erreur}`); continue; }
  const soucis = accentGraveDansCss(code);
  for (const s of soucis) ko(nom, s);
  if (!soucis.length) ok(nom, 'compile');
}

/* -------------------------------------------- rien de privé dans public/

   Les rendus d'origine d'un Fanzzy pèsent cinq mégaoctets et voisinent avec
   les prompts qui les ont produits. Ils vivent dans `art/<ID>/_src/`, à la
   racine. Le jour où quelqu'un les déposera sous `public/` « juste pour
   tester », ils seront en ligne : ce dossier est servi tel quel par
   express.static, et personne ne s'en apercevra — les images s'afficheront
   très bien.

   C'est la même faute que le module serveur contrôlé plus haut, sur un autre
   type de fichier. Elle a déjà été commise une fois.                        */
{
  const suspects = [];
  const explorer = async (rel, profondeur = 0) => {
    if (profondeur > 4) return;
    for (const e of await readdir(path.join(DOSSIER, rel), { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      if (e.name === '_src' || e.name.toLowerCase() === 'src') {
        suspects.push(path.posix.join(rel, e.name));
        continue;
      }
      await explorer(path.join(rel, e.name), profondeur + 1);
    }
  };
  await explorer('');
  if (suspects.length) {
    ko('public/', `sources d'origine servies en ligne : ${suspects.join(', ')}. `
      + 'Ce dossier est public — déplace-les dans art/<ID>/_src/, à la racine.');
  } else {
    ok('public/', 'aucune source d’origine servie');
  }
}

/* ------------------------------------------------ cohérence du catalogue */

/**
 * `public/fanzzy.html` a longtemps gardé sa propre copie du catalogue, et
 * cette copie avait divergé : la lignée du Gamin de Devant y manquait alors
 * que le serveur la tirait des boosters, et un G1 sorti d'un paquet cassait
 * l'ouverture.
 *
 * La page lit maintenant `/api/fanzzy/dex`. Ce contrôle garde la porte
 * fermée : il refuse qu'un catalogue soit à nouveau écrit en dur, parce
 * qu'une copie qu'il faut penser à mettre à jour finit toujours par ne plus
 * l'être.
 */
{
  const html = await readFile(path.join(DOSSIER, 'fanzzy.html'), 'utf8');

  // Un catalogue recopié se reconnaît à une suite d'entrées littérales.
  const entrees = [...html.matchAll(/\{\s*id:\s*'[A-Z]\d+'\s*,\s*nom:/g)].length;
  if (entrees > 2) {
    ko('fanzzy.html', `${entrees} Fanzzy écrits en dur : le catalogue est de nouveau `
      + 'recopié au lieu d\u2019être lu depuis /api/fanzzy/dex');
  } else if (!/['"`]\/dex['"`]|api\/fanzzy\/dex/.test(html)) {
    ko('fanzzy.html', 'le catalogue n\u2019est ni recopié ni demandé au serveur');
  } else {
    ok('fanzzy.html', 'catalogue lu depuis /api/fanzzy/dex, aucune copie locale');
  }

  // Une illustration promise mais absente laisse un cadre vide sans message.
  //
  // La liste vit dans fanzzy-art.js depuis que l'accueil dessine les mêmes
  // personnages. Ce contrôle la cherchait dans fanzzy.html : après le
  // déplacement il ne trouvait plus rien, annonçait « 0 illustration » et
  // passait au vert. Un garde-fou devenu muet est pire que pas de garde-fou,
  // donc on échoue si la liste est introuvable au lieu de la supposer vide.
  const artjs = await readFile(path.join(DOSSIER, 'fanzzy-art.js'), 'utf8');
  const brut = artjs.match(/ILLUSTRES = new Set\(\[([^\]]*)\]/)?.[1];
  if (brut === undefined) {
    ko('fanzzy-art.js', 'liste ILLUSTRES introuvable : le contrôle des '
      + 'illustrations ne vérifie plus rien. A-t-elle été déplacée ?');
  }
  const illu = [...(brut ?? '').matchAll(/'([A-Z0-9]+)'/g)].map((m) => m[1]);
  const manquants = [];
  for (const id of illu) {
    for (const variante of ['', '-buste']) {
      for (const ext of ['.avif', '.webp', '.png']) {
        const f = path.join(DOSSIER, 'img', 'fanzzy', id + variante + ext);
        try { await readFile(f); } catch { manquants.push(id + variante + ext); }
      }
    }
  }
  if (manquants.length) ko('fanzzy-art.js', `illustrations annoncées mais absentes : ${manquants.join(', ')}`);
  else if (brut !== undefined) ok('fanzzy-art.js', `${illu.length} illustration(s) présentes en trois formats`);
}

console.log(fautes
  ? `\n${fautes} faute(s) — ne pas livrer en l\u2019état.`
  : '\nToutes les pages compilent, la barre est partout où elle doit être.');
process.exit(fautes ? 1 : 0);
