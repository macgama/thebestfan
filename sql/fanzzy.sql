-- thebestfan — collection Fanzzy côté serveur.
-- À appliquer après auth.sql et souvenirs.sql (qui crée user_wallet).

-- Le catalogue lui-même.
--
-- Il vivait dans src/shared/fanzzy/dex.js, ce qui obligeait à passer par un
-- déploiement pour ajouter une carte. À cent Fanzzy ce n'est plus tenable :
-- le catalogue devient une donnée, et dex.js n'en sera plus que l'amorçage.
--
-- `set` est un mot réservé SQL, d'où `set_id`.
-- `publie` sort une carte des tirages sans la supprimer : un identifiant
-- effacé orphelinerait les collections, les decks et le Fanzzy équipé de tous
-- les joueurs qui le possèdent.
CREATE TABLE IF NOT EXISTS fanzzy (
  id        VARCHAR(12)  NOT NULL,
  nom       VARCHAR(64)  NOT NULL,
  type      VARCHAR(8)   NOT NULL,
  set_id    VARCHAR(4)   NOT NULL,
  stage     TINYINT      NOT NULL DEFAULT 1,
  -- 16 et non 8 : « legendaire » fait dix caractères. Sous MySQL non strict,
  -- une colonne trop courte ne lève pas — elle tronque en silence, et la carte
  -- se retrouve avec une rareté « legendai » que plus rien ne reconnaît.
  rar       VARCHAR(16)  NOT NULL,
  evo       VARCHAR(12)  NULL,
  histoire  TEXT         NULL,
  mods      JSON         NOT NULL,
  cri       JSON         NOT NULL,
  publie    TINYINT(1)   NOT NULL DEFAULT 1,
  ordre     SMALLINT     NOT NULL DEFAULT 0,
  cree_a    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  maj_a     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
              ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY k_fanzzy_tirage (publie, set_id, rar)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
