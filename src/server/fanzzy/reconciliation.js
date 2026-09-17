/**
 * La réconciliation : faire redescendre le code dans la base, sans écraser
 * personne.
 *
 * ## Deux auteurs, une donnée
 *
 * Le catalogue s'écrit de deux côtés. Depuis `dex.js`, qui est versionné, relu
 * en diff et éprouvé par les suites ; et depuis l'écran d'administration, qui
 * corrige une carte en ligne sans attendre un déploiement. Les deux sont
 * légitimes, et c'est ce qui rend le problème réel : `INSERT IGNORE` protégeait
 * le second en sacrifiant le premier — une carte réécrite dans le code
 * n'arrivait jamais en base, sans erreur et sans trace.
 *
 * On ne peut pas trancher en regardant les deux valeurs. « Le nom du code
 * diffère du nom en base » ne dit pas **qui** a bougé, et c'est toute la
 * question. Il en faut une troisième : ce que le code disait la dernière fois
 * qu'il a écrit cette carte — la colonne `amorce`, posée par `sql/fanzzy.sql`.
 *
 * Alors chaque champ se décide seul, sans supposition :
 *
 *   code == base                 → rien à faire. On aligne l'amorce si elle a
 *                                  pris du retard : les trois disent la même
 *                                  chose, aucune donnée ne bouge.
 *   code != base == amorce       → personne n'y a touché à l'écran depuis
 *                                  l'amorçage : **le code fait foi**, on
 *                                  reprend.
 *   code != base != amorce       → quelqu'un l'a corrigée à l'écran. On n'y
 *                                  touche pas, et on le **dit** : c'est un
 *                                  conflit, pas un détail.
 *
 * C'est la fusion à trois points d'un `git merge`, pour la même raison.
 *
 * ## Ce module ne touche pas à la base
 *
 * Il rend un **plan** : ce qu'il faudrait écrire, et pourquoi. `catalogue.js`
 * l'exécute. C'est ce qui permet d'éprouver la règle — celle qui décide de
 * réécrire des données de production — sur des cas fabriqués, sans base, et
 * de la relire d'un seul tenant.
 */

/** Les champs que le code gère. Les mêmes que ceux que le constat sait voir. */
export const CHAMPS = ['nom', 'set', 'stage', 'rar', 'evo', 'histoire', 'mods', 'cri', 'publie'];

/**
 * Au-delà de tant de cartes à reprendre d'un coup, on ne touche à rien.
 *
 * Un disjoncteur, pas un réglage. Une réconciliation qui réécrit soixante
 * cartes est une fournée de contenu ; une qui en réécrit six cents est un
 * accident — un `dex.js` à moitié chargé, une base amorcée par erreur depuis
 * une autre branche — et il vaut mille fois mieux s'arrêter en le disant que
 * de le faire proprement. Le nombre se relève par `TBF_RECONCILIATION_MAX` le
 * jour où une vraie fournée le dépasse.
 */
export const MAX_DEFAUT = 60;

/** L'écriture stable d'une valeur : voir `ecarts.js`, même piège, même remède. */
function stable(v) {
  if (v === null || v === undefined) return 'null';
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (typeof v === 'object') {
    return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`;
  }
  return JSON.stringify(v);
}
const pareil = (a, b) => stable(a ?? null) === stable(b ?? null);

/** La forme d'une carte que l'on garde en référence : les champs gérés, rien d'autre. */
export const instantane = (f) => Object.fromEntries(
  CHAMPS.map((c) => [c, c === 'publie' ? f.publie !== false : (f[c] ?? null)]));

/**
 * Le plan de réconciliation.
 *
 * @param {object}  e
 * @param {Array}   e.code   le catalogue de `dex.js`, forme du jeu
 * @param {Array}   e.base   les lignes de la base : forme du jeu, plus
 *                           `amorce` (l'instantané, ou `null`) et
 *                           `toucheeAdmin` (le journal garde-t-il une trace
 *                           d'une modification de cette carte à l'écran ?)
 * @param {number} [e.max]   le disjoncteur
 */
export function fusionner({ code = [], base = [], max = MAX_DEFAUT } = {}) {
  const parId = new Map(base.map((f) => [f.id, f]));

  const reprises = [];      // la base prend la valeur du code
  const conflits = [];      // le code veut autre chose, l'écran a tranché avant
  const adoptions = [];     // une ligne d'avant le mécanisme, prise en charge
  const protegees = [];     // une ligne d'avant, corrigée à l'écran : intouchable
  const alignements = [];   // l'amorce rattrape son retard, sans toucher aux données
  const ecrire = [];        // ce qu'il faudra écrire, carte par carte

  for (const f of code) {
    const b = parId.get(f.id);
    if (!b) continue;                       // `amorcer` s'en occupe, pas nous

    /* Une ligne sans référence est une ligne d'avant ce mécanisme. On ne peut
       pas deviner ce que le code disait quand elle a été posée — mais le
       journal de l'administration, lui, sait si quelqu'un l'a corrigée. S'il
       n'en garde aucune trace, la ligne est celle de l'amorçage : on l'adopte
       telle quelle, et la règle normale s'applique dans la foulée. Sinon elle
       reste intouchable, et c'est le bon défaut — la seule erreur qui coûte
       cher ici est d'écraser une correction faite à la main. */
    let amorce = b.amorce ?? null;
    let adoptee = false;
    if (!amorce) {
      if (b.toucheeAdmin) { protegees.push(b.id); continue; }
      amorce = instantane(b);
      adoptee = true;
      adoptions.push(b.id);
    }

    const champsRepris = [];
    const champsEnConflit = [];
    const champsAlignes = [];

    for (const c of CHAMPS) {
      const duCode = c === 'publie' ? f.publie !== false : (f[c] ?? null);
      const enBase = c === 'publie' ? b.publie !== false : (b[c] ?? null);
      const deReference = amorce[c] ?? null;

      if (pareil(duCode, enBase)) {
        if (!pareil(deReference, duCode)) champsAlignes.push(c);
        continue;
      }
      if (pareil(enBase, deReference)) {
        champsRepris.push({ champ: c, de: enBase, vers: duCode });
      } else {
        champsEnConflit.push({ champ: c, code: duCode, base: enBase });
      }
    }

    if (champsRepris.length) reprises.push({ id: f.id, nom: b.nom, champs: champsRepris });
    if (champsEnConflit.length) conflits.push({ id: f.id, nom: b.nom, champs: champsEnConflit });
    if (champsAlignes.length && !champsRepris.length) {
      alignements.push({ id: f.id, champs: champsAlignes });
    }

    /* Ce qu'il faudra écrire pour cette carte.
       
       **L'amorce ne suit que ce qui a été repris ou ce sur quoi tout le monde
       est déjà d'accord.** Un champ en conflit garde sa référence d'avant, et
       c'est l'invariant qui fait tenir le reste : la référence dit ce que le
       code a **réellement posé** dans cette ligne, jamais ce qu'il aurait voulu
       y poser. Une référence qui annoncerait une valeur que la base n'a jamais
       portée rendrait la décision suivante illisible — on ne saurait plus si
       l'écart vient de l'écran ou d'une reprise qui n'a pas eu lieu. */
    const neuve = { ...amorce };
    for (const { champ, vers } of champsRepris) neuve[champ] = vers;
    for (const c of champsAlignes) neuve[c] = c === 'publie' ? f.publie !== false : (f[c] ?? null);

    // Le plan d'écriture porte les deux : les valeurs à poser, et la référence
    // qui va avec. Une adoption seule n'a aucune valeur à écrire — juste sa
    // référence — et c'est bien une écriture quand même.
    if (champsRepris.length || champsAlignes.length || adoptee) {
      ecrire.push({
        id: f.id,
        valeurs: Object.fromEntries(champsRepris.map(({ champ, vers }) => [champ, vers])),
        amorce: neuve,
      });
    }
  }

  return {
    reprises,
    conflits,
    adoptions,
    protegees,
    alignements,
    ecrire,
    /* Le disjoncteur se déclenche sur le nombre de **cartes** dont on
       réécrirait les données — pas sur les adoptions ni les alignements, qui
       ne touchent qu'à la référence et ne peuvent rien perdre. */
    bloque: reprises.length > max ? { cartes: reprises.length, max } : null,
  };
}

/**
 * Le constat, pour le journal de démarrage. Tableau vide quand il n'y a rien à
 * dire — le silence reste le cas normal.
 */
export function resumerFusion(plan) {
  const l = [];
  if (plan.bloque) {
    l.push(`catalogue : ${plan.bloque.cartes} cartes seraient reprises du code,`
      + ` au-delà des ${plan.bloque.max} admises — rien n’a été écrit.`
      + ' Une fournée de contenu ne fait pas ça : regarde `npm run ecarts`, puis'
      + ' relève TBF_RECONCILIATION_MAX si c’est bien voulu.');
    return l;
  }
  if (plan.adoptions.length) {
    l.push(`catalogue : ${plan.adoptions.length} carte(s) d’avant la réconciliation`
      + ' prises en charge — le journal ne garde aucune trace de modification à'
      + ' l’écran les concernant.');
  }
  if (plan.reprises.length) {
    const apercu = plan.reprises.slice(0, 6)
      .map((r) => `${r.id} (${r.champs.map((c) => c.champ).join('+')})`).join(' ');
    l.push(`catalogue : ${plan.reprises.length} carte(s) reprise(s) du code`
      + ` — ${apercu}${plan.reprises.length > 6 ? ' …' : ''}`);
  }
  if (plan.conflits.length) {
    const apercu = plan.conflits.slice(0, 6)
      .map((c) => `${c.id} (${c.champs.map((x) => x.champ).join('+')})`).join(' ');
    l.push(`catalogue : ${plan.conflits.length} carte(s) que le code voulait changer`
      + ` et qui ont été corrigées à l’écran — ${apercu}${plan.conflits.length > 6 ? ' …' : ''}`
      + ' — la base garde sa version. `npm run ecarts` dit laquelle est laquelle.');
  }
  if (plan.protegees.length) {
    l.push(`catalogue : ${plan.protegees.length} carte(s) d’avant la réconciliation`
      + ' portent une modification faite à l’écran : elles restent hors de sa portée.');
  }
  return l;
}
