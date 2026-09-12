-- La boutique : ce qui a été acheté, et ce qui a été livré.
--
-- ## Une ligne par intention d'achat, pas par livraison
--
-- La ligne naît quand le joueur clique, avant même de payer, et change d'état
-- ensuite. C'est ce qui permet de répondre « où est ma commande » à quelqu'un
-- dont le paiement a échoué, au lieu de n'avoir aucune trace de sa tentative.
--
-- ## `stripe_session` est UNIQUE, et c'est la pièce maîtresse
--
-- Stripe **rejoue ses webhooks**. Le même paiement arrive deux, cinq, dix
-- fois — c'est écrit dans sa documentation, ce n'est pas une panne. Sans une
-- contrainte d'unicité en base, un rejeu livre le booster une seconde fois, et
-- l'on ne s'en aperçoit qu'en lisant les réclamations de ceux à qui il a
-- manqué. La contrainte est ici, dans la base, et non dans le code : c'est le
-- seul endroit que deux processus concurrents ne peuvent pas contourner.
--
-- ## Le prix est copié dans la ligne
--
-- Et non lu dans le catalogue au moment de servir. Un prix change ; une
-- commande ne change pas. Sans cette copie, une baisse de tarif réécrirait
-- l'historique comptable de tout le monde.

CREATE TABLE IF NOT EXISTS achats (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  -- Le **public_id** du joueur, comme partout ailleurs dans le jeu — et non
  -- la clé numérique de users. Tout le reste du schéma est accroché à
  -- public_id ; une table qui s accrocherait ailleurs se joindrait mal à
  -- toutes les autres, et il faudrait s en souvenir à chaque requête.
  user_id        CHAR(36)        NOT NULL,

  -- L'identifiant de l'article dans `CATALOGUE`. On garde le texte et non une
  -- clé étrangère : le catalogue est du code, pas une table, et un article
  -- retiré de la vente doit rester lisible dans les commandes passées.
  article        VARCHAR(48)     NOT NULL,
  -- En centimes, et dans la devise de la commande. Jamais en flottant : un
  -- prix en euros stocké en DOUBLE finit par valoir 4,989999999999999.
  montant        INT UNSIGNED    NOT NULL,
  devise         CHAR(3)         NOT NULL DEFAULT 'eur',

  -- `en_attente` → `paye` → `livre`, ou `abandonne`. L'état n'est jamais
  -- deviné depuis une autre colonne : il est écrit à chaque passage.
  etat           ENUM('en_attente','paye','livre','abandonne')
                 NOT NULL DEFAULT 'en_attente',

  stripe_session VARCHAR(255)    NOT NULL,
  -- Ce qui a réellement été remis. Un booster tiré, des écharpes créditées :
  -- sans cette trace, on ne peut pas répondre « qu'est-ce que j'ai eu ».
  livraison      JSON            NULL,

  cree_le        DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  paye_le        DATETIME(3)     NULL,
  livre_le       DATETIME(3)     NULL,

  PRIMARY KEY (id),
  UNIQUE KEY uq_session (stripe_session),
  KEY ix_user (user_id, cree_le),
  CONSTRAINT fk_achats_user FOREIGN KEY (user_id)
    REFERENCES users(public_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
