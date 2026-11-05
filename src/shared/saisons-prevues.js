/**
 * Les saisons prévues : le calendrier de Gaël, posé d'avance.
 *
 * Décision du 18 octobre 2026 : une saison par trimestre (du 1er janvier au
 * 31 mars, du 1er avril au 30 juin, du 1er juillet au 30 septembre, du
 * 1er octobre au 31 décembre), qui se lance seule à son jour d'ouverture. La
 * saison 1, « La reprise », finit le 31 décembre 2026 ; les quatre de 2027
 * sont ici, avec les séries que Gaël a validées le même jour.
 *
 * Au démarrage, le serveur crée **en brouillon** chacune de ces saisons qui
 * n'existe pas encore (même numéro), une seule fois : une fiche modifiée ou
 * supprimée dans l'onglet SAISONS n'est jamais recréée ni réécrite. C'est
 * l'administration qui fait foi ; ce fichier n'est qu'un point de départ.
 *
 * Les noms et les annonces sont du français du code : `npm run langues` les
 * relève, et ils se traduisent comme le reste du jeu.
 */

/* Le carnet d'une saison de trois mois. Celui du code (`CARNET_DEFAUT`,
   `shared/saison.js`) est calibré sur 63 jours ; un trimestre en compte de
   90 à 92. Mêmes paliers, mêmes gains, seuils multipliés par environ 1,45 et
   arrondis. */
export const CARNET_TRIMESTRE = Object.freeze([
  { tampons: 15, nom: 'De retour', echarpes: 100, packs: 0 },
  { tampons: 50, nom: 'Dans le bain', echarpes: 150, packs: 1, insigne: 'lisere' },
  { tampons: 110, nom: 'Remis en voix', echarpes: 250, packs: 2, insigne: 'tampon' },
  { tampons: 160, nom: 'Au rendez-vous', echarpes: 400, packs: 3 },
  { tampons: 205, nom: 'Revenu pour de bon', echarpes: 600, packs: 4, titre: true },
].map((p) => Object.freeze(p)));

/* `stuff` : le préfixe des pièces neuves de la série (`hc-`, `mt-`, `gd-`,
   `shared/fanzzy/inventaire.js`), fermées jusqu'à la saison qui les ouvre.
   LES REVENANTS n'en ont pas.
   `actions` : de même, le préfixe des cartes d'action de la saison
   (`shared/duel/actions.js`, novembre 2026), fermées jusqu'à son lancement. */
/* **Le calendrier des PASS** (Gaël, 3 novembre 2026) : la saison 0 est la
   BASE, ouverte dès le lancement de l'application ; puis un PASS par saison
   météorologique — hiver (décembre à février), printemps (mars à mai), été
   (juin à août), automne (septembre à novembre). Chacun ouvre pour tous, à
   sa date, sa série hors championnat et ses pièces ; ses membres ont en plus
   leur tenue, leur badge, leur cadre et plus de boosters.

   Une base d'avant ce calendrier (saison 1 lancée le 26 octobre, brouillons
   2 à 5) passe à celui-ci par `npm run calendrier:essai`, puis
   `npm run calendrier:appliquer` (scripts/calendrier-base.mjs). */
export const SAISONS_PREVUES = Object.freeze([
  { numero: 1, nom: 'Les héros du canapé', ouvre: '2026-12-01', fin: '2027-02-28',
    series: ['HC'], stuff: 'hc-', actions: 'a-hc-', tenue: 'prehistorique',
    texte: 'L’hiver, on supporte depuis le canapé : les héros du salon entrent en tribune, '
      + 'pour tous. Avec le PASS 1 : la tenue Préhistorique à ses trois âges, son badge, '
      + 'son cadre et plus de boosters toute la saison.' },
  { numero: 2, nom: 'Les phénomènes météo', ouvre: '2027-03-01', fin: '2027-05-31',
    series: ['MT'], stuff: 'mt-', actions: 'a-mt-', tenue: 'apocalyptique',
    texte: 'Giboulées, vent, grêle : la tribune tient bon, et la météo descend sur la pelouse, '
      + 'pour tous. Avec le PASS 2 : la tenue Apocalyptique à ses trois âges, son badge et son cadre.' },
  { numero: 3, nom: 'Les galères de déplacement', ouvre: '2027-06-01', fin: '2027-08-31',
    series: ['GD'], stuff: 'gd-', actions: 'a-gd-', tenue: 'spatiale',
    texte: 'Car en panne, train raté : on arrive quand même. L’été, la tribune prend la route, '
      + 'pour tous. Avec le PASS 3 : la tenue Spatiale à ses trois âges, son badge et son cadre.' },
  { numero: 4, nom: 'Les revenants', ouvre: '2027-09-01', fin: '2027-11-30',
    series: ['RV'], stuff: null, actions: 'a-rv-', tenue: 'halloween',
    texte: 'Ils reviennent hanter le virage jusqu’à Halloween, pour tous. Avec le PASS 4 : '
      + 'la tenue Halloween à ses trois âges, son badge et son cadre.' },
].map((s) => Object.freeze(s)));

/* **Le programme des PASS** (Gaël, 5 novembre 2026) : pour la BASE et chaque
   PASS, sa tenue, sa série hors championnat et sa série de championnat.
   L'admin (menu PASS) le montre sur chaque fiche avec l'état de chaque
   élément : en jeu, posé dans ce PASS, posé ailleurs, ou pas encore créé.
   Il ne coche rien : une série n'entre dans un PASS que depuis sa fiche,
   une fois ses cartes dessinées (la règle de `validerContenu`).

   `tenue` : identifiant de la tenue (`base` pour la tenue de départ).
   `fiches` : où sont écrites les fiches d'une série pas encore dans le jeu. */
export const PROGRAMME_DES_PASS = Object.freeze([
  { numero: 0, tenue: 'base', nomTenue: 'Tenue de base',
    serie: { id: 'RP', nom: 'La Reprise' },
    championnat: { id: 'AN', nom: 'Les Terraces', ligue: 'Premier League' } },
  { numero: 1, tenue: 'prehistorique', nomTenue: 'Préhistorique',
    serie: { id: 'HC', nom: 'Les héros du canapé' },
    championnat: { id: 'SU', nom: 'Die Kurve', ligue: 'Super League suisse' } },
  { numero: 2, tenue: 'apocalyptique', nomTenue: 'Apocalyptique',
    serie: { id: 'MT', nom: 'Les phénomènes météo' },
    championnat: { id: 'FR', nom: 'Le Parcage', ligue: 'Ligue 1',
      fiches: 'fanzzy-prompts/FR-les-kops.md' } },
  { numero: 3, tenue: 'spatiale', nomTenue: 'Spatiale',
    serie: { id: 'GD', nom: 'Les galères de déplacement' },
    championnat: { id: 'ES', nom: 'La Grada', ligue: 'Liga espagnole',
      fiches: 'fanzzy-prompts/ES-la-grada.md' } },
  { numero: 4, tenue: 'halloween', nomTenue: 'Halloween',
    serie: { id: 'RV', nom: 'Les revenants' },
    championnat: { id: 'AL', nom: 'Les Stehplätze', ligue: 'Bundesliga',
      fiches: 'fanzzy-prompts/AL-les-stehplaetze.md' } },
].map((p) => Object.freeze(p)));
