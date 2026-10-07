# Politique de confidentialité — les notes de travail

**Publiée le 7 octobre 2026**, à l'adresse `/confidentialite`. Le texte que lisent
les joueurs est `public/confidentialite.html`, et **c'est lui qui fait foi**. Ce
fichier garde ce que la page ne dit pas : d'où vient chaque phrase dans le code,
ce qui a changé à la publication, et ce qui reste ouvert.

L'éditeur : **Gaël Manigley, entreprise individuelle, 1085 Vulliens (Suisse),
info@thebestfan.online**, donnés par Gaël le 7 octobre 2026. Il écrivait
« société individuelle » : en droit suisse, une personne seule exploite une
*entreprise individuelle* (sa raison de commerce est une « raison individuelle »).

Le texte n'a pas été relu par un juriste. Gaël a choisi de le publier d'abord
(« Publier d'abord », 6 octobre 2026), puis d'allumer lui-même la présence des
amis (`presence.actif`, dans `/admin`).

---

## Si tu changes une durée, un cookie ou ce que les autres voient

**Change la page dans le même commit.** `npm run confidentialite:smoke` relit
dans le code chaque nombre que la page annonce — sessions, tentatives de
connexion, derby, présence, quotidien, nouveautés, nuit des notifications,
cookie — et rougit quand les deux divergent. `npm run auth:smoke` vérifie ce que
la suppression d'un compte efface et garde, et l'entretien des sessions et des
tentatives ; `presence:smoke` et `notifications:smoke`, ce que promettent leurs
rubriques.

---

## Où chaque rubrique a été lue

- **Qui** : l'hébergement et le stockage en Suisse, `DEPLOIEMENT.md`.
- **À l'inscription** : `sql/auth.sql` (`users` : adresse, pseudo, hachage,
  langue) et `src/server/auth/routes.js`. Google, `src/server/auth/google.js` :
  portée `openid email profile` ; le serveur ne lit que l'adresse, sa
  vérification, le prénom (ou le nom, ou le début de l'adresse) pour le pseudo
  de départ, et la langue. Le compte reçoit un mot de passe aléatoire que
  personne ne connaît.
- **En jouant** : les tables de `sql/` ; le quotidien, `sql/quotidien.sql` ;
  les pronostics, `sql/pronostics.sql` ; le grand livre, `src/server/recompenses.js`.
- **Ce que les autres voient** : les classements, `src/server/classements/index.js`
  (pseudo, club principal, scores ; les comptes supprimés en sont écartés) ; les
  amis, `src/server/amis/index.js` (suggestions par club commun : pseudo, Fanzzy,
  niveau et clubs communs seulement ; lien d'invitation : pseudo et Fanzzy) ; le
  KOP, `src/server/kop/index.js` (ce que chacun a versé au pot, sa date
  d'entrée) ; le duel, `src/server/nvn/index.js` (`affiche` : pseudo, Fanzzy du
  deck et leurs tenues ; `forme` : cinq derniers résultats ; les effets portés) ;
  le derby, au même endroit (`DERBY_FRAIS_MS` : quatre minutes en mémoire, un
  club et jamais un nom).
- **La présence** : `src/server/presence/index.js`, `src/shared/reglages.js`
  (`presence.*`), `serveur/CONTRATS.md` § 18.
- **Les notifications** : `src/server/notifications/index.js` (`estLaNuit`) et
  `sql/notifications.sql`.
- **La sécurité** : `sql/auth.sql` (`sessions` : l'IP et le navigateur à
  l'ouverture ; `login_attempts` : les échecs seulement, qu'une connexion réussie
  efface) ; `cleanup()`, dans `src/server/auth/store.js`, que `server.js` lance au
  démarrage puis toutes les vingt-quatre heures ; le débit par adresse, en
  mémoire, dans `src/server/garde/index.js` ; le journal d'administration,
  `admin_audit` (`src/server/admin/index.js`), qui nomme un joueur par son
  identifiant public.
- **Le paiement** : `src/server/boutique/index.js`. Stripe Checkout : la carte et
  l'adresse se saisissent chez Stripe ; `achats` garde l'article, le montant, la
  session Stripe et l'identifiant public.
- **Les autres services** : la politique de contenu de `src/server/garde/index.js`
  (polices Google, images de `media.api-sports.io`, rien d'autre) et sa
  `Referrer-Policy` (`strict-origin-when-cross-origin`).
- **Les cookies** : `tbf_session` seul (`COOKIE`, posé par `routes.js` et
  `google.js`). La mémoire du navigateur : la langue (`tbf_locale`), le son
  (`tbf-son`, `tbf-volume`), le calme (`tbf-calme`), des marques « déjà vu », et
  le code d'un lien d'invitation (`tbf.parrainage`), envoyé une fois à
  l'inscription.
- **Les durées** : le quotidien, 400 jours (`src/server/quotidien/index.js`, au
  tirage du jour du joueur) ; les nouveautés, 60 jours (`src/server/fanzzy/index.js`,
  à la lecture). Ces deux purges sont **paresseuses** : un joueur qui ne revient
  pas garde ses lignes avec son compte, et la page le dit (« à ta visite
  suivante »).
- **La suppression** : `deleteUser`, `src/server/auth/store.js`. Restent, attachés
  au compte anonymisé : la collection, les clubs suivis, les pronostics, la place
  dans un KOP et chez des amis (sous « supprime_N », sans Fanzzy : `habiller` dans
  `amis`, `avatar.js`), les parties, les présences du Virage, le grand livre, les
  achats.
- **Les factures** : dix ans, art. 958f CO.

---

## Ce qui a changé à la publication

- L'éditeur, la date et le contact, à la place des crochets.
- **Les tentatives de connexion : deux jours au plus**, au lieu des trente jours
  proposés : le code les efface au-delà d'un jour. L'entretien passe désormais
  aussi **au démarrage** ; avant, seul un minuteur de vingt-quatre heures le
  lançait, et un serveur relancé chaque jour ne purgeait jamais.
- **Les sessions** : l'IP et le navigateur servent à savoir d'où un compte a été
  ouvert. Le brouillon promettait de « fermer ses appareils », mais aucun écran
  ne les liste.
- **Le pseudo et l'adresse ne se changent pas depuis le compte** (seuls la langue
  et les clubs) : il faut écrire.
- **Google** transmet aussi le nom, la langue et la photo. Seuls l'adresse et la
  langue sont gardés ; le prénom devient le pseudo de départ. Un compte ouvert par
  Google n'a pas de mot de passe : pour le supprimer, « Mot de passe oublié ? »
  d'abord, ou écrire.
- **Ajouté** : les pronostics ; le club aux classements ; ce que voit un
  adversaire en duel ; les suggestions d'amis et le lien d'invitation ; le KOP ; le
  derby ; le débit par adresse ; le journal d'administration ; les autres services
  (Google Fonts, les images d'API-Football, Infomaniak pour les e-mails) ; la
  mémoire du navigateur, précisée.
- Les purges paresseuses du quotidien, dites telles qu'elles sont.
- **Les mineurs** : la règle annoncée à Gaël le 6 octobre (« le jeu est ouvert à
  tous ; un mineur demande l'accord d'un parent avant de s'abonner »), et un
  parent peut écrire.
- Les autorités : celle du pays de chacun (le jeu parle aussi allemand et
  espagnol), plus seulement la CNIL et le PFPDT. La réponse, sous trente jours
  (le délai suisse ; le RGPD dit un mois).

---

## Ce qui reste ouvert

- La relecture par un juriste.
- La page est en français seulement ; la porte de connexion le dit dans ses trois
  autres langues.
- Les polices viennent de Google : les servir depuis le site retirerait Google de
  la liste des services que le navigateur appelle.
- Un compte supprimé garde sa place chez ses amis et dans son KOP, sous
  « supprime_N » : l'en retirer serait plus propre.
- Si Gaël change `presence.visible_defaut`, la page, qui dit « par défaut tu es
  visible de tes amis », est à réécrire : `confidentialite:smoke` le rappelle.
- `MENTIONS-LEGALES.md` et `CGV.md` restent à compléter (numéro IDE, TVA,
  téléphone) et ne sont pas publiés.
