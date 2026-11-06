/**
 * L'appel d'un ami, annoncé en grand (`public/appel-fete.js`, 6 novembre 2026).
 *
 *   — une demande d'ami ouvre la case commune : le pseudo, la bulle, ACCEPTER
 *     et PLUS TARD ; ACCEPTER répond à `/api/amis/reponse` ;
 *   — une fois seulement : la page suivante ne la redit pas ;
 *   — une invitation dans un KOP : REJOINDRE LE KOP ;
 *   — une invitation en duel, passée par le rappel du duel : REJOINDRE LE
 *     DUEL mène au vestiaire du bon duel ;
 *   — rien au Virage, et pas de demande d'ami sur la page des amis.
 *
 * Les routes sont bouchonnées : ce qu'on vérifie ici, c'est la page. Les
 * routes elles-mêmes sont dans `amis:smoke` (`alertesDe`).
 *
 * `FAUX=<dossier>` sert les dessins des Fanzzy AN depuis ce dossier (images
 * hors git) ; `CAPTURE=<dossier>` y écrit une image de chaque case, `VIDEO=1`
 * ralentit pour la filmer.
 */
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import puppeteer from 'puppeteer';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const CAPTURE = process.env.CAPTURE ?? '';
const FAUX = process.env.FAUX ?? '';

let failures = 0;
const check = (l, c, ...x) => {
  console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`);
  if (!c) { failures++; if (x.length) console.log('       ', JSON.stringify(x)); }
};
const dodo = (ms) => new Promise((r) => setTimeout(r, ms));
async function jusqua(fn, ms = 9000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await Promise.resolve().then(fn).catch(() => false)) return true;
    await dodo(80);
  }
  return false;
}

/* --------------------------------------------------- les routes bouchonnées */
const AVATAR = { id: 'AN1', age: 'AN1', evo: 1, skin: 'base', etat: 'neutre' };
const etat = { demandes: [], kops: [], invitations: [], reponses: [], kopReponses: [] };
const app = express();
app.use(express.json());
app.get('/api/auth/me', (_q, r) => r.json({ user: { id: 'u-moi', pseudo: 'Moi' } }));
app.get('/api/amis/alertes', (q, r) => r.json({ demandes: etat.demandes, kops: etat.kops,
  visage: q.query.visage ? { pseudo: 'Léa', avatar: AVATAR } : null }));
app.post('/api/amis/reponse', (q, r) => { etat.reponses.push(q.body); r.json({ ok: true }); });
app.post('/api/amis/kop/reponse', (q, r) => { etat.kopReponses.push(q.body); r.json({ ok: true }); });
app.get('/api/nvn/moi', (_q, r) => r.json({ file: null, invitations: etat.invitations, attentes: [] }));
/* Les dessins des Fanzzy sont hors git : un point transparent en tient lieu,
   sauf si `FAUX` dit où trouver les vrais.
   /img/fanzzy/AN1/e1/base/joie.webp → <FAUX>/AN1/etats/AN1-e1-base-joie.png */
const POINT = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
app.get(/^\/img\/fanzzy\/(AN\d+)\/e(\d)\/(\w+)\/(\w+)\.\w+$/, (q, r) => {
  const [id, e, skin, nom] = [0, 1, 2, 3].map((i) => q.params[i]);
  const f = FAUX && [`${id}-e${e}-${skin}-${nom}.png`, `${id}-e${e}-base-joie.png`]
    .map((x) => path.join(FAUX, id, 'etats', x)).find((x) => existsSync(x));
  if (f) return r.type('png').sendFile(f);
  return r.type('png').send(POINT);
});
/* Une page qui ressemble au jeu, sans le reste du jeu : la feuille commune,
   les effets, le son, l'appel et le rappel du duel. */
const PAGE = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="/ui.css"></head>
<body style="background:#05070A;color:#F2EEE4;min-height:100vh;margin:0">
<main style="padding:24px"><h1 class="tbf-cousu">MA COLLECTION</h1></main>
<script src="/fx.js" defer></script><script src="/son.js" defer></script>
<script src="/appel-fete.js" defer></script><script src="/duel-rappel.js" defer></script>
</body></html>`;
for (const p of ['/collection', '/virage', '/amis', '/boosters']) app.get(p, (_q, r) => r.type('html').send(PAGE));
app.get('/duel-nvn', (_q, r) => r.type('html').send('<!doctype html><title>duel</title>'));
app.use(express.static(path.join(RACINE, 'public')));

const http = createServer(app);
await new Promise((r) => http.listen(0, r));
const BASE = `http://127.0.0.1:${http.address().port}`;

const nav = await puppeteer.launch({ args: ['--no-sandbox', '--accept-lang=fr-FR', '--autoplay-policy=no-user-gesture-required'] });
const page = await nav.newPage();
await page.setViewport({ width: 412, height: 860, deviceScaleFactor: 1 });
const erreurs = [];
page.on('pageerror', (e) => erreurs.push(e.message));
const caseOuverte = () => page.evaluate(() => {
  const k = document.querySelector('.tbf-niv-case');
  return k ? { quoi: k.querySelector('.tbf-sticker')?.textContent ?? '', titre: k.querySelector('.tbf-niv-n')?.textContent ?? '',
    de: k.querySelector('.tbf-niv-de')?.textContent ?? '', bulle: k.querySelector('.tbf-appel-bulle')?.textContent ?? '',
    boutons: [...k.querySelectorAll('button')].map((b) => b.textContent.trim()) } : null;
});
const photo = async (nom) => {
  if (!CAPTURE) return;
  await dodo(process.env.VIDEO ? 3000 : 1600);
  await page.screenshot({ path: path.join(CAPTURE, `${nom}.png`) });
};

/* ---------------------------------------------------------- une demande d'ami */
console.log('\n  une demande d’ami');
etat.demandes = [{ id: 'u-lea', pseudo: 'Léa', avatar: AVATAR, depuis: '2026-11-06T18:00:00Z' }];
await page.goto(`${BASE}/collection`);
check('la case s’ouvre, avec son pseudo', await jusqua(async () => (await caseOuverte())?.titre === 'Léa'));
const c1 = await caseOuverte();
check('elle dit la demande d’ami, la bulle et ses deux boutons',
  c1?.quoi === 'DEMANDE D’AMI' && c1.bulle === 'ON SE SUIT ?'
  && c1.boutons.join('|') === 'ACCEPTER|PLUS TARD', c1);
check('elle dit ce qu’il veut', /pote de tribune/.test(c1?.de ?? ''), c1?.de);
await photo('1-demande-ami');
await page.click('.tbf-niv-case [data-choix="accepter"]');
check('ACCEPTER répond à la demande', await jusqua(() => etat.reponses.some((x) => x.id === 'u-lea' && x.ok === true)));
check('et le dit en bas de l’écran', await jusqua(() => page.evaluate(() =>
  [...document.querySelectorAll('.tbf-toast')].some((t) => /VOUS ÊTES POTES/.test(t.textContent)))));

await page.goto(`${BASE}/boosters`);
await dodo(2600);
check('une fois seulement : la page suivante ne la redit pas', !(await caseOuverte()));

/* ------------------------------------------------------------------ un KOP */
console.log('\n  une invitation dans un KOP');
etat.kops = [{ kopId: 'k1', nom: 'Le Virage Nord', club: 'Sion', de: 'Léa', avatar: AVATAR, depuis: '2026-11-06T18:01:00Z' }];
await page.goto(`${BASE}/virage`);
await dodo(2600);
check('rien au Virage', !(await caseOuverte()));
await page.goto(`${BASE}/collection`);
check('ailleurs, la case du KOP s’ouvre', await jusqua(async () => (await caseOuverte())?.titre === 'Le Virage Nord'));
const c2 = await caseOuverte();
check('avec qui invite, le club et REJOINDRE LE KOP',
  /Léa t’invite à rejoindre son KOP · Sion/.test(c2?.de ?? '') && c2.boutons[0] === 'REJOINDRE LE KOP', c2);
await photo('2-invitation-kop');
await page.click('.tbf-niv-case [data-fermer]');
check('PLUS TARD referme sans répondre', await jusqua(async () => !(await caseOuverte()))
  && etat.kopReponses.length === 0);

/* ----------------------------------------------------------------- un duel */
console.log('\n  une invitation en duel');
etat.invitations = [{ code: 'abc123', de: 'Léa', deId: 'u-lea', format: '3v3', fixtureId: 7,
  club: { name: 'Sion' }, enFaceClub: { name: 'Bâle' } }];
await page.goto(`${BASE}/collection`);
check('la case du duel s’ouvre (lue par le rappel)', await jusqua(async () => (await caseOuverte())?.quoi === 'INVITATION EN DUEL', 14000));
const c3 = await caseOuverte();
check('elle dit le format, les clubs, REJOINDRE LE DUEL',
  /3v3 · Sion – Bâle/.test(c3?.de ?? '') && c3.boutons[0] === 'REJOINDRE LE DUEL' && c3.bulle === 'ON JOUE ?', c3);
check('le Fanzzy de l’ami est dans la scène', await page.evaluate(() =>
  Boolean(document.querySelector('.tbf-niv-case .tbf-niv-perso')?.getAttribute('src')?.includes('AN1'))));
await photo('3-invitation-duel');
await Promise.all([page.waitForNavigation().catch(() => {}),
  page.click('.tbf-niv-case [data-choix="rejoindre"]')]);
const ou = new URL(page.url());
check('REJOINDRE LE DUEL mène au vestiaire du bon duel',
  ou.pathname === '/duel-nvn' && ou.searchParams.get('duel') === 'abc123', page.url());

/* ------------------------------------------------- la page des amis se tait */
console.log('\n  la page des amis');
etat.invitations = [];
etat.demandes = [{ id: 'u-max', pseudo: 'Max', avatar: AVATAR, depuis: '2026-11-06T18:05:00Z' }];
await page.goto(`${BASE}/amis`);
await dodo(2800);
check('pas de demande d’ami sur la page des amis, qui les montre', !(await caseOuverte()));

check('aucune erreur de script', erreurs.length === 0, erreurs);

await nav.close();
http.close();
console.log(`\n${failures ? `${failures} échec(s)` : 'tout est vert'}`);
process.exitCode = failures ? 1 : 0;
