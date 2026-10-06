/**
 * Test de charge du Grand Virage.
 *
 * Mesure ce qui décide de l'hébergement : le délai entre le chant d'un
 * supporter et le moment où toute la tribune voit la corde bouger. C'est le
 * seul chiffre qui compte à mille personnes.
 *
 *   node scripts/virage-loadtest.mjs 200                       # serveur local
 *   node scripts/virage-loadtest.mjs 200 https://thebestfan.online
 *
 * En local, un serveur est monté dans le même process : la mesure porte sur le
 * moteur. Avec une URL, elle inclut le réseau et l'hébergement.
 *
 * ## Le coup de sifflet (vague 2, P5)
 *
 * Après la phase de chant, en local seulement, **deux tribunes** :
 *
 *   - **la tribune du coup de sifflet** (`N` supporters) : le relevé apprend
 *     la fin du match, `virage:fin` part à toute la salle, et chaque page fait
 *     ce que le contrat lui demande (`CONTRATS.md`, § 15.3) — son bilan après
 *     un délai tiré entre 0 et 8 s, puis `virage:leave` dès la réponse. Une
 *     moitié a de quoi toucher l'XP du match (un versement par bilan, sous le
 *     sémaphore), l'autre non (« incomplet ») : c'est le départ de celle-ci
 *     qui ouvrait un versement par chanteur, après un bilan qui n'en avait
 *     ouvert aucun ;
 *   - **une tribune qui se vide** au même moment (`FERME` supporters, le quart
 *     de `N` par défaut) : un autre match, fini depuis `virage.bilan_min`
 *     minutes, dont les pages ne demandent rien (d'anciennes pages, des
 *     onglets oubliés). Deux secondes après le coup de sifflet de la
 *     première, `virage:ferme` les sort tous, et le filet de l'XP part pour
 *     chacun : la moitié en est due, l'autre non. C'est ce départ en rafale
 *     qui pouvait prendre le sémaphore aux bilans de l'autre tribune.
 *
 * On mesure le délai du bilan (de la demande à la réponse) au 50ᵉ, 95ᵉ et
 * 99ᵉ centile **contre les trois secondes** après lesquelles la page renonce
 * (§ 15.4) ; l'attente du pool et du sémaphore (leurs files, échantillonnées) ;
 * le nombre de requêtes — les lectures, qui ne doivent pas suivre l'effectif,
 * et les connexions, une par versement dû et pas une de plus ; et le temps que
 * met la seconde tribune à toucher l'XP qui lui est due.
 *
 *   DATABASE_URL=… POOL=8 node scripts/virage-loadtest.mjs 500
 *   DATABASE_URL=… POOL=8 LATENCE_MS=5 node scripts/virage-loadtest.mjs 1000
 *
 * `SIFFLET=0` saute ce scénario ; `FERME=0` le joue sans la seconde tribune ;
 * `LATENCE_MS` donne à chaque instruction du Virage le délai d'une base
 * distante (voir plus bas).
 */
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { io as client } from 'socket.io-client';

const N = Number(process.argv[2] ?? 100);
const REMOTE = process.argv[3];
const DUREE_MS = 25_000;
const FIXTURE = Number(process.env.FIXTURE_ID ?? 7001);
/* La tribune qui se vide pendant le coup de sifflet de l'autre : en local
   seulement, et sans elle si `SIFFLET=0`. */
const FIXTURE_FERME = FIXTURE + 1;
const M = REMOTE || process.env.SIFFLET === '0' ? 0
  : Number(process.env.FERME ?? Math.round(N / 4));
/* La page renonce à son bilan au bout de trois secondes (`CONTRATS.md`, § 15.4). */
const SEUIL_PAGE_MS = 3000;
/** L'identifiant du `i`ᵉ supporter : les `N` premiers dans la tribune du coup de sifflet, les `M` suivants dans l'autre. */
const idDe = (i) => `load-${String(i).padStart(5, '0')}-0000-0000-000000000000`.slice(0, 36);
/** Une moitié de chaque tribune a de quoi toucher l'XP du match ; l'autre non. */
const xpDue = (i) => i % 2 === 0;

let url = REMOTE, http, io, virage, pool;
/* Ce que le Virage demande à la base, compté au pool qu'on lui passe : les
   lectures (`execute`, `query`) et les connexions ouvertes (les versements
   du grand livre). Les autres modules ont le pool nu. */
const requetes = { lectures: 0, connexions: 0 };

if (!REMOTE) {
  const { readFileSync } = await import('node:fs');
  const express = (await import('express')).default;
  const mysql = await import('mysql2/promise');
  const { createSouvenirs } = await import('../src/server/souvenirs/index.js');
  const { createFanzzy } = await import('../src/server/fanzzy/index.js');
  const { createVirage } = await import('../src/server/ferveur/index.js');
  const { charger: chargerCatalogue } = await import('../src/server/fanzzy/catalogue.js');

  /* **La base de test, et son verrou**, comme les suites. Ce banc commence
     par vider `users` : il visait par défaut la base de développement, et
     tournait sans le verrou — lancé pendant une suite, il la vidait sous ses
     pieds. `baseDeTest()` lit `DATABASE_URL`, puis la base de la copie
     (`.tbf-base-de-test`), refuse un hôte distant et prend le verrou. */
  const { baseDeTest, OPTIONS_BASE } = await import('./base-de-test.mjs');
  const DB = baseDeTest();
  const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
  /* `kops` et `kop_membres` manquaient. Le test de charge ne monte pas les KOP
     et n'en avait donc pas besoin — mais il partage la base avec les suites,
     et `kop_invites` référence `kops`, qui référence `users` : lancé après une
     suite qui en a créé, il échouait sur le DROP de `users` avant d'avoir
     ouvert une seule connexion. Il n'est pas dans `npm test`, ce qui explique
     qu'on ne l'ait jamais vu. */
  /* Le grand livre et les tables du quotidien n'ont pas de clé étrangère
     vers `users` (`ETAT.md`, § 6) : on les vide quand même, pour qu'un
     versement d'une suite d'avant ne se compte pas ici. */
  await raw.query(`DROP TABLE IF EXISTS pronostics, parrainages, abonnements, achats, kop_invites,
                 kop_bulletins, kop_votes, kop_bonus, kop_membres, kops, amities,
  user_decks, user_stuff, user_etats, user_skins, user_fanzzy, user_souvenirs, virage_presence,
                 souvenirs, user_wallet, api_cache, souvenir_leagues, duel_results, duel_events,
                 duels, user_league_follows, user_follows, fixture_events, standings, fixtures, team_leagues, teams,
                 leagues, api_quota, login_attempts, auth_tokens, sessions,
                 recompenses, missions_jour, compteurs_jour, user_nouveautes, users`);
  /* `niveau`, `quotidien` et `arenes` : l'XP, le grand livre et les chants,
     puis les colonnes du bilan — le schéma qu'on déploie, dans l'ordre. */
  for (const f of ['auth.sql', 'football.sql', 'minutes.sql', 'couleurs.sql',
    'souvenirs.sql', 'billets.sql', 'fanzzy.sql', 'admin.sql', 'niveau.sql', 'saisons.sql',
    'contenus.sql', 'quotidien.sql', 'arenes.sql']) {
    await raw.query(readFileSync(new URL('../sql/' + f, import.meta.url), 'utf8'));
  }
  await raw.query(`INSERT INTO teams (id,name) VALUES (85,'Domicile'),(91,'Visiteur')`);
  await raw.query(`INSERT INTO leagues (id,name) VALUES (207,'Test')`);
  await raw.query(`INSERT INTO fixtures (id,league_id,season,home_id,away_id,status_short,kickoff_at)
                   VALUES (?,207,2026,85,91,'1H',UTC_TIMESTAMP()), (?,207,2026,85,91,'2H',UTC_TIMESTAMP())`,
  [FIXTURE, FIXTURE_FERME]);
  for (let i = 0; i < N + M; i++) {
    const id = idDe(i);
    await raw.query(`INSERT INTO users (public_id,email,pseudo,password_hash) VALUES (?,?,?,'x')`,
      [id, `l${i}@ex.fr`, `L${i}`]);
    await raw.query(`INSERT INTO user_wallet (user_id,scarves,active_fanzzy) VALUES (?,0,'TR32')`, [id]);
    await raw.query(`INSERT INTO user_follows (user_id,team_id) VALUES (?,?)`, [id, i % 2 ? 91 : 85]);
  }
  await raw.end();

  /* Huit connexions, comme la production (`ETAT.md`, § 6) : c'est là que le
     coup de sifflet se joue, et le sémaphore des versements est taillé pour
     elle. `POOL` en donne un autre. */
  pool = mysql.createPool({ uri: DB, connectionLimit: Number(process.env.POOL ?? 8), ...OPTIONS_BASE });

  /* **Le catalogue, avant les modules qui en dépendent.**

     Ce banc ne tournait pas. Il levait à la première entrée dans le virage —
     « Le catalogue Fanzzy n'a pas été chargé » — parce que `ferveur` demande
     le personnage actif de chaque supporter, et que `racineDe` refuse de
     répondre sans catalogue.

     C'est probablement pourquoi il n'a jamais servi : on le lance une fois,
     on voit une trace de pile, et on remet à plus tard. Un banc de charge
     qu'on ne peut pas lancer ne mesure rien, et son absence de mesure ne se
     voit nulle part. */
  await chargerCatalogue(pool);
  const app = express();
  http = createServer(app);
  io = new Server(http, { cors: { origin: '*' }, perMessageDeflate: false });
  io.use((s, next) => { s.data.user = { userId: s.handshake.auth.token, name: 'L' }; next(); });
  const souvenirs = createSouvenirs({ pool, requireAuth: (r, _s, n) => n() });
  const fanzzy = createFanzzy({ pool, requireAuth: (r, _s, n) => n() });
  const { createNiveau } = await import('../src/server/niveau/index.js');
  const niveau = createNiveau({ pool, requireAuth: (r, _s, n) => n() });
  /* **La base du poste répond en moins d'une milliseconde** ; celle de la
     production est sur une autre machine. `LATENCE_MS` ajoute ce délai à
     chaque instruction du Virage, **connexion tenue** — comme un aller-retour
     réseau : une lecture du pool prend sa connexion, attend, lit, la rend ;
     une instruction d'un versement attend sous son verrou. Sans lui, le
     coup de sifflet se mesure sur une base qu'on ne déploie pas. */
  const LATENCE = Number(process.env.LATENCE_MS ?? 0);
  /* **Pas `setTimeout`** : sous Windows, il ne descend pas sous une quinzaine
     de millisecondes (`setTimeout(r, 5)` dure 16,6 ms sur le poste), et une
     base « à 5 ms » en devenait une à 16. Une seule boucle de `setImmediate`
     rend chaque attente à son instant, et s'arrête quand plus rien n'attend. */
  const attentes = [];
  let tourne = false;
  const tourner = () => {
    const t = performance.now();
    for (let k = attentes.length - 1; k >= 0; k--) {
      if (attentes[k].a <= t) attentes.splice(k, 1)[0].r();
    }
    if (attentes.length) setImmediate(tourner); else tourne = false;
  };
  const attendre = () => new Promise((r) => {
    attentes.push({ a: performance.now() + LATENCE, r });
    if (!tourne) { tourne = true; setImmediate(tourner); }
  });
  const enRetard = (conn) => new Proxy(conn, {
    get(c, k) {
      const f = c[k];
      if (typeof f !== 'function') return f;
      if (['execute', 'query', 'beginTransaction', 'commit', 'rollback'].includes(k)) {
        return async (...a) => { await attendre(); return f.apply(c, a); };
      }
      return f.bind(c);
    },
  });
  const compte = new Proxy(pool, {
    get(cible, cle) {
      const v = cible[cle];
      if (typeof v !== 'function') return v;
      if (cle === 'execute' || cle === 'query') {
        return async (...a) => {
          requetes.lectures++;
          if (!LATENCE) return v.apply(cible, a);
          const c = await cible.getConnection();
          try { await attendre(); return await c[cle](...a); } finally { c.release(); }
        };
      }
      if (cle === 'getConnection') {
        return async (...a) => {
          requetes.connexions++;
          const c = await v.apply(cible, a);
          return LATENCE ? enRetard(c) : c;
        };
      }
      return v.bind(cible);
    },
  });
  virage = createVirage({ pool: compte, io, souvenirs, fanzzy, niveau,
    requireAuth: (r, _s, n) => n() });
  await new Promise((r) => http.listen(0, r));
  url = `http://localhost:${http.address().port}`;
}

const jitter = (t, a = 22) => Math.max(0, t + (Math.random() * a * 2 - a));
const tempo = () => Array.from({ length: 8 }, (_, i) => jitter(i * 560, 55));

const latences = [];
const erreurs = new Map();
const chantAt = new Map();     // userId -> instant du chant
let chants = 0, ticks = 0;

/**
 * Un supporter. `page` : il fait ce que la page du lot 6 fait au coup de
 * sifflet ; sinon c'est une page d'avant, ou un onglet oublié, qui ne
 * demande rien et attend `virage:ferme`.
 */
function join(i, { fixtureId = FIXTURE, page = true } = {}) {
  const id = idDe(i);
  const socket = client(url, { transports: ['websocket'], auth: { token: id } });
  const p = { i, id, socket, fixtureId, page, ready: false, fin: false, demandeA: 0, bilanEn: null,
    fermeA: null };
  socket.on('virage:state', () => { p.ready = true; });
  /* Le coup de sifflet, comme la page : un délai tiré entre 0 et 8 s, puis
     la demande ; on chronomètre de la demande à la réponse. Puis elle quitte
     la salle (§ 15.3) — c'est ce départ qui passe par le filet de l'XP. */
  socket.on('virage:fin', () => {
    if (p.fin || !page) return;
    p.fin = true;
    setTimeout(() => { p.demandeA = performance.now(); socket.emit('virage:bilan'); },
      Math.random() * 8000);
  });
  socket.on('virage:bilan', (b) => {
    p.bilanEn = performance.now() - p.demandeA;
    p.bilan = b;
    p.parti = true;
    socket.emit('virage:leave');
  });
  socket.on('virage:ferme', () => { p.fermeA ??= performance.now(); p.parti = true; });
  socket.on('virage:tick', () => {
    ticks++;
    // Un tick qui suit un chant : on mesure le délai pour ce supporter.
    for (const [uid, t] of chantAt) {
      latences.push(performance.now() - t);
      chantAt.delete(uid);
    }
  });
  socket.on('virage:error', (e) => erreurs.set(e.code, (erreurs.get(e.code) ?? 0) + 1));
  socket.on('connect_error', (e) =>
    erreurs.set('connect:' + e.message, (erreurs.get('connect:' + e.message) ?? 0) + 1));
  /* La reconnexion d'une page qui a quitté la salle ne la rejoint plus
     (§ 15.3), ni celle d'un onglet que `virage:ferme` a sorti. */
  socket.on('connect', () => { if (!p.parti) socket.emit('virage:join', { fixtureId }); });
  return p;
}

const gens = [];
for (let i = 0; i < N + M; i++) {
  gens.push(i < N ? join(i) : join(i, { fixtureId: FIXTURE_FERME, page: false }));
  if (i % 25 === 0) await new Promise((r) => setTimeout(r, 60));   // montée progressive
}
// L'entrée demande une lecture en base par supporter : à plusieurs centaines,
// il faut laisser le temps à la file de se vider avant de compter.
await new Promise((r) => setTimeout(r, 1500 + (N + M) * 12));
const entres = gens.filter((g) => g.ready).length;

const rssAvant = process.memoryUsage?.().rss ?? 0;
const t0 = performance.now();

// Chaque supporter chante toutes les 4 à 8 secondes, comme un vrai.
const boucles = gens.map((g) => setInterval(() => {
  if (!g.ready || !g.socket.connected) return;
  chantAt.set(g.id, performance.now());
  g.socket.emit('virage:chant', { cardId: 'reprise', taps: tempo() });
  chants++;
}, 4000 + Math.random() * 4000));

await new Promise((r) => setTimeout(r, DUREE_MS));
for (const b of boucles) clearInterval(b);

latences.sort((a, b) => a - b);
const pct = (q) => (latences.length ? latences[Math.floor(latences.length * q)].toFixed(0) : 'n/a');
const secondes = (performance.now() - t0) / 1000;

console.log(`\n${N} supporters${M ? ` (+ ${M} dans la tribune qui se vide)` : ''} · ${REMOTE ?? 'serveur local'}`);
console.log(`entrés dans le virage : ${entres}/${N + M}`);
console.log(`chants envoyés        : ${chants} (${(chants / secondes).toFixed(1)}/s)`);
console.log(`diffusions reçues     : ${ticks} (${(ticks / secondes / Math.max(1, entres)).toFixed(1)}/s par client)`);
console.log(`chant → corde vue     : p50 ${pct(0.5)} ms · p95 ${pct(0.95)} ms · p99 ${pct(0.99)} ms`);
if (!REMOTE) {
  console.log(`mémoire du process    : +${((process.memoryUsage().rss - rssAvant) / 1e6).toFixed(0)} Mo`);
  const salle = virage.rooms.get(FIXTURE);
  if (salle) console.log(`foule vue par le serveur : ${JSON.stringify(salle.crowd())}`);
}
if (erreurs.size) console.log('erreurs :', Object.fromEntries(erreurs));

/* ------------------------------------------------- le coup de sifflet (P5) */

if (!REMOTE && process.env.SIFFLET !== '0') {
  const { reglage } = await import('../src/shared/reglages.js');
  const seuil = reglage('xp.virage_chants');
  /* Une moitié de chaque tribune a de quoi toucher l'XP du match : dix
     chants de plus sur sa ligne, écrite comme le serveur l'écrit. L'autre
     reste sous le seuil, quoi qu'elle ait chanté en vingt-cinq secondes. */
  const parLots = async (ids, sql) => {
    for (let k = 0; k < ids.length; k += 500) {
      const lot = ids.slice(k, k + 500);
      await pool.query(sql.split('(?)').join(`(${lot.map(() => '?').join(',')})`), lot);
    }
  };
  await parLots(gens.filter((g) => xpDue(g.i)).map((g) => g.id),
    'UPDATE virage_presence SET chants = chants + 10 WHERE user_id IN (?)');
  await parLots(gens.filter((g) => !xpDue(g.i)).map((g) => g.id),
    `UPDATE virage_presence SET chants = LEAST(chants, ${Math.max(0, seuil - 1)}) WHERE user_id IN (?)`);
  const [lignes] = await pool.query(
    `SELECT fixture_id AS f, COUNT(*) AS n, SUM(chants >= ?) AS dus
       FROM virage_presence WHERE fixture_id IN (?, ?) GROUP BY fixture_id`,
    [seuil, FIXTURE, FIXTURE_FERME]);
  const ligneDe = (f) => lignes.find((l) => Number(l.f) === f) ?? { n: 0, dus: 0 };
  const dusA = Number(ligneDe(FIXTURE).dus), dusF = Number(ligneDe(FIXTURE_FERME).dus);
  const versees = async (f) => Number((await pool.query(
    `SELECT COUNT(*) AS n FROM recompenses WHERE source = 'virage' AND cle = ?`, [String(f)]))[0][0].n);

  erreurs.clear();
  requetes.lectures = 0;
  requetes.connexions = 0;
  /* Les files, échantillonnées : les demandes qui attendent une connexion du
     pool (`pool.pool` est le pool sous la promesse, mysql2), et les
     versements qui attendent une place au sémaphore — dont les filets. */
  const filePool = () => pool.pool?._connectionQueue?.length ?? 0;
  const files = [], semas = [], filets = [];
  const sonde = setInterval(() => {
    files.push(filePool());
    const s = virage.bilan.etatXp?.() ?? {};
    semas.push(s.enAttente ?? 0);
    filets.push(s.filets ?? 0);
  }, 20);

  const t1 = performance.now();
  virage.matchStatus(FIXTURE, { status: 'FT', elapsed: 90 });
  /* La tribune qui se vide : son match est fini depuis `virage.bilan_min`
     minutes moins deux secondes — `virage:ferme` tombe en pleine vague des
     bilans de l'autre. Ses arrivées sont plus anciennes que la fin. */
  const salleF = M ? virage.rooms.get(FIXTURE_FERME) : null;
  if (salleF) {
    virage.matchStatus(FIXTURE_FERME, { status: 'FT', elapsed: 90 });
    salleF.finA = Date.now() - reglage('virage.bilan_min') * 60_000 + 2000;
    for (const m of salleF.members.values()) m.entreA = 0;
  }
  const pages = gens.filter((g) => g.page && g.ready && g.socket.connected);
  const onglets = gens.filter((g) => !g.page && g.ready && g.socket.connected);
  const fin = performance.now() + 60_000;
  let lignesF = 0, toutVerseA = null;
  while (performance.now() < fin) {
    await new Promise((r) => setTimeout(r, 100));
    if (salleF && toutVerseA == null && (lignesF = await versees(FIXTURE_FERME)) >= dusF) {
      toutVerseA = performance.now();
    }
    const s = virage.bilan.etatXp?.() ?? {};
    if (pages.every((g) => g.bilanEn != null) && (!salleF || toutVerseA != null)
        && !s.enCours && !s.enAttente) break;
  }
  clearInterval(sonde);
  const delais = pages.map((g) => g.bilanEn).filter((x) => x != null).sort((a, b) => a - b);
  const centile = (q) => (delais.length ? delais[Math.min(delais.length - 1, Math.floor(delais.length * q))] : NaN);
  const ms = (x) => (Number.isFinite(x) ? `${x.toFixed(0)} ms` : 'n/a');
  const p95 = centile(0.95);
  const tard = delais.filter((x) => x > SEUIL_PAGE_MS).length;
  const verses = pages.filter((g) => g.bilan?.xp?.verse).length;
  const lignesA = await versees(FIXTURE);
  const moy = (t) => (t.length ? t.reduce((a, b) => a + b, 0) / t.length : 0);
  const fermes = onglets.map((g) => g.fermeA).filter((x) => x != null);

  console.log(`\ncoup de sifflet · ${pages.length} pages (bilan puis virage:leave)`
    + `${salleF ? ` · ${onglets.length} onglets dans la tribune qui se vide` : ''}`
    + ` · ${((performance.now() - t1) / 1000).toFixed(1)} s`);
  console.log(`bilans reçus          : ${delais.length}/${pages.length}`
    + ` · au-delà de ${SEUIL_PAGE_MS / 1000} s : ${tard} (${(100 * tard / Math.max(1, delais.length)).toFixed(1)} %)`);
  console.log(`délai du bilan        : p50 ${ms(centile(0.5))} · p95 ${ms(p95)} · p99 ${ms(centile(0.99))}`
    + ` · max ${ms(delais.at(-1))} — p95 ${p95 > SEUIL_PAGE_MS ? 'AU-DESSUS' : 'sous'} le seuil de la page`);
  console.log(`XP versée au bilan    : ${verses} bilans · ${lignesA} lignes au grand livre (${dusA} dues)`);
  if (salleF) {
    const premier = fermes.length ? Math.min(...fermes) : NaN;
    const dernier = fermes.length ? Math.max(...fermes) : NaN;
    console.log(`tribune qui se vide   : virage:ferme ${fermes.length}/${onglets.length},`
      + ` étalé sur ${ms(dernier - premier)} · XP du filet ${lignesF}/${dusF} dues,`
      + ` toutes en ${ms(toutVerseA - premier)} après le premier virage:ferme`);
  }
  console.log(`requêtes du Virage    : ${requetes.lectures} lectures (pool) · ${requetes.connexions} connexions`
    + ` (${dusA + dusF} versements dus)`);
  console.log(`file du pool          : max ${Math.max(0, ...files)} · moyenne ${moy(files).toFixed(2)} (${files.length} relevés)`);
  console.log(`file du sémaphore     : max ${Math.max(0, ...semas)} · moyenne ${moy(semas).toFixed(2)}`
    + ` · dont filets : max ${Math.max(0, ...filets)}`);
  if (erreurs.size) console.log('erreurs :', Object.fromEntries(erreurs));
}

for (const g of gens) g.socket.disconnect();
virage?.stop(); io?.close(); http?.close(); await pool?.end();
process.exit(0);
