# À déposer sur Infomaniak

**Session « le format d'image, puis le catalogue ».** Quatre commits de code
sur `claude/dreamy-lovelace-mjqpea`, plus les mises à jour de ce fichier :

```
622eaa7  L'accueil sans personnage : le format d'image n'est plus deviné
d027bc3  L'AVIF revient, négocié par le serveur
a69b5b8  Le catalogue dit tout seul quand il a dérivé du code
????????  Le code redescend dans la base, sans écraser personne
```

**Une colonne s'ajoute** — `fanzzy.amorce` — et elle est déclarée dans
`sql/fanzzy.sql`, qui est rejoué à chaque passage de schéma. Aucune table
nouvelle, aucune donnée déplacée, **aucune dépendance nouvelle**
(`package-lock.json` n'a pas bougé, `npm ci` passe tel quel). Sans la colonne,
le jeu tourne exactement comme avant et le démarrage dit quoi appliquer : rien
ne s'éteint si le schéma est oublié.

Le retour arrière est un `git revert` des commits de code. La colonne peut
rester : plus personne ne la lit.

---

## Ce que ça corrige — 1. l'accueil sans personnage

L'écran d'accueil n'avait **plus de personnage au centre** sur Firefox et sur
téléphone, avec le nom du Fanzzy écrit juste en dessous, pendant que Chrome
allait très bien et que la fiche « Mon Fanzzy » montrait le même dessin sans
broncher.

La page choisissait le format des images en demandant à un canvas
`toDataURL('image/avif')` puis `toDataURL('image/webp')` — c'est-à-dire ce
qu'il sait **écrire**, qui ne dit rien de ce que le navigateur sait
**afficher**. Personne n'encode l'AVIF, pas même Chrome ; Safari n'encode pas le
WebP. Tout ce qui n'était pas Chrome repartait donc avec `.jpg`, et **aucun
Fanzzy n'est publié en JPEG** — ils sont détourés, rangés en AVIF, WebP et PNG.
L'accueil demandait `/img/fanzzy/TR57.jpg`, recevait un 404, et son rattrapage
ne connaissait que `.avif` et `.webp` : le `.jpg` passait au travers, les deux
calques restaient éteints, et le cadre restait vide sans un mot dans la console.

Le choix est passé côté serveur, où la question a une réponse exacte : l'en-tête
`Accept` dit ce que le navigateur sait lire. La page demande le WebP — lu
partout depuis 2020 — et le serveur remplace par le jumeau `.avif` quand, et
seulement quand, le navigateur l'a annoncé. **28,7 Mo de WebP deviennent
18,3 Mo d'AVIF** pour qui sait les lire, soit 36 % de moins ; c'est la première
fois que l'AVIF du dépôt sert à quelque chose.

## Ce que ça corrige — 2. le catalogue qui dérivait en silence

Le catalogue vit en base et s'amorce depuis `dex.js` en `INSERT IGNORE` : on
ajoute ce qui manque, on n'écrase jamais ce qui existe — sans quoi chaque
redémarrage effacerait les corrections faites à l'écran. La contrepartie n'était
tenue par rien : **changer une carte déjà en base dans le code ne changeait
rien.** Quatre fichiers de `sql/` n'existent que pour rattraper ça à la main.

Deux pièces, désormais. Le **constat** compare les deux catalogues à chaque
démarrage et nomme au journal les trois écarts qu'aucune manœuvre normale ne
produit. La **réconciliation** fait redescendre le code dans les cartes déjà
posées, champ par champ, en s'arrêtant devant tout ce qui a été corrigé à
l'écran — la colonne `fanzzy.amorce` garde ce que le code disait la dernière
fois, ce qui permet de savoir *qui* a bougé au lieu de le supposer.

---

## Les fichiers qui ont changé

Si tu préfères ne téléverser que le delta plutôt que tout remplacer.

### Nouveaux fichiers

```
src/server/images/index.js          la négociation de format : Accept → AVIF
scripts/images-smoke.mjs            sa suite de tests — npm run images:smoke
src/server/fanzzy/ecarts.js         le constat d'écart code / base
scripts/ecarts-smoke.mjs            npm run ecarts:test
src/server/fanzzy/reconciliation.js la fusion à trois points du catalogue
scripts/reconciliation-smoke.mjs    npm run reconciliation:test
```

### Fichiers remplacés

```
server.js                           négociation /img ; l'écart du catalogue
                                    dans /healthz
package.json                        les trois nouvelles suites
sql/fanzzy.sql                      colonne `amorce` : ce que le code disait
                                    la dernière fois qu'il a écrit la carte
src/server/fanzzy/catalogue.js      amorçage, réconciliation, constat d'écart
scripts/fanzzy-ecarts.mjs           la loupe, sur le module partagé
scripts/appliquer-schema.mjs        historique.sql manquait à la liste
public/fanzzy-etats.js              plus de détection ; EXT, REPLI et secours()
public/fanzzy-art.js                deux extensions au lieu d'une : un Fanzzy
                                    détouré ne peut plus être demandé en .jpg
public/index.html                   l'accueil retombe par secours() ; le décor
                                    a un second repli
public/fanzzy-scene.js              même rattrapage pour les quatre écrans
                                    qui montrent un Fanzzy en pied : le Virage,
                                    le classeur, les boosters, le jour
public/nav.js                       le décor commun ne devine plus son format
public/sw.js                        commentaire seulement : pourquoi le cache
                                    d'images tient malgré « Vary: Accept »
scripts/verif-pages.mjs             contrôle neuf : l'adresse que la page
                                    demande doit désigner un fichier présent
scripts/etats-smoke.mjs             attentes mises à jour + secours() éprouvé
ETAT.md                             § 6, Pièges connus : l'entrée complète
```

`public/img/` n'a pas changé : les AVIF étaient déjà tous là, ils n'étaient
simplement jamais servis.

---

## Les étapes, dans l'ordre

### 1. Amener les deux commits sur `main`

Ils sont sur `claude/dreamy-lovelace-mjqpea`. Rien ne part en ligne depuis une
branche : `scripts/deployer.sh` fait `git reset --hard origin/main`, et la
construction du Manager tire la branche par défaut. Fusionner d'abord, donc.

### 2. Déployer

Par le workflow, si les secrets SSH sont posés — `deploiement.yml` lance
`scripts/deployer.sh`, qui applique le schéma avant de redémarrer et n'a rien à
appliquer ici. Sinon, **à la main dans l'onglet Node.js du Manager** :

```
git pull && npm ci && node build.mjs
```

`npm ci` et non `npm install` : c'est ce qui a déjà bloqué une livraison
entière — `npm install` réécrit `package-lock.json` sur le serveur, le dépôt
devient sale et le `git pull` suivant refuse de fusionner sans le dire.
`node build.mjs` ne fabrique rien, mais la commande l'appelle encore.

Attendre la fin de la construction **avant** de redémarrer : `npm start` ne
fait jamais de `git pull`.

### 3. Passer le schéma

Le workflow le fait avant de redémarrer. À la main :

```bash
cd ~/sites/thebestfan.online && npm run schema:appliquer
```

Il ajoute `fanzzy.amorce` et ne touche à rien d'autre. Si tu l'oublies, le jeu
tourne quand même : le démarrage écrit « colonne `amorce` absente,
réconciliation désactivée » et `/healthz` nomme le fichier.

### 4. Vérifier que c'est bien le nouveau code qui tourne

```bash
curl -s https://thebestfan.online/healthz
```

`version` doit annoncer le commit qu'on vient de pousser, et `ok` doit être
`true`. S'il annonce l'ancien commit, le redémarrage n'a pas eu lieu — le site
répond, en servant le code d'avant, et tout ce qui suit serait vérifié pour
rien.

### 5. Vérifier la négociation — deux commandes

C'est le seul contrôle qui ne se fait pas à l'œil, et c'est le cœur de la
livraison. **La même adresse** doit rendre deux fichiers différents :

```bash
# Un navigateur qui sait lire l'AVIF → doit répondre « image/avif »
curl -sI -H 'accept: image/avif,image/webp,*/*' \
  https://thebestfan.online/img/fanzzy/TR57.webp | grep -iE 'content-type|vary'

# Safari 15, qui ne sait pas → doit répondre « image/webp »
curl -sI -H 'accept: image/webp,image/png,image/*;q=0.8' \
  https://thebestfan.online/img/fanzzy/TR57.webp | grep -iE 'content-type|vary'
```

Attendu, dans cet ordre : `image/avif` puis `image/webp`, et **`Vary: Accept`
dans les deux cas**. Si le `Vary` manque, ne laisse pas courir : c'est lui qui
empêche un cache intermédiaire de servir l'AVIF de l'un au navigateur de
l'autre, et la panne qu'on vient de corriger reviendrait un cran plus loin,
chez les seuls joueurs qui passent par ce cache.

Si les deux réponses sont identiques, le middleware n'est pas monté (code non
tiré par le `git pull`) ou quelque chose en amont réécrit `Accept`.

### 6. Vérifier l'accueil, là où ça se voyait

**Sur Firefox et sur un iPhone**, pas sur Chrome — c'est Chrome qui allait bien.

1. `/` connecté : le Fanzzy équipé doit être **au centre de l'écran**, pas
   seulement nommé sous les rails.
2. Toucher le personnage : il saute. C'est le signe que l'image est là et pas
   qu'un calque vide occupe la place.
3. `/fanzzy` puis retour à `/` : le personnage doit revenir **tout de suite**,
   depuis le souvenir local.

Si l'accueil est encore vide sur un appareil : vider le cache du site. Le
service worker garde les images en cache-first, et un `.jpg` en 404 n'a rien
mis en cache — mais une page HTML d'avant, si.

### 7. Lire ce que le démarrage dit du catalogue

C'est la première mise en ligne où le code redescend dans la table `fanzzy`.
Les lignes à chercher dans le journal, dans cet ordre d'importance :

```
catalogue : N carte(s) d’avant la réconciliation prises en charge …
catalogue : N carte(s) reprise(s) du code — TR2 (nom) …
catalogue : N carte(s) que le code voulait changer et qui ont été corrigées à l’écran …
```

La première n'arrive **qu'une fois**, au premier démarrage sur cette base :
c'est l'adoption des lignes d'avant le mécanisme. Le compte attendu est proche
du nombre de cartes, moins celles que tu as corrigées depuis `/admin` — elles
restent hors de portée, et le journal les compte à part.

La deuxième liste ce que le code vient de reprendre. Sur cette base, ce sont les
écarts que `sql/identites.sql` rattrapait à la main : ils devraient disparaître
d'eux-mêmes.

La troisième est la seule qui demande une décision, et elle n'est pas urgente :
le code voulait changer une carte que tu avais corrigée à l'écran. La base garde
**ta** version. `npm run ecarts` dit laquelle, champ par champ.

Si le journal annonce à la place « N cartes seraient reprises du code, au-delà
des 60 admises — rien n'a été écrit », **ne relève pas le plafond par réflexe** :
c'est le disjoncteur, et une fournée de contenu ne réécrit pas soixante cartes.
Regarde d'abord `npm run ecarts`.

Puis, une fois : `curl -s https://thebestfan.online/healthz` doit montrer
`catalogue: { cartes: …, aCollectionner: … }` **sans clé `ecarts`**. Une clé
`ecarts` qui reste après ce déploiement est une faute réelle, pas un reliquat.

---

## Une chose à décider

**Les joueurs déjà installés garderont leur WebP un moment.** `public/sw.js`
met les images en cache-first sous `tbf-images-1` : les dessins qu'ils ont déjà
vus continueront de sortir de ce cache, en WebP, et ne profiteront pas des 36 %
tant qu'il n'est pas vidé. Les nouvelles visites et les images jamais vues
partent en AVIF dès maintenant.

Passer la constante à `tbf-images-2` efface l'ancien cache au prochain
démarrage et fait tout re-télécharger — en AVIF, donc plus léger ensuite, mais
une fois plein tarif. C'est un arbitrage, pas une correction : à décider, pas à
faire par réflexe.

---

## Ce qui reste en attente côté serveur

Rien de neuf dans cette livraison. La liste à jour est en `ETAT.md` § 7 bis, et
le point 0 est celui qui compte : **cinq migrations ne sont peut-être pas
appliquées en production** — `minutes`, `couleurs`, `amis`, `boutique`,
`billets`. Le démarrage les contrôle et `/healthz` répond `ok: false` en les
nommant. C'est la vérification de l'étape 4, et c'est pour ça qu'elle est là.
