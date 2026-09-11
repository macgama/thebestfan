/**
 * Le stade, et la lumière de ses tribunes.
 *
 * ## Oui, on peut allumer les tribunes
 *
 * Les cinq stades sont dessinés de nuit, **tribunes dans l'ombre** : c'était
 * la consigne donnée au dessin, et c'est ce qui rend tout le reste possible.
 * Une tribune déjà éclairée ne peut plus s'allumer ; une tribune sombre, si.
 *
 * On pose donc sur chaque bande de foule une nappe de lumière aux couleurs du
 * club, en `mix-blend-mode: screen` — le mode qui *ajoute* de la lumière au
 * lieu de repeindre par-dessus. Le grain de la foule reste visible dessous, et
 * ce qu'on voit n'est pas un rectangle coloré : c'est la tribune qui s'éclaire.
 *
 * Trois choses la font bouger :
 *   — **l'intensité**, continue, branchée sur ce que fait la tribune. Une
 *     tribune qui pousse brille, une tribune qui subit s'éteint. C'est la
 *     corde, lisible sans lire un chiffre ;
 *   — **le battement**, court, à chaque chant ou carte jouée ;
 *   — **l'embrasement**, une fois, au but.
 *
 * ## Où sont les tribunes
 *
 * Pas écrites à l'œil : mesurées sur le dessin par `scripts/stade-images.mjs`,
 * qui repère le terrain à sa teinte et en déduit les bandes qui le bordent.
 * Les plans arrivent dans `/img/stade/plans.json`. Un stade redessiné garde
 * donc ses tribunes au bon endroit sans que personne n'y pense.
 *
 * Script classique, pas module : comme tout ce qui vit dans `public/`.
 */
(() => {
  /** Le format servi. La détection appartient à `fanzzy-art.js`. */
  const ext = () => window.FZART?.IMG_EXT ?? '.jpg';

  const adresse = (id, mini = false) =>
    `/img/stade/${id}${mini ? '-mini' : ''}${ext()}`;

  /** Les plans, chargés une seule fois et partagés par toutes les scènes. */
  let plans = null;
  let enVol = null;
  function chargerPlans() {
    if (plans) return Promise.resolve(plans);
    enVol = enVol ?? fetch('/img/stade/plans.json')
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}))          // sans plans, on affiche le stade sans lumière
      .then((p) => { plans = p; return p; });
    return enVol;
  }

  const pc = (v) => `${(v * 100).toFixed(2)}%`;

  /**
   * Monte un stade dans un élément, et rend de quoi l'animer.
   *
   * @param hote      l'élément qui reçoit le stade. Il doit être positionné.
   * @param id        l'identifiant du stade.
   * @param couleurs  [couleur du camp 0, couleur du camp 1]. Le camp 0 est à
   *   gauche, comme le terrain : c'est le domicile.
   */
  function monter(hote, { id, couleurs = ['#F5C33B', '#3C82E8'] } = {}) {
    if (!hote) return null;
    hote.innerHTML = `
      <img class="tbf-stade-fond" src="${adresse(id)}" alt="" decoding="async"
        onerror="this.remove()">
      <div class="tbf-tribune" data-camp="0" style="--c:${couleurs[0]}"></div>
      <div class="tbf-tribune" data-camp="1" style="--c:${couleurs[1]}"></div>`;
    hote.classList.add('tbf-stade');

    const bandes = [hote.querySelector('[data-camp="0"]'),
                    hote.querySelector('[data-camp="1"]')];

    /* Les bandes sont posées dès que les plans arrivent. Avant ça elles sont
       invisibles plutôt que mal placées : une nappe de lumière au milieu du
       terrain pendant deux dixièmes de seconde se voit, et fait plus de mal
       qu'un stade qui s'allume un instant plus tard. */
    chargerPlans().then((tous) => {
      const p = tous[id];
      if (!p) return;
      for (const [i, cote] of [p.gauche, p.droite].entries()) {
        const el = bandes[i];
        if (!el) continue;
        el.style.left = pc(cote.x0);
        el.style.top = pc(cote.y0);
        el.style.width = pc(cote.x1 - cote.x0);
        el.style.height = pc(cote.y1 - cote.y0);
        el.classList.add('pret');
      }
    });

    /** Les minuteries de battement, par camp. Nulées : voir plus bas. */
    const bat = [null, null];

    return {
      /**
       * Ce que la tribune donne, entre 0 et 1.
       *
       * Ce n'est pas une jauge : c'est de la lumière. Elle ne descend jamais
       * tout à fait à zéro — une tribune éteinte donnerait un stade vide, et
       * il y a toujours du monde dedans.
       */
      intensite(camp, v) {
        const el = bandes[camp];
        if (!el) return;
        el.style.setProperty('--i', Math.max(0, Math.min(1, Number(v) || 0)).toFixed(3));
      },

      /**
       * Un battement : un chant, une carte. Court, et il ne s'empile pas.
       *
       * `clearTimeout` laisse derrière lui un identifiant qui reste vrai : la
       * minuterie est donc **nulée** en même temps qu'elle est effacée. Sans
       * ça, un test « une minuterie court-elle ? » serait vrai pour toujours,
       * et c'est une erreur que ce projet a déjà payée trois fois.
       */
      pulse(camp) {
        const el = bandes[camp];
        if (!el) return;
        el.classList.remove('bat');
        void el.offsetWidth;              // redémarre l'animation
        el.classList.add('bat');
        clearTimeout(bat[camp]); bat[camp] = null;
        bat[camp] = setTimeout(() => { el.classList.remove('bat'); bat[camp] = null; }, 620);
      },

      /** Un but. Toute la tribune s'embrase, une fois. */
      embraser(camp) {
        const el = bandes[camp];
        if (!el) return;
        el.classList.remove('feu');
        void el.offsetWidth;
        el.classList.add('feu');
        setTimeout(() => el.classList.remove('feu'), 2400);
      },

      /** Les couleurs changent quand on apprend celles des clubs. */
      couleurs(c0, c1) {
        if (c0) bandes[0]?.style.setProperty('--c', c0);
        if (c1) bandes[1]?.style.setProperty('--c', c1);
      },
    };
  }

  window.TBF_STADE = { adresse, monter, chargerPlans };
})();
