/**
 * Catalogue Fanzzy — source unique.
 *
 * Le serveur s'en sert pour tirer les boosters et valider les évolutions ; le
 * client le reçoit via /api/fanzzy/dex pour l'affichage. Une seule définition,
 * donc aucun risque que les deux divergent.
 */
import { SETS_2026, DEX_2026 } from './dex-2026.js';
import { DEX_LEGENDES } from './dex-legendes.js';
import { SETS_NEUVES, DEX_NEUVES } from './dex-series-neuves.js';
import { SET_SAISON, DEX_SAISON } from './dex-saison.js';
import { AGES } from './dex-ages.js';
import { agesDe, idDuStade } from './ages.js';

/**
 * Les six familles — et **les gestes que chacune sait faire**.
 *
 * `gestes` était `geste`, un mot au singulier, et trois familles sur six
 * annonçaient un geste qu'elles ne tenaient pas : Tifo disait « contre » et
 * jouait l'endurance 24 fois sur 38 ; Pyro disait « risque » et jouait surtout
 * le martelage ; Déplacement disait « souffle » et jouait surtout le tempo.
 *
 * Rien n'était cassé — `type` ne servait qu'à la couleur et au pictogramme,
 * aucune mécanique ne le lisait. C'était seulement une promesse que le
 * catalogue ne tenait pas : choisir un Pyro pour son geste de risque donnait
 * un tempo.
 *
 * La liste **est** la règle maintenant. Les dix-sept gestes du jeu y sont
 * répartis sans trou ni doublon : chacun appartient à une famille et à une
 * seule, et un personnage ne peut porter que l'un des gestes de la sienne.
 * `catalogue:test` le vérifie sur les quatre cent quatre-vingt-onze cartes.
 *
 * Le premier de chaque liste est **le geste de la famille** — celui qu'on
 * associe à son nom, et le plus fréquent chez elle. Les suivants sont ses
 * variantes : de quoi distinguer deux Voix sans les sortir de la Voix.
 */
const TYPES = {
  // La voix mène : le tempo, ce qui se chante à contretemps, ce qui se répond,
  // et l'appel du capo — qui est une voix avant d'être un geste.
  voix: { nom:'Voix', c:'#F5C33B', gestes:['tempo', 'contretemps', 'echo', 'capo'],
    ico:'M4 9v6h4l5 4V5L8 9H4zm12.5-1a5 5 0 0 1 0 8' },
  // Ce qui frappe : vite, de plus en plus vite, par rafales, ou des deux mains à la fois.
  perc: { nom:'Percussion', c:'#3C82E8', gestes:['mash', 'crescendo', 'salves', 'deuxvoix'],
    ico:'M12 6c5 0 8 1.5 8 3.5S17 13 12 13 4 11.5 4 9.5 7 6 12 6zm-8 4v5c0 2 3.5 3.5 8 3.5s8-1.5 8-3.5v-5' },
  // Ce qui reste : tenir, tenir sans aller au bout, tenir le compte exact.
  fide: { nom:'Fidélité', c:'#C2CAD6', gestes:['hold', 'tenue', 'retenue', 'jauge'],
    ico:'M12 21s-7-4.4-7-9.5A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 3.5C19 16.6 12 21 12 21z' },
  // Ce qui se montre : dessiner la forme, allumer la grille, trier les cartons,
  // lever la vague au passage.
  tifo: { nom:'Tifo', c:'#8257DA', gestes:['tifo', 'mosaique', 'tri', 'ola'],
    ico:'M4 4h16v12l-8-3-8 3V4z' },
  /* Le risque, et c'est une affaire d'**instant** : lâcher pile sur la
     pulsation, tomber juste quand le compte s'est éteint. C'est exactement ce
     qu'est une torche qu'on allume — une seconde trop tôt ou trop tard et ce
     n'est plus le même geste. */
  pyro: { nom:'Pyro', c:'#E0402C', gestes:['relance', 'compte', 'visee', 'rouleaux'],
    ico:'M12 2c1 4-3 5-3 9a3 3 0 0 0 6 0c0-2-1-3-1-4 2 1 4 3 4 6a6 6 0 0 1-12 0c0-5 6-7 6-11z' },
  // La route : l'écharpe qu'on fait tourner, les visages qu'on retient, et le
  // chant qu'on renvoie à l'envers, comme la tribune d'en face.
  depl: { nom:'Déplacement', c:'#1E9E6A', gestes:['echarpe', 'memoire', 'bascule', 'miroir'],
    ico:'M4 7h16v8H4zM4 15v3h3v-3m10 0v3h3v-3M6 10h12' },
};

/** Le geste qui porte le nom de la famille : le premier de sa liste. */
export const gesteDeFamille = (type) => TYPES[type]?.gestes?.[0] ?? 'tempo';

/** Une famille sait-elle faire ce geste ? C'est la règle du catalogue. */
export const familleSaitFaire = (type, geste) =>
  Boolean(TYPES[type]?.gestes?.includes(geste));

/**
 * Les quatre raretés, et l'ordre qui les classe.
 *
 * L'échelle en avait cinq — d1, d2, d3, star, crown — et elle disait deux
 * choses à la fois : la force du personnage et sa rareté au tirage. Elle en dit
 * désormais une seule, mais elle la dit clairement : **la rareté suit le stade
 * d'évolution.** Un Fanzzy de stade 1 est commun, son stade 2 est rare, son
 * stade 3 est épique. La légendaire est hors de cette échelle : elle ne
 * s'obtient pas en faisant évoluer, elle se tire, et les cartes qui la portent
 * n'ont pas de lignée du tout.
 *
 * `star` et `crown` ont fusionné dans `legendaire`. On perd un cran de
 * granularité en haut, et on gagne une règle qu'un joueur comprend en une
 * phrase.
 */
const RAR = { commune:1, rare:2, epique:3, legendaire:4 };

/**
 * Ce que rend un doublon, en écharpes.
 *
 * C'est la seule source de revenu du jeu, et elle finance les évolutions :
 * vingt-cinq écharpes pour passer au stade 2, quatre-vingt-dix pour le stade 3.
 * Un doublon de commune en rapporte une : une évolution se paie en doublons.
 */
const SCARVES = { commune:1, rare:3, epique:10, legendaire:45 };
/**
 * Coût d'évolution, en écharpes. Vingt-cinq pour le stade 2, quatre-vingt-dix
 * pour le stade 3.
 *
 * Recalibré sur la simulation après le passage à quatre raretés. Compléter la
 * collection — cent trente-huit cartes de stade 1, environ deux cent quinze
 * boosters — rapporte à peu près 1 650 écharpes en doublons, et faire évoluer
 * les sept lignées existantes en coûte 805.
 *
 * Le chiffre qui compte pour la suite : si les cent trente-huit gagnent leurs
 * trois stades, tout faire évoluer coûtera près de 16 000 écharpes. La collecte
 * initiale n'y suffit pas — et c'est voulu. Ce qui paie, c'est le jeu
 * régulier : une fois la collection complète, chaque booster n'est plus que des
 * doublons, soit environ mille écharpes par jour. Une quinzaine de jours pour
 * tout faire évoluer, et entre-temps il faut choisir. C'est exactement ce qu'on
 * cherche : de quoi choisir, pas de quoi tout avoir sans y penser.
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
/* **VIRAGE NORD et NUITS EUROPÉENNES ne sont plus.**
 *
 * C'étaient les deux plus maigres — seize et neuf personnages publiés, quand LA
 * TRIBUNE en compte trente-cinq. Une série est une étagère à compléter ; une
 * étagère de neuf cases se remplit par accident, elle ne se collectionne pas.
 *
 * Et leurs sujets appartenaient ailleurs. VIRAGE NORD, « béton, pluie, hiver »,
 * c'était la tribune ordinaire — celle de LA TRIBUNE, dont ses cinq légendaires
 * sont les archétypes. NUITS EUROPÉENNES, « jeudi soir, 900 km », c'était le
 * déplacement, et le déplacement a maintenant sa série.
 *
 * **Rien n'a été supprimé.** Leurs quarante-deux cartes ont changé de champ
 * `set` et gardé leur identifiant : les possessions, les decks, les tenues et
 * les âges d'un joueur les suivent sans qu'on y touche. Le déménagement en base
 * se fait par `sql/series-neuves.sql` — le catalogue vit en base, et l'amorçage
 * écrit en `INSERT IGNORE`.
 *
 * Voir `dex-series-neuves.js` pour le détail de qui est allé où.
 */
const SETS = [
  { id:'IM', nom:'LE VIRAGE IMPOSSIBLE', ligne:'ceux qui ne devraient pas être là',
    c1:'#8257DA', c2:'#12101C' },
];

/* Les personnages. Les taux de tirage sont plus bas, dans `RATES`, avec la
   règle des places — ce commentaire-ci les annonçait ici, et il annonçait une
   règle qui a changé deux fois depuis. */

const DEX = [
  // --- VOIX
  { id:'TR32', nom:'Choriste', type:'voix', set:'TR', stage:1, rar:'commune', evo:'TR32B',
    histoire:'Il chante tout, il ne lance rien. Une voix parmi deux mille, et il '
      + 'trouve que c’est très bien comme ça.',
    mods:{ tempoWindow:1.2 }, cri:{ label:'REPRISE', gest:'tempo', power:52 } },
  { id:'TR32B', nom:'Meneur de chant', type:'voix', set:'TR', stage:2, rar:'rare', evo:'TR32C',
    histoire:'Six ans plus tard, il a arrêté de regarder le terrain. Il lance le '
      + 'chant, bras levé, et il attend que la tribune le rattrape.',
    mods:{ tempoWindow:1.45, tempoInterval:40 }, cri:{ label:'MUR DU SON', gest:'tempo', power:64 } },
  { id:'TR32C', nom:'Capo di Curva', type:'voix', set:'TR', stage:3, rar:'epique',
    histoire:'Le mégaphone pend à son poing, éteint : il n’en a plus besoin. '
      + 'Deux mille personnes attendent qu’il lève le menton.',
    mods:{ tempoWindow:1.7, tempoInterval:80 }, cri:{ label:'TOUT LE VIRAGE', gest:'tempo', power:78 } },
  // --- PERCUSSION
  { id:'MS30', nom:'Gamin au tambour', type:'perc', set:'MS', stage:1, rar:'commune', evo:'MS30B',
    histoire:'Onze ans, une caisse claire trop grande pour lui, et l’air de '
      + 'quelqu’un à qui on a confié une mission d’État.',
    mods:{ mashBonus:1.06 }, cri:{ label:'ROULEMENT', gest:'mash', power:52 } },
  { id:'MS30B', nom:'Tambour Major', type:'perc', set:'MS', stage:2, rar:'rare', evo:'MS30C',
    histoire:'La caisse est sur un harnais maintenant, et elle est à sa taille. '
      + 'Il ne suit plus le rythme : c’est lui qui le donne.',
    mods:{ mashBonus:1.1, mashTime:-500 }, cri:{ label:'CADENCE', gest:'mash', power:66 } },
  { id:'MS30C', nom:'Grosse Caisse Sud', type:'perc', set:'MS', stage:3, rar:'epique',
    histoire:'Vingt ans, une grosse caisse aussi large que lui, et l’écharpe du '
      + 'gamin nouée en bandeau. Quand il s’arrête, le virage s’arrête.',
    mods:{ mashBonus:1.16, mashTime:-800 }, cri:{ label:'TEMPO INFERNAL', gest:'mash', power:76 } },
  // --- FIDÉLITÉ
  { id:'TR33', nom:'Abonné', type:'fide', set:'TR', stage:1, rar:'commune', evo:'TR33B',
    histoire:'La personne la plus ordinaire de la tribune, et celle qui est '
      + 'toujours là. Mains dans les poches, thermos dans l’autre.',
    mods:{ holdBonus:1.07 }, cri:{ label:'PRÉSENTS', gest:'hold', power:50 } },
  { id:'TR33B', nom:'Vieille Garde', type:'fide', set:'TR', stage:2, rar:'rare', evo:'TR33C',
    histoire:'Douze ans de plus, les cheveux gris, la veste couverte de pin’s. '
      + 'C’est lui qu’on va voir quand on veut savoir ce qui s’est passé en 98.',
    mods:{ holdBonus:1.12, holdForgive:1 }, cri:{ label:'ON ÉTAIT LÀ', gest:'hold', power:64 } },
  { id:'TR33C', nom:'Doyen du Bloc C', type:'fide', set:'TR', stage:3, rar:'epique',
    histoire:'Canne, plaid sur l’épaule, écharpe devenue presque incolore. '
      + 'Cinquante ans de samedis, et il n’en a manqué aucun.',
    mods:{ holdBonus:1.2, holdForgive:2, breathBonus:1.08 }, cri:{ label:'CINQUANTE ANS', gest:'hold', power:80 } },
  // --- TIFO
  { id:'MS31', nom:'Colleur d\u2019affiches', type:'tifo', set:'MS', stage:1, rar:'commune', evo:'MS31B',
    histoire:'Il pose les avis de déplacement la nuit, capuche relevée, un œil sur '
      + 'le côté. Les affiches sont vierges : il n’a jamais rien fait de mal.',
    mods:{ parryBonus:1.2 }, cri:{ label:'CONSIGNES', gest:'tifo', power:48 } },
  { id:'MS31B', nom:'Bâcheur Nocturne', type:'tifo', set:'MS', stage:2, rar:'rare', evo:'MS31C',
    histoire:'Il est passé des affiches aux grandes bâches. Corde à l’épaule, '
      + 'baudrier, frontale au front : il accroche ce que personne n’atteint.',
    mods:{ parryBonus:1.5 }, cri:{ label:'BÂCHE SURPRISE', gest:'tifo', power:62 } },
  { id:'MS31C', nom:'Chef Tifo', type:'tifo', set:'MS', stage:3, rar:'epique',
    histoire:'Il ne grimpe plus, il dirige. Bras croisés, radio sur la poitrine, un '
      + 'plan roulé sous le bras : tout a déjà été vérifié deux fois.',
    mods:{ parryBonus:1.9, holdBonus:1.06 }, cri:{ label:'MOSAÏQUE GÉANTE', gest:'tifo', power:74 } },
  // --- PYRO
  { id:'TR34', nom:'Porte-torche', type:'pyro', set:'TR', stage:1, rar:'commune', evo:'TR34B',
    histoire:'Écharpe remontée sur le nez, torche éteinte au poing, il attend la '
      + 'minute exacte. Rien n’est encore allumé, et c’est tout le sujet.',
    mods:{ perfectBonus:1.2 }, cri:{ label:'TORCHE', gest:'relance', power:54 } },
  { id:'TR34B', nom:'Fumigène', type:'pyro', set:'TR', stage:2, rar:'rare', evo:'TR34C',
    histoire:'Il a cessé de se cacher. Tablier de cuir, masque au cou, gants '
      + 'épais : il fait ça proprement, ce qui ne veut pas dire sans risque.',
    mods:{ perfectBonus:1.35, backfire:true }, cri:{ label:'NAPPE DE FUMÉE', gest:'relance', power:70 } },
  { id:'TR34C', nom:'Craqueur', type:'pyro', set:'TR', stage:3, rar:'epique',
    histoire:'Trois torches en bandoulière, les mains vides, la barbe grise. C’est '
      + 'lui que les autres regardent pour savoir quand.',
    mods:{ perfectBonus:1.5, backfire:true }, cri:{ label:'EMBRASEMENT', gest:'relance', power:86 } },
  // --- DÉPLACEMENT
  { id:'MS32', nom:'Auto-stoppeur', type:'depl', set:'MS', stage:1, rar:'commune', evo:'MS32B',
    histoire:'Pouce levé, carton vierge sous le bras, quatre cents kilomètres à '
      + 'faire et aucune inquiétude à ce sujet.',
    mods:{ breathBonus:1.08 }, cri:{ label:'PREMIER PÉAGE', gest:'echarpe', power:50 } },
  { id:'MS32B', nom:'Conducteur de car', type:'depl', set:'MS', stage:2, rar:'rare', evo:'MS32C',
    histoire:'Il n’a plus besoin qu’on le prenne : il conduit. Casquette, '
      + 'trousseau à la ceinture, thermos brandi comme une coupe.',
    mods:{ breathBonus:1.16, refundBonus:1.4 }, cri:{ label:'KLAXONS', gest:'echarpe', power:64 } },
  { id:'MS32C', nom:'Convoi 4h du Mat', type:'depl', set:'MS', stage:3, rar:'epique',
    histoire:'Il ne conduit plus un car, il mène le convoi. Quatre heures du matin, '
      + 'trois jours sans dormir, et un immense sourire : tout le monde est arrivé.',
    mods:{ breathBonus:1.24, refundBonus:1.8 }, cri:{ label:'ON EST VENUS POUR ÇA', gest:'echarpe', power:76 } },
  // --- sans évolution
  { id:'TR35', nom:'Le Douzième Homme', type:'voix', set:'TR', stage:1, rar:'commune',
    histoire:'Il n’est personne en particulier, et c’est exactement ce qu’il '
      + 'est : n’importe qui, debout, la bouche grande ouverte. Enlevez-le et il '
      + 'manque une voix sur deux mille. Enlevez-en deux mille et il n’y a plus '
      + 'de virage.',
    mods:{ tempoWindow:1.3, breathBonus:1.1 }, cri:{ label:'OLA', gest:'tempo', power:68 } },
  { id:'MT14', nom:'Écharpes au Vent', type:'fide', set:'MT', stage:1, rar:'commune',
    mods:{ holdBonus:1.1 }, cri:{ label:'LEVER LES BRAS', gest:'hold', power:56 } },
  { id:'TR36', nom:'Mosaïque Populaire', type:'tifo', set:'TR', stage:1, rar:'commune',
    histoire:'Elle tient son carton à bout de bras pendant quatre minutes, sans '
      + 'savoir de quelle couleur il est ni ce que ça dessine. Elle verra la photo '
      + 'le lendemain, comme tout le monde.',
    mods:{ parryBonus:1.3 }, cri:{ label:'DÉPLOIEMENT', gest:'tifo', power:56 } },
  { id:'GD10', nom:'Parcage 400 places', type:'depl', set:'GD', stage:1, rar:'legendaire',
    mods:{ breathBonus:1.14, parryBonus:1.4 }, cri:{ label:'ÉCHO DU PARCAGE', gest:'echarpe', power:72 } },
  { id:'GD11', nom:'La Nuit du 8e', type:'pyro', set:'GD', stage:1, rar:'legendaire',
    mods:{ perfectBonus:1.45, tempoWindow:1.2, mashBonus:1.08 }, cri:{ label:'PROLONGATIONS', gest:'relance', power:90 } },
  /**
   * LE FAUX DÉPART — celui qui lance trop tôt.
   *
   * ## Pourquoi ce personnage a changé d'identité
   *
   * `TR37` était « Le Gamin de Devant » : onze ans, premier rang, mains sur la
   * barrière, il ne connaissait pas encore tous les chants mais il ne
   * s'arrêtait jamais. Sa lignée le faisait grandir jusqu'à devenir capo.
   *
   * C'était **Le Petit Teigneux** (`TR1`), écrit une seconde fois. Onze ans,
   * premier rang, la voix avant les mots, et une lignée qui vieillit jusqu'au
   * bout du virage. Deux noms, deux histoires, deux cris — et un seul
   * personnage. Au point que le troisième âge de TR1 finit en gueulant « sur
   * un gamin de onze ans qui connaît déjà les chants », qui était très
   * exactement TR37.
   *
   * Dans un jeu de collection, c'est la faute la plus chère possible : une
   * carte de moins à trouver, et un joueur qui se demande s'il a mal vu.
   *
   * **L'identifiant ne bouge pas.** Les possessions, les decks et les tenues
   * référencent `TR37`, `TR37B`, `TR37C` : les renommer confisquerait la carte à ceux
   * qui l'ont déjà. On change qui il est, pas où il est rangé.
   *
   * ## Qui il est maintenant
   *
   * Ses modificateurs n'ont pas bougé d'un chiffre, et ils dictaient déjà le
   * personnage — il suffisait de les lire. Un `perfectBonus` énorme, un
   * `breathBonus` sous la barre : quelqu'un dont le geste juste vaut plus que
   * celui de n'importe qui, et qui n'a aucun coffre pour tenir la distance.
   * **Des coups d'éclat, pas de la régularité.**
   *
   * C'est celui qui lance un chant trois secondes trop tôt, tout seul, dans le
   * silence. Neuf fois sur dix personne ne suit et il se rassoit. La dixième,
   * la tribune part avec lui, et c'est ce soir-là qu'on raconte.
   *
   * Sa lignée est donc un apprentissage de **l'attente** — et le catalogue le
   * disait déjà sans que personne ne l'entende : au troisième âge, ses bonus de
   * vitesse disparaissent au profit d'une fenêtre de tempo à 1,6 et d'une
   * cadence ralentie de soixante millisecondes. Il ne va pas plus vite en
   * vieillissant. Il laisse plus de silence, et tout le monde l'attend.
   */
  { id:'TR37', nom:'Le Faux Départ', type:'voix', set:'TR', stage:1, rar:'commune', evo:'TR37B',
    histoire:'Il lance le chant trois secondes trop tôt, tout seul, et sa voix retombe '
      + 'dans le silence. Une fois sur dix la tribune part avec lui, et c’est ce '
      + 'soir-là qu’on raconte.',
    mods:{ perfectBonus:1.35, breathBonus:0.85, tempoWindow:1.1 },
    cri:{ label:'TROP TÔT', gest:'tempo', power:58 } },

  { id:'TR37B', nom:'Le Bon Moment', type:'voix', set:'TR', stage:2, rar:'rare', evo:'TR37C',
    histoire:'Il a appris à compter jusqu’à trois avant d’ouvrir la bouche. '
      + 'Il lance deux fois moins souvent, et on le suit presque toujours.',
    mods:{ perfectBonus:1.45, breathBonus:0.92, tempoWindow:1.3 },
    cri:{ label:'LÀ, C’EST LÀ', gest:'tempo', power:70 } },

  { id:'TR37C', nom:'Le Silence d’Avant', type:'voix', set:'TR', stage:3, rar:'epique',
    histoire:'Il ne lance plus rien : il lève la main, et deux mille personnes se '
      + 'taisent en même temps. Ce silence-là dure ce qu’il veut, et c’est '
      + 'devenu le plus beau moment du match.',
    mods:{ perfectBonus:1.5, tempoWindow:1.6, tempoInterval:60 },
    cri:{ label:'QUAND JE LÈVE LA MAIN', gest:'tempo', power:84 } },

  { id:'TR38', nom:'Section Cendrée', type:'fide', set:'TR', stage:1, rar:'commune',
    histoire:'Elle était debout du temps où il n’y avait pas de sièges, et elle '
      + 'est restée debout quand on les a posés. Son siège est plié depuis '
      + 'onze ans et il est comme neuf.',
    mods:{ holdBonus:1.05, breathBonus:1.04 }, cri:{ label:'FIDÈLES', gest:'hold', power:48 } },

  /**
   * LE TRIEUR DE DOUBLES — celui qui n'a jamais jeté une carte.
   *
   * Il connaît par cœur ce qui lui manque, et il attend depuis deux ans. Ses
   * modificateurs disent la même chose que son histoire : il tient dans la
   * durée et il récupère ce que les autres gaspillent, mais il ne fait
   * jamais de coup d'éclat.
   */
  { id:'TR39', nom:'Celui Qui Reste', type:'fide', set:'TR', stage:1, rar:'commune',
    histoire:'Il est encore assis vingt minutes après le coup de sifflet, seul '
      + 'dans sa rangée, face à une pelouse qu’on arrose déjà. Il n’attend '
      + 'rien. Il n’est juste pas pressé.',
    mods:{ holdBonus:1.12, refundBonus:1.35 },
    cri:{ label:'ENCORE CINQ MINUTES', gest:'hold', power:58 } },

  /**
   * LA MASCOTTE DU DIMANCHE — sept ans, un costume trop grand, et le seul
   * rôle qu'on lui laisse au bord du terrain. Elle le prend très au sérieux.
   *
   * Elle absorbe et détourne plutôt qu'elle ne pousse : une peluche ne crie
   * pas fort, mais personne ne sait par où elle va passer.
   */
  { id:'TR40', nom:'La Mascotte du Dimanche', type:'tifo', set:'TR', stage:1, rar:'commune',
    histoire:'Sept ans, un costume deux tailles trop grand, et le seul rôle qu\u2019on '
      + 'lui laisse au bord du terrain. Elle le prend très au sérieux.',
    mods:{ parryBonus:1.4, holdBonus:1.05 },
    cri:{ label:'LA PELUCHE DÉBOULE', gest:'tifo', power:56 } },

  /* ------------------------------------------- les gens du stade

     Sept figures qu'on croise sans jamais les voir jouer : celui qui nourrit
     la file d'attente, celle qui tient le bar, celui qui souffle faux depuis
     trente ans. Ils ne sont pas dans le virage, ils sont *autour* — et un
     stade sans eux n'est qu'un terrain avec des gradins.

     Leurs modificateurs racontent leur métier, pas leur puissance : le
     marchand rend du souffle, la patronne tient la distance, la voyante voit
     la mesure arriver. */

  { id:'GC15', nom:'Le Marchand de Saucisses', publie:false /* refait MS25 */, type:'fide', set:'GC', stage:1, rar:'commune',
    histoire:'Il n’a jamais vu un but de sa vie. Il les entend, et il sait au bruit '
      + 'si c’était pour nous.',
    mods:{ breathBonus:1.18, holdBonus:1.04 },
    cri:{ label:'UNE POUR LA ROUTE', gest:'hold', power:50 } },

  { id:'GC16', nom:'La Patronne du Bar', publie:false /* refait MS1 */, type:'fide', set:'GC', stage:1, rar:'commune',
    histoire:'Elle a vu passer quatre entraîneurs, deux relégations et un titre. '
      + 'Elle essuie le même comptoir depuis les trois.',
    mods:{ holdBonus:1.16, holdForgive:1 },
    cri:{ label:'DERNIÈRE TOURNÉE', gest:'hold', power:58 } },

  { id:'TR41', nom:'La Trompette du Dimanche', publie:false /* refait MS22 */, type:'perc', set:'TR', stage:1, rar:'commune',
    histoire:'Trois notes, toujours les mêmes, depuis trente ans. Ses voisins ont '
      + 'renoncé à lui demander d’arrêter.',
    // Il donne la cadence mais épuise son entourage : le seul Fanzzy dont le
    // revers tombe sur les autres autant que sur lui.
    mods:{ mashBonus:1.14, mashTime:-300, breathBonus:0.92 },
    cri:{ label:'LA MÊME DEPUIS TRENTE ANS', gest:'mash', power:54 } },

  { id:'TR42', nom:'La Voyante du Virage', publie:false /* refait MS23 */, type:'voix', set:'TR', stage:1, rar:'commune',
    histoire:'Elle annonce le score à la mi-temps, se trompe une fois sur deux, et '
      + 'personne ne se souvient jamais des fois où elle s’est trompée.',
    // Voir la mesure arriver : sa fenêtre de tempo est la plus large du jeu.
    mods:{ tempoWindow:1.55, perfectBonus:1.12 },
    cri:{ label:'JE L’AVAIS VU VENIR', gest:'tempo', power:66 } },

  { id:'VP15', nom:'L’Agent en Tribune d’Honneur', type:'depl', set:'VP', stage:1, rar:'commune',
    histoire:'Il connaît quelqu’un. Il connaît toujours quelqu’un. Il a une paire de '
      + 'crampons dans la main et personne ne sait à qui elle appartient.',
    mods:{ refundBonus:1.65, breathBonus:1.06 },
    cri:{ label:'J’AI QUELQU’UN POUR ÇA', gest:'echarpe', power:60 } },

  { id:'MS33', nom:'Le Siffleur des Souterrains', type:'tifo', set:'MS', stage:1, rar:'commune',
    histoire:'On raconte qu’il vit sous la tribune sud depuis la rénovation de 1974. '
      + 'Personne ne l’a vu. Tout le monde a entendu son sifflet.',
    // Il détourne au lieu de pousser, et il n'a pas de coffre : une créature
    // d'embuscade, pas de force.
    mods:{ parryBonus:1.75, breathBonus:0.9 },
    cri:{ label:'COUP DE SIFFLET DANS LE NOIR', gest:'tifo', power:64 } },

  { id:'BG28', nom:'Le Loup du Virage', publie:false /* refait BG23 */, type:'pyro', set:'BG', stage:1, rar:'legendaire',
    histoire:'Un soir de pleine lune, quelqu’un a hurlé plus fort que toute la '
      + 'tribune. On ne l’a plus jamais vu arriver avant le coup d’envoi.',
    mods:{ perfectBonus:1.42, backfire:true, mashBonus:1.1 },
    cri:{ label:'PLEINE LUNE', gest:'relance', power:82 } },

  /* ==================================== L'ANCIEN VIRAGE NORD, la suite

     Des gens du stade, encore : ceux qu'on croise au tourniquet, dans la file,
     au rang de derrière. Aucun n'est spectaculaire, et c'est le propos.

     La série qui les portait n'existe plus. Ils sont répartis entre LA TRIBUNE,
     LES MÉTIERS DU STADE, LA GASTRONOMIE DE COMPTOIR et LES PHÉNOMÈNES MÉTÉO —
     leur champ `set` le dit, et c'est lui qui fait foi. Le bloc reste groupé
     parce que leur numérotation l'est. */

  { id:'TR43', nom:'Le Gosse à la Coupe', publie:false /* refait TR23 */, type:'voix', set:'TR', stage:1, rar:'commune',
    histoire:'Il a gagné la coupe des poussins il y a trois semaines. Il l’apporte '
      + 'à chaque match, au cas où quelqu’un n’aurait pas vu.',
    mods:{ tempoWindow:1.15, perfectBonus:1.1 },
    cri:{ label:'ON A GAGNÉ AUSSI', gest:'tempo', power:48 } },

  { id:'TR44', nom:'Premier Match', type:'fide', set:'TR', stage:1, rar:'commune',
    histoire:'Il ne connaît pas les chants, il ne sait pas quand se lever, et il '
      + 'regarde son voisin pour savoir quoi faire. Il reviendra.',
    mods:{ holdBonus:1.06, breathBonus:1.06 },
    cri:{ label:'COMME LES AUTRES', gest:'retenue', power:46 } },

  { id:'TR45', nom:'Le Tambour de Guerre', publie:false /* refait TR19 */, type:'perc', set:'TR', stage:1, rar:'commune',
    histoire:'Torse nu par moins deux, deux maillets, et une peinture qu’il refait '
      + 'à l’identique depuis onze ans.',
    mods:{ mashBonus:1.2, mashTime:-600, breathBonus:0.95 },
    cri:{ label:'ROULEMENT DE GUERRE', gest:'mash', power:74 } },

  { id:'TR46', nom:'Le Mime du Virage', publie:false /* refait MS2 */, type:'tifo', set:'TR', stage:1, rar:'commune',
    histoire:'Il hurle sans un bruit depuis le début du match. Personne ne sait '
      + 'pourquoi il fait ça. Tout le monde le regarde.',
    mods:{ parryBonus:1.45, holdBonus:1.04 },
    cri:{ label:'LE CRI SILENCIEUX', gest:'tifo', power:54 } },

  { id:'GC17', nom:'Le Ramasseur de Gobelets', publie:false /* refait MS3 */, type:'fide', set:'GC', stage:1, rar:'commune',
    histoire:'Il repart toujours le dernier, une tour de gobelets dans les bras. '
      + 'Il dit que quelqu’un doit bien le faire.',
    mods:{ refundBonus:1.4, holdBonus:1.05 },
    cri:{ label:'IL EN RESTE', gest:'jauge', power:47 } },

  { id:'TR47', nom:'Le Mégaphone', publie:false /* refait TR18 */, type:'voix', set:'TR', stage:1, rar:'commune',
    histoire:'Dos au terrain pendant quatre-vingt-dix minutes. Il n’a jamais vu '
      + 'un but de sa vie et il ne s’en plaint pas.',
    mods:{ tempoWindow:1.4, tempoInterval:70 },
    cri:{ label:'TOUT LE MONDE AVEC MOI', gest:'tempo', power:76 } },

  { id:'TR48', nom:'Le Carré à l’Envers', type:'tifo', set:'TR', stage:1, rar:'commune',
    histoire:'Dans chaque mosaïque il y a un carton retourné, et c’est toujours '
      + 'le sien. Le virage a arrêté de lui en vouloir : on le cherche des '
      + 'yeux avant de chercher le dessin.',
    mods:{ parryBonus:1.35, perfectBonus:1.1 },
    cri:{ label:'JE L’AI À L’ENVERS', gest:'ola', power:56 } },

  { id:'TR49', nom:'L’Homme dans la Mascotte', type:'fide', set:'TR', stage:1, rar:'commune',
    histoire:'Il a la tête sous le bras et vingt minutes pour souffler. Personne '
      + 'ne le reconnaît sans le costume, et ça lui va très bien.',
    mods:{ holdBonus:1.12, holdForgive:1, breathBonus:0.96 },
    cri:{ label:'CINQ MINUTES', gest:'retenue', power:57 } },

  { id:'MS34', nom:'La Stadière', publie:false /* refait MS5 */, type:'tifo', set:'MS', stage:1, rar:'commune',
    histoire:'Elle confisque les bouchons depuis six ans. Elle en a une boîte '
      + 'entière chez elle et elle ne sait pas quoi en faire.',
    mods:{ parryBonus:1.5 },
    cri:{ label:'PAS DE BOUCHON', gest:'ola', power:55 } },

  { id:'TR50', nom:'Le Bob du Dimanche', type:'fide', set:'TR', stage:1, rar:'commune',
    histoire:'Même bob, même place, même sandwich. Il a arrêté de compter les '
      + 'saisons quand il a dépassé les vingt.',
    mods:{ holdBonus:1.08 },
    cri:{ label:'COMME D’HABITUDE', gest:'tenue', power:49 } },

  { id:'TR51', nom:'La Note Qui Casse', type:'voix', set:'TR', stage:1, rar:'commune',
    histoire:'Il monte avec tout le monde et sa voix lâche toujours au même '
      + 'endroit. Le virage a fini par attendre ce moment-là, et plus personne '
      + 'ne chante la note juste.',
    mods:{ perfectBonus:1.18, breathBonus:0.94 },
    cri:{ label:'ÇA VA CASSER', gest:'contretemps', power:50 } },

  { id:'TR52', nom:'Le Râleur du Rang B', type:'fide', set:'TR', stage:1, rar:'commune',
    histoire:'Rien ne va, rien n’a jamais été aussi mauvais, et il a repris son '
      + 'abonnement pour la trente-deuxième année.',
    mods:{ holdBonus:1.14, holdForgive:1 },
    /* Il criait « DE MON TEMPS », mot pour mot comme TR12 « Le Ballon de
       Cuir ». Deux cartes différentes peuvent se ressembler ; elles ne peuvent
       pas crier la même chose — le cri est ce qui s'affiche en gros sur la
       fiche, et deux fiches au même cri se lisent comme une seule carte vue
       deux fois. Le personnage, lui, est distinct : celui-ci râle sur tout,
       l'autre garde une relique. */
    cri:{ label:'RIEN NE VA', gest:'retenue', power:58 } },

  /* ================================ LES ANCIENNES NUITS EUROPÉENNES, la suite

     Le déplacement, la nuit, la caméra. Ceux pour qui le match se vit ailleurs
     qu’en tribune, ou de très loin.

     Leur série a été dissoute : le déplacement a maintenant la sienne, et ceux
     qui regardaient de loin ont LES HÉROS DU CANAPÉ. Lire leur champ `set`. */

  { id:'TR53', nom:'Le Craqueur de la Nuit', publie:false /* refait TR34C */, type:'pyro', set:'TR', stage:1, rar:'commune',
    histoire:'Blouson noir, écharpe à damier, et un fumigène qu’il tient à bout '
      + 'de bras comme une torche olympique.',
    mods:{ perfectBonus:1.4, backfire:true },
    cri:{ label:'LA NUIT S’ALLUME', gest:'compte', power:78 } },

  { id:'GD12', nom:'Le Supporter en Orbite', publie:false /* refait EP12 */, type:'depl', set:'GD', stage:1, rar:'legendaire',
    histoire:'Quatre cents kilomètres d’altitude, seize levers de soleil par jour, '
      + 'et une écharpe qu’il a fait passer dans ses effets personnels.',
    mods:{ breathBonus:1.3, refundBonus:1.5, tempoWindow:1.1 },
    cri:{ label:'DEPUIS LÀ-HAUT', gest:'echarpe', power:80 } },

  { id:'GD13', nom:'Le Vendeur d’Écharpes', publie:false /* refait MS20 */, type:'depl', set:'GD', stage:1, rar:'commune',
    histoire:'Il a les écharpes des deux clubs dans le même sac et il ne voit pas '
      + 'où est le problème.',
    mods:{ refundBonus:1.55, breathBonus:1.05 },
    cri:{ label:'DEUX POUR DIX', gest:'echarpe', power:56 } },

  { id:'MS35', nom:'Le Juge de Touche', publie:false /* refait MS19 */, type:'tifo', set:'MS', stage:1, rar:'commune',
    histoire:'Il court la ligne depuis vingt ans et il n’a jamais entendu un seul '
      + 'compliment. Il lève le drapeau quand même.',
    mods:{ parryBonus:1.6, holdBonus:1.04 },
    cri:{ label:'HORS-JEU', gest:'tifo', power:58 } },

  { id:'HC15', nom:'La Radio Locale', type:'voix', set:'HC', stage:1, rar:'commune',
    histoire:'Elle commente depuis un banc en plastique, sous la pluie, pour six '
      + 'cents auditeurs. Elle connaît chaque joueur par son prénom.',
    mods:{ tempoWindow:1.3, tempoInterval:40 },
    cri:{ label:'ET IL Y A BUT', gest:'tempo', power:60 } },

  { id:'HC16', nom:'La Streameuse', publie:false /* refait TR16 */, type:'depl', set:'HC', stage:1, rar:'commune',
    histoire:'Elle filme la tribune plus que le terrain. Ses abonnés savent le '
      + 'score avec dix secondes d’avance sur la télévision.',
    mods:{ refundBonus:1.45, tempoWindow:1.15 },
    cri:{ label:'VOUS ENTENDEZ ÇA', gest:'echarpe', power:57 } },

  { id:'TR54', nom:'Le Peint des Pieds à la Tête', publie:false /* refait TR15 */, type:'pyro', set:'TR', stage:1, rar:'commune',
    histoire:'Deux heures de peinture, moins trois degrés, et il ne remettra pas '
      + 'son tee-shirt avant le coup de sifflet final.',
    mods:{ perfectBonus:1.3, breathBonus:0.92 },
    cri:{ label:'AUX COULEURS', gest:'rouleaux', power:62 } },

  /* ========================================= LE VIRAGE IMPOSSIBLE

     Ce qui vit sous les gradins, ce qui vient de plus loin que le parcage, et
     ce qui n’aurait jamais dû trouver un billet. Le registre est assumé :
     ces cartes sont drôles là où les deux autres séries sont tendres. */

  { id:'IM1', nom:'La Plante du Grillage', publie:false /* refait RV21 */, type:'voix', set:'IM', stage:1, rar:'commune',
    histoire:'Elle a poussé dans une fissure derrière le but. Un jour elle a eu '
      + 'une bouche, et depuis elle chante plus fort que le rang entier.',
    mods:{ tempoWindow:1.35, mashBonus:1.06 },
    cri:{ label:'GUEULE GRANDE OUVERTE', gest:'tempo', power:60 } },

  { id:'IM2', nom:'Le Fantôme de la Tribune Sud', publie:false /* refait RV20 */, type:'fide', set:'IM', stage:1, rar:'legendaire',
    histoire:'Abonné depuis 1961. Mort en 1994. Il n’a pas manqué un match, et il '
      + 'trouve que le nouveau stade manque d’âme.',
    mods:{ holdBonus:1.28, holdForgive:3, breathBonus:1.1 },
    cri:{ label:'JE N’AI JAMAIS PARTI', gest:'tenue', power:82 } },

  { id:'IM3', nom:'Le Comte du Parcage', publie:false /* refait RV19 */, type:'pyro', set:'IM', stage:1, rar:'commune',
    histoire:'Il ne se déplace qu’aux matchs en nocturne, ce qui limite beaucoup '
      + 'son calendrier. Il boit quelque chose de rouge et refuse de dire quoi.',
    mods:{ perfectBonus:1.38, backfire:true, tempoWindow:1.1 },
    cri:{ label:'APRÈS LE COUCHER DU SOLEIL', gest:'relance', power:76 } },

  { id:'IM4', nom:'Le Gladiateur en Mousse', publie:false /* refait EP17 */, type:'perc', set:'IM', stage:1, rar:'commune',
    histoire:'Casque authentique, épée en mousse. Il crie « ainsi meurent les '
      + 'traîtres » à chaque corner adverse depuis six ans.',
    mods:{ mashBonus:1.15, perfectBonus:1.12 },
    cri:{ label:'POUR LA GLOIRE', gest:'mash', power:64 } },

  { id:'IM5', nom:'Le Caméléon en Smoking', publie:false /* refait BG22 */, type:'tifo', set:'IM', stage:1, rar:'commune',
    histoire:'Il prend la couleur du camp qui mène. En prolongations, il vire au '
      + 'gris et refuse tout commentaire.',
    mods:{ parryBonus:1.8, holdBonus:1.06 },
    cri:{ label:'ÇA DÉPEND', gest:'tifo', power:70 } },

  { id:'IM6', nom:'La Chouette Statisticienne', publie:false /* refait BG1 */, type:'voix', set:'IM', stage:1, rar:'commune',
    histoire:'Elle tient les chiffres depuis la charpente. Elle sait combien de '
      + 'passes ont été ratées et elle en veut à tout le monde.',
    mods:{ tempoWindow:1.42, tempoInterval:50 },
    cri:{ label:'STATISTIQUEMENT', gest:'tempo', power:62 } },

  { id:'IM7', nom:'Le Héros Fatigué', publie:false /* refait TR20 */, type:'fide', set:'IM', stage:1, rar:'commune',
    histoire:'Il a sauvé la ville trois fois. Son club, jamais. C’est ce qui le '
      + 'ronge le plus.',
    mods:{ holdBonus:1.2, holdForgive:2, breathBonus:0.94 },
    cri:{ label:'PAS CETTE FOIS NON PLUS', gest:'tenue', power:72 } },

  { id:'IM8', nom:'La Faucheuse au Pop-corn', publie:false /* refait RV18 */, type:'fide', set:'IM', stage:1, rar:'legendaire',
    histoire:'Elle vient pour la fin des matchs. Elle reste pour les prolongations, '
      + 'les tirs au but, et le troisième sac de pop-corn.',
    mods:{ holdBonus:1.3, holdForgive:4, perfectBonus:1.2, breathBonus:1.15 },
    cri:{ label:'PERSONNE NE PART AVANT LA FIN', gest:'retenue', power:92 } },

  { id:'IM9', nom:'Le Poulet en Caoutchouc', publie:false /* refait OB12 */, type:'voix', set:'IM', stage:1, rar:'commune',
    histoire:'Il a été lancé sur le terrain en 1998. Il n’est jamais reparti, et '
      + 'il a désormais son propre chant.',
    mods:{ tempoWindow:1.12 },
    cri:{ label:'LE CRI DU POULET', gest:'tempo', power:44 } },

  { id:'IM10', nom:'Le Drapeau Perdu', type:'tifo', set:'IM', stage:1, rar:'commune',
    histoire:'Un drapeau d’un club de troisième division d’un autre pays, agité '
      + 'au coin du virage par quelqu’un que personne ne connaît. Il vient à '
      + 'tous les matchs.',
    mods:{ parryBonus:1.55, holdBonus:1.08 },
    cri:{ label:'CE N’EST PAS LE BON', gest:'tifo', power:60 } },

  { id:'IM11', nom:'Le Marteau-Piqueur', type:'perc', set:'IM', stage:1, rar:'commune',
    histoire:'Le chantier du parvis n’a jamais fini et il travaille aussi le '
      + 'samedi. À la trente-huitième minute, il est tombé pile sur le tempo '
      + 'du virage, et deux mille personnes ont chanté avec lui.',
    mods:{ mashBonus:1.08 },
    cri:{ label:'TAC TAC TAC', gest:'mash', power:47 } },

  { id:'IM12', nom:'Le Nain de Jardin', publie:false /* refait OB11 */, type:'fide', set:'IM', stage:1, rar:'commune',
    histoire:'Volé dans un jardin en 1987, emmené à tous les déplacements depuis. '
      + 'Il a vu plus de stades que la plupart des abonnés.',
    mods:{ holdBonus:1.07, refundBonus:1.15 },
    cri:{ label:'TOUJOURS LÀ', gest:'tenue', power:46 } },

  { id:'IM13', nom:'Le Capybara Serein', publie:false /* refait BG19 */, type:'fide', set:'IM', stage:1, rar:'commune',
    histoire:'Rien ne l’atteint. Ni le penalty refusé, ni le rouge à la '
      + 'quatre-vingt-douzième. Il est le seul à sortir reposé.',
    mods:{ holdBonus:1.18, holdForgive:2, breathBonus:1.12 },
    cri:{ label:'TOUT VA BIEN', gest:'tenue', power:58 } },

  { id:'IM14', nom:'Le Pigeon à la Frite', publie:false /* refait BG2 */, type:'depl', set:'IM', stage:1, rar:'commune',
    histoire:'Il connaît les horaires de tous les matchs de la ville. Il ne vient '
      + 'pas pour le football.',
    mods:{ refundBonus:1.3, breathBonus:1.04 },
    cri:{ label:'C’EST TOMBÉ', gest:'echarpe', power:45 } },

  { id:'IM15', nom:'Le Téléviseur', publie:false /* refait OB10 */, type:'perc', set:'IM', stage:1, rar:'commune',
    histoire:'Il diffusait les matchs dans un café qui a fermé. Il s’est levé, il '
      + 'a mis une écharpe, et il est venu voir en vrai.',
    mods:{ mashBonus:1.18, mashTime:-500, tempoInterval:30 },
    cri:{ label:'EN DIRECT DU VIRAGE', gest:'mash', power:72 } },

  { id:'IM16', nom:'La Pieuvre à Lunettes', publie:false /* refait BG18 */, type:'perc', set:'IM', stage:1, rar:'legendaire',
    histoire:'Huit bras, huit maillets, un seul tempo. Elle a mis trois saisons à '
      + 'trouver des lunettes à sa taille.',
    mods:{ mashBonus:1.35, mashTime:-900, breathBonus:1.08 },
    cri:{ label:'LES HUIT EN MÊME TEMPS', gest:'mash', power:84 } },

  { id:'IM17', nom:'Le Touriste d’Ailleurs', publie:false /* refait EP15 */, type:'depl', set:'IM', stage:1, rar:'legendaire',
    histoire:'Il a traversé la galaxie pour un match de milieu de tableau. Il a '
      + 'pris un hot-dog et il trouve que ça valait le voyage.',
    mods:{ breathBonus:1.25, refundBonus:1.6, parryBonus:1.2 },
    cri:{ label:'ON N’A PAS ÇA CHEZ NOUS', gest:'memoire', power:80 } },
];

/**
 * Taux de tirage des deux places d'un booster qui rendent un supporter.
 *
 * Ces deux places étaient « les deux dernières », et ce commentaire le disait
 * encore alors que les trois dernières places étaient devenues des places
 * ouvertes, qui ne rendent jamais de supporter. Les deux tables roulaient donc
 * sur des cartes toujours jetées, et aucune légendaire ne sortait plus d'un
 * booster. Elles s'appliquent maintenant aux deux premières places, qui sont
 * celles que le joueur reçoit — voir `drawPack`.
 *
 * **Un booster ne propose que des communes et des légendaires.** Depuis que la
 * rareté suit le stade, une rare est un stade 2 et une épique un stade 3 : les
 * tirer contournerait les cent quinze écharpes qu'elles coûtent, et
 * l'évolution ne servirait plus à rien. Le booster donne les personnages, les
 * doublons donnent les écharpes, les écharpes font grandir les personnages.
 *
 * Ces deux places ne sont donc pas « meilleures » : elles sont seulement les
 * seules qui peuvent tomber sur une légendaire.
 */
const RATES = {
  4: [['commune',.95],['legendaire',.05]],
  5: [['commune',.85],['legendaire',.15]],
};

/* ------------------------------------------------- le lot de septembre 2026

   Cent vingt-six cartes en six séries, dans `dex-2026.js`. Elles sont
   concaténées ici plutôt qu'écrites à la suite : ces deux fichiers ne servent
   plus qu'à **amorcer** la base, et garder le lot d'origine séparé du lot
   suivant dit lequel est lequel. Mélangés, on n'oserait plus toucher ni à
   l'un ni à l'autre.

   L'amorçage écrit en `INSERT IGNORE` : ajouter une série ici ne réécrit
   jamais ce que l'administration a modifié depuis.                        */

/* ------------------------------------------------- les deuxième et troisième âges

   Ils ne sont pas écrits en entier : seuls leur nom, leur histoire et leur cri
   le sont, dans `dex-ages.js`. Le reste — modificateurs, puissance, rareté,
   chaînage — se déduit du premier âge par les règles de `ages.js`.

   C'est délibéré. Quatre cent trente-cinq cartes réglées une par une, ce sont
   quatre cent trente-cinq occasions de se tromper et aucun moyen de rattraper
   l'ensemble le jour où l'échelle bouge. Ici, changer la progression est une
   ligne, et elle s'applique partout d'un coup.

   Le premier âge, lui, reste écrit à la main : c'est lui qui porte l'idée du
   personnage, et une idée ne se déduit de rien.                            */

/* `DEX_SAISON` porte ses trois âges écrits à la main, comme LA TRIBUNE le
   fait pour ses lignées les plus anciennes : ses entrées de stade 2 et 3
   arrivent donc par ici et non par `AGES`. Les deux façons coexistent, et la
   boucle plus bas refuse justement de les mélanger sur une même carte. */
const PREMIERS = [...DEX, ...DEX_2026, ...DEX_LEGENDES, ...DEX_NEUVES, ...DEX_SAISON];
const PREMIER_PAR_ID = new Map(PREMIERS.map((f) => [f.id, f]));

const SUITES = [];
for (const [id, ecrits] of Object.entries(AGES)) {
  const base = PREMIER_PAR_ID.get(id);
  // Un âge écrit pour une carte qui n'existe pas est une faute de frappe, et
  // elle serait invisible : la lignée manquerait sans que rien ne le dise.
  if (!base) {
    throw new Error(`dex-ages.js décrit les âges de « ${id} », qui n'est pas au `
      + 'catalogue. Vérifie l’identifiant, ou retire l’entrée.');
  }
  if (base.evo) {
    throw new Error(`« ${id} » a déjà une suite écrite à la main (${base.evo}) et une `
      + 'entrée dans dex-ages.js. Les deux se contrediraient : garde-en une.');
  }
  /* Une légendaire n'a pas de lignée — c'est sa définition même, et c'est ce
     qui la rend désirable : elle ne se fabrique pas à l'écharpe, elle se tire.
     Lui écrire des âges la ferait redescendre en « rare » puis « épique » au
     premier passage, et le joueur qui l'a sortie d'un booster verrait sa carte
     la plus précieuse se déclasser toute seule.

     Ce contrôle a servi dès le premier jour : « La Fanfare à Elle Seule » avait
     reçu deux âges par mégarde. */
  if (base.rar === 'legendaire') {
    throw new Error(`« ${id} » (${base.nom}) est légendaire : elle n'a pas de lignée. `
      + 'Une légendaire se tire, elle ne se fait pas évoluer — lui donner des âges '
      + 'la déclasserait en rare. Retire son entrée de dex-ages.js.');
  }
  base.evo = idDuStade(id, 2);
  SUITES.push(...agesDe(base, ecrits));
}

const TOUT = [...PREMIERS, ...SUITES];
/* La série de la saison arrive en dernier : elle s'affiche donc en dernier au
   classeur, ce qui est sa place — c'est la plus récente, et les onglets
   suivent l'ordre de cette liste.

   Elle est **fermée** tant qu'aucune saison ne l'ouvre : les séries ouvertes
   sont l'union des saisons lancées. Ses trente-sept cartes sont donc au
   catalogue, visibles, et marquées comme telles — le classeur montre les
   séries fermées plutôt que de les taire, pour qu'on sache ce qui vient. */
const TOUS_SETS = [...SETS, ...SETS_2026, ...SETS_NEUVES, SET_SAISON];

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
