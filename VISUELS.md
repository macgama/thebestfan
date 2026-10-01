# Règles des visuels

Ces règles s'appliquent à **toute image ou vidéo générée** pour thebestfan.
Elles ne sont pas une préférence esthétique : elles évitent des problèmes de
droits qui coûteraient bien plus cher à réparer qu'à prévenir.

## Interdit, sans exception

- **Aucun nom de marque, aucun logo de marque.** Ni équipementier, ni sponsor,
  ni fabricant, ni rien qui ressemble à une marque existante.
- **Aucun nom de club, aucun écusson de club, aucun maillot identifiable.**
  Pas de blason, pas de rayures qui reproduisent un maillot connu, pas de
  bannière portant un nom réel.
- **Aucun texte, aucune lettre, aucun chiffre** dans les illustrations. Les
  générateurs produisent des mots approximatifs, et un mot approximatif sur un
  drapeau ressemble vite à un nom de groupe existant.
- **Aucune personne réelle**, joueur, entraîneur ou supporter identifiable.

## Autorisé

- Les **couleurs**, y compris celles qui évoquent un club, tant qu'aucun nom ni
  écusson ne les accompagne. Une écharpe bleu et blanc n'appartient à personne.
- Les **drapeaux nationaux**, uniquement pour les compétitions de sélections.
- Les décors génériques : béton, barrières, marches, projecteurs, fumée,
  fumigènes, mégaphones, tambours, bâches unies.
- Des **personnages fictifs**, avec vêtements usés et sans écusson.

## Formule à ajouter à chaque invite

À coller en fin de chaque invite, en anglais puisque c'est la langue des
générateurs :

```
no text, no letters, no numbers, no logos, no brand marks, no club crests,
no team names, no sponsor logos, no identifiable jerseys, no real people
```

## Après génération

Regarder l'image avant de l'intégrer. Les générateurs ajoutent spontanément des
écussons sur les vestes et des lettres sur les bannières, même quand on le leur
interdit. Si c'est le cas, régénérer plutôt que retoucher.

## Les dos de carte

Un dos par série, dans `art/dos/<CODE>.png`, publié par `npm run dos`. Ce sont
les seuls visuels du jeu qui soient des **emblèmes** — et c'est précisément là
que la règle se casse toute seule : un emblème centré et symétrique glisse vers
l'écusson de club sans qu'on le demande.

Trois interdits s'ajoutent donc à ceux du haut, et ils sont à écrire dans
l'invite : pas de forme de blason, pas de bouclier, pas de monogramme. Le motif
reste géométrique et ornemental, jamais héraldique.

Le dos montré à l'ouverture est celui du **sachet**, jamais celui de la carte :
une carte dont le dos annonce sa série n'a plus rien à révéler quand on la
retourne.

## De l'atelier à l'écran

Rien de ce qui est dans `art/` n'est servi au joueur. C'est l'atelier : les
rendus d'origine, en 2K, tels que le générateur les a produits. Un script les
détoure, les réduit à la taille où ils sont réellement affichés, et en écrit
**trois formats** dans `public/img/` — AVIF, WebP et PNG, dans cet ordre de
préférence. Le serveur choisit ensuite lequel envoyer d'après l'en-tête `Accept`
du navigateur.

| Ce qu'on dessine | On dépose dans | La commande | Ce qui est servi |
|---|---|---|---|
| Fanzzy | `art/neuves/`, `art/TR1/` | `npm run art` | `public/img/fanzzy/` |
| Cartes d'action | `art/action/<id>.png` | `npm run actions` | `public/img/action/` |
| Équipement | `art/stuff/<id>.png` | `npm run stuff` | `public/img/stuff/` |
| Chants | `art/chant/<id>.png` | `npm run chants` | `public/img/chant/` |
| Stades | `art/stade/<id>.png` | `npm run stades` | `public/img/stade/` |
| Emblèmes de série | `art/logo/<CODE>.png` | `npm run logos` | `public/img/logo/` |
| Dos de carte | `art/dos/<CODE>.png` | `npm run dos` | `public/img/dos/` |
| Décors de série | `art/fonds/<id>.png` | `npm run fonds` | `public/img/fonds/` |
| Grain des matières | rien : il est calculé | `npm run grain` | `public/img/grain/` |

Le grain fait exception, sur deux points. **Il ne se dessine pas** : aucun
générateur ne rend une tuile qui se raccorde à elle-même, et une couture se
verrait en grille sur tout l'écran. Ses trois tuiles de 256 px — `beton` pour le
mur et le panneau calme, `toile` pour la bâche, `papier` pour le kraft des
tickets — sont donc calculées par `scripts/grain-images.mjs`, sans couture, et
identiques d'un passage à l'autre. Ce sont des voiles presque transparents,
une teinte par famille de grain (le sable clair et les creux noirs du béton,
le creux de la toile, la fibre brune du papier), posés par-dessus la couleur
de la feuille de style. Le béton existe aussi en 512 px (`beton@2x`) : la
même recette tirée deux fois plus fin, que la feuille de style sert aux
écrans denses par `image-set`. Agrandie deux à trois fois par un téléphone, la
tuile de 256 faisait de chaque grain une tache floue ; la toile, dont le relief
est déjà doux, n'en a pas besoin.
**Et son AVIF n'est écrit que s'il gagne** : le WebP et le PNG sans perte sont
toujours là, l'AVIF seulement s'il ne pèse pas plus que le WebP et ne change
pas l'image. Sans perte, l'AV1 paie un grain le double du WebP, ou plus ; avec
perte, il l'efface par blocs, et le bloc abîmé revient à chaque tuile. Comme
le serveur préfère l'AVIF dès qu'il existe, un AVIF perdant serait envoyé à
presque tout le monde. Au dernier passage, seul le papier en a un, et c'est
voulu : le béton (aux deux tailles) et la toile n'en ont pas.
Une recette changée change aussi l'adresse dans `ui.css` (`?v=…`, sur les
deux tailles du béton) : `/img` est servi pour un an, sans retour possible
chez qui l'a déjà.

Quatre de ces commandes acceptent `--invites` (`actions`, `stuff`, `chants`,
`logos`) : elles écrivent alors les **invites** à donner au générateur, la
formule de ce fichier déjà collée en fin de texte, au lieu de traiter des
dessins. C'est le bon point de départ pour une nouvelle fournée.

`npm run manifeste` recolle les `manifeste.json` de chaque Fanzzy en un seul
`index.json` — l'agrégat que les pages lisent. Il est régénéré à la fin de chaque
passage de `npm run art`, et ne s'écrit jamais à la main.

## Où la règle est tenue

Ce fichier énonce ; deux commandes vérifient.

`npm run pages` compte, pour chaque famille, les dessins annoncés par le code et
les fichiers réellement présents en trois formats. Une carte déclarée sans dessin
ou un dessin sans ses trois formats sort en rouge. C'est ce contrôle qui empêche
une page de demander une image qui n'existe pas — le défaut qui avait vidé
l'écran d'accueil sur tout ce qui n'était pas Chrome.

`npm run catalogue` écrit `catalogue.html` à la racine : tout le catalogue rangé
par famille, avec pour chaque personnage sa lignée, ses âges, ses douze états et
ses tenues, et ce qui manque. Au dernier passage : sept cent soixante-cinq
cartes, deux cent quatre-vingt-onze personnages dont deux cent deux dessinés.
Cette comptabilité ne tient dans aucune tête, et cette page dit **lesquels**
manquent — ce qu'aucun contrôle rouge ne sait faire. Les images y sont incluses
dans le fichier, pour qu'elle s'ouvre sur une machine qui n'a pas le dépôt.

Les deux pages générées sont complémentaires, et il vaut mieux savoir laquelle
ouvrir : `npm run dossier` écrit `dossier.html`, qui dit **où en est le jeu** —
règles, barèmes, coûts, chiffres, sans une seule image. `catalogue.html` répond à
l'autre question : **ce qui est dessiné et ce qui manque**.

Aucune des deux ne peut juger d'une marque, d'un écusson ou d'un mot dans une
image. **Ça, c'est à l'œil, avant d'intégrer** — voir la section ci-dessus.

## Une distinction à ne pas confondre

Cette règle concerne les visuels **que nous fabriquons**.

Les logos de clubs affichés dans le télétexte, les matchs du jour, le carnet et
le Grand Virage sont d'une autre nature : ce sont des données fournies par
API-Football, servies depuis ses serveurs, dans un contexte d'information
sportive. C'est l'usage normal de ce type de service, et c'est ce que font tous
les sites de résultats.

Le point de vigilance est ailleurs : une carte-souvenir n'est plus seulement de
l'information, c'est un objet de collection qui porte le nom et l'écusson d'un
club. Si les vignettes deviennent un jour payantes, cette question mérite un
avis juridique — vendre un objet portant l'écusson d'un club est très différent
d'afficher ce même écusson dans un tableau de résultats.
