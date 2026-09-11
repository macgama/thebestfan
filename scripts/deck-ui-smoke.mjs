/**
 * Test de l'écran de construction de deck.
 *
 * Les autres suites vérifient le serveur ; celle-ci vérifie la page, parce
 * qu'un écran qui compile n'est pas un écran qui marche. On monte le vrai
 * serveur sur la vraie base, on charge public/deck.html dans un DOM et on
 * clique dedans comme un joueur le ferait.
 *
 * Ce qu'elle attrape, et que la relecture ne voit pas :
 *   - un compte neuf a deux Fanzzy et le deck en demande trois : l'écran doit
 *     le dire et pointer le kiosque, pas afficher un formulaire impossible ;
 *   - une pièce d'équipement portée à deux rangs, que le serveur refuse et
 *     que la page doit empêcher avant l'envoi ;
 *   - un refus du serveur affiché en « impossible » au lieu de sa cause.
 *
 * jsdom est une dépendance de test seulement : `npm i --no-save jsdom`.
 *
 * Usage : node scripts/deck-ui-smoke.mjs
 */
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { JSDOM, VirtualConsole } from 'jsdom';
import { createDecks } from '../src/server/deck/index.js';
import { createFanzzy } from '../src/server/fanzzy/index.js';
import { ACTIONS } from '../src/shared/duel/actions.js';
import { STUFF } from '../src/shared/fanzzy/inventaire.js';
import { charger as chargerCatalogue } from '../src/server/fanzzy/catalogue.js';
import { chargerTenues } from '../src/server/fanzzy/tenues.js';
import { baseDeTest } from './base-de-test.mjs';

const DB = baseDeTest();
// `.pathname` d'une URL de fichier n'est pas un chemin : sous Windows il vaut
// « /C:/… », et path.join en fait « C:\C:\… ». La suite ne pouvait donc pas
// tourner sur une machine de développement Windows.
const RACINE = fileURLToPath(new URL('..', import.meta.url));

let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

/** Attend qu'une condition devienne vraie : le rendu passe par des fetch. */
async function jusqua(fn, ms = 5000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (fn()) return true; await attendre(25); }
  return false;
}

/* ------------------------------------------------------------- la base */

const mysql = await import('mysql2/promise');
const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
await raw.query(`DROP TABLE IF EXISTS kop_invites, amities,
  kop_bulletins, kop_votes, kop_bonus, kop_membres, kops, user_decks, user_stuff, user_skins, user_fanzzy,
  user_souvenirs, virage_presence, souvenirs, user_wallet, api_cache, souvenir_leagues,
  duel_results, duel_events, duels, user_follows, fixture_events, standings, fixtures,
  team_leagues, teams, leagues, api_quota, login_attempts, auth_tokens, sessions, users`);
for (const f of ['auth.sql', 'football.sql', 'minutes.sql', 'couleurs.sql', 'souvenirs.sql', 'fanzzy.sql',
                 'inventaire.sql', 'skins.sql', 'tenues.sql', 'deck.sql', 'niveau.sql']) {
  await raw.query(readFileSync(path.join(RACINE, 'sql', f), 'utf8'));
}

const U = 'eeeeeeee-0000-0000-0000-000000000001';
await raw.query(`INSERT INTO users (public_id,email,pseudo,password_hash)
                 VALUES (?,?,?,'x')`, [U, 'ui@ex.fr', 'Deckeuse']);
/* Niveau 5 : c'est le palier qui ouvre le troisième emplacement de tribune.
   En dessous le serveur n'en accorde que deux — c'est le cas que la section
   « le plafond du niveau » éprouve plus bas, en abaissant l'XP. */
const { seuil } = await import('../src/shared/niveau.js');
await raw.query(`INSERT INTO user_wallet (user_id,scarves,action_cards,xp) VALUES (?,300,?,?)`,
  [U, JSON.stringify(['a-silence', 'a-vol', 'a-metronome']), seuil(5)]);

/** Un compte fraîchement sorti du paquet de bienvenue : deux Fanzzy. */
const donnerFanzzy = (id) =>
  raw.query(`INSERT IGNORE INTO user_fanzzy (user_id,fanzzy_id,copies) VALUES (?,?,1)`, [U, id]);
await donnerFanzzy('V1');
await donnerFanzzy('P1');
for (const s of ['jumelles', 'echarpe', 'tambour']) {
  await raw.query(`INSERT INTO user_stuff (user_id,stuff_id,copies) VALUES (?,?,1)`, [U, s]);
}

const pool = mysql.createPool({ uri: DB, connectionLimit: 6, charset: 'utf8mb4' });
// Le catalogue vit en base depuis qu il se gère par l administration :
// on le charge comme le fait server.js, sinon les modules travaillent
// sur un catalogue vide.
await chargerCatalogue(pool);
await chargerTenues(pool);

/* ----------------------------------------------------------- le serveur */

const requireAuth = (r, _s, n) => { r.user = { id: U }; n(); };
const app = express();
/* La progression est montée. Sans elle, `createDecks` accorde à tout le monde
   les trois emplacements de la règle : le plafond de niveau — c'est-à-dire la
   panne — ne peut alors pas se produire, et la suite resterait verte en
   n'éprouvant jamais le cas qui a été remonté. */
const { createNiveau } = await import('../src/server/niveau/index.js');
const niveau = createNiveau({ pool, requireAuth });
app.use('/api/niveau', niveau.router);
app.use('/api/deck', createDecks({ pool, requireAuth, niveau }).router);
app.use('/api/fanzzy', createFanzzy({ pool, requireAuth }).router);
app.get('/deck', (_q, s) => s.sendFile(path.join(RACINE, 'public', 'deck.html')));
// La page charge fx.js et nav.js en differé : on les sert pour rester au plus
// près du vrai chargement.
app.use(express.static(path.join(RACINE, 'public')));

const http = createServer(app);
await new Promise((r) => http.listen(0, r));
const base = `http://localhost:${http.address().port}`;

/* -------------------------------------------------------------- la page */

/**
 * Charge /deck dans un DOM. jsdom n'a pas de fetch : on lui passe celui de
 * Node, en résolvant les chemins relatifs comme le ferait le navigateur.
 */
async function ouvrirPage() {
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => {
    /* « Not implemented » n'est pas une faute de la page : c'est jsdom qui
       annonce ce qu'il ne sait pas faire — ici `canvas.toDataURL`, que
       `fanzzy-art.js` appelle pour choisir entre AVIF et WebP. Le module
       l'entoure déjà d'un `try` et retombe sur le format universel ; jsdom
       émet quand même l'avis. Le compter comme une erreur de script ferait
       rougir la suite pour une limite de l'outil de test, ce qui est le
       meilleur moyen d'apprendre à ignorer les rouges. */
    if (/Not implemented/i.test(e.message)) return;
    // Une erreur de script dans la page est une faute, pas un détail.
    console.log(` FAIL  erreur de script dans la page : ${e.message}`);
    failures++;
  });

  const html = readFileSync(path.join(RACINE, 'public', 'deck.html'), 'utf8');
  // `beforeParse` et non après construction : le script de la page appelle
  // charger() dès son exécution, donc fetch doit exister avant l'analyse.
  // Injecté après, la page échouait silencieusement et le test mesurait le
  // mauvais objet.
  return new JSDOM(html, {
    url: base + '/deck',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(window) {
      window.fetch = (u, o) => fetch(new URL(u, base), o);
      /* `resources: 'usable'` n'est pas activé : jsdom ne va pas chercher les
         `<script src>` de la page. Le deck en charge un depuis qu'il pose le
         visage des Fanzzy — `fanzzy-art.js`, le module que le classeur emploie
         déjà. Sans cette injection, `window.FZART` reste absent, la page
         retombe sagement sur son ancienne pastille de type, et la suite
         resterait verte en n'éprouvant jamais le portrait.

         On injecte le **vrai** fichier, pas un mannequin : c'est lui qui
         décide s'il existe une illustration pour ce Fanzzy, et c'est
         exactement ce qu'on veut vérifier. */
      window.eval(readFileSync(path.join(RACINE, 'public', 'fanzzy-art.js'), 'utf8'));
      /* Même raison pour `action-art.js` : la table des sept familles et
         l'adresse des dessins y vivent depuis que le duel avait besoin des
         mêmes. Sans lui, la page lève au premier rendu — ce qui est déjà
         arrivé, et ce que ce commentaire évite de redécouvrir. */
      window.eval(readFileSync(path.join(RACINE, 'public', 'action-art.js'), 'utf8'));
      window.eval(readFileSync(path.join(RACINE, 'public', 'stuff-art.js'), 'utf8'));
    },
  });
}

const T = (dom) => dom.window.document;

/**
 * Le texte réellement affiché.
 *
 * `body.textContent` inclut le contenu des balises <script> : toutes les
 * vérifications de texte trouvaient alors leurs chaînes dans le code source
 * de la page, et passaient même quand rien n'était affiché. Ce test a
 * commencé par se tromper exactement là.
 */
function texte(dom) {
  const corps = T(dom).body.cloneNode(true);
  for (const s of corps.querySelectorAll('script,style')) s.remove();
  return corps.textContent.replace(/\s+/g, ' ');
}
const clic = (el) => el.dispatchEvent(new el.ownerDocument.defaultView
  .MouseEvent('click', { bubbles: true }));

/* ============================ 1. compte neuf, deux Fanzzy ============= */

let dom = await ouvrirPage();
await jusqua(() => T(dom).getElementById('corps').querySelector('.tabs'));

check('la page se charge sans erreur de script',
  T(dom).getElementById('corps').querySelector('.tabs') !== null);
check('deux Fanzzy possédés : l\u2019écran le dit au lieu de bloquer',
  /IL TE MANQUE DES FANZZY/.test(texte(dom)));
check('le manque est chiffré, pas vague',
  /demande 3 Fanzzy et tu en as 2/.test(texte(dom)));
check('il indique où en trouver',
  T(dom).querySelector('.avert a[href="/fanzzy"]') !== null);
check('le deck est annoncé incomplet',
  T(dom).getElementById('etat').textContent === 'INCOMPLET');
check('l\u2019enregistrement est fermé tant qu\u2019il manque quelque chose',
  T(dom).getElementById('save').disabled === true);
check('la barre du bas nomme ce qui manque',
  /Fanzzy à choisir/.test(T(dom).getElementById('info').textContent)
  && /cartes à ajouter/.test(T(dom).getElementById('info').textContent));

/* ------------------------- le premier rang est le titulaire ----------- */

const rangs = T(dom).querySelectorAll('.rang');
check('trois emplacements de tribune', rangs.length === 3);
check('le premier annonce qu\u2019il entre au coup d\u2019envoi',
  /coup d\u2019envoi/.test(rangs[0].textContent));

/* -------------------- choisir un Fanzzy dans le panneau --------------- */

clic(rangs[0].querySelector('[data-choisir-fanzzy]'));
await jusqua(() => T(dom).getElementById('voile').classList.contains('on'));
check('le panneau de choix s\u2019ouvre',
  T(dom).getElementById('voile').classList.contains('on'));
check('il ne propose que les Fanzzy possédés',
  T(dom).querySelectorAll('#panneau .choix').length === 2);

clic(T(dom).querySelector('[data-prendre-fanzzy]'));
await jusqua(() => T(dom).querySelectorAll('.rang.vide').length === 2);
check('le Fanzzy choisi occupe le premier rang',
  T(dom).querySelectorAll('.rang.vide').length === 2);
check('il est marqué titulaire',
  T(dom).querySelector('.rang .marque')?.textContent === 'TITULAIRE');

/* -------------------- une pièce ne se porte qu'à un seul rang ---------- */

clic(rangs[0].querySelector('[data-piece]') ?? T(dom).querySelector('[data-piece]'));
await jusqua(() => T(dom).getElementById('voile').classList.contains('on'));

/* Le panneau de choix montre les objets.
 *
 * On compare le dessin de chaque ligne à l'identifiant qu'elle propose : une
 * vignette unique répétée sur toutes les lignes passerait un simple comptage,
 * et c'est pourtant exactement le cas où le joueur ne distingue plus rien. */
{
  const lignes = [...T(dom).querySelectorAll('#panneau .choix')]
    .filter((c) => c.dataset.prendrePiece)
    .map((c) => ({
      id: c.dataset.prendrePiece.split(':')[2],
      src: c.querySelector('.tbf-piece .illu')?.getAttribute('src') ?? null,
      cadre: c.querySelector('.tbf-piece')?.className ?? '',
    }));
  check('le panneau propose des pièces', lignes.length > 0);
  const propres = lignes.filter((l) => l.src === `/img/stuff/${l.id}.png`);
  check('chaque pièce proposée porte son propre dessin',
    lignes.length > 0 && propres.length === lignes.length);
  if (propres.length !== lignes.length) {
    console.log('        vu :', lignes.map((l) => `${l.id} → ${l.src}`).join(', '));
  }
  /* Le cadre porte la rareté. Sans lui, sept objets détourés sur fond sombre
     se ressemblent tous : c'est la couleur qui dit ce qui est rare. */
  check('et le cadre de sa rareté',
    lignes.length > 0 && lignes.every((l) => /\br-(commune|rare|epique|legendaire)\b/.test(l.cadre)));
}

clic(T(dom).querySelector('[data-prendre-piece]'));
await jusqua(() => T(dom).querySelector('.piece.plein'));
check('l\u2019équipement se pose sur le Fanzzy', T(dom).querySelector('.piece.plein') !== null);
check('l\u2019effet combiné est affiché', /Effet ·/.test(texte(dom)));

/* Et l'emplacement montre l'objet qu'on vient d'y poser, pas un autre. */
{
  const pose = T(dom).querySelector('.piece.plein');
  const nom = pose?.querySelector('b')?.textContent.trim();
  const src = pose?.querySelector('.tbf-piece .illu')?.getAttribute('src') ?? null;
  const attendu = STUFF.find((s) => s.nom === nom)?.id;
  check('l\u2019emplacement montre l\u2019objet posé',
    Boolean(attendu) && src === `/img/stuff/${attendu}.png`);
  if (src !== `/img/stuff/${attendu}.png`) {
    console.log('        posée :', nom, '→', src, '(attendu', attendu, ')');
  }
}

// deuxième rang, puis on tente d'y remettre la même pièce
clic(T(dom).querySelectorAll('.rang.vide')[0].querySelector('[data-choisir-fanzzy]'));
await jusqua(() => T(dom).getElementById('voile').classList.contains('on'));
clic([...T(dom).querySelectorAll('#panneau .choix')].find((c) => c.dataset.prendreFanzzy));
await jusqua(() => T(dom).querySelectorAll('.rang.vide').length === 1);

const pieces2 = T(dom).querySelectorAll('.rang')[1].querySelectorAll('[data-piece]');
clic(pieces2[0]);
await jusqua(() => T(dom).getElementById('voile').classList.contains('on'));
const dejaPortee = [...T(dom).querySelectorAll('#panneau .choix')]
  .find((c) => /AUTRE RANG/.test(c.textContent));
check('la pièce déjà portée ailleurs est signalée', Boolean(dejaPortee));
check('et elle n\u2019est pas cliquable',
  dejaPortee && !dejaPortee.dataset.prendrePiece);
clic(T(dom).querySelector('[data-fermer]'));

/* ============================ 2. compte complet ======================= */

await donnerFanzzy('F1');
dom.window.close();
dom = await ouvrirPage();
await jusqua(() => T(dom).getElementById('corps').querySelector('.tabs'));
check('avec trois Fanzzy, l\u2019avertissement disparaît',
  !/IL TE MANQUE DES FANZZY/.test(texte(dom)));

// on remplit les trois rangs
for (let i = 0; i < 3; i++) {
  const libre = T(dom).querySelector('.rang.vide [data-choisir-fanzzy]');
  if (!libre) break;
  clic(libre);
  await jusqua(() => T(dom).querySelector('[data-prendre-fanzzy]'));
  clic(T(dom).querySelector('[data-prendre-fanzzy]'));
  await attendre(40);
}
check('les trois rangs sont pourvus', T(dom).querySelectorAll('.rang.vide').length === 0);
check('sans arbitre, l\u2019écran prévient que les remplaçants ne joueront pas',
  /TES REMPLAÇANTS NE JOUERONT PAS/.test(texte(dom)));

/* -------------------------------- les dix cartes ---------------------- */

clic(T(dom).querySelector('[data-onglet="cartes"]'));
await jusqua(() => T(dom).querySelector('.grille'));
check('dix emplacements de cartes', T(dom).querySelectorAll('.emp').length === 10);

/* Le catalogue montre les cartes, pas seulement leurs noms.
 *
 * Chaque ligne porte une vignette : le glyphe de sa famille, et le dessin
 * par-dessus. On vérifie que le dessin est **le sien** — une vignette unique
 * répétée sur les vingt et une lignes passerait un simple comptage — et que le
 * glyphe reste dessous, puisque c'est lui qui reprend la main si un fichier
 * manque un jour. */
{
  /* Sur « toutes » et pas sur « les miennes » : le contrôle doit porter sur
     les vingt et une cartes du jeu, pas sur les quelques-unes que ce joueur
     de test possède — une carte jamais possédée est justement celle dont on
     ne verrait jamais que le dessin manque. */
  clic(T(dom).querySelector('[data-filtre="toutes"]'));
  await jusqua(() => T(dom).querySelectorAll('.cat .carte').length === ACTIONS.length);
  const lignes = [...T(dom).querySelectorAll('.cat .carte')].map((c) => ({
    id: c.dataset.detail,
    src: c.querySelector('.vig .illu')?.getAttribute('src') ?? null,
    glyphe: Boolean(c.querySelector('.vig svg path')?.getAttribute('d')),
  }));
  check('le catalogue liste les vingt et une cartes', lignes.length === ACTIONS.length);
  const propres = lignes.filter((l) => l.src?.startsWith(`/img/action/${l.id}.`));
  check('chaque carte du catalogue porte son propre dessin',
    lignes.length > 0 && propres.length === lignes.length);
  if (propres.length !== lignes.length) {
    console.log('        sans leur dessin :', lignes.filter((l) =>
      !propres.includes(l)).map((l) => `${l.id} → ${l.src}`).join(', '));
  }
  check('et son glyphe de famille dessous',
    lignes.length > 0 && lignes.every((l) => l.glyphe));
  clic(T(dom).querySelector('[data-filtre="miennes"]'));
  await jusqua(() => T(dom).querySelector('[data-filtre="miennes"]').classList.contains('on'));
}

const communes = ACTIONS.filter((a) => a.rar === 'commune').map((a) => a.id);
async function ajouter(id) {
  const carte = T(dom).querySelector(`[data-detail="${id}"]`);
  if (!carte) return false;
  clic(carte);
  await jusqua(() => T(dom).getElementById('voile').classList.contains('on'));
  const bouton = T(dom).querySelector('[data-ajouter]');
  if (!bouton) { clic(T(dom).querySelector('[data-fermer]')); return false; }
  clic(bouton);
  await attendre(40);
  return true;
}

// deux exemplaires de chaque commune jusqu'à dix
let pose = 0;
for (const id of communes) {
  for (let k = 0; k < 2 && pose < 10; k++) if (await ajouter(id)) pose++;
}
check('dix cartes posées', T(dom).querySelectorAll('.emp.plein').length === 10);

/* Et les dix emplacements montrent chacun le dessin de leur carte.
 *
 * On ne peut pas lire `S.deck.actions` : `S` est un `const` de premier niveau
 * dans un script classique, et ceux-là ne sont pas des propriétés de `window`
 * — la leçon a déjà coûté quatre faux échecs ailleurs. On croise donc ce que
 * la carte affiche, son **nom**, avec l'identifiant que porte son image : si
 * les dix montraient la même vignette, les noms ne suivraient pas. */
{
  const parNom = new Map(ACTIONS.map((a) => [a.nom, a.id]));
  const posees = [...T(dom).querySelectorAll('.emp.plein')].map((c) => ({
    nom: c.querySelector('.nm')?.textContent.trim(),
    src: c.querySelector('.illu')?.getAttribute('src') ?? null,
    glyphe: Boolean(c.querySelector('.sceau path')?.getAttribute('d')),
  }));
  const alignees = posees.length === 10 && posees.every((c) =>
    parNom.has(c.nom) && c.src?.startsWith(`/img/action/${parNom.get(c.nom)}.`));
  check('chaque carte posée porte son dessin', alignees);
  if (!alignees) console.log('        vu :', posees.map((c) => `${c.nom} → ${c.src}`).join(', '));
  check('le glyphe de famille reste dessous', posees.every((c) => c.glyphe));
}

const troisieme = await ajouter(communes[0]);
check('un troisième exemplaire est refusé par l\u2019écran', troisieme === false);
check('le refus est expliqué', /c\u2019est le maximum|emplacements sont pris/.test(texte(dom)));
clic(T(dom).querySelector('[data-fermer]'));

/* ------------------------------------------- ce que l'écran donne à voir

 * Un écran de deck sert à deux choses : reconnaître ses personnages, et juger
 * sa main d'un coup d'œil. Il ne faisait ni l'un ni l'autre.
 *
 * La tribune montrait un carré de couleur avec le pictogramme du type, alors
 * que le classeur — l'écran d'à côté, celui d'où l'on vient — affiche les
 * personnages dessinés. Le même joueur choisissait des noms ici et des
 * visages là.
 */
{
  /* La main : dix cases avec un chiffre et un nom en sept pixels et demi.
     C'est pourtant ce que le joueur regarde le plus longtemps sur cet écran.
     On est ici sur l'onglet des cartes, celui que les contrôles précédents
     viennent de remplir. */
  const carte = T(dom).querySelector('.emp.plein');
  check('chaque carte posée porte son coût', Boolean(carte?.querySelector('.cout')));
  check('et le sceau de sa famille', Boolean(carte?.querySelector('.sceau')));

  /* Le souffle moyen. C'est la mesure que tout jeu de deck met en avant, et
     pour une bonne raison : elle répond seule à « pourquoi je n'arrive jamais
     à jouer ». Elle ne se calculait nulle part, et personne n'allait
     additionner dix nombres à la main. */
  check('la main annonce son souffle moyen',
    /souffle moyen\s+\d+([.,]\d+)?/.test(texte(dom))
    || (console.log('        titre :', T(dom).querySelector('h2')?.textContent), false));

  // Le portrait vit sur l'autre onglet : il faut y retourner pour le voir.
  clic(T(dom).querySelector('[data-onglet="tribune"]'));
  await jusqua(() => T(dom).querySelector('.rang .tete'));

  /* On demande au module lui-même **qui** est illustré, puis on compte les
     visages. Sans ce comptage le contrôle était conditionnel — « s'il y a un
     portrait, alors il doit être juste » — et supprimer le portrait le faisait
     simplement se taire. Un contrôle qu'on peut désarmer en retirant ce qu'il
     surveille ne surveille rien. */
  const ids = Array.from(dom.window.eval('S.deck.fanzzy.map((f) => f.id)'));
  const illustres = ids.filter((id) => dom.window.FZART?.ILLUSTRES?.has(id));
  const faces = T(dom).querySelectorAll('.rang .tete .face');
  const pips = T(dom).querySelectorAll('.rang .tete .pip');

  check('le deck de test contient au moins un Fanzzy illustré',
    illustres.length > 0
    || (console.log('        aucun de', ids.join(', '), 'n’est dessiné'), false));
  check('tous les Fanzzy illustrés portent leur visage',
    faces.length === illustres.length
    || (console.log(`        ${faces.length} visage(s) pour ${illustres.length} dessiné(s)`), false));
  /* L'un **ou** l'autre, jamais rien : les Fanzzy pas encore dessinés gardent
     la pastille de type. C'est le repli de tout le jeu. */
  check('et les autres gardent leur pastille',
    faces.length + pips.length === ids.length);

  const face = faces[0];
  check('le visage est le dessin du module, pas un cadre vide',
    Boolean(face?.querySelector('img.illu')));
  check('il est monté dans le cadre de sa rareté',
    /\br-(commune|rare|epique|legendaire)\b/.test(face?.className ?? ''));
  check('et son type reste lisible dans le coin',
    Boolean(face?.querySelector('.type svg')));
}

/* ------------------------------------------- le plafond du niveau

 * Le nombre d'emplacements de tribune dépend du niveau : deux au départ, trois
 * à partir du cinquième. Le serveur envoie ce plafond dans
 * `possede.fanzzyMax` précisément pour que la page affiche autant de rangs —
 * **et la page ne le lisait pas.** Elle ouvrait les trois rangs de la règle
 * absolue, le joueur en remplissait trois, et le serveur refusait un deck que
 * l'écran venait de lui laisser composer. Le refus, lui, répétait « il faut
 * entre un et trois Fanzzy » : il donnait raison au joueur.
 */
{
  const avant = await pool.query('SELECT xp FROM user_wallet WHERE user_id = ?', [U]);
  await pool.query('UPDATE user_wallet SET xp = 0 WHERE user_id = ?', [U]);
  const bas = await ouvrirPage();
  await jusqua(() => T(bas).querySelector('.rang'));

  check('au niveau 1, la tribune n’ouvre que les rangs accordés',
    T(bas).querySelectorAll('.rang').length === 2
    || (console.log('        elle en ouvre',
      T(bas).querySelectorAll('.rang').length), false));
  check('et l’onglet compte sur le même plafond',
    /TRIBUNE\s*\d\/2/.test(T(bas).querySelector('[data-onglet="tribune"]')?.textContent ?? ''));

  /* La limite doit se **dire**, pas seulement s'appliquer.
   *
   * L'écran ouvrait deux rangs sans jamais expliquer d'où venait ce nombre.
   * Quelqu'un qui a lu « jusqu'à trois Fanzzy » n'en voit que deux, ne trouve
   * aucune explication, et en conclut que l'écran est cassé — c'est
   * exactement la question qui a été posée. On vérifie donc que le palier est
   * nommé, et qu'il est nommé **juste** : le niveau doit venir du serveur,
   * pas d'un nombre écrit dans la page. */
  {
    const jalon = T(bas).querySelector('.jalon');
    check('la tribune dit pourquoi elle n’ouvre que deux rangs', Boolean(jalon));
    const texte = jalon?.textContent.replace(/\s+/g, ' ').trim() ?? '';
    check('et à quel niveau le troisième s’ouvre', /niveau\s*5/.test(texte));
    if (!/niveau\s*5/.test(texte)) console.log('        elle dit :', texte);
  }

  /* Et la règle des âges, qui est l'autre moitié de la même confusion : un
     personnage évolué n'occupe pas un second rang. */
  check('elle rappelle qu’un personnage et ses âges sont une seule carte',
    /une seule carte/i.test(T(bas).body.textContent));

  /* Le message du refus doit dire **la** limite, pas celle de la règle. On le
     provoque en demandant trois Fanzzy au serveur par-dessus la page. */
  const dit = await bas.window.eval(`(async () => {
    const r = await fetch('/api/deck/mien', { method:'PUT',
      headers:{'content-type':'application/json'},
      body: JSON.stringify({ nom:'Trop', fanzzy:[{id:'V1'},{id:'V2'},{id:'P1'}], actions:[] }) });
    const j = await r.json();
    return (j.detail ?? []).find((p) => p.code === 'deck.error.fanzzy_count') ?? null;
  })()`);
  check('le serveur refuse le troisième Fanzzy', Boolean(dit));
  check('et il joint la vraie limite, pas celle de la règle', dit?.max === 2);
  check('la page sait alors nommer le niveau plutôt que répéter « trois »',
    /niveau/i.test(bas.window.eval(`precise(${JSON.stringify(dit)})`) ?? ''));

  bas.window.close();
  await pool.query('UPDATE user_wallet SET xp = ? WHERE user_id = ?',
    [avant[0][0].xp, U]);
}

check('le deck est annoncé prêt', T(dom).getElementById('etat').textContent === 'PRÊT');
check('l\u2019enregistrement est ouvert', T(dom).getElementById('save').disabled === false);

/* -------------------------------- enregistrement ---------------------- */

clic(T(dom).getElementById('save'));
await jusqua(() => T(dom).getElementById('toast').classList.contains('on'), 6000);
check('le deck est enregistré', /enregistré|Arbitre/.test(T(dom).getElementById('toast').textContent));

const [enBase] = await pool.query(
  `SELECT contenu FROM user_decks WHERE user_id = ? AND actif = 1`, [U]);
const stocke = typeof enBase[0]?.contenu === 'string'
  ? JSON.parse(enBase[0].contenu) : enBase[0]?.contenu;
check('la base contient bien trois Fanzzy', stocke?.fanzzy?.length === 3);
check('la base contient bien dix cartes', stocke?.actions?.length === 10);
check('le bouton se referme après enregistrement',
  T(dom).getElementById('save').disabled === true);

/* ================== 3. un refus du serveur nomme sa cause ============= */

// On retire un Fanzzy de la collection dans le dos de la page : au prochain
// envoi, le serveur refusera. C'est exactement le cas qui produisait autrefois
// un « impossible » sans cause.
await pool.query(`DELETE FROM user_fanzzy WHERE user_id = ? AND fanzzy_id = 'F1'`, [U]);
clic(T(dom).querySelector('[data-onglet="tribune"]'));
await jusqua(() => T(dom).querySelector('.rang'));
const nom = T(dom).getElementById('nom');
nom.value = 'Deck refusé';
nom.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
clic(T(dom).getElementById('save'));

const affiche = await jusqua(() =>
  /LE SERVEUR A REFUSÉ CE DECK/.test(texte(dom))
  || /Tu ne possèdes pas/.test(T(dom).getElementById('toast').textContent), 6000);
check('un refus du serveur est affiché', affiche);
check('et il nomme la cause, pas « impossible »',
  /Tu ne possèdes pas ce Fanzzy/.test(texte(dom)));
check('le nom du Fanzzy fautif est donné',
  /Abonné|F1/.test(texte(dom)));

/* ---------------------------------------------------------------- fin */

dom.window.close();
await new Promise((r) => http.close(r));
await pool.end();
await raw.end();

console.log(failures ? `\n${failures} test(s) en échec` : '\ntout est vert');
process.exit(failures ? 1 : 0);
