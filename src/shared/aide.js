/**
 * Ce qu'on explique au joueur : le parcours des premiers pas, et la FAQ.
 *
 * ## Pourquoi ce fichier est partagé, et pourquoi il est du code
 *
 * Une aide ment toujours en premier sur les nombres. « 45 écharpes le
 * booster », « trois paquets au départ », « dix cartes d'action » : ce sont des
 * réglages, et trois d'entre eux se changent depuis l'administration sans
 * déployer quoi que ce soit. Une FAQ qui les recopie devient fausse le jour où
 * quelqu'un déplace un curseur, et personne ne fait le lien — surtout pas le
 * joueur, qui croit simplement s'être trompé.
 *
 * Les réponses sont donc des **fonctions**, pas des chaînes. Elles lisent
 * `reglage()`, `EVO_COST`, `DECK_RULES` et `SCARVES` au moment où on les rend.
 * Il n'y a pas un seul nombre écrit à la main dans les réponses, et
 * `scripts/aide-smoke.mjs` le vérifie : il change un réglage et exige que la
 * réponse change avec lui.
 *
 * ## Ce que ce fichier ne contient pas
 *
 * Aucune mise en forme, aucune balise. Les réponses sont du texte, et c'est la
 * page qui décide de leur apparence. Un jour où l'aide sera aussi lue par un
 * courriel ou par une autre langue, elle n'aura pas à démonter du HTML.
 *
 * ## Le parcours
 *
 * Six étapes, et **aucune ne se coche en cliquant**. Chacune nomme un signal
 * que le serveur lit dans ce que le joueur possède déjà — voir
 * `src/server/aide/index.js`. Une étape est donc soit vraie, soit fausse ; il
 * n'y a pas d'état « vu » à conserver, et rien à remettre à zéro.
 */
import { EVO_COST, SCARVES, POIGNEE_DE_REPLI } from './fanzzy/dex.js';
import { DECK_RULES } from './duel/actions.js';
import { reglage } from './reglages.js';

/**
 * Les six premiers pas, dans l'ordre où on les fait.
 *
 * `cle` nomme le signal que le serveur va chercher ; `ou` est l'écran où l'on
 * va le faire, et il doit exister dans le menu — sinon on envoie quelqu'un
 * dans le vide. `visuel` dit à la page ce qu'elle dessine : « carte » tire la
 * vraie carte du joueur, « dos » le vrai dos de booster, les autres sont des
 * emblèmes.
 */
export const ETAPES = [
  {
    cle: 'fanzzy',
    titre: 'Ton premier Fanzzy',
    visuel: 'carte',
    quoi: 'Un Fanzzy est un supporter. Il n’a pas de statistique de combat : '
      + 'il a un cri, et ce cri est un geste que tu vas devoir tenir.',
    pourquoi: 'C’est lui qui décide de ce que tu joues. Un Fanzzy de la Voix te '
      + 'demande du rythme, un Déplacement te demande de la mémoire. Tu ne choisis '
      + 'pas une puissance, tu choisis un geste que tu aimes faire.',
    ou: '/fanzzy',
    bouton: 'Voir ma collection',
  },
  {
    cle: 'booster',
    titre: 'Ouvre un booster',
    visuel: 'dos',
    quoi: 'Cinq cartes. Une ou deux sont des supporters — la deuxième sept fois '
      + 'sur dix. Les trois dernières donnent autre chose : de l’équipement, une '
      + 'carte d’action, une tenue, une expression, une carte Ultimate ou des écharpes.',
    pourquoi: () => 'Un double ne se perd pas : il se change en écharpes, '
      + `${SCARVES.commune} pour une commune et jusqu’à ${SCARVES.legendaire} `
      + 'pour une légendaire. Et les écharpes sont ce qui fait grandir tes '
      + 'supporters, donc les doubles paient les âges que tu ne tireras jamais.',
    ou: '/boosters',
    bouton: 'Ouvrir un booster',
  },
  {
    cle: 'evolution',
    titre: 'Fais grandir un Fanzzy',
    visuel: 'ages',
    quoi: () => 'La rareté d’un Fanzzy, c’est son âge. Commune, c’est le premier ; '
      + `rare, le deuxième — ${EVO_COST[2]} écharpes ; épique, le troisième — `
      + `${EVO_COST[3]} de plus. Même personnage, nouveau nom, nouvelle histoire.`,
    pourquoi: 'C’est la seule façon d’obtenir une rare ou une épique : aucun '
      + 'booster n’en donne. Les légendaires, elles, n’ont pas d’âge — elles '
      + 'arrivent entières ou pas du tout.',
    ou: '/fanzzy',
    bouton: 'Choisir qui grandit',
  },
  {
    cle: 'deck',
    titre: 'Compose ton deck',
    visuel: 'deck',
    quoi: () => `${DECK_RULES.fanzzy} Fanzzy, ${DECK_RULES.stuffParFanzzy} pièces `
      + `d’équipement pour chacun, et ${DECK_RULES.actions} cartes d’action. `
      + 'Le premier Fanzzy est ton titulaire : c’est lui qui entre sur le terrain. '
      + 'Un seul légendaire par deck, et jamais titulaire.',
    pourquoi: 'Chaque pièce d’équipement a un revers — elle donne quelque chose '
      + 'et en retire un autre. Il n’existe pas de meilleur équipement, seulement '
      + 'celui qui va avec le geste de ton titulaire.',
    ou: '/deck',
    bouton: 'Monter ma tribune',
  },
  {
    cle: 'virage',
    titre: 'Pousse dans le Grand Virage',
    visuel: 'corde',
    quoi: 'Une salle par match réel. Deux tribunes tirent sur la même corde '
      + 'pendant toute la rencontre, et tu chantes dedans avec tout le monde.',
    pourquoi: 'Personne n’y gagne seul : une tribune deux fois plus nombreuse ne '
      + 'pousse pas deux fois plus fort. Ce que tu décides, c’est ta place dans '
      + 'ta propre tribune. Et quand un vrai but tombe, la corde se secoue.',
    ou: '/virage',
    bouton: 'Entrer dans un virage',
    repeter: 'Répéter les gestes d’abord',
  },
  {
    cle: 'duel',
    titre: 'Joue un duel',
    visuel: 'duel',
    quoi: () => `Deux tribunes face à face, de ${DECK_RULES.fanzzyMin} contre `
      + `${DECK_RULES.fanzzyMin} à cinq contre cinq. Ton deck y entre tel que tu `
      + `l’as rangé, et ${DECK_RULES.mainVisible} cartes d’action te sont visibles `
      + 'à la fois.',
    pourquoi: 'Le duel s’adosse à un vrai match. Un match du jour ou en cours '
      + 'donne un duel classé, qui compte au classement ; un autre jour donne un '
      + 'entraînement, qui ne compte pas. On ne rejoue pas une soirée qu’on n’a '
      + 'pas vécue.',
    ou: '/duel-nvn',
    bouton: 'Chercher un duel',
    repeter: 'Répéter les gestes d’abord',
  },
];

/**
 * La FAQ, en rubriques.
 *
 * L'ordre suit celui du parcours : on répond d'abord à ce qu'on vient de voir.
 * Une rubrique « divers » a été refusée — c'est l'endroit où l'on range ce
 * qu'on n'a pas eu le courage de classer, et personne ne l'ouvre.
 */
const RUBRIQUES = [
  {
    titre: 'Les Fanzzy',
    questions: [
      ['Qu’est-ce qu’un Fanzzy, au juste ?',
        () => 'Un supporter, et rien d’autre. Il n’a ni attaque ni défense : il a '
          + 'un cri, et ce cri désigne un geste. Quand tu le joues, c’est ce geste '
          + 'qu’on te demande de tenir, et c’est ta main qui décide du résultat.'],
      ['Pourquoi ma carte est-elle « commune » alors qu’elle est forte ?',
        () => 'Parce que la rareté dit l’âge, pas la force. Commune est le premier '
          + `âge, rare le deuxième, épique le troisième. Un Fanzzy commun bien joué `
          + 'bat un épique mal joué : la rareté raconte le chemin parcouru, elle ne '
          + 'donne pas d’avantage automatique.'],
      ['Et les légendaires, alors ?',
        () => 'Elles sont à part. Une légendaire n’a pas de lignée : elle ne grandit '
          + 'pas et elle n’est l’âge de personne. Elle arrive entière, directement '
          + `dans un booster — environ ${virgule(reglage('pack.legendaire_fanzzy'))} % `
          + `des boosters en donnent une —, et un double en rend ${SCARVES.legendaire} `
          + 'écharpes.'],
      ['Pourquoi mon légendaire ne fait-il rien au coup d’envoi ?',
        () => (reglage('legende.chants') > 0
          ? 'Parce qu’il dort. Un deck n’accepte qu’un seul légendaire, Fanzzy ou '
            + 'pièce d’équipement, et jamais comme titulaire : il attend sur le banc. '
            + `Il se réveille après ${reglage('legende.chants')} chants réussis (BON ou `
            + 'PARFAIT), à chaque duel et à chaque match de Virage. La légende entre '
            + 'en jeu, elle n’y est pas au coup d’envoi.'
          : 'Un deck n’accepte qu’un seul légendaire, Fanzzy ou pièce d’équipement, '
            + 'et jamais comme titulaire : il attend sur le banc, mais ses effets '
            + 'jouent dès la première seconde.')],
      ['C’est quoi, un Fanzzy lié à un club ?',
        () => 'Un Fanzzy qui porte les couleurs d’une équipe. Joue-le dans un match '
          + `de ce club, quand c’est un club que tu suis : il pousse ${reglage('fanzzy.lien_force')} % `
          + `plus fort, rapporte ${reglage('fanzzy.lien_gain')} % de plus et lance le cri `
          + 'de son club, au Grand Virage comme en duel. Sa fiche le dit d’un tampon, '
          + '« LIÉ À TON CLUB ». Ailleurs, il joue comme un autre.'],
      ['Puis-je lier un Fanzzy neutre à mon club ?',
        () => `Oui, depuis sa fiche, pour ${reglage('fanzzy.lien_prix')} écharpes. Il `
          + 'se lie à ton club principal, une seule fois et pour toujours, et gagne '
          + 'alors le même bonus qu’un Fanzzy né dans ses couleurs.'],
      ['C’est quoi une « famille » ?',
        () => 'Six façons de supporter : la Voix, la Percussion, la Fidélité, le '
          + 'Tifo, la Pyro et le Déplacement. Chaque famille annonce les gestes '
          + 'qu’elle joue, et le geste qui porte son nom y est toujours le plus '
          + 'fréquent — une Voix qui ne ferait pas surtout du rythme ne serait pas '
          + 'une Voix.'],
      ['Une tenue rend-elle mon Fanzzy meilleur ?',
        () => 'Non. Jamais. Une tenue change ce qu’on voit et rien d’autre — c’est '
          + 'une règle du jeu, pas un oubli. Ce qui compte, c’est l’équipement, et '
          + 'lui se voit dans le deck.'],
      ['Pourquoi certaines de mes cartes sont-elles floues et verrouillées ?',
        () => 'Ce sont les âges que tu n’as pas encore payés. On te montre qu’ils '
          + 'existent sans te montrer qui ils sont : découvrir le personnage fait '
          + 'partie de l’évolution.'],
    ],
  },
  {
    titre: 'L’Ultimate',
    questions: [
      ['C’est quoi, l’Ultimate ?',
        () => 'Le coup fatal de ton Fanzzy : il porte le nom de son cri et pousse la '
          + 'corde très fort. Une jauge d’or se remplit à chaque chant réussi — un BON '
          + `compte un point, un PARFAIT deux — et elle est pleine à ${reglage('ultime.charge')} `
          + 'points. En duel, c’est l’anneau du gros bouton rond, au bout de tes chants ; '
          + 'au Grand Virage, la ligne sous ton souffle. Pleine, elle s’allume et bat : '
          + 'touche-la, réussis le geste de ton Fanzzy, et la corde part d’un coup. Raté, '
          + 'il pousse encore la moitié.'],
      ['Combien de fois puis-je le lancer ?',
        () => 'Une fois par duel, et une fois par match de Virage : choisis bien ton '
          + 'moment. En duel, la Relève fait grandir ton Fanzzy et son Ultimate avec '
          + `lui, de ${reglage('ultime.bonus_age')} % par âge. Au Grand Virage, on joue `
          + 'au premier âge.'],
      ['La carte Ultimate rend-elle mon Fanzzy plus fort ?',
        'Non. Tout le monde a l’Ultimate, et il pousse pareil pour tous. La carte, '
          + 'une par âge de chaque Fanzzy, se trouve dans les boosters et débloque la '
          + 'grande scène : le coup fatal en plein écran, que la tribune d’en face voit '
          + 'aussi. Elle se range sur la fiche du Fanzzy et dans le rayon ULTIMATE de '
          + 'ta collection, sans compter dans les paliers de collection.'],
      ['Puis-je acheter une carte Ultimate ?',
        `Oui, dans le rayon ULTIMATE de la boutique, pour ${reglage('etal.ultime')} écharpes : `
          + 'celle d’un âge que ton Fanzzy a déjà atteint. VOIR LA SCÈNE la montre avant '
          + 'l’achat. Celles des légendaires ne s’achètent pas, elles ne sortent qu’en booster.'],
    ],
  },
  {
    titre: 'Les boosters et les écharpes',
    questions: [
      ['Combien de boosters ai-je, et comment en avoir plus ?',
        () => `Tu commences avec ${reglage('pack.depart')}. La réserve se remplit `
          + `ensuite toute seule, un paquet toutes les ${reglage('pack.regen_min')} `
          + `minutes, jusqu’à ${reglage('pack.max')}. Tu peux aussi en acheter un `
          + `pour ${reglage('pack.prix_echarpes')} écharpes quand la réserve est vide.`],
      ['Il y a quoi dans un booster ?',
        () => 'Cinq cartes. La première est toujours un supporter, la deuxième l’est '
          + 'sept fois sur dix. Les trois dernières donnent une carte d’action, une '
          + 'pièce d’équipement, une tenue, un état ou une poignée d’écharpes — '
          + 'jamais un supporter de plus. Si tu as déjà toutes les tenues, tous les '
          + 'états ou toutes les cartes d’action que la carte pouvait te donner, '
          + `elle se change en ${POIGNEE_DE_REPLI} écharpes.`],
      ['Que valent mes doubles ?',
        () => 'Ils deviennent des écharpes, au tarif de la rareté : '
          + `${SCARVES.commune} pour une commune, ${SCARVES.rare} pour une rare, `
          + `${SCARVES.epique} pour une épique et ${SCARVES.legendaire} pour une `
          + 'légendaire. Rien ne se perd, jamais.'],
      ['À quoi servent les écharpes ?',
        () => 'À faire grandir tes supporters, d’abord — c’est leur premier emploi. '
          + 'Ensuite à acheter un booster de plus, un emplacement de club, à lier un '
          + 'Fanzzy neutre à ton club, ou à ce que propose la boutique.'],
      ['Pourquoi je ne tire jamais de rare ni d’épique ?',
        () => 'Parce qu’aucun booster n’en donne. Une rare est le deuxième âge d’une '
          + 'commune que tu possèdes déjà, et une épique le troisième. Elles ne se '
          + 'tirent pas : elles se paient.'],
      ['Toutes les cartes du jeu sont-elles distribuées ?',
        () => 'Non. Le jeu s’ouvre par saisons, et une saison ouvre pour tout le '
          + 'monde le même jour. Ce qui n’est pas encore ouvert ne sort d’aucun '
          + 'booster — mais rien de ce que tu possèdes déjà ne t’est jamais retiré.'],
    ],
  },
  {
    titre: 'Le deck et l’équipement',
    questions: [
      ['Que dois-je mettre dans mon deck ?',
        () => `${DECK_RULES.fanzzy} Fanzzy au plus et ${DECK_RULES.fanzzyMin} au `
          + `minimum, jusqu’à ${DECK_RULES.stuffParFanzzy} pièces d’équipement sur `
          + `chacun, et exactement ${DECK_RULES.actions} cartes d’action. Le premier `
          + 'Fanzzy est le titulaire : c’est lui qui entre.'],
      ['Pourquoi mon équipement me retire quelque chose ?',
        () => 'Parce que chaque pièce a un revers, sans exception. Elle donne d’un '
          + 'côté et reprend de l’autre. C’est ce qui fait qu’il n’existe pas de '
          + 'meilleur équipement — seulement celui qui convient au geste de ton '
          + 'titulaire.'],
      ['Puis-je mettre dix fois la même carte d’action ?',
        () => 'Oui. Une carte d’action se possède une fois et le deck en accepte '
          + `${DECK_RULES.actions} exemplaires : c’est le même droit répété. Mais un `
          + 'deck d’une seule carte ne te laisse aucune décision à prendre en duel.'],
      ['D’où viennent les cartes d’action que je n’ai jamais gagnées ?',
        () => 'Les communes sont offertes à tout le monde. Sans elles, un joueur qui '
          + `débute ne pourrait pas remplir ses ${DECK_RULES.actions} emplacements le `
          + 'premier jour.'],
      ['C’est quoi, une pièce de club ?',
        () => 'Une pièce d’équipement aux couleurs d’un club, deux par club des Terraces '
          + 'pour commencer. Portée par un Fanzzy lié au même club, c’est le COMBO : son '
          + `revers perd ${reglage('stuff.club_revers')} %, dans tous les matchs. Et dans un `
          + `match de ton club principal, c’est PLEIN CLUB : chacune rapporte ${reglage('stuff.club_gain')} % `
          + 'd’écharpes en duel, ou de ferveur au Virage, en plus du lien du Fanzzy. '
          + 'La force, elle, ne change pas.'],
      ['Mon deck change-t-il quelque chose au Grand Virage ?',
        () => 'Très peu : le Virage se joue au chant, pas au deck. Il compte pour le '
          + 'duel, où ton titulaire et ton équipement pèsent sur chaque geste.'],
    ],
  },
  {
    titre: 'Le Virage et les duels',
    questions: [
      ['C’est quoi, le Grand Virage ?',
        () => 'Une salle par match réel. Deux tribunes tirent sur une corde pendant '
          + `toute la rencontre, et la corde bascule quand un camp atteint `
          + `${reglage('virage.but_a')}. Tu y chantes avec tous ceux qui sont entrés `
          + 'du même côté que toi.'],
      ['Puis-je pousser pour un club dont je ne suis pas ?',
        () => 'Oui, tous les matchs en direct sont ouverts. Ta poussée compte '
          + 'entièrement pour la tribune — on ne décourage personne de venir. Ce qui '
          + 'est réduit de moitié, c’est la ferveur que tu gagnes, toi : on vient '
          + 'pousser partout, on ne se bâtit une réputation que chez soi.'],
      ['Si je reste sans rien faire, je compte quand même ?',
        () => `Non. Après ${reglage('virage.inactif_sec')} secondes sans geste, tu ne `
          + 'comptes plus dans la foule. Il faut chanter pour être là.'],
      ['Mon duel compte-t-il au classement ?',
        () => 'Seulement s’il s’adosse à un match du jour ou en cours. Un match d’un '
          + 'autre jour donne un entraînement, qui ne compte pas — et un match déjà '
          + 'passé est refusé.'
          + (reglage('abo.duels_classes_jour') > 0
            ? ` Sans PASS de tribune, ${reglage('abo.duels_classes_jour')} duels classés `
              + 'comptent par jour ; au-delà, tu joues toujours, en entraînement.'
            : '')],
      ['Comment savoir où l’on joue en ce moment ?',
        'Sur MATCHS et dans les compétitions, sous chaque match : la pastille verte '
          + 'VIRAGE dit que sa tribune est ouverte et combien de supporters y poussent, '
          + 'la violette DUEL qu’un joueur y attend un adversaire. Un appui t’y emmène. '
          + 'Le filtre À JOUER de MATCHS ne garde que ces matchs-là.'],
      ['Quelqu’un attend un duel : où le trouver ?',
        'Sur la page du duel, l’onglet EN ATTENTE montre les duels où quelqu’un attend '
          + 'un joueur. Un appui choisit le match, le format et la tribune qui manque : '
          + 'il ne reste qu’à entrer en file.'],
      ['Si je quitte la salle d’attente, mon duel disparaît-il ?',
        () => 'Non. Il reste ouvert et les autres le voient toujours ; le jeu te '
          + 'rappelle dès que quelqu’un arrive en face. S’il ne te voit pas revenir '
          + `dans les ${reglage('duel.attente_absent_min')} minutes, il se retire.`],
      ['Comment jouer un duel contre un ami ?',
        'Ouvre un duel, puis, dans la salle d’attente, invite ton ami depuis le jeu '
          + 'ou envoie-lui le lien : un appui l’amène directement dans ton duel. Tu '
          + 'peux aussi le défier aux tirs au but, dans les mini-jeux.'],
      ['C’est quoi, le duel guidé ?',
        'Trois minutes sur un match fictif, contre un adversaire patient, avec des '
          + 'bulles qui te montrent quoi faire. Il ne rapporte rien, ne compte nulle '
          + 'part, et se rejoue autant que tu veux depuis la page Comment jouer.'],
      ['Qui choisit le stade ?',
        () => 'Personne. Le stade appartient au match, pas à un joueur : il se '
          + 'déduit de la rencontre, les deux camps y ont exactement les mêmes '
          + 'règles, et la même rencontre rejouée donne le même lieu. On ne peut '
          + 'pas acheter un avantage de terrain.'],
      ['Je rate toujours le même geste. Je peux m’entraîner ?',
        () => 'Oui : La répétition, dans le menu. Les vingt gestes du jeu y sont à '
          + 'l’essai, autant de fois que tu veux. Rien n’y compte — ni ferveur, ni '
          + 'écharpes, ni classement — et rien ne t’y aide non plus : aucun Fanzzy, '
          + 'aucun équipement. C’est ta main, et le même moteur qui te note en duel.'],
      ['Que se passe-t-il quand un vrai but est marqué ?',
        () => 'La corde se secoue, et une fenêtre s’ouvre où tout compte double '
          + 'pendant une minute. Le souffle offert ne va qu’à ceux qui suivent le '
          + 'club buteur.'],
    ],
  },
  {
    titre: 'Les mini-jeux et le pronostic',
    questions: [
      ['Les mini-jeux rapportent-ils quelque chose ?',
        () => 'Des écharpes : jongles, tirs au but, chant en rythme et déplacement '
          + `en donnent jusqu’à ${reglage('jeux.echarpes_jour')} par jour en tout. `
          + 'Chacun a aussi son classement de la saison, entre tout le monde ou entre '
          + 'amis.'],
      ['Comment marche le tifo du club ?',
        () => 'Avec les supporters de ton club, vous peignez une mosaïque avant le '
          + `match : chacun a ${reglage('jeux.tifo_cases_jour')} cases par jour. Si elle `
          + `ressemble au modèle à ${reglage('jeux.tifo_seuil')} % au coup d’envoi, chaque `
          + `peintre reçoit ${reglage('jeux.tifo_gain')} écharpes, et le tifo se lève `
          + 'dans le stade au début du match.'],
      ['Et le boss de la semaine ?',
        () => 'Une tribune rivale à faire taire, pour tout ton club. Chaque chant '
          + 'réussi, au Virage, en duel ou au chant en rythme, lui retire de la voix. '
          + `S’il se tait avant la fin de la semaine, chacun de ceux qui l’ont fait `
          + `taire reçoit ${reglage('jeux.boss_gain')} écharpes.`],
      ['Le pronostic, c’est un pari ?',
        () => 'Non : il est gratuit, sans mise, et on n’y perd jamais rien. Donne le '
          + 'score d’un match de tes clubs jusqu’au coup d’envoi. Le bon vainqueur, ou '
          + `le bon nul, rapporte ${reglage('prono.vainqueur_echarpes')} écharpes, et le `
          + `score exact ${reglage('prono.exact_echarpes')}.`],
    ],
  },
  {
    titre: 'La saison et la collection',
    questions: [
      ['Combien dure une saison ?',
        'Trois mois. Chaque saison ouvre de nouvelles séries de Fanzzy et '
          + 'd’équipement, remet à zéro les classements, les divisions et le carnet, '
          + 'et ne te retire rien de ce que tu possèdes.'],
      ['Comment monter de division ?',
        'Avec ta ferveur de la saison, gagnée au Virage et en duel : Sympathisant, '
          + 'Habitué, Fervent, Ultra, puis Capo. Une division atteinte reste acquise '
          + 'jusqu’à la fin de la saison.'],
      ['Comment se classent les clubs ?',
        () => 'Comme un vrai championnat. Chaque duel classé et chaque Virage sont un '
          + 'match pour le club que tu pousses : 3 points pour une victoire, 1 pour un nul, '
          + '0 pour une défaite. Au Virage, c’est ta tribune qui gagne ou perd la corde, '
          + 'compté à la fin du vrai match. Si tu ne suis pas ce club, il ne reçoit qu’une '
          + `part de ces points (×${String(reglage('tribune.neutre_points')).replace('.', ',')}) : `
          + 'tu l’as soutenu, mais pas comme ton club. Les clubs sont rangés sur '
          + `les points par joueur qui a joué (au moins ${reglage('tribune.plancher')}), `
          + 'pour que les petits clubs aient leur chance. Le classement repart à chaque saison.'],
      ['C’est quoi, le carnet de la saison ?',
        () => 'Chaque mission du jour y pose des tampons : '
          + `${reglage('saison.tampons_facile')} pour une facile, `
          + `${reglage('saison.tampons_moyenne')} pour une moyenne, `
          + `${reglage('saison.tampons_difficile')} pour une difficile. Chaque palier `
          + 'du carnet rapporte des écharpes ou des boosters, et qui a bien rempli le '
          + 'sien reçoit des boosters au lancement de la saison suivante.'],
      ['Que me rapporte ma collection ?',
        () => `Tous les ${reglage('collection.cran')} objets différents gagnés, un `
          + `cran te rapporte ${reglage('collection.cran_echarpes')} écharpes, et de `
          + 'temps en temps un booster. Une série complète rapporte encore plus. Les '
          + 'tenues et les cartes Ultimate se collectionnent, mais ne comptent pas '
          + 'dans ces crans.'],
      ['Comment avoir une carte-souvenir ?',
        'Chaque vrai but crée une carte. Si tu poussais au Grand Virage à ce '
          + 'moment-là, tu la reçois à ton nom, avec ton Fanzzy de ce soir-là. Sinon, '
          + 'tu peux l’acheter quelque temps dans ton carnet.'],
    ],
  },
  {
    titre: 'Les amis',
    questions: [
      ['Comment ajouter un ami ?',
        'Page Amis, onglet TROUVER : le jeu te propose des supporters de tes clubs, '
          + 'et tu peux chercher n’importe qui par son pseudo, quel que soit son club. '
          + 'L’amitié commence quand il accepte ta demande.'],
      ['Que peut-on faire entre amis ?',
        'Touche JOUER ENSEMBLE sous le nom d’un ami : tu y vois sa collection, son '
          + 'deck et ses cartes-souvenirs, et tu peux lui faire signe, lui offrir un '
          + 'cadeau, relever le défi de la semaine avec lui, échanger un double ou '
          + 'emprunter un de ses Fanzzy.'],
      ['Pourquoi ne peut-on pas s’écrire ?',
        'Pour que personne ne reçoive un message blessant ou mal intentionné. On se '
          + 'fait signe avec un geste choisi dans une liste (« BRAVO ! », « UN DUEL ? », '
          + '« ON SE VOIT AU VIRAGE ? »…), que ton personnage joue pour toi.'],
      ['Le cadeau du jour me coûte-t-il des écharpes ?',
        () => `Non : c’est le jeu qui offre les ${reglage('amis.cadeau_echarpes')} `
          + `écharpes à ton ami, et tu en reçois ${reglage('amis.cadeau_merci')} en `
          + `remerciement. Un cadeau par ami et par jour, ${reglage('amis.cadeaux_jour')} `
          + 'amis par jour au plus.'],
      ['Pousser avec des amis, ça aide ?',
        () => `Oui : au Grand Virage, chaque ami dans ta tribune ajoute `
          + `${virgule(reglage('amis.cote_force'))} % à ta poussée, jusqu’à `
          + `${reglage('amis.cote_max')} amis. Seuls comptent ceux qui se montrent en `
          + 'ligne : un ami qui se cache ne trahit pas sa présence.'],
      ['C’est quoi, le défi de la semaine ?',
        () => `Réussissez ${reglage('amis.defi_cible')} chants au Virage à vous deux `
          + 'entre lundi et dimanche soir, chacun au moins un, et chacun récupère '
          + `${reglage('amis.defi_echarpes')} écharpes sur la fiche de l’autre. Jusqu’à `
          + `${reglage('amis.defis_semaine')} défis par semaine, avec des amis `
          + 'différents.'],
      ['Comment échanger des doubles ?',
        'Sur la fiche d’un ami, touche un Fanzzy qu’il a en double, puis choisis '
          + 'lequel de tes doubles tu lui donnes en retour. Rien ne bouge avant qu’il '
          + 'accepte, et chacun garde au moins un exemplaire de chaque Fanzzy.'],
      ['Si j’emprunte un Fanzzy, mon ami le perd-il ?',
        'Non. Tu le joues dans ton deck, à l’âge que ton ami lui a fait atteindre, '
          + 'jusqu’à minuit, et lui le garde. Un emprunt par jour, et seulement un '
          + 'Fanzzy que tu n’as pas.'],
      ['Quelle différence entre mes amis et mon KOP ?',
        () => 'Un ami est un lien entre deux personnes. Un KOP est un groupe qui '
          + 'pousse ensemble et qui apparaît comme tel dans les classements. On peut '
          + 'avoir des amis partout et n’être que d’un seul KOP.'],
    ],
  },
  {
    titre: 'Mon compte',
    questions: [
      ['À quoi sert mon niveau ?',
        () => 'À ouvrir des droits, jamais à taper plus fort : une place de deck de '
          + 'plus, un emplacement de club de plus. Le niveau ne donne aucune '
          + 'puissance — c’est une règle du jeu, écrite et tenue.'],
      ['Et le PASS de tribune, il donne un avantage ?',
        () => `Du confort, jamais de la puissance : une réserve de ${reglage('abo.pack_max')} `
          + `boosters au lieu de ${reglage('pack.max')}, qui se remplit toutes les `
          + `${reglage('abo.pack_regen_min')} minutes au lieu de ${reglage('pack.regen_min')}, `
          + `${reglage('abo.clubs_en_plus')} clubs suivis de plus, tout ton parcours et `
          + 'tous tes souvenirs, la création d’un KOP, et le droit de porter toute '
          + 'tenue publiée. Rien de tout cela ne pèse sur la corde.'],
      ['Que me manque-t-il sans le PASS ?',
        () => 'Rien pour jouer : toutes les cartes, tous les âges, tous les formats '
          + 'et le Grand Virage en entier. Ce qui est compté, c’est le classement'
          + (reglage('abo.duels_classes_jour') > 0 && reglage('abo.virages_classes_jour') > 0
            ? ` : ${reglage('abo.duels_classes_jour')} duels et `
              + `${reglage('abo.virages_classes_jour')} matchs de Virage par jour y `
              + 'comptent, et au-delà tu joues toujours, sans que ça compte.'
            : ' : certaines parties s’y jouent en entraînement, sans compter.')],
      ['Comment résilier le PASS ?',
        'Depuis la page du PASS, en deux touches, aussi simplement que tu t’es '
          + 'abonné. Il ne se renouvelle plus, tu le gardes jusqu’à la fin de la '
          + 'période déjà payée, et rien de ce que tu as gagné ne t’est repris.'],
      ['Puis-je changer de club ?',
        () => 'Un club choisi est gardé à vie : on ne le retire pas. Tu peux en suivre '
          + 'plusieurs : tu commences avec deux emplacements, et les suivants s’achètent '
          + 'en écharpes. Ton club principal est celui qui te rattache à une tribune pour '
          + 'les classements ; tu peux le changer pour un autre de tes clubs, une fois par '
          + 'saison, depuis MES CLUBS sur ton profil.'],
      ['Que se passe-t-il si je perds mes cartes ?',
        () => 'Rien de ce que tu possèdes ne disparaît. Une série qui se referme '
          + 'cesse d’être distribuée, elle ne se reprend pas : ta carte reste dans '
          + 'ton classeur, dans ton deck et sur ton accueil.'],
      ['Comment couper la musique ?',
        'En bas du menu, « Couper la musique ». Elle ne joue que sur les pages '
          + 'calmes, jamais pendant un duel, au Grand Virage ou dans les mini-jeux, '
          + 'pour que tu entendes la tribune. Le mode calme du menu coupe aussi les '
          + 'sons, les vibrations ou les animations.'],
      ['Puis-je suivre le score de mon club sur mon téléphone ?',
        'Oui. Dans ton compte, allume « Mon club joue » : une demi-heure avant le coup '
          + 'd’envoi, une notification t’annonce le match, puis elle change à chaque but, à '
          + 'la mi-temps et au coup de sifflet final. C’est toujours la même notification, qui '
          + 'se met à jour au lieu de s’empiler. Un match commencé avant la nuit se suit '
          + 'jusqu’au bout.'],
      ['J’ai trouvé un bug. À qui le dire ?',
        'Dans le menu, « Signaler un problème » : dis ce qui s’est passé, et le '
          + 'message part directement à l’équipe du jeu.'],
    ],
  },
];

/** Une réponse est une fonction quand elle cite un nombre, une chaîne sinon. */
const rendre = (v) => (typeof v === 'function' ? v() : v);

/** Un réglage décimal, écrit à la française : « 2,5 % » et non « 2.5 % ». */
const virgule = (n) => String(n).replace('.', ',');

/**
 * La FAQ, nombres à jour.
 *
 * Rendue à chaque appel et non mise en cache : les réglages qu'elle cite
 * changent depuis l'administration, et une aide mise en cache au démarrage
 * dirait le tarif d'avant jusqu'au prochain redémarrage.
 */
export function faq() {
  return RUBRIQUES.map((r) => ({
    titre: r.titre,
    questions: r.questions.map(([q, a]) => ({ q, r: rendre(a) })),
  }));
}

/** Le parcours, textes rendus. L'état de chaque étape vient du serveur. */
export function etapes() {
  return ETAPES.map((e) => ({
    cle: e.cle, titre: e.titre, visuel: e.visuel, ou: e.ou, bouton: e.bouton,
    repeter: e.repeter ?? null,
    quoi: rendre(e.quoi), pourquoi: rendre(e.pourquoi),
  }));
}

/** Combien de paquets rapporte le parcours entier. */
export const RECOMPENSE = 1;
