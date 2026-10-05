/**
 * Le mini-jeu des gestes.
 *
 * ## Pourquoi un fichier à part
 *
 * Il était écrit **deux fois** : dans le Grand Virage et dans le duel. Trois
 * gestes, deux implémentations, deux décomptes, deux façons de fermer la
 * fenêtre. Passer à dix gestes aurait voulu dire en écrire vingt.
 *
 * ## La règle qui tient tout
 *
 * **Le client ne calcule aucune durée.** Tout ce qu'il dessine — la pulsation,
 * le nombre de frappes attendues, la limite d'une tenue — vient de `gestes`,
 * que le serveur envoie avec l'état. La faute a déjà été payée : la pulsation
 * était dessinée à 560 ms alors que la notation appliquait les modificateurs
 * du porteur, si bien qu'un joueur équipé tapait juste sur ce qu'on lui
 * montrait et récoltait 0,36 au lieu de 0,99. Plus sa carte était rare, plus
 * il était puni.
 *
 * Ce fichier ne connaît donc **aucun nombre de jeu**. Il connaît des formes.
 *
 * ## Ce qu'il rend
 *
 * Une suite d'instants en millisecondes depuis **le zéro du serveur** —
 * c'est tout ce que le serveur accepte, et c'est ce qui lui permet de juger
 * sans faire confiance à personne. Ce zéro est l'ouverture de la fenêtre,
 * sauf pour les quatre gestes de rythme (voir `grille`) : la première
 * pulsation au tempo, au contretemps et au crescendo, la première frappe à
 * l'écho. Les gestes de tenue rendent des paires appui/relâchement.
 *
 * Un geste de rythme **finit sur sa dernière frappe attendue** : le serveur
 * ne lit que ses `n` premières frappes (`noterContre`), une de plus ne
 * changerait rien à la note, et la fenêtre n'a plus de raison de tenir le
 * joueur devant un pavé muet.
 *
 * ## Le pavé sous le doigt (lot 6)
 *
 * Les dix gestes de rythme se jouent sur **le pavé-bâche** : une bâche craie
 * ronde (`.pad.tbf-pave`), dont la matière vit dans `ui.css` (« le pavé de
 * geste, la bâche ronde »). Ce qu'elle fait sous le doigt dépend du geste, et
 * c'est une règle de la direction (amendement 9), pas un goût :
 *
 *   - **les gestes de frappe** (`FRAPPE` : tempo, contretemps, écho,
 *     crescendo) — le pavé porte `data-frappe` ; à chaque frappe il s'enfonce
 *     de quatre pixels (`.hit`, 80 ms) et lâche une bouffée de la couleur du
 *     geste (`.tbf-bouffee`, posée dans le pavé, que la feuille garde autour
 *     du disque) ;
 *   - **le martelage et les salves** — un tic et huit millisecondes, rien
 *     d'autre : à huit ou dix frappes par seconde, chaque image perdue à
 *     animer se paie sur la note ;
 *   - **les gestes positionnels** (tifo, écharpe, visée, jauge, rouleaux, ola,
 *     bascule) — le pavé ne bouge jamais : le doigt vise un point, et une
 *     cible qui se dérobe fausse la mesure.
 *
 * Partout ailleurs, chaque toucher rend le même tic et la même vibration de
 * huit millisecondes. Les vibrations qui **annoncent** quelque chose — la
 * pulsation, le signal de la bascule, le coup du capo — gardent les leurs :
 * ce ne sont pas des retours de toucher, ce sont des consignes.
 *
 * ## Le verdict vient du serveur
 *
 * Ce fichier ne note rien, et il ne nomme rien non plus : le mot du geste
 * (`parfait`, `bon`, `moyen`, `rate`) est servi (`CONTRATS.md`, § 16 et
 * § 17), et la page ne garde **aucun seuil** — ni pour le mot, ni pour un son.
 * Ce fichier ne fait que le poser :
 *
 *   - `tamponner(hôte, verdict)` claque le tampon au centre d'un élément — le
 *     pavé, ou la carte jouée ;
 *   - `attendre(réponse, { zone, carte })` garde la fenêtre du geste ouverte
 *     le temps que la réponse arrive, **au plus `DELAI_VERDICT` (600 ms)
 *     après la dernière frappe**, et y claque le tampon ; trop tard, il rend
 *     la main pour que la page ferme la fenêtre, et le tampon claque sur la
 *     carte jouée à l'arrivée.
 *
 * Script classique, pas module : comme tout ce qui vit dans `public/`.
 */
(() => {
  /** Ce qu'on annonce au joueur avant chaque geste.
   *
   * **Les mots longs portent leur coupure** (`\u00AD`, le trait d'union
   * conditionnel, invisible tant que le mot tient sur sa ligne). Sur la carte
   * d'un chant, le geste s'écrit à onze pixels dans quarante-cinq de large : à
   * cette taille « CONTRETEMPS » en demande soixante-quatre. Sans coupure
   * écrite, le mot se cassait n'importe où — « CONTRET/EMPS » — sur tous les
   * navigateurs qui ne savent pas couper le français d'eux-mêmes. La coupure
   * est posée ici, une fois, à la syllabe ; les écrans larges ne la voient
   * jamais. */
  const LABEL = {
    tempo: 'TEMPO', mash: 'MARTE\u00ADLAGE', hold: 'ENDU\u00ADRANCE',
    contretemps: 'CONTRE\u00ADTEMPS', echo: 'ÉCHO', crescendo: 'CRES\u00ADCENDO',
    relance: 'RELANCE', salves: 'SALVES', tenue: 'SANG-FROID', retenue: 'MESURE',
    tifo: 'TIFO', memoire: 'LES VISAGES', mosaique: 'MOSA\u00ADÏQUE',
    echarpe: 'L’ÉCHAR\u00ADPE', capo: 'LE CAPO',
    tri: 'LE TRI', compte: 'LE COMPTE',
    bascule: 'LA BASCULE', visee: 'LA VISÉE', jauge: 'LA JAUGE',
    ola: 'LA OLA', miroir: 'L’ÉCHO INVERSÉ', rouleaux: 'LES ROU\u00ADLEAUX',
    deuxvoix: 'LES DEUX VOIX',
  };
  const AIDE = {
    tempo: 'Tape sur chaque pulsation',
    mash: 'Tape le plus vite possible',
    hold: 'Garde le doigt appuyé',
    contretemps: 'Tape **entre** les pulsations',
    echo: 'Écoute le motif, puis refais-le',
    crescendo: 'Tape de plus en plus vite, régulièrement',
    relance: 'Tiens, puis lâche pile sur la pulsation',
    salves: 'Trois rafales, séparées par un silence',
    tenue: 'Tiens le plus longtemps possible — mais lâche avant la fin',
    retenue: 'Tape exactement le nombre demandé. Ni plus, ni moins.',
    tifo: 'Suis le trait du doigt, sans le quitter, jusqu’au bout',
    memoire: 'Retiens les visages, puis retrouve les paires',
    mosaique: 'Retiens la mosaïque, puis refais-la',
    echarpe: 'Fais tourner l’écharpe — rond et régulier',
    capo: 'Regarde la suite du capo, puis répète-la',
    tri: 'Ramasse **uniquement** les cartons de la bonne couleur',
    compte: 'Le compte s’éteint. Touche pile quand il arrive à zéro.',
    /* La consigne dit la règle **et son piège**. Une épreuve dont on découvre
       le retournement en le ratant se lit comme une injustice, pas comme une
       difficulté — et on ne la rejoue pas. */
    bascule: 'Pousse du côté montré — sauf « à contre-courant », où tu vas de l’autre',
    visee: 'Touche chaque fumigène tant qu’il brûle. Le bon endroit **et** le bon moment.',
    jauge: 'Garde le curseur dans la bande. Elle tient, puis elle saute.',
    /* Les quatre de l'automne. Même règle : la consigne dit le piège avant
       qu'on tombe dedans — l'accélération, le miroir, le vent. */
    ola: 'Touche quand la vague passe devant ta tribune. Elle accélère à chaque tour.',
    miroir: 'Écoute le capo, puis rejoue son motif en miroir : sa gauche est ta droite.',
    rouleaux: 'Glisse vers la pelouse pour lancer. Vise la cible — et compte avec le vent.',
    deuxvoix: 'Deux chants, deux côtés : frappe du bon côté quand la note touche la ligne.',
  };
  /* La couleur dit la famille du geste avant qu'on ait lu son nom : or pour le
     rythme, bleu pour la vitesse, craie pour la tenue, vert pour la mesure. */
  const COULEUR = {
    tempo: '#F5C33B', contretemps: '#F5C33B', echo: '#F5C33B', crescendo: '#F5C33B',
    mash: '#3C82E8', salves: '#3C82E8',
    hold: '#C2CAD6', relance: '#C2CAD6', tenue: '#E0402C',
    retenue: '#1E9E6A',
    /* Les cinq épreuves ont leurs propres teintes : violet pour ce qui se
       dessine, vert d’eau pour ce qui se retient. Elles ne sont pas du rythme,
       et l’œil doit le savoir avant d’avoir lu le nom. */
    tifo: '#8257DA', echarpe: '#8257DA',
    memoire: '#2FB8A6', mosaique: '#2FB8A6', capo: '#2FB8A6',
    /* Les deux dernières ne retiennent rien : l'une trie à vue, l'autre
       compte dans le noir. Elles ont donc leur propre teinte — ambre — pour
       qu'on ne les prenne pas pour des épreuves de mémoire. */
    tri: '#E08A2C', compte: '#E08A2C',
    /* Les trois neuves partagent le rouge : ce sont les seules qui demandent
       de **décider vite**, et la couleur le dit avant la consigne. */
    bascule: '#E0402C', visee: '#E0402C', jauge: '#E0402C',
    /* La ola et les deux voix sont du rythme qu'on **voit venir** : l'or du
       rythme. L'écho inversé se retient avant de se jouer : le vert d'eau
       de la mémoire. Les rouleaux se décident au doigt : le rouge. */
    ola: '#F5C33B', deuxvoix: '#F5C33B', miroir: '#2FB8A6', rouleaux: '#E0402C',
  };

  const label = (g) => LABEL[g] ?? String(g ?? '').toUpperCase();
  const aide = (g) => AIDE[g] ?? '';
  const couleur = (g) => COULEUR[g] ?? '#F5C33B';

  /* **Les quatre gestes qui s'enfoncent.** Ce sont les seuls où une frappe
     tombe sur un temps qu'on attend — une par pulsation, deux par seconde au
     plus vite du crescendo : le pavé a le temps de descendre et de remonter,
     et la bouffée de se dissiper, avant la frappe suivante. Sur le martelage
     (huit à dix frappes par seconde), la même animation empilerait des
     bouffées et coûterait des images là où la note se joue. La liste est
     fermée et `gestes:test` la relit : un geste qu'on y ajouterait sans le
     dire ferait bouger un pavé que la direction veut immobile. */
  const FRAPPE = Object.freeze(['tempo', 'contretemps', 'echo', 'crescendo']);

  /* **Les quatre mots du verdict.** La liste est celle du serveur
     (`src/shared/verdict.js`, `VERDICTS`) — recopiée et non importée, parce
     que ce fichier est un script de navigateur ; `gestes:test` compare les
     deux. Un mot que cette table ne connaît pas ne s'écrit pas (`CONTRATS.md`,
     § 16.1).

     **Les mots, pas les couleurs.** Le tampon porte le code servi dans
     `data-verdict`, et c'est la feuille qui le teint — PARFAIT vert, BON bleu,
     MOYEN or, RATÉ rouge, chacun dans l'encre que son fond demande (« l'échelle
     du verdict », `ui.css`). Une table de tons ici serait une seconde vérité,
     et elle se tromperait de fond : le même BON n'a pas la même encre sur le
     sombre, sur la craie du pavé et sur une carte. */
  const MOTS = Object.freeze({ parfait: 'PARFAIT', bon: 'BON', moyen: 'MOYEN', rate: 'RATÉ' });
  const connu = (v) => typeof v === 'string' && Object.prototype.hasOwnProperty.call(MOTS, v);
  /** Le mot servi, lu dans une chaîne ou dans la réponse qui le porte. */
  const verdictDans = (r) => {
    const v = typeof r === 'string' ? r : r?.verdict;
    return connu(v) ? v : null;
  };
  const mot = (v) => (connu(v) ? MOTS[v] : null);

  /* **Combien de temps la fenêtre attend le serveur : six cents
     millisecondes après la dernière frappe** (le brief, mot pour mot) — le
     temps d'un aller-retour sur un réseau mobile ordinaire —, et pas une de
     plus : au-delà, on garderait le joueur devant un pavé muet pendant que le
     match continue derrière. La réponse qui arrive plus tard n'est pas
     perdue, elle claque sur la carte jouée.

     Lue à la lettre, la règle ne tenait pas avec des fenêtres qui restaient
     ouvertes **après** la dernière frappe : celle du contretemps se fermait
     un demi-temps et 360 ms plus tard, celle de l'écho 900 ms, et l'échéance
     était passée avant que les frappes partent. Elle s'était donc comptée
     depuis la fin du geste. C'est la fenêtre qui avait tort : un geste de
     rythme **finit maintenant sur sa dernière frappe attendue** (`frappes`
     dans `grille`), et l'échéance part d'elle. Le joueur qui a tout tapé lit
     son mot six cents millisecondes au plus après son dernier coup — et non
     plus un temps et demi plus tard.

     « La dernière frappe », geste par geste (`jouer`, `reperes`) :
       - **les quatre gestes de rythme** : la dernière frappe prise. Celui qui
         en a manqué une a vu la fenêtre l'attendre jusqu'à sa fermeture ; son
         échéance est alors passée, et son tampon claque sur la carte ;
       - **la relance et le sang-froid** : le lâcher, qui les finit ;
       - **tous les autres** — le martelage, les salves, la mesure,
         l'endurance, les épreuves — : leur fin. Leur durée **est** l'épreuve,
         une frappe peut y venir jusqu'au dernier instant, et c'est leur fin
         qui en tient lieu (le bouton « C'EST FAIT » et la touche du compte
         sont d'ailleurs une frappe qui finit le geste). */
  const DELAI_VERDICT = 600;
  /* Le tampon posé, la fenêtre reste ouverte le temps de le lire : il claque
     en 260 ms (`.tbf-clac`), et un mot qui disparaît dans la foulée n'a pas
     été lu — c'était tout le défaut de l'ancien verdict, écrit sous le pavé
     à l'instant où la fenêtre se fermait. */
  const LECTURE_VERDICT = 600;
  /* Sur la carte jouée, le tampon reste un peu plus : l'œil y revient après
     la fermeture de la fenêtre, il ne l'y attendait pas. */
  const TENUE_CARTE = 1600;

  /* **L'avance qu'une frappe peut prendre sur le zéro du serveur.** Le
     serveur refuse le geste **entier** — comme une triche — dès qu'une frappe
     tombe plus de deux cents millisecondes avant son zéro (`sanity`,
     `tap_out_of_window`, dans `gestures.js`). Ce n'est pas une durée de jeu,
     c'est la borne de sa défense : recopiée ici parce que ce fichier ne peut
     rien importer, et `gestes:test` vérifie qu'elle est la sienne (une
     frappe à −200 passe, à −201 le geste est refusé). */
  const AVANCE = 200;

  /* **L'instant zéro qu'une page peut prêter au geste** (`el.origine`) : celui
     qu'elle vient de donner au chant de la tribune (`TBF_SON.chantDuGeste`),
     pris dans la même tâche. Plus vieux qu'un quart de seconde, ce n'est plus
     l'ouverture de ce geste-ci — une valeur gardée d'un autre appel — et le
     geste prend le sien : une origine lointaine ferait tomber toutes ses
     pulsations d'un coup, à l'ouverture. */
  const ORIGINE_MAX = 250;

  /**
   * **La grille d'un geste de rythme** : quand ses pulsations se dessinent,
   * d'où partent les frappes qu'on rend au serveur, et quand la fenêtre se
   * ferme — en millisecondes depuis l'ouverture du geste.
   *
   * ## Pourquoi elle existe
   *
   * La pulsation était dessinée **un temps trop tard pour la note.** Le
   * serveur note le tempo contre `0, I, 2I…` et le contretemps contre
   * `I/2, 3I/2…` (`gestures.js`, dans l'ordre et non au plus proche) ; ce
   * fichier dessinait — et la tribune chante (`son.js`) — la première
   * pulsation au bout d'un intervalle, à `I`, et comptait les frappes depuis
   * l'ouverture. Un joueur qui tapait **exactement** sur chaque pulsation
   * rendait donc `I, 2I…` contre `0, I…` : un intervalle d'écart sur chaque
   * temps, 560 ms contre une fenêtre de 200, et **0,00 — RATÉ — à chaque
   * fois** (mesuré au banc du lot 6, la vraie route et un joueur qui tape
   * sur l'anneau). Seul celui qui tapait dès l'ouverture, avant toute
   * pulsation, était payé : c'est ce que faisaient les suites.
   *
   * Le temps d'avance n'est pas une faute : c'est le décompte, qui laisse
   * voir arriver le premier temps. Ce qui était faux, c'est le zéro. **Le
   * zéro du serveur est la première pulsation** : les frappes se comptent
   * depuis elle (`zero`), et le dessin comme le chant ne bougent pas.
   *
   * Même défaut à l'écho, d'une autre façon : le commentaire disait « le
   * serveur note le motif depuis sa première frappe », le code comptait
   * depuis l'apparition de « À TOI ». Le motif refait à la perfection, mais
   * commencé au temps de réaction d'un humain — deux dixièmes —, tombait
   * hors de chaque fenêtre (190 ms) : 0,00. Le zéro de l'écho est la
   * première frappe (`zero: null`), comme le commentaire le voulait.
   *
   * ## Ce qu'elle rend
   *
   *   - `pulsations` : les instants où l'anneau bat ;
   *   - `zero` : l'instant que le serveur appelle zéro — les frappes rendues
   *     se comptent depuis lui ; `null` : depuis la première frappe ;
   *   - `ouvert` : l'instant à partir duquel le pavé prend une frappe. Avant,
   *     c'est le décompte : une frappe y serait **refusée avec tout le
   *     geste** (plus de `AVANCE` avant le zéro), ou, notée dans l'ordre,
   *     elle décalerait d'un rang toutes les suivantes. Le pavé l'ignore,
   *     comme il ignore les frappes pendant la démonstration de l'écho ;
   *     il s'ouvre une fenêtre (servie) avant le premier temps, pour qui
   *     l'anticipe ;
   *   - `tour` (écho) : l'instant de « À TOI » ;
   *   - `frappes` : combien de frappes le serveur lit — `beats` au tempo et
   *     au contretemps, un instant chacune à l'écho et au crescendo. La
   *     dernière **finit le geste** : `noterContre` ne lit que celles-là,
   *     une de plus ne changerait rien à la note ;
   *   - `fin` : quand la fenêtre se ferme, si la dernière frappe n'est pas
   *     venue.
   *
   * `null` pour un geste sans pulsation, ou **sans durées servies lisibles** :
   * aucun tempo n'est inventé. Le tempo, sans intervalle, battait toutes les
   * quatre millisecondes, vibrait d'autant et ne finissait jamais.
   *
   * Pure, et exposée : `gestes:test` joue ces grilles contre la note du
   * serveur, sans navigateur.
   *
   * @param {string} kind    le geste (tempo, contretemps, echo, crescendo)
   * @param {object} gestes  la configuration servie
   * @returns {{ pulsations: number[], zero: number|null, ouvert: number,
   *             tour?: number, frappes: number, fin: number }|null}
   */
  function grille(kind, gestes) {
    const g = gestes?.[kind];
    if (!g || typeof g !== 'object' || !FRAPPE.includes(kind)) return null;
    /* Une fenêtre d'avance pour qui anticipe le premier temps, jamais plus
       que ce que le serveur laisse passer. */
    const avance = Math.min(Number(g.window) > 0 ? Number(g.window) : 0, AVANCE);

    if (kind === 'tempo' || kind === 'contretemps') {
      const pas = Number(g.interval);
      const temps = Number(g.beats);
      if (!(pas > 0 && Number.isInteger(temps) && temps > 0)) return null;
      /* Le contretemps bat un temps de plus que ses frappes : on tape entre
         deux pulsations, il en faut une de chaque côté de la dernière. */
      const combien = kind === 'tempo' ? temps : temps + 1;
      const pulsations = Array.from({ length: combien }, (_, k) => (k + 1) * pas);
      /* La fenêtre se ferme un souffle après le dernier temps : le temps
         d'y taper (420 ms au tempo, 360 au contretemps, comme avant). */
      const fin = pulsations[combien - 1] + (kind === 'tempo' ? 420 : 360);
      return { pulsations, zero: pas, ouvert: pas - avance, frappes: temps, fin };
    }

    const instants = Array.isArray(g.instants) ? g.instants.map(Number) : [];
    if (!instants.length || !instants.every((t) => Number.isFinite(t) && t >= 0)) return null;
    const dernier = instants[instants.length - 1];
    if (kind === 'crescendo') {
      /* **Un temps d'avance, comme au tempo.** Le crescendo battait son
         premier temps à l'ouverture même, là où le serveur l'attend : la
         grille et la note étaient d'accord, mais ce temps-là ne se voyait
         pas venir. Il coûtait un temps de réaction à chacun — deux dixièmes
         sur une fenêtre de 165 ms, le premier temps perdu : 0,86 au lieu de
         0,96 au banc du lot 6 —, et aucun entraînement n'y changeait rien.

         L'ouverture devient le temps zéro, qu'on ne frappe pas : le premier
         temps tombe un intervalle plus tard — le premier du crescendo, le
         plus lent —, et le joueur l'attend comme il attend le premier temps
         du tempo. Le zéro du serveur suit la première pulsation (`zero`) :
         les frappes rendues ne changent pas d'un chiffre, rien n'est à
         toucher au serveur. **Le chant suit la même grille** (`son.js`, le
         chant du geste) : il doit lui aussi partir après ce temps d'avance. */
      const decompte = instants.length > 1 ? Math.max(0, instants[1] - instants[0]) : 0;
      return {
        pulsations: instants.map((t) => t + decompte), zero: decompte,
        ouvert: Math.max(0, decompte - avance), frappes: instants.length,
        fin: decompte + dernier + 600,
      };
    }
    /* L'écho : la démonstration, puis « À TOI » sept cents millisecondes
       après sa dernière frappe, et le temps de refaire le motif.

       **Un temps d'avance à la démonstration, comme au crescendo.** Elle
       battait son premier coup à l'ouverture même. La tribune chante ces
       instants-là (`son.js`, le chant du geste, qui lit cette grille), et un
       coup dû à l'instant zéro est déjà passé quand le chant part, d'une
       latence de sortie au moins : le motif glissait d'un bloc, entendu une
       cinquantaine de millisecondes derrière son dessin sur le Chrome du
       banc ; et au-delà de cent cinquante millisecondes — un casque sans
       fil —, son premier coup se taisait. Au banc du lot 6 (une latence de
       sortie simulée), cent vingt de plus suffisaient : quatre coups
       entendus sur cinq, pour les sept motifs. On n'écoute pas un motif
       dont le premier coup manque.

       L'avance est **le temps le plus court du motif** (son unité) : un
       temps qu'on ne frappe pas, avant le premier coup, comme le zéro du
       crescendo. Le plus court, et non le premier intervalle comme au
       crescendo : les motifs durent tous le même nombre d'unités, c'est ce
       qui les rend d'égale difficulté (`MOTIFS`, `gestures.js`), et une
       avance prise sur le premier intervalle ferait attendre trois unités
       avant l'un et une seule avant l'autre. Rien ne change pour la note :
       le zéro de l'écho est la première frappe du joueur (`zero: null`),
       qui vient après « À TOI ». */
    const ecarts = instants.slice(1).map((t, k) => t - instants[k]).filter((e) => e > 0);
    const decompte = ecarts.length ? Math.min(...ecarts) : 0;
    const tour = decompte + dernier + 700;
    return {
      pulsations: instants.map((t) => t + decompte), zero: null, ouvert: tour, tour,
      frappes: instants.length, fin: tour + dernier + 900,
    };
  }

  /* **Les vibrations se taisent sous le calme « vibrations »** du tiroir.
     La question se pose à chaque appel, jamais une fois pour toutes : le
     joueur peut changer d'avis en pleine partie. `FX.calme` répond quand
     fx.js est là ; sinon l'attribut de la racine, que menu.js pose lui
     aussi, dit la même chose — un fx.js qui manque ne doit pas rallumer
     les vibrations. */
  const calmeVibrations = () => window.FX?.calme?.('vibrations')
    ?? (document.documentElement.dataset.calme ?? '').split(' ').includes('vibrations');
  const buzz = (ms) => {
    if (calmeVibrations()) return;
    try { navigator.vibrate?.(ms); } catch { /* tant pis */ }
  };

  /* **Le retour de chaque toucher : un tic et huit millisecondes.** Le même
     partout, pour qu'on sente qu'une frappe a pris sans avoir à regarder — et
     assez court pour ne pas se confondre avec la vibration d'un gain. Le son
     passe par `FX.son`, donc par le moteur commun, qui garde le calme « sons »
     ; la vibration par `buzz`, qui garde le calme « vibrations ». Aucun des
     deux ne porte seul une information : le compteur du pavé change aussi. */
  const tic = () => {
    try { window.FX?.son?.('tic'); } catch { /* le son ne casse jamais un geste */ }
    buzz(8);
  };

  /* La dernière frappe du dernier geste joué dans chaque zone (voir
     `DELAI_VERDICT` : ce qu'elle est, geste par geste) : c'est d'elle que se
     compte l'attente du verdict. Rangée par zone, et non dans une seule
     variable : une page qui ouvrirait deux fenêtres ne doit pas faire courir
     l'attente de l'une sur l'horloge de l'autre. */
  const reperes = new WeakMap();

  /* Les éléments que ce fichier vient de poser lui-même dans la zone. Il ne
     cherche jamais rien d autre dans la page : les deux écrans n ont pas le
     même balisage, et c est très bien ainsi. */
  const $ = (id) => document.getElementById(id);

  /**
   * Garder le doigt, même s il sort du cadre.
   *
   * setPointerCapture **lève** quand le pointeur n est plus actif — c est le
   * cas d un événement synthétique, mais aussi d un doigt relâché entre-temps.
   * L appel était en tête du gestionnaire d appui : il emportait la ligne
   * suivante, celle qui pose le point de départ du tracé, et tous les
   * mouvements qui suivaient lisaient un point nul. Le geste mourait pour
   * toute sa durée, sans que rien ne le dise.
   *
   * La capture est un confort ; le tracé est le geste. On prend donc le point
   * d abord, et la capture ensuite, sous garde.
   */
  const prendre = (pad, e) => {
    try { pad.setPointerCapture?.(e.pointerId); } catch { /* doigt déjà parti */ }
  };

  /**
   * Joue un geste et rend ses instants.
   *
   * @param kind    le geste — l'un des dix.
   * @param gestes  la configuration envoyée par le serveur (`you.gestes`).
   * @param el      les éléments de la page : `{ boite, titre, aide, zone }`.
   *   Les deux écrans n'ont pas les mêmes identifiants, et c'est très bien —
   *   ce fichier n'a pas à connaître leur balisage.
   *   `el.origine` (facultatif) : l'instant `performance.now()` que la page
   *   vient de donner au chant de la tribune (`TBF_SON.chantDuGeste`, même
   *   tâche). Un geste de rythme (`FRAPPE`) le prend pour l'ouverture de sa
   *   grille : la pulsation dessinée, le chant entendu et les frappes
   *   comptées partent alors du **même** instant, et non de deux lectures de
   *   l'horloge. Absent, plus vieux que `ORIGINE_MAX`, ou pour un geste qui
   *   ne se chante pas — ses minuteries partent de l'appel, son zéro aussi —,
   *   le geste prend le sien à l'entrée.
   */
  function jouer(kind, gestes, el = {}) {
    const zone = el.zone;
    const ici = performance.now();
    const origine = typeof el.origine === 'number' && FRAPPE.includes(kind) ? el.origine : NaN;
    const t0 = Number.isFinite(origine) && origine <= ici && ici - origine <= ORIGINE_MAX ? origine : ici;
    const taps = [];
    const maintenant = () => Math.round(performance.now() - t0);
    /* L'instant (`performance.now()`) de la frappe d'où se comptera
       l'attente du verdict : la dernière prise par un geste de rythme, le
       lâcher qui finit la relance ou le sang-froid. Nul pour les autres
       gestes, dont la fin tient lieu de dernière frappe (`DELAI_VERDICT`). */
    let derniere = null;

    return new Promise((resolve) => {
      /* Ce que la fenêtre rendra. Les dix gestes rendent leurs frappes ;
         les cinq épreuves posent ici un objet — un tracé, une grille, une
         suite — et c est lui qui part. */
      let rendre = null;
      let fini = false;
      const finir = () => {
        if (fini) return;
        fini = true;
        // Les minuteries sont **nulées** en même temps qu'elles sont effacées :
        // `clearInterval` laisse un identifiant vrai derrière lui, et ce projet
        // a déjà payé cette erreur quatre fois.
        for (const t of minuteries) { clearInterval(t); clearTimeout(t); }
        minuteries.length = 0;
        /* « C'EST FAIT » n'a plus rien à finir : retiré, il laisse la place au
           tampon et ne se propose plus pendant qu'on attend le verdict. */
        zone?.querySelector('#valider')?.remove();
        /* **Le geste fini ne répond plus.** La fenêtre reste ouverte le temps
           du verdict (`attendre`), et une frappe de plus enfonçait encore la
           bâche, avec son tic, sous un tampon qui disait déjà que c'était
           joué. Ce qu'elle aurait noté ne partait nulle part : les frappes
           étaient déjà rendues. */
        const joue = zone?.querySelector('#pad');
        if (joue) {
          joue.onpointerdown = null; joue.onpointerup = null; joue.onpointermove = null;
          joue.onpointercancel = null; joue.onpointerleave = null;
          /* Le pavé remonte s'il était enfoncé, et l'endurance, qui finit doigt
             posé, ne verra pas son relâchement : le tampon du verdict va
             claquer dessus, et une bâche restée plaquée au mur dirait qu'on
             appuie encore. **Sauf la frappe qui vient de finir le geste** :
             son relâchement (`relache`, 80 ms) est déjà en route, et retiré
             dans la même tâche, l'enfoncement ne se verrait pas — la dernière
             frappe d'un geste de rythme serait la seule sans retour. */
          if (!relache) joue.classList.remove('hit');
        }
        if (zone) reperes.set(zone, derniere ?? performance.now());
        resolve(rendre ?? taps);
      };
      const minuteries = [];
      const apres = (ms, fn) => { const t = setTimeout(fn, ms); minuteries.push(t); return t; };
      const chaque = (ms, fn) => { const t = setInterval(fn, ms); minuteries.push(t); return t; };
      /* **À l'instant `t` du geste**, compté depuis son zéro, et non depuis
         l'appel : chaque pulsation est posée sur la grille elle-même. Le
         `setInterval` qui les battait dérivait de quelques millisecondes à
         chaque temps — huit temps, c'est l'écart d'une fenêtre qui se
         creuse entre ce qu'on voit et ce qui est noté — et il continuait de
         battre jusqu'à `finir` : sous 420 ms d'intervalle (360 au
         contretemps), il dessinait un temps de trop après le dernier temps
         noté (vu au banc : cinq pulsations pour quatre temps de 250 ms). */
      const aLInstant = (t, fn) => apres(Math.max(0, t0 + t - performance.now()), fn);

      /* ---------------------------------------------------- les formes */

      /**
       * Le pavé qu'on frappe, avec son compteur : la bâche ronde.
       *
       * Le balisage est celui de la brique (`ui.css`, « le pavé de geste, la
       * bâche ronde ») : `.pad.tbf-pave`, et `data-frappe` sur les quatre
       * gestes de frappe seulement — c'est lui qui permet à la feuille
       * d'enfoncer la bâche, et à elle seule. `data-geste` dit aux suites quel
       * geste se joue ; la couleur du geste (`--c`) est posée sur le pavé
       * lui-même, et non héritée de la page : c'est ce fichier qui la connaît.
       */
      const enfonce = FRAPPE.includes(kind);
      const pave = (gros, petit, anneau = false) => {
        zone.innerHTML = `<div class="pad tbf-pave" id="pad"${enfonce ? ' data-frappe' : ''}
          data-geste="${String(kind ?? '').replace(/[^\w-]/g, '')}" style="--c:${couleur(kind)}">
          ${anneau ? '<div class="ring" id="ring"></div>' : ''}
          <div style="text-align:center">
            <div class="n" id="n">${gros}</div>
            <div class="s" id="s">${petit}</div></div></div>`;
        return document.getElementById('pad');
      };
      const dit = (gros, petit) => {
        const a = document.getElementById('n');
        const b = document.getElementById('s');
        if (a && gros != null) a.textContent = gros;
        if (b && petit != null) b.textContent = petit;
      };
      const battre = () => {
        const r = document.getElementById('ring');
        if (!r) return;
        r.classList.remove('beat'); void r.offsetWidth; r.classList.add('beat');
      };
      /**
       * Ce que le pavé rend à une frappe, selon le geste.
       *
       * Sur les quatre gestes de frappe (`FRAPPE`) : `.hit` le temps de
       * quatre-vingts millisecondes — la feuille enfonce de quatre pixels le
       * pavé qui porte `data-frappe`, et l'assombrit à la place sous le
       * mouvement réduit et le calme — et une bouffée de la couleur du geste.
       * Sur tous les autres : rien qu'on voie bouger, seulement le tic et les
       * huit millisecondes. Le martelage ne prend même plus `.hit` : il
       * l'avait, pour un éclat de fond à chaque frappe, et c'est précisément
       * ce que la direction lui retire.
       *
       * Le relâchement est une minuterie **à part**, et non une de celles que
       * `finir` efface : une frappe qui tombe juste avant la fin laisserait
       * sinon la bâche plaquée au mur. `finir` la remonte de toute façon.
       */
      let relache = 0;
      const frapper = (pad) => {
        tic();
        if (!enfonce) return;
        pad.classList.add('hit');
        clearTimeout(relache);
        relache = setTimeout(() => { relache = 0; pad.classList.remove('hit'); }, 80);
        bouffer(pad);
      };

      /**
       * La bouffée d'une frappe : une `.tbf-bouffee` du vocabulaire, posée
       * **dans** le pavé, en premier enfant. La feuille la règle autour du
       * disque, sa taille et sa couleur comprises (`.tbf-pave > .tbf-bouffee`) :
       * elle ne passe jamais sur la craie, ni sur le chiffre.
       *
       * **Une seule à la fois** : celle de la frappe précédente est retirée
       * avant de poser la nouvelle. Au plus vite du crescendo, quatre bouffées
       * se chevaucheraient, chacune en `mix-blend-mode` — et c'est sur ce
       * geste-là que la régularité se joue.
       *
       * Retirée à la fin de sa dissipation, **et** par une minuterie : sous le
       * mouvement réduit ou le calme, elle ne s'anime pas du tout (la feuille
       * l'éteint), et un onglet caché gèle les animations — une fin
       * d'animation qui ne vient jamais laisserait les bouffées s'empiler.
       */
      const bouffer = (pad) => {
        pad.querySelector(':scope > .tbf-bouffee')?.remove();
        const b = document.createElement('i');
        b.className = 'tbf-bouffee';
        b.setAttribute('aria-hidden', 'true');
        let filet = 0;
        const retirer = (e) => {
          if (e && e.animationName !== 'tbf-dissipe') return;
          clearTimeout(filet);
          filet = 0;
          b.removeEventListener('animationend', retirer);
          b.remove();
        };
        b.addEventListener('animationend', retirer);
        filet = setTimeout(() => retirer(), 1200);
        pad.prepend(b);
      };

      /**
       * Les gestes de frappe : on note l'instant, on montre le compte.
       *
       * Avec une grille (`grille`), l'instant se compte depuis **le zéro du
       * serveur** et le pavé ne prend rien avant `ouvert` : une frappe du
       * décompte ne compte pas, ne s'affiche pas et ne fait pas de tic — un
       * compteur qui monterait pour une frappe qui ne part pas mentirait.
       * Sans grille (martelage, salves, mesure), depuis l'ouverture.
       *
       * **Et la dernière frappe attendue finit le geste** (`gr.frappes`) :
       * les frappes partent avec elle, et l'attente du verdict se compte
       * depuis elle (`derniere`). Le serveur ne lit que ces frappes-là, dans
       * l'ordre : une de plus ne changeait rien à la note, et la fenêtre
       * tenait le joueur un temps et demi de plus devant un pavé qui n'avait
       * plus rien à lui demander. Le martelage, les salves et la mesure n'ont
       * pas de compte qui finisse : leur durée est l'épreuve (« ni plus, ni
       * moins », à la mesure, se joue jusqu'au bout).
       */
      const frappes = (pad, sous, gr = null) => {
        const zero = gr?.zero ?? 0;
        const ouvert = gr?.ouvert ?? 0;
        pad.onpointerdown = () => {
          const ici = performance.now();
          const t = ici - t0;
          if (t < ouvert) return;
          taps.push(Math.round(t - zero));
          dit(taps.length, sous);
          frapper(pad);
          if (!gr) return;
          derniere = ici;
          if (taps.length >= gr.frappes) finir();
        };
      };

      /**
       * Les gestes de tenue : on note l'appui **et** le relâchement.
       *
       * `pendant` ne suit qu'un **vrai** lâcher, un doigt qui était posé. Il
       * suivait n'importe quel `pointerleave` : à la souris, le pointeur qui
       * sortait du pavé avant d'appuyer finissait la relance au bout de
       * 120 ms, sans un appui, et rendait un geste vide.
       */
      const tenir = (pad, pendant) => {
        pad.onpointerdown = () => { taps.push(maintenant()); pad.classList.add('hit'); tic(); };
        const lacher = () => {
          if (taps.length % 2 !== 1) return;
          taps.push(maintenant());
          pad.classList.remove('hit');
          pendant?.();
        };
        pad.onpointerup = lacher;
        pad.onpointercancel = lacher;
        pad.onpointerleave = lacher;
      };

      /**
       * « C'EST FAIT » — finir avant la fin du temps.
       *
       * Trois épreuves se **terminent** vraiment : la mosaïque est refaite, les
       * paires sont retrouvées, les cartons sont ramassés. Le joueur le sait
       * avant la minuterie — souvent trois ou quatre secondes avant — et il
       * restait devant un écran plein pendant que le duel continuait derrière.
       * Une épreuve qui fait perdre du temps après avoir été réussie punit la
       * réussite.
       *
       * Le bouton ne remplace pas la minuterie, il la double : elle reste le
       * plafond pour qui hésite, il devient le plancher pour qui a fini. Et il
       * ne paraît que sur ces épreuves-là — sur le tempo ou le martelage, le
       * temps **est** l'épreuve, et un bouton qui l'écourte n'aurait aucun sens.
       */
      const valider = (texte = 'C’EST FAIT') => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'tbf-valider';
        b.id = 'valider';
        b.textContent = texte;
        b.onclick = finir;
        zone.appendChild(b);
        return b;
      };

      /* ------------------------------------------------------ les dix */

      switch (kind) {
        /* Les quatre gestes de rythme suivent leur grille (`grille`, plus
           haut) : les pulsations posées sur elle, les frappes comptées depuis
           le zéro du serveur. Sans durées servies lisibles, il n'y a rien à
           battre : la fenêtre se referme aussitôt, sans tempo inventé. */
        case 'tempo': {
          const pad = pave(0, 'SUR LE RYTHME', true);
          const gr = grille('tempo', gestes);
          if (!gr) { apres(0, finir); break; }
          frappes(pad, 'SUR LE RYTHME', gr);
          // Exactement les temps servis : rien ne bat après le dernier.
          for (const t of gr.pulsations) aLInstant(t, () => { battre(); buzz(12); });
          aLInstant(gr.fin, finir);
          break;
        }

        case 'contretemps': {
          /* La pulsation se voit, mais il faut taper **entre** deux. On la
             marque donc plus discrètement que pour le tempo : c'est le
             silence qui compte, pas le coup. */
          const pad = pave(0, 'ENTRE LES TEMPS', true);
          const gr = grille('contretemps', gestes);
          if (!gr) { apres(0, finir); break; }
          frappes(pad, 'ENTRE LES TEMPS', gr);
          for (const t of gr.pulsations) aLInstant(t, () => { battre(); buzz(6); });
          aLInstant(gr.fin, finir);
          break;
        }

        case 'echo': {
          /* Le motif se joue d'abord tout seul — c'est la moitié du geste :
             on ne peut pas refaire ce qu'on n'a pas écouté. Le pavé ne répond
             pas pendant la démonstration, sinon la première frappe du joueur
             tomberait dans le motif et fausserait tout. */
          const pad = pave('…', 'ÉCOUTE', true);
          const gr = grille('echo', gestes);
          if (!gr) { apres(0, finir); break; }
          for (const t of gr.pulsations) aLInstant(t, () => { battre(); buzz(10); });
          aLInstant(gr.tour, () => {
            dit(0, 'À TOI');
            /* **Le zéro est la première frappe du joueur**, pas l'apparition
               de « À TOI » : le serveur note le motif depuis son premier coup,
               et un motif juste, commencé un temps de réaction plus tard,
               tombait tout entier hors de ses fenêtres. */
            let premiere = null;
            pad.onpointerdown = () => {
              const t = performance.now();
              if (premiere === null) premiere = t;
              taps.push(Math.round(t - premiere));
              dit(taps.length, 'À TOI'); frapper(pad);
              // Le motif refait en entier finit le geste (voir `frappes`).
              derniere = t;
              if (taps.length >= gr.frappes) finir();
            };
          });
          aLInstant(gr.fin, finir);
          break;
        }

        case 'crescendo': {
          const pad = pave(0, 'ACCÉLÈRE', true);
          const gr = grille('crescendo', gestes);
          if (!gr) { apres(0, finir); break; }
          frappes(pad, 'ACCÉLÈRE', gr);
          for (const t of gr.pulsations) aLInstant(t, () => { battre(); buzz(8); });
          aLInstant(gr.fin, finir);
          break;
        }

        case 'relance': {
          /* Tenir, puis lâcher sur la pulsation. La barre monte jusqu'à
             l'instant attendu : c'est elle qui donne le moment, et elle rend
             le geste jouable sans compter dans sa tête. */
          const g = gestes?.relance ?? {};
          const pad = pave('TIENS', 'PUIS LÂCHE SUR LE COUP', false);
          pad.insertAdjacentHTML('beforeend', '<i class="jauge" id="jauge"></i>');
          const jauge = document.getElementById('jauge');
          /* La jauge monte, puis s'arrête pleine. Sa minuterie tournait
             jusqu'à la fin du geste et, la jauge pleine, appelait à chaque
             tour une pulsation (sans anneau à battre) et une vibration de
             18 ms : jusqu'à vingt-sept vibrations d'affilée, toutes les
             quarante millisecondes, pendant qu'on cherchait justement le
             bon instant pour lâcher. */
          const monte = chaque(40, () => {
            const part = Math.min(1, (performance.now() - t0) / g.attente);
            if (jauge) jauge.style.transform = `scaleX(${part})`;
            if (part >= 1) clearInterval(monte);
          });
          /* **Le signal « lâche », une fois**, à l'instant même que le serveur
             attend (`attente`, compté depuis l'ouverture comme le lâcher
             rendu), et non au tour de minuterie suivant : une vibration qui
             annonce l'instant n'a pas le droit d'arriver quarante
             millisecondes après lui. La jauge pleine dit la même chose à
             l'œil. Sans attente servie lisible, pas de signal inventé. */
          if (Number(g.attente) > 0) aLInstant(Number(g.attente), () => buzz(18));
          tenir(pad, () => { derniere ??= performance.now(); apres(120, finir); });
          apres(g.attente + 1100, finir);
          break;
        }

        case 'salves': {
          const g = gestes?.salves ?? {};
          const pad = pave(0, `${g.rafales} RAFALES`, true);
          frappes(pad, `${g.rafales} RAFALES`);
          // Un battement au départ de chaque rafale : le silence se voit.
          const parRafale = g.parRafale ?? 4;
          const longueur = parRafale * 130;
          for (let r = 0; r < (g.rafales ?? 3); r++) {
            apres(r * (longueur + g.silence), () => { battre(); buzz(16); });
          }
          apres((g.rafales ?? 3) * (longueur + g.silence) + 300, finir);
          break;
        }

        case 'hold': {
          const g = gestes?.hold ?? {};
          const pad = pave('0%', 'NE LÂCHE PAS', false);
          tenir(pad);
          const debut = performance.now();
          chaque(60, () => {
            const part = Math.min(1, (performance.now() - debut) / g.need);
            dit(`${Math.round(part * 100)}%`, 'NE LÂCHE PAS');
            if (part >= 1) apres(200, finir);
          });
          break;
        }

        case 'tenue': {
          /* Le geste du sang-froid. La jauge monte, et **rien n'indique la
             limite** : c'est tout l'exercice. Elle vire au rouge quand on
             s'approche, parce qu'un risque qu'on ne peut pas sentir n'est pas
             un risque, c'est un piège. */
          const g = gestes?.tenue ?? {};
          const pad = pave('0%', 'LÂCHE AVANT LA FIN', false);
          pad.insertAdjacentHTML('beforeend', '<i class="jauge" id="jauge"></i>');
          const jauge = document.getElementById('jauge');
          let depuis = null;
          pad.onpointerdown = () => {
            taps.push(maintenant()); depuis = performance.now();
            pad.classList.add('hit'); tic();
          };
          /* Le lâcher finit le geste, et l'attente du verdict part de lui.
             Seulement un **vrai** lâcher, comme à la relance (`tenir`) : un
             pointeur de souris qui sortait du pavé avant d'appuyer finissait
             le sang-froid au bout de 150 ms, sans un appui. */
          const lacher = () => {
            if (taps.length % 2 !== 1) return;
            taps.push(maintenant());
            pad.classList.remove('hit');
            derniere ??= performance.now();
            apres(150, finir);
          };
          pad.onpointerup = lacher; pad.onpointercancel = lacher; pad.onpointerleave = lacher;
          chaque(50, () => {
            if (depuis === null) return;
            const part = (performance.now() - depuis) / g.limite;
            dit(`${Math.round(Math.min(1.4, part) * 100)}%`, 'LÂCHE AVANT LA FIN');
            if (jauge) {
              jauge.style.transform = `scaleX(${Math.min(1, part)})`;
              jauge.style.background = part > 0.82 ? '#E0402C' : '';
            }
            if (part > 1.35) finir();          // il a tout perdu : inutile d'attendre
          });
          apres(g.limite + 2500, finir);
          break;
        }

        case 'retenue': {
          const g = gestes?.retenue ?? {};
          const pad = pave(0, `EXACTEMENT ${g.exact}`, false);
          frappes(pad, `EXACTEMENT ${g.exact}`);
          apres(g.ms, finir);
          break;
        }

        /* --------------------------------------------- les cinq épreuves

           Elles ne rendent pas une liste d'instants mais un objet : un tracé,
           une grille, une suite. `finir` sait le faire — il rend `rendre` dès
           que cette variable est posée, et les frappes sinon. */

        case 'tifo': {
          const g = gestes?.tifo ?? {};
          rendre = { trace: [] };
          const forme = (g.points ?? []).map((p, i) =>
            `${i ? 'L' : 'M'}${(p.x * 100).toFixed(1)} ${(p.y * 100).toFixed(1)}`).join(' ');
          zone.innerHTML = `<div class="pad trace" id="pad">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" class="tifoSvg">
              <path class="modele" d="${forme} Z"></path>
              <path class="doigt" id="tifoDoigt" d=""></path>
            </svg>
            <div class="s" id="s">SUIS LE TRAIT</div></div>`;
          const pad = $('pad');
          const doigt = $('tifoDoigt');
          /* Les coordonnées sont **relatives au cadre**, pas à l'écran : le
             serveur note dans un carré de zéro à un, et les deux pages n'ont
             pas la même taille de zone de jeu. */
          const situer = (e) => {
            const r = pad.getBoundingClientRect();
            return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
          };
          let pose = false;
          pad.style.touchAction = 'none';
          pad.onpointerdown = (e) => {
            pose = true;
            rendre.trace.push(situer(e));
            prendre(pad, e);
            tic();
          };
          pad.onpointermove = (e) => {
            if (!pose) return;
            rendre.trace.push(situer(e));
            doigt.setAttribute('d', rendre.trace
              .map((p, i) => `${i ? 'L' : 'M'}${(p.x * 100).toFixed(1)} ${(p.y * 100).toFixed(1)}`)
              .join(' '));
          };
          pad.onpointerup = () => { pose = false; };
          apres(g.ms ?? 6000, finir);
          break;
        }

        case 'echarpe': {
          const g = gestes?.echarpe ?? {};
          rendre = { trace: [] };
          zone.innerHTML = `<div class="pad trace" id="pad">
            <div class="rond"></div>
            <div style="text-align:center"><div class="n" id="n">0</div>
            <div class="s">${(g.sens ?? 1) < 0 ? 'TOURS — SENS INVERSE' : 'TOURS'}</div></div></div>`;
          const pad = $('pad');
          const situer = (e) => {
            const r = pad.getBoundingClientRect();
            return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
          };
          let pose = false;
          let angle = 0;
          let dernier = null;
          pad.style.touchAction = 'none';
          pad.onpointerdown = (e) => {
            pose = true;
            dernier = situer(e);
            rendre.trace.push(dernier);
            prendre(pad, e);
            tic();
          };
          pad.onpointermove = (e) => {
            if (!pose || !dernier) return;
            const p = situer(e);
            rendre.trace.push(p);
            /* Le compteur de tours n'est **qu'un affichage**. Le serveur
               recalcule tout depuis le tracé : ce nombre-ci ne voyage jamais,
               et s'il se trompait, il ne tromperait que l'œil. */
            const a0 = Math.atan2(dernier.y - 0.5, dernier.x - 0.5);
            const a1 = Math.atan2(p.y - 0.5, p.x - 0.5);
            let d = a1 - a0;
            if (d > Math.PI) d -= Math.PI * 2;
            if (d < -Math.PI) d += Math.PI * 2;
            angle += d * (g.sens ?? 1);
            dernier = p;
            const tours = Math.max(0, angle / (Math.PI * 2));
            $('n').textContent = tours.toFixed(1);
            if (tours >= (g.tours ?? 3) + 0.15) apres(180, finir);
          };
          pad.onpointerup = () => { pose = false; };
          apres(g.ms ?? 7000, finir);
          break;
        }

        case 'mosaique': {
          const g = gestes?.mosaique ?? {};
          const cotes = g.cotes ?? 4;
          const n = cotes * cotes;
          rendre = { grille: Array.from({ length: n }, () => 0), instants: [] };
          zone.innerHTML = `<div class="tbf-grille" id="pad"
            style="grid-template-columns:repeat(${cotes},1fr)">${
            Array.from({ length: n }, (_, i) =>
              `<i data-c="${i}" class="${g.grille?.[i] ? 'on' : ''}"></i>`).join('')
            }</div><div class="s" id="s">RETIENS</div>`;
          const pad = $('pad');
          /* L'aperçu, puis le noir, puis à toi. Les cases ne deviennent
             touchables qu'après : sans ça, on recopie au lieu de retenir, et
             l'épreuve ne mesure plus rien. */
          apres(g.apercu ?? 1100, () => {
            for (const c of pad.children) c.className = '';
            $('s').textContent = 'REFAIS-LA';
            pad.onpointerdown = (e) => {
              const c = e.target.closest('[data-c]');
              if (!c) return;
              const i = Number(c.dataset.c);
              rendre.grille[i] = rendre.grille[i] ? 0 : 1;
              c.className = rendre.grille[i] ? 'mise' : '';
              rendre.instants.push(maintenant());
              tic();
            };
            valider();
            apres(g.ms ?? 9000, finir);
          });
          break;
        }

        case 'memoire': {
          const g = gestes?.memoire ?? {};
          const cartes = g.cartes ?? [];
          rendre = { paires: [], instants: [] };
          zone.innerHTML = `<div class="tbf-grille memo" id="pad"
            style="grid-template-columns:repeat(4,1fr)">${
            cartes.map((v, i) => `<i data-c="${i}" data-v="${v}" class="vue">${v + 1}</i>`)
              .join('')}</div><div class="s" id="s">RETIENS LES PAIRES</div>`;
          const pad = $('pad');
          apres(g.apercu ?? 2000, () => {
            for (const c of pad.children) c.className = '';
            $('s').textContent = 'RETROUVE-LES';
            let ouverte = null;
            pad.onpointerdown = (e) => {
              const c = e.target.closest('[data-c]');
              if (!c || c.classList.contains('prise') || c === ouverte) return;
              c.className = 'vue';
              rendre.instants.push(maintenant());
              tic();
              if (!ouverte) { ouverte = c; return; }
              const a = Number(ouverte.dataset.c);
              const b = Number(c.dataset.c);
              rendre.paires.push([a, b]);
              /* On annonce la paire **telle qu'elle est jouée**, juste ou non.
                 C'est le serveur qui dit si elle l'était : recopier ici la
                 règle de comparaison en ferait une seconde vérité, et celle-ci
                 mentirait le jour où l'autre changerait. Ce qu'on décide ici
                 n'est que la couleur de la case. */
              const juste = ouverte.dataset.v === c.dataset.v;
              const pris = [ouverte, c];
              ouverte = null;
              apres(juste ? 260 : 620, () => {
                for (const x of pris) x.className = juste ? 'prise' : '';
              });
              if (rendre.paires.length >= (g.paires ?? 4)) apres(700, finir);
            };
            valider('J’AI FINI');
            apres(g.ms ?? 12000, finir);
          });
          break;
        }

        case 'capo': {
          const g = gestes?.capo ?? {};
          const zones = g.zones ?? 6;
          rendre = { suite: [], instants: [] };
          zone.innerHTML = `<div class="tbf-grille capo" id="pad"
            style="grid-template-columns:repeat(3,1fr)">${
            Array.from({ length: zones }, (_, i) => `<i data-c="${i}"></i>`).join('')
            }</div><div class="s" id="s">REGARDE</div>`;
          const pad = $('pad');
          const suite = g.suite ?? [];
          let i = 0;
          const montrer = chaque(g.pas ?? 620, () => {
            for (const c of pad.children) c.className = '';
            if (i >= suite.length) {
              clearInterval(montrer);
              $('s').textContent = 'À TOI';
              pad.onpointerdown = (e) => {
                const c = e.target.closest('[data-c]');
                if (!c) return;
                rendre.suite.push(Number(c.dataset.c));
                rendre.instants.push(maintenant());
                c.className = 'on';
                apres(140, () => { c.className = ''; });
                tic();
                if (rendre.suite.length >= suite.length) apres(320, finir);
              };
              apres(g.ms ?? 9000, finir);
              return;
            }
            const c = pad.children[suite[i++]];
            if (c) c.className = 'on';
            buzz(14);
          });
          break;
        }

        /**
         * **Le tri des cartons.** Ramasser une couleur, laisser les deux
         * autres, le plus vite possible.
         *
         * Rien n'est caché et rien ne s'éteint : c'est la seule épreuve où tout
         * reste à l'écran du début à la fin. Ce qu'elle mesure n'est pas la
         * mémoire mais la discrimination sous la pression du temps — et un
         * mauvais carton coûte un bon, donc s'arrêter quand on n'est plus sûr
         * est un choix qui se défend.
         */
        case 'tri': {
          const g = gestes?.tri ?? {};
          const plateau = g.plateau ?? [];
          const cible = g.cible ?? 0;
          rendre = { touches: [], instants: [] };
          /* Les trois couleurs sont fixes, pas tirées : le joueur doit
             reconnaître « le rouge » d'une partie à l'autre, et une palette qui
             change à chaque fois lui referait apprendre l'épreuve. */
          const TEINTES = ['#E0402C', '#3C82E8', '#F5C33B'];
          const cotes = Math.ceil(Math.sqrt(plateau.length || 1));
          zone.innerHTML = `<div class="tbf-grille tri" id="pad"
            style="grid-template-columns:repeat(${cotes},1fr)">${
            plateau.map((c, i) =>
              `<i data-c="${i}" style="--t:${TEINTES[c] ?? TEINTES[0]}"></i>`).join('')
            }</div><div class="s" id="s">RAMASSE LE <b
              style="color:${TEINTES[cible] ?? TEINTES[0]}">■</b></div>`;
          const pad = $('pad');
          pad.onpointerdown = (e) => {
            const c = e.target.closest('[data-c]');
            if (!c || c.classList.contains('pris')) return;
            const i = Number(c.dataset.c);
            rendre.touches.push(i);
            rendre.instants.push(maintenant());
            /* On montre tout de suite si c'était bon. Le joueur le sait déjà —
               il voit les couleurs — et le lui cacher ne rendrait pas
               l'épreuve plus difficile, seulement moins lisible. */
            c.className = plateau[i] === cible ? 'pris' : 'pris rate';
            /* Un bon carton rend le tic commun ; un mauvais, le tic sourd d'une
               porte fermée et une vibration plus longue. Le tic clair dirait
               « ça a pris » sur une faute que l'épreuve va compter. */
            if (plateau[i] === cible) tic();
            else { try { window.FX?.son?.('sourd'); } catch { /* muet */ } buzz(22); }
          };
          valider('J’AI TOUT RAMASSÉ');
          apres(g.ms ?? 6000, finir);
          break;
        }

        /**
         * **Le compte.** Le rebours s'affiche, puis s'éteint, et il faut tomber
         * juste quand même.
         *
         * La seule épreuve du jeu où il n'y a rien à regarder au moment où l'on
         * agit. On donne donc trois secondes de compte visible pour caler
         * l'horloge, puis on l'éteint : ce qui reste à tenir est l'écart entre
         * ce qu'on a vu et la cible, et il change à chaque fois.
         *
         * `maintenant()` des deux côtés : l'écart rendu est une durée mesurée
         * chez le joueur, jamais un instant absolu. Une horloge décalée de dix
         * minutes n'y change rien.
         */
        case 'compte': {
          const g = gestes?.compte ?? {};
          const cible = g.cible ?? 6000;
          const visible = g.visible ?? 3000;
          const depart = maintenant();
          rendre = { ecoule: 0, instants: [] };
          /* **tbf-ep-compte, et non tbf-compte.** Ce second nom appartient
             désormais à l'éclat d'un compteur qui vient de changer (voir
             ui.css et FX.compter) : l'épreuve prend le préfixe de ses
             sœurs, comme tbf-ep-note et tbf-ep-jauge, et ne clignote plus
             à son ouverture.

             Le rebours s'écrit dès l'ouverture, à sa valeur de départ : la
             case affichait « — » le temps du premier dixième, un tiret à la
             place d'un chiffre qu'on connaissait déjà. */
          zone.innerHTML = `<div class="tbf-ep-compte" id="pad">
            <b id="cpt">${(cible / 1000).toFixed(1)}</b><small id="s">TOUCHE À ZÉRO</small></div>`;
          const cpt = $('cpt');
          /* Le rebours ne se rafraîchit qu'au dixième : à la milliseconde, le
             joueur lirait le chiffre au lieu de compter, et l'épreuve
             mesurerait sa vue.

             `rebours` et non plus `tic` : ce nom-là est désormais le retour
             commun d'un toucher (plus haut), et le masquer ici par un numéro
             de minuterie faisait lever la touche elle-même. */
          const rebours = setInterval(() => {
            const passe = maintenant() - depart;
            if (passe >= visible) {
              cpt.textContent = '';
              cpt.classList.add('noir');
              clearInterval(rebours);
              return;
            }
            cpt.textContent = ((cible - passe) / 1000).toFixed(1);
          }, 100);
          $('pad').onpointerdown = () => {
            if (rendre.ecoule) return;              // un seul coup, le premier
            rendre.ecoule = maintenant() - depart;
            clearInterval(rebours);
            cpt.classList.remove('noir');
            /* La coche est l'icône commune et non l'émoji : celui-ci se
               dessinait autrement d'un téléphone à l'autre, et jurait avec les
               formes au trait de l'épreuve. L'icône mesure un em, donc elle
               prend la taille du chiffre qu'elle remplace ; son nom dit
               « touché » à qui n'a que la lecture d'écran. */
            cpt.innerHTML = '<i class="tbf-ico tbf-ico-coche" role="img" aria-label="Touché"></i>';
            tic();
            finir();
          };
          apres(g.ms ?? 12_000, () => { clearInterval(rebours); finir(); });
          break;
        }

        /**
         * **La bascule.** Le capo désigne un côté ; la bâche dit parfois « à
         * contre-courant », et il faut aller de l'autre.
         *
         * La seule épreuve du jeu où il faut **arrêter un geste déjà parti**.
         * Tout le reste demande de reproduire, de chercher ou de doser ; ici la
         * main sait où aller avant que l'œil ait fini de lire, et c'est ça qu'on
         * mesure.
         *
         * Le signal passe tout seul : on ne peut pas attendre le suivant pour
         * se décider, et ne pas répondre est un choix qui se défend — ça ne
         * rapporte rien, ça ne coûte rien de plus qu'une erreur.
         */
        case 'bascule': {
          const g = gestes?.bascule ?? {};
          const signaux = g.signaux ?? [];
          rendre = { choix: [], instants: [] };
          /* **`tbf-cote`, et non `cote`.** Le duel a sa propre `.cote` — les deux
             moitiés du terrain, en position absolue sur toute la hauteur — et
             les deux boutons la prenaient : deux moitiés d'écran transparentes,
             posées dans le coin, pendant que le bandeau prévu pour eux faisait
             zéro pixel de haut. La bascule marchait au Virage et nulle part
             dans le duel. Ce fichier sert deux pages qu'il ne connaît pas : ce
             qu'il pose dans leur DOM porte le préfixe du code partagé. */
          zone.innerHTML = `<div class="tbf-bascule" id="pad">
            <div class="mot" id="mot">—</div>
            <div class="tbf-cotes">
              <button type="button" class="tbf-cote" data-k="0">◀</button>
              <button type="button" class="tbf-cote" data-k="1">▶</button>
            </div></div>`;
          const mot = $('mot');
          const pad = $('pad');
          let rang = -1;
          let repondu = true;

          /* Une case par signal, remplie à mesure. Sans elle, une absence de
             réponse décalerait tout ce qui suit : la notation lit `choix[i]`
             pour le signal `i`, et un tableau tassé ferait juger la neuvième
             réponse sur le dixième signal. */
          const avancer = () => {
            if (!repondu) rendre.choix.push(null);
            rang++;
            repondu = false;
            if (rang >= signaux.length) { finir(); return; }
            const s = signaux[rang];
            mot.className = `mot ${s.contre ? 'contre' : ''}`;
            mot.innerHTML = s.contre
              ? `<b>À CONTRE-COURANT</b><span>${s.cote ? '▶' : '◀'}</span>`
              : `<b>ON POUSSE</b><span>${s.cote ? '▶' : '◀'}</span>`;
            buzz(s.contre ? [8, 40, 8] : 10);
          };

          pad.onpointerdown = (e) => {
            const b = e.target.closest('[data-k]');
            if (!b || repondu || rang < 0 || rang >= signaux.length) return;
            repondu = true;
            rendre.choix.push(Number(b.dataset.k));
            rendre.instants.push(maintenant());
            b.classList.add('pris');
            apres(140, () => b.classList.remove('pris'));
            tic();
          };

          avancer();
          chaque(g.pas ?? 820, avancer);
          apres(g.ms ?? 10_000, finir);
          break;
        }

        /**
         * **La visée.** Les fumigènes s'allument un par un et ne durent pas.
         *
         * L'œil et la main ensemble, sous une horloge. Le tifo et l'écharpe
         * suivent un tracé qui ne bouge pas et attendent le doigt ; ici la
         * cible s'éteint, et toucher au bon endroit une seconde trop tard ne
         * vaut rien — les deux notes se multiplient.
         *
         * Les coordonnées partent en **fraction du cadre** et non en pixels :
         * le serveur note la même chose sur un téléphone et sur un écran large,
         * et c'est lui qui a décidé où poser les cibles.
         */
        case 'visee': {
          const g = gestes?.visee ?? {};
          const cibles = g.cibles ?? [];
          rendre = { touches: [] };
          zone.innerHTML = '<div class="tbf-visee" id="pad"></div>';
          const pad = $('pad');

          pad.onpointerdown = (e) => {
            const r = pad.getBoundingClientRect();
            if (!r.width || !r.height) return;
            rendre.touches.push({
              x: (e.clientX - r.left) / r.width,
              y: (e.clientY - r.top) / r.height,
              t: maintenant(),
            });
            /* L'éclat marque l'endroit touché, pas la cible : le joueur doit
               voir **son** geste, sinon il ne sait pas s'il a manqué de peu ou
               de loin. */
            const eclat = document.createElement('i');
            eclat.className = 'eclat';
            eclat.style.cssText = `left:${e.clientX - r.left}px;top:${e.clientY - r.top}px`;
            pad.appendChild(eclat);
            apres(400, () => eclat.remove());
            tic();
          };

          /* Chaque cible naît à son instant, **pâlit** quand elle commence à
             valoir moins (`fenetre`) et s'éteint quand elle ne vaut plus rien
             (`vie`). L'affichage durait 1,6 fenêtre alors que la note tombait à
             zéro à la fenêtre : on touchait un rond bien visible, et il ne
             valait déjà plus rien. Ce qu'on voit est maintenant ce qui compte. */
          for (const c of cibles) {
            apres(c.t, () => {
              const n = document.createElement('i');
              n.className = 'cible';
              n.style.cssText = `left:${c.x * 100}%;top:${c.y * 100}%`;
              pad.appendChild(n);
              requestAnimationFrame(() => n.classList.add('vue'));
              const fenetre = g.fenetre ?? 450;
              apres(fenetre, () => n.classList.add('passe'));
              setTimeout(() => n.remove(), g.vie ?? fenetre * 1.6);
            });
          }
          apres((g.ms ?? 8000) + 400, finir);
          break;
        }

        /**
         * **La jauge.** La corde tient, puis saute. Rester dedans.
         *
         * La seule épreuve notée **en continu** : cent mesures plutôt qu'une
         * poignée d'instants. Le sang-froid des dix gestes est un relâchement,
         * une décision unique ; celle-ci demande de tenir trois secondes sans
         * bouger, puis de courir, quatre fois de suite.
         *
         * La bande est dessinée ici à partir des sommets, et **notée ailleurs à
         * partir des mêmes sommets** : la page interpole pour montrer, le
         * serveur interpole pour juger, et c'est lui qui fait foi. Une page qui
         * calculerait sa propre bande rejouerait la faute des Jumelles — voir
         * `gestures.js`.
         */
        case 'jauge': {
          const g = gestes?.jauge ?? {};
          const sommets = g.sommets ?? [];
          const largeur = g.largeur ?? 0.15;
          rendre = { mesures: [] };
          zone.innerHTML = `<div class="tbf-ep-jauge" id="pad">
            <div class="bande" id="bande"></div>
            <div class="curseur" id="cur"></div>
            <div class="s" id="s">GLISSE LE DOIGT — RESTE DANS LA BANDE</div></div>`;
          const pad = $('pad');
          const bande = $('bande');
          const cur = $('cur');

          const centre = (t) => {
            if (!sommets.length) return 0.5;
            if (t <= sommets[0].t) return sommets[0].v;
            for (let i = 1; i < sommets.length; i++) {
              if (t <= sommets[i].t) {
                const part = (t - sommets[i - 1].t)
                  / Math.max(1, sommets[i].t - sommets[i - 1].t);
                return sommets[i - 1].v + (sommets[i].v - sommets[i - 1].v) * part;
              }
            }
            return sommets[sommets.length - 1].v;
          };

          /* `v` est compté **du bas vers le haut** — zéro en bas — parce que
             c'est ainsi qu'on lit une jauge, et que le serveur ne sait rien
             d'un écran. La conversion en pourcentage CSS se fait ici, une fois. */
          let v = 0.5;
          const poser = (e) => {
            const r = pad.getBoundingClientRect();
            if (!r.height) return;
            v = Math.min(1, Math.max(0, 1 - (e.clientY - r.top) / r.height));
            cur.style.bottom = `${v * 100}%`;
          };
          /* Le point d'abord, la capture ensuite et sous garde (voir `prendre`) :
             une capture qui lève emportait la première mesure avec elle. */
          pad.onpointerdown = (e) => { poser(e); prendre(pad, e); tic(); };
          pad.onpointermove = (e) => { if (e.buttons) poser(e); };

          cur.style.bottom = '50%';
          const peindre = () => {
            const c = centre(maintenant());
            bande.style.bottom = `${(c - largeur / 2) * 100}%`;
            bande.style.height = `${largeur * 100}%`;
            cur.classList.toggle('dedans', Math.abs(v - c) <= largeur / 2);
          };
          peindre();
          chaque(40, peindre);

          /* L'échantillon est celui du serveur : c'est lui qui fixe combien de
             mesures il attend, et les compter autrement ferait rejeter une
             réponse honnête pour cause de `minMesures`. */
          chaque(g.echantillon ?? 100, () => {
            rendre.mesures.push({ t: maintenant(), v });
          });
          apres(g.ms ?? 8000, finir);
          break;
        }

        /**
         * **La ola.** Une vague fait le tour de l'anneau ; on touche quand
         * elle passe devant sa tribune — la case cerclée.
         *
         * L'anneau est redessiné à partir des mêmes tours que le serveur :
         * c'est lui qui a décidé des instants de passage, la page ne fait que
         * les montrer. Une horloge à elle ferait passer la vague devant la
         * tribune à un instant que le serveur ne note pas.
         */
        case 'ola': {
          const g = gestes?.ola ?? {};
          const tours = g.tours ?? [];
          const depart = g.depart ?? 700;
          const secteurs = g.secteurs ?? 24;
          const place = g.place ?? 0;
          rendre = { frappes: [] };
          zone.innerHTML = `<div class="tbf-ola" id="pad">
            <div class="tbf-ola-anneau">${Array.from({ length: secteurs }, (_, i) =>
              `<i style="--a:${i / secteurs}"${i === place ? ' class="tbf-ola-moi"' : ''}></i>`).join('')}</div>
            <div class="tbf-ola-mot" id="mot">TA TRIBUNE<br><small>la case entourée</small></div></div>`;
          const pad = $('pad');
          const cases = [...pad.querySelectorAll('.tbf-ola-anneau i')];
          const debuts = [];
          tours.reduce((d, duree) => { debuts.push(d); return d + duree; }, depart);

          /* Le mot du tour n'est réécrit que quand le tour change. Il l'était
             trente fois par seconde, en `innerHTML` : le nœud de texte était
             refait à chaque image pour dire la même chose, pendant l'épreuve
             qui demande justement de regarder l'anneau et rien d'autre. */
          const mot = $('mot');
          const peindre = () => {
            const t = maintenant();
            const k = debuts.findIndex((d, i) => t >= d && t < d + tours[i]);
            cases.forEach((c) => c.classList.remove('tbf-vague', 'tbf-vague2'));
            if (k < 0) return;
            const tete = Math.floor(((t - debuts[k]) / tours[k]) * secteurs);
            cases[tete % secteurs]?.classList.add('tbf-vague');
            cases[(tete + secteurs - 1) % secteurs]?.classList.add('tbf-vague2');
            const dit = `TOUR ${k + 1} / ${tours.length}`;
            if (mot && mot.textContent !== dit) mot.textContent = dit;
          };
          peindre();
          chaque(30, peindre);

          pad.onpointerdown = () => {
            rendre.frappes.push(maintenant());
            const moi = pad.querySelector('.tbf-ola-moi');
            moi?.classList.remove('tbf-debout');
            void moi?.offsetWidth;
            moi?.classList.add('tbf-debout');
            tic();
          };
          apres(g.ms ?? 10_000, finir);
          break;
        }

        /**
         * **L'écho inversé.** Le capo frappe sur ses deux tambours ; on
         * répond sur les nôtres, en miroir.
         *
         * Les frappes du joueur partent **toutes**, avec leur instant : c'est
         * le serveur qui sait quelle fenêtre de réponse est ouverte, et il
         * trie. Une page qui filtrerait de son côté jugerait à sa place.
         */
        case 'miroir': {
          const g = gestes?.miroir ?? {};
          const manches = g.manches ?? [];
          rendre = { frappes: [] };
          zone.innerHTML = `<div class="tbf-miroir" id="pad">
            <div class="tbf-miroir-mot" id="mot">ÉCOUTE LE CAPO</div>
            <div class="tbf-cotes">
              <button type="button" class="tbf-cote tbf-tambour" data-k="0">◉</button>
              <button type="button" class="tbf-cote tbf-tambour" data-k="1">◉</button>
            </div></div>`;
          const pad = $('pad');
          const mot = $('mot');
          const tambours = [...pad.querySelectorAll('[data-k]')];
          const allumer = (el, classe, ms) => {
            el.classList.remove(classe);
            void el.offsetWidth;
            el.classList.add(classe);
            apres(ms, () => el.classList.remove(classe));
          };

          manches.forEach((m, rang) => {
            apres(m.debut, () => {
              mot.className = 'tbf-miroir-mot';
              mot.textContent = `ÉCOUTE LE CAPO · ${rang + 1}/${manches.length}`;
            });
            for (const c of m.coups) {
              apres(m.debut + c.t, () => { allumer(tambours[c.cote], 'tbf-capo', 220); buzz(10); });
            }
            apres(m.reponse, () => {
              mot.className = 'tbf-miroir-mot tbf-a-toi';
              mot.textContent = 'À TOI — EN MIROIR';
            });
          });

          pad.onpointerdown = (e) => {
            const b = e.target.closest('[data-k]');
            if (!b) return;
            rendre.frappes.push({ t: maintenant(), cote: Number(b.dataset.k) });
            allumer(b, 'pris', 140);
            tic();
          };
          apres(g.ms ?? 12_000, finir);
          break;
        }

        /**
         * **Les rouleaux.** Glisser vers la pelouse lance un rouleau ; il
         * retombe dans le prolongement du geste, déporté par le vent.
         *
         * `chute` est **la même formule** que `pointDeChute` dans
         * `src/server/ferveur/epreuves.js` — recopiée, parce que ce fichier
         * est un script de navigateur. Elle ne sert qu'à montrer où tombe le
         * rouleau : la note est recalculée là-bas à partir du geste, et
         * `epreuves-ui-smoke` compare les deux.
         */
        case 'rouleaux': {
          const g = gestes?.rouleaux ?? {};
          const liste = g.liste ?? [];
          const portee = g.portee ?? 1.3;
          rendre = { lancers: [] };
          zone.innerHTML = `<div class="tbf-rouleaux" id="pad">
            <i class="tbf-rouleaux-cible" id="cible"></i>
            <div class="tbf-rouleaux-vent" id="vent"></div>
            <div class="tbf-rouleaux-mot" id="mot">GLISSE VERS LA PELOUSE</div></div>`;
          const pad = $('pad');
          const chute = (l, vent) => {
            const dx = l.x1 - l.x0;
            const dy = l.y1 - l.y0;
            const vol = Math.hypot(dx, dy) * portee;
            return { x: l.x1 + dx * portee + vent * vol, y: l.y1 + dy * portee };
          };
          let courant = -1;
          let lance = true;
          let depart = null;

          liste.forEach((l, i) => apres(l.t, () => {
            courant = i;
            lance = false;
            const c = $('cible');
            c.style.cssText = `left:${l.cible.x * 100}%;top:${l.cible.y * 100}%`;
            c.classList.add('vue');
            /* Le vent se lit en flèches : leur nombre dit la force, leur sens
               le côté. Un chiffre se lirait, une flèche se voit. */
            const n = Math.max(1, Math.round(Math.abs(l.vent) * 8));
            $('vent').textContent = `VENT ${(l.vent < 0 ? '←' : '→').repeat(n)}`;
            $('mot').textContent = `LANCER ${i + 1} / ${liste.length}`;
          }));

          const ici = (e) => {
            const r = pad.getBoundingClientRect();
            return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height,
              t: maintenant() };
          };
          pad.onpointerdown = (e) => {
            depart = ici(e);
            prendre(pad, e);
          };
          pad.onpointerup = (e) => {
            if (!depart || lance || courant < 0) { depart = null; return; }
            const fin = ici(e);
            const geste = { x0: depart.x, y0: depart.y, x1: fin.x, y1: fin.y,
              t0: depart.t, t1: fin.t };
            depart = null;
            /* Un simple appui n'est pas un lancer : il faut avoir glissé. */
            if (Math.hypot(geste.x1 - geste.x0, geste.y1 - geste.y0) < 0.04) return;
            lance = true;
            rendre.lancers.push(geste);
            const p = chute(geste, liste[courant].vent);
            const rouleau = document.createElement('i');
            rouleau.className = 'tbf-rouleau';
            rouleau.style.cssText = `left:${fin.x * 100}%;top:${fin.y * 100}%`;
            pad.appendChild(rouleau);
            requestAnimationFrame(() => requestAnimationFrame(() => {
              rouleau.style.left = `${p.x * 100}%`;
              rouleau.style.top = `${p.y * 100}%`;
              rouleau.classList.add('vole');
            }));
            apres(1400, () => rouleau.remove());
            tic();
          };
          apres(g.ms ?? 10_000, finir);
          break;
        }

        /**
         * **Les deux voix.** Deux couloirs, deux cadences ; les notes
         * descendent, et l'on frappe du bon côté quand elles touchent la
         * ligne.
         *
         * Chaque note naît `approche` millisecondes avant son instant et
         * descend en ligne droite : elle touche la ligne **exactement** quand
         * le serveur l'attend. On voit donc venir chaque frappe, et c'est
         * voulu — la difficulté est d'en suivre deux à la fois, pas d'en
         * deviner une.
         */
        case 'deuxvoix': {
          const g = gestes?.deuxvoix ?? {};
          const notes = g.notes ?? [];
          const approche = g.approche ?? 1100;
          rendre = { frappes: [] };
          zone.innerHTML = `<div class="tbf-deuxvoix" id="pad">
            <div class="tbf-voies"><div class="tbf-voie" data-k="0"></div>
              <div class="tbf-voie" data-k="1"></div><div class="tbf-ligne"></div></div>
            <div class="tbf-cotes">
              <button type="button" class="tbf-cote" data-k="0">◀</button>
              <button type="button" class="tbf-cote" data-k="1">▶</button>
            </div></div>`;
          const pad = $('pad');
          const voies = [...pad.querySelectorAll('.tbf-voie')];
          for (const n of notes) {
            apres(Math.max(0, n.t - approche), () => {
              const el = document.createElement('i');
              el.className = 'tbf-ep-note';
              /* Si l'épreuve a démarré en retard sur la note, elle part déjà
                 avancée : elle doit toucher la ligne à l'heure, pas plus tard. */
              const reste = Math.max(60, n.t - maintenant());
              el.style.animationDuration = `${approche}ms`;
              el.style.animationDelay = `${reste - approche}ms`;
              voies[n.cote]?.appendChild(el);
              apres(reste + 250, () => el.remove());
            });
          }
          pad.onpointerdown = (e) => {
            const b = e.target.closest('[data-k]');
            if (!b) return;
            rendre.frappes.push({ t: maintenant(), cote: Number(b.dataset.k) });
            const bouton = pad.querySelector(`.tbf-cote[data-k="${b.dataset.k}"]`);
            bouton?.classList.add('pris');
            apres(120, () => bouton?.classList.remove('pris'));
            tic();
          };
          apres(g.ms ?? 8600, finir);
          break;
        }

/**
         * **Le martèlement**, et le filet pour tout geste inconnu : taper le
         * plus vite possible, tant que ça dure.
         *
         * **`case 'mash'` avait perdu son corps.** Il était écrit ici, collé
         * au `default`, les deux partageant ce bloc. Les cinq épreuves sont
         * venues s'insérer entre les deux : le `default` est resté en bas
         * avec le code, et `case 'mash':` est resté en haut, seul, sans corps
         * et sans `break` — c'est-à-dire tombant dans le cas suivant.
         *
         * Conséquence : tout chant en martèlement — Le craquage, Le roulement
         * — jouait **la bascule** et rendait `{ choix, instants }` au lieu
         * d'une liste de frappes. Le serveur refusait avec `bad_taps`, que la
         * page ne sait pas nommer, et le joueur lisait « Refusé par le
         * serveur » après avoir martelé trois secondes pour rien.
         *
         * Rien ne rougissait : un `switch` qui traverse est du JavaScript
         * valide, et aucune suite ne jouait les quinze gestes l'un après
         * l'autre pour regarder ce que chacun rend. C'est ce que fait
         * désormais `npm run gestes:test`.
         *
         * Le corps n'est pas recopié en haut : deux exemplaires du même geste
         * finissent par diverger, et c'est déjà ce qui a produit ce bug. */
        case 'mash':
        default: {
          const g = gestes?.mash ?? {};
          const pad = pave(0, 'FRAPPES', false);
          frappes(pad, 'FRAPPES');
          apres(g.ms ?? 3000, finir);
          break;
        }
      }
    });
  }

  /**
   * Claque le tampon du verdict au centre d'un élément.
   *
   * Le mot est **celui que le serveur a servi**, jamais déduit d'une note :
   * un mot que `MOTS` ne connaît pas — ou pas de mot du tout, un serveur
   * d'avant le lot 6 — ne pose rien et rend `null`. Il n'y a pas de repli sur
   * un seuil : c'est exactement la faute que l'échelle unique corrige.
   *
   * Le tampon porte le code servi dans `data-verdict` et le mot en toutes
   * lettres ; **la couleur est à la feuille** (« l'échelle du verdict »,
   * `ui.css`), qui choisit l'encre selon le fond : claire sur le sombre,
   * foncée sur la craie du pavé et sur une carte. Un seul tampon par élément :
   * celui d'un geste précédent est retiré. La feuille retire dessous le
   * chiffre et la consigne du pavé (`:has()`), le temps que le tampon se
   * lise. Un hôte qui n'est pas positionné l'est ici : le tampon se centre
   * sur lui, et sur un hôte statique il partirait se centrer sur un ancêtre
   * quelconque.
   *
   * **Plein ou en contour**, comme le veut la règle du tampon : en contour à
   * partir de seize pixels sur le sombre, plein en dessous. Sur la carte
   * jouée (`.tbf-carte`, ou tout hôte de moins de 140 px de large), il est
   * forcément petit : il passe plein de lui-même (`plein` le force). Sur le
   * pavé-bâche, c'est la feuille qui lui donne l'encre foncée de la craie.
   *
   * Le « clac » est celui de la banque (`bache`), sous le calme « sons » comme
   * tous les autres, et il tombe **à l'impact** (`impactDu`) : `.tbf-clac`
   * descend en 260 ms et touche à 60 %, et le son joué au départ tombait un
   * sixième de seconde avant le tampon (`SON.md`, § 3). Sous le mouvement
   * réduit et le calme « animations », le tampon est posé sans claquer
   * (`.tbf-clac` s'éteint dans la feuille) : le son part tout de suite.
   *
   * @param {Element} hote     le pavé, l'épreuve, ou la carte jouée
   * @param {string|object} verdict  le mot servi, ou la réponse qui le porte
   * @param {{ plein?: boolean, duree?: number }} [o]  `duree` : retiré après
   *   ce délai (0 ou absent : il reste, et la page le retire avec l'hôte)
   * @returns {HTMLElement|null} le tampon posé
   */
  function tamponner(hote, verdict, o = {}) {
    const v = verdictDans(verdict);
    if (!hote?.isConnected || !v) return null;
    hote.querySelector(':scope > .tbf-verdict')?.remove();
    if (getComputedStyle(hote).position === 'static') hote.style.position = 'relative';
    const large = hote.clientWidth;
    const plein = o.plein ?? (hote.classList.contains('tbf-carte') || (large > 0 && large < 140));
    const t = document.createElement('span');
    t.className = `tbf-tampon tbf-clac tbf-verdict${plein ? ' tbf-tampon--plein' : ''}`;
    t.dataset.verdict = v;
    t.textContent = MOTS[v];
    /* **Le tampon n'entre jamais dans le flux de son hôte.** La feuille le
       place sur le pavé et sur la carte ; sur une épreuve — la grille du tri,
       la mosaïque, le cadre du tifo —, rien ne le place, et posé dans une
       grille il y prenait une case : sa largeur élargissait une colonne, et la
       grille débordait de l'écran sous un tampon qu'on ne voyait plus. Hors du
       pavé et de la carte, il est donc centré ici ; sa taille et son encre
       restent à la feuille. */
    if (!hote.matches('.tbf-pave, .tbf-carte')) {
      t.style.cssText = 'position:absolute;z-index:5;left:50%;top:50%;translate:-50% -50%';
    }
    hote.appendChild(t);
    /* Un tampon retiré avant d'avoir touché — l'hôte refermé entre-temps —
       ne claque pas : on entendrait un coup sur une fenêtre déjà vide. */
    const clac = () => {
      if (!t.isConnected) return;
      try { window.FX?.son?.('bache'); } catch { /* le son ne casse jamais un verdict */ }
    };
    const impact = impactDu(t);
    if (impact > 0) setTimeout(clac, impact); else clac();
    if (o.duree > 0) {
      setTimeout(() => t.remove(), o.duree);
    }
    return t;
  }

  /* **L'instant où le tampon touche**, en millisecondes après sa pose : le
     retard de `.tbf-clac` plus 60 % de sa durée — la marque de la feuille où
     il est plein et au plus bas (`@keyframes tbf-clac`, 60 % : opacité 1,
     échelle 0,95). Lu sur le style calculé et non recopié : la durée, un
     `--d` posé par la page et l'extinction sous le mouvement réduit ou le
     calme (« animation: none », impact immédiat) restent à la feuille. */
  const IMPACT_CLAC = 0.6;
  const enMs = (v) => {
    const x = parseFloat(v);
    if (!Number.isFinite(x)) return 0;
    return /ms\s*$/.test(String(v)) ? x : x * 1000;
  };
  function impactDu(el) {
    let s = null;
    try { s = getComputedStyle(el); } catch { return 0; }
    const noms = String(s?.animationName ?? '').split(',').map((x) => x.trim());
    const i = noms.indexOf('tbf-clac');
    if (i < 0) return 0;
    const lire = (liste) => {
      const a = String(liste ?? '').split(',');
      return a[i % a.length] ?? '0s';
    };
    return Math.max(0, enMs(lire(s.animationDelay)) + IMPACT_CLAC * enMs(lire(s.animationDuration)));
  }

  /**
   * Garde la fenêtre du geste ouverte le temps que le verdict arrive.
   *
   * La page l'appelle **juste après avoir envoyé les frappes**, avec la
   * promesse de la réponse, et ne ferme sa fenêtre qu'une fois celle-ci
   * tenue :
   *
   *     const taps = await TBF_GESTE.jouer(geste, gestes, { zone });
   *     const reponse = …;                 // la réponse du serveur, en promesse
   *     await TBF_GESTE.attendre(reponse, { zone, carte: () => laCarteJouee });
   *     fermerLaFenetre();                 // et seulement maintenant
   *
   * Trois issues, et la promesse rendue dit laquelle (`pose`) :
   *
   *   - **à temps** (au plus `delai` après la dernière frappe du geste joué
   *     dans `zone` — voir `DELAI_VERDICT` pour ce qu'elle est, geste par
   *     geste) : le tampon claque au centre du pavé, et la promesse se tient
   *     `lecture` millisecondes plus tard, le temps de le lire —
   *     `{ verdict, pose: 'fenetre' }` ;
   *   - **trop tard** : la promesse se tient à l'échéance, la page ferme sa
   *     fenêtre, et le tampon claquera sur `carte` à l'arrivée —
   *     `{ verdict: null, pose: 'carte' }` (`pose: null` sans carte) ;
   *   - **sans mot** (réponse vide, refusée, ou d'un serveur d'avant le lot
   *     6) : la promesse se tient tout de suite, rien n'est posé —
   *     `{ verdict: null, pose: null }`. Attendre l'échéance pour ne rien
   *     montrer ferait payer au joueur un mot qui ne viendra pas.
   *
   * `carte` peut être une fonction : elle est appelée à l'arrivée, pas avant.
   * La main du Virage et celle du duel se reposent entre-temps, et l'élément
   * qu'on aurait gardé au départ peut ne plus être dans la page. Une carte
   * absente ou détachée ne reçoit rien.
   *
   * La promesse ne rejette jamais : une page qui attend son verdict ne doit
   * pas rester avec une fenêtre ouverte parce que le réseau a levé.
   *
   * @param {Promise<string|object>|string|object} reponse
   * @param {{ zone: Element, carte?: Element|(() => Element),
   *           delai?: number, lecture?: number, duree?: number }} o
   * @returns {Promise<{ verdict: string|null, pose: 'fenetre'|'carte'|null }>}
   */
  function attendre(reponse, o = {}) {
    const { zone, carte } = o;
    const delai = o.delai ?? DELAI_VERDICT;
    const lecture = o.lecture ?? LECTURE_VERDICT;
    const duree = o.duree ?? TENUE_CARTE;
    /* Depuis la dernière frappe, et non depuis l'appel : la page envoie les
       frappes puis appelle, et ce qui s'est passé entre-temps est déjà pris
       sur les six cents millisecondes. Une zone où aucun geste n'a été joué
       compte depuis l'appel. */
    const echeance = (reperes.get(zone) ?? performance.now()) + delai;
    /* Le pavé du geste qui vient de finir, pris **maintenant** : à l'arrivée,
       la zone peut porter le pavé d'un autre geste, et ce verdict n'est pas
       le sien. Détaché d'ici là, il ne reçoit rien (`tamponner`). */
    const hote = zone?.querySelector?.('#pad') ?? zone;

    return new Promise((tenir) => {
      let tranche = false;
      let attente = setTimeout(() => {
        attente = 0;
        if (tranche) return;
        tranche = true;
        tenir({ verdict: null, pose: carte ? 'carte' : null });
      }, Math.max(0, echeance - performance.now()));

      Promise.resolve(reponse).then(verdictDans, () => null).then((v) => {
        if (tranche) {
          // Trop tard pour la fenêtre : la carte jouée, si elle est encore là.
          if (!v) return;
          let c = null;
          try { c = typeof carte === 'function' ? carte() : carte; } catch { c = null; }
          tamponner(c, v, { duree });
          return;
        }
        tranche = true;
        clearTimeout(attente);
        attente = 0;
        if (!v || !tamponner(hote, v)) {
          tenir({ verdict: null, pose: null });
          return;
        }
        setTimeout(() => tenir({ verdict: v, pose: 'fenetre' }), lecture);
      });
    });
  }

  window.TBF_GESTE = {
    jouer, label, aide, couleur, LABEL, AIDE, COULEUR,
    // Le pavé et le verdict (lot 6) : voir l'en-tête.
    FRAPPE, MOTS, mot, tamponner, attendre,
    DELAI_VERDICT, LECTURE_VERDICT, TENUE_CARTE,
    // La grille des gestes de rythme et la borne du serveur (lot 6) : voir `grille`.
    grille, AVANCE, ORIGINE_MAX,
  };
})();
