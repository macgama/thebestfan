# À déposer sur Infomaniak

**Session « le socle FAIT MAIN » — le lot 0 de la refonte.** Gaël a choisi le
30 septembre 2026 la direction FAIT MAIN ; ce lot en pose le socle commun, sans
aucune matière nouvelle. Il rend les vingt-quatre écrans lisibles au soleil et
homogènes au toucher : tout se lit en plein jour, tous les boutons réagissent
pareil, les soldes comptent quand ils changent. Le récit est dans
`HISTORIQUE.md`, section 4 quadragies.

**Rien n'est commité à l'écriture de ce fichier.** Quarante fichiers de code
modifiés — trente-trois dans `public/`, sept dans `scripts/` —, plus
`HISTORIQUE.md`, `ETAT.md` et ce fichier. Aucun changement de schéma,
aucune route serveur, aucune dépendance — `package.json` et `package-lock.json`
n'ont pas bougé. Le retour arrière est un `git revert`, sans autre manœuvre.

---

## Avant tout : tout part ensemble

`scripts/verif-pages.mjs` porte maintenant les garde-fous du socle — aucun
`backdrop-filter`, aucun émoji cadenas ou coche, aucun `.calc(`, un `data-ton`
sur chaque rail d'onglets. Posés sur les pages d'avant, ils relevaient
**29 fautes sur 54 lignes**. Et `.github/workflows/deploiement.yml` lance ce
script **avant** de déployer, et refuse de partir s'il échoue.

Pousser `scripts/verif-pages.mjs` sans les pages corrigées bloquerait donc toute
mise en ligne. Les quarante fichiers partent dans le même envoi — un commit, ou
plusieurs poussés ensemble. Avant de pousser :

```bash
npm run pages      # doit finir sur « Toutes les pages compilent » ; c'est ce que lance le workflow
```

---

## Où en est la production

Relevé le 1er octobre 2026 vers 0 h 30 :

- **Le lot précédent, « la revue des vingt-quatre écrans », est en ligne.**
  `/mods.js`, qu'il a créé, est servi à l'identique du dépôt. Son texte de
  déploiement n'est plus ici ; il reste dans l'historique de ce fichier
  (commit `c05d935`).
- **`/healthz` répond `"version": null`.** Seul `scripts/deployer.sh` — le
  déploiement par le workflow — écrit le fichier `VERSION` ; une mise en ligne
  par le Manager n'en écrit pas. La dernière est donc vraisemblablement passée
  par le Manager, et l'étape 4 plus bas donne un autre moyen de vérifier.
- **Le dernier commit, `23b7992` (« Maj V30092026.1726 »), n'est pas en ligne.**
  `uptime_s` dit que le serveur tourne sans redémarrage depuis le 29 septembre
  en fin de matinée, et ce commit date du 30 à 17 h 26. Il part avec ce lot. Il
  ne touche que le serveur : jouer une carte d'action retirait de la main
  **tous** ses exemplaires, au duel (`nvn/engine.js`) comme au Virage
  (`ferveur/virage.js`) — deux Fumigènes en main, un joué, et l'autre
  disparaissait de la partie. `nvn-smoke.mjs` le couvre pour le duel.

Si la construction passe par le Manager, vérifier une fois qu'elle est bien
`git pull && npm ci --omit=dev && node build.mjs` : c'était l'avertissement du
lot précédent — sans `--omit=dev`, `npm ci` tente de télécharger Chromium sur
l'hébergement —, et rien ne dit ici s'il a été suivi.

---

## Ce que ça change à l'écran

- **Tout se lit.** Aucun texte sous onze pixels ni sous 0,85 d'opacité sur les
  vingt-trois écrans du lot ; le nom de l'écran en haut passe à la craie pleine.
- **Plus aucun flou.** Les panneaux sont opaques à 94 %, et aucun mot n'est posé
  à même la photo de tribune.
- **Les boutons des pages sont des plaques**, qui s'enfoncent pareil partout.
- **L'onglet allumé prend la couleur de l'écran** — bleu sur le classeur, vert
  sur les matchs, violet chez les amis —, au lieu de l'or partout. Une couleur
  foncée, pour que son libellé se lise encore au soleil.
- **Sur `/deck`, ENREGISTRER et AJOUTER AU DECK passent de l'or au bleu** : rien
  ne s'y achète.
- **Les cartes retrouvent leurs marques de rareté** au pied — les losanges,
  l'étoile de l'épique, la couronne de la légendaire —, et l'étiquette d'état
  ne tombe plus sur un nom de deux lignes dans les petites vignettes, celles de
  la collection et du butin d'un booster.
- **Sur `/fanzzy`, DECK sort du rail** : une plaque à côté, avec une flèche ↗.
- **Des icônes au trait** à la place des émojis cadenas et coche.
- **`/bienvenue`** : chaque mot sur un panneau, le premier bouton enfin dessiné,
  les cartes du premier paquet à la couleur de leur rareté et par leur nom.
- **La photo revient derrière `/carnet` et `/teletext`.**
- **Le tiroir** porte « Installer l'application » (elle quitte l'accueil) et le
  **MODE CALME** : couper les sons, les vibrations, les animations décoratives.
  Ses lignes font toutes 44 pixels.
- **Les soldes comptent** : la bourse de l'accueil et celle du kiosque, le solde
  de la boutique, le pot d'un KOP. Les écharpes des doublons volent des cartes
  jusqu'au compteur.
- **Dans les arènes**, les cartes de la main ne sont plus reconstruites dix fois
  par seconde : elles répondent au doigt du premier coup.

---

## Les étapes, dans l'ordre

### 1. Commiter et pousser, tout ensemble

Voir plus haut. `npm run pages` vert avant de pousser.

### 2. Déployer

Par le workflow si les secrets SSH sont posés : Actions → Déploiement → *Run
workflow*. Il vérifie les pages et le câblage, lance `scripts/deployer.sh`, et
attend que `/healthz` annonce le commit. Sinon, à la main dans le Manager :
lancer la construction, **attendre qu'elle finisse**, puis redémarrer —
`npm start` ne fait jamais de `git pull`.

### 3. Pas de schéma à passer

Rien dans ce lot ne touche à la base. Le lancer ne fait pas de mal — il est
idempotent — mais il n'a rien à faire.

### 4. Vérifier que c'est bien le nouveau code qui tourne

Par le workflow, `/healthz` doit annoncer le commit poussé :

```bash
curl -s https://thebestfan.online/healthz
```

Par le Manager, `version` reste `null` et ne prouve rien. Deux fichiers servis
le disent à sa place — le `?v=` contourne tout cache en chemin :

```bash
curl -s "https://thebestfan.online/ui.css?v=$(date +%s)"  | grep -c tbf-ico-cadenas   # 2 attendu
curl -s "https://thebestfan.online/menu.js?v=$(date +%s)" | grep -c "MODE CALME"       # 1 attendu
```

Le 1er octobre, les deux répondent `0` : c'est l'ancien code. Et `uptime_s` doit
être revenu à quelques minutes, sinon le serveur n'a pas redémarré, et le
correctif de `23b7992` n'est pas en ligne.

Côté navigateur, un rechargement suffit : les pages estampillent leurs scripts et
leurs feuilles (`?v=`), et le service worker ne garde que les images.

### 5. Les contrôles à l'œil

Sur un téléphone, du plus parlant au plus discret.

1. **Dehors, en plein jour.** Ouvrir `/profil`, `/aide`, `/matchs` et `/virage`.
   Tout doit se lire sans chercher l'ombre. C'est la promesse du lot, et aucun
   script ne la tient à la place d'un œil : l'audit simule le soleil par un voile
   blanc de 40 %.
2. **Le mode calme.** Ouvrir le menu : une rubrique MODE CALME, trois
   interrupteurs — deux sur iPhone, qui ne sait pas vibrer. Allumer « Couper les
   animations décoratives » : sur l'accueil, le personnage cesse de flotter et de
   respirer ;
   sur `/matchs`, les braises qui montent du bas de l'écran cessent d'apparaître.
   Recharger : l'interrupteur est resté allumé. Allumer
   « Couper les sons », puis ouvrir un duel : le bouton de son de l'arène doit
   être barré — c'est le même réglage. Tout rallumer à la fin.
3. **Installer l'application.** Dans le menu, sur Android et dans Chrome, si le
   jeu n'est pas déjà installé : l'entrée « Installer l'application », juste
   après l'Aide. Sur
   iPhone, elle déplie la consigne « Partager, puis Sur l'écran d'accueil ».
   Dans le jeu déjà installé : aucune entrée. Et plus rien de tel sur l'accueil.
4. **Un solde qui compte.** Ouvrir un booster depuis `/boosters`, s'il y en a un
   en poche. En tête de l'ouverture, un compteur d'écharpes ; si le paquet donne
   des doublons, des écharpes volent des cartes jusqu'à lui, et il monte. Au
   retour au kiosque, le nombre de boosters **descend** sous les yeux au lieu de
   sauter. Puis revenir sur l'accueil : les écharpes comptent depuis la valeur de
   la dernière visite jusqu'à la nouvelle.
5. **Les onglets.** `/fanzzy` : MON FANZZY et CLASSEUR dans un rail bleu, et DECK
   à côté, une plaque avec sa flèche, qui ouvre `/deck`. `/amis` : l'onglet
   allumé est violet. `/classement` : vert. `/aide` : craie. `/deck` :
   ENREGISTRER, en bas, est une plaque bleue.
6. **Le décor.** `/carnet` et `/teletext` : la photo de tribune derrière les
   panneaux, et non plus un fond gris uni.
7. **Les icônes.** Sur la fiche d'un Fanzzy, les cases verrouillées — un âge pas
   encore atteint, une tenue pas gagnée — portent un cadenas au trait, de la
   couleur du texte, et non l'émoji du téléphone. Sur `/aide`, une étape faite
   porte une coche au trait.
8. **La main, sous le doigt.** Dans un Virage pendant que la tribune chante,
   poser le doigt sur une carte de la main, attendre une seconde, relâcher : la
   carte se joue du premier coup. Avant, le relâchement tombait parfois sur une
   carte déjà remplacée, et le toucher se perdait. Dans un duel, les portraits de
   l'équipe respirent.

### 6. Et une fois : jouer

Un duel ou un Virage avec **deux exemplaires de la même carte d'action** dans le
deck. Quand les deux sont en main, en jouer un : l'autre doit rester dans la
main. C'est le correctif de `23b7992`, et c'est le seul point de ce déploiement
qui touche aux règles.

---

## Ce que les contrôles ne prouvent pas

**Trois suites restent rouges, et toutes l'étaient avant le lot, à
l'identique.** Le dernier passage, après la reprise des constats de relecture :
cinquante-huit suites, l'audit compris, 3 309 contrôles.

- `deck:ui` (un rouge), `nvn:ui` (trois) et `fanzzy:smoke` (deux). Leurs causes
  sont dans `ETAT.md` et dans `HISTORIQUE.md`, section 4 quadragies ;
- `abo:smoke` a rougi trois fois dans le passage complet, lancé à une heure du
  matin, **à cause de l'heure** : la suite sème ses lignes « du jour » en UTC
  quand MySQL compte le jour à l'heure de Zurich (voir `ETAT.md` § 2, « semer
  comme le serveur écrit »). Relancée seule, elle rougissait encore à une heure
  et demie, et elle est **verte à deux heures**, 77 contrôles. La suite n'est
  pas corrigée : un rouge de ces trois contrôles entre minuit et deux heures se
  relance avant de se lire.

**L'audit a des angles morts**, écrits en `ETAT.md` § 4 : un texte sur un
dégradé, un texte assombri par `brightness()`, un texte posé sur la photo. Les
captures à 360 × 640 ont été regardées pour ça, pas au soleil.

**Soixante-treize textes perdent encore leur contraste au soleil** à 360 × 640,
dont trente-quatre sur `/profil` et vingt sur `/aide`. Ils étaient deux cent
quatre. Ce n'est pas une régression, c'est ce qui reste.

**Les couleurs vives restent sous 4,5:1 au soleil.** L'onglet allumé des tons
flare, vert, bleu et violet a été foncé : de 8,3 à 10,6:1 à l'intérieur, de 3,2 à
3,5 au soleil, contre 2 à 2,3 avant. Au soleil, 4,5 est hors d'atteinte pour une
face qui garde sa couleur. Les plaques de ces quatre tons n'ont pas changé :
entre 3,3 et 4,5:1 à l'intérieur, vers 2 au soleil, et les deux plaques bleues de
`/deck` en sont (3,55, et 2,05 au soleil). L'audit ne mesure aucun de ces fonds,
qui sont des dégradés ; ces chiffres viennent d'un banc à part. Les foncer à leur
tour est une décision de palette, en attente de Gaël.

**L'étiquette d'une carte recouvre encore son nom dans deux cas** : un nom de
trois lignes sur une carte de moins de 100 pixels, un nom de deux lignes sur une
carte de 141 à 182. Quelques pour cent des noms, jusqu'à 9 % selon la largeur. La
correction juste demande `cartes.js` (`ETAT.md` § 6) ; elle n'est pas dans ce
lot.

**Le gain de fluidité n'est pas mesuré.** Le flou d'arrière-plan est parti de
tous les écrans, et c'est le calcul le plus cher qu'on demandait à un téléphone
modeste ; mais aucun chiffre ne l'a encore chiffré sur un appareil réel.

---

## Ce qui reste en attente côté serveur

Rien de neuf dans cette livraison. La liste est en `ETAT.md`, section « À faire
sur le serveur ».
