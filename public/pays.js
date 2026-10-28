/* =======================================================================
   Le nom des pays, dans la langue du lecteur.

   API-Football écrit les pays en anglais, et seulement en anglais :
   « Germany », « Czech-Republic », « South-Korea ». Une page française qui
   range ses matchs sous « Germany » n'est pas traduite à moitié, elle est
   écrite à moitié.

   **On ne tient pas de liste.** Deux cents pays dans quatre langues, ce sont
   huit cents chaînes à écrire une fois et à ne plus jamais relire : la
   première faute y resterait des années. Le navigateur a déjà cette table —
   c'est `Intl.DisplayNames` — et il lui faut un **code ISO**, pas un nom.

   Ce code, deux pages le tiennent d'endroits différents, et c'est pour cela
   que ce fichier existe plutôt qu'un bloc recopié dans chacune :

     — la page des matchs le lit dans l'URL du drapeau que l'API joint à
       chaque compétition : `…/flags/de.svg` ;
     — la page des compétitions le lit dans la colonne `country_code` de
       `souvenir_leagues`, écrite par `scripts/coverage.mjs`.

   Restent cinq cas sans code ISO : les quatre nations britanniques, qui n'en
   ont pas, et les compétitions internationales, dont l'API dit que le pays
   est « World ». Cinq entrées écrites à la main contre deux cents : c'est le
   rapport qu'on cherchait.

   Tout retombe **toujours** sur ce que l'API a écrit plutôt que sur rien : un
   pays sans nom se lit comme une panne, un pays en anglais se lit.
   ======================================================================= */

window.TBF_PAYS = (() => {
  const LOCALES = ['fr', 'en', 'de', 'it', 'es'];

  /* La langue est celle que le joueur a choisie au compte, retenue par
     `compte.html` sous cette clé. On la lit ici plutôt que d'attendre
     `/api/auth/me` : le rendu est synchrone, et un visiteur sans compte a
     quand même une langue — celle de son navigateur. */
  let locale = LOCALES.find((l) => navigator.language.toLowerCase().startsWith(l)) || 'fr';
  try {
    const s = localStorage.getItem('tbf_locale');
    if (LOCALES.includes(s)) locale = s;
  } catch { /* stockage refusé : la langue du navigateur suffit */ }
  /* Une page qui n'a qu'une langue l'impose avant de charger ce fichier :
     /admin est en français, quelle que soit la langue choisie au compte. */
  if (LOCALES.includes(window.TBF_PAYS_LANGUE)) locale = window.TBF_PAYS_LANGUE;

  /* Les quatre nations britanniques n'ont pas de code ISO, et l'API range les
     compétitions internationales sous « World ». Leurs noms sont écrits ici,
     dans les cinq langues : `Intl` ne les connaît pas. Elles ont aussi leur
     place dans la recherche — taper « écosse » doit trouver « Scotland ». */
  const NATIONS = {
    World: { fr: 'International', en: 'World', de: 'International',
             it: 'Internazionale', es: 'Internacional' },
    England: { fr: 'Angleterre', en: 'England', de: 'England',
               it: 'Inghilterra', es: 'Inglaterra' },
    Scotland: { fr: 'Écosse', en: 'Scotland', de: 'Schottland',
                it: 'Scozia', es: 'Escocia' },
    Wales: { fr: 'Pays de Galles', en: 'Wales', de: 'Wales',
             it: 'Galles', es: 'Gales' },
    'Northern-Ireland': { fr: 'Irlande du Nord', en: 'Northern Ireland',
                          de: 'Nordirland', it: 'Irlanda del Nord',
                          es: 'Irlanda del Norte' },
  };

  /* **Le nom que l'API écrit, quand ce n'est pas celui de la norme.** La
     table d'`Intl` dit « Türkiye », « Czechia », « United States » ; l'API
     dit « Turkey », « Czech Republic », « USA ». Sans ces noms-là, le pays
     se traduisait bien à l'écran mais restait introuvable : « turquie »
     cherchait « türkiye » dans une base qui ne connaît que « Turkey ».

     Les autres pays s'écrivent pareil des deux côtés, aux tirets et aux
     accents près (« Czech-Republic », « Curacao »), que `pli` efface. */
  const ALIAS = {
    AG: ['Antigua and Barbuda'],
    BA: ['Bosnia and Herzegovina', 'Bosnia'],
    BN: ['Brunei Darussalam'],
    BQ: ['Bonaire'],
    CD: ['Congo DR', 'DR Congo'],
    CG: ['Congo'],
    CI: ['Ivory Coast'],
    CN: ['China PR'],
    CV: ['Cape Verde Islands'],
    CZ: ['Czech Republic'],
    GB: ['Great Britain'],
    HK: ['Hong Kong'],
    IE: ['Republic of Ireland'],
    KG: ['Kyrgyz Republic'],
    KN: ['St Kitts and Nevis', 'Saint Kitts and Nevis'],
    KP: ['Korea DPR'],
    KR: ['Korea Republic'],
    LC: ['Saint Lucia'],
    MK: ['Macedonia', 'FYR Macedonia'],
    MM: ['Myanmar'],
    MO: ['Macau', 'Macao'],
    PF: ['Tahiti'],
    PS: ['Palestine'],
    ST: ['Sao Tome and Principe'],
    SZ: ['Swaziland'],
    TL: ['East Timor'],
    TR: ['Turkey'],
    TT: ['Trinidad and Tobago'],
    TW: ['Chinese Taipei'],
    US: ['USA'],
    VC: ['St Vincent and the Grenadines', 'Saint Vincent and the Grenadines'],
    VI: ['US Virgin Islands'],
  };

  /* Ce qu'on tape aussi pour ces pays-là, et que la norme n'écrit plus :
     « République tchèque » est devenue « Tchéquie », mais c'est encore ce
     que la plupart des gens écrivent. */
  const AUSSI = {
    CZ: ['République tchèque', 'Tschechische Republik', 'Repubblica Ceca', 'República Checa'],
    CD: ['RD Congo', 'RDC'],
    US: ['Amérique', 'Amerika'],
    GB: ['Grande-Bretagne', 'Großbritannien', 'Gran Bretagna', 'Gran Bretaña'],
  };

  /* Trois régions dont le nom complet est un titre administratif
     (« R.A.S. chinoise de Hong Kong ») : on garde le nom court. Pas pour
     tous, sinon les États-Unis deviendraient « É.-U. ». */
  const COURTS = new Set(['HK', 'MO', 'PS']);

  /* Deux sélections que le football nomme autrement que la norme. */
  const FOOT = {
    CD: { fr: 'RD Congo', en: 'DR Congo', de: 'DR Kongo', it: 'RD del Congo', es: 'RD del Congo' },
    TW: { fr: 'Taipei chinois', en: 'Chinese Taipei', de: 'Chinesisch Taipeh',
          it: 'Taipei Cinese', es: 'Taipéi Chino' },
  };

  const regions = (l, style = 'long') => {
    try { return new Intl.DisplayNames([l], { type: 'region', style, fallback: 'none' }); }
    catch { return null; }   // moteur trop ancien : on gardera l'anglais
  };
  const REGIONS = regions(locale);
  const REGIONS_COURTS = regions(locale, 'short');

  /** Le nom d'un code dans la langue du lecteur, ou null. */
  function deCode(code) {
    if (NATIONS[code]) return NATIONS[code][locale] ?? null;
    if (FOOT[code]) return FOOT[code][locale] ?? null;
    try {
      return (COURTS.has(code) ? REGIONS_COURTS : REGIONS)?.of(code) ?? null;
    } catch { return null; }
  }

  /**
   * Le texte réduit à ce qu'on tape vraiment : minuscules, sans accents.
   *
   * Personne ne cherche « Corée du Sud » en composant le « é ». Un champ de
   * recherche qui exige l'accent exact **ne trouve rien** et ne dit pas
   * pourquoi — c'est le pire des deux : le joueur croit que le match n'existe
   * pas. On plie les deux côtés, le terme cherché comme le nom trouvé.
   */
  const pli = (x) => (x ?? '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
    /* Les tirets et la ponctuation aussi : l'API écrit « Czech-Republic » et
       « St. Kitts », la norme « Czech Republic » et « St Kitts ». */
    .replace(/[-–'’.]/g, ' ').replace(/&/g, ' and ').replace(/\s+/g, ' ').trim();

  /**
   * Le code ISO, d'où qu'il vienne.
   *
   * Deux lettres, c'est déjà le code. Une URL de drapeau, c'est
   * `…/flags/de.svg`. Tout le reste ne donne rien, et c'est un cas normal :
   * la colonne peut être vide tant que `coverage.mjs` n'a pas tourné.
   */
  function codeISO(indice) {
    const s = String(indice ?? '');
    if (/^[A-Za-z]{2}$/.test(s)) return s.toUpperCase();
    return /\/flags\/([a-z]{2})\.svg/i.exec(s)?.[1]?.toUpperCase() ?? null;
  }

  const nomsVus = new Map();

  /**
   * Le nom d'un pays dans la langue du lecteur.
   *
   * @param nomApi  ce que l'API a écrit : « Germany », « World ».
   * @param indice  un code ISO ou une URL de drapeau. Facultatif.
   */
  function nom(nomApi, indice) {
    const cle = `${nomApi}|${indice}`;
    if (nomsVus.has(cle)) return nomsVus.get(cle);
    const code = codeISO(indice) ?? (NATIONS[nomApi] ? nomApi : code_(nomApi));
    const n = (code && deCode(code)) || nomApi || '';
    nomsVus.set(cle, n);
    return n;
  }

  /**
   * Le code d'un pays **d'après son nom** : celui de la norme, celui de l'API,
   * ou un nom britannique. Null si ce n'est pas un pays.
   *
   * C'est ce qui traduit la page tout de suite, avant même que
   * `scripts/coverage.mjs` ait rempli la colonne des codes, et ce qui
   * reconnaît une sélection nationale à son seul nom : « Switzerland » n'est
   * pas le nom propre d'un club, c'est « Suisse » écrit en anglais.
   */
  const codesVus = new Map();
  function code_(nomApi) {
    const p = pli(nomApi);
    if (p.length < 2) return null;
    // Une liste de matchs le demande deux fois par ligne : on retient.
    if (!codesVus.has(p)) codesVus.set(p, table().find((x) => x.ang.includes(p))?.code ?? null);
    return codesVus.get(p);
  }

  /**
   * La table des pays dans les deux langues, construite par le navigateur.
   *
   * Elle sert à **la recherche**, pas à l'affichage : taper « espagne » doit
   * trouver la Liga *et* la sélection espagnole. Or l'API nomme les sélections
   * comme les pays, en anglais — « Spain », « Spain U21 », « Spain W ».
   * Retraduire le terme cherché vers l'anglais est donc le seul moyen qu'un
   * mot français atteigne une équipe nationale, ou une compétition dont le
   * pays n'est rangé en base qu'en anglais.
   *
   * Les six cent soixante-seize codes possibles sont demandés un par un :
   * `Intl` n'expose aucune liste de régions. C'est quelques millisecondes,
   * faites **une seule fois et seulement si l'on cherche** — jamais au
   * chargement.
   */
  /* Les codes que `Intl` connaît encore mais qui ne sont plus des pays — les
     anciens (« DD » pour l'Allemagne de l'Est, qui répond « Germany »), les
     ensembles (Union européenne, Nations unies) et ceux d'essai. Sans eux,
     « Germany » trouverait « DD » avant « DE ». */
  const HORS = new Set(['AN', 'BU', 'CS', 'DD', 'DY', 'EU', 'EZ', 'FX', 'HV', 'NH',
    'QO', 'RH', 'SU', 'TP', 'UK', 'UN', 'VD', 'XA', 'XB', 'YD', 'YU', 'ZR', 'ZZ']);

  let TABLE = null;
  function table() {
    if (TABLE) return TABLE;
    TABLE = [];
    const anglais = regions('en');
    if (!anglais) return TABLE;
    /* Les noms dans **les cinq langues**, pas seulement celle du lecteur : un
       Suisse alémanique sur un téléphone réglé en français tape « Schweiz ». */
    const langues = LOCALES.map((l) => regions(l)).filter(Boolean);
    const ajouter = (code, nomEn, noms, api) => TABLE.push({
      code, nom: nomEn,
      // `ang` : tous les noms anglais, la norme d'abord puis ceux de l'API.
      ang: [...new Set([nomEn, ...api].map(pli))],
      // `api` : les mêmes, tels qu'ils s'écrivent, pour le serveur.
      api: [...new Set([...api, nomEn])],
      noms: [...new Set(noms.map(pli))],
    });
    for (let i = 65; i <= 90; i++) {
      for (let j = 65; j <= 90; j++) {
        const code = String.fromCharCode(i, j);
        if (HORS.has(code)) continue;
        let ang = null;
        try { ang = anglais.of(code); } catch { continue; }
        if (!ang) continue;
        const noms = langues.map((d) => { try { return d.of(code); } catch { return null; } })
          .filter(Boolean).concat(AUSSI[code] ?? [], Object.values(FOOT[code] ?? {}));
        ajouter(code, ang, noms, ALIAS[code] ?? []);
      }
    }
    for (const [cle, noms] of Object.entries(NATIONS)) {
      if (cle === 'World') continue;
      ajouter(cle, noms.en, Object.values(noms), [cle]);
    }
    return TABLE;
  }

  /** Les pays dont un nom, dans une des cinq langues, contient ce terme. */
  function trouves(terme) {
    const t = pli(terme);
    if (t.length < 3) return [];
    /* Le pays dont un nom **commence** par le terme d'abord : « états-unis »
       désigne les États-Unis avant les « Îles mineures éloignées des
       États-Unis ». Le premier nom sert aussi à interroger l'API. */
    const rang = (p) => ([...p.noms, ...p.ang].some((n) => n.startsWith(t)) ? 0 : 1);
    return table().filter((p) => p.noms.some((n) => n.includes(t))
      || p.ang.some((n) => n.includes(t)))
      .sort((a, b) => rang(a) - rang(b));
  }

  /**
   * Les pays que ce terme désigne, **tels quels** : leur code ISO et leur nom
   * anglais non plié.
   *
   * C'est la forme que le serveur attend, et il lui faut les deux. Le code
   * vise la colonne `country_code`, qui est juste mais peut être vide tant que
   * `scripts/coverage.mjs` n'a pas tourné ; le nom anglais lui sert de secours,
   * sous toutes ses formes : celle de l'API (« Czech Republic », voir ALIAS),
   * celle de la norme (« Czechia »), avec et sans tirets. Aucun des deux ne
   * suffit seul, les deux ensemble ne manquent rien.
   */
  function designes(terme) {
    return trouves(terme).flatMap((p) => p.api.flatMap((nom) =>
      [{ code: p.code, nom }, { code: p.code, nom: nom.replace(/ /g, '-') }]))
      .filter((x, i, l) => l.findIndex((y) => y.nom === x.nom) === i);
  }

  /**
   * Les pays que ce terme désigne, rendus sous leurs noms **anglais pliés** —
   * celui de la norme et ceux de l'API.
   *
   * Trois lettres au minimum : en dessous, « in » désignerait l'Inde, la Chine
   * et l'Argentine à la fois, et la recherche rendrait la moitié de la
   * journée. Au-dessus, on accepte large — c'est une recherche, pas un
   * formulaire.
   */
  function cherches(terme) {
    return [...new Set(trouves(terme).flatMap((p) => p.ang))];
  }

  /**
   * Les mêmes, tels que l'API les écrit, pour une recherche faite en base :
   * l'API d'abord (« Turkey »), puis la norme (« Türkiye »), avec et sans
   * tirets — la colonne `country` dit « Czech-Republic », le nom de la
   * sélection « Czech Republic ».
   */
  function nomsApi(terme) {
    return [...new Set(designes(terme).map((p) => p.nom))];
  }

  /**
   * Le nom d'une **équipe**, dans la langue du lecteur si c'est une sélection.
   *
   * Le nom d'une sélection nationale est un nom de pays : « Switzerland »
   * n'est pas le nom propre d'un club, c'est « Suisse » écrit en anglais. On
   * le traduit donc, suffixe compris — l'API range l'équipe féminine sous
   * « Switzerland W », les espoirs sous « Switzerland U21 ». Le nom d'un club,
   * lui, ne se traduit jamais : le Bayern s'appelle le Bayern partout.
   *
   * La sélection se reconnaît à sa marque `national`, ou **à son nom** : la
   * marque peut manquer en base. Pas un club qui porte le nom d'un pays :
   * « Monaco » joue en France, et son `country` le dit.
   *
   * @param e  { name, national?, country? } — une ligne de `teams`.
   */
  const SUFFIXE = /^(.+?)\s+(W|U\d{2})$/;
  function equipe(e) {
    const brut = String(e?.name ?? '');
    const m = SUFFIXE.exec(brut);
    const base = m ? m[1] : brut;
    const pays = code_(base);
    const sienne = pays && (!e?.country || code_(e.country) === pays);
    if (!Number(e?.national) && !sienne) return brut;
    const traduit = nom(base);
    return m ? `${traduit} ${m[2]}` : traduit;
  }

  return { locale, pli, nom, code: code_, codeISO, cherches, designes, nomsApi, equipe };
})();
