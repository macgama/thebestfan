/**
 * La fiche d'un Fanzzy : ce qu'il est, ce qu'il devient, ce qu'il porte.
 *
 * ## Pourquoi elle vit ici et non dans une page
 *
 * Il y avait **deux fiches** pour la même carte : un aperçu en surimpression
 * dans le classeur, et une page complète ailleurs. Deux rendus, deux
 * vocabulaires, et déjà deux contenus différents. Il n'y en a plus qu'une,
 * montée à deux endroits : **en panneau** par-dessus le classeur — la grille
 * reste derrière, la croix referme, rien ne recharge — et **en page** quand
 * on arrive par un lien.
 *
 * ## La carte en main (lot 4)
 *
 * Le personnage n'est plus un décor dans un cadre : c'est **la carte du jeu**
 * (`cardHTML`, cartes.js), celle du classeur et des boosters, tenue en main —
 * elle s'incline au doigt, prend la lumière, se retourne. Dessous, la bande
 * du cri ; puis l'inventaire en quatre rangées (ÂGES en arbre sur une corde,
 * EFFETS, ÉTATS, TENUES) ; puis la fiche kraft de la pièce qu'on touche ; et
 * les actions, hiérarchisées, toujours au même endroit. Le budget de hauteur
 * est écrit en tête de `fanzzy-fiche.css`.
 *
 * Toucher un âge, une tenue ou une expression **compose** l'apparence : la
 * carte la montre tout de suite, et un seul geste l'enregistre (ME MONTRER
 * AINSI). C'est l'écran où l'on décide de quoi on a l'air ; il doit se
 * regarder avant de se valider.
 *
 * ## Évoluer se confirme, puis se fête
 *
 * Quatre-vingt-dix écharpes, c'est neuf boosters : la fiche montre ce qu'on
 * gagne avant de les prendre. Puis la cérémonie (`FX.evolution`), le tampon
 * de l'âge qui claque sur la carte, le ticket de la dépense et le solde qui
 * décompte (`FX.compter`).
 *
 * ## Les crochets des suites
 *
 * `fanzzy-ui-smoke` lit cette fiche par des noms qui ne sont plus ceux de
 * son dessin : `.case` (avec `ok`, `verrou`, `choisie`, `secret`) et
 * `data-case` sur chaque pièce de l'inventaire, `.rangs` et `.rang h4` sur
 * ses rangées, `.cases` sur leurs tuiles, `.vitrine`, `#fiche-art` (la
 * carte), `#fiche-detail`, `#fiche-actions` et `.bt`. Ils restent posés à
 * côté des classes des briques, qui seules dessinent.
 *
 * Script classique, pas module : tout ce qui vit dans `public/` est chargé par
 * une balise `<script src>` ordinaire.
 */
(() => {
  const esc = (s) => String(s ?? '').replace(/[<>&"]/g,
    (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

  /* **La famille se lit dans le catalogue** (`TBF_CARTES.TYPES`) quand la
     page l'a chargé — c'est le cas du classeur. À l'adresse /fanzzy/<id>, la
     page ne le charge pas (c'est la requête la plus lourde du jeu) : ces
     deux tables en sont le repli, pour la couleur et le nom seulement. */
  const COUL = { voix: '#F5C33B', perc: '#3C82E8', tifo: '#8257DA',
                 pyro: '#E0402C', depl: '#1E9E6A', fide: '#C2CAD6' };
  const NOMTYPE = { voix: 'Voix', perc: 'Percussion', tifo: 'Tifo',
                    pyro: 'Pyro', depl: 'Déplacement', fide: 'Fidélité' };
  const NOMRAR = { commune: 'Commune', rare: 'Rare', epique: 'Épique',
                   legendaire: 'Légendaire' };
  const famille = (type) => {
    const t = window.TBF_CARTES?.TYPES?.[type];
    return { nom: t?.nom || NOMTYPE[type] || '', c: t?.c || COUL[type] || '#C2CAD6' };
  };
  const rareteDe = (r) => (NOMRAR[r] ? r : 'commune');
  const JETON = () => window.TBF_STUFF?.gain?.('echarpes') ?? '/img/gains/echarpes.webp';

  /** Sans mouvement : la préférence du système, ou le calme du tiroir. */
  const doux = () => Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    || (window.FX?.calme ? window.FX.calme('animations')
      : /(^|\s)animations(\s|$)/.test(document.documentElement.dataset.calme ?? '')));

  /**
   * Le rang qu'occupe ce personnage dans la tribune du deck : 0 pour le
   * titulaire, 1 et 2 pour les remplaçants, **-1 s'il n'y est pas** — ce que
   * rend `findIndex`, et le serveur le transmet tel quel.
   */
  const siege = (d) => (Number.isInteger(d?.tribune?.siege) ? d.tribune.siege : -1);

  const api = async (chemin, corps, methode) => {
    const r = await fetch('/api/fanzzy' + chemin, {
      method: methode ?? (corps === undefined ? 'GET' : 'POST'),
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: corps === undefined ? undefined : JSON.stringify(corps),
    });
    if (r.status === 401) { location.href = '/compte'; throw new Error('auth'); }
    /* **Une réponse qui n'est pas du JSON lève**, et c'est voulu : elle
       rendait `{}`, `rendre()` levait trois lignes plus loin, et la page
       restait blanche alors que « Ce Fanzzy est introuvable » existait, écrit,
       juste à côté. Vu en ouvrant `/fanzzy/TR32` serveur muet. */
    const j = await r.json().catch(() => null);
    if (!j) {
      console.warn(`[fiche] ${chemin} : ${r.status}, et ce n’est pas du JSON`);
      throw Object.assign(new Error('reponse illisible'), { code: 'app.error.illisible' });
    }
    if (j.error) throw Object.assign(new Error(j.error), { code: j.error });
    return j;
  };

  /* ------------------------------------------------------------ la pile

     **Un mot au joueur passe par la pile commune** (`.tbf-pile`, ui.css), sur
     `body`, hors des conteneurs que la page réécrit : un toast de parpaing
     pour une information, qui secoue s'il dit non ; un ticket kraft qui
     monte pour une dépense. La fiche avait sa propre bulle, écrite en ligne,
     qui ne ressemblait à rien d'autre du jeu. */
  function pile() {
    let p = document.querySelector('body > .tbf-pile');
    if (!p) {
      p = document.createElement('div');
      p.className = 'tbf-pile';
      document.body.append(p);
    }
    return p;
  }

  function dire(texte, { erreur = false } = {}) {
    const t = document.createElement('div');
    t.className = `tbf-toast${erreur ? ' tbf-toast--erreur' : ''}`;
    t.setAttribute('role', erreur ? 'alert' : 'status');
    t.innerHTML = erreur
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5v.5"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
    t.append(document.createTextNode(texte));
    pile().append(t);
    setTimeout(() => t.remove(), 2800);
  }

  /** Le ticket d'une dépense : il se lit, il ne se touche pas, trois secondes. */
  function ticket(montant, nom, origine) {
    const t = document.createElement('div');
    t.className = 'tbf-ticket tbf-ticket--gain tbf-glisse';
    t.setAttribute('role', 'status');
    t.style.pointerEvents = 'none';
    t.innerHTML = `<img src="${esc(JETON())}" alt=""><b>${esc(montant)}</b>`
      + `<span>${esc(nom)}${origine ? `<small>${esc(origine)}</small>` : ''}</span>`;
    t.addEventListener('animationend', (e) => {
      if (e.animationName === 'tbf-glisse') t.classList.remove('tbf-glisse');
    });
    pile().append(t);
    setTimeout(() => t.remove(), 3200);
  }

  /**
   * Les effets, en français, par la table commune (`/mods.js`) : nom,
   * valeur, pictogramme. Une copie locale de cette table a déjà oublié
   * `parryResist` sur cent trois cartes ; un effet neuf apparaît ici sans
   * qu'on ait à y penser.
   */
  function lireMods(m = {}) {
    return (window.TBF_MODS?.paires(m) ?? []).map((x) => [x.nom, x.valeur, x.icone]);
  }

  /** Les pictogrammes des tuiles. Des traits, pas des émojis : ils se teintent. */
  const TRAITS = {
    tempo: 'M12 3v9l6 3M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18z',
    poing: 'M7 11V7a2 2 0 0 1 4 0v4M11 11V6a2 2 0 0 1 4 0v5M15 11V8a2 2 0 0 1 4 0v7a6 6 0 0 1-6 6H10l-5-5',
    coeur: 'M12 20s-7-4.6-7-9.4A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.6C19 15.4 12 20 12 20z',
    etoile: 'M12 3l2.6 5.6L21 9.5l-4.5 4.3 1.1 6.2L12 17l-5.6 3 1.1-6.2L3 9.5l6.4-.9z',
    alerte: 'M12 4l9 16H3zM12 10v4M12 17v.5',
    bouclier: 'M12 3l7 3v5c0 4.4-2.9 8.2-7 10-4.1-1.8-7-5.6-7-10V6z',
    souffle: 'M3 8h9a3 3 0 1 0-3-3M3 13h13a3 3 0 1 1-3 3M3 18h7',
    reprise: 'M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5',
    tenue: 'M9 3l3 2 3-2 5 3-2 4-2-1v11H8V9L6 10 4 6z',
    etat: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM8 9h.01M16 9h.01M8 14h8a4 4 0 0 1-8 0z',
  };
  const trait = (cle) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${TRAITS[cle] ?? TRAITS.etoile}"/></svg>`;
  const SVG = {
    croix: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    tourne: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5"/></svg>',
    lecture: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4l13 8-13 8z"/></svg>',
    fleche: '<svg class="fleche" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
  };

  /**
   * Monte la fiche dans `hote` et la tient à jour.
   *
   * @param {HTMLElement} hote
   * @param {string} idDemande  l'identifiant du personnage, ou d'un de ses âges
   * @param {object} [opts]
   * @param {Function} [opts.fermer]  appelée par la croix. Sans elle, pas de
   *   croix : c'est la page, et la barre du jeu y porte la flèche du retour.
   * @param {Function} [opts.change]  appelée après une action qui modifie la
   *   collection : la page qui accueille la fiche doit pouvoir se rafraîchir.
   * @returns {Promise<boolean>} faux si ce Fanzzy n'existe pas.
   */
  async function ouvrir(hote, idDemande, opts = {}) {
    let d = null;
    /** La pièce dont la fiche kraft parle. */
    let choisie = null;
    let pieces = [];
    /* **L'âge qu'on regarde**, qui n'est pas toujours celui qu'on a. La
       rangée ÂGES existe pour regarder les trois visages d'une lignée, et les
       tenues et les états proposés sont ceux de l'âge regardé : le Capo
       n'hérite pas de la garde-robe du gamin. */
    let ageVu = null;
    /* **Ce qu'on veut montrer** : un âge, une tenue, une expression. Ils se
       composent — on touche dans les trois rangées, la carte montre le
       résultat, un seul geste l'enregistre. Nul jusqu'au premier rendu, où
       il prend ce que l'avatar montre déjà. */
    let voulu = null;
    /* La carte n'est refaite que si ce qu'elle montre change : la refaire à
       chaque toucher relancerait son dessin et la ferait clignoter. */
    let carteMontree = '';
    /* Le tampon TON AVATAR claque une fois, juste après ME MONTRER AINSI. */
    let claquerAvatar = false;
    /* Les nouveautés déjà éteintes par cette fiche (contrat § 2.2). */
    const eteintes = new Set();
    let largeurs = null;

    try {
      d = await api('/fiche/' + encodeURIComponent(idDemande));
    } catch (e) {
      if (e.message === 'auth') return false;
      hote.innerHTML = `<div class="fiche"><div class="vide">Ce Fanzzy est introuvable.<br>
        <a href="/fanzzy">retour au classeur</a></div></div>`;
      return false;
    }

    const aMoi = () => Boolean(d.possede);
    const lignee = () => d.lignee ?? [];
    const vu = () => ageVu ?? d.stade;
    /** L'âge regardé, tel que la lignée le décrit ; le personnage à défaut. */
    const ageDe = (n) => lignee().find((a) => Number(a.stage) === Number(n)) ?? null;

    /** Ce que l'avatar montre aujourd'hui, pour savoir s'il y a à valider. */
    const avatarActuel = () => ({
      stade: d.avatarStade ?? null,
      skin: d.avatar ? (d.parAge?.[d.avatarStade]?.skins
        ?? d.skins ?? []).find((s) => s.porte)?.id ?? 'base' : null,
      etat: d.avatarEtat ?? null,
    });
    const memeQueLAvatar = () => {
      const a = avatarActuel();
      return Boolean(d.avatar) && voulu?.stade === a.stade
        && (voulu?.skin ?? 'base') === (a.skin ?? 'base')
        && (voulu?.etat ?? 'neutre') === (a.etat ?? 'neutre');
    };
    const tenuesA = (n) => d.parAge?.[n]?.skins ?? d.skins ?? [];
    const etatsA = (n) => d.parAge?.[n]?.etats ?? d.etats ?? [];

    /* **Un choix qui n'existe pas à l'âge regardé se défait.** Une tenue
       gagnée au deuxième âge ne se porte pas au premier, et le serveur
       refuserait le trio d'un bloc : on retombe sur la base et le repos
       plutôt que de proposer d'enregistrer ce qu'il refusera. */
    function ajusterVoulu() {
      if (!voulu) return;
      const n = voulu.stade;
      if (voulu.skin && voulu.skin !== 'base'
        && !tenuesA(n).some((s) => s.id === voulu.skin && s.possede)) voulu.skin = 'base';
      if (voulu.etat && voulu.etat !== 'neutre'
        && !etatsA(n).some((e) => e.id === voulu.etat && e.possede)) voulu.etat = 'neutre';
    }

    /* ------------------------------------------------------------ les dessins */

    const racine = () => d.fanzzy.id;
    const E = () => window.TBF_ETATS;
    /** Le portrait d'un âge (le buste), pour un nœud de l'arbre. */
    const portraitAge = (a) => window.FZART?.adresse?.(a.id, 'buste') ?? null;
    /** Le dessin exact d'une expression ou d'une tenue à l'âge regardé, ou rien. */
    const dessinExact = (n, { skin = 'base', etat = 'neutre' } = {}) => {
      const r = E()?.resoudre?.(racine(), { evo: n, skin, etat });
      return r && r.exact ? r.src : null;
    };

    /* ------------------------------------------------------------ les pièces

       Ce qu'on peut regarder, en quatre rangées. Une pièce qu'on n'a pas
       n'est pas absente : elle est sous scotch et dit ce qu'elle demande.
       C'est elle qui donne envie de continuer. */
    function batir() {
      const liste = [];
      const fam = famille(d.fanzzy.type);
      const n = vu();

      /* L'évolution est calculée **une fois pour la lignée** : elle est
         proposée dès l'ouverture, quelle que soit la pièce regardée. Elle
         n'était accrochée qu'à la case de l'âge suivant, et un joueur ouvrait
         la fiche d'une commune qu'il voulait faire grandir sans y trouver de
         bouton. */
      const suivant = lignee().find((y) => !y.possede && Number(y.stage) === d.stade + 1);
      const evoluer = suivant && aMoi()
        ? { vers: suivant, cout: Number(suivant.cout ?? 0),
            payable: Number(d.echarpes ?? 0) >= Number(suivant.cout ?? 0),
            manque: Math.max(0, Number(suivant.cout ?? 0) - Number(d.echarpes ?? 0)) }
        : null;

      for (const a of lignee()) {
        const s = Number(a.stage);
        liste.push({
          cle: `age:${a.id}`, rang: 'ÂGES', titre: a.nom, age: a, ok: Boolean(a.possede),
          etat: !aMoi() ? 'attend' : a.possede ? (s === d.stade ? 'ici' : 'fait')
            : s === d.stade + 1 ? 'suivant' : 'attend',
          pret: Boolean(evoluer?.payable && evoluer.vers.id === a.id),
          prix: evoluer && evoluer.vers.id === a.id ? evoluer.cout : null,
          evoluer,
        });
      }

      /* Ce qu'il change. L'effet **réel** — celui du personnage combiné à
         l'équipement porté — parce que c'est lui que le duel emploiera. Et
         ceux que l'âge suivant ajoute, sous scotch, avec leur prix : la
         rangée dit ce qu'on gagnera, pas seulement ce qu'on a. */
      const reel = lireMods(d.effetReel);
      const brut = new Map(lireMods(d.fanzzy.mods).map(([nom, v]) => [nom, v]));
      for (const [nom, valeur, icone] of reel) {
        liste.push({ cle: `effet:${nom}`, rang: 'EFFETS', titre: nom, ok: true, valeur, icone,
          brut: brut.get(nom) ?? null, couleur: fam.c });
      }
      if (evoluer) {
        for (const [nom, valeur, icone] of lireMods(evoluer.vers.mods)) {
          if (reel.some(([x]) => x === nom)) continue;
          liste.push({ cle: `effet:${nom}`, rang: 'EFFETS', titre: nom, ok: false, valeur, icone,
            prix: evoluer.cout, age: evoluer.vers, couleur: fam.c });
        }
      }

      /* **Le repos, en tête des états.** Il ne se gagne pas — il est là dès
         le premier booster —, mais la rangée sert aussi à **choisir** : sans
         lui, une expression retenue ne se défaisait plus depuis la fiche. Sur
         un Fanzzy qu'on n'a pas, pas de visage : la carte n'en montre que la
         silhouette, la rangée ne va pas le donner à côté. */
      liste.push({ cle: 'etat:neutre', rang: 'ÉTATS', titre: 'Au repos', id: 'neutre', ok: true,
        image: aMoi() ? portraitAge(ageDe(n) ?? { id: d.fanzzy.ageId ?? d.fanzzy.id }) : null });
      /* Les quatre états de l'âge regardé : le dessin quand il est gagné, le
         pictogramme sinon — montrer l'expression qu'on n'a pas serait la
         donner. */
      for (const e of etatsA(n)) {
        liste.push({ cle: `etat:${e.id}`, rang: 'ÉTATS', titre: e.nom, id: e.id, ok: Boolean(e.possede),
          dessin: e.dessin, image: e.possede ? dessinExact(n, { etat: e.id }) : null });
      }

      /* Les tenues de l'âge regardé, en pied, la tenue de base en tête : c'est
         elle qu'on retouche pour se déshabiller. `d.skins` reste le repli
         d'un serveur d'avant `parAge`. **Une tenue dépubliée ne se propose
         plus** : elle est sortie des boosters, et « à trouver dans un
         booster » serait faux ; elle reste à qui l'a gagnée. */
      for (const s of tenuesA(n)) {
        if (!s.possede && s.publie === false) continue;
        liste.push({ cle: `tenue:${s.id}`, rang: 'TENUES', titre: s.nom, id: s.id, ok: Boolean(s.possede),
          porte: Boolean(s.porte), image: s.possede ? dessinExact(n, { skin: s.id }) : null });
      }
      return liste;
    }

    /* --------------------------------------------------------------- rendu */

    function rendre() {
      const f = d.fanzzy;
      /* Au premier rendu, on part de ce que l'avatar montre. S'il montre
         quelqu'un d'autre, de l'âge atteint et de ce qui y est porté. */
      if (!voulu) {
        const a = avatarActuel();
        const st = a.stade ?? d.stade;
        voulu = { stade: st,
          skin: a.skin ?? tenuesA(st).find((s) => s.porte)?.id ?? 'base',
          etat: a.etat ?? 'neutre' };
        ageVu = st;
      }
      /* **Ce qu'on ne sait pas ne s'écrit pas** — ni tiret, ni « undefined ».
         Le solde, la famille : absents, leur place se retire. */
      const solde = Number.isFinite(Number(d.echarpes)) && d.echarpes !== null
        ? `<a class="tbf-monnaie" id="fiche-solde" href="/boutique" aria-label="${Number(d.echarpes)} écharpes — où en gagner">
            <img src="${esc(JETON())}" alt=""><b>${Number(d.echarpes)}</b><i class="tbf-monnaie-plus" aria-hidden="true">+</i></a>`
        : '';
      /* **Une croix en panneau, rien sur la page.** Par-dessus le classeur, la
         croix referme et rend la grille : fermer n'est pas revenir. À
         l'adresse /fanzzy/<id>, la barre du jeu porte déjà la flèche qui
         remonte au classeur (`parentDe`, nav.js) : une seconde flèche, juste
         dessous, disait deux fois la même chose et prenait au nom la place
         d'une plaque. */
      const sortie = opts.fermer
        ? `<button type="button" class="tbf-plaque tbf-plaque--rond" data-fermer aria-label="Fermer">${SVG.croix}</button>`
        : '';

      hote.innerHTML = `
        <div class="fiche${aMoi() ? '' : ' pas-a-moi'}" style="--pin-type:url('${
          esc(window.TBF_LOGO?.adresse?.('type', f.type) ?? '')}')">
          <div class="head">
            ${sortie}
            <h1><span class="nom" id="fiche-nom"></span><small class="galons" id="fiche-galons"></small></h1>
            ${solde}
          </div>
          <div class="corps">
            <div class="vitrine" id="fiche-vitrine">
              <div class="tbf-vitrine-scene" id="fiche-scene">
                <div class="tbf-vitrine-tilt" id="fiche-art"></div>
              </div>
            </div>
            <div id="fiche-cri" hidden></div>
            <div class="tbf-inventaire rangs" id="fiche-inventaire"${
              aMoi() ? '' : ' aria-hidden="true"'}></div>
            <div class="tbf-ticket tbf-detail" id="fiche-detail"></div>
          </div>
          <div class="actions" id="fiche-actions"></div>
        </div>`;
      carteMontree = '';
      brancher();
      peindre();
    }

    /** Tout ce qui suit un toucher : la carte, ses côtés, l'inventaire, le détail, les actions. */
    function peindre() {
      ajusterVoulu();
      pieces = batir();
      if (!pieces.some((x) => x.cle === choisie)) {
        // Par défaut, l'âge regardé : c'est ce qu'on est venu voir.
        choisie = pieces.find((x) => x.rang === 'ÂGES' && Number(x.age.stage) === vu())?.cle
          ?? pieces[0]?.cle ?? null;
      }
      peindreTete();
      peindreCarte();
      peindreCotes();
      peindreCri();
      peindreInventaire();
      peindreDetail();
      peindreActions();
      eteindreNouveautes();
    }

    /* Le nom et la rareté de l'âge regardé **s'il est atteint**, ceux de
       l'âge atteint sinon : la carte cache le visage d'un âge à venir,
       l'en-tête ne va pas le nommer à sa place. Le nom suit le dessin — la
       fiche a montré un temps le Choriste sous le nom du Meneur de chant —, et
       la rareté suit le nom : une commune nommée sous un galon « Épique »
       disait deux cartes à la fois. La famille, elle, est celle de la lignée. */
    function peindreTete() {
      const n = hote.querySelector('#fiche-nom');
      const g = hote.querySelector('#fiche-galons');
      if (!n || !g) return;
      const a = ageDe(vu());
      const montre = a && a.possede ? a : null;
      n.textContent = montre?.nom ?? d.fanzzy.nom;
      const fam = famille(d.fanzzy.type);
      const rar = rareteDe(montre?.rar ?? d.fanzzy.rar);
      /* **La famille en sticker, son pin dedans** : la brique du vestiaire
         (`.tbf-sticker` > `.tbf-pin`, ui.css), pour que la même famille se
         reconnaisse d'un écran à l'autre ; le mot sur la craie, la couleur
         au pin seulement. La rareté garde sa petite forme et son mot à côté :
         une forme qui porterait son mot (le rond de la rare en prend trente
         pixels) ne tient pas dans la rangée.

         **La rangée ne change pas de largeur d'un âge à l'autre.** Sur un
         écran étroit, le sticker d'une longue famille et COMMUNE passent à
         la ligne là où RARE tient : toucher un âge ajoutait ou retirait une
         ligne, et la carte sautait. Le mot montré est donc empilé sur ceux
         des autres âges de la lignée, cachés (`.galon-mot`, fanzzy-fiche.css) :
         la place est celle du plus long, quel que soit l'âge regardé. */
      const mots = [...new Set([rar, ...lignee().map((x) => rareteDe(x.rar))])];
      g.innerHTML = (fam.nom ? `<span class="tbf-sticker"><span class="tbf-pin" style="--fam:${esc(fam.c)}" aria-hidden="true">${
        window.TBF_LOGO?.type?.(d.fanzzy.type, '') ?? ''}</span>${esc(fam.nom)}</span>` : '')
        + `<span class="galon"><span class="tbf-forme" data-rar="${rar}" aria-hidden="true"><i></i></span><span class="galon-mot">${
          mots.map((r, i) => `<span${i ? ' aria-hidden="true"' : ''}>${esc(NOMRAR[r])}</span>`).join('')}</span></span>`;
      ajusterNom(n);
      serrerGalons(g);
    }

    /* **Une rangée de galons, pas deux.** Le sticker d'une longue famille
       (DÉPLACEMENT, PERCUSSION) et le mot de la rareté ne tiennent pas côte à
       côte sous la croix du panneau, à 360 pixels de large : la rangée
       passait à la ligne, et ses vingt-quatre pixels de plus étaient pris à
       la carte, qui perdait son pied. Le mot se retire alors pour l'œil
       (`.tbf-vh`) et reste au lecteur d'écran ; la forme garde la couleur et
       la silhouette, et la carte, juste dessous, porte la forme avec son mot.
       Mesuré le mot présent, à chaque rendu et à chaque changement de
       largeur — comme le nom. */
    function serrerGalons(g) {
      const mot = g?.querySelector('.galon-mot');
      if (!mot) return;
      mot.classList.remove('tbf-vh');
      g.classList.remove('serre');
      /* Passé à la ligne : le dernier galon commence sous le bas du premier
         (ils sont centrés l'un sur l'autre, de hauteurs différentes, sur une
         même ligne). Serrée, la rangée rapproche aussi la forme du sticker
         (fanzzy-fiche.css) : à 320 pixels, sous la croix, il manquait deux
         pixels à la forme seule. */
      const premier = g.firstElementChild;
      const dernier = g.lastElementChild;
      if (premier !== dernier && dernier.offsetTop >= premier.offsetTop + premier.offsetHeight - 1) {
        mot.classList.add('tbf-vh');
        g.classList.add('serre');
      }
    }

    /* **Un nom trop long rapetisse, il ne se coupe pas.** Des points de
       suspension sur le nom de la carte qu'on regarde se lisent comme une
       faute, et l'audit les compte. De vingt pixels à treize, puis sur deux
       lignes s'il le faut encore. */
    function ajusterNom(n) {
      n.classList.remove('long');
      n.style.fontSize = '';
      for (let px = 20; px >= 13 && n.scrollWidth > n.clientWidth + 1; px -= 1) {
        n.style.fontSize = `${px}px`;
      }
      if (n.scrollWidth > n.clientWidth + 1) n.classList.add('long');
    }

    /* ----------------------------------------------------------- la carte */

    function peindreCarte() {
      const tilt = hote.querySelector('#fiche-art');
      const scene = hote.querySelector('#fiche-scene');
      const C = window.TBF_CARTES;
      if (!tilt || !scene) return;
      const a = ageDe(vu()) ?? { id: d.fanzzy.ageId ?? d.fanzzy.id, nom: d.fanzzy.nom, stage: d.stade,
        rar: d.fanzzy.rar, mods: d.fanzzy.mods, cri: d.fanzzy.cri, possede: aMoi() };
      const atteint = aMoi() && Boolean(a.possede);
      const prochain = aMoi() && !a.possede && Number(a.stage) === d.stade + 1;
      const tenue = atteint ? voulu.skin ?? 'base' : 'base';
      const pose = atteint ? voulu.etat ?? 'neutre' : 'neutre';
      const pret = pieces.some((x) => x.pret);
      const rar = rareteDe(a.rar ?? d.fanzzy.rar);

      /* La scène suit la rareté de l'âge regardé : sa lueur, et ses rayons
         pour l'épique et la légendaire. **Les rayons tournent sans fin**, et
         l'écran n'en a que trois : la matière de la carte en prend une, la
         respiration du personnage une autre, le nœud d'âge qui pulse la
         troisième quand le solde paie. Ils ne tournent donc que si le nœud
         ne pulse pas. */
      scene.dataset.rar = rar;
      scene.toggleAttribute('data-rayons', atteint && (rar === 'epique' || rar === 'legendaire') && !pret);
      /* Crochet des suites : l'âge regardé n'est pas atteint, la carte est
         au secret (`fz-secret`, flou et « ÂGE À VENIR »). */
      tilt.classList.toggle('secret', aMoi() && !atteint);

      const cle = [vu(), tenue, pose, atteint, aMoi(), siege(d), d.possede, a.id].join('|');
      if (cle === carteMontree) return;
      carteMontree = cle;

      if (!C?.cardHTML) { tilt.innerHTML = ''; return; }
      /* La famille de la carte, quand le catalogue n'est pas là : son nom
         et sa couleur, que la fiche connaît. Sans le tracé du pictogramme —
         voir le pin provisoire, dans fanzzy-fiche.css. */
      if (C.TYPES && !C.TYPES[d.fanzzy.type] && NOMTYPE[d.fanzzy.type]) {
        C.TYPES[d.fanzzy.type] = { nom: NOMTYPE[d.fanzzy.type], c: COUL[d.fanzzy.type], ico: '' };
      }
      const carte = { id: a.id, nom: a.nom, type: d.fanzzy.type, set: d.fanzzy.set,
        stage: Number(a.stage) || 1, rar, cri: a.cri ?? d.fanzzy.cri, mods: a.mods ?? {} };
      const options = !aMoi() ? { verrou: true, anime: false }
        : atteint ? { flip: true, titulaire: siege(d) === 0, doublons: d.possede }
          : { secret: true, prix: prochain ? a.cout : null };
      tilt.innerHTML = C.cardHTML(carte, options) + '<i class="tbf-vitrine-lustre" aria-hidden="true"></i>';

      /* **L'apparence composée.** La carte sait dessiner un âge ; la tenue et
         l'expression choisies sont une pose du même personnage, que
         `resoudre` trouve. On ne change que l'adresse de l'image — sa
         `transform` est à fx.js. Un dessin qui manque encore à cet âge garde
         la pose de base : la fiche kraft le dit. */
      if (atteint && (tenue !== 'base' || pose !== 'neutre')) {
        const r = E()?.resoudre?.(racine(), { evo: Number(a.stage), skin: tenue, etat: pose });
        const img = tilt.querySelector('.illu');
        if (r && r.evo === Number(a.stage) && img) {
          img.onerror = () => {
            img.onerror = null;
            const s = E()?.secours?.(r.src, true);
            if (s) img.src = s;
          };
          img.classList.add('fz-pied');
          img.src = r.src;
        }
      }
      window.FX?.animer?.(tilt);
    }

    /* ---------------------------------------------- ce qui se colle autour */

    function peindreCotes() {
      const v = hote.querySelector('#fiche-vitrine');
      if (!v) return;
      v.querySelectorAll(':scope > .cote-g, :scope > .tourne, :scope > .paquet, :scope > .cri-court')
        .forEach((n) => n.remove());
      const a = ageDe(vu());
      const atteint = aMoi() && Boolean(a?.possede ?? true);
      let html = '';
      if (atteint && voulu) {
        /* **TON AVATAR est un acquis, pas un bouton éteint.** Le bouton
           « C'EST DÉJÀ LUI » occupait une place d'action pour dire qu'il n'y
           avait rien à faire. Quand la carte montre autre chose que l'avatar,
           la bâche qui l'enregistre prend la même place. */
        html += memeQueLAvatar()
          ? `<span class="cote-g tbf-tampon${claquerAvatar ? ' tbf-clac' : ''}" data-ton="vert">TON<br>AVATAR</span>`
          : `<button type="button" class="cote-g tbf-plaque" data-montrer
              data-stade="${esc(String(voulu.stade))}" data-skin="${esc(voulu.skin ?? 'base')}"
              data-etat="${esc(voulu.etat ?? 'neutre')}">ME MONTRER AINSI</button>`;
        html += `<button type="button" class="tbf-plaque tbf-plaque--rond tourne" data-tourner
          aria-pressed="false" aria-label="Retourner la carte">${SVG.tourne}</button>`;
      }
      claquerAvatar = false;
      const cri = criVu();
      if (aMoi() && cri) {
        html += `<button type="button" class="tbf-plaque tbf-plaque--rond cri-court" data-cri
          aria-label="Cri : ${esc(cri)}">${SVG.lecture}</button>`;
      }
      /* **La carte qu'on n'a pas montre où la trouver** : la vignette du
         paquet de sa série, collée à côté d'elle. Le dessin du sachet quand
         la série en a un, sinon le sachet composé de `packArt` — celui que
         le kiosque montre faute de mieux. La chance de la tirer
         (« 1 CHANCE SUR 3 ») n'est pas servie avec la fiche : elle ne
         s'écrit pas. */
      if (!aMoi()) {
        const src = paquet();
        if (src) html += `<div class="tbf-vitrine-paquet paquet"><img src="${esc(src)}" alt="${
          esc(d.fanzzy.setNom ? `Le booster ${d.fanzzy.setNom}` : 'Un booster')}"></div>`;
      }
      v.insertAdjacentHTML('beforeend', html);
      v.querySelector('.cote-g.tbf-clac')?.addEventListener('animationend',
        (e) => e.currentTarget.classList.remove('tbf-clac'), { once: true });
    }

    /** L'adresse de la vignette du paquet de la série, ou rien. */
    function paquet() {
      const C = window.TBF_CARTES;
      const set = d.fanzzy.set;
      if (!set || !C) return null;
      if (C.ART?.[set]) return '/' + (window.FZART?.src?.(C.ART[set]) ?? `${C.ART[set]}.webp`);
      const svg = C.packArt?.({ id: set, nom: d.fanzzy.setNom ?? '' });
      return svg ? `data:image/svg+xml,${encodeURIComponent(svg)}` : null;
    }

    /* ------------------------------------------------------- la bande du cri */

    /** Le cri de l'âge regardé s'il est atteint, de l'âge atteint sinon. */
    function criVu() {
      const a = ageDe(vu());
      return (a?.possede ? a.cri?.label : null) ?? d.fanzzy.cri?.label ?? '';
    }

    /* Le cri se **crie** quand on touche la bande : sur un Fanzzy qu'on n'a
       pas, la bande ne se pose pas — une carte éteinte qui pousse un cri,
       c'était le seul élément qui répondait encore. */
    function peindreCri() {
      const n = hote.querySelector('#fiche-cri');
      if (!n) return;
      const cri = criVu();
      if (!aMoi() || !cri) { n.replaceWith(Object.assign(document.createElement('div'), { id: 'fiche-cri', hidden: true })); return; }
      const fam = famille(d.fanzzy.type);
      const b = document.createElement('button');
      b.type = 'button';
      b.id = 'fiche-cri';
      b.className = 'tbf-cri';
      b.dataset.cri = '';
      b.style.cssText = `--e1:${fam.c};--e2:var(--craie)`;
      b.innerHTML = `${SVG.lecture}<small>CRI</small><b>${esc(cri)}</b>`;
      n.replaceWith(b);
    }

    /* ---------------------------------------------------------- l'inventaire */

    function peindreInventaire() {
      const n = hote.querySelector('#fiche-inventaire');
      if (!n) return;
      const gauche = n.scrollLeft;
      /* L'ordre est celui de l'importance : ce qu'il devient, ce qu'il
         change, puis ce qu'il montre. Les tenues ferment la marche : ce sont
         les seules qui ne changent rien au jeu, et les plus nombreuses. */
      const rangs = ['ÂGES', 'EFFETS', 'ÉTATS', 'TENUES']
        .map((r) => [r, pieces.filter((x) => x.rang === r)])
        .filter(([, l]) => l.length);
      n.innerHTML = rangs.map(([nom, l]) => `<section class="tbf-inventaire-rang rang">
          <h4 class="tbf-inventaire-titre">${nom}</h4>
          ${nom === 'ÂGES'
            ? `<ol class="tbf-ages" aria-label="Ses âges">${l.map(noeudHTML).join('')}</ol>`
            : `<div class="tbf-inventaire-tuiles cases">${l.map(tuileHTML).join('')}</div>`}
        </section>`).join('');
      n.scrollLeft = gauche;
      marquerDebord();
    }

    /* `disabled` et non seulement `pointer-events:none` : une pièce
       inaccessible à la souris reste accessible au clavier, et la tabulation
       emmenait dans une rangée de boutons muets. */
    const mort = () => (aMoi() ? '' : ' disabled tabindex="-1"');

    /** Un nœud de l'arbre des âges. */
    function noeudHTML(x) {
      const a = x.age;
      const regarde = Number(a.stage) === vu();
      const secret = !x.ok ? ' secret' : '';
      const nom = x.ok ? `Âge ${a.stage} — ${a.nom}`
        : x.prix != null ? `Âge ${a.stage} — ${x.prix} écharpes (verrouillé)` : `Âge ${a.stage} (verrouillé)`;
      const img = portraitAge(a);
      return `<li data-etat="${x.etat}" data-rar="${esc(rareteDe(a.rar))}"${x.pret ? ' data-pret' : ''}>
        <button type="button" class="tbf-ages-k case ${x.ok ? 'ok' : 'verrou'}${secret}${x.cle === choisie ? ' choisie' : ''}"
          data-case="${esc(x.cle)}" title="${esc(a.nom)}" aria-label="${esc(nom)}"${regarde ? ' aria-current="true"' : ''}${mort()}>${
          img ? `<img src="${esc(img)}" alt="" loading="lazy" onerror="this.remove()">` : ''}</button>${
          x.prix != null ? `<span class="tbf-sticker tbf-sticker--prix" aria-hidden="true"><img src="${esc(JETON())}" alt="">${x.prix}</span>` : ''}
      </li>`;
    }

    /**
     * Une tuile : vert pour un état, **bleu pour une tenue** (posséder ; le
     * violet reste aux gens), la couleur de la famille pour un effet. La
     * pièce montrée dans le détail reste enfoncée (`aria-current`) ; celles
     * qui composent l'apparence sont pressées (`aria-pressed`) ; celles qu'on
     * n'a pas sont sous scotch, avec la raison.
     */
    function tuileHTML(x) {
      const etat = x.rang === 'ÉTATS';
      const tenue = x.rang === 'TENUES';
      const effet = x.rang === 'EFFETS';
      const choisi = x.cle === choisie;
      const retenu = aMoi() && x.ok && voulu
        && ((etat && x.id === (voulu.etat ?? 'neutre')) || (tenue && x.id === voulu.skin));
      const ton = !aMoi() || !x.ok ? '' : etat ? ' data-ton="vert"' : tenue ? ' data-ton="bleu"' : '';
      const face = effet && x.ok && aMoi() ? ` style="--face:${esc(x.couleur)};--lettre:var(--encre)"` : '';
      const dedans = x.image
        ? `<img src="${esc(x.image)}" alt="" loading="lazy" onerror="this.remove()">`
        : trait(effet ? x.icone : etat ? 'etat' : 'tenue');
      /* La raison d'une pièce qu'on n'a pas — jamais muette : une croix sans
         mot ne donne envie de rien. Sur la fiche d'un Fanzzy qu'on n'a pas,
         tout est fermé pour la même raison, et la carte la dit déjà. */
      let colle = '';
      if (!x.ok && aMoi()) {
        colle = '<span class="tbf-scotch tbf-scotch--croix" aria-hidden="true"></span>'
          + (x.prix != null
            ? `<span class="tbf-sticker" aria-hidden="true"><img src="${esc(JETON())}" alt="">${x.prix}</span>`
            : '<span class="tbf-sticker" aria-hidden="true">BOOSTER</span>');
      } else if (aMoi() && x.ok && tenue && x.porte) {
        colle = '<span class="tbf-sticker" aria-hidden="true">PORTÉE</span>';
      } else if (aMoi() && x.ok && etat) {
        colle = '<span class="tbf-sticker tbf-sticker--rond" data-ton="vert" aria-hidden="true"><i class="tbf-ico tbf-ico-coche"></i></span>';
      }
      const nom = !x.ok ? `${x.titre} — ${x.prix != null ? `${x.prix} écharpes` : 'dans les boosters'}`
        : tenue && x.porte ? `${x.titre}, portée` : x.titre;
      return `<button type="button" class="tbf-plaque tbf-tuile${tenue ? ' tbf-tuile--pied' : ''} case ${
        x.ok ? 'ok' : 'verrou'}${choisi ? ' choisie' : ''}"${ton}${face}${!x.ok || !aMoi() ? ' data-verrou' : ''}
        data-case="${esc(x.cle)}" title="${esc(x.titre)}" aria-label="${esc(nom)}"${
        choisi ? ' aria-current="true"' : ''}${(etat || tenue) && x.ok && aMoi() ? ` aria-pressed="${retenu}"` : ''}${mort()}>${dedans}${colle}</button>`;
    }

    /* **La bande défile, et elle le dit.** Une ombre au bord tant qu'il reste
       quelque chose à droite, retirée au bout ; recalculée à chaque
       changement de largeur (tourner le téléphone, ouvrir le clavier). */
    function marquerDebord() {
      const b = hote.querySelector('#fiche-inventaire');
      if (!b) return;
      b.classList.toggle('deborde', b.scrollWidth - b.clientWidth - b.scrollLeft > 2);
    }

    /* --------------------------------------------------- la fiche kraft

       Ce que fait la pièce qu'on touche, **en chiffres plutôt qu'en
       phrases** : un titre, deux lignes au plus — c'est ce que tiennent ses
       quatre-vingt-huit pixels. Tout au noir du kraft (la brique). */
    function ligne(libelle, valeur, jauges = '') {
      return `<div class="tbf-detail-l"><span>${esc(libelle)}</span>${jauges}${
        valeur != null && valeur !== '' ? `<b>${esc(valeur)}</b>` : ''}</div>`;
    }
    const jauge = (p) => `<span class="tbf-jauge tbf-jauge--fine"><i style="width:${
      Math.max(0, Math.min(100, Number(p) || 0))}%"></i></span>`;

    function peindreDetail() {
      const n = hote.querySelector('#fiche-detail');
      if (!n) return;
      n.className = 'tbf-ticket tbf-detail';
      /* Sur un Fanzzy qu'on n'a pas, une seule réponse, celle qu'on se pose
         devant une carte grise : comment l'avoir. Le nom de la série vient du
         serveur (`setNom`) — une table « TR → LA TRIBUNE » écrite ici serait
         une copie de plus. */
      if (!aMoi()) {
        const s = d.fanzzy.setNom;
        n.innerHTML = `<div class="tbf-detail-t"><b>Comment l’obtenir</b><small>${
          esc(NOMRAR[rareteDe(d.fanzzy.rar)])}</small></div>
          ${ligne(`Il se tire dans les boosters${s ? ` de ${s}` : ''}`)}
          ${ligne('Ses âges et ses tenues s’ouvrent avec lui')}`;
        return;
      }
      const x = pieces.find((y) => y.cle === choisie);
      if (!x) { n.innerHTML = ''; return; }
      if (x.rang === 'ÂGES') n.innerHTML = detailAge(x);
      else if (x.rang === 'EFFETS') n.innerHTML = detailEffet(x);
      else detailPose(n, x);
    }

    /* Un âge : ce qu'il gagne sur le précédent — la poussée du cri en deux
       écharpes, avant (grise) et après, et le premier effet qui change. Le
       premier âge dit ce qu'il fait. Un âge à venir dit son prix. */
    function detailAge(x) {
      const a = x.age;
      const s = Number(a.stage);
      const avant = ageDe(s - 1);
      const statut = !x.ok ? 'à découvrir' : s === d.stade ? 'actuel' : 'atteint';
      const sous = !x.ok ? (a.cout ? `${a.cout} écharpes` : '')
        : avant ? 'ce qu’il a gagné' : 'ce qu’il fait';
      const lignes = [];
      const p1 = Number(avant?.cri?.power);
      const p2 = Number(a.cri?.power);
      if (Number.isFinite(p2) && p2 > 0) {
        lignes.push(Number.isFinite(p1) && p1 > 0 && avant
          ? ligne('Poussée du cri', `${p1} → ${p2}`, `<span class="tbf-detail-deux">${jauge(p1)}${jauge(p2)}</span>`)
          : ligne('Poussée du cri', String(p2), `<span class="tbf-detail-deux">${jauge(p2)}</span>`));
      }
      const av = new Map(lireMods(avant?.mods).map(([nom, v]) => [nom, v]));
      const change = lireMods(a.mods).find(([nom, v]) => av.get(nom) !== v);
      if (change) {
        const [nom, v] = change;
        lignes.push(ligne(nom, avant && av.has(nom) ? `${av.get(nom)} → ${v}` : v));
      }
      return `<div class="tbf-detail-t"><b>Âge ${s} · ${statut}</b>${sous ? `<small>${esc(sous)}</small>` : ''}</div>
        ${lignes.slice(0, 2).join('')}`;
    }

    /* Un effet : sa valeur, et d'où elle vient. L'échelle d'une écharpe
       « sur le maximum de la famille » n'est pas servie : sans elle, pas de
       jauge — une jauge inventée mentirait sur la grandeur. */
    function detailEffet(x) {
      if (!x.ok) {
        return `<div class="tbf-detail-t"><b>${esc(x.titre)}</b><small>${x.prix} écharpes</small></div>
          ${ligne(`À l’âge ${x.age?.stage ?? ''}`, x.valeur)}
          ${ligne('Il vient avec l’âge suivant')}`;
      }
      const origine = x.brut == null ? 'de ton équipement'
        : x.brut === x.valeur ? 'du Fanzzy' : 'Fanzzy et équipement';
      return `<div class="tbf-detail-t"><b>${esc(x.titre)}</b><small>${esc(origine)}</small></div>
        ${ligne('En duel', x.valeur)}
        ${x.brut != null && x.brut !== x.valeur ? ligne('Le Fanzzy seul', x.brut) : ''}`;
    }

    /* Un état ou une tenue : son portrait dans la pose, ce qu'il est, et si
       la carte ne peut pas encore le montrer à cet âge, on le dit — le choix
       est gardé, c'est le dessin qui manque. */
    function detailPose(n, x) {
      const etat = x.rang === 'ÉTATS';
      const sorte = etat ? 'état' : 'tenue';
      const retenu = voulu && (etat ? x.id === (voulu.etat ?? 'neutre') : x.id === voulu.skin);
      const statut = !x.ok ? 'à trouver' : !etat && x.porte ? 'portée'
        : retenu ? (etat ? 'choisi' : 'choisie') : x.id === 'neutre' ? 'de base' : 'à toi';
      const lignes = [];
      if (!x.ok) {
        lignes.push(ligne('Dans un booster'), ligne(`Pour l’âge ${vu()} de ce Fanzzy`));
      } else {
        lignes.push(ligne(etat ? (x.id === 'neutre' ? 'Son air de tous les jours' : x.dessin || 'Au bon moment du match')
          : 'Elle se voit, sans rien changer au jeu'));
        if (x.id !== 'neutre' && !x.image) lignes.push(ligne('Pas encore de dessin à cet âge'));
      }
      const portrait = x.ok ? x.image : null;
      n.classList.toggle('tbf-detail--portrait', Boolean(portrait));
      n.innerHTML = `${portrait ? `<img class="tbf-detail-portrait" src="${esc(portrait)}" alt="" onerror="this.remove()">` : ''}
        <div class="tbf-detail-t"><b>${esc(x.titre)}</b><small>${esc(`${sorte} · ${statut}`)}</small></div>
        ${lignes.join('')}`;
    }

    /* ---------------------------------------------------------- les actions

       **Hiérarchisées, et des bâches au ton de ce qu'elles font** : dépenser
       des écharpes est or, jouer est rouge, ce qui ne fait que déplacer reste
       en béton. Une rangée, toujours au même endroit. */
    function peindreActions() {
      const n = hote.querySelector('#fiche-actions');
      if (!n) return;
      /* La carte qu'on n'a pas : la bâche or mène **vraiment** au kiosque.
         Elle dit encore pourquoi il faut y aller. */
      if (!aMoi()) {
        n.innerHTML = '<a class="bt tbf-plaque" data-ton="or" href="/boosters">OUVRIR UN BOOSTER'
          + '<small>il n’est pas encore à toi</small></a>';
        return;
      }
      const ev = pieces.find((x) => x.evoluer)?.evoluer ?? null;
      /* Fermé et **nommé** : « rien ne se passe » et « il te manque quinze
         écharpes » n'appellent pas le même geste. Le bouton garde sa place —
         le retirer ferait croire que ce Fanzzy ne grandit pas. Le nombre est
         repris dans le sous-libellé, pour que la phrase se lise d'un bloc. */
      const evoluer = !ev ? ''
        : ev.payable
          ? `<button type="button" class="bt or tbf-plaque" data-ton="or" data-evoluer>ÉVOLUER<small>${
            Number(d.echarpes)} → ${Number(d.echarpes) - ev.cout} écharpes</small><span class="tbf-sticker tbf-sticker--prix" aria-hidden="true"><img src="${
            esc(JETON())}" alt="">${ev.cout}</span></button>`
          : `<button type="button" class="bt tbf-plaque" data-evoluer disabled>IL TE FAUT ${ev.manque}<small> écharpes de plus</small></button>`;
      /* Sans module de deck monté, pas de bouton : mieux vaut rien qu'une
         promesse que le serveur ne peut pas tenir. Déjà dans la tribune, le
         verbe change — c'est là qu'on passe un titulaire en remplaçant. */
      const place = siege(d);
      const duel = !d.tribune ? ''
        : place >= 0
          ? `<button type="button" class="bt tbf-plaque" data-emmener>CHANGER DE PLACE<small>${
            place === 0 ? 'titulaire' : `remplaçant ${place}`}</small></button>`
          : '<button type="button" class="bt primaire tbf-plaque" data-ton="flare" data-emmener>EMMENER EN DUEL<small>place au deck</small></button>';
      n.innerHTML = evoluer + duel;
    }

    /* ------------------------------------------------- les nouveautés

       La fiche éteint **sa** clé (contrat du serveur, § 2) : le personnage et
       l'âge qu'on vient de voir ne sont plus « nouveaux » au classeur. Après
       les avoir montrés, jamais au chargement — d'où le délai, et la fiche
       doit encore être à l'écran. Une route absente ne casse rien. */
    function eteindreNouveautes() {
      if (!aMoi()) return;
      const cles = [`fanzzy:${racine()}`];
      if (d.stade > 1) cles.push(`age:${racine()}:${d.stade}`);
      const neuves = cles.filter((c) => !eteintes.has(c));
      if (!neuves.length) return;
      neuves.forEach((c) => eteintes.add(c));
      setTimeout(() => {
        if (!hote.isConnected || document.hidden) { neuves.forEach((c) => eteintes.delete(c)); return; }
        fetch('/api/fanzzy/vu', { method: 'POST', credentials: 'same-origin',
          headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cles: neuves }) })
          .catch(() => {});
      }, 900);
    }

    /* ------------------------------------------------------------- gestes */

    /* Un seul écouteur par zone, posé une fois par rendu complet : les pièces
       sont refaites à chaque toucher, et rebrancher quinze boutons finirait
       par en oublier un. */
    function brancher() {
      hote.querySelector('[data-fermer]')?.addEventListener('click', () => opts.fermer?.());

      const corps = hote.querySelector('.corps');
      corps?.addEventListener('click', (e) => {
        if (e.target.closest('[data-cri]')) { crier(); return; }
        if (e.target.closest('[data-tourner]')) { tourner(); return; }
        if (e.target.closest('[data-montrer]')) { montrer(e.target.closest('[data-montrer]')); return; }
        const b = e.target.closest('[data-case]');
        if (b && !b.disabled) toucher(b.dataset.case);
      });

      const inv = hote.querySelector('#fiche-inventaire');
      if (inv) {
        inv.addEventListener('scroll', marquerDebord, { passive: true });
        largeurs?.disconnect();
        largeurs = new ResizeObserver(() => {
          marquerDebord();
          ajusterNom(hote.querySelector('#fiche-nom') ?? document.createElement('span'));
          serrerGalons(hote.querySelector('#fiche-galons'));
        });
        largeurs.observe(inv);
      }

      incliner(hote.querySelector('#fiche-scene'));

      hote.querySelector('#fiche-actions')?.addEventListener('click', (e) => {
        if (e.target.closest('[data-emmener]')) placer();
        else if (e.target.closest('[data-evoluer]:not([disabled])')) demander();
      });
    }

    /* **Toucher, c'est regarder — et choisir.** Un âge se montre sur la
       carte (et les tenues et les états suivent son âge) ; une tenue ou une
       expression possédées se posent sur le personnage. On n'enregistre pas :
       c'est un essayage, ME MONTRER AINSI est le seul geste qui parle au
       serveur. Les effets se regardent, ils ne se portent pas. */
    function toucher(cle) {
      choisie = cle;
      const x = pieces.find((y) => y.cle === cle);
      if (x?.rang === 'ÂGES') {
        const s = Number(x.age.stage);
        /* Un âge atteint entre dans le choix ; un âge à venir se regarde
           seulement — on ne se montre pas dans un âge qu'on n'a pas payé. */
        if (x.ok && voulu) voulu.stade = s;
        ageVu = s;
      } else if (x?.ok && voulu && x.rang === 'TENUES') {
        voulu.stade = vu(); voulu.skin = x.id;
      } else if (x?.ok && voulu && x.rang === 'ÉTATS') {
        voulu.stade = vu(); voulu.etat = x.id;
      }
      peindre();
    }

    function crier() {
      window.FX?.cri?.(criVu() || 'CRI', { couleur: famille(d.fanzzy.type).c });
    }

    /* **La carte se retourne** : le dos de sa série, construit au premier
       retournement (`TBF_CARTES.retourner`). Sans mouvement, elle change de
       face sans tourner — c'est la carte qui en décide. */
    function tourner() {
      const fz = hote.querySelector('#fiche-art .fz');
      if (!fz?.classList.contains('fz-flip') || !window.TBF_CARTES?.retourner) return;
      const dos = window.TBF_CARTES.retourner(fz);
      hote.querySelector('[data-tourner]')?.setAttribute('aria-pressed', String(dos));
    }

    /* **L'inclinaison au doigt**, celle de la vitrine de la collection, à
       l'identique : `--rx`, `--ry` et le lustre (`--lx`, `--ly`) sur la
       scène, `.touche` tant qu'on la tient ; le reflet de l'holo épique suit
       (`--mx`, `--my`, lus par la carte). Sans mouvement, la carte reste une
       image. Un toucher bref, sans glisser, la retourne. */
    function incliner(scene) {
      if (!scene) return;
      let depart = null;
      scene.addEventListener('pointerdown', (e) => { depart = { x: e.clientX, y: e.clientY }; });
      scene.addEventListener('click', (e) => {
        if (!depart || !e.target.closest('.fz')) return;
        if (Math.hypot(e.clientX - depart.x, e.clientY - depart.y) < 8) tourner();
      });
      if (doux()) return;
      const suivre = (e) => {
        const r = scene.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        scene.classList.add('touche');
        scene.style.setProperty('--ry', `${(x * 17).toFixed(2)}deg`);
        scene.style.setProperty('--rx', `${(-y * 17).toFixed(2)}deg`);
        scene.style.setProperty('--lx', `${((x + 0.5) * 100).toFixed(1)}%`);
        scene.style.setProperty('--ly', `${((y + 0.5) * 100).toFixed(1)}%`);
        const fz = scene.querySelector('.fz');
        fz?.style.setProperty('--mx', `${((x + 0.5) * 100).toFixed(1)}%`);
        fz?.style.setProperty('--my', `${((y + 0.5) * 100).toFixed(1)}%`);
      };
      const reposer = () => {
        scene.classList.remove('touche');
        scene.style.setProperty('--ry', '0deg');
        scene.style.setProperty('--rx', '0deg');
      };
      scene.addEventListener('pointermove', suivre);
      scene.addEventListener('pointerleave', reposer);
      scene.addEventListener('pointercancel', reposer);
      scene.addEventListener('pointerup', reposer);
    }

    /* **Le personnage, son âge et ce qu'il montre, en un seul envoi.** Le
       serveur les pose ensemble et refuse d'un seul bloc. */
    async function montrer(b) {
      b.disabled = true;
      try {
        const r = await fetch('/api/me/avatar', {
          method: 'POST', credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            fanzzyId: d.fanzzy.id,
            stade: Number(b.dataset.stade) || undefined,
            skinId: b.dataset.skin || undefined,
            etat: b.dataset.etat || undefined,
          }),
        });
        if (!r.ok) throw new Error('refus');
        /* On nomme ce qui vient de changer : le changement se voit sur un
           autre écran. Un éclair de la couleur de la famille, et le tampon
           TON AVATAR qui claque à la place de la bâche. */
        window.FX?.flash?.(famille(d.fanzzy.type).c);
        dire('C’est lui qu’on verra partout.');
        claquerAvatar = true;
        await recharger();
        /* L'avatar a changé : la barre du jeu le relit (son portrait). */
        window.dispatchEvent(new Event('tbf:bourse'));
      } catch {
        b.disabled = false;
        dire('Impossible pour le moment.', { erreur: true });
      }
    }

    /**
     * Emmener ce Fanzzy en duel, à une place qu'on choisit.
     *
     * Le bouton pose le personnage dans la tribune du deck, et il demande
     * **où** : le titulaire entre au coup d'envoi, les remplaçants attendent
     * la carte Changement. Une place occupée est un personnage qu'on
     * remplace : le lui dire avant, c'est une décision ; après, une perte
     * découverte trois écrans plus loin.
     */
    function placer() {
      const nom = d.fanzzy.nom;
      const t = d.tribune;
      if (!t?.places?.length) { dire('La tribune n’est pas accessible.', { erreur: true }); return; }

      const ici = siege(d);
      let voulue = ici >= 0 ? null : (t.places.find((p) => p.ouverte)?.place ?? null);
      const choix = t.places.map((p) => {
        const moi = p.occupant?.id === d.fanzzy.id;
        const bloque = !p.ouverte && !moi;
        return `<button type="button" class="place ${moi ? 'moi' : ''}"
            data-place="${p.place}" ${bloque ? 'disabled' : ''}>
          <span class="role">${p.role === 'titulaire' ? 'TITULAIRE' : `REMPLAÇANT ${p.place}`}</span>
          <span class="qui">${moi ? 'il y est déjà'
            : p.occupant ? `${esc(p.occupant.nom)} sort`
              : bloque ? 'remplis la place d’avant' : 'libre'}</span>
          <span class="quand">${p.role === 'titulaire'
            ? 'entre au coup d’envoi' : 'entre sur une carte Changement'}</span>
        </button>`;
      }).join('');

      window.TBF_DIALOGUE?.confirmer({
        titre: ici >= 0 ? 'CHANGER DE PLACE ?' : `${nom.toUpperCase()} EN DUEL ?`,
        texte: 'Le titulaire entre au coup d’envoi. Les remplaçants attendent '
          + 'qu’une carte Changement les fasse entrer.',
        corps: `<div class="tbf-dial-places">${choix}</div>`,
        oui: 'PLACER',
        ton: 'vert',
        /* Le bouton de confirmation n'ouvre rien tant qu'aucune place n'est
           choisie — sauf pour qui n'est encore nulle part : la première place
           libre est alors une proposition, pas un choix imposé. */
        apres: (boite) => {
          const oui = boite.querySelector('[data-oui]');
          const peindrePlaces = () => {
            boite.querySelectorAll('.place').forEach((b) =>
              b.classList.toggle('on', Number(b.dataset.place) === voulue));
            oui.disabled = voulue === null;
          };
          boite.querySelector('.tbf-dial-places').addEventListener('click', (e) => {
            const b = e.target.closest('[data-place]');
            if (!b || b.disabled) return;
            voulue = Number(b.dataset.place);
            peindrePlaces();
          });
          peindrePlaces();
        },
        surOui: async () => {
          if (voulue === null) return false;
          try {
            const r = await fetch('/api/deck/placer', {
              method: 'POST', credentials: 'same-origin',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ id: d.fanzzy.id, place: voulue }),
            });
            const j = await r.json().catch(() => ({}));
            if (j.error) throw Object.assign(new Error(j.error), { code: j.error });
          } catch (e) {
            dire(e.code === 'deck.error.fanzzy_not_owned'
              ? 'Il n’est pas encore à toi.'
              : e.code === 'deck.error.place_vide_avant'
                ? 'Remplis d’abord la place précédente.'
                : 'Impossible pour le moment.', { erreur: true });
            return false;
          }
          dire(voulue === 0 ? `${nom} est titulaire.` : `${nom} entre en remplaçant ${voulue}.`);
          window.FX?.flash?.('#1E9E6A');
          await recharger();
          return true;
        },
      });
    }

    /**
     * La confirmation d'évolution : **ce qu'on gagne, avant de payer**. Les
     * deux cartes — celle d'aujourd'hui, et celle qui vient, au secret : c'est
     * la cérémonie qui la révèle —, et les chiffres sur une fiche kraft. Un
     * « es-tu sûr ? » auquel personne ne peut répondre autrement qu'au hasard
     * n'est pas une confirmation.
     */
    function demander() {
      const ev = pieces.find((x) => x.evoluer)?.evoluer;
      const vers = ev?.vers;
      if (!vers || !ev.payable || hote.querySelector('.demande')) return;
      const C = window.TBF_CARTES;
      const ici = ageDe(d.stade);
      const carte = (a, opt) => (C?.cardHTML ? C.cardHTML({ id: a.id, nom: a.nom, type: d.fanzzy.type,
        set: d.fanzzy.set, stage: Number(a.stage), rar: rareteDe(a.rar), cri: a.cri, mods: a.mods },
      { mini: true, ...opt }) : '');

      /* Un effet que l'âge d'avant n'avait pas n'a **pas de valeur d'avant** :
         la ligne dit sa valeur seule, au lieu d'un tiret qui se lirait comme
         une perte. */
      const avant = new Map(lireMods(ici?.mods).map(([n, v]) => [n, v]));
      const lignes = [];
      const p1 = Number(ici?.cri?.power);
      const p2 = Number(vers.cri?.power);
      if (Number.isFinite(p2) && p2 > 0 && p2 !== p1) {
        lignes.push(ligne('Poussée du cri', Number.isFinite(p1) && p1 > 0 ? `${p1} → ${p2}` : String(p2),
          `<span class="tbf-detail-deux">${Number.isFinite(p1) && p1 > 0 ? jauge(p1) : ''}${jauge(p2)}</span>`));
      }
      for (const [n, v] of lireMods(vers.mods)) {
        if (avant.get(n) === v) continue;
        lignes.push(ligne(n, avant.has(n) ? `${avant.get(n)} → ${v}` : v));
      }
      if (vers.cri?.label && vers.cri.label !== ici?.cri?.label) lignes.push(ligne('Son cri', vers.cri.label));

      const panneau = document.createElement('div');
      panneau.className = 'demande';
      panneau.setAttribute('role', 'dialog');
      panneau.setAttribute('aria-modal', 'true');
      panneau.setAttribute('aria-label', `Passer à l’âge ${vers.stage}`);
      panneau.innerHTML = `
        <h3>PASSER À L’ÂGE ${esc(String(vers.stage))} ?</h3>
        <div class="duo"><div>${ici ? carte(ici, {}) : ''}</div>${SVG.fleche}<div>${carte(vers, { secret: true })}</div></div>
        ${lignes.length ? `<div class="tbf-ticket tbf-detail"><div class="tbf-detail-t"><b>Ce qu’il gagne</b><small>${
          ev.cout} écharpes</small></div>${lignes.join('')}</div>` : ''}
        <div class="quoi">
          <button type="button" class="bt tbf-plaque" data-non>ANNULER</button>
          <button type="button" class="bt or tbf-plaque" data-ton="or" data-oui>ÉVOLUER<small>${
            Number(d.echarpes)} → ${Number(d.echarpes) - ev.cout} écharpes</small></button>
        </div>`;
      hote.querySelector('.fiche').appendChild(panneau);
      panneau.querySelector('[data-oui]').focus({ preventScroll: true });

      const fermer = () => panneau.remove();
      panneau.querySelector('[data-non]').onclick = fermer;
      panneau.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); fermer(); } });
      panneau.querySelector('[data-oui]').onclick = async () => {
        /* Une seule fois : les deux boutons s'éteignent avant l'envoi. */
        panneau.querySelectorAll('button').forEach((b) => { b.disabled = true; });
        const soldeAvant = Number(d.echarpes);
        let reponse = null;
        try {
          reponse = await api('/evolve', { id: d.fanzzy.id });
        } catch (e) {
          fermer();
          dire(e.code === 'fanzzy.error.not_enough_scarves'
            ? 'Pas assez d’écharpes.' : 'Évolution impossible.', { erreur: true });
          return;
        }
        fermer();
        await ceremonie(vers, ev.cout, soldeAvant, reponse?.wallet ?? null);
      };
    }

    /* ------------------------------------------ la cérémonie

       **Le geste le plus cher du jeu ne passe pas sans rien.** `FX.evolution`
       tient le rythme — la charge, le flash, l'onde — et rend la main **au
       moment du flash**, pendant que le blanc couvre l'image : c'est là qu'on
       recharge. Sa couleur est celle de la rareté d'arrivée, parce que c'est
       elle qu'on achète. Puis la nouvelle carte arrive, son tampon d'âge
       claque, le ticket de la dépense monte, et le solde décompte. */
    async function ceremonie(vers, cout, soldeAvant, portefeuille) {
      const portrait = hote.querySelector('#fiche-art .illu');
      const suite = window.FX?.evolution
        ? await window.FX.evolution(portrait, { nom: vers.nom, rar: vers.rar }) : null;

      /* **Et c'est le nouveau qui arrive** : on regarde l'âge qu'on vient
         d'acheter, dans sa tenue de base et au repos. L'avatar, lui, ne bouge
         pas tout seul — ME MONTRER AINSI est là pour ça. */
      ageVu = Number(vers.stage);
      voulu = { stade: Number(vers.stage), skin: 'base', etat: 'neutre' };
      choisie = null;
      await recharger();
      /* La fiche relue porte déjà le nouveau solde : il reste affiché à
         l'ancien jusqu'au décompte, sinon il descendrait d'un bloc, puis
         remonterait pour décompter. */
      const solde = hote.querySelector('#fiche-solde');
      const b = solde?.querySelector('b');
      if (b && Number.isFinite(soldeAvant)) b.textContent = String(soldeAvant);

      /* Le dessin arrive par le réseau : on l'attend brièvement plutôt que de
         jouer l'arrivée sur une image vide, et on renonce au bout d'une
         seconde et demie — une cérémonie qui n'arrive jamais est pire qu'une
         cérémonie écourtée. */
      const attendre = async () => {
        for (let i = 0; i < 30; i++) {
          const n = hote.querySelector('#fiche-art .illu');
          if (n?.complete && n.naturalWidth) return n;
          await new Promise((r) => setTimeout(r, 50));
        }
        return hote.querySelector('#fiche-art .illu');
      };
      if (suite) suite.arrivee(await attendre());
      else dire(`${vers.nom} — il a grandi.`);

      /* Le tampon ÉVO qui claque sur la carte : celui que la carte porte
         déjà, rejoué (`.tbf-clac`, retiré à la fin — une classe oubliée
         empêcherait la suivante de partir). */
      const age = hote.querySelector('#fiche-art .fz .age');
      if (age) {
        age.classList.add('tbf-clac');
        age.style.setProperty('--d', '420ms');
        age.addEventListener('animationend', () => { age.classList.remove('tbf-clac'); age.style.removeProperty('--d'); },
          { once: true });
      }
      /* La dépense sur son ticket, et le solde qui décompte sous les yeux
         (`FX.compter`) : de ce qu'on avait à ce qu'il reste. */
      if (cout) ticket(`−${cout}`, 'écharpes', `${vers.nom} a grandi`);
      if (b && Number.isFinite(soldeAvant) && window.FX?.compter && solde.isConnected) {
        solde.classList.remove('tbf-vibre');
        void solde.offsetWidth;
        solde.classList.add('tbf-vibre');
        solde.addEventListener('animationend', () => solde.classList.remove('tbf-vibre'), { once: true });
        window.FX.compter(b, soldeAvant, Number(d.echarpes), { ms: 900 });
      } else if (b) b.textContent = String(Number(d.echarpes));
      /* **Et la barre du jeu l'apprend** : une page qui change le
         portefeuille sans l'annoncer laisse le compteur du HUD en retard
         (nav.js, `tbf:bourse`). On relaie ce que le serveur a rendu ; le HUD
         fait compter le sien. */
      if (portefeuille) window.dispatchEvent(new CustomEvent('tbf:bourse', { detail: { wallet: portefeuille } }));
    }

    /** Relit la fiche après une action, et prévient la page qui l'accueille. */
    async function recharger() {
      try { d = await api('/fiche/' + encodeURIComponent(idDemande)); }
      catch { return; }
      rendre();
      opts.change?.();
    }

    rendre();
    /* Le nom et les galons se mesurent en Oswald : si la police arrive après
       le premier rendu, la largeur de la colonne ne bouge pas et rien ne les
       remesurerait. Une fois, quand elle est là. */
    document.fonts?.ready?.then(() => {
      if (!hote.isConnected) return;
      ajusterNom(hote.querySelector('#fiche-nom') ?? document.createElement('span'));
      serrerGalons(hote.querySelector('#fiche-galons'));
    });
    return true;
  }

  window.TBF_FICHE = { ouvrir };
})();
