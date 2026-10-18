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

/* ======================================================= chant en rythme

   Un « Guitar Hero » de tribune : les notes descendent sur trois tambours,
   on tape le bon tambour quand la note passe la ligne. PARFAIT ou BON selon
   l'écart, et la série de notes réussies multiplie les points. Une frappe
   sur un tambour muet casse la série : taper partout ne paie pas.

   La partition sort de la graine de la partie : le serveur la retrouve et
   note lui-même la liste des frappes (`noterChant`). La page en garde une
   copie mot pour mot, entre les deux repères `@page` : la suite `jeux:ui`
   compare les deux textes. */

/* @page:debut chant */
const CHANT = Object.freeze({
  COULOIRS: 3,
  /* La première note tombe après `DEBUT_MS`, la dernière avant `DUREE_MS`. */
  DEBUT_MS: 2400,
  DUREE_MS: 42000,
  /* Le temps qu'une note met à descendre du haut du terrain à la ligne. */
  CHUTE_MS: 1500,
  PARFAIT_MS: 60,
  BON_MS: 130,
  POINTS_PARFAIT: 100,
  POINTS_BON: 50,
  /* Le multiplicateur monte d'un cran toutes les `PALIER` notes réussies
     d'affilée, jusqu'à `MULT_MAX`. */
  PALIER: 10,
  MULT_MAX: 4,
});

/**
 * La partition d'un chant : `{ bpm, notes: [{ t, c }] }`, `t` en
 * millisecondes depuis le début de la partie, `c` le tambour (0 à 2). Le
 * chant se densifie de mesure en mesure.
 */
function partitionDuChant(graine) {
  const r = hasard(graine);
  const bpm = 96 + Math.floor(r() * 5) * 6;
  const croche = 60000 / bpm / 2;
  const notes = [];
  let c = 1;
  for (let k = 0; ; k++) {
    const t = Math.round(CHANT.DEBUT_MS + k * croche);
    if (t > CHANT.DUREE_MS) break;
    const mesure = Math.floor(k / 8);
    const densite = Math.min(0.9, 0.3 + mesure * 0.045);
    const p = k % 2 === 0 ? densite + 0.25 : densite * 0.55;
    if (r() < p) {
      /* Le plus souvent, le tambour d'à côté : la main court sur la peau. */
      const saut = r();
      c = saut < 0.4 ? c : saut < 0.8 ? (c + 1) % 3 : (c + 2) % 3;
      notes.push({ t, c });
    }
  }
  return { bpm, notes };
}

/**
 * Note les frappes d'un chant. `frappes` : `[{ c, t }]` dans l'ordre du
 * temps. Rend `null` si la liste est impossible, sinon
 * `{ score, parfaits, bons, rates, fausses, serieMax, reussis }`.
 *
 * Chaque note prend, sur son tambour, la frappe libre la plus proche dans sa
 * fenêtre ; les frappes qui ne trouvent aucune note sont « fausses ».
 */
function noterChant(partition, frappes) {
  const notes = partition.notes;
  if (!Array.isArray(frappes) || frappes.length > notes.length * 2 + 20) return null;
  let avant = -Infinity;
  for (const f of frappes) {
    if (!f || !Number.isInteger(f.c) || f.c < 0 || f.c >= CHANT.COULOIRS) return null;
    if (typeof f.t !== 'number' || !Number.isFinite(f.t) || f.t < 0
      || f.t > CHANT.DUREE_MS + 5000 || f.t < avant) return null;
    avant = f.t;
  }
  const prise = new Array(frappes.length).fill(false);
  const evenements = [];
  for (const n of notes) {
    let meilleure = -1;
    let ecart = Infinity;
    for (let i = 0; i < frappes.length; i++) {
      if (prise[i] || frappes[i].c !== n.c) continue;
      const e = Math.abs(frappes[i].t - n.t);
      if (e <= CHANT.BON_MS && e < ecart) { ecart = e; meilleure = i; }
    }
    if (meilleure >= 0) prise[meilleure] = true;
    evenements.push({ t: n.t, v: meilleure < 0 ? 'rate' : ecart <= CHANT.PARFAIT_MS ? 'parfait' : 'bon' });
  }
  frappes.forEach((f, i) => { if (!prise[i]) evenements.push({ t: f.t, v: 'fausse' }); });
  evenements.sort((a, b) => a.t - b.t);
  const bilan = { score: 0, parfaits: 0, bons: 0, rates: 0, fausses: 0, serieMax: 0, reussis: 0 };
  let serie = 0;
  for (const e of evenements) {
    if (e.v === 'parfait' || e.v === 'bon') {
      const mult = Math.min(CHANT.MULT_MAX, 1 + Math.floor(serie / CHANT.PALIER));
      bilan.score += (e.v === 'parfait' ? CHANT.POINTS_PARFAIT : CHANT.POINTS_BON) * mult;
      bilan[e.v === 'parfait' ? 'parfaits' : 'bons']++;
      bilan.reussis++;
      serie++;
      bilan.serieMax = Math.max(bilan.serieMax, serie);
    } else {
      bilan[e.v === 'rate' ? 'rates' : 'fausses']++;
      serie = 0;
    }
  }
  return bilan;
}
/* @page:fin chant */

/* =========================================================== déplacement

   Une course sans fin vers le stade adverse : le Fanzzy court tout seul, on
   le fait sauter (toucher) par-dessus les barrières et le car en panne, et
   glisser (glisser le doigt vers le bas) sous la barrière du péage. Les
   tickets ramassés en route valent `TICKET_M` mètres. Plus on va loin, plus
   ça va vite.

   La course est réglée image par image, à 60 images par seconde, sur une
   route tirée de la graine : le serveur rejoue la liste des gestes (image,
   geste) et trouve seul la distance. Mot pour mot dans la page, comme le
   chant. */

/* @page:debut course */
const COURSE = Object.freeze({
  IMAGES_S: 60,
  IMAGES_MAX: 60 * 60 * 15,
  GRAVITE: 2600,
  SAUT: 900,
  /* Une glissade dure tant d'images ; en l'air, elle plaque au sol. */
  GLISSADE: 36,
  V0: 260,
  ACCEL: 7,
  VMAX: 640,
  /* Le Fanzzy, en pixels de route : sa place à l'écran, sa largeur, sa
     hauteur debout et en glissade. */
  X: 70,
  LARGEUR: 34,
  HAUT: 70,
  HAUT_GLISSE: 32,
  /* La route apparaît à cette distance devant lui. */
  VUE: 420,
  PX_PAR_METRE: 20,
  TICKET_M: 20,
});

const OBSTACLES = Object.freeze({
  barriere: { l: 26, bas: 0, haut: 44 },
  peage: { l: 30, bas: 46, haut: 400 },
  car: { l: 110, bas: 0, haut: 58 },
  ticket: { l: 22, bas: 0, haut: 22 },
});

/** Une course neuve : son état, et `pas(geste)` pour avancer d'une image. */
function nouvelleCourse(graine) {
  const r = hasard(graine);
  const dt = 1 / COURSE.IMAGES_S;
  const s = { image: 0, dist: 0, y: 0, vy: 0, glisse: 0, v: COURSE.V0, tickets: 0, fini: false,
    route: [], prochain: COURSE.VUE };

  function poser() {
    const avance = s.dist > 1600;
    const x = r();
    const type = !avance || x < 0.45 ? 'barriere' : x < 0.75 ? 'peage' : 'car';
    const o = OBSTACLES[type];
    s.route.push({ type, x: s.prochain, l: o.l, bas: o.bas, haut: o.haut });
    const ecart = s.v * (0.95 + r() * 0.9);
    if (r() < 0.4) {
      const bas = r() < 0.5 ? 20 : 110;
      s.route.push({ type: 'ticket', x: s.prochain + o.l + ecart * 0.45, l: OBSTACLES.ticket.l, bas,
        haut: bas + OBSTACLES.ticket.haut });
    }
    s.prochain += o.l + ecart;
  }

  /** Une image. `geste` : 0 rien, 1 sauter, 2 glisser. */
  function pas(geste) {
    if (s.fini) return s;
    if (geste === 1 && s.y === 0) { s.vy = COURSE.SAUT; s.glisse = 0; }
    if (geste === 2) {
      s.glisse = COURSE.GLISSADE;
      if (s.y > 0) s.vy = Math.min(s.vy, -COURSE.SAUT);
    }
    s.image++;
    s.v = Math.min(COURSE.VMAX, COURSE.V0 + COURSE.ACCEL * s.image * dt);
    s.dist += s.v * dt;
    if (s.y > 0 || s.vy > 0) {
      s.vy -= COURSE.GRAVITE * dt;
      s.y += s.vy * dt;
      if (s.y <= 0) { s.y = 0; s.vy = 0; }
    }
    if (s.glisse > 0) s.glisse--;
    while (s.prochain < s.dist + COURSE.VUE) poser();

    const gauche = s.dist + COURSE.X;
    const droite = gauche + COURSE.LARGEUR;
    const bas = s.y;
    const haut = s.y + (s.glisse > 0 ? COURSE.HAUT_GLISSE : COURSE.HAUT);
    for (let i = 0; i < s.route.length; i++) {
      const o = s.route[i];
      if (o.x > droite || o.x + o.l < gauche || o.bas > haut || o.haut < bas) continue;
      if (o.type === 'ticket') { s.tickets++; s.route.splice(i, 1); i--; continue; }
      s.fini = true;
      break;
    }
    while (s.route.length && s.route[0].x + s.route[0].l < s.dist) s.route.shift();
    if (s.image >= COURSE.IMAGES_MAX) s.fini = true;
    return s;
  }

  return { etat: s, pas };
}

/** Les mètres et le score d'une course. */
function scoreDeCourse(s) {
  const metres = Math.floor(s.dist / COURSE.PX_PAR_METRE);
  return { metres, tickets: s.tickets, score: metres + s.tickets * COURSE.TICKET_M };
}
/* @page:fin course */

/**
 * Rejoue une course : `gestes`, `[[image, geste]]` dans l'ordre. Rend `null`
 * si la liste est impossible, sinon `{ images, metres, tickets, score }`.
 * Les gestes posés après la chute ne comptent pas.
 */
function rejouerCourse(graine, gestes) {
  if (!Array.isArray(gestes) || gestes.length > 20000) return null;
  let avant = -1;
  for (const g of gestes) {
    if (!Array.isArray(g) || g.length !== 2) return null;
    const [img, geste] = g;
    if (!Number.isInteger(img) || img < 0 || img >= COURSE.IMAGES_MAX || img < avant) return null;
    if (geste !== 1 && geste !== 2) return null;
    avant = img;
  }
  const course = nouvelleCourse(graine);
  let k = 0;
  while (!course.etat.fini) {
    let geste = 0;
    /* Deux gestes sur la même image : le dernier compte. */
    while (k < gestes.length && gestes[k][0] === course.etat.image) geste = gestes[k++][1];
    course.pas(geste);
  }
  return { images: course.etat.image, ...scoreDeCourse(course.etat) };
}

/** Les écharpes d'un score, à `parEcharpe` le point, plafonnées par partie. */
export function gainDeScore(score, { parEcharpe, maxPartie }) {
  if (!parEcharpe || parEcharpe < 1) return 0;
  return Math.max(0, Math.min(maxPartie, Math.floor(score / parEcharpe)));
}

/* ========================================================== le tifo du club

   Une mosaïque de 20 × 12 cases, que les supporters d'un club peignent
   ensemble avant un match : les lettres du club (jusqu'à trois) en grand sur
   la couleur du club, une bande à damier en haut et en bas. Trois couleurs :
   0 la couleur du club, 1 sa seconde couleur, 2 la craie. */

export const TIFO = Object.freeze({ COLONNES: 20, RANGS: 12, COULEURS: 3 });
const TIFO_CASES = TIFO.COLONNES * TIFO.RANGS;

/* Les lettres en 3 × 5, ligne par ligne. */
const GLYPHES = {
  A: '.#.#.#####.##.#', B: '##.#.###.#.###.', C: '.###..#..#...##', D: '##.#.##.##.###.',
  E: '####..##.#..###', F: '####..##.#..#..', G: '.###..#.##.#.##', H: '#.##.#####.##.#',
  I: '###.#..#..#.###', J: '..#..#..##.#.#.', K: '#.##.###.#.##.#', L: '#..#..#..#..###',
  M: '#.########.##.#', N: '##.#.##.##.##.#', O: '.#.#.##.##.#.#.', P: '##.#.###.#..#..',
  Q: '.#.#.##.###..##', R: '##.#.###.#.##.#', S: '.###...#...###.', T: '###.#..#..#..#.',
  U: '#.##.##.##.####', V: '#.##.##.##.#.#.', W: '#.##.########.#', X: '#.##.#.#.#.##.#',
  Y: '#.##.#.#..#..#.', Z: '###..#.#.#..###', 0: '####.##.##.####', 1: '.#.##..#..#.###',
  2: '##...#.#.#..###', 3: '##...#.#...###.', 4: '#.##.####..#..#', 5: '####..##...###.',
  6: '.###..####.####', 7: '###..#.#..#..#.', 8: '####.#####.####', 9: '####.####..###.',
};

/** Les lettres du tifo d'un club : son code, ou les premières de son nom. */
export function lettresDuClub(code, nom) {
  const net = (x) => String(x ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/[^A-Z0-9]/g, '');
  return (net(code) || net(nom) || 'TBF').slice(0, 3);
}

/** Le motif : `TIFO.COLONNES × TIFO.RANGS` couleurs, rang par rang. */
export function motifDuTifo(lettres) {
  const m = new Array(TIFO_CASES).fill(0);
  for (let c = 0; c < TIFO.COLONNES; c++) {
    m[c] = c % 2 ? 1 : 2;
    m[(TIFO.RANGS - 1) * TIFO.COLONNES + c] = c % 2 ? 2 : 1;
  }
  const l = [...lettres].filter((x) => GLYPHES[x]).slice(0, 3);
  const largeur = l.length * 6 + Math.max(0, l.length - 1);
  let x0 = Math.floor((TIFO.COLONNES - largeur) / 2);
  for (const lettre of l) {
    const g = GLYPHES[lettre];
    for (let gy = 0; gy < 5; gy++) {
      for (let gx = 0; gx < 3; gx++) {
        if (g[gy * 3 + gx] !== '#') continue;
        for (let dy = 0; dy < 2; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            m[(1 + gy * 2 + dy) * TIFO.COLONNES + x0 + gx * 2 + dx] = 1;
          }
        }
      }
    }
    x0 += 7;
  }
  return m;
}

/** La part des cases à la bonne couleur, de 0 à 1. */
export function fideliteDuTifo(motif, cases) {
  let justes = 0;
  for (let i = 0; i < motif.length; i++) if (cases[i] === motif[i]) justes++;
  return justes / motif.length;
}

export { CHANT, partitionDuChant, noterChant, COURSE, OBSTACLES, nouvelleCourse, scoreDeCourse,
  rejouerCourse };
