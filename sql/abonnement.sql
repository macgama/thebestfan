-- L'abonnement : ce qui distingue un joueur inscrit d'un joueur abonné.
--
-- ## Ce qu'il ouvre, et ce qu'il n'ouvre pas
--
-- **Il vend de la largeur et du confort, jamais de la puissance.** C'est la
-- règle, et elle vient de deux autres déjà écrites dans le jeu : « l'écart se
-- creuse par ce qu'on joue, pas par ce qu'on a payé » (`deck/index.js`), et
-- « le niveau ne donne aucune puissance ; s'il en avait, l'ancienneté
-- deviendrait de la force » (`shared/niveau.js`). Un abonnement qui donnerait
-- un avantage sur la corde ferait à l'argent ce que ces deux règles refusent au
-- temps, et le classement se mettrait à mesurer la carte bancaire.
--
-- Tous les formats de duel, tous les âges, tous les classements restent donc
-- ouverts à tout le monde. Ce qui s'achète est le rythme, l'identité, la
-- mémoire et le confort.
--
-- ## Une ligne par joueur, et non une par période
--
-- On pourrait garder l'historique des renouvellements ici. Il vit déjà dans
-- `achats`, qui est en ajout seul et porte les montants : une seconde histoire
-- se contredirait avec la première le jour d'un remboursement. Cette table ne
-- répond qu'à une question — « est-il abonné en ce moment, et jusqu'à quand » —
-- et un renouvellement pousse simplement `fin` plus loin.
--
-- `fin` nul veut dire **sans terme** : c'est ce que pose un administrateur pour
-- un bêta-testeur ou un compte de démonstration. Rien ne l'expire, et c'est
-- voulu : un accès offert qui s'éteint sans prévenir se lit comme une panne.
CREATE TABLE IF NOT EXISTS abonnements (
  -- Le `public_id` du joueur, comme partout ailleurs dans le schéma.
  user_id   CHAR(36)     NOT NULL PRIMARY KEY,

  -- 'mensuel', 'annuel', 'offert'. Du texte et non une énumération : une
  -- formule qui disparaît de la vente doit rester lisible dans les lignes
  -- passées, et un ENUM obligerait à migrer la table pour en ajouter une.
  formule   VARCHAR(16)  NOT NULL,

  debut     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  -- Nul = sans terme. Voir plus haut.
  fin       DATETIME(3)  NULL,

  -- D'où il vient : 'stripe' ou 'admin'. Le second est journalisé dans
  -- `admin_audit` comme toute écriture d'administration.
  source    VARCHAR(16)  NOT NULL DEFAULT 'admin',
  -- L'identifiant de l'abonnement chez le prestataire, pour rapprocher une
  -- ligne d'un paiement sans le chercher à la main.
  reference VARCHAR(128) NULL,

  maj       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
              ON UPDATE CURRENT_TIMESTAMP(3),

  -- L'écran d'administration liste « qui est abonné » et « qui arrive à
  -- échéance » : les deux passent par cette colonne.
  KEY idx_fin (fin),
  CONSTRAINT fk_abo_user FOREIGN KEY (user_id) REFERENCES users(public_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Pourquoi on part : la question facultative posée **après** la résiliation.
--
-- Elle ne retarde jamais la résiliation (la loi française le veut : résilier
-- en ligne aussi simplement qu'on s'est abonné), et la réponse est
-- **anonyme** : ni joueur, ni adresse. On veut savoir pourquoi les gens
-- partent, pas qui ; une ligne sans personne dedans n'a rien à effacer le
-- jour où un compte est supprimé, et aucune suite n'a à la nommer dans ses
-- `DROP TABLE users` (pas de clé étrangère).
CREATE TABLE IF NOT EXISTS abonnement_departs (
  id       INT UNSIGNED  NOT NULL AUTO_INCREMENT PRIMARY KEY,
  -- Une des raisons de `RAISONS_DEPART` (abonnement/index.js).
  raison   VARCHAR(16)   NOT NULL,
  -- Le champ libre, facultatif.
  texte    VARCHAR(500)  NULL,
  -- La formule quittée : un départ du mensuel ne se lit pas comme un départ
  -- de l'annuel.
  formule  VARCHAR(16)   NULL,
  cree     DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_cree (cree)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
