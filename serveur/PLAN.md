# Plan d'implémentation — chantier serveur, vague 1

*Pour l'atelier qui écrit le code. 2 octobre 2026. À lire avec `CONTRATS.md`
(la forme exacte de chaque réponse, qui fait foi) et `SERVEUR.md` (le contenu
et ses raisons). Les études d'origine sont `ECONOMIE.md`, `DONNEES.md` et
`RISQUES.md`, dans ce dossier. Elles divergeaient sur plusieurs points : le
§ 1 dit ce qui a été retenu, et c'est ce plan qui fait foi.*

---

## 0. Périmètre de la vague

**Dans la vague : les points 1 à 8** de la synthèse.

1. L'XP courant et le seuil dans les résultats de booster et de duel.
2. Le drapeau « vu / nouveau ».
3. L'avatar et le niveau dans `/api/rank/*`, les membres de KOP, les amis et
   le classement d'une compétition.
4. La cote avant/après d'un duel classé, et l'évolution de « ma ligne ».
5. Les paliers de collection (crans, séries complètes) et de rang (divisions
   de saison), avec leurs gains.
6. Les missions du jour, leur réclamation, le sachet, la carte de présence, la
   série de jours, le carnet de tampons.
7. La saison datée : fin, saison annoncée, récompense.
8. « Depuis ta dernière visite ».

**Et les correctifs sur lesquels elle bâtit** (`RISQUES.md`, § 0) : E1
(forfait payé deux fois), E2 (`gagner()` non atomique), E3 (recharge qui écrase
un débit), E4 (vote échu appliqué deux fois), E5 (clôture du vote comparée en
JavaScript), E6 (classement « saison » sans fenêtre), C6 (bonus de KOP de
saison sans fin), P7 (la cote relit tout l'historique), M8 (suppression de
compte).

**Hors de la vague, avec le lot 6 des arènes :**

- **La présence (point 9).** Elle se dérive de `roomOfUser` (Virage) et de
  `salleDe` (duel), que le lot 6 refait. Elle demande une décision de Gaël sur
  la visibilité par défaut pour un public mineur (`RISQUES.md`, V3, L5), et une
  mise à jour de `CONFIDENTIALITE.md`. Aucune raison forte de l'avancer : les
  écrans du lot 5 n'en affichent pas (`CONTRATS.md`, § 9).
- **Le bilan de tribune (point 10).** Il remplace « QUITTER ? » dans l'arène
  que le lot 6 redessine, et il a besoin du module partagé du verdict (seuil
  de PARFAIT, aujourd'hui en dur dans `public/virage.html`) et des colonnes
  `parfaits`, `meilleur`, `serie_max`, posées en même temps.
- **Exception voulue :** le compteur de **chants** au Virage (`chants`,
  `chants_mt1`, `chants_mt2`) arrive dès cette vague, parce que les missions
  du Virage en ont besoin. Il s'écrit dans l'upsert qui existe, sans requête
  de plus. Le lot 6 y ajoutera ses colonnes.

---

## 1. Ce qui a été tranché entre les trois études

| Question | Retenu | Pourquoi |
|---|---|---|
| Où inscrire ce qui est versé | **Un seul grand livre, `recompenses`**, clé primaire `(user_id, source, cle)` posée dans le `CREATE TABLE`. Pas de `presences`, `paliers_verses`, `user_paliers` ni `user_jour.missions` en bits. | Une seule idempotence pour toutes les sources (T2), un disjoncteur quotidien qui somme une table (T10), une requête de détection, et un registre qui survit à l'anonymisation d'un compte (M8). |
| Missions : personnelles ou communes | **Un tirage du jour commun à tous** (graine = le jour), chaque joueur prenant dans l'ordre du tirage **la première mission faisable pour lui**. | « Deux joueurs qui se parlent parlent de la même chose » (règle des saisons), sans proposer à quelqu'un une mission impossible. Le tirage est déterministe : deux onglets écrivent la même chose (T5). |
| Missions de qualité (PARFAIT, série) | **Hors vague**, en réserve. | Elles paient la qualité du geste, donc poussent à l'automatiser (T6), et demandent les compteurs du lot 6. |
| Cibles des missions | **Dans le code** (`src/shared/quotidien.js`), pas au registre. | C'est une règle, comme une carte, et une cible mal réglée pourrait dépasser le plafond gratuit (L2). Seuls les montants sont réglables. |
| Type `liste` au registre | **Aucun.** Une bascule booléenne par mission. | `admin.html` dessine tout type inconnu en champ numérique (l. 1406-1422) : une liste y serait inéditable. |
| Divisions : sur la cote ou la ferveur | **Sur la ferveur classée de saison**, cinq divisions à seuils fixes. | Une division ne se perd pas (« aucune série qu'on perd ») ; la cote, elle, redescend. La cote reste affichée au bilan du duel (point 4), sans division. |
| Divisions : ce qu'elles paient | **L'honneur seulement** : l'insigne, et le titre pour Capo. Gain à zéro. *(Relecture.)* | La ferveur classée n'est plafonnée que pour le gratuit (`abonnement/index.js`, `duelsClassesRestants` et `viragesClassesRestants` rendent `null` pour un abonné). Payée en boosters, une division s'achèterait en partie (`RISQUES.md`, L3). |
| L'XP d'une récompense | **Dans la transaction du versement**, par `niveau.gagnerDans(conn, …)`. *(Relecture.)* | Versée après le `COMMIT`, elle pouvait manquer sous une ligne du grand livre qui la dit versée, sans rattrapage possible (la clé l'interdit). |
| Un booster offert et la recharge | **La recharge due est comptée d'abord**, sous le même verrou. *(Relecture.)* | `wallet()` remet `packs_at` à maintenant dès que la réserve est pleine : un cadeau qui la remplit efface la recharge en cours. |
| À quel jour comptent les chants | **Au jour de jeu du coup d'envoi** du match. *(Relecture.)* | `virage_presence` est une ligne par match, datée de sa dernière poussée : un match à cheval sur minuit déplaçait tous ses chants d'un jour. |
| Ce qu'est un duel « joué » | **`xp > 0` et `duree_s >= 60`**. *(Relecture.)* | Un forfait immédiat d'un second compte offrait une victoire en trois secondes, payée en entier au joueur resté (`nvn/index.js`, `recompenser`). |
| Date de fin : un instant ou un jour | **Un jour, `saisons.fin_le DATE`**, comparé à `CURDATE()`. | C'est le jour de jeu, celui des quotas et des missions : il ne traverse aucun fuseau, et l'administration saisit un jour. |
| Le carnet : où le régler | **Par défaut dans le code** (`CARNET_DEFAUT`, la saison 1 d'`ECONOMIE.md`), **remplaçable par saison** dans `saisons.carnet` (JSON validé), saisi dans l'onglet Saisons. | Chaque saison a sa durée et ses noms ; le registre ne sait pas porter un tableau. |
| Fin de saison | **Aucun versement d'office, aucune tâche de clôture.** Un palier atteint reste récupérable sans limite de temps. | « Rien ne se perd », sans le risque de clôture concurrente (T11) ni de requête de plusieurs minutes. |
| Missions d'hier | **Récupérables jusqu'à la fin du jour suivant**, refusées au-delà (`jour_passe`). | Concilie « rien ne se perd » (`ECONOMIE.md`, principe 6) et le minuit pile (J2). |
| Marque de dernière visite | **Avancée par un `POST`**, jamais par un `GET`. | Un aperçu de lien ou un préchargement ne mange pas le ticket (T3). |
| Le sachet | **Une quatrième ligne du contrat du jour** (`rang = 3`), figée au tirage comme les missions. | Le montant promis le matin est celui qui est versé (T9). |
| Le bonus | **Calculé à la réclamation**, pas figé. | Il se réclame quelques secondes après l'affichage ; la réponse dit ce qui a été versé. |
| « +120 écharpes » dans le ticket | **Non servi.** | Aucun journal hors des sources nouvelles : un chiffre partiel mentirait (V4). |

---

## 2. Règles d'atelier

Elles viennent d'`ETAT.md` § 2 et § 6, et des pannes déjà payées dans ce dépôt.

1. **Chaque correctif a son test, et chaque test est cassé exprès une fois.**
   Chaque périmètre rend la liste de ses mutations, avec le contrôle qui a
   rougi. Une mutation doit reproduire **exactement** l'ancien code, sinon elle
   ne prouve rien.
2. **Le jour de jeu est `CURDATE()`, écrit et comparé en SQL.** Jamais un jour
   fabriqué en JavaScript, jamais `new Date()` passé au pool (il est en
   `timezone: 'Z'`). Une colonne `DATE` se relit par
   `DATE_FORMAT(col, '%Y-%m-%d')`. Un délai se calcule en SQL par
   `UNIX_TIMESTAMP(…) - UNIX_TIMESTAMP(NOW(3))` (juste les jours de 23 h et de
   25 h), jamais par `TIMESTAMPDIFF` (heure murale). `fixtures.kickoff_at` est
   en UTC : il ne se compare qu'à `UTC_TIMESTAMP()`.
3. **Les suites sèment en SQL** (`NOW(3)`, `CURDATE()`,
   `CURDATE() - INTERVAL 1 DAY`), comme le serveur écrit, et **figent l'horloge
   de la base** avec l'aide du socle. Instants à éprouver : 12:00, 00:30,
   23:59:59 puis 00:00:01, le 2026-10-25 à 00:30 (25 h), le 2027-03-28 à 00:30
   (23 h). Contrôle du contrôle : `SELECT NOW()` rend l'instant figé.
4. **Comparer à la valeur exacte**, jamais « supérieur à zéro » (c'est ce qui a
   caché E1). Une proportion s'écrit comme une proportion.
5. **Deux onglets** : chaque versement est éprouvé par `Promise.all` de deux
   puis de dix appels identiques.
6. **Une table absente éteint la fonction, pas la route** (R3 de
   `DONNEES.md`). Une écriture annexe (compteur, nouveauté) ne fait **jamais**
   échouer l'ouverture d'un booster, la fin d'un duel ou une poussée : elle
   passe après la validation, sous `try`, et journalise **une fois** le fichier
   à appliquer. Inversement, **un versement sans son grand livre ne se fait
   pas** (M2).
7. **Aucun module de ce chantier ne lit `estAbonne`**, et aucune mission ne
   demande ce que le gratuit plafonne.
8. **Les messages d'erreur nomment la cause** (`ETAT.md` § 2).
9. **Aucun appel nouveau à l'API sportive.** La journée du foot (`jourDuFoot`,
   cache de 45 s partagé avec `/matchs`) et `fixtures` suffisent.
10. **Une colonne par `ALTER TABLE`** : `src/server/auth/schema.js` ne voit que
    le premier `ADD COLUMN IF NOT EXISTS` d'une instruction.
11. **Outillage du poste** : correctifs par script Node écrit avec Write, jamais
    `String.replace` avec un texte qui contient `$` (employer `split/join`),
    fins de ligne détectées et conservées (LF pour un fichier neuf), aucun
    accent grave dans un commentaire posé à l'intérieur d'un gabarit de chaîne
    (requêtes SQL comprises : l'explication va au-dessus de la requête), pas de
    Python. Commentaires en français, qui disent pourquoi.
12. **Les suites ne tournent jamais en parallèle.** Une suite à la fois, sous le
    verrou `.tbf-suite.lock` de la copie principale. Le verrou échoue au lieu
    d'attendre : on relance plus tard. Jamais de suite lancée depuis un
    worktree pendant qu'une autre tourne dans la copie principale (même base).
13. **Fin d'une suite** : `process.exitCode`, jamais `process.exit()`.
14. **Personne ne commite.** Chaque périmètre ne touche que ses fichiers ; un
    besoin ailleurs se décrit dans son rendu avec la **clé** du périmètre
    concerné (§ 6), jamais avec un libellé libre.

---

## 3. Le schéma : `sql/quotidien.sql`

Un seul fichier, propriété du périmètre `socle`, **en dernier** dans `ORDRE`
(`scripts/ordre-schema.mjs`), après `aide`. Raison à écrire au-dessus : il
dépend de `users` (auth), `user_wallet` et `virage_presence` (souvenirs),
`saisons` (saisons). Additif seulement : tables neuves, colonnes `NULL` ou avec
`DEFAULT`, rien de renommé, aucun rattrapage de données.

```sql
-- Le grand livre : tout ce que les sources nouvelles versent, une ligne par
-- versement. La clé primaire EST l'idempotence : elle est ici, dans le
-- CREATE TABLE, et jamais ajoutée après coup (M3).
-- Pas de clé étrangère : la ligne survit à l'anonymisation d'un compte, c'est
-- la trace comptable du jeu.
CREATE TABLE IF NOT EXISTS recompenses (
  user_id   CHAR(36)          NOT NULL,
  source    VARCHAR(16)       NOT NULL,  -- bonus | mission | sachet | carnet | relais | cran | serie | division
  cle       VARCHAR(40)       NOT NULL,  -- voir le tableau des clés ci-dessous
  saison_id INT UNSIGNED          NULL,
  echarpes  INT UNSIGNED      NOT NULL DEFAULT 0,
  packs     SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  xp        INT UNSIGNED      NOT NULL DEFAULT 0,
  tampons   SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  titre     VARCHAR(64)           NULL,  -- copié du palier qui le donne
  insigne   VARCHAR(16)           NULL,  -- lisere | tampon
  verse_a   DATETIME(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, source, cle),
  KEY k_recompenses_jour (user_id, verse_a),
  KEY k_recompenses_source (source, verse_a)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Le contrat du jour : les trois missions (rangs 0 à 2) et le sachet (rang 3),
-- avec leurs cibles et leurs gains COPIÉS au tirage (T9).
CREATE TABLE IF NOT EXISTS missions_jour (
  user_id   CHAR(36)          NOT NULL,
  jour      DATE              NOT NULL,          -- CURDATE(), écrit en SQL
  rang      TINYINT UNSIGNED  NOT NULL,          -- 0 facile, 1 moyenne, 2 difficile, 3 sachet
  mission   VARCHAR(24)       NOT NULL,          -- identifiant du catalogue, 'sachet' au rang 3
  cible     SMALLINT UNSIGNED NOT NULL,
  echarpes  SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  packs     TINYINT UNSIGNED  NOT NULL DEFAULT 0,
  xp        SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  tampons   TINYINT UNSIGNED  NOT NULL DEFAULT 0,
  saison_id INT UNSIGNED          NULL,          -- la saison en cours au tirage
  relancee  TINYINT UNSIGNED  NOT NULL DEFAULT 0,
  cree_a    DATETIME(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, jour, rang),
  CONSTRAINT fk_missions_user FOREIGN KEY (user_id) REFERENCES users(public_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ce qui n'a de ligne datée nulle part ailleurs : un booster ouvert, une
-- évolution. Écrit après la validation de l'action, jamais dedans.
CREATE TABLE IF NOT EXISTS compteurs_jour (
  user_id CHAR(36)     NOT NULL,
  jour    DATE         NOT NULL,
  cle     VARCHAR(16)  NOT NULL,                 -- booster | evolution
  n       INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, jour, cle),
  CONSTRAINT fk_compteurs_user FOREIGN KEY (user_id) REFERENCES users(public_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ce que le joueur n'a pas encore regardé. Écrit au moment du gain (M4) :
-- aucun rattrapage, donc rien à rejouer à chaque déploiement.
CREATE TABLE IF NOT EXISTS user_nouveautes (
  user_id CHAR(36)    NOT NULL,
  cle     VARCHAR(80) NOT NULL,                  -- fanzzy:RP4 | age:RP4:2 | etat:RP4:1:joie | skin:RP4:1:prehistorique | stuff:<id> | action:<id>
  sorte   VARCHAR(8)  NOT NULL,
  got_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, cle),
  KEY k_nouveautes_date (user_id, got_at),
  CONSTRAINT fk_nouveautes_user FOREIGN KEY (user_id) REFERENCES users(public_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- La saison datée. Un jour, pas un instant : c'est le jour de jeu.
ALTER TABLE saisons ADD COLUMN IF NOT EXISTS fin_le   DATE NULL;
ALTER TABLE saisons ADD COLUMN IF NOT EXISTS ouvre_le DATE NULL;
ALTER TABLE saisons ADD COLUMN IF NOT EXISTS carnet   JSON NULL;

-- Les photos de « ma ligne » (deux : celle du dernier jour vu avant
-- aujourd'hui, qui sert de référence, et celle d'aujourd'hui), la marque de
-- visite et l'état des pots de KOP à cette marque (pot et verse_total).
ALTER TABLE user_wallet ADD COLUMN IF NOT EXISTS rangs_vus  JSON        NULL;
ALTER TABLE user_wallet ADD COLUMN IF NOT EXISTS visite_a   DATETIME(3) NULL;
ALTER TABLE user_wallet ADD COLUMN IF NOT EXISTS instantane JSON        NULL;

-- Les chants au Virage, comptés dans l'upsert de présence qui existe.
ALTER TABLE virage_presence ADD COLUMN IF NOT EXISTS chants     INT UNSIGNED NOT NULL DEFAULT 0;
ALTER TABLE virage_presence ADD COLUMN IF NOT EXISTS chants_mt1 INT UNSIGNED NOT NULL DEFAULT 0;
ALTER TABLE virage_presence ADD COLUMN IF NOT EXISTS chants_mt2 INT UNSIGNED NOT NULL DEFAULT 0;
```

**Les clés du grand livre** (fermées ; `<jour>` est toujours écrit en SQL par
`DATE_FORMAT(CURDATE() - INTERVAL k DAY, '%Y-%m-%d')`) :

| source | cle | saison_id | écrite par |
|---|---|---|---|
| `bonus` | `<jour>` | saison en cours ou NULL | `quotidien` |
| `mission` | `<jour>:<rang>` | celle du contrat | `quotidien` |
| `sachet` | `<jour>` | celle du contrat | `quotidien` |
| `carnet` | `S<saison_id>:<n>` | la saison du palier | `quotidien` |
| `relais` | `S<saison_id de la nouvelle saison>` | la nouvelle saison | `quotidien` |
| `cran` | le seuil, en chiffres (`"75"`) | NULL | `fanzzy` |
| `serie` | l'identifiant de série (`"RP"`) | NULL | `fanzzy` |
| `division` | `S<saison_id>:<id de division>` (`"S1:fervent"`) ; gain toujours nul, la ligne porte l'insigne et le titre | la saison | `classement` |

Les tampons d'une saison sont `SUM(tampons) WHERE saison_id = ?` sur les
sources `mission` et `sachet`.

---

## 4. Les réglages : `src/shared/reglages.js`

Propriété du périmètre `socle`, qui pose **toutes** les clés de la vague d'un
coup. Trois sections nouvelles, ajoutées à `SECTIONS`. Types `entier` et
`booleen` seulement. Chaque texte d'aide qui parle d'un montant dit qu'un
changement vaut **pour le lendemain** quand il touche les missions (contrat
figé). Les identifiants de section : `quotidien`, `missions`, `saison`.

| clé | section | type | min–max | défaut | lu par |
|---|---|---|---|---|---|
| `bonus.actif` | quotidien | booléen | — | vrai | quotidien |
| `bonus.base` | quotidien | entier, écharpes | 0–200 | 20 | quotidien |
| `bonus.pas` | quotidien | entier, écharpes | 0–50 | 5 | quotidien |
| `bonus.j7_packs` | quotidien | entier, boosters | 0–3 | 1 | quotidien |
| `missions.actif` | quotidien | booléen | — | vrai | quotidien |
| `missions.relances` | quotidien | entier, relances | 0–3 | 1 | quotidien |
| `missions.facile_echarpes` | quotidien | entier, écharpes | 0–300 | 30 | quotidien |
| `missions.facile_xp` | quotidien | entier, XP | 0–200 | 20 | quotidien |
| `missions.moyenne_echarpes` | quotidien | entier, écharpes | 0–400 | 60 | quotidien |
| `missions.moyenne_xp` | quotidien | entier, XP | 0–300 | 40 | quotidien |
| `missions.difficile_echarpes` | quotidien | entier, écharpes | 0–600 | 100 | quotidien |
| `missions.difficile_xp` | quotidien | entier, XP | 0–400 | 60 | quotidien |
| `missions.sachet_packs` | quotidien | entier, boosters | 0–3 | 1 | quotidien |
| `quotidien.retour_heures` | quotidien | entier, heures | 1–48 | 3 | quotidien |
| `recompenses.plafond_echarpes_jour` | quotidien | entier, écharpes | 100–20000 | 2500 | socle (grand livre) |
| `recompenses.plafond_packs_jour` | quotidien | entier, boosters | 1–50 | 15 | socle (grand livre) |
| `mission.boosters` … `mission.ailleurs` (13 clés, une par identifiant du catalogue) | missions | booléen | — | vrai | quotidien |
| `saison.carnet_actif` | saison | booléen | — | vrai | quotidien |
| `saison.tampons_facile` | saison | entier, tampons | 0–10 | 1 | quotidien |
| `saison.tampons_moyenne` | saison | entier, tampons | 0–10 | 1 | quotidien |
| `saison.tampons_difficile` | saison | entier, tampons | 0–10 | 2 | quotidien |
| `saison.tampons_sachet` | saison | entier, tampons | 0–10 | 1 | quotidien |
| `saison.relais_packs` | saison | entier, boosters | 0–5 | 2 | quotidien |
| `saison.relais_seuil` | saison | entier, tampons | 0–1000 | 10 | quotidien |
| `collection.actif` | saison | booléen | — | vrai | fanzzy |
| `collection.cran` | saison | entier, objets | 5–200 | 25 | fanzzy |
| `collection.cran_echarpes` | saison | entier, écharpes | 0–300 | 25 | fanzzy |
| `collection.cran_booster_tous` | saison | entier, crans (0 = jamais) | 0–20 | 4 | fanzzy |
| `collection.serie_echarpes` | saison | entier, écharpes | 0–1000 | 100 | fanzzy |
| `collection.serie_packs` | saison | entier, boosters | 0–5 | 1 | fanzzy |
| `rang.actif` | saison | booléen | — | vrai | classement |
| `rang.habitue` | saison | entier, ferveur de saison | 0–100000000 | 5000 | classement (par `shared/saison.js`) |
| `rang.fervent` | saison | idem | idem | 30000 | idem |
| `rang.ultra` | saison | idem | idem | 100000 | idem |
| `rang.capo` | saison | idem | idem | 300000 | idem |

**Pas de réglage de gain pour les divisions** (relecture) : `rang.echarpes_par_cran`
et `rang.packs_par_cran` sont retirés. Un réglage qui permettrait de rendre
des écharpes ou des boosters aux divisions rouvrirait d'un geste ce que
`SERVEUR.md` § 6 ferme. `reglages-smoke` refuse toute clé `rang.*` dont
l'unité est en écharpes ou en boosters.

Textes d'aide à écrire (relecture) : `bonus.base`, `bonus.pas` et
`bonus.j7_packs` disent qu'un changement **vaut tout de suite** (le bonus se
calcule à la réclamation), à l'inverse des montants de mission. `xp.duel_entrainement`
et `xp.duel_classe` disent qu'à 0, les missions de duel qui comptent ces
parties sortent du tirage. Et, puisque `socle` tient le registre : l'unité des
cinq réglages `etal.*` passe de `billets` à `écharpes`, qui est la monnaie
réelle de l'étal (`src/shared/etal.js`, `boutique/index.js` l. 404-431).

Les treize bascules de mission : `mission.boosters`, `mission.duel`,
`mission.virage`, `mission.grandir`, `mission.tribune`, `mission.victoire`,
`mission.classes`, `mission.club_virage`, `mission.club_duel`,
`mission.victoires`, `mission.endurance`, `mission.mitemps`,
`mission.ailleurs`. Leur titre au registre est l'intitulé de la mission.

Un interrupteur coupé fait **deux** choses : plus rien de neuf (pas de tirage,
pas de palier proposé) **et** les réclamations de cette source refusent
(`inactif`). C'est un disjoncteur (T10). Ce qui était dû le redevient quand on
rallume, dans les délais de chaque source.

Les seuils de division ne sont pas contrôlés entre eux par le registre :
`shared/saison.js` les rend **monotones** (chacun vaut au moins le précédent)
avant de s'en servir.

---

## 5. Le grand livre : `src/server/recompenses.js`

Propriété du périmètre `socle`. Un module à la racine de `src/server`, comme
`bourse.js`. Tous les versements de la vague passent par lui, et par lui seul.

```js
/**
 * @param pool    le pool du serveur
 * @param o.userId
 * @param o.source   une valeur de SOURCES
 * @param o.cle      la clé du tableau du § 3
 * @param o.saisonId entier ou null
 * @param o.gain     { echarpes, packs, xp, tampons } — ou async (conn) => gain,
 *                   calculé DANS la transaction (le bonus en a besoin)
 * @param o.titre, o.insigne   copiés dans la ligne
 * @param o.verifier async (conn) => true | 'incomplet' | 'inconnu' | 'change' | 'jour_passe'
 *                   le recompte de l'appelant, DANS la transaction
 * @param o.niveau   le module niveau : son `gagnerDans(conn, userId, xp)`
 *                   crédite l'XP DANS la transaction (relecture)
 * @param o.recharger async (conn, userId) => void — la recharge des boosters
 *                   exportée par `fanzzy`, appelée sous le verrou avant de
 *                   créditer des boosters ; obligatoire si le gain peut en
 *                   porter (relecture)
 * @returns { verse: true, gain, wallet: { scarves, packs }, niveau? }
 *        | { verse: false, raison }
 */
export async function verser(pool, o) { … }

/** Plusieurs versements, chacun dans sa transaction, arrêtés au disjoncteur.
    Rend un seul `niveau`, agrégé comme le dit CONTRATS.md R6. */
export async function verserTout(pool, liste, { niveau, recharger }) { … }   // → { verse, gain, reste, niveau? }

export const SOURCES = ['bonus', 'mission', 'sachet', 'carnet', 'relais', 'cran', 'serie', 'division'];
```

Le déroulé, dans **une** transaction (ordre revu à la relecture) :

1. `assurerBourse`, puis `SELECT scarves, packs FROM user_wallet WHERE user_id = ? FOR UPDATE` :
   tous les versements d'un même joueur passent l'un après l'autre. **Tout
   chemin qui touche aux lignes du jour (la relance comprise) prend ce verrou
   en premier**, pour que les verrous se prennent toujours dans le même ordre.
2. La clé existe déjà dans `recompenses` (`SELECT 1 … WHERE user_id, source,
   cle`) : annulation, `deja`. **Avant** le disjoncteur : sinon un élément
   déjà versé, un jour de plafond, répondrait « tu récupéreras demain » pour
   une chose qui ne viendra jamais.
3. `verifier(conn)` si fourni : autre chose que `true` annule et rend la
   raison.
4. Le gain, s'il est une fonction, est calculé maintenant.
5. Le disjoncteur : `SUM(echarpes)`, `SUM(packs)` du joueur avec
   `verse_a >= CURDATE()`. Dépasser l'un des deux plafonds annule (`plafond`).
6. `INSERT INTO recompenses …` **simple** (pas `INSERT IGNORE`, qui avalerait
   aussi une troncature). `ER_DUP_ENTRY` (la course que l'étape 2 n'a pas pu
   voir) annule et rend `deja`.
7. Si le gain porte des boosters : `recharger(conn, userId)`, **puis**
   `UPDATE user_wallet SET scarves = scarves + ?, packs = packs + ?`. Un
   booster offert entre dans la réserve **même au-dessus du plafond**, mais
   après la recharge due. Sans cela, `wallet()` (`fanzzy/index.js` l. 197-212)
   remet `packs_at` à maintenant dès que la réserve est pleine, et le cadeau
   efface la recharge en cours.
8. Si le gain porte de l'XP : `niveau.gagnerDans(conn, userId, xp)`, sur la
   même connexion, qui tient déjà le verrou. Une erreur annule **tout** le
   versement : une ligne qui dit « 20 XP » sans l'XP ne se rattraperait
   jamais, sa clé interdisant de la reverser.
9. `COMMIT`. Le `niveau` rendu suit `CONTRATS.md` § 1.

`ER_NO_SUCH_TABLE` ou `ER_BAD_FIELD_ERROR` : annulation, `{ verse: false,
raison: 'schema' }`, et un journal qui nomme le fichier à appliquer. Jamais de
versement sans sa ligne (M2). Et si le contrôle de démarrage n'a pas trouvé la
bonne clé primaire à `recompenses` (§ 6.1), `verser` refuse aussi (`schema`) :
une table sans sa clé, c'est l'idempotence qui manque (M3).

Le module ne reçoit **ni** `abonnement`, **ni** `kop`, **ni** `amis` (L1, T7).
`recharger` vient de `fanzzy`, qui lit l'abonnement pour la cadence de
recharge comme il le fait déjà : le grand livre, lui, ne sait toujours pas qui
est abonné, et aucun montant n'en dépend.

---

## 6. Les périmètres

Neuf périmètres, aux fichiers **disjoints**. Leur clé est courte, fermée, et
c'est elle qui aiguille les constats et les corrections :

**`socle` · `niveau` · `duel` · `fanzzy` · `saison` · `classement` · `social`
· `virage` · `quotidien`**

Un fichier qui n'est dans aucune liste ne se touche pas dans cette vague. En
particulier, **aucun fichier de `public/`**, sauf `public/admin.html` (onglet
Saisons seulement, périmètre `saison`).

### 6.1 `socle` — le schéma, le registre, le grand livre, l'outillage

- **Fichiers** : `sql/quotidien.sql` (neuf), `scripts/ordre-schema.mjs`,
  `src/shared/reglages.js`, `src/server/recompenses.js` (neuf),
  `src/server/auth/schema.js`, `src/server/auth/store.js`,
  `scripts/base-de-test.mjs`, `scripts/recompenses-smoke.mjs` (neuf),
  `scripts/schema-smoke.mjs`, `scripts/reglages-smoke.mjs`,
  `scripts/abonnement-smoke.mjs`, `scripts/securite.mjs`,
  `scripts/auth-smoke.mjs`, `package.json`, `DEPLOIEMENT.md`,
  `A-DEPLOYER.md`, `CONFIDENTIALITE.md`, `JURIDIQUE.md`.
- **Fait** :
  - le fichier SQL du § 3, inscrit en dernier dans `ORDRE` avec sa raison ;
  - toutes les clés du § 4 ;
  - le grand livre du § 5 ;
  - au démarrage, `schema.js` contrôle aussi la **clé primaire** de
    `recompenses` (`SHOW KEYS … WHERE Key_name = 'PRIMARY'` doit rendre
    `user_id, source, cle`), sinon il le dit en nommant le fichier **et ferme
    les versements** : `recompenses.js` lit ce résultat et rend `schema` (M3) ;
  - `deleteUser` supprime les lignes du joueur dans `user_nouveautes`,
    `missions_jour`, `compteurs_jour`, et remet à NULL `rangs_vus`,
    `visite_a`, `instantane` ; le grand livre reste (M8). **Attention à
    l'identifiant** (relecture) : `deleteUser(userId)` reçoit `users.id`
    (`auth/store.js` l. 101, `WHERE id = ?`), alors que les tables neuves sont
    clées sur `public_id`. Les suppressions passent donc par
    `user_id = (SELECT public_id FROM users WHERE id = ?)` ;
  - dans `base-de-test.mjs`, deux aides : `figerHorloge(pool, instant | null)`
    (pose `SET @@session.timestamp` sur chaque connexion prise par le pool de
    la suite, et la relâche) et `enParallele(n, fn)` ;
  - `package.json` : `recompenses:smoke` et `quotidien:smoke` (le fichier de
    la seconde est écrit par `quotidien`) ;
  - les documents : `DEPLOIEMENT.md` et `A-DEPLOYER.md` nomment
    `sql/quotidien.sql` et la manœuvre après un passage par le Manager
    (`npm run schema:appliquer`, **puis un redémarrage**) ; `CONFIDENTIALITE.md`
    dit ce qui devient public (Fanzzy affiché, niveau, division) et ce qui est
    conservé (dernière visite, gains quotidiens, et l'activité du jour :
    boosters ouverts, évolutions, missions tirées, gardées 400 jours) (V5) ;
    `JURIDIQUE.md` ajoute les points du § 11.7 de `SERVEUR.md` comme
    **questions**, pas comme avis, et **corrige un fait** : l'abonnement livre
    1 booster (mensuel) ou 6 (annuel) à l'échéance (`src/shared/boutique.js`
    l. 104-151, décision de Gaël écrite dans le code), alors que le dossier dit
    aujourd'hui qu'« un booster ne s'achète pas avec de l'argent réel » et
    qu'il n'existe « aucun autre article payant ». Le dossier décrit ce qui est
    vendu ; il ne tranche rien. Dans `DEPLOIEMENT.md`, la requête de détection
    en lecture seule :
    `SELECT DATE(verse_a) AS jour, source, COUNT(*), SUM(echarpes), SUM(packs) FROM recompenses GROUP BY jour, source ORDER BY jour DESC;`
- **Tests** :
  - `recompenses-smoke` : un versement crédite **exactement** le gain ;
    `Promise.all` de deux puis dix versements identiques → un seul crédit ;
    disjoncteur atteint → `plafond`, bourse inchangée ; **un élément déjà versé,
    disjoncteur atteint → `deja`, pas `plafond`** ; table supprimée →
    `schema`, bourse inchangée sur dix essais ; réserve pleine + 1 booster →
    réserve au-dessus du plafond ; **réserve à 11 sur 12, une recharge due
    (`packs_at` daté d'une cadence et une seconde), 1 booster offert → 13, et
    non 12** ; `verifier` qui refuse → rien d'écrit ; XP versée une fois ;
    **colonne `xp` supprimée → `schema`, ni écharpes ni ligne au grand livre**
    (l'XP est dans la transaction) ; clé primaire retirée de la table →
    `schema` au démarrage suivant.
  - `schema-smoke` : clé primaire de `recompenses`, `missions_jour`,
    `compteurs_jour`, `user_nouveautes` lue dans
    `information_schema.statistics` ; le fichier appliqué **deux fois** donne
    le même état ; dans `sql/quotidien.sql`, chaque `ALTER TABLE` porte
    **un seul** `ADD COLUMN`.
  - `reglages-smoke` : les trois sections existent ; chaque clé neuve est dans
    une section déclarée ; chaque source a son interrupteur ; aucun type
    `liste` au registre ; **aucune clé `rang.*` dont l'unité est en écharpes
    ou en boosters** ; aucune unité `billets` au registre.
  - `abonnement-smoke` : `interdits` gagne `quotidien.`, `missions.`,
    `mission.`, `bonus.`, `saison.`, `collection.`, `rang.`, `recompenses.`
    (L1).
  - `securite` : invariant nouveau, aucun
    `req.(body|query|params).(montant|echarpes|scarves|xp|packs|gain|tampons)`
    dans `src/server/` (T1), doublé du contrôle de comportement de
    `quotidien` ; aucune écriture de `billets` hors de `src/server/boutique/`
    (L7).
  - `auth-smoke` : un compte supprimé **par la vraie route** (qui passe
    `users.id`) ne laisse aucune ligne à son nom dans les trois tables, lignes
    semées sous son `public_id`, et ses lignes de `recompenses` restent.
    Mutation : supprimer `WHERE user_id = ?` avec `users.id` ; le contrôle
    rougit.
  - Le contrôle du contrôle de l'horloge figée : `SELECT NOW()` rend l'instant
    figé, sur deux connexions différentes du pool.
- **Mutations** : `INSERT IGNORE` sans lecture d'`affectedRows` (dix
  versements → dix crédits) ; retirer la clé primaire du `CREATE TABLE` ;
  sortir l'`INSERT` de la transaction ; sauter le disjoncteur ; verser malgré
  l'erreur de schéma ; deux `ADD COLUMN` dans un `ALTER` ; **placer le
  disjoncteur avant le contrôle de clé** (`plafond` rendu pour un déjà-versé) ;
  **retirer l'appel à `recharger`** (12 au lieu de 13) ; **créditer l'XP
  après le `COMMIT`** (la colonne supprimée laisse alors une ligne au grand
  livre).
- **Dépend de** : la **signature** de `niveau.gagnerDans(conn, userId, xp)` et
  de `fanzzy.recharger(conn, userId)` (relecture). Le socle code contre elles
  et éprouve `verser` avec deux doublures fidèles ; les vraies arrivent avec
  `niveau` et `fanzzy`, et la suite se relance alors avec elles.
- **Livre aux autres** : les tables, les clés de réglage, `verser()`,
  `figerHorloge`, `enParallele`. **À livrer en premier.**

### 6.2 `niveau` — un gain d'XP atomique, et la jauge dans le résultat

- **Fichiers** : `src/server/niveau/index.js`, `scripts/niveau-smoke.mjs`.
- **Fait** :
  - E2 : `gagner()` dans une transaction, `SELECT xp … FOR UPDATE`, les
    paliers calculés sur la valeur verrouillée, puis `UPDATE` et `COMMIT` ;
  - point 1 : `gagner()` rend en plus `gain`, `dans`, `pour`, `part`, `max`
    (par `progression(xpApres)`, fonction pure, zéro requête) et `depart`
    (`{ xp: avantXp, ...progression(avantXp) }`), forme de `CONTRATS.md` § 1 ;
  - un crochet de test, `createNiveau({ …, crochets: { apresLecture } })`,
    appelé entre la lecture et l'écriture, pour éprouver la concurrence de
    façon **déterministe** ;
  - **`gagnerDans(conn, userId, montant)`** (relecture) : le même calcul que
    `gagner()`, sur la connexion de l'appelant, **sans** transaction à lui ni
    `try` qui avale : il lève, et l'appelant annule. C'est la porte du grand
    livre, qui tient déjà le verrou de la ligne `user_wallet`. `gagner()`
    l'enveloppe (sa transaction, son `FOR UPDATE`, son filet) pour les
    boosters et les duels : une seule règle de calcul, deux façons de
    l'appeler.
- **Tables** : `user_wallet` (inchangée).
- **Tests** : à xp = 50, deux `+20` simultanés → **+20** écharpes de palier et
  xp = 90 ; à xp = 45, deux `+10` → le palier du niveau 2 versé une fois ;
  `gain`, `dans`, `pour`, `part`, `depart` exacts sur trois cas (milieu de
  niveau, montée, niveau 30) ; une colonne absente rend toujours l'objet vide
  sans lever **par `gagner()`**, et **lève par `gagnerDans()`** ;
  `gagnerDans` dans une transaction annulée ne laisse ni XP ni écharpes de
  palier.
- **Mutations** : retirer le `FOR UPDATE` (le crochet rend la faute certaine,
  pas probable) ; calculer `depart` sur l'XP d'après ; faire avaler l'erreur
  à `gagnerDans` (le versement passe sans XP, et la suite du socle rougit).
- **Dépend de** : rien. **Livre** la forme `niveau` à `duel`, `fanzzy`,
  `quotidien` et au grand livre, et **la signature de `gagnerDans` au socle,
  en tête** (relecture).

### 6.3 `duel` — un duel ne se ferme qu'une fois, et son bilan dit tout

- **Fichiers** : `src/server/nvn/index.js`, `scripts/nvn-smoke.mjs`,
  `scripts/nvn-net-smoke.mjs`.
- **Fait** :
  - E1 : garde **synchrone** en tête de `fermer`, avant le premier `await`
    (`if (salle.fermee) return; salle.fermee = true;`), et retrait de l'appel
    en double dans le gestionnaire `nvn:forfait` ; `fermer` exposé aux suites
    seulement (`pourLesTests.fermer`) ;
  - point 1 : `gains.niveau` posé **toujours** quand `gagner()` a crédité
    (`gains.montee` reste tel quel pour `niveau-fete.js`) ;
  - point 4 : la lecture des cotes et `coteApres` passent **avant** l'émission
    de `nvn:fin` ; `gains.cote = { avant, apres, delta }` pour un duel classé
    entre humains ; l'`INSERT` de `duel_results` réemploie ces valeurs ;
  - P7 : la lecture des cotes ne relit plus tout l'historique (dernière ligne
    classée par joueur, plus un `COUNT(*)` pour le coefficient).
- **Tables** : lit et écrit `duel_results` (inchangée).
- **Tests** : `fermer` appelé deux fois de suite → un seul versement (écharpes,
  XP, pot) ; chemin du forfait dans `nvn-net-smoke` : le solde du joueur resté
  monte **exactement** de `gains.echarpes`, l'XP exactement de `gains.xp`,
  chaque socket reçoit **un** `nvn:fin` ; `gains.niveau` présent sans montée ;
  `gains.cote.avant/apres` égaux à `elo_before/elo_after` de la ligne écrite ;
  `gains.cote` absent à l'entraînement ; la cote d'un joueur à vingt parties
  classées est juste (même coefficient qu'avant P7).
- **Mutations** : retirer la garde ; émettre `nvn:fin` avant le calcul de la
  cote ; remettre la lecture sans limite et comparer le coefficient.
- **Dépend de** : `niveau` (forme de l'objet). Ne dépend pas du schéma.

### 6.4 `fanzzy` — la recharge, les nouveautés, les compteurs, les crans

- **Fichiers** : `src/server/fanzzy/index.js`, `scripts/fanzzy-smoke.mjs`,
  `scripts/collection-smoke.mjs`, `scripts/boutique-smoke.mjs`.
  **`src/server/boutique/index.js` n'en fait plus partie** (relecture) : l'étal
  appelle déjà `fanzzy.remettreStuff` et `fanzzy.remettreTenue` avec sa
  connexion (`boutique/index.js` l. 414-418), et la nouveauté s'écrit là,
  dans `fanzzy/index.js`.
- **Fait** :
  - E3 : la recharge ne peut plus écraser un débit, et elle devient une
    fonction **exportée**, `recharger(conn, userId)`, qui travaille sur la
    connexion qu'on lui donne (écriture conditionnelle
    `… WHERE user_id = ? AND packs = ? AND packs_at = ?` et relecture si rien
    n'a bougé, ou recharge sous le `FOR UPDATE` de l'appelant). `wallet()` et
    `openPack` s'en servent, et le grand livre l'appelle avant de créditer un
    booster offert (§ 5, étape 7). Elle lit l'abonnement pour la cadence et le
    plafond, comme `wallet()` le fait aujourd'hui ; **à livrer en tête**,
    signature comprise, au socle et à `quotidien` ;
  - point 2 : après la validation d'`openPack`, un seul `INSERT IGNORE` des
    nouveautés (cartes `new: true`, formats de `CONTRATS.md` § 2.1) ; `evolve`
    écrit `age:<lignée>:<stade>` ; `remettreStuff` et `remettreTenue` écrivent
    la pièce ou la tenue achetée à l'étal, **dans** la transaction de l'étal
    (si le débit échoue, la nouveauté part avec le `rollback`), sous un `try`
    qui ne laisse passer que `ER_NO_SUCH_TABLE` : une instruction qui échoue
    n'annule pas la transaction, l'achat se fait sans sa nouveauté.
    `onboarding` (le premier Fanzzy, choisi par le joueur) et `offrir` (que
    rien n'appelle) n'en écrivent pas, et la liste exportée le dit avec sa
    raison.
    `nouveautes` dans `GET /state` (les 200 plus récentes, purge par joueur
    au-delà de 60 jours, faite à la lecture quand elle en trouve) ;
    `POST /api/fanzzy/vu` ; `cle` sur chaque carte du booster ; la liste des
    chemins qui écrivent une nouveauté est **exportée** par le module, pour que
    la suite l'importe au lieu de la lire au motif (M4) ;
  - `series` dans la réponse du booster (calcul en mémoire sur `avant` et
    `had`, zéro requête) ;
  - les compteurs du jour : après validation, `INSERT … ON DUPLICATE KEY
    UPDATE n = n + 1` dans `compteurs_jour`, clé `booster` à l'ouverture,
    `evolution` à l'évolution, jour `CURDATE()` ;
  - point 5 (collection) : `paliers` dans `GET /bibliotheque` (une lecture de
    `recompenses` en plus, sources `cran` et `serie`) ; `POST
    /api/fanzzy/palier` qui recompte la bibliothèque **dans** `verifier` et
    verse par le grand livre, avec `recharger` (un cran sur quatre et la série
    complète portent un booster) ; règle « au plus haut seuil payé » ;
  - `/dex` : `prochaine` et `sets[].prochaine`, lus sur `saisonProchaine()` de
    `saisons.js`.
- **Tables** : écrit `user_nouveautes`, `compteurs_jour`, `recompenses` (par
  `verser`) ; lit `recompenses`.
- **Routes** : `POST /api/fanzzy/vu`, `POST /api/fanzzy/palier` ; champs
  nouveaux de `/state`, `/open`, `/bibliotheque`, `/dex`.
- **Réglages lus** : `collection.*`.
- **Tests** :
  - E3 : réserve à 0, `packs_at` daté d'une cadence plus une seconde, dix
    `POST /open` en parallèle → **une** ouverture, neuf
    `fanzzy.error.no_packs`, réserve à 0 ;
  - `recharger(conn, …)` dans une transaction annulée ne laisse rien ; à 11
    sur 12 avec une recharge due, `recharger` puis `+1` donne 13 (le même
    contrôle que le socle, mais avec la vraie fonction) ;
  - l'étal : une tenue achetée écrit sa nouveauté ; écharpes insuffisantes →
    ni tenue ni nouveauté ;
  - une nouveauté par carte neuve de chaque sorte, aucune pour un doublon ;
    chaque chemin de la liste exportée écrit sa nouveauté ; `vu` sous ses trois
    formes ; plafond de 200 ;
  - une ouverture fait `compteurs_jour.booster` + 1, une évolution
    `evolution` + 1 ; sans la table, l'ouverture réussit quand même et le
    journal nomme le fichier ;
  - `series` : `avant`, `apres`, `total` exacts, `complete` vrai une seule
    fois ;
  - crans : un joueur à 63 objets avec 25 et 50 payés n'a rien à réclamer ;
    `collection.cran` passé à 20 → seul 60 est payable ; le compte qui baisse ne
    reprend rien ; deux réclamations simultanées → un versement ;
    interrupteur coupé → `inactif` ;
  - semer **la seule série RP lancée** dans `saisons`, pour reproduire la
    production (sans saison, le code tourne tout ouvert et les crans
    paraissent lointains).
- **Mutations** : remettre l'écriture absolue de la recharge ; oublier la
  nouveauté de l'étal ; payer chaque multiple sans tenir compte du plus haut
  payé ; écrire le compteur dans la transaction de l'ouverture (la table
  absente doit alors faire échouer l'ouverture, et le test le voir).
- **Dépend de** : `socle` (tables, réglages, `verser`) ; `saison`
  (`saisonProchaine`) ; `niveau` (forme `niveau` du booster, déjà servie).
  **Livre** `recharger(conn, userId)` au socle et à `quotidien`, en tête
  (relecture).

### 6.5 `saison` — la saison datée, le carnet, les divisions

- **Fichiers** : `src/shared/saison.js` (neuf), `src/server/fanzzy/saisons.js`,
  `src/server/admin/index.js` (fonctions des saisons seulement),
  `public/admin.html` (onglet Saisons seulement), `scripts/admin-smoke.mjs`,
  `scripts/admin-ui-smoke.mjs`.
- **Fait** :
  - `src/shared/saison.js`, pur : `CARNET_DEFAUT` (la saison 1 de
    `SERVEUR.md` § 5), `validerCarnet(json)` (1 à 8 paliers, seuils
    strictement croissants, `echarpes` ≤ 2000, `packs` ≤ 10, `nom` ≤ 40
    caractères, `insigne` ∈ `lisere` \| `tampon`, `titre` booléen qui fait du
    nom un titre ; lève en nommant le défaut), `carnetDe(saison)`,
    `DIVISIONS` (`sympathisant`, `habitue`, `fervent`, `ultra`, `capo`, avec
    leurs noms), `seuilsDivisions()` (lus par `reglage()`, rendus monotones),
    `divisionPour(ferveur)`, `titreDivision(n, numero)` (« Capo de la saison
    N » pour `n = 5`). **Pas de `gainDivision`** (relecture) : une division
    verse le gain nul de R5, écrit en dur à un seul endroit, pour qu'aucun
    réglage ne puisse lui rendre des écharpes ou des boosters ;
    `finDeFenetre(saison)` : la fin de la fenêtre d'une saison est la fin de
    son jour `fin_le`, **ou le lancement de la saison suivante s'il vient
    avant, ou s'il n'y a pas de `fin_le`**. Classement « saison », divisions,
    `saisonPassee` et missions (`saison_id`) lisent tous cette même borne,
    écrite en SQL ;
  - `saisons.js` : lit `fin_le`, `ouvre_le`, `carnet` ; les durées partent du
    SQL au chargement (`UNIX_TIMESTAMP(fin_le + INTERVAL 1 DAY) -
    UNIX_TIMESTAMP(NOW(3))`, idem pour `ouvre_le`) et s'ajustent du temps écoulé
    mesuré par Node : aucune date ne traverse le pilote ; `saisonEnCours()`
    rend un objet frais avec `fin`, `finDansMs`, `joursRestants`, `finie`
    (`CONTRATS.md` § 7.1) ; `saisonProchaine()` (§ 7.2) ; sur une base sans
    les colonnes, retombe sur `SELECT *` et sert la saison sans date ;
  - l'administration : création et modification acceptent `fin_le` et
    `ouvre_le` (`AAAA-MM-JJ` validés, ou vides) et `carnet` (JSON validé par
    `validerCarnet`, ou vide pour le carnet par défaut) ; le journal
    d'administration les inscrit ; l'onglet Saisons gagne deux champs date et
    une zone de texte pour le carnet, préremplie du carnet par défaut.
    **Le carnet d'une saison se fige au premier palier versé** (relecture) :
    dès qu'une ligne `carnet` existe au grand livre pour `S<id>`, la
    modification est refusée avec un message qui le dit
    (`admin.error.carnet_fige`). Avant, il reste modifiable : c'est ce qui
    permet de recaler le carnet de la saison 1 si la mise en ligne passe le
    19 octobre (`SERVEUR.md` § 5).
- **Tables** : `saisons` (colonnes du socle).
- **Tests** (`admin-smoke`) : une date mal formée ou impossible (`2026-02-30`)
  refusée avec un message qui la nomme ; un carnet aux seuils décroissants
  refusé ; horloge de la base figée au 2026-10-25 à 00:30 et fin au 2026-10-25
  → `finDansMs` = 88 200 000 à la seconde près ; `finie` vrai le lendemain ;
  `prochaine` présente jusqu'à la fin du jour annoncé, absente le lendemain ;
  `sets[].prochaine` sur les seules séries de la saison annoncée ; la suite
  repasse sous `TZ=America/Montreal` et reste verte (J5) ; **une saison 1 sans
  `fin_le`, puis une saison 2 lancée : la fenêtre de la 1 s'arrête au
  lancement de la 2** ; **un carnet modifié après un palier versé → refusé,
  avant → accepté** ; les saisons rechargées après chaque changement de
  l'horloge figée (`saisons.js` calcule ses durées au chargement).
- **Mutations** : `TIMESTAMPDIFF` à la place d'`UNIX_TIMESTAMP` (le 25 octobre
  rougit) ; la fin relue par le pilote en objet `Date` (le passage sous
  Montréal rougit) ; un carnet non validé ; `finDeFenetre` qui ignore le
  lancement suivant ; retirer le verrou du carnet.
- **Dépend de** : `socle` (colonnes, réglages `rang.*`). **Livre**
  `src/shared/saison.js` à `classement` et `quotidien`, `saisonProchaine()` à
  `fanzzy` : **à livrer en tête**, avant le reste de son travail.

### 6.6 `classement` — les avatars, la fenêtre de saison, les divisions

- **Fichiers** : `src/server/classements/index.js`,
  `src/server/fanzzy/avatar.js`, `scripts/classement-smoke.mjs`.
- **Fait** :
  - `habillerJoueurs(q, ids)` dans `avatar.js` : une lecture de `user_wallet`
    jointe à `users.status` pour toute la liste (`active_fanzzy`,
    `active_evo`, `active_etat`, `xp`), puis `avatarsDe`, et rend
    `Map(id → { avatar, niveau })` avec l'avatar en **liste blanche**
    (`CONTRATS.md` § 3) ; un compte qui n'est pas `active` rend
    `avatar: null` sans `niveau` (relecture : `kop.etat()` liste les membres
    sans filtrer les comptes supprimés) ; trois requêtes quel que soit le
    nombre de lignes ;
  - point 3 : `avatar` et `niveau` posés **dans** les mémos de `supporters`,
    `duellistes`, `assidus`, `joueursDe` ; comptes actifs seulement ; le mémo
    garde la **promesse** et non la valeur, pour qu'un seul calcul tourne à
    l'expiration (P3) ;
  - E6 : `periode=saison` compte de `lancee_a` de la saison en cours jusqu'à la
    fin de `fin_le`, en SQL ; `periode=toujours` sert l'ancien cumul ; sans
    table ou sans colonne, repli sans fenêtre, journalisé ;
  - point 4 : `evolution` dans `/moi`, par `user_wallet.rangs_vus` (au plus une
    écriture par jour de jeu et par joueur, jour lu en SQL). **Deux photos**
    (relecture) : `{ ref: { jour, rangs }, jour: { jour, rangs } }`. À la
    première lecture d'un nouveau jour, `jour` passe en `ref` et la photo du
    jour s'écrit ; l'évolution compare toujours à `ref`. Avec une seule photo,
    toute lecture après la première du jour comparerait à elle-même ;
  - **ma ligne sous SAISON** (relecture) : `saison.rang` et `saison.sur`,
    calculés sur la même fenêtre que `supporters?periode=saison`, avec les
    mêmes requêtes de rang que `maPlace` ; `evolution.ferveur` compare ce
    rang-là. Les `rang`, `sur` et `ferveur` de la racine de `/moi` gardent leur
    sens (tous les temps) : le profil les lit déjà ;
  - point 5 (rang) : `saison` et `saisonPassee` dans `/moi` ; `division` sur les
    lignes de `supporters?periode=saison` ; `POST /api/rank/division`, qui
    recompte la ferveur de saison dans `verifier` et inscrit au grand livre
    **un gain nul**, l'insigne et, pour Capo, le titre ; `titres` dans `/moi`,
    lus dans `recompenses`. `saisonPassee` : la plus récente des saisons finies
    qui a encore une division `pret`, et elle seule ;
  - **budget de `/moi`** (relecture) : il fait déjà neuf requêtes ; la vague en
    ajoute **quatre au plus** (ferveur de la saison en cours et de la
    précédente en une requête filtrée par joueur, rang et effectif de la
    saison, titres et divisions versées en une lecture du grand livre),
    plus une écriture de photo par jour. `/moi` reste hors du hub et de la
    barre.
- **Tables** : lit `virage_presence`, `duel_results`, `saisons`,
  `recompenses` ; écrit `user_wallet.rangs_vus`, `recompenses` (par `verser`).
- **Réglages lus** : `rang.*` (par `shared/saison.js`).
- **Tests** : une ligne ne porte que les clés de la liste blanche ; un compte
  supprimé n'apparaît pas ; le nombre de requêtes est le même pour 5 et pour
  50 lignes ; dix lectures simultanées après expiration → un seul calcul ; une
  ligne semée avant `lancee_a` (`NOW(3) - INTERVAL 2 DAY`, en SQL) ne compte
  pas pour `saison` et compte pour `toujours` ; `division` et `prochaine`
  exacts autour des seuils ; seuils non monotones rendus monotones ; deux
  réclamations simultanées → une ligne ; une division récupérée puis
  « perdue » en ferveur reste acquise ; **une division réclamée ne change ni
  les écharpes ni la réserve, pour un abonné comme pour un gratuit** ;
  `evolution` absente le premier jour, exacte le lendemain (horloge figée),
  une seule écriture pour deux lectures le même jour, **et la même évolution
  rendue par ces deux lectures** ; **`saison.rang` égale la position du
  joueur dans `supporters?periode=saison`** (une ligne semée avant
  `lancee_a` change `rang` à la racine, pas `saison.rang`) ;
  **`saisonPassee` : deux saisons finies avec chacune une division `pret`, la
  plus récente seule est servie** ; le budget de `/moi` mesuré au pool
  instrumenté.
- **Mutations** : `depuis('saison')` qui rend de nouveau une chaîne vide ;
  `avatarsDe` ligne à ligne ; le mémo qui garde la valeur ; un champ hors
  liste blanche (`tenuesParAge`) ; payer une division sans `verifier` ;
  **une seule photo dans `rangs_vus`** (la deuxième lecture du jour rend
  zéro) ; **`saison.rang` calculé sans la fenêtre** ; **un gain de division
  non nul**.
- **Dépend de** : `socle`, `saison` (`shared/saison.js`). **Livre**
  `habillerJoueurs` à `social` : **à livrer en tête**.

### 6.7 `social` — le KOP et les amis

- **Fichiers** : `src/server/kop/index.js`, `src/server/amis/index.js`,
  `scripts/kop-smoke.mjs`, `scripts/amis-smoke.mjs`.
- **Fait** :
  - point 3 : `avatar` et `niveau` sur `membres[]` de `etat()`, par
    `habillerJoueurs`, la carte des avatars d'un KOP mémorisée **60 s** (la
    page relit l'état toutes les 30 s) ; `niveau` chez les amis par `w.xp`
    ajouté aux `SELECT` existants (zéro requête de plus) ;
  - E4 : le dépouillement ne débite le pot et n'inscrit le bonus que si
    l'`UPDATE … WHERE issue = 'en_cours'` a touché une ligne, dans une
    transaction ;
  - E5 : `fermeDansMs` calculé en SQL
    (`GREATEST(0, UNIX_TIMESTAMP(ferme) - UNIX_TIMESTAMP(NOW(3))) * 1000`), et la
    garde de `voter()` en SQL (`… AND ferme > NOW(3)`) : le chrono du vote en
    case de BD du lot 5 en dépend ;
  - C6 : `modsDe` ignore un bonus de portée `saison` acheté avant le lancement
    de la saison en cours, ou dont la saison est finie (`CURDATE() > fin_le`),
    en SQL ; sans les colonnes, comportement d'avant.
- **Tables** : lit `saisons` ; écrit `kops`, `kop_votes`, `kop_bonus`
  (inchangées).
- **Tests** : cinq `etat()` simultanés après l'échéance d'un vote adopté → pot
  débité **une** fois, **une** ligne `kop_bonus` ; juste après `proposer()`,
  `fermeDansMs` entre 170 000 et 180 000 (la suite tourne aussi sous
  `TZ=America/Montreal`) ; un vote après clôture refusé ; un bonus de saison
  acheté avant `lancee_a` (semé en SQL) n'agit pas, un bonus acheté après agit,
  et n'agit plus le lendemain de `fin_le` ; `membres[]` porte `avatar` et
  `niveau` ; **un membre dont le compte a été supprimé garde sa ligne avec
  `avatar: null` et sans `niveau`** ; un non-membre lit la page sans aucun
  champ de présence ; le niveau des amis est exact.
- **Mutations** : ignorer `affectedRows` au dépouillement ; remettre
  `new Date(vote.ferme) - Date.now()` ; retirer la condition de saison.
- **Dépend de** : `classement` (`habillerJoueurs`), `socle` (colonne `fin_le`).

### 6.8 `virage` — compter les chants, sans requête de plus

- **Fichiers** : `src/server/ferveur/virage.js`,
  `src/server/souvenirs/index.js`, `scripts/virage-smoke.mjs`,
  `scripts/souvenirs-smoke.mjs`.
- **Fait** :
  - `chant()` appelle `crediter(…, { chant: true })` ; une carte d'action ne
    le fait pas ;
  - `onPush` transporte `chant` (0 ou 1) et `mt` (1 si `statut` vaut `1H`, 2
    s'il vaut `2H`, 0 sinon) ;
  - `recordPush` ajoute `chants`, `chants_mt1`, `chants_mt2` **dans l'upsert
    qui existe** (une seule instruction par poussée, P8) ;
  - sur `ER_BAD_FIELD_ERROR` (schéma pas encore appliqué), `recordPush`
    retombe sur l'instruction d'avant et le journal le dit une fois : la
    présence ne doit **jamais** se perdre pour un compteur. **Le repli expire
    au bout de dix minutes** (relecture), et l'instruction complète est
    retentée : sinon, après un passage par le Manager suivi de
    `npm run schema:appliquer` sans redémarrage, le processus ne compterait
    plus jamais un chant, et les missions du Virage resteraient à 0 sans un
    mot. Au pire, une instruction en échec toutes les dix minutes, jamais deux
    par poussée.
- **Tables** : `virage_presence` (colonnes du socle).
- **Tests** : un chant → `chants` + 1 et la bonne mi-temps + 1 ; une carte
  jouée → `chants` inchangé, ferveur créditée comme avant ; **une** requête par
  poussée (pool instrumenté) ; colonnes supprimées → la présence s'écrit
  toujours ; **colonnes rajoutées pendant que le module tourne, horloge du
  repli avancée de dix minutes → les chants se comptent de nouveau, sans
  remonter le module**.
- **Mutations** : une seconde instruction par poussée ; compter la carte comme
  un chant ; supprimer le repli (la présence se perd sans les colonnes) ;
  **un repli sans expiration** (le dernier contrôle rougit).
- **Dépend de** : `socle` (colonnes).
- **À ne pas faire ici** : le verdict partagé, `parfaits`, `meilleur`,
  `serie_max`, le bilan (lot 6). Ne pas toucher `src/server/nvn/engine.js`
  (`niveau-smoke` y refuse le mot « niveau »).

### 6.9 `quotidien` — les missions, le sachet, la carte, le carnet, le ticket

- **Fichiers** : `src/server/quotidien/index.js` (neuf ; le dossier peut se
  découper en `missions.js`, `depuis.js`), `src/shared/quotidien.js` (neuf),
  `server.js`, `scripts/verif-cablage.mjs`, `scripts/quotidien-smoke.mjs`
  (neuf).
- **Fait** :
  - `src/shared/quotidien.js`, pur : le catalogue des treize missions (`id`,
    `difficulte`, `cible`, `unite`, `titre(cible)`, `ou`, `bouton`, `source`
    prise dans une **liste fermée** de sources serveur, `condition`) ; les
    montants de la carte (`bonus.base + bonus.pas × (k − 1)`, booster à la
    septième case) ; le tirage déterministe (graine = la chaîne du jour,
    hachage puis permutation de chaque difficulté) ;
  - **le tirage**, à la première lecture du jour : pour chaque difficulté, la
    première mission de la permutation du jour qui est active (`mission.<id>`)
    et faisable pour ce joueur ; on évite la mission d'hier au même rang quand
    une autre est faisable ; une ligne `INSERT IGNORE` par mission tirée, plus
    le sachet au rang 3 (sa `cible` = le nombre de missions tirées), gains
    copiés. Une difficulté sans mission faisable (toutes ses bascules
    éteintes) n'a pas de ligne : la liste compte alors moins de trois missions,
    et le sachet les demande toutes. `saison_id` = la saison en cours **si
    elle n'est pas finie** (`fin_le` nul ou `≥ CURDATE()`), sinon NULL : une
    mission jouée entre deux saisons ne remplit aucun carnet. Purge du joueur
    au-delà de 400 jours dans `missions_jour` et `compteurs_jour`, faite au
    tirage ;
  - **les conditions** (au tirage seulement) :

    | mission | faisable si |
    |---|---|
    | `boosters` | toujours |
    | `duel`, `victoire`, `victoires`, `endurance` | `xp.duel_entrainement > 0` (relecture : ces missions comptent l'entraînement, et un duel ne compte que si `xp > 0`) |
    | `virage`, `tribune` | la journée du foot compte un match pas terminé dont le coup d'envoi tombe **dans** le jour de jeu (relecture : un match commencé la veille compte pour la veille) |
    | `classes` | idem, `xp.duel_classe > 0`, et `classés joués aujourd'hui + 2 ≤ abo.duels_classes_jour` (0 = sans plafond), compté comme le quota (`mode = 'classe'`, `ended_at >= CURDATE()`) ; **sans lire l'abonnement** |
    | `club_virage` | un club suivi joue un match pas terminé dont le coup d'envoi tombe dans le jour de jeu (journée ∩ `user_follows`) |
    | `club_duel` | le joueur suit au moins un club, et `xp.duel_entrainement > 0` |
    | `grandir` | un Fanzzy possédé n'a pas atteint son dernier âge écrit, et la bourse couvre l'évolution la moins chère |
    | `mitemps` | un match dont le coup d'envoi tombe dans le jour de jeu n'a pas commencé sa seconde mi-temps (statut à venir, `1H` ou `HT`) |
    | `ailleurs` | au moins deux compétitions ont un match pas terminé dont le coup d'envoi tombe dans le jour de jeu |

    « Dans le jour de jeu » se calcule en SQL, en UTC puisque `kickoff_at`
    l'est : le début du jour est
    `UTC_TIMESTAMP(3) - INTERVAL (UNIX_TIMESTAMP(NOW(3)) - UNIX_TIMESTAMP(CURDATE())) SECOND`,
    juste les jours de 23 h et de 25 h. La journée du télétexte est un jour
    **UTC** (`teletext/index.js`, `jour()`) : entre minuit et deux heures, elle
    peut ne pas couvrir la fin du jour de jeu. On l'accepte (le tirage se fait
    en général plus tard), et c'est écrit en commentaire. Sans journée du foot
    (télétexte absent), les missions qui en dépendent ne sont pas faisables ;
  - **la progression**, recomptée à chaque lecture, pour le jour `k` (0 ou 1) :

    | mission | source |
    |---|---|
    | `boosters` | `compteurs_jour.booster` |
    | `grandir` | `compteurs_jour.evolution` |
    | `duel`, `endurance` | `duel_results` du jour, `xp > 0` (le joueur n'a pas quitté : un forfait a `xp = 0`) **et `duree_s >= 60`**, tout mode |
    | `victoire`, `victoires` | idem, `outcome = 'win'` |
    | `classes` | idem, `mode = 'classe'` |
    | `club_duel` | idem, `team_id` parmi les clubs suivis |
    | `virage`, `tribune` | `SUM(chants)` des présences dont le match (`fixtures`, par `fixture_id`) a son coup d'envoi dans le jour `k` |
    | `club_virage` | idem, `team_id` parmi les clubs suivis |
    | `mitemps` | `MAX(LEAST(chants_mt1, chants_mt2))` sur ces mêmes présences |
    | `ailleurs` | nombre de compétitions (`fixtures.league_id`) où ces présences ont au moins 10 chants |

    **Pourquoi `duree_s >= 60`** (relecture) : le joueur resté après un
    forfait est payé en entier et sa ligne dit `win` avec `xp > 0`
    (`nvn/index.js`, `recompenser` et `fermer`). Un second compte qui entre en
    file et abandonne aussitôt offrait donc une victoire en trois secondes.
    Une minute coûte au tricheur autant qu'une vraie victoire rapide, et un
    vrai duel ne se joue presque jamais en moins : trois buts demandent
    environ quatorze chants parfaits (`duel.but_a` 200, `duel.chant_puissance`
    44) de quatre secondes et demie chacun. Si la suite d'un vrai duel le
    contredit, le seuil baisse, il ne disparaît pas. `duree_s` existe depuis
    `sql/historique.sql`.

    **Pourquoi le coup d'envoi et non `last_push_at`** (relecture) :
    `virage_presence` tient **une ligne par match**, et chaque poussée réécrit
    `last_push_at` (`souvenirs/index.js`, `recordPush`). Un match à cheval sur
    minuit déplaçait donc tous ses chants vers le lendemain : la mission
    prête la veille redevenait incomplète au moment de la réclamer, et le
    lendemain recevait des chants de la veille. Le coup d'envoi ne bouge pas,
    et le Virage écrit `fixtures` avant la présence (`football/ancrage.js`).
    Le filtre reste indexé : `vp.user_id = ? AND vp.joined_at >= <début d'hier
    moins un jour>`, puis la jointure par clé sur `fixtures` ;
  - **les routes** de `CONTRATS.md` § 6 et § 8 : `GET /api/quotidien`
    (`?retour=1`), `POST /bonus`, `/mission`, `/sachet`, `/relance`,
    `/carnet`, `/relais`, `/tout`, `/visite`. Toutes les réclamations passent
    par `verser()` avec le recompte dans `verifier`, et avec
    `recharger: fanzzy.recharger` (sachet, septième case, carnet et relais
    portent des boosters). La relance prend **d'abord** le verrou de la ligne
    `user_wallet` du joueur, comme `verser` (relecture : sans cet ordre
    commun, une réclamation et une relance simultanées pouvaient inscrire au
    grand livre la mission X pendant que la ligne passait à la mission Y),
    puis verrouille les lignes du jour (`FOR UPDATE`), compte
    `SUM(relancee)`, n'agit que si la mission affichée est toujours celle de
    la ligne et qu'aucune ligne `mission <jour>:<rang>` n'existe au grand
    livre, prend la suivante de la permutation et **garde les gains de la
    ligne** (la promesse du matin) ;
  - **la carte de présence** se déduit du grand livre. Avec `n` le nombre de
    bonus versés : avant la prise du jour, la case du jour vaut
    `(n mod 7) + 1` ; après, `((n − 1) mod 7) + 1`. Le versement la calcule
    dans la transaction, après le `FOR UPDATE` ;
    la série et le record viennent des écarts `DATEDIFF(CURDATE(), cle)` des
    lignes `bonus`, lus en SQL : aucun objet `Date`. `serie` est servi dès que
    le record vaut au moins 1, `jours` à 0 compris (relecture : sinon le
    profil perd le record le jour où la série retombe) ;
  - **le carnet** : `carnetDe(saisonEnCours())`, les tampons par
    `SUM(tampons)` de la saison ; carnet clos quand la fenêtre de la saison est
    passée (`finDeFenetre` de `shared/saison.js`) ; les missions du dernier jour
    récupérées le lendemain gardent le `saison_id` de leur ligne et comptent
    encore ; `saisonPassee` = la plus récente des saisons finies qui a encore
    un palier `pret`, une seule ; `aReclamer` ne compte que ce que la réponse
    sert ; `relais` comme au contrat ;
  - **le ticket** : `visite_a`, `instantane` (pot **et** `verse_total` de
    chaque KOP : `verse` du contrat est l'écart de `verse_total`) ; tout
    comparé en SQL à `visite_a` ; les matchs par `kickoff_at > UTC_TIMESTAMP()
    - INTERVAL <secondes écoulées, calculées en SQL> SECOND`. **`visite_a` se
    lit dans la requête du contrat** : si la marque a moins de
    `quotidien.retour_heures`, `?retour=1` ne coûte rien de plus (relecture :
    le hub le demande à chaque arrivée). `POST /visite` déplace la marque et
    photographie les pots par un `UPDATE … WHERE visite_a IS NULL OR visite_a
    < NOW(3) - INTERVAL 1 MINUTE` : pas d'écriture à chaque retour au hub ;
  - `server.js` : `createQuotidien({ pool, requireAuth, niveau, fanzzy,
    jourDuFoot: () => teletext?.jour('') ?? null })`, monté sur
    `/api/quotidien` après l'aide ; **ni** `abonnement`, **ni** `kop`, **ni**
    `amis` ; au démarrage, la **sonde du jour de jeu** (`SELECT
    @@session.time_zone, @@system_time_zone, TIMEDIFF(NOW(), UTC_TIMESTAMP())`)
    écrite au journal en clair (« le jour de jeu change à HH:MM, heure de
    Zurich ») et ajoutée à `/healthz` sous `jourDeJeu` ;
  - `verif-cablage.mjs` : `createQuotidien` reçoit `niveau`, `fanzzy` et une
    `jourDuFoot` non nuls, et ne reçoit ni `abonnement`, ni `kop`, ni `amis`.
- **Tables** : écrit `missions_jour`, `user_wallet.visite_a` et `instantane`,
  `recompenses` (par `verser`) ; lit `compteurs_jour`, `duel_results`,
  `virage_presence`, `fixtures`, `user_follows`, `user_fanzzy`, `amities`,
  `kop_membres`, `kop_votes`, `kop_invites`, `kops`, `user_souvenirs`,
  `saisons`, `recompenses`.
- **Budget** : `GET /api/quotidien` fait **au plus 7 requêtes** (le jour et
  son reste, le contrat, le grand livre, les duels, les présences, les
  compteurs) ; le tirage en ajoute au plus 4, une fois par jour et par joueur ;
  `?retour=1` au plus 7 **quand il y a un ticket à faire, zéro sinon**
  (`visite_a` est lu avec le contrat). Aucune mémoire côté serveur : la
  progression doit être juste à la seconde où le joueur revient au hub.
- **Tests** (`quotidien-smoke`, horloge figée) :
  - tirage : cinq `GET` simultanés au premier passage → les mêmes missions,
    **quatre** lignes ; deux joueurs aux mêmes conditions → mêmes missions ;
    un joueur sans club suivi n'a jamais `club_virage` ni `club_duel` ; une
    bascule éteinte sort la mission du tirage du lendemain ;
  - progression semée en SQL (lignes de `duel_results` en `NOW(3)`, chants dans
    `virage_presence`, `compteurs_jour` en `CURDATE()`) ; un forfait ne fait pas
    la mission ; ouvrir un booster **par la vraie route** du module fanzzy
    monté dans la suite fait avancer `boosters` (contrôle d'intégration) ;
  - versements : montant exact, **copié du contrat** même si le réglage change
    après le tirage (T9) ; le lendemain, le nouveau montant ; deux puis dix
    réclamations simultanées → un crédit ; un corps qui porte
    `{ montant: 9999, echarpes: 9999 }` verse le montant de la ligne (T1) ;
    `id` qui ne correspond plus → `change` ; ligne d'avant-hier → `jour_passe` ;
  - minuit : tirage à 23:59:59, réclamation à 00:00:01 → la ligne d'hier est
    versée (délai de grâce), et l'état relu montre les missions du jour ;
  - J1 : à 00:30, la progression de `classes` et
    `abonnement.duelsClassesRestants` comptent les mêmes lignes ;
  - J3 : le 2026-10-25 à 00:30, `finDuJourMs` = 88 200 000 ;
  - carte : trois jours d'affilée → case 3 et `serie.jours` = 3 ; un trou d'un
    jour → la case continue (4), la série repart à 1, le record reste ; deux
    onglets → un seul bonus ;
  - sachet seulement quand les trois sont récupérées ; carnet versé une fois ;
    palier atteint en saison 1 récupérable après sa fin ; relais seulement avec
    le seuil de tampons ;
  - abonné et non-abonné : mêmes missions, mêmes gains (L1) ; chaque cible ≤
    plafond gratuit lu par `reglage()`, et un plafond abaissé sort `classes`
    du tirage (L2) ; aucune source du catalogue n'est la répétition, ni une
    note de geste, ni un ami, ni un parrainage (T6, T7) ;
  - interrupteurs coupés → bloc absent et `inactif`, rien de versé ;
    disjoncteur → `plafond` ; tables supprimées → `{ actif: false }` en 200,
    et `/api/fanzzy/state` comme `/api/niveau` intacts (M1) ;
  - ticket : rien au premier passage ; après trois heures (horloge figée), une
    amitié acceptée, un vote clos, un match terminé d'un club suivi et un
    souvenir apparaissent ; un `GET` ne déplace pas la marque, le `POST` la
    déplace (T3) ;
  - budget : pool instrumenté, au plus 7 requêtes par `GET` sans `retour`, et
    **le même nombre avec `?retour=1` quand la marque a moins de trois
    heures** ;
  - **les ajouts de la relecture** :
    - Virage à minuit : un match au coup d'envoi à 23:30 (semé en UTC dans
      `fixtures`), 40 chants poussés avant minuit, mission `tribune` d'hier
      prête ; une poussée à 00:10 → la mission d'hier reste `pret` et se verse,
      et la mission `tribune` du jour ne compte aucun de ces chants ;
    - forfait : une ligne `win`, `xp > 0`, `duree_s = 3` → `victoire` ne bouge
      pas ; la même avec `duree_s = 75` → elle compte ; un joueur parti
      (`xp = 0`) → rien ;
    - `xp.duel_entrainement` posé à 0 → `duel`, `victoire`, `victoires`,
      `endurance` et `club_duel` sortent du tirage du lendemain ;
    - relance et réclamation de la même mission en `Promise.all`, vingt fois :
      jamais une ligne du grand livre dont la mission diffère de la ligne du
      jour, et la mission relancée garde le gain de la ligne ;
    - série : un trou de deux jours → `serie` présent, `jours` = 0, `record`
      inchangé ;
    - carnet : une mission tirée le dernier jour de la saison 1 et récupérée le
      lendemain ajoute ses tampons au carnet de la saison 1 ; deux saisons
      finies avec chacune un palier `pret` → `saisonPassee` sert la plus
      récente, et `aReclamer` ne compte que celle-là ;
    - sachet reçu à 11 sur 12 avec une recharge due → 13 ;
    - `POST /visite` deux fois en dix secondes → une seule écriture ;
  - la suite repasse sous `TZ=America/Montreal` et reste verte (J5).
- **Mutations** : compter la mission avec un jour calculé en JavaScript (00:30
  rougit) ; `TIMESTAMPDIFF` pour `finDuJourMs` (le 25 octobre rougit) ;
  ignorer l'interrupteur ; verser le montant du réglage au lieu de la ligne ;
  ajouter une source `repetition` au catalogue ; tirage avec `Math.random()`
  (les cinq `GET` divergent) ; avancer la marque de visite dans le `GET` ;
  **compter les chants sur `last_push_at`** (le contrôle de minuit rougit) ;
  **retirer `duree_s >= 60`** (le forfait de trois secondes compte) ;
  **relance sans le verrou de la bourse** (la course rougit) ; **`serie` absent
  à `jours = 0`**.
- **Dépend de** : `socle` (tout), `saison` (`shared/saison.js`,
  `saisonEnCours` enrichi, `finDeFenetre`), `niveau` (forme `niveau`),
  `fanzzy` (`recharger`, et pour les contrôles d'intégration, les compteurs),
  et `virage` (chants, pour les contrôles d'intégration seulement).

---

## 7. Dépendances et ordre de travail

```
socle ──┬─> niveau ──> duel
        ├─> saison ──┬─> fanzzy
        │            ├─> classement ──> social
        │            └─> quotidien
        ├─> virage
        └─> (tout le reste : tables, réglages, verser)
```

1. **`socle` d'abord**, seul : le fichier SQL, le registre, `verser()` et les
   aides de test. Sans eux, aucune autre suite ne peut tourner.
2. **Puis les huit autres en parallèle.** Quatre livrent tôt ce que d'autres
   attendent, avant le reste de leur travail :
   - `saison` : `src/shared/saison.js` (avec `finDeFenetre`) et
     `saisonProchaine()` ;
   - `classement` : `habillerJoueurs` ;
   - `niveau` : la forme de `gagner()` et **`gagnerDans(conn, userId, xp)`**,
     dont le grand livre a besoin (relecture) ;
   - `fanzzy` : **`recharger(conn, userId)`**, dont le grand livre et
     `quotidien` ont besoin (relecture).

   Un périmètre qui attend code contre la signature écrite ici, et lance sa
   suite quand la dépendance est posée. Le socle éprouve `verser` avec des
   doublures fidèles de `gagnerDans` et de `recharger`, puis relance
   `recompenses:smoke` avec les vraies fonctions avant l'intégration : une
   doublure qui diverge du vrai code ne prouve rien.
3. **Intégration** : toutes les suites, **une à la fois**, dans l'ordre
   `schema:smoke`, `reglages:smoke`, `recompenses:smoke`, `niveau:smoke`,
   `nvn:smoke`, `nvn:net`, `fanzzy:smoke`, `collection:smoke`,
   `boutique:smoke`, `admin:smoke`, `classement:smoke`, `kop:smoke`,
   `amis:smoke`, `virage:smoke`, `souvenirs:smoke`, `quotidien:smoke`,
   `abo:smoke` (hors de la fenêtre 00:00–02:00, tant que sa semence n'est pas
   corrigée), `auth:smoke`, `aide:smoke`, puis `npm run cablage`,
   `npm run pages`, `npm run securite`, et `npm test` en entier.

Les écrans des lots 3 et 5 avancent en parallèle contre `CONTRATS.md`, avec
des réponses interceptées sur leur banc. Ils ne dépendent d'aucun périmètre
pour avancer.

---

## 8. Ordre de déploiement

**Livraison 1 — tout de suite, sans schéma : `niveau` et `duel`.** Elle
corrige deux défauts en ligne (E1, E2), sert la jauge d'XP et la cote au
bilan. Aucune table, aucun réglage. Les écrans actuels ignorent les champs
nouveaux.

**Livraison 2 — le reste, avec les écrans des lots 3 et 5.**

1. **Le schéma d'abord.** Le workflow GitHub applique `sql/` avant de
   redémarrer. Après un passage par le Manager d'Infomaniak, qui ne l'applique
   pas : `npm run schema:appliquer` **immédiatement, puis redémarrer** depuis
   l'onglet Node.js. Le processus démarré sans le schéma a pris ses replis (le
   compteur de chants se rebranche seul en dix minutes, mais le contrôle de
   démarrage et `/healthz` ne se relisent qu'au redémarrage).
2. Hors des heures de match : les salles du Virage vivent en mémoire (M7).
3. Le serveur avant les écrans, ou ensemble. Jamais les écrans seuls : ils
   tolèrent l'absence, mais un écran sans données n'apprend rien à personne.
4. Si la livraison doit être découpée, cet ordre est sûr à chaque étape, parce
   que chaque lecteur tolère l'absence de ce qui suit : `socle` → `virage` (les
   chants commencent à s'accumuler) → `fanzzy`, `saison`, `classement`,
   `social` → `quotidien`. Le registre (`socle`) annonce alors quelques jours
   des réglages qui ne règlent encore rien : on l'accepte pour un découpage,
   pas pour une livraison normale.

**Après la livraison 2, à faire par Gaël ou avec lui :**

- lire la ligne de la sonde au journal (« le jour de jeu change à… ») ;
- vérifier sur `/matchs` le dernier week-end de championnat avant la trêve,
  puis saisir la fin de la saison 1 (proposée : 2026-12-20) ;
- lancer la requête de l'annexe A d'`ECONOMIE.md` (lecture seule) **en
  écartant les abonnés** (`AND x.user_id NOT IN (SELECT user_id FROM
  abonnements WHERE fin IS NULL OR fin > NOW(3))`, la condition même
  d'`estAbonne`), et recaler les
  quatre seuils de division ; Capo ne doit jamais dépasser ce qu'un joueur
  gratuit assidu fait dans la saison (relecture : l'abonné n'a pas de plafond
  de ferveur classée) ;
- si les missions arrivent après le 19 octobre, saisir le carnet de la saison
  1 dans l'onglet Saisons, seuils × (jours restants / 63), **avant** le
  premier palier versé ;
- vérifier dans RÉGLAGES que les trois sections sont là, et dans `/healthz`
  que `ok` est vrai ;
- plus tard : la saison 2 en brouillon, avec sa date d'ouverture, quand son
  contenu est prêt.

---

## 9. Critères de fin de vague

- Toutes les suites vertes, lancées une à une ; `npm test` vert.
- `npm run cablage`, `npm run pages` et `npm run securite` verts.
- Pour chaque périmètre, la liste de ses mutations et le contrôle qui a rougi.
- Chaque champ de `CONTRATS.md` est vérifié par au moins un contrôle de la
  suite de son périmètre, nom de champ compris. Un écart trouvé par un écran se
  rapporte avec la clé du périmètre et le paragraphe du contrat.
- `ETAT.md` (§ 4, § 6 : les pièges nouveaux, dont le grand livre comme seule
  porte des versements) et `HISTORIQUE.md` mis à jour en fin de vague, par
  l'atelier qui la clôt, hors des neuf périmètres.

## 10. Ce qui n'est pas à faire dans cette vague

La présence et le bilan de tribune (§ 0) ; les missions de réserve (PARFAIT,
série, cartes jouées, vrai supporter, ami, vote, KOP) ; les flèches de rang
des autres lignes et la table `classement_veille` ; les titres sur les lignes
des autres joueurs ; un journal général des écharpes ; toute correction de
l'inflation des écharpes, de l'XP du Virage, du bonus « La quête » ou de
l'arrondi de la ferveur (décisions de Gaël, `SERVEUR.md` § 11) ; toute
modification de `src/server/nvn/engine.js` ; tout fichier de `public/` hors de
l'onglet Saisons d'`admin.html` ; `src/server/aide/index.js`, dont le booster
des premiers pas mange lui aussi la recharge en attente (`SERVEUR.md` § 12) :
le correctif est `recharger`, mais le fichier n'est dans aucun périmètre, et
il s'aiguille à part une fois `fanzzy` livré.

---

## 11. Ce que la relecture a changé

Relecture adverse du 2 octobre 2026, faite dans le code de la copie
principale. Chaque ligne nomme le périmètre touché (clé fermée du § 6).

| # | périmètre | changement | preuve dans le code |
|---|---|---|---|
| 1 | `saison`, `classement`, `socle` | divisions payées en honneur seulement ; `gainDivision` et les réglages `rang.echarpes_par_cran`, `rang.packs_par_cran` retirés ; recalage des seuils sur les seuls non-abonnés | `abonnement/index.js` : `duelsClassesRestants`, `viragesClassesRestants` rendent `null` pour un abonné ; `tailleClasseeMax` vaut `Infinity` |
| 2 | `socle`, `fanzzy` | `recharger(conn, userId)` exporté par `fanzzy`, appelé par `verser` avant tout booster offert | `fanzzy/index.js` l. 197-212 : `packs_at` remis à maintenant dès que la réserve est pleine |
| 3 | `socle`, `niveau` | `niveau.gagnerDans(conn, …)` : l'XP dans la transaction du versement | `niveau/index.js` l. 74-84 : `gagner()` avale toute erreur et rend un objet vide |
| 4 | `quotidien` | chants attribués au jour du coup d'envoi ; conditions du Virage sur le coup d'envoi | `souvenirs/index.js` l. 49-59 : une ligne par match, `last_push_at = NOW(3)` à chaque poussée |
| 5 | `quotidien` | duel compté si `xp > 0` et `duree_s >= 60` ; missions de duel hors tirage si `xp.duel_*` vaut 0 | `nvn/index.js` l. 845-852 et 1099-1110 : le joueur resté après un forfait est payé et inscrit `win` |
| 6 | `classement` | `saison.rang` et `saison.sur` ; `evolution.ferveur` sur le rang de la saison | `classements/index.js` l. 484-500 : `maPlace` lit `FERVEUR` sans fenêtre |
| 7 | `classement` | deux photos dans `rangs_vus` | contrat d'avant : une photo à la première lecture, comparée aux lectures suivantes du même jour |
| 8 | `quotidien` | `serie` servi dès que `record ≥ 1` | contrat d'avant : `serie` absent à `jours = 0`, le record disparaît |
| 9 | `virage` | le repli de `recordPush` expire au bout de dix minutes | plan d'avant : repli « pour la vie du processus », donc plus aucun chant après un `schema:appliquer` sans redémarrage |
| 10 | `quotidien` | la relance prend d'abord le verrou de la bourse, et garde les gains de la ligne | plan d'avant : relance sur `missions_jour`, réclamation sur `user_wallet`, deux verrous sans ordre commun |
| 11 | `socle` | `deja` vérifié avant le disjoncteur ; versements fermés si la clé primaire manque | plan d'avant : disjoncteur à l'étape 4, `INSERT` à l'étape 5 |
| 12 | `saison`, `classement`, `quotidien` | fin de fenêtre d'une saison = fin de `fin_le` ou lancement de la suivante ; `saisonPassee` = une saison, la plus récente ; `aReclamer` ne compte que ce qui est servi | `saisons.js` : `saisonEnCours()` = la dernière lancée ; rien ne bornait une saison sans `fin_le` |
| 13 | `saison` | carnet figé au premier palier versé ; carnet de la saison 1 à recaler si la mise en ligne passe le 19 octobre | `SERVEUR.md` § 5 : seuils calculés sur 63 jours |
| 14 | `socle` | `deleteUser` supprime par `public_id` | `auth/store.js` l. 101-110 : `WHERE id = ?`, l'identifiant interne |
| 15 | `classement`, `social` | `habillerJoueurs` rend `avatar: null` pour un compte non actif | `kop/index.js` l. 354-355 : les membres sont lus sans filtre de statut |
| 16 | `quotidien` | `?retour=1` gratuit quand la marque est récente ; `POST /visite` conditionnel ; `instantane` porte `verse_total` | `kops.verse_total` (`sql/kop.sql`) est le seul cumul daté par différence |
| 17 | `fanzzy` | `src/server/boutique/index.js` retiré du périmètre : la nouveauté de l'étal s'écrit dans `remettreStuff` et `remettreTenue` | `boutique/index.js` l. 414-418 : l'étal appelle déjà ces deux fonctions avec sa connexion |
| 18 | `socle` | `JURIDIQUE.md` corrige un fait (l'abonnement livre 1 ou 6 boosters) et pose les questions de la carte de présence et des crans ; `CONFIDENTIALITE.md` cite l'activité gardée 400 jours ; unité `billets` des réglages `etal.*` corrigée | `src/shared/boutique.js` l. 125 et 151 : `packs: 1`, `packs: 6` |
| 19 | `socle` | `A-DEPLOYER.md` : redémarrer après `schema:appliquer` | conséquence du n° 9 et du contrôle de démarrage |
