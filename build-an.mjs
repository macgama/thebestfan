// Images Ultimate de la série AN « Les Terraces » : même recette que build.mjs (RP),
// fonds dans decors-an.json, référence = carte de l'âge (art/neuves/AN<n>{,B,C}.png).
// node build-an.mjs [AN1 AN2 …]  -> prompts/<ID>-ult-e<âge>.txt
import fs from 'fs';
const DIR = '/mnt/project-files/fanzzy-prompts/';
const met = fs.readFileSync(DIR + '00-METHODE.md', 'utf8');
const bloc = (after) => { const i = met.indexOf(after); const s = met.indexOf('```\n', i) + 4; return met.slice(s, met.indexOf('\n```', s)).trim(); };
const STYLE = bloc('### 2. STYLE');
const INTERDITS = bloc('### 8. INTERDITS');
const DECORS = JSON.parse(fs.readFileSync(DIR + 'ULT-generation/decors-an.json', 'utf8'));

const INTENSITE = {
  1: 'Level 1 ultimate: an ordinary supporter giving absolutely everything for one moment. No magic aura on the body; the power comes from the crowd: a huge wave of light and sound bursting behind the character from the stand, confetti and torn paper flying, scarves raised in a sea behind.',
  2: 'Level 2 ultimate: the power-up unleashed. The aura of the reference explodes outward into a blazing shockwave of light in its colour, cracks of energy on the concrete steps, wind whipping the clothes, the scarf and the signature item.',
  3: 'Level 3 ultimate: the legendary finishing blow. A colossal pillar of light in the aura colour of the reference erupting from the character into the night sky, a circular shockwave ripping across the whole stand, floodlights bursting, the entire crowd behind lit up and roaring.',
};
const AURA = ' Aura colour: the main colour of the outfit, as on the reference; never green and never gold.';

function prompt(id, k) {
  return [
    `Same character as the reference image, exactly: same face, same body proportions, same outfit, same knitted supporter's scarf and badge, same signature item and same colours. This is the character's ULTIMATE: the single most powerful moment of this football supporter, the finishing chant that wins the match.`,
    STYLE + ' Epic key-art composition, cinematic contrast.',
    INTENSITE[k] + (k > 1 ? AURA : ''),
    `Dynamic hero pose in three-quarter view, low camera angle, the character lunging toward the viewer, mouth wide open in a huge roar, pushing the chant with the signature item from the reference (raising it, shouting into it or playing it hard). Strong speed lines and motion streaks converging on the character. Correct anatomy, exactly as on the reference: no extra or duplicated limbs, hands, heads, wings or tails. Only the objects the character carries on the reference: never add an instrument, scarf, flag or prop that is not on the reference.`,
    `Background, unique to this character: ${DECORS[id][k - 1]}. It is still a football stand packed with supporters, seen behind the character, slightly blurred, with light rays; no pitch markings, no goals, no players.`,
    `Vertical 9:16 image, full bleed. The character is large, from head to knees or head to toe, filling about two thirds of the frame height, head well inside the top of the frame.`,
    INTERDITS + ', no crests or badges of real clubs on the scarves or banners in the background',
  ].join('\n\n');
}

const ids = process.argv.slice(2).length ? process.argv.slice(2) : Array.from({ length: 60 }, (_, i) => `AN${i + 1}`);
const out = DIR + 'ULT-generation/prompts/'; fs.mkdirSync(out, { recursive: true });
let n = 0;
for (const id of ids) for (const k of [1, 2, 3]) { fs.writeFileSync(out + `${id}-ult-e${k}.txt`, prompt(id, k)); n++; }
console.log(n, 'prompts');
