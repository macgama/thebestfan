-- thebestfan — le club principal qui se change, et la sélection principale.
--
-- ## Ce que ce fichier pose
--
-- Choix de Gaël du 28 octobre 2026 (`src/server/football/principal.js`) :
--
-- - `user_follows.is_main_nation` : la sélection nationale principale, à
--   côté du club principal (`is_main`, inchangé). Une par joueur.
-- - `user_wallet.principal_saison`, `user_wallet.selection_saison` : la
--   saison du dernier changement de chacun (`S12`, ou `2027-T1` sans saison
--   lancée). Un seul changement par saison ; le premier choix, au paquet de
--   bienvenue, n'en est pas un.
--
-- ## Pourquoi il vient en dernier
--
-- Une colonne sur `user_follows` (football.sql) et deux sur `user_wallet`
-- (souvenirs.sql). Rien n'en dépend.
--
-- ## Additif et rejouable
--
-- Trois colonnes, à zéro ou nulles : le code d'avant n'en lit aucune. Sans ce
-- fichier, le club principal se lit comme avant et le bouton du profil dit
-- que le changement n'est pas encore branché.

ALTER TABLE user_follows ADD COLUMN IF NOT EXISTS is_main_nation TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE user_wallet ADD COLUMN IF NOT EXISTS principal_saison VARCHAR(16) NULL;
ALTER TABLE user_wallet ADD COLUMN IF NOT EXISTS selection_saison VARCHAR(16) NULL;
