# ÉTAT DU PROJET — à lire en premier

Ce fichier existe pour qu'une nouvelle conversation reprenne exactement où la
précédente s'est arrêtée. **Dépose l'archive complète du projet et ce fichier
au début de chaque nouvelle session**, et dis simplement sur quoi tu veux
travailler.

Dernière mise à jour : session « la revue des vingt-quatre écrans », 28 septembre
2026.

## Par où entrer, selon ce qu'on cherche

Ce document est une référence, pas un récit : il se consulte par section. Pour
quelqu'un qui arrive sur ce dépôt, l'ordre utile est celui-ci.

| La question | Où |
|---|---|
| Qu'est-ce que ce jeu ? | § 1, dix lignes |
| Comment on travaille ici, et pourquoi ainsi | § 2 — **la plus importante** |
| Qu'est-ce qu'il ne faut surtout pas « simplifier » ? | § 3 |
| Qu'est-ce qui existe et marche ? | § 4 |
| Qu'est-ce qui reste ? | § 5 |
| Ce piège, je vais m'y jeter ? | § 6 — à lire avant de toucher au front |
| Comment on met en ligne ? | `DEPLOIEMENT.md`, et `A-DEPLOYER.md` pour le lot en attente |
| Pourquoi ce code est-il écrit comme ça ? | `HISTORIQUE.md` |
| Quels dessins manquent ? | `npm run catalogue`, puis `catalogue.html` |
| Où en sont les barèmes et les chiffres ? | `npm run dossier`, puis `dossier.html` |

**Deux avertissements qui font gagner du temps.**

Les **chiffres** écrits dans ce fichier sont des relevés datés. Ceux qui font foi
sortent de `npm run dossier` et `npm run catalogue`, qui lisent les mêmes modules
que le jeu. Quand les deux se contredisent, c'est la commande qui a raison.

Un premier `npm test` sur une machine sans base de données affiche **trente-six
échecs**, et c'est normal : ces suites demandent MySQL et s'arrêtent sans lui.
Voir § 4.

---

## 1. Ce que c'est

**thebestfan.online** — un jeu de cartes de supporters adossé aux vrais matchs
de football. Le joueur collectionne des Fanzzy, pousse sur une corde partagée
pendant que son club joue, et repart avec une carte-souvenir par but vécu.

Hébergé chez Infomaniak, site Node.js + base MariaDB, données sportives
fournies par API-Football (7 500 appels par jour).

---

## 2. Comment travailler

Le projet suit une méthode constante, à conserver :

- **Chaque module a sa suite de tests**, dans `scripts/*-smoke.mjs`. Ils montent
  un vrai serveur sur une vraie base. On ne livre rien sans les avoir passés.

  La base attendue est **locale**, pas celle d'Infomaniak : les suites visent
  `mysql://tbf:tbfpass@127.0.0.1:3307/tbf` par défaut, sinon `DATABASE_URL`.
  Il faut donc un MariaDB local sur le port 3307, une base `tbf` en
  `utf8mb4_unicode_ci`, et les dix-huit fichiers de `sql/` appliqués dans
  l'ordre de `DEPLOIEMENT.md` — 36 tables au bout. Chaque suite fait son propre
  `DROP` puis recrée ce dont elle a besoin : **elles ne se lancent donc jamais
  en parallèle**, elles s'écraseraient l'une l'autre.

  Il n'y a **aucune étape de compilation** : le projet est en JavaScript
  simple, servi tel quel. `node build.mjs` existe encore parce que la commande
  de build du Manager l'appelle, mais il ne fait plus rien.
- **Les tests ont trouvé des bugs que la relecture avait ratés** — collation de
  base, buts perdus, soldes non débitables, catalogue divergent, barre de
  navigation par-dessus le bouton de jeu, un crochet passé et jamais transmis,
  un relevé d'événements qui se décalait en base. C'est le cœur de la méthode :
  écrire le test qui aurait attrapé le bug, pas seulement le correctif — puis
  **casser exprès le correctif pour voir le test rougir**, sans quoi on ne sait
  pas ce qu'on a écrit.
- **Le code est commenté en français**, et les commentaires expliquent le
  *pourquoi*, pas le *quoi*.
- **Les messages d'erreur doivent nommer la cause.** Plusieurs séances ont été
  perdues sur des « impossible » qui cachaient une table manquante. La même
  faute a été refaite quatre fois : ouverture de booster, télétexte,
  compositions, chargement du catalogue. Un message vague coûte toujours plus
  cher qu'il n'économise.
- **Le déploiement pousse le code, jamais le schéma.** C'est la panne la plus
  coûteuse du projet : le 8 septembre 2026, la mise en ligne a marché, le site
  a répondu, et pendant onze heures personne n'a pu se connecter. `sql/fanzzy.sql`
  n'avait pas été appliqué en production ; le chargement du catalogue levait, le
  `catch` du démarrage attrapait tout, et **toutes** les routes `/api`
  disparaissaient — pas seulement celles du catalogue. Le joueur voyait « Erreur
  du serveur », et `/healthz` répondait `ok: true`.

  Trois choses en découlent, toutes en place : `src/server/auth/schema.js`
  compare `sql/` à la base au démarrage et **nomme le fichier à appliquer** ;
  `/healthz` renvoie `ok: false` et un champ `panne` dès qu'une route manque, de
  sorte qu'une surveillance branchée dessus le voie ; et **toute livraison qui
  ajoute une table demande d'appliquer le `.sql` avant de reconstruire**. Les
  dix-huit fichiers sont idempotents : les rejouer tous, dans l'ordre de
  `DEPLOIEMENT.md`, est la manœuvre sûre. Depuis septembre 2026, il n'y a plus
  à le faire à la main : `.github/workflows/deploiement.yml` applique le schéma
  **avant** de redémarrer, et `npm run schema:appliquer` fait la même chose
  depuis un poste.
- **`node scripts/verif-pages.mjs` avant chaque livraison front.** Il compile
  chaque script de page, vérifie qu'aucun accent grave ne traîne dans un bloc
  CSS écrit en gabarit de chaîne, que chaque page charge la barre commune,
  qu'aucun catalogue n'est réécrit en dur, et qu'aucun module serveur n'a
  atterri dans `public/` — tout ce dossier est téléchargeable.
- **`node scripts/verif-cablage.mjs` avant chaque livraison serveur.** Il monte
  les modules sur un faux pool, sans base ni réseau, et vérifie qu'aucune
  dépendance construite trop tard dans `server.js` n'est restée à `null`. Ce
  genre de panne ne dit rien : pas d'exception, pas de log, juste une
  fonctionnalité qui ne s'exécute jamais.

### Les tests d'interface

Sept suites font tourner une vraie page dans un vrai navigateur, contre un
vrai serveur. Elles ont trouvé des choses qu'aucune relecture ne voit — un
bouton recouvert de 16 pixels, une image décentrée d'une demi-largeur, un
panneau peint sous un bandeau plein écran.

| Suite | Ce qu'elle couvre | Outil |
|---|---|---|
| `deck-ui-smoke.mjs` | construction de deck | jsdom |
| `nvn-ui-smoke.mjs` | duel N contre N, deux joueurs | puppeteer |
| `fanzzy-ui-smoke.mjs` | classeur, kiosque, catalogue | puppeteer |
| `accueil-ui-smoke.mjs` | scène du personnage sur l'accueil | puppeteer |
| `admin-ui-smoke.mjs` | catalogue Fanzzy dans l'administration | puppeteer |
| `kop-ui-smoke.mjs` | la page du KOP : créer, rejoindre, voir le pot, voter | puppeteer |
| `virage-ui-smoke.mjs` | le fil du match dans le Grand Virage | puppeteer |

`accueil-ui-smoke.mjs` vérifie ce qui ne se lit pas dans le HTML : que le
supporter **bouge** — il mesure le style calculé et exige l'animation de
respiration — et que le **fondu entre ses poses** garde exactement un calque
allumé. Un personnage figé, comme un changement de pose qui clignote, ne se
distingue de la version correcte que là.

Il vérifie aussi que les poses ont **la même taille naturelle**. C'est le
garde-fou du cadrage commun décrit plus bas : des dimensions différentes
signifieraient que chaque dessin a été recadré sur lui-même, et donc que les
pieds du personnage sautent au moment du but.

Depuis que l'accueil montre le **Fanzzy équipé** plutôt que le supporter
générique, la suite couvre les deux chemins : un Fanzzy illustré prend le
centre de l'écran et y vit ses états, un Fanzzy pas encore dessiné laisse la
place au supporter sans que rien ne le trahisse à l'écran.

`kop-ui-smoke.mjs` vérifie ce que le serveur ne peut pas : que le **compte à
rebours du vote tourne**. Trois minutes, c’est court — un chrono figé fait voter
après la clôture, et le clic ne fait rien sans que rien ne l’explique. Il vérifie
aussi qu’un bonus hors de prix est **désactivé** plutôt que refusé après coup.

`virage-ui-smoke.mjs` vérifie trois choses qu'aucune lecture ne tranche : que
le fil **arrive garni** quand on entre au milieu du match, que le vocabulaire
est **français** — l'API dit `Red Card`, `Normal Goal`, `Substitution 1`, et
ces mots-là traversaient la page tels quels — et que la feuille reste
**lisible et refermable** pendant qu'un bandeau d'effet occupe l'écran. Ce
dernier point se mesure en comptant les pixels de la couleur du bandeau sur la
tête du panneau : voir le piège ci-dessous, les deux premières versions de ce
contrôle ne pouvaient pas échouer.

`jsdom` est déclaré en `devDependencies`. **`puppeteer` ne l'est pas, et c'est
volontaire** : il télécharge un Chromium de près de 200 Mo, ce qui alourdirait
`npm install` sur le serveur. Avant de lancer les suites qui en ont besoin :

```bash
npm install --no-save puppeteer
```

Ces suites ne tournent pas sur le serveur de production. Elles se lancent en
local, avant de livrer.

### Les pièges de test, rencontrés au moins deux fois chacun

**Une suite doit ouvrir sa base comme le serveur ouvre la sienne.** Charset,
fuseau, options du pilote : tout ce qui diffère est un endroit où le vert ne
veut rien dire. Vingt-cinq suites ouvraient leur pool sans `timezone: 'Z'` et
laissaient donc passer trois pannes en production, dont une qui empêchait
purement et simplement de réinitialiser son mot de passe. Voir § 4 quater.

**Et elle doit semer comme le serveur écrit.** Même base, même options, et
malgré tout `equipes-ui-smoke` semait `polled_at` avec `UTC_TIMESTAMP()` quand
le relevé du direct l'écrit avec `NOW(3)`. Deux colonnes de la même table ne
suivent pas le même fuseau ; semer autrement, c'est éprouver une donnée qui
n'existe pas.

**Une mutation doit être fidèle, ou elle ment.** Remettre `new Date(polled_at)`
sans remettre `polled_at` dans le SELECT a laissé la suite verte : la colonne
valait `undefined`, le repli prenait la main, et la régression passait pour
absente. Une mutation qui ne reproduit pas exactement l'ancien code ne prouve
rien — ni dans un sens ni dans l'autre.

**Mesurer une boîte n'est pas mesurer un texte.** Le nom d'un chant courait sous
son coût ; la réservation par `padding-right` a corrigé le défaut, mais le
rectangle du `<b>`, qui inclut le remplissage, se chevauchait toujours. Il faut
retrancher le `padding-right` calculé pour savoir où le texte s'arrête vraiment.

**`getClientRects().length` dit si un texte est passé à la ligne, pas sa
hauteur en pixels.** Un seuil en pixels dépend de la police et rougit sur une
ligne unique un peu haute.

**`sed` avale le `\r`, et ment donc sur les fins de ligne.** Les fichiers du
dépôt sont mélangés : `virage.js` et `virage.html` sont en CRLF, mais
`virage-smoke.mjs` est en LF. Tout remplacement scripté doit détecter la fin de
ligne, sinon il ne trouve rien. Le piège n'est pas là : il est que
`sed -n '42p' fichier | cat -A` affiche `$` même sur une ligne CRLF, parce que
`sed` a retiré le `\r` en chemin. **Inspecter avec `grep`, jamais avec `sed`.**
Payé deux fois dans la même heure.

**`body.textContent` inclut le contenu des balises `<script>`.** Une
vérification qui cherche un message dans le texte de la page le trouve dans son
propre code source et passe alors que rien n'est affiché. Toujours cloner le
corps et retirer `script,style` avant de lire.

**`String(date).slice(0, 10)` ne donne pas une date.** Le pilote mysql2 rend
une colonne `DATE` sous forme d'objet `Date`. `String()` en tire alors
`"Fri Sep 11 2026 00:00:00 GMT+0200…"`, dont les dix premiers caractères sont
**le nom du jour de la semaine**. Deux dates ainsi tronquées se comparent selon
l'ordre alphabétique des jours : `"Fri Sep 11" < "Tue Sep 08"` est vrai, et un
match dans trois jours est déclaré passé.

La faute a vécu des mois dans `deck/` et `teletext/` parce qu'elle ne se voit
que certains jours — il faut que le jour visé passe avant celui d'aujourd'hui
dans l'alphabet. `deck-smoke.mjs` posait un seul match « dans trois jours » ; il
en pose maintenant un par jour de la semaine à venir, donc la faute ne peut plus
se cacher derrière la date d'exécution. Passer par `jourISO()` de
`src/shared/jour.js`, jamais par l'affichage d'un `Date`.

**`process.exit()` à la fin d'une suite la fait échouer au hasard.** Sous
Windows, environ une fois sur cinq, et **seulement quand la suite est lancée à
la file derrière une autre** — jamais seule, ce qui rend la faute très longue à
attraper. Le symptôme est `Assertion failed: !(handle->flags &
UV_HANDLE_CLOSING)` : un handle fermé alors qu'il se fermait déjà.

La cause n'est pas le test, c'est la sortie. `process.exit()` coupe la boucle
d'événements sans lui laisser finir ses fermetures, et le pool MySQL rend ses
sockets de façon asynchrone. Attendre `http.close()` réduit la fréquence sans
la supprimer.

Le correctif : poser `process.exitCode` et laisser Node partir de lui-même.

```js
await pool.end();
await new Promise((r) => http.close(r));
process.exitCode = failures ? 1 : 0;
```

`classement-smoke.mjs` est passé à cette forme. **Les quatorze autres suites
ont encore `process.exit()`** : elles n'ont pas montré le défaut, mais elles le
portent. Quand l'une d'elles échoue sans raison, c'est la première chose à
regarder — et le correctif est ci-dessus.

**Un contrôle vert n'est pas forcément un contrôle qui marche.** Trois écrits
dans la même heure sont passés au vert alors qu'ils ne mesuraient rien :

- `document.elementsFromPoint` **ignore tout ce qui porte
  `pointer-events: none`**. C'est le cas de tous les calques de `fx.js`. Le
  contrôle « la feuille est au-dessus des effets » répondait donc oui alors
  qu'elle était peinte dessous : le survol et la peinture sont deux ordres
  différents, et seul le second se voit.
- La version suivante lisait les pixels, mais comptait les pixels **clairs**.
  Le titre du panneau est écrit en craie, presque blanc : la sonde comptait sa
  propre cible. Elle échouait que la feuille soit dessus ou dessous.
- Deux correctifs redondants au même endroit rendent chacun **inéprouvable
  seul** : retirer l'un laissait le test vert. Il fallait retirer les deux pour
  voir la panne, donc le contrôle ne protégeait aucun des deux.

Le remède est le même dans les trois cas, et il vaut pour tout ce fichier :
**après avoir écrit le contrôle, casser exprès ce qu'il surveille et vérifier
qu'il rougit.** Trois lignes de `sed`, une minute. Tous les contrôles ajoutés
en septembre 2026 sont passés par là ; ceux d'avant, non.

**Un contrôle peut affirmer l'inverse de ce qu'il croit vérifier.** C'est la
forme la plus coûteuse du contrôle creux, parce qu'elle survit à la relecture.

Au Virage, une carte doit être **divisée par l'effectif de la tribune**, comme
un chant : c'est la règle qui empêche une carte de valoir mille fois plus dans
une salle de mille. Le contrôle écrit pour la protéger comparait deux salles de
tailles différentes et attendait des poussées « du même ordre ». Or « du même
ordre » est exactement ce que produit une carte qui **échappe** à la division —
le contrôle était donc vert des deux côtés, et la mutation ne l'a pas fait
rougir. Il mesure maintenant le rapport : dix fois plus de monde, dix fois moins
par tête.

La leçon : quand un contrôle porte sur une **proportion**, écrire la proportion
attendue, pas un jugement flou. « Environ dix » se mute ; « du même ordre » ne
se mute pas.

**jsdom n'exécute pas les `<script src>`.** Les suites qui montent une page dans
jsdom — `deck-ui-smoke.mjs` — injectent les modules à la main dans
`beforeParse`. Ajouter un `<script src>` à une page sans l'ajouter à cette
injection donne un `TypeError: Cannot read properties of undefined`, et il
tombe au premier rendu, donc loin du vrai coupable. La liste est à tenir :
`fanzzy-art.js`, `action-art.js`, `stuff-art.js`.

**`clearTimeout` laisse un identifiant vrai derrière lui.** Rappelée ici parce
qu'elle a été refaite une quatrième fois, dans la fenêtre du capo au Virage. La
minuterie doit être **nulée** en même temps qu'elle est effacée, sinon un test
« une minuterie court-elle ? » est vrai pour toujours.

**Une animation gelée ne finit jamais.** Le retrait d'un élément animé ne doit
pas passer par `onfinish` : une animation est accrochée à la frise du document,
et un onglet caché la gèle. La carte jouée restait plantée au milieu de l'écran
pour le reste de la partie chez quelqu'un qui avait quitté l'application. Une
minuterie, elle, court en arrière-plan. Le contrôle « puis elle s'efface » de
`nvn-ui-smoke.mjs` a trouvé le défaut, pas la relecture.

**sharp : deux silences qui donnent des fichiers faux sans lever.** Les deux ont
coûté une demi-heure chacun au détourage de l'équipement.

- `resize()` est **sans effet** s'il est posé dans la même chaîne qu'un
  `joinChannel()`. Le recollage se fait en fin de chaîne, à la taille d'origine.
  Les fichiers sortaient en 1024 pixels au lieu de 256 — quatre fois trop
  lourds, sans un mot. Le remède : recoller d'abord, réduire dans une seconde
  passe.
- un tampon brut à **un** canal ressort à **trois** si l'on ne dit pas
  `toColourspace('b-w')`. `joinChannel` le relit alors avec un pas de un,
  décale chaque ligne d'un tiers, et rend un objet cisaillé. Une image fausse,
  jamais une erreur. `scripts/stuff-images.mjs` vérifie désormais la longueur du
  masque et lève si elle change.

**Un garde-fou qui lit le code source au motif rétrécit en silence.** Les
contrôles de `verif-pages.mjs` qui vérifient qu'une carte ou une pièce a bien
ses trois formats lisaient les identifiants à l'expression régulière. En mutant
`id:` en `identifiant:` sur une seule pièce, le contrôle s'est contenté de
vérifier six pièces au lieu de sept — et **il est resté vert**. Ils importent
maintenant les modules (`ACTIONS`, `STUFF`) : plus de motif qui puisse dériver,
et le compte annoncé est le vrai.

**Le hasard du jeu ne doit pas fuir dans l'assertion.** Deux tests échouaient
par intermittence pour cette raison : l'un rejouait un geste au tempo bruité
et attendait une annulation exacte, l'autre cliquait sur la première carte
d'une main mélangée qui pouvait être justement celle qui donne le droit qu'on
voulait voir refusé. Un test qui échoue une fois sur dix est pire qu'un test
absent : il apprend à ignorer les rouges.

---

## 3. Décisions à ne pas défaire

Elles ont été prises pour de bonnes raisons, parfois après mesure. Les revenir
casserait l'équilibre du jeu ou la conformité.

**Un personnage, trois âges — et une seule carte.** Le Choriste, le Meneur de
chant et le Capo di Curva sont trois lignes du catalogue, parce qu'ils portent
chacun leur nom, leur histoire, leurs bonus et leur dessin. Ils ne sont pas trois
cartes à posséder : `user_fanzzy` retient le personnage et le **stade** atteint.

Faire évoluer ne remplace donc plus une carte par une autre — le personnage
grandit sur place, et **son doublon n'est pas consommé**. Les écharpes sont le
seul coût, et c'est sur elles que l'économie est calibrée. La version d'avant
retirait un exemplaire ; sur une ligne unique, cela revenait maintenant à
confisquer la carte qu'on vient de payer.

Trois conséquences à ne pas défaire :

- **La rareté suit le stade** — 1 commune, 2 rare, 3 épique — et n'est donc plus
  une donnée à tenir à jour. La légendaire est hors échelle : elle se tire, elle
  n'a pas de lignée.
- **La collection se compte en personnages.** `obtenables()` ne rend que les
  racines. Compter les lignes mettait au dénominateur quatorze âges qu'aucun
  booster ne distribue : la jauge n'aurait jamais pu atteindre le bout.
- **Un deck entre toujours au premier âge.** `deckDe` et `enregistrer` ramènent
  chaque Fanzzy à son personnage. Deux tribunes se rencontrent au même niveau ;
  ce que les écharpes ont acheté, c'est le droit de faire grandir son personnage
  *pendant* la partie, en y consacrant une carte de ses dix. Corollaire visible
  au joueur : on ne peut pas aligner le même personnage à deux âges, le deck le
  refuse comme un doublon.

**La Relève.** C'est la carte qui rend le paragraphe précédent jouable : elle
fait passer le Fanzzy en tribune à son âge suivant, si le joueur l'a débloqué.
Un cran par carte.

Son vrai coût n'est pas le souffle, c'est **l'emplacement de deck**. Faire
grandir trois Fanzzy demande trois exemplaires : trente pour cent du deck en
cartes qui ne poussent pas, ne gênent pas, ne protègent pas. En face, celui qui
n'a rien débloqué joue dix cartes d'effet pur. L'arbitrage s'équilibre seul,
sans table de réglage — et c'est ce qui empêche la carte d'être un simple
retard de vingt secondes sur la victoire du joueur le plus riche.

Elle est **commune**, donc offerte : posséder la carte n'est pas une seconde
barrière. La seule barrière est d'avoir payé l'évolution.

Deux détails qui ont demandé du soin :

- `loadout` ne donne au moteur que les âges **débloqués**. Le moteur n'a donc
  besoin de connaître ni les écharpes ni le catalogue : si `ages` n'a qu'une
  entrée, la Relève ne peut rien faire, et c'est tout.
- `creerJoueur` **copie** les Fanzzy du loadout. Depuis cette carte, le moteur
  écrit dedans ; sur la référence partagée, un joueur qui enchaîne deux duels
  repartirait avec son personnage déjà grandi, et la règle du premier âge
  tomberait sans un mot. `nvn-smoke` le vérifie.

`sql/stades.sql` reprend les collections existantes et `scripts/stades-smoke.mjs`
la rejoue — deux fois, parce qu'une migration qu'on ne peut lancer qu'une fois
est une migration qu'on n'ose pas relancer.

**Tous les personnages ont leurs trois âges.** Cent trente-huit lignées, écrites
en septembre 2026. Seules les légendaires n’en ont pas — et elles n’en auront
jamais : c’est leur définition, elles se tirent au lieu de se fabriquer.

La moitié seulement est écrite à la main. `dex-ages.js` ne contient que le
**nom, l’histoire et le cri** de chaque âge ; les modificateurs, la puissance,
la rareté et le chaînage se déduisent du premier âge par `ages.js`. C’est
délibéré : quatre cent soixante cartes réglées une par une, ce sont quatre cent
soixante occasions de se tromper et aucun moyen de rattraper l’ensemble le jour
où l’échelle bouge. Ici, changer la progression est une ligne.

Les règles viennent des sept lignées équilibrées à la main :

- **un bonus double au stade 2, triple au stade 3** — c’est l’écart à 1 qui
  progresse, pas la valeur ;
- **un malus s’efface** : moitié au stade 2, disparu au stade 3. Le personnage
  ne devient pas seulement plus fort, il perd ce qui le gênait ;
- **chaque geste gagne sa marque au stade 2** — intervalle de tempo, temps de
  martelage, tolérance de tenue. Un stade 2 ne se joue pas comme un stade 1 en
  plus gros ;
- **la puissance monte de +13 par âge, en linéaire.** En pourcentage, une carte
  à 90 serait montée à 135 quand une carte à 44 plafonnerait à 66 : l’évolution
  aurait creusé l’écart au lieu de le combler.

La règle d’écriture, elle, tient en une phrase : **le troisième âge doit rendre
le premier plus touchant, pas le renier.** Le Petit Teigneux ne devient pas un
héros — il devient l’homme qui engueule le prochain petit teigneux, et qui ne
dira jamais que c’est son plus beau souvenir de la saison.

Ce que ça coûte, mesuré par `npm run economie` : **15 870 écharpes** pour tout
faire grandir, contre 1 647 que rapporte une collection complète. C’est voulu.
Ce qui paie, c’est le jeu régulier — environ 1 070 écharpes par jour, donc trois
heures pour un premier stade 3 et treize jours pour tout. Entre les deux, il
faut choisir, et c’est exactement ce qu’on cherche.

**Le piège qui n’aurait rien dit.** `amorcer()` n’écrase jamais une ligne
existante — c’est ce qui protège les cartes modifiées depuis l’administration.
Donner une lignée à cent trente-huit personnages **déjà en base** insère donc
très bien leurs nouveaux âges, et laisse leur `evo` à NULL : les cartes existent,
personne ne les désigne, aucune lignée n’apparaît. Sans erreur et sans log.
`raccrocherLignees()` remplit ce trou au démarrage, avec `WHERE evo IS NULL` —
on comble, on ne corrige jamais un choix. `stades-smoke` le vérifie.
**On joue pour n’importe quel match, et pousser pour son club rapporte le
double.** Les deux règles ne se séparent pas : sans la première, la seconde
s’appliquerait toujours et ne voudrait rien dire ; sans la seconde, suivre une
équipe n’aurait plus de conséquence en jeu.

Le multiplicateur se calcule **par joueur**, jamais par duel. Deux adversaires
peuvent avoir chacun leur club sur le terrain, un seul, ou aucun — c’est
justement ce qui fait un derby. `recompenser()` lit les clubs suivis de tous
les participants en une requête, et non une par joueur : `fermer()` tourne à la
fin de chaque duel, et un aller-retour par participant sur un 5 contre 5 pour
lire deux lignes serait du gaspillage pur.

La règle est **annoncée avant le choix**, pas découverte après coup en lisant
son solde : `matchsProposables` marque chaque match d’un `mien`, `matchSupport`
répond `bonus: 2`, et l’écran de duel affiche un badge ×2 par match plus une
phrase sous la liste. Une règle qu’on ne voit qu’après ne pèse sur aucune
décision, et c’est pourtant là qu’elle doit peser.

**L’accueil montre le Fanzzy équipé — `active_fanzzy`, pas le premier du
deck.** Il lisait le deck, faute d’avoir vu que le réglage existait déjà : ça
marchait, et c’était faux. Quelqu’un qui équipait un personnage depuis son
classeur en voyait un autre sur son accueil, sans explication.

Il l’affiche **à son âge atteint** — celui qui a payé quatre-vingt-dix écharpes
voit son Capo chez lui. C’est l’inverse du duel, où tout le monde entre au
premier âge, et les deux se justifient : le duel est une rencontre, l’accueil
est chez soi.
**Le niveau ouvre, il ne donne pas.** C’est la règle qui tient tout le système
de progression : il élargit ce qu’on a le droit de faire — une série de plus,
un emplacement de plus — sans jamais rendre plus fort en duel. Un joueur de
niveau 30 n’a aucun avantage sur la corde face à un niveau 2 ; il a simplement
eu plus de choix avant d’y monter.

Sans elle, l’ancienneté deviendrait de la puissance et le nouveau venu n’aurait
plus de raison de rester. `niveau-smoke` la vérifie littéralement : il lit
`src/server/nvn/engine.js` et échoue si le mot « niveau » y apparaît.

Trois conséquences :

- **Le niveau et l’administration se combinent.** Une série est proposée si elle
  est ouverte *et* atteinte : l’administration décide de ce qui existe pour tout
  le monde, le niveau de ce qui existe pour ce joueur-là. Deux codes d’erreur
  distincts, parce que dans un cas il faut attendre et dans l’autre il faut jouer.
- **Le niveau lève le plafond des clubs suivis, les écharpes achètent en
  dessous.** C’était la question ouverte — remplacer l’achat, ou le garder. Les
  deux : personne ne doit perdre un emplacement déjà payé parce qu’on introduit
  une progression.
- **Le niveau n’est pas stocké.** Seule l’XP l’est ; le niveau s’en déduit. Le
  ranger à côté, ce seraient deux chiffres disant la même chose, et une migration
  à écrire à chaque ajustement de la courbe.

La courbe : 60 XP pour le premier palier, +40 par palier ensuite, jusqu’au
niveau 30. Un booster vaut 5 XP, un entraînement 12, un duel classé 20, une
victoire 15 de plus. **L’XP ne double pas pour son club** — les écharpes, si.
Les écharpes récompensent la ferveur et il est juste qu’elles penchent ; le
niveau mesure le temps passé à jouer, et le doubler ferait progresser deux fois
plus vite pour un choix fait à l’inscription.
**Un bonus de KOP est un jeu de modificateurs**, écrit dans le vocabulaire que
le moteur emploie déjà — `tempoWindow`, `breathBonus`, `pushMult`… C’est ce qui
permet à un KOP de peser sur la corde, la ferveur, les écharpes, le souffle, le
tempo ou les contres **sans connaître aucune de ces mécaniques**. Une mécanique
ajoutée demain sera couverte par une clé de plus, pas par une réécriture.

Dans le VIRAGE, les modificateurs du KOP **multiplient** ceux du Fanzzy au lieu
de les écraser : le groupe amplifie le personnage, il ne le remplace pas. Une
simple fusion aurait fait disparaître l’un des deux selon l’ordre, en silence.

Trois règles d’argent, et elles sont tenues par la base plutôt que par le code :

- **Un seul KOP par club**, plusieurs clubs possibles. `UNIQUE (user_id,
  team_id)` sur `kop_membres`. Vérifiée dans le code, la règle céderait sur deux
  requêtes simultanées — et un joueur inscrit à deux KOP du même club casserait
  toute la logique de versement sans que rien ne le signale.
- **Ce qui est versé est versé.** Quitter ne rend rien, et il n’existe aucune
  fonction pour le faire. Sans ça, on entrerait la veille du match, on voterait,
  et on repartirait avec sa part.
- **La part du club s’ajoute, elle ne se prend pas au joueur.** Pousser pour son
  club rapporte le double *et* remplit le pot : le même geste sert les deux, et
  il n’y a pas à choisir entre soi et son groupe. Sans KOP, cette part est
  perdue — et on le dit sur le socket, parce qu’une écharpe qui disparaît sans
  un mot ne donne envie de rien.

Le vote dure **trois minutes**, le créateur pèse **cinq voix** et départage à
égalité. Trois minutes parce qu’un vote qui dure une journée se décide sans ceux
qui jouent ce soir-là ; cinq voix parce qu’un KOP est un groupe de copains dont
quelqu’un a pris l’initiative — à partir de onze membres actifs il redevient
minoritaire, ce qui est exactement le moment où ça cesse d’être un groupe de
copains.

**Le dépouillement se fait à la lecture, jamais par une minuterie.** Un vote
échu est dépouillé au premier regard — un membre qui ouvre la page, le VIRAGE
qui cherche les bonus actifs. Une tâche périodique aurait demandé un
ordonnanceur, et surtout elle aurait laissé des votes ouverts pour l’éternité au
premier redémarrage tombé au mauvais moment.
**Une tenue appartient à un âge, pas au personnage.** Le Capo n’hérite pas de
la garde-robe du gamin. C’est ce qui donne une raison de continuer à ouvrir des
boosters après avoir fait grandir quelqu’un, et c’est ce que la chaîne d’images
savait déjà produire — `e1/hiver/`, `e2/hiver/` — sans qu’aucune donnée puisse
les atteindre.

Deux conséquences à ne pas défaire :

- **Grandir habille le nouvel âge.** `evolve()` pose la tenue de base du stade
  atteint. Sans elle, le personnage grandirait tout nu : la fiche n’aurait
  aucune tenue à montrer, et l’accueil chercherait un dossier `e2/` qu’aucun
  skin ne désigne.
- **Porter se fait par âge.** `wearSkin` éteint les autres tenues *du même
  stade*. Sans le stade dans la clause, allumer une tenue déshabillerait les
  deux autres âges sans que personne l’ait demandé.

**Les thèmes de tenue vivent en base, comme le catalogue.** `sql/tenues.sql`
porte la table, `src/server/fanzzy/tenues.js` la charge au démarrage et la garde
en mémoire, `/admin` en crée. C’est le même patron que les Fanzzy, et pour la
même raison : tant que la liste vivait dans `inventaire.js`, sortir un costume
demandait une livraison — ce qui revenait à ne jamais en sortir.

Deux thèmes distribués, **préhistorique** et **apocalyptique**, en plus de la
tenue de base. Les six anciens — pluie, nocturne, derby, anniv, promo, légende —
sont **dépubliés, pas supprimés** : ils ne tombent plus, et celui qui en possède
un le garde, nommé et illustré. Effacer une ligne de `tenues` orphelinerait les
`user_skins` de tous ceux qui l’ont gagnée ; leur Fanzzy réapparaîtrait nu sans
explication. Il n’y a donc aucun bouton de suppression, pas plus ici que pour
les cartes.

**Un thème est un nom de dossier avant d’être une carte.** `carnaval` devient
`public/img/fanzzy/TR1/e1/carnaval/`, d’où l’identifiant bridé aux minuscules
sans accent ni espace — et d’où le fait qu’il ne se renomme jamais : le
renommer laisserait les dessins derrière lui.

**Un thème n’a qu’un état : `neutre`.** Il habille, il ne rejoue pas les douze
réactions. Trois images par personnage — un âge chacune — et les objets portés
se déclinent avec lui. La chaîne de repli fait le reste : demander `but` sur un
thème qui n’a que `neutre` rend le `neutre` du thème, pas la pose du thème de
base. Cela divise par douze le travail de dessin d’un nouveau costume, et c’est
ce qui rend l’idée tenable.

**Un thème existe avant d’être dessiné.** Créé en base, il s’affiche comme la
tenue de base tant qu’aucune image n’est déposée — ce qui ne ressemble pas à une
erreur et n’en est pas une. C’est donc à l’écran de le dire : l’administration
répond avec le nom de fichier attendu,
`art/<ID>/_src/<numéro>-e1-<thème>-neutre.png`, plutôt que de refermer en
silence.


**Les places 4 et 5 du booster s’ouvrent à tout l’inventaire.** Sept pièces
d’équipement et quinze cartes d’action sur vingt et une n’étaient obtenables
**nulle part** : le paquet de bienvenue en donnait une de chaque, au hasard, et
c’était tout. On pouvait ouvrir trois cents boosters sans jamais voir un
mégaphone.

Les trois premières places restent des supporters, et c’est la garantie qui
tient l’ouverture : personne ne doit tomber sur cinq objets et zéro personnage.
Une catégorie vide — tout l’équipement déjà possédé, aucun Fanzzy à habiller —
se replie sur un supporter plutôt que de rendre une place blanche. Et un
doublon d’équipement rapporte des écharpes, comme un doublon de carte : il ne
se perd pas.
**Un schéma incomplet n’enlève jamais rien au joueur.** Il doit être bruyant
dans les journaux et invisible à l’écran ; jamais l’inverse.

Le 9 septembre 2026, `sql/niveau.sql` n’avait pas été appliqué en production.
Aucune table ne manquait — il n’ajoute qu’une colonne `xp` — donc le contrôle
du démarrage ne voyait rien, `/healthz` répondait `ok: true`, et rien n’était
écrit nulle part. Mais `droitsDe()` lisait zéro, en concluait « niveau 1 », et
**confisquait** : une seule série au kiosque, deux emplacements de deck, deux
clubs. Le jeu s’est refermé sur tout le monde parce qu’un `ALTER TABLE`
n’avait pas été joué, avec des refus parfaitement polis.

Deux corrections en découlent, et aucune ne doit être défaite :

- **`xpDe()` distingue « zéro » de « illisible ».** Renvoyer zéro dans les deux
  cas confondait un nouveau joueur et une migration oubliée. Illisible rend
  `null`, et `droitsDe()` ouvre alors **tout** — le niveau maximum — en le
  disant une fois dans le journal.
- **Le contrôle de schéma lit aussi les colonnes.** Il ne regardait que les
  tables, si bien que `niveau.sql`, `skins.sql` et `stades.sql` — qui n’en
  créent aucune — étaient déclarés appliqués, toujours. Trois des quatre
  dernières migrations étaient invisibles à la garde censée les surveiller.

C’est la panne du 8 septembre sous une autre forme : le code en ligne attend
quelque chose que la base n’a pas. `schema-smoke` rejoue les deux.
**Un skin ne donne aucun bonus.** Il change l'apparence, rien d'autre. Celui qui
ouvre mille boosters est plus beau, pas plus fort.

**L'équipement a toujours un revers, et on n'en porte que deux.** Les jumelles
élargissent la fenêtre du tempo mais ralentissent la cadence. Un joueur équipé
n'est pas plus fort, il joue autrement.

**Le nombre ne décide pas.** Une poussée est divisée par l'effectif de la
tribune, et la foule ne compte qu'en logarithme : une tribune deux fois plus
nombreuse pousse 18 % plus fort, pas deux fois. Sans cela, le club le plus
populaire gagnerait toujours.

**Le geste est noté par le serveur.** Le client envoie les instants de ses
frappes, jamais sa réussite. Deux contrôles écartent l'automatisation : écart
minimal entre frappes, et plafond de frappes.

**Le barème du geste vient du serveur, jamais recalculé par le client.**
`resoudreGeste()` est la seule source. Quand le client redessinait la pulsation
avec ses propres constantes, un joueur portant les Jumelles tapait juste sur ce
qu'il voyait et récoltait 0,36 au lieu de 0,99 : l'équipement censé l'aider le
pénalisait, et plus la carte était rare, pire c'était.

**Le catalogue Fanzzy vit en base**, table `fanzzy`, servi par
`/api/fanzzy/dex` et modifiable depuis `/admin`. `src/shared/fanzzy/dex.js`
n'en est plus que **l'amorçage** : au démarrage, ses cartes absentes de la base
y sont insérées, et **jamais celles qui existent déjà** — une modification
faite dans l'administration doit survivre au redémarrage suivant.

**L'écart entre le code et la base se dit tout seul, à chaque démarrage.**
`amorcer` n'écrase jamais une ligne existante — c'est voulu, sans quoi chaque
redémarrage effacerait les corrections faites à l'écran. La contrepartie est
qu'une carte modifiée dans `dex.js` peut ne jamais arriver en base, et qu'une
ligne que le code ne connaît plus peut continuer d'être distribuée : **aucun
des deux ne lève d'erreur**. Quatre migrations de `sql/` n'existent que pour
rattraper ça après coup — `identites.sql`, `raretes.sql`, `series-neuves.sql`,
`prefixes.sql`.

`src/server/fanzzy/ecarts.js` compare les deux catalogues à chaque `charger()`,
c'est-à-dire au démarrage du serveur et dans chacune des suites. Trois écarts
sont des **fautes** qu'aucune manœuvre normale ne produit — une carte du code
absente de la base, une ligne publiée inconnue du code, deux cartes publiées
sous le même nom — et le journal les nomme. Le quatrième, une carte dont un
champ diffère, est **ambigu par construction** : ça peut être une correction
faite à l'écran, qui est la raison d'être de cette table. On le compte, on ne
crie pas. Une alarme qui se déclenche sur du travail normal cesse d'être lue au
troisième démarrage, et on perd les trois autres avec elle.

Le silence est le cas normal : une base amorcée depuis `dex.js` et jamais
retouchée ne dit rien. `ecarts:test` le vérifie sur les 670 cartes réelles,
sans base de données — la comparaison est une fonction pure. `/healthz` porte
le même constat, sans toucher à `ok` : un catalogue qui a dérivé reste un site
ouvert. `npm run ecarts` en donne le détail, carte par carte et champ par
champ, et **sort en erreur** sur une faute.

**Et le code redescend dans la base, sans écraser personne.** Le constat
ci-dessus disait l'écart ; il ne le réparait pas, et les quatre migrations de
rattrapage restaient à écrire à la main. `src/server/fanzzy/reconciliation.js`
le fait au démarrage, champ par champ.

On ne peut pas trancher en regardant deux valeurs : « le nom du code diffère du
nom en base » ne dit pas **qui** a bougé. Il en faut une troisième — la colonne
`fanzzy.amorce`, posée par `sql/fanzzy.sql`, qui garde ce que le code disait la
dernière fois qu'il a écrit cette carte. Alors chaque champ se décide seul :

  code == base                → rien à faire ; la référence s'aligne si elle a
                                pris du retard, aucune donnée ne bouge.
  code != base == référence   → personne n'y a touché à l'écran : **le code
                                fait foi**, la valeur est reprise.
  code != base != référence   → l'écran a tranché avant : **la base garde sa
                                version**, et le démarrage annonce le conflit.

C'est la fusion à trois points d'un `git merge`, pour la même raison : deux
auteurs légitimes sur la même donnée, aucun des deux ne doit écraser l'autre en
silence.

Quatre choses en découlent, et aucune n'est négociable :

- **`NULL` veut dire « pas gérée par le code ».** Une carte créée depuis
  l'administration n'est pas dans `dex.js` : son `NULL` la protège pour
  toujours. Une ligne d'avant ce mécanisme est adoptée — référence = son état
  actuel — **à la seule condition qu'`admin_audit` ne garde aucune trace d'une
  modification la concernant**. Journal absent : on n'adopte rien. Une table
  manquante ne doit jamais se lire comme « personne n'a rien fait ».
- **La référence dit ce que le code a réellement posé**, jamais ce qu'il aurait
  voulu poser. Un champ en conflit garde sa référence d'avant : sinon elle
  annoncerait une valeur que la base n'a jamais portée, et la décision suivante
  deviendrait illisible.
- **Un disjoncteur à soixante cartes.** Au-delà, rien n'est écrit et le
  démarrage dit pourquoi. Une fournée de contenu réécrit dix cartes ; six cents,
  c'est un accident — un `dex.js` à moitié chargé, une base amorcée depuis une
  autre branche. `TBF_RECONCILIATION_MAX` relève la barre le jour où c'est
  voulu.
- **Sans la colonne, tout se désactive en le disant.** Le déploiement pousse le
  code et jamais le schéma : écrire dans une colonne absente ferait lever
  l'amorçage, et le `catch` du démarrage éteindrait toutes les routes `/api`.
  C'est la panne du 8 septembre 2026, mot pour mot. On regarde donc avant
  d'écrire.

`reconciliation:test` éprouve la règle sans base, sur des cas fabriqués — dont
la moitié vérifient qu'elle **s'abstient** : la correction jamais écrasée, la
carte inconnue du code jamais touchée, la ligne d'avant restée protégée, le
plafond qui bloque. Le dernier contrôle rejoue les 670 cartes réelles deux fois
de suite : une réconciliation qui ne converge pas est une écriture en boucle sur
la table la plus lue du jeu.

Trois règles de cet écran, qui ne se négocient pas :

- **On ne supprime jamais une carte.** Un identifiant effacé orphelinerait les
  collections, les decks et le Fanzzy équipé de tous ceux qui le possèdent. On
  dépublie : la carte sort des tirages et du catalogue servi, mais reste
  lisible par identifiant pour que les collections s'affichent encore.
- **On ne renomme jamais un identifiant.** C'est la clé de `user_fanzzy`. Le
  changer reviendrait à supprimer, en pire — sans s'en apercevoir.
- **Le cache est rechargé après chaque écriture.** Sinon la base et le jeu
  divergent, et rien ne le signale avant qu'un joueur tire une carte que le
  serveur croit inexistante.

Les barèmes — séries, types, raretés, taux de tirage, coûts d'évolution —
restent dans `dex.js`. Ils décrivent les règles du jeu, pas son contenu, et on
ne change pas un taux de tirage depuis un écran d'administration.

**Le dessin d'un Fanzzy n'existe qu'à un endroit non plus**,
`public/fanzzy-art.js`. Le classeur et l'accueil dessinent les mêmes
personnages ; recopier cent lignes de SVG aurait refait exactement la faute du
catalogue. La liste `ILLUSTRES` y vit aussi, et `verif-pages.mjs` échoue s'il
ne la trouve plus — un garde-fou devenu muet est pire que pas de garde-fou.

**Il n'y a qu'un seul jeu : le tir à la corde.** Deux tribunes tirent sur la
même corde, on chante — un geste noté par le serveur — et on joue des cartes
d'action. Trois Fanzzy par deck, deux pièces d'équipement chacun, de 1 contre 1
à 5 contre 5 dans `/duel-nvn`. Le Grand Virage est le même geste à l'échelle
d'une tribune entière, adossé à un vrai match.

L'ancien duel tour par tour a été **supprimé** — page, routes, moteur, tests et
toute la chaîne TypeScript qui n'existait que pour lui. Deux jeux derrière le
même mot, c'était le joueur qui payait la confusion. Le seul mécanisme qui lui
appartenait en propre, le souffle offert quand ton club marque, a été rebâti
pour le NvN **avant** la suppression : `DuelNvN.butReel()`.

**Un but réel ne pousse pas « du côté du domicile » dans un duel.** Les deux
tribunes d'un duel ne sont pas les deux clubs du match : les équipes se forment
par ordre d'arrivée en file. Ce qui compte est qui suit le club buteur, et ces
gens-là peuvent être des deux côtés. À nombre égal, la corde tressaille sans
bouger — un derby n'avantage personne. C'est différent du Grand Virage, où le
camp *est* le club, et c'est voulu.

**On ne rejoue pas un match passé.** Un duel adossé à un match du jour ou en
cours est classé ; à un match futur, c'est un entraînement ; à un match passé,
c'est refusé.

**Aucune série quotidienne qu'on perd.** « Tu as joué 47 jours d'affilée » est
agréable ; « tu vas perdre ta série » est une laisse.

**Les visuels générés ne portent ni marque, ni nom de club, ni texte.** Règles
complètes dans `VISUELS.md`.

**Le fil du match est gratuit d'abord, payant ensuite.** Le Grand Virage
raconte ce qui se passe sur le terrain, et cette promesse pouvait coûter très
cher : un appel d'événements accroché au relevé du direct, qui tourne toutes
les vingt secondes, ferait près de quatre cents appels pour un match de deux
heures. La règle qui l'en empêche tient en trois lignes, et elle est éprouvée
par `football-smoke` :

- **La période et le score ne coûtent rien.** Coup d'envoi, mi-temps, reprise,
  coup de sifflet final, minute, score : tout cela est déjà dans la réponse que
  le relevé vient de lire, vingt matchs par appel. Un fil qui n'aurait que ça
  reste utile — « mi-temps » explique à lui seul pourquoi la corde ne bouge
  plus.
- **Le but réel ne coûte rien non plus** : il emprunte le chemin qui existait
  déjà, celui qui secoue la corde et frappe les cartes-souvenirs. Il est donc
  **retiré** du relevé côté salle, sinon le fil raconte deux fois le même but.
- **Le reste du terrain se paie** — cartons, remplacements, arbitrage vidéo —
  et n'est demandé que pour un match **dont une salle de virage est occupée**,
  au plus une fois par minute. Un match que personne ne regarde ne coûte pas un
  appel de plus qu'avant le fil. C'est `virage.sallesOccupees()` qui répond, et
  `fixturesAuFil` qui le demande.

Le fil est **semé depuis `fixture_events`** à l'ouverture de la salle : entrer
à la soixante-dixième minute donne l'écran garni sans un appel. Et les entrées
sortent **structurées, jamais rédigées** — un genre et un code, `periode`/`HT`,
`terrain`/`Card` — la page écrit « Mi-temps ». C'est la règle des codes
d'erreur étendue au reste : le français vit dans la page, qui sait déjà dans
quelle langue elle est.

**Le personnage salue en arrivant, une fois par session.** `rendus.js` le
promettait depuis le premier jour et personne ne l'avait branché. Deux gestes
distincts, et la séparation compte : **l'entrée** se joue à chaque chargement
et ne dépend d'aucun dessin ; **le salut** se joue une fois par session, et son
mouvement part même quand la pose n'est pas dessinée. Le supporter générique
n'a pas de salut, la plupart des Fanzzy non plus — une animation réservée aux
personnages illustrés serait une animation que presque personne ne verrait.

Une fois, et pas davantage : quelqu'un qui fait dix allers-retours vers son
classeur ne veut pas dix coucous. C'est ce que retient `sessionStorage`, et
c'est ce qui sépare un personnage accueillant d'un personnage insistant.

---

**La portée d'un effet décide où sa carte se joue.** Le Grand Virage ne joue
que les cartes d'action qui agissent sur soi ou sur sa tribune : quatorze des
vingt et une. Les sept autres — Silence radio, Brouillard, Parcage fermé, Vol
de souffle, Vent de face, Bâche, Renvoi — restent au duel.

Ce n'est pas une liste de noms, et il ne faut pas en faire une. Chaque **sorte
d'effet** déclare sa portée dans la table `PORTEE` de
`src/shared/duel/actions.js` — `soi`, `tribune` ou `adverse` — et
`dansLeVirage()` en déduit tout. Une carte d'entrave ajoutée demain se rangera
seule hors du Virage ; une liste d'identifiants, elle, aurait attendu que
quelqu'un y pense.

La raison de fond : **le Virage n'est pas un duel avec plus de monde.** En face
il n'y a pas un adversaire, il y a une foule d'inconnus. Une carte qui traverse
y est soit écrasante — une personne coupe le souffle de trois cents autres —
soit nulle une fois divisée par l'effectif. Les deux sont mauvais.

L'effet de bord est le meilleur de l'affaire : la famille `collectif`, la plus
faible en un contre un où « chaque coéquipier » veut dire zéro personne,
devient la reine du Virage. **Un deck de Virage cesse d'être un deck de duel**,
et les dix emplacements retrouvent un arbitrage.

Deux cartes y sont sans objet et sont refusées avec leur cause : la Relève et
l'Arbitre. Le Virage ne met qu'un personnage en tribune et n'a pas de banc.

**Une poussée du Virage est toujours divisée par l'effectif — les cartes
comprises.** C'est la règle qui tient tout : le nombre aide, il ne décide pas.
Un Fumigène vaut donc la même chose dans une salle de dix et dans une salle de
mille, et la Mosaïque mesure la **proportion** de tribune active plutôt qu'un
nombre de têtes — une tribune de mille dont un dixième pousse vaut moins qu'une
tribune de dix entièrement debout.

C'est aussi pourquoi `VirageRoom.appliquer` et `DuelNvN.appliquer` **restent
deux fonctions**. Elles se ressemblent de loin ; les fondre demanderait une
exception à presque chaque ligne. Ce qui est commun — poser un effet, le
nettoyer, l'interroger, empiler ses modificateurs — vit dans
`src/shared/duel/effets.js` et sert aux deux. C'est la mécanique qui est
partagée, pas ce que l'arène en fait.

**Le stade appartient au match, jamais à un joueur.** Les cinq stades se
collectionnent, et leur effet s'applique **aux deux camps**.

Un stade qui avantagerait son propriétaire serait la première chose du jeu à
donner de la puissance sans que l'adversaire l'ait choisie. On équipe son
Fanzzy en sachant ce qu'on y perd ; on ne choisit pas de jouer chez quelqu'un.
Ce serait donc casser les deux règles déjà écrites dans `inventaire.js` — un
skin ne donne aucun bonus, chaque pièce d'équipement a un revers — qui disent
toutes deux la même chose : « un débutant qui chante juste bat un vétéran mal
équipé ».

Au Grand Virage le stade vient du vrai match ; en duel, `stadeDeLaRencontre()`
le tire dans l'**intersection** de ce que les deux joueurs possèdent, jamais
dans la réunion. Jouer dans un stade que l'adversaire n'a jamais vu serait lui
imposer une règle qu'il ne connaît pas.

Collectionner n'achète donc pas de la force : ça élargit les lieux où l'on peut
tomber, et donc les situations qu'un deck doit savoir affronter. L'exemple de
la Vuvuzela le montre bien — une pièce d'équipement plus forte dans un stade
donné est une lecture de deck sur une condition **commune**, que les deux camps
peuvent embarquer.

**Les tribunes des stades sont dessinées dans l'ombre, exprès.** C'est ce qui
permet de les allumer. Une tribune déjà éclairée ne peut plus s'éclairer ; une
tribune sombre, si. La nappe de lumière est posée en `mix-blend-mode: screen` —
le mode qui *ajoute* de la lumière au lieu de repeindre — donc le grain de la
foule reste visible dessous, et ce qu'on voit n'est pas un rectangle coloré
mais une tribune qui s'éclaire.

Ne pas redessiner un stade avec ses tribunes éclairées, et ne pas remplacer
`screen` par un aplat : dans les deux cas on obtient un autocollant.

**Une pièce d'équipement est un objet détouré, pas une scène.** Les cartes
d'action remplissent leur cadre et sont servies en JPEG ; l'équipement est
découpé sur transparence et servi en **PNG**, parce qu'un objet finit sur le
personnage qui le porte — une écharpe autour d'un cou, un mégaphone dans une
main. Servi avec son fond, il y arriverait avec un carré noir autour.

C'est pourquoi les deux chaînes sont deux scripts, et pourquoi `stuff-art.js`
et `action-art.js` sont deux fichiers malgré leur ressemblance : leur format de
repli n'est pas le même, et c'est justement le repli qui fait tout leur
intérêt.

### Ouvrir un booster

**On déchire la bande du haut, en travers, comme un vrai sachet.** Un seul
mouvement, et l'endroit où saisir se voit avant qu'on ait lu la consigne : la
ligne dentelée est dessinée sur le paquet, la languette est à droite. On tire
dans les deux sens — la languette est à droite, mais rien ne justifie de
refuser le geste à un gaucher.

Ce qui précédait ne s'ouvrait pas, pour deux raisons distinctes qui se
donnaient le même symptôme.

**La première : le geste se comptait en images, pas en secondes.** Il fallait
maintenir le doigt immobile pour « chauffer la tribune », et la chauffe
avançait de `0.02` à chaque `requestAnimationFrame`. Cette page rend une
douzaine d'images par seconde — carrousel, lueurs qui respirent, paquet qui
tremble : la chauffe réclamait quatre secondes d'immobilité parfaite au lieu
des huit dixièmes prévus, et le moindre relâchement remettait à zéro un
compteur que rien n'affichait. Sur la machine du développeur, instantané ; sur
un téléphone, impossible.

Trois règles en sont sorties, et elles valent au-delà de ce geste :

- **Rien ne se compte en images.** L'avancée ne dépend que de la distance
  parcourue par le doigt. Une page à cinq images par seconde déchire comme une
  page à cent vingt.
- **Rien ne se perd sans se voir.** Lâcher trop tôt ne vide pas un compteur
  invisible : la bande revient élastiquement à sa place.
- **On peut toujours sortir.** « Plus tard » et Échap referment, Entrée ouvre
  sans le geste — c'est l'accès au clavier et, du même coup, la sortie de
  secours de qui ne peut pas faire le mouvement. Un plein écran dont on ne
  s'échappe qu'en réussissant un geste est un piège, et c'en était un : la
  seule issue était de recharger la page.

**La seconde : `modsText` lisait `f.mods` sans garde.** Seuls un supporter et
une pièce d'équipement portent des effets ; une tenue n'en a jamais eu, une
carte d'action porte un `effet` et non des `mods`. Depuis que les places 4 et 5
du booster s'ouvrent à tout l'inventaire, la plupart des paquets en
contenaient une : `cardHTML` levait, la boucle qui monte les cinq cartes
s'arrêtait au milieu, et sa dernière ligne — celle qui affiche l'écran — ne
s'exécutait jamais. Le booster était débité, l'écran de déchirure refermé, et
il ne se passait rien.

Dans la même famille, corrigé du même coup : la page ne recevait que le
catalogue Fanzzy et traitait donc l'équipement et les cartes d'action comme des
cartes inconnues — elle les jetait, prévenait le joueur que sa version était
périmée, et lui montrait trois cartes en annonçant « 1 / 5 ». **`/api/fanzzy/dex`
sert désormais ce qui se tire** : `stuff`, `actions` et `tenues` en plus du
catalogue. Une tenue s'affichait sous son identifiant, « prehistorique » ; elle
porte maintenant son nom.

**Rien de tout cela n'était couvert.** Les suites appelaient `/api/fanzzy/open`
directement : elles éprouvaient le serveur et jamais la seule chose que le
joueur touche. `fanzzy-ui-smoke` déchire désormais pour de bon, vérifie qu'un
même trajet donne la même déchirure en six ou en vingt-quatre mouvements — la
faute d'origine, exactement — et ouvre quatorze boosters d'affilée pour voir
tomber les quatre sortes de cartes.

Les événements y sont dispatchés depuis la page et non par `page.mouse` : le
pilotage CDP ne délivre à cette page que deux `pointermove` sur douze, la
fenêtre elle-même n'en voit pas davantage. Un test écrit avec `page.mouse`
échouerait toujours, quel que soit l'état du code, et ne mesurerait que le
simulateur.


## 4. Ce qui existe et fonctionne

| Adresse | Contenu |
|---|---|
| `/` | accueil : vitrine avant connexion, hub après — le Fanzzy équipé au centre |
| `/compte` | inscription, connexion, mot de passe oublié, Google |
| `/bienvenue` | cérémonie d'arrivée : club, paquet de bienvenue |
| `/fanzzy` | kiosque, classeur, Fanzzy équipé |
| `/fanzzy/:id` | fiche d'un Fanzzy : histoire, effets, tenues, lignée |
| `/collection` | la collection en vitrine : Fanzzy, équipement, tenues, et où trouver ce qui manque |
| `/boosters` | l'ouverture d'un paquet, déchiré à la main |
| `/deck` | construction de deck : jusqu'à trois Fanzzy, équipement, dix cartes |
| `/kop` | le KOP : caisse commune, votes de dépense, bonus de virage |
| `/carnet` | souvenirs vécus et vignettes à récupérer |
| `/virage` | Grand Virage : tir à la corde pendant un vrai match, le fil du terrain, **les cartes d'action de sa tribune** et le panneau « ce que tu portes » |
| `/amis` | amis : qui suit les mêmes clubs, demandes, invitations en KOP |
| `/equipes` | les clubs suivis, et la recherche pour en ajouter |
| `/duel-nvn` | **le duel** : tir à la corde, 1v1 à 5v5, adossé à un vrai match, même panneau de bonus |
| `/matchs` | matchs du jour, en direct, avec fiche détaillée |
| `/teletext` | tous les championnats : classements, buteurs, cartons |
| `/classement` | supporters, tribunes, duellistes |
| `/boutique` | écharpes et paquets, payés par Stripe |
| `/abonnement` | l'abonnement, ses droits et sa résiliation |
| `/profil` | identité, clubs, inventaire, langue, déconnexion |
| `/repetition` | la répétition : apprendre les gestes hors match |
| `/aide` | comment on joue, et ce que veut dire chaque carte |
| `/admin` | **catalogue Fanzzy**, séries ouvertes, joueurs, compétitions, journal |
| `/diagnostic`, `/healthz` | état du service |

Vingt-quatre écrans, et c'est le compte que tient `npm run pages:navigateur` : il
les ouvre tous dans un vrai navigateur, serveur muet compris, et vérifie
qu'aucun ne lève et que chacun porte sa flèche de retour.

### Ce qu'on porte, et comment on le sait

Les modificateurs des Fanzzy, de l'équipement, du KOP et du stade sont composés
par le serveur depuis longtemps — et jusqu'ici **rien ne les montrait au
joueur**. Les deux arènes ont maintenant une ligne sous la jauge de souffle,
« CE QUE TU PORTES · n bonus · n malus », et un panneau qui s'ouvre au toucher :
une source par bloc, ses effets signés et colorés, puis le total que le moteur
applique vraiment — affiché à part et jamais recalculé depuis les blocs.

Deux modules partagés le rendent possible, et il vaut mieux savoir lequel fait
quoi : `src/shared/apports.js` construit la **ventilation** côté serveur, là où
les morceaux existent encore séparément — un total ne se décompose pas après
coup. `public/mods.js` met les **mots** dessus, et c'est le seul endroit du
navigateur qui le fasse : voir § 6 pour ce que coûtaient les cinq copies d'avant.

### Les suites de contrôle

**Cinquante-huit suites**, lancées ensemble par `npm test`. Elles se divisent en
deux groupes qu'il faut connaître avant de s'inquiéter d'un rouge :

- **vingt-deux ne demandent rien** — ni base, ni réseau, ni clé d'API. Elles
  tournent sur n'importe quelle machine, tout de suite ;
- **trente-six demandent MySQL.** Sans base, elles ne rougissent pas : elles
  s'arrêtent, et `npm test` les compte comme « la suite s'est arrêtée » sur
  `ECONNREFUSED 127.0.0.1:3307`. C'est un défaut d'environnement, pas de code.

Un développeur qui reprend ce dépôt sans base de données verra donc trente-six
échecs au premier `npm test`, et ce sera normal. Il faut un MySQL joignable, et
un `.env` qui le dise, pour que le compte ait un sens.

Quatre contrôles gardent la livraison et ne demandent aucune base — à lancer
avant tout :

| Commande | Ce qu'elle garantit |
|---|---|
| `npm run pages` | les pages compilent ; la barre est là ; chaque dessin déclaré a ses trois formats ; aucun identifiant n'est écrit deux fois dans une page |
| `npm run cablage` | les modules sont branchés entre eux, **et le serveur n'importe aucun paquet de développement** |
| `npm run promesses` | chaque adresse appelée par une page est servie ; chaque page a une route |
| `npm run pages:navigateur` | les vingt-quatre écrans s'ouvrent sans lever, serveur muet compris, et chacun porte sa flèche de retour |

### Le catalogue

Les chiffres ci-dessous sont un **relevé daté**, pas une vérité : ils sont lus
dans `src/shared/fanzzy/dex.js` au 28 septembre 2026. Deux commandes les
recalculent, et c'est à elles qu'il faut se fier — un nombre écrit à la main dans
un document est faux le jour où l'on ajoute une carte, et personne ne le sait :

```
npm run dossier      → dossier.html   : où en est le jeu (règles, barèmes, chiffres)
npm run catalogue    → catalogue.html : ce qui est dessiné, et ce qui manque
```

**765 cartes, dont 733 publiées**, réparties en 13 séries et 6 familles — voix,
percussion, tifo, pyro, déplacement, fidélité. 323 lignées, c'est-à-dire 323
cartes de premier âge, et 76 légendaires, qui n'ont qu'un âge par définition.

Les 32 non publiées sont d'anciennes cartes qui refont un personnage du lot de
2026 : elles restent lisibles pour qui les possède, elles ne se tirent plus.

Au dernier passage, `npm run catalogue` annonçait **291 personnages dont 202
dessinés**, et 89 lignées attendent encore leur premier dessin. Les deux
comptages ne se recouvrent pas tout à fait — l'un groupe les évolutions, l'autre
compte les fichiers réellement présents — et c'est pour cette raison qu'il vaut
mieux ouvrir la page que recopier un nombre.

### Les illustrations

**198 Fanzzy ont leur plein-pied et leur buste** — c'est ce que liste
`ILLUSTRES` dans `public/fanzzy-art.js`, et `verif-pages.mjs` refuse d'y voir un
identifiant dont les six fichiers n'existent pas. Le reste du catalogue garde le
dessin procédural : mieux vaut une silhouette géométrique cohérente qu'un trou.

**Un seul personnage a ses états** : `TR1`, Le Petit Teigneux — douze états au
premier âge, un seul au deuxième. C'est le banc d'essai de la chaîne décrite au
§ 9. Les 276 âges supérieurs du catalogue s'affichent en attendant au premier
âge, par la mécanique de repli.

L'accueil en joue **cinq** — `neutre`, `salut`, `pousse`, `but`, `encaisse` —
et c'est le seul écran qui déclenche des états tout seul. Les sept autres
attendent le jeu qui les appellera ; `ETAT_QUAND`, dans
`src/shared/fanzzy/rendus.js`, dit pour chacun à quel moment il est prévu.
Cette table est la spécification : `salut` y était décrit depuis le premier
jour et n'a été branché qu'en septembre 2026.

### Les illustrations des cartes d'action, de l'équipement et des stades

Trois jeux d'images nés en septembre 2026, trois chaînes distinctes, et trois
formats de repli différents — chacun pour une raison.

**Les vingt et une cartes d'action** ont leur dessin : une scène de tribune
pleine page, servie en AVIF / WebP / **JPEG** à 480 × 640. Pas de PNG : ces
images remplissent leur cadre et n'ont pas d'alpha à garder — le même lot pesait
13 Mo en PNG et 1 Mo en JPEG.

Elles s'affichent dans le classeur (les dix cases et le catalogue), dans la main
du duel, dans celle du Virage, et **en grand quand une carte est jouée**. Le
dessin se pose toujours **par-dessus** le glyphe de famille, jamais à sa place :
si le fichier manque, l'image se retire elle-même et le glyphe réapparaît.

**Les sept pièces d'équipement** sont des objets **détourés**, servis en AVIF /
WebP / **PNG** à 256 × 256 — le PNG parce qu'il y a une transparence à garder.
Le fond est demandé plat et uniforme à la génération, puis découpé par
propagation depuis les bords : seul ce qui touche le bord disparaît, donc les
noirs intérieurs — l'ombre d'un pli, le creux d'un pavillon de mégaphone — sont
épargnés. Elles apparaissent au deck, au kiosque, à la bienvenue et au profil,
dans un cadre qui porte la rareté.

**Les cinq stades** sont vus du dessus, terrain vertical, les deux grandes
tribunes à gauche et à droite — c'est ce cadrage qui permet d'y poser deux
camps. Servis en AVIF / WebP / JPEG à 720 de large, plus une vignette à 300.

`scripts/stade-images.mjs` fait une chose de plus que ses deux voisins : il
**mesure** où sont le terrain et les tribunes, et écrit ces plans dans
`public/img/stade/plans.json`. Le terrain se repère à sa **teinte** — du
vert-jaune au vert franc, ce qui tient sous des projecteurs blancs comme
ambrés ; un premier essai jugeait sur « vert plus grand que rouge » et ne
trouvait pas le stade éclairé en ambre. Les tribunes sont les bandes qui
bordent le terrain. Un stade redessiné garde donc ses tribunes au bon endroit
sans que personne n'y pense.

Les invites sont versionnées avec les scripts — `npm run actions:invites`,
`npm run stuff:invites` — parce qu'une invite perdue est un dessin qu'on ne sait
plus refaire dans le même style. Les rendus d'origine sont dans `art/action/`,
`art/stuff/` et `art/stade/`, et ils sont **dans le dépôt** contrairement aux
sources de Fanzzy : ceux-là se rejouent, ceux-ci sortent d'un générateur qui ne
rend jamais deux fois la même image. Le `.gitignore` le dit.

---

## 4 bis. Le journal des sessions a déménagé

Trente-sept sections de journal occupaient ici trois mille cent cinquante lignes,
soit près des deux tiers d'un document qui s'annonce « à lire en premier ». Elles
sont maintenant dans **`HISTORIQUE.md`**, telles quelles : même texte, même ordre,
rien de résumé ni de retiré. Ce fichier est passé d'environ cinq mille lignes à
deux mille — et ce nombre-là n'est pas répété plus précisément, parce qu'il
changera au premier ajout et que personne ne pensera à le corriger.

Ce n'est pas un rangement de confort. Pour savoir si une chose fonctionnait, il
fallait lire trente-sept récits et rejouer dans sa tête ce que chacun avait fait
ou défait — pendant que les sections 4, 5 et 6 de ce fichier existent précisément
pour répondre à « ce qui existe », « ce qui reste » et « quels pièges sont
connus ». Le journal répond à une autre question, qui est **pourquoi le code est
écrit ainsi**, et c'est pour celle-là qu'on l'ouvre.

Les renvois du code à `ETAT.md § 9` (fabriquer une illustration) et
`§ 7 bis` (à faire sur le serveur) restent valables : ces sections sont ici.

---

## 5. Ce qui reste à faire

Par ordre d'utilité.

1. **Dessiner ce qui n'a aucune image.** C'est de loin le premier poste, et le
   plus visible pour un joueur.

   Relevé du 28 septembre 2026, par `npm run images:test`, qui lit le disque :

   | | cartes |
   |---|---|
   | ont leur propre dessin | 314 |
   | tombent sur le dessin de leur premier âge | 272 |
   | **n'ont aucune image** — rendu procédural | **179** |
   | total au catalogue | 765 |

   Les 272 du milieu ne sont pas une dette au même titre : elles montrent le bon
   personnage, simplement pas son âge. Les **179** sont celles qui affichent une
   silhouette géométrique dans un cône de projecteur. En amont, **89 lignées**
   — 89 cartes de premier âge — attendent leur dessin, et chacune en débloque
   deux derrière elle : c'est pour cette raison qu'on dessine les premiers âges
   **avant** les légendaires, qui n'ont qu'un âge et n'en débloquent aucun.

   `images:test` tient ce compte à chaque passage, et son seuil est un
   **cliquet** : actuellement 233, pour une dette réelle de 179. Il ne monte que
   si on le décide, et chaque mouvement porte sa raison en commentaire dans le
   script — la seule raison admissible de le relever est du contenu **ajouté**,
   jamais du contenu perdu. L'abaisser est toujours permis, et c'est même dû
   après une fournée : le laisser haut laisserait passer sans bruit la perte des
   dessins qu'on vient de faire.

   **Le détail, dessin par dessin, est dans `catalogue.html`** — `npm run
   catalogue`, avec un filtre par série. C'est là qu'on voit *lesquels* manquent,
   et pas seulement combien.

   Reste ensuite, à plus long terme, à dessiner les âges **pour de bon** : voir
   un personnage vieillir est ce que le jeu promet, et le repli montre le bon
   personnage sans montrer son âge.

   Et les **états** — douze par âge, du repos à la victoire. Le manifeste en
   compte aujourd'hui **37 personnages, dont 32 avec plusieurs états** ; tous les
   autres jouent leur image de repos dans les douze situations, si bien qu'un but
   et une défaite leur donnent le même visage. Même remarque pour les **tenues** :
   neuf existent dans le jeu, une seule est dessinée.

2. **Une mise en page pour écran large.** L'application est en colonne étroite
   centrée, pensée pour le téléphone. Sur un ordinateur, les deux tiers de
   l'écran sont vides.

3. **Répartir les dix gestes sur le catalogue.** `cri.gest` ne vaut encore que
   `tempo`, `mash` ou `hold` dans `dex.js` et `dex-2026.js` — les sept nouveaux
   gestes n'appartiennent à aucun personnage. Le duel les fait tourner de
   lui-même, donc le joueur les rencontre quand même ; ce qui manque, c'est que
   le geste dise quelque chose du Fanzzy qui le porte. **Ce n'est pas une
   migration mécanique** : attribuer un geste, c'est décrire un caractère, et
   cela se décide personnage par personnage.

4. **Le derby automatique** — proposer un duel quand deux joueurs en ligne
   suivent les deux clubs qui s'affrontent réellement. Conçu, pas commencé.

5. **Le pronostic de ferveur** — miser des écharpes sur un score avant le coup
   d'envoi. Conçu, pas commencé.

6. **Les notifications.** Le KOP émet déjà sur le socket quand un vote s'ouvre,
   mais rien n'atteint un joueur dont l'onglet est fermé. Trois minutes de
   vote, c'est court : sans notification hors de la page, la moitié d'un KOP ne
   votera jamais.

7. **Brancher la collection de stades.** Le catalogue et les effets sont écrits
   dans `src/shared/stades.js`, les cinq dessins sont rangés, les tribunes se
   mesurent et s'allument. Il reste : la table de possession, le tirage dans
   les boosters, l'application des `mods` dans les deux moteurs, et l'affichage
   du stade en fond d'écran.

   **Une décision d'orientation attend là.** La corde du Virage est verticale —
   soi en bas, l'adversaire en haut — alors que les stades ont leurs tribunes à
   gauche et à droite. Soit on fait pivoter le stade d'un quart de tour et l'on
   perd du cadrage, soit on garde le terrain au milieu avec les deux tribunes
   sur les côtés et la corde qui descend le long de la pelouse. La seconde est
   plus lisible et ne coûte rien.

8. **L'intégration de l'équipement sur les personnages.** Les sept objets sont
   détourés pour ça — l'écharpe autour d'un cou, le mégaphone dans une main. Il
   reste à décider des points d'ancrage et de la façon dont ils suivent les
   poses de `fanzzy-scene.js`.

**Ce qui n'est plus sur cette liste**, et qui y figurait : la simulation
d'économie (rejouée, `npm run economie`), les trois évolutions pour tous
(écrites), la carte Relève, le niveau et l'XP, le KOP et sa page, les skins par
âge, le contenu des boosters, **le fil du match dans le Grand Virage**, les
**amis**, les **couleurs extraites des blasons**, le **déploiement depuis
GitHub**, les **cartes d'action illustrées** et leur animation, les **cartes
d'équipement**, et **les cartes d'action dans le Grand Virage**. L'audit
A-à-Z du produit est entièrement traité.

**Le multilingue reste une promesse à moitié tenue**, et c'est le plus gênant
de la liste parce qu'il se voit : `/compte` et `/profil` proposent quatre
langues — français, anglais, allemand, espagnol — alors que la seule traduction
réelle du projet est `src/shared/i18n/authMessages.js`, employée par les
messages d'authentification et par `/compte`. Tout le reste est écrit en
français dans le balisage.

Il faut soit retirer le sélecteur, soit faire une vraie passe
d'internationalisation. Le sélecteur a déjà été retiré de `/equipes`, où il
n'avait rien à faire.

Deux manques connus du fil, assumés et non urgents. Les **buts d'avant
l'arrivée** ne figurent pas au fil d'un joueur qui entre en cours de match :
ils ont leur propre chemin, le score les porte, et les réintroduire les ferait
sonner comme des buts frais au moment de l'entrée. Et le fil ne connaît que la
**période en cours**, pas celles déjà passées : entrer en seconde période
affiche « reprise », pas « coup d'envoi » puis « mi-temps ». On pourrait les
déduire ; ce serait la première chose que le fil affirme sans l'avoir vue.

---

## 6. Pièges connus

**Un signe en dur devant un nombre calculé.** La phrase qui décrivait un effet
sur une carte s'écrivait comme ceci :

```js
`Souffle +${Math.round((m.breathBonus - 1) * 100)} %`
```

Pour un `breathBonus: 0.85`, la carte affichait **« Souffle +-15 % »**. Compté
sur le catalogue réel : **377 occurrences, sur dix clés** — c'est-à-dire la
majorité des malus du jeu. La même table écrivait « Tempo plus tolérant (×0.9) »,
où le mot dit l'inverse du nombre, et « Martelage 0,5 s plus court » pour une
valeur qui l'allonge.

Deux leçons, et la seconde est la vraie.

La première : **le signe appartient au nombre**, jamais au gabarit. Un helper qui
rend « +20 % » ou « −15 % » supprime la faute par construction.

La seconde : **le contrôle était vert.** Il lisait le fichier à l'expression
régulière et vérifiait qu'une clé était *mentionnée* — or `breathBonus` était
bien mentionné, dans une phrase fausse. Un garde-fou qui vérifie la présence d'un
nom ne vérifie rien du contenu. Il **exécute** maintenant la table dans un bac à
sable de dix lignes — `node:vm`, aucune dépendance — et éprouve ses phrases sur
les **517 valeurs** réellement portées par le catalogue, l'équipement et les
stades. C'est ce qui rend la faute impossible à reproduire, et non le fait de
l'avoir corrigée.

**Et le sens d'un modificateur ne se déduit pas de son signe.** C'est ce qui a
fait diverger les copies : un `tempoInterval` positif est un **malus** — il
écarte les pulsations, donc le chant dure plus longtemps et on en place moins. Ce
qui tranche n'est pas une lecture du moteur, qui se contente d'additionner : ce
sont les textes de `inventaire.js`. Les Jumelles portent `tempoInterval: 70` et
disent « tu vois venir le rythme, **mais tu chantes plus lentement** » ; le
sifflet porte `-55` et dit « le contretemps **devient lisible** ». Le sens est
donc déclaré clé par clé dans `public/mods.js`, avec la raison écrite à côté.

**La même table en cinq copies.** Celle-ci vivait dans `cartes.js`, `deck.html`,
`fanzzy-fiche.js`, `scripts/catalogue.mjs` et `scripts/dossier.mjs`. Trois
étaient fausses, chacune autrement, et `deck.html` portait le commentaire
« vocabulaire commun avec la fiche Fanzzy : les mêmes mots partout » alors que le
même effet s'y écrivait « Tempo +20 % » contre « Tempo plus tolérant (×1.2) »
ailleurs. La fiche du Fanzzy, elle, ne nommait ni `parryResist` — 103 cartes — ni
`costPenalty` — 17 : exactement le défaut que `cartes.js` disait avoir corrigé
chez lui. **Un commentaire qui affirme une unité ne la crée pas**, et c'est le
troisième de ce dépôt à avoir été pris en flagrant délit — voir les « petites
briques » de `ui.css`. Les quatre écrans renvoient maintenant à
`public/mods.js` ; les deux documents générés gardent leur copie, côté Node, et
`catalogue:test` les rapproche.

**`getElementById` rend le premier, et ne dit jamais qu'il y en avait deux.**
Dans `/admin`, le filtre des séries et le champ SÉRIE du formulaire d'édition
portaient tous deux l'identifiant `f-set`, et les deux sont à l'écran en même
temps — le formulaire s'insère dans le tableau, sous la barre de filtres. Tout le
code qui croyait lire le formulaire lisait donc le filtre. Résultat : changer la
série d'une carte **n'avait aucun effet**, et toute carte créée recevait la
première série du catalogue, quel que soit le choix fait à l'écran. Aucune
exception, aucun écran de travers, aucun test rouge — seule la base finissait
fausse. Les voisins échappaient au piège par leurs noms (`f-fam` contre `f-type`,
`f-rr` contre `f-rar`) : quelqu'un l'avait déjà évité pour la famille et la
rareté, et manqué pour la série. `npm run pages` refuse maintenant tout
identifiant écrit deux fois dans une page, avec une liste de tolérances
documentée pour ceux que l'administration réemploie d'un onglet à l'autre.
**Règle : un identifiant est unique dans le document rendu, pas dans le gabarit
qu'on est en train d'écrire.**

**Un champ de saisie qui déclenche un redessin se fait détruire par lui.**
`/teletext` réécrivait son en-tête à chaque rafraîchissement, donc l'`input` — et
c'est cet `input` qui demandait le rafraîchissement. Mesuré au navigateur : nœud
différent, focus retombé sur le corps du document, curseur revenu à zéro. Il
fallait retoucher le champ entre chaque bout de mot, sur l'écran qui sert à
trouver une compétition parmi neuf cent cinquante ; sur téléphone, le clavier se
refermait. Les trois recherches de `/admin` avaient la même. Deux corrections
selon les cas : ne pas reconstruire ce qui est déjà là (`if (!$('q'))`), ou noter
qui tenait la main et où en était son curseur pour le rendre après (voir
`sansPerdreLaMain` dans `admin.html`). **Règle : avant de réécrire un conteneur,
demander si le geste de l'utilisateur vit dedans.**

**Un jour UTC étiqueté en heure locale décale tout le ruban.** Le sélecteur de
journée de `/matchs` tirait son adresse de `toISOString()` — un jour **UTC**, ce
qui est juste, puisque la route appelle l'API avec `timezone: 'UTC'` et met sa
réponse en cache sous cette clé. Mais il s'étiquetait avec
`toLocaleDateString()`. À 00 h 30 à Zurich, le bouton disait « AUJOURD'HUI ·
28 sept. » et rapportait les matchs du 27 ; à 20 h à Montréal, il annonçait le
jour en cours et rapportait ceux du lendemain, et « HIER » montrait alors des
matchs à venir. La liste n'était pas fausse : elle répondait à une autre question
que celle imprimée sur le bouton. Deux conventions cohabitent dans ce dépôt, et
chacune est justifiée là où elle est — `src/shared/jour.js` lit les composantes
**locales**, parce qu'une colonne `DATE` de MySQL arrive comme minuit local ; le
télétexte raisonne en **UTC**, parce que c'est la clé de son cache. **Règle : ne
jamais mélanger les deux dans la même phrase à l'écran ; l'étiquette et le
contenu doivent sortir du même repère.**

**`pointer-events:none` arrête le doigt, pas la touche Entrée.** La porte
« GRAND VIRAGE » éteinte de `/matchs` portait `href="#"` et cette propriété. Un
lien reste dans l'ordre de tabulation, et l'Entrée y déclenche un clic que le CSS
ne voit pas passer : le navigateur suivait « # », ce qui **empile une entrée
d'historique** sans rien changer à l'écran. La flèche de retour demandait ensuite
deux pressions, dont la première ne faisait rien de visible — c'est-à-dire
exactement ce qu'on rapporte comme « la flèche retour ne marche pas ». **Règle :
un lien désactivé n'a pas d'adresse du tout.** Sans `href`, `<a>` n'est plus un
lien : il sort de la tabulation, et il n'y a plus rien à suivre.

**Une exception dans le dessin emporte la minuterie avec elle.** Sur la fiche
d'un match en direct, `relire()` faisait `dessinerFiche()` puis
`planifierFiche()`. Il suffisait qu'un champ manque au relevé — une ligue sans
nom, un match sans fil — pour que l'exception saute la replanification : plus de
relecture, plus de chrono, un score arrêté à la minute de l'incident **pour le
reste de la visite**, et rien qui le montre. **Règle : ce qui relance le cycle va
dans un `finally`.** Le corollaire vaut aussi : un chemin d'erreur qui « rend la
main » doit replanifier comme le chemin heureux, sinon un seul refus passager
gèle l'écran définitivement.

**Un bouton qui appelle le serveur sans rattraper le refus ne dit rien du tout.**
C'est la famille de défauts la plus fréquente de ce dépôt, retrouvée sept fois
dans une seule revue. Quand l'aide d'appel lève sur une réponse non-2xx — et
c'est la bonne façon de l'écrire — un gestionnaire sans `try` laisse l'exception
se perdre : pas de message, pas de rafraîchissement, pas de reçu. L'utilisateur
ne peut pas distinguer ça d'un clic qui n'a pas pris, alors il reclique. Le pire
de la série affirmait même « rendu au défaut » sans avoir rien rendu. **Règle :
tout appel déclenché par un geste a son chemin d'échec visible à l'écran**, et il
ne dit que ce que le client peut vérifier — « Rien n'a été débité » est une
affirmation qu'une page n'a pas les moyens de faire.

**Le serveur s'installe sans les dépendances de développement.** `puppeteer` est
une dépendance déclarée du dépôt, et son installation **télécharge Chromium** :
deux cents mégaoctets au transfert, sept cents dépliés. Le déploiement passe donc
par `npm ci --omit=dev` — sans quoi chaque construction tente ce téléchargement
sur l'hébergement mutualisé, et un `npm ci` qui échoue arrête tout le
déploiement. La contrepartie est qu'un `import` de trop devient invisible en
développement et fatal en ligne : `sharp` dans un module serveur, et la mise en
ligne casse au démarrage avec « Cannot find package », c'est-à-dire toutes les
routes `/api` d'un coup, connexion comprise. `npm run cablage` lit `server.js`,
tout `src/`, `build.mjs` et le chemin du schéma, et refuse tout paquet déclaré en
développement. **Règle : le serveur ne connaît que ses cinq paquets de
production.**

**Un accent grave dans un commentaire à l'intérieur d'un gabarit de chaîne casse
le fichier.** Les pages assemblent leur HTML dans des gabarits délimités par des
accents graves, et les commentaires `<!-- … -->` écrits dedans en font partie :
le premier accent grave referme la chaîne, et le bloc entier cesse de compiler.
La faute a été commise **deux fois dans la même séance**, malgré un commentaire
voisin qui prévenait. Employer les guillemets français pour citer du code dans
ces commentaires. `npm run pages` l'attrape à chaque fois, immédiatement — c'est
le premier contrôle à lancer après avoir touché à une page.

**Un contrôle resté sur un ancien nom accuse le code à sa place.**
`epreuves-ui-smoke` annonçait « chaque note descend dans son couloir (0/13) »
après que la classe `tbf-note` de l'épreuve a été renommée `tbf-ep-note` — elle
écrasait celle des briques partagées. Le rouge ne disait pas que les notes ne
descendaient plus : il disait que le contrôle ne savait plus où regarder. **Règle
: devant un rouge total — 0 sur 13, et non 11 sur 13 — soupçonner d'abord le
sélecteur.** Un vrai défaut de comportement rate rarement *tout*.

**Un canvas dit ce qu'il sait écrire, jamais ce que le navigateur sait lire.**
Trois fichiers choisissaient le format des images en demandant à un canvas
`toDataURL('image/avif')`, puis `toDataURL('image/webp')`, et prenaient la
réponse pour ce que le navigateur savait **afficher**. Les deux questions n'ont
aucun rapport : **personne n'encode l'AVIF**, pas même Chrome — la branche
`.avif` ne s'est donc jamais ouverte, et les vingt-quatre mégaoctets d'AVIF du
dépôt n'ont jamais été servis à personne — et **Safari n'encode pas le WebP**
alors qu'il le lit depuis 2020. Tout ce qui n'était pas Chrome retombait donc
sur `.jpg`. Or un Fanzzy est **détouré** : il n'existe qu'en AVIF, WebP et PNG.
L'accueil demandait `/img/fanzzy/TR57.jpg`, recevait un 404, et sa réécriture de
secours ne connaissait que `.avif` et `.webp` — le `.jpg` passait au travers,
les deux calques restaient éteints, et l'écran d'accueil n'avait **plus personne
au centre** sur Firefox et sur iPhone, avec le nom du Fanzzy écrit juste en
dessous. La fiche « Mon Fanzzy » montrait le même personnage sans broncher : son
`<img onerror>` retombe sur le PNG. Deux écrans du même jeu, deux réponses,
aucune erreur en console.

Trois règles en sortent. **On ne devine plus le format** : le WebP est lu
partout depuis Safari 14 et Firefox 65, bien avant le `dvh` de 2022 dont ce jeu
ne peut pas se passer, et chaque image du dépôt a son jumeau `.webp` —
`fanzzy-etats.js` le sert à tout le monde et n'a plus rien à détecter. **Le
repli suit la famille du dessin**, jamais l'inverse : un personnage détouré
retombe en PNG, une photo en JPEG ; `secours()` est le seul endroit qui le sait,
et il remplace l'extension sans manger la révision de `?v=`. Et **un contrôle de
fichiers présents ne vaut rien sans un contrôle de l'adresse demandée** :
`verif-pages` vérifiait les trois formats sur disque depuis toujours, pendant
que la page en réclamait un quatrième. Il monte maintenant le vrai
`fanzzy-art.js` et vérifie que l'adresse qu'il construit — et son secours —
désignent des fichiers qui existent.

**Et l'AVIF est revenu, servi par le serveur.** C'est la suite logique du
constat : le navigateur dit déjà ce qu'il sait lire, à chaque requête d'image,
dans `Accept`. Il n'y a rien à deviner, il y a à lire.
`src/server/images/index.js` relève au démarrage les images qui ont un jumeau
`.avif` — 584 sur les 4 000 fichiers de `/img` — et, quand le navigateur a
annoncé `image/avif` en toutes lettres, réécrit l'adresse demandée avant le
`express.static` de `/img`. **L'adresse ne change pas côté page** : le HTML, le
classeur, le service worker et le manifeste des états continuent de parler de
`.webp`, et personne n'a à savoir ce qui part sur le fil. Les 28,7 Mo de WebP
deviennent 18,3 Mo d'AVIF pour qui sait les lire — **36 % de moins**.

Deux pièges y sont écrits noir sur blanc, et `images:smoke` les tient : **un
joker ne vaut pas une déclaration de capacité** — Safari 15 annonce `image/`
suivi d'une étoile et ne sait pas lire un AVIF, l'accepter referait la faute
qu'on vient de corriger, en plus discret ; et **`Vary: Accept` n'est pas une
politesse** — deux navigateurs demandent la même adresse et reçoivent deux
fichiers, sans cet en-tête un cache partagé sert l'AVIF de l'un à l'autre. La
suite rejoue les en-têtes réels de quatre navigateurs, dont Safari 15 et Safari
17, sur les vraies images.

**Un `catch` muet autour d'un ajout facultatif cache une panne pour de bon.**
L'entrée ADMIN du menu se posait avec `nav.appendChild(a)`, sur une variable
disparue avec la barre du bas. La `ReferenceError` tombait dans un
`catch { /* module absent */ }`, et plus aucun administrateur n'a vu l'entrée —
sans erreur en console, sans trace, sans test rouge. Le `catch` ressemblait à
une précaution, ce qui lui a permis de survivre à toutes les relectures. Règle :
un `try` autour d'un ajout facultatif doit entourer **l'appel réseau**, pas la
construction du DOM qui suit ; et ce qui doit apparaître pour certains comptes
seulement se vérifie dans une suite, en comparant les deux comptes.

**Une liste incomplète a l'air d'une liste.** `modsText` nommait onze effets sur
treize : `parryResist`, porté par **cent trois cartes**, et `costPenalty`, porté
par dix-sept, n'avaient aucune phrase. La fiche affichait donc leurs effets sans
celui-là. Rien n'était vide, rien ne cassait, aucune console ne parlait — et une
carte qui montre deux effets sur trois a exactement l'air d'une carte qui en a
deux. Règle : partout où du code traduit un ensemble de clés en texte, un
contrôle doit confronter la table **à toutes les clés réellement employées**.
C'est `catalogue:test` qui le fait ici.

**Un accent grave dans un commentaire CSS ferme le gabarit de chaîne.**
`verif-pages` le traque dans `public/` depuis qu'il a cassé `nav.js` deux fois.
Il se produit aussi dans les **scripts** — `catalogue.mjs` l'a fait — où rien ne
le guette : le message du moteur pointe cinquante lignes plus bas, sur un mot au
hasard du CSS. Dans un bloc CSS écrit en gabarit, on n'écrit pas d'accent grave,
même pour citer un nom de propriété.

**Deux navigations finissent toujours par ne plus dire la même chose.** Elles
l'ont fait trois fois : barre du bas contre tiroir, puis menu commun contre
menu de l'accueil (six entrées d'écart et une confirmation de déconnexion
présente d'un seul côté). Rien ne casse jamais — les deux s'ouvrent, les deux
mènent quelque part. `scripts/menu-smoke.mjs` compare désormais les listes
obtenues en **cliquant** le bouton de chaque page.

**Le deuxième argument de `api()` est le corps, pas des options.** Quatre appels
de l'écran d'administration y passaient `{ method, body }` : le serveur recevait
un POST dont le corps était `{ method: 'PATCH', … }`, refusait sans code, et
l'écran affichait « Impossible. ». Les seize autres appels de la même page
étaient corrects, ce qui rend la faute invisible à la relecture — on lit une
ligne qui ressemble à `fetch`, et `fetch` prend bien des options.

**Pousser sur GitHub ne met rien en ligne.** C'est le piège le plus cher de ce
projet, parce qu'il ne ressemble pas à une panne : le code est sur GitHub, le
site répond, `/healthz` est vert — et la production tourne sur une version
d'avant. Infomaniak ne va chercher le dépôt que lorsqu'on **lance la
construction à la main** dans l'onglet Node.js du Manager ; c'est là qu'est la
commande `git pull && npm install && node build.mjs`. La commande de lancement,
`npm start`, redémarre l'application sans jamais faire de `git pull` : un
redémarrage seul relance donc l'ancien code.

Le contrôle qui tranche en dix secondes, sans se fier au cache du navigateur :

```bash
curl -s "https://thebestfan.online/api/fanzzy/dex?v=$(date +%s)" | grep -c '"id"'
```

Le compte doit correspondre au nombre de Fanzzy du dépôt. S'il est plus bas, la
construction n'a pas été lancée. Une page nouvelle qui répond 404 alors que son
fichier existe dans `public/` dit la même chose.

**Le schéma doit être complet.** 36 tables. Une table manquante produit des
erreurs déroutantes — c'est ce qui a causé « Ouverture impossible ». Contrôle :
`SHOW TABLES;`. Base ancienne : `sql/rattrapage.sql`.

**Relancer `scripts/coverage.mjs` après toute modification du schéma
`souvenir_leagues`**, sinon les paliers et la couverture des buteurs restent
vides et le télétexte affiche une base incomplète.

**Le quota API est la contrainte structurante.** Tout passe par `api_cache`. Une
compétition consultée toute la journée coûte environ 34 appels ; le budget de
6 800 permet environ 200 compétitions actives par jour. Ce qui coûte, c'est le
nombre de compétitions *différentes*, pas le nombre de joueurs.

**Ne jamais identifier un événement par sa position** dans la liste de l'API :
elle en insère parfois un plus tôt, tout se décale, et un but disparaît. On les
identifie par type, équipe, minute et joueur.

Cette règle était écrite ici et **n'était appliquée qu'à moitié**. La
déduplication des buts passait bien par l'identité — donc les cartes-souvenirs
restaient justes, donc personne ne voyait rien. Mais `fixture_events` stockait
chaque événement à son rang dans la liste, en `INSERT IGNORE` : au premier
décalage, les lignes déjà là gardaient leur ancien contenu et seule la queue
était écrite, avec un contenu décalé d'un cran. La base finissait par porter un
événement en double et en perdre un autre. Le fil du match, lui, le montre —
et c'est pour ça qu'il l'a trouvé. Le relevé est désormais **réécrit en
entier** à chaque passage, queue coupée comprise quand l'API raccourcit sa
liste. Une règle qu'on écrit sans l'appliquer partout est une règle qu'on croit
tenue.

**Un crochet passé n'est pas un crochet branché.** `server.js` confiait
`onFinished` à `createFootball`, qui ne le nommait pas dans sa signature et ne
le transmettait donc à personne. Aucune erreur, aucun log : le classement d'une
compétition n'était simplement jamais rafraîchi à la fin d'un match — six
heures de cache sur les chiffres qu'on va justement regarder à ce moment-là.
C'est la même famille que la dépendance restée à `null`, et c'est maintenant
`verif-cablage.mjs` qui la surveille : il déroule un vrai tour de relevé sur un
faux pool et regarde **qui a été appelé**, plutôt que de lire la signature — un
nom présent dans une signature peut n'être transmis à personne.

**`#app` est un contexte d'empilement, donc une prison.** `ui.css` lui donne
`position: relative; z-index: 1` pour poser la colonne au-dessus du décor. Tout
ce qui vit dedans y est enfermé : son `z-index`, si haut soit-il, ne se compare
qu'à ses frères. Or `fx.js` pose ses bandeaux et ses titres sur `body`, aux
calques 89 à 93. Un panneau plein écran placé dans `#app` passe donc **sous**
eux — et la feuille du fil s'est retrouvée avec sa tête et son bouton de
fermeture cachés sous un « MINUTE DOUBLE » pendant trois secondes. Un panneau
qu'on ouvre se place hors de la colonne, en `position: fixed`, centré à la même
largeur.

**Une classe d'animation qu'on ne retire pas fige ce qu'elle remplace.** Sur
l'accueil, le petit saut posait `.saute` et ne l'enlevait jamais : l'animation
d'un demi-tiers de seconde remplaçait définitivement le flottement en boucle du
personnage. Rien ne casse, rien ne se voit — le mouvement manque, c'est tout,
et personne ne remarque une absence. Ces classes se retirent à `animationend`,
filtrées par nom d'animation puisqu'elles se superposent.

**Le SMTP n'est pas configuré** tant que `/healthz` affiche `"etat":"console"`.
Les mails de vérification partent alors dans les logs du Manager.

**Ne jamais mettre en cache une réponse vide comme si elle était définitive.**
Une composition demandée avant sa publication revient vide ; la garder trente
minutes fait manquer sa parution. Les réponses vides vivent 90 secondes.

**Une page à hauteur fixe ne se décale pas avec une marge sur le corps du
document** : son contenu est coupé. La barre commune réserve donc sa place sur
le conteneur `#app`, pas sur `body`.

**Sur un écran de jeu, la barre ne réserve que 55 % de sa hauteur.** C'est
voulu : elle s'y efface dès qu'on joue et une réserve pleine mangerait la place
utile. Mais ça ne suffit pas pour le bouton d'action principal, qui passait
16 px dessous — un joueur visant « CHANTER » touchait « PROFIL » et quittait le
duel. Les pages de jeu complètent les 45 % manquants elles-mêmes, sur le bouton
concerné. Vérifié par mesure des rectangles dans `nvn-ui-smoke.mjs`.

**L'appui long ouvre le menu natif du navigateur sur mobile** et vole le geste
de déchirure d'un booster. Neutralisé dans `nav.js` par trois moyens
complémentaires — un seul ne suffit pas selon les navigateurs.

**Ne jamais centrer une illustration par `transform`.** `fx.js` pose la classe
`fz-vivant` sur toute image `.illu` pour la faire respirer, et ses keyframes
réécrivent `transform` en entier : un `translateX(-50%)` y est effacé dès la
première image de l'animation. Les marges automatiques ne marchent pas non plus
quand l'image déborde de sa fenêtre — la marge gauche est ramenée à zéro et
tout le débord part à droite. Utiliser `object-fit` et `object-position`.

**Le catalogue est servi avec un cache d'une heure.** Après un déploiement qui
ajoute des Fanzzy, un joueur déjà connecté garde l'ancien catalogue jusqu'à
soixante minutes et peut tirer une carte que sa page ne connaît pas.
L'ouverture de booster le dit désormais au lieu de planter (« Carte inconnue de
cette version »), mais la vraie correction reste à faire : un numéro de version
dans l'URL du catalogue, pour casser le cache à chaque déploiement.

---

## 7. Questions juridiques ouvertes

À traiter avec un avocat, pas avec moi :

- ~~**Vendre des écharpes** qui achètent des boosters à contenu aléatoire.~~
  **Fermée** : l'argent réel n'achète plus que des billets, et les billets
  n'achètent que des objets nommés. Les écharpes ne sont plus en vente du tout.
  Aucune chaîne ne mène d'un euro à un tirage, et `verifierCatalogue()` le
  tient — ce n'est pas une intention, c'est une propriété éprouvée.

  **Elle se rouvre le jour où l'on ajoute `packs` à `LIVRAISONS_PAYANTES`.**
  Ce jour-là, un contrôle nommé rougit, et ces trois points reviennent : afficher
  les taux de tirage (ils sont dans `RATES`), décider des territoires où vendre,
  poser un garde-fou d'âge ou un plafond de dépense.

- **Un achat en argent réel reste un achat.** Droit de rétractation, mentions
  légales, conditions de vente, TVA selon le pays de l'acheteur : ces
  obligations-là ne dépendent pas du hasard, elles dépendent du paiement. Elles
  ne sont pas traitées par ce dépôt.
- **Une carte-souvenir porte le nom et l'écusson d'un club.** L'afficher dans un
  tableau de résultats est un usage normal ; en vendre un exemplaire est autre
  chose.

## 7 bis. À faire sur le serveur, en attente

0. **Cinq migrations ne sont pas appliquées en production** : `sql/minutes.sql`,
   `sql/couleurs.sql`, `sql/amis.sql`, `sql/boutique.sql` et `sql/billets.sql`.
   Les deux dernières portent la boutique : sans elles, la table des achats
   n'existe pas et la bourse n'a pas de colonne `billets` — c'est-à-dire que
   **toute lecture de bourse échoue**, donc tout l'état du joueur. Elles le seront automatiquement au
   premier déploiement par GitHub, qui applique le schéma **avant** de
   redémarrer — c'est précisément la panne du 8 septembre 2026 qui a fait
   écrire cette étape. En cas de doute, `npm run schema:appliquer` fait la même
   chose depuis un poste, et refuse proprement si `DATABASE_URL` est absent.

1. **Relancer l'inventaire des compétitions.** Les paliers en base suivent
   peut-être encore l'ancienne règle, qui classait 117 compétitions comme
   « majeures ». `node --env-file=.env scripts/coverage.mjs` — attendu : une
   dizaine.
2. **Déclarer un administrateur**, si ce n'est pas fait : ajouter `ADMIN_EMAILS`
   au `.env` puis redémarrer. Sans lui, personne ne peut ouvrir `/admin`, et
   seul un administrateur peut en nommer un autre.
3. **Vérifier les migrations à colonnes après chaque livraison.** `niveau.sql`,
   `skins.sql` et `stades.sql` ne créent aucune table : `SHOW TABLES` ne les
   voit pas. Le démarrage les contrôle depuis le 9 septembre 2026, mais la
   requête reste utile en cas de doute :

   ```sql
   SELECT
     (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE()
       AND table_name = 'user_wallet' AND column_name = 'xp')     AS niveau_ok,
     (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE()
       AND table_name = 'user_skins'  AND column_name = 'stage')  AS skins_ok,
     (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE()
       AND table_name = 'user_fanzzy' AND column_name = 'stage')  AS stades_ok;
   ```

   Il faut `1, 1, 1`.

---

## 8. Configuration du serveur

Variables dans `.env`, jamais commité :

```
DATABASE_URL=mysql://o42s1v_tbf:MOTDEPASSE@o42s1v.myd.infomaniak.com:3306/o42s1v_thebestfan
PUBLIC_ORIGIN=https://thebestfan.online
SESSION_SECRET=<openssl rand -hex 32>
API_FOOTBALL_KEY=<clé>
API_FOOTBALL_BUDGET=6800
ADMIN_EMAILS=ton@adresse.ch
GOOGLE_CLIENT_ID=…      GOOGLE_CLIENT_SECRET=…
SMTP_HOST=mail.infomaniak.com   SMTP_PORT=465
SMTP_USER=no-reply@thebestfan.online   SMTP_PASS=…
MAIL_FROM=thebestfan <no-reply@thebestfan.online>
```

Déploiement complet : voir `DEPLOIEMENT.md`.

---

## 9. Fabriquer une illustration

### Un Fanzzy traverse une vie

Âge 1 l'enfant ou l'adolescent, âge 2 l'adulte, âge 3 le vieux. C'est le
vieillissement qui porte l'évolution, et la raison est simple : **c'est ce qui
est amusant**. Voir son personnage traverser une vie est une récompense ; le
voir gagner deux pastilles cousues n'en est pas une.

**La règle a été essayée dans l'autre sens, et l'essai a tranché.** Une version
de `inviteAge()` a figé l'âge pour ne faire monter que le domaine — le
raisonnement tenait sur le papier : le joueur qui paie quatre-vingt-dix
écharpes doit reconnaître son personnage, et un gamin de onze ans vieilli deux
fois devient un homme de cinquante-sept dont plus rien ne rappelle la première
carte. Les deux dessins qui en sont sortis ont montré ce que le papier ne dit
pas : un gamin qui reste un gamin avec plus d'écussons n'est pas une évolution,
c'est une variante. Deux cent soixante crédits, et la bonne réponse — c'est
pour ça qu'on essaie sur une lignée avant les cent trente-sept autres.

**Ce que l'essai a laissé derrière lui**, et qui est le vrai gain : les cinq
axes ne remplacent plus l'âge, ils le **dessinent**. Une ride ne se voit pas à
cent cinquante pixels de haut ; une silhouette, si.

| | Âge 1 | Âge 2 | Âge 3 |
|---|---|---|---|
| empreinte au sol | pieds joints | écartement d'épaules | plantés, ancrés |
| masse du vêtement | flottant, trop grand | ajusté, fermé | long, lourd, ouvert |
| objet du domaine | le corps seul | l'amorce du geste | l'objet de la famille |
| accumulation | rien | quelques pastilles unies | couvert, écharpe au poignet |
| ouverture | bras au corps | menton levé | bras ouverts, face caméra |

**Vieillir quelqu'un et le remplacer sont deux choses différentes**, et un
générateur ne fait pas la différence tout seul : il redessine un visage moyen
de l'âge demandé. `OSSATURE` lui interdit donc ce qui ne bouge pas — la forme
des yeux, le nez, la mâchoire, le teint, la palette du vêtement — et ne lui
laisse que ce que les années font vraiment : les cheveux, la peau, la carrure,
le port. C'est la seule ligne qui sépare « il a grandi » de « ce n'est plus
lui ».

**Une bête, un objet ou un phénomène ne vieillit pas** : il monte en intensité,
comme `dex-ages.js` l'écrit depuis le premier jour. Demander des cheveux gris à
une merguez n'a jamais eu de sens.

`MONTEE` tient l'escalade **famille par famille** : la Voix passe de la voix nue
aux mains en porte-voix puis au porte-voix, la Percussion des baguettes à la
grosse caisse. Ce n'est pas une élégance : le troisième âge de TR1, un
personnage Voix, est arrivé avec un tambour sanglé sur le ventre — le dessin
annonçait une famille que la carte ne joue pas, et c'est le geste qui décide de
ce qu'on peut faire en duel.

**Et la formule de `VISUELS.md` y est maintenant.** Elle ne vivait que dans
l'invite des premiers âges. Les deux seules images du jeu qui portent du texte
interdit et des écussons de club sont précisément les deux âges supérieurs de
TR1, sortis de la fonction qui ne la portait pas. Une règle de droits qui ne
couvre qu'une moitié de la chaîne ne couvre rien.

`invites:test` tient les six règles, et casse volontairement sur chacune.

### TR1 n'a plus qu'un état à ses deux âges supérieurs

Les douze états de `e2` et `e3` avaient été générés sous l'ancienne invite, celle
qui ne portait pas la formule de `VISUELS.md` : ils sont couverts d'écussons de
club, et on y lit « CAPO », « TICKET », « 200-20… ». Le troisième âge tient en
plus un tambour alors que la carte est une **Voix**.

Ils sont donc retirés — soixante-trois fichiers, seize mégaoctets — et il ne
reste que `neutre` et `portrait` à chaque âge. Le repli est écrit pour ça : « un
état absent retombe sur `neutre` ». Le personnage ne réagit plus au but à ces
deux âges, mais il est là, à son âge, et le jeu n'expose plus ces images.

**Pourquoi pas seulement remplacer le `neutre` :** `fanzzy-art.mjs` calcule
**un cadrage par âge, l'union de ses douze états**, et l'applique à tous. Un
`neutre` neuf à côté de onze anciens ferait sauter le personnage d'un état à
l'autre — un défaut qui se lit comme un bug d'affichage, jamais comme un
cadrage. L'unité de reprise est donc l'âge entier, et les rendus d'origine des
onze autres états ne sont pas dans le dépôt (`art/**/_src/` est ignoré par git).

Le jour où l'on redessine ces deux âges, c'est douze états chacun, d'un seul
passage, avec l'invite d'aujourd'hui.

### Les quatre chaînes

Quatre sortes de dessins, quatre chaînes. Celle des Fanzzy d’abord, qui est
la plus ancienne et la plus exigeante ; les trois autres — cartes d’action,
équipement, stades — sont décrites à la fin.

Le jeu attend deux fichiers par Fanzzy, en trois formats chacun : un plein pied
`ID.{avif,webp,png}` en 520×945 pour la fiche, et un buste `ID-buste.*` en
320×320 pour le classeur. Fond transparent.

**Ce n'est plus à faire à la main.** `scripts/fanzzy-images.mjs` exécute toute
la chaîne. Nomme chaque rendu du nom du Fanzzy, dépose-le dans `art/neuves`,
et lance :

```bash
npm install --no-save sharp
npm run images
```

`X9.png` produit les six fichiers de `X9`.

**Sans argument, il lit `art/neuves`** — c'est le seul endroit où l'on dépose
des rendus, et le redire à chaque fois n'apprenait rien à personne. Un chemin
passé en argument gagne toujours, ce qui permet de traiter un lot isolé sans
repasser sur les rendus déjà rangés.

**Il enchaîne `maj-illustres`.** Le script s'arrêtait après avoir écrit les six
fichiers, en demandant d'ajouter l'identifiant à `ILLUSTRES` — une étape qu'on
oublie, et dont l'oubli est silencieux : le dessin est là, le jeu montre quand
même la silhouette. `--sans-liste` saute l'inscription, pour un lot qu'on veut
détourer sans encore le montrer.

Attention : `art/neuves` n'est **pas surveillé**. Y déposer un fichier ne
déclenche rien ; c'est la commande qui travaille. `sharp` n'est pas en
`devDependencies`, pour la même raison que `puppeteer` : il embarque des
binaires natifs qui alourdiraient l'installation sur le serveur, et il ne sert
qu'à fabriquer des images, jamais à en servir.

`scripts/fanzzy-images-smoke.mjs` éprouve la chaîne sur un cas fabriqué qui
reproduit les trois pièges ci-dessous. Il ne demande ni base ni réseau.

Le rendu brut sort d'un générateur en 1536×2752 sur fond uni. Trois choses ont
demandé plusieurs essais, et le script les traite :

**Un rendu déjà détouré ne se redétoure pas.** Les premiers lots arrivaient
aplatis sur fond uni, d'où toute la propagation décrite plus bas. Le lot de
cent vingt-six de septembre 2026 est arrivé avec son canal alpha — et deviner
un fond quand la réponse est déjà dans le fichier donne le pire des deux
mondes : sous la transparence, le noir résiduel a été pris pour du sujet, et
les cent vingt-six cartes sont sorties avec un rectangle noir autour du
personnage. La chaîne lit maintenant l'alpha quand il existe (au-delà de 2 % de
pixels non opaques) et ne devine que sinon. `fanzzy-images-smoke.mjs` rejoue
les deux cas.

**Le détourage ne se fait pas au seuil global.** Un personnage peut tenir des
cartes blanches sur fond blanc, ou porter une fourrure anthracite sur fond
noir. On isole les zones de fond *connexes au bord*, et rien d'autre. L'alpha
suit la distance à la couleur de fond entre deux seuils, ce qui conserve
l'anticrénelage des cheveux et de la fourrure.

**Le buste se centre sur la tête, pas sur le sujet.** La carte du classeur
recadre le carré en portrait : seul le centre reste visible. Centrer sur la
matière la plus haute rate — une main levée monte aussi haut qu'un crâne.
Centrer sur la plage continue la plus large rate aussi — un éventail de cartes
fait une plage large. Ce qui marche : éroder le masque du haut du sujet, les
bras et objets tenus sont trop fins et disparaissent, la tête survit.

**Regarder l'image avant de l'intégrer**, comme le demande `VISUELS.md`. Les
générateurs ajoutent spontanément des écussons et des lettres. Vérifier aussi
qu'un costume ne ressemble pas à un personnage de studio connu : ce n'est pas
un écusson de club, mais c'est le même genre de risque.

### Les poses du supporter, qui obéissent à la règle inverse

`scripts/poses-supporter.mjs` (`npm run poses`) prépare le personnage de
l'accueil : quatre dessins — `idle`, `push`, `goal`, `sad` — plus le décor de
tribune (`bg`), depuis un dossier de rendus.

```bash
npm run poses -- chemin/vers/les/rendus
```

Il ne réutilise pas `fanzzy-images.mjs`, et la raison tient en une phrase :
**les poses ne doivent surtout pas être recadrées chacune sur son sujet.** Une
carte se regarde seule, donc on l'étale dans son cadre. Les poses, elles, se
remplacent l'une l'autre au même endroit, en fondu. Recadrer « bras levés » sur
elle-même rapetisse le personnage et lui remonte les pieds au moment précis du
but — l'œil ne voit pas une pose changer, il voit un défaut d'affichage.

Le script calcule donc **une seule boîte, l'union des quatre**, et l'applique
telle quelle à toutes. Il refuse des sources de tailles différentes, pour
lesquelles une boîte commune en pixels ne voudrait rien dire.

Sorties : `public/img/supporter/<pose>.{avif,webp,png}` en 448×900, fond
transparent, et `public/img/accueil.{avif,webp,jpg}` pour le décor — en JPEG et
non en PNG, une photo de foule y pesant dix fois son prix.

Le supporter n'est plus le personnage principal de l'accueil : c'est le Fanzzy
équipé qui l'est. Il reste le **repli**, et ce n'est pas un reliquat — la
grande majorité du catalogue n'a pas encore ses douze états, et l'accueil doit
tenir debout pour ces joueurs-là.

### Les douze états d'un Fanzzy

`scripts/fanzzy-art.mjs` produit l'arborescence que le jeu sert :

```
public/img/fanzzy/TR1/
  manifeste.json
  e1/base/{neutre,salut,pousse,but,encaisse,attente,victoire,
           defaite,occasion,decision,progression,ennui}.{avif,webp,png}
  e1/base/portrait.{avif,webp,png}
  e1/hiver/…            un skin, états partiels
  e2/…  e3/…            un stade d'évolution, son propre cadrage
```

```bash
npm run art art/TR1/_src        # un lot  (= node scripts/fanzzy-art.mjs …)
npm run art:tout                # tous ceux qui ont bougé
npm run art:tout -- --force     # tous, quoi qu'il arrive
```

**Rien ne surveille `art/`, et rien ne doit le surveiller.** Déposer des images
dans `art/TR2/_src` ne produit rien : c'est une commande, pas un observateur.
Un observateur qui réencode cinq mégaoctets à chaque écriture pendant qu'on
copie quarante fichiers serait une nuisance, pas un service.

Ce qui manquait n'était donc pas la surveillance mais **une seule commande à
connaître** : `art:tout` fait le tour de tous les `art/<ID>/_src` et ne refait
que ceux dont un fichier source est plus récent que le `manifeste.json`
produit. Il n'a pas de logique à lui — il appelle `fanzzy-art.mjs` une fois par
dossier, parce qu'une seconde implémentation « juste pour boucler » serait la
plus coûteuse des secondes vérités de ce projet.

Son premier passage a d'ailleurs montré à quoi il sert : **TR1 avait un `e3`
sans `neutre`** dont la source attendait dans `_src` depuis un lot entier. Un
état manquant ne se signale jamais — le jeu retombe sur le stade d'en dessous,
et ça ressemble à un choix.

Les sources restent dans **`art/<ID>/_src/`, hors de `public/`** — et hors du
dépôt, `.gitignore` les écarte : douze rendus 2K par stade, cinq mégaoctets
pièce, cent trente-huit lignées. `verif-pages.mjs` refuse désormais tout
dossier `_src` sous `public/`, parce que ce dossier est servi tel quel et que la
faute a déjà été commise une fois avec une copie du télétexte.

Comme pour les poses du supporter, **tous les états d'un même stade partagent
un cadrage** : l'union de leurs boîtes, appliquée telle quelle. C'est ce qui
garde les pieds du personnage à la même hauteur quand il lève les bras.

**Le portrait ne se tire que de `neutre`.** Sur une pose bras levés, l'érosion
qui cherche le crâne trouve un poignet et cadre le buste sur la poitrine — un
stade sans `neutre` n'a donc pas de portrait du tout, et le jeu prend celui du
stade d'en dessous. Mieux vaut aucun portrait qu'un portrait de travers.

### La veille

```bash
npm run veille
```

Elle surveille `art/**/_src/` et relance la chaîne sur le dossier concerné dès
qu'un rendu y arrive. Elle ne découpe rien elle-même : elle appelle
`fanzzy-art.mjs`, qui reste la seule vérité sur la façon de produire une image.
Une veille qui redécouperait de son côté finirait par découper autrement, un
jour, sans qu'on s'en aperçoive.

Trois précautions, chacune contre une façon précise de se tromper :

- **elle attend que le fichier soit fini d'écrire.** Copier cinq mégaoctets n'est
  pas instantané, et le système signale le fichier dès sa création : le lire à cet
  instant donne un PNG tronqué. On attend que sa taille cesse de bouger ;
- **elle regroupe.** Douze états déposés d’un coup, ce sont douze signaux — donc
  onze passes pour rien. Un délai de grâce les rassemble ;
- **elle ne lance jamais deux passes en même temps** sur un dossier : elles
  écriraient les mêmes fichiers, et le manifeste garderait le résultat de celle
  qui finit la dernière, pas celle qui a lu les bonnes sources.

Une passe a lieu au démarrage : les rendus déposés pendant que la veille était
éteinte sont pris en compte sans qu'on ait à les retoucher.

**Rien n’est écrit tant que le lot entier n’est pas validé.** La chaîne lisait,
vérifiait et écrivait âge par âge : un e2 mal formé s’arrêtait *après* que e1
avait été réécrit, et le manifeste — produit à la fin — ne l’était pas. Le lot
refusé laissait des fichiers neufs décrits par un manifeste ancien. Invisible
tant qu’on lançait la chaîne à la main sur un dossier complet ; avec une veille,
le lot incomplet devient le cas normal.
### Le manifeste, et pourquoi il y en a deux

Chaque Fanzzy a son `manifeste.json` : c'est la bonne granularité pour
produire. C'est la mauvaise pour servir — la page du deck ferait cent
trente-huit requêtes pour s'ouvrir. `scripts/fanzzy-manifeste.mjs`
(`npm run manifeste`) les recolle en `public/img/fanzzy/index.json`, et
`fanzzy-art.mjs` l'appelle à la fin de chaque passage : un agrégat qu'il faut
penser à reconstruire est un agrégat faux.

`index.json` est **le seul fichier de `/img` servi avec un cache court**. Ses
voisins sont en `immutable, 365 jours` ; lui aussi, et une nouvelle lignée
dessinée n'atteindrait jamais quelqu'un qui a ouvert l'accueil une fois. Une
route explicite dans `server.js`, posée avant le static, lui donne une heure.

### Le repli, quand le dessin n'existe pas

Douze états × trois stades × cent trente-huit lignées font près de cinq mille
dessins : ils n'existeront jamais tous. `public/fanzzy-etats.js`
(`window.TBF_ETATS`) répond donc à « montre-moi TR1, stade 2, skin hiver, au
moment du but » par l'image la plus proche qui existe vraiment.

**L'ordre n'est pas arbitraire** : d'abord la bonne pose, quitte à changer de
skin ; ensuite seulement le repli sur `neutre` ; en dernier recours le stade
d'en dessous. Un skin partiel déclare son `repli` précisément pour dire
« emprunte le reste là-bas ». L'inverse — garder le costume et perdre la
réaction — laisserait le personnage impassible pendant que son club encaisse,
et c'est la réaction que le joueur regarde.

`scripts/etats-smoke.mjs` (`npm run etats:test`) éprouve cette logique sur un
manifeste fabriqué, sans base ni navigateur : le repli entre stades, entre
skins, les deux skins qui se renvoient l'un à l'autre — cas où l'absence de
garde fige l'onglet sans le moindre message —, et l'accord de forme entre ce
que `fanzzy-manifeste.mjs` écrit et ce que `fanzzy-etats.js` lit.

---

### Les trois autres chaînes : cartes, équipement, stades

Elles ne passent pas par `fanzzy-images.mjs`, et chacune a sa raison. Toutes
trois travaillent pareil : les rendus d'origine se déposent dans `art/<genre>/`,
nommés de l'identifiant de la carte, et le script en tire ce que le jeu sert.
Les invites sont **dans le script**, pas dans un carnet — une invite perdue est
un dessin qu'on ne sait plus refaire dans le même style.

```bash
npm run actions            # art/action/*.png  ->  public/img/action/
npm run actions:invites    # imprime les vingt et une invites
npm run stuff              # art/stuff/*.png   ->  public/img/stuff/
npm run stuff:invites      # imprime les sept invites
npm run stades             # art/stade/*.png   ->  public/img/stade/ + plans.json
```

**Les cartes d'action** sont des scènes : plein cadre, 480 × 640, AVIF / WebP /
**JPEG**. Pas de PNG — rien à détourer, et le même lot pèse treize fois moins
en JPEG.

**L'équipement** est détouré, 256 carré, AVIF / WebP / **PNG**. Le fond est
demandé plat et uniforme à la génération, et le script le découpe par
propagation depuis les bords. Deux détails s'y sont payés cher et sont
commentés dans le fichier : `resize()` est sans effet dans la même chaîne qu'un
`joinChannel()`, et un tampon brut à un canal ressort à trois sans
`toColourspace('b-w')`.

**Les stades** sont rangés *et mesurés*. Le script repère le terrain à sa
teinte et en déduit les bandes de tribune, qu'il écrit dans
`public/img/stade/plans.json` — c'est ce qui permet d'allumer les tribunes sans
placer cinq rectangles à la main. Le cadrage attendu est toujours le même :
**vue du dessus, terrain à la verticale, les deux grandes tribunes à gauche et
à droite, et les tribunes dans l'ombre.** Un stade dessiné autrement casse à la
fois le plan et l'effet lumineux.

`npm run pages` refuse la livraison si une carte des règles ou une pièce de
l'inventaire n'a pas ses trois formats. Le contrôle **importe** `ACTIONS` et
`STUFF` plutôt que de lire les identifiants au motif : une version antérieure
lisait le source à l'expression régulière et se contentait de vérifier moins de
pièces quand le motif ne collait plus — en restant verte.

---

## 10. Comment reprendre

Au début d'une nouvelle conversation :

1. Dépose l'archive du projet et ce fichier.
2. Dis sur quoi tu veux travailler.
3. Si un bug est en cours, donne le message exact et, si possible, ce
   qu'affiche `curl https://thebestfan.online/healthz`.

Ce qui n'est **pas** transmis d'une session à l'autre : aucun souvenir de la
conversation précédente. Tout ce qui compte doit être dans le code, dans les
commentaires, ou dans ce fichier. C'est pour ça qu'ils sont écrits comme ils
le sont.

**Un mot sur le travail en parallèle.** Lors de la dernière session, des
fichiers ont été écrits dans le répertoire de travail par une autre session
travaillant en même temps. Rien n'a été écrasé, mais deux agents qui écrivent
au même endroit finiront par se croiser sur le même fichier. Si tu fais
travailler plusieurs sessions en même temps, donne-leur des chantiers qui ne se
recouvrent pas, et dis-le-leur.
