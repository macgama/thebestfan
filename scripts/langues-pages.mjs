// npm run langues:pages -- <adresse> <cookie de session> [langue] [--releves] : parcourt les pages dans une langue
// et relève ce qui reste en français (voir scripts/langues.mjs).
import puppeteer from 'puppeteer';
import fs from 'node:fs';
const [base, cookie, langue = 'en', pseudo = '0'] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const PAGES = (process.env.PAGES ?? '/,/matchs,/teletext,/bienvenue,/profil,/collection,/classement,/boutique,/abonnement,/boosters,/compte,/equipes,/kop,/amis,/deck,/duel-nvn,/fanzzy,/fanzzy/TR32,/virage,/carnet,/aide,/repetition,/confidentialite').split(',');
const nav = await puppeteer.launch({ executablePath: process.env.PUPPETEER_EXECUTABLE_PATH, args: ['--no-sandbox', '--accept-lang=fr-FR'] });
const page = await nav.newPage();
await page.setViewport({ width: 400, height: 860 });
const erreurs = [];
page.on('pageerror', (e) => erreurs.push(e.message));
const u = new URL(base);
if (cookie) await page.setCookie({ name: 'tbf_session', value: cookie, domain: u.hostname, path: '/' });
await page.evaluateOnNewDocument((l) => { localStorage.setItem('tbf_locale', l); localStorage.setItem('tbf_locale_choisie', '1'); localStorage.setItem('tbf-ouverture-vue', '1'); }, langue);
const rapport = {};
for (const p of PAGES) {
  erreurs.length = 0;
  try { await page.goto(base + p, { waitUntil: 'networkidle2', timeout: 20000 }); } catch (e) { console.log(p, 'goto', e.message); }
  await new Promise((r) => setTimeout(r, 1500));
  // ouvrir le menu pour le relever aussi
  const r = await page.evaluate((pseudo) => {
    const manques = window.TBF_LANGUE?.manques?.() ?? [];
    const restes = [];
    if (pseudo === '1') {
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        const t = n.data.replace(/\s+/g, ' ').trim();
        if (!/[a-zà-ÿ]{3}/i.test(t) || t.includes('⟦') || t.includes('⟧')) continue;
        const el = n.parentElement;
        if (!el || el.closest('script,style,svg,[translate=no]')) continue;
        if (el.closest('[hidden]')) continue;
        if (el.textContent.includes('⟦') || el.parentElement?.textContent.includes('⟦')) continue;
        restes.push(t.slice(0, 120));
      }
    }
    return { manques, restes: [...new Set(restes)], titre: document.title };
  }, pseudo);
  rapport[p] = { ...r, erreurs: [...erreurs] };
  console.log(`${p}  manques:${r.manques.length} restes:${r.restes.length} erreurs:${erreurs.length}  « ${r.titre} »`);
}
fs.writeFileSync(process.env.SORTIE ?? '/tmp/rapport.json', JSON.stringify(rapport, null, 1));

/* `--releves` : ce qui reste en français s'ajoute à i18n/releves.json, les
   nombres remplacés par {0}, {1}… — c'est la liste à traduire ensuite. Un
   texte déjà traduit (une valeur du dictionnaire) n'en est pas un. */
if (process.argv.includes('--releves')) {
  const chemin = new URL('../i18n/releves.json', import.meta.url);
  const deja = new Set(fs.existsSync(chemin) ? JSON.parse(fs.readFileSync(chemin, 'utf8')) : []);
  const dico = JSON.parse(fs.readFileSync(new URL(`../i18n/${langue}.json`, import.meta.url), 'utf8'));
  const traduits = new Set(Object.values(dico).map((v) => v.replace(/\{\d+[^}]*\}/g, '')));
  const FR = /[àâçéèêëîïôûùœ’«»]|\b(le|la|les|des|du|un|une|et|ton|ta|tes|est|pour|pas|sur|au|aux|tu|qui|que|seulement|encore|oui|non|tous|toutes)\b/i;
  for (const v of Object.values(rapport)) {
    for (const m of v.manques) {
      let k = 0;
      const gen = m.split(/(<\/?\d+\/?>)/).map((x, i) => (i % 2 ? x
        : x.replace(/\d+(?: \d{3})*(?:[.,]\d+)?/g, () => `{${k++}}`))).join('');
      if (!FR.test(gen.replace(/\{\d+\}/g, '')) || traduits.has(gen.replace(/\{\d+\}/g, ''))) continue;
      deja.add(gen);
    }
  }
  fs.writeFileSync(chemin, JSON.stringify([...deja].sort(), null, 1) + '\n');
  console.log(`${deja.size} textes dans i18n/releves.json`);
}
await nav.close();
