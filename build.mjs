// Prompts de la série SU (Die Kurve) : cartes des trois âges et demi-planches A/B de base.
// node build.mjs [de] [à]  → écrit prompts/SU<n>-e<k>.txt et SU<n>-pl-e<k>{A,B}.txt
import fs from 'fs';
const DIR = '/mnt/project-files/fanzzy-prompts/';
const md = fs.readFileSync(DIR + 'SU-die-kurve.md', 'utf8');
const out = DIR + 'SU-generation/prompts/';
fs.mkdirSync(out, { recursive: true });
const [from = 1, to = 36] = process.argv.slice(2).map(Number);

// Couleur d'aura par club (jamais verte ni dorée), dans l'ordre des clubs du fichier.
const AURA = {
  'FC Bâle': 'bright red', 'Grasshopper Club Zurich': 'deep blue', 'FC Lausanne-Sport': 'royal blue',
  'FC Lucerne': 'lake blue', 'FC Lugano': 'white', 'FC Saint-Gall': 'white', 'Servette FC': 'garnet red',
  'FC Sion': 'bright red', 'FC Thoune': 'bright red', 'FC Vaduz': 'bright red',
  'BSC Young Boys': 'lemon yellow (never gold)', 'FC Zurich': 'royal blue',
};

const STYLE = 'Stylised 3D animated-film rendering with a premium game-hero finish: slightly caricatured proportions, expressive face, a bold silhouette readable at thumbnail size, rich material detail on fabric, leather, fur, metal and paint, warm key light and a bright rim light.';
const NIV = {
  1: 'Level 1, common tier: an ordinary, everyday version of this character, normal build, simple everyday clothes or state, a little clumsy and endearing. The signature item is small and plain.',
  2: 'Level 2, rare tier: a dramatic power-up into the theme described below, unmistakable at first glance next to level 1. Much bigger and stronger: shoulders, chest and arms visibly broader, head smaller in proportion to the body, a heavier, more confident stance. Same face and same signature colours, now more determined, eyes with a fierce spark. Most of HIS everyday clothes are replaced by the theme below; only one or two recognisable pieces remain. The signature item is reinforced, same colour, with a few glowing details. A first aura of power: a soft glow in the main colour of HIS outfit clings tightly to the outline of HIS body and HIS signature item, with a coloured rim light of the same hue. The glow is never green and never gold, and stays pressed against the body: no floating particles, no light away from HIM.',
  3: 'Level 3, epic tier: the final form, a boss-level transformation fully into the theme described below, far beyond level 2. About twice as imposing as level 1: massive shoulders and chest, head small in proportion, a heroic silhouette with a strong shape that adds height (raised shoulder pieces, crest, headpiece or cape held close to the body). None of HIS level-1 everyday clothes remain, except one small recognisable detail. Same face as both references, only more powerful and charismatic: do not change the features, but HIS eyes now glow softly in HIS main colour. The signature item is huge and spectacular, same colour, radiating power from within. Glowing engraved lines and inner light run across HIS outfit. An intense aura of power in the main colour of HIS outfit hugs the whole outline of HIS body, much stronger than at level 2, with a bright coloured rim light. The aura is never green and never gold, and stays pressed against the body: no floating particles, no smoke, no light away from HIM. Spectacular, unique, unlike any other character.',
};
const DEBUT = {
  1: 'A new character for a football supporters\' card game.',
  2: 'Same character as the reference image, transformed into HIS next, much more powerful level.',
  3: 'Same character as both reference images (first: level 2, second: level 1), transformed into HIS final legendary champion form.',
};
const POSE_H = 'Standing tall facing the viewer, feet shoulder-width apart, arms by the sides with hands relaxed, proud determined expression, mouth closed. Correct anatomy in every figure: exactly two arms, two legs, two hands with five fingers each, no extra or duplicated limbs.';
const ANAT_H = 'Correct anatomy in every figure: exactly two arms, two legs, two hands with five fingers each, no extra or duplicated limbs.';
const ANAT_C = 'Correct anatomy in every figure: no extra or duplicated limbs, wings, fins, wheels or heads.';
const OBJ = 'Only the objects HE has on the reference: never add an instrument, scarf, flag or prop HE does not carry.';
const fond = (m, ratio) => `${ratio}. Background: a completely flat, uniform, saturated studio ${m ? 'magenta (#FF00FF)' : 'green (#00B140)'}, the exact same colour everywhere${ratio.startsWith('Wide') ? ', including between the figures' : ''}. No gradient, no vignette, no floor, no cast shadow, no reflection, no ground patch, no smoke or particles around the character, no ${m ? 'magenta' : 'green'} glow or ${m ? 'magenta' : 'green'} rim light on the character.${ratio.startsWith('Wide') ? ' No grid lines, no borders, no frames, no labels.' : ''}`;
const INTERDITS = 'no text, no letters, no numbers, no logos, no brand marks, no club crests, no team names, no sponsor logos, no identifiable jerseys, no real people. No captions or name tags. No glowing symbols, runes or letter-like signs anywhere.';

const sections = md.split(/\n(?=### SU\d+ ·)/).slice(1);
for (const sec0 of sections) {
  const sec = sec0.split(/\n---\n|\n## /)[0];
  const n = Number(sec.match(/^### SU(\d+)/)[1]);
  if (n < from || n > to) continue;
  const titre = sec.split('\n')[0];
  const club = sec.match(/club de référence : ([^)]+)\)/)[1];
  const aura = AURA[club];
  if (!aura) throw new Error('aura ' + club);
  const ident = sec.match(/IDENTITÉ: (.*)/)[1].trim();
  const ages = [1, 2, 3].map(k => sec.match(new RegExp('- Âge ' + k + ' : `([^`]*)`'))[1]);
  const poseC = (sec.match(/- Pose : `([^`]*)`/) || [])[1];
  const creature = !!poseC;
  const fem = /\bShe never\b/.test(ident);
  const m = /fond magenta/.test(titre);
  const pr = s => creature
    ? s.replace(/\bHIS\b/g, 'its').replace(/\bHIM\b/g, 'it').replace(/\bHE\b/g, 'it')
    : fem ? s.replace(/\bHIS\b/g, 'her').replace(/\bHIM\b/g, 'her').replace(/\bHE\b/g, 'she')
          : s.replace(/\bHIS\b/g, 'his').replace(/\bHIM\b/g, 'him').replace(/\bHE\b/g, 'he');
  const pose = creature ? `${poseC} ${ANAT_C}` : POSE_H;
  const auraTxt = k => (k === 1 ? '' : ` Aura colour: ${aura}.`);
  const carte = k => [pr(DEBUT[k]), STYLE, ident, pr(NIV[k]), `Theme: ${ages[k - 1]}${auraTxt(k)}`,
    `${pose}\n${pr(OBJ)}`, fond(m, 'Full body, head to toe, centred, the whole figure inside the frame with a small margin, 9:16'), INTERDITS].join('\n\n');
  const membre = creature ? 'arm, wing, paw, hoof or fin' : 'arm';
  const deux = creature ? 'both arms, wings, paws, hooves or fins' : 'both fists';
  const A = creature
    ? '1. rest: in its rest pose, calm, eyes open, mouth or beak closed. 2. joy: jumping with both arms, wings, paws, hooves or fins raised straight up above its head, mouth or beak wide open in a shout of joy. 3. dismay: shoulders dropped, head down, one arm, wing, paw, hoof or fin over its face.'
    : pr('1. rest: standing calm, arms by the sides, eyes open, mouth closed. 2. joy: jumping with both fists raised straight up above HIS head, mouth wide open in a shout of joy. 3. dismay: shoulders dropped, head down, one hand over HIS face.');
  const B = creature
    ? '1. pushing the chant: singing with its mouth or beak wide open, pushing the chant with its own signature item from the reference (raising it or shaking it hard, close to its body). 2. anger: leaning forward, protesting, one arm, wing, paw, hoof or fin bent pointing forward towards the viewer, close to its body. 3. rest with eyes closed: in its rest pose, calm, eyes closed, mouth or beak closed.'
    : pr('1. pushing the chant: singing with HIS mouth wide open, pushing the chant with HIS own signature item from the reference (raising it, shouting into it or playing it hard, close to HIS body). 2. anger: leaning forward, protesting, one arm bent pointing forward towards the viewer, elbow close to HIS body. 3. rest with eyes closed: standing calm, arms by the sides, eyes closed, mouth closed.');
  const planche = (k, ordre) => ['Character sheet of the same character as the reference image.', STYLE, ident,
    `${ages[k - 1]}${auraTxt(k)}`,
    [pr('With exactly HIS body proportions from the reference: same build, same head size relative to the body. Same outfit and same signature item, held in every figure. Same aura and glowing details as the reference, if HE has any, pressed against the body in every figure.'),
     creature ? ANAT_C : ANAT_H, pr(OBJ),
     'Exactly three full-body figures, no more, no less, side by side in one single row, each figure centred in its own third of the image width. Head to toe, front view, same scale and same height in every figure, feet on the same line, wide empty background gaps between the figures, nothing touching, nothing cut by the edges.',
     `Every figure stays compact and narrow, hardly wider than the rest pose: ${membre}s raised straight up or bent close to the body, never stretched out to the sides.`,
     'One head per figure, no motion blur, no double image.',
     `Left to right: ${ordre}`].join('\n'),
    fond(m, 'Wide 16:9 image, one row'), INTERDITS].join('\n\n');
  void deux;
  for (const k of [1, 2, 3]) {
    fs.writeFileSync(`${out}SU${n}-e${k}.txt`, carte(k));
    fs.writeFileSync(`${out}SU${n}-pl-e${k}A.txt`, planche(k, A));
    fs.writeFileSync(`${out}SU${n}-pl-e${k}B.txt`, planche(k, B));
  }
  console.log(`SU${n}`, creature ? 'créature' : fem ? 'F' : 'H', m ? 'MAGENTA' : '', '·', club, '· aura', aura);
}
