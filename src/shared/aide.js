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
      + 'carte d’action, une expression, une carte Ultimate ou des écharpes.',
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
      ['Où trouver les âges, les effets et les tenues de mon Fanzzy ?',
        () => 'Sur sa fiche, sous la carte. Les onglets ÂGES, ULTIMATE, EFFETS et '
          + 'LOOK montrent chacun leur rangée ; touche une image pour lire ce '
          + 'qu’elle fait juste dessous. LOOK réunit ses expressions et ses '
          + 'tenues. Les pastilles sous la carte crient son cri, disent son club '
          + 'et s’il est ton avatar ; « plus » ouvre toute son histoire.'],
      ['Comment voir mon Fanzzy en grand ?',
        () => 'Touche sa carte sur sa fiche. Il s’ouvre en plein écran, en entier '
          + 'devant son décor, avec la tenue et l’expression choisies. Touche '
          + 'l’écran ou la croix pour revenir. Pour retourner la carte, c’est la '
          + 'plaque ronde à côté d’elle.'],
      ['Pourquoi mon Fanzzy de l’accueil ne change-t-il pas de tête quand je le touche ?',
        () => 'Sur l’accueil, il ne montre que les expressions que tu as gagnées en '
          + 'booster : la joie, la colère, le dépit, la poussée. Touche-le trois fois '
          + 'de suite et il exulte, six fois et il proteste, s’il a l’expression. Sans '
          + 'elle, il garde son air de repos et fait seulement son petit saut. Il se '
          + 'tient toujours au même endroit, les pieds au sol au milieu de l’écran.'],
      ['Comment voir les autres âges de mon Fanzzy sur l’accueil ?',
        () => 'Glisse le doigt sur lui, vers la gauche pour l’âge d’après, vers la '
          + 'droite pour celui d’avant, ou touche les flèches sous son nom. Tu ne vois '
          + 'que les âges que tu as payés. Regarder ne change rien : c’est le bouton '
          + '« C’est lui, partout » qui le montre ainsi aux autres.'],
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
          + 'pièce d’équipement, un état ou une poignée d’écharpes — '
          + 'jamais un supporter de plus. Si tu as déjà tous les '
          + 'états ou toutes les cartes d’action que la carte pouvait te donner, '
          + `elle se change en ${POIGNEE_DE_REPLI} écharpes.`],
      ['Pourquoi les tenues ne sortent-elles plus des boosters ?',
        () => 'Chaque tenue (Préhistorique, Apocalyptique, Halloween…) est celle d’un PASS : '
          + 'elle se gagne en jouant, le long de la voie de son PASS, sur tous tes Fanzzy. '
          + 'Une fois sa saison finie, elle revient à l’étal, à acheter en écharpes. '
          + 'Les tenues que tu as déjà gagnées restent à toi.'],
      ['Comment voir une carte en grand après un booster ?',
        () => 'Touche-la sur l’écran de fin d’ouverture. Elle s’ouvre en grand, avec sa '
          + 'rareté, ce qu’elle change en jeu et si elle est nouvelle ou en double. Les '
          + 'flèches passent aux autres cartes du paquet, VOIR LA FICHE ouvre la fiche du '
          + 'Fanzzy et FERMER te ramène au paquet.'],
      ['C’est quoi le badge Fondateur et le Fanzzy TheBestFan ?',
        () => 'Le merci de TheBestFan à ses bêta-testeurs. Le badge Fondateur s’affiche à côté '
          + 'du pseudo (classement, amis, profil, affiche du duel) et le Fanzzy légendaire '
          + 'TheBestFan, orange, blanc et noir, rejoint la collection, dans sa série à lui. '
          + 'Ni l’un ni l’autre ne sort d’un booster : ils s’offrent, et ils ne font pas '
          + 'pousser plus fort qu’une autre légendaire.'],
      ['Que gagne-t-on en remplissant tout le carnet de la saison ?',
        () => 'Un Fanzzy légendaire de la série CARNET PLEIN, un par saison : le Gardien du Feu '
          + '(PASS 1), le Ferrailleur (PASS 2), le Capitaine Comète (PASS 3) et le Fantôme du '
          + 'Virage (PASS 4). Il va à tous ceux qui atteignent le dernier palier du carnet, avec '
          + 'ou sans PASS ; avec le PASS, tu le portes en plus dans la tenue de la saison. Il ne '
          + 'sort d’aucun booster et ne s’achète nulle part : une fois la saison finie, il ne se '
          + 'gagne plus.'],
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
      ['Pourquoi certaines cartes d’action ne partent pas ?',
        () => 'Certaines suivent le vrai match : Mi-temps, But au stade !, Carton rouge, '
          + 'Coup de sifflet, Temps additionnel, Prolongations. Elles ne se jouent qu’au '
          + 'moment qu’elles disent (la mi-temps, un vrai but de ton club, un rouge en face…). '
          + 'D’autres demandent d’être mené au score. Et les cartes d’un PASS arrivent pour '
          + 'tout le monde le jour où sa saison commence.'],
      ['C’est quoi, une pièce de club ?',
        () => 'Une pièce d’équipement aux couleurs d’un club, deux par club des séries de '
          + 'championnat (LES TERRACES, DIE KURVE, puis LE PARCAGE avec le PASS 2). Portée par un Fanzzy lié au même club, c’est le COMBO : son '
          + `revers perd ${reglage('stuff.club_revers')} %, dans tous les matchs. Et dans un `
          + `match de ton club principal, c’est PLEIN CLUB : chacune rapporte ${reglage('stuff.club_gain')} % `
          + 'd’écharpes en duel, ou de ferveur au Virage, en plus du lien du Fanzzy. '
          + 'La force, elle, ne change pas.'],
      ['Quelles séries de Fanzzy suivent un vrai championnat ?',
        () => 'LES TERRACES (le championnat anglais) et DIE KURVE (le championnat suisse). '
          + 'LE PARCAGE, la série du championnat de France, arrive avec le PASS 2 : trois '
          + 'Fanzzy par club, le cri de chaque club, deux pièces de club par équipe et six '
          + 'légendaires, trois liées aux équipes de France et trois au championnat.'],
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
          + ' Avec ou sans PASS, tous tes duels classés comptent, dans tous les formats, '
          + 'du 1v1 au 5v5, sans limite par jour.'],
      ['Peut-on voir tous les supporters d’un Virage ?',
        'Oui : dans l’arène, le bouton LES DEUX TRIBUNES montre les Fanzzy titulaires '
          + 'des douze supporters qui poussent le plus en ce moment dans chaque tribune, '
          + 'face à face, et le tien toujours. PARTAGER L’IMAGE en fait une image à envoyer.'],
      ['En duel à plusieurs, vois-je mes coéquipiers ?',
        'Oui : tous les Fanzzy de chaque camp sont dans l’arène, le tien devant, les '
          + 'autres au-dessus et en dessous de la corde, chacun avec son pseudo. En face, '
          + 'celui qui pousse le plus en ce moment passe devant.'],
      ['Comment savoir où l’on joue en ce moment ?',
        'Sur MATCHS et dans les compétitions, sous chaque match : la pastille verte '
          + 'VIRAGE dit que sa tribune est ouverte et combien de supporters y poussent, '
          + 'la violette DUEL qu’un joueur y attend un adversaire. Un appui t’y emmène. '
          + 'Le filtre À JOUER de MATCHS ne garde que ces matchs-là.'],
      ['Quelqu’un attend un duel : où le trouver ?',
        'Sur la page du duel, l’onglet EN ATTENTE DE JOUEURS montre les duels où quelqu’un '
          + 'attend un joueur ; tu peux les filtrer par format (1v1, 2v2…) et garder seulement '
          + 'tes équipes. Un appui choisit le match, le format et la tribune qui manque : '
          + 'il ne reste qu’à toucher REJOINDRE LE DUEL.'],
      ['Comment créer un duel ?',
        'Sur la page du duel, l’onglet MATCHS DU JOUR liste les matchs d’aujourd’hui (MES '
          + 'ÉQUIPES pour ne garder que les tiens, et une recherche par équipe, compétition '
          + 'ou pays). Touche un match, puis choisis ton équipe, ton format, et CRÉER LE DUEL. '
          + 'Si quelqu’un attend déjà en face sur ce match et ce format, le bouton devient '
          + 'REJOINDRE LE DUEL. Un jour sans match, la page montre le prochain jour de match, '
          + 'en entraînement.'],
      ['Si je quitte la salle d’attente, mon duel disparaît-il ?',
        () => 'Non. Il reste ouvert et les autres le voient toujours ; le jeu te '
          + 'rappelle dès que quelqu’un arrive en face. S’il ne te voit pas revenir '
          + `dans les ${reglage('duel.attente_absent_min')} minutes, il se retire.`],
      ['Personne n’arrive : puis-je jouer tout de suite contre des bots ?',
        'Oui : dans la salle d’attente, JOUER CONTRE DES BOTS lance aussitôt un '
          + 'entraînement, sans attendre la fin du compte à rebours. Des supporters '
          + 'd’appoint tiennent les autres places ; ce duel ne compte pas au classement. '
          + 'Ceux qui attendaient avec toi gardent leur place.'],
      ['Puis-je me promener dans le jeu en attendant mon duel ?',
        'Oui : ATTENDRE EN NAVIGUANT te ramène à l’accueil en gardant ta place, et le '
          + 'jeu te rappelle dès que quelqu’un arrive en face. Pendant ce temps, les '
          + 'supporters d’appoint n’entrent pas à ta place. QUITTER LA FILE, lui, rend ta place.'],
      ['Comment jouer un duel contre un ami ?',
        'Ouvre un duel, puis, dans la salle d’attente, invite ton ami depuis le jeu '
          + 'ou envoie-lui le lien : un appui l’amène directement dans ton duel. Tu '
          + 'peux aussi le défier aux tirs au but, dans les mini-jeux.'],
      ['Puis-je jouer seul avec mon ami, sans qu’un autre joueur entre ?',
        () => 'Oui : coche DUEL PRIVÉ dans la case du match avant CRÉER LE DUEL, ou touche RENDRE PRIVÉ '
          + 'dans la salle d’attente. Ton duel n’apparaît alors dans aucune liste : '
          + 'seuls ceux à qui tu envoies le lien ou une invitation peuvent entrer, '
          + 'dans la tribune qui a de la place, même s’ils suivent ton club. Les '
          + 'supporters d’appoint n’y entrent pas d’eux-mêmes, et le duel compte au '
          + `classement comme les autres. Sans adversaire au bout de ${reglage('duel.attente_absent_min')} `
          + 'minutes, il se ferme. Les autres joueurs peuvent toujours jouer le même '
          + 'match, dans la file publique ou dans leur propre duel privé.'],
      ['C’est quoi, le duel guidé ?',
        'Trois minutes sur un match fictif, contre un adversaire patient, avec des '
          + 'bulles qui te montrent quoi faire. Il ne rapporte rien, ne compte nulle '
          + 'part, et se rejoue autant que tu veux depuis la page Comment jouer.'],
      ['Qui choisit le stade ?',
        () => 'Personne. Le stade appartient au match, pas à un joueur : il se '
          + 'déduit de la rencontre, les deux camps y ont exactement les mêmes '
          + 'règles, et la même rencontre rejouée donne le même lieu. On ne peut '
          + 'pas acheter un avantage de terrain.'],
      ['Combien y a-t-il de gestes ?',
        'Trente, cinq par famille de Fanzzy. La Voix chante (tempo, contretemps, '
          + 'écho, capo, justesse), la Percussion frappe (martelage, crescendo, salves, '
          + 'deux voix, accents), la Fidélité tient (endurance, sang-froid, mesure, '
          + 'jauge, sans craquer), le Tifo se montre (tifo, mosaïque, tri, ola, puzzle), '
          + 'la Pyro vise l’instant (relance, compte, visée, rouleaux, mèche) et le '
          + 'Déplacement fait la route (écharpe, visages, bascule, écho inversé, cortège).'],
      ['Je rate toujours le même geste. Je peux m’entraîner ?',
        () => 'Oui : La répétition, dans le menu. Les trente gestes du jeu y sont à '
          + 'l’essai, autant de fois que tu veux. Rien n’y compte — ni ferveur, ni '
          + 'écharpes, ni classement — et rien ne t’y aide non plus : aucun Fanzzy, '
          + 'aucun équipement. C’est ta main, et le même moteur qui te note en duel.'],
      ['Je joue sur ordinateur : comment faire les gestes à la souris ?',
        'Un clic vaut un toucher. Pour les gestes où l’on garde le doigt posé — la '
          + 'justesse, la mèche, la jauge —, il suffit de suivre avec la souris, sans '
          + 'cliquer ; garder le clic enfoncé marche aussi. Au chant des mini-jeux, les '
          + 'touches J, K et L (ou les flèches) frappent les trois tambours.'],
      ['Pourquoi y a-t-il de la musique pendant certains gestes ?',
        'Les gestes à notes (les deux voix, les accents, la justesse) et le chant des '
          + 'mini-jeux ont leur musique, composée par le jeu sur la partition du geste : '
          + 'ses temps tombent sur les notes. Pendant le geste, des mots te disent aussi '
          + 'comment tu t’en sors (PARFAIT, BIEN, TÔT, TARD, RATÉ), et une note ratée '
          + 'continue sa route. Le son se coupe dans le menu, comme les autres.'],
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
      ['Comment devenir le meilleur supporter ?',
        () => 'Au classement, ta ferveur se compte au Virage et en duel classé. '
          + (reglage('ferveur.duels_jour')
            ? `Chaque jour, seuls tes ${reglage('ferveur.duels_jour')} meilleurs duels classés comptent : `
              + 'jouer plus ne suffit pas, il faut bien jouer. ' : '')
          + 'Sous SUPPORTERS et DUELS, MON CLUB et MON PAYS te comparent aux '
          + 'supporters de ton club principal, ou des clubs de son pays.'],
      ['Comment se classent les clubs ?',
        () => 'Comme un vrai championnat. Chaque duel classé et chaque Virage sont un '
          + 'match pour le club que tu pousses : 3 points pour une victoire, 1 pour un nul, '
          + '0 pour une défaite. Au Virage, c’est ta tribune qui gagne ou perd la corde, '
          + 'compté à la fin du vrai match. Si tu ne suis pas ce club, il ne reçoit qu’une '
          + `part de ces points (×${String(reglage('tribune.neutre_points')).replace('.', ',')}) : `
          + 'tu l’as soutenu, mais pas comme ton club. '
          + (reglage('tribune.duels_jour') ? `Tes ${reglage('tribune.duels_jour')} premiers duels classés du jour comptent pour les clubs. ` : '')
          + 'Les clubs sont rangés sur '
          + `les points par joueur qui a joué pour eux (au moins ${reglage('tribune.plancher')}), `
          + 'pour que les petits clubs aient leur chance. Le classement repart à chaque saison.'],
      ['C’est quoi, le carnet de la saison ?',
        () => 'Chaque mission du jour y pose des tampons : '
          + `${reglage('saison.tampons_facile')} pour une facile, `
          + `${reglage('saison.tampons_moyenne')} pour une moyenne, `
          + `${reglage('saison.tampons_difficile')} pour une difficile. Chaque palier `
          + 'du carnet rapporte des écharpes ou des boosters, et qui a bien rempli le '
          + 'sien reçoit des boosters au lancement de la saison suivante.'],
      ['C’est quoi, les défis de la semaine ?',
        () => 'Chaque lundi, trois défis tirés parmi ce que tu possèdes : jouer des duels '
          + 'avec un Fanzzy d’une de tes séries, chanter au Grand Virage en portant une de '
          + 'tes pièces, jouer des duels avec un Fanzzy dans une de tes tenues. Chacun '
          + `rapporte ${reglage('defis.echarpes')} écharpes et ${reglage('defis.tampons')} tampons `
          + 'du carnet. Un duel compte s’il a duré au moins une minute et que tu ne l’as pas '
          + 'quitté ; une pièce compte si ton Fanzzy du Virage la porte dans ton deck. Un défi '
          + 'fini se récupère jusqu’à la fin de la semaine suivante.'],
      ['Et le défi du PASS ?',
        'Les membres d’un PASS ont un quatrième défi : jouer des duels dans la tenue de '
          + 'leur PASS. Il fait avancer la voie PASS (la tenue à ses âges, les cadres, le '
          + 'titre, le badge…), et rien d’autre : ni écharpes, ni tampons du carnet.'],
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
      ['Que veut dire « 12 EN LIGNE » sur l’accueil ?',
        'C’est le nombre de supporters qui jouent en ce moment, toi compris (actifs '
          + 'dans les cinq dernières minutes). Ce n’est qu’un nombre : personne ne voit '
          + 'qui est en ligne, sauf tes amis si tu ne te caches pas. Seul, la pastille '
          + 'ne s’affiche pas.'],
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
      ['C’est quoi, le PASS de saison ?',
        () => `Un achat unique, 7,99 € ou ${reglage('pass.prix_echarpes')} écharpes, `
          + 'valable jusqu’à la fin de la saison. Il ne se renouvelle jamais tout seul. '
          + `Pris pendant les ${reglage('pass.dernier_mois_jours')} derniers jours d’une saison, `
          + 'il couvre aussi la suivante. Chaque PASS a sa tenue, son badge et son cadre de carte.'],
      ['Quand puis-je prendre le PASS ?',
        'Dès l’ouverture de sa saison. Pendant la BASE, le PASS 1 est marqué « Bientôt » : '
          + 'il ne s’achète qu’à partir du 1er décembre. D’ici là, tout le jeu reste ouvert, sans payer.'],
      ['Et le PASS, il donne un avantage ?',
        () => 'Du confort et du style, jamais de la puissance : une '
          + `réserve de ${reglage('abo.pack_max')} boosters au lieu de ${reglage('pack.max')}, `
          + `qui se remplit toutes les ${reglage('abo.pack_regen_min')} minutes au lieu de `
          + `${reglage('pack.regen_min')}, tout ton parcours et tous tes souvenirs pendant la `
          + 'saison achetée. Pour toujours : la tenue de la saison, le badge, le cadre, '
          + `${reglage('pass.clubs_par_pass')} club suivi de plus et ${reglage('pass.kops_par_pass')} `
          + 'KOP de plus à créer par PASS. Rien de tout cela ne pèse sur la corde.'],
      ['C’est quoi, la voie PASS ?',
        () => 'Une deuxième ligne dans ton carnet de tampons, en or, avec douze niveaux. '
          + 'Tes tampons la font monter : la tenue de la saison à ses trois âges, un cadre de '
          + 'profil, des stickers de duel, un fond de profil animé, un cadre de carte puis '
          + 'animé, une entrée au duel, un titre sous ton pseudo, une aura au Virage, et au '
          + 'bout le badge et le pseudo en or ; ensuite, une étoile tous les 15 tampons. Sans '
          + 'PASS, tu la vois sous cadenas : ce que tes tampons ont déjà atteint est à toi dès '
          + 'l’achat. Que du visuel, jamais d’écharpes ni de boosters.'],
      ['Qui voit ce que ma voie PASS a ouvert ?',
        'Les autres joueurs. Sur l’affiche d’un duel, ton adversaire voit ton écusson, ton titre, '
          + 'ton pseudo en or, le cadre de pierre autour de ton Fanzzy et son entrée dans les rochers. '
          + 'Pendant la partie, tu peux lui lancer tes stickers. Tes amis les voient aussi sur ta fiche, '
          + 'avec ton fond de grotte, et tout le monde sur le podium du classement. Au Virage, ton '
          + 'Fanzzy porte son aura de braises. Que du visuel : rien ne pèse sur la corde.'],
      ['Puis-je voir le PASS sur mon Fanzzy avant de l’acheter ?',
        'Oui : touche ESSAYER 10 s sur la page du PASS. Ton Fanzzy porte la tenue de la saison à '
          + 'ses trois âges, dans la grotte, avec le cadre de pierre, le titre et le pseudo en or. '
          + 'Chaque niveau de ta voie PASS gagné ensuite a sa petite fête à ton retour.'],
      ['Que me manque-t-il sans le PASS ?',
        () => 'Rien pour jouer ni pour le classement : toutes les séries, tous les âges, '
          + 'tous les formats, le Grand Virage en entier, et tout compte, sans limite. '
          + 'Les Fanzzy ne sont jamais réservés au PASS. Sa tenue revient à l’étal une '
          + 'saison plus tard, à acheter en écharpes ; le badge, le cadre et l’Ultimate de '
          + 'la tenue restent au PASS.'],
      ['Puis-je payer le PASS en écharpes ?',
        () => `Oui, ${reglage('pass.prix_echarpes')} écharpes, sur la page du PASS. C’est la `
          + 'récompense des supporters assidus : le même PASS, sans dépenser d’argent.'],
      ['Puis-je prendre un PASS d’une saison passée ?',
        'Oui, en PACK. Un PASS fini revient sur la page du PASS le 1er du mois qui suit sa '
          + 'fin, au même prix, sous le nom de sa tenue : le PACK Préhistorique pour le PASS 1, '
          + 'puis les PACKS Apocalyptique, Spatiale et Halloween. Tu reçois sa tenue au premier '
          + 'âge, puis ses autres âges dans tes boosters, avec son équipement, son stade et ses '
          + 'mini-jeux. Le tampon « ÉDITION ORIGINALE », le cadre, le badge, le club et le KOP '
          + 'en plus restent à ceux qui l’ont joué pendant la saison.'],
      ['J’ai déjà le PASS : puis-je prendre son PACK ?',
        'Non, et tu n’en as pas besoin : la tenue de ton PASS vaut pour tous tes Fanzzy, même '
          + 'ceux des séries qui arrivent après, aux âges que ta voie a ouverts. Les âges qui te '
          + 'manquent tombent dans tes boosters. Un PASS ne s’achète qu’une fois, PACK compris.'],
      ['Je n’ai pas fini ma voie PASS avant la fin de la saison : je perds tout ?',
        'Non. Ce que tu as ouvert reste à toi, et les âges de la tenue qui te manquent tombent '
          + 'ensuite dans tes boosters. Les autres cadeaux de la voie (cadres, stickers, fond, '
          + 'entrée, titre, aura, badge en or) ne s’ouvrent plus.'],
      ['J’avais un abonnement : que devient-il ?',
        'Il ne se renouvelle plus. Tu gardes tout jusqu’à la fin de la période déjà payée, '
          + 'et tu reçois le PASS de la saison où elle se termine. Rien de ce que tu as '
          + 'gagné ne t’est repris.'],
      ['Puis-je changer de club ?',
        () => 'Un club choisi est gardé à vie : on ne le retire pas. Tu peux en suivre '
          + 'plusieurs : tu commences avec deux emplacements, et les suivants s’achètent '
          + 'en écharpes. Ton club principal est celui qui te rattache à une tribune pour '
          + 'les classements ; tu peux le changer pour un autre de tes clubs, une fois par '
          + 'saison, depuis MES CLUBS sur ton profil.'],
      ['Que montre la page CLUBS ?',
        'Pour chaque club que tu suis : ses matchs en direct (pastille EN DIRECT, '
          + 'minute et score), les prochains et les derniers résultats. Touche le nom '
          + 'du club pour ouvrir la page de son championnat, et un match pour ouvrir sa '
          + 'fiche. Dessous, tes Fanzzy liés à ce club : ceux de sa série, les légendaires '
          + 'de son championnat ou de sa sélection, et ceux que tu y as liés toi-même '
          + '(cerclés d’or), avec ce qu’il te reste à trouver. Avant de suivre un nouveau '
          + 'club, la page te demande de confirmer, puisqu’il est gardé à vie.'],
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
      ['Comment inviter un ami à jouer ?',
        'Dans le menu, « Partager le jeu » : choisis WhatsApp, un SMS ou un mail, et '
          + 'ton ami reçoit le lien du jeu avec son image. Sans partage sur ton appareil, '
          + 'le lien est copié : colle-le dans ton message.'],
      ['Y a-t-il une appli Android ?',
        'Elle arrive sur le Play Store. Avant de l’ouvrir à tous, Google demande qu’au moins '
          + 'douze joueurs la testent pendant quatorze jours : sur ton téléphone Android, ouvre '
          + 'thebestfan.online/beta et suis les trois gestes. Ton compte reste le même dans '
          + 'l’appli.'],
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
