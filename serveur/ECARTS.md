# Écarts au plan et au contrat — chantier serveur, vague 1

Chaque périmètre écrit ici ce qu'il a fait autrement que `PLAN.md` ou
`CONTRATS.md`, et pourquoi. Un écart qui touche un champ du contrat le dit en
premier.

---

## `socle` (2 octobre 2026)

**Aucun champ de `CONTRATS.md` ne change.** `verser()` rend la forme R6 et les
raisons de la liste fermée du § 11. Les écarts ci-dessous touchent le schéma
(`PLAN.md`, § 3) et des précisions de comportement du grand livre (§ 5) que
les autres périmètres doivent connaître.

### 1. Pas de clé étrangère vers `users` sur les trois tables du joueur

**Plan** : `missions_jour`, `compteurs_jour` et `user_nouveautes` portent
`FOREIGN KEY (user_id) … users(public_id) ON DELETE CASCADE`.

**Fait** : aucune clé étrangère (comme `recompenses`, qui n'en avait déjà pas).

**Pourquoi.** Chaque suite vide la base au démarrage avec sa propre liste de
`DROP TABLE`, et une fille de `users` absente de cette liste fait échouer le
DROP de `users` — la suite entière tombe avant son premier contrôle (c'est la
panne du jour de `parrainages`, `schema-smoke` la garde). Vingt-huit suites
nomment `users` sans couper les clés étrangères, dont quinze n'appartiennent à
aucun périmètre de la vague (`accueil-ui-smoke`, `amis-ui-smoke`,
`boosters-ui-smoke`, `deck-smoke`, `deck-ui-smoke`, `equipes-ui-smoke`,
`fanzzy-ui-smoke`, `football-smoke`, `kop-ui-smoke`, `nvn-ui-smoke`,
`onboarding-smoke`, `stades-smoke`, `teletext-smoke`, `virage-loadtest`,
`virage-ui-smoke`) : avec la clé, `npm test` rougissait dès que `schema:smoke`
avait posé les tables, sans que personne dans la vague puisse le corriger.

**Ce qu'on perd** : la cascade, qui ne sert pas en production (un compte
supprimé est anonymisé, jamais effacé : `deleteUser` retire nommément ses
lignes de ces trois tables, vérifié par `auth:smoke`) ; et le refus d'une ligne
au nom d'un joueur inexistant (toutes les écritures prennent l'identifiant de
la session).

**Pour les autres périmètres** : une suite qui supprime une ligne de `users`
(`DELETE FROM users …`) ne vide plus ces tables par cascade ; ses lignes restent,
orphelines et sans effet. Une suite qui veut ces tables vides les vide elle-même.

**Garde** : `schema-smoke` vérifie qu'aucune des quatre tables n'a de clé
étrangère, et son contrôle « chaque suite qui vide la base emporte les tables
filles » rougit si on la remet (mutation faite : deux rouges).

### 2. `verser()` rejoue une fois une course perdue

**Ajout** au § 5 : sur `ER_CHECKREAD` ou `ER_LOCK_DEADLOCK`, la transaction
(entièrement annulée) est rejouée une fois depuis le début.

**Pourquoi.** MariaDB 11.6 et après (`innodb_snapshot_isolation`, allumé par
défaut ; le poste de développement tourne en 12.3) signalent par
`ER_CHECKREAD` la course que les versions d'avant signalaient par
`ER_DUP_ENTRY` à l'INSERT. La version de la production n'est pas connue d'ici.
Rejoué, le versement voit la ligne de l'autre à l'étape 2 et rend `deja`.
`recompenses-smoke` joue la course dans les deux modes.

**Conséquence pour `quotidien`, `fanzzy`, `classement`** : `verifier(conn)` et
`gain(conn)` peuvent être appelés **deux fois** pour un même versement. Ils ne
doivent que **lire**, sur la connexion donnée. Une écriture faite dedans serait
faite deux fois, ou une fois sans versement.

### 3. Précisions de comportement du grand livre (dans l'esprit du plan)

- **La bourse s'ouvre avant la transaction** (`assurerBourse`), puis le
  `FOR UPDATE`. Dans la transaction, `INSERT IGNORE` sur une bourse existante
  pose un verrou partagé ; deux versements simultanés du même joueur
  s'interbloquaient en demandant ensuite le verrou exclusif.
- **Le disjoncteur compte le versement lui-même** : refus si
  `déjà versé aujourd'hui + ce gain > plafond`, dimension par dimension. Une
  dimension que le gain ne touche pas ne bloque jamais : une division (gain
  nul) passe toujours, même au plafond. Juste au plafond, ça passe
  (60 + 40 = 100 pour un plafond de 100).
- **`verifier` peut rendre** `incomplet`, `inconnu`, `change`, `jour_passe`
  et aussi `inactif` (un interrupteur relu sous le verrou). Toute autre valeur,
  `false` compris, **lève** : c'est une faute de l'appelant, pas un refus.
- **Le gain est contrôlé** : quatre clés au plus (`echarpes`, `packs`, `xp`,
  `tampons`), entiers ≥ 0 ; une clé absente vaut 0, une clé inconnue lève
  (`echarpe: 30` ne doit pas verser zéro en silence). Des boosters sans
  `recharger`, de l'XP sans `niveau.gagnerDans` : lève, avant toute écriture.
- **Un joueur sans ligne `users`** : `{ verse: false, raison: 'inconnu' }`,
  rien d'inscrit.
- **`verserTout`** : `reste` n'est présent que s'il vaut au moins 1 (R1) ; s'il
  n'y avait rien à verser, la raison est la première rencontrée (`deja`,
  `plafond`…), et `incomplet` pour une liste vide ; un refus `schema` arrête
  la liste. Un élément refusé pour une autre raison est passé.
- **Le contrôle de démarrage** vérifie la clé primaire des **quatre** tables de
  `quotidien.sql` et les nomme ; seule celle de `recompenses` ferme les
  versements. `grandLivreFerme()` (exporté par `auth/schema.js`) vaut `null`
  tant que le contrôle n'a pas vu de faute — une suite qui monte un module sans
  `server.js` verse donc normalement.

### 4. Les aides de test (`scripts/base-de-test.mjs`)

- `figerHorloge(pool, instant)` : `instant` est une chaîne
  `'AAAA-MM-JJ HH:MM[:SS[.mmm]]'` lue **à l'heure murale de la base**, un
  nombre de secondes Unix, un `Date`, ou `null` pour relâcher. Rend l'instant
  figé en secondes. Elle intercepte `getConnection` du pool sous-jacent : toute
  connexion rendue par le pool (y compris par la file d'attente) reçoit l'heure
  voulue. **Une connexion déjà tenue** (transaction ouverte) garde son heure
  jusqu'à ce qu'elle soit rendue. L'horloge de Node n'est pas figée.
- `enParallele(n, fn)` : lance `fn(0)…fn(n-1)` dans le même tour de boucle,
  attend qu'ils soient **tous** finis, rend les résultats dans l'ordre, ou lève
  la première erreur une fois tout terminé.

### 5. Deux faits trouvés en chemin, hors de ma main

- **Le booster de l'abonnement est livré à la souscription, pas à chaque
  échéance** (`PLAN.md`, § 6.1, disait « à l'échéance »).
  `boutique/index.js` le crédite au paiement qui ouvre l'abonnement ;
  `abonnement/index.js`, `renouveler`, ne fait que prolonger la fin.
  `JURIDIQUE.md` décrit ce que fait le code. Si Gaël voulait un booster par
  échéance, c'est un changement de code (hors vague), et le dossier du juriste
  serait à relire.
- **`sql/couleurs.sql` porte un ALTER à trois `ADD COLUMN`** (`color1`,
  `color2`, `colors_at`) : le contrôle de démarrage ne voit que `color1`. Hors
  de tout périmètre ; à aiguiller.

---

## `niveau` (2 octobre 2026)

**Aucun écart.** L'objet `niveau` suit `CONTRATS.md` § 1 champ pour champ
(l'exemple du contrat, 470 + 20, est un contrôle de `niveau-smoke` à la
virgule près), et `gagnerDans(conn, userId, montant)` a la signature de
`PLAN.md` § 5 et § 6.2. Ce qui suit précise le comportement, pour les
appelants.

### `gagnerDans(conn, userId, montant)` — la porte du grand livre

- `conn` : une connexion `mysql2/promise`, **transaction ouverte par
  l'appelant**. Elle n'ouvre, ne valide ni n'annule rien.
- `montant` : un **entier ≥ 0**. Autre chose (2.5, −1, `"20"`, `NaN`) **lève**
  en nommant la valeur : le grand livre inscrit son gain tel quel, l'XP
  créditée doit être exactement celle de sa ligne. À **0**, rien n'est lu ni
  écrit et elle rend **`null`** (pas de jauge sans gain ; `verser` ne l'appelle
  de toute façon qu'avec `xp > 0`).
- **La bourse doit exister** : sans ligne `user_wallet`, elle lève (« aucune
  bourse… l'appelant l'ouvre (assurerBourse) avant sa transaction »). `verser`
  l'ouvre déjà à l'étape 1.
- Elle lit `SELECT xp … FOR UPDATE` (le verrou que `verser` tient déjà est
  repris sans attendre), écrit XP et écharpes de palier en une requête, et rend
  l'objet du § 1. **Toute erreur remonte telle quelle, `code` compris**
  (`ER_BAD_FIELD_ERROR` pour la colonne `xp` absente) : c'est l'appelant qui
  annule.
- `paliers` est une **copie** des entrées de `PALIERS` (on peut la retoucher
  sans changer la table du jeu).

### `gagner(userId, montant)` — la porte des boosters et des duels

- Même calcul, dans **sa** transaction (`assurerBourse` avant, puis
  `beginTransaction`, `gagnerDans`, `commit`). Ne lève jamais.
- **Crédité** : l'objet du § 1, avec `gain > 0`. **Pas crédité** (montant nul,
  schéma incomplet, base indisponible) : l'objet vide d'avant, à l'identique
  (`{ xp: 0, niveau: 1, avant: 1, monte: false, paliers: [], ecarpes: 0 }`),
  **sans `gain`**. C'est à `gain` (ou à `xp`) qu'un appelant reconnaît un gain
  qui a eu lieu, et le contrat veut alors `niveau` absent de la réponse.
  `nvn/index.js` (`Number(m?.gain) > 0`) et `fanzzy/index.js` (`monte?.xp`)
  le lisent déjà ainsi.
- **Jamais depuis une transaction qui tient la bourse du même joueur sur une
  autre connexion** : `gagner()` attendrait ce verrou (cinquante secondes,
  puis un gain perdu). Qui tient une transaction appelle `gagnerDans()` avec
  sa connexion. Aujourd'hui, le kiosque et le duel appellent `gagner()` après
  leur `COMMIT` : c'est juste.

### Pour les suites

`createNiveau({ pool, requireAuth, crochets: { apresLecture } })` :
`apresLecture({ userId, xp, montant })` est attendu entre la lecture et
l'écriture ; il sert à rendre une course certaine. Aucun crochet en
production.

---

## `social` (2 octobre 2026)

**Aucun champ de `CONTRATS.md` ne change.** `membres[]` de `GET /api/kop/:id`
porte `avatar` et `niveau` (§ 3) ; `amis[]`, `recues[]`, `envoyees[]` de
`GET /api/amis` et chaque suggestion portent `niveau`. Le reste précise le
comportement, dans l'esprit du plan (§ 6.7).

### 1. Un compte effacé n'a plus de visage chez les amis non plus

**Contrat** (§ 3) : « Ailleurs (membres d'un KOP), un compte supprimé garde
sa ligne, mais avec `avatar: null` et sans `niveau` ».

**Fait** : la même règle chez les amis. Une amitié survit à la suppression
d'un compte (il est anonymisé, pas effacé) ; la ligne reste, sous le pseudo
anonyme, avec `avatar: null`, **`fanzzy: null`** et sans `niveau`. Le statut
est lu dans les deux requêtes qui existent (`tableau`, `suggestions`) : aucune
requête de plus. Le parrain d'un lien d'invitation (`parrainDe`, route
publique) n'est pas touché.

**Pourquoi** : « on ne montre jamais le personnage d'un compte effacé » ; la
liste d'amis le montrait.

### 2. La page du KOP applique la même règle de saison que le Virage

**Plan** : `modsDe` ignore un bonus de saison acheté avant le lancement de la
saison en cours, ou dont la saison est finie.

**Fait** : la règle est écrite une fois (`bonusActifs`) et lue par `modsDe`
**et** par `etat()` : un bonus éteint n'apparaît plus dans `bonus[]` de
`GET /api/kop/:id`. Sinon la page l'aurait montré « actif » sans qu'il agisse.
Sans aucune saison lancée, il agit comme avant. Sans `saisons.fin_le` ou sans
la table `saisons`, lecture d'avant, et le journal le dit une fois.

### 3. Deux corrections voisines, dans les mêmes fichiers

- `kop_bonus.epuise` s'écrit par `NOW(3)` (il recevait un `Date` de Node à
  travers le pool, donc l'heure UTC ; règle 2 du plan). Personne ne lit cet
  instant aujourd'hui ; contrôle ajouté, mutation faite.
- `amis` : si `user_wallet.xp` manque (`sql/niveau.sql` pas passé), la liste
  se lit sans niveau au lieu de tomber, et le journal le dit une fois.

### 4. Pour les autres périmètres et les écrans

- `depouillerEchus(kopId)` rend **seulement** les votes que cet appel a
  appliqués (un vote dépouillé au même instant par un autre regard n'y est
  pas), et l'événement `kop:votes` part une fois par vote.
- La carte des visages d'un KOP est gardée 60 s **avec la liste des membres
  qu'elle habille** : un arrivant a son visage tout de suite ; un changement
  de Fanzzy, ou une suppression de compte, se voit au plus une minute après.
- `vote.fermeDansMs` est désormais juste après un rechargement (il valait
  deux heures et trois minutes sur une base à l'heure de Zurich) ; `vote.ferme`
  reste servi tel quel et ne doit servir à aucun calcul (R4).

### 5. Ce que C6 ouvre, à trancher par Gaël

Un bonus de saison voté **après la fin de la saison** (date passée, saison
suivante pas encore lancée) est payé 5 000 écharpes et n'agit jamais. Avant
C6, il agissait pour toujours. `proposer()` ne le refuse pas : il faudrait un
code d'erreur nouveau (`kop.error.saison_finie`), une chaîne d'interface et un
écran qui le dise. Hors du plan ; à décider.

### 6. Le KOP ne vend plus que ce que le Virage applique (3 octobre 2026)

**Aucun champ de `CONTRATS.md` ne change.** `catalogue` (servi par
`GET /api/kop/miens` et `GET /api/kop/:id`, hors contrat) garde sa forme, mais
pas son contenu : 5 bonus au lieu de 7. Le fait d'un vote dépouillé (retour de
`depouillerEchus`, événement `kop:votes`) gagne un booléen `horsVente`.

**Constat** (`SERVEUR.md`, § 11.3, relevé par la relecture des écrans) :
« La quête » (`scarvesBonus`, 900) ne fait rien, aucun code ne lit la clé.
**Vérifié, et il y en a un second** : « Mur de bâches » (`parryBonus`,
`parryResist`, 500) n'agit pas davantage. Un bonus de KOP n'arrive qu'au
Virage (`ferveur/index.js`, seul appelant de `modsDe`), et ni le Virage ni le
duel ne lisent les deux clés du contre : elles ne figurent que dans des listes
de composition (`avecLieu`, `ages.js`) et dans les fiches des Fanzzy.

**Fait** (`src/server/kop/index.js`, seuls mes fichiers) : le serveur ne vend
que les bonus dont le Virage lit **chaque** clé (`MODS_DU_VIRAGE` :
`pushMult`, `breathBonus`, `tempoWindow`, `ferveurBonus`).
- `catalogue` sert `EN_VENTE` : la page du KOP perd les deux bonus dans
  PROPOSER UNE DÉPENSE **et** dans la fenêtre de crans du pot, sans changer
  une ligne de `kop.html`.
- `proposer()` les refuse avec le code qu'elle sait déjà dire,
  `kop.error.bonus_inconnu`.
- Un vote ouvert avant le déploiement (ou portant un identifiant que le
  catalogue partagé ne connaît plus) est rejeté sans débiter le pot,
  `horsVente: true`. Sans cette garde, un identifiant inconnu faisait tomber
  le dépouillement sur `def.portee`, donc toute lecture de ce KOP.
- Une ligne de `kop_bonus` achetée avant n'est pas active (`bonusActifs`) :
  ni dans `bonus[]`, ni dans ce que `modsDe` rend au Virage (le panneau des
  apports ne dit donc plus « Écharpes +25 % »), et elle ne se décompte pas.
  Elle reste en base telle quelle.
- `scripts/kop-smoke.mjs` confronte `MODS_DU_VIRAGE` au code de
  `src/server/ferveur/` dans les deux sens, et éprouve les quatre gardes ;
  chacune a été cassée exprès et son contrôle a rougi.

**À trancher par Gaël** (rien n'est décidé à sa place, et le catalogue
partagé `src/shared/kop.js` n'est pas touché) :
1. **Brancher ou retirer** « La quête » et « Mur de bâches ». Brancher
   `scarvesBonus` n'est pas une ligne : le Virage, seul à recevoir les
   bonus de KOP, ne verse **aucune** écharpe (rien dans `src/server/ferveur/`
   n'écrit `user_wallet`), et le duel, qui en verse
   (`src/server/nvn/index.js`), ne reçoit pas les bonus de KOP. Il faut donc
   soit que le duel les reçoive, soit que le Virage verse des écharpes ; puis
   ajouter la clé à `MODS_DU_VIRAGE` (ou à son pendant du duel) : le bonus
   revient en vente seul, et le contrôle rougit tant qu'on l'oublie. Le
   retirer, c'est l'ôter de `src/shared/kop.js` (fichier d'aucun périmètre
   de cette vague).
2. **Les KOP qui les ont déjà payés en production.** Requête de lecture :
   `SELECT kop_id, bonus_id, restant, achete FROM kop_bonus WHERE bonus_id IN
   ('echarpes','contres')`. Si la clé est branchée, leurs matchs restants
   agiront ; sinon, rendre le prix au pot est une décision (la règle « ce qui
   est versé est versé » vise les membres qui partent, pas un achat qui n'a
   rien livré).
3. **Le même défaut, hors du KOP** : `parryBonus` et `parryResist` sont
   portés par des dizaines de Fanzzy (`src/shared/fanzzy/dex*.js`), par des
   pièces d'équipement (`inventaire.js`) et par une carte d'action épique du
   duel, « Filet de chantier » (`src/shared/duel/actions.js`, « Pendant
   12 s, tu deviens très difficile à contrer », `parryResist: 1.8`). Aucun
   moteur ne les lit : les fiches les affichent, la carte coûte 30 de souffle
   et ne fait rien. Hors de ma main ; à aiguiller.

**Tranché le 6 octobre 2026, et fait : retirés, et remboursés** (points 1
et 2). **Aucun champ de `CONTRATS.md` ne change** ; `catalogue` sert
toujours 5 bonus.
- `src/shared/kop.js` ne les porte plus. Ce qui ne servait qu'à les tenir
  hors de vente part avec eux : `MODS_DU_VIRAGE`, `agit` et `EN_VENTE`
  n'existent plus, et `catalogue` sert `BONUS`. `proposer()` refuse un
  identifiant inconnu (`kop.error.bonus_inconnu`). Le dépouillement garde sa
  garde : un vote ouvert avant le déploiement est rejeté sans débiter le
  pot, `horsVente: true`, comme un identifiant que le catalogue n'a jamais
  connu. `bonusActifs` écarte toute ligne dont l'identifiant n'est plus au
  catalogue.
- Le prix est rendu par le serveur, à son démarrage (`rendreLesRetires`,
  appelé et attendu par `server.js` avant l'écoute). Une transaction par
  KOP : le pot sous verrou d'abord, comme au dépouillement ; puis chaque
  ligne `echarpes` ou `contres` devient `rendu:echarpes` ou `rendu:contres`,
  `restant` 0, épuisée (la date d'un épuisement antérieur est gardée) ; puis
  le pot reçoit 900 ou 500 par ligne. Toutes les lignes sont rendues, même
  celles que des matchs avaient décomptées avant le 3 octobre : ces matchs
  n'ont rien reçu. `verse_total` ne bouge pas, ce n'est pas un versement.
  Aucun changement de schéma : la marque tient dans `bonus_id`.
- Le journal dit une ligne par KOP remboursé (nom, identifiant, détail, pot
  avant et après), puis un bilan, ou « rien à rendre ». Un KOP en échec est
  annulé entier, nommé, et repris au démarrage suivant ; la fonction ne lève
  jamais.
- `kop-smoke` (« ce qui est en vente », « les retirés, rendus au pot » : un
  remboursement, un second démarrage qui ne rend rien, quatre démarrages
  simultanés, une panne entre la marque et le crédit, une base sans la
  table) et `cablage` (l'appel attendu, avant l'écoute) ; chaque contrôle a
  été cassé exprès et a rougi.

Le point 3 reste ouvert.

### 7. `couleurs` sur `GET /api/kop/club/:teamId` (servi, 3 octobre 2026)

**Aucun champ de `CONTRATS.md` ne change** (la route est hors contrat). C'est
la réponse au besoin `kop-amis` § 1 ci-dessous : la carte d'un club suivi
sans KOP n'avait jamais sa bâche, la route ne rendant que `kops`.

**Fait** (`src/server/kop/index.js`) : la réponse porte `couleurs` à la
racine, **de la forme de `/miens`** (une ou deux teintes `#rrggbb` en
minuscules, la principale d'abord, par la même `couleursDuClub`), et
**absent** quand aucune teinte n'est connue, pour un club inconnu ou un
identifiant qui n'est pas un entier (R1 : jamais `couleurs: []`). `kops`
ne change pas.

**Pas la jointure de `/miens`, et pourquoi.** Le cas visé est un club **sans
aucun KOP** : une jointure depuis `kops` n'y rend aucune ligne. Les couleurs
se lisent donc sur `teams` seul, par sa clé primaire (`couleursPour`), en
parallèle de la liste des KOP : une lecture de rien par carte de club, pas
une requête lourde. Sans `sql/couleurs.sql`, la route répond comme avant
(sans `couleurs`) au lieu de tomber, et le journal le dit une fois pour
`/miens` et `/club` ensemble.

**Éprouvé** (`scripts/kop-smoke.mjs`, par la vraie route) : un club sans KOP
aux couleurs connues, un club qui a un KOP (mêmes teintes que `/miens`), un
club sans couleur connue, un club inconnu, et la base sans `color2`. Trois
mutations faites en mémoire (route qui ne sert que `kops`, repli retiré,
`couleurs: []` servi) : chacune a fait rougir ses contrôles.

**Pour les vérifications du bac à sable** : `verif5/contrat.mjs` affirmait
« `/api/kop/club/:id` couleurs non servi » ; il doit désormais lire
`couleurs` quand le club en a.

---

## `classement` (2 octobre 2026)

**Aucun champ de `CONTRATS.md` n'est renommé ni retiré.** Les lignes de
`/api/rank/supporters`, `/duellistes`, `/entrainements` et les `joueurs[]` de
`/competition/:id` portent `avatar` et `niveau` (§ 3) ; les lignes de
`supporters?periode=saison` portent `division` (§ 5.2) ; `/moi` sert
`saison`, `saisonPassee`, `titres` et `evolution` (§ 4.2, § 5.2) ;
`POST /api/rank/division` répond selon R6. Ce qui suit précise des cas que le
contrat ne tranche pas, et une lecture du contrat à confirmer.

### 1. La saison en cours **finie** reste dans `saison`, jamais dans `saisonPassee`

**Contrat** (§ 5.2) : une division atteinte et non récupérée « reste
récupérable après la fin de la saison : elle apparaît alors dans
`saisonPassee` ». Et (§ 7.1) une saison dont la date est passée « reste « en
cours » jusqu'au lancement de la suivante ».

**Fait** : entre la date de fin et le lancement de la suivante, la saison est
toujours `saison` (sa liste SAISON est figée, `saison.rang` et `saison.sur`
restent servis pour la ligne épinglée), et ses divisions prêtes y restent
`pret`, récupérables là. Elle ne passe dans `saisonPassee` qu'au lancement de
la suivante. `saisonPassee` ne reprend donc jamais la saison en cours.

**Pourquoi** : sinon la même division serait servie deux fois (dans
`saison.paliers` et dans `saisonPassee`), et un « TOUT RÉCUPÉRER » la
compterait deux fois. C'est la lecture du carnet (`carnet.close`, § 6.1) :
une saison close mais encore « en cours » garde ses paliers dans son propre
bloc.

**Et** : quand la saison en cours est finie, `saison.prochaine` est **absent**
— sa ferveur ne bouge plus, « il te manque 58 750 » promettrait ce qui ne
peut plus arriver (R1). Le contrat ne le disait que pour Capo.

### 2. `prochaine` part de la division **tenue**, pas de la ferveur

Une division récupérée sous un seuil depuis relevé reste acquise (§ 5.2) :
`division` est la plus haute entre celle que la ferveur atteint au seuil du
moment et celle déjà récupérée. `prochaine` est la suivante de **celle-là**
(sinon on annoncerait « ULTRA, il te manque… » à qui porte déjà Ultra). C'est
`divisionSuivante` de `shared/saison.js` dans tous les autres cas. À ferveur
nulle, `division` est absente et `prochaine` vaut Sympathisant
(`seuil: 1, manque: 1`).

### 3. `titres[].saison` est l'**identifiant** de la saison

L'exemple du contrat (`"saison": 1`) ne dit pas si c'est l'`id` ou le
`numero`. C'est l'`id` (`recompenses.saison_id`), comme partout ailleurs dans
ce contrat (corps de `POST /division`, de `POST /quotidien/carnet`). Le
numéro est déjà dans le texte du titre (« Capo de la saison 1 »). `titres`
lit **toutes** les lignes du grand livre qui portent un `titre`, carnet
compris : `quotidien` doit donc copier le titre du palier dans la ligne
`carnet` qui le verse (le plan le prévoit, § 3), sans quoi « Revenu pour de
bon » n'apparaîtra pas.

### 4. La ligne `division` du grand livre : `insigne` = l'identifiant de la division

Le plan disait « la ligne porte l'insigne et le titre » sans en donner la
valeur, et le commentaire de la colonne cite `lisere | tampon` (le carnet).
**Fait** : `insigne` vaut `habitue`, `fervent`, `ultra` ou `capo` ; `titre`
vaut « Capo de la saison N » pour Capo seulement ; gain à quatre zéros
(`GAIN_NUL` du grand livre). **Pour `quotidien`** : lire les insignes du
carnet (liseré, tampon S1) en filtrant `source = 'carnet'`. *Fait le
3 octobre 2026 (quotidien § 11).*

### 5. `evolution` : précisions

- Absente quand une photo d'hier existe mais qu'aucune sous-clé ne peut se
  calculer (R1 : un `{ "depuis": … }` seul n'a rien à montrer).
- `ferveur.rang` ne se calcule que si les deux photos portent **la même
  saison** : le rang d'une saison neuve ne se compare pas à celui de la
  précédente. La photo garde l'`id` de la saison à côté du rang.
- `duels.rang` et `duels.cote` sont chacun présents dès que leurs deux valeurs
  existent ; `duels` est absent s'il n'en a aucun.
- Forme de `user_wallet.rangs_vus` :
  `{ "ref": { "jour", "rangs" } | null, "jour": { "jour", "rangs" } }`, où
  `rangs` vaut `{ saison, ferveur, duels, cote, entrainements }` (entiers ou
  `null`). L'écriture est conditionnelle en SQL (au plus une par jour et par
  joueur, deux onglets compris).

### 6. Les périodes et les cas sans saison

- `periode` inconnue : `saison` (avant : le cumul). Le mémo ne garde qu'une
  entrée par période connue.
- **Aucune saison lancée** (table présente, rien de lancé) : `periode=saison`
  sert le cumul, **sans** `division` ; `/moi` n'a pas de `saison`. C'est la
  posture de `fanzzy/saisons.js` (sans saison, le jeu tourne comme avant).
- **Schéma incomplet** (`saisons` ou `fin_le` absents) : même repli, dit une
  fois au journal ; `recompenses` absente : `/moi` sans `saison` ni `titres`,
  `POST /division` → `schema` ; `rangs_vus` absente : pas d'`evolution`.

### 7. `rang.actif` coupé

Littéralement le contrat (§ 5.2, « Absence ») : `saison` et `saisonPassee`
absents de `/moi`, `division` absent des lignes, `POST /division` →
`inactif`. **Conséquence pour l'écran** : sous l'onglet SAISON, la ligne
épinglée n'a plus `saison.rang` — elle ne montre alors pas de rang, plutôt que
le rang de tous les temps. Les `titres` restent servis : ils sont gagnés pour
toujours.

### 8. `habillerJoueurs(q, ids)` — pour `social`

`Map(id → { avatar?, niveau? })`, **une entrée par identifiant demandé**,
trois requêtes quel que soit leur nombre (bourse et statut, âges, tenues).
`avatar: null` : pas de Fanzzy équipé, compte non actif, ou identifiant
inconnu (et alors jamais de `niveau`). `avatar` **absent** : le catalogue
n'est pas chargé, ou une table manque — on ne sait pas, on ne dit rien.
`niveau` absent si l'XP est illisible (pas de bourse, colonne `xp` absente).
Une rareté hors de la liste fermée devient `null`. La liste blanche est
exportée (`AVATAR_PUBLIC`).

### 9. Un fait trouvé en chemin, hors de ma main

Le `rang` et le `sur` **de la racine** de `/moi` (tous les temps, sens
inchangé) comptent aussi les comptes supprimés : `maPlace` ne filtre pas le
statut, alors que la liste `supporters` le fait. Un compte effacé très
fervent fait donc lire « 4ᵉ » à quelqu'un qui est 3ᵉ de la liste TOUJOURS.
Je ne l'ai pas changé (le contrat garde le sens d'aujourd'hui) ;
`saison.rang` et `saison.sur`, eux, filtrent comme la liste. À trancher : la
correction tient en une condition dans trois requêtes de `maPlace`.

### 10. `tribune.couleurs` sur `GET /api/rank/moi` — servi (3 octobre 2026)

Réponse au besoin rendu par `profil-classement` (§ 1 de sa section, plus
bas). **Un champ de plus que le contrat**, aucun de changé : `tribune` porte
`couleurs` à côté de `id`, `nom` et `ferveur`. *Déclaré au contrat depuis
(`CONTRATS.md`, § 14.2 ; § 11 ci-dessous).*

```json
"tribune": { "id": 85, "nom": "Sion", "ferveur": 9860,
             "couleurs": ["#c8102e", "#ffffff"] }
```

- **Forme** : celle de `/api/kop/miens`, par la même fonction
  (`couleursDuClub(t.color1, t.color2)`, `kop/index.js`) — une ou deux
  teintes `#rrggbb` en minuscules, la principale d'abord ; une seconde égale
  à la première n'est pas servie.
- **Absent** (R1) quand le club n'a aucune teinte valide (blason pas encore
  extrait, valeur posée à la main qui n'est pas une teinte). Jamais de
  tableau vide. `tribune` reste `null` pour qui ne suit aucun club.
- **Quel club** : celui que `maPlace` choisissait déjà, le principal
  d'abord, puis le plus de ferveur. Le profil vérifie que c'est bien son club
  principal de `follows` avant de peindre ; il l'est dès qu'un club principal
  est posé.
- **Coût** : aucune lecture de plus. Les deux colonnes viennent de la
  jointure sur `teams` déjà faite (en `MAX`, hors du `GROUP BY`) ; le budget
  de `/moi` reste quinze et quatorze (`classement-smoke`).
- **Schéma incomplet** : sur une base où `sql/couleurs.sql` n'est pas passé,
  la tribune se relit sans couleurs (une lecture de plus, dans ce cas
  seulement) et le journal le dit une fois ; `/moi` ne tombe plus pour une
  teinte. Une autre colonne absente reste une panne.

### 11. Le contrat de `/moi` mis d'accord avec ce qui est servi (serveur-carnet, lot 4, 3 octobre 2026)

**L'écart** : `GET /api/rank/moi` servait des champs que `CONTRATS.md` ne
déclarait pas, et dont deux écrans dépendent — le profil (le buste et la
plaque de la carte de supporter, l'écharpe de tête, « SAISON 1 · 31 JOURS »)
et la ligne épinglée du classement :

| champ | servi par | au contrat avant ce jour |
|---|---|---|
| `avatar`, `niveau` à la racine | `monVisage` (`habillerJoueurs`, § 8) | nulle part : le § 3 ne nommait que les listes |
| `saison.fin`, `saison.joursRestants`, `saison.finie` | `blocSaison` (au sens du § 7.1) | nulle part : l'exemple du § 5.2 ne les portait pas |
| `tribune.couleurs` | § 10 ci-dessus | ici seulement |

Et les champs d'avant le chantier (`ferveur`, `matchs`, `rang`, `sur`,
`plancher`, `duels`, `entrainements`, `tribune`), que le contrat ne citait
que pour dire que `rang` et `sur` « gardent leur sens », sans leurs `null`.

**Fait** : le code n'est pas touché (`src/server/classements/index.js`
n'est pas de ce périmètre, et ce qu'il sert est juste). Le contrat le
déclare, sans rien renommer :

- **`CONTRATS.md`, § 14** : la réponse entière de `/moi` — la racine et ses
  `null` (§ 14.1), `tribune` et ses `couleurs` (§ 14.2), `avatar` et
  `niveau` avec leurs trois cas, objet, `null` ou absent (§ 14.3), la fin de
  la saison (§ 14.4) ;
- **§ 3** : une ligne de plus au tableau « Où », `GET /api/rank/moi` à la
  racine ;
- **§ 5.2** : `fin`, `joursRestants` et `finie` dans l'exemple et dans le
  tableau de `saison` ;
- **§ 10** : `profil.html` et `classement.html` lisent le § 14.

**Ce que le contrat dit, à relire par les écrans** :

- `avatar` **absent** (le serveur ne sait pas) n'est pas `avatar: null`
  (pas de Fanzzy) : le profil fait déjà la différence (`'avatar' in place`)
  et retombe sur la barre dans le premier cas seulement ;
- `/moi` ne sert pas `finDansMs` : le décompte à la seconde reste `/dex` ;
- `saisonPassee` ne porte ni `fin`, ni `joursRestants`, ni `finie` ;
- les insignes du carnet ne sont pas dans `/moi` : `GET /api/quotidien`,
  `insignes` (quotidien § 11).

**Restent ouverts**, hors de ce périmètre : le `rang` et le `sur` de la
racine comptent encore les comptes supprimés (§ 9, à trancher par Gaël) ;
deux commentaires des pages disent encore qu'elles liront `fin` et
`joursRestants` « le jour où ma place les portera »
(`classement.html` et `profil.html`) : ils les lisent déjà, et le serveur
les sert (besoin rendu à `profil-classement`).

---

## `saison` (2 octobre 2026)

**Aucun champ de `CONTRATS.md` n'est renommé ni retiré.** `saisonEnCours()`
porte les quatre champs du § 7.1 (`fin`, `finDansMs`, `joursRestants`
absents sans date de fin ; `finie` toujours, `false` sans date) ;
`saisonProchaine()` rend exactement les six champs du § 7.2, ou `null`.
`/dex` et `/state` servent `saisonEnCours()` sans y toucher : le § 7.1 y est
donc déjà, vérifié par `admin-smoke` à travers la vraie route `/dex`.

### 1. Un champ de plus sur la saison : `carnet`, seulement s'il est propre

**Contrat** (§ 7.1) : la saison « garde ses champs actuels et en ajoute
quatre ».

**Fait** : un cinquième, `carnet`, **présent seulement** quand la saison a
son propre carnet en base (absent : le carnet par défaut, R1). Forme
**saisie** normalisée : `[{ tampons, nom, echarpes, packs, insigne?, titre? }]`
(`titre: true` ; le titre est le nom).

**Pourquoi** : le plan fait lire le carnet par `carnetDe(saisonEnCours())`
(`quotidien`) et `carnetDe(s)` sur une saison passée. La saison doit donc le
porter, et le porter sous une forme qui survit à un `{ ...saison }`. Les
écrans l'ignorent ; il part dans `/dex` (public), ce qui ne dévoile rien que
`/api/quotidien` ne serve déjà aux joueurs.

### 2. `finDeFenetre(alias)` prend un alias SQL, pas un objet saison

**Plan** (§ 6.5) : `finDeFenetre(saison)`, « borne écrite en SQL ».

**Fait** : `finDeFenetre('s')` rend une **expression SQL** — la fin (exclue)
de la fenêtre de la ligne `s` de `saisons`, un DATETIME comparable à
`NOW(3)` : `LEAST(fin de fin_le, lancement suivant)`, avec
`9999-12-31 23:59:59` quand il n'y a ni l'un ni l'autre (une borne nulle
rendrait toute comparaison fausse). Plus `debutDeFenetre('s')` et
`dansLaFenetre('x.quand', 's')`. L'alias est vérifié (identifiant simple).

**Pourquoi** : un module pur ne lit pas la base, et une borne calculée en
JavaScript traverserait le pilote (`timezone: 'Z'`). `classement` et
`quotidien` l'emploient déjà sous cette forme.

**Pour qui l'interpole** : ``pool.execute(`…${finDeFenetre('s')}…`)`` est
une interpolation dans du SQL ; `npm run securite` la refuse sauf si le
commentaire qui précède porte le marqueur `sql-sur :` (règle 5 de
`scripts/securite.mjs`, fenêtre de 600 caractères avant l'appel).

### 3. Ajouts au module partagé et à `saisons.js`

- `divisionSuivante(ferveur, seuils?)` → `{ n, id, nom, seuil, manque }` ou
  `null` à Capo : la première division dont le seuil n'est pas atteint.
- `memeCarnet(a, b)`, `LIMITES_CARNET`, `CarnetInvalide` (code
  `admin.error.carnet_invalide`, `raison` qui nomme le palier).
- `carnetDe(saison)` rend la forme du contrat (§ 6.1) **sans `etat`** :
  `[{ n, tampons, nom, gain, insigne?, titre? }]`, `gain` à quatre clés,
  `titre` en texte. Objets neufs à chaque appel. Un carnet en base illisible
  retombe sur le défaut, dit une fois au journal.
- `seriesAnnoncees()` → `{ <série>: <numéro> }` pour `sets[].prochaine` :
  les séries de la saison annoncée **encore fermées** (règle d'ouverture du
  catalogue : union des saisons lancées, tout ouvert si elle est vide). Une
  série déjà ouverte ne « s'ouvre » pas à la saison suivante.
- `toutesLesSaisons()` rend des objets **neufs** à chaque appel (les durées
  bougent), habillés comme `saisonEnCours()` plus `ouvre` ; ce n'est plus le
  même tableau d'un appel à l'autre.

### 4. `joursRestants` : la relecture de minuit

**Contrat** (§ 7.1) : `joursRestants` peut se tromper d'un jour près de
minuit les dimanches de changement d'heure.

**Fait** : mieux que cela. Au chargement, la base mesure en une requête la
durée jusqu'à la fin de `fin_le`, l'écart en jours (`DATEDIFF`) et la durée
jusqu'à son prochain minuit ; Node décompte ensuite. Au **premier appel après
ce minuit**, la table est relue en arrière-plan (une requête par jour, une
seule à la fois, pas avant une minute après un échec). Le premier minuit
étant mesuré par la base, la valeur est juste à toute heure. Deux lectures
qui se croisent (celle de l'administration, celle de minuit) : seul un
résultat plus récent que le dernier posé est posé.

### 5. L'administration : trois refus de plus que le plan

Corps acceptés comme au plan : `fin_le`, `ouvre_le` (`AAAA-MM-JJ`, vide
pour effacer) et `carnet` (texte JSON, tableau, ou `{ paliers }` ; vide pour
le défaut). En modification, un champ **absent** ne touche à rien (un client
d'avant ces champs n'efface pas une date). Codes, chacun avec une `raison`
en français :

| code | statut | quand |
|---|---|---|
| `admin.error.date_invalide` | 400 | jour mal formé ou absent du calendrier (`2026-02-30`), hors 2000–2100 |
| `admin.error.carnet_invalide` | 400 | la raison nomme le palier et la clé |
| `admin.error.carnet_fige` | 409 | carnet **changé** alors qu'une ligne `carnet` `S<id>:…` existe au grand livre |
| `admin.error.fin_avant_lancement` | 400 | *(ajout)* fin avant le jour du lancement d'une saison lancée : fenêtre vide |
| `admin.error.fin_passee` | 400 | *(ajout)* lancer une saison dont le dernier jour est passé |
| `admin.error.saison_colonnes` | 503 | *(ajout)* une date ou un carnet sur une base sans `sql/quotidien.sql` ; sans date, la saison se crée comme avant |

- **Un carnet identique au défaut s'enregistre `NULL`** : l'onglet préremplit
  la zone de texte avec lui, et un formulaire renvoyé tel quel ne doit pas
  créer un carnet « propre » qui ne suivrait plus le code.
- **Le verrou ne refuse qu'un carnet qui change** : le formulaire renvoie le
  carnet à chaque enregistrement, et corriger la date de fin d'une saison
  dont un palier est payé doit rester possible. L'onglet montre un carnet
  figé en lecture seule et ne le renvoie pas.
- `GET /api/admin/saisons` gagne `prochaine`, `carnetDefaut`,
  `limitesCarnet` et `carnetsFiges` (identifiants).
- Le journal inscrit `fin_le`, `ouvre_le` et le carnet à la création, et à la
  modification seulement ce qui a changé.

### 6. Rien n'est écrit en production

Aucune saison, aucune date, aucun carnet n'est semé. La fin de la saison 1
(proposée : 2026-12-20, à vérifier sur `/matchs`), l'ouverture d'une saison 2
et un éventuel recalage du carnet de la saison 1 (seuils × jours restants /
63 si la mise en ligne passe le 19 octobre, **avant** le premier palier
versé) se saisissent dans l'onglet Saisons.

---

## `quotidien` (2 octobre 2026)

**Aucun champ de `CONTRATS.md` n'est renommé ni retiré.** `GET /api/quotidien`
sert la forme du § 6.1 (et `depuis` du § 8.1 avec `?retour=1`), les huit
`POST` du § 6.2 et `POST /visite` répondent comme écrit, les raisons sont
celles du § 11. `quotidien-smoke` vérifie les clés de la racine, du bonus,
d'une mission, du sachet et du carnet une à une, et le ticket champ pour
champ. Ce qui suit est une précision ou un ajout ; **le n° 1 touche ce
qu'un écran voit**.

### 1. « TOUT RÉCUPÉRER » prend aussi ce qu'il rend prêt

**Contrat** (§ 6.2) : `tout` « verse tout ce que compte `aReclamer` ».

**Fait** : il verse ce que compte `aReclamer`, **plus** ce que ses propres
versements rendent prêt dans le même geste : le sachet d'un jour dont il
vient de verser la dernière mission, et un palier du carnet que leurs
tampons atteignent. `aReclamer`, lui, ne compte que ce qui est prêt à la
lecture (« il ne compte que ce que la réponse montre »). Le `gain` d'un
`tout` peut donc dépasser la somme des gains affichés comme prêts.

**Pourquoi** : sans cela, un joueur qui appuie sur TOUT RÉCUPÉRER voit la
pastille revenir aussitôt (le sachet devenu prêt), et doit appuyer une
seconde fois. Chaque élément ajouté est recompté sous le verrou comme les
autres : s'il n'est pas atteint au moment de son tour, il est passé.

**Pour les écrans** (`index.html`, `aide.html`) : montrer le `gain` de la
réponse, pas la somme des lignes prêtes.

### 2. Un code d'erreur de plus : `quotidien.error.indisponible` (503)

Une panne imprévue (base injoignable) répond 503 avec ce code. Le contrat ne
nommait que `quotidien.error.requete` ; R2 dit déjà qu'un 503 vaut « bloc
absent ». Une table du quotidien absente n'est **pas** une panne : `GET` rend
`{ "actif": false }` en 200, une réclamation `raison: "schema"` en 200, la
marque de visite `{ ok: true }`.

### 3. La relance : deux cas que la liste fermée ne nomme pas

La liste de `relance` est `epuisees | aucune | terminee | change | inactif`.
**Fait** : une ligne du jour introuvable au rang demandé (le contrat
n'existe pas, ou un autre onglet l'a remplacée) répond `change` — l'écran
relit ; une table absente répond `inactif` — l'écran retire le bouton. Pas
de `inconnu` ni de `schema` dans une réponse de relance.

### 4. Les montants et la saison d'une mission tirée hors saison

Une mission tirée quand la fenêtre de la saison en cours est close
(`finDeFenetre`), ou sans saison lancée, a `saison_id` nul **et** porte
`tampons: 0` dans son gain (le sachet aussi). Le contrat montre toujours un
tampon ; ici, « +1 tampon » serait une promesse sans carnet pour la tenir.

### 5. Le relais et la saison passée suivent l'interrupteur du carnet

`saison.carnet_actif` coupé : ni `carnet`, ni `relais`, ni `saisonPassee`,
et leurs réclamations répondent `inactif`. `saison.relais_packs` à 0 : pas de
`relais` servi, et le réclamer répond `inactif`. Le relais est celui de la
saison **en cours** (clé `S<id de la saison en cours>`) ; il se lit sur la
saison lancée juste avant elle, et reste récupérable tant qu'aucune autre
n'est lancée.

### 6. Le ticket : ce qu'il tait, et pourquoi

- `kops[].pot` n'est servi que s'il a bougé (ou si `verse > 0`) ; `verse`
  seulement s'il est positif. Un KOP rejoint depuis la marque n'a pas de
  photo : ni `pot` ni `verse` pour lui (ses arrivées et ses votes, si).
- Un vote dont l'échéance est passée mais qui n'a pas encore été dépouillé
  (il l'est à la lecture du KOP) a encore `issue = 'en_cours'` : on ne
  connaît pas son issue, il n'apparaît pas.
- `matchs[]` : les matchs **finis dont le coup d'envoi est postérieur à la
  marque** (le plan). Un match commencé avant la visite et fini après n'y est
  pas.
- `amis.nouveaux` : les plus récents d'abord ; un compte non actif n'y est
  jamais.
- La photo des pots (`user_wallet.instantane`) est fabriquée en SQL dans le
  même `UPDATE` que la marque, sans `JSON_OBJECTAGG` (absent avant
  MariaDB 10.5 : la version de production n'est pas connue d'ici). Forme :
  `{ "<id du KOP>": { "pot": 120, "verse": 500 } }` (`verse` = `verse_total`).

### 7. Le catalogue : choix qui touchent les vignettes

- `ou` vaut `/boosters`, `/duel-nvn`, `/virage` ou **`/fanzzy`** (« Fais
  grandir un Fanzzy » : on fait grandir depuis la fiche, qu'on atteint par le
  classeur).
- `bouton` : « Ouvrir un booster », « Jouer un duel », « Jouer un duel
  classé », « Entrer dans le Virage », « Faire grandir un Fanzzy ».
- Le titre de chaque bascule `mission.<id>` du registre est l'intitulé de la
  mission, et `quotidien-smoke` le vérifie (une seule rédaction).

### 8. Les conditions du tirage, lues ainsi

- `classes` (« idem » au plan) : un match **qui se joue encore** dans le jour
  de jeu (comme les missions du Virage), `xp.duel_classe > 0`, et les classés
  joués depuis minuit plus deux sous `abo.duels_classes_jour` (0 = sans
  plafond). Un classé quitté compte au quota, donc ici aussi.
- « Se joue encore » : `NS` ou un statut en direct (`EN_DIRECT` de
  `football/journee.js`). `TBD`, reporté, arrêté, annulé : non.
- « Fais grandir » : un Fanzzy possédé sous son dernier âge écrit, et des
  écharpes pour l'évolution la moins chère (`EVO_COST`). Catalogue non
  chargé : écartée, dit une fois au journal.
- Une mission dont l'identifiant a quitté le catalogue (impossible
  aujourd'hui) n'est pas affichée.

### 9. Précisions de comportement

- Le recompte d'une mission vérifie aussi que sa **saison** n'a pas changé
  depuis la lecture (`change` sinon) : la saison est lue avant le versement
  pour la clé du grand livre.
- Un `jour` futur répond `inconnu` ; un bonus réclamé à cheval sur minuit,
  `change`.
- Le sachet en base garde en `cible` le nombre de missions tirées, mais
  `sur` se compte sur les lignes présentes.
- `missions` est absent si aujourd'hui n'a aucune mission, même si hier a
  encore une mission prête (seul cas : toutes les bascules éteintes).
- Budget mesuré : `GET` = 6 requêtes (7 si « Fais grandir » doit être
  évaluée pour `relancable`) ; `?retour=1` avec une marque récente : les
  mêmes ; un ticket à faire : 6 de plus. Le tirage : au plus 4, une fois par
  jour et par joueur. **Hors tirage, aucune lecture de la journée du
  football** (§ 10, 3 octobre 2026) : avant, ces chiffres la taisaient — la
  doublure de la suite ne passait pas par le pool — alors qu'un `GET` sur
  deux environ la lisait pour `relancable`.
- La sonde du jour de jeu est servie dans `/healthz` sous `jourDeJeu` :
  `{ changeA: "HH:MM", heure: "Europe/Zurich", base: { session, systeme, decalage } }`.

### 10. `relancable` se juge sans lire la journée du football (3 octobre 2026)

**Contrat** (§ 6.1) : `relancable` est vrai « si une relance reste, si la
mission n'est pas finie, et si une autre mission de même difficulté est
possible ».

**Le défaut corrigé** : pour le savoir, chaque `GET /api/quotidien` hors
tirage parcourait l'ordre du jour, et une mission du Virage (`virage`,
`tribune`, `classes`, `club_virage`, `mitemps`, `ailleurs`) suffisait à lire
la journée par `teletext.jour('')`. Cela faisait une requête sur `api_cache`,
le décodage de la journée du monde et une requête sur `souvenir_leagues` à
chaque arrivée au hub. Une fois le cache de 45 s expiré, cela déclenchait
aussi un appel `/fixtures` à l'API sportive : le hub devenait un déclencheur
d'appels de plus, de jour comme de nuit (PLAN, règle 9 ; le plan disait déjà
« les conditions, au tirage seulement »).

**Fait** :

- **Seuls le tirage et la relance lisent la journée.** La lecture de l'état
  hors tirage ne la lit jamais : `contexte({ presumer: true })` dans
  `src/server/quotidien/missions.js`.
- Chaque lecture faite (tirage ou relance) **note son relevé** : les matchs
  déjà filtrés sur le jour de jeu, pour tous les joueurs. Il se garde en
  mémoire du processus, **une minute**, et **pour ce jour de jeu seulement**
  (ses bornes en secondes Unix, lues en SQL). La lecture de l'état s'en sert
  quand il est valable.
- Sans relevé valable, une condition qui dépend de la journée est **présumée
  remplie**, une fois vérifiés ses autres prérequis : bascule, XP du duel,
  plafond des classés, club suivi. `relancable` peut donc valoir `true` alors
  que la relance répond `aucune` (le cas est déjà dans la liste fermée de
  § 6.2). L'état que rend la relance le sait déjà, puisqu'elle vient de noter
  son relevé. Le bouton disparaît donc aussitôt, sans second essai.
- En pratique la présomption décide rarement. Avec les réglages par défaut, chaque
  difficulté a une remplaçante qui ne demande pas la journée (« Joue un
  duel », « Gagne un duel », « Gagne 3 duels » ou « Joue 5 duels »). Le cas
  courant est un joueur sans club dont la mission moyenne est « Gagne un
  duel » : ses remplaçantes sont le Virage et les classés.

**Pourquoi présumer plutôt que taire** : un `relancable: false` faute de
savoir retirerait le changement de mission, toute la journée, aux joueurs
sans club dont la mission moyenne est un duel. Une relance présumée à tort
coûte un « Aucune autre mission possible pour l'instant » (`/aide`), et
aucune relance n'est consommée.

**Pour les écrans** : rien ne change de forme. `/aide` traite déjà `aucune`
(un toast) et redessine avec l'état rendu.

**Suite** : `quotidien-smoke`, section « relançable se juge sans lire la
journée du football ». On y vérifie que deux lectures hors tirage laissent
`journeeLue` inchangé, la présomption, la relance qui tranche `aucune` et
l'état qu'elle rend, l'oubli du relevé après une minute (`crochets.horloge`)
et son ignorance d'un autre jour de jeu. La doublure de la journée passe
désormais par le pool, comme en production, et le contrôle du budget
vérifie aussi `journeeLue`. Quatre mutations rougissent : le calcul d'avant,
le relevé sans durée, le relevé sans jour de jeu, et la relance qui ne note
rien.

### 11. `insignes` : les insignes du carnet, servis (serveur-carnet, lot 4, 3 octobre 2026)

**Contrat** : un champ de plus à la racine de `GET /api/quotidien`, et donc
dans le `quotidien` de chaque réponse du § 6.2 ; sa forme est écrite au
§ 6.1 (`insignes`). Aucun autre champ ne change.

```json
"insignes": [{ "id": "lisere", "saison": { "id": 1, "numero": 1, "nom": "La reprise" } }]
```

**Le défaut** : le liseré et le tampon de la saison 1 (paliers 2 et 3 du
carnet) étaient versés — copiés dans `recompenses.insigne` au versement —
mais aucune route ne disait qu'un joueur les portait : ni le profil ni
`/aide` ne pouvaient les dessiner (`missions` § 1, plus bas).

**Fait** :

- **Où** : dans `GET /api/quotidien`, que le profil lit déjà
  (`chargerQuotidien`), plutôt que dans `/api/rank/moi`, qui n'est pas de ce
  périmètre et dont le budget est tenu par `classement-smoke`. **Aucune
  lecture de plus** : la lecture du grand livre que l'état fait déjà
  (`SQL_LIVRE`) prend la colonne `insigne` sur les lignes `carnet` et
  `relais` qu'elle lisait. Mesuré : six requêtes avant le liseré, six après.
- **Forme** : un objet par insigne, `{ id, saison: { id, numero, nom } }`,
  et non une chaîne `"S1:lisere"` comme l'esquissait la note de `missions` :
  l'écran écrit « S1 » à partir de `numero`, sans rien découper (R7). La
  saison a la forme de `carnet.saison`.
- **La ligne fait foi** : l'insigne est celui que la ligne `carnet` a copié
  au versement, pas celui du carnet d'aujourd'hui. Un carnet recalé dans
  l'onglet Saisons ne retire rien à qui a récupéré, et ne donne rien à qui
  n'a pas récupéré.
- **Porté pour toujours** : servi hors de l'interrupteur
  `saison.carnet_actif`, comme les titres de `/moi` hors de `rang.actif`.
  Les saisons se nomment par `toutesLesSaisons()` (brouillons compris) et non
  par les seules lancées : une saison remise en brouillon garde ses insignes.
  Une saison **supprimée** ne se nomme plus : ses insignes ne sont plus
  servis, la ligne du grand livre reste. L'administration ne supprime pas
  une saison lancée : il faut d'abord la remettre en brouillon.
- **Ordre et doublons** : par numéro de saison, puis par palier (lu dans la
  clé `S<saison>:<n>`), et non dans l'ordre des clés du grand livre — à la
  dixième saison, « S10 » passerait avant « S9 ». Un carnet saisi peut
  donner deux fois le même insigne (`validerCarnet` ne l'interdit pas) : il
  n'en est servi qu'un par saison.
- **Pas de liste fermée dans ce module** : les valeurs viennent de
  `carnet.paliers[].insigne`, déjà fermée par `validerCarnet`
  (`src/shared/saison.js`, qui ne l'exporte pas). Le contrat dit à l'écran
  de ne rien dessiner pour un `id` inconnu.
- `aReclamer` ne change pas : il compte le palier tant qu'il est `pret`,
  jamais l'insigne.

**Suite** : `quotidien-smoke`, sections « le carnet de la saison » et « la
saison 2, le relais et la saison passée » — absent sans insigne (palier 1,
titre du palier 5, paliers 2 et 3 seulement atteints) ; le liseré dans la
réponse de la réclamation, puis dans la lecture, au même nombre de
requêtes ; le tampon après le liseré ; `aReclamer` qui ne bouge que du
palier ; sous la saison 3, les insignes des saisons 1, 2 et 4 dans l'ordre
des numéros (la 4 a l'identifiant 10 000, pour que sa clé passe avant les
autres), un seul liseré pour deux paliers ; carnet éteint, toujours servis ;
une saison en brouillon, servie ; supprimée, plus servie, ses lignes
gardées. Vue rouge sans le code (sept contrôles), verte avec, sous Zurich
et sous Montréal. Cinq mutations rougissent : sans dédoublonnage, sans tri,
les saisons lancées seulement, sous l'interrupteur du carnet, et un tableau
vide servi.

---

## `fanzzy` (2 octobre 2026)

**Aucun champ de `CONTRATS.md` n'est renommé ni retiré.** `/open` porte
`cle` sur chaque carte (sauf les écharpes) et `series` (§ 2.3) ; `/state`
porte `nouveautes` (§ 2.1) ; `POST /api/fanzzy/vu` (§ 2.2) ;
`/bibliotheque` porte `paliers` et `POST /api/fanzzy/palier` répond selon R6
(§ 5.1) ; `/dex` porte `prochaine` et `sets[].prochaine` (§ 7.2). Ce qui suit
précise des cas que le contrat ne tranche pas.

### 1. `recharger(conn, userId)` — la porte des boosters offerts

Livrée en tête, signature du plan (§ 5, étape 7). Rend `{ packs, packsAt }`
(ou `null` sans bourse) ; le grand livre l'ignore. Sur la connexion donnée :
sous le `FOR UPDATE` d'une transaction, elle recharge dedans (une annulation
la défait) ; hors transaction, son écriture est **conditionnelle**
(`… WHERE user_id = ? AND packs = ? AND packs_at = ?`, relecture et
recompte si la ligne a bougé). `wallet()` et `openPack` s'en servent ;
`openPack` recharge maintenant **sous son verrou**, dans la transaction du
débit, et ne passe plus par `wallet()` avant.

**Ses appelants** (relevé le 3 octobre 2026) : toute **récompense** du jeu
qui porte un booster passe par elle avant d'entrer dans la réserve.

| appelant | où | comment |
|---|---|---|
| le grand livre | `recompenses.js`, `verser`, étape 7 | sous le `FOR UPDATE` de la bourse, pour tout gain qui porte des boosters : le sachet, le relais, les paliers du carnet et le bonus du quotidien, les crans et les séries complètes de la collection (`reclamerPalier`) |
| le quotidien | `quotidien/index.js`, `avantUnBooster` | sur le pool, hors transaction, **avant** de prendre le verrou, pour poser le souvenir de l'abonnement (l'écart ci-dessous) ; le grand livre recompte ensuite sous le verrou |
| l'aide | `aide/index.js`, `recompenser` | le booster de fin des premiers pas, qui ne passe pas par le grand livre (son drapeau est `user_wallet.parcours_paye`, pas une ligne de `recompenses`) : d'abord sur le pool, comme le quotidien, puis **sous le `FOR UPDATE` de son propre versement**, avant le cadeau. Depuis le 3 octobre 2026 (lot 4, plus bas) |

**Ne passent pas par elle**, faits trouvés en chemin, hors de tout périmètre
de l'atelier : les boosters d'un abonnement acheté (`boutique/index.js`,
`livrer` : `packs = packs + ?` dans la transaction de l'encaissement, 1 au
mensuel, 6 à l'annuel), qui entrent sans compter d'abord la recharge due —
quand ils remplissent la réserve, la lecture suivante remet la minuterie à
zéro et la recharge se perd, comme le faisait l'aide ; et l'ajustement de
l'administration (`admin/index.js`, borné à 0–99), qui est un geste à la
main. À aiguiller.

**Écart** : le plan dit qu'elle « lit l'abonnement comme `wallet()` ». Elle
le lit dans **un souvenir de moins de deux minutes**, que `wallet()`,
l'ouverture d'un booster et la réclamation d'un palier posent en relisant
l'abonnement **avant** de prendre une connexion ; sans souvenir, elle
appelle `estAbonne` comme avant. **Pourquoi** : `estAbonne` passe par le
pool, et le grand livre appelle `recharger` en tenant le verrou de la bourse.
Huit réclamations simultanées du même joueur (le pool de production en a
huit) tiendraient toutes les connexions en attente de ce verrou, et celle qui
le tient n'en trouverait plus pour lire l'abonnement : tout le serveur
attendrait l'expiration du verrou (cinquante secondes). Le prix : une
recharge comptée au rythme d'avant pendant deux minutes, le jour où l'on
s'abonne ou se désabonne. **Le quotidien et l'aide posent ce souvenir
eux-mêmes** (*révisé le 3 octobre 2026* : cette ligne disait que les
réclamations du quotidien ne l'échauffaient pas, ce qui n'est plus vrai
depuis `avantUnBooster`) : avant de prendre le verrou, ils appellent la même
porte sur le pool, hors transaction, où son écriture est conditionnelle et ne
peut pas écraser un débit. Une panne de cet appel n'empêche rien, le
versement recompte sous le verrou ; un souvenir qui expire entre les deux
appels ramène le cas d'avant pour ce seul versement. Le remède définitif
serait un `estAbonne` sur la connexion de l'appelant dans
`abonnement/index.js`, fichier d'aucun périmètre.

**Et un défaut voisin corrigé en passant** : le débit d'un booster remettait
la minuterie à zéro quand la réserve valait le plafond **du joueur gratuit**
(`IF(packs = pack.max, …)`), y compris chez un abonné dont le plafond est plus
haut, au milieu de sa recharge. Le débit ne touche plus `packs_at` : la
recharge faite juste avant, sous le même verrou, l'a déjà fait repartir si la
réserve était pleine.

**Les premiers pas (`aide`, lot 4, 3 octobre 2026).** Le booster de fin du
parcours (`POST /api/aide/recompense`) entrait dans la réserve par un
`UPDATE … packs = packs + ?` sans compter la recharge en attente, alors que
son commentaire affirmait l'inverse : à 11 sur 12 avec une recharge due, le
cadeau menait à 12, et la lecture suivante, voyant la réserve pleine,
remettait la minuterie à zéro — le joueur finissait à 12 au lieu de 13, sans
que rien ne lève. `recompenser` appelle maintenant `recharger(conn, userId)`
sur la connexion de son versement, sous le `FOR UPDATE` de la bourse, avant
le cadeau : une annulation défait les deux. Sans porte, elle **lève avant
toute écriture**, comme le grand livre (socle § 3) — ni booster, ni drapeau
`parcours_paye`, qui fermerait la récompense pour toujours. La route (`safe`)
écrit alors la pile au journal, une ligne `[aide]` qui nomme « recharger »,
et répond **503 `aide.error.indisponible`** : un bloc absent pour la page
(R2), qui se tait. Un verrou expiré pendant le versement répond de même, sans
le code de MySQL, et le versement est annulé en entier. Rien n'étant écrit,
le cadeau reste dû, et la page `/aide` le redemande d'elle-même à la visite
suivante (`finir`) — en vain tant que la porte manque : c'est le journal qui
montre la panne, pas un nouvel essai. (*Révisé le 4 octobre 2026* : cette
ligne disait que la route répondait `aide.error.server` et que le joueur
pouvait réessayer ; c'était un 400 sans une ligne au journal, avant que
`safe` n'écrive la pile et ne réponde 503.)

**Écart refermé le 4 octobre 2026** (serveur-correctif, § 7). Jusque-là, la
porte se lisait sur l'option `fanzzy` de `createAide`, **sinon sur
`globalThis.fanzzy`** : `server.js` ne passait pas `fanzzy` à l'aide (fichier
d'aucun périmètre du lot 4), mais posait la globale en montant le module
fanzzy, avant l'aide et dans le même bloc ; sans ce repli, le correctif
n'aurait valu que dans la suite. `server.js` construit maintenant l'aide avec
`fanzzy`, comme le quotidien, après `createFanzzy`. Personne d'autre ne
lisait la globale (relevé par `grep` dans tout le dépôt, et dans la copie du
lot 6) : elle est retirée de `server.js`, et le repli de `aide/index.js`
avec elle — garder deux chemins laissait celui qu'on retire en croyant
nettoyer. Si le montage de fanzzy échoue, aucune route `/api` n'est montée,
l'aide non plus : la porte ne manque toujours jamais en production. Retirer
`fanzzy` de l'appel, le passer à `null`, ou monter l'aide avant
`createFanzzy`, ferait lever chaque booster de fin sans qu'aucune autre
suite ne rougisse — elles posent toutes leur porte elles-mêmes : c'est
`verif-cablage` (sans base, et dans le workflow de déploiement) et
`aide-smoke` qui lisent l'appel.

**Suite** : `aide-smoke`, « la recharge due entre avant le booster de fin » :
à 11 sur 12 avec une recharge due, le booster de fin mène à 13, et la lecture
suivante ne reprend rien ; la recharge est comptée sur le pool d'abord, la
ligne encore libre (un `NOWAIT` y passe), puis sur la connexion du
versement ; l'appel préalable cassé exprès, la recharge entre quand même, par
la connexion du versement qui tient la ligne (une autre connexion est refusée
en `NOWAIT` à cet instant) ; `server.js` est lu : il doit construire l'aide
après le module fanzzy, et lui passer `fanzzy` (la globale n'est plus
acceptée) ; sans porte, rien n'est écrit. `verif-cablage` lit le même appel,
sans base, et verse un booster de fin sur un faux pool pour vérifier que la
porte reçue est bien celle qu'appelle le versement. Puis « une panne se dit
au journal, et en 503 », par le routeur comme la page : sans porte, 503
`aide.error.indisponible`, une ligne `[aide]` qui nomme « recharger », rien
d'écrit ; un verrou expiré pendant le versement, 503 sans le code de MySQL,
la cause au journal, ni booster ni drapeau.

### 2. Les nouveautés

- **Écrites** : au booster (une instruction après la validation, pour les
  cartes `new: true`), à l'évolution (`age:<lignée>:<stade>`, après la
  validation), à l'étal (dans sa transaction, par `remettreStuff` et
  `remettreTenue`). La liste est **exportée** (`CHEMINS_NOUVEAUTES`), avec
  `onboarding` et `offrir` parmi ceux qui n'en écrivent pas, et pourquoi.
- **Une pièce d'étal déjà possédée n'est pas nouvelle** (un exemplaire de
  plus, comme un doublon de booster) : la nouveauté ne s'écrit que si la ligne
  `user_stuff` est créée.
- `ON DUPLICATE KEY UPDATE got_at = got_at` plutôt qu'`INSERT IGNORE` : même
  effet sur un doublon, mais une autre faute lève au lieu de s'écrire tronquée.
- **Lecture** : une instruction, qui sert les 200 plus récentes de moins de
  60 jours et dit s'il en traîne de plus vieilles ; elles sont alors
  supprimées pour ce joueur. Une clé illisible (posée à la main) n'est pas
  servie.
- **`POST /vu`** : exactement **une** des trois formes (deux à la fois → 400).
  `{ "cles": [] }` est accepté (rien à éteindre) ; au plus 200 clés de 1 à 80
  caractères. `restantes` compte comme la liste sert : moins de 60 jours,
  plafonné à 200, pour que la pastille et la liste disent le même nombre.
  Table absente : `{ "restantes": 0 }` en 200 (rien à éteindre, rien qui
  reste), et le journal le dit une fois.

### 3. Les compteurs du jour

`compteurs_jour` : `booster` à chaque ouverture, `evolution` à chaque
évolution, jour `CURDATE()`, après la validation, sous `try`. Une évolution
refusée ne compte pas. Table absente : l'action se fait, le journal nomme
`sql/quotidien.sql` **une fois** par cause.

### 4. `series` dans la réponse du booster

On compte des **lignées obtenables** (publiées, série ouverte), comme la
jauge de la collection : une lignée dépubliée qu'on possède encore ne fait
pas dépasser `total`. Une série dont aucune lignée n'est obtenable n'a pas
d'entrée.

### 5. Les paliers de collection

- **Un cran réclamé verse aussi les crans plus bas encore dus**, du plus bas
  au plus haut, chacun sous sa clé (la réponse est alors celle de
  `verserTout` : `gain` additionné). **Pourquoi** : la règle « au seuil franchi
  le plus haut » tient pour couvert tout seuil sous le plus haut payé ;
  récupérer 50 avant 25 aurait rendu 25 impayable pour toujours. Un cran
  demandé qui n'est pas dû reçoit son refus seul (`incomplet`, `inconnu`), et
  rien d'autre n'est versé à sa place.
- **Refus** : un seuil qui n'est pas un multiple de la taille du cran, ou qui
  est sous le plus haut payé (couvert) → `inconnu` ; pas encore atteint au
  recompte → `incomplet` ; une série fermée ou inexistante → `inconnu`.
- `prochain.a` est le premier multiple au-dessus du plus haut payé **et** du
  compte : après une baisse du compte, un cran déjà payé n'est pas un
  objectif. Absent quand l'univers ne contient plus de cran.
- `series[]` : les seules séries ouvertes qui ont au moins une lignée
  obtenable ; une série réclamée reste `reclame` même si une lignée s'y ajoute
  ensuite. `aReclamer` : les crans du plus bas au plus haut, puis les séries.
- `paliers` absent : interrupteur coupé, **ou** grand livre absent. Dans ce
  second cas, une réclamation répond `{ verse: false, raison: "schema" }`.
- Corps : `{ tout: true }` exclusif (avec `sorte` ou `cle` → 400) ; `cle`
  d'un cran en chiffres (`"50"`, pas `50`) ; les autres clés du corps sont
  ignorées (un `echarpes` glissé ne change rien, contrôle fait).

### 6. `/dex` : la saison annoncée

`prochaine` ne garde que les six champs du contrat de ce que rend
`saisonProchaine()` ; `sets[].prochaine` vient de `seriesAnnoncees()` du
périmètre des saisons (une série déjà ouverte n'est pas marquée), sans
seconde règle ici. Les deux sont lus par l'espace de noms du module : leur
absence éteint l'annonce sans faire tomber le module.

### 7. Les suites

- `fanzzy-smoke` éprouve tout ce qui précède, et le monde de la production
  (LA REPRISE seule, semée dans `saisons`) pour la série complète et les
  crans. La course E3 y est rendue **certaine** par un crochet de test,
  `createFanzzy({ …, crochets: { apresLectureRecharge } })`, appelé entre la
  lecture de la réserve et son écriture ; dix ouvertures simultanées ne
  suffisent pas : la mutation qui rend l'ouverture d'avant entière les laisse
  vertes, seul le crochet la voit.
- Elle avait **deux rouges connus depuis avant le lot 0** (`tenuesParAge`,
  « les trois rouges connus » de `HISTORIQUE.md`) : le scénario habillait un
  Fanzzy sans jamais l'équiper, alors que `tenuesParAge` est la garde-robe du
  Fanzzy équipé. Le scénario l'équipe désormais ; le portefeuille n'a pas
  changé.
- `boutique-smoke` pose `user_nouveautes` en prenant sa seule instruction
  dans `sql/quotidien.sql` : le fichier entier demande la table partagée des
  saisons, que cette suite n'a pas à toucher.

### 8. Les tenues ne comptent plus dans les crans (3 octobre 2026)

**Constat de la vérification, confirmé.** Un abonné porte n'importe quelle
tenue publiée, et `wearSkin` (`src/server/onboarding/index.js`) l'inscrit
alors dans `user_skins`, comme une tenue gagnée (il la garde à l'échéance :
c'est voulu). `compter()` comptait toute tenue publiée de `user_skins` dans
`total.gagnes`, et les crans se payaient sur ce nombre. Porter les trois
tenues de l'amorce à chaque âge de ses personnages donnait donc des crans,
c'est-à-dire des écharpes et des boosters, obtenus par l'abonnement : de
l'argent réel changé en récompenses matérielles, contre R9, `SERVEUR.md` § 1
point 9 et `JURIDIQUE.md` § 6.

**Fait.** Les crans comptent la bibliothèque **sans les tenues**, pour tout le
monde (`HORS_CRANS` dans `src/server/fanzzy/index.js`). C'est la règle des
divisions : ce que l'abonnement ouvre ne paie pas. Rien dans une ligne de
`user_skins` ne distingue une tenue tirée, achetée à l'étal ou prise par
l'abonnement, et les lignes déjà écrites ne le diront jamais : la seule règle
qui tient sans colonne nouvelle est de ne payer aucune tenue. `paliersDe` et
le recompte du versement (`verifier` du cran) lisent le même compte, calculé
dans `compter()`.

**Écart au § 5.1** :

| champ | contrat | maintenant |
|---|---|---|
| `paliers.gagnes` | « le même nombre que `total.gagnes` de la même réponse » | `total.gagnes` − `types.tenues.gagnes` |
| `paliers.possibles` | absent | **nouveau** : `total.possibles` − `types.tenues.possibles`, l'univers des crans |

`prochain.a`, `prochain.manque` et `aReclamer` se lisent sur ce compte. La
jauge de la bibliothèque (`total`, `types`, `parFanzzy`) ne change pas : les
tenues s'y collectionnent toujours. L'exemple du contrat « si le compte baisse
(une tenue retirée) » ne vaut plus : une tenue dépubliée ne fait plus bouger
les crans ; une pièce ou un personnage dépublié, si.

**Ce que les écrans doivent faire** : quand `paliers` est servi, la jauge à
crans se lit `paliers.gagnes / paliers.possibles` avec `prochain.a`, jamais
`total.gagnes` contre `prochain.a`. Aujourd'hui, `public/index.html`
(`palierDe`, chargement de la tuile COLLECTION) prend `total.gagnes` pour
numérateur : chez un joueur qui a des tenues, la tuile vise un seuil décalé
d'autant (besoin rendu au périmètre `accueil`). `collection.html` ne lit pas
encore `paliers` (lot 4). *Les deux le font depuis, la tuile du hub et
l'anneau de la collection (lot 4), tous deux décrits à `accueil` § 5 ; le
contrat déclare `possibles` au § 5.1 (3 octobre 2026).*

**Effet sur l'économie** (à partir d'`ECONOMIE.md` § 7.1, LA REPRISE à deux
thèmes de tenues) : l'univers des crans passe de 635 à 445 objets, soit de 25
à 17 crans ; sur toute la collection, 200 écharpes et 2 boosters de moins par
joueur, abonné ou non. Si Gaël veut le rythme d'avant, `collection.cran` à 18
(réglage d'administration, sans livraison) rend environ 24 crans. Rien n'est
encore versé en production (`sql/quotidien.sql` est à déployer) : aucun cran
déjà payé n'est concerné. *Le 3 octobre 2026, Gaël a appliqué
`sql/quotidien.sql` à la base : le grand livre peut désormais payer des crans.
La règle sans tenues est dans le commit 2ff45f9 ; un serveur d'avant ce
commit les paierait encore tenues comprises, et ces crans-là ne se
reprendraient pas.*

**Non retenu : marquer les tenues prises par l'abonnement** (une colonne
`user_skins.par_abonnement`, écrite par `wearSkin`). Il faudrait le socle
(schéma) et `onboarding/index.js`, qui n'appartient à aucun périmètre de
l'atelier ; les lignes déjà écrites resteraient indistinctes ; et un abonné
qui a essayé une tenue ne pourrait plus la gagner (le booster et l'étal la
tiennent pour possédée), donc jamais la faire compter. Si Gaël veut que les
tenues gagnées paient, c'est ce chantier-là, à trancher.

**Trouvé en chemin, non corrigé, à trancher** : la même ligne pèse sur le
tirage. Une place « tenue » de booster (14 % des places ouvertes) ne propose
que les tenues **non possédées** des âges atteints, et retombe sur une poignée
d'écharpes (11,5 en moyenne) quand il n'y en a plus. Un abonné qui a porté
toutes les tenues de ses âges reçoit donc des écharpes là où un joueur gratuit
reçoit une tenue : de l'ordre de 5 écharpes par booster (0,46 place « tenue »
par booster × 11,5), tant que le joueur gratuit n'a pas lui-même toutes ses
tenues. Le corriger demande de savoir quelles tenues ont été prises par
l'abonnement : c'est la colonne ci-dessus. *Depuis le 6 octobre 2026, une
catégorie épuisée ne rend plus que 2 écharpes (`POIGNEE_DE_REPLI`) : l'écart
tombe à environ 1 écharpe par booster (0,46 × 2), et la question perd
l'essentiel de son poids.*

**Suite** : `fanzzy-smoke`, « ce que l'abonnement ouvre ne paie pas ». Un
abonné simulé porte, **par la route de l'avatar** (`POST
/api/onboarding/avatar`), chaque tenue publiée à chaque âge d'assez de
personnages pour passer deux crans (54 tenues sur la base de test) ; le
contrôle du contrôle vérifie que la jauge les
compte ; ses `paliers` restent identiques à l'octet, le cran que seules ses
tenues atteignent est refusé (`incomplet`) sans rien verser, et ses
`paliers` sont ceux d'un joueur gratuit aux mêmes personnages. Mutations :
`paliersDe` remis sur `total` → 4 rouges ; le recompte du versement remis sur
`total` → 1 rouge (le cran demandé est payé). Le contrôle de tête devient
« `gagnes` et `possibles` : le total, sans les tenues ».

**À corriger ailleurs** (besoins rendus) : `JURIDIQUE.md` § 6 (socle) — les
crans ne comptent pas les tenues, parce que l'abonnement les ouvre toutes ;
`SERVEUR.md` § 6 et `ECONOMIE.md` § 7.1 disent encore que les crans
« comptent tout ».

### 9. `wallet.packMax` et `paye` servis, inscrits au contrat (3 octobre 2026)

**Réponse aux besoins kiosque § 1 et § 2 (plus bas), constat de la
vérification confirmé** : la route `/open` rendait `{ ...r, wallet }` sans
l'un ni l'autre, et `wallet()` ne servait pas le plafond qu'elle venait de
calculer. **Servis, et inscrits dans `CONTRATS.md` § 13** — un ajout : aucun
champ existant n'est renommé, retiré ni changé.

- `wallet.packMax` (entier ≥ 1) : le `plafond` de `regleDe()` qui vient de
  borner la recharge, abonnement compris, dans chaque `wallet` du module
  (`/state`, `/open`, `/evolve`). Absent si le réglage n'était pas un entier
  ≥ 1 (R1) — les réglages le bornent déjà à 1–99. `maxPacks`, à la racine de
  `/state`, reste le plafond du joueur gratuit.
- `paye` (entier ≥ 0), à la racine de `/open` : le prix **débité**, lu une
  fois pour le débit et la réponse (un réglage changé entre deux lectures ne
  peut pas les faire diverger), quand la réserve était vide et le paquet
  demandé à l'achat ; `0` quand la réserve a payé, `buy` ou pas. Toujours
  présent sur une ouverture réussie : `0` dit « rien pris », et c'est ce qui
  retire au kiosque sa déduction par l'écart des soldes. Même nom et même sens
  que `paye` de `POST /api/boutique/depenser`.
- `wallet.cadenceMs`, servi depuis le 3 octobre (même besoin du kiosque, même
  anneau) et absent des documents jusqu'ici, est inscrit au même § 13.1.

**Précision sur R9** (« aucune donnée de ce contrat ne dépend de
l'abonnement ») : la forme est la même pour tous, mais les **valeurs** de
`packMax` et `cadenceMs` sont la règle que l'abonnement change (plafond et
cadence), celle que `packs` et `nextPackInMs` montraient déjà. Ce ne sont pas
des montants de récompense ; aucun gain du contrat n'en dépend. `paye` ne
dépend pas de l'abonnement (le prix du booster est le même pour tous).

**Suite** : `fanzzy-smoke`, « la durée d'une recharge et le plafond » et
« ce qu'une ouverture a prélevé » (sept contrôles de plus, deux renforcés). Mutations
(banc de mutation de l'atelier, hors du dépôt ; module remis à l'octet) : `packMax`
retiré → 5 rouges ; `packMax` au plafond du joueur gratuit → 1 rouge (l'abonné
lit 12 au lieu de 24) ; `paye` retiré → 4 rouges ; `paye` au prix dès que `buy`
est demandé → 1 rouge (le paquet payé par la réserve) ; `paye` écrit en dur à
45 → 1 rouge (le prix changé à 60). `boutique-smoke` et `collection-smoke`
restent verts.

**Pour le kiosque** : rien à changer, la page lit déjà ces trois champs
(`cartes.js`, `boosters.html`) et les préfère à ses replis. La vérification
« (hors contrat) wallet.packMax et paye non servis » doit désormais les voir
servis.

---

## `accueil` — écran (3 octobre 2026)

**Aucun champ de `CONTRATS.md` ne change.** Le hub (`public/index.html`) lit
désormais `nouveautes` (§ 2.1) et `paliers` (§ 5.1), qu'il ignorait : son
« +N » venait d'une mémoire locale, ses crans d'une table locale.

### 1. La pastille des nouveautés est sur FANZZY, pas sur COLLECTION

**Contrat** (§ 2, lecteurs) : « pastille de la tuile COLLECTION :
`nouveautes.length` ».

**Fait** : `nouveautes.length` sur la tuile **FANZZY** du rail
(`data-etat="nouveau"`, pastille « +N »), là où le lot 2 la posait déjà.

**Pourquoi.** La direction charge FANZZY des nouveautés (« FANZZY porte
+12, ou rien ») et la soumet à la règle des trois états du rail (LIVE >
PRÊT > nouveauté) ; le panneau COLLECTION du hub n'est pas une tuile du
rail, et il porte déjà le palier (§ 5.1). La bulle, quand elle en parle,
mène aussi au classeur.

### 2. Le hub éteint au retour ce que le toucher a mis de côté

**Révisé le 3 octobre 2026**, sur constat de la vérification. La première
version n'éteignait rien : toucher FANZZY n'envoyait aucun
`POST /api/fanzzy/vu`, et comme ni le classeur, ni la collection, ni la
fiche n'éteignent encore (lot 4), le « +5 » d'un premier booster restait
allumé jusqu'à la purge des soixante jours — une pastille permanente, alors
qu'au lot 2 elle tombait au toucher.

**Fait** : toucher FANZZY (la tuile, ou la bulle quand elle mène au
classeur) met de côté, sur l'appareil, les clés que la pastille comptait
(`localStorage`, `tbf.vus.a-eteindre` : `{ qui, cles }`). À la lecture
suivante de `/api/fanzzy/state` qui sert `nouveautes` — nouvelle visite, ou
retour par la flèche (`pageshow`) —, le hub ne les compte plus et envoie
`POST /api/fanzzy/vu` `{ "cles": [...] }` (deux cents au plus, `keepalive`).
Un 2xx les éteint ; un 400 les retire de la file sans les dire éteintes ;
le réseau coupé, un 401, un 404 ou un 5xx les gardent pour la lecture
suivante. Une liste servie de moins de deux cents entrées est entière : une
clé mise de côté qu'elle ne sert plus (éteinte ailleurs, purgée) est
oubliée sans requête.

**Écart au § 2.2** (« la page l'envoie après avoir montré les nouveautés,
jamais au chargement ») : le hub l'envoie à son chargement, mais pour les
seules clés que le joueur est allé voir au classeur en touchant FANZZY —
après qu'elles ont été montrées, donc. Jamais au toucher : le classeur doit
encore pouvoir coller son NOUVEAU sur la carte (lot 4). Par clés, et non
`{ "tout": true }` : ce qui est arrivé entre-temps (un booster ouvert depuis
le classeur, un achat dans un autre onglet) garde son « +N ».

**Ce qui reste au lot 4** (besoin `pages-autres`) : arriver au classeur
par le tiroir, la barre ou un lien n'éteint rien d'ici ; le classeur, la
collection et la fiche éteignent ce qu'ils montrent. Les deux extinctions
cohabitent : une clé déjà éteinte n'est plus servie, et la redemander ne
coûte qu'un `restantes`.

### 3. Les replis

- `nouveautes` absent : la mémoire de l'appareil (`tbf.vus`), comme au lot 2
  (le contrat le permet). Elle reste tenue à jour quand le serveur répond.
- `paliers` absent : les repères de lecture du lot 2 (10, 25, 50, 100…),
  sans récompense. Présent : le palier visé est `prochain.a` (le total sans
  `prochain`), le second cran le dernier multiple de `cran` franchi par le
  compte, et le gain du cran visé est dit aux lecteurs d'écran seulement.

### 4. Le bonus du jour est dans la bâche, et « J3 » avec lui

**Révisé le 3 octobre 2026**, sur constat de la vérification. **Aucun champ
de `CONTRATS.md` ne change** ; seul le lecteur décrit au § 6.1 (« bulle
« J3 » ») se déplace.

**Contrat** (§ 6.1, `carte.case` et « Lecteurs ») : la case du jour est « le
« J3 » de la bulle du Fanzzy ».

**Fait** : tant que `bonus.pret` est vrai, la bâche du jour du hub (le
ticket kraft de la bande du bas) **est** le bonus : « BONUS DU JOUR », la
bâche or RÉCUPÉRER, l'écharpe de la semaine (`carte.case` sur
`carte.cases`), « J3 » à côté, et le gain en sticker. Le ticket entier se
touche (`POST /api/quotidien/bonus`, inchangé). La bulle ne parle plus du
bonus : elle ne redit pas le ticket.

**Pourquoi.** Le ticket du bonus montait dans la pile, en bas de l'écran, et
couvrait le bouton d'entrée (à 360 px, en entier) ; un toucher à côté de
RÉCUPÉRER le rangeait au lieu de lancer la partie, et deux tickets kraft
s'empilaient sur un hub qui n'en porte qu'un. Rangé, il ne vivait plus que
dans la bulle, d'où le « J3 ». Dans la bâche, il ne couvre rien et ne se
range plus : la bulle n'a plus rien à rappeler.

**Pour la mesure** : le hub ne pose plus `.tbf-ticket.tbf-bonus` dans
`.tbf-pile` ; le bonus se lit sur `#direct[data-quoi="bonus"]`.

### 5. La tuile COLLECTION lit les crans sans les tenues (3 octobre 2026)

**Besoin de `fanzzy` § 8, fait.** Aucun champ ne change ; le hub suit
l'écart de `fanzzy` § 8. Quand `paliers.gagnes` est un entier, la tuile
montre `paliers.gagnes / prochain.a` (le total `paliers.possibles` sans
`prochain`), et son second cran est le dernier multiple de `cran` sous
`paliers.gagnes`. Jamais `total.gagnes` contre `prochain.a`.

- `paliers` servi sans `gagnes` entier : il ne se lit pas, la tuile prend
  les repères sans récompense sur `total` (§ 3), comme sans `paliers`.
- `paliers.gagnes` sans `possibles` (serveur d'avant l'écart, où `gagnes`
  valait `total.gagnes`) : l'univers est `total.possibles`.
- L'étiquette pour les lecteurs d'écran dit les deux comptes : « 23 sur 25
  au prochain cran, sans les tenues ; 24 gagnés sur 788 en tout ».

**La page de la collection** (*révisé le 3 octobre 2026, lot 4* : ce
paragraphe disait qu'elle affichait `total`, ce qui n'est plus vrai ; *et
le 4 octobre 2026* : il donnait à l'anneau `paliers.gagnes /
paliers.possibles`, que la page du lot 4 a quitté). Son anneau de
collectionneur vise **le prochain cran**, comme la tuile : `paliers.gagnes /
prochain.a` quand `paliers` est servi avec un `gagnes` entier, et
`paliers.possibles` quand tout est gagné (`prochain` absent). Les deux écrans
ne visent donc jamais deux seuils différents, et le sticker d'à côté dit ce
que ce seuil rapporte. Un anneau sur l'univers des crans restait vide à
l'œil : « 10 / 3311 », 0,3 %, à côté d'un sticker qui promettait le cran
de 25. `paliers.gagnes / paliers.possibles` ne se lit plus que dans
l'étiquette de l'anneau et dans le titre de palier (ABONNÉ, ULTRA, CAPO), et
`total` que dans l'étiquette (« 23 sur 25 au prochain palier ; 23 sur 760 au
compte des paliers, tenues à part ; 24 sur 788 en tout »). Sans `paliers`
lisible, l'anneau vise les repères ronds du hub (10, 25, 50…) sur
`total.gagnes`, sans rien promettre ; sans `possibles`, l'univers est
`total.possibles`. Les deux écrans affichent donc le même compte gagné
contre le même seuil, et disent le même total aux lecteurs d'écran : 23 ici
et 23 là-bas, 24 dans les deux étiquettes.

**Pour les suites** : chez un joueur qui a une tenue, avec `paliers` servi,
le chiffre de la tuile n'est plus `total.gagnes`. `tour-ui-smoke` (« et
l'accueil dit le même total qu'elle ») lisait le « gagnés/possibles » de
`/collection` dans `.total .n`, et ses cinq types dans `.type` et `.vig`,
que la page du lot 4 ne pose plus : ce contrôle se relit sur l'anneau
(`#collectionneur .tbf-cercle`, son `<b>` contre le premier chiffre de la
tuile, son étiquette contre celle de la tuile pour `total.gagnes` et
`total.possibles`). L'étiquette de la tuile porte toujours `total.gagnes` et
`total.possibles`.

---

## `duel` — vérification de la page du duel (3 octobre 2026)

**Aucun champ de `CONTRATS.md` ne change**, et `src/server/nvn/engine.js`
reste intouché (`PLAN.md` § 10). Deux constats portaient sur
`public/duel-nvn.html` (périmètre `pages-autres`) : la rumeur qui survit à la
sortie de l'écran de jeu, et le retour de flamme que seul le son disait. Les
deux sont confirmés et se corrigent dans la page ; le serveur sert déjà tout ce
qu'il faut. Ce qui suit est ce que le duel a fait de son côté.

### 1. Un fait trouvé en chemin, corrigé : `fermer` et `salleDe`

Hors du § 6.3. `fermer` retirait de `salleDe` **tous** les membres de la salle,
sans regarder où chacun pointait. Or un joueur dont la grâce est épuisée reçoit
`nvn.error.slot_lost` à sa reprise, la page lui rouvre la préparation, et rien
ne l'empêche de repartir en file pendant que son premier duel continue sans
lui. À la fermeture du premier, son entrée — celle de son **second** duel —
était effacée : ses chants et ses cartes y étaient refusés pour
`nvn.error.not_in_duel`, et une page rechargée ne l'y remettait plus
(`duelEnCours` nul). `fermer` ne retire plus que les entrées qui pointent
encore sur la salle qu'elle ferme.

### 2. Le retour de flamme : aucune donnée nouvelle

Le chant porte `backfire: true`, et la poussée qui le suit garde le `userId` du
chanteur sous le `side` d'en face : c'est la seule poussée dont l'auteur n'est
pas du camp qu'elle sert, et la page la reconnaît sans champ de plus (l'auteur
figure dans `equipes[side ^ 1]` de l'état). Cette forme est désormais épinglée
par `nvn:smoke` (« le retour de flamme »). Un drapeau `retour` sur la poussée
aurait été plus lisible, mais il s'écrirait dans `engine.js`, fermé pendant
cette vague ; le poser dans le relais (`diffuser`) recopierait une règle du
moteur hors du moteur.

### 3. Les deux refus de reprise, épinglés

`nvn:net` éprouve désormais ce que la page lit pour quitter l'écran de jeu :
`nvn.error.slot_lost` tant que le duel court sans le joueur, et
`nvn.error.not_in_duel` une fois la salle fermée. Ce second refus est aussi ce
que reçoit un joueur **coupé au coup de sifflet** : `nvn:fin` ne part qu'aux
sockets connectées, et son bilan est perdu (ses gains, eux, sont versés). Le
garder pour la reprise relèverait du bilan (lot 6), pas de cette vague.

---

## `kop-amis` — écran (3 octobre 2026)

**Aucun champ de `CONTRATS.md` ne change.** La page du KOP lit deux choses
que le contrat ne nomme pas, chacune affichée seulement quand elle est servie.

### 1. `couleurs` sur `GET /api/kop/club/:teamId` (champ attendu, pas encore servi)

La carte d'un club suivi sans KOP (l'état de la plupart des joueurs) reprend
la tête d'un KOP : le nom du club en banderole, sur la bâche aux couleurs du
club. Ces couleurs ne sont servies qu'aux KOP du joueur (`/miens`,
`couleurs`, R1) ; `/api/me/state` ne les porte pas, et `/api/kop/club/:id`
non plus. La page lit donc `couleurs` sur `/api/kop/club/:teamId`, **de la
forme de `/miens`** (une ou deux teintes `#rrggbb`, absent sinon). Absent :
pas de bâche, l'écharpe du cadre aux couleurs du jeu — la règle « sans
couleur connue, la page ne la pose pas ». Besoin rendu au périmètre `social` :
la même jointure sur `teams` que `/miens` (`couleursDuClub(t.color1,
t.color2)`), une requête de rien, R1 tenu.

### 2. `GET /api/abonnement` (route existante, hors du chantier)

Créer un KOP demande le PASS DE TRIBUNE (`kop.error.abonnement`) ; rejoindre
reste libre. La carte d'un club sans KOP dit ce prix sous le geste, et un
joueur dont `abonne` vaut `false` voit la modale du PASS au lieu du champ du
nom (il apprenait le refus après avoir tapé un nom). Lu **une fois** par
visite, par `window.TBF_ABO` (une promesse sur la réponse, ou `null`), comme
`TBF_MOI` pour le compte ; une réponse sans `abonne` booléen laisse « on ne
sait pas », et la création suit son chemin d'avant. Le tiroir (`menu.js`)
pose aujourd'hui la même question de son côté : besoin rendu à
`barre-tiroir` pour qu'il reprenne la promesse.

**Repris (barre-tiroir, 3 octobre 2026).** Le tiroir lit
`window.TBF_ABO ??= fetch('/api/abonnement', …)` sous la même forme (le
corps d'une réponse réussie, `null` sinon, jamais de rejet) ; la boutique et
`/abonnement` la reprennent aussi. Banc sans base, chargement plus 2,5 s à
360 × 640 : un seul `GET /api/abonnement` sur `/kop`, `/boutique` et
`/abonnement` (deux sur `/abonnement` dès la base). Aucun champ ne change.

---

## `missions` — écran (3 octobre 2026)

**Aucun champ de `CONTRATS.md` ne change**, et la page ne lit rien de plus
qu'avant. Une chose servie n'est volontairement **pas** écrite.

### 1. `carnet.paliers[].insigne` n'est pas affiché

**Contrat** (§ 6.1) : un palier porte selon le cas `insigne` ∈ `"lisere"` |
`"tampon"` — le liseré S1 autour de l'avatar et le tampon S1 sur la carte de
supporter (`SERVEUR.md` § 5, paliers 2 et 3).

**Fait** : `/aide` ne l'écrit pas (il écrivait « INSIGNE » sur les deux
paliers, le même mot pour deux choses). Le titre du palier 5, si : `titres`
de `/api/rank/moi` le sert et le profil le montre.

**Pourquoi.** L'insigne du carnet est inscrit au grand livre au versement
(`recompenses.insigne`), mais aucune route ne dit qu'un joueur le porte, et
aucun écran ne le dessine : l'écran promettait une chose que le jeu ne
montrera pas. La note du périmètre `classement` (§ 4 ci-dessus : « pour
`quotidien` : lire les insignes du carnet en filtrant `source = 'carnet'` »)
n'a pas encore de route.

**Pour le rallumer** (besoins rendus) : `quotidien` sert les insignes portés
(par exemple `insignes: ["S1:lisere", "S1:tampon"]` dans `GET /api/quotidien`
ou `/api/rank/moi`, absent si aucun ; la forme est à fixer ici) ;
`profil-classement` dessine le liseré sur l'anneau du buste et le tampon sur
la carte de supporter. Alors `/aide` écrira « LISERÉ S1 » et « TAMPON S1 »,
avec leur petit dessin, sur le nœud du palier.

**Servi** (quotidien § 11, 3 octobre 2026) : `insignes` à la racine de
`GET /api/quotidien`, sous la forme d'objets `{ id, saison: { id, numero,
nom } }` et non de chaînes (`CONTRATS.md`, § 6.1). **Dessiné** (lot 4) : le
profil coud le liseré autour de l'anneau du buste et pose le tampon sur la
carte de supporter ; `/aide` écrit de nouveau « LISERÉ S1 » et « TAMPON S1 »,
avec leur petit dessin, sur les paliers qui les donnent, et ne montre posé
que l'insigne servi dans `insignes`.

---

## `profil-classement` — écran (3 octobre 2026)

**Aucun champ de `CONTRATS.md` ne change.** Le profil lit un champ que le
contrat ne nomme pas, affiché seulement quand il est servi, et une lecture
publique de plus ; le classement ne lit rien de nouveau.

### 1. `tribune.couleurs` sur `GET /api/rank/moi` (champ attendu, pas encore servi)

La carte de supporter du profil porte l'écharpe du club principal en bande
de tête (la direction : « l'écharpe aux couleurs du club principal
(`--e1`/`--e2`) »). La bande était toujours or et rouge, la teinte par défaut
de la brique : aucune réponse lue par le profil ne porte les couleurs d'un
club (`/api/me/state` sert `follows` sans elles). La page lit donc
`couleurs` sur `tribune` de `/api/rank/moi` — le club suivi que `maPlace`
choisit déjà, principal d'abord —, **de la forme de `/api/kop/miens`** (une ou
deux teintes `#rrggbb`, la principale d'abord, absent sinon), et ne la pose
que si `tribune.id` est bien le club principal de `follows`. Elle lit aussi
`couleurs` sur l'entrée de `follows`, si `/api/me/state` la portait un jour.
Absent : la bande garde l'or et le rouge du jeu, comme avant. Besoin rendu au
périmètre `classement` : `couleursDuClub(t.color1, t.color2)` (kop/index.js)
dans la requête de la tribune de `maPlace`, une jointure déjà faite sur
`teams`, R1 tenu (pas de clé vide, pas de clé si aucune teinte valide).

**Servi** (classement § 10) **et déclaré** (`CONTRATS.md`, § 14.2, le
3 octobre 2026), sous la forme décrite ici.

### 2. `GET /api/fanzzy/dex` lu par le profil (route existante, publique)

MON FANZZY montre la carte du Fanzzy équipé, dessinée par `cardHTML`
(cartes.js) à l'âge que l'avatar montre (`avatar.age` de `/api/rank/moi`,
ou de la barre). `cardHTML` a besoin du catalogue (familles, raretés) : le
profil le lit par `TBF_CARTES.chargerCatalogue()`, comme le kiosque, le
classeur et l'accueil. C'est une lecture **sans base** (la réponse est
calculée en mémoire), gardée une minute par le navigateur (`max-age=60`) :
pas une requête lourde de plus. Si elle échoue, la rubrique garde son texte
sans carte.

---

## `kiosque` — écran (3 octobre 2026)

**Aucun champ de `CONTRATS.md` ne change.** Le kiosque (`boosters.html`,
`cartes.js`) lit deux champs que le contrat ne nomme pas, **seulement s'ils
sont servis** ; absents, il fait ce qu'il fait aujourd'hui. Aucune requête de
plus.

### 1. `wallet.packMax` sur `GET /state` et `POST /open` (champ attendu, pas encore servi)

La réserve se dessine d'une seule règle (`reserveHTML`, cartes.js) : une
fente par place quand le plafond **de ce joueur** est connu et qu'il tient en
cinq places, le sachet et son compte sinon. Le plafond n'est servi nulle part
pour le joueur : `maxPacks`, à la racine de `/state`, est celui du joueur
gratuit (douze, quand un abonné en a vingt-quatre), et `/api/abonnement` est
une requête de plus. La page lit donc `wallet.packMax` (entier ≥ 1, le
`regle.plafond` que `wallet()` calcule déjà, abonnement compris). Absent :
le compte, sans « sur N » à l'écoute — c'est ce qui se dessine de toute façon
avec le plafond par défaut (douze, au-delà de cinq). Besoin rendu au
périmètre `fanzzy`.

### 2. `paye` sur `POST /open` (champ attendu, pas encore servi)

Le ticket « −45 · le booster acheté » se déduisait de l'écart entre un solde
local, relu seulement au chargement, et le solde rendu : un achat fait dans
un autre onglet le faisait annoncer pour un booster gratuit. La page ne pose
plus le ticket que pour un paquet **demandé à l'achat** (`buy: true`), et au
prix du booster ou pas du tout. Elle lit `paye` (entier ≥ 0, les écharpes
réellement prélevées par cette ouverture : `prixPack()` dans la branche
`buy`, 0 sinon) s'il est servi, et le préfère à sa déduction. Besoin rendu
au périmètre `fanzzy`.

---

## `serveur-correctif` — les salles du Grand Virage et le relevé du direct (4 octobre 2026)

**Un champ de plus au contrat : `surgeMs`** sur `virage:real_goal` et
`virage:state` (`CONTRATS.md` § 16.2). Aucun champ renommé ni retiré. Le
reste change le comportement de la salle et du relevé, et `CONTRATS.md`
§ 16.5 et § 16.6 le décrivent pour la page (déclaré d'abord « § 15 »,
reversé là à la fusion du lot 6, dont le § 15 est le bilan de tribune) ; ce
qui suit dit pourquoi, et ce que ça coûte.

Correctif hors lot, écrit sur la synthèse des défauts du Grand Virage
(D1, D2, D3 et les constats voisins qu'elle relevait, tous en ligne depuis
`e21a923`), et relu en cinq passes par trois relecteurs adverses. Fichiers :
`src/server/ferveur/index.js`, `src/server/ferveur/virage.js`,
`src/server/football/poller.js`, `src/server/football/routes.js`,
`server.js`. D4, D5 et D7 restent au lot 6 (§ 9).

### 1. D1 — une salle occupée n'est plus une salle à relever

`sallesOccupees()` rendait toute salle qui avait un membre, quel que soit le
match. Une salle finie restée ouverte — et le bilan garde les gens sur la
page après le coup de sifflet — payait un relevé du direct et un relevé
d'événements à chaque tour, jour et nuit : 1 440 appels par jour et par
salle, 21 % du budget codé de 6 800. Neuf salles dépassaient le budget, et le
quota épuisé figeait le direct de tout le site — scores, buts et
cartes-souvenirs compris. Un lien vers un match fini ou lointain suffisait.

**La règle** (`aRelever`, `ferveur/index.js`), pour une salle où quelqu'un
est assis, sur le statut vu en dernier :

| le match | relevé |
|---|---|
| terminé : `FT`, `AET`, `PEN`, `CANC`, `AWD`, `WO` | jamais ; le tour qui voit le coup de sifflet avait déjà dressé sa liste, et relève une dernière fois |
| statut qu'aucun relevé de ce processus n'a vu | une fois, tout de suite : la ligne en base peut dater de semaines — un report qui se rejoue sous le même numéro resterait figé |
| absent des réponses de l'API depuis plus d'une demi-heure | un coup d'œil par demi-heure, compté sur la dernière absence |
| reporté ou arrêté : `PST`, `ABD` | un coup d'œil par demi-heure : l'API peut le reprogrammer sous le même numéro |
| en attente : `NS`, `TBD`, `SUSP` | rien plus d'une demi-heure avant le coup d'envoi ; à chaque tour de la demi-heure d'avant aux quatre heures d'après ; au-delà, un coup d'œil par demi-heure. Une date illisible ne ferme rien |
| tout autre statut (en jeu) | à chaque tour, tant que quelque chose bouge (statut, minute, temps additionnel, score) ; immobile depuis une heure, un coup d'œil par quart d'heure, et le premier mouvement le rend à chaque tour |

Écart à la synthèse, qui proposait d'écarter les statuts finaux et de ne
garder un `NS` qu'à la demi-heure : un match à venir, suspendu, ou que l'API
laisse « en jeu » toute la journée coûtait autant qu'une salle finie, et la
borne sur l'immobilité, plutôt que sur l'heure, ne ralentit pas une reprise
après suspension, dont l'heure reste celle d'origine. Au pire, une salle au
coup d'œil de la demi-heure coûte 48 appels par jour ; un match laissé « en
jeu », au plus 450 (`salles-smoke`), contre 1 440 et 5 760.

**Ce que le relevé a vu survit aux salles** (`vusA`, `sansReponse`,
`mouvements`, par match, bornés comme les mémoires du relevé par les matchs
vus depuis le démarrage). Une salle libérée puis rouverte ne repaie pas le
relevé « une fois » d'un statut que le relevé venait d'écrire en base :
trente matchs lointains visités trois minutes par heure coûtaient sinon 720
appels par jour. **Ce regard peut vieillir** — un match regardé la veille,
puis avancé à aujourd'hui — : à l'entrée, la journée du football (le cache
de `/matchs`, sans appel de plus) le contredit sur le statut ou l'heure, et
il s'oublie (`oublierLeRegard`).

**L'heure du coup d'envoi part avec le statut.** `onStatus` porte
`kickoffAt`, la date de l'API, et la salle la prend : un match avancé ou
reculé gardait sinon l'heure lue à l'ouverture, et le relevé comme la
libération (§ 3) se décidaient sur une heure fausse.

**Un crochet de plus, `onAbsent`** : `server.js` → `createFootball` →
`createPoller`, branché sur `virage.matchAbsent`. Un lot du relevé du direct
**qui a répondu** sans un match demandé le signale, match par match. Un
match que l'API ne rend pas, ou plus — supprimé, renuméroté, dont la ligne
reste en base et qu'un lien ouvre encore — était relevé à chaque tour tant
que sa salle était occupée : 720 appels par jour, pour rien. Seul un lot
réussi le dit : un lot qui échoue (API en panne, quota épuisé) lève avant,
et une panne ne doit pas passer pour une disparition — au retour de l'API,
une salle en jeu aurait attendu sa demi-heure. Le signal part avant
l'écriture des lignes rendues, pour qu'une écriture qui lève ne le taise
pas. Un crochet passé n'est pas un crochet branché : `verif-cablage` le
vérifie dans `server.js`, puis en déroulant un tour de relevé où un seul
des deux matchs demandés revient.

**La ceinture, dans le relevé** (`poller.js`, `attendu`). Les événements
d'une salle ne se relèvent plus que pour un match en jeu, au plus un par
minute — **sauf au tour qui voit le match sortir du jeu** (coup de sifflet,
suspension, arrêt), qui relève une dernière fois sans attendre la minute :
les cartons du temps additionnel ont droit au fil, la porte d'une minute ne
s'ouvre qu'un tour sur trois à la cadence du direct, et au tour suivant la
salle finie n'est déjà plus au relevé. Au plus un appel par fin de match.

### 2. D2 et D3 — la salle se tient par socket, et garde ses partis

**D3.** La salle d'un supporter était rangée par joueur (`roomOfUser`), et
la déconnexion de **n'importe laquelle** de ses sockets la vidait : fermer
un onglet KOP, Équipes ou duel (le même espace de noms), ou perdre
l'ancienne socket d'un téléphone qui change de réseau après que la neuve est
entrée, et l'onglet resté ouvert recevait `not_in_virage` à chaque chant et
chaque carte jusqu'au rechargement. Avec deux onglets sur deux matchs, le
membre restait pour toujours dans la première salle, qui continuait de
payer son relevé (D1 sans aucun onglet). `ferveur/index.js` tient
maintenant ce que **chaque socket** a rejoint (`salleDeSocket`), et pour
chaque salle les sockets de chaque joueur (`socketsDe`). `detacher`, appelé
par la déconnexion et par `virage:leave`, ne fait rien pour une socket qui
n'a jamais rejoint, et le joueur ne quitte la salle qu'avec la dernière des
siennes. `virage:chant` et `virage:jouer` lisent la salle de la socket. Une
socket qui part pour un autre match quitte le premier.

**D2.** Un départ supprimait le membre, et le retour le recréait à neuf :
40 de souffle, une main neuve, les recharges et la fatigue effacées. F5, ou
« quitter la tribune » puis revenir, valait un « Nouveau souffle » et un
« Changement de chant » gratuits — et la ferveur ainsi gagnée s'écrit au
classement par `virage_presence` —, pendant que le joueur honnête perdait à
chaque coupure son rang et son souffle au-delà de 40. `VirageRoom.leave`
range maintenant le membre parmi les **partis** (`partis`), son souffle
arrêté à l'instant du départ ; `join` le reprend dans cet ordre : présent
dans un autre onglet, parti, ou neuf. Le souffle ne remonte pas pendant
l'absence (`regenAt` remis au retour) : `regen` lit son multiplicateur au
moment où il calcule, et compter l'absence au retour effacerait la fatigue
ou le revers d'une carte qu'on aurait fuis en sortant. Les recharges, la
fatigue et la carte suivante sont des instants, qui courent pendant
l'absence comme pour qui reste assis. Un parti ne compte ni dans la foule,
ni dans le rang, ni dans le battement, ni dans la Collecte d'un coéquipier.
D2 ne part pas sans D3 : sans lui, la déconnexion tardive d'une ancienne
socket enverrait parmi les partis le membre qu'une socket neuve utilise.

**Le camp** (`CONTRATS.md` § 16.5). C'est l'entrée qui le décide, et la
salle le pose tel quel. **Écart à la synthèse**, qui demandait de ne jamais
réécrire le camp d'un membre revenu : un camp **demandé** l'emporte, sinon
« je me suis trompé de camp, je ressors et je rechoisis » rendrait l'ancien
camp pour toute la vie de la salle, pendant que la page dessinerait
l'autre. C'est **sans demande** — la page qui se reconnecte renvoie
`virage:join` sans camp — qu'un neutre déjà connu retrouve le sien : il
n'est plus remis à domicile par le réseau. Chez soi, le camp découle du club
suivi à chaque entrée.

**Les entrées en vol.** `virage:join` lit la base pendant de longues
millisecondes. Chaque demande d'une socket, entrée ou sortie, est numérotée
**à la réception** (`demandes`), hors du filet qui lance le corps au tour
suivant de la boucle : un `virage:leave` arrivé dans le même paquet
passerait sinon devant. L'entrée qui revient de ses lectures ne s'assied
que si elle est encore la dernière demande de sa socket, et si la socket
est encore connectée — sinon un membre que plus rien ne sortirait gardait
la salle « occupée », et son relevé payé, jusqu'au redémarrage. Une salle
libérée pendant ces lectures est remise en place, ou l'on prend celle
qu'un autre a rouverte entre-temps ; et l'entrée pose `occupeeA` d'emblée,
pour qu'une salle vide ne soit pas libérée sous les pieds de qui y entre.

**Le rang « classé » se refait jusqu'à la première poussée.** La décision
était posée une fois, à la première entrée. Gardée au parti, une décision
jamais consommée laissait regarder trois tribunes au coup d'envoi,
ressortir, puis revenir chanter dans les trois — trois Virages classés sur
un plafond d'un : le compteur de l'abonnement lit les lignes de présence,
et une ligne n'existe qu'à la première poussée. La décision n'est donc
qu'une réservation tant que `presenceEcrite` est faux, et elle se pèse
après le détachement, contre le compteur moins les salles où le joueur est
assis sans avoir poussé (`reservees`). Les partis n'y sont pas : qui a
regardé une tribune sans chanter ne perd pas sa place dans celle où il va
jouer. Une panne du compteur ne ferme toujours rien.

### 3. La libération des salles

La ligne qui libérait une salle vide **n'avait jamais rien libéré** : elle
lisait `room.last`, que `tick()` pose à chaque battement juste avant elle.
Chaque match où quelqu'un était entré depuis le démarrage gardait sa salle en
mémoire, comptée en vie par le bilan de santé et l'administration. La
libération lit maintenant `occupeeA`, que le battement n'avance que s'il y a
quelqu'un, et que l'entrée et la sortie posent.

**Le délai suit le match** (`libre`), parce qu'une salle garde ce que la
base n'a pas — le score de la tribune, la corde, le fil, et les partis. La
libérer une minute après le dernier départ rendait tout ça au premier
téléphone verrouillé : seul en tribune, sorti à la mi-temps, on revenait à
40 de souffle, une main neuve et un 0–0 de tribune ; repartir à neuf
redevenait gratuit, au prix d'une minute. Donc : fini ou reporté, une
minute ; sinon, jamais entre la demi-heure d'avant le coup d'envoi et trois
heures après ; hors de cette fenêtre, une demi-heure de vide. **La fenêtre a
une fin, et elle compte** : une salle vide n'est plus relevée, et
n'apprendrait jamais le coup de sifflet d'un match qu'aucun club suivi ne
joue ; attendre son « FT » serait attendre pour toujours. Une salle vide ne
coûte aucun appel : `sallesOccupees` ne rend que les salles où quelqu'un est
assis. Les partis vivent autant que la salle, et partent avec elle.

### 4. Les buts annoncés : `estUnBut`, le premier relevé, le trou

**`estUnBut(e)`** (exporté par `poller.js`) : `type === 'Goal'`, ni
`detail === 'Missed Penalty'`, ni un commentaire `Penalty Shootout`.
`mapEvent` garde désormais `comments`, seul à distinguer un tir de la
séance d'un penalty du match (minute 120, type `Goal`). Les compter frappait
une carte-souvenir pour un ballon à côté, secouait la corde du côté qui
venait de rater, ouvrait la minute double, et décalait d'un cran le rang et
le score de tous les buts suivants du match — gravés sur leurs cartes.

**Le premier relevé ne rejoue pas les buts d'avant.** Un match qu'aucun club
suivi ne joue n'a rien dans `fixture_events` quand le premier supporter
entre dans sa salle : son premier relevé trouvait tous les buts déjà
marqués « jamais vus » et les annonçait — corde, minute double, score du
duel doublé, carte de présence pour qui n'y était pas. Le relevé retient
donc combien de buts étaient au tableau à son premier regard (`socles`), et
les range sans les annoncer. La ligne en base sert de point de départ quand
elle est fraîche — même période, à cinq minutes de jeu près
(`LIGNE_FRAICHE_MIN`) : celle qu'un redémarrage laisse, ou que l'ancrage
vient de poser —, et un but au-delà d'elle part. Quand la base a en plus
une histoire de ce match, c'est elle qui fait foi : un redémarrage annonce
encore les buts de la coupure qui n'avaient jamais été annoncés. Une base
vide ne vaut pas « premier relevé » : le socle d'un club suivi est posé
avant le coup d'envoi, à zéro, et tous ses buts partent comme avant. Le
socle descend avec un but refusé par la vidéo, sans quoi le but suivant
prendrait son rang et ne serait jamais annoncé. Un but, lui, n'est jamais
jugé frais à sa minute de jeu : l'horloge de l'API s'arrête aux pauses, et
un but de la 41e passerait pour frais un quart d'heure plus tard, à la
mi-temps, carte de présence comprise. Ce qui compte est ce que le processus
a vu, et quand.

**Un trou efface le socle.** Un match qui n'est plus demandé au direct
qu'au gré de sa salle, puis l'est de nouveau sans l'avoir été au tour
d'avant (`dejaDemandes`, `tourPrecedent`, `oublies`), repart comme au
premier regard, sur ce qu'on voit maintenant. Une tolérance de quelques
minutes laissait payer qui sortait : sorti à la 10e, revenu chanter à la
14e, on avait la carte du but de la 12e marqué salle vide, que celui resté
assis n'avait pas. Le trou se compte en **tours**, et c'est la **demande**
qui compte : un relevé qui demande sans obtenir (API en panne) n'a pas
cessé de regarder.

**Un but en avance attend le tableau** (`enAvance`). Dans un même tour, le
score vient du lot du direct et les événements d'un appel parti après : un
but marqué entre les deux est dans la liste, pas encore au tableau. Il était
rangé quand même, et au tour suivant la base le donnait pour déjà vu : il
n'était jamais annoncé. Il reste hors de la base et du fil tant que le
tableau ne le couvre pas. Un but refusé que la liste garde n'est jamais
couvert : jamais annoncé.

**Ce que ça coûte, et c'est assumé.** Un match relevé au coup d'œil perd
l'annonce des buts marqués entre deux coups d'œil (le score les porte, la
carte n'est pas frappée). Le seul occupant d'une salle qui recharge sa page
à l'instant où un tour dresse sa liste fait manquer ce tour à son match, et
un but marqué entre deux tours est alors rangé sans être annoncé. Un
redémarrage de plus de cinq minutes de jeu, ou qui enjambe un changement de
période, n'annonce pas les buts de la coupure ; une fraîcheur lue en temps
réel sur `polled_at` les distinguerait, au prix d'un calcul en SQL (voir la
note sur les fuseaux en tête de `ferveur/index.js`).

### 5. La minute double : `surgeMs`, et sa fin

`virage:real_goal` porte `surgeMs` (la durée, `RULES.surgeAfterRealGoalMs`)
et `virage:state` ce qui en reste. D6 de la synthèse était réfuté pour
aujourd'hui — aucune page ne lit `surgeUntil` — : le champ est préventif,
pour le chrono du lot 6, qui partira de la réception (R3). **Le défaut
voisin était réel** : le battement ne diffusait que si quelque chose avait
bougé, et l'expiration ne bouge rien. La salle retient la minute double
qu'elle a annoncée en dernier (`surgeDiffusee`), et un battement part dès
qu'elle change.

### 6. La Remontada se lit sur le vrai score

La condition « mené d'au moins un but » lisait `realGoals`, qui ne compte
que les buts vus tomber depuis l'ouverture de la salle : une tribune ouverte
à la soixantième minute d'un 0–2 y lisait 0–0 et refusait la Remontada à
ceux qui la jouaient à bon droit. Elle lit `scoreReel`, semé depuis la base
et recalé à chaque tour du relevé.

### 7. Le câblage de l'aide (reliquat du lot 4)

`server.js` passe `fanzzy` à `createAide`, et ne pose plus
`globalThis.fanzzy`, que personne d'autre ne lisait ; l'aide n'a plus de
repli sur la globale. Voir `fanzzy` § 1, « Écart refermé ». Gardé par
`verif-cablage` (sans base : l'appel lu dans `server.js`, et un versement
sur un faux pool) et par `aide-smoke`. Les trois mutations — `fanzzy` retiré
de l'appel, passé à `null`, la porte reçue ignorée par l'aide — font rougir
leur contrôle.

Et le repli ne revient pas sans rougir : construite sans `fanzzy`, une
`globalThis.fanzzy` posée, l'aide doit refuser comme sans porte et ne jamais
appeler celle de la globale (`verif-cablage`, « et par elle seule »). Lire
l'appel ne le voyait pas, et la trace du lot 4 décrivait la globale comme le
câblage à garder (§ 9) : qui l'aurait suivie aurait remis le repli sans toucher
à l'appel. La quatrième mutation — le repli du lot 4 remis tel quel dans
`aide/index.js` — fait rougir ce contrôle, et lui seul.

### 8. Pour les suites

- **`npm run salles:test`** (`scripts/salles-smoke.mjs`, nouvelle) : les
  salles avec le vrai `createVirage`, un faux `io`, de fausses sockets et un
  faux pool, **sans base, sans réseau et sans port** — la règle du relevé et
  sa mémoire, les partis, le camp, les sockets, les entrées en vol, la
  réservation du rang classé, la libération, la fin de la minute double, la
  Remontada.
- **`npm run releve:test`** (`scripts/releve-smoke.mjs`, nouvelle) : le
  relevé avec le vrai `createPoller`, un faux store et un faux client,
  **sans base** — `estUnBut`, le premier relevé, le trou, le but en avance,
  la ceinture, l'heure du coup d'envoi, `onAbsent`.
- `football-smoke` : un penalty manqué ne décale pas le but suivant ; un
  relevé qui découvre un match en cours ne rejoue rien et range tout ; la
  séance de tirs au but est relevée et rien n'en est annoncé ; au coup de
  sifflet, un relevé d'événements et un seul, même vingt secondes après le
  précédent.
- `virage-smoke` : `surgeMs` ; une salle finie sort du relevé sans que
  personne en soit chassé ; deux onglets puis un retour, avec de vraies
  sockets (camp, souffle, ferveur, recharge, carte refusée) ; la fin de la
  minute double ; la libération.
- `verif-cablage` : `onAbsent` branché et appelé pour le seul match omis ;
  l'aide (§ 7), et son refus de la globale.

Passage du 4 octobre 2026, sur la base locale `tbf`, à la file : `salles`
134 contrôles, `releve` 56, `cablage` 29, `football` 71, `virage` 189,
`souvenirs` 49, `virage:ui` 102, `nvn` 84, `aide` 47 — tous verts. Et les
deux suites qui montent aussi `createVirage` : `abo:smoke` 78 (dont le
plafond des Virages classés, que la réservation du § 2 touche) et
`quotidien-smoke` 216, vertes. Puis `cablage` seule, sans base, après le
refus de la globale (§ 7) : 30 contrôles, verts — le contrôle ajouté ne
change aucun module, les suites du dessus restent valables.

### 9. Ce qui reste, hors de ce correctif

- **La trace du lot 4 prescrivait encore la globale** (§ 7). *Repris le
  5 octobre 2026, avec l'appel qui la remplace* : le piège d'`ETAT.md` § 6
  garde sa leçon, le câblage au passé ; l'item d'`ETAT.md` § 7 bis, point 0,
  et celui d'`A-DEPLOYER.md` sont tombés ; `HISTORIQUE.md`, 4 quadragies
  quinquies, dit l'item refermé. Ce qui suit est le relevé d'avant la
  reprise. Relu le 4 octobre, sur `0638fb5` qui l'a commitée : cinq
  passages, dans trois fichiers, décrivent le câblage par
  `globalThis.fanzzy` comme celui d'aujourd'hui, et l'appel `createAide`
  sans `fanzzy` comme une dette ouverte. Aucun de ces fichiers n'est de ce
  périmètre. Les passages se
  reprennent **dans le commit même de ce correctif**, pas à sa mise en
  ligne : commité sans eux, le dépôt dirait ici de retirer la globale et
  là de la garder, et c'est `ETAT.md`, le fichier qu'on lit en arrivant,
  qui dirait de la garder. Pas tous de la même façon (lignes du 4 octobre,
  qui bougeront) :
  - `A-DEPLOYER.md`, « Ce qui reste en attente côté serveur » (ligne 240) :
    « ne pas retirer cette globale ». L'item tombe : c'est cette livraison
    qui le referme.
  - `ETAT.md` § 6, « Un correctif serveur peut n'exister que dans sa suite »
    (lignes 2709 à 2716). La leçon reste — un correctif vert en suite peut
    manquer en production —, mais le câblage passe au passé : `server.js`
    passe `fanzzy` à `createAide`, la globale et le repli sont partis,
    `verif-cablage` et `aide-smoke` lisent l'appel, et `verif-cablage`
    refuse le repli.
  - `ETAT.md` § 7 bis, point 0 (lignes 2806 et 2807) : « `server.js` ne
    passe pas `fanzzy` à `createAide` (l'aide le lit sur
    `globalThis.fanzzy`, § 6) ». L'item tombe.
  - `HISTORIQUE.md`, 4 quadragies quater : le piège (lignes 6102 à 6109) et
    l'item de « Ce qui reste » (lignes 6268 et 6269). Ceux-là ne se
    reprennent pas : c'est le journal d'une session datée, exact à sa date,
    et le journal ne se réécrit pas. C'est l'entrée de ce correctif qui dit
    l'item refermé.

  D'ici là, qui suit ces passages remettrait la globale et le repli. La
  globale seule ne ferait rien, l'aide ne la lit plus ; le repli rouvrirait
  les deux chemins que ce correctif ramène à un, et `verif-cablage` le refuse
  depuis (§ 7). Le piège d'`ETAT.md` § 6 n'en garde pas moins au présent une
  règle que le code a quittée. Jusqu'à cette mise en ligne, la production
  (`0638fb5`, en ligne depuis le 4 octobre vers 17 h 17) pose encore la
  globale et son aide la lit ; la branche du lot 6, à `7450c03`, aussi : à
  la fusion, c'est l'appel de ce
  correctif qui reste, et `verif-cablage` refuse aussi bien un `server.js`
  qui ne passe plus `fanzzy` qu'une aide qui relit la globale.
- **D4** : `virage:join` diffuse encore `virage:crowd` à toute la salle à
  chaque entrée, retour compris ; le battement suivant porte déjà la foule.
  Lot 6.
- **D5** : « Tu y étais. Elle est dans ton carnet. » s'affiche sur le seul
  camp du but, alors que la carte ne va qu'à qui a poussé dans les deux
  minutes ; il faut un `virage:souvenir` aux seuls receveurs, puis la page.
  Lot 6.
- **D7** : les seuils du verdict d'un geste, écrits en dur dans trois pages,
  et `perfectBonus` qui teste la note brute. Lot 6, après l'arbitrage de
  Gaël (Q3).
- **La page** (`virage.html`, lot 6) : elle ne quitte pas la salle au coup
  de sifflet — sans coût désormais —, et elle pose le nom du buteur par
  `innerHTML`.
- **La séance de tirs au but dans `fixture_events`** — demandée par
  l'accueil le 4 octobre 2026, optionnelle ; **refusée pour ce correctif**.
  `/api/football/fixture/:id/events` ne distingue pas un tir de la séance
  d'un penalty du match : `mapEvent` garde `comments`, mais `insertEvents`
  ne l'écrit pas, et la table n'a pas de colonne pour lui. Le hub le déduit
  du tableau (`buteurDe`, `index.html`) : une liste qui porte plus de buts
  d'une équipe que le score n'en compte ne fait nommer personne. La
  déduction se trompe dans le seul sens acceptable — elle tait, elle ne
  nomme jamais le mauvais —, et elle ne sert presque jamais : `buteurDe` ne
  part que quand le score monte, et un tir de la séance ne le fait pas
  monter. Seul y perd un but de prolongation que le hub découvrirait après
  le début de la séance : son buteur n'est pas nommé.

  Aucun des trois chemins ne vaut ce gain. **Une colonne** demande un `.sql`
  neuf (`ALTER TABLE fixture_events ADD COLUMN IF NOT EXISTS`), son rang
  dans `scripts/ordre-schema.mjs` et `store.js` — aucun n'est de ce
  périmètre —, et surtout une écriture qui tolère la colonne absente : le
  Manager n'applique jamais le schéma (`ETAT.md` § 2), et un `INSERT` qui
  nomme une colonne absente lève dans `pullEvents` **avant l'annonce des
  buts** — ni corde, ni minute double, ni carte-souvenir, pour aucun match,
  jusqu'à ce que le fichier soit appliqué. **Un marquage au rangement**,
  dans une colonne qui existe, change ce que lisent les autres : un `type`
  neuf ferait entrer chaque tir au fil du Virage (`matchEvents` n'écarte
  que `Goal`), dans un vocabulaire que `virage.html` ne traduit pas ; un
  `detail` réécrit mettrait en base un mot que l'API ne dit pas, perdrait
  « marqué ou manqué » ou l'encoderait, et devrait être réécrit pareil côté
  API pour que l'identité d'un événement (`identite`) corresponde encore.
  **Une mémoire du relevé**, que la route lirait, se perd au redémarrage et
  ne couvre pas un match fini : la page garderait sa déduction, plus un
  troisième état à lire.

  Le jour où la séance doit se lire au serveur — un fil des tirs au but au
  Virage, par exemple —, c'est la colonne qu'il faut, avec ses trois pièces :
  le `.sql` appliqué avant le code ; un `insertEvents` qui retombe sur
  l'ancienne liste de colonnes quand la nouvelle manque, et le dit au
  journal ; une suite qui casse exprès ce repli.

---

# Vague 2 — les arènes (lot 6)

Le plan est `SERVEUR-VAGUE2.md` ; le contrat, `CONTRATS.md` § 15 à § 18. Quatre
périmètres, quatre clés : `serveur-socle`, `serveur-virage`, `serveur-duel`,
`serveur-presence`. Chacun écrit ici, sous sa clé, ce qu'il a fait autrement
que le plan, et pourquoi ; un écart qui touche un champ du contrat le dit en
premier. `serveur-socle` verse le premier, avant que les autres commencent :
leurs parties suivront la sienne.

## `serveur-socle` (4 octobre 2026)

### 1. Ce que le contrat dit de plus, ou autrement, que le texte du plan (§ 7)

Le texte du plan a été collé, puis ajusté aux décisions de Gaël du 3 octobre
2026 (Q1 à Q4) et à la contre-expertise des défauts (D1 à D7). **Aucun champ
du plan n'est renommé ni retiré.** Ce qui change :

- **La grandeur du verdict** (§ 16.1). Le plan mesurait le verdict sur la note
  finale (`grade`, puis `applyHeroMods`, puis le plancher), « comme
  `perfectBonus` » — or `perfectBonus` lit la note **brute**. Un Fanzzy à
  `perfectBonus` 0,82 faisait d'un 0,95 un 0,779, écrit BON sur un geste que le
  moteur venait de juger parfait (D7). Le contrat mesure donc **la note brute,
  relevée par le plancher, avant les modificateurs** : c'est la recommandation
  de la contre-expertise, retenue avec la décision Q3. `src/shared/verdict.js`
  l'écrit une fois (`noteDuVerdict`). `quality` reste servie, et ne décide plus
  d'aucun affichage.
- **`cri: true` sur `virage:result`** (§ 16.2), absent en dessous. Q3 garde le
  Cri du Fanzzy au-dessus de 0,95 ; sans ce drapeau, `virage.html` garderait
  son `r.quality > 0.95`, un seuil écrit dans une page — ce que le lot retire
  partout. Mesuré comme le verdict.
- **`meilleur.nom`** (§ 15.1 et § 17), à côté de `chant` et `verdict`. Les pages
  ne chargent pas le répertoire (`src/shared/duel/chants.js`) : « PARFAIT sur LA
  MONTÉE » demanderait sinon une copie des noms dans chaque page (R7). Le duel
  sert déjà `chantPrefere.nom` de la même façon.
- **`GET` et `POST /api/presence` portent `actif`** (§ 18.2). Éteinte, la route
  répond `{ "actif": false }` en 200 — et non rien, ou 404 : le tiroir doit
  savoir s'il dessine l'interrupteur, et un 404 s'écrit en rouge dans la
  console du navigateur à chaque ouverture du tiroir. Éteinte, un `POST`
  n'écrit rien.
- **La fin de la minute double est diffusée** (§ 16.2) : `virage:tick` part avec
  `surge: false` dans les 100 ms qui suivent la fin. C'est le défaut voisin que
  la contre-expertise a trouvé en réfutant D6 (le tick ne part que si la salle a
  bougé : une salle calme gardait « TOUT ×2 » jusqu'au chant suivant). Le
  chrono de la page, calculé sur `surgeMs`, en a besoin pour s'arrêter juste.
  À faire par `serveur-virage`.
- **`prochain` défini exactement** : `rang` est le plus grand palier (100, 50,
  10, 3, 1) strictement meilleur que ma place ; `ecart` = sa ferveur − la mienne
  + 1. Le « sans palier en dessous de l'effectif » du plan ne peut pas arriver
  (1 est un palier) : `prochain` n'est absent qu'à la première place.
- **Le rang en direct suit l'ordre du bilan** (ferveur, puis chants, puis
  PARFAITS) ; le plan ne l'écrivait que pour le bilan. Avec le plancher de
  ferveur, les égalités sont rares, mais un même ordre aux deux endroits évite
  qu'un joueur se voie 11ᵉ en tribune et 12ᵉ au bilan pour la même ferveur.
- **`enJeu`** : l'exemple du plan (`"2v2": 78`) est faux ; le contrat donne les
  montants réels d'un match classé de son club (60, 70, 78, 88, 96). Et il dit
  pourquoi R9 tient : un format qu'un joueur gratuit ne peut pas jouer classé
  est **refusé à l'entrée** (`format_classe_abonne`, `duels_classes_epuises`),
  jamais payé autrement — le barème du `mode` du match vaut donc pour tous.
- **Les absences, écrites champ par champ** : un bilan sans ligne de présence
  n'a que `fixtureId`, `side` et `fini` (ni `xp`) ; `minute` et `joueur`
  absents quand le relevé ne les donne pas (souvenirs, `virage:souvenir`) ;
  `avatar` absent — et non `null` — sans Fanzzy dans `virage:amis` ; le
  `verdict` de la répétition absent quand `refuse` est posé ; après
  `virage:ferme`, `virage:bilan` répond `ferveur.error.not_in_virage`.
- **Ce que la page fait** au coup de sifflet : après son bilan, elle quitte la
  salle et n'y rentre plus, même à la reconnexion de sa socket (elle réémet
  aujourd'hui `virage:join` à chaque reconnexion, et rouvrirait la salle que
  D1 vient de fermer). Le refus de cadence d'un bilan n'est pas une erreur à
  montrer.
- **Le plancher de ferveur** (Q4) est écrit au § 16.2 : un chant accepté dont
  le verdict est au moins `moyen` crédite au moins 1, tous facteurs appliqués,
  chants seulement. Aucun champ nouveau : `ferveur` le reflète.

### 2. Le schéma : une instruction par ligne, et la note jusqu'à 1 200

`sql/arenes.sql` suit le plan (§ 3), avec deux précisions. **Une instruction
par ligne**, en plus d'une colonne par instruction : les suites du Virage
prennent les instructions de `quotidien.sql` ligne à ligne pour poser ou
retirer une colonne, et `serveur-virage` fera de même avec celles-ci ;
`schema-smoke` le vérifie. Et `meilleur_q` va **de 0 à 1 200**, pas 1 000 :
`grade` note certains gestes jusqu'à 1,2 (`SMALLINT UNSIGNED` les tient).

`schema-smoke` éprouve aussi le démarrage sur une base sans le fichier : il
retire les cinq colonnes et l'index, vérifie que `sql/arenes.sql` est nommé
avec ses cinq colonnes, le rejoue deux fois, et retrouve une base à jour.

### 3. `src/shared/verdict.js` : plus que les quatre exports du plan

`VERDICTS`, `SEUILS`, `verdictDe`, `estParfait`, comme prévu ; et
`SEUIL_CRI`/`criDe` (le Cri, ci-dessus), `auMoins(verdict, palier)` (le
plancher de ferveur s'écrit `auMoins(v, 'moyen')`), `noteDuVerdict(brut,
plancher)` (la grandeur mesurée, un nombre fini ≥ 0, prêt à écrire en
millièmes). Le module n'importe rien et ne lit ni `window` ni `process`.

**`scripts/verdict-smoke.mjs` existe depuis la partie B** (sans base, à
inscrire sous `verdict:smoke`, clé `paquet`). Dans la partie A, le fichier
n'était dans aucune liste de périmètre, et ses contrôles vivaient dans
`reglages-smoke` ; ils y ont été repris, et `reglages-smoke` ne garde que celui
qui parle du registre (aucun réglage ne porte le verdict). Voir 9.

### 4. L'interrupteur de la source `virage` est `xp.virage` à 0

`reglages-smoke` exige un interrupteur par source du grand livre, et ne
connaissait que des bascules. L'XP du Virage s'éteint par son montant :
`xp.virage` à 0 rend `inactif` (§ 15.2), comme le plan le dit. Une bascule de
plus aurait été un second levier pour la même porte. Le contrôle accepte donc
une bascule, **ou** un montant qui descend à 0 et dont l'aide dit ce que fait
le zéro.

### 5. Le grand livre : `quota`, et rien d'autre

`'virage'` entre dans `SOURCES`, `quota` dans `RAISONS` (la liste fermée du
§ 11) et dans les raisons qu'un recompte peut rendre. **`verser()` ne change
pas de forme** : le `manque` d'un `incomplet` reste dans la fermeture du
`verifier`, qui le garde et l'ajoute au bilan qu'il sert — `recompenses-smoke`
montre le motif. Un « déjà versé » reste `{ verse: false, raison: 'deja' }`,
sans le gain d'alors : le donner changerait la forme R6 de toutes les sources.

### 6. `deleteUser` : la préférence de présence, par une instruction à elle

Glissée dans l'instruction du quotidien, la colonne absente (base sans
`arenes.sql`) ferait lever l'instruction entière, et le repli tolérant
avalerait l'effacement de la dernière visite et des rangs vus. `auth-smoke` le
vérifie sur une base sans la colonne, en plus du cas du plan.

### 7. Hors de ma main dans cette partie

- `A-DEPLOYER.md` (au plan de `serveur-socle`) n'est pas touché : la trace de
  la livraison se fera à la fin du lot. `DEPLOIEMENT.md` nomme
  `sql/arenes.sql` et la manœuvre après le Manager.
- D1, D2, D3 et les salles jamais libérées sont corrigés à part, par un
  correctif serveur versé avant la partie B ; D4, D5, la fin de minute double
  et le reste du § 16 sont à `serveur-virage`.

### 8. Le contrat retouché après les rendus de la partie A (4 octobre 2026)

Les rendus de `serveur-duel` et de `serveur-presence` (plus bas) ont changé ce
que le serveur sert ; le contrat les suit. **Aucun champ renommé ni retiré.**

- **§ 18, § 18.2 et « Absence »** : sans `sql/arenes.sql`, la présence est
  **éteinte**, et non « lue au défaut du registre » comme le disaient le plan
  (§ 3, § 9.3) et la première version de ce contrat (écart 1 de
  `serveur-presence`). `/api/presence` rend alors `{ "actif": false }`.
  `DEPLOIEMENT.md`, le commentaire de `sql/arenes.sql`, l'aide de
  `presence.actif` et `CONFIDENTIALITE.md` disent la même chose.
- **§ 18.2** : le corps du `POST` se juge avant l'état (400 même éteinte) ;
  une panne inattendue rend 503 `presence.error.server`, code ajouté à la
  liste du § 11 ; en maintenance, la route répond 503. L'écran lit les deux
  503 comme une absence (R2), ce qu'il faisait déjà.
- **§ 18.3** : `virage:ami` part aux amis mutuels présents **cachés compris**
  (écart 2 de `serveur-presence`). Le texte le disait par « un joueur caché
  voit ses amis comme avant » ; il l'écrit maintenant à l'endroit de
  l'évènement.
- **§ 17** : l'absence d'`enJeu` est précisée — un match d'un jour passé,
  compté en jour UTC comme `mode` ; un match fini du jour même garde le sien
  (écart 3 de `serveur-duel`).
- **Non versé au contrat : `serie` sur l'évènement `chant` du duel**, que
  `serveur-duel` propose en option. Aucun écran du duel n'affiche de combo en
  jeu (`duel-nvn.html` ne lit `serie` qu'au bilan, § 17) : un champ promis
  que personne ne lit serait un champ de plus à tenir pour rien. À rouvrir si
  la critique du duel demande le combo — le compte existe déjà dans la salle
  (`comptes`, `nvn/index.js`), et le champ s'écrirait comme au § 16.2.

### 9. Partie B : le contrat suit le correctif du Virage et les rendus d'écran (4 octobre 2026, au soir)

La copie du lot repart de `7450c03` (le lot 4 en ligne), plus la partie A, plus
le correctif du Virage (D1, D2, D3, libération des salles, fin de la minute
double, `surgeMs`, penalty manqué, rejeu des buts). Le contrat décrivait ce que
le plan voulait ; il décrit maintenant ce que le serveur fait. **Aucun champ
renommé ni retiré.**

- **`surgeMs` est toujours servi sur `virage:state`**, et vaut 0 hors de la
  minute double (§ 16.2). Le contrat le disait « absent hors de la minute
  double » ; le correctif le sert toujours (`Math.max(0, surgeUntil − now)`),
  et la page ne décompte déjà que sur une valeur positive. Écrire le contrat
  sur le code plutôt que l'inverse : le correctif est relu en cinq passes, et
  ne se défait pas pour un champ que la page lit déjà juste.
- **§ 16.5, la salle d'une entrée à l'autre** (neuf) : une socket n'est pas un
  joueur (D3), les partis rendent leur état au retour (D2), un parti ne compte
  pas en direct, la durée de vie des salles et de leurs partis, le `camp` de
  `virage:join` (un camp demandé l'emporte ; sans camp, un neutre connu
  retrouve le sien ; chez soi, le club suivi décide), `classe` réservée
  jusqu'à la première poussée, l'entrée dépassée qui ne s'assoit pas. Rien de
  cela n'était écrit : la page se reconnectait en croyant repartir à neuf.
- **§ 15.1, `classe`** : décidée à l'entrée qui précède la première poussée, et
  non « à l'entrée ». Le plan (et le commentaire d'avant de `join`) la posait
  une fois pour toutes à la première entrée ; le correctif en fait une
  réservation, sans quoi regarder trois tribunes au coup d'envoi, ressortir,
  puis revenir chanter donnait trois Virages classés sur un plafond d'un.
- **§ 16.6, le but réel** (neuf) : `virage:real_goal` ne part ni pour un
  penalty manqué ni pour un tir de la séance (`estUnBut`), ni pour un but
  marqué avant que le relevé regarde le match (le socle du rejeu) ; un but en
  avance sur le tableau attend le tableau ; l'heure du coup d'envoi suit le
  relevé ; un match fini, reporté, absent de l'API ou immobile n'est plus
  relevé, ou seulement au coup d'œil (`onAbsent` et la libération). Les
  signatures internes sont sous `serveur-virage`, plus bas.
- **§ 15.3, la fin lue dans l'état** (besoin de `grand-virage`) : la page traite
  un `virage:state` au statut `FT`, `AET` ou `PEN` comme `virage:fin`. Aucun
  code ne refuse l'entrée dans un match fini — le § 11 n'en gagne donc pas ; si
  `serveur-virage` en crée un, il s'y ajoutera. Un match `CANC`, `AWD`, `WO`,
  `PST` ou `ABD` n'a ni `virage:fin` ni bilan au coup de sifflet. Une salle de
  match fini, vide, est libérée une minute après.
- **§ 17, les champs du duel servis en chemin** (besoin de `serveur-duel`) :
  `moi.userId`, `moi.effets[].duree`, `equipes[][].effets`, `side` sur
  l'évènement `effect`, `moi: true` sur sa ligne de `nvn:fin.joueurs[]`,
  `homeColors` et `awayColors` sur `/api/deck/matchs`, avec leurs absences
  pour un serveur d'avant. Vérifiés dans le code (`vuePour`, `jouerEtMarquer`,
  `effetsVus`, le bilan par socket, la liste de `deck/index.js`). Et deux
  phrases : pas de `serie` sur le chant (8, ci-dessus), pas de stade avant le
  coup d'envoi (`serveur-duel`, 9).
- **§ 18.2, l'écran après un `POST /api/presence`** (besoin de
  `barre-tiroir`) : seule `{ actif: true, visible }` garde l'interrupteur ;
  `{ actif: false }`, 400, 401, 503 ou une coupure le retirent, et l'ouverture
  suivante relit.
- **`scripts/verdict-smoke.mjs`** (plan § 6.1), sans base : le module à ses
  bornes, la note mesurée (D7), `perfectBonus` au seuil du PARFAIT, **le
  contrat qui recopie les mêmes nombres** (§ 16.1 et la ligne du Cri au
  § 16.2), **le serveur qui nomme par le module** (tout champ `verdict` écrit
  dans `src/server/` vient de `verdictDe`, ou recopie un verdict nommé — une
  seconde échelle écrite dans une salle, c'est D7 qui revient), et un module
  sans dépendance. Le détecteur s'éprouve lui-même sur des lignes fabriquées.
  Douze mutations, faites dans une copie hors du dépôt pour ne toucher aucun
  fichier d'un autre périmètre, ont toutes rougi. `paquet` l'inscrit sous
  `verdict:smoke` : sans cela, `tout-tester` ne la lance pas.
- `recompenses-smoke` (103 `ok`), `abonnement-smoke` (81) et `auth-smoke` (72)
  relancés sur `test_lot6` après la fusion : verts. Leurs fichiers et le code
  qu'ils éprouvent n'ont pas bougé depuis la partie A ; la fusion avec le lot 4
  ne leur a rien retiré.

### 10. Partie B, les besoins : le contrat suit le serveur écrit (4 octobre 2026, au soir)

Les rendus de `serveur-virage`, `serveur-duel` et `serveur-presence` de la
partie B, et une demande de `duel-tribunes`, ont changé ce que le serveur sert
ou précisé ce qu'il fait. Chaque point a été relu dans le code avant d'être
écrit (`ferveur/index.js`, `ferveur/virage.js`, `ferveur/bilan.js`,
`souvenirs/index.js`, `deck/index.js`, `nvn/index.js`). **Aucun champ renommé
ni retiré.** Leurs écarts sont versés sous leur clé, plus bas.

- **§ 15.1** : la salle accepte encore les chants entre le coup de sifflet et
  `virage:ferme`, et ils comptent ; un bilan `fini` lu dans la lecture groupée
  ne les voit pas pendant ses deux minutes. Le socle avait laissé la question
  ouverte (« refuser les chants après le coup de sifflet rendrait le bilan
  exact ») : `serveur-virage` n'a pas ajouté de code d'erreur, et le contrat
  le dit au lieu de promettre des chiffres définitifs.
- **§ 15.2** : le filet de l'XP au départ part quand **aucun bilan ne l'a
  réglée** (versée, ou « déjà »), et non seulement « si la page n'en a demandé
  aucun » ; un `incomplet` ou un `quota` ne la règlent pas, et il ne part que
  pour un joueur qui a chanté dans la salle depuis son ouverture.
- **§ 15.3** : `virage:ferme` part `virage.bilan_min` minutes après le plus
  tardif du coup de sifflet et de **l'arrivée du joueur** (sa première
  socket, retour de parti compris) ; une salle ouverte sur un match fini arme
  ce délai à son ouverture, sans `virage:fin` ; `CANC`, `AWD`, `WO` (et
  `PST`, `ABD`) n'ont pas non plus de `virage:ferme`. Le texte d'avant (« cinq
  minutes après le coup de sifflet ») aurait mis dehors, au battement suivant,
  qui recharge sa page après la fin.
- **§ 15.4** : sans session, `auth.error.unauthenticated` ; la cadence de cinq
  secondes compte toute demande avec session, `not_in_virage` comprise.
- **§ 16.2** : le plancher de ferveur ne s'applique pas sous un bonus de
  ferveur nul (« ne compte pas au classement » ; aucune source n'en pose
  aujourd'hui, ni KOP, ni stade, ni Fanzzy, ni effet).
- **§ 17** : `fixture.homeColors` et `fixture.awayColors` dans la route d'un
  match, `nvn:start` et `nvn:state` ; `enJeu` sur `GET /api/deck/match/:id`
  (toujours sur un 200 : la route refuse ce qui est fermé) ; le jour d'un
  match, une seule fonction, en jour UTC de l'instant du coup d'envoi ; aucun
  match `CANC` ou `PST` dans la liste, et `duel.error.fixture_annule` à
  l'entrée. Le code entre au § 11. Les champs de la partie A (`moi.userId`,
  `duree`, `equipes[][].effets`, `side`, `moi: true`, couleurs de la liste)
  y étaient déjà depuis le point 9 : la demande les retrouvait absents parce
  qu'elle avait été écrite avant lui.
- **§ 18.2 et § 18.3** : `virage:ami` `present: false` part à ceux à qui sa
  présence a été dite (son entrée, ou leur `virage:amis`), sans relire la
  visibilité : un ami visible à l'entrée puis caché est annoncé à son départ à
  ceux qui l'ont vu entrer. Le texte d'avant (« un ami caché n'est annoncé ni
  à l'entrée, ni au départ ») laissait ce cas dans un « AMIS ICI » qui ne se
  vidait plus. Ce qu'est une entrée est écrit.
- `CONFIDENTIALITE.md` le dit aussi : se cacher dans une tribune où l'on est
  déjà ne retire pas sa présence à ceux qui vous y ont vu entrer ; ils
  apprennent votre départ.

**Refusé, et pourquoi.**

- **`serie` sur l'évènement `chant` du duel**, que `serveur-duel` propose de
  nouveau. Même raison qu'au point 8 : `duel-nvn.html` ne lit `serie` qu'au
  bilan (`nvn:fin`), et aucun écran du duel ne dessine de combo en jeu — un
  champ promis que personne ne lit est un champ de plus à tenir. Le compte
  existe et l'ajout tient en une ligne : à rouvrir si la critique du duel
  demande le combo, au § 17, comme au § 16.2.
- **Le stade du duel** (`serveur-duel`, 9) : déjà versé à la partie A, et
  toujours à trancher par Gaël ; rien de plus au contrat que la phrase du
  § 17 (« pas de stade avant le coup d'envoi »).

`scripts/verdict-smoke.mjs` gagne une section : la note écrite en millièmes
(`enMilliemes`, `ferveur/virage.js`) garde son verdict, parce que les seuils
sont des millièmes exacts et que l'arrondi va vers le haut (`serveur-virage`,
5). Elle est éprouvée sur toutes les notes de 0 à 1,2 au millième, et autour
de chaque seuil ; un arrondi au plus proche la fait rougir.

## `serveur-duel` (4 octobre 2026)

1. **Le verdict du duel se mesure par un rejeu de `grade`**, dans
   `nvn/index.js` (`noteMesuree`, appelée par `chanterEtNommer`), juste avant
   le moteur. `engine.js` ne sert que la note finale (`quality`, après
   `applyHeroMods`), et l'on ne remonte pas d'une note finale à la note
   mesurée (§ 16.1). Le rejeu **recopie la composition des modificateurs de
   `modsDe`**, privée dans `engine.js` (`avecLieu`, exporté, puis
   `modsAvecEffets`). Un garde-fou, à chaque chant, vérifie que la note
   rejouée passée par `applyHeroMods` retombe sur la `quality` du moteur
   (trois décimales, retour de flamme compris) : sinon le journal le dit une
   fois, et un chant que le rejeu n'a pas su noter n'est pas nommé.
   `nvn-smoke` le vérifie sur environ 383 chants. **Si `engine.js` change un
   jour `modsDe`, c'est là qu'il faut regarder.**
2. **`GAIN` et `DOUBLE_CLUB` ont déménagé dans `deck/index.js`**, exportés ;
   `baseDuDuel(mode, format, gagne)` est la formule unique du versement (la
   fin du duel, dans `nvn`) et de l'annonce (`enJeu`). Ce qui est promis est
   ce qui est versé.
3. **`enJeu` manque quand le jour du match est passé**, compté sur l'horloge
   UTC de la liste, la même que `mode` : c'est le refus de `matchSupport`
   (`duel.error.fixture_past`). Un match fini du jour même reste ouvert.
4. **`estEnDuel` compte une coupure dans la grâce comme « en duel »** : le
   joueur peut revenir à sa place pendant ces quatre-vingt-dix secondes ; sa
   grâce épuisée (`parti`), il ne l'est plus. Une file d'attente, quel qu'en
   soit le format, compte aussi.
5. **À égalité de note, le premier chant reste le meilleur**, la même règle
   que `meilleur_chant` au Virage.
6. **Le verdict de la répétition se mesure sur la note bornée à 1**, celle que
   la route sert. La borne ne change aucun mot : tout ce qui dépasse 0,9 est
   `parfait`.

L'option d'un `serie` sur l'évènement `chant` n'est pas versée au contrat :
voir `serveur-socle`, 8.

**Servi en chemin, versé au contrat (§ 17) le 4 octobre au soir** : `moi.userId`,
`moi.effets[].duree`, `equipes[][].effets`, `side` sur l'évènement `effect`,
`moi: true` sur sa ligne du bilan, `homeColors`/`awayColors` sur la liste des
matchs. Le plan ne les prévoyait pas ; la page du duel en avait besoin pour
savoir qui elle est en 3 contre 3, tracer l'anneau d'un effet, montrer ce que
porte la tribune d'en face et teindre l'arène. Les trois écarts qui suivent en
viennent.

7. **`/api/deck/matchs` fait une lecture de plus par liste**, pour les
   couleurs : par clé primaire, au plus 120 clés, comme la liste du Virage.
   Protégée : une base sans `sql/couleurs.sql` répond sans couleurs (des
   tableaux vides, jamais absents). *(À la partie A, `duel-nvn.html` ne les
   lit pas encore : l'arène garde ses teintes de camp.)*
8. **`side` est posé sur tout évènement `effect` dont l'effet s'est posé sur un
   seul camp**, et pas seulement sur ceux à `cible: 'adverse'`. Les effets se
   lisent dans l'état du moteur avant et après la carte (`jouerEtMarquer`) :
   `engine.js` n'a pas bougé, et un Renvoi, un revers ou un effet de plus
   passent par le même constat, sans copie d'`appliquer`.
9. **Risque, non corrigé : le stade du duel est tiré sur l'identifiant du duel**
   (un `randomUUID()`, `engine.js`), et non sur le match. Deux duels sur le
   même match tombent dans deux stades différents, contre « le stade
   appartient au match » (`stades.js`, le brief) et contre le commentaire même
   du moteur. La correction tient en une ligne dans `engine.js` (la graine
   `Number(fixture?.id)`, repli sur `hachage(id)`), mais `engine.js` est hors
   du lot, `niveau-smoke` et trois suites le lisent, et c'est une règle de
   jeu : **à trancher par Gaël**. C'est pourquoi la préparation n'a pas de
   stade-mini (`duel-tribunes`, plus bas) ; écrire `duel.stade` après coup
   depuis `nvn/index.js` ferait le même changement en cachette.

Deux constats de la partie A, non corrigés, antérieurs au lot *(corrigés à
la partie B : voir 10 et 11, plus bas)* :

- la journée du football **réinjecte dans la liste du duel des matchs `CANC`
  ou `PST`** que la requête SQL écarte, et `matchSupport` les accepte : ils
  portent donc un `enJeu` tant qu'il les accepte. Changer qui figure dans la
  liste toucherait l'écran et `deck-smoke` ;
- pour un match venu de la journée **près de minuit**, le jour de la liste
  (date UTC du coup d'envoi, qui décide `mode` et `enJeu`) peut différer de
  celui de `matchSupport` (`String(date).slice(0, 10)`). `enJeu` suit le jour
  de la liste pour ne jamais contredire le `mode` de la même ligne ; dans ce
  cas limite, il peut manquer sur un match que `matchSupport` accepte.

Non servis, faute d'être au contrat : `enJeu` sur `GET /api/deck/match/:id`
(seule la liste le sert) ; le drapeau `cri` au duel (la page du duel n'a pas de
Cri) ; les couleurs des clubs dans la vue du duel (`nvn:start`) — la page les a
déjà dans la liste qu'elle charge, reprise comprise ; `gains.wallet` dans
`nvn:fin`, que `duel-tribunes` demande en option (la page le relaierait dans
`tbf:bourse`). *(À la partie B, `enJeu` sur la route d'un match et les
couleurs dans la vue sont servis et versés au contrat : voir 14 et 15.
`gains.wallet` ne l'est toujours pas : voir 13.)*

### Partie B (4 octobre 2026, au soir)

10. **Le jour d'un match support est le jour UTC de l'instant du coup
    d'envoi**, calculé par une seule fonction (`journeeDuMatch`,
    `deck/index.js`) pour la liste, la route d'un match et l'entrée en file.
    `matchSupport` ne lit plus `DATE()` ni `UTC_DATE()`, ni les dix premiers
    caractères d'une date servie avec son décalage (« 01:30+02:00 », la veille
    à 23:30 en UTC, que la liste annonçait classée et que l'entrée montait en
    entraînement). **Ce n'est pas le « jour de jeu » des quotas**
    (`CURDATE()`, R4) : c'est le jour UTC que `deck/index.js` a toujours
    employé pour `mode`, et il décide maintenant aussi de l'entrée. Versé au
    contrat (§ 17).
11. **`SANS_DUEL` (`CANC`, `PST`) s'applique après la journée superposée, et
    à l'entrée.** La requête de la liste écartait ces matchs, mais la journée
    du football, qui se superpose à la base, les y remettait avec leurs
    écharpes en jeu, et l'entrée les acceptait en classé. La liste ne les
    propose plus, et la route d'un match comme l'entrée en file les refusent
    avec un code nouveau, `duel.error.fixture_annule` (route : 400
    `{ error }` ; file : `nvn:error { code }`). Versé au contrat (§ 17, § 11).
    `duel-nvn.html` le dit par une phrase, quitte la file et relit la liste.
12. **Risque non corrigé, toujours ouvert** : le stade du duel est tiré sur un
    `randomUUID` (`engine.js`) et dans l'intersection des possessions
    (`ETAT.md` § 3) ; il n'est donc connu qu'après l'appariement, d'où
    l'absence de stade-mini à la préparation. C'est le point 9, à trancher par
    Gaël ; rien de plus dans cette partie.
13. **`gains.wallet` n'est pas servi dans `nvn:fin`** : R6 veut la réserve de
    packs recharge comprise, qu'il faudrait relire pour chaque joueur à la fin
    du duel. `tbf:bourse` part donc sans `wallet`, et `nav.js` relit le solde
    (`duel-tribunes`, 4 ; `barre-tiroir`, 2).
14. **`enJeu` est ajouté à la route d'un match** (`GET /api/deck/match/:id`),
    et non à `matchSupport` : le duel emporte ce support tel quel, et un
    entraînement contre les bots, qui le recopie en changeant le mode, y
    garderait un montant classé qu'il ne paierait pas. Calculé sur le `mode`
    que la route sert, par `enJeuDe`, la formule de la liste ; toujours là sur
    un 200. Aucune page ne lit encore cette route. Versé au contrat (§ 17).
15. **Les couleurs des clubs sont dans l'objet `fixture`** de la route d'un
    match, de `nvn:start` et de `nvn:state` (`fixture.homeColors`,
    `fixture.awayColors`, la forme de `virage:state.fixture`) : une lecture
    de plus à l'entrée en file (les deux clubs, par clé primaire, en même
    temps que le club suivi), par la fonction de la liste, qui rend des
    tableaux vides plutôt que de lever. La page les prend dans la vue
    d'abord, dans la liste à défaut. Versé au contrat (§ 17).

**Proposé, non versé** : `serie` (entier ≥ 0, sens du § 16.2) sur l'évènement
`chant` du duel, pour un combo en jeu. Voir `serveur-socle`, 10 : aucune page
ne le lirait aujourd'hui.

## `serveur-presence` (4 octobre 2026)

1. **Sans la colonne `user_wallet.presence`** (`sql/arenes.sql` non
   appliqué), **la présence se comporte comme éteinte** : `GET` et `POST
   /api/presence` rendent `{ actif: false }`, rien n'est servi, un nouvel
   essai a lieu dix minutes plus tard, et le journal nomme `sql/arenes.sql`
   une fois. Le plan (§ 3, § 9.3) disait « se lit au défaut du registre » ;
   mais sans colonne personne ne peut se cacher, et servir la présence
   promettrait à des mineurs un interrupteur qui ne marche pas. Versé au
   contrat (§ 18.2).
2. **`aPrevenir(userId, ids)` s'ajoute à `amisPresents`** : le § 18.3 envoie
   `virage:ami` à tous les amis mutuels présents, cachés compris, alors que la
   liste du plan ne gardait que les visibles. Les deux listes diffèrent
   exactement là où la règle se joue : `amisPresents` filtre sur la
   visibilité des amis (ce que l'entrant reçoit), `aPrevenir` sur celle de
   l'entrant (à qui on l'annonce). `serveur-virage` lit les deux.
3. **Une panne inattendue de `/api/presence` → 503 `{ error:
   'presence.error.server' }`**, code nouveau, ajouté au § 11. La page le lit
   comme une absence (R2).
4. **Le corps du `POST` se juge avant l'état de la présence** : 400
   `presence.error.requete` même éteinte.
5. **Éteinte, rien n'est gardé en mémoire** : `noter` ne note rien, et
   l'extinction ou une colonne absente vide toute la mémoire (activité, amis,
   choix). Allumée, le ménage efface à chacun de ses passages toute marque
   d'activité qui ne dit plus « en ligne ». Il passe avec une activité, une
   fois par minute au plus : sur un serveur qui sert des joueurs, une marque
   est donc effacée au plus une minute après avoir cessé de dire « en ligne ».
6. **`etatsPour` revérifie la mutualité et le statut actif** de chaque
   identifiant au lieu de croire la liste que `/api/amis` lui passe ; et
   `amis/index.js` prévient la présence (`oublierAmis`) à chaque amitié
   acceptée, refusée, retirée ou parrainée, pour que le changement vaille sans
   attendre les deux minutes de la mémoire.
7. **Le crochet d'activité est un `app.use('/api', …)` de `server.js`**, posé
   juste après `attachUser` : `attachUser` appartient à `auth/routes.js`, hors
   du périmètre. Une socket qui se connecte note aussi une activité.
8. **`/api/presence` est monté après la fermeture du jeu** : en maintenance,
   il répond 503, comme une absence.
9. **Les deux arènes se lisent par `Boolean(await fn(id))`**, synchrones ou
   non : une promesse serait « vraie » pour un simple `if`, et tout le monde
   serait au Virage. Une arène qui lève ne fait pas tomber la liste d'amis :
   l'état n'est pas servi, et le journal le dit une fois.

*Partie B (4 octobre 2026, au soir).*

10. **`server.js` passe `niveau` à `createVirage`** : le bilan verse l'XP du
    Virage par le grand livre, qui lève sur un gain d'XP sans module de
    niveau. C'est conforme au plan (§ 6.2, « Dépend de
    `niveau.gagnerDans` »), mais le plan ne disait pas qui le passait ;
    `verif-cablage` le contrôle.
11. **`aPrevenir` ne lit le choix de l'entrant que s'il a au moins un ami
    mutuel dans la salle.** Une entrée dans une tribune coûte donc, à la
    présence, une lecture des amis (gardée deux minutes, partagée par les
    demandes simultanées), et une seconde — sa préférence — seulement quand
    il y a quelqu'un à prévenir. Le plan (§ 11) disait « la présence en
    ajoute une ». Aucun champ du contrat ne change.

## `serveur-virage` — le correctif versé avant la partie B (4 octobre 2026)

Les défauts D1, D2 et D3 du plan (§ 5), et trois voisins confirmés en chemin
(des salles jamais libérées, le penalty manqué, le rejeu des buts), ont été
corrigés à part, dans une copie isolée, et relus en cinq passes (justesse,
triche, enveloppe de l'API), **avant** la partie B. Fichiers de
`serveur-virage` (`ferveur/index.js`, `ferveur/virage.js`,
`football/poller.js`, `football/routes.js`), plus une ligne de `server.js`.
Suites : `virage-smoke` et `football-smoke` retouchées ; `salles-smoke`
(`salles:test`) et `releve-smoke` (`releve:test`), neuves et sans base. La
partie B se bâtit dessus et ne le défait pas. Ce que les écrans en voient est
au contrat (§ 16.2, § 16.5, § 16.6) ; ce qui suit dit en quoi il s'écarte du
plan, et les signatures internes qu'il pose.

1. **D1, plus finement que le plan.** Le plan sortait du relevé toute salle au
   statut final, `PST` et `ABD` compris. Le correctif distingue :
   - `FT`, `AET`, `PEN`, `CANC`, `AWD`, `WO` : la salle ne fait plus relever
     le match ;
   - `PST`, `ABD` : un coup d'œil par demi-heure — l'API peut reprogrammer un
     match sous le même numéro, qui repasse alors « à venir » ;
   - `NS`, `TBD`, `SUSP` : relevé de la demi-heure qui précède le coup
     d'envoi jusqu'à quatre heures après, puis au coup d'œil ;
   - un match « en jeu » immobile depuis une heure (ni statut, ni minute, ni
     score ne bougent) : un coup d'œil par quart d'heure — l'API laisse
     parfois un match en jeu des heures après la fin, et l'onglet resté
     ouvert sur le bilan est justement celui de D1 ;
   - un match que l'API ne rend plus (`onAbsent`, point 10) : une demi-heure
     comme avant, puis un coup d'œil par demi-heure.

   Le « regard » (quand un relevé a vu le match) est tenu **par match, et non
   par salle** : une salle libérée puis rouverte ne repaie pas un statut que
   le relevé venait d'écrire, et la journée du football corrige ce regard à
   l'entrée s'il a vieilli (match avancé, reprogrammé). Ceinture dans le
   relevé : un match qui n'est pas en jeu ne paie plus de relevé d'événements,
   sauf au tour qui le voit sortir du jeu (les cartons du temps additionnel),
   pour un appel au plus par fin de match. **`virage:ferme` (Q11) n'est pas
   dans le correctif** : il revient à la partie B, en accord avec la
   libération ci-dessous.
2. **La libération, qui n'existait pas.** `tick()` posait `last = now` juste
   avant le test « vide depuis une minute » : aucune salle n'était jamais
   libérée, la mémoire grossissait jusqu'au redémarrage. La salle tient
   maintenant `occupeeA`, le dernier instant où quelqu'un y était. Elle est
   libre quand elle est vide (ni membre, ni socket) depuis une minute pour un
   match fini, reporté ou arrêté ; sinon depuis une demi-heure, et hors du
   créneau où le match peut se jouer (de la demi-heure avant le coup d'envoi à
   trois heures après). Libérée, elle emporte ses partis.
3. **D2, comme le plan, et un cran plus loin.** `leave` garde le membre parmi
   les `partis` (son souffle arrêté à l'instant du départ), `join` le lui
   rend : souffle, main, pioche, recharges, fatigue, effets, ferveur. Un parti
   ne compte ni dans la foule, ni dans le rang, ni dans le battement, ni dans
   la Collecte d'un coéquipier. **`classe` devient une réservation** jusqu'à
   la première poussée (`presenceEcrite`), et `reservees()` compte celles des
   autres salles du joueur. Le plan la posait une fois pour toutes à la
   première entrée : gardée au parti, la décision laissait regarder trois
   tribunes au coup d'envoi, ressortir, puis revenir chanter dans les trois au
   rang « classé » — trois Virages classés sur un plafond d'un.
4. **D3, par socket.** `salleDeSocket` (socket → `{ fixtureId, userId }`) et
   `socketsDe` (match → joueur → ensemble de sockets) remplacent `roomOfUser`.
   On ne quitte la salle qu'à la dernière socket ; une socket qui change de
   match quitte le premier ; une socket qui n'a jamais rejoint ne fait rien en
   partant. Les demandes de chaque socket sont numérotées (`demandes`) : une
   entrée dépassée par un départ ou par une autre entrée ne s'assoit pas, et
   une socket fermée pendant les lectures de son entrée n'entre pas — sinon le
   fantôme gardait une salle « occupée », et son relevé payé, jusqu'au
   redémarrage. C'est la table que `virage:souvenir` et `virage:ami` liront
   (partie B).
5. **Le camp d'un neutre revient avec lui.** La page qui se reconnecte réémet
   `virage:join` sans camp, et un neutre parti pousser à l'extérieur était
   remis à domicile, au milieu de sa tribune et de son rang. Un neutre que la
   salle connaît retrouve le sien ; un camp demandé l'emporte ; chez soi, le
   club suivi décide. Versé au contrat, § 16.5.
6. **La fin de la minute double part, et `surgeMs`** (D6, que le plan donnait
   à `serveur-virage`) : `tick` diffuse dès que `surge` change, même dans une
   salle où rien ne bouge ; `virage:real_goal` porte `surgeMs` (60 000),
   `virage:state` ce qu'il en reste (0 hors de la minute double : voir
   `serveur-socle`, 9).
7. **Le but réel** (deux voisins confirmés). `estUnBut(e)` écarte le penalty
   manqué et chaque tir de la séance de tirs au but (l'API les range sous
   « but » ; seul `comments` distingue la séance, et `mapEvent` le rend
   désormais). Le **socle** d'un match (`poserSocle`, `LIGNE_FRAICHE_MIN` =
   cinq minutes de jeu) : un but déjà au tableau quand le processus regarde le
   match pour la première fois — ou de nouveau après un tour sans le demander
   (`oublies`) — est rangé sans être annoncé. Un but en avance sur le tableau
   reste hors de la base et du fil jusqu'à ce que le tableau le couvre. Ce que
   ça coûte, et c'est assumé : un redémarrage de plus de cinq minutes de jeu
   n'annonce pas les buts de la coupure, et le seul occupant d'une salle qui
   recharge pile au tour du relevé peut faire manquer l'annonce d'un but à sa
   salle (le score le porte, la carte n'est pas frappée).
8. **La Remontada lit `scoreReel`**, et non `realGoals` (les buts vus depuis
   l'ouverture de la salle) : une tribune ouverte à la soixantième minute d'un
   0–2 y lisait 0–0 et refusait la carte à bon droit jouée.
9. **L'heure du coup d'envoi** part avec le statut (`onStatus(id, { …,
   kickoffAt })`), et la salle la met à jour : un match avancé ou reculé
   décidait sinon de son relevé et de sa libération sur une heure fausse.
10. **Signatures internes nouvelles.** `createPoller({ …, onAbsent })` et
    `createFootball({ …, onAbsent })` : un lot du direct qui a **répondu**
    sans un match demandé le signale, un lot en panne ne signale rien (une
    panne ne doit pas passer pour une disparition). `server.js` le branche à
    `virage.matchAbsent(fixtureId)`, que `createVirage` rend désormais.
    `poller.js` exporte `estUnBut` et `LIGNE_FRAICHE_MIN`. `verif-cablage`
    garde le branchement de `onAbsent`.
11. **Ce qui reste à la partie B, sous cette clé** : D4 (la diffusion
    `virage:crowd` à l'entrée est toujours là), D5 (`mintGoal` ne rend pas
    encore ses receveurs), le verdict servi au Virage (D7), le bilan et l'XP,
    `virage:fin` et `virage:ferme`, le plancher de ferveur, `estAuVirage`,
    `souvenirFrappe`, la présence dans la tribune. Ses écarts suivront ici.

## `serveur-virage` — partie B (4 octobre 2026, au soir)

Le bilan (`ferveur/bilan.js`), l'XP du Virage, le verdict servi, la série, le
rang en direct et le palier, le plancher de ferveur, `virage:fin` et
`virage:ferme`, `virage:souvenir` aux seuls receveurs, la présence dans la
tribune, `estAuVirage` et `souvenirFrappe`, bâtis sur le correctif sans le
défaire. Ce qui s'écarte du plan, ou le précise :

1. **Les chants restent acceptés entre le coup de sifflet et
   `virage:ferme`**, sans code nouveau. Ils comptent ; un bilan `fini` lu dans
   la lecture groupée de la salle (gardée deux minutes) peut ne pas les voir.
   Versé au contrat (§ 15.1).
2. **`virage:ferme` part `virage.bilan_min` minutes après le plus tardif du
   coup de sifflet et de l'arrivée du joueur** : qui entre après la fin a son
   propre délai, au lieu d'être mis dehors au battement suivant. Une salle
   ouverte sur un match déjà fini arme ce délai à sa création (`finA`), sans
   `virage:fin`. Versé au contrat (§ 15.3).
3. **`CANC`, `AWD`, `WO` : ni `virage:fin`, ni `virage:ferme`** (comme `PST`
   et `ABD`). Le relevé a cessé de payer la salle (correctif, 1) ; elle se
   libère une minute après la dernière socket. Versé au contrat (§ 15.3).
4. **`virage:ami` `present: false` part à ceux à qui sa présence a été dite**
   — son entrée, ou leur `virage:amis` — et qui sont encore là, sans relire
   `aPrevenir` : un ami visible à l'entrée puis caché est annoncé à son départ
   à ceux qui l'ont vu entrer (`annonceA`, sur le membre). Une « entrée » est
   la première socket du joueur dans la salle, y compris un retour de parti
   après un vrai départ. Versé au contrat (§ 18.2, § 18.3).
5. **`meilleur_q` est arrondi au millième supérieur**
   (`Math.ceil(n · 1000 − 1e-6)`, `enMilliemes`) et non au plus proche : le
   bilan relit le verdict du meilleur geste sur ce nombre
   (`verdictDe(q / 1000)`), et les seuils sont stricts — un 0,9004 arrondi au
   plus proche ferait 900, BON au bilan pour un geste annoncé PARFAIT en
   tribune. Le millionième retiré efface le bruit des flottants.
   `verdict-smoke` garde l'aller-retour (`serveur-socle`, 10).
6. **L'upsert pose `meilleur_chant` aussi quand il est `NULL`** (une ligne
   ouverte par une carte, sans note), et par `COALESCE`, pour qu'une carte ne
   l'efface pas. L'ordre de la règle 15 (le chant avant la note) tient.
7. **Le repli de l'écriture et des lectures a trois formes** (complète,
   quotidien seul, nue), comme le plan, avec **au plus deux instructions en
   échec par dix minutes** : le repli est mémorisé, et ne se retente qu'à
   l'expiration.
8. **L'XP du bilan a deux raccourcis avant le grand livre** : déjà réglée
   dans cette salle (versée, ou « déjà ») → `deja` ; chants de la ligne lue
   sous le seuil → `incomplet` avec `manque`, sans verrou de bourse. **Le
   filet ne part que pour un membre qui a chanté dans la salle**, et pas pour
   qui n'a fait qu'entrer ; un `incomplet` ou un `quota` ne règlent rien, et
   le départ retente. Versé au contrat (§ 15.2).
9. **Le plancher de ferveur ne s'applique pas quand `ferveurBonus` vaut 0** :
   un bonus nul veut dire « pèse sur la corde, ne compte pas au classement »,
   et le plancher ne le contredit pas. Aucune source n'en pose aujourd'hui.
   Versé au contrat (§ 16.2).
10. **Le rang en direct se recalcule aussi hors de la seconde** pour un
    membre que le classement ne connaît pas encore (une entrée, un retour) ou
    qu'il range dans l'autre tribune (un neutre qui a rechoisi son camp) :
    sans cela, sa première réponse n'aurait pas de `rang`, que le contrat dit
    toujours présent. C'est rare au regard des chants, qui lisent le
    classement de la dernière seconde.
11. **`virage:bilan` sans session répond `auth.error.unauthenticated`**, et la
    cadence de cinq secondes compte toute demande avec session, y compris
    celle qui reçoit `not_in_virage`. Versé au contrat (§ 15.4).

---

*Les écrans du lot 6. Chaque périmètre d'écran a rendu ses écarts au brief
(`BRIEF-LOT6.md`) dans la partie A ; ils sont versés ici sous sa clé, ceux qui
touchent le contrat en premier. Les identifiants et les classes retirés sont
nommés, parce que des suites les lisent.*

## `grand-virage` — écran (4 octobre 2026)

1. **« A poussé » se lit sur ce que la page a reçu** : un `virage:result`
   pendant cette visite, ou `you.ferveur` > 0 dans l'état. Un joueur qui n'a
   eu que des RATÉ (ferveur 0) et recharge la page sort donc sans bilan. Un
   compteur de chants dans `virage:state.you` lèverait ce cas : demandé à
   `serveur-virage`, ni servi ni au contrat.
2. **Une reconnexion après le coup de sifflet** : la page traite un
   `virage:state` au statut final comme `virage:fin`. Versé au contrat
   (§ 15.3), pour que le serveur s'y attende.
3. **Les champs de la vague 2 sont codés contre le contrat et éprouvés au
   banc**, pas encore contre un serveur qui les sert. Absents, la page garde
   la sortie d'avant : la boîte au bout de trois secondes, la minute double
   sans chiffre, le rang seul, ni tampon, ni combo, ni carte-souvenir annoncée.
4. **Le « i » de ce qu'on porte est au bout de la rangée d'actions**, et non
   dans la rangée du souffle comme l'écrit le brief : mesuré au banc, le
   combo, la pile et le « i » y prenaient ensemble environ 200 px, et les
   jauges tombaient à 0 px à 320 de large et à 31 à 360. Sans deck (pas de
   rangée d'actions), il revient dans le tableau.
5. **Identifiants retirés ou déplacés** : `#filQui` ; `#verdict` (le tampon
   vient du serveur, plus de seuil local) ; `#ecartees` (les cartes restées au
   duel sont un sticker DUEL SEULEMENT sur les cases vides de `#actes`, la
   phrase et le lien vers `/deck` dans `#apportsP .ecartees`). `#apportsP` et
   `#souvenir` sortent de `#app` ; `#actes` est enveloppé par `#rangeeActes` ;
   `#apportsL` n'a plus la classe `.tbf-apports-l`. L'audit suit (`mesure`).
6. **Non fait, par choix** : le supporter adverse qui tire de l'autre côté de
   la corde (Q7 : la foule au pochoir teintée au camp dit déjà qui est en
   face) ; le Fanzzy du voile qui se tourne vers la bâche touchée (absent du
   brief, rien à inventer).

## `duel-tribunes` — écran (4 octobre 2026)

1. **Pas de stade-mini à la préparation**, ni de camp choisi par les deux
   tribunes du stade-mini : le stade du duel n'appartient pas au match
   (`serveur-duel`, 9) — en poser un serait inventer un lieu dont les effets ne
   s'appliqueront pas. Le camp se choisit par deux bâches de même poids, la
   choisie en flare.
2. **L'arène fait 33 % de l'écran en jeu** (213 px à 360 × 640 ; 146 à
   320 × 568), et non 45 % : la règle du brief — l'arène cède avant la main
   et les chants — l'emporte. La main et les chants restent entiers partout.
3. **Les écharpes du bilan volent vers le bouton de menu**, et non vers un
   compteur du HUD : la barre des écrans de jeu ne garde que ses deux boutons,
   et c'est au bouton de menu que le solde se retrouve ailleurs
   (`barre-tiroir`).
4. **`tbf:bourse` part sans `wallet`** au bilan : `nvn:fin` ne sert que le gain
   (§ 4.1), pas le solde. La page le relaierait s'il venait (option demandée à
   `serveur-duel`, non servie) ; d'ici là, `nav.js` relit.
5. **La case de BD du but est posée par la page** (`.tbf-moment`), puis
   `FX.but({ vignette: true })` : le duel ne charge pas `fanzzy-scene.js`, et
   un but seul en vignette n'aurait eu aucun mot. Un seul titre par but.
6. **La Relève d'un coéquipier** garde l'annonce par titre : seule la carte
   active du joueur est à l'écran pour `FX.evolution`.
7. **Les effets d'en face** se lisent dans `equipes[][].effets` et `side`
   (§ 17) ; à la partie A, avant ces champs, la page les déduisait des
   évènements, et elle le fait encore pour un serveur d'avant.
8. **Identifiants retirés ou remplacés** : `#son` (le son se coupe au tiroir) ;
   `.cote.moi`/`.cote.eux`, `.fil-corde`, `.noeud` → `.tbf-maree`,
   `.tbf-corde`, `.tbf-foulard#noeud` ; `.fil-match.on` → `#filLigne[hidden]`
   (`#filMatch` reste) ; `#ecart` garde un premier enfant (la banderole) et son
   `small`.

## `geste` — brique (4 octobre 2026)

1. **« 600 ms après la dernière frappe » se compte depuis la fin du geste**,
   quand les frappes partent au serveur. Comptée depuis la dernière frappe,
   l'échéance serait déjà passée à la fermeture des fenêtres (celle du
   contretemps ferme un demi-temps plus 360 ms après la dernière frappe,
   l'écho 900 ms, le crescendo 600 ms) et le tampon n'y claquerait presque
   jamais. Une constante (`DELAI_VERDICT`) et une option (`delai`) : à
   trancher si la lecture littérale était voulue.
2. **Le mot vient du verdict servi**, jamais d'un seuil ; `geste.js` recopie la
   liste fermée des quatre mots (`VERDICTS`) au lieu d'importer
   `src/shared/verdict.js`, et `gestes-smoke` vérifie que la copie suit le
   module et qu'aucune page ne l'importe.
3. **Constats laissés en l'état** : le premier temps du crescendo tombe à
   l'ouverture de la fenêtre (0,86 au lieu de 0,96 avec 220 ms de réaction) —
   le décaler demande de décaler le chant de `son.js` en même temps (`fx`) ;
   à la relance, une fois l'instant atteint, une vibration toutes les 40 ms
   jusqu'au lâcher (peut-être voulu : « lâche ! »), sous le calme
   « vibrations ».

## `fx` — brique (4 octobre 2026)

1. **L'assombrissement des cartes à 60 % est retiré des modules**
   (`action-art.js`, `chant-art.js` rendent l'image nue) ; les règles qui
   l'appliquaient vivent dans le CSS des pages et de `ui.css`.
2. **Pas d'aide `TBF_SON.verdict`** : verdict → son tient en deux appels de
   `FX.son`, plus le clac du tampon, dont l'instant dépend de l'animation CSS.
3. **Les dessins de chant restent en 4:3** : la carte 2:3 n'en montre que la
   moitié, cadrée par `object-position`. Des dessins en 2:3 sont du lot 7.
4. **Le mixage a changé** : l'interface sort 6 à 8 dB plus bas qu'en
   production, la poussée, le contre et le chant environ 6 dB, le but encaissé
   et la charge 3 à 4 dB. C'est le mixage dessiné, mesuré au banc ; **Gaël doit
   l'écouter sur un téléphone avant la mise en ligne**. Une rafale de tics à
   20 Hz (plafond du martelage) n'est pas jugée : le martelage n'est pas
   chanté.

## `feuilles-css` — feuille (4 octobre 2026)

1. **Le sticker de phase est dans la seconde rangée**, à droite du ticket
   terrain, et non sous la plaque du score : le budget de 44 + 24 ne laisse
   pas de place sous la plaque. Au duel, CLASSÉ est bien dans la plaque.
2. **L'éventail se chevauche de 6 %** (la maquette), et non de 22 % (la
   direction) : à 22 %, la carte suivante couvrait le nom du geste et la
   poussée de la précédente.
3. **La corde des arènes reprend le dessin de la corde peinte** du chemin de
   niveau et de l'arbre des âges (le jeton `--corde-tresse` est posé), sans
   toucher aux règles du lot 4, alors en vérification.
4. **Non écrit en pièce commune** : la carte-souvenir qui se retourne,
   l'équipe du duel et l'affiche VS (hors du point 1 du brief : les pages les
   montent avec le vocabulaire existant) ; l'interrupteur « apparaître hors
   ligne » reste peint par `menu.js` avec le calme et le volume.
5. Les noms de club longs se terminent par une ellipse à 320 px (47 px de
   texte par bâche) : les pages écrivent le nom court.

## `barre-tiroir` — écran (4 octobre 2026)

1. **L'interrupteur « apparaître hors ligne »** (§ 18.2) ne paraît que sur
   `{ actif: true, visible }`, lu à l'ouverture du tiroir ; après un `POST`,
   toute autre réponse le retire (versé au contrat, § 18.2).
2. **Pas d'ancre pour le vol des écharpes** du bilan du duel : le bouton de
   menu est déjà l'endroit du solde, et la barre des écrans de jeu ne garde
   que ses deux boutons. `suivreEnJeu` marque la valeur retenue comme
   périmée, pour que l'écran suivant voie le nouveau solde.
3. **`--tbf-haut-g` et `--tbf-haut-d` restent** : `duel-nvn.html` les lit
   encore pour le titre de la préparation.
4. **Le bandeau d'annonce** est rangé sous la rangée du HUD au Virage ; au
   duel, sa place revient à la page (`duel-tribunes`).

## `amis` — écran (4 octobre 2026)

1. **La présence est un sticker de mot au bout du nom** (AU VIRAGE, EN DUEL
   en rouge, EN LIGNE en craie), et non une pastille sur le médaillon comme
   le dessinaient les directions : un rond de couleur dirait l'état par la
   couleur seule, et le coin du médaillon porte déjà le niveau. Rien pour hors
   ligne ; un état hors de la liste ne s'écrit pas ; jamais sur une demande ni
   une suggestion.
2. **Pas de rafraîchissement pendant qu'on reste sur `/amis`** : aucune
   requête de plus par écran, et le contrat ne promet aucun direct. La
   présence se lit au chargement et après chaque geste, avec la liste.

## `mesure` — audit (4 octobre 2026)

1. **Les états d'arène sont fabriqués** à la forme du contrat (§ 15 à § 18),
   par une fausse socket ; quatre lectures sont bouchées et nommées
   (`/api/virage/live`, `/api/deck/matchs`, `/api/deck/loadout`,
   `/api/nvn/attentes`). Rien n'est écrit en base.
2. **Pas d'état pour les variantes** (tribune de 3 et de 300, neutre, Virage
   non classé, duel en 1 contre 1 et en 5 contre 5) ni pour le pavé du duel :
   elles sont aux bancs des périmètres ; le pavé est la même brique.
3. **Le sticker « prêt » d'un écran de jeu** n'est pas semé dans la mémoire de
   `nav.js` (ce serait lier l'audit à son format interne) : les trois urgences
   sont photographiées par d'autres chemins.

## `paquet` (4 octobre 2026)

- **`nvn:net` n'est jamais lancée par `npm test`** : `tout-tester.mjs` ne
  retient que les clés en `:smoke`, `:test` ou `:ui`. Constat antérieur au lot,
  non corrigé (ni `package.json` à renommer, ni `tout-tester.mjs`, qui n'est
  dans aucun périmètre) : à décider à la vérification ; d'ici là, `nvn:net`
  se lance à la main.
- `verdict:smoke` est inscrite (`serveur-socle`, 9) : `tout-tester` la lance.
