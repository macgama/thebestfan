/**
 * L'inventaire des compétitions : `souvenir_leagues`.
 *
 * C'est la table qui dit quelles compétitions existent pour le jeu, laquelle de
 * leurs saisons est en cours (`starts_on`, `ends_on`), et ce que l'API couvre
 * pour chacune. Le télétexte y choisit la saison qu'il montre, le sommaire y
 * lit ce qui est « en cours », les cartes-souvenirs y lisent la famille.
 *
 * **Elle ne se remplissait qu'à la main.** `scripts/coverage.mjs`, « à chaque
 * intersaison » : tant que personne ne le relançait, la saison suivante
 * n'existait pas en base. Le télétexte restait alors sur la saison finie —
 * son classement, ses résultats, son classement de ferveur — et la compétition
 * sortait du sommaire, ses dates étant passées. Le serveur la tient désormais
 * à jour seul, une fois par jour, pour un appel. Le script reste, pour voir le
 * rapport ou forcer un passage.
 *
 * **Ce que l'administration a décidé ne bouge pas.** Une ligne déjà connue
 * garde son interrupteur et son palier ; une saison nouvelle les reprend de la
 * saison d'avant de la même compétition. Seule une compétition jamais vue
 * prend les valeurs par défaut ci-dessous.
 */

/** Ce qu'on considère comme une compétition intéressante pour le jeu. */
export function classer(l) {
  const nom = l.league.name.toLowerCase();
  const pays = l.country?.name ?? '';
  if (pays === 'World') {
    if (/friendl|amical/.test(nom)) return 'amical';
    return 'international';
  }
  if (l.league.type === 'Cup') return 'coupe';
  return 'championnat';
}

/**
 * Une compétition de `/leagues`, telle qu'on la range : sa saison en cours, ou
 * la plus récente si aucune n'est marquée courante.
 */
export function entreeDe(l) {
  const saison = (l.seasons ?? []).find((s) => s.current) ?? (l.seasons ?? []).at(-1);
  if (!saison) return null;
  const c = saison.coverage?.fixtures ?? {};
  const cov = saison.coverage ?? {};
  return {
    id: l.league.id,
    nom: l.league.name,
    pays: l.country?.name ?? null,
    /* Les deux lettres ISO du pays. C'est la seule chose de cette réponse qui
       permette de dire « Espagne » plutôt que « Spain » sans tenir une table
       de traductions : le navigateur fait le reste. Voir public/pays.js. */
    code: l.country?.code ?? null,
    type: l.league.type,
    famille: classer(l),
    saison: saison.year,
    events: Boolean(c.events),
    lineups: Boolean(c.lineups),
    classement: Boolean(cov.standings),
    buteurs: Boolean(cov.top_scorers),
    passeurs: Boolean(cov.top_assists),
    cartons: Boolean(cov.top_cards),
    debut: saison.start ?? null,
    fin: saison.end ?? null,
  };
}

/**
 * Palier de notoriété : il décide du prix des vignettes et de l'ordre
 * d'affichage dans le télétexte.
 *
 * La règle doit nommer les compétitions, pas se contenter de leur pays.
 * « toutes les ligues anglaises » classait la National League South Play-offs
 * au même rang que la Premier League — c'est absurde, et ça noyait les grandes
 * compétitions au milieu de leurs divisions inférieures.
 */
const MAJEURES = new Set([
  'UEFA Champions League', 'World Cup', 'Euro Championship',
  'Copa America', 'Africa Cup of Nations', 'UEFA Nations League',
]);

/** Première division de chaque grand pays, nommée explicitement. */
const ELITES = new Map([
  ['England', 'Premier League'],
  ['Spain', 'La Liga'],
  ['Italy', 'Serie A'],
  ['Germany', 'Bundesliga'],
  ['France', 'Ligue 1'],
]);

/** Deuxièmes divisions des grands pays, et élites des pays solides. */
const SECONDES = new Map([
  ['England', 'Championship'],
  ['Spain', 'Segunda División'],
  ['Italy', 'Serie B'],
  ['Germany', '2. Bundesliga'],
  ['France', 'Ligue 2'],
]);

const SOLIDES = new Map([
  ['Switzerland', 'Super League'],
  ['Netherlands', 'Eredivisie'],
  ['Portugal', 'Primeira Liga'],
  ['Belgium', 'Jupiler Pro League'],
  ['Brazil', 'Serie A'],
  ['Argentina', 'Liga Profesional Argentina'],
  ['Turkey', 'Süper Lig'],
  ['Scotland', 'Premiership'],
  ['Austria', 'Bundesliga'],
  ['Denmark', 'Superliga'],
  ['USA', 'Major League Soccer'],
  ['Mexico', 'Liga MX'],
]);

const COUPES_MAJEURES = new Set([
  'UEFA Europa League', 'UEFA Europa Conference League', 'UEFA Conference League',
  'FA Cup', 'Copa del Rey', 'Coppa Italia', 'DFB Pokal', 'Coupe de France',
  'Copa Libertadores',
]);

export function palier(e) {
  if (MAJEURES.has(e.nom)) return 1;
  if (ELITES.get(e.pays) === e.nom) return 1;
  if (COUPES_MAJEURES.has(e.nom)) return 2;
  if (SECONDES.get(e.pays) === e.nom) return 2;
  if (SOLIDES.get(e.pays) === e.nom) return 2;
  // Les compétitions de sélections restent visibles sans être majeures.
  if (e.famille === 'international' && !/friendl|qualif|u1[7-9]|u2[0-3]|women/i.test(e.nom)) {
    return 2;
  }
  return 3;
}

/**
 * Trie la réponse de `/leagues` : les compétitions dont l'API couvre les
 * événements (buteur et minute, donc une carte-souvenir possible), et les
 * autres.
 */
export function trier(reponse) {
  const eligibles = [];
  const recalees = [];
  for (const l of reponse) {
    const e = entreeDe(l);
    if (e) (e.events ? eligibles : recalees).push(e);
  }
  return { eligibles, recalees };
}

/**
 * Écrit les compétitions éligibles dans `souvenir_leagues`.
 *
 * Les dates et la couverture viennent toujours de l'API : ce sont elles qui
 * bougent d'une intersaison à l'autre. `enabled` et `tier` ne sont écrits qu'à
 * la création d'une ligne — repris de la saison d'avant quand la compétition
 * est déjà connue, sinon par défaut (les amicaux éteints : un souvenir de match
 * amical ne vaut rien, et l'API prévient elle-même que leur couverture est
 * irrégulière).
 *
 * @returns {{ ecrites: number, nouvelles: number }}
 */
export async function ecrireInventaire(pool, eligibles) {
  if (!eligibles.length) return { ecrites: 0, nouvelles: 0 };
  const [connues] = await pool.query(
    `SELECT league_id, season, enabled, tier FROM souvenir_leagues`);
  const lignes = new Set(connues.map((r) => `${r.league_id}:${r.season}`));
  /* La saison la plus récente de chaque compétition, celle dont on hérite. */
  const derniere = new Map();
  for (const r of connues) {
    const d = derniere.get(r.league_id);
    if (!d || r.season > d.season) derniere.set(r.league_id, r);
  }

  let nouvelles = 0;
  const values = eligibles.map((e) => {
    if (!lignes.has(`${e.id}:${e.saison}`)) nouvelles++;
    const avant = derniere.get(e.id);
    return [
      e.id, e.saison, e.nom, e.pays, e.code, e.type, e.famille,
      1, e.lineups ? 1 : 0, e.classement ? 1 : 0,
      e.buteurs ? 1 : 0, e.passeurs ? 1 : 0, e.cartons ? 1 : 0,
      avant ? Number(avant.tier) : palier(e), e.debut, e.fin,
      avant ? Number(avant.enabled) : (e.famille === 'amical' ? 0 : 1),
    ];
  });

  for (let i = 0; i < values.length; i += 200) {
    await pool.query(
      `INSERT INTO souvenir_leagues
         (league_id, season, name, country, country_code, type, family, has_events, has_lineups,
          has_standings, has_top_scorers, has_top_assists, has_top_cards, tier,
          starts_on, ends_on, enabled)
       VALUES ?
       ON DUPLICATE KEY UPDATE name=VALUES(name), country=VALUES(country),
         country_code=VALUES(country_code), type=VALUES(type),
         family=VALUES(family), has_events=VALUES(has_events), has_lineups=VALUES(has_lineups),
         has_standings=VALUES(has_standings), has_top_scorers=VALUES(has_top_scorers),
         has_top_assists=VALUES(has_top_assists), has_top_cards=VALUES(has_top_cards),
         starts_on=VALUES(starts_on), ends_on=VALUES(ends_on)`,
      [values.slice(i, i + 200)],
    );
  }
  return { ecrites: values.length, nouvelles };
}

/**
 * Un passage complet : un appel à `/leagues`, puis l'écriture.
 * `api(path)` rend le tableau `response` de l'API.
 */
export async function inventorier({ api, pool }) {
  const { eligibles, recalees } = trier(await api('/leagues'));
  const ecrit = await ecrireInventaire(pool, eligibles);
  return { ...ecrit, eligibles, recalees };
}
