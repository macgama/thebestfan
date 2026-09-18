# Ce qui reste à faire

Écrit après un contrôle général de l'application — septembre 2026, session
« le défilé des âges ». Ce fichier n'est pas une liste de souhaits : chaque
entrée dit **ce qui ne va pas aujourd'hui**, pourquoi ça compte, et ce que ça
demande. Les entrées sont rangées par valeur décroissante, pas par difficulté.

`ETAT.md` dit où en est le projet. `A-DEPLOYER.md` dit ce qui attend d'être
déposé. Celui-ci dit ce qui n'est pas encore écrit.

---

## 1. Une seule monnaie, deux définitions selon l'écran

**C'est la plus grosse incohérence du jeu aujourd'hui, et elle explique
probablement « les classements ne fonctionnent pas très bien ».**

Le duel rapporte de la ferveur. Elle est bien calculée, bien écrite —
`duel_results.ferveur` — et elle compte dans les classements **par
compétition**, dont la requête additionne explicitement les deux sources
(`classements/index.js`, constante `SOURCE`).

Mais les deux classements que le joueur voit en premier, SUPPORTERS et
TRIBUNES, ne lisent que `virage_presence`. Un joueur qui ne fait que des duels
a donc de la ferveur, la voit dans son parcours, la voit dans le classement de
la Ligue 1 — et reste à zéro dans le classement des supporters. Le même mot
mesure deux choses selon l'onglet.

Il y a deux réponses cohérentes, et il faut en choisir une :

- **La ferveur est la ferveur.** SUPPORTERS et TRIBUNES additionnent virage et
  duel classé, comme le fait déjà le classement par compétition. C'est une
  ligne de SQL dans chacune des deux requêtes. Le texte d'aide de la page — « La
  ferveur se gagne en chantant dans le Grand Virage » — devient faux et doit
  changer.
- **Le virage et le duel sont deux disciplines.** On le dit franchement : le
  classement des supporters est celui du virage, l'onglet DUELS est celui du
  duel, et le classement par compétition cesse d'additionner les deux.

La première me paraît meilleure : elle récompense de jouer, quelle que soit la
façon. Mais c'est une décision de jeu, pas une décision technique.

## 2. Le duel ne compte que pendant le match, et c'est brutal

La règle est écrite et elle est bonne — `deck/index.js` : « un duel de tribunes
se joue pendant le match, sinon il ne se distingue en rien d'un entraînement ».
La page du duel le dit clairement, avant et pendant. Rien n'est caché.

Mais en pratique, **hors des heures de match il n'existe aucun duel classé**, et
l'onglet DUELS demande en plus trois parties classées avant de faire apparaître
quelqu'un. Un bêta-testeur qui joue un mardi après-midi peut enchaîner quinze
duels contre de vrais adversaires et ne se voir nulle part. Il en conclura,
raisonnablement, que les duels ne sont pas pris en compte.

Trois pistes, de la moins à la plus engageante :

- **Dire ce qui manque.** L'onglet DUELS, quand il est vide pour ce joueur,
  écrit « il te faut 3 duels classés — joue pendant un match ». Un classement
  vide qui explique son vide n'est plus une panne.
- **Un classement des entraînements**, à part et clairement nommé. Ça ne casse
  rien : l'entraînement reste sans effet sur le classé.
- **Élargir la fenêtre du classé** — par exemple l'heure qui précède le coup
  d'envoi et celle qui suit le coup de sifflet final. À peser : c'est la règle
  du jeu qu'on touche, et elle a été posée pour une bonne raison.

## 3. L'historique des duels — la moitié est faite

**Corrigé pendant ce contrôle** : l'adversaire, la sorte de partie et l'heure.
`duel_results.opponent_id` était écrit depuis le premier jour et relu nulle
part ; la ligne donnait le match de football — « Sion – Bâle » — et pas
l'adversaire, qui est pourtant le sujet d'un duel. Elle dit maintenant « contre
Marie », avec le match en dessous, la mention « classé » ou « entraînement », et
la couleur qui suit celle des tuiles du résumé. Les bots sont nommés « un bot »
plutôt que `bot:a1b2c3d4`.

**Reste à faire**, et il faut une colonne pour chacun :

- **Le Fanzzy joué.** Pas enregistré du tout. C'est ce qui permettrait « ton
  Capo a gagné 8 duels sur 11 », et c'est le genre de phrase qui donne envie
  d'en faire grandir un second.
- **L'XP gagnée.** Calculée au moment du duel, jamais conservée : le parcours
  montre la ferveur, jamais la progression.
- **La durée.** Deux duels de cinq minutes et un abandon à la trentième seconde
  se lisent pareil.

## 4. Les dessins — le vrai plafond du jeu

**10 lignées entièrement dessinées sur 191. 20 âges supérieurs sur 382.**

C'est, et de loin, ce qui limite le plus ce qu'un joueur voit. Toute la
mécanique des âges, du classeur, du défilé sur l'accueil fonctionne — sur un
catalogue dont la grande majorité n'a qu'une illustration de carte, sans états.

Ce n'est pas un travail de code. Mais deux choses aideraient :

- **Un tableau de bord de production** : quel personnage a quoi, ce qui manque
  pour compléter une lignée, combien il reste. `npm run pages` en donne déjà le
  total ; le détail se cherche à la main.
- **Un contrôle sur un échantillon représentatif.** Les suites éprouvent
  TR1, TR2 et TR32 — c'est-à-dire exactement les personnages complets. Un
  défaut qui ne touche que les 181 autres passe au vert. C'est déjà arrivé deux
  fois cette semaine.

## 5. L'abonnement est branché côté serveur, invisible côté joueur

Tout existe : la table, le module, les cinq portes, les routes d'administration,
`GET /api/abonnement` qui rend l'état **et** ce que l'abonnement ouvre, **et**
ce qu'il n'enferme pas. Rien ne le montre.

Il manque, dans l'ordre :

- **L'écran qui le propose au joueur.** La route sert déjà `ouvre` et `libre` :
  la page n'a pas à porter sa propre copie du barème.
- **Le bouton d'administration.** Les routes `POST` et `DELETE
  /api/admin/joueur/:id/abonnement` sont écrites et testées ; `public/admin.html`
  ne les appelle pas. C'est ce qui permettrait d'ouvrir la bêta.
- **Stripe en `mode: 'subscription'`.** La boutique est en `mode: 'payment'`
  (`boutique/index.js`). Le module d'abonnement est écrit pour ne pas l'attendre
  — `source` dit d'où vient la ligne — mais tant que ce n'est pas branché,
  chaque abonnement se pose à la main.

## 6. Ce qu'il faudrait mesurer avant d'ouvrir à des gens

- **Un test de charge du Grand Virage.** `scripts/virage-loadtest.mjs` existe ;
  il n'a jamais tourné sur la machine de production. La corde partagée est
  l'endroit où le jeu tient ou ne tient pas.
- **Le quota API-Football.** 7 500 appels par jour, et rien ne dit aujourd'hui
  combien on en consomme un soir de Ligue des champions.
- **La question juridique des écharpes.** Elles s'achètent. Selon ce qu'on en
  fait, ça change de catégorie. À trancher avant d'ouvrir la boutique à des
  gens qui ne sont pas des amis.

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
- **`duellistes` n'a pas de fenêtre de temps.** Le classement des duels compte
  depuis toujours, quand SUPPORTERS propose « saison » ou « mois ». Un joueur
  qui commence ne rattrapera jamais personne.
- **Deux colonnes mortes dans `duel_results` : `elo_before` et `elo_after`.**
  Jamais écrites, jamais lues, 1000 partout depuis le premier jour. Un schéma
  qui décrit un classement Elo qui n'existe pas se lit comme une fonction
  débranchée, et quelqu'un finira par bâtir dessus. Soit on classe vraiment les
  duellistes sur une cote — ce qui serait un meilleur classement que « qui a
  gagné le plus de fois », parce qu'il tient compte de l'adversaire — soit les
  deux colonnes partent.
- **Aucun écran ne montre l'adversaire avant le coup d'envoi.** La salle
  d'attente affiche les inscrits ; une fois la partie lancée, on ne sait plus
  contre qui on joue.

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
| **L'historique des duels** | Ne disait pas contre qui on avait joué, ni si la partie avait compté. Voir le point 3. |
| **La hauteur du personnage sur l'accueil** | La rangée d'âges ajoutée cette semaine reprenait une soixantaine de pixels au personnage, qui est le sujet de l'écran. Les flèches et le bouton sont maintenant posés par-dessus la plaque, hors du flux. |
| **`prefixes:smoke`, `vitrine:smoke`, `matchs:ui`** | Trois suites cassées par des travaux antérieurs, dont deux par les miens. |
