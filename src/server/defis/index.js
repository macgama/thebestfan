/**
 * Les défis de la semaine : le tirage, la progression et le versement
 * (`src/shared/defis.js` pour les règles, `sql/defis.sql` pour la table).
 *
 * ## La semaine est celle de la base
 *
 * Le lundi se calcule **en SQL** (`CURDATE() - INTERVAL WEEKDAY(CURDATE())
 * DAY`), comme le jour des missions : défis et missions changent au même
 * minuit. Aucun jour n'est fabriqué ici.
 *
 * ## Ce qui fait avancer un défi
 *
 * - **Un duel** (série, tenue, PASS) : le duel doit compter pour les missions
 *   (au moins une minute, pas quitté, de l'XP versée) ; le serveur de duel
 *   appelle `apresDuel` avec les Fanzzy montés en tribune, leur série, leurs
 *   tenues portées et leurs pièces.
 * - **Un chant au Grand Virage** (stuff) : la salle appelle `apresChant` avec
 *   le sac du Fanzzy qui chante. Une écriture de plus par chant, mais
 *   seulement pour qui a un défi de stuff en cours qu'il porte : les défis de
 *   chacun sont gardés en mémoire une minute.
 *
 * Rien n'est jamais attendu par le jeu : une progression qui échoue se dit au
 * journal, elle ne fait échouer ni un duel ni un chant.
 *
 * ## Le PASS
 *
 * Le quatrième défi est celui des membres d'un PASS dont la saison est
 * lancée et a une tenue. Il ne verse que des points de la voie PASS (source
 * `voie`) : jamais d'écharpes, jamais de tampons du carnet.
 */
import express from 'express';
import { reglage } from '../../shared/reglages.js';
import {
  SORTES, SORTE_DU_RANG, titreDefi, tirerDefis, gainDefi, rangsDuDuel, rangsDuChant,
} from '../../shared/defis.js';
import { SETS, BY_ID } from '../../shared/fanzzy/dex.js';
import { STUFF } from '../../shared/fanzzy/inventaire.js';
import { tenueDePass } from '../../shared/pass.js';
import { verser } from '../recompenses.js';
import { saisonEnCours } from '../fanzzy/saisons.js';
import { toutesTenues } from '../fanzzy/tenues.js';
import { racineDe } from '../fanzzy/catalogue.js';

const LUNDI = 'CURDATE() - INTERVAL WEEKDAY(CURDATE()) DAY';
const SEMAINE = /^\d{4}-\d{2}-\d{2}$/;
const NOM_SERIE = new Map(SETS.map((s) => [s.id, s.nom]));
const NOM_STUFF = new Map(STUFF.map((s) => [s.id, s.nom]));

const estSchema = (e) => e?.code === 'ER_NO_SUCH_TABLE' || e?.code === 'ER_BAD_FIELD_ERROR';

/** La série d'un Fanzzy, par sa racine. */
function serieDe(id) {
  let r = id;
  try { r = racineDe(id); } catch { /* catalogue non chargé : l'identifiant tel quel */ }
  return BY_ID.get(r)?.set ?? null;
}

function nomTenue(id) {
  try { return toutesTenues().find((t) => t.id === id)?.nom ?? id; } catch { return id; }
}

/** Le nom de l'objet d'un défi, tel que le catalogue l'écrit. */
export function nomObjet(sorte, objet) {
  if (sorte === 'serie') return NOM_SERIE.get(objet) ?? objet;
  if (sorte === 'stuff') return NOM_STUFF.get(objet) ?? objet;
  return nomTenue(objet);
}

export function createDefis({ pool, requireAuth, abonnement = null, niveau = null }) {
  const q = async (sql, params = []) => (await pool.execute(sql, params))[0];

  let ditSchema = false;
  const direSchema = (e) => {
    if (ditSchema) return;
    ditSchema = true;
    console.error('[defis] table absente, défis de la semaine éteints '
      + `(${e?.sqlMessage ?? e?.message}) : npm run schema:appliquer (sql/defis.sql), puis redémarrer.`);
  };

  /* ------------------------------------------------------------ le tirage */

  async function possessions(userId) {
    const fanzzy = await q(
      'SELECT fanzzy_id FROM user_fanzzy WHERE user_id = ? AND copies >= 1', [userId]);
    const stuff = await q(
      'SELECT stuff_id FROM user_stuff WHERE user_id = ? AND copies >= 1', [userId]).catch(() => []);
    const skins = await q(
      `SELECT DISTINCT skin_id FROM user_skins WHERE user_id = ? AND skin_id <> 'base'`,
      [userId]).catch(() => []);
    return {
      series: fanzzy.map((r) => serieDe(r.fanzzy_id)).filter((s) => s && NOM_SERIE.has(s)),
      stuff: stuff.map((r) => r.stuff_id).filter((id) => NOM_STUFF.has(id)),
      tenues: skins.map((r) => r.skin_id).filter((id) => !tenueDePass(id)),
    };
  }

  /** Le PASS qui court et sa tenue, ou `null`. */
  async function passQuiCourt(userId) {
    if (!abonnement?.voies || !(reglage('defis.points_voie') > 0)) return null;
    let courante = null;
    try { courante = saisonEnCours(); } catch { return null; }
    if (!courante || courante.finie) return null;
    const voies = await abonnement.voies(userId).catch(() => []);
    const v = voies.find((x) => x.tenue && x.lancee && Number(x.saison) === Number(courante.numero));
    return v ? { tenue: v.tenue, saisonId: v.saisonId } : null;
  }

  /**
   * Les défis de la semaine du joueur, tirés s'ils ne le sont pas encore.
   * Rend les lignes de cette semaine et de la précédente.
   */
  async function lignes(userId) {
    const lire = () => q(
      `SELECT DATE_FORMAT(semaine, '%Y-%m-%d') AS semaine, semaine = ${LUNDI} AS courante,
              rang, sorte, objet, cible, fait, echarpes, tampons, points, saison_id
         FROM defis_semaine
        WHERE user_id = ? AND semaine >= ${LUNDI} - INTERVAL 7 DAY
        ORDER BY semaine, rang`, [userId]);
    let l = await lire();
    if (!l.some((x) => Number(x.courante) === 1) && reglage('defis.actif') === true) {
      await tirer(userId);
      l = await lire();
    }
    return l;
  }

  async function tirer(userId) {
    const [{ semaine }] = await q(`SELECT DATE_FORMAT(${LUNDI}, '%Y-%m-%d') AS semaine`);
    let courante = null;
    try { courante = saisonEnCours(); } catch { /* sans saisons */ }
    const saisonId = courante && !courante.finie ? Number(courante.id) : null;
    const [possede, pass] = await Promise.all([possessions(userId), passQuiCourt(userId)]);
    const defis = tirerDefis({ semaine, userId, possede, pass });
    for (const d of defis) {
      const g = gainDefi(d.sorte, { avecSaison: saisonId != null });
      const saison = d.sorte === 'pass' ? pass.saisonId : saisonId;
      await q(
        `INSERT IGNORE INTO defis_semaine
           (user_id, semaine, rang, sorte, objet, cible, echarpes, tampons, points, saison_id)
         VALUES (?, ${LUNDI}, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, d.rang, d.sorte, d.objet, d.cible, g.echarpes, g.tampons, g.points, saison ?? null]);
    }
  }

  /* --------------------------------------------------------- la mémoire

     Les défis en cours de chacun, gardés une minute : un chant au Virage ne
     doit pas relire la table pour savoir qu'il n'a rien à faire avancer. */
  const memoire = new Map();
  const DUREE_MS = 60_000;

  async function enCours(userId) {
    const m = memoire.get(userId);
    if (m && Date.now() - m.t < DUREE_MS) return m.defis;
    const defis = (await lignes(userId)).filter((x) => Number(x.courante) === 1);
    memoire.set(userId, { t: Date.now(), defis });
    if (memoire.size > 5000) memoire.delete(memoire.keys().next().value);
    return defis;
  }

  async function avancer(userId, rangs) {
    if (!rangs.length) return;
    await q(
      `UPDATE defis_semaine SET fait = LEAST(cible, fait + 1)
        WHERE user_id = ? AND semaine = ${LUNDI} AND rang IN (${rangs.map(() => '?').join(', ')})`,
      [userId, ...rangs]);
    const m = memoire.get(userId);
    if (m) for (const d of m.defis) if (rangs.includes(Number(d.rang))) d.fait = Math.min(d.cible, d.fait + 1);
  }

  /**
   * Un duel fini qui compte. `fanzzy` : ceux du joueur montés en tribune,
   * `[{ id, tenues: { 1: 'carnaval' }, stuff: [...] }]`.
   */
  async function apresDuel(userId, fanzzy) {
    if (reglage('defis.actif') !== true || !userId || userId.startsWith('bot:')) return;
    try {
      const joues = (fanzzy ?? []).map((f) => ({
        serie: serieDe(f.id),
        tenues: Object.values(f.tenues ?? {}).filter(Boolean),
        stuff: f.stuff ?? [],
      }));
      await avancer(userId, rangsDuDuel(await enCours(userId), joues));
    } catch (e) {
      if (estSchema(e)) return direSchema(e);
      console.error('[defis] duel non compté :', e.message);
    }
  }

  /** Un chant au Grand Virage, avec le sac du Fanzzy qui chante. */
  async function apresChant(userId, sac) {
    if (reglage('defis.actif') !== true || !userId || !sac?.length) return;
    try {
      await avancer(userId, rangsDuChant(await enCours(userId), sac));
    } catch (e) {
      if (estSchema(e)) return direSchema(e);
      console.error('[defis] chant non compté :', e.message);
    }
  }

  /* ---------------------------------------------------------------- l'état */

  async function etat(userId) {
    if (reglage('defis.actif') !== true) return { actif: false };
    let l;
    try { l = await lignes(userId); } catch (e) {
      if (estSchema(e)) { direSchema(e); return { actif: false }; }
      throw e;
    }
    const [b] = await q(
      `SELECT DATE_FORMAT(${LUNDI}, '%Y-%m-%d') AS semaine,
              UNIX_TIMESTAMP(${LUNDI} + INTERVAL 7 DAY) - UNIX_TIMESTAMP() AS reste`);
    const payes = new Set((await q(
      `SELECT cle FROM recompenses WHERE user_id = ? AND source IN ('hebdo', 'voie')
          AND cle >= DATE_FORMAT(${LUNDI} - INTERVAL 7 DAY, '%Y-%m-%d')`, [userId])
      .catch(() => [])).map((r) => r.cle));
    const vue = (x) => {
      const sorte = x.sorte;
      const etatDe = payes.has(`${x.semaine}:${x.rang}`) ? 'reclamee'
        : Number(x.fait) >= Number(x.cible) ? 'pret' : 'en_cours';
      return {
        semaine: x.semaine, rang: Number(x.rang), sorte, objet: x.objet,
        titre: titreDefi(sorte, Number(x.cible), nomObjet(sorte, x.objet)),
        cible: Number(x.cible), fait: Math.min(Number(x.fait), Number(x.cible)), etat: etatDe,
        unite: SORTES[sorte]?.compte ?? null,
        ou: SORTES[sorte]?.ou ?? null, bouton: SORTES[sorte]?.bouton ?? null,
        pass: sorte === 'pass',
        gain: { echarpes: Number(x.echarpes), tampons: Number(x.tampons), voie: Number(x.points) },
      };
    };
    const liste = l.filter((x) => Number(x.courante) === 1).map(vue);
    const passee = l.filter((x) => Number(x.courante) !== 1).map(vue).filter((x) => x.etat === 'pret');
    return {
      actif: true,
      semaine: b.semaine,
      finSemaineMs: Math.max(0, Math.round(Number(b.reste) * 1000)),
      liste,
      passee,
      aReclamer: [...liste, ...passee].filter((x) => x.etat === 'pret').length,
    };
  }

  /* ------------------------------------------------------------ le versement */

  async function reclamer(userId, { semaine, rang }) {
    if (reglage('defis.actif') !== true) return { verse: false, raison: 'inactif' };
    const [x] = await q(
      `SELECT sorte, cible, fait, echarpes, tampons, points, saison_id,
              semaine >= ${LUNDI} - INTERVAL 7 DAY AS ouverte
         FROM defis_semaine WHERE user_id = ? AND semaine = ? AND rang = ?`,
      [userId, semaine, rang]);
    if (!x) return { verse: false, raison: 'inconnu' };
    const pass = x.sorte === 'pass';
    return verser(pool, {
      userId,
      source: pass ? 'voie' : 'hebdo',
      cle: `${semaine}:${rang}`,
      saisonId: x.saison_id == null ? null : Number(x.saison_id),
      /* Les points de voie dans la colonne `tampons` de la ligne `voie` :
         seule la voie PASS les lit. */
      gain: pass ? { tampons: Number(x.points) }
        : { echarpes: Number(x.echarpes), tampons: Number(x.tampons) },
      niveau,
      verifier: async (conn) => {
        const [[r]] = await conn.execute(
          `SELECT fait >= cible AS fini, semaine >= ${LUNDI} - INTERVAL 7 DAY AS ouverte
             FROM defis_semaine WHERE user_id = ? AND semaine = ? AND rang = ?`,
          [userId, semaine, rang]);
        if (!r) return 'inconnu';
        if (Number(r.ouverte) !== 1) return 'jour_passe';
        return Number(r.fini) === 1 ? true : 'incomplet';
      },
    });
  }

  /* ---------------------------------------------------------------- routes */

  const router = express.Router();
  router.use(express.json({ limit: '2kb' }));

  router.get('/', requireAuth, async (req, res) => {
    try {
      res.set('cache-control', 'no-store');
      res.json(await etat(req.user.id));
    } catch (e) {
      console.error('[defis]', e?.stack ?? e);
      res.status(503).json({ error: 'defis.error.indisponible' });
    }
  });

  router.post('/recuperer', requireAuth, async (req, res) => {
    const { semaine, rang } = req.body ?? {};
    if (typeof semaine !== 'string' || !SEMAINE.test(semaine)
        || !Number.isInteger(rang) || !(rang in SORTE_DU_RANG)) {
      return res.status(400).json({ error: 'defis.error.requete' });
    }
    try {
      let r;
      try { r = await reclamer(req.user.id, { semaine, rang }); } catch (e) {
        if (!estSchema(e)) throw e;
        direSchema(e);
        r = { verse: false, raison: 'schema' };
      }
      /* Ce que l'écran montre du gain : les points de voie sous leur nom. */
      if (r.verse && SORTE_DU_RANG[rang] === 'pass') {
        r = { ...r, gain: { echarpes: 0, packs: 0, xp: 0, tampons: 0, voie: r.gain.tampons } };
      }
      res.json({ ...r, defis: await etat(req.user.id) });
    } catch (e) {
      console.error('[defis]', e?.stack ?? e);
      res.status(503).json({ error: 'defis.error.indisponible' });
    }
  });

  return { router, etat, reclamer, apresDuel, apresChant, lignes, entrer: enCours };
}
