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
  const LOCALES = ['fr', 'en', 'de', 'es'];

  /* La langue est celle que le joueur a choisie au compte, retenue par
     `compte.html` sous cette clé. On la lit ici plutôt que d'attendre
     `/api/auth/me` : le rendu est synchrone, et un visiteur sans compte a
     quand même une langue — celle de son navigateur. */
  let locale = LOCALES.find((l) => navigator.language.toLowerCase().startsWith(l)) || 'fr';
  try {
    const s = localStorage.getItem('tbf_locale');
    if (LOCALES.includes(s)) locale = s;
  } catch { /* stockage refusé : la langue du navigateur suffit */ }

  const SANS_CODE = {
    fr: { World: 'International', England: 'Angleterre', Scotland: 'Écosse',
          Wales: 'Pays de Galles', 'Northern-Ireland': 'Irlande du Nord' },
    // L'API écrit déjà en anglais : il n'y a rien à corriger.
    en: {},
    de: { World: 'International', England: 'England', Scotland: 'Schottland',
          Wales: 'Wales', 'Northern-Ireland': 'Nordirland' },
    es: { World: 'Internacional', England: 'Inglaterra', Scotland: 'Escocia',
          Wales: 'Gales', 'Northern-Ireland': 'Irlanda del Norte' },
  };

  const REGIONS = (() => {
    try { return new Intl.DisplayNames([locale], { type: 'region', fallback: 'none' }); }
    catch { return null; }   // moteur trop ancien : on gardera l'anglais
  })();

  /**
   * Le texte réduit à ce qu'on tape vraiment : minuscules, sans accents.
   *
   * Personne ne cherche « Corée du Sud » en composant le « é ». Un champ de
   * recherche qui exige l'accent exact **ne trouve rien** et ne dit pas
   * pourquoi — c'est le pire des deux : le joueur croit que le match n'existe
   * pas. On plie les deux côtés, le terme cherché comme le nom trouvé.
   */
  const pli = (x) => (x ?? '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

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
    let n = (SANS_CODE[locale] ?? {})[nomApi] ?? null;
    const code = codeISO(indice);
    if (!n && code && REGIONS) {
      try { n = REGIONS.of(code) ?? null; } catch { n = null; }
    }
    /* Sans code, on tente le **nom**. `Intl` donne aussi l'anglais, et l'API
       écrit presque toujours le pays comme lui, aux tirets près :
       « South-Korea » et « South Korea » se rejoignent une fois pliés.

       C'est ce qui fait que la page est traduite tout de suite, avant même que
       `scripts/coverage.mjs` ait rempli la colonne des codes. Presque toujours,
       donc pas toujours : « Czech-Republic » — que la norme appelle
       « Czechia » — restera en anglais jusque-là. Un mot en anglais, pas une
       page cassée. */
    if (!n && !code) {
      const anglais = pli(String(nomApi ?? '').replace(/-/g, ' '));
      const t = anglais.length > 2 ? table().find((p) => p.ang === anglais) : null;
      if (t && REGIONS) { try { n = REGIONS.of(t.code) ?? null; } catch { n = null; } }
    }
    n = n || nomApi || '';
    nomsVus.set(cle, n);
    return n;
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
  let TABLE = null;
  function table() {
    if (TABLE) return TABLE;
    TABLE = [];
    let anglais;
    try {
      anglais = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' });
    } catch { return TABLE; }
    for (let i = 65; i <= 90; i++) {
      for (let j = 65; j <= 90; j++) {
        const code = String.fromCharCode(i, j);
        let ang = null;
        let loc = null;
        try { ang = anglais.of(code); loc = REGIONS?.of(code) ?? null; } catch { continue; }
        if (!ang) continue;
        TABLE.push({ code, nom: ang, ang: pli(ang), loc: pli(loc ?? ang) });
      }
    }
    return TABLE;
  }

  /**
   * Les pays que ce terme désigne, **tels quels** : leur code ISO et leur nom
   * anglais non plié.
   *
   * C'est la forme que le serveur attend, et il lui faut les deux. Le code
   * vise la colonne `country_code`, qui est juste mais peut être vide tant que
   * `scripts/coverage.mjs` n'a pas tourné ; le nom anglais lui sert de secours,
   * et il suffit presque toujours — presque, parce que l'API écrit
   * « Czech-Republic » là où `Intl` dit « Czechia ». Aucun des deux ne suffit
   * seul, les deux ensemble ne manquent rien.
   */
  function designes(terme) {
    const t = pli(terme);
    if (t.length < 3) return [];
    return table().filter((p) => p.loc.includes(t) || p.ang.includes(t))
      .map((p) => ({ code: p.code, nom: p.nom }));
  }

  /**
   * Les pays que ce terme désigne, rendus sous leur nom **anglais plié**.
   *
   * Trois lettres au minimum : en dessous, « in » désignerait l'Inde, la Chine
   * et l'Argentine à la fois, et la recherche rendrait la moitié de la
   * journée. Au-dessus, on accepte large — c'est une recherche, pas un
   * formulaire.
   */
  function cherches(terme) {
    const t = pli(terme);
    if (t.length < 3) return [];
    return table().filter((p) => p.loc.includes(t) || p.ang.includes(t)).map((p) => p.ang);
  }

  return { locale, pli, nom, codeISO, cherches, designes };
})();
