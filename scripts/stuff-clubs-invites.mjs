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

  /* DIE KURVE (demande de Gaël du 1er novembre 2026). Ni ours, ni étoile, ni
     aigle, ni clé, ni insecte, ni grande lettre V, ni croix : ce sont les
     écussons et les armoiries de ces villes. */
  // Bâle : rouge et bleu, le carnaval
  'su-piccolo': `a small wooden carnival piccolo fife painted in bright red and deep blue bands, a short red and blue tasselled cord tied near the mouthpiece, ${NU}`,
  'su-lanterne-cortege': `a large hand-painted paper carnival lantern on a short wooden pole, glowing warmly from inside, its paper panels painted with abstract red and blue swirls only, no faces, no animals and no figures, ${NU}`,
  // Grasshopper : bleu nuit et blanc, le lac
  'su-casquette-matelot': `an empty unworn sailor's peaked cap in deep navy blue with a white band and white piping, nobody wearing it, ${NU}`,
  'su-cloche-aubes': `a polished brass ship's bell hanging from a small navy blue painted iron bracket, a white braided rope pull hanging from its clapper, ${NU}`,
  // Lausanne-Sport : bleu roi et blanc, les vignes et le guet
  'su-gants-vendange': `a pair of sturdy royal blue work gloves with white cuffs, a few purple grape juice stains on the fingertips, one lying flat and one curled, ${NU}`,
  'su-porte-voix-guet': `an old tall conical brass speaking trumpet of a night watchman, a royal blue and white striped cord wound around its handle, ${NU}`,
  // Lucerne : bleu lac et blanc, le carnaval et le vieux pont
  'su-mirliton': `a carnival toy kazoo horn in lake blue with white paper frills and a small white tassel, ${NU}`,
  'su-planche-pont': `a single old weathered triangular wooden gable panel from a covered bridge, its painted surface showing only a soft abstract landscape of lake blue water and white mountains, no people and no figures, ${NU}`,
  // Lugano : noir et blanc, le lac et les marrons
  'su-cornet-marrons': `a twisted paper cone with bold black and white stripes filled with roasted chestnuts, a curl of steam rising, ${NU}`,
  'su-manivelle': `a heavy old cast iron crank handle with a black painted arm and a white enamelled wooden grip, a small toothed gear at its base, ${NU}`,
  // Saint-Gall : vert et blanc, la broderie (sur fond magenta : FOND_MAGENTA)
  'su-de-coudre': `a single porcelain sewing thimble, glossy white with a deep green band around its rim and a delicate white lace pattern, ${NU}`,
  'su-cerceau-broderie': `a round wooden embroidery hoop holding a taut piece of white fabric with fine white lace embroidery of abstract flowers and swirls in green thread, a needle with green thread hanging from it, no leaves, ${NU}`,
  // Servette : grenat et blanc, l'Escalade
  'su-marmite': `a small round cooking pot made of shiny dark chocolate tied with a garnet red ribbon with white edges, a few tiny marzipan vegetables beside it, an orange carrot and a white turnip, nothing green, ${NU}`,
  'su-echelle': `a short old wooden siege ladder with rough rungs, a garnet red and white striped cloth tied around its top rung, ${NU}`,
  // Sion : rouge et blanc, le glacier et l'alpage
  'su-gourde-glacier': `a dented aluminium mountain flask painted bright red with a white screw cap, a little frost on its shoulder, hanging from a white cord, ${NU}`,
  'su-cloche-alpage': `a large hand-forged iron cowbell on a wide red leather strap embroidered with small white abstract flowers, no cross and no star anywhere, ${NU}`,
  // Thoune : blanc et rouge, la sciure et la vague du fleuve
  'su-sciure': `a small burlap sack with red and white striped edges, spilling a little heap of pale wood shavings and sawdust, ${NU}`,
  'su-planche-vague': `a short river surfboard, white with one bold red stripe down its length, a red leash coiled beside it, a few water droplets, ${NU}`,
  // Vaduz : rouge et blanc, les timbres et la neige
  'su-loupe': `a small brass-rimmed magnifying glass with a red lacquered handle lying over one blank white perforated postage stamp with no picture and no numbers, ${NU}`,
  'su-luge': `a classic wooden sled with curved runners painted red and a white woven seat, a red and white rope pull, a light dusting of snow on it, ${NU}`,
  // Young Boys : jaune et noir, le marché aux oignons et l'horloge
  'su-tresse-oignons': `a decorative braided string of golden onions with dried straw coloured stems, tied with a yellow and black striped ribbon bow, nothing green, ${NU}`,
  'su-rouage': `a large old brass clockwork gear wheel interlocked with a smaller black iron gear, one spoke painted bright yellow, no numbers, ${NU}`,
  // Zurich : blanc et bleu, la parade et le tram
  'su-casque-audio': `a pair of over-ear DJ headphones in glossy white with royal blue ear cushions and a coiled blue cable, ${NU}`,
  'su-poignee-tram': `a hanging tram strap handle, a white plastic ring on a royal blue leather strap with a chrome clip, ${NU}`,
};

/* Les pièces vertes ne passent pas sur le vert de studio : le détourage les
   mangerait. Elles se dessinent sur un magenta uni, comme les Fanzzy de
   Saint-Gall, et le détourage, qui part de la couleur du coin, suit. */
export const FOND_MAGENTA = new Set(['su-de-coudre', 'su-cerceau-broderie']);
