/**
 * Les distinctions : des badges qu'on ne gagne pas en jouant, qu'on reçoit.
 *
 * Demande de Gaël du 6 novembre 2026 : « Créer le badge "Fondateur" […] que
 * l'ADMIN peut envoyer comme cadeau au USER ». Le premier est celui des
 * bêta-testeurs. Une distinction est **purement visuelle** : elle s'affiche à
 * côté du pseudo (classement, amis, profil, affiche du duel) et ne fait jamais
 * pousser plus fort.
 *
 * Le dessin est en SVG dans `public/pass.js` (`TBF_PASS.distinctions`) : net à
 * toutes les tailles, sans image à envoyer.
 */
export const DISTINCTIONS = [
  { id: 'fondateur', nom: 'Fondateur', texte: 'Bêta-testeur de la première heure' },
];

export const DISTINCTION_PAR_ID = new Map(DISTINCTIONS.map((d) => [d.id, d]));

/** Le Fanzzy offert avec le badge Fondateur (`dex-thebestfan.js`). */
export const FANZZY_FONDATEUR = 'TB1';
