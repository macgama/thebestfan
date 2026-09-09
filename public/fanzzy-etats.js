/**
 * Les états d'un Fanzzy, et ce qu'on affiche quand l'état demandé n'existe pas.
 *
 * Un Fanzzy a douze états par stade — il salue, il pousse, il exulte, il
 * encaisse — et chaque stade peut avoir plusieurs skins. Douze états × trois
 * stades × cent trente-huit lignées, ce sont près de cinq mille dessins : ils
 * n'existeront jamais tous. Un skin d'hiver sorti pour Noël aura trois poses,
 * pas douze, et c'est très bien ainsi.
 *
 * Ce module répond donc à une seule question : « montre-moi TR1, stade 2, skin
 * hiver, au moment du but » — et il rend l'image la plus proche qui existe
 * vraiment, plutôt qu'un cadre vide. C'est la différence entre un jeu qui a
 * l'air inachevé et un jeu qui a l'air complet avec un dessin en moins.
 *
 * **L'ordre du repli n'est pas arbitraire.** On cherche d'abord la bonne pose,
 * quitte à changer de skin ; ensuite seulement on retombe sur `neutre`. Un skin
 * partiel déclare son `repli` précisément pour dire « emprunte le reste
 * là-bas » : c'est l'intention écrite dans le manifeste, on la suit. Faire
 * l'inverse — garder le costume et perdre la réaction — donnerait un
 * personnage impassible pendant que son club encaisse, et c'est la réaction que
 * le joueur regarde.
 *
 * En tout dernier recours on descend d'un stade : le personnage paraît plus
 * jeune qu'il ne l'est, ce qui est une petite entorse, mais il est là.
 *
 * Script classique, pas module : tout ce qui vit dans `public/` est chargé par
 * une balise `<script src>` ordinaire. On expose un global, comme `fx.js`,
 * `nav.js` et `fanzzy-art.js`.
 */
(() => {
  /** Les douze états, dans l'ordre où ils ont été dessinés. */
  const ETATS = ['neutre', 'salut', 'pousse', 'but', 'encaisse', 'attente',
    'victoire', 'defaite', 'occasion', 'decision', 'progression', 'ennui'];

  /**
   * Deux extensions, pas une.
   *
   * Un décor est une photo : son dernier recours est le JPEG. Un personnage est
   * détouré : le sien doit garder sa transparence, donc PNG. Les confondre a
   * déjà donné au supporter de l'accueil un fond blanc opaque sur les
   * navigateurs sans AVIF ni WebP.
   */
  const EXT = (() => {
    try {
      const c = document.createElement('canvas');
      if (c.toDataURL('image/avif').startsWith('data:image/avif')) return '.avif';
      if (c.toDataURL('image/webp').startsWith('data:image/webp')) return '.webp';
    } catch { /* pas de canvas : un test, un mode strict — tant pis */ }
    return '.jpg';
  })();
  const EXT_ALPHA = EXT === '.jpg' ? '.png' : EXT;

  /* ------------------------------------------------------------ le catalogue */

  let index = null;
  let promesse = null;

  /**
   * Le manifeste d'ensemble, une fois pour la vie de la page.
   *
   * Il ne lève jamais : une page qui n'a pas pu le charger doit rester
   * utilisable, avec le dessin procédural de `fanzzy-art.js` à la place des
   * illustrations. Un accueil vide parce qu'un JSON manque serait un mauvais
   * échange.
   */
  function charger() {
    promesse ??= fetch('/img/fanzzy/index.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { index = j; return j; })
      .catch(() => null);
    return promesse;
  }

  /** Ce qui est déjà chargé, sans attendre. `null` tant que rien n'est arrivé. */
  const pret = () => index;

  /**
   * La chaîne des skins à essayer, du demandé au dernier recours.
   *
   * `base` ferme toujours la marche et n'a jamais de repli : c'est lui le fond
   * du puits. Un `repli` circulaire — hiver → été → hiver — bouclerait sans
   * `vus`, et personne ne verrait la faute avant que la page se fige.
   */
  function chaineSkins(evolution, skin) {
    const chaine = [];
    const vus = new Set();
    let courant = skin;
    while (courant && !vus.has(courant)) {
      vus.add(courant);
      chaine.push(courant);
      courant = evolution.skins?.[courant]?.repli ?? null;
    }
    if (!vus.has('base')) chaine.push('base');
    return chaine;
  }

  const aLetat = (evolution, skin, etat) =>
    evolution.skins?.[skin]?.etats?.includes(etat) === true;

  /**
   * Trouve le dessin le plus proche de ce qui est demandé.
   *
   * @param {string} id      identifiant de catalogue — 'TR1'
   * @param {object} [opt]   { evo, skin, etat }
   * @returns {{src:string, etat:string, evo:number, skin:string, exact:boolean}|null}
   *   `exact` dit si on a eu ce qui était demandé : une page peut vouloir ne
   *   pas jouer d'animation de but si le dessin du but n'existe pas.
   */
  function resoudre(id, opt = {}) {
    const f = index?.fanzzy?.[id];
    if (!f) return null;

    const evoVoulu = Math.min(3, Math.max(1, Number(opt.evo) || 1));
    const skinVoulu = opt.skin || 'base';
    const etatVoulu = ETATS.includes(opt.etat) ? opt.etat : 'neutre';
    // `neutre` deux fois dans la liste ne coûterait rien, mais brouillerait le
    // drapeau `exact` : le repli sur neutre serait annoncé comme un succès.
    const etats = etatVoulu === 'neutre' ? ['neutre'] : [etatVoulu, 'neutre'];

    for (let evo = evoVoulu; evo >= 1; evo--) {
      const evolution = f.evolutions?.[`e${evo}`];
      if (!evolution) continue;
      const skins = chaineSkins(evolution, skinVoulu);
      for (const etat of etats) {
        for (const skin of skins) {
          if (!aLetat(evolution, skin, etat)) continue;
          return {
            src: url(id, evo, skin, etat, f.rev),
            etat, evo, skin,
            exact: etat === etatVoulu && evo === evoVoulu && skin === skinVoulu,
          };
        }
      }
    }
    return null;
  }

  /**
   * Le portrait, pour l'avatar et les vignettes de deck.
   *
   * Il n'est produit que depuis `neutre` : sur une pose bras levés, le cadrage
   * automatique prend un poignet pour un crâne. Un stade sans portrait retombe
   * donc sur le stade d'avant — même visage, un peu plus jeune — et, si aucun
   * n'en a, la page se rabat sur le plein-pied que `resoudre` sait rendre.
   */
  function portrait(id, opt = {}) {
    const f = index?.fanzzy?.[id];
    if (!f) return null;
    const evoVoulu = Math.min(3, Math.max(1, Number(opt.evo) || 1));
    const skinVoulu = opt.skin || 'base';

    for (let evo = evoVoulu; evo >= 1; evo--) {
      const evolution = f.evolutions?.[`e${evo}`];
      if (!evolution) continue;
      for (const skin of chaineSkins(evolution, skinVoulu)) {
        if (evolution.skins?.[skin]?.portrait !== true) continue;
        return {
          src: url(id, evo, skin, 'portrait', f.rev),
          etat: 'portrait', evo, skin,
          exact: evo === evoVoulu && skin === skinVoulu,
        };
      }
    }
    return null;
  }

  /**
   * L'adresse d'un dessin.
   *
   * `?v=` porte la révision du Fanzzy. `/img` est servi en `immutable` pour un
   * an : sans ce numéro, une carte redessinée n'atteindrait jamais quelqu'un
   * qui l'a déjà vue une fois.
   */
  const url = (id, evo, skin, nom, rev) =>
    `/img/fanzzy/${id}/e${evo}/${skin}/${nom}${EXT_ALPHA}?v=${rev ?? 1}`;

  /**
   * Précharge quelques états. À appeler pour ceux qui doivent apparaître sans
   * délai — le but, l'encaissé : ils arrivent au pire moment pour attendre.
   */
  function precharger(id, etats, opt = {}) {
    for (const etat of etats) {
      const r = resoudre(id, { ...opt, etat });
      if (r) new Image().src = r.src;
    }
  }

  window.TBF_ETATS = { ETATS, EXT, EXT_ALPHA, charger, pret, resoudre, portrait, precharger };
})();
