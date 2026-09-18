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

-- ---------------------------------------------------------------------------
-- Ce qu'une ligne de duel ne disait pas encore
--
-- Le parcours montrait une issue, un score et de la ferveur. Il ne disait ni
-- avec quel Fanzzy on avait joué, ni ce que la partie avait rapporté en
-- progression, ni combien de temps elle avait duré, ni qui était dans quel
-- camp. Quatre colonnes, et chacune répond à une question qu'un joueur pose.

-- **Le Fanzzy aligné au coup d'envoi**, c'est-à-dire le titulaire. Pas les
-- remplaçants entrés en cours de partie : celui qui a commencé est celui dont
-- on se souvient, et c'est lui qui permettra « ton Capo a gagné huit duels sur
-- onze » — la phrase qui donne envie d'en faire grandir un second.
ALTER TABLE duel_results ADD COLUMN IF NOT EXISTS fanzzy_id VARCHAR(12) NULL;

-- L'XP versée pour cette partie. Elle était calculée, versée, et jamais
-- conservée : le parcours montrait la ferveur — qui ne fait pas monter de
-- niveau — et rien de la progression, qui est pourtant ce qu'on regarde en
-- premier quand on vient de jouer. Nulle pour un forfait, comme la règle le
-- veut.
ALTER TABLE duel_results ADD COLUMN IF NOT EXISTS xp INT NOT NULL DEFAULT 0;

-- La durée, en secondes. Un duel de cinq minutes et un abandon à la trentième
-- seconde se lisaient exactement pareil. `SMALLINT UNSIGNED` tient dix-huit
-- heures : largement au-dessus de ce qu'un duel peut durer, et deux octets.
ALTER TABLE duel_results ADD COLUMN IF NOT EXISTS duree_s SMALLINT UNSIGNED NULL;

-- Le camp : 0 pour la tribune de domicile, 1 pour celle de l'extérieur, comme
-- partout ailleurs dans le jeu.
--
-- **Sans lui, on ne peut pas dire qui jouait avec qui.** Les lignes d'un même
-- duel partagent `duel_id`, et on pourrait croire que `goals_for` suffit à
-- séparer les deux camps — il le fait, sauf sur un match nul, où les deux
-- côtés portent exactement les mêmes nombres. C'est précisément la partie la
-- plus serrée, donc celle dont on veut se souvenir. Une colonne vaut mieux
-- qu'une déduction qui échoue là où ça compte.
--
-- `opponent_id` ne la remplace pas : elle ne nomme qu'un adversaire, choisi au
-- hasard parmi ceux d'en face, ce qui ne dit rien d'un 3v3.
ALTER TABLE duel_results ADD COLUMN IF NOT EXISTS side TINYINT NULL;

-- Reconstituer les deux camps d'une partie, par son identifiant.
ALTER TABLE duel_results ADD INDEX IF NOT EXISTS idx_duel_camp (duel_id, side);
