/**
 * Les images Ultimate qui existent, lues dans `public/img/ultime/`.
 *
 * L'étal ne vend une carte Ultimate que si sa grande scène a son image (choix
 * de Gaël du 28 octobre 2026) : payer 300 écharpes pour la scène dessinée de
 * secours serait payer pour rien. La page a sa table (`public/ultime.js`,
 * réécrite par `npm run ultime:images`) ; le serveur lit le dossier même, une
 * fois, au premier appel. Un fichier s'appelle `<lignée>-e<âge>.<empreinte>.webp`.
 */
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DOSSIER = fileURLToPath(new URL('../../../public/img/ultime/', import.meta.url));

let fichiers = null;

function lire() {
  if (fichiers) return fichiers;
  fichiers = new Map();
  let noms = [];
  try { noms = readdirSync(DOSSIER); } catch { /* pas de dossier : rien à vendre */ }
  for (const n of noms) {
    const m = /^([A-Z]{2}\d+)-e([123])\.[^.]+\.webp$/.exec(n);
    if (m) fichiers.set(`${m[1]}-e${m[2]}`, n);
  }
  return fichiers;
}

/**
 * L'adresse de l'image Ultimate d'une lignée à un âge, ou `null`. Une lignée
 * à un seul âge (une légendaire) prête sa seule image à tous ses âges, comme
 * la page (`chercher` dans `public/ultime.js`).
 */
export function imageUltime(racine, age) {
  const t = lire();
  const seule = !t.has(`${racine}-e2`) && !t.has(`${racine}-e3`);
  const f = t.get(`${racine}-e${age}`) ?? (seule ? t.get(`${racine}-e1`) : null);
  return f ? `/img/ultime/${f}` : null;
}
