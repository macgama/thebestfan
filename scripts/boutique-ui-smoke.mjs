/**
 * La cabine d'essayage de /boutique, dans un vrai navigateur.
 *
 * **Le défaut qu'elle garde.** Le bouton de la cabine menait au classeur
 * (`/fanzzy?ecran=dex&tenue=…`), qui ne savait rien de la tenue : on quittait
 * la boutique, et il n'y avait nulle part où l'acheter. La cabine dit
 * maintenant sur qui la tenue se pose, demande confirmation sur place, et
 * reste sur la page.
 *
 * Le serveur est un bouchon : l'achat lui-même (prix relu, possession, âge
 * atteint) est éprouvé par `boutique:smoke`. Ici, on regarde ce que la page
 * propose, ce qu'elle envoie, et qu'elle ne s'en va pas.
 *
 * Les dessins sont ceux du dépôt (`public/img/fanzzy/index.json`) : au
 * 6 octobre 2026, Préhistorique n'est dessinée que pour RP1 et RP2. Si elle
 * l'est un jour pour RP3, le contrôle « pas encore dessinée » le dira.
 */
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import puppeteer from 'puppeteer';

const RACINE = fileURLToPath(new URL('..', import.meta.url));

let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };
const dodo = (ms) => new Promise((r) => setTimeout(r, ms));
async function jusqua(fn, ms = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await fn()) return true; await dodo(60); }
  return false;
}

/* ------------------------------------------------------------ le bouchon */

const PRIX = 130;
let echarpes = 2009;
const posees = [];
const achats = [];
const avatars = [];

const etat = () => ({
  wallet: { scarves: echarpes, packs: 2, packs_at: null, active: 'RP1', activeStade: 2,
    avatar: { id: 'RP1', evo: 2, skin: 'base' }, plafond: 12, cadence: 40 },
  collection: { RP1: 1, RP2: 1, RP3: 2 },
  stades: { RP1: 2 },
  etats: {},
});
const dex = [
  ['RP1', 1, 'Gosier Rouillé'], ['RP1B', 2, 'Gosier Retrouvé'], ['RP1C', 3, 'Gosier d’Acier'],
  ['RP2', 1, 'Chant Oublié'], ['RP2B', 2, 'Chant Repris'], ['RP2C', 3, 'Chant du Virage'],
  ['RP3', 1, 'Peau Neuve'], ['RP3B', 2, 'Fût Rodé'], ['RP3C', 3, 'Tambour de la Reprise'],
].map(([id, stade, nom]) => ({ id, racine: id.slice(0, 3), stade, nom, rar: 'commune' }));

const app = express();
app.use(express.json());
app.get('/api/auth/me', (_q, s) => s.json({ user: { id: 'cabine', pseudo: 'Cabine', verified: true } }));
app.get('/api/fanzzy/state', (_q, s) => s.json(etat()));
app.get('/api/fanzzy/dex', (_q, s) => s.json({ dex, sets: [], types: {} }));
app.get('/api/boutique/catalogue', (_q, s) => s.json({ ouvert: false, articles: [] }));
app.get('/api/abonnement', (_q, s) => s.json({ abonne: false, formules: [] }));
app.get('/api/boutique/etal', (_q, s) => s.json({
  monnaie: 'echarpes', echarpes, stuff: [],
  tenues: [
    { type: 'tenue', id: 'prehistorique', nom: 'Préhistorique', rar: 'epique', prix: PRIX,
      texte: 'Le virage avant le virage.' },
    { type: 'tenue', id: 'halloween', nom: 'Halloween', rar: 'epique', prix: PRIX },
  ],
  posees,
}));
app.post('/api/boutique/depenser', (q, s) => {
  achats.push(q.body);
  echarpes -= PRIX;
  posees.push({ fanzzy: q.body.fanzzy, stade: q.body.stage, tenue: q.body.id });
  s.json({ ok: true, paye: PRIX, echarpes });
});
app.post('/api/onboarding/avatar', (q, s) => { avatars.push(q.body); s.json({ ok: true }); });
app.use('/api', (_q, s) => s.json({ ok: true, items: [], liste: [] }));
app.get('/boutique', (_q, s) => s.sendFile(path.join(RACINE, 'public', 'boutique.html')));
app.get('/fanzzy', (_q, s) => s.send('<!doctype html><title>classeur</title>'));
app.use(express.static(path.join(RACINE, 'public')));

const http = createServer(app);
await new Promise((r) => http.listen(0, r));
const base = `http://localhost:${http.address().port}`;

const nav = await puppeteer.launch({ args: ['--no-sandbox'] });
const erreurs = [];
try {
  const page = await nav.newPage();
  page.on('pageerror', (e) => erreurs.push(e.message));
  await page.setViewport({ width: 400, height: 860 });
  await page.goto(`${base}/boutique#tenues`, { waitUntil: 'networkidle0' });

  check('la cabine montre une tenue', await jusqua(() => page.$eval('#cabine',
    (el) => el.textContent.includes('Préhistorique')).catch(() => false)));

  const vignettes = await page.$$eval('#cabine [data-qui]', (l) => l.map((b) => b.dataset.qui));
  /* RP1 a atteint l'âge 2 : ses deux âges s'habillent. RP2 n'a que le
     premier. RP3 n'a pas de dessin en Préhistorique. */
  check('elle propose chaque âge atteint des Fanzzy qui la portent en dessin',
    JSON.stringify(vignettes) === JSON.stringify(['RP1:2', 'RP1:1', 'RP2:1'])
    || (console.log('        ', JSON.stringify(vignettes)), false));
  const manque = await page.$eval('#cabine .cabine-manque', (el) => el.textContent).catch(() => '');
  check('et elle dit pour combien de ses Fanzzy elle est dessinée',
    manque.includes('2 de tes 3 Fanzzy') || (console.log('        ', manque), false));
  check('le bouton dit ACHETER, et non plus CHOISIR LE FANZZY',
    await page.$eval('#cabine [data-acheter]', (b) => b.textContent.includes('ACHETER')).catch(() => false));
  check('plus aucun lien vers le classeur',
    !(await page.$('#cabine a[href*="/fanzzy"]')));

  await page.click('#cabine [data-qui="RP2:1"]');
  check('toucher un Fanzzy le met dans la scène', await jusqua(() => page.$eval('#cabine .cabine-pour',
    (el) => el.textContent.includes('Chant Oublié')).catch(() => false)));

  await page.click('#cabine [data-acheter]');
  const boite = await jusqua(() => page.$eval('.tbf-dial',
    (el) => el.textContent).then((t) => t.includes('ACHETER PRÉHISTORIQUE ?')
      && t.includes('Pour Chant Oublié, à l’âge 1')).catch(() => false));
  check('ACHETER demande confirmation, en nommant la tenue, le Fanzzy et l’âge', boite);
  check('et rien n’est parti avant la réponse', achats.length === 0);
  await page.click('.tbf-dial [data-oui]');

  check('oui : l’achat part avec la tenue, le Fanzzy et l’âge', await jusqua(() => achats.length === 1)
    && JSON.stringify(achats[0]) === JSON.stringify({ type: 'tenue', id: 'prehistorique', fanzzy: 'RP2', stage: 1 })
    || (console.log('        ', JSON.stringify(achats)), false));
  const porter = await jusqua(() => page.$eval('.tbf-calque [data-geste]',
    (b) => !b.closest('[hidden]')).catch(() => false), 10000);
  check('la cérémonie se joue sur place, avec LA PORTER', porter);
  check('on est toujours sur la boutique', new URL(page.url()).pathname === '/boutique');

  await page.click('.tbf-calque [data-geste]');
  check('LA PORTER pose ce Fanzzy, à cet âge, dans cette tenue', await jusqua(() => avatars.length === 1)
    && JSON.stringify(avatars[0]) === JSON.stringify({ fanzzyId: 'RP2', stade: 1, skinId: 'prehistorique' })
    || (console.log('        ', JSON.stringify(avatars)), false));

  check('relu, la vignette achetée porte « À TOI »', await jusqua(() => page.$eval(
    '#cabine [data-qui="RP2:1"]', (b) => b.textContent.includes('À TOI')).catch(() => false)));
  await page.click('#cabine [data-qui="RP2:1"]');
  check('et ce Fanzzy-là ne se rachète pas', await jusqua(async () => !(await page.$('#cabine [data-acheter]'))
    && (await page.$eval('#cabine .cabine-deja', (el) => el.textContent).catch(() => '')).includes('DÉJÀ')));

  check('aucune erreur dans la page', erreurs.length === 0 || (console.log('        ', erreurs), false));
} finally {
  await nav.close();
  http.close();
}

console.log(failures ? `\n${failures} échec(s)` : '\ntout est vert');
process.exit(failures ? 1 : 0);
