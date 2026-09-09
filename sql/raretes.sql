-- thebestfan — passage à quatre raretés, et alignement du catalogue.
-- À appliquer après fanzzy.sql, sur une base qui tourne déjà.
--
-- L'échelle avait cinq crans — d1, d2, d3, star, crown — et elle disait deux
-- choses à la fois : la force d'un personnage et sa rareté au tirage. Elle en
-- dit désormais une seule : **la rareté suit le stade d'évolution.** Stade 1
-- commun, stade 2 rare, stade 3 épique. La légendaire est hors échelle : elle
-- ne s'obtient pas en faisant évoluer, et les cartes qui la portent n'ont pas
-- de lignée.
--
-- Ce fichier existe parce que l'amorçage depuis dex.js écrit en INSERT IGNORE :
-- il crée les cartes absentes et ne touche jamais aux existantes. Sans lui, une
-- base déjà remplie garderait son ancien état pendant que le code attendrait le
-- nouveau — et un catalogue à moitié converti ne se voit pas, il tire juste de
-- travers.
--
-- Il est écrit pour être rejouable : chaque étape ne fait quelque chose que si
-- elle a encore quelque chose à faire.

-- 1. La colonne d'abord.
--
-- « legendaire » fait dix caractères et la colonne en tenait huit. Sous MySQL
-- non strict, l'écriture n'échoue pas : elle tronque, et la carte se retrouve
-- avec une rareté « legendai » que plus rien ne reconnaît — ni le tirage, ni
-- l'affichage, ni l'administration. Élargir AVANT de convertir.
ALTER TABLE fanzzy MODIFY COLUMN rar VARCHAR(16) NOT NULL;

-- 2. Les cinq anciens crans vers les quatre nouveaux.
-- `star` et `crown` fusionnent : on perd un cran de granularité en haut, on
-- gagne une règle qui s'explique en une phrase.
UPDATE fanzzy SET rar = CASE rar
    WHEN 'd1'    THEN 'commune'
    WHEN 'd2'    THEN 'rare'
    WHEN 'd3'    THEN 'epique'
    WHEN 'star'  THEN 'legendaire'
    WHEN 'crown' THEN 'legendaire'
    ELSE rar
  END
 WHERE rar IN ('d1','d2','d3','star','crown');

-- 3. La règle, appliquée à tout le catalogue.
--
-- Toute carte de stade 1 est commune. C'était déjà vrai des lignées ; ça
-- devient vrai de tout le monde, parce que la rareté ne peut plus dire autre
-- chose que le stade. Les légendaires sont épargnées : elles sont hors échelle,
-- sans lignée, et c'est exactement ce qui les définit.
UPDATE fanzzy SET rar = 'commune'
 WHERE stage = 1 AND rar IN ('rare','epique');

UPDATE fanzzy SET rar = 'rare'   WHERE stage = 2 AND rar <> 'rare';
UPDATE fanzzy SET rar = 'epique' WHERE stage = 3 AND rar <> 'epique';

-- 4. Les sept lignées rejoignent les thèmes.
--
-- Elles vivaient dans VIRAGE NORD et NUITS EUROPÉENNES, deux séries d'avant les
-- six thèmes. Elles ne peuvent aller que dans deux d'entre eux : ce sont sept
-- humains d'aujourd'hui, et les rentrer de force dans LE BESTIAIRE ou LES
-- REVENANTS ne voudrait rien dire.
--
-- LA TRIBUNE : la voix, la fidélité, le gamin, la pyro — le virage lui-même.
UPDATE fanzzy SET set_id = 'TR'
 WHERE id IN ('V1','V2','V3','F1','F2','F3','G1','G2','G3','Y1','Y2','Y3');

-- LES MÉTIERS DU STADE : la percussion finit sur la grosse caisse de la
-- fanfare, le tifo est du travail organisé, le déplacement finit sur un
-- chauffeur de car.
UPDATE fanzzy SET set_id = 'MS'
 WHERE id IN ('P1','P2','P3','T1','T2','T3','D1','D2','D3');

-- 5. Une collision de noms.
-- MS15 s'appelait « La Grosse Caisse » et P3 « Grosse Caisse Sud ». Depuis que
-- P3 a rejoint la même série, les deux se cherchent dans la même liste.
UPDATE fanzzy SET nom = 'La Fanfare à Elle Seule'
 WHERE id = 'MS15' AND nom = 'La Grosse Caisse';

-- 6. Les doublons sortent des tirages.
--
-- Trente-deux anciennes cartes refont un personnage du lot de 2026. Douze
-- portent exactement le même nom ; les vingt autres portent un nom différent
-- pour le même personnage — la chouette et le hibou statisticiens, la voyante
-- du virage et celle du parvis, le téléviseur et le téléviseur du café.
--
-- **Dépubliées, pas supprimées.** Un identifiant effacé orphelinerait les
-- collections, les decks et le Fanzzy équipé de tous ceux qui le possèdent :
-- `BY_ID.get()` renverrait undefined en plein tirage. Une carte dépubliée sort
-- des boosters et reste dans la collection de qui l'a déjà. Un UPDATE la remet.
UPDATE fanzzy SET publie = 0
 WHERE id IN ('X9','X10','X11','X12','X15','X16','X17','X18','X19','X21','X22',
              'X23','X24','X25','X26','X27','X28','X29','X31','X33','X34','X35',
              'X36','X37','X38','X42','X43','X44','X45','X46','X50','X51');
