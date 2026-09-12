import { EPREUVES, consigneDe, noter, Triche } from './epreuves.js';
/**
 * Évaluation des gestes.
 *
 * Le client n'annonce jamais sa réussite — il n'enverrait que des « parfait ».
 * Il envoie les instants de ses frappes, en millisecondes depuis l'ouverture de
 * la fenêtre, et c'est ici qu'on calcule ce que ça vaut. Une dizaine de nombres
 * par chant, rien de lourd, et la porte est fermée.
 *
 * ## Dix gestes, et pourquoi pas trois
 *
 * Il y en avait trois — rythme, vitesse, endurance — et un joueur faisait
 * **toujours le même**, celui du cri de son Fanzzy, pendant les cinq minutes
 * d'un duel. Ce n'est pas le nombre de gestes qui rendait le jeu répétitif,
 * c'est ça : on ne découvrait jamais rien.
 *
 * Les sept nouveaux ne sont pas sept variantes du même geste. Chacun demande
 * une chose que les autres ne demandent pas :
 *
 *   — `tempo`       le rythme ;
 *   — `mash`        la vitesse ;
 *   — `hold`        l'endurance ;
 *   — `contretemps` la syncope : taper **entre** les pulsations, ce que le
 *                   corps refuse naturellement de faire ;
 *   — `echo`        la mémoire : un motif montré une fois, à refaire. C'est le
 *                   seul geste qui change à chaque chant, et donc celui qui
 *                   porte le plus de rejouabilité à lui seul ;
 *   — `crescendo`   l'accélération régulière — un chant qui monte ;
 *   — `relance`     le relâchement : tenir, puis lâcher pile sur la pulsation ;
 *   — `salves`      le groupement : trois rafales séparées par des silences ;
 *   — `tenue`       le sang-froid : tenir le plus longtemps possible **sans
 *                   dépasser** une limite. Le seul geste où l'on peut tout
 *                   perdre en en faisant trop ;
 *   — `retenue`     la mesure : exactement tant de frappes, ni plus ni moins.
 *                   L'exact contraire du martelage.
 *
 * ## Ce que tout geste doit respecter
 *
 * Se noter à partir d'une **suite d'instants**, et rien d'autre. C'est ce qui
 * permet au serveur de juger sans faire confiance au client. Un geste qui
 * demanderait la position du doigt sortirait de ce contrat : il faudrait
 * élargir le message et rouvrir une porte. Les dix tiennent dans les instants.
 */

/**
 * Les motifs de l'écho.
 *
 * Cinq frappes, quatre intervalles, exprimés en multiples de `unite`. Tous les
 * motifs **totalisent le même nombre d'unités** : c'est ce qui les rend
 * d'égale difficulté, et c'est indispensable — le serveur dit au client quel
 * motif jouer, mais si l'un d'eux était plus facile, il suffirait d'attendre
 * son tour pour chanter. Ils diffèrent par l'ordre, jamais par la durée.
 */
export const MOTIFS = [
  [1, 2, 1, 2],
  [2, 1, 2, 1],
  [1, 1, 3, 1],
  [3, 1, 1, 1],
  [1, 3, 1, 1],
  [2, 2, 1, 1],
  [1, 1, 2, 2],
];

export const GESTURES = {
  tempo: { beats: 8, interval: 560, window: 200, maxTaps: 24 },
  mash: { ms: 3000, target: 21, maxTaps: 60 },
  hold: { need: 3200, maxTaps: 4 },

  /* Taper entre les pulsations. Moins de frappes que le tempo et une fenêtre
     plus étroite : c'est plus court parce que c'est plus dur à tenir. */
  contretemps: { beats: 6, interval: 620, window: 170, maxTaps: 20 },

  /* Le motif se joue une fois, puis on le refait. `unite` est la plus petite
     durée du motif ; `window` la tolérance sur chaque frappe. */
  echo: { coups: 5, unite: 280, window: 190, maxTaps: 16 },

  /* Accélérer de `debut` à `fin` en `coups` frappes, régulièrement. */
  crescendo: { coups: 10, debut: 700, fin: 260, window: 165, maxTaps: 26 },

  /* Tenir au moins `tenirMin`, puis lâcher sur la pulsation de `attente`. */
  relance: { attente: 1900, tenirMin: 900, window: 230, maxTaps: 4 },

  /* Trois rafales de quatre, séparées par des silences de `silence`. */
  salves: { rafales: 3, parRafale: 4, silence: 700, tolerance: 260, maxTaps: 30 },

  /* Tenir sans dépasser `limite`. Au-delà, tout est perdu — c'est le seul
     geste du jeu où en faire trop coûte plus cher que d'en faire trop peu. */
  tenue: { limite: 4200, maxTaps: 4 },

  /* Exactement `exact` frappes en `ms`. Ni plus, ni moins. */
  retenue: { ms: 4000, exact: 12, maxTaps: 30 },
};

/** Les noms des gestes, dans l'ordre où on les fait découvrir.
 *
 * Les cinq dernières ne sont pas des gestes de rythme : ce sont les épreuves
 * de `epreuves.js` — dessiner, se souvenir, tourner. Elles vivent dans la même
 * liste parce que les moteurs n'ont pas à savoir laquelle est laquelle : ils
 * demandent une note, ils reçoivent une note. */
export const GESTES = ['tempo', 'mash', 'hold', 'contretemps', 'echo',
  'crescendo', 'relance', 'salves', 'tenue', 'retenue', ...EPREUVES];

/** Deux frappes humaines ne sont jamais séparées de moins de 40 ms. */
const MIN_GAP_MS = 40;
/** Un humain ne tape pas avec une régularité de métronome sur 15 frappes. */
const ROBOT_JITTER_MS = 6;

export class Cheat extends Error {
  constructor(reason) { super(reason); this.code = 'ferveur.error.' + reason; }
}

/**
 * Contrôles communs à tous les gestes. Ils ne cherchent pas à être malins :
 * ils écartent l'automatisation évidente, ce qui suffit tant qu'aucun gain
 * réel n'est en jeu. Le jour où il y en aura un, ce sera à durcir.
 */
function sanity(taps, cfg, spanMs) {
  if (!Array.isArray(taps)) throw new Cheat('bad_taps');
  if (taps.length > cfg.maxTaps) throw new Cheat('too_many_taps');

  let last = -Infinity;
  const gaps = [];
  for (const t of taps) {
    if (!Number.isFinite(t) || t < -200 || t > spanMs + 600) throw new Cheat('tap_out_of_window');
    if (t - last < MIN_GAP_MS) throw new Cheat('taps_too_fast');
    if (last > -Infinity) gaps.push(t - last);
    last = t;
  }

  // Régularité mécanique : un écart-type quasi nul sur assez de frappes.
  if (gaps.length >= 10) {
    const moy = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const ecart = Math.sqrt(gaps.reduce((a, g) => a + (g - moy) ** 2, 0) / gaps.length);
    if (ecart < ROBOT_JITTER_MS) throw new Cheat('inhuman_regularity');
  }
}

/**
 * Les instants attendus d'un motif d'écho, en millisecondes.
 *
 * Le motif donne les **intervalles** ; on en fait des instants cumulés, la
 * première frappe à zéro. Écrit ici et pas dans la page : le client dessine
 * ce que le serveur note, sans jamais le recalculer — c'est la règle depuis
 * qu'un joueur portant les Jumelles a tapé juste sur une pulsation fausse.
 */
export function instantsDuMotif(motif, unite = GESTURES.echo.unite) {
  const t = [0];
  for (const pas of motif) t.push(t[t.length - 1] + pas * unite);
  return t;
}

/** Les instants attendus d'un crescendo : des intervalles qui se resserrent. */
export function instantsDuCrescendo(cfg = GESTURES.crescendo) {
  const t = [0];
  for (let i = 0; i < cfg.coups - 1; i++) {
    const part = cfg.coups > 2 ? i / (cfg.coups - 2) : 1;
    t.push(t[t.length - 1] + (cfg.debut + (cfg.fin - cfg.debut) * part));
  }
  return t;
}

/**
 * Note une suite de frappes contre une suite d'instants attendus.
 *
 * Partagée par le tempo, le contretemps, l'écho et le crescendo : ces quatre
 * gestes ne diffèrent que par **les instants qu'ils attendent**. Écrire quatre
 * fois la même boucle, c'était se donner quatre occasions de la corriger à
 * moitié.
 */
function noterContre(taps, attendus, fenetre) {
  let total = 0;
  /* **Dans l'ordre**, et non au plus proche.
   *
   * La version d'avant accrochait chaque frappe à l'instant attendu le plus
   * proche, où qu'il soit dans la mesure. C'était bien trop indulgent : un
   * joueur qui refaisait un *autre* motif d'écho — le bon nombre de frappes,
   * le mauvais rythme — récoltait 0,8 sur 1, parce que trois de ses coups
   * tombaient par hasard sur des instants attendus. Le rythme, c'est l'ordre :
   * la troisième frappe se juge sur le troisième temps, pas sur celui qui
   * l'arrange. */
  for (let i = 0; i < attendus.length; i++) {
    const t = taps[i];
    if (t === undefined) continue;          // frappe manquante : zéro pour ce temps
    total += Math.max(0, 1 - Math.abs(attendus[i] - t) / fenetre);
  }
  return total / attendus.length;
}

/**
 * La configuration du geste, modificateurs déjà appliqués.
 *
 * Elle existe parce que le client en a besoin pour **afficher** le geste, et
 * qu'il ne doit surtout pas la recalculer. Il l'a fait pendant un temps, avec
 * les constantes recopiées en dur : la pulsation était dessinée à 560 ms alors
 * que le serveur notait à 560 + tempoInterval. Un joueur portant les Jumelles
 * tapait donc juste sur ce qu'il voyait et récoltait 0,36 au lieu de 0,99 —
 * l'équipement censé l'aider le pénalisait, et plus la carte était rare, pire
 * c'était. Une seule source, ici, et le décalage ne peut plus exister.
 *
 * @param motif  l'index du motif d'écho **que le serveur a décidé**. Le client
 *   le reçoit, le joue, et le serveur note contre celui-là : aucun des deux ne
 *   choisit après coup.
 */
export function resoudreGeste(mods = {}, { motif = 0 } = {}) {
  const t = GESTURES.tempo, m = GESTURES.mash, h = GESTURES.hold;
  const msMash = m.ms + (mods.mashTime ?? 0);
  const fen = (base) => base * (mods.tempoWindow ?? 1);
  const iMotif = ((Number(motif) || 0) % MOTIFS.length + MOTIFS.length) % MOTIFS.length;

  return {
    tempo: {
      beats: t.beats,
      interval: t.interval + (mods.tempoInterval ?? 0),
      window: fen(t.window),
    },
    mash: {
      ms: msMash,
      // Même cible relative que la notation : raccourcir la durée ne doit pas
      // rendre le geste plus facile, seulement plus court.
      target: Math.round(m.target * (msMash / m.ms)),
    },
    hold: { need: h.need, forgive: mods.holdForgive ?? 0 },

    /* Les sept autres partagent les mêmes modificateurs que leurs cousins :
       `tempoWindow` élargit toutes les fenêtres de rythme, `holdBonus` paie
       toutes les tenues. Un Fanzzy de la voix aide donc sur l'écho comme sur
       le tempo — sans quoi il faudrait dix familles de modificateurs pour dix
       gestes, et plus personne ne saurait ce que porte son personnage. */
    contretemps: {
      beats: GESTURES.contretemps.beats,
      interval: GESTURES.contretemps.interval + (mods.tempoInterval ?? 0),
      window: fen(GESTURES.contretemps.window),
    },
    echo: {
      motif: iMotif,
      instants: instantsDuMotif(MOTIFS[iMotif]),
      window: fen(GESTURES.echo.window),
    },
    crescendo: {
      instants: instantsDuCrescendo(),
      window: fen(GESTURES.crescendo.window),
    },
    relance: {
      attente: GESTURES.relance.attente,
      tenirMin: GESTURES.relance.tenirMin,
      window: fen(GESTURES.relance.window),
    },
    salves: {
      rafales: GESTURES.salves.rafales,
      parRafale: GESTURES.salves.parRafale,
      silence: GESTURES.salves.silence,
      tolerance: GESTURES.salves.tolerance,
    },
    tenue: { limite: GESTURES.tenue.limite },
    retenue: { ms: GESTURES.retenue.ms, exact: GESTURES.retenue.exact },

    /* Les cinq épreuves. Leur consigne est tirée de la **même graine** que le
       motif de l'écho, et ce n'est pas une économie : c'est ce qui fait que la
       page dessine exactement la forme que le serveur notera. Le jour où les
       deux divergeront, le joueur tracera un cœur et sera noté sur un fanion. */
    ...Object.fromEntries(EPREUVES.map((e) => [e, consigneDe(e, motif)])),
  };
}

/**
 * Renvoie la qualité du geste, de 0 à ~1,2.
 * `mods` vient du Fanzzy équipé : il élargit une fenêtre ou raccourcit une
 * durée, mais ne fabrique jamais de qualité à partir de rien.
 *
 * @param motif  pour l'écho seulement : le motif que le serveur avait donné.
 */
export function grade(kind, taps, mods = {}, { motif = 0 } = {}) {
  /* Les épreuves partent ailleurs : elles ne reçoivent pas une liste
     d'instants mais un tracé, une grille ou une suite, et `taps` porte alors
     cet objet-là. Le nom du paramètre ment un peu ; le renommer partout
     mentirait davantage, puisque dix gestes sur quinze reçoivent bien des
     frappes.

     `Triche` redevient `Cheat` en sortant : les deux moteurs attrapent cette
     classe-ci, et une erreur d'un autre type traverserait la partie. */
  if (EPREUVES.includes(kind)) {
    try {
      return noter(kind, consigneDe(kind, motif), taps, mods);
    } catch (e) {
      if (e instanceof Triche) throw new Cheat(e.code);
      throw e;
    }
  }

  if (kind === 'tempo') {
    const cfg = GESTURES.tempo;
    const interval = cfg.interval + (mods.tempoInterval ?? 0);
    const fenetre = cfg.window * (mods.tempoWindow ?? 1);
    const span = cfg.beats * interval;
    sanity(taps, cfg, span);
    const attendus = Array.from({ length: cfg.beats }, (_, i) => i * interval);
    return Math.min(1.2, noterContre(taps, attendus, fenetre));
  }

  if (kind === 'mash') {
    const cfg = GESTURES.mash;
    const ms = cfg.ms + (mods.mashTime ?? 0);
    sanity(taps, cfg, ms);
    const dans = taps.filter((t) => t >= 0 && t <= ms).length;
    const cible = Math.round(cfg.target * (ms / cfg.ms));
    return Math.min(1.2, (dans / cible) * (mods.mashBonus ?? 1));
  }

  if (kind === 'hold') {
    const cfg = GESTURES.hold;
    // Ici `taps` est une suite d'appuis/relâchements : [début, fin, début, fin…]
    sanity(taps, cfg, cfg.need + 1500);
    let tenu = 0;
    for (let i = 0; i + 1 < taps.length; i += 2) tenu += Math.max(0, taps[i + 1] - taps[i]);
    const laches = Math.max(0, Math.floor(taps.length / 2) - 1);
    if (laches > (mods.holdForgive ?? 0)) return 0;
    return Math.min(1.2, (tenu / cfg.need) * (mods.holdBonus ?? 1));
  }

  /* ------------------------------------------------- les sept nouveaux */

  if (kind === 'contretemps') {
    const cfg = GESTURES.contretemps;
    const interval = cfg.interval + (mods.tempoInterval ?? 0);
    const fenetre = cfg.window * (mods.tempoWindow ?? 1);
    sanity(taps, cfg, (cfg.beats + 1) * interval);
    /* Les pulsations tombent à 0, interval, 2×interval… et on attend les
       frappes **entre** elles. C'est tout ce qui sépare ce geste du tempo, et
       c'est ce qui le rend difficile : le corps veut taper sur le temps. */
    const attendus = Array.from({ length: cfg.beats }, (_, i) => (i + 0.5) * interval);
    return Math.min(1.2, noterContre(taps, attendus, fenetre));
  }

  if (kind === 'echo') {
    const cfg = GESTURES.echo;
    const m = MOTIFS[((Number(motif) || 0) % MOTIFS.length + MOTIFS.length) % MOTIFS.length];
    const attendus = instantsDuMotif(m, cfg.unite);
    const fenetre = cfg.window * (mods.tempoWindow ?? 1);
    sanity(taps, cfg, attendus[attendus.length - 1] + 800);
    return Math.min(1.2, noterContre(taps, attendus, fenetre));
  }

  if (kind === 'crescendo') {
    const cfg = GESTURES.crescendo;
    const attendus = instantsDuCrescendo(cfg);
    const fenetre = cfg.window * (mods.tempoWindow ?? 1);
    sanity(taps, cfg, attendus[attendus.length - 1] + 800);
    return Math.min(1.2, noterContre(taps, attendus, fenetre));
  }

  if (kind === 'relance') {
    const cfg = GESTURES.relance;
    // [appui, relâchement] : un seul, et c'est tout l'exercice.
    sanity(taps, cfg, cfg.attente + 1200);
    if (taps.length < 2) return 0;
    const debut = taps[0];
    const fin = taps[1];
    const tenu = fin - debut;
    // Lâcher sans avoir tenu, c'est taper : le geste ne compte pas.
    if (tenu < cfg.tenirMin) return 0;
    const fenetre = cfg.window * (mods.tempoWindow ?? 1);
    const ecart = Math.abs(fin - cfg.attente);
    return Math.min(1.2, Math.max(0, 1 - ecart / fenetre) * (mods.holdBonus ?? 1));
  }

  if (kind === 'salves') {
    const cfg = GESTURES.salves;
    const span = cfg.rafales * cfg.parRafale * 120 + cfg.rafales * cfg.silence;
    sanity(taps, cfg, span + 1500);
    if (!taps.length) return 0;

    /* On regroupe par les silences : un écart au-delà de la moitié du silence
       attendu ferme une rafale. Le seuil est relatif et non absolu, pour que
       le geste reste jugeable si l'on change `silence` un jour. */
    const coupure = cfg.silence * 0.5;
    const groupes = [[taps[0]]];
    for (let i = 1; i < taps.length; i++) {
      if (taps[i] - taps[i - 1] > coupure) groupes.push([]);
      groupes[groupes.length - 1].push(taps[i]);
    }
    // Le nombre de rafales compte autant que leur contenu.
    const justes = groupes.filter((g) => Math.abs(g.length - cfg.parRafale) <= 1).length;
    const partRafales = Math.max(0, 1 - Math.abs(groupes.length - cfg.rafales) / cfg.rafales);
    const partContenu = justes / cfg.rafales;

    // Et les silences entre les rafales, qui font le geste.
    let partSilences = 1;
    if (groupes.length > 1) {
      let total = 0;
      for (let i = 1; i < groupes.length; i++) {
        const vide = groupes[i][0] - groupes[i - 1][groupes[i - 1].length - 1];
        total += Math.max(0, 1 - Math.abs(vide - cfg.silence) / cfg.tolerance);
      }
      partSilences = total / (groupes.length - 1);
    }
    return Math.min(1.2, partRafales * 0.3 + partContenu * 0.4 + partSilences * 0.3);
  }

  if (kind === 'tenue') {
    const cfg = GESTURES.tenue;
    sanity(taps, cfg, cfg.limite + 2000);
    if (taps.length < 2) return 0;
    const tenu = Math.max(0, taps[1] - taps[0]);
    /* Dépasser, c'est tout perdre. C'est ce qui fait le geste : la récompense
       monte jusqu'à la limite, et il n'y a rien au-delà. Un geste où l'on
       gagne toujours à en faire plus n'est pas un choix, c'est une consigne. */
    if (tenu > cfg.limite) return 0;
    return Math.min(1.2, (tenu / cfg.limite) * (mods.holdBonus ?? 1));
  }

  if (kind === 'retenue') {
    const cfg = GESTURES.retenue;
    sanity(taps, cfg, cfg.ms);
    const dans = taps.filter((t) => t >= 0 && t <= cfg.ms).length;
    /* L'écart compte dans les deux sens : c'est l'exact contraire du
       martelage, et c'est pour ça qu'il est intéressant juste après lui. */
    const ecart = Math.abs(dans - cfg.exact);
    return Math.min(1.2, Math.max(0, 1 - ecart / cfg.exact));
  }

  throw new Cheat('unknown_gesture');
}

/**
 * Applique les particularités du Fanzzy qui ne portent pas sur le geste
 * lui-même mais sur son résultat.
 */
export function applyHeroMods(quality, mods = {}) {
  let q = quality;
  if (mods.perfectBonus && q > 0.9) q *= mods.perfectBonus;
  const backfire = Boolean(mods.backfire) && q < 0.4;
  return { quality: q, backfire };
}
