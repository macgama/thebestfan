# Chantier serveur de la refonte : les risques

Ce document couvre les dix données que la synthèse de la refonte (`SYNTHESE.md`,
§ 4, « Ce que le serveur doit exposer ») demande au serveur :
(1) XP courant et seuil dans les résultats de booster et de duel ; (2) drapeau
« vu / nouveau » ; (3) avatar dans les classements, le KOP et la ferveur par
compétition ; (4) delta de rang, cote avant et après ; (5) paliers de collection
et de rang ; (6) missions du jour, réclamation, bonus quotidien, série de jours ;
(7) saison datée ; (8) « depuis ta dernière visite » ; (9) présence ; (10) bilan
de tribune du Virage.

Je l'ai écrit en lisant le code en place : `src/server/{niveau,fanzzy,nvn,kop,classements,aide,abonnement,reglages,amis,souvenirs,auth,garde}`,
`src/shared/{reglages,niveau,jour,boutique}.js`, `sql/`, `scripts/ordre-schema.mjs`,
`scripts/base-de-test.mjs`, `scripts/deployer.sh`, `.github/workflows/deploiement.yml`,
`ETAT.md` (§ 2 et § 6), `HISTORIQUE.md` (§ 4 quater), `JURIDIQUE.md`,
`CONFIDENTIALITE.md`, `DEPLOIEMENT.md`, `A-DEPLOYER.md`. Je n'ai lancé aucune suite.
Les défauts de la section 0 sont donc établis **par la lecture du code**, pas par
une exécution. Le premier test proposé pour chacun dira s'ils sont réels.

Chaque risque suit le même ordre : **où** il se trouve, **comment** il se
produit, la **parade**, et le **test** qui la tient. La gravité est notée ainsi :

- **B (bloquant)** : à corriger ou à poser avant d'écrire la fonction qui en dépend ;
- **L (livraison)** : à tenir dans la livraison elle-même ;
- **S (à surveiller)** : décision à prendre, ou défaut sans conséquence immédiate.

---

## Synthèse

| id | risque | touche | gravité |
|---|---|---|---|
| E1 | un forfait paie deux fois le camp resté (écharpes, XP, pot du KOP) | (1) (4) (6) | **B** |
| E2 | `niveau.gagner()` lit puis écrit : palier payé deux fois ou jamais, XP rendue fausse | (1) (5) (6) | **B** |
| E3 | la recharge des boosters écrase un débit concurrent : booster gratuit | (6) | L |
| E4 | un vote de KOP échu peut être appliqué deux fois : pot débité deux fois | (3) (9) | L |
| E5 | KOP : la clôture du vote est comparée en JavaScript à une colonne écrite par `NOW(3)` | (3) | S |
| E6 | le classement « saison » n'a aucune fenêtre : c'est un cumul de tous les temps | (4) (7) | L |
| E7 | indice que la session MySQL de production n'est pas à l'heure de Zurich | (6) (7) | **B** (sonde) |
| T1 | un montant ou un jour reçu du client | (5) (6) (7) | **B** |
| T2 | double versement : deux onglets, double clic, réseau qui rejoue | (5) (6) (7) | **B** |
| T3 | une écriture déclenchée par un GET (aperçu de lien, préchargement) | (2) (6) (8) | L |
| T4 | l'horloge du téléphone | (6) (7) | L |
| T5 | recharger la page pour tirer d'autres missions | (6) | L |
| T6 | une mission qui paie la répétition ou la qualité du geste | (6) | **B** |
| T7 | comptes jetables, parrainage, pot de KOP | (6) | L |
| T8 | collusion en duel classé pour les missions « gagne » et les paliers de rang | (5) (6) | S |
| T9 | un réglage changé en cours de journée | (6) | L |
| T10 | aucun moyen de couper une source de gain sans livrer | (5) (6) (7) | **B** |
| T11 | fin de saison payée deux fois, ou sur un classement qui bouge encore | (7) | L |
| J1 | trois horloges pour dire « aujourd'hui » | (6) | **B** |
| J2 | minuit pile | (6) | L |
| J3 | les deux dimanches de bascule d'heure | (6) (7) | L |
| J4 | le piège d'`abo:smoke`, une troisième fois | tests | L |
| J5 | une colonne `DATE` relue en JavaScript | (6) (7) | L |
| J6 | la série de jours et ses deux onglets | (6) | L |
| J7 | la date de fin d'une saison | (7) | L |
| M1 | deux ordres de déploiement coexistent | tout | **B** |
| M2 | un versement possible sans son grand livre | (5) (6) (7) | **B** |
| M3 | une clé d'idempotence absente en production sans que rien le dise | (5) (6) (7) | **B** |
| M4 | un rattrapage rejoué à chaque déploiement | (2) | L |
| M5 | le fichier SQL hors de l'ordre | tout | L |
| M6 | des pages neuves servies par l'ancien processus | tout | L |
| M7 | ce qui vit en mémoire disparaît au redémarrage | (9) (10) | S |
| M8 | l'effacement d'un compte ne touche pas les nouvelles tables | (2) (6) (8) | L |
| P1 | une requête lourde de plus sur vingt écrans | (3) (4) (6) (8) | **B** |
| P2 | le delta de rang par double agrégat | (4) | L |
| P3 | l'avatar ligne à ligne, et la ruée à l'expiration du cache | (3) | L |
| P4 | les nouveautés qui s'accumulent | (2) | S |
| P5 | mille bilans à la même seconde | (10) | L |
| P6 | la présence par socket sur chaque page | (9) | L |
| P7 | la cote relit tout l'historique à chaque fin de duel | (4) | S |
| P8 | une écriture de plus par geste au Virage | (6) (10) | **B** |
| V1 | les classements sont publics, l'avatar et le niveau le deviennent | (3) | L |
| V2 | la page d'un KOP se lit sans en être membre | (3) (9) | L |
| V3 | la présence : la donnée la plus sensible du lot | (9) | **B** |
| V4 | « depuis ta dernière visite » | (8) | L |
| V5 | la politique de confidentialité ne décrit pas ces données | (3) (8) (9) | L |
| L1 | une récompense modulée par l'abonnement | (5) (6) (7) | **B** |
| L2 | une mission hors de portée du joueur gratuit | (6) | **B** |
| L3 | une récompense de classement sur un cumul que l'abonné n'a pas plafonné | (5) (7) | **B** |
| L4 | plus de boosters gratuits mis en scène : afficher les taux | (6) | S |
| L5 | mécaniques d'assiduité et public mineur | (6) | S |
| L6 | un futur « pass de saison » payant | (7) | S |
| L7 | les propriétés des écharpes, et les billets figés | (5) (6) | L |

---

## 0. Ce qui existe déjà, et sur quoi le chantier va bâtir

Ces défauts sont dans le code en ligne aujourd'hui. Ils comptent ici parce que
le chantier ajoute des données ou des versements exactement à ces endroits.

### E1. Un forfait paie deux fois le camp resté · B

- **Où.** `src/server/nvn/index.js` : le gestionnaire `nvn:forfait` (l. 1176-1191),
  `diffuser()` (l. 619-625), `fermer()` (l. 917) et `recompenser()` (l. 823).
- **Comment.** `salle.duel.forfait(side)` passe `termine` à vrai (`engine.js`
  l. 439-447). Le gestionnaire appelle ensuite `diffuser(salle, evs)`, qui appelle
  lui-même `fermer(salle)` puisque `termine` est vrai. Puis il appelle
  `fermer(salle)` une seconde fois, à la ligne 1190. `fermer` n'a aucune garde :
  les deux appels atteignent `recompenser()`. Le camp resté reçoit donc deux fois
  ses écharpes (`UPDATE … scarves = scarves + ?`), deux fois son XP
  (`niveau.gagner`) et deux fois sa part au pot du KOP (`kop.verser`). `nvn:fin`
  part deux fois. `duel_results`, lui, est protégé par `INSERT IGNORE` sur la clé
  `(duel_id, user_id)` : le parcours reste juste et seule la bourse est fausse.
  C'est pour ça que personne ne l'a vu.
- **Pourquoi la suite ne le voit pas.** `nvn-net-smoke.mjs` l. 597, « le gagnant
  touche ce qui était prévu », vérifie `scarves > 0`. C'est le contrôle « du même
  ordre » que le § 2 d'`ETAT.md` interdit : un double versement le passe au vert.
- **Pourquoi c'est bloquant.** Les points (1) et (4) enrichissent justement ce
  bilan. Et une mission « joue un duel » branchée sur `fermer` compterait deux fois.
- **Parade.** Une garde **synchrone** en tête de `fermer`, avant le premier
  `await` : `if (salle.fermee) return; salle.fermee = true;`. Retirer aussi l'appel
  en double du gestionnaire. Mais attention au piège des deux correctifs
  redondants (`ETAT.md` § 2) : chacun deviendrait impossible à éprouver seul.
  Le test doit donc viser la garde directement (voir ci-dessous), pas seulement
  le chemin du forfait.
- **Test.** Dans `nvn-net-smoke.mjs`, le solde du gagnant monte **exactement** de
  `gains.echarpes` annoncé par `nvn:fin`, l'XP exactement de `gains.xp`, et chaque
  socket reçoit un seul `nvn:fin`. Dans `nvn-smoke.mjs`, appeler `fermer` deux
  fois de suite sur la même salle donne un seul versement. Mutation : retirer la
  garde, et le second contrôle rougit.

### E2. `niveau.gagner()` lit puis écrit · B

- **Où.** `src/server/niveau/index.js` l. 46-80.
- **Comment.** Il fait un `SELECT xp` (l. 55), calcule les paliers franchis, puis
  `UPDATE xp = xp + ?, scarves = scarves + ?`, le tout hors transaction. Deux gains
  concurrents lisent la même XP. Deux exemples avec le seuil du niveau 2 à 60 :
  - à xp = 50, deux +20 simultanés voient chacun 50 → 70 et versent chacun les 20
    écharpes du palier 2, soit 40 au lieu de 20 ;
  - à xp = 45, deux +10 voient chacun 55, donc aucun palier. L'XP finale vaut 65,
    le palier est franchi et rien n'est versé.

  La valeur rendue (`xp: apresXp`) est en plus fausse pour l'un des deux appels,
  et c'est elle que (1) veut afficher. La concurrence existe déjà (deux onglets
  qui ouvrent un booster, un booster ouvert pendant une fin de duel). Avec les
  missions, elle deviendra courante : un « TOUT RÉCUPÉRER » enverra plusieurs
  réclamations d'un coup.
- **Parade.** Une transaction avec `SELECT xp … FOR UPDATE`. Les paliers se
  calculent sur la valeur verrouillée, avant l'`UPDATE` puis le `COMMIT`. La
  fonction rend `progression(xpApres)` (`dans`, `pour`, `part`), ce qui sert
  directement (1).
- **Test.** Dans `niveau-smoke.mjs` : `Promise.all` de deux `gagner(+20)` à
  xp = 50 donne +20 écharpes et xp = 90, et `Promise.all` de deux `+10` à 45 donne
  +20 écharpes. Pour que la mutation (retirer le `FOR UPDATE`) rougisse **à coup
  sûr**, le module accepte un crochet de test entre la lecture et l'écriture, ou la
  suite répète la paire vingt fois. Un contrôle de concurrence qui passe par
  chance est le test intermittent que le § 2 interdit.

### E3. La recharge des boosters écrase un débit concurrent · L

- **Où.** `src/server/fanzzy/index.js` : `wallet()` écrit
  `UPDATE user_wallet SET packs = ?, packs_at = ?` (l. 202), et `openPack()`
  appelle `wallet()` hors transaction avant de débiter (l. 632).
- **Comment.** La valeur écrite est **absolue** et calculée sur une lecture faite
  avant. Prenons une recharge due : la requête A ouvre et débite dans sa
  transaction, la requête B (un autre onglet, ou la même requête lancée vingt fois
  par un script) réécrit `packs = ancien + 1` après le débit de A. Le débit est
  perdu et un booster est gratuit. L'abonnement vend précisément de la cadence de
  boosters : ce défaut la donne à qui sait l'exploiter.
- **Parade.** Une écriture conditionnelle,
  `… WHERE user_id = ? AND packs = ? AND packs_at = ?`, et une relecture si aucune
  ligne n'a bougé. Autre option : recharger **dans** la transaction d'`openPack`,
  sous le `FOR UPDATE`.
- **Test.** Dans `fanzzy-smoke.mjs` : réserve à 0, `packs_at` daté d'une cadence
  et une seconde plus tôt, puis dix `POST /open` en parallèle. Il faut exactement
  une ouverture réussie, neuf `fanzzy.error.no_packs`, et une réserve à 0 à la fin.

### E4. Un vote de KOP échu peut être appliqué deux fois · L

- **Où.** `src/server/kop/index.js`, `depouillerEchus()` (l. 185-224). Il est appelé
  par `etat()`, par `GET /miens` (une fois par KOP), par `proposer()` et par
  `modsDe()` à l'entrée au Virage.
- **Comment.** `UPDATE kop_votes SET issue = ? WHERE id = ? AND issue = 'en_cours'`
  est bien conditionnel, mais son `affectedRows` n'est pas lu. Deux lectures
  simultanées après l'échéance passent toutes les deux à
  `UPDATE kops SET pot = pot - ?` puis à `INSERT INTO kop_bonus`. Le cas est
  probable : tous les membres regardent le même compte à rebours de trois minutes,
  et tous les supporters d'un KOP entrent au Virage au coup d'envoi.
- **Parade.** Ne débiter et n'insérer le bonus que si `affectedRows === 1`, dans
  une transaction.
- **Test.** Dans `kop-smoke.mjs` : un vote adopté et échu, puis cinq `etat()` en
  `Promise.all`. Le pot doit être débité une fois, avec une seule ligne
  `kop_bonus`.

### E5. KOP : la clôture du vote comparée en JavaScript · S

- **Où.** `kop/index.js` : la colonne `ferme` est écrite par
  `NOW(3) + INTERVAL ? MICROSECOND` (l. 250), puis lue en JavaScript par
  `fermeDansMs` (l. 376) et par la garde de `voter()` (l. 273).
- **Comment.** C'est la règle du tableau d'`HISTORIQUE.md` § 4 quater : une colonne
  écrite par `NOW(3)` se relit en SQL, jamais en JavaScript. Avec un écart de
  fuseau, le compte à rebours envoyé ajoute l'écart, et la garde de `voter()`
  laisse voter après la clôture pendant la durée de cet écart.
- **Parade.** `GREATEST(0, UNIX_TIMESTAMP(ferme) - UNIX_TIMESTAMP(NOW(3)))` en
  SQL, et la garde de `voter()` en SQL : `… AND ferme > NOW(3)`.
- **Test.** Dans `kop-smoke.mjs`, juste après `proposer()`, `fermeDansMs` vaut
  entre 170 000 et 180 000 ms.

### E6. Le classement « saison » n'a aucune fenêtre · L

- **Où.** `src/server/classements/index.js` l. 100-101 : `depuis('saison')` rend
  une chaîne vide, et seule la période `mois` filtre.
- **Comment.** Le classement des supporters dit « saison » et additionne tout
  depuis toujours. Poser « SAISON 1 · 12 jours » au-dessus de lui, comme le prévoit
  (7), serait une phrase fausse.
- **Parade.** Une fenêtre `[lancee_a, fin)` de la saison en cours, comparée **en
  SQL**. `lancee_a` et `quand` (`last_push_at`, `ended_at`) sont tous écrits par
  `NOW(3)`, donc la comparaison SQL est cohérente. Ou bien renommer l'onglet
  « depuis toujours ».
- **Test.** Dans `classement-smoke.mjs` : une ligne semée avant `lancee_a` (en
  SQL, `NOW(3) - INTERVAL 2 DAY`) ne compte pas dans la période `saison`.

### E7. Indice que la session MySQL de production n'est pas à l'heure de Zurich · B (sonde)

- **Où.** Le pavé de `wallet()` (`fanzzy/index.js` l. 157-175) raconte le minuteur
  « 64:28 » : `packs_at` était daté « d'une heure dans l'avenir ».
- **Comment.** Une valeur écrite par `NOW(3)` et relue à travers le pilote en
  `timezone: 'Z'` se décale exactement du décalage UTC de la session MySQL. Zurich
  est à UTC+2 en septembre. Une heure d'écart suggère donc une session à UTC+1, ce
  qui n'est pas Zurich. Ce n'est **qu'un indice**, mais il dit que le « jour » de
  `CURDATE()` change peut-être à 01:00 en été en production. Les quotas
  d'abonnement en dépendent déjà. C'est la raison de J1.
- **Parade.** La sonde de J1, avant toute décision sur le jour de jeu.

---

## 1. La triche

Le principe est déjà écrit dans le dépôt (`scripts/securite.mjs`, « le serveur ne
croit rien sur parole »), et `aide.recompenser()` en donne le modèle : le serveur
recompte, le drapeau se pose dans la transaction, et un `FOR UPDATE` tient les
deux onglets. Le chantier généralise ce modèle à toutes les sources de gain.

### T1. Un montant ou un jour reçu du client · B

- **Où.** Toutes les routes de réclamation à créer : mission, bonus, palier, saison.
- **Comment.** Une route qui lit `req.body.montant`, `req.body.jour` ou
  `req.body.mission` sans revérifier se règle depuis la console du navigateur.
- **Parade.**
  - La réclamation ne porte qu'un identifiant de ligne
    (`POST /api/quotidien/reclamer { id }`).
  - Le serveur relit la ligne **du joueur de la session** et recompte la
    progression depuis la base.
  - Il verse le montant **inscrit dans la ligne du jour** (voir T9).
  - Le jour vient de la base (voir J1), jamais de la requête.
- **Test.**
  - Ajouter un invariant n° 10 à `scripts/securite.mjs` : aucun
    `req.(body|query|params).(montant|echarpes|scarves|xp|packs|jour|date|recompense)`
    dans `src/server/`. Comme le § 6 avertit qu'un garde-fou qui lit le code au
    motif rétrécit sans bruit, le doubler d'un contrôle de comportement.
  - Dans la nouvelle suite `quotidien-smoke.mjs`, une réclamation dont le corps
    porte `{ montant: 9999, jour: '2020-01-01' }` verse exactement le montant de la
    ligne du jour.

### T2. Le double versement · B

- **Où.** Toute réclamation, et le versement de fin de saison.
- **Comment.** Deux onglets affichent RÉCUPÉRER. Un double clic. Un téléphone qui
  perd le réseau et renvoie la requête. Un script qui en envoie dix.
- **Parade.** Un **grand livre** des gains, avec sa clé d'idempotence **dans le
  `CREATE TABLE`** (voir M3) :

  ```sql
  CREATE TABLE IF NOT EXISTS recompenses (
    user_id  CHAR(36)    NOT NULL,
    source   VARCHAR(24) NOT NULL,   -- bonus, mission, palier, saison
    cle      VARCHAR(64) NOT NULL,   -- 2026-10-02, 2026-10-02:2, RP:10, saison:3
    echarpes INT         NOT NULL DEFAULT 0,
    packs    SMALLINT    NOT NULL DEFAULT 0,
    xp       INT         NOT NULL DEFAULT 0,
    verse_a  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (user_id, source, cle),
    KEY idx_source_date (source, verse_a)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  ```

  Le versement se fait dans une transaction : un `INSERT` simple (pas
  `INSERT IGNORE`, qui avale aussi les troncatures et les erreurs de type), puis le
  crédit de la bourse, puis le `COMMIT`. Un `ER_DUP_ENTRY` répond 200 avec
  `{ verse: false, raison: 'deja' }`, et la page l'affiche comme « déjà
  récupéré », pas comme une erreur. L'XP passe ensuite par `niveau.gagner()`
  corrigé (E2), après le `COMMIT`, comme le fait `openPack`. Ce grand livre sert
  aussi à (8) et à la détection (T10).
- **Test.** Dans `quotidien-smoke.mjs`, `Promise.all` de deux puis de dix
  réclamations identiques donne **un** crédit et un solde monté **exactement** du
  montant. Mutations : retirer la clé primaire, ou sortir l'`INSERT` de la
  transaction. Les deux doivent rougir.

### T3. Une écriture déclenchée par un GET · L

- **Où.** La génération des missions du jour, la marque de dernière visite (8) et
  la marque « vu » (2).
- **Comment.** Le cookie est en `SameSite=Lax`
  (`auth/routes.js` l. 47) : il part sur toute navigation GET de premier niveau.
  Un aperçu de lien, un préchargement ou un lien piégé peuvent donc faire avancer la
  marque de visite. Le joueur ne voit alors jamais son ticket « depuis hier ».
- **Parade.**
  - Aucun gain ne se verse sur un GET.
  - La marque de visite et la marque « vu » avancent par un `POST` que la page
    envoie **après** avoir affiché.
  - La génération paresseuse des missions sur GET est admise : elle est
    idempotente (T5) et ne verse rien.
- **Test.** Dans `quotidien-smoke.mjs`, un GET sur chaque nouvelle route ne change
  ni la bourse, ni le grand livre, ni la marque de visite.

### T4. L'horloge du téléphone · L

- **Comment.** Changer la date du téléphone est la triche classique des bonus
  quotidiens dans les jeux mobiles.
- **Parade.**
  - Le serveur décide seul du jour.
  - La page reçoit des **durées**, jamais des instants : `resteMs` jusqu'au
    prochain jour, ou jusqu'à la fin de la saison.
  - Elle décompte avec `performance.now()`, qui est monotone, et relit à
    `visibilitychange`, parce qu'un téléphone en veille gèle les minuteries.
  - À zéro, elle relit le serveur au lieu de conclure seule.
- **Test.** Dans `quotidien-smoke.mjs`, avec l'horloge MySQL figée (voir § 7), une
  réclamation du lendemain est refusée tant que la base n'a pas changé de jour,
  quoi que dise la requête.

### T5. Recharger la page pour tirer d'autres missions · L

- **Comment.** Si les missions sont tirées à chaque lecture, recharger la page
  donne de nouvelles missions. Si elles sont tirées à la première lecture du jour,
  deux onglets ouverts à minuit écrivent deux tirages, et
  `INSERT IGNORE` par rang les **mélange**, jusqu'à poser la même mission deux fois.
- **Parade.** Un tirage **déterministe** dont la graine est le hachage de
  `(user_id, jour)`. Tous les onglets calculent alors les mêmes missions, et les
  écrire une ou deux fois revient au même. La ligne garde une **copie** de la cible
  et du gain (voir T9).
- **Test.** Dans `quotidien-smoke.mjs`, cinq GET parallèles au premier passage du
  jour donnent les mêmes missions partout, et exactement autant de lignes que de
  missions.

### T6. Une mission qui paie la répétition ou la qualité du geste · B

- **Où.** Le catalogue des missions à écrire.
- **Comment.** `src/server/repetition/index.js` le dit en toutes lettres : la salle
  « ne paie rien », le client y renvoie ce qu'il veut, et « tricher à la
  répétition, c'est se priver de la répétition ». Une mission qui la compterait
  ferait de la triche un revenu. Une mission « fais 10 PARFAIT » pousserait aussi à
  automatiser le geste. Le moteur refuse déjà un geste trop régulier, mais le gain
  en ferait une cible.
- **Parade.** Les sources de mission forment une **liste fermée** de ce que le
  serveur établit seul : un booster ouvert, un duel joué (`duel_results`), un
  Virage vécu (`virage_presence`), une évolution, une carte-souvenir. On compte la
  **participation**, pas la qualité. Le cadre « RÉPÉTER UN GESTE › » du hub reste un
  lien, jamais une mission.
- **Test.** Dans `quotidien-smoke.mjs`, chaque mission du catalogue déclare une
  source prise dans la liste fermée. Aucune source n'est `repetition`, et aucune
  ne compte une note de geste.

### T7. Comptes jetables, parrainage, pot de KOP · L

- **Comment.** Le SMTP est en mode console (`ETAT.md` § 6) : la vérification de
  l'adresse ne bloque rien, et créer des comptes ne coûte rien. Les écharpes ne
  passent pas d'un compte à l'autre (`JURIDIQUE.md` § 3). Le seul conduit entre
  comptes est donc le pot du KOP, alimenté par les duels.
- **Parade.**
  - Aucun gain pour une inscription, un parrainage ou un ami ajouté.
  - Aucune récompense nouvelle ne verse au pot d'un KOP.
  - Le bonus de départ reste `pack.depart`, sans s'empiler avec un bonus du jour
    à J0.
- **Test.**
  - `scripts/verif-cablage.mjs` vérifie que le module des récompenses ne reçoit ni
    `kop` ni `amis`.
  - `quotidien-smoke.mjs` vérifie qu'aucune source n'est `ami` ni `parrainage`.

### T8. Collusion en duel classé · S

- **Comment.** Un joueur se fait gagner par un second compte pour remplir une
  mission « gagne un duel classé », ou pour monter un palier de rang.
- **Parade.** Les missions comptent « joue », pas « gagne contre un humain ». Les
  paliers de rang ne paient rien d'échangeable (voir L3). Le plafond de 5 duels
  classés par jour borne déjà l'effet.

### T9. Un réglage changé en cours de journée · L

- **Comment.** Gaël baisse la cible d'une mission à 14 h. Un joueur « prêt » ne
  l'est plus, ou bien l'écran annonce 30 écharpes et le serveur en verse 20.
  `src/server/bourse.js` décrit exactement cette faute : « un écran qui annonce un
  nombre et un serveur qui en applique un autre ».
- **Parade.** La ligne du jour **copie** la cible et le gain au moment du tirage.
  Un réglage changé s'applique le lendemain, et le texte d'aide du réglage le dit.
  Le bonus quotidien copie son montant de la même façon, au premier passage du
  jour.
- **Test.** Dans `quotidien-smoke.mjs`, changer le réglage après le tirage ne
  change pas ce que la réclamation verse aujourd'hui. Le lendemain (horloge
  figée), le nouveau montant s'applique.

### T10. Aucun moyen de couper une source de gain sans livrer · B

- **Comment.** Un abus découvert un samedi soir ne doit pas attendre une
  livraison.
- **Parade.**
  - Chaque source a son interrupteur au registre (`quotidien.actif`,
    `missions.actif`, `paliers.actif`, `saison.recompense_actif`).
  - Un **plafond global par joueur et par jour** sur les écharpes de toutes les
    sources nouvelles réunies sert de disjoncteur.
  - Les montants sont bornés serré par `min` et `max` : `valider()` refuse, et
    `resoudre()` retombe sur la valeur par défaut. Une borne haute basse limite donc
    aussi une faute de frappe dans l'administration.
  - Tout se lit par `reglage()` à chaque appel, jamais par une constante prise au
    démarrage (c'est la leçon de `bourse.js`).
  - Côté détection, une requête d'administration somme le grand livre par source
    et par jour : un pic s'y voit.
- **Test.**
  - `reglages-smoke.mjs` : chaque source nouvelle a son interrupteur dans une
    section déclarée.
  - `quotidien-smoke.mjs` : l'interrupteur à `false` fait refuser la réclamation
    (code nommé) sans rien verser, et le plafond journalier arrête le cumul au
    montant prévu.

### T11. Fin de saison payée deux fois, ou sur un classement qui bouge encore · L

- **Comment.** Le jeu n'a aucune tâche périodique, et c'est un choix (voir l'en-tête
  de `kop/index.js`). La clôture sera donc paresseuse, déclenchée à la première
  lecture après la fin. Deux lectures simultanées referaient la faute de E4. Un
  joueur qui joue entre la fin et cette première lecture changerait encore le
  classement.
- **Parade.**
  - Clôture idempotente :
    `UPDATE saisons SET close_a = NOW(3) WHERE id = ? AND close_a IS NULL`, puis
    `affectedRows === 1`.
  - Un **instantané** du classement calculé sur `quand < fin`, écrit une fois.
  - La récompense est **réclamée** par chacun à sa prochaine visite, avec la clé
    `(user_id, 'saison', id)`. Payer dix mille joueurs dans la requête qui clôt
    serait une requête de plusieurs minutes.
- **Test.** Dans `admin-smoke.mjs`, ou dans une suite de saison : trois lectures
  concurrentes après la fin donnent un seul instantané. Une partie jouée après la
  fin ne change pas le rang figé. Deux réclamations donnent un seul versement.

---

## 2. Le jour qui change

### J1. Trois horloges pour dire « aujourd'hui » · B

- **Où.** Le dépôt mélange déjà trois définitions du jour :
  - `CURDATE()`, le fuseau de la session MySQL : quotas d'abonnement
    (`abonnement/index.js` l. 285 et 308) ;
  - `UTC_DATE()` : deck (`deck/index.js` l. 370, 522, 539) et `api_quota` ;
  - `toISOString()`, donc l'UTC côté Node : le télétexte.

  Le § 6 d'`ETAT.md` pose la règle : « l'étiquette et le contenu doivent sortir du
  même repère ».
- **Comment.** Les missions du jour, le bonus et la série doivent tomber d'accord
  avec les quotas. Une mission « joue 3 duels classés » doit compter les mêmes
  lignes que « duels classés restants : 2 ». Si l'une suit `CURDATE()` et l'autre
  minuit à Zurich calculé dans Node, il existe chaque nuit une heure où l'écran dit
  deux choses contradictoires. Et E7 laisse penser que `CURDATE()` n'est pas minuit
  à Zurich en production.
- **Parade.**
  1. **Une sonde au démarrage**, journalisée et rendue lisible (dans `/healthz` ou
     à l'administration) :
     `SELECT @@session.time_zone, @@system_time_zone, TIMEDIFF(NOW(), UTC_TIMESTAMP())`.
     Elle annonce « le jour de jeu change à HH:MM, heure de Zurich ».
  2. **Une seule définition** pour les quotas, les missions, le bonus et la série :
     celle de la base. `CURDATE()` est lu et comparé **en SQL** uniquement. Les clés
     du grand livre s'écrivent `DATE_FORMAT(CURDATE(), '%Y-%m-%d')` dans la requête
     même. Jamais de jour calculé en JavaScript.
  3. Si Gaël veut minuit à Zurich exactement, il faut basculer **quotas et missions
     ensemble** vers un jour calculé dans Node avec
     `Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich' })`, puis vérifier au
     démarrage que l'ICU de Node connaît ce fuseau. **Jamais l'un sans l'autre.** Et
     ne pas fixer `time_zone` par session : toutes les colonnes déjà écrites par
     `NOW(3)` changeraient de sens.
- **Test.** Dans `quotidien-smoke.mjs`, avec l'horloge figée à 00:30 puis à 23:59
  (§ 7), « duels classés restants » et la progression de la mission « duels
  classés » comptent les mêmes lignes.

### J2. Minuit pile · L

- **Comment.** Le joueur voit sa mission prête à 23:59:58, et sa réclamation arrive
  à 00:00:01. Le serveur cherche alors la ligne du nouveau jour, qui n'est pas
  accomplie.
- **Parade.** La réclamation porte l'identifiant de **la ligne**, et la ligne porte
  son jour. Une ligne d'hier se refuse avec un code nommé
  (`quotidien.error.jour_passe`), que la page traduit par « les missions d'hier
  sont closes », avant de relire. Rien n'est écrit. Et un message vague ne doit pas
  remplacer celui-là (`ETAT.md` § 2 : « les messages d'erreur doivent nommer la
  cause »).
- **Test.** Dans `quotidien-smoke.mjs` : tirage à 23:59:59 avec l'horloge figée,
  réclamation à 00:00:01. On attend un refus nommé, une bourse inchangée et les
  missions du nouveau jour à la relecture.

### J3. Les deux dimanches de bascule d'heure · L

- **Quand.** Le 25 octobre 2026 dure 25 heures, le 28 mars 2027 en dure 23.
- **Comment.** `Date.now() + 86 400 000` se trompe d'une heure ces jours-là, et
  `floor(ms / 86 400 000)` donne un jour UTC. Plus discret :
  `TIMESTAMPDIFF(SECOND, NOW(), CURDATE() + INTERVAL 1 DAY)` compte en **heure
  murale**. Le 25 octobre à 00:30, il annonce 23 h 30 alors qu'il reste 24 h 30.
- **Parade.**
  - Le reste du jour se calcule par
    `UNIX_TIMESTAMP(CURDATE() + INTERVAL 1 DAY) - UNIX_TIMESTAMP()`. La conversion
    en époque applique la règle d'heure d'été du fuseau de session.
  - La série se calcule sur des valeurs `DATE` (`DATEDIFF`, ou
    `= CURDATE() - INTERVAL 1 DAY`), qui ignorent la durée du jour.
- **Test.** Dans `quotidien-smoke.mjs`, horloge figée au 2026-10-25 00:30 sur la
  base de test locale, qui est à l'heure de Zurich (`SYSTEM`) : le reste vaut
  88 200 s, à la seconde près. Une série prise le 24 et reprise le 25 continue. Une
  série reprise le 27 recommence.

### J4. Le piège d'`abo:smoke`, une troisième fois · L

- **Comment.** Une suite qui sème « aujourd'hui » avec `new Date()` à travers le
  pool en `timezone: 'Z'` écrit de l'UTC. Le serveur, lui, compte avec
  `CURDATE()`. Entre minuit et deux heures, les deux ne parlent plus du même jour
  (`ETAT.md` § 2). `abo:smoke` n'est toujours pas corrigé.
- **Parade.**
  - Les nouvelles suites sèment **en SQL** (`NOW(3)`, `CURDATE()`,
    `NOW(3) - INTERVAL 1 DAY`), comme le serveur écrit.
  - Elles **figent l'horloge MySQL** plutôt que d'attendre la bonne heure : voir
    § 7.
  - Elles tournent exprès deux fois, à midi et à 00:30.
- **Test.** Le contrôle du contrôle : après avoir figé l'horloge, la suite vérifie
  que `SELECT NOW()` rend bien l'instant figé. Sinon le décor ment, et tout le
  reste est vert pour rien.

### J5. Une colonne `DATE` relue en JavaScript · L

- **Comment.** En `timezone: 'Z'`, mysql2 rend une `DATE` comme un minuit UTC, et
  `jourISO()` (`src/shared/jour.js`) en lit les composantes **locales**. C'est juste
  à l'est de Greenwich et faux à l'ouest. Le jour où le processus Node tourne avec
  un autre `TZ`, toutes les dates de mission reculent d'un jour sans bruit.
- **Parade.** Les colonnes `jour` se lisent par `DATE_FORMAT(jour, '%Y-%m-%d')` et
  se comparent en SQL. Aucun objet `Date` pour un jour.
- **Test.** `quotidien-smoke.mjs` se lance une seconde fois avec
  `TZ=America/Montreal` (à vérifier sur le poste Windows, où Node lit `TZ` par
  ICU). Il doit rester vert. Un jour calculé en JavaScript le ferait rougir.

### J6. La série de jours et ses deux onglets · L

- **Parade.** Une seule instruction conditionnelle, qui est atomique et
  idempotente :

  ```sql
  UPDATE user_wallet
     SET serie_jours   = IF(serie_dernier = CURDATE() - INTERVAL 1 DAY, serie_jours + 1, 1),
         serie_dernier = CURDATE()
   WHERE user_id = ? AND (serie_dernier IS NULL OR serie_dernier < CURDATE())
  ```

  Ensuite, `affectedRows === 1` signifie « premier passage du jour ». **L'ordre des
  deux affectations compte** : MariaDB les évalue de gauche à droite, et la seconde
  voit le résultat de la première. Les inverser remettrait la série à 1 tous les
  jours.
- **Test.** Dans `quotidien-smoke.mjs` : deux onglets donnent une seule
  incrémentation. Trois jours de suite donnent J3, puis un trou d'un jour remet à
  J1 (ou consomme le joker, si Gaël le retient). Mutation : inverser les deux
  affectations, et la suite rougit.

### J7. La date de fin d'une saison · L

- **Comment.** `lancee_a` est écrite par `NOW(3)` (`admin/index.js` l. 619). Calculer
  « encore 12 jours » en JavaScript à partir d'elle, c'est E5. Et une fin saisie
  « 31/10 » sans heure ni fuseau ne dit pas quel instant elle désigne.
- **Parade.**
  - La fin se saisit avec une heure, **interprétée à Zurich** par l'écran
    d'administration, et s'envoie en instant ISO.
  - Elle est écrite par le pilote, relue par le pilote, et comparée à
    `UTC_TIMESTAMP(3)` ou à `Date.now()`. C'est la seconde ligne du tableau du
    § 4 quater.
  - La route publique rend une durée (`finDansMs`), jamais un instant à interpréter.
- **Test.** Dans `admin-smoke.mjs`, une fin saisie « 31/10/2026 23:59, heure de
  Zurich » ressort de la route publique avec la durée attendue, à la seconde près,
  l'horloge Node étant figée.

---

## 3. La base de production et le déploiement

### M1. Deux ordres de déploiement coexistent · B

- **Où.** Le workflow GitHub (`scripts/deployer.sh`) enchaîne `git reset`,
  `npm ci`, **le schéma**, puis le redémarrage. Le Manager d'Infomaniak (`git pull`,
  `npm ci`, `node build.mjs`) **n'applique jamais le schéma** : `DEPLOIEMENT.md` dit
  « Déploie, puis applique ». Or la dernière mise en ligne est passée par le
  Manager (`A-DEPLOYER.md` : `"version": null`).
- **Comment.** Les deux situations arrivent donc :
  - **ancien code sur nouveau schéma**, pendant la fenêtre du workflow ;
  - **nouveau code sur ancien schéma**, jusqu'à ce que quelqu'un applique le
    fichier après un passage par le Manager.
- **Parade.**
  - Le nouveau schéma est **additif** : des tables neuves, des colonnes `NULL` ou
    avec `DEFAULT`, rien de renommé, rien de supprimé, et aucun `NOT NULL` sans
    défaut. Les `INSERT` de l'ancien code doivent continuer de passer.
  - Le nouveau code tourne **sans** ses tables. Une route d'affichage rend
    `disponible: false`, et la ligne disparaît de la page. Pour une route de
    versement, voir M2.
  - `A-DEPLOYER.md` nomme le fichier à appliquer, et le premier geste après le
    Manager est `npm run schema:appliquer`.
- **Test.** `quotidien-smoke.mjs` a une phase « base sans le nouveau fichier » : les
  nouvelles routes répondent 200 avec `disponible: false`, rien n'est écrit, et
  `/api/fanzzy/state` comme `/api/niveau` restent intacts. Puis, dans l'autre
  sens, le fichier appliqué, `fanzzy-smoke`, `niveau-smoke`, `abo:smoke` et
  `nvn-net-smoke` restent verts.

### M2. Un versement possible sans son grand livre · B

- **Comment.** La posture du dépôt est qu'« une table absente n'enlève rien »
  (`niveau/index.js`, `abonnement/index.js`). Elle est juste pour les **droits**.
  Pour l'**argent**, elle s'inverse. Une réclamation qui verserait sans pouvoir
  inscrire au grand livre paierait à chaque clic.
- **Parade.** Sans table `recompenses`, aucun versement : une erreur de schéma
  dans la transaction annule tout et répond `{ verse: false, raison: 'schema' }`.
  C'est le modèle d'`aide.recompenser()`, qui replie `paye` à **vrai** pour ne rien
  promettre.
- **Test.** Dans `quotidien-smoke.mjs`, sur une base sans la table, dix
  réclamations ne versent rien.

### M3. Une clé d'idempotence absente sans que rien le dise · B

- **Où.** `src/server/auth/schema.js` contrôle les tables et les colonnes, mais
  seulement sous la forme `ALTER TABLE … ADD COLUMN IF NOT EXISTS`, **une colonne
  par `ALTER`**. Une deuxième colonne dans le même `ALTER` n'est pas vue, à cause de
  la façon dont l'expression régulière avance. Il ne contrôle **aucun index**.
- **Comment.** Une clé ajoutée après coup (`ALTER … ADD UNIQUE`, `CREATE INDEX`)
  peut manquer en production pendant que `/healthz` répond `ok: true`, et les
  doubles versements reviennent sans bruit. Et `CREATE TABLE IF NOT EXISTS` ne
  corrige pas une table déjà créée par un brouillon sans la clé.
- **Parade.**
  - La clé primaire figure dans le `CREATE TABLE` d'origine, et un brouillon n'est
    jamais appliqué en production.
  - Un `ALTER` par colonne.
  - Au démarrage, `SHOW KEYS FROM recompenses WHERE Key_name = 'PRIMARY'` doit
    rendre `(user_id, source, cle)`. Sinon, versements fermés et message nommant le
    fichier, dans la ligne de `schema.js`.
- **Test.** `schema-smoke.mjs` vérifie par `information_schema.statistics` la clé
  primaire de chaque table de versement. Mutation : retirer la clé du fichier, et la
  suite rougit.

### M4. Un rattrapage rejoué à chaque déploiement · L

- **Comment.** Le workflow rejoue **tout** `sql/` à chaque mise en ligne. Un
  rattrapage non borné, du genre « tout ce qu'on possède est déjà vu », effacerait
  à chaque déploiement le NOUVEAU de ce qui vient d'être gagné. Le précédent est
  `sql/etats.sql`, borné par une date écrite en dur (mémoire du projet).
- **Parade, pour (2).** Pas de rattrapage du tout. On écrit l'**événement au moment
  du gain**, dans une table `nouveautes (user_id, sorte, item)` remplie dans la
  même transaction que le gain et vidée quand la page dit « vu ». Ce qui existait
  avant n'a pas de ligne, donc n'est pas nouveau. Pas de mur de NOUVEAU au
  lancement, et rien à rejouer. Il y a une seconde raison : `user_skins` n'a aucune
  date, et les cartes d'action vivent dans un JSON sans date (`user_wallet.action_cards`).
  Un « nouveau = acquis après ma dernière visite » n'a donc pas de quoi se calculer
  pour elles.
- **Le revers.** Chaque chemin qui donne quelque chose doit écrire sa nouveauté :
  `openPack`, `tirerAutreChose`, l'arrivée (`onboarding`), l'étal de la boutique,
  `evolve`, les souvenirs. Un chemin oublié rend une absence silencieuse, et
  « une liste incomplète a l'air d'une liste » (`ETAT.md` § 6).
- **Test.**
  - `schema-smoke.mjs` applique le nouveau fichier **deux fois** et compare les
    deux états.
  - Une suite, `fanzzy-smoke` ou `collection-smoke`, fait passer un gain par
    chacun des chemins et vérifie la ligne de nouveauté. Pour ne pas rétrécir au
    motif, elle importe la liste des chemins depuis le module plutôt que de la lire
    à l'expression régulière.

### M5. Le fichier SQL hors de l'ordre · L

- **Parade.** Inscrire le fichier dans `scripts/ordre-schema.mjs`, après
  `souvenirs` (`user_wallet`), `saisons` et `aide`, avec sa raison écrite au-dessus.
  `schema:smoke` refuse déjà un fichier absent de la liste. `DEPLOIEMENT.md` et
  `A-DEPLOYER.md` le nomment aussi.

### M6. Des pages neuves servies par l'ancien processus · L

- **Où.** `scripts/deployer.sh` fait le `git reset` **avant** `npm ci`, le schéma et
  le redémarrage.
- **Comment.** Pendant cette minute, l'ancien Node sert les **nouveaux** fichiers de
  `public/` (`express.static` lit le disque) à un serveur qui n'a pas les nouvelles
  routes. Le service worker, lui, sert le code depuis le réseau d'abord.
- **Parade.**
  - Une page traite un 404 ou un champ absent comme « la ligne disparaît ».
    Jamais comme zéro : pas de « J0 », pas de « 0 mission », pas de jauge vide.
    Jamais non plus comme une erreur affichée.
  - Quand c'est possible, la route est livrée un déploiement **avant** la page qui
    s'en sert.
- **Test.** Dans les suites d'interface du lot (l'accueil, le kiosque), une route
  neuve qui répond 404 ne laisse à l'écran ni « 0 », ni « J0 », ni erreur en
  console.

### M7. Ce qui vit en mémoire disparaît au redémarrage · S

- **Comment.** Salles du Virage, salles de duel, réglages, saisons : tout est en
  mémoire d'**un** processus. Un déploiement pendant un match vide la tribune et
  perd le bilan (10). Si Infomaniak lançait un jour deux instances, un réglage
  changé à l'administration ne serait rechargé que dans l'une.
- **Parade.** Le bilan de tribune se construit de ce qui est déjà écrit
  (`virage_presence`), complété par la mémoire de la salle. Sa ligne disparaît si
  la mémoire manque. Livrer en dehors des heures de match. Noter dans `ETAT.md`
  que le jeu suppose une instance unique.

### M8. L'effacement d'un compte ne touche pas les nouvelles tables · L

- **Où.** `auth/store.js` `deleteUser()` anonymise la ligne `users` et ne la
  supprime pas. Les `ON DELETE CASCADE` ne jouent donc **jamais**.
- **Parade.** Ajouter à `deleteUser` la suppression des lignes du joueur dans les
  tables de nouveautés, de missions, de série et de dernière visite. Le grand livre
  reste : il est rattaché à une ligne anonyme, et il sert de preuve comptable du
  jeu.
- **Test.** `auth-smoke.mjs` supprime un compte et vérifie qu'il ne reste aucune
  ligne à son nom dans les nouvelles tables, sauf `recompenses`.

---

## 4. La performance

Le pool compte **huit connexions** (`auth/db.js`). Une requête lente ne coûte pas
seulement son temps : elle retient une connexion dont la fin d'un duel ou
l'écriture d'une poussée au Virage ont besoin.

### P1. Une requête lourde de plus sur vingt écrans · B

- **Où.** Le HUD replié de la barre, présent sur vingt écrans, et le hub, l'écran
  le plus vu. `GET /api/rank/moi` (`classements/index.js` l. 484) lance cinq
  agrégats sur l'union de `virage_presence` et `duel_results`, **sans cache**.
- **Comment.** Une pastille de rang, une mission et une série chacune sur sa route
  feraient trois ou quatre appels de plus par page vue. Et `/api/rank/moi` sur le
  hub, c'est l'agrégat le plus lourd du jeu à chaque retour à l'accueil.
- **Parade.**
  - **Une route par écran, pas une par pastille.** `GET /api/quotidien` regroupe
    missions, bonus, série, saison et « depuis ta visite » en quelques requêtes
    indexées sur `(user_id, jour)`.
  - Un mémo par joueur de 30 s, cohérent avec le cache de 30 s en
    `sessionStorage` prévu côté page.
  - **Jamais** `/api/rank/moi` depuis le hub ni la barre. Le rang du hub et son
    delta se lisent dans l'instantané quotidien (P2).
- **Test.** Dans `quotidien-smoke.mjs`, un pool instrumenté compte les requêtes :
  `/api/quotidien` en fait au plus six, et aucune au second appel dans les 30 s.
  `scripts/verif-pages.mjs` refuse `/api/rank/moi` dans `index.html` et `nav.js`.

### P2. Le delta de rang par double agrégat · L

- **Comment.** Calculer le rang d'hier en relançant l'agrégat avec une borne double
  la requête la plus lourde.
- **Parade.** Un instantané quotidien,
  `rangs_du_jour (jour, tableau, user_id, rang, valeur)` avec la clé
  `(jour, tableau, user_id)`. Il est écrit par le premier calcul du jour, avec un
  `INSERT IGNORE` sur les cinquante premiers. Le delta est alors une lecture sur
  clé. Hors des cinquante premiers, pas de delta : la ligne disparaît. La cote
  avant et après d'un duel existe déjà (`elo_before`, `elo_after`) et ne demande
  rien de plus.
- **Test.** Dans `classement-smoke.mjs`, deux lectures le même jour donnent une
  seule écriture. Le lendemain (horloge figée), le delta vaut le rang d'hier moins
  celui d'aujourd'hui.

### P3. L'avatar ligne à ligne, et la ruée à l'expiration du cache · L

- **Où.** `memo()` de `classements/index.js` (l. 41-47) garde la **valeur** du
  classement pendant cinq minutes.
- **Comment.** À l'expiration, toutes les requêtes qui arrivent pendant le calcul
  relancent l'agrégat. Ajouter l'avatar ligne par ligne ferait en plus cinquante
  requêtes de plus.
- **Parade.**
  - `avatarsDe()` par lot (deux requêtes), **à l'intérieur** du mémo.
  - Le niveau par la même jointure sur `user_wallet.xp`.
  - Le mémo garde la **promesse** et non la valeur, pour qu'un seul calcul tourne à
    la fois.
- **Test.** Dans `classement-smoke.mjs`, le nombre de requêtes est le même pour
  cinq et pour cinquante lignes. Dix lectures simultanées après expiration
  déclenchent un seul calcul.

### P4. Les nouveautés qui s'accumulent · S

- **Comment.** Jusqu'à cinq lignes par booster, pour un joueur qui ne regarde
  jamais son classeur.
- **Parade.** Les lignes sont vidées à la lecture, avec un plafond par joueur (les
  deux cents plus récentes) et une purge au-delà de soixante jours.
- **Écriture de « vu ».** La marque « vu » s'envoie en un `POST` de lot (corps
  borné par `express.json({ limit })`). Ce `POST` compte dans le seau des écritures
  du garde de débit (80 par minute).

### P5. Mille bilans à la même seconde · L

- **Comment.** À la fin d'un match, toute la tribune reçoit son bilan au même
  instant.
- **Parade.** Le bilan se calcule depuis la salle en mémoire, avec **une** requête
  groupée par salle, et jamais une par joueur.
- **Test.** Dans `virage-smoke.mjs`, le nombre de requêtes du bilan ne dépend pas
  de l'effectif. `scripts/virage-loadtest.mjs` donne l'ordre de grandeur.

### P6. La présence par socket sur chaque page · L

- **Comment.** Aujourd'hui, seules cinq pages ouvrent une socket. Une présence
  « en ligne » par socket l'imposerait aux vingt-quatre écrans. Chaque navigation
  ouvrirait alors une connexion et un `findSession`, et ferait clignoter
  « hors ligne » entre deux pages.
- **Parade.** La présence se **dérive** de ce que le serveur sait déjà en mémoire
  (salles du Virage, `salleDe` du duel). Une marque d'activité HTTP écrite au plus
  une fois par minute, par un `UPDATE` conditionnel, s'y ajoute. Le tout est lu
  **à la demande** par `/api/amis`, avec un délai de 60 s avant « hors ligne ».
  Aucune socket de plus.
- **Test.** Dans `amis-smoke.mjs`, un ami en duel apparaît « en duel ». Sorti, il
  passe hors ligne après le délai, et pas avant.

### P7. La cote relit tout l'historique à chaque fin de duel · S

- **Où.** `nvn/index.js` l. 1030 lit toutes les lignes classées des joueurs, sans
  `LIMIT`, à chaque fin de duel. Ce coût croît sans fin.
- **Parade.** `ORDER BY ended_at DESC LIMIT 1` par joueur, plus un `COUNT(*)` sur
  l'index `idx_user_sorte`, ou une cote courante rangée à part. Si (4) ajoute un
  second événement `nvn:cote` après l'écriture, il en hérite.

### P8. Une écriture de plus par geste au Virage · B

- **Comment.** `souvenirs.recordPush()` écrit déjà une ligne par poussée, pour
  potentiellement mille supporters. Une mission ou un « meilleur geste » (10) qui
  ajouterait sa propre écriture doublerait la charge de la boucle chaude.
- **Parade.**
  - La progression d'une mission « Virage » se lit à la lecture, sur
    `virage_presence`, qui est déjà agrégée par match.
  - Le meilleur geste monte dans **la même** instruction que la poussée, par une
    colonne `GREATEST(meilleur, VALUES(meilleur))`. Jamais une seconde
    instruction.
- **Test.** Dans `virage-smoke.mjs`, le nombre de requêtes par poussée reste à un.

---

## 5. La vie privée

### V1. Les classements sont publics · L

- **Où.** `/api/rank/supporters`, `/tribunes` et `/duellistes` sont servis **sans
  connexion** (`classements/index.js` l. 967-995).
- **Comment.** L'avatar et le niveau y deviennent visibles depuis tout internet.
  Le pseudo est déjà public (`CONFIDENTIALITE.md`), mais ni le personnage ni le
  niveau ne le sont à ce jour. Le public comprend des mineurs (`JURIDIQUE.md` § 4).
- **Parade.**
  - Une **liste blanche** des champs : l'objet `avatar` seul (`id`, `age`, `evo`,
    `skin`, `etat`, `rar`, `nom`) et le niveau. Ni `enJeu`, ni `tenuesParAge`
    (c'est la garde-robe), ni l'XP exacte.
  - Seulement les comptes `status = 'active'`.
- **Test.** Dans `classement-smoke.mjs`, une ligne n'a que les clés de la liste
  blanche, et un compte supprimé n'apparaît pas.

### V2. La page d'un KOP se lit sans en être membre · L

- **Où.** `GET /api/kop/:id` (`kop/index.js` l. 408) demande une session, pas
  l'appartenance au KOP.
- **Parade.** L'avatar peut s'y ajouter : c'est ce que montre déjà un classement.
  La présence, non. Si elle doit y figurer un jour, elle ne part que vers un
  lecteur membre du KOP.
- **Test.** Dans `kop-smoke.mjs`, un non-membre reçoit les membres sans aucun champ
  de présence.

### V3. La présence : la donnée la plus sensible du lot · B

- **Comment.** Elle dit quand quelqu'un joue. « Au stade » dirait même **quel
  match**. Le module des amis a déjà posé la frontière : la différence entre « on
  se croise au stade » et « je sais où tu vas le week-end » (`amis/index.js`,
  en-tête).
- **Parade.**
  - Présence visible des **amis mutuels** seulement.
  - Trois états grossiers : en ligne, en duel, au Virage, sans dire lequel.
  - Aucun « vu il y a 3 h ».
  - Rien d'écrit en base.
  - Un réglage du tiroir pour apparaître hors ligne. Pour un public mineur, la
    visibilité par défaut est une décision à prendre avec Gaël (voir L5).
- **Test.** Dans `amis-smoke.mjs` : un non-ami ne reçoit aucune présence, un joueur
  caché apparaît hors ligne à ses amis, et aucune réponse ne porte d'horodatage de
  présence.

### V4. « Depuis ta dernière visite » · L

- **Parade.**
  - Le ticket ne raconte que ce qui appartient au joueur (souvenirs, gains du grand
    livre) et ce que ses amis ont fait **avec lui** (« Lucas t'a rejoint »).
  - La marque est une colonne écrasée, pas un historique de connexions. Elle est
    avancée par un `POST` (T3) et comparée en SQL (`NOW(3)`).
  - Le « +120 écharpes » ne se calcule **que** sur le grand livre. Une différence
    de solde mentirait dès la première dépense.

### V5. La politique de confidentialité ne décrit pas ces données · L

- **Parade.** Mettre à jour `CONFIDENTIALITE.md`, « En jouant » :
  - ce qui devient visible publiquement : pseudo, club principal, personnage
    affiché, niveau ;
  - ce qui est visible des amis : la présence ;
  - ce qui est conservé : dernière visite, série, gains quotidiens, avec leurs
    durées.

  Le texte promet de ne pas changer en silence.

---

## 6. Le juridique

`JURIDIQUE.md` tient sur trois propriétés : l'argent n'achète que l'abonnement ;
l'abonnement achète une **cadence**, et « rien n'est réservé à l'abonné, ni carte,
ni série, ni taux » ; les écharpes ne s'achètent pas et ne s'échangent pas. Un gain
gratuit, sans mise, ne crée pas de jeu d'argent au sens où le dossier pose la
question. Ce qui la rouvrirait, c'est un lien, même indirect, entre un paiement
et le nombre ou la valeur des tirages.

### L1. Une récompense modulée par l'abonnement · B

- **Comment.** Un bonus doublé pour l'abonné, une mission de plus, une série
  protégée : chacun ajoute des boosters, donc des tirages, à qui paie. La question
  n° 2 du dossier (« l'abonnement accélère un tirage ») s'élargit alors sans que le
  juriste l'ait vue.
- **Parade.**
  - Récompenses **identiques** pour tous.
  - Le module des récompenses ne reçoit pas `abonnement`.
  - Aucun réglage `abo.*` ne touche `quotidien.`, `missions.`, `paliers.` ni
    `saison.`.
- **Test.**
  - `abonnement-smoke.mjs` l. 472 : ajouter ces quatre préfixes à `interdits`.
  - `verif-cablage.mjs` : `createQuotidien` ne reçoit pas `abonnement`.
  - `quotidien-smoke.mjs` : un abonné et un non-abonné reçoivent la même chose pour
    les mêmes missions.

### L2. Une mission hors de portée du joueur gratuit · B

- **Comment.** Sans abonnement, le jeu plafonne à 5 duels classés par jour, 2
  Virages comptés et le 1 contre 1 en classé (`abo.duels_classes_jour`,
  `abo.virages_classes_jour`, `abo.taille_classe_libre`). Une mission « 6 duels
  classés » ou « gagne un 2 contre 2 classé » ne se remplirait qu'en payant.
  L'abonnement achèterait alors des récompenses, et donc des boosters.
- **Parade.** La cible de chaque mission reste sous le plafond gratuit de son
  activité, ou la mission compte aussi l'entraînement et le hors-classement. Le
  contrôle se fait au chargement du catalogue des missions, contre les réglages
  **vivants**. Si Gaël baisse un plafond, la mission concernée se désactive au
  lieu de devenir payante.
- **Test.** Dans `quotidien-smoke.mjs`, pour chaque mission, la cible est inférieure
  ou égale au plafond gratuit lu par `reglage()`. Avec `poserReglages()` qui abaisse
  un plafond, la mission sort du tirage.

### L3. Une récompense de classement sur un cumul · B

- **Comment.** Le classement des supporters **additionne** la ferveur (E6). Le
  non-abonné n'a que 2 Virages comptés par jour, l'abonné n'a pas de plafond. Un
  gain au **rang** de fin de saison, ou un palier de rang (5) qui paie en écharpes
  ou en boosters, se gagnerait donc en partie en payant. C'est la règle « jamais de
  la puissance » appliquée au butin. Et le jour où le lot serait réel (un maillot,
  une place), ce serait un concours où le paiement augmente les chances : à ne pas
  faire sans le juriste.
- **Parade.**
  - Les récompenses de saison se donnent par **paliers atteignables dans les
    plafonds gratuits** (« atteins 2 000 de ferveur »), identiques pour tous.
  - Au rang, seulement de l'honneur : badge, titre, dos de carte.
  - Aucun lot réel.
- **Test.** Dans le test de saison, une récompense de type `rang` ne contient ni
  `echarpes` ni `packs`, et chaque palier se franchit en N jours avec les seuls
  plafonds gratuits (le nombre se calcule à partir des réglages).

### L4. Plus de boosters gratuits mis en scène · S

- **Comment.** La question n° 3 du dossier (afficher les taux) devient plus
  pressante dès que le bonus et les missions offrent des boosters avec cérémonie.
  `RATES` est dans le code, rien ne l'empêche techniquement.
- **Parade.** Ajouter la question au dossier, et proposer l'affichage au kiosque.

### L5. Mécaniques d'assiduité et public mineur · S

- **Comment.** Série de jours, « tu vas perdre ta série », compte à rebours,
  récompense croissante : ce sont des mécaniques de rétention que les autorités de
  protection des mineurs regardent de près. Le jeu est ouvert aux mineurs sans
  barrière (`JURIDIQUE.md` § 4).
- **Parade.**
  - Une série **non punitive** : le palier atteint reste, avec un joker par
    semaine si Gaël le veut.
  - Aucune offre payante accrochée à la série ni au bonus (pas de « rattraper ta
    série »).
  - Aucune notification.
  - Le mode calme est respecté.
  - La question va au dossier du juriste. Ce n'est pas un avis : c'est la
    question à poser.
- **Test.** Dans `boutique-smoke.mjs`, aucun article ne livre `serie` ni `joker`,
  et `verifierCatalogue()` le refuse.

### L6. Un futur « pass de saison » payant · S

- **Comment.** `LIVRAISONS_PAYANTES = {'abonnement'}` (`src/shared/boutique.js`
  l. 165). Un pass payant qui ouvrirait une piste de récompenses contenant des
  boosters rouvrirait la question des coffres payants **sans** que `packs` entre
  dans la liste blanche. Le contrôle nommé ne rougirait donc pas.
- **Parade.** Une piste de récompenses n'est jamais payante. Si elle doit le
  devenir, elle passe par `LIVRAISONS_PAYANTES` et par `JURIDIQUE.md`.
- **Test.** Dans `boutique-smoke.mjs`, aucune livraison payante n'ouvre une source
  du module des récompenses.

### L7. Les écharpes, et les billets figés · L

- **Parade.** Les nouvelles sources versent des écharpes non échangeables et non
  convertibles, qui ne vont jamais au pot d'un KOP (T7). **Aucune** ne crédite
  `user_wallet.billets` : cette colonne porte de l'argent réel figé
  (`JURIDIQUE.md` § 3).
- **Test.** Dans `securite.mjs`, aucune écriture de `billets` hors de
  `src/server/boutique/`.

---

## 7. Les tests : comment les écrire ici

- **Une suite neuve, `scripts/quotidien-smoke.mjs`** (missions, bonus, série,
  « depuis ta visite », grand livre), inscrite dans `package.json` sous
  `quotidien:smoke`. `tout-tester.mjs` lit les scripts de `package.json` : une suite
  non inscrite ne tourne jamais. La saison s'éprouve dans `admin-smoke.mjs`, ou dans
  une suite de saison. Les points (1) à (4), (9) et (10) s'éprouvent dans les suites
  existantes de leur module : `niveau`, `fanzzy`, `nvn-net`, `classement`, `kop`,
  `amis`, `virage`.
- **La base.** `baseDeTest()` et `OPTIONS_BASE` (dont `timezone: 'Z'`), le verrou,
  et aucune suite en parallèle. Depuis un worktree, vérifier d'abord que la copie
  principale ne fait rien tourner (mémoire du projet). La fin s'écrit
  `process.exitCode`, pas `process.exit()` (`ETAT.md` § 2).
- **Semer comme la production.**
  - Les dates s'écrivent en SQL (`NOW(3)`, `CURDATE()`), exactement comme le
    serveur. Une table `saisons` semée avec **la seule série RP lancée** reproduit
    l'état réel. Sans saison chargée, le code tourne « tout ouvert », et les paliers
    de collection paraissent lointains alors qu'ils se franchissent le premier jour
    en production (17 cartes atteignables).
- **Figer l'horloge de la base.** Proposition d'un utilitaire dans
  `base-de-test.mjs` :
  - il pose `SET @@session.timestamp = UNIX_TIMESTAMP(?)` sur chaque connexion
    prise par le pool de la suite (événement `acquire` du pool sous-jacent) ;
  - `SET @@session.timestamp = DEFAULT` relâche l'horloge ;
  - `NOW()`, `CURDATE()`, `UNIX_TIMESTAMP()` et les `DEFAULT CURRENT_TIMESTAMP`
    suivent.
  
  Les modules reçoivent le pool de la suite, donc tout le serveur monté par la suite
  vit à l'heure figée. **Contrôle du contrôle** : `SELECT NOW()` rend l'instant
  figé. Les instants à éprouver :
  - 12:00 ;
  - 00:30 (le piège d'`abo:smoke`) ;
  - 23:59:59 puis 00:00:01 (J2) ;
  - le 2026-10-25 à 00:30 (25 h) et le 2027-03-28 à 00:30 (23 h).
- **Deux onglets.** Une aide `enParallele(n, () => post(...))` qui lance n fois la
  même requête avec le même cookie, puis compare le solde **à la valeur exacte**.
  Jamais « supérieur à zéro » (E1).
- **Exécuter aussi sous un autre fuseau Node.** Une seconde passe avec
  `TZ=America/Montreal` (J5).
- **Muter pour voir rougir.** Chaque test d'un risque B se casse exprès, selon le
  tableau ci-dessous. Un contrôle qu'aucune mutation ne fait rougir ne protège
  rien (`ETAT.md` § 2).

| risque | mutation | le contrôle qui doit rougir |
|---|---|---|
| E1 | retirer la garde de `fermer` | `nvn-smoke` : `fermer` deux fois donne un seul versement |
| E2 | retirer le `FOR UPDATE` | `niveau-smoke` : palier versé une fois (crochet de test ou vingt répétitions) |
| T1 | lire `req.body.montant` | `securite` n° 10, et le versement exact |
| T2 | retirer la clé primaire, ou sortir l'`INSERT` de la transaction | `quotidien-smoke` : dix réclamations donnent un crédit |
| T6 | ajouter une source `repetition` | `quotidien-smoke` : liste fermée des sources |
| T10 | ignorer l'interrupteur | `quotidien-smoke` : interrupteur coupé, rien versé |
| J1 | compter la mission avec un jour calculé en JavaScript | `quotidien-smoke` à 00:30 : mission et quota ne s'accordent plus |
| J3 | `TIMESTAMPDIFF` à la place d'`UNIX_TIMESTAMP` | `quotidien-smoke` le 25/10 : 88 200 s |
| J6 | inverser les deux affectations | `quotidien-smoke` : J3 attendu, J1 rendu |
| M2 | verser sans grand livre | `quotidien-smoke` phase sans table : bourse inchangée |
| M3 | retirer la clé du `CREATE TABLE` | `schema-smoke` : clé primaire attendue |
| P1 | appeler `/api/rank/moi` depuis le hub | `verif-pages` |
| P8 | une seconde instruction par poussée | `virage-smoke` : une requête par poussée |
| V3 | servir la présence à un non-ami | `amis-smoke` |
| L1 | un réglage `abo.quotidien_*` | `abo:smoke` : préfixes interdits |
| L2 | une cible à 6 duels classés | `quotidien-smoke` : cible ≤ plafond gratuit |

---

## 8. Ordre conseillé

1. **E1 et E2**, avec leurs tests. Ils viennent avant (1) : le point (1) affiche
   justement ce que ces deux défauts faussent.
2. **La sonde du fuseau et le choix du jour de jeu (J1).** Ils viennent avant (6) et
   (7). La décision de « minuit à Zurich » revient à Gaël, au vu de la sonde.
3. **Le grand livre, les interrupteurs et le plafond (T2, T10, M2, M3).** Ils
   viennent avant tout versement nouveau : (5), (6), (7).
4. Les dix points, dans l'ordre de rendement de la synthèse :
   - (2) par l'événement au gain (M4) ;
   - (3) avec la liste blanche (V1) ;
   - (4) par un second événement de cote et l'instantané (P2) ;
   - (5) par série et en nombres absolus : un palier en pourcentage reculerait à
     chaque saison ouverte ;
   - (6) ;
   - (7) avec E6 et J7 ;
   - (8) ;
   - (9) par dérivation (P6, V3) ;
   - (10) sans écriture de plus (P8).
5. **E3 et E4** quand on veut, mais avant un bonus qui donne des boosters, et
   avant d'enrichir la page du KOP.
6. **Les documents** : `CONFIDENTIALITE.md` (V5), `JURIDIQUE.md` (L1 à L6),
   `A-DEPLOYER.md` (le fichier SQL à appliquer après le Manager), `DEPLOIEMENT.md`
   (l'ordre du schéma), et `ETAT.md` § 6 (les pièges nouveaux).

## 9. Ce que je n'ai pas pu vérifier

- **Le fuseau de la session MySQL de production.** Je n'ai qu'un indice (E7) ;
  c'est l'objet de la sonde.
- **L'hébergement Node d'Infomaniak.** Je ne sais pas s'il tourne en instance
  unique (M7), ni si son ICU connaît `Europe/Zurich`, ce qui ne compte que si l'on
  choisit le jour de Node (J1).
- **Figer l'horloge à travers le pool de mysql2.** Que `SET @@session.timestamp`
  posé sur l'événement `acquire` précède toujours la requête de la suite est à
  vérifier par le contrôle du contrôle (J4).
- **Les défauts de la section 0** sont établis par la lecture du code, sans aucune
  exécution, faute d'avoir le droit de lancer une suite. Pour E1, la logique est
  sans ambiguïté : deux appels de `fermer` sur le chemin du forfait, et aucune garde.
