# Le dossier à donner au juriste

**Ce fichier n'est pas un avis de droit, et il ne peut pas en tenir lieu.** Il
est là pour qu'une consultation coûte une heure au lieu de trois : il décrit
exactement ce qui est vendu, ce qui est aléatoire, et où passe la frontière
entre les deux. Le juriste n'aura pas à lire le code pour répondre.

Les questions sont posées section par section. La deuxième section est celle
qui me gêne le plus, et c'est la seule que je ne sais pas trancher seul.

---

## 1. Ce qui est vendu, exactement

**L'argent réel n'achète qu'une chose : un abonnement.**

| article | prix | périodicité | ce qu'il livre |
|---|---|---|---|
| `abo-mensuel` | 3,99 € | mensuel, résiliable | l'abonnement, et **1 booster** au paiement qui l'ouvre |
| `abo-annuel` | 39,90 € | annuel, résiliable | l'abonnement, et **6 boosters** au paiement qui l'ouvre |

Il n'existe **aucun autre article payant**. Le paiement passe par Stripe en
`mode: 'subscription'` ; le site ne voit jamais de numéro de carte.

Cette liste est tenue par une **liste blanche** dans le code —
`LIVRAISONS_PAYANTES` — et une suite de tests refuse qu'on y ajoute quoi que ce
soit sans le déclarer explicitement. Elle vérifie nommément qu'aucun article ne
se vend **comme** `billets`, `echarpes`, `packs`, `boosters` ou `fanzzy` : on ne
peut pas acheter un booster seul.

### Mais l'abonnement livre des boosters (correction du 2 octobre 2026)

Ce dossier disait jusqu'ici que l'abonnement ne livrait que lui-même, et qu'un
booster ne s'achetait pas avec de l'argent réel. **C'était faux depuis
septembre 2026.** La souscription livre des boosters : un avec la formule
mensuelle, six avec l'annuelle (`src/shared/boutique.js`, champ `packs` de la
livraison des deux articles). C'est une décision de Gaël, écrite et justifiée
dans le code : un paiement qui ne donne rien tout de suite se vit comme un
paiement qui n'a pas marché.

Ce que le code fait exactement, aujourd'hui :

- les boosters sont crédités **au paiement qui ouvre l'abonnement**, dans la
  même transaction que l'abonnement lui-même (`src/server/boutique/index.js`) ;
- les **renouvellements** payés par Stripe prolongent l'échéance et ne livrent
  rien d'autre (`src/server/abonnement/index.js`, `renouveler`) ;
- ces boosters entrent dans la réserve même au-dessus de son plafond ;
- trois bornes sont écrites à côté de la décision : le cadeau est attaché à la
  souscription et ne s'achète pas séparément, il est déclaré dans le catalogue
  (à la vue du contrôle qui surveille ce que l'argent achète), et **aucune
  monnaie ne s'achète**, ce qui empêche de transformer une carte bancaire en
  tirages à volonté.

Un booster est un tirage (section suivante). La chaîne euro → tirage, coupée à
la racine quand la monnaie achetable a disparu, est donc rouverte d'un cran,
sciemment. Le dossier le décrit ; il ne tranche pas.

### Ce que l'abonnement ouvre

Cinq choses, toutes réglables depuis l'administration :

| | sans abonnement | avec |
|---|---|---|
| boosters en réserve | 12 | 24 |
| délai entre deux boosters | 10 min | 6 min |
| clubs suivis en plus | — | +2 |
| profondeur du parcours | 20 parties | tout |
| cartes-souvenirs lisibles | 20 | toutes |

Plus deux ouvertures en tout-ou-rien : porter n'importe quelle tenue publiée, et
créer un KOP (un groupe ; **rejoindre** un KOP reste ouvert à tous).

### Ce que l'abonnement n'ouvre pas, et c'est écrit dans le code

Tous les formats de duel, tous les âges des personnages, tous les classements,
le Grand Virage. Un abonné et un non-abonné jouent au **même jeu**, avec les
mêmes chances de gagner. Une suite de tests vérifie qu'aucun réglage
d'abonnement ne gouverne le duel, le deck, la ferveur, le virage ni les
récompenses du quotidien (section 6).

C'est une règle de conception assumée — « on vend de la largeur et du confort,
jamais de la puissance » — et elle est défendue par des contrôles automatiques,
pas seulement par une intention.

---

## 2. La question qui me gêne : l'abonnement accélère un tirage aléatoire

**C'est le point à faire trancher, et c'est le seul qui ne soit pas net.**

### Les faits

Les **boosters** contiennent cinq cartes dont le contenu est **tiré au sort**.
Les taux sont fixés dans le code :

- emplacements 1 à 3 : carte commune garantie ;
- emplacement 4 : 95 % commune, 5 % légendaire ;
- emplacement 5 : 85 % commune, 15 % légendaire.

Un booster **ne s'achète pas seul avec de l'argent réel** : il n'existe aucun
article « booster ». Il s'obtient par la recharge automatique (un toutes les
10 minutes, jusqu'à 12 en réserve), contre 45 écharpes gagnées en jouant, en
cadeau du jeu (premiers pas, missions du jour, carte de présence, carnet de
saison, crans de collection — section 6) — **et avec la souscription d'un
abonnement**, qui en livre un ou six (section 1).

**Mais l'abonnement double la réserve et accélère la recharge** : 24 boosters au
lieu de 12, un toutes les 6 minutes au lieu de 10. En vingt-quatre heures, un
abonné peut ouvrir environ 240 boosters, un non-abonné environ 144.

### Pourquoi ce n'est pas, à mon sens, un coffre payant

On n'achète pas un tirage. On achète une **cadence** — un rythme
d'approvisionnement d'une ressource par ailleurs gratuite et illimitée dans le
temps. Un joueur non abonné qui joue deux fois plus longtemps ouvre autant de
boosters qu'un abonné. Rien n'est réservé à l'abonné, ni carte, ni série, ni
taux : les taux sont **identiques** dans les deux cas, et une suite le vérifie.

### Pourquoi la question mérite quand même d'être posée

Le projet lui-même a écrit, à propos d'une autre décision, qu'il valait mieux
« couper la chaîne à la racine plutôt que la border de garde-fous ». Ici la
chaîne n'est pas coupée : il existe un chemin, indirect et borné, entre un
paiement et un plus grand nombre de tirages. C'est exactement le genre de nuance
que l'on juge mal soi-même.

**Les questions à poser :**

1. Une accélération de l'obtention d'objets à contenu aléatoire, sans achat
   direct de ces objets, tombe-t-elle sous les qualifications visant les
   *loot boxes* en Belgique, aux Pays-Bas, en France et en Suisse ?
2. Le fait que le contenu aléatoire soit **purement cosmétique et sans effet sur
   le classement** change-t-il la réponse ?
3. Faut-il afficher les taux de tirage ? (Ils sont aujourd'hui dans le code, pas
   à l'écran.) La question devient plus pressante : le jeu offre désormais plus
   de boosters, et les ouvre avec une cérémonie (sachet des missions, septième
   case de la carte de présence, paliers du carnet, crans de collection).
4. **Des boosters livrés à la souscription** (un ou six, section 1) font-ils de
   l'abonnement l'achat d'un tirage, même attaché à une période d'abonnement
   et impossible à acheter seul ?
5. **Le ricochet par les écharpes.** L'abonnement double à peu près le nombre
   de boosters qu'un joueur assidu ouvre, et chaque booster rend des écharpes
   (les doublons, et 2 écharpes pour chaque carte dont la catégorie n'a plus
   rien à lui donner) : en régime établi, un abonné assidu gagne par ce
   ricochet environ 1 700 écharpes de plus par jour, qui achètent à leur tour
   des boosters. (C'était 2 700 avant le 6 octobre 2026 : une catégorie
   épuisée rendait alors une poignée entière, 11,5 écharpes en moyenne.)
   Aucune écharpe ne s'achète, mais l'argent en fait gagner davantage. Est-ce
   une monnaie achetable par la bande ? Le quotidien n'aggrave rien — il
   verse la même chose à tous —, mais le point mérite d'être posé avec les
   autres.

---

## 3. Les écharpes : ce qu'elles sont, et ce qu'elles ne sont pas

**Les écharpes ne s'achètent pas.** Elles se gagnent en jouant, et uniquement.

Il y a eu un état intermédiaire qu'il faut connaître, parce qu'il peut rester
des soldes en base : le jeu a vendu des **billets**, une seconde monnaie qui
n'achetait que des objets nommés — cette pièce-là, cette tenue-là — précisément
pour qu'aucun euro ne mène à un tirage. Les billets ont été **supprimés** : ils
ne sont plus en vente, et l'étal se paie désormais en écharpes.

La colonne `user_wallet.billets` subsiste, figée. Elle porte ce que des gens ont
payé en euros. Elle n'a **pas** été convertie en écharpes — ce qui aurait
rétroactivement créé le chemin euro → écharpe → booster qu'on venait de fermer.

**Question :** quelle est la bonne façon de solder ces avoirs ? Un remboursement
Stripe nominatif me paraît la seule réponse honnête, mais c'est à confirmer.

### Ce que les écharpes achètent

Des boosters (45 écharpes), des pièces d'équipement, des tenues, et les âges
supérieurs d'un personnage (25 puis 90 écharpes). Aucune ne peut être obtenue
contre de l'argent réel.

### Ce qu'elles ne valent pas

Elles ne sont pas échangeables entre joueurs, pas revendables, pas
convertibles, et n'ont aucune valeur hors du jeu. Il n'existe **aucun marché**,
ni interne ni externe.

---

## 4. Le public, et pourquoi il compte

Le jeu est **en français**, adossé à des clubs suisses et français, et
**ouvert à des mineurs** — rien dans l'inscription ne demande un âge
aujourd'hui.

C'est le fait qui change la réponse à presque toutes les questions ci-dessus, et
c'est pour ça qu'il est ici plutôt qu'en note de bas de page.

**Questions :**

1. Faut-il une barrière d'âge ? À partir de quel âge, et avec quelle
   vérification ?
2. Faut-il un consentement parental pour l'abonnement d'un mineur ?
3. Le droit de rétractation de quatorze jours s'applique-t-il à un abonnement
   numérique de ce type, et comment le présenter à la souscription ?

---

## 5. Ce qu'il manque encore, indépendamment du droit du jeu

Ces points-là ne sont pas des questions : ce sont des documents qui n'existent
pas et qu'il faudra écrire.

- **Conditions générales de vente** — il n'y en a aucune, et un abonnement se
  vend avec.
- **Politique de confidentialité** — le jeu stocke une adresse e-mail, un
  pseudo, des clubs suivis et un historique de parties.
- **Mentions légales** — éditeur, hébergeur (Infomaniak), contact.
- **Le sort des données à la résiliation** et à la suppression de compte.
- **API-Football** : vérifier que les conditions de la licence autorisent
  l'usage fait ici — affichage de scores en direct et de compositions dans un
  jeu payant.

---

## 6. Le quotidien : ce qu'il verse, et trois questions

Le chantier du quotidien (octobre 2026) fait verser au jeu des récompenses
régulières : trois missions par jour et leur sachet, une carte de présence, un
carnet de tampons par saison, des crans de collection, des divisions de
saison. Tout passe par un registre unique (`recompenses`,
`src/server/recompenses.js`).

### Les faits

- **Abonné et non-abonné reçoivent exactement la même chose.** Le module qui
  verse ne lit pas l'abonnement ; aucune mission ne demande ce que
  l'abonnement déplafonne ; aucun réglage d'abonnement ne touche ces montants.
  Des suites de tests le vérifient.
- **Aucune tenue n'est donnée en récompense.** Un abonné peut porter n'importe
  quelle tenue publiée : une tenue offerte serait portable par tous les abonnés
  sans l'avoir gagnée.
- **Les divisions de saison ne paient que de l'honneur** (une couleur
  d'écharpe, un titre). La ferveur classée qui les fait monter n'a pas de
  plafond pour un abonné : une division payée en boosters se gagnerait en
  partie en payant. Le registre des réglages refuse qu'un montant leur soit
  rendu.
- Des **boosters sont offerts** par le sachet des missions (1 par jour au
  plus), la septième case de la carte de présence, les paliers du carnet, le
  passage d'une saison à l'autre et les crans de collection. Un disjoncteur
  borne ce qu'un joueur reçoit en un jour (15 boosters et 2 500 écharpes au
  départ).

### Les questions

1. **La carte de présence et la série de jours, pour un public qui compte des
   mineurs.** Elles ne punissent rien : un jour manqué ne fait pas reculer la
   carte, et aucun écran ne prévient d'une perte à venir. Mais ce sont des
   mécaniques d'assiduité. Faut-il les encadrer, ou les écarter pour les
   mineurs ? C'est une question, pas un avis.
2. **Les crans de collection.** Un booster tous les quatre crans (tous les cent
   objets collectionnés, au départ). L'abonné remplit sa collection plus vite,
   puisque sa réserve se recharge plus vite : il touche ces boosters plus tôt.
   Le total est le même pour tous — l'univers des objets est fini —, seul le
   rythme change. C'est la question de la section 2, un cran plus loin :
   l'argent accélère l'obtention de tirages offerts.
3. **Les boosters offerts en général.** Ils sont gratuits pour tous et
   identiques pour tous. Changent-ils quelque chose à la qualification des
   boosters eux-mêmes, ou à l'obligation d'afficher les taux de tirage ?

---

## Comment ce fichier a été écrit

Tout ce qui est décrit ici a été **lu dans le code**, pas dans une note :
le catalogue de la boutique, la liste blanche des livraisons payantes, les taux
de tirage, les réglages de l'abonnement et les tests qui les défendent. Les
chiffres viennent de `src/shared/boutique.js`, `src/shared/fanzzy/dex.js` et
`src/shared/reglages.js` ; la livraison de l'abonnement, de
`src/server/boutique/index.js` et `src/server/abonnement/index.js` ; le
quotidien, de `src/server/recompenses.js` et du registre des réglages.

Si l'un d'eux change, ce fichier devient faux. Il vaut à la date de sa dernière
relecture, pas indéfiniment. **Dernière relecture : 2 octobre 2026**, pour le
chantier du quotidien — c'est elle qui a trouvé que la section 1 disait le
contraire du code depuis septembre.
