/**
 * Les invites des Fanzzy : une par personnage, écrites depuis le catalogue.
 *
 * ## Pourquoi ce script existe
 *
 * Les deux cents illustrations existantes ont été demandées à la main, une par
 * une, et le style tenait dans la tête de celui qui tapait. C'est ce qui se voit
 * quand on regarde la collection de près : le cadrage, la lumière et les
 * proportions varient d'un lot à l'autre.
 *
 * Une invite écrite ici est **reproductible**. Le style est une constante, la
 * partie qui change vient du catalogue — le nom et l'histoire, qui sont déjà
 * écrits et qui décrivent le personnage mieux qu'une paraphrase. Relancer un
 * personnage trois mois plus tard redonne la même demande.
 *
 * ## Ce qu'il ne fait pas
 *
 * Il ne génère rien et ne contacte rien. Il écrit du texte. La génération se
 * fait ailleurs — c'est ce qui permet de relire les quarante-quatre invites
 * avant d'en dépenser le prix, et de n'en refaire qu'une quand une seule rate.
 *
 * ## La recette, éprouvée
 *
 * Artlist, modèle **Nano Banana 2 en 2K** (modelId 2251),
 * `settings: { aspect_ratio: "2:3" }`, cent trente crédits l’image.
 *
 * Deux autres modèles ont été essayés avant. Seedream 4.5 dessine un **cadre
 * néon** autour du personnage — pour une image qu’on va détourer, c’est le pire
 * défaut possible : le cadre touche les bords, la propagation s’arrête dessus, et
 * le personnage sort avec un rectangle lumineux autour de lui. Il rend aussi en
 * cel-shading malgré le « NOT anime », et il a posé un écusson de club sur une
 * veste — exactement ce que `VISUELS.md` annonce.
 *
 * Le format compte autant que le modèle : demander du **2:3** et non du 16:9.
 * Un rendu paysage recadré en portrait perd les pieds, et la fiche montre le
 * personnage en entier.
 *
 * Après génération : `node scripts/fanzzy-images.mjs art/neuves` détoure et
 * range, puis `node scripts/maj-illustres.mjs` inscrit les identifiants.
 *
 * ## Les âges se demandent autrement
 *
 *
 *
 * Un âge supérieur n’est pas un autre personnage : c’est **le même, plus**
 *
 * **vieux**. Le demander en texte depuis zéro donne un inconnu qui porte le
 *
 * même manteau, et le joueur qui fait évoluer sa carte voit son personnage
 *
 * remplacé au lieu de grandir — le contraire exact de ce que l’évolution
 *
 * promet.
 *
 *
 *
 * On les demande donc **en image-à-image**, avec le dessin du premier âge en
 *
 * référence : `input: { assetId }` après `upload_image`, et une invite qui ne
 *
 * nomme que ce qui change. Une invite qui redécrit tout le personnage fait
 *
 * régénérer toute l’image et perd le visage — c’est la règle de l’édition,
 *
 * et elle vaut ici parce que vieillir quelqu’un *est* une édition.
 *
 *
 *
 * `--ages` écrit ces invites-là. Elles sont courtes exprès.
 *
 *
 * Usage :
 *   node scripts/fanzzy-invites.mjs                 toutes les cartes sans dessin
 *   node scripts/fanzzy-invites.mjs VP1 GC3         celles-là, et rien d'autre
 *   node scripts/fanzzy-invites.mjs --set VP        une série entière
 *   node scripts/fanzzy-invites.mjs --json          de quoi alimenter un script
 *   node scripts/fanzzy-invites.mjs --ages --set TR  les âges 2 et 3, en i2i
 */
import { readFile } from 'node:fs/promises';
import { createContext, Script } from 'node:vm';
import { DEX, TYPES } from '../src/shared/fanzzy/dex.js';

/* --------------------------------------------------------------- le style

   Écrit une fois, en anglais parce que c'est la langue des générateurs.

   Il décrit **le rendu**, pas le personnage : trois cents Fanzzy demandés
   chacun dans son coin ne font pas une collection, ils font trois cents images.
   Ce bloc est ce qui les rend frères.

   Les quatre exigences qui portent tout le reste :

   — **Pied à tête, centré, debout.** La fiche montre le personnage en entier
     dans un cadre vertical ; un buste cadré serré n'a plus de jambes à montrer
     quand la vitrine s'allonge.
   — **Fond plat et uni.** C'est lui qui rend le détourage fiable. Un dégradé ou
     une ombre portée le fait échouer en laissant une auréole — et le décor du
     jeu vient de `fanzzy-fond.js`, il ne doit surtout pas être dans l'image.
   — **La lumière de bord.** Un liseré froid qui sépare le sujet du fond : c'est
     ce qui permet à la propagation depuis les bords de s'arrêter au bon endroit.
   — **Les proportions.** Tête légèrement surdimensionnée, corps trapu. C'est ce
     qui fait la famille avec les deux cents déjà dessinés, et un personnage aux
     proportions réalistes se repère immédiatement dans la grille.               */
const STYLE = `Render style: warm painterly 3D character render, like a modern
animated feature — soft rounded forms, semi-realistic skin and fabric texture,
expressive eyebrows and eyes, a sturdy characterful body. Appealing, a little
caricatural. NOT anime, NOT cel-shaded, NOT flat vector, NOT photorealistic.

Framing: head to feet, the figure filling most of the tall vertical frame, a
small even margin all around, facing camera at a slight three-quarter angle,
hands and feet visible.

CRITICAL — the background must be completely empty: one flat uniform mid-grey,
no gradient, no vignette, no glow, no neon, no frame, no border, no rectangle,
no panel, no floor, no ground shadow, no scenery, no props other than what the
character wears or holds. Exactly one character in the image.`;

/* **Les trois interdits qui ont demandé un second essai.**
 *
 * Le premier modèle essayé dessinait spontanément, autour du personnage, un
 * **cadre néon** — un rectangle lumineux bleu et orange. Pour une image qu'on va
 * détourer, c'est le pire défaut possible : le cadre touche les bords, la
 * propagation depuis le bord s'arrête dessus, et le personnage sort avec un
 * rectangle lumineux autour de lui.
 *
 * Il **fusionnait aussi deux personnages** quand la carte est un objet vivant :
 * la merguez arrivait portée par un homme, les deux occupant le même corps. D'où
 * la phrase en capitales pour les objets, plus bas.
 *
 * Et il posait un **écusson de club** sur une veste, malgré l'interdit — ce que
 * `VISUELS.md` annonce précisément : « les générateurs ajoutent spontanément des
 * écussons, même quand on le leur interdit. Régénérer plutôt que retoucher. » */

/* La formule de VISUELS.md, mot pour mot. Elle n'est pas paraphrasée ici : c'est
   une règle de droits, et une paraphrase finit par en perdre un morceau. */
const GARDE = `no text, no letters, no numbers, no logos, no brand marks,
no club crests, no team names, no sponsor logos, no identifiable jerseys,
no real people`;

/* Ce que chaque famille ajoute au personnage. Une ligne, et seulement ce qui se
   voit : la Voix a la bouche ouverte, la Percussion tient quelque chose qui
   sonne. Un trait de caractère qui ne se dessine pas n'a rien à faire ici. */
const FAMILLE = {
  voix: 'mouth open mid-shout, chest out, one hand cupped beside the mouth',
  perc: 'holding or wearing a simple drum, sticks in hand, mid-beat',
  tifo: 'holding up a plain coloured banner or sheet of fabric, arms raised',
  pyro: 'lit by a warm orange glow from below, wisps of smoke around the legs',
  depl: 'a long knitted two-colour scarf held wide between both hands',
  fide: 'arms folded or hands in pockets, feet planted, unmovable',
};

/* Ce que la série ajoute au costume et à l'objet tenu. Le décor, lui, ne vient
   jamais de l'image : il est dessiné par le jeu. */
const SERIE = {
  TR: 'ordinary terrace supporter clothes: parka, hoodie, knitted hat, boots',
  MS: 'a stadium worker: high-visibility vest, lanyard, work gloves, clipboard',
  BG: 'an animal that has taken a seat in the stands, upright and deadpan',
  RV: 'pale, slightly translucent, old-fashioned clothes from decades ago',
  OB: 'an everyday stadium object, given a face and little limbs, alive',
  EP: 'clothes from another century, out of place and perfectly serious',
  IM: 'something that should not be in a football stand at all',
  VP: 'expensive, immaculate clothes: tailored coat, polished shoes, lanyard pass',
  GC: 'a piece of stadium food or drink, given a face and little limbs, alive',
  GD: 'travel-worn: crumpled clothes, backpack, thermos, tired eyes',
  MT: 'a weather phenomenon given a body: swirling, translucent, made of air or water',
  HC: 'at home: tracksuit, slippers, phone or remote in hand, sofa clothes',
};

/* -------------------------------------------------------------- le choix */

const args = process.argv.slice(2);
const json = args.includes('--json');
const iSet = args.indexOf('--set');
const set = iSet >= 0 ? args[iSet + 1] : null;
const ids = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--set');

/** Ce qui est déjà dessiné, lu dans `public/fanzzy-art.js` — la source unique. */
async function dejaDessines() {
  const source = await readFile(new URL('../public/fanzzy-art.js', import.meta.url), 'utf8');
  const bac = createContext({
    window: {}, document: { createElement: () => ({ toDataURL: () => '' }) },
  });
  new Script(source).runInContext(bac);
  return bac.window.FZART.ILLUSTRES;
}

const illustres = await dejaDessines();

/* **Les premiers âges par défaut.** Un âge supérieur sans dessin tombe sur
   celui de son premier âge : un dessin de racine en efface trois, et c'est de
   loin le meilleur rapport. `--ages` demande l'autre chantier, celui de les
   faire vieillir. */
const ages = process.argv.includes('--ages');

const racineDe = (id) => {
  let r = DEX.find((f) => f.id === id);
  for (let g = 0; g < 8 && r; g++) {
    const parent = DEX.find((f) => f.evo === r.id);
    if (!parent) break;
    r = parent;
  }
  return r;
};

const choisies = DEX
  .filter((f) => f.publie !== false && (ages ? f.stage > 1 : f.stage === 1))
  .filter((f) => (ids.length ? ids.includes(f.id)
    : set ? f.set === set
      : !illustres.has(f.id)))
  /* Un âge dont le premier âge n'est pas encore dessiné n'a pas de référence :
     on ne peut pas vieillir quelqu'un qu'on n'a pas. Il attend son tour, et
     c'est une raison de plus de faire les racines d'abord. */
  .filter((f) => !ages || illustres.has(racineDe(f.id)?.id));

/* ------------------------------------------------------------- l'écriture */

/**
 * L'invite d'un personnage.
 *
 * L'**histoire** y est reprise telle quelle, en français au milieu d'un texte
 * anglais. C'est délibéré et ça marche : les générateurs actuels la comprennent,
 * et c'est le seul texte du projet qui dise vraiment qui est ce personnage. La
 * retraduire en aurait fait une paraphrase, donc un troisième texte à tenir à
 * jour — et c'est toujours la paraphrase qui dérive.
 */
/* Les séries dont le personnage **n'est pas un être humain**. Sans la phrase en
   capitales, le générateur dessine un humain qui tient l'objet — ou pire, les
   deux fondus l'un dans l'autre. C'est arrivé au premier essai : la merguez
   portait un blouson et avait des épaules d'homme. */
const CHOSES = {
  OB: 'stadium object', GC: 'piece of stadium food or drink',
  MT: 'weather phenomenon', BG: 'animal',
};

function invite(f) {
  const famille = FAMILLE[f.type] ?? '';
  const serie = SERIE[f.set] ?? '';
  const chose = CHOSES[f.set];
  return [
    'A single stylised 3D character, full body, standing, isolated on a '
      + 'completely plain flat mid-grey background.',
    '',
    `Character: "${f.nom}".`,
    f.histoire ? `Who they are — this is written in French, follow it closely: ${f.histoire}` : '',
    serie ? `Kind and wardrobe: ${serie}.` : '',
    famille ? `Pose and props: ${famille}.` : '',
    chose
      ? `CRITICAL — there is NO human being in this image. The ${chose} IS the `
        + 'character: it has a small face, two thin arms and two short legs, and it '
        + 'stands on its own. No person holding it, no person behind it, no person '
        + 'wearing it.'
      : '',
    f.rar === 'legendaire'
      ? 'This is a legendary card: give the figure more presence — a stronger '
        + 'silhouette, richer clothing detail, more character in the face. Still one '
        + 'single figure on an empty flat background.'
      : '',
    '',
    STYLE,
    '',
    GARDE,
  ].filter(Boolean).join('\n');
}

/**
 * L'invite d'un **âge supérieur**, pour l'image-à-image.
 *
 * Elle ne décrit ni le rendu, ni le cadrage, ni le fond : tout cela est déjà
 * dans l'image de référence, et le redire ferait régénérer la frame entière.
 * Elle ne nomme que **ce qui a changé**, et ce qui a changé est écrit dans
 * l'histoire de l'âge — c'est le seul texte du projet qui dise ce que les
 * années ont fait à ce personnage-là.
 *
 * L'écart d'âge est donné en clair. « Plus vieux » est trop vague pour un
 * générateur : entre le premier et le deuxième âge il y a une jeunesse, entre
 * le deuxième et le troisième une vie.
 */
function inviteAge(f) {
  const r = racineDe(f.id);
  /* Pas de nombre d'années écrit ici : l'histoire de l'âge en donne souvent
     un, et deux chiffres qui se contredisent dans la même invite donnent un
     personnage entre les deux. On dit l'ampleur, le texte dit la mesure. */
  const bond = f.stage === 2
    ? 'clearly older — grown up, not yet middle-aged'
    : 'much older — this is the last age of a long life';
  return [
    `Keep the exact same character from the reference image — same face `
      + 'structure, same build, same style of clothing, same background, same '
      + 'framing, same lighting, same render style. Change only the age.',
    '',
    `Make them ${bond}. ${f.stage === 2
      ? 'A fuller frame, a more settled face, hair and clothing that '
        + 'have moved on a little.'
      : 'Grey or white hair, lines on the face, a heavier or more '
        + 'stooped frame, worn clothing that has been kept a long time.'}`,
    '',
    `They are now called "${f.nom}".`,
    f.histoire ? `What has become of them — written in French, follow it `
      + `closely: ${f.histoire}` : '',
    r?.nom ? `They were "${r.nom}" in the reference image.` : '',
    '',
    'Do not change anything else. One single figure, same empty flat background.',
  ].filter(Boolean).join('\n');
}

const lot = choisies.map((f) => ({
  id: f.id, nom: f.nom, set: f.set, type: f.type, rar: f.rar,
  stade: f.stage,
  /* La carte dont il faut envoyer le dessin en référence. Vide pour un premier
     âge, qui se demande en texte. */
  reference: ages ? (racineDe(f.id)?.id ?? null) : null,
  invite: ages ? inviteAge(f) : invite(f),
}));

if (json) {
  console.log(JSON.stringify(lot, null, 1));
} else {
  for (const x of lot) {
    console.log(`\n${'='.repeat(70)}\n${x.id} — ${x.nom}  [${x.set} · ${TYPES[x.type]?.nom ?? x.type} · ${x.rar}]`
      + (x.reference ? `\n  référence (image-à-image) : ${x.reference}.png\n` : '\n'));
    console.log(x.invite);
  }
  console.log(`\n${lot.length} invite(s).`);
}
