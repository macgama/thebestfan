/**
 * Le constat d'écart entre le code et la base.
 *
 * ## Ce que cette suite éprouve
 *
 * Le catalogue s'amorce en `INSERT IGNORE` : la base peut diverger du code
 * sans que rien ne le signale. Quatre migrations de `sql/` n'existent que pour
 * rattraper ça après coup. Le constat est maintenant calculé à chaque
 * démarrage — encore faut-il qu'il dise vrai, et surtout qu'il **se taise
 * quand tout va bien**. Un constat qui crie sur une base saine est lu deux
 * fois puis plus jamais, et on perd du même coup les trois fautes qu'il sait
 * attraper.
 *
 * `comparer` est pure — deux listes entrent, un constat sort — donc tout se
 * joue ici sans base de données, sur des cas fabriqués où l'on sait d'avance
 * ce qu'il faut trouver. C'est aussi ce qui permet de vérifier le piège des
 * clés JSON, qui ne se voit sur aucune relecture : MySQL ne rend pas un objet
 * dans l'ordre où on l'a écrit, et une comparaison naïve annoncerait le
 * catalogue entier comme retouché.
 */
import { comparer, resumer, depuisLigne } from '../src/server/fanzzy/ecarts.js';
import { DEX } from '../src/shared/fanzzy/dex.js';

let rates = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) rates++; };

/** Une carte du code, réduite à ce que la comparaison regarde. */
const carte = (id, sur = {}) => ({
  id, nom: `Le ${id}`, set: 'TR', stage: 1, rar: 'commune', evo: null,
  histoire: 'Une histoire.', mods: { pushBonus: 3 }, cri: { txt: 'ALLEZ', gest: 'tempo' },
  ...sur,
});

/* ------------------------------------------------ une base conforme se tait */

{
  const code = [carte('TR1'), carte('TR2'), carte('TR3')];
  // La base rend la même chose, mais passée par MySQL : clés JSON dans un
  // autre ordre, `histoire` absente écrite NULL, `publie` en 0/1.
  const base = [
    depuisLigne({ id: 'TR1', nom: 'Le TR1', set_id: 'TR', stage: 1, rar: 'commune',
      evo: null, histoire: 'Une histoire.', mods: '{"pushBonus":3}',
      cri: '{"gest":"tempo","txt":"ALLEZ"}', publie: 1 }),
    depuisLigne({ id: 'TR2', nom: 'Le TR2', set_id: 'TR', stage: 1, rar: 'commune',
      evo: null, histoire: 'Une histoire.', mods: { pushBonus: 3 },
      cri: { gest: 'tempo', txt: 'ALLEZ' }, publie: 1 }),
    depuisLigne({ id: 'TR3', nom: 'Le TR3', set_id: 'TR', stage: 1, rar: 'commune',
      evo: null, histoire: 'Une histoire.', mods: { pushBonus: 3 },
      cri: { txt: 'ALLEZ', gest: 'tempo' }, publie: 1 }),
  ];
  const r = comparer({ code, base });
  check('une base conforme ne produit aucun écart',
    !r.faute && !r.manquantes.length && !r.orphelines.length && !r.doublons.length);
  check('l’ordre des clés JSON n’est pas une retouche', r.retouchees.length === 0);
  check('et le démarrage ne dit rien du tout', resumer(r).length === 0);
}

/* ------------------------------------------------------- les trois fautes */

{
  // Une carte ajoutée au code que l'amorçage n'a pas encore posée.
  const r = comparer({ code: [carte('TR1'), carte('TR2')], base: [depuisLigne(
    { id: 'TR1', nom: 'Le TR1', set_id: 'TR', stage: 1, rar: 'commune', evo: null,
      histoire: 'Une histoire.', mods: { pushBonus: 3 },
      cri: { txt: 'ALLEZ', gest: 'tempo' }, publie: 1 })] });
  check('une carte du code absente de la base est vue',
    r.faute && r.manquantes.length === 1 && r.manquantes[0] === 'TR2');
  check('et le démarrage la nomme',
    resumer(r).some((l) => l.includes('TR2') && /amorçage/.test(l)));
}

{
  // Le reste d'un renommage : la ligne d'avant est restée, publiée.
  const code = [carte('TR32')];
  const base = [
    depuisLigne({ id: 'TR32', nom: 'Le TR32', set_id: 'TR', stage: 1, rar: 'commune',
      evo: null, histoire: 'Une histoire.', mods: { pushBonus: 3 },
      cri: { txt: 'ALLEZ', gest: 'tempo' }, publie: 1 }),
    depuisLigne({ id: 'V1', nom: 'Choriste', set_id: 'TR', stage: 1, rar: 'commune',
      evo: null, histoire: null, mods: {}, cri: {}, publie: 1 }),
  ];
  const r = comparer({ code, base });
  check('une ligne publiée inconnue du code est une faute',
    r.faute && r.orphelines.length === 1 && r.orphelines[0].id === 'V1');
  check('et le démarrage dit quoi en faire',
    resumer(r).some((l) => l.includes('V1') && l.includes('prefixes.sql')));
}

{
  // La même, mais dépubliée : c'est la manœuvre correcte, on ne crie pas.
  const code = [carte('TR32')];
  const base = [
    depuisLigne({ id: 'TR32', nom: 'Le TR32', set_id: 'TR', stage: 1, rar: 'commune',
      evo: null, histoire: 'Une histoire.', mods: { pushBonus: 3 },
      cri: { txt: 'ALLEZ', gest: 'tempo' }, publie: 1 }),
    depuisLigne({ id: 'V1', nom: 'Choriste', set_id: 'TR', stage: 1, rar: 'commune',
      evo: null, histoire: null, mods: {}, cri: {}, publie: 0 }),
  ];
  const r = comparer({ code, base });
  check('une ligne dépubliée inconnue du code n’est pas une faute',
    !r.faute && r.orphelines.length === 1 && r.orphelines[0].publie === false);
}

{
  // Deux cartes publiées sous le même nom : le joueur le voit deux fois.
  const base = [
    depuisLigne({ id: 'TR32', nom: 'Le Petit Teigneux', set_id: 'TR', stage: 1,
      rar: 'commune', evo: null, histoire: null, mods: {}, cri: {}, publie: 1 }),
    depuisLigne({ id: 'V1', nom: 'le petit teigneux ', set_id: 'TR', stage: 1,
      rar: 'commune', evo: null, histoire: null, mods: {}, cri: {}, publie: 1 }),
  ];
  const code = [carte('TR32', { nom: 'Le Petit Teigneux', histoire: null, mods: {}, cri: {} }),
    carte('V1', { nom: 'le petit teigneux ', histoire: null, mods: {}, cri: {} })];
  const r = comparer({ code, base });
  check('le même nom sur deux cartes publiées est vu, casse et espaces compris',
    r.faute && r.doublons.length === 1 && r.doublons[0].ids.length === 2);
}

/* ------------------------------------------ la retouche, qui n'est pas une faute */

{
  const code = [carte('TR1', { nom: 'Le Tambour Fêlé', rar: 'legendaire' })];
  const base = [depuisLigne({ id: 'TR1', nom: 'Le Tambour', set_id: 'TR', stage: 1,
    rar: 'commune', evo: null, histoire: 'Une histoire.', mods: { pushBonus: 3 },
    cri: { txt: 'ALLEZ', gest: 'tempo' }, publie: 1 })];
  const r = comparer({ code, base });
  check('un champ qui diffère est relevé, avec son nom',
    r.retouchees.length === 1
    && r.retouchees[0].champs.includes('nom') && r.retouchees[0].champs.includes('rar'));
  check('mais ce n’est pas une faute : l’administration a le droit de corriger',
    r.faute === false);
  check('le démarrage compte sans lister, et nomme la commande',
    resumer(r).some((l) => l.includes('1 carte(s)') && l.includes('npm run ecarts')));
}

/* ------------------------------------------------------------ les compteurs */

{
  /* Le compteur du classeur se compte en **personnages** — les racines de
     lignée — et sur les seules séries ouvertes. C'est le chiffre après la
     barre oblique, celui par lequel la divergence s'est vue la première fois. */
  const code = [
    carte('TR1', { evo: 'TR1B' }), carte('TR1B', { stage: 2 }),
    carte('MS1', { set: 'MS' }),
  ];
  const base = code.map((f) => depuisLigne({ ...f, set_id: f.set, publie: 1 }));
  const tout = comparer({ code, base });
  check('deux personnages pour trois lignes, la lignée n’en fait qu’un',
    tout.compteurs.personnages === 2 && tout.compteurs.aCollectionner === 2);

  const ouvert = comparer({ code, base, ouvertes: new Set(['TR']) });
  check('une série fermée sort du « à collectionner »',
    ouvert.compteurs.aCollectionner === 1 && ouvert.compteurs.attendu === 1);
}

/* ------------------------------------- le vrai catalogue contre lui-même

   Le contrôle qui vaut pour toutes les bases neuves : une base amorcée depuis
   `dex.js` et jamais retouchée doit être **muette**. Si ce cas-là parlait, le
   démarrage crierait chez tout le monde dès la première installation, et le
   constat serait mort-né. */
{
  const base = DEX.map((f) => depuisLigne({
    id: f.id, nom: f.nom, set_id: f.set, stage: f.stage, rar: f.rar,
    evo: f.evo ?? null, histoire: f.histoire ?? null,
    mods: JSON.stringify(f.mods ?? {}), cri: JSON.stringify(f.cri ?? {}),
    publie: f.publie === false ? 0 : 1,
  }));
  const r = comparer({ code: DEX, base });
  const lignes = resumer(r);
  check(`les ${DEX.length} cartes du catalogue réel, amorcées telles quelles, ne disent rien`,
    lignes.length === 0 || (console.log('       ', lignes.join('\n        ')), false));
}

console.log(rates ? `\n${rates} échec(s)` : '\ntout est vert');
process.exit(rates ? 1 : 0);
