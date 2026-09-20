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
 * ## Pas d'image, pas de vidéo
 *
 * La rosette est un dessin en SVG, calculé ici. Une image serait un fichier de
 * plus à charger au moment précis où l'écran doit s'ouvrir sans attendre, et
 * une vidéo pèserait cent fois ce que pèse ce fichier. Le jeu a déjà tout le
 * vocabulaire qu'il faut — l'onde, les particules, le flash, la secousse — et
 * s'en sert pour le but, l'évolution et le Cri. Une fête de plus doit se
 * reconnaître comme une fête de cette maison.
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

  /* La rosette. Un ruban et une étoile, dessinés — voir l'en-tête pour
     pourquoi ce n'est pas une image. `currentColor` partout : elle se teinte
     avec le panneau, et il n'y a qu'un endroit où changer la couleur. */
  const ROSETTE = `<svg class="tbf-niv-rosette" viewBox="0 0 64 64" aria-hidden="true">
    <g fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round">
      <path d="M24 38 L18 60 L32 53 L46 60 L40 38"/>
      <circle cx="32" cy="24" r="19"/>
      <circle cx="32" cy="24" r="13.5" stroke-opacity=".5"/>
      <path d="M32 13 l3.2 6.9 7.5.9 -5.6 5.2 1.5 7.5 -6.6-3.8 -6.6 3.8 1.5-7.5 -5.6-5.2 7.5-.9z"
            fill="currentColor" stroke="none"/>
    </g>
  </svg>`;

  /**
   * Annonce une montée.
   *
   * @param {object} m  ce que rend `niveau.gagner()` côté serveur :
   *   `{ avant, niveau, monte, paliers, ecarpes }`.
   * @returns {Promise<void>} résolue quand le joueur a repris la main. Une
   *   montée absente résout tout de suite : l'appelant n'a donc jamais à
   *   se demander s'il doit appeler — il appelle, et il attend.
   */
  function feter(m) {
    if (!m?.monte) return Promise.resolve();

    const paliers = (m.paliers ?? []).flatMap(nommer);
    const ecarpes = Number(m.ecarpes ?? 0);
    /* Plus d'un niveau d'un coup, ça arrive : une grosse victoire après une
       série de boosters. On le dit plutôt que d'afficher le dernier tout seul,
       sans quoi le joueur croit en avoir manqué un. */
    const bonds = Math.max(1, Number(m.niveau) - Number(m.avant ?? m.niveau));

    const fond = document.createElement('div');
    fond.className = 'tbf-niv-fond';
    fond.innerHTML = `
      <div class="tbf-niv" role="alertdialog" aria-modal="true"
           aria-labelledby="tbf-niv-t">
        ${ROSETTE}
        <div class="tbf-niv-quoi">${bonds > 1 ? `${bonds} NIVEAUX D’UN COUP` : 'TU MONTES'}</div>
        <div class="tbf-niv-n" id="tbf-niv-t">
          <span>NIVEAU</span><b>${esc(m.niveau)}</b>
        </div>
        ${bonds > 1 ? `<div class="tbf-niv-de">tu étais au niveau ${esc(m.avant)}</div>` : ''}
        <div class="tbf-niv-gains">
          ${ecarpes ? `<div class="g"><b>+${esc(ecarpes)}</b><span>ÉCHARPES</span></div>` : ''}
          ${paliers.length
            ? `<div class="tbf-niv-ouvre">CE QUE ÇA T’OUVRE</div>`
              + paliers.map((p) => `<div class="g ouvre">
                  <b>${esc(p.quoi)}</b><span>${esc(p.sous)}</span></div>`).join('')
            /* Un palier sur cinq ouvre quelque chose. Les autres montées ne
               doivent pas se terminer sur un blanc : elles rapportent des
               écharpes, et c'est déjà une raison de sourire. */
            : `<div class="tbf-niv-rien">Ce palier n’ouvre rien de neuf —
                 le prochain, si.</div>`}
        </div>
        <button type="button" class="tbf-niv-bt" data-fermer>CONTINUER</button>
      </div>`;

    document.body.appendChild(fond);
    requestAnimationFrame(() => fond.classList.add('on'));

    /* La fête, avec le vocabulaire de la maison. `FX` est chargé en différé sur
       plusieurs pages : tout est optionnel, et une montée sans effets reste une
       montée qui s'annonce. */
    const F = window.FX;
    const x = innerWidth / 2;
    const y = innerHeight * 0.38;
    F?.flash?.('#FFF3D0');
    F?.secousse?.(1.1);
    F?.onde?.({ x, y, couleur: F.couleurs?.or, taille: 520 });
    F?.particules?.({ x, y, n: 64, distance: 250, taille: 6, duree: 1250,
      couleurs: [F.couleurs?.or, F.couleurs?.feu, '#FFF3D0'] });
    F?.son?.('but');
    try { navigator.vibrate?.([30, 50, 30, 50, 110]); } catch { /* pas de moteur */ }

    return new Promise((resoudre) => {
      const avant = document.activeElement;
      let fini = false;
      const fermer = () => {
        if (fini) return;
        fini = true;
        document.removeEventListener('keydown', touche, true);
        fond.classList.remove('on');
        // On laisse la sortie se jouer : retirer d'un coup se lit comme un bug.
        setTimeout(() => fond.remove(), 200);
        try { avant?.focus?.({ preventScroll: true }); } catch { /* parti */ }
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

  window.TBF_NIVEAU = { feter, nommer };
})();
