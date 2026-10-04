/**
 * Le relevé du direct : ce qu'il annonce comme un but, et ce qu'il paie.
 *
 * ## Pourquoi une suite à part
 *
 * `football-smoke` éprouve le relevé avec une base et une fausse API servie
 * sur un port ; elle vide la base partagée. Les défauts que ce fichier garde
 * tiennent dans `poller.js` seul : on les éprouve avec le vrai
 * `createPoller`, un faux store qui range et relit comme MySQL (`team_id`,
 * `elapsed`) et un faux client — **sans base, sans réseau et sans port** —,
 * en avançant l'horloge à la main.
 *
 * ## Ce qu'elle garde
 *
 *   - **le penalty manqué** et les tirs de la séance de tirs au but arrivent
 *     de l'API sous le type `Goal`. Aucun ne change le score : aucun ne doit
 *     partir comme un but, ni décaler le rang et le score des buts suivants ;
 *   - **le rejeu** : le premier relevé d'un match ancré depuis la journée
 *     trouvait tous les buts déjà marqués « jamais vus », et les annonçait
 *     comme frais — corde secouée, minute double, cartes de présence pour qui
 *     n'y était pas, score du duel doublé. La fraîcheur se lit en temps réel,
 *     sur ce que le processus a vu : ni une pause de l'horloge de l'API, ni un
 *     relevé vide ou raté ne doivent la tromper. **Ni une sortie** : entrer,
 *     ressortir, revenir — soi-même, après un passant, avec un carton rangé,
 *     après un redémarrage, au bout de deux minutes ou d'un seul tour —
 *     n'annonce pas les buts marqués salle vide, et une panne de l'API, elle,
 *     ne fait rien perdre. **Ni un but en avance** : celui que la liste porte
 *     avant le tableau attend le tableau, puis part ;
 *   - **la ceinture de D1** : un match qui n'est pas en jeu ne paie plus de
 *     relevé d'événements, sauf au tour qui le voit sortir du jeu — et
 *     celui-là relève sans attendre la minute ;
 *   - **l'heure du coup d'envoi** part avec le statut, pour la salle ;
 *   - **l'absence** : un lot du direct qui a répondu sans un match demandé le
 *     signale par `onAbsent` ; un lot en panne ne signale rien.
 */
import { createPoller, estUnBut, mapEvent, LIGNE_FRAICHE_MIN } from '../src/server/football/poller.js';
import { QuotaExhausted } from '../src/server/football/client.js';

let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };

/* L'horloge de la porte d'une minute, avancée à la main. */
const vrai = Date.now;
let decal = 0;
Date.now = () => vrai() + decal;
const avancer = (ms) => { decal += ms; };

const HOME = { id: 85, name: 'Paris' }, AWAY = { id: 91, name: 'Portelle' };
const ev = (min, team, player, detail, { type = 'Goal', comments = null, extra = null } = {}) => ({
  time: { elapsed: min, extra }, team, player: { name: player }, assist: {}, type, detail, comments,
});

/* Un store qui range comme MySQL : `team_id`, et rien de ce que la table n'a
   pas — `comments` n'y est pas. `upsertFixture` rend la ligne d'avant telle
   que `store.js` la relit : buts, statut, minute. */
function fauxStore(lignes = {}, { suivis = [] } = {}) {
  const rows = new Map(Object.entries(lignes).map(([k, v]) => [Number(k), { elapsed: null, ...v }]));
  const evs = new Map();
  return {
    rows, evs,
    liveFixtureIds: async () => suivis, dueToStartIds: async () => [],
    async upsertFixture(f) {
      const b = rows.get(f.id) ?? null;
      rows.set(f.id, { home_goals: f.homeGoals, away_goals: f.awayGoals,
        status_short: f.status, elapsed: f.elapsed });
      return b && { ...b };
    },
    async insertEvents(id, e) {
      if (!e.length) return 0;
      evs.set(id, e.map((x, i) => ({ seq: i, type: x.type, detail: x.detail ?? null,
        team_id: x.teamId, player: x.player ?? null, assist: x.assist ?? null,
        minute: x.minute ?? null, extra: x.extra ?? null })));
      return e.length;
    },
    async eventsOf(id) { return evs.get(id) ?? []; },
  };
}

/* L'API d'un match, et ce qu'on lui demande. `api.panne` fait échouer le
   relevé d'événements comme un quota épuisé, `api.panneDirect` le relevé du
   direct ; `api.date`, l'heure du coup d'envoi qu'elle annonce. */
function fauxClient(id, api) {
  const n = { direct: 0, evenements: 0 };
  return { n,
    async fixturesByIds() {
      n.direct++;
      if (api.panneDirect) throw new QuotaExhausted(0);
      return [{ fixture: { id, date: api.date ?? new Date(vrai()).toISOString(),
        status: { short: api.status, elapsed: api.elapsed }, venue: {} },
        league: { id: 61, season: 2026 }, teams: { home: HOME, away: AWAY },
        goals: { home: api.home, away: api.away } }];
    },
    /* `api.avant` joue ce qui tombe entre les deux appels d'un même tour :
       l'appel d'événements part après le lot du direct. */
    async eventsOfFixture() {
      n.evenements++;
      if (api.panne) throw new QuotaExhausted(0);
      api.avant?.(); api.avant = null;
      return api.events.map((e) => structuredClone(e));
    },
  };
}

const silence = { error() {}, warn() {} };
function poller({ store, client, auFil = [], onStatus }) {
  const buts = [];
  const p = createPoller({ client, store, fixturesAuFil: () => auFil, log: silence, onStatus,
    onGoal: (g) => { buts.push(g); } });
  /* Comme `safely` dans la boucle : un tour qui lève ne fait pas tomber la suite. */
  const tour = async () => { try { await p.pollLive(); } catch (e) {
    if (!(e instanceof QuotaExhausted)) throw e;
  } };
  return { p, buts, tour };
}
const dit = (g) => `${g.minute}' ${g.player} seq${g.seq} [${g.score}]`;

/* ============================================================ ce qui est un but */

console.log('\nCe qui est un but');
{
  const m = (detail, o) => mapEvent(ev(30, HOME, 'X', detail, o));
  check('un but, contre son camp ou sur penalty, compte',
    estUnBut(m('Normal Goal')) && estUnBut(m('Own Goal')) && estUnBut(m('Penalty')));
  check('un penalty manqué ne compte pas', !estUnBut(m('Missed Penalty')));
  check('un tir de la séance de tirs au but ne compte pas, marqué ou non',
    !estUnBut(m('Penalty', { comments: 'Penalty Shootout' }))
    && !estUnBut(m('Missed Penalty', { comments: 'Penalty Shootout' })));
  check('le relevé garde le commentaire qui les distingue',
    m('Penalty', { comments: 'Penalty Shootout' }).comments === 'Penalty Shootout');
  check('un carton n’est pas un but', !estUnBut(m('Yellow Card', { type: 'Card' })));
}

/* ============================================================ le penalty manqué */

console.log('\nLe penalty manqué');
for (const occupee of [false, true]) {
  const ID = occupee ? 5002 : 5001;
  const api = { status: '1H', elapsed: 1, home: 0, away: 0, events: [] };
  const store = fauxStore({}, { suivis: [ID] });
  const { p, buts } = poller({ store, client: fauxClient(ID, api), auFil: occupee ? [ID] : [] });
  const tour = async () => { avancer(120_000); await p.pollLive(); };
  await tour();                                                    // coup d'envoi
  Object.assign(api, { elapsed: 10, home: 1 });
  api.events.push(ev(10, HOME, 'Diallo', 'Normal Goal'));
  await tour();
  Object.assign(api, { elapsed: 30 });
  api.events.push(ev(30, HOME, 'Morel', 'Missed Penalty'));      // score inchangé
  await tour();
  const apresManque = buts.length;
  Object.assign(api, { elapsed: 50, home: 2 });
  api.events.push(ev(50, HOME, 'Diallo', 'Normal Goal'));
  await tour();
  const quoi = occupee ? 'salle occupée' : 'salle vide';
  check(`${quoi} : le penalty manqué n’est pas annoncé`,
    apresManque === 1 && !buts.some((g) => g.player === 'Morel')
    || (console.log('        annoncés :', buts.map(dit).join(' · ')), false));
  check(`${quoi} : deux buts pour un 2–0, rangés 1 et 2, à 1–0 puis 2–0`,
    buts.length === 2 && buts[1].seq === 2 && JSON.stringify(buts.map((g) => g.score)) === '[[1,0],[2,0]]'
    || (console.log('        annoncés :', buts.map(dit).join(' · ')), false));
}

/* ========================================================= les tirs au but */

console.log('\nLa séance de tirs au but');
{
  const ID = 5003;
  const api = { status: 'P', elapsed: 120, home: 1, away: 1, events: [
    ev(30, HOME, 'Diallo', 'Normal Goal'), ev(80, AWAY, 'Keller', 'Normal Goal')] };
  const store = fauxStore({ [ID]: { home_goals: 1, away_goals: 1, status_short: 'ET', elapsed: 120 } });
  // Les deux buts du match sont déjà rangés : on n'éprouve ici que la séance.
  await store.insertEvents(ID, api.events.map(mapEvent));
  const { p, buts } = poller({ store, client: fauxClient(ID, api), auFil: [ID] });
  api.events.push(
    ev(120, HOME, 'Morel', 'Penalty', { comments: 'Penalty Shootout' }),
    ev(120, AWAY, 'Roth', 'Missed Penalty', { comments: 'Penalty Shootout' }),
    ev(120, HOME, 'Bento', 'Penalty', { comments: 'Penalty Shootout' }));
  avancer(61_000); await p.pollLive();
  avancer(61_000); await p.pollLive();
  check('aucun tir de la séance n’est annoncé comme un but de la 120e', buts.length === 0
    || (console.log('        annoncés :', buts.map(dit).join(' · ')), false));
  check('mais ils sont rangés avec le reste du relevé', (store.evs.get(ID) ?? []).length === 5);
}

/* ================================================================ le rejeu */

console.log('\nLe premier relevé d’un match ancré ne rejoue pas ses buts');
const BUTS_21 = () => [ev(12, HOME, 'Diallo', 'Normal Goal'),
  ev(20, AWAY, 'Roth', 'Yellow Card', { type: 'Card' }),
  ev(34, AWAY, 'Keller', 'Normal Goal'),
  ev(50, HOME, 'Bento', 'Penalty')];
{
  /* (a) La ligne du match est à jour — 2–1 à la 61e, posée par l'ancrage —
     et rien n'a jamais été rangé : le premier supporter vient d'entrer. */
  const ID = 7001;
  const api = { status: '2H', elapsed: 61, home: 2, away: 1, events: BUTS_21() };
  const store = fauxStore({ [ID]: { home_goals: 2, away_goals: 1, status_short: '2H', elapsed: 61 } });
  const client = fauxClient(ID, api);
  const { p, buts } = poller({ store, client, auFil: [ID] });
  avancer(1_000); await p.pollLive();
  check('(a) aucun des trois buts d’avant l’entrée n’est rejoué', buts.length === 0
    || (console.log('        rejoués :', buts.map(dit).join(' · ')), false));
  check('(a) mais les quatre événements sont rangés', (store.evs.get(ID) ?? []).length === 4);

  /* (b) Un but frais, deux minutes plus tard : il part, avec son vrai rang. */
  Object.assign(api, { elapsed: 66, home: 3 });
  api.events.push(ev(65, HOME, 'Morel', 'Normal Goal'));
  avancer(130_000); await p.pollLive();
  check('(b) le but suivant part, une fois, au quatrième rang',
    buts.length === 1 && buts[0].seq === 4 && JSON.stringify(buts[0].score) === '[3,1]'
    || (console.log('        annoncés :', buts.map(dit).join(' · ')), false));

  /* (c) Le serveur redémarre : rien n'est rejoué, la base se souvient. */
  const { p: p2, buts: b2 } = poller({ store, client, auFil: [ID] });
  avancer(61_000); await p2.pollLive();
  check('(c) un poller neuf sur la même base ne rejoue rien', b2.length === 0);
}
{
  /* (d) Une ligne périmée, posée par le télétexte : « à venir », sans score. */
  const ID = 7002;
  const api = { status: '2H', elapsed: 61, home: 2, away: 1, events: BUTS_21() };
  const store = fauxStore({ [ID]: { home_goals: null, away_goals: null, status_short: 'NS' } });
  const { p, buts } = poller({ store, client: fauxClient(ID, api), auFil: [ID] });
  avancer(1_000); await p.pollLive();
  check('(d) une ligne périmée ne fait rien rejouer non plus', buts.length === 0
    || (console.log('        rejoués :', buts.map(dit).join(' · ')), false));
}
{
  /* (e) Le témoin : un club suivi, coup d'envoi puis premier but. Rien
     n'était rangé non plus — le relevé du coup d'envoi était vide —, et ce
     but-là est frais : il doit partir. */
  const ID = 7003;
  const api = { status: '1H', elapsed: 3, home: 0, away: 0, events: [] };
  const store = fauxStore({ [ID]: { home_goals: null, away_goals: null, status_short: 'NS' } },
    { suivis: [ID] });
  const { p, buts } = poller({ store, client: fauxClient(ID, api) });
  avancer(1_000); await p.pollLive();
  Object.assign(api, { elapsed: 24, home: 1 });
  api.events.push(ev(23, HOME, 'Diallo', 'Normal Goal'));
  avancer(20_000); await p.pollLive();
  check('(e) le premier but d’un club suivi part, une fois',
    buts.length === 1 && buts[0].player === 'Diallo' && buts[0].seq === 1);
}
{
  /* (f) Un vieux but que l'API publie en retard, après le premier relevé :
     il reste un vieux but. Le relevé de l'ancrage n'avait que deux des trois
     buts du 2–1 ; le troisième arrive au tour suivant. */
  const ID = 7004;
  const tous = BUTS_21();
  const api = { status: '2H', elapsed: 61, home: 2, away: 1, events: tous.slice(0, 3) };
  const store = fauxStore({ [ID]: { home_goals: 2, away_goals: 1, status_short: '2H', elapsed: 61 } });
  const { p, buts } = poller({ store, client: fauxClient(ID, api), auFil: [ID] });
  avancer(1_000); await p.pollLive();
  api.events = tous;
  api.elapsed = 63;
  avancer(61_000); await p.pollLive();
  check('(f) un vieux but publié en retard n’est pas annoncé comme frais', buts.length === 0
    || (console.log('        annoncés :', buts.map(dit).join(' · ')), false));
}
{
  /* (g) La liste de l'API porte un but de plus que le tableau — un but que la
     vidéo a refusé et qui n'en est pas encore retiré. Le dernier des anciens
     ne doit pas passer pour frais. */
  const ID = 7005;
  const api = { status: '2H', elapsed: 61, home: 2, away: 1,
    events: [...BUTS_21(), ev(58, AWAY, 'Refuse', 'Normal Goal')] };
  const store = fauxStore({ [ID]: { home_goals: 2, away_goals: 1, status_short: '2H', elapsed: 61 } });
  const { p, buts } = poller({ store, client: fauxClient(ID, api), auFil: [ID] });
  avancer(1_000); await p.pollLive();
  check('(g) un but de trop dans la liste n’est pas annoncé', buts.length === 0
    || (console.log('        annoncés :', buts.map(dit).join(' · ')), false));
}
{
  /* (h) Un but refusé par la vidéo après l'ancrage : le score redescend, et
     le but frais qui suit prend son rang — il doit partir. */
  const ID = 7006;
  const api = { status: '2H', elapsed: 61, home: 2, away: 1, events: BUTS_21() };
  const store = fauxStore({ [ID]: { home_goals: 2, away_goals: 1, status_short: '2H', elapsed: 61 } });
  const { p, buts } = poller({ store, client: fauxClient(ID, api), auFil: [ID] });
  avancer(1_000); await p.pollLive();
  api.events = api.events.filter((e) => e.player.name !== 'Bento');      // refusé
  Object.assign(api, { elapsed: 63, home: 1 });
  avancer(61_000); await p.pollLive();
  api.events.push(ev(70, HOME, 'Morel', 'Normal Goal'));
  Object.assign(api, { elapsed: 71, home: 2 });
  avancer(61_000); await p.pollLive();
  check('(h) après un but refusé, le but frais suivant part à son rang',
    buts.length === 1 && buts[0].player === 'Morel' && buts[0].seq === 3
    || (console.log('        annoncés :', buts.map(dit).join(' · ')), false));
}
{
  /* (i) Un but que la liste porte avant le tableau. Le score vient du lot du
     direct, les événements d'un appel parti après lui : un but marqué entre
     les deux est dans la liste et pas encore au tableau. Le plafond (g) le
     retient ; mais rangé quand même, il passait pour vu au tour suivant, quand
     le tableau l'avait rattrapé, et n'était jamais annoncé. */
  const ID = 7007;
  const api = { status: '1H', elapsed: 30, home: 1, away: 0,
    events: [ev(12, HOME, 'Diallo', 'Normal Goal')] };
  // Entré à la 30e d'un 1–0 : la ligne est celle de l'ancrage, à jour.
  const store = fauxStore({ [ID]: { home_goals: 1, away_goals: 0, status_short: '1H', elapsed: 30 } });
  const { p, buts } = poller({ store, client: fauxClient(ID, api), auFil: [ID] });
  avancer(1_000); await p.pollLive();
  // Deux minutes plus tard : le direct lit 1–0, et Keller marque pendant le tour.
  api.elapsed = 32;
  api.avant = () => { api.events.push(ev(32, AWAY, 'Keller', 'Normal Goal')); };
  avancer(120_000); await p.pollLive();
  const pendant = buts.length;
  const rangeEnAvance = (store.evs.get(ID) ?? []).some((e) => e.player === 'Keller');
  // Vingt secondes plus tard, le tableau a rattrapé : 1–1. Puis deux tours.
  Object.assign(api, { elapsed: 33, away: 1 });
  avancer(20_000); await p.pollLive();
  for (let k = 0; k < 2; k++) { api.elapsed++; avancer(61_000); await p.pollLive(); }
  check('(i) un but en avance sur le tableau n’est ni annoncé ni rangé',
    pendant === 0 && !rangeEnAvance);
  check('(i) il part quand le tableau le rattrape, une fois, à son rang et à son score',
    buts.map(dit).join(' · ') === "32' Keller seq2 [1,1]"
    || (console.log('        annoncés :', buts.map(dit).join(' · ') || '(rien)'), false));
  check('(i) et il est alors rangé', (store.evs.get(ID) ?? []).some((e) => e.player === 'Keller'));
}

console.log('\nUne pause de l’horloge de l’API ne rend aucun but frais');
{
  /* L'horloge de l'API s'arrête aux pauses : 45 pendant toute la mi-temps,
     90 avant la prolongation. La garde d'avant, en minutes de jeu, laissait
     passer pour frais un but marqué un quart d'heure plus tôt — avec sa carte
     de présence pour qui ouvrait la salle à ce moment-là. */
  const cas = async (nom, ID, api, attendu = 0) => {
    const store = fauxStore({ [ID]: { home_goals: api.home, away_goals: api.away,
      status_short: api.status, elapsed: api.elapsed } });
    const { p, buts } = poller({ store, client: fauxClient(ID, api), auFil: [ID] });
    avancer(120_000); await p.pollLive();
    check(`${nom} : ${attendu ? 'annoncé' : 'rien d’annoncé'}`, buts.length === attendu
      || (console.log('        annoncés :', buts.map(dit).join(' · ')), false));
  };
  await cas('mi-temps (HT 45), buts à 41e et 45+2', 7101, { status: 'HT', elapsed: 45,
    home: 3, away: 0, events: [ev(12, HOME, 'Ancien', 'Normal Goal'),
      ev(41, HOME, 'Quarante', 'Normal Goal'), ev(45, HOME, 'Arret', 'Normal Goal', { extra: 2 })] });
  await cas('reprise (2H 49), but à 45+3', 7102, { status: '2H', elapsed: 49, home: 1, away: 0,
    events: [ev(45, HOME, 'Arret', 'Normal Goal', { extra: 3 })] });
  await cas('pause avant prolongation (BT 90), but à 88e', 7103, { status: 'BT', elapsed: 90,
    home: 1, away: 1, events: [ev(20, HOME, 'Ancien', 'Normal Goal'), ev(88, AWAY, 'Egal', 'Normal Goal')] });
  await cas('en jeu (2H 70), but à 60e — témoin', 7104, { status: '2H', elapsed: 70, home: 1, away: 0,
    events: [ev(60, HOME, 'Vieux', 'Normal Goal')] });
}

console.log('\nUn relevé vide ou raté ne fait pas sauter le premier but');
{
  /* Un club suivi, sans salle : son relevé d'événements ne part qu'au
     changement de score, une fois par but. L'API publie le score avant
     l'événement — quelques secondes suffisent —, ou l'appel échoue : la base
     reste vide jusqu'au but suivant. Une garde fondée sur « base vide »
     sautait alors le premier but, carte comprise. */
  for (const raison of ['vide', 'raté']) {
    const ID = raison === 'vide' ? 7201 : 7202;
    const api = { status: 'NS', elapsed: null, home: null, away: null, events: [] };
    const store = fauxStore({ [ID]: { home_goals: null, away_goals: null, status_short: 'NS' } },
      { suivis: [ID] });
    const { buts, tour } = poller({ store, client: fauxClient(ID, api) });
    await tour();                                                  // avant le coup d'envoi
    Object.assign(api, { status: '1H', elapsed: 1, home: 0, away: 0 });
    for (let m = 1; m < 30; m += 5) { api.elapsed = m; avancer(20_000); await tour(); }
    Object.assign(api, { elapsed: 30, home: 1 });                  // 1–0, sans l'événement…
    if (raison === 'raté') api.panne = true;                       // … ou avec un appel qui échoue
    avancer(20_000); await tour();
    api.panne = false;
    api.events.push(ev(30, HOME, 'Diallo', 'Normal Goal'));
    for (let m = 31; m < 70; m += 5) { api.elapsed = m; avancer(20_000); await tour(); }
    Object.assign(api, { elapsed: 70, away: 1 });
    api.events.push(ev(70, AWAY, 'Keller', 'Normal Goal'));
    avancer(20_000); await tour();
    check(`relevé ${raison} au premier but : les deux buts partent au second, rangés 1 et 2`,
      buts.map(dit).join(' · ') === "30' Diallo seq1 [1,0] · 70' Keller seq2 [1,1]"
      || (console.log('        annoncés :', buts.map(dit).join(' · ') || '(rien)'), false));
  }
}

console.log('\nUn redémarrage annonce encore les buts de la coupure');
{
  /* La ligne en base est celle que le relevé écrivait juste avant de
     s'arrêter : même période, une minute plus tôt. Le but marqué pendant la
     coupure n'a jamais été annoncé, et rien n'était rangé — 0–0 sans un
     carton. Il doit partir. */
  const ID = 7301;
  const api = { status: '2H', elapsed: 62, home: 1, away: 0,
    events: [ev(61, HOME, 'Coupure', 'Normal Goal')] };
  const store = fauxStore({ [ID]: { home_goals: 0, away_goals: 0, status_short: '2H', elapsed: 61 } },
    { suivis: [ID] });
  const { p, buts } = poller({ store, client: fauxClient(ID, api) });
  avancer(1_000); await p.pollLive();
  check('le but marqué pendant la coupure part, une fois',
    buts.length === 1 && buts[0].player === 'Coupure' && buts[0].seq === 1
    || (console.log('        annoncés :', buts.map(dit).join(' · ') || '(rien)'), false));
  /* Une ligne de plus de `LIGNE_FRAICHE_MIN` minutes ne date plus rien. */
  const ID2 = 7302;
  const api2 = { ...api, elapsed: 61 + LIGNE_FRAICHE_MIN + 2 };
  const store2 = fauxStore({ [ID2]: { home_goals: 0, away_goals: 0, status_short: '2H', elapsed: 61 } },
    { suivis: [ID2] });
  const { p: p2, buts: b2 } = poller({ store: store2, client: fauxClient(ID2, api2) });
  avancer(1_000); await p2.pollLive();
  check('une ligne trop vieille ne date plus rien : rien d’annoncé', b2.length === 0);
  /* Avec une histoire en base — un carton rangé avant la coupure — et une
     ligne fraîche : c'est la base qui fait foi, et le but de la coupure
     part encore. */
  const ID3 = 7303;
  const api3 = { status: '2H', elapsed: 62, home: 1, away: 0, events: [
    ev(50, AWAY, 'Roth', 'Yellow Card', { type: 'Card' }), ev(61, HOME, 'Coupure', 'Normal Goal')] };
  const store3 = fauxStore({ [ID3]: { home_goals: 0, away_goals: 0, status_short: '2H', elapsed: 61 } },
    { suivis: [ID3] });
  await store3.insertEvents(ID3, [mapEvent(api3.events[0])]);
  const { p: p3, buts: b3 } = poller({ store: store3, client: fauxClient(ID3, api3) });
  avancer(1_000); await p3.pollLive();
  check('avec des événements rangés et une ligne fraîche, le but de la coupure part encore',
    b3.length === 1 && b3[0].player === 'Coupure' && b3[0].seq === 1
    || (console.log('        annoncés :', b3.map(dit).join(' · ') || '(rien)'), false));
}

console.log('\nSortir puis revenir ne fait pas annoncer les buts de l’absence');
{
  /* Un match que personne ne suit n'est demandé au direct que tant que sa
     salle est occupée. Le socle posé au premier regard restait celui de toute
     la vie du processus : on entrait à la 10e, on ressortait, la salle
     restait vide pendant les buts de la 30e et de la 41e, et en revenant à la
     44e les deux partaient comme frais — corde, minute double, et la carte de
     présence à qui venait de rentrer. Les présents sont ceux de `mintGoal` :
     une poussée dans les 120 s qui précèdent l'instant où le serveur voit le
     but. */
  async function sortie({ id, ancre, entrant, carton = false, absence = [11, 44],
                          apres = false, redemarrage = false, rafraichie = false }) {
    const api = { status: '1H', elapsed: 10, home: 0, away: 0, events: [] };
    if (carton) api.events.push(ev(8, AWAY, 'Roth', 'Yellow Card', { type: 'Card' }));
    // La ligne que l'ancrage vient de poser depuis la journée, à jour.
    const store = fauxStore({ [id]: { home_goals: 0, away_goals: 0, status_short: '1H', elapsed: 10 } });
    const client = fauxClient(id, api);
    let auFil = [];
    const poussees = new Map();       // userId -> instant de sa dernière poussée
    const buts = [];
    const neuf = () => createPoller({ client, store, fixturesAuFil: () => auFil, log: silence,
      onGoal: (g) => { buts.push({ ...g, presents: [...poussees]
        .filter(([, t]) => Date.now() - t < 120_000).map(([u]) => u) }); } });
    let p = neuf();
    const tour = async () => { await p.pollLive(); avancer(20_000); };
    if (ancre) {
      // 10e : quelqu'un entre, pousse, et ressort aussitôt.
      auFil = [id]; poussees.set(ancre, Date.now());
      await tour(); await tour();
      auFil = [];
    }
    // La salle vide : trois tours par minute de jeu, et aucune demande.
    for (let min = absence[0]; min <= absence[1]; min++) {
      api.elapsed = min;
      if (min === absence[1] && min < 30) { api.home += 1; api.events.push(ev(min, HOME, 'Vite', 'Normal Goal')); }
      if (min === 30) { api.home += 1; api.events.push(ev(30, HOME, 'Diallo', 'Normal Goal')); }
      if (min === 41) { api.home += 1; api.events.push(ev(41, HOME, 'Morel', 'Normal Goal')); }
      /* Le télétexte range aussi les lignes des matchs qu'il lit : celle-ci,
         à la 43e, en retard d'un but. Fraîche en apparence, elle ne date
         pourtant rien de ce que personne n'a regardé. */
      if (rafraichie && min === 43) {
        store.rows.set(id, { home_goals: 1, away_goals: 0, status_short: '1H', elapsed: 40 });
      }
      await tour(); await tour(); await tour();
    }
    // Un déploiement pendant l'absence : un processus neuf, la même base.
    if (redemarrage) p = neuf();
    auFil = [id]; poussees.set(entrant, Date.now());
    await tour(); await tour();
    if (apres) {
      api.elapsed = absence[1] + 2; api.home += 1;
      api.events.push(ev(absence[1] + 2, HOME, 'Bento', 'Normal Goal'));
      poussees.set(entrant, Date.now());
      for (let i = 0; i < 4; i++) await tour();
    }
    return buts.map((g) => `${g.minute}' ${g.player} seq${g.seq} [${g.presents}]`).join(' · ') || '(rien)';
  }
  const cas = async (nom, opts, attendu) => {
    const vu = await sortie(opts);
    check(`${nom} : ${attendu === '(rien)' ? 'rien d’annoncé' : attendu}`, vu === attendu
      || (console.log('        annoncés :', vu), false));
  };
  await cas('ancré par soi-même à la 10e, revenu à la 44e',
    { id: 7401, ancre: 'malin', entrant: 'malin' }, '(rien)');
  await cas('ancré par un passant, entré à la 44e',
    { id: 7402, ancre: 'passant', entrant: 'tard' }, '(rien)');
  await cas('ancré avec un carton rangé',
    { id: 7403, ancre: 'malin', entrant: 'malin', carton: true }, '(rien)');
  await cas('ancré avec un carton, puis un redémarrage pendant l’absence',
    { id: 7404, ancre: 'malin', entrant: 'tard', carton: true, redemarrage: true }, '(rien)');
  await cas('la ligne rafraîchie par le télétexte pendant l’absence ne sert pas de départ',
    { id: 7410, ancre: 'malin', entrant: 'malin', rafraichie: true }, '(rien)');
  await cas('un but frais après le retour part, à son rang, pour qui est revenu',
    { id: 7405, ancre: 'malin', entrant: 'malin', apres: true }, "46' Bento seq3 [malin]");
  /* Le trou se compte en tours : deux minutes suffisent. Une tolérance de
     cinq minutes laissait ce but-là partir au retour, avec la carte de
     présence de qui venait de rentrer. */
  await cas('une absence de deux minutes n’annonce pas non plus son but',
    { id: 7406, ancre: 'malin', entrant: 'malin', absence: [11, 12] }, '(rien)');

  /* Le même geste, à deux places : entré et chanté à la 10e, rechanté à la
     14e. L'un est resté assis, l'autre est sorti entre les deux. Le but de la
     12e est tombé salle vide pour le second, et devant le premier, qui
     n'avait pas chanté dans les deux minutes : ni l'un ni l'autre n'a la
     carte. Avant, celui qui sortait l'avait, et lui seul. */
  async function geste({ id, sort }) {
    const qui = sort ? 'sorti' : 'assis';
    const api = { status: '1H', elapsed: 10, home: 0, away: 0, events: [] };
    const store = fauxStore({ [id]: { home_goals: 0, away_goals: 0, status_short: '1H', elapsed: 10 } });
    let auFil = [id];
    const poussees = new Map();
    const cartes = [];
    const p = createPoller({ client: fauxClient(id, api), store, fixturesAuFil: () => auFil,
      log: silence, onGoal: (g) => {
        if ([...poussees].some(([u, t]) => u === qui && Date.now() - t < 120_000)) {
          cartes.push(`${g.minute}' ${g.player}`);
        }
      } });
    const tour = async () => { await p.pollLive(); avancer(20_000); };
    poussees.set(qui, Date.now());
    for (let k = 0; k < 3; k++) await tour();
    if (sort) auFil = [];
    for (let k = 0; k < 9; k++) {                       // de la 11e à la 13e
      api.elapsed = 11 + Math.floor(k / 3);
      if (k === 4) { api.home = 1; api.events.push(ev(12, HOME, 'Vite', 'Normal Goal')); }
      await tour();
    }
    api.elapsed = 14; auFil = [id];
    poussees.set(qui, Date.now());
    for (let k = 0; k < 3; k++) await tour();
    return cartes.join(' · ') || '(aucune)';
  }
  const assis = await geste({ id: 7408, sort: false });
  const sorti = await geste({ id: 7409, sort: true });
  check('même geste, deux places : ni l’assis ni celui qui est sorti n’a la carte de la 12e',
    assis === '(aucune)' && sorti === '(aucune)'
    || (console.log('        assis :', assis, '· sorti :', sorti), false));

  /* Le script : ancré au coup d'envoi, il ne passe en tribune qu'un tour
     toutes les quatre minutes vingt, et y chante. Trois buts, tous marqués
     salle vide. Avec une tolérance de cinq minutes, il avait les trois
     cartes pour sept tours de présence sur quatre-vingt-dix. */
  {
    const id = 7411;
    const api = { status: '1H', elapsed: 1, home: 0, away: 0, events: [] };
    const store = fauxStore({ [id]: { home_goals: 0, away_goals: 0, status_short: '1H', elapsed: 1 } });
    let auFil = [];
    const poussees = new Map();
    const cartes = [];
    const p = createPoller({ client: fauxClient(id, api), store, fixturesAuFil: () => auFil,
      log: silence, onGoal: (g) => {
        if ([...poussees].some(([, t]) => Date.now() - t < 120_000)) cartes.push(`${g.minute}'`);
      } });
    for (let t = 0; t < 90; t++) {
      api.elapsed = 1 + Math.floor(t / 3);
      if ([7, 16, 24].includes(api.elapsed) && !api.events.some((e) => e.time.elapsed === api.elapsed)) {
        api.home += 1;
        api.events.push(ev(api.elapsed, HOME, `B${api.elapsed}`, 'Normal Goal'));
      }
      const visite = t % 13 === 0;
      auFil = visite ? [id] : [];
      if (visite) poussees.set('script', Date.now());
      await p.pollLive(); avancer(20_000);
    }
    check('une visite toutes les quatre minutes vingt : aucune carte', cartes.length === 0
      || (console.log('        cartes :', cartes.join(' · ')), false));
  }

  /* Le témoin de la demande : un club suivi, et l'API en panne six minutes.
     Le relevé demande et n'obtient rien ; il n'a pas cessé de regarder, et
     le but marqué pendant la panne part à son retour, comme avant. Une garde
     fondée sur la réponse, et non sur la demande, l'aurait perdu. */
  const ID = 7407;
  const api = { status: '1H', elapsed: 10, home: 0, away: 0, events: [] };
  const store = fauxStore({ [ID]: { home_goals: 0, away_goals: 0, status_short: '1H', elapsed: 9 } },
    { suivis: [ID] });
  const { buts, tour } = poller({ store, client: fauxClient(ID, api) });
  await tour();
  api.panneDirect = true;
  for (let i = 0; i < 18; i++) { avancer(20_000); await tour(); }
  Object.assign(api, { elapsed: 17, home: 1 });
  api.events.push(ev(16, HOME, 'Panne', 'Normal Goal'));
  api.panneDirect = false;
  avancer(20_000); await tour();
  check('un relevé qui demande sans obtenir n’a pas cessé de regarder : le but de la panne part',
    buts.length === 1 && buts[0].player === 'Panne' && buts[0].seq === 1
    || (console.log('        annoncés :', buts.map(dit).join(' · ') || '(rien)'), false));
}

/* ======================================================= la ceinture de D1 */

console.log('\nUn match qui n’est pas en jeu ne paie plus son fil');
{
  const tours = async (p, n, ms = 120_000) => {
    for (let i = 0; i < n; i++) { avancer(ms); await p.pollLive(); }
  };

  /* Le coup de sifflet tombe pendant que la salle est encore au relevé. */
  const ID = 8001;
  const api = { status: 'FT', elapsed: 90, home: 1, away: 0, events: [] };
  const store = fauxStore({ [ID]: { home_goals: 1, away_goals: 0, status_short: '2H', elapsed: 89 } });
  const client = fauxClient(ID, api);
  const { p } = poller({ store, client, auFil: [ID] });
  await tours(p, 3);
  check('trois tours après le coup de sifflet : un seul relevé d’événements, au premier',
    client.n.evenements === 1
    || (console.log(`        ${client.n.evenements} relevé(s)`), false));

  /* Déjà fini avant le premier tour : plus rien. */
  const ID2 = 8002;
  const store2 = fauxStore({ [ID2]: { home_goals: 1, away_goals: 0, status_short: 'FT', elapsed: 90 } });
  const client2 = fauxClient(ID2, { ...api });
  const { p: p2 } = poller({ store: store2, client: client2, auFil: [ID2] });
  await tours(p2, 3);
  check('un match déjà fini ne paie aucun relevé', client2.n.evenements === 0);

  /* Le témoin : la garde ne coupe pas le fil d'un match en cours. */
  const ID3 = 8003;
  const store3 = fauxStore({ [ID3]: { home_goals: 1, away_goals: 0, status_short: '2H', elapsed: 70 } });
  const client3 = fauxClient(ID3, { ...api, status: '2H', elapsed: 70 });
  const { p: p3 } = poller({ store: store3, client: client3, auFil: [ID3] });
  await tours(p3, 3);
  check('un match en cours garde son relevé à la minute', client3.n.evenements === 3);

  /* Le dernier relevé, à la cadence du direct : vingt secondes. Il ne doit
     pas attendre la minute — au tour suivant, la salle finie n'est plus au
     relevé, et le carton du temps additionnel serait perdu pour toujours. */
  for (const apres of [20_000, 40_000, 60_000]) {
    const id = 8100 + apres / 1000;
    const a = { status: '2H', elapsed: 88, home: 1, away: 0,
      events: [ev(12, HOME, 'Diallo', 'Normal Goal')] };
    const st = fauxStore({ [id]: { home_goals: 1, away_goals: 0, status_short: '2H', elapsed: 88 } });
    await st.insertEvents(id, a.events.map(mapEvent));
    const cl = fauxClient(id, a);
    const { p: q } = poller({ store: st, client: cl, auFil: [id] });
    avancer(61_000); await q.pollLive();                 // un relevé, la porte se ferme
    const avant = cl.n.evenements;
    avancer(apres - 20_000);
    if (apres > 20_000) await q.pollLive();
    a.events.push(ev(90, AWAY, 'Keller', 'Red Card', { type: 'Card', extra: 4 }));
    Object.assign(a, { status: 'FT', elapsed: 90 });
    avancer(20_000); await q.pollLive();                 // le coup de sifflet
    await tours(q, 3);
    const range = (st.evs.get(id) ?? []).some((e) => e.player === 'Keller');
    check(`coup de sifflet ${apres / 1000} s après un relevé : un relevé de plus, et le carton rangé`,
      cl.n.evenements - avant === 1 && range
      || (console.log(`        ${cl.n.evenements - avant} relevé(s), carton ${range ? 'rangé' : 'perdu'}`), false));
  }

  /* Aucun événement n'arrive pour un match à venir, suspendu ou reporté : la
     salle peut rester au relevé du direct — c'est le seul chemin qui le
     rafraîchit —, mais pas payer un relevé d'événements à chaque tour. */
  for (const statut of ['NS', 'TBD', 'SUSP', 'PST']) {
    const id = 8200 + ['NS', 'TBD', 'SUSP', 'PST'].indexOf(statut);
    const st = fauxStore({ [id]: { home_goals: null, away_goals: null, status_short: statut } });
    const cl = fauxClient(id, { status: statut, elapsed: null, home: null, away: null, events: [] });
    const { p: q } = poller({ store: st, client: cl, auFil: [id] });
    await tours(q, 5);
    check(`${statut} au relevé pendant cinq tours : aucun relevé d’événements`, cl.n.evenements === 0
      || (console.log(`        ${cl.n.evenements} relevé(s)`), false));
  }

  /* Mais le tour qui voit un match en jeu se suspendre relève une dernière
     fois, comme au coup de sifflet. */
  const ID4 = 8300;
  const a4 = { status: 'SUSP', elapsed: 70, home: 0, away: 0, events: [] };
  const st4 = fauxStore({ [ID4]: { home_goals: 0, away_goals: 0, status_short: '2H', elapsed: 69 } });
  const cl4 = fauxClient(ID4, a4);
  const { p: q4 } = poller({ store: st4, client: cl4, auFil: [ID4] });
  await tours(q4, 4);
  check('un match qui se suspend : un dernier relevé, puis plus rien', cl4.n.evenements === 1);
}

console.log('\nL’heure du coup d’envoi part avec le statut');
{
  const ID = 8400;
  const date = new Date(vrai() + 3 * 3600_000).toISOString();
  const statuts = [];
  const st = fauxStore({ [ID]: { home_goals: null, away_goals: null, status_short: 'NS' } });
  const { p } = poller({ store: st, client: fauxClient(ID, { status: 'NS', elapsed: null,
    home: null, away: null, events: [], date }), auFil: [ID],
    onStatus: (id, e) => statuts.push(e) });
  avancer(1_000); await p.pollLive();
  check('la salle reçoit l’heure que l’API annonce',
    new Date(statuts.at(-1)?.kickoffAt).getTime() === new Date(date).getTime());
}

/* Un match que l'API ne rend plus — supprimé, renuméroté — restait relevé à
   chaque tour tant que sa salle était occupée. C'est le relevé qui sait qu'un
   lot a répondu sans lui ; il le dit par `onAbsent`. Une panne, elle, ne dit
   rien : la compter comme une disparition faisait attendre une demi-heure,
   au retour de l'API, une salle en jeu. */
console.log('\nUn lot qui répond sans un match le dit ; une panne ne dit rien');
{
  const ID = 8500, PERDU = 8501;
  const absents = [];
  const api = { status: '2H', elapsed: 61, home: 0, away: 0, events: [] };
  const st = fauxStore({ [ID]: { home_goals: 0, away_goals: 0, status_short: '2H', elapsed: 60 } });
  const p = createPoller({ client: fauxClient(ID, api), store: st, log: silence,
    fixturesAuFil: () => [ID, PERDU], onAbsent: (id) => absents.push(id) });
  avancer(1_000); await p.pollLive();
  check('le match omis par un lot qui a répondu est signalé, et lui seul',
    JSON.stringify(absents) === JSON.stringify([PERDU]) || (console.log('        ', absents), false));
  api.panneDirect = true;
  avancer(1_000);
  try { await p.pollLive(); } catch (e) { if (!(e instanceof QuotaExhausted)) throw e; }
  check('un lot en panne ne signale rien', absents.length === 1);
}

Date.now = vrai;
console.log(`\n${failures ? `${failures} échec(s)` : 'tout est vert'}`);
process.exitCode = failures ? 1 : 0;
