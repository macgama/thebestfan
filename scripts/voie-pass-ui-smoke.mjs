/**
 * La voie PASS dans le carnet de /aide (demande de Gaël, 3 novembre 2026 :
 * « une voie PASS dans le carnet qui donnera envie aux personnes n'ayant pas
 * le PASS »). La page seule, face à des réponses posées : un joueur sans PASS
 * voit tout sous cadenas et ce que ses tampons ont déjà atteint ; un membre
 * voit son niveau ; pendant la BASE, la voie du PASS 1 est un aperçu.
 *
 *   npm run voie:ui
 */
import { fileURLToPath } from 'node:url';
import express from 'express';
import puppeteer from 'puppeteer';
import { VOIE_PASS, seuilsVoie } from '../src/shared/pass.js';
let rouge = 0;
const ok = (v, m) => { console.log(`  ${v ? 'ok  ' : 'NON '} ${m}`); if (!v) rouge++; };
const app = express();
const PUBLIC = fileURLToPath(new URL('../public', import.meta.url));
app.use(express.static(PUBLIC, { extensions: ['html'] }));
const srv = app.listen(0);
const port = srv.address().port;
/* La voie telle que le serveur la sert (`/api/abonnement` : `voie`). */
const VOIE = VOIE_PASS.map((v) => ({ ...v }));
const carnet = (numero, tampons) => {
  const seuils = [10, 35, 75, 110, 140];
  return { saison: { id: 7, numero, nom: numero ? 'Héros du canapé' : 'BASE' }, tampons,
    paliers: seuils.map((t, i) => ({ n: i + 1, tampons: t, nom: ['De retour','Dans le bain','Remis en voix','Au rendez-vous','Revenu pour de bon'][i],
      etat: tampons >= t ? (i === 0 ? 'reclame' : 'pret') : 'a_venir', gain: { echarpes: 100 * (i + 1), packs: i } })),
    prochain: { n: 3, manque: 75 - tampons } };
};
const cas = {
  sans: { q: carnet(1, 40), a: { actif: false, voie: VOIE, voies: [], offre: { couvre: [{ numero: 1, couleur: '#c9772e' }] } } },
  membre: { q: carnet(1, 80), a: { actif: true, voie: VOIE, voies: [{ saison: 1, niveau: 7, couleur: '#c9772e', tampons: 80, seuils: [10,35,75,110,140], seuilsVoie: seuilsVoie([10,35,75,110,140]) }] } },
  aucun: { q: carnet(1, 40), a: null },
  base: { q: carnet(0, 20), a: { actif: false, voie: VOIE, voies: [], offre: { couvre: [{ numero: 1, couleur: '#c9772e' }], bientot: { ouvre: '2026-12-01' } } } },
  ouvert: { q: carnet(1, 40), a: { actif: false, voie: VOIE, voies: [], offre: { couvre: [{ numero: 1, couleur: '#c9772e' }], bientot: null } } },
};
const b = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--accept-lang=fr-FR'] });
for (const [nom, c] of Object.entries(cas)) {
  const p = await b.newPage();
  await p.setViewport({ width: 400, height: 900, deviceScaleFactor: 1 });
  const erreurs = [];
  p.on('pageerror', (e) => erreurs.push(e.message));
  await p.setRequestInterception(true);
  p.on('request', (r) => {
    const u = new URL(r.url());
    const j = (o) => r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
    if (u.pathname === '/api/quotidien') return j({ actif: true, carnet: c.q, finDuJourMs: 3600000 });
    if (u.pathname === '/api/abonnement') return c.a ? j(c.a) : r.respond({ status: 404, body: '{}' });
    if (u.pathname === '/api/auth/me') return j({ user: { id: 1, pseudo: 'Gael' } });
    if (u.pathname === '/api/aide/parcours') return j({ etapes: [{ cle: 'a', titre: 'x', quoi: 'x', pourquoi: 'x', fait: true }], faites: 1, total: 1 });
    if (u.pathname.startsWith('/api/')) return r.respond({ status: 404, body: '{}' });
    r.continue();
  });
  await p.goto(`http://127.0.0.1:${port}/aide#saison`, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 800));
  /* `VOIE_CAPTURES=<dossier>` : une capture de la voie par cas, pour la regarder. */
  if (process.env.VOIE_CAPTURES && nom !== 'aucun') {
    await p.$('#voiePass').then((e) => e?.screenshot({ path: `${process.env.VOIE_CAPTURES}/voie-${nom}.png` })).catch(() => {});
  }
  const t = await p.$eval('#voiePass', (e) => e.innerText.replace(/\s+/g, ' ')).catch(() => '');
  const n = (sel) => p.$$eval(`#voiePass ${sel}`, (l) => l.length).catch(() => 0);
  if (nom !== 'aucun') {
    ok(t.includes('LA VOIE PASS 1'), `${nom} : la voie PASS est sous le carnet`);
    ok(await n('.tbf-noeud') === 12, `${nom} : douze niveaux`);
  }
  if (nom === 'sans') {
    ok(/4 CADEAUX PASS T.ATTENDENT/.test(t), 'sans PASS : 4 cadeaux attendent (40 tampons : 0, 10, 20 et 35)');
    ok(await n('[data-attend]') === 4, 'sans PASS : les quatre brillent');
    ok(await n('[data-verrou]') === 12, 'sans PASS : tout est sous cadenas');
    ok(t.includes('STICKERS') && t.includes('AURA'), 'sans PASS : les nouveaux gains ont leur nom court');
    if (Date.now() < Date.parse('2026-12-01T00:00:00+01:00')) {
      ok(t.includes('1er décembre') && t.includes('BIENTÔT'), 'sans PASS : BIENTÔT et le 1er décembre avant l’ouverture');
    } else {
      ok(t.includes('VOIR LE PASS') && !t.includes('BIENTÔT'), 'sans PASS : VOIR LE PASS après l’ouverture');
    }
  }
  if (nom === 'membre') {
    ok(t.includes('NIVEAU 7 / 12'), 'membre : son niveau, servi par le serveur');
    ok(await n('[data-etat=fait]') === 7, 'membre : sept niveaux obtenus');
    ok(!t.includes('BIENTÔT') && !t.includes('VOIR LE PASS'), 'membre : rien à vendre');
  }
  if (nom === 'base') {
    ok(await n('[data-attend]') === 0, 'BASE : aucun cadeau promis, le carnet n’est pas celui du PASS 1');
    ok(t.includes('saison 1'), 'BASE : elle dit qu’elle avance avec la saison 1');
  }
  if (nom === 'base') ok(t.includes('BIENTÔT') && t.includes('1er décembre'), 'BASE : le serveur dit BIENTÔT, avec son jour');
  if (nom === 'ouvert') ok(t.includes('VOIR LE PASS') && !t.includes('BIENTÔT'), 'le serveur dit que le PASS s’achète : VOIR LE PASS');
  if (nom === 'aucun') ok(!t, 'sans réponse du PASS : pas de voie, et rien ne casse');
  ok(!erreurs.length, `${nom} : aucune erreur de script`);
  await p.close();
}
await b.close(); srv.close();
console.log(rouge ? `\n${rouge} contrôle(s) en rouge` : '\ntout est vert');
process.exit(rouge ? 1 : 0);
