/**
 * Le menu accordéon : le même partout, et complet pour un administrateur.
 *
 * ## Ce que ce contrôle attrape, et que rien d'autre n'attrapait
 *
 * Deux fautes ont vécu longtemps, chacune invisible à la relecture et à toutes
 * les suites existantes.
 *
 *   1. **Deux menus.** `nav.js` en montait un sur les dix-huit pages de
 *      contenu ; l'accueil, qui ne charge pas `nav.js`, s'était écrit le sien
 *      dans son HTML. Ils ont divergé de six entrées — pas de Virage, pas de
 *      duel, pas de boutique, pas de boosters, pas de carnet, pas d'amis
 *      depuis l'accueil — et d'une confirmation de déconnexion présente d'un
 *      côté seulement. Rien ne cassait : les deux s'ouvraient, les deux
 *      menaient quelque part.
 *
 *   2. **L'entrée d'administration disparue.** Elle se posait avec
 *      `nav.appendChild(a)`, sur une variable `nav` qui avait disparu avec la
 *      barre du bas. La référence levait, le `try { } catch { }` du bloc
 *      l'avalait, et **plus aucun administrateur ne voyait l'entrée**. Un
 *      `catch` muet autour d'un ajout facultatif est le meilleur endroit pour
 *      cacher une panne : il n'y a ni erreur, ni trace, ni test qui tombe.
 *
 * On mesure donc la seule chose qui compte : **les liens réellement présents
 * dans le tiroir**, sur l'accueil et sur une page de contenu, pour un compte
 * administrateur et pour un compte qui ne l'est pas. Deux listes comparées, pas
 * deux fichiers relus.
 *
 * Avant de lancer :  npm install --no-save puppeteer
 */
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import puppeteer from 'puppeteer';
import { VERSION_PUBLIQUE, ETIQUETTE } from '../src/shared/version.js';

const RACINE = fileURLToPath(new URL('..', import.meta.url));

let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };

/* ----------------------------------------------------------- le serveur

   Pas de base : ce contrôle ne regarde que le menu, et le menu ne dépend
   d'aucune donnée de jeu. Les pages interrogent le serveur pour leur propre
   contenu — on répond de quoi les laisser se monter, et rien de plus. */

let estAdmin = false;

const app = express();
app.get('/api/auth/me', (_q, s) => s.json({ user: { pseudo: 'Momo', role: 'joueur' } }));
app.get('/api/admin/suis-je', (_q, s) => s.json({ admin: estAdmin }));
/* Les tribunes et les files que menu.js compte sur ses tuiles : vides, sauf
   au bloc « le monde, sur les autres pages », qui les remplit. */
let enDirect = [];
let enAttente = [];
app.get('/api/virage/live', (_q, s) => s.json({ matchs: enDirect }));
app.get('/api/nvn/attentes', (_q, s) => s.json({ attentes: enAttente, alerte: null }));
app.get('/api/public/reglages', (_q, s) => s.json({}));
/* La **vraie** version, et non un objet inventé : ce qu'on éprouve ici est
   que le tiroir sait l'afficher, pas qu'un banc sait répondre. Le fourre-tout
   `/api` plus bas rendrait `{}`, et la ligne resterait vide — le contrôle
   passerait en ne prouvant rien. */
app.get('/api/version', (_q, s) => s.json(VERSION_PUBLIQUE));
/* Le reste du jeu, en creux. Une page qui demande son contenu et reçoit un
   objet vide se monte quand même ; une page qui reçoit un 404 en HTML tombe
   sur `r.json()` et le contrôle mesurerait alors une page morte. */
app.use('/api', (_q, s) => s.json({}));

for (const [route, fichier] of [['/', 'index.html'], ['/carnet', 'carnet.html'],
  ['/admin', 'admin.html'], ['/virage', 'virage.html']]) {
  app.get(route, (_q, s) => s.sendFile(path.join(RACINE, 'public', fichier)));
}
app.use(express.static(path.join(RACINE, 'public')));

const http = createServer(app);
await new Promise((r) => http.listen(0, r));
const base = `http://localhost:${http.address().port}`;

/* -------------------------------------------------------------- la page */

const nav = await puppeteer.launch({ args: ['--no-sandbox', '--accept-lang=fr-FR'] });

/**
 * Ouvre une page, déplie le menu, et rend ce qu'il contient vraiment.
 *
 * On **clique** le bouton plutôt que de lire le HTML du tiroir : c'est le seul
 * moyen de vérifier que le bouton de cette page-là est bien branché. L'accueil
 * et les pages de contenu n'ont pas le même bouton, et c'est exactement le
 * genre d'écart qui se perd dans un refactor.
 */
async function menuDe(chemin) {
  const page = await nav.newPage();
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  await page.setViewport({ width: 900, height: 900 });
  await page.goto(base + chemin, { waitUntil: 'networkidle0' });

  // Le menu se peuple après la réponse de `/api/admin/suis-je` : l'entrée
  // d'administration arrive une image après les autres.
  const ouvert = await page.evaluate(async () => {
    const b = document.querySelector('.tbf-burger');
    if (!b) return null;
    b.click();
    await new Promise((r) => setTimeout(r, 600));
    const t = document.querySelector('.tbf-tiroir');
    if (!t) return null;
    return {
      visible: t.classList.contains('on') && !t.hidden,
      liens: [...t.querySelectorAll('a')].map((a) => a.getAttribute('href')),
      libelles: [...t.querySelectorAll('a')].map((a) => a.textContent.trim()),
      rubriques: [...t.querySelectorAll('.tbf-rubrique')].map((d) => d.textContent.trim()),
      /* Les interrupteurs du mode calme (lot 0, chantier 13, contrat C4).
         Des boutons et non des liens : ils ne mènent nulle part, ils changent
         le comportement du jeu ici, et un lecteur d'écran doit les annoncer
         comme des interrupteurs (`role="switch"`, `aria-checked`). On relève
         aussi s'ils disent vrai : un interrupteur qui contredit l'état du jeu
         (`data-calme` sur la racine) est pire que pas d'interrupteur. */
      interrupteurs: [...t.querySelectorAll('[role="switch"]')].map((b) => ({
        facette: b.dataset.facette ?? '',
        coche: b.getAttribute('aria-checked'),
        juste: b.getAttribute('aria-checked') === String((document.documentElement
          .dataset.calme ?? '').split(' ').includes(b.dataset.facette)),
        dansLeGroupe: Boolean(b.closest('[role="group"][aria-labelledby="tbf-calme-titre"]')),
      })),
      // La page où l'on est doit se marquer : sans ça le menu propose d'aller
      // là où on est déjà.
      marquee: [...t.querySelectorAll('a.on, .tbf-tiroir-ici.on')]
        .map((a) => a.getAttribute('href')),
      version: t.querySelector('.tbf-version')?.textContent.trim() ?? null,
    };
  });
  return { page, erreurs, ...(ouvert ?? {}) };
}

/* ------------------------------------- le même menu sur deux pages très
   différentes : l'accueil, qui ne charge pas nav.js, et une page de contenu,
   qui ne charge que lui. */

estAdmin = false;
const accueil = await menuDe('/');
const carnet = await menuDe('/carnet');

check('l’accueil a un menu qui s’ouvre', accueil.visible === true);
check('une page de contenu a un menu qui s’ouvre', carnet.visible === true);

check('les deux mènent exactement aux mêmes endroits',
  JSON.stringify(accueil.liens) === JSON.stringify(carnet.liens)
  || (console.log('    accueil :', accueil.liens),
      console.log('    carnet  :', carnet.liens), false));
check('et les libellés sont les mêmes, mot pour mot',
  JSON.stringify(accueil.libelles) === JSON.stringify(carnet.libelles));
/* « MODE CALME » ferme la liste (lot 0, chantier 13) : ce n'est pas un
   endroit où aller, c'est la façon dont le jeu se comporte partout, d'où sa
   place après les trois rubriques de destinations. La liste reste écrite en
   toutes lettres, pour la même raison que `ATTENDUS` plus bas. */
check('les rubriques y sont aussi',
  JSON.stringify(accueil.rubriques)
    === JSON.stringify(['JOUER', 'MA COLLECTION', 'LE FOOTBALL', 'MODE CALME', 'LANGUE'])
  || (console.log('    rubriques :', accueil.rubriques), false));
check('et la page de contenu a les mêmes',
  JSON.stringify(carnet.rubriques) === JSON.stringify(accueil.rubriques));

/* ------------------------------------------------------- le mode calme

   Trois interrupteurs, un par facette du contrat C4 — les sons, les
   vibrations, les animations décoratives —, dans cette rubrique et sur toutes
   les pages. Celui des vibrations peut être **caché** sur un appareil qui ne
   sait pas vibrer : il doit exister quand même, c'est pourquoi on compte les
   éléments et non ce qui est affiché. */
const FACETTES = ['sons', 'vibrations', 'animations'];
for (const [nom, m] of [['l’accueil', accueil], ['une page de contenu', carnet]]) {
  const inter = m.interrupteurs ?? [];
  check(`le mode calme a ses trois interrupteurs depuis ${nom}`,
    JSON.stringify(inter.map((i) => i.facette)) === JSON.stringify(FACETTES)
    && inter.every((i) => i.dansLeGroupe && (i.coche === 'true' || i.coche === 'false'))
    || (console.log('    vus :', JSON.stringify(inter)), false));
  check(`et chacun dit l’état réel du jeu depuis ${nom}`,
    inter.length === FACETTES.length && inter.every((i) => i.juste));
}

/* Un interrupteur se prouve en le touchant : il bascule, la racine du
   document le reflète (c'est là que les feuilles et `FX.calme()` le lisent),
   et la clé `tbf-calme` le retient pour la visite suivante. On le remet
   ensuite comme on l'a trouvé : le navigateur est partagé par toutes les
   ouvertures de cette suite. « animations » et non « sons » : rétablir le son
   joue un « tic », sans rapport avec ce qu'on éprouve ici. */
{
  const bascule = await accueil.page.evaluate(async () => {
    const b = document.querySelector('.tbf-tiroir [role="switch"][data-facette="animations"]');
    if (!b) return null;
    const lire = () => ({
      coche: b.getAttribute('aria-checked'),
      racine: (document.documentElement.dataset.calme ?? '').split(' ').includes('animations'),
      retenu: (() => {
        try { return (localStorage.getItem('tbf-calme') ?? '').split(' ').includes('animations'); }
        catch { return null; }
      })(),
    });
    const avant = lire();
    b.click();
    await new Promise((r) => setTimeout(r, 50));
    const allume = lire();
    b.click();
    await new Promise((r) => setTimeout(r, 50));
    return { avant, allume, eteint: lire() };
  });
  check('toucher un interrupteur coupe la facette, et le jeu le retient',
    bascule?.avant.coche === 'false'
    && bascule.allume.coche === 'true' && bascule.allume.racine && bascule.allume.retenu
    || (console.log('    vu :', JSON.stringify(bascule)), false));
  check('le toucher de nouveau la rétablit',
    bascule?.eteint.coche === 'false' && !bascule.eteint.racine && !bascule.eteint.retenu);
}

/* Le menu est la seule navigation du jeu : ce qui n'y est pas n'existe pas.
   La liste est écrite ici en toutes lettres plutôt que relue depuis menu.js —
   un contrôle qui lit sa référence dans le fichier qu'il contrôle est d'accord
   avec lui par construction, et laisserait passer une entrée supprimée. */
/* `/collection` et `/abonnement` manquaient **ici aussi**, et c'est pourquoi
   le trou ne s'est jamais vu : la liste de référence est écrite à la main, et
   celui qui l'a écrite avait le même angle mort que le menu. Un contrôle ne
   vaut que ce que vaut sa référence — deux écrans complets, servis par le
   serveur et liés depuis l'accueil, n'étaient réclamés par personne. */
const ATTENDUS = ['/', '/virage', '/duel-nvn', '/kop', '/deck', '/boosters', '/boutique',
  '/abonnement', '/collection', '/fanzzy', '/carnet', '/amis', '/matchs', '/equipes',
  '/teletext', '/classement', '/profil', '/compte', '/aide', '/repetition'];
const manquants = ATTENDUS.filter((h) => !accueil.liens.includes(h));
check('toutes les destinations du jeu y sont', manquants.length === 0);
if (manquants.length) console.log('    manquent :', manquants.join(' '));

check('la déconnexion ferme la liste', accueil.liens.at(-1) === '#');
check('la page où l’on est se marque, et elle seule',
  JSON.stringify(carnet.marquee) === JSON.stringify(['/carnet'])
  || (console.log('    marqué :', carnet.marquee), false));

/* ------------------------------------------------ l'entrée d'administration

   Elle est **absente** pour un joueur et **présente** pour un administrateur.
   Les deux moitiés comptent : une entrée toujours affichée ne serait pas une
   panne visible, seulement une fuite d'information. */

check('un joueur ordinaire ne voit pas l’administration',
  !accueil.liens.includes('/admin') && !carnet.liens.includes('/admin'));

estAdmin = true;
const accueilAdmin = await menuDe('/');
const carnetAdmin = await menuDe('/carnet');
const adminPage = await menuDe('/admin');

check('un administrateur la voit depuis l’accueil', accueilAdmin.liens.includes('/admin'));
check('et depuis une page de contenu', carnetAdmin.liens.includes('/admin'));
check('elle se place juste avant la déconnexion',
  accueilAdmin.liens.at(-2) === '/admin');
check('la page d’administration porte le même menu que le reste du jeu',
  adminPage.visible === true
  && JSON.stringify(adminPage.liens) === JSON.stringify(accueilAdmin.liens));

/* ---------------------------------------------- la déconnexion se demande

   Elle se demandait sur l'accueil et pas ailleurs. Une confirmation qui
   n'apparaît que sur certains écrans est pire qu'aucune : on apprend que le
   jeu ne demande pas, et on cesse de lire le jour où il demande. */
for (const [nom, m] of [['l’accueil', accueil], ['une page de contenu', carnet]]) {
  /* Le `try` n'est pas une politesse : sans confirmation, le clic déconnecte
     pour de bon et la page **part** vers l'accueil. Puppeteer lève alors
     « Execution context was destroyed » et la suite s'arrête au milieu, sur
     une pile d'appels qui ne nomme pas le défaut. Une navigation ici *est* le
     défaut, et c'est ainsi qu'on l'écrit. */
  let demande = '';
  try {
    demande = await m.page.evaluate(async () => {
      document.querySelector('.tbf-tiroir .sortie').click();
      await new Promise((r) => setTimeout(r, 400));
      const d = document.querySelector('.tbf-dial, dialog, [role="alertdialog"]');
      return d ? d.textContent.replace(/\s+/g, ' ').trim() : '';
    });
  } catch { demande = '(la page a été quittée sans rien demander)'; }
  check(`la déconnexion demande confirmation depuis ${nom}`,
    /DÉCONNECTER/i.test(demande) || (console.log('    dit :', demande || '(rien)'), false));
}

/* ---------------------------------------- le monde, sur les autres pages

   Depuis le 5 octobre 2026, le tiroir dit **combien** : les supporters de
   toutes les tribunes ouvertes sur la tuile du Virage (l'état `monde`, en
   violet), et les duels qui attendent un joueur sur celle du duel — les
   nombres du bandeau de l'accueil. Le premier ne passe jamais au bouton du
   menu : du monde au Virage chaque soir n'est pas une urgence. Le second,
   si : quelqu'un attend, maintenant. */
{
  enDirect = [
    { id: 41, open: true, fini: false, mien: false, crowd: [20, 11] },
    { id: 42, open: true, fini: false, mien: false, crowd: [4, 2] },
    // Un match fini garde sa foule une minute et demie : elle ne compte plus.
    { id: 43, open: true, fini: true, mien: false, crowd: [9, 9] },
  ];
  enAttente = [
    { fixtureId: 51, format: '3v3', camps: [2, 1] },
    { fixtureId: 52, format: '1v1', camps: [1, 0] },
  ];
  const page = await nav.newPage();
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  await page.setViewport({ width: 900, height: 900 });
  await page.goto(`${base}/carnet`, { waitUntil: 'networkidle0' });
  const lire = () => page.evaluate(() => {
    const t = (h) => {
      const n = document.querySelector(`.tbf-tiroir .tbf-case[href="${h}"]`);
      return `${n?.dataset.etat ?? ''}:${n?.dataset.pastille ?? ''}`;
    };
    return { virage: t('/virage'), duel: t('/duel-nvn'),
      menu: document.querySelector('.tbf-burger')?.dataset.urgence ?? null };
  });
  let e = await lire();
  for (let i = 0; i < 50 && (e.virage === ':' || e.duel === ':'); i++) {
    await new Promise((r) => { setTimeout(r, 60); });
    e = await lire();
  }
  check('sur une page de contenu, le tiroir dit le monde au Virage', e.virage === 'monde:37'
    || (console.log('        virage :', e.virage), false));
  check('et combien de duels attendent un joueur', e.duel === 'attend:2'
    || (console.log('        duel :', e.duel), false));
  check('le bouton du menu annonce le duel, et jamais le monde', e.menu === 'attend'
    || (console.log('        menu :', e.menu), false));
  check('sans erreur de script', erreurs.length === 0
    || (console.log('   ', erreurs.slice(0, 4)), false));
  enDirect = [];
  enAttente = [];
  await page.close();
}

/* --------------------------------------------------- sur un ordinateur

   Gaël, le 7 octobre 2026 : sur un ordinateur, l'application du téléphone,
   au milieu de l'écran, sans rien autour. Les tuiles de l'accueil ne bordent
   plus les pages de contenu ; le menu est le tiroir, comme sur un
   téléphone. */
{
  const page = await nav.newPage();
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  await page.setViewport({ width: 1366, height: 682 });
  await page.goto(`${base}/carnet`, { waitUntil: 'networkidle0' });
  const vu = await page.evaluate(() => ({
    rails: document.querySelectorAll('.tbf-rails').length,
    tiroir: document.querySelectorAll('.tbf-tiroir').length,
    burger: Boolean(document.querySelector('.tbf-burger')),
  }));
  check('à 1 366 px, une page de contenu n’a pas de tuiles autour, et garde son tiroir',
    vu.rails === 0 && vu.tiroir === 1 && vu.burger || (console.log('        vu :', vu), false));
  check('sans erreur de script sur le carnet', erreurs.length === 0
    || (console.log('   ', erreurs.slice(0, 4)), false));
  await page.close();
}

/* ------------------------------------------------------------ le silence */

const bruit = [accueil, carnet, accueilAdmin, carnetAdmin, adminPage]
  .flatMap((m) => m.erreurs);
/* -------------------------------------------- la version, sous les yeux

   Un joueur qui signale un défaut décrit ce qu'il voit ; il ne peut pas dire
   sur quelle version il le voit. Sans ce numéro, chaque retour commence par
   « as-tu rechargé ? », ce qui fait porter au joueur la charge de notre
   déploiement.

   On l'éprouve **sur le même tiroir que le reste** : c'est le seul élément
   présent sur toutes les pages, et c'est déjà pour ça que la marque
   d'abonnement y vit. Une version affichée sur une seule page n'est pas
   affichée. */
check('le tiroir montre la version', accueil.version === ETIQUETTE
  || (console.log('        vu :', JSON.stringify(accueil.version),
    '· attendu :', JSON.stringify(ETIQUETTE)), false));
check('et la même depuis une page de contenu', carnet.version === ETIQUETTE);
/* Le mot compte autant que le nombre : il prévient que les soldes peuvent
   bouger et qu'une saison peut être rejouée. */
check('elle dit que c’est une bêta', /bêta/i.test(ETIQUETTE));
check('et elle porte un numéro', /\d/.test(ETIQUETTE));

check('aucune erreur de script sur aucune des cinq ouvertures', bruit.length === 0);
if (bruit.length) console.log('   ', bruit.slice(0, 4));

await nav.close();
await new Promise((r) => http.close(r));

console.log(`\n${failures ? `${failures} échec(s)` : 'tout est vert'}`);
// Pas de process.exit : voir le piège documenté dans ETAT.md.
process.exitCode = failures ? 1 : 0;
