-- thebestfan — collection Fanzzy côté serveur.
-- À appliquer après auth.sql et souvenirs.sql (qui crée user_wallet).

-- Le catalogue lui-même.
--
-- Il vivait dans src/shared/fanzzy/dex.js, ce qui obligeait à passer par un
-- déploiement pour ajouter une carte. À cent Fanzzy ce n'est plus tenable :
-- le catalogue devient une donnée, et dex.js n'en sera plus que l'amorçage.
--
-- `set` est un mot réservé SQL, d'où `set_id`.
-- `publie` sort une carte des tirages sans la supprimer : un identifiant
-- effacé orphelinerait les collections, les decks et le Fanzzy équipé de tous
-- les joueurs qui le possèdent.
CREATE TABLE IF NOT EXISTS fanzzy (
  id        VARCHAR(12)  NOT NULL,
  nom       VARCHAR(64)  NOT NULL,
  type      VARCHAR(8)   NOT NULL,
  set_id    VARCHAR(4)   NOT NULL,
  stage     TINYINT      NOT NULL DEFAULT 1,
  -- 16 et non 8 : « legendaire » fait dix caractères. Sous MySQL non strict,
  -- une colonne trop courte ne lève pas — elle tronque en silence, et la carte
  -- se retrouve avec une rareté « legendai » que plus rien ne reconnaît.
  rar       VARCHAR(16)  NOT NULL,
  evo       VARCHAR(12)  NULL,
  histoire  TEXT         NULL,
  mods      JSON         NOT NULL,
  cri       JSON         NOT NULL,
  publie    TINYINT(1)   NOT NULL DEFAULT 1,
  ordre     SMALLINT     NOT NULL DEFAULT 0,
  cree_a    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  maj_a     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
              ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY k_fanzzy_tirage (publie, set_id, rar)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ce que le joueur possède : **un personnage**, pas un âge.
--
-- `fanzzy_id` désigne le premier âge de la lignée — celui que les boosters
-- distribuent — et `stage` dit jusqu'où le joueur l'a fait grandir. Les âges
-- supérieurs restent des lignes du catalogue, parce qu'ils portent chacun leur
-- nom, leur histoire et leurs bonus ; ils ne sont simplement pas des cartes
-- séparées à posséder.
--
-- Avant, ils l'étaient : faire évoluer un Choriste le retirait de la collection
-- pour y poser un Meneur de chant, et sept personnages occupaient vingt et une
-- entrées. Voir sql/stades.sql pour la reprise des collections existantes.
CREATE TABLE IF NOT EXISTS user_fanzzy (
  user_id    CHAR(36)    NOT NULL,
  fanzzy_id  VARCHAR(12) NOT NULL,
  copies     SMALLINT    NOT NULL DEFAULT 1,
  stage      TINYINT     NOT NULL DEFAULT 1,
  first_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, fanzzy_id),
  CONSTRAINT fk_uf_user FOREIGN KEY (user_id) REFERENCES users(public_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- La référence d'amorçage : ce que le code disait la dernière fois qu'il a
-- écrit cette carte.
--
-- ## Le trou qu'elle bouche
--
-- Le catalogue vit en base et s'amorce depuis `dex.js` en `INSERT IGNORE` : on
-- ajoute ce qui manque, on n'écrase jamais ce qui existe. C'est voulu — sans
-- ça, chaque redémarrage effacerait les corrections faites à l'écran
-- d'administration.
--
-- La contrepartie n'était tenue par rien : **changer une carte déjà en base
-- dans le code ne change rien.** La ligne est là, `IGNORE` l'ignore, et le jeu
-- continue d'afficher l'ancienne version, sans erreur et sans trace. Quatre
-- fichiers de ce dossier n'existent que pour rattraper ça à la main —
-- `identites.sql`, `raretes.sql`, `series-neuves.sql`, `prefixes.sql` — et
-- c'est quatre fois le même travail : lire le code, lire la base, écrire les
-- `UPDATE` de la différence.
--
-- ## Pourquoi une colonne, et pas une règle
--
-- Le code et l'écran ont tous les deux le droit d'écrire, et on ne peut pas
-- trancher entre eux en regardant leurs deux valeurs : « le nom du code diffère
-- du nom en base » ne dit pas **qui** a bougé. Il en faut une troisième — ce
-- que le code disait quand la ligne a été posée. Avec elle, la question se
-- répond champ par champ, et sans supposition :
--
--   base == amorce  →  personne n'y a touché à l'écran : le code fait foi,
--                      la valeur est reprise et l'amorce suit.
--   base != amorce  →  quelqu'un l'a corrigée à l'écran : on n'y touche pas,
--                      et le démarrage le dit si le code voulait autre chose.
--
-- C'est la fusion à trois points d'un `git merge`, et c'est exactement pour la
-- même raison : deux auteurs sur la même donnée, aucun des deux ne doit écraser
-- l'autre en silence.
--
-- ## Ce que veut dire NULL
--
-- **NULL = cette ligne n'est pas gérée par le code.** Deux cas :
--
--   — une carte créée depuis l'administration : elle n'est pas dans `dex.js`,
--     il n'y a rien à réconcilier, et son NULL la protège pour toujours ;
--   — une ligne d'avant ce mécanisme : on ne sait pas ce que le code disait
--     quand elle a été posée. Le démarrage l'adopte — amorce = son état actuel
--     — **à la seule condition que `admin_audit` ne garde aucune trace d'une
--     modification de cette carte**. Une carte corrigée à l'écran garde son
--     NULL et reste intouchable.
--
-- Ici plutôt que dans un fichier à part : `fanzzy.sql` est rejoué à chaque
-- passage de schéma, et **toutes les suites l'appliquent**. Une migration
-- séparée aurait laissé dix-neuf suites tourner sans la colonne, donc dix-neuf
-- suites où le démarrage annonce une réconciliation désactivée — un avertissement
-- que tout le monde apprend à sauter, y compris le jour où il est vrai.
--
-- Rejouable, et sans effet sur une base déjà à jour.
ALTER TABLE fanzzy ADD COLUMN IF NOT EXISTS amorce JSON NULL;

-- Le Fanzzy équipé pour les duels. Colonne ajoutée à la bourse existante :
-- c'est la même ligne, lue au même moment que les écharpes et les boosters.
ALTER TABLE user_wallet ADD COLUMN IF NOT EXISTS active_fanzzy VARCHAR(12) NULL;

-- L'âge auquel on le montre.
--
-- `active_fanzzy` dit **qui**, cette colonne dit **à quel âge**. Elles vont par
-- paire et vivent donc sur la même ligne : deux tables pour une seule décision
-- finiraient par se contredire, et l'écran d'accueil montrerait un âge que la
-- liste d'amis ignore.
--
-- Nul veut dire **l'âge atteint**, qui était le comportement d'avant : une base
-- où personne n'a encore choisi affiche exactement ce qu'elle affichait hier.
-- Ce n'est pas un défaut de la colonne, c'est sa valeur par défaut — celui qui
-- a payé quatre-vingt-dix écharpes pour faire grandir son Capo veut le voir
-- grandi, tant qu'il n'a pas dit le contraire.
--
-- Changer de personnage la remet à nul : un âge choisi pour un Fanzzy ne veut
-- rien dire pour le suivant, et le garder ferait apparaître le nouveau venu à
-- un âge qu'il n'a peut-être jamais atteint.
ALTER TABLE user_wallet ADD COLUMN IF NOT EXISTS active_evo TINYINT UNSIGNED NULL;

-- La pose de l'avatar : `joie`, `depit`, `pousse`, `colere` -- ou nul, qui veut
-- dire le repos. Voir ETATS_DESSINES dans src/shared/fanzzy/rendus.js.
--
-- `active_fanzzy` dit qui, `active_evo` a quel age, celle-ci dit **dans quelle
-- expression**. Les trois se choisissent ensemble sur la fiche du Fanzzy, et
-- c'est cet ensemble qu'on voit partout : l'accueil, les amis, le duel.
--
-- Pas d'ENUM, meme raison que dans user_etats : un cinquieme etat dessine un
-- jour ne doit pas demander un ALTER TABLE en production.
--
-- Elle se remet a nul en meme temps que `active_evo` -- une expression choisie
-- pour un age ne veut rien dire pour un autre, et le personnage reparaitrait
-- dans une pose qu'il n'a peut-etre pas gagnee a cet age-la.
ALTER TABLE user_wallet ADD COLUMN IF NOT EXISTS active_etat VARCHAR(16) NULL;
