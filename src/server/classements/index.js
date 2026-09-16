import express from 'express';

/**
 * Les classements.
 *
 * Trois échelles, et elles ne récompensent pas la même chose :
 *
 *   — les supporters, sur la ferveur donnée dans le Grand Virage. C'est du
 *     temps et de la justesse, pas de la collection : un joueur qui n'a jamais
 *     ouvert un booster peut être premier.
 *   — les tribunes, c'est-à-dire les clubs classés par la ferveur cumulée de
 *     leurs supporters, ramenée à leur nombre. Sans cette division, le plus
 *     gros club gagnerait toujours et personne ne défendrait le sien.
 *   — les duellistes, sur les duels gagnés, entraînements exclus.
 *
 * Les trois se déclinent aussi **par compétition et par saison**, sur la même
 * ferveur : « qui a le plus donné en Ligue 1 cette année » est une question
 * qu'on peut gagner, là où le classement mondial ne se vise pas. Le Duel y
 * entre au même titre que le Virage — il compte la même ferveur, et il adosse
 * ses parties à un vrai match, donc à une compétition.
 *
 * Tout est calculé par agrégation et mis en cache : un classement n'a pas
 * besoin d'être exact à la seconde, et une requête lourde toutes les cinq
 * minutes vaut mieux que la même à chaque affichage.
 */

const TTL_MS = 5 * 60 * 1000;

export function createClassements({ pool, requireAuth }) {
  const q = async (sql, params = []) => {
    const [rows] = await pool.execute(sql, params);
    return rows;
  };

  const cache = new Map();
  async function memo(cle, fn) {
    const hit = cache.get(cle);
    if (hit && Date.now() < hit.expire) return hit.valeur;
    const valeur = await fn();
    cache.set(cle, { valeur, expire: Date.now() + TTL_MS });
    return valeur;
  }

  /* Uniquement pour les tests : un classement est mémorisé deux minutes, et
     une suite qui écrit des lignes puis relit obtient sinon l'état d'avant —
     un rouge qui ne parle de rien. Même rôle que `oublier` du catalogue. */
  function oublier() { cache.clear(); }

  /** Fenêtre : la saison en cours, ou les trente derniers jours. */
  const depuis = (periode) => (periode === 'mois'
    ? 'AND vp.last_push_at > (NOW(3) - INTERVAL 30 DAY)' : '');

  /* -------------------------------------------------------- supporters */

  async function supporters(periode = 'saison', limite = 50) {
    return memo(`sup:${periode}:${limite}`, () => q(
      `SELECT u.public_id, u.pseudo,
              SUM(vp.ferveur) AS ferveur,
              COUNT(DISTINCT vp.fixture_id) AS matchs,
              (SELECT COUNT(*) FROM user_souvenirs us
                WHERE us.user_id = u.public_id AND us.kind = 'presence') AS vecus,
              (SELECT t.name FROM user_follows f JOIN teams t ON t.id = f.team_id
                WHERE f.user_id = u.public_id ORDER BY f.is_main DESC LIMIT 1) AS club
         FROM virage_presence vp
         JOIN users u ON u.public_id = vp.user_id
        WHERE u.status = 'active' ${depuis(periode)}
        GROUP BY u.public_id, u.pseudo
        ORDER BY ferveur DESC
        LIMIT ${Number(limite) || 50}`));
  }

  /* ----------------------------------------------------------- tribunes */

  /**
   * Les clubs, classés sur la ferveur moyenne par supporter.
   * Un petit club dont trente fidèles chantent juste passe devant un géant
   * dont mille abonnés regardent — c'est exactement ce qu'on veut célébrer.
   */
  async function tribunes(limite = 50) {
    return memo(`trib:${limite}`, () => q(
      `SELECT t.id, t.name, t.logo, t.country,
              COUNT(DISTINCT f.user_id) AS supporters,
              COALESCE(SUM(vp.ferveur), 0) AS ferveur,
              ROUND(COALESCE(SUM(vp.ferveur), 0) / GREATEST(COUNT(DISTINCT f.user_id), 1)) AS moyenne
         FROM user_follows f
         JOIN teams t ON t.id = f.team_id
         LEFT JOIN virage_presence vp ON vp.user_id = f.user_id
         GROUP BY t.id, t.name, t.logo, t.country
        HAVING supporters >= 1
        ORDER BY moyenne DESC, ferveur DESC
        LIMIT ${Number(limite) || 50}`));
  }

  /* -------------------------------------------------------- duellistes */

  async function duellistes(limite = 50) {
    return memo(`duel:${limite}`, () => q(
      `SELECT u.public_id, u.pseudo,
              SUM(dr.outcome = 'win') AS gagnes,
              COUNT(*) AS joues,
              ROUND(100 * SUM(dr.outcome = 'win') / COUNT(*)) AS taux
         FROM duel_results dr
         JOIN users u ON u.public_id = dr.user_id
        WHERE u.status = 'active' AND dr.mode = 'classe'
        GROUP BY u.public_id, u.pseudo
       HAVING joues >= 3
        ORDER BY gagnes DESC, taux DESC
        LIMIT ${Number(limite) || 50}`));
  }

  /* ================================================ par compétition

     Les trois mêmes échelles, mais dans une compétition et une saison : « qui
     a le plus donné en Ligue 1 cette année », et non « qui a le plus donné ».
     C'est ce qui rend un classement atteignable — personne ne vise la tête
     d'un classement mondial, tout le monde vise la tête du sien.

     **Une seule monnaie, deux sources.** Le Grand Virage et le Duel comptent
     tous deux de la ferveur, et le duel adosse ses parties à un vrai match :
     les deux se lisent donc ensemble, et la compétition se déduit du match par
     une jointure. Rien n'est recopié — ni la compétition, ni la saison — parce
     que `fixtures` les porte déjà et que deux endroits qui portent la même
     valeur finissent par se contredire.

     **Le club soutenu décide de ce qui remonte au groupe.** Un neutre — venu
     pousser sur un match dont aucun club n'est le sien — compte pour lui-même
     et pour la compétition, mais sa ligne porte `team_id` nul : elle ne
     remonte ni à une tribune ni à un KOP, dont il n'est pas membre. C'est la
     règle du jeu, et elle est écrite ici en une condition de jointure.

     **L'entraînement ne compte pas.** Il s'écrit désormais — un joueur doit
     retrouver ses soirées dans son parcours — mais il ne rapporte rien à
     personne : c'est toute sa différence avec le duel classé. Le tri se fait
     ici, à la lecture, et non à l'écriture. Écarter ces parties au moment de
     les enregistrer aurait rendu le classement juste et le parcours faux. */

  const SOURCE = `
    SELECT vp.user_id, vp.team_id, vp.ferveur
      FROM virage_presence vp
      JOIN fixtures f ON f.id = vp.fixture_id
     WHERE f.league_id = ? AND f.season = ?
    UNION ALL
    SELECT dr.user_id, dr.team_id, dr.ferveur
      FROM duel_results dr
      JOIN fixtures f ON f.id = dr.fixture_id
     WHERE f.league_id = ? AND f.season = ? AND dr.mode = 'classe'`;

  /**
   * La saison à classer, quand la page n'en demande pas.
   *
   * La page en connaît une — celle que le télétexte a choisie sur les dates de
   * la compétition — et elle la transmet. Ce repli ne sert qu'à répondre
   * quelque chose de sensé à une adresse tapée à la main : la saison la plus
   * récente dont on ait un match. Le refaire ici avec les dates dupliquerait
   * une règle qui vit déjà dans `teletext/seasonOf`.
   */
  async function saisonDe(leagueId) {
    const [r] = await q(
      `SELECT MAX(season) AS s FROM fixtures WHERE league_id = ?`, [leagueId]);
    return r?.s ?? null;
  }

  /** Les joueurs, sur la ferveur donnée dans cette compétition. */
  async function joueursDe(leagueId, saison, limite = 50) {
    return q(
      `SELECT u.public_id, u.pseudo,
              SUM(x.ferveur) AS ferveur,
              COUNT(*) AS seances,
              (SELECT t.name FROM user_follows fo JOIN teams t ON t.id = fo.team_id
                WHERE fo.user_id = u.public_id ORDER BY fo.is_main DESC LIMIT 1) AS club
         FROM (${SOURCE}) x
         JOIN users u ON u.public_id = x.user_id
        WHERE u.status = 'active'
        GROUP BY u.public_id, u.pseudo
       HAVING ferveur > 0
        ORDER BY ferveur DESC
        LIMIT ${Number(limite) || 50}`,
      [leagueId, saison, leagueId, saison]);
  }

  /**
   * Les tribunes, c'est-à-dire les clubs.
   *
   * Divisées par le nombre de leurs supporters, comme le classement général :
   * sans cette division, le plus gros club gagne toujours et personne ne
   * défend le sien. Le diviseur est le nombre de supporters du club, pas le
   * nombre de ceux qui ont joué — mille abonnés qui regardent doivent peser
   * contre trente fidèles qui chantent.
   */
  async function tribunesDe(leagueId, saison, limite = 50) {
    return q(
      `SELECT t.id, t.name, t.logo,
              SUM(x.ferveur) AS ferveur,
              COALESCE(s.n, 0) AS supporters,
              ROUND(SUM(x.ferveur) / GREATEST(COALESCE(s.n, 1), 1)) AS moyenne
         FROM (${SOURCE}) x
         JOIN teams t ON t.id = x.team_id
         LEFT JOIN (SELECT team_id, COUNT(*) AS n FROM user_follows GROUP BY team_id) s
                ON s.team_id = t.id
        GROUP BY t.id, t.name, t.logo, s.n
       HAVING ferveur > 0
        ORDER BY moyenne DESC, ferveur DESC
        LIMIT ${Number(limite) || 50}`,
      [leagueId, saison, leagueId, saison]);
  }

  /**
   * Les KOP.
   *
   * Un KOP est attaché à un club, et il ne marque que ce que ses membres ont
   * donné **pour ce club-là**. Un membre parti pousser ailleurs marque pour
   * lui et pour la compétition ; il ne rapporte rien à son groupe, qui n'y
   * était pas.
   *
   * Divisé par le nombre de membres, pour la même raison que les tribunes. Le
   * pot du KOP n'entre pas dans le calcul : ce classement dit qui a chanté,
   * pas qui a payé, et mêler les deux dans un seul chiffre ne dirait ni l'un
   * ni l'autre.
   */
  async function kopsDe(leagueId, saison, limite = 50) {
    return q(
      `SELECT k.id, k.nom, t.name AS club, t.logo,
              m.n AS membres,
              COALESCE(SUM(p.ferveur), 0) AS ferveur,
              ROUND(COALESCE(SUM(p.ferveur), 0) / GREATEST(m.n, 1)) AS moyenne
         FROM kops k
         JOIN teams t ON t.id = k.team_id
         JOIN (SELECT kop_id, COUNT(*) AS n FROM kop_membres GROUP BY kop_id) m
              ON m.kop_id = k.id
         JOIN kop_membres km ON km.kop_id = k.id
         LEFT JOIN (
               SELECT y.user_id, y.team_id, SUM(y.ferveur) AS ferveur
                 FROM (${SOURCE}) y
                GROUP BY y.user_id, y.team_id
              ) p ON p.user_id = km.user_id AND p.team_id = k.team_id
        GROUP BY k.id, k.nom, t.name, t.logo, m.n
       HAVING ferveur > 0
        ORDER BY moyenne DESC, ferveur DESC
        LIMIT ${Number(limite) || 50}`,
      [leagueId, saison, leagueId, saison]);
  }

  /**
   * Ma place dans cette compétition.
   *
   * Un classement de cinquante n'a d'intérêt que si on y figure ; pour tous
   * les autres, « 312e sur 1 400 » vaut mieux que rien. Calculé à part, et
   * jamais mis en cache : c'est la seule ligne de la page qui parle du lecteur,
   * et une ligne périmée sur soi se remarque tout de suite.
   */
  async function maPlaceDans(userId, leagueId, saison) {
    const [moi] = await q(
      `SELECT COALESCE(SUM(x.ferveur), 0) AS f, COUNT(*) AS seances
         FROM (${SOURCE}) x WHERE x.user_id = ?`,
      [leagueId, saison, leagueId, saison, userId]);

    const [rang] = await q(
      `SELECT COUNT(*) + 1 AS rang FROM (
         SELECT x.user_id, SUM(x.ferveur) AS f FROM (${SOURCE}) x GROUP BY x.user_id
       ) z WHERE z.f > ?`,
      [leagueId, saison, leagueId, saison, Number(moi.f)]);

    const [total] = await q(
      `SELECT COUNT(DISTINCT x.user_id) AS n FROM (${SOURCE}) x WHERE x.ferveur > 0`,
      [leagueId, saison, leagueId, saison]);

    return {
      ferveur: Number(moi.f), seances: Number(moi.seances),
      rang: Number(moi.f) > 0 ? rang.rang : null,
      sur: total.n,
    };
  }

  /** Les trois échelles d'un coup : la page les montre côte à côte. */
  async function competition(leagueId, saison, limite = 50) {
    return memo(`comp:${leagueId}:${saison}:${limite}`, async () => {
      const [joueurs, tribunes2, kops] = await Promise.all([
        joueursDe(leagueId, saison, limite),
        tribunesDe(leagueId, saison, limite),
        kopsDe(leagueId, saison, limite),
      ]);
      return { saison, joueurs, tribunes: tribunes2, kops };
    });
  }

  /* ------------------------------------------------------------- ma place */

  /**
   * Le rang d'un joueur, calculé à part.
   * Le voir dans une liste de cinquante n'a d'intérêt que si on y figure ;
   * pour tous les autres, savoir qu'on est 312e sur 1 400 vaut mieux que rien.
   */
  async function maPlace(userId) {
    const [ferveur] = await q(
      `SELECT COALESCE(SUM(ferveur), 0) AS f, COUNT(DISTINCT fixture_id) AS m
         FROM virage_presence WHERE user_id = ?`, [userId]);

    const [rang] = await q(
      `SELECT COUNT(*) + 1 AS rang FROM (
         SELECT user_id, SUM(ferveur) AS f FROM virage_presence GROUP BY user_id
       ) x WHERE x.f > ?`, [ferveur.f]);

    const [total] = await q(
      `SELECT COUNT(DISTINCT user_id) AS n FROM virage_presence`);

    const [duels] = await q(
      `SELECT SUM(outcome = 'win') AS gagnes, COUNT(*) AS joues
         FROM duel_results WHERE user_id = ? AND mode = 'classe'`, [userId]);

    return {
      ferveur: Number(ferveur.f), matchs: ferveur.m,
      rang: ferveur.f > 0 ? rang.rang : null,
      sur: total.n,
      duels: { gagnes: Number(duels.gagnes ?? 0), joues: Number(duels.joues ?? 0) },
    };
  }

  /* ================================================== le parcours d'un joueur

     « Qu'est-ce que j'ai joué, et qu'est-ce que ça m'a rapporté ? »

     Le jeu savait répondre à tout le monde — les classements — et à personne en
     particulier. Un joueur n'avait aucun moyen de retrouver sa soirée : ni la
     liste de ses parties, ni ce que chacune avait donné, ni même combien il en
     avait joué. Tout était en base depuis le premier jour, et rien ne le
     lisait.

     ## Une monnaie, deux façons de la gagner

     Le Grand Virage et le Duel rapportent la même chose — de la ferveur — et
     c'est ce qui permet de les mettre dans la même liste et de les additionner.
     Ce qui les distingue est la **sorte** de partie : le virage, et les quatre
     sortes de duel (entraînement ou classé, 1v1 ou 2v2). On les compte donc
     séparément et on les totalise ensemble.

     ## Pourquoi deux requêtes et non une vue

     Le décompte parcourt tout le passé ; la liste n'en montre que vingt lignes.
     Les mêmes lignes servent deux questions de tailles très différentes, et une
     seule requête aurait obligé à choisir laquelle des deux faire mal. */

  /**
   * Ce qu'il a joué, par sorte, depuis toujours.
   *
   * `mode` et `format` viennent de `duel_results` (voir `sql/historique.sql`).
   * Le format est nul pour les parties d'avant ces colonnes : on les range sous
   * « duel », sans inventer un format qu'on ne connaît pas.
   */
  async function statsDe(userId) {
    const duels = await q(
      `SELECT mode, format,
              COUNT(*)                   AS joues,
              SUM(outcome = 'win')       AS gagnes,
              SUM(outcome = 'draw')      AS nuls,
              SUM(outcome = 'loss')      AS perdus,
              COALESCE(SUM(ferveur), 0)  AS ferveur,
              COALESCE(SUM(goals_for), 0)     AS pour,
              COALESCE(SUM(goals_against), 0) AS contre
         FROM duel_results
        WHERE user_id = ?
        GROUP BY mode, format`, [userId]);

    const [virage] = await q(
      `SELECT COUNT(*) AS matchs, COALESCE(SUM(ferveur), 0) AS ferveur
         FROM virage_presence WHERE user_id = ?`, [userId]);

    const sortes = duels.map((d) => ({
      jeu: 'duel',
      mode: d.mode,
      format: d.format ?? null,
      joues: Number(d.joues),
      gagnes: Number(d.gagnes), nuls: Number(d.nuls), perdus: Number(d.perdus),
      ferveur: Number(d.ferveur),
      buts: { pour: Number(d.pour), contre: Number(d.contre) },
    }));
    if (Number(virage?.matchs ?? 0) > 0) {
      sortes.push({ jeu: 'virage', mode: null, format: null,
        joues: Number(virage.matchs), ferveur: Number(virage.ferveur) });
    }

    /* Le total ne s'additionne pas à l'écran : une page qui refait la somme la
       referait mal le jour où l'entraînement cesse de compter, ou commence. */
    return {
      sortes,
      total: {
        parties: sortes.reduce((n, s) => n + s.joues, 0),
        ferveur: sortes.reduce((n, s) => n + s.ferveur, 0),
        /* La ferveur **classée** à part : c'est elle seule qui pèse dans les
           classements, et les deux nombres côte à côte disent la règle mieux
           qu'une phrase. */
        ferveurClassee: sortes
          .filter((s) => s.jeu === 'virage' || s.mode === 'classe')
          .reduce((n, s) => n + s.ferveur, 0),
      },
    };
  }

  /**
   * Ses dernières parties, duels et virages mêlés, la plus récente d'abord.
   *
   * `avant` est l'horodatage de la dernière ligne reçue : c'est une pagination
   * par curseur et non par numéro de page. Deux parties peuvent finir pendant
   * qu'on lit, et un `OFFSET` en rendrait une deux fois et en sauterait une
   * autre — exactement sur l'écran où l'on compte ce qu'on a fait.
   *
   * Les deux moitiés sont tirées séparément puis fusionnées : une `UNION` aurait
   * obligé les deux à porter les mêmes colonnes, donc à inventer un `outcome`
   * pour le virage et un `camp` pour le duel.
   */
  async function historiqueDe(userId, { limite = 20, avant = null } = {}) {
    const n = Math.min(50, Math.max(1, Number(limite) || 20));
    const borne = avant ? new Date(avant) : null;
    const filtre = borne && !Number.isNaN(borne.getTime())
      ? borne.toISOString().slice(0, 23).replace('T', ' ') : null;

    const match = `
        LEFT JOIN fixtures f ON f.id = %.fixture_id
        LEFT JOIN teams  h ON h.id = f.home_id
        LEFT JOIN teams  a ON a.id = f.away_id
        LEFT JOIN leagues l ON l.id = f.league_id`;

    const duels = await q(
      `SELECT dr.ended_at AS quand, dr.outcome, dr.goals_for, dr.goals_against,
              dr.ferveur, dr.mode, dr.format, dr.team_id,
              f.id AS fixture_id, f.home_id, f.away_id, l.name AS competition,
              h.name AS domicile, h.logo AS domicile_logo,
              a.name AS exterieur, a.logo AS exterieur_logo
         FROM duel_results dr ${match.split('%').join('dr')}
        WHERE dr.user_id = ? ${filtre ? 'AND dr.ended_at < ?' : ''}
        ORDER BY dr.ended_at DESC
        LIMIT ${n}`, filtre ? [userId, filtre] : [userId]);

    const virages = await q(
      `SELECT vp.joined_at AS quand, vp.ferveur, vp.side, vp.team_id,
              f.id AS fixture_id, f.home_id, f.away_id, l.name AS competition,
              h.name AS domicile, h.logo AS domicile_logo,
              a.name AS exterieur, a.logo AS exterieur_logo
         FROM virage_presence vp ${match.split('%').join('vp')}
        WHERE vp.user_id = ? ${filtre ? 'AND vp.joined_at < ?' : ''}
        ORDER BY vp.joined_at DESC
        LIMIT ${n}`, filtre ? [userId, filtre] : [userId]);

    const ligne = (r, jeu) => ({
      jeu,
      quand: r.quand,
      ferveur: Number(r.ferveur ?? 0),
      mode: r.mode ?? null,
      format: r.format ?? null,
      issue: r.outcome ?? null,
      score: jeu === 'duel'
        ? { pour: Number(r.goals_for ?? 0), contre: Number(r.goals_against ?? 0) } : null,
      /* Le camp du virage se dit en club et non en 0/1 : « tu poussais pour le
         FC Sion » se lit, « side: 0 » se décode. */
      pour: r.team_id
        ? (r.team_id === r.home_id ? r.domicile : r.exterieur)
        : (r.side === 1 ? r.exterieur : r.side === 0 ? r.domicile : null),
      neutre: !r.team_id,
      match: r.fixture_id ? {
        id: r.fixture_id, competition: r.competition ?? null,
        domicile: r.domicile, domicileLogo: r.domicile_logo,
        exterieur: r.exterieur, exterieurLogo: r.exterieur_logo,
      } : null,
    });

    const tout = [...duels.map((r) => ligne(r, 'duel')),
                  ...virages.map((r) => ligne(r, 'virage'))]
      .sort((x, y) => new Date(y.quand) - new Date(x.quand))
      .slice(0, n);

    /* `suite` porte le curseur de la page suivante, et vaut `null` quand il n'y
       a plus rien : c'est à la réponse de le dire, pas à la page de le deviner
       en comparant des longueurs. */
    return { lignes: tout,
             suite: tout.length === n ? tout[tout.length - 1].quand : null };
  }

  /* ---------------------------------------------------------- routes */

  const router = express.Router();
  const safe = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => {
    console.error('[classement]', e.message);
    if (!res.headersSent) res.status(503).json({ error: 'rank.error.unavailable' });
  });

  router.get('/supporters', safe(async (req, res) => {
    res.set('cache-control', 'private, max-age=120');
    res.json({ classement: await supporters(String(req.query.periode ?? 'saison')) });
  }));

  router.get('/tribunes', safe(async (_req, res) => {
    res.set('cache-control', 'private, max-age=120');
    res.json({ classement: await tribunes() });
  }));

  router.get('/duellistes', safe(async (_req, res) => {
    res.set('cache-control', 'private, max-age=120');
    res.json({ classement: await duellistes() });
  }));

  /**
   * Les classements d'une compétition.
   *
   * La saison arrive de la page, qui la tient du télétexte — lequel la choisit
   * sur les dates de la compétition. Une seule règle, un seul endroit.
   *
   * `moi` n'est joint que pour un joueur connecté, et il n'est pas mis en
   * cache : c'est la seule ligne qui parle du lecteur.
   */
  router.get('/competition/:id', safe(async (req, res) => {
    const leagueId = Number(req.params.id);
    if (!Number.isInteger(leagueId) || leagueId <= 0) {
      return res.status(400).json({ error: 'rank.error.unknown_league' });
    }
    const saison = Number(req.query.saison) || await saisonDe(leagueId);
    if (!saison) return res.json({ saison: null, joueurs: [], tribunes: [], kops: [] });

    const c = await competition(leagueId, saison);
    const moi = req.user?.id ? await maPlaceDans(req.user.id, leagueId, saison) : null;
    res.set('cache-control', 'private, max-age=120');
    res.json({ ...c, moi });
  }));

  router.get('/moi', requireAuth, safe(async (req, res) =>
    res.json(await maPlace(req.user.id))));

  /**
   * Le parcours du joueur : ce qu’il a joué, et ce que ça lui a rapporté.
   *
   * Les statistiques et la première page d’historique arrivent ensemble : le
   * profil les montre côte à côte, et deux appels pour un seul écran feraient
   * apparaître la moitié avant l’autre.
   *
   * `avant` demande la suite. Aucun cache : c’est le seul écran où le joueur
   * vient vérifier ce qu’il vient de faire, et deux minutes de retard y
   * ressemblent à une partie perdue.
   */
  router.get('/parcours', requireAuth, safe(async (req, res) => {
    const avant = req.query.avant ? String(req.query.avant) : null;
    const [stats, histoire] = await Promise.all([
      avant ? null : statsDe(req.user.id),
      historiqueDe(req.user.id, { avant, limite: req.query.limite }),
    ]);
    res.set('cache-control', 'no-store');
    res.json({ ...(stats ?? {}), ...histoire });
  }));

  return { router, supporters, tribunes, duellistes, maPlace,
           competition, maPlaceDans, saisonDe, statsDe, historiqueDe, oublier };
}
