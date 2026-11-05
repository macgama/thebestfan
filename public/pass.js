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
  const MAX = 12;

  /* **Le kit dessiné d'un PASS** (`scripts/pass-images.mjs`, rendus Artlist du
     3 novembre 2026) : l'écusson, les icônes des gains de la voie, le cadre,
     la plaque du titre, le fond. Un PASS sans kit garde les dessins en CSS. */
  const KIT = {
    1: { badge: 'badge-p1', or: 'badge-p1-or', tenue: ['icone-tenue-1', 'icone-tenue-2', 'icone-tenue-3'],
      cadre_profil: 'cadre-profil', stickers: 'sticker-ouga', fond_profil: 'fond-grotte',
      cadre: 'cadre-carte', cadre_anime: 'cadre-carte', entree: 'entree-rochers', titre: 'plaque-titre',
      aura: 'icone-aura', badge_or: 'badge-p1-or',
      autocollants: ['sticker-ouga', 'sticker-massue', 'sticker-os', 'sticker-feu'] },
    /* PASS 2 · Apocalyptique (5 novembre 2026, mode gratuit). */
    2: { badge: 'p2-badge', or: 'p2-badge-or', tenue: ['p2-icone-tenue-1', 'p2-icone-tenue-2', 'p2-icone-tenue-3'],
      cadre_profil: 'p2-cadre-profil', stickers: 'p2-sticker-cle', fond_profil: 'p2-fond-desert',
      cadre: 'p2-cadre-carte', cadre_anime: 'p2-cadre-carte', entree: 'p2-entree-portail', titre: 'p2-plaque-titre',
      aura: 'p2-icone-aura', badge_or: 'p2-badge-or',
      autocollants: ['p2-sticker-cle', 'p2-sticker-bidon', 'p2-sticker-pneu', 'p2-sticker-lunettes'] },
  };
  const ext = () => {
    const e = window.FZART?.IMG_EXT_ALPHA ?? window.TBF_ETATS?.EXT_ALPHA;
    return e === '.avif' || e === '.webp' ? e : '.webp';
  };
  /** L'adresse d'une pièce du kit, ou `''`. Le fond est une photo : `.jpg` en repli. */
  function image(id) {
    if (!id) return '';
    return `/img/pass/${id}${ext()}`;
  }
  const repli = (id) => `/img/pass/${id}${/fond-/.test(id) ? '.jpg' : '.png'}`;
  /** Une `<img>` du kit qui retombe sur le PNG (ou le JPEG), et s'efface sans fichier. */
  function img(id, classe = '', alt = '') {
    if (!id) return '';
    return `<img${classe ? ` class="${classe}"` : ''} src="${image(id)}" alt="${esc(alt)}" loading="lazy" decoding="async"
      onerror="if(this.dataset.r){this.remove()}else{this.dataset.r=1;this.src='${repli(id)}'}">`;
  }
  /** L'id de l'icône d'un gain de la voie (`{ gain, age }`) pour un PASS, ou `''`. */
  function icone(saison, v) {
    const k = KIT[Number(saison)];
    if (!k || !v) return '';
    if (v.gain === 'tenue') return k.tenue?.[Math.max(1, Number(v.age) || 1) - 1] ?? '';
    return k[v.gain] ?? '';
  }
  const kit = (saison) => KIT[Number(saison)] ?? null;

  /** L'écusson. `taille` : '' (en ligne), 'moyen', 'grand'. `null` sans badge. */
  function badge(b, taille = '') {
    if (!b || !Number.isFinite(Number(b.saison))) return '';
    const n = Number(b.saison);
    const niveau = Number(b.niveau) || 0;
    const etoiles = Math.max(0, Math.floor(Number(b.etoiles) || 0));
    const titre = `PASS ${n}${niveau ? ` · niveau ${niveau} sur ${MAX}` : ''}${etoiles ? ` · ★${etoiles}` : ''}`;
    const crans = niveau && taille
      ? `<span class="tbf-pass-crans" style="--pass:${couleurSure(b.couleur)}" aria-hidden="true">${
        Array.from({ length: MAX }, (_, i) => `<i${i < niveau ? ' data-on' : ''}></i>`).join('')}</span>`
      : '';
    /* L'écusson dessiné du kit, quand le PASS en a un ; « P1 » en étiquette dessous. */
    const k = KIT[n];
    const dessin = k ? img(b.or ? k.or : k.badge, 'tbf-pass-blason') : '';
    const ecusson = `<span class="tbf-pass-badge${taille ? ` tbf-pass-badge--${taille}` : ''}"
      style="--pass:${couleurSure(b.couleur)}"${b.or ? ' data-or' : ''}${dessin ? ' data-kit' : ''}
      role="img" aria-label="${esc(titre)}" title="${esc(titre)}">${dessin}<b>P${n}</b>${
      etoiles ? `<i class="tbf-pass-etoiles" aria-hidden="true">★${etoiles > 1 ? etoiles : ''}</i>` : ''}</span>`;
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

  window.TBF_PASS = { badge, cadre, cadrer, VITRINE, MAX, kit, icone, image, img };
})();
