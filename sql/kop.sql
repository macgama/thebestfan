-- thebestfan — les KOP.
--
-- Un groupe de supporters, une caisse commune, et des bonus votés qui
-- s'appliquent à ses membres présents dans le VIRAGE.
--
-- À appliquer après auth.sql, football.sql et souvenirs.sql.
-- Rejouable : `CREATE TABLE IF NOT EXISTS` partout.

CREATE TABLE IF NOT EXISTS kops (
  id        CHAR(36)    NOT NULL,
  team_id   INT         NOT NULL,
  nom       VARCHAR(40) NOT NULL,
  createur  CHAR(36)    NOT NULL,
  -- Le pot. Il ne se retire jamais : il se dépense par un vote, ou il attend.
  pot       INT UNSIGNED NOT NULL DEFAULT 0,
  -- Le cumul de tout ce qui y est tombé depuis l'ouverture. Le pot descend
  -- quand on achète, celui-ci jamais : c'est l'histoire du groupe, et c'est ce
  -- qu'on affiche pour dire ce qu'il a accompli.
  verse_total INT UNSIGNED NOT NULL DEFAULT 0,
  cree      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY k_kop_team (team_id),
  CONSTRAINT fk_kop_createur FOREIGN KEY (createur) REFERENCES users(public_id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- L'appartenance.
--
-- `team_id` est recopié ici, et ce n'est pas une négligence : c'est ce qui
-- permet la clé unique `(user_id, team_id)`, donc la règle « un seul KOP par
-- club » **tenue par la base**. Vérifiée dans le code, elle céderait sur deux
-- requêtes simultanées — et un joueur inscrit à deux KOP du même club casserait
-- toute la logique de versement, sans que rien ne le signale.
CREATE TABLE IF NOT EXISTS kop_membres (
  kop_id   CHAR(36)    NOT NULL,
  user_id  CHAR(36)    NOT NULL,
  team_id  INT         NOT NULL,
  -- Ce que ce membre a versé. Informatif : il ne le récupère pas en partant.
  verse    INT UNSIGNED NOT NULL DEFAULT 0,
  depuis   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (kop_id, user_id),
  UNIQUE KEY u_kop_un_par_club (user_id, team_id),
  CONSTRAINT fk_kmembre_kop FOREIGN KEY (kop_id) REFERENCES kops(id) ON DELETE CASCADE,
  CONSTRAINT fk_kmembre_user FOREIGN KEY (user_id) REFERENCES users(public_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Les votes de dépense. Trois minutes chacun.
CREATE TABLE IF NOT EXISTS kop_votes (
  id        CHAR(36)    NOT NULL,
  kop_id    CHAR(36)    NOT NULL,
  bonus_id  VARCHAR(32) NOT NULL,
  prix      INT UNSIGNED NOT NULL,
  ouvert_par CHAR(36)   NOT NULL,
  ouvre     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  ferme     DATETIME(3) NOT NULL,
  -- `en_cours` tant que l'échéance n'est pas passée. Le dépouillement se fait à
  -- la lecture plutôt que par une tâche périodique : pas de minuterie à
  -- maintenir, et un serveur redémarré au mauvais moment ne laisse pas un vote
  -- ouvert pour l'éternité.
  issue     ENUM('en_cours','adopte','rejete') NOT NULL DEFAULT 'en_cours',
  PRIMARY KEY (id),
  KEY k_vote_kop (kop_id, issue),
  CONSTRAINT fk_vote_kop FOREIGN KEY (kop_id) REFERENCES kops(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS kop_bulletins (
  vote_id  CHAR(36)   NOT NULL,
  user_id  CHAR(36)   NOT NULL,
  pour     TINYINT(1) NOT NULL,
  a        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (vote_id, user_id),
  CONSTRAINT fk_bulletin_vote FOREIGN KEY (vote_id) REFERENCES kop_votes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Les bonus achetés, actifs ou éteints.
--
-- Rien ne se supprime : un bonus consommé reste, `restant` à zéro. C'est
-- l'historique du KOP, et c'est ce qui permet de dire « on a déjà pris celui-là
-- trois fois cette saison » plutôt que de faire semblant de ne pas savoir.
CREATE TABLE IF NOT EXISTS kop_bonus (
  id       CHAR(36)    NOT NULL,
  kop_id   CHAR(36)    NOT NULL,
  bonus_id VARCHAR(32) NOT NULL,
  portee   ENUM('match','charges','saison') NOT NULL,
  -- Matchs restants. `NULL` pour un bonus de saison, qui ne se décompte pas.
  restant  SMALLINT    NULL,
  -- Le match en cours de consommation, pour qu'un bonus de match ne se dépense
  -- pas deux fois si deux salles du même match s'ouvrent.
  fixture_id BIGINT    NULL,
  achete   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  epuise   DATETIME(3) NULL,
  PRIMARY KEY (id),
  KEY k_bonus_actif (kop_id, epuise),
  CONSTRAINT fk_bonus_kop FOREIGN KEY (kop_id) REFERENCES kops(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
