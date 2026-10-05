# Lots 6 et 7 — les images et les vidéos à produire

*3 octobre 2026. Relevé fait dans le code (`public/`, `scripts/`), dans `art/`
et `public/img/`, et dans la direction FAIT MAIN (`images_a_produire`, écrans
`/virage` et `/duel-nvn`, maquette écrans 7 et 8). Le lot 6 **code les replis**
de tout ce qui suit ; il ne nomme aucune image tant qu'elle n'existe pas en
ses trois formats — une adresse demandée et absente a déjà vidé un écran.*

Les règles de `VISUELS.md` valent pour chaque image : aucun nom de marque,
aucun logo, aucun nom ni écusson de club, aucun maillot identifiable, **aucun
texte, aucune lettre, aucun chiffre**, aucune personne réelle ; des couleurs,
des décors génériques, des personnages fictifs aux vêtements usés. Chaque
invite finit par la formule du fichier. **Regarder chaque image avant de
l'intégrer** : les générateurs écrivent sur les bâches et cousent des écussons
même quand on le leur interdit — régénérer plutôt que retoucher. Artlist est
autorisé (3 octobre 2026 ; image Nano Banana 2 en 2K : 130 crédits ; boucle
vidéo à partir d'une image : 480 à 750 crédits) ; dire les crédits dépensés
dans le compte rendu. Les sources lourdes vont sous `art/**/_src/`.

## Ce qui manque, en un tableau

| # | image | pour | où elle sert | servi en | source dans `art/` | publiée par | état |
|---|---|---|---|---|---|---|---|
| 1 | le tunnel | lot 6 (repli), lot 7 | voile de choix du Virage, rideau de l'accueil, entrée du duel | 900 × 1600, AVIF, WebP, JPEG | `art/ecran/tunnel.png` | `npm run ecrans` — **chaîne à écrire** | à produire |
| 2 | le foulard noué | lot 6 (repli), lot 7 | le nœud des deux cordes | 256 × 256, AVIF, WebP, PNG (transparent) | `art/arene/foulard-noeud.png` | `npm run stuff`, **après ajout d'une famille `arene`** | à produire |
| 3 | la corde tressée | lot 6 (repli CSS), lot 7 | les deux cordes, le chemin de niveau, l'arbre des âges | SVG en ligne dans `ui.css` | — | aucune (dessin à la main) | à dessiner |
| 4 | les silhouettes au pochoir | lot 6 | foules du Virage, affiches, formats et tribunes du duel | six SVG en `mask-image` dans `ui.css` | — | aucune (dessin à la main) | provisoire au lot 6, définitif au lot 7 |
| 5 | le supporter d'en face | lot 7, si Q7 | l'arène du Virage, de l'autre côté de la corde | 448 × 900, AVIF, WebP, PNG (transparent) | `art/supporter/adverse.png` | `npm run ecrans` — chaîne à écrire | facultatif |
| 6 | le sachet de LA REPRISE | lot 7 | le kiosque (au centre, sous les projecteurs), les fentes de la réserve, la bande du HUD | 760 × 1352, AVIF, WebP, JPEG | `art/ecran/pack-la-reprise.png` | `npm run ecrans` — chaîne à écrire ; puis `RP` dans la table `ART` de `cartes.js` | **manque depuis les lots 3 et 5** |
| 7 | le Fanzzy vivant, pilote RP1 | après le lot 6 | la case de BD du but, la scène du Virage, le bilan | WebM VP9 à couche alpha, 480 × 720, et l'image fixe en repli | `art/RP1/_src/video/` | `npm run videos` — chaîne à écrire | pilote |
| 8 | les états des Fanzzy de LA REPRISE | en continu | la scène du Virage (`pousse`), le bilan (`joie`, `depit`) | chaîne existante | `art/<ID>/_src/` | `npm run art -- art/<ID>/_src` | production en cours ailleurs |

**Rien à produire pour** : les décors d'arène — les dix-huit stades ont leur
dessin en deux tailles (`img/stade/<id>` et `-mini`) et sont tous servis ; la
photo de tribune (`img/ecran/tribune`, 900 × 1600) ; les places vides
(`img/place-vide`) ; le dos de LA REPRISE (`img/dos/RP`, 520 × 780) pour la
carte-souvenir qui se retourne ; la bâche déployée du duel (`img/stuff/bache`) ;
les plaques de rareté (`img/fonds/RP-*`) ; les jetons (`img/gains/*`) ; le
supporter générique (`img/supporter/idle|push|goal|sad`, 448 × 900) ; les
vidéos du Cri (`video/cri.mp4`, `video/gerbe.mp4`).

**Demandé par la direction, mais plus nécessaire** : `bombe.svg` (les
missions ont leur vignette par lieu depuis les lots 3 et 5) ; les trois cernes
et le scotch en SVG (ils sont dans `ui.css` : `--trace-a` à `--trace-c`,
`--ruban-g`, `--ruban-d`, `--ruban-k`) ; les tuiles de toile, de papier et de
béton (calculées par `npm run grain`, jamais générées).

**Les chaînes à écrire** (lot 7, une demi-journée chacune) :
- `scripts/ecran-images.mjs`, `npm run ecrans` : trois listes, sur le modèle
  de `stuff-images.mjs` — **ÉCRANS** (opaques, recadrés en 900 × 1600, AVIF
  seulement s'il gagne, WebP, JPEG → `public/img/ecran/`), **SACHETS** (760 ×
  1352 → `public/img/pack-<nom>.*`), **FIGURES** (détourées par
  `detourage.mjs`, 448 × 900 → `public/img/supporter/`). Elle régularise au
  passage `img/ecran/tribune`, `img/place-vide` et les douze sachets, qui
  n'ont aucune chaîne aujourd'hui ;
- dans `scripts/stuff-images.mjs`, une troisième famille, `arene`
  (`art/arene/` → `public/img/arene/`), comme les gains : « un détourage
  délicat s'écrit une fois » ;
- `scripts/fanzzy-videos.mjs`, `npm run videos` : la clé de chrominance
  (`chromakey`, `despill`) et l'encodage VP9 à couche alpha (`libvpx-vp9`,
  `yuva420p`), tous deux présents dans le ffmpeg du poste (relevé le
  3 octobre 2026 ; pas de libx264, voir la mémoire du poste), vers
  `public/video/fanzzy/<ID>/e<âge>/<tenue>/<état>.webm`, plus un manifeste.

---

## 1. Le tunnel

**Où.** Le voile de choix du Grand Virage (`public/virage.html`, `#veil`) : en
fond, assombri, sous le titre peint et les affiches des matchs ; le rideau
d'ouverture de l'accueil (`public/index.html`, `.ouverture .tunnel`), qui le
dessine aujourd'hui en quatre pans de béton CSS ; l'entrée de l'arène du duel.
**Repli au lot 6** : `img/ecran/tribune` à 25 % sous un voile.

**Format.** Portrait 9:16, source en 2K (par exemple 1152 × 2048), servi en
900 × 1600 comme `img/ecran/tribune` ; affiché plein écran de 360 × 640 à
768 × 1024, recadré en `cover`, le point d'intérêt (la sortie lumineuse) au
tiers haut. **L'image va dans un calque intérieur, jamais sur `.ouverture`
ni sur `#veil` eux-mêmes** : `accueil:ui` et l'audit exigent un fond opaque
d'une seule couleur sous les textes du rideau, et un texte posé sur une photo
devient non mesurable. Les textes restent sur leurs bâches et leurs tickets.

**Invite.**

```
Vertical 9:16 painterly-realistic illustration of a dark concrete players'
tunnel beneath a football stadium, seen from inside at eye level. Rough grey
concrete walls and ceiling with exposed beams converge toward a bright white
floodlit opening at the far end, placed in the upper third of the frame; a
few worn concrete steps lead up to it. Plain, completely blank canvas
tarpaulins hang flat on both walls, held by tape, in cream, deep red and dark
navy, with nothing printed or painted on them. Steel crowd-control barriers
along one wall, a bass drum resting on the floor, low smoke drifting at
ground level and catching the light, wet concrete reflections, cool shadows
and a warm white glow from the exit. Cinematic, moody, high contrast, empty
of people, the lower half dark and uncluttered so interface elements can sit
on it. no text, no letters, no numbers, no logos, no brand marks, no club
crests, no team names, no sponsor logos, no identifiable jerseys, no real
people
```

C'est l'image la plus risquée : trois à six générations, le générateur aime
écrire sur les bâches. Le repli CSS reste acceptable en soi.

## 2. Le foulard noué

**Où.** Le nœud de la corde du Virage (aujourd'hui `#knot`, un disque gris
qui porte un chiffre) et du duel (`#noeud`) : il monte et descend avec la
corde ; teinté aux couleurs du camp qui mène par un dégradé posé en
`multiply`. **Repli au lot 6** : un rond craie cerné d'encre, à rayures
d'écharpe.

**Format.** Affiché à 48 px au Virage, à 40 au duel ; servi en 256 × 256
transparent, comme toute pièce de `stuff-images.mjs`. Dessiné **neutre**
(crème et gris clair, sans motif) pour que la teinte le prenne ; le nœud seul,
sans corde — la corde passe derrière, par le dessin de la page.

**Invite** (la forme de `stuff-images.mjs --invites` : le sujet, puis le style
et le fond communs de la chaîne).

```
a single knitted football supporter scarf tied into one tight round knot,
two short fringed ends hanging down from the knot, chunky wool, plain undyed
cream and light grey only, no stripes, no pattern, slightly worn.
Style: stylised 3D game item icon, modern mobile game art, chunky readable
silhouette, bold simplified shapes, clean edges, soft key light with a strong
cool rim light separating the object from the background, painterly texture.
NOT photorealistic. Composition: the object alone, centred, filling most of
the frame, seen at a slight three-quarter angle, floating. Background: a
completely flat, uniform, saturated studio green (#00B140), the exact same
colour everywhere. No gradient, no vignette, no floor, no surface, no cast
shadow, no reflection, no green glow or green rim spilling onto the object
itself. no text, no letters, no numbers, no logos, no brand marks, no club
crests, no team names, no sponsor logos, no identifiable jerseys, no real
people
```

## 3. La corde tressée

**Où.** La corde verticale du Virage (14 px de large), la corde horizontale du
duel, le chemin de niveau du profil (`.tbf-chemin`) et l'arbre des âges de la
fiche (`.tbf-ages`), qui la peignent aujourd'hui en CSS « tant que `corde.svg`
n'est pas produite » (`ui.css`). Une corde, un dessin.

**Format.** Une tuile SVG raccordable (par exemple 14 × 28, trois brins vrillés
d'encre sur le kraft), écrite en data-URI dans une variable de `ui.css` ; en
`mask-image` là où elle doit prendre une couleur (l'écharpe du chemin fait,
l'or de la minute double). **Dessinée à la main** : aucun générateur ne rend
une tuile qui se raccorde, et une couture se verrait tous les vingt-huit
pixels. L'invite ne sert qu'à obtenir une référence à décalquer.

**Invite** (référence à décalquer).

```
Flat reference drawing of a short straight segment of thick three-strand
twisted hemp rope seen from the side, drawn with one even black ink line
weight and a flat beige fill, the twist repeating at a regular interval so
it can be traced into a seamless tile, no shading gradients, no background
texture, isolated on pure white. no text, no letters, no numbers, no logos,
no brand marks, no club crests, no team names, no sponsor logos, no
identifiable jerseys, no real people
```

## 4. Les silhouettes au pochoir

**Où.** Les deux foules de l'arène du Virage (huit par camp au plus sous
400 px, allumées en proportion de `crowd`, en « pousse » quand le camp
chante) ; la frise de chaque affiche du voile ; les formats du duel (une à
cinq silhouettes par tuile) ; les tribunes du duel (une par joueur, qui
s'assoit quand il part) ; les sièges du vestiaire. **Au lot 6** : un premier
dessin, provisoire, fait par `feuilles-css`.

**Format.** Six silhouettes en aplat, chacune un SVG en data-URI posé en
`mask-image`, la couleur du camp en fond : rien à télécharger, une teinte par
camp. Affichées de 10 px (les formats) à 40 px de haut (la foule). Anonymes,
sans visage, sans drapeau ni signe sur ce qu'elles tiennent.

**Invite** (référence à décalquer).

```
Sheet of six anonymous football supporter silhouettes as solid black stencil
shapes, full body, standing side by side on pure white, each in a distinct
pose: both arms raised; holding a plain scarf stretched overhead; beating a
bass drum; shouting into a megaphone; clapping with hands above the head;
leaning back and pulling on a rope. No faces, no clothing details, plain
shapes without any symbol, bold simple outlines readable at twenty pixels
tall, stencil style with small bridges. no text, no letters, no numbers, no
logos, no brand marks, no club crests, no team names, no sponsor logos, no
identifiable jerseys, no real people
```

## 5. Le supporter d'en face (facultatif, Q7)

**Où.** L'arène du Virage, côté adverse : il tire la corde en face du Fanzzy du
joueur, teint aux couleurs d'en face. Le supporter existant (`img/supporter/push`)
porte un maillot rayé rouge et blanc fixe et ne tire rien : il ne se teint pas.

**Format.** Environ 115 px de haut (45 % d'une arène de 256) ; servi en 448 ×
900 transparent, comme les quatre poses existantes. Vêtements gris clair unis
pour que la teinte prenne. Générer en image à partir de
`public/img/supporter/push.png` (le même personnage fictif, le même rendu).

**Invite.**

```
Same stylised 3D cartoon young football supporter as the reference image,
same proportions and rendering, full body, seen three-quarter front, leaning
back and pulling hard with both hands on a thick braided rope that runs down
toward the viewer, determined face. Plain light grey hoodie, plain light grey
shorts, grey socks and worn sneakers, no stripes, no pattern, no badge, so the
clothes can be tinted later. Even studio lighting, isolated on a completely
flat, uniform, saturated studio green (#00B140) background, no floor, no cast
shadow, no green spill on the figure. no text, no letters, no numbers, no
logos, no brand marks, no club crests, no team names, no sponsor logos, no
identifiable jerseys, no real people
```

## 6. Le sachet de LA REPRISE

**Où.** Au centre du kiosque de production (`public/boosters.html`), sur son
socle, sous deux cônes de projecteur : c'est aujourd'hui le repli dessiné par
le code, une carte plate, parce que `pack-la-reprise` n'est pas dans la table
`ART` de `public/cartes.js`. Aussi dans les fentes de la réserve et la bande du
HUD (`--sachet`).

**Format.** 760 × 1352, opaque, comme les douze sachets existants
(`img/pack-<nom>`) ; affiché de 170 à 220 px de large au kiosque, une vignette
dans les fentes. Générer **en image à partir de `public/img/pack-la-tribune.jpg`**
pour garder le cadrage, la lumière et le gaufrage des douze autres. Les
couleurs sont celles de la série : `#C7563A` (rouille) et `#1A1210` (brun
presque noir) — « la première journée, et rien n'a le même son qu'en mai ».

**Invite.**

```
Same framing, lighting and wrapper shape as the reference image: a crimped,
sealed trading card foil pack standing upright, its foil a worn, scuffed
brown-black (#1A1210), a single diagonal band of brushed rust orange
(#C7563A) across the lower half, and in the middle a faint embossed abstract
shape suggesting an empty concrete stand at dawn, with no symbol and no
emblem. Two warm spotlights from the upper left and upper right, light
smoke, black background, photorealistic product shot. no text, no letters,
no numbers, no logos, no brand marks, no club crests, no team names, no
sponsor logos, no identifiable jerseys, no real people
```

## 7. Le Fanzzy vivant — le pilote RP1

**Où.** La case de BD du but (hub et Virage), la scène du Virage (`#fzs`) le
temps d'un moment, le bilan (la pose victoire ou défaite). Toujours avec
**l'image fixe en repli**, et jamais sous `prefers-reduced-motion` ni sous le
calme « animations » : l'image fixe y reste.

**Format.** Boucles de quatre secondes, muettes, sans fin, 480 × 720, WebM VP9
à couche alpha (après clé de chrominance sur le vert de studio), 600 Ko au plus
chacune ; affichées à la taille du personnage de la scène (de 150 à 380 px de
haut). Safari ne lit pas de façon sûre la couche alpha d'un WebM, et une
version HEVC à alpha ne s'encode pas sur ce poste : là, l'image fixe reste. Générées **en vidéo à partir de l'image** de l'état (`public/img/fanzzy/RP1/e1/base/<état>.png`
posée sur le vert), ce qui garde le personnage exact. Quatre boucles : `but`,
`pousse`, `joie` (victoire), `depit` (défaite).

**Invites** (une par boucle ; même préambule).

```
Image-to-video, 4-second seamless loop, from the provided character image
placed on a completely flat, uniform, saturated studio green (#00B140)
background. The stylised cartoon football supporter jumps with both fists in
the air, shouts with joy, lands and settles back exactly into the starting
pose so the loop is seamless. Camera locked, no camera movement, no zoom, the
background stays perfectly flat and uniform green, no green spill on the
character, no new objects. no text, no letters, no numbers, no logos, no
brand marks, no club crests, no team names, no sponsor logos, no
identifiable jerseys, no real people
```

Pour `pousse` : « leans forward and pushes with both arms extended as if
driving a heavy rope, four rhythmic efforts, then returns exactly to the
starting pose » ; pour `joie` : « raises both arms, sways from side to side
with a proud smile, then returns exactly to the starting pose » ; pour
`depit` : « drops his shoulders, shakes his head slowly, looks down, then
lifts his chin back exactly to the starting pose ». Chaque fois la même fin
d'invite, formule comprise.

## 8. Les états des Fanzzy de LA REPRISE

**Où.** La scène du Virage pousse avec l'état `pousse` du Fanzzy équipé, et le
bilan le montre en `joie` ou en `depit`. Tant qu'un état manque, la chaîne de
repli prend le plus proche (`FAMILLE` de `fanzzy-etats.js`) : rien ne casse,
le personnage a seulement le même visage au but et à la défaite.

**Format et chaîne** : ceux de la production des Fanzzy, inchangés — soixante
images par personnage (trois âges, quatre tenues, cinq expressions), sources
`art/<ID>/_src/<ID>-e<âge>-<tenue>-<état>.png`, `npm run art -- art/<ID>/_src`,
qui régénère `index.json`. Cette production a sa propre conversation et son
propre fichier de reprise ; le lot 6 n'en demande aucune image nouvelle.

**Invite** (gabarit, en image à partir de l'état `neutre` du même âge et de la
même tenue).

```
Same character as the reference image, same outfit, same age, same
proportions and same stylised 3D rendering, full body, new pose: leaning
forward and pushing hard with both arms extended in front of him, as if
driving a heavy rope, effort on his face. Isolated on the same background as
the reference. no text, no letters, no numbers, no logos, no brand marks, no
club crests, no team names, no sponsor logos, no identifiable jerseys, no
real people
```

(`joie` : « jumping with both fists raised, mouth open in a shout » ; `depit` :
« shoulders dropped, head down, hands hanging ».)
