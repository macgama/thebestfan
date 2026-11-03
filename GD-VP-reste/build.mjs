// Prompts de ce qui manque encore aux séries GD et VP (fil « Préparer les fiches et prompts GD et VP », 2026-11-03).
// Entrées : SRC = copie de la branche orpheline series-prompts (GD-skins, VP-skins, skins-*.tsv),
//           INDEX = public/img/fanzzy/index.json de main, REFAIRE = skins-a-refaire.tsv de gd-sources,
//           ULT = /mnt/project-files/fanzzy-prompts/ULT-generation (prompts/<ID>-ult-e<âge>.txt).
// Sorties dans ce dossier :
//   skins-a-refaire/  : chaque planche de skin manquante en DEUX demi-planches 16:9 de 3 figures (A, B), liste.tsv
//   ultimate-skins/   : Ultimate en Halloween, Préhistorique, Apocalyptique de GD et VP (840), liste.tsv
//   clips-vp/         : prompts des 140 clips Ultimate VP (Veo 3.1 Lite I2V, 4 s, 9:16), liste.tsv
// node build.mjs <SRC> <INDEX> <REFAIRE>
import fs from 'fs';
const [SRC, INDEX, REFAIRE] = process.argv.slice(2);
const OUT = new URL('.', import.meta.url).pathname;
const ULT = '/mnt/project-files/fanzzy-prompts/ULT-generation/';
const SKINS = ['halloween', 'prehistorique', 'apocalyptique'];
const index = JSON.parse(fs.readFileSync(INDEX, 'utf8')).fanzzy;
const raisonsGD = Object.fromEntries(fs.readFileSync(REFAIRE, 'utf8').split('\n').filter((l) => l && !l.startsWith('#')).map((l) => l.split('\t')));
const dessine = (id, k, skin) => !!index[id]?.evolutions?.['e' + k]?.skins?.[skin];
const tsv = (f) => fs.readFileSync(f, 'utf8').trim().split('\n').slice(1).map((l) => l.split('\t'));
const ecrire = (dir, nom, txt) => { fs.mkdirSync(OUT + dir, { recursive: true }); fs.writeFileSync(OUT + dir + '/' + nom, txt); };

// 1. Skins à refaire, en demi-planches (3 figures par image : plus facile pour le modèle que 6, net en 2K gratuit).
const SIX = /Exactly six \(IT'S VERY IMPORTANT, EXACTLY SIX FULL-BODY FIGURES\)[\s\S]*?6\. rest with eyes closed: exactly the same as figure 1, eyes closed\./;
const sixTrouve = (t) => SIX.test(t) && /\n\nWide 3:2 image\./.test(t);
const TROIS = (poses) => `Exactly three (IT'S VERY IMPORTANT, EXACTLY THREE FULL-BODY FIGURES) full-body figures, no more, no less, side by side in one single row, each figure centred in its own third of the image width. Head to toe, front view, all three figures exactly the same size: same scale, same height, same head size, feet on the same line, wide empty background gaps between the figures, nothing touching, nothing cut by the edges. The same character three times, never a smaller or bigger copy, never a second character.
Every figure stays compact and narrow, hardly wider than the rest pose: arms raised straight up or bent close to the body, never stretched out to the sides. VERY IMPORTANT: no figure is wider than the rest pose; capes, coats, scarves and costume pieces hang straight down close to the body, nothing sticks out sideways.
One head per figure, no motion blur, no double image.
Left to right: ${poses}`;
const POSES_A = (q) => `1. rest: in ${q} rest pose, calm, eyes open, mouth closed, ${q} signature item carried on ${q === 'its' ? 'it' : q === 'her' ? 'her' : 'him'}. 2. joy: bouncing up with both arms raised straight up above ${q === 'its' ? 'its' : q} head, mouth wide open in a shout of joy, ${q} signature item still carried on ${q === 'its' ? 'it' : q === 'her' ? 'her' : 'him'}. 3. dismay: shoulders dropped, head down, one arm over ${q} face, ${q} signature item still carried on ${q === 'its' ? 'it' : q === 'her' ? 'her' : 'him'}.`;
const POSES_B = (q) => `1. pushing the chant: singing with ${q} mouth wide open, pushing the chant with ${q} own signature item from the reference (raising it, shouting into it or playing it hard, close to ${q === 'its' ? 'its' : q === 'her' ? 'her' : 'his'} body). 2. anger: leaning forward, protesting, one arm bent pointing forward towards the viewer, elbow tucked against ${q === 'its' ? 'its' : q === 'her' ? 'her' : 'his'} body, ${q} signature item still carried on ${q === 'its' ? 'it' : q === 'her' ? 'her' : 'him'}. 3. rest with eyes closed: standing calm, exactly like the rest pose, eyes closed, mouth closed.`;
const possessif = (t) => (/\bHis signature item\b/.test(t) ? 'his' : /\bHer signature item\b/.test(t) ? 'her' : 'its');
const lignesSkins = ['cle\tdemi\tfichier\treference\tfond\traison'];
let nbSkins = 0, sansBase = [];
for (const S of ['GD', 'VP']) {
  for (const [, fichier, id, age, skin, ref, fond] of tsv(`${SRC}/skins-${S}.tsv`)) {
    if (dessine(id, age, skin)) continue;
    const cle = `${id}-e${age}-${skin}`;
    if (!dessine(id, age, 'base')) { sansBase.push(cle); continue; }
    let t = fs.readFileSync(`${SRC}/${S}-skins/${fichier}`, 'utf8');
    if (!sixTrouve(t)) throw new Error('bloc six figures introuvable : ' + fichier);
    const q = possessif(t);
    t = t.replace('ALL six figures', 'ALL three figures').replace('in all six figures', 'in all three figures');
    for (const [demi, poses] of [['A', POSES_A(q)], ['B', POSES_B(q)]]) {
      const u = t.replace(SIX, TROIS(poses)).replace(/\n\nWide 3:2 image\./, '\n\nWide 16:9 image, one row.');
      const nom = `${id}-e${age}-${skin}-planche-${demi}.txt`;
      ecrire('skins-a-refaire', nom, u);
      lignesSkins.push(`${cle}\t${demi}\t${nom}\t${ref}\t${fond}\t${S === 'GD' ? (raisonsGD[cle] || 'absente du jeu') : 'absente du jeu (relance en attente au 2026-11-02)'}`);
    }
    nbSkins++;
  }
}
ecrire('skins-a-refaire', 'liste.tsv', lignesSkins.join('\n') + '\n');

// 2. Ultimate en skin : même recette que ULT-generation/build-skins.mjs (fond transposé dans l'ambiance du skin).
const AMBIANCE = {
  halloween: { nom: 'Halloween', decor: "on Halloween night: a huge full moon low in the sky, carved jack-o'-lanterns glowing orange along every step, purple and orange floodlights, wisps of mist rolling over the stand, bats flying across the moon, cobwebs on the railings, the supporters behind wearing playful Halloween costumes (witch hats, devil horns, pumpkin masks). Playful and spooky-fun, not horror" },
  prehistorique: { nom: 'prehistoric', decor: 'in the stone age: the stand carved into a rocky cliff, wooden poles and stretched hides as banners, torches and bonfires burning on the steps, a volcano smoking in the distance, mammoths silhouetted on the horizon, the supporters behind dressed in furs and hides' },
  apocalyptique: { nom: 'post-apocalyptic', decor: 'into a Mad Max style desert wasteland after the end of the world: the stand rebuilt from scrap metal, wrecked cars and stacked tyres, rusty floodlight towers, dust and sand blowing, an orange sun haze, flaming oil drums on the steps, spiked rusty war-rig trucks parked behind the stand, the supporters behind in dusty road-warrior gear with goggles and scarves. Wild and fun, never grim: no weapons, no skulls, no blood anywhere' },
};
const ults = fs.readdirSync(ULT + 'prompts').filter((f) => /^(GD|VP)\d+-ult-e[123]\.txt$/.test(f))
  .sort((a, b) => { const x = /^(..)(\d+)-ult-e(\d)/.exec(a), y = /^(..)(\d+)-ult-e(\d)/.exec(b); return x[1].localeCompare(y[1]) || x[2] - y[2] || x[3] - y[3]; });
const lignesUlt = ['cle\tfichier\treference\tskin_dans_le_jeu'];
let pretes = 0;
for (const skin of SKINS) {
  const A = AMBIANCE[skin];
  for (const f of ults) {
    const [, id, k] = /^([A-Z]{2}\d+)-ult-e(\d)/.exec(f);
    let t = fs.readFileSync(ULT + 'prompts/' + f, 'utf8');
    t = t.replace('same face, same body proportions, same outfit,', `same face, same body proportions, same ${A.nom} costume (every piece of it, exactly as on the reference),`);
    t = t.replace(/Background, unique to this character: (.*?)\. It is still a football stand/s, (m, d) => `Background, unique to this character: ${d}, the whole scene transposed ${A.decor}. It is still a football stand`);
    if (!t.includes('the whole scene transposed ') || !t.includes(`same ${A.nom} costume`)) throw new Error('prompt Ultimate non transformé : ' + f);
    t = t.replace(/\n\nVertical 9:16/, `\n\nVERY IMPORTANT: the character wears the ${A.nom} costume of the reference, not the plain outfit; the background is clearly ${A.nom}-themed.\n\nVertical 9:16`);
    const cle = `${id}-e${k}-${skin}`;
    ecrire('ultimate-skins/' + skin, cle + '.txt', t);
    const ok = dessine(id, k, skin);
    pretes += ok;
    lignesUlt.push(`${cle}\t${skin}/${cle}.txt\tpublic/img/fanzzy/${id}/e${k}/${skin}/neutre.png\t${ok ? 'oui' : 'non : attendre le skin'}`);
  }
}
ecrire('ultimate-skins', 'liste.tsv', lignesUlt.join('\n') + '\n');

// 3. Clips Ultimate VP : modèle de ULT-generation/clips/LISEZMOI.md (celui des RP, AN et GD), ligne d'âge remplacée.
const AGE = {
  1: 'a wave of light and sound bursts from the crowd behind the character',
  2: 'the aura explodes outward as a blazing shockwave of light in its colour (the aura colour of the image)',
  3: 'a colossal pillar of light in the aura colour of the image erupts into the night sky and a circular shockwave rips across the whole stand',
  L: 'an immense, almost godlike surge of light rises around the character and the sky tears open above the stadium',
};
const vp = ults.filter((f) => f.startsWith('VP'));
const aTroisAges = new Set(vp.filter((f) => /-ult-e2/.test(f)).map((f) => f.split('-')[0]));
const lignesClips = ['cle\tfichier\timage_entree'];
for (const f of vp) {
  const [, id, k] = /^([A-Z]{2}\d+)-ult-e(\d)/.exec(f);
  const ligne = aTroisAges.has(id) ? AGE[k] : AGE.L;
  const t = `Animate this exact image as a 4-second ultimate move. Keep the character exactly as in the image: same face, body proportions, outfit, signature item and colours. Never add objects, limbs, text, letters or logos. Stylised 3D animated-film look, cinematic lighting, the background stays the same place.
The character keeps the signature item firmly in hand from the first frame to the last: it never drops, floats away, disappears or changes shape.
0 to 1 second: the character gathers breath in a slight crouch, the light behind dims and builds, the crowd holds still.
At about 1 second, the release: the character lunges toward the camera with a huge roar and pushes the chant with the signature item; ${ligne}; the camera makes one quick punch-in, then a slow push-in.
1 to 4 seconds: the crowd behind roars and waves scarves, confetti and light particles fly, hair and clothes blow in the blast, the character holds the powerful pose. Smooth motion, stable identity, no cuts.
`;
  const cle = `${id}-e${k}`;
  ecrire('clips-vp', cle + '.txt', t);
  lignesClips.push(`${cle}\t${cle}.txt\tart/ultime/_src/${cle}.png`);
}
ecrire('clips-vp', 'liste.tsv', lignesClips.join('\n') + '\n');

console.log(JSON.stringify({ skinsARefaire: nbSkins, demiPlanches: nbSkins * 2, sansBase, ultimateSkins: ults.length * 3, ultimateSkinsPretes: pretes, clipsVP: vp.length }, null, 1));
