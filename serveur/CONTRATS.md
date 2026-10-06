# Contrats des données nouvelles — serveur ↔ écrans

*Chantier serveur de la refonte FAIT MAIN, vague 1. 2 octobre 2026.*
*Vague 2, les arènes (lot 6) : § 15 à § 18, versés le 4 octobre 2026.*

Ce document est un **contrat**. Les écrans des lots 3 et 5 (et plus tard 2, 4
et 6) codent contre lui pendant que le serveur l'implémente. Un champ décrit
ici a exactement ce nom, ce type et cette unité. Un écart entre le serveur et
ce texte est une faute du serveur, et la suite de son périmètre doit la voir.
Une évolution du contrat passe par ce fichier, jamais par un accord oral entre
deux agents.

Les montants cités dans les exemples sont les valeurs de départ des réglages
(`SERVEUR.md`, § 8). Un écran ne les recopie **jamais** : il affiche ce que la
réponse porte.

---

## 0. Règles communes

**R1 — Absent veut dire « rien à montrer ».** Un champ sans valeur est
**absent** de la réponse. L'écran n'affiche alors rien : pas de tiret, pas de
zéro, pas de « J0 », pas de jauge vide, pas de ligne vide, pas d'onglet vide.
`null` n'apparaît que là où ce contrat le dit explicitement (par exemple
`avatar: null` pour un joueur sans Fanzzy).

**R2 — Une route qui répond 404, 503 ou une erreur réseau équivaut à un bloc
absent.** Pendant un déploiement, l'ancien serveur peut servir les nouvelles
pages pendant une minute. La page ne montre alors ni erreur ni zéro, et rien
en console.

**R3 — Les durées sont relatives, en millisecondes, mesurées par le
serveur.** Un champ `…Ms` est un entier ≥ 0, compté à l'instant de la réponse.
La page décompte avec `performance.now()` et relit à `visibilitychange`. À
zéro, elle relit le serveur au lieu de conclure seule. **Aucune page ne
calcule minuit, une fin de saison ou un jour à partir de l'horloge du
téléphone.**

**R4 — Un jour s'écrit `"AAAA-MM-JJ"`.** C'est le **jour de jeu** du serveur
(son minuit, qui est celui des quotas gratuits). C'est une étiquette à
afficher, jamais une valeur à convertir en `Date`. Les champs `lanceeA`, `depuis`
et autres instants déjà servis ne doivent servir à aucun calcul de durée : leur
fuseau n'est pas garanti.

**R5 — Un gain a toujours la même forme.**

```json
"gain": { "echarpes": 30, "packs": 0, "xp": 20, "tampons": 1 }
```

Les quatre clés sont **toujours présentes** et sont des entiers ≥ 0 :
`echarpes` en écharpes, `packs` en boosters, `xp` en points d'expérience,
`tampons` en tampons de saison. L'écran n'affiche que les valeurs non nulles
(« +30 écharpes · +20 XP »), jamais « +0 ».

**R6 — Une réclamation répond toujours 200 quand la session est valide.**
Versement :

```json
{ "verse": true, "gain": { … }, "wallet": { "scarves": 412, "packs": 7 },
  "niveau": { … } }
```

`niveau` (§ 1) n'est présent que si le gain contenait de l'XP. L'XP est
versée dans la même transaction que le reste : si elle ne peut pas l'être,
rien n'est versé (`raison: "schema"`). `wallet.scarves` est le solde après
versement, écharpes de palier de niveau comprises ; `wallet.packs` est la
réserve après versement, **recharge en attente comprise** : le serveur compte
la recharge due avant d'ajouter un booster offert. Un booster offert entre dans
la réserve même si elle est pleine.

Pour une réclamation groupée (`tout`), `niveau` décrit l'ensemble :
`depart` est la jauge d'avant le premier versement, les autres champs sont
ceux d'après le dernier, `gain` et `ecarpes` sont des sommes, `paliers` est la
liste de tous les paliers franchis, et `avant` le niveau d'avant le premier
versement. Refus :

```json
{ "verse": false, "raison": "deja" }
```

`raison` appartient à une **liste fermée** (§ 11). L'écran traduit la raison ;
il n'affiche jamais une raison inconnue telle quelle, il relit l'état. Chaque
réponse de réclamation porte aussi l'état à jour du bloc concerné (précisé
route par route), pour éviter une seconde requête.

Après un versement, la page émet l'événement que la barre écoute déjà :

```js
window.dispatchEvent(new CustomEvent('tbf:bourse', { detail: { wallet, niveau } }));
```

**R7 — Le serveur compte, l'écran nomme.** Les intitulés de mission et les noms
de palier sont servis, parce qu'ils viennent d'un catalogue unique côté
serveur. Les nombres sont toujours servis à part, et une page ne les extrait
jamais d'un texte.

**R8 — Une session est requise** sur toutes les routes nouvelles, sauf les
listes de classement, qui restent publiques. Sans session : 401
`{ "error": "auth.error.unauthenticated" }`, comme ailleurs.

**R9 — Abonné et non-abonné reçoivent des réponses de même forme et de mêmes
montants.** Aucune donnée de ce contrat ne dépend de l'abonnement.

**R10 — Clé de cache de la pastille MISSIONS.** Le hub (et `/aide`) écrivent,
après chaque lecture de `GET /api/quotidien` :

```js
sessionStorage.setItem('tbf-quotidien',
  JSON.stringify({ qui: <id du joueur>, t: Date.now(), aReclamer: <entier> }));
```

La barre et le tiroir lisent cette clé (même joueur, moins de 60 s) et n'ont
**jamais** à appeler la route eux-mêmes. Sans clé valide : pas de pastille.

---

## 1. L'XP courant et le seuil dans les résultats (point 1)

### Forme : l'objet `niveau`

```json
"niveau": {
  "xp": 490,
  "gain": 20,
  "niveau": 5, "dans": 10, "pour": 220, "part": 0.045, "max": false,
  "avant": 4, "monte": true,
  "paliers": [{ "niveau": 5, "deckFanzzy": 3 }],
  "ecarpes": 50,
  "depart": { "xp": 470, "niveau": 4, "dans": 170, "pour": 180, "part": 0.944, "max": false }
}
```

| champ | type | sens |
|---|---|---|
| `xp` | entier | XP totale **après** le gain |
| `gain` | entier > 0 | XP gagnée par cette action |
| `niveau` | entier 1–30 | niveau après le gain |
| `dans` | entier ≥ 0 | XP gagnée dans le niveau courant |
| `pour` | entier ≥ 0 | XP qu'il faut pour franchir le niveau courant (0 au niveau maximum) |
| `part` | décimal 0–1 | `dans / pour` (1 au niveau maximum) |
| `max` | booléen | niveau maximum atteint |
| `avant` | entier | niveau avant le gain |
| `monte` | booléen | `niveau > avant` |
| `paliers` | tableau | ce que les niveaux franchis ouvrent (forme de `PALIERS` de `shared/niveau.js` : `{ niveau, slots? , deckFanzzy? }`) ; vide sans montée |
| `ecarpes` | entier ≥ 0 | écharpes versées par les paliers franchis (**orthographe du code, sans h**) |
| `depart` | objet | la jauge **avant** le gain, pour l'animer : `{ xp, niveau, dans, pour, part, max }` |

L'anneau s'anime de `depart.part` vers `part`. S'il y a montée, il fait le tour
jusqu'à 1, puis repart de 0 vers `part`, et `niveau-fete.js` prend la main.

### Routes qui le portent

| route | où |
|---|---|
| `POST /api/fanzzy/open` | `niveau`, à la racine de la réponse (existe déjà, enrichi) |
| socket `nvn:fin` | `gains.niveau` (**nouveau**, présent même sans montée) ; `gains.montee` reste, inchangé |
| toute réclamation de ce contrat qui verse de l'XP | `niveau`, à la racine |

### Absence

Absent si l'XP n'a pas pu être créditée (incident de base), et pour un forfait
(qui ne gagne pas d'XP). L'anneau ne bouge pas, aucune ligne d'XP ne s'écrit.

### Lecteurs

`boosters.html` (butin), `duel-nvn.html` (bilan, lot 6), `niveau-fete.js`,
`index.html` et `aide.html` (après une réclamation), `nav.js` (peut lire
`detail.niveau` de `tbf:bourse` pour s'éviter un `/api/niveau`).

---

## 2. Le drapeau « vu / nouveau » (point 2)

### 2.1 La liste des nouveautés

`GET /api/fanzzy/state` → champ `nouveautes` :

```json
"nouveautes": [
  { "cle": "fanzzy:RP4", "sorte": "fanzzy", "id": "RP4" },
  { "cle": "age:RP4:2", "sorte": "age", "id": "RP4", "stade": 2 },
  { "cle": "etat:RP4:1:joie", "sorte": "etat", "id": "joie", "pour": "RP4", "stade": 1 },
  { "cle": "skin:RP4:1:prehistorique", "sorte": "skin", "id": "prehistorique", "pour": "RP4", "stade": 1 },
  { "cle": "stuff:rp-megaphone", "sorte": "stuff", "id": "rp-megaphone" },
  { "cle": "action:a-rp-fumigene", "sorte": "action", "id": "a-rp-fumigene" }
]
```

| champ | type | sens |
|---|---|---|
| `cle` | chaîne | identifiant stable de la nouveauté, celui qu'on renvoie pour l'éteindre |
| `sorte` | `"fanzzy"` \| `"age"` \| `"etat"` \| `"skin"` \| `"stuff"` \| `"action"` | ce qui est nouveau |
| `id` | chaîne | la lignée (fanzzy, age), l'état, la tenue, la pièce ou la carte |
| `pour` | chaîne | la lignée concernée (`etat`, `skin` seulement) |
| `stade` | entier 1–3 | l'âge concerné (`age`, `etat`, `skin` seulement) |

- Ordre : la plus récente d'abord. Au plus 200 entrées.
- Écrites par le serveur **au moment du gain** : booster, évolution (`age`),
  achat à l'étal. Ce qui était possédé avant la mise en ligne n'est jamais
  « nouveau ».
- Une nouveauté est retirée quand la page l'éteint (§ 2.2), ou après 60 jours.

**Absence.** `nouveautes` absent : le serveur ne sait pas (table absente).
L'écran n'affiche aucun NOUVEAU venu du serveur (il peut garder sa mémoire
locale, c'est un choix du lot 4). `[]` : rien de nouveau.

### 2.2 Éteindre

`POST /api/fanzzy/vu`, avec **l'une** de ces trois formes :

```json
{ "cles": ["fanzzy:RP4", "etat:RP4:1:joie"] }
{ "sorte": "etat" }
{ "tout": true }
```

Réponse : `{ "restantes": 3 }` (entier ≥ 0, ce qui reste après). Corps
invalide : 400 `{ "error": "fanzzy.error.vu_invalide" }`. Au plus 200 clés par
appel. La page l'envoie **après** avoir montré les nouveautés, jamais au
chargement.

### 2.3 Dans la réponse d'un booster

`POST /api/fanzzy/open` : chaque carte de `cards` porte en plus `cle` (même
format qu'au § 2.1), sauf une carte `"echarpes"`. Le champ `new` reste.

Et un champ nouveau, `series`, la progression des séries touchées par ce
booster :

```json
"series": [{ "id": "RP", "avant": 4, "apres": 6, "total": 35, "complete": false }]
```

| champ | type | sens |
|---|---|---|
| `id` | chaîne | identifiant de série |
| `avant` | entier | lignées de la série possédées avant ce booster |
| `apres` | entier | lignées possédées après |
| `total` | entier | lignées obtenables dans la série aujourd'hui |
| `complete` | booléen | vrai **seulement** au booster qui complète la série (`apres === total` et `avant < total`) |

`series` vaut `[]` quand le booster ne contient aucun personnage, et il est
absent si le calcul a échoué : l'écran garde alors son propre calcul de la
ligne de série. Une série complétée se récompense par le § 5.1, pas ici.

### Lecteurs

`boosters.html` (NOUVEAU, ligne vivante de la série, tampon COMPLET),
`fanzzy.html` et `collection.html` (NOUVEAU, « +3 » sur l'onglet, lot 4),
`fanzzy-fiche.html` (éteint la clé à l'ouverture, lot 4), `index.html`
(pastille de la tuile COLLECTION : `nouveautes.length`).

---

## 3. L'avatar et le niveau dans les listes (point 3)

### L'avatar public

```json
"avatar": { "id": "RP4", "age": "RP4B", "evo": 2, "nom": "Le Meneur",
            "skin": "base", "etat": null, "rar": "rare" }
```

| champ | type |
|---|---|
| `id` | chaîne, la lignée |
| `age` | chaîne, l'identifiant de l'âge montré (à passer au dessin) |
| `evo` | entier 1–3 |
| `nom` | chaîne |
| `skin` | chaîne, `"base"` par défaut |
| `etat` | chaîne ou `null` (l'expression choisie, `null` = repos) |
| `rar` | `"commune"` \| `"rare"` \| `"epique"` \| `"legendaire"` \| `null` |

C'est une **liste blanche** : aucun autre champ (ni garde-robe, ni XP exacte, ni
avatar en jeu) ne part dans une liste publique. Le dessin se fait comme chez
les amis : `FZART.dessinAvatar(avatar, 'buste')`.

`avatar: null` : le joueur n'a pas de Fanzzy équipé. L'écran pose l'initiale du
pseudo.

### Le niveau

`"niveau": 7`, un entier de 1 à 30. **Absent** si l'XP du joueur est
illisible : l'écran n'affiche pas de niveau (jamais « NIV. 1 » par défaut).

### Où

Chaque ligne de joueur reçoit `avatar` et `niveau`, en plus de ses champs
actuels :

| route | lignes |
|---|---|
| `GET /api/rank/supporters` | `classement[]` |
| `GET /api/rank/duellistes` | `classement[]` |
| `GET /api/rank/entrainements` | `classement[]` |
| `GET /api/rank/competition/:id` | `joueurs[]` (pas `tribunes[]` ni `kops[]`, qui sont des groupes) |
| `GET /api/kop/:id` | `membres[]` |
| `GET /api/amis` | `amis[]`, `recues[]`, `envoyees[]` : **`niveau` seulement** (l'avatar y est déjà) |
| `GET /api/amis/suggestions` | chaque suggestion : **`niveau` seulement** |
| `GET /api/rank/moi` | à la racine : ma propre ligne, `avatar` absent quand le serveur ne sait pas (§ 14.3) |

Seuls les comptes actifs apparaissent dans les classements. Ailleurs (membres
d'un KOP), un compte supprimé garde sa ligne, mais avec `avatar: null` et sans
`niveau` : on ne montre jamais le personnage d'un compte effacé.

### Absence

Un serveur d'avant le contrat ne sert ni `avatar` ni `niveau` : repli sur
l'initiale, pas de niveau. Un `avatar` présent mais dont le dessin manque
retombe comme partout ailleurs (repli de `fanzzy-art.js`).

### Lecteurs

`classement.html` (podium, lignes, ma ligne), `kop.html` (membres en tribune),
`amis.html` (niveau sous le buste), `teletext.html` (classement d'une
compétition).

---

## 4. La cote avant/après et l'évolution du rang (point 4)

### 4.1 Le bilan d'un duel classé

Socket `nvn:fin`, champ `gains.cote` :

```json
"gains": {
  "echarpes": 60, "pourSonClub": true, "xp": 35, "kop": null,
  "niveau": { … § 1 … },
  "cote": { "avant": 1034, "apres": 1052, "delta": 18 }
}
```

| champ | type | sens |
|---|---|---|
| `avant` | entier ≥ 600 | cote avant ce duel |
| `apres` | entier ≥ 600 | cote après, celle que le classement des duellistes lira |
| `delta` | entier signé | `apres − avant` |

**Absent** pour un entraînement, contre des bots seuls, ou si la base n'a pas
pu lire la cote : pas de ligne de cote dans le bilan. Les autres champs de
`gains` restent ceux d'aujourd'hui.

### 4.2 L'évolution de « ma ligne »

`GET /api/rank/moi` → champ `evolution` :

```json
"evolution": {
  "depuis": "2026-10-01",
  "ferveur": { "rang": 3 },
  "duels": { "rang": -1, "cote": 18 },
  "entrainements": { "rang": 0 }
}
```

- `depuis` : le jour de jeu de la photo à laquelle on compare (R4). C'est
  toujours un jour **antérieur** à aujourd'hui.
- `rang` : **positif = on a monté** (`rang d'avant − rang d'aujourd'hui`).
- `ferveur.rang` compare le rang de la **saison** (`saison.rang`, § 5.2),
  celui de la liste SAISON au-dessus de laquelle la ligne est épinglée. Pas le
  rang de tous les temps.
- `cote` : `cote d'aujourd'hui − cote d'avant`.
- Une sous-clé est absente si l'une des deux valeurs manque (pas classé hier,
  ou pas aujourd'hui). `evolution` entier est absent tant qu'aucune photo d'un
  jour précédent n'existe.

Le serveur garde **deux** photos : celle du dernier jour vu avant aujourd'hui,
et celle d'aujourd'hui. À la première lecture d'un nouveau jour, la photo
d'aujourd'hui devient la photo de référence. Toutes les lectures d'une même
journée rendent donc la même évolution, comparée au dernier jour vu. Une seule
photo ferait tomber la flèche à zéro dès la deuxième lecture du jour. Les
flèches des **autres** lignes restent en mémoire locale (brief du lot 5) : le
serveur ne les sert pas dans cette vague.

### Lecteurs

`duel-nvn.html` (bilan, lot 6), `classement.html` (▲ de ma ligne épinglée),
`profil.html`.

---

## 5. Les paliers de collection et de rang (point 5)

### 5.1 Collection : les crans et les séries complètes

`GET /api/fanzzy/bibliotheque` → champ `paliers` :

```json
"paliers": {
  "cran": 25,
  "gagnes": 63,
  "possibles": 445,
  "prochain": { "a": 75, "manque": 12, "gain": { "echarpes": 25, "packs": 0, "xp": 0, "tampons": 0 } },
  "aReclamer": [
    { "sorte": "cran", "cle": "50", "gain": { "echarpes": 25, "packs": 0, "xp": 0, "tampons": 0 } }
  ],
  "series": [
    { "id": "RP", "possedes": 35, "total": 35, "etat": "pret",
      "gain": { "echarpes": 100, "packs": 1, "xp": 0, "tampons": 0 } }
  ]
}
```

| champ | type | sens |
|---|---|---|
| `cran` | entier | taille d'un cran, en objets |
| `gagnes` | entier | objets gagnés **sans les tenues** : `total.gagnes` − `types.tenues.gagnes` de la même réponse (`ECARTS.md`, fanzzy § 8) |
| `possibles` | entier | l'univers des crans, **sans les tenues** : `total.possibles` − `types.tenues.possibles` |
| `prochain` | objet | le prochain cran : son seuil `a`, ce qui `manque`, son `gain` ; absent quand tout est gagné |
| `aReclamer` | tableau | crans et séries complètes atteints et pas encore récupérés ; `[]` si rien |
| `series[]` | tableau | une entrée par série ouverte : `possedes`, `total`, `etat` ∈ `"a_venir"` \| `"pret"` \| `"reclame"`, et le `gain` de la série complète |

**Les tenues ne comptent pas dans les crans** (*révisé le 3 octobre 2026,
`ECARTS.md`, fanzzy § 8*) : l'abonnement les ouvre toutes, et ce qu'il ouvre
ne paie pas. Elles se collectionnent toujours dans la bibliothèque (`total`,
`types`, `parFanzzy`). `gagnes`, `possibles`, `prochain.a`, `prochain.manque`
et `aReclamer` se lisent sur le compte des crans : un écran met `gagnes` sous
`prochain.a` ou sur `possibles`, **jamais `total.gagnes`**.

Un cran est payé **une fois**, au seuil franchi le plus haut : si le compte
baisse (une pièce ou un personnage dépublié) ou si la taille du cran change,
rien n'est repris ni repayé. Le booster « tous les quatre crans » est déjà
compris dans le `gain` du cran concerné.

**Réclamer** : `POST /api/fanzzy/palier`, avec

```json
{ "sorte": "cran", "cle": "50" }
{ "sorte": "serie", "cle": "RP" }
{ "tout": true }
```

Réponse R6, avec `paliers` à jour à la racine. Avec `tout`, `gain` est la
somme versée, et `verse` est faux s'il n'y avait rien à verser
(`raison: "incomplet"`).

**Absence.** `paliers` absent : interrupteur coupé ou schéma incomplet. L'écran
montre sa jauge de collection sans récompense ni bouton.

**Lecteurs.** `collection.html` (l'anneau du collectionneur,
`gagnes / prochain.a` — le prochain cran, `possibles` quand tout est gagné —,
le gain du prochain cran, RÉCUPÉRER ; `gagnes / possibles` n'y est plus que
dans l'étiquette de l'anneau et dans le titre de palier), `fanzzy.html`
(page de série : tampon COMPLET), `index.html` (la tuile COLLECTION,
`gagnes / prochain.a`). Les deux écrans affichent le même `gagnes` contre le
même seuil ; `total.gagnes` n'est dit que dans leurs étiquettes (`ECARTS.md`,
accueil § 5). *Révisé le 4 octobre 2026 : ce paragraphe donnait à l'anneau
`gagnes / possibles`, ce qu'il montrait avant le lot 4 ; un anneau sur
l'univers des crans restait vide à l'œil (« 10 / 3311 », 0,3 %) à côté du
sticker qui promettait le cran de 25.*

### 5.2 Rang : les divisions de saison

`GET /api/rank/moi` → champ `saison` :

```json
"saison": {
  "id": 1, "numero": 1, "nom": "La reprise",
  "fin": "2026-12-20", "joursRestants": 78, "finie": false,
  "ferveur": 41250,
  "rang": 128, "sur": 1403,
  "division": { "n": 3, "id": "fervent", "nom": "FERVENT" },
  "prochaine": { "n": 4, "id": "ultra", "nom": "ULTRA", "seuil": 100000, "manque": 58750 },
  "paliers": [
    { "n": 2, "id": "habitue", "nom": "HABITUÉ", "seuil": 5000, "etat": "reclame",
      "gain": { "echarpes": 0, "packs": 0, "xp": 0, "tampons": 0 } },
    { "n": 3, "id": "fervent", "nom": "FERVENT", "seuil": 30000, "etat": "pret",
      "gain": { "echarpes": 0, "packs": 0, "xp": 0, "tampons": 0 } },
    { "n": 4, "id": "ultra", "nom": "ULTRA", "seuil": 100000, "etat": "a_venir",
      "gain": { "echarpes": 0, "packs": 0, "xp": 0, "tampons": 0 } },
    { "n": 5, "id": "capo", "nom": "CAPO", "seuil": 300000, "etat": "a_venir",
      "gain": { "echarpes": 0, "packs": 0, "xp": 0, "tampons": 0 },
      "titre": "Capo de la saison 1" }
  ],
  "aReclamer": 1
}
```

**Une division ne verse rien de matériel.** Son `gain` garde la forme R5,
quatre zéros, et l'écran n'en affiche rien. Ce qu'elle donne, c'est l'insigne
(`division.id`, la couleur de l'écharpe) et, pour Capo, le `titre`.
RÉCUPÉRER, c'est « porter l'insigne » : le geste existe, sans montant. La
raison est juridique et elle tient au code : la ferveur classée n'a pas de
plafond pour un abonné (`SERVEUR.md`, § 6).

| champ | type | sens |
|---|---|---|
| `id`, `numero`, `nom` | | la saison en cours |
| `fin`, `joursRestants`, `finie` | | la fin de la saison, au sens du § 7.1 : `fin` et `joursRestants` **absents** tant qu'aucune date n'est saisie, `finie` toujours présent (§ 14.4) |
| `ferveur` | entier | ferveur **classée** de la saison (Virage compté et duel classé, depuis son lancement) |
| `rang`, `sur` | entiers | ma place dans la liste `supporters?periode=saison` et le nombre de classés de cette liste ; **absents** tant que `ferveur` vaut 0. Ce sont eux que la ligne épinglée sous l'onglet SAISON affiche. Les champs `rang` et `sur` à la racine de `/moi` gardent leur sens d'aujourd'hui (tous les temps, période `toujours`). |
| `division` | objet | la division atteinte ; **absente** tant que `ferveur` vaut 0 |
| `division.n` | entier 1–5 | 1 Sympathisant, 2 Habitué, 3 Fervent, 4 Ultra, 5 Capo |
| `division.id` | `"sympathisant"` \| `"habitue"` \| `"fervent"` \| `"ultra"` \| `"capo"` | clé fermée, pour la couleur de l'insigne |
| `division.nom` | chaîne | le mot à écrire |
| `prochaine` | objet | la division suivante, son `seuil` et ce qui `manque` ; absente à Capo |
| `paliers[]` | tableau | les divisions 2 à 5, chacune avec `etat` ∈ `"a_venir"` \| `"pret"` \| `"reclame"`, son `gain` (quatre zéros), et `titre` quand elle en donne un |
| `aReclamer` | entier | nombre de divisions `pret` |

Une division récupérée reste acquise pour la saison. Une division atteinte et
non récupérée suit le seuil du moment : si l'administration le relève, elle
peut redevenir `a_venir`. Elle reste récupérable **après** la fin de la
saison : elle apparaît alors dans `saisonPassee` (ci-dessous).

```json
"saisonPassee": { "id": 1, "numero": 1, "nom": "La reprise",
  "paliers": [ { … seulement ceux à l'état "pret" … } ] }
```

`saisonPassee` est **une seule saison** : la plus récente des saisons finies
qui a encore une division `pret`. Quand elle est vidée, la précédente prend sa
place à la lecture suivante. La fin d'une saison est la fin de son jour
`fin`, ou le lancement de la saison suivante s'il vient avant (ou si `fin`
n'a jamais été saisi).

**Réclamer** : `POST /api/rank/division`, avec `{ "saison": 1, "id": "fervent" }`
ou `{ "tout": true }`. `saison` est l'**`id`** de la saison (pas son `numero`). Réponse R6, avec `saison` (et `saisonPassee` s'il
existe) à jour à la racine. Pour une division, `verse` vaut vrai, `gain` vaut
quatre zéros, `wallet` est inchangé et `niveau` est absent : l'écran montre
l'insigne posée (et le titre pour Capo), pas un montant.

**Les titres gagnés.** `GET /api/rank/moi` → `titres`, absent si aucun :

```json
"titres": [{ "nom": "Capo de la saison 1", "source": "division", "saison": 1 },
           { "nom": "Revenu pour de bon", "source": "carnet", "saison": 1 }]
```

**Dans les listes.** `GET /api/rank/supporters?periode=saison` : chaque ligne
porte en plus `"division": 3` (l'entier `n`), absent si 0. Les autres périodes
et les autres classements ne la portent pas.

**Absence.** `saison` absent : interrupteur coupé, aucune saison lancée, ou
schéma incomplet. Pas de nœuds de division, pas d'insigne.

**Lecteurs.** `classement.html` (nœuds de division, insigne des lignes de la
période saison, ma ligne), `profil.html` (division, titres), `aide.html`
(rail DE LA SAISON : lien vers les divisions).

### 5.3 Le classement « saison » change de sens

`GET /api/rank/supporters?periode=saison` compte désormais **la saison en
cours**, de son lancement à sa fin. Il comptait jusqu'ici tout depuis
toujours. Une période nouvelle, `periode=toujours`, sert l'ancien cumul.
`periode=mois` ne change pas. Un écran qui affiche « SAISON 1 » au-dessus de
la liste dit enfin vrai.

**La ligne épinglée suit la liste qu'elle surmonte.** Sous SAISON, elle lit
`saison.rang` et `saison.sur` (§ 5.2) ; sous TOUJOURS, `rang` et `sur` à la
racine de `/moi`, qui gardent leur sens. Sous MOIS, rien de nouveau. Une place
calculée sur une autre fenêtre que la liste serait fausse, et le code le dit
déjà en tête de `maPlace`.

---

## 6. Le quotidien : missions, sachet, bonus, série, carnet (point 6)

### 6.1 L'état du jour

`GET /api/quotidien` (session requise ; `?retour=1` ajoute le bloc `depuis`,
voir § 8).

```json
{
  "actif": true,
  "jour": "2026-10-02",
  "finDuJourMs": 25187000,

  "bonus": {
    "pret": true,
    "carte": {
      "case": 3, "cases": 7, "prise": false,
      "montants": [
        { "echarpes": 20, "packs": 0, "xp": 0, "tampons": 0 },
        { "echarpes": 25, "packs": 0, "xp": 0, "tampons": 0 },
        { "echarpes": 30, "packs": 0, "xp": 0, "tampons": 0 },
        { "echarpes": 35, "packs": 0, "xp": 0, "tampons": 0 },
        { "echarpes": 40, "packs": 0, "xp": 0, "tampons": 0 },
        { "echarpes": 45, "packs": 0, "xp": 0, "tampons": 0 },
        { "echarpes": 50, "packs": 1, "xp": 0, "tampons": 0 }
      ]
    },
    "gain": { "echarpes": 30, "packs": 0, "xp": 0, "tampons": 0 }
  },

  "serie": { "jours": 5, "record": 9 },

  "missions": {
    "jour": "2026-10-02",
    "liste": [
      { "rang": 0, "id": "boosters", "difficulte": "facile",
        "titre": "Ouvre 3 boosters", "ou": "/boosters", "bouton": "Ouvrir un booster",
        "cible": 3, "fait": 1, "unite": "boosters",
        "gain": { "echarpes": 30, "packs": 0, "xp": 20, "tampons": 1 },
        "etat": "en_cours", "relancable": true },
      { "rang": 1, "id": "victoire", "difficulte": "moyenne",
        "titre": "Gagne un duel", "ou": "/duel-nvn", "bouton": "Jouer un duel",
        "cible": 1, "fait": 1, "unite": "victoires",
        "gain": { "echarpes": 60, "packs": 0, "xp": 40, "tampons": 1 },
        "etat": "pret", "relancable": false },
      { "rang": 2, "id": "mitemps", "difficulte": "difficile",
        "titre": "Chante 10 fois dans chaque mi-temps d’un même match",
        "ou": "/virage", "bouton": "Entrer dans le Virage",
        "cible": 10, "fait": 0, "unite": "chants_par_mi_temps",
        "gain": { "echarpes": 100, "packs": 0, "xp": 60, "tampons": 2 },
        "etat": "en_cours", "relancable": true }
    ],
    "relances": 1,
    "sachet": { "etat": "en_cours", "faites": 0, "sur": 3,
                "gain": { "echarpes": 0, "packs": 1, "xp": 0, "tampons": 1 } }
  },

  "carnet": {
    "saison": { "id": 1, "numero": 1, "nom": "La reprise" },
    "close": false,
    "tampons": 37,
    "paliers": [
      { "n": 1, "tampons": 10, "nom": "De retour", "etat": "reclame",
        "gain": { "echarpes": 100, "packs": 0, "xp": 0, "tampons": 0 } },
      { "n": 2, "tampons": 40, "nom": "Dans le bain", "etat": "a_venir", "insigne": "lisere",
        "gain": { "echarpes": 150, "packs": 1, "xp": 0, "tampons": 0 } },
      { "n": 3, "tampons": 100, "nom": "Remis en voix", "etat": "a_venir", "insigne": "tampon",
        "gain": { "echarpes": 250, "packs": 2, "xp": 0, "tampons": 0 } },
      { "n": 4, "tampons": 180, "nom": "Au rendez-vous", "etat": "a_venir",
        "gain": { "echarpes": 400, "packs": 3, "xp": 0, "tampons": 0 } },
      { "n": 5, "tampons": 260, "nom": "Revenu pour de bon", "etat": "a_venir",
        "titre": "Revenu pour de bon",
        "gain": { "echarpes": 600, "packs": 4, "xp": 0, "tampons": 0 } }
    ],
    "prochain": { "n": 2, "manque": 3 }
  },

  "aReclamer": 2
}
```

#### Racine

| champ | type | sens |
|---|---|---|
| `actif` | booléen | `false` : le serveur n'a pas les tables du quotidien. La réponse est alors `{ "actif": false }` et rien d'autre. |
| `jour` | `"AAAA-MM-JJ"` | le jour de jeu |
| `finDuJourMs` | entier | temps restant jusqu'au prochain jour de jeu (compte juste les jours de 23 h et de 25 h) |
| `aReclamer` | entier ≥ 0 | ce qu'un RÉCUPÉRER verserait maintenant : bonus prêt, missions prêtes (aujourd'hui et hier), sachets prêts, paliers du carnet prêts (saison en cours, et la seule saison passée servie dans `saisonPassee`), relais. Il ne compte **que ce que la réponse montre** : une pastille qui annonce ce qu'aucun écran ne peut afficher est un bug. **Ne compte pas** les crans (§ 5.1) ni les divisions (§ 5.2). C'est le chiffre de la pastille MISSIONS (R10). |

#### `bonus` — la carte de présence

Absent si l'interrupteur `bonus.actif` est coupé.

| champ | type | sens |
|---|---|---|
| `pret` | booléen | le bonus d'aujourd'hui peut être récupéré |
| `carte.case` | entier 1–7 | la case d'**aujourd'hui** : celle que RÉCUPÉRER cochera, ou celle cochée aujourd'hui. C'est le « J3 » de la bulle du Fanzzy. Ce nombre ne descend jamais d'un jour à l'autre, sauf pour repartir à 1 après la septième case. |
| `carte.cases` | entier | 7 |
| `carte.prise` | booléen | la case d'aujourd'hui est cochée |
| `carte.montants` | tableau de 7 gains | la valeur de chaque case, la septième avec son booster |
| `gain` | gain | ce que RÉCUPÉRER versera ; **présent seulement si `pret`** |

Les cases avant `case` sont cochées. Celles après sont à venir. Un jour manqué
ne décoche rien.

#### `serie` — les jours d'affilée

`{ "jours": 5, "record": 9 }` : jours consécutifs où le bonus a été récupéré, y
compris hier si aujourd'hui ne l'est pas encore, et le plus long passage
jamais fait. **Absent** seulement quand `record` vaut 0 (aucun bonus jamais
récupéré). `jours` peut valoir 0 : la série est retombée, le record reste, et
le profil le montre. L'écran n'écrit « 5ᵉ JOUR D'AFFILÉE » que si
`jours ≥ 3`. Il ne dit **rien** quand la série retombe, et aucun écran ne
prévient d'une perte à venir.

#### `missions` — les trois missions et le sachet

Absent si l'interrupteur `missions.actif` est coupé ou si aucune mission n'a pu
être tirée.

| champ | type | sens |
|---|---|---|
| `jour` | `"AAAA-MM-JJ"` | le jour de ces missions (à renvoyer pour réclamer) |
| `liste` | 1 à 3 missions | rangs 0 (facile), 1 (moyenne), 2 (difficile), dans cet ordre. Normalement trois ; une difficulté dont toutes les missions sont éteintes depuis l'administration n'en a pas. |
| `relances` | entier ≥ 0 | relances encore permises aujourd'hui |
| `sachet` | objet | `etat` ∈ `"en_cours"` \| `"pret"` \| `"reclame"`, `faites` (missions **récupérées**), `sur` (le nombre de missions de `liste`), `gain` |
| `hier` | objet | missions et sachet **d'hier** encore récupérables ; absent s'il n'y en a pas (voir plus bas) |

Une mission :

| champ | type | sens |
|---|---|---|
| `rang` | 0 \| 1 \| 2 | son emplacement |
| `id` | chaîne, liste fermée ci-dessous | |
| `difficulte` | `"facile"` \| `"moyenne"` \| `"difficile"` | |
| `titre` | chaîne | l'intitulé, cible comprise, à afficher tel quel |
| `ou` | chemin | la page où elle se fait |
| `bouton` | chaîne | le libellé du geste qui y mène |
| `cible` | entier ≥ 1 | |
| `fait` | entier 0–`cible` | progression, plafonnée à la cible |
| `unite` | liste fermée ci-dessous | ce que comptent `fait` et `cible` |
| `gain` | gain | ce que la mission versera, figé au tirage |
| `etat` | `"en_cours"` \| `"pret"` \| `"reclamee"` | `pret` : `fait = cible` et pas récupérée |
| `relancable` | booléen | vrai si une relance reste, si la mission n'est pas finie, et si une autre mission de même difficulté est possible ; toujours faux dans `hier` |

Identifiants (`id`) et unités, **liste fermée** de cette vague :

| id | difficulté | cible | unite |
|---|---|---|---|
| `boosters` | facile | 3 | `boosters` |
| `duel` | facile | 1 | `duels` |
| `virage` | facile | 10 | `chants` |
| `grandir` | facile | 1 | `evolutions` |
| `tribune` | moyenne | 40 | `chants` |
| `victoire` | moyenne | 1 | `victoires` |
| `classes` | moyenne | 2 | `duels` |
| `club_virage` | moyenne | 20 | `chants` |
| `club_duel` | moyenne | 1 | `duels` |
| `victoires` | difficile | 3 | `victoires` |
| `endurance` | difficile | 5 | `duels` |
| `mitemps` | difficile | 10 | `chants_par_mi_temps` |
| `ailleurs` | difficile | 2 | `competitions` |

Un écran qui reçoit un `id` ou une `unite` qu'il ne connaît pas affiche quand
même `titre`, `fait / cible` et `gain` : il n'a jamais besoin de connaître la
mission pour la montrer. La vignette se choisit par `ou`, et à défaut par
`difficulte`.

Ce que `fait` compte, pour les textes d'aide (le serveur seul l'applique) :
un duel compte s'il a duré **au moins 60 secondes** et que le joueur ne l'a
pas quitté ; les chants d'un match comptent pour le jour de jeu de son **coup
d'envoi**, même s'ils ont été poussés après minuit.

`hier` a la même forme que le bloc du jour, réduite à ce qui est récupérable :

```json
"hier": { "jour": "2026-10-01",
  "liste": [ { … missions d'hier à l'état "pret" seulement … } ],
  "sachet": { … présent seulement s'il est "pret" … } }
```

Une mission terminée reste récupérable jusqu'à la fin du jour suivant. Au-delà,
elle n'est plus servie.

#### `carnet` — les tampons de la saison

Absent si l'interrupteur `saison.carnet_actif` est coupé, ou si aucune saison
n'est lancée.

| champ | type | sens |
|---|---|---|
| `saison` | `{ id, numero, nom }` | la saison en cours |
| `close` | booléen | la date de fin est passée : aucune mission tirée depuis ne remplit ce carnet, mais les paliers atteints restent récupérables (entre la fin d'une saison et le lancement de la suivante). Les missions du dernier jour, récupérées le lendemain, y ajoutent encore leurs tampons : `tampons` peut donc monter le premier jour de `close`. |
| `tampons` | entier ≥ 0 | tampons gagnés dans cette saison |
| `paliers[]` | tableau | `n`, `tampons` (seuil), `nom`, `etat` ∈ `"a_venir"` \| `"pret"` \| `"reclame"`, `gain`, et selon le palier `insigne` ∈ `"lisere"` \| `"tampon"` et `titre` (chaîne) |
| `prochain` | `{ n, manque }` | le prochain palier à atteindre ; absent quand tout est atteint |

#### `relais` et `saisonPassee`

```json
"relais": { "saison": { "id": 1, "numero": 1, "nom": "La reprise" }, "tampons": 37,
            "gain": { "echarpes": 0, "packs": 2, "xp": 0, "tampons": 0 } }
```

Présent **seulement** quand le cadeau de passage de relais est récupérable : une
nouvelle saison est lancée, et le joueur avait assez de tampons dans la
précédente.

```json
"saisonPassee": { "saison": { "id": 1, "numero": 1, "nom": "La reprise" },
  "paliers": [ { … paliers du carnet de cette saison à l'état "pret" … } ] }
```

Présent seulement si une saison terminée a des paliers de carnet atteints et pas
récupérés. C'est **une seule saison**, la plus récente dans ce cas ; la
précédente prend sa place quand celle-ci est vidée (même règle qu'au § 5.2).

#### `insignes` — les insignes du carnet que le joueur porte

*Ajouté le 3 octobre 2026 (`ECARTS.md`, quotidien § 11). Aucun autre champ ne
change.*

```json
"insignes": [
  { "id": "lisere", "saison": { "id": 1, "numero": 1, "nom": "La reprise" } },
  { "id": "tampon", "saison": { "id": 1, "numero": 1, "nom": "La reprise" } }
]
```

| champ | type | sens |
|---|---|---|
| `id` | `"lisere"` \| `"tampon"` | l'insigne : les valeurs de `carnet.paliers[].insigne`, liste fermée. `lisere` : le liseré de la saison autour de l'anneau du buste ; `tampon` : le tampon de la saison sur la carte de supporter |
| `saison` | `{ id, numero, nom }` | la saison du carnet qui l'a donné, de la même forme que `carnet.saison`. C'est `numero` que l'écran écrit (« LISERÉ S1 ») ; il ne le tire jamais de `nom` (R7) |

- **Un insigne par palier récupéré.** Il est servi dès que la ligne `carnet`
  du grand livre qui le porte est écrite, jamais pour un palier seulement
  atteint (`pret`). La réponse de la réclamation qui le pose le porte déjà,
  dans son `quotidien` (§ 6.2) : l'écran n'a rien à relire.
- **Porté pour toujours**, comme un titre (§ 5.2) : servi pour toutes les
  saisons, en cours, finies ou passées, remises en brouillon par
  l'administration comprises, et même quand l'interrupteur
  `saison.carnet_actif` est coupé (`carnet` absent, `insignes` présent).
- **Ordre** : par numéro de saison croissant, puis dans l'ordre des paliers
  du carnet. **Au plus un** par saison et par `id` : deux paliers d'un même
  carnet qui donneraient le même insigne n'en font qu'un.
- **Les divisions n'y sont pas** : l'insigne d'une division est
  `saison.division.id` de `GET /api/rank/moi` (§ 5.2). `insignes` ne parle
  que du carnet.
- **Rien ne se compte** : `aReclamer` ne compte jamais un insigne, il compte
  le palier qui le donne tant qu'il est `pret`.
- **Coût** : aucune lecture de plus. La lecture du grand livre que l'état du
  jour fait déjà porte la colonne.

**Absence.** `insignes` est **absent** quand le joueur n'en porte aucun
(jamais `[]`), et avec `{ "actif": false }`. Il l'est aussi quand le serveur
ne sait pas nommer la saison : saisons pas chargées, une faute de montage
(le carnet s'éteint avec), ou saison supprimée depuis par l'administration (retirée
puis supprimée : la ligne du grand livre reste, l'écran n'aurait pas de
numéro à écrire). Un `id` que l'écran ne connaît pas ne se dessine pas.

**Lecteurs.** `profil.html` (le liseré sur l'anneau du buste, le tampon sur
la carte de supporter, par `GET /api/quotidien` qu'il lit déjà),
`aide.html` (« LISERÉ S1 », « TAMPON S1 » et leur petit dessin sur les
paliers du carnet ; posé seulement quand l'insigne est servi ici).

### 6.2 Les gestes

Toutes ces routes sont des `POST` avec un corps JSON. Elles répondent selon
R6, avec à la racine `quotidien` : l'état complet du § 6.1 (sans `depuis`).

| route | corps | ce qu'elle fait |
|---|---|---|
| `POST /api/quotidien/bonus` | `{}` | coche la case du jour et verse son gain |
| `POST /api/quotidien/mission` | `{ "jour": "2026-10-02", "rang": 1, "id": "victoire" }` | recompte, puis verse la mission |
| `POST /api/quotidien/sachet` | `{ "jour": "2026-10-02" }` | verse le sachet si toutes les missions de ce jour sont récupérées |
| `POST /api/quotidien/relance` | `{ "rang": 2, "id": "mitemps" }` | remplace une mission d'aujourd'hui (voir plus bas) |
| `POST /api/quotidien/carnet` | `{ "saison": 1, "n": 2 }` | verse un palier du carnet (saison en cours ou passée) |
| `POST /api/quotidien/relais` | `{}` | verse le cadeau de passage de relais |
| `POST /api/quotidien/tout` | `{}` | verse tout ce que compte `aReclamer`, dans l'ordre bonus, missions, sachets, carnet, relais ; `gain` est la somme |

- `jour`, `rang` et `id` **identifient la ligne affichée**. Le serveur ne s'en
  sert jamais pour calculer un montant : il verse ce que la ligne porte en
  base. Si la mission a changé entre-temps (relance dans un autre onglet), la
  réponse est `raison: "change"`.
- `jour` doit être aujourd'hui ou hier, au sens du serveur. Plus ancien :
  `raison: "jour_passe"`.
- Dans `carnet`, `saison` est l'**`id`** de la saison (`carnet.saison.id` ou
  `saisonPassee.saison.id`), pas son `numero`.
- `relance` répond `{ "relancee": true, "quotidien": { … } }`, ou
  `{ "relancee": false, "raison": "epuisees" | "aucune" | "terminee" | "change" | "inactif", "quotidien": { … } }`.
  Une mission prête ou récupérée ne se relance pas (`terminee`). La mission
  de remplacement garde le `gain` de la ligne remplacée, celui promis le matin.
- `tout` est le « TOUT RÉCUPÉRER » du tiroir. Si le disjoncteur quotidien
  s'arrête en route, ce qui a été versé l'est, `verse` vaut vrai, et la réponse
  ajoute `"reste": <entier>`, le nombre d'éléments restés dus.

### Absence

| situation | ce que l'écran fait |
|---|---|
| 404, 503, réseau (ancien serveur) | rien de quotidien : le hub garde ses quatre autres états (direct, prochain coup d'envoi, premiers pas, répéter un geste) ; `/aide` n'a ni DU JOUR ni DE LA SAISON ; pas de pastille |
| `{ "actif": false }` | idem |
| `bonus` absent | pas de plaque RÉCUPÉRER du bonus, pas de « J3 » |
| `serie` absent, ou `jours < 3` | rien sur le hub ; le profil montre `record` dès qu'il est servi |
| `missions` absent | pas de mission sur la bâche du jour, pas d'onglet DU JOUR |
| `carnet` absent | pas d'onglet DE LA SAISON (sauf si `/api/rank/moi` sert des divisions) |
| `insignes` absent | ni liseré autour du buste, ni tampon sur la carte de supporter |

### Lecteurs

`index.html` (bâche du jour : mission en cours avec sa jauge et son gain ;
plaque or RÉCUPÉRER du bonus, dont le gain vole vers le compteur ; bulle
« J3 »), `aide.html` (MISSIONS : rails DU JOUR et DE LA SAISON, tickets avec
tampon FAIT, RÉCUPÉRER), `menu.js` / `nav.js` (pastille par R10),
`profil.html` (série et record, insignes du carnet).

---

## 7. La saison datée (point 7)

### 7.1 La saison en cours

`GET /api/fanzzy/dex` et `GET /api/fanzzy/state` → champ `saison` (existe déjà).
Il garde ses champs actuels et en ajoute quatre :

```json
"saison": {
  "id": 1, "numero": 1, "nom": "La reprise", "texte": "…",
  "series": ["RP"], "tenues": [], "stuff": [], "actions": [], "stades": [],
  "lanceeA": "…", "lancee": true,
  "fin": "2026-12-20",
  "finDansMs": 6912000000,
  "joursRestants": 80,
  "finie": false
}
```

| champ | type | sens |
|---|---|---|
| `fin` | `"AAAA-MM-JJ"` | dernier jour de jeu de la saison ; **absent** tant qu'aucune date n'est saisie |
| `finDansMs` | entier ≥ 0 | temps restant jusqu'à la fin de ce jour ; absent sans `fin` |
| `joursRestants` | entier ≥ 0 | jours de jeu restants, aujourd'hui compris (« SAISON 1 · 80 JOURS ») ; 1 le dernier jour ; 0 une fois finie ; absent sans `fin` |
| `finie` | booléen | la date est passée ; la saison reste « en cours » jusqu'au lancement de la suivante, mais son carnet et ses divisions sont clos |

`/dex` est en cache public de 60 s : `finDansMs` peut avoir une minute de
retard, ce qui ne change rien à un compte en jours. `joursRestants` peut se
tromper d'un jour pendant l'heure qui précède minuit les deux dimanches de
changement d'heure. C'est accepté.

`saison` vaut `null` sans saison lancée (comme aujourd'hui).

### 7.2 La saison annoncée

`GET /api/fanzzy/dex` → champ `prochaine`, à la racine :

```json
"prochaine": { "id": 2, "numero": 2, "nom": "La trêve",
               "ouvre": "2026-12-21", "ouvreDansMs": 6998400000, "joursAvant": 81 }
```

**Présent seulement** si une saison en préparation porte une date d'ouverture
annoncée, et **jusqu'à la fin de ce jour-là** : le jour annoncé,
`ouvreDansMs` et `joursAvant` valent 0 (« AUJOURD'HUI »), tant que la saison
n'est pas lancée. Le lendemain, une annonce restée en brouillon disparaît :
on n'affiche pas une date dépassée. Poser cette date dans
l'administration, c'est décider de l'annoncer. Sans elle : aucun « SAISON 2 »
nulle part.

Et dans `sets[]` de `/dex`, chaque série que cette saison annoncée ouvrira
porte `"prochaine": 2` (le numéro). Absent pour les autres. Le kiosque n'écrit
« SAISON 2 » sur une série fermée que si ce champ est présent.

### 7.3 La récompense de saison

Ce sont le carnet (§ 6.1), le relais (§ 6.1) et les divisions (§ 5.2). Il n'y
a pas d'autre versement de fin de saison : un palier atteint reste
récupérable, sans limite de temps.

### Lecteurs

`boosters.html` (banderole de saison, sachets « SAISON 2 »), `classement.html`
(« SAISON 1 · 12 JOURS »), `duel-nvn.html` (préparation), `index.html`,
`aide.html`, `profil.html`.

---

## 8. « Depuis ta dernière visite » (point 8)

### 8.1 Le ticket

`GET /api/quotidien?retour=1` → champ `depuis`, quand la dernière visite
marquée date d'au moins `quotidien.retour_heures` (3 h par défaut) :

```json
"depuis": {
  "ilYaMs": 64800000,
  "amis": { "nouveaux": [{ "id": "…", "pseudo": "Lucas" }], "demandes": 1 },
  "kops": [{ "id": "…", "nom": "Les Ultras", "arrivees": ["Lucas"],
             "verse": 140, "pot": { "avant": 120, "apres": 260 },
             "votes": [{ "bonusId": "fumigenes", "issue": "adopte" }] }],
  "invitationsKop": 1,
  "matchs": [{ "fixtureId": 123, "domicile": "FC Sion", "exterieur": "FC Bâle",
               "score": [2, 1], "club": "FC Sion", "issue": "gagne" }],
  "souvenirs": 2,
  "saison": { "id": 2, "numero": 2, "nom": "La trêve" }
}
```

| champ | type | sens |
|---|---|---|
| `ilYaMs` | entier | durée depuis la dernière visite marquée |
| `amis.nouveaux` | tableau `{ id, pseudo }` | amitiés acceptées depuis (dans les deux sens), au plus 5 |
| `amis.demandes` | entier | demandes reçues et en attente, arrivées depuis |
| `kops[]` | tableau | par KOP du joueur où il s'est passé quelque chose : `arrivees` (pseudos, au plus 5), `verse` (écharpes versées au pot depuis), `pot` avant/après, `votes` clos depuis avec `issue` ∈ `"adopte"` \| `"rejete"` (les valeurs de la table `kop_votes`) |
| `invitationsKop` | entier | invitations à un KOP reçues depuis |
| `matchs[]` | tableau | matchs terminés des clubs suivis, au plus 3 : `issue` ∈ `"gagne"` \| `"nul"` \| `"perdu"` du point de vue de `club` |
| `souvenirs` | entier | cartes-souvenirs gagnées depuis |
| `saison` | `{ id, numero, nom }` | une saison lancée depuis |

Chaque sous-champ est **absent** quand il est vide. `depuis` entier est absent
s'il n'y a rien, si l'absence est plus courte que le seuil, ou si le joueur n'a
jamais été marqué (première visite). Le ticket ne parle **pas** d'écharpes :
aucun chiffre partiel.

### 8.2 Marquer la visite

`POST /api/quotidien/visite` `{}` → `{ "ok": true }`. Le hub l'envoie **après**
avoir montré le ticket (ou après la lecture, s'il n'y avait pas de ticket), à
chaque arrivée sur le hub. Un `GET` ne déplace jamais la marque : un aperçu de
lien ou un préchargement ne mange pas le ticket.

### Lecteurs

`index.html` / `ouverture.js` (le ticket qui glisse trois secondes au lever du
rideau).

---

## 9. Hors de cette vague : rien n'est servi

| donnée | ce que l'écran fait d'ici le lot 6 |
|---|---|
| présence (en ligne, au Virage, en duel) | servie, § 18 — **livrée éteinte** : tant que `presence.actif` est faux, rien n'est servi et aucun écran ne montre de présence. « REJOINDRE » n'existe pas |
| bilan de tribune du Virage, PARFAIT, meilleur geste, série officielle | servis, § 15 à § 17 |
| deltas de rang des autres lignes | mémoire locale de la page |
| titres sur les lignes des autres joueurs | rien |

---

## 10. Qui lit quoi

| page | lot | données de ce contrat |
|---|---|---|
| `index.html`, `ouverture.js` | 2 | § 6 (bâche du jour, bonus, J3), § 8 (ticket), § 2 (pastille COLLECTION), § 5.1 (crans), § 7 |
| `boosters.html` | 3 | § 1, § 2.3, § 7.1, § 7.2, § 13 |
| `boutique.html` | 3 | rien de nouveau (l'achat à l'étal crée une nouveauté, lue ailleurs) |
| `profil.html` | 5 | § 4.2, § 5.2 (division, titres), § 6 (série, record, insignes du carnet), § 7, § 14 (avatar, niveau, couleurs du club) |
| `classement.html` | 5 | § 3, § 4.2, § 5.2, § 5.3, § 7, § 14 (ma ligne) |
| `kop.html` | 5 | § 3 |
| `amis.html` | 5 / 6 | § 3 (niveau), § 18.1 (la pastille de présence) |
| `aide.html` (MISSIONS) | 5 | § 6, § 5.2 (lien), § 7 |
| `niveau-fete.js` | 5 | § 1 |
| `nav.js`, `menu.js` | 2 / 5 / 6 | R10, § 1 par `tbf:bourse` ; `menu.js` : § 18.2 (l'interrupteur « apparaître hors ligne ») |
| `fanzzy.html`, `collection.html`, `fanzzy-fiche.html` | 4 | § 2, § 5.1 |
| `virage.html` | 6 | § 1, § 15, § 16, § 18.3 |
| `duel-nvn.html` | 6 | § 1, § 4.1, § 7, § 16.1, § 17 |
| `geste.js`, `repetition.html` | 6 | § 16.1, § 17 (le verdict) |
| `teletext.html` | — | § 3 (compétition) |

---

## 11. Les raisons de refus (liste fermée)

| `raison` | sens | ce que l'écran dit |
|---|---|---|
| `deja` | déjà récupéré (autre onglet, double clic, réseau qui rejoue) | « Déjà récupéré » ; il relit l'état, sans erreur |
| `incomplet` | pas encore atteint, au recompte du serveur | il relit l'état ; la progression affichée était en avance |
| `jour_passe` | la ligne date d'avant-hier ou plus | « Les missions de ce jour sont closes » ; il relit |
| `change` | la mission affichée a été relancée ailleurs | il relit |
| `inactif` | l'interrupteur de cette source est coupé | il retire le bouton, sans message d'erreur |
| `plafond` | le disjoncteur du jour est atteint ; c'est dû demain. Jamais rendu pour un élément déjà versé : `deja` passe avant | « Tu récupéreras le reste demain » |
| `schema` | la base n'a pas les tables nécessaires | il retire le bloc |
| `inconnu` | palier, mission ou saison qui n'existe pas | il relit |
| `quota` | *(vague 2, l'XP du Virage, § 15.2)* `xp.virage_matchs_jour` matchs ont déjà rapporté leur XP ce jour de jeu ; jamais rendu pour un match déjà payé : `deja` passe avant | « Tes matchs du jour ont déjà rapporté leur XP », une fois, sans bouton |

Pour `relance` seulement : `epuisees` (plus de relance aujourd'hui), `aucune`
(aucune autre mission possible), `terminee` (mission prête ou récupérée).

Une erreur HTTP (400 corps mal formé, 401 sans session, 503 base indisponible)
garde la forme habituelle `{ "error": "<code>" }`. Codes nouveaux :
`quotidien.error.requete`, `fanzzy.error.vu_invalide`,
`fanzzy.error.palier_requete`, `rank.error.division_requete`, et pour la
vague 2 `presence.error.requete` (400, § 18.2), `presence.error.server`
(503, une panne inattendue de la présence, § 18.2 : l'écran la lit comme une
absence, R2) et `duel.error.fixture_annule` (le match est annulé ou reporté,
§ 17 : 400 `{ "error" }` sur `GET /api/deck/match/:id`, `nvn:error`
`{ "code" }` à l'entrée en file ; l'écran le dit par une phrase).

---

## 12. Changements de la relecture (à relayer aux lots 3 et 5)

Une relecture adverse du chantier a modifié ce contrat le 2 octobre 2026. Un
écran déjà écrit contre la version d'avant doit vérifier ces points, et
seulement ceux-là. Aucun champ n'a été renommé ni retiré.

| § | ce qui change | ce que l'écran fait |
|---|---|---|
| R6 | `wallet.packs` compte la recharge en attente ; l'XP est versée dans la même transaction ; pour `tout`, `niveau` agrège tous les versements | rien de plus : la valeur est juste, plus besoin de relire l'état pour la réserve |
| § 4.2 | `evolution` compare au **dernier jour vu avant aujourd'hui**, et `ferveur.rang` au rang de la saison | la flèche ne retombe plus à zéro à la deuxième lecture du jour |
| § 5.2 | les divisions ne versent rien : `gain` à quatre zéros ; RÉCUPÉRER = porter l'insigne (et le titre pour Capo) | n'afficher aucun montant de division ; écrire le geste comme « porter l'insigne » |
| § 5.2 | nouveaux `saison.rang` et `saison.sur` | la ligne épinglée sous SAISON les lit (§ 5.3) |
| § 5.2, § 6.1 | `saisonPassee` = une seule saison, la plus récente ; `aReclamer` ne compte que ce qui est servi | rien : la pastille et l'écran disent enfin la même chose |
| § 6.1 | `serie` présent dès que `record ≥ 1`, avec `jours` à 0 possible | le profil montre le record même quand la série est retombée |
| § 6.1 | `carnet.close` : les missions du dernier jour récupérées le lendemain comptent encore | rien |
| § 6.1 | ce que `fait` compte : duel d'au moins 60 s non quitté ; chants au jour du coup d'envoi | les textes d'aide de `/aide` peuvent le dire |
| § 6.2 | la relance garde le gain de la ligne remplacée | rien |
| § 3 | un compte supprimé, dans les membres d'un KOP : `avatar: null`, pas de `niveau` | repli sur l'initiale, déjà prévu |
| § 11 | `deja` passe avant `plafond` | rien |

---

## 13. La réserve du joueur et le prix d'un booster (ajout du 3 octobre 2026)

*Ajouté par le périmètre `fanzzy` à la demande du kiosque (`ECARTS.md`,
kiosque § 1 et § 2 ; fanzzy § 9). Aucun champ existant n'est renommé, retiré
ni changé : ce sont trois champs de plus.*

### 13.1 Le portefeuille : `wallet.cadenceMs` et `wallet.packMax`

Partout où le module des boosters sert `wallet` : `GET /api/fanzzy/state`,
`POST /api/fanzzy/open`, `POST /api/fanzzy/evolve`.

| champ | type | sens |
|---|---|---|
| `cadenceMs` | entier > 0 | la durée d'une recharge **pour ce joueur**, en millisecondes, abonnement compris ; toujours présent, réserve pleine comprise |
| `packMax` | entier ≥ 1 | le plafond de la réserve **pour ce joueur**, abonnement compris : la recharge s'arrête là ; absent si le réglage n'est pas un entier ≥ 1 (R1) |

- `maxPacks`, à la racine de `/state`, reste ce qu'il était : le plafond du
  **joueur gratuit**. Un écran qui dessine la réserve de ce joueur lit
  `wallet.packMax`, jamais `maxPacks`.
- `packs` peut dépasser `packMax` : un booster offert entre même dans une
  réserve pleine (R6).
- La part écoulée de la recharge en cours : `1 − nextPackInMs / cadenceMs`
  (`nextPackInMs` vaut `null` quand la réserve est pleine).
- **R9.** La forme est la même pour tous. Les deux valeurs sont la règle que
  l'abonnement change (le plafond et la cadence, `abonnement/index.js`), celle
  que `packs` et `nextPackInMs` montraient déjà ; ce ne sont pas des montants
  de récompense, et aucun gain de ce contrat n'en dépend.

### 13.2 L'ouverture : `paye`

`POST /api/fanzzy/open` → champ `paye`, à la racine de la réponse :

| champ | type | sens |
|---|---|---|
| `paye` | entier ≥ 0 | les écharpes prélevées par **cette** ouverture : le prix du booster (`pack.prix_echarpes`, celui qui vient d'être débité) quand la réserve était vide et le paquet demandé à l'achat (`buy: true`) ; `0` quand la réserve a payé, y compris pour un paquet demandé à l'achat |

- Toujours présent quand l'ouverture réussit ; un refus garde la forme
  `{ "error": "<code>" }`.
- `0` est une réponse (rien n'a été pris), pas un champ sans valeur au sens de
  R1 : l'écran ne pose alors aucun ticket, et ne déduit rien de l'écart des
  soldes.
- Le même nom et le même sens que `paye` dans la réponse d'un achat à l'étal
  (`POST /api/boutique/depenser`).

### Lecteurs

`boosters.html` et `cartes.js` (les fentes de la réserve, l'anneau de
recharge, le ticket « −45 » du booster acheté).

---

## 14. Ma place : `GET /api/rank/moi` en entier (déclaré le 3 octobre 2026)

*Mis d'accord avec ce que le serveur sert (`src/server/classements/index.js`,
`maPlace`) ; `ECARTS.md`, classement § 11. **Rien ne change dans la
réponse** : ce paragraphe écrit des champs qui étaient servis sans être
déclarés — `avatar` et `niveau` à la racine, `saison.fin`,
`saison.joursRestants` et `saison.finie`, `tribune.couleurs` — et rassemble
ceux que les § 4.2 et 5.2 décrivaient par morceaux. Aucun champ n'est
renommé ni retiré.*

Session requise (R8). Une réponse 404, 503 ou un réseau absent : R2.

```json
{
  "ferveur": 52800, "matchs": 41,
  "rang": 312, "sur": 1403,
  "plancher": 3,
  "duels": { "gagnes": 14, "joues": 22, "cote": 1052, "rang": 41, "sur": 380 },
  "entrainements": { "joues": 9, "gagnes": 6, "rang": 120, "sur": 610 },
  "tribune": { "id": 85, "nom": "Sion", "ferveur": 9860, "couleurs": ["#c8102e", "#ffffff"] },
  "avatar": { "id": "RP4", "age": "RP4B", "evo": 2, "nom": "Le Meneur",
              "skin": "base", "etat": null, "rar": "rare" },
  "niveau": 7,
  "saison": { "id": 1, "numero": 1, "nom": "La reprise",
              "fin": "2026-12-20", "joursRestants": 78, "finie": false,
              "ferveur": 41250, "rang": 128, "sur": 1403, "division": { … },
              "prochaine": { … }, "paliers": [ … ], "aReclamer": 1 },
  "titres": [ … ],
  "evolution": { … }
}
```

### 14.1 La racine

| champ | type | sens |
|---|---|---|
| `ferveur` | entier ≥ 0 | ferveur classée de **tous les temps** (Virage compté et duel classé), celle de `supporters?periode=toujours` |
| `matchs` | entier ≥ 0 | matchs différents où cette ferveur a été gagnée |
| `rang` | entier ≥ 1, ou `null` | ma place sur cette ferveur, tous les temps ; `null` tant que `ferveur` vaut 0 |
| `sur` | entier ≥ 0 | joueurs qui ont une ligne de ferveur classée (Virage compté ou duel classé), tous les temps. `rang` et `sur` comptent encore les comptes supprimés (`ECARTS.md`, classement § 9) : sous l'onglet SAISON, la ligne épinglée lit `saison.rang` et `saison.sur` (§ 5.3) |
| `plancher` | entier ≥ 1 | duels joués qu'il faut pour entrer dans les listes des duellistes et des entraînements |
| `duels` | objet | les duels classés : `gagnes`, `joues` (entiers ≥ 0) ; `cote`, la cote du dernier duel classé (entier, `null` sans aucun) ; `rang`, ma place dans la liste `duellistes` (entier, `null` sous le plancher) ; `sur`, les classés de cette liste |
| `entrainements` | objet | `joues`, `gagnes` (entiers ≥ 0) ; `rang`, ma place dans la liste `entrainements` (`null` sous le plancher) ; `sur`, les classés de cette liste |
| `tribune` | objet, ou `null` | le club où va ma ferveur (§ 14.2) ; `null` si je ne suis aucun club |
| `avatar` | objet, `null`, ou absent | mon personnage, de la forme du § 3 (§ 14.3) |
| `niveau` | entier 1–30, ou absent | mon niveau, tiré de mon XP (§ 14.3) |
| `saison`, `saisonPassee`, `titres` | | § 5.2, avec `saison.fin`, `saison.joursRestants` et `saison.finie` (§ 14.4) |
| `evolution` | | § 4.2 |

Les `null` de ce tableau sont les seuls de la réponse, en plus de ceux des
§ 3 et § 5.2 ; un champ marqué « absent » suit R1.

**Ce qui n'y est pas** : les insignes du carnet, servis par
`GET /api/quotidien` (§ 6.1, `insignes`) ; l'insigne d'une division est
`saison.division.id` (§ 5.2).

### 14.2 `tribune`

```json
"tribune": { "id": 85, "nom": "Sion", "ferveur": 9860, "couleurs": ["#c8102e", "#ffffff"] }
```

| champ | type | sens |
|---|---|---|
| `id` | entier | le club (l'identifiant de `follows[].team_id` de `/api/me/state`) |
| `nom` | chaîne | son nom |
| `ferveur` | entier ≥ 0 | ma ferveur classée pour ce club, tous les temps |
| `couleurs` | tableau de 1 ou 2 chaînes `"#rrggbb"` | les teintes du club, en minuscules, la principale d'abord ; une seconde égale à la première n'est pas servie. La forme de `couleurs` de `/api/kop/miens` et de `/api/kop/club/:teamId`, par la même fonction |

- **Quel club** : le club principal s'il y en a un parmi ceux que je suis,
  sinon celui où j'ai le plus de ferveur. L'écran qui peint l'écharpe du
  club principal vérifie que `tribune.id` est bien ce club.
- `couleurs` est **absent** quand le club n'a aucune teinte valide (blason
  pas encore extrait, ou base sans `sql/couleurs.sql`) : jamais de tableau
  vide. L'écran garde alors ses teintes par défaut.

### 14.3 `avatar` et `niveau`

Ma ligne porte mon personnage et mon niveau, **par la même règle que les
lignes des listes** (§ 3) : la même liste blanche, le même `avatar: null`
sans Fanzzy équipé, le même niveau tiré de l'XP.

| champ | présent | sens |
|---|---|---|
| `avatar` | objet de la forme du § 3 | le Fanzzy équipé, à l'âge, dans la tenue et l'expression qu'il montre ; `rar` dit la rareté qui choisit la plaque |
| `avatar` | `null` | aucun Fanzzy équipé : l'écran pose la silhouette ou l'initiale |
| `avatar` | **absent** | le serveur ne sait pas (catalogue pas chargé, table absente, lecture en échec) : l'écran garde ce qu'il savait d'ailleurs, sans conclure qu'il n'y a pas de Fanzzy |
| `niveau` | entier 1–30 | le niveau de mon XP |
| `niveau` | **absent** | XP illisible (pas de bourse, colonne absente) : aucun niveau affiché, jamais « NIV. 1 » |

### 14.4 La fin de la saison dans `saison`

Le bloc `saison` du § 5.2 porte aussi la fin de la saison en cours, **au
sens du § 7.1** et calculée de la même façon que `/dex` au même instant :
la ligne épinglée et le profil écrivent « SAISON 1 · 78 JOURS » sans lire
`/dex`.

| champ | type | sens |
|---|---|---|
| `fin` | `"AAAA-MM-JJ"` | dernier jour de jeu de la saison (R4) ; **absent** tant qu'aucune date n'est saisie |
| `joursRestants` | entier ≥ 0 | jours de jeu restants, aujourd'hui compris ; 1 le dernier jour, 0 une fois passée ; **absent** sans `fin` |
| `finie` | booléen | la date est passée ; **toujours présent**. Une saison finie reste dans `saison` (jamais dans `saisonPassee`) jusqu'au lancement de la suivante, sa ferveur figée, sans `prochaine` |

`/moi` ne sert **pas** `finDansMs` : le décompte à la seconde reste celui de
`/dex` (§ 7.1). `saisonPassee` ne porte aucun de ces trois champs.

### Lecteurs

`profil.html` (la carte de supporter : buste et plaque par `avatar`, niveau,
écharpe de tête par `tribune.couleurs` ; « SAISON 1 · 78 JOURS »),
`classement.html` (ma ligne épinglée : buste, rang de chaque échelle, la
tribune où va ma ferveur, la fin de la saison).

---

# Vague 2 — les arènes (lot 6)

*Versé le 4 octobre 2026 par `serveur-socle`, depuis `SERVEUR-VAGUE2.md` § 7
et avec les décisions de Gaël du 3 octobre 2026 (Q1 à Q4). Les règles R1 à
R10 du § 0 valent pour tout ce qui suit. Les écrans du lot 6 codent contre ce
texte avant que le serveur l'implémente : un champ décrit ici a exactement ce
nom, ce type et cette unité, et la colonne « absent » dit quand il manque.
Un serveur d'avant cette vague ne sert **rien** de ce qui suit : chaque
paragraphe dit ce que l'écran fait alors (R1, R2).*

*Retouché le 4 octobre 2026 au soir, après le correctif du Virage et les
rendus de la partie A : `classe` (§ 15.1), la fin lue dans l'état (§ 15.3),
`surgeMs` toujours servi (§ 16.2), la salle d'une entrée à l'autre (§ 16.5),
le but réel (§ 16.6), les champs du duel servis en chemin (§ 17), l'écran
après un `POST /api/presence` (§ 18.2). Aucun champ renommé ni retiré ; le
détail est dans `ECARTS.md`, `serveur-socle`, 9.*

*Retouché une dernière fois le même soir, sur les rendus du serveur de la
partie B : les chants après le coup de sifflet (§ 15.1), l'XP au départ
(§ 15.2), la fermeture de la tribune pour qui entre après la fin et les matchs
arrêtés (§ 15.3), la session et la cadence du bilan (§ 15.4), le plancher sous
un bonus de ferveur nul (§ 16.2), la route d'un match du duel, les couleurs de
la vue et les matchs annulés ou reportés (§ 17, § 11), le départ d'un ami qui
s'est caché (§ 18.2, § 18.3). Aucun champ renommé ni retiré ; le détail est
dans `ECARTS.md`, `serveur-socle`, 10.*

## 15. Le bilan de tribune du Virage

### 15.1 La demande et la réponse

Socket, la page → le serveur : **`virage:bilan`**, sans données. Le serveur →
**cette socket seule** : `virage:bilan`.

```json
{
  "fixtureId": 1208051, "side": 0, "fini": true,
  "classe": true, "neutre": false,
  "ferveur": 1240, "chants": 46, "parfaits": 9, "serie": 4,
  "meilleur": { "chant": "montee", "nom": "La montée", "verdict": "parfait" },
  "rang": 12, "sur": 298,
  "souvenirs": [{ "id": 88, "minute": 71, "joueur": "Kabashi" }],
  "xp": { "verse": true, "gain": { "echarpes": 0, "packs": 0, "xp": 15, "tampons": 0 },
          "wallet": { "scarves": 412, "packs": 7 }, "niveau": { "…": "§ 1" } }
}
```

| champ | type | sens | absent quand |
|---|---|---|---|
| `fixtureId` | entier | le match de la salle où est la socket | jamais |
| `side` | `0` \| `1` | le camp poussé (0 domicile, 1 extérieur) : celui de la ligne de présence, à défaut celui de la socket dans la salle | jamais |
| `fini` | `true` | le match est terminé (`FT`, `AET`, `PEN`) | en cours de match — jamais `false` |
| `classe` | booléen | ce Virage compte au classement. Faux : le plafond gratuit du jour (`abo.virages_classes_jour`) était atteint à l'entrée qui a précédé sa **première poussée** — c'est elle qui écrit la ligne, et la décision ne bouge plus ensuite ; regarder une tribune sans y pousser ne consomme rien du plafond (§ 16.5). La page écrit « ce Virage ne compte pas au classement » | sans ligne de présence |
| `neutre` | booléen | il poussait pour un club qu'il ne suit pas (sa ferveur comptait `ferveur.neutre`, la moitié par défaut) | sans ligne de présence |
| `ferveur` | entier ≥ 0 | la ferveur de ce match, **tous ses passages compris** (déconnexions, onglets, retours) | sans ligne de présence |
| `chants` | entier ≥ 0 | les chants acceptés par le serveur dans ce match | sans ligne de présence ; sans `sql/quotidien.sql` |
| `parfaits` | entier ≥ 0 | les chants au verdict `parfait` (§ 16.1) | sans ligne de présence ; sans `sql/arenes.sql` |
| `serie` | entier ≥ 2 | la meilleure série de `parfait` d'affilée du match | en dessous de deux ; sans `sql/arenes.sql` |
| `meilleur` | objet | le chant de la meilleure note du match : `chant` (identifiant du répertoire), `nom` (son nom, à écrire tel quel, R7), `verdict` (§ 16.1) — « PARFAIT sur LA MONTÉE » | sans aucun chant ; sans `sql/arenes.sql` |
| `rang`, `sur` | entiers ≥ 1 | ma place parmi **tous** ceux qui ont poussé pour ce camp pendant ce match, départs compris, et leur nombre (moi compris). Ordre : la ferveur, puis les chants, puis les PARFAITS ; `rang` = 1 + le nombre de ceux qui font strictement mieux (deux joueurs égaux sur les trois ont le même rang) | sans ligne de présence |
| `souvenirs` | tableau, au moins un élément | les cartes-souvenirs **de présence** reçues pendant ce match, dans l'ordre des buts : `id` (entier), `minute` (entier ; absente si le relevé ne la donne pas), `joueur` (le buteur, une chaîne venue de l'API sportive, **à poser en texte, jamais en HTML** ; absent s'il est inconnu) | s'il n'y en a aucune |
| `xp` | objet | l'XP du match, § 15.2 | sans ligne de présence |

- `ferveur`, `chants` et `parfaits` peuvent valoir 0 : c'est une réponse, et
  la page n'écrit pas une ligne à zéro.
- **Sans ligne de présence** (entré, jamais poussé) : `fixtureId`, `side`, et
  `fini` le cas échéant — rien d'autre. Il n'y a pas de bilan à poser.
- Après le coup de sifflet (`fini`), les chiffres viennent d'une lecture
  groupée de la salle, gardée au plus deux minutes et partagée par toute la
  tribune : c'est ce qui rend mille bilans aussi peu chers qu'un (P5).
- **La salle accepte encore les chants entre le coup de sifflet et
  `virage:ferme`** (§ 15.3) : ils comptent (ferveur, chants, PARFAITS, XP),
  et une lecture groupée faite avant eux ne les voit pas. Les chiffres d'un
  bilan `fini` ne sont donc pas promis définitifs ; la page, qui quitte la
  salle après son bilan, n'a rien à en faire.

### 15.2 L'XP du match : `xp`

Décision de Gaël (Q1, 3 octobre 2026) : **15 XP par match poussé, une fois par
match, à partir de 10 chants acceptés dans ce match, 3 matchs par jour au
plus.** Les trois nombres sont réglables (`xp.virage`, `xp.virage_chants`,
`xp.virage_matchs_jour`) : l'écran ne les recopie jamais. **Ni le club, ni
l'abonnement, ni la neutralité, ni `classe` n'y changent rien** (R9) : un
abonné, un neutre et un Virage non classé reçoivent exactement ce que reçoit
un joueur gratuit classé chez lui.

- Versée **à la première demande de bilan** qui la trouve due — à la sortie,
  au coup de sifflet — et, si aucun bilan ne l'a encore réglée (versée, ou
  trouvée déjà versée), **au départ de la tribune** (la dernière socket du
  joueur qui s'en va) d'un joueur qui a chanté dans cette salle — depuis son
  ouverture : une salle libérée puis rouverte (§ 16.5) repart sans chants —,
  sans réponse à la page. Un bilan qui a répondu `incomplet` ou `quota` ne la
  règle pas : le départ la retente. Une seule fois par match : par le grand
  livre, `source: 'virage'`, `cle: '<fixtureId>'`.
- Forme R6. Versée : `{ "verse": true, "gain": { … }, "wallet": { … },
  "niveau": { … § 1 … } }` — `gain` ne porte que de l'XP (`echarpes`,
  `packs` et `tampons` à 0 : ne pas les écrire, R5), et `niveau` est toujours
  là. Après un versement, la page émet `tbf:bourse` avec `xp.wallet` et
  `xp.niveau` (R6), et l'anneau s'anime de `niveau.depart.part` vers
  `niveau.part` (§ 1).
- Refusée : `{ "verse": false, "raison": "…" }`.

| `raison` | sens | ce que l'écran fait |
|---|---|---|
| `deja` | l'XP de ce match a déjà été versée : bilan précédent, départ, autre onglet | aucune ligne d'XP |
| `incomplet` | moins de `xp.virage_chants` chants dans ce match ; **`manque`** (entier ≥ 1) dit combien il en manque | il peut l'écrire avec `manque` (« encore 3 chants pour l'XP du match ») ; jamais un seuil recopié |
| `quota` | `xp.virage_matchs_jour` matchs ont déjà rapporté leur XP ce jour de jeu (R4) | « Tes matchs du jour ont déjà rapporté leur XP », une fois, sans bouton |
| `inactif` | `xp.virage` vaut 0 | aucune ligne d'XP |
| `schema` | la base n'a pas le grand livre, ou pas la colonne d'XP | aucune ligne d'XP |

Toute autre raison de la liste fermée (§ 11) : aucune ligne d'XP.

### 15.3 La fin du match : `virage:fin` et `virage:ferme`

- **`virage:fin`** (le serveur → toute la salle) `{ "statut": "FT" }`,
  `statut` ∈ `"FT"` \| `"AET"` \| `"PEN"` : **une fois** par salle, quand le
  relevé du direct voit le match fini. La page demande son bilan après un
  délai **tiré au hasard entre 0 et 8 000 ms**, et le pose sans qu'on touche
  rien ; puis elle quitte la salle (`virage:leave`) et n'y rentre plus — ni à
  la reconnexion de sa socket, qui réémet aujourd'hui `virage:join`.
- Une page qui entre ou se reconnecte après le coup de sifflet ne reçoit pas
  `virage:fin` : `virage:state.statut` le dit déjà. **La page traite alors un
  `virage:state` dont `statut` vaut `FT`, `AET` ou `PEN` exactement comme
  `virage:fin`** : bilan demandé après le même délai tiré entre 0 et 8 000 ms,
  puis `virage:leave`, et plus de `virage:join`, ni à la reconnexion. Le
  serveur s'y attend : aucun code ne refuse l'entrée dans un match fini — la
  salle s'ouvre, le temps du bilan, et c'est l'état qui dit la fin. Le bilan
  se lit en base (§ 15.1) : il est le même dans une salle rouverte.
- Un match arrêté pour de bon (`CANC`, `AWD`, `WO`) ou reporté (`PST`,
  `ABD`) n'a ni `virage:fin`, ni `virage:ferme`, ni bilan au coup de
  sifflet : la sortie reste celle de la flèche ou du menu, et la salle se
  libère une minute après la dernière socket partie (ci-dessous).
- Une salle de match fini que tout le monde a quittée est libérée **une
  minute** après la dernière socket partie, et ses partis avec elle (§ 16.5) ;
  la page qui revient après rouvre une salle neuve, et son bilan ne change
  pas.
- **`virage:ferme`** (le serveur → chaque socket d'un joueur de la salle)
  `{}`, `virage.bilan_min` minutes (5 par défaut, Q11) après **le plus tardif
  du coup de sifflet et de son arrivée** : qui était là au coup de sifflet
  sort ce délai après lui ; qui entre ou revient après la fin (une page
  rechargée, un lien, un retour de parti) a le même délai depuis son arrivée,
  et non le battement suivant. Une salle ouverte sur un match
  déjà fini arme ce délai à son ouverture, sans `virage:fin`. Un second
  onglet ne repousse rien : l'arrivée est celle de la première socket du
  joueur. La tribune est vidée et le relevé du direct a cessé de la payer dès
  le coup de sifflet. La page **ne rejoint plus — ni à la reconnexion de sa
  socket —**, garde le bilan qu'elle a et ne le redemande pas.
- Si l'API revient sur une fin (une correction de statut qui rend le match
  « en jeu »), `virage:ferme` n'est plus armé ; `virage:fin`, déjà parti, ne
  se répète pas à la fin suivante.

### 15.4 Cadence, erreurs, absence

- Sans session : `virage:error` `{ "code": "auth.error.unauthenticated" }`,
  et pas de bilan.
- Au plus **une demande par socket et par cinq secondes** ; au-delà,
  `virage:error` `{ "code": "ferveur.error.rate_limited" }` et pas de bilan.
  **Toute demande avec session compte**, y compris celle qui reçoit
  `not_in_virage` : une page qui demande hors de la salle puis y rentre
  attend ses cinq secondes. Ce n'est pas une erreur à montrer : la page garde
  le bilan qu'elle a.
- Une socket qui n'est dans aucune salle (jamais entrée, partie, ou après
  `virage:ferme`) : `virage:error` `{ "code": "ferveur.error.not_in_virage" }`.
- **Absence** : un serveur d'avant cette vague ne répond pas à
  `virage:bilan`. Au-delà de **trois secondes** sans réponse, la page sort
  comme avant (à la flèche ou au menu) ou ne pose rien (au coup de sifflet).
- Sans `sql/arenes.sql`, le bilan sert ce que la ligne porte déjà : la
  ferveur, les chants, le rang et l'XP. `parfaits`, `serie` et `meilleur`
  sont absents, et leurs lignes disparaissent.

**Lecteurs.** `virage.html` : la page kraft du bilan, à la flèche ou au menu
(si le joueur a poussé pendant ce match) et au coup de sifflet.

---

## 16. Le Virage en jeu

### 16.1 Le verdict : une échelle, quatre mots, partout

Décision de Gaël (Q3, 3 octobre 2026) : la même échelle au Virage, au duel et
dans la salle de répétition.

| `verdict` | la note mesurée est | tampon |
|---|---|---|
| `"parfait"` | au-dessus de 0,9 | vert |
| `"bon"` | au-dessus de 0,7 | bleu |
| `"moyen"` | au-dessus de 0,4 | or |
| `"rate"` | 0,4 ou moins | rouge |

- **« Au-dessus » est strict** : 0,9 tout juste est `bon`, 0,4 tout juste est
  `rate`. Liste fermée : un mot que l'écran ne connaît pas ne s'écrit pas.
- **La note mesurée** est la note brute du geste — les instants de frappe,
  notés par le serveur — **relevée par le plancher** quand une carte en pose
  un (« Second souffle » : un raté compte comme moyen), **avant les
  modificateurs du Fanzzy** (`perfectBonus`…). Le PARFAIT affiché et le geste
  parfait que les modificateurs récompensent sont ainsi le même fait : un
  Fanzzy qui paie mal le parfait ne change pas un PARFAIT en BON
  (contre-expertise du 3 octobre 2026, D7).
- Les seuils sont écrits **une fois**, dans `src/shared/verdict.js`
  (`SEUILS`, `verdictDe`), lu par le serveur. Ils ne se règlent pas : ils
  sont dessinés. **Aucune page n'écrit un seuil** — ni pour le mot, ni pour
  une vibration, un son ou une onde : elle lit `verdict`, et `cri` (§ 16.2).
- `quality` reste servie là où elle l'était : c'est la note **après** les
  modificateurs, celle qui pousse la corde. Elle ne décide plus d'aucun
  affichage.

### 16.2 Les champs

| où | champ | type | sens | absent quand |
|---|---|---|---|---|
| `virage:result` | `verdict` | `"parfait"` \| `"bon"` \| `"moyen"` \| `"rate"` | le mot de ce geste (§ 16.1) | jamais |
| `virage:result` | `cri` | `true` | la note mesurée (celle du verdict) dépasse 0,95 : le Cri du Fanzzy part. C'est une récompense, pas un verdict | en dessous de 0,95 — jamais `false` |
| `virage:result`, `virage:state.you`, `virage:vous` | `serie` | entier ≥ 0 | les `parfait` d'affilée en cours. Une carte jouée ne la coupe pas ; un chant d'un autre verdict la remet à 0. Le combo du HUD lit ce nombre, jamais un compte local | jamais |
| `virage:result` | `rang`, `sur` | entiers ≥ 1 | ma place parmi les **présents** de ma tribune (mon camp, dans cette salle, les partis exclus) et leur nombre ; même ordre qu'au bilan (§ 15.1). Recalculés au plus une fois par seconde : une seconde de retard est normale | jamais |
| `virage:result`, `virage:state.you`, `virage:vous` | `prochain` | `{ "rang": 10, "ecart": 140 }` | le palier suivant. `rang` est le plus grand de **100, 50, 10, 3, 1** qui soit strictement meilleur que ma place (« 12ᵉ → TOP 10 ») ; `ecart` (entier ≥ 1), la ferveur qui me manque pour passer devant celui qui tient cette place (sa ferveur moins la mienne, plus un). Les paliers ne se règlent pas | à la première place |
| `virage:state`, `virage:real_goal` | `surgeMs` | entier, 0 à 60 000 | ce qui reste de la minute qui compte double, en millisecondes, compté à l'envoi (R3). Sur `virage:real_goal`, la minute entière (60 000) ; sur `virage:state`, ce qu'il en reste, et **0 hors de la minute double** — la page ne décompte que si `surgeMs` > 0 | jamais, depuis le correctif du 4 octobre 2026 ; un serveur d'avant ne le sert pas (§ 16.4) |

- `virage:state.you.rank` et `you.of` existent déjà et gardent leur sens : la
  même place que `rang` et `sur`, à l'instant de l'état.
- **Le chrono de la minute double se décompte sur `surgeMs`**, avec
  `performance.now()` depuis la réception (R3), jamais sur `surgeUntil` :
  celui-ci reste servi (un instant de l'horloge du serveur) et ne sert à aucun
  calcul. La fin est diffusée : `virage:tick` part avec `surge: false` dans
  les 100 ms qui suivent la fin de la minute, même dans une salle où personne
  ne chante. À zéro, la page attend ce signal au lieu de conclure seule.
- **Le plancher de ferveur** (Q4, 3 octobre 2026) : au Virage, un chant
  accepté dont le verdict est au moins `moyen` crédite **au moins 1** de
  ferveur, quelle que soit la taille de la tribune, tous les facteurs
  appliqués (neutre compris). Les cartes n'y entrent pas. Dans une petite
  tribune, rien ne change. Seule exception : sous un bonus de ferveur nul
  (« pèse sur la corde, ne compte pas au classement » ; aucune source n'en
  pose aujourd'hui), rien ne compte, plancher compris. `ferveur` de `virage:result` (existant) le reflète
  déjà : l'écran n'a rien à calculer.

### 16.3 La carte-souvenir : `virage:souvenir`

Le serveur → **les seules sockets, dans cette salle, des joueurs qui l'ont
reçue** :

```json
{ "fixtureId": 1208051, "id": 88, "minute": 71, "joueur": "Kabashi" }
```

- `minute` et `joueur` sont absents quand le relevé ne les donne pas ;
  `joueur` vient de l'API sportive et se pose en texte.
- **C'est le seul signal qui annonce une carte-souvenir.** `virage:real_goal`
  n'en annonce aucune : une compétition non couverte n'en frappe pas, et un
  spectateur qui n'a pas poussé dans la fenêtre de présence n'en reçoit pas —
  « Elle est dans ton carnet » serait faux.
- Une fois par but et par joueur ; un but déjà frappé ne se réannonce pas.

### 16.4 Absence

Un serveur d'avant cette vague ne sert ni `verdict`, ni `cri`, ni `serie`, ni
`rang`/`sur`, ni `prochain`, ni `surgeMs`, ni `virage:souvenir`, ni
`virage:fin`. La page n'écrit alors ni tampon, ni combo, ni palier (le rang
seul, par `you.rank`), ni chrono (le sticker dit la minute double sans chiffre
tant que `surge` est vrai), et n'annonce aucune carte-souvenir. Elle ne
retombe **jamais** sur un seuil à elle.

### 16.5 La salle, d'une entrée à l'autre

*Versé le 4 octobre 2026 avec le correctif du Virage (défauts D1, D2 et D3 de
`SERVEUR-VAGUE2.md` § 5, relu en cinq passes). Aucun champ nouveau hormis
`surgeMs` : ce qui change, c'est ce que valent les champs existants après une
coupure, un second onglet ou un retour.*

- **Une socket n'est pas un joueur.** Chaque onglet, chaque reconnexion est
  une socket. Le joueur est dans la salle tant qu'une de ses sockets y est, et
  n'en sort qu'à la dernière (`virage:leave` ou coupure). Fermer un onglet
  KOP, Équipes ou duel, ou perdre l'ancienne socket d'un téléphone qui change
  de réseau, ne coupe plus l'onglet resté ouvert (il recevait
  `ferveur.error.not_in_virage`). Une socket qui demande un autre match quitte
  le premier ; deux onglets sur deux matchs chantent chacun dans le leur.
- **Partir n'efface rien.** Le joueur qui sort passe parmi les **partis** de
  la salle, et retrouve à son retour **son** état : souffle, main, pioche,
  recharges, fatigue, effets, ferveur. `virage:state.you` le rend tel quel à
  la socket qui revient. Le souffle ne remonte pas pendant l'absence ; les
  recharges et la fatigue, qui sont des instants, ont couru comme pour qui
  reste assis. **Recharger la page ne rend plus 40 de souffle ni une main
  neuve**, et la page ne doit pas le supposer.
- **Un parti ne compte nulle part en direct** : ni dans la foule (`crowd`), ni
  dans `rang`, `sur` et `prochain`, ni dans `you.rank` et `you.of`. Le bilan,
  lui, compte tout le match, départs compris (§ 15.1).
- **Les partis vivent autant que la salle** : tant que son match peut se jouer
  (de la demi-heure qui précède le coup d'envoi jusqu'à trois heures après),
  vide ou non. Hors de ce créneau, une salle vide est libérée une demi-heure
  après la dernière sortie ; celle d'un match fini, reporté ou arrêté, une
  minute après. Libérée, elle emporte ses partis : on y revient à neuf.
- **Le camp.** `virage:join` porte `{ "fixtureId", "camp" }`, `camp` ∈
  `"domicile"` \| `"exterieur"` (ou `0` \| `1`). **Chez soi** (le joueur suit
  l'un des deux clubs), le camp découle du club suivi, à chaque entrée, et
  `camp` est ignoré. **Neutre** : un camp demandé est un camp choisi, et il
  l'emporte (« je me suis trompé, je ressors et je rechoisis ») ; **sans
  camp** — la page qui se reconnecte réémet `virage:join` sans le choix —, le
  neutre que la salle connaît déjà (présent dans un autre onglet, ou parti)
  retrouve le sien, et un neutre inconnu va à domicile. Le KOP se compose sur
  ce camp-là ; `virage:state.you.side` dit toujours le camp retenu.
- **`classe` est une réservation jusqu'à la première poussée** : décidée à
  chaque entrée tant que le joueur n'a pas poussé dans ce match, fixée par sa
  première poussée (c'est elle qui écrit la ligne de présence). Regarder trois
  tribunes au coup d'envoi ne consomme pas trois places du plafond gratuit ;
  deux onglets ouverts sur deux matchs ne se réservent pas tous les deux la
  dernière.
- **Une entrée dépassée ne s'assoit pas.** Un `virage:join` suivi, avant sa
  réponse, d'un `virage:leave` ou d'un autre `virage:join` de la même socket
  ne reçoit rien : seule la dernière demande compte. Une socket fermée pendant
  son entrée n'entre pas.

### 16.6 Le but réel : ce qui part, et ce qui ne part pas

*Versé avec le même correctif.*

- `virage:real_goal` — et avec lui la secousse de la corde, la minute double
  et la frappe des cartes-souvenirs (§ 16.3) — ne part que pour **un but qui
  compte au tableau** : jamais pour un penalty manqué, ni pour un tir de la
  séance de tirs au but, marqué ou non (l'API les range tous sous « but »). Le
  fil (`virage:fil`) ne les raconte pas non plus.
- **Seulement pour un but frais**, vu tomber par le relevé. Un but marqué
  avant que le relevé regarde ce match — une salle ouverte en cours de match,
  un redémarrage du serveur qui dure plus de cinq minutes de jeu ou enjambe
  une période, ou, pour un match que le relevé ne suit que parce que sa salle
  est occupée, une salle restée vide un tour entier puis rouverte — n'est pas
  annoncé : `scoreReel`, servi avec l'état et le fil, le porte déjà, et la
  page n'a rien à rattraper.
- Un but que la liste des événements porte **avant** le tableau d'affichage
  attend que le tableau le porte, puis part, au tour suivant du relevé (une
  vingtaine de secondes plus tard). Un but que la vidéo refuse avant qu'il
  arrive au tableau ne part jamais.
- `virage:state.fixture.kickoffAt` suit l'heure que le relevé lit : un match
  avancé ou reculé change d'heure dans sa salle, et le compte à rebours de la
  page lit la dernière reçue.
- Une salle ne fait plus relever un match fini (`FT`, `AET`, `PEN`, `CANC`,
  `AWD`, `WO`) ; un match reporté (`PST`, `ABD`), un match que l'API ne rend
  plus (supprimé, renuméroté) ou un match en jeu qui ne bouge plus depuis une
  heure ne le sont plus qu'au coup d'œil (une demi-heure, ou un quart d'heure
  pour le dernier). Dans sa salle, la minute et le score cessent alors de
  bouger, sans erreur : c'est voulu, chaque relevé se paie sur l'enveloppe de
  l'API.

### 16.7 Personne en face

*Versé le 5 octobre 2026, à la demande de Gaël : un supporter seul enchaînait
les buts de tribune contre une tribune vide.*

- **La retombée face à une tribune vide.** Quand le camp d'en face de celui
  qui mène n'a personne dans sa foule (`crowd`, les présents qui ont chanté
  dans les `virage.inactif_sec` dernières secondes), la corde
  retombe de `virage.decroissance_vide` (3 par seconde) au lieu de
  `virage.decroissance` (1,4). Un chant en face, et la retombée redevient
  l'ordinaire. Ce que le supporter seul récolte ne change pas (§ 16.2, le
  plancher de `virage.tribune_min`).
- **La retombée part.** `virage:tick` part aussi quand la corde arrondie
  change sans qu'un geste l'ait bougée, au plus deux fois par seconde. La
  page n'a plus à garder une corde figée entre deux chants.
- **`pousse`** : `virage:tick` porte `[domicile, exterieur]`, deux booléens,
  les camps qui ont poussé (un chant ou une carte) depuis l'envoi précédent.
  La foule d'un camp ne saute que sur ce signe : la retombée et la secousse
  d'un but réel ne poussent personne. Un serveur d'avant ne le sert pas ; la
  page lit alors le sens de la corde, sans jamais faire sauter une tribune
  vide.

**Lecteurs.** `virage.html` (le tampon, le combo, la ferveur à paliers, le
sticker de phase, la carte-souvenir, le camp et l'état rendus au retour,
« PERSONNE EN FACE » et la foule qui saute), `geste.js` (le tampon de la
fenêtre du geste).

---

## 17. Le duel

| où | champ | type | sens | absent quand |
|---|---|---|---|---|
| `nvn:events`, évènement `chant` | `verdict` | comme au § 16.1 | le mot du geste, pour chaque joueur (le sien comme celui d'en face), mesuré comme au § 16.1 | jamais |
| `nvn:fin`, `joueurs[]` | `parfaits` | entier ≥ 0 | ses chants au verdict `parfait` dans ce duel ; un bot a les siens | jamais |
| `nvn:fin`, `joueurs[]` | `serie` | entier ≥ 2 | sa meilleure série de `parfait` d'affilée | en dessous de deux |
| `nvn:fin`, `joueurs[]` | `meilleur` | `{ "chant", "nom", "verdict" }` | le chant de sa meilleure note (mesurée comme le verdict) : identifiant, nom à écrire tel quel (R7), verdict — « PARFAIT sur LA MONTÉE » | sans aucun chant |
| `GET /api/deck/matchs`, chaque match | `enJeu` | `{ "1v1": 60, "2v2": 70, "3v3": 78, "4v4": 88, "5v5": 96 }` | les écharpes qu'une **victoire** rapporterait à ce joueur dans chaque format : le barème du `mode` du match (`classe` ou `entrainement`) × la prime du format (`duel.prime_format`) × 2 si `mien`. L'exemple : un match classé de son club | pour un match sur lequel on ne peut plus entrer en file : celui d'un jour passé, compté en jour UTC comme `mode` (un match fini du jour même reste ouvert) |
| `POST /api/repetition` | `verdict` | comme au § 16.1 | le mot de `note` (la note brute : la salle de répétition ne porte aucun modificateur). La page garde sa note chiffrée et son record ; son mot est celui de l'arène | quand `refuse` est posé (la page dit REFUSÉ) |
| `nvn:start`, `nvn:state` | `moi.userId` | chaîne | l'identifiant du joueur à qui part cette vue : le même que `userId` dans `equipes[][]`, dans les évènements et dans `nvn:fin.joueurs[]`. La page reconnaît ainsi ses propres chants et sa ligne du bilan — en 3 contre 3, trois joueurs ont le même camp | jamais |
| `nvn:start`, `nvn:state` | `moi.effets[].duree` | entier (ms) ou `null` | la durée totale de l'effet, posée à la carte jouée ; avec `reste`, l'anneau du chrono | jamais ; `null` pour un effet sans échéance (Bâche, Renvoi, charges) |
| `nvn:start`, `nvn:state` | `equipes[][].effets` | `[{ "type", "reste", "duree" }]` | ce que porte chaque joueur **des deux camps**, sous la forme de `moi.effets`, sans les effets échus. Chaque carte jouée est déjà annoncée à toute la salle : ses effets aussi | jamais ; un tableau vide sans effet |
| `nvn:events`, évènement `effect` | `side` | `0` \| `1` | le camp qui porte l'effet que la carte vient de poser ; sous un Renvoi, celui de qui a joué la carte, qui le reçoit en retour | quand l'effet ne se pose sur personne (`steal`, `refill`, `team_breath`, `per_mate`, `halve_gap`, `refill_hand`, `clear_cooldowns`, `freeze_decay`, `swap_ready`) |
| `nvn:fin`, `joueurs[]` | `moi` | `true` | sur **sa** ligne, dans **son** envoi : la page n'a pas à la chercher | sur les autres lignes — jamais `false` |
| `GET /api/deck/matchs`, chaque match | `homeColors`, `awayColors` | tableaux de 0 à 2 couleurs `#RRGGBB` | les couleurs des deux clubs, lues dans `teams` (`sql/couleurs.sql`), comme sur `/api/virage/live` : l'affiche, la marée et les foules de l'arène | jamais : vides quand on ne les connaît pas, ou sans `sql/couleurs.sql` |
| `GET /api/deck/match/:id`, `nvn:start`, `nvn:state` | `fixture.homeColors`, `fixture.awayColors` | tableaux de 0 à 2 couleurs `#RRGGBB` | les mêmes couleurs, dans l'objet `fixture` du match, sous la forme de `virage:state.fixture` : la vue du duel les porte à chaque état, reprise d'un duel comprise, sans relire la liste | jamais : un tableau vide quand on ne les connaît pas |
| `GET /api/deck/match/:id` | `enJeu` | la forme de la liste | ce qu'une victoire rapporterait dans chaque format, calculé sur le `mode` que cette réponse sert, par la même formule que la liste | jamais sur une réponse 200 : la route refuse (400) un match où l'on ne peut plus entrer |
| `GET /api/deck/matchs`, chaque match ; `GET /api/deck/match/:id` | `stade` | `{ "id", "nom", "effet" }` | le stade du match : celui de son Grand Virage et de **tous** ses duels, tiré sur l'identifiant du match parmi les stades qu'une saison a ouverts (`stadeDuMatch`, `src/server/contenus/index.js`). La forme du `stade` de la vue du duel (`nvn:start`, `nvn:state`) : `id` nomme le dessin (`/img/stade/<id>-mini`), `nom` et `effet` s'écrivent tels quels (R7) | jamais |

- `enJeu` : **les mêmes montants pour tous, abonnés compris** (R9). Un format
  qu'un joueur gratuit ne peut pas jouer classé est refusé à l'entrée
  (`format_classe_abonne`, `duels_classes_epuises`), jamais payé autrement.
  L'XP n'y entre pas : elle ne double pas pour son club et ne dépend pas du
  format. Le serveur compte (barème, prime, double du club), l'écran nomme
  (« +60 écharpes en jeu ») et n'écrit rien sans ce champ.
- **Le jour d'un match**, qui décide `mode` (classé le jour même) et la fin
  d'`enJeu`, est **le jour UTC de l'instant du coup d'envoi**, calculé par
  une seule fonction pour la liste, la route d'un match et l'entrée en file :
  une ligne de la liste annonce le mode et les écharpes que l'entrée
  décidera. Ce n'est pas le « jour de jeu » des quotas (R4).
- **Un match annulé ou reporté** (`CANC`, `PST`) **ne porte aucun duel** : la
  liste ne le propose pas, même quand la journée du football l'apporte, et la
  route d'un match comme l'entrée en file le refusent avec
  `duel.error.fixture_annule` (route : 400 `{ "error" }` ; file : `nvn:error`
  `{ "code" }`). Une page restée ouverte depuis le matin peut encore l'envoyer :
  elle dit le refus par une phrase (« Ce match est reporté ou annulé »),
  jamais par le code, et relit la liste, qui ne le propose plus.
- Le « +3 places » du bilan n'est pas servi (Q12) : `gains.cote` (§ 4.1)
  suffit au bilan, et `/classement` montre la place.
- **Pas de `serie` sur l'évènement `chant`** : le duel n'a pas de combo en jeu,
  et le contrat ne sert sa série qu'au bilan (`ECARTS.md`, `serveur-socle`,
  8 et 10). La page ne la compte pas elle-même.
- **Le stade d'un duel est celui de son match** (décision de Gaël, 6 octobre
  2026) : tous les duels d'un match se jouent dans le stade de son Grand
  Virage, tiré par une seule fonction pour le Virage, le duel et la liste
  (`stadeDuMatch`). La liste l'annonce donc avant l'entrée en file, et
  `nvn:start` sert le même. Un seul écart demeure : les stades ouverts sont
  relus à chaque tirage, et la salle du Virage garde le sien tout le match —
  une saison lancée en plein match peut donner aux duels qui suivent, et à la
  liste, un autre lieu que celui du Virage déjà ouvert. Avant la décision, le
  lieu d'un duel se tirait sur son identifiant à l'ouverture, et la
  préparation n'avait pas de stade-mini (`ECARTS.md`, `serveur-duel`).
- **Absence** : sans `verdict`, la page n'écrit pas de tampon, joue le son
  ordinaire du chant et pas d'onde — jamais un seuil à elle ; sans
  `parfaits`, `serie` ou `meilleur`, leurs lignes disparaissent du bilan ;
  sans `enJeu`, « ENTRER EN FILE » n'a pas de sous-libellé. Pour un serveur
  d'avant ces champs : sans `moi.userId`, la page lit `nvn:file.moi` ; sans
  `duree`, elle garde la plus longue valeur de `reste` vue pour cet effet ;
  sans `equipes[][].effets` ni `side`, elle déduit des évènements ce que
  porte la tribune d'en face ; sans `fixture.homeColors`/`awayColors` dans la
  vue, elle prend les couleurs du match dans la liste qu'elle a chargée ; sans
  couleurs nulle part (un duel repris sans la liste, ou des tableaux vides),
  l'arène prend ses teintes par défaut. Sans `enJeu` sur la route d'un match,
  rien ne change : la préparation lit celui de la liste. Sans `stade` sur un
  match de la liste, son affiche reste sans dessin ni nom de lieu, et les
  règles du « i » n'en parlent pas : la page ne tire jamais un stade elle-même.

**Lecteurs.** `duel-nvn.html` (le tampon du geste, les PARFAITS et le meilleur
geste au bilan, le sous-libellé d'ENTRER EN FILE, l'anneau des effets et ceux
d'en face, sa ligne du bilan, les couleurs de l'affiche et de l'arène — de la
vue d'abord, de la liste à défaut —, le refus d'un match annulé ou reporté,
le stade du match choisi sur l'affiche de la préparation (le dessin en fond,
le nom au pied, son effet dans les règles du « i ») ; aucune page ne lit
aujourd'hui la route d'un match, ni donc son `enJeu` ou son `stade`),
`geste.js`, `repetition.html` (le tampon de fin, « ★ TON MEILLEUR » en
tampon).

---

## 18. La présence

Décision de Gaël (Q2, 3 octobre 2026). **Livrée éteinte** : le réglage
`presence.actif` vaut faux jusqu'à la mise en ligne de la nouvelle
`CONFIDENTIALITE.md`. **Tant qu'il est faux, rien de ce paragraphe n'est
servi** — ni sur `/api/amis`, ni dans la tribune — et aucun écran ne montre de
présence. **Il en va de même sur une base sans `sql/arenes.sql`**, réglage
allumé ou non : sans la colonne du choix, personne ne pourrait s'y cacher, et
la présence se comporte comme éteinte (§ 18.2).

- **Qui la voit** : les **amis mutuels** seulement (une amitié acceptée,
  `amities.etat = 'amis'`). Jamais une demande en attente, un refus, un
  inconnu, un compte supprimé.
- **Ce qu'elle dit** : **un seul de trois états grossiers**, dans cet ordre de
  priorité — `"virage"` (dans une tribune du Virage dont le match n'est pas
  fini), `"duel"` (dans un duel ou en file d'attente), `"en_ligne"` (une
  activité depuis moins de `presence.en_ligne_sec` secondes, 120 par défaut).
  **Jamais le match, jamais une heure, jamais « vu il y a ».** Rien n'est
  écrit en base : la présence vit dans la mémoire du serveur et disparaît à
  son redémarrage. Éteinte, elle ne garde rien, pas même une marque
  d'activité ; seul le choix de se cacher s'écrit.
- **Par défaut, visible** (`presence.visible_defaut`, vrai) ; chacun peut
  **apparaître hors ligne**, par l'interrupteur du tiroir. Un joueur caché
  n'apparaît chez personne, et voit ses amis comme avant. Il n'y a pas de
  « REJOINDRE » : dire quel match on pousse, c'est ce que le module des amis
  refuse depuis le début.

### 18.1 `GET /api/amis`

Chaque ami de `amis[]` reçoit **`presence`** : `"virage"` \| `"duel"` \|
`"en_ligne"`. **Absent** veut dire hors ligne, caché, ou présence éteinte :
l'écran ne distingue pas ces trois cas, et c'est voulu (« rien pour hors
ligne »). Jamais dans `recues[]` ni `envoyees[]`, jamais d'horodatage. Aucun
autre champ de la réponse ne change.

### 18.2 `GET` et `POST /api/presence` — l'interrupteur

Session requise (R8).

| état | `GET /api/presence` | `POST /api/presence` `{ "visible": false }` |
|---|---|---|
| éteinte, ou base sans `sql/arenes.sql` | `{ "actif": false }` | `{ "actif": false }` — rien n'est écrit |
| allumée | `{ "actif": true, "visible": true }` : le choix du joueur, à défaut `presence.visible_defaut` | `{ "actif": true, "visible": false }` |

- `{ "actif": false }` : l'écran ne dessine pas l'interrupteur.
- **Sans `sql/arenes.sql`** (la colonne `user_wallet.presence` absente), la
  présence est éteinte même si `presence.actif` est allumé : `GET` et `POST`
  rendent `{ "actif": false }`, et rien n'est servi, ni sur `/api/amis` ni
  dans la tribune. Le serveur relit la colonne au plus toutes les dix
  minutes : le fichier appliqué, la présence revient d'elle-même.
- Le choix vaut **tout de suite** pour `/api/amis` de ses amis, et à sa
  prochaine entrée dans une tribune. Ceux qui l'ont déjà vu entrer dans celle
  où il est ne reçoivent rien de plus que son départ (§ 18.3) : leur « AMIS
  ICI » ne doit pas le garder après qu'il est parti.
- Un corps qui n'est pas exactement `{ "visible": <booléen> }` → 400
  `{ "error": "presence.error.requete" }`. **Le corps se juge avant l'état** :
  ce 400 vaut aussi quand la présence est éteinte.
- Une panne inattendue → 503 `{ "error": "presence.error.server" }` ; un jeu
  en maintenance répond 503 lui aussi (la route est montée après la fermeture
  du jeu).
- Le tiroir lit `GET /api/presence` **à son ouverture**, jamais au chargement
  d'une page : la présence n'ajoute aucune requête par écran (P6). 404, 503
  ou réseau : pas d'interrupteur (R2).
- **Après un `POST`**, seule la réponse `{ "actif": true, "visible": <booléen> }`
  garde l'interrupteur, à la position servie. Toute autre réponse le
  **retire** : `{ "actif": false }` (présence éteinte entre-temps, ou base sans
  `sql/arenes.sql`), 400 `presence.error.requete`, 401, 503
  `presence.error.server`, ou une coupure réseau — après une panne, on ne sait
  pas si le choix a été écrit, et l'écran ne montre pas une position qu'il ne
  connaît pas. Rien en console. L'ouverture suivante du tiroir relit `GET` et
  rend l'interrupteur s'il y a lieu.

### 18.3 Dans la tribune : `virage:amis` et `virage:ami`

À chaque entrée dans une salle du Virage :

- **`virage:amis`** (le serveur → l'entrant, **seulement s'il y en a**) :

  ```json
  { "amis": [{ "id": "<public_id>", "pseudo": "Lucas", "avatar": { "…": "§ 3" } }] }
  ```

  ses amis mutuels **visibles** présents dans la même salle, les deux camps
  compris — « 2 AMIS ICI » ne révèle rien : on y est tous les deux. Un joueur
  caché reçoit quand même les siens.
- **`virage:ami`** (le serveur → les sockets, dans cette salle, des amis
  mutuels présents, **cachés compris** — un joueur caché voit ses amis comme
  avant ; **jamais à la salle entière**) : `{ "id", "pseudo",
  "avatar", "present": true }` quand un ami visible entre ;
  `"present": false` quand il quitte vraiment la salle (sa dernière socket),
  **à ceux-là seuls à qui sa présence a été dite** — par son entrée, ou par
  leur propre `virage:amis` — et qui sont encore là, sans relire qui est
  visible.
- **Une entrée** est la première socket du joueur dans la salle, y compris un
  retour après un vrai départ (il était parmi les partis, § 16.5). Une socket
  de plus d'un joueur déjà là (un second onglet, une reconnexion avant que la
  précédente soit tombée) ne l'annonce pas une seconde fois.
- **Un ami caché dès son entrée** n'est annoncé ni à l'entrée, ni au départ.
  **Un ami visible à son entrée, qui se cache ensuite**, est annoncé à son
  départ à ceux qui l'ont vu entrer : leur dire qu'il est parti ne leur
  apprend rien qu'ils ne savaient, et leur « AMIS ICI » mentirait sinon
  jusqu'à leur propre départ.
- `id` est l'identifiant public (celui de `/api/amis`) ; `pseudo` se pose en
  texte ; `avatar` a la forme du § 3 et est **absent** sans Fanzzy (pas de
  `null` ici).
- La page ajoute un `virage:ami` d'un id qu'elle ne connaît pas, et ignore un
  `present: false` d'un id qu'elle ne connaît pas.

**Absence** : présence éteinte, base sans `sql/arenes.sql` (la présence est
alors éteinte, § 18.2) ou serveur d'avant la vague → ni `presence` sur
`/api/amis`, ni `virage:amis`, ni `virage:ami` ; `/api/presence` répond
`{ "actif": false }` (éteinte, ou sans `sql/arenes.sql`), 404 (serveur d'avant
la vague) ou 503 (panne, maintenance). Aucune pastille, aucun « AMIS ICI », pas
d'interrupteur.

**Lecteurs.** `amis.html` (la pastille de chaque ami), `virage.html` (« 2 AMIS
ICI »), `menu.js` (l'interrupteur « apparaître hors ligne », au pied du
tiroir, à côté du mode calme).
