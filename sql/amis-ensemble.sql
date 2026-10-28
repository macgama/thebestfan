-- thebestfan — jouer entre amis (28 octobre 2026, à la demande de Gaël).
--
-- Les gestes, le cadeau du jour, les échanges de doubles et le Fanzzy
-- emprunté. Le défi de la semaine n'a pas de table : il se compte sur les
-- chants que `virage_presence` garde déjà, et ses récompenses passent par le
-- grand livre (`recompenses`, source `defi`). Le bonus « côte à côte » au
-- Virage et la fiche d'un ami ne demandent rien en base.
--
-- À appliquer après auth.sql et amis.sql. Rejouable.
--
-- **Sans clé étrangère, exprès.** Les suites de test effacent `users` en
-- tête, et chaque table qui s'y accroche devrait être nommée dans tous leurs
-- `DROP TABLE` — la règle a déjà coûté cher (`pronostics`). Un compte
-- supprimé est anonymisé, pas effacé : ses lignes ici ne désignent plus
-- personne de lisible, et le code ne les sert qu'entre amis mutuels actifs.

-- Les gestes envoyés à un ami : une liste fermée de mots, jamais un texte
-- (`src/shared/amis-ensemble.js`). C'est aussi le fil de ce qui arrive entre
-- amis : un cadeau, un prêt, un échange y laissent leur geste.
CREATE TABLE IF NOT EXISTS amis_gestes (
  id     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  de     CHAR(36)    NOT NULL,
  a      CHAR(36)    NOT NULL,
  geste  VARCHAR(16) NOT NULL,
  le     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  vu     TINYINT     NOT NULL DEFAULT 0,
  KEY k_gestes_a (a, le),
  KEY k_gestes_de (de, le)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Le cadeau du jour : un par ami et par jour, et c'est la clé primaire qui
-- l'impose. `jour` est écrit par CURDATE(), le jour de jeu des quotas.
CREATE TABLE IF NOT EXISTS amis_cadeaux (
  id     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  de     CHAR(36)    NOT NULL,
  a      CHAR(36)    NOT NULL,
  jour   DATE        NOT NULL,
  le     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (de, a, jour),
  UNIQUE KEY u_cadeau_id (id),
  KEY k_cadeau_jour (de, jour)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Un échange de doubles : un exemplaire en trop contre un exemplaire en trop.
-- Proposé par `de`, accepté ou refusé par `a`. Rien ne bouge avant
-- l'acceptation, et elle revérifie les deux doubles.
CREATE TABLE IF NOT EXISTS amis_echanges (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  de         CHAR(36)    NOT NULL,
  a          CHAR(36)    NOT NULL,
  donne      VARCHAR(12) NOT NULL,
  demande    VARCHAR(12) NOT NULL,
  etat       ENUM('proposee','acceptee','refusee','annulee') NOT NULL DEFAULT 'proposee',
  le         DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  repondu_le DATETIME(3) NULL,
  KEY k_echange_a (a, etat),
  KEY k_echange_de (de, etat)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Le Fanzzy emprunté à un ami : un par jour, valable jusqu'à minuit. On le
-- joue dans son deck à l'âge que l'ami lui a fait atteindre ; l'ami ne perd
-- rien.
CREATE TABLE IF NOT EXISTS amis_prets (
  emprunteur CHAR(36)    NOT NULL,
  jour       DATE        NOT NULL,
  preteur    CHAR(36)    NOT NULL,
  fanzzy_id  VARCHAR(12) NOT NULL,
  stage      TINYINT     NOT NULL DEFAULT 1,
  le         DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (emprunteur, jour),
  KEY k_pret_preteur (preteur, jour)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
