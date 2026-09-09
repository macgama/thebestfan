-- thebestfan — le catalogue des tenues, en base.
--
-- Il vivait dans `src/shared/fanzzy/inventaire.js` : ajouter un thème demandait
-- un déploiement. C'est le même chemin qu'a pris le catalogue Fanzzy, et pour
-- la même raison — un contenu ne doit pas exiger de toucher au code.
--
-- `inventaire.js` n'en est plus que l'amorçage.
--
-- À appliquer après inventaire.sql et skins.sql.
-- Rejouable.

CREATE TABLE IF NOT EXISTS tenues (
  id       VARCHAR(24)  NOT NULL,
  nom      VARCHAR(48)  NOT NULL,
  -- Ce que le joueur lit sur la fiche. Une tenue sans phrase reste une tenue,
  -- mais elle ne raconte rien.
  texte    VARCHAR(160) NULL,
  -- 16 et non 8 : « legendaire » fait dix caractères, et sous MySQL non strict
  -- une colonne trop courte tronque en silence. La leçon a déjà été payée sur
  -- la table `fanzzy`.
  rar      VARCHAR(16)  NOT NULL DEFAULT 'rare',
  -- **Rien ne se supprime.** Une tenue retirée orphelinerait les `user_skins`
  -- de tous ceux qui la possèdent : ils la verraient disparaître de leur
  -- collection sans explication. On dépublie — elle sort des boosters, elle
  -- reste à qui l'a gagnée.
  publie   TINYINT(1)   NOT NULL DEFAULT 1,
  ordre    SMALLINT     NOT NULL DEFAULT 0,
  cree_a   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  maj_a    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
             ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY k_tenue_tirage (publie, rar)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Les six thèmes d'origine sortent de la circulation.
--
-- `UPDATE` et non `DELETE` : dix-neuf lignes de `user_skins` en production les
-- désignent. Les effacer confisquerait des tenues gagnées en booster, et
-- laisserait la fiche chercher un identifiant qui n'existe plus.
--
-- La clause `WHERE` les nomme une par une plutôt que d'écarter « tout sauf
-- base » : le jour où quelqu'un ajoute un thème depuis l'administration, une
-- règle en négatif le dépublierait à la prochaine exécution de ce fichier.
UPDATE tenues SET publie = 0
 WHERE id IN ('pluie', 'nocturne', 'derby', 'anniv', 'promo', 'legende');
