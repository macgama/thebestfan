/**
 * Ce que dit le Fanzzy de l'accueil, moment par moment.
 *
 * Il changeait déjà de visage — fier d'une victoire, abattu d'une défaite,
 * fâché d'un rouge, content qu'on revienne, agacé qu'on insiste —, mais il le
 * faisait en silence : sa bulle ne servait qu'à envoyer vers le match ou les
 * boosters. Il a maintenant des mots pour ces moments-là (6 octobre 2026, à la
 * demande de Gaël).
 *
 * **Trois étages, du plus personnel au plus large** : la réplique de ce
 * Fanzzy-là (`PERSO`, par carte, tirée de son histoire), celle de sa famille
 * (`FAMILLES` : une Voix chante, une Percussion tape, un Déplacement compte
 * les kilomètres), et celle de tout le monde (`COMMUN`), qui sert aussi au
 * supporter générique. Un moment sans réplique ne dit rien.
 *
 * **Par carte et non par lignée** : Gosier Rouillé dit « Ça revient…
 * presque », Gosier de Bronze, son troisième âge, n'a plus à le dire. Un âge
 * sans réplique à lui parle comme sa famille.
 *
 * **Les règles du marqueur** (amendement 6) valent pour chaque ligne : jamais
 * un chiffre, jamais plus de quatre mots. L'accueil les revérifie avant
 * d'écrire, et `repliques:test` les vérifie ici, une à une.
 *
 * Script classique, comme `fanzzy-etats.js` : un global, `TBF_REPLIQUES`.
 */
(() => {
  /** Ce que tout le monde peut dire. `salut` se dit selon l'heure. */
  const COMMUN = {
    salut: {
      matin: ['Déjà debout ?', 'Salut, toi !', 'Bien dormi ?'],
      jour: ['Te revoilà !', 'Salut, toi !', 'Tiens, te voilà.'],
      soir: ['Enfin te voilà !', 'Bonsoir, toi.', 'Grosse journée ?'],
      nuit: ['Tu dors pas ?', 'Encore debout ?', 'Chut, ça dort.'],
    },
    retour: ['T’étais passé où ?', 'Tu m’as manqué.', 'Te revoilà, enfin !', 'J’ai gardé ta place.'],
    victoire: ['On les a eus !', 'Quelle soirée !', 'Ça, c’est fait !'],
    defaite: ['On reviendra plus fort.', 'Ça fait mal.', 'On repart au charbon.'],
    nul: ['Un point, bof.', 'Ni bien, ni mal.', 'Bof, un nul.'],
    rouge: ['À dix, sérieux ?', 'L’arbitre, franchement…', 'Ce rouge, quand même…'],
    encore: ['Encore ! Encore !', 'Ça chatouille !', 'Hé, doucement !'],
    boude: ['Bon, ça suffit.', 'Laisse-moi tranquille.', 'Je boude.'],
    calme: ['On est bien, là.', 'Vivement le match.', 'Tranquille.'],
  };

  /** Ce que dit chaque famille, à sa façon. Les clés sont celles de `dex.js`. */
  const FAMILLES = {
    voix: {
      retour: ['Ma voix t’attendait.'],
      victoire: ['J’ai plus de voix !', 'On les a chantés !'],
      defaite: ['Plus envie de chanter.'],
      nul: ['Tout ça pour ça.'],
      rouge: ['Je l’ai sifflé, moi.'],
      encore: ['Allez, avec moi !'],
      boude: ['Je chante plus.'],
      calme: ['La la la…', 'Je chauffe ma voix.'],
    },
    perc: {
      retour: ['Le tambour t’attendait.'],
      victoire: ['Mes mains brûlent encore.', 'Boum ! Boum ! Boum !'],
      defaite: ['Tambour en berne.'],
      nul: ['Boum… et rien.'],
      rouge: ['Roulement de colère.'],
      encore: ['Plus vite !'],
      boude: ['Plus de rythme.'],
      calme: ['Boum. Boum.', 'Je garde le rythme.'],
    },
    fide: {
      retour: ['Je n’ai pas bougé.'],
      victoire: ['Je l’avais toujours dit.'],
      defaite: ['Je reste. Toujours.'],
      nul: ['On sera encore là.'],
      rouge: ['Même à dix, présent.'],
      encore: ['Toujours là !'],
      boude: ['Je bouge pas.'],
      calme: ['Je suis là.', 'Fidèle au poste.'],
    },
    tifo: {
      retour: ['J’ai repeint en attendant.'],
      victoire: ['Sortez la grande bâche !'],
      defaite: ['On replie la bâche.'],
      nul: ['Gris, comme le ciel.'],
      rouge: ['Carton rouge, tifo noir.'],
      encore: ['Tout le monde lève !'],
      boude: ['Rangé, le tifo.'],
      calme: ['Il manque un carré.', 'Je prépare la suite.'],
    },
    pyro: {
      retour: ['Je gardais la flamme.'],
      victoire: ['Ça brûle encore !'],
      defaite: ['Mèche mouillée, ce soir.'],
      nul: ['Pétard mouillé.'],
      rouge: ['Je vois rouge.'],
      encore: ['Ça chauffe !'],
      boude: ['Je m’éteins.'],
      calme: ['Ça sent la poudre.', 'Pas encore, pas encore…'],
    },
    depl: {
      retour: ['T’as fait la route ?'],
      victoire: ['Ça valait le voyage !'],
      defaite: ['Long retour en car.'],
      nul: ['Tout ce trajet…'],
      rouge: ['À dix, on suit.'],
      encore: ['En route !'],
      boude: ['Je descends ici.'],
      calme: ['On part quand ?', 'Le car chauffe.'],
    },
  };

  /**
   * La réplique de chaque Fanzzy, tirée de son histoire — LA REPRISE, au
   * premier âge. Elle se dit au calme, quand on le touche sans insister.
   */
  const PERSO = {
    // la voix
    RP1: { calme: ['Ça revient… presque.', 'Hum. Hum hum.'] },
    RP2: { calme: ['C’était quoi, la suite ?', 'Le deuxième couplet ?'] },
    RP14: { calme: ['Je lance, vous suivez.', 'Quelqu’un commence ? Moi.'] },
    RP18: { calme: ['Je l’ai chanté avant !', 'Cui-cui, allez !'] },
    RP19: { calme: ['Krrr… allez… krrr…', 'Test… krrr… test.'] },
    RP20: { calme: ['Je capte la reprise.', 'Bzzz… réveillée !'] },
    // la percussion
    RP3: { calme: ['Je sonne faux, non ?', 'Pas encore rodée.'] },
    RP4: { calme: ['Aïe, mes paumes.', 'Ça pique, là.'] },
    RP15: { calme: ['J’ai jamais arrêté.', 'Boum, comme mercredi.'] },
    RP21: { calme: ['Toc toc toc !', 'Elle sonne, la rambarde.'] },
    RP22: { calme: ['Je la lâche jamais.', 'Elle me suit partout.'] },
    RP23: { calme: ['Brrr, réchauffe-moi.', 'Tape, ça réchauffe.'] },
    // la fidélité
    RP5: { calme: ['Même place, même voisin.', 'Repris sans réfléchir.'] },
    RP6: { calme: ['Je garde sa place.', 'On n’en parle pas.'] },
    RP13: { calme: ['Le café est prêt.', 'J’ai allumé le chauffage.'] },
    RP24: { calme: ['Wouf ! Au virage !', 'Je connais le chemin.'] },
    RP25: { calme: ['Je pousse, tranquille.', 'Encore un mètre ?'] },
    RP26: { calme: ['Cette place est prise.', 'Pas toi, désolé.'] },
    // le tifo
    RP7: { calme: ['Ça sent la cave.', 'Un pli, et alors ?'] },
    RP8: { calme: ['Qui a mon carton ?', 'Il manque quelqu’un.'] },
    RP16: { calme: ['Chut… pas encore.', 'Je tombe bientôt.'] },
    RP27: { calme: ['Deux rouges, au choix.', 'Le bon rouge, lequel ?'] },
    RP28: { calme: ['Je me déplie…', 'Encore un tour !'] },
    RP29: { calme: ['Bzz… pile suivante ?', 'Je recompte les piles.'] },
    // la pyro
    RP9: { calme: ['Je pars… bientôt.', 'Encore un essai ?'] },
    RP10: { calme: ['Trois, deux… zut.', 'On partait à combien ?'] },
    RP17: { calme: ['Pas un mot.', 'Surprise, plus tard.'] },
    RP30: { calme: ['Il fait chaud dessous.', 'Tu m’as vue !'] },
    RP31: { calme: ['Ça gronde, là-haut.', 'J’arrive bientôt.'] },
    RP32: { calme: ['Jamais raté une reprise.', 'Clic. Toujours là.'] },
    // le déplacement
    RP11: { calme: ['Mange pas dedans !', 'Ça sent la peinture.'] },
    RP12: { calme: ['C’est à gauche ?', 'On recalcule l’itinéraire.'] },
    RP33: { calme: ['Arrivé avant le car.', 'Rrrou, on y va ?'] },
    RP34: { calme: ['Je démarre… presque.', 'Teuf… teuf… vroum.'] },
    RP35: { calme: ['Tu t’arrêtes ?', 'Y a quelqu’un ?'] },
  };

  const MOMENTS = ['salut', 'retour', 'victoire', 'defaite', 'nul', 'rouge',
    'encore', 'boude', 'calme'];

  /** Le moment de la journée, pour le salut : l'heure locale du joueur. */
  const tranche = (h) => (h >= 5 && h < 12 ? 'matin' : h >= 12 && h < 18 ? 'jour'
    : h >= 18 && h < 23 ? 'soir' : 'nuit');

  /** Toutes les lignes possibles pour ce moment, par étage. */
  function etages(moment, { carte, type, heure } = {}) {
    const commun = moment === 'salut'
      ? COMMUN.salut[tranche(Number.isFinite(heure) ? heure : new Date().getHours())]
      : COMMUN[moment];
    return [PERSO[carte]?.[moment] ?? [], FAMILLES[type]?.[moment] ?? [], commun ?? []];
  }

  /** La dernière ligne dite : on ne la redit pas deux fois de suite. */
  let derniere = null;

  /**
   * Une réplique pour ce moment, ou `null`.
   *
   * La sienne d'abord, une fois sur deux ; puis celle de sa famille, deux
   * fois sur trois ; sinon celle de tout le monde. Un étage vide passe la
   * main au suivant.
   *
   * @param {string} moment  l'un de `MOMENTS`
   * @param {{carte?: string, type?: string, heure?: number, hasard?: () => number}} [qui]
   */
  function dire(moment, qui = {}) {
    const hasard = typeof qui.hasard === 'function' ? qui.hasard : Math.random;
    const [perso, famille, commun] = etages(moment, qui);
    let ordre;
    if (perso.length && hasard() < 0.5) ordre = [perso, famille, commun];
    else if (famille.length && (!commun.length || hasard() < 2 / 3)) ordre = [famille, commun, perso];
    else ordre = [commun, famille, perso];
    /* L'étage tiré, sans la ligne qu'on vient de dire ; s'il n'a qu'elle, le
       suivant. Seul, il la redit plutôt que de se taire. */
    const libres = ordre.map((l) => l.filter((x) => x !== derniere)).find((l) => l.length)
      ?? ordre.find((l) => l.length);
    if (!libres) return null;
    derniere = libres[Math.floor(hasard() * libres.length) % libres.length];
    return derniere;
  }

  window.TBF_REPLIQUES = { dire, etages, tranche, MOMENTS, COMMUN, FAMILLES, PERSO };
})();
