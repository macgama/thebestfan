/**
 * Le grand livre des récompenses : la seule porte des versements nouveaux.
 *
 * ## Pourquoi une seule porte
 *
 * Le chantier du quotidien fait verser au jeu huit sortes de choses : le bonus
 * de présence, les missions, le sachet, les paliers du carnet, le passage de
 * relais, les crans et les séries complètes de la collection, les divisions —
 * et la vague 2 une neuvième, l'XP d'un match poussé au Grand Virage.
 * Chacune aurait pu verser à sa façon. Ce dépôt sait ce que cela donne : la
 * bourse s'ouvrait de cinq manières et une seule connaissait la règle
 * (`bourse.js`), la fin de duel payait deux fois le joueur resté, deux gains
 * d'XP simultanés payaient deux fois un palier. Chaque défaut était local, et
 * chaque module le refaisait.
 *
 * Ici, tout versement passe par `verser()`, et `verser()` tient quatre
 * promesses à la fois, que les huit sources n'ont plus à tenir chacune :
 *
 *   — **une seule fois** : la clé primaire `(user_id, source, cle)` de
 *     `recompenses` est l'idempotence. Deux onglets, un double clic, un réseau
 *     qui rejoue : la seconde ligne n'entre pas, et rien n'est crédité ;
 *   — **entier ou rien** : la ligne du grand livre, les écharpes, les boosters
 *     et l'XP entrent dans la même transaction. Une ligne qui dirait « 20 XP »
 *     sans l'XP ne se rattraperait jamais, sa clé interdisant de la reverser ;
 *   — **jamais au-delà du disjoncteur** : au plus tant d'écharpes et tant de
 *     boosters par joueur et par jour, toutes sources confondues. Une faute de
 *     réglage coûte une journée, pas plus ;
 *   — **jamais sans son registre** : une table absente refuse le versement
 *     (`schema`) au lieu de créditer sans trace.
 *
 * ## Ce que le module ne sait pas, exprès
 *
 * Il ne reçoit ni l'abonnement, ni le KOP, ni les amis. Aucun montant n'en
 * dépend, et le meilleur moyen de le garantir est qu'il ne puisse pas le
 * lire. La recharge des boosters (`recharger`, fournie par le module fanzzy)
 * lit l'abonnement pour sa cadence, comme elle l'a toujours fait : c'est le
 * rythme de la réserve, pas un montant du grand livre.
 *
 * Les montants ne viennent jamais de la requête du joueur : l'appelant les
 * tient de sa propre ligne en base (la mission copiée au tirage) ou du
 * registre des réglages. Le grand livre ne fait que les inscrire.
 */
import { assurerBourse } from './bourse.js';
import { reglage } from '../shared/reglages.js';
import { grandLivreFerme } from './auth/schema.js';

/** Les sources, liste fermée. La colonne `source` n'accepte rien d'autre.

    `virage` (vague 2, lot 6) : l'XP d'un match poussé au Grand Virage, une
    fois par match — la clé est l'identifiant du match (`CONTRATS.md`, § 15.2).
    Elle n'a demandé aucune colonne : `source` est un `VARCHAR(16)`, et
    l'idempotence par match tient dans la clé primaire qui existe.

    `prono` (6 octobre 2026) : les écharpes d'un pronostic juste, une fois par
    match — la clé est l'identifiant du match, comme `virage`. */
export const SOURCES = ['bonus', 'mission', 'sachet', 'carnet', 'relais', 'cran', 'serie', 'division',
  'virage', 'prono'];

/** Les raisons d'un refus, liste fermée (`CONTRATS.md`, § 11). */
export const RAISONS = ['deja', 'incomplet', 'jour_passe', 'change', 'inactif', 'plafond',
  'schema', 'inconnu', 'quota'];

/* Ce qu'un recompte (`verifier`) a le droit de répondre, en plus de `true`.
   `deja`, `plafond` et `schema` n'y sont pas : ce sont les verdicts du grand
   livre lui-même, et un appelant qui les rendrait parlerait à sa place.

   `quota` y est, et c'est la différence avec `plafond` : le disjoncteur est
   au grand livre, toutes sources confondues, et ne regarde que les écharpes
   et les boosters ; le quota est une règle **d'une source**, que seul son
   recompte connaît — l'XP du Virage, au plus `xp.virage_matchs_jour` matchs
   par jour de jeu, compte ses lignes `virage` du jour sur la connexion du
   versement, sous le verrou du joueur. Il traverse tel quel, comme
   `incomplet`. */
const RAISONS_DU_RECOMPTE = new Set(['incomplet', 'inconnu', 'change', 'jour_passe', 'inactif',
  'quota']);

/** Le gain qui ne verse rien : celui d'une division (l'honneur seulement). */
export const GAIN_NUL = Object.freeze({ echarpes: 0, packs: 0, xp: 0, tampons: 0 });

const CLES_DU_GAIN = Object.keys(GAIN_NUL);

/* ------------------------------------------------------------ le journal

   Un refus pour schéma incomplet se dit **une fois** par cause, pas à chaque
   clic : un journal noyé sous la même ligne ne se lit plus. La cause porte le
   message de la base, qui nomme la table ou la colonne. */
const dejaDit = new Set();
function journaliser(cause) {
  if (dejaDit.has(cause) || dejaDit.size > 50) return;
  dejaDit.add(cause);
  console.error(`[recompenses] versement refusé, schéma incomplet : ${cause}. `
    + 'Le grand livre vit dans sql/quotidien.sql ; le message de démarrage '
    + '(et /healthz) nomme tout fichier manquant. Après un passage par le '
    + 'Manager : npm run schema:appliquer, puis redémarrer.');
}

/* --------------------------------------------------------- les contrôles

   Ce qui suit lève, et c'est voulu : ce sont des fautes de l'appelant, pas
   des refus à rendre au joueur. Une clé trop longue ou un gain négatif ne
   doivent jamais atteindre la base sous une forme tronquée ou retournée — ni
   passer pour un « déjà récupéré » qui ferait relire l'écran pour rien. */

function controlerAppel(o) {
  if (!o || typeof o !== 'object') throw new Error('recompenses : verser() attend un objet');
  if (typeof o.userId !== 'string' || !o.userId) {
    throw new Error('recompenses : userId manquant (l’identifiant public du joueur)');
  }
  if (!SOURCES.includes(o.source)) {
    throw new Error(`recompenses : source « ${o.source} » hors de la liste (${SOURCES.join(', ')})`);
  }
  if (typeof o.cle !== 'string' || o.cle.length < 1 || o.cle.length > 40) {
    throw new Error(`recompenses : clé « ${o.cle} » invalide (une chaîne de 1 à 40 caractères)`);
  }
  if (o.saisonId != null && !(Number.isInteger(o.saisonId) && o.saisonId >= 0)) {
    throw new Error(`recompenses : saisonId « ${o.saisonId} » n’est pas un entier`);
  }
  if (o.gain == null || (typeof o.gain !== 'object' && typeof o.gain !== 'function')) {
    throw new Error('recompenses : gain manquant (un objet, ou une fonction de la connexion)');
  }
  if (o.verifier != null && typeof o.verifier !== 'function') {
    throw new Error('recompenses : verifier doit être une fonction de la connexion');
  }
  for (const [nom, max] of [['titre', 64], ['insigne', 16]]) {
    const v = o[nom];
    if (v != null && (typeof v !== 'string' || v.length > max)) {
      throw new Error(`recompenses : ${nom} « ${v} » invalide (${max} caractères au plus)`);
    }
  }
}

/**
 * Le gain, sous la forme du contrat (`CONTRATS.md`, R5) : quatre entiers ≥ 0.
 *
 * Une clé absente vaut zéro ; une clé **inconnue** lève. Sans ce refus, un
 * `echarpe: 30` tapé d'un doigt pressé verserait zéro sans un mot — et la
 * ligne du grand livre, elle, serait bien écrite : la mission passerait pour
 * payée.
 */
export function normaliserGain(g) {
  if (!g || typeof g !== 'object') throw new Error('recompenses : gain absent');
  for (const k of Object.keys(g)) {
    if (!CLES_DU_GAIN.includes(k)) {
      throw new Error(`recompenses : gain.${k} n’existe pas (${CLES_DU_GAIN.join(', ')})`);
    }
  }
  const out = {};
  for (const k of CLES_DU_GAIN) {
    const v = g[k] ?? 0;
    if (!Number.isInteger(v) || v < 0) {
      throw new Error(`recompenses : gain.${k} doit être un entier positif ou nul, reçu ${
        JSON.stringify(g[k])}`);
    }
    out[k] = v;
  }
  return out;
}

const estSchema = (e) => e?.code === 'ER_NO_SUCH_TABLE' || e?.code === 'ER_BAD_FIELD_ERROR';

/* **Une course perdue se rejoue, une fois.**

   Deux façons pour la base de dire qu'une autre transaction est passée
   entre la lecture et l'écriture. L'interblocage, classique. Et
   `ER_CHECKREAD` (« Record has changed since last read ») : depuis MariaDB
   11.6, `innodb_snapshot_isolation` est allumé par défaut, et une
   transaction qui veut écrire une ligne qu'un autre a validée après son
   instantané est arrêtée là — y compris l'INSERT qui bute sur une clé
   arrivée entre-temps, que les versions d'avant signalaient par
   `ER_DUP_ENTRY`. Le poste de développement tourne en 12.3 ; la production,
   on ne le sait pas d'ici. Il faut donc tenir les deux.

   Les deux annulent la transaction entière, et rien n'a été écrit. On
   recommence du début : l'étape 2 voit alors la ligne de l'autre, et rend
   « deja ». Une seule fois — deux courses perdues d'affilée sur le même
   joueur ne sont plus une course, et l'erreur doit se voir. Cela suppose que
   `verifier` et `gain` ne fassent que lire, sur la connexion qu'on leur
   donne : c'est leur contrat. */
const COURSES = new Set(['ER_CHECKREAD', 'ER_LOCK_DEADLOCK']);

/**
 * Verse une récompense, une fois et une seule.
 *
 * @param pool    le pool du serveur
 * @param o.userId    l'identifiant public du joueur (celui de la session)
 * @param o.source    une valeur de SOURCES
 * @param o.cle       la clé de la ligne (`PLAN.md`, § 3 : le jour, le jour et
 *                    le rang, S<saison>:<n>…)
 * @param o.saisonId  entier ou null
 * @param o.gain      { echarpes, packs, xp, tampons } — ou async (conn) => gain,
 *                    calculé DANS la transaction, après le recompte (le bonus
 *                    de présence en a besoin : sa case dépend de ce qui est
 *                    déjà inscrit)
 * @param o.titre, o.insigne   copiés dans la ligne
 * @param o.verifier  async (conn) => true | 'incomplet' | 'inconnu' | 'change'
 *                    | 'jour_passe' | 'inactif' | 'quota' — le recompte de
 *                    l'appelant, DANS la transaction, sous le verrou du joueur.
 *                    Ce qu'il veut dire de plus que la raison (le `manque` de
 *                    l'XP du Virage) reste chez lui : il le garde dans sa
 *                    fermeture et l'ajoute à la réponse qu'il sert.
 * @param o.niveau    le module niveau : `gagnerDans(conn, userId, xp)` crédite
 *                    l'XP sur la connexion du versement ; obligatoire si le
 *                    gain porte de l'XP
 * @param o.recharger async (conn, userId) => void — la recharge des boosters
 *                    du module fanzzy, appelée sous le verrou avant de créditer
 *                    un booster offert ; obligatoire si le gain en porte
 * @returns { verse: true, gain, wallet: { scarves, packs }, niveau? }
 *        | { verse: false, raison }
 */
export async function verser(pool, o) {
  controlerAppel(o);
  for (let essai = 1; ; essai++) {
    try {
      return await verserUneFois(pool, o);
    } catch (e) {
      if (essai < 2 && COURSES.has(e?.code)) continue;
      throw e;
    }
  }
}

async function verserUneFois(pool, o) {
  /* Le contrôle de démarrage a vu la table sans sa clé primaire : verser
     maintenant, ce serait verser sans idempotence. On refuse tout, jusqu'au
     redémarrage sur une base corrigée. */
  const ferme = grandLivreFerme();
  if (ferme) {
    journaliser(ferme);
    return { verse: false, raison: 'schema' };
  }

  const conn = await pool.getConnection();
  const q = async (sql, params) => (await conn.execute(sql, params))[0];
  let enCours = false;
  try {
    /* 1. La bourse existe, puis on la verrouille.

       **La bourse s'ouvre avant la transaction, pas dedans.** `INSERT IGNORE`
       sur une ligne qui existe pose un verrou partagé sur elle, gardé jusqu'à
       la fin de la transaction. Deux versements du même joueur en tiendraient
       chacun un, puis demanderaient chacun le verrou exclusif du `FOR UPDATE`
       — et chacun attendrait l'autre : un interblocage, sur le cas le plus
       banal qui soit, deux onglets. Hors transaction, le verrou partagé tombe
       avec l'instruction.

       Le `FOR UPDATE` fait passer **tous** les versements d'un même joueur
       l'un après l'autre. Tout chemin qui touche aux lignes du jour (la
       relance comprise) prend ce verrou-là en premier, pour que les verrous
       se prennent toujours dans le même ordre. */
    await assurerBourse(q, o.userId);
    await conn.beginTransaction();
    enCours = true;
    const [bourse] = await q(
      'SELECT scarves, packs FROM user_wallet WHERE user_id = ? FOR UPDATE', [o.userId]);
    if (!bourse) {
      /* `assurerBourse` n'a rien pu ouvrir : le joueur n'existe pas dans
         `users` (la clé étrangère de la bourse a refusé la ligne, et `INSERT
         IGNORE` l'a tu). Rien à créditer, et rien à inscrire. */
      await conn.rollback();
      enCours = false;
      return { verse: false, raison: 'inconnu' };
    }

    /* 2. Déjà versé ? **Avant** le disjoncteur : sinon une chose déjà payée,
       un jour de plafond, répondrait « tu récupéreras le reste demain » pour
       un versement qui ne viendra jamais.

       La lecture se fait après le verrou, et c'est la première lecture
       ordinaire de la transaction : l'instantané qu'elle ouvre voit donc tout
       ce qu'un versement concurrent a validé avant de rendre le verrou. */
    const deja = await q(
      'SELECT 1 FROM recompenses WHERE user_id = ? AND source = ? AND cle = ? LIMIT 1',
      [o.userId, o.source, o.cle]);
    if (deja.length) {
      await conn.rollback();
      enCours = false;
      return { verse: false, raison: 'deja' };
    }

    /* 3. Le recompte de l'appelant, sous le verrou. */
    if (o.verifier) {
      const v = await o.verifier(conn);
      if (v !== true) {
        if (!RAISONS_DU_RECOMPTE.has(v)) {
          throw new Error(`recompenses : verifier a rendu « ${v} », attendu true ou l’une de `
            + [...RAISONS_DU_RECOMPTE].join(', '));
        }
        await conn.rollback();
        enCours = false;
        return { verse: false, raison: v };
      }
    }

    /* 4. Le gain, calculé maintenant s'il dépend de l'état. */
    const gain = normaliserGain(typeof o.gain === 'function' ? await o.gain(conn) : o.gain);
    if (gain.packs > 0 && typeof o.recharger !== 'function') {
      throw new Error('recompenses : un gain qui porte des boosters demande « recharger » '
        + '(fanzzy.recharger) — sans elle, le cadeau effacerait la recharge en attente');
    }
    if (gain.xp > 0 && typeof o.niveau?.gagnerDans !== 'function') {
      throw new Error('recompenses : un gain qui porte de l’XP demande « niveau » '
        + '(le module, pour sa gagnerDans)');
    }

    /* 5. Le disjoncteur : ce que le joueur a déjà reçu aujourd'hui, toutes
       sources confondues, plus ce versement. Le jour est celui de la base
       (`CURDATE()`), comme `verse_a` qu'elle date elle-même.

       On le compare **avec** le gain, et non « déjà au plafond ? » : une
       faute de réglage qui fabriquerait un gain énorme serait sinon versée en
       entier, une fois, avant que le disjoncteur ne saute. Et une dimension
       que le versement ne touche pas ne le bloque pas : une division, qui ne
       verse rien, passe toujours. */
    if (gain.echarpes > 0 || gain.packs > 0) {
      const [s] = await q(
        `SELECT COALESCE(SUM(echarpes), 0) AS e, COALESCE(SUM(packs), 0) AS p
           FROM recompenses WHERE user_id = ? AND verse_a >= CURDATE()`, [o.userId]);
      const trop = (gain.echarpes > 0
          && Number(s.e) + gain.echarpes > reglage('recompenses.plafond_echarpes_jour'))
        || (gain.packs > 0 && Number(s.p) + gain.packs > reglage('recompenses.plafond_packs_jour'));
      if (trop) {
        await conn.rollback();
        enCours = false;
        return { verse: false, raison: 'plafond' };
      }
    }

    /* 6. La ligne. Un INSERT **simple** : `INSERT IGNORE` avalerait aussi
       une troncature ou une valeur hors bornes, et la ligne entrerait fausse.
       Le doublon est la course que l'étape 2 n'a pas pu voir — une écriture
       qui n'est pas passée par ce verrou. Sur une base à instantanés stricts,
       la même course arrive en `ER_CHECKREAD` et se rejoue (`COURSES`). */
    try {
      await q(
        `INSERT INTO recompenses
           (user_id, source, cle, saison_id, echarpes, packs, xp, tampons, titre, insigne)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [o.userId, o.source, o.cle, o.saisonId ?? null, gain.echarpes, gain.packs, gain.xp,
          gain.tampons, o.titre ?? null, o.insigne ?? null]);
    } catch (e) {
      if (e?.code !== 'ER_DUP_ENTRY') throw e;
      await conn.rollback();
      enCours = false;
      return { verse: false, raison: 'deja' };
    }

    /* 7. La bourse. **La recharge due d'abord** : `wallet()` remet la
       minuterie à zéro dès que la réserve est pleine, si bien qu'un booster
       offert qui la remplit effaçait la recharge en cours — un sachet reçu à
       11 sur 12, une recharge due, et le joueur finissait à 12 au lieu de 13.
       Le cadeau entre ensuite, même au-dessus du plafond : c'est un cadeau,
       pas une réserve plus grande. */
    if (gain.packs > 0) await o.recharger(conn, o.userId);
    if (gain.echarpes > 0 || gain.packs > 0) {
      await q('UPDATE user_wallet SET scarves = scarves + ?, packs = packs + ? WHERE user_id = ?',
        [gain.echarpes, gain.packs, o.userId]);
    }

    /* 8. L'XP, sur la même connexion, sous le même verrou. `gagnerDans` lève
       au lieu d'avaler : une erreur ici annule **tout**, ligne comprise. */
    let niveau;
    if (gain.xp > 0) niveau = await o.niveau.gagnerDans(conn, o.userId, gain.xp);

    /* La bourse d'après, relue plutôt que recalculée : la recharge et les
       écharpes d'un palier de niveau y sont passées, et le contrat promet le
       solde réel (`CONTRATS.md`, R6). */
    const [apres] = await q('SELECT scarves, packs FROM user_wallet WHERE user_id = ?', [o.userId]);

    /* 9. Valider. */
    await conn.commit();
    enCours = false;
    return {
      verse: true,
      gain,
      wallet: { scarves: Number(apres.scarves), packs: Number(apres.packs) },
      ...(niveau ? { niveau } : {}),
    };
  } catch (e) {
    if (enCours) await conn.rollback().catch(() => {});
    /* Une table ou une colonne absente — celle du grand livre, ou celle que
       lit le recompte de l'appelant : la fonction s'éteint, la route reste.
       Jamais de versement sans sa ligne. */
    if (estSchema(e)) {
      journaliser(e.sqlMessage ?? e.message);
      return { verse: false, raison: 'schema' };
    }
    throw e;
  } finally {
    conn.release();
  }
}

/**
 * La jauge d'un ensemble de versements, comme le contrat la décrit pour
 * « tout récupérer » (`CONTRATS.md`, R6) : le départ d'avant le premier, la
 * jauge d'après le dernier, les gains et les écharpes de palier additionnés,
 * tous les paliers franchis, et le niveau d'avant le premier.
 */
function agregerNiveau(acc, n) {
  if (!acc) return { ...n, paliers: [...(n.paliers ?? [])] };
  return {
    ...n,
    gain: (acc.gain ?? 0) + (n.gain ?? 0),
    ecarpes: (acc.ecarpes ?? 0) + (n.ecarpes ?? 0),
    paliers: [...acc.paliers, ...(n.paliers ?? [])],
    avant: acc.avant,
    depart: acc.depart,
    monte: n.niveau > acc.avant,
  };
}

/**
 * Plusieurs versements, chacun dans sa transaction, arrêtés au disjoncteur.
 *
 * Chacun dans la sienne, et non tous dans une : un « tout récupérer » qui
 * bute sur le plafond au quatrième élément doit garder les trois premiers.
 * C'est la règle du contrat — ce qui a été versé l'est, et `reste` dit
 * combien d'éléments restent dus.
 *
 * Un élément refusé pour une autre raison (déjà versé dans un autre onglet,
 * pas encore atteint) est passé, et l'on continue. Un refus de schéma arrête
 * tout : les suivants échoueraient pareil.
 *
 * @param liste  des objets comme ceux de `verser`, sans le pool
 * @param o.niveau, o.recharger   communs à toute la liste
 * @returns { verse: true, gain, wallet, niveau?, reste? }
 *        | { verse: false, raison, reste? }
 */
export async function verserTout(pool, liste, { niveau, recharger } = {}) {
  const gain = { ...GAIN_NUL };
  let verses = 0;
  let wallet;
  let jauge;
  let raison = null;
  let reste = 0;
  for (let i = 0; i < liste.length; i++) {
    const r = await verser(pool, { niveau, recharger, ...liste[i] });
    if (r.verse) {
      verses++;
      for (const k of CLES_DU_GAIN) gain[k] += r.gain[k];
      wallet = r.wallet;
      if (r.niveau) jauge = agregerNiveau(jauge, r.niveau);
      continue;
    }
    raison ??= r.raison;
    if (r.raison === 'plafond') { reste = liste.length - i; break; }
    if (r.raison === 'schema') break;
  }
  /* `reste` n'apparaît que s'il vaut quelque chose : un champ absent veut
     dire « rien à montrer » (`CONTRATS.md`, R1). */
  if (!verses) return { verse: false, raison: raison ?? 'incomplet', ...(reste ? { reste } : {}) };
  return { verse: true, gain, wallet, ...(jauge ? { niveau: jauge } : {}),
    ...(reste ? { reste } : {}) };
}
