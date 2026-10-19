/**
 * Les mentions légales et les conditions d'utilisation et de vente : publiées,
 * appelées, et d'accord avec le code.
 *
 * ## Pourquoi ce contrôle
 *
 * Le jeu encaisse de vrais paiements depuis le 9 octobre 2026. Un site qui vend
 * doit dire qui il est et sous quelles conditions — et ces deux pages n'étaient
 * que des projets (`MENTIONS-LEGALES.md`, `CGV.md`) jusqu'au 19 octobre. Ce
 * contrôle vérifie qu'elles le restent : **servies** par le vrai serveur sans
 * base, **appelées** là où l'on s'inscrit et là où l'on paie, **d'accord** avec
 * la politique de confidentialité sur l'éditeur, et **d'accord avec le code**
 * sur les prix — le seul nombre qu'elles recopient, parce qu'il ne se règle pas
 * depuis l'administration.
 *
 * Sans base et sans navigateur : il lit des fichiers et démarre `server.js`.
 *
 * Usage : node scripts/legal-smoke.mjs
 */
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { CATALOGUE } from '../src/shared/boutique.js';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const lire = (f) => readFileSync(path.join(RACINE, f), 'utf8');

let fautes = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) fautes += 1; };
const dors = (ms) => new Promise((r) => { setTimeout(r, ms); });

/** Le texte que lit un joueur, sans balises ni blancs doublés. */
const texteDe = (html) => html
  .replace(/<style[\s\S]*?<\/style>/g, ' ')
  .replace(/<script[\s\S]*?<\/script>/g, ' ')
  .replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ')
  .replace(/\s+/g, ' ');

const mentions = texteDe(lire('public/mentions-legales.html'));
const conditions = texteDe(lire('public/conditions.html'));
const confid = texteDe(lire('public/confidentialite.html'));

console.log('\nLes mentions légales\n');
check('elles nomment l’éditeur et sa forme', /Gaël Manigley ?, entreprise individuelle/.test(mentions));
check('avec son adresse complète', mentions.includes('Chemin les Jordils 2, 1085 Vulliens, Suisse'));
check('et son statut (registre, TVA)', mentions.includes('non inscrite au registre du commerce')
  && mentions.includes('non assujettie à la TVA'));
check('une adresse où écrire', mentions.includes('info@thebestfan.online'));
check('l’hébergeur', mentions.includes('Infomaniak Network SA'));
check('elles sont datées', /Dernière mise à jour : \d{1,2}(er)? [a-zéû]+ 20\d\d/.test(mentions));
check('la confidentialité dit le même éditeur',
  confid.includes('Gaël Manigley') && confid.includes('1085 Vulliens'));
check('il ne reste aucun crochet de projet',
  !/\[[^\]]*\]/.test(mentions) && !/\[[^\]]*\]/.test(conditions));

console.log('\nLes conditions\n');
check('elles sont datées', /Dernière mise à jour : \d{1,2}(er)? [a-zéû]+ 20\d\d/.test(conditions));
/* Les prix : le seul nombre recopié, lu dans le catalogue qui fait foi. */
const euros = (centimes) => `${Math.floor(centimes / 100)},${String(centimes % 100).padStart(2, '0')} €`;
for (const id of ['abo-mensuel', 'abo-annuel']) {
  const a = CATALOGUE.find((x) => x.id === id);
  check(`le prix de ${id} est celui du catalogue (${a ? euros(a.prix) : '?'})`,
    Boolean(a) && conditions.includes(euros(a.prix)));
}
check('elles disent comment résilier, et quand ça prend effet',
  conditions.includes('Résilier mon abonnement') && conditions.includes('à la fin de la période déjà payée'));
check('elles disent le remboursement des quatorze jours', conditions.includes('quatorze jours'));
check('elles disent l’accord d’un parent avant 18 ans', conditions.includes('moins de 18 ans'));
check('elles disent le droit applicable', conditions.includes('droit suisse'));

console.log('\nAppelées\n');
check('la barre du haut les nomme', /'\/mentions-legales': 'Mentions légales'/.test(lire('public/menu.js'))
  && /'\/conditions': 'Conditions'/.test(lire('public/menu.js')));
check('le pied du menu y mène, sur toutes les pages',
  /href="\/mentions-legales"/.test(lire('public/menu.js')) && /href="\/conditions"/.test(lire('public/menu.js')));
check('la page de l’abonnement montre les conditions avant de payer',
  /href="\/conditions"/.test(lire('public/abonnement.html')));
check('la boutique aussi', /href="\/conditions"/.test(lire('public/boutique.html')));
const porte = lire('public/compte.html');
check('la porte d’inscription y mène', /href="\/conditions"/.test(porte));
check('et son lien se lit dans ses quatre langues',
  (porte.match(/'account\.terms':'[^']+'/g) ?? []).length === 4);

const PORT = 3984;
const base = `http://127.0.0.1:${PORT}`;
const proc = spawn(process.execPath, ['server.js'], {
  cwd: RACINE,
  env: { ...process.env, PORT: String(PORT), DATABASE_URL: '' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let journal = '';
proc.stdout.on('data', (d) => { journal += d; });
proc.stderr.on('data', (d) => { journal += d; });

async function servie(chemin) {
  for (let i = 0; i < 80; i += 1) {
    try {
      const r = await fetch(`${base}${chemin}`);
      if (r.status === 200) return r;
    } catch { /* pas encore là */ }
    await dors(250);
  }
  return null;
}

try {
  const m = await servie('/mentions-legales');
  check('le serveur sert /mentions-legales, même sans base', m?.status === 200);
  if (!m) console.log(journal.split('\n').slice(-12).map((l) => `        ${l}`).join('\n'));
  check('et c’est bien elle', (m ? await m.text() : '').includes('Chemin les Jordils 2'));
  const c = await servie('/conditions');
  check('le serveur sert /conditions, même sans base', c?.status === 200);
  check('jamais gardée en cache', c?.headers.get('cache-control') === 'no-store');
  const accueil = m ? await (await fetch(`${base}/`)).text() : '';
  check('la vitrine y mène', accueil.includes('href="/mentions-legales"') && accueil.includes('href="/conditions"'));
  check('« PRENDRE MA PLACE » ouvre l’inscription', accueil.includes('href="/compte?inscription"'));
} finally {
  proc.kill();
}

console.log(`\n${fautes ? `${fautes} échec(s)` : 'tout est vert'}`);
process.exit(fautes ? 1 : 0);
