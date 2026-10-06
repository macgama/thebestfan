/**
 * Simulation de l'économie d'un joueur de LA REPRISE, règle par règle.
 *
 * Reprend `openPack` / `tirerAutreChose` de src/server/fanzzy/index.js à
 * l'identique (places ouvertes, poignées, replis sur deux écharpes), le barème
 * des duels de src/server/nvn/index.js, l'XP et les écharpes de palier de
 * src/shared/niveau.js. Lecture seule du dépôt : on n'importe que des modules
 * purs.
 *
 *   node sim-eco.mjs            # scénario « RP seule » (20 pièces, 10 actions)
 *   node sim-eco.mjs tout       # tout le contenu du code ouvert (49, 39)
 */
// La racine du dépôt, lue depuis l'emplacement de ce fichier (serveur/).
const REPO = new URL('../', import.meta.url).href;
const { RATES, SCARVES, EVO_COST, POIGNEE_DE_REPLI } = await import(REPO + 'src/shared/fanzzy/dex.js');
const { STUFF } = await import(REPO + 'src/shared/fanzzy/inventaire.js');
const { ACTIONS } = await import(REPO + 'src/shared/duel/actions.js');
const { niveauPour, ecarpesDuPalier, seuil } = await import(REPO + 'src/shared/niveau.js');

const TOUT = process.argv.includes('tout');
const MISSIONS = process.argv.includes('--missions');
/* Le quotidien proposé (valeurs par défaut d'ECONOMIE.md). Par profil : la
   part de chaque difficulté réussie un jour joué. */
const M = { facile: { e: 30, xp: 20 }, moyenne: { e: 60, xp: 40 }, difficile: { e: 100, xp: 60 } };
const REUSSITE = {
  assidu: { facile: 1, moyenne: 1, difficile: 0.9 },
  moyen: { facile: 1, moyenne: 0.8, difficile: 0.35 },
  occasionnel: { facile: 0.9, moyenne: 0.5, difficile: 0.1 },
};
const CARTE = [20, 25, 30, 35, 40, 45, 50];   // J7 : + 1 booster
const STUFF_OUVERT = TOUT ? STUFF : STUFF.filter((s) => s.id.startsWith('rp-'));
const ACTIONS_OUVERTES = (TOUT ? ACTIONS : ACTIONS.filter((a) => a.id.startsWith('a-rp-')))
  .filter((a) => a.rar !== 'commune');
const N_TENUES = 2;           // préhistorique + apocalyptique (halloween hors saison)
const ETATS = 4;
const COMMUNES = 30, LEGENDES = 5;   // LA REPRISE : 30 lignées + 5 légendaires

const PLACES_OUVERTES = [['action', 0.28], ['stuff', 0.23], ['skin', 0.14],
  ['etat', 0.12], ['echarpes', 0.23]];
const POIGNEES = [[6, 0.55], [14, 0.33], [30, 0.12]];
const tire = (table) => { const r = Math.random(); let a = 0;
  for (const [v, p] of table) { a += p; if (r < a) return v; } return table[0][0]; };
const pickRarity = (slot) => tire(RATES[slot]);
const rnd = (a) => a[Math.floor(Math.random() * a.length)];

function nouveauJoueur() {
  return {
    fanzzy: new Map(),        // id -> stade
    skins: new Set(), etats: new Set(), stuff: new Set(), actions: new Set(),
    scarves: 100, xp: 0, boosters: 0,
    src: { doublons: 0, poignees: 0, replis: 0, stuffDoublons: 0, duels: 0, paliers: 0, bonus: 0, missions: 0, boostersOfferts: 0 }, carte: 0,
    depense: { evolutions: 0 },
  };
}

function places(j, sorte) {
  // le nombre de places encore libres pour une tenue / un état
  let n = 0;
  for (const [, stade] of j.fanzzy) n += stade * (sorte === 'skin' ? N_TENUES : ETATS);
  const pris = sorte === 'skin' ? j.skins.size : j.etats.size;
  return n - pris;
}

function ouvrirBooster(j) {
  j.boosters++;
  let gain = 0;
  const avant = new Map(j.fanzzy);
  for (let i = 0; i < 5; i++) {
    const ouverte = i >= 2 || (i === 1 && Math.random() >= 0.7);
    if (ouverte) {
      const cat = tire(PLACES_OUVERTES);
      /* Une catégorie épuisée rend la poignée de repli (deux écharpes, depuis
         le 6 octobre 2026), la catégorie des écharpes sa poignée tirée. */
      const poignee = (repli) => { const n = repli ? POIGNEE_DE_REPLI : tire(POIGNEES); gain += n;
        if (repli) j.src.replis += n; else j.src.poignees += n; };
      if (cat === 'echarpes') { poignee(false); continue; }
      if (cat === 'skin' || cat === 'etat') {
        // places libres calculées sur la collection d'avant le paquet
        let libres = 0;
        for (const [, st] of avant) libres += st * (cat === 'skin' ? N_TENUES : ETATS);
        libres -= (cat === 'skin' ? j.skins.size : j.etats.size);
        if (libres <= 0) { poignee(true); continue; }
        (cat === 'skin' ? j.skins : j.etats).add(`${cat}${(cat === 'skin' ? j.skins : j.etats).size}`);
        continue;
      }
      if (cat === 'stuff') {
        const vise = pickRarity(5);
        const def = STUFF_OUVERT.find((s) => s.rar === vise && !j.stuff.has(s.id))
          ?? STUFF_OUVERT.find((s) => !j.stuff.has(s.id));
        if (!def) { const d = rnd(STUFF_OUVERT); const n = SCARVES[d.rar] ?? 1;
          gain += n; j.src.stuffDoublons += n; continue; }
        j.stuff.add(def.id); continue;
      }
      // action
      const libres = ACTIONS_OUVERTES.filter((a) => !j.actions.has(a.id));
      if (!libres.length) { poignee(true); continue; }
      const vise = pickRarity(5);
      const pool = libres.filter((a) => a.rar === vise);
      j.actions.add(rnd(pool.length ? pool : libres).id);
      continue;
    }
    const rar = i < 2 ? pickRarity(i + 4) : 'commune';
    const id = rar === 'legendaire' ? `L${Math.floor(Math.random() * LEGENDES)}`
      : `C${Math.floor(Math.random() * COMMUNES)}`;
    if (j.fanzzy.has(id)) { const n = SCARVES[rar]; gain += n; j.src.doublons += n; }
    else j.fanzzy.set(id, 1);
  }
  j.scarves += gain;
  gagnerXp(j, 5);
  return gain;
}

function gagnerXp(j, n) {
  const avant = niveauPour(j.xp);
  j.xp += n;
  const apres = niveauPour(j.xp);
  for (let k = avant + 1; k <= apres; k++) {
    j.scarves += ecarpesDuPalier(k); j.src.paliers += ecarpesDuPalier(k);
  }
}

/* Un duel : barème de nvn/index.js. 50 % de victoires, une partie sur quatre
   jouée pour son club (le club joue un ou deux jours par semaine). */
function duel(j, mode) {
  const g = mode === 'classe' ? { gagne: 30, perdu: 12 } : { gagne: 15, perdu: 6 };
  const gagne = Math.random() < 0.5;
  const club = Math.random() < 0.25 ? 2 : 1;
  const n = (gagne ? g.gagne : g.perdu) * club;
  j.scarves += n; j.src.duels += n;
  gagnerXp(j, (mode === 'classe' ? 20 : 12) + (gagne ? 15 : 0));
}

/* Le joueur fait grandir dès qu'il peut, les deuxièmes âges d'abord. */
function depenser(j) {
  let fait = true;
  while (fait) {
    fait = false;
    for (const vers of [2, 3]) {
      for (const [id, st] of j.fanzzy) {
        if (id.startsWith('L') || st !== vers - 1) continue;
        if (j.scarves >= EVO_COST[vers]) {
          j.scarves -= EVO_COST[vers]; j.depense.evolutions += EVO_COST[vers];
          j.fanzzy.set(id, vers); fait = true;
        }
      }
      if (fait) break;
    }
  }
}

const PROFILS = {
  assidu:      { jours: 7, boosters: 48, classes: 5, entrainements: 4 },
  moyen:       { jours: 5, boosters: 24, classes: 2, entrainements: 1 },
  occasionnel: { jours: 3, boosters: 12, classes: 1, entrainements: 0 },
};

const N = 400;
const JOURS = 42;
console.log(`Scénario : ${TOUT ? 'tout le contenu du code ouvert' : 'LA REPRISE seule'}`
  + ` — ${STUFF_OUVERT.length} pièces, ${ACTIONS_OUVERTES.length} actions non communes,`
  + ` ${N_TENUES} tenues, ${COMMUNES}+${LEGENDES} Fanzzy\n`);

for (const [nom, p] of Object.entries(PROFILS)) {
  const parJour = Array.from({ length: JOURS }, () => ({ booster: 0, duel: 0, palier: 0, quot: 0, offerts: 0, xp: 0, n: 0 }));
  const etats = [];
  for (let k = 0; k < N; k++) {
    const j = nouveauJoueur();
    for (let d = 0; d < JOURS; d++) {
      const joue = (d % 7) < p.jours;
      const avant = { ...j.src }; const xp0 = j.xp;
      if (joue) {
        for (let b = 0; b < (d === 0 ? Math.min(p.boosters, 3 + 12) : p.boosters); b++) ouvrirBooster(j);
        for (let c = 0; c < p.classes; c++) duel(j, 'classe');
        for (let c = 0; c < p.entrainements; c++) duel(j, 'entrainement');
        if (MISSIONS) {
          const r = REUSSITE[nom];
          let toutes = true;
          for (const k of ['facile', 'moyenne', 'difficile']) {
            if (Math.random() < r[k]) { j.scarves += M[k].e; j.src.missions += M[k].e; gagnerXp(j, M[k].xp); }
            else toutes = false;
          }
          if (toutes) { j.src.boostersOfferts++; ouvrirBooster(j); }
          const b = CARTE[j.carte % 7]; j.scarves += b; j.src.bonus += b;
          if (j.carte % 7 === 6) { j.src.boostersOfferts++; ouvrirBooster(j); }
          j.carte++;
        }
        depenser(j);
      }
      const pj = parJour[d];
      pj.booster += (j.src.doublons - avant.doublons) + (j.src.poignees - avant.poignees)
        + (j.src.replis - avant.replis) + (j.src.stuffDoublons - avant.stuffDoublons);
      pj.duel += j.src.duels - avant.duels;
      pj.palier += j.src.paliers - avant.paliers;
      pj.quot += (j.src.missions - avant.missions) + (j.src.bonus - avant.bonus);
      pj.offerts += j.src.boostersOfferts - avant.boostersOfferts;
      pj.xp += j.xp - xp0;
      pj.n++;
      if ([0, 6, 13, 27, 41].includes(d)) etats.push({ d, k, fz: j.fanzzy.size,
        st3: [...j.fanzzy.values()].filter((s) => s === 3).length,
        st2: [...j.fanzzy.values()].filter((s) => s >= 2).length,
        niv: niveauPour(j.xp), scarves: j.scarves, boosters: j.boosters,
        stuff: j.stuff.size, actions: j.actions.size, skins: j.skins.size, etats: j.etats.size,
        evo: j.depense.evolutions });
    }
  }
  console.log(`== ${nom} : ${p.jours} j/sem, ${p.boosters} boosters, ${p.classes} classés,`
    + ` ${p.entrainements} entraînements par jour joué`);
  const sem = (a, b) => {
    let bo = 0, du = 0, pa = 0, qu = 0, of = 0, xp = 0;
    for (let d = a; d < b; d++) { bo += parJour[d].booster; du += parJour[d].duel; pa += parJour[d].palier;
      qu += parJour[d].quot; of += parJour[d].offerts; xp += parJour[d].xp; }
    return { bo: bo / N, du: du / N, pa: pa / N, qu: qu / N, of: of / N, xp: xp / N };
  };
  for (const [a, b, l] of [[0, 7, 'semaine 1'], [7, 14, 'semaine 2'], [14, 28, 'semaines 3-4 (par sem.)'],
    [28, 42, 'semaines 5-6 (par sem.)']]) {
    const s = sem(a, b);
    const f = (b - a) > 7 ? 2 : 1;
    console.log(`  ${l.padEnd(26)} boosters ${String(Math.round(s.bo / f)).padStart(5)}`
      + ` · duels ${String(Math.round(s.du / f)).padStart(4)} · paliers ${String(Math.round(s.pa / f)).padStart(4)}`
      + ` · quotidien ${Math.round(s.qu / f)} · total ${Math.round((s.bo + s.du + s.pa + s.qu) / f)}`
      + ` · boosters offerts ${(s.of / f).toFixed(1)} · XP ${Math.round(s.xp / f)}`);
  }
  for (const d of [0, 6, 13, 27, 41]) {
    const l = etats.filter((e) => e.d === d);
    const m = (k) => (l.reduce((s, e) => s + e[k], 0) / l.length).toFixed(1);
    console.log(`  fin jour ${String(d + 1).padStart(2)} : ${m('fz')} Fanzzy, ${m('st2')} au 2e âge,`
      + ` ${m('st3')} au 3e, niv ${m('niv')}, solde ${m('scarves')}, ${m('stuff')} pièces,`
      + ` ${m('actions')} actions, ${m('skins')} tenues, ${m('etats')} états, évol. ${m('evo')}`);
  }
  console.log('');
}

/* Ce que rend un booster quand tout est possédé (régime établi). */
{
  const j = nouveauJoueur();
  for (let i = 0; i < COMMUNES; i++) j.fanzzy.set(`C${i}`, 3);
  for (let i = 0; i < LEGENDES; i++) j.fanzzy.set(`L${i}`, 1);
  for (let i = 0; i < 2000; i++) { j.skins.add(`skin${i}`); j.etats.add(`etat${i}`); }
  for (const s of STUFF_OUVERT) j.stuff.add(s.id);
  for (const a of ACTIONS_OUVERTES) j.actions.add(a.id);
  const T = 200_000; let tot = 0;
  j.scarves = 0;
  for (let i = 0; i < T; i++) tot += ouvrirBooster(j);
  console.log(`Régime établi (tout possédé) : un booster rend ${(tot / T).toFixed(1)} écharpes`
    + ` en moyenne, contre ${45} pour l'acheter.`);
}
{
  const j = nouveauJoueur();
  const T = 20; let tot = 0;
  for (let r = 0; r < 2000; r++) { const x = nouveauJoueur(); for (let i = 0; i < T; i++) tot += ouvrirBooster(x); }
  console.log(`Les 20 premiers boosters d'un nouveau : ${(tot / (2000 * T)).toFixed(1)} écharpes par booster.`);
}
console.log(`Seuils de niveau : 5 → ${seuil(5)} XP, 10 → ${seuil(10)}, 15 → ${seuil(15)},`
  + ` 20 → ${seuil(20)}, 30 → ${seuil(30)}`);
