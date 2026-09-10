-- Les minutes additionnelles.
--
-- L'horloge d'un match s'arrêtait à « 90+ » sans jamais dire combien. Pire :
-- une page qui ne connaît que `elapsed` ne peut pas distinguer la
-- quatre-vingt-dixième minute du temps additionnel qui la suit, ni savoir
-- quand s'arrêter — d'où des matchs restés « 90' EN DIRECT » dix minutes
-- après le coup de sifflet final.
--
-- API-Football sert cette valeur dans `fixture.status.extra`. Elle vaut NULL
-- hors temps additionnel, et c'est une information distincte de `elapsed` :
-- 90+3 n'est pas 93, et la différence compte pour qui regarde le match.
--
-- Même forme que `niveau.sql` et `stades.sql` : un `ADD COLUMN IF NOT EXISTS`,
-- que le contrôle de schéma du démarrage sait lire et réclamer par son nom.
-- `SHOW TABLES` ne verra rien de ce fichier — c'est le piège documenté au
-- § 7 bis d'ETAT.md, et c'est pour ça que ce contrôle existe.

ALTER TABLE fixtures
  ADD COLUMN IF NOT EXISTS elapsed_extra SMALLINT NULL AFTER elapsed;
