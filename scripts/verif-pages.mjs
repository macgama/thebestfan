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
 *   5. **Les règles du socle FAIT MAIN** qui se lisent dans le texte : aucun
 *      backdrop-filter, aucun émoji cadenas ou coche, aucun « .calc( », et un
 *      data-ton sur chaque rail d'onglets. Voir leur section, en fin de
 *      fichier ; ce qui demande un rendu est mesuré par audit-ui.mjs.
 *
 * Usage : node scripts/verif-pages.mjs
 * Sortie : 0 si tout va bien, 1 sinon — utilisable tel quel avant un déploiement.
 */
import { readdir, readFile } from 'node:fs/promises';
import { readFileSync, existsSync } from 'node:fs';
import { Script, createContext } from 'node:vm';
import path from 'node:path';
/* Les listes de référence viennent des modules eux-mêmes, pas d'une lecture au
   motif du fichier source. Une première version lisait les identifiants à
   l'expression régulière : le jour où un `id:` changeait de forme, le contrôle
   se contentait de vérifier moins de pièces et **restait vert** — un garde-fou
   qui rétrécit en silence ne garde plus rien. */
import { ACTIONS } from '../src/shared/duel/actions.js';
import { LISTE_CHANTS } from '../src/shared/duel/chants.js';
import { STUFF } from '../src/shared/fanzzy/inventaire.js';

const DOSSIER = 'public';
const RACINE = '.';

/** Pages où la barre commune n'a délibérément pas sa place. */
/* Les pages qui ne suivent pas la colonne du jeu, et pourquoi.
 *
 * `admin.html` est hors jeu au sens propre : ce n'est pas un écran de supporter
 * mais un écran de gestion — des tables de joueurs, un journal, un catalogue de
 * six cents cartes. Il tient sa largeur à mille cent pixels parce qu'un tableau
 * à six colonnes ne se lit pas dans neuf cents, et il n'a aucune raison de
 * suivre la colonne du jeu.
 *
 * C'est la seule, et toute autre entrée ici demande la même justification :
 * une exception écrite sans raison redevient une largeur oubliée. */
const HORS_COLONNE = new Set(['admin.html']);

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
/**
 * Cherche une unité de conteneur — `cqw`, `cqi`, `cqh`, `cqb` — employée en
 * dehors d'un bloc `@container`.
 *
 * **C'est un piège qui ne se voit pas sur la machine qui l'écrit.** Quand
 * `container-type` ne prend pas — un navigateur d'avant 2023, un moteur qui
 * connaît l'unité sans connaître le confinement — `cqw` ne disparaît pas : elle
 * se rabat silencieusement sur la **fenêtre**. Une vignette de 130 px voit
 * alors ses mesures multipliées par plus de trois : le classeur affichait des
 * cartes en forme de galet, avec des noms coupés des deux côtés par l'arrondi.
 *
 * La parade est de déclarer un repli en pixels, puis de ne poser l'unité de
 * conteneur qu'à l'intérieur d'un `@container` — qui, lui, ne s'applique que
 * là où le confinement fonctionne vraiment. Ce contrôle vérifie qu'on l'a
 * fait : il retire les blocs `@container` et cherche ce qui reste.
 */
function uniteDeConteneurSansGarde(css) {
  /* Les commentaires d'abord. Le paragraphe qui explique ce piège cite les
     unités qu'il dénonce — sans cette coupe, le contrôle se déclenchait sur
     sa propre documentation, ce qui apprend surtout à ne plus l'écrire. */
  css = css.replace(/\/\*[\s\S]*?\*\//g, ' ');
  // On retire les blocs `@container { … }`, accolades imbriquées comprises.
  let net = '';
  for (let i = 0; i < css.length; i++) {
    if (!css.startsWith('@container', i)) { net += css[i]; continue; }
    const debut = css.indexOf('{', i);
    if (debut < 0) break;
    let profondeur = 0, j = debut;
    for (; j < css.length; j++) {
      if (css[j] === '{') profondeur++;
      else if (css[j] === '}' && --profondeur === 0) break;
    }
    i = j;
  }
  const soucis = [];
  for (const m of net.matchAll(/[\d.]+cq[whib]\b/g)) {
    const ligne = net.slice(0, m.index).split('\n').length;
    soucis.push(`« ${m[0]} » hors d’un bloc @container, ligne ${ligne} `
      + '— sans confinement, cette mesure se rabat sur la fenêtre');
  }
  // Un seul message par page : trente occurrences de la même faute noieraient
  // le rapport sans rien apprendre de plus.
  return soucis.slice(0, 1);
}

/**
 * Un geste qui avance au rythme des images.
 *
 * `charge += 0.02` à chaque `requestAnimationFrame` : sur un écran à cent
 * vingt hertz c'est instantané, sur une page chargée qui rend douze images par
 * seconde c'est quatre secondes d'immobilité parfaite. Le même code, deux
 * jeux différents, et rien ne le signale — le développeur a une machine
 * rapide.
 *
 * C'est arrivé deux fois : au kiosque, puis à l'inscription, qui avait gardé
 * l'ancienne mécanique après que le kiosque eut été refait. Un geste se mesure
 * en distance parcourue ou en millisecondes, jamais en images rendues.
 */
function gesteAuRythmeDesImages(code) {
  const fautes = [];
  /* On cherche un compteur incrémenté d'une constante à l'intérieur d'une
     fonction que `requestAnimationFrame` rappelle. Le motif est étroit
     exprès : une animation qui *dessine* à chaque image est normale, c'est
     **décider** à chaque image qui ne l'est pas. */
  /* `[\w.]` et non `\w` : le compteur est presque toujours qualifié —
     `tear.charge`, `etat.avance`. Un motif qui ne reconnaît que les noms nus
     laisse passer exactement les cas qu'on a rencontrés. */
  for (const m of code.matchAll(/([\w.]+)\s*=\s*Math\.min\(\s*1\s*,\s*\1\s*\+\s*0?\.\d+\s*\)/g)) {
    if (/requestAnimationFrame/.test(code)) {
      fautes.push(`« ${m[0]} » fait avancer un geste au rythme des images : `
        + 'instantané sur une machine rapide, impossible sur une machine lente. '
        + 'Mesure une distance ou des millisecondes.');
    }
  }
  return fautes;
}

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
    for (const s of gesteAuRythmeDesImages(m[2])) { ko(nom, s); propre = false; }
  }

  // La feuille commune porte la palette, la coque et le décor. Une page qui
  // l'oublie s'affiche quand même — en noir et blanc système, sans stade et
  // sans barre du haut. C'est un oubli qu'on ne voit pas en relisant un diff.
  if (!/href\s*=\s*["']\/ui\.css/.test(html)) {
    ko(nom, 'ui.css n’est pas chargée : la page perd la palette commune');
    propre = false;
  }

  for (const m of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) {
    for (const s of uniteDeConteneurSansGarde(m[1])) { ko(nom, s); propre = false; }
  }

  if (!SANS_BARRE.has(nom) && !/src\s*=\s*["']\/nav\.js/.test(html)) {
    ko(nom, 'la barre commune (nav.js) n\u2019est pas chargée : la page est un cul-de-sac');
    propre = false;
  }

  /* **Une page qui ne s'installerait pas.**

     Le jeu s'installe sur un téléphone : une icône sur l'écran d'accueil, et
     plus de barre de navigateur. Cela ne tient qu'à des déclarations recopiées
     dans l'en-tête de chaque page — c'est ainsi que le HTML fonctionne — et
     trois d'entre elles les avaient perdues en chemin : boosters, boutique et
     le KOP. Rien ne cassait. Un joueur qui installait depuis l'une de ces
     pages obtenait simplement un raccourci qui rouvrait le navigateur, barre
     d'adresse comprise, et il n'avait aucun moyen de savoir pourquoi.

     C'est la faute typique qu'on ne voit jamais en essayant : on essaie depuis
     l'accueil, qui les avait. */
  const POUR_INSTALLER = [
    ['manifest.webmanifest', 'le manifeste — sans lui, pas d’installation du tout'],
    ['viewport-fit=cover', 'viewport-fit=cover — sans lui, l’encoche mange l’écran'],
    ['apple-mobile-web-app-capable', 'la balise d’iOS — sans elle, iPhone rouvre Safari'],
    ['apple-touch-icon', 'l’icône d’iOS — sans elle, iPhone pose une capture d’écran'],
    ['theme-color', 'la couleur de la barre d’état'],
  ];
  for (const [motif, quoi] of POUR_INSTALLER) {
    if (!html.includes(motif)) {
      ko(nom, `${quoi} manque : installée depuis cette page, l’application `
        + 'ne serait pas en plein écran');
      propre = false;
    }
  }

  /* Et le script qui inscrit le service worker, sans lequel Chrome ne propose
     rien. Il est à part parce qu'aucun fichier commun n'est chargé par les
     vingt pages : `nav.js` manque sur quatre écrans, `menu.js` sur deux, et
     c'est justement `/compte` — par où passent tous les nouveaux — qui tombait
     dans les deux trous. */
  if (!/src\s*=\s*["']\/pwa\.js/.test(html)) {
    ko(nom, 'pwa.js n’est pas chargée : depuis cette page, Android ne '
      + 'proposera pas d’installer le jeu');
    propre = false;
  }

  /* **La boîte de confirmation, partout.**

     Chaque écran a au moins un geste qui engage, et la seule chose pire qu'une
     absence de confirmation est une confirmation qui n'apparaît que sur
     certains écrans : le joueur apprend alors que le jeu ne demande pas, et il
     cesse de lire le jour où il demande.

     Les appels sont écrits `window.TBF_DIALOGUE?.confirmer(...)`. Sans le
     script, la garde `?.` rend `undefined` — donc le geste **passe sans rien
     demander** au lieu de lever. Un oubli ici ne casse rien et retire une
     protection : exactement la faute qu'aucune suite n'attrape. */
  if (!/src\s*=\s*["']\/dialogue\.js/.test(html)) {
    ko(nom, 'dialogue.js n’est pas chargée : les confirmations de cette page '
      + 'passeraient sans rien demander');
    propre = false;
  }

  /* **Un seul menu, et une seule liste de destinations.**

     L'accueil s'était écrit le sien, à la main, dans son HTML : cinq entrées
     quand le menu commun en portait onze, sans rubriques, et avec une
     déconnexion qui demandait confirmation d'un côté et pas de l'autre. Rien
     ne cassait — les deux menus s'ouvraient, les deux menaient quelque part —
     et c'est bien pour ça que l'écart a tenu.

     Deux contrôles, parce que la faute a deux formes. Un tiroir écrit à la
     main dans une page, d'abord : c'est ainsi qu'elle est née. Et une page
     sans `menu.js`, ensuite : `nav.js` s'en sert, et son absence le ferait
     lever avant même de poser la barre du haut.

     `MENU_A_PART` n'a que les deux écrans où l'on n'est pas encore entré dans
     le jeu : proposer « Mon deck » à quelqu'un qui n'a pas de compte n'est pas
     une navigation, c'est une impasse de plus. */
  const MENU_A_PART = new Set(['compte.html', 'bienvenue.html']);
  if (!MENU_A_PART.has(nom)) {
    if (!/src\s*=\s*["']\/menu\.js/.test(html)) {
      ko(nom, 'menu.js n’est pas chargée : cette page n’a pas le menu du jeu '
        + '(et nav.js, qui s’en sert, lèverait avant de poser la barre du haut)');
      propre = false;
    }
    if (/class\s*=\s*["'][^"']*\btiroir\b/.test(html)) {
      ko(nom, 'un tiroir de menu écrit dans la page : le menu vient de menu.js, '
        + 'et un second finit toujours par ne plus dire la même chose');
      propre = false;
    }
  }

  /* **Une seule largeur de colonne pour toute l'application.**

     Chaque page portait la sienne — 440, 460 ou 520 pixels selon l'écran et le
     jour. Trois largeurs dans le même jeu, et surtout : la variable `--colonne`
     d'`ui.css`, qui prétend décider de ce réglage, n'avait aucun effet. Sur une
     tablette, tout tenait dans un rail étroit au milieu d'un écran noir, et
     élargir la variable ne changeait rien du tout.

     Une largeur en dur ne casse rien et ne se voit pas dans un diff : c'est
     exactement le genre d'exception qui revient.

     Le contrôle vise **la coque de page** — `#app` ou `main` — et rien d'autre.
     Un premier jet regardait tous les `max-width` : il attrapait un paragraphe
     d'administration capé à six cent quarante pixels pour se lire, ce qui est
     exactement ce qu'il faut faire. Une largeur de texte n'est pas une largeur
     de colonne, et un contrôle qui confond les deux se fait désactiver. */
  const enDur = [];
  for (const bloc of (HORS_COLONNE.has(nom) ? [] : html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g))) {
    const css = bloc[1].replace(/\/\*[\s\S]*?\*\//g, '');
    for (const regle of css.split('}')) {
      const [tete, corps] = regle.split('{');
      if (!corps) continue;
      // Le sujet est la coque : `#app`, ou `main` seul — pas `main .carte`.
      if (!/(^|,)\s*(#app|main)\s*(,|$)/.test(tete)) continue;
      const m = /max-width:\s*(\d+)px/.exec(corps);
      if (m) enDur.push(m[1]);
    }
  }
  if (enDur.length) {
    ko(nom, `la coque de page fixe sa largeur : ${[...new Set(enDur)].join(', ')}px. `
      + 'Emploie `var(--colonne)` — sinon cette page ne suivra pas quand la '
      + 'colonne s’élargira, et personne ne le verra.');
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
 * que le serveur la tirait des boosters, et un TR37 sorti d'un paquet cassait
 * l'ouverture.
 *
 * La page lit maintenant `/api/fanzzy/dex`. Ce contrôle garde la porte
 * fermée : il refuse qu'un catalogue soit à nouveau écrit en dur, parce
 * qu'une copie qu'il faut penser à mettre à jour finit toujours par ne plus
 * l'être.
 */
{
  /* La page **et** le fichier d aides : le catalogue a quitté fanzzy.html le
     jour où le kiosque a eu son écran à lui, et il est parti dans cartes.js
     avec le reste de ce que les deux écrans partagent. Ne regarder que la
     page ferait rougir ce contrôle sur une extraction parfaitement saine —
     et, pire, le laisserait vert le jour où quelqu un recopierait le
     catalogue dans le fichier d aides. */
  const html = (await readFile(path.join(DOSSIER, 'fanzzy.html'), 'utf8'))
    + (await readFile(path.join(DOSSIER, 'cartes.js'), 'utf8'));

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

  /* ------------------------- et l'extension que le navigateur va demander

     Le contrôle d'au-dessus vérifie que les fichiers sont là. Il ne dit rien de
     **celui que la page demande**, et c'est par là que le personnage de
     l'accueil a disparu : les Fanzzy sont publiés en AVIF, WebP et PNG, et
     `fanzzy-art.js` servait un `.jpg` à tout ce qui n'est pas Chrome. Trois
     formats au vert, un quatrième demandé, et un 404 sur chaque écran d'accueil
     de Firefox et d'iPhone.

     On monte donc le vrai module et on regarde les deux adresses qu'il
     construit — le buste d'une carte, le plein-pied de l'accueil — ainsi que
     l'adresse de secours qui prend le relais quand la première échoue. Les
     trois doivent désigner un fichier qui existe. */
  {
    const bac = {
      // Un `window` nu : le module doit savoir se passer de `fanzzy-etats.js`,
      // et un canvas qui lève est le cas d'un mode de confidentialité strict.
      window: {},
      document: { createElement: () => { throw new Error('pas de canvas'); } },
    };
    bac.globalThis = bac;
    new Script(artjs, { filename: 'fanzzy-art.js' }).runInContext(createContext(bac));
    const { adresse, secours } = bac.window.FZART ?? {};
    if (typeof adresse !== 'function') {
      ko('fanzzy-art.js', 'FZART.adresse introuvable : le contrôle des '
        + 'extensions ne vérifie plus rien');
    } else {
      const fantomes = [];
      // Un échantillon suffit : l'extension ne dépend pas du personnage. On
      // prend le premier et le dernier de la liste, plus le Fanzzy équipé par
      // défaut, pour que l'oubli d'une variante se voie quand même.
      for (const id of [illu[0], illu.at(-1), 'TR57'].filter(Boolean)) {
        for (const variante of ['buste', 'plein']) {
          const src = adresse(id, variante);
          if (!src) continue;
          for (const adr of [src, secours?.(src)].filter(Boolean)) {
            const f = path.join(DOSSIER, adr.split('?')[0].replace(/^\//, ''));
            if (!existsSync(f)) fantomes.push(adr);
          }
        }
      }
      if (fantomes.length) {
        ko('fanzzy-art.js', 'adresses servies au navigateur mais sans fichier : '
          + `${fantomes.join(', ')} — un Fanzzy n'existe qu'en .avif, .webp et .png`);
      } else {
        ok('fanzzy-art.js', 'l’adresse servie et son secours désignent des fichiers présents');
      }
    }
  }

  /* Les dessins des cartes d'action.
     La liste de référence est le catalogue lui-même : `action-art.js` promet
     un fichier pour n'importe quelle carte qu'on lui nomme, donc toute carte
     ajoutée aux règles promet un dessin. Une carte sans fichier se voit — elle
     retombe sur son glyphe — mais c'est un appauvrissement silencieux, et
     silencieux veut dire qu'il durera. */
  const cartes = ACTIONS.map((a) => a.id);
  const sansDessin = [];
  for (const id of cartes) {
    for (const ext of ['.avif', '.webp', '.jpg']) {
      const f = path.join(DOSSIER, 'img', 'action', id + ext);
      try { await readFile(f); } catch { sansDessin.push(id + ext); }
    }
  }
  if (sansDessin.length) {
    ko('action-art.js', `cartes sans dessin : ${sansDessin.join(', ')}`
      + ' — les invites sont dans scripts/action-images.mjs --invites');
  } else if (cartes.length) {
    ok('action-art.js', `${cartes.length} carte(s) d’action dessinées en trois formats`);
  }

  /* Les dessins de l'équipement, même raison et même forme.
     Le format de secours est le PNG et non le JPEG : ces objets sont détourés
     et ont une transparence à garder. Chercher un `.jpg` ici passerait au vert
     sur des fichiers qui n'existent pas. */
  const pieces = STUFF.map((s) => s.id);
  const nues = [];
  for (const id of pieces) {
    for (const ext of ['.avif', '.webp', '.png']) {
      const f = path.join(DOSSIER, 'img', 'stuff', id + ext);
      try { await readFile(f); } catch { nues.push(id + ext); }
    }
  }
  if (nues.length) {
    ko('stuff-art.js', `pièces sans dessin : ${nues.join(', ')}`
      + ' — les invites sont dans scripts/stuff-images.mjs --invites');
  } else if (pieces.length) {
    ok('stuff-art.js', `${pieces.length} pièce(s) d’équipement détourées en trois formats`);
  }

  /* Les dessins des chants, même raison et même forme que les cartes d'action.
     La liste de référence est `LISTE_CHANTS` : tout chant ajouté au Virage
     promet donc un dessin, et un chant sans fichier retombe sur son fond uni
     — visible à l'œil, mais seulement pour qui regarde cette case-là. */
  const chants = LISTE_CHANTS.map((c) => c.id);
  const muets = [];
  for (const id of chants) {
    for (const ext of ['.avif', '.webp', '.jpg']) {
      const f = path.join(DOSSIER, 'img', 'chant', id + ext);
      try { await readFile(f); } catch { muets.push(id + ext); }
    }
  }
  if (muets.length) {
    ko('chant-art.js', `chants sans dessin : ${muets.join(', ')}`
      + ' — les invites sont dans scripts/chant-images.mjs --invites');
  } else if (chants.length) {
    ok('chant-art.js', `${chants.length} chant(s) illustrés en trois formats`);
  }
}

/* ============================= le préfixe de la feuille commune

   **Une classe sans préfixe dans `ui.css` réécrit celle d'une page qui ne lui
   a rien demandé.**

   La règle est écrite en tête de `ui.css` depuis toujours : « Sans ce préfixe,
   `.voile` de deck.html et `.pastille` de fanzzy-fiche.html seraient réécrits
   par des règles qu'ils n'ont pas demandées. » Elle n'était vérifiée par
   personne, et elle a fini par être enfreinte.

   Le mini-jeu du compte est arrivé dans `ui.css` sous le nom `.compte`. Le deck
   avait déjà un `.compte` — le compteur d'exemplaires d'une carte. La feuille
   commune est chargée **avant** le style de la page, donc la page gagnait sur
   les propriétés qu'elles partageaient ; mais `width:100%` et `height:100%`
   n'existaient que dans la commune et s'appliquaient sans opposition. Le petit
   compteur « ×1 » prenait toute la largeur de la ligne, le texte de la carte
   tombait à un mot par ligne, et rien n'était en erreur nulle part.

   Le contrôle compare les classes déclarées dans `ui.css` à celles employées
   dans les pages. Il ne juge pas le nom : il signale une classe **qui existe
   des deux côtés** sans être une brique partagée déclarée.                   */
{
  const commune = await readFile(path.join(DOSSIER, 'ui.css'), 'utf8');

  /* Les briques partagées qui n'ont **pas** le préfixe, et c'est voulu : ce
     sont des vocabulaires que les pages emploient délibérément. La liste est
     courte exprès — elle doit rester une exception qu'on relit. */
  const PARTAGEES = new Set([
    'pan',
    'r-commune', 'r-rare', 'r-epique', 'r-legendaire',
    'b-commune', 'b-rare', 'b-epique', 'b-legendaire',
    /* Les formes du mini-jeu, posées par `geste.js` dans la zone que la page
       lui prête : elles n'appartiennent à aucune page en propre.

       **`grille` en est sortie.** Elle y était depuis le début, et c'était une
       erreur : deux pages s'en servaient déjà pour autre chose — la grille des
       cartes d'action du deck, et les formulaires de l'administration. La règle
       commune leur imposait `width:86%; margin:0 auto`, qui n'a de sens que pour
       la mosaïque : le formulaire des saisons sortait donc centré sur les deux
       tiers de la largeur, avec son champ d'annonce débordant par-dessus son
       étiquette.

       Une exception écrite « c'est du vocabulaire partagé » ne le rend pas
       partagé. `geste.js` pose maintenant `tbf-grille`. */
    'pad', 'ring', 'illu', 'illuwrap',
    'memo', 'trace', 'rond', 'mise', 'vue', 'prise', 'hit', 'beat', 'noir',
    'on', 'n', 's', 'lib', 'sil', 'tri', 'capo',
  ]);

  /* **On regarde le sujet de la règle, pas ses ancêtres.**
     Ce qui compte n'est pas quelles classes un sélecteur mentionne : c'est sur
     quel élément les propriétés atterrissent — le dernier composé — et si cet
     élément est tenu par un ancêtre de la feuille commune.

     `.tbf-tiroir .pip` ne peut atteindre que ce que la commune a elle-même
     posé ; `.compte` tout seul atteint n'importe quel `.compte` de n'importe
     quelle page. La différence est là, et elle est entière. */
  const sujetsLibres = (css) => {
    const libres = new Set();
    const tenu = (c) => c.startsWith('tbf-') || PARTAGEES.has(c);
    const classes = (compose) =>
      [...compose.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]);

    for (const regle of css.replace(/\/\*[\s\S]*?\*\//g, '').split('}')) {
      const tete = regle.split('{')[0];
      if (!tete || !tete.includes('.')) continue;
      for (const sel of tete.split(',')) {
        const composes = sel.trim().split(/\s*[\s>+~]\s*/).filter(Boolean);
        if (!composes.length) continue;
        const sujet = composes[composes.length - 1];
        const porte = composes.slice(0, -1).some((c) => classes(c).some(tenu));
        if (porte) continue;                    // tenu par un ancêtre commun
        for (const c of classes(sujet)) if (!tenu(c)) libres.add(c);
      }
    }
    return libres;
  };

  const deLaCommune = [...sujetsLibres(commune)];

  /* Ce que les pages emploient réellement : leurs attributs `class`, y compris
     ceux qu'un gabarit de chaîne écrit depuis le JavaScript. */
  const employees = new Set();
  for (const f of (await readdir(DOSSIER)).filter((x) => x.endsWith('.html'))) {
    const page = await readFile(path.join(DOSSIER, f), 'utf8');
    for (const m of page.matchAll(/class="([^"\$]*)"/g)) {
      for (const c of m[1].split(/\s+/)) if (c) employees.add(c);
    }
  }

  const collisions = deLaCommune.filter((c) => employees.has(c));
  if (collisions.length) {
    ko('ui.css', `classe(s) sans préfixe employée(s) par une page : ${collisions.join(', ')}`);
    console.log('       La feuille commune est chargée avant le style des pages : toute');
    console.log('       propriété qu’elle est seule à poser s’applique sans opposition.');
    console.log('       Préfixe en « tbf- », ou déclare la classe dans PARTAGEES si');
    console.log('       c’est un vocabulaire voulu.');
  } else {
    ok('ui.css', 'aucune classe sans préfixe ne marche sur celles des pages '
      + `(${deLaCommune.length} hors vocabulaire partagé)`);
  }
}

/* ============================ le deck et le classeur ont le même fond

   `nav.js` pose sur chaque page un décor de stade derrière la colonne. Le
   classeur le laisse passer — son `#app` ne porte qu'un halo translucide —
   tandis que le deck avait posé par-dessus un aplat opaque qui le masquait.
   Deux onglets voisins, un seul geste pour passer de l'un à l'autre, et le
   fond changeait : on ne lisait pas « une autre section », on lisait « une
   autre application ».

   Le contrôle compare les deux déclarations telles qu'elles sont écrites. Il
   ne mesure pas un pixel — il n'y a pas de navigateur ici — mais il attrape
   exactement ce qui s'est produit : l'un des deux écrans qui reçoit un fond et
   pas l'autre. */

{
  const fondDe = (nom) => {
    const src = readFileSync(path.join(DOSSIER, nom), 'utf8');
    const m = /#app\{[^}]*\}/s.exec(src);
    if (!m) return null;
    const b = /background:([^;}]*)/s.exec(m[0]);
    return b ? b[1].replace(/\s+/g, ' ').trim() : null;
  };
  const classeur = fondDe('fanzzy.html');
  const deck = fondDe('deck.html');
  if (classeur && classeur === deck) {
    ok('deck.html', 'même fond de colonne que le classeur');
  } else {
    ko('deck.html', 'son fond de colonne diffère de celui du classeur');
    console.log('        classeur :', classeur);
    console.log('        deck     :', deck);
  }
}


/* ================== le dessin détouré ne se pose pas sur une plaque

   Les illustrations Fanzzy sont détourées : fond transparent, personnage seul.
   « Mon FANZZY » les montre ainsi, debout, sans cadre. La tribune du deck, elle,
   les recadrait dans un carré sombre de cinquante-quatre pixels — donc coupait
   le geste, qui est précisément ce qui distingue un Capo d'un Tambour quand on
   lit sa tribune de loin.

   Deux choses se vérifient, et la seconde est celle qui compte : que le deck
   demande bien le dessin **en pied**, et qu'aucune plaque ne revienne derrière.
   Un fond opaque sous un dessin qu'on a détouré exprès annule tout le travail
   de détourage, et ça ne se voit qu'à l'œil. */

{
  const src = readFileSync(path.join(DOSSIER, 'deck.html'), 'utf8');
  const enPied = /illustration\?\.\(f,\s*'plein'\)/.test(src);
  if (enPied) ok('deck.html', 'la tribune montre le personnage en pied');
  else ko('deck.html', 'la tribune ne demande plus le dessin en pied (« plein »)');

  const regle = /\.tete \.face\{[^}]*\}/s.exec(src)?.[0] ?? '';
  /* `background` tout court : un dégradé ou une couleur pleine font le même
     tort. La lueur de rareté, elle, vit sur `::before` — pas sur la boîte. */
  if (/background\s*:/.test(regle)) {
    ko('deck.html', 'une plaque est revenue derrière le Fanzzy détouré');
    console.log('        règle :', regle.replace(/\s+/g, ' ').slice(0, 120));
  } else {
    ok('deck.html', 'aucune plaque derrière le Fanzzy détouré');
  }
}


/* ========== une page qui dessine des cartes charge tous les dessins

   `cardHTML` sait dessiner quatre sortes de carte, et chacune va chercher ses
   images dans une bibliothèque différente : `fanzzy-art.js` pour les
   personnages, `stuff-art.js` pour l'équipement et les écharpes,
   `action-art.js` pour les cartes d'action.

   Une page qui en oublie une ne casse pas : la carte concernée retombe sur la
   silhouette procédurale. C'est exactement ce qui s'est produit — les boosters
   ne chargeaient pas `action-art.js`, et une carte d'action tirée s'affichait
   comme un bonhomme gris, identique à la poignée d'écharpes d'à côté, au
   moment précis où l'on découvre ce qu'on a gagné.

   Un repli silencieux ne se voit pas à la lecture du code : il faut ouvrir un
   booster et tomber sur la bonne carte. D'où ce contrôle. */

{
  const BIBLIOS = ['/fanzzy-art.js', '/stuff-art.js', '/action-art.js'];
  for (const nom of fichiers.filter((f) => f.endsWith('.html')).sort()) {
    const src = readFileSync(path.join(DOSSIER, nom), 'utf8');
    if (!src.includes('/cartes.js')) continue;
    const manque = BIBLIOS.filter((b) => !src.includes(b));
    if (manque.length) ko(nom, `dessine des cartes sans ${manque.join(' ni ')}`);
    else ok(nom, 'charge les trois bibliothèques de dessin');
  }
}


/* ============ combien de lignees montrent vraiment leur evolution

   Faire grandir un supporter coute vingt-cinq echarpes au stade 2, puis
   quatre-vingt-dix au stade 3. Ce qu'on achete est un dessin : un nom et des
   bonus changent aussi, mais c'est le dessin qu'on montre aux autres.

   Or il manque presque partout. Ce compte le dit a chaque passage, et il ne
   fait **pas** echouer la livraison : c'est une production d'images en cours,
   pas une faute de code. Un rouge permanent serait un rouge qu'on apprend a
   ignorer, et le jour ou il signalerait autre chose, personne ne le verrait.

   Deux systemes comptent : le fichier plat `<id>.png`, et le dossier d'etats
   `<racine>/e<n>/base/neutre.png` que `adresse` sait desormais lire. Une
   lignee est complete si chacun de ses ages a l'un ou l'autre. */

{
  const { DEX } = await import('../src/shared/fanzzy/dex.js');
  const IMG = path.join(DOSSIER, 'img', 'fanzzy');
  const suivi = new Set(DEX.map((f) => f.evo).filter(Boolean));
  const evoDe = (id) => {
    const m = /^[A-Z]+\d+([A-Z])$/.exec(String(id ?? ''));
    return m ? m[1].charCodeAt(0) - 64 : 1;
  };
  const racineDe = (id) => /^([A-Z]+\d+)/.exec(String(id ?? ''))?.[1] ?? id;
  const dessine = (id) => existsSync(path.join(IMG, `${id}.png`))
    || existsSync(path.join(IMG, racineDe(id), `e${evoDe(id)}`, 'base', 'neutre.png'))
    || existsSync(path.join(IMG, racineDe(id), `e${evoDe(id)}`, 'base', 'attente.png'));

  const lignees = DEX.filter((f) => !suivi.has(f.id) && f.evo);
  const completes = lignees.filter((f) => {
    let c = f;
    if (!dessine(f.id)) return false;
    while (c?.evo) { c = DEX.find((x) => x.id === c.evo); if (c && !dessine(c.id)) return false; }
    return true;
  });
  const ages = DEX.filter((f) => suivi.has(f.id));
  ok('les dessins', `${completes.length}/${lignees.length} lignee(s) entierement dessinee(s)`
    + ` — ${ages.filter((f) => dessine(f.id)).length}/${ages.length} age(s) superieur(s)`);
}

/* ================================ les liens qui ne mènent nulle part

   Le classeur portait un bouton « ENTRER EN DUEL » qui envoyait sur `/duel`.
   Le duel se joue sur `/duel-nvn` : le bouton menait à une page d'erreur,
   depuis l'écran qui l'annonce. Rien ne regardait jamais **où** un lien mène —
   un chemin est une chaîne de caractères, et une chaîne fausse a exactement
   l'air d'une chaîne juste.

   Ce contrôle relit les routes que `server.js` sert, et les compare à tout ce
   que les pages désignent : les `href` du balisage et les `location.href` du
   script. Une adresse qui ne correspond à aucune route est nommée ici, et non
   découverte par un joueur.

   Ce qu'il laisse passer, et pourquoi :

     — les adresses **externes**, les ancres et les `mailto:` : ce n'est pas
       notre affaire ;
     — les chemins **construits** — `/fanzzy/${id}` — dont on ne vérifie que le
       préfixe, puisque la route est elle-même paramétrée ;
     — tout ce que sert `express.static`, c'est-à-dire le contenu de `public/`.
       Un fichier qui existe sur le disque est servi, et il est déjà vérifié
       ailleurs.                                                             */

function routesServies() {
  const src = readFileSync(path.join(RACINE, 'server.js'), 'utf8');
  const vues = new Set();
  for (const m of src.matchAll(/app\.get\(\s*'(\/[^']*)'/g)) vues.add(m[1]);
  /* Les **routeurs montés sous un préfixe** — `app.use('/api/auth', …)`.
     Leurs routes ne sont écrites nulle part dans `server.js` : les lire
     demanderait d'ouvrir chaque module, et ce contrôle regarde les écrans,
     pas les services. On accepte donc tout ce qui passe sous un préfixe
     monté.

     Sans cela il criait sur `/api/auth/google/start`, qui existe et marche
     très bien — et un contrôle qui crie à tort est un contrôle qu'on
     finit par éteindre. */
  const prefixes = [];
  for (const m of src.matchAll(/app\.use\(\s*'(\/[^']*)'/g)) prefixes.push(m[1]);
  return { vues, prefixes };
}

/** Une adresse est-elle servie ? */
function menePart(chemin, { vues, prefixes }, fichiersPublics) {
  const net = chemin.split('?')[0].split('#')[0].replace(/\/$/, '') || '/';
  if (vues.has(net)) return true;
  if (prefixes.some((p) => net === p || net.startsWith(`${p}/`))) return true;
  // Une route paramétrée : `/fanzzy/:id` couvre `/fanzzy/TR1`.
  for (const r of vues) {
    if (!r.includes(':')) continue;
    const motif = new RegExp(`^${r.replace(/:[^/]+/g, '[^/]+')}$`);
    if (motif.test(net)) return true;
  }
  // Un fichier de `public/`, servi par express.static.
  return fichiersPublics.has(net.replace(/^\//, ''));
}

{
  const routes = routesServies();
  const publics = new Set();
  const marcher = async (rel) => {
    for (const e of await readdir(path.join(DOSSIER, rel), { withFileTypes: true })) {
      const sous = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) await marcher(sous);
      else publics.add(sous);
    }
  };
  await marcher('');

  const perdus = [];
  for (const nom of fichiers.filter((f) => f.endsWith('.html')).sort()) {
    const html = await readFile(path.join(DOSSIER, nom), 'utf8');
    const vus = new Set();
    for (const m of html.matchAll(/href\s*=\s*["'](\/[^"'#?]*)/g)) vus.add(m[1]);
    for (const m of html.matchAll(/location\.href\s*=\s*['"](\/[^'"$]*)['"]/g)) vus.add(m[1]);
    for (const c of vus) {
      // Les chemins assemblés à l'exécution portent un `${` : on ne juge que
      // ce qui est écrit en entier.
      if (c.includes('${') || c.includes('//')) continue;
      if (!menePart(c, routes, publics)) perdus.push(`${nom} → ${c}`);
    }
  }

  if (perdus.length) {
    for (const p of perdus) ko(p.split(' → ')[0], `mène nulle part : ${p.split(' → ')[1]}`);
  } else {
    ok('les pages', `chaque lien mène à une route servie (${routes.vues.size} routes)`);
  }
}

/* =============== le transport des sockets, et l'ordre qui compte

   Un joueur : « pas de connexion sur mobile, alors que ça marche sur
   l'ordinateur avec le même compte ». Le compte et le serveur étaient donc
   hors de cause.

   Les cinq pages qui ouvrent une socket demandaient `['websocket',
   'polling']`. Cet ordre n'est pas une préférence : engine.io essaie le
   premier, et **si celui-là échoue il abandonne**. Sa propre documentation le
   dit à `tryAllTransports` — « will not test the other transports and will
   abort the connection », false par défaut.

   Un wifi domestique laisse passer le websocket ; un réseau mobile, un proxy
   d'entreprise ou un portail captif le bloquent souvent. Le jeu se déclarait
   alors hors ligne sur un réseau parfaitement fonctionnel — et il ne pouvait
   pas s'en apercevoir tout seul, puisque c'est la connexion même qui manquait.

   Ce contrôle est **statique**, et il doit le rester : aucun navigateur de
   test ne tourne derrière un opérateur mobile, donc aucune suite ne peut
   attraper ça en jouant. Ce qui se vérifie, c'est ce qui est écrit. */
{
  const mauvais = [];
  for (const nom of fichiers.filter((f) => f.endsWith('.html')).sort()) {
    const html = await readFile(path.join(DOSSIER, nom), 'utf8');
    for (const m of html.matchAll(/io\(\{([^}]*)\}\)/g)) {
      const opts = m[1];
      if (!opts.includes('transports')) continue;      // le défaut est bon
      const ordre = /transports\s*:\s*\[([^\]]*)\]/.exec(opts)?.[1] ?? '';
      const premier = (ordre.split(',')[0] ?? '').replace(/['" ]/g, '');
      const replie = /tryAllTransports\s*:\s*true/.test(opts);
      if (premier === 'websocket' && !replie) {
        mauvais.push(`${nom} : websocket en premier sans tryAllTransports`);
      }
    }
  }
  if (mauvais.length) for (const m of mauvais) {
    ko(m.split(' : ')[0], m.split(' : ')[1]
      + ' — un réseau qui bloque le websocket ne se repliera pas');
  } else ok('les sockets', 'aucune page n’abandonne au premier transport');
}
/* ================= le bas de la page, sous la barre du navigateur

   Un joueur : « je ne vois pas le bas de la page à cause du menu du bas sur
   mobile ». Sur une page qui défile, le dernier élément est collé au bas du
   document, et la barre du navigateur — celle qui va et vient au défilement —
   passe par-dessus. Un bouton qui se trouve là ne se touche pas.

   `dvh` ne suffit pas, et c'est le piège : il range bien la mise en page sur
   la hauteur **visible**, mais il ne réserve rien contre une barre qui revient
   pendant qu'on lit. Il faut un dégagement, et il coûte quarante pixels.

   Le contrôle est statique, comme celui des sockets, et pour la même raison :
   aucun navigateur de test n'a de barre rétractable, donc aucune suite ne
   peut l'attraper en jouant. Quatorze pages l'avaient perdu d'un coup sans
   que rien ne le dise.

   Les écrans de jeu en sont exemptés : ils ne défilent pas — `height:100dvh`
   avec `overflow:hidden` — et leur ajouter de la marge couperait ce qu'ils
   tiennent tout juste. */
{
  const nus = [];
  for (const nom of fichiers.filter((f) => f.endsWith('.html')).sort()) {
    const html = await readFile(path.join(DOSSIER, nom), 'utf8');
    // Un écran sans défilement se reconnaît à sa hauteur fixe et à sa coupe.
    const fige = /height:\s*100dvh/.test(html) && /overflow:\s*hidden/.test(html)
      && !/min-height:\s*100dvh/.test(html);
    if (fige) continue;
    const degage = /padding[^;}]*env\(safe-area-inset-bottom\)/.test(html)
      || /padding[^;}]*var\(--nav-h/.test(html);
    if (!degage) nus.push(nom);
  }
  if (nus.length) for (const n of nus) {
    ko(n, 'aucun dégagement en bas — la barre du navigateur mobile couvrira le dernier élément');
  } else ok('le bas des pages', 'chaque page qui défile réserve sa place sous la barre du mobile');
}
/* ======================== deux fois le même identifiant dans une page

   `getElementById` rend **le premier** élément du document, sans rien dire du
   second. Deux champs qui portent le même nom ne provoquent donc aucune erreur :
   l'un des deux devient simplement inatteignable, et le code qui croit l'écrire
   écrit dans l'autre.

   Ce contrôle existe parce que c'est arrivé. Le filtre des séries de
   l'administration s'appelait `f-set`, comme le champ SÉRIE du formulaire
   d'édition, et les deux vivaient en même temps. Résultat, tout en silence :
   changer la série d'une carte n'avait aucun effet, et toute carte créée
   recevait la première série du catalogue. Rien ne levait, rien ne s'affichait
   de travers ; seule la base finissait fausse. Aucune suite de navigateur ne
   pouvait l'attraper — l'écran se comporte normalement.

   Les identifiants sont relevés partout, balisage statique **et** gabarits de
   chaîne, parce que la collision vient précisément de ce que les seconds
   s'insèrent dans le premier.

   La tolérance ci-dessous liste les noms réemployés d'une vue à l'autre dans
   l'administration : ses onglets se remplacent dans `#main`, donc un seul
   existe à la fois. C'est une liste courte et nommée, pas un réglage : y
   ajouter une ligne demande d'avoir vérifié que les deux porteurs ne peuvent
   pas être affichés ensemble. */
{
  /** Page → identifiants dont le doublon est voulu, avec la raison. */
  const TOLERES = {
    'admin.html': new Set([
      'q',        // un champ de recherche par onglet — fanzzy, joueurs, compétitions
      'go',       // le bouton qui lance la recherche, dans deux de ces onglets
      'corps',    // le corps du tableau, un par onglet
      'nouveau',  // « nouveau », dans les deux onglets de catalogue
    ]),
  };
  const fautifs = [];
  for (const nom of fichiers.filter((f) => f.endsWith('.html')).sort()) {
    const html = await readFile(path.join(DOSSIER, nom), 'utf8');
    const vus = new Map();
    for (const m of html.matchAll(/id="([A-Za-z][\w-]*)"/g)) {
      vus.set(m[1], (vus.get(m[1]) ?? 0) + 1);
    }
    const tolere = TOLERES[nom] ?? new Set();
    const doubles = [...vus].filter(([id, n]) => n > 1 && !tolere.has(id))
      .map(([id, n]) => `${id} (${n}×)`);
    if (doubles.length) fautifs.push([nom, doubles]);
  }
  if (fautifs.length) {
    for (const [nom, doubles] of fautifs) {
      ko(nom, `identifiant(s) écrits deux fois : ${doubles.join(', ')}. `
        + 'getElementById ne rendra que le premier, et l’autre sera piloté sans '
        + 'qu’on s’en aperçoive — renommer, ou ajouter à TOLERES en disant pourquoi '
        + 'les deux ne peuvent pas coexister.');
    }
  } else ok('les identifiants', 'aucune page n’écrit deux fois le même, hors doublons documentés');
}
/* ================================ les stades ont-ils tous leur dessin ?

   `stade-art.js` pose son image avec `onerror="this.remove()"` : un stade
   sans fichier **disparaît en silence**, et l'arène se joue sur du noir. Cinq
   des quinze lieux étaient dans ce cas — les cinq de LA REPRISE — et rien ne
   le disait, ni à l'écran ni dans une suite. C'est ce que le joueur a fini
   par signaler sous la forme « des fois, il manque les images des stades ».

   Le contrôle ne fabrique pas les dessins et ne rougit pas de leur absence :
   le chantier d'images est connu et se suit ailleurs. Il écrit le compte, à
   chaque passage, pour qu'on ne puisse plus en oublier un sans le voir. */
{
  const { STADES } = await import('../src/shared/stades.js');
  let presents = new Set();
  try {
    const noms = await readdir(new URL('../public/img/stade/', import.meta.url));
    presents = new Set(noms.map((f) => f.replace(/\.[a-z0-9]+$/i, '')));
  } catch { /* dossier absent : tous manquants, et le compte le dira */ }
  const sans = STADES.filter((s) => !presents.has(s.id));
  ok('les stades', `${STADES.length - sans.length}/${STADES.length} ont leur dessin`
    + (sans.length ? ` · sans dessin : ${sans.map((s) => s.id).join(', ')}` : ''));
}

/* ============================== les emblèmes ont-ils tous leur dessin ?

   Même histoire que les stades, et même remède. `logo-art.js` pose son
   image avec `onerror="this.remove()"` : un emblème sans fichier **s'efface
   en silence**, et l'écran retrouve exactement ce qu'il avait avant. C'est
   le bon comportement — mais c'est aussi ce qui fait qu'un oubli ne se voit
   jamais, sur aucun écran et dans aucune suite.

   Trois formats par emblème, parce que c'est le trio servi et qu'un AVIF
   manquant ne se remarque que sur les navigateurs qui le prennent. */
{
  const { EMBLEMES } = await import('./logo-images.mjs');
  let presents = new Set();
  try {
    presents = new Set(await readdir(new URL('../public/img/logo/', import.meta.url)));
  } catch { /* dossier absent : tous manquants, et le compte le dira */ }
  const FORMATS = ['.avif', '.webp', '.png'];
  const sans = EMBLEMES.filter((e) => !FORMATS.every((x) => presents.has(e.cle + x)));
  ok('les emblèmes', `${EMBLEMES.length - sans.length}/${EMBLEMES.length} ont leurs trois formats`
    + (sans.length ? ` · incomplets : ${sans.map((e) => e.cle).join(', ')}` : ''));
}

/* ====================================== les garde-fous du socle FAIT MAIN

   Le lot 0 de la refonte rend les écrans lisibles en plein jour et
   homogènes au toucher. Quatre de ses règles se lisent dans le texte des
   fichiers, sans navigateur : elles sont tenues ici, parce qu'une règle que
   seule une passe de correction a fait respecter revient au premier écran
   qu'on ajoute. Celles qui demandent un rendu — la taille réelle du texte,
   son opacité effective, le contraste au soleil — sont mesurées par
   `audit-ui.mjs`, qui a besoin d'un serveur et d'un Chrome.

   **Les commentaires ne comptent pas.** Chacune de ces fautes sera expliquée
   dans un commentaire qui la cite, à l'endroit même où elle a été corrigée :
   un contrôle qui se déclenche sur sa propre documentation apprend surtout à
   ne plus l'écrire — c'est déjà la leçon de `uniteDeConteneurSansGarde`, plus
   haut. Chaque fichier est donc lu débarrassé de ses commentaires, **lignes
   conservées**, pour que le numéro annoncé soit celui qu'on ouvre. */

/** Tout sauf les retours à la ligne : le numéro de ligne survit au retrait. */
const blanchir = (s) => s.replace(/[^\n]/g, ' ');

/* Les mots après lesquels une barre oblique ouvre une expression régulière
   plutôt qu'une division : « return /x/.test(s) ». */
const AVANT_REGEX = new Set(['return', 'typeof', 'case', 'do', 'else', 'in', 'of',
  'new', 'delete', 'void', 'throw', 'yield', 'await', 'instanceof']);

/**
 * Du JavaScript sans ses commentaires.
 *
 * **Une expression régulière n'y suffit pas**, et c'est tout le problème : deux
 * barres obliques vivent aussi dans une adresse (`'https://…'`), une barre
 * suivie d'une étoile dans une expression régulière qui cherche justement des
 * commentaires, et un gabarit de chaîne peut en contenir un autre dans son
 * `${…}`. On avance donc caractère par caractère en sachant où l'on est —
 * code, chaîne, gabarit ou expression régulière.
 *
 * La barre oblique reste ambiguë (division ou expression régulière ?) et se
 * tranche sur ce qui la précède, comme le font les coloreurs de code. Ça suffit
 * pour les scripts de public/ ; le jour où ça ne suffira plus, le contrôle
 * « le code sans commentaires compile encore », plus bas, le dira.
 */
function sansCommentairesJs(src) {
  const morceaux = [];
  let i = 0;
  const garder = (a, b) => { if (b > a) morceaux.push(src.slice(a, b)); };
  const effacer = (a, b) => { if (b > a) morceaux.push(blanchir(src.slice(a, b))); };

  const regexPermise = (prec, pos) => {
    if (prec === '' || /[(,=:[!&|?{};+\-*%<>~^]/.test(prec)) return true;
    if (!/[\w$]/.test(prec)) return false;
    const mot = /([\w$]+)\s*$/.exec(src.slice(Math.max(0, pos - 24), pos))?.[1];
    return AVANT_REGEX.has(mot);
  };
  // Une chaîne entre guillemets : jusqu'au guillemet fermant, ou à la fin de
  // la ligne pour ne pas avaler le fichier sur une chaîne mal fermée.
  const chaine = (q) => {
    const a = i++;
    while (i < src.length && src[i] !== q && src[i] !== '\n') i += src[i] === '\\' ? 2 : 1;
    i = Math.min(i + 1, src.length);
    garder(a, i);
  };
  // Une expression régulière : une barre dans une classe « [/] » ne la ferme pas.
  const regex = () => {
    const a = i++;
    let classe = false;
    while (i < src.length && src[i] !== '\n') {
      const c = src[i];
      if (c === '\\') { i += 2; continue; }
      i++;
      if (c === '[') classe = true;
      else if (c === ']') classe = false;
      else if (c === '/' && !classe) break;
    }
    while (i < src.length && /[a-z]/i.test(src[i])) i++;
    garder(a, i);
  };
  let code;
  const gabarit = () => {
    let a = i++;
    while (i < src.length) {
      const c = src[i];
      if (c === '\\') { i += 2; continue; }
      if (c === '`') { i++; break; }
      if (c === '$' && src[i + 1] === '{') {
        i += 2;
        garder(a, i);
        code(true);
        a = i;
        continue;
      }
      i++;
    }
    garder(a, Math.min(i, src.length));
  };
  /* Le code proprement dit. Dans un `${…}`, il s'arrête à l'accolade qui le
     referme, et à celle-là seulement : d'où le compte des profondeurs. */
  code = (dansGabarit) => {
    let a = i, profondeur = 0, prec = '';
    while (i < src.length) {
      const c = src[i], d = src[i + 1];
      if (c === '/' && (d === '/' || d === '*')) {
        garder(a, i);
        const fin = d === '/' ? src.indexOf('\n', i) : src.indexOf('*/', i + 2);
        const f = fin < 0 ? src.length : fin + (d === '*' ? 2 : 0);
        effacer(i, f);
        i = f; a = i;
        continue;
      }
      if (c === '"' || c === '\'' || c === '`' || (c === '/' && regexPermise(prec, i))) {
        garder(a, i);
        if (c === '`') gabarit(); else if (c === '/') regex(); else chaine(c);
        a = i; prec = 'x';
        continue;
      }
      if (c === '{') profondeur++;
      else if (c === '}') {
        if (dansGabarit && profondeur === 0) { i++; garder(a, i); return; }
        profondeur--;
      }
      if (!/\s/.test(c)) prec = c;
      i++;
    }
    garder(a, i);
  };
  code(false);
  return morceaux.join('');
}

/* Le CSS écrit **dans** un gabarit de chaîne (les blocs de fx.js, nav.js,
   menu.js) garde ses commentaires après le passage ci-dessus : pour le
   JavaScript, ce sont des chaînes. La seconde passe les retire, ainsi que
   les commentaires HTML des gabarits de balisage. */
const neutreCss = (css) => css.replace(/\/\*[\s\S]*?\*\//g, blanchir);
const neutreJs = (js) => sansCommentairesJs(js).replace(/\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->/g, blanchir);
const neutreHtml = (html) => html.replace(
  /(<script\b[^>]*>)([\s\S]*?)(<\/script>)|(<style\b[^>]*>)([\s\S]*?)(<\/style>)|<!--[\s\S]*?-->/gi,
  (m, so, sc, sf, to, tc, tf) => {
    if (so) return so + neutreJs(sc) + sf;
    if (to) return to + neutreCss(tc) + tf;
    return blanchir(m);
  });
const ligneDe = (texte, index) => texte.slice(0, index).split('\n').length;

{
  const sources = [];
  for (const nom of [...fichiers].sort()) {
    // Le paquet d'esbuild n'est pas relu, pour la même raison qu'au-dessus ;
    // et les dossiers d'images ne se lisent pas comme du texte.
    if (nom.endsWith('.bundle.js') || !/\.(html|js|css)$/.test(nom)) continue;
    const brut = await readFile(path.join(DOSSIER, nom), 'utf8');
    if (nom.endsWith('.html')) sources.push({ nom, brut, net: neutreHtml(brut), sorte: 'html' });
    else if (nom.endsWith('.js')) sources.push({ nom, brut, net: neutreJs(brut), sorte: 'js' });
    else if (nom.endsWith('.css')) sources.push({ nom, brut, net: neutreCss(brut), sorte: 'css' });
  }

  /* **Le retrait des commentaires ne doit rien manger d'autre.** S'il se
     trompait sur une barre oblique, il blanchirait du vrai code jusqu'à la
     fin de la ligne — ou du fichier — et les quatre contrôles ci-dessous
     deviendraient verts sur ce qu'ils ne lisent plus. Du code dont on n'a
     retiré que des commentaires compile exactement comme avant : on le
     vérifie, script par script, et on nomme le fichier sinon. */
  let abime = 0;
  for (const s of sources) {
    const paires = s.sorte === 'js' ? [[s.brut, neutreJs(s.brut)]]
      : s.sorte === 'html'
        ? [...s.brut.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)]
          .filter((m) => !/\bsrc\s*=/.test(m[1])).map((m) => [m[2], neutreJs(m[2])])
        : [];
    for (const [avant, apres] of paires) {
      if (compile(avant, s.nom) || !compile(apres, s.nom)) continue;
      abime++;
      ko(s.nom, `le retrait des commentaires a abîmé le code (${compile(apres, s.nom)}) : `
        + 'les garde-fous FAIT MAIN ne lisent plus ce fichier tel qu’il est — '
        + 'c’est sansCommentairesJs qu’il faut reprendre, pas la page');
    }
  }
  if (!abime) ok('les commentaires', 'retirés sans toucher au code (chaque script compile encore)');

  /** Rassemble les trouvailles d'un motif, fichier par fichier. */
  const releve = (motif, filtre = () => true) => {
    const parFichier = new Map();
    for (const s of sources) {
      if (!filtre(s)) continue;
      for (const m of s.net.matchAll(motif)) {
        if (!parFichier.has(s.nom)) parFichier.set(s.nom, []);
        parFichier.get(s.nom).push({ ligne: ligneDe(s.net, m.index), texte: m[0] });
      }
    }
    return parFichier;
  };
  const lignes = (l) => {
    const n = [...new Set(l.map((x) => x.ligne))];
    return `ligne${n.length > 1 ? 's' : ''} ${n.join(', ')}`;
  };

  /* --- aucun backdrop-filter

     Le flou d'arrière-plan recalcule, à chaque image, tout ce qui passe
     derrière la surface qui le porte. Sur un téléphone modeste, c'est ce qui
     fait saccader le défilement ; en plein soleil, un panneau translucide et
     flou laisse la tribune se mélanger au texte. Le socle le remplace par un
     fond opaque (alpha ≥ 0,88), et les lots suivants comptent dessus.

     Trois formes : la déclaration CSS, préfixée ou non ; la propriété de
     script (« style.backdropFilter ») ; le nom passé en chaîne à
     « setProperty ». Une seule suffirait à le faire revenir. */
  {
    const vus = releve(/(?<![\w-])(?:-webkit-)?backdrop-filter\s*:|\b(?:webkit|Webkit)?[bB]ackdropFilter\b|['"](?:-webkit-)?backdrop-filter['"]/g);
    for (const [nom, l] of vus) {
      ko(nom, `backdrop-filter déclaré (${lignes(l)}) : le flou d’arrière-plan se `
        + 'recalcule à chaque image — cher sur un téléphone modeste, illisible au '
        + 'soleil. Un fond opaque à la place (alpha ≥ 0,88).');
    }
    if (!vus.size) ok('backdrop-filter', 'aucune déclaration dans public/');
  }

  /* --- aucun émoji cadenas ni coche dans l'interface

     🔒 ✓ ✔ ✅ se dessinent avec la police d'émojis du téléphone : en couleur
     chez l'un, en trait chez l'autre, à une taille qui n'est pas celle du
     texte, et toujours à côté des icônes au trait du jeu. Le socle les
     remplace par les icônes en masque de ui.css, qui prennent la couleur du
     texte (« tbf-ico tbf-ico-cadenas », « tbf-ico tbf-ico-coche »).

     On cherche aussi leurs **écritures détournées** — « ✓ » en script,
     « \2713 » en CSS, « &#10003; » ou « &check; » en HTML — parce que c'est
     exactement la forme que prend l'émoji chassé qui revient : la page qui
     écrivait déjà « &#10003; » le montrait. */
  {
    const vus = releve(new RegExp([
      '🔒', '✓', '✔', '✅',
      '\\\\u\\{?(?:2713|2714|2705|1F512)\\}?', '\\\\uD83D\\\\uDD12',
      '\\\\(?:2713|2714|2705|1F512)(?![0-9a-f])',
      '&#(?:10003|10004|9989|128274);', '&#x0*(?:2713|2714|2705|1F512);', '&(?:check|checkmark);',
    ].join('|'), 'giu'));
    for (const [nom, l] of vus) {
      const quoi = [...new Set(l.map((x) => x.texte))].join(' ');
      ko(nom, `émoji ${quoi} dans l’interface (${lignes(l)}) : il se dessine autrement `
        + 'd’un téléphone à l’autre et jure avec les icônes au trait. À la place : '
        + '<i class="tbf-ico tbf-ico-cadenas"> ou tbf-ico-coche, avec un texte accessible.');
    }
    if (!vus.size) ok('les émojis', 'aucun cadenas ni coche en émoji dans public/');
  }

  /* --- aucun « .calc( »

     Un point devant « calc » ne fait pas une petite valeur : il fait une
     valeur **invalide**, et le navigateur jette la déclaration entière sans
     un mot en console. L'ombre, l'écart ou l'arrondi disparaît, la carte
     s'affiche presque comme prévu, et rien ne le signale — cartes.css en a
     porté cinq d'un coup.

     La barre de recherche ignore « objet.calc( » en script : précédé d'un
     nom, d'une parenthèse ou d'un crochet, c'est un appel de méthode. */
  {
    const vus = releve(/(?<![\w$)\]])\.calc\(/g);
    for (const [nom, l] of vus) {
      ko(nom, `« .calc( » (${lignes(l)}) : le point devant calc rend la valeur `
        + 'invalide, et le navigateur jette la déclaration entière sans rien dire.');
    }
    if (!vus.size) ok('.calc(', 'aucune valeur invalide par un point devant calc');
  }

  /* --- chaque rail d'onglets porte son ton

     Le rail « .tbf-onglets » prend le ton de sa destination sur le hub
     (flare pour jouer, bleu pour posséder, vert pour le foot, violet pour les
     gens, or pour acheter, craie pour soi), et l'onglet actif en prend la
     couleur. Sans « data-ton », ui.css le peint en or par défaut : l'écran
     des amis aurait l'onglet de la boutique, sans que rien ne casse.

     Le balisage **et** les gabarits de chaîne : deux rails sur neuf sont
     écrits par le script de leur page (deck, télétexte). Un rail posé par
     « classList.add » ne se relit pas ici ; il est refusé plutôt que laissé
     passer sans vérification. */
  {
    const sansTon = new Map();
    const noter = (nom, texte, index, raison) => {
      if (!sansTon.has(nom)) sansTon.set(nom, []);
      sansTon.get(nom).push({ ligne: ligneDe(texte, index), raison });
    };
    let rails = 0;
    for (const s of sources.filter((x) => x.sorte !== 'css')) {
      const balises = /<[a-z][\w-]*\b[^>]*?\bclass\s*=\s*(["'])((?:(?!\1)[\s\S])*?)\1[^>]*>/gi;
      for (const m of s.net.matchAll(balises)) {
        if (!/(?<![\w-])tbf-onglets(?![\w-])/.test(m[2])) continue;
        rails++;
        if (!/\bdata-ton\s*=/.test(m[0])) noter(s.nom, s.net, m.index, 'sans data-ton');
      }
      for (const m of s.net.matchAll(/(?:classList\.(?:add|toggle)\([^)]*|className\s*=[^;\n]*)(?<![\w-])tbf-onglets(?![\w-])/g)) {
        rails++;
        noter(s.nom, s.net, m.index, 'posé par script');
      }
    }
    for (const [nom, l] of sansTon) {
      const parScript = l.filter((x) => x.raison === 'posé par script');
      const nus = l.filter((x) => x.raison === 'sans data-ton');
      if (nus.length) {
        ko(nom, `rail .tbf-onglets sans data-ton (${lignes(nus)}) : l’onglet actif `
          + 'prend l’or par défaut au lieu du ton de l’écran — flare, bleu, vert, '
          + 'violet, or ou craie selon sa destination sur le hub.');
      }
      if (parScript.length) {
        ko(nom, `rail .tbf-onglets posé par script (${lignes(parScript)}) : son data-ton `
          + 'ne se vérifie pas ici. Écris le rail dans le balisage ou un gabarit.');
      }
    }
    /* Zéro rail trouvé est une panne du contrôle, pas une bonne nouvelle :
       neuf écrans en portent un. Un motif qui ne reconnaît plus la balise
       rendrait ce contrôle vert pour toujours. */
    if (!rails) ko('les onglets', 'aucun rail .tbf-onglets trouvé : le motif ne reconnaît plus la balise');
    else if (!sansTon.size) ok('les onglets', `${rails} rail(s), tous au ton de leur écran`);
  }
}

console.log(fautes
  ? `\n${fautes} faute(s) — ne pas livrer en l\u2019état.`
  : '\nToutes les pages compilent, la barre est partout où elle doit être.');
process.exit(fautes ? 1 : 0);
