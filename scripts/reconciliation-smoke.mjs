/**
 * La réconciliation : qui gagne, et sur quoi.
 *
 * ## Pourquoi cette suite est la plus importante du lot
 *
 * C'est la seule règle du projet qui **réécrit des données de production sans
 * que personne regarde**. Elle a le droit de changer le nom d'une carte que
 * cinq cents joueurs ont dans leur classeur. La question n'est donc pas
 * seulement « reprend-elle bien le code ? » mais surtout « **s'abstient-elle
 * quand il le faut ?** » — et c'est ce que la moitié des contrôles ci-dessous
 * vérifient.
 *
 * Le cœur tient en trois lignes, et chacune a son contrôle :
 *
 *   code == base            → rien à écrire.
 *   code != base == amorce  → personne n'y a touché à l'écran : le code gagne.
 *   code != base != amorce  → l'écran a tranché avant : la base garde, on le dit.
 *
 * `fusionner` est pure — deux listes entrent, un plan sort — donc tout se joue
 * ici sans base de données.
 */
import { fusionner, resumerFusion, instantane, MAX_DEFAUT }
  from '../src/server/fanzzy/reconciliation.js';
import { DEX } from '../src/shared/fanzzy/dex.js';

let rates = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) rates++; };

/** Une carte, côté code. */
const carte = (id, sur = {}) => ({
  id, nom: `Le ${id}`, set: 'TR', stage: 1, rar: 'commune', evo: null,
  histoire: 'Une histoire.', mods: { pushBonus: 3 }, cri: { txt: 'ALLEZ', gest: 'tempo' },
  ...sur,
});
/** La même, côté base, avec sa référence d'amorçage et son passé à l'écran. */
const ligne = (f, { amorce = instantane(f), toucheeAdmin = false } = {}) =>
  ({ ...f, publie: f.publie !== false, amorce, toucheeAdmin });

/* ------------------------------------------------------ les trois lignes */

{
  const code = [carte('TR1')];
  const base = [ligne(carte('TR1'))];
  const p = fusionner({ code, base });
  check('code et base d’accord : rien n’est écrit',
    !p.reprises.length && !p.conflits.length && !p.ecrire.length);
  check('et le démarrage se tait', resumerFusion(p).length === 0);
}

{
  // Le code a changé, la base est restée telle que l'amorçage l'avait posée.
  const avant = carte('TR1');
  const code = [carte('TR1', { nom: 'Le Tambour Fêlé', histoire: 'Réécrite.' })];
  const p = fusionner({ code, base: [ligne(avant)] });
  check('une carte jamais touchée à l’écran prend la valeur du code',
    p.reprises.length === 1
    && p.reprises[0].champs.map((c) => c.champ).sort().join() === 'histoire,nom');
  check('l’écriture porte les valeurs et la référence',
    p.ecrire[0].valeurs.nom === 'Le Tambour Fêlé'
    && p.ecrire[0].amorce.nom === 'Le Tambour Fêlé'
    && p.ecrire[0].amorce.histoire === 'Réécrite.');
  check('et le démarrage le dit', resumerFusion(p).some((l) => l.includes('TR1')));
}

{
  /* Le cas qui compte : la carte a été corrigée à l'écran — sa valeur ne
     ressemble plus à la référence — et le code veut autre chose. On ne touche
     à rien, et on le dit. */
  const code = [carte('TR1', { nom: 'Le nom du code' })];
  const base = [ligne(carte('TR1', { nom: 'Le nom corrigé à l’écran' }),
    { amorce: instantane(carte('TR1')) })];
  const p = fusionner({ code, base });
  check('une correction faite à l’écran n’est jamais écrasée',
    !p.reprises.length && !p.ecrire.length
    && p.conflits.length === 1 && p.conflits[0].champs[0].champ === 'nom');
  check('le conflit est annoncé, pas avalé',
    resumerFusion(p).some((l) => l.includes('corrigées à l’écran')));
}

{
  /* L'invariant qui fait tenir le reste : la référence dit ce que le code a
     **réellement posé** dans la ligne, jamais ce qu'il aurait voulu y poser.
     Un champ repris la fait avancer ; un champ en conflit la laisse où elle
     est. Sans ça, elle annoncerait une valeur que la base n'a jamais portée,
     et la décision du démarrage suivant deviendrait illisible : impossible de
     dire si l'écart vient de l'écran ou d'une reprise qui n'a pas eu lieu. */
  const code = [carte('TR1', { nom: 'Le nom du code', rar: 'rare' })];
  const base = [ligne(carte('TR1', { nom: 'Corrigé à l’écran' }),
    { amorce: instantane(carte('TR1')) })];
  const p1 = fusionner({ code, base });
  const apres = { ...base[0], rar: 'rare', amorce: p1.ecrire[0].amorce };
  const p2 = fusionner({ code, base: [apres] });
  check('la reprise d’un champ ne débloque pas le conflit d’un autre',
    p1.reprises[0].champs.map((c) => c.champ).join() === 'rar'
    && p2.conflits.length === 1 && p2.conflits[0].champs[0].champ === 'nom'
    && !p2.reprises.length);
  check('la référence avance sur le champ repris et pas sur celui en conflit',
    p1.ecrire[0].amorce.rar === 'rare' && p1.ecrire[0].amorce.nom === 'Le TR1');
}

/* --------------------------------- les lignes d'avant, sans référence */

{
  const code = [carte('TR1', { nom: 'Le nom du code' })];
  const base = [ligne(carte('TR1'), { amorce: null, toucheeAdmin: false })];
  const p = fusionner({ code, base });
  check('une ligne sans référence, jamais modifiée à l’écran, est adoptée',
    p.adoptions.length === 1 && p.reprises.length === 1);
  check('et son adoption est annoncée',
    resumerFusion(p).some((l) => l.includes('prises en charge')));
}

{
  const code = [carte('TR1', { nom: 'Le nom du code' })];
  const base = [ligne(carte('TR1'), { amorce: null, toucheeAdmin: true })];
  const p = fusionner({ code, base });
  check('une ligne sans référence, modifiée à l’écran, reste intouchable',
    !p.adoptions.length && !p.reprises.length && !p.ecrire.length
    && p.protegees.length === 1);
}

/* ------------------------------------------------------ les abstentions */

{
  // Une carte créée depuis l'administration n'est pas dans le code : rien à en
  // dire, et surtout rien à lui faire.
  const p = fusionner({ code: [carte('TR1')], base: [ligne(carte('MAISON1'))] });
  check('une carte que le code ne connaît pas n’est jamais touchée',
    !p.ecrire.length && !p.reprises.length && !p.conflits.length);
}

{
  // Une carte du code absente de la base est l'affaire d'`amorcer`, pas d'ici.
  const p = fusionner({ code: [carte('TR1'), carte('TR2')], base: [ligne(carte('TR1'))] });
  check('une carte absente de la base n’est pas inventée ici', !p.ecrire.length);
}

{
  /* Le disjoncteur. Une fournée de contenu réécrit dix cartes ; six cents, ce
     n'est plus une fournée, c'est un accident — et il vaut mille fois mieux
     s'arrêter en le disant. */
  const code = Array.from({ length: 12 }, (_, i) => carte(`TR${i}`, { nom: 'neuf' }));
  const base = code.map((f) => ligne(carte(f.id)));
  const p = fusionner({ code, base, max: 5 });
  check('au-delà du plafond, rien n’est écrit',
    p.bloque?.cartes === 12 && p.ecrire.length === 12 && p.bloque.max === 5);
  check('et le démarrage dit pourquoi et comment passer outre',
    resumerFusion(p).some((l) => l.includes('rien n’a été écrit')
      && l.includes('TBF_RECONCILIATION_MAX')));
  check('le plafond par défaut laisse passer une fournée normale',
    !fusionner({ code, base }).bloque && MAX_DEFAUT >= 12);
}

/* ------------------------------------------- l'alignement, sans écriture */

{
  /* Le code et la base disent déjà la même chose, mais la référence a pris du
     retard — une reprise SQL passée à la main, par exemple. On la remet à
     niveau : aucune donnée ne bouge, et le champ redevient géré par le code au
     lieu de rester faussement en conflit pour toujours. */
  const code = [carte('TR1', { rar: 'rare' })];
  const base = [ligne(carte('TR1', { rar: 'rare' }), { amorce: instantane(carte('TR1')) })];
  const p = fusionner({ code, base });
  check('une référence en retard se remet à niveau sans toucher aux données',
    !p.reprises.length && !p.conflits.length
    && p.alignements.length === 1 && Object.keys(p.ecrire[0].valeurs).length === 0
    && p.ecrire[0].amorce.rar === 'rare');
}

/* ------------------------------ le vrai catalogue, deux fois de suite */

{
  /* Une base amorcée depuis `dex.js` ne doit rien déclencher — sinon chaque
     démarrage réécrirait six cent soixante-dix lignes pour rien. Et le second
     passage doit être aussi silencieux que le premier : une réconciliation qui
     ne converge pas est une écriture en boucle sur la table la plus lue du jeu. */
  const base = DEX.map((f) => ligne(f));
  const p1 = fusionner({ code: DEX, base });
  check(`les ${DEX.length} cartes réelles, amorcées telles quelles : rien à faire`,
    p1.ecrire.length === 0 && resumerFusion(p1).length === 0);

  // Puis le code change deux cartes, on applique, et on recommence.
  const code2 = DEX.map((f, i) => (i < 2 ? { ...f, nom: `${f.nom} (revu)` } : f));
  const p2 = fusionner({ code: code2, base });
  const apres = base.map((b) => {
    const e = p2.ecrire.find((x) => x.id === b.id);
    return e ? { ...b, ...e.valeurs, amorce: e.amorce } : b;
  });
  const p3 = fusionner({ code: code2, base: apres });
  check('deux cartes reprises, puis plus rien : la réconciliation converge',
    p2.reprises.length === 2 && p3.ecrire.length === 0);
}

console.log(rates ? `\n${rates} échec(s)` : '\ntout est vert');
process.exit(rates ? 1 : 0);
