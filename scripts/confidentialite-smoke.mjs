/**
 * La politique de confidentialité : publiée, complète, et d'accord avec le code.
 *
 * ## Pourquoi ce contrôle
 *
 * Une politique de confidentialité est une promesse écrite à des gens qui ne
 * liront jamais le code. Elle se met à mentir le jour où une durée change dans
 * un module sans changer sur la page — et rien ne rougit : la page s'affiche,
 * le jeu tourne. Ce contrôle relit donc chaque nombre qu'elle annonce **dans le
 * code qui le tient**, et rougit quand les deux divergent. Celui qui change une
 * durée apprend ici qu'il a une phrase à réécrire.
 *
 * Il vérifie aussi qu'elle est **publiée** : servie à `/confidentialite` par le
 * vrai serveur, sans base — on doit pouvoir la lire le jour où le reste du jeu
 * tombe —, et appelée depuis la vitrine et la porte de connexion. Une politique
 * que rien n'appelle n'informe personne.
 *
 * Sans base et sans navigateur : il lit des fichiers et démarre `server.js`.
 *
 * Usage : node scripts/confidentialite-smoke.mjs
 */
import { spawn } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { SESSION_TTL_MS } from '../src/server/auth/store.js';
import { COOKIE } from '../src/server/auth/routes.js';
import { PAR_CLE } from '../src/shared/reglages.js';
import { estLaNuit } from '../src/server/notifications/index.js';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const lire = (f) => readFileSync(path.join(RACINE, f), 'utf8');

let fautes = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) fautes += 1; };
const dors = (ms) => new Promise((r) => { setTimeout(r, ms); });

const html = lire('public/confidentialite.html');
/* Le texte que lit un joueur : sans le style, les scripts, les commentaires ni
   les balises, et les blancs ramenés à un seul — une phrase coupée en deux
   lignes dans la source reste une phrase. */
const texte = html
  .replace(/<style[\s\S]*?<\/style>/g, ' ')
  .replace(/<script[\s\S]*?<\/script>/g, ' ')
  .replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ')
  .replace(/\s+/g, ' ');
const dit = (bout) => texte.includes(bout);

/* ------------------------------------------------------------ l'éditeur */

console.log('\nQui parle\n');
check('elle nomme l’éditeur', dit('Gaël Manigley'));
check('avec sa forme juridique', dit('entreprise individuelle'));
check('et son adresse', dit('1085 Vulliens') && dit('Suisse'));
check('elle donne une adresse où écrire, en lien',
  /href="mailto:info@thebestfan\.online"/.test(html));
check('elle est datée', /Dernière mise à jour : \d{1,2}(er)? [a-zéû]+ 20\d\d/.test(texte));

/* Ce qui trahit un brouillon : un crochet laissé à compléter, une note à
   l'équipe. Le brouillon de travail (`CONFIDENTIALITE.md`) en portait onze. */
const brouillon = texte.match(/\[[^\]]*\]|à fixer|à confirmer|à faire relire|à trancher|juriste/gi) ?? [];
check('aucune marque de brouillon', brouillon.length === 0);
if (brouillon.length) console.log('        restent :', brouillon.join(' · '));

/* ---------------------------------------------- les durées, lues dans le code */

console.log('\nCe qu’elle promet, et ce que le code tient\n');

check('les sessions : trente jours sans visite, comme SESSION_TTL_MS',
  SESSION_TTL_MS === 30 * 24 * 3600 * 1000 && dit('ou trente jours sans visite'));

/* Les tentatives manquées : effacées au-delà d'un jour, par un entretien qui
   passe au démarrage puis toutes les vingt-quatre heures. Un jour d'âge, plus
   au plus un jour d'attente : « deux jours au plus ». Sans le passage au
   démarrage, un serveur relancé chaque jour ne purgerait jamais. */
const store = lire('src/server/auth/store.js');
const serveur = lire('server.js');
check('les tentatives manquées sont effacées au-delà d’un jour',
  /DELETE FROM login_attempts WHERE at < \(NOW\(3\) - INTERVAL 1 DAY\)/.test(store));
check('par un entretien qui passe au démarrage, puis chaque jour',
  /const entretien = \(\) => auth\.store\.cleanup\(\)[^;]*;\s*entretien\(\);\s*setInterval\(entretien, 24 \* 60 \* 60 \* 1000\)/
    .test(serveur));
check('d’où « deux jours au plus » sur la page', dit('deux jours au plus'));

const derby = lire('src/server/nvn/index.js').match(/const DERBY_FRAIS_MS = (\d+) \* 60_000;/);
check('la marque du derby : quatre minutes, comme DERBY_FRAIS_MS',
  Number(derby?.[1]) === 4 && dit('quatre minutes'));
if (Number(derby?.[1]) !== 4) console.log('        le code dit :', derby?.[0] ?? 'introuvable');

const enLigne = PAR_CLE.get('presence.en_ligne_sec');
check('la présence : deux minutes par défaut, quinze au plus, comme son réglage',
  enLigne?.defaut === 120 && enLigne?.max === 900 && dit('deux par défaut, jamais plus de quinze'));
check('visible de ses amis par défaut, comme son réglage',
  PAR_CLE.get('presence.visible_defaut')?.defaut === true
    && dit('par défaut tu es visible de tes amis'));

const quotidien = lire('src/server/quotidien/index.js');
check('l’activité du jour et les missions : 400 jours',
  (quotidien.match(/jour < CURDATE\(\) - INTERVAL 400 DAY/g) ?? []).length === 2
    && dit('400 jours'));
check('ce qui n’a pas été regardé : 60 jours',
  /DELETE FROM user_nouveautes WHERE user_id = \? AND got_at < NOW\(3\) - INTERVAL 60 DAY/
    .test(lire('src/server/fanzzy/index.js')) && dit('60 jours'));

/* Le 7 octobre 2026, Zurich est à UTC+2. */
const zurich = (h, m = 0) => new Date(Date.UTC(2026, 9, 7, h - 2, m));
check('les notifications se taisent de 22 h à 8 h, heure de Zurich',
  estLaNuit(zurich(22)) && estLaNuit(zurich(7, 59))
    && !estLaNuit(zurich(21, 59)) && !estLaNuit(zurich(8))
    && dit('de 22 h à 8 h (heure de Zurich)'));

/* Un seul cookie : aucun `res.cookie(` du serveur ne pose autre chose que
   celui de la session. */
const fichiers = ['server.js', ...readdirSync(path.join(RACINE, 'src/server'), { recursive: true })
  .filter((f) => f.endsWith('.js')).map((f) => path.join('src/server', f))];
const poses = fichiers.flatMap((f) => [...lire(f).matchAll(/res\.cookie\(\s*([^,]+),/g)]
  .map((m) => `${f} : ${m[1].trim()}`));
const autres = poses.filter((p) => !/: COOKIE$/.test(p));
check(`un seul cookie, ${COOKIE}, comme la page le dit`,
  COOKIE === 'tbf_session' && poses.length > 0 && autres.length === 0
    && dit('Un seul, tbf_session'));
if (autres.length) console.log('        ailleurs :', autres.join(' · '));

/* --------------------------------------------------------- la publication */

console.log('\nPubliée, et appelée\n');

check('la barre du haut la nomme',
  /'\/confidentialite': 'Confidentialité'/.test(lire('public/menu.js')));
const porte = lire('public/compte.html');
check('le lien de la porte se lit dans ses quatre langues',
  (porte.match(/'account\.privacy':'[^']+'/g) ?? []).length === 4);

const PORT = 3983;
const base = `http://127.0.0.1:${PORT}`;
/* `DATABASE_URL` vidée exprès : la page doit se servir sans base, et la
   machine qui lance ceci peut en avoir une dans son environnement. */
const proc = spawn(process.execPath, ['server.js'], {
  cwd: RACINE,
  env: { ...process.env, PORT: String(PORT), DATABASE_URL: '' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let journal = '';
proc.stdout.on('data', (d) => { journal += d; });
proc.stderr.on('data', (d) => { journal += d; });

/** On attend qu'elle réponde, plutôt que de dormir un temps deviné. */
async function servie() {
  for (let i = 0; i < 80; i += 1) {
    try {
      const r = await fetch(`${base}/confidentialite`);
      if (r.status === 200) return r;
    } catch { /* pas encore là */ }
    await dors(250);
  }
  return null;
}

try {
  const r = await servie();
  check('le serveur la sert à /confidentialite, même sans base', r?.status === 200);
  if (!r) console.log(journal.split('\n').slice(-12).map((l) => `        ${l}`).join('\n'));
  check('jamais gardée en cache, comme les autres pages',
    r?.headers.get('cache-control') === 'no-store');
  check('et c’est bien elle', (r ? await r.text() : '').includes('Gaël Manigley'));

  const accueil = r ? await (await fetch(`${base}/`)).text() : '';
  check('la vitrine y mène', accueil.includes('href="/confidentialite"'));
  const compte = r ? await (await fetch(`${base}/compte`)).text() : '';
  check('la porte de connexion et « Mon compte » aussi',
    (compte.match(/href="\/confidentialite"/g) ?? []).length === 2);
} finally {
  proc.kill();
}

console.log(`\n${fautes ? `${fautes} échec(s)` : 'tout est vert'}`);
process.exit(fautes ? 1 : 0);
