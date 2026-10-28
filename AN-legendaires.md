# AN · LES TERRACES : les six légendaires

*28 octobre 2026. Demande de Gaël : trois légendaires liées aux équipes
nationales anglaises (une femme, un homme, un animal) et trois liées à la
Premier League en général, sans club (même modèle). À valider avant toute
génération.*

Elles suivent la méthode des légendaires (`00-METHODE.md`) : un seul âge, cinq
signes (un mythe et non un supporter, une silhouette iconique, une couronne de
silhouette, la lumière d'or `#FFC23D` collée au corps, des matières nobles).
Elles sortent dans le booster LES TERRACES, au taux des légendaires (2 %), et
suivent la règle d'entrée en jeu (une par deck, jamais titulaire, éveil après
5 chants).

## La prudence juridique, en plus de celle de la série

- **Sélections** : ni lion (ni trois lions, ni lionne), ni rose Tudor, ni
  écusson, ni surnom de l'équipe, ni titre ou paroles de chanson de supporters,
  ni stade, ni joueur ou sélectionneur. La croix rouge de saint Georges sur
  fond blanc est le drapeau du pays : elle est libre, on la garde.
- **Premier League** : ni le nom, ni le lion, ni la couronne, ni le trophée,
  ni le logo. Les couleurs de plusieurs clubs côte à côte ne nomment personne.
- Comme pour les 60 autres : aucun texte, chiffre ni logo sur l'image.

## Les six

| ID | Nom | Lien | Type | Fond |
|---|---|---|---|---|
| AN61 | La Dame des Falaises Blanches | sélections | depl | vert |
| AN62 | Le Chevalier à la Croix Rouge | sélections | tifo | vert |
| AN63 | Le Bouledogue au Grand Tambour | sélections | perc | vert |
| AN64 | La Tisseuse des Vingt Écharpes | championnat | fide | magenta |
| AN65 | La Voix des Résultats | championnat | voix | vert |
| AN66 | Le Rouge-Gorge du Lendemain de Noël | championnat | pyro | vert |

Couleurs des sélections : blanc, bleu marine `#13294B`, rouge de la croix
`#CE1124`. AN64 porte une écharpe aux vingt couleurs (le vert de certains
clubs en fait partie) : fond magenta.

Le lien en jeu (à coder après validation) : AN61 à AN63 se lient aux équipes
nationales d'Angleterre (masculine, féminine, espoirs : leurs identifiants
API-Football sont à lire dans `teams` en production) ; AN64 à AN66 ne sont
liées à aucune équipe mais au championnat (choix de Gaël du 28 octobre) :
le bonus de lien joue dans tout match de Premier League (compétition 39) du
club que le joueur soutient.

## Réglages et coût

Pour chacune : une carte `AN6x.png` (Nano Banana 2, texte vers image, 9:16,
2K) puis une planche `AN6x-e1-base-planche.png` (image vers image, référence
= la carte). Fichiers dans `art/AN6x/_src/`.

- **En crédits** (devis Artlist du 28 octobre) : carte 260 (2 variantes),
  planche 4K 200, soit **460 par légendaire et 2 760 pour les six**. Les trois
  skins plus tard : 600 de plus par légendaire (3 600 pour les six).
- **En mode rapide gratuit** (site Artlist, Unlimited, 2K) : carte à 1
  variante et planche en deux demi-planches 16:9 2K (A : neutre, joie, dépit ;
  B : pousse, colère, yeux fermés), **0 crédit**, en vérifiant le solde après
  chaque légendaire.

Prompt de la carte, dans l'ordre de `00-METHODE.md` : `A legendary character
for a football supporters' card game.`, STYLE, IDENTITÉ, LÉGENDAIRE,
`Theme: ` + la ligne Légendaire, POSE (ou la pose propre de la fiche), FOND,
INTERDITS. Planche : comme une planche d'âge, la ligne Légendaire en `Theme:`.

---

## Les équipes nationales

### AN61 · La Dame des Falaises Blanches · légendaire · fond vert

Taillée dans la craie des falaises du sud, elle guette le retour de la
sélection depuis toujours, sa lanterne allumée pour chaque bateau qui rentre.

**Mythe : la géante de craie des falaises blanches, gardienne du retour au pays.**

Couleurs : blanc, bleu marine, rouge (sélections d'Angleterre).

```
IDENTITÉ: A tall, serene woman with pale skin veined like white chalk, a long calm face with strong cheekbones, deep navy-blue eyes and long white hair braided with thin dark flint stones. She never wears a football shirt. Around her neck a knitted football supporter's bar scarf in white with navy (#13294B) bars and one thin red (#CE1124) line, plain knit with no text and no crest, worn close to the body. Her signature item is a lighthouse lantern of navy-blue (#13294B) iron and glass held in one hand: keep exactly this colour.
```

- Légendaire : `A living giantess carved from a white chalk cliff: her long gown falls in sheer white chalk folds streaked with dark flint bands, edged at the hem with breaking sea foam frozen in white marble, a navy-blue cloak embroidered with gold waves held close to her shoulders, a small red cross of Saint George on white enamel set as a brooch at her collar. Crowning element: a tall arc of white cliff edges rising behind her head and shoulders like a jagged chalk crown, a tiny gold lighthouse light shining at its top. Golden light (#FFC23D) glowing from inside the lantern and along the chalk veins of her arms and face, staying on the body. Gold leaf on the lantern's iron frame, the navy and white scarf wound once around her shoulders, bare white feet on a small slab of chalk, a calm protective gaze, mouth closed.`
- Pose : `Standing tall facing the viewer, the lantern held up close to her chest in one hand, the other hand open at her side, calm protective expression, mouth closed. Correct anatomy: exactly two arms, two legs, two hands with five fingers each.`
- Skins :
  - Halloween : `A ghost lighthouse keeper of the cliffs: a tattered purple-and-orange shawl over the chalk gown, the lantern glowing behind a carved pumpkin pane, little bats folded into her flint braids.`
  - Préhistorique : `The chalk goddess of the first tribes: a cloak of white goat hide on her shoulders, flint and bone beads in her braids, the lantern rebuilt as a navy-painted stone bowl holding a small fire.`
  - Apocalyptique : `A wasteland coast watcher: a navy shoulder plate cut from a car bonnet, the lantern rebuilt from a chrome truck headlamp on a chain, dusty goggles pushed up in her white hair, the chalk gown wrapped in seatbelt straps.`

Histoire (jeu) : *« Elle a vu partir tous les bateaux. Elle n'en a jamais laissé un rentrer dans le noir. »*
Cri : `LA LANTERNE EST ALLUMÉE`

### AN62 · Le Chevalier à la Croix Rouge · légendaire · fond vert

Le chevalier de la vieille légende du pays, descendu du vitrail pour porter
le drapeau blanc à croix rouge devant toute la tribune.

**Mythe : saint Georges, le chevalier du drapeau, vivant dans un vitrail.**

Couleurs : blanc, rouge, bleu marine (sélections d'Angleterre).

```
IDENTITÉ: A tall, broad-shouldered knight with warm light-brown skin, a short dark beard, a strong square jaw, steady dark eyes and short dark hair. He never wears a football shirt. Around his neck a knitted football supporter's bar scarf in white with red (#CE1124) bars, plain knit with no text and no crest, worn close to the body. His signature item is a long lance used as a flagpole, flying a plain white flag with a red cross (#CE1124) of Saint George, held upright close to his body: keep exactly these colours.
```

- Légendaire : `A living stained-glass knight stepped out of a cathedral window: armour of polished silver plates with thin gold engravings, a long white surcoat with the red cross of Saint George down the front, embroidered at the hem with gold thread, its folds made of white glass panes outlined in dark lead lines that glow from within. Crowning element: a fan of five tall white-and-red pennants rising behind his shoulders like the rays of a stained-glass rose window, readable at thumbnail size. Golden light (#FFC23D) shining through the glass of his surcoat and along the edges of his armour, staying on the body. The lance-flag held upright beside him, its flag rippling close to the pole, the white-and-red scarf over his breastplate, a navy-blue cloak lined with gold close to his back, head bare, noble calm face, mouth closed. No dragon, no sword, no shield with a crest.`
- Pose : `Standing tall facing the viewer, the lance-flag held upright close to his body in one hand, the other hand resting on his belt, proud calm expression, mouth closed. Correct anatomy: exactly two arms, two legs, two hands with five fingers each.`
- Skins :
  - Halloween : `A headless-horseman look worn for fun: a tattered purple-and-orange cape over the armour, the flag edged with little stitched bats, a small carved pumpkin hung at his belt, his own face still there.`
  - Préhistorique : `The first standard-bearer of the tribes: armour rebuilt in hardened leather and bone plates, the white surcoat in pale hide with a red ochre cross, the lance a long ash branch with a hide flag.`
  - Apocalyptique : `A road knight of the wasteland: armour plates cut from dented car doors, a shoulder pad made from a chrome hubcap, the lance welded from exhaust pipes, the white flag dusty but its red cross still bright.`

Histoire (jeu) : *« On l'a vu sortir du vitrail un soir de qualification. Il a planté le drapeau au premier rang et n'est jamais remonté. »*
Cri : `LEVEZ LA CROIX`

### AN63 · Le Bouledogue au Grand Tambour · légendaire · fond vert

Le chien têtu du pays, coulé dans le bronze, qui bat le grand tambour de la
fanfare des supporters dans tous les stades du monde.

**Mythe : le bouledogue de bronze, l'entêtement du pays fait statue vivante.**

Couleurs : blanc, bleu marine, rouge (sélections d'Angleterre).

```
IDENTITÉ: An anthropomorphic English bulldog standing upright on its hind legs: a broad wrinkled face, a heavy underbite with two small lower teeth showing, short bowed legs, a barrel chest, small folded ears, coat in brindle and white. It never wears a football shirt. Around its neck a knitted football supporter's bar scarf in white with navy (#13294B) and red (#CE1124) bars, plain knit with no text and no crest. Its signature item is a big marching bass drum in navy-blue (#13294B) with white rims and red tension cords, worn on a harness at its belly, with two padded drumsticks: keep exactly this colour.
```

- Légendaire : `A living bronze statue of an enormous bulldog, as big as a monument: its coat turned to dark polished bronze with brindle streaks of gold leaf, the white patches of its chest in white marble, a short navy-blue band-master's jacket with white braiding and gold buttons open over its barrel chest. Crowning element: a tall arc of small red-and-white Saint George pennants on thin gold poles rising behind its shoulders like a fan, readable at thumbnail size. Golden light (#FFC23D) glowing from its eyes and from inside the drum, along the drum's gold-engraved rims, staying on the body. The huge navy drum strapped at its belly, two gold-capped drumsticks in its front paws, the scarf around its thick neck, a stubborn unshakeable stare, mouth closed over its underbite. No lion, no crown, no crest.`
- Pose : `Standing upright on its hind legs facing the viewer, the drum at its belly, the two drumsticks held close to the drum, stubborn proud expression, mouth closed. Correct anatomy: exactly two arms (front legs), two hind legs, one head, no extra limbs.`
- Skins :
  - Halloween : `A trick-or-treat bulldog: a small witch hat between its ears, the drum painted like a carved pumpkin, a tattered purple-and-orange cape on its bronze back.`
  - Préhistorique : `The war-drum dog of the first tribes: the drum rebuilt in stretched hide on a hollow log, bone drumsticks, a collar of teeth and amber beads instead of the band jacket.`
  - Apocalyptique : `A wasteland convoy drummer: the drum rebuilt from an oil barrel with tyre-rubber skins, drumsticks made of spark-plug-tipped pipes, a studded leather harness and goggles on its brow.`

Histoire (jeu) : *« Il ne sait jouer qu'un seul rythme. Il le joue depuis cent ans, et il ne compte pas changer. »*
Cri : `ON NE LÂCHE RIEN`

---

## Le championnat, sans club

### AN64 · La Tisseuse des Vingt Écharpes · légendaire · fond magenta

Personne ne l'a jamais vue tricoter, mais chaque été, vingt écharpes neuves
pendent à son métier, une par tribune du pays.

**Mythe : la fileuse du destin de la saison, qui tisse ensemble toutes les tribunes.**

Couleurs : vingt couleurs de clubs en bandes étroites, sur un fond d'or.

```
IDENTITÉ: A tall, ageless woman with deep brown skin, a long elegant neck, wise dark eyes with laugh lines and grey hair wound in a high crown of braids. She never wears a football shirt. Around her neck, falling to her knees, a long knitted supporter's scarf made of twenty narrow bars of different club colours side by side (red, white, sky blue, navy, claret, yellow, black, orange, royal blue, green), plain knit with no text and no crest. Her signature item is a pair of long golden knitting needles (#FFC23D), one in each hand, joined by a thread of many colours: keep exactly this colour.
```

- Légendaire : `A mythical weaver of fate, larger than life: a long gown of heavy embroidered wool whose skirt is made of dozens of striped scarf ends of every colour falling in layers, a deep plum velvet shawl with gold embroidery, rings of gold thread around her wrists. Crowning element: a tall fan of twenty upright scarf ends in twenty different colours spreading behind her head and shoulders like the spokes of a spinning wheel, readable at thumbnail size. Golden light (#FFC23D) glowing from the knitting needles and running along the threads that connect them to her gown, staying on the body. Marble-white spindle hanging at her belt, gold leaf on the tips of the needles, a knowing gentle smile with mouth closed. No trophy, no lion, no crown, no logo, no letters on any scarf.`
- Pose : `Standing tall facing the viewer, the two golden needles held crossed in front of her chest, the thread between them close to her body, serene knowing expression, mouth closed. Correct anatomy: exactly two arms, two legs, two hands with five fingers each.`
- Skins :
  - Halloween : `A cheeky witch of the knitting circle: a tall pointed hat knitted in purple and orange stripes, little knitted bats hanging from her scarf ends, the needles tipped with tiny pumpkins.`
  - Préhistorique : `The first weaver of the tribes: a gown of woven reeds and dyed hide strips in many colours, bone needles, a spindle of polished stone, a shawl of soft fur.`
  - Apocalyptique : `A wasteland weaver: her gown made of strips of coloured seatbelts and cut tarpaulin, needles made from two long chrome car antennas, a shoulder piece cut from a hubcap.`

Histoire (jeu) : *« Elle tricote les vingt d'un même fil. Le jour où quelqu'un tire trop fort, c'est toute la saison qui se défait. »*
Cri : `TOUS DU MÊME FIL`

### AN65 · La Voix des Résultats · légendaire · fond vert

Chaque samedi à cinq heures, une voix lit les scores du pays entier, et rien
qu'à sa manière de prononcer le premier nom, toute la tribune sait déjà.

**Mythe : la voix du samedi soir, faite d'ondes radio et de bande de téléscripteur.**

Couleurs : bleu nuit, crème, or.

```
IDENTITÉ: A tall, thin, dignified man of indeterminate age with light olive skin, a long lean face, a neatly trimmed grey moustache, calm grey eyes and silver hair combed back. He never wears a football shirt. Around his neck a knitted supporter's bar scarf in midnight blue (#1B2A49) with cream bars, plain knit with no text and no crest. His signature item is an old radio ribbon microphone in midnight blue (#1B2A49) and chrome, held in one hand: keep exactly this colour.
```

- Légendaire : `A mythical figure made half of voice: a long midnight-blue three-piece suit with cream pinstripes, its lower half and coat tails dissolving into long ribbons of blank cream teleprinter paper that wrap around his legs and swirl close to his body, rows of small round glowing holes punched along them, no letters and no numbers on them. Crowning element: three concentric arcs of golden radio sound waves rising behind his head like a fan, readable at thumbnail size. Golden light (#FFC23D) glowing from the microphone grille and along the edges of the paper ribbons, staying on the body. A gold-rimmed pocket watch on a chain, gold leaf on the microphone's frame, the scarf over his lapels, a perfectly composed face, mouth closed. No text, no score, no numbers anywhere.`
- Pose : `Standing tall facing the viewer, the microphone held at chest height in one hand, the other hand lightly raised as if calling for silence, composed expression, mouth closed. Correct anatomy: exactly two arms, two legs, two hands with five fingers each.`
- Skins :
  - Halloween : `A ghost radio announcer: a tattered purple-and-orange cape over the suit, the paper ribbons cut with little bat shapes, a small carved pumpkin on the microphone stand.`
  - Préhistorique : `The voice of the tribes' fires: a long cloak of dark hide with pale stitched stripes, the microphone rebuilt as a carved horn of bone, the paper ribbons become strips of birch bark.`
  - Apocalyptique : `A wasteland radio man: a suit patched with tyre rubber, a shoulder pad made from an old car speaker, the microphone welded from chrome exhaust parts, cables and antenna wire wound around his legs.`

Histoire (jeu) : *« Il n'a jamais haussé le ton. Il n'en a jamais eu besoin : on entend la victoire dans sa façon de dire le nom de la ville. »*
Cri : `SCORE FINAL`

### AN66 · Le Rouge-Gorge du Lendemain de Noël · légendaire · fond vert

Le lendemain de Noël, quand tout le pays va au stade, un rouge-gorge géant se
pose sur le toit de la tribune et la réchauffe de son poitrail.

**Mythe : l'oiseau du cœur de l'hiver, poitrail de braise, gardien du match du lendemain de Noël.**

Couleurs : rouge-orangé, brun, blanc de neige.

```
IDENTITÉ: An anthropomorphic European robin standing upright: a round body, a bright orange-red breast (#E8562A), soft brown back and wings, a white belly, thin legs, a small sharp beak and shiny black eyes. It never wears a football shirt. Around its neck a knitted supporter's bar scarf in brown with cream bars, plain knit with no text and no crest. Its signature item is a winter football in bright orange (#FF7A00), the kind used in snow, held under one wing: keep exactly this colour.
```

- Légendaire : `A giant mythical robin of the deep winter, as tall as a man: its orange-red breast glowing like embers in a hearth, its brown wing feathers edged with frost and fine gold leaf, its white belly shimmering like fresh snow over marble. Crowning element: a tall crest of golden frost crystals rising from its head and shoulders like a crown of ice needles, readable at thumbnail size. Golden light (#FFC23D) glowing from inside its breast and along the frost on its feathers, staying on the body. The bright orange winter football held under one wing, stitched with gold thread, the brown and cream scarf around its neck dusted with snow, its feet gripping a small slab of white marble, mouth (beak) closed. No holly, no leaves, no green.`
- Pose : `Standing upright facing the viewer, the orange winter football tucked under one wing, the other wing folded against its body, proud warm expression, beak closed. Correct anatomy: exactly two wings, two legs, one head, no extra limbs.`
- Skins :
  - Halloween : `A trick-or-treat robin: a small witch hat on its crest, the winter ball painted as a carved pumpkin, a tattered purple-and-orange scarf.`
  - Préhistorique : `The ember bird of the cave tribes: a collar of bone beads and amber, the winter ball rebuilt as a round bundle of orange-dyed hide stuffed with straw, frost crest of white bone shards.`
  - Apocalyptique : `A wasteland winter scout: tiny aviator goggles on its brow, a shoulder plate cut from an orange traffic light lens, the ball wrapped in tyre tread, a scarf of dusty seatbelt webbing.`

Histoire (jeu) : *« Il n'arrive qu'au plus froid de l'année. Les soirs où il se pose sur le toit, personne dans la tribune n'a froid. »*
Cri : `CHAUD DEVANT`
