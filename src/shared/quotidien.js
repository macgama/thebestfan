/**
 * Le quotidien, en règles pures : le catalogue des missions, la carte de
 * présence, la série de jours et le tirage du jour.
 *
 * ## Pourquoi un module sans base ni horloge
 *
 * Le serveur compte, l'écran nomme (`CONTRATS.md`, R7). Pour que le serveur
 * compte toujours de la même façon — au tirage du matin, à l'affichage, au
 * recompte d'une réclamation, à la relance —, la règle est écrite **une
 * fois**, ici, et chaque chemin l'appelle. Deux copies d'une règle finissent
 * toujours par ne plus dire la même chose : c'est l'histoire de la table des
 * effets, recopiée cinq fois et fausse dans trois.
 *
 * Rien ici ne lit la base ni l'heure. Le jour de jeu est celui de la base
 * (`CURDATE()`) ; il arrive ici déjà écrit, en chaîne `AAAA-MM-JJ`, et ne sert
 * qu'à semer le tirage. Aucun objet `Date` ne traverse ce fichier.
 *
 * ## Ce que le catalogue refuse, exprès
 *
 * - **Les cibles ne se règlent pas.** « 3 boosters », « 2 duels classés » sont
 *   des règles du jeu, comme une carte : une cible mal réglée pourrait passer
 *   au-dessus du plafond gratuit. Seuls les montants sont au registre.
 * - **Aucune source ne compte la répétition, la note d'un geste, un ami, un
 *   parrainage ou un KOP.** La répétition ne rapporte rien, c'est sa règle ;
 *   payer la qualité d'un geste pousse à l'automatiser ; ce qui se fait, se
 *   défait et se refait (suivre, rejoindre, ajouter) se toucherait chaque
 *   jour. La liste des sources est fermée, et `quotidien-smoke` le vérifie.
 * - **Aucune mission ne demande ce que l'abonnement vend** : ni plus de deux
 *   duels classés, ni un Virage compté, ni un format réservé.
 */
import { reglage } from './reglages.js';

export const DIFFICULTES = Object.freeze(['facile', 'moyenne', 'difficile']);

/** Le rang du sachet dans le contrat du jour (`missions_jour.rang`). */
export const RANG_SACHET = 3;

/** Les cases de la carte de présence. Dessinées : elles ne se règlent pas. */
export const CASES_CARTE = 7;

/**
 * Ce que le serveur sait compter, **liste fermée**. Chaque mission du
 * catalogue en nomme une, et seul `src/server/quotidien/missions.js` les lit,
 * dans ce qui est déjà enregistré : un booster ouvert (`compteurs_jour`), un
 * duel joué (`duel_results`), un chant (`virage_presence`). Le joueur ne
 * déclare rien.
 */
export const SOURCES = Object.freeze([
  'boosters',      // boosters ouverts dans le jour
  'evolutions',    // Fanzzy qui ont grandi dans le jour
  'duels',         // duels joués jusqu'au bout (au moins 60 s, pas quittés)
  'victoires',     // les mêmes, gagnés
  'classes',       // les mêmes, classés
  'duels_club',    // les mêmes, joués pour un club suivi
  'chants',        // chants au Grand Virage, au jour du coup d'envoi
  'chants_club',   // les mêmes, pour un club suivi
  'mitemps',       // le moins chanté des deux mi-temps du meilleur match
  'competitions',  // compétitions où l'on a assez chanté
]);

/**
 * Quand une mission peut être proposée, **liste fermée**. Une condition ne
 * se lit qu'au tirage (et à la relance) : une mission tirée le matin reste
 * due, même si son match est reporté à midi.
 */
export const CONDITIONS = Object.freeze([
  'toujours',
  'duel',                    // l'entraînement rapporte de l'XP
  'classes',                 // un match du jour, le classé rapporte, deux classés gratuits restent
  'suit_un_club',            // un club suivi, et l'entraînement rapporte
  'match_du_jour',           // un match se joue encore dans le jour de jeu
  'club_joue',               // un club suivi joue encore dans le jour de jeu
  'avant_seconde_mi_temps',  // un match du jour n'a pas commencé sa seconde mi-temps
  'deux_competitions',       // deux compétitions jouent encore dans le jour
  'grandir',                 // un Fanzzy peut grandir, et la bourse le paie
]);

const m = (o) => Object.freeze(o);

/**
 * Le catalogue : treize missions (`SERVEUR.md`, § 3 ; `CONTRATS.md`, § 6.1).
 *
 * `titre(cible)` écrit l'intitulé à partir de la cible : le nombre et le mot
 * ne peuvent pas se contredire. Le titre de chaque bascule du registre
 * (`mission.<id>`) est cet intitulé, et la suite le vérifie : c'est ce qu'on
 * cherche des yeux dans l'administration quand une mission pose problème.
 *
 * `ou` choisit la vignette à l'écran, et `bouton` le libellé du geste qui y
 * mène. `seuil` (pour `ailleurs` seulement) est le nombre de chants qui fait
 * compter une compétition : il fait partie de la règle, comme la cible.
 */
export const MISSIONS = Object.freeze([
  m({ id: 'boosters', difficulte: 'facile', cible: 3, unite: 'boosters',
    titre: (c) => `Ouvre ${c} boosters`, ou: '/boosters', bouton: 'Ouvrir un booster',
    source: 'boosters', condition: 'toujours' }),
  m({ id: 'duel', difficulte: 'facile', cible: 1, unite: 'duels',
    titre: () => 'Joue un duel jusqu’au bout', ou: '/duel-nvn', bouton: 'Jouer un duel',
    source: 'duels', condition: 'duel' }),
  m({ id: 'virage', difficulte: 'facile', cible: 10, unite: 'chants',
    titre: (c) => `Chante ${c} fois au Grand Virage`, ou: '/virage',
    bouton: 'Entrer dans le Virage', source: 'chants', condition: 'match_du_jour' }),
  m({ id: 'grandir', difficulte: 'facile', cible: 1, unite: 'evolutions',
    titre: () => 'Fais grandir un Fanzzy', ou: '/fanzzy', bouton: 'Faire grandir un Fanzzy',
    source: 'evolutions', condition: 'grandir' }),

  m({ id: 'tribune', difficulte: 'moyenne', cible: 40, unite: 'chants',
    titre: (c) => `Chante ${c} fois au Grand Virage`, ou: '/virage',
    bouton: 'Entrer dans le Virage', source: 'chants', condition: 'match_du_jour' }),
  m({ id: 'victoire', difficulte: 'moyenne', cible: 1, unite: 'victoires',
    titre: () => 'Gagne un duel', ou: '/duel-nvn', bouton: 'Jouer un duel',
    source: 'victoires', condition: 'duel' }),
  m({ id: 'classes', difficulte: 'moyenne', cible: 2, unite: 'duels',
    titre: (c) => `Joue ${c} duels classés`, ou: '/duel-nvn', bouton: 'Jouer un duel classé',
    source: 'classes', condition: 'classes' }),
  m({ id: 'club_virage', difficulte: 'moyenne', cible: 20, unite: 'chants',
    titre: (c) => `Chante ${c} fois pour ton club`, ou: '/virage',
    bouton: 'Entrer dans le Virage', source: 'chants_club', condition: 'club_joue' }),
  m({ id: 'club_duel', difficulte: 'moyenne', cible: 1, unite: 'duels',
    titre: () => 'Joue un duel pour ton club', ou: '/duel-nvn', bouton: 'Jouer un duel',
    source: 'duels_club', condition: 'suit_un_club' }),

  m({ id: 'victoires', difficulte: 'difficile', cible: 3, unite: 'victoires',
    titre: (c) => `Gagne ${c} duels`, ou: '/duel-nvn', bouton: 'Jouer un duel',
    source: 'victoires', condition: 'duel' }),
  m({ id: 'endurance', difficulte: 'difficile', cible: 5, unite: 'duels',
    titre: (c) => `Joue ${c} duels`, ou: '/duel-nvn', bouton: 'Jouer un duel',
    source: 'duels', condition: 'duel' }),
  m({ id: 'mitemps', difficulte: 'difficile', cible: 10, unite: 'chants_par_mi_temps',
    titre: (c) => `Chante ${c} fois dans chaque mi-temps d’un même match`, ou: '/virage',
    bouton: 'Entrer dans le Virage', source: 'mitemps', condition: 'avant_seconde_mi_temps' }),
  m({ id: 'ailleurs', difficulte: 'difficile', cible: 2, unite: 'competitions', seuil: 10,
    titre: () => 'Chante 10 fois dans deux compétitions différentes', ou: '/virage',
    bouton: 'Entrer dans le Virage', source: 'competitions', condition: 'deux_competitions' }),
]);

export const MISSION_PAR_ID = new Map(MISSIONS.map((x) => [x.id, x]));

/** Le rang d'une difficulté dans le contrat du jour : 0, 1 ou 2. */
export const rangDe = (difficulte) => DIFFICULTES.indexOf(difficulte);

/* ================================================================ les gains

   Les montants d'une mission sont **copiés au tirage** (`missions_jour`) :
   un réglage changé à midi vaut pour le lendemain, et le joueur reçoit ce
   qu'on lui a promis le matin. Ces deux fonctions ne servent donc qu'au
   tirage. Une réclamation verse ce que porte la ligne, jamais ce que dit le
   registre à l'instant. */

/**
 * Le gain d'une mission au tirage. `avecSaison` : sans saison ouverte, la
 * mission ne remplit aucun carnet, et la ligne ne promet donc aucun tampon —
 * « +1 tampon » à l'écran serait une promesse sans carnet pour la tenir.
 */
export function gainMission(difficulte, { avecSaison = true, lire = reglage } = {}) {
  return {
    echarpes: lire(`missions.${difficulte}_echarpes`),
    packs: 0,
    xp: lire(`missions.${difficulte}_xp`),
    tampons: avecSaison ? lire(`saison.tampons_${difficulte}`) : 0,
  };
}

/** Le gain du sachet au tirage : un booster (réglable), et ses tampons. */
export function gainSachet({ avecSaison = true, lire = reglage } = {}) {
  return {
    echarpes: 0,
    packs: lire('missions.sachet_packs'),
    xp: 0,
    tampons: avecSaison ? lire('saison.tampons_sachet') : 0,
  };
}

/* ======================================================== la carte de présence

   Sept cases. Chaque jour où le joueur récupère le bonus, la carte avance
   d'une case ; un jour manqué ne la fait **pas** reculer, la case suivante
   l'attend. Après la septième, une carte neuve repart à 1. « Tu vas perdre
   ta série » est une laisse : la carte ne punit jamais une absence.

   La carte ne se stocke nulle part : elle se déduit du nombre de bonus déjà
   versés (le grand livre). Rien à remettre à zéro, rien qui puisse se
   désynchroniser. */

/** La valeur des sept cases, aux réglages de l'instant (le bonus vaut tout de suite). */
export function montantsCarte({ lire = reglage } = {}) {
  const base = lire('bonus.base');
  const pas = lire('bonus.pas');
  const j7 = lire('bonus.j7_packs');
  return Array.from({ length: CASES_CARTE }, (_, i) => ({
    echarpes: base + pas * i,
    packs: i === CASES_CARTE - 1 ? j7 : 0,
    xp: 0,
    tampons: 0,
  }));
}

/**
 * La case d'aujourd'hui (1 à 7), d'après `n`, le nombre de bonus versés en
 * tout, et `prise`, le bonus d'aujourd'hui est-il parmi eux.
 *
 * Avant la prise, c'est la case que RÉCUPÉRER cochera : `(n mod 7) + 1`.
 * Après, c'est celle qu'on vient de cocher : `((n − 1) mod 7) + 1`. Ce
 * nombre ne descend jamais d'un jour à l'autre, sauf pour repartir à 1.
 */
export function caseDuJour(n, prise) {
  const k = Math.max(0, Math.floor(Number(n) || 0));
  if (prise && k > 0) return ((k - 1) % CASES_CARTE) + 1;
  return (k % CASES_CARTE) + 1;
}

/**
 * La série et le record, d'après les écarts en jours entre aujourd'hui et
 * chaque bonus versé (`DATEDIFF(CURDATE(), cle)`, lu en SQL : aucun objet
 * `Date` ici).
 *
 * `jours` compte les jours consécutifs, **y compris hier** si le bonus
 * d'aujourd'hui n'est pas encore pris : à midi, la série d'hier n'est pas
 * perdue, elle attend. `jours` vaut 0 quand elle est retombée ; le record
 * reste, et le profil le montre. Rien n'en dépend, et aucun écran ne prévient
 * d'une perte à venir.
 *
 * @returns {{ jours: number, record: number }}
 */
export function serieDe(ecarts) {
  const vus = [...new Set((ecarts ?? []).map(Number).filter((x) => Number.isInteger(x) && x >= 0))]
    .sort((a, b) => a - b);
  if (!vus.length) return { jours: 0, record: 0 };

  let jours = 0;
  const depart = vus[0] === 0 ? 0 : 1;
  if (vus.includes(depart)) {
    for (let e = depart; vus.includes(e); e++) jours++;
  }

  let record = 1;
  let courant = 1;
  for (let i = 1; i < vus.length; i++) {
    courant = vus[i] === vus[i - 1] + 1 ? courant + 1 : 1;
    if (courant > record) record = courant;
  }
  return { jours, record: Math.max(record, jours) };
}

/* ================================================================== le tirage

   **Le même pour tout le monde.** Deux joueurs qui se parlent parlent de la
   même chose : la graine est le jour (et la difficulté), jamais le joueur.
   Chacun prend ensuite, dans l'ordre de cette permutation commune, la
   première mission faisable **pour lui** — un joueur sans club suivi ne se
   voit jamais proposer « Chante 20 fois pour ton club ».

   **Déterministe**, et c'est ce qui rend le tirage sûr sans verrou : deux
   onglets qui tirent ensemble écrivent la même chose, et la seconde écriture
   ne fait rien (`INSERT IGNORE`). Un `Math.random()` ici donnerait à chaque
   onglet sa mission, et au joueur celle du premier arrivé. */

/** FNV-1a sur 32 bits : court, sans dépendance, et identique partout. */
export function hacher(texte) {
  let h = 0x811c9dc5;
  for (const c of String(texte)) {
    h ^= c.codePointAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/* mulberry32 : un générateur à graine de 32 bits, assez bon pour mélanger
   quatre missions, et qui rend la même suite partout pour la même graine. */
function generateur(graine) {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * L'ordre du jour d'une difficulté : les identifiants de ses missions,
 * mélangés par une graine tirée du jour. Toutes les missions du catalogue y
 * sont, bascules éteintes comprises : éteindre une mission ne doit pas
 * rebattre les autres.
 */
export function permutation(jour, difficulte) {
  const ids = MISSIONS.filter((x) => x.difficulte === difficulte).map((x) => x.id);
  const alea = generateur(hacher(`${jour}|${difficulte}`));
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(alea() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids;
}

/**
 * Le choix d'une difficulté : la première mission de l'ordre du jour qui est
 * faisable, en évitant celle d'hier au même rang **quand une autre l'est**.
 * Rend l'identifiant, ou `null` si aucune ne l'est (toutes éteintes, par
 * exemple) : la difficulté n'a alors pas de mission ce jour-là.
 *
 * `faisable(id)` peut être asynchrone : certaines conditions demandent une
 * lecture (la journée du football, les Fanzzy du joueur), qu'on ne fait que
 * si l'ordre du jour y arrive.
 */
export async function choisir({ jour, difficulte, faisable, hier = null }) {
  let repli = null;
  for (const id of permutation(jour, difficulte)) {
    if (!(await faisable(id))) continue;
    if (id !== hier) return id;
    repli = id;
  }
  return repli;
}

/**
 * La mission qui en remplace une autre à la relance : la suivante de l'ordre
 * du jour, en tournant, qui est faisable et n'est pas celle qu'on remplace.
 * `null` s'il n'y en a aucune (raison `aucune`).
 */
export async function remplacante({ jour, difficulte, actuelle, faisable }) {
  const ordre = permutation(jour, difficulte);
  const ici = ordre.indexOf(actuelle);
  for (let pas = 1; pas <= ordre.length; pas++) {
    const id = ordre[(ici + pas + ordre.length) % ordre.length];
    if (id === actuelle) continue;
    if (await faisable(id)) return id;
  }
  return null;
}

/* ================================================================ le compte

   Ce que `fait` vaut, pour une mission et un jour, à partir des lignes que le
   serveur a lues. Une seule fonction, appelée à l'affichage, au recompte
   d'une réclamation et à la relance : les trois ne peuvent pas compter
   différemment.

   `donnees` :
     - `duels`     : `[{ k, outcome, mode, compte, club }]` — `compte` dit que
                     le duel a duré au moins une minute et que le joueur ne
                     l'a pas quitté (`xp > 0 AND duree_s >= 60`) ;
     - `presences` : `[{ k, chants, mt1, mt2, ligue, club }]` — `k` est le jour
                     du **coup d'envoi** du match ;
     - `compteurs` : `[{ k, cle, n }]`.
   `k` vaut 0 pour aujourd'hui, 1 pour hier. */

const vrai = (v) => v === true || v === 1 || v === '1';

/** La valeur brute d'une source pour le jour `k`, avant plafond. */
export function valeurDe(mission, donnees, k) {
  const duels = (donnees?.duels ?? []).filter((d) => Number(d.k) === k && vrai(d.compte));
  const presences = (donnees?.presences ?? []).filter((p) => Number(p.k) === k);
  const compteur = (cle) => (donnees?.compteurs ?? [])
    .filter((c) => Number(c.k) === k && c.cle === cle)
    .reduce((s, c) => s + Number(c.n || 0), 0);

  switch (mission.source) {
    case 'boosters': return compteur('booster');
    case 'evolutions': return compteur('evolution');
    case 'duels': return duels.length;
    case 'victoires': return duels.filter((d) => d.outcome === 'win').length;
    case 'classes': return duels.filter((d) => d.mode === 'classe').length;
    case 'duels_club': return duels.filter((d) => vrai(d.club)).length;
    case 'chants': return presences.reduce((s, p) => s + Number(p.chants || 0), 0);
    case 'chants_club':
      return presences.filter((p) => vrai(p.club)).reduce((s, p) => s + Number(p.chants || 0), 0);
    case 'mitemps':
      return presences.reduce((s, p) => Math.max(s, Math.min(Number(p.mt1 || 0), Number(p.mt2 || 0))), 0);
    case 'competitions': {
      const parLigue = new Map();
      for (const p of presences) {
        if (p.ligue == null) continue;
        parLigue.set(p.ligue, (parLigue.get(p.ligue) ?? 0) + Number(p.chants || 0));
      }
      return [...parLigue.values()].filter((n) => n >= (mission.seuil ?? 1)).length;
    }
    default:
      /* Une source inconnue ne compte rien plutôt que de lever : la mission
         reste affichée, sans progression, et `quotidien-smoke` refuse qu'une
         telle source entre au catalogue. */
      return 0;
  }
}

/** `fait`, plafonné à la cible (`CONTRATS.md`, § 6.1). */
export function faitPour(mission, cible, donnees, k) {
  return Math.min(Number(cible), valeurDe(mission, donnees, k));
}
