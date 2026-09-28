# À déposer sur Infomaniak

**Session « la revue des vingt-quatre écrans ».** Une relecture page par page et
script par script, demandée parce que l'application faisait peur à lancer : bugs
d'affichage, flèche de retour qui ne revenait pas, crainte d'un plantage.

Il n'y a **aucun changement de schéma** dans ce lot : rien à appliquer, rien à
migrer, aucune colonne, aucune table. Le retour arrière est un `git revert` des
commits, sans autre manœuvre.

Il y a en revanche **une chose à changer dans le Manager avant de déployer**, et
elle est décrite juste en dessous. Si tu ne lis qu'un paragraphe de ce fichier,
lis celui-là.

---

## Avant tout : la commande de construction doit changer

Dans l'onglet Node.js du Manager, la commande de construction est aujourd'hui :

```
git pull && npm ci && node build.mjs
```

Elle doit devenir :

```
git pull && npm ci --omit=dev && node build.mjs
```

**Pourquoi c'est urgent et pas cosmétique.** Les suites d'interface pilotent un
vrai navigateur, et `puppeteer` est donc devenu une dépendance déclarée du
dépôt. Son script d'installation **télécharge Chromium** : environ deux cents
mégaoctets au transfert, sept cents une fois dépliés. `npm ci` installe les
dépendances de développement par défaut, donc la prochaine construction va
tenter ce téléchargement sur l'hébergement mutualisé — du quota, du temps, et
surtout une étape de plus qui peut échouer. **Un `npm ci` qui échoue arrête tout
le déploiement**, pour un navigateur dont le serveur n'a aucun usage.

Le serveur n'a besoin que de cinq paquets : `express`, `mysql2`, `nodemailer`,
`socket.io`, `socket.io-client`. Ni `server.js`, ni `build.mjs`, ni `src/`, ni
`npm run schema:appliquer` n'importent `puppeteer`, `sharp` ou `jsdom` — ces
trois-là ne servent qu'aux `scripts/`, qui ne tournent jamais sur le serveur.
C'est vérifié par un contrôle, `npm run cablage`, pour que la règle ne tienne pas
à la mémoire de quelqu'un.

`scripts/deployer.sh` a déjà reçu la correction : le déploiement par le workflow
est donc à l'abri. Seule la mise en ligne à la main, par le Manager, garde le
défaut — d'où ce paragraphe.

---

## Ce que ça corrige

### Les effets : un dictionnaire, et 377 malus annoncés comme des bonus

**La question posée était : « est-ce que les attributs des Fanzzy, des stuff et
des stades sont pris en considération durant les duels et le Virage ? »** Ils
l'étaient — le serveur les compose depuis toujours. Rien ne le montrait, et en
allant câbler l'affichage on a trouvé pire que l'absence.

La table qui met des mots français sur les effets existait en **cinq copies** :
les cartes, le deck, la fiche d'un Fanzzy, et les deux documents générés. Trois
d'entre elles étaient fausses.

Celle des cartes calculait le signe et en écrivait un second en dur devant :

```js
`Souffle +${Math.round((m.breathBonus - 1) * 100)} %`   // breathBonus: 0.85
```

Ce qui donne à l'écran **« Souffle +-15 % »**. Mesuré sur le catalogue réel :
**377 occurrences, sur dix clés différentes** — c'est la majorité des malus du
jeu. Elle écrivait aussi « Tempo plus tolérant (×0.9) », où le mot dit l'inverse
du nombre, et « Martelage 0,5 s plus court » pour une valeur qui l'allonge.

Celle de la fiche d'un Fanzzy ne nommait ni `parryResist` — **103 cartes** — ni
`costPenalty` — 17. C'est mot pour mot le défaut que les cartes disaient avoir
corrigé chez elles, et qui vivait toujours là.

Et le même effet ne portait pas le même nom : `costPenalty` était « Chants plus
chers » sur une carte, « Coût des cartes » sur le deck, « prix des cartes » dans
le dossier. Un joueur qui lit sa carte puis son deck pouvait croire qu'il avait
deux effets.

Il n'y a plus qu'une table, dans `public/mods.js`, et les quatre écrans y
renvoient. Le sens de chaque clé y est déclaré, parce qu'il **ne se déduit pas du
signe** : un `tempoInterval` positif est un malus — les Jumelles portent `+70` et
leur texte dit « tu vois venir le rythme, *mais tu chantes plus lentement* » — et
un `costPenalty` plus grand aussi. Deux des cinq copies s'y étaient trompées.

Le contrôle a changé de nature avec. Il lisait le fichier à l'expression
régulière et vérifiait qu'une clé était *mentionnée* : une clé mentionnée dans
une phrase fausse passait, et c'est ce qui est arrivé 377 fois sous un contrôle
vert. Il **exécute** maintenant la table dans un bac à sable et éprouve ses
phrases sur les **517 valeurs** réellement portées par le catalogue,
l'équipement et les stades.

### Le panneau « ce que tu portes »

C'est ce qui était demandé, et il n'existait dans aucune des deux arènes. Une
ligne repliée sous le souffle — « CE QUE TU PORTES · 3 bonus · 2 malus » — et un
panneau qui s'ouvre au toucher : une source par bloc, avec son nom, ses effets
colorés et signés, puis le total que le serveur applique vraiment.

Le total est affiché **à part et jamais recalculé** depuis les blocs. La page
pourrait les additionner, et elle le ferait mal le jour où une règle de
composition se nuance.

Côté serveur, le Virage envoyait déjà la ventilation ; **le duel ne l'envoyait
pas**, alors que c'est la seule arène où le joueur a choisi ce qu'il porte. Il
l'envoie maintenant, par le même module partagé, pour que les deux écrans ne
nomment pas les mêmes choses autrement.

Un contrôle neuf vérifie que le nom d'un KOP est échappé avant d'entrer dans le
panneau : ce nom est choisi par des joueurs, il voyage jusqu'à un `innerHTML`, et
un KOP nommé `<img onerror=…>` aurait exécuté son script chez tous ses membres au
milieu d'un match.

### Les données : une carte dont on ne pouvait pas changer la série

Dans `/admin`, le filtre des séries et le champ SÉRIE du formulaire d'édition
portaient **le même identifiant** (`f-set`), et les deux sont à l'écran en même
temps — le formulaire s'insère dans le tableau, sous la barre de filtres.
`getElementById` rendant le premier du document, tout le code qui croyait lire ou
écrire le formulaire lisait et écrivait le filtre.

Trois conséquences, aucune visible :

- changer la série d'un Fanzzy dans le formulaire **n'avait aucun effet** ;
- toute carte créée recevait **la première série du catalogue**, quel que soit le
  choix fait à l'écran ;
- ouvrir une carte à modifier déplaçait discrètement le filtre de la liste.

C'est le seul défaut de ce lot qui ait pu écrire de fausses données. Un contrôle
neuf refuse désormais tout identifiant écrit deux fois dans une page
(`npm run pages`), avec une liste de tolérances documentée pour les quatre noms
que l'administration réemploie légitimement d'un onglet à l'autre.

### La navigation : la flèche de retour

- **`/admin` n'en avait aucune.** `nav.js` pose sa barre *dans* la colonne, et la
  première vue de l'administration réécrit cette colonne en entier : la barre
  apparaissait puis disparaissait, flèche comprise. La flèche est maintenant
  écrite dans l'en-tête propre de la page, `nav.js` ne double plus la barre, et
  sa poignée est déléguée au document — donc n'importe quelle flèche portant la
  classe se comporte comme les autres.
- **Sur `/matchs`, la porte « GRAND VIRAGE » éteinte portait `href="#"`.**
  `pointer-events:none` arrête le doigt mais pas la touche Entrée : un clic
  clavier empilait une entrée d'historique, et la flèche demandait ensuite deux
  pressions dont la première ne faisait rien de visible.

### Les dates : un jour de décalage aux abords de minuit

Le ruban de jours de `/matchs` tirait son adresse de `toISOString()` — donc un
jour **UTC**, ce qui est juste : la route appelle l'API avec `timezone: 'UTC'` et
met sa réponse en cache sous cette clé. Mais il s'étiquetait en **heure locale**.

À 00 h 30 à Zurich le 28, le bouton affichait « AUJOURD'HUI · 28 sept. » et
rapportait les matchs du 27 ; à 20 h à Montréal, il annonçait le jour en cours et
rapportait ceux du lendemain. « HIER » montrait alors des matchs à venir. La
liste n'était pas fausse — elle répondait à une autre question que celle imprimée
sur le bouton.

### Les champs de recherche, détruits pendant qu'on tape

Sur `/teletext` et dans les trois recherches de `/admin`, le rafraîchissement
réécrivait le conteneur qui porte le champ de saisie. Mesuré au navigateur : nœud
différent, focus perdu, curseur revenu à zéro. Sur téléphone, le clavier se
refermait — après chaque bout de mot dans le télétexte, qui sert justement à
trouver une compétition parmi neuf cent cinquante.

### Les boutons qui se taisaient quand le serveur refusait

Sept endroits appelaient le serveur sans rattraper le refus : l'écran ne montrait
alors **rien du tout**, ce qui ne se distingue pas d'un clic qui n'a pas pris —
donc on reclique. Dans `/admin` : purger le cache, l'envoi de contrôle, les deux
boutons de publication, et la remise d'un réglage au défaut, celui-ci affirmant
même « rendu au défaut » sans avoir rien rendu. Dans `/equipes` : le retrait d'un
club jetait sa réponse, et `api()` pouvait échouer sur une coupure réseau sans
que les trois gestionnaires n'attrapent quoi que ce soit.

### La porte d'entrée de l'administration

Elle confondait « pas connecté » et « serveur injoignable » : les deux
renvoyaient sur `/compte`. L'exploitant se retrouvait donc sur l'écran de
connexion au milieu d'une panne, à se demander pourquoi sa session avait sauté —
depuis l'écran qui sert justement à diagnostiquer les pannes. Seul un refus
d'authentification y renvoie désormais ; le reste s'affiche sur place, avec de
quoi réessayer. Le contrôle d'accès n'a pas bougé : il n'a jamais été là, chaque
route `/api/admin` vérifie le droit côté serveur.

### Le direct, qui pouvait se figer pour de bon

Sur la fiche d'un match, une exception en dessinant emportait la replanification
avec elle : plus de relecture, plus de chrono, un score arrêté à la minute de
l'incident **pour le reste de la visite**. Le dessin est maintenant isolé et la
minuterie se replanifie dans tous les cas. Deux écrans ne se rafraîchissaient pas
non plus au retour sur l'onglet, et l'horodatage « Mis à jour à 21:34 » restait
affiché à 21:50.

---

## Les étapes, dans l'ordre

### 1. Changer la commande de construction

Voir le paragraphe du haut. C'est la seule action de configuration de ce lot.

### 2. Déployer

Par le workflow si les secrets SSH sont posés — `deploiement.yml` lance
`scripts/deployer.sh`, qui est déjà corrigé. Sinon, à la main dans le Manager,
avec la commande ci-dessus.

`npm ci` et non `npm install` : `npm install` réécrit `package-lock.json` sur le
serveur, le dépôt devient sale, et le `git pull` suivant refuse de fusionner sans
le dire. C'est ce qui a déjà bloqué une livraison entière.

Attendre la fin de la construction **avant** de redémarrer : `npm start` ne fait
jamais de `git pull`.

### 3. Pas de schéma à passer

Rien dans ce lot ne touche à la base. Le lancer ne fait pas de mal — il est
idempotent — mais il n'a rien à faire.

### 4. Vérifier que c'est bien le nouveau code qui tourne

```bash
curl -s https://thebestfan.online/healthz
```

`version` doit annoncer le commit qu'on vient de pousser, et `ok` doit être
`true`. S'il annonce l'ancien, le redémarrage n'a pas eu lieu : le site répond en
servant le code d'avant, et tout ce qui suit serait vérifié pour rien.

### 5. Les huit contrôles à l'œil

Dans cet ordre, du plus grave au plus cosmétique.

1. **Un malus se lit comme un malus.** N'importe quelle carte qui en porte un —
   la plupart en ont — dans le classeur ou la collection. On doit lire
   « Souffle −15 % », avec **un seul signe**. Si tu vois « +-15 % », le nouveau
   `mods.js` n'est pas servi : vide le cache du site.
2. **Le panneau des bonus.** Entre dans un Virage ou un duel : sous la jauge de
   souffle, une ligne « CE QUE TU PORTES · n bonus · n malus ». Elle s'ouvre au
   toucher, montre une source par bloc — ton Fanzzy, chaque pièce de ton sac,
   ton KOP, le stade — et finit par le total. Un second toucher la referme.
   Dans le **duel**, vérifie qu'elle est là : c'est le côté serveur qui vient
   d'être branché, et c'est le seul de ce lot.
3. **La série d'une carte s'enregistre.** `/admin`, onglet catalogue : ouvrir un
   Fanzzy, changer sa SÉRIE, enregistrer, rouvrir. La nouvelle série doit être
   là. Puis créer une carte en choisissant une série qui **n'est pas** la
   première de la liste, et vérifier qu'elle la garde. C'est le seul contrôle de
   ce lot qui porte sur des données.
4. **La flèche de `/admin`.** Elle doit être en haut à gauche, et y rester après
   avoir changé d'onglet — c'est précisément ce qui ne tenait pas.
5. **La recherche du télétexte.** `/teletext`, taper trois lettres, s'arrêter une
   seconde, continuer à taper **sans retoucher le champ**. Le texte doit
   continuer d'arriver. Sur téléphone, le clavier doit rester ouvert.
6. **Le ruban de jours de `/matchs`.** La date écrite sous « AUJOURD'HUI » doit
   correspondre aux matchs affichés. Le décalage ne se voyait qu'entre minuit
   local et minuit UTC ; hors de cette fenêtre, ce contrôle ne peut que confirmer
   que rien n'a été cassé.
7. **Un bouton d'administration qui refuse.** Le plus simple : « Envoi de
   contrôle » sans SMTP configuré. Un reçu rouge doit apparaître en haut. Avant,
   il ne se passait rien.
8. **Retirer un club.** `/equipes`, retirer un club suivi : il doit disparaître,
   ou un message doit dire pourquoi il reste.

### 6. Et une fois : jouer

Entrer dans un Virage pendant un match, chanter, en sortir par la flèche. C'est
le parcours qui avait été rapporté cassé, et c'est celui qu'aucun contrôle
automatique ne couvre de bout en bout.

---

## Ce que les contrôles ne prouvent pas

**Trente-six suites sur cinquante-huit demandent MySQL**, et elles n'ont pas pu
tourner pendant cette revue : la machine de développement n'a ni `.env`, ni
Docker, ni `mysqld`. Elles échouent toutes sur `ECONNREFUSED 127.0.0.1:3307`, y
compris `admin:ui` et `equipes:ui` — c'est-à-dire les suites dédiées aux deux
écrans les plus modifiés de ce lot.

Ces deux écrans sont couverts par les contrôles statiques (`npm run pages`,
`npm run cablage`, `npm run promesses`) et par le balayage navigateur
(`npm run pages:navigateur`, qui ouvre les vingt-quatre écrans sans base et
vérifie qu'aucun ne lève et que chacun porte sa flèche). Ce n'est pas la même
chose que leur suite dédiée.

**Lance `npm test` là où la base répond avant de considérer ce lot vérifié.**
Vingt-deux suites sont vertes ici ; les trente-six autres attendent une base.

---

## Ce qui reste en attente côté serveur

Rien de neuf dans cette livraison. La liste est en `ETAT.md`, section « À faire
sur le serveur », et le premier point est celui qui compte : **cinq migrations
ne sont peut-être pas appliquées en production** — `minutes`, `couleurs`,
`amis`, `boutique`, `billets`. Le démarrage les contrôle et `/healthz` répond
`ok: false` en les nommant. C'est la vérification de l'étape 4, et c'est pour ça
qu'elle est là.
