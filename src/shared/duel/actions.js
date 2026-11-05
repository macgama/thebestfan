/**
 * Les cartes d'action.
 *
 * Elles ne servent pas à faire des dégâts — la poussée vient des chants. Elles
 * servent à changer les règles pendant quelques secondes, et c'est de là que
 * vient la profondeur : deux tribunes qui poussent pareil se départagent sur
 * le moment où elles jouent leurs cartes.
 *
 * Sept familles de mécaniques, pour qu'aucun deck ne se joue comme un autre :
 *
 *   pousse    — un gain immédiat, sans geste
 *   entrave   — gêne l'adversaire sans lui retirer le contrôle
 *   souffle   — déplace la ressource plutôt que la corde
 *   geste     — modifie le mini-jeu lui-même, pour soi ou contre l'autre
 *   garde     — absorbe ou renvoie
 *   collectif — ne vaut que si les coéquipiers suivent : le cœur du NvN
 *   bascule   — ne se joue que dans une situation précise
 *
 * Chaque carte a un coût en souffle, un délai de réutilisation, et beaucoup
 * ont un revers. Une carte sans revers finit toujours par être la seule jouée.
 */
import { reglage } from '../reglages.js';
import { refusLegendes, seuilLegende } from '../legende.js';


export const ACTIONS = [
  /* ------------------------------------------------------------- pousse */
  { id: 'a-fumigene', nom: 'Fumigène', fam: 'pousse', rar: 'commune', cost: 20, cd: 8,
    texte: 'Une poussée immédiate, sans geste à réussir.',
    effet: { type: 'push', valeur: 22 } },

  { id: 'a-craquage', nom: 'Craquage', fam: 'pousse', rar: 'rare', cost: 34, cd: 16,
    texte: 'Grosse poussée, mais ton souffle revient deux fois moins vite pendant 6 s.',
    effet: { type: 'push', valeur: 48 }, revers: { type: 'breath_mult', valeur: 0.5, duree: 6000 } },

  { id: 'a-torche', nom: 'Torche', fam: 'pousse', rar: 'commune', cost: 26, cd: 12,
    texte: 'Poussée moyenne. Double si ta tribune est en train de reculer.',
    effet: { type: 'push', valeur: 26, doubleSiMene: true } },

  /* ------------------------------------------------------------ entrave */
  { id: 'a-silence', nom: 'Silence radio', fam: 'entrave', rar: 'rare', cost: 30, cd: 20,
    texte: 'Coupe le souffle adverse 4 s. Leur colère monte pendant ce temps.',
    effet: { type: 'silence', duree: 4000 } },

  { id: 'a-brouillard', nom: 'Brouillard', fam: 'entrave', rar: 'rare', cost: 26, cd: 18,
    texte: 'Cache les cartes de l\u2019adversaire pendant 6 s. Il joue à l\u2019aveugle.',
    effet: { type: 'blind', duree: 6000 } },

  { id: 'a-parcage', nom: 'Parcage fermé', fam: 'entrave', rar: 'epique', cost: 38, cd: 26,
    texte: 'L\u2019adversaire ne peut plus jouer de carte d\u2019action pendant 8 s.',
    effet: { type: 'lock_actions', duree: 8000 } },

  /* ------------------------------------------------------------ souffle */
  { id: 'a-vol', nom: 'Vol de souffle', fam: 'souffle', rar: 'rare', cost: 22, cd: 14,
    texte: 'Prend 25 de souffle à l\u2019adversaire, t\u2019en rend 15.',
    effet: { type: 'steal', valeur: 25, rendu: 0.6 } },

  { id: 'a-thermos', nom: 'Thermos', fam: 'souffle', rar: 'commune', cost: 12, cd: 18,
    texte: 'Rend la moitié de ton souffle manquant.',
    effet: { type: 'refill', part: 0.5 } },

  { id: 'a-collecte', nom: 'Collecte', fam: 'souffle', rar: 'epique', cost: 30, cd: 30,
    texte: 'Rend 20 de souffle à toute ta tribune, toi compris.',
    effet: { type: 'team_breath', valeur: 20 } },

  /* -------------------------------------------------------------- geste */
  { id: 'a-metronome', nom: 'Métronome', fam: 'geste', rar: 'rare', cost: 24, cd: 20,
    texte: 'Tes deux prochains chants ont une fenêtre de tempo deux fois plus large.',
    effet: { type: 'mod_self', mods: { tempoWindow: 2 }, charges: 2 } },

  { id: 'a-vent', nom: 'Vent de face', fam: 'geste', rar: 'epique', cost: 32, cd: 24,
    texte: 'Rétrécit d\u2019un tiers la fenêtre de tempo adverse pendant 10 s.',
    effet: { type: 'mod_foe', mods: { tempoWindow: 0.66 }, duree: 10000 } },

  { id: 'a-secondsouffle', nom: 'Second souffle', fam: 'geste', rar: 'rare', cost: 28, cd: 22,
    texte: 'Ton prochain geste raté compte comme moyen au lieu de zéro.',
    effet: { type: 'floor_quality', valeur: 0.5, charges: 1 } },

  /* -------------------------------------------------------------- garde */
  { id: 'a-bache', nom: 'Bâche', fam: 'garde', rar: 'commune', cost: 24, cd: 15,
    texte: 'Absorbe la prochaine poussée adverse, jusqu\u2019à 40.',
    effet: { type: 'shield', valeur: 40 } },

  { id: 'a-miroir', nom: 'Renvoi', fam: 'garde', rar: 'legendaire', cost: 40, cd: 40,
    texte: 'La prochaine carte d\u2019action adverse se retourne contre elle.',
    effet: { type: 'reflect', charges: 1 } },

  /* ---------------------------------------------------------- collectif */
  { id: 'a-appel', nom: 'Appel du capo', fam: 'collectif', rar: 'rare', cost: 26, cd: 25,
    texte: 'Ouvre une fenêtre de 5 s : chaque coéquipier qui chante dedans pousse +40 %.',
    effet: { type: 'rally', duree: 5000, bonus: 1.4 } },

  { id: 'a-mosaique', nom: 'Mosaïque', fam: 'collectif', rar: 'epique', cost: 34, cd: 30,
    texte: 'Ne fait rien seul. Poussée de 18 par coéquipier ayant chanté dans les 10 s.',
    effet: { type: 'per_mate', valeur: 18, fenetre: 10000 } },

  { id: 'a-choeur', nom: 'Chœur', fam: 'collectif', rar: 'legendaire', cost: 30, cd: 45,
    texte: 'Toute la tribune doit taper dans la même seconde. Décuplé si tout le monde suit.',
    effet: { type: 'sync', duree: 3000, max: 10 } },

  /* ----------------------------------------------------------- bascule */
  { id: 'a-remontada', nom: 'Remontada', fam: 'bascule', rar: 'epique', cost: 30, cd: 60,
    texte: 'Jouable seulement si tu es mené d\u2019au moins un but. Grosse poussée.',
    effet: { type: 'push', valeur: 70 }, condition: { mene: 1 } },

  { id: 'a-arbitre', nom: 'Arbitre — changement', fam: 'bascule', rar: 'commune', cost: 18, cd: 20,
    texte: 'Fait entrer un autre Fanzzy de ton deck. Son équipement le suit.',
    effet: { type: 'swap_fanzzy' } },

  /**
   * La Relève : le personnage grandit en pleine partie.
   *
   * Tout le monde entre au premier âge — c'est la règle du deck. Ce que les
   * écharpes ont acheté, ce n'est pas un avantage acquis au coup d'envoi, c'est
   * le **droit de jouer cette carte**. Deux tribunes se rencontrent au même
   * niveau et l'écart se creuse sur ce qu'on joue.
   *
   * **Son vrai coût est ailleurs que dans le souffle.** Un joueur qui veut
   * faire grandir ses trois Fanzzy doit en embarquer trois exemplaires : trente
   * pour cent d'un deck en cartes qui ne poussent pas, ne gênent pas et ne
   * protègent pas. En face, celui qui n'a rien débloqué joue dix cartes d'effet
   * pur. L'arbitrage s'équilibre seul, sans table de réglage — et c'est ce qui
   * empêche la carte d'être un simple retard de vingt secondes sur la victoire
   * du joueur le plus riche.
   *
   * Commune, donc offerte : posséder la carte n'est pas une seconde barrière.
   * La seule barrière est d'avoir fait grandir le personnage.
   *
   * Un cran par carte. Atteindre le troisième âge en duel coûte donc deux
   * emplacements et deux moments de jeu : la montée en puissance se voit, et
   * elle pèse dans la construction du deck.
   */
  { id: 'a-releve', nom: 'Relève', fam: 'bascule', rar: 'commune', cost: 30, cd: 30,
    texte: 'Ton Fanzzy en tribune passe à son âge suivant, si tu l’as débloqué. '
      + 'Son équipement le suit.',
    effet: { type: 'evolve' }, condition: { evolution: true } },

  /* -------------------------------------------------- la main elle-même

     Aucune carte ne touchait à la pioche. C'était un axe entier absent : le
     deck n'était pas une ressource qu'on pilote, c'était une file d'attente
     qu'on subit. Ces deux-là répondent aux deux seules raisons pour
     lesquelles on reste bloqué — une main qui ne sert à rien, et des cartes
     qui se rechargent toutes en même temps. */

  { id: 'a-relais', nom: 'Changement de chant', fam: 'souffle', rar: 'rare', cost: 20, cd: 35,
    texte: 'Défausse ta main et reprends-en cinq. Ce que tu jettes revient dans la pioche.',
    effet: { type: 'refill_hand' } },

  { id: 'a-souffleneuf', nom: 'Nouveau souffle', fam: 'souffle', rar: 'legendaire', cost: 38, cd: 75,
    texte: 'Toutes tes cartes redeviennent jouables sur-le-champ : plus aucune recharge.',
    effet: { type: 'clear_cooldowns' } },

  /* Le différé. Tout le reste du jeu est instantané, donc rien n'est
     anticipable — et sans anticipation il n'y a pas d'interaction, seulement
     des nombres qui s'additionnent. Celle-ci s'annonce et frappe plus tard :
     l'adversaire la voit venir et a le temps de sortir sa Bâche. */
  { id: 'a-tifo', nom: 'Tifo', fam: 'pousse', rar: 'epique', cost: 26, cd: 40,
    texte: 'Se déplie pendant 8 s — tout le monde le voit — puis pousse très fort.',
    effet: { type: 'delayed_push', valeur: 95, delai: 8000 } },

  { id: 'a-prolongations', nom: 'Prolongations', fam: 'bascule', rar: 'legendaire', cost: 45, cd: 90,
    texte: 'Après la 75e minute du vrai match seulement. Double ta poussée pendant 15 s.',
    effet: { type: 'mod_self', mods: { pushMult: 2 }, duree: 15000 },
    condition: { minuteReelle: 75 } },

  /* ================================================= les cinq de septembre 2026

     **Chacune apporte une mécanique que rien d'autre ne faisait.** Les
     vingt-quatre cartes d'origine se partageaient vingt et un types d'effet :
     en ajouter cinq qui recombinent les mêmes verbes aurait donné cinq cartes
     qu'on reconnaît en une partie et qu'on cesse de lire à la deuxième.

     Elles ont donc chacune leur branche dans le moteur, et elles touchent
     chacune à une chose qui n'était touchée par personne : la décroissance de
     la corde, le prix des cartes, le pari sur son propre geste, la poussée
     étalée dans le temps, et l'écart lui-même.                               */

  { id: 'a-ancre', nom: 'L’Ancre', fam: 'garde', rar: 'rare', cost: 28, cd: 35,
    texte: 'La corde cesse de retomber pendant 8 s, pour les deux tribunes.',
    /* La seule carte qui touche à la décroissance. Elle ne pousse pas, elle
       garde : une tribune qui mène et qui tient huit secondes de plus gagne
       autant qu'avec une grosse poussée, sans avoir eu à réussir un geste.
       Elle gèle **pour tout le monde**, parce que la corde est commune — et
       c'est ce qui la rend mauvaise quand on est mené. */
    effet: { type: 'freeze_decay', duree: 8000 } },

  { id: 'a-mise', nom: 'La Mise', fam: 'geste', rar: 'rare', cost: 16, cd: 22,
    texte: 'Ton prochain chant compte double. S’il est raté, il te coûte 20 de souffle.',
    /* Le seul pari du paquet. Toutes les autres cartes sont des gains plus ou
       moins gros ; un deck sans aucun risque se joue sans réfléchir. Le seuil
       est à la moitié — un geste moyen suffit, il n'y a pas de piège. */
    effet: { type: 'double_next', duree: 20_000, gage: 20 } },

  { id: 'a-tournee', nom: 'La Tournée', fam: 'souffle', rar: 'epique', cost: 22, cd: 40,
    texte: 'Tes deux prochaines cartes ne coûtent rien.',
    /* Elle ne donne pas de souffle — la Collecte le fait déjà — elle permet de
       jouer ce qu'on n'a pas les moyens de jouer. Deux cartes chères coup sur
       coup, ce qu'aucune réserve de souffle ne permet. */
    effet: { type: 'cost_free', cartes: 2, duree: 20_000 } },

  { id: 'a-longchant', nom: 'Le Long Chant', fam: 'pousse', rar: 'commune', cost: 24, cd: 18,
    texte: 'Pousse un peu, dix fois de suite, pendant dix secondes.',
    /* L'inverse exact du Tifo : celui-ci frappe une fois, très fort, plus tard,
       et se fait bâcher. Celui-là passe sous la Bâche, qui n'absorbe qu'un
       coup — mais la décroissance mange chacune de ses dix miettes. Deux façons
       opposées de miser sur le temps. */
    effet: { type: 'push_over_time', valeur: 70, coups: 10, duree: 10_000 } },

  { id: 'a-retournement', nom: 'Le Retournement', fam: 'bascule', rar: 'legendaire',
    cost: 42, cd: 80,
    texte: 'Efface la moitié de l’avance adverse. Ne se joue que si tu es mené.',
    /* Elle ne renverse pas la corde : une carte qui échangerait les positions
       ferait perdre une partie gagnée à celui qui a bien joué. Elle efface la
       moitié du travail adverse, ce qui est déjà la chose la plus violente du
       paquet — d'où le prix, la recharge de quatre-vingts secondes, et la
       condition. */
    effet: { type: 'halve_gap' } },

  /* =========================================== LA REPRISE (10)

     ## Ce qu'une saison doit ajouter, et ce qu'elle ne doit pas ajouter

     Dix cartes de plus, et **aucun verbe de plus**. Chacune se résout avec un
     type d'effet que le moteur sait déjà faire : `push_over_time`, `mod_foe`,
     `shield`, `rally`… C'est délibéré. Une carte qui demanderait une mécanique
     neuve demanderait aussi un moteur neuf, des contrôles neufs et un client
     neuf — et le jour où l'un des trois manque, la carte existe dans le
     catalogue, se tire dans un booster, et ne fait rien.

     Ce qui est neuf, ce sont les **chiffres** et la famille : une poussée qui
     s'installe sur seize secondes ne se joue pas comme une qui tombe d'un coup,
     même si le moteur les traite pareil.

     ## Aucune n'est meilleure que celle d'à côté

     C'est la règle qui tient ce fichier : chaque carte neuve qui ressemble à
     une ancienne **paie sa différence**. « Bâche neuve » protège presque du
     double de « Bâche », et coûte un tiers de plus pour une recharge deux fois
     plus longue. « Routine d'avant-match » relève un raté plus haut que « Second
     souffle », et se paie six de plus avec huit secondes d'attente en plus.
     Une carte strictement meilleure qu'une autre retire la plus faible du jeu
     sans jamais l'avouer.

     ## L'équilibre des familles

     Les sept familles comptaient 5 / 3 / 6 / 4 / 3 / 3 / 5. Les dix vont là où
     c'était le plus mince — entrave, garde, collectif, geste — parce qu'une
     famille à trois cartes se joue toujours de la même façon.                 */

  /* ------------------------------------------------------------- pousse */
  { id: 'a-rp-coupdenvoi', nom: 'Coup d’envoi', fam: 'pousse', rar: 'commune', cost: 18, cd: 22,
    texte: 'Un chant qui s’installe : seize petites poussées sur seize secondes.',
    /* L'inverse du fumigène. Rien ne se voit à l'instant où on la joue, et elle
       pèse plus lourd que lui au total — à condition de tenir seize secondes,
       ce qui est précisément ce qu'une reprise ne sait pas encore faire. */
    effet: { type: 'push_over_time', valeur: 80, coups: 16, duree: 16000 } },

  /* ------------------------------------------------------------ entrave */
  { id: 'a-rp-rouille', nom: 'Rouille', fam: 'entrave', rar: 'rare', cost: 28, cd: 22,
    texte: 'Deux mois sans chanter : pendant 9 s, les gestes parfaits de l’adversaire ne valent plus rien de plus.',
    /* Elle ne coupe rien et ne cache rien : elle retire la **récompense** du
       bien-jouer. C'est l'entrave la plus cruelle du jeu contre quelqu'un qui
       joue bien, et la plus inutile contre quelqu'un qui joue mal. */
    effet: { type: 'mod_foe', mods: { perfectBonus: 0.7 }, duree: 9000 } },

  { id: 'a-rp-horsjeu', nom: 'Hors-jeu', fam: 'entrave', rar: 'commune', cost: 22, cd: 30,
    texte: 'Le drapeau se lève. L’adversaire ne peut plus jouer de carte pendant 4 s.',
    /* Le parcage du pauvre : moitié moins long, moitié moins cher, et commune.
       Elle existe pour que la famille entrave ne commence pas à trente. */
    effet: { type: 'lock_actions', duree: 4000 } },

  /* -------------------------------------------------------------- geste */
  { id: 'a-rp-echauffement', nom: 'Échauffement', fam: 'geste', rar: 'commune', cost: 14, cd: 18,
    texte: 'Trois chants plus faciles à placer, et un peu plus vifs.',
    /* Trois charges au lieu de deux, mais un effet nettement plus doux que le
       métronome : on échauffe, on ne triche pas. */
    effet: { type: 'mod_self', mods: { tempoWindow: 1.35, mashBonus: 1.15 }, charges: 3 } },

  { id: 'a-rp-routine', nom: 'Routine d’avant-match', fam: 'geste', rar: 'rare', cost: 34, cd: 30,
    texte: 'Ton prochain raté comptera comme une bonne réussite. Une seule fois.',
    /* Elle relève plus haut que « Second souffle » — 0,65 contre 0,5 — et se
       paie six de plus avec huit secondes d'attente en plus. Le choix entre les
       deux est un vrai choix, pas une mise à niveau. */
    effet: { type: 'floor_quality', valeur: 0.65, charges: 1 } },

  /* -------------------------------------------------------------- garde */
  { id: 'a-rp-bache-neuve', nom: 'Bâche neuve', fam: 'garde', rar: 'rare', cost: 32, cd: 28,
    texte: 'Absorbe 70 de poussée adverse.',
    /* Presque le double de « Bâche », pour un tiers de coût en plus et une
       recharge deux fois plus longue. On ne la joue pas au même moment. */
    effet: { type: 'shield', valeur: 70 } },

  { id: 'a-rp-filet', nom: 'Filet de chantier', fam: 'garde', rar: 'epique', cost: 30, cd: 32,
    texte: 'Pendant 12 s, les entraves d’en face ne te touchent pas.',
    /* Une garde qui n'absorbe rien : elle protège **les gestes** plutôt que la
       corde. Elle portait `parryResist: 1.8`, une clé qu'aucun moteur ne
       lisait, et ne faisait donc rien ; depuis le 27 octobre 2026, les
       entraves (silence, brouillard, parcage, vent, rouille, hors-jeu) ne
       prennent pas sur toi pendant sa durée. Duel seulement : au Virage,
       personne ne t'entrave. */
    effet: { type: 'immunite', duree: 12000 } },

  /* ---------------------------------------------------------- collectif */
  { id: 'a-rp-presentation', nom: 'Présentation de l’effectif', fam: 'collectif', rar: 'rare', cost: 24, cd: 26,
    texte: '12 de poussée par coéquipier qui chante dans les 12 s.',
    /* La mosaïque à portée d'un deck de début de saison : moins par tête, plus
       de temps pour que les autres suivent. En 1v1 elle ne vaut presque rien,
       et c'est ce qui la garde honnête. */
    effet: { type: 'per_mate', valeur: 12, fenetre: 12000 } },

  { id: 'a-rp-premier-chant', nom: 'Le premier chant de l’année', fam: 'collectif', rar: 'epique', cost: 30, cd: 34,
    texte: 'Pendant 7 s, toute ta tribune pousse 30 % plus fort.',
    /* Plus long que « L'appel », moins puissant. Deux cartes pour la même
       famille et deux façons de s'en servir : un coup de poing, ou une vague. */
    effet: { type: 'rally', duree: 7000, bonus: 1.3 } },

  /* ------------------------------------------------------------ bascule */
  { id: 'a-rp-jour-un', nom: 'Jour Un', fam: 'bascule', rar: 'legendaire', cost: 10, cd: 90,
    texte: 'Jouable seulement si tu es mené d’au moins un but. Rend tout ton souffle.',
    /* La carte de la remise à zéro : rien ne s'est encore joué, tout est à
       refaire. Elle ne pousse pas d'un point — elle rend les moyens de pousser,
       ce qui n'est pas la même chose et ne se joue pas au même moment. Une fois
       et demie par duel au mieux, et seulement quand on perd. */
    effet: { type: 'refill', part: 1 }, condition: { mene: 1 } },

  /* =========================================== LA RELANCE (novembre 2026)

     ## Pourquoi encore des cartes

     Gaël, le 3 novembre 2026 : « les joueurs ont vite reçu toutes les cartes
     possibles ». Le constat se mesure : une carte se possède une fois, les
     communes sont offertes à tous, et le booster ne tirait donc que **vingt-
     neuf** cartes. Toutes possédées, la place « carte d'action » (près d'un
     quart du booster) se repliait sur deux écharpes.

     ## Ce qui est neuf

     Comme LA REPRISE : **aucun verbe de plus**, des chiffres et des familles.
     Les communes donnent du choix à qui débute (elles sont offertes) ; les
     rares et plus regarnissent le booster. Chaque carte qui ressemble à une
     ancienne paie sa différence — même règle qu'au-dessus.                    */

  { id: 'a-petard', nom: 'Pétard', fam: 'pousse', rar: 'commune', cost: 10, cd: 6,
    texte: 'Une petite poussée de 12, presque gratuite.',
    /* La carte qu'on joue tout le temps : moitié du Fumigène, moitié de son
       prix, et une recharge plus courte. Elle remplit les trous du souffle. */
    effet: { type: 'push', valeur: 12 } },

  { id: 'a-banderole', nom: 'Banderole', fam: 'pousse', rar: 'commune', cost: 18, cd: 20,
    texte: 'Se déroule pendant 4 s — tout le monde la voit — puis pousse 50.',
    /* Le petit Tifo : deux fois plus vite déroulée, à peine plus de la moitié
       de sa force. Elle se fait bâcher pareil. */
    effet: { type: 'delayed_push', valeur: 50, delai: 4000 } },

  { id: 'a-sifflets', nom: 'Sifflets', fam: 'entrave', rar: 'commune', cost: 18, cd: 18,
    texte: 'Pendant 6 s, la fenêtre de tempo adverse rétrécit d’un cinquième.',
    effet: { type: 'mod_foe', mods: { tempoWindow: 0.8 }, duree: 6000 } },

  { id: 'a-larsen', nom: 'Larsen', fam: 'entrave', rar: 'commune', cost: 16, cd: 16,
    texte: 'Coupe le souffle adverse 2 s.',
    effet: { type: 'silence', duree: 2000 } },

  { id: 'a-gourde', nom: 'La Gourde', fam: 'souffle', rar: 'commune', cost: 8, cd: 10,
    texte: 'Rend un tiers de ton souffle manquant.',
    effet: { type: 'refill', part: 0.33 } },

  { id: 'a-echarpe-tendue', nom: 'Écharpe tendue', fam: 'garde', rar: 'commune', cost: 14, cd: 12,
    texte: 'Absorbe 25 de poussée adverse.',
    effet: { type: 'shield', valeur: 25 } },

  { id: 'a-ola', nom: 'Ola', fam: 'collectif', rar: 'commune', cost: 16, cd: 20,
    texte: '8 de poussée par coéquipier qui chante dans les 8 s.',
    /* Presque rien en 1v1, et c'est voulu : la commune du Virage. */
    effet: { type: 'per_mate', valeur: 8, fenetre: 8000 } },

  { id: 'a-tambour', nom: 'Tambour', fam: 'collectif', rar: 'commune', cost: 22, cd: 26,
    texte: 'Pendant 10 s, toute ta tribune pousse 20 % plus fort.',
    effet: { type: 'rally', duree: 10000, bonus: 1.2 } },

  { id: 'a-bengale', nom: 'Feu de Bengale', fam: 'pousse', rar: 'rare', cost: 26, cd: 14,
    texte: 'Pousse 34. Ton souffle revient moins vite pendant 4 s.',
    effet: { type: 'push', valeur: 34 }, revers: { type: 'breath_mult', valeur: 0.7, duree: 4000 } },

  { id: 'a-faussenote', nom: 'Fausse note', fam: 'entrave', rar: 'rare', cost: 26, cd: 22,
    texte: 'Pendant 8 s, les frappes rapides de l’adversaire poussent un quart de moins.',
    effet: { type: 'mod_foe', mods: { mashBonus: 0.75 }, duree: 8000 } },

  { id: 'a-coupfranc', nom: 'Coup franc', fam: 'bascule', rar: 'rare', cost: 24, cd: 40,
    texte: 'Jouable seulement si tu es mené d’au moins un but. Pousse 45.',
    /* La petite Remontada : deux tiers de sa poussée, moins chère, deux fois
       plus souvent. */
    effet: { type: 'push', valeur: 45 }, condition: { mene: 1 } },

  { id: 'a-megaphone', nom: 'Mégaphone', fam: 'collectif', rar: 'epique', cost: 32, cd: 30,
    texte: 'Pendant 4 s, toute ta tribune pousse 60 % plus fort.',
    /* Le coup de poing du capo : plus court que l'Appel, beaucoup plus fort. */
    effet: { type: 'rally', duree: 4000, bonus: 1.6 } },

  /* =========================================== LES CARTES DES PASS

     Une série de cartes par PASS, **pour tous** comme les séries de Fanzzy
     et les pièces : fermées (`publie: false`) jusqu'au jour où leur saison se
     lance. Le préfixe (`a-hc-`, `a-mt-`, `a-gd-`, `a-rv-`) est celui que
     `shared/saisons-prevues.js` donne à chaque saison : c'est par lui qu'elle
     sait quelles cartes ouvrir.                                              */

  /* ------------------------------ PASS 1 · LES HÉROS DU CANAPÉ (a-hc-) */
  { id: 'a-hc-pause-pub', nom: 'Pause pub', fam: 'entrave', rar: 'rare', cost: 24, cd: 30, publie: false,
    texte: 'L’adversaire ne joue plus de carte pendant 5 s. Ton souffle revient deux fois moins vite pendant 4 s.',
    effet: { type: 'lock_actions', duree: 5000 }, revers: { type: 'breath_mult', valeur: 0.5, duree: 4000 } },

  { id: 'a-hc-chips', nom: 'Paquet de chips', fam: 'souffle', rar: 'rare', cost: 6, cd: 14, publie: false,
    texte: 'Rend 40 % de ton souffle manquant. Les doigts collent : ton souffle revient moins vite 3 s.',
    effet: { type: 'refill', part: 0.4 }, revers: { type: 'breath_mult', valeur: 0.8, duree: 3000 } },

  { id: 'a-hc-plaid', nom: 'Plaid', fam: 'garde', rar: 'rare', cost: 26, cd: 22, publie: false,
    texte: 'Absorbe 50 de poussée adverse.',
    effet: { type: 'shield', valeur: 50 } },

  { id: 'a-hc-ralenti', nom: 'Ralenti', fam: 'entrave', rar: 'rare', cost: 28, cd: 24, publie: false,
    texte: 'Pendant 7 s, le tempo adverse se serre et ses frappes rapides faiblissent.',
    effet: { type: 'mod_foe', mods: { tempoWindow: 0.8, mashBonus: 0.85 }, duree: 7000 } },

  { id: 'a-hc-reveil', nom: 'Réveil du canapé', fam: 'bascule', rar: 'epique', cost: 28, cd: 50, publie: false,
    texte: 'Jouable seulement si tu es mené d’au moins un but. Ta poussée +50 % pendant 8 s.',
    effet: { type: 'mod_self', mods: { pushMult: 1.5 }, duree: 8000 }, condition: { mene: 1 } },

  /* La tenue des membres du PASS 1 est Préhistorique : ses deux cartes sont
     pour tous, comme le reste de la saison. */
  { id: 'a-hc-massue', nom: 'Massue', fam: 'pousse', rar: 'epique', cost: 38, cd: 20, publie: false,
    texte: 'Pousse 56. Ton souffle revient deux fois moins vite pendant 6 s.',
    effet: { type: 'push', valeur: 56 }, revers: { type: 'breath_mult', valeur: 0.5, duree: 6000 } },

  { id: 'a-hc-feu-camp', nom: 'Feu de camp', fam: 'souffle', rar: 'epique', cost: 26, cd: 30, publie: false,
    texte: 'Rend 16 de souffle à toute ta tribune, toi compris.',
    effet: { type: 'team_breath', valeur: 16 } },

  /* ------------------------------ PASS 2 · LES PHÉNOMÈNES MÉTÉO (a-mt-) */
  { id: 'a-mt-averse', nom: 'Averse', fam: 'entrave', rar: 'rare', cost: 26, cd: 24, publie: false,
    texte: 'Pendant 8 s, la pluie brouille le tempo adverse : fenêtre d’un quart plus étroite.',
    effet: { type: 'mod_foe', mods: { tempoWindow: 0.75 }, duree: 8000 } },

  { id: 'a-mt-eclaircie', nom: 'Éclaircie', fam: 'garde', rar: 'rare', cost: 22, cd: 26, publie: false,
    texte: 'Pendant 6 s, les entraves d’en face ne te touchent pas.',
    effet: { type: 'immunite', duree: 6000 } },

  { id: 'a-mt-grele', nom: 'Grêle', fam: 'pousse', rar: 'rare', cost: 26, cd: 20, publie: false,
    texte: 'Huit poussées en rafale sur 3 s, 56 en tout.',
    effet: { type: 'push_over_time', valeur: 56, coups: 8, duree: 3000 } },

  { id: 'a-mt-vent-arriere', nom: 'Vent arrière', fam: 'geste', rar: 'rare', cost: 22, cd: 24, publie: false,
    texte: 'Pendant 8 s, ta fenêtre de tempo s’élargit de moitié.',
    effet: { type: 'mod_self', mods: { tempoWindow: 1.5 }, duree: 8000 } },

  { id: 'a-mt-orage', nom: 'Orage', fam: 'pousse', rar: 'epique', cost: 36, cd: 45, publie: false,
    texte: 'Gronde pendant 10 s — tout le monde l’entend — puis frappe à 120.',
    effet: { type: 'delayed_push', valeur: 120, delai: 10000 } },

  /* La tenue des membres du PASS 2 est Apocalyptique : ses trois cartes
     (demande de Gaël du 5 novembre 2026) sont pour tous, comme la Massue et
     le Feu de camp du PASS 1. */
  { id: 'a-mt-nitro', nom: 'Bidon de nitro', fam: 'pousse', rar: 'epique', cost: 40, cd: 24, publie: false,
    texte: 'Pousse 66. Ton souffle revient presque à l’arrêt pendant 4 s.',
    effet: { type: 'push', valeur: 66 }, revers: { type: 'breath_mult', valeur: 0.4, duree: 4000 } },

  { id: 'a-mt-tempete-sable', nom: 'Tempête de sable', fam: 'entrave', rar: 'rare', cost: 26, cd: 26, publie: false,
    texte: 'Pendant 7 s, le sable aveugle l’autre tribune : tempo plus étroit, gestes parfaits moins payés.',
    effet: { type: 'mod_foe', mods: { tempoWindow: 0.82, perfectBonus: 0.85 }, duree: 7000 } },

  { id: 'a-mt-tole', nom: 'Tôle soudée', fam: 'garde', rar: 'rare', cost: 30, cd: 24, publie: false,
    texte: 'Absorbe la prochaine poussée adverse, jusqu’à 55.',
    effet: { type: 'shield', valeur: 55 } },

  /* ------------------------------ PASS 3 · LES GALÈRES DE DÉPLACEMENT (a-gd-) */
  { id: 'a-gd-car', nom: 'Car de supporters', fam: 'collectif', rar: 'epique', cost: 36, cd: 32, publie: false,
    texte: '22 de poussée par coéquipier qui chante dans les 6 s.',
    effet: { type: 'per_mate', valeur: 22, fenetre: 6000 } },

  { id: 'a-gd-aire', nom: 'Aire d’autoroute', fam: 'souffle', rar: 'rare', cost: 16, cd: 28, publie: false,
    texte: 'Rend les deux tiers de ton souffle manquant.',
    effet: { type: 'refill', part: 0.65 } },

  { id: 'a-gd-train-retard', nom: 'Train en retard', fam: 'pousse', rar: 'rare', cost: 20, cd: 30, publie: false,
    texte: 'Arrive dans 12 s — tout le monde l’attend — et pousse 70.',
    effet: { type: 'delayed_push', valeur: 70, delai: 12000 } },

  /* ------------------------------ PASS 4 · LES REVENANTS (a-rv-) */
  { id: 'a-rv-frisson', nom: 'Frisson', fam: 'entrave', rar: 'rare', cost: 24, cd: 22, publie: false,
    texte: 'Pendant 8 s, les gestes parfaits adverses valent moins et son tempo se serre.',
    effet: { type: 'mod_foe', mods: { perfectBonus: 0.8, tempoWindow: 0.9 }, duree: 8000 } },

  { id: 'a-rv-brume', nom: 'Brume du cimetière', fam: 'entrave', rar: 'epique', cost: 30, cd: 26, publie: false,
    texte: 'Cache les cartes de l’adversaire pendant 8 s. Ton souffle revient moins vite 5 s.',
    effet: { type: 'blind', duree: 8000 }, revers: { type: 'breath_mult', valeur: 0.7, duree: 5000 } },

  { id: 'a-rv-outre-tombe', nom: 'Retour d’outre-tombe', fam: 'bascule', rar: 'legendaire', cost: 40, cd: 90, publie: false,
    texte: 'Jouable seulement si tu es mené d’au moins deux buts. Pousse 100.',
    effet: { type: 'push', valeur: 100 }, condition: { mene: 2 } },

  /* =========================================== LE VRAI MATCH (novembre 2026)

     Elles ne se jouent que pendant un vrai match, au moment qu'elles disent :
     voir `conditionReelleRemplie` plus bas. Hors match (un entraînement, un
     match pas commencé), elles restent en main sans pouvoir partir.          */

  { id: 'a-mitemps', nom: 'Mi-temps', fam: 'souffle', rar: 'rare', cost: 10, cd: 60,
    texte: 'Entre la 40e et la 50e minute du vrai match, ou à la mi-temps. Rend tout ton souffle.',
    effet: { type: 'refill', part: 1 }, condition: { minuteEntre: [40, 50] } },

  { id: 'a-but-au-stade', nom: 'But au stade !', fam: 'pousse', rar: 'epique', cost: 24, cd: 60,
    texte: 'Dans les 2 minutes après un vrai but de ton club. Pousse 80.',
    effet: { type: 'push', valeur: 80 }, condition: { butRecent: 120_000 } },

  { id: 'a-carton-rouge', nom: 'Carton rouge', fam: 'collectif', rar: 'epique', cost: 26, cd: 60,
    texte: 'Dans les 5 minutes après un vrai carton rouge contre le club d’en face. Toute ta tribune pousse 40 % plus fort pendant 8 s.',
    /* Une carte de tribune, pas une entrave : elle se joue aussi au Virage,
       où le carton rouge arrive par le fil du match. */
    effet: { type: 'rally', duree: 8000, bonus: 1.4 }, condition: { rougeAdverse: 300_000 } },

  { id: 'a-coup-sifflet', nom: 'Coup de sifflet', fam: 'bascule', rar: 'rare', cost: 20, cd: 60,
    texte: 'Pendant les 10 premières minutes du vrai match. Toutes tes cartes redeviennent jouables.',
    effet: { type: 'clear_cooldowns' }, condition: { minuteMax: 10 } },

  { id: 'a-temps-additionnel', nom: 'Temps additionnel', fam: 'bascule', rar: 'epique', cost: 30, cd: 60,
    texte: 'Après la 90e minute du vrai match. Ta poussée +50 % pendant 10 s.',
    effet: { type: 'mod_self', mods: { pushMult: 1.5 }, duree: 10000 },
    condition: { minuteReelle: 90 } },

  /* =========================================== LES MÉCANIQUES NEUVES (novembre 2026)

     Gaël, 3 novembre 2026 : « Ok pour les nouvelles mécaniques ». Celles-ci
     ont chacune leur branche dans les moteurs : la main de l'adversaire, sa
     dernière carte, un piège posé d'avance, une série de gestes parfaits, la
     taille de sa main, la vitesse des recharges, la place de la tribune.   */

  { id: 'a-chambrage', nom: 'Chambrage', fam: 'entrave', rar: 'rare', cost: 24, cd: 30,
    texte: 'Prend la dernière carte jouée par l’adversaire : elle arrive dans ta main, pour une fois.',
    effet: { type: 'steal_card' } },

  { id: 'a-echo', nom: 'Écho', fam: 'souffle', rar: 'rare', cost: 18, cd: 35,
    texte: 'Rejoue ta dernière carte, sans la payer. Pas une légendaire, ni une carte à condition.',
    effet: { type: 'replay_last' } },

  { id: 'a-piege', nom: 'Piège à la buvette', fam: 'garde', rar: 'epique', cost: 26, cd: 30,
    texte: 'Posé face cachée : la prochaine carte de poussée adverse est perdue, sans effet.',
    effet: { type: 'trap', charges: 1 } },

  { id: 'a-tribune-chaude', nom: 'Tribune chaude', fam: 'geste', rar: 'epique', cost: 26, cd: 35,
    texte: 'Pendant 15 s, chaque chant parfait d’affilée pousse 10 % de plus, jusqu’à +50 %. Un raté remet à zéro.',
    effet: { type: 'streak', duree: 15000, pas: 0.1, max: 0.5 } },

  { id: 'a-recrue', nom: 'Recrue', fam: 'souffle', rar: 'commune', cost: 12, cd: 30,
    texte: 'Ta main passe de 5 à 6 cartes pendant 15 s.',
    effet: { type: 'extra_hand', cartes: 1, duree: 15000 } },

  { id: 'a-sangfroid', nom: 'Sang-froid', fam: 'souffle', rar: 'rare', cost: 20, cd: 35,
    texte: 'Pendant 10 s, les cartes que tu joues se rechargent deux fois plus vite.',
    effet: { type: 'cooldown_mult', valeur: 0.5, duree: 10000 } },

  { id: 'a-domicile', nom: 'À domicile', fam: 'bascule', rar: 'rare', cost: 24, cd: 40,
    texte: 'Seulement pour la tribune du club qui reçoit. Pousse 45.',
    effet: { type: 'push', valeur: 45 }, condition: { domicile: true } },

  { id: 'a-maillot', nom: 'Maillot du club', fam: 'pousse', rar: 'rare', cost: 22, cd: 16,
    texte: 'Pousse 24, le double si ton Fanzzy en tribune est du club de ta tribune.',
    effet: { type: 'push', valeur: 24, doubleSiClub: true } },

  { id: 'a-kop-plein', nom: 'Kop plein', fam: 'collectif', rar: 'legendaire', cost: 34, cd: 60,
    texte: '14 de poussée par supporter de ta tribune, toi compris, jusqu’à 150.',
    /* Comme la Mosaïque, mais tout le monde compte, pas seulement ceux qui
       viennent de chanter : la carte d'une tribune pleine. */
    effet: { type: 'per_present', valeur: 14, max: 150 } },

  /* Les mécaniques neuves des PASS. */
  { id: 'a-hc-telecommande', nom: 'Télécommande', fam: 'entrave', rar: 'rare', cost: 22, cd: 28, publie: false,
    texte: 'L’adversaire zappe : sa main repart dans sa pioche, il en reprend une autre.',
    effet: { type: 'shuffle_foe' } },

  { id: 'a-gd-peage', nom: 'Péage', fam: 'entrave', rar: 'rare', cost: 24, cd: 26, publie: false,
    texte: 'Pendant 8 s, les cartes de l’adversaire coûtent moitié plus de souffle.',
    effet: { type: 'cost_mult', valeur: 1.5, duree: 8000 } },

  { id: 'a-gd-parcage-visiteur', nom: 'Parcage visiteur', fam: 'garde', rar: 'rare', cost: 24, cd: 22, publie: false,
    texte: 'Absorbe 40 de poussée adverse, 60 si ta tribune joue à l’extérieur.',
    effet: { type: 'shield', valeur: 40, bonusExterieur: 1.5 } },

  { id: 'a-rv-fantome', nom: 'Fantôme', fam: 'pousse', rar: 'epique', cost: 28, cd: 25, publie: false,
    texte: 'Pousse 40, puis revient une fois dans ta main.',
    effet: { type: 'push', valeur: 40 }, revient: true },

  { id: 'a-rv-malediction', nom: 'Malédiction', fam: 'entrave', rar: 'rare', cost: 24, cd: 30, publie: false,
    texte: 'Le prochain chant parfait de l’adversaire ne compte que comme moyen.',
    effet: { type: 'curse', charges: 1 } },
];

export const ACTION_BY_ID = new Map(ACTIONS.map((a) => [a.id, a]));

/* ------------------------------------------- les conditions du vrai match

   **Les cartes qui bougent avec le vrai match** (Gaël, 3 novembre 2026,
   « Ok pour les cartes vrai match »). Jusqu'ici une seule le faisait — les
   Prolongations, après la 75e. Celles-ci lisent la mi-temps, les premières
   minutes, un vrai but de son club, un vrai carton rouge en face.

   Les deux moteurs (duel et Virage) décrivent le vrai match de la même façon
   et posent la même question ici : une seule règle, qui ne peut pas diverger
   d'un mode à l'autre.

   `r` : { minute, statut, depuisBut, depuisRouge }
     minute       la minute du vrai match, ou null (pas de match, entraînement)
     statut       le statut court de l'API (1H, HT, 2H…), ou null
     depuisBut    ms depuis le dernier vrai but **du club de ce camp**, ou null
     depuisRouge  ms depuis le dernier vrai carton rouge **du club d'en face**,
                  ou null                                                        */

/** Les statuts où le ballon roule (la mi-temps n'en est pas). */
export const STATUTS_EN_JEU = new Set(['1H', '2H', 'ET', 'P', 'LIVE']);

/** Une carte demande-t-elle le vrai match ? (pour l'aide et les écrans) */
export const CONDITIONS_REELLES = ['minuteEntre', 'minuteMax', 'butRecent', 'rougeAdverse'];

/**
 * Les conditions « vrai match » d'une carte sont-elles remplies ?
 * Ne lit que les clés de `CONDITIONS_REELLES` : le reste (mené, minute
 * minimale, Relève) reste aux moteurs, qui le lisaient déjà.
 */
export function conditionReelleRemplie(c = {}, r = {}) {
  const { minute = null, statut = null, depuisBut = null, depuisRouge = null } = r;
  if (c.minuteEntre) {
    const [de, a] = c.minuteEntre;
    const mi = statut === 'HT';
    if (!mi && !(minute != null && minute >= de && minute <= a)) return false;
  }
  if (c.minuteMax != null) {
    // Le match doit avoir commencé : sans statut, une minute connue suffit.
    const roule = statut ? STATUTS_EN_JEU.has(statut) : minute != null;
    if (!roule || minute == null || minute > c.minuteMax) return false;
  }
  if (c.butRecent && !(depuisBut != null && depuisBut >= 0 && depuisBut <= c.butRecent)) return false;
  if (c.rougeAdverse && !(depuisRouge != null && depuisRouge >= 0 && depuisRouge <= c.rougeAdverse)) return false;
  return true;
}

/** Un événement de l'API est-il un carton rouge (deuxième jaune compris) ? */
export const estRouge = (e) => e?.type === 'Card' && /red|second yellow/i.test(String(e?.detail ?? ''));

/* ------------------------------------------------- où une carte se joue */

/**
 * Ce que chaque sorte d'effet atteint.
 *
 * Trois portées, et une seule compte vraiment : `adverse`. Un effet marqué
 * ainsi va chercher quelqu'un en face — lui couper le souffle, lui cacher sa
 * main, lui prendre sa réserve.
 *
 * La table est ici, et pas une liste d'identifiants ailleurs, pour une raison
 * précise : une liste d'identifiants ne sait pas ce qu'elle contient. Le jour
 * où l'on ajoute une carte d'entrave, il faudrait penser à l'inscrire dans la
 * liste — et personne n'y pense. Déclarer la portée **sur la sorte d'effet**
 * fait que la carte se range toute seule.
 */
const PORTEE = {
  push: 'soi',
  refill: 'soi',
  team_breath: 'tribune',
  mod_self: 'soi',
  floor_quality: 'soi',
  breath_mult: 'soi',
  rally: 'tribune',
  per_mate: 'tribune',
  sync: 'tribune',
  swap_fanzzy: 'soi',
  evolve: 'soi',
  refill_hand: 'soi',
  clear_cooldowns: 'soi',
  /* Le tifo pousse, comme une carte de poussée : il la retarde, il ne la fait
     pas traverser. Il entre donc au Virage. */
  delayed_push: 'soi',

  /* Le Filet de chantier : il agit sur soi, mais ne protège que des
     entraves, et le Virage n'en a pas. Voir `SANS_OBJET_AU_VIRAGE`. */
  immunite: 'soi',

  silence: 'adverse',
  blind: 'adverse',
  lock_actions: 'adverse',
  steal: 'adverse',
  mod_foe: 'adverse',
  /* La bâche et le renvoi n'agressent personne, et pourtant ils sont
     `adverse` : ils attendent **le geste d'en face** — la prochaine poussée
     adverse, la prochaine carte adverse. Dans une salle où la corde bouge en
     continu et où trois cents personnes jouent, « la prochaine poussée
     adverse » n'est pas un événement : c'est du bruit de fond. La carte
     n'aurait pas de moment. */
  shield: 'adverse',
  reflect: 'adverse',

  /* Les cinq de septembre 2026.

     Trois entrent au Virage : l'ancre et le long chant agissent sur la corde
     commune et sur soi, la mise et la tournée sur soi seul.

     **Le retournement est `adverse`** — et c'est le seul point qui demande
     réflexion. Il ne touche personne, il divise un écart : mais dans une salle
     de trois cents, cet écart est le travail de la tribune d'en face, et une
     personne seule qui en efface la moitié est exactement ce que la note du
     dessus interdit. Un contre-exemple utile : la portée ne se lit pas à la
     cible technique de l'effet, elle se lit à **qui le subit**. */
  freeze_decay: 'soi',
  double_next: 'soi',
  cost_free: 'soi',
  push_over_time: 'soi',
  halve_gap: 'adverse',

  /* Les mécaniques neuves de novembre 2026. Celles qui visent quelqu'un en
     face (sa carte, sa main, ses prix, son prochain parfait, sa prochaine
     poussée) restent au duel ; les autres entrent au Virage. */
  steal_card: 'adverse',
  trap: 'adverse',
  shuffle_foe: 'adverse',
  cost_mult: 'adverse',
  curse: 'adverse',
  replay_last: 'soi',
  streak: 'soi',
  extra_hand: 'soi',
  cooldown_mult: 'soi',
  per_present: 'tribune',
};

/**
 * Une carte se joue-t-elle dans le Grand Virage ?
 *
 * **Le Virage n'est pas un duel avec plus de monde.** En face, il n'y a pas un
 * adversaire : il y a une foule d'inconnus. Une carte qui traverse y est soit
 * écrasante — une personne coupe le souffle de trois cents autres — soit nulle
 * une fois divisée par l'effectif. Les deux sont mauvais, et pour la même
 * raison : le Virage se joue **avec sa tribune**, pas contre l'autre.
 *
 * On garde donc ce qui agit sur soi ou sur les siens. L'effet de bord est le
 * meilleur de l'affaire : la famille `collectif` — la plus faible en un contre
 * un, où « chaque coéquipier » veut dire zéro personne — devient la reine du
 * Virage. Un deck de Virage cesse d'être un deck de duel, et c'est ce qui
 * donne une seconde vie aux dix emplacements.
 *
 * Le revers compte autant que l'effet : une carte dont la contrepartie viserait
 * l'adversaire serait refusée elle aussi.
 */
/**
 * Les effets qui n'ont **pas d'objet** au Virage.
 *
 * Ce n'est pas une question de portée — les deux agissent sur soi, et la
 * table du dessus a donc raison de les dire `soi`. C'est une question de
 * mobilier : le Virage met **un** personnage en tribune et n'a pas de banc.
 * Il n'y a personne à faire entrer, et rien à faire grandir en cours de
 * séance.
 *
 * Elles étaient acceptées, et le moteur les traitait en « sans objet » :
 * la carte quittait la main, coûtait son souffle, et ne faisait rien. Deux
 * des dix emplacements d'un deck de Virage pouvaient ainsi être morts sans
 * que rien ne le dise — ni la page, ni le serveur, ni un contrôle.
 *
 * Le filtre est ici, à côté de la portée, parce que c'est le même geste :
 * décider une fois, sur la **sorte d'effet**, ce qui entre au Virage.
 */
/* `immunite` aussi : le Filet de chantier ne protège que des entraves, et
   personne n'entrave au Virage. */
const SANS_OBJET_AU_VIRAGE = new Set(['swap_fanzzy', 'evolve', 'immunite']);

export function dansLeVirage(a) {
  if (!a?.effet) return false;
  if (SANS_OBJET_AU_VIRAGE.has(a.effet.type)) return false;
  const portee = (e) => PORTEE[e?.type] ?? 'adverse';
  return portee(a.effet) !== 'adverse'
    && (!a.revers || portee(a.revers) !== 'adverse');
}

/** Les cartes jouables au Virage, dans l'ordre du catalogue. */
export const ACTIONS_VIRAGE = ACTIONS.filter(dansLeVirage);

/**
 * Le catalogue, chaque carte marquée de l'endroit où elle se joue.
 *
 * **Le joueur construisait son deck à l'aveugle.** Treize cartes sur
 * trente-neuf ne se jouent pas au Virage, le serveur les écartait de sa main
 * en silence, et rien — ni l'écran du deck, ni le catalogue, ni l'ouverture
 * d'un booster — ne le disait nulle part. On pouvait donc remplir ses dix
 * emplacements de cartes dont pas une n'entrerait en tribune, et ne le
 * découvrir qu'en voyant sa rangée vide au milieu d'un match.
 *
 * Ce n'est pas un cas rare : un nouveau joueur reçoit cinq cartes, dont
 * l'Arbitre qui est **garanti** et ne se joue qu'en duel. Mesuré sur deux
 * cent mille paquets de bienvenue — 9,6 % des débutants n'ont qu'une seule
 * carte de Virage, et 0,8 % n'en ont aucune.
 *
 * La mention est calculée ici et servie par les routes, jamais recalculée
 * par un écran : `dansLeVirage` lit la **sorte d'effet**, et une page qui
 * referait ce raisonnement en tiendrait une seconde version, qui
 * divergerait au premier effet ajouté.
 */
export const ACTIONS_MARQUEES = ACTIONS.map((a) => ({ ...a, virage: dansLeVirage(a) }));

/**
 * Règles de construction du deck. Elles vivent ici pour être partagées.
 *
 * **Un deck incomplet est un deck valide.** Il fallait exactement trois Fanzzy,
 * et c'était un mur : un joueur qui vient d'ouvrir son premier booster n'en a
 * souvent qu'un ou deux, et il se voyait refuser l'entrée du virage par une
 * règle qu'il ne pouvait pas satisfaire. Il joue maintenant avec ce qu'il a —
 * simplement, avec un seul Fanzzy, il n'a personne à faire entrer en cours de
 * duel. La contrainte se paie en jeu au lieu de bloquer à la porte.
 *
 * L'équipement suit la même logique : deux pièces au plus, zéro accepté.
 */
export const DECK_RULES = {
  // Au plus trois, dont un entre en jeu au coup d'envoi.
  get fanzzy() { return reglage('deck.fanzzy'); },
  fanzzyMin: 1,       // au moins un, sinon il n'y a personne sur la corde
  // Au plus deux pièces par Fanzzy, liées à lui.
  get stuffParFanzzy() { return reglage('deck.stuff_par_fanzzy'); },
  // Exactement dix cartes d'action.
  get actions() { return reglage('deck.actions'); },
  // Visibles à la fois ; les autres arrivent en remplacement.
  get mainVisible() { return reglage('deck.main_visible'); },
  // Les chants réussis qui éveillent le légendaire du deck (`legende.js`).
  get legende() { return seuilLegende(); },
  // Plus de plafond par carte : dix exemplaires de la même sont permis. La
  // limite de deux venait d'un temps où l'on supposait un large choix de
  // cartes ; en pratique un débutant en possède cinq, et dix emplacements à
  // remplir avec cinq cartes sans doublon est arithmétiquement impossible.
  copiesMax: null,
  /**
   * Tout le monde entre au premier âge.
   *
   * La règle est déjà vraie par construction — le deck ramène chaque Fanzzy à
   * son personnage, et le loadout ne met en tribune que son premier âge. Elle
   * est écrite ici parce que la page du deck l'annonce au joueur : sans ça,
   * quelqu'un qui a payé quatre-vingt-dix écharpes ne comprendrait pas pourquoi
   * son Capo entre en gamin, et il le prendrait pour un bug.
   *
   * Ce que les écharpes achètent, c'est la carte Relève : le droit de le faire
   * grandir en cours de partie, en y consacrant un de ses dix emplacements.
   */
  stadeEnJeu: 1,
};

/**
 * Valide un deck. Renvoie la liste des problèmes, vide si tout va bien.
 * `possede` décrit ce que le joueur a réellement : on ne fait jamais confiance
 * à ce que le client envoie.
 */
export function validerDeck(deck, possede) {
  const pb = [];
  const fanzzy = deck?.fanzzy ?? [];
  const actions = deck?.actions ?? [];

  /* Le nombre d'emplacements dépend du niveau : deux au départ, trois à partir
     du cinquième. `possede.fanzzyMax` porte ce plafond, et vaut le maximum de
     la règle quand l'appelant ne le renseigne pas — un test qui monte le deck
     seul, ou une installation sans progression, se comportent comme avant.

     Le plafond est aussi **borné par la règle** : un niveau ne pourra jamais
     ouvrir un quatrième emplacement sans qu'on l'ait décidé ici. */
  const maxFanzzy = Math.min(DECK_RULES.fanzzy, possede?.fanzzyMax ?? DECK_RULES.fanzzy);
  if (fanzzy.length < DECK_RULES.fanzzyMin || fanzzy.length > maxFanzzy) {
    pb.push({ code: 'deck.error.fanzzy_count',
      min: DECK_RULES.fanzzyMin, max: maxFanzzy });
  }
  if (new Set(fanzzy.map((f) => f.id)).size !== fanzzy.length) {
    pb.push({ code: 'deck.error.fanzzy_duplicate' });
  }
  for (const f of fanzzy) {
    if (!possede.fanzzy.has(f.id)) pb.push({ code: 'deck.error.fanzzy_not_owned', id: f.id });
    const stuff = f.stuff ?? [];
    if (stuff.length > DECK_RULES.stuffParFanzzy) {
      pb.push({ code: 'deck.error.too_much_stuff', id: f.id });
    }
    for (const s of stuff) {
      if (!possede.stuff.has(s)) pb.push({ code: 'deck.error.stuff_not_owned', id: s });
    }
  }

  /* **Une pièce d'équipement est un objet, pas une licence** — et c'est cette
     phrase, écrite ici depuis le début, qui décide de la règle.

     Elle interdisait jusqu'ici la même pièce sur deux Fanzzy, purement et
     simplement. Ce n'était pas ce qu'elle dit : un objet possédé **deux fois**
     se porte deux fois. Or les doublons existent — le booster fait
     `copies = copies + 1` à chaque tirage en double, et le sac les affiche avec
     un « ×3 ». Ils ne servaient à rien, et le jeu les montrait quand même : il
     annonçait au joueur cinq Jumelles et lui en laissait porter une.

     On compte donc les porteurs par pièce, et on les borne au nombre
     d'exemplaires. Ce qui reste interdit est le seul cas qui l'était vraiment :
     porter le même **exemplaire** à deux endroits.

     `?? 1` quand l'appelant ne fournit pas les comptes : un test qui monte un
     deck à la main, ou un module sans progression, retrouve exactement le
     comportement d'avant — une pièce, un porteur. */
  const copies = possede?.stuffCopies ?? null;
  const porteurs = new Map();
  for (const f of fanzzy) {
    for (const s of f.stuff ?? []) porteurs.set(s, (porteurs.get(s) ?? 0) + 1);
  }
  for (const [s, n] of porteurs) {
    const a = Number(copies?.get?.(s) ?? 1);
    if (n > a) pb.push({ code: 'deck.error.stuff_shared', id: s, a, demande: n });
  }

  /* Un seul légendaire, jamais titulaire : voir `shared/legende.js`. */
  pb.push(...refusLegendes(deck, possede?.rarete));

  if (actions.length !== DECK_RULES.actions) {
    pb.push({ code: 'deck.error.actions_count', attendu: DECK_RULES.actions });
  }
  const compte = {};
  for (const a of actions) {
    if (!ACTION_BY_ID.has(a)) { pb.push({ code: 'deck.error.action_unknown', id: a }); continue; }
    if (!possede.actions.has(a)) pb.push({ code: 'deck.error.action_not_owned', id: a });
    compte[a] = (compte[a] ?? 0) + 1;
    // `copiesMax: null` veut dire « aucun plafond ». On garde le test plutôt
    // que de supprimer la règle : le jour où l'on voudra en remettre un, il
    // suffira d'écrire un nombre.
    if (DECK_RULES.copiesMax != null && compte[a] > DECK_RULES.copiesMax) {
      pb.push({ code: 'deck.error.too_many_copies', id: a });
    }
  }

  // Un deck sans « arbitre » enferme le joueur sur son premier Fanzzy : ce
  // n'est pas interdit, mais il vaut mieux le lui dire.
  const avertissements = actions.includes('a-arbitre') ? []
    : [{ code: 'deck.warn.no_substitution' }];

  // Le piège le plus silencieux du nouveau modèle : quelqu'un a payé pour faire
  // grandir un Fanzzy, il l'aligne, et il entre en gamin sans que rien ne le
  // lui explique. Il en conclura que son achat n'a servi à rien. La carte
  // Relève est le seul moyen d'en profiter en duel : si elle manque alors qu'il
  // y a quelque chose à relever, on le dit.
  const relevables = fanzzy.filter((f) => (possede?.stades?.[f?.id] ?? 1) > 1);
  if (relevables.length && !actions.includes('a-releve')) {
    avertissements.push({ code: 'deck.warn.no_evolution_card',
      ids: relevables.map((f) => f.id) });
  }

  /* Et le cas inverse, qui est le plus fréquent au début. « Relève » est une
     commune : elle est offerte à tout le monde, y compris à qui n'a jamais fait
     évoluer un Fanzzy. Elle occupe alors un emplacement sur dix pour ne rien
     faire — une carte morte que rien ne signale, dans le deck de quelqu'un qui
     découvre le jeu et qui conclura que le duel est mal réglé. */
  const releves = actions.filter((a) => a === 'a-releve').length;
  if (releves && !relevables.length) {
    avertissements.push({ code: 'deck.warn.useless_evolution_card', n: releves });
  }

  return { valide: pb.length === 0, problemes: pb, avertissements };
}
