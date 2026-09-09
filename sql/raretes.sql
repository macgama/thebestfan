-- thebestfan — passage à quatre raretés.
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
-- base déjà remplie garderait ses anciennes raretés pendant que le code
-- attendrait les nouvelles — et un catalogue à moitié converti ne se voit pas,
-- il tire juste de travers.
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

-- 3. Les lignées suivent la règle du stade, sans exception.
--
-- Quatre d'entre elles finissaient en star ou crown — le Capo, le Chef Tifo, le
-- Gosse est Capo, le Doyen du Bloc C. Elles redescendent en épique : leur
-- puissance ne bouge pas, seul le mot change. Un stade 3 ne peut pas être
-- légendaire, sinon la légendaire redevient un simple sommet d'échelle et le
-- mot ne veut plus rien dire.
UPDATE fanzzy SET rar = CASE stage
    WHEN 1 THEN 'commune'
    WHEN 2 THEN 'rare'
    ELSE 'epique'
  END
 WHERE id IN ('V1','V2','V3','P1','P2','P3','F1','F2','F3',
              'T1','T2','T3','Y1','Y2','Y3','D1','D2','D3',
              'G1','G2','G3');

-- 4. Ces mêmes lignées rejoignent LA TRIBUNE.
--
-- Elles vivaient dans VIRAGE NORD et NUITS EUROPÉENNES, deux séries d'avant les
-- six thèmes. Maintenant que tout le monde évolue, « être une lignée » ne
-- distingue plus rien, et ces sept-là racontent toutes la même chose : être
-- debout dans un virage.
UPDATE fanzzy SET set_id = 'TR'
 WHERE id IN ('V1','V2','V3','P1','P2','P3','F1','F2','F3',
              'T1','T2','T3','Y1','Y2','Y3','D1','D2','D3',
              'G1','G2','G3');

-- 5. Une collision de noms.
-- MS15 s'appelait « La Grosse Caisse » et P3 « Grosse Caisse Sud ». Depuis que
-- P3 a rejoint la même famille de cartes, les deux se cherchent dans la même
-- liste. La plus récente cède.
UPDATE fanzzy SET nom = 'La Fanfare à Elle Seule'
 WHERE id = 'MS15' AND nom = 'La Grosse Caisse';
