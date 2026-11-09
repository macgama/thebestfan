# Ultimate MT « Les Phénomènes météo » : invites

Fonds écrits le 2026-11-08 dans `decors-mt.json` (3 par lignée, 1 par légendaire MT9-MT13),
tirés du fil d'évolution de chaque fiche (fanzzy-prompts/SERIES-50/MT-les-phenomenes-meteo.md).

- `base/` : 140 invites `<ID>-ult-e<âge>.txt`, référence = carte de l'âge (`<ID>.png`, `<ID>B.png`, `<ID>C.png`), liste dans `base/liste.tsv`.
- `halloween/`, `prehistorique/`, `apocalyptique/` : 140 invites chacune `<ID>-e<âge>-<tenue>.txt`, référence = `public/img/fanzzy/<ID>/e<âge>/<tenue>/neutre.png` (clone tbf-mt), liste dans `<tenue>/liste.tsv`. Même pose et même fond que la base, transposé dans l'ambiance de la tenue.

Recette : Nano Banana 2 I2I, 9:16, 2K, 1 variante, mode rapide « Unlimited » (gratuit). Fichier rendu :
`art/ultime/_src/<clé>.png` (clé `MT1-e1` pour la base, `MT1-e1-halloween` pour une tenue), puis `npm run ultime:images`.
Clips : Veo 3.1 Lite I2V, 9:16, 720p, 4 s, sans son, depuis l'image Ultimate ; `art/ultime/_src/<clé>.mp4`.
Refaire les invites : `node build-series.mjs MT` puis `node build-skins-mt.mjs <tenue>` (dans fanzzy-prompts/ULT-generation).
