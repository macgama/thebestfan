-- thebestfan — les cris des quatre épreuves de l’automne 2026.
--
-- À appliquer après cris.sql. Rejouable.
--
-- ---------------------------------------------------------------------------
-- Pourquoi ce fichier existe
--
-- La ola, l’écho inversé, les rouleaux et les deux voix se jouent par le
-- répertoire de chant dès leur livraison. Mais un geste que personne ne crie
-- n’existe qu’au catalogue : c’est la règle de cris.sql, éprouvée par
-- catalogue-smoke.mjs — chaque variante au-dessus d’un huitième de sa famille.
--
-- ---------------------------------------------------------------------------
-- Comment les vingt-cinq lignées ont été choisies
--
--   — **Hors de LA REPRISE, toutes.** C’est la seule série ouverte en
--     production : aucune carte possédée par un joueur ne change de mini-jeu.
--     Les séries fermées arriveront avec leurs cris déjà posés.
--
--   — **Sur une variante, jamais sur le geste éponyme**, et jamais sous le
--     plancher d’un huitième : la mémoire donne à l’écho inversé, la mosaïque
--     et le tri à la ola, les salves et le crescendo aux deux voix, le compte
--     aux rouleaux. La bascule, la visée et la jauge ne bougent pas.
--
--   — Sur des personnages que le geste raconte : le Vampire du Nocturne, qui
--     n’a pas de reflet, rejoue en miroir ; le Juge de Touche lève la vague ;
--     le Teckel Interminable, qui prend deux places, chante à deux voix ; le
--     Roi de la Grillade lance.
--
-- Le libellé du cri ne bouge pas : il dit qui est le personnage, pas ce qu’on
-- lui demande. `JSON_SET` pour la même raison que cris.sql, et **les trois âges
-- nommés un par un** : en base, chaque ligne porte son propre cri.

-- miroir : 8 lignées, 24 cartes
UPDATE fanzzy
   SET cri = JSON_SET(cri, '$.gest', 'miroir')
 WHERE id IN ('RV19', 'RV19B', 'RV19C', 'RV14', 'RV14B', 'RV14C', 'EP12', 'EP12B',
   'EP12C', 'MS17', 'MS17B', 'MS17C', 'EP11', 'EP11B', 'EP11C', 'TR26', 'TR26B',
   'TR26C', 'BG15', 'BG15B', 'BG15C', 'MS20', 'MS20B', 'MS20C');

-- ola : 7 lignées, 19 cartes
UPDATE fanzzy
   SET cri = JSON_SET(cri, '$.gest', 'ola')
 WHERE id IN ('MS19', 'MS19B', 'MS19C', 'BG14', 'BG14B', 'BG14C', 'TR48', 'TR48B',
   'TR48C', 'BG22', 'BG22B', 'BG22C', 'TR20', 'TR20B', 'TR20C', 'MS34', 'BG21',
   'BG21B', 'BG21C');

-- deuxvoix : 6 lignées, 18 cartes
UPDATE fanzzy
   SET cri = JSON_SET(cri, '$.gest', 'deuxvoix')
 WHERE id IN ('TR22', 'TR22B', 'TR22C', 'TR63', 'TR63B', 'TR63C', 'BG23', 'BG23B',
   'BG23C', 'OB10', 'OB10B', 'OB10C', 'TR25', 'TR25B', 'TR25C', 'BG10', 'BG10B',
   'BG10C');

-- rouleaux : 4 lignées, 10 cartes
UPDATE fanzzy
   SET cri = JSON_SET(cri, '$.gest', 'rouleaux')
 WHERE id IN ('TR54', 'MS25', 'MS25B', 'MS25C', 'RV15', 'RV15B', 'RV15C', 'MS23',
   'MS23B', 'MS23C');
