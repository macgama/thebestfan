# Contrats des données nouvelles — serveur ↔ écrans

*Chantier serveur de la refonte FAIT MAIN, vague 1. 2 octobre 2026.*

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
| `gagnes` | entier | objets gagnés, le même nombre que `total.gagnes` de la même réponse |
| `prochain` | objet | le prochain cran : son seuil `a`, ce qui `manque`, son `gain` ; absent quand tout est gagné |
| `aReclamer` | tableau | crans et séries complètes atteints et pas encore récupérés ; `[]` si rien |
| `series[]` | tableau | une entrée par série ouverte : `possedes`, `total`, `etat` ∈ `"a_venir"` \| `"pret"` \| `"reclame"`, et le `gain` de la série complète |

Un cran est payé **une fois**, au seuil franchi le plus haut : si le compte
baisse (une tenue retirée) ou si la taille du cran change, rien n'est repris ni
repayé. Le booster « tous les quatre crans » est déjà compris dans le `gain` du
cran concerné.

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

**Lecteurs.** `collection.html` (jauge à crans, vignette du cran suivant,
RÉCUPÉRER), `fanzzy.html` (page de série : tampon COMPLET), `index.html` (crans
de la tuile COLLECTION).

### 5.2 Rang : les divisions de saison

`GET /api/rank/moi` → champ `saison` :

```json
"saison": {
  "id": 1, "numero": 1, "nom": "La reprise",
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

### Lecteurs

`index.html` (bâche du jour : mission en cours avec sa jauge et son gain ;
plaque or RÉCUPÉRER du bonus, dont le gain vole vers le compteur ; bulle
« J3 »), `aide.html` (MISSIONS : rails DU JOUR et DE LA SAISON, tickets avec
tampon FAIT, RÉCUPÉRER), `menu.js` / `nav.js` (pastille par R10),
`profil.html` (série et record).

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
| présence (en ligne, au stade, en duel) | aucune pastille de présence, aucun « REJOINDRE » |
| bilan de tribune du Virage, PARFAIT, meilleur geste, série officielle | le bilan du Virage se construit avec ce que la salle envoie déjà, sans ces lignes |
| deltas de rang des autres lignes | mémoire locale de la page |
| titres sur les lignes des autres joueurs | rien |

---

## 10. Qui lit quoi

| page | lot | données de ce contrat |
|---|---|---|
| `index.html`, `ouverture.js` | 2 | § 6 (bâche du jour, bonus, J3), § 8 (ticket), § 2 (pastille COLLECTION), § 5.1 (crans), § 7 |
| `boosters.html` | 3 | § 1, § 2.3, § 7.1, § 7.2, § 13 |
| `boutique.html` | 3 | rien de nouveau (l'achat à l'étal crée une nouveauté, lue ailleurs) |
| `profil.html` | 5 | § 4.2, § 5.2 (division, titres), § 6 (série, record), § 7 |
| `classement.html` | 5 | § 3, § 4.2, § 5.2, § 5.3, § 7 |
| `kop.html` | 5 | § 3 |
| `amis.html` | 5 | § 3 (niveau) |
| `aide.html` (MISSIONS) | 5 | § 6, § 5.2 (lien), § 7 |
| `niveau-fete.js` | 5 | § 1 |
| `nav.js`, `menu.js` | 2 / 5 | R10, § 1 par `tbf:bourse` |
| `fanzzy.html`, `collection.html`, `fanzzy-fiche.html` | 4 | § 2, § 5.1 |
| `duel-nvn.html` | 6 | § 1, § 4.1, § 7 |
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

Pour `relance` seulement : `epuisees` (plus de relance aujourd'hui), `aucune`
(aucune autre mission possible), `terminee` (mission prête ou récupérée).

Une erreur HTTP (400 corps mal formé, 401 sans session, 503 base indisponible)
garde la forme habituelle `{ "error": "<code>" }`. Codes nouveaux :
`quotidien.error.requete`, `fanzzy.error.vu_invalide`,
`fanzzy.error.palier_requete`, `rank.error.division_requete`.

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
