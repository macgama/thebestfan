/**
 * Test de l'écran d'administration du catalogue.
 *
 * Le serveur est couvert par admin-smoke ; ce qui manque, c'est l'écran lui-
 * même. C'est lui qui doit permettre d'atteindre cent cartes sans toucher au
 * code, et une liste qui ne se peuple pas, un formulaire qui ne renvoie pas ce
 * qu'on a tapé ou un refus affiché en code brut rendent l'outil inutilisable
 * sans qu'aucun test serveur ne s'en aperçoive.
 *
 * Avant de lancer :  npm install --no-save puppeteer
 */
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import puppeteer from 'puppeteer';
import { createAdmin } from '../src/server/admin/index.js';
import { charger as chargerCatalogue, parIdentifiant }
  from '../src/server/fanzzy/catalogue.js';
import { chargerTenues } from '../src/server/fanzzy/tenues.js';
import { baseDeTest, OPTIONS_BASE } from './base-de-test.mjs';

const DB = baseDeTest();
const RACINE = fileURLToPath(new URL('..', import.meta.url));

let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };
const dodo = (ms) => new Promise((r) => setTimeout(r, ms));
async function jusqua(fn, ms = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await fn()) return true; await dodo(60); }
  return false;
}

/* ------------------------------------------------------------- la base */

const mysql = await import('mysql2/promise');
const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
await raw.query(`DROP TABLE IF EXISTS parrainages, contenus, abonnements, achats, kop_invites, amities, saisons,
  kop_bulletins, kop_votes, kop_bonus, kop_membres, kops, user_decks, user_stuff, user_skins, user_fanzzy,
  user_souvenirs, virage_presence, souvenirs, user_wallet, api_cache, souvenir_leagues,
  duel_results, duel_events, duels, user_league_follows, user_follows, fixture_events, standings, fixtures,
  team_leagues, teams, leagues, api_quota, login_attempts, auth_tokens, sessions, users,
  admin_audit, reglages`);
for (const f of ['auth.sql', 'football.sql', 'minutes.sql', 'couleurs.sql', 'souvenirs.sql', 'billets.sql', 'fanzzy.sql',
                 'inventaire.sql', 'skins.sql', 'tenues.sql', 'deck.sql', 'admin.sql',
                 // Sans elle, l'onglet SAISONS se monte sur une table absente et
                 // le contrôle mesurerait un écran vide plutôt que l'écran.
                 'saisons.sql','contenus.sql']) {
  await raw.query(readFileSync(path.join(RACINE, 'sql', f), 'utf8'));
}
/* On repart d'un catalogue propre : les essais précédents laissent des ZZ.
   Les thèmes d'essai aussi — ils n'étaient effacés qu'à la **fin** de la
   suite, si bien qu'une exécution interrompue en laissait derrière elle et
   que la suivante tombait sur « cet identifiant est déjà pris », quatre
   contrôles rouges plus loin. Un nettoyage de fin ne nettoie qu'après les
   passages réussis, c'est-à-dire pas ceux qui en ont besoin. */
await raw.query(`DELETE FROM fanzzy WHERE id LIKE 'ZZ%'`);
await raw.query(`DELETE FROM tenues WHERE id LIKE 'zz%'`);

const U = 'dddddddd-0000-0000-0000-0000000000d1';
await raw.query(`INSERT INTO users (public_id,email,pseudo,password_hash,role)
                 VALUES (?,?,?,'x','admin')`, [U, 'admin@ex.fr', 'Patronne']);
await raw.end();

/* ----------------------------------------------------------- le serveur */

const pool = mysql.createPool({ uri: DB, connectionLimit: 6, ...OPTIONS_BASE });
await chargerCatalogue(pool);
await chargerTenues(pool);

const app = express();
// La page interroge /api/auth/me à son ouverture, et son `catch` renvoie vers
// /compte à la moindre erreur. Sans cette route, le test mesurait une page
// dont le corps avait déjà été remplacé.
app.get('/api/auth/me', (_q, s) => s.json({ user: { pseudo: 'Patronne' } }));
const { createContenus } = await import('../src/server/contenus/index.js');
const contenus = createContenus({ pool });
await contenus.semer();
await contenus.charger();

const admin = createAdmin({ pool,
  requireAuth: (r, _s, n) => { r.user = { id: U, email: 'admin@ex.fr' }; n(); },
  deps: { contenus } });
app.use('/api/admin', admin.router);
app.get('/admin', (_q, s) => s.sendFile(path.join(RACINE, 'public', 'admin.html')));
app.use(express.static(path.join(RACINE, 'public')));

const http = createServer(app);
await new Promise((r) => http.listen(0, r));
const base = `http://localhost:${http.address().port}`;

/* -------------------------------------------------------------- la page */

const nav = await puppeteer.launch({ args: ['--no-sandbox'] });
const erreurs = [];
const page = await nav.newPage();
page.on('pageerror', (e) => erreurs.push(e.message));
await page.setViewport({ width: 1100, height: 900 });
await page.goto(base + '/admin', { waitUntil: 'networkidle0' });

check('la page se charge sans erreur de script', erreurs.length === 0);
if (erreurs.length) console.log('   ', erreurs.slice(0, 3));

/* ------------------------------------------------------------ la liste */

await page.evaluate(() => [...document.querySelectorAll('nav button')]
  .find((b) => /FANZZY/i.test(b.textContent))?.click());

check('la liste se peuple', await jusqua(async () =>
  await page.evaluate(() => document.querySelectorAll('#corps .fzrow').length > 20)));

const vue = await page.evaluate(() => ({
  lignes: document.querySelectorAll('#corps .fzrow').length,
  compte: document.querySelector('.compte')?.textContent.replace(/\s+/g, ' ').trim(),
  vignettes: document.querySelectorAll('#corps .fzrow img').length,
}));
check('chaque carte a sa ligne', vue.lignes >= 70);
check('le compte annonce publiées, retirées et dessinées',
  /publiées/.test(vue.compte) && /retirées/.test(vue.compte) && /dessinées/.test(vue.compte));
// La vignette est ce qui rend cent lignes lisibles : sans elle on lit des noms.
check('les Fanzzy dessinés montrent leur vignette', vue.vignettes > 40);

/* ------------------------------------------------------------ le filtre */

// On mesure que le filtre *réduit* et que tout ce qui reste correspond — pas
// qu'il reste exactement une ligne. La version chiffrée a tenu jusqu'au jour
// où le catalogue a gagné un deuxième fantôme : le test tombait sur un
// enrichissement du contenu, ce qu'un test d'interface n'a pas à surveiller.
await page.type('#q', 'fantôme');
const filtre = await page.evaluate(async () => {
  const lignes = () => [...document.querySelectorAll('#corps .fzrow')];
  for (let i = 0; i < 40 && lignes().length > 30; i++) {
    await new Promise((r) => setTimeout(r, 50));
  }
  return { reste: lignes().length, textes: lignes().map((l) => l.textContent) };
});
check('le filtre réduit la liste', filtre.reste > 0 && filtre.reste < 30);
check('et il ne laisse que des cartes qui correspondent',
  filtre.textes.length > 0 && filtre.textes.every((t) => /fant[ôo]me/i.test(t)));

await page.evaluate(() => { const q = document.getElementById('q'); q.value = ''; });
await page.type('#q', ' ');
await jusqua(async () => await page.evaluate(() =>
  document.querySelectorAll('#corps .fzrow').length > 20));

/* --------------------------------------------------------- la création */

await page.evaluate(() => document.getElementById('nouveau').click());
check('le formulaire de création s’ouvre',
  await page.$('#f-id') !== null && await page.$eval('#f-id', (e) => e.disabled) === false);

await page.evaluate(() => {
  document.getElementById('f-id').value = 'ZZ1';
  document.getElementById('f-nom').value = 'La Testeuse';
  document.getElementById('f-cri').value = 'ESSAI';
  document.getElementById('f-power').value = '52';
  document.getElementById('f-mods').value = '{"holdBonus":1.2}';
});
await page.evaluate(() => document.getElementById('f-ok').click());

check('la carte est créée et la liste se rafraîchit', await jusqua(async () =>
  await page.evaluate(() => [...document.querySelectorAll('#corps .fzrow')]
    .some((r) => r.textContent.includes('La Testeuse')))));
check('le serveur l’a bien enregistrée', Boolean(parIdentifiant('ZZ1')));
check('avec les effets saisis', parIdentifiant('ZZ1')?.mods?.holdBonus === 1.2);

/* ------------------------------------- un JSON fautif ne part pas au serveur */

await page.evaluate(() => {
  const l = [...document.querySelectorAll('#corps .fzrow')]
    .find((r) => r.textContent.includes('La Testeuse'));
  l.querySelector('[data-editer]').click();
});
await jusqua(async () => await page.$('#f-mods') !== null);
await page.evaluate(() => { document.getElementById('f-mods').value = '{oups'; });
await page.evaluate(() => document.getElementById('f-ok').click());
await dodo(300);
check('un JSON d’effets invalide est refusé côté écran, en clair',
  /JSON valide/.test(await page.$eval('#f-err', (e) => e.textContent)));

/* ------------------------------ un refus du serveur s’affiche en français */

await page.evaluate(() => {
  document.getElementById('f-mods').value = '{}';
  document.getElementById('f-evo').value = 'NEXISTEPAS';
});
await page.evaluate(() => document.getElementById('f-ok').click());
check('un refus du serveur est traduit, pas affiché en code', await jusqua(async () => {
  const t = await page.$eval('#f-err', (e) => e.textContent);
  return /n’existe pas/.test(t) && !/admin\.error/.test(t);
}, 4000));

/* --------------------------------------------------------- la dépublication */

await page.evaluate(() => {
  const l = [...document.querySelectorAll('#corps .fzrow')]
    .find((r) => r.textContent.includes('La Testeuse'));
  l.querySelector('[data-publier]').click();
});
check('une carte se retire des tirages depuis la liste', await jusqua(async () =>
  await page.evaluate(() => [...document.querySelectorAll('#corps .fzrow')]
    .some((r) => r.textContent.includes('La Testeuse') && r.textContent.includes('RETIRÉ')))));
check('et elle reste dans le catalogue', Boolean(parIdentifiant('ZZ1')));

// Aucun bouton de suppression : c'est délibéré, un identifiant effacé
// orphelinerait les collections de tous ceux qui possèdent la carte.
check('aucun bouton ne supprime une carte', await page.evaluate(() =>
  ![...document.querySelectorAll('#corps button')]
    .some((b) => /supprim/i.test(b.textContent))));

/* ------------------------------------------------------------ les tenues

   L'onglet qui existe pour une seule raison : qu'un thème de tenue se crée
   sans livraison. Tant que la liste vivait dans le code, chaque nouveau
   costume demandait un déploiement — ce qui revenait à ne jamais en sortir.

   Ce qu'on éprouve ici, c'est la boucle complète depuis l'écran : la liste
   arrive, le formulaire crée, et **l'écran dit où déposer les dessins**. Ce
   dernier point est le seul qui ne se devine pas : un thème sans image
   s'affiche exactement comme la tenue de base, donc rien, à l'usage, ne
   signale qu'il en manque. */

await page.evaluate(() => [...document.querySelectorAll('nav button')]
  .find((b) => /TENUES/i.test(b.textContent))?.click());

check('la liste des thèmes se peuple', await jusqua(async () =>
  await page.evaluate(() => document.querySelectorAll('#corps .fzrow').length >= 3)));

const themes = await page.evaluate(() => ({
  lignes: [...document.querySelectorAll('#corps .fzrow')].map((r) =>
    r.textContent.replace(/\s+/g, ' ').trim()),
  aide: document.querySelector('.series-n')?.textContent.replace(/\s+/g, ' ') ?? '',
}));
check('les deux nouveaux thèmes sont en tête d’affiche',
  themes.lignes.some((t) => /pr[ée]historique/i.test(t))
  && themes.lignes.some((t) => /apocalyptique/i.test(t)));
// Dépubliés, pas supprimés : celui qui possède une tenue de pluie la garde.
check('les anciens thèmes restent listés, marqués RETIRÉ',
  themes.lignes.some((t) => /Pluie/i.test(t) && /RETIRÉ/.test(t)));
check('l’écran nomme la convention de nommage des sources',
  /_src/.test(themes.aide) && /neutre/.test(themes.aide));

await page.evaluate(() => document.getElementById('nouveau').click());
check('le formulaire de thème s’ouvre', await page.$('#t-id') !== null);

await page.evaluate(() => {
  document.getElementById('t-id').value = 'zztest';
  document.getElementById('t-nom').value = 'Thème de test';
  document.getElementById('t-texte').value = 'Pour la suite, pas pour les joueurs.';
});
await page.evaluate(() => document.getElementById('t-ok').click());

check('le thème est créé', await jusqua(async () =>
  Boolean(await page.$('.depot'))));
const depot = await page.evaluate(() =>
  document.querySelector('.depot')?.textContent.replace(/\s+/g, ' ') ?? '');
check('et l’écran dit quel fichier déposer', /_src/.test(depot) && /zztest/.test(depot));
check('en nommant les trois âges', /-e1-/.test(depot) && /-e3-/.test(depot));
check('et en disant ce qui se passe s’il n’y en a pas',
  /tenue de base/i.test(depot));

// L'identifiant devient un nom de dossier : il ne se renomme pas, sans quoi
// les dessins déjà produits resteraient derrière lui.
await page.evaluate(() => [...document.querySelectorAll('nav button')]
  .find((b) => /TENUES/i.test(b.textContent))?.click());
await jusqua(async () => await page.evaluate(() =>
  [...document.querySelectorAll('#corps .fzrow')].some((r) => /zztest/.test(r.textContent))));
await page.evaluate(() => [...document.querySelectorAll('#corps .fzrow')]
  .find((r) => /zztest/.test(r.textContent))?.querySelector('[data-editer]')?.click());
check('l’identifiant d’un thème existant ne se renomme pas',
  await page.$eval('#t-id', (e) => e.disabled) === true);

await page.evaluate(() => document.getElementById('t-non').click());
await page.evaluate(() => [...document.querySelectorAll('#corps .fzrow')]
  .find((r) => /zztest/.test(r.textContent))?.querySelector('[data-publier]')?.click());
check('un thème se retire des tirages depuis la liste', await jusqua(async () =>
  await page.evaluate(() => [...document.querySelectorAll('#corps .fzrow')]
    .some((r) => /zztest/.test(r.textContent) && /RETIRÉ/.test(r.textContent)))));

check('aucun bouton ne supprime un thème', await page.evaluate(() =>
  ![...document.querySelectorAll('#corps button')]
    .some((b) => /supprim/i.test(b.textContent))));

/* ------------------------------------------------------- les réglages fins

 * L'écran d'avant demandait une clé et une valeur JSON dans deux champs de
 * texte. Pour s'en servir il fallait connaître de mémoire le nom de la clé,
 * son type et ce qu'elle accepte — c'est-à-dire avoir lu le code. Et sur
 * toutes les clés qu'on pouvait y taper, **une seule** était réellement lue
 * par le jeu.
 *
 * Ce qu'on éprouve : que l'écran se dessine à partir du registre, qu'un
 * réglage modifié se voie, qu'on puisse le rendre à son défaut, et qu'un refus
 * arrive en français plutôt qu'en code.
 */
await page.evaluate(() => [...document.querySelectorAll('nav button')]
  .find((b) => /RÉGLAGES/i.test(b.textContent))?.click());

check('l’écran des réglages se peuple depuis le registre', await jusqua(async () =>
  await page.evaluate(() => document.querySelectorAll('#main .rg').length > 15)));

/* ------------------------- les avantages de l'abonnement se règlent d'ici

   Ils vivent dans le registre comme le reste du barème, et c'est ce qui permet
   de les ajuster pendant la bêta sans relivrer : « vingt-quatre boosters,
   est-ce trop ? » se répond en une soirée d'essai, pas en un déploiement.

   Ce contrôle regarde la **section**, et non les clés une à une : c'est elle
   qui porte la règle en toutes lettres — « il vend de la largeur et du confort,
   jamais de la puissance » — et c'est elle que quelqu'un lira avant de changer
   un nombre. Une section qui disparaîtrait de l'écran laisserait les cinq
   réglages sans leur phrase. */
{
  const abo = await page.evaluate(() => {
    const sect = [...document.querySelectorAll('#main .sect')]
      .find((x) => /ABONNEMENT/i.test(x.querySelector('h3')?.textContent ?? ''));
    if (!sect) return null;
    return {
      aide: sect.querySelector('.sh')?.textContent.replace(/\s+/g, ' ').trim() ?? '',
      champs: [...sect.querySelectorAll('.rg')]
        .map((r) => r.querySelector('.lib b')?.textContent.trim() ?? ''),
      reglables: sect.querySelectorAll('input,select,button.bascule').length,
    };
  });
  check('l’abonnement a sa section dans les réglages', Boolean(abo)
    || (console.log('        sections vues :', await page.evaluate(() =>
      [...document.querySelectorAll('#main .sect h3')].map((h) => h.textContent).join(' | '))), false));
  check('ses cinq avantages s’y règlent', (abo?.reglables ?? 0) >= 5
    || (console.log('        champs :', JSON.stringify(abo?.champs)), false));
  /* La phrase compte autant que les champs : c'est elle qui arrête la main de
     celui qui voudrait « rendre l'abonnement plus attractif ». */
  check('et la section rappelle ce qu’il n’a pas le droit de vendre',
    /jamais de la puissance/i.test(abo?.aide ?? '')
    || (console.log('        elle dit :', abo?.aide), false));
}

const ecran = await page.evaluate(() => {
  const rg = [...document.querySelectorAll('#main .rg')];
  return {
    nombre: rg.length,
    sections: document.querySelectorAll('#main .sect').length,
    // Aucun champ ne doit demander de taper une clé ni du JSON.
    aChampCle: Boolean(document.getElementById('cle') || document.getElementById('val')),
    libelles: rg.every((r) => (r.querySelector('.lib b')?.textContent ?? '').length > 3),
    // L'unité est ce qui évite la faute la plus coûteuse : lire « 600000 » et
    // croire à des minutes.
    unites: rg.filter((r) => r.querySelector('input[type=number]'))
      .every((r) => (r.querySelector('.u')?.textContent ?? '').length > 0),
    defauts: rg.every((r) => /Par défaut/.test(r.querySelector('.def')?.textContent ?? '')),
    bornes: rg.filter((r) => r.querySelector('input[type=number]'))
      .every((r) => {
        const i = r.querySelector('input[type=number]');
        return i.getAttribute('min') !== null && i.getAttribute('max') !== null;
      }),
    bascules: document.querySelectorAll('#main .bascule').length,
  };
});

check('les réglages sont rangés par section', ecran.sections >= 5);
check('aucun champ ne demande plus de taper une clé ni du JSON', ecran.aChampCle === false);
check('chaque réglage porte un libellé, pas une clé technique', ecran.libelles);
check('chaque nombre porte son unité', ecran.unites
  || (console.log('        un champ chiffré n’a pas d’unité'), false));
check('chaque réglage annonce sa valeur par défaut', ecran.defauts);
check('et les bornes sont portées par le champ lui-même', ecran.bornes);
check('les réglages en oui/non sont des bascules, pas du texte', ecran.bascules >= 2);

/* Modifier, et voir que c'est modifié. Sans cette marque on ne distingue pas
   un réglage laissé tel quel d'un réglage fixé sur une valeur qui se trouve
   être la même — et on ne sait plus ce qu'on a touché. */
const modif = await page.evaluate(async () => {
  const rg = document.querySelector('#main .rg[data-rg="virage.but_a"]');
  const i = rg.querySelector('input[type=number]');
  i.value = '555';
  i.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 300));
  return { marque: rg.classList.contains('change'),
    dit: document.getElementById('quoi')?.textContent ?? '' };
});
check('modifier un réglage l’enregistre', /enregistré/.test(modif.dit)
  || (console.log('        dit :', modif.dit), false));
check('et l’écran marque ce qui a été touché', modif.marque);

const [[enBase]] = await pool.query(
  'SELECT valeur FROM reglages WHERE cle = ?', ['virage.but_a']);
check('la base porte la nouvelle valeur', Number(enBase?.valeur) === 555
  || (console.log('        en base :', JSON.stringify(enBase?.valeur)), false));

/* Le refus. Il doit arriver en français et nommer la borne : « attendu entre
   50 et 2000, reçu 5 » se corrige sans rien ouvrir ; « refusé » oblige à
   deviner. */
const refus = await page.evaluate(async () => {
  const i = document.querySelector('#main .rg[data-rg="virage.but_a"] input[type=number]');
  i.value = '5';
  i.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 400));
  return document.getElementById('quoi')?.textContent ?? '';
});
check('une valeur hors bornes est refusée', /Refusé/.test(refus)
  || (console.log('        dit :', refus), false));
check('et le refus nomme la borne, pas seulement « refusé »',
  /entre 50 et 2000/.test(refus) || (console.log('        dit :', refus), false));

/* Le retour au défaut. Il efface la ligne : le contrôle le vérifie en base,
   parce que c'est là que la différence se voit. */
await page.evaluate(async () => {
  document.querySelector('#main .rg[data-rg="virage.but_a"] [data-rendre]')?.click();
  await new Promise((r) => setTimeout(r, 500));
});
const [restant] = await pool.query('SELECT cle FROM reglages WHERE cle = ?', ['virage.but_a']);
check('rendre au défaut efface la ligne au lieu d’y écrire le défaut',
  restant.length === 0);

await pool.execute('DELETE FROM reglages');

/* ============================================================== les saisons

   L'onglet qui ouvre le contenu du jeu pour tout le monde — et le seul de
   cette page qui n'était éprouvé que par une capture d'écran.

   Il ne marchait pas. Ses quatre appels passaient `{ method, body }` en
   deuxième argument de `api(chemin, corps, methode)`, où l'on attend le corps :
   le serveur recevait un POST dont le corps était `{ method: 'PATCH', ... }`,
   refusait sans code, et l'écran affichait « Impossible. ». Aucune saison ne
   pouvait être modifiée, lancée ni supprimée. `admin-smoke` éprouvait les
   routes — elles étaient bonnes — et la capture montrait le formulaire, qui
   s'affichait très bien. Personne ne cliquait sur « Enregistrer ».

   On clique donc, et on regarde **la base** : c'est le seul endroit où la
   différence entre « le formulaire s'est refermé » et « c'est enregistré »
   existe vraiment. */

await page.evaluate(() => [...document.querySelectorAll('#nav button')]
  .find((b) => /SAISONS/.test(b.textContent))?.click());
check('l’onglet des saisons se monte', await jusqua(async () =>
  await page.$('#nouvelle-saison') !== null));

/* La série qu'on ouvrira. Prise dans les listes de l'écran lui-même : le
   serveur refuse une série sans carte de stade 1 publiée, et un identifiant
   écrit en dur ici tomberait le jour où cette série-là est vidée. */
const serieChoisie = await page.evaluate(() => {
  document.getElementById('nouvelle-saison').click();
  const c = document.querySelector('#s-series input[type=checkbox]');
  return c ? c.value : null;
});
check('le formulaire propose les séries du catalogue', serieChoisie !== null);

await page.evaluate((serie) => {
  document.getElementById('s-num').value = '77';
  document.getElementById('s-nom').value = 'Saison d’essai';
  document.getElementById('s-txt').value = 'Pour voir si le bouton écrit.';
  const c = [...document.querySelectorAll('#s-series input[type=checkbox]')]
    .find((i) => i.value === serie);
  c.checked = true;
  document.getElementById('s-ok').click();
}, serieChoisie);

check('« Créer le brouillon » écrit vraiment en base', await jusqua(async () => {
  const [r] = await pool.query('SELECT id FROM saisons WHERE nom = ?', ['Saison d’essai']);
  return r.length === 1;
}));

/* Le reçu. C'est lui qui répond à la question que le bouton laissait ouverte :
   est-ce que c'est passé ? Sans lui, le formulaire se refermait et un
   administrateur n'avait aucun moyen de le savoir depuis l'écran. */
check('et l’écran le dit, au lieu de refermer en silence', await jusqua(async () =>
  await page.evaluate(() => {
    const r = document.querySelector('.recu.on');
    return Boolean(r) && !r.classList.contains('rate');
  }), 3000));

const [[brouillon]] = await pool.query(
  'SELECT id, numero, series FROM saisons WHERE nom = ?', ['Saison d’essai']);
check('avec le numéro et la série cochés', Number(brouillon.numero) === 77
  && String(brouillon.series).includes(serieChoisie));

/* --------------------------------------------------------- la modification */

/* Par identifiant, et non « la dernière carte » : les cartes sont rendues de
   la plus récente à la plus ancienne, et `.at(-1)` visait donc la saison 1
   reprise par `sql/saisons.sql`. Le contrôle renommait une saison et en
   relisait une autre. */
check('le brouillon apparaît dans la liste', await jusqua(async () =>
  await page.evaluate((id) =>
    document.querySelector(`[data-editer-saison="${id}"]`) !== null, brouillon.id)));
await page.evaluate((id) =>
  document.querySelector(`[data-editer-saison="${id}"]`).click(), brouillon.id);
await jusqua(async () => await page.$('#s-nom') !== null);
await page.evaluate(() => {
  document.getElementById('s-nom').value = 'Saison relue';
  document.getElementById('s-ok').click();
});
check('« Enregistrer » modifie une saison existante', await jusqua(async () => {
  const [r] = await pool.query('SELECT nom FROM saisons WHERE id = ?', [brouillon.id]);
  return r[0]?.nom === 'Saison relue';
}));

/* ------------------------------------------------------------ le lancement

   Le geste le plus visible du jeu : il ouvre du contenu pour tous les joueurs
   connectés. Il passe par une confirmation, qu'on accepte comme le ferait un
   administrateur — en cliquant, pas en la contournant. */

const dire = async (mot) => page.evaluate((m) => {
  const b = [...document.querySelectorAll('.tbf-dial button, dialog button')]
    .find((x) => new RegExp(m, 'i').test(x.textContent));
  b?.click();
  return Boolean(b);
}, mot);

await page.evaluate((id) => document.querySelector(`[data-lancer="${id}"]`).click(),
  brouillon.id);
await dodo(400);
check('lancer une saison demande confirmation', await page.evaluate(() =>
  /LANCER LA SAISON/i.test(document.body.textContent)));
check('et la confirmation nomme ce qui s’ouvre', await page.evaluate(() =>
  /série\(s\)/.test(document.body.textContent)));
await dire('LANCER');

check('la saison est lancée en base', await jusqua(async () => {
  const [r] = await pool.query('SELECT lancee_a FROM saisons WHERE id = ?', [brouillon.id]);
  return r[0]?.lancee_a != null;
}));

/* Et le jeu l'applique : la série cochée est désormais la seule ouverte.
   Sans ce contrôle, « lancée » ne serait qu'une date dans une colonne. */
{
  const { seriesOuvertes } = await import('../src/server/fanzzy/catalogue.js');
  const ouvertes = seriesOuvertes();
  check('et le jeu n’ouvre plus qu’elle',
    Array.isArray(ouvertes) && ouvertes.length === 1 && ouvertes[0] === serieChoisie);
}

/* ------------------------------------------ le retour en arrière, et l'effacement

   Une saison lancée ne se supprime pas : c'est un refus du serveur, et l'écran
   doit le dire en français. On le remet donc en brouillon d'abord — le geste
   distinct et réversible que le refus recommande. */

await page.evaluate((id) => document.querySelector(`[data-lancer="${id}"]`).click(),
  brouillon.id);
await dodo(400);
await dire('REFERMER');
check('remettre en brouillon referme la saison', await jusqua(async () => {
  const [r] = await pool.query('SELECT lancee_a FROM saisons WHERE id = ?', [brouillon.id]);
  return r[0]?.lancee_a == null;
}));

await page.evaluate((id) => document.querySelector(`[data-suppr-saison="${id}"]`).click(),
  brouillon.id);
await dodo(400);
await dire('SUPPRIMER');
check('un brouillon se supprime', await jusqua(async () => {
  const [r] = await pool.query('SELECT id FROM saisons WHERE id = ?', [brouillon.id]);
  return r.length === 0;
}));


check('aucune erreur de script pendant toute la session', erreurs.length === 0);
if (erreurs.length) console.log('   ', erreurs.slice(0, 3));

if (process.env.CAPTURE) {
  const { tmpdir } = await import('node:os');
  await page.screenshot({ path: path.join(tmpdir(), 'admin-fanzzy.png'), fullPage: false });

  /* L'écran des saisons, qui est le seul endroit d'où l'on ouvre du contenu. Il
     se regarde : trois défauts du lot précédent n'ont été vus que sur l'image. */
  await page.evaluate(() => [...document.querySelectorAll('nav button')]
    .find((b) => /SAISONS/.test(b.textContent))?.click());
  await new Promise((r) => setTimeout(r, 500));
  await page.evaluate(() => document.getElementById('nouvelle-saison')?.click());
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: path.join(tmpdir(), 'admin-saisons.png'), fullPage: true });
  console.log(`   captures : ${path.join(tmpdir(), 'admin-fanzzy.png')}`);
  console.log(`              ${path.join(tmpdir(), 'admin-saisons.png')}`);
}

/* =============================== TOUS les champs, un par un, jusqu'en base

   ## Pourquoi ce contrôle existe

   L'écran des réglages en compte une quarantaine. Les suites en éprouvaient
   **un** — `virage.but_a` — et en déduisaient que le mécanisme marchait. C'est
   vrai du mécanisme ; ça ne dit rien des trente-neuf autres, dont chacun a son
   type, ses bornes et son nom de clé. Une clé mal orthographiée dans le
   registre, un type que le serveur refuse, une borne qui exclut sa propre
   valeur par défaut : rien de tout ça ne se voit en relisant, et tout ça
   s'enregistre en silence ou refuse en silence.

   ## Ce qu'il fait

   Pour chaque réglage : il calcule une valeur **différente de celle affichée**
   mais dans les bornes, la pose par l'écran comme le ferait un doigt, puis va
   la relire **en base**. Pas dans la page — la page pourrait afficher ce
   qu'elle vient de taper sans que rien ne soit parti.

   Et il remet tout en état après : les autres suites partagent cette base.
*/
{
  await page.evaluate(() => [...document.querySelectorAll('nav button')]
    .find((b) => /RÉGLAGES/i.test(b.textContent))?.click());
  await jusqua(async () => await page.evaluate(() =>
    document.querySelectorAll('#main .rg').length > 15));

  /** Le registre, tel que le serveur le déclare. */
  const registre = await page.evaluate(async () => {
    const r = await fetch('/api/admin/registre', { credentials: 'same-origin' });
    return r.json();
  });

  /**
   * Une valeur neuve, différente de l'actuelle et dans les bornes.
   *
   * Différente, parce qu'un champ qu'on « change » pour la même valeur ne
   * déclenche aucun `change` dans un navigateur : le contrôle passerait au vert
   * sans que rien n'ait été posé.
   */
  const neuve = (r, actuelle) => {
    if (r.type === 'booleen') return !actuelle;
    /* Un texte libre n'a pas de « cran suivant » : on en écrit un, court et
       reconnaissable. Sans ce cas, le seul champ de texte de l'écran — le
       message de fermeture, celui que tous les joueurs liront un jour de
       panne — restait le seul jamais éprouvé. */
    if (r.type === 'texte') return 'Essai du banc, à effacer.';
    if (r.type === 'choix') {
      const autres = (r.choix ?? []).map(([v]) => v).filter((v) => v !== actuelle);
      return autres[0] ?? null;
    }
    const min = Number(r.min ?? 0);
    const max = Number(r.max ?? 1000);
    const pas = r.type === 'decimal' ? 0.01 : 1;
    const haut = Number(actuelle) + pas;
    const bas = Number(actuelle) - pas;
    if (haut <= max) return Number(haut.toFixed(2));
    if (bas >= min) return Number(bas.toFixed(2));
    return null;   // borne d'un seul cran : rien à changer
  };

  const rates = [];
  const sautes = [];
  let poses = 0;

  for (const r of registre.reglages) {
    const actuelle = registre.valeurs[r.cle];
    const v = neuve(r, actuelle);
    if (v === null || v === undefined) { sautes.push(r.cle); continue; }

    /* On pose par l'écran, pas par l'API : c'est le chemin du doigt qu'on
       éprouve — le champ, son `change`, la lecture de son type, l'appel. */
    const pose = await page.evaluate(async ({ cle, val, type }) => {
      const el = document.querySelector(`[data-champ="${CSS.escape(cle)}"]`)
        ?? document.querySelector(`[data-bascule="${CSS.escape(cle)}"]`);
      if (!el) return 'aucun champ à l’écran';
      if (el.dataset.bascule !== undefined) { el.click(); return null; }
      el.value = String(val);
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return null;
    }, { cle: r.cle, val: v, type: r.type });

    if (pose) { rates.push(`${r.cle} : ${pose}`); continue; }
    poses += 1;

    /* **On relit en base**, et pas à l'écran. Une page peut montrer ce qu'on
       vient d'y taper sans que rien ne soit parti — c'est même le défaut le
       plus courant de ce genre d'écran. */
    const arrive = await jusqua(async () => {
      const [l] = await pool.query('SELECT valeur FROM reglages WHERE cle = ?', [r.cle]);
      if (!l.length) return false;
      const brutVal = l[0].valeur;
      const lu = typeof brutVal === 'string' ? brutVal : JSON.stringify(brutVal);
      return String(lu).replace(/^"|"$/g, '') === String(v);
    }, 4000);

    if (!arrive) {
      const [l] = await pool.query('SELECT valeur FROM reglages WHERE cle = ?', [r.cle]);
      rates.push(`${r.cle} : posé ${v}, la base dit ${
        l.length ? JSON.stringify(l[0].valeur) : '(rien)'}`);
    }
  }

  check(`tous les champs des réglages s'enregistrent (${poses} éprouvés)`,
    rates.length === 0
    || (console.log('        ratés :'), rates.forEach((x) => console.log('          ' + x)), false));
  /* Les sautés sont ceux dont la borne ne laisse aucun autre cran — un booléen
     n'en a pas, un choix à une seule option non plus. Les taire ferait croire
     à une couverture complète. */
  if (sautes.length) console.log(`        (${sautes.length} sans autre valeur possible : ${sautes.join(', ')})`);
  check('et aucun réglage n’est resté hors de portée du doigt',
    poses + sautes.length === registre.reglages.length
    || (console.log('        déclarés', registre.reglages.length,
      '· posés', poses, '· sautés', sautes.length), false));

  /* La base repart propre : les autres suites la partagent, et un barème
     décalé d'un cran fait rougir très loin d'ici. */
  await pool.execute('DELETE FROM reglages');
}

/* ==================================================== la navigation, rangée

   Huit onglets à plat, c'est une liste qu'on relit entièrement à chaque fois.
   Trois familles disent en plus ce que chacun décide : le contenu, les nombres,
   ou rien du tout — il regarde. */
{
  const fam = await page.evaluate(() =>
    [...document.querySelectorAll('#nav .fam i')].map((x) => x.textContent.trim()));
  check('les onglets sont rangés en familles', fam.length === 3
    || (console.log('        vu :', JSON.stringify(fam)), false));
  check('et les familles se nomment',
    /CONTENU/.test(fam[0] ?? '') && /JEU/.test(fam[1] ?? '') && /EXPLOITATION/.test(fam[2] ?? ''));
  /* **On ne compte pas, on nomme.** Le premier jet vérifiait « huit boutons »
     et rougissait le jour où CONTENUS est arrivé — en accusant le regroupement
     d'avoir perdu un onglet, alors qu'il en avait gagné un. Un nombre attendu
     se périme à chaque ajout ; une liste de noms dit ce qu'on veut vraiment
     savoir : **le rangement n'a fait disparaître personne.** */
  const attendus = ['SAISONS', 'FANZZY', 'CONTENUS', 'TENUES', 'RÉGLAGES',
    'APERÇU', 'JOUEURS', 'COMPÉTITIONS', 'JOURNAL'];
  const vus = await page.evaluate(() =>
    [...document.querySelectorAll('#nav button')].map((b) => b.textContent.trim()));
  check('le rangement n’a fait disparaître aucun onglet',
    attendus.every((t) => vus.includes(t))
    || (console.log('        manquent :',
      attendus.filter((t) => !vus.includes(t)).join(' ')), false));
  check('et n’en a inventé aucun', vus.every((t) => attendus.includes(t))
    || (console.log('        en trop :',
      vus.filter((t) => !attendus.includes(t)).join(' ')), false));
}

/* ==================================================== l'aperçu qui oriente

   Il ne montrait que des compteurs de population. La question qu'on se pose en
   ouvrant cette page — *qu'est-ce que les joueurs peuvent obtenir aujourd'hui,
   et où ça se règle* — traverse quatre onglets et n'avait aucune réponse. */
await page.evaluate(() => [...document.querySelectorAll('nav button')]
  .find((b) => /APERÇU/i.test(b.textContent))?.click());
await dodo(500);
{
  const t = await page.evaluate(() => document.getElementById('main').textContent);
  check('l’aperçu dit ce qui est en jeu', /CE QUI EST EN JEU/.test(t)
    || (console.log('        il dit :', t.slice(0, 120)), false));
  check('il nomme les séries ouvertes', /Séries ouvertes/.test(t));
  check('et il nomme l’onglet où ça se change', /SAISONS/.test(t));
}

/* ==================================================== l'onglet CONTENUS

   Vingt-neuf cartes d'action, dix-sept pièces d'équipement, dix stades, et
   aucun écran : on ne pouvait les ouvrir qu'en les cochant dans une saison, et
   jamais les refermer. */
await page.evaluate(() => [...document.querySelectorAll('nav button')]
  .find((b) => /CONTENUS/i.test(b.textContent))?.click());
check('l’onglet des contenus se monte', await jusqua(async () =>
  await page.evaluate(() => document.querySelectorAll('#c-corps tr').length > 20)));
{
  const total = await page.evaluate(() => document.querySelectorAll('#c-corps tr').length);
  check('les trois familles y sont ensemble', total >= 50
    || (console.log('        lignes :', total), false));

  /* Le filtre est structuré, et pas plein texte : « toutes les cartes d'action
     retirées » ne se tape pas dans une boîte de recherche. */
  await page.select('#c-famille', 'stade');
  await dodo(350);
  const stades = await page.evaluate(() => document.querySelectorAll('#c-corps tr').length);
  check('filtrer sur une famille réduit la liste', stades > 0 && stades < total
    || (console.log('        stades :', stades, 'sur', total), false));

  /* **Le geste qui manquait.** Une saison ouvre ; rien ne refermait. */
  await page.evaluate(() => document.querySelector('#c-corps [data-basculer]')?.click());
  await dodo(700);
  const retires = await page.evaluate(() =>
    document.querySelectorAll('#c-corps tr.depublie').length);
  check('retirer un contenu se voit à l’écran', retires >= 1
    || (console.log('        retirés :', retires), false));

  await page.select('#c-etat', 'retire');
  await dodo(350);
  check('et le filtre « retirés seulement » le retrouve',
    (await page.evaluate(() => document.querySelectorAll('#c-corps tr').length)) === retires);

  /* On remet le jeu comme on l'a trouvé : les suites partagent une base. */
  await page.evaluate(() => document.querySelector('#c-corps [data-basculer]')?.click());
  await dodo(700);
}

/* ==================================================== les filtres du catalogue

   Sept cent onze cartes derrière un seul champ libre. « Qu'est-ce qui n'est pas
   dessiné dans cette série » ne se tape pas. */
await page.evaluate(() => [...document.querySelectorAll('nav button')]
  .find((b) => /FANZZY/i.test(b.textContent))?.click());
await jusqua(async () =>
  await page.evaluate(() => document.querySelectorAll('#corps .fzrow').length > 20));
{
  const tout = await page.evaluate(() => document.querySelectorAll('#corps .fzrow').length);
  await page.select('#f-et', 'nu');
  await dodo(400);
  const nus = await page.evaluate(() => document.querySelectorAll('#corps .fzrow').length);
  check('on peut ne voir que ce qui n’est pas dessiné', nus > 0 && nus < tout
    || (console.log('        pas dessinés :', nus, 'sur', tout), false));

  /* Les filtres se **cumulent** : c'est comme ça qu'on cherche du travail à
     faire. Un filtre qui remplacerait le précédent obligerait à tout retaper. */
  await page.select('#f-rr', 'legendaire');
  await dodo(400);
  const deux = await page.evaluate(() => document.querySelectorAll('#corps .fzrow').length);
  check('et les filtres se cumulent', deux <= nus
    || (console.log('        cumul :', deux, '>', nus), false));
  check('le compte annonce ce qui est affiché et sur combien',
    /affichée\(s\) sur/.test(await page.evaluate(() =>
      document.querySelector('.compte')?.textContent ?? '')));
}

await nav.close();
await pool.execute(`DELETE FROM fanzzy WHERE id LIKE 'ZZ%'`);
await pool.execute(`DELETE FROM tenues WHERE id LIKE 'zz%'`);
await pool.end();
await new Promise((r) => http.close(r));

console.log(`\n${failures ? `${failures} échec(s)` : 'tout est vert'}`);
// Pas de process.exit : voir le piège documenté dans ETAT.md.
process.exitCode = failures ? 1 : 0;
