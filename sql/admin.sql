-- thebestfan — administration.
-- À appliquer après auth.sql.

-- Le rôle vit sur l'utilisateur. Deux valeurs suffisent : il n'y a pas encore
-- de raison d'inventer une hiérarchie que personne n'utilisera.
ALTER TABLE users ADD COLUMN IF NOT EXISTS role ENUM('joueur','admin') NOT NULL DEFAULT 'joueur';

-- Journal des actions d'administration.
--
-- Toute écriture passe par ici, sans exception. Le jour où un compte est
-- bloqué à tort ou 10 000 écharpes apparaissent, la seule question qui compte
-- est « qui, quand, et pourquoi » — et personne ne s'en souvient trois
-- semaines plus tard. Le journal est en ajout seul : aucune route ne le
-- modifie ni ne l'efface.
CREATE TABLE IF NOT EXISTS admin_audit (
  id       BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  acteur   CHAR(36)     NOT NULL,
  action   VARCHAR(48)  NOT NULL,
  cible    VARCHAR(64)  NULL,
  detail   JSON         NULL,
  ip       VARCHAR(45)  NULL,
  au       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_acteur (acteur, au),
  KEY idx_cible (cible, au),
  KEY idx_date (au)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Réglages modifiables sans redéploiement : messages d'annonce, ouverture des
-- modes, plafonds. Une valeur par clé, en JSON pour ne pas figer la forme.
CREATE TABLE IF NOT EXISTS reglages (
  cle      VARCHAR(48) NOT NULL PRIMARY KEY,
  valeur   JSON        NOT NULL,
  maj_par  CHAR(36)    NULL,
  maj      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
