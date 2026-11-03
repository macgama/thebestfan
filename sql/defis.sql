-- Les défis de la semaine (demande de Gaël du 3 novembre 2026, fil « Ajouter
-- des missions PASS, séries et stuff »).
--
-- Trois défis par joueur et par semaine, tirés parmi ce qu'il possède : une
-- série (« Joue 5 duels avec un Fanzzy LES TERRACES »), une pièce de stuff
-- portée (« Chante 30 fois au Grand Virage en portant le Cornet de brume »),
-- une tenue (« Joue 3 duels en tenue Carnaval »). Un quatrième pour les
-- membres d'un PASS dont la saison court : jouer sa tenue de PASS. Celui-là
-- ne rapporte que des points de la voie PASS (visuel seulement, choix de
-- Gaël du 3 novembre 2026), jamais d'écharpes ni de tampons du carnet.
--
-- ## Une ligne par défi, avec ce qu'il promet
--
-- `semaine` : le lundi de la semaine de jeu, écrit en SQL
-- (`CURDATE() - INTERVAL WEEKDAY(CURDATE()) DAY`), jamais fabriqué en
-- JavaScript. `rang` : 0 série, 1 stuff, 2 tenue, 3 PASS. `objet` : le code de
-- la série, l'identifiant de la pièce ou de la tenue. Les gains sont COPIÉS au
-- tirage, comme ceux des missions du jour : un réglage changé le mercredi vaut
-- pour la semaine suivante.
--
-- `fait` avance en fin de duel (un duel d'au moins une minute, pas quitté :
-- la règle des missions) et à chaque chant au Grand Virage. Le versement
-- passe par le grand livre (`recompenses`, source `hebdo`, ou `voie` pour le
-- PASS, clé `<semaine>:<rang>`), qui en fait l'idempotence.
--
-- Sans clé étrangère, comme les tables récentes : `deleteUser` efface les
-- lignes du joueur nommément, et aucune suite n'a à nommer cette table dans
-- ses `DROP TABLE users`.
CREATE TABLE IF NOT EXISTS defis_semaine (
  user_id   CHAR(36)          NOT NULL,
  semaine   DATE              NOT NULL,
  rang      TINYINT UNSIGNED  NOT NULL,
  sorte     VARCHAR(8)        NOT NULL,
  objet     VARCHAR(40)       NOT NULL,
  cible     SMALLINT UNSIGNED NOT NULL,
  fait      SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  echarpes  SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  tampons   TINYINT UNSIGNED  NOT NULL DEFAULT 0,
  points    TINYINT UNSIGNED  NOT NULL DEFAULT 0,
  saison_id INT UNSIGNED          NULL,
  cree_a    DATETIME(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, semaine, rang)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
