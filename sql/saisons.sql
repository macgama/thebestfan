-- Les saisons : ce qui ouvre le contenu du jeu.
--
-- ## Pourquoi cette table existe
--
-- Les séries s'ouvraient **au niveau du joueur** : LA TRIBUNE au niveau 1, LES
-- MÉTIERS DU STADE au 3, et ainsi de suite jusqu'au 26. C'était une progression
-- solitaire — chacun découvrait le jeu à son rythme, seul, et le jour où une
-- série arrivait n'existait pour personne d'autre.
--
-- Une saison fait l'inverse : elle ouvre **pour tout le monde en même temps**.
-- C'est ce qui permet de relancer le jeu, d'annoncer quelque chose, et que deux
-- joueurs qui se parlent parlent de la même chose le même jour.
--
-- ## Ce qu'une saison ouvre vraiment
--
-- Les **séries** et les **tenues** : les deux seuls contenus du jeu qui aient
-- un état de publication. Le lancement ouvre les unes et publie les autres.
--
-- Les pièces d'équipement et les cartes d'action sont du code, pas de la base :
-- une saison peut les **annoncer** — c'est à cela que servent `stuff` et
-- `actions` — mais elle ne les retient pas, parce que rien ne sait les retenir.
-- Le jour où ils vivront en base comme le catalogue, ces deux colonnes
-- deviendront des leviers sans changer de forme.
--
-- ## Additif, jamais soustractif
--
-- Ce qu'une saison ouvre reste ouvert. Une saison 4 n'annule pas la 3 : les
-- séries ouvertes sont **l'union** de toutes les saisons lancées. Un
-- collectionneur qui a commencé LES REVENANTS doit pouvoir les finir.
--
-- Fermer une série reste possible, et se fait dans l'autre sens : on retire la
-- saison de la liste des lancées. C'est rare et c'est délibérément malcommode.

CREATE TABLE IF NOT EXISTS saisons (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  -- Le numéro affiché. Il n'est pas la clé : on peut vouloir une « saison 0 »
  -- d'archive, ou renuméroter sans casser les références.
  numero     SMALLINT     NOT NULL,
  nom        VARCHAR(64)  NOT NULL,
  -- L'annonce faite aux joueurs. C'est elle qui fait la saison : une ouverture
  -- de contenu que personne n'annonce est une mise à jour, pas un événement.
  texte      VARCHAR(500)     NULL,
  series     JSON             NULL,
  tenues     JSON             NULL,
  -- Annoncés, pas retenus. Voir l'en-tête.
  stuff      JSON             NULL,
  actions    JSON             NULL,
  -- `NULL` : brouillon. On prépare une saison sans que rien ne change pour
  -- personne, et on la lance quand on veut.
  lancee_a   DATETIME(3)      NULL,
  cree_a     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  maj_a      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                              ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY k_saisons_lancee (lancee_a)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Quelle saison ce joueur a déjà vue annoncée.
--
-- Sans elle, l'annonce reviendrait à chaque ouverture du kiosque, pour
-- toujours. Une annonce qu'on ne peut pas faire taire est une annonce qu'on
-- apprend à ne plus lire — et la suivante ne sera pas lue non plus.
ALTER TABLE user_wallet
  ADD COLUMN IF NOT EXISTS saison_vue INT UNSIGNED NULL;

-- La saison 1, faite de ce que l'installation ouvrait déjà.
--
-- **Sans elle, une base existante se retrouverait sans aucune série ouverte**
-- le jour du déploiement : l'union des saisons lancées serait vide, et le
-- kiosque n'aurait plus rien à distribuer. C'est la seule reprise de données de
-- ce fichier, et elle ne s'exécute qu'une fois.
--
-- Ses séries : celles que `reglages.series_actives` nommait, ou **toutes**
-- quand ce réglage était absent — c'est exactement ce que le jeu faisait, une
-- liste vide ou absente valant « aucune restriction ».
INSERT INTO saisons (numero, nom, texte, series, tenues, lancee_a)
SELECT 1, 'Le premier virage',
       'Tout ce qui existait avant que les saisons existent.',
       COALESCE((SELECT valeur FROM reglages WHERE cle = 'series_actives'), JSON_ARRAY()),
       JSON_ARRAY(),
       NOW(3)
 WHERE NOT EXISTS (SELECT 1 FROM saisons);
