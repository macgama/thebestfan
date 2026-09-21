/**
 * Le mini-jeu des gestes.
 *
 * ## Pourquoi un fichier à part
 *
 * Il était écrit **deux fois** : dans le Grand Virage et dans le duel. Trois
 * gestes, deux implémentations, deux décomptes, deux façons de fermer la
 * fenêtre. Passer à dix gestes aurait voulu dire en écrire vingt.
 *
 * ## La règle qui tient tout
 *
 * **Le client ne calcule aucune durée.** Tout ce qu'il dessine — la pulsation,
 * le nombre de frappes attendues, la limite d'une tenue — vient de `gestes`,
 * que le serveur envoie avec l'état. La faute a déjà été payée : la pulsation
 * était dessinée à 560 ms alors que la notation appliquait les modificateurs
 * du porteur, si bien qu'un joueur équipé tapait juste sur ce qu'on lui
 * montrait et récoltait 0,36 au lieu de 0,99. Plus sa carte était rare, plus
 * il était puni.
 *
 * Ce fichier ne connaît donc **aucun nombre de jeu**. Il connaît des formes.
 *
 * ## Ce qu'il rend
 *
 * Une suite d'instants en millisecondes depuis l'ouverture de la fenêtre —
 * c'est tout ce que le serveur accepte, et c'est ce qui lui permet de juger
 * sans faire confiance à personne. Les gestes de tenue rendent des paires
 * appui/relâchement.
 *
 * Script classique, pas module : comme tout ce qui vit dans `public/`.
 */
(() => {
  /** Ce qu'on annonce au joueur avant chaque geste. */
  const LABEL = {
    tempo: 'TEMPO', mash: 'MARTELAGE', hold: 'ENDURANCE',
    contretemps: 'CONTRETEMPS', echo: 'ÉCHO', crescendo: 'CRESCENDO',
    relance: 'RELANCE', salves: 'SALVES', tenue: 'SANG-FROID', retenue: 'MESURE',
    tifo: 'TIFO', memoire: 'LES VISAGES', mosaique: 'MOSAÏQUE',
    echarpe: 'L’ÉCHARPE', capo: 'LE CAPO',
    tri: 'LE TRI', compte: 'LE COMPTE',
    bascule: 'LA BASCULE', visee: 'LA VISÉE', jauge: 'LA JAUGE',
  };
  const AIDE = {
    tempo: 'Tape sur chaque pulsation',
    mash: 'Tape le plus vite possible',
    hold: 'Garde le doigt appuyé',
    contretemps: 'Tape **entre** les pulsations',
    echo: 'Écoute le motif, puis refais-le',
    crescendo: 'Tape de plus en plus vite, régulièrement',
    relance: 'Tiens, puis lâche pile sur la pulsation',
    salves: 'Trois rafales, séparées par un silence',
    tenue: 'Tiens le plus longtemps possible — mais lâche avant la fin',
    retenue: 'Tape exactement le nombre demandé. Ni plus, ni moins.',
    tifo: 'Suis le trait du doigt, sans le quitter, jusqu’au bout',
    memoire: 'Retiens les visages, puis retrouve les paires',
    mosaique: 'Retiens la mosaïque, puis refais-la',
    echarpe: 'Fais tourner l’écharpe — rond et régulier',
    capo: 'Regarde la suite du capo, puis répète-la',
    tri: 'Ramasse **uniquement** les cartons de la bonne couleur',
    compte: 'Le compte s’éteint. Touche pile quand il arrive à zéro.',
    /* La consigne dit la règle **et son piège**. Une épreuve dont on découvre
       le retournement en le ratant se lit comme une injustice, pas comme une
       difficulté — et on ne la rejoue pas. */
    bascule: 'Pousse du côté montré — sauf « à contre-courant », où tu vas de l’autre',
    visee: 'Touche chaque fumigène tant qu’il brûle. Le bon endroit **et** le bon moment.',
    jauge: 'Garde le curseur dans la bande. Elle tient, puis elle saute.',
  };
  /* La couleur dit la famille du geste avant qu'on ait lu son nom : or pour le
     rythme, bleu pour la vitesse, craie pour la tenue, vert pour la mesure. */
  const COULEUR = {
    tempo: '#F5C33B', contretemps: '#F5C33B', echo: '#F5C33B', crescendo: '#F5C33B',
    mash: '#3C82E8', salves: '#3C82E8',
    hold: '#C2CAD6', relance: '#C2CAD6', tenue: '#E0402C',
    retenue: '#1E9E6A',
    /* Les cinq épreuves ont leurs propres teintes : violet pour ce qui se
       dessine, vert d’eau pour ce qui se retient. Elles ne sont pas du rythme,
       et l’œil doit le savoir avant d’avoir lu le nom. */
    tifo: '#8257DA', echarpe: '#8257DA',
    memoire: '#2FB8A6', mosaique: '#2FB8A6', capo: '#2FB8A6',
    /* Les deux dernières ne retiennent rien : l'une trie à vue, l'autre
       compte dans le noir. Elles ont donc leur propre teinte — ambre — pour
       qu'on ne les prenne pas pour des épreuves de mémoire. */
    tri: '#E08A2C', compte: '#E08A2C',
    /* Les trois neuves partagent le rouge : ce sont les seules qui demandent
       de **décider vite**, et la couleur le dit avant la consigne. */
    bascule: '#E0402C', visee: '#E0402C', jauge: '#E0402C',
  };

  const label = (g) => LABEL[g] ?? String(g ?? '').toUpperCase();
  const aide = (g) => AIDE[g] ?? '';
  const couleur = (g) => COULEUR[g] ?? '#F5C33B';

  const buzz = (ms) => { try { navigator.vibrate?.(ms); } catch { /* tant pis */ } };

  /* Les éléments que ce fichier vient de poser lui-même dans la zone. Il ne
     cherche jamais rien d autre dans la page : les deux écrans n ont pas le
     même balisage, et c est très bien ainsi. */
  const $ = (id) => document.getElementById(id);

  /**
   * Garder le doigt, même s il sort du cadre.
   *
   * setPointerCapture **lève** quand le pointeur n est plus actif — c est le
   * cas d un événement synthétique, mais aussi d un doigt relâché entre-temps.
   * L appel était en tête du gestionnaire d appui : il emportait la ligne
   * suivante, celle qui pose le point de départ du tracé, et tous les
   * mouvements qui suivaient lisaient un point nul. Le geste mourait pour
   * toute sa durée, sans que rien ne le dise.
   *
   * La capture est un confort ; le tracé est le geste. On prend donc le point
   * d abord, et la capture ensuite, sous garde.
   */
  const prendre = (pad, e) => {
    try { pad.setPointerCapture?.(e.pointerId); } catch { /* doigt déjà parti */ }
  };

  /**
   * Joue un geste et rend ses instants.
   *
   * @param kind    le geste — l'un des dix.
   * @param gestes  la configuration envoyée par le serveur (`you.gestes`).
   * @param el      les éléments de la page : `{ boite, titre, aide, zone }`.
   *   Les deux écrans n'ont pas les mêmes identifiants, et c'est très bien —
   *   ce fichier n'a pas à connaître leur balisage.
   */
  function jouer(kind, gestes, el) {
    const zone = el.zone;
    const t0 = performance.now();
    const taps = [];
    const maintenant = () => Math.round(performance.now() - t0);

    return new Promise((resolve) => {
      /* Ce que la fenêtre rendra. Les dix gestes rendent leurs frappes ;
         les cinq épreuves posent ici un objet — un tracé, une grille, une
         suite — et c est lui qui part. */
      let rendre = null;
      let fini = false;
      const finir = () => {
        if (fini) return;
        fini = true;
        // Les minuteries sont **nulées** en même temps qu'elles sont effacées :
        // `clearInterval` laisse un identifiant vrai derrière lui, et ce projet
        // a déjà payé cette erreur quatre fois.
        for (const t of minuteries) { clearInterval(t); clearTimeout(t); }
        minuteries.length = 0;
        resolve(rendre ?? taps);
      };
      const minuteries = [];
      const apres = (ms, fn) => { const t = setTimeout(fn, ms); minuteries.push(t); return t; };
      const chaque = (ms, fn) => { const t = setInterval(fn, ms); minuteries.push(t); return t; };

      /* ---------------------------------------------------- les formes */

      /** Le pavé qu'on frappe, avec son compteur. */
      const pave = (gros, petit, anneau = false) => {
        zone.innerHTML = `<div class="pad" id="pad">
          ${anneau ? '<div class="ring" id="ring"></div>' : ''}
          <div style="text-align:center">
            <div class="n" id="n">${gros}</div>
            <div class="s" id="s">${petit}</div></div></div>`;
        return document.getElementById('pad');
      };
      const dit = (gros, petit) => {
        const a = document.getElementById('n');
        const b = document.getElementById('s');
        if (a && gros != null) a.textContent = gros;
        if (b && petit != null) b.textContent = petit;
      };
      const battre = () => {
        const r = document.getElementById('ring');
        if (!r) return;
        r.classList.remove('beat'); void r.offsetWidth; r.classList.add('beat');
      };
      const toucher = (pad) => {
        pad.classList.add('hit');
        apres(80, () => pad.classList.remove('hit'));
      };

      /** Les gestes de frappe : on note l'instant, on montre le compte. */
      const frappes = (pad, sous) => {
        pad.onpointerdown = () => {
          taps.push(maintenant());
          dit(taps.length, sous);
          toucher(pad); buzz(14);
        };
      };

      /** Les gestes de tenue : on note l'appui **et** le relâchement. */
      const tenir = (pad, pendant) => {
        pad.onpointerdown = () => { taps.push(maintenant()); pad.classList.add('hit'); buzz(10); };
        const lacher = () => {
          if (taps.length % 2 === 1) { taps.push(maintenant()); pad.classList.remove('hit'); }
          pendant?.();
        };
        pad.onpointerup = lacher;
        pad.onpointercancel = lacher;
        pad.onpointerleave = lacher;
      };

      /**
       * « C'EST FAIT » — finir avant la fin du temps.
       *
       * Trois épreuves se **terminent** vraiment : la mosaïque est refaite, les
       * paires sont retrouvées, les cartons sont ramassés. Le joueur le sait
       * avant la minuterie — souvent trois ou quatre secondes avant — et il
       * restait devant un écran plein pendant que le duel continuait derrière.
       * Une épreuve qui fait perdre du temps après avoir été réussie punit la
       * réussite.
       *
       * Le bouton ne remplace pas la minuterie, il la double : elle reste le
       * plafond pour qui hésite, il devient le plancher pour qui a fini. Et il
       * ne paraît que sur ces épreuves-là — sur le tempo ou le martelage, le
       * temps **est** l'épreuve, et un bouton qui l'écourte n'aurait aucun sens.
       */
      const valider = (texte = 'C’EST FAIT') => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'tbf-valider';
        b.id = 'valider';
        b.textContent = texte;
        b.onclick = finir;
        zone.appendChild(b);
        return b;
      };

      /* ------------------------------------------------------ les dix */

      switch (kind) {
        case 'tempo': {
          const g = gestes?.tempo ?? {};
          const pad = pave(0, 'SUR LE RYTHME', true);
          frappes(pad, 'SUR LE RYTHME');
          let i = 0;
          chaque(g.interval, () => {
            battre(); buzz(12);
            if (++i >= g.beats) apres(420, finir);
          });
          break;
        }

        case 'contretemps': {
          /* La pulsation se voit, mais il faut taper **entre** deux. On la
             marque donc plus discrètement que pour le tempo : c'est le
             silence qui compte, pas le coup. */
          const g = gestes?.contretemps ?? {};
          const pad = pave(0, 'ENTRE LES TEMPS', true);
          frappes(pad, 'ENTRE LES TEMPS');
          let i = 0;
          chaque(g.interval, () => {
            battre(); buzz(6);
            if (++i >= g.beats + 1) apres(360, finir);
          });
          break;
        }

        case 'echo': {
          /* Le motif se joue d'abord tout seul — c'est la moitié du geste :
             on ne peut pas refaire ce qu'on n'a pas écouté. Le pavé ne répond
             pas pendant la démonstration, sinon la première frappe du joueur
             tomberait dans le motif et fausserait tout. */
          const g = gestes?.echo ?? {};
          const instants = g.instants ?? [];
          const pad = pave('…', 'ÉCOUTE', true);
          const fin = instants[instants.length - 1] ?? 0;
          for (const t of instants) apres(t, () => { battre(); buzz(10); });
          apres(fin + 700, () => {
            dit(0, 'À TOI');
            const t1 = performance.now();
            // On repart de zéro : le serveur note le motif depuis sa première
            // frappe, pas depuis l'ouverture de la fenêtre.
            pad.onpointerdown = () => {
              taps.push(Math.round(performance.now() - t1));
              dit(taps.length, 'À TOI'); toucher(pad); buzz(14);
            };
            apres(fin + 900, finir);
          });
          break;
        }

        case 'crescendo': {
          const g = gestes?.crescendo ?? {};
          const instants = g.instants ?? [];
          const pad = pave(0, 'ACCÉLÈRE', true);
          frappes(pad, 'ACCÉLÈRE');
          for (const t of instants) apres(t, () => { battre(); buzz(8); });
          apres((instants[instants.length - 1] ?? 0) + 600, finir);
          break;
        }

        case 'relance': {
          /* Tenir, puis lâcher sur la pulsation. La barre monte jusqu'à
             l'instant attendu : c'est elle qui donne le moment, et elle rend
             le geste jouable sans compter dans sa tête. */
          const g = gestes?.relance ?? {};
          const pad = pave('TIENS', 'PUIS LÂCHE SUR LE COUP', false);
          pad.insertAdjacentHTML('beforeend', '<i class="jauge" id="jauge"></i>');
          const jauge = document.getElementById('jauge');
          const debut = performance.now();
          chaque(40, () => {
            const part = Math.min(1, (performance.now() - debut) / g.attente);
            if (jauge) jauge.style.transform = `scaleX(${part})`;
            if (part >= 1) { battre(); buzz(18); }
          });
          tenir(pad, () => apres(120, finir));
          apres(g.attente + 1100, finir);
          break;
        }

        case 'salves': {
          const g = gestes?.salves ?? {};
          const pad = pave(0, `${g.rafales} RAFALES`, true);
          frappes(pad, `${g.rafales} RAFALES`);
          // Un battement au départ de chaque rafale : le silence se voit.
          const parRafale = g.parRafale ?? 4;
          const longueur = parRafale * 130;
          for (let r = 0; r < (g.rafales ?? 3); r++) {
            apres(r * (longueur + g.silence), () => { battre(); buzz(16); });
          }
          apres((g.rafales ?? 3) * (longueur + g.silence) + 300, finir);
          break;
        }

        case 'hold': {
          const g = gestes?.hold ?? {};
          const pad = pave('0%', 'NE LÂCHE PAS', false);
          tenir(pad);
          const debut = performance.now();
          chaque(60, () => {
            const part = Math.min(1, (performance.now() - debut) / g.need);
            dit(`${Math.round(part * 100)}%`, 'NE LÂCHE PAS');
            if (part >= 1) apres(200, finir);
          });
          break;
        }

        case 'tenue': {
          /* Le geste du sang-froid. La jauge monte, et **rien n'indique la
             limite** : c'est tout l'exercice. Elle vire au rouge quand on
             s'approche, parce qu'un risque qu'on ne peut pas sentir n'est pas
             un risque, c'est un piège. */
          const g = gestes?.tenue ?? {};
          const pad = pave('0%', 'LÂCHE AVANT LA FIN', false);
          pad.insertAdjacentHTML('beforeend', '<i class="jauge" id="jauge"></i>');
          const jauge = document.getElementById('jauge');
          let depuis = null;
          pad.onpointerdown = () => {
            taps.push(maintenant()); depuis = performance.now();
            pad.classList.add('hit'); buzz(10);
          };
          const lacher = () => {
            if (taps.length % 2 === 1) { taps.push(maintenant()); pad.classList.remove('hit'); }
            apres(150, finir);
          };
          pad.onpointerup = lacher; pad.onpointercancel = lacher; pad.onpointerleave = lacher;
          chaque(50, () => {
            if (depuis === null) return;
            const part = (performance.now() - depuis) / g.limite;
            dit(`${Math.round(Math.min(1.4, part) * 100)}%`, 'LÂCHE AVANT LA FIN');
            if (jauge) {
              jauge.style.transform = `scaleX(${Math.min(1, part)})`;
              jauge.style.background = part > 0.82 ? '#E0402C' : '';
            }
            if (part > 1.35) finir();          // il a tout perdu : inutile d'attendre
          });
          apres(g.limite + 2500, finir);
          break;
        }

        case 'retenue': {
          const g = gestes?.retenue ?? {};
          const pad = pave(0, `EXACTEMENT ${g.exact}`, false);
          frappes(pad, `EXACTEMENT ${g.exact}`);
          apres(g.ms, finir);
          break;
        }

        /* --------------------------------------------- les cinq épreuves

           Elles ne rendent pas une liste d'instants mais un objet : un tracé,
           une grille, une suite. `finir` sait le faire — il rend `rendre` dès
           que cette variable est posée, et les frappes sinon. */

        case 'tifo': {
          const g = gestes?.tifo ?? {};
          rendre = { trace: [] };
          const forme = (g.points ?? []).map((p, i) =>
            `${i ? 'L' : 'M'}${(p.x * 100).toFixed(1)} ${(p.y * 100).toFixed(1)}`).join(' ');
          zone.innerHTML = `<div class="pad trace" id="pad">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" class="tifoSvg">
              <path class="modele" d="${forme} Z"></path>
              <path class="doigt" id="tifoDoigt" d=""></path>
            </svg>
            <div class="s" id="s">SUIS LE TRAIT</div></div>`;
          const pad = $('pad');
          const doigt = $('tifoDoigt');
          /* Les coordonnées sont **relatives au cadre**, pas à l'écran : le
             serveur note dans un carré de zéro à un, et les deux pages n'ont
             pas la même taille de zone de jeu. */
          const situer = (e) => {
            const r = pad.getBoundingClientRect();
            return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
          };
          let pose = false;
          pad.style.touchAction = 'none';
          pad.onpointerdown = (e) => {
            pose = true;
            rendre.trace.push(situer(e));
            prendre(pad, e);
            buzz(8);
          };
          pad.onpointermove = (e) => {
            if (!pose) return;
            rendre.trace.push(situer(e));
            doigt.setAttribute('d', rendre.trace
              .map((p, i) => `${i ? 'L' : 'M'}${(p.x * 100).toFixed(1)} ${(p.y * 100).toFixed(1)}`)
              .join(' '));
          };
          pad.onpointerup = () => { pose = false; };
          apres(g.ms ?? 6000, finir);
          break;
        }

        case 'echarpe': {
          const g = gestes?.echarpe ?? {};
          rendre = { trace: [] };
          zone.innerHTML = `<div class="pad trace" id="pad">
            <div class="rond"></div>
            <div style="text-align:center"><div class="n" id="n">0</div>
            <div class="s">${(g.sens ?? 1) < 0 ? 'TOURS — SENS INVERSE' : 'TOURS'}</div></div></div>`;
          const pad = $('pad');
          const situer = (e) => {
            const r = pad.getBoundingClientRect();
            return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
          };
          let pose = false;
          let angle = 0;
          let dernier = null;
          pad.style.touchAction = 'none';
          pad.onpointerdown = (e) => {
            pose = true;
            dernier = situer(e);
            rendre.trace.push(dernier);
            prendre(pad, e);
          };
          pad.onpointermove = (e) => {
            if (!pose || !dernier) return;
            const p = situer(e);
            rendre.trace.push(p);
            /* Le compteur de tours n'est **qu'un affichage**. Le serveur
               recalcule tout depuis le tracé : ce nombre-ci ne voyage jamais,
               et s'il se trompait, il ne tromperait que l'œil. */
            const a0 = Math.atan2(dernier.y - 0.5, dernier.x - 0.5);
            const a1 = Math.atan2(p.y - 0.5, p.x - 0.5);
            let d = a1 - a0;
            if (d > Math.PI) d -= Math.PI * 2;
            if (d < -Math.PI) d += Math.PI * 2;
            angle += d * (g.sens ?? 1);
            dernier = p;
            const tours = Math.max(0, angle / (Math.PI * 2));
            $('n').textContent = tours.toFixed(1);
            if (tours >= (g.tours ?? 3) + 0.15) apres(180, finir);
          };
          pad.onpointerup = () => { pose = false; };
          apres(g.ms ?? 7000, finir);
          break;
        }

        case 'mosaique': {
          const g = gestes?.mosaique ?? {};
          const cotes = g.cotes ?? 4;
          const n = cotes * cotes;
          rendre = { grille: Array.from({ length: n }, () => 0), instants: [] };
          zone.innerHTML = `<div class="tbf-grille" id="pad"
            style="grid-template-columns:repeat(${cotes},1fr)">${
            Array.from({ length: n }, (_, i) =>
              `<i data-c="${i}" class="${g.grille?.[i] ? 'on' : ''}"></i>`).join('')
            }</div><div class="s" id="s">RETIENS</div>`;
          const pad = $('pad');
          /* L'aperçu, puis le noir, puis à toi. Les cases ne deviennent
             touchables qu'après : sans ça, on recopie au lieu de retenir, et
             l'épreuve ne mesure plus rien. */
          apres(g.apercu ?? 1100, () => {
            for (const c of pad.children) c.className = '';
            $('s').textContent = 'REFAIS-LA';
            pad.onpointerdown = (e) => {
              const c = e.target.closest('[data-c]');
              if (!c) return;
              const i = Number(c.dataset.c);
              rendre.grille[i] = rendre.grille[i] ? 0 : 1;
              c.className = rendre.grille[i] ? 'mise' : '';
              rendre.instants.push(maintenant());
              buzz(9);
            };
            valider();
            apres(g.ms ?? 9000, finir);
          });
          break;
        }

        case 'memoire': {
          const g = gestes?.memoire ?? {};
          const cartes = g.cartes ?? [];
          rendre = { paires: [], instants: [] };
          zone.innerHTML = `<div class="tbf-grille memo" id="pad"
            style="grid-template-columns:repeat(4,1fr)">${
            cartes.map((v, i) => `<i data-c="${i}" data-v="${v}" class="vue">${v + 1}</i>`)
              .join('')}</div><div class="s" id="s">RETIENS LES PAIRES</div>`;
          const pad = $('pad');
          apres(g.apercu ?? 2000, () => {
            for (const c of pad.children) c.className = '';
            $('s').textContent = 'RETROUVE-LES';
            let ouverte = null;
            pad.onpointerdown = (e) => {
              const c = e.target.closest('[data-c]');
              if (!c || c.classList.contains('prise') || c === ouverte) return;
              c.className = 'vue';
              rendre.instants.push(maintenant());
              buzz(9);
              if (!ouverte) { ouverte = c; return; }
              const a = Number(ouverte.dataset.c);
              const b = Number(c.dataset.c);
              rendre.paires.push([a, b]);
              /* On annonce la paire **telle qu'elle est jouée**, juste ou non.
                 C'est le serveur qui dit si elle l'était : recopier ici la
                 règle de comparaison en ferait une seconde vérité, et celle-ci
                 mentirait le jour où l'autre changerait. Ce qu'on décide ici
                 n'est que la couleur de la case. */
              const juste = ouverte.dataset.v === c.dataset.v;
              const pris = [ouverte, c];
              ouverte = null;
              apres(juste ? 260 : 620, () => {
                for (const x of pris) x.className = juste ? 'prise' : '';
              });
              if (rendre.paires.length >= (g.paires ?? 4)) apres(700, finir);
            };
            valider('J’AI FINI');
            apres(g.ms ?? 12000, finir);
          });
          break;
        }

        case 'capo': {
          const g = gestes?.capo ?? {};
          const zones = g.zones ?? 6;
          rendre = { suite: [], instants: [] };
          zone.innerHTML = `<div class="tbf-grille capo" id="pad"
            style="grid-template-columns:repeat(3,1fr)">${
            Array.from({ length: zones }, (_, i) => `<i data-c="${i}"></i>`).join('')
            }</div><div class="s" id="s">REGARDE</div>`;
          const pad = $('pad');
          const suite = g.suite ?? [];
          let i = 0;
          const montrer = chaque(g.pas ?? 620, () => {
            for (const c of pad.children) c.className = '';
            if (i >= suite.length) {
              clearInterval(montrer);
              $('s').textContent = 'À TOI';
              pad.onpointerdown = (e) => {
                const c = e.target.closest('[data-c]');
                if (!c) return;
                rendre.suite.push(Number(c.dataset.c));
                rendre.instants.push(maintenant());
                c.className = 'on';
                apres(140, () => { c.className = ''; });
                buzz(11);
                if (rendre.suite.length >= suite.length) apres(320, finir);
              };
              apres(g.ms ?? 9000, finir);
              return;
            }
            const c = pad.children[suite[i++]];
            if (c) c.className = 'on';
            buzz(14);
          });
          break;
        }

        /**
         * **Le tri des cartons.** Ramasser une couleur, laisser les deux
         * autres, le plus vite possible.
         *
         * Rien n'est caché et rien ne s'éteint : c'est la seule épreuve où tout
         * reste à l'écran du début à la fin. Ce qu'elle mesure n'est pas la
         * mémoire mais la discrimination sous la pression du temps — et un
         * mauvais carton coûte un bon, donc s'arrêter quand on n'est plus sûr
         * est un choix qui se défend.
         */
        case 'tri': {
          const g = gestes?.tri ?? {};
          const plateau = g.plateau ?? [];
          const cible = g.cible ?? 0;
          rendre = { touches: [], instants: [] };
          /* Les trois couleurs sont fixes, pas tirées : le joueur doit
             reconnaître « le rouge » d'une partie à l'autre, et une palette qui
             change à chaque fois lui referait apprendre l'épreuve. */
          const TEINTES = ['#E0402C', '#3C82E8', '#F5C33B'];
          const cotes = Math.ceil(Math.sqrt(plateau.length || 1));
          zone.innerHTML = `<div class="tbf-grille tri" id="pad"
            style="grid-template-columns:repeat(${cotes},1fr)">${
            plateau.map((c, i) =>
              `<i data-c="${i}" style="--t:${TEINTES[c] ?? TEINTES[0]}"></i>`).join('')
            }</div><div class="s" id="s">RAMASSE LE <b
              style="color:${TEINTES[cible] ?? TEINTES[0]}">■</b></div>`;
          const pad = $('pad');
          pad.onpointerdown = (e) => {
            const c = e.target.closest('[data-c]');
            if (!c || c.classList.contains('pris')) return;
            const i = Number(c.dataset.c);
            rendre.touches.push(i);
            rendre.instants.push(maintenant());
            /* On montre tout de suite si c'était bon. Le joueur le sait déjà —
               il voit les couleurs — et le lui cacher ne rendrait pas
               l'épreuve plus difficile, seulement moins lisible. */
            c.className = plateau[i] === cible ? 'pris' : 'pris rate';
            buzz(plateau[i] === cible ? 9 : 22);
          };
          valider('J’AI TOUT RAMASSÉ');
          apres(g.ms ?? 6000, finir);
          break;
        }

        /**
         * **Le compte.** Le rebours s'affiche, puis s'éteint, et il faut tomber
         * juste quand même.
         *
         * La seule épreuve du jeu où il n'y a rien à regarder au moment où l'on
         * agit. On donne donc trois secondes de compte visible pour caler
         * l'horloge, puis on l'éteint : ce qui reste à tenir est l'écart entre
         * ce qu'on a vu et la cible, et il change à chaque fois.
         *
         * `maintenant()` des deux côtés : l'écart rendu est une durée mesurée
         * chez le joueur, jamais un instant absolu. Une horloge décalée de dix
         * minutes n'y change rien.
         */
        case 'compte': {
          const g = gestes?.compte ?? {};
          const cible = g.cible ?? 6000;
          const visible = g.visible ?? 3000;
          const depart = maintenant();
          rendre = { ecoule: 0, instants: [] };
          zone.innerHTML = `<div class="tbf-compte" id="pad">
            <b id="cpt">—</b><small id="s">TOUCHE À ZÉRO</small></div>`;
          const cpt = $('cpt');
          /* Le rebours ne se rafraîchit qu'au dixième : à la milliseconde, le
             joueur lirait le chiffre au lieu de compter, et l'épreuve
             mesurerait sa vue. */
          const tic = setInterval(() => {
            const passe = maintenant() - depart;
            if (passe >= visible) {
              cpt.textContent = '';
              cpt.classList.add('noir');
              clearInterval(tic);
              return;
            }
            cpt.textContent = ((cible - passe) / 1000).toFixed(1);
          }, 100);
          $('pad').onpointerdown = () => {
            if (rendre.ecoule) return;              // un seul coup, le premier
            rendre.ecoule = maintenant() - depart;
            clearInterval(tic);
            cpt.classList.remove('noir');
            cpt.textContent = '✓';
            buzz(14);
            finir();
          };
          apres(g.ms ?? 12_000, () => { clearInterval(tic); finir(); });
          break;
        }

        /**
         * **La bascule.** Le capo désigne un côté ; la bâche dit parfois « à
         * contre-courant », et il faut aller de l'autre.
         *
         * La seule épreuve du jeu où il faut **arrêter un geste déjà parti**.
         * Tout le reste demande de reproduire, de chercher ou de doser ; ici la
         * main sait où aller avant que l'œil ait fini de lire, et c'est ça qu'on
         * mesure.
         *
         * Le signal passe tout seul : on ne peut pas attendre le suivant pour
         * se décider, et ne pas répondre est un choix qui se défend — ça ne
         * rapporte rien, ça ne coûte rien de plus qu'une erreur.
         */
        case 'bascule': {
          const g = gestes?.bascule ?? {};
          const signaux = g.signaux ?? [];
          rendre = { choix: [], instants: [] };
          zone.innerHTML = `<div class="tbf-bascule" id="pad">
            <div class="mot" id="mot">—</div>
            <div class="cotes">
              <button type="button" class="cote" data-k="0">◀</button>
              <button type="button" class="cote" data-k="1">▶</button>
            </div></div>`;
          const mot = $('mot');
          const pad = $('pad');
          let rang = -1;
          let repondu = true;

          /* Une case par signal, remplie à mesure. Sans elle, une absence de
             réponse décalerait tout ce qui suit : la notation lit `choix[i]`
             pour le signal `i`, et un tableau tassé ferait juger la neuvième
             réponse sur le dixième signal. */
          const avancer = () => {
            if (!repondu) rendre.choix.push(null);
            rang++;
            repondu = false;
            if (rang >= signaux.length) { finir(); return; }
            const s = signaux[rang];
            mot.className = `mot ${s.contre ? 'contre' : ''}`;
            mot.innerHTML = s.contre
              ? `<b>À CONTRE-COURANT</b><span>${s.cote ? '▶' : '◀'}</span>`
              : `<b>ON POUSSE</b><span>${s.cote ? '▶' : '◀'}</span>`;
            buzz(s.contre ? [8, 40, 8] : 10);
          };

          pad.onpointerdown = (e) => {
            const b = e.target.closest('[data-k]');
            if (!b || repondu || rang < 0 || rang >= signaux.length) return;
            repondu = true;
            rendre.choix.push(Number(b.dataset.k));
            rendre.instants.push(maintenant());
            b.classList.add('pris');
            apres(140, () => b.classList.remove('pris'));
            buzz(14);
          };

          avancer();
          chaque(g.pas ?? 820, avancer);
          apres(g.ms ?? 10_000, finir);
          break;
        }

        /**
         * **La visée.** Les fumigènes s'allument un par un et ne durent pas.
         *
         * L'œil et la main ensemble, sous une horloge. Le tifo et l'écharpe
         * suivent un tracé qui ne bouge pas et attendent le doigt ; ici la
         * cible s'éteint, et toucher au bon endroit une seconde trop tard ne
         * vaut rien — les deux notes se multiplient.
         *
         * Les coordonnées partent en **fraction du cadre** et non en pixels :
         * le serveur note la même chose sur un téléphone et sur un écran large,
         * et c'est lui qui a décidé où poser les cibles.
         */
        case 'visee': {
          const g = gestes?.visee ?? {};
          const cibles = g.cibles ?? [];
          rendre = { touches: [] };
          zone.innerHTML = '<div class="tbf-visee" id="pad"></div>';
          const pad = $('pad');

          pad.onpointerdown = (e) => {
            const r = pad.getBoundingClientRect();
            if (!r.width || !r.height) return;
            rendre.touches.push({
              x: (e.clientX - r.left) / r.width,
              y: (e.clientY - r.top) / r.height,
              t: maintenant(),
            });
            /* L'éclat marque l'endroit touché, pas la cible : le joueur doit
               voir **son** geste, sinon il ne sait pas s'il a manqué de peu ou
               de loin. */
            const eclat = document.createElement('i');
            eclat.className = 'eclat';
            eclat.style.cssText = `left:${e.clientX - r.left}px;top:${e.clientY - r.top}px`;
            pad.appendChild(eclat);
            apres(400, () => eclat.remove());
            buzz(12);
          };

          /* Chaque cible naît à son instant et s'éteint au bout de sa fenêtre.
             La durée d'affichage est un peu plus longue que la fenêtre notée :
             une cible qui disparaît pile quand elle cesse de valoir laisserait
             croire qu'on l'a eue. */
          for (const c of cibles) {
            apres(c.t, () => {
              const n = document.createElement('i');
              n.className = 'cible';
              n.style.cssText = `left:${c.x * 100}%;top:${c.y * 100}%`;
              pad.appendChild(n);
              requestAnimationFrame(() => n.classList.add('vue'));
              setTimeout(() => n.remove(), (g.fenetre ?? 520) * 1.6);
            });
          }
          apres((g.ms ?? 8000) + 400, finir);
          break;
        }

        /**
         * **La jauge.** La corde tient, puis saute. Rester dedans.
         *
         * La seule épreuve notée **en continu** : cent mesures plutôt qu'une
         * poignée d'instants. Le sang-froid des dix gestes est un relâchement,
         * une décision unique ; celle-ci demande de tenir trois secondes sans
         * bouger, puis de courir, quatre fois de suite.
         *
         * La bande est dessinée ici à partir des sommets, et **notée ailleurs à
         * partir des mêmes sommets** : la page interpole pour montrer, le
         * serveur interpole pour juger, et c'est lui qui fait foi. Une page qui
         * calculerait sa propre bande rejouerait la faute des Jumelles — voir
         * `gestures.js`.
         */
        case 'jauge': {
          const g = gestes?.jauge ?? {};
          const sommets = g.sommets ?? [];
          const largeur = g.largeur ?? 0.15;
          rendre = { mesures: [] };
          zone.innerHTML = `<div class="tbf-jauge" id="pad">
            <div class="bande" id="bande"></div>
            <div class="curseur" id="cur"></div>
            <div class="s" id="s">GLISSE LE DOIGT — RESTE DANS LA BANDE</div></div>`;
          const pad = $('pad');
          const bande = $('bande');
          const cur = $('cur');

          const centre = (t) => {
            if (!sommets.length) return 0.5;
            if (t <= sommets[0].t) return sommets[0].v;
            for (let i = 1; i < sommets.length; i++) {
              if (t <= sommets[i].t) {
                const part = (t - sommets[i - 1].t)
                  / Math.max(1, sommets[i].t - sommets[i - 1].t);
                return sommets[i - 1].v + (sommets[i].v - sommets[i - 1].v) * part;
              }
            }
            return sommets[sommets.length - 1].v;
          };

          /* `v` est compté **du bas vers le haut** — zéro en bas — parce que
             c'est ainsi qu'on lit une jauge, et que le serveur ne sait rien
             d'un écran. La conversion en pourcentage CSS se fait ici, une fois. */
          let v = 0.5;
          const poser = (e) => {
            const r = pad.getBoundingClientRect();
            if (!r.height) return;
            v = Math.min(1, Math.max(0, 1 - (e.clientY - r.top) / r.height));
            cur.style.bottom = `${v * 100}%`;
          };
          pad.onpointerdown = (e) => { pad.setPointerCapture?.(e.pointerId); poser(e); };
          pad.onpointermove = (e) => { if (e.buttons) poser(e); };

          cur.style.bottom = '50%';
          const peindre = () => {
            const c = centre(maintenant());
            bande.style.bottom = `${(c - largeur / 2) * 100}%`;
            bande.style.height = `${largeur * 100}%`;
            cur.classList.toggle('dedans', Math.abs(v - c) <= largeur / 2);
          };
          peindre();
          chaque(40, peindre);

          /* L'échantillon est celui du serveur : c'est lui qui fixe combien de
             mesures il attend, et les compter autrement ferait rejeter une
             réponse honnête pour cause de `minMesures`. */
          chaque(g.echantillon ?? 100, () => {
            rendre.mesures.push({ t: maintenant(), v });
          });
          apres(g.ms ?? 8000, finir);
          break;
        }

/**
         * **Le martèlement**, et le filet pour tout geste inconnu : taper le
         * plus vite possible, tant que ça dure.
         *
         * **`case 'mash'` avait perdu son corps.** Il était écrit ici, collé
         * au `default`, les deux partageant ce bloc. Les cinq épreuves sont
         * venues s'insérer entre les deux : le `default` est resté en bas
         * avec le code, et `case 'mash':` est resté en haut, seul, sans corps
         * et sans `break` — c'est-à-dire tombant dans le cas suivant.
         *
         * Conséquence : tout chant en martèlement — Le craquage, Le roulement
         * — jouait **la bascule** et rendait `{ choix, instants }` au lieu
         * d'une liste de frappes. Le serveur refusait avec `bad_taps`, que la
         * page ne sait pas nommer, et le joueur lisait « Refusé par le
         * serveur » après avoir martelé trois secondes pour rien.
         *
         * Rien ne rougissait : un `switch` qui traverse est du JavaScript
         * valide, et aucune suite ne jouait les quinze gestes l'un après
         * l'autre pour regarder ce que chacun rend. C'est ce que fait
         * désormais `npm run gestes:test`.
         *
         * Le corps n'est pas recopié en haut : deux exemplaires du même geste
         * finissent par diverger, et c'est déjà ce qui a produit ce bug. */
        case 'mash':
        default: {
          const g = gestes?.mash ?? {};
          const pad = pave(0, 'FRAPPES', false);
          frappes(pad, 'FRAPPES');
          apres(g.ms ?? 3000, finir);
          break;
        }
      }
    });
  }

  window.TBF_GESTE = { jouer, label, aide, couleur, LABEL, AIDE, COULEUR };
})();
