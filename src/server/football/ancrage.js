import { journeeParId } from './journee.js';

/**
 * Poser en base un match qui n'existe encore que dans le flux du jour.
 *
 * ## Le défaut que ça corrige
 *
 * `fixtures` est un cache : le collecteur y range les matchs des compétitions
 * suivies. La **journée du jour**, elle, vient de l'API et contient le monde
 * entier — on peut donc entrer dans un duel ou dans un virage sur un match dont
 * aucune ligne n'existe ici.
 *
 * Le Grand Virage écrivait cette ligne avant de compter la présence, et son
 * commentaire disait pourquoi : « une salle sans ligne aurait marché à l'écran
 * et perdu tout ce qui en sort ». **Le duel ne l'écrivait pas**, et c'est
 * exactement ce qui s'est perdu : `duel_results.fixture_id` pointait vers rien,
 * la jointure du parcours rendait `NULL`, et la ligne s'affichait « match
 * inconnu » — pour toujours, puisque le match, lui, était déjà joué.
 *
 * Un supporter voyait donc son virage nommé « Be1 NFA – Transinvest 2 » et son
 * duel du même soir « match inconnu ».
 *
 * ## Pourquoi un module à part
 *
 * Deux appelants, une seule écriture. Recopier les quatre requêtes dans le deck
 * aurait marché le premier jour et divergé au second : la saison, la clé
 * étrangère des équipes et la mise à jour du score sont trois choses qu'on
 * corrige rarement deux fois de suite au même endroit.
 *
 * ## Ce qu'il écrit, dans cet ordre
 *
 * La compétition, les deux équipes, puis le match — les clés étrangères de
 * `fixtures` l'exigent, et un match posé avant ses équipes est un match refusé.
 *
 * La saison vient de la table des compétitions quand elle y est ; sinon de
 * l'année du coup d'envoi. C'est une approximation assumée et bornée : elle ne
 * sert qu'à ranger le match dans un classement, et la ligne est corrigée dès le
 * premier passage du collecteur, qui tient la saison de l'API.
 *
 * Rend `true` s'il a écrit, `null` si la journée ne connaît pas ce match — ce
 * qui n'est pas une erreur : on entre aussi sur des matchs déjà en base.
 */
export async function ancrerDepuisLaJournee({ q, jourDuFoot = null }, fixtureId) {
  const m = (await journeeParId(jourDuFoot)).get(Number(fixtureId));
  if (!m?.leagueId || !m.home?.id || !m.away?.id) return null;

  await q(
    `INSERT INTO leagues (id, name, country) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE name = VALUES(name), country = VALUES(country)`,
    [m.leagueId, m.leagueName ?? String(m.leagueId), m.country ?? null]);

  for (const c of [m.home, m.away]) {
    await q(
      `INSERT INTO teams (id, name, logo) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), logo = VALUES(logo)`,
      [c.id, c.name ?? String(c.id), c.logo ?? null]);
  }

  const [ligue] = await q(
    'SELECT current_season FROM leagues WHERE id = ?', [m.leagueId]);
  const saison = Number(ligue?.current_season)
    || new Date(m.date ?? Date.now()).getUTCFullYear();

  await q(
    `INSERT INTO fixtures (id, league_id, season, home_id, away_id,
                           home_goals, away_goals, status_short, elapsed,
                           elapsed_extra, kickoff_at, polled_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3))
     ON DUPLICATE KEY UPDATE
       home_goals = VALUES(home_goals), away_goals = VALUES(away_goals),
       status_short = VALUES(status_short), elapsed = VALUES(elapsed),
       elapsed_extra = VALUES(elapsed_extra), polled_at = NOW(3)`,
    [Number(fixtureId), m.leagueId, saison, m.home.id, m.away.id,
     m.home.goals ?? null, m.away.goals ?? null, m.status ?? 'NS',
     m.elapsed ?? null, m.extra ?? null,
     new Date(m.date ?? Date.now()).toISOString().slice(0, 19).replace('T', ' ')]);

  return true;
}
