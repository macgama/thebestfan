-- thebestfan — les amis, et les invitations au KOP.
--
-- À appliquer après auth.sql et kop.sql. Rejouable.

-- L'amitié.
--
-- **Une seule ligne pour deux personnes**, et les identifiants sont rangés :
-- `a` est toujours le plus petit des deux. C'est ce qui rend impossible, *par
-- la base*, d'avoir deux demandes croisées entre les mêmes joueurs ou d'être
-- ami avec quelqu'un deux fois. Vérifiée dans le code, la règle céderait sur
-- deux clics simultanés — et deux lignes contradictoires pour une même paire
-- ne se réparent qu'à la main.
--
-- `par` dit qui a demandé : sans lui, une ligne rangée par ordre alphabétique
-- ne sait plus qui doit répondre à qui.
--
-- Le refus **se garde**, il ne s'efface pas. Une ligne effacée laisserait
-- redemander dans la seconde, indéfiniment ; conservée, elle impose un délai
-- avant une nouvelle demande. C'est la seule mesure du jeu contre le
-- harcèlement, et elle tient en une colonne.
CREATE TABLE IF NOT EXISTS amities (
  a         CHAR(36) NOT NULL,
  b         CHAR(36) NOT NULL,
  par       CHAR(36) NOT NULL,
  etat      ENUM('demande','amis','refuse') NOT NULL DEFAULT 'demande',
  demande_le DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  repondu_le DATETIME(3) NULL,
  PRIMARY KEY (a, b),
  KEY k_amitie_b (b, etat),
  KEY k_amitie_a (a, etat),
  CONSTRAINT fk_amitie_a FOREIGN KEY (a) REFERENCES users(public_id) ON DELETE CASCADE,
  CONSTRAINT fk_amitie_b FOREIGN KEY (b) REFERENCES users(public_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- L'invitation à un KOP.
--
-- Rejoindre un KOP est déjà ouvert à qui suit le club : l'invitation ne donne
-- donc aucun droit nouveau, elle **désigne** un groupe à quelqu'un qui ne
-- l'aurait pas trouvé. C'est un pointeur, pas une clé — et c'est pour ça
-- qu'elle peut disparaître sans rien casser.
CREATE TABLE IF NOT EXISTS kop_invites (
  kop_id  CHAR(36)    NOT NULL,
  user_id CHAR(36)    NOT NULL,
  par     CHAR(36)    NOT NULL,
  le      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (kop_id, user_id),
  KEY k_invite_user (user_id),
  CONSTRAINT fk_invite_kop FOREIGN KEY (kop_id) REFERENCES kops(id) ON DELETE CASCADE,
  CONSTRAINT fk_invite_user FOREIGN KEY (user_id) REFERENCES users(public_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Le lien d'invitation, pour faire venir quelqu'un qui ne joue pas encore.
--
-- Tout le reste de ce module met en relation des gens **déjà inscrits** : les
-- suggestions ne proposent que des supporters du même club, et la recherche ne
-- trouve que des comptes. Un jeu de tribunes qui ne sait pas faire venir un ami
-- de l'extérieur attend que ses joueurs se trouvent tout seuls.
--
-- **Un code par joueur, et il ne change pas.** C'est un lien qu'on colle dans
-- une conversation de groupe et qui y reste des mois : le régénérer à chaque
-- partage casserait celui d'hier, dans une conversation qu'on ne relira jamais.
-- Il tient donc dans une ligne par personne, et `UNIQUE (par)` interdit d'en
-- avoir deux.
--
-- **On ne garde pas le registre de qui est venu par qui.** Ce serait facile —
-- une colonne de plus — et ce serait une donnée personnelle conservée sans
-- raison : aucune récompense n'est attachée au parrainage, il n'y a donc rien à
-- vérifier ni à contester. Le résultat se voit là où il compte, dans la liste
-- d'amis des deux.
--
-- `ON DELETE CASCADE` : le compte parti, son lien ne mène plus nulle part et
-- disparaît avec lui. C'est ce que promet la politique de confidentialité.
CREATE TABLE IF NOT EXISTS parrainages (
  code    VARCHAR(16) NOT NULL,
  par     CHAR(36)    NOT NULL,
  cree_le DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (code),
  UNIQUE KEY u_parrainage_par (par),
  CONSTRAINT fk_parrainage_par FOREIGN KEY (par) REFERENCES users(public_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
