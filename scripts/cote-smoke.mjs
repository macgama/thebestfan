/**
 * La cote des duellistes : la formule, et les trois choix qui l'entourent.
 *
 * ## Pourquoi une suite à part, sans base
 *
 * La formule d'Elo est arithmétique pure. L'éprouver à travers un duel joué
 * demanderait une base, un serveur, deux sockets et une minute — pour vérifier
 * qu'une division rend le bon nombre. Ici, c'est instantané, et chaque contrôle
 * nomme la propriété qu'il défend plutôt qu'un cas particulier.
 *
 * Ce qui demande un vrai duel — que les colonnes soient écrites, que
 * l'entraînement ne cote pas — est éprouvé dans `nvn:net`, où un duel se joue
 * vraiment de bout en bout.
 *
 * Usage : node scripts/cote-smoke.mjs
 */
import { apres, attendu, moyenne, coefficient, COTE_DEPART, COTE_PLANCHER,
  K_NORMAL, K_DEBUT, PARTIES_DEBUT } from '../src/shared/cote.js';

let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };
const proche = (a, b, tol = 0.005) => Math.abs(a - b) <= tol;

console.log('\nL’attente');

check('à cotes égales, on attend un demi', proche(attendu(1000, 1000), 0.5));
/* Les deux valeurs de référence d'Elo. Si la courbe change, c'est ici qu'on le
   voit, et non trois mois plus tard dans un classement qui paraît bizarre. */
check('avec 200 points d’avance, on attend 0,76', proche(attendu(1200, 1000), 0.76, 0.01));
check('avec 400 points d’avance, on attend 0,91', proche(attendu(1400, 1000), 0.909, 0.01));
check('et l’attente est symétrique',
  proche(attendu(1200, 1000) + attendu(1000, 1200), 1));

console.log('\nCe que la partie change');

{
  const gagne = apres(1000, 1000, 'win', 50);
  const perd = apres(1000, 1000, 'loss', 50);
  check(`à cotes égales, une victoire rapporte la moitié de K (+${gagne - 1000})`,
    gagne - 1000 === K_NORMAL / 2);
  check('et une défaite coûte autant', 1000 - perd === K_NORMAL / 2);
  check('un nul ne change rien', apres(1000, 1000, 'draw', 50) === 1000);
}

/* **C'est toute la raison d'avoir une cote** : battre plus fort doit rapporter
   plus que battre plus faible. Un classement qui ne fait pas ça compte des
   victoires avec des chiffres en plus. */
{
  const contreFort = apres(1000, 1400, 'win', 50) - 1000;
  const contreFaible = apres(1000, 600, 'win', 50) - 1000;
  check(`battre plus fort rapporte plus (+${contreFort} contre +${contreFaible})`,
    contreFort > contreFaible);
  const perdContreFaible = 1400 - apres(1400, 1000, 'loss', 50);
  const perdContreFort = 1000 - apres(1000, 1400, 'loss', 50);
  check(`perdre contre plus faible coûte plus (−${perdContreFaible} contre −${perdContreFort})`,
    perdContreFaible > perdContreFort);
}

/* Un classement qui se laisse gonfler par le volume redeviendrait celui qu'on
   vient de remplacer. Deux joueurs de même niveau qui s'affrontent en boucle ne
   doivent aller nulle part. */
{
  let a = 1000; let b = 1000;
  for (let i = 0; i < 50; i++) {
    const issue = i % 2 ? 'win' : 'loss';
    const na = apres(a, b, issue, 50);
    const nb = apres(b, a, issue === 'win' ? 'loss' : 'win', 50);
    a = na; b = nb;
  }
  /* **Une partie d'écart, pas zéro.** Le contrôle exigeait deux points, et il
     avait tort : la série se termine sur une victoire, et le dernier vainqueur
     garde logiquement son avance. Ce qu'on veut vérifier est qu'elles ne
     **s'accumulent** pas — cinquante parties alternées doivent laisser l'écart
     d'une seule, pas de cinquante. */
  check(`cinquante parties alternées ne s'accumulent pas (${a} / ${b})`,
    Math.abs(a - 1000) <= K_NORMAL && Math.abs(b - 1000) <= K_NORMAL
    && Math.abs((a - 1000) + (b - 1000)) <= 1);
}

console.log('\nLes débuts');

check(`les dix premières parties bougent deux fois plus (${K_DEBUT} contre ${K_NORMAL})`,
  coefficient(0) === K_DEBUT && coefficient(PARTIES_DEBUT - 1) === K_DEBUT);
check('et après, la cote se stabilise', coefficient(PARTIES_DEBUT) === K_NORMAL);
/* Un nouveau venu doit rejoindre son niveau réel en une soirée, pas en trois
   mois. Le contrôle mesure exactement ça : dix victoires de suite contre plus
   fort doivent l'emmener loin. */
{
  let c = COTE_DEPART;
  for (let i = 0; i < 10; i++) c = apres(c, 1400, 'win', i);
  check(`dix victoires contre plus fort emmènent un débutant à ${c}`, c >= 1250);
}

console.log('\nLe plancher');

{
  /* **Elo se limite tout seul, et le contrôle l'a appris à mes dépens.** Cent
     défaites contre 1600 ne descendent qu'à 931 : plus l'écart se creuse, moins
     une défaite coûte, et la cote s'arrête d'elle-même bien au-dessus du
     plancher. Le contrôle exigeait le plancher et rougissait sur un code juste.

     C'est une bonne nouvelle : le plancher ne sert qu'aux cas extrêmes, et la
     formule protège déjà des mauvaises semaines. */
  let c = COTE_DEPART;
  for (let i = 0; i < 100; i++) c = apres(c, 1600, 'loss', 50);
  check(`cent défaites contre bien plus fort s'arrêtent d'elles-mêmes (${c})`,
    c > COTE_PLANCHER && c < COTE_DEPART);

  /* Le plancher, lui, se vérifie là où il agit : quand on y est déjà. */
  check('et arrivé au plancher, on n’en descend plus',
    apres(COTE_PLANCHER, COTE_PLANCHER + 400, 'loss', 50) === COTE_PLANCHER);
  /* Sans quoi il serait un piège plutôt qu'un filet. */
  check('mais on en remonte',
    apres(COTE_PLANCHER, COTE_PLANCHER, 'win', 50) > COTE_PLANCHER);
}

console.log('\nLa moyenne d’un camp');

check('deux cotes font leur moyenne', moyenne([1000, 1400]) === 1200);
check('une seule se rend elle-même', moyenne([1234]) === 1234);
/* Un camp vide arrive quand on joue contre des machines, et ça ne cote pas —
   mais un `NaN` se propagerait jusqu'en base et personne ne le verrait avant de
   lire un classement vide.

   L'absence compte double : `Number(null)` vaut **zéro**, et zéro est fini. Ce
   contrôle a trouvé le défaut — le filtre écartait `NaN` et gardait les nuls,
   qui tiraient la moyenne vers le bas sans que rien ne paraisse anormal. */
check('un camp vide rend la cote de départ', moyenne([]) === COTE_DEPART);
check('et ce qui n’est pas un nombre est ignoré',
  moyenne([1000, null, undefined, 1400]) === 1200);

console.log('\nLa cote ne donne aucune puissance');

/* Ce contrôle ne mesure pas un calcul : il mesure une **règle du jeu**, écrite
   dans `shared/niveau.js` — « le niveau ne donne aucune puissance ; s'il en
   avait, l'ancienneté deviendrait de la force ». La cote classe, elle
   n'avantage pas.

   Le module ne doit donc exporter que de quoi calculer et comparer. Le jour où
   quelqu'un y ajoutera un `bonusDeCote`, c'est ici que ça rougira. */
{
  const m = await import('../src/shared/cote.js');
  const attendus = ['COTE_DEPART', 'COTE_PLANCHER', 'K_NORMAL', 'K_DEBUT',
    'PARTIES_DEBUT', 'coefficient', 'attendu', 'apres', 'moyenne'];
  const enTrop = Object.keys(m).filter((k) => !attendus.includes(k));
  check('le module ne sait que calculer une cote, rien en faire',
    enTrop.length === 0
    || (console.log('        en trop :', enTrop.join(', ')), false));
}

console.log(`\n${failures ? `${failures} échec(s)` : 'tout est vert'}`);
process.exitCode = failures ? 1 : 0;
