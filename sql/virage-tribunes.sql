-- thebestfan — le score de la corde de chaque Virage, pour le championnat des clubs.
--
-- ## Ce que ce fichier pose
--
-- Choix de Gaël du 29 octobre 2026 : le Virage rapporte des points au club,
-- comme le duel classé. La tribune qui gagne la corde d'un match rapporte 3
-- points au club de chacun de ses supporters classés, 1 sur un nul, 0 sinon
-- (`src/server/classements/index.js`). Le score de la corde ne vivait qu'en
-- mémoire, dans la salle : il disparaissait à sa fermeture et au redémarrage.
--
-- Une ligne par match, réécrite à chaque but de corde. Une salle rouverte
-- (redémarrage pendant le match) reprend son score ici.
--
-- ## Additif et rejouable
--
-- Une table neuve, sans clé étrangère. Sans elle, le Virage joue comme avant
-- et ne rapporte simplement aucun point au club.

CREATE TABLE IF NOT EXISTS virage_tribunes (
  fixture_id INT         NOT NULL PRIMARY KEY,
  buts_dom   SMALLINT    NOT NULL DEFAULT 0,  -- buts de corde de la tribune à domicile
  buts_ext   SMALLINT    NOT NULL DEFAULT 0,  -- et de celle de l'extérieur
  maj_a      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
