/* =======================================================================
   La page d'un club : « Le stade du club ».

   Demande de Gaël du 7 novembre 2026 (fil « Créer la page gaming des
   équipes ») : « une page liée aux équipes avec les informations réelles et
   les informations liées au jeu (nb de fans, nb de Fanzzy liés, duels joués,
   classement, etc.). Il faut que cette page soit très gaming. Il faut que le
   user puisse cliquer sur le nom de l'équipe pour accéder à cette page. »
   Maquette choisie sur carte : « 1 Le stade du club »
   (/mnt/project-files/equipe-gaming/proposition-1-stade.jpg).

   Une seule lecture, `GET /api/club/:id`, pour toute la page : le haut
   (blason, rang TBFO, Fanzzy lié, cri, quatre chiffres, forme, prochain
   match et son score TBFO) et les trois onglets (TRIBUNE, LE VRAI CLUB,
   FANZZY) arrivent ensemble, pour que rien n'apparaisse à moitié.

   Tout se lit dans ce qui existe : suivis, duels, Virage, KOP, matchs. Le
   championnat TBFO est celui de `classements/championnat.js`. Sans schéma.
   ======================================================================= */

import express from 'express';
import { CLUB_DE, criDuClub } from '../../shared/fanzzy/clubs.js';
import { serieDeLigue } from '../../shared/fanzzy/series-ligues.js';
import { bientotDeSerie } from '../fanzzy/serie-bientot.js';
import { parIdentifiant } from '../fanzzy/catalogue.js';
import { couleursDuClub } from '../kop/index.js';
import { habillerJoueurs } from '../fanzzy/avatar.js';
import { lireMatch, tableau } from '../classements/championnat.js';
import { createVictoires } from '../classements/victoires.js';
import { createResume } from '../classements/resume.js';
import { createExploits } from '../classements/exploits.js';

const TTL_MS = 60_000;

/** Les lignées liées d'office à un club (AN1, AN21, AN41 pour Arsenal). */
export function lignéesDuClub(teamId) {
  const id = Number(teamId);
  return [...CLUB_DE].filter(([, club]) => Number(club) === id).map(([f]) => f)
    .sort((a, b) => Number(a.replace(/\D/g, '')) - Number(b.replace(/\D/g, '')));
}

export function createClub({ pool, classements, store = null }) {
  /* Les exploits TBFO (Gaël, 8 novembre 2026) : homme du match, derby,
     alerte, fin de saison. Un seul module pour les écharpes, le résumé et
     les routes, pour qu'ils partagent leur mémoire. */
  const exploits = createExploits({ pool, classements });
  const q = async (sql, params = []) => (await pool.query(sql, params))[0];
  const cache = new Map();
  const memo = (cle, fn) => {
    const hit = cache.get(cle);
    if (hit && Date.now() < hit.expire) return hit.promesse;
    const promesse = Promise.resolve().then(fn);
    cache.set(cle, { promesse, expire: Date.now() + TTL_MS });
    promesse.catch(() => cache.delete(cle));
    return promesse;
  };
  /* Une lecture facultative : si sa table manque (schéma pas encore
     appliqué), la page part sans ce morceau plutôt que de ne pas partir. */
  const facultatif = async (nom, fn, defaut) => {
    try {
      return await fn();
    } catch (e) {
      console.warn(`[club] ${nom} illisible :`, e.message);
      return defaut;
    }
  };

  /* Le club lui-même, ses couleurs quand elles sont extraites. */
  async function equipe(id) {
    let [t] = await facultatif('couleurs', () => q(
      `SELECT id, name, code, country, logo, founded, color1, color2 FROM teams WHERE id = ?`, [id]), null) ?? [];
    if (t === undefined) [t] = await q(`SELECT id, name, code, country, logo, founded FROM teams WHERE id = ?`, [id]);
    if (!t) return null;
    const couleurs = couleursDuClub(t.color1, t.color2);
    return { id: Number(t.id), name: t.name, code: t.code ?? null, country: t.country ?? null,
      logo: t.logo ?? null, founded: t.founded ?? null, ...(couleurs.length ? { couleurs } : {}) };
  }

  /* Ses compétitions : le championnat d'abord (type League), la saison la
     plus récente. */
  async function competitions(id) {
    const l = await facultatif('compétitions', () => q(
      `SELECT l.id, l.name, l.logo, l.type, MAX(tl.season) AS season
         FROM team_leagues tl JOIN leagues l ON l.id = tl.league_id
        WHERE tl.team_id = ? GROUP BY l.id, l.name, l.logo, l.type`, [id]), []);
    /* Sans `team_leagues` (club jamais rafraîchi), les matchs le disent. */
    const vues = l.length ? l : await facultatif('compétitions des matchs', () => q(
      `SELECT l.id, l.name, l.logo, l.type, MAX(f.season) AS season
         FROM fixtures f JOIN leagues l ON l.id = f.league_id
        WHERE f.home_id = ? OR f.away_id = ?
        GROUP BY l.id, l.name, l.logo, l.type`, [id, id]), []);
    return vues.map((x) => ({ id: Number(x.id), name: x.name, logo: x.logo ?? null,
      type: x.type ?? null, saison: x.season == null ? null : Number(x.season) }))
      .sort((a, b) => (a.type === 'League' ? 0 : 1) - (b.type === 'League' ? 0 : 1)
        || (b.saison ?? 0) - (a.saison ?? 0));
  }

  /* Le vrai classement du club dans son championnat. */
  async function classementReel(id, ligue) {
    if (!ligue?.saison) return null;
    const [s] = await facultatif('classement réel', () => q(
      `SELECT \`rank\` AS rang, points, played AS joues, win AS gagnes, draw AS nuls, lose AS perdus,
              goals_for AS pour, goals_against AS contre, form AS forme,
              (SELECT COUNT(*) FROM standings x WHERE x.league_id = s.league_id AND x.season = s.season) AS sur
         FROM standings s WHERE league_id = ? AND season = ? AND team_id = ? LIMIT 1`,
      [ligue.id, ligue.saison, id]), []) ?? [];
    return s ? Object.fromEntries(Object.entries(s).map(([k, v]) =>
      [k, k === 'forme' ? (v ?? null) : Number(v)])) : null;
  }

  /* Les vrais matchs : les derniers, le prochain (ou celui qui se joue). */
  async function matchsReels(id) {
    const sel = `f.id, f.league_id, f.season, f.home_id, f.away_id, f.home_goals, f.away_goals,
                 f.status_short, f.elapsed, f.kickoff_at, f.venue,
                 h.name AS home_name, h.logo AS home_logo, a.name AS away_name, a.logo AS away_logo,
                 l.name AS league_name`;
    const join = `FROM fixtures f JOIN teams h ON h.id = f.home_id JOIN teams a ON a.id = f.away_id
                  LEFT JOIN leagues l ON l.id = f.league_id`;
    const [passes, avenir] = await Promise.all([
      q(`SELECT ${sel} ${join} WHERE (f.home_id = ? OR f.away_id = ?) AND f.status_short IN ('FT','AET','PEN')
          ORDER BY f.kickoff_at DESC LIMIT 5`, [id, id]),
      q(`SELECT ${sel} ${join} WHERE (f.home_id = ? OR f.away_id = ?)
            AND f.status_short NOT IN ('FT','AET','PEN','PST','CANC','ABD','AWD','WO')
            AND f.kickoff_at > (UTC_TIMESTAMP() - INTERVAL 4 HOUR)
          ORDER BY f.kickoff_at ASC LIMIT 3`, [id, id]),
    ]);
    const net = (m) => ({
      id: Number(m.id), league: m.league_id == null ? null : Number(m.league_id), ligue: m.league_name ?? null,
      statut: m.status_short, minute: m.elapsed == null ? null : Number(m.elapsed),
      coup: m.kickoff_at, stade: m.venue ?? null,
      home: { id: Number(m.home_id), name: m.home_name, logo: m.home_logo ?? null },
      away: { id: Number(m.away_id), name: m.away_name, logo: m.away_logo ?? null },
      buts: m.home_goals == null ? null : [Number(m.home_goals), Number(m.away_goals)],
    });
    return { derniers: passes.map(net), prochains: avenir.map(net) };
  }

  /* Le jeu : fans, KOP, Fanzzy liés, et ce que j'en ai. */
  async function fans(id) {
    const [r] = await q(`SELECT COUNT(*) AS n FROM user_follows f
                           JOIN users u ON u.public_id = f.user_id AND u.status = 'active'
                          WHERE f.team_id = ?`, [id]);
    return Number(r?.n ?? 0);
  }
  const kops = (id) => facultatif('KOP', () => q(
    `SELECT k.id, k.nom, COUNT(m.user_id) AS membres
       FROM kops k LEFT JOIN kop_membres m ON m.kop_id = k.id
      WHERE k.team_id = ? GROUP BY k.id, k.nom
      ORDER BY membres DESC, k.nom LIMIT 6`, [id])
    .then((l) => l.map((k) => ({ id: k.id, nom: k.nom, membres: Number(k.membres) }))), []);

  function fanzzyLies(id) {
    return lignéesDuClub(id).map((f) => {
      let fiche = null;
      try { fiche = parIdentifiant(f); } catch { /* catalogue pas chargé */ }
      return { id: f, nom: fiche?.nom ?? fiche?.name ?? null, rarete: fiche?.rarete ?? fiche?.rarity ?? null };
    });
  }
  async function liesAchetes(id) {
    const [r] = await facultatif('Fanzzy liés achetés', () => q(
      `SELECT COUNT(*) AS n FROM user_fanzzy uf JOIN users u ON u.public_id = uf.user_id AND u.status = 'active'
        WHERE uf.club_id = ?`, [id]), []) ?? [];
    return Number(r?.n ?? 0);
  }
  async function moi(userId, id, lignees) {
    if (!userId) return null;
    const [suivi] = await q(`SELECT is_main FROM user_follows WHERE user_id = ? AND team_id = ?`, [userId, id]);
    const possedes = lignees.length ? await q(
      `SELECT fanzzy_id, stage FROM user_fanzzy WHERE user_id = ? AND fanzzy_id IN (?)`,
      [userId, lignees]) : [];
    /* Le Fanzzy choisi par le joueur pousse au milieu du stade (Gaël,
       8 novembre 2026). */
    const habits = await facultatif('mon Fanzzy', () => habillerJoueurs(q, [userId]), null);
    return {
      avatar: habits?.get(userId)?.avatar ?? null,
      suit: Boolean(suivi), principal: Boolean(suivi?.is_main),
      fanzzy: Object.fromEntries(possedes.map((p) => [p.fanzzy_id, Number(p.stage) || 1])),
    };
  }

  /* Le championnat TBFO du club : sa saison (toutes compétitions), son rang
     dans le championnat TBFO de son vrai championnat, sa forme, ses derniers
     matchs TBFO, et le match qui se joue. */
  /* Son rang dans le championnat TBFO d'une compétition, et ses voisins. */
  async function rangDans(id, ligue) {
    if (!ligue?.saison) return null;
    const t = await facultatif('rang TBFO', () => classements.tribunesDe(ligue.id, ligue.saison, 400), []);
    const i = t.findIndex((x) => Number(x.id) === id);
    if (i < 0) return null;
    return { position: t[i].joues > 0 ? i + 1 : null, sur: t.filter((x) => x.joues > 0).length,
      points: t[i].points, ligue: { id: ligue.id, name: ligue.name, logo: ligue.logo ?? null, type: ligue.type ?? null },
      voisins: t.slice(Math.max(0, i - 1), i + 2).map((x, k) => ({
        id: Number(x.id), name: x.name, logo: x.logo ?? null, points: x.points,
        position: Math.max(0, i - 1) + k + 1, joues: x.joues })) };
  }

  async function tbfo(id, ligue, ligues = []) {
    const matchs = await classements.matchsDuClub(id, 'saison');
    const ligne = tableau(matchs).get(id) ?? null;
    /* Toutes ses compétitions (Gaël, 8 novembre 2026) : le championnat
       d'abord, puis les coupes. */
    const autres = ligues.filter((l) => l.id !== ligue?.id);
    const rangs = (await Promise.all([ligue, ...autres].filter(Boolean).map((l) => rangDans(id, l))))
      .filter(Boolean);
    const rang = rangs.find((r) => r.ligue.id === ligue?.id) ?? null;
    const finis = matchs.filter((m) => m.fini).sort((a, b) => new Date(b.coup) - new Date(a.coup));
    return {
      joues: ligne?.joues ?? 0, gagnes: ligne?.gagnes ?? 0, nuls: ligne?.nuls ?? 0,
      perdus: ligne?.perdus ?? 0, points: ligne?.points ?? 0, diff: ligne?.diff ?? 0,
      virages: ligne?.virages ?? 0,
      duels: matchs.reduce((n, m) => n + m.duels, 0),
      duelsGagnes: matchs.reduce((n, m) => n + m.score[m.home === id ? 0 : 1], 0),
      forme: ligne?.forme ?? [],
      derniers: finis.slice(0, 5),
      rang,
      rangs,
    };
  }

  async function fiche(id, userId) {
    const team = await equipe(id);
    if (!team) return null;
    const lignees = lignéesDuClub(id);
    const [ligues, reels, nbFans, lesKops, achetes, meilleurs] = await Promise.all([
      competitions(id), matchsReels(id), fans(id), kops(id), liesAchetes(id),
      facultatif('meilleurs fans', () => classements.supporters('saison', 3,
        { type: 'club', id, nom: team.name }), []),
    ]);
    const ligue = ligues.find((l) => l.type === 'League') ?? ligues[0] ?? null;
    const [jeu, reel, reels2, titres] = await Promise.all([tbfo(id, ligue, ligues), classementReel(id, ligue),
      Promise.all(ligues.map(async (l) => ({ ligue: { id: l.id, name: l.name, logo: l.logo ?? null, type: l.type ?? null },
        classement: await classementReel(id, l) }))),
      facultatif('titres TBFO', () => exploits.titresDuClub(id), [])]);
    /* Le prochain match (ou celui qui se joue) et son score TBFO en direct. */
    const prochain = reels.prochains[0] ?? null;
    const [score] = prochain ? await classements.scoresTbfo([prochain.id]) : [];
    const serie = ligue ? serieDeLigue(ligue.id) : null;
    return {
      team,
      cri: criDuClub(id),
      serie: serie ? { code: serie.code, nom: serie.nom,
        ...(bientotDeSerie(serie.code) ? { bientot: bientotDeSerie(serie.code) } : {}) } : null,
      fans: nbFans,
      fanzzy: { lies: fanzzyLies(id), achetes },
      kops: lesKops,
      meilleursFans: (meilleurs ?? []).slice(0, 3).map((x) => ({
        public_id: x.public_id, pseudo: x.pseudo, ferveur: Number(x.ferveur ?? 0),
        avatar: x.avatar ?? null, niveau: x.niveau ?? null })),
      tbfo: { ...jeu, titres },
      prochain: prochain ? { ...prochain, tbfo: score ?? null } : null,
      vrai: { ligues, ligue, classement: reel, classements: reels2.filter((x) => x.classement),
        derniers: reels.derniers, prochains: reels.prochains },
      _pour: userId ?? null,
    };
  }

  const router = express.Router();
  const victoires = createVictoires({ pool, classements, exploits });

  /* Les écharpes des matchs TBFO gagnés par la tribune qu'on a poussée
     (choix de Gaël, 7 novembre 2026) : réglées à la lecture, fêtées par
     `public/tbfo-fete.js`. */
  router.get('/victoires', async (req, res) => {
    if (!req.user?.id) return res.status(401).json({ error: 'auth.error.unauthenticated' });
    try {
      res.set('cache-control', 'no-store');
      res.json(await victoires.lire(req.user.id));
    } catch (e) {
      console.error('[club] victoires', e);
      res.status(500).json({ error: 'club.error.lecture' });
    }
  });

  /* Le résumé d'un vrai match côté jeu : duels, Virage, meneurs, écharpes
     (Gaël, 8 novembre 2026). La page `/tbfo/:id`. */
  const { resume } = createResume({ pool, classements, exploits });

  const lecture = (nom, fn) => async (req, res) => {
    try { await fn(req, res); } catch (e) {
      console.error(`[club] ${nom}`, e);
      res.status(500).json({ error: 'club.error.lecture' });
    }
  };

  /* Le derby de la semaine (idée 2) : l'accueil et la page des matchs. */
  router.get('/derby', lecture('derby', async (_req, res) => {
    res.set('cache-control', 'public, max-age=30');
    res.json(await exploits.derbyDeLaSemaine());
  }));

  /* « Ton club perd au TBFO » (idée 3) : `public/tbfo-alerte.js`. */
  router.get('/alertes', lecture('alertes', async (req, res) => {
    if (!req.user?.id) return res.status(401).json({ error: 'auth.error.unauthenticated' });
    res.set('cache-control', 'no-store');
    res.json({ alertes: await exploits.alertes(req.user.id) });
  }));

  /* La fin de saison TBFO d'un championnat (idée 4) : la course au titre,
     ou son champion. `?saison=` ; sans, la plus récente connue. */
  router.get('/fin/:ligue', lecture('fin de saison', async (req, res) => {
    const lg = Number(req.params.ligue);
    if (!Number.isInteger(lg) || lg <= 0) return res.status(400).json({ error: 'club.error.ligue' });
    let sa = Number(req.query.saison);
    if (!Number.isInteger(sa) || sa <= 0) {
      const [r] = await q('SELECT MAX(season) AS s FROM fixtures WHERE league_id = ?', [lg]);
      sa = Number(r?.s) || 0;
    }
    res.set('cache-control', 'public, max-age=120');
    res.json({ fin: sa ? await exploits.finDeSaison(lg, sa) : null });
  }));
  const resumes = new Map();
  router.get('/match/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'club.error.match' });
    try {
      const hit = resumes.get(id);
      let r;
      if (hit && Date.now() < hit.expire) r = await hit.promesse;
      else {
        const promesse = resume(id);
        resumes.set(id, { promesse, expire: Date.now() + 15_000 });
        if (resumes.size > 300) resumes.delete(resumes.keys().next().value);
        r = await promesse.catch((e) => { resumes.delete(id); throw e; });
      }
      if (!r) return res.status(404).json({ error: 'club.error.match' });
      res.set('cache-control', 'public, max-age=15');
      res.json(r);
    } catch (e) {
      console.error('[club] résumé', e);
      res.status(500).json({ error: 'club.error.lecture' });
    }
  });

  router.get('/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'club.error.inconnu' });
    try {
      const commun = await memo(`club:${id}`, () => fiche(id, null));
      if (!commun) return res.status(404).json({ error: 'club.error.inconnu' });
      const { _pour, ...corps } = commun;
      const toi = await moi(req.user?.id, id, corps.fanzzy.lies.map((f) => f.id));
      res.set('cache-control', 'private, max-age=30');
      res.json({ ...corps, moi: toi });
    } catch (e) {
      console.error('[club]', e);
      res.status(500).json({ error: 'club.error.lecture' });
    }
  });

  return { router, fiche, victoires, exploits, oublier: () => { cache.clear(); exploits.oublier(); } };
}

export { lireMatch };
