/* =======================================================================
   Le championnat TBFO : un vrai match, un match TBFO.

   **Le barème de Gaël** (7 novembre 2026, fil « Créer la page gaming des
   équipes », adopté sur carte avec les cinq réglages proposés) :

     — chaque vrai match est aussi un **match TBFO** entre ses deux clubs.
       Son score, ce sont les **duels classés gagnés** par chaque tribune sur
       ce match : le club qui en gagne le plus marque 3 points, autant 1, moins
       0 ;
     — le **Virage** gagné (la corde, `virage_tribunes`) donne **+2** à son
       club. Un club peut perdre aux duels et gagner le Virage : 2 points.
       Virage nul : pas de bonus ;
     — **un duel compte 1**, quel que soit son format : un 5v5 ne pèse pas cinq
       fois un 1v1 (réglage 1) ;
     — un match **sans aucun duel ni Virage ne compte pas** : sinon chaque
       0–0 que personne n'a joué rapportait 1 point à deux clubs (réglage 2) ;
     — le score se **fige à la fin du vrai match** : un duel joué sur un match
       déjà fini, après le coup de sifflet, ne change plus rien (réglage 3) ;
     — seuls les `tribune.duels_jour` premiers duels classés du jour d'un
       joueur comptent (réglage 4) : un duel compte quand l'un de ses
       vainqueurs est encore dans les siens — un abonné qui joue toute la
       nuit ne fait pas gagner son club seul ;
     — **un neutre compte en entier** (réglage 5) : il tient la tribune d'en
       face, et sans lui beaucoup de duels n'auraient pas lieu. Le club d'un
       duel est celui de son camp (`side`), plus celui que suit le joueur.

   Il remplace le championnat d'avant (3/1/0 **par duel et par joueur**,
   divisé par les joueurs du club, plancher 5) : juste, mais personne ne le
   lisait, et aucun match ne pouvait montrer un score.

   **Les heures.** `kickoff_at` est en UTC (le pilote de l'API l'écrit ainsi),
   `ended_at` à l'heure murale de la base (`NOW(3)`). L'écart du moment
   (`DECALAGE`) les ramène l'une à l'autre ; au changement d'heure, une heure
   d'écart au plus, sur la seule fin d'un match.

   Rien ici n'écrit : tout se lit dans `duel_results`, `virage_tribunes`,
   `virage_presence` et `fixtures`. Sans schéma.
   ======================================================================= */

export const BAREME = Object.freeze({ victoire: 3, nul: 1, defaite: 0, virage: 2 });

/** Les statuts d'un vrai match fini, et ceux d'un match qui se joue. */
export const FINIS = Object.freeze(['FT', 'AET', 'PEN']);
export const EN_COURS_DE_JEU = Object.freeze(['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE', 'INT', 'SUSP']);

/* Ce qu'un vrai match dure, coup d'envoi compris jusqu'au coup de sifflet :
   90 minutes, la mi-temps, le temps additionnel, et de la marge. Avec
   prolongations (et tirs au but), quarante de plus. */
export const DUREE_MATCH_MIN = Object.freeze({ normal: 130, prolongations: 170 });

const DECALAGE = 'TIMESTAMPDIFF(MINUTE, UTC_TIMESTAMP(), NOW())';
const liste = (t) => t.map((s) => `'${s}'`).join(',');
const SQL_FINIS = liste(FINIS);

/** Le coup d'envoi d'un match à l'heure de la base (alias `f` par défaut). */
export const coupEnvoiLocal = (f = 'f') => `(${f}.kickoff_at + INTERVAL ${DECALAGE} MINUTE)`;

/* La fin d'un match fini, à l'heure de la base. */
const finDuMatch = (f) => `(${coupEnvoiLocal(f)} + INTERVAL (CASE WHEN ${f}.status_short = 'FT'
    THEN ${DUREE_MATCH_MIN.normal} ELSE ${DUREE_MATCH_MIN.prolongations} END) MINUTE)`;

/* Le plafond du jour (réglage 4) : la ligne `dr` est-elle parmi les `n`
   premiers duels classés du jour de son joueur ? Zéro désarme. */
const dansLePlafond = (n) => (n > 0
  ? `(SELECT COUNT(*) FROM duel_results dj
       WHERE dj.user_id = dr.user_id AND dj.mode = 'classe'
         AND dj.ended_at >= DATE(dr.ended_at)
         AND (dj.ended_at < dr.ended_at
              OR (dj.ended_at = dr.ended_at AND dj.duel_id < dr.duel_id))) < ${Math.round(n)}`
  : '1 = 1');

/**
 * Les duels qui comptent, par match : `dom` et `ext`, les duels gagnés par
 * chaque tribune, et `duels`, tous ceux qui comptent (nuls compris).
 *
 * `filtre` est une condition SQL sur le match `f`, écrite avec des nombres
 * déjà vérifiés : elle ne porte aucun paramètre.
 */
const DUELS_PAR_MATCH = (filtre, plafond) => `
  SELECT y.fixture_id, SUM(y.camp = 0) AS dom, SUM(y.camp = 1) AS ext, COUNT(*) AS duels
    FROM (SELECT x.fixture_id, x.duel_id, MAX(x.camp) AS camp
            FROM (SELECT dr.fixture_id, dr.duel_id,
                         CASE WHEN dr.outcome = 'win' THEN COALESCE(dr.side,
                           CASE dr.team_id WHEN f.home_id THEN 0 WHEN f.away_id THEN 1 END)
                         END AS camp,
                         dr.outcome
                    FROM duel_results dr
                    JOIN fixtures f ON f.id = dr.fixture_id
                    JOIN users u ON u.public_id = dr.user_id AND u.status = 'active'
                   WHERE dr.mode = 'classe' AND dr.outcome IN ('win', 'draw')
                     AND (f.status_short NOT IN (${SQL_FINIS}) OR dr.ended_at <= ${finDuMatch('f')})
                     AND ${dansLePlafond(plafond)}
                     AND (${filtre})) x
           WHERE x.camp IN (0, 1) OR x.outcome = 'draw'
           GROUP BY x.fixture_id, x.duel_id) y
   GROUP BY y.fixture_id`;

/* Le Virage d'un match, quand il a été joué en classé : la corde. */
const VIRAGE_PAR_MATCH = (filtre) => `
  SELECT vt.fixture_id, vt.buts_dom, vt.buts_ext
    FROM virage_tribunes vt
    JOIN fixtures f ON f.id = vt.fixture_id
   WHERE (${filtre})
     AND EXISTS (SELECT 1 FROM virage_presence vp
                   JOIN users u ON u.public_id = vp.user_id AND u.status = 'active'
                  WHERE vp.fixture_id = vt.fixture_id AND vp.classe = 1 AND vp.ferveur > 0)`;

/**
 * Les matchs TBFO joués (au moins un duel ou un Virage), du filtre.
 * `virage` faux : sans la table de la corde (schéma pas encore appliqué).
 */
export const MATCHS_TBFO = (filtre, { plafond = 5, virage = true } = {}) => `
  SELECT f.id, f.league_id, f.season, f.home_id, f.away_id, f.status_short, f.elapsed,
         f.kickoff_at, f.home_goals, f.away_goals,
         COALESCE(d.dom, 0) AS dom, COALESCE(d.ext, 0) AS ext, COALESCE(d.duels, 0) AS duels,
         ${virage ? 'v.buts_dom AS v_dom, v.buts_ext AS v_ext' : 'NULL AS v_dom, NULL AS v_ext'}
    FROM fixtures f
    LEFT JOIN (${DUELS_PAR_MATCH(filtre, plafond)}) d ON d.fixture_id = f.id
    ${virage ? `LEFT JOIN (${VIRAGE_PAR_MATCH(filtre)}) v ON v.fixture_id = f.id` : ''}
   WHERE (${filtre})
     AND (d.fixture_id IS NOT NULL ${virage ? 'OR v.fixture_id IS NOT NULL' : ''})`;

/** Les points d'un camp : 3 / 1 / 0 aux duels, +2 au Virage gagné. */
export function pointsDe(pour, contre, vPour, vContre) {
  const duels = pour > contre ? BAREME.victoire : pour === contre ? BAREME.nul : BAREME.defaite;
  return duels + (Number(vPour ?? 0) > Number(vContre ?? 0) ? BAREME.virage : 0);
}

/**
 * Un match TBFO, en clair : le score, le Virage, les points de chaque camp,
 * et s'il est fini (points acquis) ou se joue encore (points provisoires).
 */
export function lireMatch(m) {
  const dom = Number(m.dom ?? 0), ext = Number(m.ext ?? 0);
  const virage = m.v_dom == null ? null : [Number(m.v_dom), Number(m.v_ext)];
  const fini = FINIS.includes(m.status_short);
  return {
    id: Number(m.id), home: Number(m.home_id), away: Number(m.away_id),
    league: Number(m.league_id), saison: Number(m.season),
    statut: m.status_short, coup: m.kickoff_at,
    score: [dom, ext], duels: Number(m.duels ?? 0), virage,
    points: [pointsDe(dom, ext, virage?.[0], virage?.[1]), pointsDe(ext, dom, virage?.[1], virage?.[0])],
    fini,
    direct: !fini && EN_COURS_DE_JEU.includes(m.status_short),
  };
}

/**
 * Le tableau d'un championnat, à partir de ses matchs TBFO (`lireMatch`).
 * Seuls les matchs finis comptent ; un match qui se joue donne ses points
 * provisoires dans `direct`. Rend une Map club -> ligne.
 */
export function tableau(matchs) {
  const lignes = new Map();
  const ligne = (id) => {
    if (!lignes.has(id)) {
      lignes.set(id, { joues: 0, gagnes: 0, nuls: 0, perdus: 0, pour: 0, contre: 0,
        virages: 0, points: 0, direct: null, forme: [] });
    }
    return lignes.get(id);
  };
  for (const m of matchs) {
    [[m.home, 0], [m.away, 1]].forEach(([club, c]) => {
      const l = ligne(club);
      const pour = m.score[c], contre = m.score[1 - c];
      if (m.fini) {
        l.joues += 1;
        l.pour += pour;
        l.contre += contre;
        if (pour > contre) l.gagnes += 1; else if (pour === contre) l.nuls += 1; else l.perdus += 1;
        if (m.virage && m.virage[c] > m.virage[1 - c]) l.virages += 1;
        l.points += m.points[c];
        l.forme.push({ coup: m.coup, issue: pour > contre ? 'V' : pour === contre ? 'N' : 'D' });
      } else if (m.direct) {
        l.direct = (l.direct ?? 0) + m.points[c];
      }
    });
  }
  for (const l of lignes.values()) {
    l.diff = l.pour - l.contre;
    l.forme = l.forme.sort((a, b) => new Date(b.coup) - new Date(a.coup)).slice(0, 5)
      .map((x) => x.issue);
  }
  return lignes;
}

/** L'ordre d'un championnat : points, différence, duels gagnés, victoires, nom. */
export function ordreChampionnat(a, b) {
  return (b.points - a.points) || (b.diff - a.diff) || (b.pour - a.pour)
    || (b.gagnes - a.gagnes) || String(a.name ?? '').localeCompare(String(b.name ?? ''));
}
