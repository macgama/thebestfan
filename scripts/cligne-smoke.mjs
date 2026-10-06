/**
 * Les paupières suivent le repos — test de la chaîne, sans base ni serveur.
 *
 * Des paupières (`scripts/fanzzy-cligne.mjs`) ne valent que pour l'image de
 * repos d'où elles ont été découpées. Or `fanzzy-art.mjs` récrit ce repos
 * chaque fois qu'on repasse un personnage : une tenue de plus agrandit le
 * cadre commun de l'âge, et tout le personnage glisse de quelques pixels. Ce
 * qu'on vérifie ici, sur RP1 et sa vraie retouche :
 *
 *   — **recadré**, le repos retrouve ses paupières, posées sur ses yeux ;
 *   — **republié à l'identique**, il les garde sans rien recalculer, et
 *     `rev` ne bouge pas ;
 *   — **redessiné** (un autre visage), il les perd, et la chaîne le dit
 *     plutôt que de publier des yeux fermés à côté des yeux.
 *
 * Tout s'écrit dans un dossier temporaire : `public/` n'est jamais touché.
 *
 * Usage : node scripts/cligne-smoke.mjs
 */
import { copyFile, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';
import { boiteDeLaTete } from './fanzzy-cligne.mjs';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const PUBLIC = path.join(RACINE, 'public', 'img', 'fanzzy');

let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };

const lancer = (src, sortie) => new Promise((ok) => {
  execFile(process.execPath, [path.join(RACINE, 'scripts', 'fanzzy-art.mjs'), src, '--sortie', sortie],
    { cwd: RACINE, maxBuffer: 1 << 22 },
    (err, stdout, stderr) => ok({ code: err ? err.code ?? 1 : 0, sortie: `${stdout}${stderr}` }));
});

/** La boîte des pixels non transparents d'une image, en fractions de `cadre`. */
async function ouSontLesPaupieres(fichier, cadre) {
  const { data, info } = await sharp(fichier).ensureAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    if (data[(y * info.width + x) * 4 + 3] < 64) continue;
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  if (x1 < 0) return null;
  const f = (v, o) => (v - o) / cadre.width;
  return { x0: f(x0, cadre.left), y0: f(y0, cadre.top), x1: f(x1, cadre.left), y1: f(y1, cadre.top) };
}

const TMP = await mkdtemp(path.join(tmpdir(), 'tbf-cligne-'));
try {
  const SRC = path.join(TMP, 'src');
  const SORTIE = path.join(TMP, 'public');
  await mkdir(SRC, { recursive: true });
  await mkdir(SORTIE, { recursive: true });

  /* Les sources : les cinq expressions publiées de RP1, tenue de base.
     Sans les trois autres tenues de l'âge 1, le cadre commun rétrécit et le
     personnage ressort plus grand — exactement le recadrage à rattraper. */
  const reel = JSON.parse(await readFile(path.join(PUBLIC, 'RP1', 'manifeste.json'), 'utf8'));
  const etats = reel.evolutions.e1.skins.base.etats;
  for (const e of etats) {
    await copyFile(path.join(PUBLIC, 'RP1', 'e1', 'base', `${e}.png`), path.join(SRC, `RP1-e1-base-${e}.png`));
  }

  // Où tombent les paupières publiées, rapportées à la tête du repos publié.
  const repere = await ouSontLesPaupieres(path.join(PUBLIC, 'RP1', 'e1', 'base', 'cligne.png'),
    await boiteDeLaTete(path.join(PUBLIC, 'RP1', 'e1', 'base', 'neutre.png')));
  check('les paupières publiées de RP1 sont dans le haut de sa tête',
    repere && repere.y0 > 0.25 && repere.y1 < 0.8 && repere.x0 > 0.1 && repere.x1 < 0.9);

  /* ------------------------------------------------------------ recadré */

  const dossier = path.join(SORTIE, 'RP1', 'e1', 'base');
  let r = await lancer(SRC, SORTIE);
  check('la chaîne passe', r.code === 0 || (console.log(r.sortie), false));
  let m = JSON.parse(await readFile(path.join(SORTIE, 'RP1', 'manifeste.json'), 'utf8'));
  check('recadré, le repos retrouve ses paupières', m.evolutions.e1.skins.base.cligne === true);
  check('et la chaîne le dit', /paupières reposées/.test(r.sortie));
  const index = JSON.parse(await readFile(path.join(SORTIE, 'index.json'), 'utf8'));
  check('l’index les annonce à la page', index.fanzzy.RP1.evolutions.e1.skins.base.cligne === true);

  const tete = await boiteDeLaTete(path.join(dossier, 'neutre.png'));
  const publie = await boiteDeLaTete(path.join(PUBLIC, 'RP1', 'e1', 'base', 'neutre.png'));
  check('le repos a bien été recadré (sinon ce test ne prouve rien)',
    Math.abs(tete.width - publie.width) > 10);
  const ici = await ouSontLesPaupieres(path.join(dossier, 'cligne.png'), tete);
  /* Rapportées à la tête, les paupières doivent tomber au même endroit à un
     pour cent près — trois pixels : c'est la preuve qu'elles ont suivi les
     yeux. Elles en étaient à 1,8 % tant que la boîte de la tête se laissait
     ramener dans l'image (voir `boiteDeLaTete`). */
  const ecart = ici && Math.max(...['x0', 'y0', 'x1', 'y1'].map((k) => Math.abs(ici[k] - repere[k])));
  check(`elles tombent sur ses yeux (écart ${ecart == null ? '—' : (100 * ecart).toFixed(1)} % de la tête)`,
    ecart != null && ecart < 0.01);

  /* -------------------------------------------------------- à l'identique */

  const avant = await readFile(path.join(dossier, 'cligne.png'));
  r = await lancer(SRC, SORTIE);
  const m2 = JSON.parse(await readFile(path.join(SORTIE, 'RP1', 'manifeste.json'), 'utf8'));
  check('republié à l’identique, il garde ses paupières sans les recalculer',
    m2.evolutions.e1.skins.base.cligne === true && /paupières gardées/.test(r.sortie));
  check('et `rev` ne bouge pas', m2.rev === m.rev);
  check('les paupières restent au même octet',
    (await readFile(path.join(dossier, 'cligne.png'))).equals(avant));

  /* ------------------------------------------------------------ redessiné */

  await copyFile(path.join(PUBLIC, 'RP2', 'e1', 'base', 'neutre.png'), path.join(SRC, 'RP1-e1-base-neutre.png'));
  r = await lancer(SRC, SORTIE);
  m = JSON.parse(await readFile(path.join(SORTIE, 'RP1', 'manifeste.json'), 'utf8'));
  check('redessiné, il perd ses paupières', m.evolutions.e1.skins.base.cligne === undefined);
  check('et la chaîne le dit', /paupières retirées/.test(r.sortie));
  check('sans faire échouer le reste du passage', r.code === 0);
} finally {
  await rm(TMP, { recursive: true, force: true });
}

console.log(`\n${failures ? `${failures} échec(s)` : 'tout est vert'}`);
process.exitCode = failures ? 1 : 0;
