# ÉTAT DU PROJET — à lire en premier

Ce fichier existe pour qu'une nouvelle conversation reprenne exactement où la
précédente s'est arrêtée. **Dépose l'archive complète du projet et ce fichier
au début de chaque nouvelle session**, et dis simplement sur quoi tu veux
travailler.

Dernière mise à jour : session « la plaque, et quatre productions ».

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

## Ouvrir un booster

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
| `/deck` | construction de deck : jusqu'à trois Fanzzy, équipement, dix cartes |
| `/kop` | le KOP : caisse commune, votes de dépense, bonus de virage |
| `/carnet` | souvenirs vécus et vignettes à récupérer |
| `/virage` | Grand Virage : tir à la corde pendant un vrai match, le fil du terrain, et **les cartes d'action de sa tribune** |
| `/amis` | amis : qui suit les mêmes clubs, demandes, invitations en KOP |
| `/duel-nvn` | **le duel** : tir à la corde, 1v1 à 5v5, adossé à un vrai match |
| `/matchs` | matchs du jour, en direct, avec fiche détaillée |
| `/teletext` | tous les championnats : classements, buteurs, cartons |
| `/classement` | supporters, tribunes, duellistes |
| `/profil` | identité, clubs, inventaire, langue, déconnexion |
| `/admin` | **catalogue Fanzzy**, séries ouvertes, joueurs, compétitions, journal |
| `/diagnostic`, `/healthz` | état du service |

**Trente suites**, toutes vertes. Côté serveur : schéma, authentification,
football, souvenirs, collection Fanzzy, deck, moteur NvN, réseau NvN, virage,
classements, inscription, administration, télétexte, stades, niveau, KOP, amis,
couleurs de club. Côté interface, dans un vrai navigateur : deck, classeur,
administration, accueil, duel, KOP, virage, amis, mes équipes, matchs. Et trois
sans base : états, images, câblage.

Deux contrôles gardent la livraison et se lancent avant tout : `npm run pages`
(les pages compilent, la barre est là, **et chaque carte d'action, chaque pièce
d'équipement a bien ses trois formats**) et `npm run cablage` (les modules sont
branchés entre eux).

### Le catalogue

**460 cartes, dont 428 publiées** — 152 personnages, chacun avec ses trois âges
sauf les quatorze légendaires, qui n'en ont qu'un par définition. Cela fait
**138 lignées**.

Les 32 non publiées sont d'anciennes cartes qui refont un personnage du lot de
2026 : elles restent lisibles pour qui les possède, elles ne se tirent plus.

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

## 4 bis. Ce que la dernière session a ajouté

Tout cela est commité — « Maj V0.30 », deux cent une entrées — mais **rien
n'est encore en ligne** : le déploiement ne part pas tout seul. Cette liste
existe pour qu'on sache quoi chercher, et où.

**Les amis.** `/amis`, `src/server/amis/index.js`, `sql/amis.sql`. Voir qui suit
les mêmes clubs, se demander en ami, s'inviter dans un KOP. Une seule ligne par
paire ; deux demandes croisées valent une acceptation ; sept jours d'attente
après un refus.

**Les couleurs des clubs, tirées des blasons.** `src/server/football/blason.js`
décode le PNG à la main — `zlib.inflateSync`, dé-filtrage Paeth compris — et
`couleurs.js` en tire deux teintes dominantes. **Ni le logo ni le nom ne sont
stockés**, seulement deux couleurs : c'est ce qui rend la chose tenable
juridiquement. Elles teintent le « GOAL ! » et les tribunes des stades.

**Le déploiement depuis GitHub.** `.github/workflows/deploiement.yml`,
`scripts/deployer.sh`, `scripts/appliquer-schema.mjs`. Déclenchement manuel,
`verif-pages` et `verif-cablage` en barrage, puis SSH, `git reset --hard`,
`npm ci`, **le schéma avant le redémarrage**, et une attente sur `/healthz`
jusqu'à ce qu'il annonce le commit poussé. C'est la réponse à la panne de onze
heures du 8 septembre 2026.

**Un emplacement de club se garde à un seul endroit.**
`src/server/onboarding/slots.js`. Le bug : on pouvait suivre six clubs avec
deux emplacements, parce que `onboarding.follow` et `store.follow` étaient deux
portes et qu'une seule avait un verrou. C'est le troisième cas de « une règle
écrite à deux endroits » de cette session, avec l'horloge du match et la fiche
d'un Fanzzy.

**L'horloge d'un match en direct.** `public/horloge.js`. Elle était écrite
**quatre fois**, avec trois listes de périodes différentes. Elle fait courir la
minute depuis l'instant du relevé, et refuse de parler dans trois cas : match
fini, période arrêtée, et plus de nouvelles depuis un quart d'heure.

**La fiche d'un Fanzzy, une seule fois.** `public/fanzzy-fiche.js` et `.css` :
le même rendu, monté en panneau par-dessus le classeur ou comme page.

**Les cartes d'action illustrées, et ce qu'on voit quand elles partent.**
`public/action-art.js` porte les sept familles — une seule table, le classeur
et le duel la partageaient mal — et la mise en scène d'une carte jouée : elle
arrive du bas si elle est à soi, du haut si elle est adverse, tient la pose avec
son dessin, puis se replie vers le nœud de la corde.

**Les sept pièces d'équipement, détourées.** `public/stuff-art.js`,
`scripts/stuff-images.mjs`. Elles s'affichent au deck, au kiosque, à la
bienvenue et au profil.

**Les cinq stades, et la lumière de leurs tribunes.** `src/shared/stades.js`,
`public/stade-art.js`, `scripts/stade-images.mjs`. Le catalogue et les effets
symétriques sont écrits ; le branchement de la collection reste à faire (§ 5,
point 6).

**Les cartes d'action dans le Grand Virage.** Quatorze des vingt et une.
`VirageRoom` a gagné une main, des recharges, des effets et des fenêtres
collectives ; `src/shared/duel/effets.js` porte la mécanique commune aux deux
moteurs. Voir § 3 pour la règle de portée, qui est le cœur de l'affaire.

**Sur les écrans**, en vrac : le personnage est plus grand sur l'accueil et ne
déborde plus de sa bande ; la barre du bas fait la largeur de la colonne ; un
Fanzzy qui n'était pas le bon n'apparaît plus une fraction de seconde au
rafraîchissement (`tbf.perso` en mémoire) ; les compétitions sont cliquables
depuis `/matchs` ; la fiche d'un match donne la date, l'heure, deux boutons
DUEL et VIRAGE, et **le Fanzzy qui regarde le match** en réagissant aux
événements ; le sélecteur de langue a quitté `/equipes`, où il n'avait rien à
faire.

---

## 4 ter. Dix gestes, douze chants, un répertoire qui tourne

Le duel n'était pas répétitif parce qu'il n'avait que trois gestes. Il l'était
parce qu'**un joueur n'en faisait jamais qu'un** : le sien, celui de son
Fanzzy, cent fois de suite. Le diagnostic compte plus que le remède, parce
qu'on aurait pu ajouter sept gestes et ne rien changer du tout.

### Les dix gestes — `src/server/ferveur/gestures.js`

Aux trois d'origine — tempo, martelage, endurance — s'en ajoutent sept :

| geste | ce qu'on demande |
|---|---|
| `contretemps` | taper **entre** les pulsations, pas dessus |
| `echo` | répéter un motif de quatre frappes que le serveur vient de donner |
| `crescendo` | dix frappes de plus en plus rapprochées, de 700 ms à 260 ms |
| `relance` | attendre près de deux secondes sans rien faire, puis tenir |
| `salves` | trois rafales de quatre, séparées par un silence exact |
| `tenue` | tenir le plus longtemps possible **sans dépasser** 4,2 s |
| `retenue` | exactement douze frappes en quatre secondes, ni onze ni treize |

Les deux derniers sont des gestes de **risque** : trop en faire y coûte plus
cher que pas assez. C'est ce qui les distingue vraiment des cinq autres, et
c'est pour cela qu'ils ne partagent pas leur barème.

**Les sept nouveaux n'ont pas leurs propres modificateurs.** `tempoWindow`
élargit toutes les fenêtres de rythme, `holdForgive` paie toutes les tenues :
un Fanzzy de la voix aide sur l'écho comme sur le tempo. Dix familles de
modificateurs pour dix gestes, et plus personne n'aurait su ce que porte son
personnage.

### Le déroulé est partagé — `public/geste.js`

Il vivait deux fois, dans `virage.html` et dans `nvn-ui.html`, et il n'y avait
que trois gestes. À dix, la duplication devenait indéfendable. `TBF_GESTE`
expose `jouer`, `LABEL`, `AIDE`, `COULEUR`, et **ne contient aucun nombre de
jeu** : toutes les durées viennent de `S.you.gestes`, que le serveur remplit
avec les modificateurs du porteur. Les identifiants du balisage (`pad`, `ring`,
`n`, `s`, `jauge`) sont volontairement ceux d'origine, pour que le CSS des deux
pages et les contrôles existants continuent de valoir.

### Le duel impose le geste, et il tourne

`prochainGeste()` dans `src/server/nvn/engine.js` : un chant sur deux est celui
du Fanzzy actif, l'autre est pris dans les neuf restants, à tour de rôle. **Le
geste annoncé par le client est ignoré** — il l'était déjà à moitié, ce qui
était pire que pas du tout.

Le motif de l'écho suit le même chemin (`j.motif`), et `noterContre` a dû
passer d'une notation « au plus proche » à une notation **dans l'ordre** : un
mauvais motif obtenait 0,8 parce que ses quatre frappes trouvaient toujours un
temps attendu à qui se raccrocher. Dans l'ordre, il obtient 0,4.

### Le Virage : douze chants, cinq offerts — `src/server/ferveur/virage.js`

La rangée des chants est un `flex` : douze cartes y feraient vingt-deux pixels
de large sur un iPhone SE. C'est **la contrainte d'écran qui a décidé du
mécanisme**, et c'est assumé — le répertoire n'offre que cinq chants à la fois,
et il glisse d'un cran toutes les dix minutes du **vrai match**.

- `ORDRE` est écrit à la main et ce n'est pas décoratif : cinq chants
  consécutifs doivent toujours mêler au moins quatre gestes, sinon dix minutes
  de match se joueraient entièrement au martelage. Un contrôle le vérifie, et
  une mutation qui groupe les gestes par famille le fait tomber.
- D'un répertoire au suivant, **un seul chant change**. Une tribune ne perd pas
  d'un coup tout ce qu'elle vient d'apprendre.
- Le changement est **annoncé** (`virage:repertoire`). La page ne reçoit
  `virage:state` qu'à l'entrée : sans ce message, un supporter garderait
  jusqu'au coup de sifflet final les cinq chants du moment où il est arrivé.
- Le message porte le **motif d'écho** mais pas la fenêtre. Le motif appartient
  à la tribune, qui le chante ensemble ; la fenêtre est personnelle — un
  Métronome ou une écharpe l'élargissent — et la page tient déjà la sienne.
- Un chant hors répertoire est refusé, **et pour cette raison-là**
  (`chant_hors_repertoire`). Un « carte inconnue » aurait envoyé chercher un
  bogue là où il n'y a qu'une horloge.
- La bascule tolère l'ancien répertoire **quinze secondes**, motif compris : un
  chant dure quatre secondes, et celui qui a commencé avant que l'horloge
  tourne le termine après. Le compter faux serait punir le supporter d'une
  minute qui n'est pas la sienne.

Les chants portent maintenant un `nom`. La page affichait `c.id`, et la tribune
lisait « onetaitla ».

### Trois cartes d'action de plus — 24 au total

- **Changement de chant** (`a-relais`, rare, 20 souffle, 35 s) — défausse la
  main, en reprend cinq. **Ce qu'on jette revient dans la pioche**, y compris la
  carte elle-même : sans cela, ce serait un moyen lent de vider son propre deck.
- **Nouveau souffle** (`a-souffleneuf`, légendaire, 38 souffle, 75 s) — toutes
  les recharges tombent d'un coup. Elle vaut plus cher au Virage, où les
  recharges durent une fois et demie celles du duel.
- **Tifo** (`a-tifo`, épique, 26 souffle, 40 s) — s'arme, **se voit** huit
  secondes, puis pousse de 95. Le seul effet du jeu que l'adversaire voit venir
  et peut contrer. Il passe par le chemin ordinaire, donc il est divisé par
  l'effectif comme tout le reste : un tifo n'échappe pas plus à la règle de la
  foule qu'un fumigène.

Les trois sont de portée `soi`, donc `dansLeVirage` les accepte — et le moteur
du Virage a dû apprendre à les résoudre, sinon elles y auraient été distribuées
pour lever `unknown_effect`. C'est la troisième fois que la règle de portée se
venge : voir § 3.

---

## 4 quater. Le fuseau, et pourquoi aucune suite ne le voyait

**C'est la panne la plus instructive du projet.** Elle a trois visages et une
seule cause, et elle a survécu à deux corrections parce que les suites
éprouvaient une application que personne ne déploie.

### La cause

`mysql2` est réglé sur `timezone: 'Z'` dans `src/server/auth/db.js`. Ce réglage
décide de **deux** conversions, dans les deux sens :

- une colonne DATETIME **lue** devient un objet `Date` interprété comme de
  l'UTC ;
- un objet `Date` **écrit** est sérialisé en UTC.

Or la base écrit aussi par elle-même, avec `NOW(3)`, qui rend l'heure de la
session MySQL — locale sur la plupart des serveurs. Sur la machine de
développement, l'écart vaut **deux heures**. D'où deux règles, et elles ne se
mélangent pas :

| la colonne est écrite par | on la relit ainsi |
|---|---|
| `NOW(3)` en SQL | `UNIX_TIMESTAMP(col) * 1000` — **jamais** en JavaScript |
| un objet `Date` depuis JS | on la compare à `UTC_TIMESTAMP(3)` — **jamais** à `NOW(3)` |

### Ce que ça cassait

- **La minute du vrai match restait figée.** `fixtures.polled_at` est écrit par
  `NOW(3)` et était relu en JavaScript : l'instant de lecture partait deux
  heures dans le futur, `Date.now() - vuA` devenait négatif, et l'horloge — qui
  refuse de compter à l'envers — restait clouée sur la minute du chargement.
  Dans le Virage, sur l'écran de choix, et sur `/equipes`.
- **La réinitialisation de mot de passe ne marchait pas du tout.**
  `auth_tokens.expires_at` est écrit depuis JavaScript, donc en UTC, et
  comparé à `NOW(3)`. Un jeton de réinitialisation vit **une heure** : il
  naissait déjà expiré. Le jeton de vérification, lui, vit quarante-huit
  heures — il marchait, en mourant deux heures trop tôt, ce qui faisait passer
  la panne pour un caprice plutôt que pour une règle.
- **Le délai après un refus d'ami annonçait huit jours au lieu de sept.**
  `amities.repondu_le` est écrit par `NOW(3)` et était relu en JavaScript.

### Pourquoi les suites ne le voyaient pas

**Elles ouvraient leur pool sans `timezone`.** Vingt-cinq suites écrivaient
donc en heure locale, les deux horloges tombaient d'accord, et tout était vert
sur un réglage que le serveur n'utilise jamais. Le réglage vit maintenant dans
`OPTIONS_BASE`, exporté par `scripts/base-de-test.mjs`, et toutes les suites
s'en servent.

Ce n'était pas suffisant : **le semis doit lui aussi ressembler à la
production.** `equipes-ui-smoke` semait `polled_at` avec `UTC_TIMESTAMP()`
alors que le relevé du direct l'écrit avec `NOW(3)`. Une suite qui sème
autrement que le serveur éprouve une donnée qui n'existe pas.

**La leçon, au-delà des dates :** un contrôle ne vaut que si son environnement
est celui de la production. Charset, fuseau, options du pilote, façon de semer
— tout ce qui diffère est un endroit où le vert ne veut rien dire.

---

## 4 quinquies. L'écran, dans cette session

**La flèche de retour.** En haut à gauche de toutes les pages sauf l'accueil.
Le menu était la seule navigation depuis la disparition de la barre du bas, et
rentrer demandait deux gestes — ouvrir le tiroir, viser la première ligne —
pour le mouvement le plus fréquent du jeu.

**Le dégagement des deux boutons flottants est écrit une fois**, dans `nav.js`,
sous `--tbf-haut-g` et `--tbf-haut-d`. Il valait `58px`, recopié dans le duel
et dans le Virage ; le blason du club de droite passait quand même à six pixels
du bouton de menu, ce qui, de loin, se lit comme un recouvrement.

**Le voile de l'écran de choix est opaque.** Il était à 96 %, et l'en-tête du
jeu — blasons vides, « 0 – 0 » d'avant l'entrée — transparaissait dessous.

**L'accueil nomme son Fanzzy.** Le nom n'existait que dans l'attribut `alt` de
l'image : le personnage tenait le centre de l'écran sans que rien ne dise qui
il est. Le nom et l'âge atteint voyagent dans le **même souvenir**
(`localStorage`) que le visage, et pour la même raison — sinon le nom arrivait
trois allers-retours après la tête. Les rails y gagnent le **KOP** et les
**AMIS**, qui n'étaient joignables que par le menu.

---

## 4 sexies. Le booster, rééquilibré

Un booster donnait **quatre supporters sur cinq** en moyenne : trois garantis,
plus une chance sur deux à chacune des deux dernières places. La collection
avançait, mais l'équipement, les tenues et les cartes d'action n'arrivaient
presque jamais, et deux ouvertures se ressemblaient.

Désormais : **un ou deux supporters, jamais plus**. La première place en est un
— c'est la garantie, personne ne doit tomber sur cinq objets et zéro
personnage. La deuxième en est un sept fois sur dix. Les trois dernières
n'en sont **jamais** : elles tirent dans `PLACES_OUVERTES` — carte d'action 30 %,
équipement 25 %, tenue 20 %, écharpes 25 %.

Les **écharpes** entrent au tirage, et ce n'est pas un lot de consolation :
c'est ce qui paie les évolutions, donc les âges qu'aucun booster ne donne.
C'est aussi le seul lot qui ne peut pas être vide, et il sert donc de recours
aux autres catégories — un joueur qui possède déjà toutes les tenues recevait
un supporter de plus.

**La dernière branche de `tirerAutreChose` est nommée.** Elle ne l'était pas :
toute catégorie sans branche à elle sortait en carte d'action, en silence. Une
mutation qui remettait « fanzzy » dans la table restait donc verte — le
supporter promis sortait en pyro. Un contrôle vérifie maintenant que les cinq
catégories déclarées tombent **vraiment**.

---

## 4 septies. Les douze chants illustrés

`scripts/chant-images.mjs` et `public/chant-art.js`, sur le modèle des cartes
d'action. Trois différences, chacune décidée par une contrainte :

- **Du paysage, et petit.** Une case de chant fait 72 pixels de large ; servir
  du 480×640 comme pour les cartes d'action ferait télécharger seize fois ce
  qu'on affiche. On sert 320×240.
- **Le haut du cadre doit être sombre.** Le nom, le coût et la poussée
  s'écrivent par-dessus le dessin ; l'invite le demande, et un voile en dégradé
  le garantit quand le modèle n'obéit pas.
- **Le dessin dit le geste, pas le chant.** Un supporter qui tape en rythme, un
  autre qui retient son souffle, une tribune qui répond à son capo : c'est ce
  que le joueur va devoir faire dans les quatre secondes qui suivent. Douze
  tribunes génériques ne l'auraient aidé en rien.

Les douze chants vivent maintenant dans `src/shared/duel/chants.js`, à côté des
cartes d'action : la chaîne d'illustrations et les contrôles en ont besoin, et
aucun des deux ne peut importer un moteur de salle pour lire une table.

---

## 4 octies. Cinq épreuves qui ne sont ni du rythme ni de la force

`src/server/ferveur/epreuves.js`, `public/geste.js`, `npm run epreuves:ui`.

Les dix gestes demandaient tous la même chose — frapper au bon moment, frapper
vite, tenir — et se notaient tous depuis une liste d'instants. Ces cinq-ci
demandent autre chose :

| épreuve | ce qu'on demande | ce qui est noté |
|---|---|---|
| **tifo** | suivre un trait du doigt (rond, écharpe, fanion, cœur) | précision × couverture × **ordre** |
| **les visages** | retenir huit visages, puis retrouver les paires | paires trouvées, moins les essais ratés |
| **mosaïque** | une grille s'allume une seconde, la refaire | cases justes moins fausses |
| **l'écharpe** | tourner le doigt, trois tours, dans le sens demandé | tours × rondeur |
| **le capo** | répéter une suite de six zones | le plus long début juste |

### Le contrat, en deux temps

La **consigne** est tirée d'une graine — la même que le motif de l'écho — donc
reproductible : la page dessine exactement la forme que le serveur notera. La
**réponse** a la forme que la famille demande : un tracé, une grille, une
suite. Les deux moteurs n'en savent rien : ils demandent une note, ils
reçoivent une note entre 0 et 1,2, comme pour les dix autres.

### Trois choses trouvées en éprouvant, et qu'aucune lecture n'aurait données

**Le gribouillis marquait 0,78.** Précision et couverture ne suffisent pas :
soixante points jetés au hasard sont à moitié sur le trait et approchent toute
la forme. C'est l'**ordre** qui sépare un tracé d'un gribouillis — un doigt qui
suit une forme avance le long d'elle, sans se téléporter. Le contrôle qui le
prouve prend le bon tracé et **mêle ses points** : même précision, même
couverture, seul l'ordre change, et la note doit tomber.

**Le tirage rendait toujours la même forme.** Un générateur de Lehmer rend une
valeur proportionnelle à sa graine au premier appel ; pour des graines de un à
quarante — c'est-à-dire toutes les nôtres — le premier tirage valait toujours
presque zéro. On ne s'en aperçoit qu'en essayant plusieurs graines : avec une
seule, tout a l'air parfaitement aléatoire.

**`setPointerCapture` emportait le tracé.** L'appel lève quand le pointeur
n'est plus actif, il était en tête du gestionnaire d'appui, et il emportait la
ligne suivante — celle qui pose le point de départ. Le geste mourait pour toute
sa durée, sans que rien ne le dise. La capture est un confort ; le tracé est le
geste. On prend donc le point d'abord, et la capture ensuite, sous garde.

### Le filet anti-robot refusait un joueur honnête sur vingt

La consigne part chez le joueur, donc la réponse aussi : la mosaïque et le capo
*montrent* ce qu'il faut refaire. La défense est la vraisemblance, comme pour
les dix gestes — mais le seuil était mal réglé.

Il exigeait un écart type d'au moins **14 ms** entre les coups. Sur six coups,
soit cinq écarts, l'hésitation naturelle d'un humain tombe sous ce seuil
**5,1 % du temps** — mesuré sur quarante mille tirages, pas supposé. Un joueur
sur vingt était traité en tricheur.

À **6 ms**, la machine reste attrapée cent fois sur cent, même bruitée de trois
millisecondes, et l'honnête ne passe plus qu'une fois sur cinq cents. Et la
régularité ne se juge plus sous quatre écarts, parce qu'une statistique sur
trois valeurs ne vaut rien.

**La leçon, au-delà du seuil :** un filet qui attrape le joueur qu'il devait
protéger finit par être désactivé, et alors il n'attrape plus personne. Un
seuil se mesure ; il ne se choisit pas au jugé.

---

## 4 nonies. L'écran d'ouverture

`public/ouverture.js`, le fond dans `public/img/ecran/`.

La tribune en fusion, cinq Fanzzy en éventail, et le nom du jeu. Le cadre est
**écrit dans la page** et non monté par un script : un écran d'ouverture qu'il
faut charger pour voir arrive après ce qu'il était censé couvrir.

Les visages viennent de `FZART.ILLUSTRES` — la seule liste qui sache quels
personnages sont dessinés. La recopier l'aurait fait mentir au premier dessin
ajouté.

**Il part à la première de trois conditions** : l'accueil dit qu'il est prêt
(`tbf:pret`), le temps est écoulé, ou l'on touche l'écran. La minuterie est
posée en premier, et ce n'est pas une précaution ajoutée après coup : si tout
le reste échoue — un script cassé plus haut, un réseau mort — c'est elle qui
empêche l'ouverture de devenir une porte close.

**Une fois par session, pas une fois par visite.** L'accueil est l'écran vers
lequel tout revient ; rejouer l'ouverture à chaque retour, c'est deux secondes
de tribune entre deux parties et un premier geste avalé à chaque fois, puisque
l'écran couvre le bouton qu'on visait.

---

## 4 decies. La boutique, et Stripe

`src/shared/boutique.js`, `src/server/boutique/index.js`, `sql/boutique.sql`,
`public/boutique.html`, `npm run boutique:smoke`.

### Les quatre règles, dans l'ordre d'importance

**1. Le prix ne vient jamais du client.** La commande ne porte qu'un
identifiant d'article ; le montant est lu dans le catalogue, côté serveur.

**2. La livraison se fait dans le webhook, pas au retour du joueur.** La page
de retour dit merci — elle n'est pas fiable. On ferme l'onglet, on perd le
réseau, on paie depuis un autre appareil. Livrer au retour, c'est ne pas livrer
à qui a fermé la page et livrer deux fois à qui a rechargé.

**3. Le rejeu ne doit rien changer.** Stripe renvoie le même événement jusqu'à
ce qu'on réponde 200, et parfois après. La commande se **réclame** par un
`UPDATE … WHERE etat <> 'livre'` dont on lit le nombre de lignes touchées : une
seule transaction peut en toucher une, les autres repartent sans rien remettre.
C'est plus solide qu'une lecture verrouillée — et surtout, c'est **éprouvable**.
Aucune course fabriquée ne faisait rougir le retrait de `FOR UPDATE` ; retirer
la condition d'état fait rougir trois contrôles.

**4. La signature a besoin du corps brut.** `express.json()` transforme les
octets que Stripe a signés et les jette ; il ne reste plus rien à vérifier, et
l'on accepte alors n'importe quel appel prétendant venir de Stripe — c'est-à-
dire qu'on offre des boosters à qui connaît l'adresse. Le webhook est monté
**avant** tout analyseur de corps. La comparaison est en temps constant.

### Ce qu'il reste à faire pour encaisser pour de vrai

```
STRIPE_SECRET_KEY=sk_test_…      (puis sk_live_… le jour venu)
STRIPE_WEBHOOK_SECRET=whsec_…
SITE_URL=https://thebestfan.online
```

Sans elles, la boutique s'affiche en **vitrine** : le catalogue se lit, les prix
s'affichent, et la commande est refusée avec un code qui le dit. Un écran qui
s'écroule parce qu'une variable manque est plus dur à diagnostiquer qu'un refus
nommé.

Le webhook à déclarer chez Stripe : `POST /api/boutique/webhook`, événements
`checkout.session.completed`, `checkout.session.async_payment_succeeded`,
`checkout.session.expired`.

### Deux décisions qui ne sont pas du code

**Un booster payé en argent réel est un objet réglementé.** La Belgique et les
Pays-Bas interdisent les coffres à contenu aléatoire achetés avec de l'argent ;
d'autres pays imposent l'affichage des probabilités de tirage. Le jeu est en
français, il suit des clubs suisses et français, et il est ouvert à des
mineurs. Trois choses au moins sont à trancher **avant** d'encaisser un euro :
afficher les taux de tirage (ils sont dans `RATES`), décider si l'on vend des
boosters là où ils sont interdits, et poser un garde-fou d'âge ou un plafond de
dépense. Ce n'est pas un détail d'implémentation, et ce n'est pas à ce dépôt de
le trancher.

**Ce qui est en vente ne décide pas d'un duel.** Les écharpes achètent des âges,
et un âge donne des modificateurs : la ligne entre « acheter du temps » et
« acheter une victoire » est mince. Elle tient à une seule chose — le geste
reste le geste. Un joueur équipé a une fenêtre plus large ; il n'a pas une note
qu'il n'a pas jouée. Le jour où un article vendra de la poussée directe, cette
ligne sera franchie.

---

## 4 undecies. Trois écrans au lieu d'un, et la carte en grand

Le kiosque à boosters, le classeur et le deck vivaient dans une seule page de
mille huit cent trente-six lignes. On y ouvrait un booster au milieu des
informations de collection, et l'écran ne disait pas ce qu'on regardait.

### Ce qui a bougé

| Avant | Après |
|---|---|
| `fanzzy.html` — kiosque + classeur + fiche, 1836 lignes | `fanzzy.html` (~800) : **MON FANZZY / CLASSEUR / DECK** |
| — | `boosters.html` : le kiosque, la déchirure, la révélation |
| `cardHTML` dans la page | `public/cartes.js` — partagé par les deux écrans |
| `.fz*` dans la page | `public/cartes.css` — la même peinture des deux côtés |

La connexion mène à **HOME**, et à `/boosters?aouvrir=1` s'il reste des
boosters : l'écran annonce alors « Tu as X boosters à ouvrir ». Un objet qui
attend et que rien ne signale est un objet oublié.

### L'âge se lit sur la carte

Chaque carte porte en haut à droite **ÉVO 1**, **ÉVO 2**, **ÉVO 3** ou
**LÉGENDAIRE**. Le bandeau du bas ne pouvait pas le porter : la requête de
conteneur `@container (max-width: 150px)` le masque sur les cartes de grille,
c'est-à-dire précisément là où on regarde sa collection. La pastille est donc
dans son propre coin, dimensionnée en pixels avec un plancher, et le contrôle
la mesure **après** l'ouverture de l'onglet — mesurée avant, elle faisait 0×0
et le contrôle passait sur un élément que personne ne voyait.

### La carte s'ouvre en grand — `panneauCarte`

Le panneau de carte existait : il ouvrait un tableau de trois lignes. Il ouvre
maintenant la carte elle-même — le dessin au format 63/80, la famille, la
rareté **en toutes lettres**, le texte entier, puis trois chiffres : souffle,
**recharge** et exemplaires déjà posés. La recharge n'était écrite nulle part
ailleurs, et une carte à quatre-vingt-dix secondes ne se joue pas comme une à
huit.

Les conditions sont rendues en français : `{ mene: 1 }` devient « Ton club doit
être mené au vrai match. » Les clés inconnues sont **nommées** plutôt que
tues — une carte qui refuse de se jouer sans dire pourquoi est une carte
cassée.

### Deux défauts que ce chantier a révélés

**Un second écouteur qui gagnait puis perdait.** J'avais lu que rien
n'écoutait `data-detail`, et j'ai posé un écouteur sur `#corps` pour ouvrir la
carte. Il s'enregistrait **avant** le délégué principal, qui existait depuis le
début : les deux ouvraient un panneau, le second écrasait le premier, et la
suite restait verte en éprouvant l'ancien. Un écran n'a qu'un panneau de carte.
Le contrôle « le panneau permet toujours d'ajouter la carte au deck » existe
pour ça.

**Un contrôle tiré à pile ou face.** Le désordre du tifo mélangeait le tracé
avec `Math.random()` et le comparait à une barre de 0,25. Il est tombé à 0,26.
Un contrôle qui échoue une fois sur deux ne dit rien : on le relance jusqu'au
vert, et le jour où le code casse pour de bon, on le relance aussi. La
permutation est maintenant **tirée avec une graine fixe**, huit fois, et c'est
la **pire** des huit qui est jugée — reproductible (0,20 à chaque lancement) et
plus sévère qu'un tirage unique. Retirer le facteur d'ordre la remonte à 1,20.

### Éprouvé

`deck:ui` a dix-sept contrôles de plus sur la carte en grand, et quinze
mutations les tuent **chacune sur son propre contrôle** : dessin retiré, cadre
passé au carré, glyphe retiré, souffle retiré, recharge retirée, texte tronqué,
rareté en clé, famille vidée, bouton d'ajout retiré, condition supprimée,
condition en mécanique brute, revers supprimé, encadré toujours affiché, carte
plus montée en grand. `boosters:ui` est une suite neuve (~300 contrôles
déplacés depuis `fanzzy:ui`), qui monte son propre serveur comme toutes les
autres.

---

## 4 duodecies. Une administration qui règle vraiment

### Ce que l'administrateur pouvait déjà faire

Sept onglets, et ils marchaient : **APERÇU** (chiffres d'exploitation, purge du
cache, envoi de contrôle), **FANZZY** (créer, modifier, dépublier une carte,
ouvrir et fermer les séries — sans déploiement), **TENUES** (les thèmes de
costume, même chose), **JOUEURS** (chercher, créditer écharpes et boosters,
vérifier une adresse, bloquer, promouvoir), **COMPÉTITIONS** (activer, changer
de rang), **JOURNAL** (qui a fait quoi, depuis quelle adresse), et **RÉGLAGES**.

### Le défaut : les réglages ne réglaient rien

Le septième onglet était deux champs de texte — une clé, une valeur JSON. Pour
s'en servir il fallait connaître de mémoire le nom de la clé, son type et
l'étendue de ce qu'elle accepte : c'est-à-dire avoir lu le code. Ce n'est pas
un écran d'administration, c'est une console de base de données avec une mise
en page.

**Et sur toutes les clés qu'on pouvait y taper, une seule était lue par le
jeu** — `series_actives`. L'écran proposait même en exemple une clé
`annonce` « qui affiche un bandeau pour tous les joueurs » : rien, nulle part,
ne la lisait. On pouvait l'écrire, la relire, la voir listée, et il ne se
passait rien.

Un réglage qui ne règle rien ne casse rien : il se contente de ne pas être là,
et on ne s'en aperçoit que le jour où l'on en a besoin.

### Le registre — `src/shared/reglages.js`

Vingt-six réglages déclarés, en six sections. Chacun porte son type, ses
bornes, son unité, son défaut et son aide. **L'écran se dessine à partir de ces
déclarations** et le serveur **valide contre elles** : ajouter un réglage, c'est
ajouter une ligne, et l'écran comme la validation suivent.

Les défauts sont la **seule source de vérité**. `PACK_REGEN_MS` se déduit de
`pack.regen_min`, et non l'inverse ; deux endroits qui portent la même valeur
finissent toujours par diverger, et ici le désaccord serait muet.

Le branchement tient en une technique : les constantes deviennent des **getters
d'objet**. `RULES.goalAt` s'écrit toujours pareil sur les quarante sites qui le
lisent, et interroge le registre à chaque lecture. Aucun appelant n'a changé.
Vérifié avant d'écrire : personne ne déstructure ces objets au chargement —
`const { goalAt } = RULES` figerait la valeur et le réglage redeviendrait
décoratif.

Ce qui n'est **délibérément pas** réglable : les prix en euros (ils vivent dans
le catalogue de la boutique) et les taux de tirage d'un booster payant, qui sont
une donnée réglementée dans plusieurs pays.

### Deux fonctionnalités qui n'existaient pas

**Le bandeau d'annonce** — celui que l'écran promettait. Monté par la barre
commune, donc présent sur chaque page sans qu'il faille y penser. Posé en
`textContent` : un champ d'administration reste une entrée, on ne monte pas du
HTML avec.

**La fermeture du jeu.** Le réglage le plus dangereux de l'écran : mal posé, il
enferme dehors celui qui vient de le poser. Trois garde-fous — le verrou ne
coûte rien quand il est levé (premier test en mémoire, le rôle n'est lu en base
que pendant une fermeture) ; l'authentification et l'administration restent
ouvertes, sans quoi il n'existerait plus aucun chemin pour rouvrir ; et le refus
se nomme, `503` avec un message, jamais une page blanche.

### Trois défauts trouvés en éprouvant, et qu'aucune lecture n'aurait donnés

**Le texte était analysé deux fois.** Le pilote analyse lui-même les colonnes
JSON : un nombre revient en nombre, un texte revient **déjà analysé**. Le type
seul ne distingue donc pas « du JSON à analyser » d'« une chaîne qu'on vient de
m'analyser ». Les réglages chiffrés passaient sans rien dire ; le premier
réglage textuel faisait tomber le chargement. L'ancien code d'administration
portait la même faute, latente, faute d'avoir jamais eu un réglage textuel.

**La raison du refus n'arrivait pas.** Le serveur refusait correctement, en
nommant la borne — « attendu entre 50 et 2000, reçu 5 » — et ne renvoyait que le
code. La raison finissait dans les journaux, c'est-à-dire nulle part pour la
personne devant l'écran.

**Le message de refus était effacé aussitôt écrit.** L'écran l'affichait, puis
redessinait la vue pour revenir à la valeur d'avant — ce qui remplaçait le
bandeau. Deux lignes correctes chacune, et ensemble elles ne montraient rien.

### Éprouvé

`npm run reglages:smoke` (40 contrôles) et 15 mutations, **chacune tuée sur son
propre contrôle** : cache non rechargé, seuil remis en dur, bornes ignorées,
refus anonyme, décimale acceptée, clé hors registre acceptée, texte non borné,
choix non vérifié, valeur illégale non rattrapée, retour au défaut qui écrit au
lieu d'effacer, écriture avant validation, route publique qui rend tout,
annonce sans sa bascule, texte analysé deux fois. `admin:ui` a treize contrôles
de plus sur l'écran.

---

## 4 terdecies. L'ascenseur, le personnage, la boutique

### L'ascenseur était celui du système

Un rail clair en plein milieu d'un écran sombre, sur toutes les pages sauf
trois qui l'avaient traité pour elles-mêmes. La règle est maintenant dans la
feuille commune et vaut pour **tout ce qui défile** — page, panneaux, tiroirs,
listes. Les deux syntaxes sont écrites, parce qu'aucune ne couvre l'autre :
`scrollbar-width`/`scrollbar-color` pour Firefox, `::-webkit-scrollbar` pour
WebKit. Le sélecteur est en `:where()`, qui ne pèse rien : les pages qui
avaient déjà masqué ou habillé leur barre gardent leur décision.

### Le personnage ne faisait que respirer

Une boucle unique de trois secondes six. L'œil l'apprend en dix secondes, et le
personnage redevient une image fixe avec un défaut de compression.

Il a maintenant **trois gestes de repos**, tirés au hasard, espacés au hasard
entre cinq et douze secondes : l'appui qui change de jambe, le regard qui
balaie, le coup d'épaule. Ce qui donne l'impression du vivant n'est pas
l'amplitude — elle reste sous le degré — c'est **l'irrégularité**. Un geste à
cadence fixe est un métronome, et c'est pire que l'immobilité.

Sur « Mon Fanzzy », **toucher le personnage le fait sauter**. Pas dans le
Virage : la même zone y sert à chanter, et un saut non demandé au milieu d'un
chant se lirait comme un défaut.

**La fluidité se gagne dans le sommeil, pas dans le poids.** Hors de l'écran ou
onglet caché, la scène s'endort : minuterie coupée, respiration en pause. Le
navigateur ralentit les minuteries d'un onglet masqué, il ne ralentit pas une
animation composée — elle continue donc de faire tourner le compositeur pour
personne. Tout se joue en `transform`, que le compositeur traite sans repasser
par la mise en page ni par le dessin, et rien de tout cela ne touche la grille
du classeur et ses cent cinquante-deux vignettes.

**Un défaut trouvé au passage :** `saute` et `change` animaient le **même
calque**, et comme la règle de `change` vient plus bas dans la feuille, c'est
elle qui gagnait. Toucher le personnage juste après un changement de pose ne
produisait rien — aucune erreur, aucune trace, le geste était simplement
absent. Le module porte pourtant la règle en toutes lettres : un calque par
geste. Elle avait été appliquée partout sauf là, et rien ne l'éprouvait.

### La boutique était introuvable

Servie sur `/boutique` depuis qu'elle a été écrite, et rangée dans le menu
accordéon au milieu de treize entrées : c'est-à-dire nulle part. Personne
n'ouvre un menu pour **découvrir** qu'une boutique existe.

Toucher sa monnaie est le geste que tout joueur essaie en premier. Les deux
jetons de la barre — écharpes et boosters — étaient des `div` inertes qui
affichaient un nombre ; ce sont maintenant des liens vers la boutique, avec un
`+` discret. **Deux barres à traiter** : l'accueil a la sienne, antérieure à
`nav.js` et jamais remplacée, avec son propre balisage. *(Le menu des deux a
depuis été fusionné dans `public/menu.js` — voir 4 tricies quater. Les barres
elles-mêmes restent distinctes, et c'est voulu : l'accueil est un écran de jeu
plein cadre, les autres pages ont un titre et une flèche de retour.)*

---

## 4 quaterdecies. Les billets, et la fin des coffres payants

### Ce qui était en vente, et pourquoi c'était un problème

Les quatre rayons de la boutique menaient **tous** à de l'aléatoire :

| En vente | Ce que c'était vraiment |
|---|---|
| Boosters, 1,99 € à 18,99 € | un coffre à contenu aléatoire |
| « Une tenue », 2,49 € | un **tirage** parmi les tenues qui manquent |
| « Une pièce d'équipement », 2,49 € | un **tirage** parmi les pièces qui manquent |
| Écharpes, 2,99 € à 17,99 € | une écharpe achète un booster à 45 — un coffre, avec une étape de plus |

Plusieurs pays traitent le coffre payant comme un jeu de hasard : la Belgique et
les Pays-Bas l'ont interdit, d'autres imposent l'affichage des probabilités. Le
jeu suit des clubs suisses et français, il est en français, et il est ouvert à
des mineurs.

### Le nouveau modèle

**L'argent réel achète des billets, et rien d'autre.** Les billets achètent des
objets **nommés** : cette pièce d'équipement-là, cette tenue-là sur ce Fanzzy-là
à cet âge-là. On voit ce qu'on prend avant de le prendre.

Les boosters restent : gratuits à la recharge, ou payés en écharpes gagnées en
poussant. **Les écharpes ne s'achètent plus du tout** — elles seules font
grandir un Fanzzy, donc la progression du jeu reste entièrement hors de portée
d'une carte bancaire.

Aucun chemin ne mène d'un euro à un tirage. Ce n'est pas une précaution de
façade, c'est une propriété du catalogue, et `verifierCatalogue()` la tient.

Le nom : **billets**. « Fanion » a été écarté — c'est déjà un motif de tifo, et
le joueur lirait « dessine un fanion » et « tu as 200 fanions » sur le même
écran. Le renommer coûte une ligne : `MONNAIE`, dans `src/shared/boutique.js`.

### Les fichiers

| Fichier | Rôle |
|---|---|
| `src/shared/boutique.js` | le catalogue payant, `LIVRAISONS_PAYANTES`, `verifierCatalogue()` |
| `src/shared/etal.js` | ce que les billets achètent, **déduit** de `STUFF` et de la table des tenues |
| `sql/billets.sql` | `user_wallet.billets`, en `INT` — un SMALLINT déborde à trois gros paquets |
| `remettreStuff` / `remettreTenue` | donner un objet **nommé**, à côté d'`offrir` qui tire au sort |
| `POST /api/boutique/depenser` | débit et remise dans une transaction |

Les prix **en billets** sont au registre (section « L'ÉTAL EN BILLETS ») : c'est
de l'équilibrage, ça se retouche en regardant ce que les joueurs prennent. Les
prix **en euros** restent hors de l'écran — un prix qu'on change d'un doigt est
un prix qui finira changé par erreur.

### La règle est gardée par des contrôles, pas par une intention

Elle se casse en **ajoutant**, pas en retirant : trois lignes au catalogue et la
chaîne est rouverte, sans qu'un fichier existant ait bougé. Les contrôles
regardent donc ce que le catalogue **ne contient pas**, et `LIVRAISONS_PAYANTES`
est le point de décision : si quelqu'un y ajoute `packs`, un contrôle nommé
rougit — et c'est là qu'il faudra reprendre la question des taux de tirage, des
territoires et du garde-fou d'âge. Elles sont écartées aujourd'hui parce que la
chaîne est coupée, pas parce qu'elles ont été résolues.

### Ce que les mutations ont appris

**Trois contrôles ne mordaient pas**, et tous pour la même raison : ils
regardaient un symptôme que la base produisait de toute façon.

- `verifierCatalogue()` ne lisait que le vrai catalogue, qui est correct : on
  pouvait lui retirer sa règle principale sans qu'un contrôle bouge. **Un
  validateur qu'on n'a jamais vu refuser quelque chose n'est pas un
  validateur.** Il prend maintenant un catalogue en argument, et la suite lui en
  donne un mauvais.
- « tenue sur un Fanzzy qu'on ne possède pas » passait parce que les clés
  étrangères refusaient l'écriture. Retirer **notre** garde ne changeait rien de
  visible. Le contrôle vérifie désormais le **code** du refus.
- Un objet hors catalogue était refusé deux fois — par le tarif puis par la
  remise. Le contrôle ne disait pas lequel des deux remparts tenait.

**Et une note du code était fausse.** J'avais écrit que l'ordre comptait — remettre
puis débiter. La mutation qui échange les deux blocs ne casse rien : c'est la
**transaction** qui protège, le `rollback` rendant les billets si la remise
échoue. L'ordre est gardé pour la lisibilité, mais la note dit maintenant ce qui
tient réellement.

---

## 4 quindecies. Le premier paquet se déchire enfin

Le geste d'ouverture du kiosque avait été refait ; **`bienvenue.html` avait
gardé l'ancien**, celui qui ne s'ouvrait pas. Il fallait maintenir le doigt
immobile pour « chauffer », puis tirer sans avoir lâché — et la chauffe se
comptait en **images**, pas en secondes : `charge += 0.02` à chaque
`requestAnimationFrame`. Entre le halo qui respire, le paquet qui tremble et le
dégradé plein écran, une machine lente rend une douzaine d'images par seconde :
quatre secondes d'immobilité parfaite au lieu des huit dixièmes prévus, le
moindre relâchement remettant tout à zéro.

C'est la première minute de jeu de quelqu'un qui vient de s'inscrire.

La page porte maintenant le geste du kiosque : on tire la bande en travers du
haut, l'avancée ne dépend que de la **distance parcourue**, lâcher trop tôt fait
revenir la bande élastiquement, et Entrée ouvre sans le geste.

**Un garde a été posé pour que ça ne se reproduise pas.** `npm run pages` refuse
désormais toute page où un geste avance au rythme des images. Il regarde la
cause et non l'apparence : le défaut est invisible sur la machine de celui qui
l'écrit. Éprouvé — réintroduire le motif fait rougir `pages` en nommant la page.

---

## 4 sexdecies. La boutique sur l'accueil

Cinquième tuile du rail de droite. `.centre` est en `overflow:hidden` : le rail
a donc reçu `max-height:100%` et ses tuiles `min-height:0`, sans quoi la
cinquième sort de l'écran sur un téléphone court et se fait couper en silence.

**Un piège qui a coûté vingt contrôles :** la requête de bourse lit désormais
`billets`, et les vingt-sept suites qui montent leur schéma à la main ne
créaient pas la colonne. Le symptôme n'a rien dit de sa cause — vingt contrôles
de l'accueil ont rougi sur « le Fanzzy équipé n'est pas nommé », parce que tout
l'état du joueur tombait avec la requête. `billets.sql` est maintenant monté par
les vingt-cinq suites concernées, et déclaré dans `schema-smoke` et
`DEPLOIEMENT.md`.

---

## 4 septendecies. Le contrôle de toutes les fonctionnalités

### Deux instruments neufs

**`npm run promesses`** croise ce que les pages appellent avec ce que le
serveur monte. Il ne lance rien, il lit — c'est ce qui lui permet de couvrir les
vingt pages d'un coup. Il existe pour une classe de panne qu'aucune suite ne
trouve : une page qui appelle une route absente reçoit un 404, son `catch`
l'avale, et l'écran s'affiche simplement sans la chose qu'il devait montrer.
C'est exactement ce qui était arrivé à la clé `annonce`.

Il dit aussi ce qu'on ne sert pas, et **la dette de couverture** — sans faire
rougir : un avertissement qui fait échouer devient un avertissement qu'on
désactive.

**`npm run tour:ui`** ouvre les vingt écrans et vérifie ce qui doit être vrai
partout. Onze pages avaient une suite ; **neuf n'en avaient aucune**, dont la
boutique et l'inscription — l'écran où l'on prend l'argent et celui qui accueille
les nouveaux. Écrire neuf suites complètes n'était pas tenable ; garantir un
plancher sur les vingt l'était.

Ses sept contrôles, par écran : aucune erreur de script ; la page affiche du
contenu ; aucun `undefined`, `NaN` ou code d'erreur sous les yeux du joueur ;
rien ne déborde à 360 px ; aucun libellé coupé ; rien ne touche le bord ; tout
ce qui se touche est visible ; les liens mènent quelque part.

### Ce que le tour a trouvé

| Écran | Défaut | Depuis |
|---|---|---|
| accueil | **le rail droit était hors de l'écran** — cinq destinations sur neuf amputées | longtemps |
| administration | en-tête et contenu **côte à côte**, 120 px hors cadre de chaque côté | l'adoption de `ui.css` |
| matchs | « **undefined MATCHS** » en grand quand la journée est vide | — |
| boosters | le carrousel poussait la page à **1013 px** de large sur un écran de 360 | — |
| boutique | titres et intertitres collés au bord | ce tour-ci |

**Le rail de l'accueil est le plus instructif.** `grid-template-columns: … 1fr …`
ne veut pas dire « prends ce qui reste » : `1fr` vaut `minmax(auto, 1fr)`, et ce
`auto` refuse de descendre sous la taille minimale du contenu. La scène portait
un personnage large, imposait sa largeur, et poussait les deux rails dehors.
Comme `.centre` est en `overflow:hidden`, **rien ne débordait** : ça rognait, en
silence. La correction tient en huit caractères — `minmax(0,1fr)` — et il a
fallu une capture d'écran pour la voir.

**L'administration était côte à côte** parce que `ui.css` pose
`body{display:flex}` pour centrer la colonne du jeu, et que l'administration n'a
pas cette colonne. Sur un écran large, invisible ; sur un téléphone,
inutilisable.

### Trois fois où le contrôle avait tort

Un audit qui crie au loup est pire qu'un audit absent : on apprend à lire ses
lignes rouges en diagonale.

- `promesses` ne lisait que les guillemets simples. `app.use("/api/boutique", …)`
  est en doubles, et quatre adresses parfaitement servies étaient rapportées
  comme absentes.
- Le tour mesurait la **boîte** au lieu de l'encre : `h1{padding:16px}` pose son
  texte à seize pixels et sa boîte à zéro, et trois pages correctes étaient
  signalées. Un `Range` mesure ce que l'œil voit.
- Le premier banc d'essai rendait vingt-sept rouges dont vingt-cinq venaient de
  lui : pas d'identité servie, donc pas de barre nulle part ; pas de socket.io,
  donc trois écrans en erreur ; un joueur jamais passé par l'accueil, donc des
  redirections parfaitement justes comptées comme des pannes.

---

## 4 octodecies. Une grammaire commune — `ui.css`

Les vingt écrans étaient corrects et se ressemblaient peu. Ce qui manquait
n'était pas de la couleur — il y en a — c'était **la répétition**. Un jeu se
reconnaît à ce que le même geste produise toujours le même effet.

| Règle | Ce qu'elle répare |
|---|---|
| `--gouttiere`, sur `#app` | plus aucun texte collé au bord ; les écrans pleine largeur la remettent à zéro |
| `--r-commune/rare/epique/legendaire` | les raretés étaient redéfinies quatre fois, avec une nuance de décalage |
| `.tbf-titre` | huit écrans écrivaient leur titre de huit façons ; barre d'accent dorée, lettrage du jeu |
| `.tbf-chiffre` | un solde, un score : ça se lit d'un coup d'œil ou ça ne sert à rien |
| `.pan` + filet clair | un panneau cesse d'être un trou dans l'image |
| `:active` sur tout ce qui se touche | un écran qui ne répond pas au doigt fait appuyer deux fois |

**Aucune animation permanente n'a été ajoutée.** Ce qui bouge sans arrêt cesse
d'être remarqué en dix secondes et coûte de la batterie pour ça — la leçon de la
respiration du personnage. Tout est statique au repos et ne s'anime qu'au
toucher, en `transform` seul, donc sans mise en page ni redessin.

### Deux pièges de flex et de grille, la même cause

`min-width:0` sur l'identité de la barre, `minmax(0,1fr)` sur la grille de
l'accueil : dans les deux cas, un enfant refusait de descendre sous la taille
minimale de son contenu et poussait ses voisins dehors. C'est le même piège sous
deux noms, et il vaut la peine de le reconnaître du premier coup d'œil.

---

## 4 novemdecies. La sécurité, et ce qu'elle peut réellement couvrir

### La règle qui gouverne tout le reste

**Sur le web, le code du joueur appartient au joueur.** Il peut le lire, le
modifier, le remplacer par un script. Minifier, obscurcir, désactiver le clic
droit ne ralentissent que les curieux de trois minutes. La question n'est jamais
« comment cacher le code » mais **« que se passe-t-il si le client ment »**.

Trois choses ne doivent donc jamais venir du client, et c'était déjà le cas
partout :

| Ce qui ne vient jamais du client | Où ça se décide |
|---|---|
| **Qui il est** | la session, jamais le corps de la requête |
| **Combien il a marqué** | `grade()` note les gestes bruts, côté serveur |
| **Combien coûte ce qu'il achète** | le catalogue et le registre, jamais la page |

### Ce qui était déjà solide

Mots de passe en scrypt ; jetons de session **hachés en base** — une base lue ne
donne pas de sessions utilisables ; cookie `httpOnly` + `sameSite` ; tentatives
de connexion comptées ; défense CSRF par vérification d'origine ; **tout le SQL
paramétré** ; les gestes notés côté serveur avec un filet anti-robot ; les
cadences des sockets bridées ; aucun secret versionné.

### Les trois manques trouvés

**1. Aucun en-tête de sécurité.** Sans `X-Frame-Options`, un site tiers affiche
thebestfan dans un cadre transparent par-dessus ses propres boutons : le joueur
croit cliquer chez eux et clique chez nous, connecté. Sept en-têtes sont posés
dans `src/server/garde/`, écrits à la main plutôt qu'avec `helmet` — sept
lignes, aucune dépendance de plus, et chacune lisible avec sa raison.

La politique de contenu assume ce qu'elle ne peut pas encore faire :
`'unsafe-inline'` sur les scripts est **nécessaire** tant que les vingt pages
portent leur script en ligne, ce qui est le parti pris du dépôt. L'écrire est
plus honnête que de laisser croire la politique stricte.

**2. Aucune limite de cadence sur les routes HTTP.** Les sockets étaient bridées
— un chant toutes les trois secondes — mais rien n'empêchait un script d'appeler
`/api` mille fois par seconde. Une fenêtre glissante, lectures et écritures
comptées séparément, `/healthz` et le webhook de Stripe exemptés.

**3. Une interpolation SQL**, dans `admin/index.js`. Elle est **sûre** —
`champs` ne contient que des littéraux écrits douze lignes plus haut — mais
« sûr parce que je viens de le relire » ne se transmet pas. Elle porte donc un
marqueur `sql-sur` avec sa justification, et l'audit la **compte** au lieu de
la taire : une exception qu'on voit peut être remise en cause, une exception
qu'on a fait taire est une exception qu'on a oubliée.

### Deux instruments permanents

`npm run securite` vérifie quinze invariants. Il ne cherche pas des failles —
aucun script ne fait ça — il vérifie que les **décisions déjà prises** tiennent
encore, parce qu'elles se défont sans bruit : un `requireAdmin` oublié sur une
route neuve, un identifiant lu dans le corps « juste pour ce cas-là ».

`npm run garde:smoke` éprouve les gardes eux-mêmes. Un limiteur rate de deux
façons opposées et **les deux sont silencieuses** : trop lâche il ne bloque
rien et l'on se croit protégé ; trop serré il bloque des joueurs, qui ne se
plaignent pas — ils s'en vont. Les deux bords sont donc éprouvés.

Et le tour des vingt écrans passe désormais **sous les en-têtes réels** : une
politique de contenu ne casse pas bruyamment, elle refuse une ressource et
écrit une ligne dans une console que personne ne lit.

### Ce qu'aucun script ne peut dire

Le mot de passe de la base vit dans le fichier d'environnement du serveur. Rien
ici ne peut dire s'il est fort, ni qui le connaît, ni si l'accès à la base est
ouvert depuis l'extérieur. Ce sont des questions d'hébergement, et elles se
règlent chez Infomaniak.

---

## 4 vicies. Le geste au doigt, et le rechargement

### L'appui long ouvrait le menu du navigateur

Maintenir pour chauffer, tirer pour déchirer, garder le doigt sur une carte :
tous ces gestes appartiennent au jeu, et le navigateur les confisquait pour
proposer « Enregistrer l'image ». `-webkit-touch-callout: none` n'existait
**nulle part** ; `user-select: none` vivait dans quatre pages sur vingt.

Les trois règles sont maintenant dans `ui.css`, donc partout — avec une
**exception qui compte plus que la règle** : tout ce qui se lit et se recopie
reste sélectionnable, y compris les champs de saisie. Une application où l'on ne
peut rien copier est une application dont on ne peut pas demander de l'aide.

**Ce n'est pas une protection du contenu**, et le commentaire le dit : l'image
est déjà dans le navigateur, un onglet suffit à la récupérer. C'est une
correction de confort.

### Le rechargement

Deux choses différentes, une seule ressemblait à un défaut.

`overscroll-behavior` était posé sur `body` — or le tirer-pour-recharger est
décidé par l'élément **racine**. Pendant une partie, un geste de chant qui
commence trop haut devenait un rechargement. La règle est maintenant sur
`html`.

Le rechargement volontaire, lui, ne casse rien : le Virage se rejoint à la
reconnexion, le duel reprend par `nvn:resume`. On ne cherche donc pas à
l'empêcher — **on ne peut pas, et il ne faudrait pas** : le navigateur garde
toujours son bouton, et une page dont on ne peut pas sortir est un piège. La
barre prévient seulement quand une partie tourne.

Ce garde a d'ailleurs été écrit deux fois : la première version lisait une
classe que **personne ne posait**. C'est le troisième mécanisme complet,
correct, et branché sur rien qu'on trouve dans ce dépôt — la famille de la clé
`annonce`.

---

## 4 vicies bis. La barre, les trois écrans, et la carte

### Le kiosque était devenu introuvable

Quand la page des Fanzzy est passée à trois onglets — Mon Fanzzy, Classeur,
Deck — l'onglet KIOSQUE a disparu, et avec lui **le seul chemin visible vers
l'ouverture des boosters**. Il restait le menu accordéon, au milieu de treize
entrées : c'est-à-dire nulle part. Exactement ce qui était arrivé à la boutique,
pour la même raison, deux sessions plus tôt.

Il a maintenant sa tuile sur l'accueil, au rail de gauche, avec la pastille du
nombre qui attend — un sachet non ouvert ne se rappelle à personne.

### La barre du haut

Elle portait cinq choses : la flèche, l'avatar avec le pseudo et le club, deux
jetons de monnaie, le menu. Sur 360 px, elles se disputaient la place — pseudo
tronqué, club réduit à « Lausanne … » — et **aucune ne disait où l'on est**.

Elle porte maintenant : une flèche, le **nom de l'écran**, le menu.

Le pseudo et le club vivent sur le profil, qui est fait pour eux. Les soldes
s'affichent là où ils décident de quelque chose : la boutique, le kiosque, le
carnet. **Le menu est resté** — il n'était pas nommé dans la demande, et le
retirer aurait une conséquence qui dépasse l'apparence : il n'est monté que par
cette barre, donc il disparaîtrait de dix-sept écrans et l'accueil deviendrait
le seul chemin vers quoi que ce soit. C'est peut-être ce qu'il faut faire, mais
c'est une décision de navigation, et elle tient en une ligne le jour venu.

**Deux restes sont partis avec les jetons** : un appel à `/api/me/state` à
chaque chargement de page, uniquement pour remplir des éléments qui n'existaient
plus, et `TBF_BARRE.bourse()` avec ses deux appelants. Les deux étaient protégés
par des `if` : rien ne cassait, et c'est ce qui rend ce genre de reste
dangereux — il ne se signale pas.

### Les trois écrans avaient trois ossatures

| | Fanzzy (avant) | Deck (avant) |
|---|---|---|
| en haut | « FANZZY / collection » | les onglets |
| puis | les onglets | « MON DECK », barre dorée |
| puis | « LE CLASSEUR », autre style | le contenu |

Passer de l'un à l'autre donnait l'impression de changer d'application — ce
qu'on cherchait précisément à éviter en leur donnant la même barre d'onglets.

**L'ordre est désormais le même partout** : onglets, titre d'écran à barre
dorée, contenu. Et « FANZZY / collection » disparaît : la barre du haut le dit
déjà. « Mon Fanzzy » a gagné un titre au passage — sans lui, l'écran commençait
par une carte, et l'on ne savait pas si l'onglet avait répondu.

### La carte en grand ne tenait pas dans l'écran

Le dessin occupait `aspect-ratio: 63/80` pleine largeur, soit près de six cents
pixels de haut. Avec le texte, les chiffres et le bouton, il fallait faire
défiler — **sur l'écran même où l'on vient décider**, et le bouton d'ajout était
en bas.

Le panneau est maintenant une colonne : en-tête fixe, corps qui se réduit. Le
dessin garde la proportion d'une carte mais **plafonnée** en `dvh` : grand quand
il y a la place, replié quand il n'y en a pas. Mesuré : 638 px de panneau sur
780 d'écran, sans défilement, avec 359 px de dessin.

### Un contrôle qui empêchait de réparer

`deck:ui` affirmait « le dessin occupe un cadre au format d'une carte » —
c'est-à-dire `aspect-ratio: 63/80`, **un détail de mise en page et non
l'exigence**. Il rougissait quand on corrigeait le défaut, ce qui est la
meilleure façon d'apprendre à contourner un contrôle.

Il est remplacé par deux, chacun là où il peut se mesurer : sous jsdom, ce que
la feuille **déclare** (une colonne, un plafond en `dvh`, une image en
`contain`) ; dans le tour, en vrai navigateur, ce qui compte — le panneau tient,
il ne défile pas, le bouton reste sous les yeux, et le dessin reste regardable.

**jsdom ne met rien en page.** Une suite qui y tourne ne peut jamais dire si
quelque chose dépasse : elle ne peut parler que d'intentions. C'est pourquoi le
tour existe.

---

## 4 vicies ter. Le kiosque : dix paquets, et rien qu’on ne puisse ouvrir

### Comment les boosters se débloquent

Les neuf séries s’ouvrent au niveau, et **le niveau ouvre, il ne donne pas** —
c’est la règle qui tient tout le jeu. Un joueur de niveau 30 n’a aucun avantage
sur la corde ; il a seulement accès à plus de choses à collectionner.

| Série | Niveau |
|---|---|
| LA TRIBUNE | 1 |
| LES MÉTIERS DU STADE | 3 |
| LE BESTIAIRE DES GRADINS | 6 |
| VIRAGE NORD | 9 |
| NUITS EUROPÉENNES | 12 |
| CE QUI TRAÎNE AU STADE | 15 |
| LES REVENANTS | 18 |
| LES ÉPOQUES | 22 |
| LE VIRAGE IMPOSSIBLE | 26 |

### Ce qui n’allait pas

Le carrousel présentait **les neuf**, dont huit hors de portée pour qui
commence. Pire, la série affichée au premier chargement pouvait elle-même être
verrouillée : bouton gris, « NIVEAU 9 REQUIS », et rien qui dise qu’il suffisait
de glisser. On arrivait au kiosque devant une porte fermée.

### Ce que ça devient

Le carrousel ne porte plus que des paquets **ouvrables**, et il en porte **dix** :
on choisit le sien.

**Le paquet choisi ne change rien au tirage.** Les cartes sont tirées par le
serveur à l’ouverture, et le numéro du paquet ne lui est même pas envoyé. Ce
n’est pas un détail : le jour où ce choix influencerait le contenu, les joueurs
s’en apercevraient en quelques heures, un « paquet qui donne les légendaires »
circulerait, et il faudrait honorer une superstition qu’on aurait fabriquée
soi-même. Le geste est là pour le geste — ouvrir un booster est une cérémonie,
et une cérémonie sans choix n’en est pas une.

La série se choisit sur une rangée de pastilles au-dessus, qui ne liste que
l’ouvert et **disparaît quand il n’y en a qu’une** : un sélecteur à un seul
choix n’est pas un choix. Et ce qui vient se dit en une ligne discrète — « À
venir : LES MÉTIERS DU STADE, au niveau 3 » — à côté du choix au lieu d’être
dedans. Un jeu montre ce qui l’attend ; il ne le met pas sur le chemin.

### Les neuf séries ont enfin leur paquet

`ART` n’en déclarait que **deux** sur neuf. Les sept autres tombaient sur le
repli dessiné — correct, mais c’est un repli. **`LA TRIBUNE` en faisait
partie**, c’est-à-dire le premier paquet que voit tout nouveau joueur.

Sept visuels produits sur Artlist, dans le style des deux existants : sachet
scellé, deux projecteurs croisés, fond noir, bande de couleur de la série. Aux
trois formats du dépôt (avif, webp, jpg) et à la définition des deux premiers —
deux définitions dans un même carrousel se voient.

### Deux défauts trouvés en chemin

**Le révélateur s’affichait en permanence.** Quand le kiosque a quitté la page
des Fanzzy, son balisage est parti — **et sa feuille est restée**. Or la
première règle de `#opener` est `display:none` : sans elle, le panneau de
révélation était rendu nu, sous le kiosque. C’est le « 1 / 5 — Fermer » qui
traînait en bas de l’écran. **Troisième fois** que cette faute se produit dans
ce dépôt : du balisage qu’on déplace, une feuille qu’on oublie.

**`hidden` ne cachait pas.** La rangée des séries s’affichait alors que le code
la cachait : le navigateur implémente `hidden` par `display:none`, mais toute
règle `display` d’une feuille le bat. `.series{display:flex}` suffisait à le
rendre décoratif. Cent trente-trois éléments portent `hidden` ici ; la règle est
donc posée une fois pour tous dans `ui.css`, et c’est l’un des rares endroits
où `!important` se justifie.

### Un contrôle réécrit plutôt qu’effacé

Quatre contrôles éprouvaient une série verrouillée **présentée dans le
carrousel**. Le kiosque n’en présente plus. L’idée qu’ils défendaient reste
entière — « un jeu ne cache pas ce qui vient » — et c’est elle qu’on reprend,
sur sa nouvelle forme : ce qui vient est annoncé à côté du choix. Le filet de
sécurité ne bouge pas : un onglet resté ouvert peut encore demander une série
verrouillée, et le serveur la refuse en nommant sa cause.

---

## 4 vicies quater. Le butin, et quatre appels morts

### Le récapitulatif était traité comme un pied de page

Cinq vignettes de soixante pixels, collées au bas d'un écran aux trois quarts
vide : la scène de révélation restait là, vidée de ses cartes, et gardait six
cents pixels de noir au-dessus. C'est le dernier moment de la cérémonie — celui
qu'on regarde en se demandant ce qu'on a eu.

Il prend maintenant la place : cinq cartes à 116 px, trois en haut, deux
centrées en dessous, qui arrivent **en cascade**. La scène vidée se replie.

**Et il dit ce qui est nouveau** — « 4 NOUVELLES SUR 5 » — l'information que le
joueur cherche en premier et qui n'était écrite nulle part : cinq cartes
rangées, sans savoir lesquelles on avait déjà.

### Les effets, et leur limite

Ils ne durent que l'arrivée. Une fois les cinq cartes posées, **l'écran est
immobile** — c'est la règle du dépôt, héritée du personnage qui respirait pour
rien derrière un onglet caché. Ce qui bouge passe par `transform` et `opacity`,
donc par le compositeur seul.

La lueur ne va qu'aux cartes qui la méritent : une légendaire qui brille au
milieu de quatre communes se voit, cinq cartes qui brillent ensemble ne disent
plus rien.

### Quatre appels morts, et ce qu'ils cassaient

`renderDex()` et `renderTeam()` — les rendus du classeur et de la tribune —
étaient appelés **quatre fois** dans la page des boosters. Ils n'y existent pas :
ils vivaient dans la page des Fanzzy, d'où le kiosque a déménagé.

| Appel | Ce que ça cassait |
|---|---|
| dans le clic du butin | **toucher une carte ne faisait rien** : l'exception tombait avant `ouvrirFiche` |
| en fin de `finishPack` | `tickRegen()` n'était jamais atteint — compte de boosters et compte à rebours figés |
| « Fermer », « Terminer » | levaient après avoir fermé : sans conséquence visible |

Quatre exceptions par ouverture de booster, dans une console que personne ne
lit. C'est le prix des extractions : le code part, **les appels restent**, et
rien ne lève au chargement puisqu'une fonction absente ne se remarque qu'au
moment où on l'appelle. C'est la quatrième fois dans ce dépôt.

Le remplaçant est `renderKiosque()` : il redessine le compte de boosters,
l'état du bouton et le compte à rebours — exactement le travail que les deux
autres faisaient sur leur écran.

### Deux fautes de ma part, vues sur capture

**Mes marges négatives éjectaient deux cartes.** Pour centrer la seconde rangée
j'avais décalé les quatrième et cinquième à la main : elles sortaient du cadre,
et une pastille « NOUVEAU » flottait seule sous la grille, orpheline. La grille
à **six colonnes** fait le travail sans bricolage — c'est la façon classique de
centrer une rangée incomplète.

**« TOUT NOUVELLES DANS LE CLASSEUR »** — un « TOUT » invariable collé devant un
accord au féminin pluriel. Quatre cas, quatre phrases.

### Pourquoi des cartes paraissent vides

Elles ne sont pas cassées : **elles ne sont pas encore dessinées**. Le rendu
procédural — silhouette, projecteurs, gradins — est le repli assumé, et il vaut
mieux qu'un trou.

**198 des 460 cartes sont illustrées**, soit 43 %, et la couverture est
uniforme : 43 % pour `LA TRIBUNE`, 42 % pour `LES MÉTIERS DU STADE`, 34 % pour
`LE BESTIAIRE`. Un joueur qui ouvre un booster voit donc en moyenne deux ou
trois cartes dessinées sur cinq.

262 illustrations restent à produire. C'est une production, pas une correction.

---

## 4 vicies quinquies. Le loading, les mini-jeux, et le duel qui finissait nul

### Dix secondes d'attente, et le bonjour qui se jouait derrière le rideau

L'écran d'ouverture durait le temps d'un chargement. Il dure maintenant dix
secondes pleines — `DUREE = 10_000` dans `public/ouverture.js` — avec une jauge
déterminée qui avance à la frame, et un seul chemin de sortie : `setTimeout`.
Il n'y en avait pas qu'un ; la page pouvait partir plus tôt.

En allongeant le rideau, un défaut plus ancien est devenu visible. L'accueil
saluait le joueur — animation, nom du Fanzzy, jauge d'évolution — **pendant que
l'écran d'ouverture le couvrait encore**. À deux secondes cela ne se voyait pas.
À dix, le joueur arrivait sur une page déjà finie de s'animer.

L'ouverture émet donc `tbf:ouverture-finie` au moment où elle se retire, et
`index.html` attend cet événement pour saluer :

    if (document.getElementById('ouverture')) {
      addEventListener('tbf:ouverture-finie', saluer, { once: true });
    } else { saluer(); }

Le `else` compte autant que le `if` : sans lui, toute page servie sans écran
d'ouverture — une session déjà ouverte, un test — n'aurait plus jamais salué.

Trois contrôles de l'accueil sont tombés au rouge sur les dix secondes. Ils
attendaient des durées écrites en dur. Ils dérivent maintenant leurs attentes de
`DUREE` : changer la durée du rideau ne peut plus les casser.

### Cinq mini-jeux n'arrivaient jamais au Virage

Le jeu compte quinze gestes. Le Virage n'en proposait que dix : son répertoire
comptait douze chants, et les cinq gestes `tifo`, `mosaique`, `memoire`,
`echarpe` et `capo` n'étaient portés par aucun d'eux. Les mini-jeux existaient,
étaient testés, et restaient hors d'atteinte — d'où l'impression qu'il n'y avait
« que les jeux liés au tempo ».

Cinq chants ont été écrits pour les porter, dans `src/shared/duel/chants.js` :

| chant | geste | coût | puissance |
|---|---|---|---|
| La bâche | tifo | 30 | 54 |
| Le damier | mosaique | 28 | 50 |
| Au point | memoire | 26 | 47 |
| Le moulinet | echarpe | 25 | 42 |
| L'appel du capo | capo | 29 | 49 |

`ORDRE` les intercale au lieu de les ajouter à la queue : un joueur qui débloque
le répertoire dans l'ordre rencontre un geste neuf régulièrement, et non cinq
d'un coup à la fin.

`virage-smoke.mjs` vérifie désormais que **les quinze gestes passent tous au
Virage**. La liste attendue y est écrite à la main, dix-sept chants et quinze
gestes : la dériver du module rendrait le contrôle d'accord avec lui-même quoi
qu'il arrive.

Les cinq illustrations ont été produites et rangées en trois formats par
`node scripts/chant-images.mjs` — dix-sept chants dessinés, et `npm run pages`
le dit.

### Le duel finissait toujours par un nul

Contre un bot, un duel de cinq minutes ne produisait aucun but. Ce n'était pas
une impression : un chant de tempo demande quatre secondes et demie et valait
27 points, la corde retombait de 2,5 par seconde, et le but était à 300. Un
joueur appliqué poussait donc moins vite que la corde ne retombait.

Les réglages ont bougé, et ils vivent tous dans le registre — donc dans l'écran
d'administration :

| réglage | avant | après |
|---|---|---|
| `duel.but_a` | 300 | 200 |
| `duel.chant_puissance` | 30 | 44 |
| `duel.decroissance` | 2,5 (en dur) | 1,2 |
| `virage.but_a` | 400 | 260 |
| `virage.decroissance` | 3 | 1,4 |

`duel.decroissance` n'existait pas : la valeur était une constante de module.
Elle est devenue un accesseur — `get decayPerSec() { return reglage(...) }` —
ce qui la rend vivante sans toucher un seul appelant. J'ai vérifié d'abord que
personne ne la déstructurait au chargement, faute de quoi la valeur aurait été
figée à la première lecture.

Le bot a été affaibli : il chante toutes les six à onze secondes au lieu de deux
et demie à cinq et demie, avec une adresse de 0,30 à 0,55.

**Le contrôle qui manquait.** Vingt-six contrôles éprouvaient le duel — le
souffle se débite, un geste raté ne pousse pas, un bouclier absorbe — et aucun
ne vérifiait qu'**une partie produise un but**. Tous étaient verts pendant que
le jeu ne se jouait plus.

Ma première version de ce contrôle jouait en solo, et elle ne mordait pas :
même avec l'ancien équilibrage, un joueur que personne ne contre finit par
marquer. Le défaut n'existe qu'**avec quelqu'un en face**. Réécrit à deux, il
donne 3 buts avec le nouvel équilibrage et **0 avec l'ancien**.

### La légendaire qui ne tombait jamais

Trouvé en repassant la batterie, et non dans ce qui était demandé.

`scripts/economie.mjs` a refusé de tourner : son garde-fou a vu que les
constantes du serveur avaient bougé sous lui, et il a préféré s'arrêter plutôt
que publier des chiffres périmés. C'est exactement ce pour quoi il avait été
écrit.

En le remettant au niveau, la règle réelle des places dit ceci :

- `drawPack` tirait cinq cartes : les trois premières communes, **les deux
  dernières avec un tirage de rareté** — et `RATES` le documente encore, « les
  deux dernières places sont les seules qui peuvent tomber sur une légendaire ».
- `openPack` a ensuite fait des **trois dernières places** des places ouvertes,
  qui rendent un objet, une tenue, une carte d'action ou des écharpes, et jamais
  un supporter. `tirerAutreChose` ne peut pas échouer : chaque catégorie sans
  stock retombe sur les écharpes.

Les deux règles sont justes chacune de son côté. Ensemble, elles font que le
tirage de rareté roule sur des cartes **systématiquement jetées** : les deux
seules places que le joueur reçoive visaient la commune. **Aucune légendaire ne
pouvait sortir d'un booster**, et les quatorze légendaires publiées au stade 1
étaient hors d'atteinte — le paquet de bienvenue mis à part.

Rien ne pouvait le voir : les deux fonctions vivent à cent lignes d'écart, et
chacune était cohérente. Le simulateur le voit parce qu'il a appris à **mesurer
ce qu'un booster rend** au lieu de le supposer — cent mille paquets ouverts à
blanc, et la liste des raretés qui en sortent. Une rareté absente arrête le
script avant les deux mille collections simulées, au lieu de tourner jusqu'au
plafond pour diviser par zéro.

Le tirage de rareté va désormais aux deux places que le joueur reçoit
(`PLACES_QUI_ROULENT = 2` dans `drawPack`). La cadence attendue passe de 0,20
légendaire par booster — l'intention écrite, jamais atteinte — à 0,155, la
deuxième place ne rendant un supporter que sept fois sur dix. Les taux eux-mêmes
n'ont pas été touchés.

Deux mutations pour éprouver le nouveau contrôle : `PLACES_QUI_ROULENT = 0`, et
une table `RATES` où la légendaire vaut zéro — celle-ci ne passe par aucun
motif de texte. Les deux mordent.

Le simulateur perd son option `--plancher` : elle explorait un plancher de
communes que le serveur n'a plus.

### Ce qui reste en écart entre le Virage et le duel

Les deux modes partagent maintenant le même répertoire, les mêmes quinze gestes
et le même barème. Il reste **une** différence, et elle est de fond :

- **En duel**, le geste est *imposé* : une rotation le choisit, et le joueur
  l'exécute.
- **Au Virage**, le joueur *choisit une carte de chant*, et le geste découle de
  la carte.

Ce n'est pas un oubli de câblage : ce sont deux boucles de jeu différentes, l'une
d'adresse pure, l'autre de main et de gestion. Les aligner est un choix de
conception, pas une correction — et il n'a pas été fait ici. Les deux voies
possibles :

1. **Le Virage prend la rotation du duel.** Les cartes de chant disparaissent,
   le deck ne sert plus au Virage. Simple pour le joueur, mais le deck perd la
   moitié de son objet.
2. **Le duel prend la main du Virage.** On y joue ses cartes de chant au lieu de
   subir la rotation. Le deck sert partout, la progression a un sens dans les
   deux modes — mais le duel devient plus lent à comprendre.

La deuxième va dans le sens du reste du jeu. Elle demande une session à elle
seule.

---

## 4 vicies sexies. La plaque, et quatre productions

### L'interface avait raison et n'avait pas de matière

Tout était juste et tout était plat : un rectangle à filet d'un pixel posé sur
une photo, la même chose pour un bouton, un panneau, un onglet et une carte.
Rien n'avait de **matière**, donc rien n'avait de poids — on ne distinguait pas
d'un coup d'œil ce qui se touche de ce qui s'affiche.

`ui.css` porte maintenant **la plaque**, le vocabulaire d'objet de tout ce qui
se touche. Quatre traits la fabriquent, et ce sont ceux de Brawl Stars ou de
Clash Royale :

1. **le cerne** — deux pixels presque noirs tout autour. C'est ce qui fait
   « jeu » plus que tout le reste : un objet détouré se *pose* sur l'image au
   lieu d'y être découpé ;
2. **la tranche** — cinq pixels plus sombres dessous, donc une épaisseur ;
3. **la lumière** — un filet clair au bord supérieur, dedans ;
4. **l'ombre portée** — l'objet décolle du fond.

Ce qui appartient à ce jeu-ci et non aux autres :

— **le lettrage de banderole** : `--banner` en capitales espacées, avec une
  ombre dure, pour que le texte soit peint *sur* la plaque ;
— **l'écharpe** : des rayures obliques à deux couleurs, le seul motif du jeu.
  Elle a remplacé la barre d'accent dorée des titres — une règle, et les vingt
  écrans la portent ;
— **le coin coupé** : le bas-droit presque carré quand les trois autres sont
  ronds. Une plaque vissée, pas un galet ;
— **la couleur par destination** : `data-ton` vaut or, flare, vert, bleu,
  violet ou craie. Sur l'accueil, **un ton par ligne de tuiles** — rouge pour
  les deux façons de jouer, bleu pour ce qu'on possède et ce qui se passe, vert
  pour la mémoire et le rang, violet pour les gens, or pour ce qui s'achète. La
  couleur devient une catégorie et non une décoration.

Les briques : `.tbf-plaque` (bouton), `.tbf-case` (tuile carrée),
`.tbf-onglets`/`.tbf-onglet` (barre d'onglets), `.tbf-cadre` (le panneau qui
compte), `.tbf-etiquette` (une valeur, qui ne se touche pas), `.tbf-echarpe`.

**`.pan` reste ce qu'il est.** Un écran entièrement en relief est un écran sans
hiérarchie — c'est le défaut exact des interfaces « gaming » ratées. Le relief
va à ce qui se touche et au panneau principal ; les dizaines de surfaces calmes
gardent leur filet d'un pixel.

### Sept barres d'onglets, sept réglages

`gap` valait 5, 6, 7 ou 8 ; le corps du texte 11, 11.5, 12.5, 13 ou 13.5 ;
l'onglet actif était tantôt une plaque claire, tantôt un fond translucide.
Personne ne pouvait le voir, puisqu'on ne regarde jamais deux écrans à la fois —
et c'est exactement pour ça que ça dérive.

Les sept sont ramenées sur `.tbf-onglets`. Les anciens noms de classe restent
dans le balisage, parce que le JavaScript de ces pages les interroge : ce qui
part, ce sont les règles qui les peignaient.

### Deux défauts qu'aucun contrôle ne pouvait voir, et leurs contrôles

**Une plaque peinte en rien.** Toutes ses couleurs viennent de cinq variables.
La table des tons commençait par `[data-ton]{…}`, qui ne s'applique qu'aux
éléments **portant** l'attribut : une plaque sans ton n'avait donc ni face, ni
cerne, ni encre, ses règles devenaient invalides une par une, et l'objet se
rendait transparent. Le bouton de menu de l'accueil a disparu comme ça —
présent, cliquable, mesuré comme visible, et invisible à l'œil.

**Un bouton resté au style du navigateur.** Le pendant exact, par le chemin
inverse : la règle qui l'habillait s'en va, et le bouton ne devient pas
invisible, il redevient un bouton système. Gris clair, bordure en relief,
parfaitement à sa place et étranger au jeu. C'est arrivé aux deux onglets du
deck, écrits par le JavaScript dans un gabarit de chaîne — mon remplacement de
balisage ne les a pas vus.

Le tour éprouve maintenant les deux, en lisant ce que le navigateur a **résolu**
et non ce que la feuille déclare. Le second a trouvé un troisième cas dans la
minute qui a suivi son écriture : deux onglets de `fanzzy.html` sont des
`<button>` et non des `<a>`.

`CAPTURE=1 npm run tour:ui` lève désormais le rideau d'ouverture avant de
photographier — sans quoi la capture de l'accueil montrait l'écran de
chargement pendant dix secondes.

---

### Cinq légendaires par série, partout

Il y en avait quatorze pour neuf séries : cinq aux REVENANTS, trois aux ÉPOQUES,
deux ailleurs, et **zéro** à VIRAGE NORD, au VIRAGE IMPOSSIBLE et à CE QUI
TRAÎNE AU STADE. Un joueur qui collectionnait ces trois-là ouvrait des boosters
sans sommet.

Trente et une nouvelles dans `src/shared/fanzzy/dex-legendes.js` — un fichier à
part, parce qu'une légendaire se lit **avec les huit autres** : c'est le point le
plus haut d'une série, et les neuf points hauts doivent se tenir. Éparpillées
dans deux mille lignes, personne ne pouvait les comparer, et c'est comme ça
qu'on se retrouve avec cinq d'un côté et zéro de l'autre.

Toutes ont un défaut, aucune n'a de lignée, leur puissance de cri va de 76 à 84,
et elles prennent en charge les gestes que presque personne ne portait au
catalogue : c'est la carte qu'on regarde, donc celle par qui on découvre qu'un
geste existe.

Conséquence à connaître : la collection complète passe de **373 à 695 boosters**
médians. Les quarante-cinq légendaires sont la queue de la courbe, et les dix
derniers pour cent coûtent désormais plus de la moitié du total. `npm run
economie` le recalcule à la demande.

**Trouvé au passage** : l'administration ne connaissait que **trois gestes sur
quinze**. La liste était écrite à la main et datait du jour où le jeu n'en avait
que trois ; douze sont arrivés depuis sans que personne ne repasse par là.
L'écran refusait donc d'enregistrer une carte dont le cri portait l'un des douze
autres — la carte était juste, le jeu la jouait, seul cet écran disait non. La
liste est maintenant importée de `ferveur/gestures.js`.

### Dix-sept pièces d'équipement

Sept pièces pour deux emplacements, c'était vingt et une combinaisons dont la
moitié sans intérêt ; en pratique tout le monde finissait sur mégaphone +
thermos, et le sac cessait d'être une décision. Dix de plus en font cent
trente-six.

Gants coupés, sifflet à roulette, carnet de chants, bonnet de virage, brassard
de capo, drapeau à deux mains, sac de cartons, cornet de brume, chronomètre de
poche, fanion de 1904. **Aucune n'a que des bonus** — la règle du module tient,
et elles ont été écrites en pensant au revers d'abord.

Les dix sont dessinées. La chaîne `stuff-images` **recadre désormais sur l'objet
détouré avant de réduire** : le générateur a rendu ces dix-là en seize-neuvièmes
au lieu du carré demandé, et sans ce recadrage elles seraient sorties au quart
de la vignette, entourées de vide, sans que rien ne le dise.

### Dix stades — et le stade n'existait nulle part

Cinq stades pour dix. Le Toit de Tôle, Le Bord de Mer, Le Stade Vide, La Neige,
Le Terrain Annexe. Dessinés, mesurés, leurs plans écrits.

Mais surtout : **le duel n'avait aucun stade, et les effets des stades
n'étaient appliqués nulle part.**

`stades.js` explique en tête que le lieu appartient au match et qu'« en duel, il
est tiré parmi ceux que les deux joueurs possèdent ». C'était écrit, documenté,
et `stadeDeLaRencontre` n'était appelée que par le Virage. Le duel se jouait
sur un fond noir uni pendant que le Virage montrait son lieu.

Et les `mods` de ces lieux — « le souffle revient bien plus lentement », « un
geste parfait paie double » — n'étaient composés avec rien : le Virage envoyait
son stade au client pour qu'il le dessine, et c'était tout. Dix lieux décrits,
zéro lieu qui changeait quoi que ce soit.

Les deux modes partagent maintenant `avecLieu()`, et le duel affiche son stade
sous la corde avec le nom du lieu et sa phrase d'effet — un stade qui change les
règles sans le dire donne l'impression que le jeu triche.

Un piège évité en chemin : `stadeDeLaRencontre` attend une graine **numérique**.
L'identifiant d'un duel est une chaîne, `Number('d-7f3a')` vaut `NaN`, et la
fonction retombe sur zéro — donc sur le premier stade, pour tous les duels du
jeu. Le lieu aurait existé sans jamais changer, ce qui est la façon la plus
discrète de ne pas exister. D'où `hachage()`.

Les invites des stades n'existaient nulle part, contrairement à la règle que le
projet s'est donnée pour les deux autres chaînes. Les dix sont maintenant dans
`scripts/stade-images.mjs --invites`.

### Vingt-neuf cartes d'action, et sept mini-jeux

**Cinq cartes, cinq mécaniques neuves.** Les vingt-quatre cartes d'origine se
partageaient vingt et un types d'effet : en ajouter cinq qui recombinent les
mêmes verbes aurait donné cinq cartes qu'on reconnaît en une partie et qu'on
cesse de lire à la deuxième. Chacune a donc sa branche dans le moteur, et
chacune touche à une chose que rien ne touchait :

| carte | ce qu'elle fait, et que rien d'autre ne faisait |
|---|---|
| **L'Ancre** | la corde cesse de retomber, 8 s, pour les deux camps |
| **La Mise** | le prochain chant compte double ; raté, il coûte 20 de souffle |
| **La Tournée** | les deux prochaines cartes ne coûtent **rien** — on joue ce qu'on n'a pas les moyens de jouer |
| **Le Long Chant** | pousse un peu, dix fois, sur dix secondes — passe sous la Bâche, se fait manger par la décroissance |
| **Le Retournement** | efface la moitié de l'avance adverse, et seulement si l'on est mené |

Le Retournement est marqué `adverse` dans `PORTEE`, donc il ne va pas au
Virage. Il ne touche pourtant personne — il divise un écart. Mais dans une salle
de trois cents, cet écart est le travail de la tribune d'en face : **la portée
ne se lit pas à la cible technique de l'effet, elle se lit à qui le subit.**

**Deux mini-jeux, et ils mesurent autre chose.** Les cinq épreuves existantes
demandent toutes la même chose sous des habits différents — reproduire ce qu'on
vient de voir. Une seule qualité de joueur, mesurée cinq fois.

— **Le tri** : vingt-quatre cartons de trois couleurs, on ramasse une couleur,
  six secondes. Rien n'est caché, rien ne s'éteint. Un mauvais carton **coûte un
  bon**, sans demi-mesure : c'est la seule note du répertoire où s'arrêter quand
  on n'est plus sûr est un choix qui se défend. Aucun équipement ne l'aide, et
  c'est voulu.
— **Le compte** : le rebours s'affiche trois secondes puis s'éteint, et il faut
  tomber juste quand même. Le seul endroit du jeu où il n'y a rien à regarder au
  moment d'agir. La cible change à chaque fois, sinon on l'apprendrait une fois
  pour toutes.

`epreuves:ui` les joue toutes les sept dans un vrai navigateur. Les deux
contrôles qui portent : tout ramasser sans regarder vaut **0,00**, et tomber à
deux tolérances de la cible vaut **0,00** — sans eux, une note constante
passerait au vert.

### Un contrôle qui épinglait un nombre

`virage-smoke` affirmait `duel.size === 7` : le nombre de cartes qui ne vont pas
au Virage. Un nombre ne dit rien de ce qu'il compte — il rougit dès qu'on ajoute
une carte, quelle qu'elle soit, et il se répare en écrivant 8, ce qui ne vérifie
plus rien. Il nomme maintenant les huit cartes, et ajouter une carte qui vise
l'adversaire oblige à venir l'écrire là, donc à se demander si elle a sa place au
Virage. C'est la question que ce contrôle existe pour poser.

---

### L'onglet qui n'en était pas un, et les 262 dessins retrouvés

Deux défauts vus sur capture, tous deux instructifs.

**Le troisième onglet de la page des Fanzzy était un lien nu.** Il portait
`class="go"` quand les deux autres n'avaient pas de classe : le remplacement
qui a posé `.tbf-onglet` ne l'a pas reconnu, et aucune règle ne visait `.go`
dans cette page. Résultat : « DECK » en bleu de navigateur, hors de la barre,
posé à côté d'elle.

Le contrôle « aucun bouton n'est resté au style du navigateur » ne pouvait pas
le voir — il ne regarde que les `<button>`, et un `<a>` sans style n'est ni gris
ni en relief. Il y a donc maintenant un contrôle **structurel** : *chaque enfant
d'un rail d'onglets est un onglet*. Il ne juge pas une couleur, il vérifie que
les deux moitiés d'une même brique sont bien ensemble.

En chemin, deux autres choses :

— `.tbf-onglet` était un conteneur flex, et son étiquette est un **texte nu**
  posé à côté d'une icône. Un texte nu dans un conteneur flex devient un élément
  anonyme qui **ne sait pas rétrécir**, et `text-overflow:ellipsis` n'agit
  jamais sur un conteneur flex : trois onglets qui refusent de céder débordent
  leur rail. Il est en bloc maintenant, l'icône en `inline-block`.
— Sur un écran étroit, **l'icône part avant l'étiquette** — un pictogramme qu'on
  reconnaît ne vaut pas un mot qu'on lit. Le seuil est à 400 px parce qu'un
  téléphone ordinaire fait 360, et que « MON FANZZY » n'y passait plus.

Trois pages avaient recopié la règle de l'onglet pour leurs boutons nus, et ces
copies portaient le défaut de l'original. Leurs dix boutons prennent la classe
comme tout le monde ; les trois copies s'en vont.

**Et le dessin manquant.** Le Fanzzy équipé s'affichait en silhouette
géométrique. Ce n'était pas une image cassée : c'était `MS9C`, le troisième âge
de `MS9` — et **`MS9` est dessiné**.

Les identifiants d'une lignée s'écrivent `MS9`, `MS9B`, `MS9C`. **Deux cent
soixante-deux cartes du catalogue sont des âges supérieurs de personnages déjà
dessinés** — c'est exactement le reliquat annoncé depuis des sessions comme « 262
illustrations à produire ». Il n'y avait rien à produire : il manquait un repli.

`FZART.adresse` descend maintenant sur la racine de la lignée quand l'âge n'a
pas son propre dessin. Le rendu procédural reste ce qu'il a toujours été — le
repli du **personnage inconnu** — et cesse d'être celui d'un personnage connu
qu'on n'a pas encore redessiné plus vieux. Rien ne ment au joueur : la carte
affiche son étage à côté du dessin. Le jour où un troisième âge est dessiné, il
prend la place sans qu'on touche à la fonction.

L'administration suit la même résolution : elle listait deux cent soixante-deux
tirets là où le joueur, lui, voit un personnage.

`images:test` mesure désormais **combien de cartes du catalogue réel obtiennent
une adresse** : 198 dessinées en propre, 262 par leur premier âge, **31 sans
rien**. Ces trente et une sont les légendaires écrites cette session : ce sont
les seules cartes du jeu encore en rendu procédural, et il leur faut une vraie
production d'illustrations.

---

### Le compteur qui prenait toute la ligne

Dans le catalogue du deck, le petit « ×1 » s'étirait sur toute la largeur et le
texte des cartes tombait à un mot par ligne.

**J'avais nommé le nouveau mini-jeu `.compte` dans `ui.css`.** Le deck avait
déjà un `.compte` — son compteur d'exemplaires. La feuille commune est chargée
**avant** le style de la page : la page gagnait donc sur les propriétés qu'elles
partageaient, mais `width:100%` et `height:100%` n'existaient que dans la
commune et s'appliquaient sans opposition. Rien n'était en erreur nulle part.

C'est exactement la règle que `ui.css` énonce en tête depuis toujours — « sans
ce préfixe, `.voile` de deck.html et `.pastille` de fanzzy-fiche.html seraient
réécrits par des règles qu'ils n'ont pas demandées ». Elle n'était vérifiée par
personne.

`npm run pages` la vérifie maintenant. Le contrôle ne regarde pas quelles
classes un sélecteur mentionne, mais **sur quel élément les propriétés
atterrissent** — le dernier composé — et s'il est tenu par un ancêtre de la
commune. `.tbf-tiroir .pip` ne peut atteindre que ce que la commune a elle-même
posé ; `.compte` tout seul atteint n'importe quel `.compte` de n'importe quelle
page. Sa première version signalait huit règles saines : elle lisait toutes les
classes au lieu du seul sujet.

### Un nouveau joueur sur quatre recevait une carte qui n'existe pas

Trouvé en répondant à la question « le joueur a-t-il un deck de base ? ».

`inventaire.js` portait une liste de quatre cartes d'action, présentée comme
« les cartes du paquet de bienvenue ». C'était une **seconde vérité** : le vrai
catalogue vit dans `duel/actions.js`, et les deux avaient divergé. `a-relance`
— « Seconde jeunesse » — y figurait quand la carte du jeu s'appelle
`a-secondsouffle`.

Le paquet de bienvenue tirait au hasard dans ces quatre-là. **Une inscription
sur quatre offrait donc une carte inexistante** : écrite dans la bourse du
joueur, absente de tout catalogue, et refusée par son propre deck en « carte
inconnue » — pour une carte qu'on venait de lui donner.

La liste en double est supprimée. L'accueil des nouveaux importe le catalogue,
comme tout le reste du jeu, et tire parmi les cartes commune et rare — sans quoi
on offrirait une légendaire à l'inscription, ce que rien n'a jamais voulu.

**La suite qui aurait dû le voir n'était lancée par personne.** Elle existait
(`scripts/onboarding-smoke.mjs`), elle vérifiait « une carte d'action » — le
**compte**, jamais l'existence. Elle est maintenant dans la batterie sous
`npm run bienvenue:smoke`, et elle demande que la carte existe et qu'elle soit
une carte de début.

En l'y mettant, elle est sortie rouge sur autre chose : elle épinglait
`r.json.stuff.length === 7`, juste sous un commentaire qui explique pourquoi le
compte des tenues, lui, ne s'écrit plus en dur. Elle avait rougi le jour où dix
pièces d'équipement sont arrivées, et personne ne l'avait su.

### Ce que reçoit un nouveau joueur, et la règle des exemplaires

Pour mémoire, parce que la question revient :

**Il n'y a pas de deck de base.** Le deck est vide à l'inscription, et le joueur
le construit. Ce qu'il reçoit, c'est un paquet de bienvenue —
`tirerBienvenue()` — et une réserve :

| à l'inscription | |
|---|---|
| Fanzzy | 2 (un commun, un rare ou épique) |
| équipement | 1 (commune ou rare) |
| carte d'action | **1** (commune ou rare) |
| écharpes | 80 à 120 |
| boosters en réserve | 3, puis 1 toutes les 10 min jusqu'à 12 |

**Une carte d'action ne se possède qu'une fois.** `possede.actions` est un
ensemble d'identifiants : on l'a ou on ne l'a pas. Un doublon tiré d'un booster
rend des écharpes, jamais un second exemplaire.

**Et pourtant le deck en accepte dix du même.** `DECK_RULES.copiesMax` vaut
`null` — aucun plafond — et c'est délibéré : un deck demande exactement dix
cartes d'action, un débutant en possède une poignée, et remplir dix emplacements
sans doublon serait arithmétiquement impossible. Les dix exemplaires sont **le
même droit répété**, pas dix cartes gagnées.

La conséquence à garder en tête : avec **une seule** carte d'action à
l'inscription, le premier deck légal est dix fois la même carte. C'est jouable
et ce n'est pas satisfaisant — la question « combien de cartes d'action offrir
au départ » reste ouverte, et se règle en une ligne dans `tirerBienvenue()`.

---

## 4 vicies septies. L'affiche, le bilan, et cinq cartes pour commencer

### Un duel commençait et se terminait sans rien dire

Il commençait sur une corde qui apparaît : on ne savait ni contre qui on jouait,
ni avec quoi, ni où. Il se terminait sur un voile gris avec un mot dessus —
moins qu'un message d'erreur pour cinq minutes de jeu.

Tout ce que montrent les deux nouveaux écrans était **déjà connu du serveur** à
ces deux instants. Rien n'en sortait.

**L'affiche**, sur `nvn:affiche`, juste après le départ :

— les deux camps, le sien toujours en premier — « en haut » veut dire « moi »
  sur les deux écrans du jeu ;
— **les trois Fanzzy de chacun**, pas seulement celui qui entre : c'est en
  voyant les trois qu'on comprend qu'on peut changer. Celui qui entre porte la
  couleur de son camp et sa marque ;
— la **forme récente** de chaque joueur : cinq pastilles, la plus récente à
  gauche, avec le décompte. Un joueur sans passé le dit — « premier duel » est
  une information, une absence n'en est pas une ;
— le lieu et ce qu'il change.

Elle se retire seule au bout de six secondes. C'est une affiche, pas une salle
d'attente : un joueur qui doit toucher un bouton pour entrer dans un duel déjà
commencé perd les secondes qu'il regarde.

**Le bilan**, sur `nvn:fin`, au coup de sifflet : le résultat, le score, ce que
le duel a rapporté — écharpes, XP, part versée au KOP — la carte préférée avec
son dessin, puis les chiffres du match **les deux camps côte à côte**, parce que
c'est la comparaison qui intéresse et non le chiffre isolé : chants, cartes
jouées, changements, relèves, ferveur, et qui a poussé.

L'ancien voile reste en repli, pour le cas où le bilan n'arrive pas — une
connexion coupée au dernier instant vaut mieux qu'un écran de jeu figé dont on
ne sort pas.

### Ce qu'il a fallu ajouter pour qu'il y ait quelque chose à dire

**Le moteur ne comptait rien.** Trois compteurs et une liste par joueur —
cartes jouées et leur tally, remplacements, relèves, Fanzzy réellement montés.
Ils ne coûtent rien pendant la partie, et `bilan()` ne fait que les mettre en
forme, une fois, à la fermeture.

La relève est comptée **à part** du remplacement : l'une fait grandir celui qui
est déjà en tribune, l'autre en fait entrer un autre. Les mêler donnerait un
chiffre qui ne veut rien dire.

**`recompenser` versait en silence.** Écharpes, XP et part de KOP partaient
sans que rien ne le dise : le joueur voyait son solde changer entre deux écrans.
Elle rend maintenant ce qu'elle a versé.

**Les matchs nuls n'étaient nulle part.** Seuls les duels classés **avec un
vainqueur** s'écrivaient dans `duel_results`. La table accepte pourtant `draw`
depuis le premier jour : « tes cinq derniers duels » aurait menti par omission,
en oubliant exactement les parties les plus serrées.

### Cinq cartes d'action à l'inscription, dont l'Arbitre

Il y en avait **une**. Un deck demande exactement dix cartes et n'impose aucun
plafond par carte : le premier deck légal d'un nouveau joueur était donc dix
fois la même — jouable, et sans aucune décision à prendre.

L'Arbitre est **garanti**, pas tiré. C'est la carte qui ouvre le changement :
sans elle, le second Fanzzy du paquet de bienvenue reste sur le banc pendant
tout le duel et le joueur ne découvre jamais qu'une tribune se relaie. Une
mécanique entière dépendait d'un tirage à une chance sur dix-sept.

Les quatre autres sont tirées **sans remise** parmi les cartes de début : avec
remise, on retomberait parfois sur quatre Fumigènes, c'est-à-dire sur le
problème qu'on vient de corriger.

### Deux collisions de noms, la même leçon

`.compte` venait d'être corrigée entre `ui.css` et le deck. L'affiche en a
produit une seconde, **à l'intérieur d'une même page** cette fois : mes
`.camp-bloc .qui .cote` contre le `.cote` du duel, qui positionne les deux
territoires de l'arène en `position:absolute; width:50%`. Ma règle réglait la
police et le fond, jamais la position : les deux petites étiquettes « TOI » et
« EN FACE » sont devenues deux blocs de couleur en travers de l'écran.

Le contrôle posé la veille ne pouvait pas la voir — il compare `ui.css` aux
pages, pas une page à elle-même. Celle-ci a été trouvée **en regardant la
capture**, ce qui reste le seul moyen pour une classe de nom courant dans un
fichier de mille lignes.

### La suite du duel éprouvait une table absente

`nvn-ui-smoke` ne chargeait pas `duel.sql`. `duel_results` n'existait donc pas,
la forme récente échouait en silence — elle est écrite pour ça — et l'affiche
disait « premier duel » à tout le monde. Le contrôle serait passé au vert sur
une requête cassée.

Six résultats sont maintenant semés pour l'un des deux joueurs, et la suite
vérifie que l'affiche **n'en montre que cinq**, dans le bon ordre : la plus
récente d'abord, parce que celui qui a perdu ses quatre premiers et gagné le
dernier ne raconte pas la même chose que l'inverse.

**À savoir** : `reglages:smoke` sort parfois en code non nul après avoir écrit
« tout est vert ». C'est une assertion libuv au démontage, propre à Windows
(`UV_HANDLE_CLOSING`), et non un contrôle qui échoue. Trois passages d'affilée
sortent à zéro.

---

## 4 vicies octies. Le duel se joue comme le Virage

### La dernière différence est tombée

Elle était demandée depuis longtemps — « il faut que le VIRAGE et les DUEL se
déroulent selon le même processus » — et elle a été reportée deux fois. La
voici traitée.

Le duel **imposait** le geste : une rotation du serveur, le sien un chant sur
deux, les seize autres à tour de rôle. Tous les chants coûtaient dix-huit pour
pousser quarante-quatre : appuyer sur le bouton était le seul geste, et il n'y
avait rien à décider.

Le duel reçoit le **répertoire du Virage** : cinq chants parmi dix-neuf, chacun
avec son coût et sa poussée. Les deux écrans se jouent désormais avec le même
geste de la main, et le duel y gagne une décision qu'il n'avait pas — un gros
chant coûte plus de souffle et rend plus.

`chanter(userId, { cardId, taps })` au lieu de `chanter(userId, { taps })`. Le
coût, la poussée et le geste viennent de la carte. Le bot choisit dans le
répertoire comme un joueur — il envoyait `geste: 'tempo'`, un champ que le
moteur n'a jamais lu.

**Le répertoire d'un duel est fixe** pendant les cinq minutes : celui du Virage
tourne toutes les dix minutes de match réel, ce qui n'a pas de sens sur une
partie plus courte que ça. Il est tiré de l'identifiant du duel — les deux
joueurs ont les mêmes cinq chants, et deux duels n'ont pas les mêmes. C'est ce
qui remplace la rotation : on rencontre les dix-sept gestes en jouant plusieurs
parties, au lieu de les voir tous défiler dans une seule.

**Une correction à ce qui avait été écrit ici :** j'avais noté qu'unifier ferait
« perdre au deck la moitié de son objet ». C'était faux, et c'est ce qui avait
servi à repousser. Les chants du Virage ne viennent pas du deck — ce sont cinq
chants globaux, les mêmes pour toute la tribune. Le deck, c'est trois Fanzzy et
dix cartes d'action, dans les deux modes. Unifier ne lui retire rien.

### La corde était figée à l'écran

Trouvé en cherchant pourquoi la suite du duel était instable.

`diffuser` commençait par `if (!evenements?.length) return;` : entre deux
actions, **plus rien ne partait au client**. Or il se passe quelque chose en
permanence — la corde retombe de 1,2 point par seconde, l'horloge tourne, le
souffle revient. Le joueur voyait donc une corde immobile jusqu'à ce que
quelqu'un chante, puis un saut.

La décroissance est la tension du jeu : on ne pouvait pas voir qu'on perdait son
avance sans rien faire. L'état part maintenant à chaque battement — deux fois
par seconde. Les **événements**, eux, restent conditionnels : un tableau vide dix
fois par seconde n'apprend rien à personne.

### « EN FACDUEL »

La barre commune écrit le nom de l'écran entre ses deux boutons. Sur un écran de
jeu, la page a déjà son propre en-tête au même endroit — le score et l'horloge
du duel — et les deux se superposaient. Le titre est retiré sur les barres de
jeu, et là seulement.

### Les familles disent enfin ce qu'elles font

`geste` (un mot) est devenu `gestes` (une liste), et cette liste **est** la
règle : un personnage ne peut porter que l'un des gestes de sa famille.

| famille | son geste | ses variantes |
|---|---|---|
| Voix | tempo | contretemps, écho, capo |
| Percussion | martelage | crescendo, salves |
| Fidélité | endurance | sang-froid, mesure |
| Tifo | tifo | mosaïque, tri |
| Pyro | relance | compte |
| Déplacement | écharpe | mémoire |

Les dix-sept gestes y sont répartis sans trou ni doublon. Quatre-vingt-dix
personnages de stade 1 ont changé de cri ; les cent vingt-cinq qui étaient déjà
justes gardent le leur, et les âges suivent — `agesDe` reprend le geste du
premier âge.

**Six âges écrits à la main** — les lignées T, Y et D, antérieures à
`dex-ages.js` — dérivaient de leur propre personnage : un joueur qui faisait
grandir son Fanzzy perdait le geste qu'il avait appris.

Nouvelle suite `npm run catalogue:test` : treize contrôles de **cohérence**,
pas de fonctionnement. Chacun correspond à une phrase écrite quelque part dans
le projet et vérifie que le contenu la tient encore — cinq légendaires par
série, un revers par pièce d'équipement, un effet que le moteur sait résoudre
par carte d'action, une règle par stade.

### Deux mini-jeux injouables au Virage, pour la deuxième fois

`tri` et `compte` avaient été ajoutés au moteur et au duel **sans leur écrire
de chant**. Le Virage ne propose que les gestes portés par un chant de son
répertoire : ils y étaient donc injouables, exactement comme les cinq épreuves
l'avaient été.

Un geste vit dans deux listes qui ne se parlent pas : `GESTES`, où il se
déclare — et le duel le rend jouable automatiquement — et `ORDRE`, le répertoire
des chants. Le contrôle censé le voir portait une liste de quinze gestes écrite
à la main : restée vraie sur elle-même et fausse sur le jeu.

Les deux listes écrites à la main de `virage-smoke` sont maintenant
**confrontées** à celles du jeu. Elles restent à la main — ajouter un chant doit
obliger à dire où il se place dans la rotation — mais elles rougissent quand
elles ont divergé, ce qui est la seule façon pour qu'une décision consciente
reste consciente.

---

## 4 vicies novies. Les variantes comptent, et le dossier se génère

### Une famille annonçait quatre gestes et n'en jouait qu'un

Les familles disaient vrai depuis la session précédente, mais seulement à moitié.
La Voix comptait **vingt-neuf tempo pour un contretemps et un écho** : les deux
variantes existaient au catalogue et pas dans le jeu. Un joueur qui voulait un
Fanzzy spécialisé en contretemps avait une carte sur trente-cinq à trouver.

La règle de répartition est maintenant **la moitié au geste éponyme, le reste
partagé également**. La moitié suffit à ce qu'une Voix reste une Voix — c'est ce
que le contrôle exige déjà — et les vingt-neuf trentièmes n'ajoutaient qu'un
appauvrissement.

| famille | avant | après |
|---|---|---|
| Voix | tempo 29 · capo 4 · contretemps 1 · écho 1 | tempo 18 · contretemps 6 · écho 6 · capo 5 |
| Percussion | mash 28 · crescendo 1 | mash 15 · crescendo 7 · salves 7 |
| Fidélité | hold 50 · retenue 3 · tenue 1 | hold 27 · tenue 14 · retenue 13 |

Cent cinq personnages ont changé de variante, de façon déterministe sur leur
identifiant : relancer le calcul donne le même catalogue. Les trois autres
familles étaient déjà réparties et n'ont pas bougé.

`catalogue:test` a un contrôle de plus : **chaque variante est réellement
jouable** — au moins un huitième de sa famille. Le seuil est bas exprès : ce
n'est pas une cible d'équilibrage, c'est le plancher sous lequel une variante
n'existe qu'au catalogue.

### Le dossier de l'administrateur

`npm run dossier` génère un document complet des mécaniques —
`scripts/dossier.mjs`, publié comme artefact.

**Il est généré et non écrit**, et c'est tout son intérêt : les nombres, les
règles, les coûts et les barèmes viennent des mêmes modules que le jeu. Un
document qui dit « dix-sept mini-jeux, vingt-neuf cartes, dix stades » est faux
le jour où l'on en ajoute un, et personne ne le sait. Celui-ci ne peut pas mentir
plus longtemps qu'une commande.

Douze sections : ce qu'est un Fanzzy et ses dix caractéristiques, les six
familles avec la répartition de leurs gestes, les neuf séries, **les dix-sept
mini-jeux avec leur règle exacte** — la phrase est écrite à la main, les nombres
viennent du barème — les dix-neuf chants, les deux modes comparés, les
vingt-neuf cartes d'action, les dix-sept pièces, les dix stades, l'économie, les
trente-quatre réglages de l'administration, et l'état du développement.

Seule la dernière section est écrite à la main : aucun module ne sait dire si une
chose est finie.

**Quatre-vingt-onze kilo-octets** contre trois mégaoctets et demi pour le
document qu'il remplace — celui-ci portait cent vingt-six illustrations en
base64. Un dossier de référence se lit, il ne s'admire pas.

### Trois pièges de mise en page, tous le même

Le tableau des mécaniques s'empile sur téléphone : chaque ligne devient un bloc,
l'en-tête de colonne passe en étiquette. Trois essais avant que ça tienne à
320 px, et les trois fautes étaient la même famille :

1. **En flex**, le contenu d'une cellule est un texte nu — un élément anonyme qui
   ne sait pas rétrécir sous sa largeur minimale. C'est exactement le défaut des
   onglets, deux sessions plus tôt.
2. **En grille à deux colonnes**, pas mieux : un titre suivi d'un `<span>` fait
   *trois* éléments avec le pseudo-élément, et le troisième repassait à la ligne
   dans la colonne étroite.
3. **En bloc**, il n'y a plus ni colonne ni élément à répartir. Plus une valeur
   de réglage en texte long rangée dans la colonne des nombres, qui refusait de
   céder.

Et une quatrième fois le piège des accents graves : un commentaire CSS contenant
`\`nowrap\`` à l'intérieur d'un gabarit de chaîne a cassé le générateur.

---

## 4 tricies. Cinq séries neuves, et deux qui n'existent plus

### Ce qui a été ajouté

Cinq séries, soixante-deux personnages écrits, plus douze arrivés par déménagement — **soixante-douze personnages de stade 1 publiés** :

| série | ce qu'elle raconte | cartes | ouverte au |
|---|---|---|---|
| LES VIP | ceux qui sont là pour autre chose que le match | 15 | niveau 16 |
| LA GASTRONOMIE DE COMPTOIR | ce qui se mange et se boit debout | 14 | niveau 8 |
| LES GALÈRES DE DÉPLACEMENT | on y arrive quand même, et ensemble | 14 | niveau 10 |
| LES PHÉNOMÈNES MÉTÉO | le vent, la pluie, la grêle | 14 | niveau 20 |
| LES HÉROS DU CANAPÉ | ceux qui n’y sont pas et qui parlent le plus fort | 15 | niveau 12 |

Chacune a ses cinq légendaires, ses communes, ses gestes répartis dans sa
famille, et **ses quarante-quatre lignées** — deux âges par personnage, écrits à
la main comme tous les autres.

L'échelle de niveaux se lit maintenant comme un éloignement progressif du
siège : on est dans la tribune, puis derrière la buvette, puis sur la route,
puis sur le canapé, puis dans la loge, puis il n'y a plus personne du tout — le
vent, les morts, les siècles, l'impossible.

**Aucun palier existant n'a bougé.** TR, MS, BG, OB, RV, EP et IM gardent leur
niveau : changer le niveau d'une série reprendrait à un joueur ce qu'il a
ouvert. Les cinq neuves n'occupent que des niveaux qui n'ouvraient rien.

### VIRAGE NORD et NUITS EUROPÉENNES sont dissoutes

C'étaient les deux plus maigres — seize et neuf personnages publiés, quand LA
TRIBUNE en compte trente-cinq. Une série est une étagère à compléter ; une
étagère de neuf cases se remplit par accident, elle ne se collectionne pas.

Et leurs sujets appartenaient ailleurs. VIRAGE NORD, « béton, pluie, hiver »,
c'était la tribune ordinaire. NUITS EUROPÉENNES, « jeudi soir, 900 km »,
c'était le déplacement — et le déplacement a maintenant sa série.

**Rien n'a été supprimé.** Quarante-deux personnages ont changé de champ `set`
et gardé leur identifiant. Les possessions, les decks, les tenues et les âges
désignent une carte par son identifiant : ils ont suivi sans qu'on y touche.

| vers | combien | qui |
|---|---|---|
| LA TRIBUNE | 24 | la tribune ordinaire, et les cinq légendaires du virage : capo, bâche, tambour, muret, torche |
| LES GALÈRES DE DÉPLACEMENT | 7 | les cinq légendaires des nuits européennes, et deux dépubliés |
| LES MÉTIERS DU STADE | 3 | la stadière, les souterrains, la touche |
| LA GASTRONOMIE DE COMPTOIR | 3 | ce qui se mangeait déjà debout |
| LES HÉROS DU CANAPÉ | 2 | la radio, la streameuse |
| LES VIP, LES PHÉNOMÈNES MÉTÉO, LE BESTIAIRE | 1 chacune | l'agent en tribune d'honneur, le vent, le loup |

LA TRIBUNE compte donc **dix légendaires**. Le contrôle exigeait exactement
cinq, et il avait tort : ce qu'on veut vérifier, c'est qu'aucune série n'est
sans sommet. Un plafond n'apporte rien. La plus ancienne série est aussi la plus
profonde, et c'est très bien ainsi.

### Le catalogue vit en base, et l'amorçage n'écrase rien

`sql/series-neuves.sql` déménage **soixante-douze lignes** — les quarante-deux
premiers âges et les trente âges supérieurs. C'est le piège que la base locale a
révélé au premier essai : « X1B » et « X1C » portent leur propre `set_id`, et
les oublier laissait trente cartes rangées dans deux séries que plus aucune page
n'affiche. Tirables et invisibles.

Le fichier retire aussi VN et NE de `series_actives`, et **n'ouvre pas** les cinq
neuves : une installation qui a restreint ses séries l'a fait exprès.

Deux listes d'application existaient et avaient divergé — `schema-smoke.mjs` en
appliquait vingt, `appliquer-schema.mjs` dix-huit. `boutique.sql` et
`billets.sql` manquaient au script de déploiement, qui est précisément celui
dont tout le projet dépend pour ne plus revivre le 8 septembre. Les deux listes
sont maintenant identiques.

### Trois contrôles qui mentaient par un nombre écrit à la main

Les trois ont rougi sur ce lot, et aucun ne parlait d'un vrai défaut :

1. `niveau-smoke` attendait `series.size === 9`. Il lit `SETS.length`.
2. `catalogue-smoke` exigeait exactement cinq légendaires. Il en exige au moins cinq.
3. `fanzzy-images-smoke` tolérait trente et une cartes sans dessin. C'est un
   **cliquet** désormais nommé, avec ce qu'il contient et ce qui le ferait
   descendre.

Un nombre recopié dans un test ne dit rien de plus que la source dont il vient,
et il ment dès que la source bouge. Le troisième reste écrit à la main, et c'est
volontaire : une dette qu'on ne voit plus est une dette qu'on ne paie jamais.

### La dette d'illustrations

Cent quatre-vingt-trois cartes n'ont aucun dessin : les trente et une
légendaires, et les cent cinquante-deux lignes des cinq séries neuves. Sans
adresse, la fiche tombe sur le rendu procédural — elles ne sont pas invisibles,
mais une légendaire en silhouette géométrique n'est pas une légendaire.

**Quarante-quatre dessins en effaceraient cent trente-deux** : les âges
supérieurs tombent sur le dessin de leur premier âge, et les quarante-quatre
lignées neuves en ont chacune deux. C'est là qu'il faut mettre la prochaine
fournée, pas sur les légendaires.

---

## 4 tricies semel. Le bouton qui mentait, la case de BD, et un décor par série

### « EMMENER EN DUEL » n'emmenait personne en duel

Il écrivait `user_wallet.active_fanzzy` — **l'avatar**, le personnage que voient
l'accueil et les amis. Le Fanzzy n'entrait dans aucun deck, ne poussait sur
aucune corde, et la fiche affichait ensuite « DÉJÀ EN DUEL » sur quelqu'un qui
ne jouerait jamais. Le bouton disait une chose et en faisait une autre.

Il fait maintenant ce qu'il dit, et il demande **où** : un deck a un titulaire,
celui qui entre au coup d'envoi, et des remplaçants que la carte Changement fait
entrer. Ce n'est pas la même décision, et la fiche ne peut pas la prendre à la
place du joueur.

`POST /api/deck/placer` pose un personnage à un rang. Le reste du deck n'est pas
touché — les pièces des autres rangs, les dix cartes d'action, le nom. Trois
règles le tiennent :

- **Un déplacement est un échange.** Passer son titulaire en remplaçant laissait
  sinon le rang 0 vide et le deck invalide, et le sortant disparaissait sans que
  rien ne le dise. Les deux personnages échangent leur place, équipement compris.
- **Pas de trou au milieu.** Le rang 2 ne s'ouvre que si le rang 1 est occupé :
  c'est `fanzzy[0]` qui décide du titulaire, et un trou ferait mener le deck par
  le premier rang non vide, qui n'est pas celui qu'on a choisi.
- **Un âge supérieur place son personnage.** Ouvrir la fiche du Capo et le
  placer place le Choriste, qui est le même individu.

Deux défauts trouvés par les contrôles écrits pour l'occasion, dont un dans le
code neuf : `Number(null)` vaut **zéro**. Un appel sans place aurait donc nommé
un titulaire en silence, en sortant celui qui y était — le contraire exact de ce
que la question est là pour obtenir. Le type est vérifié avant la valeur.

Les étiquettes ont suivi : la carte du classeur dit « AVATAR » et non « DUEL »,
l'onglet dit « TON AVATAR ». Elles nommaient le deck en parlant d'autre chose.

### Une seule boîte pour demander « es-tu sûr ? »

Il y en avait trois façons, et elles ne se ressemblaient pas : **rien du tout**
pour la plupart des gestes — se déconnecter, emmener un Fanzzy en duel,
acheter — ; **`confirm()` du navigateur** pour quitter un KOP, une boîte système
grise précédée de « thebestfan.online indique », qui sort de l'univers du jeu à
l'instant précis où l'on demande au joueur de s'engager ; et **un panneau écrit
à la main** pour l'évolution, riche et juste, mais qui ne vivait que dans la
fiche.

C'est la troisième qui a gagné. `public/dialogue.js` — `TBF_DIALOGUE.confirmer`,
qui rend une promesse. La règle qu'elle porte : **une confirmation montre ce
qu'on va perdre**, elle ne demande pas deux fois. Un « es-tu sûr ? » auquel
personne ne peut répondre autrement qu'au hasard ne protège de rien ; il apprend
seulement à appuyer sur OUI sans lire.

Ce qu'elle garantit : le geste qui engage est **toujours à droite**, le focus
entre dans la boîte et n'en sort pas, Échap et le fond annulent, et `surOui`
retient la fermeture pendant l'appel réseau — sans lui, l'échec arriverait une
seconde après la disparition de la boîte, sur une page qui a déjà tourné.

Branchée sur la déconnexion (trois écrans), la sortie d'un KOP, l'achat en
billets, la commande en euros, l'entrée en duel, et la suppression du compte —
qui garde son mot de passe mais perd son `prompt()`.

`verif-pages` exige maintenant `dialogue.js` **sur chaque page**. Les appels
s'écrivent `window.TBF_DIALOGUE?.confirmer(...)` : sans le script, la garde `?.`
rend `undefined` et le geste **passe sans rien demander** au lieu de lever. Un
oubli ne casserait rien et retirerait une protection — la faute qu'aucune suite
n'attrape.

### Le moment fort est une case de bande dessinée

« GOAL ! » était du lettrage nu posé sur le personnage, avec un contour sombre
pour tenir. Ça ne tenait pas : du jaune sur un maillot jaune, sur une pelouse
verte, sur une photo de stade éclairée aux projecteurs — il y a toujours un fond
qui gagne. On voyait qu'il se passait quelque chose sans pouvoir lire quoi.

Il a maintenant un cadre, un fond opaque et des rayons, et il est **au centre de
l'écran**. La case règle les deux problèmes d'un coup : elle isole le lettrage du
fond, donc il se lit ; et elle fait l'événement, parce qu'un panneau qui tombe au
milieu de l'écran est une interruption et non une décoration.

Le panneau est posé sur `document.body` et non dans la boîte du personnage —
c'est ce qui permet de le centrer sur la page. `momentDans` ne servait qu'à
contourner ça : il est ignoré. Un seul panneau par page, sans quoi deux scènes
en posaient deux au même endroit et couper l'un laissait l'autre affiché.

`.tbf-vignette` est un vocabulaire partagé : le résultat du duel — VICTOIRE,
DÉFAITE, MATCH NUL — porte exactement le même cadre. Ce sont les deux mots que
le jeu dit le plus fort, et qu'ils se ressemblent est ce qui les fait reconnaître
avant d'être lus.

### Un décor derrière chaque Fanzzy

Les personnages étaient détourés sur du noir, avec un halo teinté par la
famille. Le Gamin au Tambour de LA TRIBUNE et le Loup du BESTIAIRE se tenaient
devant exactement le même vide, à la nuance de bleu près : deux cent quatre-vingts
personnages, un seul lieu.

`public/fanzzy-fond.js` compose le décor à partir des quatre choses demandées,
chacune sur une couche qui ne marche pas sur les autres :

| ce qui décide | ce que ça change |
|---|---|
| **la série** | le *lieu* — les gradins, le couloir de service, le comptoir, l'autoroute de nuit, le salon, la loge, le ciel… douze silhouettes |
| **la tenue** | l'*époque* — toute la palette bascule. C'est ce qui fait qu'une tenue se voit de loin au lieu de se chercher sur le costume |
| **l'âge** | la *lumière* — un projecteur au premier, trois au troisième. Une légendaire a sa couronne, qui ne se gagne pas |
| **la famille** | l'*accent* — la couleur du halo et un motif : ondes pour la Voix, peau de tambour pour la Percussion, fanions pour le Tifo |

Il est déterministe, semé sur l'identifiant : deux rendus de la même fiche
donnent le même décor. Le classeur et la fiche partagent le même, `artFond` y
déléguant — deux décors pour le même personnage, c'est le joueur qui apprend
deux fois où il habite.

**Trois défauts n'ont été vus qu'en regardant l'image**, et aucun contrôle
automatique ne les aurait nommés :

1. **Le cadre était carré.** Avec `slice`, un carré posé dans une vitrine de
   370 × 565 s'agrandit d'un facteur 5,65 — chaque forme sortait une fois et
   demie trop grosse, les têtes de la foule en pastilles de dix-sept pixels. Le
   décor n'était pas mal dessiné, il était trop gros pour être reconnu. En
   portrait, le facteur tombe à 3,8.
2. **Les silhouettes étaient claires.** Des formes pâles sur un ciel sombre
   donnaient une bouillie olive. Le principe manquait, et il est le même depuis
   toujours dans un stade : on est dans le noir, la lumière est au-dessus. Un
   décor est **du noir sur un ciel éclairé**.
3. **L'accent de famille peignait au lieu de teinter.** À trente pour cent, les
   ondes de la Voix étaient la seule chose visible — une tache plus grande que le
   personnage.

---

## 4 tricies bis. Les saisons remplacent les niveaux

### Ce qui n'allait pas dans l'ouverture par niveau

Les séries s'ouvraient au niveau du joueur : LA TRIBUNE au 1, LES MÉTIERS DU
STADE au 3, LE VIRAGE IMPOSSIBLE au 26. Ça marchait, et ça avait un défaut qu'on
ne voit qu'en regardant le jeu vivre : **rien n'arrivait jamais à personne en
même temps**.

Chacun découvrait une série le jour où son compteur d'expérience passait un
seuil, seul, sans que ce jour-là existe pour qui que ce soit d'autre. Deux
joueurs qui se parlent ne parlent alors jamais de la même chose, et il n'y a
rien à annoncer — puisqu'il n'y a rien de neuf, seulement quelqu'un qui rattrape.

Une saison ouvre **pour tout le monde le même jour**. C'est ce qui permet de
relancer le jeu.

### Ce qu'une saison est

Une ligne de la table `saisons` : un numéro, un nom, une annonce, et quatre
listes de contenu. Elle se prépare **en brouillon** — rien ne change pour
personne — et se lance d'un geste distinct, qui est le plus visible de toute
l'administration : il change le jeu de tous les joueurs connectés, à la seconde.

Ce qu'elle ouvre vraiment :

| ce qu'elle nomme | ce qui se passe au lancement |
|---|---|
| **séries** | elles s'ouvrent — c'est le levier principal |
| **tenues** | elles se publient |
| **équipement** | annoncé, pas retenu |
| **cartes d'action** | annoncé, pas retenu |

Les deux dernières sont du **code**, pas de la base : rien ne sait encore les
garder fermées. Le dire plutôt que de faire semblant — et le jour où elles
vivront en base comme le catalogue, les deux champs deviendront des leviers sans
changer de forme.

**Additif, jamais soustractif.** Les séries ouvertes sont l'**union** de toutes
les saisons lancées. La saison 4 n'annule pas la 3 : un collectionneur qui a
commencé LES REVENANTS doit pouvoir les finir, et une série qui se referme
derrière lui transformerait sa collection en dette. Refermer reste possible — on
remet la saison en brouillon — et c'est délibérément malcommode.

### Les trois endroits où le changement se voit

**L'administration** a un onglet SAISONS, qui est désormais le seul d'où l'on
ouvre du contenu. L'onglet FANZZY montre les séries ouvertes, il ne les règle
plus : un second interrupteur aurait été une seconde vérité, et le jour où les
deux divergent personne ne sait laquelle le jeu applique. La confirmation de
lancement **énumère ce qui s'ouvre** — un « es-tu sûr ? » auquel on ne peut
répondre qu'au hasard ne protège de rien.

**Le kiosque** annonce la saison en cours, une fois par joueur. Le serveur
retient la dernière vue : une annonce qu'on ne peut pas faire taire est une
annonce qu'on apprend à ne plus lire, et la suivante ne le serait pas non plus.
Il dit aussi ce qui attend — « trois séries en attente d'une saison » — **sans
promettre de date**. Il disait « au niveau 12 » ; une saison se lance quand
l'administration la lance, et annoncer une échéance qu'on ne tiendra peut-être
pas est pire que de n'en annoncer aucune.

**Le niveau** n'ouvre plus que des capacités : des emplacements de club, un
troisième rang de tribune. Sept paliers au lieu de dix-neuf. C'est la bonne
chose à lui confier — une capacité n'a de sens que pour un joueur donné, et
personne n'a envie qu'on la lui annonce. `fanzzy.error.set_locked` n'est plus
émis nulle part : il ne reste qu'une règle, donc un seul refus.

### La migration, et ce qu'elle évite

`sql/saisons.sql` crée une **saison 1** faite de ce que l'installation ouvrait
déjà — la liste de `reglages.series_actives`, ou toutes les séries si ce réglage
était absent. Sans cette reprise, une base en service se retrouverait **sans
aucune série ouverte** le jour du déploiement : l'union des saisons lancées
serait vide et le kiosque n'aurait plus rien à distribuer.

`chargerCatalogue` charge les saisons lui-même, et en premier. Ce n'est pas une
commodité : `chargerSeries` en dépend entièrement, et tout ce qui monte un
catalogue passe déjà par là. Le confier à l'appelant aurait voulu dire l'ajouter
à dix-neuf suites et à chaque nouvelle, avec pour seule sanction d'un oubli une
exception au premier affichage du kiosque.

### Quatre suites que personne ne lançait

`admin-smoke`, `fanzzy-smoke`, `classement-smoke`, `souvenirs-smoke` et
`nvn-net-smoke` n'étaient dans **aucun script npm**. Elles ne se lançaient donc
que si quelqu'un tapait leur chemin de mémoire, ce que personne ne fait — et deux
d'entre elles avaient dérivé en silence pendant des semaines :

- `fanzzy-smoke` tirait dans VIRAGE NORD et NUITS EUROPÉENNES, dissoutes. Elle
  levait au premier booster. Elle figeait aussi « la première carte est un
  supporter **commun** », ce qui n'est plus vrai depuis que les deux premières
  places tirent leur rareté — sans quoi aucune légendaire n'était atteignable.
  Elle passait quand même, parce qu'elle tirait dans une série trop pauvre pour
  avoir autre chose que des communes ;
- `nvn-net-smoke` chantait en choisissant son **geste**, ce que le duel refuse
  depuis qu'il a reçu le répertoire du Virage. Sept contrôles tombaient en
  cascade, la corde n'ayant jamais bougé.

Une suite qu'on ne lance jamais ne protège de rien, et pire : elle fait croire
que la chose est couverte. C'est l'exact équivalent, pour les tests, de la
promesse sans destinataire que `promesses.mjs` traque par ailleurs — qui le
traque donc maintenant aussi.

### Une collision qu'une exception cachait

`.grille` était déclarée sans préfixe dans `ui.css`, et **inscrite dans la liste
des exceptions** du contrôle de préfixe : « vocabulaire partagé, posé par
geste.js ». Elle ne l'était pas. Deux pages s'en servaient déjà pour autre
chose — la grille des cartes d'action du deck, et les formulaires de
l'administration — et la règle commune leur imposait `width:86%; margin:0 auto`,
qui n'a de sens que pour la mosaïque.

Le formulaire des saisons sortait donc centré sur les deux tiers de la largeur,
avec son champ d'annonce débordant par-dessus son étiquette. Vu sur la capture,
pas autrement.

**Écrire « c'est du vocabulaire partagé » ne rend rien partagé.** La classe
s'appelle `tbf-grille`, l'exception est retirée.

---

## 4 tricies ter. L'accueil respire, et l'application tient enfin la tablette

### Trois cadres de trop

**L'avatar avait un cadre.** Une plaque sombre autour de la pastille dorée, qui
portait le pseudo et le nom du club à côté. Sur un compte neuf ces deux lignes
sont vides : il ne restait qu'un rectangle noir pendant sous la pastille, plus
haut que tous les boutons de la rangée, sans rien dedans. Les deux se lisent au
profil, qui est à un doigt de là. Le cadre est parti, et avec lui la jauge de
palier ; le niveau reste, en pastille sur l'avatar.

**Les deux jetons aussi.** Une plaque dorée autour d'un compteur doré et une
plaque rouge autour d'un compteur rouge : deux fois la même information, et deux
boutons qui criaient plus fort que les dix destinations du jeu. Il reste le
dessin et le nombre.

Tout ce qui est dans la barre du haut fait maintenant **la même hauteur**. C'est
la seule chose qui fasse une rangée : trois objets de trente-huit, quarante-
quatre et cinquante-deux pixels côte à côte se lisent comme trois accidents.

### L'écharpe, en quatre essais ratés

Le jeton des écharpes portait un carré rayé en CSS. Il est passé en dessin au
trait, comme tout le reste du jeu — et il a fallu **huit tracés, regardés à
vingt-deux pixels**, pour en trouver un qui se lise :

| tracé | ce qu'on voit à 22 px |
|---|---|
| boucle nouée + franges | un verre à pied |
| bande diagonale | un pansement |
| col + deux pans | une échelle |
| nœud + franges | une table |
| col en V | un pantalon |
| pendue à franges | une cravate |
| nœud à deux pans | un portique |
| **bande à rayures obliques** | **une écharpe** |

C'est celui-là. Et ce n'est pas un hasard : c'est déjà ainsi que le jeu dessine
une écharpe partout ailleurs — `.tbf-echarpe`, des rayures obliques. À cette
taille il ne reste que la silhouette, et la silhouette d'une écharpe de
supporter est une bande rayée.

Le sachet des boosters, lui, reprend **le dessin exact** de la tuile BOOSTERS.
Un même objet dessiné de deux façons, ce sont deux objets à apprendre.

### Les deux rails se répondent rangée par rangée

CARNET et MATCHS ont échangé leur place. Chaque rangée porte désormais une
couleur **et** un sujet :

| | à gauche | à droite |
|---|---|---|
| rouge — ce qui se joue | VIRAGE | DUEL |
| bleu — ce qui se collectionne | FANZZY | CARNET |
| vert — ce qui se regarde | MATCHS | CLASSEMENT |
| violet — les autres | KOP | AMIS |
| jaune — ce qui s'achète | BOOSTERS | BOUTIQUE |

Dix tuiles sans logique de rangée sont dix choses à retenir ; cinq paires en
font cinq.

### La largeur : une seule vérité, enfin

`ui.css` déclare `--colonne` depuis toujours, avec un commentaire expliquant
qu'au-delà du téléphone on centre plutôt que d'étirer. **Cette variable n'avait
aucun effet.** Chaque page écrivait sa propre largeur en dur — 440, 460 ou 520
pixels selon l'écran et le jour — soit **dix-huit largeurs dans quinze
fichiers**, et trois valeurs différentes pour la même application.

Sur une tablette, tout tenait donc dans un rail de cinq cents pixels au milieu
d'un écran noir, et élargir la variable ne changeait rien du tout.

Les dix-huit pointent maintenant sur `var(--colonne)`, qui vaut
`min(100vw, 900px)` — **sans palier**.

Il y en a eu un, à sept cents pixels : en dessous, la colonne restait à 520. Une
tablette de cinq cent soixante-dix-huit pixels tombait donc pile dans l'angle
mort — trop large pour le téléphone, trop étroite pour le palier — et gardait
trente pixels de noir de chaque côté pour rien. Un seuil qui découpe les écrans
en deux familles se trompe toujours sur ceux du milieu ; `min()` n'a pas ce
défaut.

Le plafond, lui, reste : au-delà de neuf cents pixels, une ligne de texte
dépasse la centaine de caractères et l'œil perd le début de la ligne suivante.

`admin.html` reste à mille cent, et c'est la seule exception : ce n'est pas un
écran de supporter mais un écran de gestion, et un tableau à six colonnes ne se
lit pas dans neuf cents. Elle est nommée dans `verif-pages`, avec sa raison.

Sur l'accueil, le rail suit **la colonne** et non la fenêtre :
`clamp(58px, 15,5 % de la colonne, 88px)`. Les mesurer en `vw` marchait tant que
les deux se confondaient et devenait faux dès que la colonne a cessé de remplir
l'écran — sur mille trois cents pixels, seize pour cent de la fenêtre font un
rail de deux cents dans une colonne qui en fait neuf cents.

Le plafond a d'abord été posé à 104 px, au jugé. À l'écran, les tuiles
écrasaient le personnage et le jeu ressemblait à une télécommande. À 88, les
`clamp` communs d'`ui.css` suffisent pour l'icône et le libellé : il n'y a plus
rien à forcer. **Une tuile d'accueil est un point de départ, pas la chose qu'on
regarde.**

### Deux contrôles qui n'existaient pas

`verif-pages` refuse désormais qu'une **coque de page** écrive sa largeur en
dur. Le premier jet regardait tous les `max-width` et attrapait un paragraphe
d'administration capé à six cent quarante pixels pour se lire — ce qui est
exactement ce qu'il faut faire. Une largeur de texte n'est pas une largeur de
colonne, et un contrôle qui confond les deux se fait désactiver.

`tour:ui` refait **tout le tour à 834 pixels**, la largeur d'une tablette en
portrait. Il y vérifie deux choses qui ne se voient pas autrement : que chaque
écran remplit la colonne, et qu'aucun ne déborde. Toutes les suites visitaient
le jeu à trois cent soixante pixels ; une page qui se casse à neuf cents serait
partie en ligne sans que rien ne proteste.

### Et une suite qui tombait une fois sur deux

`nvn-net-smoke` échouait par intermittence depuis qu'elle avait été remise à
jour — sept contrôles d'un coup, ou aucun. Deux causes, toutes deux dans le
test et non dans le jeu :

1. **Le souffle.** Les chants coûtent de 22 à 38, le répertoire est tiré de
   l'identifiant du duel, et selon la partie le seul chant de rythme offert
   était le plus cher. Le moteur le refusait pour `not_enough_breath`.
2. **La régularité.** Le serveur refuse les frappes de métronome — deux
   intervalles identiques à six millisecondes près valent
   `inhuman_regularity`, et il a raison. Le test ne faisait trembler que le
   tempo ; le martelage et la mesure arrivaient au métronome.

Et une troisième, plus subtile : `echo` rejoue un motif de cinq coups **tiré
par le serveur à chaque chant**. Le rejouer sans l'avoir lu donne zéro. Il est
sorti de la liste des gestes que cette suite sait fabriquer de mémoire — ce
qu'elle éprouve est le réseau, et les mini-jeux ont leurs propres suites.

Trente passes vertes d'affilée après correction.

---

## 4 tricies quater. Un seul menu, et les saisons qui s'enregistrent enfin

Quatre défauts signalés sur des captures, et tous les quatre avaient la même
forme : **rien ne cassait**. Deux menus s'ouvraient, un bouton se cliquait, un
formulaire se refermait. C'est la famille de pannes qu'aucune suite n'attrape
tant qu'on ne lui demande pas de comparer deux choses entre elles.

### Il y avait deux menus, et ils avaient divergé de six entrées

`nav.js` montait le menu sur les dix-huit pages de contenu : onze destinations
en trois rubriques, l'accueil en tête, la déconnexion en dernier. L'accueil, qui
ne charge pas `nav.js` — ses deux rails portent sa navigation — s'était écrit
**le sien**, à la main, dans son HTML.

| | menu commun | menu de l'accueil |
|---|---|---|
| destinations | 11 | 5 |
| rubriques | JOUER · MA COLLECTION · LE FOOTBALL | aucune |
| absents | — | Virage, duel, boutique, boosters, carnet, amis |
| déconnexion | sans confirmation | avec confirmation |

Un joueur qui ouvrait le menu depuis l'accueil et le rouvrait depuis le
classeur voyait deux jeux différents. C'est la **seconde vérité**, pour la
cinquième fois de ce projet, et cette fois elle portait aussi une incohérence de
sécurité : la déconnexion demandait d'un côté et pas de l'autre. Une
confirmation qui n'apparaît que sur certains écrans est pire qu'aucune — on
apprend que le jeu ne demande pas, et on cesse de lire le jour où il demande.

`public/menu.js` porte désormais la liste, les icônes, la construction du
tiroir, la confirmation de sortie, l'entrée d'administration et la pastille du
direct. `nav.js` l'appelle, l'accueil l'appelle, **et l'administration aussi** —
elle n'avait qu'un lien « retour au jeu », et un administrateur qui voulait le
kiosque devait repasser par l'accueil.

### L'entrée ADMIN était partie sans rien dire

```js
a.innerHTML = '…ADMIN';
nav.appendChild(a);        // `nav` n'existe plus depuis la barre du bas
```

`nav` était l'élément de la barre du bas, supprimée deux tours plus tôt. La
référence levait une `ReferenceError`, que le `try { … } catch { /* module
absent */ }` du bloc avalait — et **plus aucun administrateur ne voyait
l'entrée**, sans erreur en console, sans trace, sans test rouge.

Un `catch` muet autour d'un ajout facultatif est le meilleur endroit du monde
pour cacher une panne. Celui-ci a survécu à toutes les relectures parce qu'il
ressemblait à une précaution.

Au passage, l'accueil décidait de cette entrée sur `user.role === 'admin'`
pendant que les autres pages interrogeaient `estAdmin` côté serveur : deux
réponses possibles à la même question. Il n'en reste que la seconde.

### « Impossible. » — les saisons ne s'enregistraient pas

Le formulaire de saison marchait, la confirmation s'affichait, et cliquer
« Enregistrer » donnait une boîte d'alerte disant `Impossible.`

```js
const api = async (p, body, method) => { … }          // trois arguments

api(`/saison/${s.id}`, { method: 'PATCH', body: corps });   // deux…
```

Le deuxième argument est **le corps**. Ces quatre appels-ci y passaient un objet
d'options : le serveur recevait un `POST` dont le corps était
`{ method: 'PATCH', body: {…} }`, refusait sans code, et l'écran affichait le
seul message qui ne dit rien. Aucune saison n'a jamais pu être modifiée, lancée
ni supprimée depuis cet écran. Les seize autres appels de la page avaient la
bonne forme, ce qui est exactement ce qui rend la faute invisible à la
relecture.

`admin-smoke` éprouvait les routes — elles étaient bonnes. `admin-ui-smoke`
prenait une capture du formulaire — il s'affichait très bien. **Personne ne
cliquait sur Enregistrer.** Le contrôle le fait maintenant, et il relit la
base : c'est le seul endroit où « le formulaire s'est refermé » et « c'est
enregistré » ne se ressemblent pas.

### Et le serveur lançait une saison sur une requête fautive

En cherchant pourquoi la mutation du bouton « lancer » ne faisait pas tomber le
test, la vraie raison est apparue côté serveur :

```js
lancerSaison(…, req.body?.lancer !== false, …)
```

Un corps que la route ne comprend pas — champ absent, mal nommé, mal emballé —
vaut donc **lance**. C'est le pire défaut imaginable pour le geste qui ouvre du
contenu à tous les joueurs au même instant, et l'écran cassé le démontrait : il
était incapable de refermer une saison et parfaitement capable d'en ouvrir une.
`lancer` doit maintenant être un booléen, sinon `admin.error.lancer_manquant`.

### « On ne sait pas si les modifications ont été prises en compte »

C'était vrai partout, pas seulement sur les saisons. Chaque écrit se faisait en
silence : le formulaire se refermait, la liste se redessinait, et rien ne
distinguait un enregistrement réussi d'un formulaire simplement fermé.

Les réglages avaient le cas le plus net. Ils s'enregistrent **champ par champ**,
sans bouton — délibérément, parce qu'un bouton unique obligerait à deviner
lequel des vingt-six champs le serveur a refusé. Leur seul accusé de réception
vivait dans un bandeau collé en pied de liste, sous vingt-six lignes : on
touchait un champ en haut de l'écran, et rien ne bougeait là où on regardait.

Ce qui manquait n'était donc pas le bouton, mais **la réponse**. Un reçu se pose
maintenant par-dessus la page, en haut à droite, sur chaque écriture des sept
onglets, et le refus y passe en rouge avec sa raison en français. Il n'y en a
jamais qu'un : deux messages empilés se lisent comme une erreur.

### Ce qui garde tout ça

`scripts/menu-smoke.mjs` ouvre le menu **en cliquant le bouton** sur l'accueil,
sur une page de contenu et sur l'administration, pour un compte administrateur
et pour un compte ordinaire, puis compare les listes obtenues. Il ne relit pas
`menu.js` pour se donner raison : la liste des seize destinations attendues est
écrite dans le contrôle. Quatre mutations, quatre rouges — l'entrée ADMIN
retirée, l'accueil qui s'écarte, la confirmation de sortie ôtée, la page
courante qui ne se marque plus.

`verif-pages` refuse en plus une page sans `menu.js` et une page qui écrit son
propre tiroir. `admin-ui-smoke` joue le cycle complet d'une saison — brouillon,
modification, lancement, retour en brouillon, suppression — et vérifie après le
lancement que le jeu n'ouvre plus que la série cochée.

Un détail attrapé en chemin : les règles d'onglets de l'administration visaient
l'élément `nav`. Le tiroir commun est lui aussi un `<nav>`, et il héritait
`display:flex`. C'est le piège des classes sans préfixe, sur un nom de balise.

### Dix-sept lignes, et la hauteur qui ment

Le menu en portait seize et en porte dix-sept, puisque l'entrée ADMIN y arrive
enfin. Mesuré : **879 px de contenu dans 808 px de place** — « Se déconnecter »
tombait sous le bord, c'est-à-dire précisément la ligne qu'on vient chercher.
Un écart qu'on ne voit pas tant qu'on ne le mesure pas, parce que le tiroir
défile : il a l'air entier.

Trois pixels repris ligne par ligne — interligne à 1 px, lignes à 10 px de
hauteur, rubriques resserrées — et 816 px tiennent dans 818. Plus de
défilement sur un écran de neuf cents pixels.

Et `100vh` a été remplacé par `100dvh`, avec `vh` gardé au-dessus en repli.
`100vh` vaut la **plus grande** hauteur possible sur un téléphone, barre
d'adresse repliée : tant qu'elle est dépliée, un menu calculé dessus dépasse
exactement de la hauteur de cette barre. Le contrôle ne l'aurait jamais vu — un
navigateur sans interface mobile n'a pas de barre d'adresse qui bouge.

Et un affichage trompeur, corrigé : une saison lancée qui n'ouvre aucune série
laisse le jeu **toutes séries ouvertes** — c'est le cas de la saison 1 reprise —
mais sa carte affichait « Séries — », ce qui se lit comme « plus rien ». L'écran
dit maintenant, en haut, les séries ouvertes en ce moment.

---

## 4 tricies quinquies. Le classeur se tait sur ce qui n'existe pas encore

### Une promesse qu'on ne peut pas tenir n'est pas un but

Le classeur montrait **tout le catalogue publié** : deux cent quarante-sept
silhouettes grises, dont une bonne part appartient à des séries qu'aucune saison
n'a ouvertes. Un classeur est une promesse — « voilà ce qu'il y a à trouver » —
et une promesse hors de portée ne donne pas un objectif, elle donne un mur.

Elle coûtait aussi la seule chose qu'une saison a à vendre : la **surprise**.
Lancer LES VIP devant quelqu'un qui a déjà fait défiler leurs quinze silhouettes
pendant trois semaines n'annonce rien.

Les saisons étant additives, « la saison en cours et toutes celles d'avant » est
exactement la liste des séries ouvertes, que le serveur calcule déjà. La page ne
la recalcule pas — elle la lit.

**Sauf ce qu'on possède.** Refermer une série cesse de distribuer ; ça n'efface
pas les cartes de qui les a. Un filtre écrit trop vite casse ce cas en premier,
et c'est celui qui transformerait une collection en trou. Les deux moitiés ont
leur mutation et leur rouge.

### La fiche montrait le contraire de la grille

La grille affiche un Fanzzy qu'on n'a pas en silhouette grise, cadenassée.
L'ouvrir le rendait à ses couleurs, avec ses trois âges, ses effets et ses
tenues à fouiller case par case. Deux images contradictoires du même
personnage, à un doigt l'une de l'autre — et la seconde livrait précisément ce
que la première disait ne pas avoir.

Elle reste éteinte : le même `grayscale(1)` que la grille, les rangées inertes,
et la pastille du cri redevenue un simple texte — c'était le seul élément qui
répondait encore, une carte éteinte qui pousse un cri quand on la touche.

« Inerte » se mesure des deux côtés. `pointer-events:none` ferme la souris ;
sans `disabled`, la tabulation traversait toujours une rangée de quinze boutons
muets. Le premier jet n'avait que la moitié, et la suite l'a dit.

Le panneau de détail décrivait « ÂGE À VENIR » d'un personnage qu'on ne possède
à aucun âge. Il dit maintenant la seule chose qu'on veuille savoir devant une
carte grise : dans quel booster elle se tire. Le nom de la série vient du
serveur (`setNom`) — une table « TR → LA TRIBUNE » écrite dans la page aurait
été la copie de trop.

---

## 4 tricies sexies. Le catalogue illustré, et cent trois cartes muettes

### Ce que le dossier ne pouvait pas dire

`dossier.html` dit les règles, les barèmes et les chiffres. Il ne montre pas une
image, et c'est très bien : il se lit.

Il restait l'autre question — **qu'est-ce qui est dessiné**. Six cent
quarante-trois cartes, douze états par âge, trois âges par personnage, neuf
tenues : cette comptabilité ne tient dans aucune tête, et elle n'existait nulle
part. On savait « il manque des dessins ». On ne savait pas lesquels.

`catalogue.html` — `npm run catalogue` — range le catalogue **par famille**,
parce que c'est ainsi que le jeu l'emploie, et donne pour chaque personnage sa
lignée en images, ses effets, son cri, et une grille dépliable de douze états
sur trois âges. Les vignettes sont réduites à cent trente pixels et incrustées
en `data:` : la page doit s'ouvrir seule, sur une machine qui n'a pas le dépôt,
et une page qui pointe vers `/img/...` est vide partout ailleurs.

Ce qu'elle a appris du premier coup :

| | |
|---|---|
| personnages | 247 |
| premiers âges dessinés | 158 |
| à dessiner | 89 |
| avec leurs douze états | **1** |
| tenues dessinées | **1 sur 9** |

Les trois nombres que le dossier annonçait à cet endroit — « 198 personnages,
262 âges, 183 cartes » — étaient **écrits à la main**, dans un document dont
l'en-tête promet qu'il ne peut pas mentir plus longtemps qu'une commande. Ils
dataient du lot d'avant. Ils se comptent maintenant sur le disque.

### Cent trois cartes portaient un effet que personne ne pouvait lire

En confrontant la table des effets de la page à toutes les clés employées :
`modsText`, dans `public/cartes.js`, ne nommait ni `parryResist` — **cent trois
cartes** — ni `costPenalty` — dix-sept. Sur toutes, la fiche affichait la liste
des effets **sans celui-là**.

La faute est invisible par construction. La liste n'était pas vide, elle était
incomplète, et une carte qui montre deux effets sur trois a exactement l'air
d'une carte qui en a deux. Rien à l'écran ne manque, rien ne casse, aucune
console ne parle. C'est la même famille que l'entrée ADMIN avalée par un
`catch` : une absence qui ressemble à une présence.

`catalogue:test` refuse désormais qu'une clé employée par une carte ou une
pièce d'équipement reste sans phrase — et, dans l'autre sens, qu'une phrase
décrive un effet que plus rien ne porte. Le contrôle ne ramasse que ces deux
sources : les stades et les bonus de KOP portent les mêmes clés mais s'affichent
ailleurs, avec leur propre texte, et les mêler ferait rougir le contrôle pour
`pushMult`, que nulle carte ne porte. Un garde-fou qui se plaint de ce qui va
bien est un garde-fou qu'on désactive.

### Le Gamin de Devant était Le Petit Teigneux

Le doublon que le catalogue a rendu visible n'était pas seulement une affaire de
fichiers. `G1` « Le Gamin de Devant » — onze ans, premier rang, mains sur la
barrière, une lignée qui vieillit jusqu'à devenir capo — **est** `TR1` « Le
Petit Teigneux » — onze ans, la voix avant les mots, une lignée qui vieillit
jusqu'au bout du virage. Deux noms, deux histoires, deux cris, un personnage.

Le troisième âge de TR1 le disait mot pour mot sans que personne ne l'entende :
« il gueule sur un gamin de onze ans qui connaît déjà les chants ». C'était G1.

`G1` est devenu **Le Faux Départ** : celui qui lance un chant trois secondes
trop tôt, tout seul, dans le silence. Neuf fois sur dix personne ne suit ; la
dixième, la tribune part avec lui.

**Ses modificateurs n'ont pas bougé d'un chiffre** — ils dictaient déjà le
personnage, il suffisait de les lire. `perfectBonus` énorme, `breathBonus` sous
la barre : des coups d'éclat, pas de la régularité. Et au troisième âge, ses
bonus de vitesse disparaissent au profit d'une fenêtre de tempo à 1,6 et d'une
cadence ralentie de soixante millisecondes — il ne va pas plus vite en
vieillissant, il laisse plus de silence. La lignée est un apprentissage de
l'attente, et le catalogue l'écrivait déjà en nombres.

**L'identifiant ne bouge pas.** Les possessions, les decks et les tenues
référencent `G1`, `G2`, `G3` : les renommer confisquerait la carte à ceux qui
l'ont. On change qui il est, pas où il est rangé.

Ses trois dessins sont partis dans `art/_doublons/` avec un fichier qui dit
pourquoi. Ils ne sont pas effacés — un dessin coûte des crédits et une attente —
mais ils ne sont plus servis : tout ce qui est sous `public/` part en ligne, et
la carte affichait le mauvais visage. La dette passe de 167 à 170, ce qui est un
progrès : **une silhouette dit « pas encore dessiné », un visage emprunté dit
une chose fausse.**

### Deux formes, un seul contenu

`--nu` retire la coque HTML pour la publication en artefact, qui pose la sienne.
Le fichier autonome la garde : sans `<!doctype>`, un navigateur rend la page en
mode « quirks » et elle perd sa mise en page sans rien dire. Les deux formes
viennent des mêmes chaînes — sinon l'une prend du retard, et ce serait toujours
celle qu'on regarde le moins.

Un accent grave dans un commentaire CSS a refermé le gabarit de chaîne au
mauvais endroit pendant l'écriture. C'est la faute que `verif-pages` traque dans
`public/` depuis qu'elle a cassé `nav.js` deux fois ; elle se produit aussi dans
les scripts, où rien ne la guette — seule l'exécution l'a dite.

## 4 tricies septies. Dix-sept dessins rendus à leur carte

Le catalogue illustré a été écrit pour dire ce qui manque. La première chose
qu'il a dite, c'est ce qui était **en trop**.

### Le même lot livré deux fois

Dix-sept cartes `X<n>` portaient le rendu exact d'une autre carte du catalogue.
Pas « se ressemblent » : le même dessin, à moins de deux bits d'empreinte sur
soixante-quatre.

Le constat qui tranche tient en une colonne :

| | côté `X` | côté nommé |
|---|---|---|
| numéro dans `rendus.js` | **aucun** | 002, 007, 010, 019… |
| date du fichier | 6-7 septembre | 8 septembre |

Les dix-sept paires, sans exception. Le même lot a été livré deux fois : nommé à
la main d'abord, puis remis en passant par `rendus.js`, qui l'a posé sur ses
vraies cartes. Les fichiers de la première livraison sont restés, et le jeu les
servait.

`rendus.js` est la table qui fait foi — « on n'y touche plus, un numéro déjà
attribué le reste ». Le dessin appartient donc à la carte qui a le numéro. Les
dix-sept fichiers `X` sont partis dans `art/_doublons/`, et leurs âges
supérieurs ont perdu leur repli avec eux : la dette passe de 167 à 217.

**Elle n'a pas augmenté, elle vient d'être comptée juste.** Cinquante cartes
affichaient le visage de quelqu'un d'autre ; elles affichent maintenant une
silhouette, qui dit « pas encore dessiné » au lieu de dire une chose fausse.

Le seuil des jumeaux passe à **zéro**, et ce n'est plus un cliquet mais une
règle : deux cartes ne peuvent pas montrer le même rendu. Le jour où une
livraison en réintroduit une, `images:test` rougit avant que personne ne l'ait
vue.

### Cinq personnages écrits deux fois

Le dessin partagé cachait autre chose. Sur les dix-sept paires, cinq n'étaient
pas seulement un fichier mal rangé : **c'était le même personnage, écrit deux
fois**, jusqu'au bout de sa lignée.

| avant | doublait | devenu |
|---|---|---|
| `X7` Le Trieur de Doubles | `TR2` Le Collectionneur — les deux lignées finissent sur l'album complet | **Celui Qui Reste** |
| `X30` Le Videur | `BG21` L'Orang-outan en Costume — « il n'a jamais eu à se lever », mot pour mot | **Le Drapeau Perdu** |
| `X32` La Mascotte Casquée | `BG20` L'Abeille de Chantier — casque jaune, panneau, personne ne l'écoute | **Le Marteau-Piqueur** |
| `X39` La Cagoule Rose | `TR5` La Cagoule Timide — la cagoule au secret tendre, et les deux finissent en peluche | **Le Carré à l'Envers** |
| `X48` Le Gosse qui Boude | `TR13` Le Bébé Vainqueur — l'enfant à la coupe, et les deux finissent entraîneur des petits | **La Note Qui Casse** |

Quinze textes réécrits, base et âges. **Aucun chiffre n'a bougé** : ni la
famille, ni la série, ni la rareté, ni les modificateurs, ni le geste, ni la
puissance. L'équilibre du jeu est exactement celui d'avant — seule l'identité
change, et l'identifiant reste, parce que les possessions le référencent.

Les douze autres paires étaient bien douze personnages différents qui portaient
le même dessin par accident. Leur carte n'avait rien à changer.

### Deux collisions de texte, trouvées en chemin

`BG15` et `BG27` s'appelaient tous les deux **« Le Chat du Terrain »**, dans la
même série : la commune et la légendaire du même chat. Un classeur qui affiche
deux fois la même ligne fait croire à un doublon, et on cherche ce qu'on a raté.
La légendaire raconte un moment précis — neuf minutes d'arrêt de jeu, quatre
stadiers à quatre pattes — et s'appelle désormais **« Les Neuf Minutes »**.

`X49` criait **« DE MON TEMPS »** exactement comme `TR12`, et `VP1` **« UN PEU
DE TENUE »** comme `BG11`. Le cri est ce qui s'affiche en gros sur la fiche :
deux fiches au même cri se lisent comme une seule carte vue deux fois. Les
personnages, eux, étaient distincts — seuls les cris ont changé.

`catalogue:test` refuse maintenant deux cartes de même nom, et deux
**personnages** de même cri. Les âges supérieurs sont hors de ce second
contrôle, et seulement de celui-là : un cri fait trois mots, et sur deux cent
soixante-douze âges « MAINTENANT » finit par se croiser sans que ce soit une
faute.

### Ce que cette famille de fautes a en commun

Rien n'était cassé. Les images existaient, chacune valide, chacune au bon
endroit du disque. `images:test` comptait deux dessins et il avait raison. Les
noms se lisaient, les cris se criaient.

C'est la signature de tout ce qu'on a trouvé dans ce tour : **une absence qui
ressemble à une présence**. L'entrée ADMIN avalée par un `catch`. Onze effets
nommés sur treize. Un âge « pas dessiné » au-dessus de ses douze états. Deux
cartes, un visage.

Aucune ne se voit en relisant du code, parce qu'il n'y a rien d'anormal à lire.
Toutes se voient en **comparant deux choses entre elles** — ce qu'une page qui
met tout côte à côte fait pour rien, et ce qu'aucun humain ne fait sur cent
soixante-dix-huit dessins.

## 4 tricies octies. Un identifiant qui dit sa série

### Cent dix-neuf cartes portaient un préfixe étranger

`V1` « Choriste », `G1`, `F1`, `X23` : tous dans LA TRIBUNE, et rien dans leur
identifiant ne le disait. Pour qui range des dessins, écrit `rendus.js` ou
cherche une carte, c'étaient cent dix-neuf occasions de se tromper.

Le plan se calcule (`npm run prefixes`), il ne s'écrit pas. Il refuse de tourner
si une destination existe déjà ou si une carte hors série n'est rattachée à
aucune lignée — un plan qui écrase une carte vivante est pire que pas de plan.

**Les âges suivent en suffixe, pas en numéro.** `V1` devient `TR32`, ses âges
`TR32B` et `TR32C` — pas `TR33` et `TR34`, qui laisseraient croire à trois
personnages. Sept lignées écrivaient encore leurs âges en entrées numérotées ;
seuls leurs **identifiants** changent. Les convertir à la table `AGES` aurait
recalculé leurs modificateurs par formule et fait passer `G1B` de 1,45 à 1,7 de
geste parfait sans que personne ne l'ait demandé. Un renommage qui rééquilibre
le jeu au passage est un renommage dont on ne relit plus le diff.

### Ce qu'un identifiant touche vraiment

Six tables, plus le **JSON** de `user_decks.contenu`. Rater une seule place,
c'est effacer une carte de la collection de quelqu'un.

`sql/prefixes.sql` les fait toutes dans une transaction, par **table de
correspondance** : huit instructions au lieu des neuf cent cinquante-deux du
premier jet, qu'aucun humain n'aurait relues. C'est le motif de `stades.sql`.

Elle se rejoue sans dommage, et c'est nécessaire : le catalogue s'amorce en
`INSERT IGNORE` au démarrage, donc un serveur qui démarre avec le code neuf
**avant** la migration a deux lignes pour la même carte. Le `DELETE` d'ouverture
retire la ligne neuve du catalogue au profit de l'ancienne, qui porte les
possessions. Et si un compte détient les deux identifiants — cas qui n'existe
que sur une base déjà passée au code neuf — les exemplaires **s'additionnent**
et le stade le plus haut l'emporte. Perdre un doublon serait discret et
définitif.

### Le second trou : `INSERT IGNORE` ne sait pas corriger

Le catalogue vit en base parce qu'il s'édite depuis l'administration, et
s'amorce en `INSERT IGNORE` pour ne pas écraser ces corrections. La contrepartie
n'était écrite nulle part : **changer le nom, l'histoire ou le cri d'une carte
existante dans le code ne change rien du tout.**

Les dix-neuf réécritures du tour précédent — Le Faux Départ, Celui Qui Reste,
Les Neuf Minutes — n'auraient jamais atteint le jeu. `npm run identites` compare
le code à une base réelle et produit `sql/identites.sql` : un `UPDATE` par carte
divergente, et rien d'autre. Pas de réécriture en masse — elle effacerait les
corrections faites à l'écran, qui sont la raison d'être de cette table.

`publie` est délibérément hors du rapprochement : c'est le seul champ que
l'administration décide, et le resynchroniser depuis le code annulerait le
retrait d'une carte.

Les deux migrations sont dans l'ordre d'application des **deux** scripts qui
doivent toujours s'accorder — c'est cette paire qui avait divergé le 8 septembre.

### Le renommage a démasqué un contrôle aveugle

`catalogue:test` vérifiait qu'un âge garde le geste de son personnage. Son
helper `racine(id)` prenait `^([A-Z]+\d+)` — qui avale l'identifiant entier
quand l'âge s'écrit `T2`. Il comparait donc T2 avec lui-même, et **passait au
vert sur exactement les lignées qu'il avait été écrit pour surveiller**.

Devenus `MS31B` et `MS32B`, ils ont rougi le jour même : le Colleur d'affiches
jouait `tifo` et ses deux âges `tri` ; l'Auto-stoppeur jouait `echarpe` et ses
âges `memoire`. Un joueur qui faisait grandir son personnage perdait le geste
qu'il avait appris.

La leçon n'est pas sur les gestes : **un raccourci d'identifiant dans un contrôle
peut le rendre aveugle à son propre sujet**, sans rien casser et sans jamais
rougir.

### Trois suites nommaient une carte en dur

`accueil:ui`, `fanzzy:ui` et `matchs:ui` écrivaient `'G1'` comme « le Fanzzy
illustré ». Ce dessin est parti — il montrait quelqu'un d'autre — et quatorze
contrôles sont devenus rouges en annonçant un défaut du jeu là où il n'y avait
qu'une hypothèse périmée dans le test.

Elles demandent maintenant **au disque** et au manifeste : un personnage
réellement dessiné, d'une lignée que le compte ne possède pas déjà, et pour
`matchs:ui` un qui sache faire « but », « encaisse » et « victoire ».

Un défaut plus subtil s'y cachait. `matchs:ui` lisait `FICHE.scene.etat()` après
l'apparition du bandeau, et ne passait que parce que le Fanzzy d'essai n'avait
**aucune image d'état** : sans rien à jouer, la scène restait sur l'état logique
indéfiniment. Avec un personnage dessiné, elle joue son but et revient au repos
bien avant la lecture. On **attend** l'état au lieu de le lire — « il est passé
par là », qui est la vraie promesse : un but fait tressaillir le personnage, il
ne le fige pas.

---

## 4 tricies novies. La gloire des légendaires, et neuf communes

### Une légendaire se voit

Elle avait un halo doré, un anneau fin et huit pastilles. C'était juste, et ça
ne se voyait pas : à la taille d'une vignette de classeur, un anneau à trente
pour cent d'opacité sur du noir est du noir. Une légendaire tombe une fois sur
vingt boosters, et le décor ne le disait pas.

Ce qui le dit, c'est **la gloire** — vingt-quatre rayons en éventail derrière le
personnage, d'opacité alternée. L'alternance suffit à donner l'impression que la
lumière tourne **sans une seule animation**, ce qui compte : ce décor est dessiné
vingt fois sur une grille, et vingt rotations feraient ramer la page pour un
effet que personne ne regarde.

S'y ajoutent un anneau double et vingt éclats semés par la graine du personnage —
deux légendaires n'ont pas la même poussière, et c'est ce qui empêche le décor de
se lire comme un gabarit.

Le ciel est **mêlé** d'or, pas remplacé : une légendaire des REVENANTS garde son
violet de nuit, une des ÉPOQUES son ocre. Un ciel doré identique pour les douze
séries effacerait la série au moment précis où la carte est la plus regardée.

Premier jet trop fort : les rayons allaient jusqu'aux coins et noyaient le lieu.
Raccourcis de 96 à 72, opacité descendue d'un tiers, et le stade réapparaît sous
la lumière.

### Cinquante contre dix

LA TRIBUNE comptait quarante et une communes jouables — quarante-neuf au
catalogue, dont huit dépubliées parce qu'elles refaisaient un personnage du lot
de 2026 — en face de dix légendaires.

Neuf de plus la portent à cinquante : **TR60 à TR68**, et non les huit trous
laissés par les dépubliées. Un numéro attribué le reste ; le reprendre ferait
deux cartes différentes sous un même identifiant à un an d'intervalle.

Leurs gestes sont choisis pour ne pas déséquilibrer les familles — le geste
éponyme doit rester majoritaire chez chacune et aucune variante ne doit tomber
sous un huitième, ce que `catalogue:test` vérifie. Deux Voix en tempo, une
Percussion en martelage contre une en salves, et ainsi de suite.

Il a attrapé une collision au passage : `ATTENTION DERRIÈRE` a remplacé
`PARDON, PARDON`, déjà crié par L'Élan des Travées.

Vingt-sept cartes avec leurs âges, et la dette d'illustrations passe de 217 à
244. Pour une fois ce n'est pas une correction : **c'est du contenu ajouté**, et
c'est la seule autre raison admissible de relever ce cliquet.

---

## 5. Ce qui reste à faire

Par ordre d'utilité.

1. **Dessiner les quarante-quatre lignées des cinq séries neuves**, puis les
   trente et une légendaires de septembre 2026. Dans cet ordre, et pas dans
   l'autre : un âge supérieur sans dessin tombe sur celui de son premier âge,
   donc **quarante-quatre dessins en effacent cent trente-deux** là où
   trente et un dessins de légendaires n'en effacent que trente et un.

   Deux cent quarante-quatre cartes sont en rendu procédural. `images:test`
   tient le compte à chaque passage, et son seuil est un cliquet : il ne monte
   que si on le décide, et chaque relèvement porte sa raison en commentaire.

   **Le détail, dessin par dessin, est dans `catalogue.html`** — `npm run
   catalogue`, publié en artefact, avec un filtre par série. C'est là qu'on voit
   lesquels manquent, et non plus seulement combien : **cent seize personnages
   sur deux cent cinquante-six** attendent leur premier âge.

   Le compte a monté deux fois sans qu'un dessin soit perdu. D'abord de
   quatre-vingt-neuf à cent sept : dix-huit cartes affichaient le visage d'une
   autre, et une silhouette dit « pas encore dessiné » là où un visage emprunté
   disait une chose fausse (4 tricies septies). Puis à cent seize, avec les neuf
   communes neuves de LA TRIBUNE (4 tricies novies).

   Reste ensuite, à plus long terme, à dessiner les âges **pour de bon** : voir
   un personnage vieillir est ce que le jeu promet, et le repli montre le bon
   personnage sans montrer son âge.

   Et les **états** : douze par âge, et ils n'existent que pour **un seul**
   personnage (TR1). Les deux cent quarante-six autres jouent leur image de
   repos dans les douze situations — un but et une défaite leur donnent le même
   visage. Même remarque pour les **tenues** : neuf existent dans le jeu, une
   seule est dessinée.

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

Quatre sortes de dessins, quatre chaînes. Celle des Fanzzy d’abord, qui est
la plus ancienne et la plus exigeante ; les trois autres — cartes d’action,
équipement, stades — sont décrites à la fin.

Le jeu attend deux fichiers par Fanzzy, en trois formats chacun : un plein pied
`ID.{avif,webp,png}` en 520×945 pour la fiche, et un buste `ID-buste.*` en
320×320 pour le classeur. Fond transparent.

**Ce n'est plus à faire à la main.** `scripts/fanzzy-images.mjs` exécute toute
la chaîne. Nomme chaque rendu du nom du Fanzzy et lance :

```bash
npm install --no-save sharp
node scripts/fanzzy-images.mjs <dossier-des-rendus>
```

`X9.png` produit les six fichiers de `X9`. `sharp` n'est pas en
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
