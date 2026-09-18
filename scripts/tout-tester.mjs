/**
 * Lance toutes les suites, en série, et rend un tableau.
 *
 * ## Pourquoi ce script existe
 *
 * Il y a une cinquantaine de suites et il fallait les connaître. Pour savoir si
 * le dépôt est sain, on en lançait sept ou huit — celles auxquelles on pensait —
 * et on concluait. Les autres restaient rouges pendant des semaines sans que
 * personne le sache : `prefixes:smoke` et `vitrine:smoke` l'ont été, et c'est un
 * contrôle général qui les a trouvées, pas une intuition.
 *
 * ## En série, et c'est une contrainte, pas un choix
 *
 * Les suites partagent une seule base et chacune la vide au démarrage : deux en
 * même temps se détruisent mutuellement. Un verrou les en empêche désormais
 * (voir `base-de-test.mjs`), mais l'empêcher n'est pas les paralléliser — c'est
 * la même raison qui interdit les deux.
 *
 * L'isolation par base rendrait le parallélisme possible et diviserait ce temps
 * par quatre ou cinq. Elle demande un droit que le compte `tbf` n'a pas :
 *
 *     GRANT ALL PRIVILEGES ON `tbf_%`.* TO 'tbf'@'%';
 *
 * ## Il ne s'arrête pas au premier rouge
 *
 * Une suite qui échoue n'arrête pas les autres. Savoir qu'il y a **une** faute
 * ou **onze** change ce qu'on fait ensuite, et un `&&` en chaîne ne le dit
 * jamais : il s'arrête à la première et laisse croire que le reste va bien.
 *
 * Usage :
 *   npm test                    tout
 *   npm test -- --rapide        sans les suites de navigateur (les plus lentes)
 *   npm test -- virage deck     seulement celles dont le nom contient ça
 */
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const rapide = args.includes('--rapide');
const filtres = args.filter((a) => !a.startsWith('--'));

const scripts = JSON.parse(
  readFileSync(path.join(RACINE, 'package.json'), 'utf8')).scripts;

/* Les suites, telles que `package.json` les déclare. On les lit plutôt que de
   les énumérer : une suite ajoutée sans être inscrite ici ne serait jamais
   lancée, et son absence ne se verrait nulle part — exactement le défaut que ce
   script corrige. */
const TOUTES = Object.keys(scripts)
  .filter((n) => /:smoke$|:test$|:ui$/.test(n))
  .filter((n) => n !== 'images:test' || true);

/* Les suites de navigateur sont les plus lentes — puppeteer démarre un Chrome
   par suite. `--rapide` les écarte pour le tour qu'on fait dix fois par heure ;
   le tour complet, lui, ne s'en passe pas. */
const LENTES = /:ui$/;

const choisies = TOUTES
  .filter((n) => !(rapide && LENTES.test(n)))
  .filter((n) => !filtres.length || filtres.some((f) => n.includes(f)));

if (!choisies.length) {
  console.error(`Aucune suite ne correspond à « ${filtres.join(' ')} ».`);
  console.error(`Il y en a ${TOUTES.length} : ${TOUTES.join(', ')}`);
  process.exit(1);
}

const lancer = (nom) => new Promise((resoudre) => {
  const t0 = Date.now();
  const p = spawn('npm', ['run', nom], {
    cwd: RACINE, shell: true,
    env: { ...process.env, FORCE_COLOR: '0' },
  });
  let sortie = '';
  p.stdout.on('data', (d) => { sortie += d; });
  p.stderr.on('data', (d) => { sortie += d; });
  p.on('close', (code) => {
    const fails = (sortie.match(/^ FAIL /gm) ?? []).length;
    const oks = (sortie.match(/^ {2}ok {3}/gm) ?? []).length;
    const vert = /tout est vert|se garnit|Toutes les pages/.test(sortie);
    resoudre({
      nom, code, fails, oks, vert, sortie,
      secondes: Math.round((Date.now() - t0) / 1000),
    });
  });
});

console.log(`\n${choisies.length} suite(s), en série.`
  + (rapide ? ' (sans les suites de navigateur)' : '') + '\n');

const resultats = [];
for (const nom of choisies) {
  process.stdout.write(`  ${nom.padEnd(20)} `);
  const r = await lancer(nom);
  resultats.push(r);
  /* Le verdict est **le code de sortie d'abord**. Une suite qui plante avant son
     premier contrôle n'écrit ni « FAIL » ni « tout est vert » : la juger sur son
     texte la déclarerait verte parce qu'elle n'a rien dit. C'est exactement
     comme ça que `prefixes:smoke` est resté cassé. */
  const bon = r.code === 0 && r.fails === 0;
  console.log(bon
    ? `ok   ${String(r.oks).padStart(4)} contrôles · ${r.secondes}s`
    : `ÉCHEC ${r.fails ? `${r.fails} rouge(s)` : `sortie ${r.code}`} · ${r.secondes}s`);
}

/* ------------------------------------------------------------- le résumé */

const rates = resultats.filter((r) => r.code !== 0 || r.fails > 0);
const total = resultats.reduce((n, r) => n + r.oks, 0);
const temps = resultats.reduce((n, r) => n + r.secondes, 0);

console.log(`\n  ${total} contrôles en ${Math.floor(temps / 60)} min ${temps % 60} s\n`);

if (!rates.length) {
  console.log('  tout est vert\n');
  process.exit(0);
}

/* Le détail des seules suites en échec, et **seulement leurs lignes rouges**.
   Recracher la sortie entière de onze suites ferait deux mille lignes dans
   lesquelles les vingt qui comptent se perdraient. */
console.log(`  ${rates.length} suite(s) en échec :\n`);
for (const r of rates) {
  console.log(`  ── ${r.nom}`);
  const lignes = r.sortie.split('\n');
  /* La ligne rouge **et ce qui la suit**. Une suite qui échoue dit souvent
     juste après ce qu'elle a lu et ce qu'elle attendait, sur une ligne plus
     indentée. Ne remonter que le FAIL, c'était garder l'accusation et jeter
     la preuve : on relançait la suite seule pour la voir, et seule elle
     passait. */
  const rouges = [];
  lignes.forEach((l, i) => {
    if (!/^ FAIL /.test(l)) return;
    rouges.push(l);
    for (let j = i + 1; j < lignes.length && /^ {8}\S/.test(lignes[j]); j += 1) {
      rouges.push(lignes[j]);
    }
  });
  if (rouges.length) {
    for (const l of rouges.slice(0, 16)) console.log(`     ${l.trim()}`);
    if (rouges.length > 16) console.log(`     … et ${rouges.length - 16} de plus`);
  } else {
    /* Pas une ligne rouge : la suite a planté. Les dernières lignes portent
       alors la trace, et c'est tout ce qu'on a. */
    console.log('     (aucun contrôle rouge — la suite s’est arrêtée)');
    for (const l of lignes.filter(Boolean).slice(-6)) console.log(`     ${l.trim()}`);
  }
  console.log(`     → npm run ${r.nom}\n`);
}
process.exit(1);
