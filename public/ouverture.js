/* =======================================================================
   L'ouverture d'un booster, en spectacle : le moteur commun.

   Demandée par Gaël le 24 octobre 2026, dans l'esprit de Clash Royale et de
   Brawl Stars : « de jolies animations pour chaque type de cartes gagnées ».
   Trois temps s'ajoutent à la révélation, sans rien changer à son échelle de
   rareté (`FX.reveler`) :

     le suspense   le paquet tombe sur la scène et tremble une fois par degré
                   de sa meilleure carte (rien pour un paquet de communes,
                   trois secousses et des éclairs pour une légendaire), dans
                   une lueur de cette couleur ;
     la charge     la carte du dessus brille de sa rareté avant qu'on la
                   touche ; une épique se soulève et vibre une demi-seconde
                   avant de se retourner, une légendaire une seconde, la salle
                   éteinte autour d'elle ;
     l'entrée      une fois retournée, chaque sorte de carte a son geste : le
                   Fanzzy saute, l'expression se dandine, la pièce tourne sur
                   elle-même, la tenue passe derrière un rideau, le stade
                   allume ses projecteurs, la carte action claque, les
                   écharpes pleuvent. Son mot (« FANZZY », « TENUE »…) se colle
                   sous la carte.

   **Deux pages l'emploient**, le kiosque (`boosters.html`) et le paquet de
   bienvenue (`bienvenue.html`). Le second avait gardé l'ouverture d'avant —
   une gerbe filmée et des étincelles, la même pour toutes les cartes — et
   Gaël l'a remarqué le 28 octobre 2026 : le premier paquet, celui dont on se
   souvient, était le moins fêté du jeu. Le code est donc ici, une fois :
   deux cérémonies recopiées finissent par ne plus se ressembler.

   Ce que la page fournit : une scène (`.kq-scene`) où s'empilent les cartes
   `.reveal` (avec `data-rar` et `data-sorte`), une salle (`.kq-salle`) que la
   légendaire éteint, et une vidéo `.kq-fond` derrière la carte. Le reste — la
   pile, les touchers, ce qui suit la dernière carte — reste à la page.

   **Les propriétés `translate`, `scale` et `rotate`, jamais `transform`** :
   la pile pose ses cartes par `transform` en ligne, et le retournement est un
   `transform` de `.flip`. Les propriétés à part se composent avec eux au lieu
   de les écraser.

   **Le mouvement part, l'information reste** — sous `prefers-reduced-motion`
   comme sous le mode calme (« animations ») : ni suspense ni charge, la carte
   se retourne au premier toucher, et sa sorte se lit sur son mot.
   ======================================================================= */
(() => {
  const CSS = `
.reveal{--rc:var(--r-commune)}
.kq-scene::before{content:"";position:absolute;left:50%;top:50%;width:min(170vw,820px);aspect-ratio:1;
  translate:-50% -50%;border-radius:50%;pointer-events:none;opacity:0;
  background:radial-gradient(closest-side,color-mix(in srgb,var(--rc,#fff) 90%,transparent),
    color-mix(in srgb,var(--rc,#fff) 45%,transparent) 38%,transparent 70%)}
.kq-scene.kq-attente:not([data-best=commune])>.reveal .face.back{
  box-shadow:0 0 0 3px var(--kq-best),0 0 50px 14px color-mix(in srgb,var(--kq-best) 80%,transparent)}
.kq-scene.kq-attente::before{animation:kq-lueur var(--kq-t,1s) ease-out both}
.kq-scene.kq-apres::before{animation:kq-eteint .5s ease-out both}
@keyframes kq-eteint{from{opacity:.9;scale:1.05}to{opacity:0;scale:1.15}}
.kq-scene.kq-attente[data-best=legendaire]::before{animation:kq-lueur var(--kq-t,1s) ease-out both,
  kq-eclairs .19s steps(2) .4s 6}
@keyframes kq-lueur{0%{opacity:0;scale:.4}30%{opacity:.8;scale:.85}100%{opacity:.9;scale:1.05}}
@keyframes kq-eclairs{50%{filter:brightness(2.4)}}
.kq-scene.kq-attente>.reveal{animation:kq-tombe .36s cubic-bezier(.2,.9,.3,1.25) both,
  kq-tremble .38s ease-in-out .36s var(--kq-n,0)}
@keyframes kq-tombe{from{translate:0 -70vh;rotate:-8deg}}
@keyframes kq-tremble{20%{translate:-7px 0;rotate:-3deg}40%{translate:6px -3px;rotate:3deg}
  60%{translate:-5px 0;rotate:-2deg}80%{translate:3px 0;rotate:1deg}}

.reveal.kq-dessus:not(.flipped):not([data-rar=commune]) .face.back{
  box-shadow:0 0 0 2px var(--rc),0 0 26px 4px color-mix(in srgb,var(--rc) 70%,transparent),
    0 18px 36px rgba(0,0,0,.6)}
.reveal.kq-dessus:not(.flipped):is([data-rar=epique],[data-rar=legendaire]) .face.back{
  animation:kq-pouls 1.1s ease-in-out infinite}
@keyframes kq-pouls{50%{box-shadow:0 0 0 3px var(--rc),0 0 46px 12px color-mix(in srgb,var(--rc) 80%,transparent),
  0 18px 36px rgba(0,0,0,.6)}}

.reveal.kq-charge .flip{scale:1.1;translate:0 -5%;transition:scale var(--kq-t,.5s) ease-in,translate var(--kq-t,.5s) ease-in;
  animation:kq-vibre .07s linear infinite}
.reveal.kq-charge .face.back{box-shadow:0 0 0 3px var(--rc),0 0 70px 22px var(--rc)!important}
@keyframes kq-vibre{25%{rotate:-1.6deg}75%{rotate:1.6deg}}
.kq-salle::before{content:"";position:absolute;inset:0;z-index:1;background:#000;opacity:0;
  pointer-events:none;transition:opacity .35s}
.kq-salle.kq-nuit::before{opacity:.7}
.kq-salle>.kq-fond{position:absolute;top:0;left:50%;translate:-50% 0;z-index:1;
  width:var(--colonne,100%);height:100%;max-width:none;margin:0;
  object-fit:cover;mix-blend-mode:screen;opacity:0;transition:opacity .35s;pointer-events:none}
.kq-salle>.kq-fond.on{opacity:var(--kq-op,.85)}

.reveal.kq-entree[data-sorte=fanzzy] .flip{animation:kq-saut .62s cubic-bezier(.3,.7,.4,1)}
@keyframes kq-saut{0%{translate:0 0;scale:1}35%{translate:0 -10%;scale:1.05 1.1}
  62%{translate:0 0;scale:1.1 .9}82%{scale:.97 1.03}100%{translate:0 0;scale:1}}
.reveal.kq-entree[data-sorte=etat] .flip{animation:kq-dandine .6s ease-in-out}
@keyframes kq-dandine{0%{rotate:0;scale:1}20%{rotate:-7deg;scale:1.06}45%{rotate:6deg}70%{rotate:-3deg}100%{rotate:0;scale:1}}
.reveal.kq-entree[data-sorte=stuff] .flip{animation:kq-tourne .75s cubic-bezier(.2,.7,.3,1)}
@keyframes kq-tourne{from{rotate:y 0deg;scale:.9}to{rotate:y 360deg;scale:1}}
.reveal.kq-entree[data-sorte=skin] .face.front::after{content:"";position:absolute;inset:0;z-index:5;
  border-radius:inherit;pointer-events:none;
  background:linear-gradient(180deg,rgba(0,0,0,.35),transparent 30%),
    repeating-linear-gradient(90deg,#9B1D2E 0 11px,#6F1220 11px 22px);
  animation:kq-rideau .7s cubic-bezier(.6,0,.3,1) both}
@keyframes kq-rideau{0%{clip-path:inset(0 0 100% 0)}25%,40%{clip-path:inset(0)}100%{clip-path:inset(0 0 100% 0)}}
.reveal.kq-entree[data-sorte=lieu] .face.front{animation:kq-projo .8s linear}
@keyframes kq-projo{0%,8%{filter:brightness(.2)}10%{filter:brightness(1.35)}26%{filter:brightness(.5)}
  30%{filter:brightness(1.4)}46%{filter:brightness(.75)}50%{filter:brightness(1.3)}100%{filter:brightness(1)}}
.reveal.kq-entree[data-sorte=action] .flip{animation:kq-claque .5s ease-out}
@keyframes kq-claque{0%{translate:0;filter:brightness(1)}10%{translate:-5% 0;filter:brightness(2.3)}
  22%{translate:5% 0}34%{translate:-3% 0;filter:brightness(1)}48%{translate:2% 0}64%{translate:0}}
.reveal.kq-entree[data-sorte=echarpes] .flip{animation:kq-pop .45s cubic-bezier(.2,1.6,.35,1)}
@keyframes kq-pop{from{scale:.82}}
.reveal>.kq-sorte{position:absolute;z-index:4;left:50%;bottom:-13px;translate:-50% 0;pointer-events:none}
.reveal>.kq-sorte>.tbf-sticker{--rot:-3deg;height:26px;font-size:12.5px;letter-spacing:.08em;
  white-space:nowrap}

@media (prefers-reduced-motion:reduce){
  .kq-scene::before,.kq-scene>.reveal{animation:none!important}
  .reveal.kq-charge .flip{scale:1;translate:0}
  .kq-salle>.kq-fond{display:none}
}
html[data-calme~="animations"] .kq-salle>.kq-fond{display:none}
html[data-calme~="animations"] .kq-scene::before,
html[data-calme~="animations"] .kq-scene>.reveal{animation:none!important}
`;

  if (!document.getElementById('kq-css')) {
    const st = document.createElement('style');
    st.id = 'kq-css';
    st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  const DEGRES = ['commune', 'rare', 'epique', 'legendaire'];

  const calme = (facette) => (document.documentElement.dataset.calme ?? '').split(' ').includes(facette);
  const sansMouvement = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
    || calme('animations');
  const buzz = (p) => {
    if (calme('vibrations')) return;
    try { navigator.vibrate?.(p); } catch { /* rien */ }
  };
  const jouerSon = (nom) => { try { window.FX?.son?.(nom); } catch { /* le son ne casse rien */ } };
  const esc = (s) => String(s ?? '').replace(/[<>&"]/g,
    (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

  /** Retire `classe` une fois l'animation `animation` finie sur `el` lui-même. */
  function aLaFin(el, classe, animation) {
    const fin = (e) => {
      if (e.target !== el || e.animationName !== animation) return;
      el.classList.remove(classe);
      el.removeEventListener('animationend', fin);
    };
    el.addEventListener('animationend', fin);
  }

  /** La sorte d'une carte du paquet, telle que `carteDuPaquet` la rend. */
  function sorteDe(f) {
    if (f?.etat) return 'etat';
    if (f?.skin) return 'skin';
    if (f?.stuff) return 'stuff';
    if (f?.lieu) return 'lieu';
    if (f?.action) return 'action';
    if (f?.echarpes) return 'echarpes';
    return 'fanzzy';
  }

  /* Le mot collé sous la carte, et le bruit de son entrée. La carte action a
     déjà son bruitage, celui qu'on entend quand on la joue en duel : c'est
     lui qu'elle fait entendre, l'éclair n'est que son repli. */
  const SORTES = {
    fanzzy: { mot: 'FANZZY', son: 'saut', ton: 'flare' },
    etat: { mot: 'EXPRESSION', son: 'bulle', ton: 'bleu' },
    skin: { mot: 'TENUE', son: 'tissu', ton: 'bleu' },
    stuff: { mot: 'ÉQUIPEMENT', son: 'metal', ton: 'craie' },
    lieu: { mot: 'STADE', son: 'projecteur', ton: 'vert' },
    action: { mot: 'CARTE ACTION', son: 'eclair', ton: 'flare' },
    echarpes: { mot: 'ÉCHARPES', son: 'butin', ton: 'or' },
  };

  /**
   * Le suspense : le paquet tombe et tremble une fois par degré de sa
   * meilleure carte. `rarites` est la liste des raretés du paquet. Rien sans
   * mouvement. `finirSuspense(scene)` l'abrège.
   */
  function suspense(scene, rarites) {
    const best = rarites.reduce((m, r) => Math.max(m, DEGRES.indexOf(r)), 0);
    if (sansMouvement() || !rarites.length) return;
    const PAS = 380;
    const duree = 360 + best * PAS + (best ? 120 : 0);
    scene.style.setProperty('--rc', `var(--r-${DEGRES[best]})`);
    scene.style.setProperty('--kq-best', `var(--r-${DEGRES[best]})`);
    scene.style.setProperty('--kq-n', String(best));
    scene.style.setProperty('--kq-t', `${duree}ms`);
    scene.dataset.best = DEGRES[best];
    scene.classList.add('kq-attente');
    const minuteries = [];
    for (let k = 0; k < best; k++) {
      minuteries.push(setTimeout(() => {
        jouerSon('tremble');
        buzz(12 + k * 10);
      }, 360 + k * PAS));
    }
    if (best === 3) minuteries.push(setTimeout(() => jouerSon('eclair'), 400));
    minuteries.push(setTimeout(() => finirSuspense(scene), duree));
    scene._kqAttente = minuteries;
  }

  /** Le suspense en cours s'arrête ; vrai s'il y en avait un. */
  function finirSuspense(scene) {
    const m = scene?._kqAttente;
    if (!m) return false;
    m.forEach(clearTimeout);
    scene._kqAttente = null;
    scene.classList.remove('kq-attente');
    delete scene.dataset.best;
    if (!sansMouvement()) {
      scene.classList.add('kq-apres');
      setTimeout(() => scene.classList.remove('kq-apres'), 520);
    }
    return true;
  }

  const enSuspense = (scene) => Boolean(scene?._kqAttente);

  /**
   * La charge d'une épique ou d'une légendaire, avant son retournement.
   * `salle` s'éteint pour la légendaire ; `apres` retourne la carte. Rend
   * une fonction qui abrège la charge (le toucher n'attend jamais) ; son
   * `annuler()` l'arrête sans rien retourner.
   */
  function charger(cur, { salle, hint, apres }) {
    const leg = cur.dataset.rar === 'legendaire';
    const t = leg ? 1000 : 480;
    cur.style.setProperty('--kq-t', `${t}ms`);
    cur.classList.add('kq-charge');
    if (leg) {
      salle?.classList.add('kq-nuit');
      jouerSon('charge');
      buzz([15, 60, 20, 60, 30, 60, 40]);
    } else {
      jouerSon('tremble');
      buzz(14);
    }
    if (hint) hint.textContent = leg ? 'Elle arrive…' : 'Ça brille…';
    let fini = false;
    const lacher = () => {
      if (fini) return;
      fini = true;
      clearTimeout(minuterie);
      cur.classList.remove('kq-charge');
      apres();
    };
    const minuterie = setTimeout(lacher, t);
    /* Quitter l'écran pendant la charge : elle s'arrête, sans retourner. */
    lacher.annuler = () => {
      fini = true;
      clearTimeout(minuterie);
      cur.classList.remove('kq-charge');
    };
    return lacher;
  }

  /** L'entrée de la carte qu'on vient de retourner : son geste, son mot, son bruit. */
  function entree(cur, f) {
    const sorte = cur.dataset.sorte;
    const def = SORTES[sorte] ?? SORTES.fanzzy;
    const mot = document.createElement('b');
    mot.className = 'kq-sorte';
    mot.innerHTML = `<span class="tbf-sticker tbf-colle" data-ton="${def.ton}">${esc(def.mot)}</span>`;
    aLaFin(mot.firstElementChild, 'tbf-colle', 'tbf-colle');
    cur.append(mot);
    const action = sorte === 'action' && window.TBF_SON?.noms?.().includes(f?.id) ? f.id : null;
    jouerSon(action ?? def.son);
    if (sansMouvement()) return;
    cur.classList.add('kq-entree');
    if (sorte === 'echarpes') {
      const r = cur.getBoundingClientRect();
      window.FX?.particules?.({ x: r.left + r.width / 2, y: r.top + r.height * 0.45, n: 30,
        couleurs: ['#F5C33B', '#B8321F', '#F2EEE4'], distance: Math.max(140, r.width), taille: 7, duree: 1000 });
    }
  }

  /**
   * **La commune a sa petite fête** (25 octobre 2026, demande de Gaël). La
   * cérémonie des raretés ne lui donne que le retournement — c'est la règle de
   * `FX.reveler`, et elle est juste : la rare, l'épique et la légendaire
   * doivent rester au-dessus. Mais une commune qui tombe sans rien se lisait
   * comme un raté. Elle a donc un geste à elle, à sa mesure : une onde de
   * craie, un nuage de poussière blanche et une poignée de confettis de
   * papier, sans couleur de rareté ni lueur, et derrière elle son fond filmé
   * (une explosion de craie sous un projecteur, Artlist, choisie par Gaël),
   * plus bas que celui des autres (`fondFilme`). Une seconde, et rien sans
   * mouvement.
   */
  function feteCommune(carte) {
    const F = window.FX;
    if (!F || sansMouvement()) return;
    const r = carte.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const craie = F.couleurs?.craie ?? '#F2EEE4';
    F.onde?.({ x, y, couleur: craie, taille: Math.max(240, r.width * 1.8) });
    F.particules?.({ x, y, n: 30, couleurs: [craie, '#C2CAD6', '#E4D3B5'], distance: 190, taille: 5, duree: 900 });
    F.particules?.({ x, y: r.top + r.height * 0.25, n: 14, papier: true, couleurs: [craie, '#E4D3B5', '#C2CAD6'],
      distance: 160, duree: 1000 });
  }

  /* Les fonds filmés (Artlist, 24 et 25 octobre 2026), par rareté : une
     gerbe d'or derrière la légendaire, un tourbillon violet derrière
     l'épique, posés en « screen » sur le noir de l'écran, sous la carte.
     Jamais chargés sans mouvement ni en économie de données. */
  const FONDS = {
    commune: '/video/fond-commune.cb81fe4f.mp4',
    rare: '/video/fond-rare.fcda8ceb.mp4',
    epique: '/video/fond-epique.802306fa.mp4',
    legendaire: '/video/fond-legendaire.942fde94.mp4',
  };

  /** Le fond filmé derrière la carte qui se retourne, trois secondes. */
  function fondFilme(v, rar) {
    if (!v) return;
    clearTimeout(v._t);
    const src = FONDS[rar];
    if (!src || sansMouvement() || navigator.connection?.saveData) { eteindreFond(v); return; }
    if (v.getAttribute('src') !== src) { v.src = src; v.load(); }
    try { v.currentTime = 0; } catch { /* pas encore chargée */ }
    /* La commune a le sien plus bas : un nuage de craie, pas une fête. */
    v.style.setProperty('--kq-op', rar === 'commune' ? '.55' : '.85');
    v.classList.add('on');
    v.play?.()?.catch?.(() => {});
    v._t = setTimeout(() => eteindreFond(v), 3200);
  }
  function eteindreFond(v) {
    if (!v) return;
    clearTimeout(v._t);
    v.classList.remove('on');
    v.pause?.();
  }

  /**
   * La cérémonie de la rareté d'une carte qui se retourne : le jingle de la
   * rareté s'il est prêt (il remplace alors le son de la cérémonie), le fond
   * filmé, et l'échelle commune `FX.reveler`. Rend la promesse de sa fin.
   */
  function ceremonie(cur, rar, fond) {
    let chante = false;
    try { chante = window.TBF_SON?.jingle?.(rar) === true; } catch { /* le son ne casse rien */ }
    fondFilme(fond, rar);
    return Promise.resolve(window.FX?.reveler?.(rar, cur, { son: !chante })).catch(() => {});
  }

  window.TBF_OUVERTURE = {
    DEGRES, SORTES, FONDS, sorteDe, sansMouvement,
    suspense, finirSuspense, enSuspense, charger, entree, feteCommune,
    fondFilme, eteindreFond, ceremonie,
  };
})();
