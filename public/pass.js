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

  window.TBF_PASS = { badge, cadre, MAX };
})();
