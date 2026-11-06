-- Les distinctions (6 novembre 2026) : des badges offerts par
-- l'administration, à commencer par « Fondateur », le remerciement des
-- bêta-testeurs. Le catalogue est dans `src/shared/distinctions.js`.
--
-- Une ligne par joueur et par distinction. Purement visuel : aucune ligne de
-- cette table ne fait pousser plus fort ni n'ouvre quoi que ce soit.
--
-- Sans clé étrangère, comme les tables récentes (`user_pass`) : un compte
-- supprimé est marqué `deleted`, jamais effacé, et aucune suite n'a à nommer
-- cette table dans ses `DROP TABLE users`.
--
-- Rejouable : `CREATE TABLE IF NOT EXISTS`.
CREATE TABLE IF NOT EXISTS user_distinctions (
  user_id     CHAR(36)     NOT NULL,
  distinction VARCHAR(24)  NOT NULL,
  -- L'admin qui l'a donnée (son `public_id`), pour le journal de l'écran.
  par         CHAR(36)     NULL,
  recue_le    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (user_id, distinction),
  KEY idx_distinction (distinction)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
