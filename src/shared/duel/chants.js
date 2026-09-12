/**
 * Les douze chants du Grand Virage.
 *
 * Ils vivaient dans `src/server/ferveur/virage.js`, en `const` privée. Trois
 * autres endroits en ont désormais besoin — la chaîne d'illustrations, le
 * module d'images du navigateur, et les contrôles qui vérifient que les douze
 * sont dessinés — et aucun ne peut importer un moteur de salle pour lire une
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
export const ORDRE = ['reprise', 'roulement', 'repons', 'onetaitla', 'salves',
  'contrechant', 'craquage', 'montee', 'tenir', 'mur', 'relance', 'cadence'];

/** Les douze, sous forme de liste — pour qui veut les parcourir. */
export const LISTE_CHANTS = ORDRE.map((id) => ({ id, ...CHANTS[id] }));
