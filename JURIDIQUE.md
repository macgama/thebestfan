# Le dossier à donner au juriste

**Ce fichier n'est pas un avis de droit, et il ne peut pas en tenir lieu.** Il
est là pour qu'une consultation coûte une heure au lieu de trois : il décrit
exactement ce qui est vendu, ce qui est aléatoire, et où passe la frontière
entre les deux. Le juriste n'aura pas à lire le code pour répondre.

Trois questions y sont posées. La deuxième est celle qui me gêne le plus, et
c'est la seule que je ne sais pas trancher seul.

---

## 1. Ce qui est vendu, exactement

**L'argent réel n'achète qu'une chose : un abonnement.**

| article | prix | périodicité | ce qu'il livre |
|---|---|---|---|
| `abo-mensuel` | 3,99 € | mensuel, résiliable | l'abonnement |
| `abo-annuel` | 39,90 € | annuel, résiliable | l'abonnement |

Il n'existe **aucun autre article payant**. Le paiement passe par Stripe en
`mode: 'subscription'` ; le site ne voit jamais de numéro de carte.

Cette liste est tenue par une **liste blanche** dans le code —
`LIVRAISONS_PAYANTES` — et une suite de tests refuse qu'on y ajoute quoi que ce
soit sans le déclarer explicitement. Elle vérifie nommément que l'argent réel
n'achète jamais `billets`, `echarpes`, `packs`, `boosters` ni `fanzzy`.

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
d'abonnement ne gouverne le duel, le deck, la ferveur ou le virage.

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

Un booster **ne s'achète pas avec de l'argent réel**. Il s'obtient de deux
façons : la recharge automatique (un toutes les 10 minutes, jusqu'à 12 en
réserve), ou 45 écharpes gagnées en jouant.

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
   à l'écran.)

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

## Comment ce fichier a été écrit

Tout ce qui est décrit ici a été **lu dans le code**, pas dans une note :
le catalogue de la boutique, la liste blanche des livraisons payantes, les taux
de tirage, les réglages de l'abonnement et les tests qui les défendent. Les
chiffres viennent de `src/shared/boutique.js`, `src/shared/fanzzy/dex.js` et
`src/shared/reglages.js`.

Si l'un d'eux change, ce fichier devient faux. Il vaut à la date de sa dernière
relecture, pas indéfiniment.
