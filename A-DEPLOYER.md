# À déposer sur Infomaniak

**Atelier « l'économie et le social FAIT MAIN », 2 et 3 octobre 2026.** Il a
mené ensemble les trois arbitrages de palette de Gaël, les lots 3 et 5 de la
refonte — le kiosque, l'ouverture d'un booster, le butin, la boutique,
l'abonnement ; le profil, le classement, le KOP, les amis, les missions, la fête
de niveau —, la première vague du chantier serveur (le quotidien : missions du
jour, bonus de présence, saison datée, paliers) et le son de tribune. Le récit
est dans `HISTORIQUE.md`, section 4 quadragies ter.

**Une migration en production : `sql/quotidien.sql`**, quatre tables et neuf
colonnes, additive et rejouable. Aucune dépendance : `package.json` ne gagne que
quatre scripts (`son:smoke`, `son:banc`, `recompenses:smoke`,
`quotidien:smoke`), `package-lock.json` n'a pas bougé. Le lot 2 est en ligne
depuis le 2 octobre (`7dc5464`), et ses documents sont commités.

---

## Où en sont le dépôt et la production

Relevé le 3 octobre 2026 à 8 h 25.

- **La production sert le commit `e21a923`** (« Maj V03102026.0112 »), poussé
  sur `main` et sur `origin/main`. Gaël l'a pris pendant l'atelier, entre le
  deuxième et le troisième tour de vérification, avec les documents du lot 2.
  `/son.js`, `/fx.js`, `/ui.css`, `/boosters`, `/profil` et `/aide` sont ceux du
  commit, octet pour octet ; `uptime_s` dit un redémarrage vers 1 h 13, et
  `"version": null` une mise en ligne par le Manager.
- **Son schéma n'a pas été appliqué.** `/healthz` répond `ok: false`, avec la
  panne « SCHÉMA INCOMPLET » qui ne nomme que `sql/quotidien.sql` : les tables
  `recompenses`, `missions_jour`, `compteurs_jour`, `user_nouveautes`, et les
  colonnes `saisons.fin_le`, `ouvre_le`, `carnet`, `user_wallet.rangs_vus`,
  `visite_a`, `instantane`, `virage_presence.chants`, `chants_mt1`,
  `chants_mt2`. **Rien n'est cassé pour un joueur** : le quotidien répond
  « inactif », les missions et le bonus n'apparaissent pas, les chants du Virage
  ne se comptent pas, le reste du jeu tourne. `"quotidien":"actif"` dit seulement
  que le module est monté.
- **La sonde du jour de jeu a parlé** : `jourDeJeu.changeA` vaut `00:00`, heure
  de Zurich (la base répond `CEST`, `+02:00`). Missions, bonus et quotas
  changeront de jour à minuit pile : rien à décider.
- **Trente-six fichiers ont changé depuis ce commit, et ne sont ni commités ni en
  ligne** : les corrections des tours 3 à 6 et des critiques. Ce sont eux que le
  dernier tour a vérifiés. Six sont côté serveur, et trois comptent avant d'ouvrir
  le quotidien :
  - `src/server/quotidien/missions.js` et `index.js` : la lecture du quotidien
    parcourait la journée du football à chaque arrivée au hub — un appel
    `/fixtures` à l'API sportive dès que le cache de quarante-cinq secondes
    expire ;
  - `src/server/fanzzy/index.js` : les crans de collection comptaient les
    tenues, que l'abonnement ouvre toutes — de l'argent réel changé en
    récompenses ; et `wallet.packMax`, `paye`, que le kiosque lit ;
  - `src/server/kop/index.js` : le KOP vendait « La quête » et « Mur de bâches »,
    qu'aucun moteur ne lit ; et les couleurs d'un club sans KOP ;
  - `src/server/classements/index.js` (les couleurs du club principal sur
    `/api/rank/moi`) et `src/server/nvn/index.js` (un duel fermé n'efface plus
    le duel suivant du même joueur).
- **Les documents** — `HISTORIQUE.md`, `ETAT.md`, `README.md` et ce fichier —
  ne sont pas commités non plus.

---

## Ce qu'il ne faut pas faire : appliquer le schéma seul

Appliquer `sql/quotidien.sql` sur le code en ligne et redémarrer allumerait le
quotidien de `e21a923` : la journée du football lue à chaque arrivée au hub, des
crans qui paient les tenues, et les écrans d'avant les critiques (le bonus du
jour posé sur le bouton PRENDRE MA PLACE, la mission du jour qui chasse les
premiers pas d'un joueur neuf). **Le schéma part avec la copie de travail**, dans
une seule livraison. En attendant, la production tourne sans quotidien, et c'est
sans danger.

---

## Les étapes, dans l'ordre

L'ordre de fond est **le schéma, puis le serveur, puis les pages** : le serveur
nouveau ne doit pas démarrer sur une base sans ses tables (il le supporterait,
mais le contrôle de démarrage ne se relit qu'au lancement), et les pages
tolèrent l'absence de ce que le serveur ne sert pas encore — pendant la minute
où l'ancien processus sert les nouvelles pages, une donnée nouvelle absente ne
s'affiche simplement pas. Une seule livraison fait les trois, si le schéma passe
avant le redémarrage.

### 1. Commiter et pousser la copie de travail

Les trente-six fichiers et les quatre documents, en un commit, poussé.
`.github/workflows/deploiement.yml` lance `scripts/verif-pages.mjs` avant de
déployer et refuse de partir s'il échoue :

```bash
npm run pages      # doit finir sur « Toutes les pages compilent » ; c'est ce que lance le workflow
npm run cablage    # « Le câblage des modules est correct » : le quotidien monté, cinq paquets de production
```

### 2. Mettre en ligne, le schéma avant le redémarrage

**Hors des heures de match** : les salles du Virage vivent en mémoire, et un
redémarrage les vide.

- **Par le workflow GitHub** (le bouton du dépôt) : il applique `sql/` dans
  l'ordre **avant** de redémarrer, puis attend que `/healthz` annonce le commit.
  Rien de plus à faire.
- **Par le Manager**, qui pousse le code et jamais le schéma : lancer la
  construction depuis l'onglet Node.js, puis, en SSH,

  ```bash
  cd ~/sites/thebestfan.online
  npm run schema:appliquer      # applique sql/ dans l'ordre, puis vérifie
  ```

  **puis redémarrer** depuis l'onglet Node.js. Le redémarrage n'est pas une
  politesse : le contrôle de démarrage — celui qui vérifie la clé primaire du
  grand livre et ferme les versements s'il ne la trouve pas — ne se relit qu'au
  lancement, et `/healthz` avec lui. Le compteur de chants, lui, se rebranche
  seul en dix minutes au plus.

Le fichier est idempotent — `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT
EXISTS`, une colonne par `ALTER` — et vient en dernier dans
`scripts/ordre-schema.mjs`. Il ne renomme rien et ne reprend aucune donnée.
Après lui, `SHOW TABLES;` en compte **47**.

### 3. Vérifier que c'est bien le code de l'atelier qui tourne

Par le Manager, `version` reste `null` et ne prouve rien. Les fichiers servis le
disent à sa place — le `?v=` contourne tout cache en chemin :

```bash
T=$(date +%s)
curl -s "https://thebestfan.online/healthz?v=$T"                                   # "ok":true, "quotidien":"actif", sans "panne"
curl -s "https://thebestfan.online/boosters?v=$T" | grep -c 'neuf\[idx\]'           # 1 attendu
curl -s "https://thebestfan.online/menu.js?v=$T"  | grep -c tbf-tiroir-missions     # 11 attendu
curl -s "https://thebestfan.online/?v=$T"         | grep -c PAS_FONDATEURS          # 3 attendu
curl -s "https://thebestfan.online/aide?v=$T"     | grep -c tbf-chemin              # 3 attendu
```

Le 3 octobre à 8 h 25 : `ok: false` et 0, 0, 0, 0 — le code en ligne est
`e21a923`. Après la mise en ligne, `uptime_s` doit être revenu à quelques
minutes, sinon le serveur n'a pas redémarré.

Dans la base, **en lecture seule** :

```sql
SHOW KEYS FROM recompenses WHERE Key_name = 'PRIMARY';   -- trois lignes : user_id, source, cle
```

Et au journal de démarrage : la ligne « jour de jeu : le jour change à 00:00,
heure de Zurich », et plus aucune ligne « [souvenirs] chants du Virage non
comptés ».

### 4. Après la livraison, à faire par Gaël

Le détail est dans `DEPLOIEMENT.md`, étape 5, « Après la livraison du
quotidien ».

1. ~~Lire la ligne du jour de jeu~~ : déjà lue le 3 octobre, `00:00`.
2. Dans `/admin`, RÉGLAGES : les trois sections LE QUOTIDIEN, LES MISSIONS DU
   JOUR et LA SAISON ET SES PALIERS sont là, aux valeurs de départ (`HISTORIQUE.md`,
   « Les montants de départ, et où les régler »).
3. Vérifier sur `/matchs` le dernier week-end de championnat avant la trêve,
   puis saisir la fin de la saison 1 dans l'onglet Saisons (proposée :
   2026-12-20). En profiter pour trancher son nom : « Le premier virage » en
   base (`sql/saisons.sql`), « La reprise » partout ailleurs.
4. Si les missions arrivent après le 19 octobre : saisir le carnet de la
   saison 1, seuils × (jours restants / 63), **avant** le premier palier versé —
   il se fige ensuite, et l'administration le refuse en le disant.
5. Recaler les quatre seuils de division sur la ferveur réelle des joueurs
   **sans abonnement** (la requête, en lecture seule, est dans
   `DEPLOIEMENT.md`).

Et, les premiers jours, la requête de détection du grand livre (`DEPLOIEMENT.md`,
« Le grand livre des récompenses ») : un pic par source et par jour s'y voit.
Chaque source a son interrupteur dans RÉGLAGES, sans livraison.

### 5. Les contrôles à l'œil

Sur un téléphone, connecté, du plus parlant au plus discret.

1. **Le hub.** Le bonus du jour dans la bâche du jour, en kraft : BONUS DU JOUR,
   l'écharpe de la semaine, « J1 » le premier jour, la bâche or RÉCUPÉRER ; le toucher, le
   tampon PRIS, les jetons qui volent vers le solde. Ensuite, la mission du jour
   à sa place — sauf pour un joueur neuf, qui voit d'abord ses premiers pas. Au
   retour après trois heures, le ticket « Depuis ta dernière visite ».
2. **Les missions** (le tiroir : la bâche MISSIONS dans sa tête, avec sa
   pastille). DU JOUR : trois tickets kraft, leur écharpe, RÉCUPÉRER quand c'est
   fait, « ↻ » pour changer une mission, le compte des changements dans
   l'en-tête. SAISON : le carnet sur sa corde. Une réclamation en deux onglets
   ne verse qu'une fois.
3. **Le kiosque.** La réserve en fentes sous la barre, la banderole de la saison,
   le sachet de LA REPRISE sur son socle sous les projecteurs — un dessin de
   repli, plus bas —, la minuterie « PRÊT DANS », le rail gris des séries
   fermées. À court d'écharpes, GAGNER DES ÉCHARPES en vert.
4. **L'ouverture.** La déchirure, les cinq dos de carte qui se vident, la forme
   de rareté au-dessus de chaque carte, NOUVEAU en tampon ; une épique a sa
   nappe et son carillon, une légendaire son flash, ses rayons, son tampon
   LÉGENDAIRE et sa vibration. Deux exemplaires d'une même carte neuve : un seul
   NOUVEAU.
5. **Le butin.** La page d'album, les cartes collées de travers, LA REPRISE et sa
   jauge qui avance, les écharpes des doublons qui volent, ENCORE UN, LE
   CLASSEUR, MON DECK.
6. **La boutique.** À LA UNE, les onglets, les filtres, « à portée d'abord »,
   VOIR LES AUTRES ; un achat : le calque, l'objet qui se révèle, « À TOI ! »,
   le ticket « −… », L'ÉQUIPER.
7. **L'abonnement.** Le PASS DE TRIBUNE en tête, BIENTÔT, puis ce qu'on garde
   sans payer.
8. **Le profil.** La carte de supporter aux couleurs du club principal, MON
   NIVEAU en chemin, MA SAISON, la feuille de match, la carte de MON FANZZY, les
   réglages derrière RÉGLAGES.
9. **Le classement.** Le podium, les lignes calmes, une bulle au toucher d'une
   ligne, ma ligne épinglée qui reste en bas au défilement ; vide : « TA PLACE
   EST LÀ ».
10. **Le KOP et les amis.** Un club suivi sans KOP : sa bâche aux couleurs, ce
    qu'un KOP apporte, ce qu'il coûte. Dans PROPOSER UNE DÉPENSE, « La quête » et
    « Mur de bâches » ne sont plus proposés. Chez les amis : INVITER AU KOP, et
    retirer derrière « ⋯ ».
11. **La fête de niveau.** Après une montée, en revenant sur le profil : la case
    de BD or, le Fanzzy en pose victoire, une seule fois.
12. **Le son.** Au Virage pendant un match : la rumeur de la tribune après le
    premier toucher, qui monte quand la tribune pousse et explose au but ; elle
    se tait onglet caché. Dans le tiroir, le volume ; « Couper les sons » coupe
    tout, rumeur comprise.
13. **Le mode calme**, animations coupées : aucune cérémonie ne bouge, la forme
    et le mot de la rareté restent ; la minuterie prête ne respire plus.

Les contrôles à l'œil du lot 2, s'ils n'ont pas été faits, sont dans la version
précédente de ce fichier : `git show e21a923:A-DEPLOYER.md`, étape 4.

---

## Ce que ça change à l'écran

- **Le papier se lit au soleil** : le kraft s'éclaircit et tout ce qu'on y écrit
  est noir ; le petit texte en or passe à la craie.
- **Le kiosque est un étal** sous les projecteurs, beau avec une seule série ;
  **l'ouverture** révèle chaque carte selon sa rareté ; **le butin** se colle sur
  une page d'album.
- **La boutique tient en deux écrans** au lieu de vingt, et un achat est une
  cérémonie ; **l'abonnement** s'ouvre sur le PASS DE TRIBUNE.
- **Le profil** est une carte de supporter, avec le chemin du niveau ; **le
  classement** un mur d'honneur, avec sa ligne épinglée ; **le KOP** une bâche
  de club avec ses gradins et son vote en case de BD ; **les amis**, des bustes.
- **Les missions** : trois par jour, un bonus de présence qui ne recule jamais,
  un carnet de saison — `/aide` s'appelle MISSIONS.
- **Partout**, le visage et le niveau des autres joueurs, et la fête de niveau
  au retour.
- **La tribune s'entend** au Virage et en duel, et l'on règle le volume dans le
  tiroir.

---

## Ce que les contrôles ne prouvent pas

**Deux suites restent rouges, et l'étaient avant le lot 0, à l'identique** :
`deck:ui` (un rouge) et `nvn:ui` (trois). `fanzzy:smoke`, la troisième, est
verte. Dernier passage, le 3 octobre de 6 h 43 à 7 h 05 : soixante et une
suites, 4 343 contrôles. **`accueil:ui` est intermittente**, sans cause trouvée :
rouge dans la série, verte seule. `abo:smoke` rougit entre minuit et deux heures
du matin à cause de son fuseau (`ETAT.md` § 2) ; lancée à 6 h 44, elle était
verte.

**Une faute de documentation, relevée au dernier tour et non corrigée** :
`/api/rank/moi` sert des champs que le contrat ne déclare pas (`avatar` et
`niveau` à la racine, `saison.fin`, `joursRestants`, `finie`), dont les écrans
dépendent. Sans effet à l'écran.

**Le sachet de LA REPRISE n'a pas de dessin.** Au centre du kiosque de
production, c'est le repli du code, une carte plate « FANZZY / LA REPRISE » :
l'image `pack-la-reprise` reste à produire (`VISUELS.md`).

**Au soleil, les faces restent sous le seuil, et c'est décidé** : la craie sur
les faces rouge, verte, bleue et violette tient 2,4 à 2,6:1, l'encre sur l'or
3,8. Ce sont les prix des arbitrages du 2 octobre.

**La version de MariaDB en production n'est pas connue.** Depuis 11.6, une
course entre deux versements se signale autrement ; le grand livre traite les
deux formes, et `recompenses:smoke` les éprouve toutes les deux.

**Le coût sur un téléphone modeste n'est pas mesuré.** Les écrans font quelques
lectures de plus — le hub, celle du quotidien et la marque de visite ; le profil,
`/api/rank/moi`, le quotidien et le catalogue des cartes ; l'abonnement, le
catalogue de la boutique —, aucune à l'API sportive. Au plus deux animations
infinies par écran, aucune au calme. Le son n'a été mesuré que hors ligne, dans
Chrome.

**Le retour arrière.** Le code se défait par un `git revert`. Le schéma peut
rester : il est additif, ses colonnes ont une valeur par défaut, et le code
d'avant ne lit pas ses tables.

---

## Ce qui reste en attente côté serveur

Les décisions que le chantier rend à Gaël — l'inflation des écharpes, l'XP du
Virage, « La quête » et « Mur de bâches » et les KOP qui les ont payés, la
saison 2, payer ou non les divisions, le dossier du juriste, et d'autres — sont
dans `ETAT.md`, § 7 bis, et le détail dans `HISTORIQUE.md`, 4 quadragies ter,
« Ce qui reste ». Les documents du chantier (`SERVEUR.md`, `CONTRATS.md`,
`PLAN.md`, `ECARTS.md`) sont restés dans le bac à sable de l'atelier : le code
les cite, et ils sont à verser dans le dépôt.
