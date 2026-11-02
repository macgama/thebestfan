// usage (dans le dépôt thebestfan du PC) : node recup.mjs liens.txt dossier_sortie
// liens.txt : "nom url" par ligne. Télécharge chaque image et l'écrit en JPEG 1024 px.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(path.resolve('package.json'));
const sharp = require('sharp');
const [liens, sortie] = process.argv.slice(2);
fs.mkdirSync(sortie, { recursive: true });
const lignes = fs.readFileSync(liens, 'utf8').split('\n').filter(Boolean);
let ok = 0, ko = [];
for (const l of lignes) {
  const [nom, url] = l.trim().split(/\s+/);
  const dest = path.join(sortie, nom + '.jpg');
  if (fs.existsSync(dest)) { ok++; continue; }
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const buf = Buffer.from(await r.arrayBuffer());
    await sharp(buf).resize(1024, 1024, { fit: 'inside' }).jpeg({ quality: 92 }).toFile(dest);
    ok++;
  } catch (e) { ko.push(nom + ' ' + e.message); }
}
console.log(`ok ${ok}/${lignes.length}`);
if (ko.length) console.log('échecs:\n' + ko.join('\n'));
