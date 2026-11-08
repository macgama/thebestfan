/* =======================================================================
   Le résumé d'un match TBFO : tout ce qui s'est joué sur un vrai match.

   Demande de Gaël (8 novembre 2026, fil « Créer la page gaming des
   équipes ») : « une page avec un résumé de tout ce qui s'est passé au
   niveau des duels, Virage par match réel ». La page `/tbfo/:id`
   (`public/tbfo.html`) le montre.

   Ce qu'il rend, pour un vrai match :
     — le vrai match (clubs, score, statut) et son score TBFO (`lireMatch`) ;
     — chaque duel classé, dans l'ordre : son format, les joueurs de chaque
       tribune, le score du duel, qui a gagné, et s'il compte au score TBFO
       (joué avant le coup de sifflet, dans le plafond du jour, compte actif :
       les mêmes règles que `championnat.js`) ;
     — le Virage : la corde, les présents de chaque tribune et leur ferveur ;
     — les meneurs de chaque tribune (duels gagnés qui comptent) ;
     — les écharpes de chaque supporter (`victoires.js`).

   Rien n'écrit ; sans schéma.
   ======================================================================= */
import { reglage } from '../../shared/reglages.js';
import { couleursDuClub } from '../kop/index.js';
import { FINIS, finDuMatch, dansLePlafond } from './championnat.js';
import { echarpesDe } from './victoires.js';

const SQL_FINIS = FINIS.map((s) => `'${s}'`).join(',');
const SCHEMA = new Set(['ER_NO_SUCH_TABLE', 'ER_BAD_FIELD_ERROR']);

export function createResume({ pool, classements }) {
  const q = async (sql, params = []) => (await pool.execute(sql, params))[0];
  const facultatif = async (fn, defaut) => {
    try { return await fn(); } catch (e) { if (SCHEMA.has(e?.code)) return defaut; throw e; }
  };

  async function equipe(id) {
    const [t] = await facultatif(() => q(
      'SELECT id, name, logo, color1, color2 FROM teams WHERE id = ?', [id]), null)
      ?? await q('SELECT id, name, logo FROM teams WHERE id = ?', [id]);
    if (!t) return { id: Number(id), name: '', logo: null };
    const couleurs = couleursDuClub(t.color1, t.color2);
    return { id: Number(t.id), name: t.name, logo: t.logo ?? null, ...(couleurs.length ? { couleurs } : {}) };
  }

  async function duels(f) {
    const plafond = Math.max(0, Math.round(Number(reglage('tribune.duels_jour')) || 0));
    const lignes = await q(
      `SELECT dr.duel_id, dr.user_id, u.pseudo, u.status, dr.outcome, dr.format, dr.mode,
              dr.goals_for, dr.goals_against, dr.ended_at,
              COALESCE(dr.side, CASE dr.team_id WHEN f.home_id THEN 0 WHEN f.away_id THEN 1 END) AS camp,
              (f.status_short NOT IN (${SQL_FINIS}) OR dr.ended_at <= ${finDuMatch('f')}) AS avant_fin,
              ${dansLePlafond(plafond)} AS dans_plafond
         FROM duel_results dr
         JOIN fixtures f ON f.id = dr.fixture_id
         LEFT JOIN users u ON u.public_id = dr.user_id
        WHERE dr.fixture_id = ?
        ORDER BY dr.ended_at, dr.duel_id`, [f.id]);
    const parDuel = new Map();
    let entrainements = 0;
    const vusEntr = new Set();
    for (const l of lignes) {
      if (l.mode !== 'classe') {
        if (!vusEntr.has(l.duel_id)) { vusEntr.add(l.duel_id); entrainements++; }
        continue;
      }
      if (!parDuel.has(l.duel_id)) {
        parDuel.set(l.duel_id, { id: l.duel_id, format: l.format ?? null, fin: l.ended_at,
          joueurs: [[], []], buts: [null, null], gagnant: null, nul: false, compte: false, _ok: false });
      }
      const d = parDuel.get(l.duel_id);
      const c = Number(l.camp);
      if (c === 0 || c === 1) {
        d.joueurs[c].push(l.pseudo ?? '?');
        if (d.buts[c] == null) { d.buts[c] = Number(l.goals_for); d.buts[1 - c] = Number(l.goals_against); }
      }
      if (l.outcome === 'win' && (c === 0 || c === 1)) d.gagnant = c;
      if (l.outcome === 'draw') d.nul = true;
      /* Il compte quand une ligne gagnante (ou nulle) passe les règles. */
      if ((l.outcome === 'win' || l.outcome === 'draw') && l.status === 'active'
        && Number(l.avant_fin) && Number(l.dans_plafond)) d.compte = true;
      if (Number(l.avant_fin)) d._ok = true;
    }
    const liste = [...parDuel.values()].map(({ _ok, ...d }) => ({ ...d, apres: !_ok }));
    return { liste, entrainements };
  }

  async function virage(fixtureId) {
    const [corde] = await facultatif(() => q(
      'SELECT buts_dom, buts_ext FROM virage_tribunes WHERE fixture_id = ?', [fixtureId]), []);
    const presents = await facultatif(() => q(
      `SELECT u.pseudo, vp.side, vp.ferveur
         FROM virage_presence vp JOIN users u ON u.public_id = vp.user_id AND u.status = 'active'
        WHERE vp.fixture_id = ? AND vp.classe = 1 AND vp.ferveur > 0
        ORDER BY vp.ferveur DESC`, [fixtureId]), []);
    const camps = [[], []];
    for (const p of presents) {
      const c = Number(p.side);
      if (c === 0 || c === 1) camps[c].push({ pseudo: p.pseudo, ferveur: Number(p.ferveur) });
    }
    return {
      corde: corde ? [Number(corde.buts_dom), Number(corde.buts_ext)] : null,
      presents: camps.map((l) => l.slice(0, 12)),
      total: camps.map((l) => l.length),
      ferveur: camps.map((l) => l.reduce((s, p) => s + p.ferveur, 0)),
    };
  }

  /** Le résumé d'un vrai match, ou `null` s'il est inconnu. */
  async function resume(fixtureId) {
    const id = Number(fixtureId);
    if (!Number.isInteger(id) || id <= 0) return null;
    const [f] = await q(
      `SELECT f.id, f.league_id, f.season, f.home_id, f.away_id, f.home_goals, f.away_goals,
              f.status_short, f.elapsed, f.kickoff_at, l.name AS league_name, l.logo AS league_logo
         FROM fixtures f LEFT JOIN leagues l ON l.id = f.league_id WHERE f.id = ?`, [id]);
    if (!f) return null;
    const [home, away, d, v, scores] = await Promise.all([
      equipe(f.home_id), equipe(f.away_id), duels(f), virage(id), classements.scoresTbfo([id]),
    ]);
    const m = scores.find((x) => x.id === id) ?? null;
    /* Les meneurs : les duels gagnés qui comptent, par joueur et par tribune. */
    const meneurs = [new Map(), new Map()];
    for (const x of d.liste) {
      if (!x.compte || x.gagnant == null) continue;
      for (const p of x.joueurs[x.gagnant]) meneurs[x.gagnant].set(p, (meneurs[x.gagnant].get(p) ?? 0) + 1);
    }
    const fini = FINIS.includes(f.status_short);
    return {
      match: {
        id, saison: Number(f.season), statut: f.status_short, minute: f.elapsed ?? null, coup: f.kickoff_at,
        ligue: f.league_id ? { id: Number(f.league_id), name: f.league_name ?? '', logo: f.league_logo ?? null } : null,
        home, away,
        buts: f.home_goals == null ? null : [Number(f.home_goals), Number(f.away_goals)],
        fini,
      },
      tbfo: m ? { score: m.score, points: m.points, virage: m.virage, duels: m.duels,
        vide: m.vide, fini: m.fini, direct: m.direct } : null,
      duels: d.liste,
      entrainements: d.entrainements,
      virage: v,
      meneurs: meneurs.map((mp) => [...mp].map(([pseudo, gagnes]) => ({ pseudo, gagnes }))
        .sort((a, b) => b.gagnes - a.gagnes || a.pseudo.localeCompare(b.pseudo)).slice(0, 3)),
      echarpes: m && reglage('tbfo.actif') ? [echarpesDe(m, 0), echarpesDe(m, 1)] : [0, 0],
      bareme: {
        victoire: reglage('tbfo.victoire_echarpes'), nul: reglage('tbfo.nul_echarpes'),
        virage: reglage('tbfo.virage_echarpes'),
      },
    };
  }

  return { resume };
}
