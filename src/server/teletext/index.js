import express from 'express';
// Renommé à l'import : la fonction jour() plus bas a déjà une variable
// locale nommée jourISO, et deux noms identiques dans le même fichier se
// lisent mal même quand la portée les sépare.
import { jourISO as jourDeColonne } from '../../shared/jour.js';

/**
 * Le télétexte : tous les championnats, leurs classements, leurs résultats et
 * leurs meilleurs joueurs.
 *
 * Le sujet ici n'est pas l'affichage, c'est le quota. Sept mille cinq cents
 * appels par jour ne suffisent pas si chaque consultation en déclenche un.
 * Tout passe donc par un cache en base : le premier joueur qui ouvre la Ligue 1
 * paie un appel, les mille suivants ne paient rien. Et quand le budget est
 * atteint, on sert la version périmée plutôt qu'une page vide.
 */

/** Durées de vie, en secondes. Elles suivent le rythme réel des données. */
const TTL = {
  jour: 900,          // les matchs d'une journée, hors direct
  jourLive: 45,       // dès qu'un match est en cours
  match: 600,         // fiche d'un match à venir
  matchLive: 25,      // fiche d'un match en cours
  // Un match terminé ne change plus jamais. Le garder vingt-cinq secondes
  // faisait repayer un appel à chaque visiteur : c'est le genre de détail qui
  // vide un quota sans qu'on comprenne pourquoi.
  matchFini: 7 * 24 * 3600,
  stats: 60,          // statistiques pendant le match
  compo: 6 * 3600,    // composition publiée : elle ne bouge plus qu'aux changements
  // Une composition demandée avant sa parution revient vide. La garder
  // longtemps ferait manquer sa publication — on réessaie vite.
  compoVide: 90,
  standings: 6 * 3600,
  scorers: 12 * 3600,
  assists: 12 * 3600,
  cards: 12 * 3600,
  fixtures: 3600,
  fixturesLive: 60,
  // Un calendrier ne bouge pas, et les scores des journées passées non
  // plus. Ce qui bouge tient dans la fenêtre de deux jours, bien plus
  // légère, que l’on redemande seule pendant un direct.
  saison: 12 * 3600,
  day: 300,
  dayLive: 60,
};

export function createTeletext({ pool, client, footballStore = null }) {
  const q = async (sql, params = []) => {
    const [rows] = await pool.execute(sql, params);
    return rows;
  };

  /* --------------------------------------------------------------- cache */

  /**
   * Selon la version du pilote et la configuration, une colonne JSON revient
   * déjà décodée ou sous forme de chaîne. Les deux cas doivent marcher, sinon
   * le cache lève à chaque lecture et n'économise plus rien.
   */
  const decode = (v) => (typeof v === 'string' ? JSON.parse(v) : v);

  /**
   * `ttlSec` accepte un nombre, ou une fonction de la réponse obtenue.
   *
   * La durée dépend parfois de ce qu'on a reçu, et on ne peut pas le savoir
   * avant d'appeler : une fiche de match terminé se garde une semaine alors
   * qu'un match en cours se garde vingt-cinq secondes, et une composition pas
   * encore publiée revient vide — la garder six heures ferait manquer sa
   * parution.
   */
  /**
   * ## La fraîcheur se juge en SQL, jamais en JavaScript
   *
   * C'est le correctif d'une panne qui a gelé tous les scores en direct
   * pendant des heures, et qui ne ressemblait pas du tout à un problème de
   * date.
   *
   * `expires_at` et `fetched_at` sont écrits avec `NOW(3)`, donc dans le
   * fuseau de la session MySQL. Le pilote, lui, est réglé sur `timezone: 'Z'`
   * — il relit toute colonne `DATETIME` comme de l'UTC. Sur un serveur à
   * l'heure de Zurich, les deux valeurs revenaient donc **deux heures dans le
   * futur**, et deux choses cassaient d'un coup :
   *
   *   — `expires_at > maintenant` restait vrai deux heures de trop. Le cache
   *     du jour, réglé à quarante-cinq secondes, servait la même réponse
   *     pendant près de trois heures : les scores ne bougeaient plus ;
   *   — `luA` partait dans le futur, donc `Date.now() - luA` était négatif et
   *     `horloge.js` ramenait l'écoulé à zéro. La minute d'un match en cours
   *     ne défilait plus chez le client non plus.
   *
   * Une seule cause, deux symptômes, et aucune erreur nulle part.
   *
   * Le remède ne touche pas aux écritures. On ne fait plus **traverser** la
   * frontière SQL/JS à une date : la comparaison se fait en SQL, où les deux
   * côtés viennent de la même horloge, et l'instant de lecture revient en
   * millisecondes déjà converties par `UNIX_TIMESTAMP`. Cette fonction lit la
   * colonne dans le fuseau de la session — celui-là même qui l'a écrite —
   * donc l'aller-retour est juste quel que soit le réglage du serveur, et
   * **quel que soit celui du pilote**.
   *
   * La règle à retenir : une date qui passe de MySQL à JavaScript est une date
   * dont il faut se méfier. Quand on peut la comparer sans la faire sortir, on
   * la compare sans la faire sortir.
   */
  async function cached(key, ttlSec, fetcher) {
    const hit = (await q(
      `SELECT payload,
              expires_at > NOW(3)                AS frais,
              UNIX_TIMESTAMP(fetched_at) * 1000  AS luA
       FROM api_cache WHERE k = ?`, [key]))[0];
    if (hit && Number(hit.frais)) {
      // `luA` : l'instant de la lecture chez l'API, pas celui du service.
      // Sans cette distinction, le client croit la donnée fraîche à chaque
      // requête et le chrono d'un match en cours ne bouge jamais.
      return { data: decode(hit.payload), fresh: true, luA: Number(hit.luA) };
    }

    try {
      const luA = Date.now();
      const data = await fetcher();
      const ttl = typeof ttlSec === 'function' ? ttlSec(data) : ttlSec;
      await q(
        `INSERT INTO api_cache (k, payload, expires_at)
         VALUES (?, ?, NOW(3) + INTERVAL ? SECOND)
         ON DUPLICATE KEY UPDATE payload = VALUES(payload),
           expires_at = VALUES(expires_at), fetched_at = NOW(3)`,
        [key, JSON.stringify(data), ttl]);
      return { data, fresh: true, luA };
    } catch (e) {
      // Quota épuisé ou API en panne : la version périmée vaut mieux que rien.
      if (hit) {
        return { data: decode(hit.payload), fresh: false, stale: true,
                 luA: Number(hit.luA) };
      }
      throw e;
    }
  }

  /* ------------------------------------------------------------- saisons */

  /**
   * La saison en cours d'une compétition, déduite des dates.
   *
   * On ne se fie pas au drapeau `current` de l'API : il traîne parfois d'une
   * saison sur l'autre. La date du jour comparée au début et à la fin de la
   * saison est plus sûre. Hors saison, on garde la dernière connue — c'est ce
   * qu'un supporter veut voir en juillet.
   */
  async function seasonOf(leagueId) {
    const rows = await q(
      `SELECT season, starts_on, ends_on, name, country, country_code, family, type,
              has_standings, has_top_scorers, has_top_assists, has_top_cards
         FROM souvenir_leagues WHERE league_id = ? ORDER BY season DESC`,
      [leagueId]);
    if (!rows.length) return null;

    const today = new Date().toISOString().slice(0, 10);
    // Même faute que dans deck/ : `starts_on` est une colonne DATE, donc un
    // objet Date, et String(...).slice(0, 10) en tirait « Mon Aug 04 ». La
    // saison en cours était alors choisie selon l'ordre alphabétique des jours
    // de la semaine. Voir src/shared/jour.js.
    const enCours = rows.find((r) => r.starts_on && r.ends_on
      && jourDeColonne(r.starts_on) <= today
      && today <= jourDeColonne(r.ends_on));
    return enCours ?? rows[0];
  }

  /** Un match de cette compétition est-il en cours ? Décide de la fraîcheur. */
  async function hasLive(leagueId) {
    const r = await q(
      `SELECT 1 FROM fixtures
        WHERE league_id = ? AND status_short IN ('1H','HT','2H','ET','BT','P','LIVE')
        LIMIT 1`, [leagueId]);
    return r.length > 0;
  }

  /* --------------------------------------------------------- invalidation */

  /**
   * Un match vient de se terminer : le classement et les buteurs de sa
   * compétition sont désormais faux. On les efface plutôt que d'attendre six
   * heures — c'est précisément à ce moment que les gens vont les regarder.
   */
  async function invalider(leagueId) {
    await q(`DELETE FROM api_cache WHERE k LIKE ? OR k LIKE ? OR k LIKE ? OR k LIKE ?`,
      [`standings:${leagueId}:%`, `scorers:${leagueId}:%`,
       `assists:${leagueId}:%`, `cards:${leagueId}:%`]);
  }

  /* ------------------------------------------------------- matchs du jour */

  const enDirect = (s) => ['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE', 'INT'].includes(s);
  const fini = (s) => ['FT', 'AET', 'PEN'].includes(s);

  /**
   * Tous les matchs d'une journée, toutes compétitions confondues.
   *
   * Un seul appel à l'API couvre le monde entier : c'est bien plus économe que
   * d'interroger chaque compétition. On ne garde que celles qui sont activées,
   * et on les regroupe pour que la page n'ait rien à trier.
   */
  async function jour(date, { userId = null } = {}) {
    const jourISO = /^\d{4}-\d{2}-\d{2}$/.test(String(date))
      ? date : new Date().toISOString().slice(0, 10);
    const aujourdhui = jourISO === new Date().toISOString().slice(0, 10);

    const { data, stale, luA } = await cached(`jour:${jourISO}`,
      aujourdhui ? TTL.jourLive : TTL.jour,
      () => client.call('/fixtures', { date: jourISO, timezone: 'UTC' }));

    const activees = new Map((await q(
      `SELECT league_id, name, country, tier, family FROM souvenir_leagues WHERE enabled = 1`))
      .map((l) => [l.league_id, l]));

    const suivis = userId ? new Set((await q(
      `SELECT team_id FROM user_follows WHERE user_id = ?`, [userId])).map((r) => r.team_id))
      : new Set();

    const parLigue = new Map();
    for (const r of data ?? []) {
      const l = activees.get(r.league?.id);
      if (!l) continue;
      const m = {
        id: r.fixture.id,
        date: r.fixture.date,
        status: r.fixture.status?.short,
        elapsed: r.fixture.status?.elapsed ?? null,
        // Le temps additionnel : sans lui, la page ne peut afficher que « 90+ ».
        extra: r.fixture.status?.extra ?? null,
        // Instant de la lecture chez l'API : le client fait défiler le chrono
        // à partir de là, sans redemander quoi que ce soit.
        luA: luA ?? Date.now(),
        round: r.league?.round,
        home: { id: r.teams.home.id, name: r.teams.home.name, logo: r.teams.home.logo,
                goals: r.goals?.home, vainqueur: r.teams.home.winner },
        away: { id: r.teams.away.id, name: r.teams.away.name, logo: r.teams.away.logo,
                goals: r.goals?.away, vainqueur: r.teams.away.winner },
        live: enDirect(r.fixture.status?.short),
        fini: fini(r.fixture.status?.short),
        mien: suivis.has(r.teams.home.id) || suivis.has(r.teams.away.id),
      };
      if (!parLigue.has(l.league_id)) {
        /* Le drapeau porte le **code ISO** du pays — `…/flags/de.svg` — et
           c'est la seule chose de cette réponse qui le donne. La page des
           matchs s'en sert pour écrire le nom du pays dans la langue du
           lecteur sans qu'on tienne une liste de deux cents pays dans le
           dépôt. Il arrive dans la réponse qu'on lit déjà : il ne coûte pas
           un appel de plus. */
        /* `id` : la page des matchs bâtit le lien vers la compétition avec
           lui. Sans, elle écrivait « /teletext?ligue=undefined » et le
           clic retombait sur le sommaire — la colonne s’appelle
           `league_id`, et ce nom-là ne sort pas d’ici. */
        parLigue.set(l.league_id,
          { ligue: { ...l, id: l.league_id, drapeau: r.league?.flag ?? null }, matchs: [] });
      }
      parLigue.get(l.league_id).matchs.push(m);
    }

    // Ordre : mes clubs d'abord, puis les matchs en cours, puis le palier.
    const groupes = [...parLigue.values()].map((g) => ({
      ...g,
      matchs: g.matchs.sort((a, b) => new Date(a.date) - new Date(b.date)),
      mien: g.matchs.some((m) => m.mien),
      live: g.matchs.some((m) => m.live),
    })).sort((a, b) =>
      (b.mien - a.mien) || (b.live - a.live) || (a.ligue.tier - b.ligue.tier)
      || a.ligue.name.localeCompare(b.ligue.name));

    return {
      date: jourISO,
      groupes,
      total: groupes.reduce((n, g) => n + g.matchs.length, 0),
      enDirect: groupes.reduce((n, g) => n + g.matchs.filter((m) => m.live).length, 0),
      stale: Boolean(stale),
    };
  }

  /* --------------------------------------------- statistiques et compositions */

  /**
   * Ce qu'on montre d'un match, dans l'ordre où un supporter le regarde.
   *
   * L'API en renvoie une vingtaine, en anglais, dont plusieurs redondantes
   * (« Shots insidebox » et « Shots outsidebox » disent la même chose que
   * « Total Shots » découpée autrement). On garde ce qui se commente au café,
   * et on traduit — un tableau en anglais dans une page en français a l'air
   * d'une fuite technique.
   */
  const STATS = [
    ['Ball Possession', 'Possession'],
    ['Total Shots', 'Tirs'],
    ['Shots on Goal', 'Tirs cadrés'],
    ['expected_goals', 'Buts attendus'],
    ['Corner Kicks', 'Corners'],
    ['Goalkeeper Saves', 'Arrêts du gardien'],
    ['Fouls', 'Fautes'],
    ['Offsides', 'Hors-jeu'],
    ['Yellow Cards', 'Cartons jaunes'],
    ['Red Cards', 'Cartons rouges'],
    ['Total passes', 'Passes'],
    ['Passes %', 'Passes réussies'],
  ];

  /** « 52% », « 1.4 », 3, null — tout doit devenir un nombre comparable. */
  const nombre = (v) => {
    if (typeof v === 'number') return v;
    if (v === null || v === undefined) return 0;
    const n = Number.parseFloat(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  };

  /**
   * La barre de chaque ligne est la part de l'équipe à domicile. Deux valeurs
   * nulles ne donnent pas une barre à zéro mais une barre au milieu : à 0-0,
   * aucune des deux équipes ne domine.
   */
  function mapStats(data, homeId) {
    const parEquipe = new Map((data ?? []).map((e) => [e.team?.id, e.statistics ?? []]));
    const home = parEquipe.get(homeId) ?? [];
    const away = [...parEquipe].find(([id]) => id !== homeId)?.[1] ?? [];
    const val = (liste, type) =>
      liste.find((s) => String(s.type).toLowerCase() === type.toLowerCase())?.value;

    const out = [];
    for (const [type, nom] of STATS) {
      const h = val(home, type);
      const a = val(away, type);
      if (h === undefined && a === undefined) continue;
      const hn = nombre(h);
      const an = nombre(a);
      // Une ligne à zéro des deux côtés n'apprend rien et allonge le tableau.
      if (hn === 0 && an === 0) continue;
      const total = hn + an;
      out.push({
        nom,
        home: h ?? 0,
        away: a ?? 0,
        partHome: total ? Math.round((hn / total) * 100) : 50,
      });
    }
    return out;
  }

  /** L'API code les postes en une lettre anglaise ; « F » se dit attaquant. */
  const POSTE = { G: 'G', D: 'D', M: 'M', F: 'A' };

  function mapCompo(data, homeId, awayId) {
    const parEquipe = new Map((data ?? []).map((e) => [e.team?.id, e]));
    const cote = (id) => {
      const e = parEquipe.get(id);
      if (!e) return null;
      const joueur = (x) => ({
        numero: x.player?.number ?? null,
        nom: x.player?.name ?? '',
        poste: POSTE[x.player?.pos] ?? x.player?.pos ?? '',
      });
      return {
        dispositif: e.formation ?? '',
        titulaires: (e.startXI ?? []).map(joueur),
        remplacants: (e.substitutes ?? []).map(joueur),
        entraineur: e.coach?.name ?? '',
      };
    };
    const home = cote(homeId);
    const away = cote(awayId);
    return (home || away) ? { home, away } : null;
  }

  /* ------------------------------------------------------- fiche du match */

  /**
   * Un match, avant, pendant et après.
   * Avant : la composition n'existe pas encore, on donne l'affiche et l'heure.
   * Pendant : le score, la minute et le fil des événements.
   * Après : le score final et le résumé complet.
   */
  async function match(fixtureId) {
    const { data, stale, luA } = await cached(
      `match:${fixtureId}`,
      // Un match terminé ne bouge plus : une semaine. En cours : vingt-cinq
      // secondes. À venir : dix minutes.
      (d) => {
        const s = d?.f?.fixture?.status?.short;
        return fini(s) ? TTL.matchFini : enDirect(s) ? TTL.matchLive : TTL.match;
      },
      async () => {
        const [f] = await client.call('/fixtures', { id: fixtureId });
        if (!f) throw new Error('match introuvable');
        // Les événements ne sont demandés que s'il y a quelque chose à raconter.
        const evs = (enDirect(f.fixture.status?.short) || fini(f.fixture.status?.short))
          ? await client.call('/fixtures/events', { fixture: fixtureId }) : [];
        return { f, evs };
      });

    const f = data.f;
    const statut = f.fixture.status?.short;
    const live = enDirect(statut);
    const termine = fini(statut);

    /**
     * Statistiques et composition sont deux appels de plus par match. On ne
     * les demande donc que lorsqu'ils ont une chance de répondre : pas de
     * statistiques avant le coup d'envoi, pas de composition avant qu'elle
     * soit publiée — une heure avant, en général.
     *
     * Chacune a son propre rythme, donc sa propre entrée de cache : pendant un
     * match, les statistiques changent toutes les minutes alors que la
     * composition ne bouge plus. Les mêler obligerait à tout redemander au
     * rythme du plus rapide.
     */
    // Un match reporté ou annulé n'aura jamais ni composition ni statistiques.
    // Sans cette garde, sa fiche redemandait une composition vide toutes les
    // quatre-vingt-dix secondes, pour chaque curieux, jusqu'à la fin des temps.
    const annule = ['PST', 'CANC', 'ABD', 'AWD', 'WO', 'TBD'].includes(statut);
    const versCoupDEnvoi = Date.parse(f.fixture.date) - Date.now();
    const bientot = !annule
      && versCoupDEnvoi < 90 * 60 * 1000      // publiée environ une heure avant
      && versCoupDEnvoi > -6 * 3600 * 1000;   // et pas un match d'hier resté « à venir »
    const ttlFige = (t) => (termine ? TTL.matchFini : t);

    const [statistiques, compositions] = await Promise.all([
      (live || termine)
        ? cached(`stats:${fixtureId}`, ttlFige(TTL.stats),
          () => client.call('/fixtures/statistics', { fixture: fixtureId }))
          .then((r) => mapStats(r.data, f.teams.home?.id))
          .catch(() => [])
        : [],
      (live || termine || bientot)
        ? cached(`compo:${fixtureId}`,
          // Vide = pas encore publiée : on réessaie dans quatre-vingt-dix
          // secondes au lieu de figer une absence pour six heures.
          (d) => (d?.length ? ttlFige(TTL.compo) : TTL.compoVide),
          () => client.call('/fixtures/lineups', { fixture: fixtureId }))
          .then((r) => mapCompo(r.data, f.teams.home?.id, f.teams.away?.id))
          .catch(() => null)
        : null,
    ]);

    /* Une requête, deux clubs. On ne la fait pas passer par le cache de
       l'API : ces couleurs vivent en base, elles ne coûtent rien, et les
       figer avec la fiche les garderait absentes une semaine sur un match
       terminé dont le blason vient juste d’être lu. */
    const couleurs = new Map((await q(
      `SELECT id, color1 FROM teams WHERE id IN (?, ?)`,
      [f.teams.home?.id ?? 0, f.teams.away?.id ?? 0])).map((t) => [t.id, t.color1]));

    return {
      statistiques,
      compositions,
      fixture: {
        id: f.fixture.id, date: f.fixture.date,
        status: f.fixture.status?.short, statusLong: f.fixture.status?.long,
        elapsed: f.fixture.status?.elapsed ?? null,
        // Le temps additionnel, que l'horloge partagée sait afficher. Sans
        // lui, la fiche disait « 90+ » sans jamais dire de combien — or
        // c'est exactement ce qu'on regarde à ce moment-là du match.
        extra: f.fixture.status?.extra ?? null,
        luA: luA ?? Date.now(),
        venue: f.fixture.venue?.name, ville: f.fixture.venue?.city,
        arbitre: f.fixture.referee,
        live, fini: fini(f.fixture.status?.short),
      },
      ligue: { id: f.league?.id, nom: f.league?.name, pays: f.league?.country,
               logo: f.league?.logo, journee: f.league?.round, saison: f.league?.season },
      equipes: {
        /* La couleur du club, tirée de son blason une fois pour toutes
           (voir sql/couleurs.sql). Elle sert au personnage qui regarde le
           match : son « GOAL ! » s'écrit aux couleurs de l'équipe, comme sur
           l'accueil et dans le virage. Nulle tant qu'elle n'a pas été
           extraite — la page a sa couleur par défaut. */
        home: { ...f.teams.home, goals: f.goals?.home, couleur: couleurs.get(f.teams.home?.id) },
        away: { ...f.teams.away, goals: f.goals?.away, couleur: couleurs.get(f.teams.away?.id) },
      },
      periodes: f.score ?? null,
      evenements: (data.evs ?? []).map((e) => ({
        minute: e.time?.elapsed, extra: e.time?.extra,
        equipe: e.team?.id, equipeNom: e.team?.name,
        type: e.type, detail: e.detail,
        joueur: e.player?.name, passeur: e.assist?.name,
      })).sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0)),
      stale: Boolean(stale),
    };
  }

  /* ------------------------------------------------------------- lecture */

  async function standings(leagueId) {
    const s = await seasonOf(leagueId);
    if (!s) return null;
    if (!s.has_standings) return { league: s, groups: [], unsupported: true };

    const { data, stale } = await cached(`standings:${leagueId}:${s.season}`,
      TTL.standings, () => client.standings(leagueId, s.season));

    const groups = (data[0]?.league?.standings ?? []).map((g) => g.map((r) => ({
      rank: r.rank, teamId: r.team.id, name: r.team.name, logo: r.team.logo,
      played: r.all?.played ?? 0, win: r.all?.win ?? 0, draw: r.all?.draw ?? 0,
      lose: r.all?.lose ?? 0, gf: r.all?.goals?.for ?? 0, ga: r.all?.goals?.against ?? 0,
      points: r.points, form: r.form, group: r.group,
    })));
    return { league: s, groups, stale: Boolean(stale) };
  }

  async function ranking(leagueId, kind) {
    const s = await seasonOf(leagueId);
    if (!s) return null;
    const drapeau = { scorers: 'has_top_scorers', assists: 'has_top_assists',
                      cards: 'has_top_cards' }[kind];
    if (!s[drapeau]) return { league: s, players: [], unsupported: true };

    const appel = {
      scorers: () => client.call('/players/topscorers', { league: leagueId, season: s.season }),
      assists: () => client.call('/players/topassists', { league: leagueId, season: s.season }),
      cards: () => client.call('/players/topyellowcards', { league: leagueId, season: s.season }),
    }[kind];

    const { data, stale } = await cached(`${kind}:${leagueId}:${s.season}`, TTL[kind], appel);

    const players = (data ?? []).slice(0, 25).map((p) => {
      const st = p.statistics?.[0] ?? {};
      return {
        name: p.player?.name, photo: p.player?.photo,
        team: st.team?.name, teamLogo: st.team?.logo,
        played: st.games?.appearences ?? 0,
        goals: st.goals?.total ?? 0,
        assists: st.goals?.assists ?? 0,
        yellow: st.cards?.yellow ?? 0,
        red: st.cards?.red ?? 0,
      };
    });
    return { league: s, players, stale: Boolean(stale) };
  }

  /* --------------------------------------------------------- les journées

     La page des résultats ne montrait qu'une fenêtre de vingt jours autour
     d'aujourd'hui. On ne pouvait ni revoir la troisième journée, ni lire le
     calendrier de la fin de saison : pour une page qui s'appelle
     « résultats », c'est l'essentiel qui manquait.

     Il fallait donc la saison entière — et la saison entière tient dans **un
     seul appel**, exactement comme la fenêtre de vingt jours. Ce qui change
     n'est pas le nombre d'appels, c'est ce qu'on en garde.

     Deux caches, et c'est là que se joue le quota :

       — **la saison**, gardée douze heures. Un calendrier ne bouge pas, et
         les scores des journées passées non plus.
       — **la fenêtre autour d'aujourd'hui**, gardée quarante-cinq secondes
         dès qu'un match est en cours. C'est elle, et elle seule, qu'on
         redemande pendant qu'on regarde.

     Les deux se superposent : la journée affichée prend ses scores de la
     fenêtre quand elle y figure, du calendrier sinon. Sans cette séparation,
     suivre un direct redemanderait la saison entière toutes les minutes.   */

  /** Ce qu'on garde d'un match. Le reste de la réponse pèse dix fois plus. */
  const traitMatch = (r) => ({
    id: r.fixture.id,
    date: r.fixture.date,
    status: r.fixture.status?.short,
    elapsed: r.fixture.status?.elapsed ?? null,
    // Le temps additionnel : sans lui, la page ne peut afficher que « 90+ ».
    extra: r.fixture.status?.extra ?? null,
    round: r.league?.round ?? null,
    live: enDirect(r.fixture.status?.short),
    fini: fini(r.fixture.status?.short),
    home: { id: r.teams.home.id, name: r.teams.home.name, logo: r.teams.home.logo,
            goals: r.goals?.home ?? null, vainqueur: r.teams.home.winner ?? null },
    away: { id: r.teams.away.id, name: r.teams.away.name, logo: r.teams.away.logo,
            goals: r.goals?.away ?? null, vainqueur: r.teams.away.winner ?? null },
  });

  /**
   * Ce qu'on vient de lire sert à tout le monde : équipes, calendriers et
   * matchs terminés sont rangés durablement.
   *
   * Appelé **depuis le récupérateur**, donc une fois par appel à l'API et non
   * à chaque lecture. Une saison complète, c'est quatre cents écritures : les
   * refaire à chaque ouverture de page aurait remplacé un problème de quota
   * par un problème de base.
   */
  async function ranger(rows) {
    if (!footballStore) return;
    for (const r of rows ?? []) {
      try {
        await footballStore.upsertTeam(r.teams.home);
        await footballStore.upsertTeam(r.teams.away);
        await footballStore.upsertFixture({
          id: r.fixture.id, leagueId: r.league.id, season: r.league.season,
          round: r.league.round, homeId: r.teams.home.id, awayId: r.teams.away.id,
          homeGoals: r.goals?.home ?? null, awayGoals: r.goals?.away ?? null,
          status: r.fixture.status?.short ?? 'NS', elapsed: r.fixture.status?.elapsed ?? null,
          elapsedExtra: r.fixture.status?.extra ?? null,
          venue: r.fixture.venue?.name ?? null,
          kickoffAt: new Date(r.fixture.date).toISOString().slice(0, 19).replace('T', ' '),
        });
      } catch { /* le télétexte ne doit pas tomber pour une écriture */ }
    }
  }

  /**
   * La journée en cours, au sens du calendrier et non du classement.
   *
   * Trois heures de battement après le dernier coup d'envoi : pendant qu'on
   * joue le dernier match d'une journée, c'est encore celle-là qu'on veut
   * voir, pas la suivante. Entre deux journées, on montre celle qui vient —
   * un supporter regarde plus souvent devant que derrière.
   */
  function journeeCourante(journees) {
    const now = Date.now();
    const dedans = journees.find((j) =>
      Date.parse(j.debut) <= now && now <= Date.parse(j.fin) + 3 * 3600e3);
    return (dedans ?? journees.find((j) => Date.parse(j.debut) > now)
      ?? journees.at(-1))?.round ?? null;
  }

  async function results(leagueId, { journee = null } = {}) {
    const s = await seasonOf(leagueId);
    if (!s) return null;

    const { data: saison, stale } = await cached(
      `saison:${leagueId}:${s.season}`, TTL.saison,
      async () => {
        const rows = await client.call('/fixtures',
          { league: leagueId, season: s.season, timezone: 'UTC' });
        await ranger(rows);
        return (rows ?? []).map(traitMatch);
      });

    const matchs = [...(saison ?? [])]
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    /* Les journées, dans l'ordre du calendrier et non dans celui de leur nom :
       « Regular Season - 10 » se range avant « - 9 » par ordre alphabétique,
       et une phase finale n'a pas de numéro du tout. La date du premier coup
       d'envoi, elle, ne se trompe jamais. */
    const parJournee = new Map();
    for (const m of matchs) {
      const r = m.round ?? '—';
      if (!parJournee.has(r)) parJournee.set(r, []);
      parJournee.get(r).push(m);
    }
    const journees = [...parJournee].map(([round, ms]) => ({
      round,
      debut: ms[0].date,
      fin: ms.at(-1).date,
      joues: ms.filter((m) => m.fini).length,
      total: ms.length,
    }));

    const choisie = parJournee.has(journee) ? journee : journeeCourante(journees);
    let liste = parJournee.get(choisie) ?? [];

    /* Le direct, s'il peut y en avoir un. Deux jours de part et d'autre : au-
       delà, aucun score ne peut plus changer et la fenêtre ne rapporterait
       qu'un appel de plus. */
    let luA = null;
    const bientot = liste.some((m) =>
      Math.abs(Date.now() - Date.parse(m.date)) < 2 * 864e5);
    if (bientot) {
      const from = new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10);
      const to = new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10);
      const live = await hasLive(leagueId);
      try {
        const fenetre = await cached(
          `fenetre:${leagueId}:${s.season}:${from}`,
          live ? TTL.fixturesLive : TTL.fixtures,
          async () => {
            const rows = await client.call('/fixtures',
              { league: leagueId, season: s.season, from, to, timezone: 'UTC' });
            await ranger(rows);
            return (rows ?? []).map(traitMatch);
          });
        const frais = new Map((fenetre.data ?? []).map((m) => [m.id, m]));
        luA = fenetre.luA ?? null;
        liste = liste.map((m) => (frais.has(m.id) ? frais.get(m.id) : m));
      } catch { /* la fenêtre est un supplément : sans elle, le calendrier reste */ }
    }

    return {
      league: s,
      journees: journees.map((j) => ({ ...j, en: j.round === choisie })),
      journee: choisie,
      // L'instant de la lecture chez l'API : le client fait courir la minute à
      // partir de là, sans redemander quoi que ce soit. Nul quand la journée
      // affichée est trop loin pour qu'un match y soit en cours.
      luA,
      matchs: liste,
      stale: Boolean(stale),
    };
  }

  /* -------------------------------------------------------------- routes */

  const router = express.Router();

  /**
   * Durée pendant laquelle le navigateur peut se resservir tout seul.
   * Un joueur qui fait des allers-retours entre classement et buteurs ne
   * redemande alors rien au serveur, qui ne redemande rien à l'API.
   */
  const BROWSER = { '': 900, '/results': 30, '/scorers': 3600, '/assists': 3600, '/cards': 3600 };

  const send = (res, p, maxAge = 900) => p.then((v) => {
    if (v) res.set('cache-control', `private, max-age=${maxAge}`);
    return v ? res.json(v) : res.status(404).json({ error: 'teletext.error.unknown_league' });
  })
    .catch((e) => {
      console.error('[teletext]', e.message);
      res.status(503).json({ error: 'teletext.error.unavailable' });
    });

  /**
   * Enveloppe obligatoire pour toute route asynchrone.
   *
   * Sans elle, une requête SQL qui échoue rejette la promesse et Express ne
   * répond jamais : le navigateur attend indéfiniment, et l'utilisateur voit
   * une page qui tourne en boucle sans aucun message. C'est exactement ce qui
   * arrive quand le schéma n'est pas à jour — une colonne manquante suffit.
   */
  const safe = (fn) => (req, res) => {
    Promise.resolve(fn(req, res)).catch((e) => {
      console.error('[teletext]', req.path, e.message);
      if (res.headersSent) return;
      const manque = /Unknown column|doesn't exist/i.test(e.message);
      res.status(503).json({
        error: manque ? 'teletext.error.schema' : 'teletext.error.unavailable',
        detail: manque ? 'Applique sql/teletext.sql puis relance scripts/coverage.mjs' : undefined,
      });
    });
  };

/**
   * Un compte, pour les deux routes qui écrivent au nom du joueur.
   *
   * Ce module ne prend pas `requireAuth` en paramètre comme ses voisins :
   * `attachUser` pose déjà `req.user` sur chaque requête, et le télétexte est
   * le seul service monté sans rien exiger — toutes ses lectures sont
   * publiques, y compris pour un visiteur sans compte. Une dépendance de plus
   * dans la signature ferait payer à tout le fichier le prix de deux routes.
   * Le code d'erreur est celui du module d'authentification, à la lettre : la
   * page ne doit pas avoir à reconnaître deux façons de dire la même chose.
   */
  const exigeCompte = (req, res, next) =>
    (req.user ? next() : res.status(401).json({ error: 'auth.error.unauthenticated' }));

  /**
   * Le sommaire : servi depuis la base, jamais un appel à l'API.
   *
   * **Ce qui est montré par défaut n'est pas tout.** Neuf cent cinquante
   * compétitions, c'est un annuaire ; ce qu'on vient chercher, c'est ce qui se
   * joue en ce moment. La liste par défaut ne garde donc que les compétitions
   * dont la saison court aujourd'hui, les grandes compétitions de sélections
   * des quatre dernières années — une Coupe du monde reste ce qu'on veut
   * revoir longtemps après — et celles que le joueur suit, qui ne doivent
   * jamais disparaître de sa liste, saison ou pas.
   *
   * Dès qu'une recherche ou un pays est demandé, la restriction tombe : on a
   * nommé ce qu'on cherchait, ce serait absurde de le cacher parce que sa
   * saison est finie.
   */
  router.get('/leagues', safe(async (req, res) => {
    const terme = String(req.query.q ?? '').trim();
    const pays = String(req.query.country ?? '').trim();
    const famille = String(req.query.family ?? '').trim();
    const seulementFavoris = req.query.favoris === '1';
    /* Les pays que le terme désigne, résolus par le navigateur et transmis
       sous leur nom **anglais** : c'est ainsi que la base les range, et c'est
       ce qui permet à « espagne » de trouver « Spain ». Voir public/pays.js.
       Borné à quarante : au-delà, le terme ne désigne plus rien de précis. */
    const paysCherches = String(req.query.pays ?? '').split(',')
      .map((p) => p.trim()).filter(Boolean).slice(0, 40);
    /* Et leurs codes ISO. Les deux, parce qu'aucun ne suffit seul : la colonne
       `country_code` est juste mais peut être vide tant que coverage.mjs n'a
       pas tourné, et le nom anglais d'`Intl` ne colle pas toujours à celui de
       l'API — « Czechia » contre « Czech-Republic ». */
    const codesCherches = String(req.query.codes ?? '').split(',')
      .map((c) => c.trim().toUpperCase()).filter((c) => /^[A-Z]{2}$/.test(c)).slice(0, 40);

    const today = new Date().toISOString().slice(0, 10);
    const moi = req.user?.id ?? null;

    /* `starts_on` inconnu : on affiche. Une date manquante veut dire qu'on ne
       sait pas, et on ne cache pas ce qu'on ne sait pas. */
    const EN_COURS = `(l.starts_on IS NULL OR l.ends_on IS NULL
       OR (l.starts_on <= ? AND ? <= l.ends_on))`;

    const where = ['l.enabled = 1'];
    const args = [moi];                    // le LEFT JOIN des favoris passe en premier
    /* Une compétition par ligne, pas une par saison. La table en garde
       plusieurs — c'est elle qui sait quelle saison est éligible aux cartes —
       mais le sommaire n'a qu'une chose à montrer : la compétition. */
    where.push(`l.season = (SELECT MAX(s2.season) FROM souvenir_leagues s2
                             WHERE s2.league_id = l.league_id AND s2.enabled = 1)`);

    if (terme || paysCherches.length || codesCherches.length) {
      const ou = ['l.name LIKE ?', 'l.country LIKE ?'];
      args.push(`%${terme}%`, `%${terme}%`);
      if (paysCherches.length) {
        ou.push(`l.country IN (${paysCherches.map(() => '?').join(',')})`);
        args.push(...paysCherches);
      }
      if (codesCherches.length) {
        ou.push(`l.country_code IN (${codesCherches.map(() => '?').join(',')})`);
        args.push(...codesCherches);
      }
      where.push(`(${ou.join(' OR ')})`);
    }
    if (pays) { where.push('l.country = ?'); args.push(pays); }
    if (famille) { where.push('l.family = ?'); args.push(famille); }
    if (seulementFavoris) where.push('f.user_id IS NOT NULL');

    if (!terme && !pays && !famille && !paysCherches.length && !codesCherches.length
        && !seulementFavoris) {
      where.push(`(${EN_COURS}
        OR (l.family = 'international' AND l.ends_on >= DATE_SUB(?, INTERVAL 4 YEAR))
        OR f.user_id IS NOT NULL)`);
      args.push(today, today, today);
    }

    const rows = await q(
      `SELECT l.league_id, l.name, l.country, l.country_code, l.type, l.family,
              l.season, l.tier, l.has_standings, l.has_top_scorers,
              l.starts_on, l.ends_on,
              ${EN_COURS} AS en_cours,
              f.user_id IS NOT NULL AS favori
         FROM souvenir_leagues l
         LEFT JOIN user_league_follows f
                ON f.league_id = l.league_id AND f.user_id = ?
        WHERE ${where.join(' AND ')}
        ORDER BY favori DESC, en_cours DESC, l.tier, l.country, l.name
        LIMIT 200`,
      [today, today, ...args]);

    res.json({
      leagues: rows.map((l) => ({
        ...l,
        en_cours: Boolean(Number(l.en_cours)),
        favori: Boolean(Number(l.favori)),
        starts_on: l.starts_on ? jourDeColonne(l.starts_on) : null,
        ends_on: l.ends_on ? jourDeColonne(l.ends_on) : null,
      })),
    });
  }));

  /**
   * Les pays disponibles, pour le sélecteur.
   *
   * Le code ISO part avec : sans lui la page ne saurait écrire « Espagne », et
   * une pastille en anglais au-dessus d'une liste traduite se remarque plus
   * qu'une page entièrement anglaise. `MAX` plutôt que `MIN` : il ignore les
   * valeurs nulles, donc une seule compétition renseignée suffit à nommer le
   * pays tant que `coverage.mjs` n'a pas tout rempli.
   */
  router.get('/countries', safe(async (_req, res) => {
    const rows = await q(
      `SELECT country, MAX(country_code) AS code, COUNT(*) AS n
         FROM souvenir_leagues
        WHERE enabled = 1 AND country IS NOT NULL
        GROUP BY country ORDER BY n DESC`);
    res.json({ countries: rows });
  }));

  /* ------------------------------------------------- compétitions suivies

     Distinctes des clubs suivis, et c'est tout l'intérêt : on peut vouloir la
     Champions League sans suivre aucun de ses clubs, ou la Coupe du monde sans
     suivre de sélection.

     Aucun plafond, contrairement aux clubs. Un club suivi coûte des appels —
     le guetteur va chercher ses matchs — tandis qu'une compétition suivie ne
     coûte qu'une ligne : elle ne déclenche rien, elle ordonne une liste. Un
     plafond sans raison est une règle qu'on ne saurait pas expliquer.        */

  const favorisDe = async (userId) => (await q(
    `SELECT league_id FROM user_league_follows WHERE user_id = ? ORDER BY created_at`,
    [userId])).map((r) => r.league_id);

  router.get('/favoris', exigeCompte, safe(async (req, res) => {
    res.json({ leagues: await favorisDe(req.user.id) });
  }));

  router.post('/favoris/:id', exigeCompte, safe(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'teletext.error.unknown_league' });
    }
    /* On refuse ce qui n'existe pas : une étoile posée sur une compétition
       inconnue ne se verrait nulle part et ne s'enlèverait jamais. */
    const connue = await q(
      `SELECT 1 FROM souvenir_leagues WHERE league_id = ? AND enabled = 1 LIMIT 1`, [id]);
    if (!connue.length) {
      return res.status(404).json({ error: 'teletext.error.unknown_league' });
    }
    await q(`INSERT IGNORE INTO user_league_follows (user_id, league_id) VALUES (?, ?)`,
      [req.user.id, id]);
    res.json({ leagues: await favorisDe(req.user.id) });
  }));

  router.delete('/favoris/:id', exigeCompte, safe(async (req, res) => {
    await q(`DELETE FROM user_league_follows WHERE user_id = ? AND league_id = ?`,
      [req.user.id, Number(req.params.id)]);
    res.json({ leagues: await favorisDe(req.user.id) });
  }));

  router.get('/league/:id', (req, res) =>
    send(res, standings(Number(req.params.id)), BROWSER['']));
  /* La journée voulue voyage dans l’adresse : le navigateur garde alors
     chacune pour son compte, et revenir à la précédente ne redemande rien. */
  router.get('/league/:id/results', (req, res) =>
    send(res, results(Number(req.params.id),
      { journee: req.query.journee ? String(req.query.journee) : null }),
      BROWSER['/results']));
  router.get('/league/:id/scorers', (req, res) =>
    send(res, ranking(Number(req.params.id), 'scorers'), BROWSER['/scorers']));
  router.get('/league/:id/assists', (req, res) =>
    send(res, ranking(Number(req.params.id), 'assists'), BROWSER['/assists']));
  router.get('/league/:id/cards', (req, res) =>
    send(res, ranking(Number(req.params.id), 'cards'), BROWSER['/cards']));

  /** État du cache et du quota : utile pour surveiller la consommation. */
  /** Les matchs d'une journée. `mien` marque ceux des clubs suivis. */
  router.get('/jour', safe(async (req, res) => {
    const d = await jour(String(req.query.date ?? ''), { userId: req.user?.id ?? null });
    res.set('cache-control', 'private, max-age=30');
    res.json(d);
  }));

  router.get('/match/:id', safe(async (req, res) => {
    res.set('cache-control', 'private, max-age=20');
    res.json(await match(Number(req.params.id)));
  }));

  router.get('/cache', safe(async (_req, res) => {
    const [stats] = await pool.query(
      `SELECT COUNT(*) AS entrees,
              SUM(expires_at > NOW(3)) AS fraiches,
              MIN(fetched_at) AS plus_ancienne
         FROM api_cache`);
    res.json({ ...stats[0], quota: client.quota });
  }));

  /** Purge des entrées périmées depuis longtemps. À lancer une fois par jour. */
  async function cleanup() {
    await q(`DELETE FROM api_cache WHERE expires_at < NOW(3) - INTERVAL 7 DAY`);
  }

  return { router, standings, ranking, results, seasonOf, cleanup, jour, match, invalider };
}
