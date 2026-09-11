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

  window.TBF_STUFF = { adresse, illustration, pastille };
})();
