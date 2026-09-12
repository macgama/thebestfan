-- Les billets : la monnaie que l'argent réel achète, et la seule.
--
-- ## Pourquoi une colonne de plus et non une table
--
-- Les écharpes et les boosters vivent déjà dans `user_wallet`. Une table
-- séparée pour un troisième compteur obligerait à la joindre partout où la
-- bourse est lue — c'est-à-dire sur presque chaque écran — pour gagner une
-- normalisation dont personne n'a l'usage.
--
-- ## Pourquoi les billets ne sont pas des écharpes
--
-- Une écharpe se gagne en poussant, et elle achète un booster à quarante-cinq.
-- Un billet s'achète en euros, et il n'achète **que des objets nommés** : une
-- pièce d'équipement précise, une tenue précise sur un Fanzzy précis.
--
-- Les mélanger rouvrirait la porte qu'on vient de fermer : euro → écharpe →
-- booster, c'est-à-dire un coffre à contenu aléatoire payé en argent réel, ce
-- que plusieurs pays traitent comme un jeu de hasard. Deux compteurs séparés,
-- et la chaîne est coupée par construction plutôt que par vigilance.
--
-- ## INT et non SMALLINT
--
-- Le plafond d'un SMALLINT non signé est 65 535. Un joueur qui prend trois
-- fois le gros paquet le dépasse, et MySQL, selon son mode, tronque en
-- silence ou refuse l'écriture au milieu d'une livraison payée. Aucun des deux
-- ne se rattrape.

ALTER TABLE user_wallet
  ADD COLUMN IF NOT EXISTS billets INT NOT NULL DEFAULT 0 AFTER scarves;
