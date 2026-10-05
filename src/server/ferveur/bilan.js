import { verser as verserAuGrandLivre } from '../recompenses.js';
import { createNiveau } from '../niveau/index.js';
import { reglage } from '../../shared/reglages.js';
import { verdictDe } from '../../shared/verdict.js';
import { CHANTS } from '../../shared/duel/chants.js';

/**
 * Le bilan de tribune du Grand Virage (`serveur/CONTRATS.md`, § 15).
 *
 * Il remplace « QUITTER LA TRIBUNE ? » et se pose au coup de sifflet final :
 * ce que le geste a donné pendant ce match — la ferveur, les chants, les
 * PARFAITS, la meilleure série, le meilleur geste, la place dans sa tribune,
 * les cartes-souvenirs —, et l'XP du match.
 *
 * ## Il se lit dans la base, jamais dans la salle
 *
 * La salle en mémoire ne voit que ceux qui sont là, et seulement depuis
 * qu'elle existe : une salle rouverte repart de zéro, et le rang « en direct »
 * ne compte que les présents. La ligne de présence (`virage_presence`), elle,
 * cumule tout le match, tous les passages compris, et garde ceux qui sont
 * partis avant la fin. Le bilan dit le match entier : il la lit.
 *
 * ## Mille bilans au coup de sifflet (P5)
 *
 * `virage:fin` part à toute la salle d'un coup, et chaque page demande son
 * bilan dans les huit secondes qui suivent. Une lecture par page, c'est mille
 * lectures de rang sur la même plage d'index. **Une fois le match fini**, les
 * chiffres ne bougent presque plus : la salle entière se lit **en deux
 * requêtes** (`lireSalle`), gardées deux minutes et partagées par une promesse
 * en vol, et chaque bilan se compose en mémoire. Le nombre de requêtes de
 * lecture ne dépend plus de l'effectif. Le contrat ne promet pas qu'un bilan
 * « fini » soit définitif (§ 15.1) : seulement qu'il vient de cette lecture.
 *
 * Pendant le match, un bilan demandé à la sortie lit ses trois choses — sa
 * ligne (clé primaire), son rang (un `COUNT` sur la plage `idx_bilan` de son
 * match et de son camp), ses cartes —, à jour.
 *
 * ## L'XP du match
 *
 * Décision de Gaël (Q1, 3 octobre 2026) : 15 XP par match poussé, une fois
 * par match, à partir de 10 chants acceptés, 3 matchs par jour au plus ; les
 * trois nombres au registre (`xp.virage`, `xp.virage_chants`,
 * `xp.virage_matchs_jour`). **Ni le club, ni l'abonnement, ni la neutralité,
 * ni `classe` n'y changent rien** (R9) : ce module ne les lit pas pour l'XP,
 * et `virage-smoke` vérifie qu'un abonné, un neutre et un Virage non classé
 * reçoivent ce que reçoit un joueur gratuit classé chez lui.
 *
 * Elle passe par le grand livre (`verser`, source `virage`, clé = le match) :
 * l'idempotence est sa clé primaire, deux onglets ou dix demandes simultanées
 * ne versent qu'une fois. Le recompte (`verifier`) relit, **sur la connexion
 * du versement** et sous le verrou du joueur, les chants du match et les
 * versements `virage` du jour : jamais par le pool, qu'un verrou tenu pourrait
 * affamer (`ETAT.md`, § 6).
 *
 * Les versements passent par un **sémaphore de quatre** : le pool de
 * production a huit connexions, et un coup de sifflet ne doit pas les prendre
 * toutes pour de l'XP.
 *
 * ## Une transaction de bourse par versement dû, pas une de plus
 *
 * Un versement tenté coûte une connexion, le verrou de la bourse et une place
 * au sémaphore, qu'il verse ou non. Trois chemins en ouvraient pour rien :
 *
 *   - **le départ d'un chanteur qui n'a pas assez chanté.** Le bilan évite le
 *     grand livre quand la ligne compte moins de chants que le seuil ; le
 *     filet du départ, non — et la page quitte la salle juste après son
 *     bilan, la tribune se vide d'un battement à `virage:ferme`. Deux cents
 *     « incomplet » déjà dits au bilan rouvraient deux cents transactions.
 *     Pour le filet, `verserXp` lit donc les chants **par la clé primaire,
 *     sur le pool, avant le sémaphore et hors de tout verrou** : sous le
 *     seuil, il répond sans transaction. Le recompte sous verrou reste — il
 *     fait foi ; les chants ne font que monter, et ce qui passe la lecture
 *     passe le recompte ;
 *   - **un refus qui ne changera pas** : « quota » jusqu'au minuit de la base
 *     (le plafond est compté sur `CURDATE()`, et un versement ne s'efface
 *     pas), « inconnu » et « schema » quelques minutes. Ils sont retenus par
 *     joueur et par match (`refus`) ; un joueur au plafond qui redemande son
 *     bilan toutes les cinq secondes, sur dix sockets, ne rouvre plus rien ;
 *   - **la même demande, en même temps** : dix sockets d'un joueur, ou un
 *     bilan et un départ, partagent le versement en vol (`xpEnVol`). Le
 *     premier dit ce qu'il a fait ; les autres reçoivent « deja » s'il a
 *     versé, comme le grand livre le leur aurait dit.
 *
 * Et **le bilan passe avant le filet** au sémaphore : une page attend sa
 * réponse trois secondes au plus (§ 15.4), le départ n'attend personne. Une
 * tribune qui se vide ne fait plus attendre le coup de sifflet d'une autre.
 */

/** Combien de temps la lecture groupée d'une salle finie sert, partagée. */
export const GARDE_SALLE_MS = 2 * 60_000;
/** Combien de versements d'XP à la fois, au plus. */
export const SEMAPHORE_XP = 4;
/** Combien de temps une forme de lecture repliée tient avant qu'on retente la plus riche. */
export const REPLI_BILAN_MS = 10 * 60_000;
/** Combien de temps un refus « inconnu » ou « schema » tient avant qu'on redemande au grand livre. */
export const GARDE_REFUS_MS = 5 * 60_000;
/** Une table ou une colonne absente : le grand livre dit alors « schema ». */
const estSchema = (e) => e?.code === 'ER_NO_SUCH_TABLE' || e?.code === 'ER_BAD_FIELD_ERROR';

/* Les trois formes de la ligne de présence, comme les trois formes de son
   écriture (`souvenirs/index.js`, `recordPush`) : avec les arènes et le
   quotidien, avec le quotidien seul, nue. Le bilan sert ce que la forme
   porte, et rien de plus (§ 15.4 : sans `sql/arenes.sql`, ni `parfaits`, ni
   `serie`, ni `meilleur`). */
const COLONNES = [
  'user_id, side, team_id, classe, ferveur, chants, parfaits, serie_max, meilleur_q, meilleur_chant',
  'user_id, side, team_id, classe, ferveur, chants',
  'user_id, side, team_id, classe, ferveur',
];

/* « Strictement mieux », écrit en SQL dans l'ordre de `comparerTribune`
   (`virage.js`) : la ferveur, puis les chants, puis les PARFAITS. Les
   paramètres sont les trois nombres du joueur, répétés pour chaque terme. */
const MIEUX = [
  { sql: `ferveur > ? OR (ferveur = ? AND chants > ?)
          OR (ferveur = ? AND chants = ? AND parfaits > ?)`,
    params: (l) => [l.ferveur, l.ferveur, l.chants, l.ferveur, l.chants, l.parfaits] },
  { sql: 'ferveur > ? OR (ferveur = ? AND chants > ?)',
    params: (l) => [l.ferveur, l.ferveur, l.chants] },
  { sql: 'ferveur > ?', params: (l) => [l.ferveur] },
];

/** Un entier ≥ 0, jamais `NaN` : mysql2 rend les sommes en chaîne. */
const nombre = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
};

/** La ligne, ramenée aux nombres que le classement compare. */
function lue(l, forme) {
  return {
    userId: String(l.user_id),
    side: Number(l.side) ? 1 : 0,
    teamId: l.team_id ?? null,
    classe: Number(l.classe) !== 0,
    ferveur: nombre(l.ferveur),
    chants: forme <= 1 ? nombre(l.chants) : 0,
    parfaits: forme === 0 ? nombre(l.parfaits) : 0,
    serieMax: forme === 0 ? nombre(l.serie_max) : 0,
    meilleurQ: forme === 0 ? nombre(l.meilleur_q) : 0,
    meilleurChant: forme === 0 ? (l.meilleur_chant ?? null) : null,
  };
}

/** Ferveur, puis chants, puis PARFAITS : > 0 si `a` fait strictement mieux. */
const comparer = (a, b) => (a.ferveur - b.ferveur) || (a.chants - b.chants)
  || (a.parfaits - b.parfaits);

/** Une carte-souvenir telle que le contrat la sert : `minute` et `joueur` absents s'ils sont inconnus. */
const carteSouvenir = (s) => ({
  id: Number(s.id),
  ...(s.minute != null ? { minute: Number(s.minute) } : {}),
  ...(s.player ? { joueur: String(s.player) } : {}),
});

/**
 * @param {object} o
 * @param o.pool       le pool du serveur
 * @param [o.verser]   la porte du grand livre ; une suite peut la doubler
 * @param [o.niveau]   le module niveau (`gagnerDans`). Sans lui, une instance
 *   locale du même module : `gagnerDans` ne tient aucun état, il travaille sur
 *   la connexion qu'on lui donne. `server.js` doit passer le sien.
 * @param [o.recharger] la recharge des boosters (`fanzzy.recharger`) ; l'XP du
 *   Virage ne porte pas de booster, elle n'est passée que par principe
 * @param [o.horloge]  l'heure des gardes et des replis ; les suites l'avancent
 */
export function createBilan({ pool, verser = verserAuGrandLivre, niveau = null,
                              recharger = null, log = console, horloge = Date.now }) {
  let niveauLocal = null;
  const niveauDe = () => niveau
    ?? (niveauLocal ??= createNiveau({ pool, requireAuth: (_q, _r, suite) => suite() }));

  /* ------------------------------------------------ les formes, et leur repli

     La même règle que l'écriture : sur `ER_BAD_FIELD_ERROR`, on descend d'une
     forme et l'on s'y tient dix minutes, le journal le dit une fois ; passé
     ce délai, on retente la plus riche, sans redémarrer. */
  let forme = 0;
  let repliJusqua = 0;
  const dits = new Set();
  /** Une fois par processus, au journal : une base incomplète se dit, sans inonder. */
  const dire = (cle, message) => {
    if (dits.has(cle)) return;
    dits.add(cle);
    log.warn(message);
  };

  /**
   * Lit avec la forme la plus riche que la base accepte.
   * @param fabriquer (forme) => { sql, params }
   * @returns {{ lignes: Array, forme: number }}
   */
  async function lire(fabriquer) {
    const debut = horloge() >= repliJusqua ? 0 : forme;
    for (let k = debut; k < COLONNES.length; k++) {
      const { sql, params } = fabriquer(k);
      let lignes;
      try {
        [lignes] = await pool.execute(sql, params);
      } catch (e) {
        if (e?.code !== 'ER_BAD_FIELD_ERROR' || k === COLONNES.length - 1) throw e;
        continue;
      }
      if (k > debut) {
        repliJusqua = horloge() + REPLI_BILAN_MS;
        if (!dits.has(k)) {
          dits.add(k);
          log.warn(`[virage] bilan de tribune sans ${k === 1 ? 'PARFAITS, série ni meilleur geste'
            : 'chants'} — appliquer ${k === 1 ? 'sql/arenes.sql' : 'sql/quotidien.sql'} `
            + '(npm run schema:appliquer). Les colonnes se relisent toutes les dix minutes.');
        }
      } else if (k === 0) {
        repliJusqua = 0;
      }
      forme = k;
      return { lignes, forme: k };
    }
    return { lignes: [], forme: COLONNES.length - 1 };
  }

  /* --------------------------------------------- les cartes du match

     Une table absente (une base sans les souvenirs) ne fait pas tomber le
     bilan : il n'a simplement pas de cartes. */
  async function cartes(sql, params) {
    try {
      return (await pool.execute(sql, params))[0];
    } catch (e) {
      if (e?.code === 'ER_NO_SUCH_TABLE' || e?.code === 'ER_BAD_FIELD_ERROR') return [];
      throw e;
    }
  }

  /* --------------------------------------------- la salle entière, une fois

     `salles` garde la dernière lecture de chaque salle finie, deux minutes ;
     `enVol` partage celle qui est en route. Les deux sont bornées par les
     salles finies des deux dernières minutes : on purge à chaque lecture. */
  const salles = new Map();         // fixtureId -> { t, parJoueur }
  const enVol = new Map();          // fixtureId -> Promise

  /**
   * Toute la salle d'un match, en deux requêtes, quel que soit l'effectif :
   * les lignes de présence, puis les cartes-souvenirs de présence du match.
   * Le rang de chacun se calcule ici, dans l'ordre du bilan.
   *
   * @returns {Promise<{ t: number, parJoueur: Map<string, object> }>}
   */
  async function lireSalle(fixtureId) {
    const fid = Number(fixtureId);
    const t = horloge();
    for (const [id, s] of salles) if (t - s.t >= GARDE_SALLE_MS) salles.delete(id);
    const garde = salles.get(fid);
    if (garde) return garde;
    if (enVol.has(fid)) return enVol.get(fid);

    const p = (async () => {
      const { lignes, forme: f } = await lire((k) => ({
        sql: `SELECT ${COLONNES[k]} FROM virage_presence WHERE fixture_id = ?`, params: [fid] }));
      const souvenirs = await cartes(
        `SELECT us.user_id, s.id, s.minute, s.player
           FROM souvenirs s
           JOIN user_souvenirs us ON us.souvenir_id = s.id
          WHERE s.fixture_id = ? AND us.kind = 'presence'
          ORDER BY s.seq`, [fid]);

      const parJoueur = new Map();
      const tribunes = [[], []];
      for (const brute of lignes) {
        const l = lue(brute, f);
        const entree = { ligne: l, forme: f, rang: 0, sur: 0, souvenirs: [] };
        parJoueur.set(l.userId, entree);
        tribunes[l.side].push(entree);
      }
      for (const tribune of tribunes) {
        tribune.sort((a, b) => comparer(b.ligne, a.ligne));
        for (let i = 0; i < tribune.length; i++) {
          const egal = i > 0 && comparer(tribune[i].ligne, tribune[i - 1].ligne) === 0;
          tribune[i].rang = egal ? tribune[i - 1].rang : i + 1;
          tribune[i].sur = tribune.length;
        }
      }
      for (const s of souvenirs) parJoueur.get(String(s.user_id))?.souvenirs.push(carteSouvenir(s));

      const lu = { t: horloge(), parJoueur };
      salles.set(fid, lu);
      return lu;
    })().finally(() => { if (enVol.get(fid) === p) enVol.delete(fid); });
    enVol.set(fid, p);
    return p;
  }

  /**
   * Un joueur, pendant le match : sa ligne, sa place, ses cartes — trois
   * lectures, à jour. `null` sans ligne de présence.
   */
  async function lireJoueur(userId, fixtureId) {
    const { lignes, forme: f } = await lire((k) => ({
      sql: `SELECT ${COLONNES[k]} FROM virage_presence WHERE user_id = ? AND fixture_id = ?`,
      params: [userId, fixtureId] }));
    if (!lignes.length) return null;
    const l = lue(lignes[0], f);
    /* La place, sur la plage (match, camp) de `idx_bilan` : combien sont
       dans ce camp, et combien font strictement mieux. Lue dans la forme de
       la ligne : sans les PARFAITS, ils ne départagent rien.

       sql-sur : `m.sql` vient de la table constante `MIEUX`, choisie par la
       forme du schéma (un indice 0 à 2 que `lire` calcule), jamais d'une
       donnée ; les nombres du joueur passent tous en paramètres. */
    const m = MIEUX[f];
    const [[place]] = await pool.execute(
      `SELECT COUNT(*) AS sur, COALESCE(SUM(${m.sql}), 0) AS mieux
         FROM virage_presence WHERE fixture_id = ? AND side = ?`,
      [...m.params(l), fixtureId, l.side]);
    const souvenirs = await cartes(
      `SELECT s.id, s.minute, s.player
         FROM user_souvenirs us
         JOIN souvenirs s ON s.id = us.souvenir_id
        WHERE us.user_id = ? AND s.fixture_id = ? AND us.kind = 'presence'
        ORDER BY s.seq`, [userId, fixtureId]);
    return {
      ligne: l, forme: f,
      rang: nombre(place?.mieux) + 1,
      sur: Math.max(1, nombre(place?.sur)),
      souvenirs: souvenirs.map(carteSouvenir),
    };
  }

  /* -------------------------------------------------------------- l'XP */

  /* **Le sémaphore, en deux files.** Le bilan d'abord — une page attend sa
     réponse, trois secondes au plus (§ 15.4) —, le filet du départ ensuite :
     personne ne l'attend. Une place libérée passe de main en main, à la
     première file qui a du monde. Un filet en attente que rejoint un bilan
     (le même joueur, le même match : voir `xpEnVol`) passe dans la première. */
  let enCoursXp = 0;
  const filesXp = { bilan: [], filet: [] };
  /**
   * Au plus `SEMAPHORE_XP` versements à la fois, les autres attendent leur tour.
   * @param ticket `{ bilan: boolean }` — sa file ; `promouvoir` peut la changer
   */
  async function sousSemaphore(fn, ticket) {
    if (enCoursXp < SEMAPHORE_XP) enCoursXp++;
    else {
      await new Promise((r) => {
        ticket.partir = r;
        filesXp[ticket.bilan ? 'bilan' : 'filet'].push(ticket);
      });
    }
    try {
      return await fn();
    } finally {
      const suivant = filesXp.bilan.shift() ?? filesXp.filet.shift();
      if (suivant) suivant.partir(); else enCoursXp--;
    }
  }
  /** Un filet en attente qu'une page attend désormais : il passe dans la file des bilans. */
  function promouvoir(ticket) {
    if (ticket.bilan) return;
    ticket.bilan = true;
    const i = filesXp.filet.indexOf(ticket);
    if (i >= 0) filesXp.bilan.push(...filesXp.filet.splice(i, 1));
  }

  /* **Ce que le grand livre a refusé, et qui ne changera pas.** Par joueur et
     par match. « quota » tient jusqu'au minuit de la base — le plafond se
     compte sur `CURDATE()`, et un versement ne s'efface pas —, et tant que le
     plafond du registre reste le même ; « inconnu » (le joueur n'a pas de
     bourse) et « schema » (le grand livre ou sa colonne manque),
     `GARDE_REFUS_MS`. Rien d'autre : « incomplet » change au chant suivant,
     et la lecture qui le dit ne prend ni connexion ni verrou. Le ménage passe
     au plus une fois par minute. */
  const refus = new Map();          // `${userId}:${fixtureId}` -> { raison, jusqua, plafond? }
  let menageRefusA = 0;
  function retenir(cle, r, quotaMs) {
    const t = horloge();
    if (t - menageRefusA >= 60_000) {
      menageRefusA = t;
      for (const [k, x] of refus) if (t >= x.jusqua) refus.delete(k);
    }
    if (r.verse) return;
    if (r.raison === 'quota' && quotaMs > 0) {
      refus.set(cle, { raison: 'quota', jusqua: t + quotaMs, plafond: reglage('xp.virage_matchs_jour') });
    } else if (r.raison === 'inconnu' || r.raison === 'schema') {
      refus.set(cle, { raison: r.raison, jusqua: t + GARDE_REFUS_MS });
    }
  }
  function refusRetenu(cle) {
    const x = refus.get(cle);
    if (!x) return null;
    if (horloge() < x.jusqua
        && (x.raison !== 'quota' || x.plafond === reglage('xp.virage_matchs_jour'))) {
      return { verse: false, raison: x.raison };
    }
    refus.delete(cle);
    return null;
  }

  /* **Le versement en vol**, par joueur et par match : dix sockets du même
     joueur, ou son bilan et son départ, n'en ouvrent qu'un. */
  const xpEnVol = new Map();        // `${userId}:${fixtureId}` -> { promesse, ticket }

  /**
   * L'XP du match, une fois : `verser` du grand livre, source `virage`, clé
   * le match.
   *
   * **D'abord ce qui ne coûte pas de transaction** : un refus retenu, un
   * versement déjà en vol, puis, pour le filet du départ — qui ne sait rien
   * de la ligne, quand le bilan l'a déjà lue —, les chants du match, lus par
   * la clé primaire sur le pool, avant le sémaphore et hors de tout verrou.
   * Sous le seuil : `incomplet`, sans connexion ni verrou de bourse.
   *
   * Le recompte se fait ensuite **sous le verrou du joueur, sur la connexion
   * du versement** : les chants du match (clé primaire de la ligne de
   * présence), puis ses versements `virage` du jour de jeu (`verse_a >=
   * CURDATE()`, l'index `k_recompenses_jour`). Il ne lit ni `classe`, ni
   * l'abonnement, ni le club : rien de tout ça ne change l'XP (R9).
   *
   * @param {object} [o]
   * @param {number} [o.chants] des chants que l'appelant a lus sur la ligne :
   *   au seuil ou au-dessus, le filet n'a pas à les relire (les chants ne
   *   font que monter)
   * @param {boolean} [o.filet] un départ, que personne n'attend : il lit
   *   d'abord les chants, et passe après les bilans au sémaphore
   * @returns la forme R6 : `{ verse: true, gain, wallet, niveau }`, ou
   *   `{ verse: false, raison }`, avec `manque` pour `incomplet`
   */
  async function verserXp(userId, fixtureId, { chants = null, filet = false } = {}) {
    const id = String(userId);
    const fid = Number(fixtureId);
    const montant = reglage('xp.virage');
    /* À zéro, l'XP du Virage est éteinte. On ne l'envoie pas au grand livre :
       un gain nul y écrirait une ligne, et le match serait « payé ». */
    if (!(montant > 0)) return { verse: false, raison: 'inactif' };
    const cle = `${id}:${fid}`;
    const retenu = refusRetenu(cle);
    if (retenu) return retenu;
    const vol = xpEnVol.get(cle);
    if (vol) {
      if (!filet) promouvoir(vol.ticket);
      /* Un seul a versé : les autres l'apprennent comme du grand livre. */
      return vol.promesse.then((r) => (r.verse ? { verse: false, raison: 'deja' } : r));
    }
    const ticket = { bilan: !filet, partir: null };
    const promesse = (async () => {
      const seuil = reglage('xp.virage_chants');
      /* Le bilan a déjà lu la ligne (`xpDuBilan`) et ne vient ici qu'au
         seuil ; le filet, lui, n'en sait rien. */
      if (filet && !(chants >= seuil)) {
        let ligne;
        try {
          [[ligne]] = await pool.execute(
            'SELECT chants FROM virage_presence WHERE user_id = ? AND fixture_id = ?', [id, fid]);
        } catch (e) {
          if (!estSchema(e)) throw e;
          dire('xp-chants', '[virage] XP du match sans le compte des chants — appliquer '
            + 'sql/quotidien.sql (npm run schema:appliquer)');
          const r = { verse: false, raison: 'schema' };
          retenir(cle, r);
          return r;
        }
        const n = nombre(ligne?.chants);
        if (n < seuil) return { verse: false, raison: 'incomplet', manque: seuil - n };
      }
      return sousSemaphore(() => auGrandLivre(cle, id, fid, montant), ticket);
    })().finally(() => { if (xpEnVol.get(cle)?.promesse === promesse) xpEnVol.delete(cle); });
    xpEnVol.set(cle, { promesse, ticket });
    return promesse;
  }

  /** Le versement lui-même, sous le sémaphore : le grand livre et son recompte. */
  async function auGrandLivre(cle, id, fid, montant) {
    let manque = null;
    let quotaMs = 0;
    const r = await verser(pool, {
      userId: id, source: 'virage', cle: String(fid), saisonId: null,
      gain: { xp: montant }, niveau: niveauDe(), recharger,
      verifier: async (conn) => {
        /* Le recompte peut être rejoué une fois (une course perdue) : il
           ne fait que lire, et repart de zéro. */
        manque = null;
        quotaMs = 0;
        const seuil = reglage('xp.virage_chants');
        const [[l]] = await conn.execute(
          'SELECT chants FROM virage_presence WHERE user_id = ? AND fixture_id = ?', [id, fid]);
        const chants = nombre(l?.chants);
        if (chants < seuil) {
          manque = seuil - chants;
          return 'incomplet';
        }
        /* Le plafond du jour, et dans la même lecture ce qui reste de ce
           jour **pour la base** : un refus « quota » tient jusque-là, et
           pas plus. Le jour de jeu se calcule en SQL, jamais en JavaScript. */
        const [[jour]] = await conn.execute(
          `SELECT COUNT(*) AS n, TIMESTAMPDIFF(SECOND, NOW(), CURDATE() + INTERVAL 1 DAY) AS reste
             FROM recompenses
            WHERE user_id = ? AND source = 'virage' AND verse_a >= CURDATE()`, [id]);
        if (nombre(jour?.n) >= reglage('xp.virage_matchs_jour')) {
          quotaMs = Math.min(24 * 3600, nombre(jour?.reste)) * 1000;
          return 'quota';
        }
        return true;
      },
    });
    retenir(cle, r, quotaMs);
    return !r.verse && r.raison === 'incomplet' && manque != null ? { ...r, manque } : r;
  }

  /**
   * L'XP telle que le bilan la sert.
   *
   * Deux raccourcis, qui n'appellent pas le grand livre pour ce qu'on sait
   * déjà : ce match est réglé pour ce joueur (versé, ou déjà versé — `regle`,
   * tenu par la salle), ou sa ligne compte moins de chants que le seuil — la
   * réponse serait `incomplet`, et l'on économise un verrou de bourse par
   * joueur au coup de sifflet. Le grand livre reste le seul à verser : le
   * recompte refait tout, sous verrou. Les chants lus passent à `verserXp`,
   * qui n'a pas à les relire.
   */
  async function xpDuBilan(id, fid, chants, regle) {
    if (!(reglage('xp.virage') > 0)) return { verse: false, raison: 'inactif' };
    if (regle?.has(id)) return { verse: false, raison: 'deja' };
    const seuil = reglage('xp.virage_chants');
    if (chants != null && chants < seuil) return { verse: false, raison: 'incomplet', manque: seuil - chants };
    const r = await verserXp(id, fid, { chants });
    if (r.verse || r.raison === 'deja') regle?.add(id);
    return r;
  }

  /* ------------------------------------------------------------ le bilan */

  /**
   * Le bilan d'un joueur, à la forme du § 15.1.
   *
   * @param {object} o
   * @param {boolean} [o.fini]   le match est fini : servi depuis `lireSalle`
   * @param {0|1} [o.side]       le camp de la socket dans la salle, pour un
   *                             joueur sans ligne de présence
   * @param {boolean} [o.xp]     verser l'XP et la servir (vrai par défaut)
   * @param {Set} [o.regle]      ceux dont l'XP de ce match est déjà réglée
   */
  async function bilanDe(userId, fixtureId, { fini = false, side = 0, xp = true, regle = null } = {}) {
    const id = String(userId);
    const fid = Number(fixtureId);
    const sienne = fini ? (await lireSalle(fid)).parJoueur.get(id) ?? null
      : await lireJoueur(id, fid);

    const b = { fixtureId: fid, side: side ? 1 : 0, ...(fini ? { fini: true } : {}) };
    /* Sans ligne de présence — entré, jamais poussé —, il n'y a pas de bilan
       à poser : le match et le camp, rien d'autre (§ 15.1). */
    if (!sienne) return b;

    const { ligne: l, forme: f } = sienne;
    b.side = l.side;
    b.classe = l.classe;
    b.neutre = l.teamId == null;
    b.ferveur = l.ferveur;
    if (f <= 1) b.chants = l.chants;
    if (f === 0) {
      b.parfaits = l.parfaits;
      if (l.serieMax >= 2) b.serie = l.serieMax;
      if (l.meilleurChant) {
        const nom = CHANTS[l.meilleurChant]?.nom;
        b.meilleur = { chant: l.meilleurChant, ...(nom ? { nom } : {}),
          verdict: verdictDe(l.meilleurQ / 1000) };
      }
    }
    b.rang = sienne.rang;
    b.sur = sienne.sur;
    if (sienne.souvenirs.length) b.souvenirs = sienne.souvenirs;
    if (xp) b.xp = await xpDuBilan(id, fid, f <= 1 ? l.chants : null, regle);
    return b;
  }

  /** Ce que le sémaphore tient, pour le banc de charge. */
  const etatXp = () => ({ enCours: enCoursXp, enAttente: filesXp.bilan.length + filesXp.filet.length,
    filets: filesXp.filet.length, max: SEMAPHORE_XP });

  return { lireSalle, bilanDe, verserXp, etatXp };
}
