/**
 * Simuler une saison entière avec cent joueurs (demande de Gaël, 30 octobre
 * 2026 : « voir si notre application tient la route »).
 *
 * `simuler-parties.mjs` fait jouer **une** partie avec les vrais moteurs. Ce
 * script-ci fait vivre **sept mois** : du 1er novembre 2026 au 31 mai 2027,
 * la Saison 1 entière puis les deux premiers mois de la Saison 2, sur le vrai
 * calendrier 2026-2027 de neuf championnats. Cent joueurs de cinq sortes y
 * ouvrent leurs boosters, font grandir leurs Fanzzy, jouent leurs duels
 * classés et d'entraînement, vont au Virage quand leur club joue, remplissent
 * leurs missions et leur carnet.
 *
 *   node scripts/simuler-saison.mjs                    rapport à l'écran
 *   node scripts/simuler-saison.mjs --graine=7         un autre tirage
 *   node scripts/simuler-saison.mjs --joueurs=300      une autre population
 *   node scripts/simuler-saison.mjs --sortie=x.json    tous les chiffres en JSON
 *
 * ## Ce qui vient du jeu, et ce qui est supposé
 *
 * **Du jeu**, importé ou relu dans le source (le script s'arrête si l'un a
 * bougé) : le tirage des boosters place par place, la recharge et la réserve,
 * les prix, les évolutions, les doublons, les barèmes du duel et de l'XP, les
 * niveaux, les missions du jour et leurs conditions, le carnet de saison, les
 * crans de collection, la carte de présence, les divisions, la cote, la règle
 * du championnat des clubs (3/1/0, part du neutre, plancher), les plafonds du
 * joueur gratuit et ce que l'abonnement ouvre.
 *
 * **Des vrais moteurs**, par `simulation/etalon.json` (que
 * `simuler-parties.mjs etalon` refait) : qui gagne un 1v1 selon le niveau, la
 * ferveur d'un duel, ce que poussent les petites tribunes du Virage.
 *
 * **Du vrai football** : `simulation/calendrier-2026-27/`, le calendrier
 * d'openfootball (domaine public), avec les vrais scores joués jusqu'au 30
 * octobre ; la suite est tirée au hasard selon la force de chaque club. Le
 * championnat suisse n'y est pas : il est reconstitué (douze clubs, 38
 * journées, trêve d'hiver).
 *
 * **Supposé**, et dit comme tel dans le rapport : qui sont les joueurs, quand
 * ils viennent, combien de temps ils restent, quel club ils suivent, quand ils
 * décrochent. Ces nombres sont dans `PROFILS` et `LIGUES`, en tête de fichier.
 *
 * Aucune base, aucun réseau. Ce n'est pas une suite : rien ne rougit.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (nom, defaut) => args.find((a) => a.startsWith(`--${nom}=`))?.split('=')[1] ?? defaut;
const GRAINE = Number(opt('graine', 2026));
const NB_JOUEURS = Number(opt('joueurs', 100));
const SORTIE = opt('sortie', null);

/* --------------------------------------------------------------- hasard */
let graine = GRAINE >>> 0 || 1;
const hasard = () => {
  graine ^= graine << 13; graine >>>= 0; graine ^= graine >>> 17; graine ^= graine << 5; graine >>>= 0;
  return graine / 4294967296;
};
Math.random = hasard;
const rnd = (t) => t[Math.floor(hasard() * t.length)];
const entre = (a, b) => a + hasard() * (b - a);
const entier = (a, b) => Math.floor(entre(a, b + 1));
const gauss = () => {
  let u = 0; let v = 0;
  while (!u) u = hasard();
  while (!v) v = hasard();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};
const poisson = (l) => { let k = 0; let p = 1; const L = Math.exp(-l); do { k++; p *= hasard(); } while (p > L); return k - 1; };
const pondere = (paires) => {
  const tot = paires.reduce((s, [, w]) => s + w, 0);
  let r = hasard() * tot;
  for (const [x, w] of paires) { r -= w; if (r <= 0) return x; }
  return paires[paires.length - 1][0];
};
const logistique = (x) => 1 / (1 + Math.exp(-x));

/* ------------------------------------------------------- les règles du jeu */
const { DEFAUTS } = await import('../src/shared/reglages.js');
const { DEX, SCARVES, POIGNEE_DE_REPLI, EVO_COST } = await import('../src/shared/fanzzy/dex.js');
const { STUFF, SKINS } = await import('../src/shared/fanzzy/inventaire.js');
const { ACTIONS } = await import('../src/shared/duel/actions.js');
const { STADES, STADE_DEFAUT } = await import('../src/shared/stades.js');
const { ETATS_DESSINES } = await import('../src/shared/fanzzy/rendus.js');
const N = await import('../src/shared/niveau.js');
const { GAIN, DOUBLE_CLUB, primeDeFormat } = await import('../src/server/deck/index.js');
const COTE = await import('../src/shared/cote.js');
const SAISON = await import('../src/shared/saison.js');
const { CARNET_TRIMESTRE, SAISONS_PREVUES } = await import('../src/shared/saisons-prevues.js');
const { MISSIONS } = await import('../src/shared/quotidien.js');
const R = (cle) => DEFAUTS[cle];

/* Ce que le serveur ne rend pas importable : relu dans le source, comme
   `economie.mjs`. Un motif introuvable arrête tout — une simulation sur des
   règles périmées ne se trompe pas un peu, elle se trompe entièrement. */
const PLACES_OUVERTES = [['action', 0.24], ['stuff', 0.23], ['skin', 0.14], ['etat', 0.12],
  ['lieu', 0.05], ['ultime', 0.04], ['echarpes', 0.18]];
const POIGNEES = [[6, 0.55], [14, 0.33], [30, 0.12]];
const CHANCE_DEUXIEME = 0.7;
{
  const src = readFileSync(new URL('../src/server/fanzzy/index.js', import.meta.url), 'utf8');
  const attendus = [
    ...PLACES_OUVERTES.map(([c, p]) => [`['${c}', ${p}]`, `la part « ${c} » des places ouvertes`]),
    [`const POIGNEES = [[${POIGNEES.map((p) => p.join(', ')).join('], [')}]];`, 'les poignées d’écharpes'],
    [`Math.random() >= ${CHANCE_DEUXIEME})`, 'la chance de la deuxième place'],
    ["const OBJETS = { objet: [['commune', 0.85], ['legendaire', 0.15]] };", 'la rareté des objets'],
  ];
  const perdus = attendus.filter(([m]) => !src.includes(m));
  if (perdus.length) {
    console.error('\nLa simulation ne correspond plus au serveur :');
    for (const [m, q] of perdus) console.error(`  ${q} — « ${m} » introuvable`);
    process.exit(1);
  }
}
const ETALON = JSON.parse(readFileSync(new URL('./simulation/etalon.json', import.meta.url), 'utf8'));

/* ------------------------------------------------------------ le calendrier

   Les dates du jeu : la Saison 1 va du lancement au 31 mars 2027
   (`remise-a-zero-saison1.mjs`), la Saison 2 ouvre le 1er avril. */
const DEBUT = '2026-11-01';
const FIN = '2027-05-31';
const FIN_S1 = '2027-03-31';
const jourSuivant = (j) => new Date(Date.parse(`${j}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
const joursEntre = (a, b) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
const jourSemaine = (j) => new Date(`${j}T12:00:00Z`).getUTCDay();

/* Neuf championnats, connus et moins connus. `part` : la part des joueurs
   dont c'est le club principal — un jeu suisse, en cinq langues, ouvert à
   tous (supposé). `populaires` : les clubs les plus suivis d'abord. */
const LIGUES = [
  { code: 'en.1', nom: 'Premier League', connu: true, part: 0.24, decalage: 60, serie: 'AN',
    populaires: ['Manchester United FC', 'Liverpool FC', 'Arsenal FC', 'Chelsea FC', 'Manchester City FC',
      'Tottenham Hotspur FC', 'Newcastle United FC', 'Aston Villa FC', 'Everton FC', 'Leeds United FC'] },
  { code: 'fr.1', nom: 'Ligue 1', connu: true, part: 0.16,
    populaires: ['Paris Saint-Germain FC', 'Olympique de Marseille', 'Olympique Lyonnais', 'AS Monaco FC',
      'Lille OSC', 'Racing Club de Lens', 'OGC Nice', 'Stade Rennais FC 1901', 'RC Strasbourg Alsace'] },
  { code: 'es.1', nom: 'Liga', connu: true, part: 0.14,
    populaires: ['Real Madrid CF', 'FC Barcelona', 'Club Atlético de Madrid', 'Sevilla FC', 'Valencia CF',
      'Athletic Club', 'Real Betis Balompié', 'Villarreal CF'] },
  { code: 'it.1', nom: 'Serie A', connu: true, part: 0.09,
    populaires: ['Juventus FC', 'AC Milan', 'FC Internazionale Milano', 'SSC Napoli', 'AS Roma', 'SS Lazio',
      'ACF Fiorentina', 'Atalanta BC'] },
  { code: 'de.1', nom: 'Bundesliga', connu: true, part: 0.08,
    populaires: ['FC Bayern München', 'Borussia Dortmund', 'FC Schalke 04', 'Bayer 04 Leverkusen',
      'Eintracht Frankfurt', 'Hamburger SV', 'VfB Stuttgart', 'SV Werder Bremen'] },
  { code: 'ch.1', nom: 'Super League suisse', connu: false, part: 0.15, serie: 'SU', reconstitue: true,
    populaires: ['FC Bâle', 'BSC Young Boys', 'Servette FC', 'FC Sion', 'FC Lausanne-Sport', 'FC Zurich',
      'FC Lucerne', 'FC Saint-Gall', 'FC Lugano', 'Grasshopper Club', 'FC Thoune', 'FC Vaduz'] },
  { code: 'en.2', nom: 'Championship', connu: false, part: 0.04, decalage: 60, populaires: [] },
  { code: 'nl.1', nom: 'Eredivisie', connu: false, part: 0.04,
    populaires: ['AFC Ajax', 'PSV', 'Feyenoord'] },
  { code: 'pt.1', nom: 'Liga Portugal', connu: false, part: 0.06, decalage: 60,
    populaires: ['SL Benfica', 'FC Porto', 'Sporting CP', 'SC Braga'] },
];

const heureParDefaut = (j) => {
  const d = jourSemaine(j);
  if (d === 6) return rnd(['15:00', '17:30', '18:00', '20:00', '21:00']);
  if (d === 0) return rnd(['14:00', '15:00', '16:30', '18:00', '20:45']);
  return rnd(['19:00', '20:00', '20:45', '21:00']);
};
const enMinutes = (h, decalage = 0) => {
  const [a, b] = h.split(':').map(Number);
  return Math.min(23 * 60, a * 60 + b + decalage);
};

/** Le championnat suisse 2026-2027, reconstitué : 33 journées puis 5 de
    poule, un week-end sur deux en semaine pendant l'automne, trêve du 14
    décembre au 30 janvier. */
function suisse() {
  const clubs = LIGUES.find((l) => l.code === 'ch.1').populaires;
  const n = clubs.length;
  const tours = [];
  for (let r = 0; r < n - 1; r++) {
    const t = [];
    for (let i = 0; i < n / 2; i++) {
      const a = (r + i) % (n - 1);
      let b = (n - 1 - i + r) % (n - 1);
      if (i === 0) b = n - 1;
      t.push(r % 2 ? [clubs[b], clubs[a]] : [clubs[a], clubs[b]]);
    }
    tours.push(t);
  }
  const tous = [...tours, ...tours.map((t) => t.map(([a, b]) => [b, a])), ...tours].slice(0, 33);
  for (let k = 0; k < 5; k++) tous.push(tours[(k * 3) % tours.length].map(([a, b]) => (k % 2 ? [b, a] : [a, b])));
  const matches = [];
  let date = '2026-07-25';
  for (const [i, t] of tous.entries()) {
    while (date >= '2026-12-14' && date < '2027-01-30') date = jourSuivant(date);
    for (const [a, b] of t) {
      const j = hasard() < 0.6 ? date : jourSuivant(date);
      matches.push({ round: `Journée ${i + 1}`, date: j, time: rnd(['18:00', '20:30', '14:00', '16:30']),
        team1: a, team2: b });
    }
    date = joursEntre(date, '2027-05-30') > 7 ? new Date(Date.parse(`${date}T12:00:00Z`) + 7 * 86_400_000)
      .toISOString().slice(0, 10) : date;
  }
  return { name: 'Swiss Super League 2026/27 (reconstituée)', matches };
}

/* La force d'un club : ses buts marqués et encaissés jusqu'ici, mêlés à un
   a priori de 1 (le club moyen), pour tirer les scores à venir. */
const MATCHS = [];          // { id, ligue, dom, ext, jour, minute, buts:[a,b], joue }
const CLUBS = new Map();    // nom → { nom, ligue, id }
let prochainId = 1;
for (const L of LIGUES) {
  const brut = L.reconstitue ? suisse()
    : JSON.parse(readFileSync(new URL(`./simulation/calendrier-2026-27/${L.code}.json`, import.meta.url), 'utf8'));
  L.titre = brut.name;
  const force = new Map();
  for (const m of brut.matches) {
    for (const t of [m.team1, m.team2]) {
      if (!CLUBS.has(t)) CLUBS.set(t, { id: prochainId++, nom: t, ligue: L.code });
      if (!force.has(t)) force.set(t, { pour: 2, contre: 2, n: 2 });
    }
    if (m.score?.ft) {
      const [a, b] = m.score.ft;
      const fa = force.get(m.team1); const fb = force.get(m.team2);
      fa.pour += a; fa.contre += b; fa.n++; fb.pour += b; fb.contre += a; fb.n++;
    }
  }
  /* Le reconstitué n'a pas de résultats : les gros clubs y sont un peu plus
     forts, selon leur rang de popularité. */
  if (L.reconstitue) {
    L.populaires.forEach((t, i) => { const f = force.get(t); f.pour += (12 - i) * 0.4; f.contre += i * 0.4; });
  }
  for (const m of brut.matches) {
    const fa = force.get(m.team1); const fb = force.get(m.team2);
    let buts = m.score?.ft ?? null;
    const joue = Boolean(buts);
    if (!buts) {
      const la = 1.45 * (fa.pour / fa.n) / 1.3 * (fb.contre / fb.n) / 1.3;
      const lb = 1.15 * (fb.pour / fb.n) / 1.3 * (fa.contre / fa.n) / 1.3;
      buts = [poisson(Math.max(0.2, la)), poisson(Math.max(0.2, lb))];
    }
    MATCHS.push({ id: MATCHS.length + 1, ligue: L.code, dom: m.team1, ext: m.team2, jour: m.date,
      minute: enMinutes(m.time ?? heureParDefaut(m.date), L.decalage ?? 0), buts, joue, round: m.round });
  }
}
const MATCHS_DU_JOUR = new Map();
for (const m of MATCHS) {
  if (!MATCHS_DU_JOUR.has(m.jour)) MATCHS_DU_JOUR.set(m.jour, []);
  MATCHS_DU_JOUR.get(m.jour).push(m);
}
/* Les jours sans match dans ces neuf championnats, le jeu propose quand même
   les matchs du monde entier (la journée d'API-Football) : un match « d'un
   autre championnat » tient lieu de support, et ses points vont à des clubs
   hors de ce rapport. */
const AUTRES = { code: 'autres', nom: 'Autres championnats', populaires: [], part: 0 };
for (const t of ['Autre club A', 'Autre club B']) CLUBS.set(t, { id: prochainId++, nom: t, ligue: 'autres' });
const LIGUE_DE = new Map([...LIGUES, AUTRES].map((l) => [l.code, l]));
const popularite = (club) => {
  const L = LIGUE_DE.get(CLUBS.get(club).ligue);
  const i = L.populaires.indexOf(club);
  return i >= 0 ? 6 / Math.pow(i + 1, 0.8) : 0.35;
};

/* ---------------------------------------------------------- le catalogue

   Les séries ouvertes au lancement : LA REPRISE et LES TERRACES (en ligne),
   DIE KURVE (dans main, à ouvrir dans /admin). La Saison 2 ouvre LES HÉROS
   DU CANAPÉ (`saisons-prevues.js`) le 1er avril. */
const SERIES_S1 = ['RP', 'AN', 'SU'];
const SERIE_S2 = SAISONS_PREVUES.find((s) => s.numero === 2);
const SERIES_S2 = [...SERIES_S1, ...SERIE_S2.series];
const TENUES = SKINS.filter((s) => s.id !== 'base' && s.publie !== false).map((s) => s.id);
const LIGNEES = new Map();  // id du stade 1 → { id, set, rar, ages }
for (const f of DEX) {
  if (f.stage !== 1 || f.publie === false) continue;
  let ages = 1; let x = f;
  while (x.evo) { ages++; x = DEX.find((y) => y.id === x.evo); }
  LIGNEES.set(f.id, { id: f.id, set: f.set, rar: f.rar, ages });
}
const lignesDe = (set) => [...LIGNEES.values()].filter((l) => l.set === set);
const STUFF_S1 = STUFF.filter((s) => s.publie !== false || s.id.startsWith('an-'));
const STUFF_S2 = [...STUFF_S1, ...STUFF.filter((s) => SERIE_S2.stuff && s.id.startsWith(SERIE_S2.stuff))];
const ACTIONS_TIRABLES = ACTIONS.filter((a) => a.publie !== false && a.rar !== 'commune');
const LIEUX = STADES.filter((s) => s.publie !== false && s.id !== STADE_DEFAUT);

/* Le carnet de la Saison 1, recalé sur ses jours comme le fait le script de
   remise à zéro ; celui de la Saison 2 est celui d'un trimestre. */
const carnetRecale = (jours) => {
  let avant = 0;
  return SAISON.CARNET_DEFAUT.map((p) => {
    const tampons = Math.max(avant + 1, Math.round((p.tampons * jours) / 63 / 5) * 5);
    avant = tampons;
    return { ...p, tampons };
  });
};
const CARNETS = { S1: carnetRecale(joursEntre(DEBUT, FIN_S1) + 1), S2: CARNET_TRIMESTRE };
const SEUILS = SAISON.seuilsDivisions();

/* ------------------------------------------------------------- les joueurs

   Les cinq sortes que Gaël a nommées. Tout est supposé, et tout est ici :
   `actif` la chance de venir un jour donné, `sessions` combien de fois,
   `duree` en minutes, `duels` le nombre de duels tentés par séance,
   `etal` la chance de passer à l'étal quand il a de quoi, `achete` celle d'acheter des boosters,
   `virage` la chance de venir au Virage d'un match de son club,
   `minutesVirage` combien il y reste, `jeux` les écharpes des mini-jeux
   qu'il va chercher, `niveau` son niveau de jeu de départ (0 débutant,
   1 moyen, 2 bon, 3 expert), `decroche` la chance de partir pour de bon
   dans le mois, `inscrits` la part inscrite au lancement (les autres
   arrivent jusqu'à fin janvier). */
const PROFILS = {
  occasionnel: { part: 0.30, abonne: false, actif: 0.30, sessions: [1, 1], duree: [6, 14], duels: [0, 1],
    virage: 0.22, minutesVirage: [10, 30], jeux: 8, prono: 0.3, niveau: 0.2, decroche: 0.22,
    suivis: 1, neutre: 0, achete: 0, etal: 0.3, missions: 0.55, inscrits: 0.5 },
  gratuit: { part: 0.30, abonne: false, actif: 0.62, sessions: [1, 2], duree: [10, 22], duels: [1, 3],
    virage: 0.4, minutesVirage: [20, 50], jeux: 20, prono: 0.6, niveau: 0.7, decroche: 0.09,
    suivis: 2, neutre: 0.05, achete: 0.05, etal: 0.7, missions: 0.85, inscrits: 0.6 },
  assidu: { part: 0.15, abonne: false, actif: 0.9, sessions: [2, 3], duree: [15, 30], duels: [2, 4],
    virage: 0.65, minutesVirage: [35, 80], jeux: 35, prono: 0.9, niveau: 1.2, decroche: 0.04,
    suivis: 3, neutre: 0.15, achete: 0.2, etal: 1, missions: 1, inscrits: 0.7 },
  abonne: { part: 0.15, abonne: true, actif: 0.82, sessions: [2, 3], duree: [15, 30], duels: [2, 5],
    virage: 0.6, minutesVirage: [30, 75], jeux: 30, prono: 0.85, niveau: 1.0, decroche: 0.035,
    suivis: 4, neutre: 0.15, achete: 0.3, etal: 1, missions: 1, inscrits: 0.7 },
  tryhard: { part: 0.10, abonne: true, actif: 0.97, sessions: [4, 6], duree: [25, 45], duels: [3, 7],
    virage: 0.9, minutesVirage: [75, 95], jeux: 40, prono: 1, niveau: 2.1, decroche: 0.015,
    suivis: 6, neutre: 0.45, achete: 1, etal: 1, missions: 1, inscrits: 0.85 },
};
const NOMS_PROFILS = Object.keys(PROFILS);
const LIBELLE = { occasionnel: 'Occasionnel', gratuit: 'Non abonné', assidu: 'Assidu',
  abonne: 'Abonné', tryhard: 'Tryhardeur' };

const clubsParLigue = new Map(LIGUES.map((L) => [L.code, [...CLUBS.values()].filter((c) => c.ligue === L.code)]));
function tirerClub(ligue = null) {
  const L = ligue ? LIGUE_DE.get(ligue) : pondere(LIGUES.map((x) => [x, x.part]));
  return pondere(clubsParLigue.get(L.code).map((c) => [c.nom, popularite(c.nom)]));
}
function grosClubAilleurs(sauf) {
  const L = pondere(LIGUES.filter((x) => x.connu).map((x) => [x, x.part]));
  const c = pondere(clubsParLigue.get(L.code).map((x) => [x.nom, popularite(x.nom) ** 2]));
  return sauf.includes(c) ? null : c;
}

/* Une place de collection : ce qu'un âge débloque, et que le booster tire
   parmi ce qui manque (`tirerAutreChose`). Une liste par catégorie, où l'on
   retire en échangeant avec le dernier : tirer reste uniforme sans
   reconstruire la liste à chaque booster. */
class Manques {
  constructor() { this.t = []; }
  ajouter(x) { this.t.push(x); }
  tirer() {
    if (!this.t.length) return null;
    const i = Math.floor(hasard() * this.t.length);
    const x = this.t[i];
    this.t[i] = this.t[this.t.length - 1];
    this.t.pop();
    return x;
  }
  retirer(pred) {
    const i = this.t.findIndex(pred);
    if (i < 0) return null;
    const x = this.t[i]; this.t[i] = this.t[this.t.length - 1]; this.t.pop();
    return x;
  }
  get n() { return this.t.length; }
}

function nouveauJoueur(i, profil, jourInscription) {
  const P = PROFILS[profil];
  const principal = tirerClub();
  const p = {
    id: `J${String(i + 1).padStart(3, '0')}`, profil, P, abonne: P.abonne, inscrit: jourInscription,
    parti: null, principal, suivis: [principal],
    niveauJeu: Math.max(0, Math.min(3, P.niveau + gauss() * 0.4)), duelsJoues: 0,
    xp: 0, niveau: 1, echarpes: 0, packs: R('pack.depart'), dernierePrise: null,
    // La collection.
    fanzzy: new Map(),   // id → stade atteint
    etats: 0, tenues: 0, ultimes: 0, stuff: new Set(), actions: new Set(), lieux: new Set(),
    mSkin: new Manques(), mEtat: new Manques(), mUltime: new Manques(),
    // L'argent du jeu, par source.
    gagne: {}, depense: {},
    packsOuverts: 0, packsAchetes: 0, packsGratuits: 0, replis: 0, placesOuvertes: 0,
    nouveautes: [],      // jour → objets neufs ce jour-là
    crans: 0, seriesCompletes: new Set(),
    carte: 0, dernierJour: null,
    tampons: { S1: 0, S2: 0 }, paliers: { S1: 0, S2: 0 },
    ferveur: { S1: 0, S2: 0 }, cote: COTE.COTE_DEPART, classes: 0,
    stats: { duelsClasses: 0, duelsHumains: 0, duelsBots: 0, victoires: 0, virages: 0, viragesClasses: 0,
      joursActifs: 0, sessions: 0, minutes: 0, missions: 0, sachets: 0, evolutions: 0, achatsEtal: 0,
      attentesVaines: 0, joursPlafond: 0 },
  };
  /* Le paquet de bienvenue : un premier Fanzzy choisi dans la série de son
     club si elle existe, une pièce, des cartes. */
  const serie = LIGUE_DE.get(CLUBS.get(principal).ligue).serie ?? 'RP';
  gagnerFanzzy(p, rnd(lignesDe(serie).filter((l) => l.rar === 'commune')).id, null);
  p.stuff.add(rnd(STUFF_S1.filter((s) => s.rar === 'commune')).id);
  return p;
}

const credit = (p, source, n) => { p.echarpes += n; p.gagne[source] = (p.gagne[source] ?? 0) + n; };
const debit = (p, quoi, n) => { p.echarpes -= n; p.depense[quoi] = (p.depense[quoi] ?? 0) + n; };
const neuf = (p, jour, n = 1) => { p.nouveautesDuJour = (p.nouveautesDuJour ?? 0) + n; };

function ouvrirAge(p, id, stade) {
  for (const t of TENUES) p.mSkin.ajouter(`${id}:${stade}:${t}`);
  for (const e of ETATS_DESSINES) p.mEtat.ajouter(`${id}:${stade}:${e}`);
  p.mUltime.ajouter(`${id}:${stade}`);
}
function gagnerFanzzy(p, id) {
  p.fanzzy.set(id, 1);
  ouvrirAge(p, id, 1);
}

/* --------------------------------------------------------------- le booster

   `drawPack` et `tirerAutreChose`, place par place. */
const xLegende = 1 - Math.sqrt(1 - R('pack.legendaire_fanzzy') / 100);
const parPlaceStuff = 1 - Math.pow(1 - R('pack.legendaire_stuff') / 100, 1 / 3);
const pLegStuff = Math.min(1, parPlaceStuff / PLACES_OUVERTES.find(([c]) => c === 'stuff')[1]);
const objetLegendaire = () => hasard() < 0.15;

function ouvrirBooster(p, serie, ctx) {
  const base = lignesDe(serie);
  const communes = base.filter((l) => l.rar === 'commune');
  const legendes = base.filter((l) => l.rar === 'legendaire');
  p.packsOuverts++;
  ctx.boosters = (ctx.boosters ?? 0) + 1;
  for (let i = 0; i < 5; i++) {
    const supporter = i === 0 || (i === 1 && hasard() < CHANCE_DEUXIEME);
    if (supporter) {
      const leg = hasard() < xLegende && legendes.length;
      const l = rnd(leg ? legendes : communes);
      if (p.fanzzy.has(l.id)) credit(p, 'doublons', SCARVES[l.rar] ?? 1);
      else { gagnerFanzzy(p, l.id); neuf(p); }
      continue;
    }
    p.placesOuvertes++;
    const cat = pondere(PLACES_OUVERTES);
    const repli = () => { p.replis++; credit(p, 'replis', POIGNEE_DE_REPLI); };
    if (cat === 'echarpes') { credit(p, 'poignees', pondere(POIGNEES)); continue; }
    if (cat === 'skin') { if (p.mSkin.tirer()) { p.tenues++; neuf(p); } else repli(); continue; }
    if (cat === 'etat') { if (p.mEtat.tirer()) { p.etats++; neuf(p); } else repli(); continue; }
    if (cat === 'ultime') { if (p.mUltime.tirer()) { p.ultimes++; neuf(p); } else repli(); continue; }
    if (cat === 'stuff') {
      const ouvert = ctx.stuff;
      const leg = hasard() < pLegStuff;
      const libres = ouvert.filter((s) => !p.stuff.has(s.id) && (s.rar === 'legendaire') === leg);
      if (libres.length) { p.stuff.add(rnd(libres).id); neuf(p); } else credit(p, 'doublons', SCARVES[rnd(ouvert).rar] ?? 1);
      continue;
    }
    if (cat === 'lieu') {
      const libres = LIEUX.filter((l) => !p.lieux.has(l.id));
      const vise = objetLegendaire() ? 'legendaire' : 'commune';
      const def = libres.find((l) => l.rar === vise) ?? (libres.length ? rnd(libres) : null);
      if (def) { p.lieux.add(def.id); neuf(p); } else credit(p, 'doublons', SCARVES[rnd(LIEUX).rar] ?? 1);
      continue;
    }
    const libres = ACTIONS_TIRABLES.filter((a) => !p.actions.has(a.id));
    if (!libres.length) { repli(); continue; }
    const vise = objetLegendaire() ? 'legendaire' : 'commune';
    const parmi = libres.filter((a) => a.rar === vise);
    p.actions.add(rnd(parmi.length ? parmi : libres).id);
    neuf(p);
  }
  gagnerXp(p, R('xp.pack'));
}

/* Où le joueur ouvre ses boosters : la série de son club tant qu'il lui
   manque des têtes, puis celle où il en manque le plus. */
function serieVisee(p, ouvertes) {
  const club = LIGUE_DE.get(CLUBS.get(p.principal).ligue).serie;
  const manque = (s) => lignesDe(s).filter((l) => !p.fanzzy.has(l.id)).length;
  if (club && ouvertes.includes(club) && manque(club) > 0) return club;
  return ouvertes.reduce((a, b) => (manque(b) > manque(a) ? b : a));
}

/* ------------------------------------------------------------- la progression */
function gagnerXp(p, n) {
  p.xp += n;
  const avant = p.niveau;
  p.niveau = N.niveauPour(p.xp);
  for (let k = avant + 1; k <= p.niveau; k++) credit(p, 'niveaux', N.ecarpesDuPalier(k));
}
const slots = (p) => N.droits(p.niveau).slots + (p.abonne ? R('abo.clubs_en_plus') : 0);

/* Dépenser : faire grandir d'abord (le moins cher), puis l'étal pour qui le
   fréquente, puis des boosters pour le tryhardeur à court. */
function depenser(p, ctx) {
  let fait = true;
  while (fait) {
    fait = false;
    let mieux = null;
    for (const [id, st] of p.fanzzy) {
      const l = LIGNEES.get(id);
      if (st >= l.ages) continue;
      const cout = EVO_COST[st + 1];
      if (cout <= p.echarpes && (!mieux || cout < mieux.cout)) mieux = { id, st, cout };
    }
    if (mieux) {
      debit(p, 'evolutions', mieux.cout);
      p.fanzzy.set(mieux.id, mieux.st + 1);
      ouvrirAge(p, mieux.id, mieux.st + 1);
      p.stats.evolutions++; ctx.evolutions = (ctx.evolutions ?? 0) + 1;
      neuf(p);
      fait = true;
    }
  }
  if (hasard() < p.P.etal) {
    const reserve = 150;
    while (p.echarpes - R('etal.tenue') >= reserve && p.mSkin.n && hasard() < 0.5) {
      p.mSkin.tirer(); p.tenues++; debit(p, 'etal', R('etal.tenue')); p.stats.achatsEtal++; neuf(p);
    }
    while (p.echarpes - R('etal.ultime') >= reserve * 2 && p.mUltime.n && hasard() < 0.3) {
      p.mUltime.tirer(); p.ultimes++; debit(p, 'etal', R('etal.ultime')); p.stats.achatsEtal++; neuf(p);
    }
  }
}

/* Les crans : tout ce qu'un booster peut donner, sauf les tenues (voir le
   pavé de `fanzzy/index.js`), et les séries complètes. */
function collectionDe(p) {
  let cartes = 0;
  for (const st of p.fanzzy.values()) cartes += st;
  return cartes + p.etats + p.ultimes + p.stuff.size + p.actions.size + p.lieux.size;
}
function reclamerCollection(p, ouvertes) {
  const atteint = Math.floor(collectionDe(p) / R('collection.cran'));
  while (p.crans < atteint) {
    p.crans++;
    credit(p, 'collection', R('collection.cran_echarpes'));
    if (p.crans % R('collection.cran_booster_tous') === 0) p.packs++;
  }
  for (const s of ouvertes) {
    if (p.seriesCompletes.has(s)) continue;
    if (lignesDe(s).every((l) => (p.fanzzy.get(l.id) ?? 0) >= l.ages)) {
      p.seriesCompletes.add(s);
      credit(p, 'collection', R('collection.serie_echarpes'));
      p.packs += R('collection.serie_packs');
    }
  }
}

/* ------------------------------------------------------------- les duels

   Le niveau de jeu décide presque tout, comme dans le moteur : un débutant
   ne prend pas un duel à un joueur moyen (`etalon.json`). La pente se règle
   sur l'étalon : un écart d'un niveau ≈ 98 %, d'un quart ≈ 73 %. */
const PENTE = 4;
/* Le supporter de l'étalon chante sans pause, au rythme d'un joueur
   appliqué. Un vrai joueur, au téléphone, lâche plus souvent : sa ferveur
   est prise à 60 % de celle du moteur (supposé, et dit dans le rapport). */
const HUMAIN = 0.6;
const NIVEAUX = ['debutant', 'moyen', 'bon', 'expert'];
const ferveurDuel = (s) => {
  const t = NIVEAUX.map((n) => ETALON.duels[`${n}-${n}`]);
  const v = t.map((x) => (x.ferveurA + x.ferveurB) / 2);
  const i = Math.min(2, Math.floor(s)); const f = s - i;
  return v[i] * (1 - f) + v[i + 1] * f;
};
/* Le Virage, ferveur par minute de présence : les petites tribunes de
   l'étalon (90 minutes chantées sans pause, déjà partagées par
   `virage.tribune_min`). */
const ferveurVirageMinute = (s) => [30, 50, 80, 95][Math.min(3, Math.round(s))]
  * (0.85 + 0.3 * (s - Math.floor(s)));
const progres = (p) => Math.min(3, p.niveauJeu + 0.5 * (1 - Math.exp(-p.duelsJoues / 120)));

/* --------------------------------------------------------- le classement */
const LIGNES_CLUBS = [];    // { saison, club, joueur, neutre, issue, quand, source }
const SAISON_DE = (jour) => (jour <= FIN_S1 ? 'S1' : 'S2');

/* ================================================================== la vie */
const joueurs = [];
{
  const repartition = NOMS_PROFILS.flatMap((k) => Array(Math.round(PROFILS[k].part * NB_JOUEURS)).fill(k));
  while (repartition.length < NB_JOUEURS) repartition.push('gratuit');
  repartition.length = NB_JOUEURS;
  repartition.forEach((k, i) => {
    const tard = hasard() > PROFILS[k].inscrits;
    const jour = tard ? new Date(Date.parse(`${DEBUT}T12:00:00Z`) + entier(1, 90) * 86_400_000)
      .toISOString().slice(0, 10) : DEBUT;
    joueurs.push(nouveauJoueur(i, k, jour));
  });
}

const journal = { jours: [], attentes: [], duelsParHeure: Array(24).fill(0).map(() => ({ humains: 0, bots: 0, vains: 0 })),
  virages: [], hebdo: [], bots: {}, parHeure: Array(24).fill(0).map(() => ({ trouve: 0, personne: 0 })) };
const heuresSoir = [[8, 1], [9, 1], [10, 1], [11, 1], [12, 3], [13, 3], [14, 1.5], [15, 1.5], [16, 2], [17, 3],
  [18, 5], [19, 7], [20, 8], [21, 8], [22, 5], [23, 2], [7, 1.5]];

for (let jour = DEBUT; jour <= FIN; jour = jourSuivant(jour)) {
  const saison = SAISON_DE(jour);
  const ouvertes = saison === 'S1' ? SERIES_S1 : SERIES_S2;
  const ctx = { stuff: saison === 'S1' ? STUFF_S1 : STUFF_S2 };
  const matchs = MATCHS_DU_JOUR.get(jour) ?? [{ id: `X${jour}`, ligue: 'autres', dom: 'Autre club A',
    ext: 'Autre club B', jour, minute: 20 * 60, buts: [1, 1], joue: false }];
  const parClub = new Map();
  for (const m of matchs) { parClub.set(m.dom, m); parClub.set(m.ext, m); }
  const affiche = matchs.slice().sort((a, b) => (popularite(b.dom) + popularite(b.ext))
    - (popularite(a.dom) + popularite(a.ext)))[0] ?? null;

  /* Qui vient aujourd'hui, et quand. */
  const presents = [];
  for (const p of joueurs) {
    if (p.inscrit > jour || p.parti) continue;
    const P = p.P;
    const sesClubs = p.suivis.map((c) => parClub.get(c)).filter(Boolean);
    const matchDuClub = sesClubs.length > 0;
    const actif = hasard() < Math.min(1, P.actif * (matchDuClub ? 1.35 : 1) * (jour === p.inscrit ? 9 : 1));
    if (!actif) { p.carteRompue = true; continue; }
    const sessions = [];
    const n = entier(P.sessions[0], P.sessions[1]);
    for (let k = 0; k < n; k++) {
      const h = pondere(heuresSoir);
      sessions.push({ debut: h * 60 + entier(0, 59), duree: entre(...P.duree) });
    }
    /* Le Virage : on vient pour le match de son club, à l'heure du match. */
    const virages = [];
    for (const m of sesClubs) {
      const principal = m.dom === p.principal || m.ext === p.principal;
      if (hasard() < P.virage * (principal ? 1 : 0.5)) {
        const minutes = Math.min(95, entre(...P.minutesVirage));
        virages.push({ m, minutes, neutre: false, side: p.suivis.includes(m.dom) ? 0 : 1 });
        sessions.push({ debut: m.minute + entier(-5, 30), duree: minutes + 5, virage: true });
      }
    }
    if (!virages.length && affiche && hasard() < P.neutre * 0.5) {
      const minutes = entre(...P.minutesVirage) * 0.7;
      virages.push({ m: affiche, minutes, neutre: true, side: hasard() < 0.5 ? 0 : 1 });
      sessions.push({ debut: affiche.minute, duree: minutes, virage: true });
    }
    sessions.sort((a, b) => a.debut - b.debut);
    presents.push({ p, sessions, virages, act: { boosters: 0, duels: 0, classes: 0, victoires: 0, clubDuel: 0,
      chants: 0, chantsClub: 0, miTemps: 0, evolutions: 0, jeux: 0, pronos: 0, ultimes: 0, competitions: new Set() } });
  }

  /* Les séances : boosters, dépenses, mini-jeux. */
  for (const x of presents) {
    const { p, act } = x;
    p.nouveautesDuJour = 0;
    p.stats.joursActifs++;
    /* La carte de présence : une case par jour de suite, sept cases. */
    p.carte = p.carteRompue || (p.dernierJour && joursEntre(p.dernierJour, jour) > 1) ? 1 : (p.carte % 7) + 1;
    p.carteRompue = false;
    p.dernierJour = jour;
    credit(p, 'presence', R('bonus.base') + R('bonus.pas') * (p.carte - 1));
    if (p.carte === 7) p.packs += R('bonus.j7_packs');
    for (const s of x.sessions) {
      p.stats.sessions++; p.stats.minutes += s.duree;
      const maintenant = Date.parse(`${jour}T00:00:00Z`) + s.debut * 60_000;
      const regen = (p.abonne ? R('abo.pack_regen_min') : R('pack.regen_min')) * 60_000;
      const max = p.abonne ? R('abo.pack_max') : R('pack.max');
      if (p.dernierePrise == null) p.dernierePrise = maintenant;
      if (p.packs < max) {
        const gagnes = Math.floor((maintenant - p.dernierePrise) / regen);
        const pris = Math.min(gagnes, Math.max(0, max - p.packs));
        p.packs += pris; p.packsGratuits += pris;
        p.dernierePrise = p.packs >= max ? maintenant : p.dernierePrise + gagnes * regen;
      } else p.dernierePrise = maintenant;
      /* Il ouvre tout : c'est le premier geste de chaque visite. */
      while (p.packs > 0) { p.packs--; ouvrirBooster(p, serieVisee(p, ouvertes), ctx); act.boosters++; }
      depenser(p, act);
      if (p.P.achete && p.echarpes > 300 && hasard() < p.P.achete) {
        const n = Math.min(5, Math.floor((p.echarpes - 250) / R('pack.prix_echarpes')));
        for (let k = 0; k < n; k++) {
          debit(p, 'boosters', R('pack.prix_echarpes')); p.packsAchetes++;
          ouvrirBooster(p, serieVisee(p, ouvertes), ctx); act.boosters++;
        }
      }
    }
    /* Mini-jeux et pronostics. */
    const jeux = Math.min(R('jeux.echarpes_jour'), Math.round(p.P.jeux * entre(0.5, 1.2)));
    if (jeux > 0) { credit(p, 'minijeux', jeux); act.jeux = entier(1, 3); }
    for (const c of p.suivis) {
      const m = parClub.get(c);
      if (!m || hasard() > p.P.prono) continue;
      act.pronos++;
      const reel = Math.sign(m.buts[0] - m.buts[1]);
      const mise = pondere([[1, 0.45], [0, 0.25], [-1, 0.3]]);
      if (mise === reel) {
        credit(p, 'pronostics', R('prono.vainqueur_echarpes'));
        if (hasard() < 0.18) credit(p, 'pronostics', R('prono.exact_echarpes'));
      }
    }
  }

  /* Les duels : toutes les tentatives du jour, dans l'ordre de l'horloge,
     appariées comme le fait la file : un humain en face sur le même match
     avant 120 secondes, ou bien des bots, donc un entraînement. L'onglet EN
     ATTENTE et le rappel laissent un duel quitté visible dix minutes. */
  const tentatives = [];
  for (const x of presents) {
    const { p } = x;
    for (const s of x.sessions) {
      if (s.virage) continue;
      const n = entier(p.P.duels[0], p.P.duels[1]);
      for (let k = 0; k < n; k++) tentatives.push({ x, t: s.debut + k * 7 + entre(0, 2), fin: s.debut + s.duree });
    }
  }
  tentatives.sort((a, b) => a.t - b.t);
  const file = [];   // { x, t, jusqua, match, side, absent }
  const plafond = R('abo.duels_classes_jour');
  const duelsDuJour = [];
  const occupe = new Map();
  for (const a of tentatives) {
    const { x } = a; const { p } = x;
    if ((occupe.get(p.id) ?? -1) > a.t) continue;
    const peutClasser = p.abonne || plafond === 0 || x.act.classes < plafond;
    for (let i = file.length - 1; i >= 0; i--) {
      if (file[i].jusqua < a.t) {
        if (!file[i].absent) { jouerContreBots(file[i].x, file[i].match, file[i].t, 'personne'); }
        else { file[i].x.p.stats.attentesVaines++; journal.duelsParHeure[Math.floor(file[i].t / 60) % 24].vains++; }
        file.splice(i, 1);
      }
    }
    if (!peutClasser) {
      if (x.act.plafond !== true) { x.act.plafond = true; p.stats.joursPlafond++; }
      jouerContreBots(x, null, a.t, 'plafond'); occupe.set(p.id, a.t + 5); continue;
    }
    const monMatch = p.suivis.map((c) => parClub.get(c)).find(Boolean) ?? null;
    /* Quelqu'un attend : sur mon match d'abord, sinon l'onglet EN ATTENTE. */
    const k = file.findIndex((e) => e.x.p.id !== p.id && monMatch && e.match === monMatch)
      ?? -1;
    const j = k >= 0 ? k : (hasard() < 0.9 ? file.findIndex((e) => e.x.p.id !== p.id) : -1);
    if (j >= 0) {
      const e = file.splice(j, 1)[0];
      jouerDuelClasse(e, x, a.t, matchs);
      occupe.set(p.id, a.t + 5); occupe.set(e.x.p.id, a.t + 5);
      continue;
    }
    const match = monMatch ?? affiche ?? rnd(matchs) ?? null;
    if (!match) { jouerContreBots(x, null, a.t, 'sansMatch'); continue; }
    const side = monMatch ? (p.suivis.includes(match.dom) ? 0 : 1) : (hasard() < 0.5 ? 0 : 1);
    const absent = hasard() < 0.35;
    file.push({ x, t: a.t, jusqua: a.t + (absent ? R('duel.attente_absent_min') : R('duel.attente_classe_sec') / 60),
      match, side, absent });
    occupe.set(p.id, a.t + (absent ? 1 : 2) + 5);
  }
  for (const e of file) if (!e.absent) jouerContreBots(e.x, e.match, e.t, 'personne'); else e.x.p.stats.attentesVaines++;

  function jouerContreBots(x, match, t, raison) {
    journal.bots[raison] = (journal.bots[raison] ?? 0) + 1;
    if (raison === 'personne') journal.parHeure[Math.floor(t / 60) % 24].personne++;
    const { p, act } = x;
    const s = progres(p);
    const gagne = hasard() < Math.min(0.97, 0.5 + 0.45 * Math.min(1, s));
    const pourSonClub = match && p.suivis.some((c) => c === match.dom || c === match.ext);
    credit(p, 'duels', Math.round(GAIN.entrainement[gagne ? 'gagne' : 'perdu'] * primeDeFormat('1v1')
      * (pourSonClub ? DOUBLE_CLUB : 1)));
    gagnerXp(p, R('xp.duel_entrainement') + (gagne ? R('xp.victoire') : 0));
    p.stats.duelsBots++; p.duelsJoues++;
    act.duels++; if (gagne) act.victoires++;
    if (hasard() < 0.5) act.ultimes++;
    if (match) act.competitions.add(match.ligue);
    journal.duelsParHeure[Math.floor(t / 60) % 24].bots++;
  }

  function jouerDuelClasse(e, x, t, du) {
    /* `e` attendait sur son camp ; `x` arrive et tient l'autre, le camp
       délaissé : c'est lui qui touche le renfort (×2 en 1v1). */
    const A = e.x; const B = x; const m = e.match;
    const camps = [{ y: A, side: e.side, renfort: 1 }, { y: B, side: 1 - e.side, renfort: R('duel.renfort_max') }];
    const sA = progres(A.p); const sB = progres(B.p);
    const ecart = sA - sB;
    const nul = Math.abs(ecart) < 0.3 && hasard() < 0.05;
    const aGagne = !nul && hasard() < logistique(PENTE * ecart);
    const issues = nul ? ['draw', 'draw'] : aGagne ? ['win', 'loss'] : ['loss', 'win'];
    const cotes = [A.p.cote, B.p.cote];
    camps.forEach((c, i) => {
      const { p, act } = c.y;
      const club = c.side === 0 ? m.dom : m.ext;
      const suit = p.suivis.includes(club);
      const issue = issues[i];
      const gagne = issue === 'win';
      const s = i === 0 ? sA : sB;
      let f = HUMAIN * ferveurDuel(s) * (gagne ? 1.05 : 0.85) * c.renfort * (suit ? 1 : R('ferveur.neutre'));
      p.ferveur[saison] += Math.round(f);
      credit(p, 'duels', Math.round(GAIN.classe[gagne ? 'gagne' : 'perdu'] * primeDeFormat('1v1')
        * (suit ? DOUBLE_CLUB : 1)));
      gagnerXp(p, R('xp.duel_classe') + (gagne ? R('xp.victoire') : 0));
      p.cote = COTE.apres(cotes[i], cotes[1 - i], issue, p.classes);
      p.classes++; p.duelsJoues++;
      p.stats.duelsClasses++; p.stats.duelsHumains++; if (gagne) p.stats.victoires++;
      act.duels++; act.classes++; if (gagne) act.victoires++; if (suit) act.clubDuel++;
      if (hasard() < 0.6) act.ultimes++;
      act.competitions.add(m.ligue);
      LIGNES_CLUBS.push({ saison, club, joueur: p.id, neutre: !suit, issue, jour, source: 'duel' });
    });
    duelsDuJour.push({ t, m: m.id });
    journal.duelsParHeure[Math.floor(t / 60) % 24].humains += 1;
    journal.parHeure[Math.floor(t / 60) % 24].trouve++;
  }

  /* Le Virage : une salle par match, deux tribunes. La corde se lit sur la
     poussée de chaque tribune (minutes × ferveur du niveau) ; une tribune
     vide perd (l'étalon : 1 contre 0 donne 149 buts à 0). */
  const salles = new Map();
  for (const x of presents) for (const v of x.virages) {
    if (!salles.has(v.m.id)) salles.set(v.m.id, { m: v.m, tribunes: [[], []] });
    salles.get(v.m.id).tribunes[v.side].push({ x, v });
  }
  for (const { m, tribunes } of salles.values()) {
    const poussee = tribunes.map((t) => t.reduce((s, { x, v }) => s + v.minutes * ferveurVirageMinute(progres(x.p)), 0));
    let issue;
    if (!tribunes[1].length) issue = poussee[0] > 300 ? 0 : -1;
    else if (!tribunes[0].length) issue = poussee[1] > 300 ? 1 : -1;
    else {
      const r = (poussee[0] - poussee[1]) / (poussee[0] + poussee[1]);
      issue = Math.abs(r) < 0.05 && hasard() < 0.5 ? -1 : (hasard() < logistique(6 * r) ? 0 : 1);
    }
    journal.virages.push({ jour, ligue: m.ligue, tailles: tribunes.map((t) => t.length), issue });
    tribunes.forEach((t, side) => t.forEach(({ x, v }) => {
      const { p, act } = x;
      const club = side === 0 ? m.dom : m.ext;
      const suit = p.suivis.includes(club);
      const chants = Math.round(v.minutes * 2.4);
      act.chants += chants; if (suit) act.chantsClub += chants;
      act.miTemps = Math.max(act.miTemps, Math.round(Math.min(45, v.minutes) * 2.4));
      act.competitions.add(m.ligue);
      if (p.viragesDuJour !== jour) { p.viragesDuJour = jour; p.viragesClasses = 0; p.viragesXp = 0; }
      p.stats.virages++;
      if (p.viragesXp < R('xp.virage_matchs_jour')) {
        gagnerXp(p, R('xp.virage') + (chants >= 10 ? R('xp.virage_chants') : 0));
        p.viragesXp++;
      }
      if (p.abonne || p.viragesClasses < R('abo.virages_classes_jour')) {
        p.viragesClasses++;
        p.stats.viragesClasses++;
        p.ferveur[saison] += Math.round(HUMAIN * v.minutes * ferveurVirageMinute(progres(p)) * (suit ? 1 : R('ferveur.neutre')));
        const res = issue === -1 ? 'draw' : issue === side ? 'win' : 'loss';
        LIGNES_CLUBS.push({ saison, club, joueur: p.id, neutre: !suit, issue: res, jour, source: 'virage' });
      }
    }));
  }

  /* Missions du jour, carnet, collection, et le joueur qui décroche. */
  const actives = MISSIONS.filter((mi) => R(`mission.${mi.id}`) !== false);
  const reussie = (mi, a) => ({
    boosters: a.boosters >= 3, duel: a.duels >= 1, virage: a.chants >= 10, grandir: a.evolutions >= 1,
    minijeu: a.jeux >= 1, prono: a.pronos >= 1, tribune: a.chants >= 40, victoire: a.victoires >= 1,
    classes: a.classes >= 2, club_virage: a.chantsClub >= 20, club_duel: a.clubDuel >= 1, ultime: a.ultimes >= 1,
    victoires: a.victoires >= 3, endurance: a.duels >= 5, mitemps: a.miTemps >= 10, ailleurs: a.competitions.size >= 2,
  })[mi.id] ?? false;
  for (const x of presents) {
    const { p, act } = x;
    let toutes = true;
    let relance = R('missions.relances');
    for (const d of ['facile', 'moyenne', 'difficile']) {
      const choix = actives.filter((mi) => mi.difficulte === d);
      let mi = rnd(choix);
      if (!reussie(mi, act) && relance > 0) { relance--; mi = rnd(choix); }
      if (reussie(mi, act) && hasard() < p.P.missions) {
        credit(p, 'missions', R(`missions.${d}_echarpes`));
        gagnerXp(p, R(`missions.${d}_xp`));
        p.tampons[saison] += R(`saison.tampons_${d}`);
        p.stats.missions++;
      } else toutes = false;
    }
    if (toutes) { p.packs += R('missions.sachet_packs'); p.tampons[saison] += R('saison.tampons_sachet'); p.stats.sachets++; }
    const carnet = CARNETS[saison];
    while (p.paliers[saison] < carnet.length && p.tampons[saison] >= carnet[p.paliers[saison]].tampons) {
      const pal = carnet[p.paliers[saison]];
      credit(p, 'carnet', pal.echarpes); p.packs += pal.packs; p.paliers[saison]++;
    }
    depenser(p, act);
    reclamerCollection(p, ouvertes);
    p.nouveautes.push([jour, p.nouveautesDuJour]);
    /* Un club de plus quand le niveau ouvre une place. */
    while (p.suivis.length < Math.min(slots(p), p.P.suivis)) {
      const c = hasard() < 0.6 ? grosClubAilleurs(p.suivis) : tirerClub(CLUBS.get(p.principal).ligue);
      if (c && !p.suivis.includes(c)) p.suivis.push(c); else break;
    }
  }

  /* Décrocher : la chance du profil, doublée pour qui n'a rien gagné de neuf
     depuis une semaine. */
  for (const p of joueurs) {
    if (p.inscrit > jour || p.parti) continue;
    const semaine = p.nouveautes.slice(-7).reduce((s, [, n]) => s + n, 0);
    const lasse = p.nouveautes.length >= 7 && semaine === 0;
    const parJour = 1 - Math.pow(1 - p.P.decroche, 1 / 30);
    if (hasard() < parJour * (lasse ? 2 : 1)) p.parti = jour;
  }

  const restants = joueurs.filter((p) => p.inscrit <= jour && !p.parti);
  journal.jours.push({ jour, saison, inscrits: joueurs.filter((p) => p.inscrit <= jour).length,
    restants: restants.length, presents: presents.length, matchs: matchs.length, duelsHumains: duelsDuJour.length });
  if (jourSemaine(jour) === 0 || jour === FIN) {
    journal.hebdo.push({ jour, joueurs: joueurs.filter((p) => p.inscrit <= jour).map((p) => ({
      id: p.id, profil: p.profil, parti: Boolean(p.parti), niveau: p.niveau, echarpes: p.echarpes,
      collection: etatCollection(p, ouvertes), ferveur: p.ferveur[saison], tampons: p.tampons[saison],
    })) });
  }
}

function etatCollection(p, ouvertes) {
  const lignes = ouvertes.flatMap(lignesDe);
  const agesTotal = lignes.reduce((s, l) => s + l.ages, 0);
  let tetes = 0; let ages = 0;
  for (const l of lignes) { const st = p.fanzzy.get(l.id); if (st) { tetes++; ages += st; } }
  const legendes = lignes.filter((l) => l.rar === 'legendaire');
  const legOk = legendes.filter((l) => p.fanzzy.has(l.id)).length;
  return {
    tetes, tetesTotal: lignes.length, ages, agesTotal,
    legendes: legOk, legendesTotal: legendes.length,
    etats: p.etats, etatsTotal: agesTotal * ETATS_DESSINES.length,
    tenues: p.tenues, tenuesTotal: agesTotal * TENUES.length,
    ultimes: p.ultimes, ultimesTotal: agesTotal,
    stuff: p.stuff.size, stuffTotal: (ouvertes.length > 3 ? STUFF_S2 : STUFF_S1).length,
    actions: p.actions.size, actionsTotal: ACTIONS_TIRABLES.length,
    lieux: p.lieux.size, lieuxTotal: LIEUX.length,
  };
}

/* ============================================================== le bilan */

/** TRIBUNES, ligne pour ligne la règle de `classements/index.js`. */
function tribunes(saison, ligue = null, variante = false) {
  const parClub = new Map();
  const duJour = new Map();
  for (const l of LIGNES_CLUBS) {
    if (l.saison !== saison) continue;
    /* La variante proposée : cinq duels classés par jour et par joueur au
       plus comptent pour les clubs, abonné ou non, et le neutre compte parmi
       les joueurs du club qu'il a aidé. */
    if (variante && l.source === 'duel') {
      const k = `${l.joueur}:${l.jour}`;
      const n = (duJour.get(k) ?? 0) + 1;
      duJour.set(k, n);
      if (n > R('abo.duels_classes_jour')) continue;
    }
    if (ligue && CLUBS.get(l.club).ligue !== ligue) continue;
    if (CLUBS.get(l.club).ligue === 'autres') continue;
    const c = parClub.get(l.club) ?? { club: l.club, ligue: CLUBS.get(l.club).ligue, joueurs: new Set(),
      J: 0, G: 0, N: 0, P: 0, points: 0, neutres: 0, duels: 0, virages: 0 };
    if (!l.neutre || variante) c.joueurs.add(l.joueur);
    if (l.neutre) c.neutres++;
    c.J++; c[{ win: 'G', draw: 'N', loss: 'P' }[l.issue]]++;
    c.points += { win: 3, draw: 1, loss: 0 }[l.issue] * (l.neutre ? R('tribune.neutre_points') : 1);
    c[l.source === 'duel' ? 'duels' : 'virages']++;
    parClub.set(l.club, c);
  }
  const suiveurs = new Map();
  for (const p of joueurs) for (const c of p.suivis) suiveurs.set(c, (suiveurs.get(c) ?? 0) + 1);
  return [...parClub.values()].map((c) => {
    const ids = [...c.joueurs];
    const profils = ids.map((id) => joueurs.find((p) => p.id === id).profil);
    return { ...c, joueurs: ids.length, suiveurs: suiveurs.get(c.club) ?? 0,
      tryhards: profils.filter((x) => x === 'tryhard').length,
      points: Math.round(c.points * 10) / 10,
      moyenne: Math.round((c.points / Math.max(ids.length, R('tribune.plancher'))) * 10) / 10 };
  }).sort((a, b) => b.moyenne - a.moyenne || b.points - a.points || b.G - a.G);
}

/** Le vrai classement d'un championnat au soir d'un jour. */
function classementReel(ligue, jusqua) {
  const t = new Map();
  for (const m of MATCHS) {
    if (m.ligue !== ligue || m.jour > jusqua) continue;
    for (const [club, pour, contre] of [[m.dom, m.buts[0], m.buts[1]], [m.ext, m.buts[1], m.buts[0]]]) {
      const c = t.get(club) ?? { club, J: 0, pts: 0, diff: 0 };
      c.J++; c.diff += pour - contre; c.pts += pour > contre ? 3 : pour === contre ? 1 : 0;
      t.set(club, c);
    }
  }
  return [...t.values()].sort((a, b) => b.pts - a.pts || b.diff - a.diff);
}

const moyenne = (t) => (t.length ? t.reduce((a, b) => a + b, 0) / t.length : 0);
const mediane = (t) => { const s = [...t].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const fin = journal.hebdo[journal.hebdo.length - 1];
const finS1 = journal.hebdo.filter((h) => h.jour <= FIN_S1).pop();

const parProfil = Object.fromEntries(NOMS_PROFILS.map((k) => {
  const js = joueurs.filter((p) => p.profil === k);
  const c = js.map((p) => etatCollection(p, SERIES_S2));
  const somme = (f) => js.reduce((s, p) => s + f(p), 0);
  const sources = {};
  for (const p of js) for (const [s, n] of Object.entries(p.gagne)) sources[s] = (sources[s] ?? 0) + n / js.length;
  const depenses = {};
  for (const p of js) for (const [s, n] of Object.entries(p.depense)) depenses[s] = (depenses[s] ?? 0) + n / js.length;
  const jours = js.map((p) => joursEntre(p.inscrit, p.parti ?? FIN) + 1);
  return [k, {
    libelle: LIBELLE[k], n: js.length, abonnes: js.filter((p) => p.abonne).length,
    partis: js.filter((p) => p.parti).length,
    joursActifs: moyenne(js.map((p) => p.stats.joursActifs)),
    joursPresence: moyenne(jours),
    minutesParJourActif: moyenne(js.map((p) => p.stats.minutes / Math.max(1, p.stats.joursActifs))),
    boosters: moyenne(js.map((p) => p.packsOuverts)),
    boostersParJourActif: moyenne(js.map((p) => p.packsOuverts / Math.max(1, p.stats.joursActifs))),
    boostersAchetes: moyenne(js.map((p) => p.packsAchetes)),
    partRepli: somme((p) => p.replis) / Math.max(1, somme((p) => p.placesOuvertes)),
    niveau: moyenne(js.map((p) => p.niveau)), niveauMax: Math.max(...js.map((p) => p.niveau)),
    niveau30: js.filter((p) => p.niveau >= 30).length,
    echarpesGagnees: moyenne(js.map((p) => Object.values(p.gagne).reduce((a, b) => a + b, 0))),
    echarpesRestantes: moyenne(js.map((p) => p.echarpes)),
    sources, depenses,
    duelsClasses: moyenne(js.map((p) => p.stats.duelsClasses)), duelsBots: moyenne(js.map((p) => p.stats.duelsBots)),
    attentesVaines: moyenne(js.map((p) => p.stats.attentesVaines)),
    virages: moyenne(js.map((p) => p.stats.virages)), viragesClasses: moyenne(js.map((p) => p.stats.viragesClasses)),
    victoires: moyenne(js.map((p) => p.stats.victoires / Math.max(1, p.stats.duelsClasses))),
    missions: moyenne(js.map((p) => p.stats.missions)),
    tamponsS1: moyenne(js.map((p) => p.tampons.S1)), palierS1: moyenne(js.map((p) => p.paliers.S1)),
    carnetFiniS1: js.filter((p) => p.paliers.S1 >= CARNETS.S1.length).length,
    ferveurS1: mediane(js.map((p) => p.ferveur.S1)),
    collection: {
      tetes: moyenne(c.map((x) => x.tetes / x.tetesTotal)),
      ages: moyenne(c.map((x) => x.ages / x.agesTotal)),
      legendes: moyenne(c.map((x) => x.legendes / x.legendesTotal)),
      etats: moyenne(c.map((x) => x.etats / x.etatsTotal)),
      tenues: moyenne(c.map((x) => x.tenues / x.tenuesTotal)),
      ultimes: moyenne(c.map((x) => x.ultimes / x.ultimesTotal)),
      stuff: moyenne(c.map((x) => x.stuff / x.stuffTotal)),
      actions: moyenne(c.map((x) => x.actions / x.actionsTotal)),
      lieux: moyenne(c.map((x) => x.lieux / x.lieuxTotal)),
    },
    seriesCompletes: moyenne(js.map((p) => p.seriesCompletes.size)),
    joursPlafond: moyenne(js.map((p) => p.stats.joursPlafond)),
    satiete: (() => { const v = js.map(satiete); const ok = v.filter((x) => x != null);
      return { atteinte: ok.length, mediane: ok.length ? mediane(ok) : null }; })(),
    nouveautesParJour: moyenne(js.map((p) => p.nouveautes.reduce((s, [, n]) => s + n, 0) / Math.max(1, p.nouveautes.length))),
  }];
}));

/* Quand la collection se remplit : semaine par semaine, la part moyenne de
   chaque catégorie, par profil, chez ceux qui jouent encore. */
const courbes = journal.hebdo.map((h) => ({
  jour: h.jour,
  ...Object.fromEntries(NOMS_PROFILS.map((k) => {
    const js = h.joueurs.filter((j) => j.profil === k && !j.parti);
    const part = (f, t) => moyenne(js.map((j) => j.collection[f] / j.collection[t]));
    return [k, { n: js.length, tetes: part('tetes', 'tetesTotal'), ages: part('ages', 'agesTotal'),
      etats: part('etats', 'etatsTotal'), tenues: part('tenues', 'tenuesTotal'), ultimes: part('ultimes', 'ultimesTotal'),
      niveau: moyenne(js.map((j) => j.niveau)), echarpes: moyenne(js.map((j) => j.echarpes)),
      ferveur: mediane(js.map((j) => j.ferveur)) }];
  })),
}));

/* Le premier jour où chaque joueur ne reçoit plus rien de neuf d'un booster
   en moyenne sur la semaine (moins d'un objet par jour). */
function satiete(p) {
  const t = p.nouveautes;
  for (let i = 14; i < t.length; i++) {
    const semaine = t.slice(i - 7, i).reduce((s, [, n]) => s + n, 0);
    if (semaine < 7) return joursEntre(p.inscrit, t[i][0]);
  }
  return null;
}
const tribS1 = tribunes('S1');
const tribS2 = tribunes('S2');
const tribS1Variante = tribunes('S1', null, true);
const supportersS1 = joueurs.map((p) => ({ id: p.id, profil: p.profil, ferveur: p.ferveur.S1, club: p.principal,
  division: SAISON.divisionPour(p.ferveur.S1, SEUILS)?.nom ?? '—', cote: p.cote, classes: p.classes }))
  .sort((a, b) => b.ferveur - a.ferveur);
const divisions = Object.fromEntries(['—', ...SAISON.DIVISIONS.map((d) => d.nom)].map((d) => [d,
  Object.fromEntries(NOMS_PROFILS.map((k) => [k, supportersS1.filter((s) => s.division === d && s.profil === k).length]))]));
let proposition = null;
try {
  proposition = SAISON.proposerSeuils({ joueurs: supportersS1.filter((s) => s.ferveur > 0)
    .map((s) => ({ ferveur: s.ferveur })), joursEcoules: 151, joursTotaux: 151 });
} catch (e) { proposition = { erreur: e.message }; }
const duellistes = joueurs.filter((p) => p.classes >= 3).map((p) => ({ id: p.id, profil: p.profil, cote: p.cote,
  classes: p.classes })).sort((a, b) => b.cote - a.cote);

const vir = journal.virages;
const sallesStats = {
  total: vir.length,
  seul: vir.filter((v) => v.tailles[0] + v.tailles[1] === 1).length,
  unCampVide: vir.filter((v) => !v.tailles[0] || !v.tailles[1]).length,
  deuxCamps: vir.filter((v) => v.tailles[0] && v.tailles[1]).length,
  tailleMoyenne: moyenne(vir.map((v) => v.tailles[0] + v.tailles[1])),
  plusGrande: Math.max(...vir.map((v) => v.tailles[0] + v.tailles[1])),
  parLigue: Object.fromEntries(LIGUES.map((L) => [L.code, vir.filter((v) => v.ligue === L.code).length])),
};
const dh = journal.duelsParHeure;
const totaux = { humains: dh.reduce((s, h) => s + h.humains, 0) * 2, bots: dh.reduce((s, h) => s + h.bots, 0),
  vains: dh.reduce((s, h) => s + h.vains, 0) };

const ligues = Object.fromEntries(LIGUES.map((L) => {
  const t = tribunes('S1', L.code);
  const reel = classementReel(L.code, FIN_S1);
  return [L.code, { nom: L.nom, connu: L.connu, reconstitue: Boolean(L.reconstitue), clubs: clubsParLigue.get(L.code).length,
    joueurs: joueurs.filter((p) => CLUBS.get(p.principal).ligue === L.code).length,
    clubsAvecJoueurs: new Set(joueurs.filter((p) => CLUBS.get(p.principal).ligue === L.code).map((p) => p.principal)).size,
    tribunes: t.slice(0, 10), reel: reel.slice(0, 10).map((r, i) => ({ ...r, rang: i + 1 })),
    rangReelDuPremier: t[0] ? reel.findIndex((r) => r.club === t[0].club) + 1 : null }];
}));

/* D'où viennent les points des clubs : par profil, et abonnés à part. */
const pointsParProfil = Object.fromEntries(['S1', 'S2'].map((sa) => {
  const o = Object.fromEntries(NOMS_PROFILS.map((k) => [k, 0]));
  const prof = new Map(joueurs.map((p) => [p.id, p.profil]));
  for (const l of LIGNES_CLUBS) if (l.saison === sa) {
    o[prof.get(l.joueur)] += { win: 3, draw: 1, loss: 0 }[l.issue] * (l.neutre ? R('tribune.neutre_points') : 1);
  }
  return [sa, o];
}));
const sourcesPoints = Object.fromEntries(['duel', 'virage'].map((src) => [src,
  LIGNES_CLUBS.filter((l) => l.saison === 'S1' && l.source === src).length]));
sourcesPoints.autres = LIGNES_CLUBS.filter((l) => l.saison === 'S1' && CLUBS.get(l.club).ligue === 'autres').length;
sourcesPoints.neutres = LIGNES_CLUBS.filter((l) => l.saison === 'S1' && l.neutre && CLUBS.get(l.club).ligue !== 'autres').length;
sourcesPoints.joursSansMatch = [...Array(joursEntre(DEBUT, FIN) + 1).keys()].filter((i) =>
  !MATCHS_DU_JOUR.has(new Date(Date.parse(`${DEBUT}T12:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10))).length;
const nouveautesHebdo = journal.hebdo.map((h, i) => ({ jour: h.jour }));
const clubsSuivis = new Set(joueurs.flatMap((p) => p.suivis));
const resultat = {
  graine: GRAINE, joueurs: NB_JOUEURS, debut: DEBUT, fin: FIN, finS1: FIN_S1,
  calendrier: Object.fromEntries(LIGUES.map((L) => [L.code, { titre: L.titre, matchs: MATCHS.filter((m) => m.ligue === L.code).length,
    joues: MATCHS.filter((m) => m.ligue === L.code && m.joue).length }])),
  catalogue: { seriesS1: SERIES_S1, seriesS2: SERIES_S2, ...etatCollection(joueurs[0], SERIES_S1),
    stuffS1: STUFF_S1.length, carnetS1: CARNETS.S1, carnetS2: CARNETS.S2, tenues: TENUES },
  reglages: { packRegen: R('pack.regen_min'), packMax: R('pack.max'), aboRegen: R('abo.pack_regen_min'),
    aboMax: R('abo.pack_max'), seuils: SEUILS, plancher: R('tribune.plancher'), neutre: R('tribune.neutre_points') },
  parProfil, courbes, jours: journal.jours, duelsParHeure: dh, totaux, sallesStats,
  tribunes: { S1: tribS1, S2: tribS2, S1variante: tribS1Variante }, bots: journal.bots, parHeure: journal.parHeure, ligues, supportersS1: supportersS1.slice(0, 25), ferveursS1: supportersS1.map((x) => ({ profil: x.profil, ferveur: x.ferveur })), divisions, proposition,
  duellistes: duellistes.slice(0, 15),
  clubs: { total: CLUBS.size, suivis: clubsSuivis.size, avecMatchs: tribS1.length,
    avecJoueurs: new Set(joueurs.map((p) => p.principal)).size },
  pointsParProfil, sourcesPoints,
  nouveautesParSemaine: (() => {
    const out = [];
    for (const h of journal.hebdo) {
      const ligne = { jour: h.jour };
      for (const k of NOMS_PROFILS) {
        const js = joueurs.filter((p) => p.profil === k);
        const v = [];
        for (const p of js) {
          const sem = p.nouveautes.filter(([j]) => j <= h.jour && joursEntre(j, h.jour) < 7);
          if (sem.length) v.push(sem.reduce((s, [, n]) => s + n, 0) / sem.length);
        }
        ligne[k] = moyenne(v);
      }
      out.push(ligne);
    }
    return out;
  })(),
  partis: joueurs.filter((p) => p.parti).map((p) => ({ id: p.id, profil: p.profil, jour: p.parti })),
};

if (SORTIE) writeFileSync(SORTIE, JSON.stringify(resultat, null, 1));

/* --------------------------------------------------------------- à l'écran */
const pc = (x) => `${Math.round(x * 100)} %`;
const r0 = (x) => Math.round(x).toLocaleString('fr-CH');
console.log(`\nSaison simulée du ${DEBUT} au ${FIN}, ${NB_JOUEURS} joueurs, graine ${GRAINE}.`);
console.log(`Calendrier : ${MATCHS.length} matchs dans ${LIGUES.length} championnats.\n`);
for (const [k, v] of Object.entries(parProfil)) {
  console.log(`${v.libelle.padEnd(12)} ${String(v.n).padStart(3)} joueurs, ${v.partis} partis · ${r0(v.joursActifs)} jours actifs`
    + ` · ${r0(v.boosters)} boosters (${v.boostersParJourActif.toFixed(1)}/jour) · niveau ${v.niveau.toFixed(1)}`
    + ` · ${r0(v.duelsClasses)} classés / ${r0(v.duelsBots)} bots · ${r0(v.virages)} Virages`
    + ` · têtes ${pc(v.collection.tetes)} âges ${pc(v.collection.ages)} états ${pc(v.collection.etats)}`
    + ` tenues ${pc(v.collection.tenues)} Ultimate ${pc(v.collection.ultimes)} · repli ${pc(v.partRepli)}`
    + ` · carnet S1 ${v.palierS1.toFixed(1)}/5 · ferveur S1 ${r0(v.ferveurS1)}`);
}
console.log(`\nDuels : ${r0(totaux.humains)} places en classé contre un humain, ${r0(totaux.bots)} contre des bots,`
  + ` ${r0(totaux.vains)} attentes sans personne.`);
console.log(`Virage : ${sallesStats.total} salles, ${pc(sallesStats.unCampVide / sallesStats.total)} avec un camp vide,`
  + ` ${pc(sallesStats.seul / sallesStats.total)} avec un seul supporter, ${sallesStats.tailleMoyenne.toFixed(1)} en moyenne.`);
console.log(`\nTRIBUNES Saison 1 (${tribS1.length} clubs classés) :`);
for (const [i, c] of tribS1.slice(0, 12).entries()) {
  console.log(`  ${String(i + 1).padStart(2)}. ${c.club.padEnd(28)} ${String(c.joueurs).padStart(2)} j. (${c.tryhards} tryh.)`
    + ` J${c.J} G${c.G} N${c.N} P${c.P} ${c.points} pts → ${c.moyenne}`);
}
console.log('\nDivisions S1 :', JSON.stringify(divisions));
console.log();
