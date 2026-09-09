-- thebestfan — un skin appartient à un âge, plus au personnage.
--
-- « Chaque évolution aura ses divers skins à gagner. » Jusqu'ici `user_skins`
-- ne connaissait que `(joueur, personnage, skin)` : une tenue gagnée habillait
-- le personnage à tous ses âges, et le dossier `e2/hiver/` que la chaîne
-- d'images sait produire n'avait aucun moyen d'être atteint.
--
-- La clé s'élargit donc d'un cran. C'est aussi ce qui donne une raison de
-- continuer à ouvrir des boosters après avoir fait grandir quelqu'un : le Capo
-- n'hérite pas de la garde-robe du gamin.
--
-- À appliquer après inventaire.sql.
-- Rejouable : `ADD COLUMN IF NOT EXISTS`, et redéfinir une clé primaire à
-- l'identique ne fait rien.

ALTER TABLE user_skins
  ADD COLUMN IF NOT EXISTS stage TINYINT NOT NULL DEFAULT 1 AFTER fanzzy_id;

-- Les lignes existantes valent pour le premier âge — c'est le défaut de la
-- colonne, et c'est exact : elles ont toutes été gagnées avant que les âges
-- existent, donc sur des personnages au premier stade.
--
-- On élargit la clé plutôt que d'en créer une seconde : sans ça, un joueur ne
-- pourrait posséder « hiver » qu'une seule fois, pour un seul de ses trois
-- âges, et l'insertion du second serait ignorée en silence.
ALTER TABLE user_skins
  DROP PRIMARY KEY,
  ADD PRIMARY KEY (user_id, fanzzy_id, stage, skin_id);

-- `equipped` se lit désormais par âge : le personnage porte une tenue par
-- stade, et c'est celle de son stade courant qui s'affiche.
CREATE INDEX IF NOT EXISTS idx_skin_porte ON user_skins (user_id, fanzzy_id, stage, equipped);
