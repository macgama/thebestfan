/**
 * Le registre des réglages.
 *
 * ## Ce qu'on éprouve, et pourquoi c'est ce qui compte
 *
 * L'écran de réglages existait déjà, et il ne servait à rien : on pouvait y
 * écrire n'importe quelle clé, la relire, la voir listée — et **une seule**
 * clé sur toutes celles qu'on pouvait taper était réellement lue par le jeu.
 * L'écran proposait même en exemple une clé `annonce` censée afficher un
 * bandeau à tous les joueurs ; rien, nulle part, ne la lisait.
 *
 * Un réglage qui ne règle rien ne casse rien : il se contente de ne pas être
 * là, et personne ne s'en aperçoit avant d'en avoir besoin. C'est exactement
 * le genre de défaut qu'aucune suite ne trouve si elle se contente de vérifier
 * que l'écriture a bien écrit.
 *
 * La suite éprouve donc, dans cet ordre :
 *   1. **qu'écrire change le jeu** — la valeur que le moteur lit, pas celle
 *      que la base contient ;
 *   2. **qu'une valeur refusée dit pourquoi** — nommer la borne, pas « refusé » ;
 *   3. **que la remise au défaut efface la ligne** plutôt que d'y écrire le
 *      défaut, sans quoi un changement de registre serait figé pour toujours ;
 *   4. **que la route publique ne publie pas l'équilibrage** ;
 *   5. **que ce qui est dessiné reste hors du registre** — l'échelle du
 *      verdict (`src/shared/verdict.js`), dont les bornes sont éprouvées
 *      sans base par `verdict-smoke`.
 */
import express from 'express';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import {
  DEFAUTS, PAR_CLE, REGLAGES, SECTIONS, ReglageInvalide, valider, resoudre,
} from '../src/shared/reglages.js';
import {
  chargerReglages, ecrireReglage, oublierReglages, reglagesPublics, rendreAuDefaut,
  tousLesReglages,
} from '../src/server/reglages/index.js';
import { RULES as VIRAGE } from '../src/server/ferveur/virage.js';
import { RULES as DUEL } from '../src/server/nvn/engine.js';
import { DECK_RULES } from '../src/shared/duel/actions.js';
import { XP } from '../src/shared/niveau.js';
import { MAX_PACKS, PACK_PRICE, PACK_REGEN_MS, PACKS_DEPART } from '../src/server/fanzzy/index.js';
import { baseDeTest, OPTIONS_BASE } from './base-de-test.mjs';

const DB = baseDeTest();
let rates = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) rates++; };

const mysql = await import('mysql2/promise');
const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
await raw.query('SET FOREIGN_KEY_CHECKS = 0');
await raw.query(`DROP TABLE IF EXISTS parrainages, abonnements, achats, admin_journal, reglages, competitions,
  user_stuff, user_etats, user_skins, user_fanzzy, user_souvenirs, user_decks, virage_presence,
  user_wallet, users`);
await raw.query('SET FOREIGN_KEY_CHECKS = 1');
for (const f of ['auth.sql', 'admin.sql']) {
  await raw.query(await readFile(`sql/${f}`, 'utf8'));
}
await raw.end();

const pool = mysql.createPool({ uri: DB, connectionLimit: 4, ...OPTIONS_BASE });

/* ------------------------------------------------ le registre, hors base

   Ces contrôles-ci n'ont besoin de rien : ils éprouvent la déclaration
   elle-même. Ils passent en premier parce qu'un registre incohérent rendrait
   tout le reste illisible — on chercherait une panne de base là où c'est une
   ligne de déclaration qui se contredit. */

console.log('\n— le registre —');

check('chaque réglage appartient à une section déclarée',
  REGLAGES.every((r) => SECTIONS.some((s) => s.id === r.section))
  || (console.log('        orphelins :', REGLAGES.filter((r) =>
    !SECTIONS.some((s) => s.id === r.section)).map((r) => r.cle).join(', ')), false));

check('aucune clé n’est déclarée deux fois', PAR_CLE.size === REGLAGES.length);

/* Un défaut hors bornes se lirait comme un réglage valide jusqu'au jour où
   quelqu'un l'enregistre sans le changer — et se le verrait refuser. */
const defautsInvalides = REGLAGES.filter((r) => {
  try { valider(r.cle, r.defaut); return false; } catch { return true; }
});
check('chaque valeur par défaut passe sa propre validation',
  defautsInvalides.length === 0
  || (console.log('        fautives :', defautsInvalides.map((r) => r.cle).join(', ')), false));

check('les réglages chiffrés portent tous des bornes',
  REGLAGES.filter((r) => r.type === 'entier' || r.type === 'decimal')
    .every((r) => Number.isFinite(r.min) && Number.isFinite(r.max) && r.min < r.max));

check('les réglages chiffrés portent tous une unité',
  REGLAGES.filter((r) => r.type === 'entier' || r.type === 'decimal')
    .every((r) => typeof r.unite === 'string' && r.unite.length > 0));

/* ------------------------------------------------- le registre du quotidien

   Le chantier du quotidien pose toutes ses clés d'un coup, et les huit
   périmètres qui les lisent codent contre elles. Une clé absente ne casse
   rien : `reglage()` rend `undefined`, et un montant `undefined` devient
   `NaN`, que rien ne signale. D'où la table ci-dessous, recopiée du plan
   (`PLAN.md`, § 4) : nom, section, type, bornes et valeur de départ. Elle
   est écrite ici en toutes lettres exprès — c'est elle qui juge le registre,
   pas l'inverse. */

console.log('\n— le registre du quotidien —');

for (const id of ['quotidien', 'missions', 'saison']) {
  check(`la section « ${id} » existe`, SECTIONS.some((s) => s.id === id));
}

const PLAN = [
  ['bonus.actif', 'quotidien', 'booleen', null, null, true],
  ['bonus.base', 'quotidien', 'entier', 0, 200, 20],
  ['bonus.pas', 'quotidien', 'entier', 0, 50, 5],
  ['bonus.j7_packs', 'quotidien', 'entier', 0, 3, 1],
  ['missions.actif', 'quotidien', 'booleen', null, null, true],
  ['missions.relances', 'quotidien', 'entier', 0, 3, 1],
  ['missions.facile_echarpes', 'quotidien', 'entier', 0, 300, 30],
  ['missions.facile_xp', 'quotidien', 'entier', 0, 200, 20],
  ['missions.moyenne_echarpes', 'quotidien', 'entier', 0, 400, 60],
  ['missions.moyenne_xp', 'quotidien', 'entier', 0, 300, 40],
  ['missions.difficile_echarpes', 'quotidien', 'entier', 0, 600, 100],
  ['missions.difficile_xp', 'quotidien', 'entier', 0, 400, 60],
  ['missions.sachet_packs', 'quotidien', 'entier', 0, 3, 1],
  ['quotidien.retour_heures', 'quotidien', 'entier', 1, 48, 3],
  ['recompenses.plafond_echarpes_jour', 'quotidien', 'entier', 100, 20000, 2500],
  ['recompenses.plafond_packs_jour', 'quotidien', 'entier', 1, 50, 15],
  ['saison.carnet_actif', 'saison', 'booleen', null, null, true],
  ['saison.tampons_facile', 'saison', 'entier', 0, 10, 1],
  ['saison.tampons_moyenne', 'saison', 'entier', 0, 10, 1],
  ['saison.tampons_difficile', 'saison', 'entier', 0, 10, 2],
  ['saison.tampons_sachet', 'saison', 'entier', 0, 10, 1],
  ['saison.relais_packs', 'saison', 'entier', 0, 5, 2],
  ['saison.relais_seuil', 'saison', 'entier', 0, 1000, 10],
  ['collection.actif', 'saison', 'booleen', null, null, true],
  ['collection.cran', 'saison', 'entier', 5, 200, 25],
  ['collection.cran_echarpes', 'saison', 'entier', 0, 300, 25],
  ['collection.cran_booster_tous', 'saison', 'entier', 0, 20, 4],
  ['collection.serie_echarpes', 'saison', 'entier', 0, 1000, 100],
  ['collection.serie_packs', 'saison', 'entier', 0, 5, 1],
  ['rang.actif', 'saison', 'booleen', null, null, true],
  ['rang.habitue', 'saison', 'entier', 0, 100000000, 5000],
  ['rang.fervent', 'saison', 'entier', 0, 100000000, 30000],
  ['rang.ultra', 'saison', 'entier', 0, 100000000, 100000],
  ['rang.capo', 'saison', 'entier', 0, 100000000, 300000],
];
{
  const ecarts = [];
  for (const [cle, section, type, min, max, defaut] of PLAN) {
    const r = PAR_CLE.get(cle);
    if (!r) { ecarts.push(`${cle} absente`); continue; }
    if (r.section !== section) ecarts.push(`${cle} : section ${r.section}`);
    if (r.type !== type) ecarts.push(`${cle} : type ${r.type}`);
    if (r.defaut !== defaut) ecarts.push(`${cle} : défaut ${r.defaut}, le plan dit ${defaut}`);
    if (min !== null && (r.min !== min || r.max !== max)) {
      ecarts.push(`${cle} : bornes ${r.min}–${r.max}, le plan dit ${min}–${max}`);
    }
  }
  check(`les ${PLAN.length} clés du plan sont là, avec leur section, leurs bornes et leur valeur de départ`,
    ecarts.length === 0 || (console.log('        écarts :', ecarts.join(' · ')), false));
}

/* Les treize bascules de mission : une par identifiant du catalogue, la liste
   fermée du contrat (`CONTRATS.md`, § 6.1). Une mission sans bascule ne
   pourrait pas être sortie du tirage un samedi soir. */
{
  const MISSIONS = ['boosters', 'duel', 'virage', 'grandir', 'tribune', 'victoire', 'classes',
    'club_virage', 'club_duel', 'victoires', 'endurance', 'mitemps', 'ailleurs'];
  const bascules = REGLAGES.filter((r) => r.section === 'missions');
  check('treize bascules de mission, une par identifiant du catalogue',
    bascules.length === MISSIONS.length
      && MISSIONS.every((id) => PAR_CLE.get(`mission.${id}`)?.section === 'missions')
    || (console.log('        vues :', bascules.map((r) => r.cle).join(', ')), false));
  check('toutes en bascule, toutes allumées au départ',
    bascules.every((r) => r.type === 'booleen' && r.defaut === true));
  check('et chacune porte l’intitulé de sa mission, pas sa clé',
    bascules.every((r) => r.titre && !r.titre.includes('.') && r.titre.length > 8));
}

/* Un interrupteur par source de gain : c'est le disjoncteur qu'on actionne
   sans livraison. La liste des sources est celle du grand livre lui-même :
   une source qu'on lui ajouterait sans interrupteur ferait rougir ceci. */
{
  const { SOURCES } = await import('../src/server/recompenses.js');
  const INTERRUPTEURS = {
    bonus: 'bonus.actif', mission: 'missions.actif', sachet: 'missions.actif',
    carnet: 'saison.carnet_actif', relais: 'saison.carnet_actif',
    cran: 'collection.actif', serie: 'collection.actif', division: 'rang.actif',
    /* L'XP du Virage (vague 2) s'éteint par son montant : `xp.virage` à 0
       rend `inactif` (`CONTRATS.md`, § 15.2). Une bascule de plus dirait la
       même chose que ce zéro, et deux leviers pour une seule porte finissent
       par se contredire. */
    virage: 'xp.virage',
  };
  /* Un interrupteur est une bascule — ou un montant qui descend à 0 et dont
     l'aide dit qu'à 0 la source s'arrête : c'est ce que lira celui qui
     cherche le disjoncteur un samedi soir. */
  const sans = SOURCES.filter((s) => {
    const r = PAR_CLE.get(INTERRUPTEURS[s]);
    return !r || !(r.type === 'booleen'
      || (r.type === 'entier' && r.min === 0 && /à 0/i.test(r.aide ?? '')));
  });
  check(`chaque source du grand livre a son interrupteur (${SOURCES.length})`,
    sans.length === 0 || (console.log('        sans interrupteur :', sans.join(', ')), false));
}

/* Les types que l'écran sait dessiner. `admin.html` dessine un type inconnu en
   champ numérique : une liste y serait inéditable, d'où une bascule par
   mission plutôt qu'une liste à cocher. */
check('aucun réglage de type liste au registre',
  !REGLAGES.some((r) => r.type === 'liste')
  || (console.log('        listes :', REGLAGES.filter((r) => r.type === 'liste').map((r) => r.cle).join(', ')), false));

/* **Les divisions ne paient que l'honneur.** La ferveur classée n'a pas de
   plafond pour un abonné : une division qui verserait des écharpes ou des
   boosters s'achèterait en partie (`SERVEUR.md`, § 6). Un réglage qui
   permettrait de leur en rendre rouvrirait d'un geste ce que la règle
   ferme. */
check('aucune clé rang.* n’a d’unité en écharpes ou en boosters',
  !REGLAGES.some((r) => r.cle.startsWith('rang.') && /écharpe|echarpe|booster|pack/i.test(r.unite ?? ''))
  || (console.log('        fautives :', REGLAGES.filter((r) => r.cle.startsWith('rang.')
    && /écharpe|echarpe|booster|pack/i.test(r.unite ?? '')).map((r) => r.cle).join(', ')), false));

/* Les billets n'existent plus : l'étal se paie en écharpes. Une étiquette qui
   nomme une autre monnaie que celle qu'on débite fait lire un prix faux. */
check('aucune unité « billets » au registre',
  !REGLAGES.some((r) => /billet/i.test(r.unite ?? ''))
  || (console.log('        fautives :', REGLAGES.filter((r) => /billet/i.test(r.unite ?? ''))
    .map((r) => r.cle).join(', ')), false));

/* Ce que l'écran d'administration doit dire au moment de changer un montant :
   les missions sont copiées au tirage (le lendemain), le bonus se calcule à la
   réclamation (tout de suite), et une XP de duel à zéro sort des missions du
   tirage. Sans ces phrases, on change un montant à midi et l'on croit que
   rien ne s'est passé — ou l'inverse. */
check('les montants du bonus disent qu’ils valent tout de suite',
  ['bonus.base', 'bonus.pas', 'bonus.j7_packs'].every((c) => /tout de suite/.test(PAR_CLE.get(c)?.aide ?? '')));
check('les montants des missions disent qu’ils valent pour le lendemain',
  ['missions.facile_echarpes', 'missions.facile_xp', 'missions.moyenne_echarpes', 'missions.moyenne_xp',
    'missions.difficile_echarpes', 'missions.difficile_xp', 'missions.sachet_packs']
    .every((c) => /lendemain/.test(PAR_CLE.get(c)?.aide ?? '')));
check('une XP de duel à zéro dit qu’elle sort des missions du tirage',
  ['xp.duel_entrainement', 'xp.duel_classe'].every((c) => /tirage/.test(PAR_CLE.get(c)?.aide ?? '')));

/* ------------------------------------------------- le registre des arènes

   La vague 2 (lot 6) pose ses sept clés d'un coup, et trois périmètres
   codent contre elles : le bilan et l'XP du Virage, la tribune qui se vide,
   la présence. Même raison que pour le quotidien : une clé absente ne casse
   rien, elle rend `undefined`, et un `undefined` dans un plafond de matchs
   ou un délai d'« en ligne » ne se voit nulle part. La table vient du plan
   (`SERVEUR-VAGUE2.md`, § 4) et des décisions de Gaël du 3 octobre 2026. */

console.log('\n— le registre des arènes —');

check('la section « presence » existe, titrée LA PRÉSENCE',
  SECTIONS.some((s) => s.id === 'presence' && s.titre === 'LA PRÉSENCE'));

const PLAN_ARENES = [
  ['xp.virage', 'progression', 'entier', 0, 200, 15],
  ['xp.virage_chants', 'progression', 'entier', 1, 200, 10],
  ['xp.virage_matchs_jour', 'progression', 'entier', 1, 20, 3],
  ['virage.bilan_min', 'virage', 'entier', 1, 30, 5],
  ['presence.actif', 'presence', 'booleen', null, null, false],
  ['presence.visible_defaut', 'presence', 'booleen', null, null, true],
  ['presence.en_ligne_sec', 'presence', 'entier', 30, 900, 120],
];
{
  const ecarts = [];
  for (const [cle, section, type, min, max, defaut] of PLAN_ARENES) {
    const r = PAR_CLE.get(cle);
    if (!r) { ecarts.push(`${cle} absente`); continue; }
    if (r.section !== section) ecarts.push(`${cle} : section ${r.section}`);
    if (r.type !== type) ecarts.push(`${cle} : type ${r.type}`);
    if (r.defaut !== defaut) ecarts.push(`${cle} : défaut ${r.defaut}, le plan dit ${defaut}`);
    if (min !== null && (r.min !== min || r.max !== max)) {
      ecarts.push(`${cle} : bornes ${r.min}–${r.max}, le plan dit ${min}–${max}`);
    }
  }
  check(`les ${PLAN_ARENES.length} clés des arènes sont là, avec leur section, leurs bornes et leur valeur de départ`,
    ecarts.length === 0 || (console.log('        écarts :', ecarts.join(' · ')), false));
}

/* **Livrée éteinte.** C'est la décision (Q2) : la présence ne s'allume
   qu'après la mise en ligne de la nouvelle politique de confidentialité, et
   c'est le défaut du registre qui le garantit — une livraison qui la ferait
   partir allumée montrerait à des mineurs qui est en ligne, sans texte pour
   le dire. Un contrôle à lui, et non une ligne de la table : il doit rougir
   avec son propre nom. */
check('presence.actif existe, est une bascule, et part éteinte',
  PAR_CLE.get('presence.actif')?.type === 'booleen' && DEFAUTS['presence.actif'] === false
  || (console.log('        défaut :', DEFAUTS['presence.actif']), false));

/* Ce que l'écran d'administration doit dire au moment de toucher ces
   nombres (le plan, § 4). */
check('xp.virage dit « une fois par match » et ce qui se passe à 0',
  /une fois par match/i.test(PAR_CLE.get('xp.virage')?.aide ?? '')
    && /à 0/i.test(PAR_CLE.get('xp.virage')?.aide ?? ''));
check('xp.virage_matchs_jour dit qu’il est le même pour tous, abonnés compris',
  /abonnés compris/i.test(PAR_CLE.get('xp.virage_matchs_jour')?.aide ?? ''));
check('virage.bilan_min dit que la tribune se vide pour que le relevé cesse de la payer',
  /relevé du direct/i.test(PAR_CLE.get('virage.bilan_min')?.aide ?? ''));
check('presence.actif dit qu’éteint, aucun écran ne montre de présence',
  /aucun écran/i.test(PAR_CLE.get('presence.actif')?.aide ?? ''));
check('presence.visible_defaut dit qu’un joueur qui a choisi garde son choix',
  /garde son choix/i.test(PAR_CLE.get('presence.visible_defaut')?.aide ?? ''));

/* ------------------------------------------- le verdict : dessiné, pas réglé

   L'échelle unique du verdict (Q3, `src/shared/verdict.js`) ne se règle pas :
   un seuil de PARFAIT qu'on pourrait déplacer depuis /admin ferait varier le
   compte des PARFAITS d'un soir à l'autre, et le bilan comparerait des
   choses différentes. Le registre ne doit donc pas l'héberger — c'est le seul
   contrôle du verdict qui parle du registre, et il reste ici. L'échelle
   elle-même (ses bornes, la note mesurée, le contrat qui la recopie, le
   serveur qui la lit) est éprouvée sans base par `verdict-smoke`. */

console.log('\n— le verdict —');
check('aucun réglage ne porte le verdict, ses seuils, le Cri ou les paliers de ferveur',
  !REGLAGES.some((r) => /verdict|parfait|\bcri\b|palier/i.test(r.cle))
  || (console.log('        fautives :', REGLAGES.filter((r) => /verdict|parfait|\bcri\b|palier/i.test(r.cle))
    .map((r) => r.cle).join(', ')), false));

/* ------------------------------------------------------ la validation */

console.log('\n— la validation —');

let leve = null;
try { valider('pack.regen_min', 0); } catch (e) { leve = e; }
check('une valeur sous la borne est refusée', leve instanceof ReglageInvalide);
check('et le refus nomme la borne, pas « invalide »',
  /entre 1 et 1440/.test(leve?.raison ?? '')
  || (console.log('        raison :', leve?.raison), false));
check('le refus nomme aussi la clé', leve?.cle === 'pack.regen_min');

leve = null;
try { valider('pack.regen_min', 10.5); } catch (e) { leve = e; }
check('un entier attendu refuse une décimale', /entier/.test(leve?.raison ?? ''));

leve = null;
try { valider('inexistante.cle', 1); } catch (e) { leve = e; }
check('une clé hors registre est refusée', leve instanceof ReglageInvalide);

check('un texte trop long est refusé',
  (() => { try { valider('annonce.texte', 'x'.repeat(400)); return false; } catch { return true; } })());
check('mais un texte est rogné de ses espaces, pas refusé',
  valider('annonce.texte', '  bonjour  ') === 'bonjour');
check('une bascule refuse autre chose que vrai ou faux',
  (() => { try { valider('annonce.actif', 'oui'); return false; } catch { return true; } })());
check('un choix refuse une option qui n’existe pas',
  (() => { try { valider('annonce.ton', 'panique'); return false; } catch { return true; } })());

/* C'est le seul endroit où l'on corrige en silence, et pour une raison
   précise : refuser de démarrer parce qu'une main est passée dans la base
   serait une panne fabriquée par le garde-fou lui-même. */
check('une valeur stockée devenue illégale retombe sur le défaut',
  resoudre('pack.regen_min', 99999) === DEFAUTS['pack.regen_min']);
check('une clé absente vaut son défaut',
  resoudre('virage.but_a', undefined) === DEFAUTS['virage.but_a']);

/* ------------------------------------------ ce que le jeu lit vraiment

   Le cœur de la suite. Écrire dans la base ne prouve rien : ce qu'on veut
   savoir, c'est si le moteur du Virage, celui du duel, les règles de deck et
   le barème d'expérience **changent**. C'est précisément ce qui manquait, et
   ce qu'aucun contrôle ne disait. */

console.log('\n— ce que le jeu lit —');

await chargerReglages(pool);

check('sans rien en base, le jeu tourne sur les valeurs du registre',
  VIRAGE.goalAt === DEFAUTS['virage.but_a']
  && DUEL.goalAt === DEFAUTS['duel.but_a']
  && DECK_RULES.actions === DEFAUTS['deck.actions']
  && XP.pack === DEFAUTS['xp.pack']);

/* Les constantes exportées se déduisent du registre et ne sont plus écrites
   deux fois. Deux endroits qui portent la même valeur finissent toujours par
   diverger — ici le désaccord serait muet, le jeu tournant sur l'une pendant
   que l'administration afficherait l'autre. */
check('les constantes exportées se déduisent du même registre',
  MAX_PACKS === DEFAUTS['pack.max']
  && PACKS_DEPART === DEFAUTS['pack.depart']
  && PACK_PRICE === DEFAUTS['pack.prix_echarpes']
  && PACK_REGEN_MS === DEFAUTS['pack.regen_min'] * 60000);

await ecrireReglage(pool, 'virage.but_a', 777, null);
check('écrire le seuil du Virage change ce que le moteur lit (777)',
  VIRAGE.goalAt === 777 || (console.log('        lu :', VIRAGE.goalAt), false));

await ecrireReglage(pool, 'duel.duree_min', 9, null);
check('la durée d’un duel arrive en millisecondes au moteur',
  DUEL.dureeMs === 9 * 60000 || (console.log('        lu :', DUEL.dureeMs), false));

await ecrireReglage(pool, 'virage.inactif_sec', 30, null);
check('le délai d’inactivité aussi', VIRAGE.idleMs === 30000);

await ecrireReglage(pool, 'deck.actions', 6, null);
check('la taille du deck change pour tout le jeu', DECK_RULES.actions === 6);

await ecrireReglage(pool, 'xp.duel_classe', 44, null);
check('le barème d’expérience change', XP.duel.classe === 44);

check('et les réglages non touchés ne bougent pas',
  DECK_RULES.fanzzy === DEFAUTS['deck.fanzzy'] && XP.pack === DEFAUTS['xp.pack']);

/* ------------------------------------------------- le retour au défaut */

console.log('\n— le retour au défaut —');

await rendreAuDefaut(pool, 'virage.but_a', null);
check('rendre au défaut remet la valeur du registre',
  VIRAGE.goalAt === DEFAUTS['virage.but_a']);

const [lignes] = await pool.query('SELECT cle FROM reglages WHERE cle = ?', ['virage.but_a']);
/* En supprimant la ligne, et non en y écrivant le défaut. Les deux se
   ressemblent aujourd'hui ; ils diffèrent le jour où le défaut change au
   registre — une ligne écrite figerait l'ancienne valeur pour toujours, et il
   faudrait se souvenir d'aller la retirer. */
check('et elle efface la ligne au lieu d’y écrire le défaut', lignes.length === 0);

let refus = null;
try { await ecrireReglage(pool, 'virage.but_a', 5, null); } catch (e) { refus = e; }
check('une écriture hors bornes ne touche pas la base', refus instanceof ReglageInvalide);
const [apres] = await pool.query('SELECT cle FROM reglages WHERE cle = ?', ['virage.but_a']);
check('rien n’a été écrit', apres.length === 0);
check('et le moteur n’a pas bougé', VIRAGE.goalAt === DEFAUTS['virage.but_a']);

/* ------------------------------------------------- la base qui divergerait */

console.log('\n— la base et le cache —');

/* Une écriture faite dans le dos du cache : c'est ce qui arriverait si
   quelqu'un touchait la table à la main, ou si une seconde instance écrivait.
   Le cache ne peut pas le deviner, mais il doit le rattraper au rechargement —
   sinon les deux serveurs d'un même site joueraient des règles différentes. */
await pool.query(
  `INSERT INTO reglages (cle, valeur) VALUES ('duel.but_a', '1111')
   ON DUPLICATE KEY UPDATE valeur = VALUES(valeur)`);
check('une écriture directe en base ne change rien tant qu’on n’a pas relu',
  DUEL.goalAt !== 1111);
await chargerReglages(pool);
check('et le rechargement la prend', DUEL.goalAt === 1111);

/* Une valeur **illisible** ne peut pas exister : la colonne est `JSON NOT
   NULL` et la base la refuse elle-même — vérifié ici, parce que c'est sur
   cette garantie qu'on s'appuie pour ne pas mettre de filet dans le code. */
let refuseParLaBase = false;
try {
  await pool.query(`UPDATE reglages SET valeur = 'pas du json' WHERE cle = 'duel.but_a'`);
} catch { refuseParLaBase = true; }
check('la base refuse elle-même une valeur qui n’est pas du JSON', refuseParLaBase);

/* Le pilote analyse lui-même les colonnes JSON : un texte revient déjà
   analysé. Analyser une seconde fois casserait tout réglage textuel — c est ce
   qui est arrivé au premier d entre eux, pendant que les réglages chiffrés
   passaient sans rien dire. L aller-retour le prouve. */
/* L'aller-retour est enveloppé : analysé deux fois, le chargement **lève**, et
   la suite mourrait là en emportant tout ce qui suit. Un contrôle qui tue la
   suite est une détection, mais il ne dit pas ce qui est cassé — il faut
   remonter une pile d'appels pour le savoir. Enveloppé, il le nomme. */
let allerRetour = null;
try {
  await ecrireReglage(pool, 'maintenance.texte', 'Retour à 21 h.', null);
  await chargerReglages(pool);
  allerRetour = tousLesReglages()['maintenance.texte'];
} catch (e) {
  console.log('        le chargement a levé :', e.message);
}
check('un réglage textuel fait l’aller-retour sans être analysé deux fois',
  allerRetour === 'Retour à 21 h.'
  || (console.log('        lu :', JSON.stringify(allerRetour)), false));

await pool.query('DELETE FROM reglages WHERE cle = ?', ['maintenance.texte']);
await chargerReglages(pool);

/* Le cas qui, lui, arrive vraiment : une valeur parfaitement lisible mais hors
   bornes, parce que le registre a changé depuis qu'elle a été écrite. */
await pool.query(`UPDATE reglages SET valeur = '99999' WHERE cle = 'duel.but_a'`);
await chargerReglages(pool);
check('une valeur devenue hors bornes retombe sur le défaut sans rien casser',
  DUEL.goalAt === DEFAUTS['duel.but_a']
  || (console.log('        lu :', DUEL.goalAt), false));

await pool.query('DELETE FROM reglages');
await chargerReglages(pool);

/* -------------------------------------------------- la route publique */

console.log('\n— la route publique —');

/* La route monte `reglagesPublics()` sans rien y ajouter — exactement comme
   server.js. C'est cette fonction-là qu'on éprouve, et non une copie. */
const app = express();
app.get('/api/public/reglages', (_req, res) => res.json(reglagesPublics()));
const http = createServer(app);
await new Promise((r) => http.listen(0, r));
const base = `http://127.0.0.1:${http.address().port}`;
const lire = async () => (await fetch(base + '/api/public/reglages')).json();

check('sans annonce active, la route ne rend rien à afficher',
  (await lire()).annonce === null);

await ecrireReglage(pool, 'annonce.texte', 'Le Virage ouvre à 20 h.', null);
check('un texte sans la bascule ne s’affiche pas',
  (await lire()).annonce === null);

await ecrireReglage(pool, 'annonce.actif', true, null);
const d = await lire();
check('bascule et texte ensemble, l’annonce sort',
  d.annonce?.texte === 'Le Virage ouvre à 20 h.');
check('avec son ton', d.annonce?.ton === DEFAUTS['annonce.ton']);

/* L'équilibrage n'est pas public. Le publier revient à publier le mode
   d'emploi de ce qu'il faut exploiter : le seuil exact d'un but, le coût d'un
   chant, la seconde où l'on sort de la foule. */
const brut = JSON.stringify(d);
check('la route ne publie pas l’équilibrage du jeu',
  !/virage\.|duel\.|deck\.|xp\.|pack\./.test(brut)
  || (console.log('        rendu :', brut), false));
/* Ni l'économie du quotidien : les montants, les seuils de division et le
   disjoncteur sont le mode d'emploi de ce qu'il faudrait exploiter. */
check('ni les montants du quotidien, ni le disjoncteur',
  !/bonus\.|missions?\.|quotidien\.|saison\.|collection\.|rang\.|recompenses\./.test(brut)
  || (console.log('        rendu :', brut), false));
/* Ni la présence : allumée ou non, elle se lit par `/api/presence`, session
   requise (`CONTRATS.md`, § 18.2) — jamais sur une route publique. */
check('ni les réglages de la présence',
  !/presence\./.test(brut) || (console.log('        rendu :', brut), false));

await ecrireReglage(pool, 'maintenance.actif', true, null);
check('la fermeture s’annonce, avec son message',
  (await lire()).maintenance?.texte === DEFAUTS['maintenance.texte']);

/* ------------------------------------------------------------------ fin */

await new Promise((r) => http.close(r));
oublierReglages();
await pool.end();

console.log(rates ? `\n${rates} test(s) en échec` : '\ntout est vert');
/* **Pas de `process.exit`.** Il coupe la boucle d'événements pendant que le
   pool rend ses sockets, et libuv s'arrête au hasard sur `UV_HANDLE_CLOSING` —
   sous Windows, un code de sortie 3221226505 juste après un « tout est vert »
   parfaitement vert.

   La suite passait donc, et le lanceur la comptait en échec : il juge sur le
   code de sortie, et il a raison — une suite qui plante avant son premier
   contrôle n'écrit rien, et la juger sur son texte la déclarerait verte.

   `exitCode` dit la même chose et laisse Node finir ce qu'il a commencé. Le
   reste du dépôt le fait déjà ; celle-ci avait été oubliée. */
process.exitCode = rates ? 1 : 0;
