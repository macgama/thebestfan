/**
 * Le dessin d'un chant du Grand Virage.
 *
 * ## Pourquoi un fichier plutôt que trois lignes dans la page
 *
 * Les mêmes trois questions se posent partout où un chant s'affiche : où est le
 * fichier, quelle extension ce navigateur sait lire, et que faire quand le
 * dessin manque. Elles ont déjà trois réponses dans `public/` — les Fanzzy,
 * les cartes d'action, l'équipement — et une quatrième copie aurait fini par
 * diverger de sa source comme les autres l'ont fait.
 *
 * ## Le repli
 *
 * Aucun écran ne dépend d'un téléchargement. L'image se pose **derrière** le
 * nom, le coût et la poussée, qui sont déjà là : si le fichier manque, l'image
 * se retire elle-même et la case redevient exactement ce qu'elle était. Elle
 * reste jouable, elle est seulement moins belle — ce qui est le bon ordre.
 *
 * Script classique, pas module : comme tout ce qui vit dans `public/`.
 */
(() => {
  /**
   * Le format servi.
   *
   * La détection est celle de `fanzzy-art.js`, empruntée plutôt que recopiée :
   * c'est déjà le cinquième endroit du dossier qui voudrait tester AVIF puis
   * WebP, et un cinquième test n'apporterait qu'une divergence de plus. Sans
   * lui — une page qui ne charge pas les Fanzzy — le JPEG marche partout.
   */
  const ext = () => window.FZART?.IMG_EXT ?? '.jpg';

  const adresse = (id) => `/img/chant/${id}${ext()}`;

  /**
   * L'illustration d'un chant, en HTML, à poser **avant** son texte.
   *
   * `this.remove()` est le repli : un fichier absent retire son image, et la
   * case garde son fond uni. Sans ça, un chant sans dessin afficherait le carré
   * vide du navigateur — pire que pas d'image du tout.
   *
   * `aria-hidden` : le dessin ne dit rien que le nom ne dise déjà, et le faire
   * annoncer ferait lire deux fois la même chose à qui écoute la page.
   */
  function illustration(id, classe = 'fond') {
    return `<img class="${classe}" src="${adresse(id)}" alt="" aria-hidden="true"
      loading="lazy" onerror="this.remove()">`;
  }

  window.TBF_CHANT = { adresse, illustration };
})();
