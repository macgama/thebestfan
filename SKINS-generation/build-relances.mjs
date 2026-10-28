// Relances des skins restés sans planche (2026-10-28) : la planche de six figures sortait
// avec 7 à 10 figures ou des figures collées. On repasse à deux demi-planches 16:9 de
// trois figures (A : repos, joie, dépit ; B : pousse, colère, yeux fermés), qui sortaient
// toujours avec trois figures à l'essai RP3. Le reste du prompt est celui de la planche.
// node build-relances.mjs  -> prompts/relances/<ID>-e<âge>-<skin>-planche-<A|B>.txt
import fs from 'fs';
const DIR = '/mnt/project-files/fanzzy-prompts/SKINS-generation/';
const out = DIR + 'prompts/relances/'; fs.mkdirSync(out, { recursive: true });
const SIX = /Exactly six \(IT'S VERY IMPORTANT[\s\S]*?nothing cut by the edges\./;
const TROIS = "Exactly three full-body figures, no more, no less (VERY IMPORTANT: exactly three separate characters), side by side in one single row, each figure centred in its own third of the image width. Head to toe, front view, same scale and same height in every figure, feet on the same line, wide empty background gaps between the figures, nothing touching, nothing overlapping, nothing cut by the edges.";
const POSES = /Top row, left to right: ([\s\S]*?)\nBottom row, left to right: ([\s\S]*?)(\n|$)/;
let n = 0;
for (const l of fs.readFileSync(DIR + 'relances.txt', 'utf8').trim().split('\n')) {
  const [id, age, skin] = l.split(' ');
  let p = fs.readFileSync(`${DIR}prompts/${id}-e${age}-${skin}-planche.txt`, 'utf8');
  // AN5 âge 2 préhistorique : Artlist refusait le prompt sans message (modération,
  // probablement « bare arms » sur une jeune femme en peaux de bête).
  if (/\bShe never\b/.test(p) && skin === 'prehistorique')
    p = p.replace('rough brown leather and fur, bare arms,', 'rough brown leather and fur, a long-sleeved fur tunic that covers the body,')
      .replace(/(Her own costume: [^\n]*)/, '$1 Fully clothed, modest, family-friendly.');
  p = p.replace(SIX, TROIS).replace(/(all|ALL) six figures/g, '$1 three figures').replace('Wide 3:2 image.', 'Wide 16:9 image, one single row.');
  const m = p.match(POSES); if (!m) throw new Error(id + ' poses');
  const poseB = m[2].replace(/^4\. /, '1. ').replace(' 5. ', ' 2. ').replace(/ 6\. rest with eyes closed: exactly the same as figure 1, eyes closed\./, ' 3. rest with eyes closed: standing calm, arms by the sides, eyes closed, mouth closed, the signature item carried on the body.');
  for (const [L, poses] of [['A', m[1]], ['B', poseB]]) {
    fs.writeFileSync(`${out}${id}-e${age}-${skin}-planche-${L}.txt`, p.replace(POSES, `Left to right: ${poses}$3`));
    n++;
  }
}
console.log(n, 'demi-planches');
