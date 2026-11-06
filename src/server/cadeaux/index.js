import express from 'express';
import { parIdentifiant } from '../fanzzy/catalogue.js';
import { tenuePar } from '../fanzzy/tenues.js';
import { STUFF_BY_ID } from '../../shared/fanzzy/inventaire.js';
import { DISTINCTION_PAR_ID, FANZZY_FONDATEUR } from '../../shared/distinctions.js';
import { passDe } from '../../shared/pass.js';

/**
 * Les cadeaux de l'administration, annoncés au joueur.
 *
 * Demande de Gaël du 6 novembre 2026 : « Lorsque l'Admin offre qqch depuis la
 * zone Admin, il faudrait une alerte chez le USER pour qu'il sache qu'il a
 * gagné qqch. Une alerte gaming qui donne envie et pour que le USER se dise
 * qu'il est chanceux d'avoir obtenu qqch. »
 *
 * ## Rien de neuf à écrire au moment du don
 *
 * Tout don de `/admin › JOUEURS` passe déjà par `admin_audit` (« toute
 * écriture passe par ici, sans exception ») : qui, sur qui, quoi. **Le journal
 * est la liste des cadeaux.** Ce module ne fait que le relire pour un joueur,
 * dans l'ordre, et le traduire en choses à montrer :
 *
 *   — `joueur.modifie` : les écharpes et les boosters **ajoutés** (un retrait,
 *     un statut, un rôle ne sont pas des cadeaux) ;
 *   — `joueur.offert` : un Fanzzy, une tenue, une carte Ultimate, une pièce ;
 *   — `pass.accorder` : le PASS d'une saison ;
 *   — `abonnement.accorder` : l'ancien abonnement, s'il sert encore ;
 *   — `fondateur.offert` : le badge Fondateur (et son Fanzzy TheBestFan, que
 *     le journal porte aussi en `joueur.offert` : il n'est dit qu'une fois).
 *
 * Un geste d'administration ajouté plus tard n'apparaît pas tout seul : il
 * faut l'ajouter à `lire()`, exprès — un journal qui dirait au joueur « on a
 * changé ton rôle » serait une fuite, pas une fête.
 *
 * ## Vu jusqu'où
 *
 * La seule mémoire est **le dernier numéro de journal vu** : `user_wallet.
 * cadeau_vu` (`sql/cadeaux.sql`), une colonne, nulle tant que le joueur n'a
 * rien vu. Sans elle (fichier pas encore appliqué), la page envoie le numéro
 * qu'elle a retenu sur l'appareil (`?depuis=`) : la fête marche, au prix d'un
 * cadeau qui peut se refêter une fois sur un autre téléphone. On ne regarde
 * jamais plus de trente jours en arrière : un cadeau d'il y a deux mois, fêté
 * à la première visite après la mise en ligne, serait une surprise sans
 * raison.
 *
 * Aucune donnée de l'admin ne sort d'ici : ni qui a donné, ni l'adresse, ni
 * le journal brut. Seulement ce que le joueur a reçu.
 */

const JOURS = 30;
const ACTIONS = ['joueur.modifie', 'joueur.offert', 'pass.accorder', 'abonnement.accorder',
  'fondateur.offert'];

const json = (v) => {
  if (v == null) return null;
  if (typeof v === 'object') return v;
  try { return JSON.parse(v); } catch { return null; }
};
const entier = (x) => (Number.isInteger(Number(x)) ? Number(x) : 0);
const colonneAbsente = (e) => e?.code === 'ER_BAD_FIELD_ERROR' || e?.code === 'ER_NO_SUCH_TABLE';

/**
 * Les lignes du journal, rendues en cadeaux. Les écharpes et les boosters de
 * plusieurs dons se somment : « +200 ÉCHARPES » se lit mieux que deux fois
 * « +100 ». Le reste garde son ordre.
 */
export function cadeauxDe(lignes) {
  const out = [];
  let echarpes = 0;
  let boosters = 0;
  const fondateur = lignes.some((l) => l.action === 'fondateur.offert');
  const dejaFanzzy = new Set();
  for (const l of lignes) {
    const d = json(l.detail) ?? {};
    if (l.action === 'joueur.modifie') {
      if (entier(d.scarves) > 0) echarpes += entier(d.scarves);
      if (entier(d.packs) > 0) boosters += entier(d.packs);
    } else if (l.action === 'joueur.offert') {
      if (d.sorte === 'fanzzy') {
        if (fondateur && d.fanzzy === FANZZY_FONDATEUR) continue;
        if (dejaFanzzy.has(d.fanzzy)) continue;
        dejaFanzzy.add(d.fanzzy);
        const f = parIdentifiant(String(d.fanzzy ?? ''));
        out.push({ sorte: 'fanzzy', fanzzy: d.fanzzy, nom: f?.nom ?? d.fanzzy,
          rar: f?.rar ?? null, set: f?.set ?? null });
      } else if (d.sorte === 'skin') {
        const f = parIdentifiant(String(d.fanzzy ?? ''));
        out.push({ sorte: 'skin', fanzzy: d.fanzzy, nomFanzzy: f?.nom ?? d.fanzzy,
          age: entier(d.age) || 1, skin: d.skin, nom: tenuePar(String(d.skin ?? ''))?.nom ?? d.skin });
      } else if (d.sorte === 'ultime') {
        const f = parIdentifiant(String(d.fanzzy ?? ''));
        out.push({ sorte: 'ultime', fanzzy: d.fanzzy, nomFanzzy: f?.nom ?? d.fanzzy,
          age: entier(d.age) || 1 });
      } else if (d.sorte === 'stuff') {
        out.push({ sorte: 'stuff', stuff: d.stuff,
          nom: STUFF_BY_ID.get(String(d.stuff ?? ''))?.nom ?? d.stuff });
      }
    } else if (l.action === 'pass.accorder') {
      const saison = entier(d.saison);
      if (saison < 1) continue;
      const p = passDe(saison);
      out.push({ sorte: 'pass', saison, nom: p.nom, couleur: p.couleur });
    } else if (l.action === 'abonnement.accorder') {
      out.push({ sorte: 'abonnement', formule: d.formule ?? 'offert',
        jours: d.jours == null ? null : entier(d.jours) });
    } else if (l.action === 'fondateur.offert') {
      const b = DISTINCTION_PAR_ID.get('fondateur');
      if (d.badge !== false) {
        out.push({ sorte: 'distinction', distinction: 'fondateur', nom: b?.nom ?? 'Fondateur',
          texte: b?.texte ?? null });
      }
      if (d.fanzzy && !dejaFanzzy.has(FANZZY_FONDATEUR)) {
        dejaFanzzy.add(FANZZY_FONDATEUR);
        const f = parIdentifiant(FANZZY_FONDATEUR);
        out.push({ sorte: 'fanzzy', fanzzy: FANZZY_FONDATEUR, nom: f?.nom ?? 'TheBestFan',
          rar: f?.rar ?? null, set: f?.set ?? null });
      }
    }
  }
  /* Les monnaies d'abord : ce sont elles que la fête fait compter. */
  if (boosters) out.unshift({ sorte: 'boosters', n: boosters });
  if (echarpes) out.unshift({ sorte: 'echarpes', n: echarpes });
  return out;
}

export function createCadeaux({ pool, requireAuth }) {
  const q = async (sql, params = []) => {
    const [rows] = await pool.query(sql, params);
    return rows;
  };

  /** Le dernier numéro vu, retenu au compte ; `undefined` sans la colonne. */
  async function vuAuCompte(userId) {
    try {
      const [r] = await q(`SELECT cadeau_vu FROM user_wallet WHERE user_id = ?`, [userId]);
      return r?.cadeau_vu == null ? null : Number(r.cadeau_vu);
    } catch (e) {
      if (colonneAbsente(e)) return undefined;
      throw e;
    }
  }

  /**
   * Les cadeaux pas encore vus. `depuis` : le numéro que l'appareil a retenu
   * (le plus grand des deux l'emporte). Rend `{ cadeaux, jusqua }` :
   * `jusqua` est le numéro à renvoyer une fois la fête refermée.
   */
  async function lire(userId, depuis = 0) {
    const auCompte = await vuAuCompte(userId);
    const vu = Math.max(Number(auCompte) || 0, Number(depuis) || 0);
    const lignes = await q(
      `SELECT id, action, detail FROM admin_audit
        WHERE cible = ? AND id > ? AND au >= NOW(3) - INTERVAL ${JOURS} DAY
          AND action IN (${ACTIONS.map(() => '?').join(',')})
        ORDER BY id LIMIT 60`, [userId, vu, ...ACTIONS]);
    if (!lignes.length) return { cadeaux: [], jusqua: vu, memoire: auCompte === undefined ? 'appareil' : 'compte' };
    const jusqua = Math.max(...lignes.map((l) => Number(l.id)));
    const cadeaux = cadeauxDe(lignes);
    /* Des lignes sans rien à fêter (un retrait d'écharpes, un statut) : on
       les marque vues tout de suite, pour ne pas les relire à chaque page. */
    if (!cadeaux.length) await marquerVu(userId, jusqua);
    return { cadeaux, jusqua, memoire: auCompte === undefined ? 'appareil' : 'compte' };
  }

  /** Retient le numéro vu, sans jamais reculer. */
  async function marquerVu(userId, jusqua) {
    const n = Number(jusqua);
    if (!Number.isSafeInteger(n) || n < 1) return false;
    try {
      await q(`UPDATE user_wallet SET cadeau_vu = GREATEST(COALESCE(cadeau_vu, 0), ?)
                WHERE user_id = ?`, [n, userId]);
      return true;
    } catch (e) {
      if (colonneAbsente(e)) return false;
      throw e;
    }
  }

  const router = express.Router();
  router.get('/', requireAuth, async (req, res) => {
    try {
      res.json(await lire(req.user.id, Number(req.query.depuis) || 0));
    } catch (e) {
      console.error('[cadeaux] lecture', e.message);
      res.status(500).json({ error: 'app.error.server' });
    }
  });
  router.post('/vu', requireAuth, async (req, res) => {
    try {
      res.json({ ok: true, retenu: await marquerVu(req.user.id, req.body?.jusqua) });
    } catch (e) {
      console.error('[cadeaux] vu', e.message);
      res.status(500).json({ error: 'app.error.server' });
    }
  });

  return { router, lire, marquerVu };
}
