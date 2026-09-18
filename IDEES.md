# Ce qui reste à faire

Écrit après un contrôle général de l'application — septembre 2026, session
« le défilé des âges ». Ce fichier n'est pas une liste de souhaits : chaque
entrée dit **ce qui ne va pas aujourd'hui**, pourquoi ça compte, et ce que ça
demande. Les entrées sont rangées par valeur décroissante, pas par difficulté.

Une entrée barrée a été tranchée et appliquée ; on la garde parce que la
décision compte autant que le code, et qu'elle se relit le jour où quelqu'un se
demande pourquoi c'est écrit comme ça.

`ETAT.md` dit où en est le projet. `A-DEPLOYER.md` dit ce qui attend d'être
déposé. Celui-ci dit ce qui n'est pas encore écrit.

---

## 1. ~~Une seule monnaie, deux définitions selon l'écran~~ — tranché

**La ferveur est la ferveur, d'où qu'elle vienne.** Décision prise, et
appliquée.

Le duel rapportait de la ferveur — bien calculée, bien écrite dans
`duel_results.ferveur` — et elle comptait dans les classements **par
compétition**, dont la requête additionne explicitement les deux sources. Mais
SUPPORTERS, TRIBUNES et « ma place » ne lisaient que `virage_presence`. Un
joueur qui ne faisait que des duels avait de la ferveur, la voyait dans son
parcours et au classement de la Ligue 1, et restait à zéro au classement des
supporters. Le même mot mesurait deux choses selon l'onglet, et rien à l'écran
ne pouvait l'expliquer.

Les trois lectures passent maintenant par une seule source, `FERVEUR`, qui
réunit le virage et le duel classé. **L'entraînement reste dehors** : c'est
toute sa différence avec le duel classé, et le tri se fait à la lecture, jamais
à l'écriture — un joueur doit retrouver ses soirées d'entraînement dans son
parcours, elles ne doivent simplement rapporter à personne.

« Ma place » comptait le plus : elle lisait le virage seul sous une liste qui
en lit deux, donc elle annonçait un rang calculé sur d'autres nombres que le
classement qu'elle surmonte.

Les textes de la page suivent : le classement des supporters ne promet plus le
Grand Virage seul, et l'invitation faite à qui n'est pas encore classé nomme
les deux portes.

L'autre réponse possible était de séparer partout — le virage d'un côté, le
duel de l'autre, et le classement par compétition cessant d'additionner. Elle
se défendait ; celle-ci récompense de jouer, quelle que soit la façon, et ne
demande à personne de choisir entre pousser et se battre.

## 2. ~~Le duel ne compte que pendant le match~~ — tranché

**Classé, c'est le jour du match.** Décision prise, et appliquée. Plus un
tableau des entraînements.

La règle a fait un aller-retour, et les deux versions avaient raison chacune de
son côté. Elle disait « le match est aujourd'hui » ; on l'a resserrée à « le
match est en cours » pour une raison d'ambiance — un duel joué à dix heures du
matin comptait pour une rencontre du soir, et on poussait pour une tribune qui
n'existait pas encore.

Ce que cette raison ne pesait pas, c'est **combien de temps la porte restait
ouverte**. Un match dure deux heures ; hors de ces deux heures il n'existait
aucun duel classé du tout, et l'onglet DUELS demande trois parties classées
avant de montrer quelqu'un. Un joueur pouvait enchaîner quinze duels contre de
vrais adversaires un mardi après-midi et ne se voir nulle part. Une règle juste
que personne ne peut satisfaire ne protège rien : elle ferme le jeu.

La journée rouvre la porte sans rien céder sur l'essentiel — on joue le jour de
la rencontre, pas un autre jour — et l'entraînement garde sa raison d'être, qui
est de jouer sur un match qui n'a pas lieu aujourd'hui. **Après le coup de
sifflet final aussi** : un match terminé à vingt heures reste le support d'un
duel jusqu'à la fin de sa journée, parce que c'est le soir qu'on en parle. La
liste des matchs garde donc ceux du jour qui sont finis, et les range après ce
qui se joue encore.

Le tableau des entraînements existe, sur son propre onglet. **Il classe sur les
parties jouées, pas sur les victoires**, et ce n'est pas un détail de
présentation : on s'entraîne aussi contre des machines, et classer sur les
victoires ferait un tableau de qui bat le plus de bots — ce qui se gagne en y
passant la nuit et ne dit rien de personne. Les parties coûtent le même prix à
tout le monde. Il ne déborde nulle part : l'entraînement ne rapporte toujours
aucune ferveur et n'entre dans aucun autre classement.

**Un décalage reste, et il se voit.** « La journée du match » se mesure en UTC —
`kickoff_at` est écrit par un pilote réglé sur `timezone: 'Z'` et comparé à
`UTC_DATE()`, ce qui est cohérent d'un bout à l'autre. Pour un joueur à l'heure
suisse d'été, la journée court donc de 2 h du matin à 1 h 59 le lendemain, pas
de minuit à minuit. C'est toujours **en faveur** de qui joue tard, et jamais
contre qui joue dans la journée. La corriger demande de décider d'un fuseau
d'affichage pour le jeu entier — et il faudrait `CONVERT_TZ`, donc les tables de
fuseaux chargées dans MariaDB, ce qui n'est pas acquis en production. À faire le
jour où le jeu sort d'Europe.

## 3. ~~L'historique des duels~~ — fait

La ligne montrait une issue, un score et de la ferveur. Elle dit maintenant tout
le reste.

**L'adversaire d'abord.** `duel_results.opponent_id` était écrit depuis le
premier jour et relu nulle part ; la ligne donnait le match de football — « Sion
– Bâle » — et pas l'adversaire, qui est pourtant le sujet d'un duel.

**Puis les deux camps en entier**, ce qui a demandé une colonne. `opponent_id`
ne nomme **qu'un** adversaire, pris au hasard parmi ceux d'en face : sur un 3v3
il en tait cinq. Les lignes d'une même partie partagent `duel_id` — mais rien ne
disait de quel côté chacun était. On pourrait croire que `goals_for` suffit à
séparer les deux camps ; il le fait, sauf sur un match nul, où les deux côtés
portent exactement les mêmes nombres. C'est précisément la partie la plus
serrée, donc celle dont on veut se souvenir. D'où `side`, et une déduction de
moins.

**Les machines sont comptées, pas passées sous silence.** Un bot n'a pas de
ligne dans `duel_results`, et c'est juste — une machine n'a pas d'historique.
Le camp se retrouve donc incomplet : le format dit combien on attendait de
chaque côté, la différence est le nombre de machines, et la ligne écrit « contre
Rachid et 1 bot » plutôt que « contre Rachid », qui serait faux sur un 2v2.

**Trois autres colonnes** : `fanzzy_id` — le titulaire aligné au coup d'envoi,
avec son nom, parce que `TR32` ne dit rien à personne et que « Choriste » se
reconnaît ; `xp`, relue sur ce que les gains ont versé plutôt que recalculée au
moment d'écrire ; `duree_s`, parce qu'un duel de cinq minutes et un abandon à la
trentième seconde se lisaient pareil.

Enfin la **tribune tenue, même en neutre** : `pour` valait nul pour un neutre,
donc on ne savait pas de quel côté il s'était rangé — la seule chose qui situe
un duel. Le camp le dit.

Les parties d'avant ces colonnes n'inventent rien : `duree_s` est nulle et
l'écran se tait, `xp` vaut zéro et ne s'affiche pas. Zéro et « on ne sait pas »
se disent pareil ici, et c'est bien : dans les deux cas il n'y a rien à
annoncer.

**Une leçon de banc d'essai au passage.** J'ai voulu monter le module de niveau
dans `nvn:net` pour que l'XP versée soit réelle. Elle l'est devenue — et deux
contrôles d'écharpes ont rougi, parce que franchir un palier verse lui aussi des
écharpes et que ce banc mesure ce qu'un duel paie **en lisant la bourse**.
Monter un module de plus lui faisait mesurer deux choses à la fois. Le banc est
resté sans niveau, et c'est écrit en toutes lettres à l'endroit où l'on serait
tenté de recommencer.

## 4. Les dessins — le vrai plafond du jeu, et les saisons

**30 lignées entièrement dessinées sur 256 côté cartes. 2 sur 256 côté états.**

`npm run dessins` donne le détail ; les deux chiffres ne mesurent pas la même
chose, et les confondre ne veut rien dire. Un personnage dont la **carte**
existe est collectionnable ; un personnage dont les **états** existent est
vivant — il réagit au match.

C'est, et de loin, ce qui limite le plus ce qu'un joueur voit. Toute la
mécanique des âges, du classeur, du défilé sur l'accueil fonctionne — sur un
catalogue dont la grande majorité n'a qu'une illustration de carte, sans états.

Ce n'est pas un travail de code. Les deux outils qui manquaient existent
maintenant.

**`npm run dessins`** — le tableau de bord. Il sépare les deux systèmes
d'images, parce que les confondre donnerait un chiffre qui ne veut rien dire :
un personnage dont la **carte** existe est collectionnable, un personnage dont
les **états** existent est vivant — il réagit au match.

```
  série  lignées   cartes              états               complètes  vivantes
  TR        60   █████·······  45%   ············   3%       16         2
  …
           256   ███·········  29%   ············   1%       30         2

  cartes    185/638   états  50/7656   vivantes  2/256
```

`--presque` range les lignées par ce qu'il reste à faire : une lignée à laquelle
il manque un dessin est un personnage entier à un dessin près, et c'est le
meilleur achat de la journée. `npm run dessins TR32` donne la liste exacte des
fichiers manquants, aux noms que la chaîne attend.

**Le contrôle sur un échantillon représentatif** est dans `accueil:ui`, et il a
trouvé quelque chose tout de suite. Les suites éprouvaient TR1, TR2 et TR32 —
les trois seuls personnages complets, donc exactement les cas où aucun repli ne
se déclenche. Le catalogue, lui, est fait d'autre chose : **136 lignées sur 256**
ont la carte de leur premier âge et rien au-dessus.

Pour celles-là, l'accueil annonçait « ÉVOLUTION 2 / 3 » au-dessus du dessin de
l'âge 1 — `FZART.adresse` redescend à l'âge illustré le plus proche, ce qui est
le bon repli, mais la plaque promettait autre chose. Le joueur voyait le même
personnage sous deux numéros et en concluait, à raison, que son choix n'avait
pas été pris. La plaque dit maintenant « dessin à venir », et la mention
s'efface dès qu'on redescend à un âge qui existe.

Le contrôle choisit sa lignée **depuis le disque** et non en dur : le jour où
quelqu'un dessine ces âges, il se déplace tout seul sur une autre plutôt que de
rougir. Et si un jour il n'en trouve plus aucune, il le dit et demande qu'on le
retire — ce sera une bonne nouvelle.

### Les contenus sont descendus en base — fait

Trois des quatre sortes de contenu qu'une saison veut livrer étaient
**décoratives**. Les 29 cartes d'action, les 17 pièces d'équipement et les 10
stades vivaient dans `src/shared/` : `saisons.stuff` et `saisons.actions`
existaient et ne servaient qu'à écrire une phrase, et il n'y avait même pas de
colonne pour les stades. On pouvait annoncer « la saison 5 apporte quatre cartes
d'action » alors qu'elles étaient jouables depuis la livraison d'avant.

`sql/contenus.sql` pose **une** table pour les trois familles — elles n'ont pas
la même forme, mais elles ont le même cycle de vie : elles naissent dans le
code, elles sont semées en base, et une saison décide si elles sont jouables. Ce
qui diffère vit dans `donnees`, ce qui se partage est en colonnes.

Le patron est celui du catalogue des Fanzzy, repris tel quel : **le code reste
la forme, la base porte l'état**. Le semis n'écrase jamais une ligne existante —
un nom corrigé depuis l'administration survit à la livraison suivante — et le
démarrage dit à voix haute ce qui a dérivé.

Deux décisions méritent d'être relues :

- **`publie` vaut 1 par défaut.** Tout ce qui est déjà dans le jeu y reste.
  Fermer le catalogue en attendant qu'une saison le rouvre aurait retiré du jour
  au lendemain des cartes que les joueurs jouent. Les contenus **neufs**
  naîtront fermés, en écrivant `publie: false` sur leur fiche.
- **Sans la table, tout est ouvert.** Une installation où `sql/contenus.sql`
  n'est pas appliqué joue exactement comme avant. Le contraire fermerait le jeu
  en silence sur une base incomplète — et c'est le premier contrôle de la suite.

### La saison transversale — le mécanisme est prêt, le contenu non

`src/shared/fanzzy/dex-saison.js` porte la déclaration de la série `S1` et le
gabarit d'une lignée. **Il n'est pas encore branché sur `dex.js`**, et c'est
délibéré : une série déclarée sans carte ferait un onglet vide au classeur, et
une saison qui l'ouvrirait serait refusée au lancement — `validerContenu` exige
au moins une carte de premier âge par série, et il a raison.

Ce qui manque est la matière : douze lignées × trois âges = trente-six entrées
de catalogue, avec leur nom, leur type, leur rareté, leur histoire et leur cri
par âge. C'est le cœur créatif du jeu, et il ne s'invente pas depuis un fichier
de code.

Côté images, chaque lignée demande 108 fichiers pour être **vivante** (3 âges ×
12 états × 3 tenues) plus 3 cartes en pied — soit 1 332 pour les douze. Les
trois tenues voulues (`base`, `prehistorique`, `apocalyptique`) existent déjà au
catalogue : rien à déclarer de ce côté.

## 5. ~~L'abonnement, et la fin des billets~~ — fait

**L'argent réel n'achète plus que l'abonnement. Les écharpes ne se gagnent
qu'en jouant.**

Quatre chantiers, dont un qui n'était pas prévu au départ.

**L'écran joueur** — `/abonnement`. Il dit **d'abord ce qui reste libre**, avant
le prix et avant ce qui s'ouvre : quelqu'un qui arrive là se demande ce qu'on
lui retire s'il ne paie pas, et tant qu'il n'a pas la réponse il ne lit pas le
reste. La page ne porte aucune copie du barème — la route rend `ouvre` **et**
`sans`, pour qu'elle puisse écrire « 24 au lieu de 12 ». Elle l'avait recopié, et
elle annonçait « au lieu de 10 » quand le réglage en disait douze.

**Le bouton d'administration** — une colonne qui dit l'échéance et pas seulement
l'état, et trois gestes : offrir sans terme, offrir un mois, retirer. Les cinq
avantages se règlent depuis l'onglet RÉGLAGES, et la section y porte sa règle en
toutes lettres — « jamais de la puissance » — parce que c'est la phrase que
quelqu'un lira avant de changer un nombre.

**Stripe en `mode: 'subscription'`**, avec ce qu'on oublie : le
**renouvellement**. Sans `invoice.paid`, un abonné perdrait l'accès au bout d'un
mois pendant que Stripe continue de le débiter. La fin de période vient de
Stripe, pas de notre calendrier. À la résiliation, l'abonnement court jusqu'au
terme déjà payé.

**Les billets ont disparu**, et c'est le changement le plus profond. Ils étaient
une seconde monnaie, la seule que l'argent réel achetait, et ils n'achetaient
que des objets **nommés** : la chaîne euro → tirage était coupée par une
séparation qu'il fallait tenir — deux compteurs, deux règles, et la vigilance de
ne jamais les mélanger.

Elle est maintenant coupée **à la racine** : il n'y a plus de monnaie achetable
du tout, donc plus rien à séparer. L'étal se paie en écharpes, comme les
boosters. Ce n'est pas un adoucissement de la règle, c'est sa version la plus
simple — et strictement plus sûre que ce qu'on avait.

Les garde-fous de la suite ont été réécrits **plus sévères** : ils nomment
désormais l'interdit (`billets`, `echarpes`, `packs`, `boosters`, `fanzzy`) au
lieu d'énumérer le permis, et vérifient que l'abonnement ne livre rien d'autre
que lui-même — pas d'écharpes de bienvenue, pas de booster offert. C'est le
chemin le plus naturel pour rouvrir la porte, et le plus facile à défendre en
réunion.

**Un défaut trouvé en chemin, et il aurait coûté cher** : `accorder` écrivait par
le pool, donc **hors** de la transaction d'encaissement. Un abonnement posé
aurait survécu au `rollback` de l'achat qui l'a payé — et six encaissements
simultanés se bloquaient jusqu'au `Lock wait timeout`. C'est la course qui l'a
révélé, pas la relecture.

**Ce qui reste à surveiller** : l'abonnement accélère les boosters — 24 en
réserve au lieu de 12, un toutes les 6 minutes au lieu de 10. C'est de l'argent
qui achète **plus de tirages**, pas un coffre, mais du rythme vers du hasard. La
nuance est réelle et elle est fine. À faire relire par quelqu'un dont c'est le
métier avant l'ouverture, en même temps que la question des écharpes.

**Et `user_wallet.billets` reste en base, figée.** On ne l'efface pas : elle
porte ce que des gens ont payé en euros, et effacer la trace d'un paiement est
la seule chose qu'on ne puisse pas reprendre. On ne la convertit pas en écharpes
non plus — ce serait rouvrir la chaîne pour ceux qui en ont. Un solde restant se
rembourse, par Stripe, à la personne.

## 6. ~~Ce qu'il faudrait mesurer avant d'ouvrir à des gens~~ — mesuré

### Le Grand Virage tient, et de loin

Le banc existait et **ne tournait pas**. Il levait à la première entrée dans le
virage — « Le catalogue Fanzzy n'a pas été chargé » — ce qui explique
probablement pourquoi il n'avait jamais servi : on le lance une fois, on voit
une trace de pile, et on remet à plus tard. Un banc de charge qu'on ne peut pas
lancer ne mesure rien, et son absence de mesure ne se voit nulle part.

Réparé, `npm run charge <N>` donne :

| supporters | chant → corde vue (p99) | chants/s | mémoire |
|---|---|---|---|
| 50 | 113 ms | 7,7 | — |
| 200 | 102 ms | 30,8 | — |
| 500 | 104 ms | 76,7 | +108 Mo |
| 1 000 | 98 ms | 154,8 | +68 Mo |
| **2 000** | **87 ms** | **308** | +2 Mo |

**La latence ne monte pas avec la charge — elle baisse.** Ce n'est pas un
miracle : elle est bornée par la cadence de diffusion, pas par le calcul. Le
moteur n'est pas le facteur limitant, et il ne le sera pas avant très longtemps.

Ce que ça **ne** mesure **pas** : le réseau, l'hébergement Infomaniak, et la
base sous charge réelle. Le banc sait viser une URL —
`npm run charge 200 https://thebestfan.online` — et c'est la mesure qui manque
encore. Elle ne peut se faire que sur la machine de production.

### Le quota API-Football : 10 virages simultanés

`npm run quota` projette la journée au lieu de constater après coup.
`api_quota` comptait ce qui était **déjà parti**, ce qui répond après coup à une
question qu'on se pose avant.

Un samedi de championnat — 10 matchs, 8 heures, 6 virages occupés — coûte
**4 472 appels, soit 66 % du budget**. Un soir de Ligue des champions avec un
virage sur chaque match : 2 432, soit 36 %.

Le chiffre qui décide :

```
  coût fixe         1592   direct, classements, calendriers
  par virage         480   un relevé par minute, toute la journée
  tiennent            10   virages occupés en même temps, dans le budget
```

**Trois postes sur quatre ne grossissent pas avec les joueurs.** Le direct
demande les matchs par paquets de vingt : vingt matchs coûtent un appel, pas
vingt. Les classements et les calendriers sont fixes. Seuls **les relevés
d'événements** grossissent, et c'est donc le nombre de virages simultanés qui
décide de tout.

Pour aller au-delà de dix : espacer `EVENTS_MIN_MS`. À deux minutes au lieu
d'une, le nombre double — au prix d'un but annoncé jusqu'à deux minutes après
qu'il est marqué, ce qui se voit.

### Le juridique : le dossier est prêt, la question reste ouverte

`JURIDIQUE.md` décrit exactement ce qui est vendu, ce qui est aléatoire, et où
passe la frontière. Il est écrit pour qu'une consultation coûte une heure au
lieu de trois — le juriste n'aura pas à lire le code.

**La question des écharpes est réglée** depuis la suppression des billets :
elles ne s'achètent pas, ne s'échangent pas, ne se revendent pas, et aucun euro
ne mène à un tirage.

**Celle qui reste est plus fine, et je ne sais pas la trancher seul** :
l'abonnement double la réserve de boosters et accélère leur recharge. On
n'achète pas un tirage, on achète une **cadence** d'une ressource par ailleurs
gratuite — les taux sont identiques, rien n'est réservé, et un non-abonné qui
joue deux fois plus longtemps ouvre autant de boosters. Mais il existe un
chemin, indirect et borné, entre un paiement et un plus grand nombre de
tirages ; et ce projet a écrit ailleurs qu'il valait mieux « couper la chaîne à
la racine plutôt que la border de garde-fous ».

C'est exactement le genre de nuance qu'on juge mal soi-même. Les trois questions
à poser sont dans le fichier, avec les taux et les chiffres.

**Et il manque des documents qui ne sont pas des questions** : CGV, politique de
confidentialité, mentions légales, sort des données à la suppression d'un
compte, et vérification que la licence API-Football autorise l'usage fait ici.

## 7. Le banc d'essai

Ces quatre points n'ont aucun effet sur le joueur, et ils décident de la
vitesse à laquelle tout le reste avance.

- **Les suites partagent une seule base et s'ordonnent entre elles.** Lancer
  deux suites en même temps détruit les deux, et une suite qui oublie de vider
  une table fait rougir une autre, très loin d'elle. C'est arrivé trois fois en
  deux sessions (`saisons` pour `niveau:smoke`, `reglages` pour
  `bienvenue:smoke`, `abonnements` pour trente autres). Une base par suite, ou
  un préfixe de table par suite, supprimerait toute une classe de faux rouges.
- **Aucune commande ne lance tout.** Il y a 47 suites et il faut les connaître.
  Un `npm test` qui les enchaîne et rend un tableau ferait gagner une heure à
  chaque contrôle général.
- **Les fins de ligne.** Les fichiers du dépôt sont en LF, la machine est sous
  Windows, et un script d'édition qui se trompe fait basculer un fichier entier
  en CRLF — ce qui casse en silence les suites qui lisent le source avec une
  expression régulière (`vitrine:smoke` l'a fait cette semaine). Un
  `.gitattributes` avec `* text=auto eol=lf` réglerait la question une fois pour
  toutes.
- **Les contrôles périmés.** `matchs-ui-smoke` attendait encore l'ancienne
  adresse du bouton DUEL et rougissait sur le correctif. Un test qui décrit le
  passé est pire qu'un test absent : il fait croire à une régression.

## 8. Plus petit, mais qui se voit

- **Le profil affiche le Fanzzy du deck, pas celui qu'on montre.** La ligne
  « Mon Fanzzy » du profil lit `loadout`, c'est-à-dire le titulaire au premier
  âge — voulu pour le duel, mais surprenant à côté de l'accueil, qui montre
  désormais l'âge choisi. À rapprocher, ou à expliquer sur place.
- **`duellistes` et `entrainements` n'ont pas de fenêtre de temps.** Ils comptent
  depuis toujours, quand SUPPORTERS propose « saison » ou « mois ». Un joueur
  qui commence ne rattrapera jamais personne — et c'est plus vrai encore d'un
  tableau classé sur le nombre de parties, où l'ancienneté suffit à tenir la
  tête.
- **Deux colonnes mortes dans `duel_results` : `elo_before` et `elo_after`.**
  Jamais écrites, jamais lues, 1000 partout depuis le premier jour. Un schéma
  qui décrit un classement Elo qui n'existe pas se lit comme une fonction
  débranchée, et quelqu'un finira par bâtir dessus. Soit on classe vraiment les
  duellistes sur une cote — ce qui serait un meilleur classement que « qui a
  gagné le plus de fois », parce qu'il tient compte de l'adversaire — soit les
  deux colonnes partent.
- **Aucun écran ne montre l'adversaire avant le coup d'envoi.** La salle
  d'attente affiche les inscrits ; une fois la partie lancée, on ne sait plus
  contre qui on joue. Le parcours le dit désormais *après* — ce qui rend
  l'absence pendant la partie plus visible encore.
- **`duel_results` porte maintenant de quoi faire des statistiques par Fanzzy**
  — « ton Capo a gagné 8 duels sur 11 » — et rien ne les calcule. La colonne est
  là, la fiche du Fanzzy serait l'endroit.

---

## Ce qui a été corrigé pendant ce contrôle

Pour mémoire, et parce que ces défauts disent quelque chose sur où chercher les
suivants.

| | |
|---|---|
| **Classement des tribunes** | La ferveur d'un supporter était versée à **tous les clubs qu'il suit**. La jointure ne regardait que `user_id`, alors que `virage_presence.team_id` existe et que le classement par compétition l'utilise déjà. Prouvé dans les deux sens : sans le correctif, un club encaisse 900 de ferveur poussée ailleurs. |
| **Le refus d'une demande d'ami** | Annonçait « 8 jours » pour une règle qui en dit 7. Une course sous la milliseconde entre l'horloge de MySQL et celle de Node rendait le délai écoulé négatif. C'est la deuxième fois que ce calcul annonce huit ; la première venait du fuseau du pilote. |
| **`fanzzy-art.mjs`** | Ignorait en silence les fichiers d'un lot nommés autrement que le premier dans l'ordre alphabétique. Trois nouveaux dessins déposés en `TR1-…` à côté de trente-trois `001-…` n'ont jamais été lus, sans un mot. Le script refuse maintenant un lot mélangé. |
| **L'âge montré sur l'accueil** | Revenait au premier âge à chaque retour sur la page. Deux causes : le souvenir ne gardait que la lignée, et six illustrations d'âges supérieurs étaient produites mais déclarées nulle part. |
| **La ferveur du duel** | N'était comptée dans aucun des deux classements qu'on voit en premier, ni dans « ma place ». Voir le point 1. |
| **L'historique des duels** | Ne disait pas contre qui on avait joué, ni si la partie avait compté. Voir le point 3. |
| **La hauteur du personnage sur l'accueil** | La rangée d'âges ajoutée cette semaine reprenait une soixantaine de pixels au personnage, qui est le sujet de l'écran. Les flèches et le bouton sont maintenant posés par-dessus la plaque, hors du flux. |
| **L’abonnement hors transaction** | `accorder` écrivait par le pool : un abonnement posé aurait survécu au `rollback` de l’achat qui l’a payé, et six encaissements simultanés se bloquaient jusqu’au `Lock wait timeout`. Révélé par la course, pas par la relecture. |
| **La boucle de `DEPLOIEMENT.md`** | Portait un « 
 » littéral au milieu de la liste des fichiers SQL : le shell y aurait lu `sql/n.sql` et la boucle se serait arrêtée avant `abonnement`. Une continuation de ligne mal écrite dans un mode d’emploi de déploiement se découvre au moment où l’on en a le plus besoin. |
| **`prefixes:smoke`, `vitrine:smoke`, `matchs:ui`** | Trois suites cassées par des travaux antérieurs, dont deux par les miens. |
