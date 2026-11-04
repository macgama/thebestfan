#!/usr/bin/env node
/**
 * Catalogue des images visibles par les joueurs — construction.
 *
 *   node construire.mjs --repo <clone de thebestfan> [--ref origin/main] [--out <dossier>]
 *
 * Lit l'arbre de `ref` (sans rien changer au clone), range chaque image dans
 * sa section, signale ce qui manque, fabrique une planche de vignettes par
 * groupe (vignettes.py) et écrit <out>/index.html + <out>/vignettes/*.webp.
 *
 * Les planches dont le contenu n'a pas changé (mêmes blobs) sont gardées :
 * seuls les groupes modifiés sont refaits, et seuls leurs fichiers sont
 * récupérés dans un clone partiel (--filter=blob:none). Le résultat liste dans
 * <out>/a-publier.json les fichiers à envoyer à l'Artifact (changés + retirés).
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { execFileSync, spawnSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const REPO = path.resolve(arg('repo', '.'));
const REF = arg('ref', 'origin/main');
const OUT = path.resolve(arg('out', path.join(ICI, 'site')));
/* --disque <dossier> : depuis l'allègement du dépôt (PR #247), les images ne
   sont plus dans git ; on les lit dans ce dossier (le dépôt du PC de Gaël). */
const DISQUE = arg('disque', null) && path.resolve(arg('disque'));
const PYTHON = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
const VERSION_VIGNETTES = 'v1';            // changer pour tout refaire
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'catalogue-'));
process.on('exit', () => fs.rmSync(TMP, { recursive: true, force: true }));
fs.mkdirSync(path.join(OUT, 'vignettes'), { recursive: true });

const git = (a, o = {}) => execFileSync('git', a, { cwd: REPO, maxBuffer: 1 << 30, ...o });
const log = (...a) => console.error('[catalogue]', ...a);

/* ------------------------------------------------------------------ l'arbre */
const COMMIT = git(['rev-parse', REF]).toString().trim();
const DATE_COMMIT = git(['show', '-s', '--format=%cI', COMMIT]).toString().trim();
const ARBRE = new Map();                    // chemin -> sha
for (const l of git(['ls-tree', '-r', COMMIT, '--format=%(objectname) %(path)', '--', 'public', 'src'])
  .toString().split('\n')) {
  if (!l) continue;
  const i = l.indexOf(' ');
  ARBRE.set(l.slice(i + 1), l.slice(0, i));
}
const SUR_DISQUE = new Map();               // 'disque:<empreinte>' -> chemin absolu
if (DISQUE) {
  const marcher = (rel) => {
    let noms = []; try { noms = fs.readdirSync(path.join(DISQUE, rel), { withFileTypes: true }); } catch { return; }
    for (const d of noms) {
      const r = rel + '/' + d.name;
      if (d.isDirectory()) { marcher(r); continue; }
      if (!/\.(webp|png|jpe?g|avif|gif|svg|mp4|webm)$/i.test(d.name) || ARBRE.has(r)) continue;
      const abs = path.join(DISQUE, r); const st = fs.statSync(abs);
      const id = 'disque:' + crypto.createHash('sha1').update(r + ':' + st.size + ':' + Math.floor(st.mtimeMs)).digest('hex');
      ARBRE.set(r, id); SUR_DISQUE.set(id, abs);
    }
  };
  marcher('public');
  log('disque', DISQUE, SUR_DISQUE.size, 'images hors git');
}
log('commit', COMMIT.slice(0, 8), ARBRE.size, 'fichiers');

const partiel = (() => {
  try { return git(['config', '--get', 'remote.origin.promisor']).toString().trim() === 'true'; } catch { return false; }
})();
let manquants = null;                       // blobs absents du clone partiel
function assurerBlobs(shas) {
  shas = shas.filter((s) => s && !s.startsWith('disque:'));
  if (!partiel || !shas.length) return;
  if (!manquants) {
    manquants = new Set();
    const r = spawnSync('git', ['rev-list', '--objects', '--no-walk', '--missing=print', COMMIT],
      { cwd: REPO, maxBuffer: 1 << 30 });
    for (const l of r.stdout.toString().split('\n')) if (l.startsWith('?')) manquants.add(l.slice(1).trim());
  }
  const a = [...new Set(shas)].filter((s) => !s.startsWith('disque:') && manquants.has(s));
  for (let i = 0; i < a.length; i += 2000) {
    const lot = a.slice(i, i + 2000);
    log('récupération de', lot.length, 'fichiers');
    for (let essai = 0; essai < 4; essai++) {
      const r = spawnSync('git', ['-c', 'fetch.negotiationAlgorithm=noop', 'fetch', 'origin', '--no-tags',
        '--no-write-fetch-head', '--filter=blob:none', '--stdin'],
      { cwd: REPO, input: lot.join('\n') + '\n', maxBuffer: 1 << 30 });
      if (r.status === 0) break;
      log('échec du fetch, nouvel essai', r.stderr?.toString().slice(0, 200));
    }
    lot.forEach((s) => manquants.delete(s));
  }
}
/** Écrit les blobs demandés dans des fichiers : [{sha, dest}] */
function extraire(liste) {
  for (const x of liste) if (x.sha?.startsWith('disque:')) fs.copyFileSync(SUR_DISQUE.get(x.sha), x.dest);
  liste = liste.filter((x) => !x.sha?.startsWith('disque:'));
  if (!liste.length) return;
  assurerBlobs(liste.map((x) => x.sha));
  for (let i = 0; i < liste.length; i += 150) {
    const lot = liste.slice(i, i + 150);
    const r = spawnSync('git', ['cat-file', '--batch'], { cwd: REPO, input: lot.map((x) => x.sha).join('\n') + '\n', maxBuffer: 2 ** 31 });
    const buf = r.stdout; let p = 0;
    for (const x of lot) {
      const nl = buf.indexOf(10, p);
      const tete = buf.slice(p, nl).toString().split(' ');
      if (tete[1] !== 'blob') { p = nl + 1; continue; }
      const n = Number(tete[2]);
      fs.writeFileSync(x.dest, buf.subarray(nl + 1, nl + 1 + n));
      p = nl + 1 + n + 1;
    }
  }
}
const texte = (chemin) => {
  const sha = ARBRE.get(chemin); if (!sha) return null;
  const d = path.join(TMP, 'txt-' + sha); if (!fs.existsSync(d)) extraire([{ sha, dest: d }]);
  return fs.readFileSync(d, 'utf8');
};

/* ------------------------------------------------- le code du jeu (données) */
const SRC = path.join(TMP, 'src');
{
  /* Pas de `git archive` : dans un clone partiel, il réclame tous les blobs
     du commit (8 Go), même avec un chemin. On écrit src/ fichier par fichier. */
  const a = [...ARBRE].filter(([p]) => p.startsWith('src/'));
  for (const [p] of a) fs.mkdirSync(path.join(SRC, path.dirname(p)), { recursive: true });
  extraire(a.map(([p, sha]) => ({ sha, dest: path.join(SRC, p) })));
  fs.writeFileSync(path.join(SRC, 'package.json'), '{"type":"module"}');
}
const imp = (p) => import(pathToFileURL(path.join(SRC, p)).href);
const { DEX, SETS } = await imp('src/shared/fanzzy/dex.js');
const { ACTIONS } = await imp('src/shared/duel/actions.js');
const { LISTE_CHANTS } = await imp('src/shared/duel/chants.js');
const { STADES } = await imp('src/shared/stades.js');
const { STUFF, SKINS } = await imp('src/shared/fanzzy/inventaire.js');

const ultimeJs = texte('public/ultime.js') ?? '';
const table = (nom) => {
  const m = new RegExp(`const ${nom}\\s*=\\s*\\{([\\s\\S]*?)\\n\\s*\\};`).exec(ultimeJs);
  const o = {}; if (m) for (const x of m[1].matchAll(/'([^']+)'\s*:\s*'([^']+)'/g)) o[x[1]] = x[2];
  return o;
};
const ULT_IMAGES = table('IMAGES');
const ULT_CLIPS = table('CLIPS');
const artJs = texte('public/fanzzy-art.js') ?? '';
const ILLUSTRES = new Set([...(/const ILLUSTRES\s*=\s*new Set\(\[([\s\S]*?)\]\)/.exec(artJs)?.[1] ?? '')
  .matchAll(/'([A-Z]+\d+[A-Z]?)'/g)].map((m) => m[1]));
const cartesJs = texte('public/cartes.js') ?? '';
const PACKS = {};
for (const m of (/const ART\s*=\s*\{([\s\S]*?)\n\};/.exec(cartesJs)?.[1] ?? '').matchAll(/^\s*([A-Z]{2}):\s*'([^']+)'/gm)) PACKS[m[1]] = 'public/' + m[2];
const MANIFESTE = JSON.parse(texte('public/img/fanzzy/index.json') ?? '{"fanzzy":{}}').fanzzy;

/* -------------------------------------------------------------- les groupes */
const EXT = ['.webp', '.png', '.jpg', '.jpeg', '.gif', '.avif'];
/** Le fichier à vignetter pour un chemin sans extension, ou null. */
const fichier = (sans) => { for (const e of EXT) if (ARBRE.has(sans + e)) return sans + e; return null; };
const GROUPES = new Map();                  // id -> {w, h, fichiers: [chemin], index: Map}
const groupe = (id, w = 96, h = 120) => {
  if (!GROUPES.has(id)) GROUPES.set(id, { id, w, h, fichiers: [], index: new Map() });
  return GROUPES.get(id);
};
const UTILISES = new Set();
/** Une case d'image présente : {t, p, g, i, ...} */
function img(g, chemin, t, extra = {}) {
  UTILISES.add(chemin.replace(/\.[a-z0-9]+$/i, ''));
  if (!g.index.has(chemin)) { g.index.set(chemin, g.fichiers.length); g.fichiers.push(chemin); }
  return { t, p: chemin, g: g.id, i: g.index.get(chemin), ...extra };
}
const manque = (t, n, k = 'manque') => ({ t, k, n });
const imgOu = (g, sans, t, n, extra) => { const f = fichier(sans); return f ? img(g, f, t, extra) : manque(t, n); };

const TENUES = SKINS.filter((s) => s.publie !== false).map((s) => s.id);         // base + 3 skins
const NOM_TENUE = Object.fromEntries(SKINS.map((s) => [s.id, s.id === 'base' ? 'Base' : s.nom]));
const NOM_AGE = { 1: 'Âge 1', 2: 'Âge 2', 3: 'Âge 3' };
const ORDRE_ETATS = ['neutre', 'pousse', 'joie', 'depit', 'colere', 'portrait', 'cligne', 'salut', 'but',
  'encaisse', 'attente', 'victoire', 'defaite', 'occasion', 'decision', 'progression', 'ennui'];
const stats = {};                           // section -> {ok, manque}
const compte = (sec, items) => {
  const s = stats[sec] ??= { ok: 0, manque: 0 };
  for (const x of items) { if (x.k === 'manque') s.manque++; else if (x.p) s.ok++; }
  return items;
};

/* ------------------------------------------------------------------ Fanzzy */
const RAR = { commune: 'Commune', rare: 'Rare', epique: 'Épique', legendaire: 'Légendaire' };
const series = [];
const parRacine = new Map();
for (const f of DEX) {
  const r = /^([A-Z]+\d+)/.exec(f.id)[1];
  if (!parRacine.has(r)) parRacine.set(r, []);
  parRacine.get(r).push(f);
}
const numero = (id) => Number(/\d+/.exec(id)[0]);
for (const s of SETS) {
  const gS = groupe('serie-' + s.id);
  const racines = [...parRacine.keys()].filter((r) => parRacine.get(r)[0].set === s.id).sort((a, b) => numero(a) - numero(b));
  const lignees = [];
  const bilan = { cartes: 0, cartesOk: 0, etats: 0, tenues: 0, tenuesOk: 0, ult: 0, ultOk: 0, clips: 0, cligne: 0 };
  for (const r of racines) {
    const cartes = parRacine.get(r).sort((a, b) => a.stage - b.stage);
    const dossier = `public/img/fanzzy/${r}`;
    const aEtats = [...ARBRE.keys()].some((p) => p.startsWith(dossier + '/e'));
    const L = { id: r, nom: cartes[0].nom, rar: cartes[0].rar, lignes: [], detail: null, manques: 0 };
    // 1. Les cartes (fichier plat de chaque âge, et son buste)
    const lc = [];
    for (const c of cartes) {
      bilan.cartes++;
      const plat = fichier(`public/img/fanzzy/${c.id}`);
      const etatsAge = MANIFESTE[r]?.evolutions?.['e' + c.stage]?.skins?.base;
      const t = `${c.id} · ${NOM_AGE[c.stage]}`;
      if (plat && ILLUSTRES.has(c.id)) { lc.push(img(gS, plat, t, { n: `${c.nom} · ${RAR[c.rar] ?? c.rar}` })); bilan.cartesOk++; }
      else if (plat) { lc.push(img(gS, plat, t, { k: 'repli', n: 'Dessin présent mais pas branché (liste ILLUSTRES de fanzzy-art.js)' })); bilan.cartesOk++; }
      else if (etatsAge && fichier(`${dossier}/e${c.stage}/base/neutre`)) { const f = fichier(`${dossier}/e${c.stage}/base/neutre`); lc.push(img(gS, f, t, { n: 'Carte tirée des états (pas de fichier plat)' })); bilan.cartesOk++; }
      else {
        const repli = c.stage > 1 && ILLUSTRES.has(r) ? `Le joueur voit le dessin de l'âge 1 (${r})` : 'Pas de dessin : le jeu montre un repli dessiné au code';
        lc.push(manque(t, repli));
      }
      const buste = fichier(`public/img/fanzzy/${c.id}-buste`);
      if (buste) lc.push(img(gS, buste, `${c.id} · buste`, { petit: 1 }));
    }
    L.lignes.push({ titre: 'Cartes', items: lc });
    // 2. Les tenues, par âge (vue courte : neutre ; détail : tous les états)
    if (aEtats) {
      const gD = groupe('etats-' + r);
      const det = [];
      for (const c of cartes) {
        const e = c.stage;
        const lt = [];
        for (const tn of TENUES) {
          bilan.tenues++;
          const dt = `${dossier}/e${e}/${tn}`;
          const fichiers = [...ARBRE.keys()].filter((p) => p.startsWith(dt + '/'));
          if (!fichiers.length) {
            lt.push(manque(`${NOM_TENUE[tn]}`, tn === 'base' ? `Âge ${e} sans dessin d'états` : `Tenue pas dessinée : le joueur voit la tenue de base`));
            det.push({ titre: `Âge ${e} · ${NOM_TENUE[tn]}`, items: [manque('—', 'Tenue pas dessinée', 'info')] });
            continue;
          }
          bilan.tenuesOk++;
          const n = fichier(`${dt}/neutre`) ?? fichiers[0];
          const cligne = !!fichier(`${dt}/cligne`); if (cligne) bilan.cligne++;
          lt.push(img(gS, n, NOM_TENUE[tn], { n: `Âge ${e}${cligne ? '' : ' · ne cligne pas'}`, cl: cligne ? 1 : 0 }));
          const noms = [...new Set(fichiers.map((p) => path.basename(p).replace(/\.[a-z0-9]+$/i, '')))]
            .sort((a, b) => (ORDRE_ETATS.indexOf(a) + 99) % 99 - (ORDRE_ETATS.indexOf(b) + 99) % 99 || a.localeCompare(b));
          const it = noms.map((nm) => img(gD, fichier(`${dt}/${nm}`), nm));
          bilan.etats += it.length;
          for (const x of ['neutre', 'pousse', 'joie', 'depit', 'colere']) if (!noms.includes(x)) it.push(manque(x, 'État manquant'));
          if (!noms.includes('cligne')) it.push(manque('cligne', 'Ne cligne pas des yeux', 'info'));
          det.push({ titre: `Âge ${e} · ${NOM_TENUE[tn]}`, items: it });
        }
        L.lignes.push({ titre: `Tenues · âge ${e}`, items: lt });
      }
      L.detail = { groupe: gD.id, lignes: det };
      compte('fanzzy', det.flatMap((l) => l.items).filter((x) => !x.p || !x.p.endsWith('/neutre.webp')));
    }
    // 3. Les Ultimate, par âge (et par tenue quand elles existent)
    const lu = [];
    for (const c of cartes) {
      bilan.ult++;
      const cle = `${r}-e${c.stage}`;
      const f = ULT_IMAGES[cle] && ARBRE.has(`public/img/ultime/${ULT_IMAGES[cle]}`) ? `public/img/ultime/${ULT_IMAGES[cle]}` : null;
      const clip = !!(ULT_CLIPS[cle] && ARBRE.has(`public/img/ultime/${ULT_CLIPS[cle]}`));
      if (clip) bilan.clips++;
      if (f) { bilan.ultOk++; lu.push(img(gS, f, `Ultimate ${NOM_AGE[c.stage].toLowerCase()}`, { n: clip ? 'Image et clip animé' : 'Image seule (pas de clip)', clip: clip ? 1 : 0 })); }
      else lu.push(manque(`Ultimate ${NOM_AGE[c.stage].toLowerCase()}`, 'Pas d\'image : la scène est dessinée au code'));
      for (const tn of TENUES.filter((x) => x !== 'base')) {
        const k2 = `${cle}-${tn}`;
        if (ULT_IMAGES[k2] && ARBRE.has(`public/img/ultime/${ULT_IMAGES[k2]}`))
          lu.push(img(gS, `public/img/ultime/${ULT_IMAGES[k2]}`, `Ultimate âge ${c.stage} · ${NOM_TENUE[tn]}`, { n: ULT_CLIPS[k2] ? 'Image et clip' : 'Image seule', clip: ULT_CLIPS[k2] ? 1 : 0 }));
        else if (aEtats) lu.push(manque(`Ultimate âge ${c.stage} · ${NOM_TENUE[tn]}`, 'Pas encore dessiné : le joueur voit l\'Ultimate de base', 'info'));
      }
    }
    L.lignes.push({ titre: 'Ultimate', items: lu });
    for (const li of L.lignes) L.manques += li.items.filter((x) => x.k === 'manque').length;
    compte('fanzzy', L.lignes.flatMap((l) => l.items));
    lignees.push(L);
  }
  const dos = fichier(`public/img/dos/${s.id}`);
  const logo = fichier(`public/img/logo/serie-${s.id}`);
  const pack = PACKS[s.id] ? fichier(PACKS[s.id]) : null;
  series.push({ id: s.id, nom: s.nom, ligne: s.ligne, c1: s.c1, groupe: gS.id, bilan, lignees,
    tete: compte('fanzzy', [
      dos ? img(gS, dos, 'Dos des cartes') : manque('Dos des cartes', 'Pas de dos dessiné pour la série'),
      logo ? img(gS, logo, 'Logo de série') : manque('Logo de série', 'Pas de logo de série'),
      pack ? img(gS, pack, 'Booster') : manque('Booster', 'Pas d\'image de booster : repli aux couleurs de la série'),
    ]) });
}

/* --------------------------------------------------------- autres sections */
const sections = [];
const bloc = (titre, items, n) => ({ titre, n, items });
const section = (id, titre, intro, blocs) => {
  blocs.forEach((b) => compte(id, b.items));
  sections.push({ id, titre, intro, blocs });
};
const FAM_ACTION = { pousse: 'Poussée', entrave: 'Entrave', souffle: 'Souffle', garde: 'Garde', soutien: 'Soutien' };
{
  const g = groupe('actions', 90, 120);
  const fams = [...new Set(ACTIONS.map((a) => a.fam))];
  section('actions', 'Cartes action', 'Les cartes jouées pendant les duels et au Virage (src/shared/duel/actions.js).',
    fams.map((f) => bloc(FAM_ACTION[f] ?? f, ACTIONS.filter((a) => a.fam === f)
      .map((a) => imgOu(g, `public/img/action/${a.id}`, a.nom, 'Pas d\'illustration', { n: `${RAR[a.rar] ?? a.rar} · ${a.id}` })))));
}
{
  const g = groupe('stuff', 96, 96);
  const clubs = STUFF.filter((s) => s.club != null), autres = STUFF.filter((s) => s.club == null);
  const it = (s) => imgOu(g, `public/img/stuff/${s.id}`, s.nom, 'Pas de dessin',
    { n: `${RAR[s.rar] ?? s.rar}${s.publie === false ? ' · fermée (à ouvrir dans /admin)' : ''}`, k: s.publie === false ? 'ferme' : undefined });
  const prefixes = [...new Set(autres.map((s) => (/^([a-z]{2})-/.exec(s.id)?.[1]) ?? ''))];
  const nomPref = { '': 'Pièces d\'origine', rp: 'La Reprise', an: 'Les Terraces', su: 'Die Kurve', hw: 'Halloween', ph: 'Préhistorique', ap: 'Apocalyptique', vp: 'Les VIP', gc: 'Gastronomie de comptoir', gd: 'Galères de déplacement', hc: 'Héros du canapé', mt: 'Phénomènes météo' };
  const blocs = prefixes.map((p) => bloc(nomPref[p] ?? p.toUpperCase(), autres.filter((s) => ((/^([a-z]{2})-/.exec(s.id)?.[1]) ?? '') === p).map(it)));
  if (clubs.length) blocs.push(bloc('Pièces de club (COMBO / PLEIN CLUB)', clubs.map(it)));
  const gains = ['echarpes', 'billets'].map((x) => imgOu(g, `public/img/gains/${x}`, x === 'echarpes' ? 'Écharpes (monnaie)' : 'Billets (monnaie)', 'Manque'));
  blocs.push(bloc('Monnaies du jeu', gains));
  section('stuff', 'Équipement', 'Les cent quarante pièces d\'équipement (src/shared/fanzzy/inventaire.js) et les monnaies. « Fermée » : pas encore en vente.', blocs);
}
{
  const g = groupe('chants', 120, 90);
  section('chants', 'Chants (duel et mini-jeu)', 'Les cartes de chant des duels, du Virage et du mini-jeu « chant en rythme » (src/shared/duel/chants.js).',
    [bloc('Chants', LISTE_CHANTS.map((c) => imgOu(g, `public/img/chant/${c.id}`, c.nom, 'Pas d\'illustration', { n: c.id })))]);
}
{
  const g = groupe('stades', 160, 100);
  section('stades', 'Stades', 'Les stades des duels et du Virage (src/shared/stades.js), en grand et en vignette.',
    [bloc('Stades', STADES.flatMap((s) => [
      imgOu(g, `public/img/stade/${s.id}`, s.nom, 'Pas d\'image : repli dessiné au code', { n: RAR[s.rar] ?? s.rar }),
      imgOu(g, `public/img/stade/${s.id}-mini`, `${s.nom} · vignette`, 'Pas de vignette', { petit: 1 }),
    ]))]);
}
{
  const g = groupe('fonds', 80, 120);
  const rar = ['commune', 'rare', 'epique', 'legendaire'];
  const tenuesFonds = ['base', 'RP', ...TENUES.filter((t) => t !== 'base')];
  section('fonds', 'Fonds de cartes', 'Les fonds posés derrière les Fanzzy, par tenue et par rareté.',
    tenuesFonds.map((t) => bloc(t === 'RP' ? 'La Reprise' : NOM_TENUE[t], rar.map((r) => imgOu(g, `public/img/fonds/${t}-${r}`, RAR[r], 'Fond manquant')))));
}
{
  const g = groupe('boosters', 80, 120);
  const sets = new Set(SETS.map((s) => s.id));
  const packs = [...ARBRE.keys()].filter((p) => /^public\/img\/pack-[^/]+\.webp$/.test(p));
  const branches = new Set(Object.values(PACKS));
  const items = packs.map((p) => {
    const sans = p.replace(/\.webp$/, '');
    const set = Object.entries(PACKS).find(([, v]) => v === sans)?.[0];
    return img(g, p, path.basename(sans).replace('pack-', '').replace(/-/g, ' '), branches.has(sans)
      ? { n: `Série ${set}` } : { k: 'info', n: 'Plus demandé par le jeu (série partie)' });
  });
  const sans = [...sets].filter((s) => !PACKS[s]).map((s) => manque(`Booster ${s}`, 'Pas d\'image : repli aux couleurs de la série'));
  section('boosters', 'Boosters', 'Les paquets du kiosque (carte ART de public/cartes.js).', [bloc('Boosters', [...items, ...sans])]);
}
{
  const g = groupe('ecrans', 120, 120);
  const tout = (dir) => [...new Set([...ARBRE.keys()].filter((p) => p.startsWith(dir + '/') && !p.slice(dir.length + 1).includes('/') && /\.(webp|png|jpe?g|avif)$/i.test(p))
    .map((p) => p.replace(/\.[a-z0-9]+$/i, '')))].sort();
  const lot = (dir, nom = (s) => path.basename(s)) => tout(dir).map((s) => imgOu(g, s, nom(s), ''));
  const racine = tout('public/img').filter((s) => !/\/pack-/.test(s));
  section('ecrans', 'Écrans, dos et logos', 'Les images de décor de l\'application : accueil, chargement, supporter du duel, dos des cartes et logos de chaque série, icônes de l\'application, textures de fond.', [
    bloc('Accueil, logo et icônes', racine.map((s) => imgOu(g, s, path.basename(s), ''))),
    bloc('Écrans de chargement', lot('public/img/ecran')),
    bloc('Supporter (duel)', lot('public/img/supporter')),
    bloc('Dos des cartes, par série', SETS.map((s) => imgOu(g, `public/img/dos/${s.id}`, `${s.id} · ${s.nom}`, 'Pas de dos dessiné pour la série'))),
    bloc('Logos de série', SETS.map((s) => imgOu(g, `public/img/logo/serie-${s.id}`, `${s.id} · ${s.nom}`, 'Pas de logo : le jeu n\'affiche rien à la place'))),
    bloc('Logos de rareté et de famille', lot('public/img/logo').filter((x) => !/serie-/.test(x.p ?? ''))),
    bloc('Textures (grain posé sous les fonds et les cadres, ui.css)', lot('public/img/grain')),
    bloc('Arène', lot('public/img/arene')),
  ]);
}
/* Les vidéos : une image tirée de chaque clip (hors clips Ultimate, comptés plus haut). */
const VIDEOS = [...ARBRE.keys()].filter((p) => p.startsWith('public/video/') && p.endsWith('.mp4'));
const jsTout = [...ARBRE.keys()].filter((p) => /^public\/[^/]+\.(js|html)$/.test(p));
const demandees = new Set();
assurerBlobs(jsTout.map((p) => ARBRE.get(p)));
for (const p of jsTout) { const t = texte(p) ?? ''; for (const m of t.matchAll(/video\/([A-Za-z0-9._-]+\.mp4)/g)) demandees.add('public/video/' + m[1]); }
{
  const g = groupe('videos', 90, 120);
  section('videos', 'Vidéos de fond', 'Les fonds animés (cérémonies, booster, victoire, défaite). Vignette : une image du clip.',
    [bloc('Vidéos', [...VIDEOS.map((v) => img(g, v, path.basename(v).replace(/\.[0-9a-f]{8}\.mp4$|\.mp4$/, ''), demandees.has(v) ? { video: 1 } : { video: 1, k: 'info', n: 'Plus demandée par le jeu' })),
      ...[...demandees].filter((v) => !ARBRE.has(v)).map((v) => manque(path.basename(v), 'Nommée dans le code (commentaire ou ancien appel), absente du dépôt', 'info'))])]);
}
/* Les fichiers Fanzzy sans fiche dans le catalogue. */
{
  const g = groupe('orphelins', 96, 120);
  const ids = new Set(DEX.map((f) => f.id));
  const plats = [...new Set([...ARBRE.keys()].filter((p) => /^public\/img\/fanzzy\/[A-Z]+\d+[A-Z]?(-buste)?\.(webp|png)$/.test(p))
    .map((p) => p.replace(/\.[a-z]+$/, '')))].filter((s) => !ids.has(path.basename(s).replace(/-buste$/, '')));
  if (plats.length) section('orphelins', 'Fichiers sans fiche', 'Dessins de Fanzzy présents dans le dépôt mais sans fiche dans le catalogue : aucun joueur ne les voit.',
    [bloc('Fichiers', plats.map((s) => img(g, fichier(s), path.basename(s), { k: 'info' })))]);
}

/* ------------------------------------------------------ planches de vignettes */
const etatPath = path.join(OUT, 'etat.json');
const ancien = fs.existsSync(etatPath) ? JSON.parse(fs.readFileSync(etatPath, 'utf8')) : {};
const nouveau = {};
const aPublier = {};
for (const g of GROUPES.values()) {
  if (!g.fichiers.length) continue;
  const h = crypto.createHash('sha1').update([VERSION_VIGNETTES, g.w, g.h, ...g.fichiers.map((p) => p + ':' + ARBRE.get(p))].join('\n')).digest('hex').slice(0, 10);
  const cols = Math.min(g.fichiers.length, Math.max(8, Math.ceil(Math.sqrt(g.fichiers.length * g.h / g.w))));
  const nomFichier = `vignettes/${g.id}.webp`;
  g.hash = h; g.cols = cols;
  nouveau[g.id] = { hash: h, cols, n: g.fichiers.length };
  if (ancien[g.id]?.hash === h && fs.existsSync(path.join(OUT, nomFichier))) continue;
  log('planche', g.id, g.fichiers.length, 'images');
  const d = path.join(TMP, 'g-' + g.id); fs.mkdirSync(d, { recursive: true });
  const liste = g.fichiers.map((p, i) => ({ sha: ARBRE.get(p), dest: path.join(d, i + path.extname(p)), p }));
  extraire(liste);
  const files = liste.map((x) => {
    if (!x.p.endsWith('.mp4')) return x.dest;
    const png = x.dest.replace(/\.mp4$/, '.png');
    spawnSync('ffmpeg', ['-v', 'error', '-y', '-ss', '1', '-i', x.dest, '-frames:v', '1', png]);
    return png;
  });
  const job = path.join(d, 'job.json');
  fs.writeFileSync(job, JSON.stringify({ out: path.join(OUT, nomFichier), w: g.w, h: g.h, cols, files }));
  const r = spawnSync(PYTHON, ['-I', path.join(ICI, 'vignettes.py'), job], { maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error('vignettes.py : ' + r.stderr);
  const ech = JSON.parse(r.stdout.toString()).echecs; if (ech.length) log('illisibles', ech.slice(0, 5));
  fs.rmSync(d, { recursive: true, force: true });
  aPublier[nomFichier] = path.join(OUT, nomFichier);
}
for (const id of Object.keys(ancien)) if (!nouveau[id]) { aPublier[`vignettes/${id}.webp`] = null; fs.rmSync(path.join(OUT, `vignettes/${id}.webp`), { force: true }); }
fs.writeFileSync(etatPath, JSON.stringify(nouveau, null, 1));

/* -------------------------------------------------------------- la page */
const vignettes = Object.fromEntries([...GROUPES.values()].filter((g) => g.hash)
  .map((g) => [g.id, { u: `vignettes/${g.id}.webp?v=${g.hash}`, w: g.w, h: g.h, c: g.cols }]));
const DONNEES = { commit: COMMIT.slice(0, 8), dateCommit: DATE_COMMIT, genere: new Date().toISOString(), stats, series, sections, vignettes };
const gabarit = fs.readFileSync(path.join(ICI, 'gabarit.html'), 'utf8');
fs.writeFileSync(path.join(OUT, 'index.html'), gabarit.replace('/*DONNEES*/null', JSON.stringify(DONNEES).replace(/</g, '\\u003c')));
fs.writeFileSync(path.join(OUT, 'a-publier.json'), JSON.stringify(aPublier, null, 1));
fs.rmSync(TMP, { recursive: true, force: true });
const total = Object.values(stats).reduce((a, s) => ({ ok: a.ok + s.ok, manque: a.manque + s.manque }), { ok: 0, manque: 0 });
console.log(JSON.stringify({ commit: COMMIT.slice(0, 8), images: total.ok, manques: total.manque, parSection: stats, planchesRefaites: Object.keys(aPublier).length }));
