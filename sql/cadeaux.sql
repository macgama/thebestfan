-- Les cadeaux de l'administration, annoncés au joueur (6 novembre 2026,
-- `src/server/cadeaux/index.js`). Les cadeaux eux-mêmes sont déjà écrits dans
-- `admin_audit` ; il ne manque que « vu jusqu'où » : le dernier numéro de
-- journal que le joueur a vu fêté. Nul : rien vu encore (la fête remonte
-- alors trente jours au plus).
--
-- Rejouable : `ADD COLUMN IF NOT EXISTS`.
ALTER TABLE user_wallet ADD COLUMN IF NOT EXISTS cadeau_vu BIGINT UNSIGNED NULL;
