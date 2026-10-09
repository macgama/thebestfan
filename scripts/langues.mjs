/**
 * Les dictionnaires des langues du jeu.
 *
 *   npm run langues            relève les textes, construit public/i18n/*.js,
 *                              écrit i18n/a-traduire.json (ce qui manque)
 *   npm run langues:test       la même chose sans rien écrire : rouge si une
 *                              traduction est malformée (balise ou {n} perdu)
 *
 * Le français du code est la clé (voir `public/langue.js`). Ce script relève
 * tout le texte qu'un joueur peut lire — les pages, leurs scripts, les
 * contenus partagés (Fanzzy, cartes, stades) et les phrases que le serveur
 * renvoie — et le confronte aux traductions tenues à la main dans
 * `i18n/<langue>.json`, une par langue, sous la forme { "français": "…" }.
 *
 * **Un texte sans traduction n'est pas une faute** : il s'affiche en
 * français, et il est listé dans `i18n/a-traduire.json`. C'est ce qui arrive
 * à un Fanzzy qu'on vient d'ajouter. Une traduction qui perd une balise ou un
 * {n}, elle, casserait l'affichage : c'est la seule chose qui fait rougir.
 *
 * Les clés sont calculées par `public/langue.js` lui-même, chargé dans
 * jsdom : la page et ce script ne peuvent pas diverger.
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { brotliCompressSync, gzipSync, constants as zlib } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';
import { JSDOM } from 'jsdom';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const ici = (...p) => path.join(RACINE, ...p);
const LANGUES = ['en', 'de', 'it', 'es'];
const VERIFIER = process.argv.includes('--verifier');

/* Les pages que le joueur ne voit pas. */
const PAS_JOUEUR = new Set(['admin.html', 'diagnostic.html', 'sw.js', 'langue.js']);
const PAS_JOUEUR_SHARED = new Set(['reglages.js', 'version.js', 'i18n']);

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { runScripts: 'outside-only' });
const { window } = dom;
window.TBF_LANGUE_SANS_MOTEUR = true;
window.eval(readFileSync(ici('public/langue.js'), 'utf8'));
const L = window.TBF_LANGUE;

/* ------------------------------------------------------------ relevé */

const textes = new Map(); // clé -> Set(fichiers)

/** Les {n} renumérotés dans l'ordre où ils paraissent. */
function renumeroter(s) {
  const vus = new Map();
  return s.replace(/\{(\d+)\}/g, (_, n) => {
    if (!vus.has(n)) vus.set(n, vus.size);
    return `{${vus.get(n)}}`;
  });
}

const CODE = /^[\w\-.#:()[\]{},%\s'’"=/>+*;!?@&|<$^~`\\]+$/;
function ajouter(brut, fichier) {
  let t = renumeroter(L.norm(brut));
  if (!t) return;
  const litteral = t.replace(/\{\d+\}/g, ' ').replace(/<\/?\d+\/?>/g, ' ');
  if (!/[A-Za-zÀ-ÿ]{2}/.test(litteral)) return;
  const accent = /[À-ÿ’«»]/.test(litteral);
  if (!accent) {
    if (/^\s*[a-z][\w-]*\s*$/.test(litteral)) return;                 // un identifiant
    if (/[(=:;]|px\b|\.\w|\/\w|^#|\b(var|rgba?|calc|url)\b/.test(litteral) && CODE.test(t)) return;
    if (/^[\w-]+(\s[\w-]+)*$/.test(litteral) && /[_]|[a-z][A-Z]/.test(litteral)) return; // nom_de_code
    if (/^[a-z-]+(\s+[a-z-]+)+$/.test(litteral.trim()) && /\b(on|off|hide|is|tbf|btn|fx|js)\b|-/.test(litteral)) return; // des classes
  }
  if (/^(https?:|mailto:|\/[\w/-]*$|data:)/.test(t)) return;
  if (/^[\w.-]+\.(js|css|png|avif|svg|mp3|mp4|html|json|webp|jpg)(\?.*)?$/.test(t)) return;
  if (/^\{0\}$/.test(t)) return;
  if (/\{(?!\d+\})|^\/\*|\*\/$/.test(t)) return;                         // du CSS, un commentaire
  if (/^[A-Z]{1,3}\d+[A-Z]?$|^[0-9a-f]{8,}$/.test(t)) return;               // un identifiant de carte, une empreinte
  if (!textes.has(t)) textes.set(t, new Set());
  textes.get(t).add(fichier);
}

const ATTR = ['title', 'placeholder', 'aria-label', 'alt'];
function html(src, fichier, fragment) {
  const doc = new window.DOMParser().parseFromString(
    fragment ? `<!doctype html><body>${src}</body>` : src, 'text/html');
  const scripts = [];
  const visiter = (n) => {
    if (n.nodeType === 1) {
      const tag = n.tagName;
      if (tag === 'SCRIPT') {
        if (!n.src && !/json|importmap/.test(n.type)) scripts.push(n.textContent);
        return;
      }
      if (tag === 'STYLE' || tag === 'svg' || tag === 'SVG' || n.getAttribute('translate') === 'no') return;
      for (const a of ATTR) { const v = n.getAttribute(a); if (v) ajouter(v, fichier); }
      if (tag === 'META' && /description/.test(n.getAttribute('name') ?? '')) ajouter(n.getAttribute('content') ?? '', fichier);
      if (tag === 'INPUT' && /button|submit/.test(n.type) && n.value) ajouter(n.value, fichier);
      if (L.estRiche(n)) { ajouter(L.cleRiche(n), fichier); return; }
      if (tag === 'TEMPLATE') visiter(n.content);
    }
    if (n.nodeType === 3) ajouter(n.data, fichier);
    for (const c of n.childNodes ?? []) visiter(c);
  };
  visiter(fragment ? doc.body : doc.documentElement);
  for (const s of scripts) js(s, fichier);
}

/* Les appels dont le premier argument n'est jamais du texte à lire. */
const SANS_TEXTE = new Set(['querySelector', 'querySelectorAll', 'getElementById', 'closest', 'matches',
  'add', 'remove', 'toggle', 'contains', 'addEventListener', 'removeEventListener', 'fetch',
  'getItem', 'setItem', 'removeItem', 'setProperty', 'getPropertyValue', 'createElement',
  'getAttribute', 'hasAttribute', 'removeAttribute', 'setAttribute', 'toggleAttribute', 'startsWith', 'endsWith', 'includes',
  'split', 'indexOf', 'lastIndexOf', 'test', 'match', 'log', 'warn', 'error', 'info', 'debug',
  'postMessage', 'dispatchEvent', 'Event', 'CustomEvent', 'RegExp', 'animate', 'require', 'query',
  'execute', 'get', 'post', 'put', 'patch', 'delete', 'use', 'on', 'emit', 'join', 'to', 'getContext',
  'insertAdjacentElement', 'replace', 'replaceAll', 'padStart', 'padEnd', 'Error', 'TypeError',
  'createHash', 'readFileSync', 'writeFileSync', 'mkdirSync', 'existsSync', 'join', 'resolve',
  'importScripts', 'preload', 'charger', 'jouer', 'son', 'vibrer', 'api', 'auth', 'appel']);

/* ------------------------------------------- les chaînes que le code compose

   Un texte du code n'est pas toujours écrit d'un bloc : `n + ' écharpe' +
   (n > 1 ? 's' : '')`, ou un gabarit `${…}`. On en tire toutes les formes
   qu'il peut prendre — une par branche d'un « ? : » —, chaque valeur
   inconnue devenant un trou, {0}, {1}… dans l'ordre. Au-delà de vingt-quatre
   formes, une alternative compte pour un trou. */
const TROU = '\uE000';
const MAX = 24;
const estChaine = (n) => (n.type === 'Literal' && typeof n.value === 'string') || n.type === 'TemplateLiteral'
  || (n.type === 'BinaryExpression' && n.operator === '+');
function produit(a, b) {
  if (a.length * b.length > MAX) b = [TROU];
  const r = [];
  for (const x of a) for (const y of b) r.push(x + y);
  return r;
}
function formes(n) {
  if (n.type === 'Literal') return typeof n.value === 'string' ? [n.value] : [TROU];
  if (n.type === 'TemplateLiteral') {
    let acc = [''];
    n.quasis.forEach((q, i) => {
      acc = acc.map((x) => x + (q.value.cooked ?? q.value.raw));
      if (i < n.expressions.length) acc = produit(acc, formes(n.expressions[i]));
    });
    return acc;
  }
  if (n.type === 'BinaryExpression' && n.operator === '+') return produit(formes(n.left), formes(n.right));
  if (n.type === 'ConditionalExpression') {
    const r = [...formes(n.consequent), ...formes(n.alternate)];
    return r.length > MAX ? [TROU] : r;
  }
  if (n.type === 'LogicalExpression' && /^(\|\||\?\?)$/.test(n.operator) && estChaine(n.right)) {
    return [TROU, ...formes(n.right)];
  }
  return [TROU];
}
const trous = (s) => { let k = 0; return s.replace(/\uE000/g, () => `{${k++}}`); };

function js(code, fichier) {
  let ast;
  for (const sourceType of ['module', 'script']) {
    try { ast = acorn.parse(code, { ecmaVersion: 'latest', sourceType, allowReturnOutsideFunction: true, allowHashBang: true }); break; }
    catch (e) { if (sourceType === 'script') { console.error(`  ${fichier} : ${e.message}`); return; } }
  }
  /* Les additions d'abord : leurs morceaux ne sont pas des textes à part. */
  const pris = new WeakSet();
  walk.fullAncestor(ast, (node, _e, anc) => {
    const parent = anc[anc.length - 2];
    if (node.type !== 'BinaryExpression' || node.operator !== '+') return;
    if (parent?.type === 'BinaryExpression' && parent.operator === '+') return;
    if (!formes(node).some((f) => f.replace(/\uE000/g, '').trim())) return;
    const marquer = (n) => { if (n !== node) pris.add(n); if (n.type === 'BinaryExpression') { marquer(n.left); marquer(n.right); } };
    marquer(node);
  });
  walk.fullAncestor(ast, (node, _e, anc) => {
    const parent = anc[anc.length - 2];
    let liste = null;
    /* Les traductions déjà écrites dans une page (compte.html les tient
       elle-même pour l'anglais, l'allemand et l'espagnol). */
    if (anc.some((a) => a.type === 'Property' && /^(en|de|es|it)$/.test(a.key?.name ?? a.key?.value))) return;
    if (node.type === 'BinaryExpression' && node.operator === '+') {
      if (pris.has(node)) return;
      if (parent?.type === 'BinaryExpression' && parent.operator === '+') return;
      liste = formes(node);
    } else if (node.type === 'Literal' || node.type === 'TemplateLiteral') {
      if (pris.has(node)) return;
      if (node.type === 'Literal' && typeof node.value !== 'string') return;
      liste = formes(node);
    } else return;

    if (parent) {
      if (parent.type === 'Property' && parent.key === node && !parent.computed) return;
      if (/^(Import|Export)/.test(parent.type)) return;
      if (parent.type === 'BinaryExpression' && /^[=!]==?$|^in$/.test(parent.operator)) return;
      if (parent.type === 'SwitchCase' && parent.test === node) return;
      if (parent.type === 'MemberExpression' && parent.property === node) return;
      if (parent.type === 'TaggedTemplateExpression') return;
      if ((parent.type === 'CallExpression' || parent.type === 'NewExpression') && parent.arguments[0] === node) {
        const c = parent.callee;
        const nom = c.type === 'MemberExpression' ? (c.property.name ?? c.property.value) : c.name;
        if (SANS_TEXTE.has(nom)) return;
      }
      if (parent.type === 'AssignmentExpression' && parent.left.type === 'MemberExpression'
        && /^(className|id|src|href|type|cssText|name|rel|key|lang)$/.test(parent.left.property?.name)) return;
    }
    for (const f of new Set(liste)) {
      const s = trous(f);
      if (/<[a-zA-Z/!]/.test(s)) html(s, fichier, true);
      else ajouter(s, fichier);
    }
  });
}

function dossier(d, rel, sauf) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    if (sauf.has(e.name)) continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) dossier(p, rel, sauf);
    else if (e.name.endsWith('.js')) js(readFileSync(p, 'utf8'), path.relative(RACINE, p));
  }
}

for (const nom of readdirSync(ici('public')).sort()) {
  if (PAS_JOUEUR.has(nom)) continue;
  const p = ici('public', nom);
  if (nom.endsWith('.html')) html(readFileSync(p, 'utf8'), `public/${nom}`, false);
  else if (nom.endsWith('.js')) js(readFileSync(p, 'utf8'), `public/${nom}`);
}
dossier(ici('src/shared'), 'src/shared', PAS_JOUEUR_SHARED);

/* Ce que les pages affichent et qu'aucun relevé du code ne trouve — des
   phrases montées en plusieurs fois, des mots tirés de la base. Relevés en
   navigant (`npm run langues:pages`), et gardés dans `i18n/releves.json`. */
if (existsSync(ici('i18n', 'releves.json'))) {
  for (const t of JSON.parse(readFileSync(ici('i18n', 'releves.json'), 'utf8'))) ajouter(t, 'i18n/releves.json');
}

/* Le serveur : seules les phrases françaises qu'il renvoie aux pages.
   Le reste — journaux, SQL, messages d'exploitation — reste en français. */
const avantServeur = new Set(textes.keys());
dossier(ici('src/server'), 'src/server', new Set(['admin', 'garde']));
const FRANCAIS = /[À-ÿ’]|\b(le|la|les|des|du|un|une|et|ton|ta|tes|est|pour|pas|ce|de|à|en|au|aux|tu|il|on)\b/i;
for (const [t, f] of [...textes]) {
  if (avantServeur.has(t)) continue;
  if (![...f].some((x) => x.startsWith('src/server'))) continue;
  if (!FRANCAIS.test(t.replace(/\{\d+\}/g, ''))
    || /\b(SELECT|INSERT|UPDATE|WHERE|JOIN|ALTER|TABLE|NULL)\b|sql\/|npm |\[\w+\]|`|SMTP|\.env|schema|colonne/i.test(t)) textes.delete(t);
}

/* ------------------------------------------------------- confrontation */

const balises = (s) => (s.match(/<\/?\d+\/?>/g) ?? []).sort().join(' ');
const places = (s) => [...new Set((s.match(/\{(\d+)/g) ?? []).map((x) => x.slice(1)))].sort().join(' ');

let fautes = 0;
const aTraduire = {};
const empreintes = {};
const bilan = [];
for (const l of LANGUES) {
  const source = ici('i18n', `${l}.json`);
  const tr = existsSync(source) ? JSON.parse(readFileSync(source, 'utf8')) : {};
  const exacts = {}, motifs = {};
  for (const [fr, cible] of Object.entries(tr)) {
    if (typeof cible !== 'string' || !cible.trim()) continue;
    if (balises(fr) !== balises(cible)) { console.error(`✗ ${l} : balises perdues — ${fr}`); fautes++; continue; }
    if (places(fr) !== places(cible)) { console.error(`✗ ${l} : {n} perdu — ${fr}`); fautes++; continue; }
    (/\{\d+\}/.test(fr) ? motifs : exacts)[fr] = cible;
  }
  const manque = [...textes.keys()].filter((t) => !(t in tr));
  aTraduire[l] = manque.length;
  bilan.push(`${l} : ${Object.keys(tr).length} traductions, ${manque.length} textes encore en français`);
  const corps = `/* Généré par npm run langues — ne pas modifier : la source est i18n/${l}.json. */\n`
    + `TBF_LANGUE._demarrer(${JSON.stringify({ exacts, motifs })});\n`;
  empreintes[l] = createHash('sha1').update(corps).digest('hex').slice(0, 10);
  if (!VERIFIER) {
    mkdirSync(ici('public/i18n'), { recursive: true });
    writeFileSync(ici('public/i18n', `${l}.js`), corps);
    /* Servis compressés par server.js : un demi-mégaoctet en devient cent cinquante. */
    writeFileSync(ici('public/i18n', `${l}.js.br`), brotliCompressSync(corps, {
      params: { [zlib.BROTLI_PARAM_QUALITY]: 11, [zlib.BROTLI_PARAM_SIZE_HINT]: corps.length } }));
    writeFileSync(ici('public/i18n', `${l}.js.gz`), gzipSync(corps, { level: 9 }));
  }
}

/* Dans l'ordre du relevé, fichier par fichier : un Fanzzy et ses âges
   restent ensemble, ce qui compte pour les traduire. */
const tous = [...textes.keys()];
if (!VERIFIER) {
  const manquants = {};
  for (const l of LANGUES) {
    const source = ici('i18n', `${l}.json`);
    const tr = existsSync(source) ? JSON.parse(readFileSync(source, 'utf8')) : {};
    for (const t of tous) if (!(t in tr)) (manquants[t] ??= { ou: [...textes.get(t)].slice(0, 3), langues: [] }).langues.push(l);
  }
  writeFileSync(ici('i18n', 'a-traduire.json'), JSON.stringify(manquants, null, 1) + '\n');
  const lj = readFileSync(ici('public/langue.js'), 'utf8')
    .replace(/\/\*versions\*\/.*?\/\*fin\*\//, `/*versions*/${JSON.stringify(empreintes)}/*fin*/`);
  writeFileSync(ici('public/langue.js'), lj);
}
console.log(`${tous.length} textes relevés.`);
for (const b of bilan) console.log(`  ${b}`);
if (VERIFIER) {
  /* Les dictionnaires servis doivent être ceux que les sources donnent. */
  const lj = readFileSync(ici('public/langue.js'), 'utf8');
  const servies = JSON.parse(lj.match(/\/\*versions\*\/(.*?)\/\*fin\*\//)[1]);
  for (const l of LANGUES) {
    if (servies[l] !== empreintes[l]) { console.error(`✗ public/i18n/${l}.js n'est pas à jour : lance npm run langues`); fautes++; }
  }
}
if (fautes) { console.error(`${fautes} faute(s).`); process.exit(1); }
console.log('ok');
