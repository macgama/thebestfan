-- Les identifiants disent leur série.
--
-- Cent dix-neuf cartes portaient un préfixe étranger à leur série : `V1`
-- « Choriste » et `X23` étaient dans LA TRIBUNE sans que rien ne le dise.
-- Après cette migration, `TR32` est dans LA TRIBUNE, et on le sait sans rien
-- ouvrir.
--
-- **Aucun joueur ne perd rien.** Chaque table qui référence un identifiant est
-- mise à jour dans la même transaction : le catalogue et son champ `evo`, les
-- possessions, les tenues portées, le Fanzzy équipé, les souvenirs, et le JSON
-- des decks.
--
-- ## La table de correspondance, plutôt que mille instructions
--
-- Un premier jet écrivait huit `UPDATE` par carte, soit neuf cent
-- cinquante-deux lignes qu'aucun humain ne relit. Une table temporaire les
-- ramène à une par table : la correspondance se lit d'un bloc, et chaque
-- jointure dit exactement ce qu'elle touche. C'est le même motif que
-- `sql/stades.sql`.
--
-- ## Elle se rejoue sans dommage
--
-- Le catalogue vit en base et s'amorce en `INSERT IGNORE` au démarrage. Un
-- serveur qui a démarré avec le code neuf **avant** cette migration a donc deux
-- lignes pour la même carte : l'ancienne, que les joueurs possèdent, et la
-- neuve, que l'amorçage vient d'écrire. Un renommage direct se heurterait à la
-- clé primaire et s'arrêterait au milieu.
--
-- D'où le `DELETE` qui ouvre la marche : il retire du **catalogue** la ligne
-- neuve quand l'ancienne existe encore — les deux décrivent la même carte — et
-- laisse le renommage se faire. Aucune table de joueur n'est jamais supprimée,
-- et une seconde exécution ne trouve plus rien à faire.
--
-- ## Ce fichier ne se régénère plus
--
-- Il a été écrit par scripts/fanzzy-prefixes-appliquer.mjs, puis **repris à la
-- main** : la table de correspondance, la fusion des doublons et les trois
-- suppressions en deux temps n'existent pas dans le générateur, qui en est
-- resté à huit UPDATE par carte. Le relancer écraserait tout cela par une
-- version plus fragile. Le plan des identifiants, lui, reste celui du
-- catalogue — c'est la liste ci-dessous, et elle ne bouge plus.

START TRANSACTION;

DROP TEMPORARY TABLE IF EXISTS tmp_prefixes;
CREATE TEMPORARY TABLE tmp_prefixes (
  ancien VARCHAR(12) NOT NULL,
  neuf   VARCHAR(12) NOT NULL,
  PRIMARY KEY (ancien),
  UNIQUE KEY u_neuf (neuf)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO tmp_prefixes (ancien, neuf) VALUES
  ('X15', 'BG28'),          -- Le Loup du Virage
  ('X9', 'GC15'),           -- Le Marchand de Saucisses
  ('X10', 'GC16'),          -- La Patronne du Bar
  ('X34', 'GC17'),          -- Le Ramasseur de Gobelets
  ('X4', 'GD10'),           -- Parcage 400 places
  ('X5', 'GD11'),           -- La Nuit du 8e
  ('X31', 'GD12'),          -- Le Supporter en Orbite
  ('X36', 'GD13'),          -- Le Vendeur d’Écharpes
  ('X57', 'GD14'),          -- Le Douanier du Car 3
  ('X58', 'GD15'),          -- La Mosaïque de Séville
  ('X59', 'GD16'),          -- Le Dernier Train
  ('X40', 'HC15'),          -- La Radio Locale
  ('X40B', 'HC15B'),        -- La Radio du Virage
  ('X40C', 'HC15C'),        -- La Voix du Samedi
  ('X43', 'HC16'),          -- La Streameuse
  ('X16', 'IM1'),           -- La Plante du Grillage
  ('X30', 'IM10'),          -- Le Drapeau Perdu
  ('X30B', 'IM10B'),        -- Le Drapeau Adopté
  ('X30C', 'IM10C'),        -- Le Drapeau du Virage
  ('X32', 'IM11'),          -- Le Marteau-Piqueur
  ('X32B', 'IM11B'),        -- Le Chantier au Rythme
  ('X32C', 'IM11C'),        -- La Grue Qui Salue
  ('X33', 'IM12'),          -- Le Nain de Jardin
  ('X38', 'IM13'),          -- Le Capybara Serein
  ('X44', 'IM14'),          -- Le Pigeon à la Frite
  ('X45', 'IM15'),          -- Le Téléviseur
  ('X50', 'IM16'),          -- La Pieuvre à Lunettes
  ('X51', 'IM17'),          -- Le Touriste d’Ailleurs
  ('X60', 'IM18'),          -- Le But Refusé Trois Fois
  ('X61', 'IM19'),          -- La Minute 97
  ('X18', 'IM2'),           -- Le Fantôme de la Tribune Sud
  ('X62', 'IM20'),          -- Le Gardien qui Monte
  ('X63', 'IM21'),          -- Le Virage à Sept
  ('X64', 'IM22'),          -- La Remontada de Nulle Part
  ('X19', 'IM3'),           -- Le Comte du Parcage
  ('X21', 'IM4'),           -- Le Gladiateur en Mousse
  ('X23', 'IM5'),           -- Le Caméléon en Smoking
  ('X24', 'IM6'),           -- La Chouette Statisticienne
  ('X25', 'IM7'),           -- Le Héros Fatigué
  ('X28', 'IM8'),           -- La Faucheuse au Pop-corn
  ('X29', 'IM9'),           -- Le Poulet en Caoutchouc
  ('X37', 'MS19'),          -- Le Juge de Touche
  ('P1', 'MS30'),           -- Gamin au tambour
  ('P2', 'MS30B'),          -- Tambour Major
  ('P3', 'MS30C'),          -- Grosse Caisse Sud
  ('T1', 'MS31'),           -- Colleur d’affiches
  ('T2', 'MS31B'),          -- Bâcheur Nocturne
  ('T3', 'MS31C'),          -- Chef Tifo
  ('D1', 'MS32'),           -- Auto-stoppeur
  ('D2', 'MS32B'),          -- Conducteur de car
  ('D3', 'MS32C'),          -- Convoi 4h du Mat
  ('X14', 'MS33'),          -- Le Siffleur des Souterrains
  ('X14B', 'MS33B'),        -- Le Siffleur Entendu
  ('X14C', 'MS33C'),        -- Le Souterrain
  ('X42', 'MS5'),           -- La Stadière
  ('X2', 'MT14'),           -- Écharpes au Vent
  ('X2B', 'MT14B'),         -- Écharpes Nouées
  ('X2C', 'MT14C'),         -- La Voûte
  ('X35', 'TR18'),          -- Le Mégaphone
  ('X26', 'TR19'),          -- Le Tambour de Guerre
  ('V1', 'TR32'),           -- Choriste
  ('V2', 'TR32B'),          -- Meneur de chant
  ('V3', 'TR32C'),          -- Capo di Curva
  ('F1', 'TR33'),           -- Abonné
  ('F2', 'TR33B'),          -- Vieille Garde
  ('F3', 'TR33C'),          -- Doyen du Bloc C
  ('Y1', 'TR34'),           -- Porte-torche
  ('Y2', 'TR34B'),          -- Fumigène
  ('Y3', 'TR34C'),          -- Craqueur
  ('X1', 'TR35'),           -- Le Douzième Homme
  ('X1B', 'TR35B'),         -- Le Lanceur de Ola
  ('X1C', 'TR35C'),         -- Le Douzième
  ('X3', 'TR36'),           -- Mosaïque Populaire
  ('X3B', 'TR36B'),         -- Mosaïque à Deux Tribunes
  ('X3C', 'TR36C'),         -- La Mosaïque
  ('G1', 'TR37'),           -- Le Faux Départ
  ('G2', 'TR37B'),          -- Le Bon Moment
  ('G3', 'TR37C'),          -- Le Silence d’Avant
  ('X6', 'TR38'),           -- Section Cendrée
  ('X6B', 'TR38B'),         -- Section Debout
  ('X6C', 'TR38C'),         -- La Section
  ('X7', 'TR39'),           -- Celui Qui Reste
  ('X7B', 'TR39B'),         -- Le Dernier à Sortir
  ('X7C', 'TR39C'),         -- Le Gardien des Clés
  ('X8', 'TR40'),           -- La Mascotte du Dimanche
  ('X8B', 'TR40B'),         -- La Mascotte du Samedi
  ('X8C', 'TR40C'),         -- Le Costume Transmis
  ('X11', 'TR41'),          -- La Trompette du Dimanche
  ('X12', 'TR42'),          -- La Voyante du Virage
  ('X17', 'TR43'),          -- Le Gosse à la Coupe
  ('X20', 'TR44'),          -- Premier Match
  ('X20B', 'TR44B'),        -- Le Deuxième Match
  ('X20C', 'TR44C'),        -- Celui Qui Explique
  ('X27', 'TR46'),          -- Le Mime du Virage
  ('X39', 'TR48'),          -- Le Carré à l’Envers
  ('X39B', 'TR48B'),        -- Le Carré Retourné
  ('X39C', 'TR48C'),        -- Celui Qui Distribue
  ('X41', 'TR49'),          -- L’Homme dans la Mascotte
  ('X41B', 'TR49B'),        -- L’Homme Sans le Costume
  ('X41C', 'TR49C'),        -- Le Visage
  ('X47', 'TR50'),          -- Le Bob du Dimanche
  ('X47B', 'TR50B'),        -- Le Bob Usé
  ('X47C', 'TR50C'),        -- Le Bob du Musée
  ('X48', 'TR51'),          -- La Note Qui Casse
  ('X48B', 'TR51B'),        -- La Note Placée
  ('X48C', 'TR51C'),        -- La Fausse Note Officielle
  ('X49', 'TR52'),          -- Le Râleur du Rang B
  ('X49B', 'TR52B'),        -- Le Râleur Abonné
  ('X49C', 'TR52C'),        -- La Mauvaise Foi
  ('X22', 'TR53'),          -- Le Craqueur de la Nuit
  ('X46', 'TR54'),          -- Le Peint des Pieds à la Tête
  ('X52', 'TR55'),          -- Le Capo Historique
  ('X53', 'TR56'),          -- La Bâche de 89
  ('X54', 'TR57'),          -- Le Tambour Fêlé
  ('X55', 'TR58'),          -- Le Muret du Fond
  ('X56', 'TR59'),          -- La Torche de Minuit
  ('X13', 'VP15'),          -- L’Agent en Tribune d’Honneur
  ('X13B', 'VP15B'),        -- L’Agent Qui Connaît Tout le Monde
  ('X13C', 'VP15C');        -- Le Carnet d’Adresses

-- Le catalogue. `evo` pointe sur `id` : on désarme le temps de l'opération,
-- sans quoi chaque ligne renommée casse la référence de la précédente.
SET @@session.foreign_key_checks = 0;

-- La ligne neuve écrite par un amorçage prématuré s'efface au profit de
-- l'ancienne, qui porte les possessions. Voir l'en-tête.
--
-- **Le repérage passe par une table, pas par un sous-`SELECT`.** MySQL et
-- MariaDB refusent, selon la version, qu'un `DELETE` lise la table qu'il vide :
--
--     Table 'f' is specified twice, both as a target for 'DELETE'
--     and as a separate source for data
--
-- Le serveur de production l'a refusé là où la machine de développement
-- l'acceptait, et la migration s'est arrêtée là. Une **lecture** ordinaire n'a
-- pas cette limite, et un `DELETE` qui ne lit plus qu'une table temporaire non
-- plus : les deux temps séparés passent partout. Les trois suppressions de ce
-- fichier suivent le même motif, pour la même raison.
DROP TEMPORARY TABLE IF EXISTS tmp_doubles;
CREATE TEMPORARY TABLE tmp_doubles (
  id VARCHAR(12) NOT NULL PRIMARY KEY
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO tmp_doubles (id)
  SELECT m.neuf
    FROM tmp_prefixes m
    JOIN fanzzy n ON n.id = m.neuf
    JOIN fanzzy o ON o.id = m.ancien;

DELETE f FROM fanzzy f JOIN tmp_doubles d ON d.id = f.id;

UPDATE fanzzy f JOIN tmp_prefixes m ON m.ancien = f.id  SET f.id  = m.neuf;
UPDATE fanzzy f JOIN tmp_prefixes m ON m.ancien = f.evo SET f.evo = m.neuf;

-- Ce que les joueurs possèdent.
--
-- Un compte peut détenir **les deux** identifiants de la même carte : cela
-- n'arrive que sur une base qui a déjà tourné avec le code neuf, où la version
-- renommée a pu être tirée. Renommer l'ancienne se heurterait alors à la clé
-- primaire et abandonnerait la migration au milieu.
--
-- On fusionne donc d'abord : les exemplaires s'additionnent, le stade le plus
-- haut l'emporte. Perdre un doublon serait discret et définitif — c'est
-- exactement le genre de perte qu'un joueur ne signale jamais parce qu'il ne
-- la voit pas.
UPDATE user_fanzzy n
  JOIN tmp_prefixes m ON m.neuf = n.fanzzy_id
  JOIN user_fanzzy o ON o.user_id = n.user_id AND o.fanzzy_id = m.ancien
   SET o.copies = o.copies + n.copies,
       o.stage  = GREATEST(o.stage, n.stage);
-- Même motif qu'au catalogue : on repère d'abord, on supprime ensuite. Le
-- repérage doit venir **après** la fusion ci-dessus, sinon on effacerait des
-- exemplaires qui n'ont pas encore été reversés.
DROP TEMPORARY TABLE IF EXISTS tmp_doubles_u;
CREATE TEMPORARY TABLE tmp_doubles_u (
  user_id   CHAR(36)    NOT NULL,
  fanzzy_id VARCHAR(12) NOT NULL,
  PRIMARY KEY (user_id, fanzzy_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO tmp_doubles_u (user_id, fanzzy_id)
  SELECT n.user_id, n.fanzzy_id
    FROM user_fanzzy n
    JOIN tmp_prefixes m ON m.neuf = n.fanzzy_id
    JOIN user_fanzzy o ON o.user_id = n.user_id AND o.fanzzy_id = m.ancien;

DELETE n FROM user_fanzzy n
  JOIN tmp_doubles_u d ON d.user_id = n.user_id AND d.fanzzy_id = n.fanzzy_id;

UPDATE user_fanzzy u JOIN tmp_prefixes m ON m.ancien = u.fanzzy_id
   SET u.fanzzy_id = m.neuf;

-- Les tenues : une tenue possédée deux fois reste une tenue possédée. Rien à
-- additionner, on retire la ligne neuve. Le repérage est plus fin ici — une
-- tenue n'est un doublon que pour le **même âge et la même tenue**.
DROP TEMPORARY TABLE IF EXISTS tmp_doubles_s;
CREATE TEMPORARY TABLE tmp_doubles_s (
  user_id   CHAR(36)    NOT NULL,
  fanzzy_id VARCHAR(12) NOT NULL,
  stage     TINYINT     NOT NULL,
  skin_id   VARCHAR(24) NOT NULL,
  PRIMARY KEY (user_id, fanzzy_id, stage, skin_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO tmp_doubles_s (user_id, fanzzy_id, stage, skin_id)
  SELECT n.user_id, n.fanzzy_id, n.stage, n.skin_id
    FROM user_skins n
    JOIN tmp_prefixes m ON m.neuf = n.fanzzy_id
    JOIN user_skins o ON o.user_id = n.user_id AND o.fanzzy_id = m.ancien
                     AND o.stage = n.stage AND o.skin_id = n.skin_id;

DELETE n FROM user_skins n
  JOIN tmp_doubles_s d ON d.user_id = n.user_id AND d.fanzzy_id = n.fanzzy_id
                      AND d.stage = n.stage AND d.skin_id = n.skin_id;
UPDATE user_skins s JOIN tmp_prefixes m ON m.ancien = s.fanzzy_id
   SET s.fanzzy_id = m.neuf;
UPDATE user_wallet w JOIN tmp_prefixes m ON m.ancien = w.active_fanzzy
   SET w.active_fanzzy = m.neuf;

-- Les souvenirs gardent le Fanzzy porté à l'instant du but. La colonne vient
-- de `sql/souvenirs.sql` ; une base plus ancienne ne l'a pas, et la migration
-- ne doit pas s'arrêter pour ça — c'est une trace, pas une possession.
SET @sql = IF((SELECT COUNT(*) FROM information_schema.columns
                WHERE table_schema = DATABASE()
                  AND table_name = 'souvenirs' AND column_name = 'fanzzy_id') > 0,
  'UPDATE souvenirs s JOIN tmp_prefixes m ON m.ancien = s.fanzzy_id
      SET s.fanzzy_id = m.neuf',
  'DO 0');
PREPARE p FROM @sql; EXECUTE p; DEALLOCATE PREPARE p;

-- Le deck est un document JSON : les identifiants y sont des valeurs de
-- chaîne. On remplace **avec leurs guillemets** — dans {"id":"X1"} on cherche
-- `"X1"`. Sans eux, `"X13"` deviendrait `"VP15"3"`, et la règle de `X13`
-- mordrait sur `X13B`, qui est une autre carte.
--
-- **Un seul passage ne suffisait pas.** `UPDATE … JOIN` n'applique qu'une
-- affectation par ligne visée : un deck portant deux cartes renommées n'en
-- voyait qu'une corrigée, l'autre gardait son ancien identifiant, et rien ne
-- le signalait puisque le document restait un JSON valide. Le joueur aurait
-- découvert un emplacement vide dans son deck, des semaines plus tard, sans
-- que personne puisse relier les deux.
--
-- On construit donc **un seul REPLACE imbriqué** qui les traite toutes en une
-- fois. Le texte est assemblé depuis la table de correspondance plutôt
-- qu'écrit ici : cent dix-neuf appels imbriqués à la main ne se relisent pas,
-- et une liste écrite deux fois finit par diverger.
SET SESSION group_concat_max_len = 1048576;

SET @remplacements = (
  SELECT CONCAT(REPEAT('REPLACE(', COUNT(*)), 'contenu',
                GROUP_CONCAT(CONCAT(',''"', ancien, '"'',''"', neuf, '"'')')
                             ORDER BY ancien SEPARATOR ''))
    FROM tmp_prefixes);

SET @sql = IF((SELECT COUNT(*) FROM information_schema.tables
                WHERE table_schema = DATABASE() AND table_name = 'user_decks') > 0,
  CONCAT('UPDATE user_decks SET contenu = ', @remplacements),
  'DO 0');
PREPARE p FROM @sql; EXECUTE p; DEALLOCATE PREPARE p;

SET @@session.foreign_key_checks = 1;
DROP TEMPORARY TABLE IF EXISTS tmp_doubles, tmp_doubles_u, tmp_doubles_s;
DROP TEMPORARY TABLE tmp_prefixes;
COMMIT;
