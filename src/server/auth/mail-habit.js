/**
 * L'habit des mails : la même lettre, en HTML, aux couleurs du jeu.
 *
 * ## Le texte reste la source
 *
 * Chaque mail s'écrit en texte brut (`authMessages.js`), et c'est ce texte
 * qui part en `text`. L'HTML en est **tiré** : les paragraphes deviennent des
 * blocs, le lien devient un bouton, la signature devient le pied. Écrire deux
 * versions de chaque message, c'est les voir diverger au premier changement
 * d'une phrase.
 *
 * ## Ce qu'un client de messagerie accepte
 *
 * Des tableaux et des styles en ligne : Gmail retire les feuilles de style,
 * Outlook ignore flex et grid. Aucune police chargée, aucun script. Les deux
 * images (le logo, la tribune) sont servies par le site et portent un texte
 * de remplacement : beaucoup de messageries les bloquent jusqu'au premier
 * clic, et le mail doit se lire sans elles.
 */

const COULEURS = {
  fond: '#0F1216', carte: '#232930', craie: '#F2EEE4', gris: '#C2CAD6',
  projo: '#F5C33B', encre: '#07090C',
};

const esc = (s) => String(s ?? '').replace(/[<>&"']/g,
  (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * @param {object} o
 * @param {string} o.origin   L'adresse du site, pour les images et le pied.
 * @param {string} o.titre    Le titre du mail (l'objet, sans « — thebestfan »).
 * @param {string} o.texte    Le texte brut du mail.
 * @param {string} [o.lien]   L'adresse à transformer en bouton.
 * @param {string} [o.bouton] Le libellé du bouton.
 * @param {boolean} [o.tribune] La grande image de tribune en tête.
 * @param {string} [o.langue] La langue du mail ; `copie` et `pied`, ses deux lignes fixes.
 */
export function habiller({ origin, titre, texte, lien = null, bouton = null, tribune = false,
  langue = 'fr', copie = 'Le bouton ne marche pas ? Copie ce lien :', pied = 'le jeu des supporters' }) {
  const c = COULEURS;
  const blocs = String(texte).split(/\n{2,}/)
    .map((b) => b.split('\n').filter((l) => l.trim() && l.trim() !== lien).join('\n'))
    // La signature « thebestfan.online » devient le pied.
    .filter((b) => b.trim() && !/^thebestfan\.online$/i.test(b.trim()));

  const paragraphe = (b, i) => `<p style="margin:0 0 16px;font-size:${i === 0 ? 17 : 15}px;line-height:1.55;color:${
    i === 0 ? c.craie : c.gris};${i === 0 ? 'font-weight:bold;' : ''}">${esc(b).replace(/\n/g, '<br>')}</p>`;

  const bt = lien && bouton ? `
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px">
              <tr><td bgcolor="${c.projo}" style="border-radius:8px;border-bottom:4px solid #B98D17">
                <a href="${esc(lien)}" style="display:inline-block;padding:14px 26px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:${c.encre};text-decoration:none">${esc(bouton)}</a>
              </td></tr>
            </table>
            <p style="margin:0 0 16px;font-size:12px;line-height:1.5;color:${c.gris}">${esc(copie)}<br><a href="${esc(lien)}" style="color:${c.projo};word-break:break-all">${esc(lien)}</a></p>` : '';

  return `<!doctype html>
<html lang="${esc(langue)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark">
<title>${esc(titre)}</title></head>
<body style="margin:0;padding:0;background:${c.fond}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${c.fond}" style="background:${c.fond}">
  <tr><td align="center" style="padding:24px 12px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;font-family:Arial,Helvetica,sans-serif">
      <tr><td align="center" style="padding:0 0 18px">
        <a href="${esc(origin)}" style="text-decoration:none">
          <img src="${esc(origin)}/img/logo.png" width="72" height="72" alt="TheBestFan" style="display:block;border:0;margin:0 auto 8px">
          <span style="font-size:20px;font-weight:bold;letter-spacing:2px;color:${c.craie}">THEBEST<span style="color:${c.projo}">FAN</span></span>
        </a>
      </td></tr>
      <tr><td bgcolor="${c.carte}" style="background:${c.carte};border-radius:14px;border-top:6px solid ${c.projo};overflow:hidden">
        ${tribune ? `<img src="${esc(origin)}/img/hero.jpg" width="560" alt="" style="display:block;width:100%;max-width:560px;height:auto;border:0">` : ''}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="padding:26px 26px 10px">
            <h1 style="margin:0 0 18px;font-size:22px;line-height:1.25;letter-spacing:1px;text-transform:uppercase;color:${c.projo}">${esc(titre)}</h1>
            ${blocs.map(paragraphe).join('\n            ')}${bt}
          </td></tr>
        </table>
      </td></tr>
      <tr><td align="center" style="padding:18px 10px 0;font-size:12px;line-height:1.6;color:${c.gris}">
        <a href="${esc(origin)}" style="color:${c.gris};text-decoration:underline">thebestfan.online</a> · ${esc(pied)}
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}
