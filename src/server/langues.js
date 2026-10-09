/**
 * Les langues, côté serveur.
 *
 * Presque tout se traduit dans la page (`public/langue.js`). Restent les
 * textes qui partent ailleurs que dans une page du jeu : le nom d'un article
 * sur la page de paiement de Stripe, une notification sur l'écran verrouillé.
 * Ceux-là, le serveur les traduit lui-même, avec les mêmes dictionnaires
 * (`i18n/<langue>.json`) et la même règle : le français est la clé, et un
 * texte sans traduction part en français.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = fileURLToPath(new URL('../..', import.meta.url));
export const LANGUES = ['fr', 'en', 'de', 'it', 'es'];

const norm = (s) => String(s)
  .replace(/[   ]/g, ' ')
  .replace(/'/g, '’')
  .replace(/\s+/g, ' ')
  .trim();

const dicos = new Map();
function dico(langue) {
  if (!dicos.has(langue)) {
    let exacts = new Map(), motifs = [];
    try {
      const brut = JSON.parse(readFileSync(path.join(RACINE, 'i18n', `${langue}.json`), 'utf8'));
      for (const [fr, tr] of Object.entries(brut)) {
        if (typeof tr !== 'string' || !tr) continue;
        if (/\{\d+\}/.test(fr)) {
          const ordre = [];
          const re = fr.split(/\{(\d+)\}/).map((m, i) => {
            if (i % 2) { ordre.push(Number(m)); return '([\\s\\S]*?)'; }
            return m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          }).join('');
          motifs.push({ re: new RegExp(`^${re}$`), ordre, tr, poids: fr.replace(/\{\d+\}/g, '').length });
        } else exacts.set(fr, tr);
      }
      motifs.sort((a, b) => b.poids - a.poids);
    } catch { /* pas de dictionnaire : tout reste en français */ }
    dicos.set(langue, { exacts, motifs });
  }
  return dicos.get(langue);
}

/** Le texte dans la langue demandée, ou tel quel. */
export function traduire(langue, texte) {
  if (texte == null || !LANGUES.includes(langue) || langue === 'fr') return texte;
  const { exacts, motifs } = dico(langue);
  const cle = norm(texte);
  const tr = exacts.get(cle);
  if (tr != null) return tr;
  for (const m of motifs) {
    const r = m.re.exec(cle);
    if (!r) continue;
    const v = [];
    m.ordre.forEach((n, k) => { v[n] = r[k + 1]; });
    return m.tr.replace(/\{(\d+)(?:\?([^|}]*)\|([^}]*))?\}/g, (_, i, un, plusieurs) => {
      const x = v[Number(i)] ?? '';
      if (un !== undefined) return /^\s*1\s*$/.test(x) ? un : plusieurs;
      return exacts.get(norm(x)) ?? x;
    });
  }
  return texte;
}
