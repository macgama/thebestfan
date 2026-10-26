/**
 * La scène de l'Ultimate : le coup fatal d'un Fanzzy, en plein écran.
 *
 * ## Deux scènes, une seule poussée
 *
 * Tout le monde a l'Ultimate, et il pousse pareil pour tous
 * (`src/shared/ultime.js`). Ce qui se gagne en booster, c'est **la grande
 * scène** : la carte Ultimate d'un âge la débloque, et la tribune d'en face
 * la voit aussi. C'est le choix de Gaël du 26 octobre 2026, « Visuel à
 * collectionner » : l'envie d'y arriver et de la montrer, sans que payer
 * fasse gagner.
 *
 *   - **la scène courte** (1,6 s) — la salle s'assombrit, le Fanzzy surgit
 *     dans la lumière de sa famille, son cri claque en grand, l'éclair ;
 *   - **la grande scène** (3,4 s) — le noir complet, les rayons qui tournent,
 *     les lignes de vitesse, le Fanzzy qui grandit jusqu'à remplir l'écran,
 *     le bandeau ULTIMATE, le cri lettre à lettre, l'onde de choc et les
 *     étincelles.
 *
 * ## Ce que le fichier ne fait pas
 *
 * Il ne connaît aucune règle et ne parle à aucun serveur : la page lui donne
 * l'image, le nom, le cri et la couleur, et il joue. Le duel, le Virage et la
 * fiche d'un Fanzzy (qui montre la scène qu'on gagne) l'appellent tous les
 * trois.
 *
 * Sous le calme des animations — celui du système ou celui du joueur —, la
 * scène reste une carte immobile qui dit le cri, une seconde, sans rien qui
 * bouge ni qui clignote.
 *
 * Script classique, pas module : comme tout ce qui vit dans `public/`.
 */
(() => {
  const STYLE = `
.tbf-ult{position:fixed;inset:0;z-index:120;pointer-events:none;overflow:hidden;
  display:grid;place-items:center;--c:#F5C33B;contain:strict}
.tbf-ult-voile{position:absolute;inset:0;background:rgba(7,9,12,.62);opacity:0;
  transition:opacity .18s ease-out}
.tbf-ult.on .tbf-ult-voile{opacity:1}
.tbf-ult[data-grande] .tbf-ult-voile{background:#07090C}
.tbf-ult-rayons{position:absolute;left:50%;top:46%;width:240vmax;height:240vmax;
  margin:-120vmax 0 0 -120vmax;opacity:0;
  background:repeating-conic-gradient(from 0deg,var(--c) 0 6deg,transparent 6deg 18deg,
    rgba(245,195,59,.85) 18deg 21deg,transparent 21deg 30deg);
  -webkit-mask:radial-gradient(circle,#000 0 8%,rgba(0,0,0,.55) 22%,transparent 55%);
          mask:radial-gradient(circle,#000 0 8%,rgba(0,0,0,.55) 22%,transparent 55%)}
.tbf-ult.on .tbf-ult-rayons{animation:tbfUltRayons 3.4s linear forwards}
@keyframes tbfUltRayons{0%{opacity:0;transform:rotate(0) scale(.4)}
  12%{opacity:.9}80%{opacity:.75}100%{opacity:0;transform:rotate(70deg) scale(1.15)}}
.tbf-ult-vitesse{position:absolute;inset:-10%;opacity:0;
  background:repeating-linear-gradient(100deg,transparent 0 22px,rgba(242,238,228,.16) 22px 24px,
    transparent 24px 61px);}
.tbf-ult.on .tbf-ult-vitesse{animation:tbfUltVitesse .5s linear 6 .15s}
@keyframes tbfUltVitesse{0%{opacity:.7;transform:translateX(0)}100%{opacity:.7;transform:translateX(-61px)}}
.tbf-ult-halo{position:absolute;left:50%;top:44%;width:92vmin;height:92vmin;margin:-46vmin 0 0 -46vmin;
  border-radius:50%;opacity:0;
  background:radial-gradient(circle,var(--c) 0,rgba(245,195,59,.35) 28%,transparent 62%)}
.tbf-ult.on .tbf-ult-halo{animation:tbfUltHalo var(--d,1.6s) ease-out forwards}
@keyframes tbfUltHalo{0%{opacity:0;transform:scale(.3)}25%{opacity:.85;transform:scale(1)}
  80%{opacity:.6}100%{opacity:0;transform:scale(1.2)}}
.tbf-ult-fz{position:absolute;left:50%;bottom:22%;height:min(62vh,520px);max-width:92vw;
  transform:translateX(-50%);opacity:0;object-fit:contain;
  filter:drop-shadow(0 0 18px var(--c)) drop-shadow(0 0 2px #fff)}
.tbf-ult.on .tbf-ult-fz{animation:tbfUltFz var(--d,1.6s) cubic-bezier(.2,1.4,.4,1) forwards}
@keyframes tbfUltFz{0%{opacity:0;transform:translateX(-50%) translateY(18%) scale(.55)}
  22%{opacity:1;transform:translateX(-50%) translateY(0) scale(1.06)}
  30%{transform:translateX(-50%) scale(1)}85%{opacity:1}
  100%{opacity:0;transform:translateX(-50%) scale(1.04)}}
.tbf-ult[data-grande].on .tbf-ult-fz{height:min(72vh,620px);
  animation:tbfUltFzGrand 3.4s cubic-bezier(.2,1.2,.4,1) forwards}
@keyframes tbfUltFzGrand{0%{opacity:0;transform:translateX(-50%) scale(.15) rotate(-8deg)}
  18%{opacity:1;transform:translateX(-50%) scale(.7) rotate(0)}
  34%{transform:translateX(-50%) scale(1.12)}40%{transform:translateX(-50%) scale(1)}
  88%{opacity:1;transform:translateX(-50%) scale(1.03)}100%{opacity:0;transform:translateX(-50%) scale(1.25)}}
.tbf-ult-texte{position:absolute;left:0;right:0;bottom:9%;padding:0 16px;text-align:center;
  font-family:var(--banner,"Oswald",Impact,sans-serif);color:#F2EEE4;line-height:.95}
.tbf-ult-bandeau{display:inline-block;padding:3px 12px 4px;margin-bottom:8px;
  background:var(--c);color:#07090C;font-weight:700;letter-spacing:.32em;font-size:13px;
  transform:skewX(-10deg);opacity:0}
.tbf-ult.on .tbf-ult-bandeau{animation:tbfUltBandeau var(--d,1.6s) ease-out forwards}
@keyframes tbfUltBandeau{0%{opacity:0;transform:skewX(-10deg) translateX(-40px)}
  15%{opacity:1;transform:skewX(-10deg) translateX(0)}85%{opacity:1}100%{opacity:0}}
.tbf-ult-cri{display:block;font-weight:700;font-size:clamp(34px,11vw,64px);letter-spacing:.01em;
  text-transform:uppercase;text-shadow:0 0 14px var(--c),0 3px 0 #07090C,0 0 2px #07090C;
  opacity:0;overflow-wrap:anywhere}
.tbf-ult.on .tbf-ult-cri{animation:tbfUltCri var(--d,1.6s) cubic-bezier(.2,1.6,.4,1) forwards}
@keyframes tbfUltCri{0%,18%{opacity:0;transform:scale(2.4)}30%{opacity:1;transform:scale(.94)}
  36%{transform:scale(1)}86%{opacity:1}100%{opacity:0;transform:scale(1.05)}}
.tbf-ult[data-grande] .tbf-ult-cri span{display:inline-block;opacity:0}
.tbf-ult[data-grande].on .tbf-ult-cri{animation:none;opacity:1}
.tbf-ult[data-grande].on .tbf-ult-cri span{animation:tbfUltLettre .32s cubic-bezier(.2,1.8,.4,1) forwards}
@keyframes tbfUltLettre{0%{opacity:0;transform:translateY(-30px) scale(2)}100%{opacity:1;transform:none}}
.tbf-ult[data-grande].sort .tbf-ult-cri{transition:opacity .3s;opacity:0}
.tbf-ult-nom{display:block;margin-top:8px;font-size:15px;letter-spacing:.12em;opacity:0;color:var(--c)}
.tbf-ult.on .tbf-ult-nom{animation:tbfUltBandeau var(--d,1.6s) ease-out forwards}
.tbf-ult[data-eux] .tbf-ult-bandeau{background:#3C82E8;color:#F2EEE4}
.tbf-ult-eclair{position:absolute;inset:0;background:#fff;opacity:0}
.tbf-ult.on .tbf-ult-eclair{animation:tbfUltEclair .5s ease-out forwards;animation-delay:var(--choc,.42s)}
@keyframes tbfUltEclair{0%{opacity:0}12%{opacity:.85}100%{opacity:0}}
.tbf-ult.calme .tbf-ult-voile{opacity:1}
.tbf-ult.calme .tbf-ult-fz,.tbf-ult.calme .tbf-ult-cri,.tbf-ult.calme .tbf-ult-bandeau,
.tbf-ult.calme .tbf-ult-nom,.tbf-ult.calme .tbf-ult-cri span{opacity:1;animation:none!important;transform:translateX(-50%)}
.tbf-ult.calme .tbf-ult-cri,.tbf-ult.calme .tbf-ult-bandeau,.tbf-ult.calme .tbf-ult-nom,
.tbf-ult.calme .tbf-ult-cri span{transform:none}
.tbf-ult.calme .tbf-ult-rayons,.tbf-ult.calme .tbf-ult-vitesse,.tbf-ult.calme .tbf-ult-halo,
.tbf-ult.calme .tbf-ult-eclair{display:none}
`;

  /* Le texte se pose **en texte** : le cri vient du catalogue, le nom d'un
     Fanzzy aussi, et l'un comme l'autre se traduisent (`langue.js`). */
  function poserStyle() {
    if (document.getElementById('tbfUltStyle')) return;
    const s = document.createElement('style');
    s.id = 'tbfUltStyle';
    s.textContent = STYLE;
    document.head.appendChild(s);
  }

  const doux = () => window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    || (document.documentElement.dataset.calme ?? '').split(' ').includes('animations');

  const son = (nom) => { try { window.FX?.son?.(nom); } catch { /* rien */ } };
  /* La règle de `fx.js` (« buzz »), qu'il n'exporte pas : rien sous le calme
     des vibrations, rien avant le premier geste du joueur. */
  const vibrer = (motif) => {
    if ((document.documentElement.dataset.calme ?? '').split(' ').includes('vibrations')) return;
    if (navigator.userActivation?.hasBeenActive === false) return;
    try { navigator.vibrate?.(motif); } catch { /* rien */ }
  };

  let enCours = null;

  /**
   * Joue la scène. Rend une promesse tenue quand elle s'est retirée.
   *
   * @param {object} o
   * @param {string} [o.src]     l'image du Fanzzy (la pose « pousse » si elle existe)
   * @param {string} [o.cri]     le nom de l'Ultimate : le cri de l'âge
   * @param {string} [o.nom]     le nom du Fanzzy à cet âge
   * @param {string} [o.couleur] la couleur de sa famille
   * @param {boolean} [o.grande] la grande scène (la carte Ultimate de cet âge)
   * @param {boolean} [o.eux]    l'Ultimate de la tribune d'en face
   */
  function scene({ src = '', cri = '', nom = '', couleur = '#F5C33B', grande = false, eux = false } = {}) {
    poserStyle();
    // Deux coups fatals à la suite : le second remplace le premier.
    enCours?.couper?.();
    const calme = doux();
    const d = grande ? 3400 : 1600;
    const el = document.createElement('div');
    el.className = 'tbf-ult';
    el.setAttribute('aria-hidden', 'true');
    el.style.setProperty('--c', couleur);
    el.style.setProperty('--d', `${d}ms`);
    el.style.setProperty('--choc', grande ? '1.15s' : '.42s');
    if (grande) el.dataset.grande = '';
    if (eux) el.dataset.eux = '';
    el.innerHTML = `<div class="tbf-ult-voile"></div>
      ${grande ? '<div class="tbf-ult-rayons"></div><div class="tbf-ult-vitesse"></div>' : ''}
      <div class="tbf-ult-halo"></div>
      ${src ? '<img class="tbf-ult-fz" alt="" decoding="async">' : ''}
      <div class="tbf-ult-texte"><span class="tbf-ult-bandeau"></span>
        <b class="tbf-ult-cri"></b><span class="tbf-ult-nom"></span></div>
      <div class="tbf-ult-eclair"></div>`;
    el.querySelector('.tbf-ult-bandeau').textContent = eux ? 'ULTIMATE ADVERSE' : 'ULTIMATE';
    el.querySelector('.tbf-ult-nom').textContent = nom;
    const criEl = el.querySelector('.tbf-ult-cri');
    if (grande && !calme) {
      /* Lettre à lettre, chacune avec son retard : le cri tombe comme une
         banderole qu'on déroule. Les espaces restent des espaces. */
      [...String(cri)].forEach((ch, i) => {
        const s = document.createElement('span');
        s.textContent = ch === ' ' ? ' ' : ch;
        s.style.animationDelay = `${900 + i * 45}ms`;
        criEl.appendChild(s);
      });
    } else {
      criEl.textContent = cri;
    }
    const img = el.querySelector('.tbf-ult-fz');
    if (img) {
      img.onerror = () => {
        const repli = window.TBF_ETATS?.secours?.(img.src, true);
        if (repli && repli !== img.src) img.src = repli; else img.remove();
      };
      img.src = src;
    }
    document.body.appendChild(el);

    const minuteries = [];
    const plus = (ms, f) => minuteries.push(setTimeout(f, ms));
    return new Promise((tenir) => {
      const fin = () => {
        minuteries.forEach(clearTimeout);
        el.remove();
        if (enCours?.el === el) enCours = null;
        tenir();
      };
      enCours = { el, couper: fin };
      if (calme) {
        el.classList.add('calme', 'on');
        son('gong');
        plus(1200, fin);
        return;
      }
      requestAnimationFrame(() => el.classList.add('on'));
      son('charge');
      if (grande) {
        plus(450, () => son('grondement'));
        plus(1150, () => {
          son('rugissement');
          window.FX?.secousse?.(2.2);
          vibrer([60, 40, 140]);
          const x = innerWidth / 2;
          const y = innerHeight * 0.45;
          window.FX?.onde?.({ x, y, couleur, taille: Math.max(innerWidth, innerHeight) * 1.2 });
          window.FX?.particules?.({ x, y, n: 90, couleurs: [couleur, '#F5C33B', '#F2EEE4'],
            distance: Math.max(innerWidth, innerHeight) * 0.6, taille: 7, duree: 1400 });
        });
        plus(2000, () => son(eux ? 'encaisse' : 'ovation'));
        plus(2950, () => el.classList.add('sort'));
      } else {
        plus(420, () => {
          son('rugissement');
          window.FX?.secousse?.(1.4);
          vibrer([40, 30, 90]);
          window.FX?.onde?.({ x: innerWidth / 2, y: innerHeight * 0.45, couleur, taille: 520 });
        });
      }
      plus(d + 60, fin);
    });
  }

  window.TBF_ULTIME = { scene };
})();
