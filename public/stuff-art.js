/**
 * Les illustrations de l'équipement.
 *
 * ## Pourquoi un fichier à part
 *
 * Quatre écrans montrent une pièce d'équipement : le deck quand on l'équipe,
 * le kiosque quand elle sort d'un booster, la bienvenue quand elle arrive dans
 * le paquet de départ, le profil quand on la regarde. Chacun aurait eu son
 * idée d'où trouver le dessin et de quoi faire quand il manque — c'est la
 * manière habituelle dont quatre écrans du même jeu finissent par ne plus dire
 * pareil.
 *
 * ## Pourquoi ce n'est pas `action-art.js`
 *
 * Les deux se ressemblent de loin et se séparent sur un point qui compte : une
 * carte d'action est **une scène**, servie en JPEG parce qu'elle remplit son
 * cadre ; une pièce d'équipement est **un objet détouré**, servi en PNG parce
 * qu'il a une transparence à garder. Le format de repli n'est donc pas le
 * même, et c'est justement le repli qui fait tout l'intérêt de ces deux
 * fichiers. Les fondre reviendrait à écrire une exception à chaque ligne.
 *
 * La détection AVIF/WebP, elle, n'est pas recopiée : elle appartient à
 * `fanzzy-art.js`, qui la fait déjà pour tout le dossier.
 *
 * Script classique, pas module : comme tout ce qui vit dans `public/`.
 */
(() => {
  /**
   * Le format servi.
   *
   * Le repli est le PNG et non le JPEG : ces objets sont détourés, et un JPEG
   * n'a pas de transparence — la pièce arriverait avec son carré noir.
   */
  const ext = () => {
    const e = window.FZART?.IMG_EXT;
    return e === '.avif' || e === '.webp' ? e : '.png';
  };

  const adresse = (id) => `/img/stuff/${id}${ext()}`;

  /**
   * Les deux monnaies du jeu : les écharpes et les billets. Elles sont dessinées
   * comme l'équipement — objet détouré sur fond plat, mêmes trois formats, même
   * script — et servies d'ici pour la même raison : la négociation de format est
   * une règle, et une règle ne se recopie pas.
   */
  const gain = (id) => `/img/gains/${id}${ext()}`;
  const illustrationGain = (id, classe = 'illu') =>
    `<img class="${classe}" src="${gain(id)}" alt="" loading="lazy"
      onerror="this.onerror=null;this.src='/img/gains/${id}.png'">`;

  /**
   * L'illustration d'une pièce, en HTML.
   *
   * `this.remove()` est le repli : un fichier absent retire son image et
   * laisse voir ce qu'il y a dessous — le cadre de rareté, une initiale, ce
   * que l'écran a prévu. Sans ça, une pièce sans dessin afficherait le carré
   * vide du navigateur, ce qui est pire que pas d'image du tout.
   */
  function illustration(id, classe = 'illu') {
    return `<img class="${classe}" src="${adresse(id)}" alt="" loading="lazy"
      onerror="this.remove()">`;
  }

  /**
   * La pastille complète : le cadre de la rareté, et l'objet dedans.
   *
   * La rareté est portée par les jetons `--rc` de `ui.css`, les mêmes que les
   * Fanzzy et les cartes. Un joueur apprend une fois que l'or est légendaire,
   * et ça vaut partout.
   */
  function pastille(s, classe = 'tbf-piece') {
    if (!s?.id) return '';
    return `<span class="${classe} r-${s.rar ?? 'commune'}">${illustration(s.id)}</span>`;
  }

  const echapper = (t) => String(t ?? '').replace(/[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  /**
   * **Ce que le Fanzzy porte**, accroché à côté de lui : ses deux pièces du
   * deck, chacune dans le cadre de sa rareté, l'une sous l'autre.
   *
   * Pourquoi à côté et pas sur lui : les Fanzzy sont des rendus en volume, les
   * pièces des objets détourés éclairés autrement, et le cou ou la main ne sont
   * jamais au même endroit d'une expression à l'autre. Posée sur le
   * personnage, l'écharpe se lisait comme un autocollant (maquette du
   * 6 octobre 2026, `equipement/porte-a-cote-ou-colle.jpg`). Accrochées comme
   * des insignes, elles se lisent comme ce qu'elles sont : son sac.
   *
   * `pieces` : `[{ id, nom, rar }]`, tel que le serveur les sert
   * (`piecesPortees`). Deux au plus. Rien à porter : une chaîne vide, et la
   * page n'a rien à cacher. La page décide de la place (`.tbf-porte` est en
   * absolu dans la boîte qu'elle lui donne) et de la taille (`--piece`).
   */
  function porte(pieces, classe = 'tbf-porte') {
    const l = (Array.isArray(pieces) ? pieces : []).filter((s) => s?.id).slice(0, 2);
    if (!l.length) return '';
    const noms = l.map((s) => echapper(s.nom ?? s.id)).join(', ');
    return `<span class="${classe}" role="img" aria-label="Porte : ${noms}">${
      l.map((s) => `<span class="tbf-piece r-${echapper(s.rar ?? 'commune')}" title="${echapper(s.nom ?? '')}">${
        illustration(echapper(s.id))}</span>`).join('')}</span>`;
  }

  /** La clé d'un sac : sert aux pages à ne redessiner que ce qui a changé. */
  const cleSac = (pieces) => (Array.isArray(pieces) ? pieces : []).slice(0, 2)
    .map((s) => s?.id ?? '').join('+');

  window.TBF_STUFF = { adresse, illustration, pastille, gain, illustrationGain, porte, cleSac };
})();
