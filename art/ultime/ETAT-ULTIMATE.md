# Ultimate : état des lieux

*28 octobre 2026. Relevé fait sur `public/ultime.js` (branche `claude/project-thread-z4jtwl`, à jour de `main`), le catalogue (`src/shared/fanzzy/`) et les branches de sources.*

Une Ultimate, c'est **une image et un clip par âge** :
- une lignée à trois âges demande 3 images (`<id>-e1`, `-e2`, `-e3`) et 3 clips ;
- une légendaire n'a qu'un âge, donc 1 image et 1 clip (`<id>-e1`).

Les images sont faites avec Nano Banana 2, en image vers image, au format 9:16 et en 2K. La référence est la carte de l'âge (`art/neuves/<id>.png`, `<id>B.png`, `<id>C.png`). Les clips font 4 s, en 9:16 et sans son. Sans fichier, le jeu montre la scène dessinée.

## En bref

| Série | Lignées | Légendaires | Images faites / à faire | Clips faits / à faire | État |
|---|---|---|---|---|---|
| **RP** · LA REPRISE | 30 | 5 | **95 / 95** | **95 / 95** | ✅ terminée |
| **AN** · LES TERRACES (base) | 60 | — | **3 / 180** | 0 / 180 | 🟡 en cours (images d'abord) |
| **AN** · légendaires AN61 à AN66 | — | 6 | 0 / 6 | 0 / 6 | ⏳ en attente des cartes au catalogue |
| **SU** · DIE KURVE | 36 | aucune prévue | 0 / 108 | 0 / 108 | ⏳ série en cours de création |
| Autres séries du catalogue | 191 | 65 | 0 / 638 | 0 / 638 | ⬜ pas commencé |
| Séries de championnat à venir | — | — | — | — | ⬜ pas encore conçues |

Il reste à faire **929 images et 932 clips**, sans compter les championnats à venir.

---

## RP · LA REPRISE : terminée ✅

- **Lignées** RP1 à RP12 et RP18 à RP35 (30) : 3 images et 3 clips chacune, soit 90 + 90.
- **Légendaires** RP13, RP14, RP15, RP16, RP17 : 1 image et 1 clip chacune, soit 5 + 5.
- Les sources sont dans `art/ultime/_src/` du dépôt principal (ignoré par git, à garder).

Rien à faire.

## AN · LES TERRACES : en cours 🟡

**Ordre décidé le 28 octobre : les 60 lignées de base d'abord, images seulement. Les clips viendront ensuite.**

| | Fait | À faire |
|---|---|---|
| Prompts (`origin/ult-an-prompts`, `prompts/AN<n>-ult-e<âge>.txt`) | 180 / 180 | — |
| Références (`art/neuves/AN<n>{,B,C}.png`) | 180 / 180 | — |
| Images | AN1-e1, AN1-e2, AN1-e3 (essai du 28 octobre, en mode Unlimited, sans crédit) | AN2 à AN60 : **177** |
| Clips | — | AN1 à AN60 : **180** |

Les 3 images AN1 sont sur la branche `claude/project-thread-z4jtwl`, pas encore fusionnée dans `main`.

> ⚠️ `scripts/ultime-images.mjs` réécrit IMAGES et CLIPS à partir du seul `art/ultime/_src/`. Lancé dans un dossier où ce répertoire ne contient pas toutes les sources (un worktree, par exemple), il efface les entrées RP. Lancez-le dans le dépôt principal, où toutes les sources sont présentes, ou vérifiez le diff (seules des lignes AN doivent s'ajouter).

### AN · les six légendaires (AN61 à AN66) ⏳

| ID | Nom | Carte | Planche de base | Skins | Au catalogue | Ultimate |
|---|---|---|---|---|---|---|
| AN61 | La Dame des Falaises Blanches | ✅ | ✅ | 3 ratés (apocalyptique, halloween, préhistorique) | non | à faire |
| AN62 | Le Chevalier à la Croix Rouge | ✅ | ✅ | 2 / 3 (apocalyptique ratée) | non | à faire |
| AN63 | Le Bouledogue au Grand Tambour | ✅ | ✅ | 3 / 3 | non | à faire |
| AN64 | La Tisseuse des Vingt Écharpes | ✅ | ✅ | 3 / 3 | non | à faire |
| AN65 | La Voix des Résultats | ✅ | ✅ | 1 / 3 (apocalyptique et halloween ratées) | non | à faire |
| AN66 | Le Rouge-Gorge du Lendemain de Noël | ✅ | ✅ | 3 / 3 | non | à faire |

Sources sur les branches `origin/an-legendaires-prompts` et `origin/an-legendaires-sources`.

Reste à faire pour l'Ultimate :
1. écrire les 6 prompts (règle des légendaires : lumière d'or `#FFC23D` collée au corps, pas d'âge 2 ni 3) ;
2. générer 6 images ;
3. générer 6 clips.

Les fiches doivent d'abord entrer au catalogue (`dex-terraces.js` ou `dex-legendes.js`).

## SU · DIE KURVE : série en cours de création ⏳

La série compte 36 lignées pour 12 clubs suisses : SU1 à SU24 sont des humains, SU25 à SU36 des créatures. Elle n'a **pas de légendaire** prévue.

| Étape | État |
|---|---|
| Fiches (`dex-kurve.js`) | écrites, sur la branche `claude/project-thread-8di81x`, pas dans `main` |
| Cartes des 3 âges (`art/neuves/SU<n>{,B,C}.png`) | 108 / 108 générées (dossier du dépôt principal) |
| Planches d'animation et skins | en cours (`origin/su-sources` : 324 planches listées) |
| Série ouverte en jeu | non (elle arrive fermée, à cocher dans une saison) |
| Prompts Ultimate | ⬜ à écrire (36 décors uniques, sur le modèle de `ult-an-prompts`) |
| Images Ultimate | 0 / 108 |
| Clips Ultimate | 0 / 108 |

## Autres séries du catalogue : pas commencé ⬜

Aucune n'a d'Ultimate. Les références d'âge pour l'image vers image ne sont pas encore rassemblées dans `art/neuves/` (seuls 8 fichiers TR y sont).

| Série | Nom | Lignées (3 âges) | Légendaires | Images = clips à faire |
|---|---|---|---|---|
| TR | LA TRIBUNE | 50 | 10 (TR12, TR28 à TR31, TR55 à TR59) | 160 |
| MS | LES MÉTIERS DU STADE | 28 | 5 (MS15, MS24, MS27 à MS29) | 89 |
| BG | LE BESTIAIRE DES GRADINS | 22 | 5 (BG18, BG24 à BG27) | 71 |
| RV | LES REVENANTS | 16 | 5 (RV2, RV10, RV12, RV18, RV20) | 53 |
| EP | LES ÉPOQUES | 14 | 5 (EP5, EP15, EP17 à EP19) | 47 |
| OB | CE QUI TRAÎNE AU STADE | 12 | 5 (OB13 à OB17) | 41 |
| VP | LES VIP | 10 | 5 (VP10 à VP14) | 35 |
| HC | LES HÉROS DU CANAPÉ | 10 | 5 (HC10 à HC14) | 35 |
| GC | LA GASTRONOMIE DE COMPTOIR | 9 | 5 (GC10 à GC14) | 32 |
| GD | LES GALÈRES DE DÉPLACEMENT | 9 | 5 (GD10, GD11, GD14 à GD16) | 32 |
| MT | LES PHÉNOMÈNES MÉTÉO | 9 | 5 (MT9 à MT13) | 32 |
| IM | LE VIRAGE IMPOSSIBLE | 2 | 5 (IM18 à IM22) | 11 |
| **Total** | | **191** | **65** | **638** |

Seules les cartes publiées sont comptées : les fiches `publie:false` (refaites, en attente) sont exclues.

## Séries de championnat à venir ⬜

`series-ligues.js` prévoit une série par championnat, sur le modèle de LES TERRACES (3 Fanzzy par club : une femme, un homme, une créature). Aujourd'hui, seule la Premier League (AN) est branchée, et DIE KURVE (SU) arrive. Les autres championnats (France, Italie, etc.) ne sont **pas encore conçus** : ni fiches, ni cartes, ni Ultimate.

Pour une série de N clubs, il faudra compter 3N lignées, soit 9N images et 9N clips, plus les légendaires éventuelles.

## Ordre proposé

1. **AN base, images** : AN2 à AN60, 177 images. ← maintenant
2. AN base, clips : 180.
3. AN légendaires : catalogue, puis 6 prompts, 6 images et 6 clips.
4. SU : 36 prompts, puis 108 images et 108 clips, quand la série est fusionnée.
5. Autres séries du catalogue, par ordre d'ouverture en jeu.
