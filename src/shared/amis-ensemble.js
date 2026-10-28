/**
 * Jouer entre amis : ce que le serveur et les pages partagent.
 *
 * Gaël, 28 octobre 2026 : que les amis puissent jouer ensemble, s'entraider et
 * communiquer **sans texte**, pour ne laisser aucune place à un message mal
 * intentionné dans un jeu qui compte des mineurs. On ne s'écrit donc pas : on
 * s'envoie un geste, choisi dans une liste fermée, que le personnage de celui
 * qui l'envoie joue avec l'expression qui va avec.
 *
 * L'identifiant est ce qui voyage et ce que la base garde ; le mot, la page
 * l'écrit (et le traduit). Un identifiant que cette liste ne connaît pas est
 * refusé par le serveur et ignoré par la page.
 */

/** Les gestes qu'un joueur peut envoyer, dans l'ordre de la grille. */
export const GESTES = Object.freeze([
  { id: 'allez', etat: 'pousse' },
  { id: 'bravo', etat: 'joie' },
  { id: 'merci', etat: 'joie' },
  { id: 'courage', etat: 'pousse' },
  { id: 'quel_match', etat: 'joie' },
  { id: 'au_virage', etat: 'neutre' },
  { id: 'un_duel', etat: 'colere' },
  { id: 'dommage', etat: 'depit' },
  { id: 'respect', etat: 'neutre' },
  { id: 'echarpe', etat: 'joie' },
]);

/**
 * Ce que le jeu écrit lui-même dans le fil d'un ami, sans qu'on puisse
 * l'envoyer : un cadeau, un prêt, un échange accepté.
 */
export const GESTES_DU_JEU = Object.freeze([
  { id: 'cadeau', etat: 'joie' },
  { id: 'pret', etat: 'joie' },
  { id: 'echange', etat: 'joie' },
]);

export const GESTE_PAR_ID = new Map([...GESTES, ...GESTES_DU_JEU].map((g) => [g.id, g]));

/** Peut-on envoyer ce geste ? */
export const gesteEnvoyable = (id) => GESTES.some((g) => g.id === id);

/** Un même geste au même ami ne repart pas avant ce délai. */
export const GESTE_PAUSE_MS = 10 * 60 * 1000;
