/**
 * Ce que la réconciliation du catalogue ferait au prochain démarrage, sans
 * rien écrire.
 *
 * ## Pourquoi ce script existe
 *
 * `npm run ecarts` dit **quelles** cartes diffèrent du code. Il ne dit pas
 * **qui** a raison : un cri réécrit dans le code et une correction faite à
 * l'écran ont exactement la même apparence. La réconciliation, elle, le sait
 * (la colonne `amorce` et le journal de l'administration), mais elle ne parle
 * qu'au démarrage, et au-delà de soixante cartes elle s'arrête sans rien dire
 * de plus qu'un nombre. On ne relève pas un disjoncteur sur un nombre.
 *
 * Ce script lit le même plan, par la même fonction que le démarrage, et le
 * montre en entier : ce qui serait repris du code, ce que l'écran a corrigé et
 * qui resterait tel quel, ce qui est hors de portée.
 *
 * Il ne touche à rien.
 *
 * Usage, sur le serveur :
 *   npm run reconciliation:voir           (lit DATABASE_URL dans .env)
 *   npm run reconciliation:voir -- --tout (chaque carte, pas un aperçu)
 */
import { colonneAmorce, planifierReconciliation } from '../src/server/fanzzy/catalogue.js';
import { MAX_DEFAUT } from '../src/server/fanzzy/reconciliation.js';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL manquant. Sur le serveur : npm run reconciliation:voir');
  process.exit(1);
}
const tout = process.argv.includes('--tout');

const mysql = await import('mysql2/promise');
const pool = mysql.createPool({ uri: url, connectionLimit: 2 });

if (!(await colonneAmorce(pool))) {
  console.log('La colonne `amorce` manque : la réconciliation est éteinte.'
    + ' Applique sql/fanzzy.sql (npm run schema:appliquer).');
  await pool.end();
  process.exit(0);
}

const plan = await planifierReconciliation(pool, { max: Infinity });
await pool.end();

const max = Number(process.env.TBF_RECONCILIATION_MAX) || MAX_DEFAUT;
const titre = (t) => console.log(`\n${t}\n${'─'.repeat(t.length)}`);
const court = (v) => {
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s == null ? '—' : (s.length > 60 ? `${s.slice(0, 57)}…` : s);
};
const parChamp = (liste) => {
  const n = {};
  for (const c of liste) for (const x of c.champs) n[x.champ] = (n[x.champ] ?? 0) + 1;
  return Object.entries(n).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ')
    || 'aucun';
};
const lister = (liste, ligne) => {
  const vus = tout ? liste : liste.slice(0, 40);
  for (const c of vus) console.log(ligne(c));
  if (vus.length < liste.length) {
    console.log(`  … et ${liste.length - vus.length} autre(s) (ajoute -- --tout pour tout voir)`);
  }
};

titre('En résumé');
console.log(`  reprises du code        ${plan.reprises.length}   ← personne n’y a touché à l’écran : le code fait foi`);
console.log(`  corrigées à l’écran     ${plan.conflits.length}   ← la base garde sa version, rien n’est écrasé`);
console.log(`  hors de portée          ${plan.protegees.length}   ← cartes d’avant la réconciliation, touchées à l’écran`);
console.log(`  prises en charge        ${plan.adoptions.length}   ← référence posée, aucune donnée ne bouge`);
console.log(`  disjoncteur             ${max}   (TBF_RECONCILIATION_MAX)`);
console.log(plan.reprises.length > max
  ? `\n  Au prochain démarrage : RIEN n’est écrit, ${plan.reprises.length} reprises dépassent ${max}.`
  : `\n  Au prochain démarrage : ${plan.reprises.length} carte(s) reprise(s) du code.`);

titre(`Reprises du code (${parChamp(plan.reprises)})`);
if (!plan.reprises.length) console.log('  aucune.');
lister(plan.reprises, (c) => `  ${c.id.padEnd(7)} ${String(c.nom).padEnd(30)} ${c.champs.map((x) => x.champ).join(', ')}`);

titre(`Corrigées à l’écran, gardées telles quelles (${parChamp(plan.conflits)})`);
if (!plan.conflits.length) console.log('  aucune.');
lister(plan.conflits, (c) => [
  `  ${c.id.padEnd(7)} ${c.nom}`,
  ...c.champs.map((x) => `            ${x.champ} : écran ${court(x.base)}  /  code ${court(x.code)}`),
].join('\n'));

if (plan.protegees.length) {
  titre('Hors de portée');
  console.log(`  ${plan.protegees.join(' ')}`);
}
console.log('');
