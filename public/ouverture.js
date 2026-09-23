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
 * L'écran part à la **première** des trois conditions : l'accueil dit qu'il
 * est prêt, on touche l'écran, ou le temps est écoulé. Le dernier n'est pas
 * une précaution ajoutée après coup, c'est le filet — un écran d'ouverture
 * qui attend le serveur devient un écran d'attente le jour où le serveur est
 * lent, et c'est exactement le jour où il ne faut pas retenir les gens
 * dehors.
 *
 * Les deux premières respectent un **plancher** : l'écran ne clignote pas.
 * Le plafond, lui, ne se négocie pas — voir `DUREE`.
 *
 * Ces sorties ont été retirées une fois, et remises : dix secondes que rien
 * n'abrège se lisent comme une panne, et un joueur l'a signalé deux fois.
 * Si l'envie revient de les enlever, relire d'abord le récit du duel plus
 * bas — c'est le même symptôme.
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

  /* **On arrive de l'intérieur du jeu : pas d'ouverture.**
   *
   * Un joueur l'a décrit ainsi : « je quitte un duel, j'arrive sur la page de
   * chargement, et il ne se passe plus rien ». Il ne se passait rien pendant
   * **dix secondes**, ce qui, entre deux parties, ne se distingue pas d'une
   * panne — et il rechargeait, ce qui remet dix secondes.
   *
   * La garde par session existait déjà et ne suffit pas : elle ne se pose qu'au
   * premier passage **par l'accueil**. Quelqu'un qui ouvre l'application sur un
   * match, joue, puis revient, n'y est encore jamais passé. Sa première visite
   * de l'accueil est donc celle qui suit sa partie, c'est-à-dire le pire moment
   * possible pour lui tenir l'écran.
   *
   * Le référent dit d'où l'on vient. Venir de chez nous, c'est revenir, et on
   * ne joue pas une ouverture à quelqu'un qui revient. On la garde pour ce à
   * quoi elle sert : arriver de l'extérieur, ou ouvrir l'application. */
  try {
    const ref = document.referrer;
    if (ref && new URL(ref).origin === location.origin) { ecran.remove(); return; }
  } catch { /* référent illisible : on la montre, c'est le cas ordinaire */ }

  /**
   * Combien de temps l'ouverture tient l'écran.
   *
   * Dix secondes. Elle en tenait 1800 ms et partait au premier toucher — le bon
   * réglage du temps où elle passait à **chaque** visite de l'accueil. Elle ne
   * passe qu'une fois par session depuis, et dix secondes une fois par session,
   * c'est le temps d'une ouverture de jeu.
   *
   * C'est long, et il faut le savoir : quelqu'un qui ouvre l'application pour
   * vérifier un score attendra dix secondes pour une information qui en demande
   * deux. C'est une décision de rythme, et elle tient dans cette constante.
   */
  const DUREE = 10_000;

  /**
   * Le temps minimum qu'elle reste, quoi qu'il arrive.
   *
   * Sans lui, une page déjà chaude ferait clignoter l'ouverture : elle
   * paraîtrait et disparaîtrait dans le même souffle, ce qui se lit comme un
   * défaut d'affichage et non comme une entrée. Mille deux cents
   * millisecondes, c'est le temps de lire le titre.
   */
  const PLANCHER = 1200;

  const depart = performance.now();
  let parti = false;

  /* La jauge suit le temps réel.
   *
   * Dix secondes sans rien qui avance se lisent comme une panne : on recharge,
   * et l'on repart pour dix secondes. Elle était déjà dans le cadre, purement
   * décorative — elle dit maintenant où l'on en est.
   *
   * `requestAnimationFrame` plutôt qu'une minuterie : la jauge ne décide de
   * rien, elle ne fait que suivre, et un cadre sauté ne coûte qu'un cadre. */
  const jauge = ecran.querySelector('.jauge i, .barre i, [data-jauge]');
  if (jauge) {
    const suivre = () => {
      if (parti) return;
      const part = Math.min(1, (performance.now() - depart) / DUREE);
      jauge.style.width = `${(part * 100).toFixed(1)}%`;
      if (part < 1) requestAnimationFrame(suivre);
    };
    requestAnimationFrame(suivre);
  }

  /**
   * @param {boolean} plein attendre tout le plafond, ou seulement le plancher.
   *   Vrai quand c'est la minuterie qui appelle — il ne reste alors rien à
   *   attendre de toute façon. Faux quand c'est le joueur ou l'accueil.
   */
  function partir(plein = false) {
    if (parti) return;
    parti = true;
    const cible = plein ? DUREE : PLANCHER;
    const reste = Math.max(0, cible - (performance.now() - depart));
    setTimeout(() => {
      ecran.classList.add('partie');
      /* On le retire vraiment, une fois la transition finie. `visibility` le
         sort déjà de l'ordre de tabulation, mais une image de fond qui
         respire pour personne consomme un calque de composition pour rien. */
      setTimeout(() => {
        ecran.remove();
        /* Le rideau est levé. Ce que l'accueil gardait pour ce moment — le
           salut du personnage — peut se jouer : joué plus tôt, il se déroulait
           entièrement derrière l'écran d'ouverture, et le joueur ne voyait
           jamais son Fanzzy arriver. */
        dispatchEvent(new Event('tbf:ouverture-finie'));
      }, 700);
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

  /* **Les trois sorties, et pourquoi elles reviennent.**

     Elles avaient été retirées au motif que « maintenant que la durée est
     voulue, elles n'ont plus de sens ». Le résultat est dix secondes que
     rien n'abrège — et dix secondes d'un écran fixe ne se distinguent pas
     d'une panne. C'est mot pour mot ce que l'en-tête de ce fichier raconte
     déjà : « je quitte un duel, j'arrive sur la page de chargement, et il ne
     se passe plus rien ». Un joueur l'a signalé une seconde fois.

     Trois choses le disaient encore, et plus rien ne les tenait :

       — l'en-tête de ce fichier : « L'écran part à la **première** des deux
         conditions… Il part aussi au premier geste » ;
       — `index.html`, qui émet `tbf:pret` en expliquant que « ouverture.js
         décide, c'est lui qui connaît le plancher et le plafond » — un
         plancher qui n'existait pas, et un signal que plus personne
         n'écoutait ;
       — et le fait qu'un plafond sans plancher n'est pas une durée : c'est
         une attente.

     La règle est donc celle que le fichier a toujours décrite. Un plancher,
     pour ne pas clignoter. Un plafond, pour ne jamais retenir personne. Et
     entre les deux, l'écran part dès que l'accueil est prêt ou dès qu'on le
     touche.

     La minuterie est posée **en premier** : si tout le reste échoue — un
     script cassé plus haut, un réseau mort — elle part quand même, et c'est
     elle qui empêche l'ouverture de devenir une porte close. */
  setTimeout(() => partir(true), DUREE);

  /* L'accueil a fini de se monter : le personnage est posé, la collection est
     lue, il n'y a plus rien à couvrir. */
  addEventListener('tbf:pret', () => partir(), { once: true });

  /* Et le geste. Quelqu'un qui touche l'écran a fini de regarder — c'est la
     seule des trois qui vienne du joueur, et c'est celle qui compte le plus :
     elle transforme une attente subie en une attente qu'on peut couper.

     `pointerdown` et non `click` : le voile part au moment où le doigt se
     pose, donc le geste suivant atteint la page. Avec `click`, le premier
     appui était avalé par l'écran qu'il venait de faire disparaître. */
  ecran.addEventListener('pointerdown', () => partir(), { once: true });
})();
