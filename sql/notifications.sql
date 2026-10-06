-- thebestfan — les notifications, même l'appli fermée.
--
-- À appliquer après auth.sql. Rejouable.

-- Un appareil qui a dit oui.
--
-- **Une ligne par appareil, pas par joueur.** C'est le navigateur qui reçoit,
-- et un joueur peut vouloir être prévenu sur son téléphone sans l'être sur
-- l'ordinateur du bureau. Les deux cases (`kop`, `duel`) valent donc pour cet
-- appareil-ci, et c'est ce que la page du compte dit.
--
-- `id` est l'empreinte de l'adresse que le navigateur nous donne (SHA-256) :
-- l'adresse elle-même dépasse ce qu'une clé primaire peut tenir, et c'est
-- elle qui fait l'unicité. Un téléphone partagé qui change de compte garde sa
-- ligne et change de propriétaire, il n'en gagne pas une seconde.
--
-- Rien d'autre n'est gardé : ni l'appareil, ni le navigateur, ni l'heure de
-- la dernière notification. Le compte supprimé emporte ses appareils, et
-- c'est `deleteUser` qui les efface (`src/server/auth/store.js`) : la ligne
-- `users` n'est jamais supprimée, seulement anonymisée, si bien qu'une clé
-- étrangère en cascade ne se déclencherait jamais. Elle aurait seulement
-- empêché les suites de vider `users`.
CREATE TABLE IF NOT EXISTS notif_appareils (
  id        CHAR(64)      NOT NULL,
  user_id   CHAR(36)      NOT NULL,
  endpoint  VARCHAR(1024) NOT NULL,
  p256dh    VARCHAR(255)  NOT NULL,
  auth      VARCHAR(255)  NOT NULL,
  kop       TINYINT(1)    NOT NULL DEFAULT 1,
  duel      TINYINT(1)    NOT NULL DEFAULT 1,
  cree_le   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY k_notif_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Les deux clés qui signent nos envois (VAPID).
--
-- Une seule ligne. Elle se crée toute seule au premier démarrage qui en a
-- besoin, pour qu'il n'y ait rien à saisir dans le Manager : changer ces clés
-- plus tard rendrait muets tous les appareils inscrits, qui devraient tous
-- redire oui. `VAPID_PUBLIC_KEY` et `VAPID_PRIVATE_KEY`, si un jour on les
-- pose dans l'environnement, passent avant.
CREATE TABLE IF NOT EXISTS notif_cles (
  id        TINYINT       NOT NULL,
  publique  VARCHAR(255)  NOT NULL,
  privee    VARCHAR(255)  NOT NULL,
  cree_le   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
