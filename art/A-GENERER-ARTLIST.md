# Images à générer sur Artlist — à faire à la main

*4 octobre 2026. Partage décidé par Gaël : **Claude génère toutes les images
du jeu, sauf les Fanzzy**, que Gaël produit lui-même pour le moment. Ce fichier
garde les invites, l'outil et ses attributs, pour qu'une image puisse être
refaite à l'identique par l'un ou l'autre.*

**État au 4 octobre 2026 au soir** : le foulard, la corde et les silhouettes
sont générés (830 crédits), rangés dans `art/arene/_src/`, à brancher au lot 6.
Le sachet de LA REPRISE et le tunnel sont faits depuis le 3 octobre.

## Comment faire, pour chaque image

1. Sur Artlist, ouvrir l'outil indiqué (**Nano Banana 2** partout ici), régler
   les attributs comme dans le tableau de l'image, coller l'invite **en
   entier** (la dernière ligne, « no text, no letters… », est obligatoire :
   voir `VISUELS.md`).
2. **Regarder chaque résultat avant de le garder.** Le générateur ajoute
   volontiers des lettres sur une étiquette, un écusson sur une manche, un
   motif sur une écharpe. S'il y en a, régénérer plutôt que retoucher.
3. Télécharger **les deux meilleures** en PNG et les déposer dans le dossier
   indiqué, sous le nom indiqué (`-1`, `-2`). Ces dossiers `_src/` sont ignorés
   par git : rien n'est commité par mégarde.
4. Me dire « c'est déposé » : je choisis, je détoure, je réduis aux formats du
   site et je branche, sans repasser par Artlist.

Prix relevé le 3 octobre 2026 : **130 crédits par image** en 2K, moins en 1K.

---

## 1. Le foulard noué — à faire (lot 6)

Le nœud qui monte et descend sur la corde du Virage et du duel. Il est dessiné
**neutre** (crème et gris, sans motif), parce que le jeu le teint aux couleurs
du camp qui mène. Le fond vert sert au détourage : je le retire ensuite.

| Outil | Mode | Format (aspect ratio) | Résolution | Nombre d'images |
|---|---|---|---|---|
| Nano Banana 2 | Text to Image (T2I) | 1:1 | 2K | 4 |

Déposer dans : `art/arene/_src/foulard-noeud-1.png`, `foulard-noeud-2.png`

```
a single knitted football supporter scarf tied into one tight round knot, two short fringed ends hanging down from the knot, chunky wool, plain undyed cream and light grey only, no stripes, no pattern, slightly worn. Style: stylised 3D game item icon, modern mobile game art, chunky readable silhouette, bold simplified shapes, clean edges, soft key light with a strong cool rim light separating the object from the background, painterly texture. NOT photorealistic. Composition: the object alone, centred, filling most of the frame, seen at a slight three-quarter angle, floating. Background: a completely flat, uniform, saturated studio green (#00B140), the exact same colour everywhere. No gradient, no vignette, no floor, no surface, no cast shadow, no reflection, no green glow or green rim spilling onto the object itself. no text, no letters, no numbers, no logos, no brand marks, no club crests, no team names, no sponsor logos, no identifiable jerseys, no real people
```

À vérifier : un seul nœud, deux bouts frangés, **aucun motif ni rayure**, pas
de reflet vert sur la laine.

---

## 2. La corde tressée — une référence à décalquer (lot 6)

Cette image ne sera pas affichée telle quelle : je la décalque à la main en un
petit motif qui se répète sans couture (aucun générateur ne sait le faire).
Une image propre suffit.

| Outil | Mode | Format (aspect ratio) | Résolution | Nombre d'images |
|---|---|---|---|---|
| Nano Banana 2 | Text to Image (T2I) | 4:1 | 1K | 2 |

Déposer dans : `art/arene/_src/corde-reference-1.png`

```
Flat reference drawing of a short straight segment of thick three-strand twisted hemp rope seen from the side, drawn with one even black ink line weight and a flat beige fill, the twist repeating at a regular interval so it can be traced into a seamless tile, no shading gradients, no background texture, isolated on pure white. no text, no letters, no numbers, no logos, no brand marks, no club crests, no team names, no sponsor logos, no identifiable jerseys, no real people
```

À vérifier : trois brins, une torsion **régulière**, un trait d'encre égal.

---

## 3. Les silhouettes au pochoir — une référence à décalquer (lot 6)

Les foules des arènes : six poses de supporters en aplat noir, affichées de
10 à 40 px de haut et teintées aux couleurs du camp. Comme la corde, je les
décalque en dessin vectoriel.

| Outil | Mode | Format (aspect ratio) | Résolution | Nombre d'images |
|---|---|---|---|---|
| Nano Banana 2 | Text to Image (T2I) | 16:9 | 2K | 4 |

Déposer dans : `art/arene/_src/silhouettes-1.png`, `silhouettes-2.png`

```
Sheet of six anonymous football supporter silhouettes as solid black stencil shapes, full body, standing side by side on pure white, each in a distinct pose: both arms raised; holding a plain scarf stretched overhead; beating a bass drum; shouting into a megaphone; clapping with hands above the head; leaning back and pulling on a rope. No faces, no clothing details, plain shapes without any symbol, bold simple outlines readable at twenty pixels tall, stencil style with small bridges. no text, no letters, no numbers, no logos, no brand marks, no club crests, no team names, no sponsor logos, no identifiable jerseys, no real people
```

À vérifier : six poses **différentes** et lisibles en tout petit, aucun signe
sur l'écharpe, le tambour ou le mégaphone.

---

## 4. Le supporter d'en face — facultatif, pas maintenant

Décidé le 3 octobre (question Q7) : **on ne le fait pas au lot 6**. La foule au
pochoir dit déjà qui est en face. À ne générer que si la critique trouve
l'arène vide. Gardé ici pour plus tard.

| Outil | Mode | Format (aspect ratio) | Résolution | Nombre d'images |
|---|---|---|---|---|
| Nano Banana 2 | Image to Image (I2I), avec une image de référence | 9:16 | 2K | 4 |

Image de référence à téléverser : `public/img/supporter/push.png` (le même
personnage fictif, le même rendu).

Déposer dans : `art/supporter/_src/adverse-1.png`, `adverse-2.png`

```
Same stylised 3D cartoon young football supporter as the reference image, same proportions and rendering, full body, seen three-quarter front, leaning back and pulling hard with both hands on a thick braided rope that runs down toward the viewer, determined face. Plain light grey hoodie, plain light grey shorts, grey socks and worn sneakers, no stripes, no pattern, no badge, so the clothes can be tinted later. Even studio lighting, isolated on a completely flat, uniform, saturated studio green (#00B140) background, no floor, no cast shadow, no green spill on the figure. no text, no letters, no numbers, no logos, no brand marks, no club crests, no team names, no sponsor logos, no identifiable jerseys, no real people
```

---

## Ce qui n'est plus à générer

- **Le sachet de LA REPRISE** et **le tunnel de l'ouverture** : faits le
  3 octobre, sources dans `art/paquets/_src/` et `art/ecran/_src/`.
- **Le Fanzzy vivant en vidéo** : abandonné (les modèles vidéo ne gardent pas
  le personnage à l'identique). Il se fera en animant dans le jeu les images
  qui existent déjà, sans crédit.
- **Les états des Fanzzy** (`pousse`, `joie`, `depit`…) : ils suivent la
  production habituelle des personnages, dans sa propre conversation.
- **Les sons** : trois essais sont faits (la rumeur, le but, les tambours) ;
  il reste à les écouter et à dire lesquels on garde.
