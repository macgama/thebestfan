-- thebestfan — la collection de stades.
--
-- ## Ce que ce fichier pose
--
-- Les stades se collectionnent (`src/shared/stades.js`) : ils sortent des
-- boosters, se rangent dans la collection, et l'un d'eux peut servir de décor
-- à l'accueil. Ils **ne décident pas où l'on joue** : le stade appartient au
-- match, au Virage comme au duel, et posséder un lieu n'y donne aucun
-- avantage. Le Chaudron, stade de départ, est à tout le monde et ne s'écrit
-- nulle part.
--
-- `user_stades` retient ce qu'un joueur a tiré ; `user_wallet.stade_accueil`
-- le décor choisi pour son accueil (NULL : l'image d'accueil habituelle).
--
-- ## Pourquoi aucune clé étrangère vers users
--
-- Pour la raison que donne sql/quotidien.sql : chaque suite de test vide la
-- base avec sa propre liste, et une table fille de `users` absente d'une de
-- ces listes fait échouer le DROP de `users`, donc la suite entière. La
-- cascade ne servirait pas : un compte supprimé est anonymisé, jamais effacé
-- (`auth/store.js`, `deleteUser`), et sa collection reste attachée à un
-- identifiant que plus rien ne relie à personne, comme `user_stuff`.
--
-- ## Pourquoi il vient en dernier
--
-- Une table clée sur `users.public_id` (auth.sql) et une colonne sur
-- `user_wallet` (souvenirs.sql). Rien ne dépend de lui.
--
-- ## Additif et rejouable
--
-- Une table neuve et une colonne nulle : le code d'avant n'en lit aucune.
-- Sans ce fichier, rien ne casse : le booster ne tire pas de stade, la
-- collection montre le Chaudron seul, l'accueil garde son image.

CREATE TABLE IF NOT EXISTS user_stades (
  user_id  CHAR(36)    NOT NULL,
  stade_id VARCHAR(24) NOT NULL,
  copies   SMALLINT    NOT NULL DEFAULT 1,
  got_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, stade_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Le stade en décor de l'accueil. Une colonne par instruction (voir arenes.sql).
ALTER TABLE user_wallet ADD COLUMN IF NOT EXISTS stade_accueil VARCHAR(24) NULL;
