# À déposer sur Infomaniak

**L'intégration qui a suivi le lot 4, 4 et 5 octobre 2026.** Le correctif
serveur des salles du Grand Virage, et ce que les pages en tirent ; le sachet de
LA REPRISE ; la photo du tunnel de l'écran d'ouverture ; les reliquats du lot 4.
Le récit est dans `HISTORIQUE.md`, section 4 quadragies quinquies ; le détail du
serveur dans `serveur/ECARTS.md`, serveur-correctif, et son contrat dans
`serveur/CONTRATS.md`, § 15.

**Une moitié est déjà en ligne** : `0638fb5`, mis en ligne le 4 octobre vers
17 h 17, porte le correctif du Virage et le sachet. **L'autre attend** : la photo
du tunnel, le bandeau du but sur l'accueil, le penalty et la séance de tirs au
but à `/matchs`, MANQUANTS à `/collection`, le câblage de l'aide, les suites et
les documents. Aucun schéma ; un redémarrage, **hors d'un match en direct**.

---

## Où en sont le dépôt et la production

Relevé le 5 octobre 2026 à 0 h 25, et les marques de la vérification à 0 h 38.

- **La production sert `0638fb5`** (« Maj V04102026.1716 »), commité par Gaël le
  4 octobre à 17 h 16, poussé sur `origin/main`, mis en ligne par le Manager
  (`"version": null`) : `uptime_s` dit un redémarrage vers 17 h 17. `cartes.js`
  et `img/pack-la-reprise.avif` servis sont ceux du commit, octet pour octet —
  le `cartes.js` de `7450c03` diffère — ; `/`, `/matchs`, `/collection` et
  `/fanzzy` aussi, une fois retirés les `?v=` que le serveur ajoute. Le serveur
  n'a pas de marque publique : c'est ce redémarrage, après un commit qui touche
  `src/server/ferveur/` et `src/server/football/`, qui dit que le correctif
  tourne.
- **`/healthz` répond `ok: true`**, sans panne, `"virage": "0 salle(s)"`,
  `"quotidien": "actif"`. Aucun schéma n'attend.
- **Le tunnel n'est pas en ligne** : `/img/ecran/tunnel-portrait.webp` répond
  404.
- **Ce qui n'est pas commité.** Dix-sept fichiers modifiés : quatre pages
  (`public/index.html`, `aujourdhui.html`, `collection.html`, `fanzzy.html`) ;
  `server.js`, `src/server/aide/index.js` et `src/server/football/poller.js`
  (un commentaire) ; huit suites et contrôles (`accueil-ui-smoke`,
  `aide-smoke`, `collection-smoke`, `fanzzy-ui-smoke`, `matchs-ui-smoke`,
  `tour-ui-smoke`, `verif-cablage`, `verif-pages`) ; `serveur/CONTRATS.md` et
  `serveur/ECARTS.md`. Sept fichiers neufs : les six images du tunnel
  (`public/img/ecran/tunnel-portrait` et `tunnel-paysage`, en AVIF, WebP et
  PNG) et `art/A-GENERER-ARTLIST.md`. Et cette trace : `ETAT.md`,
  `HISTORIQUE.md`, `A-DEPLOYER.md`, `VISUELS.md`, `README.md`.
- **`CONTRATS.md` § 15 et `ECARTS.md`, serveur-correctif, décrivent un code en
  ligne depuis 17 h 17** sans être commités : ils partent dans le même commit.
- **La production pose encore `globalThis.fanzzy`**, et son aide la lit : c'est
  le câblage de `0638fb5`, et il marche. Cette livraison le remplace par l'appel
  `createAide({ …, fanzzy })`.
- **La saison 1 n'a toujours pas de date de fin** : à 0 h 38, `/api/fanzzy/dex`
  sert `"lancee": true`, `"finie": false`, et aucune `fin`.
- **La branche du lot 6** (`refonte-lot6`, dans `.claude/worktrees/lot6`) est à
  `7450c03` : elle n'a ni `0638fb5` ni cette livraison, et sa copie de travail
  touche `server.js`, `src/server/ferveur/`, `src/server/football/poller.js`,
  `verif-cablage.mjs`, `verif-pages.mjs`, `CONTRATS.md` et `ECARTS.md`. Sa fusion
  croise ce correctif ; c'est l'appel `createAide({ …, fanzzy })` qui reste, et
  `verif-cablage` refuse aussi bien un `server.js` qui ne le passe plus qu'une
  aide qui relit la globale.

---

## Ce qui part, et dans quel ordre

- **Le schéma : rien.** Aucun fichier de `sql/` n'a changé.
- **Le serveur** : `server.js` passe `fanzzy` à `createAide` et ne pose plus la
  globale ; `src/server/aide/index.js` ne lit plus que la porte reçue ;
  `poller.js` ne change que d'un commentaire. Rien du relevé ni des salles :
  le correctif est déjà en ligne.
- **Les pages** : `index.html` (la photo du tunnel ; le bandeau du but, qui ne
  nomme plus que le bon buteur, ou personne) ; `aujourdhui.html`, servie à
  `/matchs` (ni le penalty manqué ni la séance ne crient « GOAL ! », et le
  verdict d'une qualification aux tirs au but lit la séance) ;
  `collection.html` et `fanzzy.html` (MANQUANTS sur une rangée, deux
  commentaires).
- **Les six images du tunnel, dans le même commit qu'`index.html`.** Par
  GitHub, `verif-pages` refuserait la livraison sans elles ; par le Manager, qui
  ne le lance pas, la page demanderait des images absentes, qui se retireraient
  et laisseraient le béton peint — sans un mot.
- **Les suites et les documents.**

L'ordre ne compte pas ici : une page servie une minute par l'ancien serveur ne
lit rien de neuf, et l'aide marche par la globale comme par l'appel.

### Quand : hors d'un match en direct

**La raison première de cette précaution est passée.** Un match en cours dont
un penalty manqué avait déjà pris un numéro, sous l'ancien code, perdait la
carte du but réel suivant, une fois : le correctif ne compte plus le penalty
manqué, le but suivant reprend son numéro, et sa carte existe déjà
(`souvenirs`, `UNIQUE (fixture_id, seq)`). Ce passage s'est fait avec
`0638fb5`, un dimanche à 17 h 17, sans la précaution ; personne n'a regardé si
un match en était touché. Cette livraison ne change pas ce qui compte comme un
but.

**Mais tout redémarrage pendant un match coûte encore.** Les salles vivent en
mémoire : la corde, le score de la tribune et l'état de chaque supporter
repartent de zéro. Et une coupure de plus de cinq minutes de jeu, ou qui
enjambe une mi-temps, n'annonce pas les buts qu'elle a couverts : le score les
porte, leurs cartes ne sont pas frappées (`serveur/ECARTS.md`,
serveur-correctif § 4).

### Avant

```bash
npm run pages      # « l'écran d'ouverture — 9 image(s) demandée(s), toutes présentes » ; « les sachets — 8 sachet(s) dessiné(s) »
npm run cablage    # 30 contrôles, dont les cinq de l'aide
```

### La vérification, après

```bash
T=$(date +%s)
curl -s "https://thebestfan.online/healthz?v=$T"                                    # "ok":true, sans "panne"
curl -s "https://thebestfan.online/?v=$T"           | grep -c tunnel-portrait         # 4
curl -s "https://thebestfan.online/?v=$T"           | grep -c auTableau               # 3
curl -s "https://thebestfan.online/matchs?v=$T"     | grep -c 'Missed Penalty'        # 2
curl -s "https://thebestfan.online/collection?v=$T" | grep -c 'Manquants</button>'    # 1
curl -s -o /dev/null -w '%{http_code}\n' "https://thebestfan.online/img/ecran/tunnel-portrait.webp?v=$T"   # 200
```

Le 5 octobre à 0 h 38, sur `0638fb5` : `ok: true`, puis 0, 0, 0, 0 et 404. Un
200 sur l'image avec un 0 sur la page dirait que les images sont parties sans
`index.html` ; l'inverse, qu'`index.html` est parti sans ses images.

### Les contrôles à l'œil

Sur un téléphone, connecté.

1. **Le tunnel, à l'ouverture** (une fenêtre privée, ou après avoir vidé le
   site). La photo de béton — les poutres, les deux mains courantes,
   l'escalier, la bâche rouge à gauche et l'or à droite —, la tribune au bout
   du trou, et la lumière qui grandit ; le titre et la jauge lisibles. Couché,
   le titre ne mord pas sur la lumière. Avec le mode calme, rien ne bouge.
2. **Le sachet, au kiosque** (en ligne depuis `0638fb5`) : BOOSTERS, LA
   REPRISE choisie, trois sachets dessinés au carrousel, pas trois cartes
   plates.
3. **Aucune salle de Virage restée sur un match fini.** Une fois les matchs du
   jour finis et leurs pages fermées, `/healthz` dit `"virage": "0 salle(s)"`.
   Entre-temps, l'aperçu de `/admin` liste les salles en vie, le numéro de leur
   match et leur foule : une
   salle à foule nulle sur un match fini ne doit pas y rester plus d'une
   minute. Une salle encore occupée sur un match fini peut rester tant que
   quelqu'un est sur la page, mais elle n'est plus relevée.
4. **Dans un Virage, pendant un match** (en ligne depuis `0638fb5`) : recharger
   la page rend le même souffle et la même main ; fermer un autre onglet du jeu
   ne fait pas sortir de la tribune.
5. **Si l'occasion se présente.** Un but de ton club en direct, sur l'accueil :
   « Goal ! », puis le buteur et sa minute — ou rien, jamais le buteur du but
   d'avant. Un match aux tirs au but, à `/matchs` : pas de « GOAL ! » pendant
   la séance ; au coup de sifflet, VICTOIRE ou DÉFAITE, « aux tirs au but ».
6. **L'album de `/collection`** (FANZZY), sur un téléphone de 360 à 440 pixels :
   les six pins et MANQUANTS sur une seule rangée.

Les contrôles à l'œil du lot 4, s'ils n'ont pas été faits, sont dans la version
précédente de ce fichier : `git show 0638fb5:A-DEPLOYER.md`.

### À faire par Gaël, resté de la livraison du quotidien

Le détail est dans `DEPLOIEMENT.md`, étape 5, « Après la livraison du
quotidien ».

1. **Saisir la fin de la saison 1** dans l'onglet Saisons, après avoir vérifié
   sur `/matchs` le dernier week-end de championnat avant la trêve (proposée :
   2026-12-20). Au 5 octobre, elle n'est pas saisie.
2. **Recaler les quatre seuils de division** sur la ferveur réelle des joueurs
   **sans abonnement** (la requête, en lecture seule, est dans
   `DEPLOIEMENT.md`).
3. Le carnet de la saison 1 **n'a pas à être recalé** : les missions sont en
   ligne depuis le 3 octobre, avant le 19.

Et les premiers jours, la requête de détection du grand livre (`DEPLOIEMENT.md`,
« Le grand livre des récompenses »).

---

## Ce que ça change à l'écran

- **L'écran d'ouverture a son couloir de béton** : une photo, debout ou couchée
  selon l'écran, avec le stade au bout. Sans elle, le béton peint d'avant,
  à la même géométrie.
- **Au but de ton club, l'accueil nomme le bon buteur**, ou personne — jamais
  celui du but d'avant, ni celui qui vient de manquer son penalty.
- **`/matchs` ne fête plus un penalty raté**, ne crie plus « GOAL ! » à chaque
  tir d'une séance, et dit d'une qualification aux tirs au but qu'elle est une
  victoire ou une défaite, avec le score de la séance.
- **L'album de `/collection`** dit MANQUANTS, comme le classeur, sur la même
  rangée que ses filtres.
- Déjà en ligne : **le kiosque montre le sachet de LA REPRISE** ; **dans le
  Virage**, recharger ne rend plus un souffle neuf, deux onglets ne se chassent
  plus, la minute double finit à l'écran, un penalty raté ne frappe plus de
  carte, et une tribune ouverte en cours de match ne rejoue pas les buts
  d'avant.

---

## Ce que les contrôles ne prouvent pas

**Deux suites restent rouges, et l'étaient avant le lot 0, à l'identique** :
`deck:ui` (un rouge) et `nvn:ui` (trois). Dernier passage, le 4 octobre de
23 h 26 à 23 h 48 : soixante-quatre suites, 4 708 contrôles. **`accueil:ui` est
intermittente** : trois rouges dans la série, deux quand elle est relancée
seule, aucun dans une copie de la suite hors du dépôt, puis le rouge connu de
la bulle ; dans les passages rouges du rideau, `ouverture.js`
démarrait environ neuf secondes après la navigation (`ETAT.md` § 6).

**Le correctif est éprouvé contre de faux clients, pas contre un vrai match.**
`salles:test` et `releve:test` montent les vrais modules sur de fausses sockets
et une fausse API. Ce qui s'est passé en production depuis le 4 octobre à
17 h 17 — le journal du serveur, le quota du jour dans l'aperçu de `/admin` —
n'a pas été relu.

**L'audit ne voit pas la photo du tunnel** : il mesure la craie de l'ouverture
sur le fond de l'écran. Le 4,5:1 sous le libellé et la consigne est celui du
traitement de l'image, mesuré à sa fabrication.

**`/matchs` peut taire un vrai but** : au statut P ou PEN, un penalty marqué à
la minute 90 ou plus et publié après le début de la séance est pris pour un
tir de la séance. Et un match retour gagné 1-0 puis perdu aux tirs au but
s'annonce VICTOIRE.

**Le coût.** La photo pèse 53 Ko en AVIF debout, 42 couchée (65 et 43 en
WebP) ; le PNG, 885 et 933 Ko, ne part que vers un navigateur qui ne lit ni
l'un ni l'autre. Aucune lecture ni aucun appel à l'API sportive de plus.

**Le retour arrière.** Cette livraison se défait par un `git revert` de son
commit, puis une mise en ligne ; il n'y a pas de schéma à défaire. Défaire le
correctif lui-même (`0638fb5`, qui porte aussi le sachet et la fin de la trace
du lot 4) rouvrirait D1 à D3, et ferait aux numéros des buts le chemin
inverse : hors d'un match en direct, là aussi.

---

## Ce qui reste en attente côté serveur

Dans `ETAT.md`, § 7 bis, avec le détail dans `HISTORIQUE.md`, 4 quadragies ter
et quater, « Ce qui reste » : les décisions que le chantier du quotidien rend à
Gaël ; `paliers.series` avec l'état et la chance d'une carte, que les écrans du
lot 4 attendent ; les boosters d'un abonnement acheté, qui entrent dans la
réserve sans compter la recharge due ; et le contrôle de démarrage, qui ne
vérifie que la première des trois colonnes de `sql/couleurs.sql`.

Et, de cette intégration (4 quadragies quinquies, « Ce qui reste ») : faire
suivre `comments` dans les événements du télétexte, pour que `/matchs`
reconnaisse la séance comme le relevé ; D4, D5 et D7 du Grand Virage, au lot 6.
