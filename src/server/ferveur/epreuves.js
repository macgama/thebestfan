/**
 * Les épreuves du virage : cinq familles qui ne sont ni du rythme ni de la
 * force.
 *
 * ## Pourquoi un fichier à part
 *
 * Les dix gestes de `gestures.js` demandent tous la même chose au joueur —
 * frapper au bon moment, frapper vite, tenir — et se notent tous à partir de
 * la même donnée : une liste d'instants. Ces cinq-ci demandent autre chose et
 * se notent autrement : un tracé, une grille, une suite. Les mêler aux dix
 * aurait obligé chaque fonction à commencer par démêler ce qu'elle reçoit.
 *
 * ## Le contrat, en deux temps
 *
 * 1. **La consigne** — ce que le serveur demande. Elle est tirée d'une graine,
 *    donc reproductible : le même duel à la même minute pose la même épreuve
 *    aux deux joueurs, et un contrôle peut la rejouer.
 * 2. **La réponse** — ce que le joueur a fait. Sa forme dépend de la famille :
 *    un tracé pour le tifo et l'écharpe, une grille pour la mosaïque, une
 *    suite pour le capo et la mémoire.
 *
 * Les deux voyagent ensemble jusqu'à `noter`, qui rend une note entre 0 et
 * 1,2 — la même échelle que les dix gestes, pour que les moteurs n'aient rien
 * à savoir de tout ceci.
 *
 * ## Ce qu'on peut tricher, et ce qu'on y fait
 *
 * **La consigne part chez le joueur, donc la réponse aussi.** Un client
 * modifié rend la grille parfaite et la suite complète. C'est inhérent : la
 * mosaïque et le capo *montrent* ce qu'il faut refaire, et la mémoire aussi.
 * L'adresse qu'on mesure est de s'en souvenir, et une machine se souvient.
 *
 * C'est exactement la situation des dix gestes, où rien n'empêche de fabriquer
 * une liste de frappes parfaites. La défense y est la **vraisemblance** — voir
 * `sanity` dans `gestures.js` — et elle est la même ici : un humain met du
 * temps à se décider, et ce temps varie. `humain()` refuse les réponses trop
 * promptes ou trop régulières. C'est un filet, pas une preuve, et le dire est
 * plus honnête que de prétendre l'inverse.
 */

export class Triche extends Error {
  constructor(code) { super(code); this.code = code; }
}

/** Les cinq familles, dans l'ordre où elles ont été écrites. */
export const EPREUVES = ['tifo', 'memoire', 'mosaique', 'echarpe', 'capo'];

export const REGLES = {
  /* Tracer une forme sans quitter le trait. `tolerance` est en fraction du
     cadre : 0,12 veut dire qu'à douze pour cent de largeur du trait, on est
     encore dessus. Large exprès — on joue au doigt, sur un téléphone, pendant
     un match. */
  tifo: { ms: 6000, tolerance: 0.075, saut: 0.16, minPoints: 24, maxPoints: 600 },

  /* Huit visages montrés deux secondes, puis retournés. On les rappelle par
     paires. Quatre paires : assez pour que ce soit un effort, assez peu pour
     que ça tienne en dix secondes de match. */
  memoire: { paires: 4, apercu: 2000, ms: 12000 },

  /* La grille s'allume une seconde et s'éteint. Seize cases, dont six
     allumées : au-delà, on ne mémorise plus, on devine. */
  mosaique: { cotes: 4, allumees: 6, apercu: 1100, ms: 9000 },

  /* Trois tours d'écharpe. `rayonMin` écarte le petit cercle au ras du doigt,
     qui serait plus facile et moins beau. */
  echarpe: { ms: 7000, tours: 3, rayonMin: 0.14, minPoints: 30, maxPoints: 800 },

  /* Le capo montre une suite qui s'allonge. Six zones, six coups : la suite
     dépasse l'empan de la plupart des gens, et c'est le but — on ne cherche
     pas le sans-faute, on cherche jusqu'où chacun va. */
  capo: { zones: 6, longueur: 6, pas: 620, ms: 9000 },
};

/* --------------------------------------------------------------- le hasard

   Un générateur à graine, court et sans prétention. Il n'a pas besoin d'être
   bon : il a besoin d'être **reproductible**, pour que le serveur et le
   contrôle tirent la même chose, et pour que les deux joueurs d'un duel aient
   la même épreuve à la même minute. */
function suite(graine) {
  /* La graine est **brassée** avant de servir, et les premiers tirages sont
     jetés. Sans ça, le générateur de Lehmer rend une valeur proportionnelle à
     sa graine au premier appel : pour des graines de un à quarante — c'est-à-
     dire toutes les nôtres, un rang de répertoire ou un compte de chants — le
     premier tirage valait toujours presque zéro.

     Le tifo tirait donc toujours la même forme, le rond, et les mélanges
     commençaient tous pareil. On ne s'en aperçoit qu'en essayant plusieurs
     graines : avec une seule, tout a l'air parfaitement aléatoire. */
  let x = Math.floor(Math.abs(Number(graine) || 0)) + 1;
  x = ((x * 2654435761) % 2147483647) || 1;
  const tirer = () => (x = (x * 16807) % 2147483647) / 2147483647;
  tirer(); tirer(); tirer();
  return tirer;
}

const melanger = (t, rnd) => {
  const a = [...t];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/* ------------------------------------------------------------- les formes

   Les quatre tracés du tifo, en coordonnées de zéro à un. Ils sont **fermés**
   — le dernier point rejoint le premier — parce qu'un tifo se déplie en
   boucle, et parce qu'une forme ouverte se réussit en s'arrêtant au milieu. */
const FORMES = {
  rond: Array.from({ length: 48 }, (_, i) => {
    const a = (i / 48) * Math.PI * 2;
    return { x: 0.5 + Math.cos(a) * 0.36, y: 0.5 + Math.sin(a) * 0.36 };
  }),
  /* L'écharpe : un rectangle très allongé, aux coins arrondis par le tracé. */
  echarpe: [
    ...Array.from({ length: 16 }, (_, i) => ({ x: 0.14 + (i / 16) * 0.72, y: 0.34 })),
    ...Array.from({ length: 6 }, (_, i) => ({ x: 0.86, y: 0.34 + (i / 6) * 0.32 })),
    ...Array.from({ length: 16 }, (_, i) => ({ x: 0.86 - (i / 16) * 0.72, y: 0.66 })),
    ...Array.from({ length: 6 }, (_, i) => ({ x: 0.14, y: 0.66 - (i / 6) * 0.32 })),
  ],
  /* Le triangle du fanion, pointe en bas. */
  fanion: [
    ...Array.from({ length: 16 }, (_, i) => ({ x: 0.16 + (i / 16) * 0.68, y: 0.2 })),
    ...Array.from({ length: 16 }, (_, i) => ({ x: 0.84 - (i / 16) * 0.34, y: 0.2 + (i / 16) * 0.62 })),
    ...Array.from({ length: 16 }, (_, i) => ({ x: 0.5 - (i / 16) * 0.34, y: 0.82 - (i / 16) * 0.62 })),
  ],
  /* Un cœur : le geste le plus lisible quand on n'a pas le temps de lire. */
  coeur: Array.from({ length: 52 }, (_, i) => {
    const t = (i / 52) * Math.PI * 2;
    const x = 16 * Math.sin(t) ** 3;
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    return { x: 0.5 + x / 42, y: 0.5 - y / 42 };
  }),
};

export const NOMS_FORMES = Object.keys(FORMES);

/* ----------------------------------------------------------- la consigne */

/**
 * Ce que le serveur demande, pour cette épreuve et cette graine.
 *
 * Tout ce qui est ici part chez le joueur : c'est ce qu'il doit voir. Rien
 * d'autre ne doit y entrer — le jour où une épreuve aura un secret, il faudra
 * un second canal, pas un champ de plus.
 */
export function consigneDe(epreuve, graine = 0) {
  const rnd = suite(graine + 1);

  if (epreuve === 'tifo') {
    const nom = NOMS_FORMES[Math.floor(rnd() * NOMS_FORMES.length)];
    return { ...REGLES.tifo, forme: nom, points: FORMES[nom] };
  }

  if (epreuve === 'memoire') {
    const { paires } = REGLES.memoire;
    // Deux exemplaires de chaque visage, mêlés. Les visages sont désignés par
    // un rang ; c'est la page qui décide quel dessin porte le rang deux.
    const cartes = melanger(
      Array.from({ length: paires * 2 }, (_, i) => i % paires), rnd);
    return { ...REGLES.memoire, cartes };
  }

  if (epreuve === 'mosaique') {
    const { cotes, allumees } = REGLES.mosaique;
    const cases = cotes * cotes;
    const choisies = new Set(melanger(
      Array.from({ length: cases }, (_, i) => i), rnd).slice(0, allumees));
    return {
      ...REGLES.mosaique,
      grille: Array.from({ length: cases }, (_, i) => (choisies.has(i) ? 1 : 0)),
    };
  }

  if (epreuve === 'echarpe') {
    // Le sens change d'une fois sur l'autre : sans ça, la main prend le pli et
    // l'épreuve devient un réflexe au lieu d'un geste.
    return { ...REGLES.echarpe, sens: rnd() < 0.5 ? 1 : -1 };
  }

  if (epreuve === 'capo') {
    const { zones, longueur } = REGLES.capo;
    return {
      ...REGLES.capo,
      suite: Array.from({ length: longueur }, () => Math.floor(rnd() * zones)),
    };
  }

  throw new Triche('epreuve.inconnue');
}

/* ---------------------------------------------------------- les mesures */

/** Le carré de la distance entre deux points. La racine ne sert à rien ici. */
const d2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

/** La distance d'un point au plus proche des points d'un tracé. */
function distanceAu(trace, p) {
  let m = Infinity;
  for (const q of trace) {
    const d = d2(q, p);
    if (d < m) m = d;
  }
  return Math.sqrt(m);
}

/**
 * Une réponse d'humain, ou non.
 *
 * Deux signatures, et elles ne se valent pas.
 *
 * **Trop prompt** est un fait : deux appuis séparés de quarante millisecondes
 * ne viennent pas d'un doigt. Ce contrôle-là vaut dès le deuxième coup.
 *
 * **Trop régulier** est une statistique, et une statistique sur cinq écarts ne
 * vaut presque rien. Le seuil était de quatorze millisecondes, et il prenait
 * un joueur honnête pour un robot **une fois sur vingt** : à six coups, l'écart
 * type d'une hésitation naturelle tombe sous quatorze bien plus souvent qu'on
 * ne le croit. Mesuré, pas supposé — cinq virgule un pour cent sur quarante
 * mille tirages.
 *
 * Six millisecondes écartent toujours cent pour cent des machines, même
 * bruitées de trois millisecondes, et ne prennent plus qu'un honnête sur cinq
 * cents. C'est le bon réglage : un filet qui attrape le joueur qu'il devait
 * protéger finit par être désactivé, et alors il n'attrape plus personne.
 */
function humain(instants, { minEcart = 90, minVariation = 6 } = {}) {
  if (!Array.isArray(instants) || instants.length < 2) return;
  const ecarts = [];
  for (let i = 1; i < instants.length; i++) {
    const e = instants[i] - instants[i - 1];
    if (e < minEcart) throw new Triche('reponse.trop_rapide');
    ecarts.push(e);
  }
  // La régularité ne se juge pas sur trois valeurs.
  if (ecarts.length < 4) return;
  const moyen = ecarts.reduce((s, e) => s + e, 0) / ecarts.length;
  const variation = Math.sqrt(
    ecarts.reduce((s, e) => s + (e - moyen) ** 2, 0) / ecarts.length);
  if (variation < minVariation) throw new Triche('reponse.trop_reguliere');
}

/* ---------------------------------------------------------- la notation */

/**
 * La note d'une réponse, de 0 à 1,2 — la même échelle que les dix gestes.
 *
 * `mods` agit comme ailleurs : ce sont les modificateurs du Fanzzy et de
 * l'équipement. Ils **élargissent une tolérance**, ils ne fabriquent jamais de
 * note à partir de rien. Un porteur de Jumelles a le trait plus large ; il n'a
 * pas un tifo qu'il n'a pas tracé.
 */
export function noter(epreuve, consigne, reponse, mods = {}) {
  if (!consigne) throw new Triche('consigne.absente');
  const r = reponse ?? {};

  if (epreuve === 'tifo' || epreuve === 'echarpe') {
    const trace = Array.isArray(r.trace) ? r.trace : [];
    const cfg = REGLES[epreuve];
    if (trace.length < cfg.minPoints) return 0;
    if (trace.length > cfg.maxPoints) throw new Triche('trace.trop_longue');
    for (const p of trace) {
      if (!Number.isFinite(p?.x) || !Number.isFinite(p?.y)) {
        throw new Triche('trace.invalide');
      }
    }
    return epreuve === 'tifo'
      ? noterTifo(consigne, trace, mods)
      : noterEcharpe(consigne, trace, mods);
  }

  if (epreuve === 'mosaique') {
    const rendue = Array.isArray(r.grille) ? r.grille : [];
    if (rendue.length !== consigne.grille.length) return 0;
    humain(r.instants);
    /* On compte les cases **allumées** trouvées, et on retire les fausses.
       Compter les cases justes tout court donnerait dix sur seize à qui ne
       touche à rien — la grille est majoritairement éteinte. */
    let bonnes = 0;
    let fausses = 0;
    for (let i = 0; i < rendue.length; i++) {
      if (consigne.grille[i] === 1 && rendue[i] === 1) bonnes++;
      if (consigne.grille[i] === 0 && rendue[i] === 1) fausses++;
    }
    const part = Math.max(0, bonnes - fausses) / consigne.allumees;
    return Math.min(1.2, part * (mods.memoireBonus ?? 1));
  }

  if (epreuve === 'memoire') {
    const paires = Array.isArray(r.paires) ? r.paires : [];
    humain(r.instants);
    const vues = new Set();
    let trouvees = 0;
    for (const [a, b] of paires) {
      if (!Number.isInteger(a) || !Number.isInteger(b) || a === b) continue;
      if (vues.has(a) || vues.has(b)) continue;                 // déjà servie
      if (consigne.cartes[a] === undefined) continue;
      if (consigne.cartes[a] === consigne.cartes[b]) {
        trouvees++;
        vues.add(a); vues.add(b);
      }
    }
    /* Les essais ratés coûtent, mais moins qu'une paire ne rapporte : se
       tromper une fois ne doit pas effacer ce qu'on a trouvé deux fois. */
    const rates = Math.max(0, paires.length - trouvees);
    const part = (trouvees - rates * 0.34) / consigne.paires;
    return Math.min(1.2, Math.max(0, part) * (mods.memoireBonus ?? 1));
  }

  if (epreuve === 'capo') {
    const rendue = Array.isArray(r.suite) ? r.suite : [];
    humain(r.instants);
    /* Le **plus long début juste**, et non le nombre de coups justes. Une
       suite où l'on se trompe au deuxième coup puis retombe juste par hasard
       n'est pas une suite retenue ; s'arrêter au premier écart dit exactement
       jusqu'où la mémoire a tenu. */
    let n = 0;
    while (n < consigne.suite.length && rendue[n] === consigne.suite[n]) n++;
    return Math.min(1.2, (n / consigne.suite.length) * (mods.memoireBonus ?? 1));
  }

  throw new Triche('epreuve.inconnue');
}

/** Le rang, sur le tracé de consigne, du point le plus proche de `p`. */
function rangLePlusProche(points, p) {
  let m = Infinity;
  let rang = 0;
  for (let i = 0; i < points.length; i++) {
    const d = d2(points[i], p);
    if (d < m) { m = d; rang = i; }
  }
  return rang;
}

/**
 * Le tifo : être **sur le trait**, avoir fait **tout le tour**, et l'avoir
 * fait **dans l'ordre**.
 *
 * Les trois comptent, et il faut les trois. On les multiplie plutôt que de les
 * moyenner : l'une nulle annule les autres, ce qui est le comportement voulu.
 *
 * - **La précision** seule se réussit en restant dix secondes sur un
 *   centimètre du trait, sans rien dessiner.
 * - **La couverture** seule se réussit en balayant tout le cadre.
 * - Et les deux ensemble ne suffisaient pas : un gribouillis de soixante
 *   points jetés au hasard marquait 0,78, mieux qu'un demi-cercle tracé
 *   proprement. La bande de tolérance couvrait la moitié de l'image, et des
 *   points épars finissaient par approcher toute la forme. C'est l'**ordre**
 *   qui sépare le tracé du gribouillis : un doigt qui suit une forme avance le
 *   long d'elle, d'un pas régulier, sans se téléporter.
 */
function noterTifo(consigne, trace, mods) {
  const tolerance = consigne.tolerance * (mods.traitLarge ?? 1);

  let dessus = 0;
  for (const p of trace) {
    if (distanceAu(consigne.points, p) <= tolerance) dessus++;
  }
  const precision = dessus / trace.length;

  let atteints = 0;
  for (const p of consigne.points) {
    if (distanceAu(trace, p) <= tolerance) atteints++;
  }
  const couverture = atteints / consigne.points.length;

  /* L'ordre. Pour chaque couple de points consécutifs du tracé on demande deux
     choses : que le doigt n'ait pas sauté d'un bout à l'autre du cadre, et
     qu'il ait avancé le long de la forme — d'au plus quelques rangs, dans un
     sens ou dans l'autre, la forme se traçant aussi bien à l'envers.

     Le tracé de consigne est **fermé**, donc le rang zéro suit le dernier :
     l'écart de rang se mesure sur le cercle, sinon boucler compterait pour un
     saut, et le dernier geste du joueur serait puni. */
  const n = consigne.points.length;
  let suivis = 0;
  for (let i = 1; i < trace.length; i++) {
    if (Math.hypot(trace[i].x - trace[i - 1].x, trace[i].y - trace[i - 1].y)
        > consigne.saut) continue;
    const brut = Math.abs(rangLePlusProche(consigne.points, trace[i])
      - rangLePlusProche(consigne.points, trace[i - 1]));
    const ecart = Math.min(brut, n - brut);
    if (ecart <= Math.max(2, Math.round(n * 0.08))) suivis++;
  }
  const ordre = trace.length > 1 ? suivis / (trace.length - 1) : 0;

  return Math.min(1.2, precision * couverture * ordre * 1.2);
}

/**
 * L'écharpe : tourner, rond et régulier.
 *
 * L'angle total se mesure en cumulant les écarts d'angle autour du centre du
 * tracé, **signés** : faire un demi-tour puis revenir en arrière ne fait pas
 * un tour, et c'est précisément ce qu'un va-et-vient produirait si on prenait
 * la valeur absolue.
 */
function noterEcharpe(consigne, trace, mods) {
  const cx = trace.reduce((s, p) => s + p.x, 0) / trace.length;
  const cy = trace.reduce((s, p) => s + p.y, 0) / trace.length;

  const rayons = trace.map((p) => Math.hypot(p.x - cx, p.y - cy));
  const rayonMoyen = rayons.reduce((s, r) => s + r, 0) / rayons.length;
  if (rayonMoyen < consigne.rayonMin) return 0;

  let angle = 0;
  for (let i = 1; i < trace.length; i++) {
    const a0 = Math.atan2(trace[i - 1].y - cy, trace[i - 1].x - cx);
    const a1 = Math.atan2(trace[i].y - cy, trace[i].x - cx);
    let d = a1 - a0;
    // Le saut de ±π à ∓π n'est pas un demi-tour : on le ramène.
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    angle += d;
  }

  // Le sens demandé : tourner à l'envers ne compte pas.
  const fait = (angle * consigne.sens) / (Math.PI * 2);
  const tours = Math.max(0, fait) / consigne.tours;

  /* La rondeur : un rayon qui varie beaucoup, c'est un gribouillis qui tourne.
     On la borne à un pour qu'un cercle parfait ne rapporte pas plus que la
     note pleine, et à zéro pour qu'un tracé informe ne la rende pas négative. */
  const ecart = Math.sqrt(
    rayons.reduce((s, r) => s + (r - rayonMoyen) ** 2, 0) / rayons.length);
  const rondeur = Math.max(0, Math.min(1, 1 - (ecart / rayonMoyen) / 0.55));

  return Math.min(1.2, Math.min(1, tours) * rondeur * 1.2 * (mods.traitLarge ?? 1));
}
