-- Le quotidien, la saison datée et le grand livre des récompenses.
--
-- ## Ce que ce fichier pose
--
-- Le chantier serveur de la refonte (vague 1) fait verser au jeu des choses
-- qu'il ne versait pas : trois missions par jour et leur sachet, une carte de
-- présence, un carnet de tampons par saison, des crans de collection, des
-- divisions de saison. Tout cela passe par **un seul registre**, `recompenses`,
-- et par une seule porte dans le code, `src/server/recompenses.js`.
--
-- ## Pourquoi un seul grand livre
--
-- Une table par source aurait voulu dire une idempotence par source, un
-- disjoncteur qui somme cinq tables, et cinq façons de payer deux fois la même
-- chose. Ici, la clé primaire `(user_id, source, cle)` **est** l'idempotence :
-- deux onglets, un double clic ou un réseau qui rejoue ne versent qu'une fois,
-- parce que la seconde ligne n'entre pas. Elle est posée dans le CREATE, et
-- jamais ajoutée après coup : une table créée sans elle resterait sans elle,
-- et le démarrage le vérifie (`src/server/auth/schema.js`).
--
-- ## Additif seulement
--
-- Des tables neuves, des colonnes nulles ou avec un défaut, rien de renommé,
-- aucun rattrapage de données : le code déjà en production ne lit aucune de
-- ces colonnes, et il tourne pareil avant et après ce fichier. Rejouable :
-- le relancer sur une base à jour ne fait rien.
--
-- ## Pourquoi il vient en dernier
--
-- Il ajoute des colonnes à `user_wallet` et à `virage_presence`
-- (souvenirs.sql) et à `saisons` (saisons.sql), et ses tables sont clées sur
-- `users.public_id` (auth.sql). Joué avant eux, un ALTER lèverait sur une
-- table absente.
--
-- ## Pourquoi aucune clé étrangère vers users
--
-- Le plan en prévoyait une, en cascade, sur les trois tables du joueur. Elle
-- a été retirée, et la raison tient aux suites de test : chacune vide la base
-- au démarrage avec sa propre liste, et une table fille de `users` absente de
-- cette liste fait échouer le DROP de `users`, donc la suite entière, avant
-- son premier contrôle. Vingt-huit suites nomment `users` ; quinze d'entre
-- elles n'appartiennent à aucun périmètre de la vague. La cascade, elle, ne
-- sert à rien ici : un compte supprimé n'est jamais effacé, il est anonymisé
-- (`auth/store.js`, `deleteUser`), et c'est `deleteUser` qui retire
-- nommément les lignes du joueur dans ces trois tables. Toutes les écritures
-- prennent l'identifiant de la session, jamais de la requête. Le détail est
-- dans ECARTS.md du chantier.

-- Le grand livre : tout ce que les sources nouvelles versent, une ligne par
-- versement. La clé primaire EST l'idempotence.
--
-- Pas de clé étrangère non plus, mais pour une autre raison : la ligne
-- survit à l'anonymisation d'un compte. C'est la trace comptable du jeu, et
-- une requête d'administration la somme par source et par jour pour voir un
-- pic (DEPLOIEMENT.md).
--
-- `source` : bonus, mission, sachet, carnet, relais, cran, serie, division.
-- `cle` : le jour (bonus, sachet), le jour et le rang (mission), S<saison>:<n>
-- (carnet), S<saison> (relais), le seuil (cran), la série (serie),
-- S<saison>:<division> (division). La liste fermée est dans
-- src/server/recompenses.js.
CREATE TABLE IF NOT EXISTS recompenses (
  user_id   CHAR(36)          NOT NULL,
  source    VARCHAR(16)       NOT NULL,
  cle       VARCHAR(40)       NOT NULL,
  saison_id INT UNSIGNED          NULL,
  echarpes  INT UNSIGNED      NOT NULL DEFAULT 0,
  packs     SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  xp        INT UNSIGNED      NOT NULL DEFAULT 0,
  tampons   SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  -- Copiés du palier qui les donne : le titre « Capo de la saison 1 », le
  -- liseré ou le tampon du carnet. Le code n'a pas à relire le palier pour
  -- savoir ce qu'un joueur porte.
  titre     VARCHAR(64)           NULL,
  insigne   VARCHAR(16)           NULL,
  -- Écrit par le défaut de la colonne, c'est-à-dire par l'horloge de la base :
  -- le disjoncteur compare à CURDATE(), qui suit la même horloge.
  verse_a   DATETIME(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, source, cle),
  KEY k_recompenses_jour (user_id, verse_a),
  KEY k_recompenses_source (source, verse_a)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Le contrat du jour : les trois missions (rangs 0 à 2) et le sachet (rang 3),
-- avec leurs cibles et leurs gains COPIÉS au tirage. Un montant changé à midi
-- vaut pour le lendemain : le joueur reçoit ce qu'on lui a promis le matin.
--
-- `jour` est écrit en SQL par CURDATE(), jamais fabriqué en JavaScript : c'est
-- le jour de jeu, celui des quotas gratuits.
-- `mission` : l'identifiant du catalogue (src/shared/quotidien.js), 'sachet'
-- au rang 3. `saison_id` : la saison en cours au tirage, si elle n'est pas
-- finie ; une mission tirée entre deux saisons ne remplit aucun carnet.
CREATE TABLE IF NOT EXISTS missions_jour (
  user_id   CHAR(36)          NOT NULL,
  jour      DATE              NOT NULL,
  rang      TINYINT UNSIGNED  NOT NULL,
  mission   VARCHAR(24)       NOT NULL,
  cible     SMALLINT UNSIGNED NOT NULL,
  echarpes  SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  packs     TINYINT UNSIGNED  NOT NULL DEFAULT 0,
  xp        SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  tampons   TINYINT UNSIGNED  NOT NULL DEFAULT 0,
  saison_id INT UNSIGNED          NULL,
  relancee  TINYINT UNSIGNED  NOT NULL DEFAULT 0,
  cree_a    DATETIME(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, jour, rang)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ce qui n'a de ligne datée nulle part ailleurs : un booster ouvert, une
-- évolution. Écrit après la validation de l'action, jamais dedans : un
-- compteur qui échoue ne fait pas échouer l'ouverture d'un booster.
-- `cle` : booster, evolution.
CREATE TABLE IF NOT EXISTS compteurs_jour (
  user_id CHAR(36)     NOT NULL,
  jour    DATE         NOT NULL,
  cle     VARCHAR(16)  NOT NULL,
  n       INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, jour, cle)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ce que le joueur n'a pas encore regardé. Écrit au moment du gain : aucun
-- rattrapage, donc ce qu'il possédait avant ce fichier n'est jamais
-- « nouveau », et il n'y a rien à rejouer à chaque déploiement.
-- `cle` : fanzzy:RP4, age:RP4:2, etat:RP4:1:joie, skin:RP4:1:prehistorique,
-- stuff:<id>, action:<id> (CONTRATS.md, § 2.1).
CREATE TABLE IF NOT EXISTS user_nouveautes (
  user_id CHAR(36)    NOT NULL,
  cle     VARCHAR(80) NOT NULL,
  sorte   VARCHAR(8)  NOT NULL,
  got_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, cle),
  KEY k_nouveautes_date (user_id, got_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- La saison datée. Un jour, pas un instant : c'est le jour de jeu, qui ne
-- traverse aucun fuseau, et l'administration saisit un jour.
--
-- Une colonne par instruction, toujours : le contrôle de démarrage ne voit
-- que le premier ajout d'une instruction qui en porterait deux, et la
-- seconde colonne pourrait manquer sans que rien ne le dise.
ALTER TABLE saisons ADD COLUMN IF NOT EXISTS fin_le   DATE NULL;
ALTER TABLE saisons ADD COLUMN IF NOT EXISTS ouvre_le DATE NULL;
-- Le carnet de la saison s'il diffère de celui du code (JSON validé par
-- src/shared/saison.js). Nul : le carnet par défaut.
ALTER TABLE saisons ADD COLUMN IF NOT EXISTS carnet   JSON NULL;

-- Les photos de « ma ligne » (deux : celle du dernier jour vu avant
-- aujourd'hui, qui sert de référence, et celle d'aujourd'hui), la marque de
-- la dernière visite, et l'état des pots de KOP à cette marque (pot et
-- verse_total).
ALTER TABLE user_wallet ADD COLUMN IF NOT EXISTS rangs_vus  JSON        NULL;
ALTER TABLE user_wallet ADD COLUMN IF NOT EXISTS visite_a   DATETIME(3) NULL;
ALTER TABLE user_wallet ADD COLUMN IF NOT EXISTS instantane JSON        NULL;

-- Les chants au Virage, comptés dans l'upsert de présence qui existe : aucune
-- requête de plus par poussée. Le lot 6 ajoutera ses colonnes à la table.
--
-- Une colonne par instruction ET par ligne, ici plus qu'ailleurs :
-- scripts/virage-smoke.mjs prend ces instructions ligne à ligne, au motif,
-- pour poser les chants sans le reste du fichier, et en exige exactement
-- trois. Une instruction coupée sur deux lignes, ou une colonne de plus
-- ajoutée à cette table dans ce fichier, la fait rougir.
ALTER TABLE virage_presence ADD COLUMN IF NOT EXISTS chants     INT UNSIGNED NOT NULL DEFAULT 0;
ALTER TABLE virage_presence ADD COLUMN IF NOT EXISTS chants_mt1 INT UNSIGNED NOT NULL DEFAULT 0;
ALTER TABLE virage_presence ADD COLUMN IF NOT EXISTS chants_mt2 INT UNSIGNED NOT NULL DEFAULT 0;
