/**
 * Le hors-série THEBESTFAN : les cartes qu'on ne tire pas, qu'on reçoit.
 *
 * Demande de Gaël du 6 novembre 2026 : « un Fanzzy Légendaire "TheBestFan"
 * (couleur orange, blanc et noir) que l'ADMIN peut envoyer comme cadeau au
 * USER ». C'est le remerciement des bêta-testeurs, avec le badge Fondateur.
 *
 * ## Une série qui ne s'ouvre jamais
 *
 * `cadeau: true` la tient **fermée pour toujours** (`serieOuverte` du
 * catalogue) : aucun booster ne la distribue, aucune saison ne peut la cocher,
 * et elle ne compte pas dans la progression. Sa seule porte est le bouton de
 * l'administration (JOUEURS › COMPTES). Le classeur ne la montre qu'à celui
 * qui en possède une carte : une série « sous cadenas » promettrait une carte
 * qu'aucun joueur ne peut gagner.
 *
 * Ses cartes suivent pour le reste la règle des légendaires (`dex-legendes.js`) :
 * un seul âge, un défaut, un cri entre 72 et 84.
 */

export const SET_THEBESTFAN = {
  id: 'TB',
  nom: 'THEBESTFAN',
  ligne: 'ceux qui étaient là avant tout le monde',
  desc: 'Le hors-série des fondateurs. Ces Fanzzy ne sortent d’aucun booster : TheBestFan les offre à ceux qui ont fait le jeu avec lui.',
  c1: '#F28C28',
  c2: '#111111',
  cadeau: true,
};

export const DEX_THEBESTFAN = [
  { id: 'TB1', nom: 'TheBestFan', type: 'voix', stage: 1, rar: 'legendaire',
    histoire: 'Il était en tribune avant le premier match, quand le stade sentait encore la '
      + 'peinture fraîche. Il a tout essayé, tout signalé, et il garde l’écharpe numéro 1.',
    mods: { breathBonus: 1.3, tempoWindow: 1.22, refundBonus: 1.15, mashBonus: 0.86 },
    cri: { label: 'DEPUIS LE PREMIER JOUR', gest: 'echo', power: 80 } },
].map((f) => ({ ...f, set: SET_THEBESTFAN.id }));
