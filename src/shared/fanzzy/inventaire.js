/**
 * Skins et équipement.
 *
 * Deux règles tiennent tout l'équilibre du jeu, et elles ne sont pas
 * négociables une fois des joueurs en ligne :
 *
 *   1. Un skin ne donne aucun bonus. Il change l'apparence, rien d'autre.
 *      C'est ce qui se collectionne le plus volontiers, et ça ne déséquilibre
 *      rien — celui qui ouvre mille paquets est plus beau, pas plus fort.
 *
 *   2. Chaque pièce d'équipement a un revers. Deux emplacements au maximum.
 *      Un joueur équipé n'est pas plus fort, il joue autrement, et il doit
 *      choisir. Un débutant qui chante juste bat un vétéran mal équipé.
 */

export const SKINS = [
  { id: 'base',      nom: 'Tenue de base',      rar: 'd1', pour: '*' },
  { id: 'pluie',     nom: 'Sous la pluie',      rar: 'd2', pour: '*' },
  { id: 'nocturne',  nom: 'Nocturne',           rar: 'd2', pour: '*' },
  { id: 'derby',     nom: 'Soir de derby',      rar: 'd3', pour: '*' },
  { id: 'anniv',     nom: 'Cinquantenaire',     rar: 'star', pour: '*' },
  { id: 'promo',     nom: 'Jour de montée',     rar: 'star', pour: '*' },
  { id: 'legende',   nom: 'Légende du virage',  rar: 'crown', pour: '*' },
];

/**
 * L'équipement. `bonus` et `malus` s'appliquent aux mêmes modificateurs que les
 * Fanzzy — fenêtre de tempo, durée de martelage, souffle, contre.
 */
export const STUFF = [
  { id: 'jumelles', nom: 'Jumelles', rar: 'd1',
    texte: 'Tu vois venir le rythme, mais tu chantes plus lentement.',
    mods: { tempoWindow: 1.25, tempoInterval: 70 } },
  { id: 'echarpe', nom: 'Écharpe du club', rar: 'd1',
    texte: 'Tiens plus longtemps, respire moins bien.',
    mods: { holdBonus: 1.15, breathBonus: 0.9 } },
  { id: 'tambour', nom: 'Tambour de poche', rar: 'd2',
    texte: 'Martelage plus court à réussir, mais moins récompensé.',
    mods: { mashTime: -600, mashBonus: 0.94 } },
  { id: 'capuche', nom: 'Capuche', rar: 'd2',
    texte: 'On te contre moins bien, tu contres moins bien aussi.',
    mods: { parryBonus: 0.8, parryResist: 1.3 } },
  { id: 'megaphone', nom: 'Mégaphone', rar: 'd3',
    texte: 'Tes gestes parfaits comptent double, tes ratés se retournent.',
    mods: { perfectBonus: 1.4, backfire: true } },
  { id: 'thermos', nom: 'Thermos', rar: 'd3',
    texte: 'Le souffle revient plus vite, les grosses cartes coûtent plus cher.',
    mods: { breathBonus: 1.2, costPenalty: 1.15 } },
  { id: 'bache', nom: 'Bout de bâche', rar: 'star',
    texte: 'Le contre devient redoutable, le chant s\u2019affaiblit.',
    mods: { parryBonus: 1.6, tempoWindow: 0.85 } },
];

export const SKIN_BY_ID = new Map(SKINS.map((s) => [s.id, s]));
export const STUFF_BY_ID = new Map(STUFF.map((s) => [s.id, s]));

/** Cartes d'action du paquet de bienvenue, jouables en duel. */
export const ACTIONS = [
  { id: 'a-fumigene', nom: 'Fumigène', texte: 'Une poussée immédiate, sans geste.' },
  { id: 'a-silence',  nom: 'Silence radio', texte: 'Coupe le chant adverse 4 secondes.' },
  { id: 'a-relance',  nom: 'Seconde jeunesse', texte: 'Rend la moitié de ton souffle.' },
  { id: 'a-bache',    nom: 'Bâche surprise', texte: 'Annule la prochaine poussée adverse.' },
];

export const ACTION_BY_ID = new Map(ACTIONS.map((a) => [a.id, a]));

/**
 * Combine les modificateurs du Fanzzy et des deux pièces portées.
 * Les facteurs se multiplient, les décalages s'additionnent : deux pièces qui
 * élargissent la fenêtre ne la rendent pas absurde, elles se composent.
 */
export function combine(fanzzyMods = {}, stuffIds = []) {
  const out = { ...fanzzyMods };
  const facteurs = ['tempoWindow', 'mashBonus', 'holdBonus', 'perfectBonus',
    'parryBonus', 'parryResist', 'breathBonus', 'refundBonus', 'costPenalty'];
  const decalages = ['tempoInterval', 'mashTime', 'holdForgive'];

  for (const id of stuffIds.slice(0, 2)) {
    const s = STUFF_BY_ID.get(id);
    if (!s) continue;
    for (const [k, v] of Object.entries(s.mods)) {
      if (facteurs.includes(k)) out[k] = (out[k] ?? 1) * v;
      else if (decalages.includes(k)) out[k] = (out[k] ?? 0) + v;
      else out[k] = v;
    }
  }
  return out;
}
