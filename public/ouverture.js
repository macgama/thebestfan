/**
 * L'écran d'ouverture : le tunnel, la troupe de Fanzzy qui monte vers la
 * tribune, et le moment où il s'en va.
 *
 * ## Ce qu'il fait, et ce qu'il ne fait pas
 *
 * Le cadre est déjà dans la page — le tunnel, le titre sur sa bâche, la jauge
 * et son premier libellé — et il est visible avant qu'une seule ligne d'ici ne
 * tourne. Ce fichier ajoute ce qui ne peut pas être écrit d'avance : les
 * visages (tirés au hasard), l'avancée de la jauge et ses deux libellés
 * suivants (ils suivent le temps, et l'écharpe se noue sur le dernier quand
 * l'écran part : voir `nouer`), « TOUCHE POUR ENTRER » (vrai seulement si
 * ce fichier est là pour l'entendre), l'astuce du jour (elle dépend de la
 * date) — et la sortie.
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
 * Tout ce que le lot 2 a ajouté ici (libellés, consigne, astuce, places de la
 * troupe) est du décor, et chaque morceau est dans son `try` : une faute dans
 * le décor ne doit jamais coûter une sortie.
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

  /* La lumière du bout du tunnel grandit pendant tout le plafond : la page
     l'écrit à dix secondes pour qu'elle grandisse avant ce fichier, et on
     lui redonne ici la vraie durée. Changer `DUREE` suffit donc à tout
     accorder ; tant qu'elle vaut dix secondes, cette ligne ne change rien. */
  try { ecran.style.setProperty('--duree', `${DUREE}ms`); } catch { /* décor */ }

  /* La jauge suit le temps réel.
   *
   * Dix secondes sans rien qui avance se lisent comme une panne : on recharge,
   * et l'on repart pour dix secondes. Elle était déjà dans le cadre, purement
   * décorative — elle dit maintenant où l'on en est.
   *
   * `requestAnimationFrame` plutôt qu'une minuterie : la jauge ne décide de
   * rien, elle ne fait que suivre, et un cadre sauté ne coûte qu'un cadre.
   *
   * **Ses trois libellés changent par tiers** (lot 2) : « on ouvre les
   * grilles », « les tribunes se remplissent », « coup d'envoi ». Le premier
   * est écrit dans la page, pour paraître avant ce fichier ; il doit rester
   * identique à `MOTS[0]`. On ne réécrit le libellé qu'au changement de tiers :
   * un texte réécrit à chaque image se remesure à chaque image. */
  const MOTS = ['ON OUVRE LES GRILLES', 'LES TRIBUNES SE REMPLISSENT', 'COUP D’ENVOI'];
  const libelle = document.getElementById('ouvMot');
  let tiers = 0;
  const jauge = ecran.querySelector('.jauge i, .barre i, [data-jauge]');
  /* L'écharpe nouée : elle cesse de suivre l'horloge, voir `nouer`. */
  let noue = false;
  /** Le temps du nœud : l'écharpe finit sa course, « COUP D'ENVOI » se lit. */
  const NOEUD = 300;
  if (jauge) {
    const suivre = () => {
      if (noue) return;
      const part = Math.min(1, (performance.now() - depart) / DUREE);
      jauge.style.width = `${(part * 100).toFixed(1)}%`;
      const t = Math.min(MOTS.length - 1, Math.floor(part * MOTS.length));
      if (libelle && t !== tiers) { tiers = t; libelle.textContent = MOTS[t]; }
      if (part < 1) requestAnimationFrame(suivre);
    };
    requestAnimationFrame(suivre);
  }

  /**
   * L'écharpe se noue : « COUP D'ENVOI », et la jauge au bout.
   *
   * Elle suit le plafond, et l'écran part dès que l'accueil est prêt — en
   * pratique entre une seconde et demie et trois secondes. On quittait donc
   * le rideau sur une écharpe remplie au cinquième et sur « ON OUVRE LES
   * GRILLES » : les deux autres libellés n'existaient que les jours où le
   * serveur était lent, et la sortie se lisait comme une coupure plutôt que
   * comme une entrée. Quand l'écran part, l'écharpe finit donc sa course en
   * trois cents millisecondes, sur le dernier libellé.
   *
   * Au calme, elle saute au bout sans glisser : la transition est celle de la
   * feuille (`.tbf-jauge[data-suit]`), que l'écriture en ligne ne remplace
   * qu'en mouvement.
   *
   * @returns {number} le temps que prend le nœud, à attendre avant de partir.
   */
  function nouer() {
    if (noue) return 0;
    noue = true;
    try {
      if (libelle) { tiers = MOTS.length - 1; libelle.textContent = MOTS[tiers]; }
      if (!jauge || parseFloat(jauge.style.width) >= 100) return 0;
      const calme = matchMedia('(prefers-reduced-motion: reduce)').matches
        || /(^|\s)animations(\s|$)/.test(document.documentElement.dataset.calme ?? '');
      if (!calme) jauge.style.transition = `width ${NOEUD}ms cubic-bezier(.2,1,.3,1)`;
      jauge.style.width = '100%';
      return NOEUD;
    } catch { return 0; /* décor : la sortie ne l'attend pas */ }
  }

  /* Le départ lui-même : le fondu, puis le retrait. Une fois. */
  let leve = false;
  function lever() {
    if (leve) return;
    leve = true;
    ecran.classList.add('partie');
    /* On le retire vraiment, une fois la transition finie. `visibility` le
       sort déjà de l'ordre de tabulation, mais une lumière qui grandit et
       une fumée qui dérive pour personne consomment des calques de
       composition pour rien. */
    setTimeout(() => {
      ecran.remove();
      /* Le rideau est levé. Ce que l'accueil gardait pour ce moment — le
         salut du personnage — peut se jouer : joué plus tôt, il se déroulait
         entièrement derrière l'écran d'ouverture, et le joueur ne voyait
         jamais son Fanzzy arriver. */
      dispatchEvent(new Event('tbf:ouverture-finie'));
    }, 700);
  }

  /* Le joueur a touché l'écran : plus rien ne le retient que le plancher. */
  let touche = false;

  /**
   * @param {boolean} plein attendre tout le plafond, ou seulement le plancher.
   *   Vrai quand c'est la minuterie qui appelle — il ne reste alors rien à
   *   attendre de toute façon. Faux quand c'est le joueur ou l'accueil.
   *
   * L'écharpe se noue au moment de partir, et le fondu attend ses trois
   * cents millisecondes **seulement quand c'est l'accueil qui congédie
   * l'écran** : le plafond l'a déjà pleine (il ne se négocie pas), et le
   * doigt ne se fait pas retenir — le fondu part avec le nœud, et le geste
   * suivant atteint la page (voir `pointerdown`, plus bas).
   */
  function partir(plein = false) {
    if (parti) return;
    parti = true;
    const cible = plein ? DUREE : PLANCHER;
    const reste = Math.max(0, cible - (performance.now() - depart));
    setTimeout(() => {
      const attente = nouer();
      if (plein || touche || !attente) lever();
      else setTimeout(lever, attente);
    }, reste);
  }

  /* La troupe. Cinq Fanzzy tirés au hasard parmi ceux qui sont **dessinés** —
     `FZART.ILLUSTRES` est la seule liste qui le sache, et la recopier ici
     l'aurait fait mentir au premier dessin ajouté.
     Si la bibliothèque n'est pas là, l'écran garde son titre et son tunnel :
     ce sont des visages en plus, pas la condition de quoi que ce soit.

     Chacun reçoit sa marche (`data-place`, de 1, le plus loin, à 5, le plus
     près, qui salue), dans l'ordre où ils se peignent : le plus près passe
     devant. La place est écrite et non déduite du rang, pour qu'un visage
     dont l'image manque s'en aille sans faire sauter les autres d'une
     marche. Des éléments plutôt qu'une chaîne de balisage : l'image qui
     échoue retire sa marche entière, ombre comprise, sans attribut
     `onerror` écrit dans une chaîne. */
  try {
    const bande = document.getElementById('ouvBande');
    const tous = [...(window.FZART?.ILLUSTRES ?? [])];
    if (bande && tous.length) {
      const pris = [];
      while (pris.length < Math.min(5, tous.length)) {
        const f = tous[Math.floor(Math.random() * tous.length)];
        if (!pris.includes(f)) pris.push(f);
      }
      pris.forEach((id, i) => {
        const src = window.FZART.adresse(id, 'plein') ?? window.FZART.adresse(id, 'buste');
        if (!src) return;
        const marche = document.createElement('span');
        marche.className = 'fz';
        marche.dataset.place = String(i + 1);
        const img = document.createElement('img');
        img.alt = '';
        img.decoding = 'async';
        img.addEventListener('error', () => marche.remove(), { once: true });
        img.src = src;
        marche.append(img);
        bande.append(marche);
      });
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
     appui était avalé par l'écran qu'il venait de faire disparaître.

     Le doigt n'attend pas le nœud de l'écharpe : posé pendant ses trois
     cents millisecondes, il lève l'écran tout de suite (le nœud finit dans
     le fondu). Plus d'`once` donc : le second appui doit pouvoir abréger
     l'attente que le premier n'a pas déclenchée. */
  ecran.addEventListener('pointerdown', () => {
    touche = true;
    if (noue) lever(); else partir();
  });

  /* **« TOUCHE POUR ENTRER », au bout du plancher.**

     C'est à partir de là que le toucher fait partir l'écran sans attendre :
     avant, il le fait partir au plancher de toute façon. La consigne est
     posée par ce fichier et non par la page, parce que c'est lui qui écoute
     le doigt — sans lui, toucher ne ferait rien, et la consigne mentirait.
     Si l'écran est déjà sur le départ (l'accueil prêt avant le plancher), on
     ne l'annonce pas : elle paraîtrait au moment où tout s'efface. */
  setTimeout(() => { if (!parti) ecran.classList.add('entrable'); }, PLANCHER);

  /* **L'astuce du jour**, sur un ticket kraft en bas du tunnel.

     Une table écrite en dur, et une par jour (la date locale, pour qu'elle
     change à minuit chez le joueur et pas à minuit à Greenwich). Chaque
     ligne est en trois morceaux : avant le mot-clé, le mot-clé, après — le
     mot-clé est mis en valeur par la page (Oswald gras ; jamais le
     marqueur, qui n'a pas sa place sur le rideau).

     **Aucun nombre réglable.** L'aide du jeu le dit déjà (`src/shared/aide.js`) :
     une astuce ment toujours en premier sur les nombres — le prix d'un
     booster, la taille d'une réserve se changent depuis l'administration, et
     une phrase recopiée ici ne suivrait pas. Les astuces ne disent donc que
     des règles du jeu, toutes tirées de cette aide ou du moteur du Virage.

     **Deux lignes au plus à 320 px de large** : le ticket en a la hauteur, et
     sa place est gardée dans la page. Une astuce plus longue serait coupée
     par la déchirure du ticket : on la raccourcit, on n'agrandit pas le
     ticket. */
  const ASTUCES = [
    ['Un vrai but au stade ouvre une ', 'minute double', ' au Virage.'],
    ['Un double ne se perd jamais : il se change en ', 'écharpes', '.'],
    ['La rareté dit ', 'l’âge', ' d’un Fanzzy, pas sa force.'],
    ['Les rares et les épiques ne se tirent pas : ', 'elles se paient', '.'],
    ['Une tenue change l’allure d’un Fanzzy, ', 'jamais sa force', '.'],
    ['Chaque équipement a son ', 'revers', ' : il donne, et il reprend.'],
    ['Au Virage, deux fois plus de monde ne pousse pas ', 'deux fois plus fort', '.'],
    ['Un duel adossé à un ', 'match du jour', ' compte au classement.'],
    ['Un geste te résiste ? ', 'La répétition', ' le fait rejouer sans risque.'],
    ['Au Virage, sans geste, tu ', 'sors de la foule', ' : il faut chanter.'],
    ['', 'Tous les matchs en direct', ' sont ouverts au Virage, ton club ou pas.'],
    ['Le stade vient du match : l’avantage du terrain ', 'ne s’achète pas', '.'],
  ];
  try {
    const astuce = document.getElementById('ouvAstuce');
    const texte = astuce?.querySelector('p');
    if (astuce && texte) {
      const jour = Math.floor((Date.now() - new Date().getTimezoneOffset() * 60_000) / 86_400_000);
      const [avant, cle, apres] = ASTUCES[((jour % ASTUCES.length) + ASTUCES.length) % ASTUCES.length];
      const b = document.createElement('b');
      b.textContent = cle;
      texte.replaceChildren(avant, b, apres);
      astuce.hidden = false;
      astuce.classList.add('tbf-glisse');
    }
  } catch { /* pas d'astuce : le ticket reste caché */ }
})();
