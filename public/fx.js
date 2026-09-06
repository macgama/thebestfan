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

  /* ------------------------------------------------------------- styles */

  const css = `
  .fx-layer{position:fixed;inset:0;pointer-events:none;z-index:90;overflow:hidden}
  .fx-p{position:absolute;border-radius:50%;will-change:transform,opacity}
  .fx-flash{position:fixed;inset:0;pointer-events:none;z-index:91;opacity:0}
  .fx-flash.go{animation:fxflash .5s ease-out}
  @keyframes fxflash{0%{opacity:.85}100%{opacity:0}}
  .fx-shake{animation:fxshake .62s cubic-bezier(.36,.07,.19,.97)}
  @keyframes fxshake{0%,100%{transform:translate(0,0)}
    12%{transform:translate(-8px,4px)}28%{transform:translate(7px,-6px)}
    46%{transform:translate(-6px,-3px)}64%{transform:translate(5px,4px)}
    82%{transform:translate(-3px,2px)}}
  .fx-titre{position:fixed;left:50%;top:38%;transform:translate(-50%,-50%);z-index:93;
    font-family:"Oswald","Arial Narrow",Impact,sans-serif;letter-spacing:.08em;text-align:center;
    pointer-events:none;text-shadow:0 6px 34px rgba(0,0,0,.95);opacity:0;white-space:nowrap}
  .fx-titre.go{animation:fxtitre 1.7s cubic-bezier(.2,.9,.3,1)}
  @keyframes fxtitre{0%{opacity:0;transform:translate(-50%,-50%) scale(.55)}
    16%{opacity:1;transform:translate(-50%,-50%) scale(1.08)}
    26%{transform:translate(-50%,-50%) scale(1)}
    78%{opacity:1}100%{opacity:0;transform:translate(-50%,-62%) scale(.98)}}
  .fx-sous{display:block;font-family:ui-sans-serif,system-ui,sans-serif;font-size:12px;
    letter-spacing:.18em;opacity:.75;margin-top:9px;font-weight:400}
  .fx-nombre{position:fixed;z-index:92;font-family:"Oswald","Arial Narrow",Impact,sans-serif;
    font-size:22px;pointer-events:none;text-shadow:0 3px 14px rgba(0,0,0,.9)}
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

  const style = document.createElement('style');
  style.textContent = css;
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

  const FX = {
    couleurs: COULEURS,
    particules, onde, flash, secousse, titre, nombre,

    /** Une carte est jouée : impulsion depuis la carte, onde, éclat. */
    carte(element, { couleur = COULEURS.violet, nom } = {}) {
      const { x, y } = centre(element);
      onde({ x, y, couleur, taille: 260 });
      particules({ x, y, n: 18, couleurs: [couleur, COULEURS.craie], distance: 110, taille: 4 });
      buzz(14);
      if (nom) nombre(nom, { x, y: y - 20, couleur, signe: false });
      if (element && !doux()) {
        element.animate([
          { transform: 'scale(1)' }, { transform: 'scale(1.12)', offset: .3 },
          { transform: 'scale(.9)', opacity: .4, offset: .7 }, { transform: 'scale(1)', opacity: 1 },
        ], { duration: 420, easing: 'ease-out' });
      }
    },

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

    /** Une carte rare sort d'un booster. */
    rare(rarete = 'd3', element) {
      const { x, y } = centre(element);
      const palette = { d3: [COULEURS.bleu, COULEURS.craie],
        star: [COULEURS.or, '#FFF3D0'], crown: [COULEURS.or, COULEURS.feu, '#FFF3D0'] }[rarete]
        ?? [COULEURS.craie];
      onde({ x, y, couleur: palette[0], taille: rarete === 'crown' ? 560 : 340 });
      particules({ x, y, couleurs: palette, distance: rarete === 'crown' ? 260 : 170,
        n: rarete === 'crown' ? 70 : 30, taille: 6, duree: 1200 });
      if (rarete === 'crown') { flash(); secousse(1.2); }
      buzz(rarete === 'crown' ? [40, 50, 40, 50, 120] : 20);
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
