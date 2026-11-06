/**
 * Le hors-série CARNET PLEIN : un Fanzzy par PASS, qu'on ne tire pas, qu'on gagne.
 *
 * Demande de Gaël du 6 novembre 2026 : « un Fanzzy spécial qui serait gagné
 * uniquement si le USER a réussi tous les paliers du carnet (un peu comme le
 * Fanzzy TB) ». Ses choix du même jour :
 *
 * - **pour tous** ceux qui atteignent le dernier palier du carnet de la
 *   saison, avec ou sans PASS (règle « jamais de Fanzzy réservé au PASS ») ;
 * - le membre du PASS le porte **en plus dans la tenue de la saison**, comme
 *   tout autre Fanzzy (`abonnement.ageTenuePass`) ;
 * - un Fanzzy par PASS, les quatre noms ci-dessous ;
 * - avec toutes ses tenues et ses Ultimate (image et vidéo), comme les autres.
 *
 * ## Une série qui ne s'ouvre jamais
 *
 * `cadeau: true` la tient fermée pour toujours, comme THEBESTFAN
 * (`dex-thebestfan.js`) : aucun booster, aucune saison, aucun étal ni PACK.
 * Sa seule porte est le dernier palier du carnet de **sa** saison
 * (`src/server/quotidien/`, `pass.trophee_actif`) ; l'administration peut
 * aussi l'offrir à la main. Une fois la saison close, elle ne se gagne plus :
 * c'est la preuve qu'on y était.
 *
 * `pass` dit la saison (le numéro du PASS) dont il est le trophée. Le registre
 * des PASS le lit (`tropheeDuPass`, `shared/pass.js`).
 *
 * Ses cartes suivent la règle des légendaires (`dex-legendes.js`) : un seul
 * âge, un défaut, un cri entre 72 et 84.
 */

export const SET_CARNET_PLEIN = {
  id: 'CP',
  nom: 'CARNET PLEIN',
  ligne: 'ceux qui sont allés au bout de la saison',
  desc: 'Le hors-série des carnets remplis. Ces Fanzzy ne sortent d’aucun booster : '
    + 'chacun attend, au dernier palier du carnet de sa saison, ceux qui vont jusqu’au bout.',
  c1: '#F2C14E',
  c2: '#2B1A0E',
  cadeau: true,
};

export const DEX_CARNET_PLEIN = [
  { id: 'CP1', nom: 'Le Gardien du Feu', type: 'pyro', stage: 1, rar: 'legendaire', pass: 1,
    histoire: 'Il a porté la braise du premier virage à travers tout l’hiver, sans jamais '
      + 'la laisser s’éteindre. Ceux qui ont rempli le carnet se chauffent à son feu.',
    mods: { perfectBonus: 1.25, breathBonus: 1.15, tempoWindow: 0.88 },
    cri: { label: 'LE FEU NE S’ÉTEINT PAS', gest: 'meche', power: 80 } },

  { id: 'CP2', nom: 'Le Ferrailleur', type: 'perc', stage: 1, rar: 'legendaire', pass: 2,
    histoire: 'De la tôle, des boulons et un vieux bidon : il a monté son tambour avec ce '
      + 'que la fin du monde avait laissé. Il ne tape que pour ceux qui sont restés.',
    mods: { tempoWindow: 1.25, parryBonus: 1.2, refundBonus: 0.86 },
    cri: { label: 'TOUT SE RÉPARE', gest: 'salves', power: 80 } },

  { id: 'CP3', nom: 'Le Capitaine Comète', type: 'depl', stage: 1, rar: 'legendaire', pass: 3,
    histoire: 'Il a fait le tour de la galaxie pour un match à l’extérieur, et il est '
      + 'rentré à l’heure. Son équipage, c’est ceux qui ont tenu le voyage jusqu’au bout.',
    mods: { breathBonus: 1.25, refundBonus: 1.15, parryResist: 0.86 },
    cri: { label: 'CAP SUR LA VICTOIRE', gest: 'cortege', power: 80 } },

  { id: 'CP4', nom: 'Le Fantôme du Virage', type: 'fide', stage: 1, rar: 'legendaire', pass: 4,
    histoire: 'On dit qu’il chante encore quand le stade est vide. Il n’apparaît qu’à ceux '
      + 'qui ont passé toutes les nuits de la saison en tribune.',
    mods: { parryResist: 1.3, perfectBonus: 1.15, mashBonus: 0.86 },
    cri: { label: 'ON NE PART JAMAIS', gest: 'retenue', power: 80 } },
].map((f) => ({ ...f, set: SET_CARNET_PLEIN.id }));
