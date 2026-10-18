-- Les mini-jeux d'entre les matchs : les jongles, les tirs au but, le chant en
-- rythme, le déplacement, le tifo du club et la tribune contre le boss.
--
-- Demandés par Gaël le 18 octobre 2026 : des jeux à jouer entre deux matchs,
-- seul ou en 1 contre 1, avec un classement, qui rapportent des écharpes, et
-- dont les compteurs repartent de zéro à chaque saison. D'où `saison_id` sur
-- chaque ligne : le classement d'une saison ne lit que les siennes, et rien
-- n'est jamais effacé.
--
-- Aucune clé étrangère vers `users`, comme `notif_appareils` : un compte
-- supprimé est anonymisé, pas effacé, et les classements ne gardent que les
-- comptes actifs. Les suites qui vident `users` n'ont donc pas à nommer ces
-- tables.

-- Une partie de jongles. Le serveur l'ouvre (`debut_a`, `graine` : le hasard
-- des rebonds, le même pour le joueur et pour le contrôle), le joueur la
-- referme avec son score et l'instant de chaque frappe. Le meilleur score de
-- la saison se lit ici : pas de table de records à tenir à jour.
CREATE TABLE IF NOT EXISTS jeux_jongles (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    CHAR(36)        NOT NULL,
  saison_id  INT UNSIGNED        NULL,
  graine     INT UNSIGNED    NOT NULL,
  debut_a    DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  fin_a      DATETIME(3)         NULL,
  score      INT UNSIGNED        NULL,
  echarpes   INT UNSIGNED        NULL,
  PRIMARY KEY (id),
  KEY k_jongles_joueur (user_id, debut_a),
  KEY k_jongles_classement (saison_id, score, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Une série de tirs au but entre deux joueurs, qui ne jouent pas en même
-- temps. Le premier (`a_id`) tire ses cinq tirs et plonge cinq fois ; la
-- série attend alors son adversaire : un ami défié (`b_id` posé d'avance), ou
-- le premier venu (`b_id` nul). Le second joue à son tour, et la série se
-- règle aussitôt. Personne ne vient : passé un délai, le Fanzzy de la
-- machine prend la place (`machine`), et la série ne compte pas au
-- classement.
CREATE TABLE IF NOT EXISTS jeux_tirs (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  saison_id  INT UNSIGNED        NULL,
  a_id       CHAR(36)        NOT NULL,
  b_id       CHAR(36)            NULL,
  ami        TINYINT(1)      NOT NULL DEFAULT 0,
  machine    TINYINT(1)      NOT NULL DEFAULT 0,
  a_jeu      JSON            NOT NULL,
  b_jeu      JSON                NULL,
  buts_a     TINYINT UNSIGNED    NULL,
  buts_b     TINYINT UNSIGNED    NULL,
  cree_a     DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  joue_a     DATETIME(3)         NULL,
  -- Le premier tireur a-t-il vu le résultat ? Le second l'a vu en jouant.
  vu_a       TINYINT(1)      NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY k_tirs_a (a_id, cree_a),
  KEY k_tirs_b (b_id, joue_a),
  KEY k_tirs_ouvertes (joue_a, ami, cree_a),
  KEY k_tirs_saison (saison_id, joue_a)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Une partie d'un jeu seul de plus : le chant en rythme (`chant`) ou le
-- déplacement (`deplacement`). Même vie qu'une partie de jongles : le serveur
-- l'ouvre avec sa graine (la partition du chant, la route du déplacement),
-- le joueur la referme avec ses gestes, et le serveur en tire le score
-- lui-même. Ajoutés le 18 octobre 2026, avec l'accord de Gaël.
CREATE TABLE IF NOT EXISTS jeux_parties (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  jeu        VARCHAR(12)     NOT NULL,
  user_id    CHAR(36)        NOT NULL,
  saison_id  INT UNSIGNED        NULL,
  graine     INT UNSIGNED    NOT NULL,
  debut_a    DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  fin_a      DATETIME(3)         NULL,
  score      INT UNSIGNED        NULL,
  echarpes   INT UNSIGNED        NULL,
  PRIMARY KEY (id),
  KEY k_parties_joueur (user_id, jeu, debut_a),
  KEY k_parties_classement (jeu, saison_id, score, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Le tifo du club : une case de la mosaïque que les supporters d'un club
-- (`team_id`, leur club suivi) peignent ensemble avant un match
-- (`fixture_id`). Une case n'a qu'une couleur, celle du dernier qui l'a
-- peinte ; le nombre de cases par jour et par joueur se compte dans
-- `compteurs_jour` (clé `tifo`).
CREATE TABLE IF NOT EXISTS jeux_tifo (
  team_id    INT             NOT NULL,
  fixture_id INT             NOT NULL,
  case_n     SMALLINT UNSIGNED NOT NULL,
  couleur    TINYINT UNSIGNED NOT NULL,
  user_id    CHAR(36)        NOT NULL,
  pose_a     DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (team_id, fixture_id, case_n),
  KEY k_tifo_joueur (user_id, team_id, fixture_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- La tribune contre le boss : les chants réussis de chaque supporter pour
-- son club, semaine par semaine (`semaine` : le lundi). La voix retirée au
-- boss est la somme des `coups` du club ; une ligne par joueur dit aussi qui
-- a poussé, donc qui reçoit la récompense.
CREATE TABLE IF NOT EXISTS jeux_boss (
  team_id    INT             NOT NULL,
  semaine    DATE            NOT NULL,
  user_id    CHAR(36)        NOT NULL,
  coups      INT UNSIGNED    NOT NULL DEFAULT 0,
  PRIMARY KEY (team_id, semaine, user_id),
  KEY k_boss_joueur (user_id, semaine)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
