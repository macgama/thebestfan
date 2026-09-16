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

-- Le code ISO du pays d'une compétition — « ES », « BR », « CH ».
--
-- L'API écrit les pays en anglais et seulement en anglais. Traduire un nom
-- demande un code, pas une chaîne : `Intl.DisplayNames` du navigateur connaît
-- déjà les deux cents pays dans les quatre langues du jeu, et il ne lui faut
-- que ces deux lettres. On les range ici plutôt que de tenir dans le dépôt une
-- table de huit cents traductions que personne ne relirait jamais.
--
-- `/leagues` de l'API les donne dans la réponse qu'on lit déjà : `coverage.mjs`
-- les écrit sans un appel de plus. Une colonne vide n'empêche rien — la page
-- retombe alors sur le nom anglais.
ALTER TABLE souvenir_leagues ADD COLUMN IF NOT EXISTS country_code CHAR(2) NULL;

-- Les compétitions suivies.
--
-- Distinctes des clubs suivis, et c'est tout l'intérêt : on peut vouloir la
-- Champions League sans suivre aucun de ses clubs, ou la Coupe du monde sans
-- suivre une sélection. `user_follows` ne sait répondre qu'« un de tes clubs
-- joue » ; cette table répond « une compétition que tu suis joue ».
--
-- Pas de saison dans la clé : on suit une compétition, pas une de ses années.
CREATE TABLE IF NOT EXISTS user_league_follows (
  user_id    CHAR(36)    NOT NULL,
  league_id  INT         NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, league_id),
  KEY idx_league (league_id),
  CONSTRAINT fk_lfollow_user FOREIGN KEY (user_id) REFERENCES users(public_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
