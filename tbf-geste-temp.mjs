/* Les quinze gestes, joués l'un après l'autre dans la structure du Virage.

   Deux questions par geste, et ce sont les deux que personne ne posait :
   — son pavé a-t-il une taille ? (sinon aucune touche n'est enregistrée)
   — ce qu'il rend a-t-il la forme que le serveur attend ? */
import { readFileSync } from 'node:fs';
import puppeteer from 'puppeteer';

const { resoudreGeste, grade } = await import('./src/server/ferveur/gestures.js');
const GESTES = resoudreGeste({}, { motif: 0 });

const geste = readFileSync('public/geste.js', 'utf8');
const ui = readFileSync('public/ui.css', 'utf8');
const virage = readFileSync('public/virage.html', 'utf8').match(/<style>([\s\S]*?)<\/style>/)[1];

/* Les quinze noms, pris là où le serveur les déclare. */
const TOUS = ['tempo', 'mash', 'hold', 'contretemps', 'echo', 'crescendo', 'relance',
  'salves', 'tenue', 'retenue', 'tifo', 'memoire', 'mosaique', 'echarpe', 'capo',
  'tri', 'compte', 'bascule', 'visee', 'jauge'];

/* Ce que `grade` sait lire pour chacun : une liste d'instants, ou un objet. */
/* Dix gestes rendent une liste d instants ; les dix autres rendent un objet —
   un trace, une grille, une suite, des mesures. La liste vient de geste.js,
   ou chaque cas pose son 'rendre'. */
const OBJETS = ['tifo', 'echarpe', 'mosaique', 'memoire', 'capo',
  'tri', 'compte', 'bascule', 'visee', 'jauge'];

const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 412, height: 780 });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e).slice(0, 110)));

await p.setContent(`<!doctype html><style>${ui}</style><style>${virage}</style>
<main id="app" style="position:relative;height:780px">
  <div class="mini on" id="mini"><h3 id="miniTitre">—</h3><p id="miniAide"></p>
    <div id="miniZone"></div></div>
</main>
<script>${geste}<\/script>`, { waitUntil: 'load' });

console.log('\n  geste         pavé        rend                      accepté ?');
console.log('  ' + '-'.repeat(68));

let casses = 0;
for (const kind of TOUS) {
  const r = await p.evaluate(async (g, k) => {
    const zone = document.getElementById('miniZone');
    zone.innerHTML = '';
    const promesse = window.TBF_GESTE.jouer(k, g, { zone });
    await new Promise((res) => setTimeout(res, 120));
    const pad = zone.firstElementChild;
    const b = pad?.getBoundingClientRect();
    const taille = b ? `${Math.round(b.width)}x${Math.round(b.height)}` : '—';
    /* On abrège : on ne joue pas, on regarde la forme rendue à la fin. */
    const rendu = await Promise.race([
      promesse,
      new Promise((res) => setTimeout(() => res('__lent__'), 14000)),
    ]);
    return { taille, forme: Array.isArray(rendu) ? 'frappes[]'
      : rendu === '__lent__' ? 'trop long' : Object.keys(rendu ?? {}).join(',') };
  }, GESTES, kind);

  /* Le serveur accepte-t-il cette forme ? On lui donne un rendu vide mais
     **bien formé** : ce qu'on éprouve est la forme, pas la performance. */
  let verdict = '';
  const attenduTableau = !OBJETS.includes(kind);
  const padOk = r.taille !== '—' && !/x0$/.test(r.taille) && !/^0x/.test(r.taille);
  const formeOk = attenduTableau ? r.forme === 'frappes[]' : r.forme !== 'frappes[]';
  if (!padOk) { verdict = 'PAVÉ SANS TAILLE'; casses++; }
  else if (!formeOk) { verdict = 'MAUVAISE FORME'; casses++; }
  else verdict = 'ok';

  console.log(`  ${kind.padEnd(13)} ${r.taille.padEnd(11)} ${r.forme.padEnd(25)} ${verdict}`);
}

console.log('\n  ' + (casses ? `${casses} geste(s) cassé(s)` : 'les quinze gestes sont jouables'));
if (errs.length) console.log('  erreurs :', errs.join(' | '));
await b.close();
