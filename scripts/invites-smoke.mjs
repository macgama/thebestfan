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
  /* Sur **tout le catalogue** et non sur la seule TRIBUNE : le jour où la table
     des âges a été rétrécie pour laisser aux lignées la place de vieillir, deux
     cartes des MÉTIERS DU STADE se sont mises à décrire le même homme — et ce
     contrôle, qui ne regardait qu'une série, les a laissées passer. Un
     garde-fou qui ne couvre qu'une série ne couvre pas le catalogue. */
  const tout = ['TR', 'MS', 'BG', 'RV', 'OB', 'EP', 'VP', 'GC', 'GD', 'MT', 'HC', 'IM']
    .flatMap((s) => invitesDe(s));
  const partout = tout.map(corpsDe).filter(Boolean);
  const doubles = partout.filter((c, i) => partout.indexOf(c) !== i);
  check(`les ${partout.length} corps décrits par le catalogue sont tous distincts`,
    doubles.length === 0
    || (console.log('        ', [...new Set(doubles)].join('\n         ')), false));

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

/* ================================================ les âges traversent une vie

   Un Fanzzy vieillit : l'enfant devient adulte, l'adulte devient vieux. C'est
   ce qui rend l'évolution désirable, et c'est la règle après un aller-retour —
   une version l'a figé pour ne faire monter que le domaine, et les deux dessins
   qui en sont sortis ont montré qu'un gamin avec plus d'écussons n'est pas une
   évolution.

   Le cinquième mensonge est donc ailleurs, et il est resté : **vieillir
   quelqu'un et le remplacer sont deux choses différentes**, et un générateur ne
   fait pas la différence tout seul. Les deux âges de TR1 générés sous
   l'ancienne invite portent trois défauts d'un coup : un tambour sur un
   personnage Voix, des écussons de club, et le mot « CAPO » en travers d'une
   pastille — la formule de `VISUELS.md` ne vivait que dans l'invite des
   premiers âges. */

const ages = (set) => JSON.parse(execFileSync(process.execPath,
  ['scripts/fanzzy-invites.mjs', '--json', '--ages', '--set', set],
  { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }));

titre('Les âges vieillissent, et restent la même personne');
{
  const lot = [...ages('TR'), ...ages('MS')];
  check(`${lot.length} invite(s) d’âge à éprouver`, lot.length > 0);

  check('toutes demandent un pas d’âge net',
    lot.every((x) => /Make them clearly older|Make them much older/.test(x.invite)));

  /* Deux âges qui demandent le même pas donnent deux fois le même dessin, et le
     joueur paie deux fois pour la même carte. */
  const deux = lot.filter((x) => x.stade === 2);
  const trois = lot.filter((x) => x.stade === 3);
  check('le deuxième et le troisième âge ne demandent pas le même pas',
    deux.every((x) => /clearly older/.test(x.invite))
    && trois.every((x) => /much older/.test(x.invite))
    && deux.length > 0 && trois.length > 0);

  /* La ligne qui sépare « il a grandi » de « ce n'est plus lui ». Un générateur
     à qui l'on demande « le même, plus vieux » dessine un visage moyen de l'âge
     demandé : on lui interdit l'ossature, et on ne lui laisse que ce que les
     années font vraiment. */
  check('toutes exigent la même personne, ossature nommée',
    lot.every((x) => /recognisably the SAME PERSON/.test(x.invite)
      && /Same bone structure/.test(x.invite)));
  check('et toutes gardent le cadrage de la référence',
    lot.every((x) => /same framing/.test(x.invite)));

  /* Un objet, une bête ou un phénomène n'a pas d'âge : `dex-ages.js` écrit
     qu'il monte en intensité, et lui demander des cheveux gris n'a aucun sens. */
  const choses = ages('BG');
  check(`les ${choses.length} âges du bestiaire montent en intensité au lieu de vieillir`,
    choses.length > 0 && choses.every((x) => /It does not age/.test(x.invite)
      && !/grey or white hair/.test(x.invite)));

  /* La référence est toujours le premier âge : deux éditions en cascade
     perdent le visage qu'on vient de protéger. */
  const racines = new Set(DEX.filter((f) => f.stage === 1).map((f) => f.id));
  check('toutes partent du premier âge, jamais de l’âge précédent',
    [...lot, ...choses].every((x) => racines.has(x.reference)));
}

titre('Une lignée a la place de vieillir deux fois');
{
  /* Le tirage de corps ne savait pas qu'une carte avec un `evo` sera dessinée
     trois fois, chaque fois plus vieille. Il donnait « in their sixties » au
     premier âge de soixante-cinq lignées sur cent trente-sept, et les deux âges
     suivants n'avaient plus nulle part où aller. */
  /* « in **his** forties » — `corps()` accorde le possessif au genre, et un
     contrôle qui ne cherche que « their » ne trouve jamais rien. Il passait
     donc au vert sans rien éprouver, ce qui est pire que pas de contrôle. */
  const vieux = /in (their|his|her) (forties|fifties|sixties|seventies)/;
  const lot = [...invitesDe('TR'), ...invitesDe('MS'), ...invitesDe('VP')];
  const aSuite = lot.filter((x) => DEX.find((f) => f.id === x.id)?.evo);
  const tropVieux = aSuite.filter((x) => vieux.test(corpsDe(x) ?? ''));
  check(`les ${aSuite.length} premiers âges qui ont une suite commencent jeunes`,
    aSuite.length > 0 && tropVieux.length === 0
    || (console.log('        ', tropVieux.map((x) => x.id).join(' ')), false));

  /* Et une carte sans lignée garde tout le tableau : Le Vieux Marin a le droit
     d'être vieux dès le premier jour, il n'ira nulle part. On le mesure sur tout
     le catalogue — LA TRIBUNE n'a plus une seule carte publiée sans suite, et
     une preuve cherchée là où le cas n'existe pas ne prouve rien. */
  /* Et quand la carte donne l'âge, le tirage se tait : ni âge tiré, ni barbe, et
     le mot suit le nombre. « a man, trois jours de barbe » sur « Douze ans » ne
     donne pas un enfant, ça donne un compromis — un adolescent qui se rase. */
  const nomme = ['TR1', 'TR2', 'MS30'].map((id) => lot.find((x) => x.id === id)).filter(Boolean);
  check(`les ${nomme.length} cartes qui écrivent leur âge sont dessinées en enfants`,
    nomme.length === 3
    && nomme.every((x) => /^a (boy|girl|child),/.test(corpsDe(x) ?? ''))
    && nomme.every((x) => !/stubble|beard|moustache/.test(corpsDe(x) ?? '')));

  const ailleurs = ['TR', 'MS', 'BG', 'RV', 'OB', 'EP', 'VP', 'GC', 'GD', 'MT', 'HC', 'IM']
    .flatMap((s) => invitesDe(s))
    .filter((x) => !DEX.find((f) => f.id === x.id)?.evo);
  check(`une carte sans suite garde le tableau complet (${ailleurs.length} cartes concernées)`,
    ailleurs.some((x) => vieux.test(corpsDe(x) ?? '')));
}

titre('Un âge reste dans sa famille');
{
  const lot = [...ages('TR'), ...ages('MS')];
  /* Le troisième âge de TR1 est arrivé avec un tambour sanglé sur le ventre
     alors que la carte est une Voix. Le dessin annonçait une famille que la
     carte ne joue pas — et c'est le geste, pas le dessin, qui décide de ce
     qu'on peut faire en duel. */
  const voix = lot.filter((x) => x.type === 'voix');
  check(`les ${voix.length} âges de la Voix interdisent le tambour`,
    voix.length > 0 && voix.every((x) => /no drum, no drumsticks/.test(x.invite)));
  const perc = lot.filter((x) => x.type === 'perc');
  check(`les ${perc.length} âges de la Percussion interdisent le porte-voix`,
    perc.length > 0 && perc.every((x) => /no megaphone/.test(x.invite)));
  /* La Fidélité ne tient rien : sa montée est une tenue, pas un objet, et les
     deux lignes n'ont donc pas la même forme. Une seule règle les couvre : une
     invite d'âge dit **soit** ce que le personnage tient, **soit** comment il se
     tient — jamais les deux, jamais ni l'une ni l'autre. */
  const tient = lot.filter((x) => /• what they hold/.test(x.invite));
  const seTient = lot.filter((x) => /• how they stand/.test(x.invite));
  check(`${tient.length} âges disent ce qu’ils tiennent, ${seTient.length} comment ils se tiennent, aucun les deux`,
    tient.length + seTient.length === lot.length
    && !lot.some((x) => /• what they hold/.test(x.invite) && /• how they stand/.test(x.invite)));
  check('un objet qui monte remplace celui du premier âge au lieu de s’y ajouter',
    tient.every((x) => /replace it, do not add a second one/.test(x.invite)));
  check('et une tenue qui monte garde ce que le personnage avait dans les mains',
    seTient.every((x) => /keep whatever they are holding in the reference image/.test(x.invite)));

  /* Et la ligne de famille cède devant le français de la carte, comme au
     premier âge. Sans ça, Le Collectionneur — une Fidélité qui tient un album —
     se retrouve les bras croisés et les mains vides au deuxième âge, alors que
     toute sa lignée parle de ses cartes. */
  check('l’objet de famille cède devant le texte de la carte',
    tient.every((x) => /UNLESS the French text above names an object of their own/
      .test(x.invite)));

  /* Et le français est écrit **avant** les consignes, comme au premier âge : un
     modèle suit l'instruction concrète qu'il vient de lire, pas celle qui
     viendra. Dans l'autre ordre, une Fidélité dont la lignée parle de cartes
     revient bras croisés et mains vides. */
  check('et il est écrit avant elles, pas après',
    lot.every((x) => x.invite.indexOf("What they have become") > 0
      && x.invite.indexOf("What they have become") < x.invite.indexOf("What else changes")));
}

titre('La règle de droits couvre les deux bouts de la chaîne');
{
  const lot = [...ages('TR'), ...ages('BG'), ...ages('RV')];
  /* Les mots, pas les retours à la ligne — le document et l'invite ne les
     coupent pas au même endroit, exactement comme pour les premiers âges. */
  const nu = (t) => t.replace(/\s+/g, ' ').trim();
  const garde = nu('no text, no letters, no numbers, no logos, no brand marks, '
    + 'no club crests, no team names, no sponsor logos, no identifiable jerseys, '
    + 'no real people');
  const sansGarde = lot.filter((x) => !nu(x.invite).includes(garde));
  check(`les ${lot.length} invites d’âge portent la formule de VISUELS.md`,
    sansGarde.length === 0
    || (console.log('        ', sansGarde.map((x) => x.id).join(' ')), false));
  /* Les pastilles cousues sont l'endroit exact où le générateur écrit : les
     deux âges de TR1 en sont revenus couverts de mots. L'interdit doit être là
     où naît l'envie. */
  /* Et l'interdit posé **sur les objets qui appellent l'écriture**. La formule
     générale de `VISUELS.md` n'a pas suffi une seule fois sur cinq images —
     « CAPO », « TICKET », « EVENT », « PRESS », « COLLECTION 2019 », toujours
     sur un objet fait pour porter des mots. Il vaut pour les premiers âges
     comme pour les suivants : c'est là que le générateur écrit. */
  const partout = [...lot, ...invitesDe('TR'), ...invitesDe('GC')];
  check(`les ${partout.length} invites disent qu’un livre, un badge ou un billet est vierge`,
    /* Les mots, pas les retours à la ligne : la clause est écrite en gabarit et
       coupe ses lignes où elle veut. Un contrôle qui cherche la phrase telle
       qu'on l'a tapée échoue à la première reformulation de la mise en page. */
    partout.every((x) => {
      const nu = x.invite.replace(/\s+/g, ' ');
      return /nothing in the image is written on/i.test(nu)
        /* Et l'objet reste l'objet : la première version disait « leave it
           bare » et le générateur a rendu un livre nu, sans cartes — un
           collectionneur qui ne collectionne plus rien. On interdit les mots,
           pas les images. */
        && /Keep every object exactly as recognisable as it should be/.test(nu)
        /* Vingt-six cartes racontent une écriture — une banderole peinte, une
           pancarte, des torses où « les lettres s'alignent ». Elles ont besoin
           d'une issue, sinon le générateur écrit : l'objet se montre roulé,
           plié ou de dos, et le moment se lit sur le personnage. */
        && /show that object rolled up, folded, turned away/.test(nu);
    }));

  /* Et le français de la carte ne lève jamais une règle de droits. « La
     Banderole Écrite » disait, à la lettre, que le texte gagne sur tout ce qui
     suit — donc sur l'interdiction d'écrire. */
  check('le texte de la carte ne peut pas lever une ligne CRITICAL',
    partout.every((x) => /EXCEPT the ones marked CRITICAL, which always win/
      .test(x.invite.replace(/\s+/g, ' '))));
}

console.log(rouge ? `\n${rouge} test(s) en échec` : '\ntout est vert');
process.exit(rouge ? 1 : 0);
