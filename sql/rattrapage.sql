-- thebestfan — rattrapage d'une base déjà en ligne.
--
-- À appliquer sur une base créée avant les modules inventaire, deck et admin.
-- Toutes les instructions sont idempotentes : les relancer ne casse rien.
--
--   mysql -h HOTE -u UTILISATEUR -p BASE < sql/rattrapage.sql

-- ---------------------------------------------------------------- 1. rôles
ALTER TABLE users ADD COLUMN IF NOT EXISTS role ENUM('joueur','admin') NOT NULL DEFAULT 'joueur';

-- ------------------------------------------------------- 2. bourse complète
ALTER TABLE user_wallet ADD COLUMN IF NOT EXISTS follow_slots TINYINT NOT NULL DEFAULT 2;
ALTER TABLE user_wallet ADD COLUMN IF NOT EXISTS onboarded_at DATETIME(3) NULL;
ALTER TABLE user_wallet ADD COLUMN IF NOT EXISTS action_cards JSON NULL;

-- Les comptes créés avant la cérémonie d'arrivée seraient renvoyés vers elle
-- à chaque connexion, et perdraient leur collection en rouvrant un paquet de
-- bienvenue. On considère comme arrivés ceux qui ont déjà des Fanzzy.
UPDATE user_wallet w
   SET w.onboarded_at = NOW(3)
 WHERE w.onboarded_at IS NULL
   AND EXISTS (SELECT 1 FROM user_fanzzy f WHERE f.user_id = w.user_id);

-- --------------------------------------------- 3. interclassement des duels
-- Sans cela, toute jointure entre duel_results et users échoue avec
-- « Illegal mix of collations » : le classement des duels reste vide sans
-- qu'aucune erreur ne remonte.
-- MariaDB refuse de convertir une colonne portant une clé étrangère, et
-- `SET FOREIGN_KEY_CHECKS = 0` n'y change rien : il faut retirer la contrainte,
-- convertir, puis la remettre. `duel_events.duel_id` référence `duels.id`.
ALTER TABLE duel_events DROP FOREIGN KEY fk_events_duel;

ALTER TABLE duels        CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE duel_events  CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE duel_results CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE duel_events
  ADD CONSTRAINT fk_events_duel FOREIGN KEY (duel_id) REFERENCES duels(id) ON DELETE CASCADE;

-- ------------------------------------------------------------ 4. contrôle
-- Doit renvoyer zéro ligne. Toute ligne signale une table restée en
-- utf8mb4_general_ci, donc une jointure qui échouera silencieusement.
SELECT table_name AS table_a_corriger, table_collation
  FROM information_schema.tables
 WHERE table_schema = DATABASE()
   AND table_collation <> 'utf8mb4_unicode_ci';
