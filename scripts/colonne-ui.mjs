/**
 * Le contrôle commun de la colonne sur un ordinateur, partagé par les suites
 * UI des pages.
 *
 * Gaël, le 7 octobre 2026 : sur un ordinateur, « trop large, trop
 * d'informations ; je préfère un affichage style mobile », et « pour toutes
 * les pages, la même largeur ». La colonne fait donc 480 px au plus
 * (`--colonne`, ui.css, « La largeur de la colonne »), sur toutes les pages,
 * au milieu de l'écran, sans les tuiles de l'accueil autour.
 *
 * À 1 366 × 682 puis à 1 920 × 1 080 : la colonne fait 480 px, au milieu,
 * rien ne déborde, et aucune tuile ne la borde. La suite rend la page à la
 * taille où elle l'a trouvée.
 *
 *   await controlerColonne(page, check, { nom: 'la page des amis' });
 *
 * `pret` (facultatif) attend que la page ait rendu après le rechargement.
 * `TBF_CAPTURES=<dossier>` photographie la page à 1 366 px.
 */
import path from 'node:path';

export const COLONNE = 480;

export async function controlerColonne(page, check, { nom, pret }) {
  const avant = page.viewport();
  const mesure = () => page.evaluate(() => {
    const col = (document.querySelector('body>#app') ?? document.querySelector('body>main'))
      .getBoundingClientRect();
    const rails = [...document.querySelectorAll('.tbf-rails .tbf-case')]
      .filter((a) => a.getBoundingClientRect().width > 0);
    return {
      col: { l: col.left, r: col.right, w: col.width },
      milieu: document.documentElement.clientWidth / 2,
      deborde: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      rails: rails.length,
    };
  });

  let premiere = true;
  for (const [width, height] of [[1366, 682], [1920, 1080]]) {
    await page.setViewport({ width, height });
    await page.reload({ waitUntil: 'networkidle0' });
    if (pret) await pret();
    await new Promise((r) => setTimeout(r, 300));
    const g = await mesure();
    if (premiere && process.env.TBF_CAPTURES) {
      await page.screenshot({ path: path.join(process.env.TBF_CAPTURES, `${nom.replace(/\W+/g, '-')}.png`) });
    }
    premiere = false;
    check(`à ${width} px, ${nom} : la largeur du téléphone, au milieu, sans tuiles autour`,
      Math.abs(g.col.w - COLONNE) <= 1 && Math.abs((g.col.l + g.col.r) / 2 - g.milieu) <= 2
      && !g.deborde && g.rails === 0
      || (console.log('        ', g), false));
  }
  if (avant) await page.setViewport(avant);
}
