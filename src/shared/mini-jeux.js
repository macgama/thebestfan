/**
 * Les mini-jeux d'entre les matchs, en règles pures : les jongles et les tirs
 * au but (demande de Gaël, 18 octobre 2026). Rien ici ne lit la base ni
 * l'horloge : le serveur et la page lisent les mêmes règles, et la suite les
 * éprouve sans rien monter.
 */

/* ================================================================ jongles

   Le ballon tombe, on tape dessous pour le relancer. Le jeu se joue dans la
   page ; le serveur ne voit que le score et l'instant de chaque frappe, et il
   vérifie que ces instants sont possibles. Un ballon relancé met au moins
   `ECART_MIN_MS` à retomber à portée de doigt (la physique de la page, plus
   bas, le garantit) : une liste de frappes plus serrées n'a pas été jouée.

   C'est une borne, pas une preuve. Le gain d'une partie est plafonné, et le
   disjoncteur du grand livre plafonne la journée : tricher rapporte au plus
   ce qu'un très bon joueur gagne. */

export const JONGLES = Object.freeze({
  /* La physique de la page, en pixels d'une aire de 360 × 540 et en
     secondes. La gravité monte avec le compte : le ballon retombe plus vite,
     il faut taper plus vite. */
  largeur: 360,
  hauteur: 540,
  rayon: 30,
  gravite: 900,
  graviteParJongle: 14,
  graviteMax: 2200,
  elan: 760,
  /* La frappe dévie le ballon selon l'endroit où le doigt le touche, et le
     hasard de la graine y ajoute un peu de vent. */
  deviation: 9,
  vent: 70,
  /* Le doigt touche le ballon s'il tombe dans ce rayon autour de lui. */
  portee: 52,
  /* Le plus court écart possible entre deux frappes, physique comprise. */
  ECART_MIN_MS: 300,
  /* Une partie plus longue n'existe pas : elle a été laissée ouverte. */
  DUREE_MAX_MS: 20 * 60 * 1000,
  SCORE_MAX: 2000,
});

/**
 * Les frappes d'une partie de jongles sont-elles possibles ? Rend le score
 * retenu, ou `null` quand elles ne le sont pas.
 *
 * @param {number} score   ce que la page annonce
 * @param {number[]} frappes les instants de chaque frappe, en millisecondes
 *   depuis le début de la partie
 * @param {number} dureeMs le temps écoulé, mesuré par le serveur, entre
 *   l'ouverture de la partie et son envoi
 */
export function scoreDeJongles(score, frappes, dureeMs) {
  if (!Number.isInteger(score) || score < 0 || score > JONGLES.SCORE_MAX) return null;
  if (!Array.isArray(frappes) || frappes.length !== score) return null;
  let avant = -Infinity;
  for (const t of frappes) {
    if (typeof t !== 'number' || !Number.isFinite(t) || t < 0) return null;
    if (t - avant < JONGLES.ECART_MIN_MS) return null;
    avant = t;
  }
  /* Une seconde de marge : l'envoi part après la dernière frappe, et l'horloge
     du serveur compte aussi le trajet. */
  if (score && avant > dureeMs + 1000) return null;
  return score;
}

/** Les écharpes d'une partie de jongles, aux réglages donnés. */
export function gainDeJongles(score, { parEcharpe, maxPartie }) {
  if (!parEcharpe || parEcharpe < 1) return 0;
  return Math.max(0, Math.min(maxPartie, Math.floor(score / parEcharpe)));
}

/** Un petit hasard déterministe : la même graine donne les mêmes rebonds. */
export function hasard(graine) {
  let s = (Number(graine) >>> 0) || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

/* ========================================================== tirs au but

   Le but est coupé en six zones : trois colonnes (0 gauche, 1 centre,
   2 droite, vues du tireur) sur deux rangs (0 au ras du sol, 1 en hauteur).
   Zone = rang × 3 + colonne.

   Un tir, c'est une zone et une force de 0 à 1 (la vitesse du geste). Un
   plongeon, c'est une zone. Les règles :
     — trop fort (au-delà de `FORCE_MAX`), le ballon passe au-dessus ;
     — le gardien dans la zone exacte arrête tout ;
     — le gardien dans la bonne colonne, au mauvais rang, n'arrête qu'un tir
       mou (sous `FORCE_ARRET`) ;
     — ailleurs, c'est but.

   Aucun tir n'est donc imparable, et aucun tir n'est sûr : on devine le
   côté, comme sur un vrai point de penalty, et le geste décide si le ballon
   part où l'on voulait, assez fort mais pas trop. Une requête écrite à la
   main ne gagne rien : elle choisit la zone et la force, comme le doigt. */

export const TIRS = Object.freeze({
  NOMBRE: 5,
  ZONES: 6,
  FORCE_MAX: 0.92,
  FORCE_ARRET: 0.55,
  /* Sans adversaire passé ce délai, le Fanzzy de la machine joue la série. */
  ATTENTE_MACHINE_H: 12,
});

const zoneValide = (z) => Number.isInteger(z) && z >= 0 && z < TIRS.ZONES;
const forceValide = (f) => typeof f === 'number' && Number.isFinite(f) && f >= 0 && f <= 1;

/**
 * Le jeu d'un joueur, validé et normalisé, ou `null` :
 * `{ tirs: [{ zone, force }] × 5, arrets: [zone] × 5 }`.
 * La force est arrondie au centième : c'est la précision du geste, et une
 * colonne JSON n'a pas à garder dix-sept décimales.
 */
export function jeuDeTirs(brut) {
  if (!brut || typeof brut !== 'object') return null;
  const { tirs, arrets } = brut;
  if (!Array.isArray(tirs) || tirs.length !== TIRS.NOMBRE) return null;
  if (!Array.isArray(arrets) || arrets.length !== TIRS.NOMBRE) return null;
  const t = [];
  for (const x of tirs) {
    if (!x || !zoneValide(x.zone) || !forceValide(x.force)) return null;
    t.push({ zone: x.zone, force: Math.round(x.force * 100) / 100 });
  }
  if (!arrets.every(zoneValide)) return null;
  return { tirs: t, arrets: [...arrets] };
}

/** Ce que devient un tir face à un plongeon : 'but', 'arret' ou 'dessus'. */
export function issueDuTir(tir, arret) {
  if (tir.force > TIRS.FORCE_MAX) return 'dessus';
  if (tir.zone === arret) return 'arret';
  if (tir.zone % 3 === arret % 3 && tir.force < TIRS.FORCE_ARRET) return 'arret';
  return 'but';
}

/**
 * La série réglée : les tirs de A contre les plongeons de B, et l'inverse,
 * tour à tour (A tire le premier). Rend `{ coups, butsA, butsB, gagnant }`,
 * `gagnant` valant 'a', 'b' ou 'nul'. `coups` dit chaque tir dans l'ordre où
 * la page le rejoue.
 */
export function reglerTirs(jeuA, jeuB) {
  const coups = [];
  let butsA = 0;
  let butsB = 0;
  for (let i = 0; i < TIRS.NOMBRE; i++) {
    const ia = issueDuTir(jeuA.tirs[i], jeuB.arrets[i]);
    coups.push({ tireur: 'a', zone: jeuA.tirs[i].zone, plongeon: jeuB.arrets[i], issue: ia });
    if (ia === 'but') butsA++;
    const ib = issueDuTir(jeuB.tirs[i], jeuA.arrets[i]);
    coups.push({ tireur: 'b', zone: jeuB.tirs[i].zone, plongeon: jeuA.arrets[i], issue: ib });
    if (ib === 'but') butsB++;
  }
  const gagnant = butsA > butsB ? 'a' : butsB > butsA ? 'b' : 'nul';
  return { coups, butsA, butsB, gagnant };
}

/**
 * Le jeu du Fanzzy de la machine, tiré de la graine (l'identifiant de la
 * série) : il tire n'importe où, assez fort et sans jamais passer au-dessus,
 * et plonge au hasard.
 */
export function jeuDeLaMachine(graine) {
  const r = hasard(graine * 2654435761);
  const tirs = [];
  const arrets = [];
  for (let i = 0; i < TIRS.NOMBRE; i++) {
    tirs.push({ zone: Math.floor(r() * TIRS.ZONES), force: Math.round((0.5 + r() * 0.4) * 100) / 100 });
    arrets.push(Math.floor(r() * TIRS.ZONES));
  }
  return { tirs, arrets };
}
