import { randomUUID } from 'node:crypto';
import express from 'express';
import { DuelNvN, RULES, avecLieu } from './engine.js';
import { Cheat, grade, applyHeroMods } from '../ferveur/gestures.js';
/* Le barème du duel vit dans `deck` depuis qu'il s'annonce avant l'entrée en
   file (`enJeu`, CONTRATS.md § 17) : un seul endroit pour le chiffre promis et
   le chiffre versé. Voir `GAIN` et `baseDuDuel` là-bas. */
import { FORMATS, DOUBLE_CLUB, baseDuDuel } from '../deck/index.js';
import { modsAvecEffets } from '../../shared/duel/effets.js';
import { CHANTS } from '../../shared/duel/chants.js';
// L'échelle unique du verdict (CONTRATS.md § 16.1) : le serveur nomme, la page écrit.
import { verdictDe, estParfait, noteDuVerdict } from '../../shared/verdict.js';
import { XP } from '../../shared/niveau.js';
import { reglage } from '../../shared/reglages.js';
import { apres as coteApres, moyenne as coteMoyenne, COTE_DEPART }
  from '../../shared/cote.js';
// La même règle qu'au Virage : le club qu'on soutient dans cette
// rencontre, ou rien du tout si on n'en suit aucun des deux.
import { clubSoutenu, campDe } from '../football/suivis.js';
import { assurerBourse } from '../bourse.js';

/**
 * Couche réseau du duel N contre N.
 *
 * Le moteur ne connaît ni socket ni base. Ce module fait le reste : il forme
 * les équipes, ouvre les salles, diffuse les événements et gère les départs.
 *
 * Deux choix qui gouvernent le reste :
 *
 * **La file est par format, par match support ET par camp.** Deux joueurs qui
 * veulent un 3v3 sur Sion–Bâle jouent ensemble ; celui qui veut un 3v3 sur un
 * autre match attend ailleurs. Et les deux tribunes du duel sont les deux
 * clubs du match : on est placé d'office du côté du club qu'on suit, et on
 * choisit son camp quand on n'en suit aucun.
 *
 * C'est deux fois plus lent à remplir, et c'est le prix de la chose : un duel
 * dont les deux tribunes se valent n'est pas un duel de tribunes. Le camp
 * délaissé est annoncé dans la file et sa ferveur vaut davantage — sans quoi
 * un match dont personne ne suit le visiteur ne partirait jamais.
 *
 * **Une déconnexion ne fait pas perdre l'équipe.** Le joueur cesse simplement
 * de pousser et sa place l'attend : les tribunes ne s'effondrent pas parce que
 * quelqu'un a pris l'ascenseur.
 */

const TICK_MS = 500;
const BOT_APRES_MS = 20_000;
const GRACE_MS = 90_000;

/* ================================================== le verdict d'un chant

   **Le moteur ne sert que la note finale**, `quality`, celle qui pousse la
   corde — après les modificateurs du Fanzzy (`applyHeroMods`). Or le verdict
   se mesure **avant** eux (CONTRATS.md § 16.1) : un Fanzzy qui paie mal le
   parfait (`perfectBonus` 0,82) fait d'un 0,95 un 0,779, et mesuré sur
   `quality` le PARFAIT que le moteur vient de récompenser s'écrirait BON
   (contre-expertise du 3 octobre 2026, D7). Et l'on ne remonte pas de
   `quality` à la note d'avant : un 0,78 final peut venir d'un 0,95 ou d'un
   0,78.

   `engine.js` ne bouge pas (SERVEUR-VAGUE2 § 12 : trois suites en dépendent,
   et `niveau-smoke` y refuse un mot). La note mesurée est donc **rejouée
   ici, juste avant le moteur**, avec exactement ce qu'il va lire : le geste
   de la carte, les frappes, les modificateurs du Fanzzy en tribune composés
   avec le lieu et les effets en cours, le motif du joueur, et le plancher du
   « Second souffle » s'il a encore sa charge. `grade` est une fonction pure ;
   rien de tout cela ne change entre ce calcul et celui du moteur, puisque les
   deux tournent dans le même tour de boucle, au même instant `t`.

   Le rejeu porte une copie de la composition des modificateurs (`modsDe`,
   privée dans le moteur). Pour qu'une divergence future ne passe pas en
   silence, chaque chant vérifie que la note rejouée, passée par
   `applyHeroMods`, retombe sur la `quality` du moteur ; sinon le journal le
   dit, une fois. `nvn-smoke` le vérifie sur des centaines de chants. */

let divergenceDite = false;

/**
 * La note que le verdict mesure, rejouée avant que le moteur chante.
 *
 * Rend `null` quand le moteur refusera le chant de toute façon (joueur ou
 * chant inconnu, frappes refusées par `grade`) : il n'y aura pas d'évènement
 * à nommer. Ne lève jamais — un refus reste celui du moteur, avec son code.
 *
 * @returns {{ note: number, avantMods: number, mods: object } | null}
 *   `note` : la note mesurée (§ 16.1) ; `avantMods` : ce que le moteur passera
 *   à `applyHeroMods` (la note brute, ou le plancher s'il a mordu).
 */
export function noteMesuree(duel, userId, p, t) {
  const j = duel?.joueurs?.get(userId);
  const card = CHANTS[p?.cardId];
  if (!j || !card) return null;
  // Les mêmes modificateurs que `modsDe` dans le moteur, au même instant.
  const mods = modsAvecEffets(avecLieu(j.fanzzy[j.actif]?.mods, duel.stade), j.effets, t);
  let brut;
  try { brut = grade(card.gest, p.taps, mods, { motif: j.motif }); }
  catch { return null; }
  // « Second souffle » : il ne mord que s'il a sa charge et que le geste est en dessous.
  const plancher = (j.effets ?? []).find((e) => e.type === 'floor_quality' && e.charges > 0);
  const mordu = Boolean(plancher) && brut < plancher.valeur;
  return {
    note: noteDuVerdict(brut, mordu ? plancher.valeur : null),
    avantMods: mordu ? plancher.valeur : brut,
    mods,
  };
}

/**
 * Ce que les gestes d'un joueur ont donné pendant ce duel : ses PARFAITS, sa
 * série en cours et sa meilleure, sa meilleure note et le chant qui l'a donnée.
 * Tenu dans la salle, jamais dans le moteur.
 */
export const nouveauCompte = () =>
  ({ parfaits: 0, serie: 0, serieMax: 0, meilleurQ: -1, meilleurChant: null });

/**
 * Ajoute un chant au compte.
 *
 * La série compte les PARFAITS **d'affilée** : un chant d'un autre verdict la
 * remet à zéro, une carte ne la coupe pas (elle ne passe jamais par ici), un
 * chant refusé non plus (il n'a pas eu lieu). La meilleure note ne change que
 * si elle est **strictement** dépassée : à égalité, le premier chant reste —
 * la même règle que `meilleur_chant` au Virage.
 */
export function compterChant(c, note, cardId) {
  if (estParfait(note)) {
    c.parfaits += 1;
    c.serie += 1;
    c.serieMax = Math.max(c.serieMax, c.serie);
  } else {
    c.serie = 0;
  }
  if (note > c.meilleurQ) { c.meilleurQ = note; c.meilleurChant = cardId; }
}

/**
 * Ce que le bilan dit des gestes d'un joueur (`nvn:fin`, `joueurs[]`,
 * CONTRATS.md § 17) : `parfaits` toujours ; `serie` à partir de deux ;
 * `meilleur` dès qu'il a chanté une fois.
 */
export function resumeDuCompte(c) {
  const out = { parfaits: c?.parfaits ?? 0 };
  if ((c?.serieMax ?? 0) >= 2) out.serie = c.serieMax;
  if (c?.meilleurChant) {
    out.meilleur = {
      chant: c.meilleurChant,
      // Le nom du répertoire, tel quel : la page l'écrit sans le traduire (R7).
      nom: CHANTS[c.meilleurChant]?.nom ?? c.meilleurChant,
      verdict: verdictDe(c.meilleurQ),
    };
  }
  return out;
}

/**
 * Fait chanter un joueur, et nomme le geste.
 *
 * Le seul chemin des chants du duel — ceux des sockets comme ceux des bots :
 * la note est rejouée **avant** le moteur, l'évènement `chant` qu'il rend
 * reçoit `verdict` avant d'être diffusé, et le compte du joueur avance. Un
 * refus du moteur traverse tel quel, sans rien compter.
 *
 * @param comptes  `Map(userId → compte)`, celle de la salle
 */
export function chanterEtNommer(duel, comptes, userId, p, t = Date.now()) {
  const mesure = noteMesuree(duel, userId, p, t);
  const evenements = duel.chanter(userId, p, t);
  const chant = evenements.find((e) => e.t === 'chant' && e.userId === userId);
  if (!chant) return evenements;

  /* Le garde-fou du rejeu : la note rejouée doit retomber sur celle du moteur.
     Arrondie comme lui (trois décimales) ; un retour de flamme compte aussi.
     Un chant accepté que le rejeu n'a pas su noter est la même divergence :
     on ne nomme alors rien plutôt qu'un mot inventé. */
  const final = mesure ? applyHeroMods(mesure.avantMods, mesure.mods) : null;
  if (!final || Number(final.quality.toFixed(3)) !== chant.quality
      || final.backfire !== chant.backfire) {
    if (!divergenceDite) {
      divergenceDite = true;
      console.error('[nvn] verdict : la note rejouée ne retrouve pas celle du moteur',
        `(${final?.quality.toFixed(3) ?? 'aucune'} contre ${chant.quality})`,
        '— engine.js a-t-il changé sa façon de composer les modificateurs ?');
    }
    if (!mesure) return evenements;
  }

  chant.verdict = verdictDe(mesure.note);
  let c = comptes.get(userId);
  if (!c) { c = nouveauCompte(); comptes.set(userId, c); }
  compterChant(c, mesure.note, chant.cardId);
  return evenements;
}

/* ====================================================== les effets, des deux côtés

   L'arène du duel pose chaque effet en objet, avec son chrono en anneau
   (BRIEF-LOT6 § 1 et § 3) : la bâche devant la tribune qu'elle protège, le
   brouillard sur la moitié qui ne voit plus, les flèches de vent vers le camp
   qui le subit. **La vue du moteur n'en disait pas assez** pour le dessiner
   juste : `moi.effets` ne sert que ce qui reste (`reste`), sans la durée
   totale, et rien de ce qui pèse sur les autres joueurs. La page devinait :
   la durée était la plus longue valeur vue, et le camp d'un effet « adverse »
   celui d'en face de la dernière carte jouée — faux dès qu'un Renvoi la
   retourne contre celui qui la joue.

   Le serveur compte, l'écran nomme (R7). Comme pour le verdict, `engine.js`
   ne bouge pas : tout se lit ici, **dans l'état du moteur et non dans ses
   règles**. Avant chaque carte jouée, on retient les effets déjà posés ;
   après, ceux qui sont neufs sont exactement ce que la carte a posé, sur qui
   et pour combien de temps. Aucune copie de `appliquer`, donc rien qui puisse
   diverger le jour où une carte change : un effet de plus, un Renvoi, un
   revers, tout passe par le même constat. */

/** Effet posé → sa durée totale en millisecondes (`null` sans échéance).
    Une `WeakMap` et non une propriété : l'objet appartient au moteur, et il
    part avec l'effet quand le moteur le retire. */
const dureeDePose = new WeakMap();

/**
 * Joue une carte, et note ce qu'elle a posé.
 *
 * Le seul chemin des cartes du duel — sockets et bots. Les évènements du
 * moteur partent tels quels, à une chose près : un évènement `effect` dont
 * l'effet s'est posé sur des joueurs d'**un** camp reçoit `side`, ce camp-là
 * (celui qui le porte, Renvoi compris). Un effet qui ne se pose sur personne
 * (un vol de souffle, le gel de la corde) n'en a pas. Un refus du moteur
 * traverse tel quel, sans rien noter.
 */
export function jouerEtMarquer(duel, userId, cardId, t = Date.now()) {
  const avant = new Set();
  for (const j of duel.joueurs.values()) for (const e of j.effets ?? []) avant.add(e);
  const evenements = duel.jouer(userId, cardId, t);

  const camps = new Map();          // type d'effet → camps qui l'ont reçu
  for (const j of duel.joueurs.values()) {
    for (const e of j.effets ?? []) {
      if (avant.has(e)) continue;
      dureeDePose.set(e, e.fin ? e.fin - t : null);
      if (!camps.has(e.type)) camps.set(e.type, new Set());
      camps.get(e.type).add(j.side);
    }
  }
  for (const ev of evenements) {
    if (ev.t !== 'effect' || 'side' in ev) continue;
    const ou = camps.get(ev.type);
    if (ou?.size === 1) ev.side = [...ou][0];
  }
  return evenements;
}

/** Ce qu'un joueur porte, vu de l'arène : comme `moi.effets`, avec la durée. */
function effetsVus(j, t) {
  return (j?.effets ?? [])
    // Ce que `nettoyerEffets` retirera au prochain battement n'est déjà plus là.
    .filter((e) => (!e.fin || e.fin > t) && (e.charges === undefined || e.charges > 0))
    .map((e) => ({ type: e.type, reste: e.fin ? e.fin - t : null,
      duree: dureeDePose.get(e) ?? null }));
}

/**
 * La vue d'un joueur, telle qu'elle part (`nvn:start`, `nvn:state`).
 *
 * Celle du moteur, plus trois choses qu'il ne sait pas dire :
 * - `moi.userId` — la page ne savait pas qui elle était hors du vestiaire
 *   (`nvn:file.moi`) : elle le devinait au camp et à la ferveur, et un 3v3
 *   a trois joueurs du même camp. Il reconnaît ses propres chants
 *   (`chant.userId`) et sa ligne du bilan ;
 * - `moi.effets[].duree` — la durée totale de chaque effet, pour l'anneau ;
 * - `equipes[][].effets` — ce que porte chaque joueur, des deux camps, sous
 *   la même forme. Le souffle des autres y est déjà (« une information de
 *   jeu ») ; leurs effets le sont tout autant, puisque chaque carte jouée
 *   est déjà annoncée à toute la salle (`action`).
 */
export function vuePour(duel, userId, t = Date.now()) {
  const v = duel.vue(userId);
  if (v.moi) {
    v.moi.userId = userId;
    /* Le moteur rend ses effets dans l'ordre où le joueur les porte : on les
       apparie un à un, et un type qui ne correspond pas reste sans durée
       plutôt que d'en recevoir une autre. */
    const siens = duel.joueurs.get(userId)?.effets ?? [];
    v.moi.effets = (v.moi.effets ?? []).map((e, i) => ({ ...e,
      duree: siens[i]?.type === e.type ? dureeDePose.get(siens[i]) ?? null : null }));
  }
  v.equipes = (v.equipes ?? []).map((eq) => eq.map((p) =>
    ({ ...p, effets: effetsVus(duel.joueurs.get(p.userId), t) })));
  return v;
}

export function createNvN({ pool, io, requireAuth, decks, niveau = null, kop = null,
                            /* Facultatif : sans lui, aucun plafond, et le
                               classé s'ouvre à tous les formats. */
                            abonnement = null }) {
  const salles = new Map();          // duelId -> { duel, membres, timer }
  const salleDe = new Map();         // userId -> duelId
  const files = new Map();           // clé -> [candidats]
  const cadence = new WeakMap();     // socket -> horodatages

  const q = async (sql, params = []) => {
    const [rows] = await pool.execute(sql, params);
    return rows;
  };
  const cle = (format, fixtureId, camp) => `${format}:${fixtureId}:${camp}`;

  /* ------------------------------------------------------- appariement */

  async function entrerEnFile(socket, { format, fixtureId, camp, contreBot, souple }) {
    const u = socket.data?.user;
    // On vérifie l'identifiant, pas seulement la présence de l'objet : une
    // session à moitié montée donnait un `{ userId: undefined }` bien truthy,
    // qui passait la garde et allait mourir au bind SQL. Le joueur recevait
    // alors « erreur serveur » là où la cause était une session invalide.
    if (!u?.userId) throw new Cheat('unauthenticated');
    if (!FORMATS[format]) throw new Cheat('unknown_format');
    if (!Number.isFinite(Number(fixtureId))) throw new Cheat('fixture_unknown');

    // Le deck et le match sont validés avant toute chose : mieux vaut refuser
    // maintenant que faire attendre trois minutes pour rien.
    const loadout = await decks.loadout(u.userId);
    if (!loadout) throw new Cheat('no_deck');
    const support = await decks.matchSupport(Number(fixtureId), u.userId);

    /* **Ce que le gratuit plafonne, et pourquoi c'est un refus ici.**

       Cinq duels classés par jour, et le classé s'arrête au 1v1 — voir
       `abonnement/index.js`, où la décision est écrite en entier.

       On refuse à l'entrée plutôt que de déclasser à la sortie, et ce n'est
       pas un choix de confort : **un duel est classé pour tout le monde ou
       pour personne**. La note du camp est partagée — « les noter un par un
       donnerait trois résultats différents pour une seule partie », dit le
       calcul de la cote plus bas. Déclasser un seul joueur après coup
       déclasserait donc ses quatre coéquipiers, qui n'ont rien demandé.

       Et le refus n'est pas une porte close : les matchs des autres jours
       sont de l'entraînement, ils restent ouverts, et le 2v2 s'y joue à tout
       le monde. La page le dit avec ces deux codes-là.

       **Une panne de ce compte laisse entrer.** Refuser sur une erreur de
       base fermerait le jeu pour une raison invisible — c'est la même
       posture que partout ailleurs ici. */
    if (abonnement && support.mode === 'classe') {
      try {
        const abonne = await abonnement.estAbonne(u.userId);
        if (FORMATS[format] > abonnement.tailleClasseeMax(abonne)) {
          throw new Cheat('format_classe_abonne');
        }
        const reste = await abonnement.duelsClassesRestants(u.userId);
        if (reste !== null && reste <= 0) throw new Cheat('duels_classes_epuises');
      } catch (e) {
        if (e instanceof Cheat) throw e;
        console.warn('[nvn] plafond illisible pour', u.userId, '·', e.message);
      }
    }

    const maison = support.fixture.home.id;
    const exterieur = support.fixture.away.id;

    /* Le camp.
     *
     * **Chez soi, il ne se choisit pas** : il découle du club qu'on suit, et
     * c'est ce qui empêche d'aller pousser contre son propre club. Même règle
     * qu'au Grand Virage, et la même fonction — il n'y en a qu'une.
     *
     * **Ailleurs, il se choisit**, et c'est tout l'objet de ce duel-ci : on
     * vient tenir une tribune qui n'est pas la sienne. */
    const club = await clubSoutenu(q, u.userId, maison, exterieur);
    const monCamp = club.neutre
      ? (Number(camp) === 1 ? 1 : 0)
      : campDe(club.teamId, maison, exterieur);

    quitterFile(u.userId);

    const taille = FORMATS[format];
    const c = cle(format, fixtureId, monCamp);
    const file = files.get(c) ?? [];
    const enFace = files.get(cle(format, fixtureId, monCamp ^ 1)) ?? [];

    /* Le renfort.
     *
     * Un duel est maintenant tribune contre tribune : un match dont personne
     * ne suit l'équipe visiteuse ne se remplirait jamais. Celui qui va tenir le
     * camp délaissé en est donc payé — sa ferveur vaut davantage, et d'autant
     * plus que ce camp était vide quand il est arrivé.
     *
     * Le bonus est **figé à l'entrée** et ne bouge plus. Il récompense un
     * geste — être venu là où il manquait du monde — et non un état : au coup
     * d'envoi, les deux camps sont pleins et l'état a disparu.
     *
     * Il dépend du camp et non de la personne : un supporter du club délaissé
     * en profite comme un neutre. Un bonus qui dépendrait aussi de qui l'on est
     * demanderait deux phrases pour s'expliquer au lieu d'une. */
    const manque = Math.max(0, Math.min(taille, enFace.length - file.length));
    const bonus = 1 + (manque / taille) * (reglage('duel.renfort_max') - 1);

    file.push({ userId: u.userId, nom: u.name, socket, loadout, support,
                depuis: Date.now(), format, camp: monCamp,
                /* « Peu importe le format » : ce joueur accepte tout dès la
                   première seconde, et devient appariable avec ceux qui
                   attendent dans une autre file du même match. Voir
                   `tenterLarge`. */
                souple: Boolean(souple),
                neutre: club.neutre, teamId: club.teamId, bonus,
                contreBot: Boolean(contreBot) });
    files.set(c, file);

    /* À toute la file, et non au seul arrivant : ceux qui attendaient déjà ne
       voyaient jamais personne entrer. Voir `diffuserFile`. */
    diffuserFile(format, Number(fixtureId));

    annoncerAttentes();
    if (contreBot) return ouvrirAvecBots(c);
    const partiVite = tenterAppariement(format, Number(fixtureId));
    if (partiVite) return partiVite;

    /* **Sans attendre la veille**, si quelqu’un accepte déjà de jouer avec
       celui qui vient d’arriver. C’est le cas d’un joueur souple — « peu
       importe le format » — qui rejoint une file voisine : lui faire
       patienter deux secondes de plus n’a aucune raison d’être, et ces deux
       secondes sont exactement celles où il se demande si ça marche.

       Du plus grand au plus petit : quatre personnes qui peuvent faire un
       2v2 ne doivent pas se retrouver à deux duels de 1v1. */
    for (let k = Math.max(...Object.values(FORMATS)); k >= 1; k--) {
      const parti = tenterLarge(Number(fixtureId), k);
      if (parti) return parti;
    }
    return null;
  }

  /**
   * L'état d'une file, tel qu'on le montre à l'un de ses membres.
   *
   * ## Ce qui manquait
   *
   * La salle d'attente était **trois phrases**. « 1 sur 3 », « il manque 2
   * supporters de Vissel Kobe », « des bots complètent après 120 secondes ».
   * C'est exact, et ça ne donne envie de rien : on attend deux minutes devant
   * un compteur, sans savoir qui est là ni voir arriver personne.
   *
   * Elle montre maintenant **les deux tribunes**, place par place : qui est
   * entré, avec le Fanzzy qu'il aligne, et combien de places restent vides de
   * chaque côté. Attendre devient regarder se remplir.
   *
   * ## Pourquoi la perspective change selon le lecteur
   *
   * « Ma tribune » et « en face » ne désignent pas les mêmes gens selon le camp
   * où l'on est. Le payload est donc construit **par destinataire** — c'est le
   * seul moyen que « en haut, c'est moi » reste vrai pour tout le monde, ce qui
   * est la convention de tous les écrans du jeu.
   */
  function etatFile(format, fixtureId, camp, support) {
    const taille = FORMATS[format];
    const mien = files.get(cle(format, fixtureId, camp)) ?? [];
    const face = files.get(cle(format, fixtureId, camp ^ 1)) ?? [];
    const clubs = [support.fixture.home, support.fixture.away];

    /* Le Fanzzy **titulaire** : c'est lui qu'on voit entrer au coup d'envoi, et
       c'est donc lui qui représente son supporter dans la salle d'attente. Un
       joueur sans deck lisible n'a pas de portrait — ce n'est pas une erreur,
       c'est quelqu'un qui n'a pas encore monté sa tribune. */
    const vu = (f) => ({
      userId: f.userId,
      nom: f.nom,
      fanzzy: f.loadout?.fanzzy?.[0]
        ? { id: f.loadout.fanzzy[0].id, nom: f.loadout.fanzzy[0].nom }
        : null,
      /* Depuis quand il attend. Voir arriver quelqu'un est la moitié de
         l'intérêt ; savoir qu'il est là depuis une minute est l'autre. */
      depuis: f.depuis,
    });

    return {
      format, mode: support.mode, raison: support.raison,
      camp, attendus: taille,
      club: clubs[camp], enFaceClub: clubs[camp ^ 1],
      presents: mien.length, enFace: face.length,
      manqueEnFace: Math.max(0, taille - face.length),
      // Ce qui manque **de mon côté** : le message ne le disait pas, et dans un
      // 3v3 entré seul il manque deux supporters ici avant d'en manquer trois
      // en face. On ne peut pas inviter ce qu'on ne sait pas qu'il manque.
      manqueChezMoi: Math.max(0, taille - mien.length),
      tribunes: { moi: mien.map(vu), eux: face.map(vu) },
      /* L'instant où les bots entrent, et non la durée restante : une durée
         envoyée une fois est fausse une seconde plus tard, et la page ne
         pouvait qu'afficher une phrase figée. Avec un instant, elle décompte. */
      botA: Date.now() + attenteAvantBots(support.mode),
      botDansMs: attenteAvantBots(support.mode),
    };
  }

  /**
   * Annonce l'état de la file à **tous** ceux qui y sont, des deux côtés.
   *
   * Il n'était envoyé qu'à celui qui venait d'entrer. Ceux qui attendaient
   * déjà ne voyaient donc jamais personne arriver : leur écran restait sur
   * « 1 sur 3 » jusqu'au coup d'envoi, et l'attente n'avait aucun signe de vie.
   */
  function diffuserFile(format, fixtureId) {
    for (const camp of [0, 1]) {
      const file = files.get(cle(format, fixtureId, camp)) ?? [];
      for (const f of file) {
        /* Le renfort est **celui de chacun**, figé à son entrée : le recalculer
           ici donnerait à tout le monde celui du dernier arrivé. */
        f.socket.emit('nvn:file', {
          ...etatFile(format, fixtureId, camp, f.support),
          neutre: f.neutre,
          renfort: Number(f.bonus.toFixed(2)),
          moi: f.userId,
        });
      }
    }
  }

  /**
   * Le temps qu'on laisse à de vraies gens avant d'appeler des bots.
   *
   * Vingt secondes pour un entraînement : on vient y jouer seul, tout de
   * suite. Bien plus pour un duel classé, et c'est nouveau — la file se scinde
   * désormais en deux camps, et vingt secondes ne laissent à personne le temps
   * de venir tenir celui qui manque. Le renfort n'aurait alors jamais lieu :
   * on jouerait toujours contre des machines avant qu'un humain arrive.
   *
   * Le serveur basculait déjà au bout de vingt secondes pour un duel classé
   * **sans le dire** — il annonçait `botDansMs` seulement en entraînement. Le
   * délai est maintenant annoncé dans les deux cas : un joueur qui attend a le
   * droit de savoir combien de temps.
   */
  const attenteAvantBots = (mode) => (mode === 'classe'
    ? reglage('duel.attente_classe_sec') * 1000 : BOT_APRES_MS);

  function quitterFile(userId) {
    let parti = false;
    // Les files touchées, pour ne les rediffuser qu’une fois chacune.
    const vidangees = new Set();
    for (const [c, file] of files) {
      const i = file.findIndex((f) => f.userId === userId);
      if (i === -1) continue;
      file.splice(i, 1);
      if (!file.length) files.delete(c);
      else files.set(c, file);
      parti = true;
      /* Le format et le match, tirés de la clé : ceux qui restent doivent voir
         la place se vider. Une salle d’attente où personne ne part jamais
         montre des gens qui ne viendront pas. */
      const [fmt, fix] = c.split(':');
      vidangees.add(`${fmt}:${fix}`);
    }
    /* On n'annonce que si quelque chose a bougé : `quitterFile` est appelée à
       chaque déconnexion, et la plupart ne concernent personne qui attendait. */
    if (parti) {
      for (const v of vidangees) {
        const [fmt, fix] = v.split(':');
        diffuserFile(fmt, Number(fix));
      }
      annoncerAttentes();
    }
  }

  /**
   * Jusqu'à combien on accepte de rétrécir, après tout ce temps d'attente.
   *
   * ## Le tout ou rien d'avant
   *
   * Un 3v3 attendait ses six supporters pendant deux minutes, puis basculait
   * d'un coup en entraînement contre des bots. Entre les deux, rien : quatre
   * personnes présentes sur le même match restaient assises à se regarder
   * pendant cent vingt secondes, alors qu'un 2v2 était jouable dès la
   * quarantième.
   *
   * Et le repli coûtait cher : passer aux bots **déclasse** le duel, donc les
   * quatre finissaient par jouer un entraînement qui ne compte nulle part.
   *
   * ## Le palier
   *
   * On descend d'un cran à mesure que le temps passe : un 3v3 accepte de partir
   * à 2v2 au tiers de l'attente, à 1v1 aux deux tiers, et les bots ne viennent
   * qu'au bout. **Le duel reste classé** — il oppose de vrais gens, c'est la
   * seule chose que le classement demande.
   *
   * Jouer un 2v2 contre des humains vaut mieux qu'un 3v3 contre des machines.
   * C'est tout ce que cette fonction dit.
   *
   * `ecoule` est le temps du **plus ancien** des deux camps : celui qui attend
   * depuis le début est celui dont la patience décide.
   */
  function tailleAcceptee(attendu, ecoule, attente) {
    if (attendu <= 1 || ecoule <= 0) return attendu;
    /* Linéaire, et arrondi vers le haut : au tiers du temps un 3v3 accepte 2,
       aux deux tiers il accepte 1. Un 5v5 descend de cinq à un par le même
       chemin, sans qu'on ait à écrire une table. */
    const part = Math.min(1, ecoule / Math.max(1, attente));
    return Math.max(1, Math.ceil(attendu * (1 - part)));
  }

  /**
   * Deux camps assez peuplés, et le duel part — au format demandé, ou plus bas.
   *
   * `minimum` est ce qu'on accepte aujourd'hui : `taille` tant que personne n'a
   * attendu, moins à mesure que le temps passe. Voir `tailleAcceptee`.
   *
   * Il n'y a plus d'alternance à faire : **le camp est l'équipe**. La liste
   * répartissait les arrivants un sur deux pour que les six premiers d'un 3v3
   * ne forment pas une équipe d'habitués contre une équipe de retardataires —
   * c'était la bonne réponse tant que les deux tribunes n'étaient qu'un ordre
   * d'arrivée. Elles portent maintenant les couleurs d'un vrai club.
   */
  function tenterAppariement(format, fixtureId, minimum = null) {
    const taille = FORMATS[format];
    const cles = [cle(format, fixtureId, 0), cle(format, fixtureId, 1)];
    const camps = cles.map((k) => files.get(k) ?? []);

    /* Le nombre qu'on peut aligner **des deux côtés** : un duel se joue à
       nombre égal, sinon un camp pousse à trois contre deux et le score ne veut
       plus rien dire. */
    const possible = Math.min(camps[0].length, camps[1].length, taille);
    const seuil = Math.max(1, Math.min(taille, minimum ?? taille));
    if (possible < seuil) return null;

    const equipes = camps.map((f) => f.splice(0, possible));
    cles.forEach((k, i) => { if (!camps[i].length) files.delete(k); });
    // Les deux files se vident d'un coup : ceux qui regardaient doivent le voir.
    annoncerAttentes();
    /* Le format **joué** : un 3v3 parti à deux contre deux est un 2v2, et c'est
       ce qui doit figurer au parcours du joueur. */
    return ouvrir(equipes, equipes[0][0].support, `${possible}v${possible}`);
  }

  /**
   * Cette personne accepte-t-elle de jouer **à tant contre tant**, maintenant ?
   *
   * Deux choses l'assouplissent. Le temps d'abord : `tailleAcceptee` fait
   * descendre son format d'un cran à mesure qu'elle attend. Et son propre
   * choix ensuite — « peu importe le format » —, qui lui fait tout accepter
   * dès la première seconde.
   *
   * La réponse est bornée **des deux côtés**, et la borne haute compte autant
   * que l'autre : le repli fait descendre, il ne fait jamais monter. Quelqu'un
   * venu pour un 3v3 n'a pas à se retrouver dans un 5v5 — plus de monde à
   * réunir, plus d'attente, et une prime qu'il n'avait pas en tête.
   */
  function accepte(f, k, t) {
    if (f.souple) return true;
    const demande = FORMATS[f.format] ?? 1;
    if (k > demande) return false;
    const attente = attenteAvantBots(f.support?.mode);
    return tailleAcceptee(demande, t - f.depuis, attente) <= k;
  }

  /**
   * L'appariement **à travers les formats**, pour un match donné.
   *
   * ## Le trou que le repli par palier ne bouche pas
   *
   * La file est indexée `format:match:camp`. Deux personnes qui attendent sur
   * le même match, l'une en 3v3 et l'autre en 1v1, ne se rencontrent donc
   * jamais — pas même au bout de deux minutes, pas même quand le repli a fait
   * descendre la première jusqu'à 1v1 : elle descend dans **sa** file, et
   * l'autre est dans une autre clé.
   *
   * C'est le cas le plus fréquent d'un soir creux. Trois personnes en ligne,
   * trois formats différents, et trois duels contre des bots.
   *
   * ## Ce qu'on fait
   *
   * On rassemble, camp par camp, tout ce qui attend sur ce match **quel que
   * soit le format**, et on ne garde que ceux qui acceptent la taille visée —
   * par le temps écoulé ou parce qu'ils ont dit « peu importe ». Si les deux
   * camps en ont assez, le duel part.
   *
   * Les plus anciens d'abord : celui qui attend depuis deux minutes passe
   * avant celui qui vient d'arriver, quel que soit son format.
   */
  function tenterLarge(fixtureId, taille, t = Date.now()) {
    const suffixe = `:${fixtureId}:`;
    const parCamp = [0, 1].map((camp) => {
      const pris = [];
      for (const [k, file] of files) {
        if (!k.includes(suffixe) || !k.endsWith(`:${camp}`)) continue;
        for (const f of file) if (accepte(f, taille, t)) pris.push({ k, f });
      }
      return pris.sort((a, b) => a.f.depuis - b.f.depuis).slice(0, taille);
    });
    if (parCamp.some((p) => p.length < taille)) return null;

    /* On retire chacun de **sa** file, qui n'est pas la même pour tous : c'est
       tout l'intérêt de ce chemin. */
    for (const p of parCamp.flat()) {
      const file = files.get(p.k) ?? [];
      const i = file.indexOf(p.f);
      if (i >= 0) file.splice(i, 1);
      if (!file.length) files.delete(p.k);
    }
    annoncerAttentes();
    const equipes = parCamp.map((p) => p.map((x) => x.f));
    /* Le format **joué** : quatre personnes venues de trois files différentes
       jouent un 2v2, et c'est ce qui doit figurer à leur parcours. */
    return ouvrir(equipes, equipes[0][0].support, `${taille}v${taille}`);
  }

  /**
   * Entraînement immédiat : les places manquantes sont tenues par des bots.
   *
   * Les humains gardent **leur** camp, les bots tiennent le reste. Un camp est
   * un club : on ne mélange pas, même quand la moitié de la salle est faite de
   * machines.
   *
   * ## On ramasse les deux camps, et c'est le point
   *
   * La fonction ne lisait qu'**une** file — celle dont la minuterie venait
   * d'expirer — et remplissait l'autre côté de bots sans jamais regarder qui
   * l'attendait. Sur un 3v3 avec deux supporters d'un côté et deux de l'autre,
   * elle ouvrait donc un duel à deux humains contre trois bots, puis un second
   * à deux humains contre trois bots. Quatre personnes présentes sur le même
   * match, à la même seconde, et aucune n'a joué contre une autre.
   *
   * C'est le contraire exact de ce que le repli est censé faire : il est là
   * pour qu'on puisse jouer quand il n'y a personne, pas pour séparer ceux qui
   * sont venus. On prend donc **ce qu'il y a des deux côtés**, et les bots ne
   * bouchent que ce qui reste vraiment vide.
   */
  function ouvrirAvecBots(c) {
    const file = files.get(c);
    if (!file?.length) return null;
    const { format } = file[0];
    const taille = FORMATS[format];
    const fixtureId = Number(file[0].support?.fixture?.id);

    /* Les deux files du même match et du même format. Celle qui a déclenché la
       minuterie n'a aucune priorité : ce qui compte est qu'un maximum de gens
       jouent ensemble. */
    const parCamp = [0, 1].map((camp) => files.get(cle(format, fixtureId, camp)) ?? []);
    const humains = parCamp.map((f) => f.splice(0, taille));
    if (!humains.some((h) => h.length)) return null;

    for (const camp of [0, 1]) {
      const k = cle(format, fixtureId, camp);
      if (!(files.get(k) ?? []).length) files.delete(k);
    }
    annoncerAttentes();

    /* Le modèle de deck que copient les bots : celui d'un humain présent, quel
       que soit son camp. Sans humain du tout on ne serait pas ici. */
    const modele = (humains[0][0] ?? humains[1][0]).loadout;
    const equipes = [[...humains[0]], [...humains[1]]];
    for (const side of [0, 1]) {
      while (equipes[side].length < taille) {
        equipes[side].push(faireBot(modele, equipes[side].length, side));
      }
    }
    // Un entraînement ne compte jamais, même adossé à un match du jour.
    const support = (humains[0][0] ?? humains[1][0]).support;
    return ouvrir(equipes, { ...support, mode: 'entrainement' });
  }

  function faireBot(modele, i, side) {
    return {
      userId: `bot:${randomUUID().slice(0, 8)}`,
      nom: ['Momo', 'Sarah', 'Le Gros', 'Nadia', 'Tonio'][i % 5],
      socket: null,
      /* Un bot d'entraînement **enseigne**, il ne verrouille pas.

         Il chantait toutes les 2,5 à 6 secondes, avec une adresse de 0,55 à
         0,85. Or un geste de tempo demande quatre secondes et demie à exécuter :
         **il était plus rapide qu'un humain ne peut physiquement l'être**, et
         il poussait aussi fort. Les deux camps se neutralisaient, et cinq
         minutes de duel se terminaient sur un nul.

         Il chante maintenant toutes les 7 à 13 secondes, moins juste. Un joueur
         appliqué gagne ; un débutant marque une ou deux fois et perd — ce qui
         est le but d'un entraînement. */
      bot: { prochain: Date.now() + 2500 + Math.random() * 3000,
        adresse: 0.30 + Math.random() * 0.25 },
      /* Le deck de l'humain, pas sa garde-robe : un bot habillé comme lui
         passerait pour son double. */
      loadout: { ...modele, fanzzy: modele.fanzzy.map((f) => ({ ...f, tenues: {} })) },
    };
  }

  /* ------------------------------------------------------------ salles */

  function ouvrir(equipes, support, format) {
    const id = randomUUID();
    const duel = new DuelNvN({
      id,
      equipes: equipes.map((eq) => eq.map((p) => ({
        userId: p.userId, nom: p.nom, loadout: p.loadout }))),
      fixture: support.fixture,
      mode: support.mode,
      /* Le format **joué**, déduit des équipes plutôt que de la demande :
         un 3v3 qui part à deux contre deux est un 2v2, et c’est ce qui
         s’est passé qu’on enregistre. */
      format: format ?? `${equipes[0].length}v${equipes[1].length}`,
    });

    const membres = new Map();
    equipes.flat().forEach((p) => membres.set(p.userId, {
      socket: p.socket, bot: p.bot ?? null, coupeA: null, nom: p.nom,
      /* Ce que le joueur a décidé **en entrant en file** : le club qu'il
         défend, s'il y était chez lui, et ce que son renfort lui vaut. Retenu
         ici plutôt que relu à la fin — un joueur peut cesser de suivre un club
         pendant le duel, et ce qui compte est ce qui était vrai au moment du
         choix. Les bots n'ont rien décidé : les valeurs par défaut sont les
         leurs, et elles ne servent jamais puisqu'on les écarte. */
      neutre: p.neutre ?? true, teamId: p.teamId ?? null, bonus: p.bonus ?? 1 }));

    /* `comptes` : ce que les gestes de chacun ont donné — PARFAITS, série,
       meilleur chant — tenu ici et non dans le moteur, qui ne bouge pas.
       Voir `chanterEtNommer` en tête de module. Les bots ont le leur. */
    const salle = { duel, membres, room: `nvn:${id}`, comptes: new Map() };
    salles.set(id, salle);

    for (const [userId, m] of membres) {
      if (!m.socket) continue;
      salleDe.set(userId, id);
      m.socket.join(salle.room);
      // La vue telle qu'elle part, avec ce que le moteur ne sait pas dire.
      m.socket.emit('nvn:start', vuePour(duel, userId));
    }

    /* L'affiche part **après** le départ, et sans le retenir : elle lit la base,
       et un duel n'a pas à attendre une requête pour commencer. Un client qui ne
       la reçoit pas joue exactement comme avant. */
    void affiche(duel).then((a) => {
      for (const m of membres.values()) {
        if (m.socket?.connected) m.socket.emit('nvn:affiche', a);
      }
    }).catch((e) => console.error('[nvn] affiche', e.message));

    salle.timer = setInterval(() => void horloge(salle), TICK_MS);
    return salle;
  }

  /**
   * Un but réel dans un match support.
   *
   * Il ne concerne que les duels adossés à ce match précis. Les autres salles
   * n'en savent rien : un but à Lens ne doit pas secouer une corde tendue sur
   * un match de Super League.
   */
  function butReel(g) {
    let touchees = 0;
    for (const salle of salles.values()) {
      if (Number(salle.duel.fixture?.id) !== Number(g.fixtureId)) continue;
      const ev = salle.duel.butReel(
        { teamId: g.teamId, minute: g.minute, joueur: g.player });
      if (!ev.length) continue;
      touchees++;
      diffuser(salle, ev);
    }
    return touchees;
  }

  /**
   * Diffusion : les événements partent à tous, les vues restent privées.
   *
   * **L'état part même quand il ne s'est rien passé**, et c'est le point.
   *
   * La fonction commençait par `if (!evenements?.length) return;` : entre deux
   * actions, plus rien ne partait. Or il se passe quelque chose en permanence —
   * la corde retombe de 1,2 point par seconde, l'horloge tourne, le souffle
   * revient. Le joueur voyait donc une corde **figée** jusqu'à ce que quelqu'un
   * chante, puis un saut. La décroissance, qui est la tension du jeu, était
   * invisible : on ne pouvait pas voir qu'on était en train de perdre son
   * avance sans rien faire.
   *
   * Les **événements** restent conditionnels — envoyer un tableau vide dix fois
   * par seconde n'apprendrait rien à personne. C'est l'état qui part à chaque
   * battement, et il ne coûte que ce qu'il pèse : une salle diffuse deux fois
   * par seconde.
   */
  function diffuser(salle, evenements) {
    if (evenements?.length) io.to(salle.room).emit('nvn:events', evenements);
    for (const [userId, m] of salle.membres) {
      if (m.socket?.connected) m.socket.emit('nvn:state', vuePour(salle.duel, userId));
    }
    if (salle.duel.termine) fermer(salle);
  }

  async function horloge(salle) {
    const t = Date.now();
    try {
      const ev = salle.duel.tick(t);

      // Les bots jouent : un entraînement sans adversaire actif n'apprend rien.
      for (const [userId, m] of salle.membres) {
        if (!m.bot || salle.duel.termine || t < m.bot.prochain) continue;
        m.bot.prochain = t + 6000 + Math.random() * 5000;
        try {
          const j = salle.duel.joueur(userId);
          const carte = j.main[Math.floor(Math.random() * j.main.length)];
          // Par le même chemin que les joueurs : ses effets ont leur durée.
          if (carte && Math.random() < 0.35) ev.push(...jouerEtMarquer(salle.duel, userId, carte, t));
          else {
            /* Le bot choisit son chant comme un joueur : dans le répertoire du
               duel. Il envoyait `geste: 'tempo'`, un champ que le moteur
               n'a jamais lu — il chantait donc le geste que la rotation lui
               donnait, quel qu'il soit, avec des frappes de tempo. Il ratait
               tous les gestes qui n'en sont pas, et personne ne s'en étonnait
               puisqu'un bot est censé rater.

               Il prend au hasard : un bot qui optimiserait son souffle serait
               un adversaire d'entraînement plus dur qu'un humain. */
            const chant = salle.duel.repertoire[
              Math.floor(Math.random() * salle.duel.repertoire.length)];
            /* Par le même chemin que les joueurs : le verdict de son chant
               part à la salle, et ses PARFAITS au bilan (« un bot a les
               siens », CONTRATS.md § 17). */
            ev.push(...chanterEtNommer(salle.duel, salle.comptes, userId, {
              cardId: chant,
              taps: Array.from({ length: 8 }, (_, i) =>
                i * 560 + (Math.random() * 2 - 1) * 260 * (1 - m.bot.adresse)),
            }, t));
          }
        } catch { /* souffle insuffisant ou geste refusé : il attend */ }
      }

      // Grâce épuisée : le joueur est retiré de la salle, pas puni.
      for (const [userId, m] of salle.membres) {
        if (m.coupeA && t - m.coupeA > GRACE_MS) {
          m.parti = true;
          m.coupeA = null;
          ev.push({ seq: ++salle.duel.seq, t: 'left', userId });
        }
      }

      diffuser(salle, ev);
    } catch (e) {
      console.error(`[nvn ${salle.duel.id}]`, e.message);
    }
  }

  /* Ce qu'un duel rapporte en écharpes (`GAIN`) et le double pour son club
     (`DOUBLE_CLUB`) vivent dans `deck/index.js` depuis que la page de
     préparation annonce ce qui est en jeu avant l'entrée en file : voir
     `baseDuDuel` et `enJeuDe` là-bas. */

  /**
   * Qui, parmi ces joueurs, suit l'une des deux équipes du match.
   *
   * Une requête pour tout le monde, et non une par joueur : `fermer()` tourne à
   * la fin de chaque duel, et un aller-retour par participant sur un 5 contre 5
   * pour lire une table de deux lignes serait du gaspillage pur.
   */
  /**
   * Pour chaque joueur, le club qu'il suit et qui joue ce match — ou rien.
   *
   * Une Map et non un ensemble : il ne suffit plus de savoir *si* le joueur
   * est concerné, il faut savoir **par quel club**, puisque son KOP est celui
   * de ce club-là.
   *
   * Une requête pour tout le monde, et non une par joueur : `fermer()` tourne
   * à la fin de chaque duel, et un aller-retour par participant sur un 5
   * contre 5 pour lire une table de deux lignes serait du gaspillage pur.
   */
  async function concernes(userIds, fixture) {
    const equipes = [fixture?.home?.id, fixture?.away?.id].filter(Number.isFinite);
    if (!userIds.length || !equipes.length) return new Map();
    const trous = userIds.map(() => '?').join(',');
    const rows = await q(
      `SELECT user_id, team_id FROM user_follows
        WHERE user_id IN (${trous}) AND team_id IN (${equipes.map(() => '?').join(',')})`,
      [...userIds, ...equipes]);
    // Un joueur peut suivre les deux clubs d’un derby : le premier suffit,
    // c’est le même doublement et le même KOP par club de toute façon.
    const m = new Map();
    for (const r of rows) if (!m.has(r.user_id)) m.set(r.user_id, r.team_id);
    return m;
  }

  /**
   * Verse les gains de fin de duel — et **dit ce qu'elle a versé**.
   *
   * Elle ne disait rien. Le joueur voyait son solde d'écharpes changer entre
   * deux écrans sans savoir ni combien ni pourquoi, et la part reversée à son
   * KOP n'existait que dans un message socket séparé, envoyé au milieu d'une
   * fin de partie — c'est-à-dire au moment où personne ne regarde encore.
   *
   * Le retour est indexé par joueur : c'est l'écran de fin qui décide de
   * l'ordre et de ce qu'il en montre.
   */
  /**
   * Les cinq derniers duels classés d'une poignée de joueurs.
   *
   * Une seule requête pour tout le monde, et non une par joueur : à cinq contre
   * cinq, dix requêtes au coup d'envoi pour afficher dix pastilles seraient dix
   * requêtes de trop.
   *
   * Le **plus récent d'abord** — c'est le sens dans lequel on lit une forme, et
   * celui qui a perdu ses quatre premiers et gagné le dernier ne raconte pas la
   * même chose que l'inverse.
   *
   * Un joueur sans historique rend une liste vide, jamais `null` : l'écran
   * affiche « premier duel », ce qui est une information, là où une absence
   * l'obligerait à deviner.
   */
  async function forme(userIds) {
    const vrais = [...new Set(userIds)].filter((u) => u && !String(u).startsWith('bot:'));
    const out = new Map(vrais.map((u) => [u, []]));
    if (!vrais.length) return out;
    try {
      /* `ended_at` est indexé avec `user_id` : on prend large et on coupe à
         cinq par joueur en mémoire. Une fenêtre par joueur en SQL demanderait
         une jointure latérale pour économiser quelques dizaines de lignes. */
      const trous = vrais.map(() => '?').join(',');
      const lignes = await q(
        `SELECT user_id, outcome, goals_for, goals_against, ended_at
           FROM duel_results
          WHERE user_id IN (${trous})
          ORDER BY ended_at DESC
          LIMIT ?`, [...vrais, vrais.length * 5]);
      for (const l of lignes) {
        const liste = out.get(l.user_id);
        if (liste && liste.length < 5) {
          liste.push({ issue: l.outcome, pour: l.goals_for, contre: l.goals_against });
        }
      }
    } catch (e) {
      /* La forme est un ornement. Une table absente ou une base lente ne doit
         pas empêcher un duel de commencer : on rend des listes vides, et
         l'affiche dit simplement qu'elle ne sait pas. */
      console.error('[nvn] forme récente', e.message);
    }
    return out;
  }

  /**
   * L'affiche : qui joue, avec quels Fanzzy, dans quel état de forme.
   *
   * Elle ne contient **que** ce que l'état ne dit pas déjà. Le score, la corde
   * et la main partent dix fois par seconde dans `vue()` ; l'affiche part une
   * fois, au coup d'envoi, et ne revient jamais.
   */
  async function affiche(duel) {
    const joueurs = [...duel.joueurs.values()];
    const formes = await forme(joueurs.map((j) => j.userId));
    return {
      id: duel.id, mode: duel.mode,
      stade: duel.stade
        ? { id: duel.stade.id, nom: duel.stade.nom, effet: duel.stade.effet } : null,
      joueurs: joueurs.map((j) => ({
        userId: j.userId, nom: j.nom, side: j.side,
        bot: String(j.userId).startsWith('bot:'),
        /* Tous ses Fanzzy, pas seulement celui qui entre : l'affiche montre
           l'équipe, et c'est en la voyant qu'on comprend qu'on peut changer. */
        fanzzy: j.fanzzy.map((f) => ({
          id: f.id, nom: f.nom, stade: f.stade ?? 1, type: f.type,
          // La tenue de son premier âge, celui qui entre : chacun paraît
          // sur l'affiche comme il l'a habillé.
          skin: f.tenues?.[f.stade ?? 1] || 'base',
          rar: f.rar, cri: f.cri?.label ?? null, geste: f.cri?.gest ?? null,
        })),
        forme: formes.get(j.userId) ?? [],
      })),
    };
  }

  async function recompenser(salle) {
    const d = salle.duel;
    const verse = new Map();
    try {
      // Un bot n'a pas de bourse, et lui en créer une inventerait un joueur.
      const humains = [...d.joueurs].filter(([userId]) => !userId.startsWith('bot:'));
      const clubs = await concernes(humains.map(([u]) => u), d.fixture);

      for (const [userId, j] of humains) {
        const gagne = d.vainqueur !== null && j.side === d.vainqueur;
        /* **Le forfait ne paie pas.** Un perdant qui est allé au bout touche
           le barème du perdu — il a joué, il a donné de la voix. Celui qui
           quitte la salle en cours de route ne touche rien : sans cela,
           partir quand ça tourne mal serait la façon la moins coûteuse de
           perdre, et le duel n’aurait plus d’enjeu dès le second but. */
        const aFuit = d.forfaits?.has(j.side);
        /* La prime entre dans `base`, donc avant le double du club **et**
           avant la part du KOP : ce que le groupe touche suit ce que son
           membre a gagné, ce qui est exactement ce que « une part » veut
           dire. Voir `primeDeFormat`.

           `baseDuDuel` est la formule même qui annonce `enJeu` sur la page
           de préparation : ce qui est promis est ce qui est versé. */
        const base = aFuit ? 0 : baseDuDuel(d.mode, d.format, gagne);
        const pourSonClub = clubs.has(userId);
        const montant = base * (pourSonClub ? DOUBLE_CLUB : 1);
        await assurerBourse(q, userId);
        await q(`UPDATE user_wallet SET scarves = scarves + ? WHERE user_id = ?`,
          [montant, userId]);
        verse.set(userId, { echarpes: montant, pourSonClub, xp: 0, kop: null });

        /* L'XP, elle, **ne double pas** pour son club.
           Les écharpes récompensent la ferveur, et il est juste qu'elles
           penchent du côté de son équipe. Le niveau mesure le temps passé à
           jouer : le doubler ferait d'un joueur qui suit trois gros clubs un
           joueur qui progresse deux fois plus vite, pour un choix fait à
           l'inscription. */
        /* Pas d’XP non plus pour un forfait : le niveau mesure le temps passé
           à jouer, et quitter la salle n’en est pas.

           **Ni la prime de format.** Pour la même raison : un 3v3 ne demande
           pas plus de temps qu’un 1v1, il demande plus de monde. Les
           écharpes paient l’attente et la coordination ; le niveau, lui, ne
           mesure que les parties jouées. */
        if (niveau && !aFuit) {
          const gain = (XP.duel[d.mode] ?? XP.duel.entrainement)
            + (gagne ? XP.victoire : 0);
          /* **Hors de toute transaction, et ça doit le rester.** `q` passe par
             le pool en validation automatique : l'`UPDATE` des écharpes
             ci-dessus est déjà validé quand `gagner()` prend, sur sa propre
             connexion, le verrou de la même ligne de `user_wallet`. Qui
             réunirait un jour ce versement dans une transaction devrait
             passer sa connexion à `niveau.gagnerDans()` : `gagner()`
             attendrait un verrou que l'appelant ne rend qu'après lui, puis
             perdrait l'XP au bout de l'attente (voir son pavé, dans
             `niveau/index.js`). */
          const m = await niveau.gagner(userId, gain);
          verse.get(userId).xp = gain;
          /* **La montée de palier voyage avec le bilan.**

             `gagner()` rend depuis toujours de quoi faire un écran — le
             niveau atteint, celui d’où l’on vient, les paliers franchis et
             les écharpes qu’ils versent — et cette ligne jetait tout. Un
             joueur montait de niveau à la fin d’un duel sans que rien ne le
             lui dise, et découvrait un troisième Fanzzy dans son deck des
             jours plus tard, s’il le remarquait.

             On ne le pose que s’il y a eu montée : un objet vide dans le
             bilan obligerait la page à savoir ce qu’est une montée nulle.
             Voir `niveau-fete.js`, qui n’a plus qu’à le recevoir. */
          if (m?.monte) verse.get(userId).montee = m;
          /* **La jauge, elle, voyage toujours** (CONTRATS.md § 1). L’anneau
             d’XP du bilan avance de `depart.part` à `part` à chaque duel, et
             pas seulement les soirs de montée : un anneau qui ne bouge que
             tous les deux duels ne dit pas qu’on progresse.

             Posée **seulement si l’XP est vraiment entrée** : `gagner()` rend
             un objet vide sans lever quand la base refuse, et un anneau qui
             avancerait sur une XP jamais créditée mentirait. Un `gain` nul ou
             absent, c’est « rien n’a été versé ». `montee` reste à côté, tel
             quel, pour `niveau-fete.js`. */
          if (Number(m?.gain) > 0) verse.get(userId).niveau = m;
        }

        /* La part du club, versée au pot du KOP.

           Elle **s’ajoute**, elle ne se prend pas au joueur : le même geste
           sert les deux, et il n’y a aucune raison de faire choisir entre soi
           et son groupe.

           Sans KOP, elle est perdue — et on le dit, sur le socket de ce
           joueur. C’est toute la raison d’en créer un, et une écharpe qui
           disparaît sans un mot ne donne envie de rien. */
        if (kop && pourSonClub) {
          const part = Math.round(base * kop.PART_POT);
          const r = await kop.verser(userId, clubs.get(userId), part);
          const m = salle.membres.get(userId);
          if (r.sansKop) {
            m?.socket?.emit('nvn:kop', { sansKop: true, teamId: clubs.get(userId),
              perdu: part });
            verse.get(userId).kop = { sansKop: true, perdu: part };
          } else if (r.verse) {
            m?.socket?.emit('nvn:kop', { verse: r.verse, kop: r.nom });
            verse.get(userId).kop = { verse: r.verse, nom: r.nom };
          }
        }
      }
    } catch (e) {
      // Un duel qui s'est bien joué ne doit pas se terminer en erreur parce
      // que la bourse n’a pas pu être créditée. On le dit et on continue.
      console.error('[nvn] écharpes de fin de duel', e.message);
    }
    return verse;
  }

  /**
   * L'issue d'un joueur, telle que la ligne et la cote la lisent.
   *
   * Écrite une fois : la cote se calcule maintenant avant le bilan et la
   * ligne s'écrit après, et deux façons de dire « nul » finiraient par ne
   * plus désigner les mêmes parties.
   */
  const issueDe = (d, j) => (d.vainqueur === null || d.vainqueur === undefined ? 'draw'
    : (j.side === d.vainqueur ? 'win' : 'loss'));

  /**
   * La cote de chacun, avant et après ce duel : `userId → { avant, apres }`.
   *
   * Vide hors classé et sans humain : l'entraînement s'écrit, il ne cote pas,
   * et un bot n'a pas de cote. Lève si la base ne répond pas, et c'est
   * l'appelant qui décide de ce qu'une cote illisible coûte.
   *
   * ## Pourquoi avant le bilan
   *
   * La cote se calculait **après** l'envoi de `nvn:fin`, au moment d'écrire
   * la ligne : le bilan ne pouvait donc pas la montrer, et le joueur
   * apprenait ce que le duel lui avait coûté en allant lire le classement.
   * Elle passe avant, et la ligne réemploie exactement ces valeurs : le
   * bilan et le classement ne peuvent pas dire deux cotes différentes.
   *
   * ## Pourquoi deux mesures et non tout l'historique (P7)
   *
   * On lisait **toutes** les parties classées de chaque joueur pour garder la
   * première et compter les autres. Un habitué à mille duels faisait donc
   * remonter mille lignes à chaque fin de partie, pour en garder une et un
   * nombre. La base rend maintenant les deux directement : la dernière cote,
   * par l'index `(user_id, mode, ended_at)` lu à l'envers, et le compte, qui
   * décide du coefficient (plus grand pendant les dix premières parties).
   */
  async function coter(d) {
    const humains = [...d.joueurs.entries()].filter(([id]) => !id.startsWith('bot:'));
    const out = new Map();
    if (d.mode !== 'classe' || !humains.length) return out;

    const ids = humains.map(([id]) => id);
    /* Une requête pour toute la salle : le compte par joueur, et sa dernière
       ligne classée prise par une sous-requête. Les parties d'entraînement
       n'entrent ni dans l'une ni dans l'autre. */
    const [lignes] = await pool.query(
      `SELECT c.user_id, c.n,
              (SELECT r.elo_after FROM duel_results r
                WHERE r.user_id = c.user_id AND r.mode = 'classe'
                ORDER BY r.ended_at DESC LIMIT 1) AS elo_after
         FROM (SELECT user_id, COUNT(*) AS n FROM duel_results
                WHERE user_id IN (?) AND mode = 'classe'
                GROUP BY user_id) c`, [ids]);

    /* Un joueur sans partie classée n'a pas de ligne : il part de la cote de
       départ, avec le coefficient des débuts. */
    const cotes = new Map(ids.map((id) => [id, COTE_DEPART]));
    const jouees = new Map(ids.map((id) => [id, 0]));
    for (const l of lignes) {
      jouees.set(l.user_id, Number(l.n) || 0);
      cotes.set(l.user_id, Number(l.elo_after) || COTE_DEPART);
    }

    /* **Un camp est noté par sa moyenne.** Un 3v3 n'est pas trois duels :
       c'est une équipe contre une autre. Chaque joueur est donc évalué contre
       la cote moyenne du camp d'en face, et tous les membres d'un camp gagnent
       ou perdent la même chose. Les noter un par un contre un adversaire tiré
       au hasard donnerait trois résultats différents pour une seule partie, et
       personne ne saurait expliquer lequel est le sien.

       **Seul le classé cote**, et ce tri se fait ici plutôt qu'à la lecture :
       une cote est cumulative, la trier après coup demanderait de la
       recalculer depuis le début à chaque affichage. Les bots n'ont pas de
       ligne, donc pas de cote. */
    const moyenneDe = (side) => coteMoyenne(
      humains.filter(([, x]) => x.side === side).map(([id]) => cotes.get(id)));
    for (const [id, j] of humains) {
      const avant = cotes.get(id);
      out.set(id, {
        avant,
        apres: coteApres(avant, moyenneDe(j.side ^ 1), issueDe(d, j), jouees.get(id)),
      });
    }
    return out;
  }

  async function fermer(salle) {
    /* **Une salle ne se ferme qu'une fois** (E1).

       Deux chemins y menaient pour un même forfait : `diffuser` voit le duel
       terminé et ferme, puis le gestionnaire de `nvn:forfait` fermait à son
       tour. Les deux passaient le premier `await` avant que l'un ait fini, et
       le joueur resté touchait deux fois ses écharpes, son XP et la part de
       son KOP. La garde est **synchrone**, avant tout `await` : c'est ce qui la
       rend sûre dans une boucle d'événements, sans verrou. */
    if (salle.fermee) return;
    salle.fermee = true;
    clearInterval(salle.timer);
    const d = salle.duel;
    salles.delete(d.id);
    /* **On ne retire que ce qui pointe encore ici.** Un joueur dont la place a
       été reprise — sa grâce épuisée — reçoit « slot_lost » à sa reprise, la
       page lui rouvre la préparation, et il peut repartir en file pendant que
       ce duel-ci continue sans lui. Un second duel le réinscrit alors dans
       `salleDe`. Effacer son entrée sans regarder effaçait celle de ce
       **second** duel à la fermeture du premier : ses chants et ses cartes y
       étaient refusés pour « aucun duel », et une page rechargée ne l'y
       remettait plus. */
    for (const userId of salle.membres.keys()) {
      if (salleDe.get(userId) === d.id) salleDe.delete(userId);
    }

    // Un duel rapporte toujours quelque chose, classé ou non.
    //
    // L'entraînement ne rapportait rien du tout : on pouvait y passer une
    // heure et repartir les mains vides, ce qui en faisait un didacticiel
    // plutôt qu'une façon de jouer. Il paie maintenant, moins qu'un duel
    // classé, et il reste hors du classement — c'est là qu'est la différence,
    // pas dans la récompense.
    const gains = await recompenser(salle);

    /* **La cote, avant le bilan** (CONTRATS.md § 4.1).

       Une base qui ne répond pas ne vole pas la fin de partie : le bilan part
       sans ligne de cote, ce que le contrat prévoit. La ligne de résultat, elle,
       ne s'écrit pas — voir plus bas, c'était déjà le cas quand la lecture
       vivait dans le même bloc que l'écriture. */
    let cotes = new Map();
    let coteIllisible = false;
    try {
      cotes = await coter(d);
    } catch (e) {
      coteIllisible = true;
      console.error('[nvn] cote illisible, bilan envoyé sans elle', e.message);
    }
    for (const [userId, c] of cotes) {
      const g = gains.get(userId);
      if (g) g.cote = { avant: c.avant, apres: c.apres, delta: c.apres - c.avant };
    }

    /* **L'écran de fin.**
     *
     * Rien n'annonçait la fin d'un duel : le client la déduisait du drapeau
     * `termine` dans un état parmi dix par seconde, et posait un voile gris
     * avec un mot dessus. Cinq minutes de jeu se terminaient sur moins qu'un
     * message d'erreur.
     *
     * Le bilan part **avant** l'écriture en base : un joueur n'a pas à attendre
     * une requête pour savoir s'il a gagné, et une base indisponible ne doit
     * pas lui voler sa fin de partie. La seule lecture qui le précède est celle
     * de la cote, qu'il montre. */
    {
      const bilan = d.bilan();
      /* **Ce que les gestes ont donné** (CONTRATS.md § 17) : les PARFAITS, la
         meilleure série, le meilleur chant, joueur par joueur — bots compris,
         qui ont les leurs et ne touchent rien. Ajoutés ici et non dans
         `bilan()` : le moteur ne connaît pas le verdict. */
      bilan.joueurs = bilan.joueurs.map((j) =>
        ({ ...j, ...resumeDuCompte(salle.comptes?.get(j.userId)) }));
      for (const [userId, m] of salle.membres) {
        if (!m.socket?.connected) continue;
        m.socket.emit('nvn:fin', { ...bilan, gains: gains.get(userId) ?? null,
          /* **Sa ligne porte `moi: true`**, celle de chacun dans son envoi :
             TOI/LUI, son meilleur geste et sa carte préférée se lisent sur
             elle. La page la cherchait au camp et à la ferveur, ce qui ne
             départage pas deux joueurs d'une même tribune à égalité. */
          joueurs: bilan.joueurs.map((j) => (j.userId === userId ? { ...j, moi: true } : j)) });
      }
    }

    /* **Les nuls s'écrivent aussi.**
     *
     * Seuls les duels classés **avec un vainqueur** étaient enregistrés. La
     * table accepte pourtant `draw` depuis le premier jour : les matchs nuls
     * n'étaient donc nulle part, et « tes cinq derniers duels » aurait menti
     * par omission — en oubliant exactement les parties les plus serrées.
     *
     * ## Et l'entraînement aussi, désormais
     *
     * Il restait dehors, parce qu'il ne compte pas — c'est toute sa différence
     * avec le duel classé. Mais « ne pas compter » et « ne pas exister » sont
     * deux choses : un joueur qui a passé une soirée à s'entraîner ne trouvait
     * aucune trace de sa soirée, et son parcours commençait au premier classé.
     *
     * La ligne porte donc sa **sorte** — `mode` et `format` — et ce sont les
     * classements qui écartent l'entraînement, à la lecture, là où la règle se
     * décide. C'est le sens de ces deux colonnes : ne rien perdre à
     * l'écriture, et trier à la lecture.
     */
    try {
      /* **Le duel rapporte de la ferveur**, la même que le Virage — le moteur
         la compte par joueur depuis le premier jour, elle n'était simplement
         écrite nulle part. Un duel ne pouvait donc compter dans aucun
         classement, et le mot « points » du jeu n'avait qu'une source.

         Le match support donne la compétition : elle n'est pas recopiée ici,
         `fixtures` la porte déjà. Le club, lui, est celui qu'on suit parmi les
         deux — et à défaut on est neutre, la ferveur vaut moitié et ne
         rapporte à aucune tribune. C'est la règle du Virage, appliquée telle
         quelle : venir jouer sur le match des autres se fait, mais on ne se
         bâtit une réputation que chez soi. */
      const f = d.fixture ?? null;
      const neutreCoef = reglage('ferveur.neutre');

      /* La durée, calculée **une fois pour la partie** : c'est la même pour
         tout le monde, et la relire par joueur donnerait six valeurs qui ne
         peuvent que diverger. `dernier` est le dernier battement d'horloge, et
         non l'instant présent : entre la fin du jeu et cette écriture il y a
         les écharpes, l'XP et les KOP, et les compter dans la durée du duel
         ferait grandir la partie de ce que le serveur a mis à la ranger. */
      const duree = Math.round(Math.max(0, (d.dernier ?? d.debut) - d.debut) / 1000);

      /* **Une cote illisible n'écrit pas de ligne classée.** La ligne porte la
         cote d'avant et celle d'après, et le classement des duellistes lit la
         dernière : écrire la cote de départ faute de mieux remettrait le joueur
         à mille, sans un mot. C'est ce qui se passait déjà quand la lecture et
         l'écriture vivaient dans le même bloc — on le garde, en le disant. */
      if (coteIllisible) {
        console.error('[nvn] duel classé non enregistré, faute de cote lisible', d.id);
        return;
      }

      for (const [userId, j] of d.joueurs) {
        if (userId.startsWith('bot:')) continue;
        const adverse = [...d.joueurs.values()].find((x) => x.side !== j.side);
        const issue = issueDe(d, j);

        /* Le camp, le club et le renfort ont été décidés à l'entrée en file :
           on les relit sur la salle plutôt que d'interroger la base une
           seconde fois pour une réponse qui pourrait avoir changé entre-temps. */
        const m = salle.membres.get(userId);
        const ferveur = Math.max(0, Math.round((j.ferveur ?? 0)
          * (m?.neutre === false ? 1 : neutreCoef) * (m?.bonus ?? 1)));

        /* ------------------------------------- ce que la ligne dit désormais

           **Le Fanzzy aligné au coup d'envoi**, et non les remplaçants entrés
           en cours de route : `vus` les porte tous, dans l'ordre, et c'est le
           premier qui est le titulaire. C'est de lui qu'on se souvient.

           **L'XP versée**, relue sur `gains` — la carte que `recompenser` vient
           de rendre — plutôt que recalculée ici. Deux calculs de la même
           récompense finiraient par ne plus dire la même chose, et c'est
           l'écran du parcours qui annoncerait le mauvais chiffre. Nulle pour un
           forfait, parce que `recompenser` n'en verse pas.

           **Le camp**, sans lequel on ne peut pas reconstituer qui jouait avec
           qui : les lignes d'un même duel partagent `duel_id`, mais sur un
           match nul les deux côtés portent exactement les mêmes buts. Déduire
           le camp des scores échouerait donc précisément sur les parties les
           plus serrées. */
        /* ------------------------------------------------------- la cote

           Deux colonnes existaient depuis le premier jour — `elo_before` et
           `elo_after` — et **rien ne les avait jamais écrites** : mille partout,
           sur toutes les lignes. Un schéma qui décrit un classement qui n'existe
           pas se lit comme une fonction débranchée, et quelqu'un finit par bâtir
           dessus.

           Ce sont **les valeurs mêmes que le bilan a montrées** : `coter` les
           a calculées avant `nvn:fin`, et la ligne les recopie. Recalculer ici
           pourrait donner une autre cote que celle annoncée au joueur, si une
           autre partie s'était rangée entre-temps.

           Hors classé, `coter` ne rend rien et les deux colonnes valent la cote
           de départ, comme avant : la partie s'écrit, elle ne cote pas. Ce n'est
           pas un effacement — la cote se lit sur les seules lignes classées, ici
           comme au classement des duellistes. Écrire zéro dirait « il a tout
           perdu », ce qui est faux. */
        const avant = cotes.get(userId)?.avant ?? COTE_DEPART;
        const apres = cotes.get(userId)?.apres ?? avant;

        await q(
          `INSERT IGNORE INTO duel_results
             (duel_id, user_id, opponent_id, outcome, goals_for, goals_against,
              fixture_id, team_id, ferveur, format, mode,
              fanzzy_id, xp, duree_s, side, elo_before, elo_after, ended_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3))`,
          [d.id, userId, adverse?.userId ?? 'inconnu', issue,
           d.goals[j.side], d.goals[j.side ^ 1],
           f?.id ?? null, m?.teamId ?? null, ferveur, d.format ?? null,
           d.mode ?? 'entrainement',
           j.vus?.[0] ?? null, Number(gains?.get(userId)?.xp ?? 0), duree, j.side,
           avant, apres]);
      }
    } catch (e) {
      console.error('[nvn] enregistrement du résultat', e.message);
    }
  }

  /* ------------------------------------------------------------ socket */

  const MAX_ACTIONS_10S = 30;

  function limite(socket) {
    const t = Date.now();
    const b = (cadence.get(socket) ?? []).filter((x) => t - x < 10_000);
    if (b.length >= MAX_ACTIONS_10S) return false;
    b.push(t); cadence.set(socket, b);
    return true;
  }

  io.on('connection', (socket) => {
    const moi = () => socket.data?.user ?? null;
    const maSalle = () => {
      const u = moi();
      const id = u ? salleDe.get(u.userId) : null;
      return id ? salles.get(id) : null;
    };

    const erreur = (e) => socket.emit('nvn:error',
      { code: e instanceof Cheat ? e.code : 'nvn.error.server' });

    socket.on('nvn:queue', async (p = {}) => {
      try { await entrerEnFile(socket, p); }
      catch (e) {
        if (!(e instanceof Cheat)) console.error('[nvn] file', e.message);
        socket.emit('nvn:error', { code: e.code ?? 'nvn.error.server' });
      }
    });

    /**
     * Quitter un duel en cours : le **forfait**.
     *
     * ## Ce qui se passait avant
     *
     * Rien. On fermait l'onglet, la salle attendait quatre-vingt-dix secondes,
     * puis retirait le joueur « sans le punir » — et le duel continuait à un
     * contre zéro jusqu'au temps réglementaire. Celui qui restait gagnait sa
     * partie en regardant une corde immobile pendant trois minutes, et celui
     * qui partait ne perdait rien du tout.
     *
     * Partir sans conséquence est la meilleure façon de rendre une défaite
     * gratuite : il suffit de sortir quand ça tourne mal.
     *
     * ## Ce qui se passe maintenant
     *
     * Le duel **se termine sur-le-champ**, avec le camp resté en place pour
     * vainqueur. Celui qui part perd, et un perdant par forfait ne touche
     * rien — ni écharpes, ni XP. Celui qui reste touche exactement ce qui était
     * prévu : il a joué, il n'y est pour rien.
     *
     * La coupure réseau, elle, garde ses quatre-vingt-dix secondes de grâce :
     * un tunnel n'est pas un abandon, et les confondre punirait le métro.
     * C'est toute la différence entre ce message, que le joueur envoie
     * exprès, et une déconnexion, qu'il subit.
     */
    socket.on('nvn:forfait', () => {
      const u = moi();
      const salle = maSalle();
      if (!u || !salle || salle.duel.termine) return;
      const m = salle.duel.joueurs.get(u.userId);
      if (!m) return;
      /* Les événements que `forfait` produit — dont le `over` qui annonce le
         vainqueur — sont **collectés et diffusés**. Le premier jet appelait
         `forfait(side)` sans recueillir son tableau : la fin de duel partait
         dans un tableau jeté, et les deux écrans restaient sur la corde
         pendant que la bourse, elle, était déjà payée. */
      const evs = salle.duel.forfait(m.side);
      evs.push({ seq: ++salle.duel.seq, t: 'forfait', userId: u.userId, side: m.side });
      /* `diffuser` voit le duel terminé et appelle `fermer`, qui verse et
         enregistre ; le camp qui part est déjà marqué (voir `recompenser`, qui
         ne donne rien à un forfaitaire). **On ne ferme pas une seconde fois
         ici** : c'est cet appel en double qui payait deux fois le joueur resté
         (E1). La garde de `fermer` suffirait seule, mais un appel qui ne sert
         à rien n'a pas à rester pour que la garde ait quelque chose à faire. */
      diffuser(salle, evs);
    });

    socket.on('nvn:leave_queue', () => {
      const u = moi();
      if (u) quitterFile(u.userId);
    });

    for (const [evt, fn] of [
      /* L'instant est pris **une fois** et passé au moteur : le verdict est
         rejoué juste avant lui, et les deux doivent lire les effets en cours
         au même instant. Voir `chanterEtNommer`. */
      ['nvn:chant', (salle, u, p) =>
        chanterEtNommer(salle.duel, salle.comptes, u.userId, p, Date.now())],
      /* La carte, par le chemin qui note ce qu'elle pose (durée, camp) : voir
         `jouerEtMarquer`. Le même instant pour le moteur et pour la durée. */
      ['nvn:play', (salle, u, p) =>
        jouerEtMarquer(salle.duel, u.userId, String(p?.cardId), Date.now())],
      ['nvn:swap', (salle, u, p) => salle.duel.changer(u.userId, Number(p?.index))],
    ]) {
      socket.on(evt, (p = {}) => {
        const u = moi();
        const salle = maSalle();
        if (!u || !salle) return socket.emit('nvn:error', { code: 'nvn.error.not_in_duel' });
        if (!limite(socket)) return socket.emit('nvn:error', { code: 'nvn.error.rate_limited' });
        try { diffuser(salle, fn(salle, u, p)); }
        catch (e) { erreur(e); }
      });
    }

    /** Reprise après coupure : la place attendait. */
    socket.on('nvn:resume', () => {
      const u = moi();
      const salle = maSalle();
      if (!u || !salle) return socket.emit('nvn:error', { code: 'nvn.error.not_in_duel' });
      const m = salle.membres.get(u.userId);
      if (!m || m.parti) return socket.emit('nvn:error', { code: 'nvn.error.slot_lost' });
      m.socket = socket;
      m.coupeA = null;
      socket.join(salle.room);
      socket.emit('nvn:start', vuePour(salle.duel, u.userId));
      io.to(salle.room).emit('nvn:events',
        [{ seq: ++salle.duel.seq, t: 'back', userId: u.userId }]);
    });

    socket.on('disconnect', () => {
      const u = moi();
      if (!u) return;
      quitterFile(u.userId);
      const salle = maSalle();
      const m = salle?.membres.get(u.userId);
      if (!m) return;
      m.socket = null;
      m.coupeA = Date.now();
      io.to(salle.room).emit('nvn:events', [{
        seq: ++salle.duel.seq, t: 'disconnected', userId: u.userId,
        graceMs: GRACE_MS,
      }]);
    });
  });

  /* ---------------------------------------------- bascule vers les bots */

  const veille = setInterval(() => {
    const t = Date.now();
    /* Un tour par **match et format**, et non par file : le repli regarde les
       deux camps ensemble, et les traiter séparément le ferait deux fois — ou
       ouvrirait deux duels là où un seul devait partir. */
    const vus = new Set();
    for (const [c, file] of [...files]) {
      if (!file.length) continue;
      const fixtureId = Number(file[0].support?.fixture?.id);
      const paire = `${file[0].format}:${fixtureId}`;
      if (vus.has(paire)) continue;
      vus.add(paire);

      const attente = attenteAvantBots(file[0].support?.mode);
      /* Le plus ancien des **deux** camps : celui qui attend depuis le début
         est celui dont la patience décide, quel que soit son côté. */
      const deux = [0, 1].map((camp) =>
        files.get(cle(file[0].format, fixtureId, camp)) ?? []).flat();
      if (!deux.length) continue;
      const ecoule = t - Math.min(...deux.map((f) => f.depuis));

      /* **Le repli d'abord, les bots ensuite.** Un 3v3 accepte de partir à 2v2
         au tiers de l'attente, à 1v1 aux deux tiers — entre de vrais gens, donc
         classé. Les machines ne viennent qu'au bout, et elles déclassent.
         Jouer plus petit contre des humains vaut mieux que jouer grand contre
         des bots. */
      if (ecoule > attente) { ouvrirAvecBots(c); continue; }
      const seuil = tailleAcceptee(FORMATS[file[0].format], ecoule, attente);
      if (seuil < FORMATS[file[0].format]) {
        tenterAppariement(file[0].format, fixtureId, seuil);
      }
      /* **Et à travers les formats.** Le repli ci-dessus fait descendre une
         file dans **sa** clé ; il ne rapproche pas deux personnes qui
         attendent sur le même match dans deux formats différents — le cas le
         plus fréquent d’un soir creux. `tenterLarge` les rassemble.

         Du plus grand au plus petit : quatre personnes qui peuvent faire un
         2v2 ne doivent pas se retrouver à deux duels de 1v1. */
      for (let k = Math.max(...Object.values(FORMATS)); k >= 1; k--) {
        if (tenterLarge(fixtureId, k, t)) break;
      }
    }
  }, 2000);
  veille.unref?.();

  /* ------------------------------------------------------------ routes */

  const router = express.Router();

  /* ==================================================== qui attend, et où

     Jusqu'ici, personne ne voyait rien. On choisissait un format, un match, un
     camp, on appuyait, et on attendait **seul et aveugle** : deux joueurs
     pouvaient attendre au même moment sur deux matchs différents sans jamais
     se croiser. C'était la moitié manquante du duel par camps — le bonus du
     camp délaissé ne sert à rien si personne ne voit qu'un camp est délaissé.

     **On dit combien, et de quel côté. Jamais qui.** Cela suffit à décider, ne
     révèle les habitudes de personne, et reste juste quand quelqu'un se
     déconnecte entre deux affichages.

     Rien n'est écrit en base : une file vit deux minutes, le temps qu'on est
     devant l'écran. C'est un panneau d'affichage, pas un carnet de
     rendez-vous.                                                            */

  /** Les files regroupées par match et par format, telles qu'on les montre. */
  function filesParMatch() {
    const parMatch = new Map();
    for (const file of files.values()) {
      if (!file.length) continue;
      const { format, camp, support } = file[0];
      const fixture = support?.fixture;
      if (!fixture?.id) continue;
      const cle = `${fixture.id}:${format}`;
      const e = parMatch.get(cle) ?? {
        fixtureId: Number(fixture.id), format,
        attendus: FORMATS[format] ?? 1,
        camps: [0, 0],
        clubs: [fixture.home, fixture.away],
        mode: support.mode,
      };
      e.camps[camp] = file.length;
      parMatch.set(cle, e);
    }
    return [...parMatch.values()];
  }

  /**
   * L'annonce des files à tous ceux qui préparent un duel.
   *
   * Diffusée plutôt que sondée : entre « 2 t'attendent » et « 2 t'attendaient
   * il y a trente secondes », il y a toute la différence entre une invitation
   * et une déception. Le contenu est le même pour tout le monde — c'est la
   * page qui sait quels clubs sont les siens, et qui n'a donc rien à demander.
   */
  const annoncerAttentes = () => io.emit('nvn:attentes', { attentes: filesParMatch() });

  /**
   * Ce qui mérite de déranger quelqu'un sur l'accueil.
   *
   * **Une seule attente, la plus pertinente**, et rien du tout le reste du
   * temps : une alerte allumée en permanence cesse d'être une alerte, on
   * vient de l'apprendre avec la pastille du Virage.
   *
   * L'ordre dit ce qui compte : d'abord un match d'un de mes clubs, puis la
   * file la plus remplie — c'est celle qui partira le plus vite, donc celle où
   * mon arrivée change quelque chose.
   */
  async function alertePour(userId) {
    const attentes = filesParMatch().filter((a) => a.camps.some((n) => n > 0));
    if (!attentes.length) return null;

    const suivis = new Set((await q(
      `SELECT team_id FROM user_follows WHERE user_id = ?`, [userId]))
      .map((r) => r.team_id));

    const avecMien = attentes.map((a) => ({
      ...a,
      mien: a.clubs.some((c) => suivis.has(c?.id)),
      presents: a.camps[0] + a.camps[1],
    }));
    avecMien.sort((x, y) => (y.mien - x.mien) || (y.presents - x.presents));

    const a = avecMien[0];
    /* Le camp où il manque du monde : c'est celui qu'on propose de tenir, et
       c'est là que la ferveur vaut davantage. À égalité, celui d'en face de
       ceux qui attendent déjà. */
    const manque = a.camps[0] <= a.camps[1] ? 0 : 1;
    return { ...a, campQuiManque: manque, manque: Math.max(0, a.attendus - a.camps[manque]) };
  }

  router.get('/attentes', requireAuth, async (req, res) => {
    try {
      res.json({ attentes: filesParMatch(), alerte: await alertePour(req.user.id) });
    } catch (e) {
      console.error('[nvn] attentes', e.message);
      res.status(503).json({ error: 'nvn.error.server' });
    }
  });

  router.get('/etat', requireAuth, (req, res) => {
    res.json({
      formats: Object.keys(FORMATS),
      files: [...files].map(([c, f]) => ({ cle: c, presents: f.length })),
      salles: salles.size,
      duelEnCours: salleDe.get(req.user.id) ?? null,
    });
  });

  /**
   * Ce joueur est-il en duel ? Lu par la présence (CONTRATS.md § 18 : l'état
   * `duel`, « dans un duel ou en file d'attente »).
   *
   * **Dans une salle** dont le duel n'est pas fini et où sa place tient
   * encore : une coupure réseau garde sa place quatre-vingt-dix secondes, et
   * il est en duel pendant ce temps-là, puisqu'il peut y revenir ; sa grâce
   * épuisée (`parti`), il ne l'est plus, même si sa place attend la fin pour
   * se libérer. **Ou dans une file**, quel qu'en soit le format.
   *
   * Mémoire seule, aucune requête : la présence le demande pour chaque ami
   * d'une liste, et ces deux tables sont déjà là.
   */
  function estEnDuel(userId) {
    if (userId == null) return false;
    const id = salleDe.get(userId);
    const salle = id ? salles.get(id) : null;
    if (salle && !salle.duel.termine && !salle.membres.get(userId)?.parti) return true;
    for (const file of files.values()) {
      if (file.some((f) => f.userId === userId)) return true;
    }
    return false;
  }

  /* `accepte` est exporté pour les tests : la borne haute — « jamais plus
     grand que ce qui a été demandé » — ne se voit pas depuis une socket, et
     c’est pourtant elle qui empêche un 1v1 de finir dans un 5v5. */
  return { router, salles, files, filesParMatch, alertePour, accepte,
           ouvrir, ouvrirAvecBots, tenterAppariement, butReel, estEnDuel,
           /* `fermer` n'est appelée par aucun autre module : elle n'est exposée
              qu'aux suites, qui doivent pouvoir la frapper deux fois de suite
              pour voir qu'elle ne paie qu'une fois. Le nom dit à qui elle est
              destinée. */
           pourLesTests: { fermer },
           stop: () => { clearInterval(veille); for (const s of salles.values()) clearInterval(s.timer); } };
}
