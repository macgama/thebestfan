-- thebestfan — les états deviennent des cartes à gagner.
--
-- Un Fanzzy est dessiné dans quatre états en plus de son repos : la joie, le
-- dépit, l'encouragement et la colère. Jusqu'ici ils étaient **donnés** : qui
-- possédait le personnage les avait tous, sans jamais rien en savoir. Quatre
-- dessins par âge, soit douze par lignée, qui n'apparaissaient nulle part
-- dans le classeur et que rien ne faisait désirer.
--
-- Ils rejoignent donc les tenues : une case à remplir, un booster qui peut la
-- remplir, et une fiche qui dit ce qu'il manque. La règle du jeu ne bouge pas
-- d'un pouce — « on vend de la largeur et du confort, jamais de la
-- puissance » : un état ne donne aucun bonus, exactement comme un skin. Ce
-- qu'on gagne, c'est de voir son personnage exulter plutôt que rester droit.
--
-- La clé est celle de `user_skins`, au mot près, et pour la même raison : on
-- possède l'état **d'un âge**, pas du personnage. Le Capo n'hérite pas de la
-- joie du gamin — c'est ce qui donne une raison de rouvrir des boosters après
-- avoir fait grandir quelqu'un.
--
-- À appliquer après fanzzy.sql (dont il suit la possession) et inventaire.sql.
-- Rejouable : `CREATE TABLE IF NOT EXISTS`, et le rattrapage ci-dessous est
-- borné dans le temps — voir son propre commentaire.

CREATE TABLE IF NOT EXISTS user_etats (
  user_id   CHAR(36)    NOT NULL,
  -- La racine de lignée, comme dans `user_fanzzy` : on possède un personnage,
  -- pas un âge. L'âge, lui, est dans `stage`.
  fanzzy_id VARCHAR(12) NOT NULL,
  stage     TINYINT     NOT NULL DEFAULT 1,
  -- 'joie' | 'depit' | 'pousse' | 'colere' — voir ETATS_DESSINES dans
  -- src/shared/fanzzy/rendus.js, qui fait foi. Pas d'ENUM : un cinquième état
  -- dessiné un jour ne doit pas demander un ALTER TABLE en production.
  etat      VARCHAR(16) NOT NULL,
  got_at    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, fanzzy_id, stage, etat),
  CONSTRAINT fk_user_etats_user
    FOREIGN KEY (user_id) REFERENCES users (public_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Le tirage demande « quels états manquent à ce joueur, sur les Fanzzy qu'il
-- a » : c'est un balayage par joueur, que la clé primaire couvre déjà. Cet
-- index-ci sert l'autre sens — la fiche d'un personnage, qui ne veut que ses
-- quatre lignes.
CREATE INDEX IF NOT EXISTS idx_etat_perso ON user_etats (user_id, fanzzy_id, stage);

-- ------------------------------------------------------------ le rattrapage
--
-- Personne ne doit perdre ce qu'il voyait hier. Les Fanzzy possédés **avant
-- la bascule** gardent donc leurs quatre états, à tous les âges atteints ; ce
-- qui arrive après se gagne.
--
-- La date est écrite en dur, et c'est ce qui rend ce fichier rejouable sans
-- casser la fonctionnalité. Sans elle, chaque déploiement re-offrirait leurs
-- états à tous les Fanzzy obtenus depuis — y compris ceux dont on venait de
-- gagner l'état dans un booster — et la nouveauté se serait annulée toute
-- seule, en silence, à la mise en ligne suivante. `INSERT IGNORE` seul n'y
-- suffisait pas : il empêche le doublon, pas le don.
INSERT IGNORE INTO user_etats (user_id, fanzzy_id, stage, etat)
SELECT uf.user_id, uf.fanzzy_id, s.stage, e.etat
  FROM user_fanzzy uf
  JOIN (SELECT 1 AS stage UNION ALL SELECT 2 UNION ALL SELECT 3) s
    ON s.stage <= uf.stage
  JOIN (SELECT 'joie' AS etat UNION ALL SELECT 'depit'
        UNION ALL SELECT 'pousse' UNION ALL SELECT 'colere') e
 WHERE uf.first_at < '2026-09-22 00:00:00';
