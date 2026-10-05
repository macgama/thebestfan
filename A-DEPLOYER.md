# À déposer sur Infomaniak

**Le lot 6 de la refonte, « les arènes ».** Le Grand Virage et le duel de tribunes
(un HUD, une corde, une main, un pavé et un rituel de sortie communs), le **bilan de
tribune** du Virage et celui du duel, le **verdict servi** et son tampon, le **son
branché sur le match**, et la **vague 2 du serveur** : le bilan et l'XP du Virage, le
verdict, le rang et le palier, la fin de match, la présence des amis — **éteinte**.
Le récit est dans `HISTORIQUE.md`, section 4 quadragies sexies ; le détail du serveur
dans `serveur/ECARTS.md`, « Vague 2 », et son contrat dans `serveur/CONTRATS.md`,
§ 15 à § 18 (le § 15 est le bilan de tribune ; le contrat du correctif du Virage,
déclaré « § 15 » par l'intégration, vit aux § 16.2, § 16.5 et § 16.6).

**Un schéma est à appliquer : `sql/arenes.sql`, d'abord, par `npm run
schema:appliquer` en SSH, puis un redémarrage, hors d'un match en direct.** Le
serveur, les pages et le schéma partent **ensemble, dans le même commit** — jamais
les écrans seuls : ils tolèrent l'absence de chaque champ, mais n'apprendraient rien
à personne. **La présence reste éteinte** (`presence.actif` faux) jusqu'à la mise
en ligne de la nouvelle `CONFIDENTIALITE.md`.

---

## Où en sont le dépôt et la production

Relevé le 5 octobre 2026 vers 5 h 35.

- **La production sert `524b2ca`** (« Maj V04.10.2026.2049 »), commité par Gaël le
  5 octobre à 5 h 18 et poussé sur `origin/main` : le lot 4, le correctif des salles
  du Grand Virage et le sachet de LA REPRISE (`0638fb5`), puis l'intégration — la
  photo du tunnel, le bandeau du but, le penalty et la séance à `/matchs`,
  MANQUANTS, le câblage de l'aide — et **le correctif d'urgence des quatre retours
  de Gaël** (des cartes qui ne revenaient pas dans la main, de vieux buts annoncés,
  des alertes posées sur le pavé du geste, une carte jouée affichée deux fois).
  `/healthz` répond `ok: true`, sans panne, `"virage": "0 salle(s)"` ; `uptime_s`
  (952) dit un redémarrage vers 5 h 19, par le Manager (`"version": null`) ;
  `virage.html` et `action-art.js` servis sont ceux de `524b2ca`, octet pour octet.
  **Rien du lot 6 n'y est.**
- **Le lot 6 est versé dans la copie principale, pas commité.** Le 5 octobre au
  matin, sur `524b2ca` propre, par le patch de la copie du lot (`git diff --binary
  7450c03`, 70 fichiers) appliqué en trois voies ; ses dix conflits tranchés par
  leur règle (`HISTORIQUE.md`, « La fusion dans la copie principale »), et les deux
  fautes de `ui.css` que le lot laissait, corrigées. `git status` montre **69
  fichiers** : 63 modifiés et 6 neufs (`sql/arenes.sql`, `src/server/ferveur/bilan.js`,
  `src/server/presence/index.js`, `src/shared/verdict.js`, `scripts/presence-smoke.mjs`,
  `scripts/verdict-smoke.mjs`, marqués par `git add -N`) — les 65 du lot, et cette
  trace : `HISTORIQUE.md`, `ETAT.md`, ce fichier, `README.md`. Les quatre fichiers
  que les deux côtés écrivaient à l'identique et `poller.js`, gardé tel quel, n'y
  paraissent pas.
- **Le schéma de production n'a pas `arenes.sql`.** Le démarrage le nommera tant
  qu'il manque, comme pour `quotidien.sql` le 3 octobre (plus bas).
- **La branche `refonte-lot6`** (`.claude/worktrees/lot6`) est toujours à `7450c03`,
  rien n'y est commité : la copie principale porte tout. Sa base `test_lot6` peut
  être supprimée une fois la livraison faite. **La copie principale n'a pas de
  `.tbf-base-de-test`, et ne doit pas en avoir.**
- **La saison 1 n'a toujours pas de date de fin** au dernier relevé (5 octobre,
  0 h 38 : `/api/fanzzy/dex` sert `"lancee": true`, `"finie": false`, aucune `fin`).

---

## Ce qui part, et dans quel ordre

- **Le schéma : `sql/arenes.sql`**, le trente-quatrième fichier, en dernier de
  `scripts/ordre-schema.mjs`. **Six instructions** — `virage_presence.parfaits`,
  `serie_max`, `meilleur_q`, `meilleur_chant` ; l'index `idx_bilan (fixture_id, side,
  ferveur)` ; `user_wallet.presence` —, **additives et rejouables**, rien de renommé,
  aucune reprise de données. Les lignes de présence déjà écrites partent à zéro
  PARFAIT et sans meilleur chant. Le code d'avant ne lit aucune de ces colonnes : il
  tourne pareil avant et après.
- **Le serveur** : `server.js` (la présence montée, branchée aux deux arènes, passée
  aux amis et au Virage ; `niveau` passé au Virage ; `virage.souvenirFrappe` appelé
  après la frappe d'une carte-souvenir ; `createAide({ …, fanzzy })` de l'intégration,
  gardé), `src/server/ferveur/` (le bilan, l'XP, le verdict, la série, le rang,
  `virage:fin` et `virage:ferme`, `virage:souvenir` aux seuls receveurs ; la main
  envoyée à toutes les sockets du joueur par `auJoueur`, qui remplace l'`aSesOnglets`
  du correctif d'urgence en ligne), `src/server/nvn/`, `src/server/deck/`,
  `src/server/repetition/` (le verdict, les PARFAITS et le meilleur geste du duel,
  `enJeu`), `src/server/presence/` (neuf), `src/server/souvenirs/`,
  `src/shared/verdict.js`, `src/shared/reglages.js` (sept réglages),
  `src/server/recompenses.js` (la source `virage`), `src/server/auth/store.js` (la
  préférence de présence s'efface avec le compte), `src/server/amis/`.
- **Les pages** : `virage.html`, `duel-nvn.html`, `repetition.html`, `amis.html`, et
  les briques que tout le monde charge — `ui.css` (pour l'essentiel les pièces
  d'arène), `nav.js`, `menu.js`, `fx.js`, `son.js`, `geste.js`, `action-art.js`,
  `chant-art.js`, `stade-art.js`, `fanzzy-scene.js`. **Les briques sont partagées : la
  barre et le tiroir de chaque écran passent par elles**, et la case de BD (GOAL !,
  VICTOIRE, NIVEAU 5) a changé d'interligne. Les contrôles à l'œil ne s'arrêtent pas
  aux deux arènes (plus bas).
- **Les documents** : `CONFIDENTIALITE.md` (le paragraphe « La présence de tes
  amis », marqué « à faire relire — pas encore en service »), `DEPLOIEMENT.md`,
  `serveur/CONTRATS.md`, `serveur/ECARTS.md`, `HISTORIQUE.md`, `ETAT.md`,
  `README.md`, ce fichier.
- **Les suites** : deux neuves (`verdict:smoke`, `presence:smoke`), les autres
  réécrites ou agrandies ; `.gitignore` (la ligne `.tbf-base-de-test`) et
  `scripts/base-de-test.mjs` (sans ce fichier, rien ne change).

**L'ordre** :

1. **Le schéma d'abord.** Par le Manager d'Infomaniak, qui ne l'applique jamais :
   dès que la construction a posé le code sur le serveur, **`npm run
   schema:appliquer` en SSH**, puis **redémarrer** depuis l'onglet Node.js — le
   contrôle de démarrage et `/healthz` ne relisent la base qu'au lancement. Par
   GitHub, le workflow (`.github/workflows/deploiement.yml`) l'applique **avant** le
   redémarrage : rien de plus à faire. Le fichier est rejouable : le rejouer un
   deuxième jour ne fait rien.
2. **Le serveur et les pages ensemble.** Un seul commit : **ne pas faire un « Maj »
   de tout** sans avoir regardé `git status`. `scripts/deployer.sh` fait `git reset
   --hard origin/main` : ce qui est dans la copie sans être dans le commit n'est pas
   livré, et ce qui y est à moitié fait part en ligne à moitié fait.
3. **La présence reste éteinte.** `presence.actif` est faux par défaut : rien à faire
   dans `/admin`, rien à relever. Elle s'allume plus tard, seule (« À faire par
   Gaël »).

**Si le serveur redémarre avant que le schéma soit appliqué** — c'est le cas par le
Manager, dont la construction redémarre d'elle-même —, rien ne casse : les poussées
retombent sur la forme du quotidien (**les chants et les missions continuent de se
compter**), le bilan sert la ferveur, les chants et le rang (l'index absent est plus
lent, pas faux), l'XP du Virage se verse (elle ne dépend que du grand livre et de
`chants`), la présence reste éteinte, et **le démarrage nomme `sql/arenes.sql`** — au
journal, et dans `/healthz` (`ok: false` et un champ `panne`), comme l'a fait
`quotidien.sql` le 3 octobre. Le repli est mémorisé dix minutes ; le fichier appliqué,
les PARFAITS, la série et le meilleur geste se comptent de nouveau d'eux-mêmes, et le
redémarrage qui suit rend `/healthz` vert.

### Quand : hors d'un match en direct

**Les salles du Virage vivent en mémoire.** Un redémarrage en plein match efface, pour
tous les présents, la corde, les buts de tribune, les mains et la minute double — et
l'état que la salle garde à ceux qui en sont sortis (souffle, main, recharges). Il fait
aussi manquer ce qui se joue pendant la coupure : un but marqué pendant plus de cinq
minutes de jeu sans que le relevé regarde le match n'est pas annoncé (le score le porte,
la carte-souvenir n'est pas frappée ; `serveur/ECARTS.md`, serveur-correctif § 4).
**Ce qui est en base survit** — la ferveur, les chants, les PARFAITS, la meilleure
série, le meilleur geste, donc le bilan et l'XP : le bilan se lit dans
`virage_presence`, pas dans la salle. **Ce qui est en mémoire repart de zéro** : la
corde, le score de la tribune, la série de PARFAIT en cours (le combo) et le rang en
direct. Cette livraison redémarre **deux fois** par le Manager (la construction, puis
après le schéma) : les deux hors d'un match.

### Avant

Dans la copie principale, sur la base de test locale (`tbf`), une suite à la fois —
le verrou `.tbf-suite.lock` refuse au lieu d'attendre.

```bash
npm run pages              # 83 contrôles, dont « le verdict », « 9 image(s) demandée(s) » et « 8 sachet(s) »
npm run cablage            # 71 : les cinq de l'aide et ceux de la présence
npm run promesses          # chaque suite lançable par npm ; chaque adresse appelée est servie
npm run pages:navigateur   # 26 : les vingt-quatre écrans, serveur muet compris
npm run schema:smoke       # 47 : les trente-quatre fichiers, sql/arenes.sql appliqué deux fois
npm run securite           # 24, avec deux points d'attention par nature
npm test                   # soixante-six suites ; tout vert sauf le rouge connu de deck:ui
DATABASE_URL=mysql://tbf:tbfpass@127.0.0.1:3307/tbf node scripts/nvn-net-smoke.mjs   # 167 ; npm test ne la lance pas
npm run audit:ui -- --jour --etats > audit.log 2>&1   # en arrière-plan : 12 min 14 s
npm run charge 300         # base de test seulement : il vide users
```

Le 5 octobre à 5 h 35, sur la copie fusionnée : `pages` 83, `cablage` 71, `promesses`
vert, `pages:navigateur` 26, `schema-smoke` 47, `cartes:ui` 38, `son:smoke` 166, et
`node --check` sur les cinquante-trois `.js` et `.mjs` du lot. **`npm test`, `nvn:net`,
l'audit, la charge et `securite` n'y ont pas encore tourné** ; une répétition de la
fusion, hors des deux copies, avait passé vingt-six suites, toutes vertes. Attendus :
**`nvn:ui` verte** (193), `appels:test` verte (45), `accueil:ui` intermittente (une
relance seule la tranche) ; à l'audit, **rien ne doit empirer sur les colonnes
bloquantes** (texte sous 11 px, opacité sous 0,85, petit or, pâle, coupé, déborde, hors
écran, encre rognée, libellé couvert, erreur de script — toutes à 0 sur les arènes au
dernier tour du lot) ; à la charge, chant → corde au 95ᵉ centile vers 100 ms, bilans
300 sur 300 dont aucun au-delà de 3 s, **188 connexions pour 188 versements dus**.

### La vérification, après

```bash
T=$(date +%s)
curl -s "https://thebestfan.online/healthz?v=$T"                                         # "ok":true, sans "panne"
curl -s "https://thebestfan.online/virage?v=$T"        | grep -c 'virage:bilan'          # 3
curl -s "https://thebestfan.online/virage?v=$T"        | grep -c 'tbf-hudm'              # 10
curl -s "https://thebestfan.online/duel-nvn?v=$T"      | grep -c 'bilanRejouer'          # 2
curl -s "https://thebestfan.online/amis?v=$T"          | grep -c 'AU VIRAGE'             # 1
curl -s "https://thebestfan.online/repetition?v=$T"    | grep -c 'LE JOUER EN DUEL'      # 3
curl -s "https://thebestfan.online/ui.css?v=$T"        | grep -c 'tbf-bilan-sortie'      # 6
curl -s "https://thebestfan.online/ui.css?v=$T"        | grep -c 'tbfDeboutCalme'        # 4
curl -s "https://thebestfan.online/menu.js?v=$T"       | grep -c 'data-presence'         # 3
curl -s "https://thebestfan.online/geste.js?v=$T"      | grep -c 'DELAI_VERDICT'         # 7
curl -s "https://thebestfan.online/son.js?v=$T"        | grep -c 'chantDuGeste'          # 4
```

Le 5 octobre à 5 h 35, sur `524b2ca` : `ok: true`, puis **0 partout**. Les comptes
attendus sont ceux de la copie fusionnée ; ils bougent si l'un des fichiers est
retouché avant la livraison. Un 0 sur la page avec le bon compte sur la feuille dirait
que la feuille est partie sans la page — ou l'inverse.

**Dans la base**, avec les colonnes de `sql/arenes.sql` (le contrôle de démarrage ne
lit pas l'index, qu'un index absent ne rend que plus lent) :

```sql
SELECT
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE()
    AND table_name = 'virage_presence'
    AND column_name IN ('parfaits','serie_max','meilleur_q','meilleur_chant')) AS colonnes_virage,   -- 4
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE()
    AND table_name = 'user_wallet' AND column_name = 'presence')                AS colonne_presence,  -- 1
  (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE()
    AND table_name = 'virage_presence' AND index_name = 'idx_bilan')            AS index_bilan;       -- 3 (une ligne par colonne de l'index)
```

**Dans le journal du serveur**, après le redémarrage qui suit le schéma : **aucune**
ligne `[souvenirs] PARFAITS, série et meilleur geste du Virage non comptés — appliquer
sql/arenes.sql`, ni `[souvenirs] chants du Virage non comptés`, ni
`[presence] colonne user_wallet.presence absente`. Une salle de Virage qui s'ouvre
ne doit rien écrire de plus.

**Dans `/admin`, RÉGLAGES** : la section **LA PRÉSENCE** existe et `presence.actif`
y est **éteint** ; dans LA PROGRESSION, `xp.virage` (15), `xp.virage_chants` (10) et
`xp.virage_matchs_jour` (3) ; dans LE GRAND VIRAGE, `virage.bilan_min` (5).

### Les contrôles à l'œil

Sur un téléphone, connecté. **Les briques sont partagées : regarder aussi un écran qui
n'est pas une arène.**

1. **Le Grand Virage, pendant un vrai match.** Le voile : une affiche par match en
   direct, aux écharpes des deux clubs ; le choix du camp en deux bâches. La tribune :
   le HUD (ta bâche à cerne or, celle d'en face à cerne bleu, le score de la corde), le
   ticket terrain au-dessous, la corde et son foulard, la foule au pochoir qui lève les
   bras quand un camp chante, la main en éventail. **Un chant** : le tampon claque sur
   le pavé avec le mot que dit le serveur (PARFAIT, BON, MOYEN, RATÉ), et le geste n'a
   pas de seuil dans la page. **Un but réel** : la case « GOAL ! », le buteur, la minute
   — **jamais pendant qu'un geste est ouvert** (elle attend sa fermeture). **La minute
   double** : le HUD et la corde passent à l'or, le sticker dit « MINUTE DOUBLE 0:47 »
   avec son anneau, **sans** bandeau.
2. **Le bilan de tribune.** Sortir de la tribune **après avoir chanté** : la page
   kraft — le rang en grand et le palier à gagner (« À 1 PLACE DU TOP 10 »), la
   ferveur, les chants, les PARFAITS, la série, le meilleur geste, **+15 XP** et
   l'anneau qui se remplit — avec RESTER et SORTIR. Sortir **sans avoir chanté** : on
   sort sans rien demander. **Au coup de sifflet final** : le bilan s'ouvre tout seul
   — « FIN DU MATCH » — avec UN AUTRE MATCH ; l'XP ne se verse qu'**une fois** (le
   deuxième bilan du même match ne la redit pas) et pas au-delà de **trois matchs par
   jour** (le quatrième : plus de ligne d'XP, la note « Tes matchs du jour ont déjà
   rapporté leur XP »).
3. **Les quatre retours de Gaël, sur la page neuve** (corrigés en ligne depuis
   `524b2ca`, réécrits par le lot) : une carte reçue en recharge porte son scotch et
   son compte, et redevient jouable à zéro ; une tribune ouverte en cours de match
   n'annonce pas les buts d'avant ; un but ou un rouge tombé pendant un geste ne pose
   rien sur le pavé et attend sa fermeture ; une carte jouée ne paraît qu'une fois. Et
   un deuxième onglet : recharger la page rend le même souffle et la même main ; fermer
   l'onglet du KOP ne fait pas sortir de la tribune.
4. **Le duel.** La préparation : l'affiche du match choisi, CLASSÉ et ×2 si c'est le
   cas, les cinq formats avec leur prime, **ENTRER EN FILE collé au bas de l'écran**
   avec « +N écharpes en jeu » (60 pour un 1 contre 1 classé chez soi). Le vestiaire :
   les sièges, les noms entiers. La partie : le même HUD que le Virage, la marée qui
   dit qui mène, **la main et les chants entiers à l'écran** ; quand la corde cède,
   « LA CORDE / CÈDE ! » sur deux lignes, **l'accent de CÈDE séparé du C de CORDE**.
   Le bilan : VICTOIRE, DÉFAITE ou NUL, la cote, le meilleur geste en tampon, TOI/LUI
   en barres, et **REJOUER** — qui revient au vestiaire **sans recharger la page**.
5. **La répétition.** Un geste noté : le même tampon que l'arène, la note chiffrée et
   le record gardés, « LE JOUER EN DUEL » à la fin.
6. **La présence est éteinte** — c'est ce qu'on vérifie : **le tiroir n'a pas
   d'interrupteur « apparaître hors ligne »**, `/amis` n'a ni pastille ni mot
   (AU VIRAGE, EN DUEL, EN LIGNE), la tribune n'a pas de « AMIS ICI ».
7. **Le tiroir, la barre, le menu, et un écran qui n'est pas une arène.** La flèche et
   le bouton de menu des deux arènes sont dans leurs cases de 44 px et ne sont couverts
   par rien ; le sticker du menu (une récompense prête, un duel qui attend, LIVE) est
   entier et **ne mord pas le HUD** ; le tiroir couvre le HUD quand on l'ouvre. Ouvrir
   le tiroir d'un écran quelconque : il n'a pas changé. Le « GOAL ! » de l'accueil et
   la fête d'un niveau (« NIVEAU 5 ») sont à leur place d'avant.
8. **Le mode calme et le mouvement réduit.** Mode calme « animations » : le mouvement
   part, l'information reste — le tampon paraît sans animation, la carte jouée ne vole
   pas, la foule ne lève plus les bras, et le mot du verdict est là ; à l'ola, la case
   s'éclaire à la frappe sans grandir ; à la visée, la cible pâlit sans se resserrer.
   Mode calme « sons » ou onglet caché : plus un son, plus une vibration hors `fx.js`
   que le calme ne lise.
9. **Le son — à écouter, et c'est ce que l'audit ne fait pas.** Un chant calé sur la
   pulsation du pavé (tempo, contretemps, crescendo), la rumeur qui monte à l'entrée,
   retombe à la mi-temps, **l'ovation au but de ton camp**, la tribune qui se vide à la
   fin ; le premier son d'une visite n'est pas plus faible que les suivants. **Le
   mixage a changé** : l'interface sort 6 à 8 dB plus bas qu'en ligne, la poussée, le
   contre et le chant environ 6 dB, le but encaissé et la charge 3 à 4 dB.
10. **Le lendemain d'un soir de match** : la consommation de l'API sportive
    (`GET /api/tt/cache`) ne dépasse pas celle d'avant — une salle restée ouverte après
    le coup de sifflet ne la paie plus (elle coûtait jusqu'à 1 440 appels par jour, sur
    une garde de 6 800).

### À faire par Gaël

1. **Écouter le mixage** (point 9) **avant** la mise en ligne : un téléphone, un casque,
   la page d'écoute de l'atelier, `art/son/_src/ecoute-lot6/index.html` (hors de git :
   54 Mo de WAV ; à ouvrir dans Chrome) : le son d'avant et celui du lot, côte à côte.
2. **La vérification d'« Avant »** sur la base `tbf`, puis **commiter** le tout
   ensemble.
3. **Appliquer le schéma, puis redémarrer** (plus haut), hors d'un match, et relever le
   journal.
4. **Laisser la présence éteinte.** Elle ne s'allume qu'après : la nouvelle
   `CONFIDENTIALITE.md` (« La présence de tes amis ») **relue par un juriste**, la
   question des mineurs comprise, et mise en ligne. L'allumer est un geste dans `/admin`
   (RÉGLAGES, LA PRÉSENCE, `presence.actif`), sans livraison ; le défaut de
   `presence.visible_defaut` (vrai : visible des seuls amis mutuels) est à confirmer à
   ce moment-là. **Allumée sans `sql/arenes.sql`, elle ne montre rien** : le journal
   nomme le fichier.
5. **Trancher le stade du duel** (`HISTORIQUE.md`, « Ce qui reste ») : il n'est pas
   bloquant pour la livraison.
6. **Les premiers jours, la requête de détection du grand livre** (`DEPLOIEMENT.md`,
   « Le grand livre des récompenses ») : une ligne `source = 'virage'` par joueur et par
   match, jamais deux.
7. **Resté de la livraison du quotidien** (`DEPLOIEMENT.md`, étape 5) : **saisir la fin
   de la saison 1** dans l'onglet Saisons (proposée : 2026-12-20, à vérifier sur
   `/matchs`), et **recaler les quatre seuils de division** sur la ferveur réelle des
   joueurs **sans abonnement**.

---

## Ce que ça change à l'écran

- **Le Grand Virage et le duel se ressemblent** : un seul HUD (ta tribune à cerne or,
  la leur à cerne bleu), une seule corde et un seul foulard, une seule main de cartes
  qui dit ce qui lui manque pour se jouer (un « −8 » sur la carte injouable, un scotch
  et un chiffre sur celle qui se recharge), un seul pavé de geste.
- **Le geste dit son mot.** PARFAIT, BON, MOYEN ou RATÉ claque en tampon au centre du
  pavé, le même mot partout — la répétition comprise —, et c'est le serveur qui le dit.
  Le combo (« 3 PARFAITS ») s'affiche au Virage.
- **La ferveur a des paliers** : « 12ᵉ → TOP 10 », le palier suivant en sticker. Un chant
  noté au moins MOYEN rapporte au moins un point de ferveur : une grande tribune a un
  classement lisible.
- **On ne quitte plus un match sans bilan** : la page kraft du Virage (et son XP), celle
  du duel (la cote, le meilleur geste, TOI/LUI). Au coup de sifflet final du Virage, elle
  s'ouvre seule.
- **Le Virage rapporte de l'XP** : 15 par match poussé, dix chants au moins, trois
  matchs par jour au plus.
- **Le son suit le match** : des chants calés sur le pavé, une rumeur qui monte, retombe
  à la mi-temps, éclate au but.
- **La case de BD** garde la place de ses titres d'une ligne ; sur deux lignes, ses
  lignes s'écartent assez pour qu'un accent ne touche plus la lettre du dessus.
- **Déjà vrai en ligne, et gardé** : recharger ne rend plus un souffle neuf, deux
  onglets ne se chassent plus, la minute double finit à l'écran, un penalty raté ne
  frappe plus de carte (`0638fb5`) ; les cartes reviennent dans la main, les vieux buts
  ne s'annoncent plus, rien ne se pose sur le pavé pendant un geste, une carte jouée ne
  paraît qu'une fois (`524b2ca`).
- **Rien ne change pour la présence** : éteinte.

---

## Ce que les contrôles ne prouvent pas

**La copie fusionnée n'a pas encore passé `npm test` en entier, ni l'audit, ni la
charge** : c'est la vérification d'« Avant ». Le dernier tour complet de `tout-tester`
gardé par le lot date du 4 octobre à 23 h 28, dans sa copie : soixante-six suites,
5 405 contrôles, vingt-deux minutes, deux rouges — `deck:ui` (un rouge, « l'effet
combiné est affiché », antérieur au lot 0) et `appels:test`, verte depuis (45).
**`nvn:ui` est verte** (193) : ses trois rouges d'avant le lot 0 venaient de `nav.js`.
`accueil:ui` est intermittente (`ETAT.md` § 6). **`nvn:net` n'est pas lancée par
`npm test`.**

**Le serveur est éprouvé contre de faux clients, pas contre un vrai match.** Le bilan,
l'XP, la présence et le verdict montent les vrais modules sur de fausses sockets, une
fausse API et une base de test locale ; `npm run charge 300` — trois cents supporters
dans la tribune du coup de sifflet et soixante-quinze qui se vident — a donné, dans la
copie du lot, un chant → corde au 95ᵉ centile à 100 ms, trois cents bilans sur trois
cents dont aucun au-delà des trois secondes de la page, **188 connexions pour 188
versements dus**, une file du pool de trois au plus, **sur une base qui répond en
moins d'une milliseconde**. Celle de production est sur une autre machine :
`LATENCE_MS` (par exemple 5) donne à chaque instruction le délai d'une base distante,
et le coup de sifflet d'un gros match en production est ce que le premier soir de match
dira. Le pool de production a huit connexions, et le sémaphore des versements est
taillé pour elles.

**L'audit ne tranche pas deux choses.** Le mixage sonore (il ne s'entend pas), et le
contraste des faces vives au soleil : il relève, dans ses colonnes « au jour » et « sur
grain », « MINUTE DOUBLE » en blanc sur le flare à 2,6:1 et le tampon vert « TU Y
ÉTAIS » à 2,8:1 — l'arbitrage du 2 octobre sur les faces vives, consultatif, qui ne joue
qu'en plein soleil. **Et il ne voit pas un accent qui en touche un autre** : la faute
de « CÈDE », corrigée à la fusion, a été mesurée au banc sur la vraie page du duel
(l'accent séparé de 1,6 à 2,6 px de 320 à 768 de large, les titres d'une ligne à leur
place), pas par l'audit.

**La présence n'a été éprouvée qu'éteinte et sur de faux amis.** Allumée, elle ne
l'a jamais été sur de vrais comptes : le premier jour où on l'allume, regarder avec
deux comptes qui sont amis.

**Le coût.** Aucune lecture lourde de plus par écran, **aucun appel de plus à l'API
sportive** — et un retrait : une salle finie ne paie plus le relevé. Le bilan lit la base
(une lecture groupée par salle finie, deux requêtes quel que soit l'effectif) ; la
présence, éteinte, ne lit rien et ne garde rien en mémoire ; allumée, elle lit la mémoire, et
une entrée dans une tribune coûte une lecture des amis, gardée deux minutes et partagée.

**Le retour arrière.** Cette livraison se défait par un `git revert` de son commit, puis
une mise en ligne, hors d'un match. **Il n'y a pas de schéma à défaire** : les colonnes de
`sql/arenes.sql` restent, inoffensives, et le code d'avant ne les lit pas. Le grand
livre garde ses lignes `virage` (il est idempotent) ; **`xp.virage` à 0 éteint l'XP du
Virage sans livraison**, et `presence.actif` à faux éteint la présence. Le revert rend
`524b2ca`, correctif d'urgence compris (`aSesOnglets`) ; défaire le correctif du Virage
lui-même (`0638fb5`) rouvrirait D1 à D3.

---

## Ce qui reste en attente côté serveur

Dans `ETAT.md`, § 7 bis, avec le détail dans `HISTORIQUE.md`, 4 quadragies sexies,
« Ce qui reste » : **le stade du duel**, tiré sur l'identifiant du duel et non sur le
match (une ligne dans `engine.js`, une règle de jeu) ; **`gains.wallet`** dans `nvn:fin`,
non servi ; **un combo en jeu au duel** (`serie` sur l'évènement `chant`), refusé tant
qu'aucune page ne le lit ; **`nvn:net`** hors de `npm test` ; les trois questions du
correctif d'urgence du Virage (la priorité du but réel sur les autres moments d'un
même geste, les cartes-souvenirs d'un but ancien, un trou de suite). Et, comme avant :
`paliers.series` avec l'état et la chance d'une carte, que les écrans du lot 4 attendent ;
les boosters d'un abonnement acheté ; le contrôle de démarrage qui ne vérifie que la
première des trois colonnes de `sql/couleurs.sql` ; faire suivre `comments` dans les
événements du télétexte, pour que `/matchs` reconnaisse la séance comme le relevé.
**Le lot 7** reprend les images (le foulard, la corde, les silhouettes, des dessins de
chant en 2:3), **le tunnel pour le voile du Virage** — la photo existe depuis
l'intégration, la page ne la nomme pas encore — et la passe de matière des gestes
positionnels.
