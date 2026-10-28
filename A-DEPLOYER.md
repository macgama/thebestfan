# À déposer sur Infomaniak

**Plus de Fanzzy RP et SU clignent** (branche `claude/project-thread-j17xyz`,
28 octobre 2026, demandé par Gaël). Construction seule, **sans schéma** :
des images et des réglages, sans crédits.

- RP de base : 5 âges de plus (84 sur 95). Skins RP : 40 âges de plus.
- SU « Die Kurve » de base : 35 âges de plus (69). Skins SU : 138 sur 244
  (aucun avant).

---

**Les équipes nationales en français aussi sur la page CLUBS** (branche
`claude/project-thread-ycfmy5`, 28 octobre 2026, demandé par Gaël : dans
« Ajouter un club », la Suisse restait « Switzerland »). Construction seule,
**sans schéma**.

- « suisse » (ou « schweiz », « svizzera », « suiza ») trouve la sélection
  dans « Ajouter un club », écrite dans la langue du joueur ; les matchs des
  clubs suivis, les matchs du jour et le Virage écrivent aussi les sélections
  dans sa langue.
- Après la mise en ligne : sur le S24+, page CLUBS, chercher « suisse ».

---

**Les images Ultimate des Terraces** (branche `claude/project-thread-z4jtwl`,
28 octobre 2026, demandé par Gaël). Construction seule, **sans schéma**.

- 180 images plein cadre, une par Fanzzy AN et par âge, chacune avec un fond
  tiré de l'histoire du Fanzzy. La grande scène Ultimate les montre à la
  place du dessin fait avec la carte (pas encore de clip animé pour AN).
- Après la mise en ligne : déclencher l'Ultimate d'un Fanzzy AN en duel, ou
  ouvrir sa carte Ultimate dans la collection.

---

**Classement des clubs : les neutres comptent, et TRIBUNES suit la saison**
(branche `claude/project-thread-2v1fvo`, 28 octobre 2026, demandé par Gaël :
que les matchs joués pour un club qu'on ne suit pas rapportent un peu à ce
club). Construction seule, **sans schéma**.

- Un joueur qui pousse un club qu'il ne suit pas lui apporte un dixième de
  sa ferveur classée, au Virage comme au duel classé, à l'onglet TRIBUNES et
  dans les compétitions (pas aux KOP). Il ne compte pas parmi les supporters.
- La moyenne se divise par les supporters **actifs** (les comptes fermés ne
  comptent plus), et par au moins 5.
- TRIBUNES compte la saison en cours, comme SUPPORTERS : il repart au
  lancement de chaque saison.
- Deux réglages dans /admin, section LE GRAND VIRAGE : « Un neutre apporte au
  club qu'il pousse » (0,1) et « La moyenne d'une tribune se divise par au
  moins » (5).
---

**Le club principal qui se change, et la sélection principale** (branche
`claude/project-thread-rftsbq`, 28 octobre 2026, choix de Gaël : changer
une fois par saison, plus une sélection nationale). Construction, puis
**schéma** : `npm run schema:appliquer` en SSH (`sql/principal.sql`, trois
colonnes, aucune table), puis redémarrage.

- Profil, MES CLUBS : bouton PRINCIPAL ? sur un club suivi, MA SÉLECTION sur
  une sélection suivie ; une confirmation, puis plus de changement avant la
  saison suivante (le premier choix, au paquet de bienvenue, ne compte pas).
- Le PLEIN CLUB marche aussi dans les matchs de la sélection principale.
- Sans le schéma, rien ne casse : le bouton répond que ce n'est pas branché.
- Après la mise en ligne : sur le profil, changer de club principal, puis
  vérifier qu'un second changement est refusé jusqu'à la saison suivante.

---

**Les Fanzzy en skins Halloween, Préhistorique et Apocalyptique clignent**
(branche `claude/project-thread-j17xyz`, 28 octobre 2026, demandé par Gaël).
Construction seule, **sans schéma** : des images et des réglages.

- Âges RP et AN qui clignent (aucun avant) : Halloween 159, Préhistorique
  154, Apocalyptique 136, sur 258 par skin. Paupières tirées de la figure
  « yeux fermés » des planches, sans crédits.

---

**Les pièces de club des Terraces** (branche `claude/project-thread-rftsbq`,
28 octobre 2026, demandé par Gaël). Construction seule, **sans schéma**.

- 40 pièces d'équipement, deux par club de la série AN, **fermées** tant que
  leur dessin n'est pas fait (/admin CONTENUS les compte : écrites, dessinées,
  ouvertes).
- COMBO : une pièce de club portée par un Fanzzy du même club voit son revers
  divisé par deux. PLEIN CLUB : dans un match de ton club principal, chacune
  rapporte +15 % d'écharpes ou de ferveur. Réglages `stuff.club_revers` et
  `stuff.club_gain` (LE GRAND VIRAGE).
- Après la mise en ligne : rien à voir tant qu'aucune pièce n'est ouverte ;
  la fiche d'un Fanzzy AN de ton club en dit un mot au toucher du tampon.

---

**Où jouer, sur MATCHS et COMPÉTITIONS** (branche
`claude/project-thread-6dydyn`, 28 octobre 2026, demandé par Gaël : voir sur
ces pages qu'un Virage est ouvert ou qu'un duel attend, et y aller d'un
appui). Construction seule, **sans schéma**.

- Sous chaque match : pastille verte VIRAGE quand la tribune est ouverte
  (pendant le match et la demi-heure avant), avec « 12 EN TRIBUNE » quand
  des supporters poussent ; pastille violette DUEL « 1 T'ATTEND » quand
  quelqu'un attend un adversaire. Un appui mène au Virage du match, ou au
  duel avec le format et la tribune qui manque déjà choisis. Le reste de la
  ligne ouvre toujours la fiche.
- Sur MATCHS, un filtre À JOUER à côté de TOUS / MES CLUBS / EN DIRECT.
- Les pastilles se relisent toutes les 20 s (`/api/virage/a-jouer`,
  mémoire seule) et tout de suite quand une file de duel bouge.
- Comment jouer : une ligne « Où jouer ». Cinq langues.
- Après la mise en ligne : pendant un match, ouvrir MATCHS et une
  compétition, voir la pastille VIRAGE et la toucher ; avec un second compte
  en file de duel, voir la pastille DUEL apparaître sans recharger.

---

**Série SU « Die Kurve » (Super League suisse)** (branche
`claude/project-thread-8di81x`, 28 octobre 2026, demandé par Gaël).
Construction seule, **sans schéma**.

- 36 Fanzzy (trois par club), trois âges, qui clignent ; dos de carte SU.
- 244 skins sur 324 (Halloween, Préhistorique, Apocalyptique) ; un skin
  manquant montre la tenue de base. Liste des 80 à refaire :
  fanzzy-prompts/SU-generation/skins-manquants.md.
- Pour l'ouvrir aux joueurs : /admin, onglet des Fanzzy, cocher la série SU.
- Ultimate SU : pas encore (après le 2 novembre).

---

**Six légendaires dans LES TERRACES** (branche `claude/project-thread-qn6nh1`,
28 octobre 2026, demandé par Gaël). Construction seule, **sans schéma**.

- AN61 La Dame des Falaises Blanches, AN62 Le Chevalier à la Croix Rouge,
  AN63 Le Bouledogue au Grand Tambour : liées aux équipes nationales
  d'Angleterre (hommes, femmes, espoirs), bonus de lien dans leurs matchs.
- AN64 La Tisseuse des Vingt Écharpes, AN65 La Voix des Résultats, AN66 Le
  Rouge-Gorge du Lendemain de Noël : liées au championnat anglais, bonus de
  lien dans chaque match de championnat du club qu'on soutient.
- Elles sortent du booster LES TERRACES au taux des légendaires (2 %).
- Leurs 18 skins (Halloween, Préhistorique, Apocalyptique) sont toutes
  dessinées : les six dernières (AN61, AN62 préhistorique, AN65 Halloween et
  apocalyptique) suivent dans une seconde fusion, images seules.
- Elles clignent des yeux dans 19 tenues sur 24 (images seules).
- Après la mise en ligne : ouvrir la fiche d'une des six (collection) et
  lire le tampon « LIÉ À ».

---

**/admin complété, et une saison ne ferme plus rien** (branche
`claude/project-thread-g68rqt`, 28 octobre 2026, demandé par Gaël : vérifier
que l'admin suit les nouveautés et que personne ne perd rien à une nouvelle
saison). Construction seule, **sans schéma**.

- SAISONS : « Lancer la saison » à la main garde ouvertes toutes les séries
  déjà ouvertes (avant, lancer la Saison 2 aurait laissé HC seule en
  booster). La confirmation le dit.
- JOUEURS : un bouton « Collection » montre ce que le joueur possède (Fanzzy
  par série, skins, cartes Ultimate, équipement, stades, amis, KOP) et permet
  de lui offrir un Fanzzy, un skin, une carte Ultimate ou une pièce.
- Nouvel onglet KOP : chercher, renommer ou supprimer un KOP (ses membres ne
  perdent rien). L'onglet TENUES s'appelle maintenant SKINS.
- Après la mise en ligne : dans /admin, JOUEURS, ouvrir « Collection » sur
  son propre compte de test et s'offrir un Fanzzy.
---

**Jouer entre amis : les sept idées** (branche `claude/project-thread-hl4hic`,
28 octobre 2026, demandé par Gaël : que les amis puissent jouer ensemble,
s'entraider et communiquer sans texte). **Avec schéma** : nouveau fichier
`sql/amis-ensemble.sql` (quatre tables, accord de Gaël). Après la
construction, en SSH : `npm run schema:appliquer`, puis redémarrer. Sans
cela, le site tourne quand même : la fiche d'un ami dit « en pause », les
gestes, cadeaux, échanges et prêts ne partent pas, et /healthz le signale.

- Dans AMIS, chaque ami porte JOUER ENSEMBLE, qui ouvre sa fiche : gestes
  (une liste fermée, jamais de texte), cadeau du jour (écharpes offertes par
  le jeu), défi de la semaine (chants au Virage à deux), échange de doubles,
  prêt d'un Fanzzy jusqu'à minuit, sa collection, son deck, ses souvenirs.
- Au Grand Virage, chaque ami visible dans ta tribune ajoute 3 % à ta
  poussée (3 amis au plus). Un ami hors ligne ne compte pas.
- La page AMIS dit ce que l'amitié ouvre ; QUESTIONS a une rubrique « Les
  amis », Comment jouer une ligne « Jouer ensemble ». Réglages dans /admin,
  section ENTRE AMIS (tout peut s'éteindre).
- Après la mise en ligne : avec deux comptes amis, envoyer un geste, offrir
  le cadeau, emprunter un Fanzzy et le mettre dans le deck, proposer un
  échange et l'accepter de l'autre côté.

---

**17 Fanzzy de plus clignent en tenue de base** (branche
`claude/project-thread-j17xyz`, 28 octobre 2026, demandé par Gaël).
Construction seule, **sans schéma** : des images et des réglages.

- 222 âges de base RP et AN sur 275 clignent (205 avant).

---

**L'onglet EN ATTENTE sur la page du duel** (branche
`claude/project-thread-sxsj06`, 28 octobre 2026, choix de Gaël : « un bouton
de plus "Duel en attente de joueur" », toujours là). Construction seule,
**sans schéma**.

- À côté de MES CLUBS et TOUS LES MATCHS : EN ATTENTE, avec le nombre de
  duels qui attendent un joueur (grisé à 0). Un appui choisit le match, le
  format et la tribune qui manque ; traduit dans les cinq langues, et ajouté à
  /comment-jouer.
- Après la mise en ligne : sur le PC, entrer en file ; sur le S24+, ouvrir
  DUEL, l'onglet doit dire 1, puis un appui sur EN ATTENTE.

---

**Voir ce que la réconciliation du catalogue ferait** (branche
`claude/contenus-sql-q1sziv`, 28 octobre 2026, pour les 338 écarts relevés par
Gaël). Il se dépose avec ce qui est en dessous, ou seul.

- `scripts/fanzzy-reconciliation.mjs`, `npm run reconciliation:voir` : en SSH,
  il dit, sans rien écrire, quelles cartes le démarrage reprendrait du code et
  lesquelles ont été corrigées à l'écran (celles-là restent telles quelles).
  `src/server/fanzzy/catalogue.js` : le démarrage lit son plan par la même
  fonction, sans rien changer à ce qu'il fait.

**Aucun schéma ni réglage, sans redémarrage** (le script se lance à la main).

---

**Les duels qui attendent se voient sans recharger** (branche
`claude/project-thread-sxsj06`, 28 octobre 2026, demandé par Gaël : il
fallait rafraîchir la page pour savoir que quelqu'un attendait un duel).
Construction seule, **sans schéma**.

- Sur l'accueil, « Quelqu'un t'attend » s'allume (et s'éteint) dans les dix
  secondes, et le sticker du duel du menu aussi sur les autres pages.
- Après la mise en ligne : sur le PC, entrer en file d'un duel ; sur le S24+,
  rester sur l'accueil sans recharger, le bandeau doit venir tout seul.

---

**MES SAISONS sur le profil** (branche `claude/project-thread-chiok9`,
28 octobre 2026, demandé par Gaël : garder l'historique des saisons d'avant).
Construction seule, **sans schéma**.

- Sous MA SAISON, un bloc MES SAISONS montre une ligne par saison finie : la
  place au classement de la saison, la division portée, les tampons du
  carnet, la ferveur et les titres gagnés. Il n'apparaît qu'à partir de la
  Saison 2 : avant, rien à montrer.

---

**Chercher un ami par pseudo dans AMIS, onglet TROUVER** (branche
`claude/project-thread-hl4hic`, 28 octobre 2026, demandé par Gaël : on ne
pouvait ajouter que des supporters des mêmes clubs). Construction seule,
**sans schéma**.

- Une case « CHERCHER UN JOUEUR » en haut de TROUVER : trois lettres au moins,
  le début du pseudo, huit noms au plus ; AJOUTER envoie la demande d'ami.
  Ni les clubs ni l'adresse de la personne ne s'affichent.
- Après la mise en ligne : sur le S24+, chercher le pseudo d'un testeur qui
  ne suit pas tes clubs et lui envoyer une demande.

---

**La page Questions à jour** (branche `claude/project-thread-7ad2lr`,
28 octobre 2026, demandé par Gaël). Construction seule, **sans schéma**.

- L'onglet QUESTIONS des missions répond maintenant sur l'Ultimate, les
  Fanzzy liés à un club, les légendaires du deck, les duels qui attendent,
  inviter un ami, le duel guidé, les mini-jeux, le pronostic, la saison, le
  carnet, la collection, les cartes-souvenirs, la résiliation du PASS, la
  musique et « Signaler un problème », dans les cinq langues. La réponse
  sur le PASS est corrigée (deux clubs de plus, et les plafonds sans PASS).
- Comment jouer : la musique, le rayon ULTIMATE et « Signaler un problème ».
- Après la mise en ligne : ouvrir /aide, onglet QUESTIONS.

---

**Les équipes nationales dans la recherche « TON CLUB »** (branche
`claude/project-thread-ycfmy5`, 28 octobre 2026, demandé par Gaël : il a dû
taper « Switzerland » pour trouver la Suisse). Construction seule, **sans
schéma**.

- « Suisse », « Schweiz », « Svizzera », « Suiza » trouvent la sélection, en
  tête, et elle s'affiche dans la langue du joueur ; de même pour tous les
  pays, dont ceux que l'API écrit autrement (Turquie, États-Unis, Tchéquie,
  Côte d'Ivoire, RD Congo…) et l'Angleterre, l'Écosse, le pays de Galles,
  l'Irlande du Nord.
- Après la mise en ligne : sur le S24+, chercher « suisse » au premier écran
  d'un compte de test.

---

**Les sons de l'ouverture des boosters, version tribune** (branche
`claude/project-thread-1xxwfz`, 27 octobre 2026, demandé par Gaël : les
anciens n'étaient « pas du tout gaming » ni supporters ; validés à l'écoute).
Construction seule, **sans schéma**.

- Les quatre jingles de rareté sont refaits : fanfare de tambours et de
  cuivres sous la clameur d'une tribune, de plus en plus fort de la commune
  à la légendaire.
- Le paquet qui tremble, et l'entrée de chaque sorte de carte (Fanzzy,
  expression, tenue, équipement, stade, carte action, écharpes), ont
  maintenant de vrais bruits de tribune (grosse caisse, « hey », drapeau,
  rambarde, projecteurs, torche, chant).
- Après la mise en ligne : sur le S24+, ouvrir deux ou trois boosters, son
  allumé.

---

**Les Fanzzy clignent des yeux** (branche `claude/project-thread-j17xyz`,
27 octobre 2026, demandé par Gaël). Construction seule, **sans schéma** :
des images et des réglages, aucun code du jeu.

- 32 Fanzzy RP et AN de plus clignent au premier âge, et 114 âges 2 ou 3
  clignent aussi (44 RP, 70 AN ; yeux fermés pris dans les planches, sans
  crédits).
- Après la mise en ligne : regarder quelques secondes un Fanzzy RP ou AN à
  l'âge 2 ou 3 sur l'accueil, il doit cligner.

---

**Les animations restent dans la largeur du téléphone sur ordinateur**
(branche `claude/project-thread-9p4wm0`, 27 octobre 2026, demandé par Gaël).
Construction seule, **sans schéma**.

- Ouverture des boosters, fonds filmés (but, évolution, fin de duel, carton),
  Ultimate, écharpe du club, ondes et éclats, bilan, fête de niveau, vestiaire
  et affiche du duel : tout se joue dans la colonne de 480 px, et les fonds
  filmés prennent la largeur de la colonne au lieu d'être étirés et flous.
  Sur téléphone, rien ne change.

---

**Le numéro de version monte à chaque mise en ligne** (branche
`claude/project-thread-wy11c4`, 27 octobre 2026, demandé par Gaël).
Construction seule, **sans schéma**.

- Le bas du menu disait toujours « version bêta — 0.0200 ». Désormais le
  serveur compte ses mises en ligne au démarrage (un commit qu'il n'avait pas
  encore vu = +1) : la prochaine mise en ligne affiche 0.0201, la suivante
  0.0202, etc. Un simple redémarrage ne change rien. Le compte est gardé dans
  la table `reglages` (clé `version.livraisons`), que la remise à zéro garde.
- Après la mise en ligne : ouvrir le menu, le bas doit dire 0.0201.

---

**La musique du jeu** (branche `claude/project-thread-qfzgoq`, 27 octobre
2026, demandée par Gaël : « The Final Turn », sa création). Construction
seule, **sans schéma**.

- La boucle (0:00 à 0:50 du morceau) joue sur les pages « normales » :
  l'accueil, les Fanzzy, la collection, le deck, les boosters, la boutique,
  le football, les amis, le profil, le compte, les missions. Jamais au duel,
  au Virage ni aux mini-jeux. Elle part au premier toucher sur la page et
  reprend d'une page à l'autre où elle en était.
- Le grand moment (1:11 à 1:40) joue au bilan d'un duel gagné.
- Menu : « Couper la musique », dans le pied, à côté de « Se déconnecter ».
  Couper les sons la coupe aussi ; le volume la règle avec le reste.
- Après la mise en ligne : sur le S24+, toucher l'accueil, ouvrir deux ou
  trois pages, puis gagner un duel.

---

**L'Ultimate ne se voit qu'avec sa carte** (branche
`claude/project-thread-0u99uq`, 27 octobre 2026, demandé par Gaël).
Construction seule, **sans schéma**.

- Collection, vitrine d'une carte Ultimate à gagner : plus de bouton VOIR
  L'ULTIMATE, seulement le chemin du booster. VOIR LA GRANDE SCÈNE reste sur
  une carte gagnée.
- Fiche : la plaque ULTIMATE d'une carte pas encore gagnée montre un cadenas
  et BOOSTER ; la toucher dit où la trouver, sans jouer la scène.

---

**Le nom du Fanzzy ouvre sa fiche** (branche `claude/project-thread-5rpxvz`,
27 octobre 2026, demandé par Gaël). Construction seule, **sans schéma**.

- Sur l'accueil, toucher le nom sous le personnage (« LA REINE DE LA
  MACHINE ») ouvre la fiche de ce Fanzzy, à l'âge montré : les flèches
  changent l'âge, et le lien le suit.

---

**L'Ultimate visible sur la fiche et dans la collection** (branche
`claude/project-thread-0u99uq`, 27 octobre 2026, demandé par Gaël).
Construction seule, **sans schéma**.

- Fiche d'un Fanzzy : une plaque ULTIMATE à droite de la carte, au-dessus du
  bouton qui la retourne, avec sa vignette ; à l'or et « TA CARTE » quand la
  carte Ultimate de l'âge regardé est gagnée, « BOOSTER » sinon. La toucher
  joue la scène (la grande si la carte est gagnée). La colonne ULTIMATE de
  la bande passe juste après ÂGES : elle n'est plus coupée au bord droit.
- MA COLLECTION : un septième rayon ULTIMATE, à l'or, sur toute la largeur.
  Une carte par âge atteint de chaque Fanzzy possédé, les gagnées d'abord ;
  la vitrine propose VOIR LA GRANDE SCÈNE (ou VOIR L'ULTIMATE) et VOIR SA
  FICHE. Les cartes Ultimate ne comptent pas dans les paliers de
  collectionneur (les crans ne bougent pas).
- Une carte Ultimate gagnée montre son image Ultimate (RP pour l'instant)
  au lieu de la pose « pousse », dans l'album et à l'ouverture d'un booster.
- Après la mise en ligne : ouvrir la fiche d'un Fanzzy RP, puis MA
  COLLECTION, rayon ULTIMATE.

---

**Équilibrage des duels et du Virage** (branche `claude/project-thread-esqp0e`,
27 octobre 2026, propositions acceptées par Gaël après la simulation des
parties). Construction seule, **sans schéma**.

- Virage : Mosaïque et Présentation de l'effectif comptent la part de la
  tribune qui pousse, plus le nombre ; Chœur et Appel ne se lancent qu'une
  fois par tribune, avec une recharge partagée. Un petit club tient tête au
  FC Barcelone (3 contre 20 : 39 à 1 en simulation).
- Le bot d'entraînement fait le geste de sa carte : un débutant le bat à
  peu près six fois sur dix. Le duel guidé ne change pas.
- Filet de chantier : 12 s pendant lesquelles les entraves d'en face
  (Silence, Brouillard, Parcage, Vent contraire…) ne te touchent pas ; duel
  seulement. Les bonus Contre, Parade, Reprise et Pénalité des Fanzzy
  comptent enfin.
- Tifo réussi à 60 % de ce que la tribune peut peindre en une semaine ; boss
  à 8 chants par supporter, au moins 8 (était 40). Si /admin avait gardé 40
  à la main, le remettre.
- Après la mise en ligne : un duel contre un bot depuis /jeux ou l'accueil.

---

**Un kop de Fanzzy au chargement, et le bas de l'accueil au-dessus des
boutons du téléphone** (branche `claude/project-thread-fttg4d`, 27 octobre
2026, demandé par Gaël). Construction seule, **sans schéma**.

- L'écran de chargement montre un kop : des rangs de Fanzzy jouables qui
  sautent derrière leurs barrières, la tribune du stade au loin (le tunnel
  est parti). Seulement les séries ouvertes (aujourd'hui RP et AN), lues au
  serveur (`/api/fanzzy/jouables`) : une saison qui ouvre une série la met
  dans le kop toute seule.
- Les visages « Les supporters à collectionner » de la page d'accueil ne
  montrent plus que des Fanzzy jouables.
- Depuis l'icône du S24+, la page d'accueil (non connecté), le chargement
  et l'accueil connecté gardent 52 px au-dessus des trois boutons du
  téléphone quand Chrome ne dit pas leur hauteur.
- Après la mise en ligne : fermer l'application, la rouvrir depuis l'icône
  du S24+ et regarder les trois écrans ; le bas de l'accueil (PRENDRE MA
  PLACE, Duel de tribunes) doit se voir en entier.

---

**L'affiche du duel en face-à-face, et l'Ultimate en gros bouton rond**
(branche `claude/project-thread-4kawd4`, 27 octobre 2026, demandé et validé
par Gaël). Construction seule, **sans schéma** (une page et les traductions).

- L'affiche avant le duel : les deux camps entrent par les côtés (or chez
  moi, bleu en face), celui qui entre en grand dans sa pose de poussée, le
  banc en deux cartes, le VS qui claque au gong, un compte à rebours 3-2-1.
- Au duel, l'ULTIMATE est un bouton rond au bout de la rangée de l'équipe
  (anneau qui se remplit, tout or quand il est prêt) ; le « i » de
  l'équipement passe au coin haut gauche de l'arène.
- Après la mise en ligne : un duel contre un bot, regarder l'affiche puis le
  bouton se remplir.

---

**L'Ultimate, le coup fatal des Fanzzy** (branche `claude/project-thread-epar0c`,
26 octobre 2026, choix de Gaël : « Visuel à collectionner »). Construction
puis redémarrage, **sans schéma** (la carte se range dans `user_etats`).

- Au duel et au Virage, chaque chant BON remplit la jauge d'un point, un
  PARFAIT de deux. Pleine, le bouton ULTIMATE s'allume : le geste de la
  spécialité du Fanzzy, une fois par partie, une grosse poussée qui grandit
  avec l'âge (la Relève au duel). Son nom est le cri de l'âge.
- Tout le monde l'a, avec la même puissance. La carte Ultimate d'un âge (4 %
  des places ouvertes des boosters, prises sur les actions) débloque la
  grande scène et se range dans la fiche du Fanzzy, rang ULTIMATE.
- Réglages dans /admin → RÉGLAGES → LA COMPOSITION DU DECK : points pour la remplir (8),
  puissance (70), bonus par âge (25 %).
- Après la mise en ligne : un duel contre un bot, chanter juste jusqu'à
  ULTIMATE PRÊT, lancer le coup ; puis ouvrir une fiche, rang ULTIMATE.
- Ajout du même jour (demande de Gaël) : un son propre à l'Ultimate (une
  montée jusqu'au choc, puis l'impact), et la grande scène plein cadre,
  animée au code, pour les images Ultimate d'Artlist. Elle ne se voit
  qu'une fois les images branchées (`npm run ultime:images`) ; d'ici là, la
  scène dessinée avec la carte reste.

---

**Pastilles des demandes d'ami et de KOP sur l'accueil** (branche
`claude/project-thread-iiydep`, 26 octobre 2026, demandé par Gaël).
Construction seule, **sans schéma**.

- Une demande d'ami met son nombre en violet sur la case AMIS de l'accueil,
  une invitation dans un KOP sur la case KOP (et dans le menu, comme
  BOOSTERS). La page du KOP montre l'invitation et mène aux DEMANDES des
  amis, où l'on répond.
- Après la mise en ligne : demander Gaël en ami depuis le compte de test, ou
  l'inviter dans un KOP, et regarder l'accueil du S24+.

---

**La poussée du cri compte enfin** (branche `claude/project-thread-08684b`,
26 octobre 2026, demandé par Gaël). Construction seule, **sans schéma**.

- Au duel et au Virage, le chant du geste du Fanzzy en tribune pousse la
  « poussée du cri » de sa fiche au lieu de celle de la carte (jamais moins
  que la carte). Le coût ne change pas, les autres chants non plus.
- Au duel, ce nombre suit la Relève : la lignée de la Reine de la Machine pousse 54 au
  premier âge, 67 au deuxième, 80 au troisième. Au Virage, c'est le premier
  âge (le barème du Virage suit la racine).
- La carte de ce chant affiche la nouvelle poussée, et « Comment jouer » le
  dit, dans les cinq langues.

---

**Les rangées qui défilent de côté, à la souris** (branche
`claude/project-thread-q1kuwq`, 26 octobre 2026, demandé par Gaël).
Construction seule (le Manager redémarre de lui-même), **sans schéma**.

- Sur ordinateur, toutes les rangées qui débordent à droite (âges, effets,
  états et tenues de la fiche d'un Fanzzy, onglets des albums, jours des
  matchs, onglets du télétexte, séries des boosters, cabine de la boutique…)
  se font défiler à la molette, en les attrapant à la souris, ou avec deux
  flèches qui apparaissent à côté de la rangée survolée. Le bord s'efface du
  côté où il reste quelque chose à voir. Rien ne change au doigt.
- Après la mise en ligne : sur l'ordinateur, ouvrir la fiche d'un Fanzzy et
  passer la souris sur la rangée ÂGES, EFFETS, ÉTATS.

---

**Les 51 équipements sans image ont leur dessin** (branche
`claude/project-thread-9swbtr`, 26 octobre 2026, demandé par Gaël).
Construction seule, **sans schéma**.

- Télécommande, Flûte de champagne, Cornet de frites… : les 51 pièces des
  séries VP, GC, GD, MT, HC et la boîte à souvenirs s'affichaient sur une
  tribune vide. Leurs dessins étaient déjà dans `art/stuff/` depuis le 18
  octobre, mais jamais détourés : c'est fait, en trois formats.
- Le détourage reconnaît aussi un fond vert assombri vers les coins (le
  canapé, le fauteuil et l'éventail gardaient un disque vert).

---

**La fin du duel guidé réparée** (branche `claude/project-thread-ok4tcv`,
25 octobre 2026, demandé par Gaël). Construction seule (le Manager redémarre
de lui-même), **sans schéma**.

- Après le duel guidé, la flèche de retour et le bouton retour du téléphone
  mènent à l'accueil, et non plus à « Tu n'as pas encore de place » : la
  cérémonie d'accueil et le formulaire d'inscription ne restent plus dans
  l'historique, et un joueur déjà inscrit qui repasse sur /bienvenue part
  sans la voir.
- La gerbe d'un but (feu d'artifice) s'éteint au bout de trois secondes au
  lieu de rester figée par-dessus tout le duel.
- La consigne de l'épreuve écrit « **et** » en gras, sans astérisques (La
  Visée, Le Contretemps…).
- Après la mise en ligne : sur le S24+, créer un compte de test, jouer le
  duel guidé jusqu'au bout, puis toucher la flèche en haut à gauche.

---

**La remise à zéro pour la Saison 1** (branche `claude/project-thread-0tjnbf`,
25 octobre 2026, demandé par Gaël). Rien ne change sur le site : c'est un
script que Gaël lance **lui-même**, une fois, en SSH, **après** la mise en
ligne de tout main (construction, schéma, redémarrage) et hors d'un match.

- `cd ~/sites/thebestfan.online && npm run saison1:essai` : il montre ce qui
  sera vidé, les abonnements Stripe à résilier et les nouvelles dates des
  saisons, sans rien toucher.
- `npm run saison1:remise`, puis taper `SAISON 1` : sauvegarde complète dans
  `~/sauvegardes/`, abonnements Stripe résiliés, comptes joueurs et tout ce
  qui est à eux supprimés (les comptes admin restent, remis à neuf), saison 1
  lancée à l'instant jusqu'au 31 mars 2027 avec un carnet de tampons recalé
  sur sa durée (seuils × jours / 63), saisons suivantes repoussées d'un
  trimestre.
- Puis redémarrer dans l'onglet Node.js, et se reconnecter : le paquet de
  bienvenue revient.

---

**Signaler un problème** (branche `claude/project-thread-hsgz8a`,
25 octobre 2026, demandé par Gaël). Construction seule (le Manager redémarre
de lui-même), **sans schéma**.

- Dans le menu de toutes les pages, sous « Comment jouer » : « Signaler un
  problème ». Le joueur écrit son message ; il part en mail aux comptes
  administrateurs (ou à `SIGNALEMENTS_A` si cette variable est posée), avec la
  page, l'écran, le navigateur, la langue et la version. Répondre au mail,
  c'est répondre au joueur. Cinq par heure et par joueur.
- Après la mise en ligne : envoyer un signalement depuis ton téléphone et
  vérifier qu'il arrive dans ta boîte.

---

**Accueil : la bâche du club retirée** (branche `claude/project-thread-v83ym1`,
25 octobre 2026, demandé par Gaël : « trop d'information sur la page »).
Construction seule, **sans schéma**. Les soirs de match, il ne reste que la
fumée aux couleurs du club derrière le Fanzzy.

---

**Le menu réordonné** (branche `claude/project-thread-inbro1`, 25 octobre
2026, demandé par Gaël). Construction seule, **sans schéma**.

- JOUER : La répétition vient juste après Les mini-jeux.
- Mon deck quitte JOUER pour MA COLLECTION, juste après Mes Fanzzy.

---

**Deux correctifs avant les bêta-testeurs** (branche
`claude/project-thread-hsgz8a`, 25 octobre 2026, demandé par Gaël).
Construction puis **redémarrage** (le serveur change), **sans schéma**.

- Le paquet de bienvenue donne toujours deux Fanzzy dessinés : un nouvel
  inscrit pouvait recevoir comme avatar un Fanzzy sans image (une silhouette).
- Duel qui attend : sur le Chrome actuel, quitter la page ne libérait pas la
  place pendant une quarantaine de secondes, et l'ami invité lançait le duel
  contre une tribune vide. La page coupe maintenant sa connexion en partant.
- Après la mise en ligne : créer un compte de test et ouvrir le paquet.

---

**La marque des championnats à Fanzzy, et le cri et le son des autres clubs**
(branche `claude/project-thread-v83ym1`, 25 octobre 2026, demandé par Gaël ;
un son Artlist, 376 crédits, avec son accord). Construction seule, **sans
schéma**.

- Matchs du jour : le bloc de la Premier League porte une écharpe aux
  couleurs des TERRACES, le tampon de la série, trois visages de Fanzzy qui
  se relaient et « Ce championnat a ses Fanzzy et ses cris » ; sous chaque
  match, le cri des clubs anglais.
- Page de la Premier League : un bandeau avec les 20 clubs, leurs trois
  Fanzzy et leur cri, qui mène à la série dans la collection.
- Un Fanzzy lié à un club hors série pousse un cri type (huit cris, toujours
  le même pour un club) et joue un son type de tribune avec l'écharpe.
- Après la mise en ligne : ouvrir les matchs du jour un jour de Premier
  League, puis la page de la Premier League.

---

**Cartes et fiches des Fanzzy, et le bas de l'écran sur Android** (branche
`claude/project-thread-g9hq66`, 25 octobre 2026, demandé par Gaël).
Construction puis **redémarrage** (le serveur envoie l'histoire de chaque âge),
**sans schéma**.

- 56 bustes et portraits refaits sur le visage : le Car, le Briquet, la
  Bannière (RP28), le Robot (RP29), la Théière (AN46), la Cabane (AN47), la
  Cabine (AN51), la Rhubarbe (AN53), le Crabe (BG5), le Bocal (RV1).
- Les cartes épiques ne sont plus voilées par leur reflet holo.
- La fiche d'un Fanzzy dit son histoire, sous la carte.
- Depuis l'icône du téléphone, le bas des écrans ne passe plus sous les
  boutons d'Android.
- Après la mise en ligne : rouvrir le jeu depuis l'icône (accueil, Mon
  Fanzzy, une fiche) et vérifier que le bas se voit ; ouvrir le Car Remisé
  dans le classeur.

---

**Le son et l'éclat d'un club** (branche `claude/project-thread-v83ym1`,
25 octobre 2026, demandé par Gaël ; vingt sons Artlist, 7 520 crédits, avec
son accord). Construction seule, **sans schéma**.

- Un Fanzzy lié qui joue le match de son club : quand ta tribune fait céder
  la corde, ou que ton club marque, son écharpe traverse l'écran à ses deux
  couleurs, avec un son de sa ville (sirène de navire pour Liverpool, orgue
  de manège pour Brighton…) : les 20 clubs de la série AN. Virage et duel.
- Après la mise en ligne : un Virage ou un duel d'un match d'un club anglais,
  avec un Fanzzy lié à ce club.

---

**La carte commune a son animation** (branche `claude/project-thread-nk6bu3`,
25 octobre 2026, demandé par Gaël ; fond filmé Artlist, 252 crédits, avec
son accord). Construction seule, **sans schéma**.

- Au booster, une commune qui se retourne lève une onde de craie, de la
  poussière et des confettis de papier, sur une explosion de craie filmée
  (plus discrète que les fonds des rares).
- Après la mise en ligne : ouvrir un booster et regarder une commune.

---

**Notifications : ton club, son Virage, tes amis** (branche
`claude/project-thread-dxjvy4`, 25 octobre 2026, demandé par Gaël).
**Avec schéma** : `npm run schema:appliquer` (trois colonnes ajoutées à
`notif_appareils` dans `sql/notifications.sql`), puis redémarrage.

- Trois cases de plus dans le Compte, allumées sur les appareils déjà inscrits :
  mon club joue dans 30 minutes ; le Virage d'un match de mon club s'ouvre (au
  coup d'envoi) ; mes amis (une demande, un oui, une invitation en duel).
  Jamais la nuit, jamais le nom d'un joueur.
- Jeu ouvert : la notification devient un bandeau dans la page ; les demandes
  d'ami en attente mettent un chiffre violet sur « Mes amis » dans le menu.
- Après la mise en ligne : ouvrir le Compte et voir les cinq cases.

---

**Les joueurs passent seuls à la dernière version** (branche
`claude/project-thread-s0yr76`, 25 octobre 2026, demandé par Gaël).
Construction puis **redémarrage** (le serveur change), **sans schéma**.

- Chaque page porte l'empreinte du jeu qui l'a servie, calculée par le
  serveur à son démarrage. Une page restée ouverte (l'application du
  téléphone qu'on rouvre, un onglet oublié) la compare à celle du serveur à
  l'ouverture, au retour au premier plan et toutes les cinq minutes : si le
  jeu a changé, un écran « MISE À JOUR DU JEU » la recouvre une seconde et
  elle se recharge. Un joueur en train d'écrire n'est pas coupé.
- `/healthz` dit enfin le commit en ligne (`version`, lu dans `.git`) et
  l'empreinte servie (`construction`) ; `/api/version` aussi, pour la seconde.
- Après la mise en ligne : ouvrir `/healthz` ; `version` doit être le dernier
  commit de main. Un téléphone resté sur le jeu doit se recharger seul.

---

**Encore plus vivant : holo, carte vers sa fiche, série, classement** (branche
`claude/project-thread-nk6bu3`, 24 octobre 2026, demandé par Gaël).
Construction seule, **sans schéma**, sans un crédit Artlist.

- Les cartes de la vitrine et de la fiche suivent aussi le téléphone qu'on
  incline (Android ; sur iPhone, le doigt seul, comme avant).
- Dans FANZZY, la carte touchée s'envole vers sa fiche (Chrome, Edge ;
  ailleurs la fiche s'ouvre comme avant).
- Au Virage, la série de PARFAITS chauffe (3, 5, 10), un « ×N » jaillit à
  chaque PARFAIT de plus, et tous les cinq la tribune fait la ola.
- Au classement, quand tu as gagné des places depuis ta dernière visite,
  ta ligne remonte en doublant les autres et un « +N » vert jaillit.
- Après la mise en ligne : ouvrir une carte dans FANZZY ; faire cinq PARFAITS d'affilée au Virage.

---

**Fanzzy RP redessinés** (branche `claude/project-thread-tf95wg`, 24 octobre 2026,
demandé par Gaël). Images seules : construction, ni schéma ni redémarrage.

- RP3 : `public/img/fanzzy/RP3` et ses cartes (B et C comprises) : nouveau dessin
  aux trois âges (invites v2 : fanfare puis roi de la batucada), cinq états
  par âge ; pas encore de clignement.
- RP4 : nouveau dessin aux trois âges (moine batteur, puis maître du temple de montagne), cinq états par âge, cartes B et C. Cartes RP4 et RP4B redessinées sans la barrière.
- RP5 : nouveau dessin aux trois âges (mécène de sa rangée, puis roi de sa tribune), cinq états par âge, cartes B et C.
- RP6 : nouveau dessin aux trois âges (héritière de la troisième rangée, puis cheffe de tribune avec le fantôme de son père), cinq états par âge, cartes B et C.
- RP7 : nouveau dessin aux trois âges (graffeur, puis titan du street art), cinq états par âge, cartes B et C.
- RP8 : nouveau dessin aux trois âges (costume de cubes colorés, puis roi des cubes au carton rouge), cinq états par âge, cartes B et C.
- RP9 : nouveau dessin aux trois âges (artificier en tablier, puis maître du feu), cinq états par âge, cartes B et C.
- RP10 : nouveau dessin aux trois âges (horloger aux montres, puis maître du temps), cinq états par âge, cartes B et C.
- RP11 : nouveau dessin aux trois âges (steward en uniforme, puis capitaine au gouvernail), cinq états par âge, cartes B et C.
- RP12 : nouveau dessin aux trois âges (explorateur polaire, puis roi des glaces), cinq états par âge, cartes B et C.
- RP21 : nouveau dessin aux trois âges (forgeron, puis pivert en armure de forge), cinq états par âge, cartes B et C.
- RP22 : nouveau dessin aux trois âges (aviateur aux bras mécaniques, puis cuirassé de cuivre), cinq états par âge, cartes B et C.
- RP23 : nouveau dessin aux trois âges (barrière couronnée, puis reine des tribunes), cinq états par âge, cartes B et C.
- RP24 : nouveau dessin aux trois âges (chien en gilet de chantier, puis chef de meute en armure), cinq états par âge, cartes B et C.
- RP20 : nouveau dessin aux trois âges (station radar, puis astronaute aux ailes solaires), cinq états par âge, cartes B et C.
- RP25 : nouveau dessin aux trois âges (grillage couvert de lierre, puis arbre-gardien de la tribune), cinq états par âge, cartes B et C.
- RP26 : nouveau dessin aux trois âges (siège de stade, puis trône royal), cinq états par âge, cartes B et C.
- RP27 : nouveau dessin aux trois âges (pile de cartons, puis champion en origami), cinq états par âge, cartes B et C.
- RP28 : nouveau dessin aux trois âges (drapeau rayé, puis étendard impérial à l’aigle), cinq états par âge, cartes B et C.
- RP29 : nouveau dessin aux trois âges (drone aux cartons, puis drone cuirassé), cinq états par âge, cartes B et C.
- RP30 : nouveau dessin aux trois âges (salamandre en sweat, puis baroudeur de lave, puis chevalier draconique à flamme bleue), cinq états par âge, cartes B et C.
- RP31 : nouveau dessin aux trois âges (petit nuage d’orage, puis tornade électrique, puis titan de l’orage), cinq états par âge, cartes B et C.
- RP33 : nouveau dessin aux trois âges (pigeon voyageur, puis aviateur, puis as ailé aux ailes de métal), cinq états par âge, cartes B et C.
- RP34 : nouveau dessin aux trois âges (vieux bus, puis bus de voyage chargé, puis bus festif à banderoles), cinq états par âge, cartes B et C.
- RP32 : nouveau dessin aux trois âges (briquet bandana, puis briquet costaud à flamme vivante, puis génie de flamme), cinq états par âge, cartes B et C.
- RP35 : nouveau dessin aux trois âges (fantôme supporter en salopette, puis contrôleur du car fantôme, puis capitaine spectral à la lanterne), cinq états par âge, cartes B et C.

---

**L'accueil et la montée de niveau animés** (branche
`claude/project-thread-nk6bu3`, 24 octobre 2026, demandé par Gaël).
Construction seule, **sans schéma**, sans un crédit Artlist.

- L'accueil : les tuiles se posent l'une après l'autre à l'arrivée ; toutes
  les dix secondes environ, des flashs de photographes crépitent dans la
  tribune, un projecteur balaie la scène ou un reflet passe sur PRENDRE MA
  PLACE ; la pastille de niveau saute après une montée.
- La fête de niveau : l'or filmé de la victoire et les rayons derrière la
  case, et le nouveau niveau qui claque.
- Après la mise en ligne : rester une minute sur l'accueil ; réclamer une
  mission qui fait monter de niveau.

---

**Le jeu plus vivant : vestiaire, fins de duel, évolutions, buts**
(branche `claude/project-thread-nk6bu3`, 24 octobre 2026, demandé par Gaël).
Construction puis redémarrage, **sans schéma**.

- Le vestiaire du duel devient un couloir de stade (projecteurs, fumée, VS
  entre les tribunes, une place qui se remplit s'allume).
- Fin de duel et fin du Virage : la victoire claque sous les confettis et
  l'or filmé, la défaite tombe de travers sous la pluie, le nul hésite.
- Une évolution vers l'âge 2 ou 3 a son fond filmé et ses rayons ; un but
  pour soi, sa gerbe filmée ; un carton rouge au Virage est brandi.
- Après la mise en ligne : entrer en file d'un duel, puis le finir ; faire
  évoluer un Fanzzy.

---

**LES TERRACES : AN6 à AN60, cinquante-cinq Fanzzy de plus, la série complète** (branche
`claude/serie-fanzzy-angleterre-k0bgzs`, 24 et 25 octobre 2026, demandé par Gaël).
Construction puis redémarrage, **sans schéma**.

- AN6 La Timide du Grand Boulevard (Percussion, bleu roi et blanc), AN7 La
  Coursière à Vélo (Déplacement, bleu ciel), AN8 Le Gamin au Dinosaure en
  Plâtre (Tifo, rouge et bleu), AN9 La Danseuse aux Grelots (Percussion,
  bleu et blanc), AN10 Le Banlieusard au Parapluie (Fidélité, blanc et
  noir), AN11 La Ramendeuse du Port (Pyro, ambre et noir), AN12 La Gamine
  au Moulinet (Tifo, bleu et blanc), AN13 Le Gamin à la Batte (Fidélité,
  blanc, jaune et bleu), AN14 Le Gamin au Cheval-Bâton (Déplacement, rouge
  et blanc), AN15 Le Petit Livreur de Lait (Voix, bleu ciel et blanc), AN16
  Le Gamin aux Gants Trop Grands (Percussion, rouge, blanc et noir), AN17 Le
  Gamin au Pion (Fidélité, noir et blanc), AN18 Le Gamin à l'Arc en Bois
  (Pyro, rouge et blanc), AN19 Le Gamin du Fauteuil Tournant (Voix, rouge
  et blanc), AN20 Le Gamin aux Boutons (Tifo, marine et blanc), AN21 La
  Petite Poinçonneuse (Voix, rouge et blanc), AN22 La Gamine à la Bague en
  Fer-Blanc (Pyro, bordeaux et bleu ciel), AN23 La Gamine au Ballon Rouge
  (Pyro, rouge et noir), AN24 La Gamine à la Burette (Percussion, rouge et
  blanc), AN25 Le Gamin au Petit Train (Déplacement, bleu et blanc), AN26
  Le Gamin au Masque de Carton (Tifo, bleu roi et blanc), AN27 Le Gamin à
  la Montre Démontée (Voix, bleu ciel et blanc), AN28 La Gamine au Cierge
  Magique (Percussion, rouge et bleu), AN29 Le Petit Allumeur (Fidélité,
  bleu et blanc), AN30 La Petite Fouilleuse de Vase (Déplacement, blanc et
  noir), AN31 Le Gamin au Jeton de Manège (Percussion, ambre et noir), AN32
  Le Gamin à la Truelle (Déplacement, bleu et blanc), AN33 La Gamine à la
  Motte d'Argile (Tifo, blanc, jaune et bleu), AN34 La Choriste de la Cave
  (Voix, rouge et blanc), AN35 La Gamine au Ruban Perforé (Pyro, bleu ciel
  et blanc), AN36 La Petite Bobineuse (Fidélité, rouge, blanc et noir), AN37
  La Gamine au Pipeau (Voix, noir et blanc), AN38 La Gamine à la Lampe de
  Poche (Déplacement, rouge et blanc), AN39 La Gamine à la Bille (Pyro,
  rouge et blanc), AN40 La Gamine au Cerf-Volant (Tifo, bleu marine et
  blanc), puis les premières créatures : AN41 La Petite Boîte aux Lettres
  (Fidélité, rouge et blanc), AN42 La Petite Plume d'Acier (Tifo, bordeaux
  et bleu ciel), AN43 Le Petit Écureuil Roux (Percussion, rouge et noir),
  AN44 La Petite Perruche (Voix, rouge et blanc), AN45 Le Petit Galet
  (Pyro, bleu et blanc), AN46 La Petite Théière (Fidélité, bleu roi et
  blanc), AN47 Le Petit Chariot de Théâtre (Déplacement, bleu ciel et
  blanc), AN48 Le Chaton de Concours (Voix, rouge et bleu), AN49 Le Petit
  Phoque Gris (Percussion, bleu et blanc), AN50 La Petite Anguille (Pyro,
  blanc et noir), AN51 La Petite Cabine Crème (Déplacement, ambre et noir),
  AN52 La Petite Loutre (Fidélité, bleu et blanc), AN53 La Petite Tige de
  Rhubarbe (Percussion, blanc, jaune et bleu), AN54 La Petite Marmite
  (Pyro, rouge et blanc), AN55 La Petite Tarte (Tifo, bleu ciel et blanc),
  AN56 Le Petit Terrier (Voix, rouge, blanc et noir), AN57 Le Petit Macareux
  (Percussion, noir et blanc), AN58 La Petite Oie (Déplacement, rouge et
  blanc), AN59 Le Petit Ver du Puits (Tifo, rouge et blanc), AN60 Le Petit
  Pigeon Voyageur (Fidélité, bleu marine et blanc) : trois cartes chacun,
  les expressions des trois âges, le clignement à l'âge 1 (sauf AN44, AN46,
  AN47, AN51, AN53, AN54 et AN56), et leurs textes dans les cinq langues.
  Le redémarrage écrit leurs cent soixante-cinq cartes dans le catalogue en
  base (`INSERT IGNORE`, rien d'autre ne bouge). La série passe de vingt à
  soixante lignées (trois Fanzzy par club, demandé par Gaël le 21
  octobre) : les soixante sont dans le jeu, dix dans chacune des six
  familles.
- La série reste **fermée** tant qu'aucune saison lancée ne la nomme : rien
  à faire de plus, ils s'ouvriront avec elle.
- Après la mise en ligne : /collection, série LES TERRACES, ouvrir AN6 à
  AN60 et vérifier leurs trois âges (les cartes et les expressions), puis
  qu'ils clignent des yeux au premier âge. AN44 ne cligne pas encore des
  yeux (sa figure yeux fermés porte le bonnet, son repos le tient à la
  main), ni AN46, AN47, AN51, AN53 et AN54 (leurs yeux sont trop bas sous
  le bonnet, le toit, la feuille ou le couvercle pour la boîte du
  clignement), ni AN56 (ses yeux sombres sur le poil noir ne se distinguent
  pas assez des paupières).
- Planches refaites (25 octobre) : les expressions d'AN9, AN22, AN26, AN29
  et AN35 au premier âge, d'AN17, AN38 et AN41 au deuxième et d'AN57 au
  troisième viennent de nouvelles planches, les cinq expressions au complet
  (plus d'état qui reste au repos, plus de signes effacés sur AN57), et les
  cinq du premier âge clignent avec de nouvelles paupières ; images seules,
  rien de plus que la construction et le redémarrage ci-dessus.

---

**Toutes les cartes et épreuves du duel au son de tribune** (branche
`claude/sons-fid6tr`, 24 octobre 2026, générés dans Artlist avec l'accord
de Gaël). Construction seule, **sans schéma ni redémarrage**.

- Au duel, les 39 cartes et les 24 épreuves jouent un son tiré de vidéos
  Artlist (Veo) à la place de leur bruitage fabriqué, qui reste le repli
  (le Fumigène, l'Arbitre et le Chœur d'abord, puis les 60 autres).
- Les sons se chargent au premier geste sur une page de duel (environ
  1 Mo en tout), jamais en mode calme ni en économie de données.
- Après la mise en ligne : jouer quelques cartes et une épreuve de rythme
  au duel, son allumé.

---

**Les jingles et les fonds filmés des boosters** (branche
`claude/project-thread-nk6bu3`, 24 octobre 2026, générés dans Artlist avec
l'accord de Gaël). Construction puis redémarrage, **sans schéma**.

- Quand une carte se retourne, un court jingle joue selon sa rareté
  (commune, rare, épique, légendaire), à la place du son synthétisé ; un
  tourbillon violet passe derrière une épique, une gerbe d'or derrière une
  légendaire. Rien ne se télécharge en mode calme ni en économie de données.
- Après la mise en ligne : ouvrir un booster, son allumé, et écouter.

---

**L'ouverture des boosters en spectacle** (branche
`claude/project-thread-nk6bu3`, 24 octobre 2026, demandée par Gaël).
Construction puis redémarrage, **sans schéma**.

- Le paquet tombe et tremble dans la couleur de sa meilleure carte ; une
  épique se soulève avant de se retourner, une légendaire une seconde, la
  salle éteinte. Chaque sorte de carte a son geste, son mot sous la carte
  et son bruit (Fanzzy, expression, tenue, équipement, stade, carte action,
  écharpes).
- Après la mise en ligne : ouvrir un booster sur le téléphone, son allumé,
  et toucher les cartes une à une.

---

**Lier un Fanzzy neutre à son club** (branche `claude/project-thread-v83ym1`,
22 octobre 2026, choix de Gaël). Construction, **schéma** (`sql/fanzzy.sql`
ajoute la colonne `user_fanzzy.club_id`), puis redémarrage.

- Sur la fiche d'un Fanzzy neutre qu'il possède, le joueur voit LIER À MON
  CLUB (120 écharpes) : le Fanzzy est lié pour toujours à son club principal
  et gagne le même bonus qu'un Fanzzy AN dans les matchs de ce club. Sans
  club principal, la fiche lui dit de le choisir dans « Mes équipes ».
- Le prix se règle dans /admin → RÉGLAGES → L'ÉTAL EN ÉCHARPES.
- Sans le schéma, rien ne casse : le bouton refuse, et personne n'a de lien
  acheté.
- Après la mise en ligne : avec un compte qui a un club principal et 120
  écharpes, ouvrir la fiche d'un Fanzzy TR, LIER À MON CLUB, puis vérifier le
  tampon LIÉ À TON CLUB.

---

**Les Fanzzy liés à un club** (branche `claude/project-thread-v83ym1`,
21 octobre 2026, demandés par Gaël). Construction puis redémarrage, **sans
schéma**.

- Un Fanzzy de LES TERRACES (AN1 à AN60, trois par club) est lié au club dont
  il porte les couleurs. Joué dans un match de son club (un club que le joueur
  suit et qui joue), il pousse 5 % plus fort, au Virage comme au duel, et
  rapporte 10 % de plus : la ferveur au Virage, les écharpes au duel quand le
  titulaire est lié. Un neutre, un Fanzzy à thème : rien ne change.
- La fiche d'un Fanzzy lié porte un tampon, « LIÉ À TON CLUB » (vert) ou
  « LIÉ À UN CLUB » (bleu, un club que le joueur ne suit pas) ; le toucher
  explique le bonus. **Jamais le nom du club.** Le panneau des bonus du duel
  et du Virage montre une ligne « Ton club », le bilan du duel « FANZZY LIÉ ».
- Les deux taux se règlent dans /admin → RÉGLAGES → LE GRAND VIRAGE
  (« Un Fanzzy lié à son club… »). À 0, le lien ne fait plus rien.
- Après la mise en ligne : ouvrir la fiche d'AN1 avec un compte qui suit son
  club, puis avec un autre ; vérifier les deux tampons.

---

**La série LES TERRACES (AN), fermée** (branche
`claude/serie-fanzzy-angleterre-k0bgzs`, 20 octobre 2026, demandée par Gaël).
Construction puis redémarrage, **sans schéma**.

- Cinq Fanzzy anglais aux trois âges (AN1 à AN5), avec leurs cartes, leurs
  cinq états par âge, le clignement à l'âge 1, le dos de carte de la série et
  leurs textes dans les cinq langues. Le redémarrage est nécessaire : c'est
  au démarrage que les quinze cartes neuves s'écrivent dans le catalogue en
  base (`INSERT IGNORE`, rien d'autre ne bouge).
- **La série arrive fermée** : aucun booster ni kiosque ne la distribue tant
  qu'aucune saison lancée ne la nomme. Le classeur la montre comme les autres
  séries fermées.
- Pour l'ouvrir, quand tu veux, sans livraison : /admin → LE CONTENU →
  SAISONS → sur la carte « Saison 1 — La reprise » (lancée), **Modifier** →
  cocher **LES TERRACES** dans « SÉRIES — elles s'ouvrent » → **Enregistrer**.
  Elle s'ouvre à l'instant pour tout le monde (la ligne « SÉRIES OUVERTES EN
  CE MOMENT » la montre). La décocher et enregistrer la referme.
- Après la mise en ligne : /admin → SAISONS, vérifier que LES TERRACES ne
  figure **pas** dans « SÉRIES OUVERTES EN CE MOMENT ».

---

**Le premier duel guidé** (19 octobre 2026, demandé par Gaël). Construction
puis redémarrage, sans schéma.

- Après le sachet de bienvenue, JOUER MON PREMIER DUEL : trois minutes sur un
  match fictif (L'Académie contre Les Anciens), contre un bot lent, avec trois
  bulles qui montrent quoi faire (chanter, la corde, une carte d'action). Il
  ne rapporte rien et ne compte nulle part ; il se rejoue depuis « Comment
  jouer » (`/duel-nvn?tuto=1`). Il ne se perd pas : le bot ne marque
  jamais, et une fin à son avantage devient un nul.
- Après la mise en ligne : ouvrir `/duel-nvn?tuto=1` et suivre les bulles.

---

**Les mentions légales, les conditions, et les premiers pas d'un débutant**
(19 octobre 2026, demandés par Gaël). Construction puis redémarrage, sans
schéma.

- Deux pages publiées : `/mentions-legales` (éditeur, adresse, hébergeur,
  prestataires) et `/conditions` (conditions d'utilisation et de vente :
  abonnement, résiliation, remboursement sur demande sous quatorze jours,
  accord d'un parent avant 18 ans, droit suisse). Liens en pied de menu, sur
  la vitrine, à l'inscription, sur `/abonnement` et en boutique.
- « Prendre ma place » ouvre l'inscription ; l'arrêt « duel » de la visite
  guidée éclaire la bonne tuile ; l'aide s'ouvre sur PREMIERS PAS tant
  qu'ils ne sont pas finis ; un seul mot, « âge », partout pour l'évolution.
- Après la mise en ligne : ouvrir `/mentions-legales` et `/conditions`, et
  vérifier les liens en bas du menu.

---

**Le bouton Accueil sur toutes les pages** (19 octobre 2026, demandé par
Gaël). Construction puis redémarrage, sans schéma.

- Une maison juste à côté de la flèche, en haut de chaque page de contenu :
  un toucher ramène à l'accueil. Pas sur l'accueil lui-même, ni sur le
  Virage et le duel, où la flèche ramène déjà à l'accueil après la
  confirmation qui protège la partie. Les titres longs de la barre se
  resserrent pour ne pas être coupés.

---

**Deux bugs : le duel figé après sa fin, et l'accueil des non-connectés**
(19 octobre 2026, signalés par Gaël). Construction puis redémarrage, sans
schéma.

- Un joueur dont le téléphone décrochait au coup de sifflet restait bloqué
  sur un duel terminé. Il reçoit maintenant son bilan à son retour (gardé dix
  minutes), sinon un écran « Duel terminé » avec « Revenir ».
- Un raté passager de la base faisait passer un joueur connecté pour un
  visiteur : l'accueil montrait l'écran des non-connectés. La lecture de
  session est réessayée, le serveur répond « indisponible » plutôt que « pas
  connecté », et l'accueil redemande avant de montrer la vitrine.

---

**Les duels qui attendent, et l'invitation d'un ami** (19 octobre 2026,
demandés par Gaël). Construction puis redémarrage, sans schéma.

- Quitter la page d'attente ne ferme plus le duel : il reste affiché pour
  les autres, et un rappel suit le joueur sur les autres pages (« TON DUEL
  T'ATTEND », puis « TON ADVERSAIRE EST LÀ » quand quelqu'un arrive en
  face). Le duel ne part jamais sans lui : il revient, et ça commence. Passé
  dix minutes sans revenir, le duel disparaît (réglable dans `/admin`, LE
  JEU, RÉGLAGES, « Un duel qui attend son créateur parti ailleurs »).
- Dans la salle d'attente, INVITER UN AMI (l'ami voit l'invitation sur la
  page où il est, REJOINDRE l'amène dans ce duel) et ENVOYER LE LIEN (le lien
  mène directement à la salle d'attente de ce duel). L'invité prend la
  tribune d'en face, sauf s'il est fan du même club que celui qui invite.

---

**Le tutoriel : la visite guidée et la page « Comment jouer »** (18 octobre
2026, demandé par Gaël). Construction puis redémarrage, sans schéma.

- Une visite guidée de l'accueil en sept arrêts (le Fanzzy, le Grand Virage,
  le duel, les écharpes et les boosters, le menu), avec un projecteur sur
  chaque élément. Elle paraît une fois par appareil, se passe d'un doigt, et
  se relance depuis « Comment jouer ». Les joueurs déjà inscrits la verront
  aussi une fois, à leur prochaine visite de l'accueil.
- `/comment-jouer` (menu, en tête des liens du bas) : tout ce que le jeu
  permet, une rubrique par chose à faire, chacune avec son bouton « Y aller ».
  Traduite dans les cinq langues.

---

**Les mini-jeux : jongles, tirs au but, chant en rythme, déplacement, tifo
du club et boss de la semaine** (18 octobre 2026, demandés par Gaël).
Construction, **schéma** (`npm run schema:appliquer`), puis redémarrage. Sans
le schéma, la page `/jeux` dit « Les mini-jeux arrivent bientôt » (rien ne
casse).

- `sql/mini-jeux.sql` : cinq tables neuves, `jeux_jongles`, `jeux_tirs`,
  `jeux_parties`, `jeux_tifo` et `jeux_boss` (57 tables en tout).
- `/jeux` (menu, rubrique JOUER, « Les mini-jeux »), six onglets :
  les jongles ; les tirs au but façon FIFA (jauge de visée, jauge de
  puissance, plongeon au doigt), contre un inconnu ou un ami, chacun quand il
  veut ; le chant en rythme (trois tambours) ; le déplacement (course sans
  fin) ; le tifo du club, peint ensemble avant le prochain match du club et
  levé au coup d'envoi ; la tribune contre le boss, que les chants réussis du
  club (Virage, duel, chant en rythme) font taire dans la semaine. Un
  classement par jeu seul, qui repart de zéro à chaque saison.
- Le tifo et le boss se jouent avec le club de cœur du joueur (sinon le
  premier club qu'il suit).
- Au coup d'envoi, le tifo se lève en grand au Virage (à l'entrée du match,
  ou à l'heure si l'on est là avant) et, une fois, sur l'accueil (PR #69).
- Des écharpes à chaque partie, au plus 40 par jour pour les jeux seuls et
  les tirs au but ; le tifo réussi (15) et le boss tombé (20) se paient en
  plus. Réglages dans `/admin`, LE JEU, RÉGLAGES, LES MINI-JEUX.

---

**Les saisons de trois mois, qui se lancent seules à leur date**
(18 octobre 2026, demandé par Gaël). Construction puis redémarrage, sans
schéma.

- Au redémarrage, les saisons 2 à 5 de 2027 apparaissent en préparation dans
  `/admin`, onglet SAISONS (`src/shared/saisons-prevues.js`) : Les héros du
  canapé (1er janvier au 31 mars), Les phénomènes météo (1er avril au
  30 juin), Les galères de déplacement (1er juillet au 30 septembre), Les
  revenants (1er octobre au 31 décembre), chacune avec un carnet sur trois
  mois et les pièces neuves de sa série. Posées une seule fois : ce qu'on y
  change ou supprime dans /admin n'est jamais réécrit.
- Le serveur lance seul, toutes les cinq minutes, une saison en préparation
  dont le jour d'ouverture est arrivé. La saison 1 « La reprise » doit finir le
  31 décembre 2026 (à saisir dans /admin si ce n'est pas fait).
- Les joueurs voient dès maintenant l'annonce de la saison 2 (« SAISON 2 » et
  son jour d'ouverture), comme toute saison qui porte une date.

---

**Les cartes-souvenirs gardent l'âge et la tenue du Fanzzy au moment du but**
(12 octobre 2026, demandé par Gaël). Construction, **schéma**
(`npm run schema:appliquer`), puis redémarrage. Sans le schéma, les cartes se
frappent comme avant, au premier âge (rien ne casse).

- `sql/souvenirs.sql` : `user_souvenirs.fanzzy_evo` et `fanzzy_skin`.
- `src/server/souvenirs/index.js` et `public/carnet.html` : la carte garde et
  dessine l'âge que le Fanzzy montrait au but, avec sa tenue et la lueur de
  l'âge. Les cartes d'avant restent au premier âge.

---

**Les cartes-souvenirs du Carnet, de vraies cartes avec le Fanzzy du Virage**
(PR #64, 11 octobre 2026, demandé par Gaël). Construction puis redémarrage,
sans schéma.

- `public/carnet.html` : chaque souvenir est une carte en portrait, Fanzzy en
  pied au premier âge et dans sa tenue, minute, buteur, score, nom du Fanzzy ;
  toucher une carte l'ouvre en grand.
- `src/server/souvenirs/index.js` : les cartes reçoivent la forme du Fanzzy
  (nom, tenue, série) au lieu de son seul code.

---

**Le site en cinq langues : français, anglais, allemand, italien, espagnol**
(branche `claude/site-cinq-langues-jdxall`, 9 octobre 2026, demandé par Gaël).
Construction, **schéma** (`npm run schema:appliquer`), puis redémarrage. Sans
le schéma, un joueur qui choisit l'italien est gardé en français dans son
compte (rien ne casse).

- `public/langue.js` et `public/i18n/` : chaque page joueur se traduit dans la
  langue du navigateur à la première visite ; la rubrique LANGUE du menu, la
  page du compte et le profil la changent. `/admin` reste en français.
- `i18n/<langue>.json` : les traductions (le français sert de clé). Après un
  ajout de Fanzzy, de pièce ou de stade, `npm run langues` liste dans
  `i18n/a-traduire.json` ce qui reste en français ; un fil le traduit.
- `sql/auth.sql` : `users.locale` accepte l'italien.
- `src/server/auth/` : la langue du compte suit le joueur d'un appareil à
  l'autre ; les mails (compte et abonnement, en HTML) partent dans sa langue.
- `src/server/boutique/index.js` : la page de paiement Stripe s'ouvre dans la
  langue du joueur, avec le nom de l'article traduit.
- `src/server/notifications/index.js` : les notifications partent traduites.
- `package.json` : deux paquets de développement (`acorn`, `acorn-walk`)
  pour `npm run langues`, installés par la construction.

---

**Mails d'abonnement : confirmation et résiliation** (branche
`claude/abonnement-desabonnement-j7vmji`, 9 octobre 2026, demandé par Gaël).
Construction puis redémarrage, sans schéma. Ne partent que si le SMTP est
réglé (APERÇU de /admin, ligne Messagerie, puis « Envoi de contrôle »).

- `src/server/boutique/index.js` : un abonnement posé (webhook ou rattrapage)
  envoie « Ton abonnement est actif » ; une résiliation envoie « Ta
  résiliation est enregistrée » avec sa date de fin.
- `src/server/auth/mailer.js`, `src/shared/i18n/authMessages.js` : les deux
  mails, en français et en anglais.
- `src/server/auth/mail-habit.js` : tous les mails partent aussi en HTML, aux
  couleurs du jeu (logo, tribune, bouton) ; les images viennent du site.

---

**Un paiement que le webhook n'a pas apporté est rattrapé, et l'abonné est
accueilli** (branche `claude/abonnement-desabonnement-j7vmji`, 9 octobre 2026,
demandé par Gaël, débité de 3,99 € sans abonnement posé). Construction puis
redémarrage, sans schéma.

- `src/server/boutique/index.js` : `POST /api/boutique/rattraper` demande à
  Stripe si les commandes en attente du joueur (7 derniers jours) sont payées,
  et les encaisse ; l'écran de l'abonnement l'appelle quand il ne voit pas
  d'abonnement.
- `public/abonnement.html` : au retour de Stripe, attend l'abonnement puis
  ouvre « Bienvenue dans le PASS de tribune » (boosters reçus, ce qui
  s'élargit) ; « Paiement annulé » au retour d'une annulation.

---

**La question « pourquoi tu pars ? » après une résiliation** (branche
`claude/abonnement-desabonnement-j7vmji`, 9 octobre 2026, demandé par Gaël).
Construction, **schéma** (`npm run schema:appliquer`), puis redémarrage.

- `sql/abonnement.sql` : nouvelle table `abonnement_departs` (réponses
  anonymes, sans le joueur) ; 52 tables.
- `public/abonnement.html` : après « Confirmer la résiliation », cinq choix et
  un mot libre, facultatifs (« Passer »), sans offre pour retenir.
- `public/admin.html` : l'APERÇU montre « Pourquoi ils se désabonnent » (90
  jours) et les derniers mots.

---

**Résilier l'abonnement depuis le jeu, et le renouvellement Stripe réparé**
(branche `claude/abonnement-desabonnement-j7vmji`, 9 octobre 2026, demandé par
Gaël). Construction puis redémarrage, sans schéma.

- `src/server/boutique/index.js` : un abonnement payé garde son identifiant
  Stripe (il ne le gardait pas, et `invoice.paid` ne prolongeait donc jamais
  l'accès) ; les factures et résiliations au format actuel de l'API Stripe sont
  lues ; nouvelles routes `/api/boutique/abonnement`, `/resilier`, `/reprendre`.
- `public/abonnement.html` : bouton « Résilier mon abonnement », confirmation,
  puis « Garder mon abonnement » jusqu'à l'échéance.
- `CGV.md` : la phrase « où résilier » est remplie.

---

**De l'air au-dessus des têtes sur les petites cartes** (branche
`claude/project-thread-j45ndm`, 9 octobre 2026, demandé par Gaël : « on ne
voit pas bien le haut des têtes »). Images seules : construction.

- Bustes des 17 cartes redessinées (RP1, RP2, RP13 à RP19, avec B et C) : la
  tête descend sous le fondu du haut de carte.
- `scripts/fanzzy-images.mjs` : 18 % de marge au-dessus du crâne (8 %
  avant), en vide si le rendu touche le haut de l'image.

---

**RP2, RP18 et RP19 redessinés** (branche `claude/project-thread-j45ndm`,
8 octobre 2026, demandé par Gaël). Images seules : construction, ni schéma ni
redémarrage.

- `public/img/fanzzy/RP2`, `RP18`, `RP19` et leurs cartes (B et C comprises) :
  nouveau dessin aux trois âges, cinq états et trois skins par âge ; les trois
  clignent des yeux à l'âge 1.

---

**Cinq légendaires redessinés : RP13 à RP17** (branche
`claude/project-thread-j45ndm`, 8 octobre 2026, demandé par Gaël). Images
seules : construction, ni schéma ni redémarrage.

- `public/img/fanzzy/RP13` à `RP17` et leurs cartes : nouveau dessin, cinq
  états et trois skins (Halloween, Préhistorique, Apocalyptique) chacun.
  RP13, RP14 et RP16 clignent des yeux ; RP15 (yeux trop petits pour être
  trouvés) et RP17 (visage hors du cadre de la tête) pas encore.
- `scripts/fanzzy-planche.mjs` : sur fond magenta, l'ombre au sol part avec
  le fond, et `--lueur` rend sa couleur chaude à une aura devenue rose ; une
  miette sans propriétaire ne troue plus la frange d'une figure.

---

**Le Fanzzy en grand sur « Mon Fanzzy »** (branche
`claude/serveur-pas-a-jour-fcvbnf`, 8 octobre 2026, demandé par Gaël). Pages
seules : construction, ni schéma ni redémarrage.

- `public/fanzzy.html` : la boîte du personnage s'arrête au-dessus de la
  banderole (elle lui cachait les pieds) et il en prend 80, 88 puis 96 % selon
  son âge, au lieu des 60 à 76 % de l'accueil.
- `public/fanzzy-scene.js` : `creer(hote, { taille })` laisse une page choisir
  cette part par âge.

---

**Le numéro du menu n'est plus gardé en cache** (branche
`claude/serveur-pas-a-jour-fcvbnf`, 8 octobre 2026). Gaël voyait encore
0.0100 après construction, schéma et redémarrage : `/api/version` était
gardée une heure par le navigateur. **Serveur seul, sans schéma** :
construction, puis redémarrage hors d'un match.

- `server.js` : `/api/version` répond `no-store`, comme `/healthz`.

---

**Le numéro de version passe à 0.0200** (8 octobre 2026). Il ne bouge qu'à
la main (`src/shared/version.js`) et n'avait pas changé depuis le
27 septembre : au menu, « version bêta — 0.0200 » dit que la mise en ligne
a eu lieu. Serveur : il se lit au redémarrage.

---

**Le Fanzzy plus grand sur sa carte** (branche `claude/project-thread-j45ndm`,
8 octobre 2026, demandé par Gaël). Pages seules : construction, ni schéma ni
redémarrage.

- `public/cartes.js`, `public/cartes.css`, `public/fanzzy-etats.js` : en
  grande carte (fiche, vitrine), le Fanzzy prend presque toute la hauteur et
  descend derrière la bande du nom ; aux âges 2 et 3, son repos est agrandi
  d'après sa mesure (`pieds`), il ne rapetisse plus dans le cadre de l'âge.

---

**RP1 refait par Gaël, avec son aura** (branche `claude/project-thread-j45ndm`,
7 octobre 2026 au soir). Images seules : construction, ni schéma ni
redémarrage.

- `public/img/fanzzy/RP1*` : ses trois cartes et ses états des trois âges, en
  tenue de base et dans ses trois skins, découpés des douze planches de Gaël ;
  il cligne toujours à l'âge 1.
- Le découpage (`scripts/fanzzy-planche.mjs`, `scripts/fanzzy-images.mjs`)
  retire l'ombre au sol et le reflet vert de l'aura des âges 2 et 3.

---

**La politique de confidentialité, publiée** (branche
`claude/project-thread-iatg2m`, 7 octobre 2026, avec les informations d'éditeur
de Gaël). Elle se dépose avec ce qui est en dessous, ou seule. **Serveur et
pages, sans schéma** : construction, puis redémarrage hors d'un match.

- `/confidentialite` (`public/confidentialite.html`) : ce que le jeu garde,
  pourquoi, combien de temps, ce que les autres joueurs voient, et comment tout
  effacer. Éditeur : Gaël Manigley, entreprise individuelle, 1085 Vulliens
  (Suisse), info@thebestfan.online. Lisible sans compte et sans base.
- Les liens : au pied de la vitrine, sous la porte de connexion (dans ses
  quatre langues) et dans « Mon compte », au-dessus de « Supprimer mon compte ».
- `server.js` : la route, et l'entretien des sessions et des tentatives de
  connexion, qui passe aussi au démarrage (la page promet « deux jours au plus »
  pour les tentatives manquées).
- **Après le redémarrage** : ouvrir https://thebestfan.online/confidentialite,
  puis, si Gaël le veut, allumer la présence des amis : `/admin`, RÉGLAGES,
  LA PRÉSENCE, « Montrer la présence des amis ».
- Contrôlé par `npm run confidentialite:smoke` (neuve) et `auth:smoke` ;
  `tour:ui` et `large:ui` la parcourent comme les autres pages.

---

**Le Fanzzy au milieu à l'âge 3** (branche `claude/project-thread-j45ndm`,
7 octobre 2026, signalé par Gaël). Pages seules : construction, ni schéma
ni redémarrage.

- Quand un objet étire le dessin d'un côté (le mégaphone de RP1 à l'âge 3),
  le corps du Fanzzy reste au milieu, à l'accueil et dans l'arène.
  `public/img/fanzzy/index.json` garde le décalage des jambes de chaque âge
  (`pieds`, troisième valeur, mesurée par `scripts/fanzzy-manifeste.mjs`) ;
  `public/fanzzy-etats.js`, `public/index.html`, `public/fanzzy-scene.js` et
  `public/ui.css` s'en servent.

---

**Sur ordinateur, toutes les pages à la largeur du téléphone** (branche
`claude/ecran-large-pkbkwj`, 7 octobre 2026, demandé par Gaël). Pages
seules : construction, ni schéma ni redémarrage.

- Sur un ordinateur comme sur une tablette, chaque page (accueil, Virage et
  duel compris) a la largeur d'un grand téléphone, 480 px, au milieu de
  l'écran. Les pages larges, les listes en colonnes et les tuiles de
  l'accueil autour des pages sont retirées ; le menu est le tiroir, partout.
  Gaël a confirmé le retrait des tuiles : leur code est supprimé
  (`menu.js`, `ui.css`).
- La fiche d'un match reprend sa forme de téléphone, son Fanzzy au coin de
  la fiche (ce qui défait l'entrée « Le Fanzzy regarde le match en grand »
  plus bas).
- Contrôlé par `npm run large:ui` et les suites des pages.

---

**RP2 redessiné, et le Fanzzy grandit d'un âge à l'autre** (branche
`claude/project-thread-j45ndm`, 7 octobre 2026, demandé par Gaël). Il se
dépose avec ce qui est en dessous, ou seul. **Pages et images seules**, sans
schéma ni redémarrage : la construction suffit.

- `public/img/fanzzy/RP2*` : ses trois cartes, ses états des trois âges en
  tenue de base et dans les trois skins ; il cligne à l'âge 1.
- `public/img/fanzzy/index.json` : la place du personnage dans le cadre de
  chaque âge (`pieds`), mesurée par `scripts/fanzzy-manifeste.mjs`.
- `public/fanzzy-etats.js` (`taille`), `public/index.html`, `public/fanzzy-scene.js`,
  `public/ui.css`, `public/cartes.js`, `public/cartes.css` : à l'accueil, au duel et
  sur la fiche d'un match, le personnage occupe 60, 68 puis 76 % de sa boîte selon
  son âge, pieds au sol ; sur la carte, 72, 80 puis 88 %. Avant, un âge 3 large
  était réduit et paraissait plus petit que l'âge 1.
- Accueil : le Fanzzy repose sur son ombre ; le second rond, sous lui
  (`public/fanzzy-fond.js`, pied d'ombre du décor), n'y est plus montré.
- La lueur de l'âge (accord de Gaël) : aucune à l'âge 1, un halo bleu de rare à
  l'âge 2, un halo violet d'épique plus large à l'âge 3, collé au dessin, sur
  l'accueil, la carte et dans les scènes.

---

**Les légendaires : entrée en jeu et vraie rareté** (branche
`claude/legendaires-acces-rarete-bxduel`, 7 octobre 2026, choix de Gaël).
Il se dépose avec ce qui est en dessous, ou seul. **Serveur et pages, sans
schéma** : construction, puis redémarrage hors d'un match.

- Un seul légendaire par deck (Fanzzy ou pièce), jamais titulaire. Il dort
  jusqu'à 5 chants réussis (BON ou PARFAIT) du joueur, au duel comme au Virage ;
  l'éveil offre au Fanzzy légendaire du banc un changement gratuit. Un deck
  d'avant la règle se joue selon elle, sans rien perdre. Réglage :
  /admin, LA COMPOSITION DU DECK.
- Boosters : 2 % de Fanzzy légendaire et 3 % de pièce légendaire par booster
  (avant : environ 19 % et 10 %). Réglages : /admin, BOOSTERS ET ÉCHARPES.
- L'étal ne vend plus de pièce légendaire.
- Paquet de bienvenue : plus de légendaire offerte (choix de Gaël), deux
  Fanzzy communs différents.
- Contrôlé par `npm run legende:smoke` (neuve).

---

**Le Fanzzy regarde le match en grand** (branche `claude/ecran-large-pkbkwj`,
7 octobre 2026, demandé par Gaël). Page seule (`public/aujourdhui.html`) :
ni schéma ni redémarrage.

- Sur PC, dans la fiche d'un match, le Fanzzy équipé quitte son coin : il se
  pose sous GRAND VIRAGE et DUEL, au milieu, aussi grand que la place libre
  (jusqu'à 270 × 420 px). Sur téléphone, rien ne change. Contrôlé par
  `npm run matchs:ui`.

---

**RP1 redessiné** (branche `claude/project-thread-j45ndm`, 7 octobre 2026,
images de Gaël dans le nouveau design). Il se dépose avec ce qui est en
dessous, ou seul. **Images seules**, sans schéma ni redémarrage : la
construction suffit.

- `public/img/fanzzy/RP1*` : ses trois cartes (RP1, RP1B, RP1C) et leurs bustes.
- `public/img/fanzzy/RP1/` : ses états des trois âges, en tenue de base et dans
  les trois skins (Halloween, Préhistorique, Apocalyptique), découpés de ses
  douze planches par `npm run planche`. Il cligne des yeux à l'âge 1, comme avant.
- `public/fanzzy-art.js` et `public/img/fanzzy/index.json` : les nouvelles
  versions des images, pour que les téléphones ne gardent pas les anciennes.
- Contrôlé par `npm run etats:test` et `npm run cligne:test`.

---

**Les barres du téléphone** (branche `claude/affichage-mobile-z3oflp`,
6 octobre 2026, signalé par Gaël sur son Samsung S24+). Il se dépose avec ce
qui est en dessous, ou seul. **Pages seules**, sans schéma ni redémarrage.

- Les 24 pages (`public/*.html`) : sur Android, un script en tête retire
  `viewport-fit=cover`, et Chrome tient la page entre la barre d'état et les
  boutons du bas, dans le navigateur comme depuis l'icône. iPhone ne change pas.
- Accueil, Fanzzy et sa fiche, Virage, duel, bienvenue : ils ne descendent plus
  sous 560 px de haut (`--ecran-min`, `public/ui.css`). Dans une fenêtre plus
  courte (zoom ou grand texte du téléphone), la page défile jusqu'au dernier
  bouton au lieu de le couper. Rien ne change sur un téléphone ordinaire ni sur PC.
- Contrôlé par `npm run barres:ui` (neuve) et `npm run pages`.

---

**Les bruitages du duel** (branche `claude/sons-fid6tr`, 6 octobre 2026,
demandé par Gaël, synthèse choisie par lui). Il se dépose avec ce qui est en
dessous, ou seul. **Pages seules**, sans schéma ni redémarrage.

- `public/son.js` : 63 bruitages synthétisés, un par carte d'action (39) et
  un par épreuve (24), dans la fenêtre de volume du jeu. Aucun fichier.
- `public/action-art.js` : une carte qui part fait entendre le sien, chez les
  deux joueurs, au duel et au Virage (au lieu du claquement commun), même
  sous le calme des animations.
- `public/geste.js` : une épreuve qui s'ouvre fait entendre le sien, au duel,
  au Virage et en répétition ; ceux des épreuves de rythme se taisent avant
  le premier temps.
- Contrôlé par `npm run son:smoke` (13 contrôles neufs), `repetition:ui` et le banc.
  À l'écoute : https://claude.ai/artifact/7vEh8GY8qpckkdKxfU1kWt

---

**La tribune enregistrée** (branche `claude/sons-fid6tr`, 6 octobre 2026,
les sons gardés par Gaël). Il se dépose avec ce qui est en dessous, ou seul.
**Serveur**, sans schéma : redémarrer, hors d'un match en direct.

- `public/son/` (neuf, quatre fichiers, 184 Ko) : la rumeur de stade et la
  clameur du but, prises dans Artlist, en Opus avec un repli pour Safari.
- `public/son.js` : au Virage et au duel, la rumeur de la tribune vient de
  l'enregistrement dès qu'il est arrivé (la synthèse joue en attendant, puis
  passe la main en fondu), et le but sonne la vraie clameur au lieu de
  l'ovation synthétisée. Rien n'est téléchargé sous le mode calme ni sur les
  autres pages ; un fichier illisible laisse la synthèse jouer. Les chants
  (tambours et claps) ne changent pas.
- `server.js` : `/son` servi un an, comme `/video` (le redémarrage sert à
  ça ; sans lui, les fichiers partent quand même, avec un cache d'une heure).
- Contrôlé par `npm run son:smoke` (17 contrôles neufs) et le banc
  (`node scripts/son-banc.mjs`) : la rumeur enregistrée tient les mêmes
  fenêtres que la synthèse à ses trois niveaux, la clameur celle des moments.

---

**Cent pièces d'équipement** (branche `claude/cent-objets-lj2o13`, 6 octobre
2026, demandé par Gaël). Il se dépose avec ce qui est en dessous, ou seul.
**Serveur**, sans schéma : redémarrer, hors d'un match en direct.

- `src/shared/fanzzy/inventaire.js` : 51 pièces neuves, dix par série qui
  attend sa saison (VIP, Gastronomie de comptoir, Galères de déplacement,
  Phénomènes météo, Héros du canapé) et une centième. Toutes **fermées**
  (`publie: false`) : le redémarrage les sème fermées dans `contenus`, rien
  ne change pour les joueurs. On les ouvre avec la saison de leur série, ou
  dans /admin, onglet CONTENUS. Liste : `/mnt/project-files/equipement/cent-pieces.md`.
- La boutique vendait aussi les pièces fermées : elle ne vend plus que celles
  qui sont ouvertes (`src/server/boutique/index.js`). Sans la table
  `contenus`, une fiche `publie: false` reste fermée (`contenus/index.js`).
- Images à faire dans Artlist : `/mnt/project-files/equipement/equipement-images-artlist.md`.
  Contrôlé par `npm run contenus:smoke`, `catalogue:test` et `pages:test`.

---

**Les compétitions et les calendriers à jour tout seuls** (branche
`claude/rythme-foot-uwpqfu`, fusionnée dans `main` le 6 octobre 2026).
Serveur seul, **aucun schéma ni réglage**. Un redémarrage, hors d'un match en
direct où des joueurs sont au Virage ou en duel.

- `src/server/football/inventaire.js` (neuf), `poller.js`, `routes.js` :
  l'inventaire des compétitions (`souvenir_leagues`), que seul
  `scripts/coverage.mjs` lancé à la main tenait à jour, passe désormais une
  fois par jour, cinq minutes après le démarrage puis toutes les vingt-quatre
  heures, pour un appel. La saison nouvelle d'une compétition arrive donc en
  base sans toi, et le télétexte y bascule à sa date de début. Une saison
  nouvelle reprend l'interrupteur et le palier réglés dans /admin pour la
  saison d'avant ; une ligne déjà connue garde les siens (le script, lui,
  réécrivait le palier).
- Les calendriers des clubs suivis se relisent aussi deux minutes après chaque
  démarrage (trois appels par club suivi) : leur tour de vingt-quatre heures
  ne passait jamais sur un serveur redémarré chaque jour.
- `scripts/coverage.mjs` reste, pour lire le rapport ou forcer un passage.
  Contrôlé par `npm run inventaire:smoke` (suite neuve).

**Après le redémarrage** : au bout de cinq minutes, le journal dit
`[foot] competitions : N saison(s) nouvelle(s)` s'il en a trouvé.

**Les saisons finies se revoient** (même branche, fusionnée le même jour).
Serveur et page, sans schéma.

- `src/server/teletext/index.js`, `public/teletext.html` : sur la page d'une
  compétition, le sous-titre « Suisse · saison 2026 » devient un choix quand
  l'inventaire connaît plusieurs saisons. Classement, résultats, buteurs,
  passeurs, cartons et FERVEUR suivent la saison choisie. Une saison close
  depuis plus d'une semaine se garde une semaine en cache (un appel par
  semaine et par onglet, au premier qui la revoit). Contrôlé par `npm run
  tt:smoke` et `npm run competitions:ui`.

---

**Combien d'exemplaires d'un objet** (branche `claude/exemplaires-objets-eeg3ce`,
6 octobre 2026, demandé par Gaël). Il se dépose avec ce qui est en dessous, ou
seul. **Serveur + page**, sans schéma : redémarrer, hors d'un match en direct.

- À la boutique, le tampon d'une pièce qu'on a plusieurs fois dit « À TOI ×2 »
  (« DÉJÀ À TOI » reste pour un seul exemplaire), et les boîtes d'achat disent
  « Tu en as déjà 2 ». L'étal (`src/server/boutique/index.js`,
  `src/shared/etal.js`) envoie maintenant le nombre d'exemplaires.
- Contrôlé par `npm run boutique:smoke` (un contrôle neuf).

---

**Les classements qui refusaient une ligne sans équipe** (branche
`claude/contenus-sql-q1sziv`, 6 octobre 2026, vu dans le journal de Gaël :
« [foot] classement 3/2017 : Column 'team_id' cannot be null »). Il se dépose
avec ce qui est en dessous, ou seul.

- `src/server/football/poller.js` : l'API rend parfois une ligne de
  classement dont l'équipe a un identifiant nul. Le filtre la laissait passer
  et la compétition entière n'était plus rafraîchie. La ligne est maintenant
  écartée. Contrôlé par `npm run foot:smoke` (la forme réelle rejouée).

**Aucun schéma ni réglage.** Un redémarrage, hors d'un match en direct.

---

**Les décisions de Gaël du 6 octobre au matin** (branche
`claude/project-thread-iatg2m`, fusionnée dans `main` le 6 octobre 2026).
Quatre changements, qui partent ensemble au prochain build :

1. Gosier Rouillé (RP1) cligne des yeux à l'accueil (une page, des images) ;
2. au Virage, les moments d'un même geste se montrent l'un après l'autre
   (une page) ;
3. au duel, le stade du match, montré dès la préparation (serveur et page) ;
4. le reste des boosters à 2 écharpes, « La quête » et « Mur de bâches »
   retirés et remboursés aux KOP, des saisons de quatre mois (serveur).

**Aucun schéma ni réglage.** Un redémarrage, **hors d'un match en direct**
où des joueurs sont au Virage ou en duel (les salles du Virage, les duels et
leurs files vivent en mémoire), puis relever `/healthz`. Le premier
démarrage rembourse les KOP (plus bas, « Ce que fait ce premier
démarrage »).

### 1. Il cligne des yeux

- `public/index.html`, `public/fanzzy-etats.js` : à l'accueil, au repos,
  Gosier Rouillé (RP1, âge 1, tenue de base) cligne des yeux toutes les
  trois à sept secondes, une fois sur cinq deux fois de suite. Pas sous le
  calme (`data-calme`, `prefers-reduced-motion`), ni dans un onglet caché ;
  ni sur une joie, un dépit ou le supporter générique. Contrôlé par `npm run
  accueil:ui` (9 contrôles neufs) et `npm run etats:test` ; filmé pour Gaël
  (`lot7/cligne/rp1-cligne.mp4` dans les fichiers du projet).
- `public/img/fanzzy/RP1/e1/base/cligne.{avif,webp,png}` (images neuves),
  `public/img/fanzzy/RP1/manifeste.json` (`rev` 7) et
  `public/img/fanzzy/index.json` : ses paupières, et l'index qui les
  annonce à la page.
- `scripts/fanzzy-cligne.mjs`, `scripts/fanzzy-art.mjs`, `art/RP1/cligne/` :
  la chaîne qui pose les paupières, et la retouche Artlist dont elles
  viennent. Rien que le site lise. Contrôlé par `npm run cligne:test`.

### 2. Au Virage, le jeu d'abord

- `public/virage.html` : quand plusieurs moments tombent pendant un même
  geste, ils se montrent l'un après l'autre, 3,5 secondes chacun : la corde
  qui cède d'abord, puis ce que le match a fait (la vidéo, un rouge, le coup
  de sifflet final), et le but réel en dernier, qui reste à l'écran ses
  quinze secondes. Avant, on ne voyait que le dernier. La carte-souvenir d'un
  but attend la fin du défilé. Contrôlé par `npm run virage:ui` (4 contrôles
  neufs).

### 3. Le stade du match, au duel

- `src/server/contenus/index.js`, `src/server/nvn/engine.js` : tous les duels
  d'un match se jouent dans son stade, celui de son Grand Virage. Le duel
  tirait son lieu sur son propre identifiant, neuf à chaque partie : deux
  duels d'un même match tombaient dans deux stades, presque jamais dans
  celui du Virage. Une seule fonction tire maintenant le stade d'un match
  (`stadeDuMatch`), pour le Virage comme pour le duel. Contrôlé par `npm run
  nvn:smoke` (2 contrôles neufs) et `npm run contenus:smoke`.
- `src/server/deck/index.js` : la liste des matchs du duel
  (`/api/deck/matchs`) et la route d'un match (`/api/deck/match/:id`)
  servent ce `stade` : `{ id, nom, effet }`. Contrat : `serveur/CONTRATS.md`,
  § 17. Contrôlé par `npm run deck:smoke` (un contrôle neuf).
- `public/duel-nvn.html` : avant l'entrée en file, l'affiche du match choisi
  montre son stade, le dessin en fond et le nom au pied, et les règles du
  « i » disent ce qu'il change. Contrôlé par `npm run nvn:ui` (4 contrôles
  neufs) ; photographié pour Gaël (`duel/stade-preparation.jpg` dans les
  fichiers du projet).
- `src/server/ferveur/virage.js` : le Virage tire le même stade qu'avant,
  maintenant par `stadeDuMatch` ; rien ne change à l'écran.
  `src/shared/stades.js` : des commentaires.

La page et le serveur se tolèrent (sans `stade` dans la liste, l'affiche
reste sans lieu ; la page d'avant ignore le champ), mais c'est ensemble que
la préparation annonce le stade où le duel se jouera.

### 4. Les boosters, les KOP, les saisons

- `src/shared/fanzzy/dex.js`, `src/server/fanzzy/index.js`,
  `src/shared/aide.js` : une place de booster dont la catégorie n'a plus rien
  à donner au joueur (toutes ses tenues, tous ses états ou toutes ses cartes
  d'action) rend **2 écharpes** au lieu d'une poignée de 6, 14 ou 30 ; la
  catégorie des écharpes garde sa poignée. Un booster établi rend environ 29
  écharpes au lieu de 46 ; un nouveau venu, sur ses vingt premiers, 12 au
  lieu de 18. L'aide le dit (« Il y a quoi dans un booster ? »). Contrôlé par
  `npm run fanzzy:smoke` (deux contrôles neufs) et `npm run aide:smoke`.
- `src/shared/kop.js`, `src/server/kop/index.js`, `server.js` : « La quête »
  (900 écharpes) et « Mur de bâches » (500) quittent le catalogue des KOP. La
  page du KOP ne les propose plus, le serveur refuse de les mettre aux voix,
  et **ce qu'ils avaient coûté revient au pot, au premier démarrage**
  (ci-dessous). Contrôlé par `npm run kop:smoke` et `npm run cablage`.
- `sql/saisons.sql` : la graine nomme la saison 1 « La reprise », comme la
  production. Elle ne joue que sur une table vide : la base en ligne n'est
  pas touchée, et rejouer `schema:appliquer` ne renomme rien.
- Documents : `serveur/ECONOMIE.md`, `serveur/SERVEUR.md`,
  `serveur/ECARTS.md`, `serveur/DONNEES.md`, `JURIDIQUE.md`,
  `DEPLOIEMENT.md`, `ETAT.md`, `HISTORIQUE.md`, ce fichier.

### Ce que fait ce premier démarrage

Avant d'écouter, le serveur rend au pot de chaque KOP qui les avait achetés
900 écharpes par « La quête » et 500 par « Mur de bâches », même quand des
matchs les avaient décomptés : ils n'ont rien reçu. Une transaction par KOP :
chaque achat est marqué rendu dans `kop_bonus` (`rendu:echarpes`,
`rendu:contres`) en même temps que le pot est crédité, si bien que les
démarrages suivants n'ont plus rien à rendre. Rien n'est effacé, et le cumul
versé (`verse_total`) ne bouge pas : ce n'est pas un versement. Les membres
voient leur pot plus haut sur la page du KOP ; rien ne le leur annonce.

**Au journal de démarrage**, après « KOP actifs » : une ligne par KOP
remboursé, puis le bilan.

```
[kop] bonus retirés : 900 écharpes rendues au pot du KOP « … » (<id>) pour 1 × « La quête » ; pot 120 → 1020
[kop] bonus retirés : 1000 écharpes rendues au pot du KOP « … » (<id>) pour 2 × « Mur de bâches » ; pot 40 → 1040
[kop] bonus retirés : 1900 écharpes rendues à 2 KOP pour 3 achat(s)
```

Ou `[kop] bonus retirés : rien à rendre`, si aucun KOP ne les avait achetés ;
c'est aussi ce que diront tous les redémarrages suivants. Une ligne qui finit
par « repris au prochain démarrage » dit un échec, pour un KOP (« le KOP …
n'a pas été remboursé (…) — rien n'est écrit ») ou pour tous (« rien n'a pu
être rendu (…) ») : l'application démarre quand même, rien n'est écrit pour
ce qui a échoué, et le redémarrage suivant le reprend, sans rien faire
d'autre.

```bash
T=$(date +%s)
curl -s "https://thebestfan.online/healthz?v=$T"                                   # "ok":true
curl -s "https://thebestfan.online/api/aide/faq?v=$T" | grep -c 'se change en 2'   # 1
```

**Dans la base**, en lecture seule, si Gaël veut voir ce qui a été rendu :

```sql
SELECT k.nom, b.bonus_id, b.achete, b.epuise
  FROM kop_bonus b JOIN kops k ON k.id = b.kop_id
 WHERE b.bonus_id LIKE 'rendu:%';                                         -- les achats rendus
SELECT COUNT(*) FROM kop_bonus WHERE bonus_id IN ('echarpes', 'contres'); -- 0
```

**Dans `/admin`, sans lien avec ce dépôt** : la fin de la saison 1,
`2026-12-31`, dans l'onglet Saisons, sur la ligne de « La reprise »
(`DEPLOIEMENT.md`, « Après la livraison du quotidien », point 3). Les
saisons durent désormais quatre mois ; la saison 2 court du 1er janvier au
30 avril 2027, et sa série et son nom restent à choisir.

---

**Le pronostic** (branche `claude/pronostic-th5gjy`, 6 octobre 2026, demandé
par Gaël, version gratuite choisie par lui). Il se dépose avec ce qui est en
dessous, ou seul.

- Sur la fiche d'un match d'un club suivi (`/matchs`), avant le coup d'envoi :
  **TON PRONOSTIC**, deux compteurs et un bouton. Modifiable jusqu'au coup
  d'envoi. Au coup de sifflet final, le bon vainqueur (ou le bon nul) rapporte
  15 écharpes, le score exact 50 ; un pronostic faux ne coûte rien. Montants
  et interrupteur dans `/admin`, RÉGLAGES, LE PRONOSTIC.
- `src/server/pronostics/index.js` (neuf), `server.js`, `public/aujourdhui.html`,
  `src/server/recompenses.js` (source `prono`), `src/shared/reglages.js`.
  Contrôlé par `npm run prono:smoke` (suite neuve, 46 contrôles) et
  `npm run matchs:ui` (13 contrôles neufs).

**Un schéma est à appliquer : `sql/pronostics.sql`** (une table neuve, rien de
modifié ailleurs). Après la construction : `npm run schema:appliquer` en SSH,
puis **redémarrer**, hors d'un match en direct. Sans le schéma, rien ne casse :
le pronostic ne paraît pas, et le démarrage nomme le fichier.

---

**Les tenues s'achètent dans la boutique** (branche `claude/boutique-tenues-p8r3wa`,
6 octobre 2026, demandé par Gaël). Serveur + page, **sans schéma** ;
**redémarrage**, hors d'un match. Il se dépose avec ce qui est en dessous, ou seul.

- `public/boutique.html` : dans l'onglet TENUES, les Fanzzy du joueur qui ont
  la tenue en dessin, un par âge atteint ; on en touche un, ACHETER demande
  confirmation et l'achat se fait sur place (avant, le bouton menait au
  classeur, où rien ne s'achetait). LA PORTER la lui met tout de suite.
- `src/server/boutique/index.js` (l'étal dit les tenues déjà posées) et
  `src/server/fanzzy/index.js` (une tenue s'achète pour tout âge atteint,
  plus seulement le dernier). Contrôlé par `npm run boutique:smoke` et
  `npm run boutique:ui` (suite neuve).

---

**Toutes les pages en largeur sur PC** (branche `claude/ecran-large-pkbkwj`,
6 octobre 2026, demandé par Gaël). Des pages seules : ni schéma ni
redémarrage. Il se dépose avec ce qui est en dessous, ou seul.

- `public/ui.css` et quinze pages (`aide`, `amis`, `kop`, `classement`,
  `carnet`, `collection`, `equipes`, `teletext`, `aujourdhui`, `abonnement`,
  `compte`, `deck`, `boosters`, `fanzzy`, `fanzzy-fiche`) : au-delà de
  1 180 px, chacune prend la colonne large entre les tuiles, ses listes en
  colonnes. Sur téléphone et tablette, rien ne change. Contrôlé par
  `npm run large:ui` (neuf pages) et par les suites des six autres.
- Sur grand écran, la fiche d'un match (`/matchs`) devient une page entre
  les tuiles : l'affiche à gauche, le fil à droite, la flèche de la barre
  la referme. Partout, une coupe sans classement (`/teletext?ligue=…`)
  s'ouvre sur ses résultats, et non plus sur « Cette donnée n'existe pas ».
  Contrôlé par `npm run matchs:ui` et `npm run competitions:ui`.

---

**Le Fanzzy parle** (branche `claude/dialogues-fanzzy-vgfrke`, 6 octobre
2026, demandé par Gaël). Il se dépose avec ce qui est en dessous, ou seul.
**Pages seules** (`public/index.html`, `public/fanzzy-repliques.js`) : ni
schéma ni redémarrage.

- Dans sa bulle, le Fanzzy de l'accueil dit bonjour selon l'heure, raconte le
  dernier match (le nul compris), fête un retour, a sa réplique à lui quand on
  le touche, en redemande au troisième toucher et boude au sixième. Une
  réplique par Fanzzy de LA REPRISE, une voix par famille, et celle de tout le
  monde. La phrase du hub (match, boosters) passe toujours d'abord.
- Contrôlé par `npm run repliques:test` (suite neuve, chaque ligne : quatre
  mots, aucun chiffre) et `npm run accueil:ui` (14 contrôles neufs).

---

**La collection de stades** (branche `claude/collection-stades-nsq24k`,
6 octobre 2026, option « album + décor d'accueil » choisie par Gaël). Il se
dépose avec ce qui est en dessous, ou seul.

- **Un schéma à appliquer** : `sql/collection-stades.sql` (la table
  `user_stades` et la colonne `user_wallet.stade_accueil`). Après la
  construction : `npm run schema:appliquer` en SSH, puis redémarrer, hors d'un
  match en direct. Sans lui rien ne casse, mais aucun stade ne se gagne.
- `src/server/fanzzy/index.js` : un booster peut donner un stade (5 % des
  places ouvertes, pris sur les écharpes ; un doublon rapporte des écharpes),
  les stades comptent dans la jauge de collection, et
  `POST /api/fanzzy/lieu-accueil` choisit le stade en décor de l'accueil.
  Contrôlé par `npm run fanzzy:smoke` (douze contrôles neufs).
- `public/collection.html`, `public/cartes.js`, `public/boosters.html` : un
  sixième rayon STADES, la carte d'un stade et son bouton « EN DÉCOR DE
  L'ACCUEIL ». `public/index.html` : le stade choisi passe derrière le
  Fanzzy. Contrôlé par `npm run collection:smoke` (onze contrôles neufs).

Posséder un stade ne décide pas où l'on joue et n'y donne rien.

---

**Le derby automatique** (branche `claude/derby-auto-hmhnv6`, 6 octobre
2026, demandé par Gaël). Il se dépose avec ce qui est en dessous, ou seul.

- `src/server/nvn/index.js` : quand deux joueurs sont sur le jeu au même
  moment et suivent chacun un club d'un match du jour, `/api/nvn/attentes`
  leur propose ce derby (1v1 classé, chacun dans la tribune de son club).
  Jamais qui, rien écrit en base. Quand l'un entre en file, l'autre lit qu'un
  supporter de l'autre club l'attend.
- `public/index.html` : le bouton de l'accueil dit « Derby du jour · Un
  supporter de Bâle est en ligne », puis « Derby ! · un supporter de Sion
  t'attend ». `public/duel-nvn.html` : le match porte DERBY.
- Contrôlé par `npm run derby:smoke` (suite neuve, 25 contrôles) et
  `npm run accueil:ui` (5 contrôles neufs).

**Aucun schéma ni réglage.** Le serveur change : **redémarrer** après la
construction, hors d'un match en direct.

---

**Le deck refait au style du jeu** (branche `claude/deck-interface-n1oqm1`,
6 octobre 2026, demandé par Gaël). Il se dépose avec ce qui est en dessous, ou
seul. **Une page seule** (`public/deck.html`) : ni schéma ni redémarrage.

- Le haut reprend le rail de MON FANZZY (DECK allumé à droite) ; PRÊT passe
  en bas, à côté d'ENREGISTRER. Les Fanzzy, les cartes du catalogue et les
  choix sont sur le béton des autres pages ; l'équipement se montre comme à
  la boutique ; RETIRER est à sa taille ; le titulaire au vert.
- Les fenêtres (carte, équipement, choix d'un Fanzzy) ont le décor du menu ;
  le Fanzzy qu'on choisit est dessiné ; la carte ouverte est à sa taille, et
  à côté de son texte sur ordinateur. Avant/après :
  `/mnt/project-files/deck/` du projet.

---

**Le profil, la boutique et la répétition en largeur** (branche
`claude/ecran-large-pkbkwj`, 6 octobre 2026, la forme choisie par Gaël :
« tuiles + pages larges »). Ils se déposent avec ce qui est en dessous, ou
seuls.

- `public/ui.css`, `public/profil.html`, `public/boutique.html`,
  `public/repetition.html` : sur un écran d'au moins 1 180 pixels de large,
  ces trois pages prennent toute la place entre les tuiles (1 320 pixels au
  plus). Le profil passe en deux colonnes (la carte, le bonus, le niveau et
  la saison à gauche ; le parcours, le Fanzzy et l'équipement à droite), la
  boutique montre huit objets par rangée au lieu de cinq, la répétition range
  ses familles de gestes deux par rangée. Rien ne change sur téléphone ni sur
  tablette. Contrôlé par `npm run profil:ui` et `npm run repetition:ui` (sept
  contrôles neufs) ; mesuré sous Firefox 136 et Chrome.

**Aucun schéma ni réglage, sans redémarrage.**

---

**L'équipement porté** (branche `claude/equipement-porte-3ml5d5`, 6 octobre
2026, forme choisie par Gaël sur maquette : « à côté de lui »). Il se dépose
avec ce qui est en dessous, ou seul.

- Les deux pièces que le deck met au Fanzzy sont accrochées à côté de lui,
  chacune dans le cadre de sa rareté : à l'accueil (`public/index.html`), au
  Virage (`public/virage.html`) et dans l'arène du duel, des deux côtés
  (`public/duel-nvn.html`). Le dessin vient de `public/stuff-art.js`
  (`TBF_STUFF.porte`), le style de `public/ui.css` (`.tbf-porte`).
- Serveur : le portefeuille sert `stuffPorte` (`src/server/fanzzy/index.js`),
  la vue du duel `equipes[].sac` (`src/server/nvn/engine.js`), et les lignes
  d'équipement de « ce que tu portes » leur identifiant et leur rareté
  (`src/shared/apports.js`). Contrôlé par `npm run deck:smoke`,
  `nvn:smoke`, `accueil:ui`, `nvn:ui` et `virage:ui` (dix-huit contrôles neufs).

**Aucun schéma ni réglage. Un redémarrage** pour le serveur, hors d'un match
en direct ; sans lui, les pages n'ont aucune pièce à accrocher et restent
comme avant.

---

**Le geste de chaque Fanzzy au duel** (branche `claude/geste-fanzzy-0qd5x6`,
6 octobre 2026, règle « Toujours là » choisie par Gaël). Il se dépose avec ce
qui est en dessous, ou seul.

- `src/server/nvn/engine.js`, `src/server/nvn/index.js`, `public/duel-nvn.html` :
  le chant du geste du Fanzzy en tribune est toujours dans la main du joueur,
  au milieu, avec le sceau de sa famille ; quand le tirage ne l'offrait pas, il
  prend la place du cinquième. Aucun bonus. Réussi, ce chant fait chanter le
  Fanzzy de l'arène à la manière de sa famille (la Voix crie, la Percussion
  frappe…), sans image neuve. Contrôlé par `npm run nvn:smoke` et `npm run
  nvn:ui` (13 contrôles neufs).

**Aucun schéma.** Le serveur change : **redémarrer** après la construction,
hors d'un match en direct.

---

**Les tuiles de l'accueil sur grand écran** (branche
`claude/ecran-large-pkbkwj`, 6 octobre 2026). Elles se déposent avec ce qui
est en dessous, ou seules.

- `public/menu.js`, `public/nav.js`, `public/ui.css` : sur un écran d'au
  moins 1 180 pixels de large (un ordinateur), chaque page de contenu porte
  les dix tuiles de l'accueil, cinq de chaque côté de sa colonne, avec les
  mêmes stickers que le menu (boosters, monde au Virage, duels qui
  attendent). On change de section en un clic, sans ouvrir le menu.
  L'accueil, le Virage et le duel ne changent pas ; rien ne change sur
  téléphone ni sur tablette. Contrôlé par `npm run menu:smoke` (onze
  contrôles neufs) ; mesuré sous Firefox 136 et Chrome.

**Aucun schéma ni réglage, sans redémarrage** : ce sont trois fichiers
statiques, et leur empreinte se recalcule quand ils changent sur le disque.

---

**Les notifications** (branche `claude/notifications-pkpvy9`, 6 octobre 2026,
demandées par Gaël). Il se dépose avec ce qui est en dessous, ou seul.

- Prévenir un joueur dont le jeu est fermé, sur son téléphone ou son
  ordinateur, pour deux choses : **un vote de son KOP qui s'ouvre** (les
  membres, sauf celui qui l'ouvre) et **un duel classé qui attend un supporter
  de son club** (une fois par match, et pas plus d'un duel par heure, réglable
  dans `/admin`). Jamais la nuit, de 22 h à 8 h. Un message ne nomme jamais
  un joueur.
- Rien ne part sans le oui du joueur : deux interrupteurs sur la page **Mon
  compte**, valables pour cet appareil, puis la fenêtre du navigateur. Sur
  iPhone, seulement depuis le jeu installé sur l'écran d'accueil (la carte le
  dit). Se déconnecter coupe les notifications de cet appareil ; supprimer son
  compte les efface toutes.
- `src/server/notifications/index.js`, `public/sw.js` (l'affichage),
  `public/pwa.js` (l'inscription), `public/compte.html`, `public/menu.js` (la
  déconnexion), le KOP et les duels qui préviennent. Un paquet neuf,
  `web-push`, que la construction du Manager installe. `CONFIDENTIALITE.md` a
  son paragraphe, à faire relire. Contrôlé par `npm run notifications:smoke`
  (37 contrôles neufs) et `npm run pwa:ui` (7).

**Un schéma : `sql/notifications.sql`**, deux tables neuves, rien de touché
ailleurs. `npm run schema:appliquer` en SSH, puis **un redémarrage** hors d'un
match en direct. **Rien à saisir dans le Manager** : les clés d'envoi se
créent seules au premier démarrage. Sans le fichier, rien ne casse : la carte
ne s'affiche pas, et le journal dit « appliquer sql/notifications.sql ».
Interrupteur d'urgence : `/admin`, section Les notifications.

---

**Le carton rouge au Fanzzy de l'accueil** (branche
`claude/carton-rouge-q3bnc0`, 6 octobre 2026, lot 7, confié par Gaël). Il se
dépose avec ce qui est en dessous, ou seul.

- `src/server/quotidien/depuis.js` : le résumé « Depuis ta dernière visite »
  compte les cartons rouges que le club suivi a pris dans chaque match (le
  rouge direct et le second jaune ; pas ceux de l'adversaire). Contrôlé par
  `npm run quotidien:smoke` (un contrôle neuf).
- `public/index.html` : le ticket l'écrit (« FC Sion perd 0–1 · carton
  rouge », raccourci en « · rouge » si la ligne est trop longue), et le
  Fanzzy se fâche à l'arrivée, sans sauter, après une défaite ou un nul où
  son club a pris un rouge. Après une victoire, il reste fier. Contrôlé par
  `npm run accueil:ui` (huit contrôles neufs).

**Aucun schéma ni réglage** : les cartons sont déjà rangés dans
`fixture_events`. **Un redémarrage** pour le serveur, hors d'un match en
direct ; la page seule n'en demande pas, mais sans le serveur à jour elle ne
reçoit aucun rouge à raconter.

---

**L'administration lisible** (branche `claude/sons-fid6tr`, 6 octobre 2026,
vu par Gaël sur `/admin`). Il se dépose avec ce qui est en dessous, ou seul.

- `public/nav.js` : sur `/admin`, la photo de tribune et son voile passaient
  devant la page ; les chiffres de l'aperçu, les tableaux et le titre étaient
  invisibles. L'administration retrouve son fond sombre, sans photo. Rien ne
  change sur les autres pages. Contrôlé par `npm run admin:ui` (un contrôle
  neuf).

**Aucun schéma ni réglage.** Déposée seule, la page part sans redémarrage
(fichier statique). Si l’ancienne page reste affichée, un rechargement suffit.

---

**Les seuils de division recalés depuis l'administration** (branche
`claude/seuils-division-eahsmj`, 6 octobre 2026, demandé par Gaël). Il se
dépose avec ce qui est en dessous, ou seul.

- `src/server/admin/index.js`, `src/shared/saison.js`, `public/admin.html` :
  dans `/admin`, RÉGLAGES, section LA SAISON ET SES PALIERS, un cadre
  **RECALER LES DIVISIONS** lit la ferveur classée de la saison des seuls
  joueurs sans abonnement et propose les quatre seuils ; **Poser ces quatre
  seuils** les écrit. Contrôlé par `npm run admin:smoke` et `npm run
  admin:ui` (20 contrôles neufs).

**Aucun schéma.** Le serveur change : **redémarrer** après la construction,
hors d'un match en direct. Ensuite, pour Gaël : saisir le **31 décembre 2026**
comme dernier jour de jeu de la saison 1 (SAISONS, Modifier), puis, après
deux semaines de jeu au moins, ouvrir le cadre et cliquer **Poser ces quatre
seuils**. Les seuils ne changent pas tant qu'on n'a pas cliqué.

---

**La tenue d'en face au duel** (branche `claude/tenue-duel-4bbx7e`,
6 octobre 2026, demandé par Gaël). Il se dépose avec ce qui est en dessous, ou
seul.

- `src/server/deck/index.js`, `src/server/nvn/engine.js`,
  `src/server/nvn/index.js` : la vue du duel dit, pour chaque joueur, l'âge
  de son Fanzzy en tribune et la tenue qu'il lui a mise à cet âge ; l'affiche
  dit la tenue de chacun. Les bots d'entraînement restent en tenue de base.
- `public/duel-nvn.html` : le Fanzzy d'en face paraît dans sa tenue, dans
  l'arène et sur l'affiche, et la Relève le fait grandir à l'écran (avant,
  l'arène gardait le premier âge, des deux côtés). Contrôlé par
  `npm run nvn:smoke` et `npm run nvn:ui` (contrôles neufs).

**Aucun schéma ni réglage.** Un redémarrage, **hors d'un match en direct**
(le serveur change). La page seule, sans redémarrage, ne casse rien : elle
garde alors la tenue de base pour celui d'en face.

---

**Le personnage de l'accueil au milieu, sur téléphone** (branche
`claude/project-thread-iatg2m`, 6 octobre 2026, choisi par Gaël sur la
capture avant/après). Il se dépose avec ce qui est en dessous, ou seul.

- `public/index.html` : sur un téléphone, le personnage de l'accueil se tenait
  une trentaine de pixels à droite de son ombre, de son décor et de son nom.
  Il se tient maintenant au milieu, à la même taille, et Firefox le dessine
  aussi grand que Chrome. Rien ne change sur ordinateur ni sur tablette.
  Contrôlé par `npm run accueil:ui` (un contrôle neuf).

**Aucun schéma ni réglage.** Déposée seule, la page part sans redémarrage
(`page()` relit la page à chaque demande).

---

**Le personnage de l'accueil sous Firefox** (branche
`claude/project-thread-iatg2m`, 6 octobre 2026). Un défaut déjà en ligne, vu
par Gaël sous Firefox 140 ESR. Il se dépose avec ce qui est en dessous, ou
seul.

- `public/index.html` : sous Firefox, l'accueil s'affichait sans son
  personnage (l'ombre au sol, le décor et la bulle restaient). Les calques de
  gestes qui l'entourent prennent maintenant toute la largeur de la scène.
  Rien ne change dans Chrome. Contrôlé par `npm run accueil:ui` (un contrôle
  neuf, sur un écran d'ordinateur) ; mesuré sous Firefox 136 et Chrome sur
  neuf tailles d'écran.

**Aucun schéma ni réglage.** Déposée seule, la page part sans redémarrage
(`page()` relit la page à chaque demande).

---

**Le duel vivant** (branche `claude/project-thread-iatg2m`, 5 octobre 2026,
lot 7). Il se dépose avec ce qui est en dessous, ou seul.

- `public/duel-nvn.html` : le Fanzzy en tribune de chaque camp se tient dans
  l'arène du duel, sous la corde, le sien à gauche et celui d'en face à
  droite, tourné vers lui. Il se penche quand sa tribune pousse, saute de
  joie au but de sa tribune (de corde ou du vrai match), accuse le coup
  quand l'autre marque, et se fâche quand un coup d'en face tombe sur la
  sienne. La case « LA CORDE CÈDE ! » se pose au-dessus de la corde pour
  qu'on les voie. Contrôlé par `npm run nvn:ui` (9 contrôles neufs) ; filmé
  pour Gaël (`lot7/duel/duel-vivant.mp4` dans les fichiers du projet).

**Aucun schéma ni réglage**, aucune image neuve, rien de neuf demandé au
serveur. Déposée seule, la page part sans redémarrage (`page()` relit la page
à chaque demande).

---

**Le but du vrai match au duel** (branche `claude/project-thread-iatg2m`,
5 octobre 2026). Un défaut plus ancien que le lot 6, donc déjà en ligne.

- `public/duel-nvn.html` : chaque vrai but marqué pendant un duel faisait
  lever la page (« number 1 is not iterable ») : pas de case « GOAL ! », pas
  de corne, et la corde qui cède perdue avec quand ce but la faisait céder.
  La page lit maintenant la tribune du buteur telle que le serveur l'envoie.
  Contrôlé par `npm run nvn:ui`, où ce but part désormais du serveur.

**Aucun schéma ni réglage.** Déposée seule, elle part sans redémarrage
(`page()` relit la page à chaque demande).

---

**Le Fanzzy vivant** (branche `claude/project-thread-iatg2m`, 5 octobre 2026,
point 4 du lot 7). Il se dépose avec le lot 7 juste en dessous, ou seul.

- `public/index.html` : à l'arrivée sur l'accueil, le Fanzzy raconte le
  dernier match du club suivi le temps du ticket de retour (la joie et un
  saut après une victoire, le dépit sans saut après une défaite), fête un
  retour après 48 heures d'absence, et répond quand on insiste : trois
  touchers d'affilée, la joie ; six, la colère, et il ne saute plus pendant
  1,8 seconde. Contrôlé par `npm run accueil:ui` (17 contrôles neufs).

**Aucun schéma ni réglage**, et rien de neuf demandé au serveur : la page lit
le retour (`/api/quotidien?retour=1`) que le serveur en ligne sert déjà.
Déposée seule, elle part sans redémarrage (`page()` relit `index.html` à
chaque demande).

---

**Le foulard, la corde tressée, et le monde qu'on voit enfin** (branche
`claude/project-thread-iatg2m`, PR #3, 5 octobre 2026). Elle part de la
branche du relevé des buts, juste en dessous, et se dépose avec elle.

- `src/server/ferveur/virage.js`, `src/shared/reglages.js` : quand le camp
  qui mène n'a personne qui chante en face, la corde retombe de 3 points par
  seconde au lieu de 1,4. Réglage `virage.decroissance_vide`, dans la
  section Virage de l'administration ; à 1,4, on revient à l'ancien jeu. La
  corde qui retombe part aussi aux écrans, deux fois par seconde au plus,
  avec `pousse` : le camp qui a vraiment poussé depuis la diffusion
  précédente. Contrat : `serveur/CONTRATS.md`, § 16.7. Contrôlé par `npm run
  salles:test`.
- `public/virage.html` : « PERSONNE EN FACE » sur la tribune vide, et la
  foule ne saute plus que lorsque son camp a poussé. Contrôlé par `npm run
  virage:ui`.
- `public/index.html`, `public/menu.js`, `public/ui.css` : le bandeau de
  l'accueil (« 37 supporters dans les virages · 3 duels attendent un
  joueur »), qui mène là où il y a le plus de monde, et les mêmes nombres
  sur les tuiles VIRAGE et DUEL du tiroir. Contrôlé par `npm run accueil:ui`
  et `npm run menu:smoke`.
- `public/ui.css`, `public/img/arene/foulard-noeud.*` : le foulard noué au
  Virage et au duel, la corde tressée et les six silhouettes au pochoir
  (points 1 à 3 du brief du lot 7).

**Aucun schéma** : le réglage nouveau vaut 3 tant que personne n'y touche.
Un redémarrage, hors d'un match en direct, puis relever `/healthz`. Les
pages tolèrent le serveur d'avant (sans `pousse`, la foule suit le sens de
la corde), mais le serveur et les pages partent ensemble.

---

**Le relevé des buts et le voile du Virage** (branche
`claude/project-thread-jyhm3m`, 5 octobre 2026). Le lot 6 est en ligne depuis
le 5 octobre 2026 (schéma `sql/arenes.sql` appliqué, serveur redémarré) : ce
qui suit sous « Archive » le décrit et ne se rejoue pas.

- `src/server/football/poller.js` : tant que la liste des événements d'un
  match compte moins de buts que le tableau, chaque tour du direct redemande
  ses événements, au plus `RELANCES_MAX` (9) tours. Le but que l'API publie
  après le score part au tour qui le trouve, au lieu d'attendre le changement
  de score suivant (club suivi, salle vide) ou la minute (salle occupée).
  Coût : au plus neuf appels d'événements de plus par but, seulement quand
  la liste est en retard. Contrôlé par `npm run releve:test`.
- `public/virage.html` : la photo du tunnel (`img/ecran/tunnel-portrait` et
  `tunnel-paysage`, déjà en ligne pour l'accueil) derrière le voile de choix,
  à la place de la photo de tribune.

**Aucun schéma.** Un redémarrage, **hors d'un match en direct** où des joueurs
sont au Virage (les salles vivent en mémoire), puis relever `/healthz`.

---

# Archive : le lot 6


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
   bloquant pour la livraison. Tranché le 6 octobre 2026 — celui du match —, et
   déposé à part (« Le stade du match, au duel », en tête de ce fichier).
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
match (une ligne dans `engine.js`, une règle de jeu ; tranché le 6 octobre 2026, en
tête de ce fichier) ; **`gains.wallet`** dans `nvn:fin`,
non servi ; **un combo en jeu au duel** (`serie` sur l'évènement `chant`), refusé tant
qu'aucune page ne le lit ; **`nvn:net`** hors de `npm test` ; les trois questions du
correctif d'urgence du Virage (la priorité du but réel sur les autres moments d'un
même geste, tranchée le 6 octobre 2026, en tête de ce fichier ; les cartes-souvenirs
d'un but ancien, un trou de suite). Et, comme avant :
`paliers.series` avec l'état et la chance d'une carte, que les écrans du lot 4 attendent ;
les boosters d'un abonnement acheté ; le contrôle de démarrage qui ne vérifie que la
première des trois colonnes de `sql/couleurs.sql` ; faire suivre `comments` dans les
événements du télétexte, pour que `/matchs` reconnaisse la séance comme le relevé.
**Le lot 7** reprend les images (le foulard, la corde, les silhouettes, des dessins de
chant en 2:3), **le tunnel pour le voile du Virage** — la photo existe depuis
l'intégration, la page ne la nomme pas encore — et la passe de matière des gestes
positionnels.
