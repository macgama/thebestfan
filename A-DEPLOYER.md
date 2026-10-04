# À déposer sur Infomaniak

**Lot 4 de la refonte FAIT MAIN, « la collection », 3 et 4 octobre 2026.** La
carte redessinée une fois pour les sept écrans qui la montrent, et son écran de
test ; l'album commun au classeur et à la collection ; le vestiaire ; la fiche,
qui tient sans défiler ; la vitrine, modale commune ; et les cinq reliquats de la
vague précédente — la réserve de boosters d'une seule brique, la place de la
fête de niveau, les insignes du carnet servis et dessinés, le booster des
premiers pas qui compte la recharge, le contrat de `/api/rank/moi`. Le récit est
dans `HISTORIQUE.md`, section 4 quadragies quater.

**Le lot 4 est en ligne depuis le 4 octobre vers 17 h 07** (`7450c03`). Aucun
code n'attend. Ce qui reste à faire : commiter la fin de la trace — des
documents seulement —, les contrôles à l'œil, et ce que la livraison du
quotidien laissait à Gaël.

---

## Où en sont le dépôt et la production

Relevé le 4 octobre 2026 à 17 h 09.

- **La production sert `7450c03`** (« Maj V04102026.1624 »), commité par Gaël à
  17 h 05, poussé sur `origin/main`, mis en ligne par le Manager
  (`"version": null`) : `uptime_s` dit un redémarrage vers 17 h 07. `ui.css`,
  `cartes.js`, `cartes.css`, `nav.js`, `fx.js`, `fanzzy-fiche.js`,
  `fanzzy-fiche.css`, `fanzzy-fond.js`, `niveau-fete.js`, `son.js` et `menu.js`
  servis sont ceux du commit, octet pour octet ; `/fanzzy`, `/collection`,
  `/boosters`, `/boutique`, `/profil`, `/aide`, `/bienvenue`, `/deck` et
  `/classement` aussi, une fois retirés les `?v=` que le serveur ajoute aux
  adresses des feuilles et des scripts. Le serveur n'a pas de marque publique :
  c'est le redémarrage, après un commit qui touche `src/server/aide/` et
  `src/server/quotidien/`, qui dit qu'il tourne.
- **`/healthz` répond `ok: true`**, sans panne, `"quotidien":"actif"`, le jour
  de jeu à `00:00`, heure de Zurich. `sql/quotidien.sql` est appliqué depuis le
  3 octobre (Gaël, avec `2ff45f9`) ; le lot 4 n'apportait aucun schéma.
- Avant, à 16 h 46, la production servait encore `2ff45f9`, depuis un
  redémarrage le 3 octobre vers 10 h 33 ; `60fe268` (« Maj V03102026.1747 »), le
  travail du lot commité pendant la vérification, n'a jamais été en ligne seul.
- **La saison 1 n'a pas de date de fin** : à 16 h 46, `/api/fanzzy/dex` servait
  `"lancee": true`, `"finie": false`, et aucune `fin`. Son nom, en production :
  « La reprise ».
- **Ce qui n'est pas commité, ce sont des documents** : `7450c03` a pris la
  trace pendant qu'elle s'écrivait. `ETAT.md` (une partie : § 2, § 6, § 7 bis),
  `HISTORIQUE.md` (dans la section 4 quadragies quater, « En ligne » et deux
  passages qui disaient le lot pas encore en ligne), `A-DEPLOYER.md` (ce fichier) et
  `README.md` (les nombres de sessions et de suites). Aucun fichier de
  `public/`, `src/`, `sql/` ni `scripts/`.
- **La branche du lot 6** (`refonte-lot6`, dans `.claude/worktrees/lot6`) part
  de `60fe268` : elle n'a pas les seize fichiers que `7450c03` a ajoutés
  par-dessus, et sa copie de travail en touche trois (`public/nav.js`,
  `public/ui.css`, `serveur/ECARTS.md`, relevé le 4 octobre). Elle aura à
  prendre `7450c03` avant de revenir sur `main`.

---

## Ce qui est parti, et dans quel ordre

- **Le schéma : rien.** Aucun fichier de `sql/` n'a changé ; le dernier,
  `sql/quotidien.sql`, était en place.
- **Le serveur** : `src/server/quotidien/index.js` sert `insignes` dans
  `GET /api/quotidien`, sans lecture de plus ; `src/server/aide/index.js` compte
  la recharge due avant le booster des premiers pas, et répond 503
  `aide.error.indisponible`, la pile au journal, là où il répondait un 400
  muet.
- **Les pages** : la carte (`cartes.js`, `cartes.css`, `fanzzy-fond.js`) ;
  `ui.css` (les briques du lot 4, la réserve de boosters, la fête de niveau) ;
  le classeur et le vestiaire (`fanzzy.html`) ; la fiche
  (`fanzzy-fiche.html`, `.js`, `.css`) ; la collection ; et ce que la carte
  nouvelle et les reliquats déplacent ailleurs — `boosters.html`,
  `boutique.html`, `bienvenue.html`, `deck.html`, `aide.html`, `profil.html`,
  `classement.html`, `index.html`, `nav.js`, `fx.js`, `niveau-fete.js`.
- **Les suites et les contrats** : `cartes:ui` (le seul script ajouté à
  `package.json` ; `package-lock.json` n'a pas bougé), les suites revues,
  `serveur/CONTRATS.md` (§ 6.1, les insignes ; § 14, `/api/rank/moi`) et
  `serveur/ECARTS.md`.

Serveur et pages sont partis dans la même livraison, avec un redémarrage, et ce
lot n'était pas sensible à leur ordre : une page servie une minute par l'ancien
serveur ne reçoit pas `insignes` et ne dessine ni liseré ni tampon ; une page
d'avant les ignore ; et devant une panne de l'aide, 400 ou 503, les deux pages
se taisent.

### Ce qui reste à commiter

Les quatre documents, en un commit, poussé. Aucun redémarrage, aucune
construction : rien de ce qu'ils changent n'est servi. Avant, comme toujours :

```bash
npm run pages      # « Toutes les pages compilent, la barre est partout où elle doit être. »
```

### La vérification, faite

```bash
T=$(date +%s)
curl -s "https://thebestfan.online/healthz?v=$T"                                         # "ok":true, sans "panne"
curl -s "https://thebestfan.online/cartes.css?v=$T" | grep -c 'top:84%'                    # 1
curl -s "https://thebestfan.online/ui.css?v=$T"     | grep -c 'brightness(.45) contrast(1.8)'  # 1
curl -s "https://thebestfan.online/collection?v=$T" | grep -c ordreSerie                   # 4
curl -s "https://thebestfan.online/fanzzy?v=$T"     | grep -c place-vide.webp              # 1
curl -s "https://thebestfan.online/boosters?v=$T"   | grep -c kBoosters                    # 3
curl -s "https://thebestfan.online/profil?v=$T"     | grep -c data-lisere                  # 5
```

À 17 h 09 : `ok: true`, puis 1, 1, 4, 1, 3 et 5 — les valeurs attendues. À
16 h 46, sur `2ff45f9`, elles valaient toutes 0. Les quatre premiers comptes ne
viennent qu'avec les seize fichiers d'après `60fe268` : 0, 0, 0, 0 puis 3 et 5
auraient dit que `60fe268` était parti seul.

### Les contrôles à l'œil

Sur un téléphone, connecté, du plus parlant au plus discret.

1. **Le classeur** (MON FANZZY ▸ CLASSEUR). Le rail des séries, LA REPRISE
   ouverte, les autres sous cadenas ; la page de la série : son en-tête et sa
   jauge-écharpe, les cartes collées de travers, une pochette « N° 0… » pour
   chaque carte qui manque, la légendaire en case VITRINE. Une carte neuve
   porte NOUVEAU au coin bas-gauche, sans cacher le visage ; restée une seconde
   à l'écran, elle s'éteint, et le « +N » du hub aussi au retour. Les six pins
   de famille se reconnaissent, MANQUANTS ne laisse que ce qui manque.
2. **Le vestiaire** (MON FANZZY). La poche — écharpes, réserve, anneau du
   classeur —, le personnage sur sa scène, ses stickers, son cri, ENTRER EN
   DUEL avec les bustes du deck, SA FICHE. Avec un compte neuf : TA PLACE EST
   VIDE et OUVRIR MON PREMIER BOOSTER.
3. **La fiche** (SA FICHE, ou une carte du classeur). Rien ne défile ; la carte
   s'incline au doigt et se retourne ; les âges sur la corde, les effets sur la
   craie avec leur pin, les états en vert, les tenues en bleu, le détail sur le
   kraft. ÉVOLUER, s'il y a de quoi : la cérémonie, le tampon ÉVO 2, le ticket
   qui descend, le solde qui décompte. Sur une carte qu'on n'a pas : le
   pochoir, la vignette du paquet, OUVRIR UN BOOSTER.
4. **La collection.** Le niveau de collectionneur, son anneau sur le prochain
   cran (« 10 / 25 », pas sur le total), RÉCUPÉRER si un cran attend ; les cinq
   rayons. FANZZY ouvre l'album, et une case, la vitrine ; ÉTATS et TENUES
   rangent leurs planches par série, une planche complète repliée ;
   ÉQUIPEMENT et CARTES D'ACTION, une grille de stickers.
5. **La vitrine.** La carte inclinable, les dos des voisines derrière, « ×N »
   en tampon, FAIRE GRANDIR, les flèches ; une rare, une épique ou une
   légendaire a sa cérémonie, au-dessus de la vitrine ; une manquante, le
   paquet et OUVRIR UN BOOSTER.
6. **La carte partout.** La forme et son mot au coin haut-droit, l'étoile de
   l'épique et l'éclat de la légendaire entiers sous leur étiquette ; une carte
   qu'on n'a pas en silhouette, jamais en dalle grise. À l'ouverture d'un
   booster, au butin, à la bienvenue, au deck.
7. **La réserve de boosters**, le même sticker au kiosque, à la boutique, au
   vestiaire et dans la bande du HUD (toucher l'avatar de la barre, sous
   560 pixels), avec l'anneau de recharge quand un booster est en route.
8. **Le mode calme**, animations coupées : la vitrine ne s'incline plus, aucune
   carte ne bouge, la forme et le mot de la rareté restent.

**Les insignes du carnet ne se verront pas tout de suite.** Le liseré vient au
palier de 40 tampons, le tampon S1 à celui de 100, et les missions en donnent
cinq par jour au plus depuis le 3 octobre : personne ne les a encore. L'audit
les photographie sur un joueur semé (`profil@insignes`).

### À faire par Gaël, resté de la livraison du quotidien

Le détail est dans `DEPLOIEMENT.md`, étape 5, « Après la livraison du
quotidien ».

1. **Saisir la fin de la saison 1** dans l'onglet Saisons, après avoir vérifié
   sur `/matchs` le dernier week-end de championnat avant la trêve (proposée :
   2026-12-20). Au 4 octobre, elle n'est pas saisie.
2. **Recaler les quatre seuils de division** sur la ferveur réelle des joueurs
   **sans abonnement** (la requête, en lecture seule, est dans
   `DEPLOIEMENT.md`).
3. Le carnet de la saison 1 **n'a pas à être recalé** : les missions sont en
   ligne depuis le 3 octobre, avant le 19.

Et les premiers jours, la requête de détection du grand livre (`DEPLOIEMENT.md`,
« Le grand livre des récompenses »). Les contrôles à l'œil des lots 3 et 5,
s'ils n'ont pas été faits, sont dans une version précédente de ce fichier :
`git show 2ff45f9:A-DEPLOYER.md`, étape 5.

---

## Ce que ça change à l'écran

- **La carte est un sticker** qu'on a envie de coller : sa plaque de rareté, son
  nom en banderole, sa rareté dite par la couleur, la forme, le mot et la
  matière ; une carte qu'on n'a pas, en silhouette sous scotch, avec son numéro.
- **Le classeur est un album** qu'on feuillette série par série ; MON FANZZY
  est un vestiaire.
- **La fiche tient sur un écran** de téléphone, la carte en main, et évoluer est
  une cérémonie.
- **La collection** s'ouvre sur le niveau de collectionneur et cinq rayons, au
  lieu d'un accordéon de treize mille pixels ; **toute carte s'y regarde dans
  la même vitrine**.
- **Partout**, la réserve de boosters est le même sticker ; le profil coud le
  liseré de saison et pose son tampon, dès qu'un joueur les a.

---

## Ce que les contrôles ne prouvent pas

**Deux suites restent rouges, et l'étaient avant le lot 0, à l'identique** :
`deck:ui` (un rouge) et `nvn:ui` (trois). Dernier passage, le 4 octobre de
15 h 58 à 16 h 20 : soixante-deux suites, 4 449 contrôles. **`accueil:ui` est
intermittente**, rouge dans la série et verte seule ; **`virage:ui`** s'est
arrêtée dans la série sur un délai de navigation, pendant qu'un banc de
l'atelier du lot 6 tournait sur le poste, et passe seule (trois fois, 102
contrôles). `abo:smoke`, lancée vers 16 h, est verte.

**Trois fautes mineures, relevées au dernier tour et parties en ligne telles
quelles** : deux commentaires qui disent encore NOUVEAU « sur le flanc » de la
carte, et l'interrupteur de l'album appelé MANQUANTS au classeur et « Ce qu'il
me reste » à `/collection`, où il passe sur une seconde ligne à 360 pixels.
Sans effet sur ce que la page fait.

**Deux données manquent au serveur** : la récompense d'une série complète ne
paraît pas au classeur (elle paraît à `/collection`) tant que
`/api/fanzzy/state` ne sert pas `paliers.series` ; et la fiche n'écrit pas « 1
CHANCE SUR 3 », la chance d'une carte n'étant pas servie.

**Le sachet de LA REPRISE n'a toujours pas de dessin** : au kiosque, à la
fiche d'une carte manquante et dans la vitrine, c'est le repli du code.

**Au soleil, les faces restent sous le seuil, et c'est décidé** (les arbitrages
du 2 octobre) : la craie sur les faces vives, 2,4 à 2,6:1 ; l'encre sur l'or,
3,8.

**Le coût sur un téléphone modeste n'est pas mesuré.** Mesuré en lectures :
MON FANZZY fait une lecture légère de plus (`/api/deck/loadout`, les bustes du
deck) et passe de quinze images à cinq (656 Ko à 297) ; la fiche envoie
l'extinction de ses nouveautés (`POST /api/fanzzy/vu`) ; le classeur ne lit pas
la bibliothèque ; aucun appel à l'API sportive. Au plus trois animations infinies
à l'écran (la fiche d'une légendaire), aucune en grille, aucune au calme.

**Le retour arrière.** Le code se défait par un `git revert` de `7450c03` et
`60fe268`, puis une mise en ligne ; il n'y a pas de schéma à défaire.

---

## Ce qui reste en attente côté serveur

Dans `ETAT.md`, § 7 bis, avec le détail dans `HISTORIQUE.md`, 4 quadragies ter
et quater, « Ce qui reste » : les décisions que le chantier du quotidien rend à
Gaël ; `paliers.series` avec l'état et la chance d'une carte, que les écrans du
lot 4 attendent ; `server.js`, qui ne passe pas `fanzzy` à l'aide (elle le lit
sur `globalThis.fanzzy` : **ne pas retirer cette globale**) ; les boosters d'un
abonnement acheté, qui entrent dans la réserve sans compter la recharge due ; et
le contrôle de démarrage, qui ne vérifie que la première des trois colonnes de
`sql/couleurs.sql`.
