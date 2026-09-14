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
/* Les listes de référence viennent des modules eux-mêmes, pas d'une lecture au
   motif du fichier source. Une première version lisait les identifiants à
   l'expression régulière : le jour où un `id:` changeait de forme, le contrôle
   se contentait de vérifier moins de pièces et **restait vert** — un garde-fou
   qui rétrécit en silence ne garde plus rien. */
import { ACTIONS } from '../src/shared/duel/actions.js';
import { LISTE_CHANTS } from '../src/shared/duel/chants.js';
import { STUFF } from '../src/shared/fanzzy/inventaire.js';

const DOSSIER = 'public';

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
 * que le serveur la tirait des boosters, et un G1 sorti d'un paquet cassait
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

console.log(fautes
  ? `\n${fautes} faute(s) — ne pas livrer en l\u2019état.`
  : '\nToutes les pages compilent, la barre est partout où elle doit être.');
process.exit(fautes ? 1 : 0);
