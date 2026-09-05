/**
 * Catalogue Fanzzy — source unique.
 *
 * Le serveur s'en sert pour tirer les boosters et valider les évolutions ; le
 * client le reçoit via /api/fanzzy/dex pour l'affichage. Une seule définition,
 * donc aucun risque que les deux divergent.
 */
const TYPES = {
  voix: { nom:'Voix', c:'#F5C33B', geste:'tempo',
    ico:'M4 9v6h4l5 4V5L8 9H4zm12.5-1a5 5 0 0 1 0 8' },
  perc: { nom:'Percussion', c:'#3C82E8', geste:'martelage',
    ico:'M12 6c5 0 8 1.5 8 3.5S17 13 12 13 4 11.5 4 9.5 7 6 12 6zm-8 4v5c0 2 3.5 3.5 8 3.5s8-1.5 8-3.5v-5' },
  fide: { nom:'Fidélité', c:'#C2CAD6', geste:'endurance',
    ico:'M12 21s-7-4.4-7-9.5A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 3.5C19 16.6 12 21 12 21z' },
  tifo: { nom:'Tifo', c:'#8257DA', geste:'contre',
    ico:'M4 4h16v12l-8-3-8 3V4z' },
  pyro: { nom:'Pyro', c:'#E0402C', geste:'risque',
    ico:'M12 2c1 4-3 5-3 9a3 3 0 0 0 6 0c0-2-1-3-1-4 2 1 4 3 4 6a6 6 0 0 1-12 0c0-5 6-7 6-11z' },
  depl: { nom:'Déplacement', c:'#1E9E6A', geste:'souffle',
    ico:'M4 7h16v8H4zM4 15v3h3v-3m10 0v3h3v-3M6 10h12' },
};

const RAR = { d1:1, d2:2, d3:3, star:4, crown:5 };
const SCARVES = { d1:1, d2:3, d3:8, star:25, crown:60 };
/**
 * Coût d'évolution. Calibré sur la simulation : compléter la collection
 * rapporte environ 1 150 écharpes, faire évoluer les six lignées en coûte 690.
 * Il reste de quoi choisir, pas de quoi tout avoir sans y penser.
 */
const EVO_COST = { 2:25, 3:90 };

const SETS = [
  { id:'VN', nom:'VIRAGE NORD', ligne:'béton, pluie, hiver', c1:'#E0402C', c2:'#1A1F27' },
  { id:'NE', nom:'NUITS EUROPÉENNES', ligne:'jeudi soir, 900 km', c1:'#3C82E8', c2:'#151A22' },
];

/** Taux de tirage. Les trois premières cartes sont communes, comme dans Pocket. */

const DEX = [
  // --- VOIX
  { id:'V1', nom:'Choriste', type:'voix', set:'VN', stage:1, rar:'d1', evo:'V2',
    mods:{ tempoWindow:1.2 }, cri:{ label:'REPRISE', gest:'tempo', power:52 } },
  { id:'V2', nom:'Meneur de chant', type:'voix', set:'VN', stage:2, rar:'d2', evo:'V3',
    mods:{ tempoWindow:1.45, tempoInterval:40 }, cri:{ label:'MUR DU SON', gest:'tempo', power:64 } },
  { id:'V3', nom:'Capo di Curva', type:'voix', set:'VN', stage:3, rar:'star',
    mods:{ tempoWindow:1.7, tempoInterval:80 }, cri:{ label:'TOUT LE VIRAGE', gest:'tempo', power:78 } },
  // --- PERCUSSION
  { id:'P1', nom:'Gamin au tambour', type:'perc', set:'VN', stage:1, rar:'d1', evo:'P2',
    mods:{ mashBonus:1.06 }, cri:{ label:'ROULEMENT', gest:'mash', power:52 } },
  { id:'P2', nom:'Tambour Major', type:'perc', set:'VN', stage:2, rar:'d2', evo:'P3',
    mods:{ mashBonus:1.1, mashTime:-500 }, cri:{ label:'CADENCE', gest:'mash', power:66 } },
  { id:'P3', nom:'Grosse Caisse Sud', type:'perc', set:'VN', stage:3, rar:'d3',
    mods:{ mashBonus:1.16, mashTime:-800 }, cri:{ label:'TEMPO INFERNAL', gest:'mash', power:76 } },
  // --- FIDÉLITÉ
  { id:'F1', nom:'Abonné', type:'fide', set:'VN', stage:1, rar:'d1', evo:'F2',
    mods:{ holdBonus:1.07 }, cri:{ label:'PRÉSENTS', gest:'hold', power:50 } },
  { id:'F2', nom:'Vieille Garde', type:'fide', set:'VN', stage:2, rar:'d2', evo:'F3',
    mods:{ holdBonus:1.12, holdForgive:1 }, cri:{ label:'ON ÉTAIT LÀ', gest:'hold', power:64 } },
  { id:'F3', nom:'Doyen du Bloc C', type:'fide', set:'VN', stage:3, rar:'crown',
    mods:{ holdBonus:1.2, holdForgive:2, breathBonus:1.08 }, cri:{ label:'CINQUANTE ANS', gest:'hold', power:80 } },
  // --- TIFO
  { id:'T1', nom:'Colleur d\u2019affiches', type:'tifo', set:'NE', stage:1, rar:'d1', evo:'T2',
    mods:{ parryBonus:1.2 }, cri:{ label:'CONSIGNES', gest:'tempo', power:48 } },
  { id:'T2', nom:'Bâcheur Nocturne', type:'tifo', set:'NE', stage:2, rar:'d2', evo:'T3',
    mods:{ parryBonus:1.5 }, cri:{ label:'BÂCHE SURPRISE', gest:'hold', power:62 } },
  { id:'T3', nom:'Chef Tifo', type:'tifo', set:'NE', stage:3, rar:'star',
    mods:{ parryBonus:1.9, holdBonus:1.06 }, cri:{ label:'MOSAÏQUE GÉANTE', gest:'hold', power:74 } },
  // --- PYRO
  { id:'Y1', nom:'Porte-torche', type:'pyro', set:'NE', stage:1, rar:'d1', evo:'Y2',
    mods:{ perfectBonus:1.2 }, cri:{ label:'TORCHE', gest:'mash', power:54 } },
  { id:'Y2', nom:'Fumigène', type:'pyro', set:'NE', stage:2, rar:'d2', evo:'Y3',
    mods:{ perfectBonus:1.35, backfire:true }, cri:{ label:'NAPPE DE FUMÉE', gest:'mash', power:70 } },
  { id:'Y3', nom:'Craqueur', type:'pyro', set:'NE', stage:3, rar:'d3',
    mods:{ perfectBonus:1.5, backfire:true }, cri:{ label:'EMBRASEMENT', gest:'mash', power:86 } },
  // --- DÉPLACEMENT
  { id:'D1', nom:'Auto-stoppeur', type:'depl', set:'NE', stage:1, rar:'d1', evo:'D2',
    mods:{ breathBonus:1.08 }, cri:{ label:'PREMIER PÉAGE', gest:'tempo', power:50 } },
  { id:'D2', nom:'Conducteur de car', type:'depl', set:'NE', stage:2, rar:'d2', evo:'D3',
    mods:{ breathBonus:1.16, refundBonus:1.4 }, cri:{ label:'KLAXONS', gest:'mash', power:64 } },
  { id:'D3', nom:'Convoi 4h du Mat', type:'depl', set:'NE', stage:3, rar:'d3',
    mods:{ breathBonus:1.24, refundBonus:1.8 }, cri:{ label:'ON EST VENUS POUR ÇA', gest:'hold', power:76 } },
  // --- sans évolution
  { id:'X1', nom:'Le Douzième Homme', type:'voix', set:'VN', stage:1, rar:'d3',
    mods:{ tempoWindow:1.3, breathBonus:1.1 }, cri:{ label:'OLA', gest:'tempo', power:68 } },
  { id:'X2', nom:'Écharpes au Vent', type:'fide', set:'VN', stage:1, rar:'d2',
    mods:{ holdBonus:1.1 }, cri:{ label:'LEVER LES BRAS', gest:'hold', power:56 } },
  { id:'X3', nom:'Mosaïque Populaire', type:'tifo', set:'NE', stage:1, rar:'d2',
    mods:{ parryBonus:1.3 }, cri:{ label:'DÉPLOIEMENT', gest:'tempo', power:56 } },
  { id:'X4', nom:'Parcage 400 places', type:'depl', set:'NE', stage:1, rar:'star',
    mods:{ breathBonus:1.14, parryBonus:1.4 }, cri:{ label:'ÉCHO DU PARCAGE', gest:'mash', power:72 } },
  { id:'X5', nom:'La Nuit du 8e', type:'pyro', set:'NE', stage:1, rar:'crown',
    mods:{ perfectBonus:1.45, tempoWindow:1.2, mashBonus:1.08 }, cri:{ label:'PROLONGATIONS', gest:'mash', power:90 } },
  { id:'X6', nom:'Section Cendrée', type:'fide', set:'VN', stage:1, rar:'d1',
    mods:{ holdBonus:1.05, breathBonus:1.04 }, cri:{ label:'FIDÈLES', gest:'hold', power:48 } },
];

const RATES = {
  4: [['d2',.80],['d3',.15],['star',.04],['crown',.01]],
  5: [['d2',.55],['d3',.30],['star',.12],['crown',.03]],
};

export const BY_ID = new Map(DEX.map((f) => [f.id, f]));
export { TYPES, RAR, SCARVES, EVO_COST, SETS, DEX, RATES };
