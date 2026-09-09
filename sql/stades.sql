-- thebestfan — un personnage, trois âges.
--
-- Avant : chaque âge était une carte à part. Le joueur qui faisait évoluer son
-- Choriste perdait `V1` et gagnait `V2` — la carte quittait sa collection, et
-- vingt et une entrées du catalogue racontaient sept personnages.
--
-- Après : il possède **le personnage**, arrivé à un stade. Le catalogue garde
-- ses trois lignes, qui portent les trois noms, les trois histoires et les
-- trois jeux de bonus ; la collection, elle, n'en retient qu'une, avec le
-- chiffre de l'âge atteint.
--
-- À appliquer après fanzzy.sql, inventaire.sql et deck.sql.
-- Rejouable : la relancer sur une base déjà migrée ne fait rien.

-- Jusqu'où ce joueur a fait grandir ce personnage. 1 par défaut, ce qui est
-- exactement ce qu'il faut pour toutes les lignes existantes : elles décrivent
-- un exemplaire au premier âge, sauf celles que la suite va replier.
ALTER TABLE user_fanzzy
  ADD COLUMN IF NOT EXISTS stage TINYINT NOT NULL DEFAULT 1 AFTER copies;

-- La correspondance âge → personnage, lue depuis le catalogue lui-même.
--
-- Elle se calcule en trois morceaux plutôt qu'en boucle : une lignée compte au
-- plus trois âges, et MariaDB refuse qu'une table temporaire s'alimente
-- d'elle-même. Une racine est une carte dont personne n'est la suite — et non
-- une carte marquée `stage = 1`, parce que ce champ s'édite depuis
-- l'administration et qu'une lignée mal numérotée doit rester récupérable.
DROP TEMPORARY TABLE IF EXISTS tmp_stades;
CREATE TEMPORARY TABLE tmp_stades AS
  SELECT r.id AS id, r.id AS racine, 1 AS stade
    FROM fanzzy r
   WHERE NOT EXISTS (SELECT 1 FROM fanzzy p WHERE p.evo = r.id)
  UNION ALL
  SELECT s2.id, r.id, 2
    FROM fanzzy r
    JOIN fanzzy s2 ON s2.id = r.evo
   WHERE NOT EXISTS (SELECT 1 FROM fanzzy p WHERE p.evo = r.id)
  UNION ALL
  SELECT s3.id, r.id, 3
    FROM fanzzy r
    JOIN fanzzy s2 ON s2.id = r.evo
    JOIN fanzzy s3 ON s3.id = s2.evo
   WHERE NOT EXISTS (SELECT 1 FROM fanzzy p WHERE p.evo = r.id);

CREATE INDEX idx_tmp_stades ON tmp_stades (id);

-- 1. Replier les âges supérieurs sur le personnage.
--
--    `SUM(copies)` : un joueur qui possédait encore un Choriste en double et
--    son Meneur de chant avait bien tiré la carte trois fois. Les doublons sont
--    de l'argent — les lui reprendre au passage serait un vol silencieux.
--
--    `MAX(stade)` : c'est le plus haut âge atteint qui compte, et `GREATEST`
--    dans la clause de doublon protège le cas où la ligne du personnage existe
--    déjà avec un stade supérieur. Sans lui, rejouer ce fichier ferait
--    régresser une collection.
INSERT INTO user_fanzzy (user_id, fanzzy_id, copies, stage, first_at)
SELECT uf.user_id, t.racine, SUM(uf.copies), MAX(t.stade), MIN(uf.first_at)
  FROM user_fanzzy uf
  JOIN tmp_stades t ON t.id = uf.fanzzy_id
 WHERE t.stade > 1
 GROUP BY uf.user_id, t.racine
    ON DUPLICATE KEY UPDATE
       copies   = user_fanzzy.copies + VALUES(copies),
       stage    = GREATEST(user_fanzzy.stage, VALUES(stage)),
       first_at = LEAST(user_fanzzy.first_at, VALUES(first_at));

-- 2. Les lignes d'âges supérieurs n'ont plus d'objet.
DELETE uf FROM user_fanzzy uf
  JOIN tmp_stades t ON t.id = uf.fanzzy_id
 WHERE t.stade > 1;

-- 3. Le Fanzzy équipé désigne un personnage, plus un âge.
--
--    Sans ça, l'accueil et le duel chercheraient `V2` dans une collection qui
--    ne connaît plus que `V1` : pas d'erreur, pas de message — un avatar vide.
UPDATE user_wallet w
  JOIN tmp_stades t ON t.id = w.active_fanzzy
   SET w.active_fanzzy = t.racine
 WHERE t.stade > 1;

DROP TEMPORARY TABLE IF EXISTS tmp_stades;

-- Les decks ne sont pas repris ici. Leur contenu est un document JSON, et le
-- réécrire en SQL demanderait une chirurgie fragile pour un gain nul : le
-- serveur traduit désormais tout identifiant d'âge en identifiant de
-- personnage à la lecture comme à l'écriture. Un deck enregistré avant cette
-- migration se répare donc tout seul la première fois qu'il est ouvert.
