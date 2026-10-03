/**
 * La montée de niveau, annoncée au joueur.
 *
 * ## Ce qui existait, et ce qui manquait
 *
 * Tout le calcul était déjà là. `shared/niveau.js` porte la courbe, les
 * paliers, les écharpes de palier — et `paliersEntre` y est même commenté
 * « pour l'écran de montée ». Le serveur, lui, rend depuis toujours un objet
 * complet : `{ avant, niveau, monte, paliers, ecarpes }`.
 *
 * **Personne ne le regardait.** L'ouverture d'un booster le renvoyait à la
 * page, qui le jetait ; le duel ne prenait même pas la peine de le lire. Un
 * joueur montait donc de niveau sans rien voir, et découvrait un troisième
 * Fanzzy dans son deck des jours plus tard, s'il le remarquait.
 *
 * L'écran de montée manquait. C'est tout ce fichier.
 *
 * ## Une fête, pas une question
 *
 * `dialogue.js` dessine toujours deux boutons, parce qu'il sert à demander —
 * son en-tête le dit : « montrer ce qu'on va perdre ». Ici on n'a rien à
 * demander et rien à perdre : un seul bouton, et il ne sert qu'à reprendre la
 * main. C'est pour ça que ce panneau est écrit à part plutôt que tordu dans
 * l'autre.
 *
 * ## Pas de vidéo
 *
 * La rosette est un dessin en SVG, calculé ici. Une vidéo pèserait cent fois
 * ce que pèse ce fichier, au moment précis où l'écran doit s'ouvrir sans
 * attendre. Le jeu a déjà le vocabulaire qu'il faut — la bouffée de fumigène,
 * les confettis de papier, le chiffre qui compte — et s'en sert pour le but,
 * l'évolution et la cérémonie des raretés. Une fête de plus doit se
 * reconnaître comme une fête de cette maison.
 *
 * ## Le Fanzzy en pose victoire, et le chiffre qui compte
 *
 * (Lot 5 de la refonte FAIT MAIN, 2 octobre 2026.) La fête montrait une
 * rosette et un nombre. Elle montre maintenant **son** supporter, bras levés,
 * derrière la rosette — c'est lui qui monte, pas un compteur —, et le nombre
 * **compte** depuis le niveau d'avant : un chiffre qui saute se lit comme un
 * affichage, un chiffre qui avance se lit comme une montée. Les écharpes
 * comptent après lui. Sans dessin du personnage, la rosette seule, comme
 * avant ; sans mouvement, le chiffre final tout de suite.
 *
 * Le dessin est celui que le jeu sait déjà choisir (`FZART.dessinAvatar`,
 * sinon `TBF_ETATS.resoudre`) : l'expression « victoire », c'est-à-dire la
 * joie **si le joueur l'a gagnée** — on ne montre pas une joie qu'on n'a pas
 * —, et jamais un âge plus jeune que celui qu'il a payé. Aucun chemin d'image
 * n'est deviné ici : une page qui ne charge ni l'un ni l'autre a la rosette.
 *
 * ## Une case de BD, pas une boîte de luxe
 *
 * (Correction des lots 3 et 5, 3 octobre 2026.) La fête était restée dans
 * l'ancien langage « premium » : une boîte en dégradé radial doré avec halo,
 * des coins arrondis, un chiffre en or avec une lueur de vingt-six pixels,
 * une rosette en ombre portée lumineuse, les gains dans des pilules sombres,
 * « TU MONTES » en onze pixels espacés et un bouton en dégradé brillant.
 * Rien du FAIT MAIN, alors qu'elle suit souvent le butin du kiosque et la
 * cérémonie d'achat, qui en sont faits. Elle est maintenant **la case de BD
 * du moment fort** (`.tbf-vignette`, variante or) posée sur le fond : le
 * Fanzzy en pose victoire dans la case, « NIVEAU 5 » au lettrage de la case
 * (la craie et son ombre dure), « TU MONTES » en sticker flare, le gain en
 * sticker de prix avec son jeton (le « +50 » compte), ce que le palier ouvre
 * en stickers craie dont le cadenas saute, le prochain palier en sticker de
 * promesse (cerné d'or), la bouffée derrière la case, les confettis de
 * papier dans la scène, et CONTINUER en bâche or. Plus un dégradé, plus une
 * lueur, plus un arrondi : ce sont les briques de `ui.css`, telles quelles.
 *
 * Les classes que les suites lisent restent : `.tbf-niv-fond`,
 * `.tbf-niv-n b` (le chiffre), `[data-fermer]`, le rôle `alertdialog`.
 *
 * ## « Depuis ta dernière visite »
 *
 * Une montée n'était fêtée que là où le serveur la renvoie — l'ouverture d'un
 * booster, la fin d'un duel. Celle qu'apporte une mission réclamée sur
 * l'accueil, ou une partie jouée sur un autre téléphone, passait sans fête.
 * `depuisVisite` la rattrape : le profil et le Virage lui passent le niveau
 * qu'ils lisent, elle le compare au dernier niveau vu sur cet appareil
 * (mémoire locale, signée du joueur) et fête l'écart. **Toute fête, d'où
 * qu'elle vienne, inscrit le niveau qu'elle annonce** : une montée fêtée au
 * kiosque n'est pas refêtée au profil.
 *
 * ## Ce qu'elle a le droit de dire
 *
 * Le niveau **ouvre**, il ne donne pas. La règle est écrite dans
 * `shared/niveau.js` et elle tient tout le reste : un joueur de niveau 30 n'a
 * pas un gramme d'avance sur la corde. L'écran annonce donc des **capacités**
 * — un club de plus à suivre, un Fanzzy de plus au deck — et les écharpes à
 * part, parce qu'elles sont la seule chose qui tombe vraiment dans la poche.
 * Rien ici ne doit se lire comme « tu es plus fort ».
 */
(() => {
  if (window.TBF_NIVEAU) return;

  const ECH = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ECH[c]);

  /* Le joueur a demandé moins de mouvement — à son système, ou dans le mode
     calme du tiroir. Lu à chaque fête, jamais retenu : un réglage changé
     dans le menu vaut pour la prochaine. L'attribut est posé par fx.js et
     par menu.js ; il est lu ici directement, « FX » pouvant arriver tard. */
  const doux = () => (typeof matchMedia === 'function'
      && matchMedia('(prefers-reduced-motion: reduce)').matches)
    || (document.documentElement.dataset.calme ?? '').split(' ').includes('animations');

  /**
   * Ce qu'un palier ouvre, en français.
   *
   * **Le serveur envoie la donnée, la page écrit la phrase.** C'est la règle du
   * module de niveau, et elle a une raison : une page qui porterait sa propre
   * copie de la table des paliers promettrait un jour un déblocage que le
   * serveur refuse. Ici on ne fait que nommer ce qu'on reçoit.
   *
   * Les nombres sont des **totaux**, pas des incréments : `slots: 3` veut dire
   * « trois emplacements en tout », pas « trois de plus ». La phrase le dit
   * dans ces mots-là, sans quoi un joueur compterait six clubs et n'en
   * trouverait que trois.
   */
  function nommer(p) {
    const out = [];
    if (p?.deckFanzzy) {
      out.push({ quoi: 'UN FANZZY DE PLUS AU DECK',
        sous: `${p.deckFanzzy} dans ta tribune, désormais` });
    }
    if (p?.slots) {
      out.push({ quoi: 'UN CLUB DE PLUS À SUIVRE',
        sous: `${p.slots} emplacements en tout` });
    }
    return out;
  }

  /* Les paliers du chemin qui ouvrent quelque chose — ceux de `/api/niveau`,
     `{ niveau, slots, deckFanzzy, echarpes }`, où un palier qui n'ouvre rien
     porte des `null`. */
  const ouvrants = (chemin) => (Array.isArray(chemin) ? chemin : [])
    .filter((p) => Number(p?.niveau) > 0 && (p.slots || p.deckFanzzy));

  /** Les paliers franchis entre deux niveaux, lus sur le chemin du serveur. */
  const franchis = (chemin, avant, apres) => ouvrants(chemin)
    .filter((p) => Number(p.niveau) > avant && Number(p.niveau) <= apres);

  /**
   * Le prochain palier qui ouvre quelque chose, en une ligne : « PROCHAIN :
   * NIV. 9 → 4 CLUBS À SUIVRE ». Seulement quand la page a le chemin du
   * serveur (`/api/niveau`, champ `paliers`) : sans lui, la ligne n'existe
   * pas — elle ne s'invente pas d'une table recopiée. Les nombres sont des
   * totaux, comme dans `nommer`.
   */
  function prochain(chemin, niveau) {
    const p = ouvrants(chemin).filter((x) => Number(x.niveau) > niveau)
      .sort((a, b) => a.niveau - b.niveau)[0];
    if (!p) return null;
    return { niveau: Number(p.niveau),
      quoi: p.deckFanzzy ? `${p.deckFanzzy} FANZZY AU DECK` : `${p.slots} CLUBS À SUIVRE` };
  }

  /* La rosette. Un ruban et une étoile, dessinés — voir l'en-tête pour
     pourquoi ce n'est pas une image. `currentColor` partout : il n'y a
     qu'un endroit où changer la couleur. **Elle s'appelle « cocarde » dans
     la page** : la classe d'avant (`.tbf-niv-rosette`) porte encore dans
     `ui.css` une lueur dorée et un tour sans fin, que la case n'a plus. */
  const ROSETTE = `<svg class="tbf-niv-cocarde" viewBox="0 0 64 64" aria-hidden="true">
    <g fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round">
      <path d="M24 38 L18 60 L32 53 L46 60 L40 38"/>
      <circle cx="32" cy="24" r="19"/>
      <circle cx="32" cy="24" r="13.5" stroke-opacity=".5"/>
      <path d="M32 13 l3.2 6.9 7.5.9 -5.6 5.2 1.5 7.5 -6.6-3.8 -6.6 3.8 1.5-7.5 -5.6-5.2 7.5-.9z"
            fill="currentColor" stroke="none"/>
    </g>
  </svg>`;

  /* Le cadenas ouvert, au trait, dans un sticker de ce que le palier ouvre :
     l'anse levée d'un côté. La brique du sticker lui donne sa taille et son
     trait (quatorze pixels, l'encre du sticker). */
  const CADENAS = `<svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="5" y="11" width="14" height="10" rx="1.5"/><path d="M8.5 11V7.5a3.5 3.5 0 0 1 6.6-1.6"/>
    <path d="M12 15v2"/></svg>`;

  /* ------------------------------------------------- la feuille de la case

     **Provisoire, et seulement la place.** La fête est faite des briques de
     ui.css (la case .tbf-vignette en or, son lettrage, les stickers, la
     bâche, la bouffée) ; cette feuille ne dit que leur place dans la case —
     la colonne, les marges, les corps — et le repli de la scène quand
     l'écran est court. Sa place à elle est dans ui.css, section « la montée
     de niveau », où elle remplacera la boîte « premium » d'avant (dégradés,
     lueurs, arrondis, pilules) : c'est un besoin écrit pour la feuille
     commune. Posée ici en attendant, pour que la fête soit juste dès
     aujourd'hui sur toutes les pages qui la chargent, sous le préfixe de la
     fête pour ne rien toucher d'autre.

     Deux règles seulement ne sont pas une place : la teinte de la cocarde
     (un dessin propre à la fête, pas une brique), et la neutralisation de
     la règle dorée qui vise encore le chiffre dans ui.css (.tbf-niv-n b :
     or, lueur de vingt-six pixels, autre corps) — le chiffre prend le
     lettrage de la case, et la suite du kiosque lit toujours .tbf-niv-n b.
     Aucune animation ici : les entrées sont jouées par le script, qui ne
     les joue pas sans mouvement, et celles des briques (.tbf-colle, la
     bouffée) ont leurs doubles dans ui.css. */
  const FEUILLE = `
  /* La case : une colonne, jamais plus haute que l'écran. Quand il est
     court, la scène cède sa hauteur la première, puis le corps défile ; le
     bouton reste toujours au bas de la case, sous le doigt. */
  .tbf-niv-case{display:flex;flex-direction:column;align-items:center;
    width:min(400px,100%);max-height:calc(100vh - 40px);max-height:calc(100dvh - 40px);
    padding:16px 16px 14px;color:var(--craie)}
  .tbf-niv-case>.tbf-niv-scene{align-self:stretch;flex:0 1000 auto;min-height:0}
  .tbf-niv-corps{align-self:stretch;flex:0 1 auto;min-height:0;overflow:hidden auto;
    margin:0 -10px;padding:8px 10px 10px;display:flex;flex-direction:column;align-items:center}
  .tbf-niv-case>.tbf-plaque{flex:none;margin-top:12px}
  /* Le lettrage de la case porte « NIVEAU 5 » : son corps, et le chiffre
     qui en prend tout le reste. */
  .tbf-niv-case .tbf-niv-n{display:block;margin:10px 0 0;font-size:clamp(36px,13vw,52px)}
  .tbf-niv-case .tbf-niv-n b{font:inherit;color:inherit;text-shadow:inherit;letter-spacing:inherit}
  .tbf-niv-case .tbf-niv-de{margin-top:8px;font-size:12px}
  /* Le butin et ce que le palier ouvre : des stickers en colonne, chacun à
     sa largeur, avec l'air qu'il leur faut autour (cinq pixels). */
  .tbf-niv-butin{display:flex;flex-direction:column;align-items:center;gap:12px;margin-top:16px}
  .tbf-niv-libelle{font-family:var(--banner);font-size:12px;letter-spacing:.08em;text-transform:uppercase}
  .tbf-niv-cles{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;
    align-items:center;gap:12px}
  .tbf-niv-cles small{display:block;margin-top:7px;font-size:12px}
  .tbf-niv-case .tbf-niv-rien{margin:0;padding:0;font-size:12px;line-height:1.5}
  .tbf-niv-promesse{margin-top:16px;display:flex;flex-direction:column;align-items:center;gap:8px}
  /* La cocarde : un dessin à plat, sans lueur ni tour sans fin. Seule, au
     milieu de la scène ; avec le Fanzzy, épinglée sur le côté, sans cacher
     ni le visage ni les mains. */
  .tbf-niv-cocarde{display:block;width:58px;height:58px;color:var(--projo)}
  .tbf-niv-scene--perso .tbf-niv-cocarde{position:absolute;z-index:2;left:calc(50% + 30px);
    bottom:8px;width:52px;height:52px}`;

  function poserFeuille() {
    if (document.getElementById('tbf-niv-feuille')) return;
    const s = document.createElement('style');
    s.id = 'tbf-niv-feuille';
    s.textContent = FEUILLE;
    document.head.appendChild(s);
  }

  /**
   * Le Fanzzy du joueur en pose victoire, ou `null`.
   *
   * `FZART.dessinAvatar` sait tout ce qu'il faut : l'expression demandée si
   * elle est dessinée et gagnée, sinon le repos, l'âge exact ou le plein-pied
   * de cet âge, la tenue. Sans lui, `TBF_ETATS.resoudre` avec la même règle de
   * l'âge exact. Sans l'un ni l'autre, rien : la rosette seule.
   */
  function dessinVictoire(av) {
    if (!av?.id) return null;
    const avatar = { ...av, id: String(av.id), evo: Number(av.evo) || 1, skin: av.skin || 'base' };
    try {
      if (typeof window.FZART?.dessinAvatar === 'function') {
        return window.FZART.dessinAvatar(avatar, 'plein', { etat: 'victoire' }) ?? null;
      }
      const E = window.TBF_ETATS;
      if (E?.pret?.()) {
        const r = E.resoudre(avatar.id, { evo: avatar.evo, skin: avatar.skin, etat: 'victoire' });
        if (r?.src && r.evo === avatar.evo) return r.src;
      }
    } catch { /* un dessin introuvable ne doit pas empêcher la fête */ }
    return null;
  }

  /* --------------------------------------------- la mémoire du niveau vu

     **Signée du joueur**, comme tout ce que le jeu retient sur l'appareil :
     deux comptes sur le même téléphone ne partagent pas leur dernier niveau
     vu, sans quoi passer du compte de niveau 10 à celui de niveau 3, puis
     revenir, fêterait une montée qui n'a pas eu lieu. Quatre joueurs au plus
     — le plus ancien sort —, et dans un `try` : un stockage fermé
     (navigation privée) ne fête rien, il ne casse rien non plus. */
  const CLE_VU = 'tbf-niveau-vu';
  const lireVus = () => {
    try {
      const o = JSON.parse(localStorage.getItem(CLE_VU) || 'null');
      return o && typeof o === 'object' && !Array.isArray(o) ? o : {};
    } catch { return {}; }
  };
  const lireVu = (qui) => {
    const v = Number(lireVus()[qui]);
    return Number.isInteger(v) && v > 0 ? v : null;
  };
  function retenirVu(qui, n) {
    const o = lireVus();
    delete o[qui];
    o[qui] = n;
    const cles = Object.keys(o);
    while (cles.length > 4) delete o[cles.shift()];
    try { localStorage.setItem(CLE_VU, JSON.stringify(o)); } catch { /* vaut pour rien */ }
  }

  /* « Qui es-tu ? », par la promesse que `nav.js` pose sur chaque page
     (`window.TBF_MOI`) : la même question n'est jamais posée deux fois. Si
     la page ne l'a pas encore posée, on la pose ici, sous la même forme
     exacte, et `nav.js` reprendra la nôtre. */
  const moi = () => (window.TBF_MOI ??= fetch('/api/auth/me', { credentials: 'same-origin' })
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => j?.user ?? null)
    .catch(() => null));
  async function quiEst(qui) {
    if (qui != null && qui !== '') return String(qui);
    try {
      const u = await moi();
      return u?.id != null ? String(u.id) : null;
    } catch { return null; }
  }
  const retenirPourQui = (n, qui) => {
    quiEst(qui).then((q) => { if (q) retenirVu(q, n); });
  };

  /* --------------------------------------------------------------- la fête */

  let ouverte = null;   // la fête affichée, tant qu'elle l'est
  let fetee = 0;        // le plus haut niveau fêté depuis l'arrivée sur la page

  /**
   * Annonce une montée.
   *
   * **Une fête à la fois, et jamais deux fois la même.** Une seconde montée
   * qui arrive pendant la première attend qu'on l'ait refermée ; une montée
   * déjà fêtée sur cette page (même niveau ou plus bas) ne rouvre rien — un
   * écran redessiné, un événement reçu deux fois ne font pas deux fêtes.
   *
   * @param {object} m  ce que rend `niveau.gagner()` côté serveur :
   *   `{ avant, niveau, monte, paliers, ecarpes }`, ou l'objet `niveau` du
   *   contrat des résultats (mêmes champs, et d'autres que la fête ignore).
   * @param {object} [o]
   * @param {object|null} [o.avatar]  le Fanzzy à montrer (`{ id, evo, skin,
   *   age }`, la forme de l'avatar du serveur). Absent : celui de l'état de
   *   la page (`TBF_CARTES.S.avatar`, sur le kiosque et le classeur) ;
   *   `null` : la rosette seule.
   * @param {Array} [o.chemin]  les paliers de `/api/niveau` : la ligne du
   *   prochain palier s'en déduit. Absent : pas de ligne.
   * @param {string} [o.qui]  l'identifiant du joueur, s'il est connu : la
   *   mémoire du niveau vu en est signée. Absent : `window.TBF_MOI`.
   * @returns {Promise<void>} résolue quand le joueur a repris la main. Une
   *   montée absente résout tout de suite : l'appelant n'a donc jamais à
   *   se demander s'il doit appeler — il appelle, et il attend.
   */
  function feter(m, o = {}) {
    if (!m?.monte) return Promise.resolve();
    const n = Number(m.niveau);
    if (!Number.isInteger(n) || n < 1) return Promise.resolve();
    if (ouverte) return ouverte.then(() => feter(m, o));
    if (n <= fetee) return Promise.resolve();
    fetee = n;
    retenirPourQui(n, o?.qui);
    ouverte = ouvrir(m, o ?? {});
    ouverte.then(() => { ouverte = null; });
    return ouverte;
  }

  function ouvrir(m, o) {
    poserFeuille();
    const n = Number(m.niveau);
    const avant = Number(m.avant);
    const paliers = (m.paliers ?? []).flatMap(nommer);
    const ecarpes = Number(m.ecarpes ?? 0);
    /* Plus d'un niveau d'un coup, ça arrive : une grosse victoire après une
       série de boosters. On le dit plutôt que d'afficher le dernier tout seul,
       sans quoi le joueur croit en avoir manqué un. */
    const bonds = Math.max(1, n - (Number.isFinite(avant) ? avant : n));
    const proch = prochain(o.chemin, n);
    const src = dessinVictoire(o.avatar !== undefined ? o.avatar : window.TBF_CARTES?.S?.avatar);
    const sans = doux();
    const quoi = bonds > 1 ? `${bonds} NIVEAUX D’UN COUP` : 'TU MONTES !';
    // Ce qu'un lecteur d'écran annonce : le chiffre final, pas celui qui compte.
    const nomDeLaFete = `${bonds > 1 ? `${bonds} niveaux d’un coup` : 'Tu montes'} : niveau ${n}`;

    /* Les stickers se collent l'un après l'autre (.tbf-colle et son délai,
       la brique du lot 1), dans l'ordre où on les lit : le titre, le gain,
       puis ce que le palier ouvre. Sans mouvement, ils sont déjà là. */
    const colle = (ms) => (sans ? '' : ` tbf-colle" style="--d:${ms}ms`);
    const ouvre = paliers.length
      ? `<div class="tbf-niv-libelle">ÇA T’OUVRE</div>
         <ul class="tbf-niv-cles">${paliers.map((p, k) => `<li>
           <span class="tbf-sticker${colle(900 + k * 160)}">${CADENAS}${esc(p.quoi)}</span>
           <small>${esc(p.sous)}</small></li>`).join('')}</ul>`
      /* Un palier sur cinq ouvre quelque chose. Les autres montées ne
         doivent pas se terminer sur un blanc : elles rapportent des
         écharpes, et c'est déjà une raison de sourire. Quand la page a
         donné le chemin, le prochain palier dit mieux la même chose : il
         nomme ce qui vient. */
      : (proch ? '' : `<div class="tbf-niv-rien">Ce palier n’ouvre rien de neuf —
           le prochain, si.</div>`);
    /* Le gain : le sticker de prix et son jeton, craie (un gain, pas un
       achat), avec son signe. Son chiffre compte depuis zéro. */
    const butin = (ecarpes
      ? `<span class="tbf-sticker tbf-sticker--prix tbf-niv-ech${colle(620)}"><img
           src="/img/gains/echarpes.webp" alt="" decoding="async"><b>+${esc(ecarpes)}</b> ÉCHARPES</span>`
      : '') + ouvre;

    const fond = document.createElement('div');
    fond.className = 'tbf-niv-fond';
    /* La bouffée de fumigène (la brique de ui.css) gonfle **derrière la
       case**, sur le fond, et se dissipe — comme celle du moment fort ; la
       feuille commune la retire d'elle-même sans mouvement, et elle n'est
       même pas posée ici dans ce cas. En ellipse, par sa largeur et sa
       hauteur (sa place, que la page a le droit d'écrire) : elle déborde de
       la case de chaque côté sans couvrir l'écran entier. La case vient
       après elle et se peint devant. */
    fond.innerHTML = `
      ${sans ? '' : `<i class="tbf-bouffee" aria-hidden="true" style="--x:50%;--y:40%;
        width:min(150vw,620px);height:min(110vw,440px);--c1:var(--projo);--c2:var(--flare)"></i>`}
      <div class="tbf-vignette tbf-niv-case" data-ton="or" role="alertdialog" aria-modal="true"
           aria-label="${esc(nomDeLaFete)}">
        <div class="tbf-niv-scene${src ? ' tbf-niv-scene--perso' : ''}" aria-hidden="true">
          ${src ? `<img class="tbf-niv-perso" alt="" decoding="async" src="${esc(src)}">` : ''}
          ${ROSETTE}
        </div>
        <div class="tbf-niv-corps">
          <span class="tbf-sticker${colle(200)}" data-ton="flare">${esc(quoi)}</span>
          <h2 class="tbf-vignette-mot tbf-niv-n" id="tbf-niv-t">NIVEAU <b>${esc(n)}</b></h2>
          ${bonds > 1 ? `<div class="tbf-niv-de">tu étais au niveau ${esc(m.avant)}</div>` : ''}
          ${butin ? `<div class="tbf-niv-butin">${butin}</div>` : ''}
          ${proch ? `<div class="tbf-niv-promesse"><div class="tbf-niv-libelle">PROCHAIN PALIER</div>
            <span class="tbf-sticker tbf-sticker--jalon">NIV. ${esc(proch.niveau)} →
              ${esc(proch.quoi)}</span></div>` : ''}
        </div>
        <button type="button" class="tbf-plaque tbf-bloc" data-ton="or" data-fermer>CONTINUER</button>
      </div>`;

    document.body.appendChild(fond);

    const F = window.FX;
    const minuteries = [];
    const kase = fond.querySelector('.tbf-niv-case');
    const scene = fond.querySelector('.tbf-niv-scene');
    const rosette = scene.querySelector('.tbf-niv-cocarde');
    const nombre = fond.querySelector('.tbf-niv-n b');
    const somme = fond.querySelector('.tbf-niv-ech b');
    /* .tbf-colle se retire à la fin de son entrée, comme le veut la brique :
       un sticker qui vibrera ensuite (le chiffre qui change) ne doit pas
       rejouer son collage. */
    fond.addEventListener('animationend', (e) => {
      if (e.animationName === 'tbf-colle') e.target.classList.remove('tbf-colle');
    });

    /* Le personnage n'entre qu'une fois son dessin décodé : une entrée jouée
       sur une image encore vide ne montrerait rien, puis un saut. Le format
       moderne peut manquer là où le PNG existe : un essai par `secours`,
       puis la rosette seule — la scène se replie, le reste ne bouge pas. */
    const perso = scene.querySelector('.tbf-niv-perso');
    if (perso) {
      perso.style.opacity = '0';
      const montrer = () => {
        perso.style.opacity = '';
        if (doux()) return;
        try {
          perso.animate([{ translate: '0 46px', opacity: 0 }, { translate: '0 0', opacity: 1 }],
            { duration: 460, easing: 'cubic-bezier(.2,1.25,.35,1)' });
        } catch { /* sans animations de script : il est là, c'est l'essentiel */ }
      };
      const rater = () => {
        const repli = perso.dataset.repli ? null
          : (window.TBF_ETATS?.secours?.(perso.src) ?? window.FZART?.secours?.(perso.src) ?? null);
        if (repli) {
          perso.dataset.repli = '1';
          perso.src = repli;
          perso.decode().then(montrer, rater);
          return;
        }
        scene.classList.remove('tbf-niv-scene--perso');
        perso.remove();
      };
      perso.decode().then(montrer, rater);
    }

    /* **Le chiffre qui compte.** Le panneau porte la valeur finale dès qu'il
       est posé : sans `FX`, sans mouvement ou dans un onglet caché, c'est
       elle qu'on lit, et un lecteur d'écran aussi. À la première image —
       avant que rien ne soit peint —, le niveau d'avant prend sa place, et
       le compte part quand le panneau a fini d'arriver. Les écharpes
       comptent après lui : deux chiffres qui bougent ensemble ne se lisent
       ni l'un ni l'autre. */
    const compte = !sans && !document.hidden && typeof F?.compter === 'function';
    requestAnimationFrame(() => {
      fond.classList.add('on');
      if (compte && Number.isFinite(avant) && avant >= 1 && avant < n) {
        nombre.textContent = String(avant);
        minuteries.push(setTimeout(() => F.compter(nombre, avant, n, { ms: 650 }), 320));
      }
      if (compte && somme && ecarpes > 0) {
        somme.textContent = '+0';
        minuteries.push(setTimeout(() => F.compter(somme, 0, ecarpes,
          { ms: 700, format: (v) => `+${Math.round(v)}` }), 760));
      }
      if (sans) return;
      /* La case tombe et se cale, comme celle du moment fort : la propriété
         « scale » se compose avec son inclinaison de repos (−1,6°) sans
         l'écraser, et l'animation finit où la case se tient. */
      try {
        kase.animate([{ opacity: 0, scale: '.6' }, { opacity: 1, scale: '1.06', offset: 0.6 },
          { opacity: 1, scale: '1' }],
        { duration: 420, easing: 'cubic-bezier(.2,1.3,.35,1)', fill: 'backwards' });
      } catch { /* sans animations de script : elle est là */ }
      /* La rosette se serre d'un coup, avec un rebond — le nœud de plus sur
         l'écharpe, dit la direction —, puis se tient immobile : elle ne
         tourne plus sans fin. */
      try {
        rosette.animate([{ scale: '0' }, { scale: '1.18', offset: 0.6 }, { scale: '1' }],
          { duration: 440, delay: 160, easing: 'cubic-bezier(.2,1.3,.35,1)', fill: 'backwards' });
      } catch { /* elle est là, sans rebond */ }
      /* **Le cadenas saute** quand son sticker est collé : ce que le palier
         ouvre s'ouvre sous les yeux. Il monte, bascule et retombe ouvert. */
      fond.querySelectorAll('.tbf-niv-cles svg').forEach((cadenas, k) => {
        try {
          cadenas.animate([{ translate: '0 0', rotate: '0deg' },
            { translate: '0 -6px', rotate: '-16deg', offset: 0.45 }, { translate: '0 0', rotate: '0deg' }],
          { duration: 420, delay: 1180 + k * 160, easing: 'cubic-bezier(.3,1.4,.4,1)' });
        } catch { /* il est ouvert, sans sauter */ }
      });
      /* Les confettis de papier jaillissent de la scène et y restent : elle
         les rogne, ils ne passent jamais sur ce qu'on lit. */
      minuteries.push(setTimeout(() => F?.particules?.({
        x: scene.clientWidth / 2, y: scene.clientHeight * 0.42, n: 26, papier: true,
        distance: 120, duree: 1000, dans: scene,
        couleurs: [F.couleurs?.craie ?? '#F2EEE4', '#E4D3B5', F.couleurs?.or ?? '#F5C33B'] }), 200));
      // La bouffée a fini en 840 ms : on la retire, comme le dit sa brique.
      minuteries.push(setTimeout(() => fond.querySelector('.tbf-bouffee')?.remove(), 1000));
    });

    /* Le son et la vibration. Le flash, l'onde et la secousse qu'on lançait
       ici jouaient **sous** le fond de la fête, opaque à 94 % (ui.css) : on
       ne les voyait pas, et la secousse faisait trembler une page cachée.
       La fête se joue maintenant dans sa case — la bouffée, les
       confettis, le personnage, le chiffre. Le son passe par FX.son, donc
       par le moteur commun (son.js) : il obéit au mode calme et au volume du
       joueur, et il est mixé avec les autres moments. C'est le sien,
       « niveau » — une montée, puis un accord qui se pose et la tribune qui
       applaudit —, et non plus la corne de but : on fêtait un niveau gagné
       au kiosque avec le klaxon d'un but. La vibration passe hors de fx.js : elle obéit
       donc elle-même au mode calme, lu sur l'attribut que posent fx.js et
       menu.js plutôt que par « FX.calme », qui peut manquer sur une page où
       fx.js arrive tard.

       Et elle attend que la page ait été touchée : la fête que `depuisVisite`
       ouvre au chargement du profil arrive avant tout geste, et Chrome refuse
       alors la vibration en l'écrivant en erreur dans la console. Elle ne se
       serait pas sentie. Sans l'API qui le dit, on essaie, comme avant. */
    F?.son?.('niveau');
    const sansVibrer = (document.documentElement.dataset.calme ?? '')
      .split(' ').includes('vibrations')
      || navigator.userActivation?.hasBeenActive === false;
    if (!sansVibrer) {
      try { navigator.vibrate?.([30, 50, 30, 50, 110]); } catch { /* pas de moteur */ }
    }

    return new Promise((resoudre) => {
      const avantFocus = document.activeElement;
      let fini = false;
      const fermer = () => {
        if (fini) return;
        fini = true;
        minuteries.forEach(clearTimeout);
        document.removeEventListener('keydown', touche, true);
        fond.classList.remove('on');
        // On laisse la sortie se jouer : retirer d'un coup se lit comme un bug.
        setTimeout(() => fond.remove(), 200);
        try { avantFocus?.focus?.({ preventScroll: true }); } catch { /* parti */ }
        resoudre();
      };
      /* Échap et le fond ferment, comme partout ailleurs dans le jeu. Il n'y a
         qu'une seule cible tabulable, donc pas de piège à focus à tendre : la
         tabulation tourne toute seule sur le bouton. */
      const touche = (e) => {
        if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); fermer(); }
      };
      document.addEventListener('keydown', touche, true);
      fond.addEventListener('mousedown', (e) => { if (e.target === fond) fermer(); });
      fond.querySelector('[data-fermer]').addEventListener('click', fermer);
      setTimeout(() => {
        try { fond.querySelector('[data-fermer]').focus({ preventScroll: true }); }
        catch { /* tant pis */ }
      }, 60);
    });
  }

  /* ------------------------------------- le niveau a monté depuis la visite */

  /* Le manifeste des dessins, s'il est en route : la pose victoire en dépend.
     Une seconde un quart au plus — la fête ne se fait pas attendre pour un
     dessin, elle part avec la rosette. */
  async function dessinPret() {
    const E = window.TBF_ETATS;
    if (typeof E?.charger !== 'function' || E.pret?.()) return;
    await Promise.race([E.charger(), new Promise((r) => setTimeout(r, 1250))]);
  }

  /* Une ligne en base : l'XP du joueur, et le chemin des paliers. Seulement
     pour une page qui ne l'a pas déjà lue, et jamais pour un visiteur. */
  const lireNiveau = () => fetch('/api/niveau', { credentials: 'same-origin' })
    .then((r) => (r.ok ? r.json() : null)).catch(() => null);

  let reservee = 0;     // le niveau qu'un appel en cours s'apprête à fêter

  /**
   * Fête le niveau gagné depuis la dernière visite, s'il a monté.
   *
   * La première fois sur cet appareil, il n'y a rien à comparer : le niveau
   * est retenu, sans fête. Ensuite, un niveau plus haut que le dernier vu
   * ouvre la fête (« TU MONTES », ou « 3 NIVEAUX D’UN COUP »), avec ce que les
   * paliers franchis ouvrent et ce que le prochain ouvrira ; un niveau égal
   * ou plus bas est retenu, sans fête. Les écharpes des paliers ne s'y
   * disent pas : elles sont déjà dans le solde, et la page n'a pas de quoi
   * les compter (aucun chiffre partiel).
   *
   * @param {object|null} [niv]  la réponse de `/api/niveau` que la page a
   *   déjà lue (`niveau`, `paliers`, `indisponible`). Absente : elle est lue
   *   ici, une fois. Une progression `indisponible` (schéma incomplet côté
   *   serveur) ne fête rien et n'est pas retenue.
   * @param {object} [o]
   * @param {object|null} [o.avatar]  le Fanzzy à montrer (voir `feter`)
   * @param {string} [o.qui]  l'identifiant du joueur, s'il est connu
   * @returns {Promise<boolean>} `true` une fois la fête refermée, `false`
   *   s'il n'y avait rien à fêter (ou personne de connecté)
   */
  async function depuisVisite(niv, o = {}) {
    const opt = o ?? {};
    const qui = await quiEst(opt.qui);
    if (!qui) return false;
    const lu = niv ?? await lireNiveau();
    const n = Number(lu?.niveau);
    if (!Number.isInteger(n) || n < 1 || lu?.indisponible) return false;
    /* Lire, retenir et réserver sans rien attendre entre les trois : deux
       appels lancés ensemble — un écran qui se rend deux fois — ne fêtent
       qu'une fois. */
    const vu = lireVu(qui);
    retenirVu(qui, n);
    if (vu === null || n <= vu || n <= reservee || n <= fetee) return false;
    reservee = n;
    await dessinPret();
    await feter({ monte: true, avant: vu, niveau: n, paliers: franchis(lu.paliers, vu, n) },
      { avatar: opt.avatar, chemin: lu.paliers, qui });
    return true;
  }

  window.TBF_NIVEAU = { feter, nommer, depuisVisite };
})();
