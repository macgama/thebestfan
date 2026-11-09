/* =======================================================================
   Les écharpes d'un match TBFO, et la fête qui les annonce.

   Choix de Gaël (7 novembre 2026, fil « Créer la page gaming des équipes ») :
   « Si l'équipe a gagné un match (duel, virage), est-ce qu'on donne un cadeau
   (écharpe) à tous les user qui ont participé à la victoire ? avec une alerte
   pour leur donner envie de continuer ? » — oui, carte « Victoire 20, nul 5,
   Virage +10 ».

   **Qui reçoit.** Chaque joueur qui a poussé une tribune sur un vrai match :
   un duel classé joué pour ce camp avant le coup de sifflet (gagné, nul ou
   perdu : il était dans la tribune), ou le Virage classé avec de la ferveur.
   Un joueur qui aurait poussé les deux camps ne reçoit rien de ce match.

   **Combien.** Selon le score TBFO du match (`championnat.js`) :
   `tbfo.victoire_echarpes` si sa tribune a gagné aux duels,
   `tbfo.nul_echarpes` à égalité (au moins un duel), et
   `tbfo.virage_echarpes` de plus si elle a gagné la corde du Virage. Zéro :
   rien, et pas de fête.

   **Quand.** À la lecture : la fête de la page (`public/tbfo-fete.js`)
   demande `/api/club/victoires`, qui règle d'abord les matchs finis des trois
   derniers jours du joueur, puis rend ce qui a été versé dans ces trois jours.
   Le grand livre (`recompenses`, source `tbfo`, clé = le match) paie une fois
   et une seule ; la page retient ce qu'elle a déjà fêté. Sans schéma.

   **Et les exploits** (Gaël, 8 novembre 2026, `exploits.js`) : le derby de
   la semaine multiplie ces écharpes par `tbfo.derby_coef` ; l'homme du match
   reçoit `tbfo.hdm_echarpes` (source `tbfo-hdm`) ; le champion TBFO d'une
   saison finie gâte chacun de ses supporters de `tbfo.champion_echarpes`
   (source `tbfo-champ`). Tout passe par la même lecture et la même fête.
   ======================================================================= */
import { reglage } from '../../shared/reglages.js';
import { verser } from '../recompenses.js';
import { FINIS, finDuMatch } from './championnat.js';
import { createExploits } from './exploits.js';

/** Les jours qu'on regarde en arrière : un match fini avant n'est plus payé. */
export const JOURS = 3;

const SQL_FINIS = FINIS.map((s) => `'${s}'`).join(',');

/**
 * Les écharpes d'un camp sur un match TBFO lu (`lireMatch`), aux réglages du
 * moment. Pure : la suite l'éprouve sans base.
 */
export function echarpesDe(m, c, coef = 1) {
  if (!m?.fini) return 0;
  const pour = m.score[c], contre = m.score[1 - c];
  let n = 0;
  if (m.duels > 0) {
    if (pour > contre) n += reglage('tbfo.victoire_echarpes');
    else if (pour === contre) n += reglage('tbfo.nul_echarpes');
  }
  if (m.virage && m.virage[c] > m.virage[1 - c]) n += reglage('tbfo.virage_echarpes');
  return n * Math.max(1, Math.round(Number(coef) || 1));
}

/** Les sources du grand livre que la fête montre. */
const SOURCES_FETE = ['tbfo', 'tbfo-hdm', 'tbfo-champ'];

export function createVictoires({ pool, classements, exploits = createExploits({ pool, classements }) }) {
  const q = async (sql, params = []) => (await pool.execute(sql, params))[0];
  const SCHEMA = new Set(['ER_NO_SUCH_TABLE', 'ER_BAD_FIELD_ERROR']);

  /* Les camps poussés par le joueur sur les matchs finis des derniers jours :
     Map match -> Set des camps. */
  async function participations(userId) {
    const recents = `f.status_short IN (${SQL_FINIS})
        AND f.kickoff_at >= UTC_TIMESTAMP() - INTERVAL ${JOURS} DAY`;
    const camps = new Map();
    const noter = (rows) => rows.forEach((r) => {
      if (r.camp == null) return;
      const id = Number(r.fixture_id);
      if (!camps.has(id)) camps.set(id, new Set());
      camps.get(id).add(Number(r.camp));
    });
    noter(await q(
      `SELECT DISTINCT dr.fixture_id,
              COALESCE(dr.side, CASE dr.team_id WHEN f.home_id THEN 0 WHEN f.away_id THEN 1 END) AS camp
         FROM duel_results dr JOIN fixtures f ON f.id = dr.fixture_id
        WHERE dr.user_id = ? AND dr.mode = 'classe' AND ${recents}
          AND dr.ended_at <= ${finDuMatch('f')}`, [userId]));
    try {
      noter(await q(
        `SELECT DISTINCT vp.fixture_id, vp.side AS camp
           FROM virage_presence vp JOIN fixtures f ON f.id = vp.fixture_id
          WHERE vp.user_id = ? AND vp.classe = 1 AND vp.ferveur > 0 AND ${recents}`, [userId]));
    } catch (e) {
      if (!SCHEMA.has(e?.code)) throw e;
    }
    return camps;
  }

  /** Paie ce qui est dû au joueur. Rend le nombre de versements faits. */
  async function regler(userId) {
    if (!reglage('tbfo.actif')) return 0;
    const camps = await participations(userId);
    const ids = [...camps.keys()].filter((id) => camps.get(id).size === 1);
    let n = 0;
    if (ids.length) {
      const deja = new Set((await q(
        `SELECT source, cle FROM recompenses WHERE user_id = ? AND source IN ('tbfo', 'tbfo-hdm')
            AND cle IN (${ids.map(() => '?').join(',')})`, [userId, ...ids.map(String)]))
        .map((r) => `${r.source}:${Number(r.cle)}`));
      const aRegler = ids.filter((id) => !deja.has(`tbfo:${id}`));
      const matchs = aRegler.length ? await classements.scoresTbfo(aRegler) : [];
      for (const m of matchs) {
        const c = [...camps.get(m.id)][0];
        const echarpes = echarpesDe(m, c, await exploits.coefDe(m));
        if (echarpes <= 0) continue;
        const r = await verser(pool, { userId, source: 'tbfo', cle: String(m.id), saisonId: null,
          gain: { echarpes } });
        if (r.verse) n++;
      }
      /* L'homme du match : le titre, et ses écharpes. */
      const bonus = Math.max(0, Math.round(Number(reglage('tbfo.hdm_echarpes')) || 0));
      const hdmARegler = ids.filter((id) => !deja.has(`tbfo-hdm:${id}`));
      const hommes = hdmARegler.length ? await exploits.hommesDuMatch(hdmARegler) : new Map();
      for (const [id, h] of hommes) {
        if (h.userId !== userId) continue;
        const r = await verser(pool, { userId, source: 'tbfo-hdm', cle: String(id), saisonId: null,
          titre: 'Homme du match TBFO', gain: { echarpes: bonus } });
        if (r.verse) n++;
      }
    }
    /* Le champion TBFO d'une saison finie gâte ses supporters. */
    const prime = Math.max(0, Math.round(Number(reglage('tbfo.champion_echarpes')) || 0));
    if (prime > 0) {
      for (const s of await exploits.sacresDe(userId)) {
        const r = await verser(pool, { userId, source: 'tbfo-champ', cle: s.cle, saisonId: null,
          titre: 'Champion TBFO', gain: { echarpes: prime } });
        if (r.verse) n++;
      }
    }
    return n;
  }

  /** Ce que la fête montre : les versements TBFO des derniers jours. */
  async function recentes(userId) {
    const lignes = await q(
      `SELECT r.source, r.cle, r.echarpes, r.verse_a FROM recompenses r
        WHERE r.user_id = ? AND r.source IN (${SOURCES_FETE.map(() => '?').join(',')})
          AND (r.echarpes > 0 OR r.source <> 'tbfo')
          AND r.verse_a >= NOW() - INTERVAL ${JOURS} DAY
        ORDER BY r.verse_a DESC LIMIT 12`, [userId, ...SOURCES_FETE]);
    if (!lignes.length) return [];
    const ids = [...new Set(lignes.filter((l) => l.source !== 'tbfo-champ').map((l) => Number(l.cle))
      .filter((x) => Number.isInteger(x) && x > 0))];
    const camps = ids.length ? await participations(userId) : new Map();
    const parId = new Map((ids.length ? await classements.scoresTbfo(ids) : []).map((m) => [m.id, m]));
    const equipes = new Map((ids.length ? await q(
      `SELECT t.id, t.name, t.logo FROM teams t JOIN fixtures f ON t.id IN (f.home_id, f.away_id)
        WHERE f.id IN (${ids.map(() => '?').join(',')})`, ids) : []).map((t) => [Number(t.id), t]));
    const equipe = (id) => {
      const t = equipes.get(Number(id));
      return { id: Number(id), name: t?.name ?? '', logo: t?.logo ?? null };
    };
    const hommes = lignes.some((l) => l.source === 'tbfo-hdm')
      ? await exploits.hommesDuMatch(ids) : new Map();
    const out = [];
    for (const l of lignes) {
      if (l.source === 'tbfo-champ') {
        const [lg, sa] = String(l.cle).split('-').map(Number);
        const f = await exploits.finDeSaison(lg, sa);
        if (!f?.champion) continue;
        const [ligue] = await q('SELECT name, logo FROM leagues WHERE id = ?', [lg]);
        out.push({ type: 'champion', cle: `champ:${l.cle}`, ligue: { id: lg, name: ligue?.name ?? '',
          logo: ligue?.logo ?? null }, saison: sa, club: f.champion, echarpes: Number(l.echarpes) });
        continue;
      }
      const id = Number(l.cle);
      const m = parId.get(id);
      const set = camps.get(id);
      if (!m || !set || set.size !== 1) continue;
      const c = [...set][0];
      const pour = m.score[c], contre = m.score[1 - c];
      const commun = {
        match: id,
        club: equipe(c === 0 ? m.home : m.away),
        adverse: equipe(c === 0 ? m.away : m.home),
        score: [pour, contre],
        /* Les points du match, de son côté d'abord : ce que la fête montre en
           grand (Gaël, 9 novembre 2026). */
        pts: [m.points[c], m.points[1 - c]],
        echarpes: Number(l.echarpes),
      };
      if (l.source === 'tbfo-hdm') {
        out.push({ type: 'hdm', cle: `hdm:${id}`, ...commun, gagnes: hommes.get(id)?.gagnes ?? null });
        continue;
      }
      const coef = await exploits.coefDe(m);
      out.push({
        type: 'match', cle: String(id), ...commun,
        duels: m.duels,
        virage: m.virage ? [m.virage[c], m.virage[1 - c]] : null,
        issue: m.duels > 0 ? (pour > contre ? 'V' : pour === contre ? 'N' : 'D') : null,
        viragegagne: Boolean(m.virage && m.virage[c] > m.virage[1 - c]),
        points: m.points[c],
        ...(coef > 1 ? { derby: true, coef } : {}),
      });
    }
    return out;
  }

  async function lire(userId) {
    try {
      await regler(userId);
      return { victoires: await recentes(userId) };
    } catch (e) {
      if (SCHEMA.has(e?.code)) return { victoires: [] };
      throw e;
    }
  }

  return { regler, recentes, lire, exploits };
}
