# ÉTAT DU PROJET — à lire en premier

Ce fichier existe pour qu'une nouvelle conversation reprenne exactement où la
précédente s'est arrêtée. **Dépose l'archive complète du projet et ce fichier
au début de chaque nouvelle session**, et dis simplement sur quoi tu veux
travailler.

Dernière mise à jour : session « écran de deck, deux Fanzzy illustrés, écran de
duel NvN, suppression du catalogue recopié ».

---

## 1. Ce que c'est

**thebestfan.online** — un jeu de cartes de supporters adossé aux vrais matchs
de football. Le joueur collectionne des Fanzzy, pousse sur une corde partagée
pendant que son club joue, et repart avec une carte-souvenir par but vécu.

Hébergé chez Infomaniak, site Node.js + base MariaDB, données sportives
fournies par API-Football (7 500 appels par jour).

---

## 2. Comment travailler

Le projet suit une méthode constante, à conserver :

- **Chaque module a sa suite de tests**, dans `scripts/*-smoke.mjs`. Ils montent
  un vrai serveur sur une vraie base. On ne livre rien sans les avoir passés.
- **Les tests ont trouvé des bugs que la relecture avait ratés** — collation de
  base, buts perdus, soldes non débitables, catalogue divergent, barre de
  navigation par-dessus le bouton de jeu. C'est le cœur de la méthode : écrire
  le test qui aurait attrapé le bug, pas seulement le correctif.
- **Le code est commenté en français**, et les commentaires expliquent le
  *pourquoi*, pas le *quoi*.
- **Les messages d'erreur doivent nommer la cause.** Plusieurs séances ont été
  perdues sur des « impossible » qui cachaient une table manquante. La même
  faute a été refaite quatre fois : ouverture de booster, télétexte,
  compositions, chargement du catalogue. Un message vague coûte toujours plus
  cher qu'il n'économise.
- **`node scripts/verif-pages.mjs` avant chaque livraison front.** Il compile
  chaque script de page, vérifie qu'aucun accent grave ne traîne dans un bloc
  CSS écrit en gabarit de chaîne, que chaque page charge la barre commune, et
  qu'aucun catalogue n'est réécrit en dur.

### Les tests d'interface

Trois suites font tourner une vraie page dans un vrai navigateur, contre un
vrai serveur. Elles ont trouvé des choses qu'aucune relecture ne voit — un
bouton recouvert de 16 pixels, une image décentrée d'une demi-largeur.

| Suite | Ce qu'elle couvre | Outil |
|---|---|---|
| `deck-ui-smoke.mjs` | construction de deck | jsdom |
| `nvn-ui-smoke.mjs` | duel N contre N, deux joueurs | puppeteer |
| `fanzzy-ui-smoke.mjs` | classeur, kiosque, catalogue | puppeteer |

`jsdom` est déclaré en `devDependencies`. **`puppeteer` ne l'est pas, et c'est
volontaire** : il télécharge un Chromium de près de 200 Mo, ce qui alourdirait
`npm install` sur le serveur. Avant de lancer les suites qui en ont besoin :

```bash
npm install --no-save puppeteer
```

Ces trois suites ne tournent pas sur le serveur de production. Elles se lancent
en local, avant de livrer.

### Deux pièges de test rencontrés deux fois chacun

**`body.textContent` inclut le contenu des balises `<script>`.** Une
vérification qui cherche un message dans le texte de la page le trouve dans son
propre code source et passe alors que rien n'est affiché. Toujours cloner le
corps et retirer `script,style` avant de lire.

**Le hasard du jeu ne doit pas fuir dans l'assertion.** Deux tests échouaient
par intermittence pour cette raison : l'un rejouait un geste au tempo bruité
et attendait une annulation exacte, l'autre cliquait sur la première carte
d'une main mélangée qui pouvait être justement celle qui donne le droit qu'on
voulait voir refusé. Un test qui échoue une fois sur dix est pire qu'un test
absent : il apprend à ignorer les rouges.

---

## 3. Décisions à ne pas défaire

Elles ont été prises pour de bonnes raisons, parfois après mesure. Les revenir
casserait l'équilibre du jeu ou la conformité.

**Un skin ne donne aucun bonus.** Il change l'apparence, rien d'autre. Celui qui
ouvre mille boosters est plus beau, pas plus fort.

**L'équipement a toujours un revers, et on n'en porte que deux.** Les jumelles
élargissent la fenêtre du tempo mais ralentissent la cadence. Un joueur équipé
n'est pas plus fort, il joue autrement.

**Le nombre ne décide pas.** Une poussée est divisée par l'effectif de la
tribune, et la foule ne compte qu'en logarithme : une tribune deux fois plus
nombreuse pousse 18 % plus fort, pas deux fois. Sans cela, le club le plus
populaire gagnerait toujours.

**Le geste est noté par le serveur.** Le client envoie les instants de ses
frappes, jamais sa réussite. Deux contrôles écartent l'automatisation : écart
minimal entre frappes, et plafond de frappes.

**Le barème du geste vient du serveur, jamais recalculé par le client.**
`resoudreGeste()` est la seule source. Quand le client redessinait la pulsation
avec ses propres constantes, un joueur portant les Jumelles tapait juste sur ce
qu'il voyait et récoltait 0,36 au lieu de 0,99 : l'équipement censé l'aider le
pénalisait, et plus la carte était rare, pire c'était.

**Le catalogue Fanzzy n'existe qu'à un endroit**, `src/shared/fanzzy/dex.js`,
servi par `/api/fanzzy/dex`. Aucune page ne le recopie. Voir § 6.

**On ne rejoue pas un match passé.** Un duel adossé à un match du jour ou en
cours est classé ; à un match futur, c'est un entraînement ; à un match passé,
c'est refusé.

**Aucune série quotidienne qu'on perd.** « Tu as joué 47 jours d'affilée » est
agréable ; « tu vas perdre ta série » est une laisse.

**Les visuels générés ne portent ni marque, ni nom de club, ni texte.** Règles
complètes dans `VISUELS.md`.

---

## 4. Ce qui existe et fonctionne

| Adresse | Contenu |
|---|---|
| `/` | accueil : vitrine avant connexion, hub après |
| `/compte` | inscription, connexion, mot de passe oublié, Google |
| `/bienvenue` | cérémonie d'arrivée : club, paquet de bienvenue |
| `/fanzzy` | kiosque, classeur, Fanzzy équipé |
| `/fanzzy/:id` | fiche d'un Fanzzy : histoire, effets, tenues, lignée |
| `/deck` | construction de deck : trois Fanzzy, équipement, dix cartes |
| `/carnet` | souvenirs vécus et vignettes à récupérer |
| `/virage` | Grand Virage : tir à la corde pendant un vrai match |
| `/duel` | duel tour par tour, avec entraînement contre bot |
| `/duel-nvn` | duel N contre N en temps réel, adossé à un vrai match |
| `/matchs` | matchs du jour, en direct, avec fiche détaillée |
| `/teletext` | tous les championnats : classements, buteurs, cartons |
| `/classement` | supporters, tribunes, duellistes |
| `/profil` | identité, clubs, inventaire, langue, déconnexion |
| `/admin` | joueurs, compétitions, réglages, journal d'audit |
| `/diagnostic`, `/healthz` | état du service |

**Côté serveur, testé** : authentification, suivi des équipes, cartes-souvenirs,
collection Fanzzy, télétexte, inscription et inventaire, classements, decks,
moteur NvN, couche réseau NvN, administration.

**Côté interface, testé** : écran de deck, écran de duel NvN, classeur.

Le catalogue compte **29 Fanzzy**. Trois sont illustrés : `G1` (Le Gamin de
Devant), `X7` (Le Trieur de Doubles), `X8` (La Mascotte du Dimanche).

---

## 5. Ce qui reste à faire

Par ordre d'utilité :

1. **Le fil du match en direct dans le Grand Virage** — les buts réels
   secouent la corde, mais aucun fil d'événements n'est affiché.
2. **Le pronostic de ferveur** — miser des écharpes sur un score avant le coup
   d'envoi. Conçu, pas commencé.
3. **Le derby automatique** — proposer un duel quand deux joueurs en ligne
   suivent les deux clubs qui s'affrontent réellement.
4. **Les illustrations des 26 autres Fanzzy.** Ajouter un identifiant à
   `ILLUSTRES` dans `public/fanzzy.html` suffit à basculer, à condition que les
   six fichiers existent — `verif-pages.mjs` le vérifie. Chaîne de production
   décrite au § 9.
5. **Les illustrations de skins** — changer de tenue ne change que le nom.
6. **Une mise en page pour écran large.** L'application est en colonne étroite
   centrée, pensée pour le téléphone.
7. **Rejouer la simulation d'économie.** Les chiffres commentés dans `dex.js`
   (« compléter la collection rapporte environ 1 150 écharpes ») ont été
   calibrés à 27 cartes. Il y en a 29, et le pool VIRAGE NORD en rareté d2 est
   passé de 5 à 7 entrées, ce qui dilue la chance de tirer chaque carte.

---

## 6. Pièges connus

**Le schéma doit être complet.** 27 tables. Une table manquante produit des
erreurs déroutantes — c'est ce qui a causé « Ouverture impossible ». Contrôle :
`SHOW TABLES;`. Base ancienne : `sql/rattrapage.sql`.

**Relancer `scripts/coverage.mjs` après toute modification du schéma
`souvenir_leagues`**, sinon les paliers et la couverture des buteurs restent
vides et le télétexte affiche une base incomplète.

**Le quota API est la contrainte structurante.** Tout passe par `api_cache`. Une
compétition consultée toute la journée coûte environ 34 appels ; le budget de
6 800 permet environ 200 compétitions actives par jour. Ce qui coûte, c'est le
nombre de compétitions *différentes*, pas le nombre de joueurs.

**Ne jamais identifier un événement par sa position** dans la liste de l'API :
elle en insère parfois un plus tôt, tout se décale, et un but disparaît. On les
identifie par type, équipe, minute et joueur.

**Le SMTP n'est pas configuré** tant que `/healthz` affiche `"etat":"console"`.
Les mails de vérification partent alors dans les logs du Manager.

**Ne jamais mettre en cache une réponse vide comme si elle était définitive.**
Une composition demandée avant sa publication revient vide ; la garder trente
minutes fait manquer sa parution. Les réponses vides vivent 90 secondes.

**Une page à hauteur fixe ne se décale pas avec une marge sur le corps du
document** : son contenu est coupé. La barre commune réserve donc sa place sur
le conteneur `#app`, pas sur `body`.

**Sur un écran de jeu, la barre ne réserve que 55 % de sa hauteur.** C'est
voulu : elle s'y efface dès qu'on joue et une réserve pleine mangerait la place
utile. Mais ça ne suffit pas pour le bouton d'action principal, qui passait
16 px dessous — un joueur visant « CHANTER » touchait « PROFIL » et quittait le
duel. Les pages de jeu complètent les 45 % manquants elles-mêmes, sur le bouton
concerné. Vérifié par mesure des rectangles dans `nvn-ui-smoke.mjs`.

**L'appui long ouvre le menu natif du navigateur sur mobile** et vole le geste
de déchirure d'un booster. Neutralisé dans `nav.js` par trois moyens
complémentaires — un seul ne suffit pas selon les navigateurs.

**Ne jamais centrer une illustration par `transform`.** `fx.js` pose la classe
`fz-vivant` sur toute image `.illu` pour la faire respirer, et ses keyframes
réécrivent `transform` en entier : un `translateX(-50%)` y est effacé dès la
première image de l'animation. Les marges automatiques ne marchent pas non plus
quand l'image déborde de sa fenêtre — la marge gauche est ramenée à zéro et
tout le débord part à droite. Utiliser `object-fit` et `object-position`.

**Le catalogue est servi avec un cache d'une heure.** Après un déploiement qui
ajoute des Fanzzy, un joueur déjà connecté garde l'ancien catalogue jusqu'à
soixante minutes et peut tirer une carte que sa page ne connaît pas.
L'ouverture de booster le dit désormais au lieu de planter (« Carte inconnue de
cette version »), mais la vraie correction reste à faire : un numéro de version
dans l'URL du catalogue, pour casser le cache à chaque déploiement.

---

## 7. Questions juridiques ouvertes

À traiter avec un avocat, pas avec moi :

- **Vendre des écharpes** qui achètent des boosters à contenu aléatoire est
  juridiquement identique à vendre des coffres surprise. Belgique et Pays-Bas
  restreignent, la loi suisse mérite un avis. Tant que les écharpes se gagnent
  en jouant, la question ne se pose pas.
- **Une carte-souvenir porte le nom et l'écusson d'un club.** L'afficher dans un
  tableau de résultats est un usage normal ; en vendre un exemplaire est autre
  chose.

## 7 bis. À faire sur le serveur, en attente

1. **Relancer l'inventaire des compétitions.** Les paliers en base suivent
   encore l'ancienne règle, qui classait 117 compétitions comme « majeures ».
   `node --env-file=.env scripts/coverage.mjs` — attendu : une dizaine.
2. **Déclarer un administrateur.** Aucun compte n'a le rôle. Ajouter
   `ADMIN_EMAILS` puis redémarrer.
3. **Donner leur tenue de base aux Fanzzy anciens.** Attention : le fichier
   `sql/tenues-de-base.sql` mentionné dans les notes précédentes **n'existe
   pas** dans le dépôt. Il est à réécrire avant de pouvoir exécuter ce point.

---

## 8. Configuration du serveur

Variables dans `.env`, jamais commité :

```
DATABASE_URL=mysql://o42s1v_tbf:MOTDEPASSE@o42s1v.myd.infomaniak.com:3306/o42s1v_thebestfan
PUBLIC_ORIGIN=https://thebestfan.online
SESSION_SECRET=<openssl rand -hex 32>
API_FOOTBALL_KEY=<clé>
API_FOOTBALL_BUDGET=6800
ADMIN_EMAILS=ton@adresse.ch
GOOGLE_CLIENT_ID=…      GOOGLE_CLIENT_SECRET=…
SMTP_HOST=mail.infomaniak.com   SMTP_PORT=465
SMTP_USER=no-reply@thebestfan.online   SMTP_PASS=…
MAIL_FROM=thebestfan <no-reply@thebestfan.online>
```

Déploiement complet : voir `DEPLOIEMENT.md`.

---

## 9. Fabriquer une illustration de Fanzzy

Le jeu attend deux fichiers par Fanzzy, en trois formats chacun : un plein pied
`ID.{avif,webp,png}` en 520×945 pour la fiche, et un buste `ID-buste.*` en
320×320 pour le classeur. Fond transparent.

Le rendu brut sort d'un générateur en 1536×2752 sur fond uni. Trois choses ont
demandé plusieurs essais :

**Le détourage ne se fait pas au seuil global.** Un personnage peut tenir des
cartes blanches sur fond blanc, ou porter une fourrure anthracite sur fond
noir. On isole les zones de fond *connexes au bord*, et rien d'autre. L'alpha
suit la distance à la couleur de fond entre deux seuils, ce qui conserve
l'anticrénelage des cheveux et de la fourrure.

**Le buste se centre sur la tête, pas sur le sujet.** La carte du classeur
recadre le carré en portrait : seul le centre reste visible. Centrer sur la
matière la plus haute rate — une main levée monte aussi haut qu'un crâne.
Centrer sur la plage continue la plus large rate aussi — un éventail de cartes
fait une plage large. Ce qui marche : éroder le masque du haut du sujet, les
bras et objets tenus sont trop fins et disparaissent, la tête survit.

**Regarder l'image avant de l'intégrer**, comme le demande `VISUELS.md`. Les
générateurs ajoutent spontanément des écussons et des lettres. Vérifier aussi
qu'un costume ne ressemble pas à un personnage de studio connu : ce n'est pas
un écusson de club, mais c'est le même genre de risque.

---

## 10. Comment reprendre

Au début d'une nouvelle conversation :

1. Dépose l'archive du projet et ce fichier.
2. Dis sur quoi tu veux travailler.
3. Si un bug est en cours, donne le message exact et, si possible, ce
   qu'affiche `curl https://thebestfan.online/healthz`.

Ce qui n'est **pas** transmis d'une session à l'autre : aucun souvenir de la
conversation précédente. Tout ce qui compte doit être dans le code, dans les
commentaires, ou dans ce fichier. C'est pour ça qu'ils sont écrits comme ils
le sont.

**Un mot sur le travail en parallèle.** Lors de la dernière session, des
fichiers ont été écrits dans le répertoire de travail par une autre session
travaillant en même temps. Rien n'a été écrasé, mais deux agents qui écrivent
au même endroit finiront par se croiser sur le même fichier. Si tu fais
travailler plusieurs sessions en même temps, donne-leur des chantiers qui ne se
recouvrent pas, et dis-le-leur.
