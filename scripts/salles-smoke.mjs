/**
 * Les salles du Grand Virage : qui y est, qui en sort, qui en revient.
 *
 * ## Pourquoi une suite à part
 *
 * `virage-smoke` éprouve le Virage de bout en bout, avec une base et de vraies
 * sockets ; elle est lente, elle vide la base partagée, et elle ne se lance pas
 * pendant qu'un autre atelier s'en sert. Les défauts que ce fichier garde
 * n'ont besoin de rien de tout ça : ils tiennent dans la couche réseau de
 * `ferveur/index.js` et dans la salle elle-même. On les éprouve donc avec le
 * vrai `createVirage`, un faux `io`, de fausses sockets et un faux pool —
 * **sans base, sans réseau et sans port** —, ce qui permet de la lancer à
 * chaque fois.
 *
 * ## Ce qu'elle garde
 *
 *   - **D1** : une salle dont le match est fini sort du relevé ; une salle sur
 *     un match à venir n'y entre que dans la demi-heure qui précède, y reste
 *     les quatre heures qui suivent — c'est le seul chemin qui la rafraîchit —
 *     puis n'y passe plus qu'une fois par demi-heure, comme un report ; un
 *     statut lu en base qu'aucun relevé n'a vu — un report qui se rejoue, un
 *     match avancé — est relevé une fois avant d'être cru, et **une fois par
 *     processus** : ce que le relevé a vu survit à la salle, et une salle
 *     libérée puis rouverte ne repaie rien — sauf quand la journée, à
 *     l'entrée, contredit ce regard : il s'oublie, et le match est relevé.
 *     Un match que l'API ne rend pas — jamais, ou plus après l'avoir rendu,
 *     salle rouverte par un lien comprise —, ou qu'elle laisse « en jeu »
 *     sans que rien ne bouge, passe au coup d'œil au lieu de payer chaque
 *     tour ; une panne de l'API, elle, ne passe pas pour une disparition ;
 *   - **D2** : un départ puis un retour rendent le même souffle, la même
 *     main, les mêmes recharges, la même fatigue et la même ferveur ; un
 *     parti ne compte ni dans la foule, ni dans le rang, ni dans le battement.
 *     Le camp d'un neutre revient avec lui quand la page n'en demande aucun,
 *     et un camp demandé l'emporte ; chez soi, il découle du club suivi ;
 *   - **D3** : on raisonne par socket. Fermer un onglet laisse chanter
 *     l'autre ; une socket qui n'a jamais rejoint ne fait rien en partant ;
 *     deux onglets sur deux matchs ne laissent aucun fantôme ; une entrée dont
 *     la page est ressortie entre-temps ne s'assied pas ;
 *   - **le plafond des Virages classés** ne se contourne ni en ressortant ni
 *     avec deux onglets : la décision n'est qu'une réservation tant qu'aucune
 *     présence n'est écrite ;
 *   - **la libération** : une salle vide se libère, sans que le battement
 *     repousse ce délai, et emporte ses partis — une minute après un match
 *     fini ou reporté ; tant que le match peut se jouer, jamais : seul en
 *     tribune, sortir à la mi-temps ne doit coûter ni son souffle, ni sa
 *     main, ni le score de la tribune ;
 *   - **la fin de la minute double** est diffusée, même quand rien ne bouge ;
 *   - **la Remontada** se lit sur le vrai score, et non sur les buts vus.
 */
import { createVirage } from '../src/server/ferveur/index.js';
import { VirageRoom, RULES } from '../src/server/ferveur/virage.js';
import { resoudreGeste } from '../src/server/ferveur/gestures.js';
import { ACTIONS_VIRAGE } from '../src/shared/duel/actions.js';
import { createPoller } from '../src/server/football/poller.js';

let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 1500) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (fn()) return true; await wait(10); }
  return Boolean(fn());
}

/* ------------------------------------------------------------- les faux */

const HOME = 10, AWAY = 20;
/* Les matchs que la base connaît. `elapsed: 0` : le répertoire est celui du
   rang 0, qui offre « reprise » — le chant qu'on sait taper juste. */
const MATCHS = new Map();
const poserMatch = (id, o = {}) => MATCHS.set(id, {
  id, league_id: 61, home_id: HOME, away_id: AWAY, kickoff_at: new Date(),
  status_short: '1H', home_goals: 0, away_goals: 0, elapsed: 0, elapsed_extra: null,
  luA: Date.now(), home_name: 'Domicile', home_logo: null, home_c1: null, home_c2: null,
  away_name: 'Extérieur', away_logo: null, away_c1: null, away_c2: null, league_name: 'L', ...o,
});
for (let id = 1001; id <= 1060; id++) poserMatch(id);

/* Les clubs suivis : tout le monde suit le club à domicile, sauf les neutres. */
const NEUTRES = new Set();
const pool = {
  async execute(sql, params = []) {
    if (sql.includes('FROM fixtures f') && sql.includes('WHERE f.id = ?')) {
      const r = MATCHS.get(Number(params[0]));
      return [r ? [{ ...r }] : []];
    }
    if (sql.includes('FROM user_follows')) {
      return [NEUTRES.has(params[0]) ? [] : [{ team_id: HOME }]];
    }
    return [[]];
  },
};

/* Une main pour chacun : toutes les cartes jouables au Virage. */
const TOUTES = ACTIONS_VIRAGE.map((a) => a.id);
const decks = { loadout: async () => ({ actions: TOUTES.map((id) => ({ id })), fanzzy: [] }) };

/* Le Fanzzy, qu'on peut faire attendre : c'est la lecture la plus lente de
   l'entrée, et c'est pendant elle que les courses se jouent. */
const retenues = new Map();          // userId -> { promesse, lacher }
const retenir = (userId) => {
  let lacher;
  const promesse = new Promise((r) => { lacher = r; });
  retenues.set(userId, { promesse, lacher });
  return () => { retenues.delete(userId); lacher(); };
};
const fanzzy = {
  activeFanzzy: async (userId) => { await retenues.get(userId)?.promesse; return null; },
  personnageActif: async () => null,
};

/* Le faux `io` : les salles d'une socket sont un ensemble, et une émission à
   une salle va à toutes les sockets qui la portent. */
function fauxIo() {
  const sockets = new Set();
  const io = {
    sockets, conn: [],
    on(ev, fn) { if (ev === 'connection') this.conn.push(fn); },
    to(salle) {
      return { emit: (e, p) => { for (const s of sockets) if (s.rooms.has(salle)) s.got.push([e, p]); } };
    },
  };
  let n = 0;
  io.connecter = (userId) => {
    const s = {
      id: `s${++n}`, connected: true, data: { user: { userId, name: `Fan ${userId}` } },
      rooms: new Set(), h: new Map(), got: [],
      on(nom, fn) { (this.h.get(nom) ?? this.h.set(nom, []).get(nom)).push(fn); },
      emit(e, p) { this.got.push([e, p]); },
      join(r) { this.rooms.add(r); },
      leave(r) { this.rooms.delete(r); },
      fire(nom, ...a) { for (const fn of this.h.get(nom) ?? []) fn(...a); },
      /* Comme socket.io : `connected` tombe avant l'événement. */
      couper() {
        this.connected = false; this.rooms.clear(); sockets.delete(this);
        this.fire('disconnect', 'transport close');
      },
      dernier(ev) { return [...this.got].reverse().find(([e]) => e === ev)?.[1]; },
      erreurs() { return this.got.filter(([e]) => e === 'virage:error').map(([, p]) => p.code); },
      compte(ev) { return this.got.filter(([e]) => e === ev).length; },
    };
    sockets.add(s);
    for (const fn of io.conn) fn(s);
    return s;
  };
  return io;
}

/* Le KOP ne donne rien ici ; on retient seulement **pour quel club** la salle
   le lui demande, c'est-à-dire de quel camp elle croit le joueur. */
const kopDemandes = [];
const kop = { modsDe: async (userId, club) => { kopDemandes.push({ userId, club }); return {}; } };

const monter = (io, autres = {}) => createVirage({ pool, io, decks, fanzzy, kop,
  requireAuth: (_q, _r, n) => n(),
  souvenirs: { recordPush: async () => {} }, ...autres });

/* Un relevé qui a vu ce match il y a `ms`. Ce que le relevé a vu est tenu
   par `createVirage`, hors des salles — c'est ce qui le fait survivre à leur
   libération : on ne l'atteint que par son vrai chemin, `matchStatus`, à une
   heure reculée. */
function vuIlYa(V, id, ms, etat) {
  const vrai = Date.now;
  Date.now = () => vrai() - ms;
  try { V.matchStatus(id, etat); } finally { Date.now = vrai; }
}

/** Entre dans une salle et attend l'état. */
async function entrer(s, fixtureId, camp) {
  const avant = s.compte('virage:state');
  s.fire('virage:join', { fixtureId, camp });
  return until(() => s.compte('virage:state') > avant);
}

/** Un chant juste : « reprise », tapé sur la pulsation que la salle annonce. */
async function chanter(s, salle, userId) {
  const m = salle.members.get(userId);
  /* `regenAt` avec : un bloc qui avance l'horloge puis la ramène laisse un
     souffle daté du futur, que le chant suivant ferait redescendre. */
  if (m) { m.breath = 100; m.regenAt = Date.now(); }
  const g = resoudreGeste(m?.mods ?? {}).tempo;
  const taps = Array.from({ length: g.beats }, (_, i) => Math.round(i * g.interval));
  const res = s.compte('virage:result'), err = s.got.filter(([e]) => e === 'virage:error').length;
  s.fire('virage:chant', { cardId: 'reprise', taps });
  await until(() => s.compte('virage:result') > res
    || s.got.filter(([e]) => e === 'virage:error').length > err);
  return s.compte('virage:result') > res ? 'result' : s.erreurs().at(-1);
}

const io = fauxIo();
const V = monter(io);

/* ================================================================= D1 */

console.log('\nD1 — une salle finie ne paie plus le relevé');
{
  const s = io.connecter('d1');
  await entrer(s, 1001);
  const salle = V.rooms.get(1001);
  check('une salle occupée en direct est relevée', V.sallesOccupees().includes(1001));

  /* Le vrai chemin : le relevé du direct apprend le coup de sifflet. */
  V.matchStatus(1001, { status: 'FT', elapsed: 90 });
  check('le coup de sifflet la sort du relevé', !V.sallesOccupees().includes(1001));
  check('sans en chasser personne', salle.members.has('d1'));

  /* Le relevé a vu le match : les statuts sont désormais les siens. */
  const sortent = ['FT', 'AET', 'PEN', 'PST', 'CANC', 'ABD', 'AWD', 'WO'].filter((st) => {
    salle.statut = st;
    return !V.sallesOccupees().includes(1001);
  });
  check(`les huit statuts finaux, vus par le relevé, sortent du relevé (${sortent.join(' ')})`,
    sortent.length === 8);
  /* Un report peut être reprogrammé sous le même numéro : un coup d'œil par
     demi-heure, sans quoi il resterait figé tant que le processus vit — ce
     que le relevé a vu survit aux salles. Une fin, jamais. */
  const dansUneDemiHeure = Date.now() + 31 * 60_000;
  const coupsDOeil = ['FT', 'AET', 'PEN', 'PST', 'CANC', 'ABD', 'AWD', 'WO'].filter((st) => {
    salle.statut = st;
    return V.sallesOccupees(dansUneDemiHeure).includes(1001);
  });
  check('un report ou un arrêt y repasse une fois par demi-heure, une fin jamais',
    coupsDOeil.join(' ') === 'PST ABD'
    || (console.log('        repassent :', coupsDOeil.join(' ') || '(aucun)'), false));

  const restent = ['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE', 'INT', 'SUSP', null].filter((st) => {
    salle.statut = st;
    return V.sallesOccupees().includes(1001);
  });
  check('un match en cours, suspendu depuis peu ou de statut inconnu y reste',
    restent.length === 10);

  /* À venir : la demi-heure d'avant, et tout ce qui suit. */
  const dans = (ms) => { salle.statut = 'NS'; salle.fixture.kickoffAt = new Date(Date.now() + ms); };
  dans(2 * 3600_000);
  check('un match à deux heures du coup d’envoi n’est pas relevé',
    !V.sallesOccupees().includes(1001));
  dans(20 * 60_000);
  check('à vingt minutes, il l’est', V.sallesOccupees().includes(1001));
  /* Le cas qui figerait un match pour toujours : l'heure est passée, la base
     dit encore « à venir », et seule la salle peut le faire rafraîchir. */
  dans(-10 * 60_000);
  check('l’heure passée sans coup d’envoi, il l’est toujours',
    V.sallesOccupees().includes(1001));
  salle.statut = 'TBD'; salle.fixture.kickoffAt = new Date(Date.now() + 5 * 3600_000);
  check('une heure provisoire lointaine suit la même règle', !V.sallesOccupees().includes(1001));
  salle.statut = 'NS'; salle.fixture.kickoffAt = 'pas une date';
  check('une date illisible ne ferme rien', V.sallesOccupees().includes(1001));

  /* Au-delà de quatre heures après le coup d'envoi, un match encore « à
     venir » — une ligue sans direct, que l'API laisse NS toute la journée —
     ou suspendu ne paie plus chaque tour : un coup d'œil par demi-heure. */
  for (const st of ['NS', 'TBD', 'SUSP']) {
    salle.fixture.kickoffAt = new Date(Date.now() - 3 * 3600_000);
    vuIlYa(V, 1001, 60_000, { status: st });
    const dansLesQuatre = V.sallesOccupees().includes(1001);
    salle.fixture.kickoffAt = new Date(Date.now() - 5 * 3600_000);
    const vuIlYaPeu = V.sallesOccupees().includes(1001);
    vuIlYa(V, 1001, 31 * 60_000, { status: st });
    const vuIlYaLongtemps = V.sallesOccupees().includes(1001);
    /* Le vrai chemin : le relevé le voit, et la demi-heure repart. */
    V.matchStatus(1001, { status: st });
    const apresReleve = V.sallesOccupees().includes(1001);
    check(`${st} : à chaque tour dans les quatre heures, puis une fois par demi-heure`,
      dansLesQuatre && !vuIlYaPeu && vuIlYaLongtemps && !apresReleve
      || (console.log('        ', { dansLesQuatre, vuIlYaPeu, vuIlYaLongtemps, apresReleve }), false));
  }
  salle.statut = '1H';
  s.couper();
  check('une salle vide n’est pas relevée', !V.sallesOccupees().includes(1001));
}

console.log('\nD1 — un statut lu en base n’est cru qu’après un relevé');
{
  /* Pour un match qu'aucun club suivi ne relève, la ligne peut dater de
     semaines : la salle est semée de ce qu'elle dit, et la croire aveuglément
     figeait un report qui se rejoue aujourd'hui, ou un match avancé. */
  const ilYa20Jours = new Date(Date.now() - 20 * 86400_000);
  poserMatch(1015, { status_short: 'PST', kickoff_at: ilYa20Jours });
  poserMatch(1016, { status_short: 'ABD', kickoff_at: ilYa20Jours });
  poserMatch(1017, { status_short: 'NS', kickoff_at: new Date(Date.now() + 86400_000) });
  poserMatch(1018, { status_short: 'FT' });
  const qui = [1015, 1016, 1017, 1018].map((id) => [id, io.connecter(`d1s${id}`)]);
  for (const [id, s] of qui) await entrer(s, id);
  const releve = (id) => V.sallesOccupees().includes(id);

  check('un report lu en base est relevé une fois', releve(1015));
  /* Le relevé répond qu'il se joue : la salle le suit. */
  V.matchStatus(1015, { status: '1H', elapsed: 3, homeGoals: 0, awayGoals: 0,
    kickoffAt: new Date(Date.now() - 3 * 60_000).toISOString() });
  check('rejoué sous le même numéro, il reste au relevé',
    releve(1015) && V.rooms.get(1015).statut === '1H');

  check('un arrêt lu en base est relevé une fois', releve(1016));
  V.matchStatus(1016, { status: 'ABD' });
  check('confirmé par le relevé, il en sort', !releve(1016));
  check('jusqu’au coup d’œil de la demi-heure',
    V.sallesOccupees(Date.now() + 31 * 60_000).includes(1016));

  check('un match « à venir demain » lu en base est relevé une fois', releve(1017));
  /* Le relevé donne la nouvelle heure : avancé à dans dix minutes. */
  V.matchStatus(1017, { status: 'NS',
    kickoffAt: new Date(Date.now() + 10 * 60_000).toISOString() });
  check('avancé à aujourd’hui, la salle prend l’heure du relevé',
    Math.abs(new Date(V.rooms.get(1017).fixture.kickoffAt).getTime() - Date.now() - 10 * 60_000) < 5000);
  check('et reste au relevé', releve(1017));
  V.matchStatus(1017, { status: 'NS', kickoffAt: new Date(Date.now() + 86400_000).toISOString() });
  check('à demain pour de bon, il en sort jusqu’à la demi-heure d’avant', !releve(1017));

  check('un match terminé lu en base n’est pas relevé du tout', !releve(1018));
  for (const [, s] of qui) s.couper();
}

/* ============================================================ D2, la salle */

console.log('\nD2 — partir puis revenir rend tout, et ne rend rien de plus');
{
  const salle = new VirageRoom({
    fixture: { id: 9001, homeId: HOME, awayId: AWAY, homeName: 'A', awayName: 'B' },
    emit: () => {}, onPush: () => {}, log: { warn() {}, error() {} },
  });
  salle.join('c1', { side: 0, name: 'Un', actions: TOUTES });
  salle.join('c2', { side: 0, name: 'Deux', actions: [] });
  const m = salle.members.get('c1');

  /* Une carte jouée, donc une recharge armée et une carte en défausse. Le
     Fumigène, et pas la première venue : la main est tirée au hasard, et un
     « Nouveau souffle » effacerait sa propre recharge. */
  const jouee = 'a-fumigene';
  m.main[0] = jouee; m.breath = 100;
  salle.jouer('c1', jouee);
  const now = Date.now();
  m.breath = 30; m.ferveur = 1234; m.fatigueUntil = now + 4000;
  m.lastPush = now; salle.members.get('c2').lastPush = now;
  const avant = JSON.stringify({ main: m.main, pioche: m.pioche, defausse: m.defausse,
    cooldowns: m.cooldowns, ferveur: m.ferveur, fatigueUntil: m.fatigueUntil, side: m.side });
  check('une carte est en recharge avant le départ', (m.cooldowns[jouee] ?? 0) > now);
  check('la foule compte les deux', salle.crowd()[0] === 2);

  salle.leave('c1');
  check('parti, il n’est plus membre', !salle.members.has('c1') && salle.size === 1);
  check('mais la salle le garde', salle.partis.get('c1') === m);
  check('il sort de la foule', salle.crowd()[0] === 1);
  check('et du rang de sa tribune', salle.rankOf('c2').of === 1 && salle.rankOf('c1') === null);
  /* Le souffle est arrêté au départ : le battement ne le touche plus. */
  const souffleParti = m.breath;
  salle.tick(Date.now() + 5000);
  check('le battement ne le touche plus : son souffle n’a pas bougé',
    m.breath === souffleParti && Math.round(souffleParti) === 30);

  /* Il revient cinq secondes plus tard, dans son camp — c'est l'entrée qui le
     décide, voir (f) plus bas. L'état se compare à l'entrée, avant tout
     battement : la carte suivante, elle, a couru pendant l'absence et
     tombera au premier. */
  const vrai = Date.now;
  Date.now = () => vrai() + 5_000;
  let vue, apres;
  try {
    vue = salle.join('c1', { side: 0, name: 'Un', actions: TOUTES });
    apres = JSON.stringify({ main: m.main, pioche: m.pioche, defausse: m.defausse,
      cooldowns: m.cooldowns, ferveur: m.ferveur, fatigueUntil: m.fatigueUntil, side: m.side });
    /* Le battement qui suit son retour ne lui compte pas son absence : le
       souffle ne remonte que pour qui est là. */
    salle.tick(Date.now());
  } finally { Date.now = vrai; }
  check('au retour, c’est le même supporter', salle.members.get('c1') === m && !salle.partis.has('c1'));
  check('le même souffle, au point près, même après le premier battement',
    vue.you.breath === 30 && Math.round(m.breath) === 30
    || (console.log(`        ${vue.you.breath} à l’entrée, ${Math.round(m.breath)} au battement`), false));
  check('la même main, la même pioche, les mêmes recharges, la même fatigue, la même ferveur',
    apres === avant || (console.log('        avant', avant, '\n        après', apres), false));
  check('la recharge est annoncée à la page', (vue.you.cooldowns[jouee] ?? 0) > 0);
  m.main = [jouee]; m.breath = 100;
  let refus = null;
  try { salle.jouer('c1', jouee); } catch (e) { refus = e.code; }
  check('rejouer la carte aussitôt est refusé', refus === 'ferveur.error.card_on_cooldown');

  /* Le témoin : sans départ, rien ne change non plus. */
  const avant2 = JSON.stringify(m.cooldowns);
  salle.join('c1', { side: 0, name: 'Un', actions: TOUTES });
  check('rejoindre sans partir ne redistribue rien non plus', JSON.stringify(m.cooldowns) === avant2);
}

/* =========================================================== D2, la socket */

console.log('\nD2 — le vrai chemin : une socket coupée, une socket neuve');
{
  const A = io.connecter('d2');
  await entrer(A, 1002);
  const salle = V.rooms.get(1002);
  const m = salle.members.get('d2');
  const carte = 'a-fumigene';
  m.main[0] = carte; m.breath = 100;
  A.fire('virage:jouer', { cardId: carte });
  check('une carte jouée par la socket', await until(() => A.compte('virage:vous') === 1));
  A.couper();
  check('la coupure le fait partir', !salle.members.has('d2') && salle.partis.has('d2'));
  const souffle = Math.round(m.breath);

  const B = io.connecter('d2');
  await entrer(B, 1002);
  const vue = B.dernier('virage:state');
  check('la socket neuve retrouve la recharge', (vue?.you?.cooldowns?.[carte] ?? 0) > 0);
  check('et le souffle laissé en partant', vue?.you?.breath === souffle
    || (console.log(`        ${souffle} en partant, ${vue?.you?.breath} au retour`), false));
  m.main = [carte]; m.breath = 100;
  B.fire('virage:jouer', { cardId: carte });
  check('la rejouer depuis la socket neuve est refusé',
    await until(() => B.erreurs().includes('ferveur.error.card_on_cooldown')));
  B.couper();
}

/* ================================================================= D3 */

console.log('\nD3 — une socket, pas un joueur');
{
  /* (a) Deux onglets, le premier se ferme : le second chante encore. C'est
     aussi l'ordre du téléphone qui change de réseau — la socket neuve entre
     avant que le serveur ne constate la mort de l'ancienne. */
  const A = io.connecter('d3a'), B = io.connecter('d3a');
  await entrer(A, 1003); await entrer(B, 1003);
  const salle = V.rooms.get(1003);
  A.couper();
  check('fermer un onglet ne vide pas la place', salle.members.has('d3a'));
  check('l’autre onglet chante encore', await chanter(B, salle, 'd3a') === 'result');
  check('et il est toujours dans la salle socket', B.rooms.has('virage:1003'));
  B.couper();
  check('à la dernière socket, il part', !salle.members.has('d3a') && salle.partis.has('d3a'));
}
{
  /* (b) Le même, par `virage:leave`. */
  const A = io.connecter('d3b'), B = io.connecter('d3b');
  await entrer(A, 1004); await entrer(B, 1004);
  const salle = V.rooms.get(1004);
  A.fire('virage:leave');
  check('quitter depuis un onglet ne sort pas l’autre', salle.members.has('d3b'));
  check('l’onglet parti ne reçoit plus la salle', !A.rooms.has('virage:1004'));
  check('l’autre chante encore', await chanter(B, salle, 'd3b') === 'result');
  A.fire('virage:chant', { cardId: 'reprise', taps: [] });
  check('l’onglet parti, lui, n’y chante plus',
    await until(() => A.erreurs().includes('ferveur.error.not_in_virage')));
  B.fire('virage:leave');
  check('le second départ fait partir le joueur', !salle.members.has('d3b'));
  A.couper(); B.couper();
}
{
  /* (c) Deux onglets sur deux matchs : chacun chante dans le sien, et
     personne ne reste derrière. */
  const C = io.connecter('d3c'), D = io.connecter('d3c');
  await entrer(C, 1005); await entrer(D, 1006);
  const X = V.rooms.get(1005), Y = V.rooms.get(1006);
  const avantX = X.members.get('d3c').lastPush;
  check('le chant de chaque onglet va dans sa salle',
    await chanter(D, Y, 'd3c') === 'result' && X.members.get('d3c').lastPush === avantX);
  D.couper();
  check('fermer l’un laisse l’autre', X.members.has('d3c') && !Y.members.has('d3c'));
  check('qui chante encore', await chanter(C, X, 'd3c') === 'result');
  C.couper();
  check('aucun fantôme : les deux salles sont vides', X.size === 0 && Y.size === 0);
  check('et aucune n’est plus relevée',
    !V.sallesOccupees().includes(1005) && !V.sallesOccupees().includes(1006));
}
{
  /* (d) Une socket du même joueur qui n'a jamais rejoint — un onglet KOP,
     Équipes, duel — se ferme : le Virage continue. */
  const A = io.connecter('d3d');
  await entrer(A, 1007);
  const salle = V.rooms.get(1007);
  const K = io.connecter('d3d');
  K.couper();
  check('une socket qui n’a jamais rejoint ne fait rien en partant', salle.members.has('d3d'));
  K.fire('virage:leave');
  check('ni en quittant', salle.members.has('d3d'));
  check('le Virage d’à côté chante toujours', await chanter(A, salle, 'd3d') === 'result');
  A.couper();
}
{
  /* (e) Une socket qui passe d'un match à l'autre quitte le premier. */
  const A = io.connecter('d3e');
  await entrer(A, 1008);
  await entrer(A, 1009);
  const X = V.rooms.get(1008), Y = V.rooms.get(1009);
  check('changer de match quitte le premier', !X.members.has('d3e') && X.partis.has('d3e'));
  check('et la salle socket avec', !A.rooms.has('virage:1008') && A.rooms.has('virage:1009'));
  check('le chant part dans le second', await chanter(A, Y, 'd3e') === 'result');
  check('le premier n’est plus relevé pour lui', !V.sallesOccupees().includes(1008));
  /* Revenir dans la même salle ne la quitte pas. */
  await entrer(A, 1009);
  check('rejoindre la même salle ne détache rien', Y.members.has('d3e') && A.rooms.has('virage:1009'));
  A.couper();
}
{
  /* (f) Le neutre qui se reconnecte : la page renvoie `virage:join` sans camp. */
  NEUTRES.add('d3f');
  const A = io.connecter('d3f');
  await entrer(A, 1010, 'exterieur');
  check('le neutre pousse à l’extérieur', A.dernier('virage:state')?.you?.side === 1);
  const B = io.connecter('d3f');
  await entrer(B, 1010);
  check('un second onglet sans camp ne le remet pas à domicile',
    B.dernier('virage:state')?.you?.side === 1);
  A.couper(); B.couper();
  const C = io.connecter('d3f');
  await entrer(C, 1010);
  check('ni la reconnexion après un départ', C.dernier('virage:state')?.you?.side === 1);
  /* Le KOP se lit sur le camp : celui de l'extérieur, et non celui qu'une
     demande sans camp aurait déduit. */
  const kops = kopDemandes.filter((d) => d.userId === 'd3f').map((d) => d.club);
  check('et le KOP qu’on lui compose est celui de son camp',
    kops.length === 3 && kops.every((c) => c === AWAY)
    || (console.log('        clubs demandés :', kops.join(' ')), false));

  /* Mais un camp demandé est un camp choisi. « Je me suis trompé de camp, je
     ressors et je rechoisis » : la page repose la question à chaque entrée
     depuis la liste, et dessine tout d'après la réponse du serveur. */
  C.fire('virage:leave');
  await entrer(C, 1010, 'domicile');
  check('un neutre qui ressort et rechoisit obtient le camp demandé',
    C.dernier('virage:state')?.you?.side === 0
    || (console.log('        camp rendu :', C.dernier('virage:state')?.you?.side), false));
  check('la salle le range de ce côté-là', V.rooms.get(1010).members.get('d3f')?.side === 0);
  check('et le KOP suit le camp choisi',
    kopDemandes.filter((d) => d.userId === 'd3f').at(-1)?.club === HOME);
  C.couper();
}
{
  /* Chez soi, le camp ne se choisit pas : un supporter du club à domicile qui
     demande l'extérieur pousse à domicile, à l'entrée comme au retour. */
  const A = io.connecter('d3f2');
  await entrer(A, 1013, 'exterieur');
  const entree = A.dernier('virage:state')?.you?.side;
  A.fire('virage:leave');
  await entrer(A, 1013, 'exterieur');
  check('chez soi, le camp découle du club suivi, à l’entrée comme au retour',
    entree === 0 && A.dernier('virage:state')?.you?.side === 0);
  A.couper();
}
{
  /* Un neutre qui se met à suivre le club à domicile en cours de match, puis
     revient : il pousse pour son club, et à ferveur pleine. Gardé tel quel,
     son ancien camp le faisait pousser contre lui — sans la demi-ferveur du
     neutre, puisque celle-ci, elle, était recalculée. */
  NEUTRES.add('d3f3');
  const A = io.connecter('d3f3');
  await entrer(A, 1014, 'exterieur');
  A.couper();
  NEUTRES.delete('d3f3');
  const B = io.connecter('d3f3');
  await entrer(B, 1014);
  const m = V.rooms.get(1014).members.get('d3f3');
  check('un neutre devenu supporter revient dans la tribune de son club',
    m?.side === 0 && m?.neutre === false
    || (console.log('        ', { side: m?.side, neutre: m?.neutre }), false));
  B.couper();
}
{
  /* (g) La socket se ferme pendant que l'entrée lit la base : elle n'entre
     pas, et ne laisse aucun fantôme derrière elle. */
  const lacher = retenir('d3g');
  const A = io.connecter('d3g');
  A.fire('virage:join', { fixtureId: 1011 });
  await until(() => V.rooms.has(1011));
  A.couper();
  lacher();
  await wait(60);
  const salle = V.rooms.get(1011);
  check('une socket fermée pendant l’entrée n’y entre pas',
    !salle.members.has('d3g') && !salle.partis.has('d3g'));
  check('et la salle n’est pas relevée pour un fantôme', !V.sallesOccupees().includes(1011));
}
{
  /* (h) La page ressort (`virage:leave`) pendant que l'entrée lit la base :
     l'entrée qui arrive ensuite n'est plus celle qu'on attend. */
  const lacher = retenir('d3h');
  const A = io.connecter('d3h');
  A.fire('virage:join', { fixtureId: 1012 });
  await until(() => V.rooms.has(1012));
  A.fire('virage:leave');
  lacher();
  await wait(60);
  const salle = V.rooms.get(1012);
  check('une entrée dont la page est ressortie entre-temps ne s’assied pas',
    !salle.members.has('d3h') && !A.rooms.has('virage:1012'));
  check('et la salle n’est pas relevée pour elle', !V.sallesOccupees().includes(1012));
  await entrer(A, 1012);
  check('la page peut toujours y entrer ensuite', salle.members.has('d3h'));
  A.couper();

  /* Le même, dans le même paquet : la sortie arrive avant même que le corps
     de l'entrée ait commencé. */
  const B = io.connecter('d3h2');
  B.fire('virage:join', { fixtureId: 1012 });
  B.fire('virage:leave');
  await wait(60);
  check('une sortie arrivée dans le même paquet que l’entrée l’emporte aussi',
    !salle.members.has('d3h2') && !B.rooms.has('virage:1012'));
  B.couper();
}

/* ===================================== le plafond des Virages classés

   Le compteur de l'abonnement lit les lignes de présence, et une ligne
   n'existe qu'à la première poussée ; sa colonne `classe` est écrite à
   l'insertion et jamais mise à jour. Le faux store fait exactement ça. Sur
   une instance à part : les autres blocs montent le Virage sans plafond. */

console.log('\nLe plafond des Virages classés ne se contourne pas');
{
  const lignes = new Map();             // `${userId}|${fixtureId}` -> { classe }
  const envoyes = new Map();            // `${userId}|${fixtureId}` -> dernier `classe` envoyé
  const souvenirs = { recordPush: async (p) => {
    const cle = `${p.userId}|${p.fixtureId}`;
    if (!lignes.has(cle)) lignes.set(cle, { classe: p.classe === false ? 0 : 1 });
    envoyes.set(cle, p.classe);
  } };
  const PLAFOND = 1;
  const classes = (u) => [...lignes].filter(([k, l]) => k.startsWith(`${u}|`) && l.classe === 1);
  const abonnement = {
    viragesClassesRestants: async (u) => Math.max(0, PLAFOND - classes(u).length),
  };
  const io3 = fauxIo();
  const W = monter(io3, { abonnement, souvenirs });
  try {
    /* 1. Le parcours normal de la page : on regarde trois tribunes au coup
       d'envoi, sans chanter, on ressort par la flèche, puis on revient
       chanter dans les trois. */
    const s = io3.connecter('cap1');
    for (const id of [1040, 1041, 1042]) { await entrer(s, id); s.fire('virage:leave'); }
    for (const id of [1040, 1041, 1042]) {
      await entrer(s, id);
      await chanter(s, W.rooms.get(id), 'cap1');
      s.fire('virage:leave');
    }
    check('regarder trois tribunes puis revenir y chanter : un seul Virage classé',
      classes('cap1').length === 1
      || (console.log('        classés :', classes('cap1').map(([k]) => k).join(' ')), false));
    check('celui où il a chanté le premier', lignes.get('cap1|1040')?.classe === 1);
    s.couper();

    /* 1b. Deux onglets ouverts sur deux matchs avant tout chant. */
    const a = io3.connecter('cap2'), b = io3.connecter('cap2');
    await entrer(a, 1043); await entrer(b, 1044);
    const chants = [await chanter(a, W.rooms.get(1043), 'cap2'),
      await chanter(b, W.rooms.get(1044), 'cap2')];
    check('deux onglets sur deux matchs chantent chacun', chants.every((c) => c === 'result'));
    check('mais un seul de leurs Virages est classé', classes('cap2').length === 1
      || (console.log('        classés :', classes('cap2').map(([k]) => k).join(' ')), false));
    a.couper(); b.couper();

    /* 1c. Regarder une tribune puis aller jouer ailleurs : c'est celle où l'on
       joue qui compte. Une réservation laissée en partant ne doit pas la lui
       prendre. */
    const c = io3.connecter('cap3');
    await entrer(c, 1045); c.fire('virage:leave');
    await entrer(c, 1046);
    await chanter(c, W.rooms.get(1046), 'cap3');
    check('regarder une tribune sans y chanter ne prend pas la place de celle où l’on joue',
      lignes.get('cap3|1046')?.classe === 1);
    c.couper();

    /* 1d. Une présence écrite garde sa décision : un tunnel qui coupe le
       réseau ne fait pas cesser de compter un match commencé compté. */
    const d = io3.connecter('cap4');
    await entrer(d, 1047);
    await chanter(d, W.rooms.get(1047), 'cap4');
    d.couper();
    const e = io3.connecter('cap4');
    await entrer(e, 1047);
    check('une fois la présence écrite, revenir ne rouvre pas la question',
      W.rooms.get(1047).members.get('cap4')?.classe === true);
    e.couper();

    /* 1e. Et dans l'autre sens : hors classement une fois écrit, il le
       reste. Un retour qui ne lit plus le compteur ne doit pas le remettre
       au classement en passant. */
    const f = io3.connecter('cap5');
    await entrer(f, 1048);
    await chanter(f, W.rooms.get(1048), 'cap5');            // la place du jour
    f.fire('virage:leave');
    await entrer(f, 1049);
    await chanter(f, W.rooms.get(1049), 'cap5');            // au-delà : hors classement
    f.fire('virage:leave');
    await entrer(f, 1049);
    await chanter(f, W.rooms.get(1049), 'cap5');
    check('hors classement une fois la présence écrite, le retour l’y laisse',
      W.rooms.get(1049).members.get('cap5')?.classe === false
      && envoyes.get('cap5|1049') === false && lignes.get('cap5|1049')?.classe === 0);
    f.couper();
  } finally { W.stop(); }
}

/* ================================================== la minute double */

console.log('\nLa fin de la minute double est diffusée');
{
  const emis = [];
  const salle = new VirageRoom({
    fixture: { id: 9002, homeId: HOME, awayId: AWAY, homeName: 'A', awayName: 'B' },
    emit: (e, p) => emis.push({ e, p }), onPush: () => {}, log: { warn() {}, error() {} },
  });
  salle.join('s1', { side: 0, name: 'Un' });
  const t0 = Date.now();
  salle.realGoal({ teamId: HOME, minute: 10, player: 'Diallo' });
  const but = emis.find((x) => x.e === 'virage:real_goal')?.p;
  check('le but porte la durée de la minute double', but?.surgeMs === RULES.surgeAfterRealGoalMs);
  check('à côté de l’instant, qui reste', typeof but?.surgeUntil === 'number'
    && Math.abs(but.surgeUntil - but.surgeMs - t0) < 1000);
  const vue = salle.snapshotFor('s1');
  check('l’état la porte aussi, entre 0 et 60 s', vue.surgeMs > 0 && vue.surgeMs <= 60_000);

  emis.length = 0;
  const fin = salle.surgeUntil;
  for (let t = t0 + 100; t <= fin + 1000; t += 100) salle.tick(t);
  const ticks = emis.filter((x) => x.e === 'virage:tick');
  const eteinte = ticks.filter((x) => x.p.surge === false);
  check('l’ouverture part au battement suivant', ticks[0]?.p.surge === true);
  check('et la fin part, alors que rien d’autre n’a bougé', eteinte.length === 1
    || (console.log('        ticks :', ticks.map((x) => x.p.surge).join(' ')), false));
  check('une seule fois, sans bavarder entre les deux', ticks.length === 2);
}

/* ======================================================= la Remontada */

console.log('\nLa Remontada lit le vrai score');
{
  /* Une salle ouverte à la soixantième minute d'un 0–2 : aucun but n'y a été
     vu tomber, `realGoals` vaut 0–0. */
  const salle = new VirageRoom({
    fixture: { id: 9003, homeId: HOME, awayId: AWAY, homeName: 'A', awayName: 'B',
      homeGoals: 0, awayGoals: 2, status: '2H', elapsed: 60 },
    emit: () => {}, onPush: () => {}, log: { warn() {}, error() {} },
  });
  salle.join('mene', { side: 0, name: 'Mené' });
  salle.join('mene-pas', { side: 1, name: 'Devant' });
  const essayer = (qui) => {
    const m = salle.members.get(qui);
    m.main = ['a-remontada']; m.breath = 100; m.cooldowns = {};
    try { salle.jouer(qui, 'a-remontada'); return 'jouee'; } catch (e) { return e.code; }
  };
  check('mené 0–2, on peut la jouer', essayer('mene') === 'jouee');
  check('devant, on ne peut pas', essayer('mene-pas') === 'ferveur.error.condition_not_met');
}

/* ======================================================= la libération

   En dernier, et sur une instance à part : on y avance l'horloge, et toute
   salle vide d'une autre instance serait libérée avec. */

console.log('\nUne salle vide se libère quand ce qu’elle garde ne sert plus');
{
  const io2 = fauxIo();
  const W = monter(io2);
  const vrai = Date.now;
  /* Un décalage depuis l'heure vraie, et non un cumul : chaque appel dit
     « nous sommes à telle distance du départ du dernier », et `Date.now =
     vrai` ramène tout le monde au présent. */
  const avancer = async (ms) => { Date.now = () => vrai() + ms; await wait(RULES.tickMs * 4); };
  try {
    /* (a) Seul en tribune, on ferme l'onglet à la mi-temps. Le serveur
       constate la coupure, et le joueur revient une minute plus tard, ou
       deux heures : la salle l'attend, avec ce que la base n'a pas. */
    poserMatch(1020, { status_short: 'HT', elapsed: 45 });
    const A = io2.connecter('l1');
    await entrer(A, 1020);
    const salle = W.rooms.get(1020);
    const m = salle.members.get('l1');
    m.ferveur = 900; m.breath = 95; m.regenAt = Date.now();
    salle.goals = [3, 1];
    A.couper();
    await wait(RULES.tickMs * 3);
    check('une salle vide reste ouverte', W.rooms.get(1020) === salle);
    await avancer(61_000);
    check('à la mi-temps, vide depuis une minute, elle l’est encore, malgré le battement',
      W.rooms.get(1020) === salle);
    check('avec son parti et le score de sa tribune',
      salle.partis.get('l1') === m && JSON.stringify(salle.goals) === '[3,1]');
    await avancer(2 * 3600_000);
    check('et tant que le match peut se jouer, même vide depuis deux heures',
      W.rooms.get(1020) === salle);
    Date.now = vrai;
    const B = io2.connecter('l1');
    await entrer(B, 1020);
    check('qui revient retrouve sa salle, sa ferveur et son souffle',
      W.rooms.get(1020) === salle && salle.members.get('l1') === m && m.ferveur === 900
      && B.dernier('virage:state')?.you?.breath === 95
      || (console.log('        ', { meme: W.rooms.get(1020) === salle, ferveur: m.ferveur,
        souffle: B.dernier('virage:state')?.you?.breath }), false));

    /* (b) Trois heures après le coup d'envoi, le match ne peut plus se jouer
       — prolongation et tirs au but compris : une demi-heure de vide la
       libère, partis compris. La salle vide n'est plus relevée, et
       n'apprendrait jamais le coup de sifflet qu'elle attendrait. Le relevé
       lui donne un coup d'envoi d'il y a trois heures, et le dernier part. */
    W.matchStatus(1020, { status: '2H', elapsed: 90,
      kickoffAt: new Date(Date.now() - 3 * 3600_000 - 60_000).toISOString() });
    B.couper();
    await avancer(29 * 60_000);
    check('trois heures après le coup d’envoi, moins d’une demi-heure de vide ne la libère pas',
      W.rooms.get(1020) === salle);
    await avancer(31 * 60_000);
    check('une demi-heure de vide, si, partis compris', !W.rooms.has(1020));
    Date.now = vrai;
    const C = io2.connecter('l1');
    await entrer(C, 1020);
    const neuve = W.rooms.get(1020);
    check('qui revient trouve une salle neuve', neuve !== salle);
    check('et la libération a emporté le parti', neuve.members.get('l1')?.ferveur === 0);

    /* (c) Une socket encore attachée garde la salle, même sans membre. */
    neuve.members.clear();
    await avancer(5 * 3600_000);
    check('une socket encore là garde la salle ouverte', W.rooms.has(1020));
    Date.now = vrai;
    C.couper();

    /* (d) Un match fini, lui, ne bougera plus : une minute suffit. */
    const D1 = io2.connecter('l2');
    await entrer(D1, 1021);
    W.matchStatus(1021, { status: 'FT', elapsed: 90 });
    D1.couper();
    await avancer(61_000);
    check('une salle finie et vide depuis une minute est libérée', !W.rooms.has(1021));
    Date.now = vrai;

    /* (e) Un report aussi, lu en base. */
    poserMatch(1023, { status_short: 'PST' });
    const D2 = io2.connecter('l2b');
    await entrer(D2, 1023);
    D2.couper();
    await avancer(61_000);
    check('une salle sur un match reporté, vide depuis une minute, est libérée', !W.rooms.has(1023));
    Date.now = vrai;

    /* (f) La course : la salle se libère pendant que quelqu'un lit la base
       pour y entrer. Il doit finir dans une salle qui bat encore. Sur un
       match fini, le seul où une minute suffit à la libérer. La minute reste
       à zéro : à la 90e, le répertoire n'offre plus « reprise », le seul
       chant que `chanter` sait taper, et le dernier contrôle échouait sur le
       répertoire et non sur la salle. */
    poserMatch(1022, { status_short: 'FT' });
    const D = io2.connecter('l3');
    await entrer(D, 1022);
    D.couper();
    const lacher = retenir('l4');
    const E = io2.connecter('l4');
    E.fire('virage:join', { fixtureId: 1022 });
    await wait(30);
    await avancer(122_000);
    const libereeEnRoute = !W.rooms.has(1022);
    lacher();
    await until(() => E.compte('virage:state') > 0);
    Date.now = vrai;
    check('la salle s’est libérée pendant l’entrée (le cas est bien joué)', libereeEnRoute);
    check('l’entrant finit dans une salle que l’horloge fait battre',
      W.rooms.get(1022)?.members.has('l4') === true);
    check('et il y chante', await chanter(E, W.rooms.get(1022), 'l4') === 'result');
    E.couper();
  } finally {
    Date.now = vrai;
    W.stop();
  }
}

/* ======================================= ce que le relevé a vu survit

   Une salle rouverte relit en base le statut et l'heure que le relevé vient
   d'y écrire ; il ne lui manquait que de savoir qu'un relevé les avait vus.
   Sans cette mémoire, le relevé « une fois » d'un statut lu en base se
   refaisait à chaque ouverture — trente matchs lointains visités trois
   minutes par heure coûtaient sept cent vingt appels par jour. Ouvrir, faire
   voir le match au relevé, libérer, rouvrir : zéro relevé de plus, puis au
   plus un par demi-heure. Sur une instance à part, pour la même raison que
   plus haut. */

console.log('\nUne salle libérée puis rouverte ne repaie pas le relevé');
{
  const io4 = fauxIo();
  const W = monter(io4);
  const vrai = Date.now;
  const avancer = async (ms) => { Date.now = () => vrai() + ms; await wait(RULES.tickMs * 4); };
  try {
    const CAS = [
      /* Reporté : une minute de vide le libère. */
      { id: 1024, st: 'PST', coup: -20 * 86400_000, vide: 61_000, demiHeure: true },
      /* À venir demain : hors de la fenêtre du match, une demi-heure. */
      { id: 1025, st: 'NS', coup: 86400_000, vide: 31 * 60_000, demiHeure: false },
      /* Suspendu depuis six heures : de même. */
      { id: 1026, st: 'SUSP', coup: -6 * 3600_000, vide: 31 * 60_000, demiHeure: true },
    ];
    for (const c of CAS) {
      const coupDEnvoi = new Date(Date.now() + c.coup);
      poserMatch(c.id, { status_short: c.st, kickoff_at: coupDEnvoi });
      const s = io4.connecter(`r${c.id}`);
      await entrer(s, c.id);
      const salle = W.rooms.get(c.id);
      const avantReleve = W.sallesOccupees().includes(c.id);
      /* Le relevé le voit, et confirme ce que dit la base. */
      W.matchStatus(c.id, { status: c.st, kickoffAt: coupDEnvoi.toISOString() });
      const apresReleve = W.sallesOccupees().includes(c.id);
      s.couper();
      await avancer(c.vide);
      const liberee = !W.rooms.has(c.id);
      Date.now = vrai;
      const t = io4.connecter(`r${c.id}`);
      await entrer(t, c.id);
      const rouverte = W.rooms.has(c.id) && W.rooms.get(c.id) !== salle;
      const aussitot = W.sallesOccupees().includes(c.id);
      const plusTard = W.sallesOccupees(Date.now() + 31 * 60_000).includes(c.id);
      check(`${c.st} : relevé une fois, libéré, rouvert — et pas un relevé de plus`,
        avantReleve && !apresReleve && liberee && rouverte && !aussitot
        || (console.log('        ', { avantReleve, apresReleve, liberee, rouverte, aussitot }), false));
      check(`${c.st} : ${c.demiHeure ? 'puis un coup d’œil par demi-heure'
        : 'ni à la demi-heure : il est loin'}`, plusTard === c.demiHeure);
      t.couper();
    }
    /* Vu par le relevé avant toute salle — le match d'un club suivi, ou une
       salle libérée depuis : la salle qui s'ouvre le sait aussi. */
    poserMatch(1027, { status_short: 'PST', kickoff_at: new Date(Date.now() - 86400_000) });
    W.matchStatus(1027, { status: 'PST' });
    const u = io4.connecter('r1027');
    await entrer(u, 1027);
    check('vu par le relevé avant toute salle : la salle qui s’ouvre ne le repaie pas',
      !W.sallesOccupees().includes(1027));
    u.couper();
  } finally {
    Date.now = vrai;
    W.stop();
  }
}

/* ==================================== un regard qui a vieilli s'oublie

   Ce que le relevé a vu survit à la salle — c'est ce qui borne le coût des
   visites. Mais un match regardé par un lien à la veille, puis avancé à
   aujourd'hui, rouvrait sa salle sur la ligne de ce regard, « à venir
   demain », et le relevé ne le regardait plus : figé tout le match. À
   l'entrée, la journée — le cache de la liste — le contredit, et l'on oublie
   ce regard. Sur une instance à part, avec une journée. */

console.log('\nUn regard que la journée contredit s’oublie à l’entrée');
{
  const io5 = fauxIo();
  let duJour = [];
  const jourDuFoot = async () => ({ groupes: [{ ligue: { id: 61, name: 'L' }, matchs: duJour }] });
  const W = monter(io5, { jourDuFoot });
  const vrai = Date.now;
  const avancer = async (ms) => { Date.now = () => vrai() + ms; await wait(RULES.tickMs * 4); };
  const ligne = (id, date, status) => ({ id, date: new Date(date).toISOString(), status,
    home: { id: HOME }, away: { id: AWAY } });
  try {
    const demain = Date.now() + 86400_000;
    const CAS = [
      /* Avancé à aujourd'hui, et déjà commencé quand on entre depuis la liste. */
      { id: 1050, nom: 'avancé et commencé', jour: (t) => ligne(1050, t - 10 * 60_000, '1H'), releve: true },
      /* Avancé à tout à l'heure, toujours à venir : l'heure seule contredit. */
      { id: 1051, nom: 'avancé, encore à venir', jour: (t) => ligne(1051, t + 20 * 60_000, 'NS'), releve: true },
      /* Le témoin : la journée dit la même chose que la salle. */
      { id: 1052, nom: 'la journée d’accord', jour: () => ligne(1052, demain, 'NS'), releve: false },
    ];
    const salles = new Map();
    for (const c of CAS) {
      poserMatch(c.id, { status_short: 'NS', kickoff_at: new Date(demain) });
      const s = io5.connecter(`j${c.id}`);
      await entrer(s, c.id);
      salles.set(c.id, W.rooms.get(c.id));
      // Le relevé le voit, à demain : il sort du relevé.
      W.matchStatus(c.id, { status: 'NS', kickoffAt: new Date(demain).toISOString() });
      s.couper();
    }
    check('vus à demain par le relevé, aucun n’est plus relevé',
      CAS.every((c) => !W.sallesOccupees().includes(c.id)));
    // Une demi-heure de vide, hors de la fenêtre du match : les salles sont libérées.
    await avancer(31 * 60_000);
    const liberees = CAS.every((c) => !W.rooms.has(c.id));
    Date.now = vrai;
    check('leurs salles sont libérées (le cas est bien joué)', liberees);
    // L'API les avance ; la base, que personne n'a relevée, dit encore demain.
    duJour = CAS.map((c) => c.jour(Date.now()));
    for (const c of CAS) {
      const t = io5.connecter(`k${c.id}`);
      await entrer(t, c.id);
      const rouverte = W.rooms.get(c.id);
      const releve = W.sallesOccupees().includes(c.id);
      check(`${c.nom} : ${c.releve ? 'la salle rouverte est relevée au tour suivant'
        : 'le regard tient, pas un relevé de plus'}`,
        rouverte !== salles.get(c.id) && releve === c.releve
        || (console.log('        ', { rouverte: rouverte !== salles.get(c.id), releve }), false));
      t.couper();
    }
  } finally {
    Date.now = vrai;
    W.stop();
  }
}

/* ==================================== l'API qui ne répond pas, ou qui ment

   Deux fuites d'enveloppe. Le vrai relevé, branché comme dans `server.js`
   (`fixturesAuFil` = `sallesOccupees`, `onStatus` = `matchStatus`,
   `onAbsent` = `matchAbsent`), sur un faux client qui compte ses appels — et
   qui tombe en panne quand on le lui dit — et un faux store, sans base : on
   joue les tours un à un, l'horloge réglée sur l'heure de chacun. Le quota du
   jour est de 6 800 appels. */

console.log('\nUne salle sur un match que l’API ne rend pas, ou laisse en jeu');
{
  const io6 = fauxIo();
  const W = monter(io6);
  /* Ce que l'API répond d'un match à l'instant `t` : { st, el, hg, ag, ko },
     ou null pour un match qu'elle ne rend pas. */
  const API = new Map();
  const appels = [];
  const lignes = new Map();
  /* Vrai à l'instant `t` : le lot du direct lève, comme le client sur une
     erreur de l'API ou un quota épuisé. */
  let panne = () => false;
  const P = createPoller({
    client: {
      async fixturesByIds(ids) {
        appels.push({ t: Date.now(), q: 'direct', ids: [...ids] });
        if (panne(Date.now())) throw new Error('API-Football 503');
        return ids.map((id) => {
          const e = API.get(id)?.(Date.now());
          return e && { fixture: { id, date: new Date(e.ko).toISOString(),
            status: { short: e.st, elapsed: e.el ?? null } },
            league: { id: 61, season: 2026 }, teams: { home: { id: HOME }, away: { id: AWAY } },
            goals: { home: e.hg ?? null, away: e.ag ?? null } };
        }).filter(Boolean);
      },
      async eventsOfFixture(id) { appels.push({ t: Date.now(), q: 'evenements', ids: [id] }); return []; },
    },
    store: {
      liveFixtureIds: async () => [], dueToStartIds: async () => [],
      async upsertFixture(f) {
        const b = lignes.get(f.id) ?? null;
        lignes.set(f.id, { home_goals: f.homeGoals, away_goals: f.awayGoals,
          status_short: f.status, elapsed: f.elapsed });
        return b;
      },
      eventsOf: async () => [], insertEvents: async () => 0,
    },
    fixturesAuFil: () => W.sallesOccupees(),
    onStatus: (id, e) => W.matchStatus(id, e),
    onAbsent: (id) => W.matchAbsent(id),
    onEvents: (id, e) => W.matchEvents(id, e),
    log: { error() {}, warn() {} },
  });
  /* Des tours à `pas` d'intervalle, de `t0` à `t0 + duree`. Tout se résout en
     microtâches : l'horloge des salles ne bat pas pendant qu'on la règle. Un
     tour en panne ne fait pas tomber les suivants, comme `safely` dans la
     boucle ; hors panne, une erreur reste une erreur. */
  const vrai = Date.now;
  async function tourner(t0, duree, pas) {
    try {
      for (let t = t0; t < t0 + duree; t += pas) {
        Date.now = () => t;
        try { await P.pollLive(); } catch (e) { if (!panne(t)) throw e; }
      }
    } finally { Date.now = vrai; }
  }
  const de = (id, q, a, b) =>
    appels.filter((x) => x.ids.includes(id) && (!q || x.q === q) && x.t >= a && x.t < b);
  try {
    /* Un match que l'API ne rend jamais — supprimé, renuméroté —, dont la
       ligne reste en base, et qu'un lien ouvre. Vingt-quatre heures de tours
       à deux minutes : rien n'est en jeu, la boucle ralentit. Il était relevé
       à chaque tour, sept cent vingt fois. */
    poserMatch(1053, { status_short: 'NS', kickoff_at: new Date(Date.now() + 3 * 86400_000) });
    API.set(1053, () => null);
    const s = io6.connecter('f9');
    await entrer(s, 1053);
    const t0 = Date.now();
    await tourner(t0, 24 * 3600_000, 120_000);
    const premiere = de(1053, 'direct', t0, t0 + 30 * 60_000).length;
    const jour = de(1053, null, t0, t0 + 24 * 3600_000).length;
    check('jamais rendu par l’API : demandé à chaque tour la première demi-heure',
      premiere === 15 || (console.log(`        ${premiere} sur 15`), false));
    check('puis un coup d’œil par demi-heure : au plus soixante-cinq appels en 24 h, et non 720',
      jour <= 65 || (console.log(`        ${jour} appels`), false));
    s.couper();

    /* **Rendu, puis plus rendu.** Le match vu une fois garde un regard qui ne
       se rafraîchit plus, et chaque règle qui le compare à maintenant le
       disait à relever à chaque tour : 745 appels en 24 h en jeu, 706 pour
       un report. L'absence passe avant le regard. Dix minutes rendu, puis
       vingt-quatre heures sans. */
    const disparait = async (id, st, nom) => {
      const ko = Date.now() - 3600_000;
      poserMatch(id, { status_short: st, elapsed: st === '2H' ? 60 : null, kickoff_at: new Date(ko) });
      const t = Date.now(), parti = t + 10 * 60_000;
      API.set(id, (x) => (x >= parti ? null : st === '2H'
        ? { st, el: 60 + Math.floor((x - t) / 60_000), hg: 0, ag: 0, ko } : { st, ko }));
      const so = io6.connecter(`f9-${id}`);
      await entrer(so, id);
      await tourner(t, 10 * 60_000, 20_000);
      await tourner(parti, 24 * 3600_000, 120_000);
      const apres = de(id, null, parti, parti + 24 * 3600_000).length;
      check(`${nom}, puis plus rendu : au plus soixante-cinq appels en 24 h après sa disparition, et non 720`,
        apres <= 65 || (console.log(`        ${apres} appels`), false));
      so.couper();
    };
    await disparait(1056, '2H', 'vu en jeu');
    await disparait(1057, 'PST', 'vu reporté');

    /* **Et la salle rouverte par un lien.** Ce que le relevé a vu survit à la
       salle : vu en jeu, quitté, disparu de l'API, salle libérée, puis un
       lien la rouvre six heures plus tard. Elle payait trente appels par
       heure. */
    {
      const ko = Date.now() - 3600_000;
      poserMatch(1058, { status_short: '2H', elapsed: 60, kickoff_at: new Date(ko) });
      const t = Date.now();
      API.set(1058, (x) => (x < t + 30 * 60_000
        ? { st: '2H', el: 60 + Math.floor((x - t) / 60_000), hg: 0, ag: 0, ko } : null));
      const a = io6.connecter('f9-lien');
      await entrer(a, 1058);
      await tourner(t, 20 * 60_000, 20_000);
      a.couper();
      /* Six heures plus tard, l'horloge des salles bat : la salle vide, hors
         de la fenêtre du match, est libérée. */
      const ecart = t + 6 * 3600_000 - vrai();
      const b = io6.connecter('f9-lien-2');
      Date.now = () => vrai() + ecart;
      try {
        await wait(RULES.tickMs * 4);
        check('vu, quitté, disparu : sa salle est libérée (le cas est bien joué)', !W.rooms.has(1058));
        await entrer(b, 1058);
        check('un lien la rouvre', W.rooms.get(1058)?.size === 1);
      } finally { Date.now = vrai; }
      const rouverte = t + 6 * 3600_000 + 1_000;
      await tourner(rouverte, 18 * 3600_000, 120_000);
      const dixHuit = de(1058, 'direct', rouverte, rouverte + 18 * 3600_000).length;
      check('rouverte par un lien six heures après : au plus trois appels par heure, et non trente',
        dixHuit <= 54 || (console.log(`        ${dixHuit} appels en 18 h`), false));
      b.couper();
    }

    /* **Une panne n'est pas une disparition.** Seul un lot qui a répondu sans
       le match le compte absent : dater chaque demande faisait passer quarante
       minutes de panne pour une disparition, et au retour de l'API, une salle
       en jeu attendait sa demi-heure. */
    {
      const ko = Date.now() - 3600_000;
      poserMatch(1059, { status_short: '2H', elapsed: 60, kickoff_at: new Date(ko) });
      const t = Date.now();
      API.set(1059, (x) => ({ st: '2H', el: 60 + Math.floor((x - t) / 60_000), hg: 0, ag: 0, ko }));
      panne = (x) => x >= t + 10 * 60_000 && x < t + 50 * 60_000;
      const p = io6.connecter('f9-panne');
      await entrer(p, 1059);
      try { await tourner(t, 80 * 60_000, 20_000); } finally { panne = () => false; }
      const retour = de(1059, 'direct', t + 50 * 60_000, t + 80 * 60_000).length;
      check('après quarante minutes de panne, la salle en jeu est relevée à chaque tour',
        retour === 90 || (console.log(`        ${retour} sur 90`), false));
      p.couper();
    }

    /* Un match que l'API laisse « 2H, 90' » des heures après la fin. Tours à
       vingt secondes — un autre match en jeu tient la boucle rapide — : 4 320
       relevés du direct et 1 440 d'événements par jour. */
    const ko = Date.now() - 3 * 3600_000;
    poserMatch(1054, { status_short: '2H', elapsed: 90, kickoff_at: new Date(ko) });
    API.set(1054, () => ({ st: '2H', el: 90, hg: 1, ag: 0, ko }));
    const u = io6.connecter('f11');
    await entrer(u, 1054);
    const t1 = Date.now();
    await tourner(t1, 24 * 3600_000, 20_000);
    const premiereHeure = de(1054, 'direct', t1, t1 + 60 * 60_000 + 1).length;
    const fige = de(1054, null, t1, t1 + 24 * 3600_000).length;
    check('figé en jeu : relevé à chaque tour la première heure',
      premiereHeure >= 180 || (console.log(`        ${premiereHeure} sur 181`), false));
    check('puis un coup d’œil par quart d’heure : au plus quatre cent cinquante appels en 24 h, et non 5 760',
      fige <= 450 || (console.log(`        ${fige} appels`), false));
    /* Il se remet à bouger : le premier coup d'œil qui le voit le rend à
       chaque tour. */
    const t2 = t1 + 24 * 3600_000;
    API.set(1054, (t) => ({ st: '2H', el: 60 + Math.floor((t - t2) / 60_000), hg: 1, ag: 0, ko }));
    await tourner(t2, 3600_000, 20_000);
    const repris = de(1054, 'direct', t2, t2 + 3600_000);
    const toursApres = repris.length ? Math.ceil((t2 + 3600_000 - repris[0].t) / 20_000) : 0;
    check('il se remet à bouger : vu au coup d’œil suivant, puis relevé à chaque tour',
      repris.length && repris[0].t - t2 <= 15 * 60_000 && repris.length === toursApres
      || (console.log('        ', { reprisApres: repris.length && (repris[0].t - t2) / 60_000,
        releves: repris.length, toursApres }), false));
    u.couper();

    /* Le témoin : un match qui avance, deux heures durant, mi-temps comprise
       — un quart d'heure à « HT, 45' » sans que rien ne bouge —, est relevé
       à chaque tour. */
    const t3 = Date.now() + 2 * 86400_000;
    poserMatch(1055, { status_short: 'NS', kickoff_at: new Date(t3) });
    API.set(1055, (t) => {
      const m = Math.floor((t - t3) / 60_000);
      const [st, el] = m < 45 ? ['1H', m] : m < 60 ? ['HT', 45] : ['2H', 45 + m - 60];
      return { st, el, hg: 0, ag: 0, ko: t3 };
    });
    const v = io6.connecter('vivant');
    await entrer(v, 1055);
    await tourner(t3, 2 * 3600_000, 20_000);
    const vivant = de(1055, 'direct', t3, t3 + 2 * 3600_000).length;
    check('un match qui avance est relevé à chaque tour, mi-temps comprise', vivant === 360
      || (console.log(`        ${vivant} sur 360`), false));
    v.couper();
  } finally {
    Date.now = vrai;
    W.stop();
  }
}

V.stop();
console.log(`\n${failures ? `${failures} échec(s)` : 'tout est vert'}`);
process.exitCode = failures ? 1 : 0;
