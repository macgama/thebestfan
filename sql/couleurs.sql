-- Les couleurs d'un club, extraites de son blason une fois pour toutes.
--
-- On ne garde que les couleurs : deux chaînes de sept caractères. Le dessin
-- n'est ni copié, ni stocké, ni servi — il reste chez l'API. C'est ce qui
-- permet de teindre « GOAL ! » aux couleurs de l'équipe sans rien
-- s'approprier.
--
-- `colors_at` sert de mémoire de la tentative, et pas seulement du succès :
-- sans elle, un blason illisible serait retéléchargé à chaque affichage du
-- match. Elle est donc écrite même quand l'extraction échoue, `color1` restant
-- alors nulle — et le club garde la couleur par défaut du jeu.

ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS color1    CHAR(7) NULL AFTER logo,
  ADD COLUMN IF NOT EXISTS color2    CHAR(7) NULL AFTER color1,
  ADD COLUMN IF NOT EXISTS colors_at DATETIME NULL AFTER color2;
