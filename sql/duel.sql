-- FANZDuel — schéma du duel temps réel (MariaDB / MySQL 8)
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Journal append-only. Sert à renvoyer uniquement les événements manqués
-- quand un joueur revient après une coupure réseau.
CREATE TABLE IF NOT EXISTS duel_events (
  duel_id   CHAR(36)    NOT NULL,
  seq       INT         NOT NULL,
  payload   JSON        NOT NULL,
  at        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (duel_id, seq),
  CONSTRAINT fk_events_duel FOREIGN KEY (duel_id) REFERENCES duels(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Matchs réels suivis via API-Football. Un seul worker écrit ici ; les duels
-- lisent. C'est ce qui garantit que les deux joueurs voient le même but.
CREATE TABLE IF NOT EXISTS fixtures (
  id           INT          NOT NULL PRIMARY KEY,   -- fixture id API-Football
  league_id    INT          NOT NULL,
  home_team_id INT          NOT NULL,
  away_team_id INT          NOT NULL,
  status       VARCHAR(8)   NOT NULL,
  minute       SMALLINT     NULL,
  home_goals   TINYINT      NULL,
  away_goals   TINYINT      NULL,
  kickoff_at   DATETIME     NOT NULL,
  polled_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_live (status, kickoff_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS fixture_events (
  fixture_id INT         NOT NULL,
  seq        SMALLINT    NOT NULL,
  type       VARCHAR(16) NOT NULL,       -- goal, card, subst
  team_id    INT         NOT NULL,
  minute     SMALLINT    NOT NULL,
  payload    JSON        NULL,
  PRIMARY KEY (fixture_id, seq)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Clubs suivis par un joueur : sert au bonus live pendant les duels.
CREATE TABLE IF NOT EXISTS user_follows (
  user_id VARCHAR(64) NOT NULL,
  team_id INT         NOT NULL,
  is_main TINYINT(1)  NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, team_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
