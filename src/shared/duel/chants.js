/**
 * Les dix-sept chants du Grand Virage.
 *
 * Ils vivaient dans `src/server/ferveur/virage.js`, en `const` privée. Trois
 * autres endroits en ont désormais besoin — la chaîne d'illustrations, le
 * module d'images du navigateur, et les contrôles qui vérifient qu'ils sont
 * tous dessinés — et aucun ne peut importer un moteur de salle pour lire une
 * table de cinq lignes.
 *
 * Le fichier est à côté de `actions.js`, et pour la même raison : un catalogue
 * de cartes n'appartient ni au serveur ni à la page, il appartient au jeu.
 */

/**
 * Un chant : son nom, son geste, ce qu'il coûte en souffle, ce qu'il pousse.
 *
 * Le `nom` compte autant que le reste. La page affichait la clé du chant, et
 * la tribune lisait « onetaitla » : un identifiant n'est pas un nom, et rien
 * dans le jeu ne le traduisait.
 */
export const CHANTS = {
  reprise:     { nom: 'La reprise',      gest: 'tempo',       cost: 22, power: 26 },
  roulement:   { nom: 'Le roulement',    gest: 'mash',        cost: 26, power: 30 },
  repons:      { nom: 'Le répons',       gest: 'echo',        cost: 24, power: 32 },
  onetaitla:   { nom: 'On était là',     gest: 'hold',        cost: 30, power: 34 },
  salves:      { nom: 'Les salves',      gest: 'salves',      cost: 27, power: 35 },
  contrechant: { nom: 'Le contre-chant', gest: 'contretemps', cost: 28, power: 36 },
  craquage:    { nom: 'Le craquage',     gest: 'mash',        cost: 34, power: 52, effect: 'fatigue' },
  montee:      { nom: 'La montée',       gest: 'crescendo',   cost: 32, power: 44 },
  tenir:       { nom: 'À perdre haleine', gest: 'tenue',      cost: 26, power: 48 },
  mur:         { nom: 'Le mur',          gest: 'tempo',       cost: 38, power: 46 },
  relance:     { nom: 'La relance',      gest: 'relance',     cost: 30, power: 40 },
  cadence:     { nom: 'La cadence',      gest: 'retenue',     cost: 24, power: 38 },

  /* ------------------------------------- les cinq qui ne sont pas du rythme

     Le duel faisait déjà tourner les quinze gestes ; le Virage n'en portait
     que dix, parce qu'il tire le sien de la carte de chant. Les cinq absents
     étaient les cinq épreuves — dessiner, se souvenir, allumer, tourner,
     suivre — écrites, éprouvées, jouables en duel, et **inatteignables dans le
     mode où l'on passe quatre-vingt-dix minutes**.

     Elles poussent plus fort à coût comparable, et ce n'est pas une faveur :
     dessiner un tifo prend six secondes, une mosaïque neuf, là où un tempo en
     prend quatre et demie. À puissance égale, personne ne les choisirait, et
     l'on aurait ajouté cinq cartes que le répertoire ferait tourner sans que
     personne les joue. */
  bache:       { nom: 'La bâche',        gest: 'tifo',        cost: 30, power: 54 },
  damier:      { nom: 'Le damier',       gest: 'mosaique',    cost: 28, power: 50 },
  aupoint:     { nom: 'Au point',        gest: 'memoire',     cost: 26, power: 47 },
  moulinet:    { nom: 'Le moulinet',     gest: 'echarpe',     cost: 25, power: 42 },
  appel:       { nom: 'L’appel du capo', gest: 'capo',        cost: 29, power: 49 },

  /* Les deux derniers mini-jeux. Ils sont arrivés au moteur et au duel sans
     passer par ici, et le Virage ne propose que les gestes portés par un chant :
     ils y étaient donc injouables. C'est la deuxième fois que ce chemin se
     coupe — d'où le contrôle de `virage-smoke`, qui confronte désormais le
     répertoire à la liste des gestes du jeu plutôt qu'à une liste écrite à la
     main. */
  trilage:  { nom: 'Le tri des cartons', gest: 'tri',   cost: 24, power: 38 },
  rebours:  { nom: 'Le compte à rebours', gest: 'compte', cost: 31, power: 51 },

  /* Les trois épreuves de décision. Elles coûtent et rendent **comme les
     autres à difficulté comparable** : un geste neuf n'est pas une occasion de
     glisser un chant plus rentable que les vingt-neuf d'à côté. Le prix suit la
     durée et la charge mentale, pas la nouveauté.

     Voir `epreuves.js` : ce sont les seules qui mesurent la décision, la visée
     et le dosage — le reste du répertoire mesure le rythme ou la mémoire. */
  renverse: { nom: 'Le renversement', gest: 'bascule', cost: 27, power: 42 },
  fumigenes: { nom: 'Les fumigènes',  gest: 'visee',   cost: 25, power: 39 },
  tension:  { nom: 'La tension',      gest: 'jauge',   cost: 29, power: 46 },
  /* Les quatre de l'automne 2026 — même règle que les trois d'avant : le prix
     suit la durée et la charge mentale. L'écho inversé dure douze secondes et
     demande de retenir puis de retourner : il pousse le plus. La ola se voit
     venir, elle coûte et rend le moins. */
  vague:    { nom: 'La vague',        gest: 'ola',      cost: 25, power: 40 },
  renvoi:   { nom: 'Le renvoi',       gest: 'miroir',   cost: 29, power: 48 },
  pluie:    { nom: 'La pluie de rouleaux', gest: 'rouleaux', cost: 27, power: 44 },
  canon:    { nom: 'Le canon',        gest: 'deuxvoix', cost: 28, power: 45 },
};

/**
 * L'ordre de rotation du répertoire.
 *
 * Il n'est pas alphabétique et ce n'est pas décoratif : le répertoire est une
 * fenêtre de cinq qui glisse le long de cette liste, et cinq chants
 * consécutifs doivent toujours mêler du rythme, de la force, de la tenue et du
 * risque. Ranger les deux martelages côte à côte donnerait dix minutes de match
 * où la tribune ne ferait que marteler. Un contrôle le vérifie, et une mutation
 * qui groupe les gestes par famille le fait tomber.
 */
/* Les huit épreuves s'**intercalent** au lieu de se coller à la fin. Le
   répertoire est une fenêtre de cinq qui glisse le long de cette liste : mises
   bout à bout, elles donneraient un quart d'heure sans rien à dessiner, puis un
   quart d'heure sans rien à chanter. Un Virage doit faire passer les deux. */
export const ORDRE = ['reprise', 'roulement', 'bache', 'repons', 'renverse',
  'onetaitla', 'vague', 'damier', 'salves', 'trilage', 'fumigenes', 'contrechant',
  'renvoi', 'moulinet', 'craquage', 'montee', 'tension', 'aupoint', 'pluie',
  'rebours', 'tenir', 'mur', 'canon', 'appel', 'relance', 'cadence'];

/** Tous, sous forme de liste — pour qui veut les parcourir. */
export const LISTE_CHANTS = ORDRE.map((id) => ({ id, ...CHANTS[id] }));
