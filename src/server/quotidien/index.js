/**
 * Le quotidien : les missions du jour et leur sachet, la carte de présence, la
 * série de jours, le carnet de tampons de la saison, le passage de relais, et
 * le ticket « depuis ta dernière visite » (`CONTRATS.md`, § 6 et § 8).
 *
 * ## Tout est décidé et versé par le serveur
 *
 * Le joueur ne déclare rien. Une mission se lit dans ce que le jeu a déjà
 * enregistré — un booster ouvert, un duel joué jusqu'au bout, un chant au
 * Virage —, et RÉCUPÉRER **recompte** avant de verser, sous le verrou du
 * joueur. Les montants ne viennent jamais de la requête : une mission verse ce
 * que porte sa ligne du jour, copiée au tirage du matin ; le bonus, ce que
 * disent les réglages à l'instant ; un palier, ce que dit le carnet de la
 * saison. Un corps qui porterait `{ echarpes: 9999 }` n'est pas lu.
 *
 * Tout versement passe par le grand livre (`src/server/recompenses.js`) : une
 * fois et une seule, entier ou rien, jamais au-delà du disjoncteur, jamais
 * sans sa ligne.
 *
 * ## Ce que ce module ne sait pas, exprès
 *
 * Il ne reçoit **ni l'abonnement, ni le KOP, ni les amis** (`verif-cablage`
 * le vérifie). Abonné et non-abonné reçoivent exactement les mêmes missions et
 * les mêmes montants ; le meilleur moyen de le garantir est que ce module ne
 * puisse pas savoir qui est abonné. Le plafond des duels classés se lit au
 * registre (`abo.duels_classes_jour`) et se compte comme le quota, sans
 * demander à personne si le joueur paie.
 *
 * ## Sans les tables, rien ne casse
 *
 * Une base sans `sql/quotidien.sql` rend `{ actif: false }`, en 200 : les
 * écrans retirent le quotidien, le reste du jeu tourne comme avant, et le
 * journal nomme le fichier à appliquer, une fois.
 */
import express from 'express';
import { verser, verserTout } from '../recompenses.js';
import { assurerBourse } from '../bourse.js';
import { reglage } from '../../shared/reglages.js';
import { saisonsLancees, saisonEnCours } from '../fanzzy/saisons.js';
import { carnetDe, finDeFenetre } from '../../shared/saison.js';
import {
  DIFFICULTES, RANG_SACHET, MISSION_PAR_ID, rangDe, montantsCarte, caseDuJour, serieDe,
  gainMission, gainSachet, choisir, remplacante, faitPour,
} from '../../shared/quotidien.js';
import {
  lireDuels, lirePresences, lireCompteurs, recompter, contexte, suivisDe, memoireDeJournee,
} from './missions.js';
import { lireDepuis, marquerVisite } from './depuis.js';

const JOUR = /^\d{4}-\d{2}-\d{2}$/;
const SCHEMA = new Set(['ER_NO_SUCH_TABLE', 'ER_BAD_FIELD_ERROR']);
const estSchema = (e) => SCHEMA.has(e?.code);

/* Un booléen rendu par la base : 1, '1', ou vrai selon le pilote. */
const vrai = (v) => v === true || v === 1 || v === '1';

/* ------------------------------------------------------------ le journal

   Une cause, une ligne. Le hub lit le quotidien à chaque arrivée : sans ce
   filtre, un fichier non appliqué noierait le journal sous la même phrase. */
const dejaDit = new Set();
function journaliser(cause) {
  const texte = String(cause ?? 'cause inconnue');
  if (dejaDit.has(texte) || dejaDit.size > 50) return;
  dejaDit.add(texte);
  console.error(`[quotidien] ${texte} — le quotidien vit dans sql/quotidien.sql : `
    + 'npm run schema:appliquer, puis redémarrer. Le reste du jeu tourne sans lui.');
}

/** Le gain d'une ligne du contrat du jour, sous la forme R5. */
const gainDe = (l) => ({
  echarpes: Number(l.echarpes ?? 0),
  packs: Number(l.packs ?? 0),
  xp: Number(l.xp ?? 0),
  tampons: Number(l.tampons ?? 0),
});

const resume = (s) => ({ id: Number(s.id), numero: Number(s.numero), nom: s.nom });

/* Les saisons lancées, de la plus ancienne à la plus récente **par
   lancement** — la même règle que `saisonEnCours()`, qui prend la dernière
   lancée. Ce n'est qu'un ordre : aucune durée ne se calcule sur `lanceeA`,
   dont le fuseau n'est pas garanti (`CONTRATS.md`, R4). */
let saisonsMuettes = false;
function lesSaisons() {
  try {
    const lancees = [...saisonsLancees()];
    lancees.sort((a, b) => (new Date(a.lanceeA) - new Date(b.lanceeA)) || (a.numero - b.numero));
    return { lancees, courante: saisonEnCours() };
  } catch (e) {
    /* Les saisons n'ont pas été chargées : c'est une faute de montage
       (`chargerCatalogue` les charge au démarrage). Sans elles, pas de carnet
       ni de relais — le reste du quotidien tient. */
    if (!saisonsMuettes) {
      saisonsMuettes = true;
      console.error('[quotidien] saisons illisibles, carnet et relais éteints :', e.message);
    }
    return { lancees: [], courante: null };
  }
}

/* ======================================================= la lecture du jour

   **Le jour et son reste**, en une requête : le jour de jeu (`CURDATE()`) et la
   veille en étiquettes `AAAA-MM-JJ`, ses bornes en secondes Unix, le temps
   qu'il lui reste — mesuré en secondes Unix des deux côtés, donc juste les
   jours de 23 h et de 25 h (`TIMESTAMPDIFF` compterait des heures murales, et
   le 25 octobre durerait 23 h 30 de trop peu à minuit et demi). Et, dans la
   même lecture : la bourse, la marque de visite (le ticket est-il dû ?), les
   clubs suivis, et la fenêtre de la saison en cours (`finDeFenetre`, la même
   borne que le classement et les divisions).

   sql-sur : le seul fragment interpolé est `finDeFenetre('s')`, une expression
   écrite par `src/shared/saison.js` à partir d'un alias du code, qu'il
   vérifie ; aucune valeur du joueur n'y entre, elles passent toutes par `?`. */
const SQL_JOUR = `
  SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS jour,
         DATE_FORMAT(CURDATE() - INTERVAL 1 DAY, '%Y-%m-%d') AS hier,
         UNIX_TIMESTAMP(CURDATE()) AS debut,
         UNIX_TIMESTAMP(CURDATE() + INTERVAL 1 DAY) AS fin,
         UNIX_TIMESTAMP(CURDATE() + INTERVAL 1 DAY) - UNIX_TIMESTAMP(NOW(3)) AS reste,
         w.scarves AS scarves,
         (w.visite_a IS NOT NULL AND w.visite_a <= NOW(3) - INTERVAL ? HOUR) AS ticket,
         UNIX_TIMESTAMP(NOW(3)) - UNIX_TIMESTAMP(w.visite_a) AS absence,
         w.instantane AS instantane,
         (SELECT GROUP_CONCAT(team_id) FROM user_follows WHERE user_id = ?) AS suivis,
         (SELECT NOW(3) >= ${finDeFenetre('s')} FROM saisons s WHERE s.id = ?) AS close
    FROM (SELECT 1) AS un
    LEFT JOIN user_wallet w ON w.user_id = ?`;

/* **Le contrat** : les lignes d'hier et d'aujourd'hui. */
const SQL_CONTRAT = `
  SELECT DATEDIFF(CURDATE(), jour) AS k, DATE_FORMAT(jour, '%Y-%m-%d') AS jour,
         rang, mission, cible, echarpes, packs, xp, tampons, saison_id, relancee
    FROM missions_jour
   WHERE user_id = ? AND jour >= CURDATE() - INTERVAL 1 DAY`;

/* **Le grand livre**, en une lecture : tous les bonus (la carte et la série
   s'en déduisent), les missions et sachets d'hier et d'aujourd'hui, les
   paliers du carnet et les relais versés, et les tampons de chaque saison.
   Les clés des missions commencent par le jour : `cle >= <hier>` les trouve
   par l'index de la clé primaire. */
const SQL_LIVRE = `
  SELECT source, cle, saison_id, DATEDIFF(CURDATE(), cle) AS ecart, NULL AS somme
    FROM recompenses WHERE user_id = ? AND source = 'bonus'
  UNION ALL
  SELECT source, cle, saison_id, NULL, NULL
    FROM recompenses WHERE user_id = ? AND source IN ('mission', 'sachet')
     AND cle >= DATE_FORMAT(CURDATE() - INTERVAL 1 DAY, '%Y-%m-%d')
  UNION ALL
  SELECT source, cle, saison_id, NULL, NULL
    FROM recompenses WHERE user_id = ? AND source IN ('carnet', 'relais')
  UNION ALL
  SELECT 'tampons', NULL, saison_id, NULL, SUM(tampons)
    FROM recompenses WHERE user_id = ? AND source IN ('mission', 'sachet') AND saison_id IS NOT NULL
   GROUP BY saison_id`;

/* Les tampons d'une saison, recomptés sous le verrou d'un versement. */
const SQL_TAMPONS = `
  SELECT COALESCE(SUM(tampons), 0) AS n FROM recompenses
   WHERE user_id = ? AND source IN ('mission', 'sachet') AND saison_id = ?`;

/**
 * La sonde du jour de jeu : à quelle heure de Zurich le jour change, d'après
 * l'horloge de la base.
 *
 * Le jour de jeu est celui de la base (`CURDATE()`), le même que celui des
 * quotas. Si la base de production n'est pas réglée sur l'heure de Zurich, il
 * change à une ou deux heures du matin — pour les missions **et** pour les
 * quotas, ensemble. Ce n'est pas une panne, c'est un réglage à décider une
 * fois la sonde lue (`SERVEUR.md`, § 2) ; il faut donc qu'elle se lise.
 *
 * Le minuit de la base est lu comme un instant (secondes Unix) et seulement
 * **affiché** à l'heure de Zurich : aucun jour n'est calculé ici.
 */
export async function sonderJourDeJeu(pool) {
  const [[r]] = await pool.query(
    `SELECT @@session.time_zone AS session, @@system_time_zone AS systeme,
            TIME_FORMAT(TIMEDIFF(NOW(), UTC_TIMESTAMP()), '%H:%i') AS decalage,
            UNIX_TIMESTAMP(CURDATE() + INTERVAL 1 DAY) AS minuit`);
  const changeA = new Intl.DateTimeFormat('fr-CH', {
    timeZone: 'Europe/Zurich', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(new Date(Number(r.minuit) * 1000));
  const decalage = String(r.decalage ?? '');
  return {
    changeA,
    heure: 'Europe/Zurich',
    base: {
      session: String(r.session ?? ''),
      systeme: String(r.systeme ?? ''),
      decalage: decalage.startsWith('-') ? decalage : `+${decalage}`,
    },
  };
}

/** La phrase du journal de démarrage, tirée de la sonde. */
export function phraseJourDeJeu(s) {
  const base = `fuseau de la base : ${s.base.session}${
    s.base.session === 'SYSTEM' ? ` (${s.base.systeme})` : ''}, ${s.base.decalage} sur UTC`;
  if (s.changeA === '00:00') {
    return `jour de jeu : le jour change à 00:00, heure de Zurich (${base})`;
  }
  return `jour de jeu : le jour change à ${s.changeA}, heure de Zurich (${base}). `
    + 'Missions, bonus et quotas gratuits basculent ensemble à cette heure ; un minuit '
    + 'exact à Zurich demande de régler le fuseau de la base, pour tous à la fois.';
}

/**
 * @param o.niveau      le module niveau : `gagnerDans(conn, userId, xp)` crédite
 *                      l'XP dans la transaction du versement
 * @param o.fanzzy      le module fanzzy : `recharger(conn, userId)` compte la
 *                      recharge due avant un booster offert
 * @param o.jourDuFoot  une fonction qui rend la journée du télétexte (lue au
 *                      moment de l'appel : le télétexte est monté après)
 * @param o.crochets    pour les suites seulement : `relanceAvantEcriture`,
 *                      appelé dans la transaction d'une relance, entre ses
 *                      contrôles et son écriture. Il rend la course entre une
 *                      relance et une réclamation **certaine** au lieu de
 *                      probable. Et `horloge`, l'instant en millisecondes
 *                      auquel se mesure l'âge du relevé de la journée : la
 *                      suite l'avance d'une minute au lieu de l'attendre.
 */
export function createQuotidien({ pool, requireAuth, niveau = null, fanzzy = null,
  jourDuFoot = null, crochets = {} }) {
  const q = async (sql, params = []) => (await pool.execute(sql, params))[0];
  const sur = (conn) => async (sql, params = []) => (await conn.execute(sql, params))[0];

  /* Le dernier relevé de la journée du football, noté par un tirage ou une
     relance, et seulement relu par la lecture de l'état : celle-ci ne lit
     jamais la journée elle-même (`missions.js`, les conditions). */
  const memoire = memoireDeJournee({ horloge: () => (crochets.horloge ?? Date.now)() });

  /* Les deux portes du grand livre, lues au moment du versement : le module
     fanzzy est monté avant celui-ci dans `server.js`, mais une suite peut les
     poser après. */
  const portes = () => ({ niveau, recharger: fanzzy?.recharger });

  /* ==================================== rien à aller chercher sous le verrou

     Pendant qu'un versement ou une relance tient le verrou de la bourse, il ne
     doit plus rien demander **au pool**. Huit réclamations simultanées du même
     joueur occupent sinon les huit connexions de la production : sept
     attendent le verrou, et celle qui le tient attend une neuvième connexion.
     Tout le serveur attend alors l'expiration du verrou, cinquante secondes.
     Et si huit joueurs différents en sont là au même instant, chacun sous son
     propre verrou, rien n'expire du tout.

     Deux lectures passaient par le pool sous le verrou. Elles sont faites
     avant de le prendre. */

  /**
   * **La recharge due, comptée avant le verrou.** Le grand livre appelle
   * `fanzzy.recharger` sous le verrou avant de créditer un booster offert, et
   * `recharger` lit l'abonnement (la cadence de la réserve, pas un montant)
   * dans un souvenir de deux minutes. Sans souvenir, elle passe par le pool
   * (`ECARTS.md`, fanzzy § 1). La même porte, appelée ici sur le pool et hors
   * de toute transaction, pose ce souvenir sans rien tenir, et compte déjà la
   * recharge due : son écriture est conditionnelle, elle ne peut pas écraser
   * un débit. Sous le verrou, il ne reste plus rien à aller chercher.
   *
   * Ce module ne lit toujours pas l'abonnement : c'est `fanzzy` qui le lit,
   * pour son rythme, comme à chaque `GET /api/fanzzy/state`. Un souvenir qui
   * expirerait entre les deux appels (il dure deux minutes, et celui-ci n'en
   * pose un neuf que s'il n'y en a pas) ramènerait le cas d'avant pour ce
   * seul versement. Une panne ici n'empêche rien : le versement recompte la
   * recharge sous le verrou, comme avant.
   */
  let prechauffeMuette = false;
  async function avantUnBooster(userId) {
    if (typeof fanzzy?.recharger !== 'function') return;
    try {
      await fanzzy.recharger(pool, userId);
    } catch (e) {
      if (!prechauffeMuette) {
        prechauffeMuette = true;
        console.error('[quotidien] recharge préalable impossible, le versement la refera sous '
          + 'le verrou :', e.message);
      }
    }
  }

  /* Ce qui, dans une réclamation groupée, peut porter un booster : le sachet,
     le relais, un palier du carnet qui en donne, et le bonus si sa septième
     case en donne. */
  const peutPorterUnBooster = (v) => v.source === 'sachet' || v.source === 'relais'
    || (v.source === 'carnet' && Number(v.gain?.packs) > 0)
    || (v.source === 'bonus' && reglage('bonus.j7_packs') > 0);

  /**
   * **La journée du football, lue avant le verrou.** La relance cherche sa
   * remplaçante sous le verrou de la bourse, et une mission du Virage demande
   * la journée : `teletext.jour` passe par le pool (son cache est une table).
   * On la lit donc d'abord, et l'on rend une fonction qui la sert telle
   * quelle — ou qui relève son erreur, pour que `journeeParId` la dise au
   * journal comme d'habitude. Une lecture de la journée par relance, au
   * plus : c'est le cache de `/matchs`, et l'API n'est appelée qu'à son
   * expiration, au même rythme qu'aujourd'hui, quel que soit le nombre de
   * lecteurs.
   */
  async function journeeDejaLue() {
    if (!jourDuFoot) return null;
    let lue;
    try { lue = { j: await jourDuFoot() }; } catch (e) { lue = { e }; }
    return () => {
      if (lue.e) throw lue.e;
      return lue.j;
    };
  }

  /* ===================================================== le tirage du jour */

  /**
   * Tire les missions du jour, à la première lecture du jour.
   *
   * Pour chaque difficulté, la première mission de l'ordre du jour (commun à
   * tous) qui est active et faisable pour ce joueur, en évitant celle d'hier
   * au même rang quand une autre l'est. Les gains sont **copiés** dans la
   * ligne : le joueur reçoit ce qu'on lui a promis le matin, même si un
   * réglage change à midi. Le sachet est la quatrième ligne, figée de même.
   *
   * Une seule instruction, `INSERT IGNORE` : deux onglets qui tirent ensemble
   * écrivent la même chose (le tirage est déterministe), et la seconde
   * écriture ne fait rien. Si elle n'a pas tout écrit, c'est qu'un autre
   * passage a tiré avant : la base fait foi, on la relit.
   */
  async function tirer(userId, { jour, veille, ctx, saisonId }) {
    const lignes = [];
    for (const difficulte of DIFFICULTES) {
      const rang = rangDe(difficulte);
      const dHier = veille.find((l) => Number(l.rang) === rang)?.mission ?? null;
      const id = await choisir({ jour, difficulte, faisable: ctx.faisable, hier: dHier });
      if (!id) continue;
      lignes.push({ rang, mission: id, cible: MISSION_PAR_ID.get(id).cible,
        ...gainMission(difficulte, { avecSaison: saisonId != null }) });
    }
    /* Une difficulté dont toutes les missions sont éteintes n'a pas de ligne :
       la liste en compte moins de trois, et le sachet les demande toutes. Sans
       aucune mission, pas de sachet non plus. */
    if (!lignes.length) return [];
    lignes.push({ rang: RANG_SACHET, mission: 'sachet', cible: lignes.length,
      ...gainSachet({ avecSaison: saisonId != null }) });

    /* sql-sur : on n'interpole que des groupes de « ? », un par ligne tirée ;
       toutes les valeurs passent par les paramètres. */
    const r = await q(
      `INSERT IGNORE INTO missions_jour
         (user_id, jour, rang, mission, cible, echarpes, packs, xp, tampons, saison_id)
       VALUES ${lignes.map(() => '(?, CURDATE(), ?, ?, ?, ?, ?, ?, ?, ?)').join(', ')}`,
      lignes.flatMap((l) => [userId, l.rang, l.mission, l.cible, l.echarpes, l.packs, l.xp,
        l.tampons, saisonId]));
    if (Number(r.affectedRows) !== lignes.length) {
      return (await q(SQL_CONTRAT, [userId])).filter((l) => Number(l.k) === 0);
    }
    /* Le ménage, une fois par jour et par joueur, au tirage : quatre cents
       jours d'activité gardés, pas davantage (`CONFIDENTIALITE.md`). */
    await q('DELETE FROM missions_jour WHERE user_id = ? AND jour < CURDATE() - INTERVAL 400 DAY',
      [userId]);
    await q('DELETE FROM compteurs_jour WHERE user_id = ? AND jour < CURDATE() - INTERVAL 400 DAY',
      [userId]);
    return lignes.map((l) => ({ ...l, k: 0, jour, saison_id: saisonId, relancee: 0 }));
  }

  /* ======================================================= l'état du jour */

  /* Une lecture dont l'absence ne doit pas éteindre le quotidien : une table
     du duel ou du Virage absente vaut « rien de fait », et le journal le dit
     une fois. Les tables du quotidien lui-même, elles, éteignent tout. */
  const tolerer = (p) => p.catch((e) => {
    if (!estSchema(e)) throw e;
    journaliser(`lecture incomplète (${e.sqlMessage ?? e.message})`);
    return [];
  });

  /**
   * L'état complet (`CONTRATS.md`, § 6.1), et ce que les réclamations
   * groupées ont besoin de savoir en plus (`interne`).
   */
  async function lireEtat(userId, { retour = false } = {}) {
    const { lancees, courante } = lesSaisons();
    const [b] = await q(SQL_JOUR,
      [reglage('quotidien.retour_heures'), userId, courante?.id ?? null, userId]);
    const { jour, hier } = b;

    const [contrat, livre, duels, presences, compteurs] = await Promise.all([
      q(SQL_CONTRAT, [userId]),
      q(SQL_LIVRE, [userId, userId, userId, userId]),
      tolerer(lireDuels(q, userId)),
      tolerer(lirePresences(q, userId)),
      tolerer(lireCompteurs(q, userId)),
    ]);
    const donnees = { duels, presences, compteurs };

    /* Ce que le grand livre a déjà versé. */
    const ecarts = [];
    const deja = { mission: new Set(), sachet: new Set(), carnet: new Set(), relais: new Set() };
    const tampons = new Map();
    for (const r of livre) {
      if (r.source === 'bonus') ecarts.push(Number(r.ecart));
      else if (r.source === 'tampons') tampons.set(Number(r.saison_id), Number(r.somme));
      else deja[r.source]?.add(r.cle);
    }
    const tamponsDe = (id) => tampons.get(Number(id)) ?? 0;

    let auj = contrat.filter((l) => Number(l.k) === 0);
    const veille = contrat.filter((l) => Number(l.k) === 1);
    const aTirer = reglage('missions.actif') === true && !auj.length;

    /* Le contexte des conditions, nourri de ce qu'on vient de lire. Les
       classés du jour se comptent comme le quota : toutes les lignes
       classées depuis minuit, quittées comprises.

       **Seul le tirage lit la journée du football**, une fois par jour et
       par joueur. Hors tirage, le contexte ne la lit pas (`presumer`) :
       « relançable » se juge sur le dernier relevé du jour de jeu, ou la
       présume. Le hub fait cette lecture à chaque arrivée ; elle ne doit
       ni décoder la journée du monde, ni réveiller l'API sportive. */
    const ctx = contexte({ lire: q, userId, jourDuFoot, memoire, presumer: !aTirer, base: {
      debut: Number(b.debut), fin: Number(b.fin), scarves: Number(b.scarves ?? 0),
      suivis: suivisDe(b.suivis),
      classes: duels.filter((d) => Number(d.k) === 0 && d.mode === 'classe').length,
    } });

    /* La saison de ce tirage : la saison en cours si sa fenêtre n'est pas
       close. Une mission jouée entre deux saisons ne remplit aucun carnet. */
    const saisonDuTirage = courante && b.close != null && !vrai(b.close) ? Number(courante.id) : null;
    if (aTirer) {
      auj = await tirer(userId, { jour, veille, ctx, saisonId: saisonDuTirage });
    }

    const pub = { actif: true, jour, finDuJourMs: Math.max(0, Math.round(Number(b.reste) * 1000)) };
    let aReclamer = 0;

    /* ------------------------------------------- la carte de présence */
    const prise = ecarts.includes(0);
    if (reglage('bonus.actif') === true) {
      const montants = montantsCarte();
      const k = caseDuJour(ecarts.length, prise);
      pub.bonus = {
        pret: !prise,
        carte: { case: k, cases: montants.length, prise, montants },
        ...(prise ? {} : { gain: montants[k - 1] }),
      };
      if (!prise) aReclamer++;
    }

    /* ------------------------------------------------ la série de jours
       Servie dès que le record vaut 1, `jours` à 0 compris : le profil
       montre le record le jour même où la série retombe. */
    const serie = serieDe(ecarts);
    if (serie.record > 0) pub.serie = serie;

    /* ------------------------------------------------------- les missions */
    const interne = { jour, hier };
    if (reglage('missions.actif') === true) {
      const bloc = await blocMissions({ jour, hier, auj, veille, deja, donnees, ctx });
      if (bloc) {
        pub.missions = bloc.public;
        aReclamer += bloc.aReclamer;
        interne.missions = bloc.interne;
      }
    }

    /* ---------------------------------------- le carnet, le relais, la saison passée */
    if (reglage('saison.carnet_actif') === true && courante) {
      const t = tamponsDe(courante.id);
      const paliers = carnetDe(courante).map((p) => ({
        ...p,
        etat: deja.carnet.has(`S${courante.id}:${p.n}`) ? 'reclame'
          : t >= p.tampons ? 'pret' : 'a_venir',
      }));
      const prochain = paliers.find((p) => p.tampons > t);
      pub.carnet = {
        saison: resume(courante),
        close: vrai(b.close),
        tampons: t,
        paliers,
        ...(prochain ? { prochain: { n: prochain.n, manque: prochain.tampons - t } } : {}),
      };
      aReclamer += paliers.filter((p) => p.etat === 'pret').length;
      interne.carnet = { saison: courante, tampons: t, paliers };

      /* Le relais : la saison d'avant, si le joueur y a assez joué. Calculé à
         la réclamation, comme le bonus : son réglage vaut tout de suite. */
      const precedentes = lancees.filter((s) => Number(s.id) !== Number(courante.id));
      const avant = precedentes[precedentes.length - 1];
      const packs = reglage('saison.relais_packs');
      if (avant && packs > 0 && !deja.relais.has(`S${courante.id}`)
          && tamponsDe(avant.id) >= reglage('saison.relais_seuil')) {
        pub.relais = { saison: resume(avant), tampons: tamponsDe(avant.id),
          gain: { echarpes: 0, packs, xp: 0, tampons: 0 } };
        aReclamer++;
      }

      /* La saison passée : **une seule**, la plus récente des saisons finies
         qui a encore un palier prêt. Quand elle est vidée, la précédente
         prend sa place à la lecture suivante. */
      for (const s of [...precedentes].reverse()) {
        const t2 = tamponsDe(s.id);
        const prets = carnetDe(s).filter((p) => t2 >= p.tampons
          && !deja.carnet.has(`S${s.id}:${p.n}`)).map((p) => ({ ...p, etat: 'pret' }));
        if (!prets.length) continue;
        pub.saisonPassee = { saison: resume(s), paliers: prets };
        aReclamer += prets.length;
        interne.saisonPassee = { saison: s, paliers: prets };
        break;
      }
    }

    pub.aReclamer = aReclamer;

    /* --------------------------------------------- depuis ta dernière visite
       Rien de plus à lire quand la marque est récente : la lecture du jour a
       déjà tranché, et le hub le demande à chaque arrivée. */
    if (retour && vrai(b.ticket)) {
      const depuis = await lireDepuis(q, userId, {
        ilYaMs: Math.max(0, Math.round(Number(b.absence) * 1000)),
        instantane: b.instantane,
      });
      if (depuis) pub.depuis = depuis;
    }

    return { public: pub, interne };
  }

  /** Le bloc des missions : celles du jour, le sachet, et ce qui reste d'hier. */
  async function blocMissions({ jour, hier, auj, veille, deja, donnees, ctx }) {
    const parRang = (a, b) => Number(a.rang) - Number(b.rang);
    const missions = auj.filter((l) => Number(l.rang) < RANG_SACHET).sort(parRang);
    if (!missions.length) return null;

    const faites = auj.reduce((s, l) => s + Number(l.relancee || 0), 0);
    const relances = Math.max(0, reglage('missions.relances') - faites);
    let aReclamer = 0;
    const versables = [];

    const liste = [];
    for (const l of missions) {
      const mi = MISSION_PAR_ID.get(l.mission);
      if (!mi) continue;
      const cible = Number(l.cible);
      const reclamee = deja.mission.has(`${jour}:${l.rang}`);
      const fait = reclamee ? cible : faitPour(mi, cible, donnees, 0);
      const etat = reclamee ? 'reclamee' : fait >= cible ? 'pret' : 'en_cours';
      /* « Relançable » : une relance reste, la mission n'est pas finie, et une
         autre mission de la même difficulté est faisable. La question suit
         l'ordre du jour et s'arrête à la première réponse ; les Fanzzy du
         joueur ne se lisent que si elle y arrive, une seule fois par lecture
         (le contexte les garde). La journée du football, jamais hors tirage :
         une mission du Virage se juge sur le dernier relevé du jour de jeu,
         ou se présume faisable — la relance lit, tranche, et répond
         « aucune » s'il le faut (`ECARTS.md`, quotidien § 10). */
      const relancable = relances > 0 && etat === 'en_cours'
        && Boolean(await remplacante({ jour, difficulte: mi.difficulte, actuelle: mi.id,
          faisable: ctx.faisable }));
      liste.push({
        rang: Number(l.rang), id: mi.id, difficulte: mi.difficulte,
        titre: mi.titre(cible), ou: mi.ou, bouton: mi.bouton,
        cible, fait, unite: mi.unite, gain: gainDe(l), etat, relancable,
      });
      if (etat === 'pret') {
        aReclamer++;
        versables.push({ sorte: 'mission', jour, rang: Number(l.rang), id: mi.id,
          saisonId: l.saison_id == null ? null : Number(l.saison_id), tampons: Number(l.tampons) });
      }
    }

    const pub = { jour, liste, relances };

    const sac = auj.find((l) => Number(l.rang) === RANG_SACHET);
    if (sac) {
      const nb = missions.filter((l) => deja.mission.has(`${jour}:${l.rang}`)).length;
      const etat = deja.sachet.has(jour) ? 'reclame' : nb === missions.length ? 'pret' : 'en_cours';
      pub.sachet = { etat, faites: nb, sur: missions.length, gain: gainDe(sac) };
      if (etat === 'pret') aReclamer++;
      /* Pour « tout récupérer » : le sachet devient prêt dès que les
         missions prêtes de ce passage sont versées. */
      const atteint = missions.every((l) => deja.mission.has(`${jour}:${l.rang}`)
        || versables.some((v) => v.jour === jour && v.rang === Number(l.rang)));
      if (etat !== 'reclame' && atteint) {
        versables.push({ sorte: 'sachet', jour,
          saisonId: sac.saison_id == null ? null : Number(sac.saison_id), tampons: Number(sac.tampons) });
      }
    }

    /* Hier : ce qui reste récupérable, et seulement cela. Une mission
       terminée se récupère jusqu'à la fin du jour suivant. */
    const vMissions = veille.filter((l) => Number(l.rang) < RANG_SACHET).sort(parRang);
    const hListe = [];
    for (const l of vMissions) {
      const mi = MISSION_PAR_ID.get(l.mission);
      if (!mi || deja.mission.has(`${hier}:${l.rang}`)) continue;
      const cible = Number(l.cible);
      const fait = faitPour(mi, cible, donnees, 1);
      if (fait < cible) continue;
      hListe.push({
        rang: Number(l.rang), id: mi.id, difficulte: mi.difficulte,
        titre: mi.titre(cible), ou: mi.ou, bouton: mi.bouton,
        cible, fait, unite: mi.unite, gain: gainDe(l), etat: 'pret', relancable: false,
      });
      versables.push({ sorte: 'mission', jour: hier, rang: Number(l.rang), id: mi.id,
        saisonId: l.saison_id == null ? null : Number(l.saison_id), tampons: Number(l.tampons) });
    }
    aReclamer += hListe.length;
    const vSac = veille.find((l) => Number(l.rang) === RANG_SACHET);
    let hSachet = null;
    if (vSac && vMissions.length && !deja.sachet.has(hier)) {
      const nb = vMissions.filter((l) => deja.mission.has(`${hier}:${l.rang}`)).length;
      if (nb === vMissions.length) {
        hSachet = { etat: 'pret', faites: nb, sur: vMissions.length, gain: gainDe(vSac) };
        aReclamer++;
      }
      const atteint = vMissions.every((l) => deja.mission.has(`${hier}:${l.rang}`)
        || versables.some((v) => v.jour === hier && v.rang === Number(l.rang)));
      if (atteint) {
        versables.push({ sorte: 'sachet', jour: hier,
          saisonId: vSac.saison_id == null ? null : Number(vSac.saison_id), tampons: Number(vSac.tampons) });
      }
    }
    if (hListe.length || hSachet) {
      pub.hier = { jour: hier, liste: hListe, ...(hSachet ? { sachet: hSachet } : {}) };
    }

    return { public: pub, aReclamer, interne: { versables } };
  }

  /** L'état à joindre à une réponse : jamais une erreur de schéma. */
  async function etatPublic(userId, options) {
    try {
      return (await lireEtat(userId, options)).public;
    } catch (e) {
      if (!estSchema(e)) throw e;
      journaliser(`état illisible (${e.sqlMessage ?? e.message})`);
      return { actif: false };
    }
  }

  /* ===================================================== les réclamations

     Chacune décrit un versement pour le grand livre : sa clé, sa saison, son
     recompte (`verifier`) et son gain. `verifier` et `gain` ne font que
     **lire**, sur la connexion qu'on leur donne : le grand livre peut les
     rappeler s'il rejoue une course perdue (`ECARTS.md`, socle n° 2). */

  /** Le bonus du jour : la case se calcule dans la transaction, d'après le grand livre. */
  function versementBonus(userId, jour) {
    const { courante } = lesSaisons();
    return {
      userId, source: 'bonus', cle: jour,
      saisonId: courante ? Number(courante.id) : null,
      async verifier(conn) {
        if (reglage('bonus.actif') !== true) return 'inactif';
        /* Minuit passé entre la lecture et le versement : le bonus d'hier ne
           se prend plus, on relit. */
        const [r] = await sur(conn)(
          "SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') = ? AS memeJour", [jour]);
        return vrai(r.memeJour) ? true : 'change';
      },
      async gain(conn) {
        const [r] = await sur(conn)(
          "SELECT COUNT(*) AS n FROM recompenses WHERE user_id = ? AND source = 'bonus'", [userId]);
        return montantsCarte()[caseDuJour(Number(r.n), false) - 1];
      },
      ...portes(),
    };
  }

  /**
   * Une mission : on verse **ce que porte la ligne**, après avoir vérifié
   * qu'elle est toujours celle qu'on affichait (`id`, et la saison lue avant)
   * et recompté sa progression. Le montant ne vient jamais du corps.
   */
  function versementMission(userId, { jour, rang, id, saisonId }) {
    let ligne = null;
    return {
      userId, source: 'mission', cle: `${jour}:${rang}`, saisonId,
      async verifier(conn) {
        ligne = null;
        if (reglage('missions.actif') !== true) return 'inactif';
        const lire = sur(conn);
        const [r] = await lire(
          `SELECT DATEDIFF(CURDATE(), ?) AS k, l.mission, l.cible, l.echarpes, l.packs, l.xp,
                  l.tampons, l.saison_id
             FROM (SELECT 1) AS un
             LEFT JOIN missions_jour l ON l.user_id = ? AND l.jour = ? AND l.rang = ?`,
          [jour, userId, jour, rang]);
        const k = r.k == null ? NaN : Number(r.k);
        if (k > 1) return 'jour_passe';
        if ((k !== 0 && k !== 1) || r.mission == null) return 'inconnu';
        const saisonLigne = r.saison_id == null ? null : Number(r.saison_id);
        if (r.mission !== id || saisonLigne !== (saisonId ?? null)) return 'change';
        const mi = MISSION_PAR_ID.get(r.mission);
        if (!mi) return 'inconnu';
        if ((await recompter(lire, userId, mi, Number(r.cible), k)) < Number(r.cible)) {
          return 'incomplet';
        }
        ligne = r;
        return true;
      },
      gain: () => gainDe(ligne),
      ...portes(),
    };
  }

  /** Le sachet d'un jour : versé quand toutes les missions de ce jour le sont. */
  function versementSachet(userId, { jour, saisonId }) {
    let ligne = null;
    return {
      userId, source: 'sachet', cle: jour, saisonId,
      async verifier(conn) {
        ligne = null;
        if (reglage('missions.actif') !== true) return 'inactif';
        const lire = sur(conn);
        const lignes = await lire(
          `SELECT DATEDIFF(CURDATE(), ?) AS k, l.rang, l.echarpes, l.packs, l.xp, l.tampons,
                  l.saison_id
             FROM (SELECT 1) AS un
             LEFT JOIN missions_jour l ON l.user_id = ? AND l.jour = ?`,
          [jour, userId, jour]);
        const k = lignes[0]?.k == null ? NaN : Number(lignes[0].k);
        if (k > 1) return 'jour_passe';
        if (k !== 0 && k !== 1) return 'inconnu';
        const sac = lignes.find((l) => l.rang != null && Number(l.rang) === RANG_SACHET);
        const missions = lignes.filter((l) => l.rang != null && Number(l.rang) < RANG_SACHET);
        if (!sac || !missions.length) return 'inconnu';
        if ((sac.saison_id == null ? null : Number(sac.saison_id)) !== (saisonId ?? null)) return 'change';
        /* sql-sur : un « ? » par mission du jour ; les clés passent par les
           paramètres. */
        const [c] = await lire(
          `SELECT COUNT(*) AS n FROM recompenses
            WHERE user_id = ? AND source = 'mission'
              AND cle IN (${missions.map(() => '?').join(', ')})`,
          [userId, ...missions.map((l) => `${jour}:${Number(l.rang)}`)]);
        if (Number(c.n) !== missions.length) return 'incomplet';
        ligne = sac;
        return true;
      },
      gain: () => gainDe(ligne),
      ...portes(),
    };
  }

  /**
   * Un palier du carnet, pour la saison en cours ou une saison passée. Le
   * titre et l'insigne sont copiés dans la ligne du grand livre : c'est elle
   * qui dit, pour toujours, ce que le joueur porte.
   */
  function versementCarnet(userId, saison, palier) {
    const saisonId = Number(saison.id);
    return {
      userId, source: 'carnet', cle: `S${saisonId}:${palier.n}`, saisonId,
      titre: palier.titre ?? null, insigne: palier.insigne ?? null,
      async verifier(conn) {
        if (reglage('saison.carnet_actif') !== true) return 'inactif';
        const [r] = await sur(conn)(SQL_TAMPONS, [userId, saisonId]);
        return Number(r.n) >= palier.tampons ? true : 'incomplet';
      },
      gain: { ...palier.gain },
      ...portes(),
    };
  }

  /** Le passage de relais : les sachets de la trêve, à qui a joué la saison d'avant. */
  function versementRelais(userId, courante, avant) {
    return {
      userId, source: 'relais', cle: `S${Number(courante.id)}`, saisonId: Number(courante.id),
      async verifier(conn) {
        if (reglage('saison.carnet_actif') !== true) return 'inactif';
        if (!(reglage('saison.relais_packs') > 0)) return 'inactif';
        const [r] = await sur(conn)(SQL_TAMPONS, [userId, Number(avant.id)]);
        return Number(r.n) >= reglage('saison.relais_seuil') ? true : 'incomplet';
      },
      gain: () => ({ echarpes: 0, packs: reglage('saison.relais_packs'), xp: 0, tampons: 0 }),
      ...portes(),
    };
  }

  /* La saison d'une ligne du jour, lue avant le versement : la clé de la
     ligne du grand livre la porte, et le recompte vérifie qu'elle n'a pas
     changé. */
  async function saisonDeLaLigne(userId, jour, rang) {
    const [r] = await q(
      'SELECT saison_id FROM missions_jour WHERE user_id = ? AND jour = ? AND rang = ?',
      [userId, jour, rang]);
    return r?.saison_id == null ? null : Number(r.saison_id);
  }

  async function reclamerBonus(userId) {
    const [r] = await q("SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS jour");
    const v = versementBonus(userId, r.jour);
    /* La case du jour ne se connaît que sous le verrou : on prépare la
       recharge dès que la septième case porte un booster. */
    if (reglage('bonus.actif') === true && peutPorterUnBooster(v)) await avantUnBooster(userId);
    return verser(pool, v);
  }

  async function reclamerMission(userId, { jour, rang, id }) {
    const saisonId = await saisonDeLaLigne(userId, jour, rang);
    return verser(pool, versementMission(userId, { jour, rang, id, saisonId }));
  }

  async function reclamerSachet(userId, { jour }) {
    const saisonId = await saisonDeLaLigne(userId, jour, RANG_SACHET);
    if (reglage('missions.actif') === true) await avantUnBooster(userId);
    return verser(pool, versementSachet(userId, { jour, saisonId }));
  }

  async function reclamerCarnet(userId, { saison, n }) {
    const s = lesSaisons().lancees.find((x) => Number(x.id) === saison);
    const palier = s ? carnetDe(s).find((p) => p.n === n) : null;
    if (!palier) return { verse: false, raison: 'inconnu' };
    const v = versementCarnet(userId, s, palier);
    if (reglage('saison.carnet_actif') === true && peutPorterUnBooster(v)) await avantUnBooster(userId);
    return verser(pool, v);
  }

  async function reclamerRelais(userId) {
    const { lancees, courante } = lesSaisons();
    const precedentes = courante ? lancees.filter((s) => Number(s.id) !== Number(courante.id)) : [];
    const avant = precedentes[precedentes.length - 1];
    if (!courante || !avant) return { verse: false, raison: 'inconnu' };
    if (reglage('saison.carnet_actif') === true && reglage('saison.relais_packs') > 0) {
      await avantUnBooster(userId);
    }
    return verser(pool, versementRelais(userId, courante, avant));
  }

  /**
   * « TOUT RÉCUPÉRER » : dans l'ordre bonus, missions, sachets, carnet,
   * relais, chacun dans sa transaction. Ce que ses propres versements rendent
   * prêt est pris dans le même geste — le sachet dont on vient de verser la
   * dernière mission, le palier que leurs tampons atteignent — : un joueur
   * qui appuie sur TOUT RÉCUPÉRER n'a pas à appuyer une seconde fois. Un
   * élément refusé (déjà versé ailleurs, pas atteint au recompte) est passé ;
   * le disjoncteur arrête la suite, et `reste` dit ce qui reste dû.
   */
  async function reclamerTout(userId) {
    const e = await lireEtat(userId);
    const liste = [];
    if (e.public.bonus?.pret) liste.push(versementBonus(userId, e.interne.jour));
    const versables = e.interne.missions?.versables ?? [];
    for (const v of versables.filter((x) => x.sorte === 'mission')) {
      liste.push(versementMission(userId, v));
    }
    for (const v of versables.filter((x) => x.sorte === 'sachet')) {
      liste.push(versementSachet(userId, v));
    }
    if (e.interne.carnet) {
      const { saison, tampons, paliers } = e.interne.carnet;
      /* Les tampons de ce passage, s'il remplit le carnet en cours. */
      const enPlus = versables.filter((v) => v.saisonId === Number(saison.id))
        .reduce((s, v) => s + v.tampons, 0);
      for (const p of paliers) {
        if (p.etat !== 'reclame' && tampons + enPlus >= p.tampons) {
          liste.push(versementCarnet(userId, saison, p));
        }
      }
    }
    if (e.interne.saisonPassee) {
      for (const p of e.interne.saisonPassee.paliers) {
        liste.push(versementCarnet(userId, e.interne.saisonPassee.saison, p));
      }
    }
    if (e.public.relais) {
      const { lancees, courante } = lesSaisons();
      const avant = lancees.filter((s) => Number(s.id) !== Number(courante?.id)).pop();
      if (courante && avant) liste.push(versementRelais(userId, courante, avant));
    }
    if (liste.some(peutPorterUnBooster)) await avantUnBooster(userId);
    return verserTout(pool, liste, portes());
  }

  /* ========================================================== la relance */

  /**
   * Remplace une mission d'aujourd'hui pas encore terminée par la suivante de
   * l'ordre du jour, en gardant **les gains de la ligne** : la promesse du
   * matin tient.
   *
   * **Le verrou de la bourse d'abord**, comme le grand livre. Une relance et
   * une réclamation simultanées de la même mission prenaient sinon deux
   * verrous dans deux ordres différents : la réclamation pouvait inscrire au
   * grand livre la mission X pendant que la ligne passait à la mission Y — un
   * versement pour une mission que le joueur n'a plus.
   */
  async function relancer(userId, { rang, id }) {
    if (reglage('missions.actif') !== true) return { relancee: false, raison: 'inactif' };
    /* Lue avant le verrou : voir `journeeDejaLue`. */
    const journee = await journeeDejaLue();
    const conn = await pool.getConnection();
    const lire = sur(conn);
    let enCours = false;
    const refus = async (raison) => {
      await conn.rollback();
      enCours = false;
      return { relancee: false, raison };
    };
    try {
      await assurerBourse(lire, userId);
      await conn.beginTransaction();
      enCours = true;
      await lire('SELECT user_id FROM user_wallet WHERE user_id = ? FOR UPDATE', [userId]);
      const lignes = await lire(
        `SELECT DATE_FORMAT(jour, '%Y-%m-%d') AS jour, rang, mission, cible, relancee
           FROM missions_jour WHERE user_id = ? AND jour = CURDATE() FOR UPDATE`, [userId]);
      const l = lignes.find((x) => Number(x.rang) === rang);
      if (!l) return refus('change');
      if (l.mission !== id) return refus('change');
      const mi = MISSION_PAR_ID.get(l.mission);
      if (!mi) return refus('change');

      const faites = lignes.reduce((s, x) => s + Number(x.relancee || 0), 0);
      if (faites >= reglage('missions.relances')) return refus('epuisees');

      const [paye] = await lire(
        "SELECT 1 AS oui FROM recompenses WHERE user_id = ? AND source = 'mission' AND cle = ?",
        [userId, `${l.jour}:${rang}`]);
      if (paye) return refus('terminee');
      if ((await recompter(lire, userId, mi, Number(l.cible), 0)) >= Number(l.cible)) {
        return refus('terminee');
      }

      /* Tout le contexte se lit sur cette connexion, sous le verrou, sauf la
         journée du football, déjà lue : rien ne passe plus par le pool ici.
         Son relevé est noté : l'état que la relance rend, et les lectures de
         la minute qui suit, savent déjà ce qu'elle a appris. */
      const ctx = contexte({ lire, userId, jourDuFoot: journee, memoire });
      const autre = await remplacante({ jour: l.jour, difficulte: mi.difficulte,
        actuelle: mi.id, faisable: ctx.faisable });
      if (!autre) return refus('aucune');

      if (crochets.relanceAvantEcriture) await crochets.relanceAvantEcriture({ userId, rang, id });

      await lire(
        `UPDATE missions_jour SET mission = ?, cible = ?, relancee = relancee + 1
          WHERE user_id = ? AND jour = CURDATE() AND rang = ? AND mission = ?`,
        [autre, MISSION_PAR_ID.get(autre).cible, userId, rang, l.mission]);
      await conn.commit();
      enCours = false;
      return { relancee: true };
    } catch (e) {
      if (enCours) await conn.rollback().catch(() => {});
      if (estSchema(e)) {
        journaliser(`relance impossible (${e.sqlMessage ?? e.message})`);
        return { relancee: false, raison: 'inactif' };
      }
      throw e;
    } finally {
      conn.release();
    }
  }

  /* ============================================================ les routes */

  const router = express.Router();
  router.use(express.json({ limit: '4kb' }));

  /* Une panne imprévue répond 503 : pour un écran, c'est « bloc absent »
     (`CONTRATS.md`, R2), sans erreur affichée ni zéro. */
  const safe = (fn) => async (req, res) => {
    try { await fn(req, res); } catch (e) {
      console.error('[quotidien]', e?.stack ?? e);
      if (!res.headersSent) res.status(503).json({ error: 'quotidien.error.indisponible' });
    }
  };
  const requete = (res) => res.status(400).json({ error: 'quotidien.error.requete' });
  const entier = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
  const corps = (req) => (req.body && typeof req.body === 'object' ? req.body : {});

  /* Une réclamation répond toujours 200 avec une session valide (R6) : le
     versement ou son refus, et l'état à jour à la racine. Une table absente
     est un refus `schema`, pas une erreur. */
  const repondre = async (res, userId, faire) => {
    let r;
    try { r = await faire(); } catch (e) {
      if (!estSchema(e)) throw e;
      journaliser(`réclamation impossible (${e.sqlMessage ?? e.message})`);
      r = { verse: false, raison: 'schema' };
    }
    res.json({ ...r, quotidien: await etatPublic(userId) });
  };

  router.get('/', requireAuth, safe(async (req, res) => {
    res.set('cache-control', 'no-store');
    res.json(await etatPublic(req.user.id, { retour: String(req.query.retour ?? '') === '1' }));
  }));

  router.post('/bonus', requireAuth, safe(async (req, res) =>
    repondre(res, req.user.id, () => reclamerBonus(req.user.id))));

  router.post('/mission', requireAuth, safe(async (req, res) => {
    const { jour, rang, id } = corps(req);
    if (typeof jour !== 'string' || !JOUR.test(jour) || !entier(rang, 0, RANG_SACHET - 1)
        || typeof id !== 'string' || !id || id.length > 24) return requete(res);
    return repondre(res, req.user.id, () => reclamerMission(req.user.id, { jour, rang, id }));
  }));

  router.post('/sachet', requireAuth, safe(async (req, res) => {
    const { jour } = corps(req);
    if (typeof jour !== 'string' || !JOUR.test(jour)) return requete(res);
    return repondre(res, req.user.id, () => reclamerSachet(req.user.id, { jour }));
  }));

  router.post('/carnet', requireAuth, safe(async (req, res) => {
    const { saison, n } = corps(req);
    if (!entier(saison, 1, 2 ** 31) || !entier(n, 1, 8)) return requete(res);
    return repondre(res, req.user.id, () => reclamerCarnet(req.user.id, { saison, n }));
  }));

  router.post('/relais', requireAuth, safe(async (req, res) =>
    repondre(res, req.user.id, () => reclamerRelais(req.user.id))));

  router.post('/tout', requireAuth, safe(async (req, res) =>
    repondre(res, req.user.id, () => reclamerTout(req.user.id))));

  router.post('/relance', requireAuth, safe(async (req, res) => {
    const { rang, id } = corps(req);
    if (!entier(rang, 0, RANG_SACHET - 1) || typeof id !== 'string' || !id || id.length > 24) {
      return requete(res);
    }
    const r = await relancer(req.user.id, { rang, id });
    res.json({ ...r, quotidien: await etatPublic(req.user.id) });
  }));

  /* La marque de visite. Le hub l'envoie **après** avoir montré le ticket
     (ou après la lecture, s'il n'y en avait pas). */
  router.post('/visite', requireAuth, safe(async (req, res) => {
    try {
      await assurerBourse(q, req.user.id);
      await marquerVisite(q, req.user.id);
    } catch (e) {
      if (!estSchema(e)) throw e;
      journaliser(`marque de visite impossible (${e.sqlMessage ?? e.message})`);
    }
    res.json({ ok: true });
  }));

  /* Un corps qui n'est pas du JSON : 400 nommé, comme une requête mal formée. */
  router.use((err, _req, res, next) => {
    if (err?.type === 'entity.parse.failed' || err?.type === 'entity.too.large') return requete(res);
    return next(err);
  });

  return {
    router, lireEtat, etat: etatPublic, relancer, reclamerTout,
    reclamerBonus, reclamerMission, reclamerSachet, reclamerCarnet, reclamerRelais,
  };
}
