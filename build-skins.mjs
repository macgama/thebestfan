// Images Ultimate en skin (Halloween d'abord ; Préhistorique et Apocalyptique prêts) des séries RP et AN.
// Part du prompt de base de chaque Ultimate (prompts/<ID>-ult-e<âge>.txt, 281 fichiers) :
// même pose, même intensité, même idée de fond tirée de l'histoire du Fanzzy, mais
// - la tenue est celle du skin (référence : public/img/fanzzy/<ID>/e<âge>/<skin>/neutre.png) ;
// - le fond est transposé dans l'ambiance du skin (consigne de Gaël du 2026-10-29).
// node build-skins.mjs [halloween] [RP4 AN1 …]  -> skins/<skin>/<ID>-ult-e<âge>-<skin>.txt + skins/<skin>/liste.tsv
import fs from 'fs';
const DIR = '/mnt/project-files/fanzzy-prompts/ULT-generation/';
const AMBIANCE = {
  halloween: {
    nom: 'Halloween',
    decor: 'on Halloween night: a huge full moon low in the sky, carved jack-o\'-lanterns glowing orange along every step, purple and orange floodlights, wisps of mist rolling over the stand, bats flying across the moon, cobwebs on the railings, the supporters behind wearing playful Halloween costumes (witch hats, devil horns, pumpkin masks). Playful and spooky-fun, not horror',
  },
  prehistorique: {
    nom: 'prehistoric',
    decor: 'in the stone age: the stand carved into a rocky cliff, wooden poles and stretched hides as banners, torches and bonfires burning on the steps, a volcano smoking in the distance, mammoths silhouetted on the horizon, the supporters behind dressed in furs and hides',
  },
  apocalyptique: {
    nom: 'post-apocalyptic',
    decor: 'into a Mad Max style desert wasteland after the end of the world: the stand rebuilt from scrap metal, wrecked cars and stacked tyres, rusty floodlight towers, dust and sand blowing, an orange sun haze, flaming oil drums on the steps, spiked rusty war-rig trucks parked behind the stand, the supporters behind in dusty road-warrior gear with goggles and scarves. Wild and fun, never grim: no weapons, no skulls, no blood anywhere',
  },
};
const args = process.argv.slice(2);
const skin = AMBIANCE[args[0]] ? args.shift() : 'halloween';
const A = AMBIANCE[skin];
const tous = fs.readdirSync(DIR + 'prompts').filter((f) => /^[A-Z]{2}\d+-ult-e[123]\.txt$/.test(f));
const num = (f) => { const m = /^([A-Z]{2})(\d+)-ult-e(\d)/.exec(f); return [m[1] === 'RP' ? 0 : 1, +m[2], +m[3]]; };
tous.sort((a, b) => { const x = num(a), y = num(b); return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]; });
const choisis = args.length ? tous.filter((f) => args.includes(f.split('-')[0])) : tous;
const out = DIR + 'skins/' + skin + '/'; fs.mkdirSync(out, { recursive: true });
const liste = ['cle\tprompt\treference'];
for (const f of choisis) {
  let t = fs.readFileSync(DIR + 'prompts/' + f, 'utf8');
  const [, id, k] = /^([A-Z]{2}\d+)-ult-e(\d)/.exec(f);
  t = t.replace('same face, same body proportions, same outfit,',
    `same face, same body proportions, same ${A.nom} costume (every piece of it, exactly as on the reference),`);
  t = t.replace(/Background, unique to this character: (.*?)\. It is still a football stand/s,
    (m, d) => `Background, unique to this character: ${d}, the whole scene transposed ${A.decor}. It is still a football stand`);
  if (!t.includes('the whole scene transposed ')) throw new Error('fond non trouvé : ' + f);
  t = t.replace(/\n\nVertical 9:16/, `\n\nVERY IMPORTANT: the character wears the ${A.nom} costume of the reference, not the plain outfit; the background is clearly ${A.nom}-themed.\n\nVertical 9:16`);
  const cle = `${id}-e${k}-${skin}`;
  fs.writeFileSync(out + `${cle}.txt`, t);
  liste.push(`${cle}\t${cle}.txt\tpublic/img/fanzzy/${id}/e${k}/${skin}/neutre.png`);
}
fs.writeFileSync(out + 'liste.tsv', liste.join('\n') + '\n');
console.log(choisis.length, 'prompts', skin);
