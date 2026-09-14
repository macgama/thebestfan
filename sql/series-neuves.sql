-- Les cartes de VIRAGE NORD et des NUITS EUROPÉENNES changent de série.
--
-- Le catalogue vit en base, et son amorçage est en `INSERT IGNORE` : changer
-- `dex.js` ne touche jamais une ligne déjà posée. Sans cette migration, une
-- installation en service garderait ces cartes rangées dans deux séries que
-- plus aucune page n'affiche — tirables et invisibles.
--
-- Les identifiants ne changent pas. Les possessions, les decks, les tenues et
-- les âges désignent une carte par son identifiant : ils suivent seuls.
--
-- Les deuxième et troisième âges sont dans la liste, eux aussi : « X1B » et
-- « X1C » portent leur propre `set_id`, et les oublier laisserait trente
-- lignes derrière — ce que la base locale a montré au premier essai.
--
-- Rejouable : un `UPDATE` déjà passé ne trouve plus rien à faire.

-- 1 vers BG
UPDATE fanzzy SET set_id = 'BG' WHERE id IN (
  'X15');

-- 3 vers GC
UPDATE fanzzy SET set_id = 'GC' WHERE id IN (
  'X9', 'X10', 'X34');

-- 7 vers GD
UPDATE fanzzy SET set_id = 'GD' WHERE id IN (
  'X4', 'X5', 'X57', 'X58', 'X59', 'X31', 'X36');

-- 4 vers HC
UPDATE fanzzy SET set_id = 'HC' WHERE id IN (
  'X40', 'X40B', 'X40C', 'X43');

-- 5 vers MS
UPDATE fanzzy SET set_id = 'MS' WHERE id IN (
  'X42', 'X14', 'X14B', 'X14C', 'X37');

-- 3 vers MT
UPDATE fanzzy SET set_id = 'MT' WHERE id IN (
  'X2', 'X2B', 'X2C');

-- 46 vers TR
UPDATE fanzzy SET set_id = 'TR' WHERE id IN (
  'X1', 'X1B', 'X1C', 'X6', 'X6B', 'X6C', 'X7', 'X7B',
  'X7C', 'X8', 'X8B', 'X8C', 'X20', 'X20B', 'X20C', 'X39',
  'X39B', 'X39C', 'X41', 'X41B', 'X41C', 'X47', 'X47B', 'X47C',
  'X48', 'X48B', 'X48C', 'X49', 'X49B', 'X49C', 'X17', 'X27',
  'X35', 'X11', 'X26', 'X52', 'X53', 'X54', 'X55', 'X56',
  'X3', 'X3B', 'X3C', 'X12', 'X22', 'X46');

-- 3 vers VP
UPDATE fanzzy SET set_id = 'VP' WHERE id IN (
  'X13', 'X13B', 'X13C');

-- Et la liste des séries ouvertes ne doit plus nommer des séries mortes.
--
-- Une liste vide vaut « aucune restriction » : si retirer VN et NE la vide,
-- on supprime la ligne, ce qui dit la même chose plus clairement.
--
-- Les cinq séries neuves ne sont PAS ajoutées ici. Une installation qui a
-- restreint ses séries l'a fait exprès, et cette migration n'a pas à ouvrir
-- du contenu à sa place : VP, GC, GD, MT et HC s'ouvrent depuis
-- l'administration. Une installation sans restriction les a déjà.
UPDATE reglages
   SET valeur = JSON_REMOVE(valeur, JSON_UNQUOTE(JSON_SEARCH(valeur, 'one', 'VN')))
 WHERE cle = 'series_actives' AND JSON_SEARCH(valeur, 'one', 'VN') IS NOT NULL;

UPDATE reglages
   SET valeur = JSON_REMOVE(valeur, JSON_UNQUOTE(JSON_SEARCH(valeur, 'one', 'NE')))
 WHERE cle = 'series_actives' AND JSON_SEARCH(valeur, 'one', 'NE') IS NOT NULL;

DELETE FROM reglages
 WHERE cle = 'series_actives' AND JSON_LENGTH(valeur) = 0;
