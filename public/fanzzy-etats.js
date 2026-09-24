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
  /** Les douze moments que le jeu sait détecter. */
  const ETATS = ['neutre', 'salut', 'pousse', 'but', 'encaisse', 'attente',
    'victoire', 'defaite', 'occasion', 'decision', 'progression', 'ennui'];

  /**
   * De quel dessin se sert chaque moment.
   *
   * **Copie de `FAMILLE` dans `src/shared/fanzzy/rendus.js`**, qui fait foi.
   * Elle est recopiée parce que ce fichier est un script classique servi au
   * navigateur et qu'il ne peut pas importer depuis `src/` — `ETATS` est
   * recopiée juste au-dessus pour exactement la même raison, et depuis plus
   * longtemps. `images:test` compare les deux et rougit si elles divergent :
   * une copie surveillée vaut mieux qu'une copie oubliée.
   *
   * Le jeu émet toujours les douze moments. Seuls quatre sont dessinés — voir
   * `ETATS_DESSINES` là-bas — et c'est ici que le pont se fait.
   */
  const FAMILLE = {
    neutre: null, salut: null, attente: null, ennui: null,
    pousse: 'pousse',
    but: 'joie', victoire: 'joie', progression: 'joie',
    encaisse: 'depit', defaite: 'depit',
    occasion: 'colere', decision: 'colere',
  };

  /* Les quatre familles elles-mêmes — les expressions qu'on gagne et qu'on
     choisit. Tirées de la table plutôt qu'écrites à côté : une cinquième
     famille ajoutée à `FAMILLE` devient demandable sans qu'on y pense. */
  const FAMILLES = new Set(Object.values(FAMILLE).filter(Boolean));

  /**
   * ## Le format des images : on ne le devine plus
   *
   * La détection d'avant demandait à un canvas ce qu'il savait **écrire** —
   * `toDataURL('image/avif')`, puis `toDataURL('image/webp')` — et prenait la
   * réponse pour ce que le navigateur savait **afficher**. Ce sont deux
   * questions sans rapport, et la réponse à la première ne dit rien de la
   * seconde :
   *
   *   — **aucun navigateur n'encode l'AVIF**, pas même Chrome. La branche
   *     `.avif` ne s'ouvrait donc pour personne : les vingt-quatre mégaoctets
   *     d'AVIF du dépôt n'ont jamais été servis à qui que ce soit.
   *   — **Safari n'encode pas le WebP**, et les Firefox d'avant la 96 non plus
   *     — alors que les deux le lisent depuis des années.
   *
   * Tout ce qui n'est pas Chrome retombait donc sur `.jpg`. Or **aucun Fanzzy
   * n'est publié en JPEG** : un personnage est détouré, il est rangé en AVIF,
   * WebP et PNG. L'accueil demandait `/img/fanzzy/TR57.jpg`, recevait un 404,
   * et laissait le cadre vide — sur Firefox et sur iPhone, pendant que Chrome
   * allait très bien. La fiche « Mon Fanzzy », elle, s'en sortait : son
   * `<img onerror>` retombe sur le PNG, ce que l'accueil ne faisait pas.
   *
   * On ne devine donc plus. **Le WebP est lu partout** — Safari 14 et Firefox
   * 65, c'est-à-dire 2020, bien avant le `dvh` de 2022 dont ce jeu ne peut pas
   * se passer — et **chaque image du dépôt a son jumeau `.webp`**. C'est le
   * format de tout le monde, et il n'y a plus rien à détecter.
   *
   * Les deux noms restent, parce que les deux replis restent : un décor est une
   * photo, son dernier recours est le JPEG ; un personnage est détouré, le sien
   * doit garder sa transparence, donc PNG. Les confondre a déjà donné au
   * supporter de l'accueil un fond blanc opaque.
   */
  const EXT = '.webp';
  const EXT_ALPHA = '.webp';

  /** Le dernier recours d'une photo — décor, carte d'action, chant. */
  const REPLI = '.jpg';
  /** Le dernier recours d'un dessin détouré — un Fanzzy, une pièce, une monnaie. */
  const REPLI_ALPHA = '.png';

  /**
   * L'adresse de secours d'un dessin qui n'a pas pu se charger.
   *
   * On remplace **l'extension**, jamais la fin de la chaîne : la révision vit
   * dans la requête — `neutre.webp?v=10` — et couper les cinq derniers
   * caractères donnait `neutre.webp?v` suivi de `.png`.
   *
   * Rend `null` quand il n'y a plus rien à essayer : l'adresse est déjà au
   * dernier recours, ou ce n'est pas une image. C'est ce qui permet à l'appelant
   * de s'arrêter au lieu de redemander deux fois la même chose.
   *
   * @param {string} src     l'adresse qui vient d'échouer
   * @param {boolean} [alpha] le dessin est détouré (défaut) ou c'est une photo
   */
  const secours = (src, alpha = true) => {
    const neuf = String(src ?? '')
      .replace(/\.(avif|webp|png|jpe?g)(?=$|\?)/i, alpha ? REPLI_ALPHA : REPLI);
    return neuf && neuf !== String(src ?? '') ? neuf : null;
  };

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

  /* ------------------------------------------------ ce que le joueur a gagné

     Les états sont devenus des cartes : les avoir dessinés ne suffit plus, il
     faut les avoir tirés. Cette table dit lesquels — `{ RP21: { 1: ['joie'] } }`,
     la forme exacte que rend `/api/fanzzy/state`.

     **Nulle tant qu'on ne l'a pas posée, et c'est délibéré.** Une page qui ne
     lit pas l'état du joueur — l'aide, un aperçu d'administration, une suite —
     doit continuer à montrer les dessins comme avant. Seules les pages qui
     savent à qui elles parlent posent la table, et à partir de là le repli sur
     le repos s'applique. Sans ce `null`, oublier l'appel sur une page aurait
     éteint toutes les expressions du jeu d'un coup, sans rien dire. */
  let gagnes = null;

  /** Pose ce que ce joueur a gagné. `null` revient à ne rien filtrer. */
  function possedes(table) {
    gagnes = table && typeof table === 'object' ? table : null;
  }

  /* Le repos n'est pas un état qu'on gagne : c'est la carte elle-même, celle
     qu'on a forcément puisqu'on possède le personnage. */
  const gagne = (id, evo, etat) => etat === 'neutre' || !gagnes
    || (gagnes[id]?.[evo] ?? gagnes[id]?.[String(evo)] ?? []).includes(etat);

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
    /* **Un moment, ou une famille.**

       La ligne d'avant n'acceptait que les douze **moments** — un but, une
       encaisse, une victoire — et ramenait tout le reste au repos. Or les
       expressions qu'on **gagne** en booster et qu'on **choisit** sur la fiche
       ne sont pas des moments : ce sont les quatre familles vers lesquelles
       les moments renvoient — la joie, le dépit, la poussée, la colère.

       Demander « joie » rendait donc « neutre ». Partout, depuis le premier
       jour, et sans un mot : `exact` annonçait même un succès, puisque
       l'état résolu égalait l'état voulu — celui qu'on venait de récrire.
       Seule « la poussée » passait, parce qu'elle est à la fois un moment et
       une famille. C'est la cause de la semaine où l'expression choisie
       n'apparaissait sur aucun écran alors que tout ce qui l'entoure était
       juste : l'avatar, la possession, le dessin, tout y était — sauf le
       droit de le demander.

       Une famille demandée directement n'a pas de famille à son tour :
       `FAMILLE['joie']` est indéfini, la chaîne vaut alors « joie, puis
       neutre », ce qui est exactement ce qu'on veut. */
    const valide = ETATS.includes(opt.etat) || FAMILLES.has(opt.etat);
    const etatVoulu = valide ? opt.etat : 'neutre';
    /* La chaîne de repli, dans l'ordre : **l'exact, sa famille, puis neutre**.
     *
     * La famille est l'étage neuf. Douze états par âge et par tenue ne se
     * dessinent pas — le chantier est à 3 % — donc on en dessine quatre, et
     * chaque moment se sert dans le sien : un but et une victoire montrent la
     * même joie, un carton et une occasion manquée la même mauvaise humeur.
     *
     * L'exact reste tenté **en premier**, et c'est tout l'intérêt de faire le
     * pont ici plutôt que de réécrire les appels : le jour où quelqu'un dessine
     * un `occasion` à lui, il reprend sa place sans qu'on touche à rien.
     *
     * `neutre` n'apparaît qu'une fois, et jamais en double : le drapeau `exact`
     * annoncerait un succès là où l'on a reculé de deux crans.
     */
    const famille = FAMILLE[etatVoulu] ?? null;
    const etats = [...new Set(
      [etatVoulu, famille, 'neutre'].filter(Boolean))];

    for (let evo = evoVoulu; evo >= 1; evo--) {
      const evolution = f.evolutions?.[`e${evo}`];
      if (!evolution) continue;
      const skins = chaineSkins(evolution, skinVoulu);
      for (const etat of etats) {
        for (const skin of skins) {
          if (!aLetat(evolution, skin, etat)) continue;
          /* Dessiné, mais pas gagné : on continue à descendre la chaîne, qui
             finit toujours sur le repos. Le personnage reste affiché, sans son
             expression — aucun effet sur les règles, c'est du confort. */
          if (!gagne(id, evo, etat)) continue;
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

  window.TBF_ETATS = { ETATS, EXT, EXT_ALPHA, REPLI, REPLI_ALPHA, secours,
    charger, pret, resoudre, portrait, precharger, possedes };
})();
