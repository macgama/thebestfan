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
 *   TBF_SON.rumeur(moment, o)     la rumeur qui suit le match, par son nom :
 *                                 l'entrée, le jeu, la mi-temps, la minute
 *                                 double, le but, la fin, le vestiaire du
 *                                 duel et ses arrivées (lot 6)
 *   TBF_SON.chant(type, o)        des frappes de tambour et des claps de
 *                                 foule calés sur la pulsation d'un geste ;
 *                                 `origine` les cale sur l'instant même où
 *                                 le geste a commencé (lot 6)
 *   TBF_SON.chantDuGeste(g, gestes, o)  le chant d'un geste de rythme, sur
 *                                 les durées que le serveur a servies et la
 *                                 pulsation que `geste.js` dessine
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
 *   — **aucun fichier audio pour ce qui doit tomber pile** : un son
 *     téléchargé se joue en retard la première fois, exactement quand il
 *     compte. Deux sons seulement viennent d'un fichier (voir « la tribune
 *     enregistrée ») : la rumeur, qui n'a pas d'instant, et la clameur du
 *     but, qui ne joue que déjà décodée — sinon la synthèse les remplace ;
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
     la mesure du banc à volume plein, **chaîne chaude**, le 4 octobre 2026 :
     crête (dBFS) · sonie (LUFS, 100 ms) · durée.

     **Recalés le 4 octobre 2026 (lot 6).** Le banc mesurait chaque son
     limiteur encore fermé, au tout début du rendu (voir CHAUFFE, au rendu
     hors ligne) : les sons brefs y sortaient six à huit décibels sous ce que
     le joueur entend. Les gains tirés de ces mesures faisaient donc sonner,
     en jeu, l'interface dans la fenêtre du jeu (le tic à −21,2 LUFS, pas
     −29,5), le jeu dans celle des moments (la poussée à −16,4), et le but
     encaissé (−14,3) et la charge (−14,9) au-dessus du but (−15,5). Chaque
     gain qui avait bougé de deux dixièmes de décibel ou plus a été ramené à
     la sonie que le mixage lui donnait : 10 ^ ((mesure froide − mesure
     chaude) / 20) ; la poussée, que le limiteur tassait déjà chaîne chaude
     (crête −5,4), en deux fois. Les sept qui n'ont pas bougé sont des sons
     longs, dont les cent millisecondes les plus fortes tombaient déjà
     limiteur ouvert. Gains d'avant : tic 5,54 · carte 3,67 · bâche 1,7 ·
     sourd 3,66 · ok 0,966 · retournement 2,45 · poussée 4,6 · contre 5 ·
     chant 4,47 · parfait 1,77 · déchirure 1,99 · carillon 1,17 · accord
     épique 0,623 · gong 0,776 · encaissé 4,75 · charge 5,15 · rugissement
     4,15. */
  const MIX = {
    tic: 2.13,                    // −20,0 · −29,5 · 0,03 s
    carte: 1.55,                  // −20,9 · −29,0 · 0,07 s
    bache: 0.862,                 // −19,7 · −28,0 · 0,14 s
    sourd: 1.51,                  // −15,9 · −28,5 · 0,06 s
    ok: 0.708,                    // −21,5 · −28,0 · 0,16 s
    retournement: 1.07,           // −16,9 · −28,5 · 0,08 s
    pousse: 1.99,                 // −10,7 · −22,1 · 0,12 s
    contre: 2.45,                 // −12,9 · −23,4 · 0,14 s
    chant: 2.27,                  // −14,0 · −22,0 · 0,16 s
    parfait: 1.56,                // −14,9 · −20,5 · 0,31 s
    dechirure: 1.39,              // −16,2 · −21,5 · 0,27 s (à 1 ; de −23,1 à 0,22 à −21,0 à 1,4 : la banque)
    carillon: 1.13,               // −17,4 · −21,0 · 0,67 s
    'accord-epique': 0.581,       // −16,1 · −21,0 · 1,03 s
    gong: 0.589,                  // −12,9 · −21,0 · 1,53 s
    but: 3.93,                    //  −8,3 · −15,5 · 0,67 s
    butReel: 4.13,                //  −7,7 · −15,0 · 0,76 s
    encaisse: 3.10,               // −11,3 · −18,0 · 0,51 s
    charge: 3.60,                 // −11,8 · −18,0 · 0,74 s
    evolue: 1.95,                 // −10,1 · −15,5 · 0,81 s
    rugissement: 3.18,            // −10,0 · −15,5 · 0,87 s
    'accord-legendaire': 0.841,   //  −9,6 · −15,4 · 1,35 s
    grondement: 3.02,             //  −8,1 · −16,5 · 1,80 s
    niveau: 1.65,                 //  −8,6 · −16,1 · 1,15 s
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
     joués ensemble ressortent à −4,7 dBFS (chaîne chaude, 4 octobre 2026). */
  const LIMITEUR = { seuil: -6, ratio: 20, attaque: 0.002, relache: 0.2 };
  const RATTRAPAGE_DB = 0.6 * -LIMITEUR.seuil * (1 - 1 / LIMITEUR.ratio);

  /* **La naissance de la chaîne** (lot 6). Le compresseur de Chrome naît
     fermé (voir CHAUFFE, au rendu hors ligne) : son détecteur part de zéro,
     il écrase tout ce qui passe, et ne s'ouvre qu'à la vitesse de sa
     relâche, deux dixièmes de seconde. Or le contexte vivant naît au premier
     toucher, et le son de ce toucher part dans le même instant : le premier
     son d'une visite sortait fermé. Mesuré le 4 octobre 2026, dans Chrome,
     sur la sortie même, cinq visites : le tic joué dans le geste qui fait
     naître le contexte à −33,1 dBFS de crête, puis −20,0 tous les suivants —
     treize décibels sous la banque, un son qu'on n'entend pas (et c'est la
     déchirure du booster quand la visite commence au kiosque). Hors ligne,
     depuis la naissance : le tic posé 20 ms après à −27,8, 40 ms après à
     −24,6, 80 ms après à −21,7, une seconde après à −19,9 ; un sinus à
     −20 dB, −25,7 sur ses cinquante premières millisecondes.

     Le remède : une relâche de deux millisecondes à la naissance, rendue à
     LIMITEUR.relache soixante millisecondes plus tard. Le détecteur s'ouvre
     alors en quelques millisecondes au lieu de deux cents, et le limiteur
     garde ensuite son pas. Mesuré pareil : hors ligne, le tic posé 20 ms
     après la naissance sort à −20,1, le sinus à −20,0 dès ses cinquante
     premières millisecondes ; dans Chrome, cinq visites, le premier tic à
     −21,0 et les suivants à −20,0 (le début de son attaque passe pendant que
     le détecteur s'ouvre). Ce que ça coûte : pendant ces soixante
     millisecondes, un empilement relâcherait vite entre deux crêtes — tous
     les moments de la banque ensemble, posés à la naissance, sortent à
     −2,7 dBFS au lieu de −4,6 —, et le plafond le tient sous CRETE_MAX.
     Aucun écran ne joue tous ses moments au premier toucher. `son:smoke` et
     `son:banc` le mesurent (« la naissance »). */
  const NAISSANCE = { relache: 0.002, duree: 0.06 };

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
    /* Brève à la naissance, puis la sienne (voir NAISSANCE). Un navigateur
       qui refuserait de programmer ce paramètre garde la relâche ordinaire :
       une exception ici emporterait toute la chaîne, donc tout le son. */
    try {
      lim.release.setValueAtTime(NAISSANCE.relache, c.currentTime);
      lim.release.setValueAtTime(LIMITEUR.relache, c.currentTime + NAISSANCE.duree);
    } catch { lim.release.value = LIMITEUR.relache; }
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

  /**
   * Fait partir une source, et la retient tant qu'elle sonne si elle joue
   * dans le contexte vivant (pas dans un rendu du banc).
   *
   * **Pourquoi la retenir.** L'onglet caché et le calme suspendaient le
   * contexte sans rien arrêter : une ovation de cinq secondes, une corne, un
   * gong restaient en pause au milieu, et reprenaient là où ils étaient au
   * retour de l'onglet ou à la levée du calme — parfois des minutes plus
   * tard, sur un écran passé à autre chose (le coup de sifflet final). Un
   * son ponctuel appartient à son instant : « couperPonctuels » arrête tout
   * ce qui est retenu ici avant de suspendre.
   */
  function lancer(c, src, quand, ...reste) {
    src.start(quand, ...reste);
    if (c !== ctx) return;
    enCours.add(src);
    src.addEventListener('ended', () => enCours.delete(src), { once: true });
  }

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
    lancer(c, o, t0);
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
    lancer(c, src, t0, marge > 0 ? alea() * marge : 0, Math.min(duree, b.duration));
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
    lancer(c, o, t);
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
    lancer(c, o, t);
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
    lancer(c, src, t, alea() * (b.duration - 0.3), 0.25);
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
       suit le geste : le doigt qui tire la fait monter (0,22 à 0,72, un cran
       tous les neuf pour cent du glissé), la déchirure finale vaut 1,4. Les
       variantes sont ces intensités-là, celles que le kiosque joue vraiment,
       et le banc juge chacune contre la fenêtre du jeu.

       **Toutes dans la fenêtre du jeu.** L'amplitude et la durée suivaient
       l'intensité en droite ligne, et la sonie avec elles, de −44,7 LUFS à
       0,22 — sous le plancher de l'interface, plus bas qu'un tic — à −17,9 à
       1,4, dans la fenêtre des moments, plus fort que le but encaissé (mesures
       du relecteur, le 3 octobre 2026 : 0,22 → −44,7 · 0,4 → −35,0 ·
       0,58 → −29,4 · 0,72 → −26,4 · 1 → −22,0 · 1,4 → −17,9). Le banc ne
       jugeait que l'intensité 1, qu'aucune page ne joue. Désormais la montée
       tient en trois décibels : la durée d'un cran va de 0,21 s (0,22) à
       0,32 s (1,4) et l'amplitude ne suit l'intensité que de loin (puissance
       0,08). Un cran trop court perd sa sonie bien plus vite que son
       amplitude — sur cent millisecondes, un bruit de six centièmes n'en
       remplit que la moitié, et il s'éteint en route —, c'est donc la durée
       qui porte l'élan, et l'amplitude ne fait que l'appuyer.

       Le gain (MIX) et les sonies visées en ont été **calculés** : la sonie
       suit l'amplitude au décibel près, et l'effet de la durée se lit, point
       par point, sur les mesures ci-dessus (la forme de l'enveloppe et le
       balayage du filtre n'ont pas changé). Visé : 0,22 → −23,9 · 0,47 →
       −23,0 · 0,72 → −22,2 · 1 → −21,5 · 1,4 → −20,9, à près d'un décibel
       des bords de la fenêtre. **Le banc l'a confirmé** le 4 octobre 2026
       (lot 6) : −23,9 · −22,8 · −22,1 · −21,5 · −20,8. Sa mesure remplace
       l'estimation dans le commentaire de MIX. Remesurées chaîne chaude
       (voir CHAUFFE, le même jour) et recalées sur l'intensité 1 : −23,1 ·
       −22,3 · −21,9 · −21,5 · −21,0 — la montée se resserre (les crans
       brefs perdaient le plus à la mesure froide), et tient la fenêtre. */
    dechirure: { famille: 'jeu', duree: 0.45,
      variantes: [{ intensite: 0.22 }, { intensite: 0.47 }, { intensite: 0.72 }, { intensite: 1.4 }],
      jouer: (c, s, t, { intensite = 1 } = {}) => {
        const i = borner(Number(intensite) || 0, 0.05, 1.6);
        const d = 0.19 + 0.09 * i;
        const a = 0.22 * i ** 0.08;
        const courbe = new Float32Array(24);
        for (let k = 0; k < courbe.length; k++) {
          courbe[k] = a * (1 - k / (courbe.length - 1)) ** 1.6;
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
       le bus de l'ambiance. Le calme et l'onglet caché l'arrêtent net, comme
       tout son en cours (« couperPonctuels ») : suspendue au milieu, elle
       reprenait au retour, cinq secondes de tribune sur un autre écran. */
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
        lancer(c, src, t, alea() * r.duration);
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
      lancer(c, o, t0);
      o.stop(t0 + 1.2);
    });
  }

  /** Joue un son de la banque dans un contexte et une chaîne donnés.
      `fichiers` : les sons enregistrés décodés pour ce contexte — la
      clameur, si elle l'est, remplace l'ovation synthétisée. */
  function jouerDans(c, ch, nom, options, t, fichiers = null) {
    if (nom === 'ovation' && fichiers?.clameur) { clameur(c, ch, fichiers.clameur, t); return; }
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
     jouer.

     **Un geste, c'est le joueur, et c'est le navigateur qui le dit.** Le
     moteur comptait pour « premier geste » n'importe quel événement de la
     liste, et le Virage en lance un lui-même au chargement : l'entrée par un
     lien (/virage?match=…) déplie la carte du match par un clic de script.
     Le contexte naissait alors sans activation, suspendu ; chaque son
     demandé ensuite s'y posait sur une horloge arrêtée — la fanfare de
     niveau, la corne, l'ovation, la rumeur —, chaque appel relançait une
     reprise refusée (un avertissement en console par seconde de Virage), et
     au premier vrai toucher tout partait d'un coup. Échap, que Chrome ne
     compte pas comme une activation, faisait de même. Désormais : un
     événement lancé par script (« isTrusted » faux) ne compte pas, et le
     contexte ne naît que pendant une activation en cours, celle que le
     navigateur tient (« navigator.userActivation ») — sans quoi il ne
     pourrait pas démarrer. */
  let ctx = null;
  let chaine = null;
  let vuGeste = false;
  let dernierGeste = -Infinity;

  /**
   * Le joueur est-il en train d'agir, au sens du navigateur ? C'est la seule
   * condition sous laquelle un contexte démarre partout (Safari demande que
   * la création ou la reprise tombe dans un geste). Sans l'API — un Safari
   * d'avant 16.4 —, le dernier geste reconnu ici, il y a moins d'une
   * seconde : la fenêtre la plus courte que tiennent les navigateurs.
   */
  function activationEnCours() {
    const ua = navigator.userActivation;
    if (ua && typeof ua.isActive === 'boolean') return ua.isActive;
    return performance.now() - dernierGeste < 1000;
  }

  /* Les sources ponctuelles qui sonnent en ce moment dans le contexte
     vivant (voir « lancer » et « couperPonctuels »). */
  const enCours = new Set();

  function ouvrir() {
    if (calme()) return null;
    if (ctx && ctx.state === 'closed') { ctx = null; chaine = null; enCours.clear(); }
    if (!ctx) {
      // Hors d'un geste, un contexte naîtrait suspendu : on attend le suivant.
      if (!vuGeste || !activationEnCours()) return null;
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

  /* Les touches qu'aucun navigateur ne compte pour une activation : lues
     seulement sans « navigator.userActivation », qui sait le dire lui-même. */
  const PAS_UN_GESTE = new Set(['Escape', 'Shift', 'Control', 'Alt', 'Meta', 'AltGraph', 'CapsLock']);

  function geste(e) {
    // Un clic ou une touche lancés par un script ne sont pas le joueur.
    if (!e.isTrusted) return;
    // La souris compte au bouton enfoncé ; le doigt, au doigt levé.
    if (e.type === 'pointerdown' && e.pointerType && e.pointerType !== 'mouse') return;
    /* Et un événement que le navigateur ne compte pas pour une activation
       (Échap, une touche de modification seule) n'ouvre rien : le
       navigateur l'a déjà décidé avant que l'événement n'arrive ici. */
    const ua = navigator.userActivation;
    if (ua && typeof ua.isActive === 'boolean' ? !ua.isActive
      : e.type === 'keydown' && PAS_UN_GESTE.has(e.key)) return;
    vuGeste = true;
    dernierGeste = performance.now();
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

  /* **Rien ne se pose sur une horloge arrêtée.** Un contexte qui ne tourne
     pas — suspendu par le navigateur, ou pas encore repris au retour de
     l'onglet — ne joue rien, mais il garde ce qu'on lui confie : tout
     partirait d'un coup à sa reprise, sur un écran passé à autre chose. On
     ne lui confie donc un son que s'il tourne, ou si le joueur est en train
     d'agir : un contexte qui vient de naître dans un geste n'est pas encore
     « running » (il le devient un instant plus tard), et son premier son,
     celui du toucher même, doit partir. */
  const pretAJouer = (c) => c.state === 'running' || activationEnCours();

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
    if (!pretAJouer(c)) return false;
    const maintenant = performance.now();
    const cle = options ? `${nom} ${JSON.stringify(options)}` : nom;
    if (maintenant - (derniers.get(cle) ?? -1e9) < ANTI_DOUBLON) return false;
    // Une déchirure par intensité : la table se vide avant de grossir.
    if (derniers.size > 64) derniers.clear();
    derniers.set(cle, maintenant);
    try {
      jouerDans(c, chaine, nom, options, c.currentTime, { clameur: pret(c, 'clameur') });
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
     moyen entre deux éclats de voix (ms) et leur force, la fenêtre de sa
     sonie moyenne (LUFS, mesurée sur huit secondes), et s'il doit rester
     sous l'interface.

     **Sous l'interface, crête comprise.** La rumeur ne doit jamais couvrir
     un tic, sauf au but. Le banc ne le vérifiait que sur la moyenne de huit
     secondes ; sur cent millisecondes, au niveau 2 — la règle du Virage,
     cinq secondes après chaque chant et toute la minute double —, la rumeur
     montait à −30,3 LUFS, dans la fenêtre de l'interface et à un décibel du
     tic (−29,5), son formant de voix posé sur la fondamentale du tic
     (1 150 contre 1 200 Hz). Ce qui faisait la crête : la respiration
     (au niveau 2, un tiers de la couche des voix, qui culmine au bout de
     trois secondes) bien plus que les éclats. Désormais, aux niveaux 1 et 2,
     la sonie sur cent millisecondes se tient sous le plancher de
     l'interface moins MARGE_RUMEUR (−33 LUFS), et le banc le juge : la
     respiration du niveau 2 passe d'un tiers à un huitième (une tribune qui
     pousse pousse sans relâche), les couches des niveaux 1 et 2 baissent
     d'environ trois décibels et leurs éclats autant. Le formant, lui, reste
     où il est : déplacé sans que le banc puisse le rendre, il changerait la
     sonie de la rumeur d'une quantité qu'aucun calcul ne donne, et c'est
     l'écart de niveau — plus de quatre décibels sous le tic — qui protège
     l'interface.

     Mesures du banc avant ce changement, le 2 octobre 2026 (moyenne ·
     sonie) : 1 → −37,1 · −34,8 ; 2 → −32,4 · −30,3 ; 3 → −27,5 · −26,2.
     Visé après, **calculé** à partir d'elles (le gain est exact en
     décibels, la respiration se calcule sur la fenêtre du banc), à
     remesurer : 1 → −40 · −37,7 ; 2 → −35,1 · −34 ; 3 inchangé. Quatre à
     cinq décibels du niveau 1 au niveau 2, assez pour qu'une poussée
     s'entende ; huit du 2 au but, qui seul passe au-dessus de l'interface.
     Remesuré chaîne chaude le 4 octobre 2026 : 1 → −40,0 · −37,7 ; 2 →
     −35,1 · −33,6 ; 3 → −27,5 · −26,2. */
  const NIVEAUX_AMBIANCE = [
    { grave: 0, voix: 0, clair: 0, souffle: 0, voixHz: 450, eclats: 0, eclat: 0, fenetre: null,
      sousInterface: false },
    { grave: 0.215, voix: 0.158, clair: 0, souffle: 0.3, voixHz: 480, eclats: 9000, eclat: 0.7,
      fenetre: [-42.5, -37.5], sousInterface: true },
    { grave: 0.329, voix: 0.306, clair: 0.061, souffle: 0.12, voixHz: 600, eclats: 4500, eclat: 0.7,
      fenetre: [-37.5, -32.5], sousInterface: true },
    { grave: 0.64, voix: 0.64, clair: 0.32, souffle: 0.15, voixHz: 760, eclats: 1600, eclat: 1,
      fenetre: [-30, -25], sousInterface: false },
  ];
  /** La marge de la rumeur sous le plancher de l'interface, en décibels :
      deux décibels d'écart se lisent « plus bas », un seul « pareil ». */
  const MARGE_RUMEUR = 2;
  /** Le gain de sortie de la rumeur. */
  const MIX_AMBIANCE = 0.3;
  /* Les transitions : on monte vite (une poussée s'entend tout de suite), on
     redescend lentement (une tribune ne se tait pas d'un coup), et le but
     arrive presque d'un coup. Ce sont des constantes de temps : la cible est
     atteinte aux deux tiers après une fois, presque entièrement après trois. */
  const TAU = { monte: 0.6, descend: 1.6, but: 0.15, creux: 2.5 };
  /** Combien de temps la tribune reste au maximum après un but. */
  const TENUE_BUT = 9000;

  /* ------------------------------------------ l'échelle de la rumeur (lot 6)

     Le niveau dit **comment** la tribune chante (la rumeur, la poussée, le
     but) ; l'échelle dit **combien** elle est pleine. Un seul gain, sur la
     sortie de la rumeur, qui ne fait que la baisser : 1 la tribune entière,
     moins quand elle se creuse ou n'est pas encore remplie. Les fenêtres et
     les plafonds que le banc mesure à l'échelle 1 restent donc des plafonds
     — une rumeur plus basse ne couvre jamais rien — et seule la retombée
     elle-même est à éprouver (son:smoke la mesure).

       CREUX       la mi-temps : la tribune retombe, sans se vider. Huit
                   décibels sous la rumeur, assez pour qu'on entende la pause
                   (deux décibels se lisent « plus bas », huit « autre
                   chose »), pas assez pour qu'elle passe pour la fin ;
       VESTIAIRE   le vestiaire du duel, vide : neuf décibels sous la
                   rumeur, qui remonte à l'échelle pleine place par place.

     L'ovation et les sons de la banque n'y passent pas : ils sonnent au
     vestiaire comme en tribune. */
  const CREUX = 0.4;            // 20 × log10(0,4) = −8,0 dB
  const VESTIAIRE_VIDE = 0.35;  // 20 × log10(0,35) = −9,1 dB
  /** Ce qu'une arrivée au vestiaire fait enfler la rumeur, en millisecondes. */
  const ARRIVEE_MS = 2500;
  /** Ce que dure, par défaut, la foule qui compte à l'entrée. */
  const ENTREE_MS = 1500;
  /** Ce que met la tribune à se vider au coup de sifflet final. */
  const FIN_MS = 6000;
  /** La minute double, au plus (le contrat la sert en `surgeMs`, R3). */
  const DOUBLE_MS = 60000;

  /* ================================================ la tribune enregistrée

     **Deux sons viennent d'un fichier, et deux seulement** (6 octobre 2026,
     choisis par Gaël à l'écoute de `art/son/_src/artlist/A-ECOUTER.md`) :
     la rumeur de la tribune (deux prises de stade, nuit et jour, mêlées en
     une boucle de douze secondes) et la clameur du but, qui remplace
     l'ovation synthétisée. Les mesures et la méthode sont dans ce document ;
     ce qui suit en est l'application.

     **La règle d'en-tête tient, amendée.** Un fichier se joue en retard la
     première fois : il ne sert donc que là où rien n'attend l'instant. La
     rumeur n'a pas d'instant — qu'elle arrive une demi-seconde plus tard ne
     manque à personne, et la synthèse joue tant que le fichier n'est pas
     prêt. La clameur en a un, le but : elle ne joue que si son fichier est
     **déjà décodé** quand le but tombe ; sinon, c'est l'ovation synthétisée.
     Les frappes des chants restent synthétisées (la frappe enregistrée mêle
     tambour et claps, que trois motifs sur cinq séparent).

     **Rien ne se télécharge** sous le calme, en « économie de données », ni
     sur une page qui ne demande pas d'ambiance : le premier appel à
     `ambiance(n ≥ 1)` ou à `rumeur()` lance le téléchargement — sans geste,
     un `fetch` n'en demande pas —, le décodage attend le contexte du premier
     toucher. Un fichier absent, ou qu'un navigateur refuse de décoder,
     laisse la synthèse jouer pour toute la page, sans rien signaler : le son
     ne doit jamais casser le jeu.

     **Les noms portent une empreinte** (les huit premiers caractères du
     SHA-1 du fichier) : ce qui est gardé ne change plus d'adresse, et le
     serveur sert `/son` un an. Opus d'abord ; le repli (AAC pour la rumeur,
     MP3 pour la clameur) pour un Safari qui ne décode pas l'Opus. */
  const FICHIERS = {
    rumeur: { opus: '/son/ambiance-tribune.84ff833c.ogg', repli: '/son/ambiance-tribune.70e5801e.m4a' },
    clameur: { opus: '/son/clameur-but.3a391fd2.ogg', repli: '/son/clameur-but.c2a59d53.mp3' },
  };
  /* La boucle de la rumeur, en échantillons à 48 kHz : [marge 0,25 s |
     boucle 12 s | marge 0,25 s], et le fondu de reprise (50 ms). Les marges
     sont cycliques (la fin de la boucle, puis son début) : elles absorbent le
     décalage d'un décodeur AAC qui ignore la liste d'éditions (1 024 à 2 112
     échantillons), et la queue sert au fondu. */
  const BOUCLE = { P: 12000, L: 576000, X: 2400 };
  /* Le gain de la rumeur enregistrée par niveau, en décibels. Le fichier est
     nivelé à −40,0 LUFS de sonie moyenne, celle de la rumeur synthétisée au
     niveau 1 : il se joue au gain 1, **sans MIX_AMBIANCE**, et monte des
     écarts que la synthèse tient entre ses niveaux (+4,9 au 2, +12,5 au but).
     Mesuré dans A-ECOUTER.md : niveau 2, −34,0 LUFS sur 100 ms (plafond
     −33) ; niveau 3, −27,5 de moyenne, crête −17,0 dBFS. Le banc le remesure
     (« rumeur-enregistree-n »). Pas d'éclats de voix par-dessus : la foule
     enregistrée crie d'elle-même, et des éclats feraient monter la sonie du
     niveau 2, à un décibel de son plafond. */
  const RUMEUR_DB = [null, 0, 4.9, 12.5];
  const gainRumeur = (n) => (n > 0 ? 10 ** (RUMEUR_DB[n] / 20) : 0);
  /* La clameur, sur le bus de l'ambiance comme l'ovation qu'elle remplace :
     −16,4 LUFS sur 100 ms contre −16,5, crête −7,4 dBFS (le MP3 de repli,
     un demi-décibel plus bas). Gain 1 : le banc la juge dans la fenêtre des
     moments (« clameur »). */
  const MIX_CLAMEUR = 1;
  /** Le passage de la rumeur synthétisée à l'enregistrée, en secondes. */
  const PASSAGE = { tau: 0.6, demontage: 3 };

  /** Les formats que ce navigateur lira, Opus d'abord. */
  function formats() {
    let opus = '';
    try { opus = document.createElement('audio').canPlayType('audio/ogg; codecs="opus"'); } catch { /* rien */ }
    return opus ? ['opus', 'repli'] : ['repli'];
  }
  const sansDonnees = () => Boolean(navigator.connection?.saveData);
  const recuperer = (url) => fetch(url).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null);

  /* Les octets, téléchargés une fois par page : `nom` → Promise<[format,
     octets] | null>. Le repli n'est téléchargé que si le premier manque :
     un navigateur ne prend qu'un fichier. */
  const octets = new Map();
  function telecharger(nom) {
    if (octets.has(nom)) return octets.get(nom);
    if (calme() || sansDonnees() || typeof fetch !== 'function') return null;
    const [premier, second] = formats();
    const f = FICHIERS[nom];
    const p = recuperer(f[premier]).then((o) => (o ? [premier, o]
      : second ? recuperer(f[second]).then((r) => (r ? [second, r] : null)) : null));
    octets.set(nom, p);
    return p;
  }
  /** Les deux fichiers, si la page demande une tribune. */
  function prefetch() {
    if (voulu() < 1) return;
    telecharger('rumeur');
    telecharger('clameur');
  }

  /* Le décodage, par la forme à rappels : la seule que connaissent les
     anciens Safari (`webkitAudioContext`). Une copie : `decodeAudioData`
     détache le tampon qu'on lui donne, et un second contexte (le banc)
     décode les mêmes octets. */
  const decoder = (c, o) => new Promise((ok) => {
    try {
      const p = c.decodeAudioData(o.slice(0), ok, () => ok(null));
      p?.catch?.(() => ok(null));
    } catch { ok(null); }
  });
  /** Décode `nom` pour ce contexte : l'Opus refusé (un Safari qui l'annonce
      sans le décoder), on tente le repli. */
  async function decoderPour(c, nom, preparer) {
    const t = await telecharger(nom);
    if (!t) return null;
    const [format, o] = t;
    let b = await decoder(c, o);
    if (!b && format === 'opus') {
      const r = await recuperer(FICHIERS[nom].repli);
      b = r ? await decoder(c, r) : null;
    }
    return b ? preparer(b) : null;
  }

  /* Ce qui est décodé, par contexte : contexte → nom → { fini, valeur,
     promesse }. Le tampon reste tant que le contexte vit : au retour du
     calme ou de l'onglet, la rumeur repart sans rien retélécharger ni
     redécoder. */
  const decodes = new WeakMap();
  const PREPARER = { rumeur: (b) => preparerBoucle(b), clameur: (b) => b };
  function charger(c, nom) {
    let m = decodes.get(c);
    if (!m) { m = new Map(); decodes.set(c, m); }
    if (!m.has(nom)) {
      if (!telecharger(nom)) return null;
      const e = { fini: false, valeur: null, promesse: null };
      e.promesse = decoderPour(c, nom, PREPARER[nom])
        .catch(() => null)
        .then((v) => { e.valeur = v; e.fini = true; return v; });
      m.set(nom, e);
    }
    return m.get(nom);
  }
  /** Le son décodé pour ce contexte, s'il l'est déjà ; rien sinon. */
  const pret = (c, nom) => decodes.get(c)?.get(nom)?.valeur ?? null;

  /* La boucle : le fondu de reprise posé **dans le tampon décodé**, puis
     joué entre `loopStart` et `loopEnd`. Le fichier se décode à la fréquence
     du contexte (44,1 kHz sur bien des téléphones) : les bornes se
     recalculent et s'arrondissent à l'échantillon. Les X premiers
     échantillons de la boucle sont fondus avec ce qui suit sa fin, dans la
     marge de queue, que le fondu ne touche pas.

     Trois interdits, chiffrés dans A-ECOUTER.md : jamais `loop` sans
     `loopStart`/`loopEnd` (un clic toutes les 12,5 s, la plus forte fenêtre
     du tour) ; jamais de boucle sans le fondu ; jamais les deux méthodes
     mêlées (un tampon fondu joué avec loopStart à 0,25 s : un clic, et une
     boucle de 11,75 s). */
  function preparerBoucle(t) {
    const k = t.sampleRate / 48000;
    const p = Math.round(BOUCLE.P * k), l = Math.round(BOUCLE.L * k), x = Math.round(BOUCLE.X * k);
    if (t.length < p + l + x) return null;      // un fichier tronqué : la synthèse reste
    for (let ch = 0; ch < t.numberOfChannels; ch++) {
      const d = t.getChannelData(ch);
      for (let i = 0; i < x; i++) {
        const w = 0.5 - 0.5 * Math.cos(Math.PI * (i + 0.5) / x);   // w + (1 − w) = 1
        d[p + i] = d[p + i] * w + d[p + l + i] * (1 - w);
      }
    }
    return { tampon: t, debut: p / t.sampleRate, fin: (p + l) / t.sampleRate };
  }

  /** Le lit enregistré : une source en boucle, le gain du niveau, puis
      l'échelle (la mi-temps, le vestiaire), sur le bus de l'ambiance. */
  function construireLitEnregistre(c, dest, r, echelle = 1) {
    const sortie = c.createGain();
    sortie.gain.value = echelle;
    sortie.connect(dest);
    const niveau = c.createGain();
    niveau.gain.value = 0;
    niveau.connect(sortie);
    const s = c.createBufferSource();
    s.buffer = r.tampon;
    s.loop = true;
    s.loopStart = r.debut;
    s.loopEnd = r.fin;
    s.connect(niveau);
    // Un départ au hasard dans la boucle : chaque visite n'entend pas la même seconde.
    s.start(c.currentTime, r.debut + alea() * (r.fin - r.debut));
    return { enregistre: true, mix: 1, sortie, niveau, sources: [s] };
  }

  /** La clameur du but, à la place de l'ovation : une source, lancée par
      « lancer » pour que le calme et l'onglet caché l'arrêtent. */
  function clameur(c, ch, b, t) {
    const g = c.createGain();
    g.gain.value = MIX_CLAMEUR;
    g.connect(ch.bus.ambiance);
    const s = c.createBufferSource();
    s.buffer = b;
    s.connect(g);
    lancer(c, s, t);
  }

  /** Le graphe de la rumeur, éteint (tous ses gains à zéro). `echelle` : voir
      plus haut. */
  function construireLit(c, dest, echelle = 1) {
    const [r1, r2] = deuxRoses(c);
    const sortie = c.createGain();
    sortie.gain.value = MIX_AMBIANCE * echelle;
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
    return { sortie, mix: MIX_AMBIANCE, gGrave, gVoix, gClair, bpVoix, pVoix, pGrave, eclats: entreeEclats,
      sources: [s1, s2, o1, o2] };
  }

  /** Mène la rumeur vers un niveau ; « tau » nul : d'un coup. */
  function reglerLit(lit, n, t, tau) {
    const N = NIVEAUX_AMBIANCE[n];
    const poser = (p, v) => (tau > 0 ? p.setTargetAtTime(v, t, tau) : p.setValueAtTime(v, t));
    // L'enregistrée n'a qu'un gain : la foule respire et crie d'elle-même.
    if (lit.enregistre) { poser(lit.niveau.gain, gainRumeur(n)); return; }
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
     `passes`, les niveaux passagers (un but, une poussée, la minute double)
     qui retombent seuls, chacun à son heure ; `joue`, le niveau vers lequel
     la rumeur va vraiment. `echelle`, l'échelle voulue (voir plus haut), et
     `posee`, celle que la rumeur a reçue ; `phase`, la dernière phase de
     « rumeur » ; `fondu`, la constante de temps d'une transition demandée
     une fois (l'entrée, la fin), en secondes, 0 sinon.

     **Plusieurs passagers à la fois, et le plus fort qui court l'emporte.**
     Il n'y en avait qu'un : le plus fort remplaçait l'autre, qui était
     perdu. Or le Virage en empile deux au même instant — le but réel joue
     l'ovation (3, neuf secondes) et ouvre la minute double (2, une minute) —
     et la minute double s'éteignait avec l'ovation, cinquante secondes trop
     tôt ; un chant pendant la minute double (2, cinq secondes) la ramenait
     de même à cinq secondes. Désormais chacun garde son heure de fin, et la
     tribune joue le plus fort de ceux qui courent encore. */
  const amb = { base: 0, passes: [], joue: 0, lit: null, minuterie: 0, eclats: 0, demontage: 0,
    echelle: 1, posee: 1, phase: null, fondu: 0, ancien: null, passage: 0 };
  /** Les passagers encore en cours ; les autres sont oubliés. */
  function elaguer() {
    const t = performance.now();
    if (amb.passes.some((p) => p.fin <= t)) amb.passes = amb.passes.filter((p) => p.fin > t);
    return amb.passes;
  }
  const passager = () => elaguer().reduce((m, p) => Math.max(m, p.niveau), 0);
  const voulu = () => Math.max(amb.base, passager());
  /* Une minuterie, réglée sur la prochaine fin de passager : à son heure,
     la tribune retombe au niveau des autres, ou à celui que la page a posé. */
  function armer() {
    clearTimeout(amb.minuterie);
    amb.minuterie = 0;
    const restent = elaguer();
    if (!restent.length) return;
    const proche = restent.reduce((m, p) => Math.min(m, p.fin), Infinity) - performance.now();
    amb.minuterie = setTimeout(() => { amb.minuterie = 0; armer(); appliquer(); }, Math.max(0, proche) + 5);
  }

  /* Le lit synthétisé que l'enregistré vient de relayer, et qui s'éteint en
     fondu (voir « passer ») : démonté à son heure, ou tout de suite si tout
     se tait avant. */
  function oublierAncien() {
    clearTimeout(amb.passage);
    amb.passage = 0;
    if (amb.ancien) { demonterLit(amb.ancien); amb.ancien = null; }
  }

  function eteindreLit(tau) {
    clearTimeout(amb.eclats);
    amb.eclats = 0;
    amb.joue = 0;
    if (!(tau > 0)) oublierAncien();
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
    // Le fondu demandé ne vaut qu'une fois, et seulement s'il s'entend.
    const fondu = amb.fondu;
    amb.fondu = 0;
    if (!jouable) { eteindreLit(0); return; }
    /* Zéro : on éteint en fondu, une fois. Une rumeur déjà en train de
       s'éteindre ne se rééteint pas à chaque toucher — son démontage serait
       repoussé d'autant. */
    if (n === 0) { if (amb.joue !== 0) eteindreLit(fondu || TAU.descend); return; }
    clearTimeout(amb.demontage);
    amb.demontage = 0;
    // La clameur se décode avec la rumeur : elle doit être prête avant le but.
    charger(ctx, 'clameur');
    if (!amb.lit) {
      /* L'enregistrée si elle est déjà décodée pour ce contexte ; sinon la
         synthèse, et l'enregistrée prendra le relais à son arrivée. */
      const e = charger(ctx, 'rumeur');
      const r = pret(ctx, 'rumeur');
      amb.lit = r ? construireLitEnregistre(ctx, chaine.bus.ambiance, r, amb.echelle)
        : construireLit(ctx, chaine.bus.ambiance, amb.echelle);
      amb.posee = amb.echelle;
      if (!r && e && !e.fini) e.promesse.then(() => passer(e));
    }
    if (n !== amb.joue) {
      const tau = fondu || (n === 3 ? TAU.but : n > amb.joue ? TAU.monte : TAU.descend);
      reglerLit(amb.lit, n, ctx.currentTime, tau);
      amb.joue = n;
      /* Le prochain cri suit le nouveau niveau : celui qu'on avait tiré au
         rythme de la rumeur pouvait attendre treize secondes, au milieu
         d'un but. */
      clearTimeout(amb.eclats);
      amb.eclats = 0;
    }
    /* L'échelle : la tribune remonte vite (on entend tout de suite qu'elle
       se remplit), elle se creuse lentement (une mi-temps ne coupe pas le
       son d'un coup). Posée seulement quand elle change. */
    if (amb.posee !== amb.echelle) {
      const tau = fondu || (amb.echelle > amb.posee ? TAU.monte : TAU.creux);
      amb.lit.sortie.gain.setTargetAtTime(amb.lit.mix * amb.echelle, ctx.currentTime, tau);
      amb.posee = amb.echelle;
    }
    planifierEclats();
  }

  /**
   * L'enregistrée arrive : elle relaie la synthèse en fondu enchaîné. Les
   * deux ont la même sonie moyenne au niveau 1 : on n'entend changer que le
   * grain. Rien ne part si la rumeur ne peut plus jouer (le calme tombé
   * pendant le décodage, l'onglet caché, la tribune vidée, un autre
   * contexte) : le tampon reste, et servira au prochain lit.
   */
  function passer(e) {
    const r = e.valeur;
    const lit = amb.lit;
    if (!r || !lit || lit.enregistre || amb.joue === 0 || !entendu() || decodes.get(ctx)?.get('rumeur') !== e) return;
    try {
      const t = ctx.currentTime;
      const neuf = construireLitEnregistre(ctx, chaine.bus.ambiance, r, amb.posee);
      reglerLit(neuf, amb.joue, t, PASSAGE.tau);
      reglerLit(lit, 0, t, PASSAGE.tau);
      clearTimeout(amb.eclats);
      amb.eclats = 0;
      oublierAncien();
      amb.ancien = lit;
      amb.lit = neuf;
      amb.passage = setTimeout(oublierAncien, PASSAGE.demontage * 1000);
    } catch { /* la synthèse continue */ }
  }

  /* Les éclats de voix : rares à la rumeur (toutes les neuf secondes en
     moyenne), fréquents au but. Une minuterie, pas une boucle d'images :
     elle dort entre deux cris, et l'onglet caché l'arrête. */
  function planifierEclats() {
    if (amb.eclats || amb.lit?.enregistre) return;
    const N = NIVEAUX_AMBIANCE[amb.joue];
    if (!amb.lit || !N.eclats) return;
    amb.eclats = setTimeout(() => {
      amb.eclats = 0;
      if (!amb.lit || !ctx || ctx.state !== 'running' || document.hidden || calme()) return;
      const voix = 1 + Math.floor(alea() * (amb.joue >= 2 ? 3 : 1.6));
      eclats(ctx, amb.lit.eclats, ctx.currentTime + 0.02, voix, NIVEAUX_AMBIANCE[amb.joue].eclat);
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
    const duree = n === 3 ? Number(pendant) || TENUE_BUT : Number(pendant) || 0;
    if (n === 0) {
      /* La tribune se vide : la fin du match, la sortie. Rien ne la
         retient — ni les passagers, ni la phase et l'échelle que « rumeur »
         avait posées : la prochaine tribune repart pleine. */
      amb.base = 0;
      amb.passes = [];
      amb.phase = null;
      amb.echelle = 1;
      armer();
    } else if (duree > 0) {
      /* Un passager s'ajoute à ceux qui courent, avec son heure de fin. Le
         plus fort l'emporte tant qu'il court : une poussée pendant
         l'ovation n'éteint pas l'ovation, et l'ovation finie rend la main à
         la minute double qui court encore (voir l'état, plus haut). Seize
         au plus : au-delà, ce sont les plus proches de leur fin qui partent. */
      const passes = elaguer();
      passes.push({ niveau: n, fin: performance.now() + duree });
      if (passes.length > 16) {
        passes.sort((a, b) => b.fin - a.fin);
        passes.length = 16;
      }
      armer();
    } else {
      amb.base = n;
    }
    prefetch();
    if (n === 3) jouer('ovation');
    else ouvrir();
    appliquer();
    return voulu();
  }

  /* ============================================== la rumeur suit le match

     **Le match dit où en est la tribune ; la page ne compte pas les
     niveaux** (lot 6). Le Virage et le duel posaient chacun leurs chiffres —
     1, puis 2 quand tout compte double, 0 au coup de sifflet — et rien ne
     disait la mi-temps, l'entrée, le vestiaire, ni que la tribune se vide.
     Ici, un nom par moment du match, et le moteur choisit le niveau,
     l'échelle et le temps qu'il faut pour y aller. Deux sortes :

     **Les phases**, durables — on peut les redire à chaque rendu, chaque
     seconde, sans rien déranger ni rien relancer :
       jeu        la rumeur du match, avant le coup d'envoi comme pendant
                  (le niveau 1, la tribune pleine) ; lève la mi-temps ;
       mi-temps   la rumeur retombe (CREUX) et tient jusqu'à la phase
                  suivante ;
       fin        la tribune se vide : la rumeur s'éteint en `ms`
                  (FIN_MS par défaut), puis se démonte. Redite, elle ne
                  recommence pas son fondu ;
       vestiaire  le vestiaire du duel : la rumeur à la mesure des places
                  prises, `part` de 0 à 1 (les présents sur les attendus).

     **Les moments**, passagers — une fois, à l'évènement :
       entree     la foule qui compte : la rumeur monte du silence (ou du
                  vestiaire) à la tribune pleine en `ms` (ENTREE_MS par
                  défaut), le temps du compte que la page joue avec
                  FX.compter ; puis la phase « jeu » ;
       double     la minute qui compte double : la tribune pousse (2)
                  pendant `ms` — la durée relative que le serveur sert
                  (`surgeMs`, R3), une minute au plus — puis retombe seule ;
       but        l'ovation d'un but de son camp (3) : `ambiance(3)` ;
       arrivee    quelqu'un entre au vestiaire : la rumeur enfle
                  (ARRIVEE_MS) et prend sa nouvelle mesure (`part`).

     Tout le reste du moteur tient : rien ne démarre avant le premier geste
     (la phase est retenue et joue au toucher), le calme et l'onglet caché
     taisent tout et le retour reprend la phase où elle en est, et la rumeur
     ne porte jamais seule une information — l'écran dit la mi-temps, le
     vestiaire, la minute double. `ambiance()` reste, pour les sons de jeu
     (une poussée : `ambiance(2, { pendant })`) et les pages d'avant. */
  const mesure = (part) => {
    const p = borner(Number(part) || 0, 0, 1);
    return VESTIAIRE_VIDE + (1 - VESTIAIRE_VIDE) * p;
  };
  /** Le contexte tourne-t-il assez pour qu'une transition s'entende ? */
  const entendu = () => Boolean(ctx && ctx.state === 'running' && !calme() && !document.hidden);
  function phase(nom, echelle) {
    amb.phase = nom;
    amb.base = 1;
    amb.echelle = echelle;
  }
  const RUMEUR = {
    jeu: () => phase('jeu', 1),
    'mi-temps': () => phase('mi-temps', CREUX),
    vestiaire: (o) => phase('vestiaire', mesure(o.part)),
    fin: (o) => {
      if (amb.phase === 'fin') return;
      amb.phase = 'fin';
      amb.base = 0;
      amb.passes = [];
      armer();
      if (entendu() && amb.lit) amb.fondu = borner(Number(o.ms) || FIN_MS, 300, 30000) / 3000;
    },
    entree: (o) => {
      /* Trois constantes de temps pour la durée du compte : à son dernier
         chiffre, la rumeur est à 95 % de la tribune pleine. Sans contexte
         qui tourne encore (aucun geste), la phase est retenue et la
         rumeur viendra au premier toucher, à son pas ordinaire : le compte
         est fini depuis longtemps. */
      phase('jeu', 1);
      if (entendu()) amb.fondu = borner(Number(o.ms) || ENTREE_MS, 150, 10000) / 3000;
    },
    double: (o) => {
      const ms = o.ms === undefined || o.ms === null ? DOUBLE_MS : borner(Number(o.ms) || 0, 0, DOUBLE_MS);
      if (ms > 0) ambiance(2, { pendant: ms });
    },
    but: () => { ambiance(3); },
    arrivee: (o) => {
      phase('vestiaire', mesure(o.part));
      ambiance(2, { pendant: ARRIVEE_MS });
    },
  };
  /* Les moments dont l'ambiance() appelée ci-dessus a déjà tout fait. */
  const SANS_APPLIQUER = new Set(['double', 'but', 'arrivee']);

  /**
   * La rumeur suit le match. Voir l'en-tête de la section pour chaque nom.
   *
   * @param {string} moment  « jeu », « mi-temps », « fin », « vestiaire »,
   *   « entree », « double », « but » ou « arrivee » ; un autre nom ne fait
   *   rien
   * @param {object} [o]
   * @param {number} [o.ms]    la durée de l'entrée, de la fin ou de la
   *   minute double, en millisecondes
   * @param {number} [o.part]  au vestiaire, les places prises, de 0 à 1
   * @returns {number} le niveau voulu désormais
   */
  function rumeur(moment, o = {}) {
    const f = Object.prototype.hasOwnProperty.call(RUMEUR, moment) ? RUMEUR[moment] : null;
    if (!f) return voulu();
    f(o ?? {});
    prefetch();
    if (!SANS_APPLIQUER.has(moment)) {
      ouvrir();
      appliquer();
    }
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
     fenêtre du jeu.

     Chaîne chaude (4 octobre 2026, voir CHAUFFE), la sonie des chants ne
     bouge pas — leurs cent millisecondes les plus fortes tombaient déjà
     limiteur ouvert —, mais leur premier temps sort entier : le « tempo »
     montait à −6,47 dBFS de crête, au-dessus de CRETE_SEULE. Les deux voix
     baissent ensemble d'un demi-décibel (0,164 et 0,856 avant) : tambour
     seul −24,3, claps seuls −23,5 ; le « tempo » −20,9 (crête −7,0), le
     contretemps −24,2, la marche −23,6, le roulement −21,4, l'écho −21,9. */
  const MIX_CHANT = { tambour: 0.155, clap: 0.808 };
  /** Les bornes d'un tempo : en deçà ce n'est plus un temps, au-delà plus un rythme. */
  const TEMPO = { min: 150, max: 2000, defaut: 560 };
  /** Le plus long chant compté : au-delà, on s'arrête là. Un chant sans fin
      se demande avec « temps: Infinity ». */
  const TEMPS_MAX = 512;
  /** Le retard de la première frappe en deçà duquel tout le chant glisse
      plutôt que de la perdre (voir « chant ») : la latence de sortie d'un
      téléphone, avec sa marge. En secondes. */
  const RATTRAPE = 0.15;

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
   * L'instant de l'horloge audio où il faut poser un son pour qu'il
   * **s'entende** à l'instant `p` de la page (`performance.now()`, en ms).
   *
   * La sortie a sa latence : quelques millisecondes sur un ordinateur, plus
   * de cent sur certains téléphones avec un casque sans fil. Un tambour posé
   * à l'instant où le pavé bat s'entend donc une latence plus tard, et un
   * joueur qui frappe sur ce qu'il entend frappe en retard sur ce que le
   * serveur note. Le navigateur sait dire quel échantillon sort à quel
   * instant de la page (« getOutputTimestamp ») : on s'en sert. Sans lui
   * (un Safari d'avant 14.1), la latence que le contexte déclare,
   * retranchée de l'horloge.
   *
   * **Rien tant que l'horloge n'a pas tourné.** Un contexte né dans le
   * geste même se dit « running » une centaine de millisecondes avant que
   * son horloge ne bouge : elle reste à zéro, l'horodatage aussi, et l'on
   * ne sait pas encore à quel instant de la page correspondra son premier
   * échantillon. Calé à ce moment-là, le premier chant d'une visite
   * s'entendait un dixième de seconde derrière le pavé (mesuré au banc du
   * lot 6). On rend donc `null`, et le chant attend de pouvoir se caler.
   */
  function horlogeDe(c, p) {
    try {
      const ts = c.getOutputTimestamp?.();
      if (ts && ts.performanceTime > 0 && Number.isFinite(ts.contextTime)) {
        return ts.contextTime + (p - ts.performanceTime) / 1000;
      }
    } catch { /* sans horodatage de sortie : le repli */ }
    if (!(c.currentTime > 0)) return null;
    const latence = Number(c.outputLatency) || Number(c.baseLatency) || 0;
    return c.currentTime + (p - performance.now()) / 1000 - latence;
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
   * **Calé sur le geste** (`origine`, lot 6) : l'instant `performance.now()`
   * où le geste commence, celui dont le serveur compte les frappes. Chaque
   * frappe s'entend à `origine + debut + k × tempo`, latence de sortie
   * comprise. Sans origine, c'est l'instant de l'appel : la salle de
   * répétition appelle le chant juste avant d'ouvrir le geste, et c'est
   * bien de là que le geste compte. Le chant partait avant trente
   * millisecondes après l'appel, plus la latence de la sortie — le temps
   * entendu tombait d'autant derrière le temps noté.
   *
   * **Et si la première frappe est déjà passée ?** De peu (moins de
   * RATTRAPE) — l'écho frappe à l'instant zéro, que la latence de sortie a
   * déjà dépassé quand le chant part ; le crescendo ne le fait plus depuis
   * que sa grille lui donne un temps d'avance (lot 6) —, tout le chant
   * glisse d'autant : le motif reste entier, son rythme intact, juste un peu
   * après le pavé. De beaucoup — un chant demandé bien après son origine —,
   * les frappes passées se taisent et les suivantes tombent sur la grille :
   * un temps entendu en retard ferait taper à contretemps.
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
   * @param {number} [o.origine]    l'instant zéro, en temps de la page
   *   (`performance.now()`) : celui du geste que le chant accompagne ;
   *   absent, l'instant de l'appel
   * @returns {{ arreter(): void, duree: number, joue: boolean }}
   */
  function chant(type, o = {}) {
    arreterChant();
    const plan = planDuChant(type, o);
    if (!plan) return sansChant();
    if (document.hidden) return sansChant(plan.duree);
    const c = ouvrir();
    if (!c || !chaine || !pretAJouer(c)) return sansChant(plan.duree);
    let voix;
    try { voix = voixDuChant(c, chaine.bus.effets); } catch { return sansChant(plan.duree); }
    const donnee = o?.origine == null ? NaN : Number(o.origine);
    const origine = Number.isFinite(donnee) ? donnee : performance.now();
    const ch = { c, voix, minuterie: 0 };
    /* L'instant zéro sur l'horloge audio, posé dès qu'elle tourne (voir
       « horlogeDe »), et **relu à chaque paquet** de frappes : l'horodatage
       d'un contexte tout juste démarré se corrige pendant ses premières
       centaines de millisecondes — calé une fois au départ, le premier chant
       d'une visite tombait juste sur son premier temps et vingt-deux
       millisecondes derrière les suivants (mesuré au banc du lot 6). Une
       frappe déjà posée ne bouge plus ; celles d'après suivent la meilleure
       estimation. La première frappe passée de peu : tout le chant glisse
       (voir plus haut), d'un décalage décidé une fois. */
    let t0 = null;
    let decalage = null;
    const caler = () => {
      const t = horlogeDe(c, origine);
      if (t === null) return t0 !== null;
      if (decalage === null) {
        const retard = c.currentTime + 0.01 - (t + plan.frappesDu(0)[0].t);
        decalage = retard > 0 && retard < RATTRAPE ? retard : 0;
      }
      t0 = t + decalage;
      return true;
    };
    let i = 0;
    const AVANCE = 0.25;
    const appel = performance.now();
    const avancer = () => {
      if (chantEnCours !== ch) return;
      if (c.state === 'closed') { arreterChant(ch); return; }
      /* L'horloge ne tourne pas encore : on revient dans un instant. Deux
         secondes au plus — une horloge qui ne part jamais ne laisse pas une
         minuterie tourner toute la partie. */
      if (!caler()) {
        if (performance.now() - appel > 2000) { arreterChant(ch); return; }
        ch.minuterie = setTimeout(avancer, 15);
        return;
      }
      const maintenant = c.currentTime;
      const horizon = maintenant + AVANCE;
      try {
        while (i < plan.n) {
          const frappes = plan.frappesDu(i);
          if (t0 + frappes[0].t > horizon) break;
          /* Une frappe passée se tait (voir plus haut) ; les suivantes
             jouent. Cinq millisecondes de grâce : un départ à peine passé
             part tout de suite, et c'est le même instant à l'oreille. */
          for (const f of frappes) if (t0 + f.t >= maintenant - 0.005) frapper(c, voix, f, t0);
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

  /* ------------------------------------------- le chant d'un geste (lot 6)

     Trois écrans accompagnent un geste de rythme — la salle de répétition,
     le Virage, le duel —, et chacun aurait écrit le passage du geste au
     chant : quel motif, combien de temps, à partir de quand. C'est là
     qu'une copie diverge (le contretemps compte un temps de plus que ses
     frappes ; le tempo bat son premier temps au bout d'un intervalle, pas à
     l'ouverture).

     **Les instants viennent de `geste.js`, et de lui seul** (lot 6). Ils y
     sont calculés une fois, par `TBF_GESTE.grille(geste, gestes)` : la
     pulsation que le pavé dessine, et que le serveur note. Ce moteur les
     recopiait d'après le dessin, dans sa propre table — deux sources qui
     devaient rester d'accord, et `son:smoke` ne les comparait que sur le
     tempo. Le crescendo en a donné la preuve : sa grille lui a pris un
     temps d'avance (le premier temps un intervalle après l'ouverture, soit
     `instants[1] − instants[0]`, 700 ms sur la configuration servie), et le
     pavé et le chant ont bougé ensemble sans qu'une ligne change ici —
     recopié, le chant aurait battu 700 ms avant le pavé, et le joueur qui
     suit le son aurait tapé à côté. Sans `geste.js` dans la page, ou sans
     grille pour ces durées (configuration absente, intervalle illisible,
     instants vides), rien ne chante : aucun tempo n'est inventé, et un chant
     ne va jamais sans le pavé qu'il accompagne.

     Ce qui reste ici, c'est le son : ce que la tribune frappe sur chaque
     pulsation.

       tempo        le tambour et les claps sur chaque temps (un tambour plus
                    fort tous les quatre) ;
       contretemps  le tambour sur le temps, les claps entre deux — la
                    pulsation y bat un temps de plus que les frappes ;
       echo         tambour et claps aux instants de la démonstration — le
                    joueur la refait ensuite en silence, c'est le geste ;
       crescendo    tambour et claps aux instants de la pulsation qui
                    accélère, après le temps d'avance de sa grille.

     Les vingt autres gestes du serveur (martelage, salves, relance,
     sang-froid, le tifo, les épreuves…) n'ont pas de pulsation à suivre :
     pas de chant, et la poignée rendue ne joue rien. */
  const MOTIF_DU_GESTE = { tempo: 'tempo', contretemps: 'contretemps', echo: 'frappes', crescendo: 'frappes' };

  /** Les pulsations du geste, telles que `geste.js` les dessine, ou `null`. */
  function pulsationsDu(geste, gestes) {
    let gr = null;
    try { gr = window.TBF_GESTE?.grille?.(geste, gestes) ?? null; } catch { gr = null; }
    const p = Array.isArray(gr?.pulsations) ? gr.pulsations.map(Number) : [];
    return p.length && p.every((t) => Number.isFinite(t) && t >= 0) ? p : null;
  }

  /**
   * Le chant d'un geste de rythme, sur les durées que le serveur a servies.
   *
   * À appeler **juste avant** d'ouvrir le geste (`TBF_GESTE.jouer`), avec le
   * même instant pour origine — que la page donne aussi au geste
   * (`{ zone, origine }`) —, et à arrêter à la fermeture de la fenêtre
   * (`arreter()` de la poignée, ou `arreterChant()`). Les instants sont ceux
   * de `TBF_GESTE.grille` (voir plus haut) : la page doit charger `geste.js`.
   *
   * @param {string} geste   le geste (« tempo », « contretemps », « echo »,
   *   « crescendo » ; tout autre ne chante pas)
   * @param {object} gestes  la configuration servie (`S.you.gestes` au
   *   Virage, `moi.gestes` au duel, `/api/repetition` à la répétition)
   * @param {object} [o]
   * @param {number} [o.origine]  l'instant `performance.now()` où le geste
   *   commence ; absent, le chant part tout de suite (voir « chant »)
   * @returns {{ arreter(): void, duree: number, joue: boolean }}
   */
  function chantDuGeste(geste, gestes, { origine } = {}) {
    const motif = Object.prototype.hasOwnProperty.call(MOTIF_DU_GESTE, geste) ? MOTIF_DU_GESTE[geste] : null;
    const instants = motif ? pulsationsDu(geste, gestes) : null;
    if (!instants) { arreterChant(); return sansChant(); }
    /* L'intervalle donne sa mesure au temps : la place des claps du
       contretemps, entre deux pulsations, et la durée du dernier temps. */
    const pas = Number(gestes?.[geste]?.interval);
    return chant(motif, { instants, ...(pas > 0 ? { tempo: pas } : {}),
      ...(origine != null ? { origine } : {}) });
  }

  /* ===================================================== calme et onglet

     Le calme coupe tout, tout de suite : la sortie à zéro, les sons en
     cours arrêtés, le contexte suspendu (plus aucun calcul), la rumeur
     démontée, le chant arrêté. On l'apprend en observant l'attribut
     lui-même : le tiroir, le bouton du duel, un autre onglet (par fx.js et
     menu.js) l'écrivent tous là. */

  /** Arrête net chaque son ponctuel en cours (voir « lancer »). */
  function couperPonctuels() {
    for (const s of enCours) {
      try { s.stop(); } catch { /* jamais parti, ou déjà arrêté */ }
    }
    enCours.clear();
  }

  /* Ce qui se tait, au calme comme à l'onglet caché, et dans cet ordre : on
     arrête avant de suspendre, pour que rien ne reste en pause au milieu. */
  function taire() {
    arreterChant();
    eteindreLit(0);
    couperPonctuels();
    poserVolume();
    if (ctx?.state === 'running') ctx.suspend().catch(() => {});
  }

  function surCalme() {
    if (calme()) taire();
    /* Le calme levé : « ouvrir » reprend le contexte suspendu — ou le crée,
       si le joueur vient de lever le calme d'un toucher et qu'aucun son
       n'avait encore pu naître. */
    else if (!document.hidden && ouvrir()) {
      poserVolume();
      appliquer();
    }
  }
  if (typeof MutationObserver === 'function') {
    new MutationObserver(surCalme).observe(document.documentElement,
      { attributes: true, attributeFilter: ['data-calme'] });
  }

  /* L'onglet caché se tait : la rumeur s'arrête (démontée), le chant aussi,
     les sons en cours sont arrêtés et le contexte est suspendu. Au retour,
     la rumeur revient en fondu au niveau voulu — ce que la page a demandé
     pendant l'absence compris ; les sons ponctuels, eux, ne reviennent
     pas : ils appartenaient à leur instant. */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      taire();
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
  /* **La chaîne chauffe avant qu'on mesure** (lot 6). Le compresseur de
     Chrome, notre limiteur, naît fermé : son détecteur part de zéro, il
     écrase tout ce qui passe, et ne s'ouvre qu'en deux dixièmes de seconde.
     Un sinus à −20 dB sort à −27,5 à 20 ms du début d'un rendu, −23,4 à
     50 ms, −21,0 à 100 ms, et −20,0 à partir de 200 ms (mesuré le 4 octobre
     2026). Le banc posait chaque son à 20 ms : tout ce qui est bref était
     mesuré limiteur fermé — le tic à −19,5 dBFS de crête, quand le même tic
     posé une seconde plus tard en fait −11,5 —, six à huit décibels sous ce
     que le joueur entend. Car dans le jeu la chaîne tourne depuis le premier
     geste, et le limiteur est grand ouvert quand le tic part. Une rafale de
     tics le montrait : le premier sonnait comme dans la banque, les suivants
     huit décibels au-dessus. On chauffe donc la chaîne une demi-seconde
     dans le silence — comme le jeu entre deux sons — et le tampon rendu
     commence là.

     Le tout premier son d'une visite, celui du toucher qui fait naître le
     contexte, passait, lui, limiteur fermé (treize décibels sous la banque,
     mesuré dans Chrome) : c'est NAISSANCE, plus haut, qui l'ouvre à temps.
     La chauffe reste pourtant : elle mesure la chaîne telle qu'elle tourne
     en jeu, relâche ordinaire comprise, et non pendant ses soixante
     premières millisecondes. `chauffe: 0` rend depuis la naissance, pour
     éprouver NAISSANCE elle-même (`son:smoke`, `son:banc`). */
  const CHAUFFE = 0.5;
  /**
   * @param {object} quoi  ce qu'on rend : `son`, `sons`, `suite`, `ambiance`
   *   (et `echelle`), `chant` (et ses options), `sinus`
   * @param {object} [o]
   * @param {number} [o.duree=2]       en secondes, ce que dure le tampon rendu
   * @param {number} [o.graine=1]      le hasard des bruits et des éclats
   * @param {number} [o.chauffe]       en secondes, le silence qui chauffe la
   *   chaîne avant le tampon (CHAUFFE par défaut ; 0 : depuis la naissance)
   * @returns {Promise<AudioBuffer|null>}
   */
  async function rendre(quoi = {}, { duree = 2, frequence = 48000, graine: g = 1, chauffe = CHAUFFE } = {}) {
    const OAC = window.OfflineAudioContext ?? window.webkitOfflineAudioContext;
    if (typeof OAC !== 'function') return null;
    graine = (Number(g) >>> 0) || 1;
    // La chaîne chauffe d'abord dans le silence (voir CHAUFFE), puis le rendu.
    const avant = Math.round(frequence * borner(Number(chauffe) || 0, 0, 2));
    const longueur = Math.ceil(frequence * duree);
    const c = new OAC(2, avant + longueur, frequence);
    const ch = construireChaine(c, 1);
    const t = avant / frequence + DEBUT_RENDU;
    /* « enregistre » : la rumeur et la clameur jouées depuis leurs fichiers,
       décodés dans ce contexte comme le jeu les décode dans le sien. Un
       fichier manquant rend `null` : le banc doit le dire, pas mesurer la
       synthèse à sa place. */
    let fichiers = null;
    if (quoi.enregistre) {
      const [rumeurE, clameurE] = await Promise.all([
        decoderPour(c, 'rumeur', preparerBoucle), decoderPour(c, 'clameur', (b) => b)]);
      if (!rumeurE || !clameurE) return null;
      fichiers = { rumeur: rumeurE, clameur: clameurE };
    }
    if (Number.isFinite(quoi.sinus)) {
      const o = c.createOscillator();
      o.frequency.value = 997;
      const a = c.createGain();
      a.gain.value = 10 ** (quoi.sinus / 20);
      o.connect(a).connect(ch.maitre);
      o.start(t);
    }
    for (const nom of [quoi.son, ...(quoi.sons ?? [])].filter(Boolean)) {
      if (existe(nom)) jouerDans(c, ch, nom, quoi.options, t, fichiers);
    }
    /* « suite » : des sons de la banque posés chacun à son instant, en
       millisecondes depuis le début du rendu (lot 6). Le pavé fait un tic à
       chaque frappe — jusqu'à dix par seconde au martelage —, et le banc doit
       entendre cette rafale par-dessus le tambour d'un chant, pas un tic
       seul : c'est leur densité, plus que leur force, qui pourrait couvrir le
       chant. Ils passent avant le chant et ne tirent aucun hasard : le chant
       rendu avec eux est, frappe pour frappe, celui qu'on rend sans eux. */
    for (const x of Array.isArray(quoi.suite) ? quoi.suite : []) {
      const ms = Number(x?.a);
      if (existe(x?.son) && Number.isFinite(ms) && ms >= 0) jouerDans(c, ch, x.son, x.options, t + ms / 1000);
    }
    if (quoi.ambiance) {
      const n = Math.round(borner(Number(quoi.ambiance), 1, 3));
      /* « echelle » : la rumeur creusée ou à demi pleine (la mi-temps, le
         vestiaire), pour mesurer que la retombée s'entend. */
      const echelle = quoi.echelle == null ? 1 : borner(Number(quoi.echelle) || 0, 0, 1);
      if (fichiers) {
        // L'enregistrée : son gain de niveau, et ni respiration ni éclats.
        reglerLit(construireLitEnregistre(c, ch.bus.ambiance, fichiers.rumeur, echelle), n, 0, 0);
      } else {
        const lit = construireLit(c, ch.bus.ambiance, echelle);
        reglerLit(lit, n, 0, 0);
        // Les éclats, au rythme du niveau, comme le jeu les tire.
        const pas = NIVEAUX_AMBIANCE[n].eclats / 1000;
        for (let x = t + pas * (0.5 + alea()); x < t + duree - 0.72; x += pas * (0.5 + alea())) {
          eclats(c, lit.eclats, x, 1 + Math.floor(alea() * (n >= 2 ? 3 : 1.6)), NIVEAUX_AMBIANCE[n].eclat);
        }
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
    /* Le tampon rendu commence où la chauffe finit : pour qui le lit, le son
       part toujours à DEBUT_RENDU, comme avant. */
    const plein = await c.startRendering();
    const tampon = c.createBuffer(plein.numberOfChannels, longueur, frequence);
    for (let k = 0; k < plein.numberOfChannels; k++) {
      tampon.copyToChannel(plein.getChannelData(k).subarray(avant, avant + longueur), k);
    }
    return tampon;
  }

  /** Ce que le moteur fait en ce moment : pour la suite, et pour qui cherche. */
  const etat = () => ({
    contexte: ctx ? ctx.state : 'absent',
    geste: vuGeste,
    /** Les sons ponctuels qui sonnent encore (rumeur et chants à part). */
    enCours: enCours.size,
    ambiance: { base: amb.base, passager: passager(), voulu: voulu(), joue: amb.lit ? amb.joue : 0,
      /** La rumeur qui joue : « enregistree », « synthese », ou rien. */
      source: amb.lit ? (amb.lit.enregistre ? 'enregistree' : 'synthese') : null },
    /** Les sons enregistrés décodés pour le contexte vivant. */
    fichiers: { rumeur: Boolean(ctx && pret(ctx, 'rumeur')), clameur: Boolean(ctx && pret(ctx, 'clameur')) },
    /** La phase de « rumeur » et l'échelle voulue (1 : la tribune pleine). */
    rumeur: { phase: amb.phase, echelle: amb.echelle },
    chant: Boolean(chantEnCours),
    volume: volumeJoueur,
  });

  window.TBF_SON = {
    jouer,
    ambiance,
    rumeur,
    chant,
    chantDuGeste,
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
    /** Les moments de la rumeur (voir « rumeur »). */
    rumeurs: () => Object.keys(RUMEUR),
    /** Les gestes qui ont un chant (voir « chantDuGeste »). */
    gestesChantes: () => Object.keys(MOTIF_DU_GESTE),
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
      /* La sonie la plus forte (100 ms) permise à chaque niveau : sous le
         plancher de l'interface moins la marge, ou rien (le niveau 3, le but,
         passe au-dessus : c'est le seul). */
      ambiancePlafonds: NIVEAUX_AMBIANCE.map((N) => (N.sousInterface
        ? FAMILLES.interface.fenetre[0] - MARGE_RUMEUR : null)),
      /* Les deux échelles de la rumeur (voir « l'échelle de la rumeur ») :
         la mi-temps et le vestiaire vide. */
      echelles: { creux: CREUX, vestiaire: VESTIAIRE_VIDE },
      /** Le gain de la clameur enregistrée (voir « la tribune enregistrée »). */
      clameur: MIX_CLAMEUR,
      creteSeule: CRETE_SEULE,
      creteMax: CRETE_MAX,
      limiteur: { ...LIMITEUR },
    }),
  };
})();
