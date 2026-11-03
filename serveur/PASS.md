# Le PASS de saison

Choix de Gaël du 2 novembre 2026 (fil « PASS de saison »). Il remplace
l'abonnement mensuel (3,99 €) et annuel (39,90 €), qui ne sont plus en vente.

## La base gratuite, pour tout le monde

- Tous les Fanzzy hors championnat : leurs âges, leurs états, leurs tenues, leurs
  Ultimate et leurs animations.
- Le stuff qui n'est pas lié à un club, tous les stades, les mini-jeux qui ne
  sont pas liés à un club, toutes les cartes action et tous les dessins.
- **Tout le classement, sans limite** : les 5 duels classés par jour, les
  2 Virages comptés par jour et la limite au 1 contre 1 ont disparu
  (`abo.duels_classes_jour`, `abo.virages_classes_jour` et
  `abo.taille_classe_libre` sont retirés du registre). `tribune.duels_jour`
  reste : il borne les duels qui rapportent des points à un club, PASS ou non.
- Chaque saison ajoute pour tous, à vie, ses nouvelles séries (championnat ou
  hors championnat) et le stuff, les stades et les mini-jeux liés aux clubs.
- **Aucun Fanzzy n'est jamais réservé au PASS.**

## Le PASS

- **7,99 €, payé une fois**, par Stripe Checkout en `mode: 'payment'`
  (`pass-saison` dans `src/shared/boutique.js`, livraison `{ type: 'pass',
  packs: 3 }`). Il ne se renouvelle jamais.
- Ou **40 000 écharpes** (`pass.prix_echarpes`, 0 ferme ce paiement) :
  `POST /api/abonnement/pass/echarpes`, en une transaction (débit
  `scarves >= prix`, PASS, boosters).
- Il couvre **la saison en cours** ; pris pendant ses `pass.dernier_mois_jours`
  derniers jours (30), il couvre aussi la suivante ; une saison finie fait
  acheter la suivante (`saisonsCouvertes`, `src/shared/pass.js`).
- **Pas avant son ouverture** (Gaël, 3 novembre 2026) : pendant la BASE
  (saison 0), le PASS 1 se montre sous « BIENTÔT » avec son jour d'ouverture
  (`ouvre_le` de la saison 1) ; `POST /api/boutique/commander` et
  `POST /api/abonnement/pass/echarpes` rendent `pass.error.bientot`
  (`offre().bientot`, `src/server/abonnement/`). Il s'achète dès que la
  saison 1 est lancée. L'administration peut toujours l'offrir.
- Il ne donne **jamais d'écharpes** : l'argent n'achète pas la monnaie des
  tirages.

### Ce qu'il donne

| | quand | réglage |
|---|---|---|
| 3 boosters | à l'achat | catalogue |
| réserve de 24 boosters, un toutes les 6 minutes | la saison achetée | `abo.pack_max`, `abo.pack_regen_min` |
| tout le parcours et tous les souvenirs | la saison achetée | `abo.parcours_libre`, `abo.souvenirs_libres` (ce qu'on voit sans) |
| +1 club suivi par PASS, cumulé | à vie | `pass.clubs_par_pass` |
| +1 KOP à créer par PASS, cumulé | à vie | `pass.kops_par_pass` |
| la tenue de la saison, son badge, son cadre de carte | à vie | `PASS_SAISONS` |

Le droit de porter **toute** tenue publiée, qu'avait l'abonnement, est retiré.

### La voie PASS (« style Fortnite »)

Une seconde ligne dans le carnet de tampons de la saison. Le niveau vaut
`1 + paliers du carnet atteints` (au plus 6), lus sur les mêmes tampons que la
voie gratuite (`recompenses`, sources `mission` et `sachet`). Que du visuel :

| niveau | ce qu'il ouvre |
|---|---|
| 1 (à l'achat) | la tenue au 1er âge |
| 2 | la tenue au 2e âge |
| 3 | la tenue au 3e âge |
| 4 | le cadre de carte |
| 5 | le cadre animé |
| 6 | le badge en or |

### La tenue de saison

- Une par PASS, un thème par saison (`PASS_SAISONS`, `src/shared/pass.js`).
  **PASS 1 : Préhistorique.**
- Elle ne sort d'**aucun** booster, jamais (`tenuesTirables`).
- Elle n'est pas à l'étal pendant sa saison ; elle y revient **une saison plus
  tard**, vendue à l'unité au prix de `pass.prix_tenue_etal` (500 écharpes)
  (`tenuesEnEtal`, `prixTenueDe`).
- Le badge, le cadre et l'Ultimate en tenue restent au PASS.

## Les données

- `sql/pass.sql` : `user_pass (user_id, saison, source, reference, achete_le)`,
  une ligne par joueur et par numéro de saison. `source` : `stripe`,
  `echarpes`, `offert`.
- L'ancienne table `abonnements` reste lue : un abonnement en cours compte
  comme le PASS de la saison jusqu'à la fin de sa période payée.

## L'écran et les routes

- `/abonnement` : la page du PASS (vitrine de la tenue, voie, ce qui reste
  gratuit, achat en euros ou en écharpes, ancien abonnement à résilier).
- `GET /api/abonnement` : `actif`, `voies`, `offre`, `voie`, `ouvre`, `sans`,
  `libre`, et les champs d'avant (`abonne`, `fin`, `kopsRestants`) que le menu,
  la boutique et le KOP lisent.
- `GET /api/abonnement/badge/:id` : le badge public d'un joueur. Les lignes des
  classements portent `pass` (`badgesDe`).
- `public/pass.js` (`TBF_PASS.badge`, `TBF_PASS.cadre`) et les classes
  `.tbf-pass-*` de `ui.css` dessinent le badge et le cadre partout.
- /admin, JOUEURS : « Offrir le PASS » (saison en cours), « Retirer le PASS
  S<n> », « Retirer l'ancien abo » (`POST /api/admin/joueur/:id/pass`,
  `DELETE /api/admin/joueur/:id/pass/:saison`). Réglages : section LE PASS DE
  SAISON.

## La reprise des abonnés (une fois, en SSH)

`npm run pass:reprise-essai` montre, `npm run pass:reprise` fait :
résiliation à l'échéance chez Stripe de chaque abonnement en cours, PASS de la
saison où sa période se termine ; abonnement offert : PASS de la saison en
cours, et sa ligne s'arrête au dernier jour de cette saison.

## Pour la saison suivante

Ajouter une entrée à `PASS_SAISONS` (numéro, nom, tenue, texte, couleur), avec
une tenue déjà dessinée à ses trois âges et son Ultimate en tenue
(`/mnt/project-files/fanzzy-prompts/00-METHODE.md`).

## Les tests

`npm run pass:smoke` (règles, achat en écharpes, dernier mois, voie, étal et
boosters, reprise) et `npm run abo:smoke`.
