-- thebestfan — decks de duel.
-- À appliquer après auth.sql, fanzzy.sql et inventaire.sql.

CREATE TABLE IF NOT EXISTS user_decks (
  user_id CHAR(36)    NOT NULL,
  nom     VARCHAR(32) NOT NULL DEFAULT 'Mon deck',
  -- Le deck complet en JSON : trois Fanzzy avec leur équipement, dix cartes.
  -- Un format souple, parce que ces règles bougeront encore.
  contenu JSON        NOT NULL,
  actif   TINYINT(1)  NOT NULL DEFAULT 1,
  cree    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  maj     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id),
  CONSTRAINT fk_deck_user FOREIGN KEY (user_id) REFERENCES users(public_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
