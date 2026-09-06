/**
 * Évaluation des gestes.
 *
 * Le client n'annonce jamais sa réussite — il n'enverrait que des « parfait ».
 * Il envoie les instants de ses frappes, en millisecondes depuis l'ouverture de
 * la fenêtre, et c'est ici qu'on calcule ce que ça vaut. Une dizaine de nombres
 * par chant, rien de lourd, et la porte est fermée.
 */

export const GESTURES = {
  tempo: { beats: 8, interval: 560, window: 200, maxTaps: 24 },
  mash:  { ms: 3000, target: 21, maxTaps: 60 },
  hold:  { need: 3200, maxTaps: 4 },
};

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
 * La configuration du geste, modificateurs déjà appliqués.
 *
 * Elle existe parce que le client en a besoin pour **afficher** le geste, et
 * qu'il ne doit surtout pas la recalculer. Il l'a fait pendant un temps, avec
 * les constantes recopiées en dur : la pulsation était dessinée à 560 ms alors
 * que le serveur notait à 560 + tempoInterval. Un joueur portant les Jumelles
 * tapait donc juste sur ce qu'il voyait et récoltait 0,36 au lieu de 0,99 —
 * l'équipement censé l'aider le pénalisait, et plus la carte était rare, pire
 * c'était. Une seule source, ici, et le décalage ne peut plus exister.
 */
export function resoudreGeste(mods = {}) {
  const t = GESTURES.tempo, m = GESTURES.mash, h = GESTURES.hold;
  const msMash = m.ms + (mods.mashTime ?? 0);
  return {
    tempo: {
      beats: t.beats,
      interval: t.interval + (mods.tempoInterval ?? 0),
      window: t.window * (mods.tempoWindow ?? 1),
    },
    mash: {
      ms: msMash,
      // Même cible relative que la notation : raccourcir la durée ne doit pas
      // rendre le geste plus facile, seulement plus court.
      target: Math.round(m.target * (msMash / m.ms)),
    },
    hold: { need: h.need, forgive: mods.holdForgive ?? 0 },
  };
}

/**
 * Renvoie la qualité du geste, de 0 à ~1,2.
 * `mods` vient du Fanzzy équipé : il élargit une fenêtre ou raccourcit une
 * durée, mais ne fabrique jamais de qualité à partir de rien.
 */
export function grade(kind, taps, mods = {}) {
  if (kind === 'tempo') {
    const cfg = GESTURES.tempo;
    const interval = cfg.interval + (mods.tempoInterval ?? 0);
    const fenetre = cfg.window * (mods.tempoWindow ?? 1);
    const span = cfg.beats * interval;
    sanity(taps, cfg, span);

    const attendus = Array.from({ length: cfg.beats }, (_, i) => i * interval);
    let total = 0;
    for (const t of taps.slice(0, cfg.beats)) {
      const proche = attendus.reduce((b, x) => (Math.abs(x - t) < Math.abs(b - t) ? x : b), attendus[0]);
      total += Math.max(0, 1 - Math.abs(proche - t) / fenetre);
    }
    return Math.min(1.2, total / cfg.beats);
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
