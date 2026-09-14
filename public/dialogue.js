/**
 * La boîte qui demande « es-tu sûr ? ».
 *
 * ## Pourquoi elle existe
 *
 * Il y avait trois façons de demander une confirmation dans ce jeu, et elles ne
 * se ressemblaient pas :
 *
 *   — **rien du tout** pour la plupart des choix. Se déconnecter, emmener un
 *     Fanzzy en duel, écraser un deck : un appui, c'était fait. Sur un
 *     téléphone, un appui se donne en rangeant l'appareil dans sa poche.
 *   — **`confirm()` du navigateur** pour quitter un KOP. Une boîte système,
 *     grise, en police système, qui dit « localhost:3000 indique » au-dessus du
 *     texte. Elle sort de l'univers du jeu à l'instant précis où l'on demande
 *     au joueur de s'engager.
 *   — **un panneau écrit à la main** pour l'évolution, riche et juste — il
 *     montre les deux personnages et ce qu'on gagne ligne à ligne — mais qui ne
 *     vivait que dans la fiche.
 *
 * Il n'y en a plus qu'une, et c'est la troisième qui a gagné : une confirmation
 * doit **montrer ce qu'on va perdre**, pas seulement demander deux fois. Un
 * « es-tu sûr ? » auquel personne ne peut répondre autrement qu'au hasard ne
 * protège de rien ; il apprend seulement à appuyer sur OUI sans lire.
 *
 * ## Ce qu'elle garantit
 *
 * **Le geste dangereux n'est jamais sous le pouce au repos.** Le bouton qui
 * confirme est à droite, celui qui annule à gauche, et c'est toujours dans cet
 * ordre. Échap et le fond ferment — en annulant, jamais en confirmant.
 *
 * **Le focus y entre et n'en sort pas.** Sans cela, un lecteur d'écran continue
 * de lire la page derrière, et la tabulation emmène sur des boutons qu'on ne
 * voit plus.
 *
 * **Elle rend une promesse**, pas un rappel :
 *
 *     if (await TBF_DIALOGUE.confirmer({ titre: 'SE DÉCONNECTER ?' })) …
 *
 * Script classique, pas module : comme tout ce qui vit dans `public/`.
 */
(() => {
  if (window.TBF_DIALOGUE) return;

  const esc = (s) => String(s ?? '').replace(/[<>&"]/g,
    (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

  /* Une seule boîte à la fois. Deux confirmations superposées, c'est un joueur
     qui répond à la mauvaise question — et celle du dessous reste ouverte,
     invisible, en attente d'un clic qu'elle ne recevra jamais. */
  let ouverte = null;

  /**
   * @param {object}  o
   * @param {string}  o.titre     La question, en capitales de banderole.
   * @param {string} [o.texte]    Ce qui se passe si l'on dit oui. C'est la
   *   partie qui compte : sans elle, la boîte ne fait que ralentir.
   * @param {string} [o.oui]      Le libellé du bouton qui confirme.
   * @param {string} [o.sousOui]  Le prix, la durée, ce qu'on y laisse.
   * @param {string} [o.non]      Le libellé du bouton qui annule.
   * @param {string} [o.ton]      `flare` pour ce qui détruit, `or` pour ce qui
   *   coûte, rien pour le reste. Le ton colore le bouton de confirmation, il ne
   *   change aucun comportement.
   * @param {string} [o.corps]    Du HTML déjà échappé, inséré entre le texte et
   *   les boutons — les deux personnages d'une évolution, les places d'un deck.
   * @param {Function} [o.apres]  Appelée avec `(boite, fermer)` une fois posée,
   *   pour brancher ce que `corps` contient.
   * @param {Function} [o.surOui] Ce qu'il y a à faire avant de fermer. La boîte
   *   reste ouverte, boutons éteints, tant que la promesse n'a pas abouti ; si
   *   elle rend `false` ou lève, la boîte se rouvre au geste.
   *
   *   Sans ce crochet, un appel réseau se ferait après la fermeture : la boîte
   *   disparaît, l'écran revient, et l'échec arrive une seconde plus tard sur
   *   une page qui a déjà tourné la page. Le joueur croit que c'est passé.
   * @returns {Promise<boolean>}  Vrai si le joueur a confirmé.
   */
  function confirmer(o = {}) {
    ouverte?.fermer(false);

    return new Promise((resoudre) => {
      const fond = document.createElement('div');
      fond.className = 'tbf-dial-fond';
      fond.innerHTML = `
        <div class="tbf-dial" role="alertdialog" aria-modal="true"
             aria-labelledby="tbf-dial-t" ${o.texte ? 'aria-describedby="tbf-dial-p"' : ''}>
          <h3 id="tbf-dial-t">${esc(o.titre ?? 'ES-TU SÛR ?')}</h3>
          ${o.texte ? `<p id="tbf-dial-p">${esc(o.texte)}</p>` : ''}
          ${o.corps ?? ''}
          <div class="tbf-dial-quoi">
            <button type="button" class="tbf-dial-bt" data-non>${esc(o.non ?? 'ANNULER')}</button>
            <button type="button" class="tbf-dial-bt oui" data-ton="${esc(o.ton ?? '')}" data-oui>
              ${esc(o.oui ?? 'CONFIRMER')}
              ${o.sousOui ? `<small>${esc(o.sousOui)}</small>` : ''}
            </button>
          </div>
        </div>`;

      /* Le focus d'où l'on vient. Le rendre en fermant est ce qui permet de
         reprendre la page au clavier là où on l'avait laissée ; sans ça, la
         tabulation repart du haut du document. */
      const avant = document.activeElement;
      let fini = false;

      function fermer(reponse) {
        if (fini) return;
        fini = true;
        ouverte = null;
        document.removeEventListener('keydown', touche, true);
        fond.classList.remove('on');
        /* On attend la fin de la sortie avant de retirer : retirer tout de
           suite ferait disparaître la boîte d'un coup, ce qui se lit comme un
           bug plutôt que comme une réponse. */
        setTimeout(() => fond.remove(), 180);
        try { avant?.focus?.({ preventScroll: true }); } catch { /* parti */ }
        resoudre(Boolean(reponse));
      }

      function touche(e) {
        if (e.key === 'Escape') { e.preventDefault(); fermer(false); return; }
        if (e.key !== 'Tab') return;
        /* Le piège à focus. `:not([disabled])` : un bouton désactivé pendant
           l'envoi sortirait du cycle, et la tabulation s'échapperait derrière
           la boîte au moment le plus mal choisi. */
        const cibles = [...fond.querySelectorAll(
          'button:not([disabled]),[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')];
        if (!cibles.length) return;
        const premier = cibles[0];
        const dernier = cibles[cibles.length - 1];
        if (e.shiftKey && document.activeElement === premier) {
          e.preventDefault(); dernier.focus();
        } else if (!e.shiftKey && document.activeElement === dernier) {
          e.preventDefault(); premier.focus();
        }
      }

      // Le fond ferme, mais seulement le fond : un clic qui part sur la boîte
      // et finit dehors — une sélection de texte relâchée trop loin — ne doit
      // pas valoir annulation.
      fond.addEventListener('mousedown', (e) => { if (e.target === fond) fermer(false); });
      fond.querySelector('[data-non]').addEventListener('click', () => fermer(false));

      const btOui = fond.querySelector('[data-oui]');
      btOui.addEventListener('click', async () => {
        if (!o.surOui) { fermer(true); return; }
        /* Tout s'éteint pendant l'attente, y compris ANNULER : annuler une
           action déjà partie ne l'annule pas, ça ment. */
        const boutons = [...fond.querySelectorAll('button')];
        const etats = boutons.map((b) => b.disabled);
        boutons.forEach((b) => { b.disabled = true; });
        fond.classList.add('attend');
        try {
          if ((await o.surOui(fond.querySelector('.tbf-dial'))) === false) {
            boutons.forEach((b, i) => { b.disabled = etats[i]; });
            fond.classList.remove('attend');
            return;
          }
          fermer(true);
        } catch {
          boutons.forEach((b, i) => { b.disabled = etats[i]; });
          fond.classList.remove('attend');
        }
      });
      document.addEventListener('keydown', touche, true);

      document.body.appendChild(fond);
      o.apres?.(fond.querySelector('.tbf-dial'), fermer);

      /* Le focus va sur **ANNULER**. C'est le geste sans conséquence, et une
         entrée au clavier ou un double appui malheureux tombe donc sur celui
         qui ne casse rien. */
      requestAnimationFrame(() => {
        fond.classList.add('on');
        fond.querySelector('[data-non]')?.focus({ preventScroll: true });
      });

      ouverte = { fermer };
    });
  }

  window.TBF_DIALOGUE = { confirmer };
})();
