/**
 * Les illustrations de l'équipement.
 *
 * Sept pièces, un objet chacune. Elles étaient un nom en gras et une phrase :
 * on choisissait « Bout de bâche » contre « Thermos » sans avoir jamais vu ni
 * l'un ni l'autre, et l'emplacement d'équipement du deck — un écran où l'on
 * passe du temps — n'était qu'un rectangle de texte.
 *
 * ## Ce que fait ce script
 *
 * Il ne génère rien. Il **détoure et range** : il prend les dessins produits
 * par Artlist, déposés dans `art/stuff/<id>.png`, découpe le fond, et en tire
 * les trois formats que le jeu sert.
 *
 * ## Pourquoi un détourage, alors que les cartes d'action n'en ont pas
 *
 * Parce que ces objets-là ne restent pas dans leur cadre. Une carte d'action
 * est une scène : elle remplit sa carte et n'en sort jamais. Une pièce
 * d'équipement est un **objet**, et un objet finit sur le personnage qui le
 * porte — une écharpe autour d'un cou, un mégaphone dans une main. Servi avec
 * son fond, il arriverait là-bas avec un carré noir autour.
 *
 * Le fond est donc demandé **plat et uniforme** à la génération, et découpé
 * ici par propagation depuis les bords : seul ce qui touche le bord et lui
 * ressemble disparaît. Les noirs intérieurs de l'objet — l'ombre d'un pli, le
 * creux d'un pavillon de mégaphone — ne sont jamais atteints, puisqu'ils ne
 * sont pas reliés au bord. C'est toute la raison d'un remplissage par
 * propagation plutôt que d'un simple seuil sur la couleur, qui, lui, aurait
 * troué les objets.
 *
 * Le format de secours est le **PNG** et pas le JPEG, contrairement aux cartes
 * d'action : ici il y a une transparence à garder, et un JPEG n'en a pas.
 *
 * Usage :  node scripts/stuff-images.mjs
 *          node scripts/stuff-images.mjs --invites   (les imprime)
 */
import { readdir, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STUFF } from '../src/shared/fanzzy/inventaire.js';
import { enIcone, partSuspecte, ecrireLesTrois } from './detourage.mjs';

const RACINE = fileURLToPath(new URL('..', import.meta.url));

/**
 * Ce que ce script détoure, et où.
 *
 * **Les gains passent par ici aussi**, et non par un second script. Une pile
 * d'écharpes et une poignée de billets sont exactement ce que sont les pièces
 * d'équipement : des objets dessinés sur fond plat, qu'on sert détourés parce
 * qu'ils finissent posés sur autre chose — une carte qui se retourne, un
 * bandeau de gain. Le détourage est délicat, il est écrit une fois, et deux
 * copies auraient divergé à la première correction.
 *
 * Les gains n'ont ni rareté ni texte : ce ne sont pas des cartes, ce sont les
 * deux monnaies du jeu. D'où une liste à eux, réduite à ce qu'elle doit être.
 */
const GAINS = [{ id: 'echarpes', nom: 'Écharpes' }, { id: 'billets', nom: 'Billets' }];

/**
 * **Les pièces des arènes** (lot 7) : le foulard noué qui court sur la corde
 * du Virage et du duel. Un objet sur fond vert comme les autres, servi
 * détouré parce qu'il passe devant la corde et la foule. Dessiné neutre,
 * crème et gris : la feuille le teint aux couleurs du camp (`ui.css`,
 * `.tbf-foulard`). La source choisie parmi les variantes de
 * `art/arene/_src/` se dépose en `art/arene/foulard-noeud.png`.
 *
 * Facultative : un poste qui n'a pas `art/arene/` range quand même
 * l'équipement et les gains, au lieu de s'arrêter.
 */
const ARENE = [{ id: 'foulard-noeud', nom: 'Foulard noué' }];

const FAMILLES = [
  { nom: 'stuff', pieces: STUFF,
    source: path.join(RACINE, 'art', 'stuff'),
    cible: path.join(RACINE, 'public', 'img', 'stuff') },
  { nom: 'gains', pieces: GAINS,
    source: path.join(RACINE, 'art', 'gains'),
    cible: path.join(RACINE, 'public', 'img', 'gains') },
  { nom: 'arene', pieces: ARENE, facultative: true,
    source: path.join(RACINE, 'art', 'arene'),
    cible: path.join(RACINE, 'public', 'img', 'arene') },
];

/**
 * La taille servie.
 *
 * Le plus grand usage est la pastille de l'emplacement d'équipement, environ
 * cent vingt pixels de côté sur un écran à deux fois la densité. On sert donc
 * du 256 carré, et pas les mille vingt-quatre pixels du générateur : un objet
 * quatre fois trop grand ne se voit pas, il se télécharge.
 */
const COTE = 256;

/* Le style commun. Il est écrit une fois : sept objets dessinés chacun dans
   son coin ne font pas un inventaire, ils font sept images.

   Deux exigences portent tout le reste. Le **fond parfaitement plat** : c'est
   lui qui rend le détourage fiable, et un dégradé ou une ombre portée le
   ferait échouer en laissant une auréole. Et **l'objet seul** : pas de main
   qui le tient, pas de sol sous lui — la main viendra du personnage. */
/* Le fond, et pourquoi il n'est pas toujours le même.

   Le détourage part des bords et se propage **par ressemblance de couleur** :
   tout ce qui touche le bord et ressemble au fond disparaît. Un objet qui
   porte du noir jusque sur sa silhouette est donc mangé par un fond noir — les
   écharpes rayées noir, blanc et orange sont arrivées sans leurs rayures
   noires, et le contrôle de surface n'a rien dit puisque la part de fond
   restait normale.

   Le vert de studio règle ça une fois pour toutes, et il n'y a aucune raison
   de le réserver à ce cas : aucun objet du jeu n'est vert. Le noir d'origine
   n'était utile que pour juger l'image à l'œil pendant la génération — ce
   qu'on ne fait plus, puisque la planche contact vient après le détourage. */
const FOND = `Background: a completely flat, uniform, saturated studio green
(#00B140), the exact same colour everywhere. No gradient, no vignette, no
floor, no surface, no cast shadow, no reflection, no green glow or green rim
spilling onto the object itself.`;

const STYLE = `Style: stylised 3D game item icon, modern mobile game art,
chunky readable silhouette, bold simplified shapes, clean edges, soft key light
with a strong cool rim light separating the object from the background,
painterly texture. NOT photorealistic.

Composition: the object alone, centred, filling most of the frame, seen at a
slight three-quarter angle, floating.

${FOND}

Strictly forbidden: any text, letters, numbers, logos, real club crests, card
frame or border, human figures or hands, watermark.`;

/** Le sujet de chaque pièce. */
export const INVITES = {
  /* Les couleurs sont nommées, et ce sont celles du jeu : noir, blanc, orange.
     Sans consigne, le générateur peint des écharpes rouge et or — jolies, et
     étrangères à tout le reste de l'écran. Une monnaie se reconnaît d'un coup
     d'œil ou ne se reconnaît pas. */
  /* Neutre, pour que la teinte du camp le prenne : sans « no stripes », le
     générateur tricote des rayures que la feuille ne pourrait plus teindre. */
  'foulard-noeud': 'a single knitted football supporter scarf tied into one tight round '
    + 'knot, two short fringed ends hanging down from the knot, chunky wool, plain undyed '
    + 'cream and light grey only, no stripes, no pattern, slightly worn',
  echarpes: 'a small neat stack of several folded knitted football supporter scarves '
    + 'piled on top of one another, chunky wool with bold horizontal stripes in deep '
    + 'black, off-white and warm orange only, fringed ends visible at the sides, '
    + 'slightly worn',
  billets: 'a small loose fan of four or five paper football match tickets, thick card '
    + 'stock with a perforated tear line and a torn stub edge, one ticket slightly '
    + 'curled at the corner, no writing on them',
  jumelles: 'a pair of compact well-used binoculars with a worn leather neck strap '
    + 'curling beside them, rubber armour, textured focus wheel',
  echarpe: 'a thick knitted football supporter scarf, chunky wool with bold horizontal '
    + 'stripes, folded over on itself with the ends hanging, slightly worn, no text and '
    + 'no crest on it',
  tambour: 'a small hand-held supporter drum, a shallow wooden shell with a taut skin '
    + 'and rope tensioning, a canvas shoulder strap, one worn wooden beater resting '
    + 'against it',
  /* La capuche est la seule pièce qui se porte : il faut donc dire deux fois
     qu'elle est vide, sinon le modèle met quelqu'un dedans — et on se retrouve
     avec une tête encagoulée, ce qui n'est pas le jeu qu'on fait. */
  capuche: 'a dark grey hooded sweatshirt, empty and unworn, neatly bundled with its '
    + 'hood standing up and open at the front, drawstrings hanging, worn fabric. Nobody '
    + 'is wearing it, the hood is empty and you can see through the opening',
  megaphone: 'a battered handheld megaphone, wide flared horn, pistol grip with a '
    + 'trigger, a short carrying strap, scuffed paint and dents',
  thermos: 'a battered metal vacuum flask, dented brushed steel body, its screw-on cup '
    + 'sitting beside it, a faint wisp of steam rising from the open neck',
  bache: 'a heavy plain tarpaulin banner, rolled and bundled into a thick coil, brass '
    + 'eyelets along its edge, a length of rope threaded through them, creased and '
    + 'weather-stained canvas, completely blank with nothing painted on it',

  /* Les dix du second sac.
     Deux pièges appris sur les sept premières, et qui se rappellent ici :
     un vêtement finit porté par quelqu'un si l'on ne dit pas deux fois qu'il
     est vide (voir la capuche) ; et tout ce qui peut porter un écusson en
     porte un, inventé, si l'on n'écrit pas qu'il n'y a rien dessus. */
  gants: 'a pair of dark knitted fingerless gloves, thick wool, the cut edges of the '
    + 'fingers frayed, one lying flat and one half curled, well worn',
  sifflet: 'a small metal pea whistle on a short braided cord, brass and chrome, '
    + 'scratched from use, the cord coiled loosely beside it',
  carnet: 'a small pocket notebook stuffed with folded paper slips, its cardboard cover '
    + 'soft and curling, a rubber band around it, held half open, the visible pages '
    + 'covered in illegible handwritten scribbles with no readable words',
  bonnet: 'a thick knitted beanie hat with a folded brim and bold horizontal stripes, '
    + 'empty and unworn, slumped and holding its shape. Nobody is wearing it, there is '
    + 'no head inside it, no crest and no lettering on it',
  brassard: 'a wide fabric captain armband with a buckle strap, bold two-tone diagonal '
    + 'stripes, lying curled into a loop, worn edges, completely blank with no letters '
    + 'or numbers on it',
  drapeau: 'a large supporter flag on a wooden pole, the plain fabric furled loosely '
    + 'around the shaft with one corner falling open, a leather grip on the pole, no '
    + 'emblem and nothing written on the cloth',
  tifosac: 'an open cardboard box packed upright with hundreds of thin coloured card '
    + 'sheets, a few loose cards spilling over the rim, the box scuffed at the corners',
  cornet: 'a compressed air horn canister with a red plastic trumpet fitting screwed on '
    + 'top, a dented metal can, condensation on the surface, no label and no text on it',
  chrono: 'an old mechanical stopwatch with a chrome case and a large crown button, its '
    + 'lanyard ring at the top with a short leather strap, the dial face plain with '
    + 'simple tick marks and no numbers',
  fanion: 'a small triangular pennant on a short varnished stick, heavy velvet with a '
    + 'gold bullion fringe along the bottom edge, faded and slightly moth-eaten, the '
    + 'fabric completely plain with no crest, no date and no lettering',

  /* ------------------------------------------------------ LA REPRISE, les vingt

     Une série sur la rentrée : tout y est soit **neuf et raide**, soit **resté
     tout l'été quelque part**. C'est la seule chose que ces vingt invites
     doivent tenir ensemble — un objet de LA REPRISE se reconnaît à son état, pas
     à sa forme. Les pliures du carton, la poussière de grenier et le caoutchouc
     encore rigide font plus pour la série que n'importe quelle couleur.

     Les deux pièges des vingt-deux précédentes valent toujours, et deux d'entre
     elles les cumulent : un vêtement finit porté si l'on ne dit pas deux fois
     qu'il est vide, et tout ce qui peut porter un écusson en porte un, inventé,
     si l'on n'écrit pas qu'il n'y a rien dessus. Le maillot de l'an dernier est
     le cas limite — c'est un vêtement **et** une surface à écusson.

     Les lunettes et la casquette portent un nom qui parle d'un front et d'une
     tête ; l'invite, elle, ne montre que l'objet. Le nom raconte l'usage, le
     dessin montre ce qu'on possède — et le style interdit de toute façon les
     figures humaines. */
  'rp-echarpe-neuve': 'a brand new knitted football supporter scarf still folded flat '
    + 'in a crisp rectangle exactly as it came out of its packet, sharp unopened '
    + 'creases, the wool bright and stiff and completely unworn, bold horizontal '
    + 'stripes, fringed ends tucked underneath, no crest and no lettering on it',
  'rp-lunettes': 'a pair of cheap plastic sunglasses with dark lenses, the arms splayed '
    + 'open, one lens catching a hard highlight, the frames scratched and a little '
    + 'twisted from being sat on, no logo anywhere on them',
  'rp-gourde': 'a dented aluminium water bottle with a screw cap hanging from a short '
    + 'loop, condensation beading down the metal, a film of summer dust on its '
    + 'shoulder, the surface completely plain with no label and no text',
  'rp-ticket-mai': 'a single creased paper match ticket from the end of an old season, '
    + 'the card gone soft and furred along the folds, one corner torn away and the stub '
    + 'edge ragged, the printed surface completely blank with no writing on it',
  'rp-crampons': 'a pair of football boots caked in dried cracked mud, the studs clogged '
    + 'solid, the laces knotted and stiffened, one boot fallen on its side and leaning '
    + 'against the other, completely plain with no logo, no stripes and no lettering',
  'rp-casquette': 'a faded cotton baseball cap, empty and unworn, sitting upright and '
    + 'holding its own shape, the brim curved and sun-bleached, a dried salt line across '
    + 'the band. Nobody is wearing it, there is no head inside it, and there is no crest '
    + 'and no lettering on it',
  'rp-voix-rouillee': 'a small metal tin of throat lozenges lying open, a few wrapped '
    + 'amber lozenges spilling out beside it, the tin scratched and its lid resting '
    + 'against it, the tin completely blank with no label and no writing',
  'rp-maillot-passe': 'a football shirt from an old season, empty and unworn, folded '
    + 'loosely with one sleeve hanging down, the fabric slightly bobbled and thinned by '
    + 'washing. Nobody is wearing it, there is no body inside it, and the shirt is '
    + 'completely plain with no crest, no sponsor, no number and no lettering',
  'rp-veste': 'a light zip-up jacket, empty and unworn, half unzipped and slumped into '
    + 'its own shape with the collar standing up, cuffs worn thin. Nobody is wearing it, '
    + 'there is no body inside it, and there is no logo and no lettering on it',
  'rp-carnet-ete': 'a thick spiral-bound notebook swollen with use, its cover curled and '
    + 'marked by a coffee ring, a stretched elastic band holding it shut, the exposed '
    + 'page edges dense with illegible handwritten scribbles and no readable words',
  'rp-sifflet-sac': 'a small plastic whistle, dusty and scuffed, a tangle of frayed cord '
    + 'and a little lint caught around it, lying as if just dug out of the bottom of a '
    + 'bag, no writing on it',
  'rp-abonnement': 'a crisp new plastic season pass card with a punched hole at the top '
    + 'and a short lanyard clip, glossy and unmarked, the card surface completely blank '
    + 'with no writing, no photograph and no crest',
  'rp-tambour-detendu': 'a supporter drum with a visibly slack skin sagging in the '
    + 'middle, its rope tensioning gone loose and drooping in bights, one beater lying '
    + 'across the slack head, the wooden shell damp and dulled',
  'rp-bombe': 'a spray paint can with its cap off, the nozzle crusted with dried paint, '
    + 'runs of colour dried down one side of the can, the label completely blank with no '
    + 'text and no markings',
  'rp-radio': 'a small portable transistor radio, its telescopic aerial extended at an '
    + 'angle, a perforated speaker grille and two round dials, the plastic casing yellowed '
    + 'and scuffed, no writing and no numbers anywhere on it',
  'rp-creme': 'a squeezed plastic tube of sun cream, the body crumpled and rolled up from '
    + 'the bottom, the cap off and a bead of white cream at the nozzle, the tube '
    + 'completely blank with no label and no text',
  'rp-programme': 'a stapled paper season programme booklet, held half open and bent back '
    + 'on itself, the pages soft and thumbed at the corners, the cover and the pages '
    + 'completely blank with nothing printed on them',
  'rp-premiere-journee': 'a single pristine match ticket on thick card with a gilded edge '
    + 'and an unbroken perforated stub, standing upright and catching a warm highlight, '
    + 'the surface completely blank with no writing on it',
  'rp-drapeau-grenier': 'an enormous old supporter flag on a heavy wooden pole, the cloth '
    + 'furled tight around the shaft with cobwebs caught in the folds and a grey film of '
    + 'attic dust over everything, one corner falling open, the fabric completely plain '
    + 'with no emblem and nothing written on it',
  'rp-corde-neuve': 'a coil of brand new thick rope, bright unfrayed fibres, the coil '
    + 'bound at one point with a neat whipping, the cut end heat-sealed, stiff and '
    + 'springy and holding its loops',
  /* Les douze des trois époques. */
  'hw-bougie': 'a carved Halloween pumpkin with a short lit candle glowing inside, a friendly jagged grin, orange rind with a curly brown stalk',
  'hw-cape': 'a folded black vampire cape with a tall stiff collar and a deep red satin lining, a silver clasp at the neck',
  'hw-grimoire': 'an old leather-bound spell book, half open, thick yellowed pages, a ribbon bookmark, metal corner guards, faint violet glow rising from the pages, no readable writing',
  'hw-lanterne': 'an ornate antique iron lantern with a pointed top and a ring handle, glowing with an eerie orange and violet flame inside, cobweb on one corner',
  'ph-os': 'a pair of large knobbly animal bones used as drumsticks, bound together with a leather cord, pale ivory with dark wear marks',
  'ph-peau': 'a thick folded fur pelt with a striped brown and grey coat, rough leather edges, a bone toggle fastening',
  'ph-silex': 'a sharp knapped flint blade with a glassy dark grey surface and precise flaked facets, bound to a short wooden handle with sinew',
  'ph-mammouth': 'a huge curved mammoth tusk carved into a signal horn, a mouthpiece at the narrow end, carved spiral grooves, leather straps wrapped around it',
  'ap-bidon': 'a dented metal water canteen with a screw cap on a short chain, scratched olive paint, patched with tape',
  'ap-cle': 'a heavy rusty adjustable wrench, worn grip wrapped in old tape, oil stains, scratched steel jaw',
  'ap-compteur': 'a battered handheld Geiger counter with a round analogue dial, a coiled cable to a probe wand, yellow casing with chipped paint, no readable text',
  'ap-drapeau': 'a torn and many-times-patched supporter flag knotted to a bent metal pole, faded stripes, singed edges, no text and no crest',
  /* -------------------------------------- les cinq séries neuves, cinquante et une

     Les deux pièges valent toujours : un vêtement, un coussin ou un fauteuil
     se retrouvent occupés si l'on ne dit pas deux fois qu'ils sont vides, et
     tout ce qui a une surface reçoit un écusson ou un texte inventé si l'on
     n'écrit pas qu'il n'y a rien dessus. Un écran (téléphone, tablette,
     grand écran) s'allume sur des chiffres : il est demandé éteint. Aucun
     objet n'est vert : le fond de studio les détoure tous. */
  'vp-flute': 'a single tall crystal champagne flute half full of pale golden bubbling '
    + 'champagne, a fine stream of bubbles rising, a faint lipstick smudge on the rim',
  'vp-badge': 'a glossy VIP access badge on a wide satin lanyard coiled beside it, gold '
    + 'foil edges and a clear plastic sleeve, the card surface completely blank with no '
    + 'text, no photograph and no logo',
  'vp-coussin': 'a plump velvet seat cushion with gold piping and a tassel at each corner, '
    + 'deep burgundy, slightly dented in the middle, empty, nobody sitting on it, no '
    + 'crest and no lettering',
  'vp-telephone': 'a modern smartphone clipped onto a short extended selfie stick, the '
    + 'screen switched off and dark, a cracked corner on the case, no logo and no text',
  'vp-jumelles-opera': 'a small pair of antique opera glasses with mother-of-pearl barrels, '
    + 'gilded brass fittings and a folding lorgnette handle',
  'vp-plaid': 'a soft folded cashmere blanket in camel and cream with a neat fringe, '
    + 'luxuriously thick, folded into a square, no crest and no lettering',
  'vp-carte-or': 'a single heavy metal membership card in polished gold with a subtle '
    + 'brushed texture and a small embedded chip, standing at an angle and catching a '
    + 'warm highlight, the surface completely blank with no writing and no numbers',
  'vp-montre': 'an elegant luxury wristwatch with a polished steel case, a leather strap '
    + 'curved as if around an invisible wrist, a plain dial with simple baton markers '
    + 'and no numbers, no brand name and no text',
  'vp-cigare': 'a single fat cigar resting on a heavy crystal ashtray, a thin curl of '
    + 'smoke rising from the lit end, a plain gold band around it with no writing',
  'vp-cles-loge': 'a heavy ornate antique key ring holding three large brass keys, a '
    + 'velvet tassel and a polished metal tag, all of it gleaming, the tag completely '
    + 'blank with no engraving and no lettering',

  'gc-frites': 'a paper cone overflowing with golden french fries, a dollop of mayonnaise '
    + 'on top and a small wooden fork stuck in, grease spots on the paper, no logo and '
    + 'no text on the paper',
  'gc-gobelet': 'a reusable hard plastic stadium beer cup, slightly dented and scuffed, a '
    + 'last finger of beer and foam at the bottom, the cup completely plain with no '
    + 'logo and no text',
  'gc-moutarde': 'a squat glass jar of strong yellow mustard with its metal lid tilted '
    + 'open, a small wooden spoon standing in it, no label and no text',
  'gc-saucisse': 'a grilled sausage in a split bread roll, char lines on the sausage, a '
    + 'stripe of ketchup and mustard, wrapped halfway in a paper napkin with no writing',
  'gc-biere-tiede': 'a flimsy plastic cup of flat lukewarm beer with almost no foam, '
    + 'slightly squeezed out of shape, a drip running down the side, no logo and no text',
  'gc-sandwich': 'a triangle sandwich half out of its torn plastic packaging, white bread, '
    + 'a limp slice of ham and lettuce, the packaging completely blank with no label',
  'gc-plateau': 'a battered cardboard carrying tray holding four plastic cups of beer, '
    + 'one tilting dangerously, foam spilling over the rims, no text on anything',
  'gc-piment': 'a small squeeze bottle of bright red homemade chilli sauce with a pointed '
    + 'nozzle, a red drip on the side, a fresh chilli pepper lying beside it, no label '
    + 'and no text',
  'gc-chocolat': 'a steaming paper cup of hot chocolate with a cardboard sleeve, a swirl '
    + 'of whipped cream on top, the cup and sleeve completely plain with no logo and no '
    + 'text',
  'gc-recette': 'a battered old recipe tin box with its lid propped open, a few stained '
    + 'handwritten recipe cards standing inside with illegible scribbles and no readable '
    + 'words, a wooden spoon resting across it, a warm glow from inside',

  'gd-billet-train': 'a single paper train ticket with a punched clipped corner and a '
    + 'magnetic stripe on the back, creased from a pocket, the printed surface completely '
    + 'blank with no writing and no numbers',
  'gd-coussin-nuque': 'a U-shaped inflatable travel neck pillow, slightly deflated, with a '
    + 'little dangling valve, soft fleece cover, empty and unworn, no logo and no text',
  'gd-carte-routiere': 'a large paper road map folded badly into a bulging lump, edges torn '
    + 'at the folds, coloured roads and blank areas visible, no readable place names and '
    + 'no text',
  'gd-sac-couchage': 'a rolled-up sleeping bag bound with two elastic straps, a quilted '
    + 'nylon shell, one end coming loose, no logo and no text',
  'gd-glaciere': 'a rugged plastic picnic cool box with its lid cracked open, ice cubes '
    + 'and a few plain cans inside, a fold-down handle, scuffed sides, no label and no text',
  'gd-gilet': 'a bright orange high-visibility safety vest with silver reflective stripes, '
    + 'empty and unworn, lying flat and slightly crumpled. Nobody is wearing it, there is '
    + 'no body inside it, and there is no logo and no lettering on it',
  'gd-batterie': 'a chunky portable power bank with a short charging cable plugged in and '
    + 'coiled beside it, four small indicator lights glowing on its side, scratched '
    + 'casing, no logo and no text',
  'gd-valise': 'a small hard-shell wheeled suitcase tilted on its one remaining wheel, the '
    + 'other wheel missing, the telescopic handle half extended, covered in old travel '
    + 'stickers that are blank with no writing on them',
  'gd-gps': 'a small dashboard satellite navigation unit on a suction-cup mount, its screen '
    + 'showing only a simple coloured map with a looping route line and no text and no '
    + 'numbers, the cable dangling',
  'gd-car': 'a small toy-like model of an old coach bus, chunky and slightly battered, '
    + 'scarves hanging out of the windows, one headlight cracked, completely plain sides '
    + 'with no logo, no text and no crest',

  'mt-poncho': 'a transparent plastic rain poncho, empty and unworn, crumpled into a '
    + 'loose heap with its hood flopped over, raindrops beading on it. Nobody is wearing '
    + 'it, there is no body inside it, and there is no logo and no text',
  'mt-parapluie': 'a cheap umbrella blown inside out, two of its spokes bent and one '
    + 'panel torn, the curved handle at the bottom, plain fabric with no logo and no text',
  'mt-chaufferette': 'a pair of small fabric hand warmer pouches, one torn open and '
    + 'glowing faintly orange from the inside, a soft wisp of heat rising, no text',
  'mt-bottes': 'a pair of tall rubber rain boots, splashed with mud and standing in a small '
    + 'puddle, one leaning against the other, completely plain with no logo and no text',
  'mt-girouette': 'an old cast-iron rooftop weather vane with a rooster on top and the four '
    + 'compass arms below, flecks of rust, the arms plain with no letters on them',
  'mt-eventail': 'a folding paper hand fan spread wide open, thin bamboo ribs, the paper '
    + 'slightly torn at one edge, a plain warm colour with no writing and no pattern',
  'mt-paratonnerre': 'a small pointed copper lightning rod mounted on a short stand, tiny '
    + 'blue electric sparks crackling around its tip, a coil of copper wire at its base',
  'mt-barometre': 'an antique round aneroid barometer in a carved wooden case, a brass '
    + 'bezel and a single needle, the dial plain with simple tick marks and no numbers '
    + 'and no words',
  'mt-grelons': 'a dented metal bucket filled to the brim with big white hailstones, a few '
    + 'hailstones scattered around it and melting into small drops',
  'mt-manche-a-air': 'a striped windsock on a short metal pole, the fabric cone fully '
    + 'inflated and streaming sideways as if in a strong gust, bold stripes in two plain '
    + 'colours, no lettering',

  'hc-telecommande': 'a chunky television remote control, its rubber buttons worn shiny, '
    + 'the battery cover held on with a strip of tape, the buttons completely blank with '
    + 'no symbols, no numbers and no text',
  'hc-chips': 'an open crinkled bag of potato chips with a few chips spilling out beside '
    + 'it, the bag completely blank with no label, no logo and no text',
  'hc-pantoufles': 'a pair of fluffy slippers with a thick sole, slightly flattened at the '
    + 'heel, empty and unworn, nobody wearing them, no crest and no lettering on them',
  'hc-casque': 'a pair of large over-ear headphones with padded cushions, the coiled cable '
    + 'hanging down, slightly worn headband, no logo and no text',
  'hc-tablette': 'a tablet computer propped up on its folding cover stand, the screen '
    + 'switched off and dark with a reflection on it, a few crumbs on the cover, no logo '
    + 'and no text',
  'hc-canette': 'a single aluminium drinks can freshly opened, a burst of foam spilling '
    + 'over the ring pull, condensation on the metal, the can completely plain with no '
    + 'label and no text',
  'hc-fauteuil': 'a big worn leather recliner armchair tilted back with its footrest '
    + 'raised, a cup holder in the armrest, the seat deeply dented, empty, nobody sitting '
    + 'in it, no logo',
  'hc-ecran': 'a large flat-screen television on a small stand, the screen switched off and '
    + 'dark with a soft reflection, a thin layer of dust on the top edge, no logo and no '
    + 'text',
  'hc-pizza': 'an open cardboard pizza box with one slice missing from the pizza inside, '
    + 'stretchy melted cheese, a grease stain on the lid, the box completely blank with no '
    + 'logo and no text',
  'hc-canape': 'a deep old three-seat sofa with sagging cushions and a knitted throw '
    + 'draped over one arm, a remote control wedged between two cushions, empty, nobody '
    + 'sitting on it, no crest and no lettering',

  'boite-souvenirs': 'an old wooden keepsake box with its lid open, crammed with small '
    + 'supporter treasures: a folded striped scarf, a few blank match tickets, a small '
    + 'pennant, a whistle and a badge, everything plain with no text, no crest and no '
    + 'numbers, a warm glow rising from inside',
};

export const inviteDe = (id) => (INVITES[id]
  ? `Subject: ${INVITES[id]}.\n\n${STYLE}` : null);

/* ------------------------------------------------------------- le détourage */

/* Le détourage sur fond uni vit dans `detourage.mjs` : les emblèmes de
   `logo-images.mjs` en ont eu besoin, et le recopier aurait donné deux
   versions du même algorithme — un seuil ajusté d'un côté, pas de l'autre,
   et deux familles d'icônes qui ne se détourent plus pareil. Ce dépôt a déjà
   payé cette faute sur une liste de fichiers SQL. */

/* ------------------------------------------------------------- l'exécution */

if (process.argv.includes('--invites')) {
  for (const f of FAMILLES) {
    for (const s of f.pieces) {
      console.log(`\n=== ${s.id} — ${s.nom}${s.rar ? ` (${s.rar})` : ''}`
        + `\n${inviteDe(s.id) ?? '(aucune invite)'}`);
    }
  }
  process.exit(0);
}

const sharp = (await import('sharp')).default;

let faits = 0;
const manquantes = [];
const suspectes = [];
const orphelins = [];

for (const FAMILLE of FAMILLES) {
  const { source: SOURCE, cible: CIBLE } = FAMILLE;
  if (FAMILLE.facultative && !existsSync(SOURCE)) continue;
  await mkdir(CIBLE, { recursive: true });

  if (!existsSync(SOURCE)) {
    console.error(`\n  ${SOURCE} n'existe pas.\n\n`
      + '  Les dessins produits par Artlist se déposent là, un fichier par pièce,\n'
      + `  nommé de son identifiant : art/${FAMILLE.nom}/<identifiant>.png\n\n`
      + '  Les invites : node scripts/stuff-images.mjs --invites\n');
    process.exit(1);
  }

  const sources = (await readdir(SOURCE)).filter((f) => /\.(png|jpe?g|webp)$/i.test(f));
  const connus = new Set(FAMILLE.pieces.map((s) => s.id));
  orphelins.push(...sources.map((f) => f.replace(/\.[^.]+$/, '')).filter((n) => !connus.has(n)));

  for (const s of FAMILLE.pieces) {
  const src = sources.find((f) => f.replace(/\.[^.]+$/, '') === s.id);
  if (!src) { manquantes.push(s.id); continue; }

  /* `trous` : le vert enfermé dans un objet est du fond — voir `detourer`. */
  const { png, part } = await enIcone(sharp, path.join(SOURCE, src), COTE, s.id,
    { trous: true });
  if (partSuspecte(part)) suspectes.push(`${s.id} (${Math.round(part * 100)} % de fond)`);
  await ecrireLesTrois(sharp, png, CIBLE, s.id);
  faits++;
  process.stdout.write(`\r  ${faits} pièce(s) rangée(s)`);
  }
}

console.log(`\n${faits} pièce(s) détourée(s) en trois formats dans public/img.`);
if (manquantes.length) console.log(`Sans dessin : ${manquantes.join(', ')}`);
if (suspectes.length) {
  console.log(`\nDétourage douteux — à regarder : ${suspectes.join(', ')}`);
  console.log('Le fond du dessin est-il bien plat et uniforme ?');
}
if (orphelins.length) {
  console.log(`\nFichiers qui ne correspondent à aucune pièce : ${orphelins.join(', ')}`);
  console.log('Vérifie leur nom : il doit être exactement l’identifiant de la pièce.');
}

/* La liste sert au classeur d'équipement, qui n'existe que pour `stuff`. */
await writeFile(path.join(FAMILLES[0].cible, 'liste.json'),
  `${JSON.stringify(STUFF.filter((s) => !manquantes.includes(s.id)).map((s) => s.id))}\n`);
