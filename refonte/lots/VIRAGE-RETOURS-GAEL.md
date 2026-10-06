# Correctif d'urgence du Grand Virage : à savoir

Base : commit 0638fb5, c'est-à-dire le code en ligne. Branche `hotfix-virage`, dans la copie `.claude/worktrees/hotfix-virage`. Rien n'est commité.
Patch : `hotfix-virage.patch`, dans ce dossier (97 513 octets, 7 fichiers, 1452 ajouts, 65 retraits, LF seulement, sha1 7109db72e8f862e2e3b6a92b4540bcdc26137812).
`git apply --check` passe à blanc sur la copie principale : aucun des 7 fichiers n'y est modifié par l'atelier en cours.

Aucune règle de jeu ne change. Le geste reste noté par le serveur. Le correctif répare ce que la page apprend et ce qu'elle montre.

## Ce qui change pour le joueur

1. **Les cartes ne se bloquent plus.** Avant, une case de la main restait vide et une carte en recharge restait grise avec un chiffre figé. Au bout d'environ une demi-minute, on ne pouvait plus rien jouer avant d'avoir rechargé la page.
   - Maintenant, chaque carte tirée apparaît dans la main, et dans tous les onglets ouverts.
   - Le chiffre de recharge descend, et la carte redevient jouable seule à zéro.
   - La jauge de souffle ne promet plus un souffle qu'on n'a pas.
   - Si la page se trompe quand même, le serveur refuse la carte et renvoie la vraie main : l'écart se répare seul.
2. **Un but déjà au tableau ne sonne plus « GOAL ! ».** Exemple : on entre à 2-1 à la 50e, et le but de la 9e arrive en retard. Il n'y a plus de « GOAL ! », plus de secousse de la corde ni de minute double, et la minute et le score ne reculent plus. Un but frais sonne comme avant.
   - Un but dont l'API corrige le buteur ne sonne pas une seconde fois.
   - De même, un carton rouge ou une décision vidéo d'avant l'entrée ne fait plus réagir le personnage. Ils restent dans le fil et sur la feuille.
3. **Pendant un geste, rien ne couvre le pavé.** Si un but, un rouge ou un but de corde tombe pendant qu'on chante :
   - la tribune s'embrase, et le score et le fil se mettent à jour tout de suite ;
   - le téléphone vibre ;
   - la case « GOAL ! », le flash, les titres, la secousse et la carte-souvenir attendent la fin du geste.
   - Une case déjà affichée s'efface quand le geste s'ouvre. Une carte-souvenir déjà affichée se range, puis revient ensuite pour le temps qu'il lui restait.
   - La carte-souvenir ne prend plus les appuis du doigt.
4. **Une carte jouée ne revient plus au milieu de l'écran après son vol.** Le joueur croyait l'avoir jouée deux fois. Le duel est corrigé du même coup, puisqu'il utilise la même fonction.

## Les fichiers

| Fichier | Ce qui change |
|---|---|
| `public/action-art.js` | `fill: 'forwards'` sur les deux `el.animate` (vol normal et mouvement réduit) |
| `public/virage.html` | décompte des recharges (`cdVuA`, `rechargeRestante`) ; souffle remis à l'heure par `virage:state` et `virage:vous` ; file `apresLaFenetre` / `viderApresLeGeste` ; `scene.couper()` et `rangerLeSouvenir()` à l'ouverture du geste ; `.souvenir` en `pointer-events:none` ; garde du fil (`entreeMinute`, `minuteApprise`, `dAvantLEntree`) |
| `src/server/ferveur/virage.js` | canal `emitVous` ; `dirtyMain` lu au battement (la main part au tirage) ; garde du but connu dans `realGoal` (`butsConnus`, `minuteOuverture`, `butsAnnonces`) ; le score et la minute ne reculent plus ; `matchStatus` fait redescendre `butsConnus` après un but annulé par la vidéo |
| `src/server/ferveur/index.js` | `aSesOnglets` (la main envoyée à toutes les sockets du joueur) ; filet `REFUS_DE_MAIN` (la vraie main renvoyée après un refus) ; `realGoal` rend le verdict de la salle |
| `scripts/virage-smoke.mjs`, `scripts/virage-ui-smoke.mjs`, `scripts/actions-ui-smoke.mjs` | les contrôles des quatre défauts |

## Les contrôles (base `test_hotfix`)

- `npm run pages`, `npm run cablage` et `npm run promesses` sont verts. `promesses` donne l'avertissement habituel : 6 pages sans suite d'interface.
- `tout-tester.mjs` : 64 suites, 4774 contrôles. 61 sont vertes, 3 rouges, toutes déjà connues avant le correctif :
  - `deck:ui` (1) et `nvn:ui` (3) échouent avec le même texte, mot pour mot, que dans la copie principale sans le correctif ;
  - `accueil:ui` est tombée sur un délai, la machine étant chargée. Relancée seule, elle passe (214 contrôles).
- Résultats des suites touchées et voisines :
  - `virage:smoke` : 230 contrôles ;
  - `virage:ui` : 136 ;
  - `actions:ui` : 19 ;
  - `salles:test` : 134 ;
  - `releve:test` : 56 ;
  - `nvn:smoke` : 84 ;
  - `souvenirs:smoke` : 49 ;
  - `abo:smoke` : 78.
- Vérifications indépendantes, faites hors des suites :
  - **Cartes, en simulation** : 0 partie bloquée sur 600. Avant le correctif : 100 sur 100, avec une attente pouvant aller jusqu'à 148 s.
  - **Cartes, de bout en bout dans Chrome** : une carte toutes les 5 s pendant 3 min, soit 35 cartes cliquées et 35 acceptées. Jamais de blocage, et aucune carte ne revient.
  - **But ancien, sur le vrai relevé (scénarios S1 à S8)** :
    - S2, S6 et S7 sont désormais muets ;
    - S4 et S5 annoncent toujours le but frais ;
    - S8 sort encore au fil côté serveur, et la page le tait.
  - **Alertes pendant un vrai geste** : aucun calque sur les 25 points du pavé, 2 appuis sur 2 reçus, puis « GOAL ! » et la carte-souvenir à la fermeture.
  - **Double carte** : 0 carte revenue sur 20, contre 20 sur 20 avant, en vol normal comme en mouvement réduit.
- `git diff --check` est propre. Il n'y a aucun CR dans les 7 fichiers ni dans le patch.

## Ordre de mise en ligne

1. **Le serveur et la page partent ensemble, dans le même commit.** L'un sans l'autre laisse des blocages de main : avec la page seule, 381 parties bloquées sur 400 ; avec le serveur seul, 353 sur 400. Il n'y a ni schéma ni fichier `sql/` à appliquer.
2. Dans la copie principale : `git apply` du patch, puis un commit **de ces 7 fichiers seulement**. Ne pas faire un « Maj » de tout : `scripts/deployer.sh` fait `git reset --hard origin/main`, et l'atelier en cours a des modifications non commitées dans `server.js`, `poller.js`, `aide/index.js`, `serveur/*.md` et quelques pages et suites. Elles partiraient en ligne à moitié faites.
3. Déployer **hors d'un match en direct où des joueurs sont au Virage**. Le patch ne l'exige pas, mais tout redémarrage le rend souhaitable : les salles vivent en mémoire (`rooms`, une `Map`), donc un redémarrage en plein match efface la corde, les buts de tribune, les mains et la minute double de tous les présents.
4. Une page ouverte avant le déploiement garde l'ancien code jusqu'à son rechargement. Avec le nouveau serveur, elle reçoit déjà la main à chaque tirage, ce qui la débloque en partie. Le décompte des recharges n'arrive qu'après rechargement.
5. Après la mise en ligne, vérifier dans un vrai match :
   - jouer des cartes pendant quelques minutes : la main doit se remplir et les chiffres de recharge descendre ;
   - jouer une carte : elle ne doit pas réapparaître au centre après son vol.

## À reporter à la main dans la copie du lot 6

La copie du lot 6 (`.claude/worktrees/lot6`, base 7450c03) a beaucoup bougé depuis l'enquête. Les numéros de ligne ci-dessous ont été relus le 4 octobre 2026 vers 22 h 30. Ils bougeront encore : chaque point est donc ancré sur le texte qui l'entoure.

Dry-run du patch, fichier par fichier, sur cette copie (lecture seule) :
- `public/action-art.js`, `scripts/actions-ui-smoke.mjs` et `scripts/virage-ui-smoke.mjs` s'appliquent tels quels ;
- `public/virage.html`, `scripts/virage-smoke.mjs`, `ferveur/index.js` et `ferveur/virage.js` ne s'appliquent pas.

Attention pour `scripts/virage-ui-smoke.mjs` : il s'applique au texte près, mais ses nouveaux contrôles visent la page actuelle (`.tbf-moment.on`, `#souvenir.souvenir.on`, `#hand`). Il faut les reprendre sur la page réécrite.

### `public/action-art.js` (modifié par le lot)

Seulement deux mots à ajouter. `git apply --include=public/action-art.js hotfix-virage.patch` passe aussi.
- l.287 : `{ duration: 1400, easing: 'ease' }` devient `{ duration: 1400, easing: 'ease', fill: 'forwards' }` ;
- l.316 : `], { duration: 1250, easing: 'cubic-bezier(.2,.9,.25,1)' });` reçoit `fill: 'forwards'` ;
- reprendre aussi le paragraphe ajouté au commentaire de `retirer`.

### Serveur du Virage (réécrit par la partie B : à lui transmettre)

`src/server/ferveur/virage.js` :
- **l.262** `constructor({ fixture, emit, onPush, onGoal, log = console })` : ajouter `emitVous` aux paramètres, puis `this.emitVous = emitVous;` après `this.emit = emit;` (l.264).
- **l.308**, après `this.scoreReel = [fixture.homeGoals ?? 0, fixture.awayGoals ?? 0];` : `this.butsConnus = …`, `this.minuteOuverture = …` et `this.butsAnnonces = [];`, avec leurs commentaires (lignes 253 à 277 de la copie hotfix).
- **l.1367 à 1375**, `realGoal` :
  - mettre en tête la garde `rang` / `quand` / `dAvant` / `revenu` qui rend `false`, puis la mise à jour de `butsConnus` et de `butsAnnonces` ;
  - remplacer `this.scoreReel = [...score]` par le `Math.max` composante par composante ;
  - remplacer `if (minute != null) this.minute = minute;` par `if (Number.isFinite(quand) && !(this.minute > quand)) this.minute = quand;` ;
  - mettre `return true;` en dernière ligne, après le `scoreGoal` de la l.1392.
- **l.1462**, `matchStatus` : dans le `if (homeGoals != null && awayGoals != null)`, ajouter `this.butsConnus = Math.min(this.butsConnus, (Number(homeGoals) || 0) + (Number(awayGoals) || 0));`.
- **l.1514**, juste après `this.entretenirCartes(now);` : la boucle `for (const [userId, m] of this.members) { if (!m.dirtyMain) continue; m.dirtyMain = false; this.emitVous?.(userId, this.snapshotFor(userId).you); }`. Le tirage est toujours à la l.1329 et pose `m.dirtyMain = true`.

`src/server/ferveur/index.js` :
- Le lot a déjà `auJoueur(fixtureId, userId, evenement, charge)` à la l.460, qui envoie à toutes les sockets du joueur. Il remplace `aSesOnglets`.
- **l.236**, dans `buildRoom`, à côté de `emit:` : `emitVous: (userId, you) => auJoueur(f.id, userId, 'virage:vous', you),`. Il faut bien `f.id` : la table `socketsDe` est rangée sous l'identifiant du match de la salle (voir l.876, `room.fixture.id`).
- **l.971**, après `room.jouer` : `socket.emit('virage:vous', …)` devient `auJoueur(fixtureId, u.userId, 'virage:vous', room.snapshotFor(u.userId).you);`.
- **l.973**, `catch` : après `socket.emit('virage:error', …)`, renvoyer la main à cette socket quand `REFUS_DE_MAIN.has(e.code) && room.members.has(u.userId)`. Il faut aussi déclarer `REFUS_DE_MAIN` près de `salleDe` (l.578).
- **l.1024 à 1034**, `realGoal` : `return room.realGoal({…});` à la place de `room.realGoal({…}); return true;`, avec le commentaire.
- Tests : reprendre les blocs ajoutés à `scripts/virage-smoke.mjs` (main au tirage, deux onglets, filet, but connu).

### `public/virage.html` (réécrit par le lot)

Le lot a déjà la file `apresLaFenetre` (l.1501 à 1504) et la carte-souvenir en `pointer-events:none` (`.tbf-souvenir`, ui.css l.11100). La carte attend aussi le geste avant de se montrer (`annoncerSouvenir`, l.1741).

- **Recharges.** Près de `let souffleVuA = Date.now();` (l.1109), ajouter `let cdVuA = Date.now();` et la fonction `rechargeRestante(id)`.
  - Dans `renderActes`, l.1641, `const reste = Number(cd[id]) || 0;` devient `const reste = rechargeRestante(id);`. La l.1610 (`const cd = …`) ne sert alors plus.
  - Dans `jouerActe`, l.1683, le refus local `if ((S?.you?.cooldowns ?? {})[a.id])` devient `if (rechargeRestante(a.id) > 0)`. Sans ce changement, le refus « Cette carte se recharge encore » ne s'arrête jamais.
- **Sticker « DUEL SEULEMENT »** (propre au lot). À la l.1606, `let duel = S?.you?.ecartees ?? 0;` pose le sticker sur la case vide du tirage, et donne donc une fausse explication. Il n'en faut que `Math.max(0, mainVisible - (taille du deck - ecartees))`. La synthèse donne `10 - ecartees` pour le deck de dix.
- **`virage:state`** (l.2182) : `souffleVuA = cdVuA = entreeA = Date.now(); entreeMinute = s.minute ?? null;`.
- **`virage:vous`** (l.2381) : `souffleVuA = cdVuA = Date.now();` avant `render()`. Le rangement de la main est déjà caché si elle est vide (l.1600) : il réapparaît avec la carte tirée.
- **Garde du fil.** Ajouter `entreeMinute`, `entreeA`, `minuteApprise` et `dAvantLEntree` (copie hotfix, l.1433 à 1468).
  - `virage:fil` (l.2207 à 2215) : `minuteApprise(f.minute)` avant `renderFil`, puis `for (const e of f.entrees ?? []) { if (dAvantLEntree(e)) continue; apresLaFenetre(() => reagirAuFil(e)); }`.
  - `virage:match` (l.2340) : `minuteApprise(v.minute)` après `S.minute = …`.
- **Alertes pendant le geste.**
  - `openMini`, l.1426 : après `TBF_ACTION?.suspendre?.()`, ajouter `scene?.couper?.();`.
  - `virage:goal` (l.2282) : envelopper dans `apresLaFenetre(() => { … })` `FX.but({vignette:true})` (l.2290), qui secoue l'écran, ainsi que `celebrer()` et `scene.moment` / `banner` (l.2293 à 2300). Garder immédiats `stade.embraser`, `FX.son`, la rumeur, et un `buzz` si `busy` (voir `sentirLeBut`).
  - `virage:real_goal` (l.2303) : de même pour `FX.but` (l.2313), `celebrer()` et `scene.moment` (l.2318 à 2322). Garder immédiats `embraser`, `scoreReel` / `renderFil`, `noterDouble`, la rumeur et `FX.son`.
  - Le `finally` (l.1537 à 1539) vide la file juste après `busy = false`, donc **avant** le `render()` final (l.1547). La copie hotfix vide la file après `render()` : sinon la pose de fond demandée par `render` passe devant la célébration. Elle protège aussi chaque effet par un `try/catch` (`viderApresLeGeste`). Mieux vaut faire de même.
  - À vérifier sur le lot : une carte-souvenir **déjà** à l'écran à l'ouverture du geste (`.tbf-souvenir`, fixe, top 40 %, z 96) reste par-dessus le pavé. C'est l'équivalent de `rangerLeSouvenir` dans la copie hotfix.
  - Ajouter la fenêtre du geste à l'ordre des calques de BRIEF-LOT6.md.
- À la fusion du lot : garder son `virage.html` et son `action-art.js`, une fois ces reports faits. Ne pas reprendre ceux du correctif.

## Reste à trancher par Gaël (hors correctif)

- **Ce qui reste visible quand plusieurs moments tombent pendant le geste.** *Tranché par Gaël le 6 octobre 2026 (« on affiche toujours en premier ce qui est lié au jeu ») et fait : les moments tombés pendant un geste se montrent l'un après l'autre, 3,5 secondes chacun, la corde d'abord, puis ce que le match a fait, et le but réel en dernier, qui reste à l'écran (`HISTORIQUE.md`, 4 quinquagies quater).* Avant : la file rejoue les moments dans l'ordre, et `scene.moment` garde le dernier. Si un rouge ou un but de corde suit le but réel pendant le même geste, c'est « ROUGE POUR EUX » qui reste à l'écran, pas « GOAL ! ». Les titres, le bandeau et la carte-souvenir du but passent quand même. Donner la priorité au but est un choix d'interface.
- **Les autres effets d'un but ancien.** Un but ancien continue de frapper la carte-souvenir (pour ceux qui ont chanté dans les 2 dernières minutes) et de compter au duel : `server.js` ignore le retour de `realGoal`. Deux remèdes possibles :
  - faire redemander les événements au relevé tant que sa liste compte moins de buts que le tableau ;
  - plafonner l'âge d'un but.
- **Un trou dans les tests.** Aucune suite ne fait passer les scénarios S2 ou S7 du relevé jusqu'à la salle. Seul le banc de vérification couvre ce chemin aujourd'hui.
