/**
 * Contrôle du câblage des modules, à passer avant chaque livraison serveur.
 *
 * `server.js` construit ses modules dans un ordre imposé : l'inscription
 * existe avant le suivi des matchs, l'administration avant le Grand Virage.
 * Un module qui reçoit une dépendance encore absente la garde à `null` pour
 * toujours, sans rien dire — pas d'exception, pas de log, juste une
 * fonctionnalité qui ne s'exécute jamais.
 *
 * C'est exactement ce qui est arrivé à l'inscription : elle recevait
 * `football: null`, et le club choisi à la cérémonie d'arrivée n'avait donc
 * jamais son calendrier chargé. `/deck`, `/duel-nvn` et `/virage` ne
 * proposaient aucun match au joueur neuf, sur son tout premier écran. Rien
 * dans les logs, rien dans les tests : le seul symptôme était une liste vide.
 *
 * Ce contrôle ne demande ni base ni réseau — il monte les modules sur un faux
 * pool. Usage : node scripts/verif-cablage.mjs
 */
import { createOnboarding } from '../src/server/onboarding/index.js';

let fautes = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) fautes++; };

/**
 * Un pool qui répond juste ce qu'il faut à `follow()` : un portefeuille avec
 * des emplacements libres, aucun club déjà suivi, puis des écritures muettes.
 */
const pool = {
  execute: async (sql) => {
    if (/FROM user_wallet/.test(sql)) return [[{ follow_slots: 2 }]];
    if (/FROM user_follows/.test(sql)) return [[]];
    return [{ affectedRows: 1 }];
  },
};

const demandes = [];
const fauxFootball = { poller: { refreshTeam: async (id) => { demandes.push(id); } } };

/* ------------------------------------------- l'inscription et le calendrier */

// Construite comme dans server.js : le suivi des matchs n'existe pas encore.
const onboarding = createOnboarding({ pool, requireAuth: (_r, _s, n) => n() });

await onboarding.follow('u-1', 85, { main: true });
check('sans suivi branché, suivre un club ne plante pas', demandes.length === 0);

// Rebranchement, tel que server.js le fait une fois le module football prêt.
onboarding.football = fauxFootball;

await onboarding.follow('u-1', 91, { main: true });
check('une fois le suivi branché, le calendrier du club est demandé', demandes.length === 1);
check('c’est bien le club suivi qui est demandé', demandes[0] === 91);

demandes.length = 0;
await onboarding.follow('u-2', 61, { main: true });
check('chaque nouveau club déclenche son chargement', demandes.length === 1 && demandes[0] === 61);

/* ------------------------------------ server.js fait-il vraiment le branchement ? */

/**
 * Le test ci-dessus prouve que le rebranchement *fonctionne*. Il ne prouve pas
 * que `server.js` l'appelle. On le vérifie par lecture : c'est grossier, mais
 * ça attrape la suppression accidentelle d'une ligne dont rien d'autre ne
 * signale l'absence.
 */
const serveur = await import('node:fs/promises').then((fs) => fs.readFile('server.js', 'utf8'));
check('server.js rebranche le suivi sur l’inscription',
  /onboarding\.football\s*=\s*football/.test(serveur));

/**
 * Même famille de panne : un crochet que personne n'appelle. Le but réel du
 * match support doit atteindre les duels en cours, sinon le terrain cesse de
 * déborder sur la corde — et rien ne le signale, puisqu'il ne se passe
 * simplement rien.
 */
check('server.js fait suivre le but réel aux duels en cours',
  /nvn\??\.butReel\s*\(/.test(serveur));

check('server.js branche le fil du match sur le virage',
  /onStatus:\s*\(/.test(serveur) && /onEvents:\s*\(/.test(serveur)
  && /fixturesAuFil:\s*\(/.test(serveur));

/* ------------------------- les crochets du suivi atteignent-ils le relevé ? */

/**
 * `server.js` confie cinq crochets à `createFootball` : `onGoal`,
 * `onFinished`, `onStatus`, `onEvents` et `fixturesAuFil`. Aucun ne sert à
 * quoi que ce soit tant que `createFootball` ne les fait pas suivre à
 * `createPoller` — et il n'y a pas d'erreur à la clé, seulement un objet
 * qu'on lit et dont on ignore la moitié des clés.
 *
 * **`onFinished` a vécu ainsi.** `server.js` le passait, `createFootball` ne
 * le nommait pas dans sa signature, et le classement d'une compétition n'était
 * donc jamais rafraîchi à la fin d'un match : six heures de cache sur les
 * chiffres qu'on va justement regarder à ce moment-là. Ni exception, ni log.
 * Le crochet tombait dans le vide entre deux modules, ce qui est exactement ce
 * que ce fichier surveille.
 *
 * On ne le vérifie pas par lecture : un nom présent dans la signature peut
 * n'être transmis à personne. On déroule donc un vrai tour de relevé sur un
 * faux pool et un faux client, et on regarde qui a été appelé.
 */
{
  const { createFootball } = await import('../src/server/football/routes.js');

  const poolFoot = {
    execute: async (sql) => {
      if (/status_short IN \('NS','TBD'\)/.test(sql)) return [[]];
      if (/FROM fixtures f/.test(sql)) return [[{ id: 5001 }]];
      if (/FROM fixtures WHERE id/.test(sql)) {
        // Le match était en cours et sans but : le statut change, le score non.
        return [[{ home_goals: 0, away_goals: 0, status_short: '2H', elapsed: 88 }]];
      }
      if (/FROM fixture_events/.test(sql)) return [[]];
      return [{ affectedRows: 1 }];
    },
    query: async () => [{ affectedRows: 1 }],
  };

  const appels = [];
  const clientFoot = {
    attachStore() {},
    fixturesByIds: async () => [{
      fixture: { id: 5001, date: new Date().toISOString(), status: { short: 'FT', elapsed: 90 } },
      league: { id: 61, name: 'Ligue 1', season: 2026, round: 'J5' },
      teams: { home: { id: 85, name: 'Sion' }, away: { id: 91, name: 'Bâle' } },
      goals: { home: 0, away: 0 },
    }],
    eventsOfFixture: async () => [{
      type: 'Card', detail: 'Yellow Card', team: { id: 85 },
      player: { name: 'Diallo' }, time: { elapsed: 72 },
    }],
  };

  const foot = createFootball({
    pool: poolFoot, client: clientFoot, io: null, requireAuth: (_r, _s, n) => n(),
    onGoal: () => appels.push('onGoal'),
    onFinished: () => appels.push('onFinished'),
    onStatus: () => appels.push('onStatus'),
    onEvents: () => appels.push('onEvents'),
    fixturesAuFil: () => { appels.push('fixturesAuFil'); return [5001]; },
  });

  await foot.poller.pollLive();

  check('le relevé demande quelles salles attendent leur fil',
    appels.includes('fixturesAuFil'));
  check('il annonce le score et la période à chaque tour', appels.includes('onStatus'));
  check('il fait suivre les événements du terrain', appels.includes('onEvents'));
  check('et il annonce la fin du match, même sans un seul but',
    appels.includes('onFinished') || (console.log('        appels :', appels.join(', ')), false));
}

/* ---------------------------- le serveur n'emporte que ses cinq paquets

   **La panne que ce contrôle empêche n'arrive qu'en production.**

   Le serveur s'installe désormais sans les dépendances de développement —
   `npm ci --omit=dev`, voir `scripts/deployer.sh`. La raison est `puppeteer` :
   son installation télécharge Chromium, deux cents mégaoctets sur un
   hébergement mutualisé, pour un navigateur dont ce serveur n'a aucun usage.

   La contrepartie est qu'un `import` de trop devient invisible ici et fatal
   là-bas. `sharp` dans un module d'images, `jsdom` dans un rendu côté serveur :
   la machine de développement les a, tous les tests passent, et la mise en
   ligne casse au démarrage avec « Cannot find package » — c'est-à-dire toutes
   les routes `/api` d'un coup, connexion comprise. Exactement la famille de
   pannes que ce fichier surveille : rien ne la signale avant qu'il soit trop
   tard.

   On lit donc ce que charge le serveur — lui-même, tout `src/`, `build.mjs` et
   le chemin du schéma — et on refuse tout paquet déclaré en développement.   */
{
  const fs = await import('node:fs/promises');
  const path = await import('node:path');

  const manifeste = JSON.parse(await fs.readFile('package.json', 'utf8'));
  const dev = Object.keys(manifeste.devDependencies ?? {});

  /** Tous les fichiers chargés par le serveur, directement ou en cascade. */
  const aLire = ['server.js', 'build.mjs', 'scripts/appliquer-schema.mjs',
    'scripts/ordre-schema.mjs'];
  const parcourir = async (dossier) => {
    for (const e of await fs.readdir(dossier, { withFileTypes: true })) {
      const ou = path.join(dossier, e.name);
      if (e.isDirectory()) await parcourir(ou);
      else if (/\.m?js$/.test(e.name)) aLire.push(ou);
    }
  };
  await parcourir('src');

  const coupables = [];
  for (const fichier of aLire) {
    const code = await fs.readFile(fichier, 'utf8').catch(() => '');
    for (const paquet of dev) {
      /* Le nom exact ou un de ses sous-chemins — `sharp` et `sharp/lib/…` sont
         le même paquet absent. On ne lit que les imports de paquet : un chemin
         relatif qui contiendrait le mot ne compte pas. */
      const motif = new RegExp(
        `(?:from|import|require\\()\\s*['"]${paquet}(?:/[^'"]*)?['"]`);
      if (motif.test(code)) coupables.push(`${fichier} → ${paquet}`);
    }
  }

  check(coupables.length
    ? `le serveur importe un paquet absent en production : ${coupables.join(', ')}`
    : `le serveur ne charge que ses ${
      Object.keys(manifeste.dependencies ?? {}).length} paquets de production`,
  coupables.length === 0);
}

console.log(fautes
  ? `\n${fautes} faute(s) — ne pas livrer en l’état.`
  : '\nLe câblage des modules est correct.');
process.exit(fautes ? 1 : 0);
