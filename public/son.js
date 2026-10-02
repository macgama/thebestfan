/**
 * Le son de tribune : un seul moteur pour tout le jeu.
 *
 * ## Pourquoi un moteur
 *
 * Il y avait deux banques de sons synthétisés qui s'ignoraient : celle de
 * `fx.js` (« FX.son ») et l'objet « audio » de `cartes.js`, chacune avec son
 * propre contexte audio, chaque son branché droit sur la sortie, et des
 * volumes réglés à l'oreille un par un. Trois sons superposés — un but
 * pendant un geste parfait pendant une carte — s'additionnaient sans
 * garde-fou ; et deux contextes, c'est deux fils de rendu audio sur un
 * téléphone.
 *
 * Ici : **un seul contexte**, créé au premier geste ; **trois bus** (effets,
 * interface, ambiance) ; **un limiteur** sur le maître ; et des volumes qui
 * sont des **constantes nommées** (`MIX`), chacune avec sa mesure en
 * commentaire — mesurée hors ligne par `scripts/son-banc.mjs`, jamais réglée
 * à l'oreille.
 *
 * ## Ce que les pages en voient
 *
 *   TBF_SON.jouer(nom, options)   un son de la banque ; FX.son(nom) y passe
 *   TBF_SON.ambiance(niveau, o)   la rumeur de tribune : 0 tribune vide,
 *                                 1 rumeur, 2 la tribune pousse, 3 but
 *                                 (avec l'ovation)
 *   TBF_SON.chant(type, o)        des frappes de tambour et des claps de
 *                                 foule calés sur la pulsation d'un geste
 *   TBF_SON.volume(v)             le volume du joueur, de 0 à 1, retenu
 *   TBF_SON.audio                 la façade de l'objet « audio » de
 *                                 cartes.js (ready, rip, flip, chime,
 *                                 roar), mêmes signatures : cartes.js lui
 *                                 confie chaque son, au moment du son
 *
 * Il est chargé par `fx.js`, qui ajoute sa balise au chargement : les pages
 * n'ont rien à poser. Script classique, pas module, comme tout `public/`.
 *
 * ## Les règles
 *
 *   — **aucun fichier audio** : tout est synthétisé. Un son téléchargé se
 *     joue en retard la première fois, exactement quand il compte ;
 *   — **aucune mélodie connue**, aucun chant de club, aucun hymne : les
 *     chants de supporters reprennent souvent des airs protégés. On joue du
 *     rythme, des accords tenus, des bruits ; jamais un air ;
 *   — **le son ne porte jamais seul une information** : ce qu'il dit, l'écran
 *     le dit aussi. Le joueur a pu couper le son, ou jouer dans un stade ;
 *   — **le mode calme coupe tout** (la facette « sons », lue à chaque appel
 *     sur l'attribut `data-calme` que posent `fx.js` et `menu.js`), ambiance
 *     comprise, et le contexte n'est même pas créé tant qu'il dure.
 */
(() => {
  if (window.TBF_SON) return;

  /* ------------------------------------------------------------ le calme

     Lu sur la racine du document, où fx.js et menu.js recopient la clé
     « tbf-calme » : jamais retenu ici, un interrupteur basculé dans le tiroir
     vaut pour le son suivant. */
  const calme = () =>
    (document.documentElement.dataset.calme ?? '').split(' ').includes('sons');

  /* ----------------------------------------------------------- le volume

     Le réglage du joueur, de 0 à 1, sous « tbf-volume » dans le stockage
     local : un nombre écrit en texte (« 0.6 »). Le tiroir le règle par
     TBF_SON.volume(v) ; une page sans ce moteur peut écrire la clé elle-même,
     sous la même forme : l'événement « storage » la fait valoir dans les
     autres onglets, et ce fichier la relit à son chargement.

     Il s'applique **après** le limiteur : baisser le volume ne change pas le
     mixage, seulement ce qui sort. Et il passe au carré : l'oreille entend en
     décibels, et un curseur à mi-course doit sonner à mi-course (−12 dB),
     pas presque aussi fort qu'au bout (−6 dB). */
  const CLE_VOLUME = 'tbf-volume';
  const VOLUME_DEFAUT = 1;
  const borner = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  function lireVolume() {
    try {
      const brut = localStorage.getItem(CLE_VOLUME);
      if (brut === null || brut.trim() === '') return VOLUME_DEFAUT;
      const v = Number(brut);
      return Number.isFinite(v) ? borner(v) : VOLUME_DEFAUT;
    } catch { return VOLUME_DEFAUT; }
  }
  let volumeJoueur = lireVolume();
  const gainDuVolume = (v) => v * v;

  /* ----------------------------------------------------------- le hasard

     Les bruits, les éclats de voix de la tribune et les claps tirent leur
     hasard d'ici. Il est reproductible (mulberry32) parce que le banc rend
     chaque son hors ligne et doit mesurer la même chose d'une fois à
     l'autre : « rendre » repart d'une graine connue. Le jeu, lui, part d'une
     graine tirée au chargement — sinon chaque visite entendrait les mêmes
     éclats aux mêmes secondes. */
  let graine = (Math.random() * 2 ** 32) >>> 0;
  function alea() {
    graine = (graine + 0x6D2B79F5) | 0;
    let t = graine;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /* =========================================================== le mixage

     **Mesuré, pas réglé à l'oreille.** Chaque son de la banque est rendu
     hors ligne (OfflineAudioContext) à travers la chaîne complète, puis
     mesuré par scripts/son-banc.mjs :

       crête   l'échantillon le plus fort, en dB sous la pleine échelle ;
       sonie   la sonie de ses cent millisecondes les plus fortes, pondérée
               K comme la norme de radiodiffusion (BS.1770), en LUFS. C'est
               elle qui dit « fort » : un tic carré à 1 200 Hz et une gorge à
               96 Hz de même crête ne sonnent pas pareil, et la pondération
               le sait. Les cent millisecondes plutôt que la durée entière :
               la queue d'un carillon ne le rend pas plus faible à l'oreille ;
       durée   jusqu'à ce qu'il retombe sous −60 dB pour de bon.

     Trois familles, trois fenêtres de sonie qui ne se chevauchent pas :
     l'interface (tic, carte, bâche, sourd) se tient bas et serré — on
     l'entend cent fois par partie, quatre décibels de large ; le jeu
     (pousse, chant, parfait) au-dessus ; les moments (but, évolution,
     légendaire) en haut. Dans sa fenêtre, chaque son a sa place : la poussée
     d'en face (« contre ») sous la sienne, le but encaissé et la charge de
     l'évolution sous le but et l'arrivée — on ne fête pas ce qu'on subit, et
     la charge prépare ce qui vient.

     Et une crête plafond pour chaque son seul, sous le seuil du limiteur :
     un son seul ne doit jamais le faire travailler, sans quoi le limiteur
     écraserait le mixage qu'on vient de mesurer. Il ne sert qu'aux
     superpositions.

     Avant ce moteur, le mixage « à l'oreille » mesurait ceci : dix-sept
     décibels d'écart à l'intérieur même de l'interface (le tic à −44 LUFS,
     la bâche à −33), la corne de but (−27) plus faible que l'accord d'une
     carte épique (−17), l'évolution (−21) plus forte que le but. Les gains
     ci-dessous en viennent : 10 ^ ((cible − mesure) / 20).

     `scripts/son-smoke.mjs` rougit dès qu'un son sort de sa fenêtre ou
     dépasse la crête : qui change un son ou un gain relance le banc
     (`node scripts/son-banc.mjs`) et recopie la mesure en commentaire. */
  const FAMILLES = {
    interface: { bus: 'interface', fenetre: [-31, -27] },
    jeu: { bus: 'effets', fenetre: [-25, -20] },
    moment: { bus: 'effets', fenetre: [-19, -14] },
  };
  /** La crête d'un son seul, en dBFS : sous le seuil du limiteur (−6). */
  const CRETE_SEULE = -6.5;
  /** La crête de tout ce qui sort, superpositions comprises : rien ne sature. */
  const CRETE_MAX = -0.5;

  /* Le gain de mixage de chaque son, appliqué à sa sortie. En commentaire,
     la mesure du banc à volume plein, le 2 octobre 2026 :
     crête (dBFS) · sonie (LUFS, 100 ms) · durée. */
  const MIX = {
    tic: 5.54,                    // −19,5 · −29,5 · 0,03 s
    carte: 3.67,                  // −21,2 · −29,0 · 0,07 s
    bache: 1.7,                   // −21,3 · −28,0 · 0,16 s
    sourd: 3.66,                  // −15,3 · −28,5 · 0,06 s
    ok: 0.966,                    // −20,1 · −28,0 · 0,17 s
    retournement: 2.45,           // −17,3 · −28,5 · 0,09 s
    pousse: 4.6,                  // −12,0 · −22,1 · 0,13 s
    contre: 5,                    // −14,3 · −23,5 · 0,15 s
    chant: 4.47,                  // −14,5 · −22,0 · 0,18 s
    parfait: 1.77,                // −15,1 · −20,5 · 0,32 s
    dechirure: 1.88,              // −17,5 · −22,0 · 0,27 s (à 1,4 : −13,2 · −17,9)
    carillon: 1.17,               // −17,4 · −21,0 · 0,67 s
    'accord-epique': 0.623,       // −16,6 · −21,0 · 1,06 s
    gong: 0.776,                  // −14,3 · −21,0 · 1,62 s
    but: 3.93,                    //  −8,7 · −15,5 · 0,67 s
    butReel: 4.13,                //  −8,0 · −15,0 · 0,76 s
    encaisse: 4.75,               // −13,8 · −18,0 · 0,56 s
    charge: 5.15,                 // −12,3 · −18,0 · 0,80 s
    evolue: 1.95,                 //  −9,7 · −15,5 · 0,82 s
    rugissement: 4.15,            //  −9,7 · −15,5 · 0,94 s
    'accord-legendaire': 0.841,   //  −9,6 · −15,4 · 1,35 s
    grondement: 3.02,             //  −8,1 · −16,5 · 1,80 s
    niveau: 1.65,                 //  −8,4 · −16,0 · 1,14 s
    ovation: 1.19,                //  −8,4 · −16,5 · 3,20 s
  };

  /* Les gains des trois bus. À l'unité : le mixage est dans MIX. Ils
     existent pour qu'un réglage futur — baisser l'interface pendant un but,
     par exemple — se fasse en un seul endroit. */
  const BUS = { effets: 1, interface: 1, ambiance: 1 };

  /* Le limiteur. Un compresseur réglé en limiteur (seuil −6 dB, ratio 20,
     attaque de 2 ms) : sous le seuil il ne touche à rien, au-dessus il
     ramène tout vers le seuil. Chrome et Firefox (le même code) ajoutent au
     compresseur un gain de rattrapage — (1 / gain à pleine échelle) ^ 0,6,
     soit 0,6 × 6 × (1 − 1/20) = 3,42 dB ici, mesuré tel quel dans Chrome —
     qui remonterait tout ce qui passe dessous. On le retire juste après : la
     chaîne est transparente sous le seuil (un sinus à −20 dB ressort à
     −20,0), et un sinus à pleine échelle ressort à −5,5. Les dix moments
     joués ensemble ressortent à −4,5 dBFS. */
  const LIMITEUR = { seuil: -6, ratio: 20, attaque: 0.002, relache: 0.2 };
  const RATTRAPAGE_DB = 0.6 * -LIMITEUR.seuil * (1 - 1 / LIMITEUR.ratio);

  /* Le plafond, en dernier : une courbe qui laisse passer tel quel tout ce
     qui reste sous 0,7 (−3 dB) et arrondit le reste sans jamais dépasser
     0,93 (−0,6 dB). Le limiteur a une attaque : un front plus raide que deux
     millisecondes passe un instant au-dessus de son seuil, et le plafond le
     rattrape sans claquer. */
  const PLAFOND = { genou: 0.7, max: 0.93 };
  let courbePlafond = null;
  function plafond() {
    if (courbePlafond) return courbePlafond;
    const n = 2049;
    const { genou: a, max: b } = PLAFOND;
    courbePlafond = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      const m = Math.abs(x);
      const y = m <= a ? m : a + (b - a) * Math.tanh((m - a) / (b - a));
      courbePlafond[i] = Math.sign(x) * Math.min(b, y);
    }
    return courbePlafond;
  }

  /**
   * La chaîne commune : trois bus → maître → limiteur → retrait du
   * rattrapage → plafond → volume du joueur → sortie. Construite une fois
   * par contexte, le vivant comme ceux du banc : ce que le banc mesure est
   * exactement ce que le joueur entend.
   */
  function construireChaine(c, volume) {
    const maitre = c.createGain();
    const bus = {};
    for (const [nom, gain] of Object.entries(BUS)) {
      bus[nom] = c.createGain();
      bus[nom].gain.value = gain;
      bus[nom].connect(maitre);
    }
    const lim = c.createDynamicsCompressor();
    lim.threshold.value = LIMITEUR.seuil;
    lim.knee.value = 0;
    lim.ratio.value = LIMITEUR.ratio;
    lim.attack.value = LIMITEUR.attaque;
    lim.release.value = LIMITEUR.relache;
    const retrait = c.createGain();
    retrait.gain.value = 10 ** (-RATTRAPAGE_DB / 20);
    const plaf = c.createWaveShaper();
    plaf.curve = plafond();
    plaf.oversample = 'none';
    const sortie = c.createGain();
    sortie.gain.value = volume;
    maitre.connect(lim).connect(retrait).connect(plaf).connect(sortie).connect(c.destination);
    return { bus, maitre, sortie };
  }

  /* ========================================================= les matières

     Les bruits sont des tampons partagés, tirés une fois par contexte : un
     bruit blanc de trois secondes pour tout ce qui est bref (on en lit un
     morceau pris au hasard), et deux bruits roses de longueurs différentes
     pour la rumeur de la tribune, tirés seulement quand elle joue. */
  const blancs = new WeakMap();
  const roses = new WeakMap();
  function blanc(c) {
    let b = blancs.get(c);
    if (!b) {
      b = c.createBuffer(1, Math.round(c.sampleRate * 3), c.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = alea() * 2 - 1;
      blancs.set(c, b);
    }
    return b;
  }
  /* Un bruit rose : la rumeur d'une foule est plus sourde qu'un souffle
     blanc, son énergie baisse avec la hauteur. Le filtre de Paul Kellet,
     et une boucle fondue sur cinquante millisecondes : la fin rejoint le
     début sans le petit claquement qu'une boucle de bruit fait à chaque
     tour, et qu'on entendrait toutes les cinq secondes. Deux longueurs qui
     ne se divisent pas, pour que les deux couches ne retombent jamais
     ensemble au même endroit. */
  function rose(c, secondes) {
    const sr = c.sampleRate;
    const n = Math.round(sr * secondes);
    const f = Math.round(sr * 0.05);
    const x = new Float32Array(n + f);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < n + f; i++) {
      const w = alea() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      x[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
    const tampon = c.createBuffer(1, n, sr);
    const d = tampon.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = x[i];
    for (let i = 0; i < f; i++) {
      const w = i / f;
      d[i] = x[i] * Math.sqrt(w) + x[n + i] * Math.sqrt(1 - w);
    }
    return tampon;
  }
  function deuxRoses(c) {
    let r = roses.get(c);
    if (!r) { r = [rose(c, 4.7), rose(c, 6.1)]; roses.set(c, r); }
    return r;
  }

  /* --------------------------------------------------- les deux gestes

     Tout ce qui sonne est fait de ces deux-là : une note, et du bruit
     filtré. Ils prennent le contexte et la sortie en paramètres : le même
     son se joue dans le contexte vivant et dans un rendu hors ligne. */

  /** Une note, avec une hauteur qui peut glisser. */
  function ton(c, sortie, t, { freq = 220, vers = null, duree = 0.18, type = 'sine', vol = 0.16,
                               delai = 0 }) {
    const t0 = t + delai;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (vers) o.frequency.exponentialRampToValueAtTime(Math.max(20, vers), t0 + duree);
    // Attaque courte puis extinction : sans elle, chaque son claque.
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duree);
    o.connect(g).connect(sortie);
    o.start(t0);
    o.stop(t0 + duree + 0.03);
  }

  /* L'enveloppe d'un bruit : celle qu'avait fx.js, une extinction
     exponentielle multipliée par une descente droite, en une seule courbe
     (un nœud de moins par bruit). */
  function enveloppe(vol, points = 24) {
    const e = new Float32Array(points);
    const v = Math.max(vol, 0.0002);
    for (let i = 0; i < points; i++) {
      const x = i / (points - 1);
      e[i] = v * (1 - x) * (0.0001 / v) ** x;
    }
    return e;
  }

  /** Du bruit filtré : tout ce qui est souffle, foule, frottement, choc. */
  function bruit(c, sortie, t, { duree = 0.3, freq = 800, vol = 0.1, delai = 0, q = 1.2,
                                 filtre = 'bandpass', courbe = null }) {
    const t0 = t + delai;
    const b = blanc(c);
    const src = c.createBufferSource();
    src.buffer = b;
    const f = c.createBiquadFilter();
    f.type = filtre;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    g.gain.value = 0;
    g.gain.setValueCurveAtTime(courbe ?? enveloppe(vol), t0, duree);
    src.connect(f).connect(g).connect(sortie);
    const marge = b.duration - duree - 0.01;
    src.start(t0, marge > 0 ? alea() * marge : 0, Math.min(duree, b.duration));
    return f;
  }

  /* --------------------------------------------- les voix de la tribune

     Un éclat de voix : un cri sans mots. Une dent de scie à la hauteur d'une
     voix qui crie (170 à 290 Hz) passée dans deux formants de voyelle, qui
     monte un peu puis retombe — le contour d'un « hé ! », pas un air. À bas
     niveau, dans la rumeur, c'est quelqu'un qui crie au loin ; placé au
     hasard entre la gauche et la droite, c'est une tribune. */
  const VOL_ECLAT = 0.16;
  function eclat(c, sortie, t, force = 1) {
    const d = 0.28 + alea() * 0.32;
    const f0 = 170 + alea() * 120;
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.linearRampToValueAtTime(f0 * 1.12, t + d * 0.35);
    o.frequency.linearRampToValueAtTime(f0 * 0.8, t + d);
    const f1 = c.createBiquadFilter();
    f1.type = 'bandpass';
    f1.frequency.value = 600 + alea() * 250;
    f1.Q.value = 5;
    const f2 = c.createBiquadFilter();
    f2.type = 'bandpass';
    f2.frequency.value = 1050 + alea() * 500;
    f2.Q.value = 7;
    const g = c.createGain();
    const v = VOL_ECLAT * force;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + 0.04);
    g.gain.setValueAtTime(v, t + d * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(f1).connect(g);
    o.connect(f2).connect(g);
    let fin = g;
    if (typeof c.createStereoPanner === 'function') {
      const p = c.createStereoPanner();
      p.pan.value = alea() * 1.2 - 0.6;
      g.connect(p);
      fin = p;
    }
    fin.connect(sortie);
    o.start(t);
    o.stop(t + d + 0.05);
  }
  /** Quelques voix ensemble, à peine décalées : un groupe qui crie. */
  function eclats(c, sortie, t, voix, force = 1) {
    let x = t;
    for (let i = 0; i < voix; i++) {
      eclat(c, sortie, x, force * (0.5 + alea() * 0.5));
      x += 0.04 + alea() * 0.12;
    }
  }

  /* ----------------------------------------------- les frappes des chants

     Le tambour : une grosse caisse de tribune frappée à la mailloche. La
     peau est une sinusoïde qui tombe de 130 à 52 Hz ; le choc de la
     mailloche, un bruit bref et sourd ; et une harmonique à 240 Hz, sans
     laquelle le haut-parleur d'un téléphone — qui ne rend pas les graves —
     n'entendrait rien du tout. */
  function tambour(c, s, t, force = 1) {
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(130, t);
    o.frequency.exponentialRampToValueAtTime(52, t + 0.18);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.9 * force, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    o.connect(g).connect(s);
    o.start(t);
    o.stop(t + 0.52);
    bruit(c, s, t, { duree: 0.05, freq: 900, filtre: 'lowpass', q: 0.7, vol: 0.5 * force });
    ton(c, s, t, { freq: 240, vers: 100, duree: 0.12, type: 'triangle', vol: 0.22 * force });
  }

  /* Les claps : pas un clap, des centaines, jamais tout à fait ensemble. Un
     seul bruit (trois nœuds par frappe, pas douze), mais une enveloppe à
     quatre pointes étalées sur une trentaine de millisecondes, puis la queue
     de la salle ; et un filtre qui bouge un peu d'une frappe à l'autre. */
  function clap(c, s, t, force = 1) {
    const b = blanc(c);
    const src = c.createBufferSource();
    src.buffer = b;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1100 + alea() * 700;
    f.Q.value = 1.1;
    const g = c.createGain();
    g.gain.value = 0;
    const pointes = [0, 0.008 + alea() * 0.006, 0.017 + alea() * 0.008, 0.028 + alea() * 0.01];
    pointes.forEach((p, k) => {
      const a = force * (k === 0 ? 0.7 : 1 - k * 0.12);
      g.gain.setValueAtTime(a, t + p);
      g.gain.exponentialRampToValueAtTime(a * 0.18, t + p + 0.007);
    });
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    src.connect(f).connect(g).connect(s);
    src.start(t, alea() * (b.duration - 0.3), 0.25);
  }

  /* ============================================================ la banque

     Chaque son tient en quelques lignes, et c'est voulu : un son de jeu doit
     être court et reconnaissable, pas joli. `famille` dit sa fenêtre de
     mixage, `duree` combien de temps le banc le rend, `variantes` les
     options qu'il essaie aussi (aucune ne doit saturer). Les noms sont ceux
     que les pages appellent déjà : on n'en renomme aucun. */
  const BANQUE = {
    /* ------------------------------------------------- l'interface */
    tic: { famille: 'interface', duree: 0.1,
      jouer: (c, s, t) => ton(c, s, t, { freq: 1200, duree: 0.03, type: 'square', vol: 0.05 }) },
    carte: { famille: 'interface', duree: 0.15,
      jouer: (c, s, t) => ton(c, s, t, { freq: 880, vers: 400, duree: 0.08, type: 'square', vol: 0.06 }) },
    bache: { famille: 'interface', duree: 0.3,
      jouer: (c, s, t) => ton(c, s, t, { freq: 115, vers: 70, duree: 0.22, type: 'sine', vol: 0.13 }) },
    /* Le tic sourd : une porte fermée qu'on touche (FX.refus). Plus bas et
       plus mat que le tic d'une bâche, avec un frottement dessous : on doit
       entendre, sans regarder, que le geste n'a pas pris. Le tic clair
       dirait le contraire — c'est le son d'une bâche qui s'ouvre. */
    sourd: { famille: 'interface', duree: 0.15,
      jouer: (c, s, t) => {
        ton(c, s, t, { freq: 220, vers: 110, duree: 0.07, type: 'triangle', vol: 0.12 });
        bruit(c, s, t, { duree: 0.05, freq: 360, vol: 0.06 });
      } },
    /* « C'est fait » : l'accueil l'appelait depuis longtemps (le Fanzzy
       choisi) et la banque ne l'avait pas — l'appel ne sonnait pas. Deux
       notes brèves qui montent d'une quinte : un acquiescement, pas un air. */
    ok: { famille: 'interface', duree: 0.3,
      jouer: (c, s, t) => {
        ton(c, s, t, { freq: 784, duree: 0.09, type: 'sine', vol: 0.12 });
        ton(c, s, t, { freq: 1175, duree: 0.14, type: 'sine', vol: 0.12, delai: 0.07 });
      } },
    /* La carte du booster qui se retourne (« audio.flip » de cartes.js) :
       un claquement sec qui tombe. */
    retournement: { famille: 'interface', duree: 0.2,
      jouer: (c, s, t) => ton(c, s, t, { freq: 620, vers: 180, duree: 0.11, type: 'triangle', vol: 0.14 }) },

    /* ------------------------------------------------------ le jeu */
    pousse: { famille: 'jeu', duree: 0.2,
      jouer: (c, s, t) => ton(c, s, t, { freq: 190, vers: 62, duree: 0.15, type: 'triangle', vol: 0.15 }) },
    contre: { famille: 'jeu', duree: 0.25,
      jouer: (c, s, t) => ton(c, s, t, { freq: 130, vers: 55, duree: 0.18, type: 'triangle', vol: 0.1 }) },
    chant: { famille: 'jeu', duree: 0.32,
      jouer: (c, s, t) => {
        bruit(c, s, t, { duree: 0.26, freq: 750, vol: 0.09 });
        ton(c, s, t, { freq: 300, vers: 520, duree: 0.2, vol: 0.09 });
      } },
    parfait: { famille: 'jeu', duree: 0.45,
      jouer: (c, s, t) => {
        bruit(c, s, t, { duree: 0.3, freq: 1100, vol: 0.1 });
        [523, 659, 784].forEach((f, i) =>
          ton(c, s, t, { freq: f, duree: 0.3, type: 'sine', vol: 0.09, delai: i * 0.05 }));
      } },
    /* Le papier alu qu'on déchire (« audio.rip » de cartes.js). L'intensité
       suit le geste : le doigt qui tire le fait monter (0,22 à 0,72), la
       déchirure finale vaut 1,4. Le banc mesure à 1 et essaie les deux
       bouts. */
    dechirure: { famille: 'jeu', duree: 0.45, variantes: [{ intensite: 0.22 }, { intensite: 1.4 }],
      jouer: (c, s, t, { intensite = 1 } = {}) => {
        const i = borner(Number(intensite) || 0, 0.05, 1.6);
        const d = 0.28 * i;
        const courbe = new Float32Array(24);
        for (let k = 0; k < courbe.length; k++) {
          courbe[k] = 0.22 * i * (1 - k / (courbe.length - 1)) ** 1.6;
        }
        const f = bruit(c, s, t, { duree: d, freq: 1400, q: 0.8, courbe });
        f.frequency.setValueAtTime(1400, t);
        f.frequency.exponentialRampToValueAtTime(4200, t + d);
      } },
    /* Le carillon de l'épique : deux frappes de cloche, la seconde un peu
       plus haut, chacune avec son partiel à 2,76 fois la fondamentale —
       celui qui fait « cloche » et non « flûte ». Deux frappes, pas un air. */
    carillon: { famille: 'jeu', duree: 1.1,
      jouer: (c, s, t) => {
        [[1568, 0], [2093, 0.09]].forEach(([f, d]) => {
          ton(c, s, t, { freq: f, duree: 0.9, type: 'sine', vol: 0.07, delai: d });
          ton(c, s, t, { freq: f * 2.76, duree: 0.32, type: 'sine', vol: 0.025, delai: d });
        });
      } },
    /* L'accord de l'épique (« audio.chime('epique') » de cartes.js) : une
       tierce tenue. Il sonnait à la sortie d'un booster ; le kiosque passe
       maintenant par FX.reveler et son carillon. Seule la fiche de carte de
       la collection l'appelle encore, quand une épique qu'on a se pose. */
    'accord-epique': { famille: 'jeu', duree: 1.3,
      jouer: (c, s, t) => accord(c, s, t, [523, 659]) },
    /* Le gong du coup d'envoi (l'affiche du duel l'appelait, et la banque ne
       l'avait pas). Un métal grave aux partiels inharmoniques, chacun avec
       sa propre extinction — les graves durent, les aigus s'éteignent vite —,
       et le choc sourd de la mailloche. Une frappe, pas une note de musique. */
    gong: { famille: 'jeu', duree: 2.8,
      jouer: (c, s, t) => {
        [[1, 0.5, 2.6], [1.47, 0.32, 2], [2.09, 0.25, 1.6], [2.56, 0.18, 1.2],
          [3.18, 0.12, 0.9], [4.3, 0.08, 0.6]]
          .forEach(([r, v, d]) => ton(c, s, t, { freq: 98 * r, duree: d, type: 'sine', vol: v * 0.3 }));
        bruit(c, s, t, { duree: 0.08, freq: 300, filtre: 'lowpass', q: 0.7, vol: 0.25 });
      } },

    /* ------------------------------------------------- les moments */
    // La corne de but : trois notes tenues, comme un klaxon de tribune.
    but: { famille: 'moment', duree: 1.2,
      jouer: (c, s, t) => {
        [392, 494, 587].forEach((f, i) =>
          ton(c, s, t, { freq: f, duree: 0.55, type: 'sawtooth', vol: 0.09, delai: i * 0.12 }));
        bruit(c, s, t, { duree: 0.9, freq: 300, vol: 0.07, delai: 0.1 });
      } },
    // Le vrai match : la même corne, et la foule plus longtemps dessous.
    butReel: { famille: 'moment', duree: 1.7,
      jouer: (c, s, t) => {
        BANQUE.but.jouer(c, s, t);
        bruit(c, s, t, { duree: 1.4, freq: 420, vol: 0.08, delai: 0.15 });
      } },
    encaisse: { famille: 'moment', duree: 0.8,
      jouer: (c, s, t) => ton(c, s, t, { freq: 210, vers: 85, duree: 0.7, type: 'sawtooth', vol: 0.09 }) },
    /* L'évolution, en deux sons parce qu'elle est en deux temps. La charge
       monte pendant une seconde — la durée exacte de l'animation : un son qui
       s'arrête avant la lumière fait retomber le geste au moment où il
       culmine. Puis un accord qui se pose, sans le bruit de foule du but : on
       ne fête pas la même chose. */
    charge: { famille: 'moment', duree: 1.1,
      jouer: (c, s, t) => {
        ton(c, s, t, { freq: 140, vers: 720, duree: 1, type: 'sawtooth', vol: 0.07 });
        bruit(c, s, t, { duree: 1, freq: 900, vol: 0.05 });
      } },
    evolue: { famille: 'moment', duree: 1.2,
      jouer: (c, s, t) => {
        [523, 659, 784, 1047].forEach((f, i) =>
          ton(c, s, t, { freq: f, duree: 0.85, type: 'sine', vol: 0.085, delai: i * 0.06 }));
        bruit(c, s, t, { duree: 0.35, freq: 1400, vol: 0.07 });
      } },
    /* Le rugissement de la légendaire (FX.reveler) : une gorge grave qui
       descend, un grondement une quinte au-dessus, plus riche en
       harmoniques pour qu'un haut-parleur de téléphone l'entende, et le
       souffle de la foule par-dessus. */
    rugissement: { famille: 'moment', duree: 1.4,
      jouer: (c, s, t) => {
        ton(c, s, t, { freq: 96, vers: 48, duree: 1.15, type: 'sawtooth', vol: 0.1 });
        ton(c, s, t, { freq: 144, vers: 70, duree: 0.9, type: 'square', vol: 0.035, delai: 0.04 });
        bruit(c, s, t, { duree: 1.25, freq: 280, vol: 0.09 });
        bruit(c, s, t, { duree: 0.8, freq: 900, vol: 0.05, delai: 0.1 });
      } },
    /* L'accord riche de la légendaire (« audio.chime('legendaire') ») : comme
       celui de l'épique, la collection seule l'appelle encore — au kiosque,
       la légendaire a le rugissement de FX.reveler. */
    'accord-legendaire': { famille: 'moment', duree: 1.6,
      jouer: (c, s, t) => accord(c, s, t, [523, 659, 784, 1047, 1319]) },
    /* Le grondement de tribune d'une couronne (« audio.roar » de cartes.js) :
       un bruit sourd qui enfle et retombe en près de deux secondes. La
       collection l'appelle avec l'accord de la légendaire ; le kiosque, plus. */
    grondement: { famille: 'moment', duree: 1.9,
      jouer: (c, s, t) => {
        const courbe = new Float32Array(32);
        for (let k = 0; k < courbe.length; k++) courbe[k] = 0.27 * Math.sin(Math.PI * k / (courbe.length - 1));
        bruit(c, s, t, { duree: 1.8, freq: 700, filtre: 'lowpass', q: 0.7, courbe });
      } },
    /* La montée de niveau (niveau-fete.js). Elle jouait la corne de but : on
       fêtait un niveau gagné au kiosque avec le klaxon d'un but. Ici, une
       montée — la hauteur qui grimpe et un souffle —, puis un accord majeur
       tenu qui se pose, et la tribune qui applaudit dessous. */
    niveau: { famille: 'moment', duree: 1.9,
      jouer: (c, s, t) => {
        ton(c, s, t, { freq: 330, vers: 990, duree: 0.32, type: 'triangle', vol: 0.08 });
        bruit(c, s, t, { duree: 0.36, freq: 1800, vol: 0.05 });
        [659, 831, 988].forEach((f) => ton(c, s, t, { freq: f, duree: 1.1, type: 'sine', vol: 0.07, delai: 0.3 }));
        [1318, 1662].forEach((f) => ton(c, s, t, { freq: f, duree: 0.5, type: 'sine', vol: 0.025, delai: 0.3 }));
        bruit(c, s, t, { duree: 1.3, freq: 1300, q: 0.6, vol: 0.06, delai: 0.3 });
      } },
    /* L'ovation du but : la tribune qui explose. Le bruit rose de la rumeur
       qui enfle en un quart de seconde, s'éclaircit (les voix montent quand
       on crie) et retombe en quatre secondes, des cris dessus. Elle passe par
       le bus de l'ambiance : le calme et l'onglet caché la coupent avec elle. */
    ovation: { famille: 'moment', bus: 'ambiance', duree: 5.4,
      jouer: (c, s, t) => {
        const [r] = deuxRoses(c);
        const src = c.createBufferSource();
        src.buffer = r;
        src.loop = true;
        const bp = c.createBiquadFilter();
        bp.type = 'bandpass';
        bp.Q.value = 0.6;
        bp.frequency.setValueAtTime(650, t);
        bp.frequency.linearRampToValueAtTime(1100, t + 0.6);
        bp.frequency.setTargetAtTime(800, t + 1.6, 1.2);
        const hp = c.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 2600;
        const g1 = c.createGain();
        g1.gain.setValueAtTime(0.0001, t);
        g1.gain.exponentialRampToValueAtTime(1, t + 0.28);
        g1.gain.linearRampToValueAtTime(0.8, t + 1.5);
        g1.gain.exponentialRampToValueAtTime(0.0001, t + 5);
        const g2 = c.createGain();
        g2.gain.setValueAtTime(0.0001, t);
        g2.gain.exponentialRampToValueAtTime(0.35, t + 0.25);
        g2.gain.exponentialRampToValueAtTime(0.0001, t + 3);
        src.connect(bp).connect(g1).connect(s);
        src.connect(hp).connect(g2).connect(s);
        src.start(t, alea() * r.duration);
        src.stop(t + 5.1);
        for (let i = 0; i < 7; i++) eclats(c, s, t + 0.1 + alea() * 1.8, 1, 0.8);
      } },
  };

  /* « Object.hasOwn » manque aux Safari d'iOS 15.0 à 15.3 : il lèverait à
     chaque son, et le jeu deviendrait muet sans un mot. */
  const existe = (nom) => Object.prototype.hasOwnProperty.call(BANQUE, nom);

  /** Un accord tenu : chaque note entre un peu après la précédente. */
  function accord(c, s, t, notes) {
    notes.forEach((hz, i) => {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'sine';
      o.frequency.value = hz;
      const t0 = t + i * 0.07;
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.16, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 1.1);
      o.connect(g).connect(s);
      o.start(t0);
      o.stop(t0 + 1.2);
    });
  }

  /** Joue un son de la banque dans un contexte et une chaîne donnés. */
  function jouerDans(c, ch, nom, options, t) {
    const s = BANQUE[nom];
    const mix = c.createGain();
    mix.gain.value = MIX[nom] ?? 1;
    mix.connect(ch.bus[s.bus ?? FAMILLES[s.famille].bus]);
    s.jouer(c, mix, t, options ?? {});
  }

  /* ================================================== le contexte vivant

     **Créé au premier geste, jamais avant.** Un contexte créé sans geste naît
     suspendu, le navigateur le dit en console, et il ne joue rien. Les
     écouteurs ci-dessous, posés en capture sur la fenêtre, passent avant
     ceux de la page : le contexte existe déjà quand la page joue son premier
     son dans son propre gestionnaire. Les événements sont ceux qu'un
     navigateur compte pour un geste : sur un téléphone, ce n'est pas le
     doigt posé (pointerdown) mais le doigt levé (pointerup, touchend). Tant
     qu'aucun n'est venu, un son demandé ne crée rien — il ne pourrait pas
     jouer. */
  let ctx = null;
  let chaine = null;
  let vuGeste = false;

  function ouvrir() {
    if (calme()) return null;
    if (ctx && ctx.state === 'closed') { ctx = null; chaine = null; }
    if (!ctx) {
      if (!vuGeste) return null;
      const C = window.AudioContext ?? window.webkitAudioContext;
      if (typeof C !== 'function') return null;
      try {
        try { ctx = new C({ latencyHint: 'interactive' }); } catch { ctx = new C(); }
        chaine = construireChaine(ctx, document.hidden ? 0 : gainDuVolume(volumeJoueur));
      } catch { ctx = null; chaine = null; return null; }
    }
    // « interrupted » : Safari, après un appel téléphonique.
    if ((ctx.state === 'suspended' || ctx.state === 'interrupted') && !document.hidden) {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }

  function geste(e) {
    // La souris compte au bouton enfoncé ; le doigt, au doigt levé.
    if (e.type === 'pointerdown' && e.pointerType && e.pointerType !== 'mouse') return;
    vuGeste = true;
    if (!ouvrir()) return;   // sous le calme, rien : voir « ouvrir »
    poserVolume();
    appliquer();
  }
  for (const type of ['pointerdown', 'pointerup', 'touchend', 'keydown', 'click']) {
    window.addEventListener(type, geste, { capture: true, passive: true });
  }

  /* Le gain de sortie : le volume du joueur, ou rien sous le calme et
     caché. Posé seulement quand il change : chaque toucher passe ici trois
     fois (doigt posé, levé, clic), et chaque pose ajoute un événement à la
     frise du paramètre. */
  let pose = { sortie: null, cible: null };
  function poserVolume() {
    if (!ctx || !chaine) return;
    const cible = calme() || document.hidden ? 0 : gainDuVolume(volumeJoueur);
    if (pose.sortie === chaine.sortie && pose.cible === cible) return;
    try {
      chaine.sortie.gain.setTargetAtTime(cible, ctx.currentTime, 0.015);
      pose = { sortie: chaine.sortie, cible };
    } catch { /* fermé */ }
  }

  /* Le même son demandé deux fois dans la même trentaine de millisecondes
     ne sonne qu'une fois : deux copies exactes s'additionnent (+6 dB) sans
     rien dire de plus. Cela arrive — deux événements du même geste, une
     poussée qui revient avec son écho. **Copies exactes seulement** : le nom
     et les options. La déchirure finale du kiosque (intensité 1,4) peut
     suivre de quelques millisecondes le dernier cran du glissé ; c'est un
     autre son, et elle ne doit pas être avalée. */
  const derniers = new Map();
  const ANTI_DOUBLON = 30;

  /**
   * Joue un son de la banque.
   * @param {string} nom
   * @param {object} [options]  propres à certains sons (« intensite » de la déchirure)
   * @returns {boolean} vrai s'il est parti
   */
  function jouer(nom, options) {
    /* Le calme n'est vérifié qu'à un endroit, dans « ouvrir » : deux gardes
       au même endroit rendent chacune inéprouvable seule. */
    if (!existe(nom) || document.hidden) return false;
    const c = ouvrir();
    if (!c || !chaine) return false;
    const maintenant = performance.now();
    const cle = options ? `${nom} ${JSON.stringify(options)}` : nom;
    if (maintenant - (derniers.get(cle) ?? -1e9) < ANTI_DOUBLON) return false;
    // Une déchirure par intensité : la table se vide avant de grossir.
    if (derniers.size > 64) derniers.clear();
    derniers.set(cle, maintenant);
    try {
      jouerDans(c, chaine, nom, options, c.currentTime);
      return true;
    } catch { return false; /* le son ne doit jamais casser le jeu */ }
  }

  /* ============================================================ l'ambiance

     La rumeur de la tribune, synthétisée en couches : un grave (le corps du
     stade), la rumeur des voix (deux formants larges sur un bruit rose),
     et un souffle clair (les cris, aux niveaux hauts). Deux oscillateurs
     très lents la font respirer, des éclats de voix la traversent de temps
     en temps. Elle monte et descend avec le match par une seule commande :

       0  la tribune vide          (rien)
       1  la rumeur                (une foule qui attend)
       2  la tribune pousse        (plus fort, plus clair, plus de cris)
       3  le but                   (l'ovation, et la tribune au maximum
                                    pendant neuf secondes, puis retour)

     **Elle ne coûte presque rien** : son graphe est construit une fois et ne
     change ensuite que par ses paramètres (aucun nœud recréé à chaque image ;
     seuls les éclats, toutes les quelques secondes, en créent quelques-uns).
     À zéro, une fois éteinte, il est démonté ; dans un onglet caché aussi, et
     le contexte est suspendu : plus aucun calcul audio. */
  /* Chaque niveau : le gain de ses trois couches, la profondeur de sa
     respiration, la hauteur de la rumeur (elle monte quand on crie), l'écart
     moyen entre deux éclats de voix (ms), et la fenêtre de sa sonie moyenne
     (LUFS, mesurée sur huit secondes). Mesures du banc, le 2 octobre 2026 :
     1 → −37,1 · 2 → −32,4 · 3 → −27,5. Cinq décibels d'un niveau à l'autre :
     assez pour qu'une poussée s'entende, et la rumeur reste toujours sous
     l'interface (−29 à −27), qu'elle ne doit jamais couvrir, sauf au but. */
  const NIVEAUX_AMBIANCE = [
    { grave: 0, voix: 0, clair: 0, souffle: 0, voixHz: 450, eclats: 0, fenetre: null },
    { grave: 0.3, voix: 0.22, clair: 0, souffle: 0.3, voixHz: 480, eclats: 9000, fenetre: [-40, -35] },
    { grave: 0.43, voix: 0.4, clair: 0.08, souffle: 0.35, voixHz: 600, eclats: 4500, fenetre: [-35, -30] },
    { grave: 0.64, voix: 0.64, clair: 0.32, souffle: 0.15, voixHz: 760, eclats: 1600, fenetre: [-30, -25] },
  ];
  /** Le gain de sortie de la rumeur. */
  const MIX_AMBIANCE = 0.3;
  /* Les transitions : on monte vite (une poussée s'entend tout de suite), on
     redescend lentement (une tribune ne se tait pas d'un coup), et le but
     arrive presque d'un coup. Ce sont des constantes de temps : la cible est
     atteinte aux deux tiers après une fois, presque entièrement après trois. */
  const TAU = { monte: 0.6, descend: 1.6, but: 0.15 };
  /** Combien de temps la tribune reste au maximum après un but. */
  const TENUE_BUT = 9000;

  /** Le graphe de la rumeur, éteint (tous ses gains à zéro). */
  function construireLit(c, dest) {
    const [r1, r2] = deuxRoses(c);
    const sortie = c.createGain();
    sortie.gain.value = MIX_AMBIANCE;
    sortie.connect(dest);
    const boucle = (tampon) => {
      const s = c.createBufferSource();
      s.buffer = tampon;
      s.loop = true;
      return s;
    };
    const s1 = boucle(r1);
    const s2 = boucle(r2);
    const filtre = (type, freq, q) => {
      const f = c.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      return f;
    };
    const gain = () => { const g = c.createGain(); g.gain.value = 0; return g; };
    // Le grave.
    const gGrave = gain();
    s1.connect(filtre('lowpass', 240, 0.5)).connect(gGrave).connect(sortie);
    // La rumeur des voix : un formant large, et un second plus haut.
    const bpVoix = filtre('bandpass', 450, 0.8);
    const pic = filtre('peaking', 1150, 1);
    pic.gain.value = 4;
    const gVoix = gain();
    s2.connect(bpVoix).connect(pic).connect(gVoix).connect(sortie);
    // Le souffle clair des cris.
    const gClair = gain();
    s1.connect(filtre('highpass', 2400, 0.7)).connect(gClair).connect(sortie);
    /* La respiration : deux oscillateurs très lents qui s'ajoutent aux
       gains des couches (un paramètre audio additionne ce qu'on lui branche
       à sa valeur propre). Des périodes de onze et sept secondes, qui ne
       retombent ensemble qu'au bout d'une minute et quart. */
    const lfo = (hz, cible) => {
      const o = c.createOscillator();
      o.frequency.value = hz;
      const p = gain();
      o.connect(p).connect(cible);
      return [o, p];
    };
    const [o1, pVoix] = lfo(0.09, gVoix.gain);
    const [o2, pGrave] = lfo(0.14, gGrave.gain);
    // Les éclats passent par leur propre entrée, branchée à la sortie.
    const entreeEclats = c.createGain();
    entreeEclats.connect(sortie);
    const debut = c.currentTime;
    s1.start(debut, alea() * r1.duration);
    s2.start(debut, alea() * r2.duration);
    o1.start(debut);
    o2.start(debut);
    return { sortie, gGrave, gVoix, gClair, bpVoix, pVoix, pGrave, eclats: entreeEclats,
      sources: [s1, s2, o1, o2] };
  }

  /** Mène la rumeur vers un niveau ; « tau » nul : d'un coup. */
  function reglerLit(lit, n, t, tau) {
    const N = NIVEAUX_AMBIANCE[n];
    const poser = (p, v) => (tau > 0 ? p.setTargetAtTime(v, t, tau) : p.setValueAtTime(v, t));
    poser(lit.gGrave.gain, N.grave);
    poser(lit.gVoix.gain, N.voix);
    poser(lit.gClair.gain, N.clair);
    poser(lit.pVoix.gain, N.voix * N.souffle);
    poser(lit.pGrave.gain, N.grave * N.souffle * 0.6);
    poser(lit.bpVoix.frequency, N.voixHz);
  }

  function demonterLit(lit) {
    for (const s of lit.sources) { try { s.stop(); } catch { /* déjà arrêtée */ } }
    try { lit.sortie.disconnect(); } catch { /* déjà débranchée */ }
  }

  /* L'état de l'ambiance. `base` est le niveau que la page a posé ;
     `passe`, un niveau passager (un but, une poussée) qui retombe seul ;
     `joue`, le niveau vers lequel la rumeur va vraiment. */
  const amb = { base: 0, passe: null, joue: 0, lit: null, minuterie: 0, eclats: 0, demontage: 0 };
  const voulu = () => Math.max(amb.base, amb.passe?.niveau ?? 0);

  function eteindreLit(tau) {
    clearTimeout(amb.eclats);
    amb.eclats = 0;
    amb.joue = 0;
    const lit = amb.lit;
    if (!lit) return;
    if (tau > 0 && ctx?.state === 'running') {
      reglerLit(lit, 0, ctx.currentTime, tau);
      clearTimeout(amb.demontage);
      amb.demontage = setTimeout(() => {
        amb.demontage = 0;
        if (amb.lit === lit && amb.joue === 0) { demonterLit(lit); amb.lit = null; }
      }, tau * 5000);
    } else {
      clearTimeout(amb.demontage);
      amb.demontage = 0;
      demonterLit(lit);
      amb.lit = null;
    }
  }

  /** Accorde la rumeur à ce qui est voulu, si elle peut jouer. */
  function appliquer() {
    const n = voulu();
    const jouable = ctx && chaine && ctx.state !== 'closed' && !calme() && !document.hidden;
    if (!jouable) { eteindreLit(0); return; }
    /* Zéro : on éteint en fondu, une fois. Une rumeur déjà en train de
       s'éteindre ne se rééteint pas à chaque toucher — son démontage serait
       repoussé d'autant. */
    if (n === 0) { if (amb.joue !== 0) eteindreLit(TAU.descend); return; }
    clearTimeout(amb.demontage);
    amb.demontage = 0;
    if (!amb.lit) amb.lit = construireLit(ctx, chaine.bus.ambiance);
    if (n !== amb.joue) {
      const tau = n === 3 ? TAU.but : n > amb.joue ? TAU.monte : TAU.descend;
      reglerLit(amb.lit, n, ctx.currentTime, tau);
      amb.joue = n;
      /* Le prochain cri suit le nouveau niveau : celui qu'on avait tiré au
         rythme de la rumeur pouvait attendre treize secondes, au milieu
         d'un but. */
      clearTimeout(amb.eclats);
      amb.eclats = 0;
    }
    planifierEclats();
  }

  /* Les éclats de voix : rares à la rumeur (toutes les neuf secondes en
     moyenne), fréquents au but. Une minuterie, pas une boucle d'images :
     elle dort entre deux cris, et l'onglet caché l'arrête. */
  function planifierEclats() {
    if (amb.eclats) return;
    const N = NIVEAUX_AMBIANCE[amb.joue];
    if (!amb.lit || !N.eclats) return;
    amb.eclats = setTimeout(() => {
      amb.eclats = 0;
      if (!amb.lit || !ctx || ctx.state !== 'running' || document.hidden || calme()) return;
      const voix = 1 + Math.floor(alea() * (amb.joue >= 2 ? 3 : 1.6));
      eclats(ctx, amb.lit.eclats, ctx.currentTime + 0.02, voix);
      planifierEclats();
    }, N.eclats * (0.5 + alea()));
  }

  /**
   * L'ambiance de tribune. Une seule commande pour tout le match.
   *
   * Elle ne joue que si la page l'a demandée, et **ne démarre qu'au premier
   * geste** : demandée avant, elle attend le premier toucher. Le niveau 3
   * (le but) est passager : l'ovation part, la tribune reste au maximum
   * neuf secondes, puis revient au niveau que la page avait posé.
   *
   * @param {number} niveau  0 tribune vide, 1 rumeur, 2 la tribune pousse, 3 but
   * @param {object} [o]
   * @param {number} [o.pendant]  en millisecondes : un niveau passager qui
   *   retombe seul (une poussée : « ambiance(2, { pendant: 6000 }) ») ; le
   *   niveau posé durablement n'en est pas changé
   * @returns {number} le niveau voulu désormais
   */
  function ambiance(niveau, { pendant } = {}) {
    const n = Math.round(borner(Number(niveau) || 0, 0, 3));
    const passager = n === 3 ? Number(pendant) || TENUE_BUT : Number(pendant) || 0;
    if (n === 0) {
      // La tribune se vide : la fin du match, la sortie. Rien ne la retient.
      amb.base = 0;
      amb.passe = null;
      clearTimeout(amb.minuterie);
      amb.minuterie = 0;
    } else if (passager > 0) {
      /* Un passager plus faible que celui qui court ne le coupe pas : une
         poussée pendant l'ovation n'éteint pas l'ovation. */
      if (!amb.passe || n >= amb.passe.niveau) {
        amb.passe = { niveau: n };
        clearTimeout(amb.minuterie);
        amb.minuterie = setTimeout(() => { amb.minuterie = 0; amb.passe = null; appliquer(); }, passager);
      }
    } else {
      amb.base = n;
    }
    if (n === 3) jouer('ovation');
    else ouvrir();
    appliquer();
    return voulu();
  }

  /* ============================================================ les chants

     Des frappes de tambour et des claps de foule calés sur la pulsation d'un
     geste. **Du rythme, jamais un air** : les chants de supporters
     reprennent souvent des airs protégés, et un air reconnaissable serait
     une citation. Chaque motif dit, temps par temps, ce qui frappe — le
     tambour (« T ») ou les claps (« C ») —, à quelle fraction du temps, et
     avec quelle force. Les claps tombent là où le joueur tape : on frappe
     avec sa tribune. */
  const CHANTS = {
    // L'unisson du geste « tempo » : tambour et claps sur chaque temps, un
    // tambour un peu plus fort tous les quatre pour qu'on sente la mesure.
    tempo: (i) => [['T', 0, i % 4 === 0 ? 1 : 0.8], ['C', 0, 1]],
    // Le contretemps : le tambour marque le temps, la tribune frappe entre.
    contretemps: () => [['T', 0, 1], ['C', 0.5, 0.9]],
    // La marche : le tambour sur les temps forts, les claps sur les faibles —
    // le pas d'une tribune, pour un chant ouvert.
    marche: (i) => (i % 2 === 0 ? [['T', 0, 1]] : [['C', 0, 1]]),
    // Le roulement : quatre coups par temps qui enflent, et un coup final.
    roulement: (i, n) => (i >= n - 1 ? [['T', 0, 1.15], ['C', 0, 1]]
      : [0, 0.25, 0.5, 0.75].map((f) => ['T', f, 0.3 + 0.55 * (i + f) / Math.max(1, n - 1)])),
    // Les frappes d'un motif donné instant par instant (l'écho, le crescendo).
    frappes: () => [['T', 0, 1], ['C', 0, 0.8]],
  };
  /* Les gains des deux voix d'un chant. Le tambour seul sortait dix
     décibels au-dessus des claps — ses graves pèsent sur la crête, pas sur
     l'oreille. Équilibrées au banc (huit temps à 560 ms) : tambour seul
     −23,7 LUFS, claps seuls −23,0 ; le chant « tempo » entier −20,4, le
     contretemps −23,8, la marche −23,1, le roulement −20,9 : dans la
     fenêtre du jeu. */
  const MIX_CHANT = { tambour: 0.164, clap: 0.856 };
  /** Les bornes d'un tempo : en deçà ce n'est plus un temps, au-delà plus un rythme. */
  const TEMPO = { min: 150, max: 2000, defaut: 560 };
  /** Le plus long chant compté : au-delà, on s'arrête là. Un chant sans fin
      se demande avec « temps: Infinity ». */
  const TEMPS_MAX = 512;

  /**
   * Le plan d'un chant : la liste de ses temps, et de ses frappes. Un chant
   * ouvert (« temps: Infinity ») n'a pas de fin ; on le parcourt temps par
   * temps sans jamais le dresser en entier.
   */
  function planDuChant(type, { tempo = TEMPO.defaut, temps = 8, debut = 0, instants = null } = {}) {
    const motif = CHANTS[type];
    if (!motif) return null;
    const liste = Array.isArray(instants)
      ? instants.map(Number).filter((x) => Number.isFinite(x) && x >= 0) : null;
    const periode = borner(Number(tempo) || TEMPO.defaut, TEMPO.min, TEMPO.max) / 1000;
    const n = liste ? liste.length
      : temps === Infinity ? Infinity : Math.round(borner(Number(temps) || 8, 1, TEMPS_MAX));
    const depart = Math.max(0, Number(debut) || 0) / 1000;
    const instant = (i) => depart + (liste ? liste[i] / 1000 : i * periode);
    const frappesDu = (i) => motif(i, n).map(([voix, part, force]) =>
      ({ t: instant(i) + part * periode, voix, force }));
    const duree = n === Infinity ? Infinity : (instant(n - 1) + periode) * 1000;
    return { n, frappesDu, duree, periode };
  }

  function voixDuChant(c, dest) {
    const sortie = c.createGain();
    sortie.connect(dest);
    const t = c.createGain();
    t.gain.value = MIX_CHANT.tambour;
    t.connect(sortie);
    const cl = c.createGain();
    cl.gain.value = MIX_CHANT.clap;
    cl.connect(sortie);
    return { sortie, T: t, C: cl };
  }
  const frapper = (c, v, f, t0) =>
    (f.voix === 'T' ? tambour : clap)(c, v[f.voix], t0 + f.t, f.force);

  let chantEnCours = null;
  /** La poignée d'un chant qui ne joue pas : la page n'a pas à le savoir. */
  const sansChant = (duree = 0) => ({ arreter() {}, duree, joue: false });

  function arreterChant(seul = null) {
    const ch = chantEnCours;
    if (!ch || (seul && seul !== ch)) return;
    chantEnCours = null;
    clearTimeout(ch.minuterie);
    ch.minuterie = 0;
    try {
      ch.voix.sortie.gain.setTargetAtTime(0, ch.c.currentTime, 0.02);
      setTimeout(() => { try { ch.voix.sortie.disconnect(); } catch { /* déjà */ } }, 200);
    } catch { /* contexte fermé */ }
  }

  /**
   * Un chant à l'unisson d'un geste.
   *
   * Les frappes sont posées sur l'horloge audio, pas sur des minuteries :
   * une minuterie dérive de quelques millisecondes à chaque temps, l'horloge
   * audio jamais. On les pose un quart de seconde en avance, par petits
   * paquets — un chant ouvert ne peut pas être dressé en entier, et un chant
   * qu'on arrête ne doit pas laisser vingt frappes déjà parties.
   *
   * @param {string} type  « tempo », « contretemps », « marche », « roulement »
   *   ou « frappes » (avec « instants »)
   * @param {object} [o]
   * @param {number} [o.tempo=560]  la durée d'un temps, en millisecondes —
   *   celle que le serveur donne au geste (« gestes.tempo.interval »)
   * @param {number} [o.temps=8]    combien de temps ; Infinity : un chant
   *   ouvert, jusqu'à « arreter() »
   * @param {number} [o.debut=0]    en millisecondes, avant le premier temps
   * @param {number[]} [o.instants] les instants des frappes, en
   *   millisecondes depuis le début (« gestes.echo.instants »)
   * @returns {{ arreter(): void, duree: number, joue: boolean }}
   */
  function chant(type, o = {}) {
    arreterChant();
    const plan = planDuChant(type, o);
    if (!plan) return sansChant();
    if (document.hidden) return sansChant(plan.duree);
    const c = ouvrir();
    if (!c || !chaine) return sansChant(plan.duree);
    let voix;
    try { voix = voixDuChant(c, chaine.bus.effets); } catch { return sansChant(plan.duree); }
    const t0 = c.currentTime + 0.03;
    const ch = { c, voix, minuterie: 0 };
    let i = 0;
    const AVANCE = 0.25;
    const avancer = () => {
      if (chantEnCours !== ch) return;
      const horizon = c.currentTime + AVANCE;
      try {
        while (i < plan.n) {
          const frappes = plan.frappesDu(i);
          if (t0 + frappes[0].t > horizon) break;
          for (const f of frappes) frapper(c, voix, f, t0);
          i += 1;
        }
      } catch { arreterChant(ch); return; }
      if (i >= plan.n) {
        // Fini : on rend la place une fois la dernière frappe éteinte.
        ch.minuterie = setTimeout(() => arreterChant(ch), (t0 - c.currentTime) * 1000 + plan.duree + 600);
        return;
      }
      ch.minuterie = setTimeout(avancer, 60);
    };
    chantEnCours = ch;
    avancer();
    return { arreter: () => arreterChant(ch), duree: plan.duree, joue: true };
  }

  /* ===================================================== calme et onglet

     Le calme coupe tout, tout de suite : la sortie à zéro, le contexte
     suspendu (plus aucun calcul), la rumeur démontée, le chant arrêté. On
     l'apprend en observant l'attribut lui-même : le tiroir, le bouton du
     duel, un autre onglet (par fx.js et menu.js) l'écrivent tous là. */
  function surCalme() {
    if (calme()) {
      arreterChant();
      eteindreLit(0);
      poserVolume();
      if (ctx?.state === 'running') ctx.suspend().catch(() => {});
    } else if (ctx && !document.hidden) {
      ctx.resume().catch(() => {});
      poserVolume();
      appliquer();
    }
  }
  if (typeof MutationObserver === 'function') {
    new MutationObserver(surCalme).observe(document.documentElement,
      { attributes: true, attributeFilter: ['data-calme'] });
  }

  /* L'onglet caché se tait : la rumeur s'arrête (démontée), le chant aussi,
     et le contexte est suspendu. Au retour, la rumeur revient en fondu au
     niveau voulu — ce que la page a demandé pendant l'absence compris. */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      arreterChant();
      eteindreLit(0);
      poserVolume();
      if (ctx?.state === 'running') ctx.suspend().catch(() => {});
    } else if (ctx && !calme()) {
      ctx.resume().catch(() => {});
      poserVolume();
      appliquer();
    }
  });

  window.addEventListener('storage', (e) => {
    if (e.key !== CLE_VOLUME && e.key !== null) return;
    volumeJoueur = lireVolume();
    poserVolume();
  });

  /**
   * Le volume du joueur, de 0 à 1. Sans argument, le rend ; avec, le règle,
   * le retient (« tbf-volume ») et l'annonce (événement « tbf-volume » sur la
   * fenêtre, pour que le tiroir d'un autre écran se recale).
   */
  function volume(v) {
    if (v === undefined || v === null || v === '') return volumeJoueur;
    const n = Number(v);
    if (!Number.isFinite(n)) return volumeJoueur;
    volumeJoueur = borner(n);
    try { localStorage.setItem(CLE_VOLUME, String(volumeJoueur)); } catch { /* vaut pour la page */ }
    poserVolume();
    window.dispatchEvent(new CustomEvent('tbf-volume', { detail: volumeJoueur }));
    return volumeJoueur;
  }

  /* ============================================== la façade de cartes.js

     L'objet « audio » de cartes.js, mêmes noms et mêmes signatures :
     cartes.js lui confie chaque son, lu au moment du son (ce script-ci
     arrive après lui). Ses sons sont dans la banque, mixés comme les
     autres.

     Qui l'appelle, depuis les lots 3 et 5 : le kiosque pour la déchirure
     (« rip ») et le retournement (« flip ») — sa révélation passe toute par
     FX.reveler, qui a ses propres sons (tic, carillon, rugissement) — ; la
     collection pour « flip », « chime » et « roar ». « chime » et « roar »
     n'ont plus qu'elle, et pourront partir quand elle passera à
     FX.reveler (son:smoke les attend encore dans la façade : la retouche
     se fera des deux côtés). */
  const AUDIO = {
    /** Ouvre le contexte (au geste) ; le rend, ou rien sous le calme. */
    ready: () => ouvrir(),
    /** Le papier alu qu'on déchire ; « intensite » suit le geste. */
    rip: (intensite = 1) => { jouer('dechirure', { intensite }); },
    /** La carte qui se retourne. */
    flip: () => { jouer('retournement'); },
    /** L'accord d'une carte rare : plus riche pour une légendaire. */
    chime: (rar) => {
      if (rar === 'legendaire') jouer('accord-legendaire');
      else if (rar === 'epique') jouer('accord-epique');
    },
    /** Le grondement de tribune d'une couronne. */
    roar: () => { jouer('grondement'); },
  };

  /* ===================================================== le rendu hors ligne

     Pour le banc et la suite (scripts/son-banc.mjs, scripts/son-smoke.mjs) :
     rend hors ligne, à travers la chaîne complète et à volume plein, un son,
     plusieurs ensemble, un niveau d'ambiance, un chant ou un sinus de
     contrôle, et rend le tampon. Le hasard repart de la graine donnée : deux
     rendus du même son sont identiques. */
  const DEBUT_RENDU = 0.02;
  async function rendre(quoi = {}, { duree = 2, frequence = 48000, graine: g = 1 } = {}) {
    const OAC = window.OfflineAudioContext ?? window.webkitOfflineAudioContext;
    if (typeof OAC !== 'function') return null;
    graine = (Number(g) >>> 0) || 1;
    const c = new OAC(2, Math.ceil(frequence * duree), frequence);
    const ch = construireChaine(c, 1);
    const t = DEBUT_RENDU;
    if (Number.isFinite(quoi.sinus)) {
      const o = c.createOscillator();
      o.frequency.value = 997;
      const a = c.createGain();
      a.gain.value = 10 ** (quoi.sinus / 20);
      o.connect(a).connect(ch.maitre);
      o.start(t);
    }
    for (const nom of [quoi.son, ...(quoi.sons ?? [])].filter(Boolean)) {
      if (existe(nom)) jouerDans(c, ch, nom, quoi.options, t);
    }
    if (quoi.ambiance) {
      const n = Math.round(borner(Number(quoi.ambiance), 1, 3));
      const lit = construireLit(c, ch.bus.ambiance);
      reglerLit(lit, n, 0, 0);
      // Les éclats, au rythme du niveau, comme le jeu les tire.
      const pas = NIVEAUX_AMBIANCE[n].eclats / 1000;
      for (let x = t + pas * (0.5 + alea()); x < duree - 0.7; x += pas * (0.5 + alea())) {
        eclats(c, lit.eclats, x, 1 + Math.floor(alea() * (n >= 2 ? 3 : 1.6)));
      }
    }
    if (quoi.chant) {
      const plan = planDuChant(quoi.chant, quoi);
      if (plan && plan.n !== Infinity) {
        const v = voixDuChant(c, ch.bus.effets);
        // « voix » : une seule des deux voix, pour mesurer leur équilibre.
        for (let i = 0; i < plan.n; i++) {
          for (const f of plan.frappesDu(i)) if (!quoi.voix || f.voix === quoi.voix) frapper(c, v, f, t);
        }
      }
    }
    return c.startRendering();
  }

  /** Ce que le moteur fait en ce moment : pour la suite, et pour qui cherche. */
  const etat = () => ({
    contexte: ctx ? ctx.state : 'absent',
    geste: vuGeste,
    ambiance: { base: amb.base, passager: amb.passe?.niveau ?? 0, voulu: voulu(), joue: amb.lit ? amb.joue : 0 },
    chant: Boolean(chantEnCours),
    volume: volumeJoueur,
  });

  window.TBF_SON = {
    jouer,
    ambiance,
    chant,
    arreterChant: () => arreterChant(),
    volume,
    ouvrir,
    audio: AUDIO,
    /** Ce son existe-t-il dans la banque ? */
    existe,
    /** Les noms de la banque. */
    noms: () => Object.keys(BANQUE),
    /** Les types de chant. */
    chants: () => Object.keys(CHANTS),
    etat,
    rendre,
    /* Le mixage tel que le banc le mesure et que la suite le vérifie : les
       familles et leurs fenêtres, la famille et les variantes de chaque son,
       les fenêtres de l'ambiance, les crêtes plafonds. Copies : rien ici ne
       se règle de l'extérieur. */
    mixage: () => ({
      familles: JSON.parse(JSON.stringify(FAMILLES)),
      sons: Object.fromEntries(Object.entries(BANQUE).map(([nom, s]) => [nom,
        { famille: s.famille, bus: s.bus ?? FAMILLES[s.famille].bus, duree: s.duree,
          variantes: s.variantes ?? [], gain: MIX[nom] ?? 1 }])),
      ambiance: NIVEAUX_AMBIANCE.map((N) => N.fenetre),
      creteSeule: CRETE_SEULE,
      creteMax: CRETE_MAX,
      limiteur: { ...LIMITEUR },
    }),
  };
})();
