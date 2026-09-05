-- thebestfan — collection Fanzzy côté serveur.
-- À appliquer après auth.sql et souvenirs.sql (qui crée user_wallet).

CREATE TABLE IF NOT EXISTS user_fanzzy (
  user_id    CHAR(36)    NOT NULL,
  fanzzy_id  VARCHAR(12) NOT NULL,
  copies     SMALLINT    NOT NULL DEFAULT 1,
  first_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, fanzzy_id),
  CONSTRAINT fk_uf_user FOREIGN KEY (user_id) REFERENCES users(public_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Le Fanzzy équipé pour les duels. Colonne ajoutée à la bourse existante :
-- c'est la même ligne, lue au même moment que les écharpes et les boosters.
ALTER TABLE user_wallet ADD COLUMN IF NOT EXISTS active_fanzzy VARCHAR(12) NULL;
