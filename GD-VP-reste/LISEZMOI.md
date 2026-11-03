# Ce qui manque encore à GD et VP, prompts prêts (2026-11-03)

Fil « Préparer les fiches et prompts GD et VP ». Rien n'a été généré : ce dossier prépare tout pour le jour où on relance les images (mode rapide gratuit d'Artlist en priorité, consigne de Gaël du 2026-11-03).

Relevé fait sur `public/img/fanzzy/index.json` et `public/ultime.js` de main (42d0c63).

## L'état

| | GD · Les Galères de déplacement | VP · Les VIP |
|---|---|---|
| Fiches dans le jeu (cinq langues) | 50, dans main | 50, dans main |
| Cartes et planches de base | 49 sur 50 (GD32 refusée par le filtre) | 50 sur 50 |
| Skins (Halloween, Préhistorique, Apocalyptique) | 358 sur 411 ; 53 ratés (pas 6 figures) ; 9 de GD32 | 296 sur 420 ; 124 manquent |
| Skins qui clignent | 0 | 0 |
| Âges de base qui clignent | 39 sur 137 | 41 sur 140 |
| Ultimate (images) | 140 sur 140 | 140 sur 140 |
| Clips Ultimate | 140 sur 140 | 0 sur 140 |
| Ultimate en skin (3 tenues) | 0 sur 420 | 0 sur 420 |

Les 20 skins GD à « échelle fausse d'une figure » sont dans le jeu (une figure plus petite ou plus grande) ; ils ne sont pas dans la liste ci-dessous.

## Les prompts de ce dossier

1. **gd32/** (9) : GD32 « Le Bouchon » en version adoucie pour passer le filtre : « traffic jam » devient une caravane de petites voitures-jouets, le nuage d'échappement devient un petit nuage blanc, le masque sculpté devient un masque de défilé en tissu. Même dragon, mêmes feux rouges. Cartes `GD32-e1/e2/e3`, puis demi-planches `GD32-pl-e<âge>A/B`. Ses 9 skins viendront après, avec les prompts de `series-prompts:GD-skins/`.
2. **skins-a-refaire/** (177 skins = 354 demi-planches) : chaque planche de skin manquante coupée en deux demi-planches 16:9 de 3 figures, comme les planches de base (A : repos, joie, dépit ; B : pousse, colère, yeux fermés). Le modèle se trompait sur 6 figures ; sur 3, il réussit presque toujours, et la 2K du mode gratuit reste nette. Découpe : `npm run planche` avec `--ordre neutre,joie,depit` puis `--ordre pousse,colere,- --repos <neutre de A>`. Référence : la carte de base de l'âge (colonne `reference`). Fond vert pour GD, magenta ou vert pour VP (colonne `fond`).
3. **ultimate-skins/** (840) : l'Ultimate de chaque Fanzzy en Halloween, Préhistorique et Apocalyptique, fond transposé dans l'ambiance du skin (même recette que RP et AN, `ULT-generation/build-skins.mjs`). Référence : `public/img/fanzzy/<ID>/e<âge>/<skin>/neutre.png`. **654 sont prêtes** ; 186 attendent que leur skin soit dessiné (colonne `skin_dans_le_jeu`).
4. **clips-vp/** (140) : les clips Ultimate de VP, même modèle que RP, AN et GD (Veo 3.1 Lite I2V, 4 s, 9:16, 720p sans son), la ligne de l'âge remplacée, la ligne « garde l'objet en main » incluse ; les 5 légendaires ont la ligne légendaire.

`build.mjs` refait les dossiers 2 à 4 à partir de `series-prompts`, de l'index de main et de `gd-sources:skins-a-refaire.tsv` (voir l'en-tête du script).

## Combien ça coûte

| Lot | Images | Mode gratuit | En crédits |
|---|---|---|---|
| GD32 (cartes + planches) | 9 | ~1 h | ~1 200 |
| Skins à refaire (demi-planches) | 354 | ~1 jour de quota | ~46 000 |
| Ultimate en skin prêtes | 654 | ~1 jour et demi | ~85 000 |
| Clips Ultimate VP | 140 vidéos | pas de mode gratuit pour la vidéo | ~35 000 (252 l'un) |

Le quota gratuit (~600 images par jour) est partagé avec la série HC, prioritaire pour le PASS 1 du 1er décembre. Aucune génération en crédits sans l'accord écrit de Gaël sur le coût.

## Ordre proposé

GD32 d'abord (elle débloque ses 9 skins et 9 Ultimate en skin), puis les skins à refaire, puis les Ultimate en skin, et les clips VP seulement sur accord en crédits. Le clignement des skins se fait après, sur les planches B (figure « yeux fermés »).
