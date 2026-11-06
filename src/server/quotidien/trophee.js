/**
 * Le trophée du carnet : le Fanzzy CARNET PLEIN de la saison
 * (`shared/fanzzy/dex-carnet-plein.js`), à qui atteint son dernier palier.
 *
 * Demande de Gaël du 6 novembre 2026, pour tous, avec ou sans PASS. Le
 * versement du dernier palier en est la preuve : la ligne `carnet` du grand
 * livre (`S<saison>:<dernier n>`) ne s'écrit qu'une fois les tampons comptés
 * sous verrou (`versementCarnet`). On lit donc le grand livre, jamais un
 * compteur à part : rien de neuf en base.
 *
 * - Une saison sans trophée (la BASE, une saison sans Fanzzy à elle) ne donne
 *   rien.
 * - **Une fois**, et pour toujours : la carte possédée est la seule trace, un
 *   second passage ne fait pas de double.
 * - Éteint par `pass.trophee_actif` : plus personne ne le reçoit ici ; ceux
 *   qui l'ont le gardent.
 * - Après la saison, un palier encore à réclamer reste réclamable : ses
 *   tampons ont été faits pendant la saison, le trophée suit donc. Un carnet
 *   qui n'était pas plein à la fin ne se remplit plus : il ne se gagne plus.
 */
import { reglage } from '../../shared/reglages.js';
import { carnetDe } from '../../shared/saison.js';
import { tropheeDuPass } from '../../shared/pass.js';

const SCHEMA = new Set(['ER_NO_SUCH_TABLE', 'ER_BAD_FIELD_ERROR']);

export function createTrophee({ q, lesSaisons }) {
  /** Les saisons lancées qui ont un trophée, avec la clé de leur dernier palier. */
  function aGagner() {
    const out = [];
    for (const s of lesSaisons().lancees) {
      const t = tropheeDuPass(s.numero);
      if (!t || Number(s.numero) < 1) continue;
      const paliers = carnetDe(s);
      if (!paliers.length) continue;
      out.push({ saison: s, trophee: t, cle: `S${Number(s.id)}:${paliers.at(-1).n}` });
    }
    return out;
  }

  /**
   * Donne les trophées que le grand livre doit à ce joueur et rend ceux qui
   * sont neufs : `[{ fanzzy, nom, saison }]`. Ne lève jamais pour un schéma
   * absent : un versement réussi ne doit pas échouer pour un cadeau.
   */
  async function verifier(userId) {
    if (reglage('pass.trophee_actif') !== true) return [];
    const liste = aGagner();
    if (!liste.length) return [];
    try {
      const cles = liste.map((x) => x.cle);
      const faits = new Set((await q(
        `SELECT cle FROM recompenses WHERE user_id = ? AND source = 'carnet'
            AND cle IN (${cles.map(() => '?').join(', ')})`, [userId, ...cles])).map((r) => r.cle));
      const dus = liste.filter((x) => faits.has(x.cle));
      if (!dus.length) return [];
      const ids = dus.map((x) => x.trophee.fanzzy);
      const ont = new Set((await q(
        `SELECT fanzzy_id FROM user_fanzzy WHERE user_id = ?
            AND fanzzy_id IN (${ids.map(() => '?').join(', ')})`, [userId, ...ids]))
        .map((r) => r.fanzzy_id));
      const neufs = [];
      for (const d of dus) {
        const id = d.trophee.fanzzy;
        if (ont.has(id)) continue;
        const r = await q(
          `INSERT IGNORE INTO user_fanzzy (user_id, fanzzy_id, copies) VALUES (?, ?, 1)`, [userId, id]);
        if (!Number(r?.affectedRows)) continue;
        await q(`INSERT IGNORE INTO user_skins (user_id, fanzzy_id, stage, skin_id, equipped)
                 VALUES (?, ?, 1, 'base', 1)`, [userId, id]).catch(tolerer);
        await q(`INSERT INTO user_nouveautes (user_id, cle, sorte) VALUES (?, ?, 'fanzzy')
                 ON DUPLICATE KEY UPDATE got_at = got_at`, [userId, `fanzzy:${id}`]).catch(tolerer);
        neufs.push({ fanzzy: id, nom: d.trophee.nom, saison: Number(d.saison.numero) });
        cache.delete(id);
      }
      return neufs;
    } catch (e) {
      if (SCHEMA.has(e?.code)) return [];
      throw e;
    }
  }

  /**
   * Ce que le carnet d'une saison montre de son trophée : `null` sans.
   * `dejaVerses` : les clés `carnet` que le grand livre a déjà versées, lues
   * par l'état du quotidien. Le hub lit cet état à chaque arrivée (budget de
   * `GET /api/quotidien`) : on n'ajoute donc aucune requête par lecture, le
   * dernier palier versé dit déjà que le trophée est gagné.
   */
  async function pourLeCarnet(saison, dejaVerses) {
    const t = tropheeDuPass(saison?.numero);
    if (!t || Number(saison.numero) < 1) return null;
    const paliers = carnetDe(saison);
    const gagne = paliers.length > 0 && dejaVerses.has(`S${Number(saison.id)}:${paliers.at(-1).n}`);
    return { fanzzy: t.fanzzy, nom: t.nom, gagne, actif: reglage('pass.trophee_actif') === true,
      gagnants: await gagnants(t.fanzzy) };
  }

  /* Le nombre de gagnants, gardé dix minutes : le hub lit le carnet à chaque
     arrivée, le compte n'a pas à être à la seconde. */
  const cache = new Map();
  async function gagnants(fanzzyId) {
    const c = cache.get(fanzzyId);
    if (c && Date.now() - c.a < 600_000) return c.n;
    let n = 0;
    try {
      n = Number((await q(`SELECT COUNT(*) AS n FROM user_fanzzy WHERE fanzzy_id = ?`,
        [fanzzyId]))[0]?.n ?? 0);
    } catch (e) {
      if (!SCHEMA.has(e?.code)) throw e;
    }
    cache.set(fanzzyId, { a: Date.now(), n });
    return n;
  }

  return { verifier, pourLeCarnet, gagnants, oublier: () => cache.clear() };
}

function tolerer(e) {
  if (!SCHEMA.has(e?.code)) throw e;
}
