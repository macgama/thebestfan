/**
 * Les sujets des pièces de club (série AN, demande de Gaël du 28 octobre 2026).
 *
 * À part de `stuff-images.mjs`, qui les reprend : `stuff-clubs:smoke` vérifie
 * qu'aucune pièce de club n'est écrite sans son sujet, et importer
 * `stuff-images.mjs` lancerait le détourage.
 *
 * Les deux couleurs du club sont nommées, c'est ce qui le fait reconnaître ;
 * tout ce qui pourrait porter un écusson est dit nu, sinon le générateur en
 * invente un. Ni maillot, ni nom, ni ce que dessinent les écussons.
 */
const NU = 'completely plain with no crest, no logo and no lettering';

export const INVITES_CLUBS = {
  // Arsenal : rouge, manches blanches
  'an-mitaines': `a pair of chunky knitted fingerless gloves in bright red with white cuffs, one lying flat and one half curled, ${NU}`,
  'an-horloge': `an old round stadium clock with a heavy red-painted iron case and a white face, simple black tick marks and two hands, no numbers on the dial, ${NU}`,
  // Aston Villa : bordeaux et bleu ciel
  'an-thermos': `a stout vacuum flask in deep claret red with a sky blue screw cup on top, a few dents and scuffs, ${NU}`,
  'an-enclume': `a small heavy blacksmith anvil the size of a hand with a short hammer resting against it, hot sparks flying, a claret red and sky blue ribbon tied around the hammer handle, ${NU}`,
  // Bournemouth : rouge et noir, la mer
  'an-seau-plage': `a child's plastic beach bucket with bold red and black vertical stripes and a little matching spade, a pinch of golden sand spilling over the rim, ${NU}`,
  'an-transat': `a folding wooden deckchair with a striped red and black canvas seat, slightly sagging, seen alone with no beach, ${NU}`,
  // Brentford : rayures rouges et blanches, la Tamise
  'an-bob': `an empty unworn bucket hat with bold red and white vertical stripes, slumped and holding its shape, nobody wearing it, ${NU}`,
  'an-rame': `a single wooden rowing oar with a red and white striped blade, varnished shaft with a worn leather grip, ${NU}`,
  // Brighton : bleu et blanc, la jetée
  'an-sucre-orge': `a thick stick of seaside rock candy with swirling blue and white stripes, the end bitten off to show the pink centre, ${NU}`,
  'an-jeton': `a large brass arcade token with a hole in the middle, slightly worn and shiny, threaded on a short blue and white striped cord, the coin faces plain with no symbols and no numbers, ${NU}`,
  // Chelsea : bleu roi, les fleurs
  'an-gants-roi': `a pair of warm knitted gloves in deep royal blue with a thin white band at the wrist, one lying flat, one slightly curled, ${NU}`,
  'an-arrosoir': `a classic metal watering can painted royal blue, a few bright flower petals stuck to its spout, a single drop of water falling, ${NU}`,
  // Coventry City : bleu ciel, le vélo
  'an-sonnette': `a round chrome bicycle bell with a sky blue painted dome and a small lever, clamped to a short piece of handlebar, ${NU}`,
  'an-guidon': `a curved chromed racing bicycle handlebar wrapped in sky blue and white tape, the ends plugged, gleaming, ${NU}`,
  // Crystal Palace : rouge et bleu, les dinosaures du parc
  'an-bonnet-rb': `a thick knitted beanie hat with a folded brim and bold red and blue horizontal stripes and a pompom, empty and unworn, nobody wearing it, ${NU}`,
  'an-dinosaure': `a small weathered stone statue of a Victorian-style iguanodon dinosaur, moss-free grey stone, a red and blue knitted scarf wound around its neck, ${NU}`,
  // Everton : bleu, le port
  'an-cire': `a folded navy blue fisherman's rain jacket with a bright white drawstring hood, shiny wet surface, empty and unworn, nobody wearing it, ${NU}`,
  'an-corne-brume': `a big brass hand-pumped fog horn with a flared trumpet and a royal blue painted body, a puff of mist leaving the mouth, ${NU}`,
  // Fulham : blanc et noir, le fleuve
  'an-parapluie': `a long gentleman's umbrella half open, its canopy panels alternating white and black, a curved polished wooden handle, ${NU}`,
  'an-theiere': `a round porcelain teapot, white with a black rim and black handle, a wisp of steam rising from the spout, ${NU}`,
  // Hull City : ambre et noir, la pêche
  'an-bonnet-pecheur': `a thick ribbed fisherman's beanie with a rolled brim, bold amber orange and black stripes, empty and unworn, nobody wearing it, ${NU}`,
  'an-lanterne-chalutier': `an old trawler oil lantern with a black iron frame and a warm amber glass glowing from inside, a wet rope wrapped around the handle, ${NU}`,
  // Ipswich Town : bleu et blanc, la campagne
  'an-moulin': `a small toy windmill on a short wooden post, four sails painted blue and white, the sails caught mid-spin, ${NU}`,
  'an-panier': `a wicker picnic basket with its lid half open, a blue and white checked cloth tucked inside, a corner of bread showing, ${NU}`,
  // Leeds United : blanc, jaune et bleu, le comté
  'an-pudding': `a golden puffed savoury batter pudding in a small round tin, crisp risen edges, steaming, a tiny white, yellow and blue paper flag on a toothpick stuck in it, ${NU}`,
  'an-lampe-mineur': `an old brass miner's safety lamp with a glass cylinder and a warm yellow flame, a white, yellow and blue cord tied to its hook, ${NU}`,
  // Liverpool : rouge, les docks, la musique
  'an-amarre': `a thick coil of red mooring rope wound around a short black iron bollard, the frayed end hanging loose, ${NU}`,
  'an-guitare': `a glossy red electric guitar with a cream pickguard, a few strings vibrating, ${NU}`,
  // Manchester City : bleu ciel, la pluie, les canaux
  'an-impermeable': `a folded sky blue rain mac with white buttons, rain drops beading on the fabric, empty and unworn, nobody wearing it, ${NU}`,
  'an-lanterne-ecluse': `an old canal lock lamp on a short iron bracket, sky blue painted frame, a soft white light behind the glass, a drop of water dripping from it, ${NU}`,
  // Manchester United : rouge, noir et blanc, les filatures
  'an-bobine': `a large wooden spool wound with thick bright red cotton thread, a loose end trailing, a black and white band around its rim, ${NU}`,
  'an-navette': `a polished wooden weaving shuttle with pointed metal tips, a bobbin of red thread inside, a black thread trailing behind it, ${NU}`,
  // Newcastle United : noir et blanc, les ponts
  'an-echarpe-tricot': `a hand-knitted supporter scarf with chunky black and white vertical stripes, rolled loosely, fringed ends, ${NU}`,
  'an-cle-pont': `a heavy steel bridge spanner wrench with a black painted handle and a white band, a large hex bolt beside it, ${NU}`,
  // Nottingham Forest : rouge, l'archer
  'an-bonnet-plume': `a soft red felt hat with a long white feather tucked into its band, empty and unworn, nobody wearing it, ${NU}`,
  'an-carquois': `a leather archer's quiver with a red strap, full of arrows with red and white fletching, ${NU}`,
  // Sunderland : rouge et blanc, le verre
  'an-chope': `a hand-blown glass beer tankard with a thick base, clear glass with swirls of red and white inside, light shining through it, ${NU}`,
  'an-boule-verre': `a hand-blown glass sphere in deep red with white swirls inside, resting on a small brass stand, glowing where the light passes through, ${NU}`,
  // Tottenham Hotspur : blanc et bleu nuit, les boutons nacrés
  'an-boutons': `a small handful of large mother-of-pearl buttons, iridescent white, scattered with a few navy blue ones among them, ${NU}`,
  'an-gilet-nacre': `a navy blue waistcoat covered in hundreds of sewn-on white mother-of-pearl buttons, laid flat, empty and unworn, nobody wearing it, ${NU}`,
};
