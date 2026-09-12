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
          zone.innerHTML = `<div class="grille" id="pad"
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
            apres(g.ms ?? 9000, finir);
          });
          break;
        }

        case 'memoire': {
          const g = gestes?.memoire ?? {};
          const cartes = g.cartes ?? [];
          rendre = { paires: [], instants: [] };
          zone.innerHTML = `<div class="grille memo" id="pad"
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
            apres(g.ms ?? 12000, finir);
          });
          break;
        }

        case 'capo': {
          const g = gestes?.capo ?? {};
          const zones = g.zones ?? 6;
          rendre = { suite: [], instants: [] };
          zone.innerHTML = `<div class="grille capo" id="pad"
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
