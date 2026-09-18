/**
 * Ce que la journée coûte à API-Football.
 *
 * ## Pourquoi ce script existe
 *
 * L'enveloppe est de **7 500 appels par jour**, et c'est la contrainte qui
 * décide de presque toute l'architecture du projet. Pourtant rien ne disait
 * combien on en consomme : `api_quota` compte ce qui est **déjà parti**, ce qui
 * répond après coup à une question qu'on se pose avant.
 *
 * « Est-ce qu'un soir de Ligue des champions passe ? » ne se répond pas en
 * regardant hier. Elle se répond en comptant les tâches, leur cadence, et le
 * nombre de matchs qui tournent en même temps — c'est ce que fait ce script.
 *
 * ## Les quatre sources d'appels, et ce qu'elles coûtent vraiment
 *
 * **Le direct.** Une boucle toutes les 20 s tant qu'un match suivi est en
 * cours, sinon toutes les 2 minutes — et ce coup d'œil-là ne coûte **rien**,
 * c'est une lecture en base. Les matchs sont demandés **par paquets de vingt**,
 * donc vingt matchs simultanés coûtent un appel, pas vingt. C'est le détail qui
 * change tout, et c'est pour ça qu'il est compté ici plutôt que supposé.
 *
 * **Les relevés d'événements.** Un appel par match et par minute, et
 * **seulement** pour les matchs dont une salle de virage est occupée. C'est de
 * loin le plus gros poste : deux heures de match font 120 appels pour un seul
 * match. C'est aussi le seul qui dépende des joueurs, donc le seul qui grossira
 * avec eux.
 *
 * **Les classements**, toutes les 6 heures : un appel par compétition suivie.
 *
 * **Les calendriers**, une fois par jour : trois appels par club suivi — la
 * fiche, ses compétitions, ses matchs.
 *
 * ## Le budget n'est pas le quota
 *
 * `client.js` s'arrête à **6 800** et non à 7 500. La marge est pour les appels
 * déclenchés par les joueurs — chercher un club, à l'inscription — qui doivent
 * passer même un soir où le worker a beaucoup consommé. Un joueur qui ne peut
 * pas choisir son club le jour de son inscription ne revient pas.
 *
 * Usage :
 *   node scripts/quota.mjs                    la journée d'aujourd'hui, mesurée
 *   node scripts/quota.mjs --matchs 8 --virages 4 --heures 2
 *   node scripts/quota.mjs --pire             un soir de Ligue des champions
 */
import { baseDeTest } from './base-de-test.mjs';

const args = process.argv.slice(2);
const opt = (nom, defaut) => {
  const i = args.indexOf(nom);
  return i >= 0 && args[i + 1] !== undefined ? Number(args[i + 1]) : defaut;
};
const a = (nom) => args.includes(nom);

/* ---------------------------------------------------------------- le barème

   Les quatre constantes viennent du code, et non d'une note : `poller.js` pour
   les cadences, `client.js` pour le budget. Les recopier ici aurait fait une
   projection qui se met à mentir au premier réglage changé. */
const { EVENTS_MIN_MS } = await import('../src/server/football/poller.js');

const DIRECT_MS = 20_000;     // poller.js : `liveDelay = live > 0 ? 20_000 : …`
const PAR_PAQUET = 20;        // poller.js : `for (… i += 20)`
const CLASSEMENTS_PAR_JOUR = 4;   // toutes les 6 h
const APPELS_PAR_CLUB = 3;    // fiche + compétitions + calendrier
const BUDGET = 6800;          // client.js : `dailyBudget = 6800`
const QUOTA = 7500;           // l'enveloppe réelle

/**
 * Ce qu'une soirée coûte.
 *
 * `matchs` sont ceux qui tournent **en même temps** ; `virages` ceux dont une
 * salle est occupée — sous-ensemble des premiers, et le seul qui compte pour
 * les relevés.
 */
function projeter({ matchs, virages, heures, competitions, clubs }) {
  const paquets = Math.ceil(matchs / PAR_PAQUET);
  const toursDirect = Math.round((heures * 3600_000) / DIRECT_MS);
  const direct = paquets * toursDirect;

  const relevesParMatch = Math.round((heures * 3600_000) / EVENTS_MIN_MS);
  const releves = Math.min(virages, matchs) * relevesParMatch;

  const classements = competitions * CLASSEMENTS_PAR_JOUR;
  const calendriers = clubs * APPELS_PAR_CLUB;

  return {
    direct, releves, classements, calendriers,
    total: direct + releves + classements + calendriers,
    paquets, toursDirect, relevesParMatch,
  };
}

const ligne = (nom, n, quoi) =>
  `  ${nom.padEnd(14)} ${String(n).padStart(5)}   ${quoi}`;

function afficher(titre, p, e) {
  console.log(`\n${titre}`);
  console.log(`  ${e.matchs} matchs en même temps · ${e.virages} avec un virage occupé · ${e.heures} h`);
  console.log(`  ${e.competitions} compétitions suivies · ${e.clubs} clubs suivis\n`);
  console.log(ligne('direct', p.direct,
    `${p.paquets} paquet(s) × ${p.toursDirect} tours de 20 s`));
  console.log(ligne('relevés', p.releves,
    `${Math.min(e.virages, e.matchs)} match(s) × ${p.relevesParMatch} relevés d’une minute`));
  console.log(ligne('classements', p.classements, `${e.competitions} × 4 fois par jour`));
  console.log(ligne('calendriers', p.calendriers, `${e.clubs} clubs × 3 appels, une fois par jour`));
  console.log(`  ${''.padEnd(14)} ${'—'.padStart(5)}`);
  const part = Math.round((p.total / BUDGET) * 100);
  console.log(ligne('TOTAL', p.total, `${part} % du budget (${BUDGET}), ${
    Math.round((p.total / QUOTA) * 100)} % du quota (${QUOTA})`));

  if (p.total > BUDGET) {
    console.log(`\n  ⚠ Au-dessus du budget. Le client refuserait les appels non critiques,`);
    console.log(`    et un joueur ne pourrait plus chercher son club ce soir-là.`);
  } else if (p.total > BUDGET * 0.7) {
    console.log(`\n  ⚠ Plus des deux tiers du budget sur une seule soirée. Il reste ${
      BUDGET - p.total} appels pour le reste de la journée.`);
  }
}

/* ------------------------------------------------------- ce qui est mesuré

   La projection dit ce qu'on va dépenser ; `api_quota` dit ce qu'on a dépensé.
   Les deux côte à côte valent mieux que chacun seul : une projection qu'aucune
   mesure ne confirme est une hypothèse, et une mesure qu'aucune projection
   n'explique est un nombre. */
async function mesure() {
  try {
    const mysql = await import('mysql2/promise');
    const c = await mysql.createConnection({ uri: baseDeTest() });
    const [rows] = await c.query(
      `SELECT day, used, remaining FROM api_quota ORDER BY day DESC LIMIT 7`);
    await c.end();
    return rows;
  } catch { return null; }
}

/* ------------------------------------------------------------------ la sortie */

if (a('--pire')) {
  /* Un soir de Ligue des champions : seize matchs à 21 h, et disons qu'un
     quart d'entre eux intéresse assez de monde pour qu'un virage s'ouvre. */
  const e = { matchs: 16, virages: 4, heures: 2, competitions: 8, clubs: 40 };
  afficher('UN SOIR DE LIGUE DES CHAMPIONS', projeter(e), e);

  /* Et le cas qui fait vraiment peur : un virage ouvert sur chaque match. */
  const f = { matchs: 16, virages: 16, heures: 2, competitions: 8, clubs: 40 };
  afficher('LE MÊME SOIR, AVEC UN VIRAGE SUR CHAQUE MATCH', projeter(f), f);

  /* Un samedi de championnat : beaucoup de matchs, étalés. */
  const g = { matchs: 10, virages: 6, heures: 8, competitions: 8, clubs: 40 };
  afficher('UN SAMEDI DE CHAMPIONNAT, HUIT HEURES DE MATCHS', projeter(g), g);
} else {
  const e = {
    matchs: opt('--matchs', 4),
    virages: opt('--virages', 2),
    heures: opt('--heures', 2),
    competitions: opt('--competitions', 8),
    clubs: opt('--clubs', 20),
  };
  afficher('PROJECTION', projeter(e), e);
}

/* ================================================= combien de virages tiennent

   C'est **le seul nombre qui compte pour décider d'ouvrir à plus de gens**, et
   c'est celui qu'aucun tableau ne donnait.

   Trois des quatre postes sont fixes : le direct ne dépend pas des joueurs — il
   demande vingt matchs en un appel — et les classements et calendriers non
   plus. Les relevés d'événements, eux, coûtent un appel par minute et par
   virage occupé. C'est donc **le nombre de virages simultanés** qui décide, et
   rien d'autre.

   On le calcule sur la journée la plus longue, pas sur la plus dense : un
   samedi de championnat étale ses matchs sur huit heures, et huit heures de
   relevés coûtent quatre fois deux heures. */
function seuil({ matchs, heures, competitions, clubs }) {
  const p = projeter({ matchs, virages: 0, heures, competitions, clubs });
  const fixe = p.direct + p.classements + p.calendriers;
  const parVirage = Math.round((heures * 3600_000) / EVENTS_MIN_MS);
  return {
    fixe, parVirage,
    tiennent: Math.floor((BUDGET - fixe) / parVirage),
    auQuota: Math.floor((QUOTA - fixe) / parVirage),
  };
}

{
  const e = { matchs: 10, heures: 8, competitions: 8, clubs: 40 };
  const s = seuil(e);
  console.log(`
COMBIEN DE VIRAGES TIENNENT EN MÊME TEMPS
  sur une journée de ${e.heures} h, ${e.competitions} compétitions, ${e.clubs} clubs

  coût fixe        ${String(s.fixe).padStart(5)}   direct, classements, calendriers — indépendant des joueurs
  par virage       ${String(s.parVirage).padStart(5)}   un relevé par minute, pendant toute la journée
                       —
  tiennent         ${String(s.tiennent).padStart(5)}   virages occupés en même temps, dans le budget
  au quota brut    ${String(s.auQuota).padStart(5)}   si l'on renonce à la marge pour les joueurs

  C'est **le seul nombre qui décide** d'ouvrir à plus de monde : le direct
  demande vingt matchs en un appel, et il ne grossit donc pas avec eux. Les
  relevés, si.

  Pour aller au-delà : espacer les relevés. Ils sont à la minute
  (\`EVENTS_MIN_MS\`) ; à deux minutes, le nombre double — au prix d'un but
  annoncé jusqu'à deux minutes après qu'il est marqué, ce qui se voit.`);
}

const m = await mesure();
if (m?.length) {
  console.log('\nCE QUI A ÉTÉ CONSOMMÉ (api_quota)\n');
  for (const r of m) {
    const j = String(r.day).slice(0, 10);
    console.log(`  ${j}   ${String(r.used).padStart(5)} appels`
      + (r.remaining != null ? `   (l’API en annonçait ${r.remaining} restants)` : ''));
  }
} else {
  console.log('\n  (aucune mesure en base — la table api_quota est vide ou injoignable)');
}

console.log(`
  Les cadences viennent du code : poller.js pour les intervalles, client.js pour
  le budget. Changer l'une d'elles change ce tableau sans qu'on y touche.
`);
