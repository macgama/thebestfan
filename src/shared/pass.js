/**
 * Le PASS de saison : ce qu'il ajoute, saison après saison.
 *
 * Décisions de Gaël du 2 novembre 2026 : le PASS remplace l'abonnement
 * mensuel et annuel. Il coûte 7,99 € ou 40 000 écharpes, se paie une fois,
 * ne se renouvelle jamais tout seul et vaut jusqu'à la fin de la saison.
 * Acheté pendant son dernier mois, il couvre aussi la saison suivante.
 *
 * ## La base gratuite, pour tous
 *
 * Toutes les cartes, tous les âges, tous les formats, le Virage, les
 * mini-jeux, le pronostic, les missions et le carnet. **Tout compte au
 * classement, sans limite**, pour tout le monde. Chaque saison ajoute pour
 * tous, et à vie, ses séries, ses pièces, ses stades et ses mini-jeux.
 *
 * ## Ce que le PASS ajoute
 *
 * Pour **la saison achetée** : la réserve de boosters plus grande, la
 * recharge plus rapide, le parcours et les souvenirs complets. Pour **la
 * vie** : un club suivi et un KOP de plus par PASS, et ce que ce fichier
 * décrit — la tenue de la saison, le badge et le cadre de carte.
 *
 * **Jamais de puissance** : aucune carte, aucun âge, aucun point de poussée.
 * Une tenue, un badge, un cadre se regardent ; ils ne se jouent pas.
 *
 * ## La voie PASS
 *
 * Elle se remplit avec les tampons du carnet de la saison, ceux de tout le
 * monde : la voie gratuite reste telle quelle, la voie PASS est une seconde
 * ligne qui ne donne que du visuel. **Jamais d'écharpes ni de boosters** sur
 * cette ligne : ce serait de l'argent qui achète des tirages
 * (`shared/boutique.js`, « l'argent réel n'achète qu'une chose »).
 *
 * Le niveau de la voie est `1 + paliers du carnet atteints` : on est au
 * niveau 1 dès l'achat, au niveau 6 au dernier palier d'un carnet de cinq.
 *
 * Rien ici ne lit la base ni l'horloge : `src/server/abonnement/` le fait.
 */

/**
 * Le registre des PASS, un par saison, par **numéro** de saison.
 *
 * `tenue` est la tenue réservée au PASS pendant sa saison (choix de Gaël :
 * Préhistorique pour le PASS 1). Elle sort des boosters et de l'étal pour
 * tout le monde ; l'acheteur la gagne le long de la voie. Dès la saison
 * suivante, elle revient à l'étal, à l'unité et plus chère
 * (`pass.prix_tenue_etal`) ; le badge et le cadre, eux, restent au PASS.
 *
 * Une saison absente de ce registre a quand même son PASS (le rythme, les
 * clubs, le KOP, le badge, le cadre) : elle n'a simplement pas de tenue.
 */
export const PASS_SAISONS = Object.freeze([
  Object.freeze({
    numero: 1,
    nom: 'PASS 1 · Préhistorique',
    tenue: 'prehistorique',
    texte: 'Le virage avant le virage. Ta tribune en peaux de bête, du premier '
      + 'au troisième âge, et un cadre taillé dans la pierre.',
    /* La teinte du badge et du cadre de cette saison. Une couleur par PASS,
       pour qu'un badge dise sa saison d'un coup d'œil. */
    couleur: '#c9772e',
  }),
]);

export const PASS_PAR_NUMERO = new Map(PASS_SAISONS.map((p) => [p.numero, p]));

/* **La tenue choisie dans l'admin** (Gaël, 3 novembre 2026 : « je devrais
   pouvoir sélectionner moi-même »). Le serveur la lit dans
   `saisons.tenue_pass` au chargement des saisons et la pose ici :
   numéro → identifiant de tenue, ou `''` pour « aucune ». Un numéro absent
   garde la tenue du code (`PASS_SAISONS`). */
let tenuesChoisies = new Map();
export function poserTenuesDesPass(choix) {
  tenuesChoisies = new Map([...(choix instanceof Map ? choix : Object.entries(choix ?? {}))]
    .map(([n, t]) => [Number(n), t == null ? null : String(t)])
    .filter(([, t]) => t !== null));
}

/** Les PASS qui ont une tenue, code et admin réunis : `[{ numero, tenue }]`. */
export function passAvecTenue() {
  const numeros = new Set([...PASS_SAISONS.map((p) => p.numero), ...tenuesChoisies.keys()]);
  return [...numeros].sort((a, b) => a - b).map((n) => passDe(n)).filter((p) => p.tenue);
}

/** Le PASS d'une saison, même sans tenue, pour l'afficher. */
export function passDe(numero) {
  const n = Number(numero);
  const p = PASS_PAR_NUMERO.get(n);
  const tenue = tenuesChoisies.has(n) ? (tenuesChoisies.get(n) || null) : (p?.tenue ?? null);
  return {
    numero: n,
    /* Le nom du code ne vaut que pour sa tenue : une autre tenue choisie
       dans l'admin ne doit pas garder « Préhistorique » dans le nom. */
    nom: p?.nom && tenue === p.tenue ? p.nom : `PASS ${n}`,
    tenue,
    texte: p?.texte && tenue === p.tenue ? p.texte : null,
    couleur: p?.couleur ?? '#f2c14e',
  };
}

/**
 * Les six niveaux de la voie PASS. `paliers` : le nombre de paliers du carnet
 * de la saison qu'il faut avoir atteints.
 *
 * Écrits une fois : la page les dessine, le serveur les applique, l'aide les
 * cite. Le premier ne demande rien d'autre que l'achat.
 */
export const VOIE_PASS = Object.freeze([
  { niveau: 1, paliers: 0, nom: 'La tenue au premier âge', gain: 'tenue', age: 1 },
  { niveau: 2, paliers: 1, nom: 'La tenue au deuxième âge', gain: 'tenue', age: 2 },
  { niveau: 3, paliers: 2, nom: 'La tenue au troisième âge', gain: 'tenue', age: 3 },
  { niveau: 4, paliers: 3, nom: 'Le cadre de carte', gain: 'cadre' },
  { niveau: 5, paliers: 4, nom: 'Le cadre qui s’anime', gain: 'cadre_anime' },
  { niveau: 6, paliers: 5, nom: 'Le badge en or', gain: 'badge_or' },
].map((n) => Object.freeze(n)));

export const NIVEAU_MAX = VOIE_PASS.length;

/** Le niveau de la voie, à partir des paliers du carnet atteints. */
export function niveauVoie(paliersAtteints) {
  const n = Math.max(0, Math.floor(Number(paliersAtteints) || 0));
  return Math.min(NIVEAU_MAX, 1 + n);
}

/**
 * Le niveau de la voie d'après ce qui la fait monter : les tampons du carnet
 * de la saison, et les **points de voie** des défis PASS (`shared/defis.js`,
 * choix de Gaël du 3 novembre 2026). Les deux s'additionnent face aux seuils
 * des paliers du carnet ; les points ne remplissent jamais le carnet lui-même.
 */
export function niveauVoieDe({ tampons = 0, points = 0, seuils = [] } = {}) {
  const total = Math.max(0, Number(tampons) || 0) + Math.max(0, Number(points) || 0);
  return niveauVoie((seuils ?? []).filter((t) => total >= Number(t)).length);
}

/** Jusqu'à quel âge la tenue de la saison se porte, à ce niveau. */
export function ageTenue(niveau) {
  let age = 0;
  for (const n of VOIE_PASS) if (n.gain === 'tenue' && niveau >= n.niveau) age = n.age;
  return age;
}

/** Le cadre de carte : `null`, `'fixe'` ou `'anime'`. */
export function cadreDe(niveau) {
  if (niveau >= 5) return 'anime';
  if (niveau >= 4) return 'fixe';
  return null;
}

/** Ce qu'un joueur montre pour un PASS, au niveau atteint. */
export function vitrineDe(numero, niveau) {
  const p = passDe(numero);
  return {
    saison: p.numero,
    nom: p.nom,
    couleur: p.couleur,
    niveau,
    cadre: cadreDe(niveau),
    or: niveau >= NIVEAU_MAX,
  };
}

/**
 * La tenue est-elle réservée au PASS en ce moment ?
 *
 * Oui pendant la saison de son PASS (et avant, si l'on prépare la suivante) :
 * elle ne sort d'aucun booster et ne s'achète pas à l'étal. Sans saison en
 * cours connue, on la garde réservée — une tenue qu'on ouvre par erreur ne se
 * referme plus.
 */
export function tenueReservee(tenueId, numeroCourant) {
  for (const p of passAvecTenue()) {
    if (p.tenue !== tenueId) continue;
    if (numeroCourant === null || numeroCourant === undefined) return true;
    if (Number(numeroCourant) <= p.numero) return true;
  }
  return false;
}

/** Une tenue qui a été celle d'un PASS : elle ne sort plus jamais d'un booster. */
export const tenueDePass = (tenueId) => passAvecTenue().some((p) => p.tenue === tenueId);

/** Les PASS qui ont cette tenue. */
export const passDeLaTenue = (tenueId) =>
  passAvecTenue().filter((p) => p.tenue === tenueId).map((p) => p.numero);

/**
 * Les saisons qu'un achat couvre.
 *
 * `courante` : la saison en cours (`saisonEnCours()`), ou `null`.
 * `dernierMois` : le nombre de jours de la fin de saison où un achat couvre
 * aussi la suivante (`pass.dernier_mois_jours`).
 *
 * Une saison finie qui attend la suivante : l'achat vaut pour la suivante.
 * Sans saison lancée, rien ne s'achète : il n'y a rien à couvrir.
 */
export function saisonsCouvertes(courante, dernierMois = 30) {
  if (!courante || !Number.isFinite(Number(courante.numero))) return [];
  const n = Number(courante.numero);
  /* **La saison 0 est la BASE** (Gaël, 3 novembre 2026) : elle n'a pas de
     PASS à elle. Un achat pendant la BASE est le PASS 1, actif tout de suite
     (voir `estAbonne`) et jusqu'à la fin de la saison 1. */
  if (n === 0) return [1];
  if (courante.finie) return [n + 1];
  const reste = Number(courante.joursRestants);
  if (Number.isFinite(reste) && reste <= dernierMois) return [n, n + 1];
  return [n];
}

/* ============================================================ les anciens PASS

   Règles de Gaël du 3 novembre 2026 (fil « Vendre les anciens PASS en
   boutique ») :

   - un PASS revient en vente **le 1er du deuxième mois après la fin de sa
     saison** (fin le 28 février → en vente dès le 1er avril), au même prix
     qu'à l'origine, en euros ou en écharpes ;
   - le tampon « ÉDITION ORIGINALE » reste à ceux qui l'ont pris **pendant**
     la saison ;
   - l'acheteur tardif n'a que le **contenu** du PASS (tenue, stuff, stade,
     mini-jeux), jamais ses **gains spéciaux** (cadre, cadre animé, badge en
     or, badge, club suivi et KOP en plus) ;
   - un joueur de la saison qui n'a pas fini sa voie garde ce qu'il a, et le
     contenu qui lui manque tombe ensuite dans ses boosters ; les gains
     spéciaux, eux, ne s'ouvrent plus (sa voie s'arrête avec le carnet).

   Un achat tardif se reconnaît à sa source, `stripe-tard` ou `echarpes-tard`
   (`user_pass.source`, 16 caractères) : la règle se lit sur la ligne, sans
   date à recalculer ni colonne de plus. */

/** Le suffixe des achats faits après la saison. */
export const SUFFIXE_TARD = '-tard';

/** Cette ligne de `user_pass` vient-elle d'un achat après la saison ? */
export const estTardif = (source) => String(source ?? '').endsWith(SUFFIXE_TARD);

/** Le contenu d'un PASS, que l'acheteur tardif reçoit aussi. */
export const GAINS_CONTENU = Object.freeze(['tenue', 'stuff', 'stade', 'jeu']);
/** Ses gains spéciaux, réservés à ceux qui l'ont joué pendant sa saison. */
export const GAINS_SPECIAUX = Object.freeze(['cadre', 'cadre_anime', 'badge_or',
  /* Ceux de la voie à 12 niveaux (fil de la voie PASS, 3 novembre 2026). */
  'cadre_profil', 'stickers', 'fond_profil', 'entree', 'titre', 'aura']);

/**
 * Le jour où l'ancien PASS d'une saison revient en vente : `'AAAA-MM-01'`.
 *
 * Le 1er du deuxième mois après le dernier jour de la saison : fin le
 * 28 février, vente le 1er avril ; fin le 30 novembre, vente le 1er janvier
 * suivant. `null` sans date de fin lisible.
 */
export function venteAncienPassLe(finJour) {
  const m = /^(\d{4})-(\d{2})-\d{2}/.exec(String(finJour ?? ''));
  if (!m) return null;
  const mois = Number(m[1]) * 12 + (Number(m[2]) - 1) + 2;
  const a = Math.floor(mois / 12);
  return `${a}-${String((mois % 12) + 1).padStart(2, '0')}-01`;
}

/**
 * Les anciens PASS en vente aujourd'hui, parmi les saisons données.
 *
 * `saisons` : `[{ numero, fin, lancee }]` (la forme de `toutesLesSaisons`,
 * `fin` en `'AAAA-MM-JJ'`). `aujourdHui` : `'AAAA-MM-JJ'`. `deja` : les
 * numéros que le joueur a déjà. Rend `[{ numero, venteLe }]`, du plus ancien
 * au plus récent. La BASE (saison 0) n'a pas de PASS : elle n'y est jamais.
 */
export function anciensPassEnVente(saisons, aujourdHui, deja = []) {
  const ont = new Set((deja ?? []).map(Number));
  const vus = new Set();
  const out = [];
  for (const s of saisons ?? []) {
    const n = Number(s?.numero);
    if (!Number.isInteger(n) || n < 1 || vus.has(n) || !s?.lancee) continue;
    const le = venteAncienPassLe(s.fin);
    if (!le || String(aujourdHui) < le) continue;
    vus.add(n);
    if (!ont.has(n)) out.push({ numero: n, venteLe: le });
  }
  return out.sort((a, b) => a.numero - b.numero);
}

/**
 * La voie d'un PASS selon la façon dont on l'a pris.
 *
 * Pris pendant la saison : le niveau atteint, gains spéciaux compris.
 * Pris après : le niveau 1 pour le contenu (la tenue au premier âge, comme
 * à l'achat), aucun gain spécial ; les âges suivants viennent des boosters.
 */
export function voieSelonAchat(numero, niveau, { tardif = false } = {}) {
  if (!tardif) return { ...vitrineDe(numero, niveau), original: true, tardif: false };
  return { ...vitrineDe(numero, 1), cadre: null, or: false, original: false, tardif: true };
}
