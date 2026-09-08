/**
 * Dessin des Fanzzy — source unique.
 *
 * Ce fichier existait en double avant : le classeur savait dessiner un Fanzzy,
 * et l'accueil en avait besoin à son tour. Recopier cent lignes de SVG aurait
 * refait exactement la faute du catalogue, qui a divergé jusqu'à ce qu'une
 * carte tirée d'un booster casse la page. Une seule définition, donc.
 *
 * Script classique, pas module : tout ce qui vit dans `public/` est chargé par
 * une balise `<script src>` ordinaire, et `verif-pages.mjs` compile ces
 * fichiers comme tels. On expose donc un global, comme `fx.js` et `nav.js`.
 *
 * Le catalogue, lui, n'est pas ici : il vient de `/api/fanzzy/dex`. Ce module
 * ne connaît que la manière de dessiner, jamais la liste de ce qu'il dessine.
 * La table des types est fournie par la page via `setTypes()`.
 */
(() => {
  /**
   * Meilleur format d'image que le navigateur sait lire. L'écart n'est pas
   * anecdotique : le paquet rouge pèse 7,2 Mo en PNG d'origine, 58 Ko en AVIF.
   */
  const IMG_EXT = (() => {
    // `toDataURL` lève dans un environnement sans canvas — un test hors
    // navigateur, un mode de confidentialité strict. Ce module dessine tout le
    // reste sans canvas : il serait absurde qu'un simple test de format le
    // fasse tomber en entier. On retombe sur le format le plus universel.
    try {
      const c = document.createElement('canvas');
      if (c.toDataURL('image/avif').startsWith('data:image/avif')) return '.avif';
      if (c.toDataURL('image/webp').startsWith('data:image/webp')) return '.webp';
    } catch { /* pas de canvas : tant pis pour la détection */ }
    return '.jpg';
  })();

  /** Table des types, renseignée par la page une fois le catalogue reçu. */
  let TYPES = {};
  const setTypes = (t) => { TYPES = t ?? {}; };

  /**
   * Un type inconnu ne doit pas casser un dessin : une page peut demander un
   * Fanzzy avant que le catalogue soit arrivé, ou après l'ajout d'un type que
   * sa version ne connaît pas. On retombe sur la craie plutôt que sur une
   * exception qui viderait toute la grille.
   */
  const couleur = (f) => TYPES[f.type]?.c ?? '#C2CAD6';

  let uid = 0;

  /** Générateur pseudo-aléatoire stable : un Fanzzy se dessine toujours pareil. */
  function seeded(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19);
    }
    return () => {
      h = Math.imul(h ^ h >>> 16, 2246822507); h = Math.imul(h ^ h >>> 13, 3266489909);
      return ((h ^= h >>> 16) >>> 0) / 4294967296;
    };
  }

  /**
   * Fanzzy disposant d'une illustration dessinée.
   *
   * Le reste du catalogue garde le rendu procédural : mieux vaut un dessin
   * géométrique cohérent qu'un trou en attendant l'illustration. On ajoute
   * simplement les identifiants ici au fur et à mesure — `verif-pages.mjs`
   * vérifie que les six fichiers existent avant de laisser livrer.
   */
  const ILLUSTRES = new Set([
    'V1', 'P1', 'F1', 'T1', 'Y1', 'D1', 'X1', 'X2',
    'X3', 'X4', 'X5', 'G1', 'X6', 'X7', 'X8', 'X9',
    'X10', 'X11', 'X12', 'X13', 'X14', 'X15', 'X17', 'X20',
    'X26', 'X27', 'X34', 'X35', 'X39', 'X41', 'X42', 'X47',
    'X48', 'X49', 'X22', 'X31', 'X36', 'X37', 'X40', 'X43',
    'X46', 'X16', 'X18', 'X19', 'X21', 'X23', 'X24', 'X25',
    'X28', 'X29', 'X30', 'X32', 'X33', 'X38', 'X44', 'X45',
    'X50', 'X51', 'TR1', 'TR2', 'TR3', 'TR4', 'TR5', 'TR6',
    'TR7', 'TR8', 'TR9', 'TR10', 'TR11', 'TR12', 'TR13', 'TR14',
    'TR15', 'TR16', 'TR17', 'TR18', 'TR19', 'TR20', 'TR21', 'TR22',
    'TR23', 'TR24', 'TR25', 'TR26', 'TR27', 'MS1', 'MS2', 'MS3',
    'MS4', 'MS5', 'MS6', 'MS7', 'MS8', 'MS9', 'MS10', 'MS11',
    'MS12', 'MS13', 'MS14', 'MS15', 'MS16', 'MS17', 'MS18', 'MS19',
    'MS20', 'MS21', 'MS22', 'MS23', 'MS24', 'MS25', 'MS26', 'BG1',
    'BG2', 'BG3', 'BG4', 'BG5', 'BG6', 'BG7', 'BG8', 'BG9',
    'BG10', 'BG11', 'BG12', 'BG13', 'BG14', 'BG15', 'BG16', 'BG17',
    'BG18', 'BG19', 'BG20', 'BG21', 'BG22', 'BG23', 'RV1', 'RV2',
    'RV3', 'RV4', 'RV5', 'RV6', 'RV7', 'RV8', 'RV9', 'RV10',
    'RV11', 'RV12', 'RV13', 'RV14', 'RV15', 'RV16', 'RV17', 'RV18',
    'RV19', 'RV20', 'RV21', 'OB1', 'OB2', 'OB3', 'OB4', 'OB5',
    'OB6', 'OB7', 'OB8', 'OB9', 'OB10', 'OB11', 'OB12', 'EP1',
    'EP2', 'EP3', 'EP4', 'EP5', 'EP6', 'EP7', 'EP8', 'EP9',
    'EP10', 'EP11', 'EP12', 'EP13', 'EP14', 'EP15', 'EP16', 'EP17',
  ]);

  /**
   * `variante` vaut 'buste' (320×320, pour une carte) ou 'plein' (520×945,
   * pour un affichage en pied). Le repli en PNG couvre les navigateurs qui
   * annoncent l'AVIF sans savoir le décoder — ça existe.
   */
  const illustration = (f, variante = 'buste') => {
    if (!ILLUSTRES.has(f.id)) return null;
    const base = `/img/fanzzy/${f.id}${variante === 'buste' ? '-buste' : ''}`;
    return `<img class="illu" alt="" loading="lazy" decoding="async" src="${base}${IMG_EXT}"
      onerror="this.onerror=null;this.src='${base}.png'">`;
  };

  /** Fond seul, sans silhouette : sert de décor aux illustrations. */
  function artFond(f) {
    const tc = couleur(f);
    return `<svg viewBox="0 0 128 100" preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg">
      <defs><radialGradient id="hf${f.id}"><stop offset="0" stop-color="${tc}" stop-opacity=".5"/>
        <stop offset="1" stop-color="${tc}" stop-opacity="0"/></radialGradient></defs>
      <rect width="128" height="100" fill="#101821"/>
      <polygon points="16,-4 30,-4 58,64 4,64" fill="#F5C33B" opacity=".1"/>
      <polygon points="98,-4 112,-4 124,64 70,64" fill="#F5C33B" opacity=".1"/>
      <circle cx="64" cy="78" r="52" fill="url(#hf${f.id})"/>
    </svg>`;
  }

  const artCache = new Map();

  function artProcedural(f) {
    if (artCache.has(f.id)) return artCache.get(f.id);
    const r = seeded(f.id), tc = couleur(f), u = 'g' + uid++;
    let s = `<svg viewBox="0 0 128 100" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
     <defs><linearGradient id="s${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#16202C"/>
       <stop offset="1" stop-color="#05080C"/></linearGradient>
     <radialGradient id="h${u}"><stop offset="0" stop-color="${tc}" stop-opacity=".55"/>
       <stop offset="1" stop-color="${tc}" stop-opacity="0"/></radialGradient>
     <filter id="b${u}"><feGaussianBlur stdDeviation="3"/></filter></defs>
     <rect width="128" height="100" fill="url(#s${u})"/>
     <polygon points="16,-4 30,-4 58,64 4,64" fill="#F5C33B" opacity=".09"/>
     <polygon points="98,-4 112,-4 124,64 70,64" fill="#F5C33B" opacity=".09"/>
     <circle cx="64" cy="84" r="50" fill="url(#h${u})" opacity=".65"/>`;

    // Silhouette du supporter, plus imposante selon l'étage d'évolution.
    // `stage` absent donnerait une échelle NaN et un dessin vide : toutes les
    // sources ne le transmettent pas, on retombe sur le premier étage.
    const scale = 0.85 + (Number(f.stage) || 1) * 0.12;
    s += `<g transform="translate(64,60) scale(${scale.toFixed(2)}) translate(-64,-60)">
      <circle cx="64" cy="34" r="11" fill="#0A0E13" stroke="${tc}" stroke-width="1.6"/>
      <path d="M52 78 v-20 a12 12 0 0 1 24 0 v20z" fill="#0A0E13" stroke="${tc}" stroke-width="1.4"/>`;
    if (f.type === 'voix') s += `<path d="M74 40 l16-11 4 7 -16 9z" fill="${tc}"/>`;
    if (f.type === 'perc') s += `<ellipse cx="64" cy="66" rx="15" ry="11" fill="#E9E3D4" stroke="${tc}" stroke-width="2"/>`;
    if (f.type === 'fide') s += `<path d="M44 56 q20 -12 40 0" stroke="${tc}" stroke-width="4" fill="none" stroke-linecap="round"/>`;
    if (f.type === 'tifo') s += `<rect x="40" y="44" width="48" height="20" fill="#E9E3D4" stroke="${tc}" stroke-width="1.6"/>`;
    if (f.type === 'pyro') s += `<circle cx="86" cy="48" r="4" fill="#FFF3D0"/><circle cx="86" cy="48" r="11" fill="${tc}" opacity=".5" filter="url(#b${u})"/>`;
    if (f.type === 'depl') s += `<rect x="34" y="52" width="60" height="18" rx="3" fill="#12202F" stroke="${tc}" stroke-width="1.4"/>`;
    s += `</g>`;

    let steps = 'M0 100';
    for (let i = 0; i < 9; i++) steps += `L${i * 14.5} ${100 - i * 4.2}L${(i + 1) * 14.5} ${100 - i * 4.2}`;
    s += `<path d="${steps}L128 100Z" fill="#080B10" opacity=".9"/>`;
    for (let row = 0; row < 3; row++) {
      const y = 93 - row * 8;
      for (let i = 0; i < 15; i++) {
        const x = (4 + i * 8.6 + r() * 3).toFixed(1);
        s += `<circle cx="${x}" cy="${y}" r="2" fill="${r() > .88 ? tc : '#1C2530'}"/>`;
      }
    }
    s += `<rect width="128" height="100" fill="#000" opacity=".07"/></svg>`;
    artCache.set(f.id, s);
    return s;
  }

  function art(f) {
    const dessin = illustration(f);
    if (dessin) {
      // Le fond de tribune reste procédural : c'est lui qui porte la couleur du
      // type. Le personnage se pose dessus.
      return `<div class="illuwrap">${artFond(f)}${dessin}</div>`;
    }
    return artProcedural(f);
  }

  window.FZART = {
    IMG_EXT,
    src: (base) => base + IMG_EXT,
    setTypes,
    seeded,
    ILLUSTRES,
    illustration,
    art,
    artFond,
    artProcedural,
  };
})();
