# Politique de confidentialité

> **Projet à faire relire.** Ce texte décrit fidèlement ce que le code fait —
> chaque affirmation a été lue dans `sql/`, `src/server/auth/` et
> `src/server/boutique/`, et les plus importantes sont vérifiées par
> `npm run auth:smoke`. Il n'a pas été relu par un juriste, et il doit l'être
> avant d'être publié. Les passages entre crochets attendent une information que
> seul l'éditeur possède.

**Dernière mise à jour : [à dater à la publication]**

---

## Qui traite tes données

**[Nom de l'éditeur], [forme juridique], [adresse]** — ci-après « nous ».

Contact : **[adresse e-mail de contact]**

Le site est hébergé par **Infomaniak Network SA**, Rue Eugène-Marziano 25,
1227 Les Acacias, Genève, Suisse. Les données sont stockées en Suisse.

---

## Ce que nous collectons, et pourquoi

Nous ne collectons **que ce dont le jeu a besoin pour fonctionner**. Il n'y a ni
publicité, ni traceur publicitaire, ni revente de données à qui que ce soit.

### À l'inscription

| donnée | pourquoi | base légale |
|---|---|---|
| adresse e-mail | te connecter, te renvoyer un mot de passe oublié, confirmer que l'adresse existe | exécution du contrat |
| pseudo | t'identifier auprès des autres joueurs — il est **visible publiquement** | exécution du contrat |
| mot de passe | te connecter. Il est stocké **haché**, jamais en clair, et nous ne pouvons pas le lire | exécution du contrat |
| langue | afficher le jeu dans ta langue | exécution du contrat |

Si tu passes par **Se connecter avec Google**, nous recevons de Google ton
adresse e-mail, ton prénom et le fait que l'adresse est vérifiée. Nous ne
recevons ni ton mot de passe Google, ni tes contacts, ni quoi que ce soit
d'autre.

### En jouant

| donnée | pourquoi |
|---|---|
| les clubs que tu suis | te proposer leurs matchs |
| ta collection, ton deck, tes écharpes | c'est le jeu |
| tes parties : adversaires, scores, dates, durées | ton parcours, et celui de tes adversaires |
| ta présence dans un virage | la corde partagée, et les cartes-souvenirs |
| ton groupe (KOP), tes amis | les fonctions de groupe, que tu choisis d'utiliser |

### Pour la sécurité

| donnée | pourquoi | durée |
|---|---|---|
| adresse IP et navigateur de tes sessions | reconnaître tes appareils connectés et te permettre de les fermer | le temps de la session |
| tentatives de connexion (adresse ou IP, succès ou échec) | freiner les attaques par force brute | **[à fixer — 30 jours proposés]** |

C'est notre **intérêt légitime** à protéger les comptes. Sans ces traces, un
attaquant pourrait essayer des milliers de mots de passe sans être ralenti.

### Si tu t'abonnes

Le paiement passe par **Stripe Payments Europe Ltd** (Irlande). **Nous ne voyons
jamais ton numéro de carte** : il ne transite pas par nos serveurs. Nous
conservons la date, le montant, la formule et l'identifiant Stripe de la
transaction — ce qui est nécessaire pour la comptabilité et pour te rembourser
si besoin.

Stripe agit comme sous-traitant, et sa propre politique s'applique à ce qu'il
détient : <https://stripe.com/fr/privacy>

---

## Ce que nous ne collectons pas

- **Aucun traceur publicitaire.** Pas de Google Analytics, pas de pixel, pas de
  régie.
- **Aucune donnée de localisation** autre que l'adresse IP de connexion.
- **Aucune donnée sensible** au sens du RGPD.
- **Aucun profilage** : rien ne décide de quoi que ce soit à ton sujet
  automatiquement.

### Les cookies

Un seul, `tbf_session`, qui te garde connecté. Il est **strictement nécessaire**
au fonctionnement du site, et c'est pourquoi aucune bannière ne te demande de
l'accepter — le droit n'en exige pas pour ceux-là.

Le jeu range aussi quelques préférences dans la mémoire de ton navigateur
(`localStorage`) : ta langue, le dernier personnage affiché. Ces informations
**ne quittent jamais ton appareil** et ne nous parviennent pas.

---

## D'où viennent les données sportives

Les scores, les compositions et les calendriers viennent d'**API-Football**. Ce
sont des données publiques sur des matchs de football ; elles ne te concernent
pas et ne sont pas croisées avec ton compte.

---

## Combien de temps nous gardons tout ça

- **Ton compte et tes parties** : tant que le compte existe.
- **Tes sessions** : jusqu'à leur expiration ou ta déconnexion.
- **Les traces de connexion** : **[à fixer — 30 jours proposés]**.
- **Les factures et paiements** : **[à confirmer — 10 ans en France, 10 ans en
  Suisse, obligation comptable]**. Cette durée s'impose à nous et nous ne pouvons
  pas la raccourcir, même à ta demande.

---

## Ce qui se passe quand tu supprimes ton compte

Tu peux le faire toi-même, depuis **Mon compte**, en confirmant ton mot de passe.
C'est immédiat et définitif.

**Ce qui est effacé, tout de suite :**

- ton adresse e-mail,
- ton pseudo,
- ton mot de passe,
- le club que tu suivais,
- toutes tes sessions et tous les liens en attente.

**Ce qui reste, et pourquoi.** Les parties que tu as jouées restent dans
l'historique de tes adversaires, **sans ton nom**. Elles ne t'appartiennent pas
seulement à toi : effacer un duel reviendrait à réécrire la soirée de la
personne d'en face, qui n'a rien demandé. Ces lignes ne portent plus aucune
information permettant de te reconnaître.

Les factures, elles, sont conservées pour la durée légale.

C'est ce que le RGPD appelle une **anonymisation** plutôt qu'un effacement, et
c'est un équilibre assumé entre ton droit à l'oubli et celui des autres à garder
leur histoire. Si tu estimes que cet équilibre est mal placé dans ton cas, écris
à **[adresse de contact]** : nous en discuterons.

---

## Tes droits

Tu peux à tout moment :

- **accéder** à tes données et en demander une copie ;
- les **corriger** — le pseudo et l'adresse se changent depuis ton compte ;
- les **effacer**, en supprimant ton compte ;
- t'**opposer** à un traitement fondé sur l'intérêt légitime ;
- demander la **portabilité** de tes données, dans un format lisible par une
  machine.

Écris à **[adresse de contact]**. Nous répondons sous un mois.

Si notre réponse ne te satisfait pas, tu peux saisir :

- en France, la **CNIL** — <https://www.cnil.fr/fr/plaintes> ;
- en Suisse, le **PFPDT** — <https://www.edoeb.admin.ch>.

---

## Les mineurs

**[Section à trancher avec un juriste.]** Le jeu n'impose aujourd'hui aucune
barrière d'âge. Selon la règle retenue — treize ans, quinze ans, consentement
parental pour l'abonnement d'un mineur — cette section devra dire laquelle, et
le formulaire d'inscription devra l'appliquer.

En l'état, **le jeu est accessible à des mineurs et rien ne le vérifie.** C'est
une lacune connue, pas un choix.

---

## Si ce texte change

Nous te préviendrons sur le site. Une politique de confidentialité qui change en
silence est une politique à laquelle on ne peut pas se fier.
