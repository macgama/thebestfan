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

/**
 * L'interdit d'écrire, posé **sur les objets qui appellent l'écriture**.
 *
 * `VISUELS.md` l'annonce : « les générateurs ajoutent spontanément des écussons
 * sur les vestes et des lettres sur les bannières, même quand on le leur
 * interdit ». La formule générale n'a pas suffi une seule fois sur cinq images
 * : « CAPO » et « TICKET » sur un manteau, « EVENT » sur un badge, « PRESS » sur
 * un autre, « COLLECTION 2019 » sur un album. À chaque fois sur un objet **fait
 * pour porter des mots** — un livre, un carton, une étiquette, un papier.
 *
 * L'interdit général reste, il couvre le cas qu'on n'a pas prévu. Celui-ci le
 * double là où la faute se produit vraiment, en nommant les objets un par un :
 * un modèle qui lit « no text » en fin d'invite écrit quand même sur la
 * couverture d'un album, parce qu'une couverture d'album *a* un titre. Il faut
 * lui dire que celle-là n'en a pas.
 *
 * C'est le même geste que la clause des Tifo — « the fabric is completely
 * blank » — qui, elle, tient depuis qu'elle existe.
 */
const RIEN_D_ECRIT = `CRITICAL — nothing in the image is written on. Books,
albums, folders, collectible cards, stickers, badges, patches, lanyards, passes,
tickets, sheets of paper, signs, labels and clothing tags carry NO letters, NO
words, NO numbers, NO titles, NO logos and NO emblems anywhere on them.

They are still fully there and fully detailed: a collectible card shows a small
painted picture or a plain block of colour, an album is a thick ringed binder
full of card sleeves, a badge is a circle of plain colour. Keep every object
exactly as recognisable as it should be — simply with no writing on it.

If the French text says that something HAS BEEN written or painted — a banner,
a sign, a shirt, a wall — then show that object rolled up, folded, turned away
from the camera or held against the body, so that the written face is never
visible. The moment is in the character: paint on their hands, the way they
hold it. Never draw the words, not even blurred, not even foreign or invented
letters.`;

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
 * **Une lignée doit avoir la place de vieillir deux fois.**
 *
 * Le tirage d'âge ne savait pas qu'un personnage avec un `evo` sera dessiné
 * trois fois, chaque fois plus vieux. Il donnait donc « in their sixties » au
 * premier âge de soixante-cinq lignées sur cent trente-sept — et les deux âges
 * suivants n'avaient plus nulle part où aller : un homme de soixante ans qui
 * vieillit deux fois finit centenaire, et la carte du milieu ne se distingue
 * plus de rien.
 *
 * Une carte qui a une suite tire donc dans la **moitié jeune** du tableau :
 * adolescent, vingtaine, trentaine. La suite fait le reste — un pas de vie au
 * deuxième âge, le dernier au troisième. Une carte sans lignée garde tout le
 * tableau : `Le Vieux Marin` a le droit d'être vieux dès le premier jour, il
 * n'ira nulle part.
 *
 * **Une table à part, et plus fine.** Réduire `CORPS.age` à ses quatre premières
 * entrées était le geste évident, et il a immédiatement fait doublonner deux
 * cartes de LA TRIBUNE — un tirage à quatre valeurs sur cent trente-sept
 * lignées ne fait pas cent trente-sept corps distincts, et « cinquante cartes,
 * un seul homme » est précisément la faute que cette section corrige. La moitié
 * jeune a donc sa propre table, où elle gagne le détail qu'elle mérite : c'est
 * là que vivent toutes les lignées du jeu.
 *
 * Les cartes sans suite gardent `CORPS.age` intact — leur tirage ne bouge pas
 * d'un iota, et `Le Vieux Marin` a toujours le droit d'être vieux dès le
 * premier jour.
 */
const AGE_JEUNE = ['barely out of their teens', 'in their early twenties',
  'in their mid-twenties', 'in their late twenties', 'in their early thirties',
  'in their mid-thirties', 'in their late thirties'];
/* Sept entrées et pas six : à six, `MS2` et `MS22` décrivaient exactement le
   même corps. Le nombre n'a rien de magique — c'est celui qui ne fait
   doublonner personne, et `invites:test` compare désormais les cent
   soixante-dix-sept corps du catalogue entier pour que le jour où il redevient
   faux se voie tout de suite. La fin de la table reste jeune : « late thirties »
   laisse encore la place de deux pas de vie. */

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
  const lui = (dit.match(/\bils?\b/gi) ?? []).length;
  const elle = (dit.match(/\belles?\b/gi) ?? []).length;
  /* Les deux pronoms se côtoient souvent parce que l'un désigne un objet :
     « Elle tient son carton … sans savoir de quelle couleur il est » parle
     d'une femme et d'un carton, et « Elle balaie deux rangées et il s'excuse »
     parle d'une écharpe et d'un homme. Le sujet du texte est celui qui revient
     le plus ; à égalité, la phrase ne tranche pas, et nous non plus. */
  if (lui > elle) return 'a man';
  if (elle > lui) return 'a woman';
  if (lui) return 'ambigu';
  return null;
}

/**
 * L'âge que la carte annonce déjà, ou `null` si elle n'en dit rien.
 *
 * Même principe que `genreDit` et pour la même raison : le français de la carte
 * est écrit avant le tirage, c'est donc lui qui décide. « Douze ans et l'album
 * complet de 2019 » sous une ligne qui ajoute « à peine sorti de
 * l'adolescence, trois jours de barbe » ne donne pas un enfant, ça donne un
 * compromis — un garçon de quinze ans qui se rase.
 *
 * Quand la carte dit l'âge, on **retire l'âge et la pilosité** du tirage et on
 * garde le reste : la carrure, les cheveux, la peau, la couleur du dessus. Ce
 * sont les traits que le texte ne donne jamais, et c'est justement pour eux que
 * le tirage existe.
 */
const EN_ANNEES = { sept: 7, huit: 8, neuf: 9, dix: 10, onze: 11, douze: 12,
  treize: 13, quatorze: 14, quinze: 15, seize: 16, 'dix-sept': 17, 'dix-huit': 18,
  'dix-neuf': 19, vingt: 20 };
const AGE_DIT = new RegExp(`\\b(${Object.keys(EN_ANNEES).join('|')})\\s+ans\\b`, 'i');
/** L'âge en années que la carte annonce, ou `null`. */
const ageDit = (f) => {
  const m = AGE_DIT.exec(f.histoire ?? '');
  return m ? EN_ANNEES[m[1].toLowerCase()] : null;
};

/**
 * Et le mot qui va avec cet âge-là.
 *
 * « a man » sur un garçon de douze ans est la même contradiction qu'une barbe :
 * le texte dit l'enfant, le tirage dit l'adulte, et le générateur rend un
 * adolescent moyen. Le nombre est écrit dans la carte — autant s'en servir
 * jusqu'au bout.
 */
function motDeLAge(annees, qui) {
  const h = qui === 'a man';
  const f = qui === 'a woman';
  if (annees < 16) return h ? 'a boy' : f ? 'a girl' : 'a child';
  if (annees <= 20) return h ? 'a young man' : f ? 'a young woman' : 'a young supporter';
  return qui;
}

/**
 * Les corps, attribués **une fois pour toutes et sans doublon**.
 *
 * Six tirages indépendants sur le même identifiant, c'est un paradoxe des
 * anniversaires : sur cent soixante-dix-sept cartes, on attend une poignée de
 * corps identiques, et on en avait. Deux existaient avant qu'on touche à quoi
 * que ce soit — `MS23`/`EP11`, `MS21`/`EP13` — et rétrécir la table des âges
 * pour laisser aux lignées la place de vieillir en a ajouté deux. Aucune table
 * ne descend à zéro : c'est de la chance, pas un réglage, et on a essayé quatre
 * tailles pour s'en convaincre.
 *
 * On attribue donc, au lieu de tirer. Chaque carte essaie sa combinaison ; si
 * elle est déjà prise, elle retire avec une graine décalée jusqu'à en trouver
 * une libre. « Un visage qui n'appartient à personne d'autre » devient vrai par
 * construction, et `invites:test` l'exige sur le catalogue entier.
 *
 * **L'attribution se fait sur tout `DEX`, dans son ordre, au chargement du
 * module** — jamais sur ce que l'appelant demande. Sans ça, `--set TR` et
 * `--set MS` se disputeraient les mêmes combinaisons et une carte changerait de
 * corps selon la commande tapée, ce que le contrôle « relancer le script
 * redonne les mêmes » a précisément pour but d'empêcher.
 */
const CORPS_PAR_ID = (() => {
  const pris = new Set();
  const out = new Map();
  for (const f of DEX) {
    if (f.stage !== 1 || SANS_CORPS.has(f.set)) continue;
    for (let essai = 0; essai < 40; essai++) {
      // Le premier essai garde la graine historique : une carte qui n'entre en
      // conflit avec personne ne bouge pas d'un mot.
      const suffixe = essai ? `#${essai}` : '';
      const ligne = decrire(f, suffixe);
      /* On compare le **corps**, pas la phrase entière : la couleur du dessus
         vient après, et deux personnes identiques dans deux manteaux de
         couleurs différentes restent la même personne. C'est déjà la clef que
         `invites:test` regarde. */
      const clef = ligne.split('. Their outer')[0];
      if (essai < 39 && pris.has(clef)) continue;
      pris.add(clef);
      out.set(f.id, ligne);
      break;
    }
  }
  return out;
})();

/** La description d'un corps pour une graine donnée. Voir `CORPS_PAR_ID`. */
function decrire(f, suffixe = '') {
  const t = (sel) => tire(CORPS[sel], f.id + suffixe, sel);
  const annonce = genreDit(f);
  /* Sans genre annoncé, on tire ; avec un genre ambigu, on ne dit rien et la
     pilosité ne se tire pas non plus — une barbe trancherait ce que la phrase
     laisse ouvert. */
  const qui = annonce === 'ambigu' ? 'a supporter' : (annonce ?? t('qui'));
  /* Une carte qui a une suite tire dans la table jeune : il lui faut la place de
     vieillir deux fois. Les autres gardent le tableau complet. */
  const table = f.evo ? AGE_JEUNE : CORPS.age;
  const iAge = graine(f.id + suffixe, 'age') % table.length;
  const age = table[iAge];
  /* Une femme ne tire pas de barbe, et personne ne grisonne avant son heure. */
  /* `AGE_GRIS` est un indice dans `CORPS.age` : il ne veut rien dire dans la
     table jeune, où personne ne grisonne. */
  const barbe = qui === 'a man'
    ? `, ${t(!f.evo && iAge >= AGE_GRIS ? 'barbeAgee' : 'barbe')}`
    : '';
  /* La carte a donné l'âge : le tirage se tait sur l'âge et sur la barbe, et ne
     dit plus que ce que le texte ne dit jamais. */
  const dit = ageDit(f);
  const quiEtAge = dit
    ? motDeLAge(dit, qui)
    : `${qui} ${age.replace(/\btheir\b/,
      qui === 'a woman' ? 'her' : qui === 'a man' ? 'his' : 'their')}`;
  return `Who to draw — unless the French text above says otherwise, in which `
    + `case follow the French text: ${quiEtAge}, ${t('taille')}, `
    + `${t('cheveux')}${dit ? '' : barbe}, ${t('peau')}. Their outer layer is `
    + `${t('couleur')}. Give them a face that belongs to no one else in the `
    + 'collection.';
}

/** Le corps de cette carte : celui qui lui a été attribué, et personne d'autre. */
function corps(f) {
  if (SANS_CORPS.has(f.set)) return '';
  return CORPS_PAR_ID.get(f.id) ?? decrire(f);
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
const PAS_HUMAIN = {
  OB: 'stadium object', GC: 'piece of stadium food or drink',
  MT: 'weather phenomenon', BG: 'animal',
};

/**
 * Comment une carte traverse ses trois âges.
 *
 * Deux questions qu'on avait confondues en une : « est-ce un humain ? » et
 * « comment ça évolue ? ». Un seul tableau répondait aux deux, et le Bestiaire
 * en payait le prix — un hibou n'est pas un humain, donc il était rangé avec
 * la merguez et « montait en intensité » au lieu de vieillir. Or ses propres
 * textes le font vieillir : le deuxième âge du Hibou Statisticien parle de
 * soixante-dix ans de feuilles de match. La série disait une chose, l'invite
 * en demandait une autre.
 *
 * Les deux questions sont donc posées séparément. `PAS_HUMAIN` dit ce qu'on
 * dessine, `ECHELLE` dit ce que le temps lui fait :
 *
 *   - `vivant`     — il vieillit : enfant ou ado, trente ans, cinquante ans.
 *   - `fabrique`   — il s'use : neuf, servi, patiné. Jamais cassé.
 *   - `phenomene`  — il ne fait ni l'un ni l'autre : il devient plus lui-même.
 *
 * La troisième échelle n'est pas un reliquat. Une averse et une merguez ne
 * sont ni des vivants ni des machines : « usé mais expérimenté » ne veut rien
 * dire pour une averse, et c'est pour elles que la montée en intensité a été
 * écrite.
 */
const ECHELLE = { OB: 'fabrique', GC: 'phenomene', MT: 'phenomene' };
const echelleDe = (f) => ECHELLE[f.set] ?? 'vivant';

/**
 * Et l'échelle des vivants se dit en deux langues.
 *
 * Un hibou vieillit comme un homme — c'est bien la même échelle — mais il n'a
 * ni cheveux, ni teint, ni blouson à fermer. Faire basculer le Bestiaire chez
 * les vivants sans ça lui collait « the hair still its own colour », « same
 * skin tone » et « a few small plain round cloth badges sewn onto it ».
 *
 * L'échelle dit ce que le temps fait, le dialecte dit avec quel vocabulaire.
 * Les trois échelles restent trois ; `bete` et `humain` sont deux façons de
 * dire la première.
 */
const dialecteDe = (f) => (echelleDe(f) === 'vivant'
  ? (PAS_HUMAIN[f.set] === 'animal' ? 'bete' : 'humain')
  : echelleDe(f));

function invite(f) {
  const famille = FAMILLE[f.type] ?? '';
  const serie = SERIE[f.set] ?? '';
  const chose = PAS_HUMAIN[f.set];
  return [
    'A single stylised 3D character, full body, standing, isolated on a '
      + 'completely plain flat mid-grey background.',
    '',
    `Character: "${f.nom}".`,
    f.histoire ? 'Who they are — this is written in French, follow it closely, '
      + 'and it wins over every instruction below EXCEPT the ones marked '
      + `CRITICAL, which always win: ${f.histoire}` : '',
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
    RIEN_D_ECRIT,
    '',
    GARDE,
  ].filter(Boolean).join('\n');
}

/* ==================================================== la montée des âges

   ## Un Fanzzy traverse une vie

   Âge 1 l'enfant ou l'adolescent, âge 2 l'adulte, âge 3 le vieux. C'est le
   vieillissement qui porte l'évolution, et ce n'est pas une préférence
   d'écriture : c'est ce qui est **amusant**. Voir son personnage traverser une
   vie est une récompense ; le voir gagner deux pastilles cousues n'en est pas
   une.

   Cette règle a été essayée dans l'autre sens, et l'essai a tranché. Une
   version de cette fonction figeait l'âge et ne faisait monter que le domaine
   — le raisonnement était bon sur le papier, la reconnaissance du personnage
   passait avant tout. Les deux dessins qui en sont sortis ont montré ce que le
   papier ne dit pas : un gamin qui reste un gamin avec plus d'écussons, ce
   n'est pas une évolution, c'est une variante. On revient donc au
   vieillissement, et on garde de l'essai ce qu'il a apporté.

   ## Ce que l'essai a apporté, et qui reste

   Les cinq axes. Ils ne remplacent plus l'âge — ils le **dessinent**, et
   surtout ils le rendent lisible là où l'âge seul ne l'est pas : dans le
   classeur, une carte fait cent cinquante pixels de haut, et une ride ne s'y
   voit pas. Une silhouette, si.

     1. l'empreinte au sol — pieds joints, puis écartés, puis plantés ;
     2. la masse du vêtement — flottant, ajusté, long et lourd ;
     3. l'objet du domaine — il monte **dans sa famille**, jamais ailleurs ;
     4. l'accumulation — les pastilles cousues, l'écharpe au poignet ;
     5. l'ouverture — bras au corps, menton levé, bras ouverts.

   ## Et ce qui reste protégé

   Vieillir quelqu'un et le remplacer sont deux choses différentes, et un
   générateur ne fait pas la différence tout seul : il redessine un visage
   moyen de l'âge demandé. On lui interdit donc **l'ossature** — la forme des
   yeux, le nez, la mâchoire, le teint, la palette du vêtement — et on ne lui
   laisse que ce que les années font vraiment : les cheveux, la peau, la
   carrure, le port. C'est la seule ligne qui sépare « il a grandi » de
   « ce n'est plus lui », et elle vaut pour les trois âges.                   */

/**
 * Ce que le personnage tient, à chacun des trois âges.
 *
 * L'escalade reste **dans la famille**, et c'est une correction, pas une
 * précaution : le troisième âge de TR1, un personnage Voix, est arrivé avec un
 * tambour sanglé sur le ventre. Le dessin annonçait une famille que la carte ne
 * joue pas — exactement la faute que `FAMILLE` corrige déjà pour les premiers
 * âges, refaite ici parce que l'invite des âges ne disait rien du domaine.
 *
 * Le tableau ne dit plus d'où l'on part. Il l'a dit un temps, un objet de
 * départ par famille, pour qu'une édition annonce « ils avaient ceci, ils ont
 * maintenant cela » et remplace au lieu d'ajouter. Mais cet objet était une
 * supposition sur un dessin que le générateur n'a jamais lu : la Voix partait
 * « les mains vides », et le premier âge de TR4 tient un téléphone — il filme
 * tout, c'est sa carte. La phrase devenait fausse devant l'image, et un modèle
 * qui doit arbitrer entre ce qu'on lui écrit et ce qu'il voit garde les deux
 * objets : exactement l'ajout qu'on voulait empêcher.
 *
 * On ne nomme donc plus le point de départ, on le désigne : « ce qu'ils
 * tenaient dans les mains sur l'image de référence ». C'est vrai quel que soit
 * le dessin, mains vides comprises. Ce qui est *porté* est explicitement
 * épargné, sinon le casque de TR4 et l'écharpe du Déplacement partiraient avec.
 */
const MONTEE = {
  /* Le deuxième âge de la Voix ne tient rien : il crie, une main en coupe
     devant la bouche. Écrit sous l'étiquette « ce qu'ils tiennent », c'était
     la faute du Collectionneur refaite à l'identique — on demandait un objet
     et on décrivait une posture. Il passe donc par `tenue`. */
  voix: [{ tenue: 'one hand cupped beside the mouth, mouth open mid-shout' },
    'a plain smooth megaphone cone raised high in one hand, mouth wide open'],
  perc: ['a simple street drum on a strap, sticks mid-beat',
    'a large bass drum strapped across the body, one heavy beater raised'],
  tifo: ['a plain single-colour flag on a short pole, held up',
    'a large folded plain banner over one shoulder and a tall bare pole'],
  pyro: ['one lit flare held up, its warm light only on them',
    'one lit flare held at arm’s length above the head, thin smoke rising'],
  depl: ['the same scarf held wide between both hands',
    'the same scarf held high and taut, a worn travel bag across the body'],
  /* La Fidélité ne tient rien : sa force est de ne pas bouger. Sa montée est
     donc une **tenue**, pas un objet — et c'est ce qui a coûté deux rendus au
     Collectionneur. La ligne s'intitulait « ce qu'ils tiennent » et décrivait
     des bras croisés : un modèle qui lit ça vide les mains, quoi qu'on écrive
     ailleurs. On ne lui demande plus d'arbitrer entre deux instructions
     contraires, on ne lui en donne qu'une. */
  fide: null,
};

/** Pour la Fidélité, dont la montée est une tenue et non un objet. */
const MONTEE_TENUE = [null,
  'they stand more solidly than before, weight settled, nothing moves them — '
    + 'and they keep whatever they are holding in the reference image',
  'they are immovable, weight low, planted — and they keep whatever they are '
    + 'holding in the reference image, worn and familiar after all these years'];

/** Les familles dont l'objet ne doit jamais apparaître ici. */
const PAS_CHEZ_MOI = {
  voix: 'no drum, no drumsticks, no flare, no flag, no banner',
  perc: 'no megaphone, no flare, no flag, no banner',
  tifo: 'no drum, no drumsticks, no flare, no megaphone',
  pyro: 'no drum, no drumsticks, no flag, no banner, no megaphone',
  depl: 'no drum, no drumsticks, no flare, no megaphone, no banner',
  fide: 'no drum, no drumsticks, no flare, no flag, no banner, no megaphone',
  /* La Fidélité garde ce qu'elle avait : on ne lui ajoute rien et on ne lui
     retire rien. */
};

/** Les quatre autres axes, pour un personnage qui a un corps et des vêtements. */
const AXES = {
  2: ['feet shoulder-width apart, weight settled',
    'the same outer layer, now worn closed and fitting them properly',
    'a few small plain round cloth badges sewn onto it',
    'chin up, chest forward, looking straight at the camera'],
  3: ['legs planted wide, weight low, rooted to the spot',
    'the same outer layer, longer and heavier, worn open over the rest',
    'many small plain cloth badges across it, and a band of cloth tied '
      + 'around one wrist',
    'both arms open, chest out, facing the camera dead on'],
};

/**
 * Et pour ceux qui n'ont ni corps ni vêtements.
 *
 * `dex-ages.js` l'écrit déjà : une bête, un revenant ou un objet « ne fait pas
 * carrière, il devient plus lui-même ». Les pastilles cousues et le manteau
 * long n'ont rien à lui dire ; la masse, la densité et la couleur, si.
 */
const AXES_PHENOMENE = {
  2: ['standing a little straighter, more solidly planted',
    'slightly bigger and denser, its colours deeper',
    'its surface more defined — grain, seams or fur clearly readable',
    'the face more awake, looking straight at the camera'],
  3: ['planted wide and low, unmistakably heavy',
    'clearly bigger, its colours at their strongest',
    'its surface at its richest, every detail deliberate',
    'the face fully alive and certain, facing the camera dead on'],
};

/**
 * Et pour ce qui a été fabriqué, qui ne grossit pas : il sert.
 *
 * La montée en intensité ne lui va pas — un objet du stade qui devient deux
 * fois plus gros au troisième âge n'est plus le même objet. Ce qui change,
 * c'est son état : le neuf qui perd son brillant, puis la patine de ce qu'on
 * a gardé longtemps parce que ça marchait.
 *
 * Le troisième axe porte l'expérience, faute de quoi « usé » se lirait comme
 * « abîmé » : ce qu'on lui a ajouté, rafistolé, ce qui s'est marqué à force.
 */
/**
 * Et pour une bête, qui vieillit sans garde-robe.
 *
 * Les cinq axes des humains passent par le vêtement — le blouson qu'on ferme,
 * les pastilles qu'on coud. Une bête n'en a pas : ce qui s'accumule chez elle,
 * c'est le pelage, les marques, et ce qu'on lui a donné à garder.
 */
const AXES_BETE = {
  2: ['standing a little straighter, more solidly planted',
    'its coat or feathers thicker and better kept than before',
    'one or two marks of a life lived — a notch, a scar, a patch of '
      + 'different colour',
    'the face more awake, looking straight at the camera'],
  3: ['planted wide and low, unmistakably heavy',
    'its coat or feathers paler around the face, thicker still at the neck',
    'many marks of a long life, each one plain to see',
    'the face fully alive and certain, facing the camera dead on'],
};

const AXES_FABRIQUE = {
  2: ['sitting a little more solidly, as if it has found its place',
    'the shine gone off its surface, edges softened by handling',
    'one or two small marks of use — a scuff, a crease, a faded patch',
    'the face more awake, looking straight at the camera'],
  3: ['planted heavily, settled where it belongs',
    'its surface polished smooth where hands go, its colours faded and mellow',
    'several small careful repairs and added parts, each one still working',
    'the face fully alive and certain, facing the camera dead on'],
};

/**
 * Ce que le temps fait à chaque échelle, et ce qu'il ne doit pas faire.
 *
 * ## Pourquoi le troisième âge disait des chiffres qu'il ne fallait pas
 *
 * L'échelle allait jusqu'au bout d'une vie : « grey or white hair, a lined and
 * weathered face, a heavier or more stooped frame ». Or c'est mot pour mot ce
 * que la ligne CRITICAL d'à côté protège — `OSSATURE` demande la même couleur
 * de cheveux, le même visage, la même carrure. L'invite se contredisait elle-
 * même : garde la même personne, et change précisément ce qui la fait
 * reconnaître. Un modèle qui doit trancher entre deux ordres contraires dessine
 * quelqu'un d'autre, et c'est ce qu'on voyait — l'écart entre le deuxième et le
 * troisième âge ne venait pas de la distance en années, il venait de là.
 *
 * Trente et cinquante ans **ajoutent** au lieu de remplacer : des rides aux
 * yeux, du gris aux tempes, une carrure plus lourde, posés sur des traits qui
 * restent. Ce qui portait la lisibilité de l'évolution, ce sont les cinq axes
 * — ils existent pour ça, et ils la portent maintenant seuls.
 *
 * ## Le chiffre et le texte de la carte
 *
 * L'ancienne version refusait tout nombre, et la raison était bonne :
 * quarante-neuf textes d'âge citent une durée — « onze ans », « soixante-dix
 * ans de feuilles de match » — et deux chiffres qui se contredisent dans une
 * même invite donnent un personnage entre les deux.
 *
 * Mais se taire ne réglait rien, ça laissait seulement le modèle deviner. Le
 * chiffre est donc écrit **et** subordonné : chaque ligne dit que le français
 * de la carte gagne s'il donne un âge, et qu'une durée passée à faire quelque
 * chose n'est pas un âge. C'est nécessaire ici et nulle part ailleurs, parce
 * que cette ligne est écrite *au-dessus* du texte français — la clause générale
 * « it wins over every instruction below » ne la couvre pas.
 */
const AGE = {
  humain: {
    2: 'around thirty years old: a grown adult, fuller in the frame than the '
      + 'child or teenager they were, the face set and no longer soft, the hair '
      + 'still its own colour, worn differently since. Not old, not grey, not '
      + 'weathered. If the French text below states their age, that age wins — '
      + 'and a number of years spent doing something is not their age.',
    3: 'around fifty years old: settled and solid, lines at the eyes and the '
      + 'mouth, some grey at the temples, a heavier build, hands that have '
      + 'worked. This is mid-life and not old age: still upright, still strong, '
      + 'no white hair, no stoop, no frailty. If the French text below states '
      + 'their age, that age wins — and a number of years spent doing something '
      + 'is not their age.',
  },
  /* La même échelle, dans la langue d'une bête : ni cheveux, ni rides, ni
     tempes grises — un pelage, un bec, une démarche. */
  bete: {
    2: 'fully grown and in its prime: bigger and heavier than the young animal '
      + 'it was, its body filled out, its coat or feathers thick and well kept, '
      + 'its movements sure. Not old, not greying, not worn. If the French text '
      + 'below states its age, that age wins — and a number of years spent doing '
      + 'something is not its age.',
    3: 'past its prime but not old: heavier and broader still, the fur or '
      + 'feathers around its face paler than the rest, a few marks of a long '
      + 'life. Still strong, still upright, still quick — not frail, not '
      + 'sickly, not near its end. If the French text below states its age, that '
      + 'age wins — and a number of years spent doing something is not its age.',
  },
  /* Un objet ne vieillit pas, il sert. Et « usé » doit se lire *patine*, jamais
     *avarie* : à quarante-huit pixels, abîmé et vieux se ressemblent, et un
     objet abîmé se lit comme une carte moins bonne — le contraire de ce qu'une
     évolution promet. D'où l'interdit en CRITICAL, qu'aucun texte de carte ne
     peut lever. */
  fabrique: {
    2: 'not older but used: still sound and complete, simply no longer new — '
      + 'the shine gone off it, its edges softened by handling, its colours a '
      + 'little less fresh.',
    3: 'not older but long used: deeply patinated — surfaces polished smooth '
      + 'where hands go, colours faded and mellow, a few small repairs that were '
      + 'made carefully to keep it working. It looks trusted, kept for years '
      + 'because it works.\nCRITICAL — worn, never damaged: no cracks, no rust, '
      + 'no tears, no missing pieces, no dirt, nothing broken.',
  },
  /* Ni vivant ni fabriqué : une averse ne s'use pas et une merguez n'a pas
     trente ans. C'est la règle d'écriture de `dex-ages.js`, et la seule qui ait
     un sens pour elles. Les deux âges disent maintenant deux pas différents —
     le même texte aux deux donnait deux fois le même dessin. */
  phenomene: {
    2: 'not older and not worn: MORE ITSELF — a step bigger and denser, its '
      + 'colours deeper, its presence heavier.',
    3: 'not older and not worn: fully ITSELF — at its largest and densest, its '
      + 'colours at their strongest, impossible to look past.',
  },
};

/**
 * Et l'identité, à chaque échelle.
 *
 * C'est la demande derrière tout le reste : qu'on retrouve l'âme du personnage
 * d'un âge à l'autre. Elle n'était exigée que des vivants — un objet et une
 * bête pouvaient revenir en n'importe quel autre objet, n'importe quelle autre
 * bête. Elle est exigée des trois, en nommant ce qui doit tenir.
 */
const IDENTITE = {
  /* `OSSATURE` est ajoutée au moment de l'écriture : elle est déclarée plus
     bas, avec le reste de ce qui ne doit pas bouger. */
  humain: 'CRITICAL — it must still be recognisably the SAME CHARACTER, not '
    + 'someone else of that age.',
  bete: 'CRITICAL — it must still be recognisably the SAME ANIMAL, not another '
    + 'one of its species: same species, same build, same head shape, same eye '
    + 'shape and eye colour, same beak or muzzle, same markings and the same '
    + 'coat or plumage colours, same anything it wears or carries.',
  fabrique: 'CRITICAL — it must still be recognisably the SAME OBJECT, not '
    + 'another one like it: same shape, same proportions, same colours, same '
    + 'markings, same face. Only its condition changes.',
  phenomene: 'CRITICAL — it must still be recognisably the SAME ONE, not '
    + 'another of its kind: same shape, same proportions, same colours, same '
    + 'markings, same face. Only its scale and its intensity change.',
};

/**
 * Ce qui fait que c'est toujours **lui**, et pas quelqu'un du même âge.
 *
 * C'est la moitié de l'invite qui demande le plus de précision : un générateur
 * à qui l'on demande « le même, plus vieux » dessine un visage moyen de l'âge
 * demandé. On nomme donc ce qui ne bouge pas — l'ossature, pas l'apparence —
 * et on l'oppose explicitement à ce que les années ont le droit de changer.
 */
const OSSATURE = 'Same bone structure, same eye shape and eye colour, same nose, '
  + 'same jaw and chin, same ears, same skin tone, same freckles or marks, same '
  + 'natural hair colour where it has not greyed. Same wardrobe and same colour '
  + 'palette — these are their clothes, aged with them, not new ones.';

/**
 * L'invite d'un **âge supérieur**, pour l'image-à-image.
 *
 * Elle ne décrit ni le rendu, ni le cadrage, ni le fond : tout cela est déjà
 * dans l'image de référence, et le redire ferait régénérer la frame entière.
 * Elle nomme trois choses, dans cet ordre : ce que les années font, ce qu'elles
 * n'ont pas le droit de toucher, et ce que le personnage est devenu dans son
 * domaine.
 *
 * **La référence est toujours le premier âge**, jamais l'âge précédent : deux
 * éditions en cascade perdent le visage, et c'est le visage qu'on protège.
 *
 * **Et la formule de `VISUELS.md` y est.** Elle n'y était pas — elle ne vivait
 * que dans l'invite des premiers âges. Les deux seules images du jeu qui
 * portent du texte interdit et des écussons de club sont précisément les deux
 * âges supérieurs de TR1, sortis de cette fonction. Une règle de droits qui ne
 * couvre qu'une moitié de la chaîne ne couvre rien.
 */
function inviteAge(f) {
  const r = racineDe(f.id);
  const dialecte = dialecteDe(f);
  const vivant = echelleDe(f) === 'vivant';
  /* Seul l'humain est « them » : une bête, un objet et une averse sont « it »,
     et leurs textes d'échelle sont écrits ainsi. */
  const pronom = dialecte === 'humain' ? 'them' : 'it';
  const axes = ({ humain: AXES, bete: AXES_BETE, fabrique: AXES_FABRIQUE,
    phenomene: AXES_PHENOMENE })[dialecte][f.stage];
  const montee = MONTEE[f.type];
  const rang = f.stage === 2
    ? 'They have taken their place: the terrace knows them now.'
    : 'They lead now: everyone around them follows what they do.';

  return [
    `Take the character from the reference image and show ${pronom} ${vivant
      ? 'at a later age' : 'in a later state'}. Same background, same `
      + 'framing, same lighting, same render style.',
    '',
    /* Trois échelles, une par manière de traverser le temps : le vivant
       vieillit, le fabriqué s'use, le phénomène monte en intensité. */
    `Make ${pronom} ${AGE[dialecte][f.stage]}`,
    dialecte === 'humain'
      ? `${IDENTITE.humain} ${OSSATURE}` : IDENTITE[dialecte],
    '',
    /* ## Le français d'abord, les consignes ensuite
       
       L'ordre n'est pas cosmétique, il décide de qui gagne. L'invite des
       premiers âges pose l'histoire **avant** la garde-robe et la pose, et
       chacune de ces lignes dit « sauf si le texte français ci-dessus dit
       autre chose » : c'est ce qui fait que Le Collectionneur garde son album.
       
       Les âges faisaient l'inverse — les cinq axes, puis l'histoire — avec la
       même clause en travers. Elle n'a pas tenu : au deuxième âge, une Fidélité
       dont toute la lignée parle de cartes est revenue bras croisés et mains
       vides. Un modèle suit l'instruction concrète qu'il vient de lire, pas
       celle qui viendra. */
    `They are now called "${f.nom}".`,
    /* « Il gagne sur tout ce qui suit » était un blanc-seing, et il couvrait
       aussi les lignes de droits. La carte TR3B s'appelle « La Banderole
       Écrite » : à la lettre, le texte autorisait le générateur à écrire les
       trois mots sur la bâche, ce que `VISUELS.md` interdit sans exception. Le
       français décide de ce que le personnage est devenu, jamais de ce qu'on a
       le droit de dessiner. */
    f.histoire ? 'What they have become — this is written in French, follow it '
      + 'closely, and it wins over every instruction below EXCEPT the ones '
      + `marked CRITICAL, which always win: ${f.histoire}` : '',
    r?.nom ? `They were "${r.nom}" in the reference image.` : '',
    '',
    `What else changes — ${rang}`,
    `• ${axes[0]};`,
    `• ${axes[1]};`,
    `• ${axes[2]};`,
    `• ${axes[3]}.`,
    montee
      ? (montee[f.stage - 2].tenue
        ? `• how they stand, UNLESS the French text above names an object of their `
          + `own — in that case they keep that object and this line is ignored: `
          + `${montee[f.stage - 2].tenue}. Their hands are free: whatever they held `
          + `in the reference image is gone. What they WEAR stays with them.`
        : `• what they hold, UNLESS the French text above names an object of their `
          + `own — in that case they keep that object and this line is ignored: they `
          + `now have ${montee[f.stage - 2]}, and it is their only object — whatever `
          + `they were holding in their hands in the reference image is gone, `
          + `replaced by this one. Never draw both. What they WEAR stays with them.`)
      : (vivant && MONTEE_TENUE[f.stage - 1]
        ? `• how they stand: ${MONTEE_TENUE[f.stage - 1]}.`
        : ''),
    '',
    'Do not change anything else. One single figure, same empty flat background.',
    '',
    /* Les pastilles cousues sont l'endroit exact où un générateur écrit : les
       deux âges de TR1 en sont revenus couverts de « CAPO », « TICKET » et de
       boucliers à lions. L'interdit doit être là où naît l'envie, pas seulement
       dans la formule générale. */
    PAS_CHEZ_MOI[f.type]
      ? `CRITICAL — they belong to one family only: ${PAS_CHEZ_MOI[f.type]}.`
      : '',
    RIEN_D_ECRIT,
    '',
    GARDE,
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
