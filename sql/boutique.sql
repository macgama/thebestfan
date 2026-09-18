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

-- ---------------------------------------------------------------------------
-- Les billets n'existent plus : l'étal se paie en écharpes
--
-- L'argent réel n'achète que l'abonnement, et les écharpes ne se gagnent qu'en
-- jouant. La chaîne euro → tirage n'est plus coupée par une séparation qu'il
-- fallait tenir — deux compteurs, deux règles, et la vigilance de ne jamais les
-- mélanger — elle est coupée **à la racine** : il n'y a plus de monnaie
-- achetable du tout.
--
-- Les cinq prix de l'étal changent donc de préfixe, de `billets.` à `etal.`.
-- **Un renommage sans cette migration perd les ajustements faits depuis
-- /admin, en silence** : la ligne resterait en base sous l'ancienne clé, plus
-- personne ne la lirait, et le prix reviendrait à son défaut sans qu'aucun
-- écran ne le dise. C'est exactement le genre de perte qu'on ne remarque que
-- des semaines plus tard, en se demandant pourquoi un objet est moins cher.
--
-- `IGNORE` : si quelqu'un a déjà posé la nouvelle clé, on garde la sienne et on
-- jette l'ancienne. Deux valeurs pour un même prix, c'est une de trop, et la
-- plus récente est la bonne.
UPDATE IGNORE reglages SET cle = CONCAT('etal.', SUBSTRING(cle, 9))
 WHERE cle LIKE 'billets.%';
DELETE FROM reglages WHERE cle LIKE 'billets.%';

-- La colonne `user_wallet.billets` **reste**, et elle ne bouge plus.
--
-- On ne la supprime pas : elle porte ce que des joueurs ont payé en euros, et
-- effacer la trace d'un paiement est la seule chose qu'on ne puisse pas
-- reprendre. On ne la convertit pas en écharpes non plus — ce serait rouvrir la
-- chaîne euro → écharpe → booster pour ceux qui en ont, c'est-à-dire refaire
-- exactement ce qu'on vient de fermer.
--
-- Un solde restant se rembourse, par Stripe, à la personne. C'est la réponse
-- honnête, et la seule.
