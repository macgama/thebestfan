/**
 * Les invites de dessin disent la vérité de la carte.
 *
 * ## Pourquoi cette suite existe
 *
 * Une invite n'est jamais « cassée » : elle sort toujours un texte, et le
 * générateur dessine toujours quelque chose. Ce qu'elle peut faire, c'est
 * **mentir sur la carte** — et on ne s'en aperçoit qu'en regardant cent trente
 * images, une par une, trop tard.
 *
 * Les quatre mensonges déjà commis, tous corrigés depuis, et tous invisibles
 * sans contrôle :
 *
 * 1. **Cinquante cartes, un seul homme.** La ligne de série décrivait le
 *    costume — parka, sweat, bonnet — et rien d'autre. Sur les sept premiers
 *    rendus de LA TRIBUNE, quatre étaient le même quadragénaire en parka verte
 *    et deux étaient indiscernables l'un de l'autre.
 * 2. **Une femme à la barbe grise**, et **un homme de trente ans à la barbe
 *    grise**. Trois tirages indépendants ne savent pas que la pilosité dépend
 *    de qui on dessine, ni que sa couleur dépend de l'âge.
 * 3. **« Celui Qui Reste » dessiné au féminin.** Le nom dit « Celui »,
 *    l'histoire dit « Il est encore assis », et le tirage disait « une femme de
 *    dix-neuf ans ». Puis « Le Râleur du Rang B » au féminin aussi, parce que
 *    son « il » est en minuscule au milieu d'une phrase.
 * 4. **La ligne de famille par-dessus la carte.** « Les Mains Gelées » applaudit
 *    pour se réchauffer les doigts et la Percussion lui mettait un tambour ;
 *    « L'Homme dans la Mascotte » a la tête sous le bras et la série lui mettait
 *    une parka.
 *
 * Chacun de ces contrôles correspond à un rendu qu'il a fallu jeter et refaire.
 *
 * Usage : node scripts/invites-smoke.mjs
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { DEX } from '../src/shared/fanzzy/dex.js';

let rouge = 0;
const check = (quoi, vrai) => {
  console.log(`  ${vrai ? 'ok  ' : 'ÉCHEC'}  ${quoi}`);
  if (!vrai) rouge++;
};
const titre = (t) => console.log(`\n${t}`);

/** Les invites d'une série, telles que le script les écrit vraiment. */
function invitesDe(set) {
  const brut = execFileSync(process.execPath,
    ['scripts/fanzzy-invites.mjs', '--json', '--set', set],
    { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  return JSON.parse(brut);
}

/** La ligne « Who to draw », si la carte en a une. */
const corpsDe = (x) =>
  (x.invite.match(/follow the French text: (a [^\n]*?)\. Their outer/) ?? [])[1] ?? null;

const tr = invitesDe('TR');

titre('Chaque carte a son propre corps');
{
  const corps = tr.map(corpsDe).filter(Boolean);
  const uniques = new Set(corps);
  check(`les ${tr.length} cartes de LA TRIBUNE décrivent ${uniques.size} corps distincts`,
    uniques.size === corps.length);
  /* Le tirage part de l'identifiant : relancer le script doit redonner
     exactement les mêmes corps, sinon régénérer une carte en fait une autre. */
  const encore = invitesDe('TR').map(corpsDe).filter(Boolean);
  check('et relancer le script redonne les mêmes',
    encore.join('|') === corps.join('|'));
}

titre('La pilosité suit qui la porte');
{
  const POILS = /beard|moustache|stubble/;
  const femmesPoilues = tr.filter((x) => {
    const c = corpsDe(x);
    return c && c.startsWith('a woman') && POILS.test(c);
  });
  check('aucune femme ne porte de barbe ni de moustache',
    femmesPoilues.length === 0
    || (console.log('        ', femmesPoilues.map((x) => x.id).join(' ')), false));

  const JEUNE = /teens|twenties|thirties|forties/;
  const grisPrecoce = tr.filter((x) => {
    const c = corpsDe(x);
    return c && JEUNE.test(c) && /(grey|white) (beard|moustache|stubble)/.test(c);
  });
  check('et personne ne grisonne avant la cinquantaine',
    grisPrecoce.length === 0
    || (console.log('        ', grisPrecoce.map((x) => x.id).join(' ')), false));
}

titre('Le genre vient du français de la carte');
{
  /* Trois cartes qui l'ont chacune prise en défaut. */
  const attendu = [
    ['TR39', 'a man', 'son nom dit « Celui »'],
    ['TR52', 'a man', 'son histoire dit « et il a repris »'],
    ['TR36', 'a woman', 'son histoire dit « Elle tient son carton »'],
  ];
  for (const [id, genre, pourquoi] of attendu) {
    const c = corpsDe(tr.find((x) => x.id === id));
    check(`${id} est ${genre === 'a man' ? 'un homme' : 'une femme'} — ${pourquoi}`,
      Boolean(c?.startsWith(genre))
      || (console.log('        ', c ?? '(pas de ligne)'), false));
  }
  /* Quand la carte dit les deux, on ne tranche pas : « L'Écharpe Trop Longue »
     dit « Elle balaie deux rangées et il s'excuse », et le « elle » est
     l'écharpe. */
  const c68 = corpsDe(tr.find((x) => x.id === 'TR68'));
  check('TR68 ne reçoit aucun genre — son « elle » est l’écharpe',
    Boolean(c68?.startsWith('a supporter'))
    || (console.log('        ', c68 ?? '(pas de ligne)'), false));
}

titre('Le texte de la carte passe devant les lignes de série');
{
  const echantillon = tr[0];
  check('la garde-robe cède devant le français de la carte',
    /Kind and wardrobe, unless the French text above describes different clothes/
      .test(echantillon.invite));
  check('la pose aussi',
    /Pose and props, unless the French text above describes a different gesture/
      .test(echantillon.invite));
  /* La ligne de corps est la seule qui vienne d'un tirage : elle doit céder la
     première, et elle doit être écrite **après** l'histoire pour que « unless
     the French text above » désigne quelque chose. */
  const iHistoire = echantillon.invite.indexOf('Who they are');
  const iCorps = echantillon.invite.indexOf('Who to draw');
  check('et le corps tiré au sort est écrit après l’histoire, pas avant',
    iHistoire >= 0 && iCorps > iHistoire);
}

titre('Ce qui n’a pas de corps humain n’en reçoit pas');
{
  /* Une merguez avec une carrure et un teint, c'est un homme qui tient une
     merguez : le défaut qui a fait naître la phrase en capitales. */
  const gc = invitesDe('GC');
  const humanises = gc.filter(corpsDe);
  check(`les ${gc.length} cartes de nourriture n’ont pas de ligne de corps`,
    humanises.length === 0
    || (console.log('        ', humanises.map((x) => x.id).join(' ')), false));
}

titre('La garde de VISUELS.md est reprise mot pour mot');
{
  /* Ce n'est pas une préférence de style : c'est une règle de droits, et une
     paraphrase finit toujours par en perdre un morceau. */
  /* On compare les **mots**, pas les retours à la ligne : le document et
     l'invite ne les coupent pas au même endroit, et la règle est la liste des
     termes, pas sa mise en page. */
  const nu = (t) => t.replace(/\s+/g, ' ').trim();
  const doc = nu(readFileSync(new URL('../VISUELS.md', import.meta.url), 'utf8'));
  const garde = nu('no text, no letters, no numbers, no logos, no brand marks, '
    + 'no club crests, no team names, no sponsor logos, no identifiable jerseys, '
    + 'no real people');
  check('VISUELS.md contient bien la formule', doc.includes(garde));
  const sansGarde = tr.filter((x) => !nu(x.invite).includes(garde));
  check(`et les ${tr.length} invites la portent toutes`,
    sansGarde.length === 0
    || (console.log('        ', sansGarde.map((x) => x.id).join(' ')), false));
}

titre('Les endroits où le générateur écrit des mots malgré l’interdit');
{
  /* Une banderole est l'endroit exact où un modèle écrit une phrase : « Le Drap
     de Bain » est sorti avec un slogan inventé en travers du tissu, malgré la
     garde générale. L'interdit doit être là où l'envie naît. */
  const tifos = tr.filter((x) => DEX.find((f) => f.id === x.id)?.type === 'tifo');
  const muets = tifos.filter((x) => /no writing, no letters and no numbers/.test(x.invite));
  check(`les ${tifos.length} cartes Tifo interdisent l’écriture sur le tissu lui-même`,
    tifos.length > 0 && muets.length === tifos.length);

  /* Et « lit by a warm orange glow from below » a donné du feu au sol autour des
     bottes, que le détourage emporte avec le personnage. */
  const pyros = tr.filter((x) => DEX.find((f) => f.id === x.id)?.type === 'pyro');
  const enMain = pyros.filter((x) => /no fire around the feet/.test(x.invite));
  check(`les ${pyros.length} cartes Pyro gardent la flamme en main, pas au sol`,
    pyros.length > 0 && enMain.length === pyros.length);
}

console.log(rouge ? `\n${rouge} test(s) en échec` : '\ntout est vert');
process.exit(rouge ? 1 : 0);
