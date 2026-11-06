/**
 * **Donner envie** du PASS (choix de Gaël, 4 novembre 2026 : « Les deux, dans
 * cet ordre » — être vu, puis donner envie). Trois scènes plein écran, en
 * code, avec les dessins du kit (`public/pass.js`) :
 *
 *   TBF_PASS_FETE.essayer(o)  ESSAYER 10 s : mon Fanzzy dans la tenue de la
 *                             saison à ses trois âges, le fond, le cadre,
 *                             l'aura, le titre et le pseudo en or — ce que la
 *                             voie donne, porté par moi, avant d'acheter.
 *   TBF_PASS_FETE.achat(o)    la fête de l'achat : l'écusson tombe et claque,
 *                             la tenue apparaît, ce que le PASS donne.
 *   TBF_PASS_FETE.niveau(o)   un niveau de la voie PASS atteint : le gain
 *                             surgit, les crans s'allument.
 *   TBF_PASS_FETE.verifierNiveau(a)  compare la voie servie par
 *                             `/api/abonnement` au dernier niveau vu dans ce
 *                             téléphone (`tbf-pass-niveau:<saison>`), et fête
 *                             le nouveau. Appelé par `menu.js`.
 *
 * Chaque scène se ferme d'un geste (bouton, Échap, toucher le fond) et rend
 * une promesse : le bouton choisi, ou `null`. Au calme (`prefers-reduced-
 * motion`, `data-calme~=animations`), tout est posé d'un coup. Purement
 * visuel : rien ici ne décide d'un niveau ni d'un droit.
 */
(() => {
  if (window.TBF_PASS_FETE) return;
  const esc = (s) => String(s ?? '').replace(/[<>&"]/g,
    (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  const couleurSure = (c) => (/^#[0-9a-f]{3,8}$/i.test(String(c ?? '')) ? c : '#c9772e');
  const calme = () => matchMedia('(prefers-reduced-motion: reduce)').matches
    || /\banimations\b/.test(document.documentElement.dataset.calme ?? '');
  const MAX = 12;

  /* Le kit et l'écusson viennent de `pass.js` : chargé ici s'il manque. */
  let passPret = null;
  function pass() {
    if (window.TBF_PASS) return Promise.resolve(window.TBF_PASS);
    passPret ??= new Promise((ok) => {
      const s = document.createElement('script');
      s.src = '/pass.js';
      s.onload = () => ok(window.TBF_PASS ?? null);
      s.onerror = () => ok(null);
      document.head.appendChild(s);
    });
    return passPret;
  }

  const CSS = `
.pf-voile{position:fixed;inset:0;z-index:9000;display:grid;place-items:center;padding:16px;
  background:radial-gradient(120% 80% at 50% 40%,#28190b,#070605);
  color:#f6e7c4;font-family:var(--banner,system-ui);overflow:hidden;animation:pfVoile .3s ease both}
.pf-voile[data-fond]{background:linear-gradient(rgba(10,7,4,.55),rgba(10,7,4,.85)),center/cover no-repeat var(--fond)}
@keyframes pfVoile{from{opacity:0}}
.pf-scene{position:relative;width:min(100%,420px);max-height:100%;display:flex;flex-direction:column;
  align-items:center;gap:10px;text-align:center}
.pf-rayons{position:absolute;left:50%;top:38%;width:180vmax;height:180vmax;translate:-50% -50%;pointer-events:none;
  background:repeating-conic-gradient(from 0deg,color-mix(in srgb,var(--pass) 30%,transparent) 0 6deg,transparent 6deg 18deg);
  mask:radial-gradient(closest-side,#000 0,transparent 70%);-webkit-mask:radial-gradient(closest-side,#000 0,transparent 70%);
  animation:pfTourne 24s linear infinite;opacity:.8}
@keyframes pfTourne{to{rotate:360deg}}
.pf-sur{font-size:12px;letter-spacing:.18em;text-transform:uppercase;opacity:.8}
.pf-titre{margin:0;font-size:clamp(24px,8vw,34px);line-height:1.05;letter-spacing:.04em;text-transform:uppercase;
  color:#F5C33B;text-shadow:0 0 18px rgba(245,195,59,.5),0 2px 0 #6b4a05}
.pf-sous{margin:0;font-size:14px;letter-spacing:.06em;text-transform:uppercase;opacity:.92}
.pf-ecusson{position:relative;flex:none;display:grid;place-items:center;width:150px;height:150px}
.pf-ecusson .tbf-pass-badge{--t:110px}
.pf-onde{position:absolute;inset:10%;border-radius:50%;border:3px solid var(--pass);opacity:0}
.pf-etincelles i{position:absolute;left:50%;top:50%;width:6px;height:6px;border-radius:50%;background:#ffd27a;
  box-shadow:0 0 8px 2px var(--pass);opacity:0}
.pf-fz{position:relative;flex:none;width:min(62vw,230px);height:min(44vh,300px);margin:14px 0 6px}
.pf-fz>img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;object-position:50% 100%;
  opacity:0;transition:opacity .45s ease}
.pf-fz>img.on{opacity:1}
.pf-fz>.pf-cadre{position:absolute;inset:-6% -10%;width:120%;height:112%;object-fit:fill;opacity:1;z-index:2;pointer-events:none}
.pf-fz>.pf-aura{position:absolute;left:8%;right:8%;bottom:0;height:60%;border-radius:50%;z-index:-1;
  background:radial-gradient(closest-side,color-mix(in srgb,var(--pass) 70%,#ffcf6b),transparent);filter:blur(10px);
  animation:pfSouffle 2.4s ease-in-out infinite}
@keyframes pfSouffle{50%{opacity:.6;scale:1.08}}
.pf-age{position:absolute;right:-4px;top:6px;z-index:3;padding:2px 8px;border-radius:4px;font-size:11px;
  letter-spacing:.08em;background:var(--pass);color:#1b130a}
.pf-pseudo{display:inline-flex;align-items:center;gap:6px;font-size:22px;letter-spacing:.04em;text-transform:uppercase}
.pf-pseudo b{background:linear-gradient(100deg,#b8862b 0%,#ffe08a 30%,#fff6d0 45%,#f2c14e 60%,#b8862b 100%);
  background-size:220% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;
  animation:pfOr 4s ease-in-out infinite}
@keyframes pfOr{50%{background-position:0 0}0%,100%{background-position:100% 0}}
.pf-pseudo .tbf-pass-badge{--t:30px}
.pf-plaque{padding:5px 18px 4px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#f6e7c4;
  text-shadow:0 1px 1px rgba(0,0,0,.8);background:50% 50%/100% 100% no-repeat var(--plaque,#3a322b)}
.pf-liste{margin:0;padding:0;list-style:none;display:grid;gap:5px;font-family:system-ui,sans-serif;font-size:13px;
  text-align:left;width:100%}
.pf-liste li{display:flex;gap:8px;align-items:center;padding:6px 10px;border-radius:8px;background:rgba(255,255,255,.06)}
.pf-liste li img{width:28px;height:28px;object-fit:contain;flex:none}
.pf-gain{position:relative;flex:none;width:150px;height:150px;display:grid;place-items:center}
.pf-gain>img{width:150px;height:150px;max-width:none;object-fit:contain;filter:drop-shadow(0 6px 14px rgba(0,0,0,.6))}
.pf-crans{display:flex;gap:3px}
.pf-crans i{width:12px;height:16px;border-radius:3px;background:rgba(242,238,228,.18)}
.pf-crans i[data-on]{background:var(--pass);box-shadow:0 0 8px var(--pass)}
.pf-crans i[data-neuf]{background:#F5C33B;box-shadow:0 0 12px #F5C33B}
.pf-jauge{width:100%;height:5px;border-radius:3px;background:rgba(255,255,255,.12);overflow:hidden}
.pf-jauge>i{display:block;height:100%;background:var(--pass);transform-origin:left;transform:scaleX(0)}
.pf-boutons{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:4px}
.pf-boutons button{min-height:44px;padding:0 18px;border:0;border-radius:10px;cursor:pointer;
  font-family:inherit;font-size:14px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}
.pf-boutons [data-oui]{background:linear-gradient(#ffe08a,#F5C33B 55%,#c48a12);color:#2b1d07}
.pf-boutons [data-non]{background:rgba(255,255,255,.12);color:#f6e7c4}
.pf-fermer{position:absolute;right:10px;top:10px;z-index:2;width:40px;height:40px;border:0;border-radius:50%;
  background:rgba(255,255,255,.1);color:#f6e7c4;font-size:22px;line-height:1;cursor:pointer}
.pf-voile:not([data-calme]) .pf-ecusson{animation:pfTombe .7s cubic-bezier(.3,1.6,.45,1) .15s backwards}
.pf-voile:not([data-calme]) .pf-onde{animation:pfOnde .9s ease-out .55s}
.pf-voile:not([data-calme]) .pf-etincelles i{animation:pfEtincelle 1.1s ease-out calc(.55s + var(--r,0s))}
.pf-voile:not([data-calme]) .pf-titre{animation:pfClac .45s cubic-bezier(.2,1.6,.4,1) .75s backwards}
.pf-voile:not([data-calme]) .pf-entre{animation:pfMonte .5s ease calc(.95s + var(--i,0) * .12s) backwards}
.pf-voile:not([data-calme]) .pf-gain{animation:pfSurgit .7s cubic-bezier(.2,1.7,.4,1) .2s backwards}
@keyframes pfTombe{from{opacity:0;translate:0 -60vh;scale:2.4;rotate:-25deg}}
@keyframes pfOnde{0%{opacity:.9;scale:.6}100%{opacity:0;scale:2.6}}
@keyframes pfEtincelle{0%{opacity:1;translate:-50% -50%}100%{opacity:0;
  translate:calc(-50% + var(--dx) * 1px) calc(-50% + var(--dy) * 1px);scale:.3}}
@keyframes pfClac{from{opacity:0;scale:2.2}}
@keyframes pfMonte{from{opacity:0;translate:0 18px}}
@keyframes pfSurgit{from{opacity:0;scale:.2;rotate:-20deg}}
.pf-voile[data-calme] .pf-rayons,.pf-voile[data-calme] .pf-aura,.pf-voile[data-calme] .pf-pseudo b{animation:none}
`;
  function style() {
    if (document.getElementById('pf-style')) return;
    const s = document.createElement('style');
    s.id = 'pf-style';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  /** Le voile, son contenu, et la promesse de sa fermeture. */
  function ouvrir(html, { couleur, fond = '', classe = '', etiquette = 'PASS' } = {}) {
    style();
    document.getElementById('pfVoile')?.remove();
    const v = document.createElement('div');
    v.className = `pf-voile ${classe}`;
    v.id = 'pfVoile';
    v.setAttribute('role', 'dialog');
    v.setAttribute('aria-modal', 'true');
    v.setAttribute('aria-label', etiquette);
    v.style.setProperty('--pass', couleurSure(couleur));
    if (fond) { v.dataset.fond = ''; v.style.setProperty('--fond', `url("${fond}")`); }
    if (calme()) v.dataset.calme = '';
    v.innerHTML = `<div class="pf-rayons" aria-hidden="true"></div>
      <button type="button" class="pf-fermer" data-non aria-label="Fermer">×</button>
      <div class="pf-scene">${html}</div>`;
    document.body.appendChild(v);
    const avant = document.activeElement;
    let fini;
    const promesse = new Promise((ok) => { fini = ok; });
    const fermer = (choix) => {
      if (!v.isConnected) return;
      document.removeEventListener('keydown', touche);
      v.remove();
      try { avant?.focus?.(); } catch { /* rien */ }
      fini(choix);
    };
    const touche = (e) => { if (e.key === 'Escape') { e.preventDefault(); fermer(null); } };
    document.addEventListener('keydown', touche);
    v.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (b?.dataset.oui !== undefined) return fermer(b.dataset.oui || 'oui');
      if (b?.dataset.non !== undefined || e.target === v) return fermer(null);
      if (b?.dataset.choix) return fermer(b.dataset.choix);
    });
    setTimeout(() => (v.querySelector('[data-oui]') ?? v.querySelector('.pf-fermer'))?.focus?.(), 50);
    return { v, promesse, fermer };
  }

  const etincelles = (n = 14) => `<span class="pf-etincelles" aria-hidden="true">${Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const d = 70 + (i % 3) * 22;
    return `<i style="--dx:${Math.round(Math.cos(a) * d)};--dy:${Math.round(Math.sin(a) * d)};--r:${(i % 4) * 0.04}s"></i>`;
  }).join('')}</span>`;

  /** L'adresse d'une pose d'un Fanzzy dans une tenue, comme la vitrine du PASS. */
  const pose = (id, age, tenue, etat = 'pousse') =>
    `/img/fanzzy/${encodeURIComponent(id)}/e${age}/${encodeURIComponent(tenue)}/${etat}.webp`;
  const son = (n) => { try { window.FX?.son?.(n); } catch { /* sans son */ } };

  /* --------------------------------------------------- ESSAYER 10 s */

  /** Mon Fanzzy en jeu (lignée), ou `null`. */
  async function monFanzzy() {
    try {
      const r = await fetch('/api/fanzzy/state', { credentials: 'same-origin' });
      const j = r.ok ? await r.json() : null;
      const a = j?.wallet?.avatarEnJeu;
      return a?.id ? String(a.id).replace(/[^A-Za-z0-9]/g, '') : null;
    } catch { return null; }
  }

  /**
   * `o` : `{ saison, couleur, tenue, titre, pseudo, nom, prix, bientot,
   * quand }`. Rend `'acheter'` si l'on touche PRENDRE LE PASS, `null` sinon.
   */
  async function essayer(o = {}) {
    const P = await pass();
    const k = P?.kit?.(o.saison);
    const tenue = String(o.tenue ?? 'prehistorique').replace(/[^a-z0-9-]/gi, '');
    const mien = o.fanzzy ?? await monFanzzy();
    const repli = (P?.VITRINE ?? [['RP1', 3]])[0][0];
    const qui = mien || repli;
    const ages = [1, 2, 3];
    const imgs = ages.map((a, i) => `<img alt="" data-age="${a}" src="${pose(qui, a, tenue)}"${i === 0 ? ' class="on"' : ''}
      onerror="if(this.dataset.r==='2'){this.remove()}else if(this.dataset.r==='1'){this.dataset.r='2';this.src='${pose(repli, a, tenue)}'}else{this.dataset.r='1';this.src='${pose(qui, a, tenue, 'neutre')}'}">`).join('');
    const pseudo = esc(o.pseudo ?? window.TBF_MOI_PSEUDO ?? 'TOI');
    const badgeOr = P ? P.badge({ saison: o.saison, couleur: o.couleur, or: true }, 'moyen') : '';
    const plaque = k?.titre ? ` style="--plaque:url('${P.image(k.titre)}')"` : '';
    const html = `<span class="pf-sur">ESSAI · 10 SECONDES</span>
      <div class="pf-fz" id="pfFz"><span class="pf-aura" aria-hidden="true"></span>${imgs}
        ${k?.cadre ? P.img(k.cadre, 'pf-cadre') : ''}<span class="pf-age" id="pfAge">ÂGE 1</span></div>
      <span class="pf-pseudo"><b>${pseudo}</b>${badgeOr}</span>
      ${o.titre ? `<span class="pf-plaque"${plaque}>${esc(o.titre)}</span>` : ''}
      <div class="pf-jauge" aria-hidden="true"><i id="pfJauge"></i></div>
      <p class="pf-sous" id="pfFin">${esc(`C’est toi, avec le PASS ${o.saison ?? ''}`)}</p>
      <div class="pf-boutons">
        ${o.bientot ? `<button type="button" data-non>${esc(o.quand ? `IL S’OUVRE ${o.quand}` : 'BIENTÔT')}</button>`
          : `<button type="button" data-oui="acheter">PRENDRE LE PASS${o.prix ? ` · ${esc(o.prix)}` : ''}</button>`}
        <button type="button" data-non>FERMER</button></div>`;
    const fond = k?.fond_profil ? P.image(k.fond_profil) : '';
    const { v, promesse } = ouvrir(html, { couleur: o.couleur, fond, etiquette: `Essai du PASS ${o.saison ?? ''}` });
    v.querySelectorAll('#pfFz>img[data-age]').forEach((im) => P?.cadrer?.(im, { marge: 0.04 }));
    son('parfait');
    const jauge = v.querySelector('#pfJauge');
    const age = v.querySelector('#pfAge');
    const DUREE = 10000;
    if (!calme()) {
      jauge.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: DUREE, fill: 'forwards' });
      let i = 0;
      const t = setInterval(() => {
        if (!v.isConnected) return clearInterval(t);
        const l = [...v.querySelectorAll('#pfFz>img[data-age]')];
        if (!l.length) return clearInterval(t);
        i = (i + 1) % l.length;
        l.forEach((im, j) => im.classList.toggle('on', j === i));
        age.textContent = `ÂGE ${l[i].dataset.age}`;
        son('tic');
        if (i === l.length - 1) clearInterval(t);
      }, DUREE / 3);
    } else {
      jauge.style.transform = 'scaleX(1)';
    }
    setTimeout(() => {
      if (!v.isConnected) return;
      v.querySelector('#pfFin')?.animate?.([{ scale: 1.3 }, { scale: 1 }], { duration: 300 });
      v.querySelector('[data-oui]')?.focus?.();
    }, calme() ? 0 : DUREE);
    return promesse;
  }

  /* --------------------------------------------------- la fête de l'achat */

  /**
   * `o` : `{ saison, couleur, nom, tenue, fin, gains: [texte], fanzzy }`.
   * Rend `'jouer'`, `'voie'` ou `null`.
   */
  async function achat(o = {}) {
    const P = await pass();
    const k = P?.kit?.(o.saison);
    const tenue = String(o.tenue ?? '').replace(/[^a-z0-9-]/gi, '');
    const mien = tenue ? (o.fanzzy ?? await monFanzzy()) : null;
    const repli = (P?.VITRINE ?? [['RP1', 3]])[0][0];
    const gains = (o.gains ?? []).map((g, i) => `<li class="pf-entre" style="--i:${i}">${
      typeof g === 'string' ? esc(g) : `${g.icone && P ? P.img(g.icone) : ''}<span>${esc(g.texte)}</span>`}</li>`).join('');
    const html = `<div class="pf-ecusson"><span class="pf-onde" aria-hidden="true"></span>${etincelles()}
        ${P ? P.badge({ saison: o.saison, couleur: o.couleur }, 'grand') : ''}</div>
      <h2 class="pf-titre">${esc(`Bienvenue dans le PASS ${o.saison ?? ''}`)}</h2>
      ${o.nom ? `<p class="pf-sous pf-entre">${esc(o.nom)}</p>` : ''}
      ${tenue ? `<div class="pf-fz pf-entre" style="--i:1;height:min(26vh,190px)">
        <img alt="" class="on" src="${pose(mien || repli, 1, tenue)}"
          onerror="if(this.dataset.r){this.remove()}else{this.dataset.r=1;this.src='${pose(repli, 1, tenue)}'}"></div>` : ''}
      ${gains ? `<ul class="pf-liste">${gains}</ul>` : ''}
      ${o.fin ? `<p class="pf-sous pf-entre" style="font-size:11px;--i:5">${esc(o.fin)}</p>` : ''}
      <div class="pf-boutons pf-entre" style="--i:6"><button type="button" data-oui="jouer">JOUER</button>
        <button type="button" data-choix="voie">VOIR MA VOIE PASS</button></div>`;
    const { v, promesse } = ouvrir(html, { couleur: o.couleur, etiquette: `Bienvenue dans le PASS ${o.saison ?? ''}` });
    v.querySelectorAll('.pf-fz>img').forEach((im) => P?.cadrer?.(im, { marge: 0.04 }));
    setTimeout(() => son('gong'), calme() ? 0 : 600);
    setTimeout(() => son('parfait'), calme() ? 0 : 900);
    void k;
    return promesse;
  }

  /* --------------------------------------------- un niveau de la voie */

  /**
   * `o` : `{ saison, couleur, niveau, nom, gain, age, autres }` — `nom` le
   * gain en clair (« Le cadre de carte »), `autres` combien d'autres niveaux
   * sont tombés en même temps. Rend `'voie'` ou `null`.
   */
  async function niveau(o = {}) {
    const P = await pass();
    const n = Math.max(1, Math.min(MAX, Number(o.niveau) || 1));
    const icone = P?.icone?.(o.saison, { gain: o.gain, age: o.age });
    const crans = Array.from({ length: MAX }, (_, i) =>
      `<i${i < n - 1 ? ' data-on' : ''}${i === n - 1 ? ' data-neuf' : ''}></i>`).join('');
    const html = `<span class="pf-sur">${esc(`Voie PASS ${o.saison ?? ''}`)}</span>
      <h2 class="pf-titre">${esc(`Niveau ${n}`)}</h2>
      <div class="pf-gain"><span class="pf-onde" aria-hidden="true"></span>${etincelles(10)}
        ${icone ? P.img(icone, '', '') : (P ? P.badge({ saison: o.saison, couleur: o.couleur, or: n === MAX }, 'grand') : '')}</div>
      <p class="pf-sous">${esc(o.nom ?? '')}</p>
      ${o.autres ? `<p class="pf-sous" style="font-size:11px;opacity:.75">${esc(`et ${o.autres} autre${o.autres > 1 ? 's' : ''} niveau${o.autres > 1 ? 'x' : ''} avec lui`)}</p>` : ''}
      <div class="pf-crans" aria-label="${esc(`${n} niveaux sur ${MAX}`)}">${crans}</div>
      <div class="pf-boutons"><button type="button" data-oui="voie">VOIR MA VOIE</button>
        <button type="button" data-non>CONTINUER</button></div>`;
    const { promesse } = ouvrir(html, { couleur: o.couleur, etiquette: `Voie PASS, niveau ${n}` });
    son('parfait');
    return promesse;
  }

  /* La case de fête commune (`niveau-fete.js`), chargée une fois s'il le faut. */
  let fetePrete = null;
  function fete() {
    if (window.TBF_NIVEAU) return Promise.resolve(window.TBF_NIVEAU);
    fetePrete ??= new Promise((ok) => {
      const s = document.createElement('script');
      s.src = '/niveau-fete.js';
      s.onload = () => ok(window.TBF_NIVEAU ?? null);
      s.onerror = () => ok(null);
      document.head.appendChild(s);
    });
    return fetePrete;
  }

  /* --------------------------------------------- le niveau vu ou non */

  const cleNiveau = (saison) => `tbf-pass-niveau:${saison}`;
  /** La voie à suivre : le dernier PASS joué pendant sa saison. */
  const voieSuivie = (a) => (a?.voies ?? []).filter((x) => x.original !== false).at(-1) ?? null;

  /**
   * Fête le niveau gagné depuis la dernière visite, une fois. Le premier
   * passage retient le niveau sans rien fêter (l'achat a sa propre fête).
   * Rend `true` si une fête s'est ouverte.
   */
  async function verifierNiveau(a) {
    const v = voieSuivie(a);
    if (!v || !Number.isFinite(Number(v.niveau))) return false;
    let vu;
    try { vu = localStorage.getItem(cleNiveau(v.saison)); } catch { return false; }
    const n = Number(v.niveau);
    try { localStorage.setItem(cleNiveau(v.saison), String(n)); } catch { return false; }
    if (vu === null || !(n > Number(vu))) return false;
    const voie = Array.isArray(a?.voie) ? a.voie : [];
    const g = voie.find((x) => Number(x.niveau) === n) ?? {};
    const o = { saison: v.saison, couleur: v.couleur, niveau: n,
      nom: g.nom ?? '', gain: g.gain, age: g.age, autres: Math.max(0, n - Number(vu) - 1) };
    /* **La case de la montée de niveau** (demande de Gaël, 6 novembre 2026 :
       « une alerte, comme pour un changement de niveau ») : `niveau-fete.js`,
       chargé s'il manque ; sa scène à lui (`niveau`) seulement sans elle. */
    const [N] = await Promise.all([fete(), pass()]);
    let choix;
    if (N?.voie) {
      const suivant = voie.find((x) => Number(x.niveau) === n + 1);
      const seuils = Array.isArray(v.seuilsVoie) ? v.seuilsVoie : [];
      choix = await N.voie({ ...o, max: voie.length || MAX,
        prochain: suivant ? { niveau: n + 1, nom: suivant.nom, seuil: Number(seuils[n]) || 0 } : null });
    } else choix = await niveau(o);
    if (choix === 'voie') location.href = '/aide#saison';
    return true;
  }

  /* ------------------------------------------- le trophée du carnet */

  /**
   * Le Fanzzy du carnet plein vient de tomber (`/api/quotidien`, `trophees`) :
   * `o` : `{ fanzzy, nom, saison }`. Rend `'collection'` ou `null`.
   */
  async function trophee(o = {}) {
    const id = String(o.fanzzy ?? '').replace(/[^A-Za-z0-9]/g, '');
    if (!id) return null;
    const html = `<span class="pf-sur">${esc(`Carnet plein · saison ${o.saison ?? ''}`)}</span>
      <h2 class="pf-titre">${esc(o.nom ?? '')}</h2>
      <div class="pf-gain"><span class="pf-onde" aria-hidden="true"></span>${etincelles(16)}
        <img src="${esc(pose(id, 1, 'base', 'joie'))}" alt=""></div>
      <p class="pf-sous">Fanzzy légendaire · aucun booster ne le donne</p>
      <div class="pf-boutons"><button type="button" data-oui="collection">VOIR MA COLLECTION</button>
        <button type="button" data-non>CONTINUER</button></div>`;
    const { promesse } = ouvrir(html, { couleur: '#f2c14e', etiquette: `Trophée du carnet : ${o.nom ?? ''}` });
    son('parfait');
    return promesse;
  }

  window.TBF_PASS_FETE = { essayer, achat, niveau, verifierNiveau, cleNiveau, trophee };
})();
