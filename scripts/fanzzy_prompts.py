#!/usr/bin/env python3
"""
Générateur de prompts Fanzzy — v3.

Ce que la v2 faisait : répartir nature, garde-robe et mise en scène sans
collision dans une série. Ce qu'elle ne savait pas faire, et qu'il a bien fallu
lui apprendre le jour où la série a doublé de taille :

  **Dire ce qu'un personnage EST.** La v2 tirait la nature dans un sac —
  `NATURE_ANIMAL`, `NATURE_OBJET` — ce qui est juste quand on invente une série
  de zéro et qu'on cherche des idées. Mais les personnages existent déjà au
  catalogue, et l'Étourneau Perché EST un étourneau : lui tirer « a badger »
  produirait un blaireau nommé Étourneau. Un `sujet` posé sur le personnage
  l'emporte donc sur le sac, et le sac reste pour ce qui n'en déclare pas.

  **Ne pas déshabiller ce qui est déjà dessiné.** `repartir` alloue en parcourant
  `sorted(ids)` et en prenant le premier créneau libre. Ajouter des
  identifiants change donc ce que reçoivent les anciens — et comme le tri est
  alphabétique, `RP18` se glisse entre `RP17` et `RP2`. Dix-sept lignées déjà
  produites auraient changé de veste sans que personne ne le demande. Les
  **ancres** sont servies d'abord, dans leur ordre d'origine : leur tirage est
  exactement celui du jour où on les a dessinées, quoi qu'on ajoute après.

  **Les trois âges.** Une lignée n'est pas un personnage mais trois — le commun,
  le rare, l'épique — et chacun a son nom et son histoire. La v2 n'en portait
  qu'un et le prompt de l'épique annonçait le nom du commun.

Un personnage est donc : une identité qui ne bouge jamais, un sujet qui dit ce
qu'il est, trois âges qui disent ce qu'il devient, et un triplet
(nature, skin, rareté) posé par-dessus.

## Où vivent les personnages

Le catalogue fait foi : `src/shared/fanzzy/dex-saison.js`. Ce fichier-ci n'en
est que la traduction pour le modèle d'image — les noms y sont en anglais parce
que le modèle lit l'anglais, et les histoires y sont resserrées à une ligne
parce qu'un prompt n'est pas une fiche.

Quand les deux divergent, c'est le catalogue qui a raison.
"""

import argparse
import hashlib

# ═══════════════════════════════════════════════ AXES D'IDENTITÉ (stables)

""" **Cinquante par sac, et pourquoi ce nombre-là.**

L'arithmétique en demandait quarante : trente-cinq identifiants dans une série,
plus la marge d'une saison. Cinquante est donc un choix, pas un calcul — celui
de pouvoir écrire trois saisons de plus sans revenir ici, et surtout celui de ne
jamais poser la question « est-ce qu'il en reste ? » au moment d'ajouter un
personnage.

Le vrai risque à cette taille n'est plus la collision, c'est la **fausse
variété** : cinquante entrées dont dix disent la même chose en d'autres mots ne
valent pas mieux que quarante. Chaque ajout doit donc se distinguer d'un coup
d'œil des quarante-neuf autres — pas par un adjectif, par une silhouette. """

MORPHO = [
    "short and square-built, low centre of gravity",
    "very tall and narrow, all elbows and knees",
    "heavy-set and barrel-chested",
    "small and wiry, coiled like a spring",
    "broad-shouldered and thick-necked",
    "long-limbed and slightly stooped",
    "round-bellied and soft-shouldered",
    "compact and athletic, upright",
    "gangly with disproportionately large hands",
    "stocky with a short neck and sloping shoulders",
    "reed-thin with a pronounced collarbone",
    "powerfully built through the legs, light on top",
    "pear-shaped and low-slung",
    "hunched and rounded, as if permanently cold",
    "wide and immovable, like a bollard",
    "lithe and quick, weight always forward",
    "top-heavy, all shoulders and no hips",
    "squat and wide-footed, planted like a tripod",
    "elongated and slightly curved, as if leaning into wind",
    "small-headed on a thick heavy frame",
    "rangy and loose-jointed, everything hanging a little",
    "thick through the middle with thin arms and thin legs",
    "short-legged and long-backed, sitting height of a tall person",
    "one shoulder carried noticeably higher than the other",
    "deep-chested and narrow-hipped, like a swimmer gone soft",
    "very small overall, a head shorter than everyone around",
    "enormous and slow, taking up two people's width",
    "flat and plank-like, no depth from the side",
    "bow-legged, with a rolling sailor's stance",
    "knock-kneed and slightly pigeon-toed",
    "all forearm and wrist, the upper arms slight",
    "thick-ankled and heavy-footed, light above the waist",
    "concave-chested, shoulders rolled forward",
    "square head on square shoulders, no taper anywhere",
    "long-necked and small-shouldered, head held well forward",
    "built like a door, flat and broad and the same all the way down",
    "wiry with a pot belly, the two not agreeing",
    "hugely broad across the back, narrow seen from the front",
    "short and round, with surprisingly delicate hands",
    "tall and collapsing, as if the spine had given up at the top",
    "muscular on one side only, from years of carrying",
    "tiny-waisted with heavy shoulders and heavy thighs",
    "coiled forward from the hips, never quite upright",
    "wide-jawed and thick-limbed, with no visible joints",
    "spindly above, immovable below, like a lamp post in a base",
    "rounded everywhere, no straight line on the whole body",
    "angular and flat-planed, as if cut from board",
    "stooped from the neck only, the rest straight",
    "compact and dense, heavier than the size suggests",
    "loose and rangy with a very long stride",
]

TETE = [
    "a ribbed beanie pulled low over the ears",
    "a flat tweed cap set straight",
    "a bucket hat with the brim turned down",
    "a bandana tied over the skull, knotted at the back",
    "a snapback cap worn backwards",
    "completely bald, scalp shaved and shining",
    "long hair tied in a high topknot",
    "a fur-lined trapper hat with the flaps down",
    "thick unruly curls and no hat",
    "a hood, and no hair visible at all",
    "a straw hat, absurd for the weather",
    "close-cropped grey hair, nothing on it",
    "a shaved head with one long braided tail at the nape",
    "a knitted balaclava rolled up into a hat",
    "two small buns pinned on top",
    "a side parting combed flat with water",
    "an enormous dyed mohawk, drooping slightly",
    "a wide sunhat with a floppy misshapen brim",
    "a leather aviator cap with goggles pushed up",
    "wild grey hair standing straight out at the sides",
    "a thin headband holding back a heavy fringe",
    "a clean-shaven head with a faded old scar across it",
    "a receding hairline with the rest worn long at the back",
    "a tight crop bleached to straw and growing out dark",
    "a heavy plait pulled forward over one shoulder",
    "a woollen bobble hat, the bobble half unravelled",
    "a thick head of hair flattened on one side from sleeping",
    "a shaved head with a single day's stubble showing the pattern",
    "a wide-brimmed felt hat, one side pinned up",
    "short dreadlocks gathered at the crown",
    "a centre parting and two curtains of hair",
    "a peaked cycling cap with the brim flipped up",
    "a tight bun with a pen pushed through it",
    "hair cropped to the skin with one initial shaved into the side",
    "a woollen headscarf knotted at the nape",
    "an enormous grey beard and almost no hair above",
    "a fringe cut brutally straight, clearly at home",
    "a trilby worn far back on the head",
    "a lopsided afro with a comb still in it",
    "two thin braids framing a shaved skull",
    "a paper hat folded from a match programme",
    "a widow's peak and severely combed-back hair",
    "a knitted headband over the ears, hair loose above",
    "hair in a net, as if just off a shift",
    "a bowl cut, grown two months past its best",
    "a bald crown with a ring of wild grey around it",
    "a fur hat far too warm for any weather here",
    "a high ponytail pulled painfully tight",
    "close waves with a razor part cut through them",
    "a single long grey ponytail and a bald crown",
]

""" **Ce qui se PORTE, séparé de ce qui POUSSE.**

`TETE` mélange des chapeaux et des cheveux, ce qui va très bien tant qu'on
dessine des humains. Le jour où un étourneau a tiré « two small buns pinned on
top », le défaut est devenu visible : un oiseau ne porte pas de chignon, un
siège pliant non plus, et le modèle fait alors n'importe quoi — soit il pose des
cheveux humains sur un bec, soit il humanise la tête entière.

`COIFFE` ne garde donc que ce qui se **pose** sur une tête, quelle que soit la
tête. Les humains continuent de piocher dans `TETE`, qui est plus riche et où
une coupe de cheveux dit quelque chose du personnage. """

COIFFE = [
    "a ribbed beanie pulled low over the ears",
    "a flat tweed cap set straight",
    "a bucket hat with the brim turned down",
    "a bandana tied over the skull, knotted at the back",
    "a snapback cap worn backwards",
    "a fur-lined trapper hat with the flaps down",
    "a hood pulled right up, nothing else visible",
    "a straw hat, absurd for the weather",
    "a knitted balaclava rolled up into a hat",
    "a leather aviator cap with goggles pushed up",
    "a flat cap two sizes too big, resting on the ears",
    "nothing on top at all",
    # Huit de plus : c'était le plus petit sac du fichier, et celui qu'on voit
    # le mieux — il est sur la tête de chaque carte.
    "a woollen bobble hat, the bobble half unravelled",
    "a plastic rain cap tied under the chin",
    "a wide-brimmed felt hat, one side pinned up",
    "a cycling cap with the peak flipped up",
    "a stiff canvas cap, salt-stained around the band",
    "a headscarf knotted at the back",
    "a paper hat folded from a match programme",
    "a pair of ear defenders clamped over the head",
    "a deerstalker with the flaps tied up on top",
    "a foam visor with no crown at all",
    "a woollen balaclava worn full, only the eyes out",
    "a peaked conductor's cap, the badge long gone",
    "a sun hat with a neck flap at the back",
    "a pom-pom ski hat in two clashing colours",
    "a hood over a cap, both pulled forward",
    "a tea towel folded and tucked, worn as a sun shield",
    "a hard hat with a sticker peeled half off",
    "a beret pulled down over one ear",
    "a fleece headband wide enough to cover the brows",
    "a fisherman's sou'wester, brim dripping",
    "a shower cap, entirely unexplained",
    "a bike helmet still buckled under the chin",
    "a bandana folded into a thin band across the brow",
    "a wool cap with the brim rolled up three times",
    "a paper party crown, crushed on one side",
    "a wide flat straw boater, ribbon frayed",
    "a knitted hat shaped like nothing in particular",
    "a canvas bush hat with the cord hanging loose",
    "a pair of goggles pushed up onto the forehead",
    "a nightcap, complete with a tassel",
    "a peaked cap worn sideways, badge over one ear",
    "a hood cinched so tight it makes a small round hole",
    "a towelling headband, sweat-marked",
    "a plastic crown from a birthday, gold worn through",
    "a cap with the peak completely flattened and folded",
    "a woollen snood pulled up over the head like a hood",
    "a peaked cap with a folded newspaper under it for rain",
    "a wool hat with the label still sewn on the front",
]

""" Genre et origine sont des axes d'identité comme les autres, et pour la même
raison : laissés à l'écriture au coup par coup, ils dérivent tous vers le même
défaut par défaut — homme, blanc, la quarantaine. Répartis, une série reflète
un vrai virage. Ils ne changent JAMAIS avec le skin ni avec la rareté. """

GENRE = [
    "a woman", "a man", "a woman", "a man", "a woman", "a man",
    "a woman", "a man", "a woman", "a man", "a woman", "a man",
]

ORIGINE = [
    "with warm deep brown skin and tightly coiled black hair",
    "with pale freckled skin and light red hair",
    "with olive Mediterranean skin and thick dark hair",
    "with deep black skin and short-cropped hair",
    "with light East Asian features and straight black hair",
    "with brown South Asian skin and wavy black hair",
    "with tanned weathered white skin and greying hair",
    "with golden-brown mixed-heritage skin and loose dark curls",
    "with fair Northern European skin and ash-blond hair",
    "with rich copper-brown skin and black hair worn in locs",
    "with pale olive skin and straight dark brown hair",
    "with dark brown skin and close-shaved hair",
    "with light brown Middle Eastern skin and heavy black hair",
    "with freckled sandy-brown skin and tight auburn curls",
    "with very dark skin and greying temples",
    "with sallow pale skin and jet-black straight hair",
    "with ruddy windburnt white skin and thinning fair hair",
    "with warm tan skin and dark hair shaved at the sides",
    "with light golden skin and black hair going silver at the front",
    "with deep umber skin and short twists",
    "with pale pink-toned skin and white-blond eyelashes",
    "with brown skin and a full salt-and-pepper beard",
    "with olive skin and heavy dark eyebrows",
    "with freckled brown skin and coppery tight curls",
    "with weathered brown skin and a long grey plait",
    "with light beige skin and mousy flyaway hair",
    "with dark skin and close-cut hair receding at the front",
    "with East Asian features and hair dyed a flat burgundy",
    "with pale skin, dark circles, and black hair to the jaw",
    "with rich brown skin and a shaved head",
    "with tanned olive skin and thick silver hair",
    "with South Asian features and a neat black beard",
    "with fair skin reddened at the cheeks and sandy stubble",
    "with deep brown skin and hair bleached brassy at the tips",
    "with pale skin and hair so dark it reads blue in the light",
    "with light brown skin and a heavy grey moustache",
    "with golden-brown skin and a loose halo of dark curls",
    "with very pale skin and thin ginger hair worn long",
    "with brown skin and hair shaved to a fine shadow",
    "with Mediterranean skin and close-cropped grey curls",
    "with dark skin and a short greying afro",
    "with sun-spotted white skin and no hair at all",
    "with light skin and heavy black hair cut blunt at the shoulder",
    "with warm brown skin and a single streak of white hair",
    "with pale freckled skin and hair in two thick red plaits",
    "with deep black skin and hair in tight cornrows",
    "with olive skin and a heavy five o'clock shadow",
    "with light tan skin and hair cropped to the bone",
    "with brown skin and a neatly tied grey topknot",
    "with fair skin, pink-rimmed eyes, and pale lashes",
]

""" **Le visage, qui n'était nulle part.**

Le prompt disait la carrure, le chapeau, la veste, la pièce de cou, la posture —
et pas un mot de ce que la figure **fait**. Deux cent quatre-vingt-onze
personnages avec la même expression par défaut, c'est-à-dire aucune : le modèle
en choisissait une, toujours la même, un visage neutre poliment tourné vers
l'objectif.

C'est l'axe qui rend deux cartes différentes le plus vite, et il coûtait zéro
pixel de plus. Il appartient à l'**identité** : il ne change ni avec le skin ni
avec la rareté, parce qu'un personnage a un visage et le garde.

Les objets et les créatures en ont un aussi — leur bloc d'anatomie leur donne
« ONE face with two eyes and one mouth ». Une saucisse peut donc regarder de
travers, et c'est très bien. """

EXPRESSION = [
    "mouth wide open mid-shout, eyes screwed shut",
    "jaw set hard, staring straight ahead without blinking",
    "eyebrows high and mouth open, caught by surprise",
    "one eyebrow raised, entirely unconvinced",
    "grinning with the head tipped back, delighted",
    "lips pressed thin, holding something back",
    "eyes narrowed against the light, mouth neutral",
    "shouting sideways at someone out of frame",
    "chin lifted, looking down the nose with disdain",
    "mouth open in a long low groan, hands nowhere near",
    "beaming, cheeks round, eyes nearly closed",
    "frowning hard, the whole brow pulled down",
    "whistling, lips pursed and cheeks drawn",
    "biting the lower lip, watching something go wrong",
    "eyes wide and unfocused, completely lost",
    "a slow sideways smirk, one corner only",
    "roaring with the neck tendons standing out",
    "eyes closed, face utterly calm in the middle of it all",
    "mouth open in disbelief, head turned slightly away",
    "snarling, upper lip lifted on one side",
    "squinting hard at something far off",
    "laughing so hard the eyes have disappeared",
    "lips moving, counting something under the breath",
    "eyebrows knitted, concentrating on a single point",
    "mouth open in a perfect round O of dismay",
    "cheeks puffed out, holding a breath",
    "head tilted, listening rather than looking",
    "a wide fixed smile that does not reach the eyes",
    "eyes rolled upward, patience long gone",
    "teeth bared in effort, not in anger",
    "blinking, caught halfway through it",
    "looking straight at the viewer, dead serious",
    "mouth open and singing, eyes on something above",
    "nose wrinkled, smelling something unwelcome",
    "one eye closed, aiming",
    "mouth clamped shut, nostrils flared",
    "eyes glistening, on the edge of tears, mouth steady",
    "yawning enormously, entirely unguarded",
    "smiling gently with the eyes only",
    "shouting with the head thrown fully back",
    "lips parted, about to say something and not saying it",
    "eyebrows up and mouth flat, politely appalled",
    "grimacing, the whole face folded",
    "serene, almost absent, looking through everything",
    "mouth pulled sideways, thinking it over",
    "eyes bright and fixed, absolutely certain",
    "cheeks red, out of breath, mouth open",
    "face crumpling, the exact moment before a cheer",
    "utterly deadpan, as if nothing is happening",
    "eyes half-closed and mouth open, singing badly and happily",
]

""" **Les mains, le bas du corps, les pieds** — les trois autres absences.

Le prompt s'arrêtait à la ceinture et aux poignets. Tout ce qui pendait en
dessous était laissé au modèle, qui met un jean et des baskets à tout le monde,
et deux mains vides le long du corps.

Ces trois-là sont de la **garde-robe** : ils changent avec le skin, comme la
veste. Les mains font exception — ce qu'on tient n'est pas un vêtement — mais
elles suivent la même règle, parce qu'une torche n'a rien à faire dans une main
préhistorique. """

MAINS = {
 'base': [
    "both hands jammed deep in the pockets",
    "one fist raised, the other hand flat on the chest",
    "gripping a rolled-up match programme like a baton",
    "both arms folded tight across the body",
    "one hand cupped around the mouth, the other on a railing",
    "holding a paper cup at chest height, very carefully",
    "both hands gripping an unseen barrier in front",
    "one hand on the hip, the other pointing off-frame",
    "clapping, hands caught apart mid-beat",
    "hands clasped together under the chin",
    "one thumb hooked in a belt loop, other arm loose",
    "carrying a folded plastic seat under one arm",
    "both hands up, palms out, denying everything",
    "one hand shading the eyes, the other on the hip",
    "clutching a half-eaten pie in both hands",
    "arms straight down, fists clenched hard",
    "one hand scratching the back of the neck",
    "holding a phone up at arm's length, screen away",
    "both hands buried in the front pocket of a hoodie",
    "one arm around the shoulders of somebody absent",
    "hands on both knees, leaning forward",
    "one finger raised, mid-correction",
    "holding a thermos flask in one hand, cup in the other",
    "both hands gripping a scarf held taut overhead",
    "one hand flat against the forehead, despairing",
    "wringing a cap between both hands",
    "arms spread wide, welcoming or exasperated",
    "one hand on the chest over the badge",
    "holding a wooden rattle, mid-swing",
    "both hands cupped around a lighter flame",
    "one hand deep in a bag of crisps",
    "fists up in a boxer's guard, badly held",
    "one hand held out flat, asking for calm",
    "gripping a flagpole with both hands, low down",
    "one hand waving broadly overhead",
    "both hands pressed flat over the ears",
    "holding a pair of binoculars, not using them",
    "one hand tugging at an earlobe, thinking",
    "arms crossed with a drink still in one hand",
    "both palms open at waist height, shrugging",
    "one hand gripping the opposite wrist behind the back",
    "holding a folded newspaper under one arm",
    "pointing straight at the viewer with both hands",
    "one hand steadying a hat against the wind",
    "hands on the hips, elbows wide",
    "holding a small dog that is not enjoying it",
    "one hand raised flat in a stiff salute",
    "gripping a length of rope, both fists",
    "one arm hanging, the other hand holding it at the elbow",
    "both hands open at the sides, completely still",
 ],
 'prehistorique': [
    "both hands gripping a knotted club",
    "one hand raised with a flat painted stone",
    "carrying a bundle of kindling under one arm",
    "both fists closed around bone rattles",
    "one hand trailing a length of braided sinew",
    "holding a hollow gourd at the hip",
    "arms folded, both forearms wrapped in hide",
    "one hand flat against a painted cave wall",
    "gripping a spear low, point downward",
    "both hands cupped around a smouldering ember",
    "one hand full of ochre, fingers stained red",
    "holding a hide drum against the body",
    "arms raised, both palms turned to the sky",
    "one hand clutching a fistful of feathers",
    "carrying a dead hare slung over the shoulder",
    "both hands working a cord between them",
    "one arm across the chest in a stiff greeting",
    "holding a sharpened flint up to the light",
    "hands buried in a fur wrap for warmth",
    "one hand gripping a horn, mouth nowhere near it",
    "both fists full of dry grass",
    "carrying a water skin by its neck",
    "one hand pressed flat over the heart",
    "holding a string of pierced shells at arm's length",
    "both arms out wide, balancing on nothing",
    "one hand dragging a hide behind",
    "gripping a bone whistle in one fist",
    "both hands pressed to the temples",
    "one hand extended, palm up, offering something small",
    "holding a burning brand well away from the body",
    "arms hanging with the hands loosely curled",
    "one hand hooked in a rope belt",
    "both hands around a heavy round stone",
    "carrying a bundle of pelts across both forearms",
    "one fist raised high, the arm locked straight",
    "holding a carved figure the size of a thumb",
    "both palms pressed together in front of the chest",
    "one hand tearing at a strip of dried meat",
    "gripping two stones, about to strike them",
    "arms crossed with the fists under the armpits",
    "one hand shielding a small flame from the wind",
    "holding a net gathered in a loose bundle",
    "both hands gripping a hide shield edge-on",
    "one hand deep in a pouch at the waist",
    "carrying a long bundle balanced on one shoulder",
    "both arms wrapped around the body against cold",
    "one hand held flat above the eyes, scanning",
    "gripping a woven basket by both handles",
    "one hand closed around a tooth on a cord",
    "both hands empty, fingers spread wide",
 ],
 'apocalyptique': [
    "both hands gripping a taped-up length of pipe",
    "one hand raised holding a cracked signal lamp",
    "carrying a jerry can, arm pulled straight by the weight",
    "both fists wrapped in torn rag",
    "one hand on a respirator hose at the chest",
    "holding a dented tin cup, very carefully",
    "arms folded over a bandolier of bottle caps",
    "one hand flat on a welded metal plate",
    "gripping a length of chain, both fists",
    "both hands cupped around a guttering flame",
    "one hand full of scavenged screws and washers",
    "holding a car battery against the hip",
    "arms raised, both palms turned outward, surrendering",
    "one hand clutching a fistful of wire",
    "carrying a bundle of salvaged cloth over the shoulder",
    "both hands working a hand-crank torch",
    "one arm across the chest, fist on the opposite shoulder",
    "holding a shard of mirror up to the light",
    "hands shoved into a coat made of seat covers",
    "one hand gripping a rusted horn",
    "both fists full of dry cabling",
    "carrying a water bottle strapped in tape",
    "one hand pressed flat over a patched-up wound",
    "holding a string of keys to nothing",
    "both arms out wide, balancing on a beam",
    "one hand dragging a sled of scrap behind",
    "gripping a whistle made from a spent cartridge",
    "both hands pressed to the sides of a helmet",
    "one hand extended, palm up, trading",
    "holding a flare well away from the body",
    "arms hanging, gloved fingers loosely curled",
    "one thumb hooked in a cargo strap",
    "both hands around a heavy wheel nut",
    "carrying rolled tarpaulin across both forearms",
    "one fist raised high, arm locked straight",
    "holding a photograph, edges worn to fur",
    "both palms pressed flat together, praying or pleading",
    "one hand tearing open a ration packet",
    "gripping two stones, about to strike a spark",
    "arms crossed with both fists under the armpits",
    "one hand shielding a lens from the dust",
    "holding a net of salvage gathered loose",
    "both hands gripping a road-sign shield edge-on",
    "one hand deep in a taped-up satchel",
    "carrying a long pipe balanced on one shoulder",
    "both arms wrapped around the body against the wind",
    "one hand held flat above goggles, scanning",
    "gripping a crate by both rope handles",
    "one hand closed around a dog tag on a cord",
    "both hands empty, gloved fingers spread wide",
 ],
}

PALETTES = [
    "mustard yellow and charcoal", "petrol blue and bone white",
    "forest green and rust", "plum purple and warm grey",
    "off-white and chocolate brown", "slate blue and pale sand",
    "burnt orange and deep teal", "black and silver-grey",
    "olive khaki and cream", "raspberry pink and stone",
    "ochre and midnight blue", "moss green and oxblood",
    "dusty lilac and graphite", "lime green and dark navy",
    "brick red and pale mint", "sunflower and espresso brown",
    "ice blue and gunmetal", "coral and seaweed green",
    "wheat gold and deep plum", "turquoise and warm sand",
    "cherry red and bone", "steel grey and mustard",
    "deep indigo and oatmeal", "burgundy and pale grey",
    "sage green and terracotta", "pale yellow and ink black",
    "copper and dusty blue", "aubergine and buttermilk",
    "hunter green and tobacco brown", "powder blue and chestnut",
    "flame orange and charcoal", "sea green and pale clay",
    "oxblood and stone grey", "canary yellow and slate",
    "chocolate and duck-egg blue", "petrol green and apricot",
    "warm grey and cherry", "denim blue and rust orange",
    "pistachio and deep brown", "maroon and sand",
    "teal and burnt umber", "cream and forest green",
    "dove grey and saffron", "navy and pale coral",
    "moss and pale gold", "brick and ice grey",
    "plum and olive", "black and bottle green",
    "tan and petrol blue",
    "rose beige and deep teal",
]

# ═══════════════════════════════════════════════════════════ NATURES

NATURE_ANIMAL = [
    "a capybara", "a pigeon", "a badger", "a stray tomcat", "a donkey",
    "a hen", "a bulldog", "a goat", "a heron", "a fox", "a raccoon",
    "a sheepdog", "a magpie", "a wild boar", "a ferret", "a duck",
    "a tortoise", "a seagull", "a hedgehog", "a pony",
]

NATURE_OBJET = [
    "a grilled sausage", "a paper coffee cup", "a folding stadium seat",
    "a half-eaten meat pie", "a rolled-up umbrella", "a traffic cone",
    "a thermos flask", "a dented metal barrier", "a bar of chocolate",
    "a stadium turnstile", "a bag of crisps", "a whistle",
    "a rain-soaked cardboard sign", "an old transistor radio",
    "a corner flag", "a stack of plastic cups", "a hot-water bottle",
    "a mud-caked boot", "a vending machine", "a wheelie bin",
]

NATURE_CREATURE = [
    "a small storm cloud", "a will-o'-the-wisp", "a stone gargoyle",
    "a tiny thundercloud with legs", "a sentient gust of wind",
    "a living bonfire", "a puddle that has learned to stand up",
    "a snowman in the wrong season", "a shadow that came unstuck",
    "a ball of tangled scarves with eyes", "a fog bank",
    "a sunbeam given a body", "an echo made visible",
    "a lump of stadium mud with a face",
]

""" **L'hybride est une nature à part, et il a fallu l'écrire.**

Un homme greffé à sa caisse claire n'est ni un humain ni un objet : les deux
blocs d'anatomie existants le rateraient. `humain` donnerait un batteur qui
tient un tambour — ce que le catalogue a déjà douze fois — et `objet` donnerait
un tambour à jambes, sans le visage ni la carrure qui font le personnage.

Le bloc dit donc la seule chose qui compte : le corps est humain, **une partie
nommée** est remplacée par la matière de l'objet, et la jointure se voit. C'est
la jointure qui fait l'hybride ; la cacher en ferait un déguisement. """

ANATOMIE = {
    'humain':
        "CRITICAL ANATOMY: exactly TWO arms ending in TWO hands, exactly two "
        "legs ending in two feet, one single head. NO THIRD ARM anywhere.",
    'animal':
        "CRITICAL ANATOMY: an anthropomorphic animal standing upright on TWO "
        "hind legs, with exactly TWO forelimbs used as arms and TWO hind legs "
        "used as legs, one single head, one single tail. Keep the animal's real "
        "head and face — do NOT give it a human face. NO extra limbs, NO third "
        "arm, NO second tail.",
    'objet':
        "CRITICAL ANATOMY: an anthropomorphic object — the object itself IS the "
        "body and the torso. It has exactly TWO simple cartoon arms and TWO "
        "simple cartoon legs attached directly to it, and ONE face set into its "
        "front surface with two eyes and one mouth. It has NO separate head and "
        "NO neck. NO extra limbs, NO third arm, NO second face.",
    'creature':
        "CRITICAL ANATOMY: a creature with no fixed skeleton. Its body is made "
        "of its own substance and has no bones. It has exactly TWO limbs acting "
        "as arms, formed from that same substance, and ONE face with two eyes "
        "and one mouth. It has NO legs and does not touch the ground — it hovers "
        "just above it. NO extra limbs, NO third arm, NO second face.",
    'hybride':
        "CRITICAL ANATOMY: a human body fused with an object. Exactly TWO arms "
        "ending in TWO hands, exactly two legs ending in two feet, one single "
        "human head with a human face. The named body part — and ONLY that part "
        "— is replaced by the object's own material, and the seam where flesh "
        "becomes object is clearly visible. The object is NOT held, NOT worn and "
        "NOT strapped on: it has grown into the body. NO extra limbs, NO third "
        "arm, NO second head.",
}

SURFACE = {
    'animal':  ["thick coarse fur", "sleek short fur", "shaggy matted fur",
                "smooth feathers", "ruffled scruffy feathers", "bristly hide",
                "a dense woolly coat", "a hard segmented shell"],
    'objet':   ["a glossy plastic surface", "a matte painted metal surface",
                "a greasy browned crust", "waxed cardboard softened at the folds",
                "brushed steel, dented and scratched", "cracked enamel paint",
                "crumpled foil", "porous scorched wood", "smooth cold ceramic",
                "sun-bleached rubber"],
    'creature':["dense grey vapour", "a rolling boil of dark cloud",
                "rough weathered stone", "flickering low flame",
                "trembling clear water", "packed wet snow",
                "coarse tangled wool", "soft drifting fog",
                "dry compacted earth", "shifting loose ash",
                # Ajoutées en v3 : la végétation et le tissu vivant n'avaient
                # aucune matière dans le sac, et une plante en « ash » n'est
                # pas une plante.
                "dense dark-green ivy leaves on woody stems",
                "heavy woven flag cloth, sun-faded"],
    'hybride': ["taut drum skin stretched over a wooden shell",
                "brushed steel and warm human skin, seamed together",
                "varnished wood grain running into bare forearm"],
}

# ═══════════════════════════════════════════════ GARDE-ROBE (par skin)

""" **Le bas du corps et les pieds, en un seul axe.**

Deux sacs séparés auraient produit des contradictions — un pantalon rentré dans
des bottes, tiré indépendamment de bottes qui n'existent pas. Une entrée dit
donc les jambes **et** les pieds ensemble, et le prompt n'a qu'une ligne de plus.

C'est le troisième trou du prompt : il s'arrêtait à la ceinture, et le modèle
mettait un jean et des baskets à tout le monde. """

BAS = {
 'base': [
    "heavy work trousers tucked into rubber boots",
    "tracksuit bottoms with the ankles pushed up over trainers",
    "faded jeans breaking over scuffed leather boots",
    "corduroy trousers a size too short, thick socks showing",
    "a pleated skirt over woollen tights and flat shoes",
    "waterproof overtrousers rustling above wellingtons",
    "shorts in entirely the wrong weather, bare shins, old trainers",
    "suit trousers with the crease long gone, over trodden-down loafers",
    "combat trousers with the side pockets full, over canvas boots",
    "jogging bottoms with one leg rolled to the knee, one sock down",
    "moleskin trousers held up by braces, over hobnailed boots",
    "a long wool skirt reaching the ankles, stout laced shoes",
    "cycling shorts under a pair of cut-off jeans, cleated shoes",
    "dungarees with one strap unfastened, bare feet",
    "thick cargo shorts and long football socks pulled to the knee",
    "chinos rolled twice at the cuff, no socks, deck shoes",
    "leggings under a denim skirt, high-top trainers",
    "wide-legged trousers flapping over sandals and socks",
    "tight jeans tucked into cowboy boots",
    "fleece-lined tracksuit bottoms over thick hiking boots",
    "a kilt, worn entirely seriously, with heavy brogues",
    "painter's whites covered in marks, over split plimsolls",
    "riding breeches and tall polished boots, absurd here",
    "baggy shorts to the knee and bare feet in flip-flops",
    "thermal leggings under shorts, football socks, studded boots",
    "trousers patched at both knees, over steel-toed boots",
    "a wrap skirt over bare legs and rope-soled espadrilles",
    "salopettes with the bib hanging down, snow boots",
    "jeans with one leg rolled for a bike chain, one trainer laced tight",
    "pinstriped trousers above bright white running shoes",
    "linen trousers creased beyond saving, leather sandals",
    "a tutu, worn over jeans, with muddy trainers",
    "tracksuit bottoms with the press-studs all undone down one side",
    "shorts and knee pads, over battered skate shoes",
    "trousers far too long, hems dragging under the heels",
    "a denim skirt over thick black tights and ankle boots",
    "waders folded down to the thigh",
    "school trousers grown out of, ankles bare, black shoes",
    "harem trousers gathered at the ankle, no shoes at all",
    "jeans cut off raggedly at mid-calf, work boots",
    "a pencil skirt and trainers carried in the hand — bare feet",
    "fisherman's trousers over thick wool socks and clogs",
    "combat shorts with a tool belt, over desert boots",
    "trousers tucked into odd socks, one striped, one plain",
    "a long coat hides the legs entirely; only boots show",
    "ski trousers with the lift pass still clipped on, moon boots",
    "wide canvas trousers rolled to the knee, bare wet feet",
    "leather trousers cracked across both knees, biker boots",
    "pyjama bottoms, unapologetically, in slippers",
    "plain dark trousers and plain dark shoes, nothing to say",
 ],
 'prehistorique': [
    "a hide wrap to the knee, feet bound in fur and cord",
    "bare legs, mud to mid-calf, feet bare",
    "leggings of stitched pelt, laced shut down the outside",
    "a short grass skirt, bare feet, toes splayed",
    "hide trousers gathered at the ankle with sinew",
    "one leg wrapped in fur, the other bare",
    "a loincloth of soft skin, bare legs, bark-soled sandals",
    "shaggy leggings reaching the hip, feet in hide boots",
    "bare legs painted with ochre bands, feet bare",
    "a wrap of woven reed at the waist, bare shins, rope sandals",
    "thick fur boots to the knee, legs unseen above",
    "hide breeches tied at both knees, feet bound in cloth",
    "bare legs with cord wound from ankle to knee, bare feet",
    "a pelt kilt heavy with mud, feet in stitched moccasins",
    "leggings of two mismatched hides, one dark one pale",
    "bare legs, both knees scabbed, feet in worn hide",
    "a skirt of hanging leather strips, feet bare",
    "trousers of stitched fish skin, bare feet",
    "one boot of bear fur, the other foot bare",
    "hide wrappings from hip to toe, seamless",
    "a woven bark apron front and back, bare legs",
    "leggings of soft doeskin, feet in beaded slippers",
    "bare legs, ankles ringed with cord and small bones",
    "a heavy fur wrap dragging at the heels, feet hidden",
    "short hide breeches, shins bound in birch bark",
    "bare legs caked to the thigh in white clay, bare feet",
    "leggings laced with bone toggles, feet in braided grass",
    "a single long hide wound from waist to ankle",
    "bare legs, one ankle in a woven anklet, bare feet",
    "fur-lined boots with the tops folded over",
    "a kilt of overlapping scales of hide, bare shins",
    "leggings worn through at both knees, patched with fur",
    "bare legs streaked with soot, feet in rough sandals",
    "a wrap of matted wool at the hips, boots of stiff hide",
    "hide trousers with the fur turned inward, feet bare",
    "bare legs, both calves heavily tattooed, bare feet",
    "a short skirt of knotted cord, feet bound in moss",
    "leggings of woven nettle fibre, bark sandals",
    "one leg in hide, one leg in plaited grass",
    "bare legs, feet in boots stuffed with dried grass",
    "a heavy pelt hanging to the shin, feet unseen",
    "trousers of supple hide, belted with a rope of gut",
    "bare legs, knees wrapped in leaves and cord",
    "leggings of stiff cured leather, creaking at the knee",
    "a wrap of feathers at the hips, bare legs, bare feet",
    "hide boots to mid-thigh, laced the whole way",
    "bare legs, shins whitened with ash, bare feet",
    "a kilt of shell-weighted cords, feet in hide slippers",
    "leggings patched with six different animals",
    "bare legs, bare feet, nothing at all below the waist wrap",
 ],
 'apocalyptique': [
    "cargo trousers taped at the ankle, over welded-plate boots",
    "salvaged overalls cut off at the knee, bare shins, tyre sandals",
    "leggings of stitched inner tube, heavy lace-up boots",
    "trousers armoured down the shins with cut tin",
    "a wrap skirt of tarpaulin, bare legs, rope-bound feet",
    "jeans bleached white by sun, over mismatched boots",
    "padded trousers stuffed with rags, feet in taped-up trainers",
    "shorts and knee armour of moulded plastic, desert boots",
    "trousers patched from six fabrics, over steel-toed boots",
    "one leg in leather, one in canvas, boots to match neither",
    "waders cut down at the thigh, over bare feet",
    "combat trousers with the pockets emptied and hanging open",
    "leggings under a skirt of road-sign metal, laced boots",
    "trousers wrapped in gaffer tape from knee to ankle",
    "bare legs with plastic shin guards strapped on, sandals",
    "overalls with one leg torn away entirely",
    "trousers of stitched seat covers, boots of the same",
    "shorts over thermal leggings, feet in split wellingtons",
    "heavy trousers with a tool roll strapped to one thigh",
    "a long coat over nothing visible but two mud-caked boots",
    "trousers cinched with bungee cord, feet in odd boots",
    "leggings of chain-linked caps, bare feet beneath",
    "salvaged uniform trousers, all insignia unpicked",
    "shorts and bare shins, feet wrapped in layered plastic",
    "trousers reinforced at the seat with a rubber patch",
    "one boot armoured, the other plain and much older",
    "leggings under cut-down waders, feet bare inside",
    "trousers of parachute silk, gathered and tied at the ankle",
    "bare legs painted with warning stripes, heavy boots",
    "a kilt cut from a fire blanket, boots taped shut",
    "trousers with a spare tube coiled around one calf",
    "shorts, long socks of unravelling wool, worn-through trainers",
    "leggings and a belt of pouches, feet in strapped sandals",
    "trousers scorched black up one leg, boots intact",
    "bare legs, both knees bound in rag, no shoes at all",
    "overalls rolled to the knee, feet in wooden-soled clogs",
    "trousers of stitched tyre rubber, absolutely rigid",
    "shorts over patched thermals, boots two sizes too large",
    "leggings with a length of chain wound round one thigh",
    "trousers with the hems weighted against the wind",
    "one leg tucked into a boot, the other hanging loose",
    "a skirt of hanging metal strips, bare legs, bound feet",
    "trousers of canvas and wire, feet in tread-cut sandals",
    "bare shins under a coat of cans, boots of moulded scrap",
    "leggings soaked dark to the knee, boots leaking",
    "trousers with a filter pack strapped to the calf",
    "shorts, shin pads of folded sheet metal, laced boots",
    "trousers held together almost entirely by staples",
    "one leg in a full plate greave, the other in a sock",
    "plain salvaged trousers and plain salvaged boots, both grey",
 ],
}

VESTES = {
 'base': [
    "an oversized olive-green military parka, several sizes too big",
    "a cropped black leather bomber jacket, cracked at the elbows",
    "a heavy navy fisherman's smock with a single chest pocket",
    "a shiny shell tracksuit top, zipped to the chin",
    "a faded denim jacket with a sheepskin collar",
    "a long grey wool overcoat, buttoned high",
    "a hi-vis workwear jacket, scuffed grey at the cuffs",
    "a boxy checked flannel overshirt worn open",
    "a thin transparent plastic rain poncho over everything",
    "a quilted sleeveless bodywarmer over bare arms",
    "a chunky cable-knit jumper with no jacket at all",
    "a pinstriped suit jacket worn over a football shirt",
    "a camouflage fleece with a torn shoulder seam",
    "a velour tracksuit, zipped halfway",
    "a mechanic's zipped boiler suit, sleeves rolled",
    "a fleece gilet over a long-sleeved rugby shirt",
    "a duffel coat with wooden toggles, two missing",
    "a nylon windbreaker that rustles audibly",
    "a hand-me-down blazer two sizes too small",
    "a hooded sweatshirt worn under a denim waistcoat",
    "a cardigan buttoned wrong by one hole",
    "a waxed cotton hunting jacket, pockets bulging",
    "a satin bomber with a huge embroidered back",
    "a knitted tank top over a long-sleeved shirt",
    "a sheepskin coat with the fleece showing at the cuffs",
    "a puffer jacket losing feathers from one shoulder",
    "a shirt worn open over a vest, sleeves rolled high",
    "a donkey jacket with the plastic shoulder patch cracked",
    "a track jacket with three stripes down each arm",
    "a poncho of loud crocheted squares",
    "a suit waistcoat and no jacket at all",
    "a sailing smock, salt-stiff and shapeless",
    "a leather waistcoat over bare shoulders",
    "an anorak with the hood permanently half inflated",
    "a lab coat, worn entirely out of context",
    "a bomber jacket two decades old and cared for",
    "a dressing gown, belted, absolutely deliberate",
    "a gilet over a roll-neck, both too small",
    "a bib overall over a striped jersey",
    "a linen shirt untucked and billowing",
    "a fleece with the zip broken at the base",
    "a boxy tweed jacket with leather elbow patches",
    "a raincoat carried open like wings",
    "a hooded top worn backwards, hood on the chest",
    "a cardigan long enough to reach the thighs",
    "a motorcycle jacket with one sleeve scuffed white",
    "a chef's whites, buttoned to the throat",
    "a poncho of clear plastic over a thick jumper",
    "a bodywarmer stuffed until it barely closes",
    "a shirt jacket worn open with all the buttons missing",
 ],
 'prehistorique': [
    "a single rough hide slung over one shoulder and belted",
    "a shaggy fur mantle covering both shoulders",
    "a sleeveless tunic of stitched pelts",
    "a wrap of coarse woven grass fibre",
    "a cape of overlapping bark strips",
    "a short kilt of knotted leather strips",
    "a mammoth-wool poncho, matted and heavy",
    "a harness of braided sinew across the bare chest",
    "a hide wrap bound with bone toggles",
    "a cloak of feathers lashed to a leather yoke",
    "a vest of woven reeds, stiff and creaking",
    "a pelt tied at the waist, chest bare",
 ],
 'apocalyptique': [
    "a patched jacket sewn from mismatched salvaged fabric",
    "a coat armoured with cut and flattened tin cans",
    "a hooded top under a harness of frayed cargo straps",
    "a tarpaulin smock, taped at every seam",
    "a flak vest stuffed with rags and bound with wire",
    "a long coat of stitched tyre rubber",
    "a jumpsuit bleached colourless by the sun",
    "a poncho cut from a road sign, edges filed smooth",
    "a jacket wrapped in layers of gaffer tape",
    "a mail shirt of bottle caps threaded on wire",
    "a stitched patchwork of old seat covers",
    "a fireproof smock, scorched black down one side",
 ],
}

COUCHE_EPIQUE = {
 'base': [
    "a long heavy wool greatcoat below the knee, flung open",
    "a full club flag worn as a cape, knotted at the throat",
    "a battered tarpaulin sheet worn as a hooded mantle",
    "a floor-length oilskin raincoat, stiff and gleaming",
    "a vast crocheted blanket-poncho in mismatched squares",
    "an enormous fur-collared stadium coat, collar up to the ears",
    "a leather trench coat, belt hanging loose",
    "a bright shell cagoule inflated by the wind, hood up",
    "a patchwork banner sewn into a wearable cloak",
    "a heavy canvas workman's apron over the whole body",
    "a quilted sleeping-bag coat reaching the ankles",
    "a hooded towelling robe, oversized and shapeless",
    "a marching-band tunic with heavy shoulder cords",
    "a shepherd's felt cape, rigid and bell-shaped",
    "an umpire's long white coat, filthy at the hem",
    "a ringmaster's tailcoat, seams split under the arms",
    # Quatre de plus : la couche épique est le plus grand vêtement de la carte,
    # donc celui dont la répétition saute le plus aux yeux.
    "a hooded poncho cut from a groundsheet, reaching the shins",
    "a long padded coat, the lining showing through a tear",
    "a wool cape fastened with one large pin at the shoulder",
    "a bench coat with the sleeves knotted around the waist",
    "a vast waxed stockman's coat with a shoulder cape",
    "a duvet worn as a cloak, corners gripped in both fists",
    "an academic gown, sleeves hanging to the knee",
    "a hooded monk's robe in undyed wool",
    "a beekeeper's smock with the veil thrown back",
    "a fur-lined flying jacket down to mid-thigh",
    "a cape sewn entirely from match scarves",
    "a poncho of heavy oiled felt, bell-shaped and rigid",
    "a floor-length puffer coat, belted with rope",
    "a brass-buttoned naval greatcoat, hem dragging",
    "a hooded cloak of matted sheepskin",
    "a full-length apron of thick tan leather",
    "a cloak of layered netting hung with small weights",
    "a canvas tent-flap worn as a mantle",
    "a high-collared coachman's coat with three shoulder capes",
    "a quilted moving blanket with a hole cut for the head",
    "a hooded cape of oilcloth, water streaming off it",
    "a bearskin-heavy coat with the collar swallowing the jaw",
    "a long striped robe, worn open, trailing at the heel",
    "a cloak of woven straw reaching the knees",
    "a padded kimono-shaped coat with a wide sash",
    "a greatcoat with one sleeve empty and pinned",
    "a hooded cloak of dark waxed canvas, hood well forward",
    "a full circle skirt-coat that spins clear of the body",
    "a cape stitched from a dozen old banners",
    "a shepherd's hooded mantle of undyed felt, stiff as board",
    "a long coat of overlapping leather scales",
    "a floor-length raincape of translucent plastic",
    "a huge knitted blanket-coat with sleeves added later",
    "a vast hooded cloak of doubled tarpaulin, hem in the mud",
 ],
 'prehistorique': [
    "a full cave-bear pelt worn head and all, jaws over the brow",
    "an enormous mammoth hide dragging behind like a train",
    "a cloak of overlapping sabre-cat skins",
    "a mantle of huge fossil-bone plates lashed together",
    "a feathered wing-cape spanning both outstretched arms",
    "a sheet of tanned hide painted with abstract ochre marks",
    "a shaggy aurochs robe belted with a rope of gut",
    "a cape of woven reeds falling to the heels",
 ],
 'apocalyptique': [
    "a parachute canopy worn as a billowing cloak",
    "a cape cut from a corrugated advertising hoarding",
    "a long coat of overlapping road-sign scales",
    "a mantle of welded scrap plate, hanging heavy",
    "a shroud of shredded plastic sheeting, streaming",
    "a cloak of chain-linked bottle caps, rattling",
    "a fire blanket worn as a hooded mantle, singed through",
    "a tent groundsheet cut and belted into a greatcoat",
 ],
}

COU = {
 'base': [
    "a chunky hand-knitted scarf wound twice",
    "a thin silk neckerchief knotted tight at the throat",
    "a fleece neck gaiter pulled up over the chin",
    "a hood pulled up with the drawstrings cinched",
    "a roll-neck collar pulled right up to the jaw",
    "a bath towel slung round the neck like a boxer",
    "nothing at all at the neck, collar open to the cold",
    "a lanyard with a whistle hanging at the sternum",
    "a bandana tied cowboy-style over the collarbones",
    "a string of wooden beads over the chest",
    "a pair of headphones resting around the neck",
    "a long knitted scarf hanging straight down, untied",
    "a fur collar clipped on separately",
    "a rolled bandana worn as a sweatband at the throat",
    "a camera strap crossing the chest diagonally",
    "a knotted rain hood bunched at the collarbone",
    # Quatre de plus, et c'est le sac qui comptait le plus : la pièce de cou
    # est le SEUL endroit où paraît la couleur d'accent de la série. C'est donc
    # là que l'œil va, et là qu'une répétition se voit.
    "a thick tube scarf pushed down around the shoulders",
    "a whistle hanging from a knotted bootlace",
    "a folded neckerchief tucked into the collar",
    "a wide woollen muffler crossed over the chest",
    "a club scarf tied at the throat like a cravat",
    "a high zipped collar with the tab pulled to the chin",
    "a length of bunting looped twice round the neck",
    "a cotton scarf, threadbare and much too long",
    "a leather cord with a single pendant at the sternum",
    "a shirt collar turned up at the back only",
    "a scarf worn as a hood, tied under the chin",
    "a thick knitted cowl sitting on the shoulders",
    "a sweatband worn round the throat, unexplained",
    "a ribbon bow tied at the collarbone",
    "a silk square knotted at the side of the neck",
    "an unravelling scarf with one end far longer",
    "a rolled towel across the back of the neck, both ends hanging",
    "a chain of safety pins worn as a collar",
    "a thin scarf blown straight out sideways",
    "a shearling collar turned up against the ears",
    "a scarf knotted twice and tucked into the jacket",
    "a canvas strap crossing from shoulder to hip",
    "a wide flat collar lying open over the lapels",
    "a woven friendship band round the throat",
    "a scarf half tucked in, half hanging free",
    "a fur tippet draped over both shoulders",
    "a neck brace, worn without comment",
    "a drawstring hood bunched but not raised",
    "a scarf pinned at the shoulder with a large badge",
    "a plaited cord choker sitting tight",
    "a muffler wound so high it covers the mouth",
    "a bare neck with an old tan line across it",
    "a scarf tied in a loose knot that keeps slipping",
    "a wide collar of stitched felt standing up at the back",
 ],
 'prehistorique': [
    "a necklace of pierced teeth and claws",
    "a torc of hammered copper, green with age",
    "a collar of knotted sinew hung with small bones",
    "a wide band of painted hide around the throat",
    "a string of river pebbles bored through the middle",
    "a raw fur ruff tied under the chin",
    "nothing at all, the throat bare and weathered",
    "a plaited grass cord with a single carved stone",
 ],
 'apocalyptique': [
    "a respirator mask hanging loose at the collarbone",
    "a scarf of shredded rag, wound and knotted",
    "a length of bicycle chain worn as a collar",
    "welding goggles slung round the neck",
    "a dust filter strapped under the chin",
    "a coil of paracord looped twice",
    "a torn flag fragment knotted at the throat",
    "a collar of stitched inner tube, black and cracked",
 ],
}

TETE_SKIN = {
 'base': None,
 'prehistorique': [
    "a skull-cap of stitched hide with the fur inside out",
    "a headdress of long feathers bound at the temple",
    "bone pins holding a knot of matted hair",
    "a band of painted leather across the forehead",
    "a small animal skull worn as a helm",
    "hair stiffened upright with river clay",
    "a woven grass circlet, drying and brittle",
    "nothing, the hair loose and full of dust",
 ],
 'apocalyptique': [
    "a cracked motorcycle helmet with the visor missing",
    "a hood cinched to a slit, only the eyes showing",
    "a colander strapped on with cargo webbing",
    "a bandana over the mouth and goggles on the brow",
    "a hard hat with the lamp long dead",
    "a fur-lined flying cap, one flap torn away",
    "a head wrap of stitched rags, layered thick",
    "a gas mask pushed up onto the crown of the head",
 ],
}

# ═════════════════════════════════════════ MISE EN SCÈNE (par rareté)

MATIERE_EPIQUE = [
    "a fine burst of pale dust thrown up from the ground",
    "a scatter of torn paper confetti",
    "loose snowflakes whipped sideways",
    "flecks of wet mud flung from the boots",
    "dry leaves lifted in the draught",
    "a light spray of water droplets shaken from the fabric",
    "shreds of coloured streamer whipping past",
    "ash and cinders drifting upward",
    "a scatter of grass torn from the turf",
    "small feathers loosed and turning in the air",
    "sparks flicking off and dying",
    "seed-heads blown from the verge",
    "crumbs and wrappers caught in the updraught",
    "sand grains streaming off in a low sheet",
    "flecks of dried paint shaken loose",
    "steam curling off warm fabric in cold air",
    "loose thread ends whipping free",
    "shards of ice cracked from the surface",
    "chalk dust knocked off a hand rail",
    "shreds of torn ticket paper thrown upward",
    "rain driven sideways in fine lines",
    "sawdust kicked up in a low cloud",
    "pigeon feathers turning slowly in the air",
    "hail bouncing off the shoulders",
    "wet sand thrown out in an arc",
    "cigarette ash whipped off and scattering",
    "soap bubbles carried past on the draught",
    "wood shavings curling loose and falling",
    "dandelion seeds lifted in a slow drift",
    "grit and small stones sprayed from underfoot",
    "melting snow shaken off in heavy drops",
    "paper tickets fluttering up around the knees",
    "chalk lines scuffed into a low white haze",
    "dry hay lifted and turning",
    "glitter shaken loose from a banner",
    "coal dust puffed out of thick fabric",
    "torn grass and clods flung backwards",
    "rice grains scattering off a coat",
    "a sheet of fine spray off a wet surface",
    "powder paint thrown up in a soft cloud",
    "dead petals loosed and spinning down",
    "flecks of rust shaken free",
    "breadcrumbs scattered and caught mid-fall",
    "steam and smoke braided together and rising",
    "salt crystals spilling in a thin stream",
    "small screws and washers bouncing away",
    "a scatter of matches struck loose",
    "pine needles lifted and falling",
    "soot flaking off and drifting sideways",
    "thistledown carried slowly past",
]

APPUI = [
    "one foot planted high on an unseen step, knee bent",
    "both feet off the ground at the top of a jump",
    "braced wide in a deep lunge, back leg straight",
    "twisted at the hips, shoulders square to the viewer",
    "leaning far back with the chest thrown open",
    "up on the toes of both feet, heels lifted",
    "one leg swung across the other in mid-stride",
    "crouched low and about to spring upward",
    "pivoting on one heel, the other foot skidding",
    "arched backwards with the head thrown back",
    "one knee driven up toward the chest",
    "striding forward with the whole body tilted ahead",
    "planted dead still, weight sunk into both heels",
    "rising onto one leg, the other trailing behind",
    # Six de plus. L'appui ne paraît que sur la carte épique — mais c'est elle
    # qu'on regarde le plus longtemps.
    "half-turned away, looking back over one shoulder",
    "wide-legged and sinking, arms dropped at the sides",
    "rocked onto the outside edge of one foot",
    "stretched up on tiptoe with both arms overhead",
    "dropped onto one knee, the other leg braced out wide",
    "shoulders hunched and both fists drawn in to the chest",
    "mid-leap with both knees tucked up to the chest",
    "twisting hard, one shoulder driven forward",
    "balanced on the ball of one foot, arms out level",
    "bent double from the waist, head below the shoulders",
    "reaching up with one arm at full stretch",
    "sitting back on an unseen step, legs stretched out",
    "one foot up on a barrier, elbow on the raised knee",
    "spinning, the coat opened out by the turn",
    "lunging sideways, trailing hand near the ground",
    "standing straight with the heels together, oddly formal",
    "leaning on nothing, elbow propped at shoulder height",
    "mid-stumble, one arm windmilling",
    "squatting flat-footed, arms hanging between the knees",
    "arched forward with the shoulders rolled and head low",
    "on both knees, torso upright, arms at the sides",
    "one leg crossed behind the other, weight on the front",
    "rocked back on the heels with the chest open",
    "striding out with both arms swung to the same side",
    "toes turned in, knees together, awkward and still",
    "one arm hooked overhead, body curved beneath it",
    "pushing hard against something unseen, both palms out",
    "mid-turn, looking back over the trailing shoulder",
    "up on a single toe, the rest of the body vertical",
    "crouched with both hands flat on the ground",
    "leaning far to one side, the other leg lifted for balance",
    "walking backwards, weight on the rear foot",
    "one knee dropped, the other foot flat, half-kneeling",
    "stretched wide, both arms and both legs apart",
    "standing square with the arms clamped to the sides",
    "heels together and both arms flung straight overhead",
]

""" **L'appui des créatures ne monte pas à cinquante, et c'est délibéré.**

Les autres sacs y arrivent parce qu'il existe vraiment cinquante façons
distinctes de se tenir sur deux jambes. Une créature n'en a pas : elle flotte,
elle n'a pas de squelette, et elle ne touche pas le sol. Passé une trentaine, on
n'écrit plus des poses différentes, on écrit la même en changeant un adverbe —
et une fausse variété dans un sac coûte plus cher qu'un sac plus court, parce
qu'elle donne l'illusion d'avoir réglé la question.

Trente, donc, pour quatre créatures dans cette série. Le jour où une série en
comptera trente, il faudra inventer autre chose que des adverbes. """

APPUI_CREATURE = [
    "hovering a hand's width above the ground, trailing wisps",
    "tilted forward in the air as if leaning into wind",
    "spiralling slowly, the lower body drawn out to a point",
    "risen high, the body stretched tall and thin",
    "spread wide and flattened, filling the space sideways",
    "coiled tight into a dense knot about to unwind",
    "folded over on itself, the top half doubled down",
    "streaming upward, the lower body pulled to a thread",
    "split into two lobes that have not yet separated",
    "rolling forward like a wave about to break",
    "hollowed out in the middle, a ring with a face",
    "drooping low, almost pooling on the ground",
    "corkscrewed from bottom to top in a tight twist",
    "billowed outward in every direction at once",
    "leaning far back, the base trailing behind",
    "compressed flat and wide, like something pressed on glass",
    "rising in a column with the face near the top",
    "fraying at every edge, dispersing and holding",
    "curled into a comma, the tail whipped up",
    "tipped fully sideways, face turned to the viewer",
    "gathered into a dense sphere with two limbs out",
    "stretched between two points, thin in the middle",
    "puffed up to twice its size, edges soft",
    "sinking, the upper body collapsing into the lower",
    "wound around an unseen post in a slow helix",
    "bristling outward in spikes and settling",
    "bent into an arch, both ends near the ground",
    "trailing a long tail that curls back on itself",
    "layered in three stacked bands, slightly offset",
    "shrunk small and dense, hovering very low",
]

# ═══════════════════════════════════════════════════════════ mécanique

def _graine(cle):
    return int(hashlib.sha1(cle.encode()).hexdigest()[:8], 16)


def repartir(ids, valeurs, sel, ancres=()):
    """Attribue sans collision tant qu'il reste des valeurs libres.

    `ancres` : les identifiants **déjà dessinés**. Ils sont servis d'abord, dans
    leur propre ordre trié, donc exactement comme le jour où ils étaient seuls
    au monde. Sans ça, ajouter `RP18` changerait la veste de `RP2` — le tri est
    alphabétique, et `RP18` se glisse entre `RP17` et `RP2`. Dix-sept lignées
    déjà produites se seraient mises à ne plus ressembler à leurs images.
    """
    out, pris = {}, set()

    def servir(ident):
        depart = _graine(ident + sel) % len(valeurs)
        for pas in range(len(valeurs)):
            i = (depart + pas) % len(valeurs)
            if i not in pris:
                pris.add(i); out[ident] = valeurs[i]; return True
        return False

    # Les ancres d'abord, **et à l'ancienne** : repli sur la valeur de départ si
    # le sac est vide. C'est ce que le générateur faisait le jour où elles ont
    # été dessinées, et leur image existe — on ne rejoue pas leur tirage, on le
    # reproduit.
    for ident in sorted(a for a in ancres if a in ids):
        if not servir(ident):
            out[ident] = valeurs[_graine(ident + sel) % len(valeurs)]

    # **Ardoise nette pour le lot neuf.** Les ancres viennent de consommer le
    # sac ; leur laisser bloquer les places forcerait les nouveaux à se répéter
    # entre eux dès la première tournée. Or ce qui compte est qu'ils diffèrent
    # **les uns des autres** : ce sont eux qu'on va produire ensemble, et qu'on
    # regardera côte à côte dans un booster.
    #
    # Qu'un nouveau reprenne la veste d'une ancre est sans conséquence — dix-sept
    # cartes les séparent, et l'ancienne est dessinée depuis longtemps.
    pris = set()

    # Et **par tournées** ensuite, si le lot dépasse le sac. Un sac vide se
    # remet à zéro plutôt que de renvoyer tout le monde sur sa position de
    # hachage : l'ancien repli sortait quatre fois la même valeur et jamais
    # certaines, là où une tournée neuve les donne toutes une fois avant d'en
    # redonner une seule deux fois.
    for ident in sorted(i for i in ids if i not in ancres):
        if len(pris) >= len(valeurs):
            pris = set()
        if not servir(ident):
            pris = set()
            servir(ident)
    return out


def recettes(personnages, skin='base', ancres=()):
    """personnages : [{'id','nature',...}, ...] d'une même série.

    nature ∈ humain | animal | objet | creature | hybride

    Deux champs facultatifs, et ils l'emportent sur les sacs :
      `sujet`   — ce que le personnage EST, quand le catalogue l'a déjà décidé ;
      `surface` — sa matière, quand le sac n'en a pas d'honnête pour lui.
    """
    ids = [p['id'] for p in personnages]
    nat = {p['id']: p.get('nature', 'humain') for p in personnages}

    tete_src = TETE_SKIN[skin] or TETE
    # Deux sacs, deux tirages : une tête humaine peut recevoir une coupe de
    # cheveux, une tête de pigeon non. Voir COIFFE. Les skins, eux, ne
    # proposent que des choses qui se posent — un seul sac suffit.
    coiffe_src = TETE_SKIN[skin] or COIFFE
    R = lambda v, s: repartir(ids, v, s, ancres)
    tir = {
        'genre':   R(GENRE, 'genre'),
        'origine': R(ORIGINE, 'origine'),
        'morpho':  R(MORPHO, 'morpho'),
        'palette': R(PALETTES, 'palette'),
        'tete':    R(tete_src, 'tete' + skin),
        'coiffe':  R(coiffe_src, 'coiffe' + skin),
        # Le visage appartient à l'identité : même sel quel que soit le skin,
        # donc la même expression sur les trois tenues. Les mains et le bas,
        # eux, sont de la garde-robe et changent avec elle.
        'visage':  R(EXPRESSION, 'expression'),
        'mains':   R(MAINS[skin], 'mains' + skin),
        'bas':     R(BAS[skin], 'bas' + skin),
        'veste':   R(VESTES[skin], 'veste'),
        'couche':  R(COUCHE_EPIQUE[skin], 'couche'),
        'cou':     R(COU[skin], 'cou'),
        'matiere': R(MATIERE_EPIQUE, 'matiere'),
        'appui':   R(APPUI, 'appui'),
        # **Distribué sur ses seuls usagers.** Les autres axes sont tirés sur
        # toute la série, ce qui est juste : n'importe qui peut porter n'importe
        # quelle veste. L'appui des créatures, non — seules les créatures en ont
        # un, et elles sont quatre. Le tirer sur trente-cinq identifiants faisait
        # tomber ces quatre-là dans des tournées différentes, où rien ne les
        # empêchait de se répéter entre elles : trois poses pour quatre
        # personnages, dans un sac qui en contient six.
        'appui_c': repartir([p['id'] for p in personnages
                             if p.get('nature') == 'creature'],
                            APPUI_CREATURE, 'appui_c', ancres),
        'animal':  R(NATURE_ANIMAL, 'animal'),
        'objet':   R(NATURE_OBJET, 'objet'),
        'creature': R(NATURE_CREATURE, 'creature'),
    }
    for n in SURFACE:
        tir['surf_' + n] = R(SURFACE[n], 'surf_' + n)

    par_id = {p['id']: p for p in personnages}
    out = {}
    for i in ids:
        p = par_id[i]
        r = {a: tir[a][i] for a in ('genre', 'origine', 'morpho', 'palette',
                                    'tete', 'veste', 'couche', 'cou', 'matiere',
                                    'visage', 'mains', 'bas')}
        r['nature'] = nat[i]
        # Un hybride garde sa tête humaine : il pioche donc comme un humain.
        if nat[i] not in ('humain', 'hybride'):
            r['tete'] = tir['coiffe'][i]
        # Ce que le bloc d'anatomie générique ne peut pas deviner : un étourneau
        # a des ailes là où le bloc dit « forelimbs ». Sans ce mot, le modèle
        # greffe deux bras sur un oiseau.
        r['precision'] = p.get('anatomie_plus')
        r['appui'] = tir['appui_c'][i] if nat[i] == 'creature' else tir['appui'][i]
        if nat[i] != 'humain':
            # Le personnage décide ; le sac ne sert qu'à ceux qui se taisent.
            r['sujet'] = p.get('sujet') or tir.get(nat[i], {}).get(i)
            r['surface'] = p.get('surface') or tir['surf_' + nat[i]][i]
            if not r['sujet']:
                raise ValueError(
                    f"{i} : nature '{nat[i]}' sans sujet, et aucun sac pour elle. "
                    "Pose un `sujet` sur le personnage.")
        if nat[i] == 'hybride':
            r['greffe'] = p.get('greffe') or 'the torso'
        out[i] = r
    return out


SOCLE = ("Stylised 3D animated-film rendering, the polished look of a modern "
         "animated feature: soft global illumination, subsurface scattering, "
         "richly textured surfaces, warm cinematic key light.")

INTERDITS = (
    "NO BRANDING: absolutely no real brand names, no logos, no trademarks, and "
    "NO readable text, letters, words or NUMBERS anywhere in the image.\n"
    "NO GLOW: no aura, no halo, no light rays, no magical particles, no abstract "
    "energy. Every moving element must be real physical matter.")

CADRAGE = ("FRAMING: the whole figure fully inside the frame, centered, plain "
           "pure white background, no cropping, no shadow, no platform beneath it.")

CIBLES = {1: '45-55%', 2: '62-70%', 3: '84-90%'}
TITRE = {1: 'A COMMON TIER', 2: 'A RARE TIER', 3: 'AN EPIC TIER'}

SKIN_TEXTE = {
    'base': None,
    'prehistorique': ("SKIN — PREHISTORIC: the same character in a prehistoric "
                      "wardrobe. Hides, fur, bone, stone and raw fibre only. No "
                      "modern fabric, no zips, no synthetics, no machine "
                      "stitching anywhere. The character's own build and face "
                      "are unchanged."),
    'apocalyptique': ("SKIN — APOCALYPTIC: the same character dressed from "
                      "salvage after everything stopped. Scavenged metal, tape, "
                      "wire, rubber and sun-bleached cloth. Everything is "
                      "repaired, mismatched and improvised; nothing is new. The "
                      "character's own build and face are unchanged."),
}


def age_de(perso, stade):
    """Le nom et l'histoire de **cet âge-là**.

    Une lignée est trois personnages, pas un : le commun casse au troisième mot,
    l'épique n'a plus besoin de forcer. Annoncer le nom du commun sur le prompt
    de l'épique donnait trois images du même moment.

    `nom`/`histoire` restent acceptés pour un personnage sans lignée — les
    légendaires n'ont qu'un âge, et c'est leur seule différence ici.
    """
    ages = perso.get('ages')
    if not ages:
        if 'nom' in perso:
            return perso['nom'], perso.get('histoire', '')
        raise ValueError(f"{perso['id']} : ni `ages` ni `nom`. "
                         "Une ancre n'a pas de quoi produire un prompt.")
    if not 1 <= stade <= len(ages):
        raise ValueError(f"{perso['id']} : pas d'âge {stade} "
                         f"(la lignée en a {len(ages)}).")
    return ages[stade - 1]


def prompt(perso, r, stade, accent, skin='base'):
    nat = r['nature']
    nom, histoire = age_de(perso, stade)
    L = [f"{TITRE[stade]} character card for a football supporters game. {SOCLE}", ""]

    if nat == 'humain':
        L += [f"CHARACTER — {nom}: {r['genre']} {r['origine']}. {histoire}",
              f"BUILD: {r['morpho']}.", f"HEAD: {r['tete']}."]
    elif nat == 'hybride':
        L += [f"CHARACTER — {nom}, HUMAN FUSED WITH AN OBJECT: {r['genre']} "
              f"{r['origine']}, whose {r['greffe']} has become {r['sujet']}. "
              f"{histoire}",
              f"BUILD: {r['morpho']}.",
              f"FUSED PART: {r['greffe']}, made of {r['surface']}.",
              f"HEAD: the character's own human head, wearing {r['tete']}."]
    else:
        mot = {'animal': 'ANTHROPOMORPHIC ANIMAL',
               'objet': 'ANTHROPOMORPHIC OBJECT', 'creature': 'CREATURE'}[nat]
        L += [f"CHARACTER — {nom}, {mot}: this character IS {r['sujet']}. "
              f"{histoire}",
              f"SURFACE: its body is made of {r['surface']}."]
        if nat == 'animal':
            L += [f"BUILD: {r['morpho']}, adapted to the animal's own anatomy.",
                  f"HEAD: the animal's own head, wearing {r['tete']}."]
        elif nat == 'objet':
            L += ["PROPORTIONS: the object is enlarged to character size, its "
                  "silhouette exaggerated and instantly readable, with a face set "
                  "into its front surface.",
                  f"ON TOP: it wears {r['tete']}."]
        else:
            L += ["PROPORTIONS: roughly the height of a person, with a soft "
                  "undefined lower body that dissipates toward the ground.",
                  f"ON TOP: it wears {r['tete']}."]

    if SKIN_TEXTE[skin]:
        L += ["", SKIN_TEXTE[skin]]

    # Les trois axes qui manquaient. Le visage d'abord : c'est lui qui rend deux
    # cartes différentes le plus vite, et il n'était nulle part.
    L += [f"FACE: {r['visage']}.", f"HANDS: {r['mains']}."]
    # Le bas du corps, sauf pour les créatures : leur bloc d'anatomie dit
    # « NO legs and does not touch the ground ». Leur décrire des bottes serait
    # demander au modèle de choisir entre deux consignes du même prompt, et il
    # choisirait la dernière.
    if nat != 'creature':
        L += [f"LOWER BODY: {r['bas']}."]

    L += ["", f"PALETTE: the clothing is in {r['palette']}. The series accent "
              f"colour {accent} appears ONLY on the neck piece and nowhere else.",
          f"NECK: {r['cou']}, in {accent}.", ""]

    if stade == 1:
        L += [f"OUTER LAYER: {r['veste']}.",
              "COMMON TIER SILHOUETTE — keep it deliberately CONTAINED AND "
              "NARROW: limbs held in against the body, feet flat and close "
              "together, weight even. Nothing leaves the body volume. NO matter "
              "in movement at all. Leave generous empty white space left and right."]
    elif stade == 2:
        L += [f"OUTER LAYER: {r['veste']}, worn open and noticeably better kept.",
              "RARE TIER SILHOUETTE — a clear step up from the common card but "
              "NOT yet the widest: ONE limb leaves the body volume and is raised "
              "out; the other stays close in. Only the open edges and the neck "
              "piece move. Keep the total width MODERATE — clearly wider than the "
              "common card, not spread across the whole frame."]
    else:
        L += ["CAMERA ANGLE — ESSENTIAL, DO NOT IGNORE: render from a LOW CAMERA "
              "POSITION, looking clearly UPWARD from below waist height. A "
              "pronounced worm's-eye contre-plongée. The common and rare cards "
              "were shot at eye level — this one must be visibly different.",
              f"OUTER LAYER: {r['couche']}.", f"STANCE: {r['appui']}.",
              f"MOVING MATTER: {r['matiere']}, kept close around the silhouette, "
              "well inside the picture, touching no edge of the frame.",
              "EPIC TIER SILHOUETTE — the top of the ladder: wide and asymmetric, "
              "both upper limbs out and clear of the body, filling the frame, "
              "with clear white margin on all four sides."]

    anat = ANATOMIE[nat]
    if r.get('precision'):
        anat += ' ' + r['precision']
    L += ["", f"TARGET WIDTH after cut-out: {CIBLES[stade]} of the tile width.",
          anat, INTERDITS, CADRAGE]
    return "\n".join(L)


def rapport_diversite(recs):
    return [(a, len({r[a] for r in recs.values()}), len(recs))
            for a in ('genre', 'origine', 'morpho', 'palette', 'tete', 'veste',
                      'couche', 'cou', 'matiere', 'appui')]


# ═══════════════════════════════════════════════════ LA REPRISE (série RP)

ACCENT_RP = 'terracotta red'          # SET_SAISON.c1 = #C7563A

""" **Les ancres : déjà dessinées, à ne pas déshabiller.**

RP1 à RP17 ont leurs images. On les garde dans le tirage — sans quoi une lignée
neuve pourrait recevoir la veste d'une ancienne, et la série aurait deux
parkas olive — mais servies **en premier**, donc avec exactement l'attribution
du jour où elles étaient seules. Elles n'ont pas d'`ages` : ce fichier ne sert
plus à les produire, seulement à ne pas leur marcher dessus. """

ANCRES_RP = [
    {'id': 'RP1',  'nature': 'humain'},   # Gosier Rouillé
    {'id': 'RP2',  'nature': 'humain'},   # Chant Oublié
    {'id': 'RP3',  'nature': 'humain'},   # Peau Neuve
    {'id': 'RP4',  'nature': 'humain'},   # Mains Molles
    {'id': 'RP5',  'nature': 'humain'},   # Abonnement Renouvelé
    {'id': 'RP6',  'nature': 'humain'},   # Chaise Vide
    {'id': 'RP7',  'nature': 'humain'},   # Bâche Repliée
    {'id': 'RP8',  'nature': 'humain'},   # Carré Manquant
    {'id': 'RP9',  'nature': 'humain'},   # Mèche Humide
    {'id': 'RP10', 'nature': 'humain'},   # Décompte Oublié
    {'id': 'RP11', 'nature': 'humain'},   # Car Repeint
    {'id': 'RP12', 'nature': 'humain'},   # Itinéraire Perdu
    {'id': 'RP13', 'nature': 'humain'},   # La Clé du Local        (légendaire)
    {'id': 'RP14', 'nature': 'humain'},   # Le Premier Cri         (légendaire)
    {'id': 'RP15', 'nature': 'humain'},   # Le Fût Jamais Rangé    (légendaire)
    {'id': 'RP16', 'nature': 'humain'},   # La Bâche de la Trêve   (légendaire)
    {'id': 'RP17', 'nature': 'humain'},   # La Première Torche     (légendaire)
]

""" **Les dix-huit neuves.**

Elles existent pour une raison qui est écrite dans le catalogue : LA REPRISE est
la série d'ouverture, et douze humains laissaient croire que le jeu ne
collectionne que des supporters. Chacune fait donc signe vers une famille de
personnages qui vit ailleurs — le bestiaire, les objets qui traînent, les
revenants, la météo — plus trois qui n'ont de série nulle part : la
science-fiction.

Les histoires sont en anglais et tiennent en une ligne : le modèle lit
l'anglais, et un prompt n'est pas une fiche. Le texte français fait foi, il est
dans `dex-saison.js`. """

NEUVES_RP = [
  # ---------------------------------------------------------------- la voix
  {'id': 'RP18', 'nature': 'animal', 'sujet': 'a starling',
   'surface': 'smooth iridescent black-green feathers, speckled with white',
   'anatomie_plus':
     "Its forelimbs are WINGS, folded at its sides and used as arms; it has no hands.",
   'ages': [
     ("Perched Starling",
      "It nested in the roof beams in June and kept May's chant, slightly wrong."),
     ("Prompter Starling",
      "It comes in one bar early; the terrace stopped minding and started waiting."),
     ("Choirmaster Starling",
      "Three hundred birds in the beams and only one gives the downbeat."),
   ]},
  {'id': 'RP19', 'nature': 'objet', 'sujet': 'an old wall-mounted horn tannoy speaker',
   'surface': 'cracked enamel paint over pitted cast metal',
   'ages': [
     ("Crackling Tannoy",
      "Unplugged since May; it coughs out dust, then gets one word in three."),
     ("Tuned Tannoy",
      "Someone went up with a screwdriver, and now the names are audible."),
     ("Sovereign Tannoy",
      "It could drown the whole terrace. It almost never does, which is why it wins."),
   ]},
  {'id': 'RP20', 'nature': 'objet', 'sujet': 'a rooftop satellite dish on a rusted mount',
   'surface': 'galvanised steel gone chalky, streaked with rust',
   'ages': [
     ("Sleeping Aerial",
      "Bolted up in 1998 for a broadcast that never happened. It woke by itself."),
     ("Woken Aerial",
      "It sends the chant back two seconds late, from somewhere very high up."),
     ("Aerial in Orbit",
      "The terrace hears its own voice come down a beat late, and sings over it."),
   ]},
  # ---------------------------------------------------------- la percussion
  {'id': 'RP21', 'nature': 'animal', 'sujet': 'a woodpecker',
   'surface': 'stiff black-and-white barred feathers with a scarlet nape',
   'anatomie_plus':
     "Its forelimbs are WINGS, folded at its sides and used as arms; it has no hands.",
   'ages': [
     ("Railing Woodpecker",
      "It spent summer on a goalpost and moved to the steel railing in August."),
     ("Metronome Woodpecker",
      "Two hundred and forty beats a minute; the drum gave up and joined in."),
     ("Iron Woodpecker",
      "The beak holed the railing, the railing notched the beak. Neither gave way."),
   ]},
  {'id': 'RP22', 'nature': 'hybride',
   'sujet': 'a marching snare drum', 'greffe': 'the chest and ribcage',
   'surface': 'taut drum skin stretched over a wooden shell',
   'ages': [
     ("Grafted to the Drum",
      "He carried it all summer for nothing; the strap left a mark that stayed."),
     ("Half Skin, Half Man",
      "Nobody can tell any more whether he strikes it or it moves him."),
     ("The Drum-Body",
      "He carries nothing now. The sound comes out of him, into the rows below."),
   ]},
  {'id': 'RP23', 'nature': 'objet', 'sujet': 'a dented steel crowd barrier',
   'surface': 'brushed steel, dented and scratched',
   'ages': [
     ("Cold Barrier",
      "Two months without a hand on it; the first three blows ring hollow."),
     ("Warm Barrier",
      "Forty palms warmed it in a quarter of an hour. It gives back a little more."),
     ("Dented Barrier",
      "Twenty years, three coats of paint, one dent a season. People count them."),
   ]},
  # ------------------------------------------------------------- les fidèles
  {'id': 'RP24', 'nature': 'animal', 'sujet': 'a scruffy old sheepdog',
   'surface': 'shaggy matted fur, grey around the muzzle',
   'ages': [
     ("The Groundsman's Dog",
      "It knows the way from the car park to the terrace and took it unled."),
     ("The Third-Row Dog",
      "It picked a seat. The people who had it eventually moved; the dog never did."),
     ("The Old Terrace Dog",
      "It no longer stands for goals — one ear, a check that it's ours, back to sleep."),
   ]},
  {'id': 'RP25', 'nature': 'creature', 'sujet': 'a standing mass of climbing ivy',
   'surface': 'dense dark-green ivy leaves on woody stems',
   'ages': [
     ("Fence Ivy",
      "It ate twelve metres of fencing in two months. Only the view was cut back."),
     ("Tolerated Ivy",
      "Nobody cuts it now: it holds the fence up as much as the fence holds it."),
     ("Terrace Ivy",
      "The club's name sits hollow in its leaves. Nobody pruned it that way."),
   ]},
  {'id': 'RP26', 'nature': 'objet', 'sujet': 'a folding stadium seat',
   'surface': 'a glossy plastic surface, sun-bleached on one side',
   'ages': [
     ("Memory Seat",
      "It held somebody's shape all summer and politely refuses everyone else."),
     ("Knowing Seat",
      "It adjusts before you sit. People stopped finding that strange by week three."),
     ("The Empty-Place Seat",
      "It still holds the shape of someone who didn't come back. Two seasons now."),
   ]},
  # ---------------------------------------------------------------- le tifo
  {'id': 'RP27', 'nature': 'objet', 'sujet': 'a thick stack of coloured mosaic cards',
   'surface': 'waxed cardboard softened at the folds',
   'ages': [
     ("Cellar Cards",
      "Boxed in May, up again in August. One side of the stack faded; so there are two reds."),
     ("Re-sorted Cards",
      "Three evenings redoing the piles row by row. It holds, if nobody grabs wrong."),
     ("Opening-Day Cards",
      "They are used once a season. The rest of the year it's enough to know they're down there."),
   ]},
  {'id': 'RP28', 'nature': 'creature', 'sujet': 'a living club flag on its pole',
   'surface': 'heavy woven flag cloth, sun-faded',
   'ages': [
     ("Stiff Flag",
      "Folded since May; the creases stay in the cloth right through the first half."),
     ("Loosened Flag",
      "It turns by itself once the terrace restarts. The pole is held out of politeness."),
     ("The Breathing Flag",
      "It fills with no wind, in time with the stand. Two people filmed it; nothing showed."),
   ]},
  {'id': 'RP29', 'nature': 'objet', 'sujet': 'a small four-rotor camera drone',
   'surface': 'a matte painted metal surface, scuffed at the rotor guards',
   'ages': [
     ("Rehearsal Drone",
      "It filmed the cellar all summer to learn the order of the piles. It got two wrong."),
     ("Calibrated Drone",
      "It gives each row its colour one second early. Nobody read the manual; everyone obeys."),
     ("Terrace Drone",
      "It stopped giving orders. It watches, counts, and lands when the mosaic is right."),
   ]},
  # ---------------------------------------------------------------- la pyro
  {'id': 'RP30', 'nature': 'animal', 'sujet': 'a fire salamander',
   'surface': 'wet black skin with bright yellow blotches',
   'ages': [
     ("Underfloor Salamander",
      "It lives under the terrace concrete where it's warm all year. Seen twice a season."),
     ("Ember Salamander",
      "It walks through the smoke without hurrying. That convinced the last sceptics."),
     ("Blue-Flame Salamander",
      "Where it passes, the flare lights first time. Unproven, and nobody doubts it."),
   ]},
  {'id': 'RP31', 'nature': 'creature', 'sujet': 'a small thunderstorm',
   'surface': 'a rolling boil of dark cloud',
   'ages': [
     ("Season-Opening Storm",
      "It waited three weeks over the plain. It breaks on twenty minutes, every year."),
     ("Circling Storm",
      "It goes round the ground without coming in. The terrace sings louder to see if it dares."),
     ("Storm Over the Terrace",
      "Two thousand soaked people who don't give up a single row. It's the only photo kept."),
   ]},
  {'id': 'RP32', 'nature': 'objet', 'sujet': 'a battered metal petrol lighter',
   'surface': 'brushed steel worn smooth and mirror-bright at the corners',
   'ages': [
     ("Unkillable Lighter",
      "Twelve seasons in the same pocket. Three flames, never four, never a missed opener."),
     ("Lent Lighter",
      "It goes round the row and comes back — the only thing here you can be sure returns."),
     ("Opening-Day Lighter",
      "Nobody uses it now. It comes out once a year, on the first day, for form's sake."),
   ]},
  # --------------------------------------------------------- le déplacement
  {'id': 'RP33', 'nature': 'animal', 'sujet': 'a city pigeon',
   'surface': 'ruffled scruffy grey feathers with an oily green throat',
   'anatomie_plus':
     "Its forelimbs are WINGS, folded at its sides and used as arms; it has no hands.",
   'ages': [
     ("Car-Park Pigeon",
      "It has followed the coach forty kilometres for four years, and arrives first."),
     ("Homing Pigeon",
      "It took the route again on the first Saturday, uncalled. Two months changed nothing."),
     ("Lead Pigeon",
      "It opens the road for the coach in November fog. The driver stopped arguing."),
   ]},
  {'id': 'RP34', 'nature': 'objet', 'sujet': "a supporters' coach, an old single-deck bus",
   'surface': 'painted bus panelling, chipped to bare metal at every corner',
   'ages': [
     ("Laid-Up Coach",
      "Two months behind the depot. Starts on the third try, smells of hot dust to the toll."),
     ("The Five O'Clock Coach",
      "Leave at five, arrive at eleven. Six hours where nothing happens that everyone remembers."),
     ("The Coach Home",
      "The way back is always shorter, whatever the result. Nobody has ever explained it."),
   ]},
  {'id': 'RP35', 'nature': 'creature', 'sujet': 'a translucent hitchhiker holding a scarf',
   'surface': 'thin drifting mist, denser at the hands',
   'ages': [
     ("The Roadside Hitchhiker",
      "Same bend of the main road, scarf held up, every opening day. Coaches stop; nobody's there."),
     ("The Passenger at the Back",
      "There is always one seat more taken on the way home than on the way out."),
     ("The One Who Gets Off at the Ground",
      "He's off before anyone, past no turnstile, and he's in the third row. In his place."),
   ]},
]

SERIE_RP = ANCRES_RP + NEUVES_RP
IDS_ANCRES_RP = tuple(p['id'] for p in ANCRES_RP)
PAR_ID_RP = {p['id']: p for p in SERIE_RP}


def prompts_rp(ident, skin='base', stades=(1, 2, 3)):
    """Tous les prompts d'une lignée de LA REPRISE, dans l'ordre des âges."""
    if ident not in PAR_ID_RP:
        raise SystemExit(f"{ident} : inconnu dans LA REPRISE.")
    recs = recettes(SERIE_RP, skin, ancres=IDS_ANCRES_RP)
    p = PAR_ID_RP[ident]
    return [(s, prompt(p, recs[ident], s, ACCENT_RP, skin)) for s in stades]


# ═══════════════════════════════════════════════════════════════ la ligne

def _cli():
    ap = argparse.ArgumentParser(description='Prompts Fanzzy — série LA REPRISE')
    ap.add_argument('id', nargs='?', help='RP18, RP24… (vide : la table)')
    ap.add_argument('--skin', default='base',
                    choices=('base', 'prehistorique', 'apocalyptique'))
    ap.add_argument('--stade', type=int, choices=(1, 2, 3),
                    help='un seul âge plutôt que les trois')
    ap.add_argument('--table', action='store_true',
                    help='ce que chaque lignée neuve a tiré')
    a = ap.parse_args()

    if a.table or not a.id:
        recs = recettes(SERIE_RP, a.skin, ancres=IDS_ANCRES_RP)
        print(f"\nLA REPRISE — skin « {a.skin} », "
              f"{len(NEUVES_RP)} lignées neuves sur {len(SERIE_RP)}\n")
        for p in NEUVES_RP:
            r = recs[p['id']]
            print(f"  {p['id']:6s} {r['nature']:9s} {(r.get('sujet') or '—')[:34]:34s} "
                  f"{r['veste'][:38]}")
        print('\n  diversité :', ' '.join(f"{x}:{d}/{t}"
              for x, d, t in rapport_diversite(recs)))
        print("\n  un prompt :  python scripts/fanzzy_prompts.py RP18\n")
        return

    stades = (a.stade,) if a.stade else (1, 2, 3)
    for s, texte in prompts_rp(a.id, a.skin, stades):
        nom = age_de(PAR_ID_RP[a.id], s)[0]
        print(f"\n{'=' * 72}\n{a.id}  stade {s}  —  {nom}\n{'=' * 72}\n")
        print(texte)


if __name__ == '__main__':
    _cli()
