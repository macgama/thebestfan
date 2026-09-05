-- thebestfan — inscription, emplacements de suivi, inventaire.
-- À appliquer après auth.sql, football.sql, souvenirs.sql et fanzzy.sql.

-- Emplacements de suivi. Deux à l'inscription, d'autres se gagnent.
-- La colonne vit dans la bourse : c'est la ligne qu'on lit déjà partout.
ALTER TABLE user_wallet ADD COLUMN IF NOT EXISTS follow_slots  TINYINT NOT NULL DEFAULT 2;
ALTER TABLE user_wallet ADD COLUMN IF NOT EXISTS onboarded_at  DATETIME(3) NULL;
ALTER TABLE user_wallet ADD COLUMN IF NOT EXISTS action_cards  JSON NULL;

-- Skins : purement décoratifs, et c'est un choix.
-- Un skin qui donne un bonus rendrait le joueur qui ouvre le plus de paquets
-- plus fort, ce qui n'est pas un jeu mais une caisse enregistreuse.
CREATE TABLE IF NOT EXISTS user_skins (
  user_id   CHAR(36)    NOT NULL,
  fanzzy_id VARCHAR(12) NOT NULL,
  skin_id   VARCHAR(24) NOT NULL,
  equipped  TINYINT(1)  NOT NULL DEFAULT 0,
  got_at    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, fanzzy_id, skin_id),
  KEY idx_equip (user_id, equipped),
  CONSTRAINT fk_skin_user FOREIGN KEY (user_id) REFERENCES users(public_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Équipement. Deux emplacements portés au maximum, et chaque pièce a un revers :
-- personne ne devient simplement plus fort, on devient différent.
CREATE TABLE IF NOT EXISTS user_stuff (
  user_id  CHAR(36)    NOT NULL,
  stuff_id VARCHAR(24) NOT NULL,
  copies   SMALLINT    NOT NULL DEFAULT 1,
  slot     TINYINT     NULL,          -- 1 ou 2 si porté, NULL sinon
  got_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, stuff_id),
  KEY idx_worn (user_id, slot),
  CONSTRAINT fk_stuff_user FOREIGN KEY (user_id) REFERENCES users(public_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
