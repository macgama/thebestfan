-- thebestfan — les cris des trois épreuves de décision.
--
-- À appliquer après fanzzy.sql. Rejouable.
--
-- ---------------------------------------------------------------------------
-- Pourquoi ce fichier existe
--
-- LA REPRISE ajoute trois épreuves : la bascule, la visée et la jauge. Elles
-- sont jouables par tout le monde dès leur livraison, par le répertoire de
-- chant — mais **aucun Fanzzy ne les criait**, et un geste que personne ne crie
-- n'existe qu'au catalogue. C'est la règle qu'éprouve `catalogue-smoke.mjs` :
-- une variante sous un huitième de sa famille n'est pas jouable, elle est
-- seulement écrite.
--
-- ---------------------------------------------------------------------------
-- Comment les vingt et une lignées ont été choisies
--
--   — **Sur une variante, jamais sur le geste qui porte le nom de la famille.**
--     Deux règles tiennent une famille : l'éponyme doit rester majoritaire, et
--     chaque variante dépasser un huitième. Les six familles sont réglées au
--     plus juste — une marge d'une seule lignée. Prendre sur l'éponyme faisait
--     donc tomber la première règle et obligeait à ramener autant de lignées
--     depuis ailleurs : quarante déplacées pour en créer vingt et une.
--     `hold`, `relance` et `echarpe` ne bougent pas d'une carte.
--
--   — Dans les **séries les plus récentes** quand c'était possible, pour que le
--     moins de collections possible change de main.
--
--   — Et sur des personnages que le geste **raconte** : l'Itinéraire Perdu et le
--     Dernier Train basculent, le Scaphandrier et l'Infirmière du Stade dosent,
--     le Décompte Oublié vise.
--
-- ---------------------------------------------------------------------------
-- Ce que ça change pour un joueur
--
-- Le mini-jeu de ces cartes, et rien d'autre. Ni leur nom, ni leur rareté, ni
-- leurs modificateurs, ni leur place dans une collection. Le libellé du cri ne
-- bouge pas non plus : il dit qui est le personnage, pas ce qu'on lui demande.
--
-- `JSON_SET` plutôt qu'une réécriture de la colonne : le cri porte aussi son
-- libellé et sa puissance, et les recopier ici les figerait au jour de cette
-- migration. Un libellé corrigé depuis l'administration doit lui survivre —
-- c'est la règle de tout le catalogue.
--
-- **Les trois âges sont nommés un par un.** Dans le code, un âge hérite du
-- geste de sa racine — sauf ceux de LA REPRISE, écrits à la main. En base,
-- chaque ligne porte le sien, figé au semis. Ne migrer que les racines
-- laisserait une lignée qui crie deux choses selon l'âge.

-- jauge : 10 lignées, 16 cartes
UPDATE fanzzy
   SET cri = JSON_SET(cri, '$.gest', 'jauge')
 WHERE id IN ('RP6', 'RP6B', 'RP6C', 'MT12', 'GC12', 'GC17', 'HC12', 'VP10', 'OB13', 'MS13', 'MS13B', 'MS13C', 'EP13', 'EP13B', 'EP13C', 'RV12');

-- visee : 4 lignées, 8 cartes
UPDATE fanzzy
   SET cri = JSON_SET(cri, '$.gest', 'visee')
 WHERE id IN ('RP10', 'RP10B', 'RP10C', 'GC13', 'RV11', 'RV11B', 'RV11C', 'BG26');

-- bascule : 7 lignées, 9 cartes
UPDATE fanzzy
   SET cri = JSON_SET(cri, '$.gest', 'bascule')
 WHERE id IN ('RP12', 'RP12B', 'RP12C', 'MT11', 'GD14', 'GD16', 'HC14', 'GC11', 'VP14');
