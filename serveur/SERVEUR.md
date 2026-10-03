# Le chantier serveur de la refonte : ce qu'on ajoute, et pourquoi

*Pour Gaël. 2 octobre 2026. Écrit à partir des trois études de l'atelier
(`ECONOMIE.md`, `DONNEES.md`, `RISQUES.md`, dans le même dossier) et d'une
relecture du code de la copie principale.*

Tu as délégué le **contenu** : quelles missions, quel bonus, quelle saison,
quels montants. Voici ce que je propose. Chaque montant est **réglable depuis
l'administration** (§ 8), avec une valeur de départ raisonnée sur les barèmes
réels du jeu. Deux autres documents accompagnent celui-ci : `CONTRATS.md`, pour
les écrans, et `PLAN.md`, pour l'atelier qui écrit le code.

---

## En une page

La refonte dessine des choses que le serveur ne sait pas encore dire. Huit
d'entre elles arrivent dans cette vague. Les deux dernières attendent le lot 6
des arènes.

| | Ce que le joueur verra | Quand |
|---|---|---|
| 1 | L'anneau d'XP qui avance après un booster ou un duel | cette vague |
| 2 | « NOUVEAU » sur ce qu'il n'a pas encore regardé, sur tous ses appareils | cette vague |
| 3 | Le Fanzzy et le niveau de chacun dans les classements, le KOP, les amis | cette vague |
| 4 | Sa cote avant et après un duel classé, et sa progression au classement | cette vague |
| 5 | Des crans de collection avec leurs gains, et des divisions de saison pour l'honneur | cette vague |
| 6 | Trois missions par jour, un bonus de présence, la série de jours | cette vague |
| 7 | La date de fin de la saison 1, la suivante annoncée, la récompense | cette vague |
| 8 | Le ticket « depuis ta dernière visite » à l'ouverture | cette vague |
| 9 | Qui est en ligne, au stade, en duel | avec le lot 6 (§ 10) |
| 10 | Le bilan de tribune à la fin d'un match du Virage | avec le lot 6 (§ 10) |

**Le contenu, en dix lignes :**

1. **Trois missions par jour** (une facile, une moyenne, une difficile), les
   mêmes pour tout le monde. Elles paient **30, 60 et 100 écharpes** et
   **20, 40 et 60 XP**. Une relance gratuite par jour.
2. **Le sachet** : les trois faites, **1 booster** de plus.
3. **Les missions paient le jeu, pas l'ouverture** : le Grand Virage, qui ne
   rapporte aujourd'hui ni écharpe ni XP, y trouve enfin une récompense.
4. **Une carte de présence de 7 cases** qui ne recule jamais : 20, 25, 30, 35,
   40, 45 puis 50 écharpes, et 1 booster à la septième. La série de jours
   s'affiche, mais **rien ne se perd** quand elle casse.
5. **La saison 1 « La reprise » finit le dimanche 20 décembre 2026**, dernier
   week-end avant la trêve. Date à confirmer sur `/matchs` avant de l'écrire.
6. **Un carnet de tampons** pour la saison : chaque mission en rapporte. Cinq
   paliers vont de 100 écharpes à 4 boosters, 600 écharpes et un titre.
7. **Un cran de collection tous les 25 objets** : 25 écharpes, et 1 booster
   tous les quatre crans. Une série complète rapporte 1 booster et
   100 écharpes.
8. **Cinq divisions de saison** sur la ferveur classée, de Sympathisant à
   Capo. **Elles ne paient que de l'honneur** : l'insigne, et le titre
   « Capo de la saison 1 ». L'abonné n'a pas de plafond de duels classés ni de
   Virages comptés, donc une division qui paierait des boosters se gagnerait
   en partie en payant. Une division atteinte ne se perd pas.
9. **Abonné et non-abonné reçoivent exactement la même chose.** Aucune
   mission ne demande ce que l'abonnement vend, aucune récompense matérielle
   ne dépend d'une activité que l'abonnement déplafonne, et aucune tenue n'est
   donnée en récompense.
10. **Effet** : environ +15 % d'écharpes et +26 % d'XP pour un joueur assidu,
    +31 % et +50 % pour un joueur occasionnel. Les boosters ne bougent que de
    3 à 4 %.

---

## 1. Le constat qui guide le contenu

Une simulation qui rejoue exactement le tirage du serveur, sur la seule série
ouverte en production (LA REPRISE), dit trois choses.

- **Les écharpes ne sont plus rares.** Un joueur assidu a fait grandir ses
  trente lignées avant la fin de sa première semaine. Ensuite, un booster rend
  en moyenne **45,8 écharpes, pour un prix de 45**. L'assidu encaisse ainsi
  environ 2 400 écharpes par jour, presque toutes tirées de la recharge
  gratuite. Un montant d'écharpes ne motive donc plus qu'un nouveau venu.
- **Le jeu paie l'ouverture, pas le jeu.** Une minute passée à ouvrir des
  boosters rapporte des dizaines de fois plus qu'une minute de duel. Le Grand
  Virage, le cœur du jeu, ne rapporte rien du tout.
- **Ce qui reste rare, c'est l'XP, les tampons de saison et l'honneur.**

D'où la règle de tout le contenu : **les missions récompensent le Virage, le
duel et le geste**. Elles paient en XP, en tampons et en insignes, et les
écharpes restent modestes.

## 2. Le jour de jeu

**Le jour change à minuit selon l'horloge de la base**, la même qui compte déjà
les cinq duels classés et les deux Virages comptés du joueur gratuit. Missions,
bonus et quotas se renouvellent ainsi au même instant : personne n'a à retenir
deux minuits.

Un indice dans le code laisse penser que la base de production n'est peut-être
pas réglée sur l'heure de Zurich. Dans ce cas, le jour changerait à une heure
ou deux heures du matin. Le serveur l'écrira dans son journal au démarrage
(« le jour de jeu change à HH:MM, heure de Zurich »). Si tu veux un minuit
exact à Zurich, il faudra basculer **ensemble** les quotas et les missions.
C'est un réglage technique à décider une fois la sonde lue, pas avant.

---

## 3. Les missions du jour

### Les règles

- **Trois missions par jour** : une facile (environ 5 minutes), une moyenne
  (environ 12), une difficile (environ 25). Un joueur moyen en fait deux, un
  assidu les trois.
- **Les mêmes pour tout le monde**, tirées chaque jour au hasard dans le
  catalogue. Deux joueurs qui se parlent parlent de la même chose. Une mission
  impossible pour toi ce jour-là (ton club ne joue pas, par exemple) est
  remplacée par la suivante du tirage.
- **Une relance gratuite par jour**, sur une mission pas encore terminée.
- **Le serveur compte, le joueur ne déclare rien.** Une mission se lit dans ce
  que le jeu a déjà enregistré : un booster ouvert, un duel joué jusqu'au bout,
  un chant au Virage. Il n'y a rien à cocher. Le joueur appuie sur
  RÉCUPÉRER, et le serveur recompte avant de verser.
- **Tout tient sous les plafonds gratuits.** Aucune mission ne demande plus de
  deux duels classés, ni un Virage compté, ni un format réservé à l'abonné.
- **Rien ne se perd, ou presque** : une mission terminée et pas encore
  récupérée reste récupérable jusqu'à la fin du lendemain.
- **Un duel compte s'il a duré au moins une minute et que tu ne l'as pas
  quitté.** Quitter un duel ne fait pas la mission. Et une victoire offerte par
  un second compte qui abandonne tout de suite ne la fait pas non plus.
- **Les chants d'un match comptent pour le jour de son coup d'envoi.** Un
  match commencé à 23 h 30 et fini après minuit compte pour la veille, et la
  mission de la veille reste acquise.

### Le catalogue : treize missions

| Difficulté | Mission | Proposée quand |
|---|---|---|
| facile | **Ouvre 3 boosters** | toujours |
| facile | **Joue un duel jusqu'au bout** (entraînement compris) | toujours |
| facile | **Chante 10 fois au Grand Virage** | un match se joue encore aujourd'hui |
| facile | **Fais grandir un Fanzzy** | tu as un Fanzzy qui peut grandir et de quoi le payer |
| moyenne | **Chante 40 fois au Grand Virage** | un match se joue encore aujourd'hui |
| moyenne | **Gagne un duel** (entraînement compris) | toujours |
| moyenne | **Joue 2 duels classés** | il te reste au moins deux classés gratuits aujourd'hui |
| moyenne | **Chante 20 fois pour ton club** | un de tes clubs joue aujourd'hui |
| moyenne | **Joue un duel pour ton club** | tu suis au moins un club |
| difficile | **Gagne 3 duels** | toujours |
| difficile | **Joue 5 duels** | toujours |
| difficile | **Chante 10 fois dans chaque mi-temps d'un même match** | un match n'a pas encore passé la mi-temps |
| difficile | **Chante 10 fois dans deux compétitions différentes** | deux compétitions jouent encore aujourd'hui |

Chacune a sa bascule dans l'administration : en éteindre une la sort du tirage
dès le lendemain.

**Écartées exprès :**

- *Répète un geste* : la répétition ne rapporte rien, c'est sa règle.
- *Suis un club, rejoins un KOP, ajoute un ami* : cela se fait, se défait et se
  refait pour toucher la récompense chaque jour.
- *Achète…* : une mission ne pousse pas à dépenser.
- *Réussis 8 gestes PARFAIT, enchaîne 3 PARFAIT* : ces missions paieraient la
  qualité du geste, et donneraient envie de l'automatiser. Elles demandent en
  plus des compteurs que le lot 6 posera. Elles restent en réserve (§ 10).

### Les récompenses

| | Écharpes | XP | Tampons de saison |
|---|---|---|---|
| Mission facile | **30** | **20** | 1 |
| Mission moyenne | **60** | **40** | 1 |
| Mission difficile | **100** | **60** | 2 |
| **Le sachet** (les trois récupérées) | **1 booster** | — | 1 |

- **Rapportée à l'heure**, une mission paie à peu près ce qu'une heure de
  duels classés rapporte déjà, **en plus** de ce que la partie verse. C'est
  une prime au jeu, pas une seconde paie.
- **L'XP** : une mission vaut à peu près un duel. Les trois font 120 XP par
  jour, autant que 24 boosters ouverts.
- **Le sachet** est le seul booster quotidien des missions. Il va dans la
  réserve **même si elle est pleine**, comme le booster des premiers pas :
  c'est un cadeau, pas une réserve plus grande.
- **Les montants sont figés le matin.** Si tu changes un montant à midi, il
  vaut pour le lendemain : le joueur reçoit ce qu'on lui a promis. Le bonus de
  présence fait exception : il se calcule au moment où on le récupère, et un
  changement de ses réglages vaut tout de suite.

---

## 4. Le bonus quotidien : une carte de présence

La règle du jeu le dit déjà : « Tu as joué 47 jours d'affilée » est agréable,
mais « tu vas perdre ta série » est une laisse. Le bonus ne punit donc jamais
une absence.

- **Une carte de 7 cases.** Chaque jour où le joueur appuie sur RÉCUPÉRER, la
  carte avance d'une case. Un jour manqué ne la fait **pas reculer** : la case
  suivante l'attend. Après la septième, une carte neuve commence.
- **Montants** : **20, 25, 30, 35, 40, 45, 50 écharpes**, et la septième case
  ajoute **1 booster**. Une carte entière vaut 245 écharpes et un booster.
  C'est volontairement peu : un rituel d'entrée, pas une source de revenu.
- **« J3 » dans la bulle du Fanzzy** désigne la case du jour. Une absence ne
  le fait jamais reculer ; après la septième case, une carte neuve repart
  à J1.
- **La série de jours** (« 5ᵉ jour d'affilée ») s'affiche à partir de trois,
  à titre d'information. Rien n'en dépend. Quand elle s'interrompt, l'écran
  n'en dit rien, et aucun écran ne prévient d'une perte à venir. Le record
  reste visible au profil.
- **Identique pour tous**, abonnés compris.

---

## 5. La saison 1 « La reprise », et la suite

### La fin : dimanche 20 décembre 2026

« La reprise », c'est la première journée après la coupure d'été. Sa fin
naturelle est **la dernière journée avant la trêve d'hiver**. Super League et
Ligue 1 jouent vraisemblablement leur dernier week-end de l'année vers le
19-20 décembre : **à vérifier sur `/matchs` avant de l'écrire**.

- La date se saisit dans l'onglet **Saisons** de l'administration (un jour, pas
  une heure). La saison se termine à la fin de ce jour de jeu.
- **La fin ne ferme rien** : LA REPRISE reste ouverte, comme tout ce qu'une
  saison a ouvert. Elle arrête le carnet, les divisions et le classement
  « saison ». Elle éteint aussi les bonus de KOP « jusqu'à la fin de la
  saison », qui aujourd'hui ne s'éteignent jamais.
- **Si la saison 2 est lancée avant cette date, ou sans qu'aucune date n'ait
  été saisie**, la saison 1 s'arrête au lancement de la 2. Sinon, son carnet
  et ses divisions continueraient de compter sous la saison suivante.
- Les missions du dernier jour, récupérées le lendemain, remplissent encore
  le carnet de la saison 1 : elles ont été tirées pendant elle.
- Le kiosque, le classement et la préparation de duel afficheront
  « SAISON 1 · N JOURS ».

### La récompense : le carnet de tampons

Chaque mission récupérée rapporte des tampons, jusqu'à 5 par jour. Le carnet a
cinq paliers. Chacun se récupère **dès qu'il est atteint**. Un palier atteint
et pas récupéré **reste dû après la fin de la saison** : rien ne se perd.

Calibrage, sur les neuf semaines de saison qui resteront à l'arrivée des
missions : un assidu fera environ 290 tampons, un joueur moyen 125, un
occasionnel 45.

| Palier | Tampons | Nom | Récompense | Qui l'atteint |
|---|---|---|---|---|
| 1 | 10 | De retour | 100 écharpes | tout le monde, en 2 à 6 jours |
| 2 | 40 | Dans le bain | 1 booster, 150 écharpes, **liseré S1** autour de l'avatar | l'occasionnel, vers la fin |
| 3 | 100 | Remis en voix | 2 boosters, 250 écharpes, **tampon S1** sur la carte de supporter | le joueur moyen |
| 4 | 180 | Au rendez-vous | 3 boosters, 400 écharpes | l'assidu, en 5 à 6 semaines |
| 5 | 260 | Revenu pour de bon | 4 boosters, 600 écharpes, **titre « Revenu pour de bon »** pour toujours | l'assidu qui ne manque presque rien |

Le palier le plus haut rapporte, sur toute la saison, 10 boosters et
1 500 écharpes : peu d'argent, et beaucoup d'honneur.

**Les insignes ne sont jamais des tenues.** Un abonné peut porter n'importe
quelle tenue publiée : une tenue offerte en récompense serait donc portable
par tous les abonnés sans l'avoir gagnée. Liseré, tampon et titre sont dessinés
en code, sans image à générer.

Le carnet est écrit dans le code pour la saison 1. Chaque saison suivante peut
avoir le sien, saisi dans l'onglet Saisons. Gabarit pour la suite : des seuils
à environ 3 %, 15 %, 35 %, 60 % et 90 % de ce qu'un assidu peut faire
(environ 4,7 tampons par jour).

**Le carnet de la saison 1 suppose 63 jours de missions**, donc une mise en
ligne au plus tard le 19 octobre. Si elle arrive plus tard, il faut saisir le
carnet dans l'onglet Saisons, seuils multipliés par « jours restants / 63 »,
**avant** le premier palier versé. Ensuite, le carnet d'une saison ne se
modifie plus. L'écran le refuse et dit pourquoi : un seuil relevé ou un gain
baissé après coup reprendrait une promesse déjà faite.

### Le passage de relais

Au lancement de la saison 2, tout joueur qui a gagné **au moins 10 tampons en
saison 1** reçoit **2 boosters**, « les sachets de la trêve ». C'est ce qui
fait revenir les joueurs le jour où il se passe quelque chose.

### La saison 2, proposée : « La trêve »

- Du **lundi 21 décembre 2026 au 28 février 2027**.
- Elle ouvre **une seule** des douze séries fermées. Proposition : **LES HÉROS
  DU CANAPÉ** (« ils n'y étaient pas, et ils savent mieux »), dix lignées et
  cinq légendaires déjà écrites. Pendant la trêve, le supporter regarde les
  autres championnats depuis son canapé. Alternative d'hiver : **LES
  PHÉNOMÈNES MÉTÉO**. À vérifier dans le catalogue tel qu'il est.
- Elle s'annonce quand son contenu est prêt, et seulement à ce moment-là :
  poser sa date d'ouverture dans l'administration, c'est la promettre. Avant
  cela, le kiosque n'affiche aucune date.
- Ses contenus neufs (pièces, actions, stade) devront porter `publie: false`
  dans le code **avant leur premier semis**, sans quoi ils naissent ouverts.

---

## 6. Les paliers de collection et de rang

### Collection : un cran tous les 25 objets

On compte tout ce qu'un booster peut donner aujourd'hui : personnages, états,
tenues, pièces et actions des séries ouvertes. LA REPRISE en compte plus de six
cents, soit environ vingt-cinq crans.

| | Récompense |
|---|---|
| Chaque cran | 25 écharpes |
| Tous les quatre crans (100, 200, 300 objets…) | 1 booster en plus |
| Une **série complète** (tous ses personnages) | 1 booster et 100 écharpes |

Un cran est payé une seule fois. Si une tenue est retirée, ou si tu changes la
taille d'un cran, rien n'est repayé ni repris.

Les joueurs déjà installés franchiront d'un coup tous leurs crans le jour de la
mise en ligne. Pour un vétéran, cela fait environ 600 écharpes et 6 boosters :
c'est un cadeau de lancement acceptable, et je ne propose pas de le brider.

### Rang : cinq divisions de saison

Une division se compte sur la **ferveur classée de la saison** : le Virage
compté et le duel classé, depuis le lancement de la saison. Ce sont des
**seuils fixes**, jamais des pourcentages. Une division atteinte reste
acquise pour la saison, même si d'autres joueurs vous dépassent.

| Division | Seuil | Ce qu'elle donne, une fois par saison |
|---|---|---|
| Sympathisant | dès la première ferveur | l'insigne |
| Habitué | 5 000 | l'insigne |
| Fervent | 30 000 | l'insigne |
| Ultra | 100 000 | l'insigne |
| Capo | 300 000 | l'insigne et le **titre « Capo de la saison 1 »**, pour toujours |

- **Rien de matériel, et c'est voulu.** La ferveur classée n'est plafonnée
  que pour le joueur gratuit : `duelsClassesRestants` et
  `viragesClassesRestants` (`src/server/abonnement/index.js`) rendent « sans
  limite » pour un abonné, et le classé au-dessus du 1 contre 1 lui est
  réservé. Une division payée en boosters ou en écharpes (qui achètent des
  boosters) se gagnerait donc en partie en payant, et la règle « l'argent
  n'achète que du confort » tomberait. Les récompenses matérielles de la
  saison passent par le carnet, que les missions remplissent au même rythme
  pour tout le monde.
- **Le titre de Capo doit rester atteignable sans abonnement**, avec cinq
  duels classés et deux Virages comptés par jour. Recaler les seuils sur la
  population entière (abonnés compris, sans plafond) placerait Capo hors de
  portée du gratuit. Le recalage de l'annexe A d'`ECONOMIE.md` se fait donc
  **sur les seuls joueurs sans abonnement**, et Capo ne dépasse jamais ce
  qu'un gratuit assidu peut faire dans la saison.
- **Les seuils sont incertains d'un facteur deux** : la ferveur réelle des
  joueurs de production n'est pas connue d'ici. Il faut viser environ 70 %,
  40 %, 15 % et 4 % des joueurs actifs sans abonnement pour Habitué, Fervent,
  Ultra et Capo. Relever un seuil en cours de saison ne retire rien à qui l'a
  déjà récupéré. Une division atteinte mais pas encore récupérée suit le
  nouveau seuil.
- L'insigne est la couleur de l'écharpe autour de l'avatar. Elle ne donne
  aucune puissance. RÉCUPÉRER, c'est la porter : le geste reste, sans
  montant.

---

## 7. L'effet sur l'économie

Simulation sur six semaines, avec les missions et la carte de présence, plus
les paliers (carnet, divisions, crans) comptés au prorata. Les chiffres sont
donnés par semaine, pour le premier mois.

| Profil | Écharpes en plus | Boosters en plus | XP en plus | Ce qui change pour lui |
|---|---|---|---|---|
| **Assidu** (7 j/7) | **+2 450** (+15 %) | **+10,1** (+3 %) | **+830** (+26 %) | niveau 28 au 28ᵉ jour au lieu de 25 ; titre du carnet et insigne de Capo dans la saison |
| **Moyen** (5 j/7) | **+1 115** (+22 %) | **+3,4** (+3 %) | **+380** (+39 %) | niveau 16 au 28ᵉ jour au lieu de 13 ; palier 3 du carnet ; insigne Ultra |
| **Occasionnel** (3 j/7) | **+445** (+31 %) | **+1,2** (+4 %) | **+130** (+50 %) | un tiers d'évolutions en plus la première semaine ; palier 2 ; insigne Fervent |

*Ces trois lignes ont été corrigées par soustraction après la relecture : les
divisions ne versent plus rien (§ 6). On a retiré leur part étalée sur neuf
semaines, sans relancer la simulation. Les ordres de grandeur ne bougent pas.*

La simulation, relancée aujourd'hui pour cette note, donne les mêmes ordres de
grandeur pour la part quotidienne seule (missions et carte) : environ 1 500
écharpes par semaine pour l'assidu, 740 pour le joueur moyen, 300 pour
l'occasionnel.

Ce que ces chiffres disent :

- **Les boosters ne bougent presque pas.** Le quotidien ne touche ni au rythme
  que vend l'abonnement, ni aux taux de tirage.
- **Les écharpes montent surtout chez ceux qui jouent peu**, et c'est voulu :
  pour eux, elles comptent encore.
- **C'est l'XP qui fait le travail.** Le niveau n'ouvre que des capacités. Les
  paliers de niveau versent leurs écharpes plus tôt, pas en plus grand nombre.
- **Le Virage passe de zéro** à 190 écharpes, 120 XP et 4 tampons par jour au
  plus, par les missions qui le concernent.

---

## 8. Ce qui reste réglable depuis l'administration

Trois nouvelles sections apparaissent dans l'écran RÉGLAGES. Tout s'y règle
sans livraison, et l'écran se dessine tout seul à partir du registre.

**LE QUOTIDIEN**

| Réglage | Départ |
|---|---|
| Proposer les missions du jour (interrupteur) | oui |
| Relances gratuites par jour | 1 |
| Mission facile, moyenne, difficile : écharpes | 30 / 60 / 100 |
| Mission facile, moyenne, difficile : XP | 20 / 40 / 60 |
| Le sachet des trois missions | 1 booster |
| Proposer le bonus de présence (interrupteur) | oui |
| Première case de la carte | 20 écharpes |
| Chaque case suivante ajoute | 5 écharpes |
| La septième case ajoute | 1 booster |
| Une nouvelle visite commence après | 3 heures d'absence |
| Disjoncteur : au plus, par joueur et par jour | 2 500 écharpes et 15 boosters |

**LES MISSIONS DU JOUR** : une bascule par mission, toutes allumées.

**LA SAISON ET SES PALIERS**

| Réglage | Départ |
|---|---|
| Carnet de tampons (interrupteur) | oui |
| Tampons d'une mission facile, moyenne, difficile, du sachet | 1 / 1 / 2 / 1 |
| Passage de relais : boosters offerts | 2 |
| … à qui a au moins | 10 tampons dans la saison précédente |
| Paliers de collection (interrupteur) | oui |
| Un cran tous les | 25 objets |
| Chaque cran rapporte | 25 écharpes |
| Un booster en plus tous les | 4 crans |
| Une série complète rapporte | 100 écharpes et 1 booster |
| Divisions de saison (interrupteur) | oui |
| Seuils Habitué, Fervent, Ultra, Capo | 5 000 / 30 000 / 100 000 / 300 000 |

Les divisions n'ont **aucun montant à régler** : elles ne paient que
l'insigne et le titre (§ 6). Les deux réglages qui leur donnaient des écharpes
et des boosters ont été retirés.

**Dans l'onglet Saisons** : la date de fin, la date d'ouverture annoncée d'une
saison en préparation, et le carnet de la saison s'il diffère de celui par
défaut.

**Ce qui n'est pas réglable, exprès** : les cibles des missions (« 3
boosters », « 2 duels classés »). Elles décrivent une règle du jeu, comme une
carte, et une cible mal réglée pourrait passer au-dessus du plafond gratuit.
Le nombre de cases de la carte (sept) ne l'est pas non plus, parce qu'il est
dessiné.

---

## 9. Les garde-fous

- **L'argent réel n'achète toujours que l'abonnement.** Aucune récompense ne
  diffère entre abonnés et non-abonnés. Une suite de tests le vérifie, et le
  module des missions ne sait même pas qui est abonné.
- **Un interrupteur par source de gain** : si un abus apparaît un samedi soir,
  tu coupes depuis l'administration, sans livraison.
- **Un disjoncteur par joueur et par jour** (2 500 écharpes, 15 boosters) : au
  pire, une faute de réglage ou un défaut coûte une journée de gains, pas plus.
  Ce qui est bloqué reste dû le lendemain.
- **Un registre unique de tout ce qui est versé**, dont la clé interdit de
  payer deux fois la même chose : deux onglets, un double clic ou un réseau
  qui rejoue ne versent qu'une fois. Une requête d'administration le somme par
  source et par jour, et un pic s'y voit.
- **Un versement est entier ou n'est pas** : les écharpes, les boosters et
  l'XP entrent dans la même transaction que la ligne du registre. Une ligne qui
  dirait « 20 XP versés » sans que l'XP soit arrivée ne pourrait plus jamais
  être rattrapée, puisque sa clé interdit de la verser une seconde fois.
- **Un booster offert ne mange pas la recharge** : la recharge en attente est
  comptée avant le cadeau. Sans cela, un sachet reçu avec 11 boosters sur 12 et
  une recharge due laissait le joueur à 12 au lieu de 13.
- **Sans les nouvelles tables, rien ne casse** : les missions disparaissent de
  l'écran, le reste du jeu tourne comme avant, et le journal nomme le fichier
  à appliquer.

---

## 10. Ce qui est laissé pour plus tard, et pourquoi

| Quoi | Pourquoi plus tard |
|---|---|
| **La présence** (en ligne, au stade, en duel) | Elle touche les salles du Virage et du duel, que le lot 6 refait. Elle demande surtout **ta décision** : visible par défaut ou cachée, pour un public qui compte des mineurs. Il faudra aussi mettre à jour la politique de confidentialité. Jusque-là, aucun écran n'affiche de présence. |
| **Le bilan de tribune du Virage** | Il remplace « QUITTER ? » dans l'arène que le lot 6 redessine, et il a besoin des compteurs de PARFAIT et de meilleure série, que l'on posera en même temps. Le compteur de chants, lui, arrive dès cette vague : les missions en ont besoin. |
| Les missions de qualité (PARFAIT, série) et de cartes jouées | Mêmes compteurs que le bilan, et une question de principe : payer la qualité du geste pousse à l'automatiser. |
| *Affronte un vrai supporter, joue avec un ami, vote au KOP* | La population est encore trop faible pour les garantir chaque jour. |
| La relance gratuite quand un match est reporté | Un confort, pas un besoin du lancement. |
| Le « ▲ depuis hier » de toutes les lignes du classement | La flèche de ta propre ligne arrive dès cette vague. Pour les autres lignes, l'écran garde sa mémoire locale. |
| « +120 écharpes » dans le ticket de retour | Le jeu ne tient aucun journal de ce qu'il verse hors des nouvelles récompenses. Un chiffre partiel mentirait, donc le ticket n'en parle pas. |
| Les titres affichés sur les lignes des autres joueurs | Ils apparaissent d'abord au profil et sur ta ligne. Les premiers titres n'arriveront de toute façon pas avant la cinquième semaine. |

---

## 11. Ce qui te revient (hors délégation)

1. **L'inflation des écharpes, avant la saison 2.** Les vétérans arriveront
   avec 50 000 à 100 000 écharpes et paieront la saison 2 entière dans la
   minute. Deux leviers sont possibles dans le tirage : une poignée réduite
   quand la catégorie tirée est épuisée, ou une légendaire en double qui
   rapporte moins (voir `ECONOMIE.md`, § 12). Le quotidien fonctionne avec ou
   sans.
2. **L'XP du Virage** : proposer 15 XP par match poussé, versés par le bilan de
   tribune, avec le lot 6. C'est une règle, pas un montant.
3. **Le bonus de KOP « La quête »** ne fait rien aujourd'hui : un KOP qui le
   vote perd 900 écharpes. Il faut le brancher ou le retirer.
4. **La ferveur arrondie à zéro** dans une tribune de plus de 34 personnes
   environ (67 pour un supporter du club). C'est invisible tant que les
   tribunes sont petites, mais les divisions en dépendront.
5. **Le minuit du jeu**, une fois la sonde lue (§ 2).
6. **La saison 2** : la série ouverte (LES HÉROS DU CANAPÉ proposée), et la
   date de fin de la saison 1, après vérification du calendrier.
7. **Le dossier du juriste** : l'abonnement, qui double les boosters, fait
   gagner par ricochet environ 2 700 écharpes par jour à un assidu en régime
   établi. Et plus de boosters offerts avec cérémonie rendent plus pressante la
   question de l'affichage des taux de tirage. Le quotidien n'aggrave rien,
   puisqu'il est identique pour tous, mais ces deux points méritent d'y être
   ajoutés. Trois autres aussi, relevés à la relecture :
   - **`JURIDIQUE.md` dit le contraire du code** : « un booster ne s'achète
     pas avec de l'argent réel », alors que l'abonnement livre 1 booster au
     mois et 6 à l'année (`src/shared/boutique.js`, ta décision, écrite et
     bornée). Le dossier doit décrire ce qui est vendu, sinon le juriste répond
     à une autre question.
   - **La carte de présence et la série de jours, pour un public qui compte
     des mineurs** : elles ne punissent rien, mais ce sont des mécaniques
     d'assiduité. C'est une question à poser, pas un avis.
   - **Les crans de collection** versent un booster tous les quatre crans, et
     l'abonné remplit sa collection plus vite. Le total est le même pour tous
     (l'univers est fini), seul le rythme change : c'est la question n° 2 du
     dossier, un cran plus loin.
8. **Les divisions, si tu veux qu'elles paient.** Elles ne donnent que
   l'insigne et le titre (§ 6). Pour leur rendre des boosters sans que
   l'abonnement les achète, il faudrait compter la ferveur de division sous les
   plafonds gratuits **pour tout le monde**, abonnés compris : seuls les cinq
   premiers duels classés et les deux premiers Virages comptés de chaque jour.
   C'est faisable en SQL, mais c'est une requête de plus et une seconde
   définition de la ferveur. Je ne le propose pas pour cette vague.

---

## 12. Les défauts trouvés en chemin, corrigés dans cette vague

Ils sont en ligne aujourd'hui, et le chantier ajoute des versements exactement
à ces endroits. Ils sont donc corrigés **avant** de bâtir dessus.

- **Un forfait paie deux fois le joueur resté** (écharpes, XP et part du KOP) :
  la fin de duel s'exécute deux fois.
- **Deux gains d'XP simultanés** peuvent payer deux fois les écharpes d'un
  palier de niveau, ou ne pas le payer du tout.
- **La recharge des boosters** peut écraser un débit fait au même instant, ce
  qui donne un booster gratuit à qui sait l'exploiter.
- **Un vote de KOP échu** peut débiter le pot deux fois quand plusieurs membres
  regardent la page au même moment.
- **Le compte à rebours d'un vote de KOP** dure probablement deux heures de
  trop après un rechargement, et laisse voter après la clôture.
- **Le classement « saison »** additionne en réalité tout depuis toujours.
- **La suppression d'un compte** ne toucherait pas les nouvelles tables.

Ces défauts ont été établis en lisant le code, sans exécution. Le premier test
écrit pour chacun dira s'ils sont réels, et chaque correctif sera cassé exprès
une fois pour vérifier que son test rougit.

**Un défaut de la même famille reste en ligne, hors de cette vague** : le
booster des premiers pas (`src/server/aide/index.js`, `recompenser`) entre dans
la réserve sans compter d'abord la recharge en attente, alors que son
commentaire affirme l'inverse. Le joueur peut y perdre jusqu'à une recharge.
Le correctif est la même fonction de recharge que celle du registre (§ 9),
mais `aide/` n'appartient à aucun périmètre de cette vague : il est à aiguiller.

---

## 13. Ce que la relecture a changé

Une relecture adverse du chantier, faite dans le code de la copie principale,
a changé ceci. Le détail de chaque constat, avec sa preuve, est dans le rendu
de la relecture. `CONTRATS.md` (§ 12) et `PLAN.md` (§ 11) portent les mêmes
changements, à leur niveau.

1. **Les divisions ne paient plus que l'honneur** (§ 6, § 8). La ferveur
   classée n'a pas de plafond pour l'abonné : des divisions payées en boosters
   se seraient gagnées en partie en payant, et le recalage des seuils sur
   toute la population aurait mis Capo hors de portée du gratuit. Le recalage
   se fait désormais sur les seuls joueurs sans abonnement. Les deux réglages
   de gains des divisions disparaissent, et les chiffres du § 7 baissent un
   peu.
2. **Un booster offert compte d'abord la recharge en attente** (§ 9). Sans
   cela, le cadeau effaçait jusqu'à une recharge.
3. **L'XP d'une récompense entre dans la même transaction** que le reste
   (§ 9). Versée après coup, elle pouvait manquer pour toujours sous une ligne
   du registre qui la disait versée.
4. **Les chants comptent pour le jour du coup d'envoi** (§ 3). Une présence
   au Virage est une ligne par match, datée de sa dernière poussée : un match
   à cheval sur minuit faisait fondre la mission de la veille et remplissait
   celle du jour.
5. **Un duel compte s'il a duré une minute et n'a pas été quitté** (§ 3). Un
   second compte qui abandonne aussitôt offrait une victoire en trois secondes.
6. **La saison 1 s'arrête au plus tard au lancement de la 2**, et ses missions
   du dernier jour récupérées le lendemain comptent encore (§ 5).
7. **Le carnet d'une saison se fige au premier palier versé**, et celui de la
   saison 1 se recale si la mise en ligne passe le 19 octobre (§ 5).
8. **Le bonus de présence suit ses réglages tout de suite**, contrairement aux
   missions, et l'écran d'administration le dit (§ 3).
9. **Le dossier du juriste** gagne trois points, dont un fait que
   `JURIDIQUE.md` contredit aujourd'hui : l'abonnement livre des boosters
   (§ 11.7). Et une décision t'est rendue : faire payer les divisions, à quel
   prix (§ 11.8).
10. **Un défaut voisin reste en ligne** : le booster des premiers pas mange la
    recharge lui aussi, mais il est hors de cette vague (§ 12).

Le reste ne change rien à ce que tu as délégué, mais l'atelier en a besoin :
ma ligne de classement qui suit la fenêtre de la saison, la flèche de rang qui
compare au dernier jour vu (et pas à la première lecture du jour), le record
de série toujours servi, un ordre de verrous commun à la relance et à la
réclamation, un « déjà récupéré » qui passe avant le disjoncteur, le compteur
de chants qui se rebranche tout seul quand le schéma arrive après le
démarrage, la suppression de compte qui vise le bon identifiant, l'avatar d'un
compte supprimé jamais montré, et un ticket « depuis ta visite » qui ne coûte
presque rien quand il n'a rien à dire.
