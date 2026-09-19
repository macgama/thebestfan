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
   * Ce que la carte annonce, en un nombre et un mot.
   *
   * ## La règle, et elle n'a qu'une ligne
   *
   * **On lit ce que la carte porte, on ne calcule rien.** Un `push` de 22 est
   * écrit 22, et c'est vrai de la carte quel que soit le stade, l'équipement ou
   * le Fanzzy qui la joue. Ce que la poussée a **réellement** valu, le serveur
   * le dit ailleurs, à la corde, où elle s'applique — et c'est très bien que
   * les deux chiffres soient à deux endroits : l'un est la carte, l'autre est
   * le coup.
   *
   * Les mettre d'accord aurait voulu dire refaire ici le calcul du moteur, donc
   * en tenir une seconde copie, donc la voir diverger. C'est exactement la
   * faute des pulsations dessinées en dur, payée une fois déjà.
   *
   * ## Pourquoi tant de sortes pour si peu de mots
   *
   * Les vingt-cinq effets du jeu ne se résument pas au même endroit : une
   * poussée porte une valeur, une entrave porte une durée, un ralliement porte
   * un facteur, et cinq d'entre eux ne portent rien du tout. Une table qui
   * afficherait `effet.valeur` pour tout le monde écrirait « 0,5 point » sur
   * une carte qui plafonne la qualité à la moitié.
   *
   * **Sans nombre, on n'en invente pas.** Le mot de la famille seul vaut mieux
   * qu'un chiffre faux : le joueur lit un bandeau sans valeur comme « cette
   * carte ne se compte pas », ce qui est la vérité.
   */
  const SECONDES = (ms) => `${Math.round((Number(ms) || 0) / 1000)} s`;

  function resume(a) {
    const e = a?.effet ?? {};
    const fam = famDe(a);
    const dit = (n, quoi) => ({ n, quoi: quoi ?? fam.nom });

    switch (e.type) {
      /* Les trois poussées. `delayed_push` et `push_over_time` annoncent leur
         total : c'est ce que la carte vaut, même si elle le livre en dix coups
         ou huit secondes plus tard — le texte de la carte, lui, dit comment. */
      case 'push': case 'delayed_push': case 'push_over_time':
        return dit(`+${e.valeur}`, 'POUSSÉE');

      case 'team_breath': return dit(`+${e.valeur}`, 'SOUFFLE');
      case 'steal': return dit(`+${e.valeur}`, 'VOLÉ');
      case 'refill': return dit(`+${Math.round((e.part ?? 0) * 100)} %`, 'SOUFFLE');
      case 'shield': return dit(`−${e.valeur}`, 'ABSORBÉ');
      case 'per_mate': return dit(`+${e.valeur}`, 'PAR ÉQUIPIER');
      case 'rally': return dit(`×${String(e.bonus ?? 1).replace('.', ',')}`, 'TRIBUNE');
      case 'sync': return dit(`+${e.max}`, 'ENSEMBLE');

      /* Tout ce qui dure. La durée **est** la valeur de ces cartes-là : un
         silence de quatre secondes et un de huit ne sont pas la même carte, et
         c'est la seule chose qui les distingue à l'œil. */
      case 'silence': case 'blind': case 'lock_actions': case 'freeze_decay':
      case 'mod_foe': case 'double_next':
        return dit(SECONDES(e.duree));

      case 'cost_free': return dit(`${e.cartes}`, 'GRATUITES');
      case 'floor_quality':
        return dit(`${Math.round((e.valeur ?? 0) * 100)} %`, 'PLANCHER');

      /* `mod_self` porte des charges, pas une durée : deux gestes améliorés,
         et c'est ce nombre-là qui compte pour décider quand la jouer.

         **Au-dessus d'une seule**, et c'est la même règle qu'ailleurs ici :
         « ×1 » n'apprend rien à personne — on sait qu'une carte jouée agit une
         fois. Le mot seul dit alors tout ce qu'il y a à dire. */
      case 'mod_self': case 'reflect':
        return e.charges > 1 ? dit(`×${e.charges}`, fam.nom) : dit(null);

      default: return dit(null);
    }
  }

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
  /* ------------------------------------------ la file d'attente des cartes

     Une carte jouée vole au milieu de l'écran, par-dessus tout — `z-index: 95`,
     au-dessus même de la fenêtre des épreuves. Quand l'adversaire jouait
     pendant qu'on refaisait une mosaïque ou qu'on triait des cartons, sa carte
     passait devant la grille : on perdait de vue ce qu'on était en train de
     faire, avec un chronomètre qui courait.

     Monter la fenêtre au-dessus de la carte aurait réglé le recouvrement et
     créé pire : la carte se serait jouée derrière un voile opaque, et on
     n'aurait jamais su ce que l'autre venait de poser.

     Elle est donc **mise de côté** et rejouée à la fermeture. Rien n'est perdu,
     rien ne gêne. La file est bornée à trois : au-delà, ce n'est plus de
     l'information, c'est un défilé — on garde les trois dernières, qui sont
     celles dont l'effet est encore à l'écran. */
  let suspendu = false;
  const enAttente = [];
  const GARDE = 3;

  /** Met les cartes en attente. Appelé quand une épreuve prend l'écran. */
  function suspendre() { suspendu = true; }

  /** Rejoue ce qui s'est joué pendant, espacé pour rester lisible. */
  function reprendre() {
    suspendu = false;
    const file = enAttente.splice(0, enAttente.length);
    file.forEach((args, i) => setTimeout(() => jouee(...args), i * 520));
  }

  function jouee(a, { pour = true, vers = null, depuis = null } = {}) {
    if (!a) return;
    if (suspendu) {
      enAttente.push([a, { pour, vers, depuis: null }]);
      /* `depuis` est mis à null : la carte de départ aura disparu de la main
         d'ici là, et voler depuis un élément retiré donne un point à zéro,
         c'est-à-dire un vol depuis le coin de l'écran. */
      if (enAttente.length > GARDE) enAttente.shift();
      return;
    }
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
      ${(() => {
    const r = resume(a);
    if (!r.quoi && r.n == null) return '';
    return `<div class="tbf-jouee-somme${r.n == null ? ' sansnombre' : ''}"
          ><b>${echappe(r.n ?? '')}</b><span>${echappe(r.quoi)}</span></div>`;
  })()}
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

  window.TBF_ACTION = { FAM, famDe, resume, adresse, illustration, jouee, suspendre, reprendre };
})();
