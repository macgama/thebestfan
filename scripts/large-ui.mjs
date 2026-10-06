/**
 * Le contrôle commun des pages larges (`<body class="tbf-large">`, « Les
 * pages larges » dans public/ui.css), partagé par les suites UI des pages.
 *
 * À 1 366 × 682, une page large : sa colonne dépasse les 900 px, rien ne
 * déborde de l'écran, les dix tuiles la bordent sans la toucher, et sa
 * liste (`liste`, un sélecteur de ses éléments) s'étale sur plus d'une
 * colonne. À 1 100 px, la page redevient celle du téléphone : une colonne,
 * pas de tuiles. La suite rend la page à la taille où elle l'a trouvée.
 *
 *   await controlerLarge(page, check, { nom: 'la page des amis', liste: '.gens>.ami' });
 *
 * `pret` (facultatif) attend que la page ait rendu sa liste après le
 * rechargement. `TBF_CAPTURES=<dossier>` photographie la page à 1 366 px.
 */
import path from 'node:path';

export async function controlerLarge(page, check, { nom, liste, pret, minimum = 2 }) {
  const avant = page.viewport();
  const mesure = () => page.evaluate((sel) => {
    const col = (document.querySelector('body>#app') ?? document.querySelector('body>main'))
      .getBoundingClientRect();
    const gauches = new Set(sel ? [...document.querySelectorAll(sel)]
      .map((e) => e.getBoundingClientRect()).filter((b) => b.width > 0)
      .map((b) => Math.round(b.left)) : []);
    const rails = [...document.querySelectorAll('.tbf-rails .tbf-case')]
      .map((a) => a.getBoundingClientRect()).filter((b) => b.width > 0);
    return {
      large: document.body.classList.contains('tbf-large'),
      col: { l: col.left, r: col.right, w: col.width },
      colonnes: gauches.size,
      deborde: document.documentElement.scrollWidth > window.innerWidth,
      rails: rails.map((b) => [b.left, b.right]),
    };
  }, liste ?? null);

  await page.setViewport({ width: 1366, height: 682 });
  await page.reload({ waitUntil: 'networkidle0' });
  if (pret) await pret();
  await new Promise((r) => setTimeout(r, 300));
  const g = await mesure();
  if (process.env.TBF_CAPTURES) {
    await page.screenshot({ path: path.join(process.env.TBF_CAPTURES, `${nom.replace(/\W+/g, '-')}.png`) });
  }
  check(`à 1 366 px, ${nom} s’élargit au-delà des 900 px`,
    g.large && g.col.w > 1000 || (console.log('        colonne :', g.col, '· large :', g.large), false));
  check('rien ne déborde de l’écran', !g.deborde);
  check('les dix tuiles bordent la colonne élargie sans la toucher',
    g.rails.length === 10
    && g.rails.slice(0, 5).every(([, r]) => r <= g.col.l)
    && g.rails.slice(5).every(([l]) => l >= g.col.r)
    && g.rails.every(([l, r]) => l >= 0 && r <= 1366)
    || (console.log('        colonne :', g.col, '· rails :', g.rails), false));
  if (liste) {
    check(`la liste s’étale sur ${minimum} colonnes (${g.colonnes})`, g.colonnes >= minimum);
  }

  await page.setViewport({ width: 1100, height: 800 });
  await new Promise((r) => setTimeout(r, 200));
  const e = await mesure();
  check('à 1 100 px, une seule colonne, sans tuiles',
    e.col.w <= 900 && e.rails.length === 0 && (!liste || e.colonnes <= 1)
    || (console.log('        colonne :', e.col, '· colonnes :', e.colonnes, '· rails :', e.rails.length), false));
  if (avant) await page.setViewport(avant);
}
