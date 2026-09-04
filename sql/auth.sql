-- thebestfan — authentification
-- Appliquer avec :
--   mysql -h o42s1v.myd.infomaniak.com -u o42s1v_tbf -p o42s1v_thebestfan < sql/auth.sql

CREATE TABLE IF NOT EXISTS users (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  -- Identifiant exposé au client et utilisé par le duel. Jamais l'id numérique,
  -- qui laisserait deviner le nombre d'inscrits et l'ordre des comptes.
  public_id       CHAR(36)     NOT NULL,
  email           VARCHAR(190) NOT NULL,
  pseudo          VARCHAR(20)  NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  locale          ENUM('fr','en','de','es') NOT NULL DEFAULT 'fr',
  status          ENUM('active','locked','deleted') NOT NULL DEFAULT 'active',
  email_verified_at DATETIME(3) NULL,
  main_team_id    INT          NULL,          -- club suivi (id API-Football)
  created_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  last_login_at   DATETIME(3)  NULL,
  UNIQUE KEY uq_email (email),
  UNIQUE KEY uq_pseudo (pseudo),
  UNIQUE KEY uq_public (public_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Le jeton de session n'est jamais stocké en clair : seule son empreinte l'est.
-- Une fuite de la base ne permet donc pas d'usurper une session ouverte.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash   CHAR(64)     NOT NULL PRIMARY KEY,
  user_id      BIGINT UNSIGNED NOT NULL,
  created_at   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  last_seen_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  expires_at   DATETIME(3)  NOT NULL,
  ip           VARCHAR(45)  NULL,
  user_agent   VARCHAR(255) NULL,
  KEY idx_user (user_id),
  KEY idx_expiry (expires_at),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Vérification d'adresse et réinitialisation de mot de passe.
CREATE TABLE IF NOT EXISTS auth_tokens (
  token_hash CHAR(64) NOT NULL PRIMARY KEY,
  user_id    BIGINT UNSIGNED NOT NULL,
  purpose    ENUM('verify_email','reset_password') NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  used_at    DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_user_purpose (user_id, purpose),
  KEY idx_expiry (expires_at),
  CONSTRAINT fk_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Freine les attaques par force brute, par compte visé et par adresse IP.
CREATE TABLE IF NOT EXISTS login_attempts (
  id        BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  key_type  ENUM('email','ip') NOT NULL,
  key_value VARCHAR(190) NOT NULL,
  success   TINYINT(1)   NOT NULL DEFAULT 0,
  at        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_lookup (key_type, key_value, at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
