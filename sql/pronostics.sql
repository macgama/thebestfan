-- thebestfan — le pronostic.
--
-- Avant le coup d'envoi d'un match d'un club qu'il suit, le joueur donne le
-- score qu'il attend. Le pronostic ne coûte rien : aucune mise, aucune
-- écharpe engagée. Au coup de sifflet final, le bon vainqueur (ou le bon nul)
-- rapporte des écharpes, le score exact davantage, et la même chose à tous.
-- C'est ce qui le tient hors du jeu d'argent (JURIDIQUE.md, « un gain
-- gratuit, sans mise »).
--
-- Le versement passe par le grand livre (`recompenses`, source `prono`, clé
-- l'identifiant du match) : c'est lui qui garantit qu'un pronostic ne paie
-- qu'une fois. Les trois colonnes du règlement ne font que retenir qu'il a
-- été fait, pour ne pas le refaire à chaque lecture.
--
-- À appliquer après auth.sql (la clé étrangère vers `users`). Le match n'a
-- pas de clé étrangère : `fixtures` se remplit au fil du relevé, et un
-- pronostic ne doit pas tomber parce qu'un match a été rangé à nouveau.
-- Rejouable : `CREATE TABLE IF NOT EXISTS`.

CREATE TABLE IF NOT EXISTS pronostics (
  user_id     CHAR(36)          NOT NULL,
  fixture_id  INT               NOT NULL,
  home_goals  TINYINT UNSIGNED  NOT NULL,
  away_goals  TINYINT UNSIGNED  NOT NULL,
  cree_a      DATETIME(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  modifie_a   DATETIME(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  -- Le règlement, posé une fois le match terminé : `exact`, `vainqueur` ou
  -- `rate`, et les écharpes versées. NULL tant qu'il n'a pas eu lieu, ou
  -- tant que le disjoncteur du jour l'a retenu.
  issue       VARCHAR(10)           NULL,
  echarpes    INT UNSIGNED          NULL,
  regle_a     DATETIME(3)           NULL,
  PRIMARY KEY (user_id, fixture_id),
  KEY k_pronostics_match (fixture_id, regle_a),
  CONSTRAINT fk_prono_user FOREIGN KEY (user_id) REFERENCES users(public_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
