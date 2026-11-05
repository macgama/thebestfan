# Kit visuel du PASS 2 (Apocalyptique) : 15 images + 3 cartes action + 10 stades

Validé par Gaël le 5 novembre 2026 (« ok pour tes propositions »). **Artlist en
mode rapide gratuit seulement** (Image, Nano Banana 2, interrupteur Unlimited
allumé, 1 variante, 2K au plus, jamais 4K). Vérifier le solde de crédits avant
et après : s'il baisse, tout arrêter.

## Bloc de style (au début de chaque prompt du kit)

`Stylized 3D game reward render, glossy "battle pass" item in the style of a premium mobile football fan game, post-apocalyptic wasteland theme like a friendly road-movie desert, rusty riveted metal, old tyres, welded pipes, dusty leather, welding sparks, warm rust accent color #B5462A, soft studio lighting, crisp edges, centered with a generous empty margin all around, no weapons, no skulls, no blood, no text, no letters, no numbers, no logo, `

Fond : **vert de studio uni #00B140** (détouré ensuite), sauf `p2-fond-desert`
(image pleine). Cadres : vert aussi **au centre**.

| fichier | format | prompt (après le bloc de style) |
|---|---|---|
| p2-badge.png | 1:1 | `a shield-shaped emblem cut from a dented rusty metal plate with big rivets around the edge, a large stencil-painted rust-red handprint in the middle, two crossed exhaust pipes behind it, flat pure green #00B140 background` |
| p2-badge-or.png | 1:1 | `the same shield-shaped riveted emblem but in polished gold chrome with shining gold rivets and a glowing rust-red handprint, crossed golden exhaust pipes behind it, flat pure green #00B140 background` |
| p2-cadre-profil.png | 4:5 | `a rectangular picture frame made of a worn black rubber tyre tread bent into a rectangle, rusty metal brackets and rivets at the corners, a few welding sparks, the frame border is thin (about 8% of the width), the whole inside of the frame and the outside are flat pure green #00B140` |
| p2-cadre-carte.png | 9:16 (recadré en 63:88) | `a tall trading-card border made of thin rusty welded pipes and bolts, small dented metal plates at the four corners, a faint rust-red glow along the welds, very thin border, the whole inside of the frame and the outside are flat pure green #00B140` |
| p2-fond-desert.png | 9:16 | `a vast orange desert at sunset seen from a dune, two old supporters' coaches half buried in the sand with scarves fluttering from their windows, leaning stadium floodlight poles in the distance, drifting dust, warm rust light, dark edges so text stays readable, empty lower third, full frame illustration, no characters` |
| p2-plaque-titre.png | 16:9 | `a long thin horizontal dented metal licence plate with rivets at both ends and rust on the edges, completely blank smooth middle for text, no letters or numbers at all, flat pure green #00B140 background` |
| p2-entree-portail.png | 16:9 | `a wide scrapyard gate made of corrugated metal sheets swinging open between two dented oil drums, welding sparks flying, seen from the front, flat pure green #00B140 background` |
| p2-icone-aura.png | 1:1 | `a round swirl of orange desert dust and bright welding sparks forming a ring, rust and orange, flat pure green #00B140 background` |
| p2-sticker-cle.png | 1:1 | `a cartoon adjustable wrench, as a die-cut sticker with a thick white outline, flat pure green #00B140 background` |
| p2-sticker-bidon.png | 1:1 | `a cartoon dented red fuel can with a little rust-and-cream football scarf tied on its handle, die-cut sticker with a thick white outline, flat pure green #00B140 background` |
| p2-sticker-pneu.png | 1:1 | `a cartoon chunky old tyre bouncing, little dust puffs, die-cut sticker with a thick white outline, flat pure green #00B140 background` |
| p2-sticker-lunettes.png | 1:1 | `cartoon round welding goggles with a leather strap, die-cut sticker with a thick white outline, flat pure green #00B140 background` |
| p2-icone-tenue-1.png | 1:1 | `simple leather aviator goggles and a small dusty neckerchief, laid out neatly, small and humble, flat pure green #00B140 background` |
| p2-icone-tenue-2.png | 1:1 | `a raised welding mask with leather straps on a patched dusty jacket with metal shoulder plates, laid out, flat pure green #00B140 background` |
| p2-icone-tenue-3.png | 1:1 | `a heroic wasteland survivor outfit: a riveted helmet with two little antennae, a long dusty coat with tyre-rubber shoulder pads, glowing rust-red seams, laid out, flat pure green #00B140 background` |

## Les 3 cartes action (dans le dépôt)
`node scripts/action-images.mjs --invites` donne les prompts de `a-mt-nitro`,
`a-mt-tempete-sable`, `a-mt-tole` ; images en 3:4 2K dans `art/action/<id>.png`.

## Les 10 stades (dans le dépôt)
`node scripts/stade-images.mjs --invites` ; ids `mt-*` et `fr-*` ; images dans
`art/stade/<id>.png` (3:4 2K, vue du dessus, pelouse verte, tribunes sombres).
