/**
 * L'ordre dans lequel les fichiers de `sql/` s'appliquent.
 *
 * **Une seule liste, lue par les deux.** Il y en avait deux, recopiées l'une
 * sur l'autre : celle de `appliquer-schema.mjs`, qui applique, et celle de
 * `schema-smoke.mjs`, qui vérifie que rien n'a été oublié. Elles ont divergé
 * deux fois. La première, le 8 septembre, deux fichiers manquants au
 * déploiement ont éteint le site. La seconde, cinq noms manquaient à celle qui
 * applique — dont `abonnement`, si bien que la table des abonnements ne
 * pouvait pas se créer et que la commande s'arrêtait en annonçant un schéma
 * incomplet sur des fichiers qu'elle n'avait jamais appliqués.
 *
 * Le contrôle qui exige que la liste couvre tout le dossier ne voyait rien :
 * il lisait la liste complète. C'est la duplication elle-même qui était la
 * faute, et deux listes d'accord un jour ne le restent pas.
 *
 * L'ordre est dicté par les clés étrangères : `auth.sql` pose `users`, que
 * presque tout référence, et ce qui ne fait que corriger des lignes déjà
 * posées ferme la marche. Chaque rang porte sa raison juste au-dessus ; un
 * fichier neuf s'insère là où sa dépendance l'exige, et se mentionne dans
 * DEPLOIEMENT.md.
 */
export const ORDRE = ['auth', 'football', 'minutes', 'couleurs', 'duel', 'souvenirs', 'fanzzy', 'teletext',
  'inventaire', 'skins',
  /* `etats.sql` suit `skins.sql` : même clé à quatre colonnes, même raison —
     on possède l'état d'un âge, pas du personnage. Il vient après fanzzy.sql,
     dont son rattrapage lit `user_fanzzy`, et après auth.sql pour la clé
     étrangère vers `users`. */
  'etats',
  'tenues', 'deck', 'admin', 'kop', 'amis', 'niveau', 'raretes', 'stades',
  // La boutique en dernier : sa table d achats s accroche à users, qui vient
  // du premier fichier, mais elle livre des écharpes et des boosters — donc
  // elle suppose la bourse, qui vient de souvenirs.sql.
  'boutique', 'billets',
  // `bourse.sql` remet le défaut de `user_wallet.packs` à trois. Il ne crée
  // rien : il corrige une colonne posée par souvenirs.sql, dont le défaut a
  // divergé entre le fichier et les bases en service — `CREATE TABLE IF NOT
  // EXISTS` ne touche pas à une table qui existe. Après souvenirs, donc, et
  // n'importe où ensuite.
  'bourse',
  // Les saisons : elles s'appuient sur `reglages` (admin.sql) pour reprendre
  // l'ancienne liste des séries ouvertes, et sur `user_wallet` (souvenirs.sql)
  // pour la colonne qui retient l'annonce déjà vue.
  'saisons',
  // Et vraiment en dernier, la seule reprise de données : elle ne déclare
  // aucune table, elle range des cartes déjà posées par fanzzy.sql et corrige
  // un réglage posé par admin.sql.
  'series-neuves',
  /* Les deux reprises de septembre. Elles ne déclarent aucune table : elles
     corrigent des lignes déjà posées par fanzzy.sql, et sur une base neuve
     elles ne trouvent rien à faire — le catalogue y est amorcé depuis le code,
     donc déjà juste.

     prefixes.sql donne à chaque carte le préfixe de sa série et suit
     l'identifiant dans les six tables qui le référencent, JSON des decks
     compris. identites.sql rattrape ce qu'INSERT IGNORE ne sait pas dire : un
     nom ou un cri changé dans le code n'atteint jamais une ligne existante.

     Après series-neuves, qui déplace des cartes d'une série à l'autre : le
     préfixe se calcule sur la série d'arrivée. */
  'prefixes', 'identites',
  /* Les cris des trois épreuves de LA REPRISE. Comme les deux précédents, il ne
     déclare rien : il change le `gest` de trente-trois lignes déjà posées.

     Après `prefixes.sql`, et c'est toute sa dépendance : il nomme ses cartes par
     leur identifiant, et cet identifiant est celui **d'après** le préfixe. Joué
     avant, il ne trouverait rien et se tairait — une migration qui ne lève pas
     et ne fait rien est le pire des deux. */
  'cris',
  /* Les deux colonnes qui disent de quelle **sorte** un duel était. Elles
     viennent après duel.sql, qui pose la table, et n'ont d'autre dépendance :
     le parcours du joueur se lit sur elles, et les classements écartent
     l'entraînement grâce à elles. */
  'historique',
  /* L'abonnement. Il s'accroche à `users` et à rien d'autre : ce qu'il ouvre
     se lit à la lecture, dans les modules, et aucune table ne le référence.
     Il peut donc venir en dernier sans rien attendre. */
  'abonnement',
  /* Les contenus : cartes d'action, équipement, stades. Il ajoute une colonne
     à `saisons`, donc il vient **après** saisons.sql — c'est sa seule
     dépendance, et l'oublier ferait lever sur un ALTER d'une table absente. */
  'contenus',
  /* L'aide. Deux colonnes sur `user_wallet`, donc après souvenirs.sql et nulle
     part ailleurs : elle ne déclare aucune table, et le parcours des premiers
     pas lit tout le reste de ce qui existe déjà. */
  'aide'];
