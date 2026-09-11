/**
 * Les cartes d'action : leur famille, leur dessin, et ce qu'on voit partir.
 *
 * ## Pourquoi un fichier à part
 *
 * La table des sept familles était écrite **deux fois** — la version complète
 * dans le classeur (couleur, socle, glyphe, nom), une version réduite dans le
 * duel (la couleur seule). Deux tables pour une même règle finissent toujours
 * par diverger : l'orange de « bascule » n'existait déjà que d'un côté sous
 * son nom, et une huitième famille aurait été ajoutée à un seul endroit.
 *
 * Le dessin arrive maintenant par-dessus, et il pose la même question à
 * chaque écran : où est le fichier, que faire quand il manque, à quoi
 * ressemble une carte qu'on joue. Trois réponses, un seul endroit.
 *
 * ## Le repli
 *
 * Aucun écran ne dépend d'un téléchargement. L'illustration se pose **par-
 * dessus** le glyphe de famille que la carte porte déjà : si le fichier
 * manque, l'image se retire elle-même et le glyphe réapparaît. La carte reste
 * lisible, elle est seulement moins belle — ce qui est le bon ordre.
 *
 * Script classique, pas module : comme tout ce qui vit dans `public/`.
 */
(() => {
  /**
   * Les sept familles de cartes d'action.
   *
   * `c2` est la couleur du socle — le biseau dur sous la carte, qui lui donne
   * sa matière. `ico` est le glyphe que la carte porte en grand derrière son
   * coût : il se reconnaît avant qu'on ait lu le nom, ce qui compte quand dix
   * cartes tiennent sur deux rangées de cent pixels, et c'est lui qui reste
   * quand le dessin n'arrive pas.
   */
  const FAM = {
    pousse: { nom: 'POUSSÉE', c: '#E0402C', c2: '#7A1A11',
      ico: 'M12 20V5M6 11l6-6 6 6M4 21h16' },
    entrave: { nom: 'ENTRAVE', c: '#8257DA', c2: '#3E2870',
      ico: 'M9 8a4 4 0 0 1 0 8M15 8a4 4 0 0 0 0 8M7 12h10' },
    souffle: { nom: 'SOUFFLE', c: '#3C82E8', c2: '#1B3E75',
      ico: 'M3 8h11a3 3 0 1 0-3-3M3 13h13a3 3 0 1 1-3 3M3 18h7' },
    geste: { nom: 'GESTE', c: '#F5C33B', c2: '#7A5A0E',
      ico: 'M12 3l5 15H7zM4 21h16M9 13l7-5' },
    garde: { nom: 'GARDE', c: '#C2CAD6', c2: '#4E5865',
      ico: 'M12 3l7 3v5c0 4.4-2.9 8.2-7 10-4.1-1.8-7-5.6-7-10V6z' },
    collectif: { nom: 'COLLECTIF', c: '#1E9E6A', c2: '#0D4F35',
      ico: 'M7 10a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zm10 0a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM2 20c0-3 2.2-5 5-5s5 2 5 5m0 0c0-3 2.2-5 5-5s5 2 5 5' },
    bascule: { nom: 'BASCULE', c: '#E08A2C', c2: '#7A4A0E',
      ico: 'M4 8h14l-4-4M20 16H6l4 4' },
  };

  /** Une famille inconnue ne doit pas vider une carte : on retombe sur violet. */
  const famDe = (a) => FAM[a?.fam] ?? { nom: '', c: '#8257DA', c2: '#3E2870', ico: '' };

  /**
   * Le format servi.
   *
   * La détection est celle de `fanzzy-art.js`, empruntée plutôt que recopiée :
   * c'est déjà le quatrième endroit du dossier `public/` qui teste AVIF puis
   * WebP, et un cinquième n'apporterait rien qu'une divergence de plus. Sans
   * lui — une page qui ne charge pas les Fanzzy — le JPEG marche partout.
   */
  const ext = () => window.FZART?.IMG_EXT ?? '.jpg';

  const adresse = (id) => `/img/action/${id}${ext()}`;

  const echappe = (s) => String(s ?? '').replace(/[<>&"]/g,
    (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

  /**
   * L'illustration d'une carte, en HTML, à poser **après** le glyphe.
   *
   * `this.remove()` est le repli : un fichier absent retire son image et le
   * glyphe dessous redevient visible. Sans ça, une carte sans dessin
   * afficherait le carré vide du navigateur — pire que pas d'image du tout.
   */
  function illustration(id, classe = 'illu') {
    return `<img class="${classe}" src="${adresse(id)}" alt="" loading="lazy"
      onerror="this.remove()">`;
  }

  /* ------------------------------------------------- la carte qu'on joue */

  /**
   * Ce qu'on voit quand une carte part.
   *
   * Une carte jouée n'était qu'un mot qui montait du nœud de la corde. Deux
   * cartes de la même famille se ressemblaient donc totalement au moment
   * exact où elles comptent le plus — et le joueur d'en face, qui n'a pas la
   * carte en main, n'avait aucun moyen de savoir ce qui venait de lui tomber
   * dessus autrement qu'en lisant six pixels de texte pendant une seconde.
   *
   * La carte se montre maintenant **en grand, avec son dessin**, au centre :
   * elle arrive du bas si elle est à toi, du haut si elle est adverse — la
   * provenance suffit à dire le camp sans qu'on ait à l'écrire — elle tient la
   * pose le temps qu'on la reconnaisse, puis elle se replie vers la corde, où
   * son effet va se lire.
   *
   * @param {object} a       la carte du catalogue ({id, nom, fam, texte…})
   * @param {object} options `pour` : jouée par toi. `vers` : le point où
   *   l'effet va se produire — le nœud de la corde. `depuis` : l'élément
   *   d'où elle part, quand on l'a sous la main.
   */
  function jouee(a, { pour = true, vers = null, depuis = null } = {}) {
    if (!a) return;
    const fam = famDe(a);
    const doux = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const el = document.createElement('div');
    el.className = 'tbf-jouee';
    el.style.setProperty('--fc', fam.c);
    el.style.setProperty('--fc2', fam.c2);
    el.innerHTML = `
      <div class="tbf-jouee-carte">
        <svg class="sceau" viewBox="0 0 24 24" aria-hidden="true"><path d="${fam.ico}"/></svg>
        ${illustration(a.id)}
        <div class="cout">${a.cost ?? ''}</div>
        <div class="nm">${echappe(a.nom ?? a.id)}</div>
      </div>
      <div class="tbf-jouee-texte">${echappe(a.texte ?? '')}</div>`;
    document.body.appendChild(el);

    /**
     * Le retrait passe par une minuterie, jamais par `onfinish`.
     *
     * Une animation est accrochée à la frise du document, et un onglet caché
     * la gèle : le joueur qui sort de l'application pendant un duel revenait
     * avec la carte toujours plantée au milieu de l'écran, par-dessus la
     * corde, pour le reste de la partie — `onfinish` n'était jamais arrivé.
     * Une minuterie, elle, court même en arrière-plan.
     */
    const retirer = (ms) => setTimeout(() => el.remove(), ms);

    /* Un mouvement réduit reste un mouvement : la carte se montre et s'en va,
       sans vol ni bascule. Ce qu'on supprime, c'est le déplacement — pas
       l'information, qui est tout l'intérêt de l'animation. */
    if (doux) {
      el.animate([{ opacity: 0 }, { opacity: 1, offset: 0.15 },
        { opacity: 1, offset: 0.75 }, { opacity: 0 }],
      { duration: 1400, easing: 'ease' });
      retirer(1460);
      return;
    }

    /* D'où elle vient. Le bas pour toi, le haut pour l'adversaire : c'est le
       même code que la corde, qui monte vers celui qui pousse. */
    const dep = depuis?.getBoundingClientRect?.();
    const cx = innerWidth / 2;
    const cy = innerHeight * 0.42;
    const x0 = dep?.width ? dep.left + dep.width / 2 - cx : 0;
    const y0 = dep?.width ? dep.top + dep.height / 2 - cy : (pour ? 230 : -230);

    /* Où elle va : vers le point où l'effet va se lire, pour que l'œil y soit
       déjà quand le chiffre en sort. */
    const x1 = vers ? vers.x - cx : 0;
    const y1 = vers ? vers.y - cy : 0;

    el.animate([
      { transform: `translate(calc(-50% + ${x0}px), calc(-50% + ${y0}px)) `
        + `scale(.42) rotate(${pour ? -9 : 9}deg)`, opacity: 0 },
      { transform: 'translate(-50%,-50%) scale(1.06) rotate(0deg)',
        opacity: 1, offset: 0.24 },
      { transform: 'translate(-50%,-50%) scale(1) rotate(0deg)',
        opacity: 1, offset: 0.32 },
      { transform: 'translate(-50%,-50%) scale(1) rotate(0deg)',
        opacity: 1, offset: 0.7 },
      { transform: `translate(calc(-50% + ${x1}px), calc(-50% + ${y1}px)) scale(.3)`,
        opacity: 0 },
    ], { duration: 1250, easing: 'cubic-bezier(.2,.9,.25,1)' });
    retirer(1310);

    /* L'éclat de la famille, au moment où la carte est en grand. Il part de la
       carte, pas du nœud : c'est elle qu'on regarde à cette seconde-là. */
    setTimeout(() => {
      window.FX?.particules?.({ x: cx, y: cy, n: 20, distance: 150, taille: 5,
        couleurs: [fam.c, '#F2EEE4'] });
    }, 280);
    window.FX?.son?.('carte');
  }

  window.TBF_ACTION = { FAM, famDe, adresse, illustration, jouee };
})();
