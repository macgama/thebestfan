-- FANZDuel — schéma du duel temps réel (MariaDB / MySQL 8)
--
-- L'interclassement est imposé explicitement sur chaque table. Sans lui,
-- MariaDB retombe sur utf8mb4_general_ci alors que les autres tables sont en
-- unicode_ci, et toute jointure sur user_id échoue avec « Illegal mix of
-- collations » — un classement resterait vide sans qu'aucune erreur remonte.
--
-- Base déjà déployée ? Rattraper avec :
--   ALTER TABLE duels        CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
--   ALTER TABLE duel_events  CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
--   ALTER TABLE duel_results CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- L'état vit en mémoire pendant la partie ; ces tables servent à la reprise
-- après redémarrage, à la resynchronisation et au rejeu d'une partie.

CREATE TABLE IF NOT EXISTS duels (
  id            CHAR(36)     NOT NULL PRIMARY KEY,
  player0_id    VARCHAR(64)  NOT NULL,
  player1_id    VARCHAR(64)  NOT NULL,
  phase         ENUM('playing','ko_promote','over') NOT NULL DEFAULT 'playing',
  winner        VARCHAR(8)   NULL,          -- '0', '1' ou 'draw'
  reason        VARCHAR(16)  NULL,
  state_json    JSON         NOT NULL,      -- snapshot complet, réécrit à chaque événement
  created_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  ended_at      DATETIME(3)  NULL,
  KEY idx_active_p0 (player0_id, phase),
  KEY idx_active_p1 (player1_id, phase),
  KEY idx_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Journal append-only. Sert à renvoyer uniquement les événements manqués
-- quand un joueur revient après une coupure réseau.
CREATE TABLE IF NOT EXISTS duel_events (
  duel_id   CHAR(36)    NOT NULL,
  seq       INT         NOT NULL,
  payload   JSON        NOT NULL,
  at        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (duel_id, seq),
  CONSTRAINT fk_events_duel FOREIGN KEY (duel_id) REFERENCES duels(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Résultats consolidés, pour le classement et l'historique du joueur.
CREATE TABLE IF NOT EXISTS duel_results (
  duel_id     CHAR(36)    NOT NULL,
  user_id     VARCHAR(64) NOT NULL,
  opponent_id VARCHAR(64) NOT NULL,
  goals_for   TINYINT     NOT NULL DEFAULT 0,
  goals_against TINYINT   NOT NULL DEFAULT 0,
  outcome     ENUM('win','loss','draw') NOT NULL,
  elo_before  SMALLINT    NOT NULL DEFAULT 1000,
  elo_after   SMALLINT    NOT NULL DEFAULT 1000,
  ended_at    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (duel_id, user_id),
  KEY idx_user_history (user_id, ended_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Les tables fixtures, fixture_events et user_follows sont désormais
-- définies par sql/football.sql, qui fait autorité.
