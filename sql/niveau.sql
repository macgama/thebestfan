-- thebestfan — le niveau du joueur.
--
-- Une seule colonne : l'XP cumulée. Le niveau s'en déduit par la courbe de
-- `src/shared/niveau.js`, et ne se range donc nulle part.
--
-- C'est délibéré. Stocker le niveau à côté de l'XP, ce serait deux chiffres qui
-- disent la même chose et qui finiront par se contredire — au premier réglage
-- de la courbe, tous les niveaux enregistrés deviendraient faux, et il faudrait
-- une migration pour chaque ajustement d'équilibre. Une donnée dérivée ne se
-- stocke pas.
--
-- À appliquer après souvenirs.sql (qui crée `user_wallet`).
-- Rejouable : la relancer sur une base déjà migrée ne fait rien.

ALTER TABLE user_wallet
  ADD COLUMN IF NOT EXISTS xp INT UNSIGNED NOT NULL DEFAULT 0 AFTER scarves;

-- Le classement par niveau se lit à chaque ouverture du classement.
CREATE INDEX IF NOT EXISTS idx_wallet_xp ON user_wallet (xp);

-- Les comptes existants partent de zéro, ce qui est le défaut de la colonne —
-- rien à rattraper. On ne leur invente pas d'XP rétroactive : ils n'ont rien
-- perdu, et le premier booster ouvert lance la barre.
