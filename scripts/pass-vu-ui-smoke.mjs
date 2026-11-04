/**
 * Le PASS **vu par les autres** (choix de Gaël, 4 novembre 2026 : « Être vu
 * par les autres », puis « Donner envie »). Les pages seules, face à des
 * réponses posées :
 *   - l'affiche du duel montre l'écusson, le titre, le pseudo en or, le cadre
 *     de carte et l'entrée en rochers de celui qui a le PASS — rien chez
 *     celui qui ne l'a pas ;
 *   - les stickers du PASS : le bouton chez celui qui a le gain, le dessin qui
 *     vole au-dessus de la bonne tribune ;
 *   - la fiche d'un ami : son fond, son cadre, son titre, son pseudo en or ;
 *   - la liste des amis : l'écusson ;
 *   - le Virage : l'aura de braises autour de mon Fanzzy au niveau 11.
 *
 *   npm run pass-vu:ui        (`PASS_VU_CAPTURES=<dossier>` pour des captures)
 */
import { fileURLToPath } from 'node:url';
import express from 'express';
import puppeteer from 'puppeteer';
import { gainsDe } from '../src/shared/pass.js';

let rouge = 0;
const ok = (v, m) => { console.log(`  ${v ? 'ok  ' : 'NON '} ${m}`); if (!v) rouge++; };
const CAPT = process.env.PASS_VU_CAPTURES;

const app = express();
const PUBLIC = fileURLToPath(new URL('../public', import.meta.url));
/* Un faux socket.io : les pages se branchent, rien ne répond. */
app.get('/socket.io/socket.io.js', (_req, res) => res.type('js').send(
  'window.io=function(){var h={};var s={connected:false,id:"x",io:{on:function(){},opts:{}},'
  + 'on:function(e,f){(h[e]=h[e]||[]).push(f);return s},off:function(){return s},'
  + 'emit:function(e,d){(window.__emis=window.__emis||[]).push([e,d]);return s},'
  + 'connect:function(){return s},disconnect:function(){return s},'
  + '__fire:function(e,d){(h[e]||[]).forEach(function(f){f(d)})}};window.__socket=s;return s};'));
app.use(express.static(PUBLIC, { extensions: ['html'] }));
const srv = app.listen(0);
const port = srv.address().port;

const PLEIN = { saison: 1, niveau: 12, couleur: '#c9772e', cadre: 'anime', or: true, etoiles: 0,
  titre: 'Chasseur de mammouth', gains: gainsDe(12) };

const b = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--accept-lang=fr-FR'] });

async function page(chemin, reponses = {}, { largeur = 400, hauteur = 860 } = {}) {
  const p = await b.newPage();
  await p.setViewport({ width: largeur, height: hauteur, deviceScaleFactor: 1 });
  const erreurs = [];
  p.on('pageerror', (e) => erreurs.push(e.message));
  await p.setRequestInterception(true);
  p.on('request', (r) => {
    const u = new URL(r.url());
    if (u.hostname !== '127.0.0.1') return r.respond({ status: 204, body: '' });
    const j = (o) => r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
    for (const [motif, rep] of Object.entries(reponses)) {
      if (u.pathname === motif || (motif.endsWith('*') && u.pathname.startsWith(motif.slice(0, -1)))) {
        return j(typeof rep === 'function' ? rep(u) : rep);
      }
    }
    if (u.pathname === '/api/auth/me') return j({ user: { id: 'u1', pseudo: 'Gael', verified: true } });
    if (u.pathname.startsWith('/api/')) return r.respond({ status: 404, contentType: 'application/json', body: '{}' });
    return r.continue();
  });
  await p.goto(`http://127.0.0.1:${port}${chemin}`, { waitUntil: 'networkidle2', timeout: 30000 });
  return { p, erreurs };
}
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------ le duel */
{
  const { p, erreurs } = await page('/duel-nvn');
  const affiche = {
    id: 'd1', mode: '1v1', stade: null,
    joueurs: [
      { userId: 'u1', nom: 'Gael', side: 0, bot: false, forme: [],
        fanzzy: [{ id: 'RP1', nom: 'Rapace', stade: 1, skin: 'base', rar: 'c' }], pass: PLEIN },
      { userId: 'u2', nom: 'Rival', side: 1, bot: false, forme: [],
        fanzzy: [{ id: 'AN1', nom: 'Ange', stade: 1, skin: 'base', rar: 'c' }] },
    ],
  };
  const r = await p.evaluate((a) => {
    S.vue = { moi: { side: 0, userId: 'u1' } };
    montrerAffiche(a);
    poserStickers(a);
    const moi = document.querySelector('#afficheCamps .camp-bloc.moi');
    const eux = document.querySelector('#afficheCamps .camp-bloc.eux');
    return {
      badge: Boolean(moi?.querySelector('.tbf-pass-badge')),
      or: Boolean(moi?.querySelector('b.pass-or')),
      titre: moi?.querySelector('.pass-titre')?.textContent ?? '',
      cadre: moi?.querySelector('.fz-aff.heros')?.dataset.passCadre ?? '',
      entree: Boolean(moi?.querySelector('.fz-aff.heros[data-pass-entree] .pass-entree')),
      euxRien: !eux?.querySelector('.tbf-pass-badge, .pass-titre, .pass-cadre, .pass-entree, .pass-or'),
      stickers: document.querySelectorAll('#passStickers .choix button').length,
    };
  }, affiche);
  ok(r.badge, 'duel : l’écusson du PASS près de mon pseudo');
  ok(r.or, 'duel : le pseudo en or au niveau 12');
  ok(r.titre === 'Chasseur de mammouth', 'duel : le titre de saison sous le pseudo');
  ok(r.cadre === 'anime', 'duel : le cadre de carte animé autour du héros');
  ok(r.entree, 'duel : l’entrée en rochers');
  ok(r.euxRien, 'duel : rien du PASS chez celui qui ne l’a pas');
  ok(r.stickers === 4, 'duel : quatre stickers à lancer');
  await attendre(1600);
  if (CAPT) await p.screenshot({ path: `${CAPT}/duel-affiche.png` });

  /* Le lancer : l'événement part, et le dessin vole chez la bonne tribune. */
  const v = await p.evaluate(() => {
    document.getElementById('affiche').hidden = true;
    document.getElementById('jeu')?.removeAttribute('hidden');
    document.querySelector('#passStickers .ouvre').click();
    document.querySelector('#passStickers [data-sticker="massue"]').click();
    const emis = (window.__emis ?? []).filter(([e]) => e === 'nvn:sticker');
    volerSticker({ userId: 'u2', side: 1, saison: 1, sticker: 'feu' });
    return { emis, vol: document.querySelector('.pass-vol')?.dataset.tribune ?? '',
      attente: document.getElementById('passStickers').dataset.attente !== undefined };
  });
  ok(v.emis.length === 1 && v.emis[0][1]?.sticker === 'massue', 'duel : le sticker choisi part au serveur');
  ok(v.attente, 'duel : le bouton attend avant le suivant');
  ok(v.vol === 'eux', 'duel : le sticker d’en face vole au-dessus de sa tribune');

  /* Sans le gain : pas de bouton. */
  const sans = await p.evaluate((a) => {
    const b2 = structuredClone(a);
    b2.joueurs[0].pass = { saison: 1, niveau: 2, couleur: '#c9772e', gains: ['tenue', 'cadre_profil'] };
    poserStickers(b2);
    return Boolean(document.getElementById('passStickers'));
  }, affiche);
  ok(!sans, 'duel : pas de stickers avant le niveau 3');
  ok(!erreurs.length, `duel : aucune erreur (${erreurs.join(' | ')})`);
  await p.close();
}

/* ------------------------------------------------------------ les amis */
{
  const ami = { id: 'a9', pseudo: 'Mammouth', etat: 'amis', avatar: null,
    pass: { saison: 1, couleur: '#c9772e', nombre: 1 } };
  const { p, erreurs } = await page('/amis?ami=a9', {
    '/api/amis/': { amis: [ami], recues: [], envoyees: [], invitations: [] },
    '/api/amis/suggestions': { gens: [] },
    '/api/kop/miens': { kops: [] },
    '/api/ensemble/fil': { fil: [] },
    '/api/ensemble/fiche/a9': { actif: false, ami: { id: 'a9', pseudo: 'Mammouth', niveau: 7, clubs: [] } },
    '/api/abonnement/badge/a9': { badge: PLEIN },
  });
  await attendre(1200);
  const r = await p.evaluate(() => {
    const t = document.querySelector('.fiche-tete');
    return {
      fond: t?.hasAttribute('data-pass-fond') ?? false,
      cadre: Boolean(t?.querySelector('.pass-cadre-buste')),
      or: Boolean(t?.querySelector('b.pass-or')),
      titre: t?.querySelector('.pass-titre')?.textContent ?? '',
      badge: Boolean(t?.querySelector('.tbf-pass-badge')),
    };
  });
  ok(r.badge && r.or && r.titre === 'Chasseur de mammouth', 'fiche d’un ami : écusson, pseudo en or, titre');
  ok(r.fond && r.cadre, 'fiche d’un ami : le fond de grotte et le cadre de pierre');
  if (CAPT) await p.screenshot({ path: `${CAPT}/fiche-ami.png` });
  const liste = await p.evaluate(async () => {
    S.vue = 'amis';
    rendre();
    return Boolean(document.querySelector('.gars.ami .nom .tbf-pass-badge'));
  });
  ok(liste, 'liste des amis : l’écusson près du pseudo');
  ok(!erreurs.length, `amis : aucune erreur (${erreurs.join(' | ')})`);
  await p.close();
}

/* ------------------------------------------------------------ le Virage */
for (const [nom, niveau] of [['niveau 11', 11], ['niveau 10', 10]]) {
  const { p, erreurs } = await page('/virage?f=1', {
    '/api/abonnement': { actif: true, voies: [{ saison: 1, niveau, couleur: '#c9772e', original: true,
      gains: gainsDe(niveau) }] },
  });
  await attendre(800);
  const aura = await p.evaluate(() => document.querySelectorAll('#fzs > .pass-aura i').length);
  if (niveau === 11) ok(aura === 9, 'Virage : l’aura de braises autour de mon Fanzzy au niveau 11');
  else ok(aura === 0, 'Virage : pas d’aura avant le niveau 11');
  ok(!erreurs.filter((e) => /pass|aura/i.test(e)).length, `Virage (${nom}) : aucune erreur du PASS`);
  await p.close();
}

await b.close();
srv.close();
console.log(rouge ? `\n${rouge} échec(s)` : '\nTout est vert.');
process.exit(rouge ? 1 : 0);
