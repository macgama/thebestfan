-- thebestfan — suivi des équipes (API-Football)
-- Applique après auth.sql :
--   mysql -h ... -u ... -p o42s1v_thebestfan < sql/football.sql
--
-- Note : si duel.sql a déjà été appliqué, il a créé une table user_follows
-- avec un user_id en VARCHAR(64). Supprime-la avant d'exécuter ce fichier :
--   DROP TABLE IF EXISTS user_follows;

CREATE TABLE IF NOT EXISTS leagues (
  id             INT          NOT NULL PRIMARY KEY,   -- id API-Football
  name           VARCHAR(120) NOT NULL,
  country        VARCHAR(80)  NULL,
  logo           VARCHAR(255) NULL,
  type           VARCHAR(20)  NULL,                   -- League / Cup
  current_season SMALLINT     NULL,
  updated_at     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS teams (
  id         INT          NOT NULL PRIMARY KEY,
  name       VARCHAR(120) NOT NULL,
  code       VARCHAR(10)  NULL,
  country    VARCHAR(80)  NULL,
  logo       VARCHAR(255) NULL,
  founded    SMALLINT     NULL,
  national   TINYINT(1)   NOT NULL DEFAULT 0,
  updated_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Compétitions où évolue une équipe : sert à savoir quels classements charger.
CREATE TABLE IF NOT EXISTS team_leagues (
  team_id   INT      NOT NULL,
  league_id INT      NOT NULL,
  season    SMALLINT NOT NULL,
  PRIMARY KEY (team_id, league_id, season),
  KEY idx_league (league_id, season)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS fixtures (
  id            INT          NOT NULL PRIMARY KEY,
  league_id     INT          NOT NULL,
  season        SMALLINT     NOT NULL,
  round         VARCHAR(120) NULL,
  home_id       INT          NOT NULL,
  away_id       INT          NOT NULL,
  home_goals    TINYINT      NULL,
  away_goals    TINYINT      NULL,
  status_short  VARCHAR(8)   NOT NULL,     -- NS, 1H, HT, 2H, ET, FT, PST…
  elapsed       SMALLINT     NULL,
  venue         VARCHAR(120) NULL,
  kickoff_at    DATETIME     NOT NULL,
  polled_at     DATETIME(3)  NULL,
  updated_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_kickoff (kickoff_at),
  KEY idx_status (status_short, kickoff_at),
  KEY idx_home (home_id, kickoff_at),
  KEY idx_away (away_id, kickoff_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Buts et cartons. `seq` vient de l'ordre renvoyé par l'API : rejouer le même
-- appel n'insère pas deux fois le même but.
CREATE TABLE IF NOT EXISTS fixture_events (
  fixture_id INT          NOT NULL,
  seq        SMALLINT     NOT NULL,
  type       VARCHAR(20)  NOT NULL,        -- Goal, Card, subst
  detail     VARCHAR(60)  NULL,
  team_id    INT          NOT NULL,
  player     VARCHAR(120) NULL,
  assist     VARCHAR(120) NULL,
  minute     SMALLINT     NULL,
  extra      SMALLINT     NULL,
  created_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (fixture_id, seq),
  KEY idx_team (team_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS standings (
  league_id  INT          NOT NULL,
  season     SMALLINT     NOT NULL,
  team_id    INT          NOT NULL,
  `rank`     SMALLINT     NOT NULL,
  points     SMALLINT     NOT NULL DEFAULT 0,
  played     SMALLINT     NOT NULL DEFAULT 0,
  win        SMALLINT     NOT NULL DEFAULT 0,
  draw       SMALLINT     NOT NULL DEFAULT 0,
  lose       SMALLINT     NOT NULL DEFAULT 0,
  goals_for  SMALLINT     NOT NULL DEFAULT 0,
  goals_against SMALLINT  NOT NULL DEFAULT 0,
  form       VARCHAR(10)  NULL,
  group_label VARCHAR(60) NULL,
  updated_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (league_id, season, team_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Clubs suivis. C'est cette table qui décide de ce que le worker interroge :
-- une équipe que personne ne suit ne consomme aucun appel.
CREATE TABLE IF NOT EXISTS user_follows (
  user_id    CHAR(36)    NOT NULL,
  team_id    INT         NOT NULL,
  is_main    TINYINT(1)  NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, team_id),
  KEY idx_team (team_id),
  CONSTRAINT fk_follow_user FOREIGN KEY (user_id) REFERENCES users(public_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Consommation quotidienne du quota API-Football (7 500 appels/jour).
CREATE TABLE IF NOT EXISTS api_quota (
  day        DATE        NOT NULL PRIMARY KEY,
  used       INT         NOT NULL DEFAULT 0,
  remaining  INT         NULL,             -- tel que renvoyé par l'API
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
