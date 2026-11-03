/**
 * MON FANZZY vit sur le profil (demande de Gaël, 3 novembre 2026 : « pas
 * beaucoup d'animation sur notre application »). La page seule, face à des
 * réponses posées et aux images d'états d'AN1 prises dans les fichiers du
 * projet quand elles sont là (les images Fanzzy ne sont plus dans git) :
 * le personnage en pied remplace la carte, réagit au toucher ; un Fanzzy
 * sans dessin d'états garde sa carte.
 *
 *   npm run profil-vivant:ui
 */
import { fileURLToPath } from 'node:url';
import { readFileSync, existsSync } from 'node:fs';
import express from 'express';
import puppeteer from 'puppeteer';
let rouge = 0;
const ok = (v, m) => { console.log(`  ${v ? 'ok  ' : 'NON '} ${m}`); if (!v) rouge++; };
const IMAGES = existsSync('/mnt/project-files/fanzzy-an/AN1/etats/AN1-e1-base-neutre.png');
const PUBLIC = fileURLToPath(new URL('../public', import.meta.url));
const app = express();
app.use(express.static(PUBLIC, { extensions: ['html'] }));
const srv = app.listen(0); const port = srv.address().port;
const b = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--accept-lang=fr-FR'] });

async function ouvrir(av, abo = null) {
  const p = await b.newPage();
  await p.setViewport({ width: 400, height: 900, deviceScaleFactor: 1 });
  const err = []; p.on('pageerror', (e) => err.push(e.message));
  await p.setRequestInterception(true);
  p.on('request', (r) => {
    const u = new URL(r.url());
    const j = (o) => r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
    const m = u.pathname.match(/^\/img\/fanzzy\/AN1\/e(\d)\/base\/([a-z-]+)\./);
    if (m) {
      const f = `/mnt/project-files/fanzzy-an/AN1/etats/AN1-e${m[1]}-base-${m[2]}.png`;
      if (existsSync(f)) return r.respond({ status: 200, contentType: 'image/png', body: readFileSync(f) });
    }
    if (u.pathname === '/api/auth/me') return j({ user: { id: 1, public_id: 'x', pseudo: 'Gael', email: 'g@x', verified: true } });
    if (u.pathname === '/api/rank/moi') return j({ avatar: av });
    if (u.pathname === '/api/me/state') return j({ onboarded: true, follows: [], stuff: [] });
    if (u.pathname === '/api/me/catalogue') return j({ stuff: [] });
    if (u.pathname === '/api/abonnement' && abo) return j(abo);
    if (u.pathname === '/api/me/loadout') return j({ fanzzy: { id: av.id, nom: av.nom, cri: { label: 'PLUIE OU PAS' } } });
    if (u.pathname.startsWith('/api/')) return r.respond({ status: 404, contentType: 'application/json', body: '{}' });
    r.continue();
  });
  await p.goto(`http://127.0.0.1:${port}/profil`, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 1200));
  return { p, err };
}

{
  const { p, err } = await ouvrir({ id: 'AN1', age: 'AN1', evo: 1, skin: 'base', nom: 'Le Crachin', rar: 'commune' });
  ok(Boolean(await p.$('#monFzScene')), 'un Fanzzy dessiné vit en pied dans MON FANZZY');
  ok(!(await p.$('#fanzzy .mon-fz-carte')), 'et sa carte lui cède la place');
  ok(/Faire crier/.test(await p.$eval('#monFzScene', (e) => e.getAttribute('aria-label'))), 'il se touche, et le dit');
  if (IMAGES) {
    const larg = await p.$$eval('#monFzScene img', (l) => Math.max(0, ...l.map((i) => i.naturalWidth)));
    ok(larg > 0, 'son image de repos est chargée');
  }
  const zone = await p.$('#monFzScene');
  await zone.scrollIntoView();
  await new Promise((r) => setTimeout(r, 300));
  const dessus = await p.$eval('#monFzScene', (e) => {
    const r = e.getBoundingClientRect();
    const x = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return e.contains(x) ? '' : (x?.className || x?.tagName || '?');
  });
  ok(!dessus, `rien ne le couvre${dessus ? ` (${dessus})` : ''}`);
  await zone.click();
  await new Promise((r) => setTimeout(r, 400));
  ok(Boolean(await p.$('.fx-titre')), 'au toucher, il pousse son cri');
  ok(!err.length, `aucune erreur de script${err.length ? ` (${err[0]})` : ''}`);
  await p.close();
}
{
  const { p, err } = await ouvrir({ id: 'ZZ99', age: 'ZZ99', evo: 1, skin: 'base', nom: 'Inconnu', rar: 'commune' });
  ok(!(await p.$('#monFzScene')), 'un Fanzzy sans dessin d’états garde sa carte');
  ok(!err.length, 'et rien ne casse');
  await p.close();
}
/* La voie PASS sur la carte : le titre (niveau 9), le pseudo en or (12) ;
   le kit du PASS 1 : cadre de pierre au buste (2), fond de grotte (5), plaque du titre. */
const GAINS_12 = ['tenue', 'cadre_profil', 'stickers', 'fond_profil', 'cadre', 'entree', 'titre',
  'cadre_anime', 'aura', 'badge_or'];
for (const [niveau, titre, or, gains] of [[1, null, false, ['tenue']], [8, null, false, GAINS_12.slice(0, 6)],
  [12, 'Chasseur de mammouth', true, GAINS_12]]) {
  const v = { saison: 1, niveau, couleur: '#c9772e', or, titre, etoiles: 0, gains, cadre: 'anime' };
  const { p, err } = await ouvrir({ id: 'ZZ99', age: 'ZZ99', evo: 1, skin: 'base', nom: 'Inconnu', rar: 'commune' },
    { actif: true, voies: [v], voie: [] });
  const t = await p.$eval('#passTitre', (e) => (e.hidden ? '' : e.textContent)).catch(() => '');
  const enOr = await p.$eval('#pseudo', (e) => e.classList.contains('pseudo-or')).catch(() => false);
  ok(titre ? t === titre : !t, `niveau ${niveau} : ${titre ? 'le titre sous le pseudo' : 'pas encore de titre'}`);
  ok(enOr === or, `niveau ${niveau} : ${or ? 'le pseudo en or' : 'le pseudo pas encore en or'}`);
  const kit = await p.evaluate(() => ({
    cadre: Boolean(document.querySelector('#buste .pass-cadre-profil')),
    grotte: document.getElementById('fond').classList.contains('grotte'),
    plaque: document.getElementById('passTitre').classList.contains('plaque'),
  }));
  ok(kit.cadre === niveau >= 2, `niveau ${niveau} : ${niveau >= 2 ? 'le cadre de pierre autour du buste' : 'pas de cadre de pierre'}`);
  ok(kit.grotte === niveau >= 5, `niveau ${niveau} : ${niveau >= 5 ? 'le fond de grotte' : 'pas de fond de grotte'}`);
  ok(kit.plaque === Boolean(titre), `niveau ${niveau} : ${titre ? 'le titre sur sa plaque' : 'pas de plaque'}`);
  if (process.env.VOIE_CAPTURES && or) {
    await p.$('.carte').then((e) => e?.screenshot({ path: `${process.env.VOIE_CAPTURES}/profil-titre-or.png` })).catch(() => {});
  }
  ok(!err.length, `niveau ${niveau} : aucune erreur de script`);
  await p.close();
}
await b.close(); srv.close();
console.log(rouge ? `\n${rouge} contrôle(s) en rouge` : '\ntout est vert');
process.exit(rouge ? 1 : 0);
