/**
 * Les emblèmes : une marque par série, par type et par rareté.
 *
 * ## Ce qu'ils sont, et ce qu'ils ne remplacent pas
 *
 * Des pin's émaillés — ce que les supporters épinglent sur leur écharpe. Ils
 * s'ajoutent aux marques qui existaient déjà et n'en effacent aucune : les six
 * types gardent leur glyphe SVG et leur couleur, les quatre raretés gardent
 * leur signe (`♛`, `★`, des points). Ces marques-là tiennent à vingt pixels,
 * ne coûtent pas une requête, et ne peuvent pas manquer.
 *
 * L'emblème vient **par-dessus**, selon la règle déjà écrite dans `deck.html` :
 * « le dessin se pose après le glyphe, pas à sa place » — un fichier absent se
 * retire lui-même, et l'écran retrouve ce qu'il avait avant.
 *
 * Les séries, elles, n'avaient rien. C'est là que l'emblème apporte quelque
 * chose de neuf : le classeur trie par série et ne le montrait nulle part.
 *
 * ## Pourquoi un fichier à part
 *
 * Trois écrans au moins montreront un emblème — le classeur, le kiosque, la
 * fiche — et chacun aurait eu son idée d'où trouver le dessin et de quoi faire
 * quand il manque. C'est la manière habituelle dont trois écrans du même jeu
 * finissent par ne plus dire pareil. Même raison que `stuff-art.js`.
 *
 * Script classique, pas module : comme tout ce qui vit dans `public/`.
 */
(() => {
  if (window.TBF_LOGO) return;

  /* Le format servi suit celui des Fanzzy : c'est `FZART` qui a négocié avec le
     navigateur, et une seconde négociation donnerait une seconde réponse.

     Le repli est le PNG et non le JPEG : ces emblèmes sont détourés, et un
     JPEG n'a pas de transparence — le pin arriverait avec son carré vert. */
  const ext = () => {
    const e = window.FZART?.IMG_EXT;
    return e === '.avif' || e === '.webp' ? e : '.png';
  };

  /**
   * L'adresse d'un emblème.
   *
   * @param famille 'serie' | 'type' | 'rarete'
   * @param id      l'identifiant dans cette famille — `RP`, `voix`, `epique`.
   */
  const adresse = (famille, id) => `/img/logo/${famille}-${id}${ext()}`;

  /**
   * L'emblème en HTML.
   *
   * `this.remove()` est le repli : un fichier absent retire son image et laisse
   * voir ce qu'il y a dessous — le glyphe de type, le signe de rareté, ce que
   * l'écran avait déjà. Sans ça, un emblème manquant afficherait le carré vide
   * du navigateur, ce qui est pire que pas d'image du tout.
   */
  const illustration = (famille, id, classe = 'tbf-logo') =>
    `<img class="${classe}" src="${adresse(famille, id)}" alt="" loading="lazy"
      onerror="this.remove()">`;

  const serie = (id, classe) => illustration('serie', id, classe);
  const type = (id, classe) => illustration('type', id, classe);
  const rarete = (id, classe) => illustration('rarete', id, classe);

  window.TBF_LOGO = { adresse, illustration, serie, type, rarete };
})();
