-- Le parcours d'un joueur : ce qu'il a joué, et ce que ça lui a rapporté.
--
-- `duel_results` savait dire qui avait gagné et combien de ferveur la partie
-- avait donné. Elle ne savait pas dire **quelle sorte de partie** : un 1v1
-- classé et un 2v2 d'entraînement y étaient la même ligne. On ne pouvait donc
-- rien montrer au joueur de ce qu'il avait fait — ni « tes duels classés », ni
-- « tes 2v2 », ni même « tes entraînements », puisque ceux-là n'étaient pas
-- écrits du tout.
--
-- Deux colonnes, et rien d'autre. La compétition, la saison et le club restent
-- là où ils sont déjà — `fixtures` et `team_id` — parce que deux endroits qui
-- portent la même valeur finissent par se contredire.
--
-- `mode` par défaut « classe » : c'est exact pour toutes les lignes existantes.
-- L'entraînement n'était jamais enregistré, donc aucune ligne d'avant cette
-- migration n'en est un. Une valeur par défaut qui décrit vraiment le passé
-- vaut mieux qu'un NULL qu'il faudrait interpréter à chaque lecture.
--
-- `format` reste NULL pour le passé : on ne peut pas le deviner, et deviner
-- serait pire que de dire « on ne sait pas ». Les écrans l'affichent alors
-- comme un duel sans format, ce qui est la vérité.
ALTER TABLE duel_results ADD COLUMN IF NOT EXISTS format VARCHAR(8)  NULL;
ALTER TABLE duel_results ADD COLUMN IF NOT EXISTS mode   VARCHAR(16) NOT NULL DEFAULT 'classe';

-- L'index sert l'écran du parcours : « mes parties, les plus récentes
-- d'abord », éventuellement filtrées par sorte.
ALTER TABLE duel_results ADD INDEX IF NOT EXISTS idx_user_sorte (user_id, mode, ended_at);

-- Le Virage, lui, n'a rien à ajouter : `virage_presence` porte déjà le match,
-- le camp, le club et la ferveur. Il lui manquait seulement d'être lu.
