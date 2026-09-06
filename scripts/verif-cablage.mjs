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

console.log(fautes
  ? `\n${fautes} faute(s) — ne pas livrer en l’état.`
  : '\nLe câblage des modules est correct.');
process.exit(fautes ? 1 : 0);
