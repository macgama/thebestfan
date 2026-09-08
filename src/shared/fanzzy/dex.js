/**
 * Catalogue Fanzzy — source unique.
 *
 * Le serveur s'en sert pour tirer les boosters et valider les évolutions ; le
 * client le reçoit via /api/fanzzy/dex pour l'affichage. Une seule définition,
 * donc aucun risque que les deux divergent.
 */
import { SETS_2026, DEX_2026 } from './dex-2026.js';

const TYPES = {
  voix: { nom:'Voix', c:'#F5C33B', geste:'tempo',
    ico:'M4 9v6h4l5 4V5L8 9H4zm12.5-1a5 5 0 0 1 0 8' },
  perc: { nom:'Percussion', c:'#3C82E8', geste:'martelage',
    ico:'M12 6c5 0 8 1.5 8 3.5S17 13 12 13 4 11.5 4 9.5 7 6 12 6zm-8 4v5c0 2 3.5 3.5 8 3.5s8-1.5 8-3.5v-5' },
  fide: { nom:'Fidélité', c:'#C2CAD6', geste:'endurance',
    ico:'M12 21s-7-4.4-7-9.5A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 3.5C19 16.6 12 21 12 21z' },
  tifo: { nom:'Tifo', c:'#8257DA', geste:'contre',
    ico:'M4 4h16v12l-8-3-8 3V4z' },
  pyro: { nom:'Pyro', c:'#E0402C', geste:'risque',
    ico:'M12 2c1 4-3 5-3 9a3 3 0 0 0 6 0c0-2-1-3-1-4 2 1 4 3 4 6a6 6 0 0 1-12 0c0-5 6-7 6-11z' },
  depl: { nom:'Déplacement', c:'#1E9E6A', geste:'souffle',
    ico:'M4 7h16v8H4zM4 15v3h3v-3m10 0v3h3v-3M6 10h12' },
};

const RAR = { d1:1, d2:2, d3:3, star:4, crown:5 };
const SCARVES = { d1:1, d2:3, d3:8, star:25, crown:60 };
/**
 * Coût d'évolution. Calibré sur la simulation : compléter la collection
 * rapporte environ 1 150 écharpes, faire évoluer les six lignées en coûte 690.
 * Il reste de quoi choisir, pas de quoi tout avoir sans y penser.
 */
const EVO_COST = { 2:25, 3:90 };

/**
 * Les séries.
 *
 * Les deux premières sont peuplées de supporters ordinaires — l'abonné, la
 * vieille garde, le colleur d'affiches. La troisième existe parce que le
 * catalogue s'est mis à accueillir un fantôme, un vampire, une pieuvre et un
 * extraterrestre : les mêler aux deux autres aurait dilué ce qu'elles
 * racontent. Séparées, chacune garde son registre, et le joueur sait ce qu'il
 * ouvre.
 */
const SETS = [
  { id:'VN', nom:'VIRAGE NORD', ligne:'béton, pluie, hiver', c1:'#E0402C', c2:'#1A1F27' },
  { id:'NE', nom:'NUITS EUROPÉENNES', ligne:'jeudi soir, 900 km', c1:'#3C82E8', c2:'#151A22' },
  { id:'IM', nom:'LE VIRAGE IMPOSSIBLE', ligne:'ceux qui ne devraient pas être là',
    c1:'#8257DA', c2:'#12101C' },
];

/** Taux de tirage. Les trois premières cartes sont communes, comme dans Pocket. */

const DEX = [
  // --- VOIX
  { id:'V1', nom:'Choriste', type:'voix', set:'VN', stage:1, rar:'d1', evo:'V2',
    mods:{ tempoWindow:1.2 }, cri:{ label:'REPRISE', gest:'tempo', power:52 } },
  { id:'V2', nom:'Meneur de chant', type:'voix', set:'VN', stage:2, rar:'d2', evo:'V3',
    mods:{ tempoWindow:1.45, tempoInterval:40 }, cri:{ label:'MUR DU SON', gest:'tempo', power:64 } },
  { id:'V3', nom:'Capo di Curva', type:'voix', set:'VN', stage:3, rar:'star',
    mods:{ tempoWindow:1.7, tempoInterval:80 }, cri:{ label:'TOUT LE VIRAGE', gest:'tempo', power:78 } },
  // --- PERCUSSION
  { id:'P1', nom:'Gamin au tambour', type:'perc', set:'VN', stage:1, rar:'d1', evo:'P2',
    mods:{ mashBonus:1.06 }, cri:{ label:'ROULEMENT', gest:'mash', power:52 } },
  { id:'P2', nom:'Tambour Major', type:'perc', set:'VN', stage:2, rar:'d2', evo:'P3',
    mods:{ mashBonus:1.1, mashTime:-500 }, cri:{ label:'CADENCE', gest:'mash', power:66 } },
  { id:'P3', nom:'Grosse Caisse Sud', type:'perc', set:'VN', stage:3, rar:'d3',
    mods:{ mashBonus:1.16, mashTime:-800 }, cri:{ label:'TEMPO INFERNAL', gest:'mash', power:76 } },
  // --- FIDÉLITÉ
  { id:'F1', nom:'Abonné', type:'fide', set:'VN', stage:1, rar:'d1', evo:'F2',
    mods:{ holdBonus:1.07 }, cri:{ label:'PRÉSENTS', gest:'hold', power:50 } },
  { id:'F2', nom:'Vieille Garde', type:'fide', set:'VN', stage:2, rar:'d2', evo:'F3',
    mods:{ holdBonus:1.12, holdForgive:1 }, cri:{ label:'ON ÉTAIT LÀ', gest:'hold', power:64 } },
  { id:'F3', nom:'Doyen du Bloc C', type:'fide', set:'VN', stage:3, rar:'crown',
    mods:{ holdBonus:1.2, holdForgive:2, breathBonus:1.08 }, cri:{ label:'CINQUANTE ANS', gest:'hold', power:80 } },
  // --- TIFO
  { id:'T1', nom:'Colleur d\u2019affiches', type:'tifo', set:'NE', stage:1, rar:'d1', evo:'T2',
    mods:{ parryBonus:1.2 }, cri:{ label:'CONSIGNES', gest:'tempo', power:48 } },
  { id:'T2', nom:'Bâcheur Nocturne', type:'tifo', set:'NE', stage:2, rar:'d2', evo:'T3',
    mods:{ parryBonus:1.5 }, cri:{ label:'BÂCHE SURPRISE', gest:'hold', power:62 } },
  { id:'T3', nom:'Chef Tifo', type:'tifo', set:'NE', stage:3, rar:'star',
    mods:{ parryBonus:1.9, holdBonus:1.06 }, cri:{ label:'MOSAÏQUE GÉANTE', gest:'hold', power:74 } },
  // --- PYRO
  { id:'Y1', nom:'Porte-torche', type:'pyro', set:'NE', stage:1, rar:'d1', evo:'Y2',
    mods:{ perfectBonus:1.2 }, cri:{ label:'TORCHE', gest:'mash', power:54 } },
  { id:'Y2', nom:'Fumigène', type:'pyro', set:'NE', stage:2, rar:'d2', evo:'Y3',
    mods:{ perfectBonus:1.35, backfire:true }, cri:{ label:'NAPPE DE FUMÉE', gest:'mash', power:70 } },
  { id:'Y3', nom:'Craqueur', type:'pyro', set:'NE', stage:3, rar:'d3',
    mods:{ perfectBonus:1.5, backfire:true }, cri:{ label:'EMBRASEMENT', gest:'mash', power:86 } },
  // --- DÉPLACEMENT
  { id:'D1', nom:'Auto-stoppeur', type:'depl', set:'NE', stage:1, rar:'d1', evo:'D2',
    mods:{ breathBonus:1.08 }, cri:{ label:'PREMIER PÉAGE', gest:'tempo', power:50 } },
  { id:'D2', nom:'Conducteur de car', type:'depl', set:'NE', stage:2, rar:'d2', evo:'D3',
    mods:{ breathBonus:1.16, refundBonus:1.4 }, cri:{ label:'KLAXONS', gest:'mash', power:64 } },
  { id:'D3', nom:'Convoi 4h du Mat', type:'depl', set:'NE', stage:3, rar:'d3',
    mods:{ breathBonus:1.24, refundBonus:1.8 }, cri:{ label:'ON EST VENUS POUR ÇA', gest:'hold', power:76 } },
  // --- sans évolution
  { id:'X1', nom:'Le Douzième Homme', type:'voix', set:'VN', stage:1, rar:'d3',
    mods:{ tempoWindow:1.3, breathBonus:1.1 }, cri:{ label:'OLA', gest:'tempo', power:68 } },
  { id:'X2', nom:'Écharpes au Vent', type:'fide', set:'VN', stage:1, rar:'d2',
    mods:{ holdBonus:1.1 }, cri:{ label:'LEVER LES BRAS', gest:'hold', power:56 } },
  { id:'X3', nom:'Mosaïque Populaire', type:'tifo', set:'NE', stage:1, rar:'d2',
    mods:{ parryBonus:1.3 }, cri:{ label:'DÉPLOIEMENT', gest:'tempo', power:56 } },
  { id:'X4', nom:'Parcage 400 places', type:'depl', set:'NE', stage:1, rar:'star',
    mods:{ breathBonus:1.14, parryBonus:1.4 }, cri:{ label:'ÉCHO DU PARCAGE', gest:'mash', power:72 } },
  { id:'X5', nom:'La Nuit du 8e', type:'pyro', set:'NE', stage:1, rar:'crown',
    mods:{ perfectBonus:1.45, tempoWindow:1.2, mashBonus:1.08 }, cri:{ label:'PROLONGATIONS', gest:'mash', power:90 } },
  /**
   * LE GAMIN DE DEVANT — le premier Fanzzy à avoir une vraie histoire.
   *
   * Onze ans, premier rang, mains crispées sur la barrière, à hurler contre
   * des types trois fois plus grands que lui. Il ne connaît pas encore tous
   * les chants, mais il ne s'arrête jamais.
   *
   * Ses modificateurs racontent exactement ça : sa colère rend ses gestes
   * parfaits plus percutants que ceux de n'importe qui, mais il n'a pas le
   * coffre pour tenir la distance. C'est un Fanzzy de coups d'éclat, pas de
   * régularité — et sa lignée le fait grandir avec la tribune.
   */
  { id:'G1', nom:'Le Gamin de Devant', type:'voix', set:'VN', stage:1, rar:'d2', evo:'G2',
    histoire:'Onze ans, premier rang, mains sur la barrière. Il ne connaît pas encore '
      + 'tous les chants, mais il ne s\u2019arrête jamais.',
    mods:{ perfectBonus:1.35, breathBonus:0.85, tempoWindow:1.1 },
    cri:{ label:'CRIS DE GOSSE', gest:'tempo', power:58 } },

  { id:'G2', nom:'Le Gamin du Virage', type:'voix', set:'VN', stage:2, rar:'d3', evo:'G3',
    histoire:'Il a grandi de dix centimètres et appris tous les chants. On lui laisse '
      + 'le mégaphone quand le capo s\u2019enroue.',
    mods:{ perfectBonus:1.45, breathBonus:0.92, tempoWindow:1.3 },
    cri:{ label:'TOUTE LA JOURNÉE', gest:'tempo', power:70 } },

  { id:'G3', nom:'Le Gosse est Capo', type:'voix', set:'VN', stage:3, rar:'star',
    histoire:'Vingt ans plus tard, il est dos au terrain, face à sa tribune. '
      + 'Il n\u2019a jamais raté un match depuis.',
    mods:{ perfectBonus:1.5, tempoWindow:1.6, tempoInterval:60 },
    cri:{ label:'CELUI QUI N\u2019A JAMAIS LÂCHÉ', gest:'tempo', power:84 } },

  { id:'X6', nom:'Section Cendrée', type:'fide', set:'VN', stage:1, rar:'d1',
    mods:{ holdBonus:1.05, breathBonus:1.04 }, cri:{ label:'FIDÈLES', gest:'hold', power:48 } },

  /**
   * LE TRIEUR DE DOUBLES — celui qui n'a jamais jeté une carte.
   *
   * Il connaît par cœur ce qui lui manque, et il attend depuis deux ans. Ses
   * modificateurs disent la même chose que son histoire : il tient dans la
   * durée et il récupère ce que les autres gaspillent, mais il ne fait
   * jamais de coup d'éclat.
   */
  { id:'X7', nom:'Le Trieur de Doubles', type:'fide', set:'VN', stage:1, rar:'d2',
    histoire:'Il connaît par cœur les trois qui lui manquent. Il les cherche depuis '
      + 'deux ans, et il n\u2019a jamais jeté une carte de sa vie.',
    mods:{ holdBonus:1.12, refundBonus:1.35 },
    cri:{ label:'ON A TOUT GARDÉ', gest:'hold', power:58 } },

  /**
   * LA MASCOTTE DU DIMANCHE — sept ans, un costume trop grand, et le seul
   * rôle qu'on lui laisse au bord du terrain. Elle le prend très au sérieux.
   *
   * Elle absorbe et détourne plutôt qu'elle ne pousse : une peluche ne crie
   * pas fort, mais personne ne sait par où elle va passer.
   */
  { id:'X8', nom:'La Mascotte du Dimanche', type:'tifo', set:'VN', stage:1, rar:'d2',
    histoire:'Sept ans, un costume deux tailles trop grand, et le seul rôle qu\u2019on '
      + 'lui laisse au bord du terrain. Elle le prend très au sérieux.',
    mods:{ parryBonus:1.4, holdBonus:1.05 },
    cri:{ label:'LA PELUCHE DÉBOULE', gest:'tempo', power:56 } },

  /* ------------------------------------------- les gens du stade

     Sept figures qu'on croise sans jamais les voir jouer : celui qui nourrit
     la file d'attente, celle qui tient le bar, celui qui souffle faux depuis
     trente ans. Ils ne sont pas dans le virage, ils sont *autour* — et un
     stade sans eux n'est qu'un terrain avec des gradins.

     Leurs modificateurs racontent leur métier, pas leur puissance : le
     marchand rend du souffle, la patronne tient la distance, la voyante voit
     la mesure arriver. */

  { id:'X9', nom:'Le Marchand de Saucisses', type:'fide', set:'VN', stage:1, rar:'d1',
    histoire:'Il n’a jamais vu un but de sa vie. Il les entend, et il sait au bruit '
      + 'si c’était pour nous.',
    mods:{ breathBonus:1.18, holdBonus:1.04 },
    cri:{ label:'UNE POUR LA ROUTE', gest:'hold', power:50 } },

  { id:'X10', nom:'La Patronne du Bar', type:'fide', set:'VN', stage:1, rar:'d2',
    histoire:'Elle a vu passer quatre entraîneurs, deux relégations et un titre. '
      + 'Elle essuie le même comptoir depuis les trois.',
    mods:{ holdBonus:1.16, holdForgive:1 },
    cri:{ label:'DERNIÈRE TOURNÉE', gest:'hold', power:58 } },

  { id:'X11', nom:'La Trompette du Dimanche', type:'perc', set:'VN', stage:1, rar:'d1',
    histoire:'Trois notes, toujours les mêmes, depuis trente ans. Ses voisins ont '
      + 'renoncé à lui demander d’arrêter.',
    // Il donne la cadence mais épuise son entourage : le seul Fanzzy dont le
    // revers tombe sur les autres autant que sur lui.
    mods:{ mashBonus:1.14, mashTime:-300, breathBonus:0.92 },
    cri:{ label:'LA MÊME DEPUIS TRENTE ANS', gest:'mash', power:54 } },

  { id:'X12', nom:'La Voyante du Virage', type:'voix', set:'NE', stage:1, rar:'d3',
    histoire:'Elle annonce le score à la mi-temps, se trompe une fois sur deux, et '
      + 'personne ne se souvient jamais des fois où elle s’est trompée.',
    // Voir la mesure arriver : sa fenêtre de tempo est la plus large du jeu.
    mods:{ tempoWindow:1.55, perfectBonus:1.12 },
    cri:{ label:'JE L’AVAIS VU VENIR', gest:'tempo', power:66 } },

  { id:'X13', nom:'L’Agent en Tribune d’Honneur', type:'depl', set:'NE', stage:1, rar:'d2',
    histoire:'Il connaît quelqu’un. Il connaît toujours quelqu’un. Il a une paire de '
      + 'crampons dans la main et personne ne sait à qui elle appartient.',
    mods:{ refundBonus:1.65, breathBonus:1.06 },
    cri:{ label:'J’AI QUELQU’UN POUR ÇA', gest:'hold', power:60 } },

  { id:'X14', nom:'Le Siffleur des Souterrains', type:'tifo', set:'NE', stage:1, rar:'d3',
    histoire:'On raconte qu’il vit sous la tribune sud depuis la rénovation de 1974. '
      + 'Personne ne l’a vu. Tout le monde a entendu son sifflet.',
    // Il détourne au lieu de pousser, et il n'a pas de coffre : une créature
    // d'embuscade, pas de force.
    mods:{ parryBonus:1.75, breathBonus:0.9 },
    cri:{ label:'COUP DE SIFFLET DANS LE NOIR', gest:'tempo', power:64 } },

  { id:'X15', nom:'Le Loup du Virage', type:'pyro', set:'NE', stage:1, rar:'star',
    histoire:'Un soir de pleine lune, quelqu’un a hurlé plus fort que toute la '
      + 'tribune. On ne l’a plus jamais vu arriver avant le coup d’envoi.',
    mods:{ perfectBonus:1.42, backfire:true, mashBonus:1.1 },
    cri:{ label:'PLEINE LUNE', gest:'mash', power:82 } },

  /* ================================================ VIRAGE NORD, la suite

     Des gens du stade, encore : ceux qu'on croise au tourniquet, dans la file,
     au rang de derrière. Aucun n'est spectaculaire, et c'est le propos. */

  { id:'X17', nom:'Le Gosse à la Coupe', type:'voix', set:'VN', stage:1, rar:'d1',
    histoire:'Il a gagné la coupe des poussins il y a trois semaines. Il l’apporte '
      + 'à chaque match, au cas où quelqu’un n’aurait pas vu.',
    mods:{ tempoWindow:1.15, perfectBonus:1.1 },
    cri:{ label:'ON A GAGNÉ AUSSI', gest:'tempo', power:48 } },

  { id:'X20', nom:'Premier Match', type:'fide', set:'VN', stage:1, rar:'d1',
    histoire:'Il ne connaît pas les chants, il ne sait pas quand se lever, et il '
      + 'regarde son voisin pour savoir quoi faire. Il reviendra.',
    mods:{ holdBonus:1.06, breathBonus:1.06 },
    cri:{ label:'COMME LES AUTRES', gest:'hold', power:46 } },

  { id:'X26', nom:'Le Tambour de Guerre', type:'perc', set:'VN', stage:1, rar:'d3',
    histoire:'Torse nu par moins deux, deux maillets, et une peinture qu’il refait '
      + 'à l’identique depuis onze ans.',
    mods:{ mashBonus:1.2, mashTime:-600, breathBonus:0.95 },
    cri:{ label:'ROULEMENT DE GUERRE', gest:'mash', power:74 } },

  { id:'X27', nom:'Le Mime du Virage', type:'tifo', set:'VN', stage:1, rar:'d2',
    histoire:'Il hurle sans un bruit depuis le début du match. Personne ne sait '
      + 'pourquoi il fait ça. Tout le monde le regarde.',
    mods:{ parryBonus:1.45, holdBonus:1.04 },
    cri:{ label:'LE CRI SILENCIEUX', gest:'tempo', power:54 } },

  { id:'X34', nom:'Le Ramasseur de Gobelets', type:'fide', set:'VN', stage:1, rar:'d1',
    histoire:'Il repart toujours le dernier, une tour de gobelets dans les bras. '
      + 'Il dit que quelqu’un doit bien le faire.',
    mods:{ refundBonus:1.4, holdBonus:1.05 },
    cri:{ label:'IL EN RESTE', gest:'hold', power:47 } },

  { id:'X35', nom:'Le Mégaphone', type:'voix', set:'VN', stage:1, rar:'d3',
    histoire:'Dos au terrain pendant quatre-vingt-dix minutes. Il n’a jamais vu '
      + 'un but de sa vie et il ne s’en plaint pas.',
    mods:{ tempoWindow:1.4, tempoInterval:70 },
    cri:{ label:'TOUT LE MONDE AVEC MOI', gest:'tempo', power:76 } },

  { id:'X39', nom:'La Cagoule Rose', type:'tifo', set:'VN', stage:1, rar:'d2',
    histoire:'Il a l’air terrible jusqu’à ce qu’il sorte son téléphone. '
      + 'La coque est un lapin rose. Il assume.',
    mods:{ parryBonus:1.35, perfectBonus:1.1 },
    cri:{ label:'PAS SI MÉCHANT', gest:'hold', power:56 } },

  { id:'X41', nom:'L’Homme dans la Mascotte', type:'fide', set:'VN', stage:1, rar:'d2',
    histoire:'Il a la tête sous le bras et vingt minutes pour souffler. Personne '
      + 'ne le reconnaît sans le costume, et ça lui va très bien.',
    mods:{ holdBonus:1.12, holdForgive:1, breathBonus:0.96 },
    cri:{ label:'CINQ MINUTES', gest:'hold', power:57 } },

  { id:'X42', nom:'La Stadière', type:'tifo', set:'VN', stage:1, rar:'d2',
    histoire:'Elle confisque les bouchons depuis six ans. Elle en a une boîte '
      + 'entière chez elle et elle ne sait pas quoi en faire.',
    mods:{ parryBonus:1.5 },
    cri:{ label:'PAS DE BOUCHON', gest:'hold', power:55 } },

  { id:'X47', nom:'Le Bob du Dimanche', type:'fide', set:'VN', stage:1, rar:'d1',
    histoire:'Même bob, même place, même sandwich. Il a arrêté de compter les '
      + 'saisons quand il a dépassé les vingt.',
    mods:{ holdBonus:1.08 },
    cri:{ label:'COMME D’HABITUDE', gest:'hold', power:49 } },

  { id:'X48', nom:'Le Gosse qui Boude', type:'voix', set:'VN', stage:1, rar:'d1',
    histoire:'Il a la coupe et il fait la tête quand même. Son équipe a perdu '
      + 'le match d’après, et ça compte plus.',
    mods:{ perfectBonus:1.18, breathBonus:0.94 },
    cri:{ label:'C’EST PAS JUSTE', gest:'tempo', power:50 } },

  { id:'X49', nom:'Le Râleur du Rang B', type:'fide', set:'VN', stage:1, rar:'d2',
    histoire:'Rien ne va, rien n’a jamais été aussi mauvais, et il a repris son '
      + 'abonnement pour la trente-deuxième année.',
    mods:{ holdBonus:1.14, holdForgive:1 },
    cri:{ label:'DE MON TEMPS', gest:'hold', power:58 } },

  /* ============================================ NUITS EUROPÉENNES, la suite

     Le déplacement, la nuit, la caméra. Ceux pour qui le match se vit ailleurs
     qu’en tribune, ou de très loin. */

  { id:'X22', nom:'Le Craqueur de la Nuit', type:'pyro', set:'NE', stage:1, rar:'d3',
    histoire:'Blouson noir, écharpe à damier, et un fumigène qu’il tient à bout '
      + 'de bras comme une torche olympique.',
    mods:{ perfectBonus:1.4, backfire:true },
    cri:{ label:'LA NUIT S’ALLUME', gest:'mash', power:78 } },

  { id:'X31', nom:'Le Supporter en Orbite', type:'depl', set:'NE', stage:1, rar:'star',
    histoire:'Quatre cents kilomètres d’altitude, seize levers de soleil par jour, '
      + 'et une écharpe qu’il a fait passer dans ses effets personnels.',
    mods:{ breathBonus:1.3, refundBonus:1.5, tempoWindow:1.1 },
    cri:{ label:'DEPUIS LÀ-HAUT', gest:'tempo', power:80 } },

  { id:'X36', nom:'Le Vendeur d’Écharpes', type:'depl', set:'NE', stage:1, rar:'d2',
    histoire:'Il a les écharpes des deux clubs dans le même sac et il ne voit pas '
      + 'où est le problème.',
    mods:{ refundBonus:1.55, breathBonus:1.05 },
    cri:{ label:'DEUX POUR DIX', gest:'hold', power:56 } },

  { id:'X37', nom:'Le Juge de Touche', type:'tifo', set:'NE', stage:1, rar:'d2',
    histoire:'Il court la ligne depuis vingt ans et il n’a jamais entendu un seul '
      + 'compliment. Il lève le drapeau quand même.',
    mods:{ parryBonus:1.6, holdBonus:1.04 },
    cri:{ label:'HORS-JEU', gest:'tempo', power:58 } },

  { id:'X40', nom:'La Radio Locale', type:'voix', set:'NE', stage:1, rar:'d2',
    histoire:'Elle commente depuis un banc en plastique, sous la pluie, pour six '
      + 'cents auditeurs. Elle connaît chaque joueur par son prénom.',
    mods:{ tempoWindow:1.3, tempoInterval:40 },
    cri:{ label:'ET IL Y A BUT', gest:'tempo', power:60 } },

  { id:'X43', nom:'La Streameuse', type:'depl', set:'NE', stage:1, rar:'d2',
    histoire:'Elle filme la tribune plus que le terrain. Ses abonnés savent le '
      + 'score avec dix secondes d’avance sur la télévision.',
    mods:{ refundBonus:1.45, tempoWindow:1.15 },
    cri:{ label:'VOUS ENTENDEZ ÇA', gest:'tempo', power:57 } },

  { id:'X46', nom:'Le Peint des Pieds à la Tête', type:'pyro', set:'NE', stage:1, rar:'d2',
    histoire:'Deux heures de peinture, moins trois degrés, et il ne remettra pas '
      + 'son tee-shirt avant le coup de sifflet final.',
    mods:{ perfectBonus:1.3, breathBonus:0.92 },
    cri:{ label:'AUX COULEURS', gest:'mash', power:62 } },

  /* ========================================= LE VIRAGE IMPOSSIBLE

     Ce qui vit sous les gradins, ce qui vient de plus loin que le parcage, et
     ce qui n’aurait jamais dû trouver un billet. Le registre est assumé :
     ces cartes sont drôles là où les deux autres séries sont tendres. */

  { id:'X16', nom:'La Plante du Grillage', type:'voix', set:'IM', stage:1, rar:'d2',
    histoire:'Elle a poussé dans une fissure derrière le but. Un jour elle a eu '
      + 'une bouche, et depuis elle chante plus fort que le rang entier.',
    mods:{ tempoWindow:1.35, mashBonus:1.06 },
    cri:{ label:'GUEULE GRANDE OUVERTE', gest:'tempo', power:60 } },

  { id:'X18', nom:'Le Fantôme de la Tribune Sud', type:'fide', set:'IM', stage:1, rar:'star',
    histoire:'Abonné depuis 1961. Mort en 1994. Il n’a pas manqué un match, et il '
      + 'trouve que le nouveau stade manque d’âme.',
    mods:{ holdBonus:1.28, holdForgive:3, breathBonus:1.1 },
    cri:{ label:'JE N’AI JAMAIS PARTI', gest:'hold', power:82 } },

  { id:'X19', nom:'Le Comte du Parcage', type:'pyro', set:'IM', stage:1, rar:'d3',
    histoire:'Il ne se déplace qu’aux matchs en nocturne, ce qui limite beaucoup '
      + 'son calendrier. Il boit quelque chose de rouge et refuse de dire quoi.',
    mods:{ perfectBonus:1.38, backfire:true, tempoWindow:1.1 },
    cri:{ label:'APRÈS LE COUCHER DU SOLEIL', gest:'mash', power:76 } },

  { id:'X21', nom:'Le Gladiateur en Mousse', type:'perc', set:'IM', stage:1, rar:'d2',
    histoire:'Casque authentique, épée en mousse. Il crie « ainsi meurent les '
      + 'traîtres » à chaque corner adverse depuis six ans.',
    mods:{ mashBonus:1.15, perfectBonus:1.12 },
    cri:{ label:'POUR LA GLOIRE', gest:'mash', power:64 } },

  { id:'X23', nom:'Le Caméléon en Smoking', type:'tifo', set:'IM', stage:1, rar:'d3',
    histoire:'Il prend la couleur du camp qui mène. En prolongations, il vire au '
      + 'gris et refuse tout commentaire.',
    mods:{ parryBonus:1.8, holdBonus:1.06 },
    cri:{ label:'ÇA DÉPEND', gest:'hold', power:70 } },

  { id:'X24', nom:'La Chouette Statisticienne', type:'voix', set:'IM', stage:1, rar:'d2',
    histoire:'Elle tient les chiffres depuis la charpente. Elle sait combien de '
      + 'passes ont été ratées et elle en veut à tout le monde.',
    mods:{ tempoWindow:1.42, tempoInterval:50 },
    cri:{ label:'STATISTIQUEMENT', gest:'tempo', power:62 } },

  { id:'X25', nom:'Le Héros Fatigué', type:'fide', set:'IM', stage:1, rar:'d3',
    histoire:'Il a sauvé la ville trois fois. Son club, jamais. C’est ce qui le '
      + 'ronge le plus.',
    mods:{ holdBonus:1.2, holdForgive:2, breathBonus:0.94 },
    cri:{ label:'PAS CETTE FOIS NON PLUS', gest:'hold', power:72 } },

  { id:'X28', nom:'La Faucheuse au Pop-corn', type:'fide', set:'IM', stage:1, rar:'crown',
    histoire:'Elle vient pour la fin des matchs. Elle reste pour les prolongations, '
      + 'les tirs au but, et le troisième sac de pop-corn.',
    mods:{ holdBonus:1.3, holdForgive:4, perfectBonus:1.2, breathBonus:1.15 },
    cri:{ label:'PERSONNE NE PART AVANT LA FIN', gest:'hold', power:92 } },

  { id:'X29', nom:'Le Poulet en Caoutchouc', type:'voix', set:'IM', stage:1, rar:'d1',
    histoire:'Il a été lancé sur le terrain en 1998. Il n’est jamais reparti, et '
      + 'il a désormais son propre chant.',
    mods:{ tempoWindow:1.12 },
    cri:{ label:'LE CRI DU POULET', gest:'tempo', power:44 } },

  { id:'X30', nom:'Le Videur', type:'tifo', set:'IM', stage:1, rar:'d2',
    histoire:'Costume trois pièces, oreillette, deux cents kilos de calme. '
      + 'Il n’a jamais eu à se lever.',
    mods:{ parryBonus:1.55, holdBonus:1.08 },
    cri:{ label:'PAS PAR ICI', gest:'hold', power:60 } },

  { id:'X32', nom:'La Mascotte Casquée', type:'perc', set:'IM', stage:1, rar:'d1',
    histoire:'Boule de poils jaune, casque de chantier, panneau en bois. Personne '
      + 'ne sait ce qu’elle annonce et tout le monde applaudit.',
    mods:{ mashBonus:1.08 },
    cri:{ label:'ATTENTION TRAVAUX', gest:'mash', power:47 } },

  { id:'X33', nom:'Le Nain de Jardin', type:'fide', set:'IM', stage:1, rar:'d1',
    histoire:'Volé dans un jardin en 1987, emmené à tous les déplacements depuis. '
      + 'Il a vu plus de stades que la plupart des abonnés.',
    mods:{ holdBonus:1.07, refundBonus:1.15 },
    cri:{ label:'TOUJOURS LÀ', gest:'hold', power:46 } },

  { id:'X38', nom:'Le Capybara Serein', type:'fide', set:'IM', stage:1, rar:'d2',
    histoire:'Rien ne l’atteint. Ni le penalty refusé, ni le rouge à la '
      + 'quatre-vingt-douzième. Il est le seul à sortir reposé.',
    mods:{ holdBonus:1.18, holdForgive:2, breathBonus:1.12 },
    cri:{ label:'TOUT VA BIEN', gest:'hold', power:58 } },

  { id:'X44', nom:'Le Pigeon à la Frite', type:'depl', set:'IM', stage:1, rar:'d1',
    histoire:'Il connaît les horaires de tous les matchs de la ville. Il ne vient '
      + 'pas pour le football.',
    mods:{ refundBonus:1.3, breathBonus:1.04 },
    cri:{ label:'C’EST TOMBÉ', gest:'hold', power:45 } },

  { id:'X45', nom:'Le Téléviseur', type:'perc', set:'IM', stage:1, rar:'d3',
    histoire:'Il diffusait les matchs dans un café qui a fermé. Il s’est levé, il '
      + 'a mis une écharpe, et il est venu voir en vrai.',
    mods:{ mashBonus:1.18, mashTime:-500, tempoInterval:30 },
    cri:{ label:'EN DIRECT DU VIRAGE', gest:'mash', power:72 } },

  { id:'X50', nom:'La Pieuvre à Lunettes', type:'perc', set:'IM', stage:1, rar:'star',
    histoire:'Huit bras, huit maillets, un seul tempo. Elle a mis trois saisons à '
      + 'trouver des lunettes à sa taille.',
    mods:{ mashBonus:1.35, mashTime:-900, breathBonus:1.08 },
    cri:{ label:'LES HUIT EN MÊME TEMPS', gest:'mash', power:84 } },

  { id:'X51', nom:'Le Touriste d’Ailleurs', type:'depl', set:'IM', stage:1, rar:'star',
    histoire:'Il a traversé la galaxie pour un match de milieu de tableau. Il a '
      + 'pris un hot-dog et il trouve que ça valait le voyage.',
    mods:{ breathBonus:1.25, refundBonus:1.6, parryBonus:1.2 },
    cri:{ label:'ON N’A PAS ÇA CHEZ NOUS', gest:'tempo', power:80 } },
];

const RATES = {
  4: [['d2',.80],['d3',.15],['star',.04],['crown',.01]],
  5: [['d2',.55],['d3',.30],['star',.12],['crown',.03]],
};

/* ------------------------------------------------- le lot de septembre 2026

   Cent vingt-six cartes en six séries, dans `dex-2026.js`. Elles sont
   concaténées ici plutôt qu'écrites à la suite : ces deux fichiers ne servent
   plus qu'à **amorcer** la base, et garder le lot d'origine séparé du lot
   suivant dit lequel est lequel. Mélangés, on n'oserait plus toucher ni à
   l'un ni à l'autre.

   L'amorçage écrit en `INSERT IGNORE` : ajouter une série ici ne réécrit
   jamais ce que l'administration a modifié depuis.                        */

const TOUT = [...DEX, ...DEX_2026];
const TOUS_SETS = [...SETS, ...SETS_2026];

// Un identifiant en double ferait taire une carte sans le dire : la seconde
// écraserait la première dans BY_ID, et elle disparaîtrait des tirages sans
// que rien ne le signale.
{
  const vus = new Set();
  for (const f of TOUT) {
    if (vus.has(f.id)) throw new Error(`Catalogue : identifiant en double « ${f.id} ». `
      + 'Deux cartes ne peuvent pas partager un identifiant — la seconde efface '
      + 'la première et sort silencieusement des boosters.');
    vus.add(f.id);
  }
  const setsConnus = new Set(TOUS_SETS.map((s) => s.id));
  for (const f of TOUT) {
    if (!setsConnus.has(f.set)) throw new Error(`Catalogue : « ${f.id} » appartient à la `
      + `série « ${f.set} », qui n'existe pas. Le kiosque n'affiche que les séries `
      + 'déclarées : cette carte serait tirable et invisible.');
  }
}

export const BY_ID = new Map(TOUT.map((f) => [f.id, f]));
export { TYPES, RAR, SCARVES, EVO_COST, RATES };
export { TOUS_SETS as SETS, TOUT as DEX };
