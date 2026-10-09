/* =======================================================================
   Les cinq langues du jeu.

   Le jeu est écrit en français, partout, et il le reste : le français est la
   langue de référence et celle de secours. Les quatre autres (anglais,
   allemand, italien, espagnol) ne réécrivent pas les pages : **elles
   traduisent ce qui s'affiche**, au moment où ça s'affiche.

   Pourquoi pas une clé par texte, comme `compte.html` ? Parce que le jeu
   compte vingt-cinq pages et près de sept mille phrases, écrites dans le code
   au fil des lots, souvent composées (« ${n} écharpes »). Les remplacer toutes
   par des clés aurait touché chaque ligne du jeu pour un résultat identique à
   l'écran. Ici, le texte français *est* la clé : un dictionnaire par langue
   (`public/i18n/<langue>.js`, construit par `npm run langues`) dit ce qu'il
   devient. Un texte absent du dictionnaire reste en français, il ne casse
   rien : c'est ce qui arrive à un Fanzzy tout neuf tant qu'on ne l'a pas
   traduit, et `npm run langues` le liste.

   Trois sortes d'entrées :
     — un texte exact : « Mon profil » → « My profile » ;
     — un motif, où {0}, {1}… tiennent la place de ce que le code y glisse :
       « {0} écharpes » → « {0} scarves ». Une valeur glissée est traduite à
       son tour si le dictionnaire la connaît (un nom de Fanzzy, par exemple).
       Côté traduction, {0?un|plusieurs} choisit selon que la valeur vaut 1 ;
     — un texte riche, quand un paragraphe mêle du gras ou un lien :
       « Touche <0>Partager</0>, puis… ». Les balises numérotées sont les
       éléments de la page eux-mêmes, déplacés et non recréés : un lien garde
       son adresse, un bouton son écouteur.

   La langue se choisit seule à la première visite, d'après le navigateur, et
   se change dans le menu ou sur la page du compte. Elle est retenue sur
   l'appareil (`tbf_locale`) et, pour un joueur connecté, dans son compte :
   c'est elle que prennent ses mails.

   /admin n'est pas traduit : il ne charge pas ce fichier.
   ======================================================================= */

(() => {
  const LANGUES = ['fr', 'en', 'de', 'it', 'es'];
  const NOMS = { fr: 'Français', en: 'English', de: 'Deutsch', it: 'Italiano', es: 'Español' };
  /* Les empreintes des dictionnaires : écrites par `npm run langues`, pour
     qu'un dictionnaire changé ait une autre adresse et ne sorte jamais d'un
     cache. */
  const VERSIONS = /*versions*/{"en":"5fb8e6f60f","de":"8a59a2d60b","it":"70fd113731","es":"15c82527be"}/*fin*/;

  const lire = () => {
    try {
      const s = localStorage.getItem('tbf_locale');
      if (LANGUES.includes(s)) return s;
    } catch {}
    for (const l of navigator.languages ?? [navigator.language ?? '']) {
      const c = String(l).slice(0, 2).toLowerCase();
      if (LANGUES.includes(c)) return c;
    }
    return 'fr';
  };
  const langue = lire();
  /* Choisie à la main (le menu, le compte) ou seulement devinée du
     navigateur ? Une langue devinée cède à celle du compte. */
  let choisie = false;
  try {
    choisie = localStorage.getItem('tbf_locale_choisie') === '1';
    localStorage.setItem('tbf_locale', langue);
  } catch {}
  document.documentElement.lang = langue;

  /* ------------------------------------------------------------ la clé

     Le même calcul sert à la page et à `scripts/langues.mjs`, qui charge ce
     fichier dans jsdom pour construire les dictionnaires : une clé calculée
     deux fois de deux façons finirait par ne plus correspondre. */
  const norm = (s) => String(s)
    .replace(/[   ]/g, ' ')
    .replace(/'/g, '’')
    .replace(/\s+/g, ' ')
    .trim();

  const EN_LIGNE = new Set(['B', 'STRONG', 'I', 'EM', 'A', 'SPAN', 'BR', 'SMALL', 'U', 'MARK',
    'CODE', 'SUP', 'SUB', 'ABBR', 'TIME', 'KBD', 'S', 'Q', 'CITE', 'DEL', 'INS', 'NOBR']);
  const A_TEXTE = /[A-Za-zÀ-ÿ]/;

  /* Un élément est « riche » quand il mêle un texte à lui (des lettres) et au
     moins un élément en ligne qui porte quelque chose — un mot, ou un
     nombre que le code y glisse : c'est là qu'une traduction morceau par
     morceau casserait la phrase. */
  function estRiche(el) {
    let texte = false, enfant = false;
    for (const n of el.childNodes) {
      if (n.nodeType === 3) { if (A_TEXTE.test(n.data)) texte = true; }
      else if (n.nodeType === 1) {
        if (!EN_LIGNE.has(n.tagName)) return false;
        if (n.tagName !== 'BR' && !enLigneSeulement(n)) return false;
        if (n.textContent.trim()) enfant = true;
      } else if (n.nodeType !== 8) return false;
    }
    return texte && enfant;
  }
  function enLigneSeulement(el) {
    for (const n of el.children) {
      if (!EN_LIGNE.has(n.tagName) || !enLigneSeulement(n)) return false;
    }
    return true;
  }
  function cleRiche(el) {
    let s = '', i = 0;
    for (const n of el.childNodes) {
      if (n.nodeType === 3) s += n.data;
      else if (n.nodeType === 1) {
        s += n.tagName === 'BR' ? `<${i}/>` : `<${i}>${cleRiche(n)}</${i}>`;
        i++;
      }
    }
    return s;
  }

  const api = {
    langue, LANGUES, NOMS, norm, estRiche, cleRiche,
    /* Traduire une chaîne venue du code (une alerte, un titre) : le
       français ressort tel quel quand on joue en français. */
    t: (s) => s,
    /* Changer de langue : retenu sur l'appareil, dans le compte quand on est
       connecté, puis la page se recharge — plus sûr que de retraduire sur
       place ce qu'un script a peut-être déjà mesuré. */
    async changer(l) {
      if (!LANGUES.includes(l)) return;
      try {
        localStorage.setItem('tbf_locale', l);
        localStorage.setItem('tbf_locale_choisie', '1');
      } catch {}
      try {
        await fetch('/api/auth/me', {
          method: 'PATCH', credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ locale: l }),
        });
      } catch {}
      location.reload();
    },
    /* Accorder l'appareil et le compte, une fois par visite. Sur un
       appareil où l'on n'a rien choisi, la langue du compte l'emporte : un
       joueur qui se connecte sur un téléphone neuf retrouve la sienne. Sur
       un appareil où l'on a choisi, c'est le compte qui suit — ses mails
       partent dans cette langue. */
    accorder() {
      /* Le serveur pose la langue du compte dans le cookie `tbf_langue`
         (voir `attachUser`) : pas de requête de plus. */
      const compte = /(?:^|;\s*)tbf_langue=(\w+)/.exec(document.cookie)?.[1];
      if (!LANGUES.includes(compte) || compte === langue) return;
      if (choisie) {
        /* Une fois par visite : une base qui ne connaît pas encore la
           langue la refuse, et ce n'est pas la peine d'insister. */
        try {
          if (sessionStorage.getItem('tbf_langue_envoyee') === langue) return;
          sessionStorage.setItem('tbf_langue_envoyee', langue);
        } catch { return; }
        fetch('/api/auth/me', {
          method: 'PATCH', credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ locale: langue }),
        }).catch(() => {});
        return;
      }
      try { localStorage.setItem('tbf_locale', compte); } catch {}
      location.reload();
    },
    /* Une rangée de plaques, une par langue, pour le menu et le compte. */
    plaques(boite) {
      boite.innerHTML = LANGUES.map((l) => {
        const on = l === langue;
        return `<button type="button" data-langue="${l}" class="tbf-plaque${on ? ' on' : ''}"`
          + `${on ? ' data-ton="craie"' : ''} aria-pressed="${on}" lang="${l}" title="${NOMS[l]}"`
          + ` translate="no">${l.toUpperCase()}</button>`;
      }).join('');
      boite.setAttribute('translate', 'no');
      boite.onclick = (e) => {
        const b = e.target.closest('[data-langue]');
        if (b && b.dataset.langue !== langue) api.changer(b.dataset.langue);
      };
    },
  };
  window.TBF_LANGUE = api;
  if (window.TBF_LANGUE_SANS_MOTEUR) return;
  api.accorder();
  if (langue === 'fr') return;

  /* ---------------------------------------------------------- le moteur */

  let exacts = new Map();
  let motifs = [];
  let parCle = new Map();
  const cache = new Map();

  function compiler(dico) {
    exacts = new Map(Object.entries(dico.exacts ?? {}));
    motifs = Object.entries(dico.motifs ?? {}).map(([fr, tr]) => {
      const ordre = [];
      const morceaux = fr.split(/\{(\d+)\}/);
      let re = '^';
      let litteral = '';
      morceaux.forEach((m, i) => {
        if (i % 2) { ordre.push(Number(m)); re += '([\\s\\S]*?)'; }
        else { re += m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); litteral += m; }
      });
      const repere = morceaux.filter((m, i) => !(i % 2)).sort((a, b) => b.length - a.length)[0];
      /* Deux trous collés (« SAISON {0} — {1}{2} ») : la limite entre eux
         se cherche à la traduction. */
      const colles = [];
      for (let i = 2; i < morceaux.length - 1; i += 2) if (morceaux[i] === '') colles.push(i / 2 - 1);
      /* Un mot et un trou (« {0} jour », « pour {0} ») attraperaient
         n'importe quelle phrase qui finit ou commence par ce mot. */
      const etroit = /^\{\d+\} ?[^\s{}]+$|^[^\s{}]+ ?\{\d+\}$/.test(fr);
      return { fr, re: new RegExp(re + '$'), ordre, tr, poids: litteral.length, repere, colles, etroit };
    }).sort((a, b) => b.poids - a.poids);
    parCle = new Map(motifs.map((m) => [m.fr, m]));
  }

  function remplir(tr, valeurs, profondeur) {
    return tr.replace(/\{(\d+)(?:\?([^|}]*)\|([^}]*))?\}/g, (_, i, un, plusieurs) => {
      const v = valeurs[Number(i)] ?? '';
      if (un !== undefined) return /^\s*1\s*$/.test(v) ? un : plusieurs;
      /* « SAISON {0} — {1}{2} » prend « · 84 JOURS » avec son espace : la
         valeur se cherche sans ses bords, qui restent autour. */
      const coeur = v.trim();
      if (!coeur || profondeur >= 2) return v;
      const tv = traduire(coeur, profondeur + 1);
      return tv == null ? v : v.replace(coeur, () => tv);
    });
  }

  /* Rend la traduction d'une clé normalisée, ou null. */
  function traduire(cle, profondeur = 0, muet = false) {
    if (!A_TEXTE.test(cle)) return null;
    if (cache.has(cle)) return cache.get(cle);
    let tr = exacts.get(cle) ?? null;
    /* Les nombres d'abord : « Stades : 1 sur 18 » se cherche directement
       sous « Stades : {0} sur {1} ». */
    if (tr === null && /\d/.test(cle)) {
      const nombres = [];
      /* Les nombres du texte seulement, pas ceux des balises <0>…</0>. */
      const gen = cle.split(/(<\/?\d+\/?>)/).map((m, i) => (i % 2 ? m
        : m.replace(/\d+(?: \d{3})*(?:[.,]\d+)?/g, (n) => `{${nombres.push(n) - 1}}`))).join('');
      const m = parCle.get(gen);
      if (m) {
        const valeurs = [];
        m.ordre.forEach((n, k) => { valeurs[n] = nombres[k]; });
        tr = remplir(m.tr, valeurs, profondeur);
      }
    }
    if (tr === null) {
      for (const m of motifs) {
        if (m.repere && !cle.includes(m.repere)) continue;
        const r = m.re.exec(cle);
        if (!r) continue;
        const vus = r.slice(1);
        for (const k of m.colles) {
          const tout = vus[k] + vus[k + 1];
          for (let c = 1; c < tout.length; c++) {
            const d = tout.slice(c);
            if (!/^\s/.test(d) || traduire(d.trim(), profondeur + 1, true) == null) continue;
            vus[k] = tout.slice(0, c); vus[k + 1] = d;
            break;
          }
        }
        if (m.etroit && !vus.every((v) => /^[\d\s.,+−-]*$/.test(v) || !/\s/.test(v.trim())
          || traduire(v.trim(), profondeur + 1, true) != null)) continue;
        const valeurs = [];
        m.ordre.forEach((n, k) => { valeurs[n] = vus[k]; });
        tr = remplir(m.tr, valeurs, profondeur);
        break;
      }
    }
    if (tr === null && !muet) manque(cle);
    if (cache.size > 5000) cache.clear();
    cache.set(cle, tr);
    return tr;
  }

  /* Ce qui n'a pas trouvé de traduction, pour `scripts/langues-pages.mjs`. */
  const manques = new Set();
  function manque(cle) {
    if (manques.size < 2000 && /[a-zà-ÿ]{3}/i.test(cle)) manques.add(cle);
  }
  api.manques = () => [...manques];

  api.t = (s) => {
    if (s == null) return s;
    const tr = traduire(norm(s));
    return tr ?? s;
  };

  const ECRIT = new WeakMap();
  const SAUTER = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'NOSCRIPT', 'CODE', 'svg', 'SVG']);
  const ATTRIBUTS = ['title', 'placeholder', 'aria-label', 'alt'];

  function exclu(el) {
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      if (SAUTER.has(e.tagName)) return true;
      if (e.getAttribute('translate') === 'no' || e.isContentEditable) return true;
    }
    return false;
  }

  function texte(n) {
    if (ECRIT.get(n) === n.data) return;
    const brut = n.data;
    if (!A_TEXTE.test(brut)) return;
    const tr = traduire(norm(brut));
    if (tr == null) return;
    const avant = brut.match(/^\s*/)[0];
    const apres = brut.match(/\s*$/)[0];
    const neuf = avant + tr + apres;
    ECRIT.set(n, neuf);
    if (neuf !== brut) n.data = neuf;
  }

  function attributs(el) {
    for (const a of ATTRIBUTS) {
      const v = el.getAttribute(a);
      if (!v || ECRIT.get(el)?.[a] === v || !A_TEXTE.test(v)) continue;
      const tr = traduire(norm(v));
      if (tr == null) continue;
      const deja = ECRIT.get(el) ?? {};
      deja[a] = tr;
      ECRIT.set(el, deja);
      if (tr !== v) el.setAttribute(a, tr);
    }
    if (el.tagName === 'INPUT' && /^(button|submit|reset)$/.test(el.type) && el.value) {
      const tr = traduire(norm(el.value));
      if (tr != null && tr !== el.value) el.value = tr;
    }
  }

  /* Recompose un élément riche : le texte traduit, avec ses éléments à lui
     replacés là où la traduction les met. */
  function poser(el, tr) {
    const enfants = [...el.childNodes].filter((n) => n.nodeType === 1);
    const frag = document.createDocumentFragment();
    const re = /<(\d+)\/>|<(\d+)>([\s\S]*?)<\/\2>/g;
    let fin = 0, m;
    while ((m = re.exec(tr))) {
      if (m.index > fin) frag.append(tr.slice(fin, m.index));
      const e = enfants[Number(m[1] ?? m[2])];
      if (e) {
        if (m[3] !== undefined) {
          if (e.children.length) poser(e, m[3]); else e.textContent = m[3];
        }
        frag.append(e);
      }
      fin = re.lastIndex;
    }
    if (fin < tr.length) frag.append(tr.slice(fin));
    el.replaceChildren(frag);
    for (const t of el.querySelectorAll('*')) ECRIT.set(t, true);
    marquerTextes(el);
  }
  function marquerTextes(el) {
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) ECRIT.set(n, n.data);
  }

  function riche(el) {
    if (!estRiche(el)) return false;
    const cle = norm(cleRiche(el));
    if (ECRIT.get(el) === cle) return true;
    const tr = traduire(cle);
    if (tr == null) return false;
    poser(el, tr);
    ECRIT.set(el, norm(cleRiche(el)));
    return true;
  }

  function parcourir(racine) {
    if (racine.nodeType === 3) {
      const p = racine.parentElement;
      if (!p || exclu(p)) return;
      if (riche(p)) return;
      texte(racine);
      return;
    }
    if (racine.nodeType !== 1 && racine.nodeType !== 11) return;
    if (racine.nodeType === 1 && exclu(racine)) return;
    const pile = [racine];
    while (pile.length) {
      const el = pile.pop();
      if (el.nodeType === 1) {
        if (SAUTER.has(el.tagName) || el.getAttribute('translate') === 'no') continue;
        attributs(el);
        if (riche(el)) continue;
      }
      for (const n of el.childNodes) {
        if (n.nodeType === 3) texte(n);
        else if (n.nodeType === 1) pile.push(n);
      }
      if (el.shadowRoot) pile.push(el.shadowRoot);
    }
  }

  const observateur = new MutationObserver((liste) => {
    for (const m of liste) {
      if (m.type === 'characterData') parcourir(m.target);
      else if (m.type === 'attributes') { if (!exclu(m.target)) attributs(m.target); }
      else {
        for (const n of m.addedNodes) parcourir(n);
        /* Un élément riche dont un script a changé un morceau. */
        const p = m.target;
        if (p.nodeType === 1 && !exclu(p)) {
          if (!riche(p)) for (const n of p.childNodes) if (n.nodeType === 3) texte(n);
        }
      }
    }
  });

  /* Les dates et les nombres que le code demande « en français » sortent
     dans la langue du joueur. */
  const LOCALE = { en: 'en-GB', de: 'de-DE', it: 'it-IT', es: 'es-ES' }[langue];
  const francais = (l) => {
    const v = Array.isArray(l) ? l[0] : l;
    return v == null || /^fr\b/i.test(String(v));
  };
  const remplace = (l) => (francais(l) ? LOCALE : l);
  for (const [Proto, noms] of [
    [Date.prototype, ['toLocaleDateString', 'toLocaleTimeString', 'toLocaleString']],
    [Number.prototype, ['toLocaleString']],
  ]) {
    for (const nom of noms) {
      const orig = Proto[nom];
      Proto[nom] = function (l, o) { return orig.call(this, remplace(l), o); };
    }
  }
  for (const nom of ['DateTimeFormat', 'NumberFormat', 'RelativeTimeFormat', 'PluralRules', 'ListFormat', 'DisplayNames']) {
    const Orig = Intl[nom];
    if (!Orig) continue;
    const Neuf = function (l, o) { return new Orig(remplace(l), o); };
    Neuf.prototype = Orig.prototype;
    Neuf.supportedLocalesOf = Orig.supportedLocalesOf;
    Intl[nom] = Neuf;
  }
  for (const nom of ['alert', 'confirm', 'prompt']) {
    const orig = window[nom];
    window[nom] = function (msg, ...reste) { return orig.call(this, api.t(msg), ...reste); };
  }

  api._demarrer = (dico) => {
    compiler(dico);
    parcourir(document.documentElement);
    observateur.observe(document.documentElement, {
      subtree: true, childList: true, characterData: true,
      attributes: true, attributeFilter: ATTRIBUTS,
    });
  };
  api._compiler = compiler;
  api._traduire = traduire;

  /* Le dictionnaire, chargé tout de suite et sans attendre : ce script est
     dans le <head>, et `document.write` y insère un script synchrone. Le
     moteur observe la page pendant qu'elle se construit, si bien que le
     joueur ne voit pas passer le français. */
  if (document.readyState === 'loading') {
    document.write(`<script src="/i18n/${langue}.js?v=${VERSIONS[langue]}"><\/script>`);
  } else {
    const s = document.createElement('script');
    s.src = `/i18n/${langue}.js?v=${VERSIONS[langue]}`;
    document.head.append(s);
  }
})();
