-- thebestfan — télétexte : cache des lectures API.
-- À appliquer après football.sql et souvenirs.sql.

-- Un cache générique. Sans lui, chaque consultation d'un classement coûterait
-- un appel : à 953 compétitions consultables, le quota quotidien partirait en
-- une matinée. Avec lui, le premier lecteur paie, les suivants non.
CREATE TABLE IF NOT EXISTS api_cache (
  k          VARCHAR(190) NOT NULL PRIMARY KEY,
  payload    JSON         NOT NULL,
  fetched_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  expires_at DATETIME(3)  NOT NULL,
  KEY idx_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Couverture fine : tout n'est pas disponible partout, et une page vide vaut
-- mieux qu'un appel gaspillé.
ALTER TABLE souvenir_leagues ADD COLUMN IF NOT EXISTS has_top_scorers TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE souvenir_leagues ADD COLUMN IF NOT EXISTS has_top_assists TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE souvenir_leagues ADD COLUMN IF NOT EXISTS has_top_cards   TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE souvenir_leagues ADD COLUMN IF NOT EXISTS tier            TINYINT    NOT NULL DEFAULT 3;
