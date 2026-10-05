-- thebestfan — les arènes : le bilan de tribune et la présence (vague 2, lot 6).
--
-- ## Ce que ce fichier pose
--
-- Le bilan de tribune du Virage (`serveur/CONTRATS.md`, § 15) dit à chacun ce
-- que son geste a donné pendant un match : ses PARFAITS, sa meilleure série,
-- son meilleur chant. Ces trois choses se comptent **dans l'upsert de présence
-- qui existe** (`recordPush`, `src/server/souvenirs/index.js`) : une poussée
-- reste une seule instruction (P8), et le bilan les lit dans la base, jamais
-- dans la salle en mémoire — un membre qui se déconnecte y perd son compte,
-- la ligne de présence garde tout le match.
--
-- Et la préférence de présence d'un joueur (`CONTRATS.md`, § 18) : visible de
-- ses amis ou caché. La présence elle-même n'est **jamais** écrite ; seul le
-- choix de se cacher l'est.
--
-- ## Pourquoi il vient en dernier
--
-- Il ajoute des colonnes à `virage_presence` et à `user_wallet`, que pose
-- souvenirs.sql, et il prolonge l'upsert des chants que quotidien.sql a
-- élargi : il vient donc après les deux. Rien ne dépend de lui, et le dernier
-- rang est celui qui ne peut gêner personne (`scripts/ordre-schema.mjs`).
--
-- ## Additif et rejouable
--
-- Des colonnes nulles ou avec un défaut, un index, rien de renommé, aucune
-- reprise de données : le code d'avant ne lit aucune de ces colonnes et tourne
-- pareil avant et après. Les lignes de présence déjà écrites partent à zéro
-- PARFAIT et sans meilleur chant — on n'invente pas ce qui n'a jamais été
-- compté. Le rejouer sur une base à jour ne fait rien.
--
-- Sans lui, rien ne casse : les poussées retombent sur la forme du quotidien
-- (les chants et les missions continuent), le bilan sert la ferveur, les
-- chants et le rang, et le démarrage nomme ce fichier. La présence reste
-- éteinte, même allumée dans /admin : sans la colonne du choix, personne ne
-- pourrait s'y cacher (CONTRATS.md, § 18.2).
--
-- ## Une colonne par instruction, et une instruction par ligne
--
-- Le contrôle de démarrage (`src/server/auth/schema.js`) ne lit que le premier
-- ADD COLUMN d'une instruction : un second, oublié en production, ne se
-- verrait nulle part. Et les suites du Virage prennent ces instructions ligne
-- à ligne, au motif, pour poser ou retirer une colonne sans le reste du
-- fichier. `schema-smoke` vérifie les deux.

-- Les PARFAITS du match : chants au verdict « parfait » (src/shared/verdict.js).
ALTER TABLE virage_presence ADD COLUMN IF NOT EXISTS parfaits INT UNSIGNED NOT NULL DEFAULT 0;
-- La meilleure série de PARFAIT d'affilée du match. La série en cours vit en
-- mémoire, sur le membre ; seule la meilleure s'écrit, par GREATEST.
ALTER TABLE virage_presence ADD COLUMN IF NOT EXISTS serie_max SMALLINT UNSIGNED NOT NULL DEFAULT 0;
-- La meilleure note du match, en millièmes de la note que mesure le verdict
-- (la note brute du geste, relevée par le plancher, avant les modificateurs
-- du Fanzzy) : de 0 à 1200, certains gestes notant jusqu'à 1,2. Et le chant
-- qui l'a donnée. Dans l'upsert, **le chant s'écrit avant la note** : un ON
-- DUPLICATE KEY UPDATE s'évalue de gauche à droite, et la note écrite d'abord,
-- le chant comparerait la nouvelle note à elle-même et ne changerait plus
-- jamais après le premier (SERVEUR-VAGUE2.md, règle 15).
ALTER TABLE virage_presence ADD COLUMN IF NOT EXISTS meilleur_q SMALLINT UNSIGNED NOT NULL DEFAULT 0;
ALTER TABLE virage_presence ADD COLUMN IF NOT EXISTS meilleur_chant VARCHAR(24) NULL;

-- Le rang dans sa tribune, au bilan : un COUNT sur la plage (match, camp,
-- ferveur), et la lecture groupée d'une salle entière au coup de sifflet (P5).
-- Le contrôle de démarrage ne le voit pas, et c'est voulu : un index absent
-- coûte du temps, pas une donnée. `schema-smoke` le cherche dans
-- information_schema.statistics.
CREATE INDEX IF NOT EXISTS idx_bilan ON virage_presence (fixture_id, side, ferveur);

-- La présence : visible de ses amis (1) ou cachée (0). NULL veut dire « le
-- défaut du registre » (presence.visible_defaut) : Gaël tranche le défaut
-- depuis /admin, sans migration, et un joueur qui a choisi garde son choix.
-- La suppression d'un compte la remet à NULL (src/server/auth/store.js).
ALTER TABLE user_wallet ADD COLUMN IF NOT EXISTS presence TINYINT(1) NULL;
