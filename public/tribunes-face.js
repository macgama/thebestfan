/* =======================================================================
   Les deux tribunes face à face (30 octobre 2026, demande de Gaël).

   Au Grand Virage, on ne voit que son Fanzzy et des supporters au pochoir.
   Cette page annexe, ouverte depuis l'arène, montre **les Fanzzy titulaires
   des présents**, les deux murs face à face et un VS en feu au milieu : les
   douze qui poussent le plus en ce moment dans chaque tribune (le serveur
   les choisit, `VirageRoom.tribunesEnFace`), et soi, toujours.

   Elle se pose **par-dessus** le Virage plutôt que d'en être une autre
   adresse : quitter la page quitterait la tribune, et l'on reviendrait dans
   une foule qui a continué sans soi. Elle se relit toutes les trois
   secondes tant qu'elle est ouverte ; un but de la corde fait sauter le mur
   qui marque.

   « PARTAGER L'IMAGE » redessine la scène sur une toile (les dessins sont
   du même site, la toile reste lisible) et l'envoie par la feuille de
   partage du téléphone, sinon la télécharge.

   window.TBF_FACE.ouvrir({ fixtureId, nomMoi, nomEux, score })
   window.TBF_FACE.fermer()
   ======================================================================= */
window.TBF_FACE = (() => {
  const RELIRE_MS = 3000;
  /* Les places d'un mur, de la plus en vue à la plus loin : quatre au premier
     rang, quatre au deuxième, quatre au fond. En pour cent du mur : `x` le
     bord côté tribune, `bas` les pieds, `h` la hauteur. */
  const RANGEES = [
    { bas: 0, h: 66, x: [0, 25, 50, 75] },
    { bas: 24, h: 52, x: [12, 37, 62, 86] },
    { bas: 44, h: 42, x: [4, 29, 54, 78] },
  ];
  const placeDe = (i) => {
    const r = RANGEES[Math.min(2, Math.floor(i / 4))] ?? RANGEES[2];
    return { bas: r.bas, h: r.h, x: r.x[i % 4], rangee: Math.floor(i / 4) };
  };

  let el = null;
  let etat = null;          // { fixtureId, nomMoi, nomEux, score }
  let minuteur = 0;
  let derniers = null;      // la dernière réponse du serveur
  let buts = null;

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /** Le dessin en pied d'un titulaire : la poussée chez soi, la colère en
      face, le repos quand l'âge n'a pas cette expression. */
  function dessin(f, etatVoulu) {
    try {
      return window.FZART?.dessinAvatar?.({ id: f.id, age: f.age, evo: f.evo, skin: f.skin },
        'plein', { etat: etatVoulu }) ?? null;
    } catch { return null; }
  }

  function monter() {
    el = document.createElement('section');
    el.className = 'tbf-face';
    el.id = 'faceAFace';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Les deux tribunes');
    el.innerHTML = `
      <div class="tbf-face-scene" id="faceScene">
        <span class="tbf-face-faisceau" data-c="g" aria-hidden="true"></span>
        <span class="tbf-face-faisceau" data-c="d" aria-hidden="true"></span>
        <span class="tbf-face-fumee" data-tribune="moi" aria-hidden="true"></span>
        <span class="tbf-face-fumee" data-tribune="eux" aria-hidden="true"></span>
        <div class="tbf-face-haut">
          <span class="tbf-face-match" id="faceMatch"></span>
          <b class="tbf-face-titre">LES DEUX TRIBUNES</b>
        </div>
        <span class="tbf-face-camp" data-tribune="moi" id="faceCampMoi"></span>
        <div class="tbf-face-mur" data-tribune="moi" id="faceMurMoi"></div>
        <span class="tbf-face-plus" data-tribune="moi" id="facePlusMoi" hidden></span>
        <span class="tbf-face-eclat" aria-hidden="true"></span>
        <b class="tbf-face-vs" aria-hidden="true">VS</b>
        <div class="tbf-face-mur" data-tribune="eux" id="faceMurEux"></div>
        <span class="tbf-face-plus" data-tribune="eux" id="facePlusEux" hidden></span>
        <span class="tbf-face-camp" data-tribune="eux" id="faceCampEux"></span>
        <p class="tbf-face-vide" id="faceVide" hidden>Personne dans les tribunes pour l’instant.</p>
      </div>
      <div class="tbf-face-bas">
        <button type="button" class="tbf-face-btn" data-ton="or" id="facePartager">PARTAGER L’IMAGE</button>
        <button type="button" class="tbf-face-btn" id="faceRetour">RETOUR À LA CORDE</button>
      </div>
      <p class="tbf-face-note" id="faceNote" role="status"></p>`;
    (document.getElementById('app') ?? document.body).appendChild(el);
    el.querySelector('#faceRetour').addEventListener('click', fermer);
    el.querySelector('#facePartager').addEventListener('click', partager);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && el && !el.hidden) fermer(); });
  }

  /** Un mur : les figures déjà là gardent leur élément (pas de clignement à
      chaque relecture), les nouvelles entrent, les parties sortent. */
  function poserMur(mur, joueurs, cote) {
    const gardees = new Map([...mur.children].map((c) => [c.dataset.cle, c]));
    const voulues = new Set();
    joueurs.slice(0, 13).forEach((j, i) => {
      const cle = `${j.nom}|${j.fanzzy.id}|${j.fanzzy.evo}|${j.fanzzy.skin}`;
      voulues.add(cle);
      const src = dessin(j.fanzzy, cote === 'moi' ? 'pousse' : 'colere');
      let fig = gardees.get(cle);
      if (!fig) {
        fig = document.createElement('figure');
        fig.className = 'tbf-face-fz';
        fig.dataset.cle = cle;
        fig.innerHTML = `<img alt="" decoding="async" draggable="false"><figcaption></figcaption>`;
        fig.querySelector('img').addEventListener('error', function repli() {
          const s = window.TBF_ETATS?.secours?.(this.src);
          if (s && s !== this.src) this.src = s; else this.removeEventListener('error', repli);
        });
        mur.appendChild(fig);
      }
      const img = fig.querySelector('img');
      if (src && img.getAttribute('src') !== src) img.src = src;
      /* Le treizième, c'est soi hors des douze : au fond, à côté. */
      const p = i < 12 ? placeDe(i) : { ...placeDe(9), x: placeDe(9).x - 12 };
      fig.style.setProperty('--x', `${p.x}%`);
      fig.style.setProperty('--bas', `${p.bas}%`);
      fig.style.setProperty('--h', `${p.h}%`);
      fig.style.zIndex = String(10 - p.rangee);
      fig.dataset.rangee = String(p.rangee);
      fig.toggleAttribute('data-moi', Boolean(j.moi));
      const nom = String(j.nom ?? '').toUpperCase();
      // Le rang en « #3 » : il se lit pareil dans les cinq langues.
      const legende = j.moi ? `TOI · #${j.rang}` : p.rangee === 0 ? `${nom} · #${j.rang}` : nom;
      const cap = fig.querySelector('figcaption');
      if (cap.textContent !== legende) cap.textContent = legende;
      // Le fond ne porte son nom qu'en infobulle : douze étiquettes se marcheraient dessus.
      cap.hidden = p.rangee === 2 && !j.moi;
    });
    for (const [cle, c] of gardees) if (!voulues.has(cle)) c.remove();
  }

  function rendre(r) {
    derniers = r;
    const mien = r.mien ?? 0;
    const [nous, eux] = [r.tribunes?.[mien] ?? { n: 0, joueurs: [] }, r.tribunes?.[mien ^ 1] ?? { n: 0, joueurs: [] }];
    poserMur(el.querySelector('#faceMurMoi'), nous.joueurs ?? [], 'moi');
    poserMur(el.querySelector('#faceMurEux'), eux.joueurs ?? [], 'eux');
    const camp = (id, nom, n) => {
      el.querySelector(id).innerHTML = `${esc(nom || '')}<small>${n} ${n > 1 ? 'présents' : 'présent'}</small>`;
    };
    camp('#faceCampMoi', etat.nomMoi, nous.n ?? 0);
    camp('#faceCampEux', etat.nomEux, eux.n ?? 0);
    const plus = (id, t) => {
      const reste = Math.max(0, (t.n ?? 0) - Math.min(12, (t.joueurs ?? []).length));
      const p = el.querySelector(id);
      p.hidden = !reste;
      p.textContent = `+ ${reste} autre${reste > 1 ? 's' : ''}`;
    };
    plus('#facePlusMoi', nous);
    plus('#facePlusEux', eux);
    el.querySelector('#faceVide').hidden = Boolean((nous.joueurs?.length ?? 0) + (eux.joueurs?.length ?? 0));
    const g = r.goals ?? [0, 0];
    el.querySelector('#faceMatch').textContent = `${etat.nomMoi || ''} ${g[mien] ?? 0} – ${g[mien ^ 1] ?? 0} ${etat.nomEux || ''}`.trim();
    /* Un but de la corde : le mur qui marque saute. */
    if (buts) {
      [['moi', mien], ['eux', mien ^ 1]].forEach(([cote, s]) => {
        if ((g[s] ?? 0) > (buts[s] ?? 0)) {
          const m = el.querySelector(cote === 'moi' ? '#faceMurMoi' : '#faceMurEux');
          m.classList.remove('saute'); void m.offsetWidth; m.classList.add('saute');
        }
      });
    }
    buts = [...g];
  }

  async function relire() {
    if (!etat) return;
    try {
      const rep = await fetch(`/api/virage/${encodeURIComponent(etat.fixtureId)}/tribunes`,
        { credentials: 'same-origin', cache: 'no-store' });
      if (rep.ok && etat) rendre(await rep.json());
    } catch { /* le réseau qui saute : on garde la dernière image */ }
  }

  function ouvrir(o) {
    if (!o?.fixtureId) return;
    if (!el) monter();
    etat = { ...o };
    buts = null;
    el.querySelector('#faceNote').textContent = '';
    el.hidden = false;
    el.classList.remove('joue'); void el.offsetWidth; el.classList.add('joue');
    window.FX?.son?.('gong');
    clearInterval(minuteur);
    relire();
    minuteur = setInterval(() => { if (!document.hidden) relire(); }, RELIRE_MS);
  }

  function fermer() {
    clearInterval(minuteur);
    etat = null;
    if (el) el.hidden = true;
  }

  /* ------------------------------------------------- l'image partagée */

  const charger = (src) => new Promise((ok) => {
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = () => ok(null);
    i.src = src;
  });

  /** La scène, redessinée sur une toile de 1080 × 1350 : chaque figure à la
      place qu'elle occupe à l'écran, les noms, le VS et le score. */
  async function image() {
    const scene = el.querySelector('#faceScene');
    const boite = scene.getBoundingClientRect();
    const W = 1080, H = 1350;
    // Le bas de l'image garde sa ligne pour l'adresse du jeu.
    const kx = W / boite.width, ky = (H - 70) / boite.height;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    const fond = g.createLinearGradient(0, 0, W, H);
    fond.addColorStop(0, '#5C4A08'); fond.addColorStop(0.495, '#2A2205');
    fond.addColorStop(0.505, '#071631'); fond.addColorStop(1, '#0E3B86');
    g.fillStyle = fond; g.fillRect(0, 0, W, H);
    const vsBoite = el.querySelector('.tbf-face-vs').getBoundingClientRect();
    const vy = (vsBoite.top + vsBoite.height / 2 - boite.top) * ky;
    const halo = g.createRadialGradient(W / 2, vy, 10, W / 2, vy, W * 0.42);
    halo.addColorStop(0, 'rgba(255,170,40,.75)'); halo.addColorStop(1, 'rgba(255,80,0,0)');
    g.fillStyle = halo; g.fillRect(0, 0, W, H);

    const figures = [...scene.querySelectorAll('.tbf-face-fz')]
      .sort((a, b) => Number(a.style.zIndex) - Number(b.style.zIndex));
    for (const f of figures) {
      const img = f.querySelector('img');
      const i = img?.complete && img.naturalWidth ? img : await charger(img?.src);
      if (!i) continue;
      const r = img.getBoundingClientRect();
      const x = (r.left - boite.left) * kx, y = (r.top - boite.top) * ky, w = r.width * kx, h = r.height * ky;
      // `object-fit: contain`, calé en bas : la même règle que l'écran.
      const s = Math.min(w / i.naturalWidth, h / i.naturalHeight);
      const dw = i.naturalWidth * s, dh = i.naturalHeight * s;
      g.save();
      if (f.closest('[data-tribune=eux]')) {
        g.translate(x + w / 2, 0); g.scale(-1, 1); g.translate(-(x + w / 2), 0);
      }
      g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 18; g.shadowOffsetY = 10;
      g.drawImage(i, x + (w - dw) / 2, y + h - dh, dw, dh);
      g.restore();
    }
    const police = (t, px) => `${t} ${px}px Oswald, Impact, "Arial Narrow", sans-serif`;
    for (const f of figures) {
      const cap = f.querySelector('figcaption');
      if (!cap || cap.hidden) continue;
      const r = cap.getBoundingClientRect();
      g.font = police(700, 26);
      const t = cap.textContent;
      const w = g.measureText(t).width + 18;
      const x = (r.left + r.width / 2 - boite.left) * kx, y = (r.top - boite.top) * ky;
      g.fillStyle = f.hasAttribute('data-moi') ? '#F5C33B' : f.closest('[data-tribune=eux]') ? '#CFE0FF' : '#E9DFC6';
      g.fillRect(x - w / 2, y, w, 34);
      g.fillStyle = '#14110C';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(t, x, y + 18);
    }
    g.save();
    g.translate(W / 2, vy); g.rotate(-0.14);
    g.font = police(700, 150); g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 16; g.strokeStyle = '#111'; g.strokeText('VS', 0, 0);
    g.shadowColor = 'rgba(255,110,0,.95)'; g.shadowBlur = 60;
    g.fillStyle = '#fff'; g.fillText('VS', 0, 0);
    g.restore();
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    g.font = police(700, 50); g.fillStyle = '#fff';
    g.fillText(el.querySelector('#faceMatch').textContent, W / 2, 86);
    g.font = police(700, 70); g.fillStyle = '#FFD84A';
    g.shadowColor = 'rgba(0,0,0,.9)'; g.shadowBlur = 8;
    g.fillText(el.querySelector('.tbf-face-titre').textContent, W / 2, 168);
    g.shadowBlur = 0;
    g.font = police(600, 34); g.fillStyle = 'rgba(255,255,255,.85)';
    g.fillText('thebestfan.online', W / 2, H - 34);
    return new Promise((ok) => c.toBlob(ok, 'image/png'));
  }

  async function partager() {
    const note = el.querySelector('#faceNote');
    let blob = null;
    try { blob = await image(); } catch { blob = null; }
    if (!blob) { note.textContent = 'L’image n’a pas pu se faire.'; return; }
    const fichier = new File([blob], 'les-deux-tribunes.png', { type: 'image/png' });
    const titre = el.querySelector('#faceMatch').textContent;
    if (navigator.canShare?.({ files: [fichier] })) {
      try {
        await navigator.share({ files: [fichier], title: 'Les deux tribunes', text: titre });
        note.textContent = '';
        return;
      } catch (e) {
        if (e?.name === 'AbortError') return;
      }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(fichier);
    a.download = fichier.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    note.textContent = 'Image enregistrée.';
  }

  return { ouvrir, fermer, image, get ouverte() { return Boolean(el && !el.hidden); }, get derniers() { return derniers; } };
})();
