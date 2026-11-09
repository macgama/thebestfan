// Images Ultimate d'une série hors championnat (GD, VP…) : même recette que build-su.mjs,
// fonds dans decors-<série>.json (3 par lignée, 1 par légendaire), référence = carte de l'âge.
// node build-series.mjs GD  -> prompts/<ID>-ult-e<âge>.txt + liste-ult-<SÉRIE>.tsv
import fs from 'fs';
const DIR = '/mnt/project-files/fanzzy-prompts/';
const met = fs.readFileSync(DIR + '00-METHODE.md', 'utf8');
const bloc = (after) => { const i = met.indexOf(after); const s = met.indexOf('```\n', i) + 4; return met.slice(s, met.indexOf('\n```', s)).trim(); };
const STYLE = bloc('### 2. STYLE');
const INTERDITS = bloc('### 8. INTERDITS');
const DECORS = JSON.parse(fs.readFileSync(DIR + 'ULT-generation/decors-' + process.argv[2].toLowerCase() + '.json', 'utf8'));

const INTENSITE = {
  1: 'Level 1 ultimate: an ordinary supporter giving absolutely everything for one moment. No magic aura on the body; the power comes from the crowd: a huge wave of light and sound bursting behind the character from the stand, confetti and torn paper flying, scarves raised in a sea behind.',
  2: 'Level 2 ultimate: the power-up unleashed. The aura of the reference explodes outward into a blazing shockwave of light in its colour, cracks of energy on the concrete steps, wind whipping the clothes, the scarf and the signature item.',
  L: 'Legendary ultimate: the myth itself awakening. An immense, almost godlike surge of light around the character, the night sky torn open above the stadium, the whole stand bathed in its glow, every supporter turned toward it.',
  3: 'Level 3 ultimate: the legendary finishing blow. A colossal pillar of light in the aura colour of the reference erupting from the character into the night sky, a circular shockwave ripping across the whole stand, floodlights bursting, the entire crowd behind lit up and roaring.',
};
const aura = () => ' Aura colour: the aura colour of the reference; never green and never gold.';

function prompt(id, k) {
  return [
    `Same character as the reference image, exactly: same face, same body proportions, same outfit, same signature item and same colours. This is the character's ULTIMATE: the single most powerful moment of this football supporter, the finishing chant that wins the match.`,
    STYLE + ' Epic key-art composition, cinematic contrast.',
    (DECORS[id].length === 1 ? INTENSITE.L : INTENSITE[k] + (k > 1 ? aura(id) : '')),
    `Dynamic hero pose in three-quarter view, low camera angle, the character lunging toward the viewer, mouth wide open in a huge roar, pushing the chant with the signature item from the reference (raising it, shouting into it or playing it hard). Strong speed lines and motion streaks converging on the character. Correct anatomy, exactly as on the reference: no extra or duplicated limbs, hands, heads, wings or tails. Only the objects the character carries on the reference: never add an instrument, scarf, flag or prop that is not on the reference.`,
    `Background, unique to this character: ${DECORS[id][k - 1]}. It is still a football stand packed with supporters, seen behind the character, slightly blurred, with light rays; no pitch markings, no goals, no players.`,
    `Vertical 9:16 image, full bleed. The character is large, from head to knees or head to toe, filling about two thirds of the frame height, head well inside the top of the frame.`,
    INTERDITS + ', no crests or badges of real clubs on the scarves or banners in the background, no national flags or coats of arms',
  ].join('\n\n');
}

const SERIE = process.argv[2];
const ids = Object.keys(DECORS).filter((k) => k !== '_note');
const out = DIR + 'ULT-generation/prompts/'; fs.mkdirSync(out, { recursive: true });
const liste = ['prompt\tfichier\treference'];
let n = 0;
for (const id of ids) for (let k = 1; k <= DECORS[id].length; k++) {
  const nom = `${id}-ult-e${k}`;
  fs.writeFileSync(out + nom + '.txt', prompt(id, k)); n++;
  liste.push([nom, nom, id + ['', 'B', 'C'][k - 1] + '.png'].join('\t'));
}
fs.writeFileSync(DIR + 'ULT-generation/liste-ult-' + SERIE + '.tsv', liste.join('\n') + '\n');
console.log(n, 'prompts');
