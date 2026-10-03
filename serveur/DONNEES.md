# Chantier serveur de la refonte FAIT MAIN — les données et les routes

Analyse en lecture seule de la copie principale (`main`, 4c07044 + lot 2 non commité),
2 octobre 2026. Lus : `SYNTHESE.md` § 4, `lot35/BRIEF-LOTS-3-5.md`, `ETAT.md` § 2 et § 6,
`JURIDIQUE.md`, `IDEES.md` § 2, la mémoire du projet, et le code de `server.js`,
`src/server/{niveau,fanzzy,nvn,classements,kop,amis,aide,abonnement,reglages,ferveur,souvenirs,admin,boutique,onboarding}`,
`src/shared/{niveau,cote,reglages,etal}.js`, `sql/*.sql`, `scripts/ordre-schema.mjs`,
`src/server/auth/schema.js`, et les appels `/api` de `public/*.html`, `nav.js`, `menu.js`.
Aucun fichier du dépôt modifié, aucune suite lancée.

**Les montants** (écharpes, boosters, XP) proposés ici sont alignés sur la simulation du
même atelier (`serveur/sim-eco.mjs`) : missions 30 / 60 / 100 écharpes et 20 / 40 / 60 XP,
coffre d'un booster, carte de 20 à 50 écharpes avec un booster au septième jour. Si
`ECONOMIE.md` dit autre chose, **c'est lui qui fait foi sur les nombres** ; ce document fait
foi sur les clés, les tables, les routes et les formes JSON.

---

## 0. En une page

| # | Point | Ce qui existe déjà | Le plus petit changement juste | Schéma | Requêtes en plus | Effort |
|---|---|---|---|---|---|---|
| 1 | XP + seuil dans booster et duel | `gagner()` rend xp, niveau, avant, monte ; `progression()` pure | `gagner()` ajoute `gain`, `dans/pour/part/max` et `depart` ; le duel pose `gains.niveau` toujours | aucun | 0 | 0,5 j |
| 2 | Vu / nouveau par carte | `cards[].new` au tirage ; `first_at`/`got_at` sur 4 tables | table `user_nouveautes`, écrite après l'ouverture, lue dans `/state`, vidée par `POST /api/fanzzy/vu` ; progression de série dans la réponse du booster | 1 table | +1 lecture sur `/state` | 1 j |
| 3 | Avatar + niveau dans les listes | `avatarsDe()` par lots ; les amis l'ont déjà | helper `habillerJoueurs()` posé dans les mémos de `/api/rank/*`, dans `kop.etat()` ; `w.xp` ajouté aux requêtes des amis | aucun | +3 par calcul de liste (mémo 5 min) | 1 j |
| 4 | Delta de rang, cote avant/après | `elo_before/elo_after` écrits… après le bilan | cote calculée **avant** `nvn:fin` et posée dans `gains.cote` ; divisions par la cote ; `rangs_vus` pour la ligne « moi » | 1 colonne | 0 au duel ; ≤ 1 écriture/jour sur `/moi` | 1,5 j |
| 5 | Paliers de collection et de rang | `bibliotheque` compte gagné/possible ; `parcours_paye` modèle de versement unique | table `user_paliers` ; paliers dans `/bibliotheque` et `/rank/moi` ; `POST /api/quotidien/palier` | 1 table | +1 sur `/bibliotheque` | 2 j |
| 6 | Missions, bonus, série | le modèle `aide` (faits relus en base, versement en transaction) ; les faits datés en base | table `user_jour` ; module `quotidien` ; `GET /api/quotidien` et quatre réclamations | 1 table | ~6 légères par visite du hub | 3 j |
| 7 | Saison : fin, prochaine, récompense | table `saisons`, `saisonEnCours()` en mémoire, servie par `/dex` | `fin_le`, `ouvre_le` (DATE) ; récompense par réglages ; `POST /api/quotidien/saison` | 2 colonnes | 0 (mémoire) | 1,5 j |
| 8 | Depuis ta dernière visite | amitiés, KOP, résultats des clubs suivis, souvenirs : tout est daté | `visite_a`, `visite_prec`, `instantane` ; bloc `depuis` dans `GET /api/quotidien?retour=1` | 3 colonnes | ~5 à la première vue d'une visite | 1,5 j |
| 9 | Présence | `roomOfUser` (Virage), `salleDe` (duel) en mémoire | module `presence.js` en mémoire, sans socket ni table ; champ `presence` chez les amis et les membres du KOP | aucun | 0 | 1 j |
| 10 | Bilan de tribune | `virage_presence`, souvenirs du match, `rankOf()` en mémoire | 4 colonnes comptées dans l'upsert qui existe ; `virage:bilan` au coup de sifflet ; `GET /api/virage/bilan/:id` | 4 colonnes | 0 par chant, 2 par salle au sifflet | 1,5 j |

**Zéro appel à l'API sportive** sur les dix points : tout se lit dans `fixtures`, que le
guetteur remplit déjà pour les clubs suivis. Environ **14 jours** tests compris, ce qui
recoupe les « 10 à 12 jours serveur » de la synthèse plus les suites.

---

## 1. Neuf règles qui valent pour tous les points

**R1 — Le jour de jeu est `CURDATE()`, et toute date se compare en SQL.** C'est déjà le jour
des plafonds de l'abonnement (`abonnement/index.js`, `ended_at >= CURDATE()`) : les missions,
le bonus et les quotas doivent changer de jour au même instant, sinon « mes duels classés sont
revenus mais pas mes missions ». Conséquences, chacune déjà payée une fois dans ce dépôt :

- `jour` s'écrit `CURDATE()` dans la requête, jamais une date fabriquée en JavaScript ;
- une colonne `DATE` se relit en chaîne (`DATE_FORMAT(jour, '%Y-%m-%d')`), jamais par `String(date)` ;
- un délai part déjà calculé en SQL (`TIMESTAMPDIFF(MICROSECOND, NOW(3), CURDATE() + INTERVAL 1 DAY) / 1000`) :
  une colonne écrite par `NOW(3)` et relue par le pilote en `timezone: 'Z'` revient deux heures
  dans le futur sur une base à l'heure de Zurich (le piège de `amis.lien` et du télétexte) ;
- `fixtures.kickoff_at` est en UTC (écrit par le pilote, comparé à `UTC_DATE()` par le deck) :
  il ne se compare qu'à `UTC_TIMESTAMP()` ;
- **les suites sèment en SQL** (`CURDATE()`, `NOW(3)`), jamais `new Date()` — c'est exactement
  le rouge d'`abo:smoke` entre minuit et deux heures (ETAT § 2) ; et une suite du quotidien
  doit contenir un contrôle « à cheval sur minuit » qui pose une ligne d'hier par
  `CURDATE() - INTERVAL 1 DAY`.

Le deck, lui, mesure « le match du jour » en `UTC_DATE()` (IDEES § 2). Les deux jours ne
coïncident qu'entre 2 h et minuit l'été. Ce chantier n'y touche pas ; il ne mélange jamais les
deux dans une même réponse (règle ETAT § 6 « l'étiquette et le contenu sortent du même repère »).
**À vérifier une fois en production** : `SELECT @@global.time_zone, @@system_time_zone, NOW(), UTC_TIMESTAMP()`.
Si la base d'Infomaniak est en UTC, le jour de jeu change à 2 h du matin l'été — acceptable,
mais à savoir.

**R2 — Un seul fichier de schéma, une colonne par `ALTER`.** Proposé : `sql/quotidien.sql`,
**en dernier** dans `ORDRE` (après `aide`) : il dépend de `users` (auth), `user_wallet` et
`virage_presence` (souvenirs), `saisons` (saisons). `src/server/auth/schema.js` ne reconnaît
qu'**un** `ADD COLUMN IF NOT EXISTS` par instruction `ALTER TABLE` (la regex s'arrête au
premier) : chaque colonne a donc son propre `ALTER`, sinon le démarrage la croit présente.
`sql/couleurs.sql` en pose trois dans un seul `ALTER` et seule `color1` est contrôlée — voir § 13.
Le fichier se mentionne dans `DEPLOIEMENT.md` et `A-DEPLOYER.md`.

**R3 — Une table absente éteint la fonction, pas la route.** Même posture que l'aide, les
saisons et les états : `ER_NO_SUCH_TABLE` / `ER_BAD_FIELD_ERROR` → le champ n'est pas servi,
et l'écran n'affiche rien (« une ligne sans donnée disparaît »). Une écriture annexe (compteur
du jour, nouveautés) ne fait **jamais** échouer l'ouverture d'un booster ni la fin d'un duel :
elle passe **après** la validation, sous `try`, comme l'XP aujourd'hui.

**R4 — Toute récompense se réclame, et le serveur recompte.** Modèle : `aide.recompenser()`.
La page ne dit jamais « c'est fait » ; le serveur relit les faits, puis pose son drapeau par
une écriture conditionnelle dont il lit `affectedRows` (`… WHERE bonus_a IS NULL`,
`… WHERE (missions & 2) = 0`, `INSERT IGNORE`), **dans la même transaction que le versement**.
Deux onglets, deux appels simultanés : un seul versement, et une suite le prouve en lançant les
deux en parallèle.

**R5 — Abonné et non-abonné reçoivent exactement la même chose.** Aucun module de ce chantier
ne lit `estAbonne`. Aucune mission ne demande ce que le gratuit plafonne (duels classés,
Virages comptés, formats classés) : un Virage non compté compte pour la mission, un duel
d'entraînement aussi. Pas de protection de série payante, pas de rattrapage payant. Les
boosters offerts sont gratuits et identiques pour tous : la chaîne euro → tirage reste coupée
(JURIDIQUE § 2, § 3). Un contrôle de suite : « aucune clé `quotidien.*`, `missions.*`,
`paliers.*`, `saison.*` n'est lue par `abonnement/` » et « mêmes gains pour un abonné ».

**R6 — Le contrat du jour se fige à sa création.** Les trois missions, leurs cibles et leurs
gains s'écrivent dans `user_jour.contrat` à la première lecture du jour. Un réglage changé à
midi depuis `/admin` vaut pour demain ; la réclamation paie ce qui a été promis le matin —
c'est la règle des achats, qui copient leur prix (`sql/boutique.sql`).

**R7 — Le serveur compte, l'écran nomme.** Les réponses portent des nombres, des identifiants
et des drapeaux, jamais des phrases. Un champ sans valeur est **absent** (pas `null`, pas `0`)
quand l'absence veut dire « rien à montrer ».

**R8 — Pas d'appel à l'API sportive.** « Ton club joue aujourd'hui » et « résultats depuis ta
visite » lisent `fixtures` (index `idx_home`, `idx_away` sur `(club, kickoff_at)`), tenu à jour
par le guetteur pour les clubs suivis.

**R9 — Les réglages restent dans les quatre formes que `/admin` sait dessiner** : entier,
décimal, booléen, choix (et texte). `admin.html` (l. 1406-1422) rend tout le reste en champ
numérique : un type `liste` y serait cassé. D'où des booléens par mission optionnelle, et une
formule à quatre entiers pour la carte du bonus plutôt qu'un tableau.

---

## 2. Point 1 — l'XP courant et le seuil dans les résultats

**Ce qui existe.**
- `niveau.gagner(userId, montant)` (`src/server/niveau/index.js`) rend
  `{ xp, niveau, avant, monte, paliers, ecarpes }` ; `progression(xp)` (`src/shared/niveau.js`)
  est pure et rend `{ niveau, dans, pour, part, max }`.
- Booster : `POST /api/fanzzy/open` pose `niveau: monte` dès que `monte.xp` est vrai
  (`fanzzy/index.js:787-790`) — total d'XP, niveau, montée ; **ni `dans` ni `pour`**.
- Duel : `nvn:fin.gains = { echarpes, pourSonClub, xp, kop, montee? }` — `xp` est le **gain**,
  `montee` n'existe qu'au palier (`nvn/index.js:868-886`).
- `GET /api/niveau` a la forme que lit le HUD (`nav.js`, `niveauDe()` :
  `{ niveau, dans, pour, max }`).

**Ce qui manque.** La jauge après le gain, et son point de départ pour l'animer.

**Le changement.** Dans `gagner()`, trois clés de plus, calculées par la fonction pure (zéro
requête) : `gain`, `...progression(apresXp)`, `depart: { xp: avantXp, ...progression(avantXp) }`.
Le booster n'a rien d'autre à faire. Le duel pose `verse.get(userId).niveau = m` **toujours**
(quand `m.xp` est vrai) et garde `montee` tel quel pour `duel-nvn.html` et `niveau-fete.js`,
qui lisent `m.niveau`, `m.avant`, `m.paliers`, `m.ecarpes`.

```json
"niveau": {
  "xp": 490, "gain": 20,
  "niveau": 5, "dans": 10, "pour": 220, "part": 0.045, "max": false,
  "avant": 4, "monte": true, "paliers": [{ "niveau": 5, "deckFanzzy": 3 }], "ecarpes": 50,
  "depart": { "xp": 470, "niveau": 4, "dans": 170, "pour": 180, "part": 0.944, "max": false }
}
```

Où : `POST /api/fanzzy/open` → `niveau` ; `nvn:fin` → `gains.niveau` ; et toute réclamation
du § 7 qui verse de l'XP renvoie le même objet. Sur incident (`gagner()` rend `xp: 0`), la clé
est absente et l'anneau ne bouge pas.

**Lecteurs.** `boosters.html` (butin : l'anneau avance), `duel-nvn.html` (bilan : XP fusionnée
avec la fête), `nav.js` (peut recevoir l'objet par l'événement de bourse et s'éviter un
`/api/niveau`), `niveau-fete.js` (inchangé).
**Coût.** Aucune requête, aucun appel API.

---

## 3. Point 2 — le drapeau « vu / nouveau »

**Ce qui existe.**
- Chaque carte d'un booster porte `new` (`{ type, id, new }` ; `pour`/`stade` pour une tenue
  ou un état) ; `boosters.html` s'en sert pendant la révélation, et c'est tout.
- Les dates d'obtention : `user_fanzzy.first_at`, `user_skins.got_at`, `user_stuff.got_at`,
  `user_etats.got_at`. Les cartes d'action vivent dans `user_wallet.action_cards` (JSON),
  **sans date**.

**Ce qui manque.** Une mémoire, commune aux appareils, de ce que le joueur n'a pas encore
regardé.

**Le changement (recommandé).** Une petite table, écrite à un seul endroit :

```sql
CREATE TABLE IF NOT EXISTS user_nouveautes (
  user_id CHAR(36)    NOT NULL,
  cle     VARCHAR(64) NOT NULL,   -- 'fanzzy:RP4', 'etat:RP4:1:joie', 'skin:RP4:2:halloween',
                                  -- 'stuff:<id>', 'action:<id>', 'age:RP4:2'
  got_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, cle),
  CONSTRAINT fk_nouv_user FOREIGN KEY (user_id) REFERENCES users(public_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

- **Écriture** : dans `openPack`, après `commit`, un seul `INSERT IGNORE … VALUES ?` pour les
  cartes `new: true` (sous `try`, R3). Facultatif : `evolve` pose `age:<id>:<stade>`.
- **Lecture** : `GET /api/fanzzy/state` ajoute `nouveautes` (une lecture sur préfixe de clé
  primaire) — c'est la route que lisent déjà le hub, le classeur et le kiosque.
- **Vidage** : `POST /api/fanzzy/vu` `{ "cles": ["fanzzy:RP4"] }` ou `{ "tout": true }` ou
  `{ "sorte": "etat" }` → `DELETE`, rend `{ "restantes": 3 }`. Purge des lignes de plus de
  30 jours dans l'entretien quotidien qui existe (`server.js`, `setInterval` de 24 h).

```json
"nouveautes": [
  { "cle": "fanzzy:RP4", "sorte": "fanzzy", "id": "RP4" },
  { "cle": "etat:RP4:1:joie", "sorte": "etat", "id": "joie", "pour": "RP4", "stade": 1 },
  { "cle": "action:a-rp-fumigene", "sorte": "action", "id": "a-rp-fumigene" }
]
```

**Et la ligne vivante de la série, offerte.** `openPack` connaît déjà `avant` (la collection
d'avant le tirage) et `had` (celle d'après) : la progression par série se calcule en mémoire
sur le catalogue, **zéro requête**. Le lot 3 la recalcule côté client ; le serveur la donne
juste, et c'est d'elle que naît l'événement « série complète » du § 6 :

```json
"series": [{ "id": "RP", "avant": 4, "apres": 6, "total": 17, "complete": false }]
```

**L'autre option, plus légère et moins juste** : une seule colonne
`user_wallet.collection_vue_a`, « est nouveau ce qui a été obtenu après ». Elle ne voit ni les
cartes d'action (pas de date) ni un nouvel âge, et on ne peut pas éteindre une carte seule.

**Lecteurs.** `fanzzy.html` (classeur : NOUVEAU, « +3 » sur l'onglet), `collection.html`,
`index.html` (pastille de la tuile COLLECTION), `fanzzy-fiche.html` (vide la clé à
l'ouverture), `boosters.html` (ligne de série).
**Coût.** +1 écriture par booster qui a du neuf ; +1 lecture sur `/state`.

---

## 4. Point 3 — l'avatar et le niveau dans les classements, le KOP, la compétition

**Ce qui existe.**
- `avatarsDe(q, lignes)` (`src/server/fanzzy/avatar.js`) résout par lots : deux requêtes pour
  N joueurs (`user_fanzzy`, `user_skins`), et rend `{ id, age, evo, nom, skin, etat, cri, rar }`.
- Les amis l'emploient déjà (`amis/index.js:101`, `habiller`) et `amis.html` le dessine par
  `FZART.dessinAvatar(avatar, 'buste')` (l. 301). Pas de niveau.
- Les lignes de `/api/rank/supporters|duellistes|entrainements` et `competition/:id.joueurs`
  portent `public_id, pseudo, ferveur|cote|joues, club` ; `kop.etat().membres` porte
  `{ id, pseudo, verse, depuis, createur }`.

**Le changement.** Un helper à côté d'`avatarsDe` :

```js
// une lecture du portefeuille pour toute la liste, puis avatarsDe
habillerJoueurs(q, ids) → Map(id → { avatar, niveau })
// SELECT user_id AS userId, active_fanzzy, active_evo, active_etat, xp
//   FROM user_wallet WHERE user_id IN (…)   — niveau = niveauPour(xp)
```

Posé **à l'intérieur** des mémos de `supporters`, `duellistes`, `assidus`, `joueursDe`
(cache de 5 min), dans `kop.etat()`, et chez les amis par l'ajout de `w.xp` aux deux `SELECT`
(`tableau`, `suggestions`) — zéro requête de plus pour eux. Les tribunes et les KOP (des clubs
et des groupes) n'en ont pas.

```json
{ "public_id": "…", "pseudo": "Lucas", "ferveur": 1840, "club": "FC Sion",
  "avatar": { "id": "RP4", "age": "RP4B", "evo": 2, "nom": "…", "skin": "base",
              "etat": null, "cri": "…", "rar": "rare" },
  "niveau": 7 }
```

`avatar` vaut `null` pour un joueur sans Fanzzy (l'écran pose l'initiale) ; `niveau` est absent
si la colonne est illisible. Les listes de classement sont **publiques** (pas de `requireAuth`) :
l'avatar le devient comme le pseudo l'est déjà — rien de plus personnel.

**Lecteurs.** `classement.html` (podium, lignes, ma ligne), `kop.html` (membres en tribune),
`amis.html` (niveau sous le buste), `teletext.html` (classement d'une compétition).
**Coût.** +3 requêtes par calcul de liste, absorbées par le mémo de 5 min. `kop.html` relit
l'état toutes les 30 s par spectateur : mettre la carte des avatars d'un KOP en mémo de 60 s,
sinon +3 requêtes à chaque relecture.

---

## 5. Point 4 — la cote avant/après, le delta de rang, les divisions

**Ce qui existe.**
- `duel_results.elo_before` / `elo_after` sont écrits pour chaque joueur
  (`nvn/index.js:1100`). Mais `fermer()` émet `nvn:fin` (l. 946) **avant** de calculer la cote
  (l. 1016 et suivantes) : le bilan ne la porte pas.
- `/api/rank/moi` rend `duels.cote`, `duels.rang`, `sur`, `ferveur`, `rang` ; aucune mémoire
  de la veille.
- Au Virage, `you.rank / of / ferveur` (rang dans sa tribune) est déjà servi et lu
  (`virage.html:1009`).

**Les changements.**

a) **La cote dans le bilan, sans requête de plus.** Le calcul (une lecture de la dernière cote
de chaque humain, puis `coteApres`) passe dans une fonction appelée **entre** `recompenser()`
et l'émission, et l'`INSERT` réemploie ses valeurs. `recompenser()` attend déjà la base avant
le bilan : la promesse « une base indisponible ne vole pas la fin de partie » tient pareil
(`try`, et sans cote la clé est absente). Classé seulement :

```json
"gains": { "echarpes": 60, "xp": 35, "niveau": { … },
  "cote": { "avant": 1034, "apres": 1052, "delta": 18,
            "division": { "n": 2, "nom": "TRIBUNE" }, "divisionAvant": 1 } }
```

b) **Les divisions, fonction pure.** `division(cote)` dans `src/shared/cote.js`, seuils en
réglages (§ 12). Quatre nœuds d'écharpe, mots de tribune : 1 POURTOUR, 2 TRIBUNE, 3 VIRAGE,
4 CAPO (aucun ne reprend « KOP », qui nomme déjà les groupes). Servie dans les lignes de
`/duellistes` (`"division": 2`), dans `/moi.duels.division`, et dans `gains.cote`.

c) **Le delta de « ma ligne ».** Une colonne `user_wallet.rangs_vus JSON NULL`
`{ prec: { jour, rang, duels: { rang, cote }, entrainements: { rang } }, cour: { … } }`.
`GET /api/rank/moi` la lit ; si `cour.jour` n'est pas `CURDATE()`, `prec ← cour` et
`cour ← maintenant` (au plus une écriture par jour et par joueur). La réponse ajoute :

```json
"evolution": { "depuis": "2026-10-01", "rang": 3, "duels": { "rang": -1, "cote": 18 } }
```

(positif = on monte ; absente au premier jour.)

d) **Les deltas des autres lignes** restent en mémoire locale côté client en v1, comme le
brief du lot 5 le prévoit. Si Gaël veut un vrai « ▲ depuis hier » partagé : une table
`classement_veille (echelle, jour, user_id, rang)` remplie une fois par jour par le calcul déjà
mémoïsé, top 200 — pas avant d'en avoir besoin.

**Lecteurs.** `duel-nvn.html` (bilan), `classement.html` (▲ de ma ligne, nœuds de division),
`profil.html` (division sur la carte de supporter).
**Coût.** Duel : 0 (la lecture existe, elle est déplacée). `/moi` : +1 lecture, ≤ 1 écriture
par jour.

---

## 6. Point 5 — les paliers de collection et de rang, avec leurs gains

**Ce qui existe.** `GET /api/fanzzy/bibliotheque` compte `total.gagnes/possibles` sur
l'atteignable (séries ouvertes, contenus ouverts) et par type ; `shared/niveau.js` a ses
paliers d'écharpes ; `user_wallet.parcours_paye` est le modèle d'un versement unique. Rien pour
la collection ni le rang.

**Le changement.** Une table pour tous les paliers « une fois » :

```sql
CREATE TABLE IF NOT EXISTS user_paliers (
  user_id   CHAR(36)    NOT NULL,
  sorte     VARCHAR(16) NOT NULL,   -- 'collection' | 'serie' | 'division' | 'saison'
  palier    VARCHAR(32) NOT NULL,   -- '50' | 'RP' | 'S2:3' | 'S2'
  atteint_a DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  reclame_a DATETIME(3) NULL,
  gain      JSON        NULL,       -- ce qui a été versé, copié (R6)
  PRIMARY KEY (user_id, sorte, palier),
  CONSTRAINT fk_paliers_user FOREIGN KEY (user_id) REFERENCES users(public_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

- **Collection** : un cran tous les `paliers.collection_pas` objets gagnés (25 par défaut), sur
  le `total.gagnes` de la bibliothèque. Des comptes absolus et non des pourcentages : une
  saison qui ouvre du contenu ajoute des crans sans reprendre ceux d'avant.
- **Série complète** : tous les personnages obtenables d'une série possédés (au premier âge).
  Le booster le signale (`series[].complete`, § 3).
- **Division** : `INSERT IGNORE … (reclame_a NULL)` à la fin d'un duel classé quand la
  division atteinte dépasse la plus haute de la saison en cours (`palier = 'S<saison>:<n>'`).
  Posée au moment où elle est atteinte, pour qu'une défaite le lendemain ne la reprenne pas.

Servi :

```json
// GET /api/fanzzy/bibliotheque  (+1 lecture de user_paliers)
"paliers": {
  "pas": 25, "gagnes": 63,
  "prochain": { "a": 75, "manque": 12, "gain": { "packs": 1, "echarpes": 20 } },
  "aReclamer": [{ "sorte": "collection", "palier": "50", "gain": { "packs": 1, "echarpes": 20 } }],
  "series": [{ "id": "RP", "possedes": 17, "total": 17, "reclame": false,
               "gain": { "packs": 3, "echarpes": 100 } }]
}
// GET /api/rank/moi → duels
"division": { "n": 3, "nom": "VIRAGE" },
"paliers": [{ "palier": "S2:3", "reclame": false, "gain": { "echarpes": 150 } }]
```

Réclamer : `POST /api/quotidien/palier` `{ "sorte": "collection", "palier": "50" }`. Le serveur
recompte (la bibliothèque, cinq lectures), puis en transaction : `INSERT IGNORE` avec
`reclame_a = NOW(3)` pour la collection et la série, `UPDATE … WHERE reclame_a IS NULL` pour la
division ; `affectedRows` décide du versement. Réponse `{ verse, gain, wallet, niveau? }`.

**Lecteurs.** `collection.html` (jauge à crans et vignette du cran suivant), `fanzzy.html`
(page de série complète), `index.html` (crans de COLLECTION), `aide.html` (rail DE LA SAISON),
`classement.html` et `profil.html` (nœuds de division).
**Coût.** +1 lecture sur `/bibliotheque` ; la réclamation coûte la bibliothèque plus deux
écritures ; +1 `INSERT IGNORE` en fin de duel classé, seulement au franchissement.

---

## 7. Point 6 — missions du jour, réclamation, bonus quotidien, série

**Ce qui existe, et suffit presque.**
- Le modèle : `aide/index.js` — les faits relus en base à chaque lecture, rien de « coché à la
  main », un versement unique en transaction.
- Les faits datés, tous écrits par l'horloge de MySQL donc comparables à `CURDATE()` :
  `duel_results` (`ended_at`, `mode`, `outcome`, `team_id`, `xp`, `duree_s`, index
  `(user_id, ended_at)`), `virage_presence` (`joined_at`, `last_push_at`, `ferveur`, `team_id`,
  `classe`), `user_souvenirs.acquired_at` (index `(user_id, acquired_at)`), `kop_bulletins.a`,
  `amities`, `user_decks.maj` ; et `fixtures` × `user_follows` pour « mon club joue aujourd'hui ».
- Ce qui manque comme fait : **les boosters ouverts aujourd'hui** (`packs_ouverts` est un
  cumul sans date), la répétition (anonyme, rien en base), les cartes jouées (mémoire du Virage).

**La table du jour.**

```sql
CREATE TABLE IF NOT EXISTS user_jour (
  user_id   CHAR(36)          NOT NULL,
  jour      DATE              NOT NULL,          -- CURDATE(), toujours écrit en SQL
  boosters  SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  contrat   JSON              NULL,              -- les trois missions du jour, figées (R6)
  missions  TINYINT UNSIGNED  NOT NULL DEFAULT 0,-- bits 0..2 : mission réclamée
  coffre_a  DATETIME(3)       NULL,
  bonus_a   DATETIME(3)       NULL,
  carte     TINYINT UNSIGNED  NULL,              -- case de la carte payée ce jour (1..cycle)
  serie     SMALLINT UNSIGNED NULL,              -- jours consécutifs au moment du bonus
  PRIMARY KEY (user_id, jour),
  CONSTRAINT fk_jour_user FOREIGN KEY (user_id) REFERENCES users(public_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

Une ligne par joueur et par jour venu. `openPack`, après `commit` :
`INSERT INTO user_jour (user_id, jour, boosters) VALUES (?, CURDATE(), 1) ON DUPLICATE KEY UPDATE boosters = boosters + 1`
(sous `try`). Purge au-delà de 400 jours dans l'entretien quotidien.

**Deux compteurs, deux usages — c'est la proposition de contenu la plus importante.**
- **La carte** avance d'une case chaque jour où le bonus est pris, et **ne recule jamais** :
  c'est elle qui paie (20, 25, 30 … 50 écharpes, un booster à la septième case, puis elle
  recommence). Manquer un jour ne coûte rien.
- **La série** compte les jours consécutifs (« J3 » dans la bulle du Fanzzy) et **ne paie
  rien**. Elle retombe à 1 après un jour manqué.

Pourquoi : le jeu est ouvert aux mineurs (JURIDIQUE § 4). Une récompense qui se perd quand on
manque un jour est la mécanique de rétention la plus discutée chez les régulateurs ; la carte
donne la même envie de revenir sans punir l'absence. Les deux se calculent dans la
transaction du bonus, depuis la dernière ligne où `bonus_a` n'est pas nul.

**Les trois missions du jour.** Un catalogue dans `src/shared/quotidien.js` (comme
`shared/aide.js` porte les étapes), trois emplacements par difficulté, choisis de façon
déterministe pour que **tout le monde ait les mêmes ce jour-là** — la règle des saisons :
« deux joueurs qui se parlent parlent de la même chose » :

| emplacement | difficulté | mission | se vérifie par (jour = `CURDATE()`) |
|---|---|---|---|
| 0 | facile | **Ouvre 3 boosters** (`boosters`) | `user_jour.boosters` |
| 1 | moyenne | jours impairs **Joue 2 duels** (`duels`), jours pairs **Gagne un duel** (`victoire`) — rotation par `DAYOFYEAR(CURDATE())` | `duel_results` du jour avec `xp > 0` (un forfait ne verse pas d'XP : quitter deux fois ne fait pas la mission) |
| 2 | difficile | si un club suivi joue aujourd'hui : **Pousse 10 minutes dans le Virage de ton club** (`virage_club`) ; sinon **Joue un duel pour ton club** (`duel_club`) | `virage_presence` jointe à `user_follows` sur `team_id`, `TIMESTAMPDIFF(MINUTE, joined_at, last_push_at) >= 10` ; sinon `duel_results.team_id IS NOT NULL` |
| coffre | — | les trois réclamées | `missions = 7` |

« Un club suivi joue aujourd'hui » : un `UNION` sur `idx_home` / `idx_away`,
`kickoff_at > UTC_TIMESTAMP() - INTERVAL 3 HOUR` et
`kickoff_at < UTC_TIMESTAMP() + INTERVAL TIMESTAMPDIFF(SECOND, NOW(), CURDATE() + INTERVAL 1 DAY) SECOND`,
statut ni reporté ni annulé — l'UTC face à l'UTC, la fin du jour de jeu traduite en secondes (R1).
Décidé à la création du contrat et figé.

Toutes réalisables gratuitement, chaque jour, par tout le monde (R5) : la réserve de boosters
se recharge, l'entraînement se joue contre des bots en vingt secondes, un Virage non compté
compte, et un duel pour son club se joue sur un match à venir. **À vérifier dans la suite** :
que `duel_results.team_id` est bien posé pour un duel d'entraînement joué pour son club
(`nvn/index.js:1061`, `m?.teamId`).

**Les routes** — module `src/server/quotidien/index.js`, monté sur `/api/quotidien` après
l'aide ; dépend de `niveau` (pour l'XP) et de rien d'autre ; écrit en SQL dans les tables des
autres modules sans les importer.

| | |
|---|---|
| `GET /api/quotidien` | l'état du jour ; crée la ligne et le contrat à la première lecture ; `?retour=1` ajoute le bloc `depuis` (§ 9) |
| `POST /api/quotidien/bonus` | prend le bonus du jour |
| `POST /api/quotidien/mission` `{ "slot": 1 }` | réclame une mission (recompte, bit, versement) |
| `POST /api/quotidien/coffre` | les trois faites et réclamées → le coffre |
| `POST /api/quotidien/palier` | § 6 |
| `POST /api/quotidien/saison` | § 8 |

```json
// GET /api/quotidien
{
  "jour": "2026-10-02",
  "finDuJourMs": 25187000,
  "bonus": {
    "pret": true,
    "gain": { "echarpes": 30, "packs": 0 },
    "carte": { "case": 3, "cases": 7, "demain": { "echarpes": 35, "packs": 0 } }
  },
  "serie": { "jours": 2, "record": 9 },
  "missions": [
    { "slot": 0, "id": "boosters", "difficulte": "facile", "cible": 3, "fait": 1,
      "reclamee": false, "gain": { "echarpes": 30, "xp": 20 }, "lien": "/boosters" },
    { "slot": 1, "id": "duels", "difficulte": "moyenne", "cible": 2, "fait": 2,
      "reclamee": false, "gain": { "echarpes": 60, "xp": 40 }, "lien": "/duel-nvn" },
    { "slot": 2, "id": "virage_club", "difficulte": "difficile", "cible": 10, "unite": "minutes",
      "fait": 0, "reclamee": false, "gain": { "echarpes": 100, "xp": 60 },
      "lien": "/virage",
      "match": { "id": 1234, "club": "FC Sion", "adversaire": "FC Bâle", "dansMs": 9000000 } }
  ],
  "coffre": { "pret": false, "reclame": false, "gain": { "packs": 1 } },
  "aReclamer": 2
}
```

`aReclamer` compte le bonus, les missions faites non réclamées, le coffre, les paliers et la
saison : c'est la pastille du tiroir. Réclamations : `{ "verse": true, "gain": {…},
"niveau": {…point 1…}, "wallet": { "scarves": 412, "packs": 7 } }` suivi de l'état ; refus en
200 comme l'aide : `{ "verse": false, "raison": "incomplet" | "deja" | "inactif" | "schema" }`.
`quotidien.actif` à faux : la route rend `{ "actif": false }` et l'écran ne montre rien.

**Lecteurs.** `index.html` (la bâche du jour, la plaque or RÉCUPÉRER dont le gain vole, la
bulle « J3 »), `aide.html` (rail DU JOUR), `menu.js` / `nav.js` (pastille MISSIONS **lue dans
le `sessionStorage` que le hub et l'aide remplissent** — pas une requête de plus sur vingt
écrans), `profil.html` (série et record).
**Coût.** `GET` : ~6 lectures indexées (ligne du jour et dernière ligne payée, agrégat des
duels du jour, présence du jour, match du club), +1 écriture à la première visite du jour.
Réclamation : la même relecture plus 2 écritures en transaction. Aucun appel API.

---

## 8. Point 7 — la saison : fin, prochaine ouverture, récompense

**Ce qui existe.** La table `saisons` (`numero`, `nom`, `texte`, les listes JSON, `lancee_a`),
`saisonEnCours()` en mémoire (rechargée à chaque écriture de l'administration), servie par
`/api/fanzzy/dex.saison` et `/state.saison` ; `sets[].saison` (par quelle saison une série est
arrivée) ; `user_wallet.saison_vue`. En production, une seule saison lancée, LA REPRISE, qui
n'ouvre que RP : c'est voulu, on n'y touche pas.

**Le changement.**

```sql
ALTER TABLE saisons ADD COLUMN IF NOT EXISTS fin_le   DATE NULL;   -- dernier jour de la saison
ALTER TABLE saisons ADD COLUMN IF NOT EXISTS ouvre_le DATE NULL;   -- jour annoncé d'un brouillon
```

Des `DATE` et non des `DATETIME` : l'administration saisit un jour, pas une heure, et un jour
ne traverse pas de fuseau. `chargerSaisons` lit `DATE_FORMAT(fin_le, '%Y-%m-%d')` et
`TIMESTAMPDIFF(SECOND, NOW(), fin_le + INTERVAL 1 DAY)`, retient `Date.now()` au chargement,
et sert `finDansMs = secondes × 1000 − (Date.now() − chargé)` : l'écart est mesuré par
l'horloge de MySQL, l'écoulé par celle de Node — aucune date ne traverse la frontière (R1).
Zéro requête par appel.

**La récompense** ne vit pas dans la ligne de saison (l'administration n'a pas d'éditeur JSON,
R9) mais dans trois réglages communs à toutes les saisons (§ 12) : avoir joué au moins
`saison.jours_min` jours de la saison (lignes de `user_jour` avec bonus pris entre le lancement
et `fin_le`) donne `saison.recompense_packs` boosters, plus `saison.echarpes_par_noeud` par
nœud de la plus haute division atteinte dans la saison (`user_paliers` 'division' 'S<id>:n').

```json
// GET /api/fanzzy/dex
"saison": { "id": 1, "numero": 1, "nom": "La reprise", "texte": "…",
            "fin": "2026-11-30", "finDansMs": 5011200000,
            "recompense": { "joursMin": 7, "packs": 2, "echarpesParNoeud": 50 } },
"prochaine": { "numero": 2, "nom": "…", "ouvre": "2026-12-01", "ouvreDansMs": 5097600000 },
"sets": [{ "id": "VN", "ouverte": false, "saison": null, "prochaine": 2 }]
// GET /api/quotidien, une fois la saison finie et tant que ce n'est pas réclamé
"saisonFinie": { "id": 1, "numero": 1, "nom": "La reprise", "joursJoues": 12, "joursMin": 7,
                 "division": 3, "gain": { "packs": 2, "echarpes": 150 }, "pret": true }
```

`prochaine` n'existe que si un brouillon porte `ouvre_le` : poser la date, c'est décider de
l'annoncer. `POST /api/quotidien/saison` verse une fois (`user_paliers`, sorte `saison`,
palier `S<id>`). L'administration : `PUT` d'une saison accepte `fin_le` / `ouvre_le`
(`AAAA-MM-JJ` validés), deux champs date dans `admin.html`, journal existant.

**Lecteurs.** `boosters.html` (banderole de saison ; « SAISON 2 » sur une série fermée
seulement si `prochaine` la nomme), `classement.html` (« SAISON 1 · 12 JOURS »),
`duel-nvn.html` (préparation), `index.html` (bâche du jour), `aide.html` (DE LA SAISON),
`profil.html`.
**Coût.** Nul par requête (mémoire). `/dex` est en cache public de 60 s : `finDansMs` peut
avoir une minute de retard, ce qui ne change rien à un compte en jours.

---

## 9. Point 8 — « depuis ta dernière visite »

**Ce qui existe, daté et lisible sans rien ajouter.**
- `amities` : `repondu_le` (un ami a accepté, dont le parrainage), `demande_le` (une demande
  reçue) — index `(a, etat)` et `(b, etat)`.
- `kop_membres.depuis` (qui est arrivé dans mes KOP), `kop_votes.ferme/issue` (ce qui a été
  adopté), `kop_invites.le` (on m'invite), `kops.verse_total`.
- `fixtures` : les résultats des clubs suivis (`FT`, `AET`, `PEN`), sans appel API.
- `user_souvenirs.acquired_at`, `saisons.lancee_a`, la réserve de boosters.
- Inutilisables pour dater une visite : `users.last_login_at` (à la connexion seulement),
  `sessions.last_seen_at` (au plus une fois par jour).
- **Aucun journal des écharpes** : « +120 écharpes » ne peut pas se dire honnêtement. Ce
  chantier ne le dit donc pas. (Un journal des mouvements toucherait huit endroits qui
  créditent ; il serait aussi le « journal des actions » qui manque — pas le plus petit
  changement, à garder pour plus tard.)

**Le changement.**

```sql
ALTER TABLE user_wallet ADD COLUMN IF NOT EXISTS visite_a    DATETIME(3) NULL;
ALTER TABLE user_wallet ADD COLUMN IF NOT EXISTS visite_prec DATETIME(3) NULL;
ALTER TABLE user_wallet ADD COLUMN IF NOT EXISTS instantane  JSON NULL;  -- verse_total de mes KOP
```

`GET /api/quotidien?retour=1` (le hub, au lever du rideau) : si `visite_a` est nul ou plus
vieux que `quotidien.retour_heures` (3 h), une nouvelle visite commence — `visite_prec ←
visite_a`, `instantane ←` l'état actuel des pots ; puis `visite_a ← NOW(3)`. Tout se compare en
SQL à `visite_prec` ; l'écoulé part en secondes calculées en SQL ; les matchs se cherchent par
`kickoff_at > UTC_TIMESTAMP() - INTERVAL <écoulé> SECOND` (R1). Une catégorie vide est absente,
et `depuis` entier l'est s'il n'y a rien.

```json
"depuis": {
  "ilYaS": 64800,
  "amis": { "nouveaux": [{ "id": "…", "pseudo": "Lucas" }], "demandes": 1 },
  "kop": [{ "id": "…", "nom": "Les Ultras", "arrivees": ["Lucas"],
            "pot": { "avant": 120, "apres": 260 },
            "votes": [{ "bonusId": "fumigenes", "issue": "adopte" }] }],
  "invitationsKop": 1,
  "matchs": [{ "id": 123, "domicile": "FC Sion", "exterieur": "FC Bâle",
               "score": [2, 1], "club": "FC Sion", "issue": "gagne" }],
  "souvenirs": 2,
  "saison": { "numero": 2, "nom": "…" }
}
```

**Lecteurs.** `index.html` / `ouverture.js` (le ticket qui glisse trois secondes au lever du
rideau).
**Coût.** Seulement avec `?retour=1` : ~5 lectures courtes (amitiés, KOP, matchs, souvenirs,
pots) et une écriture. Sans le paramètre, rien.

---

## 10. Point 9 — la présence

**Ce qui existe.** Tout est déjà en mémoire : `roomOfUser` (joueur → match, `ferveur/index.js:49`),
`salleDe` (joueur → duel, `nvn/index.js:48`), `files` (attente). Mais seules cinq pages ouvrent
un socket (`virage`, `duel-nvn`, `kop`, `equipes`, `diagnostic`) : le serveur ne voit pas qui
est sur le hub ou le classeur.

**Le changement — sans socket nouveau ni table.** Ouvrir un socket sur les vingt-quatre écrans
pour une pastille coûterait une connexion permanente par joueur sur un hébergement mutualisé ;
ce n'est pas le plus petit changement. À la place, `src/server/presence.js` :
- `vu(userId)` : un intergiciel posé après `auth.attachUser` note `Date.now()` dans une `Map`
  pour chaque requête `/api` authentifiée — aucune écriture en base ;
- `etat(ids)` → `{ ou: 'virage', fixtureId } | { ou: 'duel' } | { ou: 'file' } | { ou: 'en_ligne' }`
  (activité de moins de 5 minutes) ou rien ;
- le Virage exporte `ouEst(userId)`, le duel `enDuel(userId)` et `enFile(userId)` ;
- branchement tardif, comme `jourDuFoot` : les amis et le KOP sont montés avant le Virage et
  le duel, ils reçoivent `presence: () => presenceModule`. `verif-cablage.mjs` doit le couvrir —
  c'est exactement la dépendance restée à `null` qu'il existe pour attraper.

```json
// GET /api/amis → chaque ami ; GET /api/amis/presence (1 requête : les ids des amis)
"presence": { "ou": "virage", "fixtureId": 1234 }
// ou { "presences": { "<id>": { "ou": "duel" }, "<id2>": { "ou": "en_ligne" } } }
```

**Vie privée.** La présence ne se montre qu'aux amis et aux membres du même KOP, jamais dans
un classement public. Attention : `GET /api/kop/:id` est lisible par **tout compte** (aucun
contrôle d'adhésion dans `etat()`) — la présence des membres n'y part que si le lecteur est
membre. Recommandé : une bascule « me montrer en ligne » dans les réglages du profil
(`user_wallet.presence_cachee`, une colonne) — le public compte des mineurs.

**Lecteurs.** `amis.html` (pastille AU STADE / EN DUEL / EN LIGNE, et « REJOINDRE » vers le
Virage du match), `kop.html` (membres en tribune ; sa salle de socket `kop:<id>` peut plus tard
pousser `kop:presence`).
**Coût.** Zéro en base pour la présence ; la route légère, une requête, interrogée toutes les
30 à 60 s par la page des amis. Mémoire perdue au redémarrage : sans conséquence.

---

## 11. Point 10 — le bilan de tribune du Virage

**Ce qui existe.**
- `virage_presence` : une ligne par joueur et par match (`ferveur`, `side`, `team_id`,
  `fanzzy_id`, `joined_at`, `last_push_at`, `classe`), mise à jour **à chaque chant** par
  `souvenirs.recordPush()` sans attendre (`virage.js:691`).
- Les souvenirs du match : `souvenirs (fixture_id, seq)` unique, `user_souvenirs`.
- En mémoire : `rankOf()` (rang dans sa tribune), `quality` de chaque chant (`virage.js:563`),
  non comptée.
- Rien n'annonce la fin du match aux présents ; `virage.html` propose « QUITTER ? ».
- Au duel, `engine.bilan()` compte `chants`, `cartes`, `preferee`, `chantPrefere`, mais ni les
  gestes parfaits ni la meilleure série.

**Le changement.**

```sql
ALTER TABLE virage_presence ADD COLUMN IF NOT EXISTS chants    SMALLINT UNSIGNED NOT NULL DEFAULT 0;
ALTER TABLE virage_presence ADD COLUMN IF NOT EXISTS parfaits  SMALLINT UNSIGNED NOT NULL DEFAULT 0;
ALTER TABLE virage_presence ADD COLUMN IF NOT EXISTS meilleur  DECIMAL(4,3) NULL;
ALTER TABLE virage_presence ADD COLUMN IF NOT EXISTS serie_max SMALLINT UNSIGNED NOT NULL DEFAULT 0;
```

- `chant()` passe `quality` et la série en cours du membre (`m.serie`, en mémoire) à
  `crediter()` → `onPush` ; `recordPush` ajoute `chants = chants + 1`,
  `parfaits = parfaits + ?`, `meilleur = GREATEST(COALESCE(meilleur, 0), ?)`,
  `serie_max = GREATEST(serie_max, ?)` **dans l'upsert qui existe** (zéro requête de plus) ;
  une carte d'action passe `quality` nul et ne compte pas comme chant.
- **Le seuil de PARFAIT doit sortir de la page.** Il n'existe qu'en dur dans
  `virage.html:1933` (`> 0.9`, BON `> 0.7`, MOYEN `> 0.4`) ; le serveur va compter des
  « parfaits » : un module partagé `src/shared/verdict.js` les porte, et les deux arènes le lisent.
- **Au coup de sifflet** (`matchStatus` reçoit `FT`, `AET` ou `PEN`) : une lecture de toutes
  les présences du match et une des souvenirs du match (**deux requêtes par salle**), rangs
  calculés en mémoire par camp, puis un `virage:bilan` **par socket** (`fetchSockets()` de la
  salle). Pas une route appelée par chacun au même instant : trois cents présents feraient
  douze cents requêtes en trois secondes.
- `GET /api/virage/bilan/:fixtureId` (requireAuth) pour relire plus tard : quatre lectures.
- Duel : `j.parfaits`, `j.meilleur`, `j.serieMax` comptés dans l'engin et posés dans `bilan()`
  (mémoire, zéro requête).

```json
{ "fixtureId": 1234, "fini": true, "score": [2, 1],
  "camp": 0, "club": "FC Sion", "neutre": false, "classe": true,
  "ferveur": 418, "rang": 7, "sur": 64, "minutes": 52,
  "chants": 96, "parfaits": 31, "meilleur": 0.982, "serieMax": 9,
  "souvenirs": [{ "id": 991, "minute": 67, "joueur": "…", "score": [1, 1] }] }
```

**Lecteurs.** `virage.html` (bilan sur page kraft à la place de « QUITTER ? »), `profil.html`
(une ligne de parcours Virage ouvre son bilan), `carnet.html` (souvenirs du match).
**Coût.** Par chant : rien. Au sifflet : deux requêtes par salle. Relecture : quatre.

---

## 12. Les réglages proposés (registre `src/shared/reglages.js`)

Deux sections neuves : `quotidien` (« LE QUOTIDIEN — missions, bonus, série ») et `paliers`
(« LES PALIERS ET LA SAISON »). Tout s'ajuste depuis `/admin` sans livraison ; `/admin` dessine
ces lignes sans une ligne de code de plus (ce sont des entiers et des booléens, R9).

| clé | type | défaut | bornes | ce qu'elle règle |
|---|---|---|---|---|
| `quotidien.actif` | booléen | vrai | — | missions, bonus et série ; faux = la route rend `{ actif: false }` |
| `quotidien.bonus_base` | entier | 20 | 0–200 | écharpes de la première case de la carte |
| `quotidien.bonus_pas` | entier | 5 | 0–100 | écharpes de plus par case (20, 25 … 50) |
| `quotidien.bonus_cases` | entier | 7 | 1–31 | cases d'une carte avant qu'elle recommence |
| `quotidien.bonus_packs_derniere` | entier | 1 | 0–5 | boosters de la dernière case |
| `quotidien.retour_heures` | entier | 3 | 1–48 | absence qui fait commencer une nouvelle visite (§ 9) |
| `missions.boosters` | entier | 3 | 1–12 | cible de la mission facile |
| `missions.duels` | entier | 2 | 1–10 | cible de « joue des duels » |
| `missions.victoires` | entier | 1 | 1–5 | cible de « gagne » |
| `missions.virage_minutes` | entier | 10 | 1–90 | minutes de poussée dans le Virage de son club |
| `missions.virage_club` | booléen | vrai | — | faux = la mission difficile est toujours « un duel pour ton club » |
| `missions.facile_echarpes` / `_xp` | entier | 30 / 20 | 0–500 | gain de l'emplacement 0 |
| `missions.moyenne_echarpes` / `_xp` | entier | 60 / 40 | 0–500 | gain de l'emplacement 1 |
| `missions.difficile_echarpes` / `_xp` | entier | 100 / 60 | 0–500 | gain de l'emplacement 2 |
| `missions.coffre_packs` | entier | 1 | 0–5 | boosters quand les trois sont réclamées |
| `paliers.collection_pas` | entier | 25 | 5–200 | un cran tous les N objets gagnés |
| `paliers.collection_packs` / `_echarpes` | entier | 1 / 20 | 0–10 / 0–500 | gain d'un cran |
| `paliers.serie_packs` / `_echarpes` | entier | 3 / 100 | 0–10 / 0–1000 | série complète |
| `cote.division_2` / `_3` / `_4` | entier | 1050 / 1150 / 1300 | 600–3000 | seuils de cote des nœuds (section duel) |
| `paliers.division_echarpes` | entier | 50 | 0–500 | par nœud, la première fois dans la saison (2 nœuds : 100) |
| `saison.jours_min` | entier | 7 | 0–90 | jours joués pour la récompense de fin |
| `saison.recompense_packs` | entier | 2 | 0–10 | boosters de fin de saison |
| `saison.echarpes_par_noeud` | entier | 50 | 0–500 | par nœud de la plus haute division de la saison |

Ordres de grandeur, pour les relire (montants : `ECONOMIE.md` fait foi). Un joueur qui fait
tout reçoit en moyenne ~35 écharpes par jour de carte et un booster par semaine, 190 écharpes,
120 XP et un booster par jour de missions. Une victoire classée pour son club en paie 60, un
booster complet (collection RP finie) rend à peu près son prix (45) en doublons et poignées :
le quotidien est un **complément**, la même règle que les écharpes de palier
(`shared/niveau.js` : « de quoi sentir la montée, jamais de quoi remplacer les doublons »).
Les seuils de division supposent une cote de départ à 1000 et un K de 48 puis 24 : à valider
sur les cotes réelles de production avant le lancement de la récompense de saison.

---

## 13. Le coût, écran par écran

| écran | requêtes en plus | quand | API sportive |
|---|---|---|---|
| `/` (hub) | 1 route (`/api/quotidien?retour=1`) ≈ 6 lectures + 1 écriture/jour, + ~5 au début d'une visite | au lever du rideau ; garder la réponse 60 s en `sessionStorage` | 0 |
| 20 autres écrans (barre, tiroir) | 0 | la pastille lit le `sessionStorage` | 0 |
| `/boosters` | +1 écriture (`user_jour`), +1 si du neuf (`user_nouveautes`) | par booster, après validation | 0 |
| `/fanzzy`, `/collection` | +1 lecture (`nouveautes` sur `/state`), +1 (`user_paliers` sur `/bibliotheque`) | à l'ouverture | 0 |
| `/duel-nvn` (fin) | 0 (lecture de cote déplacée), +1 `INSERT IGNORE` au franchissement de division | fin de duel classé | 0 |
| `/classement` | +3 par calcul de liste (mémo 5 min), `/moi` +1 lecture, ≤ 1 écriture/jour | — | 0 |
| `/kop` | +3 par `etat()` (relu toutes les 30 s) → mémo 60 s par KOP conseillé | — | 0 |
| `/amis` | 0 (avatar existe, `xp` ajouté au `SELECT`) ; présence 1 requête par sondage | 30–60 s | 0 |
| `/virage` | 0 par chant ; 2 par salle au sifflet ; 4 par relecture du bilan | — | 0 |

Aucune jointure lourde nouvelle : tout passe par une clé primaire ou un index qui commence par
`user_id`, sauf les classements, déjà mémoïsés.

---

## 14. Ordre de livraison et suites

1. **Sans schéma** (1,5 j) — points 1, 3, 4a-b (cote dans le bilan, divisions), compteurs du
   duel du point 10. Rien à appliquer en base ; déployable seul.
2. **`sql/quotidien.sql`** (6 à 7 j) — `user_jour`, `user_paliers`, `user_nouveautes`, les
   colonnes de `user_wallet` (`rangs_vus`, `visite_a`, `visite_prec`, `instantane`,
   `presence_cachee`), de `saisons` (`fin_le`, `ouvre_le`) et de `virage_presence` (4) ; puis
   les points 6 et 8 (une route), 2, 5, 7, 4c, 10-Virage. Ajouter `'quotidien'` en fin
   d'`ORDRE` ; `schema-smoke` le vérifie.
3. **Mémoire** (1 j) — point 9, avec `verif-cablage`.

**Suites** : une neuve, `scripts/quotidien-smoke.mjs` (contrat figé, recompte, double
réclamation en parallèle → un seul versement, ligne d'hier posée en SQL pour la série, carte
qui ne recule pas, abonné = non-abonné, table absente → `actif` sans 500, forfait qui ne fait
pas la mission) ; et des contrôles ajoutés à `fanzzy-smoke` (nouveautés, `niveau.dans/pour`,
`series`), `nvn-smoke` (`gains.cote`, `gains.niveau` sans montée), `classement-smoke` (avatar,
`evolution`), `kop-smoke` (avatar, présence refusée au non-membre), `amis-smoke`,
`virage-smoke` (compteurs, `virage:bilan`), `reglages-smoke` (nouvelles clés). Chaque contrôle
cassé exprès une fois (ETAT § 2).

---

## 15. Trouvé en passant (hors périmètre, à aiguiller)

- **Probable défaut de fuseau au KOP.** `kop.etat()` rend
  `fermeDansMs = new Date(vote.ferme) - Date.now()`, où `ferme` est écrit par
  `NOW(3) + INTERVAL` et relu par le pilote en `timezone: 'Z'` : sur une base à l'heure de
  Zurich, le chrono affiché après un rechargement dure **deux heures de trop**, et `voter()`
  compare de la même façon (`new Date(v.ferme) <= new Date()`). `kop-smoke` ne contrôle la
  valeur qu'à la création (`DUREE_VOTE_MS`). Même famille que `amis.lien`, déjà corrigé ;
  remède : l'écart en SQL (`TIMESTAMPDIFF(MICROSECOND, NOW(3), ferme)`). Il touche le vote en
  case de BD du lot 5.
- **`/api/kop/:id` lisible par tout compte**, sans contrôle d'adhésion (membres, votes, pot).
- **`schema.js` ne contrôle que le premier `ADD COLUMN` d'un `ALTER`** : `color2` et
  `colors_at` de `sql/couleurs.sql` ne sont jamais vérifiées au démarrage.
- **Le registre annonce l'étal en « billets »** (`etal.*`, `unite: 'billets'`) alors qu'il se
  paie en écharpes (`shared/etal.js`) : l'administration affiche la mauvaise monnaie.
- **Servis, lus par personne** : `/api/fanzzy/dex.rates` (les taux de tirage, que JURIDIQUE
  § 2 question 3 propose d'afficher), `/api/niveau.gains` (le barème d'XP, que les missions et
  le butin peuvent annoncer sans le recopier), `kop.etat().membres[].depuis`.
- **`periode=saison` veut dire « depuis toujours »** sur `/api/rank/supporters` (`depuis()`
  rend une chaîne vide) : le mot entre en collision avec la saison du jeu dès que la banderole
  s'affiche au-dessus.

## 16. Ce qui reste à faire confirmer

Gaël a délégué le contenu ; restent trois choix qui ne sont pas des montants :

1. **Le classement repart-il à zéro à chaque saison ?** Proposé : non pour la saison 1 (la
   saison n'apporte que sa banderole, sa date et sa récompense de fin).
2. **La présence « en ligne » visible des amis par défaut**, avec une bascule pour s'en
   retirer — ou cachée par défaut.
3. **Le fuseau de la base en production** (R1) : une requête à lancer une fois, pour savoir à
   quelle heure le jour de jeu change.
