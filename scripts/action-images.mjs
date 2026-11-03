/**
 * Les illustrations des cartes d'action.
 *
 * Vingt et une cartes, un dessin chacune. Elles étaient des vignettes de sept
 * pixels de texte sur un rectangle coloré : on jouait « Parcage fermé » sans
 * jamais savoir à quoi ça ressemblait, et deux cartes de la même famille se
 * distinguaient à la lecture seule — en plein duel, c'est-à-dire jamais.
 *
 * ## Ce que fait ce script
 *
 * Il ne génère rien. Il **range** : il prend les dessins produits par Artlist,
 * déposés dans `art/action/<id>.png`, et en tire les trois formats que le jeu
 * sert — AVIF, WebP, JPEG — à la taille où ils s'affichent vraiment.
 *
 * Le format de secours est le JPEG et pas le PNG, contrairement aux Fanzzy :
 * eux sont découpés sur du vide et ont besoin d'un canal alpha, ces dessins-ci
 * remplissent leur cadre. Le même lot pesait treize mégaoctets en PNG et huit
 * cents kilo-octets en JPEG — pour une image que personne ne verra, puisque
 * l'AVIF et le WebP couvrent tout ce qui a moins de dix ans.
 *
 * La génération, elle, se fait à la main avec les invites de `INVITES` ci-
 * dessous. Elles sont ici et pas dans un carnet : le jour où une carte est
 * redessinée, c'est cette formulation-là qu'il faut reprendre, et une invite
 * perdue est un dessin qu'on ne sait plus refaire dans le même style.
 *
 * Usage :  node scripts/action-images.mjs
 *          node scripts/action-images.mjs --invites   (les imprime)
 */
import { readdir, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ACTIONS } from '../src/shared/duel/actions.js';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const SOURCE = path.join(RACINE, 'art', 'action');
const CIBLE = path.join(RACINE, 'public', 'img', 'action');

/**
 * La taille servie.
 *
 * La carte la plus grande du jeu — celle qui s'affiche quand on la joue —
 * fait deux cent quarante pixels de large sur un écran à deux fois la
 * densité : quatre cent quatre-vingts. On sert donc 480×640, et pas les mille
 * deux cents pixels que rend le générateur. Un dessin quatre fois trop grand
 * ne se voit pas ; il se télécharge.
 */
const LARGEUR = 480;
const HAUTEUR = 640;

/* Le style commun. Il est écrit une fois : vingt et une cartes dessinées
   chacune dans son coin ne font pas un jeu, elles font vingt et une images.

   Les interdits pèsent autant que le sujet. « Pas de cadre » surtout : le
   premier essai est revenu avec une bordure de carte dessinée dedans, alors
   que le jeu dessine la sienne — couleur de famille, gemme de coût, nom. Et
   « visages découverts » : sans cette ligne, le modèle met des cagoules à tout
   le monde, ce qui n'est pas le jeu qu'on fait. */
const STYLE = `Style: stylised 3D render, modern mobile game art, bold readable
silhouette, strong rim lighting, deep navy stadium night background, subject
centred and filling the frame.

Full-bleed illustration, edge to edge, NO card frame, NO border, NO decorative
corners, NO panel — the artwork must fill the entire image with no margin.

Strictly forbidden: any text, letters, numbers, logos, real club crests, card
borders or frames, masks, balaclavas, covered faces, watermark.`;

/** Le sujet de chaque carte, et la couleur d'accent de sa famille. */
export const INVITES = {
  'a-fumigene': ['red', 'a lit red smoke flare raised high in a packed terrace at night, '
    + 'thick crimson smoke curling upward, sparks, joyful supporters with open visible '
    + 'faces singing behind, striped scarves held overhead'],
  'a-craquage': ['red', 'an entire terrace erupting at once in a wall of red smoke and '
    + 'flame, dozens of flares lit together, embers filling the air, arms raised '
    + 'everywhere, overwhelming and slightly reckless'],
  'a-torche': ['red', 'a single burning torch held over the barrier by a supporter '
    + 'leaning forward, a trail of sparks behind it, the rest of the stand dark'],

  'a-silence': ['violet', 'a stadium gone suddenly silent, one supporter with a finger '
    + 'to his lips in the foreground, a dropped megaphone, violet light, fading sound '
    + 'ripples in the air, the crowd behind frozen mid-shout'],
  'a-brouillard': ['violet', 'thick violet fog rolling across a terrace, supporters '
    + 'reduced to soft silhouettes, floodlight beams cutting through the haze'],
  'a-parcage': ['violet', 'a closed and padlocked away-section gate seen from inside, '
    + 'heavy fencing, violet floodlight behind it, an empty caged stand'],

  'a-vol': ['blue', 'a swirling current of glowing blue breath being pulled out of a '
    + 'distant terrace and drawn toward the viewer, ribbons of air, supporters gasping'],
  'a-thermos': ['blue', 'a battered metal thermos flask pouring steaming tea into a cup, '
    + 'gloved hands, cold blue floodlight, breath visible in the freezing air'],
  'a-collecte': ['blue', 'a bucket passed hand to hand along a row of supporters in the '
    + 'stand, many reaching arms, blue light, coins and scarves'],

  'a-metronome': ['gold', 'a golden metronome standing on a big terrace drum, its arm '
    + 'mid-swing, glowing arcs marking the beat, drummers around it'],
  'a-vent': ['gold', 'a violent headwind blowing across a terrace, banners and scarves '
    + 'streaming sideways, one supporter leaning hard into the gust, golden dust'],
  'a-secondsouffle': ['gold', 'a supporter bent over catching his breath, then rising '
    + 'again, a warm golden glow blooming from his chest, the crowd lifting behind him'],

  'a-bache': ['silver', 'an enormous plain tarpaulin banner raised like a shield across '
    + 'the whole front of a terrace, many hands holding it up, silver-grey light'],
  'a-miroir': ['silver', 'a mirror-bright banner reflecting an incoming wave of light '
    + 'straight back out of the frame, silver sheen, supporters shielding their eyes'],

  'a-appel': ['green', 'a capo standing on a podium with his back to us, facing the '
    + 'terrace, megaphone raised high, the whole stand answering with raised arms, '
    + 'green light'],
  'a-mosaique': ['green', 'a tifo mosaic in progress, hundreds of coloured cards held up '
    + 'across a stand forming an abstract pattern, seen from the side, green accents'],
  'a-choeur': ['green', 'an entire terrace singing in unison, mouths open, heads back, '
    + 'arms around shoulders, green glow rising from the crowd'],

  'a-remontada': ['orange', 'the moment a terrace turns, supporters exploding out of '
    + 'their seats as the tide swings back, warm orange light breaking through the '
    + 'darkness above the stand'],
  'a-arbitre': ['orange', 'a glowing electronic substitution board held up at the '
    + 'touchline at night, blank amber panel with no digits, a fourth official '
    + 'silhouette, stadium lights behind'],
  'a-releve': ['orange', 'an older supporter draping his club scarf around the shoulders '
    + 'of a young one in the stand, both smiling, warm orange light, the crowd behind'],
  'a-prolongations': ['orange', 'floodlights blazing over a stadium deep into extra '
    + 'time, long shadows stretched across the terrace, a weary but still roaring crowd, '
    + 'orange night sky'],

  /* Les trois cartes du souffle et du temps. Elles ne montrent pas un objet
     mais un *moment* : on reprend une main, on retrouve son air, on déplie une
     bâche. Le dessin doit donc raconter le geste collectif, pas l'accessoire. */
  'a-relais': ['violet', 'a capo turning to face his terrace and starting a different '
    + 'song, arms wide, the crowd behind him picking it up, fresh energy passing '
    + 'through the rows, violet night light'],
  'a-souffleneuf': ['violet', 'a supporter filling his lungs at the front of a terrace, '
    + 'head tilted back, breath visible in the cold night air, the whole stand lifting '
    + 'again around him, radiant violet glow'],
  'a-tifo': ['red', 'a giant painted banner unfurling down the whole height of a terrace, '
    + 'hundreds of hands passing it over their heads, the crowd disappearing beneath it, '
    + 'red night stadium'],

  /* Les cinq de septembre 2026. Quatre d'entre elles agissent sur une chose
     qu'on ne voit pas — le temps qui passe, le prix d'une carte, un pari, une
     avance qui fond. Le sujet est donc chaque fois le **geste du supporter**
     qui les incarne, jamais l'abstraction : on ne dessine pas « la corde cesse
     de retomber », on dessine des gens qui tiennent. */
  'a-ancre': ['silver', 'a whole row of supporters braced against the barrier, feet set, '
    + 'arms locked together, leaning back as one and refusing to give a centimetre, '
    + 'jaws set, cold silver night light'],
  'a-mise': ['orange', 'a single supporter at the front of the terrace taking a huge '
    + 'breath before one all-or-nothing shout, everyone around him turned towards him '
    + 'and waiting, the whole stand held in suspense, warm orange light'],
  'a-tournee': ['amber', 'a supporter carrying an armful of steaming cups along a packed '
    + 'terrace row, hands reaching out to take them, laughter and open faces, everyone '
    + 'served, warm amber glow'],
  'a-longchant': ['violet', 'a terrace deep into a slow repeating chant, rows swaying in '
    + 'unison, mouths open on the same syllable, no flares and no banners — just the '
    + 'endurance of it, steady violet night light'],
  'a-retournement': ['crimson', 'a terrace that has just woken up, the front row surging '
    + 'forward against the barrier, disbelief turning into fury on their faces, the '
    + 'moment a lost match stops being lost, deep crimson light'],

  /* ------------------------------------------------- LA REPRISE

     La première journée après la coupure. Trois mois d'absence, un stade qu'on
     redécouvre, et des gens qui ne savent plus tout à fait comment on fait. La
     lumière est celle de la fin d'août : basse, dorée, encore chaude — c'est ce
     qui distingue ces dix des vingt-neuf autres, toutes nocturnes.

     Le sujet reste **ce que la carte fait**, jamais ce qu'elle s'appelle : une
     illustration qui décore son titre ne se reconnaît pas dans une main de
     cinq cartes à la seconde où il faut choisir. */

  'a-rp-coupdenvoi': ['amber', 'the very first seconds of a season, a terrace filling as '
    + 'the first chant starts low at the back and spreads forward row by row, only half '
    + 'the arms up yet, late summer sun low across the stand'],
  'a-rp-rouille': ['grey', 'a supporter caught mid-chant with his voice gone, hand at his '
    + 'throat, surprised and a little embarrassed, the people around him still singing '
    + 'without him, dull grey-gold light'],
  'a-rp-horsjeu': ['white', 'a linesman flag raised sharp against a bright late-summer '
    + 'sky, the terrace behind it stopped dead mid-celebration, arms frozen halfway up, '
    + 'hard white light'],
  'a-rp-echauffement': ['amber', 'supporters stretching and rolling their shoulders '
    + 'before kick-off, a drummer testing two loose beats, nobody serious yet, everything '
    + 'still to come, warm amber pre-match light'],
  'a-rp-routine': ['gold', 'the same gestures as every season — the scarf knotted the '
    + 'same way, the same step climbed, the same place taken at the barrier — a man doing '
    + 'exactly what he has always done, calm golden light'],
  'a-rp-bache-neuve': ['blue', 'a brand new banner being unrolled across a whole stand, '
    + 'the fabric still crisp and folded flat, dozens of hands passing it overhead, clean '
    + 'blue daylight'],
  'a-rp-filet': ['grey', 'scaffolding and safety netting across a half-finished stand, '
    + 'supporters singing behind it, the mesh softening everything, cool grey light'],
  'a-rp-presentation': ['gold', 'a squad lined up facing the terrace before the first '
    + 'match, seen from behind the crowd, hundreds of raised phones and scarves, warm '
    + 'golden late-afternoon light'],
  'a-rp-premier-chant': ['amber', 'the first chant of the year taken up by an entire '
    + 'stand at once, mouths open on the same syllable, visible relief and joy on their '
    + 'faces, dust in the warm amber air'],
  'a-rp-jour-un': ['gold', 'an empty terrace an hour before the opening match, one lone '
    + 'supporter standing at the barrier looking at the pitch, everything still possible, '
    + 'low golden sun across the seats'],
  /* La relance et les cartes des PASS (3 novembre 2026). */
  'a-petard': ['red', 'a single small firecracker bursting in a bright flash just above a '
    + 'terrace barrier, supporters with open visible faces flinching and laughing'],
  'a-banderole': ['red', 'a long hand-painted banner being unrolled down the front of a packed '
    + 'stand, supporters holding its top edge, letters not readable, cloth rippling'],
  'a-sifflets': ['violet', 'a whole stand whistling with fingers in their mouths, cheeks puffed, '
    + 'visible sound lines in the air, cool violet light'],
  'a-larsen': ['violet', 'a stadium loudspeaker screeching with feedback, a visible jagged '
    + 'sound wave, supporters below covering their ears'],
  'a-gourde': ['blue', 'a dented metal water flask passed along a terrace row, a supporter '
    + 'drinking with eyes closed, cool blue light'],
  'a-echarpe-tendue': ['silver', 'a long row of supporters holding their scarves stretched tight '
    + 'above their heads like a wall, seen from the pitch'],
  'a-ola': ['amber', 'a Mexican wave travelling across a full stadium, one section on its feet '
    + 'with arms up, the rest about to rise, warm amber light'],
  'a-tambour': ['amber', 'a big bass drum at the front of a terrace, a drummer mid-swing, '
    + 'the crowd behind jumping on the beat'],
  'a-bengale': ['red', 'a bright red Bengal flare held at arm\u2019s length, intense glow and '
    + 'sparks, the holder grinning, red light flooding the faces around'],
  'a-faussenote': ['violet', 'a brass band in the stands playing a sour note, the trumpeter '
    + 'wincing, crooked musical notes floating in the air'],
  'a-coupfranc': ['gold', 'a ball resting on the grass in front of a defensive wall seen from '
    + 'the stands, the whole terrace leaning forward holding its breath'],
  'a-megaphone': ['amber', 'a capo standing on the barrier shouting into a battered megaphone, '
    + 'the crowd behind answering with raised fists'],
  'a-hc-pause-pub': ['violet', 'a living-room television showing a frozen colourful advert break, '
    + 'a supporter on the couch throwing up his arms in frustration'],
  'a-hc-chips': ['blue', 'a torn-open bag of crisps on a couch armrest, a hand grabbing a fistful, '
    + 'crumbs flying, football on the TV glow'],
  'a-hc-plaid': ['silver', 'a supporter wrapped in a thick striped club blanket on a couch, '
    + 'only his face and scarf showing, TV light'],
  'a-hc-ralenti': ['violet', 'a television replay in slow motion, motion-blur trails behind a '
    + 'player, a supporter on the couch leaning in, frozen'],
  'a-hc-reveil': ['gold', 'a supporter jolting awake on the couch, an alarm clock jumping on the '
    + 'coffee table, the match on the TV behind'],
  'a-hc-massue': ['red', 'a prehistoric caveman supporter in fur raising a big wooden club over '
    + 'his head on a terrace, friendly face, sparks'],
  'a-hc-feu-camp': ['blue', 'a small campfire in front of a cave, caveman supporters in furs '
    + 'warming their hands and singing, scarves around their necks'],
  'a-mt-averse': ['violet', 'a sudden downpour over a terrace, sheets of rain, supporters under '
    + 'plastic ponchos still singing, puddles on the steps'],
  'a-mt-eclaircie': ['silver', 'the sun breaking through dark clouds over a stadium, a beam of '
    + 'light on the terrace, wet seats shining'],
  'a-mt-grele': ['red', 'hailstones bouncing off the stand roof and the steps, supporters '
    + 'laughing with hoods up, white pellets everywhere'],
  'a-mt-vent-arriere': ['green', 'a strong wind blowing from behind a terrace, flags and scarves '
    + 'all streaming forward toward the pitch'],
  'a-mt-orage': ['red', 'a thunderstorm rolling over a floodlit stadium, a lightning bolt in the '
    + 'distance, the crowd lit white for an instant'],
  'a-gd-car': ['amber', 'an old supporters\u2019 coach on a motorway at night, scarves hanging '
    + 'out of the windows, faces pressed to the glass singing'],
  'a-gd-aire': ['blue', 'a motorway service station at dawn, supporters in scarves stretching '
    + 'next to their coach, coffee cups steaming'],
  'a-gd-train-retard': ['red', 'a station platform departure board flashing red lights, no readable text, '
    + 'only, supporters sitting on their bags waiting, scarves on'],
  'a-rv-frisson': ['violet', 'a ghostly cold mist sweeping across a night terrace, supporters '
    + 'shivering, frost on the barrier'],
  'a-rv-brume': ['violet', 'a thick graveyard fog rolling into a stadium at night, only the '
    + 'floodlights and a few silhouettes with scarves visible'],
  'a-rv-outre-tombe': ['gold', 'a friendly ghost supporter rising from the turf behind the goal, '
    + 'scarf around his neck, the crowd cheering in amazement'],
  /* Le vrai match (3 novembre 2026). */
  'a-mitemps': ['blue', 'half-time on a terrace, supporters sitting down at last, sharing a '
    + 'thermos, the empty pitch and the tunnel behind them, cool blue light'],
  'a-but-au-stade': ['red', 'the instant a real goal goes in, a whole terrace exploding in joy, '
    + 'people climbing on each other, scarves and arms everywhere'],
  'a-carton-rouge': ['amber', 'a referee on the pitch raising a red card seen from the stands, '
    + 'the home terrace roaring and pointing, warm amber floodlight'],
  'a-coup-sifflet': ['gold', 'the referee at the centre spot blowing the kick-off whistle, the '
    + 'terrace behind lifting its scarves all at once'],
  'a-temps-additionnel': ['gold', 'the fourth official raising the lit board for stoppage time, '
    + 'no readable numbers, supporters biting their scarves'],
  /* Les mécaniques neuves (3 novembre 2026). */
  'a-chambrage': ['violet', 'a supporter cupping his ear toward the away end with a cheeky grin, '
    + 'his mates laughing behind him'],
  'a-echo': ['blue', 'a chant bouncing off the opposite stand roof, visible sound rings '
    + 'returning to the singers, cool blue light'],
  'a-piege': ['silver', 'a stadium snack bar counter with a hidden mousetrap under a hot dog, '
    + 'a supporter winking behind it'],
  'a-tribune-chaude': ['green', 'a terrace jumping in perfect rhythm, heat haze rising above it, '
    + 'faces flushed and grinning'],
  'a-recrue': ['blue', 'a young new supporter receiving a scarf from an older one at the turnstile, '
    + 'both smiling'],
  'a-sangfroid': ['blue', 'a calm supporter with eyes closed breathing in, amid a roaring crowd '
    + 'frozen in motion around him'],
  'a-domicile': ['gold', 'the home end at full volume, the stadium lit in warm colours, the '
    + 'pitch below, a sense of owning the place'],
  'a-maillot': ['red', 'a supporter pulling a plain-coloured replica shirt over his head in the '
    + 'stand, no badge, no lettering, arms up'],
  'a-kop-plein': ['amber', 'a huge steep terrace packed to the last step, thousands of scarves '
    + 'raised, seen from the pitch'],
  'a-hc-telecommande': ['violet', 'a remote control pointed at a television, channels flicking '
    + 'past in a blur, a supporter on the couch'],
  'a-gd-peage': ['violet', 'a motorway toll barrier down in front of a supporters\u2019 coach, a '
    + 'long queue behind, red light'],
  'a-gd-parcage-visiteur': ['silver', 'a fenced away section full of travelling supporters, tall '
    + 'mesh fence, scarves tied to it'],
  'a-rv-fantome': ['red', 'a translucent friendly ghost supporter drifting through the stand '
    + 'waving a scarf, the crowd half-scared half-laughing'],
  'a-rv-malediction': ['violet', 'a hooded old supporter in the stands pointing a bony finger '
    + 'at the pitch, purple sparks, the crowd shivering'],
};

export const inviteDe = (id) => {
  const [couleur, sujet] = INVITES[id] ?? [];
  if (!sujet) return null;
  return `Subject: ${sujet}, glowing ${couleur} accent light.\n\n${STYLE}`;
};

/* ------------------------------------------------------------- l'exécution */

if (process.argv.includes('--invites')) {
  for (const a of ACTIONS) {
    console.log(`\n=== ${a.id} — ${a.nom} (${a.fam})\n${inviteDe(a.id) ?? '(aucune invite)'}`);
  }
  process.exit(0);
}

const sharp = (await import('sharp')).default;
await mkdir(CIBLE, { recursive: true });

if (!existsSync(SOURCE)) {
  console.error(`\n  ${SOURCE} n'existe pas.\n\n`
    + '  Les dessins produits par Artlist se déposent là, un fichier par carte,\n'
    + '  nommé de son identifiant : art/action/a-fumigene.png\n\n'
    + '  Les invites : node scripts/action-images.mjs --invites\n');
  process.exit(1);
}

const sources = (await readdir(SOURCE)).filter((f) => /\.(png|jpe?g|webp)$/i.test(f));
const connus = new Set(ACTIONS.map((a) => a.id));
let faits = 0;
const manquantes = [];

for (const a of ACTIONS) {
  const src = sources.find((f) => f.replace(/\.[^.]+$/, '') === a.id);
  if (!src) { manquantes.push(a.id); continue; }
  const entree = path.join(SOURCE, src);
  const base = sharp(entree).resize(LARGEUR, HAUTEUR, { fit: 'cover', position: 'centre' });
  await base.clone().avif({ quality: 62 }).toFile(path.join(CIBLE, `${a.id}.avif`));
  await base.clone().webp({ quality: 82 }).toFile(path.join(CIBLE, `${a.id}.webp`));
  await base.clone().jpeg({ quality: 82, mozjpeg: true }).toFile(path.join(CIBLE, `${a.id}.jpg`));
  faits++;
  process.stdout.write(`\r  ${faits} carte(s) rangée(s)`);
}

/* Un fichier qui ne correspond à aucune carte est presque toujours une faute
   de frappe dans son nom — et il ne se verrait jamais, puisque la carte
   garderait simplement son dessin géométrique. */
const orphelins = sources.map((f) => f.replace(/\.[^.]+$/, '')).filter((n) => !connus.has(n));

console.log(`\n${faits} illustration(s) en trois formats dans public/img/action.`);
if (manquantes.length) console.log(`Sans dessin : ${manquantes.join(', ')}`);
if (orphelins.length) {
  console.log(`\nFichiers qui ne correspondent à aucune carte : ${orphelins.join(', ')}`);
  console.log('Vérifie leur nom : il doit être exactement l’identifiant de la carte.');
}

await writeFile(path.join(CIBLE, 'liste.json'),
  `${JSON.stringify(ACTIONS.filter((a) => !manquantes.includes(a.id)).map((a) => a.id))}\n`);
