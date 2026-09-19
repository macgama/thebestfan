/**
 * Effets visuels — couche commune.
 *
 * Chaque page réinventait ses animations : secousse ici, étincelles là, chacune
 * avec ses propres réglages. Tout est regroupé ici, appelé par `FX.but()`,
 * `FX.carte()`, `FX.carton()`, et le reste suit.
 *
 * Trois règles tenues par le code, parce qu'un effet raté est pire que pas
 * d'effet du tout :
 *
 *   — rien ne dépasse quelques centaines de particules, et tout est nettoyé
 *     à la fin. Une animation qui laisse des nœuds derrière elle finit par
 *     ralentir la page au bout de dix minutes de jeu.
 *   — `prefers-reduced-motion` coupe le mouvement, pas l'information : le
 *     joueur voit toujours qu'un but a été marqué, sans que l'écran tremble.
 *   — tout est fait en CSS et en SVG. Zéro fichier téléchargé, donc aucun
 *     effet ne dépend du réseau au moment précis où il doit se déclencher.
 */
(() => {
  if (window.FX) return;

  const doux = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const racine = () => document.getElementById('app') ?? document.body;
  const buzz = (p) => { try { navigator.vibrate?.(p); } catch {} };

  const COULEURS = {
    or: '#F5C33B', feu: '#E0402C', vert: '#1E9E6A',
    bleu: '#3C82E8', violet: '#8257DA', craie: '#F2EEE4',
  };

  /**
   * Une couleur de club, rendue lisible sur le fond sombre du jeu.
   *
   * Les couleurs viennent des blasons, et les blasons sont faits pour du
   * papier blanc : le bleu marine d'un club, écrit sur le noir de l'écran, ne
   * se lit pas du tout. On l'éclaircit jusqu'à un plancher de clarté, en
   * gardant sa teinte — c'est encore la couleur du club, simplement portée
   * par un tissu plus clair.
   *
   * Le gris très désaturé, lui, remonte vers la craie plutôt que vers un gris
   * moyen : un club noir et blanc doit écrire en blanc, pas en gris de pluie.
   *
   * @param {string} hex  « #RRGGBB », tel que le serveur l'envoie.
   * @param {number} [plancher] clarté minimale, de 0 à 1.
   * @returns {string} la couleur éclaircie, ou l'entrée telle quelle si elle
   *   n'est pas lisible comme une couleur — on ne devine pas.
   */
  function lisible(hex, plancher = 0.56) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex ?? '').trim());
    if (!m) return hex;
    const n = parseInt(m[1], 16);
    let [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 510;
    if (l >= plancher) return `#${m[1].toUpperCase()}`;
    // Un mélange vers le blanc plutôt qu'une multiplication : il préserve la
    // teinte, là où monter chaque canal du même facteur vire au délavé.
    const part = Math.min(0.86, (plancher - l) / Math.max(0.08, 1 - l));
    [r, g, b] = [r, g, b].map((v) => Math.round(v + (255 - v) * part));
    return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
  }

  /* ------------------------------------------------------------- styles */

  const css = `
  .fx-layer{position:fixed;inset:0;pointer-events:none;z-index:90;overflow:hidden}
  .fx-p{position:absolute;border-radius:50%;will-change:transform,opacity}
  .fx-flash{position:fixed;inset:0;pointer-events:none;z-index:91;opacity:0}
  .fx-flash.go{animation:fxflash .5s ease-out}
  @keyframes fxflash{0%{opacity:.85}100%{opacity:0}}
  /* ------------------------------------------------- l'évolution

     Elle ne se voyait pas. On confirmait, la fiche se rechargeait, et le
     nouveau personnage était simplement **là** — sans qu'on ait vu l'ancien
     partir, ni compris qu'on venait de dépenser quatre-vingt-dix écharpes.
     C'est le seul achat du jeu qui se paie en monnaie durement gagnée, et
     c'était le seul geste sans récompense à l'écran.

     Deux temps, et c'est tout ce qu'il faut : l'ancien **se charge** — il
     grandit, il blanchit, il vibre —, puis le nouveau **arrive**, d'un coup,
     depuis le blanc. Entre les deux, le flash cache la substitution : c'est
     lui qui fait croire à une transformation plutôt qu'à un remplacement.

     La propriété will-change est posée sur les deux : la charge dure une
     seconde entière sur une image de six cents pixels, et sans elle le
     mouvement saccade sur un téléphone. */
  .fx-charge{animation:fxcharge 1s cubic-bezier(.5,0,.8,.3) forwards;
    transform-origin:50% 60%;will-change:transform,filter}
  @keyframes fxcharge{
    0%{transform:scale(1);filter:brightness(1)}
    55%{transform:scale(1.06) translateY(-4px);filter:brightness(1.5) saturate(.7)}
    78%{transform:scale(1.03) translateY(-2px);filter:brightness(2.4) saturate(.3)}
    100%{transform:scale(1.14) translateY(-8px);filter:brightness(6) saturate(0)}}
  .fx-arrive{animation:fxarrive .72s cubic-bezier(.2,1.5,.4,1) backwards;
    transform-origin:50% 60%;will-change:transform,filter}
  @keyframes fxarrive{
    0%{transform:scale(1.2);filter:brightness(5) saturate(0);opacity:.2}
    40%{filter:brightness(1.8) saturate(.8);opacity:1}
    100%{transform:scale(1);filter:brightness(1)}}
  .fx-shake{animation:fxshake .62s cubic-bezier(.36,.07,.19,.97)}
  @keyframes fxshake{0%,100%{transform:translate(0,0)}
    12%{transform:translate(-8px,4px)}28%{transform:translate(7px,-6px)}
    46%{transform:translate(-6px,-3px)}64%{transform:translate(5px,4px)}
    82%{transform:translate(-3px,2px)}}
  /* L'annonce brève du duel : « RELÈVE », « RENVOI », « CHANTE MAINTENANT ».
     Elle porte **une plaque** et non plus une simple ombre portée. Le lettrage
     nu ne tenait pas au-dessus d'une corde en mouvement, d'un personnage et
     d'une photo de stade : il y a toujours un fond qui gagne.
     Plus légère que la case du moment fort — celle-ci passe en une seconde et
     demie pendant qu'on tape, elle ne doit pas masquer le geste. */
  .fx-titre{position:fixed;left:50%;top:38%;transform:translate(-50%,-50%);z-index:93;
    font-family:"Oswald","Arial Narrow",Impact,sans-serif;letter-spacing:.08em;text-align:center;
    pointer-events:none;opacity:0;white-space:nowrap;
    padding:11px 22px;border-radius:4px;border:2px solid rgba(4,7,11,.9);
    background:linear-gradient(178deg,rgba(18,23,31,.94),rgba(8,11,15,.94));
    box-shadow:0 0 0 1.5px currentColor,0 16px 40px rgba(0,0,0,.72);
    text-shadow:0 3px 0 rgba(4,7,11,.85);max-width:calc(100vw - 32px);
    overflow:hidden;text-overflow:ellipsis}
  .fx-titre.go{animation:fxtitre 1.7s cubic-bezier(.2,.9,.3,1)}
  @keyframes fxtitre{0%{opacity:0;transform:translate(-50%,-50%) scale(.55)}
    16%{opacity:1;transform:translate(-50%,-50%) scale(1.08)}
    26%{transform:translate(-50%,-50%) scale(1)}
    78%{opacity:1}100%{opacity:0;transform:translate(-50%,-62%) scale(.98)}}
  .fx-sous{display:block;font-family:ui-sans-serif,system-ui,sans-serif;font-size:12px;
    letter-spacing:.18em;opacity:.75;margin-top:9px;font-weight:400}
  .fx-nombre{position:fixed;z-index:92;font-family:"Oswald","Arial Narrow",Impact,sans-serif;
    font-size:22px;pointer-events:none;text-shadow:0 3px 14px rgba(0,0,0,.9)}
  /* Le gain qu'on vient de faire soi-même. Le halo double l'ombre portée : le
     nombre passe par-dessus une corde qui bouge et une foule qui s'anime, et
     une ombre seule ne l'en détache pas. */
  .fx-points{position:fixed;z-index:93;pointer-events:none;text-align:center;
    filter:drop-shadow(0 0 16px currentColor)}
  .fx-points b{display:block;font-family:"Oswald","Arial Narrow",Impact,sans-serif;
    font-size:46px;line-height:1;font-weight:700;text-shadow:0 4px 18px rgba(0,0,0,.95)}
  .fx-points span{display:block;font-family:ui-sans-serif,system-ui,sans-serif;font-size:10px;
    letter-spacing:.24em;font-weight:600;margin-top:3px;opacity:.85;
    text-shadow:0 2px 8px rgba(0,0,0,.95)}
  .fx-onde{position:fixed;border-radius:50%;pointer-events:none;z-index:89;border:2px solid;
    opacity:0}
  .fx-onde.go{animation:fxonde .85s cubic-bezier(.15,.7,.3,1)}
  @keyframes fxonde{0%{opacity:.9;transform:translate(-50%,-50%) scale(.15)}
    100%{opacity:0;transform:translate(-50%,-50%) scale(1)}}
  .fx-carton{position:fixed;left:50%;top:42%;width:74px;height:104px;border-radius:6px;z-index:93;
    transform:translate(-50%,-50%) rotate(-14deg);pointer-events:none;opacity:0;
    box-shadow:0 14px 44px rgba(0,0,0,.7)}
  .fx-carton.go{animation:fxcarton 1.5s cubic-bezier(.2,.9,.3,1)}
  @keyframes fxcarton{0%{opacity:0;transform:translate(-50%,20%) rotate(-40deg) scale(.5)}
    18%{opacity:1;transform:translate(-50%,-50%) rotate(-14deg) scale(1.06)}
    28%{transform:translate(-50%,-50%) rotate(-14deg) scale(1)}
    76%{opacity:1}100%{opacity:0;transform:translate(-50%,-70%) rotate(-8deg)}}
  .fx-bandeau{position:fixed;left:0;right:0;top:0;z-index:93;padding:11px 16px;text-align:center;
    font-family:"Oswald","Arial Narrow",Impact,sans-serif;font-size:13px;letter-spacing:.16em;
    color:#0B0E13;transform:translateY(-100%);pointer-events:none}
  .fx-bandeau.go{animation:fxbandeau 3s cubic-bezier(.2,.9,.3,1)}
  @keyframes fxbandeau{0%{transform:translateY(-100%)}10%{transform:translateY(0)}
    88%{transform:translateY(0)}100%{transform:translateY(-100%)}}
  @media (prefers-reduced-motion:reduce){
    .fx-shake{animation:none}
    .fx-titre.go{animation:fxdoux 1.6s ease}
    @keyframes fxdoux{0%{opacity:0}12%{opacity:1}80%{opacity:1}100%{opacity:0}}
  }`;

  /* ------------------------------------------------- personnages vivants
     Un Fanzzy figé sur une carte a l'air d'un autocollant. Trois animations
     décalées et lentes suffisent à le rendre vivant : la respiration, un
     léger balancement, et une réaction quand on le touche.

     Pourquoi pas une vidéo par personnage ? Vingt-sept Fanzzy, ce serait
     vingt-sept fichiers de plusieurs centaines de kilo-octets à charger dans
     une grille. Ici, c'est zéro octet, ça marche sur les vingt-sept d'un coup,
     et sur ceux qu'on ajoutera. Les jeux mobiles font exactement ça pour leurs
     personnages en deux dimensions.                                        */
  const cssVie = `
  .fz-vivant{transform-origin:50% 100%;will-change:transform;
    animation:fzsouffle var(--fz-duree,3.4s) ease-in-out infinite,
              fzbalance calc(var(--fz-duree,3.4s) * 2.3) ease-in-out infinite;
    animation-delay:var(--fz-retard,0s),calc(var(--fz-retard,0s) * 1.7)}
  @keyframes fzsouffle{0%,100%{transform:scaleY(1) scaleX(1) translateY(0)}
    50%{transform:scaleY(1.018) scaleX(.993) translateY(-1.5%)}}
  @keyframes fzbalance{0%,100%{rotate:-.7deg}50%{rotate:.7deg}}
  .fz-vivant.fz-reagit{animation:fzsaute .55s cubic-bezier(.25,.9,.3,1)}
  @keyframes fzsaute{0%{transform:scale(1) translateY(0)}
    22%{transform:scale(1.06,.94) translateY(0)}
    52%{transform:scale(.96,1.07) translateY(-9%)}
    78%{transform:scale(1.02,.98) translateY(0)}
    100%{transform:scale(1) translateY(0)}}
  @media (prefers-reduced-motion:reduce){
    .fz-vivant,.fz-vivant.fz-reagit{animation:none}}`;

  const style = document.createElement('style');
  style.textContent = css + cssVie;
  document.head.appendChild(style);

  let calque = null;
  const layer = () => {
    if (!calque || !calque.isConnected) {
      calque = document.createElement('div');
      calque.className = 'fx-layer';
      document.body.appendChild(calque);
    }
    return calque;
  };

  /* --------------------------------------------------------- primitives */

  /** Gerbe de particules. Plafonnée : au-delà, on ne voit pas mieux, on rame. */
  function particules({ x, y, n = 24, couleurs = [COULEURS.or, COULEURS.feu],
                        distance = 150, taille = 5, duree = 900 } = {}) {
    if (doux()) return;
    const l = layer();
    const total = Math.min(n, 120);
    for (let i = 0; i < total; i++) {
      const p = document.createElement('div');
      p.className = 'fx-p';
      const s = taille * (0.5 + Math.random());
      p.style.cssText = `left:${x}px;top:${y}px;width:${s}px;height:${s}px;` +
        `background:${couleurs[i % couleurs.length]}`;
      l.appendChild(p);
      const a = Math.random() * Math.PI * 2;
      const d = distance * (0.35 + Math.random() * 0.85);
      p.animate([
        { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
        { transform: `translate(${Math.cos(a) * d - 50}%,${Math.sin(a) * d + d * 0.35 - 50}%) scale(0)`,
          opacity: 0 },
      ], { duration: duree * (0.7 + Math.random() * 0.6),
           easing: 'cubic-bezier(.15,.7,.3,1)' }).onfinish = () => p.remove();
    }
  }

  function onde({ x, y, couleur = COULEURS.or, taille = 420 } = {}) {
    if (doux()) return;
    const o = document.createElement('div');
    o.className = 'fx-onde';
    o.style.cssText = `left:${x}px;top:${y}px;width:${taille}px;height:${taille}px;` +
      `border-color:${couleur}`;
    document.body.appendChild(o);
    requestAnimationFrame(() => o.classList.add('go'));
    setTimeout(() => o.remove(), 900);
  }

  function flash(couleur = '#fff') {
    if (doux()) return;
    const f = document.createElement('div');
    f.className = 'fx-flash';
    f.style.background = couleur;
    document.body.appendChild(f);
    requestAnimationFrame(() => f.classList.add('go'));
    setTimeout(() => f.remove(), 560);
  }

  function secousse(force = 1) {
    if (doux()) return;
    const el = racine();
    el.classList.remove('fx-shake');
    void el.offsetWidth;
    el.style.setProperty('--fx-force', String(force));
    el.classList.add('fx-shake');
    setTimeout(() => el.classList.remove('fx-shake'), 660);
  }

  function titre(texte, sous, couleur = COULEURS.craie, taille = 44) {
    const t = document.createElement('div');
    t.className = 'fx-titre';
    t.style.color = couleur;
    t.style.fontSize = `${taille}px`;
    t.innerHTML = `${texte}${sous ? `<span class="fx-sous">${sous}</span>` : ''}`;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('go'));
    setTimeout(() => t.remove(), 1800);
  }

  /** Nombre qui s'envole depuis un point. Sert aux poussées et aux gains. */
  function nombre(valeur, { x, y, couleur = COULEURS.or, signe = true } = {}) {
    const n = document.createElement('div');
    n.className = 'fx-nombre';
    n.style.cssText = `left:${x}px;top:${y}px;color:${couleur}`;
    n.textContent = (signe && valeur > 0 ? '+' : '') + valeur;
    document.body.appendChild(n);
    n.animate([
      { transform: 'translate(-50%,-50%) scale(.7)', opacity: 0 },
      { transform: 'translate(-50%,-90%) scale(1.1)', opacity: 1, offset: .25 },
      { transform: 'translate(-50%,-180%) scale(1)', opacity: 0 },
    ], { duration: 1100, easing: 'cubic-bezier(.2,.8,.3,1)' }).onfinish = () => n.remove();
  }

  const centre = (el) => {
    const r = el?.getBoundingClientRect?.();
    return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 }
             : { x: innerWidth / 2, y: innerHeight / 2 };
  };

  /* ------------------------------------------------------- effets de jeu */

  /**
   * Rend vivant tout personnage déjà présent dans la page.
   *
   * Les durées et les retards sont dérivés d'une graine stable — l'identifiant
   * du Fanzzy — pour que deux cartes voisines ne respirent jamais en même
   * temps. Une grille synchronisée fait mécanique ; décalée, elle fait foule.
   */
  function animer(racineEl = document) {
    const cibles = racineEl.querySelectorAll?.('.illu, [data-vivant]') ?? [];
    for (const el of cibles) {
      if (el.classList.contains('fz-vivant')) continue;
      const graine = (el.getAttribute('data-vivant') || el.src || '')
        .split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 9973, 7);
      el.style.setProperty('--fz-duree', `${3 + (graine % 17) / 10}s`);
      el.style.setProperty('--fz-retard', `-${(graine % 31) / 10}s`);
      el.classList.add('fz-vivant');
    }
  }

  /** Réaction au toucher : le personnage sursaute, comme s'il répondait. */
  function reagir(el) {
    if (!el || doux()) return;
    el.classList.remove('fz-reagit');
    void el.offsetWidth;
    el.classList.add('fz-reagit');
    setTimeout(() => el.classList.remove('fz-reagit'), 600);
    buzz(10);
  }

  // Les cartes arrivent souvent après le premier rendu — ouverture de booster,
  // filtre du classeur. On surveille plutôt que de demander à chaque page d'y
  // penser.
  if (typeof MutationObserver === 'function') {
    const veilleur = new MutationObserver(() => animer(document));
    const lancer = () => {
      animer(document);
      veilleur.observe(document.body, { childList: true, subtree: true });
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', lancer);
    } else lancer();

    document.addEventListener('pointerdown', (e) => {
      // Le navigateur n'autorise le son qu'après un geste : on ouvre le
      // contexte au premier toucher, pour que le premier vrai son ne soit pas
      // avalé.
      contexte();
      const p = e.target.closest?.('.fz-vivant');
      if (p) reagir(p);
    }, { passive: true });
  }

  /* ----------------------------------------------------------------- son
     Aucun fichier audio : tout est synthétisé à la volée.
     Un jeu qui télécharge ses sons les joue en retard la première fois —
     exactement au moment où ils comptent. Ici le son part avec l'image.

     Le navigateur interdit de produire du son avant un geste de
     l'utilisateur. Le contexte n'est donc créé qu'au premier toucher, et le
     joueur peut couper : la préférence survit d'une page à l'autre. */

  let audio = null;
  let sonCoupe = false;
  try { sonCoupe = localStorage.getItem('tbf-son') === 'coupe'; } catch { /* pas de stockage */ }

  function contexte() {
    if (sonCoupe) return null;
    if (!audio) {
      const C = window.AudioContext ?? window.webkitAudioContext;
      if (!C) return null;
      try { audio = new C(); } catch { return null; }
    }
    if (audio.state === 'suspended') audio.resume().catch(() => {});
    return audio;
  }

  /** Une note, avec une hauteur qui peut glisser. */
  function ton({ freq = 220, vers = null, duree = .18, type = 'sine', vol = .16, delai = 0 }) {
    const c = contexte(); if (!c) return;
    const t0 = c.currentTime + delai;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (vers) o.frequency.exponentialRampToValueAtTime(Math.max(20, vers), t0 + duree);
    // Attaque courte puis extinction : sans elle, chaque son claque.
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + .012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duree);
    o.connect(g).connect(c.destination);
    o.start(t0); o.stop(t0 + duree + .03);
  }

  /** Du bruit filtré : tout ce qui est souffle, foule ou frottement. */
  function bruit({ duree = .3, freq = 800, vol = .1, delai = 0 }) {
    const c = contexte(); if (!c) return;
    const t0 = c.currentTime + delai;
    const n = Math.floor(c.sampleRate * duree);
    const buf = c.createBuffer(1, n, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 1.2;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duree);
    src.connect(f).connect(g).connect(c.destination);
    src.start(t0); src.stop(t0 + duree);
  }

  /**
   * La banque de sons. Chacun tient en une ou deux lignes, et c'est voulu :
   * un son de jeu doit être court et reconnaissable, pas joli.
   */
  const SONS = {
    pousse:  () => ton({ freq: 190, vers: 62, duree: .15, type: 'triangle', vol: .15 }),
    contre:  () => ton({ freq: 130, vers: 55, duree: .18, type: 'triangle', vol: .1 }),
    chant:   () => { bruit({ duree: .26, freq: 750, vol: .09 });
                     ton({ freq: 300, vers: 520, duree: .2, vol: .09 }); },
    parfait: () => { bruit({ duree: .3, freq: 1100, vol: .1 });
                     [523, 659, 784].forEach((f, i) =>
                       ton({ freq: f, duree: .3, type: 'sine', vol: .09, delai: i * .05 })); },
    carte:   () => ton({ freq: 880, vers: 400, duree: .08, type: 'square', vol: .06 }),
    bache:   () => ton({ freq: 115, vers: 70, duree: .22, type: 'sine', vol: .13 }),
    tic:     () => ton({ freq: 1200, duree: .03, type: 'square', vol: .05 }),
    // La corne de but : trois notes tenues, comme un klaxon de tribune.
    but:     () => { [392, 494, 587].forEach((f, i) =>
                       ton({ freq: f, duree: .55, type: 'sawtooth', vol: .09, delai: i * .12 }));
                     bruit({ duree: .9, freq: 300, vol: .07, delai: .1 }); },
    encaisse: () => ton({ freq: 210, vers: 85, duree: .7, type: 'sawtooth', vol: .09 }),
    /* L'évolution, en deux sons parce qu'elle est en deux temps.

       La charge monte pendant une seconde — c'est exactement la durée de
       l'animation, et les deux doivent finir ensemble : un son qui s'arrête
       avant la lumière fait retomber le geste au moment où il culmine.

       Le second est un accord qui se pose. Trois notes, comme le but, mais
       tenues plus longtemps et sans le bruit de foule : on ne fête pas la même
       chose. */
    charge:  () => { ton({ freq: 140, vers: 720, duree: 1, type: 'sawtooth', vol: .07 });
                     bruit({ duree: 1, freq: 900, vol: .05 }); },
    evolue:  () => { [523, 659, 784, 1047].forEach((f, i) =>
                       ton({ freq: f, duree: .85, type: 'sine', vol: .085, delai: i * .06 }));
                     bruit({ duree: .35, freq: 1400, vol: .07 }); },
    butReel: () => { SONS.but(); bruit({ duree: 1.4, freq: 420, vol: .08, delai: .15 }); },
  };

  const son = (nom) => { try { SONS[nom]?.(); } catch { /* le son ne doit jamais casser le jeu */ } };

  const FX = {
    couleurs: COULEURS,

    /**
     * Combien de temps un Fanzzy tient la pose d'un moment fort.
     *
     * Quinze secondes, et c'est délibérément long. Les célébrations duraient
     * deux secondes et demie : le temps de sortir le téléphone de sa poche,
     * le personnage était déjà revenu au repos et le but n'avait laissé
     * aucune trace. Un moment fort doit être encore là quand on arrive.
     *
     * La constante vit ici parce que la règle vaut pour **tous** les écrans où
     * un Fanzzy réagit — le but, le but encaissé, le carton, la victoire, la
     * défaite. Chaque page qui la recopierait finirait par en avoir sa propre
     * version, et deux écrans du même jeu ne tiendraient plus la pose aussi
     * longtemps.
     */
    MOMENT: 15000,

    /** Une couleur de club, éclaircie jusqu'à se lire sur le fond du jeu. */
    lisible,

    particules, onde, flash, secousse, titre, nombre, animer, reagir,

    /** Joue un son de la banque. Sans effet si le joueur a coupé. */
    son,
    /** Coupe ou rétablit le son, et retient le choix. */
    sonCoupe(v) {
      sonCoupe = Boolean(v);
      try { localStorage.setItem('tbf-son', sonCoupe ? 'coupe' : 'on'); } catch { /* tant pis */ }
      return sonCoupe;
    },
    sonEstCoupe: () => sonCoupe,

    /* Une carte jouée se voit dans `action-art.js`, avec son dessin et sa
       famille. Il y avait ici une version pâle — une onde et le nom en
       craie — que plus personne n'appelait : deux définitions de « à quoi
       ressemble une carte qu'on joue », dont une morte. */

    /** Un but dans le jeu. Le plus gros effet dont on dispose. */
    but({ pour = true, score } = {}) {
      flash(pour ? '#fff' : 'rgba(224,64,44,.55)');
      secousse(1.4);
      const x = innerWidth / 2;
      const y = innerHeight * 0.42;
      onde({ x, y, couleur: pour ? COULEURS.or : COULEURS.feu, taille: 620 });
      particules({ x, y, n: 90, distance: 300, taille: 7, duree: 1300,
        couleurs: pour ? [COULEURS.or, COULEURS.feu, '#FFF3D0'] : [COULEURS.feu, '#7A1A11'] });
      titre(pour ? 'BUT !' : 'BUT ADVERSE', score ? `${score[0]} – ${score[1]}` : null,
        pour ? COULEURS.or : COULEURS.feu, pour ? 56 : 40);
      buzz(pour ? [45, 55, 130] : 220);
      son(pour ? 'but' : 'encaisse');
    },

    /** Un but dans le vrai match : mêmes codes, plus le contexte. */
    butReel({ pour = true, buteur, minute } = {}) {
      this.but({ pour });
      setTimeout(() => titre(pour ? 'BUT RÉEL' : 'BUT ENCAISSÉ',
        [buteur, minute ? `${minute}'` : null].filter(Boolean).join(' · '),
        pour ? COULEURS.or : COULEURS.feu, 34), 900);
    },

    /** Carton jaune ou rouge, brandi comme un arbitre le ferait. */
    carton(couleur = 'jaune', { joueur, minute } = {}) {
      const c = document.createElement('div');
      c.className = 'fx-carton';
      c.style.background = couleur === 'rouge'
        ? 'linear-gradient(150deg,#E0402C,#8E1D12)'
        : 'linear-gradient(150deg,#F5C33B,#B8860B)';
      document.body.appendChild(c);
      requestAnimationFrame(() => c.classList.add('go'));
      setTimeout(() => c.remove(), 1600);
      buzz(couleur === 'rouge' ? [40, 40, 40] : 25);
      if (joueur) {
        setTimeout(() => titre(couleur === 'rouge' ? 'ROUGE' : 'JAUNE',
          [joueur, minute ? `${minute}'` : null].filter(Boolean).join(' · '),
          couleur === 'rouge' ? COULEURS.feu : COULEURS.or, 30), 500);
      }
    },

    /** Bandeau d'annonce : temps fort, minute double, mi-temps. */
    bandeau(texte, couleur = COULEURS.or) {
      const b = document.createElement('div');
      b.className = 'fx-bandeau';
      b.style.background = couleur;
      b.textContent = texte;
      document.body.appendChild(b);
      requestAnimationFrame(() => b.classList.add('go'));
      setTimeout(() => b.remove(), 3100);
      buzz([25, 35, 25]);
    },

    /** Poussée reçue ou donnée, chiffrée à l'endroit du geste. */
    poussee(valeur, element, { pour = true } = {}) {
      const { x, y } = centre(element);
      nombre(Math.round(valeur), { x, y, couleur: pour ? COULEURS.or : COULEURS.bleu });
      if (Math.abs(valeur) > 40) {
        particules({ x, y, n: 14, distance: 90, taille: 4,
          couleurs: [pour ? COULEURS.or : COULEURS.bleu] });
      }
    },

    /**
     * Ce que **mon** geste vient de rapporter, en grand.
     *
     * `poussee` reste ce qu'elle était : un nombre de vingt-deux pixels qui
     * monte et s'efface, et c'est très bien pour la poussée d'en face — on doit
     * la voir sans qu'elle prenne l'écran.
     *
     * Le sien, non. Un joueur qui vient de tenir une jauge pendant huit
     * secondes regardait un chiffre de la taille d'une étiquette passer au
     * milieu d'une corde qui bouge, d'une foule qui s'anime et d'un fil de
     * match qui défile. Il ne voyait pas ce qu'il avait gagné — donc il ne
     * pouvait pas savoir si son geste avait valu la peine, ce qui est la seule
     * chose qu'un mini-jeu doit lui apprendre.
     *
     * Trois différences, et chacune sert : **deux fois plus gros**, un **mot
     * dessous** qui dit de quoi il s'agit, et une **montée plus lente** — un
     * nombre qui s'efface en une seconde se lit au jugé, pas en entier.
     */
    /* `ou` est **un élément ou un point**. Le Virage a un nœud à l'écran et le
       passe tel quel ; le duel calcule la position de la corde lui-même et n'a
       qu'un couple de coordonnées. Exiger la même forme des deux aurait obligé
       l'un à fabriquer un élément factice pour se faire mesurer. */
    points(valeur, ou, { couleur = COULEURS.or, quoi = '', signe = true } = {}) {
      const { x, y } = (ou && typeof ou.x === 'number') ? ou : centre(ou);
      const v = Math.round(valeur);
      const n = document.createElement('div');
      n.className = 'fx-points';
      n.style.cssText = `left:${x}px;top:${y}px;color:${couleur}`;
      n.innerHTML = `<b>${signe && v > 0 ? '+' : ''}${v}</b>`
        + (quoi ? `<span>${String(quoi).replace(/[<>&]/g, '')}</span>` : '');
      document.body.appendChild(n);
      n.animate([
        { transform: 'translate(-50%,-50%) scale(.6)', opacity: 0 },
        { transform: 'translate(-50%,-85%) scale(1.15)', opacity: 1, offset: .22 },
        { transform: 'translate(-50%,-105%) scale(1)', opacity: 1, offset: .68 },
        { transform: 'translate(-50%,-165%) scale(.96)', opacity: 0 },
      ], { duration: 1650, easing: 'cubic-bezier(.16,.9,.25,1)' }).onfinish = () => n.remove();
      /* Le seuil est celui de `poussee`, et il est volontairement le même : une
         grosse poussée fait des étincelles, qu'elle soit à soi ou pas. */
      if (Math.abs(v) > 40) {
        particules({ x, y, n: 16, distance: 100, taille: 4, couleurs: [couleur] });
      }
    },

    /** Une carte rare sort d'un booster. */
    rare(rarete = 'd3', element) {
      const { x, y } = centre(element);
      const palette = { epique: [COULEURS.bleu, COULEURS.craie],
        legendaire: [COULEURS.or, COULEURS.feu, '#FFF3D0'] }[rarete]
        ?? [COULEURS.craie];
      onde({ x, y, couleur: palette[0], taille: rarete === 'crown' ? 560 : 340 });
      particules({ x, y, couleurs: palette, distance: rarete === 'crown' ? 260 : 170,
        n: rarete === 'crown' ? 70 : 30, taille: 6, duree: 1200 });
      if (rarete === 'crown') { flash(); secousse(1.2); }
      buzz(rarete === 'crown' ? [40, 50, 40, 50, 120] : 20);
    },

    /**
     * **L'évolution d'un Fanzzy.**
     *
     * Le geste le plus cher du jeu — quatre-vingt-dix écharpes, parfois deux
     * cents — était le seul sans cérémonie : on confirmait, la fiche se
     * rechargeait, et le nouveau personnage était là. Rien n'avait eu lieu.
     *
     * ## Pourquoi elle est ici et non dans la fiche
     *
     * Parce qu'elle se joue à trois endroits — la fiche, le classeur, et le
     * jour où l'accueil fêtera une montée. Une cérémonie recopiée dans chacun
     * finirait par durer trois durées différentes, et le jeu n'aurait plus de
     * rythme à lui. Même raison que `MOMENT`, plus haut.
     *
     * ## La couleur vient de la rareté d'arrivée
     *
     * C'est elle qu'on achète : monter au troisième âge d'un épique doit
     * éclater en violet, pas dans l'or de tout le monde. La légendaire garde
     * l'or, et son flash blanc en plus.
     *
     * ## Ce qu'elle rend
     *
     * Une promesse qui se résout **quand l'ancien a fini de se charger**, à
     * l'instant du flash. C'est là que l'appelant doit remplacer l'image : une
     * seconde plus tôt on verrait la substitution, une seconde plus tard on
     * verrait un trou. Le reste de la cérémonie se joue après, toute seule.
     *
     * @param {Element} portrait  l'image à faire évoluer, si elle est à l'écran
     * @param {object}  o
     * @param {string}  o.nom     le nom du nouvel âge, annoncé en grand
     * @param {string}  o.rar     la rareté d'arrivée : elle donne la couleur
     */
    evolution(portrait, { nom = '', rar = 'commune' } = {}) {
      const PALETTE = {
        commune:    [COULEURS.craie],
        rare:       [COULEURS.bleu, COULEURS.craie],
        epique:     ['#B98CFF', COULEURS.bleu, COULEURS.craie],
        legendaire: [COULEURS.or, COULEURS.feu, '#FFF3D0'],
      };
      const palette = PALETTE[rar] ?? PALETTE.commune;
      const couleur = palette[0];
      const { x, y } = centre(portrait);

      /* La charge. Sans portrait à l'écran — le classeur en vignette, une
         fiche déjà refermée — on saute directement au flash : la cérémonie
         raccourcit, elle ne disparaît pas. */
      if (portrait) {
        portrait.classList.remove('fx-charge');
        void portrait.offsetWidth;
        portrait.classList.add('fx-charge');
      }
      buzz([18, 60, 26, 60, 34]);
      son('charge');

      const CHARGE = portrait ? 1000 : 120;

      return new Promise((resolve) => {
        setTimeout(() => {
          flash(rar === 'legendaire' ? '#fff' : couleur);
          secousse(rar === 'legendaire' ? 1.3 : 1);
          onde({ x, y, couleur, taille: rar === 'legendaire' ? 560 : 400 });
          particules({ x, y, couleurs: palette, taille: 6, duree: 1200,
            n: rar === 'legendaire' ? 70 : rar === 'epique' ? 46 : 30,
            distance: rar === 'legendaire' ? 260 : 190 });
          buzz(rar === 'legendaire' ? [40, 50, 40, 50, 120] : [30, 40, 60]);
          son('evolue');

          /* On rend la main **ici** : l'appelant remplace l'image pendant que
             le blanc la couvre. Le titre tombe juste après, sur le personnage
             déjà en place — l'annoncer avant nommerait quelqu'un qu'on ne voit
             pas encore. */
          resolve({
            /* L'arrivée, à jouer sur la nouvelle image une fois posée. La
               cérémonie ne sait pas quel élément ce sera : la fiche se
               reconstruit entièrement, l'ancien n'existe plus. */
            arrivee(neuf) {
              if (neuf) {
                neuf.classList.remove('fx-arrive');
                void neuf.offsetWidth;
                neuf.classList.add('fx-arrive');
              }
              if (nom) setTimeout(() => titre(nom, 'A GRANDI', couleur, 34), 180);
            },
          });
        }, CHARGE);
      });
    },

    /**
     * Le Cri d'un Fanzzy.
     *
     * Une vidéo par Cri serait ingérable : vingt-sept Fanzzy, vingt-sept
     * fichiers à charger au pire moment. Une seule séquence d'ondes est donc
     * partagée, teintée à la couleur du type et superposée en mode « screen »
     * pour que seul ce qui brille apparaisse. Elle n'est chargée qu'au premier
     * Cri de la session.
     */
    cri(label, { couleur = COULEURS.or, video = '/video/cri.mp4' } = {}) {
      const x = innerWidth / 2, y = innerHeight * 0.42;
      onde({ x, y, couleur, taille: 520 });
      particules({ x, y, n: 46, distance: 210, taille: 6, duree: 1100,
        couleurs: [couleur, '#FFF3D0'] });
      titre(label, null, couleur, 40);
      secousse(1.1);
      buzz([30, 40, 30, 40, 90]);
      if (doux()) return;

      let v = document.getElementById('fx-cri');
      if (!v) {
        v = document.createElement('video');
        v.id = 'fx-cri';
        v.muted = true; v.playsInline = true; v.preload = 'none';
        v.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;object-fit:cover;' +
          'mix-blend-mode:screen;opacity:0;transition:opacity .35s;pointer-events:none;z-index:92';
        document.body.appendChild(v);
      }
      // Absence du fichier : les particules et le titre suffisent, le Cri
      // reste lisible. Aucun effet ne doit dépendre d'un téléchargement.
      v.onerror = () => { v.remove(); };
      if (!v.src) { v.src = video; v.load(); }
      v.style.filter = `hue-rotate(0deg) saturate(1.1)`;
      v.currentTime = 0;
      v.style.opacity = '1';
      v.play?.().catch(() => {});
      clearTimeout(v._t);
      v._t = setTimeout(() => { v.style.opacity = '0'; v.pause?.(); }, 2600);
    },

    /** Fin de duel. */
    fin(gagne, { score } = {}) {
      if (gagne) {
        flash();
        particules({ x: innerWidth / 2, y: innerHeight * 0.35, n: 110, distance: 340,
          taille: 7, duree: 1600, couleurs: [COULEURS.or, '#FFF3D0', COULEURS.feu] });
      }
      titre(gagne ? 'VICTOIRE' : 'DÉFAITE', score ? `${score[0]} – ${score[1]}` : null,
        gagne ? COULEURS.or : COULEURS.craie, 50);
      buzz(gagne ? [60, 60, 60, 60, 180] : 200);
    },
  };

  window.FX = FX;
})();
