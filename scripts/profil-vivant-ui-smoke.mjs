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

async function ouvrir(av) {
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
await b.close(); srv.close();
console.log(rouge ? `\n${rouge} contrôle(s) en rouge` : '\ntout est vert');
process.exit(rouge ? 1 : 0);
