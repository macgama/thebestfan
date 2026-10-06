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

/* Même panne muette : sans ce crochet, une salle sur un match que l'API ne
   rend plus le redemande à chaque tour, sept cent vingt appels par jour, et
   rien ne le dit. */
check('server.js dit au virage les matchs que l’API ne rend plus',
  /onAbsent:\s*\([^)]*\)\s*=>\s*virage\.matchAbsent\(/.test(serveur));

/* Les notifications : construites avant le KOP et les duels, et passées aux
   deux. Reçues à `null`, un vote qui s'ouvre et un duel classé qui attend ne
   préviendraient personne hors de la page — et rien ne le dirait. */
{
  const construites = serveur.indexOf('notifications = createNotifications(');
  const kopIci = serveur.search(/kop = createKop\(\{[^}]*notifications/);
  const nvnIci = serveur.search(/nvn = createNvN\(\{[^}]*notifications/);
  check('server.js passe les notifications au KOP', kopIci > construites && construites > 0);
  check('server.js passe les notifications aux duels', nvnIci > construites && construites > 0);
  check('server.js monte les routes des notifications',
    /app\.use\('\/api\/notifications',\s*notifications\.router\)/.test(serveur));
}

/* L'administration reçoit `abonnement` et `contenus` à sa construction, puis
   le client du football et le Virage une fois le suivi prêt. Ce second
   branchement **remplaçait** les dépendances au lieu de les compléter :
   l'onglet CONTENUS se disait débranché et ses boutons disparaissaient, sur
   une base où `sql/contenus.sql` était appliqué depuis des semaines. */
check('server.js complète les dépendances de l’administration sans les écraser',
  !/admin\.deps\s*=[^=]/.test(serveur) && /Object\.assign\(admin\.deps,/.test(serveur));

/* ------------------------- les crochets du suivi atteignent-ils le relevé ? */

/**
 * `server.js` confie six crochets à `createFootball` : `onGoal`,
 * `onFinished`, `onStatus`, `onAbsent`, `onEvents` et `fixturesAuFil`. Aucun
 * ne sert à quoi que ce soit tant que `createFootball` ne les fait pas suivre à
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
    onAbsent: (id) => appels.push(`onAbsent:${id}`),
    onEvents: () => appels.push('onEvents'),
    // 5002 : une salle sur un match que l'API ne rend plus.
    fixturesAuFil: () => { appels.push('fixturesAuFil'); return [5001, 5002]; },
  });

  await foot.poller.pollLive();

  check('le relevé demande quelles salles attendent leur fil',
    appels.includes('fixturesAuFil'));
  check('il annonce le score et la période à chaque tour', appels.includes('onStatus'));
  check('il dit le match que l’API n’a pas rendu, et lui seul',
    appels.includes('onAbsent:5002') && !appels.includes('onAbsent:5001')
    || (console.log('        appels :', appels.join(', ')), false));
  check('il fait suivre les événements du terrain', appels.includes('onEvents'));
  check('et il annonce la fin du match, même sans un seul but',
    appels.includes('onFinished') || (console.log('        appels :', appels.join(', ')), false));
}

/* ------------------------------ le quotidien : ses portes, et rien d'autre

   **Deux pannes muettes possibles, et une règle.**

   Le quotidien verse par le grand livre, et deux de ses versements ont besoin
   d'un autre module : l'XP d'une mission entre dans la transaction par
   `niveau.gagnerDans`, et un booster offert (le sachet, la septième case, un
   palier du carnet, le relais) compte d'abord la recharge due par
   `fanzzy.recharger`. Construit avant eux dans `server.js`, il les garderait à
   `null` : la première réclamation lèverait, ou — pire — on finirait par
   écrire un repli qui verse sans eux. Et la journée du football doit rester
   une **fonction** : le télétexte est monté plus bas, une valeur lue au
   montage vaudrait `null` pour toujours, et aucune mission du Virage ne
   serait jamais proposée, sans un mot.

   La règle : le quotidien ne reçoit **ni l'abonnement, ni le KOP, ni les
   amis**. Abonné et non-abonné reçoivent les mêmes missions et les mêmes
   montants (`SERVEUR.md`, § 9), et le plus sûr est qu'il ne puisse pas savoir
   qui est abonné. On le vérifie des deux côtés : ce que le module **lit** de
   ses options (un `Proxy` note chaque clé demandée — une signature qui ne
   nomme pas une option ne la lit pas), et ce que `server.js` lui **passe**. */
{
  const { createQuotidien } = await import('../src/server/quotidien/index.js');

  const lues = new Set();
  let journeeLue = 0;
  const fournies = {
    pool: { execute: async () => [[]], query: async () => [[]] },
    requireAuth: (_r, _s, n) => n(),
    niveau: { gagnerDans: async () => ({}) },
    fanzzy: { recharger: async () => {} },
    jourDuFoot: () => { journeeLue++; return null; },
    abonnement: { estAbonne: async () => true },
    kop: {},
    amis: {},
  };
  const options = new Proxy(fournies, {
    get(cible, cle) { lues.add(cle); return cible[cle]; },
  });
  const module = createQuotidien(options);

  check('le quotidien se monte et rend son routeur', typeof module?.router === 'function');
  check('il lit niveau, fanzzy et la journée du football',
    ['niveau', 'fanzzy', 'jourDuFoot'].every((k) => lues.has(k))
    || (console.log('        lues :', [...lues].join(', ')), false));
  check('il ne lit ni l’abonnement, ni le KOP, ni les amis',
    !['abonnement', 'kop', 'amis'].some((k) => lues.has(k))
    || (console.log('        lues :', [...lues].join(', ')), false));
  check('la journée du football n’est pas lue au montage (le télétexte vient après)',
    journeeLue === 0);

  /* Ce que `server.js` lui passe, lu dans l'appel lui-même. */
  const debut = serveur.indexOf('createQuotidien({');
  const fin = debut < 0 ? -1 : serveur.indexOf('})', debut);
  const appel = debut < 0 || fin < 0 ? '' : serveur.slice(debut, fin);
  const nomme = (mot) => new RegExp(`\\b${mot}\\b`).test(appel);
  check('server.js construit le quotidien', appel.length > 0);
  check('server.js lui passe niveau et fanzzy', nomme('niveau') && nomme('fanzzy'));
  check('server.js lui passe la journée comme une fonction, lue à l’appel',
    /jourDuFoot:\s*\(\)\s*=>\s*teletext\?\.jour\(/.test(appel));
  check('server.js ne lui passe ni l’abonnement, ni le KOP, ni les amis',
    !nomme('abonnement') && !nomme('kop') && !nomme('amis'));
  check('niveau et fanzzy sont construits avant lui dans server.js',
    debut > serveur.indexOf('niveau = createNiveau(') && serveur.indexOf('niveau = createNiveau(') > 0
    && debut > serveur.indexOf('fanzzy = createFanzzy(') && serveur.indexOf('fanzzy = createFanzzy(') > 0);
  check('server.js monte ses routes sur /api/quotidien',
    /app\.use\(\s*'\/api\/quotidien'\s*,\s*quotidien\.router\s*\)/.test(serveur));
  check('server.js lance la sonde du jour de jeu et la rend dans /healthz',
    /sonderJourDeJeu\(pool\)/.test(serveur) && /\.\.\.\(jourDeJeu \? \{ jourDeJeu \} : \{\}\)/.test(serveur));
}

/* ------------------------------------ l'aide : la porte de la recharge

   **La même panne muette, en plus discret.** Le booster de fin des premiers
   pas compte d'abord la recharge due, par `fanzzy.recharger`, et refuse de
   verser sans elle. `server.js` ne la passait pas : l'aide la lisait sur
   `globalThis.fanzzy`, une globale qui ressemblait à un reste et que rien ne
   protégeait. Elle reçoit `fanzzy` désormais, et ne lit plus que lui. Retirer
   `fanzzy` de l'appel, ou monter l'aide avant fanzzy, mettrait chaque booster
   de fin en panne — un 503 et une ligne au journal —, et aucune suite ne le
   verrait, puisque toutes passent leur porte elles-mêmes.

   Des deux côtés, comme pour le relevé : un vrai versement, sur un faux pool,
   appelle-t-il la porte reçue — une signature qui nomme `fanzzy` peut ne la
   transmettre à personne —, et `server.js` la passe-t-il ? */
{
  const { createAide } = await import('../src/server/aide/index.js');

  /* Un joueur au bout du parcours : les six signaux sont vrais, et rien n'a
     encore été versé. */
  const lignes = (sql) => {
    if (/FROM user_fanzzy/.test(sql)) return [{ n: 1, age: 2 }];
    if (/packs_ouverts/.test(sql)) return [{ n: 1 }];
    if (/FROM user_decks/.test(sql)) return [{ contenu: '{"fanzzy":[1,2]}', cree: 0, maj: 1 }];
    if (/FROM virage_presence|FROM duel_results/.test(sql)) return [{ oui: 1 }];
    return [];
  };
  const fauxPool = {
    execute: async (sql) => [lignes(sql)],
    getConnection: async () => ({
      beginTransaction: async () => {},
      query: async (sql) => (/parcours_paye AS p/.test(sql)
        ? [[{ p: 0 }]] : [{ affectedRows: 1 }]),
      commit: async () => {},
      rollback: async () => {},
      release: () => {},
    }),
  };
  const recharges = [];
  const aide = createAide({ pool: fauxPool, requireAuth: (_r, _s, n) => n(),
    fanzzy: { recharger: async (lecteur) => {
      recharges.push(lecteur === fauxPool ? 'pool' : 'connexion');
    } } });
  const verse = await aide.recompenser('u-aide').catch((e) => ({ leve: e.message }));
  check('l’aide verse le booster de fin par la porte qu’on lui passe',
    verse?.verse === true && recharges.includes('connexion')
    || (console.log('        il dit :', JSON.stringify(verse), '· recharges :',
      recharges.join(', ') || 'aucune'), false));

  /* **Et par elle seule.** Lire l'appel ne suffit pas : le journal du lot 4
     (`HISTORIQUE.md`, 4 quadragies quater) décrit la globale comme le
     câblage à garder, et le journal ne se réécrit pas. Qui le suit
     remettrait le repli sans toucher à l'appel, et l'aide aurait de nouveau
     deux chemins vers la même porte — dont un qu'on retire un jour en
     croyant nettoyer. Sans `fanzzy`, une globale posée, elle doit donc
     refuser comme sans porte, et ne jamais appeler celle de la globale. */
  const parLaGlobale = [];
  globalThis.fanzzy = { recharger: async () => { parLaGlobale.push('globale'); } };
  let sansInjection;
  try {
    sansInjection = await createAide({ pool: fauxPool, requireAuth: (_r, _s, n) => n() })
      .recompenser('u-aide-globale').catch((e) => ({ leve: e.message }));
  } finally {
    delete globalThis.fanzzy;
  }
  check('et par elle seule : une globale fanzzy posée n’est pas lue',
    /recharger/.test(sansInjection?.leve ?? '') && parLaGlobale.length === 0
    || (console.log('        il dit :', JSON.stringify(sansInjection),
      '· porte de la globale appelée', parLaGlobale.length, 'fois'), false));

  /* Ce que `server.js` lui passe, lu dans l'appel lui-même. */
  const debut = serveur.indexOf('createAide({');
  const fin = debut < 0 ? -1 : serveur.indexOf('})', debut);
  const appel = debut < 0 || fin < 0 ? '' : serveur.slice(debut, fin);
  const monteFanzzy = serveur.indexOf('fanzzy = createFanzzy(');
  check('server.js construit l’aide', appel.length > 0);
  /* `fanzzy` en raccourci ou `fanzzy: fanzzy` ; pas `fanzzy: null`. */
  check('server.js lui passe fanzzy, la porte de la recharge',
    /[{,]\s*fanzzy\s*(?::\s*fanzzy\s*)?(?:,|$)/.test(appel)
    || (console.log('        appel :', appel.replace(/\s+/g, ' ')), false));
  check('fanzzy est construit avant elle dans server.js',
    monteFanzzy > 0 && debut > monteFanzzy);
}

/* ------------------------------------- la présence : montée, branchée, servie

   **Quatre pannes muettes possibles, et aucune ne lève** (`SERVEUR-VAGUE2.md`,
   § 6.4 ; `CONTRATS.md`, § 18).

   La présence se construit juste après la session, parce que c'est là qu'une
   activité se voit ; mais elle apprend « qui est au Virage » et « qui est en
   duel » des deux arènes, qui se montent bien plus bas. Branchée avant elles,
   elle recevrait deux `undefined` et ne dirait jamais ni l'un ni l'autre. Et
   si une arène ne rend pas sa fonction, `server.js` peut la passer tant qu'il
   veut : c'est `undefined` qui arrive. Les amis et le Virage la reçoivent, ou
   leur pastille et leur « 2 AMIS ICI » restent éteints pour toujours. Enfin,
   le crochet d'activité doit passer **avant** les routeurs, sans quoi une
   requête servie plus haut ne marquerait personne en ligne.

   On regarde donc les deux côtés, comme pour le quotidien : ce que
   `server.js` écrit, et ce que les modules montés sur de faux appuis
   rendent et lisent vraiment. */
{
  const { createVirage } = await import('../src/server/ferveur/index.js');
  const { createNvN } = await import('../src/server/nvn/index.js');
  const { createAmis } = await import('../src/server/amis/index.js');

  /* Le texte d'un appel, commentaires retirés : un mot cité dans un
     commentaire n'est pas un argument passé. */
  const sansCommentaires = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const appelDe = (ancre) => {
    const debut = serveur.indexOf(ancre);
    const fin = debut < 0 ? -1 : serveur.indexOf('})', debut);
    return debut < 0 || fin < 0 ? '' : sansCommentaires(serveur.slice(debut, fin + 2));
  };
  const passe = (appel, nom) => new RegExp(`[\\s,{]${nom}\\s*[,:}]`).test(appel);
  const ou = (ancre) => serveur.indexOf(ancre);

  const iSession = ou('app.use(auth.attachUser)');
  const iPresence = ou('presence = createPresence(');
  const iCrochet = ou("app.use('/api', (req");
  const iVirage = ou('virage = createVirage(');
  const iNvn = ou('nvn = createNvN(');
  const iAmis = ou('amis = createAmis(');
  const iBrancher = ou('presence.brancher(');

  check('server.js construit la présence après la session',
    iSession > 0 && iPresence > iSession);
  const crochet = iCrochet < 0 ? '' : sansCommentaires(serveur.slice(iCrochet, serveur.indexOf('});', iCrochet)));
  check('une requête /api sous session marque une activité, avant tous les routeurs',
    /if\s*\(\s*req\.user\s*\)\s*presence\??\.noter\(\s*req\.user\.id\s*\)/.test(crochet)
    && iCrochet > iPresence
    && iCrochet < ou("app.use('/api/auth'") && iCrochet < ou("app.use('/api/amis'"));
  check('une socket qui se connecte aussi',
    /presence\??\.noter\(\s*socket\.data\.user\??\.userId\s*\)/.test(serveur));
  check('server.js passe la présence aux amis, construits après elle',
    passe(appelDe('amis = createAmis('), 'presence') && iAmis > iPresence);
  check('et au Virage, construit après elle',
    passe(appelDe('virage = createVirage('), 'presence') && iVirage > iPresence);
  /* **L'XP du Virage, même famille de panne** (§ 15). Le bilan la verse par
     le grand livre, qui la crédite par `niveau.gagnerDans`. Un Virage qui ne
     reçoit pas `niveau` paie quand même — `bilan.js` monte alors une instance
     à lui, sans état —, et c'est justement pourquoi rien ne le dirait : l'XP
     du serveur passerait par deux modules, le second né en silence au
     premier bilan. Les missions et le duel reçoivent celui de server.js ; le
     Virage aussi. */
  const iNiveau = ou('niveau = createNiveau(');
  check('server.js passe niveau au Virage, construit après lui (l’XP du bilan)',
    passe(appelDe('virage = createVirage('), 'niveau') && iNiveau > 0 && iVirage > iNiveau
    || (console.log('        niveau construit à', iNiveau, '· Virage à', iVirage), false));
  const brancher = appelDe('presence.brancher(');
  check('server.js branche la présence sur le Virage et sur le duel',
    /estAuVirage\s*:\s*virage\??\.estAuVirage\b/.test(brancher)
    && /estEnDuel\s*:\s*nvn\??\.estEnDuel\b/.test(brancher)
    || (console.log('        brancher :', brancher.replace(/\s+/g, ' ') || '(absent)'), false));
  check('une fois les deux arènes montées, pas avant',
    iBrancher > iVirage && iBrancher > iNvn && iVirage > 0 && iNvn > 0
    || (console.log('        présence branchée à', iBrancher, '· duel à', iNvn, '· Virage à', iVirage), false));
  check('server.js monte /api/presence',
    /app\.use\(\s*'\/api\/presence'\s*,\s*presence\.router\s*\)/.test(serveur));

  /* Ce que les modules rendent et lisent, montés sur de faux appuis. Aucune
     requête ne part : on ne fait que les construire. */
  const poolMuet = { execute: async () => [[]], query: async () => [[]] };
  const ioMuet = {
    on() {}, use() {},
    to() { return { emit() {} }; },
    in() { return { emit() {}, fetchSockets: async () => [] }; },
  };
  const lire = (fournies) => {
    const lues = new Set();
    return { lues, options: new Proxy(fournies, { get(c, k) { lues.add(k); return c[k]; } }) };
  };

  const surAmis = lire({ pool: poolMuet, requireAuth: (_r, _s, n) => n(), kop: null,
    presence: { etatsPour: async () => new Map(), oublierAmis() {} } });
  createAmis(surAmis.options);
  check('les amis lisent la présence qu’on leur passe', surAmis.lues.has('presence'));

  const presenceFausse = { amisPresents: async () => [], aPrevenir: async () => [],
    visible: async () => false };
  const surVirage = lire({ pool: poolMuet, io: ioMuet, requireAuth: (_r, _s, n) => n(),
    souvenirs: {}, fanzzy: {}, presence: presenceFausse,
    niveau: { gagnerDans: async () => null } });
  const v = createVirage(surVirage.options);
  const n = createNvN({ pool: poolMuet, io: ioMuet, requireAuth: (_r, _s, nx) => nx(),
    decks: {} });
  try {
    /* Ceux-ci attendent les périmètres `serveur-virage` (partie B) et
       `serveur-duel` : tant qu'ils ne les ont pas posés, ils rougissent, et
       c'est le bon signal — ce que server.js passe n'arrive alors nulle
       part. */
    check('le Virage lit la présence qu’on lui passe (serveur-virage)',
      surVirage.lues.has('presence'));
    check('le Virage lit le niveau qu’on lui passe (serveur-virage)',
      surVirage.lues.has('niveau'));

    /* **Lire n'est pas transmettre.** Le Proxy du dessus resterait vert si le
       Virage lisait `niveau` puis le laissait de côté : `bilan.js` monterait
       alors sa propre instance, sans un mot. On le voit donc servir. Le vrai
       bilan du Virage verse l'XP d'un match par le vrai grand livre, sur une
       connexion de façade qui répond juste ce qu'il faut (une bourse ouverte,
       rien de déjà versé, assez de chants, aucun match payé aujourd'hui) ; et
       c'est la `gagnerDans` passée qui doit créditer, une fois, sur la
       connexion du versement, le montant du registre. */
    {
      const { reglage } = await import('../src/shared/reglages.js');
      const credits = [];
      const niveauTemoin = {
        gagnerDans: async (c, userId, montant) => {
          credits.push({ c, userId, montant });
          return { xp: montant, temoin: true };
        },
      };
      const connLivre = {
        execute: async (sql) => {
          if (/FROM user_wallet/.test(sql)) return [[{ scarves: 0, packs: 0 }]];
          if (/FROM virage_presence/.test(sql)) return [[{ chants: 999 }]];
          if (/COUNT\(\*\)[\s\S]*FROM recompenses/.test(sql)) return [[{ n: 0 }]];
          if (/^\s*SELECT/i.test(sql)) return [[]];
          return [{ affectedRows: 1 }];
        },
        beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {},
        release() {},
      };
      const vLivre = createVirage({ pool: { ...poolMuet, getConnection: async () => connLivre },
        io: ioMuet, requireAuth: (_r, _s, nx) => nx(), souvenirs: {}, fanzzy: {},
        presence: presenceFausse, niveau: niveauTemoin });
      try {
        const r = typeof vLivre.bilan?.verserXp === 'function'
          ? await vLivre.bilan.verserXp('u-temoin', 5003)
          : { verse: false, raison: 'createVirage ne rend pas bilan.verserXp' };
        check('et c’est lui qui crédite l’XP du match, sur la connexion du versement (serveur-virage)',
          r.verse === true && r.niveau?.temoin === true && credits.length === 1
          && credits[0].c === connLivre && credits[0].userId === 'u-temoin'
          && credits[0].montant === reglage('xp.virage')
          || (console.log('        versement :', JSON.stringify(r), '· crédits par le témoin :',
            credits.length), false));
      } catch (e) {
        check('et c’est lui qui crédite l’XP du match, sur la connexion du versement (serveur-virage)',
          false);
        console.log('        levé :', e.message);
      } finally {
        vLivre.stop?.();
      }
    }
    check('le Virage rend estAuVirage, que la présence branche (serveur-virage)',
      typeof v.estAuVirage === 'function');
    check('le duel rend estEnDuel, que la présence branche (serveur-duel)',
      typeof n.estEnDuel === 'function');
    check('le Virage rend souvenirFrappe, que le but réel appelle (serveur-virage)',
      typeof v.souvenirFrappe === 'function');

    /* **« Non nul après le montage », éprouvé et non plus seulement lu**
       (besoin de `serveur-duel`). Les contrôles du dessus lisent le texte de
       `server.js` et ce que rendent les modules ; celui-ci **exécute** la
       phrase même de `server.js` sur une vraie présence et les deux vraies
       arènes. Une phrase qui passerait le motif sans passer la fonction —
       `nvn.estEnDuel()` appelée au lieu d'être passée, par exemple — donne à
       la présence un `false` que rien ne signale : elle ne dirait jamais
       « en duel », et le seul symptôme serait une pastille qui ne vient pas.

       Puis on le voit marcher : un ami posé dans une vraie file du duel (la
       table même que lit `estEnDuel`) est « en duel », et ne l'est plus quand
       il en sort. Ce que la place signifie — la grâce de quatre-vingt-dix
       secondes, la fin du duel — est éprouvé dans les suites du duel ; ici,
       on vérifie que le fil arrive au bout. */
    const { createPresence } = await import('../src/server/presence/index.js');
    const { poserReglages } = await import('../src/shared/reglages.js');
    const alertes = [];
    const LECTEUR = 'u-lecteur';
    const EN_FILE = 'u-en-file';
    /* La lecture des amis mutuels du lecteur : un seul, qui n'a rien choisi
       (le défaut du registre, visible). Aucune autre requête n'est attendue. */
    const poolAmis = {
      execute: async (sql) => (/FROM amities/.test(sql) ? [[{ id: EN_FILE, choix: null }]] : [[]]),
      query: async () => [[]],
    };
    const P = createPresence({ pool: poolAmis, requireAuth: (_r, _s, nx) => nx(),
      log: { warn: (...a) => alertes.push(a.join(' ')), error: (...a) => alertes.push(a.join(' ')), log() {} } });
    let rejouee = false;
    try {
      if (brancher) {
        new Function('presence', 'virage', 'nvn', `${brancher};`)(P, v, n);
        rejouee = true;
      }
    } catch (e) { console.log('        phrase illisible :', e.message); }
    check('la phrase de server.js, rejouée, laisse au duel sa fonction (estEnDuel non nul)',
      rejouee && !alertes.some((a) => /duel non branché/.test(a))
      || (console.log('        journal :', alertes.join(' | ') || '(rien)'), false));
    check('et au Virage la sienne (estAuVirage non nul) (serveur-virage)',
      rejouee && !alertes.some((a) => /Virage non branché/.test(a)));

    const cleFile = '1v1:5002:0';
    poserReglages({ 'presence.actif': true });
    try {
      n.files.set(cleFile, [{ userId: EN_FILE, format: '1v1', depuis: Date.now() }]);
      const dedans = await P.etatsPour(LECTEUR, [EN_FILE]);
      n.files.delete(cleFile);
      const dehors = await P.etatsPour(LECTEUR, [EN_FILE]);
      check('branchée ainsi, la présence dit « duel » d’un ami dans une vraie file du duel',
        dedans.get(EN_FILE) === 'duel'
        || (console.log('        elle dit :', JSON.stringify([...dedans])), false));
      check('et plus rien quand il en sort', !dehors.has(EN_FILE));
    } catch (e) {
      check('branchée ainsi, la présence lit la file du duel', false);
      console.log('        levé :', e.message);
    } finally {
      n.files?.delete?.(cleFile);
      poserReglages({});
    }
  } finally {
    v.stop?.();
    n.stop?.();
  }
}

/* ------------------------------ la carte-souvenir annoncée, et à qui

   **Passer une fonction ne prouve pas qu'on l'appelle.** Le but réel frappe
   la carte-souvenir (`souvenirs.mintGoal`), puis le Virage l'annonce à ceux-là
   seuls qui l'ont reçue (`virage.souvenirFrappe`, `CONTRATS.md`, § 16.3). Si
   l'appel manque, se trompe de nom de champ, ou part avant que la frappe ait
   répondu, la carte n'est annoncée à personne — ou à tout le monde — et rien
   ne le dit.

   `server.js` ne s'importe pas : il écoute un port dès qu'on le charge. On y
   lit donc le crochet `onGoal` tel qu'il est écrit, on le reconstruit avec de
   faux Virage, souvenirs et duel, et on le donne au vrai relevé, qui voit
   passer un but. Ce qui est éprouvé est le texte même que le serveur
   exécute. */
{
  const { createFootball } = await import('../src/server/football/routes.js');

  /** La fin du bloc qui s'ouvre à `ouvrante`, chaînes et commentaires sautés. */
  const finDuBloc = (src, ouvrante) => {
    let prof = 0;
    for (let i = ouvrante; i < src.length; i++) {
      const c = src[i];
      if (c === '/' && src[i + 1] === '/') { i = src.indexOf('\n', i); if (i < 0) return -1; continue; }
      if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i + 2) + 1; if (i < 1) return -1; continue; }
      if (c === "'" || c === '"' || c === '`') {
        let j = i + 1;
        while (j < src.length && src[j] !== c) { if (src[j] === '\\') j++; j++; }
        i = j;
        continue;
      }
      if (c === '{') prof++;
      else if (c === '}' && --prof === 0) return i;
    }
    return -1;
  };

  const ancre = serveur.indexOf('onGoal: async (g) =>');
  const debut = ancre < 0 ? -1 : serveur.indexOf('async (g) =>', ancre);
  const ouvre = debut < 0 ? -1 : serveur.indexOf('{', debut);
  const ferme = ouvre < 0 ? -1 : finDuBloc(serveur, ouvre);
  const texte = ferme < 0 ? '' : serveur.slice(debut, ferme + 1);
  check('server.js écrit un crochet onGoal lisible', texte.length > 0);

  /** Le crochet de server.js, avec ses trois dépendances et son journal :
      ce sont les seuls noms que le texte relu voit de ce qui l'entoure. */
  const fabriquer = (virage, souvenirs, nvn, journal) =>
    new Function('virage', 'souvenirs', 'nvn', 'console', `return (${texte});`)(
      virage, souvenirs, nvn, journal);

  const ordre = [];
  const annonces = [];
  const erreurs = [];
  const journal = { error: (...a) => erreurs.push(a.join(' ')), warn() {}, log() {} };
  let frappe = async () => ({ minted: true, souvenirId: 88, presents: 1, family: 'club',
    price: 60, userIds: ['u-chante'] });
  const souvenirs = {
    mintGoal: async (b) => {
      ordre.push('frappe:début');
      // La frappe prend du temps, comme une écriture en base.
      await new Promise((r) => setTimeout(r, 15));
      ordre.push('frappe:fin');
      return frappe(b);
    },
  };
  /* Ce que la salle répond au but, et si elle existe : voir plus bas, « un
     but que la salle tait ». Par défaut, aucune salle et un but annoncé. */
  let reponseCorde = () => true;
  const virage = {
    rooms: new Map(),
    realGoal: () => { ordre.push('corde'); return reponseCorde(); },
    souvenirFrappe: (fixtureId, carte) => { ordre.push('annonce'); annonces.push({ fixtureId, carte }); },
  };
  const duels = [];
  const nvn = { butReel: (g) => { duels.push(g); } };

  let onGoal = null;
  try { onGoal = texte ? fabriquer(virage, souvenirs, nvn, journal) : null; }
  catch (e) { console.log('        crochet illisible :', e.message); }

  if (onGoal) {
    /* Un vrai tour de relevé : le match passe de 0–0 à 1–0, le relevé
       d'événements rend le but, et le relevé appelle le crochet. */
    const poolBut = {
      execute: async (sql) => {
        if (/status_short IN \('NS','TBD'\)/.test(sql)) return [[]];
        if (/FROM fixtures f/.test(sql)) return [[{ id: 5002 }]];
        if (/FROM fixtures WHERE id/.test(sql)) {
          return [[{ home_goals: 0, away_goals: 0, status_short: '2H', elapsed: 70 }]];
        }
        if (/FROM fixture_events/.test(sql)) return [[]];
        return [{ affectedRows: 1 }];
      },
      query: async () => [{ affectedRows: 1 }],
    };
    const clientBut = {
      attachStore() {},
      fixturesByIds: async () => [{
        fixture: { id: 5002, date: new Date().toISOString(), status: { short: '2H', elapsed: 71 } },
        league: { id: 207, name: 'Super League', season: 2026, round: 'J9' },
        teams: { home: { id: 85, name: 'Sion' }, away: { id: 91, name: 'Bâle' } },
        goals: { home: 1, away: 0 },
      }],
      eventsOfFixture: async () => [{
        type: 'Goal', detail: 'Normal Goal', team: { id: 85 },
        player: { name: 'Kabashi' }, time: { elapsed: 71 },
      }],
    };
    const foot = createFootball({ pool: poolBut, client: clientBut, io: null,
      requireAuth: (_r, _s, nx) => nx(), onGoal, fixturesAuFil: () => [] });
    await foot.poller.pollLive();

    const a = annonces[0];
    check('un but du relevé annonce la carte-souvenir, une fois',
      annonces.length === 1
      || (console.log('        annonces :', annonces.length, '· ordre :', ordre.join(' → '),
        '· erreurs :', erreurs.join(' | ') || 'aucune'), false));
    check('à ceux-là seuls qui l’ont reçue, pour ce match et cette carte',
      a?.fixtureId === 5002 && a?.carte?.souvenirId === 88
      && JSON.stringify(a?.carte?.userIds) === '["u-chante"]'
      || (console.log('        annonce :', JSON.stringify(a)), false));
    check('avec la minute et le buteur', a?.carte?.minute === 71 && a?.carte?.joueur === 'Kabashi');
    check('après que la frappe a répondu, jamais avant',
      ordre.indexOf('annonce') > ordre.indexOf('frappe:fin') && ordre.indexOf('frappe:fin') > 0
      || (console.log('        ordre :', ordre.join(' → ')), false));

    /* Ce qui ne s'annonce pas : une compétition non couverte, un but déjà
       frappé, une frappe sans receveur, une frappe qui lève. */
    const base = { fixtureId: 5002, seq: 2, leagueId: 207, teamId: 85, minute: 80,
      player: 'Kabashi', score: [2, 0], home: { id: 85 }, away: { id: 91 } };
    const muets = [
      ['une compétition non couverte', async () => ({ minted: false, reason: 'league_not_eligible' })],
      ['un but déjà frappé', async () => ({ minted: false, reason: 'already_minted' })],
      ['une carte que personne n’a reçue', async () => ({ minted: true, souvenirId: 89, presents: 0, userIds: [] })],
      ['une frappe qui lève', async () => { throw new Error('base injoignable'); }],
    ];
    for (const [quoi, f] of muets) {
      annonces.length = 0;
      frappe = f;
      await onGoal(base);
      check(`${quoi} n’annonce rien`, annonces.length === 0);
    }
    check('et la corde est secouée à chaque but, frappe ou pas',
      ordre.filter((x) => x === 'corde').length === 1 + muets.length);
    const inattendues = erreurs.filter((e) => !/base injoignable/.test(e));
    check('sans aucune erreur dans le journal, hors la frappe qui lève',
      inattendues.length === 0 || (console.log('        journal :', inattendues.join(' | ')), false));

    /* **Le vrai module des souvenirs**, sur un faux pool qui répond comme la
       base : c'est lui qui doit rendre `userIds`. Le nom est le point de
       contact entre deux périmètres — `serveur-virage` l'écrit, `server.js`
       le lit —, et un nom qui diffère d'une lettre ne lève rien : la carte
       n'est simplement plus annoncée. Rouge tant que `serveur-virage`
       (partie B) ne l'a pas posé. */
    const { createSouvenirs } = await import('../src/server/souvenirs/index.js');
    const poolSouvenirs = {
      execute: async (sql) => {
        if (/FROM souvenir_leagues/.test(sql)) return [[{ family: 'club' }]];
        if (/INSERT IGNORE INTO souvenirs/.test(sql)) return [{ affectedRows: 1, insertId: 90 }];
        if (/FROM virage_presence/.test(sql)) {
          return [[{ user_id: 'u-chante', fanzzy_id: null, ferveur: 12, side: 0 }]];
        }
        return [[]];
      },
      query: async () => [{ affectedRows: 1 }],
    };
    const vrais = createSouvenirs({ pool: poolSouvenirs, requireAuth: (_r, _s, nx) => nx() });
    annonces.length = 0;
    const avecLesVrais = fabriquer(virage, vrais, nvn, journal);
    await avecLesVrais({ ...base, seq: 3 });
    check('la vraie frappe rend ses receveurs, et l’annonce part (serveur-virage)',
      annonces.length === 1 && JSON.stringify(annonces[0]?.carte?.userIds) === '["u-chante"]'
      || (console.log('        annonces :', JSON.stringify(annonces)), false));

    /* **Un but que la salle tait ne part nulle part** (`CONTRATS.md`,
       § 16.6 : la frappe ne part que pour un but frais).

       La salle du Virage tait deux buts que le relevé croit frais : celui
       qui était au tableau à son ouverture, livré en retard, et celui
       qu'elle a déjà annoncé, revenu buteur corrigé. `server.js` ne lisait
       pas sa réponse : la carte du vieux but se frappait pour ceux qui
       chantaient dans les deux dernières minutes, `virage:souvenir` leur
       disait « TU Y ÉTAIS » sans « GOAL ! » à l'écran, et le duel recevait
       le but revenu une seconde fois. Sans salle, en revanche, rien n'est
       tu : le duel vit sans tribune ouverte, et la carte part comme avant.

       D'abord sur la façade, pour chaque cas ; puis sur la vraie salle, pour
       que la réponse que `server.js` lit soit celle que `realGoal` donne
       vraiment — un `true` devenu objet, une salle rangée sous une autre clé,
       et toutes les cartes se tairaient, ou aucune. */
    const tour = async (but) => {
      ordre.length = 0; annonces.length = 0; duels.length = 0;
      await onGoal(but);
      return { corde: ordre.includes('corde'), frappe: ordre.includes('frappe:début'),
        annonce: annonces.length > 0, duel: duels.length > 0 };
    };
    const dire = (r) => `corde ${r.corde} · frappe ${r.frappe} · annonce ${r.annonce} · duel ${r.duel}`;
    frappe = async () => ({ minted: true, souvenirId: 91, presents: 1, userIds: ['u-chante'] });
    const butTu = { ...base, seq: 4, minute: 23, score: [1, 0] };

    virage.rooms.set(5002, {});
    reponseCorde = () => false;
    let r = await tour(butTu);
    check('un but que la salle tait n’appelle pas mintGoal, et rien n’est annoncé',
      r.corde && !r.frappe && !r.annonce || (console.log(`        ${dire(r)}`), false));
    check('et il ne passe pas au duel', r.corde && !r.duel || (console.log(`        ${dire(r)}`), false));

    /* Le refus peut changer de forme — une raison au lieu de `false`, comme
       la revue l'a proposé : une salle ouverte qui ne rend pas `true` a tu
       le but, quelle que soit la façon de le dire. */
    reponseCorde = () => 'ancien';
    r = await tour(butTu);
    check('tu sous une raison (« ancien ») au lieu de false, pareil : ni frappe, ni duel',
      r.corde && !r.frappe && !r.annonce && !r.duel || (console.log(`        ${dire(r)}`), false));

    virage.rooms.clear();
    reponseCorde = () => false;
    r = await tour(butTu);
    check('sans salle, le but part comme avant : la carte, son annonce et le duel',
      r.corde && r.frappe && r.annonce && r.duel || (console.log(`        ${dire(r)}`), false));

    virage.rooms.set(5002, {});
    reponseCorde = () => { throw new Error('corde cassée'); };
    erreurs.length = 0;
    r = await tour(butTu);
    check('une corde qui lève ne coûte ni la carte ni le duel, et le journal le dit',
      r.frappe && r.annonce && r.duel && erreurs.some((e) => /corde cassée/.test(e))
      || (console.log(`        ${dire(r)} · journal :`, erreurs.join(' | ') || '(rien)'), false));
    virage.rooms.clear();
    reponseCorde = () => true;

    /* **La vraie salle**, ouverte par le vrai Virage à la 34ᵉ d'un 1–0, sur
       un faux pool qui répond comme la base. L'annonce passe par la vraie
       `souvenirFrappe`, qu'on regarde passer. */
    const { createVirage } = await import('../src/server/ferveur/index.js');
    const ioCable = {
      on() {}, use() {},
      to() { return { emit() {} }; },
      in() { return { emit() {}, fetchSockets: async () => [] }; },
    };
    const poolSalle = {
      execute: async (sql) => {
        if (/FROM fixtures f/.test(sql) && /WHERE f\.id = \?/.test(sql)) {
          return [[{ id: 5004, league_id: 207, home_id: 85, away_id: 91,
            kickoff_at: new Date(Date.now() - 50 * 60_000), status_short: '2H',
            home_goals: 1, away_goals: 0, elapsed: 34, elapsed_extra: null,
            luA: Date.now(), home_name: 'Sion', home_logo: null, home_c1: null, home_c2: null,
            away_name: 'Bâle', away_logo: null, away_c1: null, away_c2: null,
            league_name: 'Super League' }]];
        }
        return [[]];
      },
      query: async () => [[]],
    };
    const vSalle = createVirage({ pool: poolSalle, io: ioCable, requireAuth: (_r, _s, nx) => nx(),
      souvenirs: {}, fanzzy: {} });
    try {
      const salle = await vSalle.roomFor(5004);
      check('le vrai Virage ouvre la salle d’un match en cours (serveur-virage)',
        Boolean(salle) && vSalle.rooms?.has(5004));
      const vueSalle = { ...vSalle, souvenirFrappe: (fixtureId, carte) => {
        annonces.push({ fixtureId, carte });
        return vSalle.souvenirFrappe(fixtureId, carte);
      } };
      const surLaSalle = fabriquer(vueSalle, souvenirs, nvn, journal);
      const surVraie = async (but) => {
        ordre.length = 0; annonces.length = 0; duels.length = 0;
        const avant = salle?.realGoals?.join('-');
        await surLaSalle({ fixtureId: 5004, leagueId: 207, home: { id: 85 }, away: { id: 91 },
          teamId: 85, ...but });
        return { corde: salle?.realGoals?.join('-') !== avant, frappe: ordre.includes('frappe:début'),
          annonce: annonces.length > 0, duel: duels.length > 0 };
      };
      r = await surVraie({ seq: 1, minute: 23, player: 'Kabashi', score: [1, 0] });
      check('le but de la 23ᵉ, au tableau à l’ouverture : la vraie salle le tait, rien ne part',
        !r.corde && !r.frappe && !r.annonce && !r.duel || (console.log(`        ${dire(r)}`), false));
      r = await surVraie({ seq: 2, minute: 40, player: 'Kabashi', score: [2, 0] });
      check('le but frais de la 40ᵉ : la carte, son annonce et le duel partent',
        r.corde && r.frappe && r.annonce && r.duel || (console.log(`        ${dire(r)}`), false));
      r = await surVraie({ seq: 2, minute: 40, player: 'M. Kabashi', score: [2, 0] });
      check('le même, revenu buteur corrigé : ni seconde frappe, ni second souffle au duel',
        !r.corde && !r.frappe && !r.annonce && !r.duel || (console.log(`        ${dire(r)}`), false));
    } catch (e) {
      check('la vraie salle tait le but ancien (serveur-virage)', false);
      console.log('        levé :', e.message);
    } finally {
      vSalle.stop?.();
    }
  }
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
