/**
 * Effets visuels — couche commune.
 *
 * Chaque page réinventait ses animations : secousse ici, étincelles là, chacune
 * avec ses propres réglages. Tout est regroupé ici, appelé par `FX.but()`,
 * `FX.carte()`, `FX.carton()`, et le reste suit.
 *
 * Trois règles tenues par le code, parce qu'un effet raté est pire que pas
 * d'effet du tout :
 *
 *   — rien ne dépasse quelques centaines de particules, et tout est nettoyé
 *     à la fin. Une animation qui laisse des nœuds derrière elle finit par
 *     ralentir la page au bout de dix minutes de jeu.
 *   — `prefers-reduced-motion` coupe le mouvement, pas l'information : le
 *     joueur voit toujours qu'un but a été marqué, sans que l'écran tremble.
 *   — tout est fait en CSS et en SVG. Zéro fichier téléchargé, donc aucun
 *     effet ne dépend du réseau au moment précis où il doit se déclencher.
 *
 * Et une quatrième, qui vient du joueur plutôt que du navigateur : le **mode
 * calme** du tiroir (voir plus bas). Il coupe séparément les sons, les
 * vibrations et les animations décoratives, et chaque effet de ce fichier le
 * consulte au moment de partir — pas au chargement : un réglage changé dans
 * le menu vaut pour le prochain but, sans recharger la page.
 */
(() => {
  if (window.FX) return;

  /* ------------------------------------------------------ le mode calme

     La préférence vit dans localStorage sous « tbf-calme » : des jetons
     séparés par des espaces, parmi sons, vibrations et animations. Elle est
     recopiée sur la racine du document (data-calme) à chaque chargement, pour
     que les feuilles de style s'y accrochent comme elles s'accrochent déjà à
     prefers-reduced-motion — html[data-calme~="animations"].

     **menu.js fait exactement la même recopie**, et c'est voulu : /bienvenue
     charge ce fichier sans le menu, /boutique le menu sans ce fichier. Les
     deux copies écrivent la même chose au même endroit ; la seconde qui passe
     ne change rien. Qui modifie l'une modifie l'autre.

     Ce qui fait foi pendant la visite est l'attribut, pas le stockage : le
     tiroir le réécrit à chaque interrupteur, et un stockage fermé (navigation
     privée) ne doit pas empêcher le réglage de valoir au moins pour la page. */
  const FACETTES = ['sons', 'vibrations', 'animations'];
  const normaliser = (brut) => {
    const jetons = String(brut ?? '').split(/\s+/);
    return FACETTES.filter((f) => jetons.includes(f)).join(' ');
  };
  const poserCalme = (v) => {
    if (v) document.documentElement.dataset.calme = v;
    else delete document.documentElement.dataset.calme;
  };
  function lireCalme() {
    let brut = '';
    try {
      brut = localStorage.getItem('tbf-calme') ?? '';
      /* L'ancienne clé du bouton de son du duel. Elle disait « coupé » à sa
         façon, et un joueur qui avait coupé le son ne doit pas l'entendre
         revenir parce que la préférence a changé de nom. Relue une fois,
         versée dans la nouvelle, puis retirée. */
      const ancien = localStorage.getItem('tbf-son');
      if (ancien !== null) {
        if (ancien === 'coupe') brut += ' sons';
        brut = normaliser(brut);
        localStorage.setItem('tbf-calme', brut);
        localStorage.removeItem('tbf-son');
      }
    } catch { /* pas de stockage : rien de calmé, comme avant */ }
    return normaliser(brut);
  }
  /** Le joueur a-t-il calmé cette facette ? Lu à chaque appel, jamais retenu. */
  const calme = (facette) =>
    (document.documentElement.dataset.calme ?? '').split(' ').includes(facette);
  /** Calme ou rétablit une facette, et le retient. */
  function reglerCalme(facette, oui) {
    const jetons = new Set((document.documentElement.dataset.calme ?? '').split(' '));
    if (oui) jetons.add(facette); else jetons.delete(facette);
    const v = normaliser([...jetons].join(' '));
    try { localStorage.setItem('tbf-calme', v); } catch { /* vaut pour la page */ }
    poserCalme(v);
    window.dispatchEvent(new CustomEvent('tbf-calme', { detail: v }));
  }
  poserCalme(lireCalme());
  // Un réglage changé dans un autre onglet vaut aussi dans celui-ci.
  window.addEventListener('storage', (e) => {
    if (e.key === 'tbf-calme' || e.key === null) poserCalme(lireCalme());
  });

  /* « Doux » réunit les deux raisons de ne pas bouger : celle que le système
     déclare pour tout l'appareil, et celle que le joueur a choisie dans le
     jeu. Les effets de ce fichier n'ont pas à savoir laquelle joue. */
  const doux = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
    || calme('animations');
  const racine = () => document.getElementById('app') ?? document.body;
  /* Une vibration avant le premier toucher du joueur sur la page, Chrome la
     refuse et l'écrit en erreur dans la console (« Blocked call to
     navigator.vibrate ») : un but reçu par le réseau, un vote qui s'ouvre au
     KOP, une fête posée au chargement. Elle ne se serait pas sentie de toute
     façon ; on ne la demande donc qu'une fois la page touchée. Sans l'API qui
     le dit (un navigateur plus ancien), on essaie, comme avant. */
  const buzz = (p) => {
    if (calme('vibrations')) return;
    if (navigator.userActivation?.hasBeenActive === false) return;
    try { navigator.vibrate?.(p); } catch {}
  };

  const COULEURS = {
    or: '#F5C33B', feu: '#E0402C', vert: '#1E9E6A',
    bleu: '#3C82E8', violet: '#8257DA', craie: '#F2EEE4',
  };

  /* **L'or ne s'écrit plus qu'en grand** (arbitrage tranché par Gaël le
     2 octobre 2026) : 24 px, ou 18,66 px en gras. Sur la plaque sombre d'un
     titre, il tient 11:1 à l'intérieur mais 3,5:1 au soleil — assez pour un
     grand texte (3:1), pas pour un petit (4,5:1). L'or reste une face (le
     bandeau, le carton jaune, le point qui vole) et la couleur des grands
     chiffres ; le petit texte d'un effet s'écrit à la craie (le sous-titre,
     le mot sous un gain : voir la feuille plus bas).

     Les titres et les nombres prennent la couleur que l'appelant leur donne.
     Un appelant qui demande de l'or sous 24 px reçoit donc du gras, et jamais
     moins de 19 px : la règle tient ici, et la prochaine page n'a pas à la
     connaître. Les deux écritures de l'or que les pages passent sont
     reconnues — la palette d'ici et la variable de ui.css. */
  const DORES = new Set([COULEURS.or.toLowerCase(), 'var(--projo)']);
  const dore = (c) => DORES.has(String(c ?? '').replace(/\s+/g, '').toLowerCase());

  /**
   * Une couleur de club, rendue lisible sur le fond sombre du jeu.
   *
   * Les couleurs viennent des blasons, et les blasons sont faits pour du
   * papier blanc : le bleu marine d'un club, écrit sur le noir de l'écran, ne
   * se lit pas du tout. On l'éclaircit jusqu'à un plancher de clarté, en
   * gardant sa teinte — c'est encore la couleur du club, simplement portée
   * par un tissu plus clair.
   *
   * Le gris très désaturé, lui, remonte vers la craie plutôt que vers un gris
   * moyen : un club noir et blanc doit écrire en blanc, pas en gris de pluie.
   *
   * @param {string} hex  « #RRGGBB », tel que le serveur l'envoie.
   * @param {number} [plancher] clarté minimale, de 0 à 1.
   * @returns {string} la couleur éclaircie, ou l'entrée telle quelle si elle
   *   n'est pas lisible comme une couleur — on ne devine pas.
   */
  function lisible(hex, plancher = 0.56) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex ?? '').trim());
    if (!m) return hex;
    const n = parseInt(m[1], 16);
    let [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 510;
    if (l >= plancher) return `#${m[1].toUpperCase()}`;
    // Un mélange vers le blanc plutôt qu'une multiplication : il préserve la
    // teinte, là où monter chaque canal du même facteur vire au délavé.
    const part = Math.min(0.86, (plancher - l) / Math.max(0.08, 1 - l));
    [r, g, b] = [r, g, b].map((v) => Math.round(v + (255 - v) * part));
    return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
  }

  /* ------------------------------------------------------------- styles */

  const css = `
  .fx-layer{position:fixed;inset:0;pointer-events:none;z-index:90;overflow:hidden}
  .fx-p{position:absolute;border-radius:50%;will-change:transform,opacity}
  .fx-flash{position:fixed;inset:0;pointer-events:none;z-index:91;opacity:0}
  .fx-flash.go{animation:fxflash .5s ease-out}
  @keyframes fxflash{0%{opacity:.85}100%{opacity:0}}
  /* ------------------------------------------------- l'évolution

     Elle ne se voyait pas. On confirmait, la fiche se rechargeait, et le
     nouveau personnage était simplement **là** — sans qu'on ait vu l'ancien
     partir, ni compris qu'on venait de dépenser quatre-vingt-dix écharpes.
     C'est le seul achat du jeu qui se paie en monnaie durement gagnée, et
     c'était le seul geste sans récompense à l'écran.

     Deux temps, et c'est tout ce qu'il faut : l'ancien **se charge** — il
     grandit, il blanchit, il vibre —, puis le nouveau **arrive**, d'un coup,
     depuis le blanc. Entre les deux, le flash cache la substitution : c'est
     lui qui fait croire à une transformation plutôt qu'à un remplacement.

     La propriété will-change est posée sur les deux : la charge dure une
     seconde entière sur une image de six cents pixels, et sans elle le
     mouvement saccade sur un téléphone. */
  .fx-charge{animation:fxcharge 1s cubic-bezier(.5,0,.8,.3) forwards;
    transform-origin:50% 60%;will-change:transform,filter}
  @keyframes fxcharge{
    0%{transform:scale(1);filter:brightness(1)}
    55%{transform:scale(1.06) translateY(-4px);filter:brightness(1.5) saturate(.7)}
    78%{transform:scale(1.03) translateY(-2px);filter:brightness(2.4) saturate(.3)}
    100%{transform:scale(1.14) translateY(-8px);filter:brightness(6) saturate(0)}}
  .fx-arrive{animation:fxarrive .72s cubic-bezier(.2,1.5,.4,1) backwards;
    transform-origin:50% 60%;will-change:transform,filter}
  @keyframes fxarrive{
    0%{transform:scale(1.2);filter:brightness(5) saturate(0);opacity:.2}
    40%{filter:brightness(1.8) saturate(.8);opacity:1}
    100%{transform:scale(1);filter:brightness(1)}}
  .fx-shake{animation:fxshake .62s cubic-bezier(.36,.07,.19,.97)}
  @keyframes fxshake{0%,100%{transform:translate(0,0)}
    12%{transform:translate(-8px,4px)}28%{transform:translate(7px,-6px)}
    46%{transform:translate(-6px,-3px)}64%{transform:translate(5px,4px)}
    82%{transform:translate(-3px,2px)}}
  /* L'annonce brève du duel : « RELÈVE », « RENVOI », « CHANTE MAINTENANT ».
     Elle porte **une plaque** et non plus une simple ombre portée. Le lettrage
     nu ne tenait pas au-dessus d'une corde en mouvement, d'un personnage et
     d'une photo de stade : il y a toujours un fond qui gagne.
     Plus légère que la case du moment fort — celle-ci passe en une seconde et
     demie pendant qu'on tape, elle ne doit pas masquer le geste. */
  .fx-titre{position:fixed;left:50%;top:38%;transform:translate(-50%,-50%);z-index:93;
    font-family:"Oswald","Arial Narrow",Impact,sans-serif;letter-spacing:.08em;text-align:center;
    pointer-events:none;opacity:0;white-space:nowrap;
    padding:11px 22px;border-radius:4px;border:2px solid rgba(4,7,11,.9);
    background:linear-gradient(178deg,rgba(18,23,31,.94),rgba(8,11,15,.94));
    box-shadow:0 0 0 1.5px currentColor,0 16px 40px rgba(0,0,0,.72);
    text-shadow:0 3px 0 rgba(4,7,11,.85);max-width:calc(100vw - 32px);
    overflow:hidden;text-overflow:ellipsis}
  .fx-titre.go{animation:fxtitre 1.7s cubic-bezier(.2,.9,.3,1)}
  @keyframes fxtitre{0%{opacity:0;transform:translate(-50%,-50%) scale(.55)}
    16%{opacity:1;transform:translate(-50%,-50%) scale(1.08)}
    26%{transform:translate(-50%,-50%) scale(1)}
    78%{opacity:1}100%{opacity:0;transform:translate(-50%,-62%) scale(.98)}}
  /* Le sous-titre se lit, il ne se devine pas : il dit le score ou le
     buteur. **À la craie pleine, quelle que soit la couleur du titre**
     (arbitrage du 2 octobre 2026 : le petit texte en or passe en craie) : il
     héritait de la couleur du titre, donc de l'or dans douze pixels — 3,5:1
     au soleil sur la plaque, quand un petit texte en demande 4,5. La craie
     pleine y tient 15,7:1 à l'intérieur, et à 0,9 elle perdait un demi-point
     au soleil, comme la ligne du buteur de la case de BD. L'accent du camp
     reste au titre et au liseré de la plaque ; le sous-titre le garde par la
     graisse. */
  .fx-sous{display:block;font-family:ui-sans-serif,system-ui,sans-serif;font-size:12px;
    letter-spacing:.18em;margin-top:9px;font-weight:600;color:#F2EEE4}
  .fx-nombre{position:fixed;z-index:92;font-family:"Oswald","Arial Narrow",Impact,sans-serif;
    font-size:22px;pointer-events:none;text-shadow:0 3px 14px rgba(0,0,0,.9)}
  /* Le gain qu'on vient de faire soi-même. Le halo double l'ombre portée : le
     nombre passe par-dessus une corde qui bouge et une foule qui s'anime, et
     une ombre seule ne l'en détache pas. Le halo est posé sur le nombre et
     non sur le bloc : sous le mot, passé à la craie, une lueur dorée
     éclaircirait le fond derrière une lettre claire. */
  .fx-points{position:fixed;z-index:93;pointer-events:none;text-align:center}
  .fx-points b{display:block;font-family:"Oswald","Arial Narrow",Impact,sans-serif;
    font-size:46px;line-height:1;font-weight:700;text-shadow:0 4px 18px rgba(0,0,0,.95);
    filter:drop-shadow(0 0 16px currentColor)}
  /* Onze pixels : le plancher du socle pour un texte qui informe, et ce mot
     dit de quoi est fait le gain. **À la craie pleine** (arbitrage du
     2 octobre 2026) : il prenait la couleur du gain, de l'or dans onze
     pixels, et l'or ne s'écrit plus qu'en grand. La couleur reste au nombre,
     quarante-six pixels gras ; le mot garde l'accent par la graisse. */
  .fx-points span{display:block;font-family:ui-sans-serif,system-ui,sans-serif;font-size:11px;
    letter-spacing:.22em;font-weight:700;margin-top:3px;color:#F2EEE4;
    text-shadow:0 2px 8px rgba(0,0,0,.95)}
  .fx-onde{position:fixed;border-radius:50%;pointer-events:none;z-index:89;border:2px solid;
    opacity:0}
  .fx-onde.go{animation:fxonde .85s cubic-bezier(.15,.7,.3,1)}
  @keyframes fxonde{0%{opacity:.9;transform:translate(-50%,-50%) scale(.15)}
    100%{opacity:0;transform:translate(-50%,-50%) scale(1)}}
  .fx-carton{position:fixed;left:50%;top:42%;width:74px;height:104px;border-radius:6px;z-index:93;
    transform:translate(-50%,-50%) rotate(-14deg);pointer-events:none;opacity:0;
    box-shadow:0 14px 44px rgba(0,0,0,.7)}
  .fx-carton.go{animation:fxcarton 1.5s cubic-bezier(.2,.9,.3,1)}
  @keyframes fxcarton{0%{opacity:0;transform:translate(-50%,20%) rotate(-40deg) scale(.5)}
    18%{opacity:1;transform:translate(-50%,-50%) rotate(-14deg) scale(1.06)}
    28%{transform:translate(-50%,-50%) rotate(-14deg) scale(1)}
    76%{opacity:1}100%{opacity:0;transform:translate(-50%,-70%) rotate(-8deg)}}
  .fx-bandeau{position:fixed;left:0;right:0;top:0;z-index:93;padding:11px 16px;text-align:center;
    font-family:"Oswald","Arial Narrow",Impact,sans-serif;font-size:13px;letter-spacing:.16em;
    color:#0B0E13;transform:translateY(-100%);pointer-events:none}
  .fx-bandeau.go{animation:fxbandeau 3s cubic-bezier(.2,.9,.3,1)}
  @keyframes fxbandeau{0%{transform:translateY(-100%)}10%{transform:translateY(0)}
    88%{transform:translateY(0)}100%{transform:translateY(-100%)}}
  /* Le gain qui vole vers son compteur : une image ou un texte, posé au
     centre de sa source. Le centrage passe par la propriété translate, pas
     par transform : c'est transform que l'animation réécrit, et elle y porte
     le trajet en pixels. */
  .fx-vol{position:fixed;left:0;top:0;z-index:94;pointer-events:none;translate:-50% -50%;
    will-change:transform,opacity}
  img.fx-vol{width:44px;height:44px;object-fit:contain;
    filter:drop-shadow(0 4px 10px rgba(0,0,0,.7))}
  /* Vingt pixels en gras : un grand texte (18,66 px gras au moins), le seul
     où l'or s'écrit encore. Qui l'amincit ou le rapetisse le passe en craie. */
  div.fx-vol{font-family:"Oswald","Arial Narrow",Impact,sans-serif;font-size:20px;font-weight:700;
    line-height:1;white-space:nowrap;color:#F5C33B;text-shadow:0 2px 10px rgba(0,0,0,.95)}
  div.fx-vol:empty{width:14px;height:14px;border-radius:50%;background:#F5C33B;
    box-shadow:0 0 12px rgba(245,195,59,.8)}
  /* Un confetti de papier : six pixels sur dix, un coin à peine arrondi, et
     l'ombre d'encre des confettis du moment fort de ui.css. */
  .fx-papier{position:absolute;width:6px;height:10px;margin:-5px 0 0 -3px;border-radius:1px;
    box-shadow:1px 1px 0 rgba(7,9,12,.45);pointer-events:none;will-change:transform,opacity}

  /* ------------------------------------------------- la cérémonie

     Le calque où se joue « FX.reveler », posé sur le document : au-dessus du
     moment fort (95), sous la boîte de confirmation (160) et sous la fête de
     niveau (170). Un calque de page qui veut sa cérémonie par-dessus lui
     reste donc sous 96. Il ne prend jamais le doigt.

     Rien de ce qui suit ne se pose sur l'objet révélé lui-même : la page en
     reste maîtresse — sa classe, ses enfants, sa rotation. La boîte qui suit
     l'objet (« .fx-rev ») est réécrite par le script à chaque image, à sa
     place et à sa taille ; elle ne s'anime jamais elle-même. */
  .fx-ceremonie{position:fixed;inset:0;z-index:96;pointer-events:none;overflow:hidden}
  .fx-rev{position:absolute;left:0;top:0;width:0;height:0}
  /* Le liseré : un anneau de la couleur de la rareté qui s'allume et
     s'éteint autour de l'objet. C'est une information et non un décor : il
     reste sans mouvement, en fondu sur place (voir plus bas). */
  .fx-rev-lisere{position:absolute;inset:-4px;border-radius:inherit;opacity:0;
    box-shadow:0 0 0 3px var(--fx-rar),0 0 22px 3px var(--fx-rar);
    animation:fxlisere 600ms ease-out var(--fx-d,0ms) both}
  @keyframes fxlisere{0%{opacity:0}22%{opacity:1}100%{opacity:0}}
  /* Rare : le balayage plastifié. Un reflet de craie traverse l'objet une
     fois, de gauche à droite, en 400 ms. Épique : la nappe holographique,
     plus large et plus lente, 700 ms, aux couleurs de la feuille épique
     (violet, bleu, craie). Le reflet est un pseudo-élément qui se déplace par
     transform : jamais un dégradé animé (amendement 9). */
  .fx-rev-plastique,.fx-rev-nappe{position:absolute;inset:0;overflow:hidden;border-radius:inherit}
  .fx-rev-plastique::before,.fx-rev-nappe::before{content:"";position:absolute;
    top:-30%;bottom:-30%;left:0;transform:translateX(-120%) skewX(-16deg)}
  .fx-rev-plastique::before{width:50%;
    background:linear-gradient(90deg,transparent,rgba(242,238,228,.16) 30%,
      rgba(255,255,255,.74) 50%,rgba(242,238,228,.16) 70%,transparent);
    animation:fxbalaye 400ms cubic-bezier(.45,.05,.3,1) var(--fx-d,0ms) both}
  .fx-rev-nappe::before{width:80%;
    background:linear-gradient(90deg,transparent,rgba(185,140,255,.46) 22%,
      rgba(95,168,255,.42) 40%,rgba(242,238,228,.62) 52%,rgba(185,140,255,.46) 70%,transparent);
    animation:fxbalaye 700ms cubic-bezier(.4,.1,.3,1) var(--fx-d,0ms) both}
  @keyframes fxbalaye{from{transform:translateX(-120%) skewX(-16deg)}
    to{transform:translateX(220%) skewX(-16deg)}}
  /* La bouffée violette de l'épique, autour de l'objet et jamais dessus :
     une ombre portée hors de la boîte ne se peint pas sous elle. */
  .fx-rev-halo{position:absolute;inset:0;border-radius:inherit;opacity:0;
    box-shadow:0 0 30px 12px rgba(185,140,255,.7),0 0 72px 30px rgba(130,87,218,.42);
    animation:fxhalo 700ms ease-out var(--fx-d,0ms) both}
  @keyframes fxhalo{0%{opacity:0;scale:.94}30%{opacity:1;scale:1.03}100%{opacity:0;scale:1.08}}
  /* Légendaire : le flash d'or pâle, 200 ms, sur tout l'écran. En avant
     seulement : avant son départ il est invisible, et non posé à sa première
     image (la cérémonie peut attendre la fin d'un retournement). */
  .fx-rev-flash{position:absolute;inset:0;background:#FFF3D0;opacity:0;
    animation:fxrevflash 200ms ease-out var(--fx-d,0ms) forwards}
  @keyframes fxrevflash{0%{opacity:.88}100%{opacity:0}}
  /* Les rayons au pochoir de la case de BD, d'or, qui partent de derrière
     l'objet et tournent un peu en s'ouvrant. Le masque évide la place de
     l'objet : les rayons l'entourent, ils ne le rayent pas. Le porteur du
     masque ne tourne pas — c'est son pseudo-élément qui tourne —, sans quoi
     le trou tournerait avec lui. */
  .fx-rev-rayons{position:absolute;left:50%;top:50%;width:var(--fx-s,320px);height:var(--fx-s,320px);
    translate:-50% -50%;
    -webkit-mask:radial-gradient(closest-side,#000 30%,transparent 80%) center/100% 100% no-repeat,
      linear-gradient(#000,#000) center/var(--fx-w,0px) var(--fx-h,0px) no-repeat;
    -webkit-mask-composite:source-out;
    mask:radial-gradient(closest-side,#000 30%,transparent 80%) center/100% 100% no-repeat subtract,
      linear-gradient(#000,#000) center/var(--fx-w,0px) var(--fx-h,0px) no-repeat}
  .fx-rev-rayons::before{content:"";position:absolute;inset:-21%;opacity:0;
    background:repeating-conic-gradient(from 0deg at 50% 50%,
      #F5C33B 0 5deg,transparent 5deg 12deg,#F5C33B 12deg 15deg,transparent 15deg 24deg);
    animation:fxrayons 1500ms cubic-bezier(.2,.7,.3,1) var(--fx-d,0ms) forwards}
  @keyframes fxrayons{0%{opacity:0;transform:rotate(-10deg) scale(.55)}
    16%{opacity:.62}70%{opacity:.5}100%{opacity:0;transform:rotate(16deg) scale(1)}}
  /* Le tampon « LÉGENDAIRE » : la brique de ui.css en contour d'or, en grand
     (26 px en 700 : un grand texte, le seul où l'or s'écrit), sur une plaque
     d'encre — il tombe sur une illustration, et rien ne garantit qu'elle soit
     sombre. Il claque avec « .tbf-clac » de ui.css, cent quatre-vingts
     millisecondes après le flash ; son porteur le retire en fondu à la fin. */
  .fx-rev-sceau{position:absolute;left:50%;top:34%;z-index:2;translate:-50% -50%;
    animation:fxsceau var(--fx-t,1500ms) linear var(--fx-d,0ms) both}
  .fx-rev-sceau .tbf-tampon{font-size:26px;background:rgba(7,9,12,.86);
    --d:calc(var(--fx-d,0ms) + 180ms)}
  @keyframes fxsceau{0%,86%{opacity:1}100%{opacity:0}}

  /* Sans mouvement : la préférence du système, ou le mode calme du joueur
     (html[data-calme~="animations"], posé par ce fichier et par menu.js). Les
     deux listes sont identiques, et doivent le rester.

     Le mouvement part, l'information reste. Le titre, le bandeau, le carton et
     l'évolution disent quelque chose — un but, une minute double, un rouge, un
     Fanzzy qui a grandi : ils apparaissent et s'effacent en fondu, sur place.
     La secousse et la respiration ne disent rien : elles s'arrêtent.

     La cérémonie garde son liseré et son tampon, en fondu sur place : ils
     disent la rareté. Le reflet, la nappe, la bouffée, le flash et les rayons
     ne disent rien que la forme, la couleur et le mot ne disent déjà ; ils
     partent. Le script ne les pose même pas (voir « reveler ») : ces règles-ci
     tiennent pour un réglage changé pendant qu'une cérémonie se joue. */
  @keyframes fxdoux{0%{opacity:0}12%{opacity:1}80%{opacity:1}100%{opacity:0}}
  @keyframes fxbandeaudoux{0%{transform:none;opacity:0}8%{opacity:1}
    90%{opacity:1}100%{transform:none;opacity:0}}
  @keyframes fxchargedoux{to{opacity:.3}}
  @keyframes fxarrivedoux{from{opacity:0}}
  @media (prefers-reduced-motion:reduce){
    .fx-shake{animation:none}
    .fx-titre.go{animation:fxdoux 1.6s ease}
    .fx-carton.go{animation:fxdoux 1.5s ease}
    .fx-bandeau.go{animation:fxbandeaudoux 3s ease}
    .fx-charge{animation:fxchargedoux 1s ease forwards}
    .fx-arrive{animation:fxarrivedoux .5s ease backwards}
    .fx-rev-plastique,.fx-rev-nappe,.fx-rev-halo,.fx-rev-flash,.fx-rev-rayons{display:none}
  }
  html[data-calme~="animations"] .fx-shake{animation:none}
  html[data-calme~="animations"] .fx-titre.go{animation:fxdoux 1.6s ease}
  html[data-calme~="animations"] .fx-carton.go{animation:fxdoux 1.5s ease}
  html[data-calme~="animations"] .fx-bandeau.go{animation:fxbandeaudoux 3s ease}
  html[data-calme~="animations"] .fx-charge{animation:fxchargedoux 1s ease forwards}
  html[data-calme~="animations"] .fx-arrive{animation:fxarrivedoux .5s ease backwards}
  html[data-calme~="animations"] .fx-rev-plastique,html[data-calme~="animations"] .fx-rev-nappe,
  html[data-calme~="animations"] .fx-rev-halo,html[data-calme~="animations"] .fx-rev-flash,
  html[data-calme~="animations"] .fx-rev-rayons{display:none}`;

  /* ------------------------------------------------- personnages vivants
     Un Fanzzy figé sur une carte a l'air d'un autocollant. Trois animations
     décalées et lentes suffisent à le rendre vivant : la respiration, un
     léger balancement, et une réaction quand on le touche.

     Pourquoi pas une vidéo par personnage ? Vingt-sept Fanzzy, ce serait
     vingt-sept fichiers de plusieurs centaines de kilo-octets à charger dans
     une grille. Ici, c'est zéro octet, ça marche sur les vingt-sept d'un coup,
     et sur ceux qu'on ajoutera. Les jeux mobiles font exactement ça pour leurs
     personnages en deux dimensions.                                        */
  const cssVie = `
  .fz-vivant{transform-origin:50% 100%;will-change:transform;
    animation:fzsouffle var(--fz-duree,3.4s) ease-in-out infinite,
              fzbalance calc(var(--fz-duree,3.4s) * 2.3) ease-in-out infinite;
    animation-delay:var(--fz-retard,0s),calc(var(--fz-retard,0s) * 1.7)}
  @keyframes fzsouffle{0%,100%{transform:scaleY(1) scaleX(1) translateY(0)}
    50%{transform:scaleY(1.018) scaleX(.993) translateY(-1.5%)}}
  @keyframes fzbalance{0%,100%{rotate:-.7deg}50%{rotate:.7deg}}
  .fz-vivant.fz-reagit{animation:fzsaute .55s cubic-bezier(.25,.9,.3,1)}
  @keyframes fzsaute{0%{transform:scale(1) translateY(0)}
    22%{transform:scale(1.06,.94) translateY(0)}
    52%{transform:scale(.96,1.07) translateY(-9%)}
    78%{transform:scale(1.02,.98) translateY(0)}
    100%{transform:scale(1) translateY(0)}}
  @media (prefers-reduced-motion:reduce){
    .fz-vivant,.fz-vivant.fz-reagit{animation:none}}
  html[data-calme~="animations"] .fz-vivant,
  html[data-calme~="animations"] .fz-vivant.fz-reagit{animation:none}`;

  const style = document.createElement('style');
  style.textContent = css + cssVie;
  document.head.appendChild(style);

  let calque = null;
  const layer = () => {
    if (!calque || !calque.isConnected) {
      calque = document.createElement('div');
      calque.className = 'fx-layer';
      document.body.appendChild(calque);
    }
    return calque;
  };

  /* --------------------------------------------------------- primitives */

  /**
   * Gerbe de particules. Plafonnée : au-delà, on ne voit pas mieux, on rame.
   *
   * **`papier: true`** lance des confettis de papier au lieu des points : des
   * rectangles de 6 × 10 qui tournent, s'écartent puis retombent un peu,
   * chacun avec son ombre d'encre. C'est la fête de la maison (amendement 1 :
   * le kop n'a pas de peinture, il a du papier), et la même matière que les
   * confettis du moment fort de ui.css. Quatre-vingt-dix au plus.
   *
   * **`dans`** pose la gerbe dans un autre conteneur que le calque commun :
   * le calque de la cérémonie, qui passe au-dessus d'un calque de page, ou
   * une boîte positionnée qui la rogne. `x` et `y` se comptent alors depuis
   * le coin de ce conteneur.
   */
  function particules({ x, y, n = 24, couleurs = [COULEURS.or, COULEURS.feu],
                        distance = 150, taille = 5, duree = 900,
                        papier = false, dans = null } = {}) {
    if (doux()) return;
    const l = dans ?? layer();
    if (papier) { confettis(l, { x, y, n, couleurs, distance, duree }); return; }
    const total = Math.min(n, 120);
    for (let i = 0; i < total; i++) {
      const p = document.createElement('div');
      p.className = 'fx-p';
      const s = taille * (0.5 + Math.random());
      p.style.cssText = `left:${x}px;top:${y}px;width:${s}px;height:${s}px;` +
        `background:${couleurs[i % couleurs.length]}`;
      l.appendChild(p);
      const a = Math.random() * Math.PI * 2;
      const d = distance * (0.35 + Math.random() * 0.85);
      p.animate([
        { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
        { transform: `translate(${Math.cos(a) * d - 50}%,${Math.sin(a) * d + d * 0.35 - 50}%) scale(0)`,
          opacity: 0 },
      ], { duration: duree * (0.7 + Math.random() * 0.6),
           easing: 'cubic-bezier(.15,.7,.3,1)' }).onfinish = () => p.remove();
    }
  }

  /* Les confettis de papier (voir « particules »). Le trajet est écrit en
     pixels et le centrage par une marge négative : la transformation ne
     porte que le vol, la rotation et la retombée. Chaque morceau a un filet
     qui le retire, comme le reste de ce fichier : un onglet caché ne finit
     pas ses animations, et un confetti oublié resterait collé à l'écran. */
  function confettis(l, { x, y, n, couleurs, distance, duree }) {
    const total = Math.min(n, 90);
    for (let i = 0; i < total; i++) {
      const p = document.createElement('i');
      p.className = 'fx-papier';
      p.style.cssText = `left:${x}px;top:${y}px;background:${couleurs[i % couleurs.length]}`;
      l.appendChild(p);
      const a = Math.random() * Math.PI * 2;
      const d = distance * (0.45 + Math.random() * 0.75);
      const dx = Math.cos(a) * d;
      const dy = Math.sin(a) * d;
      const r0 = Math.random() * 360;
      const tour = (Math.random() < 0.5 ? -1 : 1) * (160 + Math.random() * 320);
      const ms = duree * (0.75 + Math.random() * 0.5);
      const filet = setTimeout(() => p.remove(), ms + 200);
      try {
        p.animate([
          { transform: `translate(0,0) rotate(${r0}deg) scale(.5)`, opacity: 1 },
          { transform: `translate(${dx * 0.75}px,${dy * 0.75}px) rotate(${r0 + tour * 0.5}deg) scale(1)`,
            opacity: 1, offset: 0.4 },
          // La retombée : un morceau de papier ne s'envole pas, il plane et tombe.
          { transform: `translate(${dx}px,${dy + d * 0.5}px) rotate(${r0 + tour}deg) scale(.9)`,
            opacity: 0 },
        ], { duration: ms, easing: 'cubic-bezier(.2,.75,.35,1)' })
          .onfinish = () => { clearTimeout(filet); p.remove(); };
      } catch { clearTimeout(filet); p.remove(); }
    }
  }

  function onde({ x, y, couleur = COULEURS.or, taille = 420 } = {}) {
    if (doux()) return;
    const o = document.createElement('div');
    o.className = 'fx-onde';
    o.style.cssText = `left:${x}px;top:${y}px;width:${taille}px;height:${taille}px;` +
      `border-color:${couleur}`;
    document.body.appendChild(o);
    requestAnimationFrame(() => o.classList.add('go'));
    setTimeout(() => o.remove(), 900);
  }

  function flash(couleur = '#fff') {
    if (doux()) return;
    const f = document.createElement('div');
    f.className = 'fx-flash';
    f.style.background = couleur;
    document.body.appendChild(f);
    requestAnimationFrame(() => f.classList.add('go'));
    setTimeout(() => f.remove(), 560);
  }

  function secousse(force = 1) {
    if (doux()) return;
    const el = racine();
    el.classList.remove('fx-shake');
    void el.offsetWidth;
    el.style.setProperty('--fx-force', String(force));
    el.classList.add('fx-shake');
    setTimeout(() => el.classList.remove('fx-shake'), 660);
  }

  function titre(texte, sous, couleur = COULEURS.craie, taille = 44) {
    const t = document.createElement('div');
    t.className = 'fx-titre';
    t.style.color = couleur;
    // L'or sous 24 px ne reste un grand texte qu'en gras (voir « dore »).
    const petitOr = dore(couleur) && taille < 24;
    t.style.fontSize = `${petitOr ? Math.max(taille, 19) : taille}px`;
    if (petitOr) t.style.fontWeight = '700';
    t.innerHTML = `${texte}${sous ? `<span class="fx-sous">${sous}</span>` : ''}`;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('go'));
    setTimeout(() => t.remove(), 1800);
  }

  /** Nombre qui s'envole depuis un point. Sert aux poussées et aux gains. */
  function nombre(valeur, { x, y, couleur = COULEURS.or, signe = true } = {}) {
    const n = document.createElement('div');
    n.className = 'fx-nombre';
    n.style.cssText = `left:${x}px;top:${y}px;color:${couleur}`;
    /* Vingt-deux pixels : en or, ce n'est un grand texte qu'en gras (voir
       « dore »). La poussée d'en face, en bleu ou en gris, garde sa graisse :
       elle doit se voir sans prendre l'écran. */
    if (dore(couleur)) n.style.fontWeight = '700';
    n.textContent = (signe && valeur > 0 ? '+' : '') + valeur;
    document.body.appendChild(n);
    /* Sans mouvement, le nombre reste : c'est une information. Il apparaît
       sur place et s'efface, au lieu de monter. */
    const images = doux() ? [
      { transform: 'translate(-50%,-50%)', opacity: 0 },
      { transform: 'translate(-50%,-50%)', opacity: 1, offset: .2 },
      { transform: 'translate(-50%,-50%)', opacity: 1, offset: .75 },
      { transform: 'translate(-50%,-50%)', opacity: 0 },
    ] : [
      { transform: 'translate(-50%,-50%) scale(.7)', opacity: 0 },
      { transform: 'translate(-50%,-90%) scale(1.1)', opacity: 1, offset: .25 },
      { transform: 'translate(-50%,-180%) scale(1)', opacity: 0 },
    ];
    n.animate(images, { duration: 1100, easing: 'cubic-bezier(.2,.8,.3,1)' })
      .onfinish = () => n.remove();
  }

  const centre = (el) => {
    const r = el?.getBoundingClientRect?.();
    return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 }
             : { x: innerWidth / 2, y: innerHeight / 2 };
  };

  /* ------------------------------------------------------- effets de jeu */

  /**
   * Rend vivant tout personnage déjà présent dans la page.
   *
   * Les durées et les retards sont dérivés d'une graine stable — l'identifiant
   * du Fanzzy — pour que deux cartes voisines ne respirent jamais en même
   * temps. Une grille synchronisée fait mécanique ; décalée, elle fait foule.
   */
  function animer(racineEl = document) {
    const cibles = racineEl.querySelectorAll?.('.illu, [data-vivant]') ?? [];
    for (const el of cibles) {
      if (el.classList.contains('fz-vivant')) continue;
      const graine = (el.getAttribute('data-vivant') || el.src || '')
        .split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 9973, 7);
      el.style.setProperty('--fz-duree', `${3 + (graine % 17) / 10}s`);
      el.style.setProperty('--fz-retard', `-${(graine % 31) / 10}s`);
      el.classList.add('fz-vivant');
    }
  }

  /** Réaction au toucher : le personnage sursaute, comme s'il répondait. */
  function reagir(el) {
    if (!el || doux()) return;
    el.classList.remove('fz-reagit');
    void el.offsetWidth;
    el.classList.add('fz-reagit');
    setTimeout(() => el.classList.remove('fz-reagit'), 600);
    buzz(10);
  }

  // Les cartes arrivent souvent après le premier rendu — ouverture de booster,
  // filtre du classeur. On surveille plutôt que de demander à chaque page d'y
  // penser.
  if (typeof MutationObserver === 'function') {
    const veilleur = new MutationObserver(() => animer(document));
    const lancer = () => {
      animer(document);
      veilleur.observe(document.body, { childList: true, subtree: true });
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', lancer);
    } else lancer();

    /* Le contexte audio ne s'ouvre plus ici : son.js écoute lui-même le
       premier geste, en capture, avant tout gestionnaire de la page. */
    document.addEventListener('pointerdown', (e) => {
      const p = e.target.closest?.('.fz-vivant');
      if (p) reagir(p);
    }, { passive: true });
  }

  /* ----------------------------------------------------------------- son
     Aucun fichier audio : tout est synthétisé à la volée. Un jeu qui
     télécharge ses sons les joue en retard la première fois — exactement au
     moment où ils comptent. Ici le son part avec l'image.

     **Le son vit dans son.js**, le moteur commun : un seul contexte audio
     pour tout le jeu (il y en avait deux, celui d'ici et celui de
     cartes.js), trois bus, un limiteur, un mixage mesuré, l'ambiance de
     tribune et les chants. La banque qui était ici y est passée, sons et
     noms inchangés, mixés.

     **Ce fichier le charge**, pour que chaque page qui a les effets ait le
     son sans poser de balise de plus. C'est sûr : rien ne sonne avant le
     premier geste du joueur — le moteur ne crée son contexte qu'à ce
     moment-là, comme l'exigent les navigateurs —, et fx.js part en différé,
     après l'analyse de la page, bien avant le premier toucher. Une page qui
     poserait sa propre balise ne le chargerait pas deux fois (le moteur se
     garde, et on regarde ici si la balise est déjà là). S'il manque — le
     réseau, une suite qui n'injecte que ce fichier —, les sons se taisent et
     rien d'autre ne change : aucun son ne porte seul une information.

     `FX.son(nom)` garde son nom et sa signature : il passe la main au
     moteur. Couper le son, c'est toujours calmer la facette « sons » du mode
     calme — le bouton du duel et l'interrupteur du tiroir disent la même
     chose. Le moteur la lit à chaque son, et l'observe pour couper aussi ce
     qui joue déjà, l'ambiance comprise. */
  if (!window.TBF_SON && !document.querySelector('script[src="/son.js"]')) {
    const moteur = document.createElement('script');
    moteur.src = '/son.js';
    (document.head ?? document.documentElement).appendChild(moteur);
  }

  /* Le calme n'est pas regardé ici : le moteur le garde, à un seul endroit
     (deux gardes au même endroit rendent chacune inéprouvable seule). */
  const son = (nom, options) => {
    try { window.TBF_SON?.jouer?.(nom, options); } catch { /* le son ne doit jamais casser le jeu */ }
  };

  /* ------------------------------------------------- compteurs et vols

     Un solde qui change sous les yeux ne doit pas simplement **être**
     différent : il doit changer. Un chiffre qui saute de 120 à 75 se lit
     comme une erreur d'affichage ; un chiffre qui descend se lit comme une
     dépense, et un gain qui arrive de l'endroit où on l'a gagné dit d'où il
     vient. Les pages appellent ces deux fonctions toujours gardées :

       if (window.FX?.compter) FX.compter(el, avant, apres);
       else el.textContent = apres;

     Toutes deux s'effacent sans mouvement — la valeur finale tout de suite,
     aucun vol — sous prefers-reduced-motion et sous le calme « animations ».
     Et toutes deux finissent par une minuterie, jamais par la seule fin d'une
     animation : un onglet caché gèle les animations, et un solde resté à
     mi-chemin serait un solde faux.

     Et une promesse de compter que les pages tiennent pour acquise : **un
     nouvel appel sur le même élément arrête le compte qui y court encore**,
     même quand ce nouvel appel ne compte pas lui-même. C'est ce qui permet à
     une page de poser un chiffre sans défilement, FX.compter(el, v, v), sur
     un compteur peut-être encore en route, sans qu'un compte plus ancien
     vienne le réécrire à sa dernière image — le solde des boosters s'y
     appuie. Qui change compter garde cette règle. */

  const comptes = new WeakMap();   // l'élément → de quoi arrêter son compte en cours
  const eclats = new WeakMap();    // l'élément → la minuterie de son éclat

  /** Le bref éclat de fin de compte. Sa peinture vit dans ui.css. */
  function eclater(el) {
    clearTimeout(eclats.get(el));
    el.classList.remove('tbf-compte');
    void el.offsetWidth;
    el.classList.add('tbf-compte');
    eclats.set(el, setTimeout(() => el.classList.remove('tbf-compte'), 160));
  }

  /**
   * Fait compter un nombre affiché, de sa valeur d'avant à la nouvelle.
   *
   * **Un second appel sur le même élément arrête le premier**, et c'est une
   * règle du contrat, pas un détail : deux boucles qui écrivent le même texte
   * à chaque image se disputeraient le chiffre, et celle qui finirait la
   * dernière écrirait le sien, fût-il périmé. Le compte interrompu pose sa
   * valeur finale sans éclat et sa promesse se résout aussitôt ; le nouvel
   * appel l'écrase dans la foulée, avant toute image. Cela vaut aussi pour un
   * appel qui ne compte pas — de égal à a, valeur qui n'est pas un nombre,
   * mouvement coupé, onglet caché : c'est la façon sûre de poser un chiffre
   * sur un compteur qui court peut-être encore (voir `poserSolde` dans
   * `boosters.html`).
   *
   * @param {Element} el     l'élément dont le texte est le nombre
   * @param {number}  de     la valeur affichée jusqu'ici
   * @param {number}  a      la valeur à atteindre
   * @param {object}  [o]
   * @param {number}  [o.ms=600]  la durée du compte
   * @param {(n:number)=>string} [o.format]  l'écriture d'une valeur
   * @returns {Promise<void>} résolue quand le chiffre final est affiché, ou
   *   dès qu'un appel plus récent sur le même élément l'interrompt
   */
  function compter(el, de, a, { ms = 600, format = (n) => String(Math.round(n)) } = {}) {
    if (!el) return Promise.resolve();
    comptes.get(el)?.();
    el.style.fontVariantNumeric = 'tabular-nums';
    const depart = Number(de);
    const fin = Number(a);
    /* Une valeur qui n'est pas un nombre ne se compte pas : on l'écrit telle
       quelle, et rien ne s'anime sur une donnée qu'on ne comprend pas. */
    if (a === null || a === undefined || a === '' || !Number.isFinite(fin)) {
      el.textContent = a == null ? '' : String(a);
      return Promise.resolve();
    }
    if (!Number.isFinite(depart) || depart === fin || !(ms > 0) || doux() || document.hidden) {
      el.textContent = format(fin);
      return Promise.resolve();
    }
    return new Promise((resoudre) => {
      const t0 = performance.now();
      let image = 0;
      let filet = 0;
      let fini = false;
      const finir = (eclat) => {
        if (fini) return;
        fini = true;
        cancelAnimationFrame(image);
        clearTimeout(filet);
        comptes.delete(el);
        el.textContent = format(fin);
        if (eclat) eclater(el);
        resoudre();
      };
      const pas = (t) => {
        const p = Math.min(1, (t - t0) / ms);
        if (p >= 1) { finir(true); return; }
        // Rapide d'abord, lent à l'arrivée : l'œil lit le chiffre qui se pose.
        const e = 1 - (1 - p) ** 3;
        el.textContent = format(depart + (fin - depart) * e);
        image = requestAnimationFrame(pas);
      };
      // Le filet : si les images ne viennent plus, la valeur finale vient quand même.
      filet = setTimeout(() => finir(true), ms + 250);
      comptes.set(el, () => finir(false));
      el.textContent = format(depart);
      image = requestAnimationFrame(pas);
    });
  }

  /* Le centre d'un élément réellement dessiné. À la différence de « centre »,
     plus haut, il ne se rabat pas sur le milieu de l'écran : un élément absent
     ou replié ne donne pas de point du tout. */
  const centreVisible = (el) => {
    const r = el?.getBoundingClientRect?.();
    return r && (r.width || r.height)
      ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
  };

  /**
   * Fait voler un gain de l'endroit où il est né jusqu'à son compteur.
   *
   * Un nœud posé sur le corps du document — hors de la colonne, qui est un
   * contexte d'empilement (voir ETAT.md) — part du centre de la source et
   * arrive au centre de la cible en 700 ms, puis disparaît. L'appelant fait
   * ensuite compter la cible : le vol dit d'où ça vient, le compte dit combien.
   *
   * Sans source ou sans cible à l'écran, rien ne vole : un gain qui partirait
   * du coin de l'écran mentirait sur son origine.
   *
   * @param {Element} source
   * @param {Element} cible
   * @param {object} [o]
   * @param {string} [o.image]  l'adresse d'une image à faire voler
   * @param {string} [o.texte]  sinon, un texte (« +40 ») ; sinon, un point d'or
   * @returns {Promise<void>} résolue à l'arrivée, tout de suite sans vol
   */
  function voler(source, cible, { image, texte } = {}) {
    const a = centreVisible(source);
    const b = centreVisible(cible);
    if (!a || !b || doux() || document.hidden) return Promise.resolve();
    const n = document.createElement(image ? 'img' : 'div');
    n.className = 'fx-vol';
    if (image) { n.src = image; n.alt = ''; n.decoding = 'async'; }
    else if (texte != null) n.textContent = String(texte);
    n.style.left = `${a.x}px`;
    n.style.top = `${a.y}px`;
    document.body.appendChild(n);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    try {
      n.animate([
        { transform: 'translate(0,0) scale(.7)', opacity: 0 },
        /* Un petit bond au départ, vers le haut : un trajet en ligne droite se
           lit comme un glissement, un trajet qui s'élève comme un envol. */
        { transform: `translate(${dx * 0.12}px,${dy * 0.12 - 34}px) scale(1.15)`,
          opacity: 1, offset: .24 },
        { transform: `translate(${dx}px,${dy}px) scale(.55)`, opacity: .45 },
      ], { duration: 700, easing: 'cubic-bezier(.45,0,.25,1)', fill: 'forwards' });
    } catch {
      // Un navigateur sans animations de script : rien ne vole, rien ne reste.
      n.remove();
      return Promise.resolve();
    }
    return new Promise((resoudre) => {
      setTimeout(() => { n.remove(); resoudre(); }, 700);
    });
  }

  /* ======================================================== la cérémonie

     **Une seule échelle pour tout ce qui se révèle.** L'ouverture d'un
     booster, l'achat à l'étal, demain la collection et l'évolution : chaque
     écran inventait sa fête — `FX.rare` ici, une gerbe, une vidéo et un
     tremblement écrits à la main dans la page là. Une rare n'avait pas le
     même poids d'un écran à l'autre, et le joueur ne pouvait pas apprendre à
     reconnaître une légendaire avant de l'avoir lue. Quatre degrés, qui se
     jouent pareil partout (l'échelle de la Vitrine, greffée par l'amendement
     13, contrat écrit dans le brief des lots 3 et 5) :

       commune     le retournement simple, et rien d'autre ;
       rare        un balayage plastifié de 400 ms et le tic ;
       épique      une nappe holographique de 700 ms, une bouffée violette
                   autour de l'objet, des confettis, le carillon, 14 ms de
                   vibration ;
       légendaire  un flash de 200 ms, les rayons, la secousse, le
                   rugissement, le tampon « LÉGENDAIRE » et la vibration
                   [40, 30, 90].

     Chaque degré au-dessus de la commune allume aussi un liseré de sa couleur
     autour de l'objet.

     **Le calme et le mouvement réduit.** Les sons, les vibrations et les
     animations suivent chacun leur facette du mode calme, comme tout ce
     fichier. Sans mouvement, l'information reste : la rareté se lit par la
     forme, la couleur et le mot — la forme et le mot sont sur l'objet (le
     sticker de rareté que la page y colle), la couleur dans le liseré, qui
     s'allume et s'éteint sur place, et le mot de la légendaire dans son
     tampon, posé sans claquer. */

  const ECHELLE = ['commune', 'rare', 'epique', 'legendaire'];
  /* La couleur de chaque rareté : les jetons « --r-* » de ui.css, avec leur
     valeur en repli pour une page qui ne chargerait pas la feuille. */
  const TEINTE = {
    commune: 'var(--r-commune,#C2CAD6)', rare: 'var(--r-rare,#5FA8FF)',
    epique: 'var(--r-epique,#B98CFF)', legendaire: 'var(--r-legendaire,#F5C33B)',
  };
  /* Ce que dure chaque degré, de son départ à son dernier objet retiré — la
     promesse se résout là. Sans mouvement, il ne reste que le liseré et le
     tampon : plus court, sauf le tampon, qui doit se lire. */
  const DUREE = {
    vif: { rare: 600, epique: 1200, legendaire: 1600 },
    doux: { rare: 600, epique: 600, legendaire: 1400 },
  };
  /** Le retournement simple, quand la cérémonie le fait elle-même. */
  const RETOURNE = 300;
  /** Ce qu'on attend, au plus, la fin du geste que la page a lancé. */
  const ATTENTE_MAX = 900;

  /** Le degré d'une rareté telle que les pages l'ont en main. */
  function degre(rarete) {
    const r = String(rarete ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .trim().toLowerCase();
    if (r === 'crown') return 'legendaire';   // le nom que lisait FX.rare
    return ECHELLE.includes(r) ? r : 'commune';
  }

  let estradeEl = null;
  /** Le calque de la cérémonie (« .fx-ceremonie »), créé à la première. */
  const estrade = () => {
    if (!estradeEl || !estradeEl.isConnected) {
      estradeEl = document.createElement('div');
      estradeEl.className = 'fx-ceremonie';
      estradeEl.setAttribute('aria-hidden', 'true');
      document.body.appendChild(estradeEl);
    }
    return estradeEl;
  };

  /** La boîte d'un élément à l'écran, ou rien s'il n'y occupe aucune place. */
  const boite = (el) => {
    const r = el?.isConnected ? el.getBoundingClientRect?.() : null;
    return r && r.width > 0 && r.height > 0 ? r : null;
  };

  /* **Parti** n'est pas **plat**. Un objet a quitté l'écran quand il n'est
     plus dans le document, ou qu'il n'y a plus de boîte du tout
     (« display:none » sur lui ou sur un parent : aucun rectangle). Un objet
     de largeur nulle est encore là : c'est la première image du
     retournement, où la propriété « scale » le tient à « 0 1 ». Les
     confondre arrêtait toute cérémonie avec « retourner » à sa première
     image, sans rien jouer (mesuré au banc de la boutique : une légendaire
     résolue en 52 ms au lieu de 1 900). */
  const parti = (el) => !el?.isConnected || !el.getClientRects?.().length;

  /* L'arrondi de l'objet, pour que le reflet ne déborde pas de ses coins. Une
     carte est souvent enveloppée : la page passe le porteur (la carte qui se
     retourne), et l'arrondi est sur la face, deux étages plus bas. On descend
     donc par le premier enfant tant qu'il a la taille de l'objet. */
  function arrondi(el) {
    const ref = el.getBoundingClientRect();
    let n = el;
    for (let i = 0; i < 4 && n; i++) {
      const cs = getComputedStyle(n);
      if (parseFloat(cs.borderTopLeftRadius) > 0) return cs.borderRadius;
      n = n.firstElementChild;
      const r = n?.getBoundingClientRect?.();
      if (!r || Math.abs(r.width - ref.width) > 3 || Math.abs(r.height - ref.height) > 3) break;
    }
    return '0px';
  }

  /* **La cérémonie attend que la page ait fini son geste.** La carte du
     booster se retourne seule, en une demi-seconde, et la page appelle
     FX.reveler dans la foulée du retournement : un reflet posé tout de suite
     balaierait une carte encore vue de profil. On attend donc la fin des
     animations finies qui courent sur l'objet et dans ses enfants — une
     transition, une entrée —, jamais celle d'une animation sans fin (la
     respiration d'un personnage), et jamais plus de neuf cents
     millisecondes. « getAnimations » remet le style à jour avant de
     répondre : la transition que la page vient de déclencher en posant sa
     classe est déjà comptée. */
  function attendrePose(el) {
    let enCours = [];
    try {
      enCours = (el?.getAnimations?.({ subtree: true }) ?? []).filter((a) => {
        const t = a.effect?.getComputedTiming?.();
        return a.playState === 'running' && t && Number.isFinite(t.endTime);
      });
    } catch { /* un navigateur sans getAnimations : on n'attend pas */ }
    if (!enCours.length) return Promise.resolve();
    return Promise.race([
      Promise.all(enCours.map((a) => a.finished.catch(() => {}))),
      new Promise((r) => setTimeout(r, ATTENTE_MAX)),
    ]);
  }

  /**
   * Révèle un objet selon sa rareté : la cérémonie commune.
   *
   * Voir l'échelle juste au-dessus. Elle se joue **sur un calque à elle**
   * (« .fx-ceremonie », z 96, sur le document) qui suit l'objet image après
   * image : rien n'est posé dans l'objet ni dans son conteneur, qu'une page
   * peut réécrire à tout moment. Si l'objet quitte l'écran en cours de route
   * — la page a tout révélé d'un coup, ou redessiné sa grille —, la cérémonie
   * s'arrête avec lui et la promesse se résout.
   *
   * @param {string}  rarete  « commune », « rare », « epique » ou
   *   « legendaire » (les accents sont admis) ; tout autre nom vaut commune
   * @param {Element} [el]    l'objet révélé, à l'écran : la carte qu'on vient
   *   de retourner, l'objet acheté posé au centre. Sans lui, ce qui se passe
   *   autour d'un objet (liseré, reflet, nappe, confettis) ne se joue pas ; le
   *   tampon et les rayons se posent au milieu de l'écran.
   * @param {object}  [o]
   * @param {boolean} [o.son=true]  « false » : la page joue ses propres sons,
   *   la cérémonie se tait (les vibrations restent)
   * @param {boolean} [o.retourner=false]  « true » : la cérémonie retourne
   *   l'objet elle-même avant le reste — pour un objet qui n'a pas de
   *   retournement à lui (l'objet de l'étal). La carte du booster a le sien :
   *   la page l'appelle sans, et la cérémonie attend qu'il ait fini.
   * @returns {Promise<void>} résolue quand la cérémonie est finie — tout de
   *   suite pour une commune sans retournement, ou dans un onglet caché
   */
  function reveler(rarete, el, { son: sonore = true, retourner = false } = {}) {
    const d = degre(rarete);
    if (document.hidden) return Promise.resolve();
    return (retourner ? Promise.resolve() : attendrePose(el))
      .then(() => ceremonie(d, el, sonore, retourner));
  }

  function ceremonie(d, el, sonore, retourner) {
    /* Un onglet caché ne joue rien : ses animations seraient gelées, et la
       fête partirait d'un coup au retour, sur un écran passé à autre chose. */
    if (document.hidden) return Promise.resolve();
    const sans = doux();
    const cible = el?.isConnected ? el : null;
    const r0 = boite(cible);
    const jouerSon = (nom) => { if (sonore) son(nom); };
    /* L'arrondi se lit avant le retournement : pendant, l'objet et ses
       enfants n'ont pas encore de largeur, et la descente vers la face
       arrondie (voir « arrondi ») comparerait des boîtes plates. */
    const rayon = r0 && d !== 'commune' ? arrondi(cible) : null;

    /* Le retournement simple : l'objet s'ouvre comme une carte qu'on tourne
       vue de loin, sa largeur passant de rien à la sienne. La propriété
       « scale » et non « transform » : elle se compose avec la pose que la
       page a donnée à l'objet au lieu de l'écraser. Sans mouvement, l'objet
       est simplement là, et le son du geste reste. */
    let decal = 0;
    if (retourner && r0) {
      jouerSon('carte');
      if (!sans) {
        try {
          cible.animate([{ scale: '0 1' }, { scale: '1.06 1', offset: 0.7 }, { scale: '1 1' }],
            { duration: RETOURNE, easing: 'cubic-bezier(.3,.9,.3,1)' });
          decal = RETOURNE;
        } catch { /* sans animations de script : l'objet est déjà là */ }
      }
    }
    if (d === 'commune') return new Promise((r) => setTimeout(r, decal));

    const total = decal + DUREE[sans ? 'doux' : 'vif'][d];
    const calque = estrade();
    const g = document.createElement('div');
    g.className = 'fx-rev';
    g.style.setProperty('--fx-rar', TEINTE[d]);
    // Tout part après le retournement : un seul délai, lu par chaque pièce.
    g.style.setProperty('--fx-d', `${decal}ms`);
    g.style.setProperty('--fx-t', `${total - decal}ms`);
    if (rayon) g.style.borderRadius = rayon;
    /* Les pièces, de la plus basse à la plus haute. Sans mouvement, ni
       rayons, ni reflet, ni nappe, ni bouffée : la feuille les éteindrait,
       mais une pièce qui ne joue rien n'a pas à être posée. */
    let pieces = '';
    if (d === 'legendaire' && !sans) pieces += '<i class="fx-rev-rayons"></i>';
    if (r0) {
      pieces += '<i class="fx-rev-lisere"></i>';
      if (!sans && d === 'rare') pieces += '<i class="fx-rev-plastique"></i>';
      if (!sans && d === 'epique') pieces += '<i class="fx-rev-halo"></i><i class="fx-rev-nappe"></i>';
    }
    if (d === 'legendaire') {
      pieces += '<b class="fx-rev-sceau"><span class="tbf-tampon tbf-clac" data-ton="or">'
        + 'LÉGENDAIRE</span></b>';
    }
    g.innerHTML = pieces;

    // Sans objet à l'écran, la boîte est un point au milieu de l'écran.
    let b = r0 ?? { left: innerWidth / 2, top: innerHeight * 0.42, width: 0, height: 0 };
    const placer = (x) => {
      g.style.transform = `translate(${x.left}px,${x.top}px)`;
      g.style.width = `${x.width}px`;
      g.style.height = `${x.height}px`;
      g.style.setProperty('--fx-w', `${x.width}px`);
      g.style.setProperty('--fx-h', `${x.height}px`);
      g.style.setProperty('--fx-s',
        `${Math.round(Math.min(900, Math.max(280, Math.max(x.width, x.height) * 2.6)))}px`);
    };
    placer(b);
    calque.appendChild(g);

    /* Le flash couvre tout l'écran : il vit sur le calque, pas dans la boîte.
       Posé sous elle, pour ne pas blanchir le tampon qui tombe juste après. */
    let eclair = null;
    if (d === 'legendaire' && !sans) {
      eclair = document.createElement('i');
      eclair.className = 'fx-rev-flash';
      eclair.style.setProperty('--fx-d', `${decal}ms`);
      calque.insertBefore(eclair, g);
    }

    const minuteries = [];
    const plusTard = (ms, f) => { if (ms > 0) minuteries.push(setTimeout(f, ms)); else f(); };
    plusTard(decal, () => {
      if (d === 'rare') jouerSon('tic');
      if (d === 'epique') {
        jouerSon('carillon');
        buzz(14);
        const c = b;
        particules({ x: c.left + c.width / 2, y: c.top + c.height / 2, n: 24, papier: true,
          couleurs: ['#B98CFF', COULEURS.craie, COULEURS.violet],
          distance: Math.max(130, Math.max(c.width, c.height) * 0.8), duree: 900, dans: calque });
      }
      if (d === 'legendaire') {
        jouerSon('rugissement');
        buzz([40, 30, 90]);
        secousse(1.2);
      }
    });
    // Le clac du tampon, quand il touche l'objet.
    if (d === 'legendaire') plusTard(decal + 180, () => jouerSon('bache'));

    return new Promise((resoudre) => {
      let fini = false;
      let image = 0;
      const finir = () => {
        if (fini) return;
        fini = true;
        cancelAnimationFrame(image);
        minuteries.forEach(clearTimeout);
        g.remove();
        eclair?.remove();
        resoudre();
      };
      /* La boîte suit l'objet : la secousse le fait trembler, la page peut le
         faire glisser. Une lecture de position par image, le temps de la
         cérémonie, et une écriture seulement quand elle a changé. La
         cérémonie s'arrête quand l'objet est parti (voir « parti ») ; une
         boîte plate — le retournement à ses premières images — garde la
         place d'avant, et rien ne se voit encore : chaque pièce attend la
         fin du retournement. */
      const suivi = r0 ? cible : null;
      const suivre = () => {
        if (fini) return;
        if (suivi) {
          if (parti(suivi)) { finir(); return; }
          const c = boite(suivi);
          if (c && (c.left !== b.left || c.top !== b.top || c.width !== b.width
            || c.height !== b.height)) {
            b = c;
            placer(c);
          }
        }
        image = requestAnimationFrame(suivre);
      };
      /* La fin vient d'une minuterie, jamais de la fin d'une animation : un
         onglet passé en arrière-plan gèle les animations, pas les minuteries. */
      minuteries.push(setTimeout(finir, total));
      image = requestAnimationFrame(suivre);
    });
  }

  const FX = {
    couleurs: COULEURS,

    /**
     * Combien de temps un Fanzzy tient la pose d'un moment fort.
     *
     * Quinze secondes, et c'est délibérément long. Les célébrations duraient
     * deux secondes et demie : le temps de sortir le téléphone de sa poche,
     * le personnage était déjà revenu au repos et le but n'avait laissé
     * aucune trace. Un moment fort doit être encore là quand on arrive.
     *
     * La constante vit ici parce que la règle vaut pour **tous** les écrans où
     * un Fanzzy réagit — le but, le but encaissé, le carton, la victoire, la
     * défaite. Chaque page qui la recopierait finirait par en avoir sa propre
     * version, et deux écrans du même jeu ne tiendraient plus la pose aussi
     * longtemps.
     */
    MOMENT: 15000,

    /** Une couleur de club, éclaircie jusqu'à se lire sur le fond du jeu. */
    lisible,

    particules, onde, flash, secousse, titre, nombre, animer, reagir,

    /**
     * Joue un son de la banque — celle du moteur commun, `son.js`
     * (`TBF_SON.jouer`). Sans effet si le joueur a coupé, avant son premier
     * geste, dans un onglet caché, ou si le moteur n'est pas chargé.
     * L'ambiance et les chants se demandent au moteur directement :
     * `TBF_SON.ambiance(niveau)`, `TBF_SON.chant(type, { tempo })`.
     */
    son,
    /** Coupe ou rétablit le son, et retient le choix — dans le mode calme. */
    sonCoupe(v) {
      reglerCalme('sons', Boolean(v));
      return calme('sons');
    },
    sonEstCoupe: () => calme('sons'),

    /**
     * Le joueur a-t-il calmé cette facette ? « sons », « vibrations » ou
     * « animations ». C'est son réglage à lui, lu à l'instant : la préférence
     * du système (prefers-reduced-motion) se consulte à part.
     */
    calme,

    compter, voler,

    /** La cérémonie commune d'un objet révélé, selon sa rareté. */
    reveler,

    /**
     * Une porte fermée qu'on touche : la tuile verrouillée du hub, demain la
     * case du classeur qu'on n'a pas encore. Elle dit non de la tête, avec le
     * tic sourd et un buzz de huit millisecondes — assez pour se sentir sous
     * le doigt, trop court pour se confondre avec la vibration d'un gain.
     *
     * **La secousse est celle de `ui.css`** (`.tbf-secoue`, 260 ms). La page
     * qui la pose déjà elle-même — le hub le fait, avec son calcul forcé pour
     * la rejouer — la garde : on ne la repose pas par-dessus. Une page qui ne
     * la pose pas la reçoit d'ici, retirée à la fin de son animation. Sans
     * mouvement (système ou calme « animations »), pas de secousse du tout :
     * la feuille l'éteindrait, et une classe qui n'anime rien n'a pas à être
     * posée.
     *
     * Le son et la vibration suivent chacun leur facette du mode calme.
     *
     * @param {Element} [el]  ce qu'on a touché ; sans lui, le son et le buzz
     */
    refus(el) {
      son('sourd');
      buzz(8);
      if (!el?.classList || doux() || el.classList.contains('tbf-secoue')) return;
      let filet = 0;
      const fin = (e) => {
        // Filtré par nom : un sticker qui respire sur la même tuile finit
        // aussi des animations, et ne doit pas couper la secousse.
        if (e && e.animationName !== 'tbf-secoue') return;
        clearTimeout(filet);
        el.removeEventListener('animationend', fin);
        el.classList.remove('tbf-secoue');
      };
      el.addEventListener('animationend', fin);
      /* Le filet, comme pour compter : un onglet caché ne finit pas ses
         animations, et la classe resterait posée. Une seconde et non trois
         cents millisecondes : sur une page chargée, l'animation peut ne
         partir qu'à l'image suivante, deux cents millisecondes plus tard, et
         un filet trop court couperait la secousse en plein geste. */
      filet = setTimeout(fin, 1000);
      el.classList.add('tbf-secoue');
    },

    /* Une carte jouée se voit dans `action-art.js`, avec son dessin et sa
       famille. Il y avait ici une version pâle — une onde et le nom en
       craie — que plus personne n'appelait : deux définitions de « à quoi
       ressemble une carte qu'on joue », dont une morte. */

    /**
     * Un but dans le jeu. Le plus gros effet dont on dispose.
     *
     * **`vignette: true`** est la forme du hub : `index.html` l'appelle avec
     * `{ pour: true, vignette: true }` à côté de `moment('but', …)`, quand un
     * club suivi marque — le but encaissé n'y passe pas. La page montre
     * déjà le but dans la case de BD unifiée (`.tbf-moment`, dans `ui.css`),
     * qui porte son mot, sa bouffée de fumigène et ses confettis. Le « BUT ! »
     * d'ici s'écrivait alors par-dessus la case — deux titres pour un but —,
     * et ses quatre-vingt-dix particules doublaient les confettis. Il ne reste
     * que ce que la case ne sait pas faire : **la secousse de l'écran et la
     * vibration**, que le hub avait avant la case et qu'il ne doit pas perdre
     * avec le lettrage nu — sans elles, un but au hub ne se sent plus sous le
     * doigt. Ni éclair, ni onde, ni particules, ni titre,
     * **ni son** : la page qui pose la case choisit aussi sa corne — `butReel`
     * au hub, puisque c'est un vrai match — et une seconde corne partirait
     * par-dessus, décalée de quelques millisecondes. La case reste immobile :
     * elle est posée sur le document, hors de `#app` que la secousse fait
     * trembler, et c'est elle qu'on lit.
     *
     * Le Virage et le duel appellent encore la forme pleine : leur écran de
     * match n'est pas repris avant le lot 6.
     */
    but({ pour = true, score, vignette = false } = {}) {
      // Un seul motif pour les deux formes : un but se sent pareil sous le
      // doigt, qu'on le lise dans la case ou dans le titre d'ici.
      const vibration = pour ? [45, 55, 130] : 220;
      if (vignette) {
        secousse(1.4);
        buzz(vibration);
        return;
      }
      flash(pour ? '#fff' : 'rgba(224,64,44,.55)');
      secousse(1.4);
      const x = innerWidth / 2;
      const y = innerHeight * 0.42;
      onde({ x, y, couleur: pour ? COULEURS.or : COULEURS.feu, taille: 620 });
      particules({ x, y, n: 90, distance: 300, taille: 7, duree: 1300,
        couleurs: pour ? [COULEURS.or, COULEURS.feu, '#FFF3D0'] : [COULEURS.feu, '#7A1A11'] });
      titre(pour ? 'BUT !' : 'BUT ADVERSE', score ? `${score[0]} – ${score[1]}` : null,
        pour ? COULEURS.or : COULEURS.feu, pour ? 56 : 40);
      buzz(vibration);
      son(pour ? 'but' : 'encaisse');
    },

    /** Un but dans le vrai match : mêmes codes, plus le contexte. */
    butReel({ pour = true, buteur, minute } = {}) {
      this.but({ pour });
      setTimeout(() => titre(pour ? 'BUT RÉEL' : 'BUT ENCAISSÉ',
        [buteur, minute ? `${minute}'` : null].filter(Boolean).join(' · '),
        pour ? COULEURS.or : COULEURS.feu, 34), 900);
    },

    /** Carton jaune ou rouge, brandi comme un arbitre le ferait. */
    carton(couleur = 'jaune', { joueur, minute } = {}) {
      const c = document.createElement('div');
      c.className = 'fx-carton';
      c.style.background = couleur === 'rouge'
        ? 'linear-gradient(150deg,#E0402C,#8E1D12)'
        : 'linear-gradient(150deg,#F5C33B,#B8860B)';
      document.body.appendChild(c);
      requestAnimationFrame(() => c.classList.add('go'));
      setTimeout(() => c.remove(), 1600);
      buzz(couleur === 'rouge' ? [40, 40, 40] : 25);
      if (joueur) {
        setTimeout(() => titre(couleur === 'rouge' ? 'ROUGE' : 'JAUNE',
          [joueur, minute ? `${minute}'` : null].filter(Boolean).join(' · '),
          couleur === 'rouge' ? COULEURS.feu : COULEURS.or, 30), 500);
      }
    },

    /** Bandeau d'annonce : temps fort, minute double, mi-temps. */
    bandeau(texte, couleur = COULEURS.or) {
      const b = document.createElement('div');
      b.className = 'fx-bandeau';
      b.style.background = couleur;
      b.textContent = texte;
      document.body.appendChild(b);
      requestAnimationFrame(() => b.classList.add('go'));
      setTimeout(() => b.remove(), 3100);
      buzz([25, 35, 25]);
    },

    /** Poussée reçue ou donnée, chiffrée à l'endroit du geste. */
    poussee(valeur, element, { pour = true } = {}) {
      const { x, y } = centre(element);
      nombre(Math.round(valeur), { x, y, couleur: pour ? COULEURS.or : COULEURS.bleu });
      if (Math.abs(valeur) > 40) {
        particules({ x, y, n: 14, distance: 90, taille: 4,
          couleurs: [pour ? COULEURS.or : COULEURS.bleu] });
      }
    },

    /**
     * Ce que **mon** geste vient de rapporter, en grand.
     *
     * `poussee` reste ce qu'elle était : un nombre de vingt-deux pixels qui
     * monte et s'efface, et c'est très bien pour la poussée d'en face — on doit
     * la voir sans qu'elle prenne l'écran.
     *
     * Le sien, non. Un joueur qui vient de tenir une jauge pendant huit
     * secondes regardait un chiffre de la taille d'une étiquette passer au
     * milieu d'une corde qui bouge, d'une foule qui s'anime et d'un fil de
     * match qui défile. Il ne voyait pas ce qu'il avait gagné — donc il ne
     * pouvait pas savoir si son geste avait valu la peine, ce qui est la seule
     * chose qu'un mini-jeu doit lui apprendre.
     *
     * Trois différences, et chacune sert : **deux fois plus gros**, un **mot
     * dessous** qui dit de quoi il s'agit, et une **montée plus lente** — un
     * nombre qui s'efface en une seconde se lit au jugé, pas en entier.
     */
    /* `ou` est **un élément ou un point**. Le Virage a un nœud à l'écran et le
       passe tel quel ; le duel calcule la position de la corde lui-même et n'a
       qu'un couple de coordonnées. Exiger la même forme des deux aurait obligé
       l'un à fabriquer un élément factice pour se faire mesurer. */
    points(valeur, ou, { couleur = COULEURS.or, quoi = '', signe = true } = {}) {
      const { x, y } = (ou && typeof ou.x === 'number') ? ou : centre(ou);
      const v = Math.round(valeur);
      const n = document.createElement('div');
      n.className = 'fx-points';
      n.style.cssText = `left:${x}px;top:${y}px;color:${couleur}`;
      n.innerHTML = `<b>${signe && v > 0 ? '+' : ''}${v}</b>`
        + (quoi ? `<span>${String(quoi).replace(/[<>&]/g, '')}</span>` : '');
      document.body.appendChild(n);
      // Même règle que « nombre » : sans mouvement, il reste en place.
      const images = doux() ? [
        { transform: 'translate(-50%,-50%)', opacity: 0 },
        { transform: 'translate(-50%,-50%)', opacity: 1, offset: .15 },
        { transform: 'translate(-50%,-50%)', opacity: 1, offset: .8 },
        { transform: 'translate(-50%,-50%)', opacity: 0 },
      ] : [
        { transform: 'translate(-50%,-50%) scale(.6)', opacity: 0 },
        { transform: 'translate(-50%,-85%) scale(1.15)', opacity: 1, offset: .22 },
        { transform: 'translate(-50%,-105%) scale(1)', opacity: 1, offset: .68 },
        { transform: 'translate(-50%,-165%) scale(.96)', opacity: 0 },
      ];
      n.animate(images, { duration: 1650, easing: 'cubic-bezier(.16,.9,.25,1)' })
        .onfinish = () => n.remove();
      /* Le seuil est celui de `poussee`, et il est volontairement le même : une
         grosse poussée fait des étincelles, qu'elle soit à soi ou pas. */
      if (Math.abs(v) > 40) {
        particules({ x, y, n: 16, distance: 100, taille: 4, couleurs: [couleur] });
      }
    },

    /**
     * Une carte rare qui se pose.
     *
     * **Remplacée par « reveler »**, l'échelle commune de cérémonie. Le
     * kiosque y est passé et ne l'appelle plus ; il reste un appelant, la
     * fiche de carte de la collection (`fanfare`, dans `collection.html`),
     * qui passera à « reveler » avec elle (hors des lots 3 et 5). Elle partira
     * alors. Ne pas l'employer ailleurs.
     */
    rare(rarete = 'd3', element) {
      const { x, y } = centre(element);
      const palette = { epique: [COULEURS.bleu, COULEURS.craie],
        legendaire: [COULEURS.or, COULEURS.feu, '#FFF3D0'] }[rarete]
        ?? [COULEURS.craie];
      onde({ x, y, couleur: palette[0], taille: rarete === 'crown' ? 560 : 340 });
      particules({ x, y, couleurs: palette, distance: rarete === 'crown' ? 260 : 170,
        n: rarete === 'crown' ? 70 : 30, taille: 6, duree: 1200 });
      if (rarete === 'crown') { flash(); secousse(1.2); }
      buzz(rarete === 'crown' ? [40, 50, 40, 50, 120] : 20);
    },

    /**
     * **L'évolution d'un Fanzzy.**
     *
     * Le geste le plus cher du jeu — quatre-vingt-dix écharpes, parfois deux
     * cents — était le seul sans cérémonie : on confirmait, la fiche se
     * rechargeait, et le nouveau personnage était là. Rien n'avait eu lieu.
     *
     * ## Pourquoi elle est ici et non dans la fiche
     *
     * Parce qu'elle se joue à trois endroits — la fiche, le classeur, et le
     * jour où l'accueil fêtera une montée. Une cérémonie recopiée dans chacun
     * finirait par durer trois durées différentes, et le jeu n'aurait plus de
     * rythme à lui. Même raison que `MOMENT`, plus haut.
     *
     * ## La couleur vient de la rareté d'arrivée
     *
     * C'est elle qu'on achète : monter au troisième âge d'un épique doit
     * éclater en violet, pas dans l'or de tout le monde. La légendaire garde
     * l'or, et son flash blanc en plus.
     *
     * ## Ce qu'elle rend
     *
     * Une promesse qui se résout **quand l'ancien a fini de se charger**, à
     * l'instant du flash. C'est là que l'appelant doit remplacer l'image : une
     * seconde plus tôt on verrait la substitution, une seconde plus tard on
     * verrait un trou. Le reste de la cérémonie se joue après, toute seule.
     *
     * @param {Element} portrait  l'image à faire évoluer, si elle est à l'écran
     * @param {object}  o
     * @param {string}  o.nom     le nom du nouvel âge, annoncé en grand
     * @param {string}  o.rar     la rareté d'arrivée : elle donne la couleur
     */
    evolution(portrait, { nom = '', rar = 'commune' } = {}) {
      const PALETTE = {
        commune:    [COULEURS.craie],
        rare:       [COULEURS.bleu, COULEURS.craie],
        epique:     ['#B98CFF', COULEURS.bleu, COULEURS.craie],
        legendaire: [COULEURS.or, COULEURS.feu, '#FFF3D0'],
      };
      const palette = PALETTE[rar] ?? PALETTE.commune;
      const couleur = palette[0];
      const { x, y } = centre(portrait);

      /* La charge. Sans portrait à l'écran — le classeur en vignette, une
         fiche déjà refermée — on saute directement au flash : la cérémonie
         raccourcit, elle ne disparaît pas. */
      if (portrait) {
        portrait.classList.remove('fx-charge');
        void portrait.offsetWidth;
        portrait.classList.add('fx-charge');
      }
      buzz([18, 60, 26, 60, 34]);
      son('charge');

      const CHARGE = portrait ? 1000 : 120;

      return new Promise((resolve) => {
        setTimeout(() => {
          flash(rar === 'legendaire' ? '#fff' : couleur);
          secousse(rar === 'legendaire' ? 1.3 : 1);
          onde({ x, y, couleur, taille: rar === 'legendaire' ? 560 : 400 });
          particules({ x, y, couleurs: palette, taille: 6, duree: 1200,
            n: rar === 'legendaire' ? 70 : rar === 'epique' ? 46 : 30,
            distance: rar === 'legendaire' ? 260 : 190 });
          buzz(rar === 'legendaire' ? [40, 50, 40, 50, 120] : [30, 40, 60]);
          son('evolue');

          /* On rend la main **ici** : l'appelant remplace l'image pendant que
             le blanc la couvre. Le titre tombe juste après, sur le personnage
             déjà en place — l'annoncer avant nommerait quelqu'un qu'on ne voit
             pas encore. */
          resolve({
            /* L'arrivée, à jouer sur la nouvelle image une fois posée. La
               cérémonie ne sait pas quel élément ce sera : la fiche se
               reconstruit entièrement, l'ancien n'existe plus. */
            arrivee(neuf) {
              if (neuf) {
                neuf.classList.remove('fx-arrive');
                void neuf.offsetWidth;
                neuf.classList.add('fx-arrive');
              }
              if (nom) setTimeout(() => titre(nom, 'A GRANDI', couleur, 34), 180);
            },
          });
        }, CHARGE);
      });
    },

    /**
     * Le Cri d'un Fanzzy.
     *
     * Une vidéo par Cri serait ingérable : vingt-sept Fanzzy, vingt-sept
     * fichiers à charger au pire moment. Une seule séquence d'ondes est donc
     * partagée, teintée à la couleur du type et superposée en mode « screen »
     * pour que seul ce qui brille apparaisse. Elle n'est chargée qu'au premier
     * Cri de la session.
     */
    cri(label, { couleur = COULEURS.or, video = '/video/cri.mp4' } = {}) {
      const x = innerWidth / 2, y = innerHeight * 0.42;
      onde({ x, y, couleur, taille: 520 });
      particules({ x, y, n: 46, distance: 210, taille: 6, duree: 1100,
        couleurs: [couleur, '#FFF3D0'] });
      titre(label, null, couleur, 40);
      secousse(1.1);
      buzz([30, 40, 30, 40, 90]);
      if (doux()) return;

      let v = document.getElementById('fx-cri');
      if (!v) {
        v = document.createElement('video');
        v.id = 'fx-cri';
        v.muted = true; v.playsInline = true; v.preload = 'none';
        v.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;object-fit:cover;' +
          'mix-blend-mode:screen;opacity:0;transition:opacity .35s;pointer-events:none;z-index:92';
        document.body.appendChild(v);
      }
      // Absence du fichier : les particules et le titre suffisent, le Cri
      // reste lisible. Aucun effet ne doit dépendre d'un téléchargement.
      v.onerror = () => { v.remove(); };
      if (!v.src) { v.src = video; v.load(); }
      v.style.filter = `hue-rotate(0deg) saturate(1.1)`;
      v.currentTime = 0;
      v.style.opacity = '1';
      v.play?.().catch(() => {});
      clearTimeout(v._t);
      v._t = setTimeout(() => { v.style.opacity = '0'; v.pause?.(); }, 2600);
    },

    /** Fin de duel. */
    fin(gagne, { score } = {}) {
      if (gagne) {
        flash();
        particules({ x: innerWidth / 2, y: innerHeight * 0.35, n: 110, distance: 340,
          taille: 7, duree: 1600, couleurs: [COULEURS.or, '#FFF3D0', COULEURS.feu] });
      }
      titre(gagne ? 'VICTOIRE' : 'DÉFAITE', score ? `${score[0]} – ${score[1]}` : null,
        gagne ? COULEURS.or : COULEURS.craie, 50);
      buzz(gagne ? [60, 60, 60, 60, 180] : 200);
    },
  };

  window.FX = FX;
})();
