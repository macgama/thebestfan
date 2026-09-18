-- Les contenus qui n'étaient pas en base : cartes d'action, équipement, stades.
--
-- ## Pourquoi cette table existe
--
-- Une saison ouvre du contenu. Elle savait ouvrir les **séries** de Fanzzy et
-- publier les **tenues** — les deux seuls contenus qui aient jamais eu un état
-- de publication. Les vingt-neuf cartes d'action, les dix-sept pièces
-- d'équipement et les dix stades vivaient dans `src/shared/`, c'est-à-dire dans
-- le code : une saison pouvait les **annoncer**, elle ne pouvait pas les
-- retenir. `saisons.stuff` et `saisons.actions` existaient déjà et ne servaient
-- qu'à écrire une phrase ; il n'y avait même pas de colonne pour les stades.
--
-- Résultat : trois des quatre sortes de contenu qu'une saison veut livrer
-- étaient décoratives. On pouvait écrire « la saison 5 apporte quatre cartes
-- d'action », et les quatre cartes étaient déjà jouables depuis la livraison
-- précédente.
--
-- ## Une table, et non trois
--
-- Les trois familles n'ont pas la même forme — une carte d'action a un coût et
-- un temps de recharge, un stade a des modificateurs de corde — mais elles ont
-- toutes le même **cycle de vie** : elles naissent dans le code, elles sont
-- semées en base, et une saison décide si elles sont jouables.
--
-- Trois tables auraient voulu dire trois semis, trois lectures, trois contrôles
-- d'écart et trois fois la même migration à chaque changement. Ce qui diffère
-- vit dans `donnees`, ce qui se partage est en colonnes.
--
-- ## Le code reste la forme, la base porte l'état
--
-- C'est le patron du catalogue des Fanzzy, et il a fait ses preuves. Le semis
-- **n'écrase jamais** une ligne existante : un nom corrigé depuis
-- l'administration survit à la prochaine livraison. En échange, une carte
-- modifiée dans le code peut ne jamais arriver en base — c'est pourquoi le
-- démarrage compare les deux et le dit à voix haute, comme il le fait déjà pour
-- les Fanzzy.
--
-- ## `publie` vaut 1 par défaut, et c'est délibéré
--
-- Tout ce qui est déjà dans le jeu y reste. Une migration qui fermerait le
-- catalogue en attendant qu'une saison le rouvre retirerait à tous les joueurs,
-- du jour au lendemain, des cartes qu'ils jouent — et ce serait la faute la
-- plus coûteuse qu'on puisse commettre ici. Les contenus **neufs** naissent
-- fermés ; ceux d'avant restent ouverts.
CREATE TABLE IF NOT EXISTS contenus (
  -- 'action', 'stuff' ou 'stade'. Du texte et non une énumération : ajouter une
  -- famille ne doit pas demander de migrer la table.
  famille  VARCHAR(16)  NOT NULL,
  id       VARCHAR(32)  NOT NULL,
  nom      VARCHAR(64)  NOT NULL,
  -- Nulle pour ce qui n'a pas de rareté. Les stades et l'équipement en ont une,
  -- les cartes d'action aussi ; on ne la suppose pas pour autant.
  rar      VARCHAR(16)      NULL,
  texte    VARCHAR(500)     NULL,

  -- Tout ce qui ne se partage pas : le coût et la recharge d'une carte, les
  -- modificateurs d'un stade, l'effet d'une pièce. Lu tel quel par le code, qui
  -- en connaît la forme famille par famille.
  donnees  JSON             NULL,

  publie   TINYINT(1)   NOT NULL DEFAULT 1,
  maj      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
             ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (famille, id),
  -- « ce qui est jouable dans cette famille » est la seule question qu'on pose
  -- à cette table en cours de partie.
  KEY idx_publie (famille, publie)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Une saison ouvre aussi des stades, désormais. `stuff` et `actions` existaient
-- déjà — elles n'annonçaient rien qu'on pût retenir, elles ouvrent maintenant
-- pour de bon.
ALTER TABLE saisons ADD COLUMN IF NOT EXISTS stades JSON NULL;
