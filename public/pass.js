/**
 * Le badge et le cadre du PASS de saison, dessinés de la même façon partout.
 *
 * Choix de Gaël du 2 novembre 2026 (`src/shared/pass.js`). Purement visuels :
 * un écusson à la couleur de la saison, avec le numéro du PASS, ses crans de
 * voie, l'or au dernier niveau ; et le cadre de la carte de supporter.
 *
 * Le serveur dit tout (`/api/abonnement`, `/api/abonnement/badge/:id`, les
 * lignes de classement) : cette page ne décide d'aucun niveau, elle dessine.
 *
 *   TBF_PASS.badge({ saison: 1, couleur: '#c9772e', niveau: 3, or: false }, 'moyen')
 *   TBF_PASS.cadre(element, { cadre: 'anime', couleur: '#c9772e' })
 */
(() => {
  const esc = (s) => String(s ?? '').replace(/[<>&"]/g,
    (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  const couleurSure = (c) => (/^#[0-9a-f]{3,8}$/i.test(String(c ?? '')) ? c : '#c9772e');
  const MAX = 6;

  /** L'écusson. `taille` : '' (en ligne), 'moyen', 'grand'. `null` sans badge. */
  function badge(b, taille = '') {
    if (!b || !Number.isFinite(Number(b.saison))) return '';
    const n = Number(b.saison);
    const niveau = Number(b.niveau) || 0;
    const titre = `PASS ${n}${niveau ? ` · niveau ${niveau} sur ${MAX}` : ''}`;
    const crans = niveau && taille
      ? `<span class="tbf-pass-crans" style="--pass:${couleurSure(b.couleur)}" aria-hidden="true">${
        Array.from({ length: MAX }, (_, i) => `<i${i < niveau ? ' data-on' : ''}></i>`).join('')}</span>`
      : '';
    const ecusson = `<span class="tbf-pass-badge${taille ? ` tbf-pass-badge--${taille}` : ''}"
      style="--pass:${couleurSure(b.couleur)}"${b.or ? ' data-or' : ''}
      role="img" aria-label="${esc(titre)}" title="${esc(titre)}"><b>P${n}</b></span>`;
    return crans
      ? `<span style="display:inline-flex;flex-direction:column;align-items:center">${ecusson}${crans}</span>`
      : ecusson;
  }

  /** Pose (ou retire) le cadre du PASS sur un bloc. */
  function cadre(el, b) {
    if (!el) return;
    el.classList.toggle('tbf-pass-cadre', Boolean(b?.cadre));
    if (b?.cadre) {
      el.dataset.cadre = b.cadre === 'anime' ? 'anime' : 'fixe';
      el.style.setProperty('--pass', couleurSure(b.couleur));
    } else {
      delete el.dataset.cadre;
    }
  }

  /**
   * Cadre une image de Fanzzy sur sa silhouette. Les poses sont dessinées
   * dans une grande toile (560 × 960) où un Fanzzy du 1er âge n'occupe
   * qu'un coin : dans une petite vitrine, il devenait un timbre. On lit la
   * transparence de l'image, et on l'agrandit pour que le Fanzzy remplisse
   * sa boîte, posé en bas, centré. Sans lecture possible, l'image reste
   * telle quelle. `marge` (0 à 1) garde un peu d'air en haut et sur les côtés.
   */
  function cadrer(img, { marge = 0 } = {}) {
    const faire = () => {
      const W = img.naturalWidth;
      const H = img.naturalHeight;
      const boite = img.parentElement;
      if (!W || !H || !boite) return;
      const k = 4;
      const w = Math.ceil(W / k);
      const h = Math.ceil(H / k);
      let d;
      try {
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const x = c.getContext('2d', { willReadFrequently: true });
        x.drawImage(img, 0, 0, w, h);
        d = x.getImageData(0, 0, w, h).data;
      } catch { return; }
      let x0 = w; let y0 = h; let x1 = -1; let y1 = -1;
      for (let y = 0; y < h; y += 1) {
        for (let i = 0; i < w; i += 1) {
          if (d[(y * w + i) * 4 + 3] > 24) {
            if (i < x0) x0 = i;
            if (i > x1) x1 = i;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
          }
        }
      }
      if (x1 < 0) return;
      const bx = x0 * k; const by = y0 * k;
      const bw = (x1 - x0 + 1) * k; const bh = (y1 - y0 + 1) * k;
      const BW = boite.clientWidth; const BH = boite.clientHeight;
      if (!BW || !BH) return;
      const e = Math.min((BW * (1 - marge)) / bw, (BH * (1 - marge)) / bh);
      Object.assign(img.style, {
        inset: 'auto', maxWidth: 'none', maxHeight: 'none', objectFit: 'fill',
        width: `${W * e}px`, height: `${H * e}px`,
        left: `${(BW - bw * e) / 2 - bx * e}px`, top: `${BH - bh * e - by * e}px`,
      });
    };
    if (img.complete && img.naturalWidth) faire();
    else img.addEventListener('load', faire, { once: true });
  }

  /**
   * Les Fanzzy qui montrent la tenue de saison (vitrine du PASS, pub de
   * l'accueil) : choisis parmi ceux dont la pose tient dans sa toile, sans
   * bras ni corne coupés au bord.
   */
  const VITRINE = [['RP1', 3], ['AN5', 2], ['RP20', 3], ['AN1', 1], ['RP4', 2], ['AN41', 3],
    ['RP13', 1], ['AN60', 2], ['RP7', 1], ['AN22', 1]];

  window.TBF_PASS = { badge, cadre, cadrer, VITRINE, MAX };
})();
