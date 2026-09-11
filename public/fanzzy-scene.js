/**
 * La scène d'un Fanzzy : le personnage, ses poses, son moment fort.
 *
 * L'accueil sait déjà faire tout cela — croiser deux calques pour changer de
 * pose sans que rien clignote, retomber sur l'état de fond après une
 * célébration, tenir « GOAL ! » quinze secondes le temps qu'on sorte son
 * téléphone. Le virage a besoin exactement des mêmes gestes ; le duel et la
 * fiche du match les auront après lui.
 *
 * Les recopier à chaque écran, ce serait trois personnages qui finiraient par
 * ne plus réagir pareil. C'est déjà arrivé deux fois sur ce projet : au dessin
 * des Fanzzy, puis au catalogue. On ne le refait pas une troisième.
 *
 * Ce module ne dessine aucune interface autour du personnage : il remplit une
 * boîte que la page lui donne, à la taille et à la place que la page a
 * décidées. Les règles de style vivent dans `ui.css`, sous le préfixe `tbf-`,
 * avec le reste de la coque commune.
 *
 * Le repli, du mieux dessiné au dernier recours :
 *
 *   1. les douze états, quand ils existent pour ce personnage à cet âge ;
 *   2. le plein-pied — deux cents Fanzzy l'ont, sans avoir d'états. Il est
 *      immobile : il ne réagit ni au but ni à la poussée. C'est un moindre mal
 *      assumé — un bon personnage figé se lit comme un dessin qui manque, un
 *      mauvais personnage animé se lit comme un bug ;
 *   3. rien. La page garde sa boîte vide, ce qui vaut mieux qu'un cadre brisé.
 *
 * Script classique, pas module : tout ce qui vit dans `public/` est chargé par
 * une balise `<script src>` ordinaire. On expose un global, comme `fx.js`,
 * `nav.js`, `fanzzy-art.js` et `fanzzy-etats.js`.
 */
(() => {
  /* Les gestes de la scène : la classe qui les porte, et le nom de
     l'animation qu'elle déclenche. Les deux sont nécessaires — la classe vit
     sur la scène, l'animation sur un calque intérieur, et c'est le nom qui
     permet de retirer la bonne classe quand deux gestes se chevauchent. */
  const ANIM = {
    entre: 'tbf-monte',
    coucou: 'tbf-coucou',
    saute: 'tbf-saut',
    change: 'tbf-bascule',
  };

  /** Les états qu'une page peut vouloir sans délai : ils arrivent au pire moment. */
  const CHAUDS = ['neutre', 'pousse', 'but', 'encaisse'];

  let seq = 0;

  /**
   * Monte une scène dans `hote` et rend de quoi la piloter.
   *
   * @param {HTMLElement} hote      la boîte qui portera le personnage
   * @param {object}      [opts]
   * @param {HTMLElement} [opts.momentDans]  où poser le bandeau du moment fort.
   *   Par défaut la boîte du personnage — mais dans le virage elle occupe un
   *   coin de l'écran, et « GOAL ! » doit tenir toute la largeur.
   * @param {string}      [opts.fond]  l'état de repos, `neutre` par défaut.
   */
  function creer(hote, opts = {}) {
    if (!hote) {
      throw new Error('TBF_SCENE.creer : aucune boîte où poser le personnage');
    }

    const el = document.createElement('div');
    el.className = 'tbf-scene';
    /* Un calque par geste. Deux animations sur le même élément et l'une
       efface l'autre : sur l'accueil, c'est la respiration qui disparaissait
       au premier petit saut, définitivement, sans que rien ne le signale. */
    el.innerHTML = `<div class="tbf-salut"><div class="tbf-monte"><div class="tbf-saut">
      <div class="tbf-souffle"><img class="tbf-pose" alt=""><img class="tbf-pose" alt=""></div>
    </div></div></div>`;
    hote.appendChild(el);

    const banniere = document.createElement('div');
    banniere.className = 'tbf-moment';
    banniere.innerHTML = '<b></b><small></small>';
    (opts.momentDans ?? el).appendChild(banniere);

    const calques = [...el.querySelectorAll('.tbf-pose')];
    let devant = 0;
    let poseActuelle = null;
    let retour = null;
    let demande = 0;
    let fond = opts.fond ?? 'neutre';
    let perso = null;
    let cleMoment = 0;

    /* ------------------------------------------------------------ le dessin */

    /** L'image d'un état, ou `null` si ce personnage n'a rien à montrer. */
    function source(etat) {
      if (!perso) return null;
      const r = window.TBF_ETATS?.resoudre?.(perso.id, {
        evo: perso.evo, skin: perso.skin, etat,
      });
      if (r) return r.src;
      // Pas d'états dessinés : le plein-pied, s'il existe. Il ne change pas
      // d'un état à l'autre, mais c'est **le bon personnage** — et c'est ce
      // que le joueur vérifie en premier.
      return perso.plein ?? null;
    }

    /**
     * Deux identifiants, et les confondre donne le mauvais dessin.
     *
     * Les **états** sont rangés par personnage : `V1/e2/base/but`. Le second
     * âge du Choriste s'y demande sous le nom de la lignée, avec `evo: 2`.
     * Les **illustrations en pied**, elles, sont rangées par carte du
     * catalogue : le Meneur de chant est `V2.avif`, pas `V1.avif`.
     *
     * Demander le plein-pied sous le nom de la lignée affiche donc le premier
     * âge à quelqu'un qui a payé quatre-vingt-dix écharpes pour ne plus le
     * voir — sans rien casser, ce qui est le pire des cas.
     */
    function pleinPied(p) {
      return p.plein ?? window.FZART?.adresse?.(p.age ?? p.id, 'plein') ?? null;
    }

    /**
     * Change la pose. Un état dont le dessin manque ne fait rien du tout :
     * mieux vaut un personnage immobile qu'un cadre vide.
     *
     * `tenir` en millisecondes : le temps d'une célébration, après quoi on
     * revient à l'état de fond. Un but garde le personnage bras levés quinze
     * secondes, pas jusqu'au prochain rechargement de la page.
     */
    async function pose(nom, tenir, force) {
      /* Un jeton par demande, et la dernière gagne.
         Deux poses peuvent se chevaucher — le personnage arrive pendant que
         le virage, qui se redessine chaque seconde, repose son état de fond.
         Elles écrivent alors dans le **même** calque caché, et la seconde
         remplace la source que la première est en train de décoder. Sans ce
         jeton, celle qui finit en dernier gagne l'affichage, quel que soit
         l'ordre où on les a demandées : le personnage peut rester sur une pose
         qu'on venait de remplacer. Ça ne se voit pas à la lecture et ça ne
         casse rien bruyamment — c'est le genre de faute qu'on met des jours à
         reproduire. */
      const jeton = ++demande;
      clearTimeout(retour);
      retour = null;
      const src = source(nom);
      if (!src) return false;
      // `force` sert quand le personnage change sans que l'état change : le
      // Fanzzy équipé vient d'arriver et doit remplacer celui d'avant.
      if (nom === poseActuelle && !force) { rendreLaMain(tenir); return true; }

      const derriere = calques[1 - devant];
      derriere.src = src;
      try { await derriere.decode(); }
      catch {
        // Le format moderne peut manquer là où le PNG existe : on retente une
        // fois. La révision vit dans la requête, on ne change que l'extension.
        try {
          derriere.src = src.replace(/\.(avif|webp)(\?|$)/, '.png$2');
          await derriere.decode();
        } catch { return false; }            // cet état n'est pas dessiné
      }
      if (jeton !== demande) return false;   // une autre pose est passée devant

      poseActuelle = nom;
      derriere.classList.add('on');
      calques[devant].classList.remove('on');
      devant = 1 - devant;
      rejouer('change');
      rendreLaMain(tenir);
      return true;
    }

    /**
     * Rendre la main à l'état de fond après une célébration.
     *
     * `retour` doit **redevenir vide** quand la minuterie a fini son travail.
     * `clearTimeout` annule le rappel mais laisse l'identifiant en place : la
     * variable restait donc vraie pour toujours après la première pose tenue,
     * et `poserFond` — qui ne pose que si aucune célébration n'est en cours —
     * cessait définitivement d'agir. Sur l'accueil, le personnage continuait
     * de pousser après le coup de sifflet final, et rien ne le disait.
     */
    function rendreLaMain(tenir) {
      if (!tenir) return;
      retour = setTimeout(() => { retour = null; pose(fond); }, tenir);
    }

    /**
     * L'état de repos, celui vers lequel on retombe après une célébration.
     * `pousse` pendant que la tribune chante, `attente` le reste du temps :
     * sans cette distinction, un but ramenait le personnage au calme alors
     * que le match continuait.
     */
    function poserFond(p) { fond = p; if (!retour) pose(p); }

    /* ------------------------------------------------------------ les gestes */

    /**
     * Joue un geste, du début, et **retire la classe quand il est fini**.
     *
     * La retirer n'est pas une politesse : ces gestes remplacent des
     * animations qui tournent en boucle, et une classe laissée en place fige
     * le personnage sur la dernière image d'un geste terminé.
     */
    function rejouer(classe) {
      el.classList.remove(classe);
      void el.offsetWidth;                   // relance l'animation depuis zéro
      el.classList.add(classe);
      // Filtré par nom : les gestes se superposent, et la fin de l'un ne doit
      // pas interrompre l'autre.
      const fini = (e) => {
        if (e.animationName !== ANIM[classe]) return;
        el.classList.remove(classe);
        el.removeEventListener('animationend', fini);
      };
      el.addEventListener('animationend', fini);
    }

    /** Le petit saut, indépendant de la pose affichée. */
    function saute() { rejouer('saute'); }

    /** Le coucou. Il part même quand la pose de salut n'est pas dessinée :
        presque aucun Fanzzy ne l'a, et un salut réservé aux personnages
        illustrés serait un salut que presque personne ne verrait. */
    function salue() { rejouer('coucou'); }

    /* ------------------------------------------------------- le moment fort */

    /**
     * Le personnage prend la pose et un bandeau l'annonce.
     *
     * La durée vient de `fx.js` — quinze secondes — et elle est la même
     * partout où un Fanzzy réagit. Les célébrations tenaient deux secondes et
     * demie : le temps de sortir son téléphone, le but n'avait laissé aucune
     * trace.
     *
     * Un moment en remplace un autre plutôt que de faire la queue. Deux buts
     * en quinze secondes arrivent, et c'est le dernier qui compte.
     *
     * @returns {string} la clé du moment, à donner à `preciser`.
     */
    function moment(etat, titre, o = {}) {
      const ms = o.ms ?? window.FX?.MOMENT ?? 15000;
      if (etat) pose(etat, ms);
      banniere.querySelector('b').textContent = titre;
      banniere.querySelector('small').textContent = o.sous ?? '';
      banniere.style.setProperty('--mc', o.couleur ?? 'var(--projo)');
      banniere.style.setProperty('--mt', `${ms}ms`);
      banniere.classList.remove('on');
      void banniere.offsetWidth;
      banniere.classList.add('on');
      banniere.dataset.cle = String(++cleMoment);
      clearTimeout(banniere._t);
      banniere._t = setTimeout(() => banniere.classList.remove('on'), ms);
      return banniere.dataset.cle;
    }

    /**
     * Complète un moment déjà affiché — le nom du buteur arrive après le score.
     *
     * `cle` protège du décalage : ce nom met une seconde à revenir de la base,
     * et un second but peut tomber entre-temps. Sans elle, le premier buteur
     * viendrait s'écrire sous le second but.
     */
    function preciser(cle, sous) {
      if (!sous || banniere.dataset.cle !== cle || !banniere.classList.contains('on')) return;
      banniere.querySelector('small').textContent = sous;
    }

    /** Coupe le moment en cours — un but refusé n'a plus rien à célébrer. */
    function couper() {
      banniere.classList.remove('on');
      clearTimeout(banniere._t);
    }

    /* ----------------------------------------------------------- l'arrivée */

    /**
     * Dit quel personnage occupe la scène.
     *
     * @param {object} p  { id, age, evo, skin, plein }.
     *   `id` est **la lignée** — c'est sous ce nom que les états sont rangés.
     *   `age` est la carte du catalogue à l'âge atteint, sous laquelle est
     *   rangée l'illustration en pied ; sans elle on retombe sur `id`, ce qui
     *   ne vaut que pour un personnage resté à son premier âge.
     *   `plein` est facultatif : voir `pleinPied`.
     * @returns {Promise<boolean>} vrai si quelque chose s'affiche.
     */
    async function definir(p) {
      const cle = ++seq;
      if (!p?.id) { perso = null; return false; }

      // Le manifeste ne lève jamais : une page qui n'a pas pu le charger doit
      // rester utilisable, avec le plein-pied à la place des états.
      try { await window.TBF_ETATS?.charger?.(); }
      catch { /* manifeste injoignable : le plein-pied suffit */ }
      if (cle !== seq) return false;         // un autre personnage est passé devant

      perso = {
        id: p.id,
        age: p.age ?? p.id,
        evo: Math.min(3, Math.max(1, Number(p.evo) || 1)),
        skin: p.skin || 'base',
        plein: null,
      };
      perso.plein = pleinPied({ ...perso, plein: p.plein });
      poseActuelle = null;

      // Précharge ce qui doit apparaître sans délai. Un but qui attend son
      // image, c'est un but célébré trois secondes trop tard.
      for (const etat of CHAUDS) {
        const s = source(etat);
        if (s) new Image().src = s;
      }

      const vu = await pose(fond, 0, true);
      if (cle !== seq || !vu) return vu;
      rejouer('entre');
      salue();
      return true;
    }

    /* `etat` dit ce que la scène montre en ce moment. Il sert d'abord aux
       contrôles : la plupart des Fanzzy n'ont pas leurs douze états dessinés,
       ils affichent le même plein-pied quoi qu'il arrive, et regarder l'image
       ne dit donc rien de ce que le personnage est censé vivre. Sans ce
       témoin, un test du but resterait vert alors que la scène n'aurait rien
       reçu du tout. */
    return { el, banniere, definir, pose, poserFond, moment, preciser, couper,
      saute, salue, etat: () => poseActuelle };
  }

  window.TBF_SCENE = { creer, CHAUDS };
})();
