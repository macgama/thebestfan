-- Les mini-jeux d'entre les matchs : les jongles et les tirs au but.
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
