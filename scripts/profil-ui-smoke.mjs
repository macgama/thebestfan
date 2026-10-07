/**
 * Test de la page PROFIL, et surtout de ce qu'on vient d'y ajouter.
 *
 * ## Ce qui manquait
 *
 * Le profil listait ce qu'un joueur **possède** — des clubs, un Fanzzy, de
 * l'équipement — et rien de ce qu'il a **fait**. Ni la liste de ses parties,
 * ni ce que chacune avait rapporté, ni même combien il en avait joué. Une
 * carte de membre sans carnet de bord.
 *
 * Tout était en base depuis le premier jour. Rien ne le lisait.
 *
 * ## Pourquoi un vrai navigateur
 *
 * Le parcours arrive **après** le reste de la page : il se demande à part,
 * sans `await`, pour que le profil s'affiche même si les classements ne
 * répondent pas. C'est exactement le genre de rendu qu'une lecture du fichier
 * ne peut pas juger — il faut attendre qu'il arrive, puis regarder ce qui a
 * été écrit.
 *
 * Usage : node scripts/profil-ui-smoke.mjs
 */
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import puppeteer from 'puppeteer';
import { controlerColonne } from './colonne-ui.mjs';
import { createClassements } from '../src/server/classements/index.js';
import { createOnboarding } from '../src/server/onboarding/index.js';
import { createNiveau } from '../src/server/niveau/index.js';
/* `palier` et `ecarpesDuPalier` : la table du jeu, celle que le serveur sert
   au chemin. Le contrôle compare ce que chaque nœud annonce à elle, et non à
   un libellé recopié qui vieillirait avec la table. */
import { seuil, palier, ecarpesDuPalier } from '../src/shared/niveau.js';
import { charger as chargerCatalogue } from '../src/server/fanzzy/catalogue.js';
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
await raw.query('SET FOREIGN_KEY_CHECKS = 0');
const [tables] = await raw.query('SHOW TABLES');
const noms = tables.map((r) => Object.values(r)[0]);
if (noms.length) await raw.query(`DROP TABLE ${noms.join(',')}`);
await raw.query('SET FOREIGN_KEY_CHECKS = 1');
for (const f of ['auth.sql', 'football.sql', 'minutes.sql', 'couleurs.sql', 'duel.sql',
                 'souvenirs.sql', 'billets.sql', 'fanzzy.sql', 'inventaire.sql', 'skins.sql', 'etats.sql',
                 'tenues.sql', 'deck.sql', 'kop.sql', 'niveau.sql',
                 // Les deux colonnes qui disent de quelle sorte un duel était.
                 // Sans elles, il n'y a rien à raconter.
                 'historique.sql']) {
  await raw.query(readFileSync(path.join(RACINE, 'sql', f), 'utf8'));
}

const U = 'eeeeeeee-0000-0000-0000-000000000001';
await raw.query(`INSERT INTO users (public_id,email,pseudo,password_hash)
                 VALUES (?,?,?,'x')`, [U, 'parcours@ex.fr', 'Parcoureur']);
/* **Niveau 4 et à mi-palier.** Un compte au niveau 1 avec zéro XP donnerait
   une jauge vide et un chemin dont la première marche est aussi la première
   du jeu : on ne verrait ni que la jauge se remplit, ni qu'un palier déjà
   franchi se distingue de ceux qui viennent. */
await raw.query(`INSERT INTO user_wallet (user_id,scarves,packs,xp,onboarded_at,active_fanzzy)
                 VALUES (?,120,3,?,NOW(3),'TR32')`,
  [U, seuil(4) + Math.round((seuil(5) - seuil(4)) / 2)]);
await raw.query(`INSERT INTO teams (id,name,country) VALUES
  (85,'FC Sion','Suisse'),(91,'FC Bale','Suisse')`);
await raw.query('INSERT INTO leagues (id,name,country) VALUES (207,?,?)',
  ['Super League', 'Suisse']);
await raw.query('INSERT INTO user_follows (user_id,team_id,is_main) VALUES (?,85,1)', [U]);
await raw.query(`INSERT INTO fixtures (id,league_id,season,home_id,away_id,status_short,kickoff_at)
                 VALUES (7001,207,2026,85,91,'FT',NOW())`);

/* Cinq parties : un virage et quatre duels, de quatre sortes différentes.
   C'est le minimum pour que « le parcours sépare les sortes » veuille dire
   quelque chose — et la dernière est jouée en neutre, pour que la mention le
   soit aussi. */
await raw.query(`INSERT INTO virage_presence (user_id,fixture_id,side,team_id,ferveur,joined_at)
                 VALUES (?,7001,0,85,240,NOW(3) - INTERVAL 5 MINUTE)`, [U]);
await raw.query(
  /* `p2` est le 2v2 qui éprouve les ajouts : un Fanzzy aligné, de l'XP, une
     durée, un camp, et un coéquipier qui reste à nommer plus bas.

     Les autres lignes gardent leurs colonnes vides **exprès** : ce sont les
     parties d'avant la migration, et l'écran ne doit rien inventer pour elles.
     `xp` y vaut zéro et non nul — la colonne est `NOT NULL DEFAULT 0`, donc
     c'est bien ce qu'une vraie ligne ancienne porte, et c'est ce qu'il faut
     éprouver. Zéro et « on ne sait pas » se disent pareil à l'écran : rien. */
  `INSERT INTO duel_results
     (duel_id,user_id,opponent_id,outcome,goals_for,goals_against,
      fixture_id,team_id,ferveur,format,mode,fanzzy_id,xp,duree_s,side,ended_at)
   VALUES ('p1',?,'x','win', 3,1,7001,85, 120,'1v1','classe',       NULL,0,NULL,NULL, NOW(3) - INTERVAL 1 MINUTE),
          ('p2',?,'x','loss',0,2,7001,85,  60,'2v2','classe',       'TR32',24,312,0, NOW(3) - INTERVAL 2 MINUTE),
          ('p3',?,'x','draw',1,1,7001,85,  30,'1v1','entrainement', NULL,0,NULL,NULL, NOW(3) - INTERVAL 3 MINUTE),
          ('p4',?,'x','win', 2,0,7001,NULL,15,'2v2','entrainement', NULL,0,NULL,NULL, NOW(3) - INTERVAL 4 MINUTE)`,
  [U, U, U, U]);
await raw.end();

/* ----------------------------------------------------------- le serveur */

const pool = mysql.createPool({ uri: DB, connectionLimit: 6, ...OPTIONS_BASE });
await chargerCatalogue(pool);
await chargerTenues(pool);
const requireAuth = (q, _s, n) => { q.user = { id: U }; n(); };

const app = express();
app.use((req, _res, next) => { req.user = { id: U }; next(); });
app.use('/api/rank', createClassements({ pool, requireAuth }).router);
app.use('/api/me', createOnboarding({ pool, requireAuth }).router);
/* La progression est montée comme `server.js` la monte : sans elle, le
   chemin du niveau ne peut pas s'éprouver — il dirait « pas lisible », ce
   qui est le bon comportement mais pas celui qu’on vient mesurer. */
app.use('/api/niveau', createNiveau({ pool, requireAuth }).router);
app.get('/api/auth/me', (_q, s) => s.json({
  user: { id: U, pseudo: 'Parcoureur', email: 'parcours@ex.fr', verified: true },
}));
app.get('/api/souvenirs/mine', (_q, s) => s.json({ souvenirs: [] }));
app.get('/profil', (_q, s) => s.sendFile(path.join(RACINE, 'public', 'profil.html')));
app.use(express.static(path.join(RACINE, 'public')));

const http = createServer(app);
await new Promise((r) => http.listen(0, r));
const base = `http://localhost:${http.address().port}`;

const nav = await puppeteer.launch({ args: ['--no-sandbox'] });
const erreurs = [];
const page = await nav.newPage();
page.on('pageerror', (e) => erreurs.push(e.message));
await page.setViewport({ width: 400, height: 900 });
await page.goto(`${base}/profil`, { waitUntil: 'networkidle0' });

check('le profil s’affiche', await jusqua(async () =>
  page.evaluate(() => document.getElementById('page')?.style.display !== 'none')));

/* ------------------------------------------------------- le parcours

   **Depuis le lot 5, l'en-tête du parcours n'est plus un tableau de bord.**
   Les cinq cases d'avant (« CLASSÉ · 1v1 », « GRAND VIRAGE » et son
   « 240 ferveur »…) sont devenues trois stickers au plus, un par sorte de
   partie jouée — le duel classé, le Virage, l'entraînement, dans l'ordre de
   ce qui compte au classement (`.agregats > .tbf-sticker[data-sorte]`). Le
   détail par format n'a pas disparu : il est passé dans l'`aria-label` du
   sticker, et dans la ligne de précision de chaque ticket (« Classé 1v1 ») —
   la feuille de match ne redit pas deux fois la même chose. On lit donc ces
   deux endroits, et l'on exige d'eux ce qu'on exigeait des cinq cases. */

check('la section du parcours arrive', await jusqua(async () =>
  page.evaluate(() => document.querySelectorAll('#parcours .agregats [data-sorte]').length > 0)));

const vu = await page.evaluate(() => ({
  titres: [...document.querySelectorAll('h2')].map((h) => h.textContent.trim()),
  agregats: [...document.querySelectorAll('#parcours .agregats [data-sorte]')].map((s) => ({
    sorte: s.dataset.sorte,
    texte: s.textContent.replace(/\s+/g, ' ').trim(),
    role: s.getAttribute('role'),
    nom: s.getAttribute('aria-label') ?? '',
  })),
  /* Depuis le lot 5, MON PARCOURS est une feuille de match : un ticket kraft
     par partie (`.tbf-partie`, qui garde la classe `part`), le sujet en titre
     et une seule ligne de précision dessous (`.tbf-partie-q b` / `small`),
     le score à part (`.tbf-partie-score`), l'issue en tampon (`.tbf-tampon`)
     et le gain en sticker. La pastille « VIR » / « 1v1 » a disparu : la sorte
     ouvre désormais la ligne de précision (« Grand Virage », « Classé
     1v1 »), et c'est là qu'on la lit. */
  lignes: [...document.querySelectorAll('#parcours .part')].map((p) => {
    const sous = p.querySelector('.tbf-partie-q small')?.textContent.trim() ?? null;
    const sticker = p.querySelector(':scope > .tbf-sticker');
    return {
      sorte: sous ? sous.split(' · ')[0] : null,
      qui: p.querySelector('.tbf-partie-q b')?.textContent.trim(),
      sous,
      issue: p.querySelector('.tbf-tampon')?.textContent.trim() ?? null,
      /* Le chiffre **visible** du sticker : ses nœuds de texte propres, sans
         le « de ferveur » réservé aux lecteurs d'écran (`.vh`). */
      gain: sticker ? [...sticker.childNodes].filter((n) => n.nodeType === 3)
        .map((n) => n.textContent).join('').trim() : null,
    };
  }),
  encore: Boolean(document.getElementById('encore')),
}));

check('le profil annonce le parcours', vu.titres.includes('MON PARCOURS')
  || (console.log('        titres :', vu.titres.join(', ')), false));

/* Une sorte jouée, un sticker, et les trois dans l'ordre de ce qui compte au
   classement. Le banc a joué des trois : il en faut donc trois, ni quatre ni
   cinq — un sticker par format redirait ce que les tickets disent déjà. */
const agg = Object.fromEntries(vu.agregats.map((a) => [a.sorte, a]));
check('un sticker par sorte jouée : le classé, le Virage, l’entraînement',
  JSON.stringify(vu.agregats.map((a) => a.sorte)) === JSON.stringify(['classe', 'virage', 'entrainement'])
  || (console.log('        stickers :', JSON.stringify(vu.agregats)), false));

/* Le classé et l'entraînement doivent rester **séparés** : un 2v2
   d'entraînement n'est pas un 1v1 classé, et les additionner effacerait la
   seule chose que le joueur vient chercher ici. Les comptes attendus sont
   ceux du banc : `p1` gagné et `p2` perdu en classé, `p3` nul et `p4` gagné
   à l'entraînement — deux et deux, une victoire chacun, et non « 4 duels ». */
check('le duel classé est compté à part', agg.classe?.texte === '2 DUELS CLASSÉS · 1 V'
  || (console.log('        il dit :', agg.classe?.texte), false));
check('l’entraînement aussi', agg.entrainement?.texte === '2 ENTRAÎNEMENTS · 1 V'
  || (console.log('        il dit :', agg.entrainement?.texte), false));

/* Le détail par format, au lecteur d'écran : c'est l'`aria-label` qui le
   porte, et il n'est lu que si le sticker a un rôle — un `span` nommé sans
   rôle est passé sous silence. L'ordre des formats suit celui des lignes du
   serveur (`GROUP BY` sans `ORDER BY`) : on exige chacun, pas leur ordre. */
for (const [cle, nom] of [['classe', 'Duels classés'], ['entrainement', 'Entraînements']]) {
  const a = agg[cle];
  check(`« ${nom} » dit chaque format à part, à qui écoute`,
    a?.role === 'img' && a.nom.startsWith(`${nom} : 2 parties`)
    && a.nom.includes('1 en 1v1') && a.nom.includes('1 en 2v2') && a.nom.includes('1 gagnée')
    || (console.log('        il dit :', a?.role, '·', a?.nom), false));
}

/* Le Virage compte des matchs poussés, pas des victoires : son sticker n'en
   porte pas. */
check('le Virage compte ses matchs, sans victoire inventée',
  agg.virage?.texte === '1 MATCH AU VIRAGE' && agg.virage.role === 'img'
  && agg.virage.nom === 'Grand Virage : 1 match poussé'
  || (console.log('        il dit :', agg.virage?.texte, '·', agg.virage?.nom), false));

/* Les cinq sortes restent séparées, mais sur les tickets : chaque partie
   ouvre sa ligne de précision par sa sorte et son format. C'est là que le
   joueur les lit désormais, et c'est là qu'on exige les cinq. */
const sortesVues = vu.lignes.map((l) => l.sorte);
for (const attendu of ['Classé 1v1', 'Classé 2v2',
                       'Entraînement 1v1', 'Entraînement 2v2', 'Grand Virage']) {
  check(`« ${attendu} » se lit à part sur son ticket`, sortesVues.includes(attendu)
    || (console.log('        vues :', sortesVues.join(' | ')), false));
}

/* Ce que le Virage a rapporté ne s'écrit plus en total (choix du lot 5, voir
   plus haut) : il se lit sur le ticket du match, en sticker. Le banc n'a
   qu'un match au Virage, à 240 de ferveur : c'est donc ce que son ticket
   doit porter. */
const virage = vu.lignes.find((l) => l.sorte === 'Grand Virage');
check('le virage dit ce qu’il a rapporté', virage?.gain === '+240'
  || (console.log('        il dit :', virage?.gain), false));

/* La liste mêle les deux jeux, la plus récente d'abord. */
check('la liste montre les parties', vu.lignes.length >= 5
  || (console.log('        lignes :', vu.lignes.length), false));
check('elle mêle le duel et le virage',
  vu.lignes.some((l) => l.sorte === 'Grand Virage')
  && vu.lignes.some((l) => /^(Classé|Entraînement) 1v1$/.test(l.sorte ?? ''))
  || (console.log('        sortes :', vu.lignes.map((l) => l.sorte).join(' | ')), false));
check('chaque ligne nomme le match', vu.lignes[0]?.qui === 'FC Sion – FC Bale'
  || (console.log('        première :', JSON.stringify(vu.lignes[0])), false));
check('et dit pour qui on poussait', /pour FC Sion/.test(vu.lignes[0]?.sous ?? '')
  || (console.log('        sous-titre :', vu.lignes[0]?.sous), false));
check('l’issue d’un duel se lit', vu.lignes.some((l) => l.issue === 'GAGNÉ'));
check('et ce qu’il a rapporté aussi', vu.lignes.some((l) => /^\+\d+$/.test(l.gain ?? '')));

/* Un neutre — venu pousser sur le match des autres — est **dit** : c'est ce
   qui divise sa ferveur par deux, et une règle qu'on ne découvre qu'en
   comparant deux soirées n'est pas une règle, c'est une surprise. */
check('le neutre est nommé', vu.lignes.some((l) => /neutre/.test(l.sous ?? ''))
  || (console.log('        sous-titres :', vu.lignes.map((l) => l.sous).join(' | ')), false));

/* ---------------------------------------------------------- la suite */

if (vu.encore) {
  const avant = vu.lignes.length;
  await page.evaluate(() => document.getElementById('encore').click());
  const plus = await jusqua(async () => page.evaluate((n) =>
    document.querySelectorAll('#parcours .part').length > n, avant));
  check('« VOIR PLUS » allonge la liste sans la refaire', plus
    || (console.log('        toujours', avant, 'lignes'), false));
} else {
  check('« VOIR PLUS » ne paraît pas quand tout tient en une page', true);
}


/* ------------------------------------------------- le chemin du niveau

 * Le joueur ne voyait de son niveau qu'une pastille sur l'accueil : un chiffre,
 * sans jauge, sans suite, sans rien qui dise à quoi il sert. Monter d'un niveau
 * n'était jamais attendu, et le palier qui ouvre un troisième Fanzzy au deck
 * arrivait comme une surprise chez ceux qui le remarquaient.
 *
 * Le compte du banc est au niveau 4, à mi-palier : c'est ce qui permet de voir
 * à la fois que l'XP du palier se dessine vraiment et qu'un palier déjà
 * franchi se distingue de ceux qui viennent.
 *
 * **Depuis le lot 5, le chemin est une corde à nœuds** (`.tbf-chemin`) posée
 * sur un ticket kraft : un nœud par palier (`.tbf-noeud`) — le passé coché
 * (`data-etat="fait"`, « NIV. 3 »), le courant en bâche or (`data-etat="ici"`,
 * son chiffre et « TU Y ES »), les suivants en pointillé avec ce qu'ils
 * ouvrent, en un seul sticker. Le niveau est passé sur le coin déchiré de la
 * carte (`#nivCoin`), l'XP dans le titre de la rubrique (`#nivXp`), et la
 * jauge est devenue l'écharpe tricotée qui avance sur la corde, du nœud
 * courant vers le suivant (`--p`, la part du palier faite) — le même `--p`
 * que l'anneau du buste. On éprouve la même chose qu'avant sur ce dessin-là,
 * et l'on compare ce que chaque nœud annonce à la table du jeu.
 */
{
  const arrive = await jusqua(async () =>
    page.evaluate(() => document.querySelectorAll('#niveau .tbf-noeud').length > 0));
  check('le chemin du niveau arrive', arrive);

  if (arrive) {
    /* L'XP posée en base : `seuil(4)` plus la moitié du palier. C'est d'elle
       que l'écran doit tirer ce qu'il dessine et ce qu'il écrit. */
    const POUR = seuil(5) - seuil(4);
    const DANS = Math.round(POUR / 2);
    const PART = `${Math.round((DANS / POUR) * 100)}%`;
    /* Les nombres comme la page les écrit (`nombre`), l'espace fine des
       milliers ramenée à une espace simple comme les textes lus plus bas. */
    const fr = (n) => Number(n).toLocaleString('fr').replace(/\s+/g, ' ');

    const niv = await page.evaluate(() => {
      const ici = document.querySelector('#niveau .tbf-noeud[data-etat="ici"]');
      const coin = document.getElementById('nivCoin');
      return {
        coin: coin && !coin.hidden ? coin.textContent.trim() : null,
        coinNom: coin?.getAttribute('aria-label') ?? null,
        xp: document.getElementById('nivXp')?.textContent.replace(/\s+/g, ' ').trim() ?? '',
        part: ici?.style.getPropertyValue('--p').trim() ?? null,
        /* L'écharpe est le `::after` du nœud courant : sa largeur calculée dit
           qu'elle est vraiment dessinée, et pas seulement déclarée. */
        corde: ici ? parseFloat(getComputedStyle(ici, '::after').width) || 0 : 0,
        anneau: document.querySelector('#buste .tbf-anneau')?.style.getPropertyValue('--p').trim() ?? null,
        noeuds: [...document.querySelectorAll('#niveau .tbf-noeud')].map((m) => {
          const etat = m.dataset.etat ?? null;
          const k = m.querySelector('.tbf-noeud-k')?.textContent.trim() ?? '';
          const l = m.querySelector('.tbf-noeud-l')?.textContent.trim() ?? '';
          /* Un nœud à venir ne montre pas son numéro : il le dit aux lecteurs
             d'écran (« Niveau 5 : »), et c'est là qu'on le lit. */
          const nom = m.querySelector(':scope > .vh')?.textContent.trim() ?? '';
          const n = etat === 'ici' ? k
            : etat === 'fait' ? (l.match(/NIV\. (\d+)/)?.[1] ?? null)
            : (nom.match(/Niveau (\d+)/)?.[1] ?? null);
          return {
            n: n == null ? null : Number(n), etat, l,
            verrou: m.hasAttribute('data-verrou'),
            sticker: m.querySelector(':scope > .tbf-sticker')?.textContent.replace(/\s+/g, ' ').trim() ?? null,
          };
        }),
        large: Math.round(document.getElementById('niveau').getBoundingClientRect().width),
        colonne: Math.round(document.getElementById('app').getBoundingClientRect().width),
      };
    });
    const aVenir = niv.noeuds.filter((m) => !m.etat);
    const icis = niv.noeuds.filter((m) => m.etat === 'ici');

    /* La jauge ne « pousse » plus après le rendu : l'écharpe est posée à sa
       part dès que le chemin s'écrit. L'ancien contrôle attendait d'ailleurs
       seulement qu'elle finisse non vide. Ce qu'on exige maintenant est plus
       précis : qu'elle dise la vraie part du palier — la moitié, ici — et
       qu'elle se voie. */
    check('et l’écharpe de l’XP avance sur la corde, à la part faite',
      niv.part === PART && niv.corde > 0
      || (console.log('        --p :', niv.part, '· attendu', PART, '· largeur', niv.corde), false));
    check('et l’anneau du buste dit la même part', niv.anneau === PART
      || (console.log('        anneau :', niv.anneau), false));

    check('il dit le niveau atteint', niv.coin === '4' && niv.coinNom === 'Niveau 4'
      || (console.log('        coin :', niv.coin, '·', niv.coinNom), false));
    check('et ce qui reste avant le suivant',
      /XP/.test(niv.xp) && niv.xp.includes(`encore ${fr(POUR - DANS)}`)
      || (console.log('        il dit :', niv.xp), false));

    /* **Ce qui vient**, et non seulement où l'on est. C'est toute la différence
       entre un compteur et un chemin : on doit pouvoir lire, sans chercher, ce
       que le prochain palier ouvre. */
    check('il montre les paliers à venir', aVenir.length >= 3
      || (console.log('        à venir :', aVenir.length), false));
    check('le palier du moment est marqué', icis.length === 1
      || (console.log('        nœuds courants :', icis.length), false));
    check('et c’est celui où l’on est', icis[0]?.n === 4 && icis[0]?.l === 'TU Y ES'
      || (console.log('        il dit :', JSON.stringify(icis[0])), false));
    /* Ce que le compte à mi-palier 4 permet de voir : le passé coché, et lui
       seulement derrière soi ; ce qui vient, et lui seulement devant. */
    const faits = niv.noeuds.filter((m) => m.etat === 'fait');
    check('un palier franchi se distingue de ceux qui viennent',
      faits.length >= 1 && faits.every((m) => m.n < 4) && aVenir.every((m) => m.n > 4)
      || (console.log('        nœuds :', JSON.stringify(niv.noeuds)), false));

    /* Le niveau 5 ouvre le troisième Fanzzy au deck : c'est le palier que ce
       compte a devant lui, et il doit être **nommé**, pas laissé à deviner.
       Le cadenas (`data-verrou`) ne marque que les nœuds qui ouvrent quelque
       chose selon la table, et tous ceux-là. */
    const ouvre = (k) => Boolean(palier(k)?.slots || palier(k)?.deckFanzzy);
    const cinq = aVenir.find((m) => m.n === 5);
    check('un palier qui ouvre quelque chose se distingue',
      cinq?.verrou === true && aVenir.every((m) => m.verrou === ouvre(m.n))
      || (console.log('        nœuds :', JSON.stringify(aVenir)), false));
    /* Le libellé est celui de la maquette — un sticker « 3ᵉ FANZZY », comme
       « 4ᵉ CLUB » —, et non plus la phrase « 3ᵉ Fanzzy au deck » : un nœud
       porte un sticker, pas une ligne de texte sur le kraft. Le chiffre, lui,
       doit être celui de la table. */
    check('et il dit ce qu’il ouvre',
      cinq?.sticker === `${palier(5)?.deckFanzzy}ᵉ FANZZY`
      || (console.log('        il dit :', cinq?.sticker), false));
    /* Chaque niveau verse des écharpes. Elles tombaient sans que rien ne les
       ait annoncées ; le chemin les annonce, au montant de la table. Un nœud
       qui ouvre quelque chose ne porte que ce qu'il ouvre (un sticker par
       nœud, comme sur la maquette) : l'exigence vaut donc pour tous les
       autres paliers à venir, et il doit y en avoir au moins un. */
    const simples = aVenir.filter((m) => !ouvre(m.n));
    check('chaque palier qui n’ouvre rien annonce ses écharpes',
      simples.length >= 1
      && simples.every((m) => m.sticker === `+${fr(ecarpesDuPalier(m.n))} écharpes`)
      || (console.log('        il dit :', JSON.stringify(simples.map((m) => [m.n, m.sticker]))), false));

    check('et le bloc tient dans la colonne', niv.large <= niv.colonne + 1);
  }
}

check('aucune erreur de script sur le profil', erreurs.length === 0
  || (console.log('       ', erreurs.slice(0, 3)), false));

/* ================================ ce qu'une ligne de duel dit maintenant

   Elle montrait une issue, un score et de la ferveur. Elle ne disait ni avec
   quel Fanzzy on avait joué, ni ce que la partie avait rapporté en progression,
   ni combien de temps elle avait duré, ni qui était dans quel camp —
   `opponent_id` ne nommant qu'un adversaire pris au hasard, ce qui ne dit rien
   d'un 3v3.

   On pose un coéquipier et deux adversaires sur `p2`, puis on lit la ligne
   telle qu'elle s'affiche. */
{
  const AMI = 'cccc0000-0000-0000-0000-00000000000c';
  const ADV = 'dddd0000-0000-0000-0000-00000000000d';
  for (const [id, nom] of [[AMI, 'Marie'], [ADV, 'Rachid']]) {
    await pool.query(`INSERT INTO users (public_id,email,pseudo,password_hash)
                      VALUES (?,?,?,'x')`, [id, `${nom.toLowerCase()}@ex.fr`, nom]);
  }
  /* Marie est du même côté que le lecteur (camp 0), Rachid d'en face. Le 2v2
     attend deux joueurs par camp : il manque donc **un** adversaire, et c'était
     une machine. L'écran doit le dire plutôt que de laisser croire qu'on était
     à deux contre un. */
  await pool.query(`INSERT INTO duel_results
      (duel_id,user_id,opponent_id,outcome,goals_for,goals_against,
       fixture_id,team_id,ferveur,format,mode,side,ended_at)
    VALUES ('p2',?,'x','loss',0,2,7001,85,10,'2v2','classe',0, NOW(3) - INTERVAL 2 MINUTE),
           ('p2',?,'x','win', 2,0,7001,91,10,'2v2','classe',1, NOW(3) - INTERVAL 2 MINUTE)`,
    [AMI, ADV]);

  await page.reload({ waitUntil: 'networkidle0' });
  await jusqua(async () =>
    page.evaluate(() => document.querySelectorAll('#parcours .part').length > 0));

  /* Sur la feuille de match, la sorte ouvre la ligne de précision (« Classé
     2v2 · … ») et l'issue est le tampon du ticket. Le score a sa place à lui
     (`.tbf-partie-score`), et l'XP est passée dans la ligne de précision,
     juste après la sorte et la durée. */
  const l = await page.evaluate(() => {
    const p2 = [...document.querySelectorAll('#parcours .part')]
      .find((x) => /2v2$/.test((x.querySelector('.tbf-partie-q small')?.textContent ?? '').split(' · ')[0])
                && /PERDU/.test(x.querySelector('.tbf-tampon')?.textContent ?? ''));
    return p2 ? {
      sous: p2.querySelector('.tbf-partie-q small')?.textContent.replace(/\s+/g, ' ').trim(),
      score: p2.querySelector('.tbf-partie-score')?.textContent.replace(/\s+/g, ' ').trim() ?? null,
    } : null;
  });
  check('la ligne du 2v2 classé se retrouve', Boolean(l)
    || (console.log('        aucune ligne 2v2 perdue'), false));

  check('elle nomme le coéquipier', /avec Marie/.test(l?.sous ?? '')
    || (console.log('        elle dit :', l?.sous), false));
  /* Un adversaire humain, une machine : la phrase doit porter les deux.
     « contre Rachid » seul serait faux sur un 2v2. */
  check('elle nomme l’adversaire et compte la machine',
    /contre Rachid et 1 bot/.test(l?.sous ?? '')
    || (console.log('        elle dit :', l?.sous), false));
  check('elle dit avec quel Fanzzy on a joué', /en Choriste/.test(l?.sous ?? '')
    || (console.log('        elle dit :', l?.sous), false));
  check('et combien de temps ça a duré', /5 min/.test(l?.sous ?? '')
    || (console.log('        elle dit :', l?.sous), false));
  /* L'XP à côté du score : c'est ce qu'on regarde en premier après une partie,
     et le parcours n'en montrait rien. Le score et l'XP ne sont plus dans le
     même élément : on exige donc les deux sur le même ticket — le score de
     la partie (0 – 2) et son XP. */
  check('l’XP est annoncée avec le score',
    /\+24 XP/.test(l?.sous ?? '') && /^0 – 2$/.test(l?.score ?? '')
    || (console.log('        elle dit :', l?.sous, '· score :', l?.score), false));

  /* Et les parties d'avant la migration n'inventent rien : pas de « +0 XP »,
     pas de « 0 s ». Zéro serait un mensonge là où la vérité est « on ne sait
     pas ». L'XP pouvant désormais s'écrire dans la ligne de précision, c'est
     tout le ticket qu'on lit, et non plus le seul coin du gain. */
  const vieille = await page.evaluate(() => {
    const p1 = [...document.querySelectorAll('#parcours .part')]
      .find((x) => /GAGNÉ/.test(x.querySelector('.tbf-tampon')?.textContent ?? '')
                && /1v1$/.test((x.querySelector('.tbf-partie-q small')?.textContent ?? '').split(' · ')[0]));
    return p1 ? {
      sous: p1.querySelector('.tbf-partie-q small')?.textContent.replace(/\s+/g, ' ').trim(),
      texte: p1.textContent.replace(/\s+/g, ' ').trim(),
    } : null;
  });
  check('une partie d’avant ces colonnes n’invente pas de chiffres',
    Boolean(vieille) && !/XP/.test(vieille.texte) && !/(^|\s)0 s\b/.test(vieille.sous ?? '')
    || (console.log('        elle dit :', JSON.stringify(vieille)), false));
}

/* ===================================================== sur un ordinateur

   Le profil garde la largeur du téléphone (Gaël, 7 octobre 2026). */
await controlerColonne(page, check, { nom: 'le profil',
  pret: () => jusqua(async () =>
    page.evaluate(() => document.querySelectorAll('#parcours .part').length > 0)) });

await nav.close();
await new Promise((r) => http.close(r));
await pool.end();

console.log(failures ? `\n${failures} test(s) en échec` : '\ntout est vert');
process.exitCode = failures ? 1 : 0;
