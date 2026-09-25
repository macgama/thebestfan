/**
 * Les épreuves du virage : sept familles qui ne sont ni du rythme ni de la
 * force.
 *
 * (Elles étaient cinq le jour où ce fichier a été écrit, et ce nombre a menti
 * pendant deux ajouts sans que rien ne le signale — c'est ce que fait toujours
 * un compte écrit à la main dans un commentaire. Le seul qui ne mente jamais
 * est `EPREUVES.length`, quelques lignes plus bas.)
 *
 * ## Pourquoi un fichier à part
 *
 * Les dix gestes de `gestures.js` demandent tous la même chose au joueur —
 * frapper au bon moment, frapper vite, tenir — et se notent tous à partir de
 * la même donnée : une liste d'instants. Ces cinq-ci demandent autre chose et
 * se notent autrement : un tracé, une grille, une suite. Les mêler aux dix
 * aurait obligé chaque fonction à commencer par démêler ce qu'elle reçoit.
 *
 * ## Le contrat, en deux temps
 *
 * 1. **La consigne** — ce que le serveur demande. Elle est tirée d'une graine,
 *    donc reproductible : le même duel à la même minute pose la même épreuve
 *    aux deux joueurs, et un contrôle peut la rejouer.
 * 2. **La réponse** — ce que le joueur a fait. Sa forme dépend de la famille :
 *    un tracé pour le tifo et l'écharpe, une grille pour la mosaïque, une
 *    suite pour le capo et la mémoire.
 *
 * Les deux voyagent ensemble jusqu'à `noter`, qui rend une note entre 0 et
 * 1,2 — la même échelle que les dix gestes, pour que les moteurs n'aient rien
 * à savoir de tout ceci.
 *
 * ## Ce qu'on peut tricher, et ce qu'on y fait
 *
 * **La consigne part chez le joueur, donc la réponse aussi.** Un client
 * modifié rend la grille parfaite et la suite complète. C'est inhérent : la
 * mosaïque et le capo *montrent* ce qu'il faut refaire, et la mémoire aussi.
 * L'adresse qu'on mesure est de s'en souvenir, et une machine se souvient.
 *
 * C'est exactement la situation des dix gestes, où rien n'empêche de fabriquer
 * une liste de frappes parfaites. La défense y est la **vraisemblance** — voir
 * `sanity` dans `gestures.js` — et elle est la même ici : un humain met du
 * temps à se décider, et ce temps varie. `humain()` refuse les réponses trop
 * promptes ou trop régulières. C'est un filet, pas une preuve, et le dire est
 * plus honnête que de prétendre l'inverse.
 */

export class Triche extends Error {
  constructor(code) { super(code); this.code = code; }
}

/**
 * Les sept familles, dans l'ordre où elles ont été écrites.
 *
 * Les cinq premières demandent toutes la même chose sous des habits
 * différents : **reproduire quelque chose qu'on vient de voir** — une forme,
 * des paires, une grille, un cercle, une suite. C'est une seule qualité de
 * joueur, mesurée cinq fois.
 *
 * Les deux dernières mesurent autre chose, et c'est pour ça qu'elles existent :
 * `tri` mesure la vitesse de discrimination — voir vite et ne pas se tromper —
 * et `compte` mesure l'horloge intérieure, sans rien à regarder du tout. Un
 * joueur bon aux cinq premières n'est pas nécessairement bon à celles-ci, et
 * c'est exactement ce qu'on cherche : que le répertoire récompense plusieurs
 * sortes de gens.
 */
export const EPREUVES = ['tifo', 'memoire', 'mosaique', 'echarpe', 'capo',
  'tri', 'compte', 'bascule', 'visee', 'jauge',
  /* Les quatre de l'automne 2026. Chacune mesure une chose qu'aucune autre ne
     demande : **anticiper** un mouvement qu'on voit venir (la ola), rejouer
     un rythme **en le retournant** (l'écho inversé), **viser en compensant**
     une force qu'on ne contrôle pas (les rouleaux), et suivre **deux rythmes
     à la fois** (les deux voix). */
  'ola', 'miroir', 'rouleaux', 'deuxvoix'];

export const REGLES = {
  /* Tracer une forme sans quitter le trait. `tolerance` est en fraction du
     cadre : 0,12 veut dire qu'à douze pour cent de largeur du trait, on est
     encore dessus. Large exprès — on joue au doigt, sur un téléphone, pendant
     un match. */
  tifo: { ms: 6000, tolerance: 0.075, saut: 0.16, minPoints: 24, maxPoints: 600 },

  /* Huit visages montrés deux secondes, puis retournés. On les rappelle par
     paires. Quatre paires : assez pour que ce soit un effort, assez peu pour
     que ça tienne en dix secondes de match. */
  memoire: { paires: 4, apercu: 2000, ms: 12000 },

  /* La grille s'allume une seconde et s'éteint. Seize cases, dont six
     allumées : au-delà, on ne mémorise plus, on devine. */
  mosaique: { cotes: 4, allumees: 6, apercu: 1100, ms: 9000 },

  /* Trois tours d'écharpe. `rayonMin` écarte le petit cercle au ras du doigt,
     qui serait plus facile et moins beau. */
  echarpe: { ms: 7000, tours: 3, rayonMin: 0.14, minPoints: 30, maxPoints: 800 },

  /* Le capo montre une suite qui s'allonge. Six zones, six coups : la suite
     dépasse l'empan de la plupart des gens, et c'est le but — on ne cherche
     pas le sans-faute, on cherche jusqu'où chacun va. */
  capo: { zones: 6, longueur: 6, pas: 620, ms: 9000 },

  /* **Le tri des cartons.** Vingt-quatre cartons de trois couleurs, on ramasse
     ceux d'une seule, le plus vite possible. Rien à mémoriser : tout reste à
     l'écran du début à la fin.

     Un tiers de cartons justes — huit sur vingt-quatre — parce qu'une cible
     majoritaire se ramasse en balayant l'écran sans regarder. Six secondes :
     de quoi en prendre six ou sept en se dépêchant, pas les huit. */
  tri: { cartons: 24, couleurs: 3, ms: 6000 },

  /* **Le compte.** Le virage compte à rebours avant le craquage, puis le
     compte s'éteint et il faut tomber juste quand même.

     `visible` est ce qu'on voit ; `cible` ce qu'il faut atteindre. La
     différence — entre deux et quatre secondes — est le temps qu'on doit tenir
     à l'aveugle. `tolerance` est l'erreur qui vaut encore quelque chose : à une
     seconde près on a quelque chose, à zéro on a tout. */
  compte: { visible: 3000, cibleMin: 5000, cibleMax: 8000, tolerance: 1000, ms: 12_000 },

  /* ======================================== LES TROIS NEUVES

     ## Pourquoi celles-là, et pas trois de plus du même genre

     Les cinq premières épreuves demandent toutes la même chose sous des habits
     différents — **reproduire ce qu'on vient de voir**. C'est écrit en tête de
     ce fichier, et c'est une seule qualité de joueur mesurée cinq fois. En
     ajouter une sixième n'aurait rien ouvert.

     Ces trois-ci visent chacune un trou :

       — `bascule` : **décider vite quand la règle change.** Rien dans le jeu ne
         demande d'inhiber un geste déjà parti. Le tri s'en approche, mais on y
         choisit à son rythme et tout reste à l'écran ; ici le signal passe.
       — `visee` : **toucher un point qui n'est plus là quand on arrive.** Le
         tifo et l'écharpe suivent un tracé immobile ; celle-ci mesure l'œil et
         la main ensemble, sous une horloge.
       — `jauge` : **doser en continu.** Le sang-froid des dix gestes est un
         relâchement, une décision unique. Tenir une valeur dans une bande qui
         bouge pendant huit secondes est l'exact contraire : cent petites
         corrections, et aucune n'est la bonne très longtemps.

     Un joueur bon aux cinq premières n'est pas nécessairement bon à ces
     trois-là — et c'est tout ce qu'on cherche. */

  /* **La bascule.** Le capo désigne un côté ; parfois la bâche dit « à
     contre-courant », et il faut aller de l'autre.

     `pas` est le temps entre deux signaux, `fenetre` celui qu'on a pour
     répondre. La fenêtre est plus courte que le pas : on ne peut pas attendre
     le signal suivant pour se décider, ce qui est précisément l'épreuve. */
  bascule: { coups: 10, pas: 820, fenetre: 640, ms: 10_000, contrePart: 0.35 },

  /* **La visée.** Six fumigènes s'allument un par un ; chacun s'éteint vite.

     `rayon` est la tolérance en fraction de cadre, `fenetre` celle du temps.
     Les deux comptent, et elles se multiplient : toucher au bon endroit trop
     tard ne vaut rien, et toucher à temps n'importe où non plus.

     **Réglés sur une main humaine**, et c'est la correction qui compte. La
     fenêtre valait 520 ms **en tout**, mesurées depuis l'apparition : voir
     le fumigène puis y porter le doigt en prend cinq à huit cents, et un
     joueur qui touchait chaque rond pendant qu'il brûlait finissait à zéro,
     partie après partie. Le contrôle touchait vingt millisecondes après
     l'apparition, ce que personne ne sait faire.

     Trois temps, désormais : la note est pleine pendant `fenetre`, décroît
     jusqu'à `vie`, et le rond s'éteint à `vie` — il ne s'affiche plus quand
     il ne vaut plus rien. De même dans l'espace : pleine note dans le `coeur`,
     qui est le rond qu'on voit, puis décroissance jusqu'à `rayon`. `vie`
     reste sous `apparition` : un seul fumigène brûle à la fois. */
  visee: { cibles: 6, ms: 8000, rayon: 0.16, coeur: 0.08, fenetre: 450, vie: 1100,
    apparition: 1150 },

  /* **La jauge.** La corde monte et descend ; il faut rester dedans.

     `largeur` est l'épaisseur de la bande, en fraction de la hauteur : une
     bande étroite demande une main sûre. `points` est le nombre de sommets de
     la trajectoire — peu de sommets font une vague lente, beaucoup une danse
     qu'on ne suit plus. `minMesures` refuse une réponse qui n'aurait pas été
     échantillonnée : sans lui, trois points bien placés vaudraient huit
     secondes de travail. */
  jauge: { ms: 8000, largeur: 0.15, points: 4, transition: 520,
    echantillon: 100, minMesures: 40 },

  /* **La ola.** Une vague fait le tour du stade, de plus en plus vite ; on se
     lève quand elle passe devant sa tribune.

     C'est l'inverse du tempo : on **voit venir** l'instant au lieu de le
     compter. La fenêtre est donc plus étroite que celle d'un battement —
     anticiper un point qui avance est plus facile que tenir une pulsation —
     et c'est l'accélération qui fait la difficulté : le dernier tour prend
     moitié moins de temps que le premier. `fenetre` est la note pleine,
     `limite` le point où elle tombe à zéro. */
  ola: { tours: [2400, 2000, 1700, 1400, 1200], depart: 700, secteurs: 24,
    fenetre: 110, limite: 320 },

  /* **L'écho inversé.** Le capo frappe un motif sur deux tambours ; on le
     rejoue **en miroir**, gauche pour droite, comme l'écho renvoyé par la
     tribune d'en face.

     L'écho des dix gestes redit un rythme ; le capo redit une suite de
     places. Celle-ci demande les deux à la fois, et une opération de plus
     entre l'oreille et la main. Les écarts se mesurent **entre les frappes**
     et non depuis un top : on commence quand on veut, on garde le rythme.
     `pas` sont les intervalles possibles entre deux coups du motif. */
  miroir: { manches: [4, 5], pas: [320, 460, 600], attente: 800, marge: 1400,
    tolerance: 190, jeu: 60 },

  /* **Les rouleaux.** Un glissement du doigt lance un rouleau vers la
     pelouse ; il retombe dans le prolongement du geste, poussé par le vent.

     `portee` allonge le geste : un rouleau vole plus loin que le doigt ne
     glisse. Le vent déporte **en proportion du vol** — un lancer long
     dérive plus qu'un lancer court — et c'est ce qui oblige à viser à côté
     de la cible plutôt que dessus. `coeur` est la zone de note pleine,
     `rayon` celle où elle tombe à zéro. */
  rouleaux: { lancers: 5, parLancer: 1800, depart: 500, portee: 1.3, vent: 0.5,
    ventMin: 0.2, coeur: 0.05, rayon: 0.18, dureeMin: 40 },

  /* **Les deux voix.** Deux chants se répondent, un de chaque côté, à deux
     cadences qui ne tombent jamais ensemble ; les notes descendent vers la
     ligne, et l'on frappe du bon côté quand elles l'atteignent.

     `ecartMin` interdit deux notes trop proches : sans lui, les deux cadences
     finissent par coïncider à dix millisecondes près, et l'épreuve demande
     un geste qu'aucune main ne sait faire. `approche` est le temps pendant
     lequel une note se voit arriver. */
  deuxvoix: { ms: 8600, gauche: 780, droite: 1010, depart: 900, approche: 1100,
    ecartMin: 170, fenetre: 100, limite: 250, saut: 0.12 },
};

/* --------------------------------------------------------------- le hasard

   Un générateur à graine, court et sans prétention. Il n'a pas besoin d'être
   bon : il a besoin d'être **reproductible**, pour que le serveur et le
   contrôle tirent la même chose, et pour que les deux joueurs d'un duel aient
   la même épreuve à la même minute. */
function suite(graine) {
  /* La graine est **brassée** avant de servir, et les premiers tirages sont
     jetés. Sans ça, le générateur de Lehmer rend une valeur proportionnelle à
     sa graine au premier appel : pour des graines de un à quarante — c'est-à-
     dire toutes les nôtres, un rang de répertoire ou un compte de chants — le
     premier tirage valait toujours presque zéro.

     Le tifo tirait donc toujours la même forme, le rond, et les mélanges
     commençaient tous pareil. On ne s'en aperçoit qu'en essayant plusieurs
     graines : avec une seule, tout a l'air parfaitement aléatoire. */
  let x = Math.floor(Math.abs(Number(graine) || 0)) + 1;
  x = ((x * 2654435761) % 2147483647) || 1;
  const tirer = () => (x = (x * 16807) % 2147483647) / 2147483647;
  tirer(); tirer(); tirer();
  return tirer;
}

const melanger = (t, rnd) => {
  const a = [...t];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/* ------------------------------------------------------------- les formes

   Les quatre tracés du tifo, en coordonnées de zéro à un. Ils sont **fermés**
   — le dernier point rejoint le premier — parce qu'un tifo se déplie en
   boucle, et parce qu'une forme ouverte se réussit en s'arrêtant au milieu. */
const FORMES = {
  rond: Array.from({ length: 48 }, (_, i) => {
    const a = (i / 48) * Math.PI * 2;
    return { x: 0.5 + Math.cos(a) * 0.36, y: 0.5 + Math.sin(a) * 0.36 };
  }),
  /* L'écharpe : un rectangle très allongé, aux coins arrondis par le tracé. */
  echarpe: [
    ...Array.from({ length: 16 }, (_, i) => ({ x: 0.14 + (i / 16) * 0.72, y: 0.34 })),
    ...Array.from({ length: 6 }, (_, i) => ({ x: 0.86, y: 0.34 + (i / 6) * 0.32 })),
    ...Array.from({ length: 16 }, (_, i) => ({ x: 0.86 - (i / 16) * 0.72, y: 0.66 })),
    ...Array.from({ length: 6 }, (_, i) => ({ x: 0.14, y: 0.66 - (i / 6) * 0.32 })),
  ],
  /* Le triangle du fanion, pointe en bas. */
  fanion: [
    ...Array.from({ length: 16 }, (_, i) => ({ x: 0.16 + (i / 16) * 0.68, y: 0.2 })),
    ...Array.from({ length: 16 }, (_, i) => ({ x: 0.84 - (i / 16) * 0.34, y: 0.2 + (i / 16) * 0.62 })),
    ...Array.from({ length: 16 }, (_, i) => ({ x: 0.5 - (i / 16) * 0.34, y: 0.82 - (i / 16) * 0.62 })),
  ],
  /* Un cœur : le geste le plus lisible quand on n'a pas le temps de lire. */
  coeur: Array.from({ length: 52 }, (_, i) => {
    const t = (i / 52) * Math.PI * 2;
    const x = 16 * Math.sin(t) ** 3;
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    return { x: 0.5 + x / 42, y: 0.5 - y / 42 };
  }),
};

export const NOMS_FORMES = Object.keys(FORMES);

/* ----------------------------------------------------------- la consigne */

/**
 * Ce que le serveur demande, pour cette épreuve et cette graine.
 *
 * Tout ce qui est ici part chez le joueur : c'est ce qu'il doit voir. Rien
 * d'autre ne doit y entrer — le jour où une épreuve aura un secret, il faudra
 * un second canal, pas un champ de plus.
 */
export function consigneDe(epreuve, graine = 0) {
  const rnd = suite(graine + 1);

  if (epreuve === 'tifo') {
    const nom = NOMS_FORMES[Math.floor(rnd() * NOMS_FORMES.length)];
    return { ...REGLES.tifo, forme: nom, points: FORMES[nom] };
  }

  if (epreuve === 'memoire') {
    const { paires } = REGLES.memoire;
    // Deux exemplaires de chaque visage, mêlés. Les visages sont désignés par
    // un rang ; c'est la page qui décide quel dessin porte le rang deux.
    const cartes = melanger(
      Array.from({ length: paires * 2 }, (_, i) => i % paires), rnd);
    return { ...REGLES.memoire, cartes };
  }

  if (epreuve === 'mosaique') {
    const { cotes, allumees } = REGLES.mosaique;
    const cases = cotes * cotes;
    const choisies = new Set(melanger(
      Array.from({ length: cases }, (_, i) => i), rnd).slice(0, allumees));
    return {
      ...REGLES.mosaique,
      grille: Array.from({ length: cases }, (_, i) => (choisies.has(i) ? 1 : 0)),
    };
  }

  if (epreuve === 'echarpe') {
    // Le sens change d'une fois sur l'autre : sans ça, la main prend le pli et
    // l'épreuve devient un réflexe au lieu d'un geste.
    return { ...REGLES.echarpe, sens: rnd() < 0.5 ? 1 : -1 };
  }

  if (epreuve === 'capo') {
    const { zones, longueur } = REGLES.capo;
    return {
      ...REGLES.capo,
      suite: Array.from({ length: longueur }, () => Math.floor(rnd() * zones)),
    };
  }

  if (epreuve === 'tri') {
    const { cartons, couleurs } = REGLES.tri;
    const cible = Math.floor(rnd() * couleurs);
    /* Un tiers exactement de chaque couleur, puis mélangé. Tirer chaque carton
       au hasard donnerait des plateaux à trois cibles et des plateaux à quinze :
       la même épreuve ne vaudrait pas la même chose d'une fois sur l'autre, et
       la note cesserait de comparer quoi que ce soit. */
    const parCouleur = Math.floor(cartons / couleurs);
    const plateau = melanger(
      Array.from({ length: cartons }, (_, i) =>
        Math.min(couleurs - 1, Math.floor(i / parCouleur))), rnd);
    return { ...REGLES.tri, cible, plateau };
  }

  if (epreuve === 'compte') {
    const { cibleMin, cibleMax } = REGLES.compte;
    /* La cible change à chaque fois : fixe, on l'apprendrait une fois pour
       toutes et l'horloge intérieure ne servirait plus à rien. */
    return { ...REGLES.compte,
      cible: Math.round(cibleMin + rnd() * (cibleMax - cibleMin)) };
  }


  if (epreuve === 'bascule') {
    const { coups, contrePart } = REGLES.bascule;
    /* Le côté et l'inversion sont tirés indépendamment : sans quoi « à
       contre-courant » finirait corrélé à un côté, et le joueur apprendrait le
       côté au lieu de lire la consigne.

       Un signal sur trois environ est inversé. Beaucoup moins, et l'on répond
       sans lire ; beaucoup plus, et l'inversion devient la règle — on
       l'apprendrait tout aussi bien. */
    const signaux = Array.from({ length: coups }, () => ({
      cote: rnd() < 0.5 ? 0 : 1,
      contre: rnd() < contrePart,
    }));
    /* **Au moins deux inversions, toujours.**

       Un signal sur trois est inversé en moyenne, mais la moyenne n'est pas la
       garantie : sur dix tirages indépendants, une fois sur soixante-quinze il
       n'y en a aucune. L'épreuve devient alors « suis le côté qu'on te
       montre », c'est-à-dire rien du tout — et le joueur qui tombe dessus la
       trouve facile sans savoir pourquoi.

       On en impose donc deux, posées à des rangs tirés. Le reste du hasard est
       inchangé : ce n'est pas un plafond, seulement un plancher. */
    const rangs = melanger(Array.from({ length: coups }, (_, i) => i), rnd);
    let deja = signaux.filter((x) => x.contre).length;
    for (const rang of rangs) {
      if (deja >= 2) break;
      if (signaux[rang].contre) continue;
      signaux[rang].contre = true;
      deja++;
    }
    return { ...REGLES.bascule, signaux };
  }

  if (epreuve === 'visee') {
    const { cibles, apparition } = REGLES.visee;
    /* Les cibles sont tenues à l'écart des bords — 0,12 à 0,88 — pour deux
       raisons : un fumigène à demi sorti du cadre serait injuste, et sur un
       téléphone le bord est déjà pris par le pouce qui tient l'appareil. */
    return { ...REGLES.visee,
      cibles: Array.from({ length: cibles }, (_, i) => ({
        x: 0.12 + rnd() * 0.76,
        y: 0.12 + rnd() * 0.76,
        t: Math.round(i * apparition + rnd() * 160),
      })) };
  }

  if (epreuve === 'jauge') {
    const { points, ms } = REGLES.jauge;
    /* La trajectoire est donnée par ses sommets, et la page interpole entre
       eux. Deux raisons de ne pas l'envoyer point par point : le message
       resterait petit, et surtout **les deux côtés interpolent la même chose**
       — c'est la notation qui fait foi, et elle recalcule la bande aux instants
       que le joueur a rendus, jamais à ceux qu'il aurait choisis.

       **Les sommets balaient presque toute la hauteur — 0,08 à 0,92 — et la
       bande est étroite.** Le premier réglage gardait la bande entre 0,2 et
       0,8 avec une largeur de 0,22 : poser le doigt au milieu et ne plus
       bouger rapportait 0,91, c'est-à-dire que l'épreuve ne mesurait rien. Une
       jauge qu'on tient sans la suivre n'est pas une jauge.

       Deux sommets voisins ne peuvent pas être du même côté : sans cette
       alternance, le hasard produit parfois cinq sommets groupés, et l'on
       retombe sur la bande immobile qu'on vient de corriger. */
    /* **Elle tient, puis elle bouge vite.**

       Le premier réglage faisait glisser la bande d'un extrême à l'autre en
       continu. Le doigt posé au milieu la croisait à chaque passage et
       récoltait 0,48 en moyenne — presque la moitié de la note sans rien
       faire. Le nombre de sommets n'y changeait rien : avec une interpolation
       droite, la part de temps passée près du centre ne dépend pas de la
       vitesse.

       La trajectoire est donc un palier, puis un saut : chaque extrême est
       posé **deux fois**, à son arrivée et à sa fin, et la page interpole entre
       les deux — c'est-à-dire ne bouge pas. Le milieu n'est plus traversé que
       pendant les transitions, et l'immobilité tombe sous les deux dixièmes.

       Le geste y gagne aussi : on tient trois secondes, puis on court. Deux
       qualités au lieu d'une, et c'est ce qui manquait au sang-froid des dix
       gestes, qui ne demande qu'un relâchement. */
    const { transition } = REGLES.jauge;
    const duree = ms / points;
    const sommets = [];
    let haut = rnd() < 0.5;
    for (let i = 0; i < points; i++) {
      haut = !haut;
      const v = haut ? 0.62 + rnd() * 0.3 : 0.08 + rnd() * 0.3;
      const debut = Math.round(i * duree + (i ? transition : 0));
      const fin = Math.round((i + 1) * duree);
      sommets.push({ t: debut, v });
      sommets.push({ t: Math.max(debut, fin), v });
    }
    return { ...REGLES.jauge, sommets };
  }

  if (epreuve === 'ola') {
    const { tours, depart, secteurs } = REGLES.ola;
    /* La tribune du joueur, loin du départ de la vague : le premier passage
       doit se voir venir d'au moins un tiers de tour. */
    const place = Math.floor(secteurs * (0.35 + rnd() * 0.5));
    const position = (place + 0.5) / secteurs;
    const passages = [];
    let debut = depart;
    for (const d of tours) {
      passages.push(Math.round(debut + position * d));
      debut += d;
    }
    return { ...REGLES.ola, place, position, passages, ms: debut + 500 };
  }

  if (epreuve === 'miroir') {
    const { manches: longueurs, pas, attente, marge } = REGLES.miroir;
    const manches = [];
    let horloge = 500;
    for (const n of longueurs) {
      const coups = [];
      let at = 0;
      for (let i = 0; i < n; i++) {
        if (i) at += pas[Math.floor(rnd() * pas.length)];
        coups.push({ t: at, cote: rnd() < 0.5 ? 0 : 1 });
      }
      /* Les deux côtés, toujours : un motif tout à gauche se rejoue tout à
         droite sans rien retourner, et l'épreuve redevient l'écho. */
      if (coups.every((c) => c.cote === coups[0].cote)) coups[n - 1].cote ^= 1;
      const reponse = horloge + at + attente;
      const fin = reponse + at + marge;
      manches.push({ debut: horloge, reponse, fin, coups });
      horloge = fin + 500;
    }
    return { ...REGLES.miroir, manches, ms: horloge };
  }

  if (epreuve === 'rouleaux') {
    const { lancers, parLancer, depart, vent, ventMin } = REGLES.rouleaux;
    const liste = Array.from({ length: lancers }, (_, i) => {
      /* Jamais sans vent : un lancer sans dérive se vise sur la cible, et
         l'on ne mesure plus que la force. Le sens change d'un lancer à
         l'autre plus souvent qu'il ne se répète. */
      const force = ventMin + rnd() * (vent - ventMin);
      return {
        t: depart + i * parLancer,
        cible: { x: 0.25 + rnd() * 0.5, y: 0.1 + rnd() * 0.2 },
        vent: +(force * (rnd() < 0.5 ? -1 : 1)).toFixed(3),
      };
    });
    return { ...REGLES.rouleaux, liste, ms: depart + lancers * parLancer + 300 };
  }

  if (epreuve === 'deuxvoix') {
    const { ms, gauche, droite, depart, ecartMin } = REGLES.deuxvoix;
    const brut = [];
    /* Deux cadences décalées, et un coup de temps en temps retiré : sans ces
       trous, l'épreuve se jouerait sur deux métronomes, les yeux fermés. */
    for (const [cote, pas, decal] of [[0, gauche, 0], [1, droite, pas2(rnd, droite)]]) {
      for (let at = depart + decal; at < ms - 500; at += pas) {
        if (rnd() < 0.18) continue;
        brut.push({ t: Math.round(at), cote });
      }
    }
    brut.sort((a, b) => a.t - b.t);
    const notes = [];
    for (const n of brut) {
      if (notes.length && n.t - notes[notes.length - 1].t < ecartMin) continue;
      notes.push(n);
    }
    return { ...REGLES.deuxvoix, notes };
  }

  throw new Triche('epreuve.inconnue');
}

/** Le décalage de la seconde voix : quelque part dans le premier tiers de son pas. */
const pas2 = (rnd, pas) => Math.round(pas * (0.2 + rnd() * 0.3));

/* ---------------------------------------------------------- les mesures */

/** Le carré de la distance entre deux points. La racine ne sert à rien ici. */
const d2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

/** La distance d'un point au plus proche des points d'un tracé. */
function distanceAu(trace, p) {
  let m = Infinity;
  for (const q of trace) {
    const d = d2(q, p);
    if (d < m) m = d;
  }
  return Math.sqrt(m);
}

/**
 * Une réponse d'humain, ou non.
 *
 * Deux signatures, et elles ne se valent pas.
 *
 * **Trop prompt** est un fait : deux appuis séparés de quarante millisecondes
 * ne viennent pas d'un doigt. Ce contrôle-là vaut dès le deuxième coup.
 *
 * **Trop régulier** est une statistique, et une statistique sur cinq écarts ne
 * vaut presque rien. Le seuil était de quatorze millisecondes, et il prenait
 * un joueur honnête pour un robot **une fois sur vingt** : à six coups, l'écart
 * type d'une hésitation naturelle tombe sous quatorze bien plus souvent qu'on
 * ne le croit. Mesuré, pas supposé — cinq virgule un pour cent sur quarante
 * mille tirages.
 *
 * Six millisecondes écartent toujours cent pour cent des machines, même
 * bruitées de trois millisecondes, et ne prennent plus qu'un honnête sur cinq
 * cents. C'est le bon réglage : un filet qui attrape le joueur qu'il devait
 * protéger finit par être désactivé, et alors il n'attrape plus personne.
 */
function humain(instants, { minEcart = 90, minVariation = 6 } = {}) {
  if (!Array.isArray(instants) || instants.length < 2) return;
  const ecarts = [];
  for (let i = 1; i < instants.length; i++) {
    const e = instants[i] - instants[i - 1];
    if (e < minEcart) throw new Triche('reponse.trop_rapide');
    ecarts.push(e);
  }
  // La régularité ne se juge pas sur trois valeurs.
  if (ecarts.length < 4) return;
  const moyen = ecarts.reduce((s, e) => s + e, 0) / ecarts.length;
  const variation = Math.sqrt(
    ecarts.reduce((s, e) => s + (e - moyen) ** 2, 0) / ecarts.length);
  if (variation < minVariation) throw new Triche('reponse.trop_reguliere');
}

/* ---------------------------------------------------------- la notation */

/**
 * La note d'une réponse, de 0 à 1,2 — la même échelle que les dix gestes.
 *
 * `mods` agit comme ailleurs : ce sont les modificateurs du Fanzzy et de
 * l'équipement. Ils **élargissent une tolérance**, ils ne fabriquent jamais de
 * note à partir de rien. Un porteur de Jumelles a le trait plus large ; il n'a
 * pas un tifo qu'il n'a pas tracé.
 */
export function noter(epreuve, consigne, reponse, mods = {}) {
  if (!consigne) throw new Triche('consigne.absente');
  const r = reponse ?? {};

  if (epreuve === 'tifo' || epreuve === 'echarpe') {
    const trace = Array.isArray(r.trace) ? r.trace : [];
    const cfg = REGLES[epreuve];
    if (trace.length < cfg.minPoints) return 0;
    if (trace.length > cfg.maxPoints) throw new Triche('trace.trop_longue');
    for (const p of trace) {
      if (!Number.isFinite(p?.x) || !Number.isFinite(p?.y)) {
        throw new Triche('trace.invalide');
      }
    }
    return epreuve === 'tifo'
      ? noterTifo(consigne, trace, mods)
      : noterEcharpe(consigne, trace, mods);
  }

  if (epreuve === 'mosaique') {
    const rendue = Array.isArray(r.grille) ? r.grille : [];
    if (rendue.length !== consigne.grille.length) return 0;
    humain(r.instants);
    /* On compte les cases **allumées** trouvées, et on retire les fausses.
       Compter les cases justes tout court donnerait dix sur seize à qui ne
       touche à rien — la grille est majoritairement éteinte. */
    let bonnes = 0;
    let fausses = 0;
    for (let i = 0; i < rendue.length; i++) {
      if (consigne.grille[i] === 1 && rendue[i] === 1) bonnes++;
      if (consigne.grille[i] === 0 && rendue[i] === 1) fausses++;
    }
    const part = Math.max(0, bonnes - fausses) / consigne.allumees;
    return Math.min(1.2, part * (mods.memoireBonus ?? 1));
  }

  if (epreuve === 'memoire') {
    const paires = Array.isArray(r.paires) ? r.paires : [];
    humain(r.instants);
    const vues = new Set();
    let trouvees = 0;
    for (const [a, b] of paires) {
      if (!Number.isInteger(a) || !Number.isInteger(b) || a === b) continue;
      if (vues.has(a) || vues.has(b)) continue;                 // déjà servie
      if (consigne.cartes[a] === undefined) continue;
      if (consigne.cartes[a] === consigne.cartes[b]) {
        trouvees++;
        vues.add(a); vues.add(b);
      }
    }
    /* Les essais ratés coûtent, mais moins qu'une paire ne rapporte : se
       tromper une fois ne doit pas effacer ce qu'on a trouvé deux fois. */
    const rates = Math.max(0, paires.length - trouvees);
    const part = (trouvees - rates * 0.34) / consigne.paires;
    return Math.min(1.2, Math.max(0, part) * (mods.memoireBonus ?? 1));
  }

  if (epreuve === 'capo') {
    const rendue = Array.isArray(r.suite) ? r.suite : [];
    humain(r.instants);
    /* Le **plus long début juste**, et non le nombre de coups justes. Une
       suite où l'on se trompe au deuxième coup puis retombe juste par hasard
       n'est pas une suite retenue ; s'arrêter au premier écart dit exactement
       jusqu'où la mémoire a tenu. */
    let n = 0;
    while (n < consigne.suite.length && rendue[n] === consigne.suite[n]) n++;
    return Math.min(1.2, (n / consigne.suite.length) * (mods.memoireBonus ?? 1));
  }

  /**
   * **Le tri.** Combien de bons cartons ramassés, moins les mauvais.
   *
   * Un mauvais carton coûte un bon, sans demi-mesure : l'épreuve mesure la
   * discrimination, et une pénalité tiède se laisserait battre en ramassant
   * tout l'écran. C'est la seule note du répertoire où il vaut mieux s'arrêter
   * que continuer quand on n'est plus sûr.
   *
   * Elle ne dépend d'aucun bonus de mémoire : rien n'est caché. `tempoWindow`
   * n'y ferait rien non plus — ce n'est pas du rythme. Aucun équipement ne
   * l'aide, et c'est voulu : il doit rester une épreuve que le sac ne change
   * pas.
   */
  if (epreuve === 'tri') {
    const touches = Array.isArray(r.touches) ? r.touches : [];
    humain(r.instants);
    const vus = new Set();
    let bons = 0;
    let mauvais = 0;
    for (const i of touches) {
      if (!Number.isInteger(i) || vus.has(i)) continue;   // deux fois le même ne compte qu'une
      const couleur = consigne.plateau[i];
      if (couleur === undefined) continue;
      vus.add(i);
      if (couleur === consigne.cible) bons++; else mauvais++;
    }
    const aTrouver = consigne.plateau.filter((c) => c === consigne.cible).length;
    if (!aTrouver) return 0;
    return Math.max(0, Math.min(1.2, (bons - mauvais) / aTrouver));
  }

  /**
   * **Le compte.** Tomber juste, sans rien à regarder.
   *
   * Le seul endroit du jeu où l'on ne mesure ni la précision d'un doigt ni une
   * mémoire, mais une horloge intérieure. Le compte à rebours s'affiche trois
   * secondes puis s'éteint : le reste se tient à l'aveugle.
   *
   * **L'instant est mesuré par le client**, comme tous les gestes de rythme du
   * jeu : on ne peut pas faire autrement, la latence réseau vaudrait plusieurs
   * fois l'écart qu'on mesure. Le garde-fou est le même que partout — un écart
   * nul est refusé, parce qu'un humain ne tombe pas à la milliseconde.
   */
  if (epreuve === 'compte') {
    const ecoule = Number(r.ecoule);
    if (!Number.isFinite(ecoule) || ecoule < 0) return 0;
    /* Une réponse au-delà du temps imparti n'est pas une réponse tardive :
       c'est une réponse qui n'a pas été donnée pendant l'épreuve. */
    if (ecoule > consigne.ms) throw new Triche('reponse.hors_delai');
    const ecart = Math.abs(ecoule - consigne.cible);
    /* Exactement à la milliseconde : personne ne fait ça. Un client qui rend
       zéro d'écart rend un nombre calculé, pas un geste. */
    if (ecart === 0) throw new Triche('reponse.trop_juste');
    return Math.max(0, Math.min(1.2,
      (1 - ecart / consigne.tolerance) * (mods.memoireBonus ?? 1)));
  }


  /**
   * **La bascule.** Décider vite, et savoir se retenir.
   *
   * Un signal sur trois demande l'inverse de ce qu'il montre. La difficulté
   * n'est pas de savoir quoi faire — c'est écrit — mais d'arrêter un geste
   * déjà parti. Rien d'autre dans le jeu ne mesure ça.
   *
   * Une absence de réponse vaut zéro pour ce signal, et **ne coûte rien de
   * plus** : s'abstenir quand on n'est pas sûr est une façon de jouer, pas une
   * triche. Une erreur, elle, ne rapporte rien non plus — la note est la part
   * de bonnes réponses, tout simplement.
   */
  if (epreuve === 'bascule') {
    const choix = Array.isArray(r.choix) ? r.choix : [];
    humain(r.instants, { minEcart: 140 });
    const signaux = consigne.signaux ?? [];
    if (!signaux.length) return 0;
    let bons = 0;
    let rates = 0;
    for (let i = 0; i < signaux.length; i++) {
      const attendu = signaux[i].contre ? (signaux[i].cote ^ 1) : signaux[i].cote;
      if (choix[i] === attendu) bons++;
      else if (choix[i] === 0 || choix[i] === 1) rates++;   // répondu, et faux
    }
    /* **Une erreur coûte une réussite**, comme au tri des cartons.

       Compter les seules bonnes réponses laissait 0,70 à qui ne lisait pas
       l'inversion du tout — un signal sur trois seulement est inversé, donc
       répondre bêtement le côté montré payait presque autant que jouer.
       L'épreuve entière ne valait que trois dixièmes de sa note.

       Avec le retranchement, ignorer l'inversion tombe à 0,30 et taper
       toujours le même côté à zéro. Et **s'abstenir ne coûte rien de plus que
       de ne pas gagner** : se retenir quand on n'est pas sûr reste une façon
       de jouer, ce qui est exactement la qualité qu'on mesure. */
    return Math.max(0, Math.min(1.2,
      ((bons - rates) / signaux.length) * (mods.memoireBonus ?? 1)));
  }

  /**
   * **La visée.** Toucher au bon endroit et au bon moment.
   *
   * Les deux se multiplient, et c'est ce qui fait l'épreuve : toucher juste
   * trop tard ne vaut rien, et toucher à l'heure n'importe où non plus. Une
   * somme aurait laissé rattraper l'un par l'autre, et l'on aurait pu marteler
   * le centre de l'écran en rythme.
   *
   * Chaque touche va au fumigène **allumé à cet instant** — jamais à un
   * fumigène éteint, jamais à un fumigène pas encore allumé — et un fumigène
   * ne se touche qu'une fois : c'est la première touche de sa vie qui compte.
   * Sans ça, balayer l'écran de touches rapportait une cible par hasard toutes
   * les demi-secondes.
   *
   * L'appariement se faisait sur **l'écart le plus court dans le temps**, dans
   * les deux sens. Les fumigènes arrivent toutes les 1 150 ms : une touche
   * donnée 600 ms après l'apparition était plus proche du **suivant**, pas
   * encore allumé et ailleurs sur l'écran, et valait zéro. Avec une fenêtre
   * de 520 ms, c'était le sort de presque toutes les touches humaines.
   */
  if (epreuve === 'visee') {
    const touches = Array.isArray(r.touches) ? r.touches : [];
    const cibles = consigne.cibles ?? [];
    if (!cibles.length) return 0;
    if (touches.length > cibles.length * 4) throw new Triche('touches.trop_nombreuses');
    for (const p of touches) {
      if (!Number.isFinite(p?.x) || !Number.isFinite(p?.y) || !Number.isFinite(p?.t)) {
        throw new Triche('touche.invalide');
      }
    }
    /* Les réglages d'avant `vie` et `coeur` restent lisibles : une consigne
       tirée juste avant un déploiement est notée juste après. */
    const fenetre = consigne.fenetre ?? 450;
    const vie = Math.max(fenetre + 1, consigne.vie ?? fenetre * 1.6);
    const coeur = Math.min(consigne.coeur ?? 0, consigne.rayon * 0.9);
    /* Une image d'avance : le doigt qui tombe dans la frame où le rond apparaît
       l'a vu, même si l'horloge dit le contraire d'un cheveu. */
    const AVANCE = 40;
    const prises = new Set();
    let total = 0;
    for (const p of touches) {
      let rang = -1;
      for (let i = 0; i < cibles.length; i++) {
        if (prises.has(i)) continue;
        const dt = p.t - cibles[i].t;
        if (dt >= -AVANCE && dt < vie) { rang = i; break; }
      }
      if (rang < 0) continue;              // aucun fumigène allumé : touche perdue
      prises.add(rang);
      const c = cibles[rang];
      const dt = Math.max(0, p.t - c.t);
      const loin = Math.hypot(p.x - c.x, p.y - c.y);
      const place = loin <= coeur ? 1
        : Math.max(0, 1 - (loin - coeur) / (consigne.rayon - coeur));
      const heure = dt <= fenetre ? 1
        : Math.max(0, 1 - (dt - fenetre) / (vie - fenetre));
      total += place * heure;
    }
    return Math.max(0, Math.min(1.2,
      (total / cibles.length) * (mods.tempoWindow ?? 1)));
  }

  /**
   * **La jauge.** Tenir une valeur dans une bande qui bouge.
   *
   * Le sang-froid des dix gestes est un relâchement : une décision, une fois.
   * Celle-ci est son contraire — cent petites corrections, dont aucune n'est
   * bonne très longtemps. C'est la seule épreuve où l'on est noté **en
   * continu** plutôt que sur des instants.
   *
   * La bande est recalculée ici aux instants que le joueur a rendus, jamais à
   * ceux qu'il aurait choisis : la page interpole pour dessiner, la notation
   * interpole pour juger, et c'est elle qui fait foi.
   *
   * `minMesures` refuse une réponse trop peu échantillonnée — sans lui, trois
   * points bien placés vaudraient huit secondes de travail. Et une erreur
   * rigoureusement nulle est refusée pour la même raison qu'au compte :
   * personne ne suit une bande au millième.
   */
  if (epreuve === 'jauge') {
    const mesures = Array.isArray(r.mesures) ? r.mesures : [];
    if (mesures.length < consigne.minMesures) return 0;
    if (mesures.length > consigne.ms / 20) throw new Triche('mesures.trop_nombreuses');

    const centre = (t) => {
      const s = consigne.sommets ?? [];
      if (!s.length) return 0.5;
      if (t <= s[0].t) return s[0].v;
      for (let i = 1; i < s.length; i++) {
        if (t <= s[i].t) {
          const part = (t - s[i - 1].t) / Math.max(1, s[i].t - s[i - 1].t);
          return s[i - 1].v + (s[i].v - s[i - 1].v) * part;
        }
      }
      return s[s.length - 1].v;
    };

    const demi = consigne.largeur / 2;
    let total = 0;
    let parfaites = 0;
    for (const m of mesures) {
      if (!Number.isFinite(m?.t) || !Number.isFinite(m?.v)) {
        throw new Triche('mesure.invalide');
      }
      const ecart = Math.abs(m.v - centre(m.t));
      if (ecart === 0) parfaites++;
      /* Dedans vaut plein ; dehors, la note décroît jusqu'à une demi-bande de
         plus. Une falaise au bord de la bande rendrait l'épreuve brutale à
         jouer sans la rendre plus juste. */
      total += ecart <= demi ? 1 : Math.max(0, 1 - (ecart - demi) / demi);
    }
    if (parfaites > mesures.length * 0.5) throw new Triche('reponse.trop_juste');
    return Math.max(0, Math.min(1.2,
      (total / mesures.length) * (mods.holdBonus ?? 1)));
  }

  /**
   * **La ola.** Chaque passage est apparié à la frappe la plus proche, et une
   * frappe ne sert qu'une fois. Les frappes de trop coûtent : sans ça,
   * taper sans arrêt finirait par tomber sur chaque passage.
   */
  if (epreuve === 'ola') {
    const frappes = Array.isArray(r.frappes) ? r.frappes : [];
    const passages = consigne.passages ?? [];
    if (!passages.length) return 0;
    if (frappes.length > passages.length * 4) throw new Triche('frappes.trop_nombreuses');
    if (frappes.some((x) => !Number.isFinite(x))) throw new Triche('frappe.invalide');
    humain(frappes, { minEcart: 120 });
    const large = mods.tempoWindow ?? 1;
    const q = pleineEtLimite(consigne.fenetre * large, consigne.limite * large);
    const { total, libres } = apparier(passages, frappes, consigne.limite * large, q);
    return borne((total - libres * 0.5) / passages.length);
  }

  /**
   * **L'écho inversé.** Manche par manche : la n-ième frappe de la réponse
   * face au n-ième coup du motif. Le côté doit être **l'autre**, et l'écart
   * à la première frappe doit valoir celui du motif à son premier coup —
   * c'est le rythme qu'on juge, pas l'heure à laquelle on se lance.
   */
  if (epreuve === 'miroir') {
    const frappes = Array.isArray(r.frappes) ? r.frappes : [];
    const manches = consigne.manches ?? [];
    if (!manches.length) return 0;
    for (const f of frappes) {
      if (!Number.isFinite(f?.t) || (f.cote !== 0 && f.cote !== 1)) {
        throw new Triche('frappe.invalide');
      }
    }
    humain(frappes.map((f) => f.t), { minEcart: 70 });
    const tol = consigne.tolerance * (mods.tempoWindow ?? 1);
    let somme = 0;
    for (const m of manches) {
      const siennes = frappes.filter((f) => f.t >= m.reponse - 150 && f.t <= m.fin);
      let bien = 0;
      for (let i = 0; i < m.coups.length; i++) {
        const f = siennes[i];
        if (!f || f.cote !== (m.coups[i].cote ^ 1)) continue;
        if (i === 0) { bien += 1; continue; }
        const ecart = Math.abs((f.t - siennes[0].t) - (m.coups[i].t - m.coups[0].t));
        bien += Math.max(0, 1 - Math.max(0, ecart - consigne.jeu) / tol);
      }
      const deTrop = Math.max(0, siennes.length - m.coups.length);
      somme += Math.max(0, bien - deTrop * 0.5) / m.coups.length;
    }
    return borne(somme / manches.length);
  }

  /**
   * **Les rouleaux.** Le point de chute est **recalculé ici** à partir du
   * geste, jamais lu dans la réponse : la page le calcule pour l'animer, le
   * serveur pour le juger, et c'est lui qui fait foi. Un lancer par fenêtre,
   * le premier.
   */
  if (epreuve === 'rouleaux') {
    const gestes = Array.isArray(r.lancers) ? r.lancers : [];
    const liste = consigne.liste ?? [];
    if (!liste.length) return 0;
    if (gestes.length > liste.length * 3) throw new Triche('lancers.trop_nombreux');
    for (const g of gestes) {
      if (!['x0', 'y0', 'x1', 'y1', 't0', 't1'].every((k) => Number.isFinite(g?.[k]))) {
        throw new Triche('lancer.invalide');
      }
      if (g.t1 - g.t0 < consigne.dureeMin) throw new Triche('lancer.trop_rapide');
    }
    humain(gestes.map((g) => g.t0), { minEcart: 200 });
    const rayon = consigne.rayon * (mods.traitLarge ?? 1);
    let total = 0;
    for (const l of liste) {
      const g = gestes.find((x) => x.t0 >= l.t && x.t0 < l.t + consigne.parLancer);
      if (!g) continue;
      const chute = pointDeChute(g, l.vent, consigne.portee);
      const loin = Math.hypot(chute.x - l.cible.x, chute.y - l.cible.y);
      total += loin <= consigne.coeur ? 1
        : Math.max(0, 1 - (loin - consigne.coeur) / (rayon - consigne.coeur));
    }
    return borne(total / liste.length);
  }

  /**
   * **Les deux voix.** Chaque note est appariée à la frappe la plus proche
   * **de son côté**. Une frappe du mauvais côté ne rattrape rien, et elle
   * compte avec les frappes de trop : taper des deux mains sans regarder
   * doit coûter, pas rapporter la moitié.
   */
  if (epreuve === 'deuxvoix') {
    const frappes = Array.isArray(r.frappes) ? r.frappes : [];
    const notes = consigne.notes ?? [];
    if (!notes.length) return 0;
    if (frappes.length > notes.length * 3) throw new Triche('frappes.trop_nombreuses');
    for (const f of frappes) {
      if (!Number.isFinite(f?.t) || (f.cote !== 0 && f.cote !== 1)) {
        throw new Triche('frappe.invalide');
      }
    }
    /* Deux mains : deux frappes peuvent tomber très près l'une de l'autre,
       mais pas du même côté. On juge donc chaque main séparément. */
    for (const c of [0, 1]) {
      humain(frappes.filter((f) => f.cote === c).map((f) => f.t), { minEcart: 90 });
    }
    const large = mods.tempoWindow ?? 1;
    const q = pleineEtLimite(consigne.fenetre * large, consigne.limite * large);
    let total = 0;
    let libres = 0;
    for (const c of [0, 1]) {
      const res = apparier(notes.filter((n) => n.cote === c).map((n) => n.t),
        frappes.filter((f) => f.cote === c).map((f) => f.t), consigne.limite * large, q);
      total += res.total;
      libres += res.libres;
    }
    return borne((total - libres * 0.4) / notes.length);
  }

  throw new Triche('epreuve.inconnue');
}

/** La note d'une même échelle partout : de 0 à 1,2, jamais négative. */
const borne = (v) => Math.max(0, Math.min(1.2, v));

/** Pleine jusqu'à `pleine` ms d'écart, nulle à `limite`, droite entre les deux. */
const pleineEtLimite = (pleine, limite) => (dt) => (dt <= pleine ? 1
  : Math.max(0, 1 - (dt - pleine) / Math.max(1, limite - pleine)));

/**
 * Apparie des instants attendus à des frappes : chaque attendu prend la frappe
 * libre la plus proche, dans la limite. Rend la somme des notes et le nombre
 * de frappes restées sans emploi.
 */
function apparier(attendus, frappes, limite, note) {
  const prises = new Set();
  let total = 0;
  for (const a of attendus) {
    let rang = -1;
    let mieux = Infinity;
    for (let i = 0; i < frappes.length; i++) {
      if (prises.has(i)) continue;
      const dt = Math.abs(frappes[i] - a);
      if (dt < mieux) { mieux = dt; rang = i; }
    }
    if (rang < 0 || mieux > limite) continue;
    prises.add(rang);
    total += note(mieux);
  }
  return { total, libres: frappes.length - prises.size };
}

/**
 * Où retombe un rouleau. **Recopié à l'identique dans `public/geste.js`**,
 * qui s'en sert pour l'animer : le jour où l'un change, l'autre doit suivre,
 * et `epreuves-ui-smoke` les compare sur les mêmes gestes.
 *
 * Le rouleau part dans le prolongement du glissement, `portee` fois plus loin
 * que le doigt n'a glissé ; le vent le déporte en proportion de son vol.
 */
export function pointDeChute(g, vent, portee) {
  const dx = g.x1 - g.x0;
  const dy = g.y1 - g.y0;
  const vol = Math.hypot(dx, dy) * portee;
  return { x: g.x1 + dx * portee + vent * vol, y: g.y1 + dy * portee };
}

/** Le rang, sur le tracé de consigne, du point le plus proche de `p`. */
function rangLePlusProche(points, p) {
  let m = Infinity;
  let rang = 0;
  for (let i = 0; i < points.length; i++) {
    const d = d2(points[i], p);
    if (d < m) { m = d; rang = i; }
  }
  return rang;
}

/**
 * Le tifo : être **sur le trait**, avoir fait **tout le tour**, et l'avoir
 * fait **dans l'ordre**.
 *
 * Les trois comptent, et il faut les trois. On les multiplie plutôt que de les
 * moyenner : l'une nulle annule les autres, ce qui est le comportement voulu.
 *
 * - **La précision** seule se réussit en restant dix secondes sur un
 *   centimètre du trait, sans rien dessiner.
 * - **La couverture** seule se réussit en balayant tout le cadre.
 * - Et les deux ensemble ne suffisaient pas : un gribouillis de soixante
 *   points jetés au hasard marquait 0,78, mieux qu'un demi-cercle tracé
 *   proprement. La bande de tolérance couvrait la moitié de l'image, et des
 *   points épars finissaient par approcher toute la forme. C'est l'**ordre**
 *   qui sépare le tracé du gribouillis : un doigt qui suit une forme avance le
 *   long d'elle, d'un pas régulier, sans se téléporter.
 */
function noterTifo(consigne, trace, mods) {
  const tolerance = consigne.tolerance * (mods.traitLarge ?? 1);

  let dessus = 0;
  for (const p of trace) {
    if (distanceAu(consigne.points, p) <= tolerance) dessus++;
  }
  const precision = dessus / trace.length;

  let atteints = 0;
  for (const p of consigne.points) {
    if (distanceAu(trace, p) <= tolerance) atteints++;
  }
  const couverture = atteints / consigne.points.length;

  /* L'ordre. Pour chaque couple de points consécutifs du tracé on demande deux
     choses : que le doigt n'ait pas sauté d'un bout à l'autre du cadre, et
     qu'il ait avancé le long de la forme — d'au plus quelques rangs, dans un
     sens ou dans l'autre, la forme se traçant aussi bien à l'envers.

     Le tracé de consigne est **fermé**, donc le rang zéro suit le dernier :
     l'écart de rang se mesure sur le cercle, sinon boucler compterait pour un
     saut, et le dernier geste du joueur serait puni. */
  const n = consigne.points.length;
  let suivis = 0;
  for (let i = 1; i < trace.length; i++) {
    if (Math.hypot(trace[i].x - trace[i - 1].x, trace[i].y - trace[i - 1].y)
        > consigne.saut) continue;
    const brut = Math.abs(rangLePlusProche(consigne.points, trace[i])
      - rangLePlusProche(consigne.points, trace[i - 1]));
    const ecart = Math.min(brut, n - brut);
    if (ecart <= Math.max(2, Math.round(n * 0.08))) suivis++;
  }
  const ordre = trace.length > 1 ? suivis / (trace.length - 1) : 0;

  return Math.min(1.2, precision * couverture * ordre * 1.2);
}

/**
 * L'écharpe : tourner, rond et régulier.
 *
 * L'angle total se mesure en cumulant les écarts d'angle autour du centre du
 * tracé, **signés** : faire un demi-tour puis revenir en arrière ne fait pas
 * un tour, et c'est précisément ce qu'un va-et-vient produirait si on prenait
 * la valeur absolue.
 */
function noterEcharpe(consigne, trace, mods) {
  const cx = trace.reduce((s, p) => s + p.x, 0) / trace.length;
  const cy = trace.reduce((s, p) => s + p.y, 0) / trace.length;

  const rayons = trace.map((p) => Math.hypot(p.x - cx, p.y - cy));
  const rayonMoyen = rayons.reduce((s, r) => s + r, 0) / rayons.length;
  if (rayonMoyen < consigne.rayonMin) return 0;

  let angle = 0;
  for (let i = 1; i < trace.length; i++) {
    const a0 = Math.atan2(trace[i - 1].y - cy, trace[i - 1].x - cx);
    const a1 = Math.atan2(trace[i].y - cy, trace[i].x - cx);
    let d = a1 - a0;
    // Le saut de ±π à ∓π n'est pas un demi-tour : on le ramène.
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    angle += d;
  }

  // Le sens demandé : tourner à l'envers ne compte pas.
  const fait = (angle * consigne.sens) / (Math.PI * 2);
  const tours = Math.max(0, fait) / consigne.tours;

  /* La rondeur : un rayon qui varie beaucoup, c'est un gribouillis qui tourne.
     On la borne à un pour qu'un cercle parfait ne rapporte pas plus que la
     note pleine, et à zéro pour qu'un tracé informe ne la rende pas négative. */
  const ecart = Math.sqrt(
    rayons.reduce((s, r) => s + (r - rayonMoyen) ** 2, 0) / rayons.length);
  const rondeur = Math.max(0, Math.min(1, 1 - (ecart / rayonMoyen) / 0.55));

  return Math.min(1.2, Math.min(1, tours) * rondeur * 1.2 * (mods.traitLarge ?? 1));
}
