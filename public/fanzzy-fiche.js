/**
 * La fiche d'un Fanzzy : ce qu'il est, ce qu'il devient, ce qu'il porte.
 *
 * ## Pourquoi elle vit ici et non dans une page
 *
 * Il y avait **deux fiches** pour la même carte : un aperçu en surimpression
 * dans le classeur, et une page complète ailleurs. Deux rendus, deux
 * vocabulaires, et déjà deux contenus différents — l'aperçu ne montrait ni les
 * tenues ni l'équipement. Toucher une carte ouvrait le premier, un lien au bas
 * du premier menait au second, et le classeur disparaissait en chemin.
 *
 * Il n'y en a plus qu'une, montée à deux endroits : **en panneau** par-dessus
 * le classeur — la grille reste derrière, la croix referme, rien ne recharge —
 * et **en page** quand on arrive par un lien. Le même code, donc le même
 * écran, pour toujours.
 *
 * ## Ce que la mise en page défend
 *
 * Le personnage tient le haut. En dessous, **des cases** : ses âges, ses
 * tenues, ses effets. Celles qu'on n'a pas portent un cadenas et disent ce
 * qu'elles demandent — la différence entre « il me manque des choses » et « il
 * me manque *ça*, et voilà comment l'avoir ». Toucher une case écrit son
 * détail juste dessous, dans un bloc de hauteur fixe pour que rien ne saute.
 *
 * ## Évoluer se confirme
 *
 * Quatre-vingt-dix écharpes, c'est neuf boosters. La fiche montre donc ce
 * qu'on gagne, ligne à ligne, avant de les prendre. Un « es-tu sûr ? » auquel
 * personne ne peut répondre autrement qu'au hasard n'est pas une confirmation.
 *
 * Script classique, pas module : tout ce qui vit dans `public/` est chargé par
 * une balise `<script src>` ordinaire.
 */
(() => {
  const esc = (s) => String(s ?? '').replace(/[<>&"]/g,
    (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

  const COUL = { voix: '#F5C33B', perc: '#3C82E8', tifo: '#8257DA',
                 pyro: '#E0402C', depl: '#1E9E6A', fide: '#C2CAD6' };
  const NOMTYPE = { voix: 'Voix', perc: 'Percussion', tifo: 'Tifo',
                    pyro: 'Pyro', depl: 'Déplacement', fide: 'Fidélité' };
  const NOMRAR = { commune: 'Commune', rare: 'Rare', epique: 'Épique',
                   legendaire: 'Légendaire' };

  const api = async (chemin, corps, methode) => {
    const r = await fetch('/api/fanzzy' + chemin, {
      method: methode ?? (corps === undefined ? 'GET' : 'POST'),
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: corps === undefined ? undefined : JSON.stringify(corps),
    });
    if (r.status === 401) { location.href = '/compte'; throw new Error('auth'); }
    const j = await r.json().catch(() => ({}));
    if (j.error) throw Object.assign(new Error(j.error), { code: j.error });
    return j;
  };

  /** Un mot au joueur. Une seule implémentation, posée sur le corps du document. */
  function dire(texte) {
    let n = document.getElementById('tbf-mot');
    if (!n) {
      n = document.createElement('div');
      n.id = 'tbf-mot';
      n.style.cssText = 'position:fixed;left:50%;bottom:96px;transform:translateX(-50%);'
        + 'background:#171C23;border:1px solid rgba(242,238,228,.2);border-radius:9px;'
        + 'padding:11px 16px;font-size:12.5px;z-index:120;max-width:86%;text-align:center;'
        + 'line-height:1.5;display:none';
      document.body.appendChild(n);
    }
    n.textContent = texte;
    n.style.display = 'block';
    clearTimeout(n._t);
    n._t = setTimeout(() => { n.style.display = 'none'; }, 2800);
  }

  /**
   * Les effets, en français.
   *
   * On traduit les modificateurs plutôt que de montrer du JSON : `tempoWindow`
   * ne dit rien à personne, « fenêtre du tempo, +20 % » se lit.
   */
  function lireMods(m = {}) {
    const out = [];
    const pct = (v) => `${v > 1 ? '+' : ''}${Math.round((v - 1) * 100)} %`;
    if (m.tempoWindow) out.push(['Fenêtre du tempo', pct(m.tempoWindow), 'tempo']);
    if (m.tempoInterval) {
      out.push(['Cadence', `${m.tempoInterval > 0 ? '+' : ''}${Math.round(m.tempoInterval)} ms`, 'tempo']);
    }
    if (m.mashTime) out.push(['Durée du martelage', `${Math.round(m.mashTime / 100) / 10} s`, 'poing']);
    if (m.mashBonus) out.push(['Martelage', pct(m.mashBonus), 'poing']);
    if (m.holdBonus) out.push(['Endurance', pct(m.holdBonus), 'coeur']);
    if (m.holdForgive) out.push(['Relâchements permis', String(m.holdForgive), 'coeur']);
    if (m.perfectBonus) out.push(['Geste parfait', `×${m.perfectBonus.toFixed(2)}`, 'etoile']);
    if (m.backfire) out.push(['Geste raté', 'se retourne contre toi', 'alerte']);
    if (m.parryBonus) out.push(['Contre', pct(m.parryBonus), 'bouclier']);
    if (m.breathBonus) out.push(['Souffle', pct(m.breathBonus), 'souffle']);
    if (m.refundBonus) out.push(['Reprise', `×${m.refundBonus.toFixed(2)}`, 'reprise']);
    return out;
  }

  /** Les pictogrammes des cases. Des traits, pas des émojis : ils se teintent. */
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
    age: 'M12 3l2.6 5.6L21 9.5l-4.5 4.3 1.1 6.2L12 17l-5.6 3 1.1-6.2L3 9.5l6.4-.9z',
  };
  const trait = (cle) => `<svg viewBox="0 0 24 24"><path d="${TRAITS[cle] ?? TRAITS.etoile}"/></svg>`;

  /** Les losanges de rareté, comme sur les cartes. */
  const marque = (r) => (r === 'legendaire' ? '<b>♛</b>'
    : '<i></i>'.repeat({ commune: 1, rare: 2, epique: 3 }[r] ?? 1));

  /**
   * Monte la fiche dans `hote` et la tient à jour.
   *
   * @param {HTMLElement} hote
   * @param {string} idDemande  l'identifiant du personnage, ou d'un de ses âges
   * @param {object} [opts]
   * @param {Function} [opts.fermer]  appelée par la croix. Sans elle, la fiche
   *   affiche une flèche qui ramène au classeur — c'est le cas de la page.
   * @param {Function} [opts.change]  appelée après une action qui modifie la
   *   collection : la page qui accueille la fiche doit pouvoir se rafraîchir.
   * @returns {Promise<boolean>} faux si ce Fanzzy n'existe pas.
   */
  async function ouvrir(hote, idDemande, opts = {}) {
    let d = null;
    let choisie = null;          // la case regardée
    let cases = [];

    try {
      d = await api('/fiche/' + encodeURIComponent(idDemande));
    } catch (e) {
      if (e.message === 'auth') return false;
      hote.innerHTML = `<div class="fiche"><div class="vide">Ce Fanzzy est introuvable.<br>
        <a href="/fanzzy">retour au classeur</a></div></div>`;
      return false;
    }

    /* ------------------------------------------------------------ les cases */

    /**
     * Ce qu'on peut regarder, rangé en trois rangées.
     *
     * Une case verrouillée n'est pas absente : elle porte un cadenas et dit ce
     * qu'elle demande. C'est elle qui donne envie de continuer, et l'effacer
     * reviendrait à cacher le jeu qui reste à jouer.
     */
    function batir() {
      const f = d.fanzzy;
      const c = COUL[f.type] ?? '#F5C33B';
      const liste = [];

      // Les âges. Le premier est acquis dès qu'on possède le personnage ; les
      // suivants s'achètent, et le prix est la seule chose qu'on veut lire.
      for (const a of d.lignee) {
        const atteint = a.possede;
        liste.push({
          cle: `age:${a.id}`, rang: 'ÂGES', titre: a.nom,
          sorte: atteint ? (a.stage === d.stade ? 'Âge actuel' : 'Âge atteint') : 'Âge à venir',
          ok: atteint, couleur: c,
          image: window.FZART?.adresse?.(a.id, 'buste') ?? null,
          texte: atteint
            ? (a.stage === d.stade ? 'C’est lui que tu joues aujourd’hui.'
              : 'Tu es passé par là.')
            : 'Il garde son cri et ses effets — en plus fort.',
          manque: atteint ? null : `${a.cout} écharpes`,
          // Évoluer ne se propose que pour **l'âge juste après** le sien : on
          // ne saute pas un étage, et le serveur le refuserait de toute façon.
          action: !atteint && a.stage === d.stade + 1 && d.possede
            ? { quoi: 'evoluer', vers: a, libelle: 'ÉVOLUER', cout: `${a.cout} écharpes` }
            : null,
        });
      }

      // Les tenues de l'âge atteint. Le Capo n'hérite pas de la garde-robe du
      // gamin : c'est la règle, et la fiche doit la rendre évidente.
      for (const s of d.skins) {
        liste.push({
          cle: `tenue:${s.id}`, rang: 'TENUES', titre: s.nom,
          sorte: s.porte ? 'Tenue portée' : s.possede ? 'Tenue possédée' : 'Tenue à trouver',
          ok: s.possede, porte: s.porte, couleur: '#8257DA', icone: 'tenue',
          texte: s.possede
            ? 'Elle ne change rien au jeu : elle se voit, c’est tout.'
            : 'Elle se trouve dans les boosters, et seulement pour un Fanzzy que tu as déjà.',
          manque: s.possede ? null : 'à trouver dans un booster',
          action: s.possede && !s.porte
            ? { quoi: 'porter', tenue: s, libelle: 'PORTER' } : null,
        });
      }

      // Ce qu'il change. L'effet **réel** — celui du personnage combiné à
      // l'équipement porté — parce que c'est lui que le duel emploiera.
      const reel = lireMods(d.effetReel);
      const brut = lireMods(d.fanzzy.mods);
      for (const [nom, valeur, icone] of reel) {
        const dOrigine = brut.find(([n]) => n === nom);
        liste.push({
          cle: `effet:${nom}`, rang: 'EFFETS', titre: nom, sorte: valeur,
          ok: true, couleur: c, icone,
          texte: dOrigine
            ? (dOrigine[1] === valeur ? 'Il vient du Fanzzy lui-même.'
              : `Du Fanzzy (${dOrigine[1]}), modifié par ton équipement.`)
            : 'Il vient de ton équipement, pas du Fanzzy.',
          manque: null, action: null,
        });
      }

      return liste;
    }

    /* --------------------------------------------------------------- rendu */

    function rendre() {
      const f = d.fanzzy;
      const c = COUL[f.type] ?? '#F5C33B';
      cases = batir();
      if (!cases.some((x) => x.cle === choisie)) {
        // Par défaut, l'âge qu'il a aujourd'hui : c'est ce qu'on est venu voir.
        choisie = cases.find((x) => x.rang === 'ÂGES' && x.sorte === 'Âge actuel')?.cle
          ?? cases[0]?.cle ?? null;
      }
      /* L'ordre est celui de l'importance, pas celui du code : ce qu'il
         devient, ce qu'il change, puis ce qu'il porte. La bande défile
         horizontalement, et les tenues sont nombreuses — placées au milieu,
         elles repoussaient les effets hors de l'écran, où personne ne serait
         allé les chercher. Elles ferment donc la marche : ce sont les seules
         qui ne changent rien au jeu. */
      const rangs = ['ÂGES', 'EFFETS', 'TENUES']
        .map((r) => [r, cases.filter((x) => x.rang === r)])
        .filter(([, l]) => l.length);

      hote.innerHTML = `
        <div class="fiche">
          <div class="head">
            ${opts.fermer
              ? '<button class="rond" data-fermer aria-label="Fermer">✕</button>'
              : '<a class="rond" href="/fanzzy" aria-label="Retour au classeur">‹</a>'}
            <h1>${esc(f.nom)}<small>${NOMTYPE[f.type] ?? f.type} · ${NOMRAR[f.rar] ?? f.rar}</small></h1>
          </div>

          <div class="vitrine r-${esc(f.rar)}" style="--c:${c}">
            <div class="art" id="fiche-art"></div><div class="ombre"></div>
            <div class="rar">${marque(f.rar)}</div>
            ${d.equipe ? '<div class="tag">EN DUEL</div>' : ''}
            <div class="txt">
              <div class="pastilles">
                <span class="pastille" style="--c:${c}"><b>${NOMTYPE[f.type] ?? f.type}</b></span>
                <button class="pastille" data-cri style="cursor:pointer">
                  Cri : <b style="color:${c}">${esc(f.cri?.label ?? '—')}</b> ▸</button>
              </div>
              <h2>${esc(f.nom)}</h2>
              <div class="sous">${d.possede
                ? `${d.possede} exemplaire${d.possede > 1 ? 's' : ''} · étage ${d.stade}${
                  f.cri?.power ? ` · poussée ${f.cri.power}` : ''}`
                : 'pas encore dans ta collection'}</div>
            </div>
          </div>

          <div class="rangs">${rangs.map(([nom, l]) => `
            <div class="rang"><h4>${nom}</h4><div class="cases">${l.map(caseHTML).join('')}</div></div>`).join('')}
          </div>

          <div class="detail" id="fiche-detail"></div>
          <div class="actions" id="fiche-actions"></div>
        </div>`;

      dessiner(f);
      rendreDetail();
      rendreActions();
      brancher();
    }

    function caseHTML(x) {
      const dedans = x.image
        ? `<img src="${x.image}" alt="" onerror="this.remove()">`
        : trait(x.icone ?? 'age');
      return `<button class="case ${x.ok ? 'ok' : 'verrou'} ${x.cle === choisie ? 'choisie' : ''}"
        style="--cc:${x.couleur}" data-case="${esc(x.cle)}" title="${esc(x.titre)}">
        <span class="pav"></span>
        <span class="dedans">${dedans}</span>
        ${x.ok ? '' : '<span class="cadenas">🔒</span>'}
        ${x.porte ? '<span class="porte"></span>' : ''}
      </button>`;
    }

    /** Le détail de la case regardée. Hauteur fixe : rien ne saute. */
    function rendreDetail() {
      const x = cases.find((y) => y.cle === choisie);
      const n = hote.querySelector('#fiche-detail');
      if (!x) { n.innerHTML = ''; return; }
      n.innerHTML = `
        <div class="t">${esc(x.titre)}<em>${esc(x.sorte)}</em></div>
        <p>${esc(x.texte)}</p>
        ${x.manque ? `<span class="manque">🔒 ${esc(x.manque)}</span>` : ''}`;
    }

    /**
     * Les actions. Deux au plus, et toujours à la même place.
     *
     * La première est la seule qui compte — emmener ce Fanzzy en duel. La
     * seconde est celle de la case regardée : évoluer, porter une tenue. Elle
     * apparaît et disparaît, la première jamais.
     */
    function rendreActions() {
      const x = cases.find((y) => y.cle === choisie);
      const n = hote.querySelector('#fiche-actions');
      const principal = !d.possede
        ? '<button class="bt" disabled>PAS ENCORE À TOI<small>ouvre des boosters</small></button>'
        : d.equipe
          ? '<button class="bt" disabled>DÉJÀ EN DUEL</button>'
          : '<button class="bt primaire" data-emmener>EMMENER EN DUEL</button>';

      const second = x?.action?.quoi === 'evoluer'
        ? `<button class="bt or" data-evoluer>${x.action.libelle}<small>${esc(x.action.cout)}</small></button>`
        : x?.action?.quoi === 'porter'
          ? `<button class="bt" data-porter="${esc(x.action.tenue.id)}">${x.action.libelle}</button>`
          : '';
      n.innerHTML = principal + second;
    }

    /**
     * L'illustration de l'âge atteint.
     *
     * `ageId` et non `id` : le premier est la carte du catalogue, le second la
     * lignée. La fiche demandait le dessin sous le nom de la lignée — elle
     * montrait donc le Choriste sous le nom du Meneur de chant, ce qui
     * ressemble à un personnage parfaitement valide et ne se voit pas.
     */
    function dessiner(f) {
      const art = hote.querySelector('#fiche-art');
      const c = COUL[f.type] ?? '#F5C33B';
      art.style.background = `radial-gradient(75% 60% at 50% 75%, ${c}3A, transparent 70%), #0A0E13`;
      const adresse = window.FZART?.adresse?.(f.ageId ?? f.id, 'plein');
      if (!adresse) {
        // Pas d'illustration pour ce Fanzzy : le dessin géométrique, comme
        // dans la grille. Un halo seul ne dit pas de qui il s'agit.
        art.innerHTML = window.FZART?.artProcedural?.({ id: f.ageId ?? f.id, type: f.type,
          rar: f.rar, nom: f.nom }) ?? '';
        return;
      }
      const img = new Image();
      img.onload = () => { art.innerHTML = ''; art.appendChild(img); };
      // Trois formats à essayer dans l'ordre : un navigateur sans AVIF ne
      // signale rien, il n'affiche simplement pas l'image.
      const formats = ['.avif', '.webp', '.png'];
      let rang = 0;
      img.onerror = () => {
        if (++rang < formats.length) {
          img.src = adresse.replace(/\.(avif|webp|png)$/, formats[rang]);
        }
      };
      img.alt = '';
      img.src = adresse;
    }

    /* ------------------------------------------------------------- gestes */

    function brancher() {
      hote.querySelector('[data-fermer]')?.addEventListener('click', () => opts.fermer?.());

      hote.querySelector('[data-cri]')?.addEventListener('click', () =>
        window.FX?.cri?.(d.fanzzy.cri?.label ?? 'CRI',
          { couleur: COUL[d.fanzzy.type] ?? '#F5C33B' }));

      /* Un seul écouteur pour toutes les cases : elles sont refaites à chaque
         rendu, et rebrancher quinze boutons après chaque action finirait par
         en oublier un. */
      hote.querySelector('.rangs')?.addEventListener('click', (e) => {
        const b = e.target.closest('[data-case]');
        if (!b) return;
        choisie = b.dataset.case;
        hote.querySelectorAll('.case').forEach((n) =>
          n.classList.toggle('choisie', n.dataset.case === choisie));
        rendreDetail();
        rendreActions();
        brancherActions();
      });

      brancherActions();
    }

    function brancherActions() {
      const n = hote.querySelector('#fiche-actions');
      n.querySelector('[data-emmener]')?.addEventListener('click', async () => {
        try {
          await api('/active', { id: d.fanzzy.id });
          dire('Il entrera en duel.');
          await recharger();
        } catch { dire('Impossible pour le moment.'); }
      });

      n.querySelector('[data-porter]')?.addEventListener('click', async (e) => {
        const id = e.currentTarget.dataset.porter;
        try {
          await fetch('/api/me/skin', {
            method: 'POST', credentials: 'same-origin',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ fanzzyId: d.fanzzy.id, skinId: id }),
          });
          dire('Tenue portée.');
          await recharger();
        } catch { dire('Impossible pour le moment.'); }
      });

      n.querySelector('[data-evoluer]')?.addEventListener('click', () => demander());
    }

    /**
     * La confirmation d'évolution : ce qu'on gagne, avant de payer.
     *
     * On compare les effets ligne à ligne, et on montre les deux personnages.
     * C'est ce qui manquait : le bouton d'avant prenait quatre-vingt-dix
     * écharpes sur un simple appui, et le joueur découvrait après coup ce qu'il
     * avait acheté.
     */
    function demander() {
      const x = cases.find((y) => y.cle === choisie);
      const vers = x?.action?.vers;
      if (!vers) return;
      const avant = new Map(lireMods(d.fanzzy.mods).map(([n, v]) => [n, v]));
      const apres = lireMods(vers.mods);
      const lignes = apres.map(([n, v]) => ({ n, av: avant.get(n) ?? '—', ap: v }))
        .filter((l) => l.av !== l.ap);
      if (vers.cri?.label && vers.cri.label !== d.fanzzy.cri?.label) {
        lignes.push({ n: 'Cri', av: d.fanzzy.cri?.label ?? '—', ap: vers.cri.label });
      }

      const image = (id) => window.FZART?.adresse?.(id, 'buste') ?? '';
      const panneau = document.createElement('div');
      panneau.className = 'demande';
      panneau.innerHTML = `
        <h3>PASSER À L’ÉTAGE ${vers.stage} ?</h3>
        <div class="duo">
          <div class="qui"><img src="${image(d.fanzzy.ageId ?? d.fanzzy.id)}" alt=""
            onerror="this.remove()"><b>${esc(d.fanzzy.nom)}</b></div>
          <span class="fleche">›</span>
          <div class="qui apres"><img src="${image(vers.id)}" alt=""
            onerror="this.remove()"><b>${esc(vers.nom)}</b></div>
        </div>
        ${lignes.length ? `<div class="gains">${lignes.map((l) => `
          <div class="gain"><span class="n">${esc(l.n)}</span>
            <span class="av">${esc(l.av)}</span><span class="ap">${esc(l.ap)}</span></div>`).join('')}
        </div>` : ''}
        <div class="quoi">
          <button class="bt" data-non>ANNULER</button>
          <button class="bt or" data-oui>ÉVOLUER<small>${vers.cout} écharpes</small></button>
        </div>`;
      hote.querySelector('.fiche').appendChild(panneau);

      panneau.querySelector('[data-non]').onclick = () => panneau.remove();
      panneau.querySelector('[data-oui]').onclick = async () => {
        panneau.querySelectorAll('button').forEach((b) => { b.disabled = true; });
        try {
          await api('/evolve', { id: d.fanzzy.id });
          panneau.remove();
          dire(`${vers.nom} — il a grandi.`);
          window.FX?.flash?.('#F5C33B');
          await recharger();
        } catch (e) {
          panneau.remove();
          dire(e.code === 'fanzzy.error.not_enough_scarves'
            ? 'Pas assez d’écharpes.' : 'Évolution impossible.');
        }
      };
    }

    /** Relit la fiche après une action, et prévient la page qui l'accueille. */
    async function recharger() {
      try { d = await api('/fiche/' + encodeURIComponent(idDemande)); }
      catch { return; }
      rendre();
      opts.change?.();
    }

    rendre();
    return true;
  }

  window.TBF_FICHE = { ouvrir };
})();
