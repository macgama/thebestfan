# L'économie du quotidien : missions, bonus, saison, paliers

*Propositions pour le chantier serveur de la refonte FAIT MAIN. Rédigé le
2 octobre 2026, en lecture seule sur la copie principale.*

Gaël a délégué le **contenu** : quelles missions, quel bonus, quelle saison,
quels montants. Ce document le propose, chiffres à l'appui. Chaque montant est
raisonné contre les barèmes réels du code, et il est **réglable depuis
l'administration** (§ 8). Rien n'est écrit en dur, sauf ce qui décrit une règle
du jeu.

Les chiffres sur l'état actuel du jeu viennent d'une simulation qui rejoue le
tirage exact du serveur, limité à **LA REPRISE**, la seule série ouverte en
production (`serveur/sim-eco.mjs`, annexe B). Ils font foi tant que
le code ne bouge pas. `npm run economie` simule les treize séries : c'est un
autre jeu que celui de la production.

---

## 0. En une page

**Le constat qui commande tout le reste.** En production, une seule série est
ouverte : 35 personnages, 20 pièces d'équipement, 7 cartes d'action à gagner.
Un joueur assidu a tout fait grandir **avant la fin de sa première semaine**.
Ensuite, chaque booster n'est plus que doublons et replis sur des poignées
d'écharpes. Il rend alors **45,6 écharpes en moyenne, pour un prix d'achat de
45**. Un assidu encaisse ainsi environ **2 400 écharpes par jour** à partir de
la deuxième semaine, et 2 100 de ces écharpes viennent de la recharge gratuite
des boosters. Au 42ᵉ jour, son solde est de 92 000 écharpes. Dans le même
temps, le **Grand Virage**, le cœur du jeu, ne rapporte **ni écharpe ni XP**.

*Ces chiffres sont ceux d'avant le 6 octobre 2026. Depuis, une catégorie
épuisée ne rend plus que 2 écharpes au lieu d'une poignée : un booster établi
rend 28,8 écharpes, et l'assidu en encaisse environ 1 700 par jour (§ 12.1).
Le constat tient toujours, et les règles qui suivent aussi.*

Il en découle trois règles pour le contenu :

1. **Les missions doivent payer le jeu, pas l'ouverture.** Elles visent le
   Virage, le duel et le geste. Le Virage y trouve enfin une récompense.
2. **Ce qui reste rare, c'est l'XP, les tampons de saison et l'honneur.** Les
   écharpes ne comptent vraiment que pour un nouveau venu, pendant ses trois
   premiers jours. Les récompenses sont donc des écharpes modérées, de l'XP,
   des tampons, et des insignes qui ne donnent aucune puissance.
3. **Rien de ce que l'abonnement vend ne se gagne par une mission.**
   Récompenses identiques pour tous, missions faisables sous les plafonds
   gratuits, et aucune tenue en récompense (§ 10).

**Ce qui est proposé :**

| | Contenu | Montant par défaut |
|---|---|---|
| Missions du jour | 3 tirées par jour (une facile, une moyenne, une difficile) dans un catalogue de 15, plus 1 relance gratuite | 30 / 60 / 100 écharpes, 20 / 40 / 60 XP, 1 / 1 / 2 tampons ; **1 booster** quand les trois sont faites |
| Bonus quotidien | une carte de présence de 7 cases qui **n'est jamais remise à zéro** | 20, 25, 30, 35, 40, 45 puis 50 écharpes + 1 booster |
| Jour | minuit, **heure de Zurich**, donné par `CURDATE()` de MySQL (la même horloge que les quotas) | — |
| Saison 1 « La reprise » | fin le **dimanche 20 décembre 2026 à 23 h 59**, dernier week-end avant la trêve | carnet de tampons à 5 paliers (de 100 écharpes à 4 boosters + 600 écharpes + titre) |
| Saison 2 | « La trêve », du **lundi 21 décembre 2026** au 28 février 2027 ; ouvre **LES HÉROS DU CANAPÉ** | 2 boosters offerts au lancement à qui a ≥ 10 tampons en S1 |
| Paliers de collection | **oui, un cran tous les 25 objets**, sur toute la bibliothèque (635 objets en RP, soit 25 crans) | 25 écharpes par cran, 1 booster tous les 4 crans, 1 booster + 100 pour une série complète |
| Paliers de rang | 5 divisions de ferveur de saison, à seuils absolus qu'on ne perd jamais | de 50 écharpes à 3 boosters + 200, et l'insigne |

**Effet, le premier mois, par semaine** (§ 9) : assidu **+15 % d'écharpes,
+3 % de boosters, +26 % d'XP** ; joueur moyen +23 %, +3 %, +39 % ; joueur
occasionnel +32 %, +4 %, +50 %. Le quotidien penche donc vers ceux qui jouent
peu, et presque rien ne passe par les boosters.

**À trancher par Gaël, hors délégation** (§ 12) : l'inflation des écharpes
(avant la saison 2 ; tranchée le 6 octobre 2026, et faite : § 12.1) ; l'XP du
Virage ; le bonus de KOP « La quête », qui ne fait rien (retiré le 6 octobre
2026, son prix rendu au pot : § 12.3) ; la ferveur arrondie à zéro dans les
tribunes nombreuses.

---

## 1. Les barèmes réels, relevés dans le code

### Ce qui rapporte des écharpes

| Source | Montant | Où |
|---|---|---|
| Doublon de personnage | commune 1, rare 3, épique 10, légendaire 45 | `src/shared/fanzzy/dex.js:95` `SCARVES` |
| Place ouverte d'un booster (3,3 par booster en moyenne) | 23 % de poignées : 6 (55 %), 14 (33 %), 30 (12 %), soit 11,5 en moyenne. Les autres catégories (action 28 %, pièce 23 %, tenue 14 %, état 12 %) **retombent sur une poignée** quand elles sont épuisées. *Depuis le 6 octobre 2026, ce repli ne rend plus que 2 écharpes (§ 12.1)* | `src/server/fanzzy/index.js:723` `PLACES_OUVERTES`, `:749` `POIGNEES` ; `src/shared/fanzzy/dex.js:113` `POIGNEE_DE_REPLI` |
| Doublon de pièce d'équipement | `SCARVES` de sa rareté (10,45 en moyenne sur les 20 pièces RP) | `src/server/fanzzy/index.js:566` |
| Duel classé | victoire 30, défaite 12 ; **×2** pour son club ; prime de format +15 % par joueur de plus par camp ; un forfait ne rapporte rien | `src/server/nvn/index.js:687` `GAIN`, `:704`, réglage `duel.prime_format` |
| Duel d'entraînement | victoire 15, défaite 6 (mêmes multiplicateurs) | idem |
| Palier de niveau | 10 × n (4 640 au total jusqu'au niveau 30) | `src/shared/niveau.js:96` |
| Paquet de bienvenue | 80 à 119, une fois | `src/server/onboarding/index.js:254` |
| Parcours des premiers pas | 1 booster, une fois | `src/shared/aide.js:319` |
| **Grand Virage** | **rien** (ni écharpe, ni XP) : ferveur et cartes-souvenirs seulement | `src/server/ferveur/` (aucun crédit) |
| Part du KOP | +100 % de la base du duel, versée **au pot** (pas au joueur), duels pour son club seulement | `src/shared/kop.js:105`, `src/server/nvn/index.js:896` |

### Ce qui coûte des écharpes

| Puits | Prix | Où |
|---|---|---|
| Booster | 45 | réglage `pack.prix_echarpes` |
| Faire grandir | 25 (2ᵉ âge) puis 90 (3ᵉ âge), soit 115 par lignée et 3 450 pour les 30 lignées RP | `dex.js:113` `EVO_COST` |
| Étal | pièce 45 / 110 / 260 / 520 selon la rareté, tenue 130 | réglages `etal.*` |
| Emplacement de club | 120, 220, 380, 600, 900, 1 300 (du 3ᵉ au 8ᵉ) | `onboarding/index.js:129` |
| Vignette de carte-souvenir | amical 30, championnat 60, coupe 90, international 140 | `souvenirs/index.js:18` |
| Bonus de KOP (payé sur le pot) | 350 à 900 par match ou par charge, 5 000 pour la saison | `src/shared/kop.js:66` |

### XP, rythmes, plafonds

- **XP** : booster 5, duel d'entraînement 12, duel classé 20, victoire +15.
  Pas de doublement pour son club. **Le Virage : 0.** Niveau 5 = 480 XP,
  niveau 10 = 1 980, niveau 20 = 7 980, niveau 30 = 17 980.
- **Boosters** : 1 toutes les 10 min, réserve de 12, 3 au départ. Taux des deux
  premières places : 95/5 puis 85/15 (commune/légendaire). La deuxième place
  est un personnage 7 fois sur 10.
- **Plafonds sans abonnement** : 5 duels classés par jour, 2 Virages comptés
  au classement par jour, classé limité au 1 contre 1. Ils se comptent en SQL
  contre `CURDATE()`, c'est-à-dire l'heure de Zurich
  (`abonnement/index.js:285`, `:308`).
- **Abonnement** (3,99 €/mois, 39,90 €/an) : réserve de 24, 1 booster toutes
  les 6 min, +2 clubs, mémoire longue, toutes les tenues publiées, création de
  KOP, plafonds levés. Plus 1 booster par échéance mensuelle, 6 pour l'annuel
  (`src/shared/boutique.js`).

---

## 2. Ce que l'économie produit aujourd'hui

### Trois profils, simulés sur six semaines (LA REPRISE seule)

Hypothèses : 50 % de victoires ; un duel sur quatre joué pour son club ; le
joueur fait grandir dès qu'il peut ; aucun achat à l'étal. Contenu ouvert :
30 + 5 personnages, 20 pièces, 7 actions non communes, 2 tenues.

| Profil | Rythme | Écharpes par semaine (sem. 1 → sem. 3-4) | Dont boosters | Dont duels | Dont paliers | XP par semaine |
|---|---|---|---|---|---|---|
| **Assidu** | 7 j/7, 48 boosters, 5 classés, 4 entraînements par jour | 12 400 → **16 700** | 10 300 → 14 600 | 1 290 | 770 → 840 | 3 190 |
| **Moyen** | 5 j/7, 24 boosters, 2 classés, 1 entraînement | 4 000 → **5 000** | 3 450 → 4 460 | 330 | 210 → 240 | 970 |
| **Occasionnel** | 3 j/7, 12 boosters, 1 classé | 960 → **1 430** | 840 → 1 280 | 80 | 50 → 65 | 260 |

Une réponse directe à la question « combien gagne un assidu par jour » :
**environ 1 800 écharpes la première semaine, 2 400 ensuite**, dont 85 à 90 %
viennent de la recharge gratuite des boosters.

| Moment | Assidu | Moyen | Occasionnel |
|---|---|---|---|
| Fin du jour 1 | 18 personnages, 547 écharpes dépensées en évolutions, niveau 3 | 18, 413, niveau 2 | 15, 306, niveau 2 |
| Fin du jour 7 | **les 30 lignées au 3ᵉ âge**, solde 9 000, niveau 12 | les 30 au 3ᵉ âge, solde 660, niveau 6 | 4 au 3ᵉ âge, solde 40, niveau 3 |
| Fin du jour 28 | solde 58 000, niveau 25, toutes les tenues, tous les états | solde 15 600, niveau 13 | les 30 au 3ᵉ âge, solde 1 900 |

### Ce que vaut un booster, ce que vaut une heure

- **Un booster coûte 45 écharpes.** Il en rend **18** en moyenne à un nouveau
  venu (ses 20 premiers). Une fois tout possédé, il en rend **45,6**, plus
  5 XP. En régime établi, **acheter un booster ne coûte donc rien** : on y
  gagne 0,6 écharpe et 5 XP.
- **Une heure de jeu**, pour un joueur sans abonnement, en régime établi :

| Activité | Écharpes / heure | XP / heure | Remarque |
|---|---|---|---|
| La recharge des boosters (6 par heure, ouverts en 2 min) | 110 (nouveau) à 275 (établi) | 30 | sans jouer |
| Duels classés (≈ 7 min, file comprise) | ≈ 225 (26 par duel) | ≈ 235 | 5 par jour au plus, soit 35 min |
| Duels d'entraînement (≈ 6 min) | ≈ 130 | ≈ 195 | illimité |
| **Grand Virage** | **0** | **0** | ferveur ≈ 1 200 à 2 400 par heure dans une petite tribune, et des cartes-souvenirs |

### Les constats qui comptent pour le contenu

- **C1. Les écharpes ne sont plus rares.** Une fois les 30 lignées payées
  (3 450), il ne reste comme puits que les tenues de l'étal (130 pièce), les
  vignettes et des emplacements de club plafonnés par le niveau. Les boosters
  ont déjà donné toutes les tenues et tous les états entre la deuxième et la
  quatrième semaine. Un montant d'écharpes ne motive donc plus qu'un nouveau
  venu.
- **C2. Le jeu paie l'ouverture, pas le jeu.** Une minute à ouvrir des
  boosters rapporte des dizaines de fois une minute de duel (environ 140
  écharpes contre 4 en régime établi), et le Virage ne rapporte rien. Les missions sont le bon outil pour rééquilibrer sans toucher
  aux barèmes.
- **C3. L'abonnement achète désormais des écharpes, par la bande.** En régime
  établi, chaque booster vaut environ 46 écharpes. Avec 24 en réserve et une
  recharge de 6 minutes, l'abonnement double à peu près les boosters d'un
  assidu, soit environ 60 de plus par jour pour cinq passages, donc environ
  **+2 700 écharpes par jour**. À verser au dossier juridique, question 2. Le
  quotidien proposé ici **n'aggrave rien** : il est identique pour tous.
- **C4. La ferveur s'arrondit à chaque chant**
  (`src/server/ferveur/virage.js:684`, `Math.round` par poussée). Un chant
  moyen apporte environ 34 / effectif. Au-delà d'**environ 34 personnes en
  tribune pour un neutre, 67 pour un supporter du club**, un chant rapporte
  **0 ferveur**. Les divisions de rang (§ 7) et l'étape « pousse » du parcours
  (`ferveur > 0`) en dépendent. C'est invisible tant que les tribunes sont
  petites.
- **C5. Le bonus de KOP « La quête » (900 écharpes, « +25 % d'écharpes, trois
  matchs ») ne fait rien.** `scarvesBonus` n'est lu nulle part dans
  `src/server` ; les bonus de KOP ne se consomment qu'à l'entrée au Virage
  (`kop.modsDe`, appelé par `ferveur/index.js:390`), où il n'y a pas
  d'écharpes. Un KOP qui vote ce bonus perd 900 écharpes. *Tranché le
  6 octobre 2026 : retiré du catalogue, avec « Mur de bâches », et le prix
  rendu au pot des KOP qui l'avaient payé (§ 12.3).*
- **C6. Le bonus de KOP « Le virage debout » (5 000, « jusqu'à la fin de la
  saison ») n'a pas de fin** : `saisons` n'a pas de date de fin, et
  `restant` vaut NULL pour toujours. La date de fin de saison (§ 6) doit
  l'éteindre.
- **C7. Le classement « saison » est un classement de tous les temps** :
  `depuis('saison')` rend une chaîne vide (`classements/index.js:100`). Les
  divisions de saison ont besoin de la vraie fenêtre de la saison.

---

## 3. Le jour : quel fuseau, quelle horloge

**Le jour commence à minuit, heure de Zurich, et c'est `CURDATE()` de MySQL
qui le dit.** C'est déjà l'horloge des quotas gratuits (`>= CURDATE()`, fuseau
`SYSTEM` de la base, Europe/Zurich). Missions, bonus et quotas se
renouvellent donc au même instant : un joueur n'a pas à retenir deux minuits.

Règles d'écriture, toutes tirées d'ETAT § 2 et § 6 :

- **`jour` s'écrit en SQL** (`CURDATE()`), jamais avec un `new Date()`
  JavaScript passé au pool : celui-ci est en `timezone: 'Z'`, et entre minuit
  et deux heures en été, le jour JavaScript et le jour MySQL diffèrent. C'est
  exactement ce qui fait rougir `abo:smoke`.
- **Le compte à rebours vient du serveur**, calculé en SQL :
  `TIMESTAMPDIFF(SECOND, NOW(), CURDATE() + INTERVAL 1 DAY)`. La page ne
  calcule pas minuit elle-même : un joueur à Montréal verrait sinon un autre
  jour que celui du serveur.
- **Une colonne `DATE` revient en objet `Date`** : on la lit avec `jourISO()`
  de `src/shared/jour.js`, jamais avec `String(d).slice(0, 10)`.
- **Les suites sèment avec `CURDATE()` et `NOW(3)`**, comme le serveur écrit.
  Sinon, la panne `abo:smoke` se reproduit sur une suite toute neuve.
- On sait d'avance qu'il y a deux jours dans le dépôt : le « match du jour »
  qui rend un duel classé se compte en **UTC** (`deck/index.js:522`,
  `UTC_DATE()`). Les missions prennent le jour des quotas, celui de Zurich, et
  ne posent jamais de condition sur le jour UTC.

---

## 4. Les missions du jour

### 4.1 Six principes

1. **Une mission se lit dans ce que le serveur a déjà écrit**, comme les
   étapes de l'aide (`src/server/aide/index.js`). Rien n'est déclaré par le
   client, et on ne coche rien en cliquant.
2. **Elle paie le jeu** : Virage, duel, geste, KOP. L'ouverture de boosters n'y
   a droit qu'à une seule mission, facile.
3. **Elle tient sous les plafonds gratuits** : au plus 2 duels classés, aucun
   Virage « compté » exigé (on compte tous les Virages joués, comptés ou non),
   aucun format au-dessus du 1 contre 1 classé.
4. **Elle est faisable le jour même** : chaque mission porte une *condition de
   tirage*, vérifiée au moment du tirage (des matchs en direct aujourd'hui, le
   club du joueur qui joue, une évolution possible…). Si la condition tombe
   ensuite (match reporté), la relance redevient gratuite.
5. **Le gain est borné par jour**, donc l'abus aussi. Jouer contre des bots,
   rejouer, s'acharner : on ne gagne jamais plus que trois missions et un
   sachet.
6. **Rien ne se perd** : une mission terminée et non récupérée est versée à la
   visite suivante, même un autre jour.

### 4.2 Le catalogue : quinze missions

Durées estimées pour un joueur qui connaît le jeu. « Chant réussi » = verdict
au-dessus de RATÉ (qualité > 0,4). « PARFAIT » = qualité > 0,9 : c'est le seuil
de `public/virage.html:1933`, qui **doit passer dans `src/shared/`** pour que
l'écran et le compteur disent la même chose.

| Id | Difficulté | Intitulé | Cible | Source serveur (lue, jamais déclarée) | Condition de tirage | Durée |
|---|---|---|---|---|---|---|
| `boosters` | facile | Ouvre 3 boosters | 3 | `compteurs_jour.booster` (écrit par `openPack` après la validation) | toujours | 1 min |
| `duel` | facile | Joue un duel jusqu'au bout | 1 | `duel_results`, `ended_at >= CURDATE()`, `xp > 0` (un forfait a `xp = 0`), tout mode | toujours | 6 min |
| `virage` | facile | Chante 10 fois au Grand Virage | 10 chants réussis | `virage_presence.chants` (nouvelle colonne) | au moins un match en direct prévu aujourd'hui (journée du foot) | 3 min |
| `cartes` | facile | Joue 4 cartes d'action | 4 | `virage_presence.cartes` + `duel_results.cartes` | toujours (les communes sont à tous) | 5 min |
| `grandir` | facile | Fais grandir un Fanzzy | 1 | `compteurs_jour.evolution` (écrit par `evolve` après la validation) | le joueur possède un personnage sous son dernier âge écrit | 1 min (+ 25 ou 90 écharpes) |
| `parfaits` | moyenne | Réussis 8 gestes PARFAIT | 8 | `virage_presence.parfaits` + `duel_results.parfaits` | toujours | 10 min |
| `tribune` | moyenne | Chante 40 fois au Grand Virage | 40 | `virage_presence.chants` | match en direct aujourd'hui | 10 min |
| `victoire` | moyenne | Gagne un duel | 1 | `duel_results.outcome = 'win'`, `xp > 0`, tout mode | toujours | 12 min |
| `classes` | moyenne | Joue 2 duels classés | 2 | `duel_results.mode = 'classe'`, `xp > 0` | au moins 2 duels classés restent au quota du jour au moment du tirage (toujours vrai pour un abonné) | 14 min |
| `club` | moyenne | Pousse pour ton club | 20 chants pour un club suivi, ou 1 duel pour lui | `virage_presence.team_id` / `duel_results.team_id` ∈ clubs suivis | un club suivi joue aujourd'hui | 10 min |
| `kop` | moyenne | Fais tomber 20 écharpes dans le pot de ton KOP | 20 | `compteurs_jour.kop_verse` (écrit par `kop.verser`) | membre d'un KOP dont le club joue aujourd'hui | 7 à 14 min |
| `serie` | difficile | Enchaîne 3 PARFAIT de suite | 3 | `serie_max` (nouvelle colonne des deux tables) | toujours | 15-25 min |
| `victoires` | difficile | Gagne 3 duels | 3 | `duel_results`, `outcome = 'win'`, `xp > 0` | toujours | 30 min |
| `mitemps` | difficile | Pousse dans les deux mi-temps d'un même match | 10 chants dans chaque mi-temps | `virage_presence.mi_temps` (masque : 1ʳᵉ = 1, 2ᵉ = 2) | match en direct aujourd'hui | 2 × 5 min, à une heure d'écart |
| `ailleurs` | difficile | Pousse dans deux compétitions différentes | 10 chants dans 2 ligues | `virage_presence` jointe à `fixtures.league_id` | au moins 2 ligues en direct aujourd'hui | 2 × 4 min |

**En réserve** (écrites, mais retirées de `missions.actives` au lancement, car
la population est trop faible pour les garantir) : *Affronte un vrai
supporter* (`opponent_id` qui ne commence pas par `bot:`), *Joue un duel avec
un ami*, *Vote au KOP* (un vote dure trois minutes : impossible à prévoir).

**Écartées par principe :**

- *Répète un geste* : « rien n'y compte », c'est la règle de la répétition.
- *Suis un club* : ça se fait une fois, et ça se défait puis se refait pour
  toucher la récompense chaque jour.
- *Achète…* : une mission ne pousse pas à dépenser.
- *Atteins le rang N* : ce n'est pas quotidien, c'est le rôle des divisions.

### 4.3 Le tirage

- **Trois missions par jour : une facile, une moyenne, une difficile.** Les
  trois demandent 35 à 45 minutes, soit ce que joue un joueur moyen. Celui-ci
  en fait deux sur trois ; un assidu fait les trois.
- **Tirées par le serveur à la première lecture du jour**, « à la lecture »
  comme le dépouillement des votes de KOP : pas d'ordonnanceur. Le tirage
  s'écrit en `INSERT IGNORE` sur `(user_id, jour, rang)` : deux onglets ne
  tirent pas deux jeux de missions.
- **Graine** : `(user_id, jour)`. Un tirage perdu se refait à l'identique. On
  évite la mission de la veille au même rang quand une autre est éligible.
- **Une relance gratuite par jour** (réglable), sur une mission non commencée,
  vers une autre mission éligible de la même difficulté.
- **Premiers jours** : tant que le parcours des premiers pas n'est pas payé,
  le tirage préfère `boosters`, `grandir`, `virage` et `duel`. Les missions
  accompagnent le parcours au lieu de lui faire concurrence.

### 4.4 Les récompenses, et pourquoi ces montants

| | Écharpes | XP | Tampons de saison |
|---|---|---|---|
| Facile (≈ 5 min) | **30** | **20** | 1 |
| Moyenne (≈ 12 min) | **60** | **40** | 1 |
| Difficile (≈ 25 min) | **100** | **60** | 2 |
| Les trois faites : **le sachet** | **1 booster** | — | +1 |

- **Rapportées à l'heure**, une mission paie 240 à 360 écharpes par heure,
  soit le même ordre qu'une heure de duels classés (≈ 225) **en plus** de ce
  que la partie rapporte déjà. C'est une prime au jeu, pas une seconde paie.
  Le Virage, qui ne rapportait rien, vaut alors jusqu'à 190 écharpes et
  120 XP par jour.
- **L'XP** : une mission vaut à peu près un duel (facile : un entraînement ;
  moyenne : un classé gagné ; difficile : deux classés). En tout, 120 XP par
  jour, autant que 24 boosters ouverts.
- **Les écharpes** pèsent pour un nouveau venu : 190 écharpes, c'est 20 à 60 %
  de son premier jour, de quoi payer 7 évolutions au 2ᵉ âge. Pour un vétéran,
  elles ne pèsent plus (C1). Ce sont l'XP et les tampons qui le font revenir.
- **Le sachet** est la seule récompense quotidienne en booster : c'est
  l'objet que la refonte dessine à droite de la jauge (synthèse, § 4,
  mécanisme 3). Il va dans la réserve, **même au-dessus du plafond**, comme le
  booster du parcours (`aide/index.js:193`). C'est un cadeau ponctuel, pas une
  réserve plus grande.
- **Option** `missions.part_kop`, **désactivée par défaut** : verser aussi au
  pot du KOP les écharpes des missions `club` et `kop`, sur le modèle de la
  part du club qui « s'ajoute, ne se prend pas ». Désactivée parce que dix
  comptes factices dans un KOP rempliraient le pot de 600 écharpes par jour,
  or le pot achète de la poussée sur la corde (`pushMult`). Le chemin existe
  déjà par les duels ; inutile de l'élargir.

### 4.5 Vérifiable sans tricherie : la liste des verrous

| Risque | Verrou |
|---|---|
| Le client déclare sa réussite | Impossible : le geste est noté par le serveur (`resoudreGeste`) à partir des instants de frappe ; les compteurs sont incrémentés là où le serveur note, jamais sur une requête dédiée. |
| Réclamer deux fois (deux onglets) | Réclamation en transaction, `SELECT … FOR UPDATE` sur la ligne de mission, `reclamee_a` posé dans la transaction, comme `aide.recompenser`. |
| Réclamer sans avoir fini | Le serveur **recompte** au moment de réclamer, depuis les sources ; la progression affichée n'est pas une preuve. |
| Choisir ses missions | Tirage serveur, graine fixe, écrit avant d'être montré. Relance comptée en base. |
| Forfait, abandon | `duel_results.xp > 0` exclut le forfait (le barème ne lui verse rien, `nvn/index.js:840`). |
| Ferme à bots | Bornée par le plafond quotidien. Un duel complété par des bots compte comme un autre pour les missions de duel : un entraînement suffit à les faire de toute façon, et le gain reste celui d'une mission. Seule la mission de réserve « Affronte un vrai supporter » exclut les bots. |
| Client modifié qui frappe parfaitement | Défenses existantes (écart minimal, plafond de frappes, « trop juste » des épreuves). Le gain volé est au plus une mission par jour. |
| La répétition | Hors de tout compteur : elle ne passe ni par `virage_presence` ni par `duel_results`. |
| Faire puis défaire (suivre un club, rejoindre un KOP) | Aucune mission ne porte sur un état qu'on peut basculer. `club` et `kop` exigent une poussée ou un versement. |
| Deux horloges | `jour = CURDATE()` partout, écrit en SQL (§ 3). |

---

## 5. Le bonus quotidien et la carte de présence

**La règle qui encadre tout** (ETAT § 3) : *« Aucune série quotidienne qu'on
perd. "Tu as joué 47 jours d'affilée" est agréable ; "tu vas perdre ta série"
est une laisse. »*

D'où une **carte de présence** plutôt qu'une série :

- **Sept cases.** Chaque jour où le joueur appuie sur « RÉCUPÉRER », la carte
  avance d'**une** case. Un jour manqué ne fait **pas reculer** la carte : la
  case suivante attend. Après la septième, une carte neuve commence.
- **Montants** : case *k* = `bonus.base` + `bonus.pas` × (*k* − 1), soit
  **20, 25, 30, 35, 40, 45, 50**, et la septième case ajoute **1 booster**.
  Une carte entière vaut 245 écharpes et 1 booster.
- **Plafond** : une réclamation par jour de Zurich. Un mois complet donne
  environ 4 cartes (980 écharpes + 4 boosters). On ne peut pas aller plus vite
  que le calendrier.
- **« J3 »** dans la bulle du Fanzzy = la case de la carte. Elle ne descend
  jamais.
- **« 5ᵉ jour d'affilée »** peut s'afficher à partir de 3, **en information
  seulement**. Rien n'en dépend. Quand la suite s'interrompt, **on ne dit
  rien**, et aucun écran ne prévient d'une perte à venir.
- **Ce qui casse la série** : rien ne casse la carte. Seul le compteur
  d'affilée, purement décoratif, repart à 1, en silence.
- **Identique pour tous**, abonnés compris (§ 10).
- **Sans état à tenir** : la case se **déduit** du nombre de lignes de
  `presences` du joueur (modulo 7). Le compteur d'affilée se déduit des dates.
  C'est le principe de l'aide : rien à migrer, rien qui se désynchronise.

C'est volontairement peu d'argent : de 4 à 6 % du revenu d'un joueur moyen.
Le bonus est un **rituel d'entrée** (la plaque or, le gain qui vole vers le
compteur), pas une source de revenu.

---

## 6. La saison 1 « La reprise », et ce qui s'ouvre ensuite

### 6.1 La fin : dimanche 20 décembre 2026, 23 h 59, heure de Zurich

- **Pourquoi là** : « La reprise », c'est la première journée après la coupure
  d'été. La fin naturelle est la **dernière journée avant la trêve d'hiver**.
  Super League et Ligue 1 jouent vraisemblablement leur dernier week-end de
  l'année vers le 19-20 décembre ; **à vérifier sur `/matchs` avant de
  l'écrire en base**.
  La saison, lancée vers le 19 septembre (date exacte : `saisons.lancee_a` en
  production), dure ainsi **13 semaines**, dont environ 9 avec les missions si
  elles arrivent mi-octobre.
- **Ce que la fin ferme : rien.** Les séries ouvertes restent ouvertes (« une
  saison est additive »), LA REPRISE comprise. La fin arrête le carnet,
  les divisions de saison et le classement « saison ». Elle éteint les bonus
  de KOP à portée `saison` (C6).
- **Écrire la date** : `saisons.fin_a`, saisie comme une chaîne littérale
  `'2026-12-20 23:59:59'` (heure de Zurich), comparée **en SQL** à `NOW(3)`.
  Les jours restants se calculent avec `DATEDIFF(DATE(fin_a), CURDATE())`. Une
  date passée par un `Date` JavaScript à travers le pool `'Z'` se décalerait
  de une à deux heures.

### 6.2 La récompense selon la participation : le carnet de tampons

Chaque mission réclamée rapporte des tampons (§ 4.4) : jusqu'à 5 par jour.
Le carnet a cinq paliers. Chaque palier se **récupère dès qu'il est atteint**,
pour une satisfaction immédiate. À la fin de la saison, les paliers non
récupérés sont **versés d'office** : rien ne se perd. Le plus haut palier
atteint devient un **titre permanent**.

Calibré sur les 9 semaines restantes de la saison 1 : un assidu fait environ
4,7 tampons par jour joué (≈ 290 au total), un joueur moyen 2,8 (≈ 125), un
occasionnel 1,6 (≈ 45).

| Palier | Tampons | Nom (propre à S1) | Récompense | Qui l'atteint |
|---|---|---|---|---|
| 1 | 10 | De retour | 100 écharpes | tout le monde, en 2 à 6 jours |
| 2 | 40 | Dans le bain | 1 booster + 150 écharpes + **liseré d'écharpe S1** autour de l'avatar | l'occasionnel, vers la fin |
| 3 | 100 | Remis en voix | 2 boosters + 250 écharpes + **tampon S1** sur la carte de supporter | le joueur moyen |
| 4 | 180 | Au rendez-vous | 3 boosters + 400 écharpes | l'assidu, en 5-6 semaines |
| 5 | 260 | Revenu pour de bon | 4 boosters + 600 écharpes + **titre « Revenu pour de bon »**, affiché au classement et au profil, pour toujours | l'assidu qui ne manque presque rien |

Pour le palier le plus haut : 10 boosters et 1 500 écharpes sur la saison.
C'est peu d'argent, et beaucoup d'honneur.

**Le carnet appartient à la saison** : une colonne JSON `saisons.carnet`,
éditée dans l'onglet Saisons de l'administration. Chaque saison écrit ses
propres paliers et ses noms. Gabarit pour la suivante : seuils à environ 3 %,
15 %, 35 %, 60 % et 90 % de ce qu'un assidu peut faire (jours × 4,7).

**Les insignes ne sont jamais des tenues.** Un abonné porte « n'importe quelle
tenue publiée » (`JURIDIQUE.md`, § 1). Une tenue de saison donnée en
récompense serait donc portable par tous les abonnés sans l'avoir gagnée.
Liseré, tampon et titre sont du SVG et du CSS : aucun dessin à générer, et
c'est l'écharpe-insigne de FAIT MAIN.

**Le passage de relais** : au lancement de la saison 2, tout joueur qui a au
moins **10 tampons en S1** reçoit **2 boosters** (« les sachets de la trêve »),
annoncés avec la saison. C'est ce qui ramène les joueurs le jour où il se
passe quelque chose.

### 6.3 La saison 2 : « La trêve », du 21 décembre 2026 au 28 février 2027

- **Ce qu'elle ouvre** : **une seule** des douze séries fermées. Il ne s'agit
  pas de rouvrir les douze ; c'est le lancement voulu, et la question a déjà
  été posée. Proposition : **LES HÉROS DU CANAPÉ** (HC), « ils n'y étaient
  pas, et ils savent mieux » : 10 lignées et 5 légendaires déjà écrites,
  presque le gabarit de 12. Pendant la trêve, le supporter regarde les autres
  championnats depuis son canapé, et le Virage vit des matchs anglais,
  italiens, portugais : la mission `ailleurs` prend tout son sens.
  Alternative d'hiver : **LES PHÉNOMÈNES MÉTÉO** (MT, 9 + 5). Vérifier les
  dessins dans `catalogue.html` tel qu'il est (ne pas lancer
  `npm run catalogue`, qui réécrit des fichiers suivis).
- **Les contenus neufs de la saison** (pièces, actions, stade) doivent porter
  `publie: false` dans `src/shared/` **avant leur premier semis**, sans quoi
  ils naissent ouverts.
- **Un carnet S2** à ses propres paliers, sur 10 semaines : 10 / 45 / 110 /
  200 / 290.
- **Les divisions repartent de zéro** ; la meilleure division de S1 reste en
  insigne.
- **Annonce** : la ligne de la saison 2 existe en brouillon, avec
  `prevue_a = '2026-12-21 18:00:00'`, dès que le contenu est prêt. Avant que
  la date soit posée, le kiosque affiche « SAISON 2 · BIENTÔT » sans date.
  Annoncer une date, c'est promettre (`saisons.js` : « annoncer la 5 avant de
  l'avoir lancée serait promettre ce qui n'existe pas encore »).
- **Cadence ensuite** : des saisons de 10 à 13 semaines, calées sur le
  calendrier (S3 « Le dernier match », de mars à fin mai). Des saisons plus
  courtes demanderaient plus de dessins que la chaîne n'en produit.

**À savoir avant S2** : les vétérans arriveront avec 50 000 à 100 000
écharpes, et HC coûte 1 150 écharpes à faire grandir entièrement. Ils
paieront tout dans la minute. C'est la décision 1 du § 12.

---

## 7. Les paliers de collection et de rang

### 7.1 Collection : oui, un cran tous les 25 objets

**Sur quoi on compte** : le total de `/api/fanzzy/bibliotheque`, c'est-à-dire
tout ce qu'un booster peut donner aujourd'hui. En RP : 35 personnages,
380 états, 190 tenues (2 thèmes), 20 pièces et 10 actions, soit **635
objets, donc 25 crans**. La jauge peut montrer les personnages à part, comme
le veut la synthèse, mais les crans comptent tout. Sur les personnages seuls,
« tous les 25 » ne ferait qu'un cran.

**Rythme mesuré** : l'assidu passe environ 12 crans la première semaine et
les 25 en 4 semaines ; le joueur moyen 6, puis 17 en 4 semaines ;
l'occasionnel 3, puis 7. La saison 2 ajoute environ 250 à 300 objets (avec
HC : 15 personnages, 140 états, 70 tenues, plus ses pièces et ses actions),
soit une dizaine de crans.

| | Récompense |
|---|---|
| Chaque cran | 25 écharpes |
| Tous les 4 crans (100, 200, 300… objets) | 1 booster en plus |
| **Série complète** (tous les personnages d'une série) | 1 booster + 100 écharpes + tampon « COMPLET » sur la page de la série |

**Payé une fois, par un registre « au plus haut »** : on paie chaque seuil
*t* (multiple de `collection.cran`) tel que *t* > le plus haut seuil déjà
payé et *t* ≤ le compte actuel. Deux raisons :

- le compte peut **baisser** quand une tenue est dépubliée (la bibliothèque
  ne compte que le publié) ;
- `collection.cran` peut changer en cours de route. Avec un registre au plus
  haut, passer de 25 à 20 ne repaie pas les seuils déjà franchis.

### 7.2 Rang : cinq divisions de ferveur de saison

**Des seuils absolus, jamais des centiles.** Une division atteinte reste
acquise pour la saison : on ne la perd pas parce que d'autres vous dépassent.
C'est la même règle que la carte de présence. Elle se compte sur la ferveur
**classée** de la saison (Virage `classe = 1` et duel `mode = 'classe'`,
entre `lancee_a` et `fin_a`), donc sous les plafonds gratuits.

| Division | Seuil (ferveur de saison) | Gain, une fois par saison | Qui l'atteint, sur 13 semaines (estimation) |
|---|---|---|---|
| Sympathisant | dès la première ferveur | l'insigne | tout le monde |
| Habitué | 5 000 | 50 écharpes | le premier ou le deuxième soir |
| Fervent | 30 000 | 1 booster + 100 écharpes | l'occasionnel |
| Ultra | 100 000 | 2 boosters + 150 écharpes | le joueur moyen |
| Capo | 300 000 | 3 boosters + 200 écharpes + titre « Capo de la saison 1 » | l'assidu **sans abonnement**, en 6-8 semaines |

- **Estimation de la ferveur** : un duel classé rapporte environ 600 à 1 000
  ferveur (environ 33 par chant, divisée par deux hors de son club) ; une
  heure de Virage dans une petite tribune, environ 1 200 à 2 400. Un assidu
  gratuit fait donc environ 5 000 à 7 000 par jour, un joueur moyen 1 500 à
  2 500. **L'incertitude est d'un facteur deux** : les seuils sont des
  réglages, à recaler sur la requête de l'annexe A (viser environ 70 %, 40 %,
  15 % et 4 % des joueurs actifs pour Habitué, Fervent, Ultra et Capo).
  Relever un seuil en cours de saison ne retire rien à qui l'a franchi.
- **Capo doit rester atteignable sans abonnement.** C'est la condition pour
  que les divisions ne mesurent pas la carte bancaire : la ferveur
  s'accumule, et le classement de tête est déjà réservé de fait aux abonnés
  (`abonnement/index.js`, en tête). Toute recalibration doit garder Capo à la
  portée de 5 classés et 2 Virages par jour.
- **Prérequis** : C4 (une ferveur qui s'arrondit à zéro rendrait les
  divisions inatteignables dans les tribunes nombreuses) et C7 (la fenêtre de
  saison).
- **L'insigne** : la couleur de l'écharpe autour de l'avatar (mécanisme 11 de
  la synthèse), au classement, au KOP et en salle d'attente. Aucune
  puissance.

---

## 8. Les réglages à ajouter au registre

Deux sections nouvelles dans `src/shared/reglages.js`, au format du registre.
Les montants sont de l'équilibrage, donc réglables ; la **définition** d'une
mission (cible, source, condition) est du code, comme une carte.

```js
/* SECTIONS, à ajouter */
{ id: 'quotidien', titre: 'LE QUOTIDIEN',
  aide: 'Les missions du jour et la carte de présence. Identiques pour tous, ' +
    'abonnés compris : rien de ce que l’abonnement vend ne s’y gagne.' },
{ id: 'saison', titre: 'LA SAISON',
  aide: 'Tampons, crans de collection et divisions. Les paliers du carnet se ' +
    'règlent saison par saison, dans l’onglet Saisons.' },

/* ---------------------------------------------------------- quotidien */
{ cle: 'missions.actif', section: 'quotidien', type: 'booleen', defaut: true,
  titre: 'Proposer les missions du jour',
  aide: 'Éteint, aucune mission n’est tirée ; celles déjà terminées restent dues.' },
{ cle: 'missions.actives', section: 'quotidien', type: 'liste',
  titre: 'Missions au tirage',
  defaut: ['boosters', 'duel', 'virage', 'cartes', 'grandir',
    'parfaits', 'tribune', 'victoire', 'classes', 'club', 'kop',
    'serie', 'victoires', 'mitemps', 'ailleurs'],
  aide: 'Retirer un identifiant le sort du tirage dès le lendemain. Les missions ' +
    'de réserve (humain, ami, vote) s’ajoutent ici le jour où la population suit.' },
{ cle: 'missions.relances', section: 'quotidien', type: 'entier',
  titre: 'Relances gratuites par jour', unite: 'relances', min: 0, max: 3, defaut: 1 },
{ cle: 'missions.facile.echarpes', section: 'quotidien', type: 'entier',
  titre: 'Mission facile', unite: 'écharpes', min: 0, max: 500, defaut: 30 },
{ cle: 'missions.facile.xp', section: 'quotidien', type: 'entier',
  titre: 'Mission facile', unite: 'XP', min: 0, max: 500, defaut: 20 },
{ cle: 'missions.moyenne.echarpes', section: 'quotidien', type: 'entier',
  titre: 'Mission moyenne', unite: 'écharpes', min: 0, max: 500, defaut: 60 },
{ cle: 'missions.moyenne.xp', section: 'quotidien', type: 'entier',
  titre: 'Mission moyenne', unite: 'XP', min: 0, max: 500, defaut: 40 },
{ cle: 'missions.difficile.echarpes', section: 'quotidien', type: 'entier',
  titre: 'Mission difficile', unite: 'écharpes', min: 0, max: 1000, defaut: 100 },
{ cle: 'missions.difficile.xp', section: 'quotidien', type: 'entier',
  titre: 'Mission difficile', unite: 'XP', min: 0, max: 500, defaut: 60 },
{ cle: 'missions.complet.boosters', section: 'quotidien', type: 'entier',
  titre: 'Le sachet des trois missions', unite: 'boosters', min: 0, max: 3, defaut: 1,
  aide: 'Versé dans la réserve, même au-dessus du plafond, comme le booster du parcours.' },
{ cle: 'missions.part_kop', section: 'quotidien', type: 'booleen', defaut: false,
  titre: 'Verser aussi au pot du KOP les missions de club',
  aide: 'Éteint par défaut : des comptes factices rempliraient un pot qui achète ' +
    'de la poussée sur la corde.' },
{ cle: 'bonus.base', section: 'quotidien', type: 'entier',
  titre: 'Première case de la carte de présence', unite: 'écharpes', min: 0, max: 500, defaut: 20 },
{ cle: 'bonus.pas', section: 'quotidien', type: 'entier',
  titre: 'Chaque case suivante ajoute', unite: 'écharpes', min: 0, max: 100, defaut: 5 },
{ cle: 'bonus.j7_boosters', section: 'quotidien', type: 'entier',
  titre: 'La septième case ajoute', unite: 'boosters', min: 0, max: 3, defaut: 1,
  aide: 'La carte avance d’une case par jour réclamé et ne recule jamais : ' +
    '« aucune série quotidienne qu’on perd ».' },

/* ------------------------------------------------------------- saison */
{ cle: 'saison.tampons.facile', section: 'saison', type: 'entier',
  titre: 'Tampons d’une mission facile', unite: 'tampons', min: 0, max: 10, defaut: 1 },
{ cle: 'saison.tampons.moyenne', section: 'saison', type: 'entier',
  titre: 'Tampons d’une mission moyenne', unite: 'tampons', min: 0, max: 10, defaut: 1 },
{ cle: 'saison.tampons.difficile', section: 'saison', type: 'entier',
  titre: 'Tampons d’une mission difficile', unite: 'tampons', min: 0, max: 10, defaut: 2 },
{ cle: 'saison.tampons.complet', section: 'saison', type: 'entier',
  titre: 'Tampon des trois missions', unite: 'tampons', min: 0, max: 10, defaut: 1 },
{ cle: 'saison.sachets_suivante', section: 'saison', type: 'entier',
  titre: 'Boosters offerts au lancement de la saison suivante', unite: 'boosters',
  min: 0, max: 5, defaut: 2 },
{ cle: 'saison.sachets_seuil', section: 'saison', type: 'entier',
  titre: '… à qui a au moins', unite: 'tampons dans la saison précédente',
  min: 0, max: 1000, defaut: 10 },
{ cle: 'collection.cran', section: 'saison', type: 'entier',
  titre: 'Un cran de collection tous les', unite: 'objets', min: 5, max: 200, defaut: 25,
  aide: 'Payé au plus haut seuil franchi : changer ce nombre ne repaie rien.' },
{ cle: 'collection.cran_echarpes', section: 'saison', type: 'entier',
  titre: 'Chaque cran rapporte', unite: 'écharpes', min: 0, max: 500, defaut: 25 },
{ cle: 'collection.cran_booster_tous', section: 'saison', type: 'entier',
  titre: 'Un booster en plus tous les', unite: 'crans', min: 0, max: 20, defaut: 4 },
{ cle: 'collection.serie_echarpes', section: 'saison', type: 'entier',
  titre: 'Une série complète rapporte', unite: 'écharpes', min: 0, max: 2000, defaut: 100 },
{ cle: 'collection.serie_boosters', section: 'saison', type: 'entier',
  titre: 'Une série complète rapporte aussi', unite: 'boosters', min: 0, max: 5, defaut: 1 },
{ cle: 'rang.habitue', section: 'saison', type: 'entier',
  titre: 'Division Habitué', unite: 'ferveur de saison', min: 0, max: 100000000, defaut: 5000 },
{ cle: 'rang.fervent', section: 'saison', type: 'entier',
  titre: 'Division Fervent', unite: 'ferveur de saison', min: 0, max: 100000000, defaut: 30000 },
{ cle: 'rang.ultra', section: 'saison', type: 'entier',
  titre: 'Division Ultra', unite: 'ferveur de saison', min: 0, max: 100000000, defaut: 100000 },
{ cle: 'rang.capo', section: 'saison', type: 'entier',
  titre: 'Division Capo', unite: 'ferveur de saison', min: 0, max: 100000000, defaut: 300000,
  aide: 'Doit rester atteignable sans abonnement (5 classés et 2 Virages par jour). ' +
    'Recaler sur la requête de l’annexe A d’ECONOMIE.md.' },
{ cle: 'rang.echarpes_par_cran', section: 'saison', type: 'entier',
  titre: 'Une division rapporte, par rang', unite: 'écharpes', min: 0, max: 1000, defaut: 50,
  aide: 'Habitué 50, Fervent 100, Ultra 150, Capo 200.' },
{ cle: 'rang.boosters_par_cran', section: 'saison', type: 'entier',
  titre: 'Une division rapporte, par rang au-delà d’Habitué', unite: 'boosters',
  min: 0, max: 3, defaut: 1, aide: 'Fervent 1, Ultra 2, Capo 3.' },
```

Le **carnet de saison 1**, dans `saisons.carnet` :

```json
{ "paliers": [
  { "tampons": 10,  "nom": "De retour",          "echarpes": 100, "boosters": 0 },
  { "tampons": 40,  "nom": "Dans le bain",       "echarpes": 150, "boosters": 1, "insigne": "lisere" },
  { "tampons": 100, "nom": "Remis en voix",      "echarpes": 250, "boosters": 2, "insigne": "tampon" },
  { "tampons": 180, "nom": "Au rendez-vous",     "echarpes": 400, "boosters": 3 },
  { "tampons": 260, "nom": "Revenu pour de bon", "echarpes": 600, "boosters": 4, "titre": true }
] }
```

Le test `aide-smoke` exige déjà que la FAQ suive les réglages. Les textes des
missions doivent faire de même : ce sont des fonctions qui lisent la cible et
le montant, jamais des nombres recopiés.

---

## 9. L'effet total sur l'économie

Simulation de six semaines, avec missions et carte de présence, plus les
paliers (carnet, divisions, collection) comptés au prorata. Par semaine, le
premier mois.

| Profil | Écharpes en plus | Boosters en plus | XP en plus | Ce qui change pour lui |
|---|---|---|---|---|
| **Assidu** (7 j/7) | **+2 500** (+15 % sur 16 700) : quotidien 1 500, sachets ouverts et paliers de niveau 600, carnet, divisions et crans 400 | **+10,8** (+3 % sur 336) : 6,3 sachets, 1 carte de présence, 3,5 paliers | **+830** (+26 %) | niveau 28 au jour 28 au lieu de 25 ; titre et Capo dans la saison |
| **Moyen** (5 j/7) | **+1 150** (+23 % sur 5 000) | **+3,8** (+3 % sur 120) | **+380** (+39 %) | niveau 16 au jour 28 au lieu de 13 ; palier 3 du carnet ; Ultra |
| **Occasionnel** (3 j/7) | **+460** (+32 % sur 1 430) | **+1,3** (+4 % sur 36) | **+130** (+50 %) | 1 345 écharpes en évolutions la première semaine au lieu de 1 013 ; palier 2 ; Fervent |

**Ce que ces chiffres disent :**

- **Les boosters ne bougent presque pas** (+3 à +4 %) : le quotidien ne
  touche ni au rythme que vend l'abonnement ni aux taux de tirage.
- **Les écharpes montent surtout chez ceux qui jouent peu**, et c'est voulu :
  pour eux, elles pèsent encore. Pour l'assidu, +15 % d'une monnaie déjà en
  excès ne change rien (C1).
- **C'est l'XP qui fait le travail** : +26 à +50 %. Le niveau n'ouvre que des
  capacités (emplacements de club, 3ᵉ Fanzzy au niveau 5). Le niveau 5 arrive
  un jour plus tôt pour un nouveau venu, et les paliers de niveau versent leurs
  4 640 écharpes plus tôt, sans en verser davantage.
- **Le Virage passe de zéro** à jusqu'à 190 écharpes, 120 XP et 4 tampons par
  jour, par les missions `virage`, `tribune`, `club`, `mitemps` et `ailleurs`.

---

## 10. Ce qu'il ne faut pas casser

1. **L'argent réel n'achète que l'abonnement.** Aucune récompense ne diffère
   entre abonnés et non-abonnés : pas de « ×2 abonné », pas de carnet payant.
   Un passe de saison payant serait un **nouvel article**, à inscrire dans
   `LIVRAISONS_PAYANTES`, donc une décision et une question au juriste. Ce
   n'est pas un réglage.
2. **Ce que l'abonnement vend reste vendu.** Aucune récompense ne donne : un
   duel classé de plus, un Virage compté de plus, un format classé au-dessus
   du 1 contre 1, une réserve plus haute, une recharge plus rapide, un
   emplacement de club, le droit de porter une tenue, la création d'un KOP,
   de la mémoire de parcours ou de souvenirs. Les boosters donnés sont des
   **cadeaux ponctuels** dans la réserve, jamais un plafond. **Aucune tenue en
   récompense** (§ 6.2).
3. **Les missions tiennent sous les plafonds gratuits** (§ 4.1, principe 3).
   Un abonné ne fait pas ses missions plus vite qu'un autre, à deux duels
   classés près.
4. **Les taux de tirage ne bougent pas.** Les boosters offerts sont les
   boosters du kiosque, ouverts sur la série que le joueur choisit.
5. **Aucune puissance.** Écharpes, XP (qui ouvre sans donner), insignes,
   titres. Le moteur ne lit jamais une récompense. `niveau-smoke` échoue si le
   mot « niveau » apparaît dans `src/server/nvn/engine.js` : les compteurs
   ajoutés au moteur (§ 11) ne doivent pas l'écrire, même en commentaire.
6. **Aucune série qu'on perd** (§ 5), **aucune division qu'on perd** (§ 7.2),
   **aucun palier qui se perd** à la fin de la saison (§ 6.2).
7. **La répétition ne rapporte rien.** Elle reste hors de tout compteur.
8. **Ce qu'une saison ouvre reste ouvert**, et la saison 2 ouvre **une**
   série, pas douze.
9. **Une horloge, celle des quotas** : `CURDATE()`.
10. **Un schéma incomplet n'enlève rien au joueur.** Sans les nouvelles tables,
    les routes du quotidien répondent « indisponible », le jeu tourne comme
    avant, et le journal nomme le fichier à appliquer (§ 11). Jamais une
    erreur qui éteint `/api`.

---

## 11. Ce que ça demande au serveur

### Schéma (un fichier, `sql/quotidien.sql`, inscrit dans `scripts/ordre-schema.mjs`)

```sql
-- Ce qui n'a pas de ligne datée ailleurs : booster ouvert, évolution, versement au KOP.
CREATE TABLE IF NOT EXISTS compteurs_jour (
  user_id CHAR(36)    NOT NULL,
  jour    DATE        NOT NULL,          -- CURDATE() : le jour de Zurich, écrit en SQL
  cle     VARCHAR(24) NOT NULL,          -- 'booster' | 'evolution' | 'kop_verse'
  n       INT         NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, jour, cle)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS missions_jour (
  user_id    CHAR(36)    NOT NULL,
  jour       DATE        NOT NULL,
  rang       TINYINT     NOT NULL,       -- 0 facile, 1 moyenne, 2 difficile
  mission    VARCHAR(24) NOT NULL,
  cible      SMALLINT    NOT NULL,
  relancee   TINYINT(1)  NOT NULL DEFAULT 0,
  reclamee_a DATETIME(3)     NULL,
  -- ce qui a été versé, et non ce que les réglages disent aujourd'hui
  echarpes SMALLINT NULL, xp SMALLINT NULL, tampons TINYINT NULL, saison_id INT UNSIGNED NULL,
  PRIMARY KEY (user_id, jour, rang)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS presences (
  user_id  CHAR(36) NOT NULL,
  jour     DATE     NOT NULL,
  case_carte TINYINT  NOT NULL,
  echarpes SMALLINT NOT NULL,
  boosters TINYINT  NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, jour)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tout ce qui se paie une fois : palier de carnet, division, cran, série complète,
-- sachets de la saison suivante. INSERT IGNORE puis versement si la ligne est neuve.
CREATE TABLE IF NOT EXISTS paliers_verses (
  user_id   CHAR(36)     NOT NULL,
  sorte     VARCHAR(12)  NOT NULL,       -- 'carnet' | 'division' | 'cran' | 'serie' | 'relais'
  saison_id INT UNSIGNED NOT NULL DEFAULT 0,
  cle       VARCHAR(32)  NOT NULL,       -- '100', 'ultra', '275', 'RP'…
  echarpes  INT          NOT NULL DEFAULT 0,
  boosters  TINYINT      NOT NULL DEFAULT 0,
  verse_a   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, sorte, saison_id, cle)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE saisons ADD COLUMN IF NOT EXISTS fin_a    DATETIME(3) NULL;
ALTER TABLE saisons ADD COLUMN IF NOT EXISTS prevue_a DATETIME(3) NULL;
ALTER TABLE saisons ADD COLUMN IF NOT EXISTS carnet   JSON        NULL;

ALTER TABLE virage_presence ADD COLUMN IF NOT EXISTS chants    INT     NOT NULL DEFAULT 0;
ALTER TABLE virage_presence ADD COLUMN IF NOT EXISTS parfaits  INT     NOT NULL DEFAULT 0;
ALTER TABLE virage_presence ADD COLUMN IF NOT EXISTS serie_max TINYINT NOT NULL DEFAULT 0;
ALTER TABLE virage_presence ADD COLUMN IF NOT EXISTS cartes    INT     NOT NULL DEFAULT 0;
ALTER TABLE virage_presence ADD COLUMN IF NOT EXISTS mi_temps  TINYINT NOT NULL DEFAULT 0;
ALTER TABLE duel_results    ADD COLUMN IF NOT EXISTS chants    INT     NOT NULL DEFAULT 0;
ALTER TABLE duel_results    ADD COLUMN IF NOT EXISTS parfaits  INT     NOT NULL DEFAULT 0;
ALTER TABLE duel_results    ADD COLUMN IF NOT EXISTS serie_max TINYINT NOT NULL DEFAULT 0;
ALTER TABLE duel_results    ADD COLUMN IF NOT EXISTS cartes    INT     NOT NULL DEFAULT 0;
ALTER TABLE kop_bonus       ADD COLUMN IF NOT EXISTS saison_id INT UNSIGNED NULL;
```

### Les points d'écriture

- **Virage, sans requête de plus** : le chant écrit déjà sa ligne à chaque
  poussée (`onPush` → `souvenirs.recordPush`, un `ON DUPLICATE KEY UPDATE`).
  On y ajoute les deltas `chants + 1`, `parfaits + (q > 0,9)`,
  `serie_max = GREATEST(serie_max, VALUES(serie_max))`, `cartes + 1` pour une
  carte, et `mi_temps = mi_temps | VALUES(mi_temps)` selon la période du vrai
  match. La série en cours vit sur le membre de la salle, en mémoire.
- **Duel** : le moteur compte par joueur (chants, parfaits, série, cartes) ; la
  ligne de `duel_results` l'écrit en fin de partie, avec le reste.
- **Booster, évolution, KOP** : `INSERT … ON DUPLICATE KEY UPDATE n = n + ?`
  dans `compteurs_jour`, **après** la validation de la transaction. Comme
  `packs_ouverts`, il ne doit pas pouvoir faire échouer l'action
  (`ER_NO_SUCH_TABLE` avalé et journalisé).
- **Réclamer** : une transaction, `FOR UPDATE` sur la ligne, recompte depuis
  les sources, écharpes versées dans la transaction. L'XP passe **après** la
  validation, par `niveau.gagner()`, seule porte de l'XP.
- **Fin de saison, à la lecture** : au premier passage après `fin_a`, on verse
  d'office les paliers du carnet non récupérés (`paliers_verses` rend
  l'opération idempotente). `kop.modsDe` ignore les bonus `saison` d'une
  saison close (C6).

### Trois pièges déjà rencontrés à ne pas refaire

- **`niveau.gagner()` n'est pas atomique.** Il lit `xp`, puis écrit
  `xp = xp + n`. Deux gains simultanés (une mission réclamée pendant qu'un
  duel se termine) peuvent **payer deux fois** les écharpes du même palier de
  niveau. Les missions ajoutent une source d'XP concurrente : il faut un
  `SELECT … FOR UPDATE` dans une transaction avant de les brancher.
- **Le seuil PARFAIT** vit dans `public/virage.html:1933`. Il faut un
  `src/shared/duel/verdict.js` (PARFAIT > 0,9, BON > 0,7, MOYEN > 0,4) lu par
  la page, le duel et les compteurs, sinon l'écran annoncera des PARFAIT que
  la mission ne compte pas.
- **Compter des chants, pas de la ferveur** : à cause de C4, `ferveur > 0`
  peut être faux pour quelqu'un qui a chanté toute la soirée dans une grande
  tribune.

---

## 12. À trancher par Gaël (hors délégation)

1. **L'inflation des écharpes, avant la saison 2.** En régime établi, un
   booster rend 45,6 écharpes pour un prix de 45, et 77 % de ses places
   ouvertes retombent sur une poignée de 11,5 en moyenne. Deux leviers, tous
   deux dans le code des tirages (donc pas dans le registre, à juste titre) :
   a) une poignée réduite (2 écharpes) quand la catégorie tirée est épuisée,
   ce qui ramène un booster établi à environ 29 ; b) baisser
   `SCARVES.legendaire` (45 → 20), ce qui retire environ 4 écharpes par
   booster (7 en comptant les doublons de pièces légendaires). Sans
   décision, les vétérans paieront la saison 2 entière dans la minute. Le
   quotidien proposé ici fonctionne avec ou sans.

   **Tranché le 6 octobre 2026, et fait : le levier a).** Une catégorie
   épuisée (toutes les tenues, tous les états ou toutes les cartes d'action
   déjà gagnés) rend `POIGNEE_DE_REPLI`, 2 écharpes
   (`src/shared/fanzzy/dex.js`, lue par `tirerAutreChose`). La catégorie des
   écharpes garde sa poignée de 6, 14 ou 30, et une pièce d'équipement en
   double son tarif de doublon. Le levier b) n'est pas pris : la légendaire en
   double rend toujours 45. `serveur/sim-eco.mjs`, relancé avec la règle :
   un booster établi rend **28,8 écharpes au lieu de 45,8** ; un assidu
   encaisse 11 700 écharpes par semaine au lieu de 16 700 (semaines 3 et 4),
   et son solde du 28ᵉ jour passe de 58 000 à 41 000. **Le nouveau venu y perd
   aussi** : ses vingt premiers boosters rendent 12,3 écharpes au lieu de
   18,2, parce que les sept cartes d'action de LA REPRISE sont vite toutes
   gagnées et que la catégorie se replie dès lors. Un occasionnel fait grandir
   pour 760 écharpes la première semaine au lieu de 1 020, et ses trente
   lignées atteignent toujours le troisième âge vers le 28ᵉ jour. Le ricochet
   de l'abonnement (C3) tombe d'environ 2 700 à environ 1 700 écharpes par
   jour. Contrôlé par `fanzzy:smoke` (« le repli : deux écharpes »).
2. **L'XP du Virage.** Proposé : un réglage `xp.virage` à **15 XP par match**
   poussé (au moins 20 chants réussis), versé par le bilan de tribune
   (mécanisme 10 de la synthèse). C'est l'équivalent d'un entraînement. C'est
   une règle, pas un montant : d'où la question.
3. **« La quête », le bonus de KOP qui ne fait rien (C5)** : le brancher sur
   les écharpes de duel, ou le retirer de la liste. En attendant, un KOP peut
   y perdre 900 écharpes.

   **Tranché le 6 octobre 2026, et fait : retiré.** « La quête » et « Mur de
   bâches » (500 écharpes, des contres que le Virage ne connaît pas) quittent
   `src/shared/kop.js` pour de bon. Chaque achat est rendu au pot de son KOP,
   900 ou 500 écharpes, une fois, par le serveur à son démarrage
   (`rendreLesRetires`, `src/server/kop/index.js`) : la ligne de `kop_bonus`
   devient `rendu:echarpes` ou `rendu:contres` dans la transaction qui
   crédite le pot, si bien que les démarrages suivants n'ont plus rien à
   rendre. Aucun changement de schéma. Contrôlé par `kop:smoke` (« les
   retirés, rendus au pot ») et `cablage`.
4. **La ferveur arrondie à zéro (C4)** : accumuler le reste décimal par
   supporter et n'arrondir qu'à l'écriture. Les divisions en dépendent.
5. **`JURIDIQUE.md` est en retard** sur deux points qui touchent aux
   récompenses : il décrit « emplacements 1 à 3 : carte commune garantie »
   (le code : 1 personnage sûr, un second 7 fois sur 10, 3 places ouvertes), et
   ne mentionne pas les boosters de l'abonnement (1 par mois, 6 par an). C3
   mérite d'y être ajouté. Les boosters offerts par le quotidien n'y changent
   rien, puisqu'ils ne s'achètent pas.

---

## Annexe A. Recaler les divisions sur la vraie ferveur (lecture seule)

```sql
-- Ferveur classée de la saison en cours, par joueur, du plus faible au plus fort.
SELECT x.user_id, SUM(x.ferveur) AS ferveur
  FROM (SELECT user_id, ferveur, last_push_at AS quand FROM virage_presence WHERE classe = 1
        UNION ALL
        SELECT user_id, ferveur, ended_at FROM duel_results WHERE mode = 'classe') x
 WHERE x.quand >= (SELECT MAX(lancee_a) FROM saisons WHERE lancee_a IS NOT NULL)
 GROUP BY x.user_id
 ORDER BY ferveur;
```

Lire les valeurs aux rangs 30 %, 60 %, 85 % et 96 % de la liste. On les
projette sur la durée de la saison en multipliant par jours totaux / jours
écoulés. Ces quatre nombres deviennent `rang.habitue`, `rang.fervent`,
`rang.ultra` et `rang.capo`.

## Annexe B. La simulation

`serveur/sim-eco.mjs` importe en lecture `dex.js`,
`inventaire.js`, `actions.js` et `niveau.js`, et recopie `openPack` et
`tirerAutreChose` à l'identique : places ouvertes, poignées, replis, doublons
d'équipement, tenues et états par âge débloqué. Elle ajoute le barème des
duels et les écharpes de palier.

- `node sim-eco.mjs` : la production (LA REPRISE seule).
- `node sim-eco.mjs tout` : le contenu du code entièrement ouvert ; les
  conclusions sont les mêmes.
- `node sim-eco.mjs --missions` : avec le quotidien proposé.

Hors modèle : le paquet de bienvenue, l'étal, les vignettes, l'abonné, la
saison 2. Le bac à sable ne survit pas à la session. Pour garder l'outil, il
faudrait l'installer dans `scripts/`, avec le même garde que `economie.mjs` :
relire les constantes du serveur et s'arrêter si elles ont bougé.
