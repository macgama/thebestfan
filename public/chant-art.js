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

  const echappe = (s) => String(s ?? '').replace(/[<>&"]/g,
    (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

  /**
   * L'illustration d'un chant, en HTML, à poser **avant** son texte.
   *
   * `this.remove()` est le repli : un fichier absent retire son image, et la
   * case garde son fond uni. Sans ça, un chant sans dessin afficherait le carré
   * vide du navigateur — pire que pas d'image du tout.
   *
   * `aria-hidden` : le dessin ne dit rien que le nom ne dise déjà, et le faire
   * annoncer ferait lire deux fois la même chose à qui écoute la page.
   *
   * **Le dessin est la face de la carte** (lot 6, la matière commune des deux
   * arènes : dessin plein, plus d'assombrissement). Il était un fond voilé —
   * à moitié ou au tiers, sous un dégradé sombre —, et ce que les pages lui
   * appliquaient vivait dans les pages : rien n'en est écrit ici, l'image
   * reste nue et la feuille décide de sa lumière. Trois choses changent
   * pour autant, parce qu'une face ne se charge pas comme un fond :
   *
   *   — **elle n'attend plus d'être vue** (plus de `loading="lazy"`). La main
   *     du duel est posée dans une partie encore cachée pendant la
   *     préparation ; une image paresseuse n'y part qu'à l'affichage, et la
   *     carte arrivait vide puis se peignait sous les yeux. Douze dessins de
   *     sept à dix kilo-octets : les charger d'un coup ne coûte rien ;
   *   — `decoding` asynchrone : son décodage ne retient pas le reste ;
   *   — `draggable` à faux : la main en éventail se touche et se presse, et
   *     un dessin qu'on peut traîner partait en fantôme sous la souris.
   *
   * Elle ne respire pas : sa classe n'est pas `.illu` (voir `fx.js`), et
   * c'est voulu — un chant n'est pas un personnage.
   *
   * **Les dessins sont en 4:3** (320 × 240), la carte de chant en 2:3 : la
   * face en recadre la moitié de la largeur. Le cadrage est à la feuille
   * (`object-position`) ; des dessins en 2:3 sont un travail d'images
   * (lot 7), pas de ce fichier.
   */
  function illustration(id, classe = 'fond') {
    return `<img class="${echappe(classe)}" src="${adresse(echappe(id))}" alt="" aria-hidden="true"
      decoding="async" draggable="false" onerror="this.remove()">`;
  }

  window.TBF_CHANT = { adresse, illustration };
})();
