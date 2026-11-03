import express from 'express';
import { reglage } from '../../shared/reglages.js';
import { CATALOGUE, enEuros } from '../../shared/boutique.js';
import { carnetDe } from '../../shared/saison.js';
import {
  passAvecTenue, passDe, VOIE_PASS, niveauVoieDe, etoilesDe, seuilsVoie, ageTenue, saisonsCouvertes,
  tenueReservee, estTardif, SUFFIXE_TARD, anciensPassEnVente, voieSelonAchat,
} from '../../shared/pass.js';
import { saisonEnCours, toutesLesSaisons } from '../fanzzy/saisons.js';

/**
 * Le PASS de saison : ce qui distingue un joueur qui a le PASS d'un autre.
 *
 * ## La règle, et pourquoi elle est écrite ici
 *
 * **On vend du rythme, de la mémoire et du visuel, jamais de la puissance.**
 *
 * Deux règles du jeu l'imposaient déjà, chacune de son côté. `deck/index.js` :
 * « un deck entre toujours au premier âge […] l'écart se creuse par ce qu'on
 * joue, pas par ce qu'on a payé ». Et `shared/niveau.js` : « le niveau ne donne
 * aucune puissance ; s'il en avait, l'ancienneté deviendrait de la force et le
 * nouveau venu n'aurait plus de raison de rester ».
 *
 * ## Le 2 novembre 2026 : du mensuel au PASS de saison
 *
 * Choix de Gaël (`shared/pass.js`, où tout est écrit) : le PASS coûte 7,99 €
 * ou 40 000 écharpes, se paie une fois et vaut jusqu'à la fin de la saison ;
 * acheté pendant son dernier mois, il couvre aussi la suivante. **Tout compte
 * au classement pour tous, sans limite** : les trois plafonds du gratuit de
 * septembre (duels classés et Virages comptés par jour, format classé) ont
 * disparu avec l'abonnement.
 *
 * Pour la saison achetée : la réserve de boosters, la recharge, le parcours et
 * les souvenirs complets. Pour la vie : un club et un KOP de plus par PASS, la
 * tenue, le badge et le cadre de chaque PASS.
 *
 * Les anciens abonnements (`abonnements`) gardent tout jusqu'à la fin de leur
 * période payée ; la reprise (`scripts/pass-reprise.mjs`) coupe leur
 * renouvellement et leur offre le PASS de la saison où cette période finit.
 *
 * ## Une seule définition
 *
 * `estAbonne` est la seule réponse à « a-t-il les avantages de la saison ».
 * Les modules qui ouvrent quelque chose passent par elle — jamais par une
 * requête à eux. Six requêtes qui lisent la même table finissent par ne plus
 * dire la même chose, et la première à diverger ouvrira à quelqu'un ce
 * qu'une autre lui refuse.
 */
/**
 * Pourquoi on part : les choix de la question posée après la résiliation.
 *
 * Choisis par Gaël le 9 octobre 2026, sans offre pour retenir. L'ordre est
 * celui de l'écran. La clé va en base, le libellé n'y va pas : il peut changer
 * sans rendre les réponses passées illisibles.
 */
export const RAISONS_DEPART = [
  ['trop_cher', 'C’est trop cher'],
  ['joue_peu', 'Je ne joue plus assez'],
  ['manque', 'Il manque quelque chose'],
  ['pause', 'Une pause pour l’intersaison'],
  ['autre', 'Autre chose'],
];
const RAISON_CONNUE = new Set(RAISONS_DEPART.map(([k]) => k));

export function createAbonnement({ pool, requireAuth }) {
  const q = async (sql, params = []) => {
    const [rows] = await pool.execute(sql, params);
    return rows;
  };

  /** L'état complet, pour l'écran qui le montre. */
  async function etat(userId) { return etatVia(q, userId); }

  /**
   * Le même, avec un lecteur choisi.
   *
   * Une transaction en cours doit relire par **sa** connexion : le pool lui
   * rendrait l'état d'avant l'écriture, et `accorder` annoncerait « non
   * abonné » à l'instant où il vient de poser la ligne.
   */
  async function etatVia(lire, userId) {
    const defaut = { abonne: false, formule: null, fin: null, source: null };
    if (!userId) return defaut;
    try {
      const [a] = await lire(
        `SELECT formule, debut, fin, source FROM abonnements WHERE user_id = ?`, [userId]);
      if (!a) return defaut;
      const actif = a.fin === null || new Date(a.fin) > new Date();
      return { abonne: actif, formule: a.formule, debut: a.debut, fin: a.fin,
        source: a.source };
    } catch (e) {
      if (e?.code === 'ER_NO_SUCH_TABLE') return defaut;
      throw e;
    }
  }

  /**
   * Accorder ou prolonger.
   *
   * **Un renouvellement pousse `fin` plus loin, il ne la remplace pas.** Sans
   * cela, renouveler trois jours avant l'échéance perdrait ces trois jours — et
   * c'est précisément le moment où l'on renouvelle.
   *
   * `jours` nul veut dire sans terme : c'est ce que pose un administrateur pour
   * un bêta-testeur. Rien ne l'expire, et c'est voulu.
   *
   * ## `conn` : écrire **dans** la transaction de l'appelant
   *
   * La boutique livre à l'intérieur d'une transaction, et c'est elle qui tient
   * la propriété : si la remise échoue après le débit, le `rollback` défait
   * tout. Écrire par le pool depuis ici sortirait de cette transaction — un
   * abonnement posé survivrait à l'annulation de l'achat qui l'a payé.
   *
   * Et ce n'est pas qu'une question de propreté : la transaction tient un
   * verrou sur la ligne, une écriture par le pool l'attend, et six
   * encaissements simultanés se bloquent les uns les autres jusqu'au
   * `Lock wait timeout`. C'est ce qui est arrivé, et c'est ce qui l'a révélé.
   *
   * Nul par défaut : l'administration, elle, n'a pas de transaction à partager.
   */
  async function accorder(userId, { formule = 'offert', jours = null,
    source = 'admin', reference = null, conn = null } = {}) {
    const ecrire = conn
      ? (sql, params) => conn.query(sql, params).then(([r]) => r)
      : q;

    await ecrire(
      `INSERT INTO abonnements (user_id, formule, fin, source, reference)
       VALUES (?, ?, ${jours === null ? 'NULL'
    : 'DATE_ADD(GREATEST(NOW(3), COALESCE(fin, NOW(3))), INTERVAL ? DAY)'}, ?, ?)
       ON DUPLICATE KEY UPDATE
         formule = VALUES(formule), source = VALUES(source),
         reference = VALUES(reference),
         fin = ${jours === null ? 'NULL'
    : 'DATE_ADD(GREATEST(NOW(3), COALESCE(abonnements.fin, NOW(3))), INTERVAL ? DAY)'}`,
      jours === null ? [userId, formule, source, reference]
        : [userId, formule, jours, source, reference, jours]);
    /* Relu par la **même** connexion quand il y en a une : hors transaction, le
       pool rendrait l'état d'avant l'écriture qu'on vient de faire. */
    return conn ? etatVia((sql, pp) => conn.query(sql, pp).then(([r]) => r), userId)
      : etat(userId);
  }

  /**
   * Repousser l'échéance d'un abonnement **retrouvé par sa référence**.
   *
   * C'est ce que le prestataire de paiement appelle à chaque facture payée, et
   * une fois de plus à la résiliation. Il ne connaît pas nos joueurs : il
   * connaît l'identifiant de l'abonnement qu'il gère, et c'est ce que
   * `reference` porte depuis le premier jour — la colonne existait pour ça.
   *
   * **La date vient d'en face**, pas de notre calendrier. Stripe sait quand le
   * mois s'arrête ; recopier « trente et un jours » décalerait d'un jour à
   * chaque renouvellement, et le décalage s'accumulerait sans que personne ne
   * le voie avant un an.
   *
   * Une référence inconnue ne lève pas et n'écrit rien : un événement qui
   * concerne un abonnement qu'on n'a jamais posé — un essai de test, un compte
   * supprimé — est une nouvelle sans conséquence, et la rejeter ferait rejouer
   * Stripe indéfiniment.
   */
  async function renouveler(reference, fin) {
    if (!reference) return { touche: 0 };
    try {
      const r = await q(
        'UPDATE abonnements SET fin = ? WHERE reference = ?',
        [fin ?? null, String(reference)]);
      return { touche: r.affectedRows ?? 0 };
    } catch (e) {
      if (e?.code === 'ER_NO_SUCH_TABLE') return { touche: 0 };
      throw e;
    }
  }

  /** Retirer. La ligne part : une échéance au passé dirait la même chose, et il
      faudrait se souvenir de la lire comme telle à chaque requête. */
  async function retirer(userId) {
    await q('DELETE FROM abonnements WHERE user_id = ?', [userId]);
    return etat(userId);
  }

  /* ======================================================== le PASS de saison

     Décisions de Gaël du 2 novembre 2026 (`shared/pass.js`) : le PASS
     remplace l'abonnement. Une ligne de `user_pass` par joueur et par saison
     achetée. `estAbonne` répond toujours à « a-t-il les avantages de la
     saison en ce moment » — PASS de la saison en cours, ou ancien abonnement
     encore actif —, si bien que les modules qui l'interrogent n'ont rien à
     apprendre. */

  /** La saison en cours, ou `null` (catalogue des saisons absent, ou rien de lancé). */
  const courante = () => {
    try { return saisonEnCours(); } catch { return null; }
  };
  const toutes = () => {
    try { return toutesLesSaisons(); } catch { return []; }
  };

  /* Une table absente (sql/pass.sql pas encore appliqué) vaut « aucun PASS » :
     le jeu tourne comme avant, personne ne perd rien. */
  const sansTable = (e) => e?.code === 'ER_NO_SUCH_TABLE';

  /** Les numéros des saisons dont le joueur a le PASS, du plus ancien au plus récent. */
  async function saisonsDuPass(userId, lire = q) {
    if (!userId) return [];
    try {
      const rows = await lire(
        'SELECT saison FROM user_pass WHERE user_id = ? ORDER BY saison', [userId]);
      return rows.map((r) => Number(r.saison));
    } catch (e) {
      if (sansTable(e)) return [];
      throw e;
    }
  }

  /**
   * Ses PASS avec la façon dont il les a pris : `[{ saison, tardif }]`.
   *
   * `tardif` : acheté après la fin de sa saison (source `…-tard`). Il n'a
   * que le contenu du PASS, jamais ses gains spéciaux (Gaël, 3 novembre 2026).
   */
  async function passDuJoueur(userId, lire = q) {
    if (!userId) return [];
    try {
      const rows = await lire(
        'SELECT saison, source FROM user_pass WHERE user_id = ? ORDER BY saison', [userId]);
      return rows.map((r) => ({ saison: Number(r.saison), tardif: estTardif(r.source) }));
    } catch (e) {
      if (sansTable(e)) return [];
      throw e;
    }
  }

  /** Le jour d'aujourd'hui à Zurich, `'AAAA-MM-JJ'` : celui des dates de saison. */
  const aujourdHui = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Zurich' })
    .format(new Date());

  /**
   * La saison de ce numéro est-elle finie ? Finie à sa date, ou dépassée par
   * une saison lancée après elle. C'est ce qui ferme sa voie et fait tomber
   * le contenu qui manque dans les boosters.
   */
  function saisonPassee(numero) {
    const n = Number(numero);
    const c = courante();
    if (c && Number(c.numero) > n) return true;
    const s = toutes().find((x) => Number(x.numero) === n && x.lancee);
    return Boolean(s?.finie);
  }

  /**
   * Les anciens PASS que ce joueur peut prendre aujourd'hui :
   * `[{ ...passDe(n), venteLe }]`. Le 1er du deuxième mois après la fin de
   * leur saison, au même prix qu'à l'origine (`venteAncienPassLe`).
   */
  async function anciensEnVente(userId) {
    const deja = await saisonsDuPass(userId);
    return anciensPassEnVente(toutes(), aujourdHui(), deja)
      .map((a) => ({ ...passDe(a.numero), venteLe: a.venteLe }));
  }

  /** Un ancien abonnement (mensuel, annuel, offert) encore actif. */
  async function abonnementActif(userId) {
    if (!userId) return false;
    try {
      const rows = await q(
        `SELECT 1 FROM abonnements
          WHERE user_id = ? AND (fin IS NULL OR fin > NOW(3)) LIMIT 1`, [userId]);
      return rows.length > 0;
    } catch (e) {
      if (sansTable(e)) return false;
      throw e;
    }
  }

  /**
   * A-t-il, **en ce moment**, les avantages de la saison ?
   *
   * Le PASS de la saison en cours, ou un ancien abonnement qui court encore
   * (il garde tout jusqu'à la fin de sa période payée, puis la reprise lui
   * offre le PASS de la saison où elle se termine : `scripts/pass-reprise.mjs`).
   * Une saison finie qui attend la suivante n'a plus de PASS « en cours » : on
   * lit alors aussi le PASS de la suivante, acheté d'avance.
   */
  async function estAbonne(userId) {
    if (!userId) return false;
    const c = courante();
    if (c) {
      const n = Number(c.numero);
      /* Pendant la BASE (saison 0), le PASS 1 vaut déjà : c'est lui qu'on
         achète (`saisonsCouvertes`). */
      const voulues = c.finie || n === 0 ? [n, n + 1] : [n];
      /* Un PASS pris après sa saison n'ouvre pas le rythme de la saison. */
      const a = (await passDuJoueur(userId)).filter((p) => !p.tardif).map((p) => p.saison);
      if (a.some((x) => voulues.includes(x))) return true;
    }
    return abonnementActif(userId);
  }

  /**
   * Combien de PASS il a achetés ou reçus, toutes saisons comprises.
   *
   * C'est ce que comptent les avantages **à vie** : un club suivi et un KOP
   * de plus par PASS. Un ancien abonné encore actif qui n'a pas encore reçu
   * son premier PASS compte pour un : il ne doit rien perdre en attendant la
   * reprise.
   */
  async function nombrePass(userId) {
    /* Les PASS pris après leur saison ne comptent pas : un club et un KOP de
       plus sont des gains spéciaux (Gaël, 3 novembre 2026). */
    const n = (await passDuJoueur(userId)).filter((p) => !p.tardif).length;
    if (n > 0) return n;
    return (await abonnementActif(userId)) ? 1 : 0;
  }

  /** Les tampons d'une saison, comptés sur le grand livre du quotidien. */
  async function tamponsDe(userId, saisonId) {
    try {
      const [r] = await q(
        `SELECT COALESCE(SUM(tampons), 0) AS n FROM recompenses
          WHERE user_id = ? AND source IN ('mission', 'sachet', 'hebdo') AND saison_id = ?`,
        [userId, saisonId]);
      return Number(r?.n ?? 0);
    } catch (e) {
      if (sansTable(e) || e?.code === 'ER_BAD_FIELD_ERROR') return 0;
      throw e;
    }
  }

  /** Les points de voie d'une saison : ce que les défis PASS ont versé
      (`recompenses`, source `voie`, rangés dans la colonne `tampons`). */
  async function pointsDe(userId, saisonId) {
    try {
      const [r] = await q(
        `SELECT COALESCE(SUM(tampons), 0) AS n FROM recompenses
          WHERE user_id = ? AND source = 'voie' AND saison_id = ?`,
        [userId, saisonId]);
      return Number(r?.n ?? 0);
    } catch (e) {
      if (sansTable(e) || e?.code === 'ER_BAD_FIELD_ERROR') return 0;
      throw e;
    }
  }

  /**
   * La voie PASS de chacun de ses PASS : `[{ saison, niveau, tampons, ... }]`.
   *
   * Le niveau se lit sur les tampons du carnet de cette saison-là, ceux de
   * tout le monde : `1 + paliers atteints`. Un PASS d'une saison pas encore
   * lancée (acheté pendant le dernier mois) est au niveau 1 ; il montera
   * avec le carnet de sa saison.
   */
  async function voies(userId) {
    const mes = await passDuJoueur(userId);
    if (!mes.length) return [];
    const parNumero = new Map(toutes().filter((s) => s.lancee).map((s) => [Number(s.numero), s]));
    const out = [];
    for (const { saison: n, tardif } of mes) {
      const s = parNumero.get(n);
      let tampons = 0;
      let points = 0;
      let seuils = [];
      /* Pris après la saison : sa voie ne se joue plus, il n'a que le
         niveau 1 (la tenue au premier âge), sans gain spécial. */
      if (s && !tardif) {
        tampons = await tamponsDe(userId, s.id);
        points = await pointsDe(userId, s.id);
        seuils = carnetDe(s).map((p) => p.tampons);
      }
      /* `tampons` reste le carnet seul ; les points des défis PASS
         s'y ajoutent pour le niveau (`niveauVoieDe`). */
      const v = voieSelonAchat(n, niveauVoieDe({ tampons, points, seuils }),
        { tardif, etoiles: etoilesDe({ tampons, points, seuils }) });
      /* `seuils` : les paliers du carnet ; `seuilsVoie` : ceux des douze
         niveaux, tirés du carnet (`seuilsVoie`, shared/pass.js). */
      out.push({ ...v, tenue: passDe(n).tenue, ageTenue: ageTenue(v.niveau),
        tampons, points, seuils, seuilsVoie: seuilsVoie(seuils),
        saisonId: s?.id ?? null, lancee: Boolean(s?.lancee),
        close: saisonPassee(n) });
    }
    return out;
  }

  /** Le badge à montrer : celui du PASS le plus récent, au niveau atteint. `null` sans PASS. */
  async function badgeDe(userId) {
    /* Le badge est un gain spécial : seuls les PASS joués pendant leur saison
       en donnent un. */
    const v = (await voies(userId)).filter((x) => x.original);
    if (!v.length) return null;
    const d = v[v.length - 1];
    return { saison: d.saison, niveau: d.niveau, couleur: d.couleur, cadre: d.cadre, or: d.or,
      etoiles: d.etoiles ?? 0, gains: d.gains ?? [], titre: d.titre ?? null, nombre: v.length };
  }

  /**
   * Les badges de plusieurs joueurs d'un coup, pour un classement ou un duel :
   * `Map(userId → { saison, couleur, niveau? })`. Sans le niveau de la voie
   * (une requête au grand livre par joueur serait trop pour cent lignes) : le
   * badge d'une liste dit la saison, la fiche du joueur dit le niveau.
   */
  async function badgesDe(ids = []) {
    const uniques = [...new Set(ids.filter(Boolean).map(String))];
    if (!uniques.length) return new Map();
    try {
      const rows = await q(
        `SELECT user_id, MAX(saison) AS saison, COUNT(*) AS n FROM user_pass
          WHERE user_id IN (${uniques.map(() => '?').join(',')})
            AND source NOT LIKE ? GROUP BY user_id`, [...uniques, `%${SUFFIXE_TARD}`]);
      return new Map(rows.map((r) => {
        const p = passDe(r.saison);
        return [String(r.user_id), { saison: p.numero, couleur: p.couleur, nombre: Number(r.n) }];
      }));
    } catch (e) {
      if (sansTable(e)) return new Map();
      throw e;
    }
  }

  /**
   * Jusqu'à quel âge il peut porter cette tenue grâce à ses PASS. 0 : pas du tout.
   *
   * La tenue d'un PASS se gagne le long de sa voie : le premier âge à
   * l'achat, le deuxième et le troisième aux paliers suivants du carnet.
   */
  async function ageTenuePass(userId, tenueId) {
    if (!passAvecTenue().some((p) => p.tenue === tenueId)) return 0;
    let age = 0;
    for (const v of await voies(userId)) if (v.tenue === tenueId) age = Math.max(age, v.ageTenue);
    return age;
  }

  /**
   * Les tenues de PASS qui tombent dans **ses** boosters : `Map(tenue → âge
   * déjà ouvert)`. Celles de ses PASS dont la saison est finie ; seuls les
   * âges au-delà de ce que sa voie a ouvert sont à tirer (Gaël, 3 novembre
   * 2026 : « ils peuvent continuer à gagner les SKIN […] dans les
   * boosters »). Vide pour qui n'a pas de PASS fini.
   */
  async function tenuesAuxBoosters(userId) {
    const out = new Map();
    for (const v of await voies(userId)) {
      if (!v.tenue || !v.close) continue;
      out.set(v.tenue, Math.max(out.get(v.tenue) ?? 0, v.ageTenue));
    }
    return out;
  }

  /** La tenue est-elle réservée au PASS en ce moment (hors des boosters et de l'étal) ? */
  const tenueAuPass = (tenueId) => tenueReservee(tenueId, courante()?.numero ?? null);

  /**
   * Accorder le PASS d'une ou plusieurs saisons. Rend les numéros **nouveaux**.
   *
   * `INSERT IGNORE` : un PASS déjà possédé n'est ni remplacé ni compté deux
   * fois — c'est ce qui rend le rejeu d'un paiement inoffensif.
   *
   * `conn` : écrire dans la transaction de l'appelant (la boutique, l'achat
   * en écharpes), pour que le PASS ne survive pas à un `rollback`.
   */
  async function accorderPass(userId, { saisons = null, source = 'offert', reference = null,
    conn = null } = {}) {
    const ecrire = conn ? (sql, params) => conn.query(sql, params).then(([r]) => r) : q;
    const voulues = saisons ?? saisonsCouvertes(courante(), reglage('pass.dernier_mois_jours'));
    const nouvelles = [];
    for (const n of voulues) {
      const r = await ecrire(
        `INSERT IGNORE INTO user_pass (user_id, saison, source, reference) VALUES (?, ?, ?, ?)`,
        [userId, Number(n), source, reference]);
      if (r?.affectedRows) nouvelles.push(Number(n));
    }
    return nouvelles;
  }

  /** Retirer le PASS d'une saison (administration seulement). */
  async function retirerPass(userId, saison) {
    try {
      await q('DELETE FROM user_pass WHERE user_id = ? AND saison = ?', [userId, Number(saison)]);
    } catch (e) {
      if (!sansTable(e)) throw e;
    }
  }

  /**
   * **Le PASS ne s'achète pas avant son ouverture** (Gaël, 3 novembre 2026 :
   * « vu que le pass ouvre le 1er décembre, […] bloquer la possibilité de
   * l'acheter avant »). Pendant la BASE (saison 0), le PASS 1 se montre avec
   * « Bientôt » ; il s'achète dès que la saison 1 est lancée — seule, le jour
   * de son `ouvre_le`. Rend `{ ouvre }` (le jour, `YYYY-MM-DD`, ou `null`
   * s'il n'est pas encore posé) tant que c'est fermé, sinon `null`.
   *
   * L'administration peut toujours l'offrir (`accorderPass`) : ce n'est pas
   * un achat.
   */
  function bientot() {
    const c = courante();
    if (!c || Number(c.numero) !== 0) return null;
    const suivante = toutes().find((s) => Number(s.numero) === 1);
    return { ouvre: suivante?.ouvre ?? null };
  }

  /** Ce qu'un achat couvrirait maintenant, et ce que le joueur a déjà. */
  async function offre(userId) {
    const couvre = saisonsCouvertes(courante(), reglage('pass.dernier_mois_jours'));
    const deja = await saisonsDuPass(userId);
    return { couvre, aAcheter: couvre.filter((n) => !deja.includes(n)), deja, bientot: bientot() };
  }

  /**
   * Payer le PASS en écharpes (choix de Gaël du 2 novembre 2026).
   *
   * Des écharpes **gagnées en jouant** contre un PASS : aucun euro n'est en
   * jeu, la chaîne argent → tirage reste coupée. Le débit est une
   * réclamation (`WHERE scarves >= ?`), dans la même transaction que le PASS
   * et les boosters offerts : rien ne se perd, rien ne se paie deux fois.
   */
  async function acheterEnEcharpes(userId, { saison = null } = {}) {
    const prix = reglage('pass.prix_echarpes');
    if (!(prix > 0)) return { erreur: 'pass.error.echarpes_fermees' };
    /* **Un ancien PASS** nommé : seulement s'il est en vente aujourd'hui et
       pas déjà à lui. Même prix qu'à l'origine ; la ligne porte `-tard`. */
    let aAcheter;
    let source = 'echarpes';
    if (saison !== null && saison !== undefined && saison !== '') {
      const n = Number(saison);
      const enVente = await anciensEnVente(userId);
      if (!enVente.some((a) => a.numero === n)) {
        return { erreur: (await saisonsDuPass(userId)).includes(n)
          ? 'pass.error.deja' : 'pass.error.pas_en_vente' };
      }
      aAcheter = [n];
      source = `echarpes${SUFFIXE_TARD}`;
    } else {
      const o = await offre(userId);
      aAcheter = o.aAcheter;
      if (o.bientot && aAcheter.length) return { erreur: 'pass.error.bientot' };
    }
    if (!aAcheter.length) {
      return { erreur: courante() ? 'pass.error.deja' : 'pass.error.pas_de_saison' };
    }
    const packs = CATALOGUE.find((a) => a.livraison?.type === 'pass')?.livraison?.packs ?? 0;
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [d] = await conn.query(
        'UPDATE user_wallet SET scarves = scarves - ? WHERE user_id = ? AND scarves >= ?',
        [prix, userId, prix]);
      if (!d.affectedRows) {
        await conn.rollback();
        return { erreur: 'pass.error.pas_assez' };
      }
      const saisons = await accorderPass(userId, { saisons: aAcheter, source,
        reference: `${prix} écharpes`, conn });
      if (!saisons.length) {
        await conn.rollback();
        return { erreur: 'pass.error.deja' };
      }
      if (packs) {
        await conn.query('UPDATE user_wallet SET packs = packs + ? WHERE user_id = ?',
          [packs, userId]);
      }
      await conn.commit();
      return { ok: true, saisons, packs, prix };
    } catch (e) {
      await conn.rollback();
      if (sansTable(e)) return { erreur: 'pass.error.indisponible' };
      throw e;
    } finally {
      conn.release();
    }
  }

  /* ------------------------------------------------ ce que le PASS ouvre

     Chaque porte est **une fonction nommée**, et non un `if (abonne)` recopié
     dans six modules. Les valeurs vivent dans les réglages, section LE PASS
     DE SAISON de /admin. */

  /** Le plafond de boosters en réserve (saison achetée). */
  const plafondPacks = (abonne) => (abonne
    ? reglage('abo.pack_max') : reglage('pack.max'));

  /** Le temps qu'un booster met à revenir (saison achetée). */
  const regenMs = (abonne) => (abonne
    ? reglage('abo.pack_regen_min') : reglage('pack.regen_min')) * 60_000;

  /** Combien de parties le parcours garde en mémoire. `null` = tout. */
  const profondeurParcours = (abonne) => (abonne ? null : reglage('abo.parcours_libre'));

  /** Combien de cartes-souvenirs restent lisibles. `null` = toutes. */
  const profondeurSouvenirs = (abonne) => (abonne ? null : reglage('abo.souvenirs_libres'));

  /** Les emplacements de club en plus, à vie : un par PASS (`pass.clubs_par_pass`). */
  async function clubsEnPlus(userId) {
    return (await nombrePass(userId)) * reglage('pass.clubs_par_pass');
  }

  /** Les KOP qu'il peut fonder, à vie : un par PASS (`pass.kops_par_pass`). */
  async function kopsAutorises(userId) {
    return (await nombrePass(userId)) * reglage('pass.kops_par_pass');
  }

  /* --------------------------------------------------- pourquoi on part

     **Après** la résiliation, jamais avant : la question est facultative et
     ne retarde rien. La réponse est anonyme — la table ne porte pas le
     joueur —, mais seul un joueur qui a (ou vient d'avoir) un abonnement
     peut en laisser une : sans ça, n'importe quel compte remplirait la
     statistique. */
  async function noterDepart(userId, { raison, texte } = {}) {
    if (!RAISON_CONNUE.has(raison)) return { erreur: 'abo.error.raison_inconnue' };
    const [a] = await q('SELECT formule FROM abonnements WHERE user_id = ?', [userId]);
    if (!a) return { erreur: 'abo.error.pas_abonne' };
    const libre = String(texte ?? '').trim().slice(0, 500) || null;
    await q('INSERT INTO abonnement_departs (raison, texte, formule) VALUES (?, ?, ?)',
      [raison, libre, a.formule ?? null]);
    return { ok: true };
  }

  /** Ce que l'administration en lit : le compte par raison, et les derniers mots. */
  async function departs({ jours = 90 } = {}) {
    try {
      const comptes = await q(
        `SELECT raison, COUNT(*) AS n FROM abonnement_departs
          WHERE cree > NOW(3) - INTERVAL ? DAY GROUP BY raison`, [jours]);
      const mots = await q(
        `SELECT raison, texte, formule, cree FROM abonnement_departs
          WHERE texte IS NOT NULL ORDER BY id DESC LIMIT 20`);
      const par = new Map(comptes.map((c) => [c.raison, Number(c.n)]));
      return {
        jours,
        raisons: RAISONS_DEPART.map(([cle, libelle]) => ({ cle, libelle, n: par.get(cle) ?? 0 })),
        mots: mots.map((m) => ({ ...m,
          libelle: RAISONS_DEPART.find(([k]) => k === m.raison)?.[1] ?? m.raison })),
      };
    } catch (e) {
      if (e?.code === 'ER_NO_SUCH_TABLE') return null;
      throw e;
    }
  }

  /* ---------------------------------------------------------------- routes */

  const router = express.Router();
  router.use(express.json({ limit: '4kb' }));

  router.post('/depart', requireAuth, async (req, res) => {
    try {
      const r = await noterDepart(req.user.id, req.body ?? {});
      if (r.erreur) return res.status(400).json({ error: r.erreur });
      res.json(r);
    } catch (e) {
      console.error('[abonnement] départ', e.message);
      res.status(503).json({ error: 'abo.error.unavailable' });
    }
  });

  /**
   * L'état du PASS, pour l'écran qui le vend et le montre.
   *
   * Tout ce que la page écrit part d'ici : le prix, ce que le PASS ouvre et
   * ce qu'on a sans lui, les saisons qu'un achat couvrirait, la voie de
   * chaque PASS possédé. Une page qui recopie un barème le fait mentir au
   * premier réglage changé dans /admin.
   */
  /* La fin du PASS en cours : celle de la saison, ou pendant la BASE
     (saison 0), celle de la saison 1 dont le PASS est déjà actif. */
  const finDuPass = (c) => (Number(c?.numero) === 0
    ? (toutes().find((s) => Number(s.numero) === 1)?.fin ?? null) : (c?.fin ?? null));

  router.get('/', requireAuth, async (req, res) => {
    try {
      const userId = req.user.id;
      const [e, actif, nombre, mesVoies, o, bourse, anciens] = await Promise.all([
        etat(userId), estAbonne(userId), nombrePass(userId), voies(userId), offre(userId),
        q('SELECT scarves FROM user_wallet WHERE user_id = ?', [userId]).catch(() => []),
        anciensEnVente(userId),
      ]);
      const c = courante();
      const article = CATALOGUE.find((a) => a.livraison?.type === 'pass' && !a.retire);
      res.json({
        /* L'ancien abonnement, s'il en reste un : l'écran sait encore le
           montrer et le résilier jusqu'à la fin de sa période payée. */
        ancien: e.formule ? e : null,
        actif,
        /* Les champs d'avant, que le menu, la boutique et le KOP lisent :
           `abonne` (les avantages de la saison en ce moment), `fin` (la fin de
           la saison couverte, ou celle de l'ancien abonnement). */
        abonne: actif,
        formule: actif ? (o.deja.length ? 'pass' : e.formule) : null,
        fin: actif ? (o.deja.length && finDuPass(c) ? finDuPass(c) : e.fin ?? null) : null,
        kopsRestants: Math.max(0, nombre * reglage('pass.kops_par_pass') - Number((await q(
          'SELECT COUNT(*) AS n FROM kops WHERE createur = ?', [userId]).catch(() => [{ n: 0 }]))[0]?.n ?? 0)),
        formules: article ? [{ id: article.id, formule: 'pass', nom: article.nom,
          prixTexte: enEuros(article.prix), marque: null, packs: article.livraison.packs ?? 0,
          mois: 3, parMois: enEuros(Math.round(article.prix / 3)) }] : [],
        nombre,
        voies: mesVoies,
        saison: c ? { numero: Number(c.numero), nom: c.nom, fin: c.fin ?? null,
          joursRestants: c.joursRestants ?? null, finie: Boolean(c.finie) } : null,
        offre: {
          couvre: o.couvre.map((n) => passDe(n)),
          aAcheter: o.aAcheter,
          deja: o.deja,
          article: article ? { id: article.id, nom: article.nom, prixTexte: enEuros(article.prix),
            packs: article.livraison.packs ?? 0 } : null,
          echarpes: reglage('pass.prix_echarpes') || null,
          /* Fermé à l'achat jusqu'à l'ouverture du PASS : `{ ouvre }`, ou `null`. */
          bientot: o.bientot,
          dernierMoisJours: reglage('pass.dernier_mois_jours'),
        },
        echarpes: Number(bourse?.[0]?.scarves ?? 0),
        voie: VOIE_PASS,
        /* Ce que le PASS ouvre, et ce qu'on a sans lui : « 24 au lieu de 12 ». */
        ouvre: {
          packMax: plafondPacks(true),
          packRegenMin: reglage('abo.pack_regen_min'),
          clubsParPass: reglage('pass.clubs_par_pass'),
          kopsParPass: reglage('pass.kops_par_pass'),
        },
        sans: {
          packMax: plafondPacks(false),
          packRegenMin: reglage('pack.regen_min'),
          parcoursLibre: reglage('abo.parcours_libre'),
          souvenirsLibres: reglage('abo.souvenirs_libres'),
        },
        /* La promesse du jeu, à lire avant de payer : rien ne manque pour jouer. */
        libre: [
          'toutes les cartes, tous les âges, tous les formats',
          'le Grand Virage, les mini-jeux et le pronostic',
          'tout compte au classement, sans limite',
          'chaque saison ajoute pour tous ses séries, ses pièces et ses stades',
        ],
        raisonsDepart: RAISONS_DEPART.map(([cle, libelle]) => ({ cle, libelle })),
        passes: passAvecTenue(),
        /* Les anciens PASS en vente (Gaël, 3 novembre 2026) : même prix,
           le contenu seulement, sans tampon « ÉDITION ORIGINALE ». */
        anciensPass: anciens,
      });
    } catch (err) {
      console.error('[abonnement]', err.message);
      res.status(503).json({ error: 'abo.error.unavailable' });
    }
  });

  /** Payer le PASS en écharpes. */
  router.post('/pass/echarpes', requireAuth, async (req, res) => {
    try {
      const r = await acheterEnEcharpes(req.user.id, { saison: req.body?.saison ?? null });
      if (r.erreur) return res.status(r.erreur === 'pass.error.indisponible' ? 503 : 400)
        .json({ error: r.erreur });
      res.json(r);
    } catch (err) {
      console.error('[abonnement] PASS en écharpes', err.message);
      res.status(503).json({ error: 'abo.error.unavailable' });
    }
  });

  /** Le badge PASS d'un joueur, pour sa carte de supporter (public). */
  router.get('/badge/:id', async (req, res) => {
    try {
      res.json({ badge: await badgeDe(String(req.params.id)) });
    } catch (err) {
      console.error('[abonnement] badge', err.message);
      res.json({ badge: null });
    }
  });

  return { router, estAbonne, etat, accorder, renouveler, retirer, noterDepart, departs,
    plafondPacks, regenMs, profondeurParcours, profondeurSouvenirs, clubsEnPlus,
    kopsAutorises, nombrePass, saisonsDuPass, voies, badgeDe, badgesDe, ageTenuePass,
    tenueAuPass, accorderPass, retirerPass, offre, acheterEnEcharpes, passDuJoueur,
    anciensEnVente, tenuesAuxBoosters, saisonPassee };
}
