/**
 * Ce que porte un supporter, dit en français — **une seule fois**.
 *
 * ## Pourquoi ce fichier existe
 *
 * La même table vivait en quatre copies : `public/cartes.js` pour les cartes,
 * `public/deck.html` pour le deck, `scripts/catalogue.mjs` et
 * `scripts/dossier.mjs` pour les deux documents générés. Chacune avec ses mots,
 * et deux d'entre elles avec le sens à l'envers.
 *
 * Ça ne s'est pas contenté de diverger, ça mentait. Trois exemples mesurés sur
 * le catalogue réel :
 *
 *   — `cartes.js` écrivait « Souffle +-15 % » pour `breathBonus: 0.85`. Le signe
 *     est calculé, le « + » est en dur devant, et les deux se retrouvent collés.
 *     **377 occurrences**, sur dix clés différentes : c'est la majorité des
 *     malus du jeu.
 *   — la même écrivait « Tempo plus tolérant (×0.9) » : le mot dit l'inverse du
 *     nombre, et c'est le mot qu'on lit.
 *   — elle écrivait « Martelage 0.5 s plus court » pour `mashTime: 500`, qui
 *     l'allonge. Dix-huit porteurs.
 *
 * Et le même effet ne portait pas le même nom : `costPenalty` s'appelait
 * « Chants plus chers » sur une carte, « Coût des cartes » sur le deck, « prix
 * des cartes » dans le dossier. Un joueur qui lit sa carte puis son deck croit
 * avoir deux effets.
 *
 * ## Le sens n'est pas déductible du signe
 *
 * C'est le piège de cette table, et c'est ce qui a fait diverger les copies.
 * Pour un facteur, « plus grand » est presque toujours un bonus ; pour un
 * décalage, il faut savoir de quoi on parle. Deux cas s'y trompent :
 *
 *   — **`tempoInterval` positif est un malus.** Il écarte les pulsations, donc
 *     le chant dure plus longtemps — moins de chants dans le match. Les
 *     Jumelles portent `tempoInterval: 70` et leur texte dit « tu vois venir le
 *     rythme, **mais tu chantes plus lentement** ». Le sifflet porte `-55` et
 *     dit « le contretemps **devient lisible** ». Ce sont les textes de
 *     `inventaire.js` qui tranchent, pas une lecture du moteur : celui-ci se
 *     contente d'additionner.
 *   — **`costPenalty` plus grand est un malus.** Son nom le dit, et c'est la
 *     seule clé dont le facteur s'inverse. Le dossier la colorait en vert.
 *
 * `mashTime` est dans les deux sens un vrai changement — plus court ou plus
 * long — et `gestures.js` précise que raccourcir « ne doit pas rendre le geste
 * plus facile, seulement plus court ». Le gain est donc du temps, pas de la
 * facilité : on le compte bonus quand il raccourcit, comme le tambour dont le
 * texte en fait sa qualité.
 *
 * ## Ce qu'il ne fait pas
 *
 * **Aucun calcul.** Il met des mots sur des valeurs déjà décidées ailleurs. Le
 * total appliqué par le moteur voyage à côté de la ventilation — voir
 * `src/shared/apports.js` — et si les deux divergeaient un jour, c'est le total
 * qui aurait raison.
 *
 * Il ne dépend de rien et ne charge rien : les deux écrans de jeu l'emploient,
 * et leur faire tirer les trente-huit kilo-octets de `cartes.js` pour une table
 * de seize lignes aurait été payer très cher un dictionnaire.
 */
(() => {
  /** Les clés qui se multiplient. Les autres s'additionnent. */
  const FACTEURS = new Set(['tempoWindow', 'mashBonus', 'holdBonus', 'perfectBonus',
    'parryBonus', 'parryResist', 'breathBonus', 'refundBonus', 'costPenalty',
    'pushMult', 'ferveurBonus', 'scarvesBonus']);

  /**
   * Dans quel sens va le bonus.
   *
   * `+1` : plus grand vaut mieux. `-1` : plus petit vaut mieux. Voir l'en-tête
   * pour les deux clés qui surprennent.
   */
  const SENS = {
    tempoWindow: +1, tempoInterval: -1, mashTime: -1, mashBonus: +1,
    holdBonus: +1, holdForgive: +1, perfectBonus: +1, parryBonus: +1,
    parryResist: +1, breathBonus: +1, refundBonus: +1, costPenalty: -1,
    pushMult: +1, ferveurBonus: +1, scarvesBonus: +1,
    // Le retour de flamme n'a pas de degré utile : présent, il punit le raté.
    backfire: -1,
  };

  const NOMS = {
    tempoWindow: 'Fenêtre de tempo', tempoInterval: 'Cadence',
    mashTime: 'Durée du martelage', mashBonus: 'Martelage',
    holdBonus: 'Endurance', holdForgive: 'Lâchers pardonnés',
    perfectBonus: 'Geste parfait', backfire: 'Retour de flamme',
    parryBonus: 'Contre', parryResist: 'Résistance au contre',
    breathBonus: 'Souffle', refundBonus: 'Reprise',
    costPenalty: 'Prix des chants', pushMult: 'Poussée',
    ferveurBonus: 'Ferveur', scarvesBonus: 'Écharpes',
  };

  /** Un pourcentage signé, avec le vrai signe moins de la typographie. */
  const pc = (v) => {
    const n = Math.round((v - 1) * 100);
    return `${n >= 0 ? '+' : '−'}${Math.abs(n)} %`;
  };

  /** Un nombre à la française : la virgule décimale, et pas de zéro inutile. */
  const nb = (v) => String(Math.round(v * 100) / 100).replace('.', ',');

  /**
   * Un modificateur, en une phrase.
   *
   * Rend `null` pour une valeur neutre — un facteur à 1, un décalage à 0, un
   * `backfire` éteint : une ligne « Souffle ±0 % » occupe de la place pour dire
   * qu'il ne se passe rien.
   */
  function phrase(cle, v) {
    if (v == null || v === false) return null;
    if (FACTEURS.has(cle)) {
      if (v === 1) return null;
      return `${NOMS[cle] ?? cle} ${pc(v)}`;
    }
    switch (cle) {
      case 'tempoInterval':
        if (!v) return null;
        return v > 0 ? `Cadence ralentie de ${nb(v)} ms`
          : `Cadence accélérée de ${nb(-v)} ms`;
      case 'mashTime':
        if (!v) return null;
        return v < 0 ? `Martelage ${nb(-v / 1000)} s plus court`
          : `Martelage ${nb(v / 1000)} s plus long`;
      case 'holdForgive': {
        if (!v) return null;
        /* Un compte, pas un facteur — et pourtant le catalogue en porte des
           valeurs décimales (1,07, 1,12…). On les écrit telles quelles plutôt
           que de les arrondir : un chiffre à virgule visible se fait corriger,
           un arrondi silencieux reste. */
        const n = Math.abs(v);
        const pluriel = n > 1 ? 's' : '';
        return v > 0 ? `${nb(n)} lâcher${pluriel} pardonné${pluriel}`
          : `${nb(n)} lâcher${pluriel} de moins pardonné${pluriel}`;
      }
      case 'backfire':
        return 'Geste raté : retour de flamme';
      default:
        // Une clé neuve dont personne n'a écrit la phrase. On l'affiche
        // brute plutôt que de la taire : `catalogue:test` la refusera, et un
        // joueur qui voit « wobbleGain 1.2 » signale un défaut que le silence
        // aurait gardé. Voir l'histoire de `parryResist` dans ETAT.md § 6.
        return `${NOMS[cle] ?? cle} ${nb(v)}`;
    }
  }

  /** Bonus, malus, ou ni l'un ni l'autre. */
  function sensDe(cle, v) {
    const s = SENS[cle];
    if (!s) return 'neutre';
    if (cle === 'backfire') return 'moins';
    const ecart = FACTEURS.has(cle) ? v - 1 : v;
    if (!ecart) return 'neutre';
    return Math.sign(ecart) === s ? 'plus' : 'moins';
  }

  /**
   * Tout ce que dit un jeu de modificateurs.
   *
   * @param {object} mods
   * @returns {Array<{cle:string, texte:string, sens:'plus'|'moins'|'neutre'}>}
   */
  function detail(mods) {
    const out = [];
    for (const [cle, v] of Object.entries(mods ?? {})) {
      const texte = phrase(cle, v);
      if (texte) out.push({ cle, texte, sens: sensDe(cle, v) });
    }
    return out;
  }

  /** Les mêmes phrases, en chaînes seules — ce que les cartes affichent. */
  const lignes = (mods) => detail(mods).map((d) => d.texte);

  /**
   * Le pictogramme de chaque effet, pour les écrans qui rangent en tuiles.
   *
   * Les traits vivent dans la page qui les dessine — ce fichier ne connaît que
   * le nom du trait. Un effet sans entrée prend `mod`, le neutre : c'est la
   * règle que `famDe` applique aux familles de cartes, et pour la même raison.
   */
  const ICONES = {
    tempoWindow: 'tempo', tempoInterval: 'tempo',
    mashTime: 'poing', mashBonus: 'poing',
    holdBonus: 'coeur', holdForgive: 'coeur',
    perfectBonus: 'etoile', backfire: 'alerte',
    parryBonus: 'bouclier', parryResist: 'bouclier',
    breathBonus: 'souffle', refundBonus: 'reprise',
    costPenalty: 'reprise', pushMult: 'poing',
    ferveurBonus: 'etoile', scarvesBonus: 'reprise',
  };

  /**
   * La valeur seule, sans son nom — pour un écran qui affiche les deux
   * séparément, en tuiles ou en colonnes.
   *
   * Elle porte quand même le sens quand le nombre ne suffit pas : « 0,6 s plus
   * court » et non « 0,6 s », parce que la fiche du Fanzzy montrait
   * « Durée du martelage · 0,5 s » sans dire si c'était un gain ou une perte.
   */
  function valeur(cle, v) {
    if (v == null || v === false) return null;
    if (FACTEURS.has(cle)) return v === 1 ? null : pc(v);
    switch (cle) {
      case 'tempoInterval':
        return v ? `${v > 0 ? '+' : '−'}${nb(Math.abs(v))} ms` : null;
      case 'mashTime':
        return v ? `${nb(Math.abs(v) / 1000)} s ${v < 0 ? 'plus court' : 'plus long'}` : null;
      case 'holdForgive':
        return v ? `${v > 0 ? '+' : '−'}${nb(Math.abs(v))}` : null;
      case 'backfire':
        return 'se retourne contre toi';
      default:
        return nb(v);
    }
  }

  /**
   * Nom, valeur, sens et pictogramme — la forme des tuiles.
   *
   * @returns {Array<{cle:string, nom:string, valeur:string, sens:string, icone:string}>}
   */
  function paires(mods) {
    const out = [];
    for (const [cle, v] of Object.entries(mods ?? {})) {
      const val = valeur(cle, v);
      if (val == null) continue;
      out.push({ cle, nom: NOMS[cle] ?? cle, valeur: val,
        sens: sensDe(cle, v), icone: ICONES[cle] ?? 'mod' });
    }
    return out;
  }

  /* --------------------------------------------- ce que je porte, à l'écran

     Le panneau des deux arènes. Il vit ici et non dans les pages parce qu'il y
     en a **deux**, et que le duel et le Grand Virage composent déjà les mêmes
     modificateurs : deux panneaux écrits séparément nommeraient les mêmes
     choses autrement, et le joueur apprendrait deux fois. C'est le même
     raisonnement que `src/shared/apports.js`, côté serveur, pour la
     ventilation qu'on affiche ici.

     La forme est « une ligne, et le détail au toucher » : pendant un match on
     n'a pas le temps de lire un tableau, et entre deux chants on veut savoir
     pourquoi la fenêtre est large. La ligne dit combien, le panneau dit quoi. */

  /** Le nom d'un KOP est choisi par des joueurs : il passe par là avant l'écran. */
  const esc = (s) => String(s ?? '').replace(/[<>&"]/g,
    (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

  /** D'où vient chaque apport, en un mot — l'ordre est celui d'`apportsDe`. */
  const SOURCES = { fanzzy: 'Ton Fanzzy', stuff: 'Ton sac', kop: 'Ton KOP', lieu: 'Le stade' };

  /**
   * Ce que dit la ligne repliée.
   *
   * @returns {{plus:number, moins:number, texte:string}} `texte` est vide quand
   *   il n'y a rien à dire — la page cache alors la ligne au lieu d'écrire
   *   « 0 bonus », qui occupe de la place pour annoncer une absence.
   */
  function resume(apports) {
    let plus = 0, moins = 0;
    for (const a of apports ?? []) {
      for (const d of detail(a.mods)) {
        if (d.sens === 'plus') plus += 1;
        else if (d.sens === 'moins') moins += 1;
      }
    }
    const bouts = [];
    if (plus) bouts.push(`${plus} bonus`);
    if (moins) bouts.push(`${moins} malus`);
    return { plus, moins, texte: bouts.join(' · ') };
  }

  /**
   * Le panneau déplié : une source par bloc, puis le total.
   *
   * @param {Array} apports la ventilation, telle que le serveur l'envoie.
   * @param {object} [total] `mods`, ce que le moteur applique vraiment.
   *
   * Le total est affiché **à part et en dernier**, et il n'est pas recalculé
   * depuis les blocs : la page pourrait les additionner, et elle le ferait mal
   * le jour où une règle de composition se nuance. Ici le total ne se discute
   * pas — c'est écrit noir sur blanc dans `virage.js`, qui envoie les deux
   * ensemble pour cette raison.
   */
  function panneauHTML(apports, total = null) {
    const blocs = [];
    for (const a of apports ?? []) {
      const d = detail(a.mods);
      if (!d.length) continue;
      blocs.push(`<div class="tbf-ap-bloc">
        <div class="tbf-ap-qui"><span class="tbf-ap-ou">${esc(SOURCES[a.quoi] ?? '')}</span>
          <b>${esc(a.nom ?? '')}</b></div>
        ${a.texte ? `<p class="tbf-ap-dit">${esc(a.texte)}</p>` : ''}
        <ul class="tbf-ap-liste">${d.map((x) =>
    `<li class="${x.sens}">${esc(x.texte)}</li>`).join('')}</ul>
      </div>`);
    }

    if (!blocs.length) {
      return '<p class="tbf-ap-vide">Rien ne modifie tes gestes en ce moment.</p>';
    }

    const t = detail(total);
    const cumul = t.length ? `<div class="tbf-ap-bloc tbf-ap-total">
      <div class="tbf-ap-qui"><span class="tbf-ap-ou">Au total</span>
        <b>ce que le serveur applique</b></div>
      <ul class="tbf-ap-liste">${t.map((x) =>
    `<li class="${x.sens}">${esc(x.texte)}</li>`).join('')}</ul>
    </div>` : '';

    return blocs.join('') + cumul;
  }

  window.TBF_MODS = { FACTEURS, ICONES, NOMS, SENS, SOURCES,
    detail, lignes, paires, panneauHTML, phrase, resume, sensDe, valeur, esc, pc, nb };
})();
