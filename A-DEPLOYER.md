# À déposer sur Infomaniak

**Sessions « le socle FAIT MAIN » et « la matière FAIT MAIN » — les lots 0 et 1
de la refonte, qui partent ensemble.** Gaël a choisi le 30 septembre 2026 la
direction FAIT MAIN. Le lot 0 en pose le socle, sans aucune matière nouvelle :
tout se lit en plein jour, tous les boutons réagissent pareil, les soldes
comptent quand ils changent. Le lot 1 pose la matière sur les briques communes :
le mur de béton grainé, la bâche à la place de la plaque, l'écharpe nouée comme
seule jauge, et le vocabulaire des lots suivants, qu'aucune page n'emploie
encore. Les récits sont dans `HISTORIQUE.md`, sections 4 quadragies et
4 quadragies semel.

Aucun changement de schéma, aucune route serveur, aucune dépendance :
`package.json` n'a gagné que la commande `grain`, et `package-lock.json` n'a pas
bougé. Le retour arrière est un `git revert`, sans autre manœuvre.

---

## Où en sont le dépôt et la production

Relevé le 1er octobre 2026 à 20 h 18.

- **Le commit `9e90c90` (« Maj V01102026.1917 ») est poussé, et il est en
  ligne.** Il porte le lot 0 entier et le lot 1 tel qu'il était à 19 h 17 :
  après la critique visuelle et la relecture du code, avant la dernière série
  de corrections. La production le sert : son `/ui.css` est celui du commit,
  octet pour octet, `/img/grain/` répond, `uptime_s` dit un redémarrage vers
  19 h 21, et `"version": null` dit que la mise en ligne est passée par le
  Manager. Le correctif de `23b7992` — jouer une carte d'action retirait de la
  main tous ses exemplaires —, ancêtre de ce commit, est donc en ligne aussi.
- **La fin du lot 1 n'est pas commitée** : `public/ui.css`, `public/index.html`,
  `scripts/grain-images.mjs` et `VISUELS.md`, plus `HISTORIQUE.md`, `ETAT.md` et
  ce fichier. Les deux lots ne sont complets que dans la copie de travail.

Ce que ces fichiers apportent, et qui manque en ligne :

- **les adresses `?v=2` des trois tuiles de grain**, et le béton de 512 pixels
  servi aux écrans denses par `image-set`. La tuile `beton@2x` est déjà sur le
  serveur, mais aucune adresse ne la demande : en ligne, un téléphone agrandit
  la tuile de 256, et chaque grain y devient une tache floue ;
- **l'état du deck** (« INCOMPLET », « PRÊT ») écrit en tampon plein : la craie,
  et le mot en rouge ou en vert foncés. En ligne, il est encore lettré en craie
  sur la face foncée, à 2,6:1 au soleil ;
- **les franges de la jauge-écharpe peintes par-dessus le nœud**, cernées
  d'encre. En ligne, le nœud les couvre, et il n'en reste que deux tirets ;
- **sur l'accueil, le rembourrage du panneau COLLECTION** (sept pixels en haut,
  onze en bas), qui fait tomber les franges dans le vide et non sur le filet du
  bas ;
- `npm run grain`, qui signale une tuile qu'aucune adresse ne demande, et la
  documentation du grain.

---

## Avant tout : tout part ensemble

Les quatre fichiers et les trois documents partent dans le même envoi — un
commit, ou plusieurs poussés ensemble. Rien ne casse si l'un arrive sans l'autre,
mais chacun suppose les autres : `index.html` donne aux franges la place que
`ui.css` leur dessine, et `VISUELS.md` décrit ce que la feuille sert.

`.github/workflows/deploiement.yml` lance `scripts/verif-pages.mjs` avant de
déployer, et refuse de partir s'il échoue ; ses garde-fous du lot 0 — aucun
`backdrop-filter`, aucun émoji cadenas ou coche, aucun `.calc(`, un `data-ton`
sur chaque rail d'onglets — tiennent toujours. Avant de pousser :

```bash
npm run pages      # doit finir sur « Toutes les pages compilent » ; c'est ce que lance le workflow
```

---

## Ce que ça change à l'écran

Le lot 0, déjà en ligne :

- **Tout se lit.** Aucun texte sous onze pixels ni sous 0,85 d'opacité ; le nom
  de l'écran en haut passe à la craie pleine.
- **Plus aucun flou.** Les panneaux sont opaques, et aucun mot n'est posé à même
  la photo de tribune.
- **Les boutons des pages sont des plaques** — des bâches depuis le lot 1 —, qui
  s'enfoncent pareil partout.
- **L'onglet allumé prend la couleur de l'écran** — bleu sur le classeur, vert
  sur les matchs, violet chez les amis —, au lieu de l'or partout.
- **Sur `/deck`, ENREGISTRER et AJOUTER AU DECK passent de l'or au bleu** : rien
  ne s'y achète.
- **Les cartes retrouvent leurs marques de rareté** au pied, et l'étiquette
  d'état ne tombe plus sur un nom de deux lignes dans les petites vignettes.
- **Sur `/fanzzy`, DECK sort du rail**, avec une flèche ↗.
- **Des icônes au trait** à la place des émojis cadenas et coche.
- **`/bienvenue`** : chaque mot sur un panneau, le premier bouton dessiné, les
  cartes du premier paquet à la couleur de leur rareté et par leur nom.
- **La photo revient derrière `/carnet` et `/teletext`.**
- **Le tiroir** porte « Installer l'application » et le **MODE CALME**.
- **Les soldes comptent**, et les écharpes des doublons volent jusqu'au
  compteur.
- **Dans les arènes**, les cartes de la main répondent au doigt du premier coup.

Le lot 1, en ligne en partie, complet après ce dépôt :

- **Un mur.** Derrière chaque écran, du béton grainé, la tribune vue à travers
  lui : très sombre sur les pages de contenu, plus vive sur le hub.
- **Des bâches.** Chaque bouton est une toile de la couleur de sa destination,
  cernée au marqueur, avec une ombre noire nette et un coin déchiré. Les rouges,
  verts, bleus et violets sont plus sombres qu'avant : c'est ce qui rend leur
  libellé lisible (hypothèse H1, en attente de Gaël).
- **« Prendre ma place »**, sur le hub et la vitrine, porte une écharpe en tête,
  deux bouts de scotch et un léger biais.
- **Le hub n'a plus qu'un cadre** : AUJOURD'HUI, avec son écharpe. COLLECTION
  est un panneau calme, avec sa jauge.
- **La jauge est une écharpe nouée** — tricot, nœud de craie, deux franges — sur
  le hub, sur `/collection` et sur le classeur de `/fanzzy`.
- **Le menu et la flèche de retour** sont deux petites bâches sombres sur tous
  les écrans, arènes comprises.
- **Les soldes de `/boutique` et de `/boosters`**, et l'état du deck, sont des
  stickers de craie, collés un peu de travers.
- **L'onglet allumé** est une petite bâche, d'un degré de travers, posée dans
  son rail noir.
- **Les panneaux de texte** gardent leur teinte, prennent le grain du mur et des
  coins plus serrés.

---

## Les étapes, dans l'ordre

### 1. Commiter et pousser, tout ensemble

Voir plus haut. `npm run pages` vert avant de pousser.

### 2. Déployer

Par le workflow si les secrets SSH sont posés : Actions → Déploiement → *Run
workflow*. Il vérifie les pages et le câblage, lance `scripts/deployer.sh`, et
attend que `/healthz` annonce le commit. Sinon, à la main dans le Manager :
lancer la construction, **attendre qu'elle finisse**, puis redémarrer —
`npm start` ne fait jamais de `git pull`. Vérifier une fois que la construction
est bien `git pull && npm ci --omit=dev && node build.mjs` : sans `--omit=dev`,
`npm ci` tente de télécharger Chromium sur l'hébergement.

Le redémarrage compte aussi pour les images : le serveur relève **au démarrage**
les jumeaux `.avif` qu'il a le droit d'envoyer.

### 3. Pas de schéma à passer

Rien dans ces deux lots ne touche à la base. Le lancer ne fait pas de mal — il
est idempotent — mais il n'a rien à faire.

### 4. Vérifier que c'est bien le nouveau code qui tourne

Par le workflow, `/healthz` doit annoncer le commit poussé :

```bash
curl -s https://thebestfan.online/healthz
```

Par le Manager, `version` reste `null` et ne prouve rien. La feuille servie le
dit à sa place — le `?v=` contourne tout cache en chemin :

```bash
curl -s "https://thebestfan.online/ui.css?v=$(date +%s)" | grep -c "beton@2x.webp?v=2"   # 1 attendu
curl -s "https://thebestfan.online/ui.css?v=$(date +%s)" | grep -c tbf-ico-cadenas       # 2 attendu
```

Le 1er octobre à 20 h 18, la première répond `0` — la fin du lot 1 n'est pas en
ligne — et la seconde `2` — le lot 0 l'est. Et `uptime_s` doit être revenu à
quelques minutes, sinon le serveur n'a pas redémarré.

Côté navigateur, un rechargement suffit : les pages estampillent leurs scripts et
leurs feuilles (`?v=`), et le service worker ne garde que les images.

### 5. Les tuiles de grain, servies en AVIF ou en WebP

Trois tuiles, quatre adresses, toutes demandées sous `?v=2`. Le serveur choisit
le format d'après `Accept`, **sous l'adresse du WebP**, et seulement quand un
jumeau `.avif` existe : seul le papier en a un, et c'est voulu — l'AVIF du béton
et de la toile pèserait plus que leur WebP, ou effacerait le grain (`VISUELS.md`).

```bash
H='Accept: image/avif,image/webp,*/*'
for t in papier beton beton@2x toile; do
  echo "== $t"
  curl -sI -H "$H" "https://thebestfan.online/img/grain/$t.webp?v=2" \
    | grep -iE '^(HTTP|content-type|content-length|vary|cache-control)'
done
```

Attendu, sur les quatre : `200`, `vary: Accept`, `cache-control: public,
max-age=31536000, immutable`. Et :

| Tuile | `content-type` | `content-length` |
|---|---|---|
| `papier` | `image/avif` | 6225 |
| `beton` | `image/webp` | 8420 |
| `beton@2x` | `image/webp` | 33580 |
| `toile` | `image/webp` | 5682 |

Puis le papier pour un navigateur qui ne sait pas lire l'AVIF : avec
`-H 'Accept: image/webp,*/*'`, il doit partir en `image/webp`, 6308 octets. Un
AVIF envoyé à ce navigateur serait une surface sans grain chez lui, et c'est
`Vary: Accept` qui empêche un cache partagé de le lui resservir.

Le 1er octobre à 20 h 18, c'était déjà vrai pour les tuiles en ligne : le papier
partait en AVIF de 6225 octets à qui l'annonce, le béton en WebP de 8420. Le
`?v=` ne change rien au fichier servi ; il change l'adresse, donc le cache. Au
premier passage après la mise en ligne, chaque téléphone retélécharge le béton
et la toile une fois, une quarantaine de kilo-octets au plus (le papier n'est
demandé par aucune page) : c'est voulu.

Enfin, dans un navigateur de bureau, l'émulation d'un téléphone (densité 2 ou
3) et l'onglet Réseau ouverts sur une page de contenu : la requête doit porter
sur `beton@2x.webp?v=2`, et non sur `beton.webp?v=2`.

### 6. Les contrôles à l'œil

Sur un téléphone, du plus parlant au plus discret. Ceux du lot 0 d'abord, s'ils
n'ont pas été faits depuis sa mise en ligne :

1. **Dehors, en plein jour.** Ouvrir `/profil`, `/aide`, `/matchs` et `/virage`.
   Tout doit se lire sans chercher l'ombre. C'est la promesse du socle, et aucun
   script ne la tient à la place d'un œil : l'audit simule le soleil par un voile
   blanc de 40 %, et il ne voit pas les textes posés sur le grain.
2. **Le mode calme.** Ouvrir le menu : une rubrique MODE CALME, trois
   interrupteurs — deux sur iPhone, qui ne sait pas vibrer. Allumer « Couper les
   animations décoratives » : sur l'accueil, le personnage cesse de flotter et de
   respirer ; sur `/matchs`, les braises cessent d'apparaître ; une bâche qu'on
   touche s'assombrit au lieu de s'enfoncer. Recharger : l'interrupteur est
   resté allumé. Allumer « Couper les sons », puis ouvrir un duel : le bouton de
   son de l'arène doit être barré. Tout rallumer à la fin.
3. **Installer l'application.** Dans le menu, sur Android et dans Chrome, si le
   jeu n'est pas déjà installé : l'entrée « Installer l'application », juste
   après l'Aide. Sur iPhone, elle déplie la consigne « Partager, puis Sur l'écran
   d'accueil ». Dans le jeu déjà installé : aucune entrée.
4. **Un solde qui compte.** Ouvrir un booster depuis `/boosters`, s'il y en a un
   en poche : un compteur d'écharpes en tête de l'ouverture, des écharpes qui
   volent des doublons jusqu'à lui ; au retour, le nombre de boosters descend
   sous les yeux.
5. **Les onglets.** `/fanzzy` : MON FANZZY et CLASSEUR dans un rail bleu, DECK à
   côté, avec sa flèche. `/amis` : l'onglet allumé est violet. `/classement` :
   vert. `/aide` : craie.
6. **Les icônes.** Sur la fiche d'un Fanzzy, les cases verrouillées portent un
   cadenas au trait ; sur `/aide`, une étape faite porte une coche au trait.
7. **La main, sous le doigt.** Dans un Virage pendant que la tribune chante,
   poser le doigt sur une carte, attendre une seconde, relâcher : la carte se
   joue du premier coup.

Puis ceux du lot 1 :

8. **Le hub, à 360 pixels de large.** Il ne défile pas. Les tuiles sont des
   bâches — cerne irrégulier, ombre noire nette, coin bas-droit déchiré —, et
   deux voisines ne tremblent pas pareil. « Prendre ma place » porte son écharpe
   et ses deux scotchs, qui tombent dans l'écart sous AUJOURD'HUI sans couvrir
   son coin.
9. **La jauge de COLLECTION**, en bas du hub : un rail sombre, le tricot, un nœud
   de craie au bout du remplissage — au départ du rail si la collection est
   petite —, et deux franges rayées qui pendent **devant** le nœud, sans toucher
   le filet du bas du panneau. La même sur `/collection` et sur le classeur de
   `/fanzzy` : les franges ne touchent ni le bouton d'or ni le texte d'aide.
10. **`/deck` incomplet** : l'état est un sticker de craie, le mot en rouge
    foncé, un peu de travers.
11. **Le menu et la flèche** sur `/fanzzy`, `/classement` et dans une arène :
    deux petites bâches sombres au coin déchiré, et non deux carrés mouchetés.
12. **Un bouton hors service** — ENREGISTRER sur un deck incomplet, « PAS ENCORE
    À TOI » sur la fiche d'un Fanzzy non possédé : gris, rayé, et son libellé se
    lit.
13. **Une tablette en largeur**, sur `/teletext` : le rail d'onglets ne prend
    pas d'ascenseur vertical, et aucun écran ne défile de côté.

### 7. Et une fois : jouer

Si ce n'est pas déjà fait depuis la mise en ligne de `9e90c90` : un duel ou un
Virage avec **deux exemplaires de la même carte d'action** dans le deck. Quand
les deux sont en main, en jouer un : l'autre doit rester dans la main. C'est le
correctif de `23b7992`, et le seul point de ces deux lots qui touche aux règles.

---

## Ce que les contrôles ne prouvent pas

**Trois suites restent rouges, et toutes l'étaient avant le lot 0, à
l'identique.** Le dernier passage, sur la copie de travail complète :
cinquante-huit suites, l'audit compris, 3 312 contrôles. `deck:ui` (un rouge),
`nvn:ui` (trois) et `fanzzy:smoke` (deux) ; leurs causes sont dans `ETAT.md` et
dans `HISTORIQUE.md`, section 4 quadragies. `abo:smoke` rougit entre minuit et
deux heures du matin, à cause de son fuseau (`ETAT.md` § 2) : un rouge de ses
trois contrôles de quota à cette heure-là se relance avant de se lire. Lancée à
19 h 39, elle était verte.

**Le compte au soleil ne dit plus tout.** Soixante-douze textes perdent leur
contraste au soleil à 360 × 640, contre soixante-treize à la fin du lot 0. Mais
l'audit ne mesure pas un texte posé sur une tuile de grain — toute bâche, tout
`.pan` —, et une copie de l'audit qui les mesure en trouve cent vingt-trois :
surtout le lettrage des bâches de couleur, de 2,4 à 2,6:1 au soleil, qui était
déjà au lot 0 sur des dégradés que l'audit ne mesurait pas. Au soleil, 4,5 est
hors d'atteinte pour une face qui garde sa couleur. L'audit n'a pas encore appris
à voir sous le grain (`ETAT.md` § 4).

**Neuf hypothèses attendent Gaël**, H1 à H9, listées en tête de `public/ui.css`
et dans `HISTORIQUE.md`, 4 quadragies semel. Chacune se défait en un bloc. Elles
ne bloquent pas la mise en ligne : ce sont des choix de lecture qu'on peut
revenir.

**L'étiquette d'une carte recouvre encore son nom dans deux cas** : un nom de
trois lignes sur une carte de moins de 100 pixels, un nom de deux lignes sur une
carte de 141 à 182. La correction juste demande `cartes.js` (`ETAT.md` § 6).

**Le coût sur un téléphone modeste n'est pas mesuré.** Le lot 0 a retiré tous
les flous ; le lot 1 ajoute des tuiles de grain répétées, décodées une fois, et
aucune animation infinie — le classeur en perd même une. Aucun chiffre ne l'a
encore vérifié sur un appareil réel.

**Permanent Marker n'est chargée nulle part** (hypothèse H3) : aucune page
n'écrit encore au marqueur, et rien ne doit en avoir l'air.

---

## Ce qui reste en attente côté serveur

Rien de neuf dans cette livraison. La liste est en `ETAT.md`, section « À faire
sur le serveur ».
