-- thebestfan — cartes-souvenirs et vignettes
-- À appliquer après auth.sql et football.sql.

-- Compétitions éligibles : celles dont API-Football fournit les buteurs et les
-- minutes. Remplie par scripts/coverage.mjs, à relancer à chaque intersaison.
CREATE TABLE IF NOT EXISTS souvenir_leagues (
  league_id  INT          NOT NULL,
  season     SMALLINT     NOT NULL,
  name       VARCHAR(120) NOT NULL,
  country    VARCHAR(80)  NULL,
  type       VARCHAR(20)  NULL,
  family     VARCHAR(20)  NOT NULL,
  has_events TINYINT(1)   NOT NULL DEFAULT 0,
  has_lineups TINYINT(1)  NOT NULL DEFAULT 0,
  has_standings TINYINT(1) NOT NULL DEFAULT 0,
  starts_on  DATE         NULL,
  ends_on    DATE         NULL,
  enabled    TINYINT(1)   NOT NULL DEFAULT 1,
  updated_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (league_id, season),
  KEY idx_enabled (enabled, family)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Un but réel = une carte frappée. C'est le modèle, pas l'exemplaire :
-- chaque joueur en obtient sa version, teintée du Fanzzy qu'il avait en main.
CREATE TABLE IF NOT EXISTS souvenirs (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  fixture_id   INT          NOT NULL,
  seq          SMALLINT     NOT NULL,          -- rang du but dans le match
  league_id    INT          NOT NULL,
  family       VARCHAR(20)  NOT NULL,          -- championnat, coupe, international
  scorer_team  INT          NOT NULL,
  home_id      INT          NOT NULL,
  away_id      INT          NOT NULL,
  minute       SMALLINT     NULL,
  player       VARCHAR(120) NULL,
  score_home   TINYINT      NOT NULL,
  score_away   TINYINT      NOT NULL,
  kickoff_at   DATETIME     NOT NULL,
  -- Instant où le serveur a vu le but. C'est lui qui fait foi pour la
  -- présence : c'est le moment où les joueurs l'ont vécu, pas la minute
  -- de jeu, qui peut arriver avec du retard.
  seen_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  expires_at   DATETIME(3)  NOT NULL,          -- fin de la vente en vignette
  price        SMALLINT     NOT NULL,          -- en écharpes
  UNIQUE KEY uq_goal (fixture_id, seq),
  KEY idx_market (expires_at, family),
  KEY idx_team (scorer_team, seen_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ce que possède un joueur.
--   presence : il était dans le Grand Virage au moment du but. Jamais cédé.
--   vignette : il l'a achetée en écharpes dans les quinze jours. Cessible.
CREATE TABLE IF NOT EXISTS user_souvenirs (
  user_id     CHAR(36)     NOT NULL,
  souvenir_id BIGINT UNSIGNED NOT NULL,
  kind        ENUM('presence','vignette') NOT NULL,
  fanzzy_id   VARCHAR(12)  NULL,               -- Fanzzy porté à cet instant
  ferveur     INT          NOT NULL DEFAULT 0, -- ce qu'il avait donné
  acquired_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, souvenir_id),
  KEY idx_user (user_id, acquired_at),
  KEY idx_souvenir (souvenir_id),
  CONSTRAINT fk_us_user FOREIGN KEY (user_id) REFERENCES users(public_id) ON DELETE CASCADE,
  CONSTRAINT fk_us_souvenir FOREIGN KEY (souvenir_id) REFERENCES souvenirs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Présence au Grand Virage. Une ligne par joueur et par match, mise à jour à
-- chaque poussée. C'est la preuve qu'on consulte quand un but tombe.
CREATE TABLE IF NOT EXISTS virage_presence (
  user_id      CHAR(36)    NOT NULL,
  fixture_id   INT         NOT NULL,
  side         TINYINT     NOT NULL,           -- 0 = domicile, 1 = extérieur
  fanzzy_id    VARCHAR(12) NULL,
  ferveur      INT         NOT NULL DEFAULT 0,
  last_push_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  joined_at    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, fixture_id),
  KEY idx_active (fixture_id, last_push_at),
  CONSTRAINT fk_vp_user FOREIGN KEY (user_id) REFERENCES users(public_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bourse du joueur. Les écharpes vivaient jusqu'ici dans le navigateur, ce qui
-- ne tient plus dès qu'elles achètent quelque chose : un solde côté client se
-- modifie avec la console du navigateur.
CREATE TABLE IF NOT EXISTS user_wallet (
  user_id    CHAR(36)    NOT NULL PRIMARY KEY,
  scarves    INT         NOT NULL DEFAULT 0,
  packs      SMALLINT    NOT NULL DEFAULT 12,
  packs_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_wallet_user FOREIGN KEY (user_id) REFERENCES users(public_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
