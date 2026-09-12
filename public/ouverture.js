/**
 * L'écran d'ouverture : l'éventail de Fanzzy, et le moment où il s'en va.
 *
 * ## Ce qu'il fait, et ce qu'il ne fait pas
 *
 * Le cadre est déjà dans la page — fond, titre, jauge — et il est visible
 * avant qu'une seule ligne d'ici ne tourne. Ce fichier n'ajoute que deux
 * choses : les visages, et la sortie.
 *
 * ## La sortie, qui est la partie qui compte
 *
 * L'écran part à la **première** des deux conditions : l'accueil dit qu'il est
 * prêt, ou le temps est écoulé. Le second n'est pas une précaution ajoutée
 * après coup, c'est la règle principale — un écran d'ouverture qui attend le
 * serveur devient un écran d'attente le jour où le serveur est lent, et c'est
 * exactement le jour où il ne faut pas retenir les gens dehors.
 *
 * Il part aussi au premier geste : quelqu'un qui touche l'écran a fini de
 * regarder.
 *
 * Script classique, pas module : comme tout ce qui vit dans `public/`.
 */
(() => {
  const ecran = document.getElementById('ouverture');
  if (!ecran) return;

  /* Une fois par session, et pas une fois par visite.
   *
   * L accueil est l écran vers lequel tout revient : le menu y mène, la
   * flèche de retour y mène, la fin d un duel y ramène. Rejouer l ouverture à
   * chaque fois, c est deux secondes de tribune en fusion entre deux parties,
   * et un premier geste avalé à chaque fois — car l écran couvre la page, y
   * compris le bouton qu on visait.
   *
   * sessionStorage et non localStorage : rouvrir l application doit la
   * rouvrir, pas continuer une session d avant-hier. Il peut refuser
   * d écrire — navigation privée, réglage du navigateur — et le pire cas est
   * exactement ce qu on avait : l écran reparaît. */
  const CLE = 'tbf.ouverture';
  try {
    if (sessionStorage.getItem(CLE)) { ecran.remove(); return; }
    sessionStorage.setItem(CLE, '1');
  } catch { /* stockage refusé : on la montre, c est tout */ }

  /* Combien de temps, au plus. Assez pour que l'éventail se déploie et que le
     nom se lise — c'est une ouverture, pas une révérence. */
  const AU_PLUS = 1800;
  /* Et au moins, une fois lancé : sans ce plancher, un accueil déjà en cache
     fait clignoter l'écran, ce qui est pire que de ne pas l'avoir. */
  const AU_MOINS = 600;

  const depart = performance.now();
  let parti = false;

  function partir() {
    if (parti) return;
    parti = true;
    const reste = Math.max(0, AU_MOINS - (performance.now() - depart));
    setTimeout(() => {
      ecran.classList.add('partie');
      /* On le retire vraiment, une fois la transition finie. `visibility` le
         sort déjà de l'ordre de tabulation, mais une image de fond qui
         respire pour personne consomme un calque de composition pour rien. */
      setTimeout(() => ecran.remove(), 700);
    }, reste);
  }

  /* L'éventail. Cinq Fanzzy tirés au hasard parmi ceux qui sont **dessinés** —
     `FZART.ILLUSTRES` est la seule liste qui le sache, et la recopier ici
     l'aurait fait mentir au premier dessin ajouté.
     Si la bibliothèque n'est pas là, l'écran garde son titre et son fond : ce
     sont des visages en plus, pas la condition de quoi que ce soit. */
  try {
    const bande = document.getElementById('ouvBande');
    const tous = [...(window.FZART?.ILLUSTRES ?? [])];
    if (bande && tous.length) {
      const pris = [];
      while (pris.length < Math.min(5, tous.length)) {
        const f = tous[Math.floor(Math.random() * tous.length)];
        if (!pris.includes(f)) pris.push(f);
      }
      bande.innerHTML = pris
        .map((id) => window.FZART.adresse(id, 'plein') ?? window.FZART.adresse(id, 'buste'))
        .filter(Boolean)
        .map((src) => `<img src="${src}" alt="" loading="eager" onerror="this.remove()">`)
        .join('');
    }
  } catch { /* pas de visages : le titre suffit */ }

  /* Les trois sorties. La minuterie est posée en premier : si tout le reste
     échoue — un script cassé plus haut, un réseau mort — elle part quand même,
     et c'est elle qui empêche l'écran d'ouverture de devenir une porte close. */
  setTimeout(partir, AU_PLUS);
  addEventListener('tbf:pret', partir, { once: true });
  addEventListener('pointerdown', partir, { once: true });
})();
