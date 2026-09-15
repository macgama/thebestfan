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
  tifo: 'holding up a sheet of fabric, arms raised — the fabric is completely '
    + 'blank: one plain colour or one simple painted shape, and absolutely no'
    + ' writing, no letters and no numbers anywhere on it',
  pyro: 'holding a single lit flare or torch high in one hand — the flame and'
    + ' its warm orange light come only from what they hold, never from the'
    + ' ground, and there is no fire around the feet',
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

/* -------------------------------------------------------------- qui c'est

   **Cinquante cartes décrites par la même phrase donnent cinquante fois le même
   homme.** Les sept premiers rendus de LA TRIBUNE l'ont montré sans appel :
   quatre étaient le même quadragénaire en parka verte, et deux étaient
   indiscernables l'un de l'autre. La ligne de SERIE dit le costume — « parka,
   sweat à capuche, bonnet, bottes » — et le générateur, à qui on ne donne rien
   de plus, dessine chaque fois son idée moyenne de ce costume.

   C'est le même défaut qu'on a déjà corrigé à la main cette semaine : deux
   Fanzzy qui partagent un visage. Le corriger carte par carte après coup, ce
   serait le recorriger à chaque nouvelle série. Il se corrige ici.

   Ces listes ne décrivent pas des personnages : elles décrivent des **corps**,
   ceux qu'on trouve dans une tribune. Le tirage part de l'identifiant de la
   carte, donc il ne bouge jamais : régénérer TR44 redonne le même corps, et
   deux cartes voisines ne tombent pas sur le même.

   Et cette ligne **passe après l'histoire**, littéralement : l'histoire dit
   « sept ans » ou « un costume deux tailles trop grand », et c'est elle qui
   gagne. Une description tirée au sort qui écrase le texte de la carte, ce
   serait exactement la deuxième vérité qu'on cherche à supprimer. */

/** Un entier stable tiré d'une chaîne. Le sel donne des tirages indépendants
    pour l'âge, la carrure et le reste : sans lui, tous les traits d'une carte
    sortent du même nombre et avancent ensemble d'une carte à l'autre. */
function graine(texte, sel) {
  let h = 2166136261;
  for (const c of `${sel}:${texte}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}
const tire = (liste, id, sel) => liste[graine(id, sel) % liste.length];

const CORPS = {
  qui: ['a man', 'a man', 'a woman', 'a woman', 'a man', 'a woman'],
  /* Rangés du plus jeune au plus vieux : la pilosité grise se tire plus bas à
     partir de cet indice, et une barbe blanche à vingt ans était le deuxième
     accroc du premier essai. */
  age: ['barely out of their teens', 'in their twenties', 'in their thirties',
    'in their thirties', 'in their forties', 'in their fifties',
    'in their sixties', 'in their seventies'],
  taille: ['lean and wiry', 'broad and heavy-set', 'short and stocky',
    'tall and thin', 'square-shouldered', 'round and comfortable',
    'small and compact'],
  /* Les cheveux seuls : rien ici ne dépend de qui porte la tête. */
  cheveux: ['short cropped hair', 'a shaved head', 'thick curly hair',
    'long hair tied back', 'thinning hair combed flat', 'a messy fringe',
    'hair pushed up under the hat', 'a short practical cut'],
  /* La barbe ne se tire que pour les hommes — et la version grise seulement
     passé la cinquantaine, d'où les deux listes. */
  barbe: ['clean-shaven', 'three days of stubble', 'a short trimmed beard',
    'a thick moustache', 'clean-shaven'],
  barbeAgee: ['a full grey beard', 'a white moustache', 'grey stubble',
    'clean-shaven', 'a short grey beard'],
  peau: ['light skin', 'light skin', 'brown skin', 'dark skin', 'olive skin',
    'brown skin'],
  /* La couleur du dessus, parce que c'est elle qu'on voit de loin — et c'est
     elle qui rendait les quatre premiers rendus interchangeables. */
  couleur: ['dark green', 'navy blue', 'charcoal grey', 'faded black',
    'rust brown', 'deep burgundy', 'olive khaki', 'stone beige'],
};

/** Les séries où le personnage n'a pas de corps humain : rien à tirer. */
const SANS_CORPS = new Set(['OB', 'GC', 'MT', 'BG', 'IM']);

/** L'indice à partir duquel les poils grisonnent, dans CORPS.age. */
const AGE_GRIS = 5;

/**
 * Le genre que la carte annonce déjà, ou null si elle ne dit rien.
 *
 * « Celui Qui Reste » tiré au féminin, c'était deux vérités de plus : le nom
 * dit « Celui », l'histoire dit « Il est encore assis », et le dessin montrait
 * une femme de dix-neuf ans. Le français de la carte est écrit avant le
 * tirage ; c'est donc lui qui décide, et le tirage ne sert qu'aux cartes
 * muettes sur ce point.
 *
 * On ne lit que ce qui est sans ambiguïté : le pronom qui ouvre l'histoire, et
 * « Celui »/« Celle » dans le nom. « Le » et « La » ne disent rien — « La
 * Mascotte du Dimanche » est un rôle, pas une personne, et son histoire dit
 * « Elle ».
 */
function genreDit(f) {
  const nom = f.nom ?? '';
  if (/^Celui\b/i.test(nom)) return 'a man';
  if (/^Celle\b/i.test(nom)) return 'a woman';
  /* Les pronoms de l'histoire. En minuscule aussi : « Le Râleur du Rang B »
     sortait femme parce que son « il » est au milieu de la phrase. Et « il y a »
     est écarté — c'est le seul « il » qui ne désigne personne.

     **Quand les deux genres apparaissent, on ne tranche pas.** « L’Écharpe Trop
     Longue » dit « Elle balaie deux rangées et il s’excuse » : le « elle », c’est
     l’écharpe. Aucun motif ne sait distinguer le sujet de l’objet dans une phrase
     française, et deviner ici, c’est se tromper une fois sur deux. On rend alors
     `ambigu` : le tirage se tait sur ce point et laisse le texte de la carte
     décider seul. */
  const dit = (f.histoire ?? '').replace(/\bil y a\b/gi, ' ');
  const lui = /\bils?\b/i.test(dit);
  const elle = /\belles?\b/i.test(dit);
  if (lui && elle) return 'ambigu';
  if (lui) return 'a man';
  if (elle) return 'a woman';
  return null;
}

function corps(f) {
  if (SANS_CORPS.has(f.set)) return '';
  const t = (sel) => tire(CORPS[sel], f.id, sel);
  const annonce = genreDit(f);
  /* Sans genre annoncé, on tire ; avec un genre ambigu, on ne dit rien et la
     pilosité ne se tire pas non plus — une barbe trancherait ce que la phrase
     laisse ouvert. */
  const qui = annonce === 'ambigu' ? 'a supporter' : (annonce ?? t('qui'));
  const iAge = graine(f.id, 'age') % CORPS.age.length;
  const age = CORPS.age[iAge];
  /* Une femme ne tire pas de barbe, et personne ne grisonne avant son heure. */
  const barbe = qui === 'a man'
    ? `, ${t(iAge >= AGE_GRIS ? 'barbeAgee' : 'barbe')}`
    : '';
  return `Who to draw — unless the French text above says otherwise, in which `
    + `case follow the French text: ${qui} ${age.replace(/\btheir\b/,
      qui === 'a woman' ? 'her' : qui === 'a man' ? 'his' : 'their')}, ${t('taille')}, `
    + `${t('cheveux')}${barbe}, ${t('peau')}. Their outer layer is `
    + `${t('couleur')}. Give them a face that belongs to no one else in the `
    + 'collection.';
}
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
    serie
      ? `Kind and wardrobe, unless the French text above describes different `
        + `clothes, in which case follow the French text: ${serie}.`
      : '',
    corps(f),
    /* La pose de famille cède elle aussi devant le texte de la carte. « Les
       Mains Gelées » applaudit pour se réchauffer les doigts et la Percussion
       lui mettait un tambour ; « Le Parapluie Retourné » tient un parapluie
       retourné et la Fidélité lui croisait les bras ; « Le Drap de Bain » a une
       serviette peinte et le Tifo lui donnait une banderole unie. Trois fois le
       même défaut : une ligne qui décrit la famille appliquée comme si elle
       décrivait la carte. */
    famille
      ? `Pose and props, unless the French text above describes a different `
        + `gesture or object, in which case follow the French text: ${famille}.`
      : '',
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
