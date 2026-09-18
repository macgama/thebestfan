# La licence API-Football : ce qu'il faut vérifier

> **Je ne peux pas vérifier ça à ta place.** Les conditions dépendent du plan
> souscrit et du contrat signé, que je n'ai pas. Ce fichier dit exactement quoi
> regarder, dans quel ordre, et ce que le code fait vraiment — pour que la
> vérification prenne dix minutes au lieu d'une après-midi.

---

## Ce que le jeu utilise, exactement

Fournisseur : **API-Sports**, point d'entrée `https://v3.football.api-sports.io`

Cinq routes, et pas une de plus :

| route | ce qu'on en tire | à quelle cadence |
|---|---|---|
| `/fixtures` | matchs du jour, scores, statuts, minutes | toutes les 20 s pendant un match suivi |
| `/fixtures/events` | buts, cartons, remplacements | toutes les 60 s, **seulement** si un virage est occupé |
| `/standings` | classements des compétitions | toutes les 6 h |
| `/teams` | fiche d'un club, son logo | 1 fois par jour et par club |
| `/leagues` | compétitions d'un club | 1 fois par jour et par club |

Enveloppe : **7 500 appels par jour**. Le code s'arrête à 6 800 pour garder une
marge. `npm run quota` projette la consommation ; un samedi de championnat
coûte environ 4 500 appels.

## Ce qu'on en fait, et c'est le point qui compte

1. **On affiche des scores en direct** à des joueurs connectés.
2. **On stocke** les matchs, les événements et les classements dans notre base,
   pour ne pas rappeler l'API à chaque page.
3. **On affiche les logos des clubs** — servis depuis les URL d'API-Football.
4. **Le service est payant** : un abonnement à 3,99 €/mois. Les données
   sportives elles-mêmes restent accessibles sans payer, mais elles font partie
   d'un service qui a une offre payante.

Le point 4 est celui qui change tout. Beaucoup de licences de données sportives
distinguent l'usage personnel, l'usage commercial gratuit et l'usage commercial
payant, et facturent les trois différemment.

---

## Les questions à poser, dans l'ordre

**1. Le plan souscrit autorise-t-il un usage commercial ?**
Regarde d'abord la page de ton compte API-Sports : le plan y est nommé. Puis les
CGU du fournisseur, section sur l'usage commercial.

**2. La redistribution des données à des utilisateurs finaux est-elle permise ?**
C'est ce qu'on fait : un joueur voit le score, même s'il ne voit jamais l'API.
Certaines licences l'autorisent, d'autres réservent les données à un usage
interne.

**3. Le stockage en base est-il permis, et pour combien de temps ?**
Nous gardons les matchs, les événements et les classements sans limite de durée.
Certaines licences imposent un cache court — vingt-quatre heures, souvent — et
interdisent de constituer une base.

**4. Une mention d'attribution est-elle exigée ?**
Si oui, elle doit apparaître sur les écrans qui affichent ces données : la page
des matchs, le télétexte, la fiche d'un match, le classement. Ce n'est pas
qu'une note en bas de page.

**5. Les logos des clubs sont-ils couverts ?**
Ils sont servis depuis les URL d'API-Football, mais **le logo d'un club est une
marque**, et la licence de l'API ne concède pas forcément un droit sur la
marque. C'est une question distincte, et souvent la plus épineuse.

**6. Y a-t-il une limite au nombre d'utilisateurs finaux ?**
Certaines licences facturent par utilisateur actif au-delà d'un seuil.

---

## Ce qui se passe si la réponse est non

Trois issues, par ordre de coût :

- **Changer de plan.** Le plus simple, si un plan commercial existe.
- **Changer de fournisseur.** Le code est isolé : tout passe par
  `src/server/football/client.js`, et cinq routes. Remplacer le fournisseur
  demande de réécrire ce fichier et les fonctions de conversion, pas le jeu.
- **Retirer le direct.** Le jeu perdrait son adossement aux vrais matchs,
  c'est-à-dire son idée.

---

## Où regarder

- Ton compte : <https://dashboard.api-football.com/>
- Les conditions : <https://www.api-football.com/terms-and-conditions>
- Les plans : <https://www.api-football.com/pricing>

Si les conditions ne tranchent pas clairement le point 2 ou le point 4, **écris
au support avant d'ouvrir**. Une réponse par e-mail, même informelle, vaut mieux
qu'une interprétation — et elle se garde.

---

## Ce que je peux faire ensuite

Une fois la réponse connue :

- **si une attribution est exigée**, je l'ajoute sur les écrans concernés et
  j'écris un contrôle qui refuse qu'elle disparaisse ;
- **si le stockage est limité dans le temps**, j'ajoute une purge et je la teste ;
- **s'il faut changer de fournisseur**, le travail est borné à
  `src/server/football/` — dis-moi lequel et je m'en occupe.
