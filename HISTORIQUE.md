# Journal des sessions

Ce fichier était la plus grosse partie d'`ETAT.md`, qui s'intitule « à lire en
premier » : **trente-sept sections** de journal, trois mille cent cinquante
lignes, soit près des deux tiers du document. Pour savoir si une chose marchait,
il fallait lire trente-sept récits dans l'ordre et rejouer mentalement ce que
chacun avait fait ou défait — alors qu'`ETAT.md` a justement des sections pour
dire ce qui existe, ce qui reste et quels pièges sont connus.

Le journal n'a pourtant rien perdu de sa valeur : c'est ici que vit le **pourquoi**
des décisions, et le code y renvoie. Il est donc déplacé, pas résumé et pas
élagué — les sections sont exactement celles d'avant, dans le même ordre et avec
le même texte.

## Comment s'en servir

Ne pas le lire en entier. On y vient avec une question précise :

- *pourquoi ce code est-il écrit ainsi ?* — chercher le nom du fichier ou de la
  fonction ; la session qui l'a écrit explique presque toujours ce qu'elle
  remplaçait ;
- *cette chose a-t-elle déjà été tentée ?* — chercher le symptôme, pas la
  solution ;
- *d'où vient ce nombre ?* — les chiffres cités ici valent **pour la session qui
  les écrit**, et pas au-delà. Ceux qui font foi viennent de
  `npm run dossier` et `npm run catalogue`.

Les sections sont numérotées en ordinaux latins — 4 bis, 4 ter, … 4 tricies
novies — dans l'ordre où elles ont été écrites. La plus récente est **en bas**.
Les numéros ne se suivent pas tout à fait : ils comptent les sessions, dont
quelques-unes n'ont rien laissé ici.

---

## 4 bis. Ce que la dernière session a ajouté

Tout cela est commité — « Maj V0.30 », deux cent une entrées — mais **rien
n'est encore en ligne** : le déploiement ne part pas tout seul. Cette liste
existe pour qu'on sache quoi chercher, et où.

**Les amis.** `/amis`, `src/server/amis/index.js`, `sql/amis.sql`. Voir qui suit
les mêmes clubs, se demander en ami, s'inviter dans un KOP. Une seule ligne par
paire ; deux demandes croisées valent une acceptation ; sept jours d'attente
après un refus.

**Les couleurs des clubs, tirées des blasons.** `src/server/football/blason.js`
décode le PNG à la main — `zlib.inflateSync`, dé-filtrage Paeth compris — et
`couleurs.js` en tire deux teintes dominantes. **Ni le logo ni le nom ne sont
stockés**, seulement deux couleurs : c'est ce qui rend la chose tenable
juridiquement. Elles teintent le « GOAL ! » et les tribunes des stades.

**Le déploiement depuis GitHub.** `.github/workflows/deploiement.yml`,
`scripts/deployer.sh`, `scripts/appliquer-schema.mjs`. Déclenchement manuel,
`verif-pages` et `verif-cablage` en barrage, puis SSH, `git reset --hard`,
`npm ci`, **le schéma avant le redémarrage**, et une attente sur `/healthz`
jusqu'à ce qu'il annonce le commit poussé. C'est la réponse à la panne de onze
heures du 8 septembre 2026.

**Un emplacement de club se garde à un seul endroit.**
`src/server/onboarding/slots.js`. Le bug : on pouvait suivre six clubs avec
deux emplacements, parce que `onboarding.follow` et `store.follow` étaient deux
portes et qu'une seule avait un verrou. C'est le troisième cas de « une règle
écrite à deux endroits » de cette session, avec l'horloge du match et la fiche
d'un Fanzzy.

**L'horloge d'un match en direct.** `public/horloge.js`. Elle était écrite
**quatre fois**, avec trois listes de périodes différentes. Elle fait courir la
minute depuis l'instant du relevé, et refuse de parler dans trois cas : match
fini, période arrêtée, et plus de nouvelles depuis un quart d'heure.

**La fiche d'un Fanzzy, une seule fois.** `public/fanzzy-fiche.js` et `.css` :
le même rendu, monté en panneau par-dessus le classeur ou comme page.

**Les cartes d'action illustrées, et ce qu'on voit quand elles partent.**
`public/action-art.js` porte les sept familles — une seule table, le classeur
et le duel la partageaient mal — et la mise en scène d'une carte jouée : elle
arrive du bas si elle est à soi, du haut si elle est adverse, tient la pose avec
son dessin, puis se replie vers le nœud de la corde.

**Les sept pièces d'équipement, détourées.** `public/stuff-art.js`,
`scripts/stuff-images.mjs`. Elles s'affichent au deck, au kiosque, à la
bienvenue et au profil.

**Les cinq stades, et la lumière de leurs tribunes.** `src/shared/stades.js`,
`public/stade-art.js`, `scripts/stade-images.mjs`. Le catalogue et les effets
symétriques sont écrits ; le branchement de la collection reste à faire (§ 5,
point 6).

**Les cartes d'action dans le Grand Virage.** Quatorze des vingt et une.
`VirageRoom` a gagné une main, des recharges, des effets et des fenêtres
collectives ; `src/shared/duel/effets.js` porte la mécanique commune aux deux
moteurs. Voir § 3 pour la règle de portée, qui est le cœur de l'affaire.

**Sur les écrans**, en vrac : le personnage est plus grand sur l'accueil et ne
déborde plus de sa bande ; la barre du bas fait la largeur de la colonne ; un
Fanzzy qui n'était pas le bon n'apparaît plus une fraction de seconde au
rafraîchissement (`tbf.perso` en mémoire) ; les compétitions sont cliquables
depuis `/matchs` ; la fiche d'un match donne la date, l'heure, deux boutons
DUEL et VIRAGE, et **le Fanzzy qui regarde le match** en réagissant aux
événements ; le sélecteur de langue a quitté `/equipes`, où il n'avait rien à
faire.

---

## 4 ter. Dix gestes, douze chants, un répertoire qui tourne

Le duel n'était pas répétitif parce qu'il n'avait que trois gestes. Il l'était
parce qu'**un joueur n'en faisait jamais qu'un** : le sien, celui de son
Fanzzy, cent fois de suite. Le diagnostic compte plus que le remède, parce
qu'on aurait pu ajouter sept gestes et ne rien changer du tout.

### Les dix gestes — `src/server/ferveur/gestures.js`

Aux trois d'origine — tempo, martelage, endurance — s'en ajoutent sept :

| geste | ce qu'on demande |
|---|---|
| `contretemps` | taper **entre** les pulsations, pas dessus |
| `echo` | répéter un motif de quatre frappes que le serveur vient de donner |
| `crescendo` | dix frappes de plus en plus rapprochées, de 700 ms à 260 ms |
| `relance` | attendre près de deux secondes sans rien faire, puis tenir |
| `salves` | trois rafales de quatre, séparées par un silence exact |
| `tenue` | tenir le plus longtemps possible **sans dépasser** 4,2 s |
| `retenue` | exactement douze frappes en quatre secondes, ni onze ni treize |

Les deux derniers sont des gestes de **risque** : trop en faire y coûte plus
cher que pas assez. C'est ce qui les distingue vraiment des cinq autres, et
c'est pour cela qu'ils ne partagent pas leur barème.

**Les sept nouveaux n'ont pas leurs propres modificateurs.** `tempoWindow`
élargit toutes les fenêtres de rythme, `holdForgive` paie toutes les tenues :
un Fanzzy de la voix aide sur l'écho comme sur le tempo. Dix familles de
modificateurs pour dix gestes, et plus personne n'aurait su ce que porte son
personnage.

### Le déroulé est partagé — `public/geste.js`

Il vivait deux fois, dans `virage.html` et dans `nvn-ui.html`, et il n'y avait
que trois gestes. À dix, la duplication devenait indéfendable. `TBF_GESTE`
expose `jouer`, `LABEL`, `AIDE`, `COULEUR`, et **ne contient aucun nombre de
jeu** : toutes les durées viennent de `S.you.gestes`, que le serveur remplit
avec les modificateurs du porteur. Les identifiants du balisage (`pad`, `ring`,
`n`, `s`, `jauge`) sont volontairement ceux d'origine, pour que le CSS des deux
pages et les contrôles existants continuent de valoir.

### Le duel impose le geste, et il tourne

`prochainGeste()` dans `src/server/nvn/engine.js` : un chant sur deux est celui
du Fanzzy actif, l'autre est pris dans les neuf restants, à tour de rôle. **Le
geste annoncé par le client est ignoré** — il l'était déjà à moitié, ce qui
était pire que pas du tout.

Le motif de l'écho suit le même chemin (`j.motif`), et `noterContre` a dû
passer d'une notation « au plus proche » à une notation **dans l'ordre** : un
mauvais motif obtenait 0,8 parce que ses quatre frappes trouvaient toujours un
temps attendu à qui se raccrocher. Dans l'ordre, il obtient 0,4.

### Le Virage : douze chants, cinq offerts — `src/server/ferveur/virage.js`

La rangée des chants est un `flex` : douze cartes y feraient vingt-deux pixels
de large sur un iPhone SE. C'est **la contrainte d'écran qui a décidé du
mécanisme**, et c'est assumé — le répertoire n'offre que cinq chants à la fois,
et il glisse d'un cran toutes les dix minutes du **vrai match**.

- `ORDRE` est écrit à la main et ce n'est pas décoratif : cinq chants
  consécutifs doivent toujours mêler au moins quatre gestes, sinon dix minutes
  de match se joueraient entièrement au martelage. Un contrôle le vérifie, et
  une mutation qui groupe les gestes par famille le fait tomber.
- D'un répertoire au suivant, **un seul chant change**. Une tribune ne perd pas
  d'un coup tout ce qu'elle vient d'apprendre.
- Le changement est **annoncé** (`virage:repertoire`). La page ne reçoit
  `virage:state` qu'à l'entrée : sans ce message, un supporter garderait
  jusqu'au coup de sifflet final les cinq chants du moment où il est arrivé.
- Le message porte le **motif d'écho** mais pas la fenêtre. Le motif appartient
  à la tribune, qui le chante ensemble ; la fenêtre est personnelle — un
  Métronome ou une écharpe l'élargissent — et la page tient déjà la sienne.
- Un chant hors répertoire est refusé, **et pour cette raison-là**
  (`chant_hors_repertoire`). Un « carte inconnue » aurait envoyé chercher un
  bogue là où il n'y a qu'une horloge.
- La bascule tolère l'ancien répertoire **quinze secondes**, motif compris : un
  chant dure quatre secondes, et celui qui a commencé avant que l'horloge
  tourne le termine après. Le compter faux serait punir le supporter d'une
  minute qui n'est pas la sienne.

Les chants portent maintenant un `nom`. La page affichait `c.id`, et la tribune
lisait « onetaitla ».

### Trois cartes d'action de plus — 24 au total

- **Changement de chant** (`a-relais`, rare, 20 souffle, 35 s) — défausse la
  main, en reprend cinq. **Ce qu'on jette revient dans la pioche**, y compris la
  carte elle-même : sans cela, ce serait un moyen lent de vider son propre deck.
- **Nouveau souffle** (`a-souffleneuf`, légendaire, 38 souffle, 75 s) — toutes
  les recharges tombent d'un coup. Elle vaut plus cher au Virage, où les
  recharges durent une fois et demie celles du duel.
- **Tifo** (`a-tifo`, épique, 26 souffle, 40 s) — s'arme, **se voit** huit
  secondes, puis pousse de 95. Le seul effet du jeu que l'adversaire voit venir
  et peut contrer. Il passe par le chemin ordinaire, donc il est divisé par
  l'effectif comme tout le reste : un tifo n'échappe pas plus à la règle de la
  foule qu'un fumigène.

Les trois sont de portée `soi`, donc `dansLeVirage` les accepte — et le moteur
du Virage a dû apprendre à les résoudre, sinon elles y auraient été distribuées
pour lever `unknown_effect`. C'est la troisième fois que la règle de portée se
venge : voir § 3.

---

## 4 quater. Le fuseau, et pourquoi aucune suite ne le voyait

**C'est la panne la plus instructive du projet.** Elle a trois visages et une
seule cause, et elle a survécu à deux corrections parce que les suites
éprouvaient une application que personne ne déploie.

### La cause

`mysql2` est réglé sur `timezone: 'Z'` dans `src/server/auth/db.js`. Ce réglage
décide de **deux** conversions, dans les deux sens :

- une colonne DATETIME **lue** devient un objet `Date` interprété comme de
  l'UTC ;
- un objet `Date` **écrit** est sérialisé en UTC.

Or la base écrit aussi par elle-même, avec `NOW(3)`, qui rend l'heure de la
session MySQL — locale sur la plupart des serveurs. Sur la machine de
développement, l'écart vaut **deux heures**. D'où deux règles, et elles ne se
mélangent pas :

| la colonne est écrite par | on la relit ainsi |
|---|---|
| `NOW(3)` en SQL | `UNIX_TIMESTAMP(col) * 1000` — **jamais** en JavaScript |
| un objet `Date` depuis JS | on la compare à `UTC_TIMESTAMP(3)` — **jamais** à `NOW(3)` |

### Ce que ça cassait

- **La minute du vrai match restait figée.** `fixtures.polled_at` est écrit par
  `NOW(3)` et était relu en JavaScript : l'instant de lecture partait deux
  heures dans le futur, `Date.now() - vuA` devenait négatif, et l'horloge — qui
  refuse de compter à l'envers — restait clouée sur la minute du chargement.
  Dans le Virage, sur l'écran de choix, et sur `/equipes`.
- **La réinitialisation de mot de passe ne marchait pas du tout.**
  `auth_tokens.expires_at` est écrit depuis JavaScript, donc en UTC, et
  comparé à `NOW(3)`. Un jeton de réinitialisation vit **une heure** : il
  naissait déjà expiré. Le jeton de vérification, lui, vit quarante-huit
  heures — il marchait, en mourant deux heures trop tôt, ce qui faisait passer
  la panne pour un caprice plutôt que pour une règle.
- **Le délai après un refus d'ami annonçait huit jours au lieu de sept.**
  `amities.repondu_le` est écrit par `NOW(3)` et était relu en JavaScript.

### Pourquoi les suites ne le voyaient pas

**Elles ouvraient leur pool sans `timezone`.** Vingt-cinq suites écrivaient
donc en heure locale, les deux horloges tombaient d'accord, et tout était vert
sur un réglage que le serveur n'utilise jamais. Le réglage vit maintenant dans
`OPTIONS_BASE`, exporté par `scripts/base-de-test.mjs`, et toutes les suites
s'en servent.

Ce n'était pas suffisant : **le semis doit lui aussi ressembler à la
production.** `equipes-ui-smoke` semait `polled_at` avec `UTC_TIMESTAMP()`
alors que le relevé du direct l'écrit avec `NOW(3)`. Une suite qui sème
autrement que le serveur éprouve une donnée qui n'existe pas.

**La leçon, au-delà des dates :** un contrôle ne vaut que si son environnement
est celui de la production. Charset, fuseau, options du pilote, façon de semer
— tout ce qui diffère est un endroit où le vert ne veut rien dire.

---

## 4 quinquies. L'écran, dans cette session

**La flèche de retour.** En haut à gauche de toutes les pages sauf l'accueil.
Le menu était la seule navigation depuis la disparition de la barre du bas, et
rentrer demandait deux gestes — ouvrir le tiroir, viser la première ligne —
pour le mouvement le plus fréquent du jeu.

**Le dégagement des deux boutons flottants est écrit une fois**, dans `nav.js`,
sous `--tbf-haut-g` et `--tbf-haut-d`. Il valait `58px`, recopié dans le duel
et dans le Virage ; le blason du club de droite passait quand même à six pixels
du bouton de menu, ce qui, de loin, se lit comme un recouvrement.

**Le voile de l'écran de choix est opaque.** Il était à 96 %, et l'en-tête du
jeu — blasons vides, « 0 – 0 » d'avant l'entrée — transparaissait dessous.

**L'accueil nomme son Fanzzy.** Le nom n'existait que dans l'attribut `alt` de
l'image : le personnage tenait le centre de l'écran sans que rien ne dise qui
il est. Le nom et l'âge atteint voyagent dans le **même souvenir**
(`localStorage`) que le visage, et pour la même raison — sinon le nom arrivait
trois allers-retours après la tête. Les rails y gagnent le **KOP** et les
**AMIS**, qui n'étaient joignables que par le menu.

---

## 4 sexies. Le booster, rééquilibré

Un booster donnait **quatre supporters sur cinq** en moyenne : trois garantis,
plus une chance sur deux à chacune des deux dernières places. La collection
avançait, mais l'équipement, les tenues et les cartes d'action n'arrivaient
presque jamais, et deux ouvertures se ressemblaient.

Désormais : **un ou deux supporters, jamais plus**. La première place en est un
— c'est la garantie, personne ne doit tomber sur cinq objets et zéro
personnage. La deuxième en est un sept fois sur dix. Les trois dernières
n'en sont **jamais** : elles tirent dans `PLACES_OUVERTES` — carte d'action 30 %,
équipement 25 %, tenue 20 %, écharpes 25 %.

Les **écharpes** entrent au tirage, et ce n'est pas un lot de consolation :
c'est ce qui paie les évolutions, donc les âges qu'aucun booster ne donne.
C'est aussi le seul lot qui ne peut pas être vide, et il sert donc de recours
aux autres catégories — un joueur qui possède déjà toutes les tenues recevait
un supporter de plus.

**La dernière branche de `tirerAutreChose` est nommée.** Elle ne l'était pas :
toute catégorie sans branche à elle sortait en carte d'action, en silence. Une
mutation qui remettait « fanzzy » dans la table restait donc verte — le
supporter promis sortait en pyro. Un contrôle vérifie maintenant que les cinq
catégories déclarées tombent **vraiment**.

---

## 4 septies. Les douze chants illustrés

`scripts/chant-images.mjs` et `public/chant-art.js`, sur le modèle des cartes
d'action. Trois différences, chacune décidée par une contrainte :

- **Du paysage, et petit.** Une case de chant fait 72 pixels de large ; servir
  du 480×640 comme pour les cartes d'action ferait télécharger seize fois ce
  qu'on affiche. On sert 320×240.
- **Le haut du cadre doit être sombre.** Le nom, le coût et la poussée
  s'écrivent par-dessus le dessin ; l'invite le demande, et un voile en dégradé
  le garantit quand le modèle n'obéit pas.
- **Le dessin dit le geste, pas le chant.** Un supporter qui tape en rythme, un
  autre qui retient son souffle, une tribune qui répond à son capo : c'est ce
  que le joueur va devoir faire dans les quatre secondes qui suivent. Douze
  tribunes génériques ne l'auraient aidé en rien.

Les douze chants vivent maintenant dans `src/shared/duel/chants.js`, à côté des
cartes d'action : la chaîne d'illustrations et les contrôles en ont besoin, et
aucun des deux ne peut importer un moteur de salle pour lire une table.

---

## 4 octies. Cinq épreuves qui ne sont ni du rythme ni de la force

`src/server/ferveur/epreuves.js`, `public/geste.js`, `npm run epreuves:ui`.

Les dix gestes demandaient tous la même chose — frapper au bon moment, frapper
vite, tenir — et se notaient tous depuis une liste d'instants. Ces cinq-ci
demandent autre chose :

| épreuve | ce qu'on demande | ce qui est noté |
|---|---|---|
| **tifo** | suivre un trait du doigt (rond, écharpe, fanion, cœur) | précision × couverture × **ordre** |
| **les visages** | retenir huit visages, puis retrouver les paires | paires trouvées, moins les essais ratés |
| **mosaïque** | une grille s'allume une seconde, la refaire | cases justes moins fausses |
| **l'écharpe** | tourner le doigt, trois tours, dans le sens demandé | tours × rondeur |
| **le capo** | répéter une suite de six zones | le plus long début juste |

### Le contrat, en deux temps

La **consigne** est tirée d'une graine — la même que le motif de l'écho — donc
reproductible : la page dessine exactement la forme que le serveur notera. La
**réponse** a la forme que la famille demande : un tracé, une grille, une
suite. Les deux moteurs n'en savent rien : ils demandent une note, ils
reçoivent une note entre 0 et 1,2, comme pour les dix autres.

### Trois choses trouvées en éprouvant, et qu'aucune lecture n'aurait données

**Le gribouillis marquait 0,78.** Précision et couverture ne suffisent pas :
soixante points jetés au hasard sont à moitié sur le trait et approchent toute
la forme. C'est l'**ordre** qui sépare un tracé d'un gribouillis — un doigt qui
suit une forme avance le long d'elle, sans se téléporter. Le contrôle qui le
prouve prend le bon tracé et **mêle ses points** : même précision, même
couverture, seul l'ordre change, et la note doit tomber.

**Le tirage rendait toujours la même forme.** Un générateur de Lehmer rend une
valeur proportionnelle à sa graine au premier appel ; pour des graines de un à
quarante — c'est-à-dire toutes les nôtres — le premier tirage valait toujours
presque zéro. On ne s'en aperçoit qu'en essayant plusieurs graines : avec une
seule, tout a l'air parfaitement aléatoire.

**`setPointerCapture` emportait le tracé.** L'appel lève quand le pointeur
n'est plus actif, il était en tête du gestionnaire d'appui, et il emportait la
ligne suivante — celle qui pose le point de départ. Le geste mourait pour toute
sa durée, sans que rien ne le dise. La capture est un confort ; le tracé est le
geste. On prend donc le point d'abord, et la capture ensuite, sous garde.

### Le filet anti-robot refusait un joueur honnête sur vingt

La consigne part chez le joueur, donc la réponse aussi : la mosaïque et le capo
*montrent* ce qu'il faut refaire. La défense est la vraisemblance, comme pour
les dix gestes — mais le seuil était mal réglé.

Il exigeait un écart type d'au moins **14 ms** entre les coups. Sur six coups,
soit cinq écarts, l'hésitation naturelle d'un humain tombe sous ce seuil
**5,1 % du temps** — mesuré sur quarante mille tirages, pas supposé. Un joueur
sur vingt était traité en tricheur.

À **6 ms**, la machine reste attrapée cent fois sur cent, même bruitée de trois
millisecondes, et l'honnête ne passe plus qu'une fois sur cinq cents. Et la
régularité ne se juge plus sous quatre écarts, parce qu'une statistique sur
trois valeurs ne vaut rien.

**La leçon, au-delà du seuil :** un filet qui attrape le joueur qu'il devait
protéger finit par être désactivé, et alors il n'attrape plus personne. Un
seuil se mesure ; il ne se choisit pas au jugé.

---

## 4 nonies. L'écran d'ouverture

`public/ouverture.js`, le fond dans `public/img/ecran/`.

La tribune en fusion, cinq Fanzzy en éventail, et le nom du jeu. Le cadre est
**écrit dans la page** et non monté par un script : un écran d'ouverture qu'il
faut charger pour voir arrive après ce qu'il était censé couvrir.

Les visages viennent de `FZART.ILLUSTRES` — la seule liste qui sache quels
personnages sont dessinés. La recopier l'aurait fait mentir au premier dessin
ajouté.

**Il part à la première de trois conditions** : l'accueil dit qu'il est prêt
(`tbf:pret`), le temps est écoulé, ou l'on touche l'écran. La minuterie est
posée en premier, et ce n'est pas une précaution ajoutée après coup : si tout
le reste échoue — un script cassé plus haut, un réseau mort — c'est elle qui
empêche l'ouverture de devenir une porte close.

**Une fois par session, pas une fois par visite.** L'accueil est l'écran vers
lequel tout revient ; rejouer l'ouverture à chaque retour, c'est deux secondes
de tribune entre deux parties et un premier geste avalé à chaque fois, puisque
l'écran couvre le bouton qu'on visait.

---

## 4 decies. La boutique, et Stripe

`src/shared/boutique.js`, `src/server/boutique/index.js`, `sql/boutique.sql`,
`public/boutique.html`, `npm run boutique:smoke`.

### Les quatre règles, dans l'ordre d'importance

**1. Le prix ne vient jamais du client.** La commande ne porte qu'un
identifiant d'article ; le montant est lu dans le catalogue, côté serveur.

**2. La livraison se fait dans le webhook, pas au retour du joueur.** La page
de retour dit merci — elle n'est pas fiable. On ferme l'onglet, on perd le
réseau, on paie depuis un autre appareil. Livrer au retour, c'est ne pas livrer
à qui a fermé la page et livrer deux fois à qui a rechargé.

**3. Le rejeu ne doit rien changer.** Stripe renvoie le même événement jusqu'à
ce qu'on réponde 200, et parfois après. La commande se **réclame** par un
`UPDATE … WHERE etat <> 'livre'` dont on lit le nombre de lignes touchées : une
seule transaction peut en toucher une, les autres repartent sans rien remettre.
C'est plus solide qu'une lecture verrouillée — et surtout, c'est **éprouvable**.
Aucune course fabriquée ne faisait rougir le retrait de `FOR UPDATE` ; retirer
la condition d'état fait rougir trois contrôles.

**4. La signature a besoin du corps brut.** `express.json()` transforme les
octets que Stripe a signés et les jette ; il ne reste plus rien à vérifier, et
l'on accepte alors n'importe quel appel prétendant venir de Stripe — c'est-à-
dire qu'on offre des boosters à qui connaît l'adresse. Le webhook est monté
**avant** tout analyseur de corps. La comparaison est en temps constant.

### Ce qu'il reste à faire pour encaisser pour de vrai

```
STRIPE_SECRET_KEY=sk_test_…      (puis sk_live_… le jour venu)
STRIPE_WEBHOOK_SECRET=whsec_…
```

Deux variables, et non trois : l'adresse de retour se lit sur `PUBLIC_ORIGIN`,
que la procédure de déploiement fait déjà poser. `SITE_URL` reste accepté en
repli pour les installations qui l'ont écrit — mais il n'y a plus rien à
ajouter pour lui.

Rien d'autre n'est à créer chez Stripe : les deux formules partent en
`price_data` à chaque session, donc **aucun produit ni aucun tarif** n'a à
exister dans le tableau de bord. Ce qui s'y déclare, c'est le webhook.

Sans ces variables, la boutique s'affiche en **vitrine** : le catalogue se lit,
les prix s'affichent, et la commande est refusée avec un code qui le dit. Un
écran qui s'écroule parce qu'une variable manque est plus dur à diagnostiquer
qu'un refus nommé.

Le webhook à déclarer chez Stripe : `POST /api/boutique/webhook`, **cinq**
événements. Cette liste en annonçait trois, et c'était une erreur coûteuse :
sans `invoice.paid`, le premier paiement passe et l'abonnement **s'éteint
silencieusement au bout d'un mois**, faute d'avoir vu le renouvellement. Sans
`customer.subscription.deleted`, une résiliation ne se saurait jamais. Les
cinq sont traités dans `boutique/index.js` ; en déclarer moins revient à en
débrancher une partie sans que rien ne le dise.

| événement | ce qu'il fait |
|---|---|
| `checkout.session.completed` | livre la commande — c'est lui qui pose l'abonnement |
| `checkout.session.async_payment_succeeded` | idem, pour un moyen de paiement différé |
| `checkout.session.expired` | referme une commande abandonnée |
| `invoice.paid` | **le renouvellement** : pousse l'échéance plus loin |
| `customer.subscription.deleted` | la résiliation : l'échéance court jusqu'au terme payé |

### Deux décisions qui ne sont pas du code

**Un booster payé en argent réel est un objet réglementé.** La Belgique et les
Pays-Bas interdisent les coffres à contenu aléatoire achetés avec de l'argent ;
d'autres pays imposent l'affichage des probabilités de tirage. Le jeu est en
français, il suit des clubs suisses et français, et il est ouvert à des
mineurs. Trois choses au moins sont à trancher **avant** d'encaisser un euro :
afficher les taux de tirage (ils sont dans `RATES`), décider si l'on vend des
boosters là où ils sont interdits, et poser un garde-fou d'âge ou un plafond de
dépense. Ce n'est pas un détail d'implémentation, et ce n'est pas à ce dépôt de
le trancher.

**Ce qui est en vente ne décide pas d'un duel.** Les écharpes achètent des âges,
et un âge donne des modificateurs : la ligne entre « acheter du temps » et
« acheter une victoire » est mince. Elle tient à une seule chose — le geste
reste le geste. Un joueur équipé a une fenêtre plus large ; il n'a pas une note
qu'il n'a pas jouée. Le jour où un article vendra de la poussée directe, cette
ligne sera franchie.

---

## 4 undecies. Trois écrans au lieu d'un, et la carte en grand

Le kiosque à boosters, le classeur et le deck vivaient dans une seule page de
mille huit cent trente-six lignes. On y ouvrait un booster au milieu des
informations de collection, et l'écran ne disait pas ce qu'on regardait.

### Ce qui a bougé

| Avant | Après |
|---|---|
| `fanzzy.html` — kiosque + classeur + fiche, 1836 lignes | `fanzzy.html` (~800) : **MON FANZZY / CLASSEUR / DECK** |
| — | `boosters.html` : le kiosque, la déchirure, la révélation |
| `cardHTML` dans la page | `public/cartes.js` — partagé par les deux écrans |
| `.fz*` dans la page | `public/cartes.css` — la même peinture des deux côtés |

La connexion mène à **HOME**, et à `/boosters?aouvrir=1` s'il reste des
boosters : l'écran annonce alors « Tu as X boosters à ouvrir ». Un objet qui
attend et que rien ne signale est un objet oublié.

### L'âge se lit sur la carte

Chaque carte porte en haut à droite **ÉVO 1**, **ÉVO 2**, **ÉVO 3** ou
**LÉGENDAIRE**. Le bandeau du bas ne pouvait pas le porter : la requête de
conteneur `@container (max-width: 150px)` le masque sur les cartes de grille,
c'est-à-dire précisément là où on regarde sa collection. La pastille est donc
dans son propre coin, dimensionnée en pixels avec un plancher, et le contrôle
la mesure **après** l'ouverture de l'onglet — mesurée avant, elle faisait 0×0
et le contrôle passait sur un élément que personne ne voyait.

### La carte s'ouvre en grand — `panneauCarte`

Le panneau de carte existait : il ouvrait un tableau de trois lignes. Il ouvre
maintenant la carte elle-même — le dessin au format 63/80, la famille, la
rareté **en toutes lettres**, le texte entier, puis trois chiffres : souffle,
**recharge** et exemplaires déjà posés. La recharge n'était écrite nulle part
ailleurs, et une carte à quatre-vingt-dix secondes ne se joue pas comme une à
huit.

Les conditions sont rendues en français : `{ mene: 1 }` devient « Ton club doit
être mené au vrai match. » Les clés inconnues sont **nommées** plutôt que
tues — une carte qui refuse de se jouer sans dire pourquoi est une carte
cassée.

### Deux défauts que ce chantier a révélés

**Un second écouteur qui gagnait puis perdait.** J'avais lu que rien
n'écoutait `data-detail`, et j'ai posé un écouteur sur `#corps` pour ouvrir la
carte. Il s'enregistrait **avant** le délégué principal, qui existait depuis le
début : les deux ouvraient un panneau, le second écrasait le premier, et la
suite restait verte en éprouvant l'ancien. Un écran n'a qu'un panneau de carte.
Le contrôle « le panneau permet toujours d'ajouter la carte au deck » existe
pour ça.

**Un contrôle tiré à pile ou face.** Le désordre du tifo mélangeait le tracé
avec `Math.random()` et le comparait à une barre de 0,25. Il est tombé à 0,26.
Un contrôle qui échoue une fois sur deux ne dit rien : on le relance jusqu'au
vert, et le jour où le code casse pour de bon, on le relance aussi. La
permutation est maintenant **tirée avec une graine fixe**, huit fois, et c'est
la **pire** des huit qui est jugée — reproductible (0,20 à chaque lancement) et
plus sévère qu'un tirage unique. Retirer le facteur d'ordre la remonte à 1,20.

### Éprouvé

`deck:ui` a dix-sept contrôles de plus sur la carte en grand, et quinze
mutations les tuent **chacune sur son propre contrôle** : dessin retiré, cadre
passé au carré, glyphe retiré, souffle retiré, recharge retirée, texte tronqué,
rareté en clé, famille vidée, bouton d'ajout retiré, condition supprimée,
condition en mécanique brute, revers supprimé, encadré toujours affiché, carte
plus montée en grand. `boosters:ui` est une suite neuve (~300 contrôles
déplacés depuis `fanzzy:ui`), qui monte son propre serveur comme toutes les
autres.

---

## 4 duodecies. Une administration qui règle vraiment

### Ce que l'administrateur pouvait déjà faire

Sept onglets, et ils marchaient : **APERÇU** (chiffres d'exploitation, purge du
cache, envoi de contrôle), **FANZZY** (créer, modifier, dépublier une carte,
ouvrir et fermer les séries — sans déploiement), **TENUES** (les thèmes de
costume, même chose), **JOUEURS** (chercher, créditer écharpes et boosters,
vérifier une adresse, bloquer, promouvoir), **COMPÉTITIONS** (activer, changer
de rang), **JOURNAL** (qui a fait quoi, depuis quelle adresse), et **RÉGLAGES**.

### Le défaut : les réglages ne réglaient rien

Le septième onglet était deux champs de texte — une clé, une valeur JSON. Pour
s'en servir il fallait connaître de mémoire le nom de la clé, son type et
l'étendue de ce qu'elle accepte : c'est-à-dire avoir lu le code. Ce n'est pas
un écran d'administration, c'est une console de base de données avec une mise
en page.

**Et sur toutes les clés qu'on pouvait y taper, une seule était lue par le
jeu** — `series_actives`. L'écran proposait même en exemple une clé
`annonce` « qui affiche un bandeau pour tous les joueurs » : rien, nulle part,
ne la lisait. On pouvait l'écrire, la relire, la voir listée, et il ne se
passait rien.

Un réglage qui ne règle rien ne casse rien : il se contente de ne pas être là,
et on ne s'en aperçoit que le jour où l'on en a besoin.

### Le registre — `src/shared/reglages.js`

Vingt-six réglages déclarés, en six sections. Chacun porte son type, ses
bornes, son unité, son défaut et son aide. **L'écran se dessine à partir de ces
déclarations** et le serveur **valide contre elles** : ajouter un réglage, c'est
ajouter une ligne, et l'écran comme la validation suivent.

Les défauts sont la **seule source de vérité**. `PACK_REGEN_MS` se déduit de
`pack.regen_min`, et non l'inverse ; deux endroits qui portent la même valeur
finissent toujours par diverger, et ici le désaccord serait muet.

Le branchement tient en une technique : les constantes deviennent des **getters
d'objet**. `RULES.goalAt` s'écrit toujours pareil sur les quarante sites qui le
lisent, et interroge le registre à chaque lecture. Aucun appelant n'a changé.
Vérifié avant d'écrire : personne ne déstructure ces objets au chargement —
`const { goalAt } = RULES` figerait la valeur et le réglage redeviendrait
décoratif.

Ce qui n'est **délibérément pas** réglable : les prix en euros (ils vivent dans
le catalogue de la boutique) et les taux de tirage d'un booster payant, qui sont
une donnée réglementée dans plusieurs pays.

### Deux fonctionnalités qui n'existaient pas

**Le bandeau d'annonce** — celui que l'écran promettait. Monté par la barre
commune, donc présent sur chaque page sans qu'il faille y penser. Posé en
`textContent` : un champ d'administration reste une entrée, on ne monte pas du
HTML avec.

**La fermeture du jeu.** Le réglage le plus dangereux de l'écran : mal posé, il
enferme dehors celui qui vient de le poser. Trois garde-fous — le verrou ne
coûte rien quand il est levé (premier test en mémoire, le rôle n'est lu en base
que pendant une fermeture) ; l'authentification et l'administration restent
ouvertes, sans quoi il n'existerait plus aucun chemin pour rouvrir ; et le refus
se nomme, `503` avec un message, jamais une page blanche.

### Trois défauts trouvés en éprouvant, et qu'aucune lecture n'aurait donnés

**Le texte était analysé deux fois.** Le pilote analyse lui-même les colonnes
JSON : un nombre revient en nombre, un texte revient **déjà analysé**. Le type
seul ne distingue donc pas « du JSON à analyser » d'« une chaîne qu'on vient de
m'analyser ». Les réglages chiffrés passaient sans rien dire ; le premier
réglage textuel faisait tomber le chargement. L'ancien code d'administration
portait la même faute, latente, faute d'avoir jamais eu un réglage textuel.

**La raison du refus n'arrivait pas.** Le serveur refusait correctement, en
nommant la borne — « attendu entre 50 et 2000, reçu 5 » — et ne renvoyait que le
code. La raison finissait dans les journaux, c'est-à-dire nulle part pour la
personne devant l'écran.

**Le message de refus était effacé aussitôt écrit.** L'écran l'affichait, puis
redessinait la vue pour revenir à la valeur d'avant — ce qui remplaçait le
bandeau. Deux lignes correctes chacune, et ensemble elles ne montraient rien.

### Éprouvé

`npm run reglages:smoke` (40 contrôles) et 15 mutations, **chacune tuée sur son
propre contrôle** : cache non rechargé, seuil remis en dur, bornes ignorées,
refus anonyme, décimale acceptée, clé hors registre acceptée, texte non borné,
choix non vérifié, valeur illégale non rattrapée, retour au défaut qui écrit au
lieu d'effacer, écriture avant validation, route publique qui rend tout,
annonce sans sa bascule, texte analysé deux fois. `admin:ui` a treize contrôles
de plus sur l'écran.

---

## 4 terdecies. L'ascenseur, le personnage, la boutique

### L'ascenseur était celui du système

Un rail clair en plein milieu d'un écran sombre, sur toutes les pages sauf
trois qui l'avaient traité pour elles-mêmes. La règle est maintenant dans la
feuille commune et vaut pour **tout ce qui défile** — page, panneaux, tiroirs,
listes. Les deux syntaxes sont écrites, parce qu'aucune ne couvre l'autre :
`scrollbar-width`/`scrollbar-color` pour Firefox, `::-webkit-scrollbar` pour
WebKit. Le sélecteur est en `:where()`, qui ne pèse rien : les pages qui
avaient déjà masqué ou habillé leur barre gardent leur décision.

### Le personnage ne faisait que respirer

Une boucle unique de trois secondes six. L'œil l'apprend en dix secondes, et le
personnage redevient une image fixe avec un défaut de compression.

Il a maintenant **trois gestes de repos**, tirés au hasard, espacés au hasard
entre cinq et douze secondes : l'appui qui change de jambe, le regard qui
balaie, le coup d'épaule. Ce qui donne l'impression du vivant n'est pas
l'amplitude — elle reste sous le degré — c'est **l'irrégularité**. Un geste à
cadence fixe est un métronome, et c'est pire que l'immobilité.

Sur « Mon Fanzzy », **toucher le personnage le fait sauter**. Pas dans le
Virage : la même zone y sert à chanter, et un saut non demandé au milieu d'un
chant se lirait comme un défaut.

**La fluidité se gagne dans le sommeil, pas dans le poids.** Hors de l'écran ou
onglet caché, la scène s'endort : minuterie coupée, respiration en pause. Le
navigateur ralentit les minuteries d'un onglet masqué, il ne ralentit pas une
animation composée — elle continue donc de faire tourner le compositeur pour
personne. Tout se joue en `transform`, que le compositeur traite sans repasser
par la mise en page ni par le dessin, et rien de tout cela ne touche la grille
du classeur et ses cent cinquante-deux vignettes.

**Un défaut trouvé au passage :** `saute` et `change` animaient le **même
calque**, et comme la règle de `change` vient plus bas dans la feuille, c'est
elle qui gagnait. Toucher le personnage juste après un changement de pose ne
produisait rien — aucune erreur, aucune trace, le geste était simplement
absent. Le module porte pourtant la règle en toutes lettres : un calque par
geste. Elle avait été appliquée partout sauf là, et rien ne l'éprouvait.

### La boutique était introuvable

Servie sur `/boutique` depuis qu'elle a été écrite, et rangée dans le menu
accordéon au milieu de treize entrées : c'est-à-dire nulle part. Personne
n'ouvre un menu pour **découvrir** qu'une boutique existe.

Toucher sa monnaie est le geste que tout joueur essaie en premier. Les deux
jetons de la barre — écharpes et boosters — étaient des `div` inertes qui
affichaient un nombre ; ce sont maintenant des liens vers la boutique, avec un
`+` discret. **Deux barres à traiter** : l'accueil a la sienne, antérieure à
`nav.js` et jamais remplacée, avec son propre balisage. *(Le menu des deux a
depuis été fusionné dans `public/menu.js` — voir 4 tricies quater. Les barres
elles-mêmes restent distinctes, et c'est voulu : l'accueil est un écran de jeu
plein cadre, les autres pages ont un titre et une flèche de retour.)*

---

## 4 quaterdecies. Les billets, et la fin des coffres payants

### Ce qui était en vente, et pourquoi c'était un problème

Les quatre rayons de la boutique menaient **tous** à de l'aléatoire :

| En vente | Ce que c'était vraiment |
|---|---|
| Boosters, 1,99 € à 18,99 € | un coffre à contenu aléatoire |
| « Une tenue », 2,49 € | un **tirage** parmi les tenues qui manquent |
| « Une pièce d'équipement », 2,49 € | un **tirage** parmi les pièces qui manquent |
| Écharpes, 2,99 € à 17,99 € | une écharpe achète un booster à 45 — un coffre, avec une étape de plus |

Plusieurs pays traitent le coffre payant comme un jeu de hasard : la Belgique et
les Pays-Bas l'ont interdit, d'autres imposent l'affichage des probabilités. Le
jeu suit des clubs suisses et français, il est en français, et il est ouvert à
des mineurs.

### Le nouveau modèle

**L'argent réel achète des billets, et rien d'autre.** Les billets achètent des
objets **nommés** : cette pièce d'équipement-là, cette tenue-là sur ce Fanzzy-là
à cet âge-là. On voit ce qu'on prend avant de le prendre.

Les boosters restent : gratuits à la recharge, ou payés en écharpes gagnées en
poussant. **Les écharpes ne s'achètent plus du tout** — elles seules font
grandir un Fanzzy, donc la progression du jeu reste entièrement hors de portée
d'une carte bancaire.

Aucun chemin ne mène d'un euro à un tirage. Ce n'est pas une précaution de
façade, c'est une propriété du catalogue, et `verifierCatalogue()` la tient.

Le nom : **billets**. « Fanion » a été écarté — c'est déjà un motif de tifo, et
le joueur lirait « dessine un fanion » et « tu as 200 fanions » sur le même
écran. Le renommer coûte une ligne : `MONNAIE`, dans `src/shared/boutique.js`.

### Les fichiers

| Fichier | Rôle |
|---|---|
| `src/shared/boutique.js` | le catalogue payant, `LIVRAISONS_PAYANTES`, `verifierCatalogue()` |
| `src/shared/etal.js` | ce que les billets achètent, **déduit** de `STUFF` et de la table des tenues |
| `sql/billets.sql` | `user_wallet.billets`, en `INT` — un SMALLINT déborde à trois gros paquets |
| `remettreStuff` / `remettreTenue` | donner un objet **nommé**, à côté d'`offrir` qui tire au sort |
| `POST /api/boutique/depenser` | débit et remise dans une transaction |

Les prix **en billets** sont au registre (section « L'ÉTAL EN BILLETS ») : c'est
de l'équilibrage, ça se retouche en regardant ce que les joueurs prennent. Les
prix **en euros** restent hors de l'écran — un prix qu'on change d'un doigt est
un prix qui finira changé par erreur.

### La règle est gardée par des contrôles, pas par une intention

Elle se casse en **ajoutant**, pas en retirant : trois lignes au catalogue et la
chaîne est rouverte, sans qu'un fichier existant ait bougé. Les contrôles
regardent donc ce que le catalogue **ne contient pas**, et `LIVRAISONS_PAYANTES`
est le point de décision : si quelqu'un y ajoute `packs`, un contrôle nommé
rougit — et c'est là qu'il faudra reprendre la question des taux de tirage, des
territoires et du garde-fou d'âge. Elles sont écartées aujourd'hui parce que la
chaîne est coupée, pas parce qu'elles ont été résolues.

### Ce que les mutations ont appris

**Trois contrôles ne mordaient pas**, et tous pour la même raison : ils
regardaient un symptôme que la base produisait de toute façon.

- `verifierCatalogue()` ne lisait que le vrai catalogue, qui est correct : on
  pouvait lui retirer sa règle principale sans qu'un contrôle bouge. **Un
  validateur qu'on n'a jamais vu refuser quelque chose n'est pas un
  validateur.** Il prend maintenant un catalogue en argument, et la suite lui en
  donne un mauvais.
- « tenue sur un Fanzzy qu'on ne possède pas » passait parce que les clés
  étrangères refusaient l'écriture. Retirer **notre** garde ne changeait rien de
  visible. Le contrôle vérifie désormais le **code** du refus.
- Un objet hors catalogue était refusé deux fois — par le tarif puis par la
  remise. Le contrôle ne disait pas lequel des deux remparts tenait.

**Et une note du code était fausse.** J'avais écrit que l'ordre comptait — remettre
puis débiter. La mutation qui échange les deux blocs ne casse rien : c'est la
**transaction** qui protège, le `rollback` rendant les billets si la remise
échoue. L'ordre est gardé pour la lisibilité, mais la note dit maintenant ce qui
tient réellement.

---

## 4 quindecies. Le premier paquet se déchire enfin

Le geste d'ouverture du kiosque avait été refait ; **`bienvenue.html` avait
gardé l'ancien**, celui qui ne s'ouvrait pas. Il fallait maintenir le doigt
immobile pour « chauffer », puis tirer sans avoir lâché — et la chauffe se
comptait en **images**, pas en secondes : `charge += 0.02` à chaque
`requestAnimationFrame`. Entre le halo qui respire, le paquet qui tremble et le
dégradé plein écran, une machine lente rend une douzaine d'images par seconde :
quatre secondes d'immobilité parfaite au lieu des huit dixièmes prévus, le
moindre relâchement remettant tout à zéro.

C'est la première minute de jeu de quelqu'un qui vient de s'inscrire.

La page porte maintenant le geste du kiosque : on tire la bande en travers du
haut, l'avancée ne dépend que de la **distance parcourue**, lâcher trop tôt fait
revenir la bande élastiquement, et Entrée ouvre sans le geste.

**Un garde a été posé pour que ça ne se reproduise pas.** `npm run pages` refuse
désormais toute page où un geste avance au rythme des images. Il regarde la
cause et non l'apparence : le défaut est invisible sur la machine de celui qui
l'écrit. Éprouvé — réintroduire le motif fait rougir `pages` en nommant la page.

---

## 4 sexdecies. La boutique sur l'accueil

Cinquième tuile du rail de droite. `.centre` est en `overflow:hidden` : le rail
a donc reçu `max-height:100%` et ses tuiles `min-height:0`, sans quoi la
cinquième sort de l'écran sur un téléphone court et se fait couper en silence.

**Un piège qui a coûté vingt contrôles :** la requête de bourse lit désormais
`billets`, et les vingt-sept suites qui montent leur schéma à la main ne
créaient pas la colonne. Le symptôme n'a rien dit de sa cause — vingt contrôles
de l'accueil ont rougi sur « le Fanzzy équipé n'est pas nommé », parce que tout
l'état du joueur tombait avec la requête. `billets.sql` est maintenant monté par
les vingt-cinq suites concernées, et déclaré dans `schema-smoke` et
`DEPLOIEMENT.md`.

---

## 4 septendecies. Le contrôle de toutes les fonctionnalités

### Deux instruments neufs

**`npm run promesses`** croise ce que les pages appellent avec ce que le
serveur monte. Il ne lance rien, il lit — c'est ce qui lui permet de couvrir les
vingt pages d'un coup. Il existe pour une classe de panne qu'aucune suite ne
trouve : une page qui appelle une route absente reçoit un 404, son `catch`
l'avale, et l'écran s'affiche simplement sans la chose qu'il devait montrer.
C'est exactement ce qui était arrivé à la clé `annonce`.

Il dit aussi ce qu'on ne sert pas, et **la dette de couverture** — sans faire
rougir : un avertissement qui fait échouer devient un avertissement qu'on
désactive.

**`npm run tour:ui`** ouvre les vingt écrans et vérifie ce qui doit être vrai
partout. Onze pages avaient une suite ; **neuf n'en avaient aucune**, dont la
boutique et l'inscription — l'écran où l'on prend l'argent et celui qui accueille
les nouveaux. Écrire neuf suites complètes n'était pas tenable ; garantir un
plancher sur les vingt l'était.

Ses sept contrôles, par écran : aucune erreur de script ; la page affiche du
contenu ; aucun `undefined`, `NaN` ou code d'erreur sous les yeux du joueur ;
rien ne déborde à 360 px ; aucun libellé coupé ; rien ne touche le bord ; tout
ce qui se touche est visible ; les liens mènent quelque part.

### Ce que le tour a trouvé

| Écran | Défaut | Depuis |
|---|---|---|
| accueil | **le rail droit était hors de l'écran** — cinq destinations sur neuf amputées | longtemps |
| administration | en-tête et contenu **côte à côte**, 120 px hors cadre de chaque côté | l'adoption de `ui.css` |
| matchs | « **undefined MATCHS** » en grand quand la journée est vide | — |
| boosters | le carrousel poussait la page à **1013 px** de large sur un écran de 360 | — |
| boutique | titres et intertitres collés au bord | ce tour-ci |

**Le rail de l'accueil est le plus instructif.** `grid-template-columns: … 1fr …`
ne veut pas dire « prends ce qui reste » : `1fr` vaut `minmax(auto, 1fr)`, et ce
`auto` refuse de descendre sous la taille minimale du contenu. La scène portait
un personnage large, imposait sa largeur, et poussait les deux rails dehors.
Comme `.centre` est en `overflow:hidden`, **rien ne débordait** : ça rognait, en
silence. La correction tient en huit caractères — `minmax(0,1fr)` — et il a
fallu une capture d'écran pour la voir.

**L'administration était côte à côte** parce que `ui.css` pose
`body{display:flex}` pour centrer la colonne du jeu, et que l'administration n'a
pas cette colonne. Sur un écran large, invisible ; sur un téléphone,
inutilisable.

### Trois fois où le contrôle avait tort

Un audit qui crie au loup est pire qu'un audit absent : on apprend à lire ses
lignes rouges en diagonale.

- `promesses` ne lisait que les guillemets simples. `app.use("/api/boutique", …)`
  est en doubles, et quatre adresses parfaitement servies étaient rapportées
  comme absentes.
- Le tour mesurait la **boîte** au lieu de l'encre : `h1{padding:16px}` pose son
  texte à seize pixels et sa boîte à zéro, et trois pages correctes étaient
  signalées. Un `Range` mesure ce que l'œil voit.
- Le premier banc d'essai rendait vingt-sept rouges dont vingt-cinq venaient de
  lui : pas d'identité servie, donc pas de barre nulle part ; pas de socket.io,
  donc trois écrans en erreur ; un joueur jamais passé par l'accueil, donc des
  redirections parfaitement justes comptées comme des pannes.

---

## 4 octodecies. Une grammaire commune — `ui.css`

Les vingt écrans étaient corrects et se ressemblaient peu. Ce qui manquait
n'était pas de la couleur — il y en a — c'était **la répétition**. Un jeu se
reconnaît à ce que le même geste produise toujours le même effet.

| Règle | Ce qu'elle répare |
|---|---|
| `--gouttiere`, sur `#app` | plus aucun texte collé au bord ; les écrans pleine largeur la remettent à zéro |
| `--r-commune/rare/epique/legendaire` | les raretés étaient redéfinies quatre fois, avec une nuance de décalage |
| `.tbf-titre` | huit écrans écrivaient leur titre de huit façons ; barre d'accent dorée, lettrage du jeu |
| `.tbf-sous` | le titre de page disait le mot que la barre du haut disait déjà ; ne reste que la ligne qui apprend quelque chose |
| `.tbf-chiffre` | un solde, un score : ça se lit d'un coup d'œil ou ça ne sert à rien |
| `.pan` + filet clair | un panneau cesse d'être un trou dans l'image |
| `:active` sur tout ce qui se touche | un écran qui ne répond pas au doigt fait appuyer deux fois |

### Un seul titre par écran

La barre du haut nomme l'endroit où l'on est, sur toutes les pages, et elle
ne défile pas — elle est en `flex:none` en tête de la colonne. Un titre de
page qui répétait ce mot le disait une deuxième fois, et une troisième quand
un onglet allumé le portait aussi : « Deck » dans la barre, « DECK » sur
l'onglet, « MON DECK » en dessous. Trois fois le même mot sur trois
centimètres, dont deux qui n'apprenaient rien.

La règle est donc : **la barre porte le nom de l'écran, et elle est le `h1`**
de la page. Ce qui reste sous elle est un `.tbf-sous` — la seule ligne qui
ajoutait quelque chose, « trois Fanzzy, dix cartes », remontée de neuf
pixels à douze et demi puisqu'elle n'a plus de titre au-dessus pour la
porter. Elle garde l'écharpe oblique : c'est elle qu'on reconnaît d'un écran
à l'autre, pas le mot répété.

`.tbf-titre` reste au catalogue pour les titres de **section**, à l'intérieur
d'une page. Il n'est plus le titre de la page elle-même.

**Aucune animation permanente n'a été ajoutée.** Ce qui bouge sans arrêt cesse
d'être remarqué en dix secondes et coûte de la batterie pour ça — la leçon de la
respiration du personnage. Tout est statique au repos et ne s'anime qu'au
toucher, en `transform` seul, donc sans mise en page ni redessin.

### Deux pièges de flex et de grille, la même cause

`min-width:0` sur l'identité de la barre, `minmax(0,1fr)` sur la grille de
l'accueil : dans les deux cas, un enfant refusait de descendre sous la taille
minimale de son contenu et poussait ses voisins dehors. C'est le même piège sous
deux noms, et il vaut la peine de le reconnaître du premier coup d'œil.

---

## 4 novemdecies. La sécurité, et ce qu'elle peut réellement couvrir

### La règle qui gouverne tout le reste

**Sur le web, le code du joueur appartient au joueur.** Il peut le lire, le
modifier, le remplacer par un script. Minifier, obscurcir, désactiver le clic
droit ne ralentissent que les curieux de trois minutes. La question n'est jamais
« comment cacher le code » mais **« que se passe-t-il si le client ment »**.

Trois choses ne doivent donc jamais venir du client, et c'était déjà le cas
partout :

| Ce qui ne vient jamais du client | Où ça se décide |
|---|---|
| **Qui il est** | la session, jamais le corps de la requête |
| **Combien il a marqué** | `grade()` note les gestes bruts, côté serveur |
| **Combien coûte ce qu'il achète** | le catalogue et le registre, jamais la page |

### Ce qui était déjà solide

Mots de passe en scrypt ; jetons de session **hachés en base** — une base lue ne
donne pas de sessions utilisables ; cookie `httpOnly` + `sameSite` ; tentatives
de connexion comptées ; défense CSRF par vérification d'origine ; **tout le SQL
paramétré** ; les gestes notés côté serveur avec un filet anti-robot ; les
cadences des sockets bridées ; aucun secret versionné.

### Les trois manques trouvés

**1. Aucun en-tête de sécurité.** Sans `X-Frame-Options`, un site tiers affiche
thebestfan dans un cadre transparent par-dessus ses propres boutons : le joueur
croit cliquer chez eux et clique chez nous, connecté. Sept en-têtes sont posés
dans `src/server/garde/`, écrits à la main plutôt qu'avec `helmet` — sept
lignes, aucune dépendance de plus, et chacune lisible avec sa raison.

La politique de contenu assume ce qu'elle ne peut pas encore faire :
`'unsafe-inline'` sur les scripts est **nécessaire** tant que les vingt pages
portent leur script en ligne, ce qui est le parti pris du dépôt. L'écrire est
plus honnête que de laisser croire la politique stricte.

**2. Aucune limite de cadence sur les routes HTTP.** Les sockets étaient bridées
— un chant toutes les trois secondes — mais rien n'empêchait un script d'appeler
`/api` mille fois par seconde. Une fenêtre glissante, lectures et écritures
comptées séparément, `/healthz` et le webhook de Stripe exemptés.

**3. Une interpolation SQL**, dans `admin/index.js`. Elle est **sûre** —
`champs` ne contient que des littéraux écrits douze lignes plus haut — mais
« sûr parce que je viens de le relire » ne se transmet pas. Elle porte donc un
marqueur `sql-sur` avec sa justification, et l'audit la **compte** au lieu de
la taire : une exception qu'on voit peut être remise en cause, une exception
qu'on a fait taire est une exception qu'on a oubliée.

### Deux instruments permanents

`npm run securite` vérifie quinze invariants. Il ne cherche pas des failles —
aucun script ne fait ça — il vérifie que les **décisions déjà prises** tiennent
encore, parce qu'elles se défont sans bruit : un `requireAdmin` oublié sur une
route neuve, un identifiant lu dans le corps « juste pour ce cas-là ».

`npm run garde:smoke` éprouve les gardes eux-mêmes. Un limiteur rate de deux
façons opposées et **les deux sont silencieuses** : trop lâche il ne bloque
rien et l'on se croit protégé ; trop serré il bloque des joueurs, qui ne se
plaignent pas — ils s'en vont. Les deux bords sont donc éprouvés.

Et le tour des vingt écrans passe désormais **sous les en-têtes réels** : une
politique de contenu ne casse pas bruyamment, elle refuse une ressource et
écrit une ligne dans une console que personne ne lit.

### Ce qu'aucun script ne peut dire

Le mot de passe de la base vit dans le fichier d'environnement du serveur. Rien
ici ne peut dire s'il est fort, ni qui le connaît, ni si l'accès à la base est
ouvert depuis l'extérieur. Ce sont des questions d'hébergement, et elles se
règlent chez Infomaniak.

---

## 4 vicies. Le geste au doigt, et le rechargement

### L'appui long ouvrait le menu du navigateur

Maintenir pour chauffer, tirer pour déchirer, garder le doigt sur une carte :
tous ces gestes appartiennent au jeu, et le navigateur les confisquait pour
proposer « Enregistrer l'image ». `-webkit-touch-callout: none` n'existait
**nulle part** ; `user-select: none` vivait dans quatre pages sur vingt.

Les trois règles sont maintenant dans `ui.css`, donc partout — avec une
**exception qui compte plus que la règle** : tout ce qui se lit et se recopie
reste sélectionnable, y compris les champs de saisie. Une application où l'on ne
peut rien copier est une application dont on ne peut pas demander de l'aide.

**Ce n'est pas une protection du contenu**, et le commentaire le dit : l'image
est déjà dans le navigateur, un onglet suffit à la récupérer. C'est une
correction de confort.

### Le rechargement

Deux choses différentes, une seule ressemblait à un défaut.

`overscroll-behavior` était posé sur `body` — or le tirer-pour-recharger est
décidé par l'élément **racine**. Pendant une partie, un geste de chant qui
commence trop haut devenait un rechargement. La règle est maintenant sur
`html`.

Le rechargement volontaire, lui, ne casse rien : le Virage se rejoint à la
reconnexion, le duel reprend par `nvn:resume`. On ne cherche donc pas à
l'empêcher — **on ne peut pas, et il ne faudrait pas** : le navigateur garde
toujours son bouton, et une page dont on ne peut pas sortir est un piège. La
barre prévient seulement quand une partie tourne.

Ce garde a d'ailleurs été écrit deux fois : la première version lisait une
classe que **personne ne posait**. C'est le troisième mécanisme complet,
correct, et branché sur rien qu'on trouve dans ce dépôt — la famille de la clé
`annonce`.

---

## 4 vicies bis. La barre, les trois écrans, et la carte

### Le kiosque était devenu introuvable

Quand la page des Fanzzy est passée à trois onglets — Mon Fanzzy, Classeur,
Deck — l'onglet KIOSQUE a disparu, et avec lui **le seul chemin visible vers
l'ouverture des boosters**. Il restait le menu accordéon, au milieu de treize
entrées : c'est-à-dire nulle part. Exactement ce qui était arrivé à la boutique,
pour la même raison, deux sessions plus tôt.

Il a maintenant sa tuile sur l'accueil, au rail de gauche, avec la pastille du
nombre qui attend — un sachet non ouvert ne se rappelle à personne.

### La barre du haut

Elle portait cinq choses : la flèche, l'avatar avec le pseudo et le club, deux
jetons de monnaie, le menu. Sur 360 px, elles se disputaient la place — pseudo
tronqué, club réduit à « Lausanne … » — et **aucune ne disait où l'on est**.

Elle porte maintenant : une flèche, le **nom de l'écran**, le menu.

Le pseudo et le club vivent sur le profil, qui est fait pour eux. Les soldes
s'affichent là où ils décident de quelque chose : la boutique, le kiosque, le
carnet. **Le menu est resté** — il n'était pas nommé dans la demande, et le
retirer aurait une conséquence qui dépasse l'apparence : il n'est monté que par
cette barre, donc il disparaîtrait de dix-sept écrans et l'accueil deviendrait
le seul chemin vers quoi que ce soit. C'est peut-être ce qu'il faut faire, mais
c'est une décision de navigation, et elle tient en une ligne le jour venu.

**Deux restes sont partis avec les jetons** : un appel à `/api/me/state` à
chaque chargement de page, uniquement pour remplir des éléments qui n'existaient
plus, et `TBF_BARRE.bourse()` avec ses deux appelants. Les deux étaient protégés
par des `if` : rien ne cassait, et c'est ce qui rend ce genre de reste
dangereux — il ne se signale pas.

### Les trois écrans avaient trois ossatures

| | Fanzzy (avant) | Deck (avant) |
|---|---|---|
| en haut | « FANZZY / collection » | les onglets |
| puis | les onglets | « MON DECK », barre dorée |
| puis | « LE CLASSEUR », autre style | le contenu |

Passer de l'un à l'autre donnait l'impression de changer d'application — ce
qu'on cherchait précisément à éviter en leur donnant la même barre d'onglets.

**L'ordre est désormais le même partout** : onglets, titre d'écran à barre
dorée, contenu. Et « FANZZY / collection » disparaît : la barre du haut le dit
déjà. « Mon Fanzzy » a gagné un titre au passage — sans lui, l'écran commençait
par une carte, et l'on ne savait pas si l'onglet avait répondu.

### La carte en grand ne tenait pas dans l'écran

Le dessin occupait `aspect-ratio: 63/80` pleine largeur, soit près de six cents
pixels de haut. Avec le texte, les chiffres et le bouton, il fallait faire
défiler — **sur l'écran même où l'on vient décider**, et le bouton d'ajout était
en bas.

Le panneau est maintenant une colonne : en-tête fixe, corps qui se réduit. Le
dessin garde la proportion d'une carte mais **plafonnée** en `dvh` : grand quand
il y a la place, replié quand il n'y en a pas. Mesuré : 638 px de panneau sur
780 d'écran, sans défilement, avec 359 px de dessin.

### Un contrôle qui empêchait de réparer

`deck:ui` affirmait « le dessin occupe un cadre au format d'une carte » —
c'est-à-dire `aspect-ratio: 63/80`, **un détail de mise en page et non
l'exigence**. Il rougissait quand on corrigeait le défaut, ce qui est la
meilleure façon d'apprendre à contourner un contrôle.

Il est remplacé par deux, chacun là où il peut se mesurer : sous jsdom, ce que
la feuille **déclare** (une colonne, un plafond en `dvh`, une image en
`contain`) ; dans le tour, en vrai navigateur, ce qui compte — le panneau tient,
il ne défile pas, le bouton reste sous les yeux, et le dessin reste regardable.

**jsdom ne met rien en page.** Une suite qui y tourne ne peut jamais dire si
quelque chose dépasse : elle ne peut parler que d'intentions. C'est pourquoi le
tour existe.

---

## 4 vicies ter. Le kiosque : dix paquets, et rien qu’on ne puisse ouvrir

### Comment les boosters se débloquent

Les neuf séries s’ouvrent au niveau, et **le niveau ouvre, il ne donne pas** —
c’est la règle qui tient tout le jeu. Un joueur de niveau 30 n’a aucun avantage
sur la corde ; il a seulement accès à plus de choses à collectionner.

| Série | Niveau |
|---|---|
| LA TRIBUNE | 1 |
| LES MÉTIERS DU STADE | 3 |
| LE BESTIAIRE DES GRADINS | 6 |
| VIRAGE NORD | 9 |
| NUITS EUROPÉENNES | 12 |
| CE QUI TRAÎNE AU STADE | 15 |
| LES REVENANTS | 18 |
| LES ÉPOQUES | 22 |
| LE VIRAGE IMPOSSIBLE | 26 |

### Ce qui n’allait pas

Le carrousel présentait **les neuf**, dont huit hors de portée pour qui
commence. Pire, la série affichée au premier chargement pouvait elle-même être
verrouillée : bouton gris, « NIVEAU 9 REQUIS », et rien qui dise qu’il suffisait
de glisser. On arrivait au kiosque devant une porte fermée.

### Ce que ça devient

Le carrousel ne porte plus que des paquets **ouvrables**, et il en porte **dix** :
on choisit le sien.

**Le paquet choisi ne change rien au tirage.** Les cartes sont tirées par le
serveur à l’ouverture, et le numéro du paquet ne lui est même pas envoyé. Ce
n’est pas un détail : le jour où ce choix influencerait le contenu, les joueurs
s’en apercevraient en quelques heures, un « paquet qui donne les légendaires »
circulerait, et il faudrait honorer une superstition qu’on aurait fabriquée
soi-même. Le geste est là pour le geste — ouvrir un booster est une cérémonie,
et une cérémonie sans choix n’en est pas une.

La série se choisit sur une rangée de pastilles au-dessus, qui ne liste que
l’ouvert et **disparaît quand il n’y en a qu’une** : un sélecteur à un seul
choix n’est pas un choix. Et ce qui vient se dit en une ligne discrète — « À
venir : LES MÉTIERS DU STADE, au niveau 3 » — à côté du choix au lieu d’être
dedans. Un jeu montre ce qui l’attend ; il ne le met pas sur le chemin.

### Les neuf séries ont enfin leur paquet

`ART` n’en déclarait que **deux** sur neuf. Les sept autres tombaient sur le
repli dessiné — correct, mais c’est un repli. **`LA TRIBUNE` en faisait
partie**, c’est-à-dire le premier paquet que voit tout nouveau joueur.

Sept visuels produits sur Artlist, dans le style des deux existants : sachet
scellé, deux projecteurs croisés, fond noir, bande de couleur de la série. Aux
trois formats du dépôt (avif, webp, jpg) et à la définition des deux premiers —
deux définitions dans un même carrousel se voient.

### Deux défauts trouvés en chemin

**Le révélateur s’affichait en permanence.** Quand le kiosque a quitté la page
des Fanzzy, son balisage est parti — **et sa feuille est restée**. Or la
première règle de `#opener` est `display:none` : sans elle, le panneau de
révélation était rendu nu, sous le kiosque. C’est le « 1 / 5 — Fermer » qui
traînait en bas de l’écran. **Troisième fois** que cette faute se produit dans
ce dépôt : du balisage qu’on déplace, une feuille qu’on oublie.

**`hidden` ne cachait pas.** La rangée des séries s’affichait alors que le code
la cachait : le navigateur implémente `hidden` par `display:none`, mais toute
règle `display` d’une feuille le bat. `.series{display:flex}` suffisait à le
rendre décoratif. Cent trente-trois éléments portent `hidden` ici ; la règle est
donc posée une fois pour tous dans `ui.css`, et c’est l’un des rares endroits
où `!important` se justifie.

### Un contrôle réécrit plutôt qu’effacé

Quatre contrôles éprouvaient une série verrouillée **présentée dans le
carrousel**. Le kiosque n’en présente plus. L’idée qu’ils défendaient reste
entière — « un jeu ne cache pas ce qui vient » — et c’est elle qu’on reprend,
sur sa nouvelle forme : ce qui vient est annoncé à côté du choix. Le filet de
sécurité ne bouge pas : un onglet resté ouvert peut encore demander une série
verrouillée, et le serveur la refuse en nommant sa cause.

---

## 4 vicies quater. Le butin, et quatre appels morts

### Le récapitulatif était traité comme un pied de page

Cinq vignettes de soixante pixels, collées au bas d'un écran aux trois quarts
vide : la scène de révélation restait là, vidée de ses cartes, et gardait six
cents pixels de noir au-dessus. C'est le dernier moment de la cérémonie — celui
qu'on regarde en se demandant ce qu'on a eu.

Il prend maintenant la place : cinq cartes à 116 px, trois en haut, deux
centrées en dessous, qui arrivent **en cascade**. La scène vidée se replie.

**Et il dit ce qui est nouveau** — « 4 NOUVELLES SUR 5 » — l'information que le
joueur cherche en premier et qui n'était écrite nulle part : cinq cartes
rangées, sans savoir lesquelles on avait déjà.

### Les effets, et leur limite

Ils ne durent que l'arrivée. Une fois les cinq cartes posées, **l'écran est
immobile** — c'est la règle du dépôt, héritée du personnage qui respirait pour
rien derrière un onglet caché. Ce qui bouge passe par `transform` et `opacity`,
donc par le compositeur seul.

La lueur ne va qu'aux cartes qui la méritent : une légendaire qui brille au
milieu de quatre communes se voit, cinq cartes qui brillent ensemble ne disent
plus rien.

### Quatre appels morts, et ce qu'ils cassaient

`renderDex()` et `renderTeam()` — les rendus du classeur et de la tribune —
étaient appelés **quatre fois** dans la page des boosters. Ils n'y existent pas :
ils vivaient dans la page des Fanzzy, d'où le kiosque a déménagé.

| Appel | Ce que ça cassait |
|---|---|
| dans le clic du butin | **toucher une carte ne faisait rien** : l'exception tombait avant `ouvrirFiche` |
| en fin de `finishPack` | `tickRegen()` n'était jamais atteint — compte de boosters et compte à rebours figés |
| « Fermer », « Terminer » | levaient après avoir fermé : sans conséquence visible |

Quatre exceptions par ouverture de booster, dans une console que personne ne
lit. C'est le prix des extractions : le code part, **les appels restent**, et
rien ne lève au chargement puisqu'une fonction absente ne se remarque qu'au
moment où on l'appelle. C'est la quatrième fois dans ce dépôt.

Le remplaçant est `renderKiosque()` : il redessine le compte de boosters,
l'état du bouton et le compte à rebours — exactement le travail que les deux
autres faisaient sur leur écran.

### Deux fautes de ma part, vues sur capture

**Mes marges négatives éjectaient deux cartes.** Pour centrer la seconde rangée
j'avais décalé les quatrième et cinquième à la main : elles sortaient du cadre,
et une pastille « NOUVEAU » flottait seule sous la grille, orpheline. La grille
à **six colonnes** fait le travail sans bricolage — c'est la façon classique de
centrer une rangée incomplète.

**« TOUT NOUVELLES DANS LE CLASSEUR »** — un « TOUT » invariable collé devant un
accord au féminin pluriel. Quatre cas, quatre phrases.

### Pourquoi des cartes paraissent vides

Elles ne sont pas cassées : **elles ne sont pas encore dessinées**. Le rendu
procédural — silhouette, projecteurs, gradins — est le repli assumé, et il vaut
mieux qu'un trou.

**198 des 460 cartes sont illustrées**, soit 43 %, et la couverture est
uniforme : 43 % pour `LA TRIBUNE`, 42 % pour `LES MÉTIERS DU STADE`, 34 % pour
`LE BESTIAIRE`. Un joueur qui ouvre un booster voit donc en moyenne deux ou
trois cartes dessinées sur cinq.

262 illustrations restent à produire. C'est une production, pas une correction.

---

## 4 vicies quinquies. Le loading, les mini-jeux, et le duel qui finissait nul

### Dix secondes d'attente, et le bonjour qui se jouait derrière le rideau

L'écran d'ouverture durait le temps d'un chargement. Il dure maintenant dix
secondes pleines — `DUREE = 10_000` dans `public/ouverture.js` — avec une jauge
déterminée qui avance à la frame, et un seul chemin de sortie : `setTimeout`.
Il n'y en avait pas qu'un ; la page pouvait partir plus tôt.

En allongeant le rideau, un défaut plus ancien est devenu visible. L'accueil
saluait le joueur — animation, nom du Fanzzy, jauge d'évolution — **pendant que
l'écran d'ouverture le couvrait encore**. À deux secondes cela ne se voyait pas.
À dix, le joueur arrivait sur une page déjà finie de s'animer.

L'ouverture émet donc `tbf:ouverture-finie` au moment où elle se retire, et
`index.html` attend cet événement pour saluer :

    if (document.getElementById('ouverture')) {
      addEventListener('tbf:ouverture-finie', saluer, { once: true });
    } else { saluer(); }

Le `else` compte autant que le `if` : sans lui, toute page servie sans écran
d'ouverture — une session déjà ouverte, un test — n'aurait plus jamais salué.

Trois contrôles de l'accueil sont tombés au rouge sur les dix secondes. Ils
attendaient des durées écrites en dur. Ils dérivent maintenant leurs attentes de
`DUREE` : changer la durée du rideau ne peut plus les casser.

### Cinq mini-jeux n'arrivaient jamais au Virage

Le jeu compte quinze gestes. Le Virage n'en proposait que dix : son répertoire
comptait douze chants, et les cinq gestes `tifo`, `mosaique`, `memoire`,
`echarpe` et `capo` n'étaient portés par aucun d'eux. Les mini-jeux existaient,
étaient testés, et restaient hors d'atteinte — d'où l'impression qu'il n'y avait
« que les jeux liés au tempo ».

Cinq chants ont été écrits pour les porter, dans `src/shared/duel/chants.js` :

| chant | geste | coût | puissance |
|---|---|---|---|
| La bâche | tifo | 30 | 54 |
| Le damier | mosaique | 28 | 50 |
| Au point | memoire | 26 | 47 |
| Le moulinet | echarpe | 25 | 42 |
| L'appel du capo | capo | 29 | 49 |

`ORDRE` les intercale au lieu de les ajouter à la queue : un joueur qui débloque
le répertoire dans l'ordre rencontre un geste neuf régulièrement, et non cinq
d'un coup à la fin.

`virage-smoke.mjs` vérifie désormais que **les quinze gestes passent tous au
Virage**. La liste attendue y est écrite à la main, dix-sept chants et quinze
gestes : la dériver du module rendrait le contrôle d'accord avec lui-même quoi
qu'il arrive.

Les cinq illustrations ont été produites et rangées en trois formats par
`node scripts/chant-images.mjs` — dix-sept chants dessinés, et `npm run pages`
le dit.

### Le duel finissait toujours par un nul

Contre un bot, un duel de cinq minutes ne produisait aucun but. Ce n'était pas
une impression : un chant de tempo demande quatre secondes et demie et valait
27 points, la corde retombait de 2,5 par seconde, et le but était à 300. Un
joueur appliqué poussait donc moins vite que la corde ne retombait.

Les réglages ont bougé, et ils vivent tous dans le registre — donc dans l'écran
d'administration :

| réglage | avant | après |
|---|---|---|
| `duel.but_a` | 300 | 200 |
| `duel.chant_puissance` | 30 | 44 |
| `duel.decroissance` | 2,5 (en dur) | 1,2 |
| `virage.but_a` | 400 | 260 |
| `virage.decroissance` | 3 | 1,4 |

`duel.decroissance` n'existait pas : la valeur était une constante de module.
Elle est devenue un accesseur — `get decayPerSec() { return reglage(...) }` —
ce qui la rend vivante sans toucher un seul appelant. J'ai vérifié d'abord que
personne ne la déstructurait au chargement, faute de quoi la valeur aurait été
figée à la première lecture.

Le bot a été affaibli : il chante toutes les six à onze secondes au lieu de deux
et demie à cinq et demie, avec une adresse de 0,30 à 0,55.

**Le contrôle qui manquait.** Vingt-six contrôles éprouvaient le duel — le
souffle se débite, un geste raté ne pousse pas, un bouclier absorbe — et aucun
ne vérifiait qu'**une partie produise un but**. Tous étaient verts pendant que
le jeu ne se jouait plus.

Ma première version de ce contrôle jouait en solo, et elle ne mordait pas :
même avec l'ancien équilibrage, un joueur que personne ne contre finit par
marquer. Le défaut n'existe qu'**avec quelqu'un en face**. Réécrit à deux, il
donne 3 buts avec le nouvel équilibrage et **0 avec l'ancien**.

### La légendaire qui ne tombait jamais

Trouvé en repassant la batterie, et non dans ce qui était demandé.

`scripts/economie.mjs` a refusé de tourner : son garde-fou a vu que les
constantes du serveur avaient bougé sous lui, et il a préféré s'arrêter plutôt
que publier des chiffres périmés. C'est exactement ce pour quoi il avait été
écrit.

En le remettant au niveau, la règle réelle des places dit ceci :

- `drawPack` tirait cinq cartes : les trois premières communes, **les deux
  dernières avec un tirage de rareté** — et `RATES` le documente encore, « les
  deux dernières places sont les seules qui peuvent tomber sur une légendaire ».
- `openPack` a ensuite fait des **trois dernières places** des places ouvertes,
  qui rendent un objet, une tenue, une carte d'action ou des écharpes, et jamais
  un supporter. `tirerAutreChose` ne peut pas échouer : chaque catégorie sans
  stock retombe sur les écharpes.

Les deux règles sont justes chacune de son côté. Ensemble, elles font que le
tirage de rareté roule sur des cartes **systématiquement jetées** : les deux
seules places que le joueur reçoive visaient la commune. **Aucune légendaire ne
pouvait sortir d'un booster**, et les quatorze légendaires publiées au stade 1
étaient hors d'atteinte — le paquet de bienvenue mis à part.

Rien ne pouvait le voir : les deux fonctions vivent à cent lignes d'écart, et
chacune était cohérente. Le simulateur le voit parce qu'il a appris à **mesurer
ce qu'un booster rend** au lieu de le supposer — cent mille paquets ouverts à
blanc, et la liste des raretés qui en sortent. Une rareté absente arrête le
script avant les deux mille collections simulées, au lieu de tourner jusqu'au
plafond pour diviser par zéro.

Le tirage de rareté va désormais aux deux places que le joueur reçoit
(`PLACES_QUI_ROULENT = 2` dans `drawPack`). La cadence attendue passe de 0,20
légendaire par booster — l'intention écrite, jamais atteinte — à 0,155, la
deuxième place ne rendant un supporter que sept fois sur dix. Les taux eux-mêmes
n'ont pas été touchés.

Deux mutations pour éprouver le nouveau contrôle : `PLACES_QUI_ROULENT = 0`, et
une table `RATES` où la légendaire vaut zéro — celle-ci ne passe par aucun
motif de texte. Les deux mordent.

Le simulateur perd son option `--plancher` : elle explorait un plancher de
communes que le serveur n'a plus.

### Ce qui reste en écart entre le Virage et le duel

Les deux modes partagent maintenant le même répertoire, les mêmes quinze gestes
et le même barème. Il reste **une** différence, et elle est de fond :

- **En duel**, le geste est *imposé* : une rotation le choisit, et le joueur
  l'exécute.
- **Au Virage**, le joueur *choisit une carte de chant*, et le geste découle de
  la carte.

Ce n'est pas un oubli de câblage : ce sont deux boucles de jeu différentes, l'une
d'adresse pure, l'autre de main et de gestion. Les aligner est un choix de
conception, pas une correction — et il n'a pas été fait ici. Les deux voies
possibles :

1. **Le Virage prend la rotation du duel.** Les cartes de chant disparaissent,
   le deck ne sert plus au Virage. Simple pour le joueur, mais le deck perd la
   moitié de son objet.
2. **Le duel prend la main du Virage.** On y joue ses cartes de chant au lieu de
   subir la rotation. Le deck sert partout, la progression a un sens dans les
   deux modes — mais le duel devient plus lent à comprendre.

La deuxième va dans le sens du reste du jeu. Elle demande une session à elle
seule.

---

## 4 vicies sexies. La plaque, et quatre productions

### L'interface avait raison et n'avait pas de matière

Tout était juste et tout était plat : un rectangle à filet d'un pixel posé sur
une photo, la même chose pour un bouton, un panneau, un onglet et une carte.
Rien n'avait de **matière**, donc rien n'avait de poids — on ne distinguait pas
d'un coup d'œil ce qui se touche de ce qui s'affiche.

`ui.css` porte maintenant **la plaque**, le vocabulaire d'objet de tout ce qui
se touche. Quatre traits la fabriquent, et ce sont ceux de Brawl Stars ou de
Clash Royale :

1. **le cerne** — deux pixels presque noirs tout autour. C'est ce qui fait
   « jeu » plus que tout le reste : un objet détouré se *pose* sur l'image au
   lieu d'y être découpé ;
2. **la tranche** — cinq pixels plus sombres dessous, donc une épaisseur ;
3. **la lumière** — un filet clair au bord supérieur, dedans ;
4. **l'ombre portée** — l'objet décolle du fond.

Ce qui appartient à ce jeu-ci et non aux autres :

— **le lettrage de banderole** : `--banner` en capitales espacées, avec une
  ombre dure, pour que le texte soit peint *sur* la plaque ;
— **l'écharpe** : des rayures obliques à deux couleurs, le seul motif du jeu.
  Elle a remplacé la barre d'accent dorée des titres — une règle, et les vingt
  écrans la portent ;
— **le coin coupé** : le bas-droit presque carré quand les trois autres sont
  ronds. Une plaque vissée, pas un galet ;
— **la couleur par destination** : `data-ton` vaut or, flare, vert, bleu,
  violet ou craie. Sur l'accueil, **un ton par ligne de tuiles** — rouge pour
  les deux façons de jouer, bleu pour ce qu'on possède et ce qui se passe, vert
  pour la mémoire et le rang, violet pour les gens, or pour ce qui s'achète. La
  couleur devient une catégorie et non une décoration.

Les briques : `.tbf-plaque` (bouton), `.tbf-case` (tuile carrée),
`.tbf-onglets`/`.tbf-onglet` (barre d'onglets), `.tbf-cadre` (le panneau qui
compte), `.tbf-etiquette` (une valeur, qui ne se touche pas), `.tbf-echarpe`.

**`.pan` reste ce qu'il est.** Un écran entièrement en relief est un écran sans
hiérarchie — c'est le défaut exact des interfaces « gaming » ratées. Le relief
va à ce qui se touche et au panneau principal ; les dizaines de surfaces calmes
gardent leur filet d'un pixel.

### Sept barres d'onglets, sept réglages

`gap` valait 5, 6, 7 ou 8 ; le corps du texte 11, 11.5, 12.5, 13 ou 13.5 ;
l'onglet actif était tantôt une plaque claire, tantôt un fond translucide.
Personne ne pouvait le voir, puisqu'on ne regarde jamais deux écrans à la fois —
et c'est exactement pour ça que ça dérive.

Les sept sont ramenées sur `.tbf-onglets`. Les anciens noms de classe restent
dans le balisage, parce que le JavaScript de ces pages les interroge : ce qui
part, ce sont les règles qui les peignaient.

### Deux défauts qu'aucun contrôle ne pouvait voir, et leurs contrôles

**Une plaque peinte en rien.** Toutes ses couleurs viennent de cinq variables.
La table des tons commençait par `[data-ton]{…}`, qui ne s'applique qu'aux
éléments **portant** l'attribut : une plaque sans ton n'avait donc ni face, ni
cerne, ni encre, ses règles devenaient invalides une par une, et l'objet se
rendait transparent. Le bouton de menu de l'accueil a disparu comme ça —
présent, cliquable, mesuré comme visible, et invisible à l'œil.

**Un bouton resté au style du navigateur.** Le pendant exact, par le chemin
inverse : la règle qui l'habillait s'en va, et le bouton ne devient pas
invisible, il redevient un bouton système. Gris clair, bordure en relief,
parfaitement à sa place et étranger au jeu. C'est arrivé aux deux onglets du
deck, écrits par le JavaScript dans un gabarit de chaîne — mon remplacement de
balisage ne les a pas vus.

Le tour éprouve maintenant les deux, en lisant ce que le navigateur a **résolu**
et non ce que la feuille déclare. Le second a trouvé un troisième cas dans la
minute qui a suivi son écriture : deux onglets de `fanzzy.html` sont des
`<button>` et non des `<a>`.

`CAPTURE=1 npm run tour:ui` lève désormais le rideau d'ouverture avant de
photographier — sans quoi la capture de l'accueil montrait l'écran de
chargement pendant dix secondes.

---

### Cinq légendaires par série, partout

Il y en avait quatorze pour neuf séries : cinq aux REVENANTS, trois aux ÉPOQUES,
deux ailleurs, et **zéro** à VIRAGE NORD, au VIRAGE IMPOSSIBLE et à CE QUI
TRAÎNE AU STADE. Un joueur qui collectionnait ces trois-là ouvrait des boosters
sans sommet.

Trente et une nouvelles dans `src/shared/fanzzy/dex-legendes.js` — un fichier à
part, parce qu'une légendaire se lit **avec les huit autres** : c'est le point le
plus haut d'une série, et les neuf points hauts doivent se tenir. Éparpillées
dans deux mille lignes, personne ne pouvait les comparer, et c'est comme ça
qu'on se retrouve avec cinq d'un côté et zéro de l'autre.

Toutes ont un défaut, aucune n'a de lignée, leur puissance de cri va de 76 à 84,
et elles prennent en charge les gestes que presque personne ne portait au
catalogue : c'est la carte qu'on regarde, donc celle par qui on découvre qu'un
geste existe.

Conséquence à connaître : la collection complète passe de **373 à 695 boosters**
médians. Les quarante-cinq légendaires sont la queue de la courbe, et les dix
derniers pour cent coûtent désormais plus de la moitié du total. `npm run
economie` le recalcule à la demande.

**Trouvé au passage** : l'administration ne connaissait que **trois gestes sur
quinze**. La liste était écrite à la main et datait du jour où le jeu n'en avait
que trois ; douze sont arrivés depuis sans que personne ne repasse par là.
L'écran refusait donc d'enregistrer une carte dont le cri portait l'un des douze
autres — la carte était juste, le jeu la jouait, seul cet écran disait non. La
liste est maintenant importée de `ferveur/gestures.js`.

### Dix-sept pièces d'équipement

Sept pièces pour deux emplacements, c'était vingt et une combinaisons dont la
moitié sans intérêt ; en pratique tout le monde finissait sur mégaphone +
thermos, et le sac cessait d'être une décision. Dix de plus en font cent
trente-six.

Gants coupés, sifflet à roulette, carnet de chants, bonnet de virage, brassard
de capo, drapeau à deux mains, sac de cartons, cornet de brume, chronomètre de
poche, fanion de 1904. **Aucune n'a que des bonus** — la règle du module tient,
et elles ont été écrites en pensant au revers d'abord.

Les dix sont dessinées. La chaîne `stuff-images` **recadre désormais sur l'objet
détouré avant de réduire** : le générateur a rendu ces dix-là en seize-neuvièmes
au lieu du carré demandé, et sans ce recadrage elles seraient sorties au quart
de la vignette, entourées de vide, sans que rien ne le dise.

### Dix stades — et le stade n'existait nulle part

Cinq stades pour dix. Le Toit de Tôle, Le Bord de Mer, Le Stade Vide, La Neige,
Le Terrain Annexe. Dessinés, mesurés, leurs plans écrits.

Mais surtout : **le duel n'avait aucun stade, et les effets des stades
n'étaient appliqués nulle part.**

`stades.js` explique en tête que le lieu appartient au match et qu'« en duel, il
est tiré parmi ceux que les deux joueurs possèdent ». C'était écrit, documenté,
et `stadeDeLaRencontre` n'était appelée que par le Virage. Le duel se jouait
sur un fond noir uni pendant que le Virage montrait son lieu.

Et les `mods` de ces lieux — « le souffle revient bien plus lentement », « un
geste parfait paie double » — n'étaient composés avec rien : le Virage envoyait
son stade au client pour qu'il le dessine, et c'était tout. Dix lieux décrits,
zéro lieu qui changeait quoi que ce soit.

Les deux modes partagent maintenant `avecLieu()`, et le duel affiche son stade
sous la corde avec le nom du lieu et sa phrase d'effet — un stade qui change les
règles sans le dire donne l'impression que le jeu triche.

Un piège évité en chemin : `stadeDeLaRencontre` attend une graine **numérique**.
L'identifiant d'un duel est une chaîne, `Number('d-7f3a')` vaut `NaN`, et la
fonction retombe sur zéro — donc sur le premier stade, pour tous les duels du
jeu. Le lieu aurait existé sans jamais changer, ce qui est la façon la plus
discrète de ne pas exister. D'où `hachage()`.

Les invites des stades n'existaient nulle part, contrairement à la règle que le
projet s'est donnée pour les deux autres chaînes. Les dix sont maintenant dans
`scripts/stade-images.mjs --invites`.

### Vingt-neuf cartes d'action, et sept mini-jeux

**Cinq cartes, cinq mécaniques neuves.** Les vingt-quatre cartes d'origine se
partageaient vingt et un types d'effet : en ajouter cinq qui recombinent les
mêmes verbes aurait donné cinq cartes qu'on reconnaît en une partie et qu'on
cesse de lire à la deuxième. Chacune a donc sa branche dans le moteur, et
chacune touche à une chose que rien ne touchait :

| carte | ce qu'elle fait, et que rien d'autre ne faisait |
|---|---|
| **L'Ancre** | la corde cesse de retomber, 8 s, pour les deux camps |
| **La Mise** | le prochain chant compte double ; raté, il coûte 20 de souffle |
| **La Tournée** | les deux prochaines cartes ne coûtent **rien** — on joue ce qu'on n'a pas les moyens de jouer |
| **Le Long Chant** | pousse un peu, dix fois, sur dix secondes — passe sous la Bâche, se fait manger par la décroissance |
| **Le Retournement** | efface la moitié de l'avance adverse, et seulement si l'on est mené |

Le Retournement est marqué `adverse` dans `PORTEE`, donc il ne va pas au
Virage. Il ne touche pourtant personne — il divise un écart. Mais dans une salle
de trois cents, cet écart est le travail de la tribune d'en face : **la portée
ne se lit pas à la cible technique de l'effet, elle se lit à qui le subit.**

**Deux mini-jeux, et ils mesurent autre chose.** Les cinq épreuves existantes
demandent toutes la même chose sous des habits différents — reproduire ce qu'on
vient de voir. Une seule qualité de joueur, mesurée cinq fois.

— **Le tri** : vingt-quatre cartons de trois couleurs, on ramasse une couleur,
  six secondes. Rien n'est caché, rien ne s'éteint. Un mauvais carton **coûte un
  bon**, sans demi-mesure : c'est la seule note du répertoire où s'arrêter quand
  on n'est plus sûr est un choix qui se défend. Aucun équipement ne l'aide, et
  c'est voulu.
— **Le compte** : le rebours s'affiche trois secondes puis s'éteint, et il faut
  tomber juste quand même. Le seul endroit du jeu où il n'y a rien à regarder au
  moment d'agir. La cible change à chaque fois, sinon on l'apprendrait une fois
  pour toutes.

`epreuves:ui` les joue toutes les sept dans un vrai navigateur. Les deux
contrôles qui portent : tout ramasser sans regarder vaut **0,00**, et tomber à
deux tolérances de la cible vaut **0,00** — sans eux, une note constante
passerait au vert.

### Un contrôle qui épinglait un nombre

`virage-smoke` affirmait `duel.size === 7` : le nombre de cartes qui ne vont pas
au Virage. Un nombre ne dit rien de ce qu'il compte — il rougit dès qu'on ajoute
une carte, quelle qu'elle soit, et il se répare en écrivant 8, ce qui ne vérifie
plus rien. Il nomme maintenant les huit cartes, et ajouter une carte qui vise
l'adversaire oblige à venir l'écrire là, donc à se demander si elle a sa place au
Virage. C'est la question que ce contrôle existe pour poser.

---

### L'onglet qui n'en était pas un, et les 262 dessins retrouvés

Deux défauts vus sur capture, tous deux instructifs.

**Le troisième onglet de la page des Fanzzy était un lien nu.** Il portait
`class="go"` quand les deux autres n'avaient pas de classe : le remplacement
qui a posé `.tbf-onglet` ne l'a pas reconnu, et aucune règle ne visait `.go`
dans cette page. Résultat : « DECK » en bleu de navigateur, hors de la barre,
posé à côté d'elle.

Le contrôle « aucun bouton n'est resté au style du navigateur » ne pouvait pas
le voir — il ne regarde que les `<button>`, et un `<a>` sans style n'est ni gris
ni en relief. Il y a donc maintenant un contrôle **structurel** : *chaque enfant
d'un rail d'onglets est un onglet*. Il ne juge pas une couleur, il vérifie que
les deux moitiés d'une même brique sont bien ensemble.

En chemin, deux autres choses :

— `.tbf-onglet` était un conteneur flex, et son étiquette est un **texte nu**
  posé à côté d'une icône. Un texte nu dans un conteneur flex devient un élément
  anonyme qui **ne sait pas rétrécir**, et `text-overflow:ellipsis` n'agit
  jamais sur un conteneur flex : trois onglets qui refusent de céder débordent
  leur rail. Il est en bloc maintenant, l'icône en `inline-block`.
— Sur un écran étroit, **l'icône part avant l'étiquette** — un pictogramme qu'on
  reconnaît ne vaut pas un mot qu'on lit. Le seuil est à 400 px parce qu'un
  téléphone ordinaire fait 360, et que « MON FANZZY » n'y passait plus.

Trois pages avaient recopié la règle de l'onglet pour leurs boutons nus, et ces
copies portaient le défaut de l'original. Leurs dix boutons prennent la classe
comme tout le monde ; les trois copies s'en vont.

**Et le dessin manquant.** Le Fanzzy équipé s'affichait en silhouette
géométrique. Ce n'était pas une image cassée : c'était `MS9C`, le troisième âge
de `MS9` — et **`MS9` est dessiné**.

Les identifiants d'une lignée s'écrivent `MS9`, `MS9B`, `MS9C`. **Deux cent
soixante-deux cartes du catalogue sont des âges supérieurs de personnages déjà
dessinés** — c'est exactement le reliquat annoncé depuis des sessions comme « 262
illustrations à produire ». Il n'y avait rien à produire : il manquait un repli.

`FZART.adresse` descend maintenant sur la racine de la lignée quand l'âge n'a
pas son propre dessin. Le rendu procédural reste ce qu'il a toujours été — le
repli du **personnage inconnu** — et cesse d'être celui d'un personnage connu
qu'on n'a pas encore redessiné plus vieux. Rien ne ment au joueur : la carte
affiche son étage à côté du dessin. Le jour où un troisième âge est dessiné, il
prend la place sans qu'on touche à la fonction.

L'administration suit la même résolution : elle listait deux cent soixante-deux
tirets là où le joueur, lui, voit un personnage.

`images:test` mesure désormais **combien de cartes du catalogue réel obtiennent
une adresse** : 198 dessinées en propre, 262 par leur premier âge, **31 sans
rien**. Ces trente et une sont les légendaires écrites cette session : ce sont
les seules cartes du jeu encore en rendu procédural, et il leur faut une vraie
production d'illustrations.

---

### Le compteur qui prenait toute la ligne

Dans le catalogue du deck, le petit « ×1 » s'étirait sur toute la largeur et le
texte des cartes tombait à un mot par ligne.

**J'avais nommé le nouveau mini-jeu `.compte` dans `ui.css`.** Le deck avait
déjà un `.compte` — son compteur d'exemplaires. La feuille commune est chargée
**avant** le style de la page : la page gagnait donc sur les propriétés qu'elles
partageaient, mais `width:100%` et `height:100%` n'existaient que dans la
commune et s'appliquaient sans opposition. Rien n'était en erreur nulle part.

C'est exactement la règle que `ui.css` énonce en tête depuis toujours — « sans
ce préfixe, `.voile` de deck.html et `.pastille` de fanzzy-fiche.html seraient
réécrits par des règles qu'ils n'ont pas demandées ». Elle n'était vérifiée par
personne.

`npm run pages` la vérifie maintenant. Le contrôle ne regarde pas quelles
classes un sélecteur mentionne, mais **sur quel élément les propriétés
atterrissent** — le dernier composé — et s'il est tenu par un ancêtre de la
commune. `.tbf-tiroir .pip` ne peut atteindre que ce que la commune a elle-même
posé ; `.compte` tout seul atteint n'importe quel `.compte` de n'importe quelle
page. Sa première version signalait huit règles saines : elle lisait toutes les
classes au lieu du seul sujet.

### Un nouveau joueur sur quatre recevait une carte qui n'existe pas

Trouvé en répondant à la question « le joueur a-t-il un deck de base ? ».

`inventaire.js` portait une liste de quatre cartes d'action, présentée comme
« les cartes du paquet de bienvenue ». C'était une **seconde vérité** : le vrai
catalogue vit dans `duel/actions.js`, et les deux avaient divergé. `a-relance`
— « Seconde jeunesse » — y figurait quand la carte du jeu s'appelle
`a-secondsouffle`.

Le paquet de bienvenue tirait au hasard dans ces quatre-là. **Une inscription
sur quatre offrait donc une carte inexistante** : écrite dans la bourse du
joueur, absente de tout catalogue, et refusée par son propre deck en « carte
inconnue » — pour une carte qu'on venait de lui donner.

La liste en double est supprimée. L'accueil des nouveaux importe le catalogue,
comme tout le reste du jeu, et tire parmi les cartes commune et rare — sans quoi
on offrirait une légendaire à l'inscription, ce que rien n'a jamais voulu.

**La suite qui aurait dû le voir n'était lancée par personne.** Elle existait
(`scripts/onboarding-smoke.mjs`), elle vérifiait « une carte d'action » — le
**compte**, jamais l'existence. Elle est maintenant dans la batterie sous
`npm run bienvenue:smoke`, et elle demande que la carte existe et qu'elle soit
une carte de début.

En l'y mettant, elle est sortie rouge sur autre chose : elle épinglait
`r.json.stuff.length === 7`, juste sous un commentaire qui explique pourquoi le
compte des tenues, lui, ne s'écrit plus en dur. Elle avait rougi le jour où dix
pièces d'équipement sont arrivées, et personne ne l'avait su.

### Ce que reçoit un nouveau joueur, et la règle des exemplaires

Pour mémoire, parce que la question revient :

**Il n'y a pas de deck de base.** Le deck est vide à l'inscription, et le joueur
le construit. Ce qu'il reçoit, c'est un paquet de bienvenue —
`tirerBienvenue()` — et une réserve :

| à l'inscription | |
|---|---|
| Fanzzy | 2 (un commun, un rare ou épique) |
| équipement | 1 (commune ou rare) |
| carte d'action | **1** (commune ou rare) |
| écharpes | 80 à 120 |
| boosters en réserve | 3, puis 1 toutes les 10 min jusqu'à 12 |

**Une carte d'action ne se possède qu'une fois.** `possede.actions` est un
ensemble d'identifiants : on l'a ou on ne l'a pas. Un doublon tiré d'un booster
rend des écharpes, jamais un second exemplaire.

**Et pourtant le deck en accepte dix du même.** `DECK_RULES.copiesMax` vaut
`null` — aucun plafond — et c'est délibéré : un deck demande exactement dix
cartes d'action, un débutant en possède une poignée, et remplir dix emplacements
sans doublon serait arithmétiquement impossible. Les dix exemplaires sont **le
même droit répété**, pas dix cartes gagnées.

La conséquence à garder en tête : avec **une seule** carte d'action à
l'inscription, le premier deck légal est dix fois la même carte. C'est jouable
et ce n'est pas satisfaisant — la question « combien de cartes d'action offrir
au départ » reste ouverte, et se règle en une ligne dans `tirerBienvenue()`.

---

## 4 vicies septies. L'affiche, le bilan, et cinq cartes pour commencer

### Un duel commençait et se terminait sans rien dire

Il commençait sur une corde qui apparaît : on ne savait ni contre qui on jouait,
ni avec quoi, ni où. Il se terminait sur un voile gris avec un mot dessus —
moins qu'un message d'erreur pour cinq minutes de jeu.

Tout ce que montrent les deux nouveaux écrans était **déjà connu du serveur** à
ces deux instants. Rien n'en sortait.

**L'affiche**, sur `nvn:affiche`, juste après le départ :

— les deux camps, le sien toujours en premier — « en haut » veut dire « moi »
  sur les deux écrans du jeu ;
— **les trois Fanzzy de chacun**, pas seulement celui qui entre : c'est en
  voyant les trois qu'on comprend qu'on peut changer. Celui qui entre porte la
  couleur de son camp et sa marque ;
— la **forme récente** de chaque joueur : cinq pastilles, la plus récente à
  gauche, avec le décompte. Un joueur sans passé le dit — « premier duel » est
  une information, une absence n'en est pas une ;
— le lieu et ce qu'il change.

Elle se retire seule au bout de six secondes. C'est une affiche, pas une salle
d'attente : un joueur qui doit toucher un bouton pour entrer dans un duel déjà
commencé perd les secondes qu'il regarde.

**Le bilan**, sur `nvn:fin`, au coup de sifflet : le résultat, le score, ce que
le duel a rapporté — écharpes, XP, part versée au KOP — la carte préférée avec
son dessin, puis les chiffres du match **les deux camps côte à côte**, parce que
c'est la comparaison qui intéresse et non le chiffre isolé : chants, cartes
jouées, changements, relèves, ferveur, et qui a poussé.

L'ancien voile reste en repli, pour le cas où le bilan n'arrive pas — une
connexion coupée au dernier instant vaut mieux qu'un écran de jeu figé dont on
ne sort pas.

### Ce qu'il a fallu ajouter pour qu'il y ait quelque chose à dire

**Le moteur ne comptait rien.** Trois compteurs et une liste par joueur —
cartes jouées et leur tally, remplacements, relèves, Fanzzy réellement montés.
Ils ne coûtent rien pendant la partie, et `bilan()` ne fait que les mettre en
forme, une fois, à la fermeture.

La relève est comptée **à part** du remplacement : l'une fait grandir celui qui
est déjà en tribune, l'autre en fait entrer un autre. Les mêler donnerait un
chiffre qui ne veut rien dire.

**`recompenser` versait en silence.** Écharpes, XP et part de KOP partaient
sans que rien ne le dise : le joueur voyait son solde changer entre deux écrans.
Elle rend maintenant ce qu'elle a versé.

**Les matchs nuls n'étaient nulle part.** Seuls les duels classés **avec un
vainqueur** s'écrivaient dans `duel_results`. La table accepte pourtant `draw`
depuis le premier jour : « tes cinq derniers duels » aurait menti par omission,
en oubliant exactement les parties les plus serrées.

### Cinq cartes d'action à l'inscription, dont l'Arbitre

Il y en avait **une**. Un deck demande exactement dix cartes et n'impose aucun
plafond par carte : le premier deck légal d'un nouveau joueur était donc dix
fois la même — jouable, et sans aucune décision à prendre.

L'Arbitre est **garanti**, pas tiré. C'est la carte qui ouvre le changement :
sans elle, le second Fanzzy du paquet de bienvenue reste sur le banc pendant
tout le duel et le joueur ne découvre jamais qu'une tribune se relaie. Une
mécanique entière dépendait d'un tirage à une chance sur dix-sept.

Les quatre autres sont tirées **sans remise** parmi les cartes de début : avec
remise, on retomberait parfois sur quatre Fumigènes, c'est-à-dire sur le
problème qu'on vient de corriger.

### Deux collisions de noms, la même leçon

`.compte` venait d'être corrigée entre `ui.css` et le deck. L'affiche en a
produit une seconde, **à l'intérieur d'une même page** cette fois : mes
`.camp-bloc .qui .cote` contre le `.cote` du duel, qui positionne les deux
territoires de l'arène en `position:absolute; width:50%`. Ma règle réglait la
police et le fond, jamais la position : les deux petites étiquettes « TOI » et
« EN FACE » sont devenues deux blocs de couleur en travers de l'écran.

Le contrôle posé la veille ne pouvait pas la voir — il compare `ui.css` aux
pages, pas une page à elle-même. Celle-ci a été trouvée **en regardant la
capture**, ce qui reste le seul moyen pour une classe de nom courant dans un
fichier de mille lignes.

### La suite du duel éprouvait une table absente

`nvn-ui-smoke` ne chargeait pas `duel.sql`. `duel_results` n'existait donc pas,
la forme récente échouait en silence — elle est écrite pour ça — et l'affiche
disait « premier duel » à tout le monde. Le contrôle serait passé au vert sur
une requête cassée.

Six résultats sont maintenant semés pour l'un des deux joueurs, et la suite
vérifie que l'affiche **n'en montre que cinq**, dans le bon ordre : la plus
récente d'abord, parce que celui qui a perdu ses quatre premiers et gagné le
dernier ne raconte pas la même chose que l'inverse.

**À savoir** : `reglages:smoke` sort parfois en code non nul après avoir écrit
« tout est vert ». C'est une assertion libuv au démontage, propre à Windows
(`UV_HANDLE_CLOSING`), et non un contrôle qui échoue. Trois passages d'affilée
sortent à zéro.

---

## 4 vicies octies. Le duel se joue comme le Virage

### La dernière différence est tombée

Elle était demandée depuis longtemps — « il faut que le VIRAGE et les DUEL se
déroulent selon le même processus » — et elle a été reportée deux fois. La
voici traitée.

Le duel **imposait** le geste : une rotation du serveur, le sien un chant sur
deux, les seize autres à tour de rôle. Tous les chants coûtaient dix-huit pour
pousser quarante-quatre : appuyer sur le bouton était le seul geste, et il n'y
avait rien à décider.

Le duel reçoit le **répertoire du Virage** : cinq chants parmi dix-neuf, chacun
avec son coût et sa poussée. Les deux écrans se jouent désormais avec le même
geste de la main, et le duel y gagne une décision qu'il n'avait pas — un gros
chant coûte plus de souffle et rend plus.

`chanter(userId, { cardId, taps })` au lieu de `chanter(userId, { taps })`. Le
coût, la poussée et le geste viennent de la carte. Le bot choisit dans le
répertoire comme un joueur — il envoyait `geste: 'tempo'`, un champ que le
moteur n'a jamais lu.

**Le répertoire d'un duel est fixe** pendant les cinq minutes : celui du Virage
tourne toutes les dix minutes de match réel, ce qui n'a pas de sens sur une
partie plus courte que ça. Il est tiré de l'identifiant du duel — les deux
joueurs ont les mêmes cinq chants, et deux duels n'ont pas les mêmes. C'est ce
qui remplace la rotation : on rencontre les dix-sept gestes en jouant plusieurs
parties, au lieu de les voir tous défiler dans une seule.

**Une correction à ce qui avait été écrit ici :** j'avais noté qu'unifier ferait
« perdre au deck la moitié de son objet ». C'était faux, et c'est ce qui avait
servi à repousser. Les chants du Virage ne viennent pas du deck — ce sont cinq
chants globaux, les mêmes pour toute la tribune. Le deck, c'est trois Fanzzy et
dix cartes d'action, dans les deux modes. Unifier ne lui retire rien.

### La corde était figée à l'écran

Trouvé en cherchant pourquoi la suite du duel était instable.

`diffuser` commençait par `if (!evenements?.length) return;` : entre deux
actions, **plus rien ne partait au client**. Or il se passe quelque chose en
permanence — la corde retombe de 1,2 point par seconde, l'horloge tourne, le
souffle revient. Le joueur voyait donc une corde immobile jusqu'à ce que
quelqu'un chante, puis un saut.

La décroissance est la tension du jeu : on ne pouvait pas voir qu'on perdait son
avance sans rien faire. L'état part maintenant à chaque battement — deux fois
par seconde. Les **événements**, eux, restent conditionnels : un tableau vide dix
fois par seconde n'apprend rien à personne.

### « EN FACDUEL »

La barre commune écrit le nom de l'écran entre ses deux boutons. Sur un écran de
jeu, la page a déjà son propre en-tête au même endroit — le score et l'horloge
du duel — et les deux se superposaient. Le titre est retiré sur les barres de
jeu, et là seulement.

### Les familles disent enfin ce qu'elles font

`geste` (un mot) est devenu `gestes` (une liste), et cette liste **est** la
règle : un personnage ne peut porter que l'un des gestes de sa famille.

| famille | son geste | ses variantes |
|---|---|---|
| Voix | tempo | contretemps, écho, capo |
| Percussion | martelage | crescendo, salves |
| Fidélité | endurance | sang-froid, mesure |
| Tifo | tifo | mosaïque, tri |
| Pyro | relance | compte |
| Déplacement | écharpe | mémoire |

Les dix-sept gestes y sont répartis sans trou ni doublon. Quatre-vingt-dix
personnages de stade 1 ont changé de cri ; les cent vingt-cinq qui étaient déjà
justes gardent le leur, et les âges suivent — `agesDe` reprend le geste du
premier âge.

**Six âges écrits à la main** — les lignées T, Y et D, antérieures à
`dex-ages.js` — dérivaient de leur propre personnage : un joueur qui faisait
grandir son Fanzzy perdait le geste qu'il avait appris.

Nouvelle suite `npm run catalogue:test` : treize contrôles de **cohérence**,
pas de fonctionnement. Chacun correspond à une phrase écrite quelque part dans
le projet et vérifie que le contenu la tient encore — cinq légendaires par
série, un revers par pièce d'équipement, un effet que le moteur sait résoudre
par carte d'action, une règle par stade.

### Deux mini-jeux injouables au Virage, pour la deuxième fois

`tri` et `compte` avaient été ajoutés au moteur et au duel **sans leur écrire
de chant**. Le Virage ne propose que les gestes portés par un chant de son
répertoire : ils y étaient donc injouables, exactement comme les cinq épreuves
l'avaient été.

Un geste vit dans deux listes qui ne se parlent pas : `GESTES`, où il se
déclare — et le duel le rend jouable automatiquement — et `ORDRE`, le répertoire
des chants. Le contrôle censé le voir portait une liste de quinze gestes écrite
à la main : restée vraie sur elle-même et fausse sur le jeu.

Les deux listes écrites à la main de `virage-smoke` sont maintenant
**confrontées** à celles du jeu. Elles restent à la main — ajouter un chant doit
obliger à dire où il se place dans la rotation — mais elles rougissent quand
elles ont divergé, ce qui est la seule façon pour qu'une décision consciente
reste consciente.

---

## 4 vicies novies. Les variantes comptent, et le dossier se génère

### Une famille annonçait quatre gestes et n'en jouait qu'un

Les familles disaient vrai depuis la session précédente, mais seulement à moitié.
La Voix comptait **vingt-neuf tempo pour un contretemps et un écho** : les deux
variantes existaient au catalogue et pas dans le jeu. Un joueur qui voulait un
Fanzzy spécialisé en contretemps avait une carte sur trente-cinq à trouver.

La règle de répartition est maintenant **la moitié au geste éponyme, le reste
partagé également**. La moitié suffit à ce qu'une Voix reste une Voix — c'est ce
que le contrôle exige déjà — et les vingt-neuf trentièmes n'ajoutaient qu'un
appauvrissement.

| famille | avant | après |
|---|---|---|
| Voix | tempo 29 · capo 4 · contretemps 1 · écho 1 | tempo 18 · contretemps 6 · écho 6 · capo 5 |
| Percussion | mash 28 · crescendo 1 | mash 15 · crescendo 7 · salves 7 |
| Fidélité | hold 50 · retenue 3 · tenue 1 | hold 27 · tenue 14 · retenue 13 |

Cent cinq personnages ont changé de variante, de façon déterministe sur leur
identifiant : relancer le calcul donne le même catalogue. Les trois autres
familles étaient déjà réparties et n'ont pas bougé.

`catalogue:test` a un contrôle de plus : **chaque variante est réellement
jouable** — au moins un huitième de sa famille. Le seuil est bas exprès : ce
n'est pas une cible d'équilibrage, c'est le plancher sous lequel une variante
n'existe qu'au catalogue.

### Le dossier de l'administrateur

`npm run dossier` génère un document complet des mécaniques —
`scripts/dossier.mjs`, publié comme artefact.

**Il est généré et non écrit**, et c'est tout son intérêt : les nombres, les
règles, les coûts et les barèmes viennent des mêmes modules que le jeu. Un
document qui dit « dix-sept mini-jeux, vingt-neuf cartes, dix stades » est faux
le jour où l'on en ajoute un, et personne ne le sait. Celui-ci ne peut pas mentir
plus longtemps qu'une commande.

Douze sections : ce qu'est un Fanzzy et ses dix caractéristiques, les six
familles avec la répartition de leurs gestes, les neuf séries, **les dix-sept
mini-jeux avec leur règle exacte** — la phrase est écrite à la main, les nombres
viennent du barème — les dix-neuf chants, les deux modes comparés, les
vingt-neuf cartes d'action, les dix-sept pièces, les dix stades, l'économie, les
trente-quatre réglages de l'administration, et l'état du développement.

Seule la dernière section est écrite à la main : aucun module ne sait dire si une
chose est finie.

**Quatre-vingt-onze kilo-octets** contre trois mégaoctets et demi pour le
document qu'il remplace — celui-ci portait cent vingt-six illustrations en
base64. Un dossier de référence se lit, il ne s'admire pas.

### Trois pièges de mise en page, tous le même

Le tableau des mécaniques s'empile sur téléphone : chaque ligne devient un bloc,
l'en-tête de colonne passe en étiquette. Trois essais avant que ça tienne à
320 px, et les trois fautes étaient la même famille :

1. **En flex**, le contenu d'une cellule est un texte nu — un élément anonyme qui
   ne sait pas rétrécir sous sa largeur minimale. C'est exactement le défaut des
   onglets, deux sessions plus tôt.
2. **En grille à deux colonnes**, pas mieux : un titre suivi d'un `<span>` fait
   *trois* éléments avec le pseudo-élément, et le troisième repassait à la ligne
   dans la colonne étroite.
3. **En bloc**, il n'y a plus ni colonne ni élément à répartir. Plus une valeur
   de réglage en texte long rangée dans la colonne des nombres, qui refusait de
   céder.

Et une quatrième fois le piège des accents graves : un commentaire CSS contenant
`\`nowrap\`` à l'intérieur d'un gabarit de chaîne a cassé le générateur.

---

## 4 tricies. Cinq séries neuves, et deux qui n'existent plus

### Ce qui a été ajouté

Cinq séries, soixante-deux personnages écrits, plus douze arrivés par déménagement — **soixante-douze personnages de stade 1 publiés** :

| série | ce qu'elle raconte | cartes | ouverte au |
|---|---|---|---|
| LES VIP | ceux qui sont là pour autre chose que le match | 15 | niveau 16 |
| LA GASTRONOMIE DE COMPTOIR | ce qui se mange et se boit debout | 14 | niveau 8 |
| LES GALÈRES DE DÉPLACEMENT | on y arrive quand même, et ensemble | 14 | niveau 10 |
| LES PHÉNOMÈNES MÉTÉO | le vent, la pluie, la grêle | 14 | niveau 20 |
| LES HÉROS DU CANAPÉ | ceux qui n’y sont pas et qui parlent le plus fort | 15 | niveau 12 |

Chacune a ses cinq légendaires, ses communes, ses gestes répartis dans sa
famille, et **ses quarante-quatre lignées** — deux âges par personnage, écrits à
la main comme tous les autres.

L'échelle de niveaux se lit maintenant comme un éloignement progressif du
siège : on est dans la tribune, puis derrière la buvette, puis sur la route,
puis sur le canapé, puis dans la loge, puis il n'y a plus personne du tout — le
vent, les morts, les siècles, l'impossible.

**Aucun palier existant n'a bougé.** TR, MS, BG, OB, RV, EP et IM gardent leur
niveau : changer le niveau d'une série reprendrait à un joueur ce qu'il a
ouvert. Les cinq neuves n'occupent que des niveaux qui n'ouvraient rien.

### VIRAGE NORD et NUITS EUROPÉENNES sont dissoutes

C'étaient les deux plus maigres — seize et neuf personnages publiés, quand LA
TRIBUNE en compte trente-cinq. Une série est une étagère à compléter ; une
étagère de neuf cases se remplit par accident, elle ne se collectionne pas.

Et leurs sujets appartenaient ailleurs. VIRAGE NORD, « béton, pluie, hiver »,
c'était la tribune ordinaire. NUITS EUROPÉENNES, « jeudi soir, 900 km »,
c'était le déplacement — et le déplacement a maintenant sa série.

**Rien n'a été supprimé.** Quarante-deux personnages ont changé de champ `set`
et gardé leur identifiant. Les possessions, les decks, les tenues et les âges
désignent une carte par son identifiant : ils ont suivi sans qu'on y touche.

| vers | combien | qui |
|---|---|---|
| LA TRIBUNE | 24 | la tribune ordinaire, et les cinq légendaires du virage : capo, bâche, tambour, muret, torche |
| LES GALÈRES DE DÉPLACEMENT | 7 | les cinq légendaires des nuits européennes, et deux dépubliés |
| LES MÉTIERS DU STADE | 3 | la stadière, les souterrains, la touche |
| LA GASTRONOMIE DE COMPTOIR | 3 | ce qui se mangeait déjà debout |
| LES HÉROS DU CANAPÉ | 2 | la radio, la streameuse |
| LES VIP, LES PHÉNOMÈNES MÉTÉO, LE BESTIAIRE | 1 chacune | l'agent en tribune d'honneur, le vent, le loup |

LA TRIBUNE compte donc **dix légendaires**. Le contrôle exigeait exactement
cinq, et il avait tort : ce qu'on veut vérifier, c'est qu'aucune série n'est
sans sommet. Un plafond n'apporte rien. La plus ancienne série est aussi la plus
profonde, et c'est très bien ainsi.

### Le catalogue vit en base, et l'amorçage n'écrase rien

`sql/series-neuves.sql` déménage **soixante-douze lignes** — les quarante-deux
premiers âges et les trente âges supérieurs. C'est le piège que la base locale a
révélé au premier essai : « X1B » et « X1C » portent leur propre `set_id`, et
les oublier laissait trente cartes rangées dans deux séries que plus aucune page
n'affiche. Tirables et invisibles.

Le fichier retire aussi VN et NE de `series_actives`, et **n'ouvre pas** les cinq
neuves : une installation qui a restreint ses séries l'a fait exprès.

Deux listes d'application existaient et avaient divergé — `schema-smoke.mjs` en
appliquait vingt, `appliquer-schema.mjs` dix-huit. `boutique.sql` et
`billets.sql` manquaient au script de déploiement, qui est précisément celui
dont tout le projet dépend pour ne plus revivre le 8 septembre. Les deux listes
sont maintenant identiques.

### Trois contrôles qui mentaient par un nombre écrit à la main

Les trois ont rougi sur ce lot, et aucun ne parlait d'un vrai défaut :

1. `niveau-smoke` attendait `series.size === 9`. Il lit `SETS.length`.
2. `catalogue-smoke` exigeait exactement cinq légendaires. Il en exige au moins cinq.
3. `fanzzy-images-smoke` tolérait trente et une cartes sans dessin. C'est un
   **cliquet** désormais nommé, avec ce qu'il contient et ce qui le ferait
   descendre.

Un nombre recopié dans un test ne dit rien de plus que la source dont il vient,
et il ment dès que la source bouge. Le troisième reste écrit à la main, et c'est
volontaire : une dette qu'on ne voit plus est une dette qu'on ne paie jamais.

### La dette d'illustrations

Cent quatre-vingt-trois cartes n'ont aucun dessin : les trente et une
légendaires, et les cent cinquante-deux lignes des cinq séries neuves. Sans
adresse, la fiche tombe sur le rendu procédural — elles ne sont pas invisibles,
mais une légendaire en silhouette géométrique n'est pas une légendaire.

**Quarante-quatre dessins en effaceraient cent trente-deux** : les âges
supérieurs tombent sur le dessin de leur premier âge, et les quarante-quatre
lignées neuves en ont chacune deux. C'est là qu'il faut mettre la prochaine
fournée, pas sur les légendaires.

---

## 4 tricies semel. Le bouton qui mentait, la case de BD, et un décor par série

### « EMMENER EN DUEL » n'emmenait personne en duel

Il écrivait `user_wallet.active_fanzzy` — **l'avatar**, le personnage que voient
l'accueil et les amis. Le Fanzzy n'entrait dans aucun deck, ne poussait sur
aucune corde, et la fiche affichait ensuite « DÉJÀ EN DUEL » sur quelqu'un qui
ne jouerait jamais. Le bouton disait une chose et en faisait une autre.

Il fait maintenant ce qu'il dit, et il demande **où** : un deck a un titulaire,
celui qui entre au coup d'envoi, et des remplaçants que la carte Changement fait
entrer. Ce n'est pas la même décision, et la fiche ne peut pas la prendre à la
place du joueur.

`POST /api/deck/placer` pose un personnage à un rang. Le reste du deck n'est pas
touché — les pièces des autres rangs, les dix cartes d'action, le nom. Trois
règles le tiennent :

- **Un déplacement est un échange.** Passer son titulaire en remplaçant laissait
  sinon le rang 0 vide et le deck invalide, et le sortant disparaissait sans que
  rien ne le dise. Les deux personnages échangent leur place, équipement compris.
- **Pas de trou au milieu.** Le rang 2 ne s'ouvre que si le rang 1 est occupé :
  c'est `fanzzy[0]` qui décide du titulaire, et un trou ferait mener le deck par
  le premier rang non vide, qui n'est pas celui qu'on a choisi.
- **Un âge supérieur place son personnage.** Ouvrir la fiche du Capo et le
  placer place le Choriste, qui est le même individu.

Deux défauts trouvés par les contrôles écrits pour l'occasion, dont un dans le
code neuf : `Number(null)` vaut **zéro**. Un appel sans place aurait donc nommé
un titulaire en silence, en sortant celui qui y était — le contraire exact de ce
que la question est là pour obtenir. Le type est vérifié avant la valeur.

Les étiquettes ont suivi : la carte du classeur dit « AVATAR » et non « DUEL »,
l'onglet dit « TON AVATAR ». Elles nommaient le deck en parlant d'autre chose.

### Une seule boîte pour demander « es-tu sûr ? »

Il y en avait trois façons, et elles ne se ressemblaient pas : **rien du tout**
pour la plupart des gestes — se déconnecter, emmener un Fanzzy en duel,
acheter — ; **`confirm()` du navigateur** pour quitter un KOP, une boîte système
grise précédée de « thebestfan.online indique », qui sort de l'univers du jeu à
l'instant précis où l'on demande au joueur de s'engager ; et **un panneau écrit
à la main** pour l'évolution, riche et juste, mais qui ne vivait que dans la
fiche.

C'est la troisième qui a gagné. `public/dialogue.js` — `TBF_DIALOGUE.confirmer`,
qui rend une promesse. La règle qu'elle porte : **une confirmation montre ce
qu'on va perdre**, elle ne demande pas deux fois. Un « es-tu sûr ? » auquel
personne ne peut répondre autrement qu'au hasard ne protège de rien ; il apprend
seulement à appuyer sur OUI sans lire.

Ce qu'elle garantit : le geste qui engage est **toujours à droite**, le focus
entre dans la boîte et n'en sort pas, Échap et le fond annulent, et `surOui`
retient la fermeture pendant l'appel réseau — sans lui, l'échec arriverait une
seconde après la disparition de la boîte, sur une page qui a déjà tourné.

Branchée sur la déconnexion (trois écrans), la sortie d'un KOP, l'achat en
billets, la commande en euros, l'entrée en duel, et la suppression du compte —
qui garde son mot de passe mais perd son `prompt()`.

`verif-pages` exige maintenant `dialogue.js` **sur chaque page**. Les appels
s'écrivent `window.TBF_DIALOGUE?.confirmer(...)` : sans le script, la garde `?.`
rend `undefined` et le geste **passe sans rien demander** au lieu de lever. Un
oubli ne casserait rien et retirerait une protection — la faute qu'aucune suite
n'attrape.

### Le moment fort est une case de bande dessinée

« GOAL ! » était du lettrage nu posé sur le personnage, avec un contour sombre
pour tenir. Ça ne tenait pas : du jaune sur un maillot jaune, sur une pelouse
verte, sur une photo de stade éclairée aux projecteurs — il y a toujours un fond
qui gagne. On voyait qu'il se passait quelque chose sans pouvoir lire quoi.

Il a maintenant un cadre, un fond opaque et des rayons, et il est **au centre de
l'écran**. La case règle les deux problèmes d'un coup : elle isole le lettrage du
fond, donc il se lit ; et elle fait l'événement, parce qu'un panneau qui tombe au
milieu de l'écran est une interruption et non une décoration.

Le panneau est posé sur `document.body` et non dans la boîte du personnage —
c'est ce qui permet de le centrer sur la page. `momentDans` ne servait qu'à
contourner ça : il est ignoré. Un seul panneau par page, sans quoi deux scènes
en posaient deux au même endroit et couper l'un laissait l'autre affiché.

`.tbf-vignette` est un vocabulaire partagé : le résultat du duel — VICTOIRE,
DÉFAITE, MATCH NUL — porte exactement le même cadre. Ce sont les deux mots que
le jeu dit le plus fort, et qu'ils se ressemblent est ce qui les fait reconnaître
avant d'être lus.

### Un décor derrière chaque Fanzzy

Les personnages étaient détourés sur du noir, avec un halo teinté par la
famille. Le Gamin au Tambour de LA TRIBUNE et le Loup du BESTIAIRE se tenaient
devant exactement le même vide, à la nuance de bleu près : deux cent quatre-vingts
personnages, un seul lieu.

`public/fanzzy-fond.js` compose le décor à partir des quatre choses demandées,
chacune sur une couche qui ne marche pas sur les autres :

| ce qui décide | ce que ça change |
|---|---|
| **la série** | le *lieu* — les gradins, le couloir de service, le comptoir, l'autoroute de nuit, le salon, la loge, le ciel… douze silhouettes |
| **la tenue** | l'*époque* — toute la palette bascule. C'est ce qui fait qu'une tenue se voit de loin au lieu de se chercher sur le costume |
| **l'âge** | la *lumière* — un projecteur au premier, trois au troisième. Une légendaire a sa couronne, qui ne se gagne pas |
| **la famille** | l'*accent* — la couleur du halo et un motif : ondes pour la Voix, peau de tambour pour la Percussion, fanions pour le Tifo |

Il est déterministe, semé sur l'identifiant : deux rendus de la même fiche
donnent le même décor. Le classeur et la fiche partagent le même, `artFond` y
déléguant — deux décors pour le même personnage, c'est le joueur qui apprend
deux fois où il habite.

**Trois défauts n'ont été vus qu'en regardant l'image**, et aucun contrôle
automatique ne les aurait nommés :

1. **Le cadre était carré.** Avec `slice`, un carré posé dans une vitrine de
   370 × 565 s'agrandit d'un facteur 5,65 — chaque forme sortait une fois et
   demie trop grosse, les têtes de la foule en pastilles de dix-sept pixels. Le
   décor n'était pas mal dessiné, il était trop gros pour être reconnu. En
   portrait, le facteur tombe à 3,8.
2. **Les silhouettes étaient claires.** Des formes pâles sur un ciel sombre
   donnaient une bouillie olive. Le principe manquait, et il est le même depuis
   toujours dans un stade : on est dans le noir, la lumière est au-dessus. Un
   décor est **du noir sur un ciel éclairé**.
3. **L'accent de famille peignait au lieu de teinter.** À trente pour cent, les
   ondes de la Voix étaient la seule chose visible — une tache plus grande que le
   personnage.

---

## 4 tricies bis. Les saisons remplacent les niveaux

### Ce qui n'allait pas dans l'ouverture par niveau

Les séries s'ouvraient au niveau du joueur : LA TRIBUNE au 1, LES MÉTIERS DU
STADE au 3, LE VIRAGE IMPOSSIBLE au 26. Ça marchait, et ça avait un défaut qu'on
ne voit qu'en regardant le jeu vivre : **rien n'arrivait jamais à personne en
même temps**.

Chacun découvrait une série le jour où son compteur d'expérience passait un
seuil, seul, sans que ce jour-là existe pour qui que ce soit d'autre. Deux
joueurs qui se parlent ne parlent alors jamais de la même chose, et il n'y a
rien à annoncer — puisqu'il n'y a rien de neuf, seulement quelqu'un qui rattrape.

Une saison ouvre **pour tout le monde le même jour**. C'est ce qui permet de
relancer le jeu.

### Ce qu'une saison est

Une ligne de la table `saisons` : un numéro, un nom, une annonce, et quatre
listes de contenu. Elle se prépare **en brouillon** — rien ne change pour
personne — et se lance d'un geste distinct, qui est le plus visible de toute
l'administration : il change le jeu de tous les joueurs connectés, à la seconde.

Ce qu'elle ouvre vraiment :

| ce qu'elle nomme | ce qui se passe au lancement |
|---|---|
| **séries** | elles s'ouvrent — c'est le levier principal |
| **tenues** | elles se publient |
| **équipement** | annoncé, pas retenu |
| **cartes d'action** | annoncé, pas retenu |

Les deux dernières sont du **code**, pas de la base : rien ne sait encore les
garder fermées. Le dire plutôt que de faire semblant — et le jour où elles
vivront en base comme le catalogue, les deux champs deviendront des leviers sans
changer de forme.

**Additif, jamais soustractif.** Les séries ouvertes sont l'**union** de toutes
les saisons lancées. La saison 4 n'annule pas la 3 : un collectionneur qui a
commencé LES REVENANTS doit pouvoir les finir, et une série qui se referme
derrière lui transformerait sa collection en dette. Refermer reste possible — on
remet la saison en brouillon — et c'est délibérément malcommode.

### Les trois endroits où le changement se voit

**L'administration** a un onglet SAISONS, qui est désormais le seul d'où l'on
ouvre du contenu. L'onglet FANZZY montre les séries ouvertes, il ne les règle
plus : un second interrupteur aurait été une seconde vérité, et le jour où les
deux divergent personne ne sait laquelle le jeu applique. La confirmation de
lancement **énumère ce qui s'ouvre** — un « es-tu sûr ? » auquel on ne peut
répondre qu'au hasard ne protège de rien.

**Le kiosque** annonce la saison en cours, une fois par joueur. Le serveur
retient la dernière vue : une annonce qu'on ne peut pas faire taire est une
annonce qu'on apprend à ne plus lire, et la suivante ne le serait pas non plus.
Il dit aussi ce qui attend — « trois séries en attente d'une saison » — **sans
promettre de date**. Il disait « au niveau 12 » ; une saison se lance quand
l'administration la lance, et annoncer une échéance qu'on ne tiendra peut-être
pas est pire que de n'en annoncer aucune.

**Le niveau** n'ouvre plus que des capacités : des emplacements de club, un
troisième rang de tribune. Sept paliers au lieu de dix-neuf. C'est la bonne
chose à lui confier — une capacité n'a de sens que pour un joueur donné, et
personne n'a envie qu'on la lui annonce. `fanzzy.error.set_locked` n'est plus
émis nulle part : il ne reste qu'une règle, donc un seul refus.

### La migration, et ce qu'elle évite

`sql/saisons.sql` crée une **saison 1** faite de ce que l'installation ouvrait
déjà — la liste de `reglages.series_actives`, ou toutes les séries si ce réglage
était absent. Sans cette reprise, une base en service se retrouverait **sans
aucune série ouverte** le jour du déploiement : l'union des saisons lancées
serait vide et le kiosque n'aurait plus rien à distribuer.

`chargerCatalogue` charge les saisons lui-même, et en premier. Ce n'est pas une
commodité : `chargerSeries` en dépend entièrement, et tout ce qui monte un
catalogue passe déjà par là. Le confier à l'appelant aurait voulu dire l'ajouter
à dix-neuf suites et à chaque nouvelle, avec pour seule sanction d'un oubli une
exception au premier affichage du kiosque.

### Quatre suites que personne ne lançait

`admin-smoke`, `fanzzy-smoke`, `classement-smoke`, `souvenirs-smoke` et
`nvn-net-smoke` n'étaient dans **aucun script npm**. Elles ne se lançaient donc
que si quelqu'un tapait leur chemin de mémoire, ce que personne ne fait — et deux
d'entre elles avaient dérivé en silence pendant des semaines :

- `fanzzy-smoke` tirait dans VIRAGE NORD et NUITS EUROPÉENNES, dissoutes. Elle
  levait au premier booster. Elle figeait aussi « la première carte est un
  supporter **commun** », ce qui n'est plus vrai depuis que les deux premières
  places tirent leur rareté — sans quoi aucune légendaire n'était atteignable.
  Elle passait quand même, parce qu'elle tirait dans une série trop pauvre pour
  avoir autre chose que des communes ;
- `nvn-net-smoke` chantait en choisissant son **geste**, ce que le duel refuse
  depuis qu'il a reçu le répertoire du Virage. Sept contrôles tombaient en
  cascade, la corde n'ayant jamais bougé.

Une suite qu'on ne lance jamais ne protège de rien, et pire : elle fait croire
que la chose est couverte. C'est l'exact équivalent, pour les tests, de la
promesse sans destinataire que `promesses.mjs` traque par ailleurs — qui le
traque donc maintenant aussi.

### Une collision qu'une exception cachait

`.grille` était déclarée sans préfixe dans `ui.css`, et **inscrite dans la liste
des exceptions** du contrôle de préfixe : « vocabulaire partagé, posé par
geste.js ». Elle ne l'était pas. Deux pages s'en servaient déjà pour autre
chose — la grille des cartes d'action du deck, et les formulaires de
l'administration — et la règle commune leur imposait `width:86%; margin:0 auto`,
qui n'a de sens que pour la mosaïque.

Le formulaire des saisons sortait donc centré sur les deux tiers de la largeur,
avec son champ d'annonce débordant par-dessus son étiquette. Vu sur la capture,
pas autrement.

**Écrire « c'est du vocabulaire partagé » ne rend rien partagé.** La classe
s'appelle `tbf-grille`, l'exception est retirée.

---

## 4 tricies ter. L'accueil respire, et l'application tient enfin la tablette

### Trois cadres de trop

**L'avatar avait un cadre.** Une plaque sombre autour de la pastille dorée, qui
portait le pseudo et le nom du club à côté. Sur un compte neuf ces deux lignes
sont vides : il ne restait qu'un rectangle noir pendant sous la pastille, plus
haut que tous les boutons de la rangée, sans rien dedans. Les deux se lisent au
profil, qui est à un doigt de là. Le cadre est parti, et avec lui la jauge de
palier ; le niveau reste, en pastille sur l'avatar.

**Les deux jetons aussi.** Une plaque dorée autour d'un compteur doré et une
plaque rouge autour d'un compteur rouge : deux fois la même information, et deux
boutons qui criaient plus fort que les dix destinations du jeu. Il reste le
dessin et le nombre.

Tout ce qui est dans la barre du haut fait maintenant **la même hauteur**. C'est
la seule chose qui fasse une rangée : trois objets de trente-huit, quarante-
quatre et cinquante-deux pixels côte à côte se lisent comme trois accidents.

### L'écharpe, en quatre essais ratés

Le jeton des écharpes portait un carré rayé en CSS. Il est passé en dessin au
trait, comme tout le reste du jeu — et il a fallu **huit tracés, regardés à
vingt-deux pixels**, pour en trouver un qui se lise :

| tracé | ce qu'on voit à 22 px |
|---|---|
| boucle nouée + franges | un verre à pied |
| bande diagonale | un pansement |
| col + deux pans | une échelle |
| nœud + franges | une table |
| col en V | un pantalon |
| pendue à franges | une cravate |
| nœud à deux pans | un portique |
| **bande à rayures obliques** | **une écharpe** |

C'est celui-là. Et ce n'est pas un hasard : c'est déjà ainsi que le jeu dessine
une écharpe partout ailleurs — `.tbf-echarpe`, des rayures obliques. À cette
taille il ne reste que la silhouette, et la silhouette d'une écharpe de
supporter est une bande rayée.

Le sachet des boosters, lui, reprend **le dessin exact** de la tuile BOOSTERS.
Un même objet dessiné de deux façons, ce sont deux objets à apprendre.

### Les deux rails se répondent rangée par rangée

CARNET et MATCHS ont échangé leur place. Chaque rangée porte désormais une
couleur **et** un sujet :

| | à gauche | à droite |
|---|---|---|
| rouge — ce qui se joue | VIRAGE | DUEL |
| bleu — ce qui se collectionne | FANZZY | CARNET |
| vert — ce qui se regarde | MATCHS | CLASSEMENT |
| violet — les autres | KOP | AMIS |
| jaune — ce qui s'achète | BOOSTERS | BOUTIQUE |

Dix tuiles sans logique de rangée sont dix choses à retenir ; cinq paires en
font cinq.

### La largeur : une seule vérité, enfin

`ui.css` déclare `--colonne` depuis toujours, avec un commentaire expliquant
qu'au-delà du téléphone on centre plutôt que d'étirer. **Cette variable n'avait
aucun effet.** Chaque page écrivait sa propre largeur en dur — 440, 460 ou 520
pixels selon l'écran et le jour — soit **dix-huit largeurs dans quinze
fichiers**, et trois valeurs différentes pour la même application.

Sur une tablette, tout tenait donc dans un rail de cinq cents pixels au milieu
d'un écran noir, et élargir la variable ne changeait rien du tout.

Les dix-huit pointent maintenant sur `var(--colonne)`, qui vaut
`min(100vw, 900px)` — **sans palier**.

Il y en a eu un, à sept cents pixels : en dessous, la colonne restait à 520. Une
tablette de cinq cent soixante-dix-huit pixels tombait donc pile dans l'angle
mort — trop large pour le téléphone, trop étroite pour le palier — et gardait
trente pixels de noir de chaque côté pour rien. Un seuil qui découpe les écrans
en deux familles se trompe toujours sur ceux du milieu ; `min()` n'a pas ce
défaut.

Le plafond, lui, reste : au-delà de neuf cents pixels, une ligne de texte
dépasse la centaine de caractères et l'œil perd le début de la ligne suivante.

`admin.html` reste à mille cent, et c'est la seule exception : ce n'est pas un
écran de supporter mais un écran de gestion, et un tableau à six colonnes ne se
lit pas dans neuf cents. Elle est nommée dans `verif-pages`, avec sa raison.

Sur l'accueil, le rail suit **la colonne** et non la fenêtre :
`clamp(58px, 15,5 % de la colonne, 88px)`. Les mesurer en `vw` marchait tant que
les deux se confondaient et devenait faux dès que la colonne a cessé de remplir
l'écran — sur mille trois cents pixels, seize pour cent de la fenêtre font un
rail de deux cents dans une colonne qui en fait neuf cents.

Le plafond a d'abord été posé à 104 px, au jugé. À l'écran, les tuiles
écrasaient le personnage et le jeu ressemblait à une télécommande. À 88, les
`clamp` communs d'`ui.css` suffisent pour l'icône et le libellé : il n'y a plus
rien à forcer. **Une tuile d'accueil est un point de départ, pas la chose qu'on
regarde.**

### Deux contrôles qui n'existaient pas

`verif-pages` refuse désormais qu'une **coque de page** écrive sa largeur en
dur. Le premier jet regardait tous les `max-width` et attrapait un paragraphe
d'administration capé à six cent quarante pixels pour se lire — ce qui est
exactement ce qu'il faut faire. Une largeur de texte n'est pas une largeur de
colonne, et un contrôle qui confond les deux se fait désactiver.

`tour:ui` refait **tout le tour à 834 pixels**, la largeur d'une tablette en
portrait. Il y vérifie deux choses qui ne se voient pas autrement : que chaque
écran remplit la colonne, et qu'aucun ne déborde. Toutes les suites visitaient
le jeu à trois cent soixante pixels ; une page qui se casse à neuf cents serait
partie en ligne sans que rien ne proteste.

### Et une suite qui tombait une fois sur deux

`nvn-net-smoke` échouait par intermittence depuis qu'elle avait été remise à
jour — sept contrôles d'un coup, ou aucun. Deux causes, toutes deux dans le
test et non dans le jeu :

1. **Le souffle.** Les chants coûtent de 22 à 38, le répertoire est tiré de
   l'identifiant du duel, et selon la partie le seul chant de rythme offert
   était le plus cher. Le moteur le refusait pour `not_enough_breath`.
2. **La régularité.** Le serveur refuse les frappes de métronome — deux
   intervalles identiques à six millisecondes près valent
   `inhuman_regularity`, et il a raison. Le test ne faisait trembler que le
   tempo ; le martelage et la mesure arrivaient au métronome.

Et une troisième, plus subtile : `echo` rejoue un motif de cinq coups **tiré
par le serveur à chaque chant**. Le rejouer sans l'avoir lu donne zéro. Il est
sorti de la liste des gestes que cette suite sait fabriquer de mémoire — ce
qu'elle éprouve est le réseau, et les mini-jeux ont leurs propres suites.

Trente passes vertes d'affilée après correction.

---

## 4 tricies quater. Un seul menu, et les saisons qui s'enregistrent enfin

Quatre défauts signalés sur des captures, et tous les quatre avaient la même
forme : **rien ne cassait**. Deux menus s'ouvraient, un bouton se cliquait, un
formulaire se refermait. C'est la famille de pannes qu'aucune suite n'attrape
tant qu'on ne lui demande pas de comparer deux choses entre elles.

### Il y avait deux menus, et ils avaient divergé de six entrées

`nav.js` montait le menu sur les dix-huit pages de contenu : onze destinations
en trois rubriques, l'accueil en tête, la déconnexion en dernier. L'accueil, qui
ne charge pas `nav.js` — ses deux rails portent sa navigation — s'était écrit
**le sien**, à la main, dans son HTML.

| | menu commun | menu de l'accueil |
|---|---|---|
| destinations | 11 | 5 |
| rubriques | JOUER · MA COLLECTION · LE FOOTBALL | aucune |
| absents | — | Virage, duel, boutique, boosters, carnet, amis |
| déconnexion | sans confirmation | avec confirmation |

Un joueur qui ouvrait le menu depuis l'accueil et le rouvrait depuis le
classeur voyait deux jeux différents. C'est la **seconde vérité**, pour la
cinquième fois de ce projet, et cette fois elle portait aussi une incohérence de
sécurité : la déconnexion demandait d'un côté et pas de l'autre. Une
confirmation qui n'apparaît que sur certains écrans est pire qu'aucune — on
apprend que le jeu ne demande pas, et on cesse de lire le jour où il demande.

`public/menu.js` porte désormais la liste, les icônes, la construction du
tiroir, la confirmation de sortie, l'entrée d'administration et la pastille du
direct. `nav.js` l'appelle, l'accueil l'appelle, **et l'administration aussi** —
elle n'avait qu'un lien « retour au jeu », et un administrateur qui voulait le
kiosque devait repasser par l'accueil.

### L'entrée ADMIN était partie sans rien dire

```js
a.innerHTML = '…ADMIN';
nav.appendChild(a);        // `nav` n'existe plus depuis la barre du bas
```

`nav` était l'élément de la barre du bas, supprimée deux tours plus tôt. La
référence levait une `ReferenceError`, que le `try { … } catch { /* module
absent */ }` du bloc avalait — et **plus aucun administrateur ne voyait
l'entrée**, sans erreur en console, sans trace, sans test rouge.

Un `catch` muet autour d'un ajout facultatif est le meilleur endroit du monde
pour cacher une panne. Celui-ci a survécu à toutes les relectures parce qu'il
ressemblait à une précaution.

Au passage, l'accueil décidait de cette entrée sur `user.role === 'admin'`
pendant que les autres pages interrogeaient `estAdmin` côté serveur : deux
réponses possibles à la même question. Il n'en reste que la seconde.

### « Impossible. » — les saisons ne s'enregistraient pas

Le formulaire de saison marchait, la confirmation s'affichait, et cliquer
« Enregistrer » donnait une boîte d'alerte disant `Impossible.`

```js
const api = async (p, body, method) => { … }          // trois arguments

api(`/saison/${s.id}`, { method: 'PATCH', body: corps });   // deux…
```

Le deuxième argument est **le corps**. Ces quatre appels-ci y passaient un objet
d'options : le serveur recevait un `POST` dont le corps était
`{ method: 'PATCH', body: {…} }`, refusait sans code, et l'écran affichait le
seul message qui ne dit rien. Aucune saison n'a jamais pu être modifiée, lancée
ni supprimée depuis cet écran. Les seize autres appels de la page avaient la
bonne forme, ce qui est exactement ce qui rend la faute invisible à la
relecture.

`admin-smoke` éprouvait les routes — elles étaient bonnes. `admin-ui-smoke`
prenait une capture du formulaire — il s'affichait très bien. **Personne ne
cliquait sur Enregistrer.** Le contrôle le fait maintenant, et il relit la
base : c'est le seul endroit où « le formulaire s'est refermé » et « c'est
enregistré » ne se ressemblent pas.

### Et le serveur lançait une saison sur une requête fautive

En cherchant pourquoi la mutation du bouton « lancer » ne faisait pas tomber le
test, la vraie raison est apparue côté serveur :

```js
lancerSaison(…, req.body?.lancer !== false, …)
```

Un corps que la route ne comprend pas — champ absent, mal nommé, mal emballé —
vaut donc **lance**. C'est le pire défaut imaginable pour le geste qui ouvre du
contenu à tous les joueurs au même instant, et l'écran cassé le démontrait : il
était incapable de refermer une saison et parfaitement capable d'en ouvrir une.
`lancer` doit maintenant être un booléen, sinon `admin.error.lancer_manquant`.

### « On ne sait pas si les modifications ont été prises en compte »

C'était vrai partout, pas seulement sur les saisons. Chaque écrit se faisait en
silence : le formulaire se refermait, la liste se redessinait, et rien ne
distinguait un enregistrement réussi d'un formulaire simplement fermé.

Les réglages avaient le cas le plus net. Ils s'enregistrent **champ par champ**,
sans bouton — délibérément, parce qu'un bouton unique obligerait à deviner
lequel des vingt-six champs le serveur a refusé. Leur seul accusé de réception
vivait dans un bandeau collé en pied de liste, sous vingt-six lignes : on
touchait un champ en haut de l'écran, et rien ne bougeait là où on regardait.

Ce qui manquait n'était donc pas le bouton, mais **la réponse**. Un reçu se pose
maintenant par-dessus la page, en haut à droite, sur chaque écriture des sept
onglets, et le refus y passe en rouge avec sa raison en français. Il n'y en a
jamais qu'un : deux messages empilés se lisent comme une erreur.

### Ce qui garde tout ça

`scripts/menu-smoke.mjs` ouvre le menu **en cliquant le bouton** sur l'accueil,
sur une page de contenu et sur l'administration, pour un compte administrateur
et pour un compte ordinaire, puis compare les listes obtenues. Il ne relit pas
`menu.js` pour se donner raison : la liste des seize destinations attendues est
écrite dans le contrôle. Quatre mutations, quatre rouges — l'entrée ADMIN
retirée, l'accueil qui s'écarte, la confirmation de sortie ôtée, la page
courante qui ne se marque plus.

`verif-pages` refuse en plus une page sans `menu.js` et une page qui écrit son
propre tiroir. `admin-ui-smoke` joue le cycle complet d'une saison — brouillon,
modification, lancement, retour en brouillon, suppression — et vérifie après le
lancement que le jeu n'ouvre plus que la série cochée.

Un détail attrapé en chemin : les règles d'onglets de l'administration visaient
l'élément `nav`. Le tiroir commun est lui aussi un `<nav>`, et il héritait
`display:flex`. C'est le piège des classes sans préfixe, sur un nom de balise.

### Dix-sept lignes, et la hauteur qui ment

Le menu en portait seize et en porte dix-sept, puisque l'entrée ADMIN y arrive
enfin. Mesuré : **879 px de contenu dans 808 px de place** — « Se déconnecter »
tombait sous le bord, c'est-à-dire précisément la ligne qu'on vient chercher.
Un écart qu'on ne voit pas tant qu'on ne le mesure pas, parce que le tiroir
défile : il a l'air entier.

Trois pixels repris ligne par ligne — interligne à 1 px, lignes à 10 px de
hauteur, rubriques resserrées — et 816 px tiennent dans 818. Plus de
défilement sur un écran de neuf cents pixels.

Et `100vh` a été remplacé par `100dvh`, avec `vh` gardé au-dessus en repli.
`100vh` vaut la **plus grande** hauteur possible sur un téléphone, barre
d'adresse repliée : tant qu'elle est dépliée, un menu calculé dessus dépasse
exactement de la hauteur de cette barre. Le contrôle ne l'aurait jamais vu — un
navigateur sans interface mobile n'a pas de barre d'adresse qui bouge.

Et un affichage trompeur, corrigé : une saison lancée qui n'ouvre aucune série
laisse le jeu **toutes séries ouvertes** — c'est le cas de la saison 1 reprise —
mais sa carte affichait « Séries — », ce qui se lit comme « plus rien ». L'écran
dit maintenant, en haut, les séries ouvertes en ce moment.

---

## 4 tricies quinquies. Le classeur se tait sur ce qui n'existe pas encore

### Une promesse qu'on ne peut pas tenir n'est pas un but

Le classeur montrait **tout le catalogue publié** : deux cent quarante-sept
silhouettes grises, dont une bonne part appartient à des séries qu'aucune saison
n'a ouvertes. Un classeur est une promesse — « voilà ce qu'il y a à trouver » —
et une promesse hors de portée ne donne pas un objectif, elle donne un mur.

Elle coûtait aussi la seule chose qu'une saison a à vendre : la **surprise**.
Lancer LES VIP devant quelqu'un qui a déjà fait défiler leurs quinze silhouettes
pendant trois semaines n'annonce rien.

Les saisons étant additives, « la saison en cours et toutes celles d'avant » est
exactement la liste des séries ouvertes, que le serveur calcule déjà. La page ne
la recalcule pas — elle la lit.

**Sauf ce qu'on possède.** Refermer une série cesse de distribuer ; ça n'efface
pas les cartes de qui les a. Un filtre écrit trop vite casse ce cas en premier,
et c'est celui qui transformerait une collection en trou. Les deux moitiés ont
leur mutation et leur rouge.

### La fiche montrait le contraire de la grille

La grille affiche un Fanzzy qu'on n'a pas en silhouette grise, cadenassée.
L'ouvrir le rendait à ses couleurs, avec ses trois âges, ses effets et ses
tenues à fouiller case par case. Deux images contradictoires du même
personnage, à un doigt l'une de l'autre — et la seconde livrait précisément ce
que la première disait ne pas avoir.

Elle reste éteinte : le même `grayscale(1)` que la grille, les rangées inertes,
et la pastille du cri redevenue un simple texte — c'était le seul élément qui
répondait encore, une carte éteinte qui pousse un cri quand on la touche.

« Inerte » se mesure des deux côtés. `pointer-events:none` ferme la souris ;
sans `disabled`, la tabulation traversait toujours une rangée de quinze boutons
muets. Le premier jet n'avait que la moitié, et la suite l'a dit.

Le panneau de détail décrivait « ÂGE À VENIR » d'un personnage qu'on ne possède
à aucun âge. Il dit maintenant la seule chose qu'on veuille savoir devant une
carte grise : dans quel booster elle se tire. Le nom de la série vient du
serveur (`setNom`) — une table « TR → LA TRIBUNE » écrite dans la page aurait
été la copie de trop.

---

## 4 tricies sexies. Le catalogue illustré, et cent trois cartes muettes

### Ce que le dossier ne pouvait pas dire

`dossier.html` dit les règles, les barèmes et les chiffres. Il ne montre pas une
image, et c'est très bien : il se lit.

Il restait l'autre question — **qu'est-ce qui est dessiné**. Six cent
quarante-trois cartes, douze états par âge, trois âges par personnage, neuf
tenues : cette comptabilité ne tient dans aucune tête, et elle n'existait nulle
part. On savait « il manque des dessins ». On ne savait pas lesquels.

`catalogue.html` — `npm run catalogue` — range le catalogue **par famille**,
parce que c'est ainsi que le jeu l'emploie, et donne pour chaque personnage sa
lignée en images, ses effets, son cri, et une grille dépliable de douze états
sur trois âges. Les vignettes sont réduites à cent trente pixels et incrustées
en `data:` : la page doit s'ouvrir seule, sur une machine qui n'a pas le dépôt,
et une page qui pointe vers `/img/...` est vide partout ailleurs.

Ce qu'elle a appris du premier coup :

| | |
|---|---|
| personnages | 247 |
| premiers âges dessinés | 158 |
| à dessiner | 89 |
| avec leurs douze états | **1** |
| tenues dessinées | **1 sur 9** |

Les trois nombres que le dossier annonçait à cet endroit — « 198 personnages,
262 âges, 183 cartes » — étaient **écrits à la main**, dans un document dont
l'en-tête promet qu'il ne peut pas mentir plus longtemps qu'une commande. Ils
dataient du lot d'avant. Ils se comptent maintenant sur le disque.

### Cent trois cartes portaient un effet que personne ne pouvait lire

En confrontant la table des effets de la page à toutes les clés employées :
`modsText`, dans `public/cartes.js`, ne nommait ni `parryResist` — **cent trois
cartes** — ni `costPenalty` — dix-sept. Sur toutes, la fiche affichait la liste
des effets **sans celui-là**.

La faute est invisible par construction. La liste n'était pas vide, elle était
incomplète, et une carte qui montre deux effets sur trois a exactement l'air
d'une carte qui en a deux. Rien à l'écran ne manque, rien ne casse, aucune
console ne parle. C'est la même famille que l'entrée ADMIN avalée par un
`catch` : une absence qui ressemble à une présence.

`catalogue:test` refuse désormais qu'une clé employée par une carte ou une
pièce d'équipement reste sans phrase — et, dans l'autre sens, qu'une phrase
décrive un effet que plus rien ne porte. Le contrôle ne ramasse que ces deux
sources : les stades et les bonus de KOP portent les mêmes clés mais s'affichent
ailleurs, avec leur propre texte, et les mêler ferait rougir le contrôle pour
`pushMult`, que nulle carte ne porte. Un garde-fou qui se plaint de ce qui va
bien est un garde-fou qu'on désactive.

### Le Gamin de Devant était Le Petit Teigneux

Le doublon que le catalogue a rendu visible n'était pas seulement une affaire de
fichiers. `G1` « Le Gamin de Devant » — onze ans, premier rang, mains sur la
barrière, une lignée qui vieillit jusqu'à devenir capo — **est** `TR1` « Le
Petit Teigneux » — onze ans, la voix avant les mots, une lignée qui vieillit
jusqu'au bout du virage. Deux noms, deux histoires, deux cris, un personnage.

Le troisième âge de TR1 le disait mot pour mot sans que personne ne l'entende :
« il gueule sur un gamin de onze ans qui connaît déjà les chants ». C'était G1.

`G1` est devenu **Le Faux Départ** : celui qui lance un chant trois secondes
trop tôt, tout seul, dans le silence. Neuf fois sur dix personne ne suit ; la
dixième, la tribune part avec lui.

**Ses modificateurs n'ont pas bougé d'un chiffre** — ils dictaient déjà le
personnage, il suffisait de les lire. `perfectBonus` énorme, `breathBonus` sous
la barre : des coups d'éclat, pas de la régularité. Et au troisième âge, ses
bonus de vitesse disparaissent au profit d'une fenêtre de tempo à 1,6 et d'une
cadence ralentie de soixante millisecondes — il ne va pas plus vite en
vieillissant, il laisse plus de silence. La lignée est un apprentissage de
l'attente, et le catalogue l'écrivait déjà en nombres.

**L'identifiant ne bouge pas.** Les possessions, les decks et les tenues
référencent `G1`, `G2`, `G3` : les renommer confisquerait la carte à ceux qui
l'ont. On change qui il est, pas où il est rangé.

Ses trois dessins sont partis dans `art/_doublons/` avec un fichier qui dit
pourquoi. Ils ne sont pas effacés — un dessin coûte des crédits et une attente —
mais ils ne sont plus servis : tout ce qui est sous `public/` part en ligne, et
la carte affichait le mauvais visage. La dette passe de 167 à 170, ce qui est un
progrès : **une silhouette dit « pas encore dessiné », un visage emprunté dit
une chose fausse.**

### Deux formes, un seul contenu

`--nu` retire la coque HTML pour la publication en artefact, qui pose la sienne.
Le fichier autonome la garde : sans `<!doctype>`, un navigateur rend la page en
mode « quirks » et elle perd sa mise en page sans rien dire. Les deux formes
viennent des mêmes chaînes — sinon l'une prend du retard, et ce serait toujours
celle qu'on regarde le moins.

Un accent grave dans un commentaire CSS a refermé le gabarit de chaîne au
mauvais endroit pendant l'écriture. C'est la faute que `verif-pages` traque dans
`public/` depuis qu'elle a cassé `nav.js` deux fois ; elle se produit aussi dans
les scripts, où rien ne la guette — seule l'exécution l'a dite.

## 4 tricies septies. Dix-sept dessins rendus à leur carte

Le catalogue illustré a été écrit pour dire ce qui manque. La première chose
qu'il a dite, c'est ce qui était **en trop**.

### Le même lot livré deux fois

Dix-sept cartes `X<n>` portaient le rendu exact d'une autre carte du catalogue.
Pas « se ressemblent » : le même dessin, à moins de deux bits d'empreinte sur
soixante-quatre.

Le constat qui tranche tient en une colonne :

| | côté `X` | côté nommé |
|---|---|---|
| numéro dans `rendus.js` | **aucun** | 002, 007, 010, 019… |
| date du fichier | 6-7 septembre | 8 septembre |

Les dix-sept paires, sans exception. Le même lot a été livré deux fois : nommé à
la main d'abord, puis remis en passant par `rendus.js`, qui l'a posé sur ses
vraies cartes. Les fichiers de la première livraison sont restés, et le jeu les
servait.

`rendus.js` est la table qui fait foi — « on n'y touche plus, un numéro déjà
attribué le reste ». Le dessin appartient donc à la carte qui a le numéro. Les
dix-sept fichiers `X` sont partis dans `art/_doublons/`, et leurs âges
supérieurs ont perdu leur repli avec eux : la dette passe de 167 à 217.

**Elle n'a pas augmenté, elle vient d'être comptée juste.** Cinquante cartes
affichaient le visage de quelqu'un d'autre ; elles affichent maintenant une
silhouette, qui dit « pas encore dessiné » au lieu de dire une chose fausse.

Le seuil des jumeaux passe à **zéro**, et ce n'est plus un cliquet mais une
règle : deux cartes ne peuvent pas montrer le même rendu. Le jour où une
livraison en réintroduit une, `images:test` rougit avant que personne ne l'ait
vue.

### Cinq personnages écrits deux fois

Le dessin partagé cachait autre chose. Sur les dix-sept paires, cinq n'étaient
pas seulement un fichier mal rangé : **c'était le même personnage, écrit deux
fois**, jusqu'au bout de sa lignée.

| avant | doublait | devenu |
|---|---|---|
| `X7` Le Trieur de Doubles | `TR2` Le Collectionneur — les deux lignées finissent sur l'album complet | **Celui Qui Reste** |
| `X30` Le Videur | `BG21` L'Orang-outan en Costume — « il n'a jamais eu à se lever », mot pour mot | **Le Drapeau Perdu** |
| `X32` La Mascotte Casquée | `BG20` L'Abeille de Chantier — casque jaune, panneau, personne ne l'écoute | **Le Marteau-Piqueur** |
| `X39` La Cagoule Rose | `TR5` La Cagoule Timide — la cagoule au secret tendre, et les deux finissent en peluche | **Le Carré à l'Envers** |
| `X48` Le Gosse qui Boude | `TR13` Le Bébé Vainqueur — l'enfant à la coupe, et les deux finissent entraîneur des petits | **La Note Qui Casse** |

Quinze textes réécrits, base et âges. **Aucun chiffre n'a bougé** : ni la
famille, ni la série, ni la rareté, ni les modificateurs, ni le geste, ni la
puissance. L'équilibre du jeu est exactement celui d'avant — seule l'identité
change, et l'identifiant reste, parce que les possessions le référencent.

Les douze autres paires étaient bien douze personnages différents qui portaient
le même dessin par accident. Leur carte n'avait rien à changer.

### Deux collisions de texte, trouvées en chemin

`BG15` et `BG27` s'appelaient tous les deux **« Le Chat du Terrain »**, dans la
même série : la commune et la légendaire du même chat. Un classeur qui affiche
deux fois la même ligne fait croire à un doublon, et on cherche ce qu'on a raté.
La légendaire raconte un moment précis — neuf minutes d'arrêt de jeu, quatre
stadiers à quatre pattes — et s'appelle désormais **« Les Neuf Minutes »**.

`X49` criait **« DE MON TEMPS »** exactement comme `TR12`, et `VP1` **« UN PEU
DE TENUE »** comme `BG11`. Le cri est ce qui s'affiche en gros sur la fiche :
deux fiches au même cri se lisent comme une seule carte vue deux fois. Les
personnages, eux, étaient distincts — seuls les cris ont changé.

`catalogue:test` refuse maintenant deux cartes de même nom, et deux
**personnages** de même cri. Les âges supérieurs sont hors de ce second
contrôle, et seulement de celui-là : un cri fait trois mots, et sur deux cent
soixante-douze âges « MAINTENANT » finit par se croiser sans que ce soit une
faute.

### Ce que cette famille de fautes a en commun

Rien n'était cassé. Les images existaient, chacune valide, chacune au bon
endroit du disque. `images:test` comptait deux dessins et il avait raison. Les
noms se lisaient, les cris se criaient.

C'est la signature de tout ce qu'on a trouvé dans ce tour : **une absence qui
ressemble à une présence**. L'entrée ADMIN avalée par un `catch`. Onze effets
nommés sur treize. Un âge « pas dessiné » au-dessus de ses douze états. Deux
cartes, un visage.

Aucune ne se voit en relisant du code, parce qu'il n'y a rien d'anormal à lire.
Toutes se voient en **comparant deux choses entre elles** — ce qu'une page qui
met tout côte à côte fait pour rien, et ce qu'aucun humain ne fait sur cent
soixante-dix-huit dessins.

## 4 tricies octies. Un identifiant qui dit sa série

### Cent dix-neuf cartes portaient un préfixe étranger

`V1` « Choriste », `G1`, `F1`, `X23` : tous dans LA TRIBUNE, et rien dans leur
identifiant ne le disait. Pour qui range des dessins, écrit `rendus.js` ou
cherche une carte, c'étaient cent dix-neuf occasions de se tromper.

Le plan se calcule (`npm run prefixes`), il ne s'écrit pas. Il refuse de tourner
si une destination existe déjà ou si une carte hors série n'est rattachée à
aucune lignée — un plan qui écrase une carte vivante est pire que pas de plan.

**Les âges suivent en suffixe, pas en numéro.** `V1` devient `TR32`, ses âges
`TR32B` et `TR32C` — pas `TR33` et `TR34`, qui laisseraient croire à trois
personnages. Sept lignées écrivaient encore leurs âges en entrées numérotées ;
seuls leurs **identifiants** changent. Les convertir à la table `AGES` aurait
recalculé leurs modificateurs par formule et fait passer `G1B` de 1,45 à 1,7 de
geste parfait sans que personne ne l'ait demandé. Un renommage qui rééquilibre
le jeu au passage est un renommage dont on ne relit plus le diff.

### Ce qu'un identifiant touche vraiment

Six tables, plus le **JSON** de `user_decks.contenu`. Rater une seule place,
c'est effacer une carte de la collection de quelqu'un.

`sql/prefixes.sql` les fait toutes dans une transaction, par **table de
correspondance** : huit instructions au lieu des neuf cent cinquante-deux du
premier jet, qu'aucun humain n'aurait relues. C'est le motif de `stades.sql`.

Elle se rejoue sans dommage, et c'est nécessaire : le catalogue s'amorce en
`INSERT IGNORE` au démarrage, donc un serveur qui démarre avec le code neuf
**avant** la migration a deux lignes pour la même carte. Le `DELETE` d'ouverture
retire la ligne neuve du catalogue au profit de l'ancienne, qui porte les
possessions. Et si un compte détient les deux identifiants — cas qui n'existe
que sur une base déjà passée au code neuf — les exemplaires **s'additionnent**
et le stade le plus haut l'emporte. Perdre un doublon serait discret et
définitif.

### Le second trou : `INSERT IGNORE` ne sait pas corriger

Le catalogue vit en base parce qu'il s'édite depuis l'administration, et
s'amorce en `INSERT IGNORE` pour ne pas écraser ces corrections. La contrepartie
n'était écrite nulle part : **changer le nom, l'histoire ou le cri d'une carte
existante dans le code ne change rien du tout.**

Les dix-neuf réécritures du tour précédent — Le Faux Départ, Celui Qui Reste,
Les Neuf Minutes — n'auraient jamais atteint le jeu. `npm run identites` compare
le code à une base réelle et produit `sql/identites.sql` : un `UPDATE` par carte
divergente, et rien d'autre. Pas de réécriture en masse — elle effacerait les
corrections faites à l'écran, qui sont la raison d'être de cette table.

`publie` est délibérément hors du rapprochement : c'est le seul champ que
l'administration décide, et le resynchroniser depuis le code annulerait le
retrait d'une carte.

Les deux migrations sont dans l'ordre d'application des **deux** scripts qui
doivent toujours s'accorder — c'est cette paire qui avait divergé le 8 septembre.

### Le renommage a démasqué un contrôle aveugle

`catalogue:test` vérifiait qu'un âge garde le geste de son personnage. Son
helper `racine(id)` prenait `^([A-Z]+\d+)` — qui avale l'identifiant entier
quand l'âge s'écrit `T2`. Il comparait donc T2 avec lui-même, et **passait au
vert sur exactement les lignées qu'il avait été écrit pour surveiller**.

Devenus `MS31B` et `MS32B`, ils ont rougi le jour même : le Colleur d'affiches
jouait `tifo` et ses deux âges `tri` ; l'Auto-stoppeur jouait `echarpe` et ses
âges `memoire`. Un joueur qui faisait grandir son personnage perdait le geste
qu'il avait appris.

La leçon n'est pas sur les gestes : **un raccourci d'identifiant dans un contrôle
peut le rendre aveugle à son propre sujet**, sans rien casser et sans jamais
rougir.

### Trois suites nommaient une carte en dur

`accueil:ui`, `fanzzy:ui` et `matchs:ui` écrivaient `'G1'` comme « le Fanzzy
illustré ». Ce dessin est parti — il montrait quelqu'un d'autre — et quatorze
contrôles sont devenus rouges en annonçant un défaut du jeu là où il n'y avait
qu'une hypothèse périmée dans le test.

Elles demandent maintenant **au disque** et au manifeste : un personnage
réellement dessiné, d'une lignée que le compte ne possède pas déjà, et pour
`matchs:ui` un qui sache faire « but », « encaisse » et « victoire ».

Un défaut plus subtil s'y cachait. `matchs:ui` lisait `FICHE.scene.etat()` après
l'apparition du bandeau, et ne passait que parce que le Fanzzy d'essai n'avait
**aucune image d'état** : sans rien à jouer, la scène restait sur l'état logique
indéfiniment. Avec un personnage dessiné, elle joue son but et revient au repos
bien avant la lecture. On **attend** l'état au lieu de le lire — « il est passé
par là », qui est la vraie promesse : un but fait tressaillir le personnage, il
ne le fige pas.

---

## 4 tricies novies. La gloire des légendaires, et neuf communes

### Une légendaire se voit

Elle avait un halo doré, un anneau fin et huit pastilles. C'était juste, et ça
ne se voyait pas : à la taille d'une vignette de classeur, un anneau à trente
pour cent d'opacité sur du noir est du noir. Une légendaire tombe une fois sur
vingt boosters, et le décor ne le disait pas.

Ce qui le dit, c'est **la gloire** — vingt-quatre rayons en éventail derrière le
personnage, d'opacité alternée. L'alternance suffit à donner l'impression que la
lumière tourne **sans une seule animation**, ce qui compte : ce décor est dessiné
vingt fois sur une grille, et vingt rotations feraient ramer la page pour un
effet que personne ne regarde.

S'y ajoutent un anneau double et vingt éclats semés par la graine du personnage —
deux légendaires n'ont pas la même poussière, et c'est ce qui empêche le décor de
se lire comme un gabarit.

Le ciel est **mêlé** d'or, pas remplacé : une légendaire des REVENANTS garde son
violet de nuit, une des ÉPOQUES son ocre. Un ciel doré identique pour les douze
séries effacerait la série au moment précis où la carte est la plus regardée.

Premier jet trop fort : les rayons allaient jusqu'aux coins et noyaient le lieu.
Raccourcis de 96 à 72, opacité descendue d'un tiers, et le stade réapparaît sous
la lumière.

### Cinquante contre dix

LA TRIBUNE comptait quarante et une communes jouables — quarante-neuf au
catalogue, dont huit dépubliées parce qu'elles refaisaient un personnage du lot
de 2026 — en face de dix légendaires.

Neuf de plus la portent à cinquante : **TR60 à TR68**, et non les huit trous
laissés par les dépubliées. Un numéro attribué le reste ; le reprendre ferait
deux cartes différentes sous un même identifiant à un an d'intervalle.

Leurs gestes sont choisis pour ne pas déséquilibrer les familles — le geste
éponyme doit rester majoritaire chez chacune et aucune variante ne doit tomber
sous un huitième, ce que `catalogue:test` vérifie. Deux Voix en tempo, une
Percussion en martelage contre une en salves, et ainsi de suite.

Il a attrapé une collision au passage : `ATTENTION DERRIÈRE` a remplacé
`PARDON, PARDON`, déjà crié par L'Élan des Travées.

Vingt-sept cartes avec leurs âges, et la dette d'illustrations passe de 217 à
244. Pour une fois ce n'est pas une correction : **c'est du contenu ajouté**, et
c'est la seule autre raison admissible de relever ce cliquet.

---

## 4 quadragies. Le socle FAIT MAIN — tout se lit en plein jour

Le 30 septembre 2026, Gaël a choisi la direction de la refonte parmi trois
maquettées : **FAIT MAIN** — la bâche, le marqueur et le scotch —, NUIT DE MATCH
— projecteurs, fumigènes et tableau d'affichage — et LA CARTE EN MAIN — la carte
de collection au centre de chaque écran. FAIT MAIN fait de chaque écran un pan de
mur du kop : des bâches tendues, des stickers, des tampons, des tickets, et
l'écharpe comme seul dessin de jauge.

Rien de tout cela n'est dans cette session, et c'est voulu. Les trois directions
réclamaient le même préalable, le **lot 0** : un socle sans aucune matière
nouvelle — ni bâche, ni sticker, ni police. Il rend les vingt-quatre écrans
lisibles au soleil et homogènes au toucher, et il pose les outils dont les lots
suivants ont besoin. Ce qui se voit à la fin tient en trois phrases : tout se lit
en plein jour, tous les boutons réagissent pareil, les soldes comptent quand ils
changent.

### Pourquoi le socle passe avant la matière

Le hub était déjà un écran de jeu. Les vingt-trois autres étaient des listes
posées sur une photo de tribune : du texte gris entre 42 et 62 % d'opacité, des
panneaux translucides et floutés, et sur chaque page des boutons maison sans
cerne ni tranche. Poser une bâche sur un texte qu'on ne lit pas dehors, c'est
décorer un écran illisible — et c'est dehors, au stade, que ce jeu se joue.

La mesure a été prise **avant** de toucher une page, sur les vingt-trois visites
du lot et à trois formats. Au plus petit : 571 textes sous onze pixels, 689 sous
0,85 d'opacité effective, 103 éléments floutés, 204 textes qui perdaient leur
contraste au soleil. Deux briques communes en portaient une bonne part — le nom de
l'écran dans la barre (`h1.tbf-ou`) à 0,82 sur dix-huit écrans, la ligne
`.tbf-sous` à 0,62 sur neuf —, et trois écrans l'essentiel du petit texte : le
classeur de `/collection` (291, le nom des cartes à 9,5 px), `/boutique` (113) et
`/repetition` (51).

### Mesurer d'abord : l'audit étendu

Une promesse de lisibilité qu'on ne mesure pas se juge à l'œil, sur l'écran de
celui qui corrige — un écran d'intérieur, luminosité au maximum.
`scripts/audit-ui.mjs` a donc reçu quatre relevés :

| Relevé | Ce qu'il compte | Seuil |
|---|---|---|
| petit texte | tout texte visible, à sa taille **rendue** : une carte réduite par `scale` écrit plus petit que sa police | 11 px |
| opacité effective | le produit des `opacity` de l'élément et de tous ses ancêtres, multiplié par l'alpha de sa couleur | 0,85 ; 0,55 pour une mention légale |
| `backdrop-filter` | tout élément, pseudo-éléments compris, dont la valeur calculée n'est pas `none` | aucun |
| contraste au jour (`--jour`) | le contraste ordinaire, recalculé sous un voile blanc de 40 % — ce que fait le soleil à un écran | 4,5:1, 3:1 en grand texte |

La couleur seule ne disait rien : le jeu écrivait en craie pleine dans des blocs à
`.6`. Les mentions légales, et elles seules, ont droit à moins — `.legal` et
`[data-legal]`, une liste courte exprès : une tolérance qu'on étend pour faire
taire une alerte transforme un texte illisible en texte autorisé.

Le téléphone étroit est aussi un téléphone court. Il était mesuré à 800 pixels de
haut, c'est-à-dire avec cent soixante pixels qu'aucun téléphone modeste n'a — et
c'est dans ceux-là que tombent le bouton principal et la dernière rangée d'une
arène. Il l'est maintenant à 640 : les trois formats sont 360 × 640, 400 × 800
et 768 × 1024.

L'audit écrit tout en JSON (`--json`) et prend une capture par page et par format
(`--captures`). Il ne rougit jamais : il mesure, il ne juge pas.

### Cinq garde-fous qui se lisent dans le texte

Ce qui se lit sans navigateur est tenu par `npm run pages`, parce qu'une règle
qu'une seule passe de correction a fait respecter revient au premier écran qu'on
ajoute. Aucun `backdrop-filter` — la déclaration, la propriété de script, le nom
passé à `setProperty`. Aucun émoji cadenas ou coche, **écritures détournées
comprises** : `&#10003;`, `\2713` en CSS, `\u2713` en script, parce que c'est la
forme que prend l'émoji chassé qui revient, et `/aide` l'écrivait déjà ainsi.
Aucun `.calc(`. Un `data-ton` sur chaque rail d'onglets, ceux des gabarits de
chaîne compris.

Chaque fichier est lu **débarrassé de ses commentaires**, lignes conservées pour
que le numéro annoncé soit le bon. Chaque faute corrigée est expliquée dans un
commentaire qui la cite, et un contrôle qui se déclenche sur sa propre
documentation apprend surtout à ne plus l'écrire. Une expression régulière n'y
suffit pas — deux barres obliques vivent aussi dans une adresse, et un gabarit
peut en contenir un autre —, d'où un petit lecteur qui avance caractère par
caractère. Un cinquième contrôle garde les quatre autres : le code sans ses
commentaires doit compiler exactement comme l'original, script par script. Si le
lecteur se trompait sur une barre oblique, il blanchirait du vrai code, et les
quatre contrôles deviendraient verts sur ce qu'ils ne lisent plus.

Posés avant les corrections, ils relevaient **29 fautes sur 54 lignes** — la
preuve qu'ils voient ce qu'ils doivent voir. Ils sont à zéro à la fin.

### Ce qui a changé

**Rien sous onze pixels, rien sous 0,85.** Le nom de l'écran passe à la craie
pleine ; `.tbf-sous` à 0,94, avec son propre panneau peint en `::after` dans son
rembourrage — la ligne tombait là où le voile redescend vers 54 %, c'est-à-dire à
même la tribune. Les rubriques du tiroir passent de 8,5 px à 42 % à 11 px à 88 %,
l'étiquette des tuiles de 7,6 à 11 px. Le numéro de version, « discret au point de
ne se lire que si on le cherche », se lit : ceux qui le cherchent sont justement
ceux à qui l'on demande « quelle version as-tu ? ». La mention légale de la
vitrine remonte de 0,32 à 0,6. La jauge commune (`.tbf-jauge`) et celle du
souffle au Virage font dix pixels de haut.

**Aucun panneau flouté.** `--panneau` passe de 72 % translucide et flou à 94 %
opaque. Le flou se recalculait à chaque image sous tout ce qui défile — un écran
de liste en portait des dizaines — et au soleil il ne protégeait rien. Les voiles
qui comptaient sur lui foncent pour faire le même travail : 88 % sous le menu et
sous la boîte de confirmation, 94 % sous la fête de niveau, 88 % dans le creux des
onglets ; et le haut du voile de page tient 88 % jusqu'au treizième de l'écran,
là où vivent le nom, le sous-titre et le rail. **Aucun mot n'est plus posé à même
la photo** : `/bienvenue` pose chaque mot de la cérémonie sur un panneau ou une
pastille, `/classement` sa carte « ma place » et sa liste.

**Une seule façon d'être un bouton.** Les boutons maison — `.gros`, `.buy`,
`.dbtn`, `.bt`, `.filt`, `.vitr-*`, ceux restés au style du navigateur — prennent
`.tbf-plaque` et un `data-ton`. Les anciennes classes restent dans le balisage
quand le script les interroge ; seules leurs règles de peinture sont parties. Les
commandes de jeu gardent leur géométrie : le pavé, les cartes jouables, les
épreuves. `#b1`, le tout premier bouton de `/bienvenue`, n'avait ni l'un ni
l'autre et s'affichait au style du navigateur.

**Les onglets au ton de l'écran.** Tous les onglets actifs étaient dorés, alors
que l'or veut dire acheter et légendaire, et que le hub donne déjà sa couleur à
chaque porte. Les seize rails portent le ton de leur écran — flare pour jouer,
bleu pour posséder, vert pour le foot, violet pour les gens, or pour acheter,
craie pour soi —, et l'onglet actif le prend par héritage, la face foncée pour
les quatre tons à encre claire (voir plus bas). L'or ne reste que comme filet de
sécurité. Sur `/fanzzy`, DECK quitte le rail : un onglet qui emmène sur
une autre page ment sur ce qu'il fait. Il devient une plaque à côté du rail, avec
la flèche qui sort.

**Des icônes au trait au lieu d'émojis.** Le cadenas, la coche et la flèche sont
des masques de `ui.css` (`.tbf-ico-*`) qui prennent la couleur du texte et
mesurent un cadratin. Un émoji se dessine avec la police du téléphone — en couleur
ici, en noir là — et jamais au trait comme le reste du jeu.

**La couleur d'une carte est celle de sa rareté.** `/bienvenue` avait sa propre
table, par sorte : l'or pour un Fanzzy, le violet pour l'équipement. Le premier
paquet apprenait donc un code que tout le reste du jeu contredit, et faisait
prendre sa première commune pour une légendaire. Son récapitulatif montrait en
outre l'identifiant interne à neuf pixels — `a-fumigene`, `TR57` — ; il montre le
nom.

**Le décor revient sur `/carnet` et `/teletext`**, dont la colonne portait un
dégradé opaque par-dessus la photo. Ce qui s'y lit a reçu son panneau.

**« Installer l'application » passe dans le tiroir.** Sur l'accueil, elle prenait
une ligne à chaque visite pour un geste qu'on ne fait qu'une fois, et poussait le
bouton d'entrée les jours où elle paraissait. Les trois cas sont gardés : le
bouton quand le navigateur sait installer, la consigne sur iPhone, rien dans une
application déjà installée.

**Les soldes comptent.** `FX.compter` fait défiler un chiffre jusqu'à sa nouvelle
valeur et finit par un bref éclat ; `FX.voler` fait partir un gain de sa source
vers son compteur. Un chiffre qui saute de 120 à 75 se lit comme une erreur
d'affichage, un chiffre qui descend se lit comme une dépense. Ils sont branchés
sur la bourse du hub — qui se souvient, par compte, de ce qu'elle affichait —, le
solde de la boutique après un achat, la bourse du kiosque, les écharpes des
doublons qui volent de chaque carte vers leur compteur, le pot d'un KOP et
l'emplacement acheté sur le profil. Pas sur la fiche d'un Fanzzy, et c'est écrit
là-bas : elle n'affiche aucun solde. Deux règles tiennent le contrat : un second
appel sur le même élément arrête le premier — deux boucles qui écrivent le même
chiffre se le disputeraient —, et tout finit par une minuterie, jamais par la
seule fin d'une animation, qu'un onglet caché gèle.

**Des nœuds qui durent.** Le Virage et le duel réécrivaient en `innerHTML`, à
chaque message — jusqu'à dix fois par seconde —, la rangée des cartes, les effets,
l'équipe et la main. Rien ne pouvait vivre dedans : un portrait remplacé tous les
dixièmes de seconde ne respirait jamais, un doigt posé sur une carte relâchait sur
sa remplaçante, et un dessin absent se redemandait au réseau à chaque vue.
`accorder()`, écrite de la même façon dans les deux pages, crée chaque élément une
fois, le retrouve par sa clé et le modifie en place. Même rendu, mêmes classes,
mêmes identifiants.

**Le mode calme.** Trois interrupteurs au bas du tiroir — couper les sons, les
vibrations, les animations décoratives —, parce que les raisons ne sont pas les
mêmes : le son dans le train, les vibrations la nuit, les animations quand elles
fatiguent. La clé `tbf-calme` est recopiée sur `<html data-calme>` par `fx.js`
**et** par `menu.js`, deux copies qui doivent rester identiques : `/bienvenue`
charge le premier sans le second, et le menu, chargé tout de suite, pose la
marque avant que `fx.js`, différé, n'arrive — les braises de `nav.js` la relisent
à chaque étincelle sans l'attendre. L'ancienne clé du bouton de son du duel est
reprise une fois, puis retirée — qui avait coupé le son ne doit pas l'entendre
revenir parce que la préférence a changé de nom. Les barres de temps et les
chiffres restent : ce sont des informations.

**Une donnée absente retire sa ligne, jamais un tiret.** Un « — » se lit comme un
nom illisible ou comme une panne ; les tirets de repli sont partis, du score du
fil au Virage au compte de la collection sur le hub. Et quatre petites dettes :
`/compte` annonçait encore « Le kiosque et les duels arrivent bientôt » ;
`classement.html` avait deux blocs `<style>` identiques, `teletext.html` un bloc
qui ne contenait qu'un commentaire, et `amis.html` une ligne orpheline — voir
plus bas.

### Les pièges du lot

**Un point devant `calc`, et le navigateur se tait.** `0 .calc(4 * var(--u))`
n'est pas une petite longueur, c'est une valeur invalide : la déclaration entière
est jetée, sans un mot en console. `cartes.css` en portait cinq, reste d'une
conversion qui avait mangé le zéro de tête — le nom des cartes n'avait aucune
ombre, la pastille non plus, l'anneau de rareté du pied n'existait pas, et les
losanges n'avaient ni écart ni arrondi. La carte s'affichait presque comme prévu.
Le garde-fou en a trouvé **un sixième** que personne n'avait cité, dans
`fanzzy.html` : le cadenas du classeur flottait sans relief.

**Une ligne orpheline a mangé la règle d'en dessous.** Dans `amis.html`, l'ancien
habillage des onglets avait été retiré en laissant sa dernière ligne, un
`box-shadow` sans sélecteur. Le navigateur l'a lue comme le début d'un sélecteur
qui courait jusqu'à l'accolade suivante — celle de la pastille des demandes — et a
jeté le tout. La pastille n'a jamais été peinte ; l'onglet affichait
« DEMANDES1 ». Aucun contrôle ne voit cette forme-là.

**Le nom promis était déjà pris.** Le contrat appelait `.tbf-compte` l'éclat d'un
compteur. C'était le nom de l'épreuve du compte : ses règles, écrites sur la même
classe, auraient passé chaque solde de la boutique en grille pleine largeur le
temps d'un éclat, et gonflé son chiffre à soixante pixels. C'est l'épreuve qui se
renomme, `tbf-ep-compte`, comme ses sœurs `tbf-ep-jauge` et `tbf-ep-note` — même
collision, même remède.

**Onze pixels se paient ailleurs.** Relever un plancher déplace des choses
qu'aucune règle ne nomme :

- à onze pixels, « CLASSEMENT » ne tenait plus dans une tuile de cinquante-huit :
  la tuile a rendu sa marge et son espacement, et le rail de l'accueil ne descend
  plus sous soixante-quatre. Les deux valeurs se tiennent, et `ui.css` comme
  `index.html` le disent ;
- l'étiquette posée sur une carte, passée de huit à onze pixels, débordait des
  deux côtés d'une vignette : elle a le droit de passer à la ligne, et n'est plus
  centrée par `left:50%` ;
- au Virage, le geste de chaque carte à onze pixels faisait monter la rangée de la
  main de 104 à 138 pixels, tous pris à la corde, seule partie élastique de
  l'écran. Un nom qui ne s'écarte du coût que sur sa première ligne — un flottant
  d'une ligne de haut au lieu d'un `padding-right` sur toutes —, des interlignes
  serrés, et elle retombe à 115 à 360 × 640 ;
- un libellé trop long pour un téléphone s'écrit en deux formes, « TA TRIBUNE »
  et « TOI », « TOUT COMPTE DOUBLE » et « TOUT ×2 », et la longue reste pour les
  lecteurs d'écran. Elle était éteinte par une police de zéro pixel, que l'audit
  mesurait — à raison — comme un texte illisible.

Trois contrôles ont dû suivre, et chacun protège toujours ce qu'il protégeait.
`virage:ui` retranchait le `padding-right` pour savoir où s'arrête le nom d'un
chant, et a rougi sur les cinq cartes : il lit maintenant les lignes du texte, et
seules celles qui sont en face du coût doivent s'arrêter avant lui.
`boosters:ui` attendait qu'une carte trois fois plus large ait un nom trois fois
plus grand, ce que le plancher rend impossible : il mesure au-dessus du plancher,
et vérifie le plancher à part. `tour:ui` comptait comme coupés les libellés
masqués à l'œil : il écarte ce motif-là, et lui seul.

**Éteindre sans pâlir, mais pas n'importe comment.** Les états hors service
passent de l'opacité à `filter: grayscale() brightness()` : une carte éteinte
garde son prix, qui est la raison pour laquelle elle est éteinte. Mais un
`brightness(.62)` sur toute une ligne assombrit sa craie comme une opacité de
62 % : au Virage, « TERMINÉ » retombait sous le seuil, et le filtre a quitté le
texte pour les blasons et le cadre. **L'audit ne voit pas ce cas** : il compte
`opacity` et `filter: opacity()`, pas `brightness()`.

**L'audit se trompait de visite.** Son premier passage mesurait `/bienvenue`
comme le hub — le joueur d'essai, déjà installé, y était renvoyé à l'accueil —, la
vitrine avec le cookie de session de la page d'avant, et soixante-quinze écrans
depuis une seule adresse, que le garde de débit du serveur voit comme un seul
joueur. Chaque visite a maintenant son propre contexte de navigateur et sa
propre adresse (`X-Forwarded-For`), et `/bienvenue` est vu par un nouveau venu. Deux pièges
d'outil en chemin : sous Git Bash, `/virage` arrive à Node réécrit en chemin
Windows (`MSYS_NO_PATHCONV=1`) ; et `--captures /tmp/avant`, qui commence par une
barre oblique, était pris pour une page à visiter. Le genre « sous le décor »,
enfin, était relevé depuis toujours et jamais imprimé.

**Une suite rouge à cause de l'heure.** Le dernier passage des suites a eu lieu
entre minuit et deux heures, et `abo:smoke` a rougi trois fois, sur les quotas du
jour. Aucun fichier du lot n'y est pour rien : la suite sème ses lignes avec
`new Date()` à travers un pool en `timezone: 'Z'`, donc en UTC, alors que le
serveur écrit `NOW(3)` et compte `>= CURDATE()` dans le fuseau de MySQL, celui de
Zurich. Entre minuit et deux heures en été — une heure en hiver —, les lignes « du
jour » de la suite sont d'hier pour la base. C'est le piège « semer comme le
serveur écrit » d'`ETAT.md` § 2, une deuxième fois ; la correction est dans la
suite, hors de ce lot. La preuve est venue d'elle-même : relancée seule à une
heure et demie, elle rougit encore sur les trois mêmes ; à deux heures pile —
minuit en UTC, quand les deux horloges retombent sur le même jour —, elle est
verte, 77 contrôles.

### La relecture qui n'était pas arrivée

Chaque périmètre du lot a été relu par quelqu'un qui ne l'avait pas écrit, et un
script remettait les constats de chaque relecture au correcteur de son périmètre.
Deux relectures ne sont jamais arrivées : celle du socle CSS (`ui.css`,
`cartes.css`, `fanzzy-fiche.css`) et celle de `fx.js` et `menu.js`. Leurs
relecteurs avaient écrit le nom du périmètre suivi de la liste de ses fichiers
entre parenthèses ; le script cherchait le nom seul, ne l'a pas reconnu, et n'a
rien dit. Les vérifications qui ont suivi sont restées vertes, et c'était
attendu : elles éprouvaient ce qui avait été corrigé, pas ce qui ne l'avait pas
été. L'écart s'est vu après coup, et une reprise a traité ces constats sur le
lot déjà vérifié. Le piège est en `ETAT.md` § 6.

**L'étiquette d'une carte tombait sur son nom.** C'était une régression du lot.
Le plancher de onze pixels fait passer le nom d'une vignette sur deux lignes, et
l'étiquette d'état ou de tenue (`.tbf-etiq`), calée sur une ligne de nom, se
posait sur la seconde : 9,8 pixels de recouvrement sur une carte de 86, 8,5 sur
une carte de 151. Les 753 noms du catalogue ont été mesurés en Oswald, avec les
vraies feuilles : à 86 pixels, 72 % tiennent sur deux lignes, 44 % à 105, 9 % à
140, 4 % à 150. L'étiquette remonte maintenant d'une ligne de nom
(`--lignes-nom`) sur une carte de 140 pixels ou moins, par une requête
`@container` sur `.fz`, et laisse deux à trois pixels d'air au-dessus d'un nom de
deux lignes.

Ce n'est qu'un pis-aller, parce qu'aucune largeur ne dit combien de lignes prend
un nom. Il reste deux cas recouverts : trois lignes sous 100 pixels (3,5 % des
noms à 86), deux lignes entre 141 et 182 (moins de 9 % à 141, 1,2 % à 165). La
correction juste est dans `cartes.js` : poser l'étiquette dans le bandeau du nom,
`.top`, dont la hauteur suit le vrai nombre de lignes. La variable et la requête
partiront avec.

**L'onglet actif ne se lisait plus au soleil.** Prendre le ton de l'écran, c'était
aussi prendre la face vive et l'encre claire des plaques de ce ton, avec un
libellé de onze à douze pixels et demi. Le ton est gardé, mais la face fonce,
jusqu'à la tranche de la plaque ou presque. Il y a une règle par ton à encre
claire, et un ton nouveau de ce genre devra avoir la sienne. L'audit range ce
fond parmi les dégradés, qu'il ne mesure pas : l'onglet a donc été mesuré à
part, à la formule de l'audit et aux pixels d'une capture, qui concordent à un
dixième près.

| Onglet actif, sur l'aplat, avant → après la reprise | à l'intérieur | au soleil |
|---|---|---|
| flare | 3,91 → 8,28 | 2,31 → 3,32 |
| vert | 3,31 → 8,84 | 2,00 → 3,19 |
| bleu | 3,55 → 9,90 | 2,05 → 3,33 |
| violet | 4,48 → 10,55 | 2,29 → 3,46 |

L'or d'avant le lot faisait 11,17 et 3,56. Au soleil, 4,5:1 est hors d'atteinte
pour une face qui garde sa couleur : même du blanc sur du noir n'y fait que 5,74,
et 3,5 est le plafond pratique. Les plaques elles-mêmes, aux quatre mêmes tons,
ont la même faiblesse, entre 3,3 et 4,5:1 à l'intérieur et vers 2:1 au soleil.
Les corriger, ce serait changer la table des tons de toutes les plaques du jeu.
C'est une décision de palette, laissée à Gaël.

**Sur `/deck`, l'or n'achetait rien.** ENREGISTRER et AJOUTER AU DECK étaient
restées dorées, alors que rien ne s'achète sur cet écran et que composer son
deck, c'est posséder. Elles passent au bleu, et leur libellé de treize pixels y
perd : 3,55:1 sur la face, 2,05 au soleil, contre 11,17 en or. C'est la même
décision de palette qu'au-dessus. Trois ors restent
en attente d'arbitrage, parce qu'aucun n'est une plaque d'action : le halo de la
colonne de `/deck`, repris du classeur voisin ; l'encart du prochain emplacement
de deck ; et, sur `/boosters`, la plaque de la série choisie, un sélecteur au ton
d'un écran doré.

**Le reste, plus petit, et tout mesuré :**

- le symbole de rareté passe au plancher, `max(11px, …)` : il faisait 5,4 pixels
  sur une carte de 151 ;
- et il réapparaît. Une règle de `cartes.css` qui cachait le dernier `span` du
  pied cachait aussi la dernière marque de rareté : la commune n'avait aucun
  losange, la rare un sur deux, l'épique et la légendaire une pastille vide. La
  règle est partie, et un commentaire dit pourquoi aucune ne doit plus viser ce
  `span` ;
- la jauge du pavé passe de cinq à dix pixels. En pleine largeur, elle coupait le
  bas du pavé rond : elle devient une corde sous le texte, à 18 % des bords et
  13 % du bas, où le cercle garde 67 % de sa largeur ;
- la rangée d'actions de la fiche réserve sa vraie hauteur, 81 pixels — la plaque
  de deux lignes, sa tranche, ses marges — au lieu de 74. Elle en mesurait 74, 79
  ou 81 selon ses boutons, et la scène au-dessus bougeait d'autant ;
- les liens du tiroir passent de 39 à 44 pixels, comme ses interrupteurs, et les
  boutons de la boîte de confirmation aussi, qui tombaient à 39 ou 40 avec la
  police de repli ;
- « Installer l'application », quand elle paraissait, ouvrait le pied du tiroir à
  la place de l'Aide, qui doit l'ouvrir : quelqu'un de perdu ne lit pas le menu
  jusqu'au bout. Elle passe après. Et quand elle se cache, sur Android, après
  l'installation, le focus qu'elle tenait va à « Mon profil » au lieu de retomber
  sur la page, tiroir ouvert ;
- « Couper les animations » promettait plus que ce que coupe la facette : les
  barres de temps restent, un solde se pose sur sa valeur au lieu de défiler. Le
  libellé devient « Couper les animations décoratives », sur deux lignes à
  360 pixels, dans une ligne de 55 ;
- deux gardes de `cartes.css` sur l'éclat de la barre de progression ne faisaient
  rien : la barre n'existe que sur `/fanzzy`, qui la garde lui-même et l'emporte à
  spécificité égale. Elles sont parties ;
- la documentation de `TBF_BARRE` dans `nav.js` décrivait une bourse partie avec
  les jetons ; elle dit ce qui reste.

Deux commentaires, hors du périmètre des correcteurs, disent encore le contraire
du code : celui de `cardHTML`, dans `cartes.js`, cite la règle du dernier `span`
qui n'existe plus ; celui de `fanzzy.html`, vers la ligne 74, renvoie à la garde
de `cartes.css` qui vient de partir.

### Ce que la mesure dit après

| Relevé, vingt-trois visites (360 × 640 / 400 × 800 / 768 × 1024) | avant | après |
|---|---|---|
| texte sous 11 px | 571 / 571 / 586 | 0 / 0 / 0 |
| opacité effective sous 0,85 | 689 / 689 / 710 | 0 / 0 / 0 |
| `backdrop-filter` | 103 / 103 / 103 | 0 / 0 / 0 |
| cible sous 44 px | 25 / 29 / 29 | 0 / 0 / 0 |
| texte coupé | 188 / 107 / 221 | 0 / 0 / 0 |
| contraste perdu au soleil | 204 / 204 / 207 | 73 / 73 / 72 |

Débordement, élément hors cadre, erreur de script, image cassée ou sans `alt`,
refus 429 : zéro avant, zéro après. `/admin` et `/diagnostic`, hors lot, n'ont
plus de flou non plus.

Le soleil n'est pas fini. `/repetition` passe de 58 à zéro, mais `/profil` en
garde 34 et `/aide` 20, la vitrine 6, puis trois au plus par écran. Deux hausses
apparentes ne sont pas des reculs. Sur `/teletext` et `/carnet`, des textes posés
à 50 % d'opacité sur le dégradé opaque de la colonne — que l'audit ne sait pas
mesurer — le sont maintenant sur le décor, à 88–90 % : leur contraste réel a
monté, et il est enfin mesuré. Et un panneau légèrement teinté — un
`linear-gradient` posé sur `var(--panneau)` — est compté « sur dégradé » et non
mesuré : c'est un angle mort de l'audit, pas une baisse de lisibilité.

### Éprouvé

Les quatre contrôles de livraison sont verts, garde-fous compris. Le dernier
passage de `tout-tester`, après la reprise, compte cinquante-huit suites — l'audit
y est entré — et 3 309 contrôles en dix-huit minutes, dont cinq d'audit, contre
3 302 au départ. Aucune suite n'en a perdu : `accueil:ui` en a gagné pour
l'installation, `menu:smoke` pour le mode calme, `boosters:ui` pour le plancher
du nom. `abo:smoke` y a rougi pour l'heure, ci-dessus, et repasse au vert,
relancée seule, à deux heures. Trois restent rouges, qui l'étaient déjà au
départ, à l'identique : `deck:ui` (jsdom n'injecte pas `mods.js`), `nvn:ui` (la
flèche de retour du duel dans un contexte neuf) et `fanzzy:smoke`
(`tenuesParAge`). La reprise n'a fait rougir aucun contrôle, et aucun ne lit le
ton des plaques de `/deck`.

L'audit étendu a chargé ses vingt-cinq visites au premier essai, à trois formats
chacune, sans un refus. Après la reprise, il redonne le tableau ci-dessus relevé
par relevé, sans un sélecteur apparu ni disparu. Le tiroir a été vérifié à part,
à 320, 360 et 400 pixels de large : ses vingt et un liens font au moins 44
pixels, il défile sur un petit écran, l'Aide ouvre son pied, et le focus passe
bien à « Mon profil » quand l'installation se retire.

Les captures à 360 × 640 de l'accueil, de la vitrine, de `/bienvenue`,
`/boosters`, `/fanzzy`, `/virage`, `/teletext` et `/carnet` ont été regardées :
aucun texte qui informe à même la photo, aucun débordement.

**Hors de ce lot, et c'est la suite :** les bâches, les stickers, les tampons, les
tickets, Permanent Marker, la jauge-écharpe, les tuiles à états, la bulle du
Fanzzy, le moment fort unifié, le tunnel, le HUD de match, et toute route serveur
nouvelle.

---

## 4 quadragies semel. La matière FAIT MAIN — la plaque devient une bâche

Le lot 0 avait rendu les vingt-quatre écrans lisibles sans leur donner de
matière. Le lot 1 la pose, le même 1er octobre 2026, et presque tout entier dans
un seul fichier : `public/ui.css`. Il ne refait aucun écran — le hub, le
kiosque, la fiche, les arènes sont les lots 2 à 6 —, il change ce que **sont**
les briques communes. Les vingt-quatre écrans changent donc de matière le même
jour, par ce qu'ils ont en commun : le mur derrière tout, le panneau calme, la bâche qui succède à la plaque, l'écharpe qui devient la seule jauge,
et un vocabulaire d'objets — sticker, tampon, ticket, scotch, bulle, fumée,
pochoir, forme de rareté — rangé pour les lots suivants. Trois tuiles de grain,
calculées, donnent à tout cela son béton, sa toile et son papier.

Le travail a été partagé comme au lot 0. La matière, le vocabulaire et le grain
ont été écrits en même temps par trois sessions, chacune sur ses fichiers, puis
le vocabulaire a été collé dans `ui.css`. Ont suivi cinq passages de
vérification, avec entre le troisième et le quatrième une critique visuelle des
captures et une relecture adverse du code.

### Pourquoi une bâche, et pas une plaque

La plaque avait donné un objet à une interface plate : un cerne, une épaisseur
dessous, un enfoncement au doigt. Elle l'avait fait avec la lumière des jeux
mobiles qu'on prenait pour modèle — un haut de face plus clair, une face bombée,
un coin coupé comme une plaque vissée : du plastique. FAIT MAIN garde l'objet et
change sa matière. Un kop ne fabrique pas de boutons bombés ; il peint des
bâches, les tend au mur et les scotche.

La bâche tient en quatre choses, sous les mêmes classes (`.tbf-plaque`,
`.tbf-case`, `.tbf-bloc`, `.tbf-grande`) et avec les mêmes états :

1. **la toile** : une face pleine du ton, la tuile de toile par-dessus, et un
   filet de craie d'un pixel pour arête. Plus aucun dégradé de lumière : une
   toile tendue est plate ;
2. **le cerne au marqueur** : un trait d'encre irrégulier, une image SVG fixe
   posée en `border-image`, en trois tracés (`--trace-a` à `--trace-c`) tirés
   par `:nth-child` pour que deux voisines ne tremblent pas pareil. Il est posé
   **hors** de la boîte (`outset`), là où était le cerne d'avant ;
3. **l'ombre dure** : une ombre d'encre nette, décalée à droite et en bas, qui
   prend exactement la place de la tranche. Elle descend de `--epaisseur` —
   cinq pixels, six sur la grande —, et ses deux pixels d'étalement couvrent ce
   que couvraient la tranche et son cerne. La direction dessinait une ombre de
   quatre pixels : un pixel d'air serait apparu sous chaque bâche ;
4. **le coin déchiré** : un triangle de mur posé sur le coin bas-droit, avec un
   trait d'encre sur la déchirure. **Peint**, jamais découpé : un `clip-path`
   aurait coupé l'ombre et le cerne avec le coin.

C'est ce qui permet de changer de matière sans changer de mise en page : le
cerne ne prend pas un pixel à la boîte, l'ombre tient la place de la tranche à
épaisseur égale. Sur le premier jet de la feuille, les rectangles de tous les
éléments de vingt-deux pages ont été comparés entre l'ancienne et la nouvelle, à
360 × 640 et à 768 × 1024 : aucun écart, hormis les boîtes englobantes des
objets tournés.

La matière bruyante n'est pas pour tout le monde. **Ce qui se touche est une
bâche ; ce qui se lit reste calme.** `.pan`, le panneau des textes et des
listes, prend le grain du mur et rien d'autre — ni cerne, ni ombre, ni rotation
—, parce qu'un écran où tout est en relief n'a plus de hiérarchie. Le cadre
(`.tbf-cadre`) est la bâche qu'on regarde en arrivant ; le vocabulaire est ce
qui dit un état, un verdict, une rareté. Un budget tient l'ensemble : par écran,
au plus une bâche grande, trois stickers hors des listes, un ticket, une bulle et
une nappe de fumée ; deux pseudo-éléments par objet, pas un de plus ; trois
animations infinies, toutes comptées.

### Neuf hypothèses, faute d'arbitrage

Le brief en donnait trois. Six autres ont été prises en route, chaque fois que la
direction, la maquette ou le brief demandaient une chose que la mesure refusait,
ou se contredisaient. Aucune n'est tranchée : toutes attendent Gaël. Chacune tient
dans un bloc de `ui.css` qui dit pourquoi et comment la défaire, et l'en-tête de
la feuille les liste toutes les neuf, avec la section qui porte chacune, pour
qu'aucune ne se perde dans quatre mille lignes.

| | Ce qui est fait | Pourquoi | Pour la défaire |
|---|---|---|---|
| H1 | les faces vives foncent : flare `#B8321F`, vert `#197450`, bleu `#2F63B4`, violet `#6545AE` | la craie n'y tenait qu'entre 2,95 et 4,19:1 ; elle y tient 5,16, 4,96, 5,08 et 6,01 | les quatre lignes de la table « les tons », rendues à `var(--flare)`, `var(--vert)`, `var(--bleu)`, `var(--violet)`. C'est la seule table des faces : stickers et étiquettes suivent |
| H2 | l'or ne bouge pas : sa face `#F5C33B` lettrée d'encre, ses trois emplois sans achat laissés en attente au lot 0, le petit texte doré de la vitrine | ce sont des décisions de palette, réservées depuis le lot 0 | rien à défaire ; changer l'or, c'est la ligne `[data-ton=or]` de la même table, puis ses emplois un par un |
| H3 | Permanent Marker n'est chargée par aucune page ; seule la pile `--marqueur` existe | aucune page ne l'emploie encore : la pile attend les lots suivants, et retombe d'ici là sur l'écriture manuscrite du système | charger la police dans les pages du lot qui l'emploiera |
| H4 | `.pan` et le cadre gardent la teinte de `--panneau`, et non le parpaing à 92 % de la direction | sur le parpaing, la craie pleine tombe à 3,8:1 au soleil, contre 4,5 : voir « Le grain rend l'audit aveugle », plus bas | `rgba(35,41,48,.92)` à la place de `var(--panneau)` dans `.pan`, et la règle de la face du cadre retirée — après avoir mesuré ce que chaque écran pose dessus |
| H5 | le rail des onglets reste le creux noir du lot 0, au centième près | les onglets éteints sont du texte posé à même le rail : la craie à 94 % y tient 4,61:1 au soleil, 3,56 sur le parpaing | `rgba(35,41,48,.92)` en fond du rail, après avoir mesuré les onglets de chaque écran |
| H6 | les arènes gardent le voile à 75 %, et non à 60 comme le hub | `nav.js` pose `.dense` sur tout écran qu'il décore, et la feuille ne sait pas reconnaître une arène avant lui ; leur colonne est opaque, le mur ne s'y voit qu'au-delà de neuf cents pixels | que `nav.js` ne pose pas `.dense` sur un écran de jeu |
| H7 | les scotchs ne vont qu'à la bâche principale, et non à chaque `.tbf-bloc` | la direction le dit ; trois blocs à la file — l'abonnement, la répétition, l'aide —, ce sont six rubans, un mur de stickers | un `.tbf-bloc::before` à côté de celui de `.tbf-grande`, et quatorze pixels au-dessus de chaque bâche qui en reçoit |
| H8 | au calme, la nappe de fumée reste, fixe, à 20 % | la direction l'écrit ainsi ; le brief la voulait coupée. Aucune page ne pose encore de fumée | `display:none` à la place de `opacity:.2` dans les deux blocs du calme |
| H9 | la bande du haut des pages de contenu reste du noir du lot 0 : 92 %, puis 88 % jusqu'au treizième de l'écran | voir « L'audit lit `body`, l'œil lit le mur », plus bas | les deux premiers arrêts du dégradé en `rgba(15,18,22,…)`, une fois les titres d'écran posés sur leur scotch, ou mesuré ce qui reste nu |

H1 a un revers que la table ne dit pas : au soleil, la craie ne tient que 2,4 à
2,6:1 sur ces faces. Aucune face qui garde sa couleur n'y atteint 4,5, le lot 0
l'avait déjà mesuré sur les onglets. La critique visuelle a proposé de les
éclaircir jusqu'à la limite de 4,6:1 — `#C53623`, `#1A7953`, `#3269BE`,
`#7A52CF` —, parce qu'à 5 ou 6:1 les portes du hub tournent au feutre sombre.
C'est à soumettre avec H1, pas à faire en aveugle.

### Ce qui a changé

**Les jetons.** Quatre matières rejoignent les huit couleurs, qui ne changent
pas : `--parpaing` (`#232930`, le béton qu'on n'a pas peint), `--encre`
(`#07090C`, le trait du marqueur), `--kraft` (`#C9A66B`, le papier qu'on lit) et
`--scotch` (la craie à 42 %). Puis les huit dérivés de l'amendement 17, pour les
fonds où les tons vifs ne se lisent pas : `--vert-encre`, `--vert-fonce`,
`--rouge-fonce`, `--or-encre` et `--gris-encre` sur la craie et le kraft,
`--flare-clair`, `--bleu-clair` et `--vert-clair` sur le parpaing. La règle va
avec : une teinte absente de cette liste n'a pas sa place dans une matière. Les
tuiles de grain, les trois tracés du cerne et les deux rubans de scotch sont des
jetons du même `:root`, le seul de la feuille.

**Le mur.** Le voile de page devient du béton (`--beton`) grainé, à travers
lequel passe la photo de tribune : 75 % sur les pages de contenu, 60 % sur le
hub — son milieu n'était voilé qu'à 28 % —, avec 92 % sur ses quatre-vingt-dix
pixels du haut. La photo n'est jamais un support de texte. Le grain est porté
par ce voile, et jamais par `body`, qui reste presque noir (voir les pièges).

**Le panneau calme.** `.pan` prend la tuile du béton par-dessus `--panneau`
(H4), perd son filet de lumière et passe de quinze pixels d'arrondi à huit,
ceux de la maquette. Le liseré de craie à 10 % reste : il ne se lit pas comme
une épaisseur, et le retirer ôterait deux pixels à chaque panneau.

**La bâche.** Les quatre choses plus haut, et ses états. L'enfoncement descend
de son épaisseur, l'ombre plaquée contre elle ; à animations réduites et au
calme, elle s'assombrit de 12 % au lieu de s'enfoncer. Hors service, elle
redevient du parpaing sous une trame d'encre, avec le gris sur l'icône, et son
lettrage reste à la craie pleine : la maquette le passait à 70 %, sous le
plancher de 0,85 du lot 0. Le lettrage est en craie pleine avec une ombre dure
d'encre d'un pixel — deux sur `.tbf-bloc` —, en encre et sans ombre sur l'or et
la craie. La pastille (`data-pastille`) est un sticker du ton, bord de craie,
cerne d'encre, quatre degrés de travers.

**La bâche principale.** `.tbf-grande`, une par écran, porte l'écharpe en tête,
peinte en couche de fond ; deux scotchs aux coins hauts, du dessin de
`.tbf-scotch`, en image, dans le même `::before` que le coin ; et un repos de
travers de −0,8°, par la propriété `rotate`, qui se compose avec l'enfoncement au
lieu d'être écrasée par lui. On la trouve sur l'accueil — le hub et la vitrine —,
au bilan du duel et sur l'abonnement.

**Le cadre.** `.tbf-cadre` devient une grande bâche neutre : toile, cerne, coin
déchiré, ombre dure de trois pixels qui tient dans l'écart que les pages laissent
autour de lui, et l'écharpe en bande haute quand on la lui demande
(`data-echarpe`), en couche de fond. Il ne rogne plus son contenu. Sur le hub, il
n'en reste qu'un : AUJOURD'HUI, avec son écharpe ; COLLECTION, posé au même poids
à côté, est devenu un panneau calme, à la place exacte de l'ancien cadre.

**Les onglets.** L'onglet actif est une petite bâche du ton de l'écran : toile,
cerne, ombre de trois pixels qui tient dans les cinq du rail, un degré de travers
— et non le degré et demi de la maquette : sur une tablette, un onglet fait
quatre cent quarante pixels, ses bouts tournés sortiraient du rail, et celui de
`/teletext`, qui défile, prendrait un ascenseur. Pas de coin déchiré : l'onglet
rogne son contenu pour l'ellipse. Les faces foncées du lot 0 restent, à plat. Le
rail reste un creux noir (H5), et le cerne comme l'ombre de l'onglet actif s'y
fondent.

**L'étiquette.** Une valeur qu'on ne touche pas devient un sticker craie : fond
de craie, chiffre à l'encre, bord de craie, cerne d'encre, −2° et +1,5° pour la
voisine. Elle est mate, comme le sticker de la maquette, et un état — le statut
du deck — s'y écrit comme un tampon plein : la craie, et le mot en
`--rouge-fonce` ou `--vert-fonce`. Sa matière est écrite une fois, avec celle de
`.tbf-sticker`. Sur `/boutique` et `/boosters`, les jetons de monnaie sont de ces
stickers, et leurs dessins passent à l'encre de leur couleur : `--or-encre` et
`--rouge-fonce`, parce que l'or vif ne tenait que 1,4:1 sur la craie.

**Le menu et la flèche.** `nav.js` les monte en `.pan`, et le panneau calme leur
donnait sa matière : un carré grainé sur vingt-deux écrans quand le hub pose une
bâche au même endroit, et deux carrés mouchetés sur le noir des arènes. Ce sont
des objets qu'on touche : ils deviennent des bâches de parpaing, cerne, ombre de
trois pixels et coin déchiré, sans une ligne de `nav.js`. Leur cerne est peint
**dans** la boîte, à la place du liseré du panneau : dehors, il aurait mordu sur
ce que certains écrans posent au ras de la barre.

**L'écharpe, seule jauge du jeu.** `.tbf-jauge` devient l'écharpe nouée, sous le
même balisage qu'avant (`<div class="tbf-jauge"><i style="width:…"></i></div>`) :
un rail de parpaing de douze pixels cerné d'encre, le tricot à 115° avec un
trait d'encre entre les deux couleurs, un nœud de craie avec son reflet au bout
du remplissage, deux franges rayées qui pendent, et des crans facultatifs
(`data-crans`, de 2 à 10). Le nœud a remplacé une oblique, qui se lisait
« interdit » (amendement 21). La jauge est posée sur le panneau COLLECTION du
hub, sur `/collection` (le total et chaque type) et sur le classeur de `/fanzzy`,
dont la barre d'or bombée et son reflet en boucle sont partis — une animation
infinie de moins. `.tbf-echarpe` prend le même tricot et deux bouts frangés, les
écharpes du titre et du sous-titre d'écran un cerne d'encre au lieu d'un halo
doré. Et `.tbf-anneau`, nouveau, enroule le même tricot autour d'un avatar,
rempli à `--p` : aucune page ne le pose encore.

**Collé au mur.** Un objet fabriqué peut arriver « collé » (`.tbf-colle`) : un
peu trop grand et de travers, il se plaque et revient à sa rotation de repos en
220 ms, avec un rebond ; la bâche principale descend de douze pixels en se
posant. `--d` décale l'arrivée d'objet en objet. Les classes sont facultatives,
et chaque mouvement a ses deux doubles, animations réduites et calme.

**Le vocabulaire.** Écrit à part, collé dans `ui.css` comme une section à elle,
« LE VOCABULAIRE FAIT MAIN », et employé par **aucune page** : il attend les
lots 2 à 6. Le sticker (`--rond`, `--live`) ; le tampon, en contour sur un fond
sombre à partir de 16 px, plein en dessous et toujours sur le kraft
(amendements 15 et 16), et plein de lui-même dans un ticket ; le ticket kraft aux
bords déchirés, et la déchirure seule ; le scotch ; le marqueur, jamais sous
16 px ; la bulle de BD ; la nappe de fumée du quart bas, coupée sous
`prefers-reduced-data` et sous `html[data-economie]`, qu'un script posera pour
`saveData` ; la bouffée de fumigène, qui remplace la tache de
peinture (amendement 1) ; le pochoir, à partir de 20 px ; la forme de rareté
(`data-rar`), un rectangle, un rond, une étoile, un éclat, aux couleurs de rareté
inchangées (amendement 20) ; et les mouvements `.tbf-glisse`, `.tbf-clac`,
`.tbf-vibre`, `.tbf-respire`. Chaque bloc commence par son balisage exact et ses
raisons, amendements compris. Sa rotation de repos passe partout par `--rot` et
la propriété `rotate`, jamais par `transform`, et c'est ce qui permet à un seul
`.tbf-colle` de coller n'importe quel objet. Ses tons se lisent dans la table de
la bâche : défaire H1 les défait aussi.

**Le grain.** `scripts/grain-images.mjs` (`npm run grain`) calcule trois tuiles
de 256 pixels avec `sharp`, jamais avec `feTurbulence`, qui se recalcule à
chaque peinture sur chaque surface. Calculées sur un tore, elles se raccordent
sans couture ; le hasard est semé, et deux passages écrivent les mêmes octets.
Ce sont des voiles d'une seule teinte par famille de grain, posés sur la couleur
de la feuille : le béton, un sable clair et des creux noirs d'un pixel, pour le
mur et le panneau calme, et une seconde fois en 512 pixels (`beton@2x`) pour les
écrans denses ; la toile, une armure fil dessus fil dessous en voile noir, pour
les bâches ; le papier, des fibres brunes, pour le kraft. En WebP, le béton pèse
8,4 Ko (33,6 à 512), la toile 5,7, le papier 6,3 ; l'AVIF n'existe que pour le
papier (6,2 Ko), voir les pièges. Le PNG, sans perte comme le WebP, reste en
dernier recours, comme pour toute image du jeu (`VISUELS.md`).

**Les pages.** Le lot ne touchait qu'aux briques communes, mais six pages ont
suivi. L'accueil, pour son duo du bas : COLLECTION en panneau calme avec sa
jauge-écharpe, AUJOURD'HUI seul cadre et son libellé rouge en `--flare-clair`
(4,45:1 en flare plein sur cette toile, 8,2 en clair). `/collection` et
`/fanzzy`, qui posent la jauge commune à la place de la leur, et laissent sous
elle la place des franges : le contenu de `/collection` descend d'environ treize
pixels, celui du classeur de trois, exprès. `/boutique` et `/boosters`, pour les
dessins de leurs stickers. `/bienvenue`, dont le refus s'écrit en
`--flare-clair`. Et deux commentaires de `fanzzy-fiche.css` devenus faux.
Aucun fichier `.js` n'a changé ; dans les pages, seuls les gabarits de
`/collection` écrivent un autre nom de classe pour leur jauge. Aucun
identifiant n'a bougé : `#collecBar` et `#progBar` sont toujours ceux que lisent
les pages et les suites.

### Les pièges du lot

**Une bâche sans ton était transparente.** La table des tons commençait par
`[data-ton]{…}`, qui ne s'applique qu'aux éléments **portant** l'attribut. Une
bâche sans ton n'avait donc ni face, ni lettrage : des variables vides, un fond
invalide, un objet transparent. Le bouton de menu de l'accueil a disparu ainsi —
à sa place, à sa taille, avec ses trois barres peintes en rien sur un fond de
rien. Aucune erreur, et aucun contrôle ne voit une couleur manquante. Les
valeurs neutres sont posées sur les classes de la bâche, et la table ne fait que
les remplacer.

**`--encre` voulait dire deux choses.** Les plaques appelaient `--encre` la
couleur de leur propre lettrage — de la craie sur une plaque rouge —, quand la
direction appelle encre le trait du marqueur. Un sticker posé sur une tuile
aurait pris de la craie pour son cerne, sans un mot. Le lettrage d'une surface
s'appelle désormais `--lettre`, et `--encre` est l'encre partout. Une page lisait
l'ancien sens : le menu de l'accueil peint ses barres en `var(--encre)`, devenu un
noir invisible sur le parpaing. Une règle de `ui.css`, plus précise, les rend au
lettrage ; la ligne de la page reste à corriger. C'est la famille de
`.tbf-compte` au lot 0, côté variables : le sticker prend `--taille` et non `--s`,
que la ola du Virage emploie déjà et qui s'hériterait.

**Retirer `overflow:hidden` a déplacé l'accueil.** Le cadre rognait son contenu
pour tenir l'écharpe dans son arrondi ; devenue un fond, elle n'en avait plus
besoin, et le coin déchiré devait mordre sur le cerne, hors de la boîte. Mais
`overflow:hidden` avait un second effet que personne n'avait écrit : dans une
grille ou une rangée flex, un élément qui rogne peut descendre à une largeur
nulle ; un élément qui ne rogne pas ne descend pas sous son contenu. Le cadre
COLLECTION s'est élargi pour contenir « 10/5510 », AUJOURD'HUI a passé son
sous-titre sur deux lignes, et le hub a repris la hauteur à ses tuiles.
`min-width:0` et `min-height:0` rendent la mise en page d'avant. Au passage, un
cadre posé sur un lien reprenait le bleu du navigateur : « COLLECTION » est sorti
un temps en bleu électrique.

**Le grain rend l'audit aveugle, et son compte s'améliore.** `scripts/audit-ui.mjs`
ne sait pas mesurer un texte posé sur une image de fond : il le range « sur
dégradé », hors du compte au soleil. Or toute bâche, tout onglet actif et tout
`.pan` portent maintenant une tuile. Au premier passage, `.pan` était en parpaing,
comme le veut la direction, et le compte au soleil **baissait**, de 73 à 71 à
360 × 640, pendant que la lecture baissait : une copie de l'audit qui remplace la
tuile par son voile moyen trouvait soixante-quinze textes de plus sous le seuil,
dont soixante et onze sur `/repetition` — la craie pleine à 3,8:1 au soleil sur
le parpaing, contre 4,5 sur `--panneau`. C'est l'hypothèse H4. **Quand « sur
dégradé » monte, un compte au soleil qui baisse ne prouve rien.**

**L'audit lit `body`, l'œil lit le mur.** L'audit compose un texte translucide
sur les fonds de ses ancêtres, puis sur celui de `body` ; le voile du mur, calque
fixe posé à côté de la colonne, n'en est pas un. Deux conséquences. Le fond de
`body` reste presque noir : au béton, une craie à 94 % passait de 4,63 à 4,19:1
au soleil, et une tuile de grain à cet endroit rendrait toute la page non
mesurable. Et un texte posé sans panneau sur le mur n'est mesuré juste que si le
mur, à cet endroit, est de ce noir. D'où H9 : sous le béton de la maquette, la
craie pleine du nom d'écran tombait de 4,74 à 4,31:1 au soleil, et celle d'un
sous-titre à 94 % de 4,40 à 4,02, sans que l'audit puisse le voir. La maquette
n'avait pas ce problème : son titre d'écran est posé sur une bande de scotch.

**Un reflet sous le mot.** L'étiquette portait un reflet de vinyle, une bande de
craie à 16 % en travers, du tiers à la moitié de sa largeur — c'est-à-dire sous le
mot. La craie y retombait à 4,03:1 sur le rouge et 3,71 sur le vert : H1 défaite
exactement là où se trouve « INCOMPLET », le statut du deck, et l'audit ne mesure
pas un fond en dégradé. L'étiquette est devenue mate. Puis le relevé est tombé
sur la face foncée elle-même, maintenant mesurable : 2,6:1 au soleil. L'état
s'écrit donc en tampon plein, sur la craie, en lettres foncées : 6,82 et 6,75:1
à l'intérieur, 3,04 et 2,77 au soleil — sous le seuil encore, et c'est su :
dehors, seule l'encre passe 4,5 sur la craie, et un état à l'encre ne dirait
plus son ton que par son mot.

**Une animation qui écrit son arrivée écrase l'objet.** `@keyframes tbf-colle`
finissait sur `opacity:1` : un tampon en contour, posé à 0,92, sautait de toute la
différence à la dernière image. Les deux entrées n'écrivent plus que leur départ,
et l'animation revient d'elle-même aux valeurs de l'objet. Même famille : la
variante de la grande bâche, écrite `.tbf-grande.tbf-colle`, pesait deux classes
et l'emportait sur la règle à une classe qui coupe l'entrée à animations réduites
— la grande bâche descendait quand même de douze pixels. Elle pèse une classe
(`:where`). **Une variante ne doit jamais peser plus que la règle qui l'éteint.**

**Fabriquer n'est pas servir.** Le béton a été tiré une seconde fois en 512
pixels, parce qu'un écran dense agrandit la tuile de 256 deux à trois fois et
fait de chaque grain une tache floue. Le script et `VISUELS.md` l'ont dit servi
par la feuille de style pendant une partie du lot, alors qu'aucune adresse de
`ui.css` ne le demandait. C'est la faute qu'`ETAT.md` § 6 raconte pour les
Fanzzy — un contrôle de fichiers présents ne vaut rien sans un contrôle de
l'adresse demandée —, revenue sous une autre forme. `npm run grain` nomme
maintenant, à chaque passage, les tuiles qu'aucune adresse de la feuille ne
demande, commentaires retirés.

Le servir avait son propre piège. `--grain-beton` entre dans des fonds à
plusieurs couches — le mur avec son dégradé, le panneau avec sa couleur. Un
navigateur qui ne connaît pas `image-set()` sans préfixe (Chrome avant 113,
Safari avant 17) trouve, une fois la variable remplacée, une déclaration
invalide, et perd le voile du mur ou la couleur du panneau avec le grain : un
`var()` n'a de repli que pour un jeton **absent**, pas pour un jeton incompris.
Les deux tailles sont donc posées sous `@supports`, la forme préfixée d'abord, et
le jeton garde la tuile de 256 pour tous les autres. Le cadre suit la même règle
pour sa face : écrite en clair, parce qu'une teinte calculée par `color-mix` qu'un
navigateur ignore rendrait le fond entier invalide, et le cadre transparent.

**Une adresse servie « immutable » ne change pas de contenu.** `/img` part avec
un an de cache, et le service worker garde les images en cache d'abord. Les
tuiles ont changé plusieurs fois de recette sous les mêmes adresses pendant le
lot, la dernière fois à 18 h 37 : qui en avait reçu une plus ancienne l'aurait
gardée un an. Elles prennent `?v=2`, une adresse qu'aucune recette d'avant n'a
portée ; la prochaine prendra `?v=3`, sur les deux tailles si c'est le béton.

**Le premier béton était de la neige.** Des points blancs isolés, jusqu'à 19 %
sur 9 % des pixels, sans une ombre : sur un fond presque noir, un ciel étoilé, qui
ajoutait des étoiles aux bokehs de la photo de tribune et mouchetait les panneaux
sous le texte. La maquette le savait : son mur posait des points clairs à 3,5 %
**et** des creux à 28 %. Le béton a maintenant deux familles de grains d'un pixel
— un sable clair, serré et faible, jamais plus de 8 %, et des creux noirs, plus
rares, de 16 à 25 % —, et rien à l'échelle de la tuile : un premier essai avait des
nuages d'une vingtaine de pixels, qu'on voyait revenir en quinconce sur tout le
mur.

**L'AVIF qui efface le grain.** Le serveur envoie l'AVIF à tout navigateur qui
l'annonce, dès qu'un jumeau existe. Sur ces tuiles, l'AV1 sans perte pèse deux à
cinq fois le WebP ; avec perte, il efface le grain par blocs, et le bloc abîmé
revient tous les 256 pixels — un damier sur le béton à la qualité 60. Le script
ne l'écrit donc que s'il ne pèse pas plus que le WebP et ne change pas l'image, et
efface l'ancien sinon. Au dernier passage, seul le papier en a un.

**La jauge que personne ne posait.** Le brief croyait `.tbf-jauge` employée par
des pages ; aucune ne l'employait. Le hub, la collection et le classeur peignaient
chacun leur rail, gris ou d'or bombé, si bien que l'écharpe nouée, la seule
jauge du jeu, juste au banc, n'apparaissait sur aucun écran : c'est la critique
visuelle qui l'a vu, sur les captures. Elle y est posée telle quelle, et les
règles locales sont parties : un `overflow:hidden` local aurait coupé le nœud, et
un fond écrit dans la page, chargée après `ui.css`, aurait écrasé le tricot.
**Une brique commune n'existe pour le joueur que posée** : avant de compter sur
elle, la chercher dans `public/`.

**Ce qui déborde sans rien pousser demande de l'air à la page.** La matière
ajoute des objets hors de leur boîte : le nœud de la jauge monte de trois pixels
au-dessus du rail et ses franges pendent de neuf dessous, à qui les pages en
réservent dix ; les deux scotchs de la grande bâche montent de sept, et une
grande posée sous une autre bâche demande quatorze pixels entre elles ; le bord
et l'ombre d'un sticker ne comptent pas dans sa boîte. Rien ne leur réserve cette place, et c'est voulu — la mise en page
ne bouge pas —, mais chaque page qui les pose doit la laisser. Sur le hub, les
franges de COLLECTION passaient à 0,9 pixel du filet du bas, **par chance et non
par construction** : sans Oswald — une police lente à venir —, le panneau prend
sa propre hauteur, et elles le touchaient. Son rembourrage passe de 9 et 9 à 7 et
11, la somme ne bouge pas. Deux autres débords se sont vus en chemin : le scotch
du vocabulaire, à quatorze pixels de débord, sortait de l'écran une fois tourné
(il en déborde douze) ; et les franges, peintes au même plan que le nœud et avant
lui, n'en laissaient voir que deux tirets (elles passent par-dessus).

**Un constat confié à qui n'a pas le droit d'y toucher.** La critique visuelle a
relevé l'aveuglement de l'audit, au périmètre des suites. La consigne de ce
périmètre excluait justement `scripts/audit-ui.mjs` : le constat n'a pas été
traité. La règle qui le corrigerait a été éprouvée sur une copie de l'audit, hors
du dépôt (voir plus bas). C'est le piège du lot 0 retourné : la clé était fermée
et reconnue, mais elle menait à quelqu'un à qui l'on avait retiré le fichier.

### Ce que la mesure dit après

| Relevé, vingt-trois visites (360 × 640 / 400 × 800 / 768 × 1024) | fin du lot 0 | fin du lot 1 |
|---|---|---|
| texte sous 11 px | 0 / 0 / 0 | 0 / 0 / 0 |
| opacité effective sous 0,85 | 0 / 0 / 0 | 0 / 0 / 0 |
| `backdrop-filter` | 0 / 0 / 0 | 0 / 0 / 0 |
| cible sous 44 px | 0 / 0 / 0 | 0 / 0 / 0 |
| texte coupé | 0 / 0 / 0 | 0 / 0 / 0 |
| débordement, élément hors cadre | 0 / 0 / 0 | 0 / 0 / 0 |
| contraste perdu au soleil | 73 / 73 / 72 | 72 / 72 / 72 |
| textes mesurés | 1 052 / 1 050 / 1 073 | 1 052 / 1 050 / 1 073 |
| textes sur un fond que l'audit ne mesure pas | 644 / 642 / 650 | 725 / 723 / 732 |

Erreur de script, image cassée ou sans `alt`, refus 429 : zéro avant, zéro
après ; « sous le décor », deux relevés par format, sur `/admin`, hors lot, comme
avant. Les soixante-quinze visites ont chargé au premier essai.

Le compte au soleil bouge deux fois, et aucune ne change la lecture. `/deck`
gagne « INCOMPLET », le tampon plein ci-dessus : au lot 0, ce mot était sur un
dégradé que l'audit ne mesurait pas, et qui donnait 2,3:1 au soleil ; il en
donne 3,0. La vitrine perd deux relevés — « Ta tribune aussi. » et la ligne de
version, de l'or à 3,7:1 — qui ne sont pas corrigés : ils sont maintenant posés
sur le grain d'un panneau, donc hors de la mesure, et l'or ne bouge pas (H2).

**Le compte ne monte pas, mais il ne dit plus tout.** Quatre-vingt-un ou
quatre-vingt-deux textes de plus par format passent « sur dégradé » :
`/repetition` de 1 à 72, `/bienvenue` de 3 à 10, la vitrine de 1 à 7. La copie de
l'audit qui remplace chaque tuile par son voile moyen donne **123 / 123 / 122**
textes sous le seuil au soleil. L'écart avec
73 vient de lettrages de bâche : la craie sur les faces de H1, de 2,4 à 2,6:1 au
soleil, et sur le parpaing, 3,7 — des textes qui étaient au lot 0 sur les
dégradés des plaques, plus vifs, que l'audit ne mesurait pas davantage. Le hub en
porte onze, `/boosters` quinze ; `/profil` passe de 34 à 36, `/aide` de 20 à 26.
Entre les deux derniers passages, cette copie redonne les mêmes relevés un par
un : les dernières corrections n'ont rien dégradé de ce que le grain cache.

### Éprouvé

Les quatre contrôles de livraison sont verts : `npm run pages`, ses cinq
garde-fous compris (seize rails, tous au ton), `npm run cablage`, `npm run
promesses`, et `npm run pages:navigateur`, qui ouvre les vingt-quatre écrans sans
une erreur. Le dernier passage de `tout-tester` compte cinquante-huit suites et
3 312 contrôles en dix-sept minutes, contre 3 309 à la fin du lot 0. Trois
restent rouges, qui l'étaient avant le lot 0, à l'identique : `deck:ui` (un),
`nvn:ui` (trois), `fanzzy:smoke` (deux). `abo:smoke` est vert — lancé à 19 h 39,
loin de l'heure de son piège —, `accueil:ui` aussi, « l'écran ne défile pas »
compris.

Le vocabulaire, qu'aucune page ne pose, a été éprouvé sur un banc à 360 pixels :
quatre-vingt-quinze textes mesurés, aucun sous onze pixels, sous 0,85 ou sous son
contraste ; aucun débordement ; aucune déclaration jetée par le navigateur sur
quatre-vingt-trois règles relues ; et, après son entrée dans `ui.css`, ses seize
planches identiques au pixel près à celles d'avant le collage. Les tuiles ont été
vérifiées à leurs raccords, par mesure, et servies par le même `negocierAvif` que
le serveur : le papier part en AVIF à qui l'annonce, le béton et la toile en WebP
à tout le monde, `?v=` compris.

Les captures à 360 × 640 des vingt-cinq visites ont été regardées à côté de
celles de la fin du lot 0 : aucun écran cassé. Le hub ne défile pas, PRENDRE MA
PLACE est entier, ses scotchs tombent dans l'écart sous AUJOURD'HUI sans couvrir
son coin, le nœud et les franges de COLLECTION tiennent dans leur panneau à 360,
400 et 768 pixels.

### En ligne avant d'être fini

Le commit `9e90c90` (« Maj V01102026.1917 », 19 h 17) a pris le lot 0 et le lot 1
en cours de route, après la critique et la relecture, avant la dernière série de
corrections, et la production le sert depuis 19 h 21 environ : relevé à 20 h 18,
son `/ui.css` est celui du commit, octet pour octet. Il y manque les adresses
`?v=2` et le béton de 512, l'état du deck en tampon plein, les franges peintes
par-dessus le nœud et le rembourrage de COLLECTION qui leur fait place.
`A-DEPLOYER.md` dit ce qui reste à pousser.

### Ce qui reste

Les arbitrages d'abord : **H1 à H9**, avec la proposition d'éclaircir les faces de
H1. Puis, relevé par la critique et la relecture, et laissé en l'état :

- `scripts/audit-ui.mjs` : remplacer une couche `url(/img/grain/…)` par son voile
  moyen et poursuivre la pile avec la couleur dessous, puis compter ces relevés à
  part, pour que la comparaison avec la fin du lot 0 reste lisible. Sans cela,
  l'audit ne voit aucune bâche ;
- `scripts/verif-pages.mjs` : vérifier que chaque tuile nommée par `ui.css`
  existe en WebP et en PNG — une tuile manquante laisse la surface unie, sans que
  rien le dise ;
- `fx.js` et `menu.js` : poser `data-economie` sur `<html>` sous `saveData`, que
  seul un script peut lire, sans quoi la fumée ne se coupe pas pour qui économise
  ses données ;
- `index.html` : la règle `.burger span{background:var(--encre)}` à passer à
  `var(--lettre)` ;
- les jauges de `/aide` et de `/profil`, encore des rails plats ; « PRENDRE MA
  PLACE » sur `/bienvenue`, qui n'est pas la grande bâche qu'il est sur la
  vitrine ; les jetons du hub, qui ne sont pas encore des stickers (lot 2) ;
- la rotation de la grande bâche, un angle fixe qui fait dix à douze pixels de
  dénivelé sur une tablette ; l'arrondi de huit pixels de `.pan` à côté des
  panneaux des pages, de douze à seize ; la toile, qui dessine une vannerie sur
  l'or et la craie ; l'étiquette de l'étoile et de l'éclat, qui en couvre la
  moitié basse, à régler avant le lot qui posera les formes ;
- l'en-tête de `scripts/grain-images.mjs`, qui parle encore au futur du jour où
  `ui.css` servira le béton de 512 : elle le sert ;
- Permanent Marker (H3), et les comportements écrits en script : la bulle qui se
  replie en « ! », le son du tampon, le cran qui claque au franchissement, le
  retrait des classes d'animation à `animationend`.

**Hors de ce lot, et c'est la suite :** les écrans eux-mêmes, du hub (lot 2) aux
arènes.

---

## 4 quadragies bis. L'accueil FAIT MAIN — le hub, le rideau, la barre et le tiroir

Le lot 2 de la refonte refait, le 2 octobre 2026, les écrans que tout joueur voit
à chaque visite : l'accueil connecté — le hub —, l'écran d'ouverture qui le couvre
le temps qu'il se monte, la barre du haut des vingt-deux autres écrans et le
tiroir du menu. Il **emploie** la matière et le vocabulaire que le lot 1 a posés
dans `public/ui.css` ; il ne les réinvente pas. Ce qui se voit à la fin tient en
quatre phrases : les tuiles du hub disent ce qui les attend, le personnage
reprend 60 % de l'écran, on entre par un tunnel, et le menu est une bâche qu'on
déroule.

Le travail a été partagé comme aux lots 0 et 1, sur des clés de périmètre
fermées. La mesure d'abord, seule au travail avec la base ; puis les briques
communes dans `ui.css`, avec leur banc ; puis les écrans — le hub, puis le rideau
dans le même fichier, pendant que la barre et le tiroir avançaient à côté. Six
tours de vérification ont suivi, chacun avec l'audit étendu, et des corrections
par périmètre entre eux ; entre le quatrième et le cinquième, une critique
visuelle des captures, notée 7 sur 10, dont les constats importants ont été
corrigés. Les fautes du sixième tour ne l'ont pas été (voir « Ce qui reste »).

### Mesurer d'abord, cette fois sous le grain

Le lot 1 laissait l'audit aveugle à sa propre matière : toute bâche, tout onglet
actif, tout `.pan` porte une tuile de grain, donc une image de fond, et
`scripts/audit-ui.mjs` rangeait tout texte posé sur une image parmi les « sur
dégradé », hors de tout compte. Avant qu'on touche un écran, l'audit a appris à
lire à travers la tuile.

**Une tuile n'est pas une image comme les autres.** C'est un voile presque
transparent, d'une seule teinte, sans motif ni tache : sa moyenne est le fond
qu'on lit sous une lettre de onze pixels. La couche est donc remplacée par son
**voile moyen**, lu dans la page sur la tuile réellement servie — décodée, peinte
sur un canevas, moyennée pixel par pixel, la teinte pondérée par l'opacité —, et
la remontée continue jusqu'à la couleur posée dessous : la face de la bâche, le
panneau, le fond de la page. Le béton en `image-set` prend la tuile que le
navigateur choisit pour la densité de l'écran. Voiles relevés : la toile, 1,82 %
de noir ; le béton, 1,21 % de gris 124 ; celui de 512 pixels, 1,23 % de gris 121.

**Les vrais dégradés et les photos restent non mesurables** : leur couleur change
sous la lettre. Une seule exception, géométrique : une couche de dégradé posée
une fois, dans la boîte de remplissage, en pixels ou en pour cent, et dont le
rectangle ne touche pas la boîte du texte, n'est pas **sous** le texte — c'est
l'écharpe peinte au bord haut de PRENDRE MA PLACE et des cadres. La boîte du
texte est prise en pixels de mise en page (`offsetTop`), donc juste aussi sur une
bâche tournée. Tout ce qui ne se calcule pas à coup sûr — une position en
`calc`, un fond fixé, un texte qu'on ne situe pas — reste non mesurable : une
mesure fausse est pire que pas de mesure.

**Compté à part**, pour qu'un relevé d'avant se compare encore : `surGrain`,
`palesGrain`, `jourSurGrain` et `jourGrain`. « Sur dégradé » ne compte plus que
ce qui reste non mesurable — l'ancien vaut le nouveau plus `surGrain` —, et le
JSON passe au schéma `audit-ui/2`. La mesure s'est contrôlée elle-même sur
l'état de départ : mêmes textes sur les vingt-cinq visites et les trois formats,
ancien « sur dégradé » égal au nouveau plus `surGrain` page par page, comptes
sur fond uni inchangés. Elle n'a changé que l'angle mort.

Ce qu'elle a révélé, à 360 × 640 et hors `/admin` et `/diagnostic` : **142
textes deviennent mesurables** (725 non mesurables → 583), aucun ne manque son
seuil à l'intérieur, et **56 le manquent au soleil**. Le compte au soleil passe
de 72 à **128**. Par fond : vingt en craie sur le parpaing (3,7:1), huit sur le
rouge de H1 (2,6), six à l'encre sur l'or (3,8), quatre sur le violet (2,6), deux
sur le bleu et deux sur le vert (2,4), et les onglets actifs foncés, de 3,0 à
3,4. C'est l'hypothèse H1 chiffrée, et H2 à 3,8. Le hub en portait quatorze —
ses dix libellés de tuiles, PRENDRE MA PLACE, « 10/5510 », le cadre du direct —,
`/boosters` autant, ses treize séries en craie sur le parpaing. `/repetition`,
revenue sur `--panneau` à la fin du lot 1, a ses soixante et onze textes
au-dessus du seuil.

**Trois écrans qu'aucune route ne montrait.** L'audit attend que l'ouverture soit
partie avant de mesurer, et n'ouvre jamais le tiroir : deux des écrans les plus
vus, ceux que ce lot refait, n'avaient ni capture ni relevé. `--etats` leur donne
une visite neuve chacun : l'ouverture photographiée vers une demi-seconde, puis
photographiée et mesurée vers deux secondes — `tbf:pret` est retenu pour cette
seule visite, comme le retiendrait un serveur lent —, et le tiroir de
`/classement`, ouvert par son bouton, trouvé par `aria-controls`. Chaque état est
mesuré sous sa **portée** (`#ouverture`, `#tbf-tiroir`) et rangé à part dans le
JSON. Au départ : le rideau, trois textes sans défaut ; le tiroir, vingt-neuf
textes, dont cinq pâles au soleil — les intitulés de rubrique et la version, sur
le fond sombre de l'ancien menu.

`scripts/verif-pages.mjs` y gagne un garde-fou sans navigateur : chaque tuile
`/img/grain/…` que `ui.css` demande hors commentaires existe en WebP et en PNG,
et une feuille où le motif ne trouve plus aucune tuile fait rougir le contrôle.
Une tuile manquante laisserait la bâche unie, sans un message.

En cours de lot, l'audit a encore appris quatre choses, chacune venue d'un défaut
qu'il ne voyait pas : la police réellement employée (voir les pièges) ; la coupe
à la ligne de `line-clamp`, relevée à part sous « coupé (lignes) » et gardée par
un témoin qui vérifie, à chaque passage, que Chrome met encore en page les lignes
qu'il cache ; ce qu'un écran fixé pousse hors de la fenêtre (« hors fenêtre ») ;
et l'ouverture aussi à 320 × 568. Il sait enfin placer une couche peinte par un
élément non positionné : la feuille avait dû poser `position:relative` sur les
rubriques du tiroir pour lui seul. C'est à la mesure de suivre la page.

### Ce qui a changé

#### Le hub

**Le personnage reprend l'écran.** Le budget de l'amendement 14 lui donne 60 % de
la hauteur à 360 × 640 ; il en avait 312 pixels, 48,8 %. La bande du haut flotte
désormais au-dessus de la scène, et la réserve des gestes passe sous elle ; les
rails sont rangés par le bas et descendent de part et d'autre du nom ; les tuiles
sont plafonnées à 9,1 % de la fenêtre, 58 pixels à 640 ; la bande du bas tient
en 88 pixels et le bouton en 60. Mesuré au banc : 388 pixels, **60,6 %**, 67,5 %
pour un joueur sans Fanzzy, 75,4 % à 768 × 1024, et rien ne défile, de 320 × 568
à 768 × 1024.

**La bande du haut** est faite des briques communes. L'avatar-sticker de 44
pixels : le buste du Fanzzy qu'on montre aux autres, par `FZART.dessinAvatar`,
dans l'anneau d'XP rempli à `dans / pour` de `/api/niveau`, et le niveau collé en
bas (`#nivPastille` est gardé) ; sans Fanzzy, une silhouette, un « ? » et un lien
vers `/fanzzy`. La pastille dorée à l'initiale du pseudo est partie. Les deux
soldes deviennent des compteurs-stickers craie, qui comptent puis frémissent
quand ils changent.

**Les tuiles disent ce qui les attend**, par `data-etat`, trois au plus et dans
cet ordre : LIVE rouge sur VIRAGE quand le match d'un club suivi a commencé ; le
nombre en or, qui respire, sur BOOSTERS quand la réserve en a ; « +N » en craie
sur FANZZY pour les cartes arrivées depuis le dernier passage au classeur. Le
« 5496 » de FANZZY a disparu. Les cartes vues sont retenues par appareil
(`tbf.vus`, dans `localStorage`) : toucher FANZZY ou la bulle qui en parle, ou
ouvrir le classeur, les marque. La porte verrouillée — parpaing, icône éteinte
sous une croix de scotch, « NIV. N » à la place du nom, une secousse au toucher —
est écrite, mais ne paraît pas : aucun palier de `src/shared/niveau.js` n'ouvre
encore une page.

**Le bouton du menu porte l'état le plus urgent** du tiroir : le hub y pose le
direct, la réserve et le duel qui attend par `TBF_MENU.poser`, et `menu.js` en
tire le sticker — rouge, or ou violet.

**Le Fanzzy parle.** Une bulle au marqueur, à côté de sa tête, tirée de ce que la
page sait déjà : « Allez Sion ! », « Tes boosters t'attendent », « Choisis ton
Fanzzy »… C'est un lien vers ce dont elle parle. Le script tient les règles de
l'amendement 6 — pas un chiffre, pas plus de quatre mots, sinon une phrase de
repli plus courte. La bulle attend que le rideau se lève, se replie au bout de
six secondes en un sticker « ! » de 44 pixels qui la rouvre, et ne redit pas ce
que dit déjà la bâche du jour. Permanent Marker est chargée par l'accueil seul,
dans la même ligne qu'Oswald : c'est la fin de l'hypothèse H3.

**Le soir de match**, une bâche aux deux couleurs du club se tend derrière la
tête — les couleurs du blason, que le direct apporte ; sans elles, rien —, et la
nappe de fumée monte dans le quart bas de la scène.

**La bâche du jour** remplace AUJOURD'HUI : un cadre en kraft déchiré, l'écharpe
en tête, qui dit la seule chose à faire aujourd'hui, la première qui a ses
données — le match en direct ; le prochain coup d'envoi d'un club suivi, avec son
compte à rebours ; l'étape suivante des premiers pas, avec ce qu'elle rapporte ;
sinon « Répéter un geste ». Le prochain coup d'envoi vient de
`/api/football/feed`, une lecture en base, sans appel à l'API sportive, gardée
dix minutes dans l'onglet. Le rappel des premiers pas, qui paraissait au-dessus
du duo et le poussait d'autant, est entré dans le ticket : la bande du bas a
toujours la même hauteur.

**Le bouton principal dit ce qu'il fait** : « PRENDRE MA PLACE », et dessous
« Duel de tribunes » ; un soir de match, « ENTRER DANS LE VIRAGE » et le monde
dans les tribunes ; quand quelqu'un attend un duel, « 2 T'ATTENDENT », en violet
— il restait en or, la couleur de l'achat.

**Le « GOAL ! »** quitte le lettrage nu posé sur le personnage pour la case de BD
commune, celle du Virage et du duel, avec sa bouffée de fumigène, ses confettis
et son scotch qui se décolle. `FX.but` n'est plus appelé : il écrivait un second
« BUT ! » par-dessus la case, avec quatre-vingt-dix particules.

**La collection** affiche le palier en cours, « 14 / 25 », et non plus le total,
qui se lit comme un mur ; le total est dans l'étiquette du lien (amendement 22).

**Le rideau se lève après le premier tour de veille**, attendu huit cents
millisecondes au plus, et le signal part quoi qu'il arrive. Sans le direct, la
bâche du jour et la bulle se seraient peintes sur leur repli, puis auraient
changé sous les yeux du joueur.

#### L'ouverture

Le rideau qu'on voit en arrivant de dehors est devenu **le tunnel qui mène à la
tribune** : quatre pans de béton en perspective, dessinés en CSS — l'image
`tunnel.webp` reste à produire —, deux bâches unies aux murs, la photo du stade au
bout, et la lumière des projecteurs qui grandit pendant tout le plafond, par
l'échelle d'un pseudo-élément et jamais par un dégradé animé. Le titre est peint
à l'encre sur la bâche principale de la feuille commune, en craie, tournée de
−2°, avec son écharpe et ses deux scotchs ; « .ONLINE » en or sur un ruban
d'encre. Cinq Fanzzy montent les marches, et le dernier salue.

La jauge est l'écharpe commune, à trois crans, avec trois libellés par tiers du
plafond — ON OUVRE LES GRILLES, LES TRIBUNES SE REMPLISSENT, COUP D'ENVOI — et
sans pourcentage : elle suit le temps, pas un chargement. « TOUCHE POUR ENTRER »
paraît au plancher, à 1,2 s, et ce sont ses deux flèches qui clignotent, pas les
mots. Une astuce du jour, sur un ticket kraft, est tirée d'une table de douze
écrite en dur, sans un nombre réglable. Pas de marqueur sur le rideau.

**Les règles de sortie n'ont pas bougé** — une fois par session, le plancher, le
plafond de dix secondes, le toucher pour entrer —, et chaque morceau de décor est
dans son `try`. Le rideau est toujours peint avant qu'un seul script ne tourne :
en médiane sur cinq passages, scripts retenus, premier affichage à 228 ms avant
le lot et à 244 ms après. Sans `/ui.css`, il garde ses mots : chaque couleur qui
porte un texte a son repli écrit en clair, sous `:where()`.

#### La barre et le tiroir

**Le nom de l'écran est écrit à la craie sur un bout de gaffer**, un ruban toilé
noir déchiré aux deux bouts, à −1,5°, collé juste après la flèche ; il pousse à
droite le HUD et le menu.

**Le HUD replié** : pour un joueur connecté, hors des deux écrans de jeu, un
sticker rond de 36 pixels dans une zone de 44 — le buste, l'anneau d'XP, le
niveau. Au toucher, une bande kraft se déplie sous la barre avec les deux soldes,
trois secondes, et ne se replie ni sous le doigt ni sous le focus. À partir de
560 pixels, les soldes sont dans la barre à demeure — sauf sur `/boutique` et
`/boosters`, qui ont déjà leur bourse —, et le sticker mène au profil. Les
valeurs viennent de `/api/fanzzy/state`, la seule réponse qui porte le personnage
résolu par le serveur, et de `/api/niveau`. Elles sont gardées trente secondes
dans l'onglet, au nom du joueur, et le HUD prend ce qu'une page annonce par
`tbf:bourse` au lieu de relire derrière elle. Le hub y écrit ce qu'il a déjà lu :
le premier écran ouvert depuis l'accueil ne redemande rien.

**Le tiroir est une bâche de parpaing qu'on déroule depuis le haut**, en 240 ms,
en fondu au calme : plein écran sur un téléphone, six cents pixels au plus
au-delà. Il couvre la barre, donc il porte sa propre tête : le retour à
l'accueil, le mot MENU sur son gaffer, et une croix de 44 pixels qui reçoit le
focus à l'ouverture et le rend au menu en se rangeant ; la tabulation reste
dedans. Puis trois rubriques au pochoir, chacune soulignée de l'écharpe de son
ton, et sous elles des grilles de tuiles de 88 pixels avec leurs stickers d'état
— LIVE sur le Grand Virage, « 2 » violet sur le duel, « 4 » or sur les boosters ;
la page où l'on est porte un pointillé. Le pied — aide, installation, profil,
compte, administration, sortie, mode calme, version — est une liste calme, à
l'encre sur un ticket kraft. Les seize destinations, leurs adresses, leur ordre
et leurs libellés n'ont pas bougé, ni les identifiants que lisent les suites.
Sur `/virage` et `/duel-nvn`, rien ne change dans ce lot : leur bouton garde son
point rouge.

Les matchs du jour et l'abonnement ont reçu leur icône : ils empruntaient celles
du télétexte et de la boutique, et la grille les mettait côte à côte.

#### Les briques

Écrites une fois dans `ui.css`, chacune avec son balisage exact et ses doubles
`prefers-reduced-motion` et calme : les cinq états d'une tuile ; le sticker
d'urgence du menu ; l'avatar-sticker ; le compteur de monnaie, 44 pixels au doigt
et 32 à l'œil ; le HUD ; le cadre en kraft ; la case de BD unifiée ; la plaque
ronde — une zone de 44 et une face de 32 —, pour les flèches d'âge du hub ; la
banderole d'un nom ; la bâche du club ; la jauge qui suit le temps
(`data-suit`) ; la secousse d'un refus (`.tbf-secoue`) ; et le ticket de retour
et le toast, prêts mais posés par aucune page — aucune route ne nourrit encore le
retour. Les quatre faces vives sont devenues des jetons (`--face-flare`…) : un
sticker peint en pseudo-élément ne porte pas d'attribut, et la table de H1
aurait été écrite deux fois. `fx.js` gagne le refus d'une porte fermée, un tic
sourd et un buzz de huit millisecondes.

#### Les hypothèses

H3 est levée. Une **H10** est née et morte dans le lot : le titre de la barre sur
un scotch clair, qui tombait à 3,0:1 au soleil (voir les pièges). Une **H11** est
venue : le « ? » de l'avatar sans Fanzzy est au marqueur, comme l'écrit la
direction, alors que l'amendement 6 ne compte pas ce signe parmi les six
emplois. Et une question de palette s'ajoute à H1 : **le kraft ne porte aucune
encre à 4,5:1 au soleil**.

### Les pièges du lot

**L'audit mesurait tout dans la police de secours.** C'est la critique visuelle
qui l'a vu, sur les captures « après » : PRENDRE MA PLACE trop large, la bulle en
Segoe Print. Depuis le lot 0, chaque visite de l'audit envoie sa propre adresse
(`X-Forwarded-For`) ; posée par `setExtraHTTPHeaders`, elle partait aussi vers
Google Fonts. Un en-tête que CORS ne range pas parmi les simples fait précéder
chaque fichier de police d'une requête de contrôle, que Google refuse : Oswald et
Permanent Marker tombaient en échec sans un message. Et `document.fonts.status`
disait « loaded » quand même — il dit que plus rien ne charge, pas que tout a
chargé. Les largeurs, les retours à la ligne et les coupes de tous les relevés
d'avant ont donc été pris dans une autre police que celle du joueur, et le tiroir
a été mesuré tronqué là où le joueur le lit entier. L'adresse ne part plus que
vers notre serveur, la mesure attend les polices, et elle compte les textes lus
dans une police de secours (« police de repli »). Le service worker est contourné
pour une raison voisine : il refait ses requêtes lui-même, et elles seraient
toutes parties sous une seule adresse.

**Le soleil a tranché trois fois contre la maquette.** Le scotch clair du titre
de la barre, la craie à 26 %, éclaircissait le fond sous la lettre : 3,0:1 au
soleil, 2,5 pour le mot MENU sur le parpaing, quand le nom de l'écran tenait 5,1
à même le noir avant le lot ; aucun scotch clair ne fait mieux, il en faudrait
un à 5 % de craie qu'on ne verrait plus. Les rubriques du tiroir, dans leur ton,
tombaient de 1,7 à 2,6:1 — JOUER était le texte le plus pâle de tout l'audit. Et
les seize noms des tuiles du tiroir, sur les faces de H1, tombaient à 2,4–2,6:1,
quand ils tenaient 4,6 sur le fond sombre de l'ancien menu. La direction le dit
elle-même : « la lisibilité plein jour commande ». Le titre et les noms passent
sur un gaffer noir, 4,9:1 au soleil et 17 dedans ; les rubriques reviennent à la
craie, 3,7:1, et le ton passe à leur écharpe. Le ruban se voit par ses bords —
un reflet, un fil, une frange de trame aux deux bouts —, chacun posé hors de la
boîte du texte : l'audit lit l'encre seule sous la lettre. Les tuiles du hub
n'ont pas ce gaffer : à 58 pixels, elles n'ont pas les dix de rembourrage qu'il
prend.

**Le kraft ne se lit pas au soleil, et aucune encre n'y change rien.** Le papier
de la direction porte l'encre à 8,7:1 dedans, à 3,3 sous le voile blanc de
l'audit ; le noir pur n'y ferait que 3,6. Pour 4,5, il faudrait un papier aux
quatre cinquièmes vers la craie, `#ECE0CB`, à 1,13:1 de la craie : il n'y aurait
plus de kraft, et le sticker craie et le tampon plein qu'on y pose ne s'en
détacheraient plus que par leur cerne. Ce qu'on y écrit se pèse donc écran par
écran : en 700 à partir de 19 pixels, ou à partir de 24, un texte y passe le
seuil du grand texte ; une ligne courante, non. Le lot en pose trois que l'audit
lit : la bâche du jour, l'astuce du rideau et le pied du tiroir. La teinte du
papier attend Gaël.

**La case de BD rayait le mot qu'elle encadre.** Tournée de −1,6°, la vignette
est un contexte d'empilement : ses rayons, un `::before` en `z-index:-1`, se
peignaient par-dessus son propre fond, sous la lettre. Un masque les évide à
l'emplacement de la case.

**Le « GOAL ! » du hub passait par-dessus le menu.** La case commune est fixée sur
le document à 95, et tient quinze secondes ; un joueur qui ouvrait le menu
pendant ce temps la voyait couvrir la deuxième rangée de JOUER — qu'il touchait
sans la voir, puisque la case laisse passer le doigt. Le hub la pose juste sous
le voile du menu.

**Un geste qui tourne autour des pieds en enfonce un.** Le budget de 60 % a pris
les dix pixels qui restaient sous le personnage. Le coucou tournait autour du
milieu des pieds : une rotation abaisse l'un des deux bords de la demi-largeur
fois le sinus de l'angle, six à neuf pixels sur un téléphone, et la semelle
passait sous la bande. Il penche désormais (`skewX`), sans déplacer un point du
sol ; le rebond s'écrase sur place ; le saut s'étire depuis les pieds — étiré
depuis le milieu, il les abaissait au moment même où il décollait, de sept
pixels sur une tablette, de vingt sur une grande.

**Cinq animations infinies sur un écran qui en permet trois.** Le halo qui
pulsait, l'ombre au sol, le point du direct, le flottement et la respiration
tournaient chacun pour soi. Le halo et l'ombre ne bougent plus, le point est
parti avec le rouge qui ne tenait pas sur le kraft, et le flottement est entré
dans la respiration, en une seule animation : il reste le personnage, la fumée
et le sticker qui respire — la liste de la direction.

**Un sticker qui déborde se fait couper par le premier cadre qui coupe.** Celui
d'une tuile déborde de huit pixels, treize avec son bord et son ombre :
`.centre`, en `overflow:hidden` contre le rail de droite, les aurait rognés, et
rognait déjà le cerne et l'ombre des tuiles de ce rail. La bande déborde
maintenant de la marge du hub. Celui du bouton de menu tombait contre le bord de
l'écran : la rangée du haut s'en écarte de quinze pixels en haut et de quatorze à
droite.

**Le compte avait été fait à 360 pixels.** À 320, le titre de la barre perdait sa
place : « COMPÉTITIONS » et « ABONNEMENT » se coupaient, et « DIAGNOSTIC », dont
la page ajoute sa propre gouttière, alors qu'il tenait avant le lot — le HUD et
la bande, arrivés ensemble, lui avaient pris la place. La barre se serre une fois
sous 400 pixels et une seconde sous 340, sans toucher aux cibles. Le pied du
tiroir passe sur une colonne sous 350 pixels : « ADMINISTRATION » y débordait de
onze. Et le titre est en Oswald 600 et non 700 : quatre pages ne chargent pas la
graisse 700, que le navigateur aurait fabriquée en épaississant l'autre.

**Une coupe à la ligne réglée sur une seule police.** Les noms des tuiles du
tiroir étaient tenus à deux lignes, la limite d'Oswald. Mais à la première
ouverture, tant que la police n'est pas arrivée, et hors ligne — le service
worker ne garde pas les polices de Google —, la tuile prend le repli, plus large,
et « CLASSEMENT DES SUPPORTERS » se lisait « CLASSEMENT DES… ». Le nom n'est plus
coupé : la tuile a la place de trois lignes, et garde ses 88 pixels avec toutes
les polices essayées. L'audit ne voyait que l'ellipse sur une ligne ; il relève
maintenant la coupe à la ligne.

**Un contrôle qui vérifie une absence passe quand la page est partie.**
`accueil:ui` refermait le tiroir en touchant le voile en bas à gauche. Le tiroir
du lot 2 couvre tout l'écran d'un téléphone : le clic tombait sur une tuile, la
page partait vers `/classement`, et le contrôle, ne trouvant plus de tiroir
ouvert, passait. Il referme maintenant par la croix, puis par Échap, en vérifiant
chaque fois qu'on est resté à la même adresse, et ne touche le voile qu'à 1 024
pixels de large, après avoir prouvé par `elementFromPoint` que le point visé est
bien lui.

**La même chose dite deux fois, à vingt pixels.** Un soir de match, le ticket
écrivait « EN DIRECT · 47′ … 312 dans les tribunes » et le bouton, juste dessous,
« 47′ · 312 supporters » ; la bulle disait « Match ce soir » au-dessus de
« PROCHAIN COUP D'ENVOI ». La minute est au ticket, le monde au bouton, et la
bulle cède la phrase dont le ticket parle déjà. L'affiche du prochain coup
d'envoi, mise à la suite du compte à rebours sur une seule ligne, perdait le club
adverse en points de suspension : elle est dans le titre, qui a deux lignes.

**Un même endroit, deux couleurs.** Le tiroir peignait chaque destination au ton
de sa rubrique : le KOP et les amis, violets sur le hub, y passaient au rouge et
au bleu ; les boosters, la boutique et l'abonnement, or sur le hub, au rouge.
Une destination peut maintenant porter son ton, le même que sur le hub, et le
deck passe au bleu, parce qu'on le possède.

**Un match reporté garde sa date.** Le fil n'écarte que les matchs finis ou
annulés ; un match reporté, suspendu, arrêté ou gagné sur tapis vert allumait la
bâche du club, la fumée, « joue ce soir » et un compte à rebours. Ceux-là
quittent la liste, et une rencontre à l'heure provisoire (`TBD`, souvent minuit)
n'est jamais annoncée. Une réponse vide n'est gardée que quatre-vingt-dix
secondes, et non dix minutes (`ETAT.md` § 6).

**L'écharpe du rideau ne se nouait jamais.** Elle suit le plafond de dix
secondes, et l'écran part dès que l'accueil est prêt, entre une seconde et demie
et trois : on quittait le rideau sur une écharpe remplie au cinquième, et sur
« ON OUVRE LES GRILLES ». Quand l'écran part, elle finit désormais sa course en
trois cents millisecondes, sur « COUP D'ENVOI » — sauf au doigt, qui ne se fait
pas retenir. Sa transition d'une demi-seconde, faite pour un palier qui saute,
traînait derrière une largeur poussée à chaque image : d'où `data-suit`.

**Le HUD doublait la lecture la plus lourde du joueur.** `/api/fanzzy/state` lit
le portefeuille, la collection, les âges et la saison, et écrit en base quand la
réserve est pleine. Le kiosque et le classeur la font déjà en arrivant ; le HUD
la refaisait derrière eux. Il prend maintenant ce que la page annonce, et ne
relit que le niveau. Une page qui change le portefeuille sans l'annoncer laisse
le HUD en retard trente secondes : c'est à elle de relayer.

**Des noms déjà pris, encore.** Le compteur de monnaie s'appelle `.tbf-monnaie`
parce que `fanzzy:ui` interdit tout `.tbf-jeton` dans la barre. Le rideau vit
dans la même page que le hub, qui tient déjà `.scene` et `.entrer` : ses classes
sont `.troupe` et `.consigne`. Et son dernier Fanzzy salue par l'image clé
commune `tbf-coucou`, non par `coucou`, que `accueil:ui` compte pour savoir si
le hub a salué.

**Une fonction faite pour une page qui ne l'appelle pas.** Relevé en écrivant
cette trace. Pour rendre au but du hub sa secousse et sa vibration sans le second
titre, `fx.js` a reçu `FX.but({ vignette: true })`, et son commentaire dit
qu'`index.html` l'appelle. Il ne l'appelle pas : le but du hub n'a plus que sa
corne. C'est le piège de la jauge du lot 1, avec une fonction : la brique
existe, personne ne la pose.

### Ce que la mesure dit après

L'état de départ est celui du commit `4acf953`, mesuré le matin avec la lecture
sous le grain ; la fin, le sixième tour, sur les fichiers mêmes qui sont en
ligne.

| Relevé, hors `/admin` et `/diagnostic` (360 × 640 / 400 × 800 / 768 × 1024) | départ du lot 2 | fin du lot 2 |
|---|---|---|
| texte sous 11 px, opacité sous 0,85, flou, débordement, hors écran, cible sous 44 px, coupé | 0 / 0 / 0 | 0 / 0 / 0 |
| pâle à l'intérieur, sur fond uni et sous le grain | 0 / 0 / 0 | 0 / 0 / 0 |
| pâle au soleil, sur fond uni | 72 / 72 / 72 | 74 / 74 / 74 |
| pâle au soleil, sous le grain | 56 / 56 / 55 | 53 / 53 / 52 |
| textes lus sous le grain | 142 / 142 / 143 | 139 / 139 / 140 |
| textes encore non mesurables | 583 / 581 / 589 | 574 / 572 / 580 |
| textes | 1 052 / 1 050 / 1 073 | 1 067 / 1 065 / 1 120 |
| coupé (lignes), relevé nouveau | — | 15 / 3 / 45 |
| police de repli, relevé nouveau | — | 1 / 1 / 1 |

Le fond uni gagne deux relevés, la bâche du jour du hub sur son kraft, à 3,3:1 :
« PREMIERS PAS · 0/6 » et « Ton premier Fanzzy ». Les textes en plus sont le
niveau du HUD sur chaque page de contenu, et à 768 pixels ses deux soldes, dans
la barre — un seul de plus sur `/boutique` et `/boosters`, qui gardent les leurs
dans la page. Les quarante-cinq coupes à la ligne sont toutes sur `/collection`,
que le lot ne touche pas : le nom des vignettes y est tenu à deux lignes, et le
nom entier est dans leur `title`. La police de repli est un faux positif, plus
bas.

**Le hub** passe de vingt-quatre textes à vingt et un, de deux non mesurables à
zéro, et au soleil de 0 + 14 à 2 + 11. **Le vrai compte reste à quatorze** :
PRENDRE MA PLACE, à 2,6:1, n'est pas corrigé, il n'est plus mesuré. L'audit ne
lit le contraste que sur un élément sans enfant, et le bouton porte maintenant
son sous-libellé dans un `<small>`. Les dix libellés de tuiles restent entre 2,4
et 3,8:1 (H1, H2).

**Les états.** Le rideau à deux secondes passe de trois textes à huit, aux trois
formats et à 320 × 568 : rien hors de la fenêtre, rien qui déborde, rien de
coupé, et deux textes pâles au soleil, ceux du ticket de l'astuce, à 3,3:1 sur le
kraft. Le tiroir de `/classement` passe de vingt-neuf textes à trente, dont trois
sous le grain, et de cinq pâles au soleil à deux : MODE CALME et la version, sur
le kraft du pied. « CLASSEMENT DES SUPPORTERS » s'y lit en entier.

Tout cela est mesuré en Oswald et en Permanent Marker, pour la première fois :
les relevés de départ, comme ceux des lots 0 et 1, l'avaient été dans la police
de secours.

Au banc, sans base, ce que l'audit ne dit pas. Le hub ne défile pas à
360 × 640, dans six scénarios simulés, ni à animations réduites ni au calme ; au
plus trois animations infinies, aucune au calme ; au plus trois tuiles en état. Sur les vingt-deux écrans et à quatre largeurs, aucun titre de barre coupé
ni recouvert. Le tiroir tient l'écran à 360 × 640 et défile en lui-même : il fait
1 283 pixels de haut. Le rideau part à 1 640 ms quand l'accueil est prêt, au
plancher quand on le touche à 300 ms, à 10 122 ms quand rien ne le congédie, et
ne revient ni au rechargement dans la même session ni en arrivant d'une autre
page du jeu.

### Éprouvé

Les quatre contrôles de livraison sont verts : `npm run pages` (soixante-dix-sept
contrôles, quatre tuiles de grain en WebP et en PNG), `npm run cablage`,
`npm run promesses` (avec son avertissement connu, six pages sans suite
d'interface) et `npm run pages:navigateur`. Le dernier passage de `tout-tester`,
le 2 octobre de 18 h 07 à 18 h 27, compte cinquante-huit suites et 3 376
contrôles, contre 3 312 à la fin du lot 1, sans un rouge nouveau ni une
intermittence. Trois restent rouges, qui l'étaient avant le lot 0, à
l'identique : `deck:ui` (un), `nvn:ui` (trois), `fanzzy:smoke` (deux).
`abo:smoke` est vert, lancé à 18 h 08. `accueil:ui` compte 211 contrôles.

Quatre suites ont suivi un comportement voulu par le lot, et chacune garde son
sens. `accueil:ui` : les états des tuiles — « aucun bouton d'état » vise
désormais tout `data-etat` qui ne serait pas un état de tuile lu dans `ui.css` —,
la bulle, la bâche du jour, le rideau, l'avatar, le tiroir qu'on referme.
`fanzzy:ui` : le HUD, de 320 à 768 pixels. `tour:ui` : le total de la collection,
qui ne s'affiche plus mais se dit, dans l'étiquette du lien. `virage:ui` : le but,
dont la couleur du club borde la case et dont le mot est à la craie.

### En ligne

Le lot 2 est dans deux commits de Gaël, `4c07044` (« Maj V02102026.1638 ») et
`7dc5464` (« Maj V02102026.1828 »), poussés. La production sert le second depuis
18 h 29 environ : relevé à 18 h 48, `ui.css`, `nav.js`, `menu.js`,
`ouverture.js`, `fx.js` et `fanzzy.html` sont ceux du commit, octet pour octet, et
l'accueil aussi, aux estampilles `?v=` près. Le commit a été pris pendant le
sixième tour de vérification, mais après la dernière modification des fichiers
du lot, à 18 h 00 : ce tour a vérifié exactement ce qui est en ligne. Seuls les
trois documents ne sont pas commités.

### Ce qui reste

Les arbitrages d'abord : **H1, H2, H4 à H9 et H11**, et la teinte du kraft. Puis
les quatre fautes du dernier tour, relevées et non corrigées :

- `scripts/audit-ui.mjs` ne mesure le contraste que sur les éléments sans
  enfant : PRENDRE MA PLACE et ENTRER DANS LE VIRAGE, 2,6:1 au soleil, sortent du
  compte depuis qu'ils portent un sous-libellé. Il faudrait mesurer ce qui porte
  un texte à soi, comme le font déjà le petit texte et l'opacité ;
- son relevé « police de repli » se trompe dès qu'un texte contient Œ ou œ
  (voir `ETAT.md` § 6) : « LE COUP D'ŒIL », sur `/repetition` ;
- à 320 × 568, la bulle du hub couvre la tuile DUEL pendant ses six secondes, et
  un toucher sur DUEL ouvre la destination de la bulle ;
- à 320 pixels, la bâche du jour coupe « PROCHAIN COUP D'ENVOI » et souvent sa
  ligne du moment ; le raccourcissement a été réglé sur 360.

Puis :

- `index.html` : appeler `FX.but({ pour: true, vignette: true })` à côté du
  moment du but, ou retirer la variante et son commentaire ;
- la vitrine n'émet pas `tbf:pret` : un visiteur garde le rideau dix secondes s'il
  ne le touche pas. C'était déjà vrai avant le lot, et la vitrine en était hors ;
- les constats de détail de la critique, laissés en l'état : le sticker du direct
  sur le bouton de menu, un rond rouge sans le mot LIVE ; le booster dessiné de
  deux façons, et son compteur qui mène à `/boutique` sur le hub et à `/boosters`
  dans la barre ; le gaffer sur chaque nom du tiroir, qui charge les tuiles ; le
  tiroir haut de deux écrans à 360 pixels ; les cinq crans de la jauge de
  collection, qui sont des graduations et non des paliers ; le budget de trois
  états, qui ne compte pas une tuile verrouillée ; la fumée du rideau, deux
  rectangles à 768 pixels ; l'anneau d'XP, qui se lit mal à cette taille ; la
  barre qui n'est pas à la même place sur `/kop`, `/equipes`, `/diagnostic` et
  `/compte`, défaut d'avant le lot qui se voit davantage ; l'âge du Fanzzy en or
  sous son nom (H2) ;
- ce que le lot a laissé faute de données ou hors de ses fichiers : un champ
  `page` dans les paliers de niveau, sans lequel rien ne se verrouille ; la
  récompense d'un palier de collection ; la durée d'un duel, que la page ne reçoit
  pas (le bouton dit « Duel de tribunes ») ; une route pour le ticket de retour ;
  le toast, qu'aucune page ne pose ; le sticker d'urgence sur les deux écrans de
  jeu, au lot 6 ; `tunnel.webp` ;
- deux écarts à trancher : l'ordre des états de la bâche du jour, celui du brief
  — un nouveau joueur dont le club a un match au calendrier ne voit plus ses
  premiers pas sur le hub ; et les soldes du HUD, lus sur `/api/fanzzy/state` et
  non sur `/api/me/state`, que nomme la direction, parce que seul le premier
  porte le personnage ;
- des commentaires de `ui.css` devenus faux : ceux du fond de `body`, du mur, du
  panneau et du cadre, qui disent encore que l'audit ne lit pas le grain, et
  celui de la rubrique du tiroir, dont le `position:relative` n'est plus là
  « pour l'audit » ;
- restés du lot 1 : `data-economie` sous `saveData`, que ni `fx.js` ni `menu.js`
  ne posent encore ; les jauges plates de `/aide` et de `/profil`.

**Hors de ce lot, et c'est la suite :** le kiosque, la boutique, la collection, la
fiche, le profil, le classement, le KOP et les arènes — les lots 3 à 6.

---

## 4 quadragies ter. L'économie et le social FAIT MAIN, le quotidien du serveur, et le son de tribune

Du soir du 2 octobre 2026 au matin du 3, un seul atelier a mené quatre
chantiers ensemble : les **trois arbitrages de palette** que Gaël venait de
trancher ; les **lots 3 et 5** de la refonte — l'économie (le kiosque,
l'ouverture d'un booster, le butin, la boutique, l'abonnement) et le social
(le profil, le classement, le KOP, les amis, les missions, la fête de niveau)
— ; la **première vague du chantier serveur**, c'est-à-dire tout ce que ces
écrans dessinaient et que le serveur ne savait pas dire : missions du jour,
bonus de présence, saison datée, paliers, XP dans les résultats, visages dans
les classements ; et le **son de tribune**. Ce qui se voit à la fin tient en
quatre phrases : le papier se lit au soleil, l'économie et le social sont des
écrans de jeu, le jeu verse chaque jour quelque chose qu'on vient chercher, et
la tribune s'entend.

Le travail a été partagé comme aux lots précédents, sur des clés de périmètre
fermées aux fichiers disjoints : onze pour les écrans (`mesure`,
`feuilles-css`, `fx`, `kiosque`, `boutique`, `profil-classement`, `kop-amis`,
`missions`, `barre-tiroir`, `accueil`, `pages-autres`) et neuf pour le serveur
(`socle`, `niveau`, `duel`, `fanzzy`, `saison`, `classement`, `social`,
`virage`, `quotidien`). La mesure d'abord, seule avec la base ; puis deux
chaînes en parallèle — d'un côté les arbitrages, les briques et la cérémonie,
puis les écrans et le son ; de l'autre les périmètres du serveur, par vagues —,
les uns et les autres codant contre un **contrat écrit à l'avance**. Quatre
tours de vérification, avec des corrections par périmètre entre eux ; puis le
regard : deux critiques visuelles, une par lot, notées chacune 6,5 sur 10, et
trois relectures adverses — le code des écrans, le serveur, le son ; leurs
constats importants ont été corrigés, et deux tours ont suivi. Le sixième n'a
trouvé qu'une faute, de documentation (voir « Ce qui reste »).

**Les documents du chantier serveur ne sont pas dans le dépôt.** `SERVEUR.md`
(le contenu et ses raisons, écrit pour Gaël), `CONTRATS.md` (la forme exacte de
chaque réponse, qui faisait foi pour les écrans), `PLAN.md` (pour l'atelier) et
`ECARTS.md` (ce que chaque périmètre a fait autrement que le plan, et pourquoi)
ont été écrits dans le bac à sable de l'atelier, avec les études qui les
précédaient (`ECONOMIE.md`, `DONNEES.md`, `RISQUES.md`). Le code y renvoie
pourtant : vingt-six fichiers citent `CONTRATS.md` par son paragraphe, dix-sept
les trois autres. Cette section en reprend l'essentiel ; les verser dans le
dépôt est en tête de « Ce qui reste ».

### Trois arbitrages, tranchés par Gaël le 2 octobre 2026

Les lots 0 à 2 avaient buté trois fois sur la même chose : une teinte de la
direction qui ne passait pas le seuil au soleil, et qu'aucun lot n'avait le droit
de changer seul. Ils l'avaient laissée en hypothèse, mesurée, avec la façon de
la défaire. Gaël a tranché les trois le 2 octobre, avant que ces lots ne
commencent, et ce sont des règles, plus des hypothèses : elles valent **partout**,
pas seulement sur les écrans de ces lots. Elles sont écrites en tête de
`public/ui.css`, et leurs contrastes en tête de la section « les tons », avec la
formule de l'audit (la luminance des WCAG ; au soleil, chaque canal mêlé à 40 %
de blanc, sur le texte comme sur le fond).

**Les faces vives foncées restent** — c'était H1. Flare `#B8321F`, vert
`#197450`, bleu `#2F63B4`, violet `#6545AE` : la craie y tient 5,16, 4,96, 5,08
et 6,01:1 à l'intérieur, au lieu de 2,95 à 4,19 sur les faces vives d'avant le
lot 1. Au soleil, elle n'y tient que 2,39 à 2,61, et aucune face qui garde sa
couleur ne fait mieux : c'est le prix décidé. La face dit la destination,
l'intérieur tient le seuil, et ce qui doit se lire dehors se pose sur l'encre —
le gaffer du titre de la barre et des noms du tiroir. La proposition de la
critique du lot 1, éclaircir ces faces jusqu'à 4,6:1, n'est pas retenue.

**Le kraft s'éclaircit, et ce qu'on écrit dessus est noir pur.** `--kraft`
passe de `#C9A66B` à `#E4D3B5`, et tout texte posé sur le papier — le ticket, la
bâche du jour, la feuille de match, la page d'album, le pied du tiroir, l'astuce
du rideau — s'écrit dans un jeton à part, `--encre-kraft` (`#000`) : 14,28:1
dedans, **4,58 au soleil**, 14,07 et 4,55 sous le grain du papier. Sur le kraft
d'avant, l'encre du marqueur tenait 3,31 au soleil et le noir pur 3,58 : aucune
encre n'y passait. Un jeton à part, parce que l'encre du marqueur (`--encre`,
`#07090C`) ne tient que 4,24 au soleil sur le papier éclairci : c'est la seule
surface où elle ne suffit pas, et le cerne, l'ombre et la déchirure d'un ticket
restent à `--encre`. Deux lettres de tampon plein ont foncé avec lui, à la même
teinte, pour tenir 4,5:1 sur le nouveau papier : `--gris-encre`, `#59616C` →
`#555C67` (4,26 → 4,59), et `--or-encre`, `#8A6508` → `#765607` (3,62 → 4,60) ;
le vert et le rouge foncés tenaient déjà (5,32 et 5,37). Au soleil, seul le noir
passe 4,5 sur ce papier : les lettres d'un tampon plein y descendent entre 2,2
et 3,0, et c'est le mot et la forme du tampon qui portent le verdict dehors. La
craie et le kraft ne sont plus qu'à 1,27:1 l'un de l'autre (1,98 avant) : un
sticker craie posé sur le papier s'en détache par son cerne, jamais par sa
couleur. Et **pas de paragraphe sur le kraft** : un ticket porte un titre, un
chiffre et un tampon.

**L'or ne s'écrit plus qu'en grand.** Au moins 18,66 px en gras, ou 24 px, où
3:1 suffit ; un petit texte en or passe à la craie, et l'or reste une **face** —
une bâche d'achat, un sticker de prix, une récompense prête, le légendaire. Sur
les fonds du jeu, l'or tient 12,31 et 4,03:1 sur le noir, 11,55 et 3,69 sur le
panneau, mais 8,91 et 2,99 sur le parpaing : même un grand texte d'or s'y pose
mal. La craie qui le remplace tient 17,50 et 4,99 sur le noir, 16,42 et 4,57 sur
le panneau. Les trois ors laissés en attente depuis le lot 0 sont réglés : le
halo doré de `/deck` devient neutre, le jalon du deck (« le troisième
emplacement s'ouvre au niveau 5 ») devient un sticker craie cerné d'or —
`.tbf-sticker--jalon`, la brique de la promesse —, et la série choisie du
kiosque reste or, parce que le kiosque est l'écran où l'on achète. La face d'or
elle-même ne bouge pas : c'était H2.

Un ton de plus est venu, pour la même raison que le bleu et le vert clairs du
lot 1 : `--violet-clair` (`#C2A3FF`). Le violet des gens ne tenait que 3,9:1 sur
le panneau, et le social l'écrit en petit ; éclairci, il y tient 9,06 (3,26 au
soleil, comme le bleu clair). Jamais sur la craie ni sur le kraft.

Ce que les trois règles ont fait tomber, à 360 × 640 et états compris : **les
textes sur le kraft, de 14 à 0, et le petit texte en or, de 42 à 0** (2 et 27 sur
les pages, 12 et 15 dans les états). L'audit a gagné un relevé pour que le
second ne revienne pas, « petit or », qui vaut zéro partout. Restent en attente
H4 à H9 et H11.

### Mesurer d'abord : ce que le lot 2 avait laissé à l'audit

La mesure est passée avant tout, comme aux lots 0 à 2, et elle a commencé par les
trois défauts que le lot 2 lui avait laissés (`scripts/audit-ui.mjs`).

**Le contraste se mesure sur tout texte à soi.** Il ne se lisait que sur un
élément sans enfant : PRENDRE MA PLACE, qui porte son sous-libellé dans un
`<small>`, était sorti du compte sans être corrigé. Il se lit maintenant sur
tout élément qui porte directement une lettre ou un chiffre — la règle que le
petit texte et l'opacité suivaient déjà —, et l'ancien relevé en est un
**sous-ensemble exact** : ce que seule la nouvelle règle voit est compté à part
(`horsFeuille`) et marqué dans chaque trouvaille, si bien qu'un relevé d'avant
vaut le nouveau moins eux. À 360 × 640, la règle a ouvert **190 textes, dont 38
pâles au soleil** que rien ne voyait : PRENDRE MA PLACE (2,6:1), les liens du
pied kraft du tiroir (3,3), tous les rangs et toutes les ferveurs d'un
classement rempli, les chiffres des stats du profil. Ce qui échappe encore —
le mot d'un pseudo-élément, la valeur d'un champ, l'option choisie d'une liste —
est relevé sans être mesuré (`horsContraste`) : la pastille « 6 » du bouton de
menu sur dix-neuf écrans, par exemple. Le JSON passe au schéma `audit-ui/3`.

**Œ n'est plus une police de repli.** `document.fonts.check()` rendait faux sur
« LE COUP D'ŒIL » alors que Chrome, interrogé par son protocole de débogage,
dessinait les treize glyphes en Oswald : la tranche latin-ext d'Oswald couvre
aussi Œ, elle n'est jamais chargée puisque la tranche latine suffit, et
`check()` exige toutes les faces qui touchent le texte. Quand il dit non, l'audit
juge maintenant caractère par caractère, sur les faces chargées de la famille,
du poids retenu par la règle CSS et du style. Une police dont le fichier manque
reste relevée.

**Une face tournée de dos ne se lit pas.** Défaut trouvé en ajoutant l'ouverture
d'un booster : les quatre cartes encore à retourner portent leur face sous leur
dos (`backface-visibility:hidden`), et l'audit relevait leurs « ÉVO 1 » sous
onze pixels. La face dont la normale, composée des `transform` et `rotate` de son
contexte 3D, regarde vers le fond est écartée ; aucune page visitée n'en
portait.

**Quatre écrans de plus.** `--etats` photographiait l'ouverture du hub et le
tiroir ; il photographie et mesure aussi la bande du HUD dépliée sur
`/classement` (`hud@/classement`, à 360 et 400 pixels — au-delà de 560, c'est une
rangée de la barre), une carte révélée, le ticket du gain et le butin d'un
booster (`booster@carte`, `booster@ticket`, `booster@butin` : un joueur neuf par
format, le geste d'un joueur, l'accès clavier de la déchirure), et un classement
rempli (`classement@classé` : treize supporters semés, le joueur de l'audit
neuvième, le serveur redémarré pour vider sa mémoire de cinq minutes, les
pseudos vérifiés à l'écran). Le tirage du booster est au hasard, comme pour un
joueur — le serveur ne prend pas de graine, et lui répondre à sa place
mesurerait une reconstitution — : il est relevé avec l'état. L'audit sait aussi
dire où est la barre sur chaque page (« barre décalée »), la hauteur du tiroir
au-delà d'un écran et demi, et une fête de niveau posée par surprise. Il passe à
sept minutes et demie avec `--etats`. Un état `bonus@/` a vécu quelques heures,
le temps que le hub posait le bonus du jour dans la pile des tickets ; il est
parti avec elle.

**Le départ s'est contrôlé lui-même.** Pris le 2 octobre de 20 h 07 à 20 h 14,
au commit `7dc5464`, sans une modification de `public/`, il a été comparé case
par case au dernier relevé du lot 2 : tous les comptes égaux, ceux du contraste
nets de `horsFeuille`, les listes pâles et au soleil égales trouvaille par
trouvaille ; seules les trois fausses alertes Œ de `/repetition` ont disparu. Les
comptes bruts au soleil montent donc parce que la mesure s'est ouverte, pas
parce que les pages ont bougé : **127 → 165** à 360 × 640, hors `/admin` et
`/diagnostic`. Rangés par arbitrage, il fallait faire tomber 29 textes sur les
pages et 27 dans les états. Et ce qu'aucun arbitrage ne visait pesait le plus :
la craie à 0,88–0,9 d'opacité sur le panneau, entre 4,0 et 4,1:1 au soleil (62
textes sur les pages, dont 30 sur `/profil` et 18 sur `/aide`, 40 dans un
classement rempli), que le seuil d'opacité de l'audit (0,85) laissait passer.

### Ce qui a changé

#### Le kiosque

Le kiosque devient un étal sous les projecteurs, et il est beau avec **une
seule série ouverte**, celle de la production, sans s'effondrer avec les
treize de la base de test.

**La réserve, sous la barre** (`.tbf-reserve`) : les sachets en fentes, l'anneau
de recharge sur la première vide, « PROCHAIN 9:55 », le solde en sticker. Elle
se dessine d'une seule règle, `reserveHTML` dans `cartes.js` : une fente par
place quand le plafond **de ce joueur** est servi et qu'elles tiennent en cinq,
sinon le sachet et son compte sur une étiquette rectangulaire. Le kiosque
écrivait cinq fentes en dur et faisait croire à un plafond de cinq, quand la
réserve en tient douze, vingt-quatre pour un abonné : le plafond vient
maintenant du serveur (`wallet.packMax`). **Sans avatar**, contre la maquette :
la barre porte déjà le même visage avec le même anneau, cinquante pixels plus
haut. Le « + » du solde mène au Virage, où l'on gagne des écharpes — il menait à
la boutique, où on les dépense.

**La scène** : la banderole de la saison, une bâche craie de travers avec ses
deux scotchs, le temps qui reste et « 4 / 35 COLLECTÉS » en sticker —
seulement si le serveur ou le catalogue les donnent — ; le sachet choisi sur
son socle, sous deux cônes de projecteur, dans la fumée de sa couleur, son nom
en sticker ; les séries ouvertes en rail qui défile de côté, la choisie en or ;
les séries fermées sur un seul rang, sous une seule croix de scotch, avec « N
SÉRIES ATTENDENT UNE SAISON », et « SAISON 2 » et le nom de la série annoncée
seulement quand le serveur l'annonce (`sets[].prochaine`). La hauteur de la
scène suit le nombre de rangées : avec treize séries, la bâche OUVRIR sortait de
l'écran de 640.

**Un seul geste d'achat.** La minuterie est devenue un objet, une bâche parpaing
« PRÊT DANS 9:55 » qui devient « PRÊT », or et qui respire. À côté, réserve vide
et solde suffisant, la bâche or « TOUT DE SUITE · +1 BOOSTER · 45 » est le seul
achat — l'écran le proposait deux fois, en or et en flare, pour le même appel ;
à PRÊT, elle disparaît. À court d'écharpes, la flare cède sa place à une bâche
verte GAGNER DES ÉCHARPES, vers le Virage : une bâche éteinte « IL TE FAUT 45
ÉCHARPES » ne menait nulle part. Le ticket « −45 » ne se pose plus que pour un
paquet demandé à l'achat, au prix réellement prélevé (`paye`) : il se déduisait
de l'écart entre deux soldes, et un achat fait dans un autre onglet le faisait
annoncer pour un booster gratuit.

#### L'ouverture et le butin

**La déchirure n'a pas bougé d'un caractère.** Le compteur « 1 / 5 » devient cinq
fentes de dos de carte qui se vident en gardant la barre de leur rareté
(`.tbf-fentes--cartes`). Chaque carte retournée reçoit sa forme de rareté collée
au-dessus d'elle et sa cérémonie, celle de l'échelle commune (`FX.reveler`,
plus bas), qui remplace la suite d'effets écrite à la main ; NOUVEAU claque en
tampon plein ; TOUT RÉVÉLER est une bâche craie, FERMER du parpaing.

**NOUVEAU se compte par carte servie, pas par identifiant.** La page retenait la
nouveauté dans un ensemble d'identifiants : un booster qui contenait deux
exemplaires d'une même carte neuve marquait les deux NOUVEAU, alors que le
serveur avait rendu le second en doublon, payé en écharpes — la même carte
portait NOUVEAU et « +1 », et le titre comptait quatre nouvelles pour trois.
La nouveauté se lit maintenant au rang, sur le `new` de chaque carte.

**Le butin** se colle sur une page d'album kraft (`.tbf-album`) : les cartes de
travers, une à une, NOUVEAU en sticker, la forme de rareté au coin — l'ancien
emblème en image, qui dessinait autrement la rareté que la révélation une
seconde plus tôt, est parti —, et la ligne vivante de la série, « LA REPRISE
4 → 6 / 32 », dont l'écharpe avance (`series`, servi par le serveur à
l'ouverture). Les écharpes des doublons volent vers le compteur, qui compte ;
l'anneau d'XP n'avance que si le serveur sert la jauge. La fin tient en trois
bâches — ENCORE UN en flare, LE CLASSEUR et MON DECK en bleu —, et le toast est
devenu un ticket de gain. À 768 pixels, le titre, l'album et la fin forment un
seul bloc, et les cartes prennent la taille d'une tablette.

#### La boutique et l'abonnement

**Deux écrans au lieu de vingt.** L'étal empilait quarante-neuf pièces ; à
360 × 640, la page faisait 7 588 pixels de haut, elle en fait 1 625, et l'étal
1 031. Elle se range en échoppe : la réserve sous la barre, un seul objet
**À LA UNE** — le légendaire le plus proche du solde, sur sa plaque de rareté,
sous les projecteurs, dans un cadre kraft à écharpe —, des rayons en onglets or
(l'équipement, les tenues, l'abonnement), des filtres de rareté, l'interrupteur
« à portée d'abord », trois rangées d'étiquettes, puis « VOIR LES 42 AUTRES ».
Toucher la une ouvre toujours sa boîte, où sa phrase d'effet se lit : elle était
un lien vers le Virage quand le solde ne suffisait pas, la seule pièce du
magasin dont on ne pouvait pas lire l'effet.

**L'étiquette de marché** (`.tbf-marche`) : l'objet détouré sur un sticker
craie, ou sa silhouette au pochoir s'il n'est pas dessiné ; le nom, la phrase
d'effet entière, le prix en sticker rond ; « à portée », un cerne or qui
respire, sur un seul objet à la fois ; « DÉJÀ À TOI » en tampon. Hors de portée,
une écharpe fine dit le solde sur le prix, et **une seule** bâche verte GAGNER
DES ÉCHARPES se pose sous les filtres : sept stickers GAGNER par écran, c'était
le mur de stickers que la direction désigne comme le défaut à éviter. La
commune ne porte plus de forme : à seize pixels, son rectangle gris se lisait
comme une case à cocher.

**La cérémonie d'achat** se joue sur un calque fixe, hors de l'étal que la page
réécrit après l'achat : l'objet au centre, la bouffée de sa rareté, `FX.reveler`
qui l'ouvre lui-même, le tampon « À TOI ! », le ticket « −520 » qui descend du
HUD pendant que le solde décompte, puis la bâche violette L'ÉQUIPER. La cabine
d'essayage montre la tenue sur un Fanzzy du joueur qui la porte vraiment, sur un
socle, avec un interrupteur avant/après.

**L'abonnement** s'ouvre sur le **PASS DE TRIBUNE** : une bâche or, six sachets,
« JUSQU'À 6 BOOSTERS DÈS LE PAIEMENT » tiré des formules servies, BIENTÔT tant que
les paiements ne sont pas branchés, sans prix ni bouton — puis ce qu'on garde
sans payer, le tableau, et les formules en bas : le gratuit avant le prix. À la
critique, il était posé à 970 pixels sur 1 503, et le premier écran était resté
celui d'avant le lot, à la couleur d'une colonne près. Le tiroir, la boutique, `/abonnement` et le KOP lisent `/api/abonnement`
une seule fois par page, par une promesse posée sur la fenêtre
(`window.TBF_ABO`), comme `TBF_MOI` pour le compte.

#### Le profil

**La carte de supporter** : le buste dans l'anneau d'XP, le pseudo en Oswald, le
club, « dans la tribune depuis » au marqueur et la date en Oswald — jamais un
chiffre au marqueur —, le tampon VÉRIFIÉ, le niveau au coin, et l'écharpe aux
couleurs du club principal, que le serveur sert maintenant (`tribune.couleurs`
sur `/api/rank/moi`) : elle était toujours or et rouge. Les quatre stats sont des
stickers craie qu'on touche, cernés au ton de leur destination.

**MON NIVEAU en chemin** (`.tbf-chemin`) : une corde, un nœud par palier, le
passé coché, la bâche or « TU Y ES », les paliers à venir en pointillé avec un
cadenas et ce qu'ils ouvrent (« 3ᵉ FANZZY », « +60 »), lus sur `/api/niveau`.
C'est la pièce que la critique a jugée la meilleure du lot.

**MA SAISON** dit la division et ce qui manque pour la suivante ; PORTER
L'INSIGNE, la seule récompense d'une division, se terminait par un toast
« Insigne posé » : le tampon claque maintenant sur l'insigne, dans une bouffée
aux couleurs de la division. **MON PARCOURS** est une feuille de match, un ticket
kraft par partie, l'issue en tampon plein, le gain en sticker, et les agrégats
en stickers au lieu d'une grille de quatre cartes de tableau de bord. **MON
FANZZY** montre la carte du titulaire, dessinée par `cardHTML` à l'âge que son
avatar montre, avec le catalogue public (`/api/fanzzy/dex`). Tous les réglages
sont rangés derrière une bâche RÉGLAGES qui se déplie (`details`), sans script.
Et la fête de niveau se déclenche au retour sur le profil quand le niveau a
monté depuis la dernière visite.

#### Le classement

**Le mur d'honneur** : le podium en trois bâches — or, craie, parpaing — avec
leurs bustes (l'initiale quand l'avatar manque), le rang en grand chiffre sur la
bâche (il était un second sticker rond à côté de celui du niveau, sur le même
buste) ; des lignes calmes de cinquante-deux pixels — le rang, le buste, le nom,
l'insigne de division et le club, le delta, la valeur —, le mot FERVEUR une seule
fois en tête de colonne, le niveau, les matchs et les vécus dans une bulle qui
s'ouvre au toucher, un compte nul jamais écrit. Elles en faisaient soixante-
quinze. **Ma ligne est épinglée** en bas, en ticket kraft, et ne disparaît jamais
au défilement (`position:sticky`), avec le nom de ma division : l'insigne seul
ne disait FERVENT à personne. Le delta de ma ligne vient du serveur
(`evolution`), celui des autres de la mémoire de l'appareil. La période SAISON
compte la fenêtre de la saison en cours, TOUJOURS le cumul. L'état vide, « TA
PLACE EST LÀ » au marqueur sur la photo d'une place vide, mène au Virage par une
bâche flare.

#### Le KOP et les amis

**Le KOP déplié** : sa bâche aux couleurs du club tenue par deux scotchs, les
stickers POT, MEMBRES et VERSÉ PAR TOI, le pot en écharpe épaisse
(`.tbf-jauge--epaisse`) avec ses crans et son jalon craie cerné d'or, les
membres assis en gradins (bustes, CAPO, un siège INVITER), le vote en case de BD —
le chrono, la balance en écharpe, POUR en vert et CONTRE en flare, le tampon
ADOPTÉ ou REFUSÉ à la clôture —, et l'entrée fêtée par « TE VOILÀ ! ». La page se
relit toutes les trente secondes : le pot, les jalons et le vote vivent dans des
nœuds stables. **Un club suivi sans KOP**, l'état que verront la plupart des
joueurs, n'avait pas changé : il reprend la carte d'un KOP, la bâche aux couleurs
du club (que `/api/kop/club/:id` sert maintenant), ce qu'un KOP apporte en trois
stickers et ce que coûte sa création — elle demande le PASS DE TRIBUNE.

**Les amis** repassent au violet, chacun en buste avec son niveau ; un nouvel
ami est fêté en case de BD. Le geste visible d'une ligne était RETIRER, en bâche
flare, sous chaque nom : c'est maintenant « INVITER AU KOP », et retirer passe
derrière « ⋯ », en parpaing, avec confirmation. KOP et amis tiennent une colonne
de six cents pixels sur une tablette, comme le profil et le classement.

#### Les missions

`/aide` devient **MISSIONS** — la route ne change pas —, et le tiroir le met dans
sa tête, en bâche avec sa pastille, à côté de l'accueil : il était dans le pied,
sous la ligne de flottaison à 360 × 640. La pastille se lit dans
`sessionStorage` (`tbf-quotidien`), écrite par le hub, les missions et le profil
après chaque lecture : la barre et le tiroir n'appellent jamais la route
eux-mêmes.

Quatre onglets, dont deux n'existent que si le serveur les sert : **DU JOUR** —
le bonus de présence et sa carte de sept cases, les trois missions en tickets
kraft avec leur vignette, leur écharpe de progression, leur gain en stickers et
leur geste RÉCUPÉRER, le sachet, et celles d'hier encore à récupérer — ;
**SAISON** — le carnet sur la corde de MON NIVEAU, un nœud par palier, atteint,
prêt ou à venir, au lieu de cinq tickets qui redisaient le même chiffre — ;
**PREMIERS PAS** — l'étape suivante seule en bâche, au ton de sa destination,
les autres repliées sous un cadenas, « ENSUITE » — ; **QUESTIONS**. Changer de
mission est un « ↻ » dans le coin du ticket, et le compte des changements
s'écrit une fois, dans l'en-tête : « CHANGER DE MISSION (1) » sous chaque ticket
laissait croire à trois changements. Un palier du carnet, qui vient au mieux une
fois par semaine, est fêté en case de BD or, ses boosters volant vers le HUD,
avant son ticket. L'insigne d'un palier (le liseré et le tampon S1) n'est pas
écrit : le serveur l'inscrit au grand livre, mais aucune route ne dit qu'un
joueur le porte et aucun écran ne le dessine.

#### Le hub, avec ses données

Le hub n'a reçu que les données nouvelles. **La bâche du jour** dit d'abord le
bonus du jour tant qu'il est prêt — BONUS DU JOUR, la bâche or RÉCUPÉRER, l'écharpe
de la semaine et « J3 » —, puis, comme avant, le direct et le prochain coup
d'envoi, puis la mission du jour, puis les premiers pas. Deux corrections après
la critique : le bonus montait d'abord en ticket dans la pile et couvrait, à
360 pixels, tout le bouton PRENDRE MA PLACE ; et la mission du jour chassait les
premiers pas d'un joueur neuf — « JOUE UN DUEL JUSQU'AU BOUT » à quelqu'un qui
n'avait pas de Fanzzy. Les premiers pas passent maintenant devant tant que leurs
fondations manquent (un Fanzzy, un booster ouvert), et la mission ensuite
seulement si elle est faisable.

**Le ticket « depuis ta dernière visite »**, dessiné au lot 2 et caché faute de
route, vit : la lecture du quotidien porte le ticket (`?retour=1`), et la marque
de visite n'avance que par un `POST`. Le « +N » de FANZZY vient du serveur
(`nouveautes`), et s'éteint au retour pour les seules cartes que le joueur est
allé voir. La collection lit ses crans sur `paliers`. Le reliquat du lot 2 est
traité : le but rend sa secousse par `FX.but({ pour: true, vignette: true })`, la
bulle ne couvre plus la tuile DUEL à 320 × 568 — elle s'y plie aussitôt en
« ! » —, et le direct dit LIVE sur le bouton de menu.

#### La cérémonie et la fête de niveau

**`FX.reveler(rarete, el, { son, retourner })`**, dans `fx.js`, est l'échelle
unique de tout ce qui se révèle — le booster et l'achat aujourd'hui, la
collection et l'évolution demain : la commune se retourne ; la rare reçoit un
balayage plastifié et un tic ; l'épique une nappe, une bouffée violette, des
confettis de papier, un carillon et une vibration de 14 ms ; la légendaire un
flash, des rayons d'or au pochoir, une secousse, un rugissement, le tampon
« LÉGENDAIRE » et une vibration `[40, 30, 90]`. Elle joue sur son propre calque, à
z 96, attend la fin du retournement de la page, s'arrête si l'objet quitte
l'écran, et rend une promesse résolue quand c'est fini. Sans mouvement, le
liseré de la rareté s'allume sur place et le tampon se pose sans claquer :
l'information reste.

**La fête de niveau** (`niveau-fete.js`) est devenue une case de BD or : le
Fanzzy en pose victoire, « NIVEAU 5 » qui compte depuis l'ancien, ce que le
palier ouvre et le prochain. Elle jouait son flash, son onde et sa secousse sous
un fond opaque à 94 % : on ne les voyait pas. Elle se déclenche aussi au retour
sur `/profil` et `/virage` quand le niveau a monté depuis la dernière visite
(`TBF_NIVEAU.depuisVisite`, mémoire `tbf-niveau-vu` signée du joueur), une seule
fois, jamais au rechargement. Sa place dans la case est écrite dans une feuille
que le script pose lui-même, en attendant `ui.css`.

#### Les briques

Écrites dans `public/ui.css`, section « les pièces des lots 3 et 5 », chacune
avec son balisage exact et ses doubles mouvement réduit et calme, et posées sur
un banc avant qu'un écran ne s'en serve : la réserve, les fentes et l'anneau de
recharge (`--part` est une part de 0 à 1, pas un pourcentage), la minuterie, les
projecteurs et le socle, le calque d'une cérémonie (z 92), la page d'album, le
ticket de gain, l'objet sur son sticker, l'étal et l'étiquette de marché, le
buste d'un autre joueur, la stat, le chemin de niveau, la feuille de match, le
podium, la ligne épinglée et le delta, l'insigne de division (une écharpe de un
à cinq nœuds, jamais aux couleurs de la rareté), les gradins, la case de vote,
le ticket de mission et le compte d'onglet, le bonus et sa série, la bâche
RÉGLAGES, l'interrupteur scotch, et quatre variantes (`.tbf-jauge--fine`,
`--epaisse`, `.tbf-sticker--prix`, `--jalon`). Une page n'écrit que la place
d'une brique. Sur le banc, tout texte posé sur le kraft tient 14,28 et 4,58:1.
Le vocabulaire du lot 1 est maintenant posé presque en entier : le tampon, le
scotch, la bouffée, la forme de rareté, `.tbf-clac` et le marqueur, que trois
pages chargent (l'accueil, le profil, le classement), pour cinq emplois.

### Le son de tribune

Décidé par Gaël le 2 octobre, mené dans la même vague. Il y avait **deux banques
de sons synthétisés qui s'ignoraient** : celle de `fx.js` (`FX.son`) et l'objet
`audio` de `cartes.js`, chacune avec son propre contexte audio, chaque son
branché droit sur la sortie, et des volumes réglés à l'oreille un par un. Trois
sons superposés s'additionnaient sans garde-fou.

**Un seul moteur**, `public/son.js` : un seul `AudioContext`, créé au premier
geste — jamais avant, les navigateurs le refusent —, trois bus (effets,
interface, ambiance), un limiteur sur le maître (−6 dB, ratio 20, attaque 2 ms)
et un plafond doux. `fx.js` le charge lui-même : une page qui a les effets a le
son, sans balise de plus. `FX.son(nom)` et l'objet `audio` du kiosque y passent
sans que leurs appelants changent. Le mode calme coupe tout, ambiance comprise,
et le contexte n'est même pas créé tant qu'il dure ; le volume du joueur, un
curseur dans le tiroir à côté du mode calme (`tbf-volume`), s'applique après le
limiteur et au carré — un curseur à mi-course doit sonner à mi-course.

**Un mixage mesuré, pas réglé à l'oreille.** `scripts/son-banc.mjs` rend chaque
son hors ligne, dans Chrome, à travers la chaîne complète, et mesure sa crête,
sa sonie pondérée K (BS.1770) sur ses cent millisecondes les plus fortes, sa
sonie moyenne et sa durée. Trois familles, trois fenêtres qui ne se chevauchent
pas : l'interface entre −31 et −27 LUFS, le jeu entre −25 et −20, les moments
entre −19 et −14 ; aucun son seul au-dessus de −6,5 dBFS, sous le seuil du
limiteur, qui ne sert qu'aux superpositions. Les volumes sont des constantes
nommées, chacune avec sa mesure en commentaire. Ce que la mesure a trouvé avant
d'y toucher : le tic à −44,4 LUFS et la bâche à −32,6 dans la même interface ; la
corne de but (−27,4) plus faible que l'accord d'une carte épique (−16,9) ;
l'évolution (−21,3) plus forte que le but ; et deux sons que les pages
appelaient et que la banque n'avait pas, le gong du duel et le « ok » de
l'accueil, qui ne sonnaient pas du tout. Au dernier passage, les quarante-quatre
rendus sont dans leur fenêtre, et les dix moments joués ensemble sortent à
−4,5 dBFS.

**L'ambiance**, une rumeur de foule — du bruit filtré en couches, des
respirations lentes, de rares éclats de voix —, monte et descend avec le match
par une seule commande, `TBF_SON.ambiance(niveau)` : 0 la tribune vide, 1 la
rumeur, 2 la tribune qui pousse, 3 le but, avec son ovation. Elle ne joue que sur
les écrans de match, après le premier geste, s'éteint quand l'onglet se cache, et
ne recrée aucun nœud à chaque image. Réglée d'abord à l'oreille, elle sortait à
−22 LUFS en moyenne et aurait couvert toute l'interface ; elle tient maintenant
autour de −40, −35 et −27,5 LUFS. `/virage` et `/duel-nvn` l'appellent aux
moments que leurs événements donnaient déjà : l'entrée, la poussée, le but de
son camp, la fin, la sortie de la page.

**Les chants**, `TBF_SON.chant(type, { tempo })` : des frappes de tambour et des
claps de foule calés sur la pulsation du geste — `tempo`, `contretemps`,
`marche`, `roulement`, `frappes` —, **sans mélodie**. `/repetition` les joue sous
le geste qu'on apprend ; le calage fin dans les arènes est au lot 6.

**Pourquoi tout est synthétisé.** Un son téléchargé se joue en retard la première
fois, exactement quand il compte ; et les chants de supporters
reprennent souvent des airs protégés : on joue du rythme, des accords tenus, des
bruits, jamais un air, aucun hymne, aucun chant de club. Un enregistrement libre
de droits pourra venir, fichier par fichier, avec l'accord de Gaël. Et le son ne
porte jamais seul une information : ce qu'il dit, l'écran le dit aussi.

`son:smoke`, sans base, garde le tout : chaque nom appelé par une page existe
dans la banque, le calme coupe tout, aucun son ne sort de sa fenêtre ni ne
sature, tout marche sans `AudioContext`, l'onglet caché arrête la rumeur et le
chant ; quatorze mutations du moteur et une de `fx.js` ont chacune fait rougir
le contrôle qui la surveille. Le rapport des niveaux, `NIVEAUX.md`, et les WAV
s'écrivent hors du dépôt (`npm run son:banc [dossier]`).

### Le chantier serveur : le quotidien

Gaël a délégué le **contenu** — quelles missions, quel bonus, quelle saison,
quels montants. Le chantier a commencé par trois études (l'économie, les
données, les risques), une synthèse pour Gaël, un contrat pour les écrans et un
plan pour l'atelier, puis une relecture adverse du plan, faite dans le code de
la copie principale, qui l'a changé sur dix-neuf points.

**Le constat qui guide le contenu.** Une simulation qui rejoue le tirage du
serveur sur la seule série ouverte en production dit que les écharpes ne sont
plus rares — un booster en rend en moyenne 45,8 pour un prix de 45 —, que le jeu
paie l'ouverture et pas le jeu — le Grand Virage, le cœur du jeu, ne rapporte
rien —, et que ce qui reste rare, c'est l'XP, les tampons de saison et l'honneur.
D'où la règle : **les missions récompensent le Virage, le duel et le geste**, en
XP, en tampons et en insignes ; les écharpes restent modestes.

**Les missions du jour.** Trois par jour, une facile, une moyenne, une
difficile, **les mêmes pour tout le monde** — tirées du jour, chaque joueur
prenant la première faisable pour lui —, parmi treize : ouvrir 3 boosters, jouer
un duel jusqu'au bout, chanter 10 fois au Virage, faire grandir un Fanzzy ;
chanter 40 fois, gagner un duel, jouer 2 duels classés, chanter 20 fois pour son
club, jouer un duel pour son club ; gagner 3 duels, jouer 5 duels, chanter 10
fois dans chaque mi-temps d'un match, chanter dans deux compétitions. Elles
paient 30, 60 et 100 écharpes, 20, 40 et 60 XP, et 1, 1 et 2 tampons ; les trois
récupérées, **le sachet**, un booster, qui entre dans la réserve même pleine. Une
relance par jour. Le serveur compte, le joueur ne déclare rien : un booster
ouvert, un duel joué, un chant au Virage. Une mission finie reste récupérable
jusqu'à la fin du lendemain. Écartées exprès : répéter un geste (la répétition
ne paie pas), suivre un club ou ajouter un ami (cela se fait et se défait chaque
jour), acheter, et les missions de qualité, qui pousseraient à automatiser le
geste.

**Le bonus de présence** est une carte de sept cases qui **ne recule jamais** :
20, 25, 30, 35, 40, 45 et 50 écharpes, et un booster à la septième. Un jour
manqué ne la fait pas reculer ; la série de jours s'affiche à partir de trois, à
titre d'information, et rien n'en dépend — la règle « aucune série qu'on perd ».

**La saison datée.** La saison 1, « La reprise », est proposée pour finir le
dimanche 20 décembre 2026, dernier week-end avant la trêve — à vérifier sur
`/matchs` avant de la saisir. Sa fin ne ferme rien ; elle arrête le carnet, les
divisions et le classement « saison », et éteint les bonus de KOP de saison, qui
ne s'éteignaient jamais. Une saison 2 lancée plus tôt l'arrête aussi. Le
**carnet de tampons** a cinq paliers : 10 tampons, 100 écharpes ; 40, un booster,
150 écharpes et le liseré S1 ; 100, deux boosters, 250 écharpes et le tampon S1 ;
180, trois boosters et 400 écharpes ; 260, quatre boosters, 600 écharpes et le
titre « Revenu pour de bon ». Il suppose soixante-trois jours de missions, donc
une mise en ligne au plus tard le 19 octobre ; au-delà, il se recale dans
l'onglet Saisons **avant** le premier palier versé, puis il se fige. Au
lancement de la saison 2, qui a gagné dix tampons reçoit deux boosters, « les
sachets de la trêve ».

**Les paliers.** Un cran de collection tous les 25 objets : 25 écharpes, un
booster tous les quatre crans, et une série complète paie un booster et 100
écharpes. **Les tenues n'y comptent pas** (voir les pièges). Cinq divisions de
saison sur la ferveur classée — Sympathisant, Habitué à 5 000, Fervent à 30 000,
Ultra à 100 000, Capo à 300 000 — **ne paient que l'honneur** : l'insigne, et le
titre « Capo de la saison 1 ». La ferveur classée n'a pas de plafond pour un
abonné : une division payée en boosters se serait gagnée en partie en payant.
Les seuils sont incertains d'un facteur deux, et se recalent sur la ferveur des
joueurs **sans abonnement**.

**Abonné et non-abonné reçoivent exactement la même chose** : aucune mission ne
demande ce que l'abonnement vend, le module des missions ne sait pas qui est
abonné, aucune tenue n'est donnée en récompense. L'effet estimé, sur six
semaines : +15 % d'écharpes et +26 % d'XP pour un joueur assidu, +31 % et +50 %
pour un occasionnel ; les boosters ne bougent que de 3 à 4 %.

#### Les montants de départ, et où les régler

Tout se règle dans `/admin`, RÉGLAGES, sans livraison : trois sections
nouvelles du registre (`src/shared/reglages.js`), que l'écran dessine seul.

| Section | Réglages, valeur de départ |
|---|---|
| LE QUOTIDIEN | `bonus.actif` oui ; `bonus.base` 20, `bonus.pas` 5, `bonus.j7_packs` 1 ; `missions.actif` oui ; `missions.relances` 1 ; `missions.facile_echarpes` / `moyenne_` / `difficile_` 30 / 60 / 100 ; `missions.*_xp` 20 / 40 / 60 ; `missions.sachet_packs` 1 ; `quotidien.retour_heures` 3 ; le disjoncteur, `recompenses.plafond_echarpes_jour` 2 500 et `recompenses.plafond_packs_jour` 15 |
| LES MISSIONS DU JOUR | une bascule par mission, `mission.boosters` … `mission.ailleurs`, toutes allumées |
| LA SAISON ET SES PALIERS | `saison.carnet_actif` oui ; `saison.tampons_facile` / `moyenne` / `difficile` / `sachet` 1 / 1 / 2 / 1 ; `saison.relais_packs` 2, `saison.relais_seuil` 10 ; `collection.actif` oui, `collection.cran` 25, `collection.cran_echarpes` 25, `collection.cran_booster_tous` 4, `collection.serie_echarpes` 100, `collection.serie_packs` 1 ; `rang.actif` oui, `rang.habitue` / `fervent` / `ultra` / `capo` 5 000 / 30 000 / 100 000 / 300 000 |

Les montants d'une mission sont **figés au tirage**, le matin : un changement à
midi vaut pour le lendemain, et le joueur reçoit ce qu'on lui a promis. Le bonus
fait exception, il se calcule à la réclamation. Un interrupteur coupé arrête le
neuf **et** refuse les réclamations de sa source. Ne se règlent pas, exprès : les
cibles des missions, qui sont des règles et pourraient passer au-dessus du
plafond gratuit ; le nombre de cases de la carte, qui est dessiné ; et aucun
montant de division — le registre refuse une clé `rang.*` en écharpes ou en
boosters. L'onglet Saisons gagne la date de fin, la date d'ouverture annoncée et
le carnet d'une saison.

#### Les tables et les routes

**Un seul fichier de schéma**, `sql/quotidien.sql`, additif et rejouable, en
dernier dans `scripts/ordre-schema.mjs` : quatre tables et neuf colonnes, 47
tables au bout. `recompenses` est **le grand livre** — une ligne par versement,
clé primaire `(user_id, source, cle)`, et c'est elle qui empêche un double clic,
deux onglets ou un réseau qui rejoue de payer deux fois ; `missions_jour` (le
contrat du jour, gains copiés au tirage, et le sachet au rang 3),
`compteurs_jour` (boosters ouverts, évolutions) et `user_nouveautes` (ce que le
joueur n'a pas regardé). `saisons` gagne `fin_le`, `ouvre_le` et `carnet` ;
`user_wallet`, `rangs_vus`, `visite_a` et `instantane` ; `virage_presence`,
`chants`, `chants_mt1` et `chants_mt2`.

**Le grand livre est la seule porte des versements** (`src/server/recompenses.js`,
`verser` et `verserTout`). Dans une seule transaction : le verrou de la bourse,
« déjà versé » **avant** le disjoncteur, le recompte de l'appelant, le
disjoncteur quotidien, la ligne, la recharge due **avant** un booster offert, l'XP
**dans** la transaction (`niveau.gagnerDans`). Un versement est entier ou n'est
pas. Le démarrage vérifie la clé primaire du grand livre et ferme les versements
s'il ne la trouve pas ; sans le fichier, rien ne casse, les missions
disparaissent de l'écran et le démarrage nomme `sql/quotidien.sql`.

| Module | Routes et champs |
|---|---|
| `src/server/quotidien/` (`index.js`, `missions.js`, `depuis.js`), `src/shared/quotidien.js` | `GET /api/quotidien` (`?retour=1` porte le ticket « depuis ta visite ») ; `POST /api/quotidien/bonus`, `/mission`, `/sachet`, `/relance`, `/carnet`, `/relais`, `/tout`, `/visite` ; la sonde du jour de jeu dans `/healthz` (`jourDeJeu`) |
| `src/server/fanzzy/` | `POST /api/fanzzy/vu`, `POST /api/fanzzy/palier` ; `nouveautes` sur `/state`, `paliers` sur `/bibliotheque`, `cle` et `series` sur `/open`, `prochaine` et `sets[].prochaine` sur `/dex` ; `wallet.packMax`, `wallet.cadenceMs`, `paye` ; `recharger(conn, userId)` exporté |
| `src/server/classements/`, `src/server/fanzzy/avatar.js` | `POST /api/rank/division` ; `avatar` et `niveau` sur toutes les lignes, `division` sous `?periode=saison` (qui compte enfin la fenêtre de la saison) ; `saison`, `saisonPassee`, `titres`, `evolution` et `tribune.couleurs` sur `/api/rank/moi` |
| `src/server/kop/`, `src/server/amis/` | `avatar` et `niveau` des membres et des amis ; `couleurs` sur `/api/kop/club/:id` |
| `src/server/niveau/`, `src/server/nvn/` | un gain d'XP atomique et la jauge (`niveau`) dans les résultats ; `gains.cote` avant et après un duel classé |
| `src/shared/saison.js`, `src/server/fanzzy/saisons.js` | la saison datée (`fin`, `finDansMs`, `joursRestants`, `finie`), la saison annoncée, le carnet, les divisions, la fenêtre d'une saison écrite en SQL |
| `src/server/ferveur/virage.js`, `src/server/souvenirs/` | les chants comptés dans l'upsert de présence qui existait, par mi-temps, sans requête de plus |

**Sept défauts en ligne, corrigés avant de bâtir dessus**, parce que le chantier
ajoutait des versements exactement à ces endroits. Ils avaient été établis en
lisant le code ; chacun a reçu son test, et deux courses ont été rendues
certaines par un crochet posé entre la lecture et l'écriture — dix ouvertures
de booster simultanées ne suffisaient pas à faire voir E3. Un forfait
payait deux fois le joueur resté — écharpes, XP et part du KOP —, la fin d'un
duel s'exécutant deux fois (E1). Deux gains d'XP simultanés lisaient la même XP
et payaient un palier deux fois, ou jamais (E2). La recharge des boosters
pouvait écraser un débit fait au même instant (E3), un vote de KOP échu débiter
le pot deux fois (E4), et le compte à rebours d'un vote durait deux heures et
trois minutes de trop après un rechargement sur une base à l'heure de Zurich
(E5). Le classement « saison » additionnait tout depuis toujours (E6). Et la
suppression d'un compte ne touchait pas les tables neuves, et visait
l'identifiant interne au lieu du public (M8).

Les documents qui le disent : `DEPLOIEMENT.md` (le fichier de schéma, la
manœuvre après le Manager, la requête de détection en lecture seule sur le grand
livre, le recalage des seuils), `CONFIDENTIALITE.md` (ce qui devient public — le
Fanzzy équipé, le niveau, la division — et ce qui est gardé : l'activité du jour
quatre cents jours, les nouveautés soixante jours), `JURIDIQUE.md` (un fait
corrigé — l'abonnement livre des boosters, alors que le dossier disait le
contraire — et trois questions : la carte de présence pour un public qui compte
des mineurs, les crans, les boosters offerts).

### Les pièges de l'atelier

**Une clé étrangère vers `users` faisait tomber des suites que personne ne
pouvait corriger.** Le plan posait la cascade sur les trois tables du joueur.
Chaque suite vide la base avec sa propre liste de `DROP TABLE`, et une fille de
`users` absente de cette liste fait échouer le `DROP` de `users` : quinze suites
d'aucun périmètre de la vague seraient tombées avant leur premier contrôle. Les
tables n'ont pas de clé étrangère — le grand livre n'en avait déjà pas —, la
suppression d'un compte retire nommément leurs lignes, et `schema:smoke` rougit
si on en remet une.

**MariaDB 11.6 signale la course autrement.** L'isolation par instantané,
allumée par défaut depuis cette version (le poste tourne en 12.3), signale par
`ER_CHECKREAD` la course que les versions d'avant signalaient par
`ER_DUP_ENTRY`. La version de la production n'est pas connue d'ici : `verser`
rejoue une fois la transaction perdue, qui voit alors la ligne de l'autre et rend
« déjà ». Conséquence pour tout appelant : son recompte et son gain peuvent être
appelés deux fois, et ne doivent que lire.

**Un verrou tenu et une lecture par le pool affament le serveur.** Le grand livre
appelle la recharge en tenant le verrou de la bourse, et la recharge lisait
l'abonnement par le pool. Huit réclamations simultanées du même joueur — le pool
de production en a huit — auraient tenu toutes les connexions en attente de ce
verrou, et celle qui le tient n'en aurait plus trouvé : tout le serveur aurait
attendu cinquante secondes. La recharge lit l'abonnement dans un souvenir de
moins de deux minutes, posé avant de prendre une connexion. Même famille, plus
petite : un `INSERT IGNORE` sur une bourse existante, dans la transaction, pose
un verrou partagé, et deux versements du même joueur s'interbloquaient ; la
bourse s'ouvre avant.

**Le hub allait déclencher des appels à l'API sportive, et la suite ne le voyait
pas.** Pour dire si une mission peut encore changer (`relancable`), chaque
lecture du quotidien parcourait l'ordre du jour, et une mission du Virage
suffisait à lire la journée du football — une fois le cache de quarante-cinq
secondes expiré, un appel `/fixtures` à chaque arrivée au hub, de jour comme de
nuit. Le budget de
requêtes mesuré par la suite le taisait : la doublure de la journée ne passait
pas par le pool. Seuls le tirage et la relance lisent maintenant la journée, et
notent leur relevé une minute ; sans relevé valable, la condition est présumée
remplie, et une relance présumée à tort coûte un « aucune autre mission », jamais
une relance. La doublure passe par le pool, comme en production.

**Ce que l'abonnement ouvre payait.** Un abonné porte n'importe quelle tenue
publiée, et la porter l'inscrit dans `user_skins` comme une tenue gagnée ; les
crans comptaient les tenues : porter les tenues de l'amorce à chaque âge donnait
des écharpes et des boosters, de l'argent réel changé en récompenses. Rien dans
une ligne ne distingue une tenue tirée, achetée ou prise par l'abonnement : la
seule règle qui tienne sans colonne nouvelle est de ne payer **aucune** tenue. Les
crans comptent la bibliothèque sans elles (`paliers.gagnes`, `paliers.possibles`),
pour tout le monde : l'univers des crans passe de 635 objets à 445, de 25 crans à
17 ; `collection.cran` à 18 rendrait le rythme d'avant. Rien n'était versé en
production.

**Le KOP vendait deux bonus qu'aucun moteur ne lit.** « La quête » (`scarvesBonus`,
900 écharpes) et « Mur de bâches » (`parryBonus`, `parryResist`, 500) : un KOP
qui les votait payait pour rien. Le serveur ne vend plus que les bonus dont le
Virage lit chaque clé, et la suite confronte cette liste au code du Virage dans
les deux sens. Le même défaut vit hors du KOP : `parryBonus` et `parryResist`
sont portés par des dizaines de Fanzzy, par des pièces d'équipement et par une
carte d'action épique, « Filet de chantier », que rien ne lit.

**Un match à cheval sur minuit, et une victoire en trois secondes.** La présence
au Virage est une ligne par match, datée de sa dernière poussée : un match
commencé à 23 h 30 faisait fondre la mission de la veille au moment de la
réclamer. Les chants comptent pour le jour du **coup d'envoi**. Et un second
compte qui entre en file et abandonne aussitôt offrait une victoire, payée en
entier : un duel ne compte que s'il a duré une minute et n'a pas été quitté.

**Un duel fermé effaçait le duel suivant.** `fermer` retirait de la table des
salles tous les membres, sans regarder où chacun pointait : un joueur dont la
place avait été reprise et qui était reparti en file perdait son **second** duel
à la fermeture du premier. Elle ne retire plus que ce qui pointe encore sur la
salle qu'elle ferme.

**La cérémonie prenait un objet plat pour un objet parti.** Avec `retourner`,
`FX.reveler` ouvre l'objet en partant d'une largeur nulle ; elle guettait aussi
l'objet qui quitte l'écran, le voyait sans largeur à la première image, et se
résolvait en cinquante millisecondes sans rien jouer. Elle ne s'arrête plus que
sur un objet retiré du document ou sans boîte. Et une vibration demandée avant
le premier toucher du joueur sur la page, Chrome la refuse et l'écrit en erreur :
`FX` n'en demande plus avant.

**La pastille « +N » ne s'éteignait plus.** Le lot 2 l'éteignait au toucher, en
mémoire locale ; servie par le serveur, elle n'avait plus personne pour
l'éteindre, puisque le classeur ne le fait pas encore (lot 4), et le « +5 » d'un
premier booster serait resté soixante jours. Toucher FANZZY met de côté les clés
comptées ; le hub les éteint à son retour, par clés et non « tout », pour qu'une
carte arrivée entre-temps garde son « +N ».

**Un commit pris pendant l'atelier est parti en ligne sans son schéma.** Voir
« En ligne », plus bas. C'est le piège du 8 septembre une troisième fois, et
cette fois rien n'a cassé : parce que chaque lecteur tolère l'absence de ce qui
suit, et que le démarrage le dit.

**Deux outils, deux oublis.** Le banc du son, en régénérant `NIVEAUX.md`, avait
effacé la section écrite à la main sur le mixage d'avant : elle a été remise.
Et `accueil-ui-smoke` ne vide pas la table `saisons` : une table laissée par une
autre suite peut lui faire lire « 10 / 25 » au lieu de « 14 / 25 ».

### Ce que la mesure dit après

L'état de départ est celui du commit `7dc5464`, mesuré le 2 octobre au soir avec
la mesure ouverte (`audit-ui/3`) ; la fin, le sixième tour, le 3 octobre de
7 h 39 à 7 h 47, sur la copie de travail.

| Relevé, hors `/admin` et `/diagnostic` (360 × 640 / 400 × 800 / 768 × 1024) | départ | fin |
|---|---|---|
| texte sous 11 px, opacité sous 0,85, flou, débordement, hors écran, cible sous 44 px, coupé, police de repli, petit or | 0 / 0 / 0 | 0 / 0 / 0 |
| pâle à l'intérieur, sur fond uni et sous le grain | 0 / 0 / 0 | 0 / 0 / 0 |
| pâle au soleil, sur fond uni | 101 / 101 / 101 | 20 / 20 / 20 |
| pâle au soleil, sous le grain | 64 / 64 / 63 | 67 / 67 / 67 |
| textes lus sous le grain | 160 / 160 / 161 | 225 / 225 / 244 |
| textes encore non mesurables | 667 / 665 / 673 | 427 / 425 / 433 |
| textes | 1 067 / 1 065 / 1 120 | 877 / 875 / 944 |
| dont textes à soi, hors des feuilles | 190 / 190 / 206 | 153 / 153 / 187 |
| coupé (lignes) | 15 / 3 / 45 | 15 / 3 / 45 |

**Au soleil, 165 → 87 sur les pages, 79 → 21 dans les états** à 360 × 640 ; 768
× 1024 donne la même chose. Écran par écran : `/profil` 42 → 9, `/aide` 32 → 2,
la vitrine 8 → 2, `/collection` 6 → 1, `/carnet` 9 → 6, `/teletext` 4 → 3, le hub
14 → 13, `/abonnement` 2 → 1, `/virage` 1 → 0 ; `/boosters` (15), `/classement`
(2), `/kop` (1) et `/amis` (2) ne bougent pas. Ce qui reste est fait de faces
décidées — la craie sur les faces vives, l'encre sur l'or —, de la craie sur le
parpaing (3,7:1 : les douze séries de la base de test au kiosque) et de quelques
tampons pleins. La craie voilée du profil et des missions est partie avec leur
réécriture. Les textes baissent de 1 067 à 877 surtout parce que la boutique en
montrait 238, et 45 depuis qu'elle tient en deux écrans.

**Trois comptes montent, et seulement parce que la mesure voit plus** :
`/boutique` 3 → 6 (ses étiquettes, posées maintenant sur un sticker uni, sont
mesurables : les prix or à 3,9, GAGNER à 2,4, l'onglet or), `booster@carte`
2 → 4 (le sticker COMMUNE, le tampon NOUVEAU) et `booster@butin` 6 → 12 (NOUVEAU
sur la flare, ENCORE UN, LE CLASSEUR, MON DECK). Ce sont, pour l'essentiel, des
faces décidées.

| État (360 × 640) | textes | au soleil |
|---|---|---|
| l'ouverture à 2 s | 8 → 8 | 3 → 0 |
| le tiroir de `/classement` | 30 → 30 | 10 → 2 |
| la bande du HUD | 2 → 2 | 0 → 0 |
| une carte révélée | 8 → 7 | 2 → 4 |
| le ticket du gain | — → 3 | — → 0 |
| le butin | 17 → 25 | 6 → 12 |
| un classement rempli | 83 → 93 | 58 → 3 |

Mesuré à part, sur la copie de travail : l'étal tient en 1 031 pixels ; la ligne
épinglée est visible à 0, 400 et 610 pixels de défilement et en bout de liste ;
le kiosque est propre à 320, 400 et 768 pixels avec une série comme avec treize ;
la cérémonie suit ses quatre degrés — la rare en 608 ms avec son tic, l'épique en
1 206 avec son carillon et sa vibration, la légendaire en 1 628 avec son
rugissement, sa vibration, son tampon et sa secousse —, et sous le calme rien ne
sonne, ne vibre ni ne tremble ; un bonus ou une
mission envoyés deux ou trois fois à la fois, par l'API comme par deux onglets
et un double clic, sont versés une fois, avec une seule ligne au grand livre ; au
plus deux animations infinies par écran, aucune en mouvement réduit ; le
marqueur, cinq emplois. Les requêtes `/api` de chaque écran, avant et après : le
hub gagne la lecture du quotidien et la marque de visite, `/profil` celles de
`/api/rank/moi`, du quotidien et du catalogue, `/abonnement` le catalogue de la
boutique ; les autres sont égaux. **Aucun appel à l'API sportive** au journal.
Le tiroir fait 957 pixels à 360 : un écran et demi, juste à la limite.

### Éprouvé

Les contrôles statiques sont verts : `npm run pages` (soixante-dix-neuf
contrôles), `npm run cablage` (le quotidien monté, la sonde du jour de jeu dans
`/healthz`, cinq paquets de production), `npm run promesses` (soixante-deux
adresses appelées depuis vingt-quatre pages et vingt-cinq scripts, toutes
servies), `npm run pages:navigateur`, et `npm run schema:smoke` — trente-quatre
contrôles, le schéma appliqué dans l'ordre puis une seconde fois au même état,
47 tables.

Le dernier passage de `tout-tester`, le 3 octobre de 6 h 43 à 7 h 05, compte
**soixante et une suites et 4 343 contrôles** en vingt et une minutes et demie,
contre cinquante-huit et 3 376 à la fin du lot 2. Trois suites sont nouvelles :
`recompenses:smoke` (89), `quotidien:smoke` (205) et `son:smoke` (110), sans
base. `deck:ui` (un rouge) et `nvn:ui` (trois) restent rouges à l'identique,
comme avant le lot 0. **`fanzzy:smoke` est vert** pour la première fois depuis
le lot 0, 214 contrôles : son scénario habillait un Fanzzy sans l'équiper, alors
que `tenuesParAge` est la garde-robe du Fanzzy équipé. `accueil:ui` est une
intermittence, non attribuée : rouge dans `tout-tester`, verte seule au sixième
passage (214), trois contrôles différents tombés selon les passages, dont un
causé par la table `saisons` qu'elle ne vide pas. `abo:smoke` est vert, lancé à
6 h 44.

Le contrat a été vérifié sur un vrai serveur et la base de test, champ par
champ, avec une série ouverte et une saison 2 annoncée, puis avec treize
séries : aucun écart réel sur environ cent dix contrôles, et une faute de
documentation (« Ce qui reste »). Les suites des neuf périmètres serveur ont
chacune été cassées exprès sur leurs correctifs, contrôle par contrôle.

Quatre suites d'interface ont suivi un comportement voulu par l'atelier, et
chacune garde son sens : `boosters:ui` (la minuterie, la bâche or), `profil:ui`
(la feuille de match, la corde), `aide:ui` (une seule bâche, l'étape suivante)
et `accueil:ui` (le « +N » servi par le serveur, éteint au retour, et son repli
sur la mémoire de l'appareil).

### En ligne

**Le commit `e21a923` (« Maj V03102026.0112 ») est en ligne depuis 1 h 13 environ
le 3 octobre.** Gaël l'a pris pendant l'atelier, entre le deuxième tour de
vérification (fini à 1 h 04) et le troisième, avec les documents du lot 2 ; il
est poussé, et la production le sert : relevé à 8 h 25, `son.js`, `fx.js`,
`ui.css`, `boosters.html`, `profil.html` et `aide.html` sont ceux du commit, octet
pour octet, et `uptime_s` dit un redémarrage vers 1 h 13. **Mais `sql/quotidien.sql`
n'a pas été appliqué** : `/healthz` répond `ok: false`, la panne « SCHÉMA
INCOMPLET » ne nommant que ce fichier — ses quatre tables et ses neuf colonnes.
Rien n'est cassé pour un joueur : le quotidien répond « inactif », les missions
n'apparaissent pas, le reste du jeu tourne. La sonde du jour de jeu, elle, a parlé :
le jour change à 00:00, heure de Zurich.

Trente-six fichiers ont changé depuis ce commit, et ne sont pas en ligne : les
corrections des tours 3 à 6 et du regard, dont trois côté serveur qui comptent
— la lecture de la journée du football à chaque arrivée au hub, les crans qui
payaient les tenues, les deux bonus de KOP vendus pour rien. **Appliquer le schéma sur le code en
ligne seul les allumerait** : la livraison se fait avec eux. `A-DEPLOYER.md` dit
l'ordre.

### Ce qui reste

D'abord, hors du code :

- **verser dans le dépôt** les documents du chantier serveur — `SERVEUR.md`,
  `CONTRATS.md`, `PLAN.md`, `ECARTS.md` —, que le code cite et que personne ne
  peut ouvrir hors de l'atelier ;
- **les décisions rendues à Gaël** par le chantier : l'inflation des écharpes
  avant la saison 2 ; l'XP du Virage (quinze par match poussé, avec le bilan du
  lot 6) ; brancher ou retirer « La quête » et « Mur de bâches », et que faire
  des KOP qui les ont déjà payés (une requête en lecture seule est dans
  `ECARTS.md`) ; la ferveur arrondie à zéro dans une tribune de plus de
  trente-quatre personnes ; la saison 2, proposée « La trêve », du 21 décembre au
  28 février, avec LES HÉROS DU CANAPÉ ; payer ou non les divisions ; le dossier
  du juriste ; un bonus de KOP voté après la fin d'une saison, payé et sans
  effet ; le rang de la racine de `/api/rank/moi`, qui compte encore les comptes
  supprimés ; les tenues prises par l'abonnement, qui pèsent aussi sur le tirage
  — l'abonné qui les a portées reçoit une poignée d'écharpes là où un joueur
  gratuit tire une tenue, de l'ordre de cinq écharpes par booster ;
  `parryBonus` et `parryResist`, lus par aucun moteur ; et le nom de la saison 1,
  « Le premier virage » dans `sql/saisons.sql`, « La reprise » partout ailleurs ;
- après la mise en ligne : la fin de la saison 1, le carnet recalé si les
  missions arrivent après le 19 octobre, les seuils de division (`DEPLOIEMENT.md`,
  « Après la livraison du quotidien »).

Puis, relevé au dernier tour et non corrigé : `/api/rank/moi` sert des champs
que le contrat ne déclare pas — `avatar` et `niveau` à la racine, `saison.fin`,
`saison.joursRestants` et `saison.finie` — dont les écrans dépendent
(« SAISON 1 · 31 JOURS », l'âge de l'avatar du profil) ; le contrat doit les
déclarer, `classement-smoke` voir `joursRestants`, et un commentaire de
`classement.html` qui dit qu'il les lira « le jour où » est périmé.

Puis :

- **le sachet de LA REPRISE n'a pas de visuel** (`pack-la-reprise`, absent de
  la table `ART` de `cartes.js`) : au centre du kiosque de production, sous les
  projecteurs, c'est le repli dessiné par le code, une carte plate ;
- la réserve est encore dessinée de trois façons : en fentes jusqu'à cinq places
  au kiosque, jusqu'à sept à la boutique, par son propre code, et sous un autre
  pictogramme dans la barre ;
- les insignes du carnet (le liseré et le tampon S1), versés mais ni servis ni
  dessinés ; `JURIDIQUE.md`, qui ne dit pas encore que les crans ne comptent pas
  les tenues ; le booster des premiers pas, qui mange lui aussi la recharge en
  attente (`src/server/aide/index.js`, hors de la vague) ; `estAbonne` sur la
  connexion de l'appelant ; le booster de l'abonnement, livré à la souscription
  et non à chaque échéance ; l'`ALTER` à trois colonnes de `sql/couleurs.sql`,
  dont le démarrage ne contrôle que la première ;
- la place de la fête de niveau dans `ui.css`, où l'ancienne boîte « premium »
  est encore écrite ;
- les constats de détail des critiques, laissés en l'état : l'étoile et l'éclat
  des formes épique et légendaire, que leur mot cache presque en entier ; le
  scotch de l'album, invisible sur le kraft éclairci ; le ticket du butin, qui
  couvre LE CLASSEUR et MON DECK trois secondes ; le ticket de gain des missions,
  qui écrit « +40 xp » en minuscules et se coupe à 360 ; cinq RÉCUPÉRER sur un
  même écran sans TOUT RÉCUPÉRER, que le serveur sait faire ; le classement vide
  qui le dit trois fois ; la carte de présence, sans « J1 / 7 » ni le booster
  écrit sous la septième case ; les descriptions des bonus du KOP, qui coupent
  « 15 / % » en fin de ligne (`src/shared/kop.js`) ; « Supprimer définitivement
  mon compte », 2,6:1 au soleil ;
- l'audit : le tirage du booster, au hasard ; un état qui ouvrirait LA REPRISE
  plutôt que la première des treize séries ; le contraste d'un pseudo-élément ou
  d'un champ ; un texte couvert par un autre élément ;
- `accueil-ui-smoke`, qui ne vide pas la table `saisons` ;
- resté du lot 1 : `data-economie` sous `saveData`, que ni `fx.js` ni `menu.js` ne
  posent.

**Hors de cet atelier, et c'est la suite :** la collection, le classeur, la fiche
et la carte elle-même (lot 4), les arènes, le bilan de tribune et la présence
(lot 6).

---

## 4 quadragies quater. La collection FAIT MAIN — une carte pour sept écrans, un album, une fiche qui tient

Du matin du 3 octobre 2026 à l'après-midi du 4, un atelier a mené le **lot 4**
de la refonte : la carte elle-même, que sept écrans montrent ; le classeur et le
vestiaire de `/fanzzy` ; la fiche d'un Fanzzy ; `/collection` ; et les **cinq
reliquats** que la vague des lots 3 et 5 avait laissés — la réserve de boosters
dessinée de trois façons, la fête de niveau sans place dans `ui.css`, les
insignes du carnet versés mais ni servis ni dessinés, le booster des premiers
pas qui mangeait la recharge en attente, et le contrat de `/api/rank/moi`. Ce
qui se voit à la fin tient en quatre phrases : la carte est un sticker qu'on a
envie de coller, et elle dit sa rareté par sa couleur, sa forme, son mot et sa
matière ; le classeur et la collection sont un même album, qu'on feuillette
série par série ; la fiche se lit d'un coup d'œil, sans défiler ; une carte se
regarde partout dans la même vitrine.

L'état de départ est le commit `2ff45f9`, celui de la vague précédente. Le
travail a été partagé comme aux lots précédents, sur des clés de périmètre
fermées aux fichiers disjoints : quatorze (`mesure`, `feuilles-css`, `carte`,
`classeur`, `fiche`, `collection`, `fx`, `kiosque`, `boutique`,
`barre-tiroir`, `profil-classement`, `pages-autres`, `serveur-aide`,
`serveur-carnet`), plus `paquet` pour `package.json` et `tests` pour les suites
qui lisent un comportement voulu. La mesure d'abord, seule avec la base ; puis
les briques — la carte et son écran de test, les briques communes de `ui.css`,
les deux périmètres du serveur — ; puis huit écrans en parallèle, qui ont codé
contre les deux documents de la carte et des briques et se sont échangé leurs
besoins par clé. Quatre tours de vérification, avec des corrections par
périmètre entre eux ; puis le regard : une critique visuelle, notée 6,5 sur 10,
et deux relectures adverses, du code des écrans et du serveur ; leurs constats
importants ont été corrigés, et deux tours ont suivi. Le sixième n'a trouvé que
trois fautes mineures, laissées en l'état (voir « Ce qui reste »).

**Gaël a commité le travail en cours pendant la vérification** : `60fe268`
(« Maj V03102026.1747 »), le 3 octobre à 17 h 47, poussé sur `origin/main` et
pas mis en ligne. Seize fichiers ont changé depuis, ceux que le dernier tour a
vérifiés ; il les a commités le 4 octobre à 17 h 05 (`7450c03`, « Maj
V04102026.1624 »), avec cette section, et mis en ligne aussitôt (« En ligne »,
plus bas).

**Les trois documents de l'atelier sont restés dans son bac à sable** :
`CARTE.md` (ce que `cardHTML` rend, ses options, ce que les écrans doivent
savoir), `BRIQUES.md` (le balisage exact des briques nouvelles) et `MESURE.md`
(les commandes et les chiffres de départ). Ce qui doit en durer est dans le
code — l'en-tête de `cardHTML`, le commentaire de chaque brique de `ui.css`,
l'en-tête de `scripts/audit-ui.mjs` — et dans `ETAT.md`, § 4.

### Mesurer d'abord : la collection d'un joueur qui en a une

Le joueur de l'audit n'a pas une carte, et c'est ce que tout relevé d'avant
mesure : les pages le gardent. Mais une collection vide ne montre ni doublon, ni
légendaire, ni une carte à soi à côté d'une carte qui manque — exactement ce que
le lot redessinait. `--etats` regarde donc **sept écrans de plus**, tous après le
classement d'un joueur classé, si bien qu'aucun relevé d'avant ne les voit :

| État | Ce que fait l'audit |
|---|---|
| `classeur@/fanzzy` | `/fanzzy?ecran=dex` (à défaut, `[data-go="dex"]`) ; la série semée amenée à l'écran par son onglet `[data-serie]`, sinon en défilant jusqu'à sa première carte ; où est chaque carte semée (`vus` : écran, plus loin, caché, absent) |
| `fiche@possédé`, `fiche@manquant` | `/fanzzy/TR1` et `/fanzzy/TR3`, mesurées seulement si le texte nomme le personnage |
| `vitrine@possédée`, `vitrine@manquante` | `/collection`, l'album ouvert par `[data-vue="fanzzy"]`, la case de TR2 ou de TR3 touchée (`.fz[data-id]`, puis `[data-open]`), un `[role="dialog"]` attendu et mesuré sous sa portée |
| `album@/collection` | la sous-vue ouverte par `[data-vue="fanzzy"]`, attendue en `.tbf-album` ; **absente au départ**, et dite telle |
| `profil@insignes` | deux lignes `carnet` du grand livre cousues au joueur de l'audit (le liseré, puis le tampon S1), `/api/quotidien` relu, `/profil` visité aux trois formats, les lignes retirées ensuite |

Pour les six premiers, un **collectionneur par format** est semé, lu dans
`/api/fanzzy/dex` : la première série ouverte qui a ce qu'il faut — sur la base
de test, LA TRIBUNE (LE VIRAGE IMPOSSIBLE, avant elle, n'a que deux lignées). Il
porte TR1 au deuxième âge, équipé ; TR2 en trois exemplaires ; TR4 et la
légendaire TR12, NOUVEAU ; il lui manque TR3 ; et 500 écharpes, 6 boosters,
400 XP, Sion. Ses nouveautés sont resemées avant chaque visite : le classeur
éteint ce qu'il a montré, la fiche sa clé. Le plan est rangé dans le JSON
(`collectionSemee`, `insignesSemes`, `formatsEtats`), qui reste `audit-ui/3` :
rien que des ajouts. Chaque état nomme sa panne (genre « état ») et photographie
ce qu'il a trouvé, au lieu d'arrêter l'audit. Les accroches qu'il lit
(`?ecran=dex`, `.fz[data-id]`, `[data-serie]`, `[data-vue="fanzzy"]`,
`.tbf-album`, `[role="dialog"]`) ont été demandées par écrit aux périmètres qui
les posent, et posées.

**Chrome ne dit plus que le réseau s'est tu.** Sur le classeur d'avant le lot —
733 cartes, 573 images paresseuses —, `networkidle0` n'arrivait jamais à partir
du deuxième contexte du navigateur, alors que ni puppeteer ni le protocole de
débogage ne voyaient une requête en vol : la page attendait vingt secondes, deux
fois, et la case restait vide. Les états de la collection arrivent donc par
`load`, puis attendent que **notre** serveur se taise — aucune requête vers
notre origine depuis 500 ms, quinze secondes au plus. Les pages gardent
`networkidle0`, et ce chemin ne leur sert qu'en troisième essai, après deux
échecs, noté (`essais: 3`) : aucune n'en a eu besoin.

**Un mot pour le lecteur d'écran se comptait comme un texte qu'on lit.** Une
boîte d'un pixel que sa propre découpe efface (`.tbf-vh`, le `.vh` du profil et
du classement, le `.long` du Virage) était relevée, pâle au soleil compris : le
prix « 25 écharpes » de la vitrine l'était deux fois, la seconde par
« écharpes », que personne ne voit. Ce qu'une découpe rogne à rien sort
maintenant de tout relevé, nommé à part (`rognes`) : le `textes` d'avant vaut le
nouveau plus `rognes`. C'est ce qui fait baisser `/profil` de six textes,
`/virage` de trois et un classement rempli de quatorze, sans que rien n'y ait
changé.

**Le départ s'est contrôlé lui-même.** Pris le 3 octobre de 11 h 03 à 11 h 11,
au commit `2ff45f9`, `public/` sans modification, il a été comparé au dernier
relevé de la vague précédente : cent cases, tous les comptes et toutes les
listes de trouvailles élément par élément, plus la barre — aucun écart, sinon
quatre cases du kiosque dont le tirage est au hasard. Ce qu'il disait : **le
classeur était presque aveugle** — 750 textes sans fond mesurable, le nom et les
marques de chaque carte posés sur l'illustration ou un dégradé —, et
`/collection` aussi, 291 sur 324. Le compte au soleil n'y prouvait rien ; c'est
« non mesurables » qu'il fallait faire tomber.

### La carte : un sticker, et sa rareté dite quatre fois

`cardHTML` (`public/cartes.js`, `public/cartes.css`) dessine la carte du jeu pour
sept écrans — le classeur, la collection, l'ouverture d'un booster, la
bienvenue, le profil, l'aide, et ce que le deck reprend de son dessin. Elle a
été refaite **une fois**, sans changer de signature : tout ce qui s'ajoute est
une option facultative, et ce que lisent le JavaScript et les suites (`.nm`,
`.pip`, `.art`, `.illu`, `data-id`, `r-<rareté>`, `holo`) est resté.

**Le sticker de carte.** La plaque de sa rareté en fond, le personnage devant ;
un bord de découpe craie, un cerne d'encre, une ombre dure ; le nom en
banderole sur une bande craie de travers, qui passe les deux bords et prend
autant de lignes qu'il lui en faut, sans couper un mot ; le pin de famille et
l'âge en haut à gauche — un badge sous 150 pixels de large, le tampon vert
« ÉVO 2 » au-dessus, avec le pied « VOIX · POUSSÉE 64 » dans la bande ; les
doublons « ×3 », AVATAR et TITULAIRE en stickers. Tout est en `--u`, un
centième de la carte, avec des planchers : rien n'est écrit sous 11 pixels, de
86 à 300 pixels de large. Le seuil du pied, 150 pixels, n'a pas bougé.

**La rareté se dit quatre fois** : par la couleur ; par la **forme**
(`.tbf-forme` : rectangle, rond, étoile, éclat) ; par son **mot**, toujours, en
grille comprise (amendement 20) ; par la **matière** — carton mat pour la
commune, liseré plastifié pour la rare, holo pour l'épique, liseré d'or pour la
légendaire. Les losanges et les ★/♛ sont partis partout, deck compris ;
`rarMark` rend la forme, sous la même signature. La matière est **figée en
grille** et ne bouge qu'à la vitrine, sur la fiche et à la révélation : un seul
mouvement par carte — la dérive de l'épique, ou le liseré qui tourne — plus la
respiration du personnage, et trois cartes animées au plus à l'écran ;
`.fz-fige` arrête le reste (`.kq-fige`, celui du kiosque, ne suffisait plus), et
`.tbf-album` fige toujours.

**La plaque suit la rareté, plus l'âge** (`palierDecor`,
`public/fanzzy-fond.js`). Elle avait suivi l'âge, pour que le personnage qu'on
fait grandir change de lieu ; mais un état rare tiré au premier âge, une tenue
épique, une pièce rare se tenaient alors dans le gradin gris d'une commune, sous
un liseré bleu ou violet — deux codes pour une seule information. Dans une
lignée, rien ne change : ses trois âges sont commune, rare et épique. Les seize
plaques de tenue restent au vestiaire.

**Ce qu'on n'a pas** (`verrou`) : un pochoir gris sous une trame, un scotch en
croix, le cadenas sur un rond craie, et le numéro de pochette « N° 013 » à la
place du nom (`numero`), le nom restant pour le lecteur d'écran ; `raison` écrit
ce qui ouvre la case (« NIV. 10 »). Un **âge secret** (`secret`) floute le
dessin, dit « ÂGE À VENIR » et porte son sticker de prix (`prix`). Le **verso**
n'est construit qu'au premier retournement (`flip`, `TBF_CARTES.retourner`).

**L'étiquette d'état passe dans le flux** de la bande du nom (`.sur`) : un nom
de trois lignes la repousse, elle ne passe plus jamais dessous. Le correctif
provisoire du lot 1 (`--lignes-nom` et le `@container` de `.tbf-etiq`) est
retiré de `ui.css`. Mesuré à la fin sur cent vingt cartes de 86 à 300 pixels aux
noms les plus longs : jamais sous le nom ; elle touche la boîte de ligne du nom
dans trente et un cas, à six à huit pixels au-dessus des lettres.

**Quatre corrections après la critique**, chacune gardée par la suite de la
carte :

- *l'étoile et l'éclat se voient.* Leur étiquette, posée à cheval sur leur pied,
  en cachait 30 à 45 % de 86 à 200 pixels de carte : on lisait trois rectangles
  et un rond, et la forme ne distinguait plus la moitié des raretés. Elle descend
  sous la forme, qui passe à 26 pixels en grille au lieu de 22 : la face se voit
  à 95 % au moins, et la suite en exige 85 ;
- *la silhouette se tire d'une image détourée.* Éteint au noir puis remonté en
  gris, un buste opaque — la Clé du Local, le troisième âge de Gosier — devenait
  une dalle grise tachée de noir : les cartes les plus désirables étaient les plus
  ternes. `verrou` prend le plein-pied, détouré, et `brightness(0)` ne se pose
  plus sur une image opaque ;
- *une carte qu'on n'a pas ne bouge pas* : la légendaire manquante de la vitrine
  faisait tourner son liseré d'or autour d'une silhouette qui respirait ;
- *le personnage en pied seulement quand on le demande* (`pied`). Posé par défaut
  sur toute carte qui n'était pas de grille, il faisait télécharger chaque carte
  d'un booster deux fois — en pied à la révélation, en buste au butin — et neuf
  plein-pieds d'un coup à la bienvenue, 55 Ko pièce contre 14. La vitrine et la
  fiche le demandent ; le reste garde le buste.

**L'écran de test**, demandé par le brief : `scripts/cartes-ui-smoke.mjs`,
inscrite sous `cartes:ui`, **sans base**. Elle monte dans Chrome une planche
faite par les vraies fonctions de `cartes.js` sur le vrai catalogue — cinq
largeurs (86, 110, 150, 200 et 300 pixels) × quatre raretés × les états
(possédée, manquante avec son numéro ou sa raison, âge secret, doublon, AVATAR,
TITULAIRE, retournée, noms d'une, deux et trois lignes), les autres sortes de
carte, la vitrine animée et la pile figée — et la mesure : aucun texte sous
11 pixels, coupé ou recouvert ; l'étiquette au-dessus du nom ; la forme et son
mot partout, la face de l'étoile et de l'éclat visible ; la silhouette
détourée ; plus aucun losange ; pas de petit or ; le nom à 4,5:1 sur sa bande,
au soleil compris ; aucune animation infinie en grille, aucune sans mouvement ;
et **les 765 noms du catalogue** dans la bande d'une carte de 86 pixels. Oswald
vient de Google Fonts, comme pour le joueur : sans réseau, la suite échoue au
lieu de mesurer dans une autre police. Elle a été cassée exprès à chaque
garde-fou — l'étiquette en absolu, une respiration non figée, la rangée posée
sur le nom, l'arrêt de la pile figée retiré, un objet à 58 %, un pin sans
repli, l'anneau après le compte à rebours, des nouveautés en `[]` — et a rougi
chaque fois. Trente-huit contrôles ; `--servir 4317` sert la planche à regarder.

### L'album : le classeur et la collection, un seul composant

`.tbf-album` (`ui.css`) est le classeur de `/fanzzy` **et** l'album Fanzzy de
`/collection`. Une page par série, qu'on tourne du doigt (`scroll-snap`) ; le
rail des séries au-dessus, chaque onglet portant `data-serie` — une série fermée
sous son cadenas, qui se touche et dit pourquoi sans s'ouvrir ; l'en-tête de la
série (emblème, nom, « 12 / 40 », la jauge-écharpe à crans, le tampon COMPLET
d'une série finie, la récompense de la série complète quand le serveur la sert) ;
la grille des cartes collées de travers sous leur scotch, et les **pochettes**
pointillées et numérotées de ce qui manque — la silhouette au pochoir pour le
premier âge, rien pour l'âge supérieur d'une lignée absente ; la légendaire
ferme sa série en case double VITRINE, où rien ne bouge. Entre le rail et la
page, les six familles en pins ronds et l'interrupteur des manquants.

**Seules la page ouverte et ses voisines sont montées.** Les autres restent des
sections vides de même largeur, et la page qui s'éloigne se vide. Mesuré à la
fin : deux ou trois pages montées sur treize, au classeur comme à
`/collection`, et un onglet lointain démonte les autres. Le classeur d'avant
montait ses 733 cartes d'un coup.

**Une lignée par rangée.** Le classeur range ses cartes par lignée — TR1, TR1B,
TR1C — : trois colonnes à 360 pixels, six à partir de 640, soit deux lignées par
rangée ; à cinq colonnes, les lignées se coupaient en travers des rangées. Les
six filtres et MANQUANTS tiennent sur une rangée à 360 pixels : la première
carte tombe à 348 pixels au lieu de 400, et la deuxième rangée entre à l'écran.

**NOUVEAU vient du serveur, et s'éteint après avoir été vu.** Le drapeau est
`nouveautes` (contrat § 2.1), le même sur tous les appareils. Une carte est vue
quand elle est restée à moitié à l'écran près d'une seconde ; les clés partent
par lots (`POST /api/fanzzy/vu`), et à la sortie de la page (`keepalive`). Le
« +N » de FANZZY sur le hub, que personne n'éteignait depuis qu'il venait du
serveur, a enfin son lecteur. NOUVEAU est collé **à cheval sur le coin
bas-gauche**, devant la bande du nom : posé d'abord sur le flanc, au tiers de la
hauteur, il couvrait avec « ×2 » le visage du personnage qu'on venait de
gagner — exactement ce qu'on voulait voir. Le butin du kiosque prend la même
place, et ne colle plus de seconde forme au coin d'une carte qui porte la sienne.

**Le même album, vraiment.** L'album de `/collection` montrait une case par
personnage, avec les numéros du classeur — N° 016, 019, 022 — : le
collectionneur cherchait des trous qui n'existaient pas, et sa case VITRINE ne
disait pas la même chose. Il range maintenant les trois âges à la suite, comme le
classeur : mesuré sur LA TRIBUNE, cent pochettes de part et d'autre, aucun
numéro différent. **Mais la fabrique des cases est recopiée** dans
`collection.html`, « trait pour trait » sur celle de `fanzzy.html` (`cartesDe`,
`caseHTML`, `vitrineHTML`) ; la sortir dans un module partagé est demandé au
périmètre de la carte, et n'est pas fait.

**La récompense d'une série complète ne paraît qu'à `/collection`.** Pour ce seul
sticker, le classeur s'était mis à appeler `/api/fanzzy/bibliotheque` — la
bibliothèque entière, cinq lectures et tout le catalogue —, ce que le brief
interdit (« aucune requête lourde de plus par écran »). L'appel est parti : au
classeur, la jauge reste nue tant que le serveur ne sert pas `paliers.series`
avec l'état (`/api/fanzzy/state`).

### Le vestiaire

MON FANZZY devient **le vestiaire** : le personnage qu'on montre aux autres, en
grand, sur une scène — une bâche au cadre de sa rareté, l'écharpe de sa série en
tête, la lueur de la rareté derrière lui (`.tbf-vestiaire`). Au-dessus, la
poche : les écharpes, la réserve de boosters et l'anneau du classeur. Dessous,
son nom en banderole, ses stats en stickers (POUSSÉE, la famille, l'ÉTAGE), la
bande de son cri, ENTRER EN DUEL avec les trois bustes du deck collés sur le coin
de la bâche — la seule lecture de plus de l'écran, `GET /api/deck/loadout`,
légère —, puis SA FICHE. L'écran ne défile pas, et ses images passent de quinze
à cinq (656 Ko à 297).

**La place vide n'existait plus.** Le brief la disait « faite au lot 2, à
garder » ; la critique l'a cherchée et n'a trouvé que « Aucun Fanzzy choisi »,
dans un panneau calme, sans un bouton, au-dessus de 470 pixels de vide — le
premier écran d'un nouveau joueur. C'est maintenant la scène sans personnage :
la photo d'une place vide en tribune, « TA PLACE EST VIDE » au marqueur sur un
papier scotché, et la bâche or OUVRIR MON PREMIER BOOSTER, la réserve en sticker
sur son coin ; à qui a des cartes sans en avoir choisi une, CHOISIR DANS LE
CLASSEUR en bleu. `fanzzy.html` charge donc Permanent Marker : six emplois du
marqueur, sur les six que permet l'amendement 6.

**Le solde n'est à l'écran qu'une fois.** À partir de 560 pixels, la barre ne
déplie plus ses jetons sur un écran qui porte sa propre bourse (`BOURSE_EN_PAGE`,
`nav.js`) — et sur `/fanzzy`, seulement tant que la poche du vestiaire est
montrée : l'album affiche des prix, et cacher la bande sur toute l'adresse y
laissait des prix sans aucun solde à côté.

### La fiche, budgétée

`/fanzzy/:id` et le panneau que le classeur ouvre par-dessus sont la même fiche
(`fanzzy-fiche.html`, `.js`, `.css`), refaite autour de **la carte du jeu tenue
en main** : elle s'incline au doigt, prend la lumière, se retourne.

**Un budget de hauteur, écrit** en tête de `fanzzy-fiche.css` pour
360 × 640 :

| bloc | pixels |
|---|---|
| la barre du jeu | 54 — 44 de boutons, 10 de marges |
| l'en-tête | 51 — le nom, et la famille en sticker de 24 px |
| la carte, seul bloc souple | 225 — la carte y fait 151 × 211 |
| la bande du cri | 48 |
| l'inventaire | 100 |
| la fiche kraft du détail | 88 |
| les actions | 74 |

La direction écrivait « barre 44 » et « en-tête 44 » ; la barre en prend 54 avec
ses marges, et la bande du cri garde 44 pixels au lieu de 32, parce qu'une cible
plus basse est relevée par l'audit. La carte ne garde donc qu'un pixel au-dessus
des 150 qui lui laissent son pied et son tampon d'âge : sur un écran plus court,
la bande du cri se replie d'abord en une plaque ronde à côté de la carte, puis
la carte rétrécit, et seulement ensuite le corps défile — jamais les actions.
Mesuré à la fin à 320 × 568, 360 × 640 et 768 × 1024, pour un possédé, un joueur
pauvre, un âge maximal, un manquant, une légendaire et RP35 : rien ne défile,
rien ne déborde.

**Sous la barre, pas par-dessus.** Le panneau couvrait la barre, à z 26 ; le HUD
(z 30) passait devant son en-tête — à 360 pixels, l'avatar mordait le compteur
d'écharpes — pendant que la flèche et le menu étaient couverts. La fiche commence
là où finit la barre (`--sous-barre`), comme à son adresse ; ce qu'elle couvre
se cache, et sort de la tabulation.

**L'inventaire en quatre rangées** qui défilent en largeur : ÂGES, en arbre de
nœuds sur une corde, le prix du suivant pendu sous la corde et son nœud qui
respire quand le solde suffit ; EFFETS ; ÉTATS en vert ; TENUES en **bleu**,
jamais violet, le ton des autres joueurs. Les tuiles d'effet prenaient la
couleur de leur famille — la VOIX dans l'or même d'ÉVOLUER, juste dessous, la
FIDÉLITÉ dans un gris d'objet éteint — : elles sont à la craie, le pin de la
famille au coin. Puis **la fiche kraft** de la pièce touchée, au noir, sans
paragraphe : un titre et des lignes de chiffres, « 65 → 80 » entre la jauge
d'avant et celle d'après.

**Les actions, hiérarchisées et toujours au même endroit** : ÉVOLUER en or, son
prix en sticker et « 500 → 410 écharpes » dessous ; à court, IL TE FAUT 15,
éteint et nommé — le retirer ferait croire que ce Fanzzy ne grandit pas ;
EMMENER EN DUEL en flare ; ME MONTRER AINSI, qui enregistre l'apparence composée
en touchant un âge, une tenue ou une expression ; et TON AVATAR, un acquis, plus
un bouton éteint. **Le non possédé** montre la carte au pochoir, la vignette du
paquet de sa série et la bâche or OUVRIR UN BOOSTER, qui mène à `/boosters`.
« 1 CHANCE SUR 3 » n'est pas écrit : le serveur ne sert pas la chance d'une
carte.

**La cérémonie d'évolution joue enfin.** Depuis que le portrait qu'on fait
évoluer est le dessin même de la carte, que `fx.js` fait respirer, la
respiration l'emportait à poids égal sur la charge et l'arrivée de
`FX.evolution` : au banc, `fzsouffle` à la place de `fxcharge`. Elles pèsent
maintenant un identifiant (`:not(#fx-nul)`). Le tampon ÉVO 2 claque sur la
carte, le ticket « −25 » descend du sticker de solde (`.tbf-glisse--haut`), le
solde décompte (`FX.compter`).

### La collection : l'album de tout ce qui se gagne

`/collection` était un accordéon de treize mille pixels. Elle s'ouvre maintenant
sur **le niveau de collectionneur** — l'anneau, le titre de palier (ABONNÉ,
ULTRA, CAPO), le prochain cran écrit par ce qu'il ouvre (« 75 → 25 ÉCHARPES »),
et RÉCUPÉRER quand quelque chose attend (contrat § 5.1) — et sur **cinq rayons**
en bâches : FANZZY, ÉTATS, TENUES, ÉQUIPEMENT, CARTES D'ACTION, chacun avec son
anneau, sa dernière pièce arrivée et la pastille de ses nouveautés. Chacun ouvre
sa sous-vue. L'audit y lit 22 textes au lieu de 324, aucun non mesurable au lieu
de 291, et plus un nom coupé (15 à 360 pixels, 45 à 768).

- **FANZZY** est l'album du classeur (plus haut) ; une case s'y ouvre dans la
  vitrine, et non sur la fiche.
- **ÉTATS et TENUES** se rangent dans le même album : le rail des séries, une
  page par série montée à ±1, les personnages dans l'ordre de leurs pochettes ;
  une planche par personnage, les âges atteints seulement ; une planche complète
  repliée en une ligne, avec PLANCHE COMPLÈTE ; le détail d'un personnage
  demandé quand sa planche approche de l'écran, une fois. À la critique, ces
  sous-vues étaient une colonne sans fin — une planche de douze cases par
  personnage, âges non atteints compris, quelque quatorze mille pixels pour
  trente-huit personnages : l'accordéon revenait par les tuiles.
- **ÉQUIPEMENT et CARTES D'ACTION** : une grille de page d'album, ce qu'on a
  collé sous son scotch, ce qu'on n'a pas sous son pochoir et sa croix, avec son
  nom — c'est précisément ce qu'on cherche.

Trois corrections de la critique, à l'accueil de la page : **l'anneau vise le
palier en cours** — « 10 / 3311 » laissait un anneau vide à l'œil, 0,3 %, à côté
d'un sticker qui promettait le cran de 25 : il vise le prochain cran, comme la
tuile du hub, au chiffre près (« 10 / 25 »), et le total reste dans son
étiquette ; **ÉQUIPEMENT est en parpaing**, et plus en violet, le ton des autres
joueurs ; au-delà de 600 pixels, l'accueil tient une colonne de 560 au lieu de
dalles vides de 370 × 130.

### La vitrine, modale commune

Toute carte de `/collection` se regarde dans **la même vitrine** (`.tbf-vitrine`,
`ui.css`), un `[role="dialog"][aria-modal="true"]` posé sur `body` : la carte
sur une scène qu'on incline au doigt (±8,5°, sous un lustre — pas sous le calme
ni le mouvement réduit), **la pile des voisines en dos** derrière elle, DANS TA
COLLECTION, son nom, ses galons (la forme, la famille, la série), le kraft de ce
qu'elle change, ses âges en tuiles avec leur portrait — flou sous cadenas pour
un âge pas atteint —, FAIRE GRANDIR en or avec son prix, VOIR SA FICHE, et les
flèches vers ses voisines. Une possédée en double porte « ×3 » en tampon plein
sur son flanc (au coin, il tombait sur l'éclat d'une légendaire). Une manquante
montre, à la place des actions, la vignette du paquet et OUVRIR UN BOOSTER. La
planche d'un personnage s'ouvre dans le même carton. La boîte ne défile qu'en
hauteur : à 360 pixels, la vitrine d'avant glissait de 62 pixels de côté sous le
doigt.

**Une possédée passe par la cérémonie de sa rareté** (`FX.reveler`), une
manquante n'a qu'un tic : fêter ce qu'on n'a pas serait la meilleure façon de ne
plus rien fêter. `FX.rare` est parti avec son dernier appelant. **Et les effets
montent au-dessus d'elle** : la vitrine est un calque plein à z 120, et la
cérémonie, à z 96, jouait dessous — une légendaire ne s'y entendait et ne s'y
sentait que par le son et la vibration. Tant que la vitrine est ouverte
(`tbf-vitrine-ouverte` sur la racine), les calques de `fx.js` montent de
quarante, toujours sous la boîte de confirmation et la fête de niveau, et la
secousse fait trembler son carton.

### Les reliquats

**La réserve de boosters est une seule brique**, `.tbf-monnaie.tbf-boosters` : un
compteur de monnaie qui porte ses sachets, au kiosque, à la boutique, dans la
bande du HUD et au vestiaire, au lieu de trois dessins dont un sous un autre
pictogramme. Deux formes, une règle (`reserveHTML`) : une place par booster
quand le plafond de ce joueur est servi et tient en cinq places, l'anneau sur la
première vide ; sinon le sachet, son compte et l'anneau à côté. Le compte est
toujours le premier `<b>`, celui que lisent la bande du HUD, `fanzzy:ui` et
`FX.compter`. Ce qu'on ne veut pas écrire — PROCHAIN, le temps — ne s'écrit
pas : le cacher par une règle laisserait un texte à zéro pixel, que l'audit
relève comme petit. La rangée du HUD se serre de 560 à 600 pixels : avec
l'anneau, la bande fait 83 pixels, et « Compétitions » se coupait avec un solde
à quatre chiffres. Mesuré à la fin : la même brique aux quatre endroits, craie,
le compte en Oswald 17 à l'encre.

**La fête de niveau a sa place dans `ui.css`**, section « la montée de niveau » :
les règles de la feuille que `niveau-fete.js` posait lui-même
(`#tbf-niv-feuille`) y sont reprises au sélecteur près, l'ancienne boîte
« premium » — dont une rosette qui tournait sans fin sous un halo doré — est
retirée, et le script ne porte plus une ligne de style. Les classes que lisent
les suites restent.

**Les insignes du carnet sont servis et dessinés.** Le liseré et le tampon S1
étaient copiés dans `recompenses.insigne` au versement, mais aucune route ne
disait qu'un joueur les portait. Ils sont à la racine de `GET /api/quotidien`,
donc aussi dans le `quotidien` de chaque geste : `insignes`, une liste de
`{ id, saison: { id, numero, nom } }`, **sans une lecture de plus** — la lecture
du grand livre que l'état faisait déjà prend la colonne (six requêtes avant, six
après). La ligne fait foi, pas le carnet d'aujourd'hui : un carnet recalé ne
retire rien à qui a récupéré. Un insigne se porte pour toujours, carnet éteint
et saison remise en brouillon compris, mais plus quand la saison est supprimée,
faute de numéro à écrire. Ordre : par numéro de saison, puis par palier — dans
l'ordre des clés, S10 passerait avant S9 —, un seul par saison et par sorte ;
absent plutôt que `[]`. Le contrat a été écrit d'abord (`serveur/CONTRATS.md`,
§ 6.1), et `quotidien:smoke` l'éprouve, vu rouge sans le code. Le profil coud
**le liseré** autour de l'anneau du buste (`.tbf-avatar[data-lisere]`, une
bande d'encre au fil de craie, ni or ni couleur de rareté), pose **le tampon
S1** sur la carte de supporter, et MA SAISON les dit en stickers ; `/aide` écrit
de nouveau « LISERÉ S1 » et « TAMPON S1 » sur les paliers qui les donnent.

**Le booster des premiers pas compte la recharge.** `recompenser`
(`src/server/aide/index.js`) ajoutait le cadeau par un `packs = packs + 1` sans
compter la recharge en attente, alors que son commentaire affirmait l'inverse :
à 11 sur 12 avec une recharge due, le cadeau menait à 12, la lecture suivante
voyait la réserve pleine et remettait la minuterie à zéro — 12 au lieu de 13,
sans que rien ne lève. Il appelle maintenant `recharger(conn, userId)` sur la
connexion de son versement, sous le `FOR UPDATE` de la bourse, avant le cadeau :
une annulation défait les deux. Un premier appel, sur le pool et hors
transaction, pose le souvenir de l'abonnement, comme le quotidien
(`avantUnBooster`) : sous le verrou, une lecture par le pool peut affamer le
serveur (4 quadragies ter). Sans porte, il lève **avant toute écriture**, comme
le grand livre. `aide-smoke` le garde : à 11 sur 12 avec une recharge due, le
booster de fin mène à 13 ; branchée sur l'aide d'avant, la suite a quinze
rouges.

**`/api/rank/moi` est au contrat.** Le code n'est pas touché : le § 14 de
`serveur/CONTRATS.md` déclare la réponse entière — la racine et ses `null`,
`tribune.couleurs`, `avatar` et `niveau` à la racine avec leurs trois cas (un
objet, `null` sans Fanzzy équipé, absent quand le serveur ne sait pas), la fin
de la saison (`fin`, `joursRestants`, `finie`), aussi écrite au § 5.2. Le § 5.1
y gagne `possibles` et la règle des crans sans les tenues.

Deux constats de détail de la critique précédente sont réglés en passant :
l'étoile et l'éclat que leur mot cachait (plus haut), et le scotch des cases,
invisible sur le kraft éclairci, qui prend un ruban au fil d'encre
(`--ruban-k`).

### Les pièges de l'atelier

**Une étiquette posée sur une forme de quinze pixels la cache.** La forme de
rareté est là pour qu'on reconnaisse la rareté sans lire : l'étoile et l'éclat,
recouverts aux deux tiers par leur mot, ne se distinguaient plus du rectangle.
Une information portée par une forme se mesure à la part visible de la forme —
c'est ce que la suite de la carte fait maintenant.

**Un pochoir ne fait une silhouette que d'une image détourée.** `brightness(0)`
sur une image opaque rend un rectangle noir, et le gris qu'on remonte dessus,
une dalle. Il faut demander l'image détourée — le plein-pied —, et ne jamais
éteindre une image pleine.

**Un emblème de couleur sur un rond de la même couleur disparaît.** Les pins de
famille posaient l'emblème émaillé de la famille — le mégaphone jaune de la
Voix, le cœur gris de la Fidélité — sur un disque de sa couleur : six filtres
sans libellé dont on ne reconnaissait pas le dessin. L'image passe en grisaille
d'encre (`grayscale(1) brightness(.45) contrast(1.8)`, la même que le repli du
pin de la carte), à 4:1 au moins sur les six ronds ; pressé, le pin prend un
bord de craie et une coche.

**Une option par défaut coûte à tous ses appelants.** `pied`, vrai par défaut sur
toute carte qui n'était pas de grille, a doublé sans bruit les téléchargements de
la révélation et de la bienvenue. Une option chère se demande.

**Deux animations au même poids : la dernière écrite gagne.** La respiration de
`fx.js` et la charge de l'évolution visaient le même dessin avec la même
spécificité ; la respiration, écrite après, l'emportait, et la cérémonie ne
jouait pas — sans une erreur. Une animation de moment doit peser plus que celle
de repos, et cela se vérifie au banc, pas en lisant la feuille.

**Un calque plein cache les effets posés dessous** — la leçon de la fête de
niveau aux lots 3 et 5, une seconde fois : la vitrine à z 120 couvrait la
cérémonie à z 96. Un calque plein qu'on ajoute fait monter les effets avec lui.

**Un panneau sous le HUD.** La fiche à z 26 laissait passer le HUD de la barre,
à z 30, devant son en-tête. Un panneau qui couvre la page commence sous la
barre ; il ne la couvre pas à moitié.

**Un correctif serveur peut n'exister que dans sa suite.** `aide-smoke` construit
l'aide avec sa propre porte de recharge ; `server.js`, lui, ne la passe pas à
`createAide` — fichier d'aucun périmètre. Sans repli, le correctif aurait été
vert en suite et absent en production. La porte se lit donc aussi sur
`globalThis.fanzzy`, que `server.js` pose en montant le module fanzzy, avant
l'aide ; et `aide-smoke` lit `server.js` pour vérifier ce câblage, que retirer la
globale — elle ressemble à un reste — casserait sans qu'aucune autre suite ne
rougisse.

**Une panne qui répond 400 sans journal ne se voit nulle part.** La route de
l'aide rendait 400, avec le code brut de MySQL quand il y en avait un, et
n'écrivait rien : la page se tait devant une erreur, si bien qu'une faute de
câblage n'aurait été vue ni à l'écran ni au journal. Elle écrit la pile
(`[aide]`) et répond 503 `aide.error.indisponible`, le code d'un bloc absent.

**Un sticker posé sur le visage cache ce qu'on vient gagner.** NOUVEAU sur le
flanc, à un tiers de la hauteur, tombait sur les yeux du buste. Un sticker se
colle sur un bord que la carte n'emploie pas : ici, le coin bas-gauche, devant
la bande du nom.

**Un anneau qui compte tout l'univers est vide à l'œil.** « 10 / 3311 » dessine
0,3 % : l'anneau compte le palier qu'on vise, et le total va dans l'étiquette.

**Une règle déplacée laisse derrière elle des commentaires qui mentent.** NOUVEAU
a changé de place dans la brique ; deux commentaires de page disent encore qu'il
est sur le flanc (« Ce qui reste »). C'est le piège de la brique faite pour une
autre page (`ETAT.md`, § 6), dans l'autre sens.

**Deux ateliers sur le même poste.** Pendant le dernier passage de toutes les
suites, un banc puppeteer de l'atelier du lot 6, dans sa propre copie, tournait
sur la machine : `virage:ui` s'est arrêtée sur un délai de navigation dépassé
(`networkidle0`, au bout de 38 secondes), puis est passée seule trois fois, 102
contrôles verts. Un rouge de délai pendant qu'un autre Chrome tourne ne s'attribue
à personne : il se relance seul.

**Deux commits pris pendant l'atelier.** `60fe268` est parti sur `origin/main`
au milieu de la vérification ; il n'a pas été mis en ligne, aucun schéma n'était
en jeu, mais il ne porte ni les corrections des tours suivants ni celles du
regard, et la branche du lot 6 en part. `7450c03` est venu à la fin, pendant
que cette trace s'écrivait : le code vérifié, cette section, une partie
seulement des changements d'`ETAT.md`, rien d'`A-DEPLOYER.md` ni de
`README.md` ; il a été mis en ligne deux minutes après. Le code en ligne est
bien celui que le sixième tour a vérifié ; les documents, eux, sont à
recommiter.

### Ce que la mesure dit après

L'état de départ est celui du commit `2ff45f9`, mesuré le 3 octobre de 11 h 03
à 11 h 11 ; la fin, le sixième tour, le 4 octobre de 16 h 24 à 16 h 32, sur la
copie de travail.

| Relevé, hors `/admin` et `/diagnostic` (360 × 640 / 400 × 800 / 768 × 1024) | départ | fin |
|---|---|---|
| texte sous 11 px, opacité sous 0,85, flou, débordement, hors écran, cible sous 44 px, coupé, police de repli, petit or, erreur de script | 0 / 0 / 0 | 0 / 0 / 0 |
| pâle à l'intérieur, sur fond uni et sous le grain | 0 / 0 / 0 | 0 / 0 / 0 |
| pâle au soleil, sur fond uni | 20 / 20 / 20 | 18 / 18 / 18 |
| pâle au soleil, sous le grain | 67 / 67 / 67 | 68 / 68 / 68 |
| textes lus sous le grain | 225 / 225 / 244 | 224 / 224 / 243 |
| textes encore non mesurables | 427 / 425 / 433 | 123 / 123 / 132 |
| textes | 877 / 875 / 944 | 571 / 571 / 638 |
| coupé (lignes) | 15 / 3 / 45 | 0 / 0 / 0 |
| hors contraste (pseudo-élément, champ) | 23 / 23 / 23 | 24 / 24 / 24 |

Les textes baissent surtout parce que `/collection` en montrait 324 et en montre
22 ; les « rognés » en retirent neuf (`/profil` et `/virage`). Au soleil,
`/fanzzy/RP1` passe de 3 + 0 à 1 + 2, `/collection` de 0 + 1 à 0 ; les autres
écrans du lot ne bougent pas — `/boosters` 0 + 15, `/boutique` 4 + 2,
`/abonnement` 0 + 1, `/profil` 1 + 8, `/fanzzy` 0 + 2. Le seul compte qui monte,
« hors contraste » sur `/fanzzy`, est la pastille « 6 » posée en `::after` sur
OUVRIR MON PREMIER BOOSTER, que l'audit ne sait pas mesurer : au banc, 17,2:1
dedans et 4,86 au soleil.

| État (360 × 640) | textes | au soleil (uni + grain) | non mesurables |
|---|---|---|---|
| le classeur | 28 → 33 | 4 + 10 → 3 + 2 | 750 → 57 |
| la fiche d'un possédé | 19 → 26 | 3 + 3 → 2 + 4 | 7 → 1 |
| la fiche d'un manquant | 18 → 16 | 3 + 0 → 1 + 2 | 9 → 0 |
| la vitrine, possédée | 24 → 28 | 4 + 11 → 4 + 10 | 1 → 0 |
| la vitrine, manquante | 21 → 24 | 3 + 8 → 2 + 8 | 1 → 0 |
| l'album de `/collection` | absent → 378 | — → 3 + 0 | — → 3 |
| le profil et ses insignes | — → 66 | — → 2 + 8 | — → 0 |
| une carte révélée | 7 → 8 | 3 + 1 → 3 + 1 | 2 → 1 |
| le butin (360 / 400 / 768, tirage au hasard) | 25 → 26 | 10 / 13 / 13 → 10 / 11 / 8 | 7 → 3 |
| un classement rempli | 93 → 79 | 0 + 3 → 0 + 3 | 0 → 0 |

Les trois noms d'âge coupés de la vitrine manquante sont partis, et l'or posé
dans un objet légendaire aussi (5 au classeur, 2 et 4 au butin) : la carte ne
porte plus de texte en or. L'ouverture, le tiroir, la bande du HUD et le ticket
du gain ne bougent pas. Le profil d'un joueur qui porte ses insignes montre le
tampon, le liseré et les deux stickers.

Mesuré à part, sur la copie de travail, sans base, aux bancs du vérificateur :
la fiche tient son budget (plus haut) ; l'album ne monte que ses voisines ;
aucune animation infinie en grille — le classeur, les cinq sous-vues, le butin —,
au plus une carte animée à l'écran sur la fiche, la vitrine, la révélation et la
bienvenue, trois animations infinies au plus (la fiche d'une légendaire), et
aucune sous le calme ni le mouvement réduit ; la carte juste à la révélation (une
seule forme, le mot, la face remplie), au butin (cinq cartes de grille, aucune
animée), à la bienvenue (neuf cartes à 320, 360 et 768 pixels, NOUVEAU sans
toucher la forme ni le pin), au deck (les formes dans leur nom, aucune rognée),
au duel et à l'aide (sans erreur). Les requêtes de chaque écran, avant et
après : `/fanzzy` gagne `GET /api/deck/loadout`, la fiche `POST /api/fanzzy/vu`
(l'extinction des nouveautés, contrat § 2) ; le classeur n'appelle pas la
bibliothèque ; les autres sont égaux.

### Éprouvé

Les contrôles statiques sont verts : `npm run pages`, `npm run cablage`,
`npm run promesses` (avec l'avertissement connu : six pages sans suite
d'interface), `npm run pages:navigateur` (les vingt-quatre écrans, `/fanzzy` et
`/fanzzy/TR32` compris, serveur muet compris) et `npm run schema:smoke` (34
contrôles). Aucun retour chariot dans les fichiers du lot.

Le dernier passage de `tout-tester`, le 4 octobre de 15 h 58 à 16 h 20, compte
**soixante-deux suites et 4 449 contrôles** en vingt-deux minutes, contre
soixante et une et 4 343 à la fin des lots 3 et 5. `cartes:ui` est nouvelle
(38, sans base). Ont grandi : `collection:smoke` (58 → 99, réécrite pour la page
du lot), `fanzzy:ui` (228 → 248), `aide:smoke` (31 → 48), `quotidien:smoke`
(205 → 216), `tour:ui` (343 → 345, qui lit maintenant l'anneau du
collectionneur). `deck:ui` (un rouge) et `nvn:ui` (trois) restent rouges à
l'identique, comme avant le lot 0. `accueil:ui` a eu deux rouges dans la série et
est verte seule : l'intermittence connue, non attribuée. `virage:ui` s'est
arrêtée dans la série et passe seule (« Les pièges »). `abo:smoke` est verte,
lancée vers 16 h, hors de la plage de minuit à deux heures.

Captures 360 et 768 relues à côté du départ et de la maquette : aucun écran
cassé ni illisible.

### En ligne

**La vague précédente était en ligne avec son schéma.** Relevé le 4 octobre à
16 h 46 : la production servait `2ff45f9`, octet pour octet (`cartes.js`,
`nav.js`, `fx.js`, `niveau-fete.js`, `fanzzy-fiche.css`, `ui.css`, et les pages
une fois retirés les `?v=` que le serveur ajoute), depuis un redémarrage le
3 octobre vers 10 h 33 ; **`/healthz` répondait `ok: true`** : Gaël avait
appliqué `sql/quotidien.sql`, et le quotidien était en ligne. L'épisode de
`e21a923` sans son schéma (4 quadragies ter, « En ligne ») est clos.

**Le lot 4 est en ligne depuis le 4 octobre vers 17 h 07.** Gaël a commité les
seize fichiers à 17 h 05 (`7450c03`), poussé, et mis en ligne par le Manager
(`"version": null`). Relevé à 17 h 09 : `uptime_s` à deux minutes, `ok: true`,
les onze scripts et feuilles comparés et neuf pages (`/fanzzy`, `/collection`,
`/boosters`, `/boutique`, `/profil`, `/aide`, `/bienvenue`, `/deck`,
`/classement`) sont ceux de `7450c03`, octet pour octet, et les marques
d'`A-DEPLOYER.md` rendent leurs valeurs attendues. Aucun schéma n'était à
appliquer. Restent à commiter la fin de cette trace — une partie d'`ETAT.md`,
`A-DEPLOYER.md`, `README.md`, et ce paragraphe — : des documents seulement.

### Ce qui reste

D'abord, les trois fautes mineures du sixième tour, non corrigées :

- deux commentaires disent encore que NOUVEAU est posé sur le flanc de la carte,
  au tiers de sa hauteur (`fanzzy.html`, vers la ligne 98 ; `collection.html`,
  vers la ligne 195) : la brique le pend au coin bas-gauche ;
- l'interrupteur du même album s'appelle MANQUANTS au classeur et « Ce qu'il me
  reste » à `/collection`, où il passe sur une seconde ligne à 360 pixels : un
  seul mot et une seule mise en page aux deux endroits.

Puis, côté serveur, ce que les écrans attendent :

- servir `paliers.series` avec `/api/fanzzy/state`, pour que le classeur montre la
  récompense d'une série complète sans lire la bibliothèque ;
- servir la chance de tirer une carte (« 1 CHANCE SUR 3 »), tirée de `RATES` et du
  nombre de cartes de sa rareté dans la série ;
- faire passer `fanzzy` à `createAide` dans `server.js`, et retirer alors le repli
  sur `globalThis.fanzzy` ;
- les boosters d'un abonnement acheté (`boutique/index.js`, `livrer`) entrent
  dans la réserve sans compter la recharge due, comme le faisait l'aide
  (`serveur/ECARTS.md`) ; et `estAbonne` sur la connexion de l'appelant.

Puis, dans les documents : `serveur/ECARTS.md` (accueil § 5) et le § 5.1 de
`serveur/CONTRATS.md` (« Lecteurs ») disent encore que l'anneau de
`/collection` montre `paliers.gagnes / paliers.possibles` ; il vise le prochain
cran depuis la critique.

Puis, ce que la critique a relevé et qui est resté en l'état :

- la fabrique des cases de l'album, recopiée dans `collection.html` : une seule,
  partagée avec le classeur ;
- au classeur, les pochettes des âges 2 et 3 d'une lignée absente, rectangles
  hachurés sans silhouette ni repère « ÉVO 2 » : une série pas commencée a l'air
  d'une page morte ;
- sur la fiche, ME MONTRER AINSI en bloc de trois lignes collé à gauche de la
  carte, hors de la rangée des actions ; TON AVATAR en tampon vert sur la fiche et
  en sticker craie au vestiaire ; le lien « où trouver des écharpes » sous IL TE
  FAUT ;
- la réserve, une seule brique, mais lue dans deux ordres (les fentes d'abord au
  kiosque et à la boutique, le chiffre d'abord au HUD et au vestiaire) et sous
  deux dessins de sachet ;
- au butin, les cartes d'écharpes d'un doublon portent une forme de rareté et le
  pin d'une famille d'emprunt ;
- au vestiaire, à 768 pixels, le nom et les stickers de stats gardent leur corps
  de téléphone au pied d'une scène de sept cents pixels.

Et, resté de la vague précédente : le sachet de LA REPRISE, qui n'a pas de
dessin (une production d'images) ; `JURIDIQUE.md`, qui ne dit pas que les crans
ne comptent pas les tenues ; le booster de l'abonnement, livré à la souscription
et non à chaque échéance ; l'`ALTER` à trois colonnes de `sql/couleurs.sql` ; et
les décisions rendues à Gaël (`ETAT.md`, § 7 bis).

**Hors de cet atelier, et c'est la suite :** les arènes, le bilan de tribune et
la présence (lot 6, commencé le 4 octobre dans sa propre copie, sur la branche
`refonte-lot6`, qui part de `60fe268`), puis les images et le terrain (lot 7).

---

## 4 quadragies quinquies. Le Grand Virage réparé au serveur, le sachet de LA REPRISE, le tunnel en photo

*Du 4 octobre 2026 en fin d'après-midi au 5 octobre peu après minuit.* Un
atelier d'intégration, hors lot, a réuni quatre pièces qui attendaient chacune
de son côté : le correctif serveur des salles du Grand Virage, écrit sur la
synthèse de ses défauts et relu en cinq passes par trois relecteurs adverses ;
le sachet de LA REPRISE et la photo du tunnel de l'écran d'ouverture, produits
le 3 octobre ; et les reliquats du lot 4. Il a aussi porté jusqu'aux pages ce
que le correctif avait appris des événements de l'API. Le détail du serveur
est dans `serveur/ECARTS.md`, serveur-correctif, et ce que les pages peuvent en
attendre dans `serveur/CONTRATS.md`, § 16.2, § 16.5 et § 16.6 — déclaré alors
« § 15 », reversé là à la fusion du lot 6, qui donne le § 15 au bilan de
tribune : cette section ne les recopie pas.
Les pièges de l'atelier sont dans `ETAT.md`, § 6.

**Gaël a commité et mis en ligne le correctif et le sachet pendant
l'atelier** : `0638fb5` (« Maj V04102026.1716 »), le 4 octobre à 17 h 16, avec
la fin de la trace du lot 4. Le reste — le tunnel, les pages, le câblage de
l'aide, les suites et les deux documents du correctif — attend (« En ligne »,
plus bas).

### Le correctif des salles

Tous ces défauts étaient en ligne depuis `e21a923`.

- **D1, le relevé payé pour rien.** Toute salle où quelqu'un était assis était
  relevée à chaque tour, match fini compris — et le bilan garde les gens sur la
  page après le coup de sifflet : 1 440 appels par jour et par salle, 21 % du
  budget. Neuf salles finies restées ouvertes épuisaient le quota et figeaient
  le direct de tout le site, cartes-souvenirs comprises. `aRelever` décide sur
  le statut vu en dernier : jamais un match fini ; rien pour un match à venir
  avant la demi-heure du coup d'envoi, sauf une fois à la première vue ; un
  coup d'œil par demi-heure pour un match reporté, arrêté ou que l'API ne rend
  plus (`onAbsent`, un crochet de plus, branché dans `server.js`) ; à chaque
  tour autour du coup d'envoi et tant que le match bouge.
- **D3, la salle tenue par joueur.** Fermer n'importe quel onglet du même
  espace de noms — KOP, Équipes, duel — vidait la salle de l'onglet resté
  ouvert, qui recevait `not_in_virage` à chaque chant. La salle se tient par
  socket, et l'on n'en sort qu'avec sa dernière.
- **D2, le retour gratuit.** Un départ effaçait le membre : F5 rendait 40 de
  souffle et une main neuve, recharges et fatigue effacées — un « Nouveau
  souffle » gratuit, et de la ferveur au classement. Le parti est gardé, son
  souffle arrêté, et repris au retour. Un camp demandé l'emporte ; sans
  demande, un neutre retrouve le sien.
- **Les salles ne se libéraient jamais** : la ligne lisait `room.last`, que le
  battement venait de poser. Elles se libèrent sur `occupeeA`, une minute après
  le dernier départ d'un match fini, jamais pendant la fenêtre du match —
  sortir à la mi-temps ne coûte plus son souffle. Et le rang « classé » n'est
  qu'une réservation jusqu'à la première poussée : regarder trois tribunes puis
  revenir chanter dans les trois ne fait plus trois Virages classés.
- **La minute double ne disait pas sa fin** : le battement ne partait que si
  quelque chose avait bougé, et l'expiration ne bouge rien. Elle est diffusée,
  et `surgeMs` — le seul champ ajouté au contrat — dit ce qui en reste.
- **Le penalty.** L'API range sous `Goal` le penalty manqué et chaque tir de la
  séance de tirs au but, marqué ou non. Compté, il frappait une carte-souvenir
  pour un ballon à côté, secouait la corde du côté qui venait de rater, et
  décalait d'un cran le numéro de tous les buts suivants du match, gravé sur
  leurs cartes. `estUnBut` (`poller.js`) les écarte.
- **Le rejeu.** Le premier relevé d'un match déjà commencé trouvait tous ses
  buts « jamais vus » et les annonçait : corde, minute double, cartes de
  présence pour qui n'y était pas. Il les range sans les annoncer ; un trou
  dans le relevé repart de ce qu'on voit ; un but en avance sur le tableau
  attend qu'il le rattrape.
- La Remontada lit le vrai score, et non les buts vus depuis l'ouverture de la
  salle.

Deux suites sont nées, sans base : `salles:test` (134 contrôles) et
`releve:test` (56). D4, D5 et D7 restent au lot 6.

### Les pages qui lisent les mêmes événements

Le hub et `/matchs` lisent les événements du match sans passer par le relevé,
et chacun faisait la faute qu'`estUnBut` corrige au serveur.

**Le hub nommait le mauvais buteur.** `buteurDe` prenait le dernier `Goal` de
l'équipe. Or le score est écrit en base avant que les événements soient
demandés, et l'API publie le score avant l'événement : à 2-0, le bandeau
mettait sous « Goal ! » le nom et la minute du 1-0 — ou celui qui venait de
manquer son penalty. Il écarte le penalty manqué, et ne nomme plus que si la
liste compte exactement les buts de l'équipe au tableau : en retard ou en
avance (un tir de la séance, un but refusé encore listé), personne.

**`/matchs` exultait sur le penalty raté**, enchaînait les « GOAL ! » et les
« ON ENCAISSE » pendant une séance au score immobile, et annonçait MATCH NUL
une qualification aux tirs au but. `pasUnBut` écarte le penalty manqué et, au
statut P ou PEN, le penalty à la minute 90 ou plus ; le verdict final lit la
séance (`periodes.penalty`) quand le match est nul : « VICTOIRE », « aux tirs
au but · 4 – 3 ».

**La séance n'est pas rangée en base, et c'est décidé.** Seul le commentaire
`Penalty Shootout` distingue un tir de la séance d'un penalty du match, et
`fixture_events` n'a pas de colonne pour lui. L'ajouter demandait un `.sql`,
que le Manager n'applique jamais, et un `INSERT` qui nommerait une colonne
absente lèverait dans le relevé **avant l'annonce des buts**, pour tous les
matchs. Les pages déduisent donc la séance du tableau, et se trompent dans le
seul sens acceptable : elles taisent, elles ne nomment jamais le mauvais
(`serveur/ECARTS.md`, serveur-correctif § 9).

### Le sachet de LA REPRISE

La seule série en production n'avait pas de dessin : au centre du kiosque,
sous les projecteurs, c'était le repli de `packArt`, trois cartes plates
identiques là où l'on venait chercher un sachet. Il a été généré le 3 octobre,
réduit à 760 × 1352 comme les sept autres sachets dessinés, servi en AVIF,
WebP et JPEG, et branché par son code de série dans `ART` (`cartes.js`) — une
clé qui ne le recopie pas exactement ne lève rien, elle rend le repli.
`verif-pages` monte
désormais `fanzzy-art.js` et `cartes.js` comme le kiosque, et exige de chaque
entrée d'`ART` une clé qui soit le code d'une série, ses trois fichiers, et
l'adresse que `src` construit.

### Le tunnel

Depuis le lot 2, quatre pans de béton en CSS tenaient la place de
`tunnel.webp`, « à produire ». La photo existe en deux compositions — une seule
ne met pas le trou et les marches au bon endroit à la fois en 9:16 et en
16:9 —, générées le 3 octobre (Nano Banana 2, d'image à image) à partir d'un
croquis plat qui posait le trou là où le CSS l'attend. La sortie blanche est
détourée en transparence, et le bas de l'image assombri : la craie du libellé
et de la consigne y tient 4,5:1. Servies en 1080 × 1920 et 1920 × 1080, en AVIF
(53 et 42 Ko), WebP (65 et 43 Ko) et PNG (885 et 933 Ko).

Le tunnel est devenu la boîte de l'image, en « cover », et les coins du trou
sont ceux que le détourage a mesurés : la photo et le repli ont la même
géométrie, et le couloir ne saute pas quand elle arrive. Les pans et les
bâches restent dessous, aux places de la photo : sans elle, l'écran perd son
béton, pas son couloir. La sortie part de 60 % de sa taille sous un voile plus
léger — partie de 30 %, elle était plus sombre que le mur qu'elle éclaire. Et
un téléphone couché prend un titre de 34 px et un trou plus bas : à 46 px, le
titre mordait sur la lumière.

**Elle s'appelle `.couloir`, pas `.decor`.** `.decor` est le décor du
personnage du hub, une règle sans portée : posée sur la photo, elle l'éteignait
et la décalait d'une demi-largeur, et l'écran montrait le repli sans un
message. La maquette, qui n'avait que la feuille de l'ouverture, ne pouvait pas
le voir ; le banc sur la vraie page l'a vu. Si son fichier manque, l'image se
retire (`onerror`) plutôt que de peindre une icône cassée de la taille de
l'écran — ce qui la cache aussi à l'audit. `verif-pages` vérifie donc que
chaque adresse `/img/ecran/…` de la page existe, et `accueil:ui` que la photo
est visible, qu'elle remplit le tunnel, qu'on voit la sortie au centre du trou,
et que sans elle le béton peint reprend.

### Les reliquats du lot 4

- **Le câblage de l'aide.** `server.js` passe `fanzzy` à `createAide`, et ne
  pose plus `globalThis.fanzzy`, que personne d'autre ne lisait ; l'aide n'a
  plus de repli. `verif-cablage` lit l'appel, verse un booster de fin sur un
  faux pool par la porte passée, et refuse le repli : une globale posée n'est
  pas lue. Le piège et l'item de « Ce qui reste » de la section précédente
  restent tels quels, c'est un journal daté ; `ETAT.md` et `A-DEPLOYER.md`
  sont repris.
- **Les trois fautes mineures du sixième tour.** Les deux commentaires qui
  posaient NOUVEAU « sur le flanc » ; et l'interrupteur de `/collection`, qui
  dit MANQUANTS comme le classeur, avec sa règle de rangée : « Ce qu'il me
  reste » ne tenait au bout des six filtres qu'à partir de 452 px, et sur tout
  téléphone la page descendait de quarante-six pixels.
- **Les documents.** `serveur/CONTRATS.md` (§ 5.1) et `serveur/ECARTS.md`
  (accueil § 5) disent que l'anneau de `/collection` vise le prochain cran.

### Éprouvé

Cinq tours de vérification ; le dernier, du 4 octobre à 23 h 23 au 5 octobre
vers 0 h 25, dans la copie principale, n'a touché aucun fichier.

Les contrôles statiques sont verts : `npm run pages` (82 contrôles, dont « 9
image(s) demandée(s), toutes présentes » pour l'écran d'ouverture et huit
sachets dessinés), `npm run cablage` (30), `npm run promesses` (avec
l'avertissement connu : six pages sans suite d'interface),
`npm run pages:navigateur` (les vingt-quatre écrans) et `npm run schema:smoke`
(34). Aucun retour chariot dans les fichiers modifiés ni dans les nouveaux.

`tout-tester`, le 4 octobre de 23 h 26 à 23 h 48 : **soixante-quatre suites et
4 708 contrôles** en vingt-deux minutes, contre soixante-deux et 4 449 à la fin
du lot 4. Ont grandi `matchs:ui` (46 → 50 : le penalty manqué, la séance, la
victoire aux tirs au but et son sous-titre) et `tour:ui` (345 → 347 : à
360 px, les filtres de l'album sur une rangée, et MANQUANTS) ; `accueil:ui`
porte les trois cas du buteur, quatre contrôles de la photo et deux du repli ;
`aide:smoke` passe de 48 à 47, son contrôle de la globale retiré. `deck:ui` (un
rouge) et `nvn:ui` (trois) restent rouges à l'identique. `accueil:ui` a eu
trois rouges dans la série, deux du rideau relancée seule, aucun dans une
copie de la suite hors du dépôt, puis le rouge connu de la bulle : son
`index.html` est celui du tour d'avant, où ces contrôles passaient (la piste
est dans `ETAT.md` § 6).

L'audit, en deux passes, n'empire que sur `booster@butin`, et c'est le tirage :
quatre cartes neuves au lieu d'une, donc quatre stickers NOUVEAU à 2,6:1 au
jour. Aucun genre de constat qui n'existait pas à la fin du lot 4. Les captures
de l'ouverture, de 320 à 768 px, montrent la photo de béton ; celles du
kiosque, LA REPRISE choisie, à 360 et 768 px, le sachet dessiné — l'audit ne
photographie que LE VIRAGE IMPOSSIBLE.

### En ligne

**Le correctif du Virage et le sachet sont en ligne depuis le 4 octobre vers
17 h 17.** Relevé le 5 octobre à 0 h 25 : `uptime_s` dit un redémarrage vers
17 h 17, moins d'une minute après le commit de `0638fb5`, par le Manager
(`"version": null`) ; `cartes.js` et l'AVIF du sachet servis sont ceux de
`0638fb5`, octet pour octet (celui de `7450c03` diffère) ; `/`, `/matchs`,
`/collection` et `/fanzzy` aussi, une fois retirés les `?v=`. `/healthz` répond
`ok: true`, `"virage": "0 salle(s)"`. Le serveur n'a pas de marque publique :
c'est ce redémarrage, après un commit qui touche `src/server/ferveur/` et
`src/server/football/`, qui dit que le correctif tourne.

**Il est parti sans la précaution qu'il demandait** : hors d'un match en
direct. C'était un dimanche, à 17 h 17. Dans un match en cours, un penalty
manqué compté par l'ancien code avait pris un numéro, et sa carte était
frappée ; le correctif ne le compte plus, le but réel suivant reprend ce
numéro, et sa carte existe déjà (`INSERT IGNORE`, sur `UNIQUE (fixture_id,
seq)`) : il n'en a pas, une fois. Personne n'a regardé si un tel match tournait
à cette heure-là.

**Le reste n'est pas en ligne** : les photos du tunnel répondent 404, et les
pages servies sont celles de `0638fb5`. Les dix-sept fichiers modifiés, les six
images du tunnel et `art/A-GENERER-ARTLIST.md` ne sont pas commités ;
`CONTRATS.md` § 15 (aujourd'hui § 16.2, § 16.5 et § 16.6) et `ECARTS.md`,
serveur-correctif, qui décrivent un code en ligne, non plus. `A-DEPLOYER.md` dit l'ordre.

### Ce qui reste

D'abord, **commiter ensemble** les dix-sept fichiers modifiés, les six images
du tunnel, `art/A-GENERER-ARTLIST.md` et cette trace : `index.html` sans ses
images ferait refuser la livraison par `verif-pages` dans le workflow, et, par
le Manager, qui ne le lance pas, servirait le repli sans un mot. Puis la
livraison (`A-DEPLOYER.md`).

Ce que le regard de l'intégration a relevé, et qui reste en l'état :

- `/matchs` peut taire un vrai but : au statut P ou PEN, un penalty marqué à
  la minute 90 ou plus et publié après le passage à la séance — l'égalisation à
  120+1, livrée une minute après le sifflet — est pris pour un tir de la
  séance. La correction passe par le télétexte : faire suivre `comments` dans
  ses événements, et reconnaître la séance comme `estUnBut` ;
- au statut PEN, la séance ne décide que d'un match nul : un match retour gagné
  1-0 et perdu aux tirs au but s'annonce VICTOIRE. Décider par la séance dès
  qu'elle est lisible, ou dire ce cas dans le commentaire ;
- `verif-pages` ne protège pas le sachet lui-même : sans l'entrée `RP` d'`ART`,
  il dirait « 7 sachet(s) dessiné(s) », en vert. Exiger l'entrée de
  `SET_SAISON` ;
- il ne vérifie pas non plus qu'une image de l'écran d'ouverture a ses trois
  formats, ni que l'`<img>` du couloir garde son `onerror` ;
- la recette du tunnel — ses scripts, les cotes du trou (`geo.json`), le
  traitement du bas dont dépend le 4,5:1 — vit dans `art/ecran/_src/`, ignoré
  par git : une photo refaite ne peut pas refaire la mesure depuis une autre
  copie (`VISUELS.md`) ;
- `ui.css` documente encore, dans le gabarit de la brique des filtres,
  l'interrupteur « Ce qu'il me reste », qui passe dessous à 360 px ;
- `CONTRATS.md` § 15.4 dit qu'un match à venir n'est relevé « pas du tout
  avant » la demi-heure du coup d'envoi, alors que le relevé regarde une fois
  tout statut qu'il n'a pas encore vu ; et sa table des lecteurs n'a pas de
  ligne pour `index.html`, qui lit la route des événements, où un tir de la
  séance ressemble à un penalty du match. *(Sans objet depuis la fusion du
  lot 6 : ce § 15 est reversé aux § 16.2, § 16.5 et § 16.6, qui ne portent
  pas la phrase ; la règle exacte reste dans `ECARTS.md`, serveur-correctif
  § 1. Les lecteurs du § 16 ne nomment pas davantage `index.html`.)*

Puis, hors de cet atelier : D4, D5, D7 et la page du Virage, au lot 6. La
branche `refonte-lot6` est à `7450c03`, sans `0638fb5` ni cette livraison, et
sa copie de travail touche `server.js`, `src/server/ferveur/`, `poller.js`,
`verif-cablage.mjs`, `verif-pages.mjs`, `CONTRATS.md` et `ECARTS.md` : sa
fusion croise ce correctif, et c'est l'appel `createAide({ …, fanzzy })` qui
reste. Le reste de « Ce qui reste », au lot 4, est inchangé : `paliers.series`,
la chance d'une carte, les boosters d'un abonnement acheté, la fabrique des
cases recopiée, les constats de la critique.

---

## 4 quadragies sexies. Les arènes FAIT MAIN — le Grand Virage, le duel de tribunes, le bilan, et la vague 2 du serveur

Du 3 octobre 2026, où Gaël a tranché les quatre questions qui changeaient ce que
le serveur écrit, au 5 octobre vers 5 h, un atelier a mené le **lot 6** de la
refonte : les deux arènes, c'est-à-dire les écrans où l'on joue pour de bon. Le
**Grand Virage** (`/virage`) et le **duel de tribunes** (`/duel-nvn`) partagent
maintenant un seul HUD, une seule corde, une seule main de cartes, un seul pavé
de geste et un seul rituel de sortie ; le
Virage a un **bilan de tribune** qui remplace la boîte « QUITTER LA TRIBUNE ? » et
qui s'ouvre tout seul au coup de sifflet final ; le duel a le sien ; le geste
reçoit son **verdict du serveur** et le claque en tampon sur le pavé ; le son de
tribune suit le match ; et le serveur apprend à servir tout cela — le bilan, l'XP
du Virage, le verdict, le rang et le palier, la fin de match, la présence des amis
— dans la **vague 2** du chantier serveur. Ce qui se voit à la fin tient en
quatre phrases : on voit d'un coup d'œil qui tire plus fort ; une carte dit ce
qui lui manque pour se jouer ; le geste rend son mot, PARFAIT, BON, MOYEN ou
RATÉ, au même endroit qu'il s'est joué ; on ne quitte plus un match sans qu'il
dise ce qu'il a donné.

**Le lot est versé dans la copie principale, pas encore commité, et rien n'en
est en ligne.** Il a été mené dans `.claude/worktrees/lot6`, sur la branche
`refonte-lot6`, dont le HEAD est resté `7450c03` ; `git diff 7450c03` en donnait
**70 fichiers** (62 modifiés, 8 neufs), **28 936 lignes ajoutées et 3 881
retirées** — le correctif du Virage compris, qui y pèse ses deux suites. Une
copie de travail est un `git worktree` : la copie principale a continué de
vivre pendant ce temps (« La base par copie », plus bas), et le 5 octobre au
matin ce diff y a été appliqué en trois voies, sur `524b2ca` (« La fusion dans
la copie principale », plus bas).

Le lot a été mené en **deux parties, avec une fusion entre elles**. La partie A,
le 4 octobre dès le matin, est partie de `60fe268` — le lot 4 n'était alors pas
fini — ; Gaël a mis le lot 4 en ligne à 17 h 07 (`7450c03`), puis le correctif
du Virage à 17 h 17 (`0638fb5`, vu dans la section précédente). La fusion, vers
17 h 30, a **reposé la partie A sur `7450c03` et y a ajouté le correctif, sans
aucun conflit et sans rien perdre** : 54 fichiers appliqués, 51 identiques octet
pour octet à leur sauvegarde, trois fusionnés en trois voies (`ui.css`,
`nav.js`, `ECARTS.md`) et relus ligne à ligne, chaque côté entier. La partie B,
le soir, a écrit ce que la partie A avait laissé — le serveur du Virage surtout
—, puis des tours de vérification (numérotés 1, 2, 3 et 5), des corrections par
périmètre, le regard, et le report à la main d'un **correctif d'urgence** que
Gaël avait demandé dans l'intervalle (« Un correctif d'urgence, reporté à la
main », plus bas).

Le travail s'est partagé sur des **clés de périmètre fermées aux fichiers
disjoints**, comme aux lots précédents : quatorze — `mesure`, `feuilles-css`,
`fx`, `geste`, `grand-virage`, `duel-tribunes`, `barre-tiroir`, `amis`,
`serveur-socle`, `serveur-virage`, `serveur-duel`, `serveur-presence`, plus
`paquet` pour `package.json` et `tests` pour les suites qui lisent un
comportement voulu. La mesure d'abord, seule avec la base ; puis le socle du
serveur, seul — le contrat collé avant que les écrans codent contre lui ; puis
les briques, les écrans et les trois autres périmètres serveur en parallèle ;
puis la vérification. Le regard — une critique visuelle notée **7,5 sur 10**
(23 constats, dont 9 importants) et une revue adverse du serveur — a mené à
des corrections et à un dernier tour, le cinquième. Les périmètres se sont échangé leurs
besoins par clé, et chaque constat est allé à la clé qui porte le fichier.

Le texte de la revue adverse du serveur (contrat, XP, bilan, présence) n'est pas
parmi les pièces dont cette trace est tirée : ses constats ont été traités par
les clés qui portent leurs fichiers, et cette section ne les nomme pas.

Les documents de l'atelier sont restés dans son bac à sable :
`BRIEF-LOT6.md`, `DECISIONS.md`, `QUESTIONS.md`, `SERVEUR-VAGUE2.md`,
`SOCLE.md` (ce que le contrat, le schéma, les réglages et le verdict offrent aux
pages), `BRIQUES.md` (le balisage exact de chaque pièce d'arène, vingt
paragraphes), `SON.md` (ce que `son.js` offre) et `MESURE.md` (les commandes et les
chiffres de départ), et `FUSION-PRINCIPALE.md` (la marche de la fusion, ses dix
conflits et leur règle, éprouvés dans un arbre à part). Ce qui doit en durer est
dans le code — le commentaire de
chaque pièce de `ui.css` donne son balisage exact —, dans `serveur/CONTRATS.md`
(§ 15 à § 18), dans `serveur/ECARTS.md` (« Vague 2 », une rubrique par clé) et
dans `ETAT.md`.

### Ce que Gaël a tranché

Le 3 octobre 2026, quatre questions **avant le lancement**, toutes selon la
recommandation de `QUESTIONS.md` :

- **L'XP du Virage (Q1).** Le cœur du jeu ne rapportait aucune XP : seules les
  missions le payaient. **15 XP par match poussé**, une fois par match, à partir
  de **10 chants acceptés** par le serveur, **trois matchs par jour** au plus ;
  ni le club, ni l'abonnement, ni la neutralité, ni le classement n'y changent
  rien — l'XP mesure le temps passé à jouer (`ETAT.md` § 3, « l'XP ne double pas
  pour son club »), et lier l'XP au classement ferait acheter de l'XP, puisque
  l'abonnement lève le plafond des Virages comptés. Trois réglages :
  `xp.virage`, `xp.virage_chants`, `xp.virage_matchs_jour`. À 45 XP par jour au
  plus, c'est un peu plus du tiers des 120 que paient les trois missions.
- **La présence (Q2).** Les **amis mutuels** seulement, **trois états
  grossiers** (en ligne, au Virage, en duel) sans match ni heure, **rien en
  base**, visible par défaut avec l'interrupteur « apparaître hors ligne » au
  pied du tiroir ; **pas de REJOINDRE** (dire quel match, c'est la phrase que le
  module des amis refuse depuis le début). **Livrée éteinte**
  (`presence.actif` faux) jusqu'à la mise en ligne de la nouvelle
  `CONFIDENTIALITE.md`, parce que le jeu est ouvert aux mineurs (dossier L5).
- **Une seule échelle de verdict (Q3).** Quatre mots, partout, la répétition
  comprise : PARFAIT au-dessus de 0,9, BON au-dessus de 0,7, MOYEN au-dessus de
  0,4, RATÉ en dessous. Le Cri du Fanzzy reste réservé au-dessus de 0,95 : une
  récompense, pas un verdict. La répétition garde sa note chiffrée et son record.
- **Un plancher de ferveur (Q4).** Un chant accepté, noté au moins MOYEN, rapporte
  au moins 1 de ferveur ; le rang se départage par les chants, puis par les
  PARFAITS. Sans cela, dans une tribune de plus de 34 personnes la ferveur d'un
  chant s'arrondit à zéro, le bilan afficherait « 1ᵉʳ » à tout le monde, et les
  divisions de saison ne bougeraient pas.

Les neuf autres questions (Q5 à Q13) se tranchaient **pendant le lot**, et la
recommandation a été suivie : on garde **le stade de la rencontre** au fond de
l'arène plutôt que la photo de tribune (Q5) ; **le voile des arènes est levé**
(Q6, hypothèse H6 : `nav.js` ne pose plus `.dense` sur les deux écrans de jeu) ;
**pas de supporter d'en face aux couleurs de l'adversaire** (Q7 : la foule au
pochoir, teintée au camp, dit déjà qui est en face) ; **la rumeur reste
synthétisée** (Q8) ; **les missions de qualité restent en réserve** (Q9 : payer
la qualité du geste pousse à l'automatiser) ; **le bilan seulement si l'on a
poussé** (Q10 : sans un chant, on sort sans question) ; **la tribune se vide
cinq minutes après le coup de sifflet** (Q11, `virage.bilan_min`) ; **ce qui est
en jeu au duel est servi, pas « +3 places »** (Q12) ; et l'ordre des images du
lot 7 (Q13) est dans « Ce qui reste ».

### Mesurer d'abord : des états d'arène que l'audit ne savait pas voir

L'audit visitait `/virage` et `/duel-nvn` à leur porte seulement : le voile du
Virage vide, la préparation du duel sans deck. Rien de ce qu'on y joue n'était
mesuré. Le départ a été pris le 4 octobre de 12 h 21 à 12 h 32 (onze minutes et
demie), au commit `60fe268`, `public/` sans modification : **172 captures** —
75 pages, 47 états d'avant, **50 états d'arène**.

Les états d'arène sont fabriqués **par la technique du banc** : la requête de
`/socket.io/socket.io.js` reçoit une **fausse socket pilotable**
(`window.__sock.fire(évènement, données)`, et `window.__emis` garde ce que la
page émet), quatre lectures sont bouchées et nommées dans le relevé
(`/api/virage/live`, `/api/deck/matchs`, `/api/deck/loadout`,
`/api/nvn/attentes`), et le reste — la page, ses scripts, la session, le
catalogue, le niveau — vient du vrai serveur. Un match fabriqué, FC Sion – FC
Bâle à la 66ᵉ (2 – 1 au terrain), poussé pour Sion ; une tribune de 46 contre
31 ; un duel 3 contre 3 classé. Les champs de la vague 2 y sont déjà, à la
forme du contrat. Onze états au départ (le Virage au voile, en tribune, en minute
double, au but, au pavé, au bilan ; le duel à la préparation, au vestiaire, à
l'affiche, en jeu, au bilan), qui sont devenus **vingt-deux** au fil des
parties : le duel au pavé, au but, à l'entraînement, au verdict ; le Virage
dans une tribune de 300, à la fin du match, au verdict ; et quatre états des
autres écrans que le lot touche (`repetition@jugee`, `repetition@tri`,
`amis@presence`, `tiroir@presence`). Chaque état qui ne se pose pas **nomme sa
panne** au lieu d'être mesuré sous le nom d'un autre : cassé exprès, un
évènement renommé fait tomber les cinq états du Virage avec leur garde.

L'audit a gagné **cinq choses** qui servent au-delà du lot :

- **un port à soi.** Il prenait toujours le 3999. Deux copies qui mesurent en
  même temps se le seraient disputé, et le second serveur s'arrêtant sur un port
  pris, l'audit aurait mesuré **les pages et la base de l'autre copie** sans un
  mot. Le port est donné par le système (`listen(0)`), et `debout` refuse un
  serveur arrêté ;
- **un budget de hauteur** : chaque rangée dans l'ordre de l'écran, sa hauteur,
  et ce qu'on en voit dans la fenêtre — c'est ce qui rend vérifiable la règle du
  brief, « l'arène cède avant la main et les chants, jamais l'inverse ». Au
  départ, à 320 × 568, la rangée des chants du duel **sortait de l'écran** (111
  px) sans qu'aucun relevé le dise : un texte coupé par son cadre n'est pas
  « hors écran ». Une règle, **« main coupée »**, la voit ;
- **six règles de plus**, relevées sur chaque état du lot : « sans fin » (plus
  de trois animations qui ne s'arrêtent jamais), « sticker rogné », « voile
  dense », « encre rognée » (l'encre d'un texte contre le rembourrage de chaque
  ancêtre qui coupe), « libellé couvert » (le corps des lettres sondé au point
  près) et « main coupée » ; et, côté `npm run pages`, le contrôle « le
  verdict » (voir « Le geste ») ;
- **`--arenes`**, pour re-mesurer les seuls états d'arène en une à cinq
  minutes pendant que les écrans bougent ;
- **un album stable.** `album@/collection` donnait 201, 202 ou 203 textes sur le
  même commit. La cause n'était pas dans la page : une page éteint au serveur
  ce qu'elle a montré en partant (`pagehide`, `fetch` en `keepalive`), et
  `contexte.close()` rend la main **avant** que cette requête atteigne le
  serveur — elle effaçait, après coup, les nouveautés que l'état suivant venait
  de resemer. L'audit répond maintenant lui-même à l'extinction, et la page
  quitte le document avant qu'on ferme son contexte.

**Ce que le départ disait.** Le voile du mur était `.dense` (75 %) dans les onze
états, mur compris. À 320 × 568, la tribune coupait le nom des deux clubs du HUD.
L'arène du Virage tenait **157 px** à 360 × 640 (91 à 320) parce que le HUD en
prenait 72, le fil 64, la ligne « ce que tu portes » 44 et le bandeau des cartes
de duel 60. L'affiche du duel coupait cinq noms à 360 et douze à 320, et ne
montrait que sa propre tribune sans défiler. Le vestiaire coupait les noms de
Fanzzy sous les bustes. Partout : zéro texte sous 11 px, zéro opacité sous 0,85,
zéro petit or, zéro débordement, zéro erreur de script.

### Ce qui a changé

#### Les pièces d'arène

Les deux écrans partagent leurs pièces, **une fois**, dans une section en fin de
`public/ui.css` — après « la montée de niveau » du lot 4, avec le balisage exact
de chaque pièce en commentaire, ses doubles `prefers-reduced-motion` et
`html[data-calme~="animations"]`, et son banc. Une page n'écrit que la **place**
d'une pièce, jamais son dessin ; ce qui bouge passe par une variable (`--corde`,
`--h`, `--part`, `--a`/`--b`) ou un attribut posé sur un nœud qui dure, parce que
`render` (Virage) et `rendreDuel` passent dix fois par seconde.

- **Le HUD de match** (`.tbf-hudm`) : une rangée, la même aux deux arènes. La
  flèche et le menu de `nav.js` gardent leurs cases de 44 px, la bâche du club
  de chaque camp porte son nom en Oswald et son écharpe (`--e1`, `--e2`) en
  bord bas, **cerne or pour toi, bleu pour en face** ; la plaque du milieu porte
  le score de la corde au Virage, l'horloge et le sticker CLASSÉ au duel. Les
  deux formes d'un libellé (« TA TRIBUNE »/« TOI ») sont écrites, la longue
  retirée de l'écran sous 390 px par le motif que `tour:ui` reconnaît. Une ligne de
  club qui ne tient pas **s'efface en entier** plutôt que de se couper.
- **Le ticket terrain**, en kraft déchiré de 24 px, qu'on lit et qu'on ne touche
  que pour ouvrir la feuille du fil ; **le sticker de phase** à son côté (GRAND
  VIRAGE, puis MINUTE DOUBLE avec l'anneau de soixante secondes).
- **La corde** tressée — verticale au Virage, horizontale au duel —, **le foulard
  noué** qui la parcourt, les deux lignes de but en scotch, la progression en
  écharpe et les buts de corde en crans ; une seule variable, `--corde`, de −1 à
  1. **La marée** du duel, qui montre à front net qui mène.
- **La foule au pochoir** : des silhouettes teintées au camp, huit par camp sous
  400 px, allumées en proportion de `crowd`, qui lèvent les bras quand le camp
  chante. Au duel, un supporter par joueur, assis s'il est parti, la bouche
  barrée sous « Silence radio », deux rubans de craie sous « Parcage fermé ».
  Tant que `corde.svg`, `foulard-noeud` et `pochoir-supporters` n'existent pas
  (lot 7), les replis sont peints en CSS, **et aucune page ne nomme une image qui
  n'existe pas**.
- **La carte de chant (2:3) et la carte d'action (3:4)**, une seule matière :
  le dessin plein — fini l'assombrissement à 60 % —, un bord de craie, un cerne
  d'encre, le coût en sticker rond. Une carte injouable porte un scotch en croix
  et un sticker « −8 » qui dit **ce qui manque**, jamais sur le libellé ; une
  carte en recharge, un scotch qui se retire et son chiffre ; **l'éventail** de la
  main se chevauche de 6 % (la direction écrivait 22 %, qui couvrait le nom du
  geste de la voisine).
- **Le pavé de geste en bâche craie** et **le tampon de verdict** qui claque au
  centre : PARFAIT vert, BON bleu, MOYEN or, RATÉ rouge — en contour sur le
  sombre, **plein sur le kraft**, toujours.
- **Le tableau de tribune** : le souffle en écharpe fine bleue à crans aux coûts
  des cartes en main, la ferveur à paliers (« 12ᵉ → TOP 10 »), le sticker de
  combo (« 3 PARFAITS »), la pile des souvenirs en dos de carte.
- **La page kraft du bilan**, les deux doubles barres miroir TOI/LUI du duel,
  **l'affiche** (le cadre à écharpe aux deux couleurs des clubs, le sticker LIVE)
  et **les effets posés sur l'arène** (la bâche déployée, le brouillard sur la
  moitié adverse, les flèches de vent), chacun avec son chrono en anneau.
- Au second tour, les pièces que les pages avaient demandées : la carte d'un
  Fanzzy du duel, la carte-souvenir qui se retourne, l'étiquette à liseré, la
  bâche qu'on lit (le chrono avant les bots), le panneau de ce qu'on porte
  hors de la colonne. À la partie B, **les noms entiers du vestiaire**
  (`.tbf-gradins--entiers`).

Deux choses ont demandé de la précision à la matière. **Les accents** : une
ligne serrée qui coupe pour ses points de suspension rognait l'accent d'une
capitale — Oswald le porte à 1,08 em de la ligne de base —, et « BÂLE » se lisait
« BÄLE » ; le nom et le petit texte ont un quart de cadratin de rembourrage rendu
par une marge négative, et la sonde « encre rognée » le mesure. **Les cartes
couvertes** : le nom du geste se faisait couvrir par le coût de la carte voisine
dans l'éventail, et le même pourcentage lu sur la main au duel, sur la carte au
Virage, donnait deux mains différentes ; il se lit sur la carte (`6% + 3,5 px`).
Le banc des briques mesure 405 textes : zéro pâle, zéro coupé, zéro sous 11 px.

#### Le Grand Virage

`public/virage.html` passe de 2 432 à 3 205 lignes.

**Le voile de choix** : « LE GRAND VIRAGE » peint sur une bâche craie tournée, le
tunnel en fond — l'image n'existant pas (lot 7), la tribune à 25 % sous un voile —,
chaque match en direct en **affiche** (la foule en frise de silhouettes
allumées selon `crowd`), les matchs « ailleurs » en cadre pointillé, le choix du
camp en deux bâches aux couleurs des clubs ; l'état vide dit le prochain coup
d'envoi, avec le même compte à rebours que le hub, et écarte les matchs
reportés, suspendus ou sans heure.

**La tribune** tient dans l'écran à 360 × 640, encoche comprise : le HUD 62, le
ticket terrain 24, **l'arène 266**, le tableau 52, la rangée d'actions 80, la
main 134 — 640 sur 640. À 320 × 568 l'arène garde 200. La corde, le foulard, le
stade de la rencontre en fond, la fumée du club au quart bas de l'arène, le
Fanzzy mains sur la corde. Ce que la direction ne dessinait pas et qui devait
rester a trouvé sa place sans rien perdre : la **fenêtre collective du capo** passe
en ticket sur le bas de l'arène le temps de la fenêtre ; les **cartes restées au
duel** deviennent un sticker « DUEL SEULEMENT » sur les cases vides ; la ligne
« ce que tu portes » devient une plaque ronde « i ».

**La minute qui compte double** passe à l'or — le HUD, la corde, la fumée,
jamais les cartes ni les familles — et le chrono descend **dans le sticker de
phase**, avec son anneau de soixante secondes, calculé sur `surgeMs` (une durée
relative servie) et jamais sur `surgeUntil`. `FX.bandeau('MINUTE DOUBLE')` ne se
joue plus : le sticker le dit, et sous 390 px, en minute double, il prend sa
forme longue pour que les mots soient là. La critique avait trouvé que la
minute double ne se sentait pas : 5 % des pixels seulement changeaient.

**Le but réel** garde sa case de BD « GOAL ! », que la page redescend sous le
tiroir quand on l'ouvre. **La carte-souvenir ne s'annonce plus que sur
`virage:souvenir`**, que le serveur n'envoie qu'à ceux qui l'ont reçue : la page
l'annonçait à chaque but de son club, même quand la compétition n'était pas
couverte ou que le joueur n'avait pas poussé, et « Elle est dans ton carnet »
était alors faux. Elle se retourne au centre — dos de LA REPRISE, buteur et
minute imprimés, tampon « TU Y ÉTAIS » — puis glisse vers la pile du coin.

**L'entrée** pose les deux bâches, fait compter la foule de 0 à son effectif, et le
Fanzzy entre et salue ; **la sortie** est le bilan.

#### Le duel de tribunes

`public/duel-nvn.html` passe de 3 159 à 4 011 lignes.

**La préparation** : l'affiche du match choisi en tête, avec CLASSÉ en sticker
or — la seule face d'or hors achat, c'est l'enjeu — et « ×2 » en tampon vert ; les
cinq formats en bâches-tuiles avec leurs silhouettes et leur prime
(« +30 % ») ; les matchs en tickets kraft ; **ENTRER EN FILE** en bâche flare,
collante en bas de la préparation, avec « +60 écharpes en jeu » en sous-libellé
**seulement si le barème est servi** ; les règles derrière un « i ». Sans deck,
trois places vides sous une bâche « CONSTRUIRE MON DECK ». **Pas de stade-mini**
à la préparation, et c'est un risque ouvert (« Ce qui reste ») : le stade du duel
est tiré sur l'identifiant du duel, pas sur le match.

**Le vestiaire** : les places sont des sièges — les gradins du lot 5 —
qui s'occupent des bustes, **les noms entiers** (« LEGRANDDU / DUDU »), le chrono
avant les bots sur une bâche parpaing, « INVITER QUELQU'UN » en bâche violette, la
rumeur qui monte à chaque arrivée. **L'affiche** de six secondes : « VS » en
banderole entre deux écharpes croisées, la forme en cinq stickers ronds V/D/N,
les trois Fanzzy qui entrent en cascade ; la cote seulement si servie.

**La partie** : le même HUD que le Virage, l'arène à 215 px à 360 × 640 (33 % de
l'écran — la règle « l'arène cède avant la main » l'emporte sur les 45 % du
brief), la corde horizontale et son foulard, la marée, l'écart en banderole, un
supporter au pochoir par joueur, les effets posés sur l'arène, l'équipe en trois
cartes 2:3 sur leur plaque de rareté (l'active surélevée avec le halo de son camp,
le banc grisé, « Changement possible » qui décolle les cartes du banc et les
fait pulser en vert), la Relève en `FX.evolution` avec le tampon « A GRANDI », la
main en éventail. **Le bouton de son quitte l'arène** : le son se coupe dans le
tiroir. Les écharpes du bilan volent vers le bouton de menu, qui est l'endroit
du solde partout ailleurs.

#### Le bilan

**Le bilan de tribune du Virage** est une **page kraft**, pas une boîte : le
rang dans sa tribune en tête et en grand, avec le palier qui reste à gagner
(« À 1 PLACE DU TOP 10 ») ; la ferveur, les chants, les PARFAITS, la meilleure
série, le meilleur geste en tampon plein, les souvenirs du match en dos de carte,
**l'XP versée qui remplit l'anneau**, et, quand `classe` est faux, « ce Virage ne
compte pas au classement ». Les chiffres comptent l'un après l'autre. **Toute ligne
sans donnée disparaît** : jamais un tiret, jamais une ligne à zéro. À la flèche ou
au menu, **si le joueur a poussé pendant ce match** (Q10), la page demande
`virage:bilan` et le pose, avec RESTER et SORTIR ; sans poussée, on sort sans rien
demander ; sans réponse en trois secondes, la sortie reste celle d'avant.
**Au coup de sifflet** (`virage:fin`), la page demande son bilan après un délai
tiré entre 0 et 8 secondes — pour que mille bilans ne tombent pas ensemble —, le
pose sans qu'on touche rien, quitte la salle, et ne la rejoint plus, même à la
reconnexion de sa socket. La critique avait relevé qu'au coup de sifflet RESTER
renvoyait dans une tribune morte : le bilan de fin dit « FIN DU MATCH » et propose
**UN AUTRE MATCH**.

**Le bilan du duel** devient la même page : la case de BD VICTOIRE, DÉFAITE ou
NUL avec sa bouffée, les écharpes qui tombent dans le compteur, **la jauge d'XP qui
se remplit depuis `gains.niveau.depart`** et fusionne la fête de niveau au lieu de
l'empiler 1,4 seconde après, la cote « 1 240 → 1 262 » — sans « +3 places » —, le
meilleur geste en tampon (« PARFAIT sur LA MONTÉE »), la carte préférée, **TOI/LUI
en doubles barres miroir**, le Fanzzy en pose de victoire ou de défaite, et deux
bâches **REJOUER** (flare) et **REVENIR** (parpaing) **sans rechargement**. Les
bâches de sortie sont collées au bas de la page, pour les deux bilans : la feuille
du duel fait environ 1 200 px, et REJOUER était à plusieurs centaines de pixels
sous le bord.

#### Le geste et le verdict servi

Le geste reste noté **par le serveur** : le client envoie des instants de frappe,
jamais une réussite ; il ne compte ni PARFAITS, ni série, ni ferveur, ni XP. Ce
qui change est qu'**il ne nomme plus le verdict lui-même**. Le Virage écrivait
ses seuils (0,9 / 0,7 / 0,4), le duel les siens pour le son, la répétition une
autre échelle (0,95 / 0,8 / 0,6 / 0,3) avec d'autres mots : le même 0,92 était
PARFAIT au Virage et TRÈS BIEN à la répétition. Le mot vient du serveur
(`verdict`), le Cri de `cri: true`, le combo de `serie`.

- **Le pavé-bâche** est dans les dix gestes de rythme ; **l'enfoncement de
  quatre pixels et la bouffée ne jouent que sur les gestes de frappe** (tempo,
  contretemps, écho, crescendo) ; martelage et salves ne font qu'un tic ; les
  gestes positionnels (tifo, écharpe, visée, jauge, rouleaux, ola, bascule) ne
  font jamais bouger le pavé.
- **La fenêtre attend la réponse** du serveur au plus 600 ms et y claque le
  tampon ; sans réponse à temps, elle se ferme et le tampon claque **sur la
  carte jouée**. Les 600 ms se comptent **depuis la fin du geste**, quand les
  frappes partent, et non depuis la dernière frappe : comptée ainsi, l'échéance
  serait déjà passée à la fermeture et le tampon n'y claquerait presque jamais
  (`DELAI_VERDICT`). C'est une lecture du brief à confirmer.
- **`/repetition`** finit par son tampon et « LE JOUER EN DUEL » ; son « ★ TON
  MEILLEUR » devient un tampon. Elle garde sa note chiffrée et son record.
- **`npm run pages` refuse** toute page qui compare `quality`, `qualite`, `note`
  ou `q` à un nombre écrit : neuf formes rougissent, cinq restent vertes
  parce qu'elles ne sont pas des seuils de verdict.

#### Le son de tribune, branché sur le match

`public/son.js` ne change pas de nature : tout est synthétisé, rien ne part avant
le premier geste, le mode calme coupe tout, l'onglet caché aussi, et **le son ne
porte jamais seul une information**. Ce qui est neuf : **les chants calés sur la
pulsation du geste** — `TBF_SON.chantDuGeste` chante tempo, contretemps, écho et
crescendo sur les durées que le serveur donne, depuis le même instant que le
pavé et les frappes comptées, et s'arrête à la fermeture de la fenêtre ; chaque
coup tombe à moins de 5 ms de la grille, et à moins de 40 ms de la pulsation
dessinée. **La rumeur suit le match** (`TBF_SON.rumeur`) : l'entrée, la mi-temps
qui retombe, la minute double qui pousse, l'ovation au but de son camp, la
tribune qui se vide à la fin, le vestiaire qui monte à chaque arrivée. Le tampon
claque (`bache`) à l'impact, et la page n'ajoute pas son propre clac au verdict.
La chaîne naît maintenant avec une relâche brève : le premier son d'une visite
sortait treize décibels sous les suivants (−33,1 contre −20,0 dBFS pour un tic,
mesuré), parce que le limiteur de Chrome naît fermé ; il sort à −21,0.

**Le mixage a changé, et il s'écoute.** L'interface sort 6 à 8 dB plus bas qu'en
ligne, la poussée, le contre et le chant environ 6 dB, le but encaissé et la
charge 3 à 4 dB : c'est le mixage dessiné, mesuré au banc. **Gaël doit l'écouter
sur un téléphone avant la mise en ligne** (`lot6/fx-b/ecoute/index.html` met
côte à côte, son par son, ce qui est en ligne et le lot).

#### La présence, éteinte

Une pastille de mot sur chaque ami de `/amis` — AU VIRAGE, EN DUEL, EN LIGNE ; rien
pour hors ligne —, « AMIS ICI » dans la tribune (`virage:amis`, `virage:ami`) et
l'interrupteur « apparaître hors ligne » au pied du tiroir. **Rien de cela ne
paraît tant que `presence.actif` est faux**, et il l'est à la livraison : éteinte,
`GET /api/presence` répond `{ actif: false }`, aucun écran n'en montre, aucune
activité n'est gardée en mémoire — `presence:smoke` le vérifie, jusqu'à un
éteint depuis `/admin`. Elle ne s'allumera qu'une fois la nouvelle
`CONFIDENTIALITE.md` (paragraphe « La présence de tes amis ») relue par un juriste
et mise en ligne. Sans `sql/arenes.sql`, elle reste éteinte même allumée : sans
la colonne du choix, personne ne pourrait s'y cacher. **La présence n'est jamais
écrite** : elle vit dans la mémoire du serveur ; seul le choix de se cacher l'est
(`user_wallet.presence`).

#### Le serveur de la vague 2

Une rubrique par clé dans `serveur/ECARTS.md`, et le contrat dans
`serveur/CONTRATS.md`, § 15 à § 18 (le texte du plan y a été collé **en premier**,
avant que les écrans codent contre lui, puis retouché deux fois sur le serveur
écrit — aucun champ renommé ni retiré).

**Le socle.** `sql/arenes.sql`, en dernier de `ORDRE`, **six instructions et rien
de plus** : `virage_presence.parfaits`, `serie_max`, `meilleur_q`, `meilleur_chant`,
l'index `idx_bilan (fixture_id, side, ferveur)` et `user_wallet.presence` — une
colonne par `ALTER`, une instruction par ligne. Sept réglages (`xp.virage` 15,
`xp.virage_chants` 10, `xp.virage_matchs_jour` 3, `virage.bilan_min` 5,
`presence.actif` faux, `presence.visible_defaut` vrai, `presence.en_ligne_sec`
120). **`src/shared/verdict.js`**, l'échelle écrite une fois, sans dépendance. La
source `virage` du grand livre, et la raison `quota`.

**Le verdict se mesure sur la note brute, relevée par le plancher, avant les
modificateurs du Fanzzy.** Le plan le mesurait sur la note finale, « comme
`perfectBonus` » — or `perfectBonus` lit la note brute : un Fanzzy à
`perfectBonus` 0,82 faisait d'un 0,95 un 0,779, écrit BON sur un geste que le
moteur venait de juger parfait. La note s'écrit en millièmes, **arrondie vers le
haut** (`enMilliemes`), parce que les seuils sont stricts : un 0,9004 arrondi au
plus proche ferait BON au bilan pour un geste annoncé PARFAIT en tribune.

**Le Virage** (`ferveur/bilan.js`, neuf, 580 lignes ; `virage.js` 1 382 → 1 870 ;
`ferveur/index.js` 791 → 1 529). Le bilan vient **de la base**, jamais de la salle
en mémoire — le membre disparaît de la salle à chaque déconnexion —, par une
lecture groupée par salle finie (deux requêtes, quel que soit l'effectif),
gardée deux minutes et partagée par une promesse en vol. L'XP se verse par le
grand livre, à la première demande de bilan et **en filet au départ de la tribune**
pour qui a chanté sans le demander ; elle passe par un sémaphore de quatre ; ni
`classe`, ni l'abonnement, ni la neutralité ne sont lus. Le verdict, la série (une
carte ne la coupe pas, un chant non PARFAIT la remet à zéro), le rang et le
palier suivant (100, 50, 10, 3, puis 1ᵉʳ), recalculés au plus une fois par
seconde ; le **plancher de ferveur** ; `virage:fin`, puis `virage:ferme` cinq
minutes plus tard ; `virage:souvenir` aux seuls receveurs (`mintGoal` rend
maintenant `userIds`) ; la présence dans la tribune ; `estAuVirage` et
`souvenirFrappe`. Les chants restent acceptés entre le coup de sifflet et
`virage:ferme`, sans code d'erreur de plus : le contrat le dit au lieu de
promettre des chiffres définitifs. Et **une salle n'émet plus `virage:crowd` à
chaque entrée** (D4) : sur un match de mille entrées au coup d'envoi, c'était de
l'ordre d'un million de messages inutiles.

**Le duel** (`nvn/index.js` 1 507 → 1 779 ; `deck/index.js` 845 → 1 053). Le
verdict du duel se mesure par un **rejeu de `grade`** juste avant le moteur
(`noteMesuree`) : `engine.js` ne sert que la note finale, et l'on ne remonte pas
de la note finale à la note mesurée. **`engine.js` n'a pas été touché**, et
`niveau-smoke` le lit. Le rejeu recopie la composition des modificateurs de
`modsDe`, privée au moteur ; un garde-fou, à chaque chant, vérifie que la note
rejouée passée par `applyHeroMods` retombe sur la `quality` du moteur, et
`nvn-smoke` le vérifie sur environ 383 chants — **si `engine.js` change un jour
`modsDe`, c'est là qu'il faut regarder.** `GAIN` et `DOUBLE_CLUB` ont déménagé
dans `deck/index.js` : `baseDuDuel` est la formule unique du versement et de
l'annonce `enJeu` — ce qui est promis est ce qui est versé. Les PARFAITS, la série
et le meilleur geste de chaque joueur sont dans `nvn:fin` ; les matchs `CANC` et
`PST` ne sont plus proposés, et l'entrée en file les refuse
(`duel.error.fixture_annule`).

**La présence** (`presence/index.js`, neuf, 515 lignes). La mémoire seule, trois
états, les amis mutuels revérifiés à chaque lecture, le crochet d'activité posé
juste après `attachUser`, `aPrevenir` en plus de `amisPresents` (un ami caché
reçoit encore l'entrée des autres, et son départ est annoncé à qui l'a vu entrer),
et un module qui ne fait jamais tomber la liste d'amis si une arène lève. Les
deux arènes se lisent par `Boolean(await fn(id))` : une promesse serait « vraie »
pour un simple `if`, et tout le monde serait au Virage.

**Le correctif du Virage** (section précédente) est dans la copie, sans une ligne
défaite : la partie B se bâtit dessus. D1, D2, D3, la libération des salles, la
fin de la minute double et `surgeMs`, le penalty manqué, le rejeu des buts.

#### Un correctif d'urgence, reporté à la main

Pendant l'atelier, Gaël a signalé quatre défauts du Virage : des cartes qui ne
reviennent pas dans la main, de vieux buts annoncés, des alertes posées sur le
pavé du geste, une carte jouée affichée deux fois. Un correctif a été écrit,
vérifié et relu **sur le code en ligne** (`0638fb5`, sept fichiers) ; la page
du lot 6 avait réécrit les mêmes endroits. Il a donc été **reporté à la main**,
ancré sur le texte qui l'entoure et non sur des numéros de ligne : le canal
`emitVous` et la main annoncée à chaque tirage — par `auJoueur`, la fonction du
lot qui envoie à toutes les sockets d'un joueur —, la garde des buts déjà au
tableau, le décompte des recharges côté page, la file `apresLaFenetre` qui attend
la fin du geste, et `fill: 'forwards'` sur le vol de la carte. Sur la page
neuve, ses contrôles changent de sélecteurs et de titres, pas de sens. Ses contrôles
sont reportés eux aussi, dans `virage-smoke`, `virage-ui-smoke` et
`actions-ui-smoke`. **Ces corrections existaient donc des deux côtés, écrites
différemment** : c'était le point délicat de la fusion (plus bas).

#### La base par copie, et le lot mené en parallèle

**Le verrou des suites est par copie, la base ne l'est pas.** Une copie de travail
a son propre `.tbf-suite.lock`, puisqu'il vit à la racine : une suite lancée dans
le lot 6 ne voyait pas celle qui tournait dans la copie principale, et vidait la
même base sous ses pieds. Le compte `tbf` ne peut pas créer de base `tbf_…`, mais
le serveur local laisse à tous les bases `test_…` : le lot a donc **sa base,
`test_lot6`**, sur le même serveur. `scripts/base-de-test.mjs` lit une ligne,
l'URL, dans **`.tbf-base-de-test`** à la racine de la copie — ignoré par git —,
après `DATABASE_URL`, qui passe toujours avant ; sans fichier, rien ne change.
L'audit prend son port au système, et `virage-loadtest.mjs`, qui visait par défaut
la **base de développement** et vidait `users` sans prendre le verrou, passe par
`baseDeTest()` comme les suites : il refuse un hôte distant.

La copie principale a vécu pendant ce temps : le lot 4 y a fini sa vérification
(un banc du lot 6 a fait tomber `virage:ui` de cette copie sur un délai de
navigation, qui a passé relancée seule), puis y a été mis en ligne ; Gaël a mis
en ligne le correctif du Virage et le sachet à 17 h 17, au milieu de la partie B ;
un atelier d'intégration y a ensuite posé la photo du tunnel et appliqué le
correctif d'urgence, que Gaël a commités ensemble (`524b2ca`) et mis en ligne
le 5 octobre à 5 h 19. **C'est pourquoi le lot n'a touché à aucun des documents
du dépôt** — `HISTORIQUE.md`, `ETAT.md`, `A-DEPLOYER.md`, `README.md`
changeaient dans l'autre copie au même moment : cette trace a été écrite en
brouillon, et versée à la fusion.

### Les pièges du lot

(Le détail utile est dans `ETAT.md`, § 6 ; ce qui suit dit l'histoire.)

**Un `ON DUPLICATE KEY UPDATE` s'évalue de gauche à droite.** MariaDB, sans
`SIMULTANEOUS_ASSIGNMENT` : une colonne qui compare l'ancienne valeur d'une autre
(`meilleur_chant` selon `meilleur_q`) s'écrit **avant** elle. Inversées, elles ne
lèvent rien, et le meilleur chant ne change plus jamais après le premier. La
suite joue le cas — 0,92 sur « montée », puis 0,97 sur « mur », puis 0,93 sur
« cadence » — et la mutation « note avant chant » la fait rougir.

**Une socket n'est pas un joueur.** Ce qui part « au joueur » part à toutes ses
sockets, et il ne quitte une salle que quand la dernière s'en va. Le contrôle
« revenir dans la salle ne redistribue pas la main » du Virage était vert
**parce qu'il rappelait `join` sans `leave` entre les deux** : il n'éprouvait pas
le vrai chemin d'une reconnexion. La suite passe maintenant par `disconnect`, puis
`virage:join` sur une socket neuve.

**Un verdict mesuré sur la mauvaise note dit un mot faux.** Voir « Le serveur » :
la note finale n'est pas la note qu'a jugée le moteur. Et un arrondi au plus
proche à la frontière d'un seuil strict change le mot.

**Une ferveur arrondie à zéro rend « 1ᵉʳ » à tout le monde.** Le rang était
« 1 + ceux qui font mieux » : dans une grande tribune, personne ne fait mieux de
zéro. Le plancher et le départage par les chants puis les PARFAITS le
répondent — et le contrôle de proportion du Virage (« dix fois plus de monde,
dix fois moins par tête ») se mesure sur des tribunes où le plancher ne mord
pas, sans quoi il rougirait à raison.

**Une promesse n'est pas un booléen.** Les deux arènes se lisent par
`Boolean(await fn(id))`, et `verif-cablage` éprouve les vraies arènes montées
sur de faux appuis : une présence branchée avant les arènes recevrait deux
`undefined` et ne dirait jamais ni l'un ni l'autre, sans un mot.

**Deux copies, un port.** L'audit prenait toujours le 3999 ; un second audit dans
une autre copie trouvait au 3999 le serveur de la première, qui répondait, et
mesurait ses pages et sa base sans le dire.

**Une page éteint à son départ ce qu'elle a montré, et `contexte.close()` ne
l'attend pas.** L'album de `/collection` donnait 201, 202 ou 203 textes sur le
même commit parce que la requête `keepalive` de départ de l'état d'avant arrivait
au serveur après que l'état suivant avait resemé ses nouveautés. La cause était
dans la mesure.

**Un émoji hors plan de base décale tout ce qui suit.** `appels:test` dénonçait
soixante-quatre noms que `virage.html` déclare pourtant : le ticket terrain porte
un carton rouge et un carton jaune (🟥, 🟨), qui tiennent en deux unités UTF-16 pour
`s.length` et en un point de code pour `Array.from(s)` ; le tableau de sortie
était indexé d'une façon, le parcours de l'autre, et l'effacement tombait un
caractère trop tard — le début de « function » partait avec. Tout se compte en
points de code.

**La sonde qui mesure faux accuse le CSS.** « LA BASCULE » était couverte à 12 %
au duel : la sonde « libellé couvert » balayait le rectangle d'une ligne penchée de
6°, qui déborde des lettres, et comptait des coins où le dessus de la pile était le
dessin de la carte. La sonde a été corrigée avant la feuille, et le dessin d'une
carte ne prend plus le doigt.

**Un pourcentage se lit sur la boîte qui le porte.** `--pli` valait
`largeur × 0,06` ; le duel pose une largeur en pourcentage de la main, que les
libellés relisaient sur la carte : le côté couvert ne s'écartait que de 1,3 px au
duel contre 4,3 au Virage, et « LA BASCULE » tenait sur une ligne ici, deux là.

**Deux paragraphes du contrat portent le même numéro.** Le correctif du Virage
déclarait son contrat « § 15 » dans la copie principale ; le plan de la vague 2
réservait le § 15 au bilan de tribune. Il n'y avait pas de conflit de texte, il y
avait un conflit de sens : voir « La fusion dans la copie principale ».

**Les outils du poste.** Dans le Bash de ce poste, `grep -c $'\r'` compte toutes
les lignes et fait croire à des CRLF partout : compter avec
`CR=$(printf '\r')`. Et `git clean -fd` a retiré `.tbf-base-de-test` d'une copie
revenue à un `.gitignore` qui ne l'ignorait pas : le fichier est recréé.

### Ce que la mesure dit après

L'état de départ est celui du commit `60fe268`, pris le 4 octobre de 12 h 21 à
12 h 32 ; la fin, le cinquième tour, le 5 octobre de 4 h 31 à 4 h 43 (douze
minutes et quatorze secondes), sur la copie de travail, base `test_lot6`, aucune
erreur de script, aucune panne de maintenance.

| Budget de hauteur (px) | départ | fin |
|---|---|---|
| Virage, arène, à 360 × 640 / 320 × 568 / 412 × 915 / 768 × 1024 | 157 / 91 / 459 / 584 | 266 / 200 / 541 / 650 |
| Virage, HUD + rangée sous lui, à 360 × 640 | 72 + 64 | 62 + 24 |
| Duel, arène, aux mêmes quatre formats | 158 / 132 / 429 / 454 | 215 / 133 / 490 / 599 |
| Duel, la rangée des chants à 320 × 568 | 111, hors de l'écran | 123, entière |
| Virage, tableau, rangée d'actions, main à 360 × 640 | – | 52, 80, 134 (fenêtre 640 sur 640) |

| Relevé des arènes (71 relevés d'état) | départ | fin |
|---|---|---|
| texte sous 11 px, opacité sous 0,85, petit or, pâle, débordement, hors écran, encre rognée, libellé couvert, erreur de script | 0 (pâle : 8 à l'affiche du duel) | 0 partout |
| texte coupé | virage@tribune et @double 2 à 320, vestiaire 2, affiche 5 à 360 et 12 à 320, duel@jeu 3 / 3 / 1 | 0 partout |
| animations qui ne s'arrêtent jamais | non mesurées | Virage 2, duel 0 à 1, plafond de 3 tenu |
| voile du mur `.dense` (75 %) | partout, mur compris | levé : le voile du hub |

Contre le tour 3, **zéro pire** sur toutes les colonnes bloquantes. Seul écart
de colonne consultative : au bilan de fin de match, « sur grain » passe de 2 à 4,
parce que le bilan lit 23 textes au lieu de 20 (zéro pâle, zéro pâle sur grain).
Les colonnes « au jour » et « sur grain » montent aux faces vives — « MINUTE
DOUBLE » en blanc sur le flare à 2,6:1, le tampon vert « TU Y ÉTAIS » à 2,8:1 :
l'arbitrage du 2 octobre sur les faces vives, consultatif, qui ne joue qu'au
soleil.

Mesuré à part, au banc : le geste reste noté par le serveur (les seuls
évènements de geste sont `virage:chant` et `nvn:chant` avec des instants, et
`POST /api/repetition` ; aucun seuil 0,9 / 0,7 / 0,4 dans une page) ; au plus
trois animations infinies, **0 sous mouvement réduit** hors le scotch de temps de
la case de BD, voulu et documenté ; chaque bloc `prefers-reduced-motion` de la
section des pièces a son double `data-calme` règle pour règle ; **aucune ligne vide
ni tiret** sur un Virage minimal, un bilan à vide, un bilan réduit à la ferveur,
un duel sans fixture ni stade ; la carte-souvenir ne s'annonce que sur
`virage:souvenir`.

**Le serveur sous charge** (`npm run charge 300`, base de test, pool de huit) :
300 supporters dans la tribune du coup de sifflet et 75 qui se vident, **chant →
corde au 95ᵉ centile 100 ms**, bilans 300 sur 300 dont **zéro au-delà de trois
secondes** (95ᵉ centile 5 ms), **188 connexions pour 188 versements dus**, file du
pool au plus 3, sémaphore à 0.

### Éprouvé

Les contrôles statiques sont verts sur la copie du lot : `npm run pages` (81 contrôles,
dont « le verdict »), `npm run cablage` (**66**, contre cinq rouges que la
fusion avait laissés à la partie B : le Virage lit la présence, rend
`estAuVirage` et `souvenirFrappe`, et `mintGoal` rend `userIds`),
`npm run promesses`, `npm run pages:navigateur` (24 écrans, serveur muet compris,
26 contrôles), `npm run schema:smoke` (47), `npm run securite` (24, avec deux
points d'attention par nature). Aucun retour chariot, aucun marqueur de conflit,
aucun `console.log` ni `debugger` dans les pages, `node --check` passe.

Le dernier tour complet de `tout-tester` que le lot a gardé, le 4 octobre à
23 h 28 : **soixante-six suites, 5 405 contrôles** en vingt-deux minutes vingt-cinq,
contre soixante-quatre et 4 708 à la fin de l'intégration. Deux rouges :
`deck:ui` (un, celui d'avant le lot 0 : « l'effet combiné est affiché », sans lien
avec les arènes) et `appels:test` (l'émoji, plus haut — **réparé et vérifié le
5 octobre : 45 contrôles verts**). **`nvn:ui` n'a plus aucun rouge** : les trois
d'avant le lot 0, le bloc « la porte de sortie », venaient de `nav.js`.

Suites relancées par le dernier rapport, sur `test_lot6`, une à la fois :
`virage:ui` **212** (149 au départ du lot), `nvn:ui` 193, `virage:smoke` **357**
(189 à la fusion : la reconnexion rend le souffle et la main laissés, la présence
éteinte n'émet rien, une entrée n'émet pas `virage:crowd`, une transaction par
versement dû), `salles:test` 137, `releve:test` 56, `souvenirs:smoke` 68 (49),
`presence:smoke` 100, `verdict:smoke` 27, `son:smoke` 166 (148), `gestes:test` 69,
`menu:smoke` 27, `repetition:ui` 86, `amis:ui` 47, `amis:smoke` 87,
`quotidien:smoke` 216 (les chants se comptent toujours), `foot:smoke` 71,
`nvn:smoke` 111, `nvn:net` 167, `reglages:smoke` 65, `repetition:smoke` 19,
`cartes:ui` 38, `deck:ui` (un rouge connu, 80 verts) ; `accueil:ui`, intermittente
comme avant, verte. **`nvn:net` n'est pas lancée par `npm test`** : `tout-tester`
ne retient que les clés en `:smoke`, `:test` et `:ui` ; elle se lance à la main.
`recompenses:smoke` (103), `abo:smoke` (81) et `auth:smoke` (72) ont été relancées
par le socle après la fusion, et leurs fichiers n'ont pas bougé depuis.

Chaque contrôle neuf a été **cassé exprès** : le socle (deux `ADD COLUMN` dans un
`ALTER`, `>=` au seuil de PARFAIT, `presence.actif` allumé par défaut,
`'virage'` retiré de `SOURCES`, `deleteUser` qui oublie la préférence), `verdict-smoke`
(douze mutations), `verif-pages` (quatorze formes), l'audit (vingt-trois
mutations, vingt-trois rouges), les briques (HUD défait, cartes défaites, encre
rognée revenue : chacune rougit au banc). Captures à 360 × 640, 320 × 568, 412 et
768 × 1024 relues à côté du départ et de la maquette : aucun écran cassé ni
illisible. Ce que l'audit ne tranche pas : le mixage sonore, et le contraste des faces vives
au soleil, que ses colonnes « au jour » et « sur grain » relèvent sans le
juger.

### La fusion dans la copie principale

Le 5 octobre vers 5 h 35, la copie principale propre, à `524b2ca` — en ligne
depuis 5 h 19 —, la copie du lot inchangée depuis la répétition (`git diff
--binary 7450c03` redonne le patch de la répétition, sha1 `85cdde30…`). Le relevé
des fichiers communs donne les dix-huit attendus, pas un de plus. Le patch est
appliqué en trois voies (`git apply -3 --binary`), puis désindexé, les six
fichiers neufs marqués (`git add -N`).

**Cinquante-deux fichiers** que seul le lot change passent tels quels ; **quatre**
sont identiques des deux côtés (`actions-ui-smoke`, `football-smoke`,
`releve-smoke`, `football/routes.js`) ; **quatre** fusionnent seuls
(`package.json`, `action-art.js`, `verif-pages.mjs`, `server.js` : la présence
du lot et `createAide({ …, fanzzy })` de l'intégration y sont tous deux). **Dix
sont en conflit**, et chacun a été tranché par la règle écrite et éprouvée
d'avance dans un arbre à part :

- **le fichier du lot, entier** : `ferveur/index.js`, `ferveur/virage.js`,
  `virage.html`, `virage-ui-smoke`, `virage-smoke`, `salles-smoke` (que le lot
  avait complété, 134 → 137 contrôles). Avant de le prendre, chaque ligne que la
  copie principale ajoutait a été cherchée dans le fichier du lot : il n'en
  manque aucune de `salles-smoke`, trois de `virage.js` (une construction
  équivalente), cinq lignes de commentaire de `virage-smoke` ; `virage.html`
  est réécrit, et porte `apresLaFenetre`, `viderApresLeGeste`,
  `rangerLeSouvenir`, `rechargeRestante`, `cdVuA`, `minuteApprise`,
  `dAvantLEntree`, `sentirLeBut` et `fill: 'forwards'` ;
- **le correctif d'urgence, écrit deux fois** : dans `ferveur/index.js`, les
  treize lignes du principal absentes du lot sont exactement `aSesOnglets` — la
  main envoyée à toutes les sockets du joueur — et ses deux appels. Le lot fait
  la même chose par `auJoueur(fixtureId, userId, évènement, charge)`, plus
  complète (l'identifiant ramené à une chaîne, le nombre de sockets atteintes
  rendu, et servie aussi aux amis et aux cartes-souvenirs). **Une seule version
  reste, celle du lot** : `aSesOnglets` n'existe plus nulle part, et la main ne
  part qu'une fois après une carte jouée (`auJoueur(…, 'virage:vous', …)`),
  au tirage par `emitVous`, et à la seule socket fautive par le filet
  `REFUS_DE_MAIN` ;
- **le fichier du principal** : `poller.js` (cinq lignes de commentaire de
  l'intégration ; le lot avait la version de `0638fb5`) ;
- **les deux blocs gardés** : `verif-cablage.mjs` (les cinq contrôles de l'aide
  et ceux de la présence) et `serveur/ECARTS.md` (la rubrique
  `serveur-correctif`, puis « Vague 2 »). `git merge-file --union` y perd ce
  que les deux ajouts ont en commun : l'accolade fermante et la ligne vide du
  premier bloc de `verif-cablage`, rétablies à la main (`node --check` vert) ;
  et — ce que la répétition n'avait pas vu — le filet `---` qui ouvrait la
  rubrique du lot dans `ECARTS.md`, rétabli lui aussi. Compté : aucune ligne
  d'aucun côté ne manque, et chaque fichier fait la base plus les deux ajouts ;
- **`serveur/CONTRATS.md`, le numéro 15.** Le correctif avait déclaré son
  contrat « § 15 » ; le lot y a son bilan de tribune, et avait déjà reversé le
  contenu du correctif aux § 16.2, § 16.5 et § 16.6. Fusionné en trois voies avec
  le lot dans les deux morceaux en conflit — le § 15 et la ligne de `virage.html`
  au tableau des lecteurs —, **pas** avec `git checkout --theirs`, qui aurait
  effacé la révision du § 5.1 de l'intégration (l'anneau de `/collection` vise
  le prochain cran) : elle est là. Les renvois au « § 15 » du correctif sont
  renumérotés — trois dans `ECARTS.md` (serveur-correctif), trois dans la
  section précédente de ce journal (avec une note : la phrase fautive du § 15.4
  est sans objet), `ETAT.md` et `A-DEPLOYER.md`. `ECARTS.md` garde deux
  rubriques sur le même correctif, `serveur-correctif` (longue) et
  `serveur-virage` (courte, qui renvoie au contrat) : c'est voulu, les dédoubler
  serait une retouche à part.

Les quatorze fichiers communs sont, octet pour octet, ceux de la répétition — le
filet d'`ECARTS.md` en plus.

**Les deux fautes que le dernier rapport du lot avait laissées dans `ui.css`
sont corrigées à la fusion.**

- **L'accent de « CÈDE ».** `.tbf-vignette-mot` avait un interligne de 0,94 ;
  en Oswald 700, l'accent d'une capitale monte à 1,11 corps au-dessus de la
  ligne de base du dessus, en comptant le bas de ses lettres. Mesuré au banc,
  sur la vraie page du duel, la case redressée : « LA CORDE / CÈDE ! » posait
  l'accent **5,9 à 9,2 px dans le C** de « CORDE », de 320 à 768 px de large —
  et « ILS ONT / FAIT CÉDER » de même. L'interligne passe à **1,16**, et deux
  marges de **−0,11 corps** rendent ce qu'il ajoute : l'accent garde 1,6 à
  2,6 px d'air, et **un titre d'une ligne ne bouge pas** — la case garde sa
  hauteur au centième de pixel près, la lettre au demi-pixel d'arrondi près
  (GOAL !, ON ENCAISSE, le bilan VICTOIRE, « NIVEAU 5 », dont la règle
  `.tbf-niv-n` repose sa marge et compense de même). Les titres de deux lignes
  sans accent prennent le même interligne : MINUTE / DOUBLE s'aère d'une
  dizaine de pixels.
- **Les deux mouvements des gestes sans leurs doubles.** La case qui se lève à
  l'ola (`.tbf-ola-anneau i.tbf-debout`) grandissait de près du double à chaque
  frappe, et la cible qui pâlit à la visée (`.tbf-visee .cible.vue.passe`) se
  resserrait en deux tiers de seconde, sous le mouvement réduit comme sous le
  calme. Ils ont leur double `prefers-reduced-motion` et
  `html[data-calme~="animations"]`, règle pour règle : la case garde son
  éclair blanc — c'est lui qui dit que la frappe est prise — sans grandir
  (`tbfDeboutCalme`), la cible pâlit au même rythme sans se resserrer. Relevé
  dans les trois modes ; les règles sous mouvement réduit passent de 108 à 110,
  toutes deux avec leur double.

**Éprouvé sur la copie fusionnée**, avant tout commit : aucun marqueur de
conflit, aucun retour chariot ; `node --check` sur les cinquante-trois `.js` et
`.mjs` modifiés ou neufs ; `npm run pages` **83** (dont « 9 image(s)
demandée(s), toutes présentes », « 8 sachet(s) dessiné(s) » et « le verdict »),
`npm run cablage` **71** (les cinq de l'aide et ceux de la présence),
`npm run promesses` (avec l'avertissement connu des six pages sans suite
d'interface), `pages:navigateur` 26 (les vingt-quatre écrans, serveur muet
compris), `cartes:ui` 38, `son:smoke` 166 ; sur la base `tbf`,
`schema-smoke` 47 (les trente-quatre fichiers montés). La répétition avait fait
tourner vingt-six suites sur l'arbre fusionné, toutes vertes (`virage:ui` 212,
`virage:smoke` 357, `nvn:ui` 193, `accueil:ui` 223…). **Ni `npm test` en
entier, ni l'audit, ni `npm run charge` n'ont tourné sur la copie fusionnée** :
c'est la vérification d'avant la livraison (`A-DEPLOYER.md`).

### En ligne

**Rien du lot 6 n'est en ligne.** La production sert `524b2ca` depuis le
5 octobre vers 5 h 19 — le lot 4, le correctif des salles du Virage, le correctif
d'urgence des quatre retours de Gaël, le tunnel et le sachet. Relevé à 5 h 35 :
`/healthz` répond `ok: true`, sans panne, `"virage": "0 salle(s)"`, et
`uptime_s` (952) dit un redémarrage vers 5 h 19 ; `virage.html` et
`action-art.js` servis sont ceux de `524b2ca`, octet pour octet. Le lot est
versé dans la copie principale, **pas encore commité**. Sa livraison remplace le
correctif d'urgence en ligne par son équivalent du lot (`auJoueur` pour
`aSesOnglets`). Elle passe par le schéma — `sql/arenes.sql`, par `npm run
schema:appliquer` en SSH, puis un redémarrage, hors d'un match en direct — et
`A-DEPLOYER.md` dit l'ordre. **La présence reste éteinte.**

### Ce qui reste

**D'abord, la vérification sur la base `tbf`**, dans la copie principale, avant
de commiter et de livrer : `npm test` en entier (soixante-six suites ; attendu
tout vert sauf le rouge connu de `deck:ui`, `accueil:ui` intermittente),
`nvn:net` à la main, `npm run audit:ui -- --jour --etats` en arrière-plan
(rien ne doit empirer sur les colonnes bloquantes), `npm run charge 300` et
`npm run securite`. Puis commiter le tout ensemble — le code, le schéma, les
suites et cette trace — et livrer (`A-DEPLOYER.md`). **La sonde « encre
rognée » ne voit toujours pas un accent qui en touche un autre** : la faute de
« CÈDE » est corrigée, pas la sonde.

**Les constats de détail de la critique, non repris.** Les neuf constats
importants ont été traités : les bâches de sortie collées, la minute double en
toutes lettres, la bâche du duel, les noms de l'affiche, le combo en vert, le rang
en tête du bilan, UN AUTRE MATCH au coup de sifflet, ENTRER EN FILE collante, les
états d'audit manquants. Parmi les quatorze de détail, **ceux que j'ai relus dans
le code le 5 octobre sont encore là** : au Virage comme au duel, **un cran de
souffle par coût distinct** — la feuille sait n'en poser que deux et les faire
claquer, les pages ne l'écrivent pas — ; le pas de 700 ms du bilan du duel, qui
fait six secondes avant TOI/LUI ; la fenêtre du geste du duel garde sa tête
d'avant (un titre nu, la consigne au-dessus du pavé) quand le Virage a deux
stickers ; BON s'écrit à l'encre noire sur le kraft au lieu du bleu foncé ; la
face de la carte-souvenir est un aplat noir au lieu de la plaque de rareté ;
« TU Y ÉTAIS » est vert à chaque bilan, y compris quand on sort à la 66ᵉ minute ;
un match pas encore commencé met son heure dans la banderole du score (« 02:55 »
se lit comme un score) ; les places libres du vestiaire portent un « + » sans
geste derrière ; les noms de carte se coupent dans le mot (`hyphens:auto`) ;
l'interrupteur de présence partage la ligne du volume. **Les autres** — les
cartes qui gardent leur taille de téléphone à 768 px, l'écharpe que le voile du
choix de camp donne aux deux côtés quand aucune couleur de club n'est servie —
ne sont pas revérifiés. Et **les gestes positionnels** (tifo, visée, ola, bascule,
jauge) gardent leur matière d'avant, à côté du pavé craie : une passe de matière,
pour le lot 7, qui ne change rien au geste ni à sa notation.

**Les décisions qui reviennent à Gaël :**

- **Le tunnel au voile du Virage.** La page du lot ne nomme aucune image du
  tunnel (« la tribune à 25 % sous un voile ») : elle a été écrite avant la photo,
  qui existe depuis l'intégration (`tunnel-portrait`, `tunnel-paysage`). La
  fusion ne la branche pas — c'est un changement de page, avec son contrôle
  (`verif-pages` exige les trois formats de toute image nommée) : au lot 7, ou
  dans un petit lot à part.

- **Le stade du duel.** Il est tiré sur l'identifiant du duel (un `randomUUID`
  dans `engine.js`), pas sur le match : deux duels sur le même match tombent dans
  deux stades, contre « le stade appartient au match » (`ETAT.md` § 3). La
  correction tient en une ligne dans `engine.js`, mais `engine.js` est hors du lot,
  trois suites le lisent, et c'est une règle de jeu. Tant qu'elle n'est pas
  prise, la préparation n'a pas de stade-mini.
- **Allumer la présence**, après la nouvelle `CONFIDENTIALITE.md` relue par un
  juriste (les mineurs, dossier L5) et mise en ligne.
- **Écouter le mixage** sur un téléphone avant la mise en ligne.
- **Les 600 ms du verdict** comptées depuis la fin du geste, ou depuis la dernière
  frappe (lecture littérale du brief, qui rendrait le tampon quasi inutile).
- **Un combo en jeu au duel** : `serie` sur l'évènement `chant` — refusé, aucune
  page ne le lit ; le compte existe, l'ajout tient en une ligne.
- **`gains.wallet` dans `nvn:fin`**, non servi : `tbf:bourse` part sans solde et
  `nav.js` relit.
- **`nvn:net`**, jamais lancée par `npm test` : renommer la clé ou élargir
  `tout-tester`.
- **Les trois questions laissées par le correctif d'urgence** : la priorité du
  but réel sur les autres moments d'un même geste, les cartes-souvenirs d'un but
  ancien, et le trou d'une suite qui ne fait passer aucun scénario de relevé
  jusqu'à la salle.

**Le lot 7**, dans cet ordre (Q13) : le sachet de LA REPRISE et le tunnel — **déjà
produits par l'intégration**, et le voile du Virage n'a pas encore pris le
tunnel, il garde la tribune à 25 % —, puis le foulard, la corde et les
silhouettes (à la main, sans crédit), les dessins de chant en 2:3, et la passe de
matière des gestes. Pour le Fanzzy vivant, un pilote sur RP1 seulement.

---

## 4 quadragies septies. Le lot 7 — le foulard, la corde, les silhouettes, et le monde qu'on voit enfin

*5 octobre 2026, deux sessions cloud : « Reprise de la refonte » (PR #2), puis
« Lot 7 : images Artlist » (PR #3). Les deux sont dans `main` depuis le
5 octobre (`057e18f`), pas encore en ligne.*

### Ce qui a changé

- **Les vieux buts, à la cause** (PR #2). Le relevé redemande les événements à
  chaque tour du direct tant que sa liste compte moins de buts que le tableau,
  au plus neuf tours (`enAttente`, `RELANCES_MAX` dans `poller.js`) : le but que
  l'API publie après le score part au tour qui le trouve. Et le voile du
  Virage prend enfin la photo du tunnel.
- **Le foulard noué** (point 1). Une famille `arene` dans `stuff-images.mjs`,
  le fond vert détouré, 256 px en AVIF, WebP et PNG. Il remplace le disque du
  lot 6 sur `#knot` (48 px au Virage) et `#noeud` (40 px au duel), teint au camp
  qui mène par un dégradé posé en `multiply` sous le dessin et découpé par lui.
  Le disque reste le repli d'un navigateur sans `mask`. `verif-pages` vérifie
  que chaque pièce d'arène que `ui.css` demande existe en ses trois formats.
- **La corde tressée et les six silhouettes** (points 2 et 3), dessinées à la
  main en SVG, sans crédit : une tuile de 14 × 27 décalquée de la référence
  Artlist (trois torons, fond transparent sur `--corde-fil`), au Virage, au
  duel, au chemin de niveau et à l'arbre des âges ; six poses d'après la
  planche du 4 octobre (bras levés, écharpe, tambour, mégaphone, mains
  frappées, tirant la corde). Le repos et l'assis restent pour `.muet` et
  `.parti`.
- **Personne en face** (`CONTRATS.md`, § 16.7). Gaël a demandé s'il fallait un
  joueur de chaque côté pour que les points comptent. Non : le supporter seul
  continue de marquer, sinon il ne pourrait plus jouer seul. Mais la
  corde retombe de 3 par seconde au lieu de 1,4 quand le camp d'en face est
  vide (`virage.decroissance_vide`, réglable ; à 1,4, l'ancien jeu), la
  tribune vide dit « PERSONNE EN FACE », et la foule ne saute plus que sur
  `pousse`, le camp qui a vraiment chanté.
- **Le monde qui joue, enfin visible.** Gaël trouvait qu'un joueur ne voyait
  ni les duels qui attendent ni le Virage qui chante. L'accueil porte une bâche
  violette au pied du personnage, « 37 supporters dans les virages · 3 duels
  attendent un joueur », et le tiroir les mêmes nombres sur VIRAGE (nouvel
  état `monde`) et DUEL (les duels qui attendent, et non plus les présents
  d'une file). Les deux comptes sont écrits une fois, dans `menu.js`.

### Pourquoi la bâche est là

- **Au pied du personnage**, parce qu'il n'y avait pas d'autre place : les
  rails tiennent trois états au plus, la bande du bas est pleine, et les
  planchers de taille du personnage ne bougent pas. Posée sur ses chaussures,
  elle ne lui prend rien d'autre, de 320 à 412 px de large.
- **Une bâche (`.tbf-plaque`), pas un sticker** : un sticker n'est jamais une
  cible à lui seul. **Violette**, parce que ce sont des gens (amendement 18).
- **Elle se tait quand un club du joueur joue** : ce soir-là, l'accueil parle
  de son match. Et elle ne répète pas le seul duel que le bouton propose déjà.
- **À égalité, elle mène à la file** : un duel ne part pas sans le joueur qui
  lui manque, une tribune chante sans lui.
- **Le menu ne s'allume pas pour le monde** : son bouton est réservé à ce qui
  presse (le direct, un booster prêt, un duel qui attend).

### Contrôles

`menu:smoke`, `pages`, `salles:test`, `virage:smoke`, `reglages:smoke` verts.
`accueil:ui` (+ 9 contrôles du bandeau), `virage:ui` (+ 5) et `nvn:ui` gardent
sept rouges propres au conteneur cloud, présentes aussi sur `main` avant le
lot : CLASSEMENT rogné, le pays dans la langue du lecteur, les trois contrôles
d'invitation du Virage, la hauteur de l'arène du duel à 360 × 640 et une ligne
de l'historique des duels.

### Une nouvelle façon de livrer

Gaël a demandé, le 5 octobre, de ne plus passer par des PR en attente de son
accord : une session fusionne elle-même dans `main` quand toutes les suites
passent sans nouvel échec, et lui demande encore avant un schéma ou un choix
qui lui revient. La mise en ligne reste à lui (`refonte/README.md`, « Comment
on travaille »).

### Ce qui reste

- **Le Fanzzy vivant** (point 4). La respiration et le saut existent déjà ; il
  manque un caractère. Proposé à Gaël avec les cinq expressions dessinées : il
  raconte le dernier match de son club en accueillant le joueur, il répond
  autrement quand on insiste à le toucher, il fête un retour après quelques
  jours. Le clignement attend une image « yeux fermés » par Fanzzy.
- **Les sons**, au choix de Gaël (`art/son/_src/artlist/A-ECOUTER.md`).
- Les dessins de chant en 2:3 et la passe de matière des gestes positionnels,
  que le lot 6 renvoyait ici.

---

## 4 quadragies octies. Le Fanzzy vivant — il raconte, il répond, il fête

*5 octobre 2026, session cloud « Lot 7 : images Artlist ». Un essai filmé sur
RP1 et montré à Gaël avant la fusion : `lot7/vivant/rp1-vivant.mp4` et
`rp1-vivant-captures.jpg`, dans les fichiers du projet.*

### Ce qui a changé

- **Il raconte le dernier match de ton club.** À l'arrivée sur l'accueil, le
  temps du ticket de retour (3,3 secondes), le Fanzzy prend le visage du
  dernier match que le ticket annonce : la joie et un saut après une
  victoire, le dépit sans saut après une défaite. Puis il rend la main au
  repos que le joueur a choisi.
- **Il fête le retour.** Sans match à raconter, une absence de 48 heures ou
  plus se fête d'une joie et d'un saut, une fois le coucou fini. L'absence
  vient du serveur (`depuis.ilYaMs`) ou, quand il n'a pas de nouvelles et ne
  sert donc pas `depuis`, de la dernière arrivée notée sur l'appareil
  (`tbf.arrivee.<joueur>`, dans `localStorage`).
- **Il répond quand on insiste.** Trois touchers d'affilée (moins de 1,2
  seconde entre deux) : la joie, 1,6 seconde. Six : la colère, et il boude
  1,8 seconde, sans sauter.

### Pourquoi comme ça

- **Aucune image neuve.** Les familles d'expressions de `fanzzy-etats.js`
  donnent à chaque moment le dessin le plus proche : les 35 Fanzzy de LA
  REPRISE ont leur joie, leur dépit et leur colère ; TR1 et TR2 leurs douze
  moments ; le supporter générique ses quatre poses, sans colère, et il saute
  donc à chacun des six touchers. Un personnage dont le moment n'est pas
  dessiné ne change pas de visage (`dessine`) : un visage qui ne bouge pas ne
  raconte rien, et un Fanzzy qui « boude » sans que rien ne change sur lui
  s'est simplement arrêté de sauter.
- **Sur le ticket, pas en plus.** Le récit ne joue que si le ticket de retour
  s'affiche, et dure ce qu'il dure : le joueur lit le score pendant que le
  Fanzzy le vit. La victoire de la veille ne se rejoue pas comme un but qui
  tombe : trois secondes de souvenir, puis le repos choisi. Un nul ne se
  raconte pas, faute d'expression pour lui.
- **La fête après le coucou**, pour que le salut garde son geste.
- **Un moment garde son visage.** Pendant un but ou un récit, un toucher
  n'est qu'un saut. Mais le salut d'arrivée, chez qui ne l'a pas dessiné,
  tient deux secondes et demie le visage de repos, et c'est là que tombent
  les premiers touchers d'un joueur : un moment qui ne se voit pas ne retient
  rien. La suite l'a trouvé, ses touchers tombant précisément pendant ce
  salut.
- **Aucune animation infinie de plus** : le saut et le fondu de pose
  existaient, et `prefers-reduced-motion` comme `data-calme` les coupent
  déjà.

### Contrôles

`accueil:ui` : 17 contrôles de plus (le récit de la victoire et de la défaite,
la fête et son heure, la marque de l'appareil, les touchers, la bouderie, le
moment qui garde son visage, le supporter sans colère), tous verts. Les 66
suites (`npm test`) n'ont aucune rouge nouvelle : celles qui restent rougissent
à l'identique sur `main` dans un conteneur cloud, où le Chrome des suites ne
charge pas les polices Google et où la base de test n'était pas à l'heure de
Zurich.

### Ce qui reste

- **Le clignement**, le signe de vie le plus fort : une image « yeux fermés »
  par Fanzzy, que Gaël produit (une pour RP1 d'abord).
- **Le rouge contre nous, en colère** : le résumé de retour (`depuis.matchs`)
  ne dit pas les cartons.
- **Le Fanzzy dans l'arène du duel**, qui réagit aux buts de son camp.

---

## 4 quadragies novies. Le duel vivant — les deux Fanzzy dans l'arène

*5 octobre 2026, session cloud « Lot 7 : images Artlist ». Filmé pour Gaël
avant la fusion, RP1 contre RP3 puis TR32 contre TR1 : `lot7/duel/duel-vivant.mp4`
et `duel-vivant-captures.jpg`, dans les fichiers du projet.*

### Ce qui a changé

- **Les deux Fanzzy en tribune descendent dans l'arène du duel.** Le sien en
  bas à gauche, juste devant sa ligne de but ; celui d'en face en bas à
  droite, retourné pour lui faire face. Ils entrent en glissant quand
  l'affiche se retire.
- **Ils vivent le duel.** La joie et un saut pour la tribune qui marque, un
  but de corde ou un but du vrai match ; le dépit, terni, pour celle qui
  encaisse ; un pas vers la corde quand leur tribune pousse ; la colère quand
  un coup d'en face tombe sur leur tribune (silence, brouillard, parcage,
  vent de face, Renvoi compris).
- **La case de BD se pose au-dessus de la corde** quand ils sont à l'écran :
  centrée, elle couvrait les deux au moment même où l'un sautait et l'autre
  s'affaissait.
- **Le but du vrai match ne fait plus lever la page.** Trouvé en chemin et
  fusionné à part, avant (PR #7) : le serveur dit la tribune du club buteur
  (`side`) et compte dans `souffles` un nombre de joueurs, que la page
  lisait comme une paire. Chaque vrai but marqué pendant un duel en ligne
  perdait sa case « GOAL ! », sa corne et le reste de l'envoi.

### Pourquoi comme ça

- **Le moment, pas la famille.** La page demande `but`, `encaisse`,
  `decision`, `pousse` : `resoudre` sert à TR1 et TR2 leurs dessins de ces
  moments, aux 35 Fanzzy de LA REPRISE la joie, le dépit et la colère de leur
  famille. Un Fanzzy sans expression dessinée garde son plein-pied, et c'est
  le geste qui joue : il saute, s'affaisse, se penche et trépigne sur le même
  dessin. Un personnage sans aucun dessin laisse sa place au supporter
  générique, comme à l'accueil.
- **Le manifeste des expressions d'abord**, sans quoi un Fanzzy de LA
  REPRISE se poserait sur son dessin plat puis sauterait sur celui de ses
  expressions, avec un autre cadrage. Deux calques par figure, comme le
  personnage de l'accueil : l'expression neuve se charge derrière, puis les
  opacités se croisent, jamais de cadre vide ; et la dernière demandée gagne.
- **Celui d'en face** est le premier joueur connecté de sa tribune, au dessin
  de base : la vue ne dit pas sa tenue. Le sien suit la Relève et le
  changement de Fanzzy, à son âge ; il porte sa tenue quand c'est le
  personnage du joueur.
- **Qui l'emporte** : une poussée ne coupe pas la joie d'un but, un but coupe
  tout. Le vrai but tient plus longtemps que celui de la corde (3,6 secondes
  contre 2,6), comme sa case. La colère part au coup qui arrive, pas à celui
  qui dure.
- **Aucun geste sans fin** : la carte en tribune respire déjà, et l'écran
  n'en tolère que trois. Au calme (`data-calme`, `prefers-reduced-motion`),
  plus aucun mouvement ; l'expression change encore, en fondu, et le dépit
  ternit toujours.
- **Une arène de moins de 210 pixels les cache** (un téléphone de 320 × 568,
  un bandeau d'annonce) : ils monteraient sur la corde. Leur taille se prend
  en pour cent de l'arène, et non en unités de conteneur (`verif-pages`).

### Contrôles

`nvn:ui` : 9 contrôles de plus (les deux à leur place et chacun le sien, le
but de corde vécu des deux côtés, la case au-dessus de la corde et des deux
figures, le plein-pied qui garde son dessin, la poussée qui ne coupe pas la
joie, leur poussée tournée vers la corde, la colère au silence d'en face, le
calme sans mouvement mais terni), tous verts ; un banc les a regardés sur
LA REPRISE, TR1 et sur huit tailles d'écran. Les 66 suites (`npm test`)
n'ont aucune rouge nouvelle : celles qui restent rougissent à l'identique sur
`main` dans un conteneur cloud (`refonte/README.md` § 6).

### Ce qui reste

- **La tenue de celui d'en face** : il faudrait que la vue du duel la dise.
- **Les autres joueurs d'une tribune**, en 2 contre 2 et 3 contre 3 : un seul
  Fanzzy par camp se tient dans l'arène.
- **Le clignement**, ici aussi, quand les images « yeux fermés » existeront.

---

## 4 quinquagies. Le stade du match, au duel — celui de son Virage, montré dès la préparation

*6 octobre 2026. Gaël a tranché sur la carte « Au duel, jouer dans le stade du
match, comme au Virage ? » : « Celui du match » — tous les duels d'un match se
jouent dans son stade, et la préparation le montre avant d'entrer en file.
Photographié pour lui à la taille d'un téléphone (390 × 844), Sion – Bâle en
direct au Chaudron, règles du « i » ouvertes : `duel/stade-preparation.jpg`,
dans les fichiers du projet.*

### Ce qui a changé

- **Tous les duels d'un match se jouent dans son stade**, celui de son Grand
  Virage. Le duel tirait son lieu sur son propre identifiant, un
  `randomUUID` neuf à chaque partie : deux duels d'un même match tombaient
  dans deux stades, presque jamais dans celui du Virage d'à côté, contre
  « le stade appartient au match » (`stades.js`, `ETAT.md` § 3). Le risque
  était ouvert depuis le lot 6 (4 quadragies sexies, « Ce qui reste ») ; la
  correction est celle qu'il décrivait : la graine du match dans
  `engine.js`, l'identifiant du duel en repli.
- **Une seule fonction tire le stade d'un match** : `stadeDuMatch`, en bas
  de `src/server/contenus/index.js`. La graine du Virage (l'identifiant du
  match), aucune possession, les stades ouverts relus à chaque appel. La
  salle du Virage, le moteur du duel et le deck l'appellent. Le duel ne
  retombe sur son identifiant que sans match, ce qui n'arrive pas
  aujourd'hui : seul `ouvrir` (`nvn/index.js`) crée un duel, et toujours sur
  le support d'un match.
- **La liste des matchs du duel sert le stade de chacun**, et la route d'un
  match aussi : `stade`, `{ id, nom, effet }` (`CONTRATS.md`, § 17).
- **La préparation le montre.** Sur l'affiche du match choisi, le dessin
  réduit du stade passe en fond, sous le voile de la brique `tbf-affiche`,
  comme sur l'affiche du coup d'envoi ; son nom se lit au pied, « STADE » en
  petit devant, sur la ligne du compte de la file quand quelqu'un attend.
  Les règles du « i » disent ce qu'il change : « Le stade : Le Chaudron.
  Tout le monde pousse plus fort, et se fatigue plus vite. Tous les duels de
  ce match s'y jouent, et son Grand Virage aussi. »

### Pourquoi comme ça

- **Une fonction, pas deux tirages qui s'accordent.** Le Virage et le duel
  tiraient chacun le leur ; deux copies d'un même tirage finissent par se
  séparer — un filtre de saison ajouté d'un côté, une graine convertie de
  l'autre —, et l'écart ne se voit qu'en jouant les deux le même soir. Les
  suites éprouvent la vraie salle du Virage et le vrai moteur, jamais une
  copie de la règle.
- **Le serveur tire, la page lit.** Les stades qu'une saison a ouverts ne se
  connaissent qu'en base : une page qui tirerait le sien sur l'identifiant
  du match tomberait juste tant qu'aucune saison ne ferme de stade, puis
  annoncerait un lieu où personne ne joue. Sans `stade` dans la liste (un
  serveur d'avant), l'affiche reste sans lieu et les règles n'en parlent pas.
- **Pas d'intersection des possessions.** `ETAT.md` § 3 la promettait au
  duel ; elle n'a jamais été écrite, et elle n'est plus à écrire : un lieu
  qui dépendrait de l'adversaire ne se connaîtrait qu'après l'appariement,
  et la préparation ne pourrait pas l'annoncer. Collectionner n'achète pas
  le lieu : il change avec les matchs.
- **Le nom au pied, l'effet derrière le « i ».** « STADE » devant le nom,
  parce que « LE CHAUDRON » seul, sous deux clubs, se lirait comme un
  troisième. La phrase de l'effet, jusqu'à quatre-vingt-cinq signes, aurait
  pris deux lignes juste au-dessus d'ENTRER EN FILE ; elle va dans les
  règles, comme en partie dans « ce que tu portes ». Le nom coûte une ligne
  quand personne n'attend, aucune quand il tient à côté du compte de la
  file, et il ne s'abrège jamais. À 360 × 640, ENTRER EN FILE reste à
  l'écran sans rien faire défiler, et sa rangée ne cache rien de lisible.
- **Le dessin réduit en fond**, comme le brief du lot 6 dessinait l'affiche
  de la préparation (« le stade-mini en fond », attendu depuis faute d'un
  stade connu avant l'appariement) et comme l'affiche du coup d'envoi le
  prenait déjà : aucune image neuve, et la préparation montre en petit le
  stade que la partie montrera en grand.

### Contrôles

`nvn:smoke` : deux contrôles de plus. Pour douze matchs, deux duels aux
identifiants tirés comme en production, un classé et un d'entraînement, se
jouent dans le stade de la salle du Virage du même match (douze matchs, douze
lieux), et la vue des deux camps l'annonce. Les rejeux de la note, qui
passaient par les dix-huit stades grâce aux identifiants de leurs duels,
prennent chacun un match (7001 à 7024), `marin` compris. `deck:smoke` : un de
plus — chaque match de la liste, et sa route, servent le stade d'un vrai duel
ouvert sur lui. `nvn:ui` : quatre de plus — l'affiche montre le stade du match
choisi (le dessin en fond, le nom au pied), les règles du « i » disent son
effet, un autre match montre le sien, et le duel se joue là où l'affiche
l'annonçait. `contenus:smoke` tire ses deux cents lieux par `stadeDuMatch`.

**Chaque contrôle ajouté a été vu rouge sur l'ancien code** : le moteur d'avant
fait rougir les deux de `nvn:smoke`, celui de `deck:smoke` et le dernier de
`nvn:ui` ; le deck d'avant, celui de `deck:smoke` ; la page d'avant, les quatre
de `nvn:ui`.

Les suites touchées, et elles seules — une autre session lançait `npm test`
dans la copie principale : `nvn:smoke` (113), `deck:smoke` (91),
`contenus:smoke` (34), `niveau:smoke` (99), `virage:smoke` (357), `salles:test`
(142), `nvn:net` (167), `catalogue:test` (35), `pages` (84) et `cablage` (71),
toutes vertes ; `nvn:ui`, 206 vertes et une rouge, « et elle dit le Fanzzy, le
camp et la sorte de partie », rouge à l'identique sur `main` dans un conteneur
cloud (`refonte/README.md` § 6). `audit:ui --arenes` ne relève rien sur
`/duel-nvn` à 360 × 640, 400 × 800 et 768 × 1024, ni dans les états du duel.

### Ce qui reste

- **Une saison qui s'ouvre en plein match.** Les stades ouverts sont relus à
  chaque tirage, et la salle du Virage garde le sien tout le match : une
  saison lancée pendant un match peut donner aux duels qui suivent, et à la
  liste, un autre lieu que celui du Virage déjà ouvert (`CONTRATS.md`,
  § 17).
- **Le vrai lieu du match.** Le stade se tire sur l'identifiant du match, pas
  sur l'endroit où il se joue. Le jour où il en viendra, c'est `stadeDuMatch`
  qui changera, et le Virage, le duel et la liste suivront ensemble.
- **Le camp choisi en touchant une tribune du stade-mini**, que le brief du
  lot 6 prévoyait (`ECARTS.md`, `duel-tribunes`, 1) : le stade est sur
  l'affiche, mais le camp se choisit toujours par les deux bâches, et rien
  n'en a changé ici.

---

## 4 quinquagies bis. Trois décisions de Gaël — le reste des boosters, les bonus de KOP retirés, des saisons de quatre mois

*6 octobre 2026, session cloud « Lot 7 : images Artlist ».
Gaël a tranché ce jour-là les décisions que le chantier lui rendait
(`ETAT.md`, § 7 bis) : « Oui, les trois ». Trois commits — les boosters, les
KOP, les saisons —, puis celui de cette trace.*

### Ce qui a changé

- **Une catégorie épuisée rend deux écharpes.** Une place ouverte de booster
  dont la catégorie n'a plus rien à donner au joueur — toutes ses tenues, tous
  ses états ou toutes ses cartes d'action — retombait sur une poignée entière,
  11,5 écharpes en moyenne. Elle rend `POIGNEE_DE_REPLI`, 2 écharpes
  (`src/shared/fanzzy/dex.js`), que lisent le tirage, la simulation et l'aide,
  qui le dit maintenant au joueur. La catégorie des écharpes garde sa poignée
  de 6, 14 ou 30, et une pièce d'équipement en double son tarif de doublon.
- **« La quête » et « Mur de bâches » quittent le catalogue des KOP**, et ce
  qu'ils avaient coûté revient au pot : 900 et 500 écharpes par achat, une
  fois, rendues par le serveur à son démarrage (`rendreLesRetires`,
  `src/server/kop/index.js`). Le catalogue sert cinq bonus, `proposer()`
  refuse un identifiant inconnu, et ce qui ne servait qu'à tenir les deux
  hors de vente (`MODS_DU_VIRAGE`, `agit`, `EN_VENTE`) est parti avec eux.
- **La saison 1 s'appelle « La reprise » jusque dans la graine** :
  `sql/saisons.sql` la créait sous « Le premier virage », si bien qu'une
  installation neuve démarrait sous un nom que personne n'emploie. Une base
  existante n'est pas touchée.
- **Des saisons de quatre mois**, calées sur l'année : du 1er janvier au
  30 avril, du 1er mai au 31 août, du 1er septembre au 31 décembre. La
  saison 1 finit le jeudi 31 décembre 2026, date que Gaël saisit dans
  `/admin` ; la saison 2 court du 1er janvier au 30 avril 2027. Cela remplace
  la fin au 20 décembre et la saison 2 « La trêve », du 21 décembre au
  28 février, que les documents proposaient. Aucun code ne porte de date de
  saison.
- **Les divisions ne changent pas** : elles ne paient que de l'honneur.

### Pourquoi comme ça

- **Le repli payait d'avoir tout.** Chez un joueur qui possède tout, plus de
  la moitié des places ouvertes tombaient dans ce repli, et un booster
  rendait 45,8 écharpes pour un prix de 45 : les vétérans seraient arrivés à
  la saison 2 avec de quoi la payer entière dans la minute. Relancée,
  `serveur/sim-eco.mjs` donne 28,8 écharpes par booster établi, et environ
  1 700 par jour à un assidu au lieu de 2 400 ; le ricochet de l'abonnement
  (`JURIDIQUE.md`, Q5) tombe d'environ 2 700 à 1 700. Le second levier — la
  légendaire en double à 20 au lieu de 45 — n'est pas pris.
- **Le nouveau venu y perd aussi**, et c'est écrit plutôt que découvert : ses
  vingt premiers boosters rendent 12,3 écharpes au lieu de 18,2, parce que
  les sept cartes d'action de LA REPRISE sont vite toutes gagnées et que la
  catégorie se replie dès lors. Un occasionnel fait grandir pour 760
  écharpes la première semaine au lieu de 1 020, et ses trente lignées
  atteignent toujours le troisième âge vers le 28ᵉ jour.
- **Deux écharpes, pas une place blanche.** Une carte vide dans un booster
  serait pire qu'une carte banale : les écharpes, le seul lot qui ne peut pas
  être vide, restent le recours, à un tarif qui ne rapporte plus. Le nombre
  vit dans `dex.js`, à côté des doublons, parce que l'aide le cite : il s'y
  lit, il ne s'y recopie pas.
- **Le remboursement passe par le démarrage, pas par un script.** Une
  livraison par le Manager tire `main` et redémarre, sans passer aucun script
  de données : le démarrage est le seul chemin sûr d'arriver en production.
  `server.js` attend la fonction une fois le KOP construit et avant
  d'écouter, pour qu'aucun membre ne lise un pot à moitié crédité.
- **La marque s'écrit avec le crédit, sans schéma neuf.** Dans une
  transaction par KOP, chaque achat retiré devient `rendu:echarpes` ou
  `rendu:contres` dans `kop_bonus` — `restant` à zéro, épuisé — et le pot
  reçoit la somme. Interrompue, la transaction ne laisse ni un pot crédité
  sans marque, que le démarrage suivant créditerait encore, ni une marque
  sans crédit, qu'il ne créditerait jamais. Le pot se prend sous verrou
  d'abord, dans l'ordre du dépouillement : quatre démarrages simultanés
  rendent une fois.
- **Tout est rendu**, même les achats que des matchs avaient décomptés avant
  le 3 octobre : ces matchs n'ont rien reçu. `verse_total` ne bouge pas, ce
  n'est pas un versement, et aucune ligne n'est effacée.
- **La fonction ne lève jamais** : une exception au démarrage coupe `/api`.
  Un KOP en échec est annulé entier, nommé au journal, et repris au
  démarrage suivant.
- **La garde du dépouillement reste** : un vote ouvert avant le déploiement
  sur un bonus retiré est rejeté à son échéance sans débiter le pot.
- **Aucune série inventée pour la saison 2.** LES HÉROS DU CANAPÉ n'était
  qu'une proposition ; le choix revient à Gaël.
- **Le carnet ne se recale pas.** Avec la fin au 31 décembre, la saison 1
  compte 90 jours de missions au lieu des 63 de son calibrage, et ses paliers
  arrivent plus tôt ; mais il est figé depuis son premier palier versé, et
  ne rapporte en tout que 10 boosters et 1 500 écharpes.

### Contrôles

`fanzzy:smoke` 216, dont deux neufs : un joueur qui a tout d'une série ouvre
quarante boosters, ses replis valent deux écharpes, ses poignées davantage,
et les replis l'emportent. `kop:smoke` 126 : « ce qui est en vente »
réécrit pour un catalogue sans les deux, et une section neuve, « les
retirés, rendus au pot » — un remboursement, un second démarrage qui ne rend
rien, quatre démarrages simultanés, une panne entre la marque et le crédit,
une base sans la table. `cablage` 73, dont deux neufs :
l'appel attendu, après la construction du KOP et avant l'écoute. Verts aussi :
`aide:smoke` 47, `aide:ui` 38, `niveau:smoke` 99, `quotidien:smoke` 216,
`boosters:ui` 74, `kop:ui` 23, `schema:smoke` 47, `admin:smoke` 194,
`economie` et `securite`. Chaque contrôle neuf a été cassé exprès et a rougi.
Un serveur démarré deux fois sur la base de test a rendu 1 400 écharpes au
premier démarrage, puis dit « rien à rendre ». `npm test` n'a pas tourné dans
cette session : une autre le faisait dans la copie principale.

### Ce qui reste

- **La série et le nom de la saison 2**, à choisir par Gaël avant le
  1er janvier 2027. « Les sachets de la trêve », les boosters du passage de
  relais (l'aide du réglage, `src/shared/reglages.js`), et les exemples de
  `serveur/CONTRATS.md` qui nomment « La trêve » suivront ce nom.
- **`parryBonus` et `parryResist`** restent portés par des Fanzzy, des pièces
  et la carte « Filet de chantier », sans que rien les lise
  (`serveur/ECARTS.md`, social § 6, point 3).
- **La table des taux de `CGV.md`** décrit encore cinq places de supporter
  (« 1 à 3 : commune 100 % ») ; le code tire un supporter sûr, un second sept
  fois sur dix, et trois places ouvertes. C'est le retard que
  `serveur/ECONOMIE.md` (§ 12, point 5) relève dans `JURIDIQUE.md`, plus
  ancien que cette session, dans un texte que Gaël signe : relevé, pas
  touché. Le repli à deux écharpes n'y figure pas.
- **`boosters:ui` ne vide pas `saisons`.** Une saison laissée en base par la
  suite d'avant (`quotidien:smoke`) a fait rougir « le kiosque annonce le bon
  nombre de Fanzzy par set » sans que rien ne soit cassé ; la table vidée, la
  suite est verte. La suite n'est pas corrigée.

---
