// Prompts des planches de skins (Halloween, Préhistorique, Apocalyptique) des séries RP et AN,
// en deux demi-planches 16:9 2K par âge et par skin (mode rapide Artlist, Nano Banana 2).
// node build.mjs  -> prompts/<ID>-e<âge>-<skin>-<A|B>.txt  +  liste.tsv (ordre de génération)
import fs from 'fs';
const DIR = '/mnt/project-files/fanzzy-prompts/';
const met = fs.readFileSync(DIR + '00-METHODE.md', 'utf8');
const bloc = (after) => { const i = met.indexOf(after); const s = met.indexOf('```\n', i) + 4; return met.slice(s, met.indexOf('\n```', s)).trim(); };
const STYLE = bloc('### 2. STYLE');
const INTERDITS = bloc('### 8. INTERDITS');
const SKIN = { halloween: bloc('Halloween :\n'), prehistorique: bloc('Préhistorique :\n'), apocalyptique: bloc('Apocalyptique (style') };
const SKIN_FR = { halloween: 'Halloween', prehistorique: 'Préhistorique', apocalyptique: 'Apocalyptique' };
const HEAD = [
  'Character sheet of the same character as the reference image, wearing the costume described below.',
  'Character sheet of the same character as both reference images (first: his look at this level, second: the same costume at his first level), wearing the costume described below at this level.',
];
const COMMON = 'With exactly his body proportions and face from the first reference: same build, same head size relative to the body, not chubbier, not more cartoonish. The costume described above replaces his usual clothes, identical in every figure; his signature item stays the same object in the same colour, held in every figure. Same aura colour as the reference, if he has any, pressed against the body in every figure.\nCorrect anatomy in every figure: exactly two arms, two legs, two hands with five fingers each, no extra or duplicated limbs.\nOnly his own signature item and the costume pieces described above: never add an instrument, scarf, flag or prop that is not described.\nExactly three full-body figures, no more, no less, side by side in one single row, each figure centred in its own third of the image width. Head to toe, front view, same scale and same height in every figure, feet on the same line, wide empty gaps between the figures, nothing touching, nothing cut by the edges.\nEvery figure stays compact and narrow, hardly wider than the rest pose: arms raised straight up or bent close to the body, never stretched out to the sides; capes and coats hang close to the body.\nOne head per figure, no motion blur, no double image.';
const PL = {
  A: 'Left to right: 1. rest: standing calm, arms by the sides, eyes open, mouth closed. 2. joy: jumping with both fists raised straight up above his head, mouth wide open in a shout of joy. 3. dismay: shoulders dropped, head down, one hand over his face.',
  B: 'Left to right: 1. pushing the chant: singing with his mouth wide open, pushing the chant with his own signature item (raising it, shouting into it or playing it hard, close to his body). 2. anger: leaning forward, protesting, one arm bent pointing forward towards the viewer, elbow close to his body. 3. rest with eyes closed: standing calm, arms by the sides, eyes closed, mouth closed.',
};
const FOND = 'Wide 16:9 image, one row. Background: a completely flat, uniform, saturated studio green (#00B140), the same colour everywhere, including between the figures. No gradient, no vignette, no floor, no cast shadow, no reflection, no smoke or particles around the characters, no green glow or green rim light on the characters. No borders, frames or labels.';
const EXTRA = 'No captions or name tags. No glowing symbols, runes or letter-like signs anywhere.';
const it = s => s.replace(/\bhimself\b/g,'itself').replace(/\bhis\b/g,'its').replace(/\bhim\b/g,'it').replace(/\bhe\b/g,'it').replace(/\bHis\b/g,'Its').replace(/\bHe\b/g,'It');
const she = s => s.replace(/\bhimself\b/g,'herself').replace(/\bhis\b/g,'her').replace(/\bhim\b/g,'her').replace(/\bhe\b/g,'she').replace(/\bHis\b/g,'Her').replace(/\bHe\b/g,'She');
const section = (md, id) => { const s = md.indexOf(`### ${id} ·`); if (s < 0) throw new Error(id); let e = md.indexOf('\n### ', s + 5); if (e < 0) e = md.length; return md.slice(s, e); };
const skins = (sec, id) => Object.fromEntries(Object.entries(SKIN_FR).map(([k, fr]) => {
  const m = sec.match(new RegExp('- ' + fr + ' : `([^`]*)`')); if (!m) throw new Error(id + ' skin ' + fr); return [k, m[1]]; }));

const fiches = [];
// Série RP : identités et thèmes v2 (RP-generation), skins de RP-la-reprise.md.
const rp = fs.readFileSync(DIR + 'RP-la-reprise.md', 'utf8');
const T2 = JSON.parse(fs.readFileSync(DIR + 'RP-generation/themes-v2.json', 'utf8'));
const I2 = JSON.parse(fs.readFileSync(DIR + 'RP-generation/identites-v2.json', 'utf8'));
for (const n of [3,4,5,6,7,8,9,10,11,12,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35]) {
  const id = 'RP' + n, sec = section(rp, id), head = sec.split('\n')[0];
  const id0 = sec.match(/IDENTITÉ: (.*)/)[1].trim();
  const a1 = sec.match(/- Âge 1 : `([^`]*)`/)[1];
  const [ident, habits] = I2[id];
  const g0 = /\b(Its|its)\b/.test(id0) && !/\b(His|his)\b/.test(id0) ? 'it' : (/\b(Her|her|She|she)\b/.test(id0) && !/\b(His|his)\b/.test(id0) ? 'she' : 'he');
  const g = n === 29 ? 'it' : g0;
  const pose = !!sec.match(/- Pose : `([^`]*)`/) || g === 'it' || n === 20;
  fiches.push({ id, serie: 'RP', ident, ages: [(habits ? habits + ' ' : '') + a1, T2[id][0], T2[id][1]], skins: skins(sec, id), g, nonHuman: pose, magenta: /fond magenta/.test(head) });
}
// Série AN : tout vient des deux fichiers de fiches.
const an = fs.readFileSync(DIR + 'AN-les-terraces.md', 'utf8') + '\n' + fs.readFileSync(DIR + 'AN-les-terraces-2.md', 'utf8');
for (let n = 1; n <= 60; n++) {
  const id = 'AN' + n, sec = section(an, id), head = sec.split('\n')[0];
  const ident = sec.match(/IDENTITÉ: (.*)/)[1].trim();
  const ages = [1,2,3].map(k => sec.match(new RegExp('- Âge ' + k + ' : `([^`]*)`'))[1]);
  const g = /\bShe never\b/.test(ident) ? 'she' : /\bHe never\b/.test(ident) ? 'he' : 'it';
  fiches.push({ id, serie: 'AN', ident, ages, skins: skins(sec, id), g, nonHuman: g === 'it' || /- Pose :/.test(sec), magenta: /fond magenta/.test(head) });
}

const out = DIR + 'SKINS-generation/prompts/'; fs.mkdirSync(out, { recursive: true });
const liste = ['ordre\tfichier\tid\tage\tskin\tdemi\treferences\tfond'];
let ordre = 0;
const fix = (f, s) => {
  if (f.nonHuman) s = s
    .replace(/Correct anatomy in every figure: exactly two arms, two legs, two hands with five fingers each, no extra or duplicated limbs\./g, 'Correct anatomy in every figure: no extra or duplicated limbs, wings, tails, wheels or heads.')
    .replace('standing calm, arms by the sides, eyes open, mouth closed', 'in his rest pose, calm, eyes open, mouth closed')
    .replace('standing calm, arms by the sides, eyes closed, mouth closed', 'in his rest pose, calm, eyes closed, mouth closed')
    .replace('jumping with both fists raised', 'bouncing up with both little arms raised')
    .replace('one hand over his face', 'one little arm over his face')
    .replace('one arm bent pointing forward', 'one little arm bent pointing forward');
  if (f.g === 'it') s = it(s); else if (f.g === 'she') s = she(s);
  if (f.magenta) s = s.replace(/ No weapons, no skulls, no blood, no green\./, ' No weapons, no skulls, no blood.').replace(/\(no green skin, no zombie\)/, '(no zombie)').replace(/studio green \(#00B140\)/g, 'studio magenta (#FF00FF)').replace(/no green glow or green rim light/g, 'no magenta glow or magenta rim light');
  else s = s.replace('no green glow or green rim light on the characters.', 'no green glow or green rim light on the characters, no green in the costume.');
  return s;
};
// Ordre : l'âge 1 de tous d'abord (tous les joueurs l'ont), puis l'âge 2, puis l'âge 3 ; RP avant AN.
for (let k = 0; k < 3; k++) for (const f of fiches) for (const sk of Object.keys(SKIN_FR)) for (const L of ['A', 'B']) {
  const p = [HEAD[k ? 1 : 0], STYLE, f.ident, 'Theme: ' + f.ages[k], SKIN[sk] + '\nHis own costume: ' + f.skins[sk], COMMON + '\n' + PL[L], FOND, EXTRA, INTERDITS].join('\n\n');
  const nom = `${f.id}-e${k+1}-${sk}-${L}`;
  fs.writeFileSync(out + nom + '.txt', fix(f, p));
  const carte = f.id + ['', 'B', 'C'][k] + '.png';
  const refs = k ? `${carte} + ${f.id}-e1-${sk}-planche-A.png` : carte;
  liste.push([++ordre, nom + '.txt', f.id, k + 1, sk, L, refs, f.magenta ? 'magenta' : 'vert'].join('\t'));
}
fs.writeFileSync(DIR + 'SKINS-generation/liste.tsv', liste.join('\n') + '\n');
console.log(fiches.length, 'Fanzzy,', ordre, 'demi-planches');
