# À déposer sur Infomaniak

**Session « l'accueil FAIT MAIN » — le lot 2 de la refonte.** Il refait les
écrans que tout joueur voit à chaque visite : l'accueil connecté (le hub),
l'écran d'ouverture, la barre du haut des vingt-deux autres écrans et le tiroir
du menu. Les lots 0 et 1 — le socle et la matière — sont déjà en ligne. Le récit
est dans `HISTORIQUE.md`, section 4 quadragies bis.

Aucun changement de schéma, aucune route serveur, aucune dépendance :
`package.json` et `package-lock.json` n'ont pas bougé. Le lot ne touche que
`public/` et `scripts/`. Le retour arrière est un `git revert`, sans autre
manœuvre.

---

## En préparation, pas encore à déposer : le schéma du quotidien

*Note du socle du chantier serveur, 2 octobre 2026. La trace complète de la
livraison sera écrite par l'atelier qui la clôt ; ceci ne dit que ce qui touche
la base.*

La prochaine livraison serveur apporte **un fichier de schéma neuf,
`sql/quotidien.sql`** : le grand livre des récompenses (`recompenses`), les
missions du jour, les compteurs du jour, les nouveautés, et neuf colonnes sur
`saisons`, `user_wallet` et `virage_presence`. Il est additif et rejouable, et
il vient en dernier dans l'ordre d'application (`scripts/ordre-schema.mjs`).

**La manœuvre, si la livraison passe par le Manager** (qui pousse le code et
jamais le schéma) :

```bash
cd ~/sites/thebestfan.online
npm run schema:appliquer      # applique sql/ dans l'ordre, puis vérifie
```

**puis redémarrer** depuis l'onglet Node.js. Le redémarrage n'est pas une
politesse : le processus lancé avant le schéma a pris ses replis, et le
contrôle de démarrage — celui qui vérifie la clé primaire du grand livre et
ferme les versements s'il ne la trouve pas — ne se relit qu'au lancement.
Après le redémarrage, `/healthz` doit répondre `ok: true`. Par le workflow
GitHub, le schéma est appliqué avant le redémarrage : rien de plus à faire.

Sans ce fichier, rien ne casse : les missions n'apparaissent pas, le reste du
jeu tourne comme avant, et le démarrage nomme `sql/quotidien.sql`.

**Le journal dit aussi le schéma qui manque au Virage.** La ligne
« [souvenirs] chants du Virage non comptés : … appliquer sql/quotidien.sql »
signifie que la présence s'écrit, mais sans ses chants : les missions du Virage
restent à zéro. Après `npm run schema:appliquer`, même sans redémarrage, le
comptage reprend seul en dix minutes au plus, et la ligne « les chants du
Virage se comptent de nouveau » le confirme. Le redémarrage reste dû pour le
contrôle de démarrage.

**Après cette livraison, à faire par Gaël** (le détail est dans
`DEPLOIEMENT.md`, étape 5) :

1. Lire au journal de démarrage la ligne « jour de jeu : le jour change à
   HH:MM, heure de Zurich (fuseau de la base : …) », ou dans `/healthz`,
   `jourDeJeu.changeA`. Si elle ne dit pas 00:00, ce n'est pas une panne :
   missions, bonus et quotas gratuits changent de jour ensemble au minuit de
   la base. Un minuit exact à Zurich se décide alors, pour les quotas et les
   missions à la fois.
2. Dans `/admin`, RÉGLAGES : les trois sections LE QUOTIDIEN, LES MISSIONS DU
   JOUR et LA SAISON ET SES PALIERS sont là.
3. Vérifier sur `/matchs` le dernier week-end de championnat avant la trêve,
   puis saisir la fin de la saison 1 dans l'onglet Saisons (proposée :
   2026-12-20).
4. Si les missions arrivent après le 19 octobre : saisir le carnet de la
   saison 1, seuils × (jours restants / 63), **avant** le premier palier
   versé — il se fige ensuite.
5. Recaler les quatre seuils de division sur la ferveur réelle des joueurs
   **sans abonnement** (la requête, en lecture seule, est dans
   `DEPLOIEMENT.md`).

---

## Où en sont le dépôt et la production

Relevé le 2 octobre 2026 à 18 h 48.

- **Le lot 2 est commité, poussé, et il est en ligne.** Il est dans deux commits
  de Gaël, `4c07044` (« Maj V02102026.1638 ») et `7dc5464` (« Maj
  V02102026.1828 »), sur `main` et sur `origin/main`. La production sert le
  second : `/ui.css`, `/nav.js`, `/menu.js`, `/ouverture.js`, `/fx.js` et
  `/fanzzy.html` sont ceux du commit, octet pour octet, et l'accueil aussi, aux
  estampilles `?v=` près ; `uptime_s` dit un redémarrage vers 18 h 29, et
  `"version": null` dit que la mise en ligne est passée par le Manager. Le commit
  `4acf953`, la fin du lot 1, est son ancêtre : il est en ligne avec lui.
- **Ce qui est en ligne a été vérifié tel quel.** Le commit a été pris pendant
  le dernier tour de vérification, mais après la dernière modification des
  fichiers du lot (18 h 00) : les suites, l'audit et les bancs de ce tour ont
  éprouvé exactement ces fichiers.
- **Seuls les trois documents ne sont pas commités** : `HISTORIQUE.md`, `ETAT.md`
  et ce fichier. Ils ne changent rien à ce que sert le serveur.

Il ne reste donc rien à mettre en ligne pour que le lot 2 tourne. Il reste à le
**regarder sur un téléphone** (plus bas), et à commiter ces documents.

---

## Avant tout : commiter les documents

Un commit avec les trois documents, poussé. `.github/workflows/deploiement.yml`
lance `scripts/verif-pages.mjs` avant de déployer et refuse de partir s'il
échoue ; il tient maintenant un contrôle de plus — chaque tuile de grain que
`ui.css` demande existe en WebP et en PNG.

```bash
npm run pages      # doit finir sur « Toutes les pages compilent » ; c'est ce que lance le workflow
```

Le redéployer n'est pas nécessaire : rien de ce que lit le serveur ne change. Le
prochain déploiement les emportera.

---

## Ce que ça change à l'écran

- **L'ouverture est un tunnel.** Un couloir de béton, la tribune au bout, sa
  lumière qui grandit ; le nom du jeu peint sur une bâche scotchée ; cinq Fanzzy
  qui montent les marches ; une écharpe qui se noue sur « COUP D'ENVOI » ;
  « TOUCHE POUR ENTRER » ; une astuce du jour sur un ticket kraft. Elle part
  toujours selon les mêmes règles.
- **Le hub laisse 60 % de l'écran au personnage**, sans défiler. En haut,
  l'avatar — le buste de son Fanzzy dans l'anneau d'XP, son niveau — et deux
  stickers pour les écharpes et les boosters.
- **Les tuiles disent ce qui les attend** : LIVE sur VIRAGE quand un club suivi
  joue, le nombre de boosters en or sur BOOSTERS, « +N » sur FANZZY quand des
  cartes sont arrivées. Le bouton du menu porte le plus urgent.
- **Le Fanzzy parle**, dans une bulle au marqueur qui mène où elle dit, puis se
  replie en « ! ».
- **Un soir de match**, une bâche aux couleurs du club derrière lui, et de la
  fumée à ses pieds.
- **La bâche du jour**, un ticket kraft : le match en direct, le prochain coup
  d'envoi et son compte à rebours, l'étape des premiers pas, ou « Répéter un
  geste ».
- **Le bouton principal dit ce qu'il fait** : « Duel de tribunes », le monde dans
  les tribunes un soir de match, « 2 T'ATTENDENT » en violet.
- **Le « GOAL ! »** du hub est la case de BD du Virage, avec ses confettis.
- **La collection** montre le palier en cours, « 14 / 25 ».
- **Sur les autres écrans**, le nom de l'écran est écrit sur un gaffer noir, et un
  petit sticker rond — son Fanzzy et son niveau — déplie ses soldes au toucher ;
  sur une tablette, ils sont dans la barre.
- **Le menu est une bâche qu'on déroule depuis le haut**, avec une croix pour la
  refermer : des tuiles par rubrique, avec leurs stickers, et en bas, sur un
  ticket kraft, l'aide, le profil, le compte, la sortie et le mode calme.
- **Rien ne change sur `/virage` ni sur `/duel-nvn`.**

---

## Les étapes, dans l'ordre

### 1. Commiter et pousser les documents

Voir plus haut.

### 2. Vérifier que c'est bien le code du lot 2 qui tourne

Par le Manager, `version` reste `null` et ne prouve rien. Les fichiers servis le
disent à sa place — le `?v=` contourne tout cache en chemin :

```bash
T=$(date +%s)
curl -s "https://thebestfan.online/ui.css?v=$T"       | grep -c tbf-bache-club    # 4 attendu
curl -s "https://thebestfan.online/nav.js?v=$T"       | grep -c BOURSE_EN_PAGE    # 4 attendu
curl -s "https://thebestfan.online/ouverture.js?v=$T" | grep -c "function nouer"  # 1 attendu
curl -s "https://thebestfan.online/?v=$T"             | grep -c "Permanent+Marker" # 1 attendu
```

Le 2 octobre à 18 h 48 : 4, 4, 1 et 1. Après un futur déploiement, `uptime_s`
de `/healthz` doit être revenu à quelques minutes, sinon le serveur n'a pas
redémarré.

Côté navigateur, un rechargement suffit : les pages estampillent leurs scripts
et leurs feuilles (`?v=`), et le service worker ne garde que les images.

### 3. Pas de schéma à passer

Rien dans ce lot ne touche à la base.

### 4. Les contrôles à l'œil

Sur un téléphone, connecté, du plus parlant au plus discret.

1. **L'ouverture.** Dans un onglet neuf (ou une navigation privée, connecté),
   ouvrir l'accueil : le tunnel, la lumière qui grandit au fond, le titre sur sa
   bâche, les Fanzzy qui montent, l'écharpe et « ON OUVRE LES GRILLES ». À 1,2 s,
   « TOUCHE POUR ENTRER », dont seules les flèches clignotent, et l'astuce sur
   son ticket. En partant, l'écharpe se remplit d'un coup sur
   « COUP D'ENVOI ». Toucher l'écran le fait partir. Recharger dans le même
   onglet : pas de rideau.
2. **Le hub, à 360 pixels de large.** Il ne défile pas, le personnage occupe la
   plus grande part de l'écran, et rien ne recouvre son nom. L'avatar montre le
   buste de son Fanzzy et son niveau ; les deux stickers, les soldes.
3. **Les tuiles.** Avec un booster en réserve : son nombre en or sur BOOSTERS, qui
   respire lentement, et le même sur le bouton du menu. Un soir de match d'un
   club suivi : LIVE sur VIRAGE et sur le menu. Après avoir reçu des cartes :
   « +N » sur FANZZY, qui s'éteint une fois le classeur ouvert.
4. **La bulle.** Elle paraît une fois le rideau levé, au marqueur — sans chiffre,
   en quatre mots au plus —, se replie en « ! » au bout de six secondes, se rouvre
   au toucher du « ! », et mène où elle dit.
5. **La bâche du jour et le bouton.** Le ticket kraft dit une seule chose, à
   l'encre ; le bouton porte son sous-libellé. Avec un match à venir d'un club
   suivi : « PROCHAIN COUP D'ENVOI », l'affiche entière sur deux lignes au plus,
   le jour et l'heure.
6. **Un soir de match**, la bâche aux couleurs du club derrière la tête, et la
   fumée en bas de la scène. Si un but tombe : la case de BD, ses confettis, un
   seul titre.
7. **La barre**, sur `/classement`, `/fanzzy` et `/aide` : le nom de l'écran sur
   son gaffer, entier ; le sticker rond à droite ; au toucher, la bande kraft et
   les deux soldes, qui se replient seuls après trois secondes. Sur une tablette
   en largeur, les soldes sont dans la barre, sauf sur `/boutique` et
   `/boosters`.
8. **Le tiroir.** Il se déroule depuis le haut et couvre l'écran ; la croix le
   referme. Le KOP et les amis sont violets, les boosters, la boutique et
   l'abonnement or, le deck bleu ; la page où l'on est porte un pointillé. En
   bas, sur le kraft : l'aide, le profil, le compte, la sortie, le mode calme et
   la version. « Se déconnecter » demande confirmation.
9. **Le mode calme.** Allumer « Couper les animations décoratives » : le tiroir
   paraît en fondu au lieu de se dérouler, le sticker des boosters ne respire
   plus, le personnage ne flotte plus. Tout rallumer à la fin.
10. **`/virage` et `/duel-nvn`** : la barre de jeu est celle d'avant, et son menu
    garde le point rouge d'avant quand un état est allumé.
11. **Sur un petit téléphone** (320 pixels de large, un iPhone SE de première
    génération), deux défauts connus, plus bas : la bulle couvre la tuile DUEL
    pendant six secondes, et la bâche du jour coupe « PROCHAIN COUP D'ENVOI ».

Les contrôles à l'œil des lots 0 et 1, s'ils n'ont pas été faits depuis leur mise
en ligne, sont dans la version précédente de ce fichier :
`git show 4acf953:A-DEPLOYER.md`, étape 6.

---

## Ce que les contrôles ne prouvent pas

**Trois suites restent rouges, et toutes l'étaient avant le lot 0, à
l'identique.** Le dernier passage, le 2 octobre de 18 h 07 à 18 h 27, sur les
fichiers en ligne : cinquante-huit suites, 3 376 contrôles. `deck:ui` (un rouge),
`nvn:ui` (trois) et `fanzzy:smoke` (deux) ; leurs causes sont dans `ETAT.md` et
dans `HISTORIQUE.md`, section 4 quadragies. `abo:smoke` rougit entre minuit et
deux heures du matin à cause de son fuseau (`ETAT.md` § 2) ; lancée à 18 h 08,
elle était verte.

**Quatre défauts relevés au dernier tour n'ont pas été corrigés** :

- à 320 × 568, la bulle du hub couvre la tuile DUEL pendant ses six secondes, et
  un toucher sur DUEL ouvre la destination de la bulle ;
- à 320 pixels de large, la bâche du jour coupe « PROCHAIN COUP D'ENVOI » et
  souvent la ligne du moment (« CE SOIR 20:00 · dans 12 h ») ;
- l'audit ne mesure le contraste que sur un élément sans enfant : PRENDRE MA
  PLACE et ENTRER DANS LE VIRAGE, 2,6:1 au soleil, ne sont plus comptés depuis
  qu'ils portent un sous-libellé — ils ne sont pas corrigés pour autant ;
- son relevé « police de repli » signale à tort tout texte qui contient Œ ou œ
  (« LE COUP D'ŒIL », sur `/repetition`).

**Le but du hub n'a plus ni secousse ni vibration.** `fx.js` en a la forme
(`FX.but({ vignette: true })`), et `index.html` ne l'appelle pas (`ETAT.md`
§ 6). Le son de la corne reste.

**Au soleil, le kraft et les faces vives ne tiennent pas le seuil.** L'encre sur
le kraft tient 3,3:1 sous le voile de l'audit — la bâche du jour, l'astuce du
rideau, le pied du tiroir —, et aucune encre n'y atteint 4,5. La craie sur les
faces rouge, bleue, verte et violette tient 2,4 à 2,6:1, l'encre sur l'or 3,8 :
les dix libellés des tuiles du hub en sont. Ce sont des décisions de palette : **H1, H2, H4 à H9,
H11 et la teinte du kraft attendent Gaël**, listées en tête de `public/ui.css`.
Elles ne bloquent rien : ce sont des choix de lecture qu'on peut revenir.

**Un visiteur garde le rideau dix secondes** s'il ne le touche pas : la vitrine
ne dit pas à l'écran d'ouverture qu'elle est prête. C'était déjà vrai avant le
lot.

**Le coût sur un téléphone modeste n'est pas mesuré.** Le lot ajoute, pour un
joueur connecté, deux lectures par page de contenu pour le HUD —
`/api/fanzzy/state` et `/api/niveau`, au plus une fois par trente secondes et par
onglet, et aucune derrière le kiosque ou le classeur, qui les font déjà —, et
sur le hub la lecture du calendrier, gardée dix minutes, qui ne coûte aucun
appel à l'API sportive. Le hub tient trois animations infinies au plus, aucune
au calme. Aucun chiffre ne l'a vérifié sur un appareil réel.

---

## Ce qui reste en attente côté serveur

Rien de neuf dans cette livraison. La liste est en `ETAT.md`, section « À faire
sur le serveur ». Le lot laisse une question qui touche le serveur sans rien y
mettre : les tuiles verrouillées du hub n'apparaîtront que si un palier de
`src/shared/niveau.js` nomme une page (`page`), et si `/api/niveau` la transmet.
