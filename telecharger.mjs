// node telecharger.mjs : télécharge chaque dessin dans action/<id>.png
import fs from 'node:fs';
const liens = JSON.parse(fs.readFileSync(new URL('./liens.json', import.meta.url)));
fs.mkdirSync(new URL('./action/', import.meta.url), { recursive: true });
let ok = 0;
for (const { id, url } of liens) {
  if (!url) { console.log('sans lien', id); continue; }
  const r = await fetch(url);
  if (!r.ok) { console.log('échec', id, r.status); continue; }
  fs.writeFileSync(new URL(`./action/${id}.png`, import.meta.url), Buffer.from(await r.arrayBuffer()));
  ok++;
}
console.log(ok, 'images');
