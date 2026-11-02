-- Le PASS de saison (choix de Gaël du 2 novembre 2026) : il remplace
-- l'abonnement mensuel et annuel.
--
-- ## Une ligne par joueur et par saison
--
-- Le PASS s'achète une fois, pour une saison, et ne se renouvelle jamais tout
-- seul : il n'y a donc rien à résilier. Acheté pendant le dernier mois d'une
-- saison, il couvre aussi la suivante — deux lignes, posées ensemble.
--
-- Deux sortes d'avantages se lisent ici, et ils ne se lisent pas pareil :
--
--   - **ceux de la saison** (le rythme des boosters, le parcours et les
--     souvenirs complets) : la ligne de la saison en cours existe-t-elle ?
--   - **ceux de la vie** (un club suivi et un KOP de plus par PASS, la tenue,
--     le badge et le cadre de chaque saison achetée) : combien de lignes, et
--     lesquelles ?
--
-- La clé est le **numéro** de la saison et non son identifiant : c'est lui que
-- le registre des PASS (`src/shared/pass.js`) nomme, et il ne change pas quand
-- l'administration recrée une fiche de saison.
--
-- ## Jamais de puissance
--
-- Aucune ligne de cette table ne fait pousser plus fort, n'ouvre une carte, un
-- âge ou un format. Le classement est le même pour tous.
--
-- Sans clé étrangère, comme les tables récentes : un compte supprimé est
-- marqué `deleted`, jamais effacé, et aucune suite n'a à nommer cette table
-- dans ses `DROP TABLE users`.
CREATE TABLE IF NOT EXISTS user_pass (
  user_id   CHAR(36)     NOT NULL,
  saison    SMALLINT     NOT NULL,

  -- D'où il vient : 'stripe' (payé en euros), 'echarpes' (payé en écharpes),
  -- 'offert' (l'administration, ou la reprise d'un ancien abonnement).
  source    VARCHAR(16)  NOT NULL,
  -- La session Stripe, ou le prix payé en écharpes : de quoi rapprocher une
  -- ligne de son paiement sans le chercher à la main.
  reference VARCHAR(128) NULL,

  achete_le DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (user_id, saison),
  KEY idx_pass_saison (saison)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
