-- Les premiers pas : les deux choses que le parcours a besoin de savoir.
--
-- ## Pourquoi ce fichier existe
--
-- Le parcours des premiers pas ne se coche pas en cliquant « suivant ». Chaque
-- étape se coche quand le joueur l'a **réellement faite**, et le serveur le lit
-- dans ce qu'il possède déjà : un Fanzzy qui existe, un âge supérieur à 1, un
-- deck enregistré, une ligne de présence au Virage, un résultat de duel. Cinq
-- signaux sur six étaient donc déjà en base, sans rien ajouter.
--
-- Le sixième ne l'était pas : **rien ne disait qu'un booster avait été ouvert.**
-- On pouvait le deviner — compter les Fanzzy possédés et retrancher les deux du
-- paquet de bienvenue, ou regarder si la réserve avait baissé — mais les deux
-- indices mentent. La réserve se remplit toute seule, et un joueur qui ouvre un
-- booster ne tombant que sur de l'équipement ne gagne aucun Fanzzy. Une étape
-- qui refuse de se cocher alors qu'on vient de la faire est pire que pas
-- d'étape du tout : elle donne tort au joueur.
--
-- ## Deux colonnes, pas une table
--
-- Les deux appartiennent au portefeuille : ce sont des compteurs de joueur, au
-- même titre que les écharpes et les paquets. Une table « parcours » à deux
-- colonnes aurait ajouté une jointure à chaque ouverture de l'écran d'aide pour
-- ranger ce que `user_wallet` porte déjà.
--
-- À appliquer après souvenirs.sql, qui pose la table. Rejouable.

-- Combien de boosters ce joueur a ouverts, depuis toujours.
--
-- Ne décroît jamais, et ne sert à aucun calcul de jeu : c'est une trace, pas
-- une ressource. Les comptes existants partent de zéro, ce qui veut dire qu'un
-- joueur d'avant cette migration verra l'étape « ouvre un booster » décochée
-- jusqu'à son prochain paquet. C'est le choix honnête : on ne coche pas une
-- case en prétendant savoir ce qu'on n'a jamais écrit.
ALTER TABLE user_wallet
  ADD COLUMN IF NOT EXISTS packs_ouverts INT NOT NULL DEFAULT 0;

-- Le booster offert à la fin du parcours a-t-il déjà été versé ?
--
-- **Une colonne et non un calcul.** On aurait pu déduire « les six étaient
-- faites » à la lecture et verser là, mais le versement doit arriver une fois
-- et une seule : deux onglets ouverts sur l'écran d'aide, deux lectures, deux
-- paquets. Le drapeau se pose dans la même transaction que le versement, et
-- c'est lui qui rend le geste rejouable sans être répétable.
ALTER TABLE user_wallet
  ADD COLUMN IF NOT EXISTS parcours_paye TINYINT(1) NOT NULL DEFAULT 0;
