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
carnet (liseré, tampon S1) en filtrant `source = 'carnet'`.

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
`couleurs` à côté de `id`, `nom` et `ferveur`.

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
s'abonne ou se désabonne. **Pour `quotidien`** : ses réclamations
n'échauffent pas ce souvenir ; il l'est presque toujours par la barre, qui lit
`/api/fanzzy/state`. Le remède définitif serait un `estAbonne` sur la
connexion de l'appelant dans `abonnement/index.js`, fichier d'aucun
périmètre.

**Et un défaut voisin corrigé en passant** : le débit d'un booster remettait
la minuterie à zéro quand la réserve valait le plafond **du joueur gratuit**
(`IF(packs = pack.max, …)`), y compris chez un abonné dont le plafond est plus
haut, au milieu de sa recharge. Le débit ne touche plus `packs_at` : la
recharge faite juste avant, sous le même verrou, l'a déjà fait repartir si la
réserve était pleine.

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
encore `paliers` (lot 4).

**Effet sur l'économie** (à partir d'`ECONOMIE.md` § 7.1, LA REPRISE à deux
thèmes de tenues) : l'univers des crans passe de 635 à 445 objets, soit de 25
à 17 crans ; sur toute la collection, 200 écharpes et 2 boosters de moins par
joueur, abonné ou non. Si Gaël veut le rythme d'avant, `collection.cran` à 18
(réglage d'administration, sans livraison) rend environ 24 crans. Rien n'est
encore versé en production (`sql/quotidien.sql` est à déployer) : aucun cran
déjà payé n'est concerné.

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
l'abonnement : c'est la colonne ci-dessus.

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
  au prochain cran, sans les tenues ; 24 gagnés sur 788 en tout ». La page
  de la collection affiche `total` : sans cela, 23 ici et 24 là-bas se
  contrediraient sans explication.

**Pour les suites** : chez un joueur qui a une tenue, avec `paliers` servi,
le chiffre de la tuile n'est plus `total.gagnes`. `tour-ui-smoke` (« et
l'accueil dit le même total qu'elle ») compare ce chiffre au « gagnés » de
`/collection`. L'étiquette porte toujours `total.gagnes` et
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
