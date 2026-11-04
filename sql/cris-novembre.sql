-- thebestfan — les cris des six gestes de novembre 2026, un par famille.
--
-- À appliquer après cris-automne.sql. Rejouable.
--
-- ---------------------------------------------------------------------------
-- Pourquoi ce fichier existe
--
-- La justesse, les accents, sans craquer, le puzzle, la mèche et le cortège
-- se jouent par le répertoire de chant dès leur livraison. Mais un geste que
-- personne ne crie n’existe qu’au catalogue : chaque variante doit tenir au
-- moins un dixième de sa famille (catalogue-smoke.mjs). Gaël a choisi le
-- 4 novembre 2026 de les donner à des Fanzzy existants.
--
-- ---------------------------------------------------------------------------
-- Comment les lignées ont été choisies
--
--   — **Hors de RP et AN**, les deux séries ouvertes en production (la
--     BASE) : aucune carte qu’un joueur a pu ouvrir ne change de mini-jeu.
--   — **Sur une variante, jamais sur le geste éponyme**, prise à celle qui
--     en avait le plus au-dessus de son plancher.
--
-- Le libellé du cri ne bouge pas. **Les trois âges nommés un par un** : en
-- base, chaque ligne porte son propre cri.

-- justesse : 11 lignées, 25 cartes
UPDATE fanzzy
   SET cri = JSON_SET(cri, '$.gest', 'justesse')
 WHERE id IN ('EP16', 'IM19', 'GC14', 'GD26', 'GD38', 'MT13', 'MT25', 'HC10', 'HC30',
   'HC36', 'HC46', 'EP16B', 'EP16C', 'HC30B', 'HC30C', 'HC36B', 'HC36C',
   'HC46B', 'HC46C', 'GD26B', 'GD26C', 'GD38B', 'GD38C', 'MT25B', 'MT25C');

-- accents : 10 lignées, 22 cartes
UPDATE fanzzy
   SET cri = JSON_SET(cri, '$.gest', 'accents')
 WHERE id IN ('MS10', 'MS15', 'BG13', 'BG18', 'EP17', 'GD34', 'MT29', 'HC13', 'HC41',
   'HC42', 'MS10B', 'MS10C', 'BG13B', 'BG13C', 'HC41B', 'HC41C', 'HC42B',
   'HC42C', 'GD34B', 'GD34C', 'MT29B', 'MT29C');

-- leurres : 14 lignées, 30 cartes
UPDATE fanzzy
   SET cri = JSON_SET(cri, '$.gest', 'leurres')
 WHERE id IN ('GC17', 'IM2', 'IM12', 'BG11', 'BG12', 'BG19', 'EP10', 'BG27', 'EP18',
   'GC12', 'GD17', 'GD18', 'GD29', 'HC23', 'BG11B', 'BG11C', 'BG12B',
   'BG12C', 'BG19B', 'BG19C', 'EP10B', 'EP10C', 'HC23B', 'HC23C', 'GD17B',
   'GD17C', 'GD18B', 'GD18C', 'GD29B', 'GD29C');

-- puzzle : 11 lignées, 27 cartes
UPDATE fanzzy
   SET cri = JSON_SET(cri, '$.gest', 'puzzle')
 WHERE id IN ('MS11', 'MS24', 'BG14', 'BG21', 'BG22', 'EP14', 'BG25', 'GD41', 'MT10',
   'HC34', 'HC49', 'MS11B', 'MS11C', 'BG14B', 'BG14C', 'BG21B', 'BG21C',
   'BG22B', 'BG22C', 'EP14B', 'EP14C', 'HC34B', 'HC34C', 'HC49B', 'HC49C',
   'GD41B', 'GD41C');

-- meche : 9 lignées, 21 cartes
UPDATE fanzzy
   SET cri = JSON_SET(cri, '$.gest', 'meche')
 WHERE id IN ('MS23', 'IM18', 'BG26', 'EP19', 'GD27', 'GD49', 'GD51', 'MT33', 'MT41',
   'MS23B', 'MS23C', 'GD27B', 'GD27C', 'GD49B', 'GD49C', 'GD51B', 'GD51C',
   'MT33B', 'MT33C', 'MT41B', 'MT41C');

-- cortege : 11 lignées, 21 cartes
UPDATE fanzzy
   SET cri = JSON_SET(cri, '$.gest', 'cortege')
 WHERE id IN ('IM17', 'BG20', 'EP11', 'EP15', 'GD14', 'IM20', 'BG24', 'GD19', 'GD24',
   'HC14', 'HC18', 'BG20B', 'BG20C', 'EP11B', 'EP11C', 'HC18B', 'HC18C',
   'GD19B', 'GD19C', 'GD24B', 'GD24C');

