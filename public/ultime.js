/**
 * La scène de l'Ultimate : le coup fatal d'un Fanzzy, en plein écran.
 *
 * ## Deux scènes, une seule poussée
 *
 * Tout le monde a l'Ultimate, et il pousse pareil pour tous
 * (`src/shared/ultime.js`). Ce qui se gagne en booster, c'est **la grande
 * scène** : la carte Ultimate d'un âge la débloque, et la tribune d'en face
 * la voit aussi. C'est le choix de Gaël du 26 octobre 2026, « Visuel à
 * collectionner » : l'envie d'y arriver et de la montrer, sans que payer
 * fasse gagner.
 *
 *   - **la scène courte** (1,6 s) — la salle s'assombrit, le Fanzzy surgit
 *     dans la lumière de sa famille, son cri claque en grand, l'éclair ;
 *   - **la grande scène** (3,4 s) — le noir complet, les rayons qui tournent,
 *     les lignes de vitesse, le Fanzzy qui grandit jusqu'à remplir l'écran,
 *     le bandeau ULTIMATE, le cri lettre à lettre, l'onde de choc et les
 *     étincelles.
 *
 * ## Ce que le fichier ne fait pas
 *
 * Il ne connaît aucune règle et ne parle à aucun serveur : la page lui donne
 * l'image, le nom, le cri et la couleur, et il joue. Le duel, le Virage et la
 * fiche d'un Fanzzy (qui montre la scène qu'on gagne) l'appellent tous les
 * trois.
 *
 * Sous le calme des animations — celui du système ou celui du joueur —, la
 * scène reste une carte immobile qui dit le cri, une seconde, sans rien qui
 * bouge ni qui clignote.
 *
 * Script classique, pas module : comme tout ce qui vit dans `public/`.
 */
(() => {
  const STYLE = `
.tbf-ult{position:fixed;inset:0;z-index:120;pointer-events:none;overflow:hidden;
  display:grid;place-items:center;--c:#F5C33B;contain:strict}
.tbf-ult-voile{position:absolute;inset:0;background:rgba(7,9,12,.62);opacity:0;
  transition:opacity .18s ease-out}
.tbf-ult.on .tbf-ult-voile{opacity:1}
.tbf-ult[data-grande] .tbf-ult-voile{background:#07090C}
.tbf-ult-rayons{position:absolute;left:50%;top:46%;width:240vmax;height:240vmax;
  margin:-120vmax 0 0 -120vmax;opacity:0;
  background:repeating-conic-gradient(from 0deg,var(--c) 0 6deg,transparent 6deg 18deg,
    rgba(245,195,59,.85) 18deg 21deg,transparent 21deg 30deg);
  -webkit-mask:radial-gradient(circle,#000 0 8%,rgba(0,0,0,.55) 22%,transparent 55%);
          mask:radial-gradient(circle,#000 0 8%,rgba(0,0,0,.55) 22%,transparent 55%)}
.tbf-ult.on .tbf-ult-rayons{animation:tbfUltRayons 3.4s linear forwards}
@keyframes tbfUltRayons{0%{opacity:0;transform:rotate(0) scale(.4)}
  12%{opacity:.9}80%{opacity:.75}100%{opacity:0;transform:rotate(70deg) scale(1.15)}}
.tbf-ult-vitesse{position:absolute;inset:-10%;opacity:0;
  background:repeating-linear-gradient(100deg,transparent 0 22px,rgba(242,238,228,.16) 22px 24px,
    transparent 24px 61px);}
.tbf-ult.on .tbf-ult-vitesse{animation:tbfUltVitesse .5s linear 6 .15s}
@keyframes tbfUltVitesse{0%{opacity:.7;transform:translateX(0)}100%{opacity:.7;transform:translateX(-61px)}}
.tbf-ult-halo{position:absolute;left:50%;top:44%;width:92vmin;height:92vmin;margin:-46vmin 0 0 -46vmin;
  border-radius:50%;opacity:0;
  background:radial-gradient(circle,var(--c) 0,rgba(245,195,59,.35) 28%,transparent 62%)}
.tbf-ult.on .tbf-ult-halo{animation:tbfUltHalo var(--d,1.6s) ease-out forwards}
@keyframes tbfUltHalo{0%{opacity:0;transform:scale(.3)}25%{opacity:.85;transform:scale(1)}
  80%{opacity:.6}100%{opacity:0;transform:scale(1.2)}}
.tbf-ult-fz{position:absolute;left:50%;bottom:22%;height:min(62vh,520px);max-width:92vw;
  transform:translateX(-50%);opacity:0;object-fit:contain;
  filter:drop-shadow(0 0 18px var(--c)) drop-shadow(0 0 2px #fff)}
.tbf-ult.on .tbf-ult-fz{animation:tbfUltFz var(--d,1.6s) cubic-bezier(.2,1.4,.4,1) forwards}
@keyframes tbfUltFz{0%{opacity:0;transform:translateX(-50%) translateY(18%) scale(.55)}
  22%{opacity:1;transform:translateX(-50%) translateY(0) scale(1.06)}
  30%{transform:translateX(-50%) scale(1)}85%{opacity:1}
  100%{opacity:0;transform:translateX(-50%) scale(1.04)}}
.tbf-ult[data-grande].on .tbf-ult-fz{height:min(72vh,620px);
  animation:tbfUltFzGrand 3.4s cubic-bezier(.2,1.2,.4,1) forwards}
@keyframes tbfUltFzGrand{0%{opacity:0;transform:translateX(-50%) scale(.15) rotate(-8deg)}
  18%{opacity:1;transform:translateX(-50%) scale(.7) rotate(0)}
  34%{transform:translateX(-50%) scale(1.12)}40%{transform:translateX(-50%) scale(1)}
  88%{opacity:1;transform:translateX(-50%) scale(1.03)}100%{opacity:0;transform:translateX(-50%) scale(1.25)}}
.tbf-ult-texte{position:absolute;left:0;right:0;bottom:9%;padding:0 16px;text-align:center;
  font-family:var(--banner,"Oswald",Impact,sans-serif);color:#F2EEE4;line-height:.95}
.tbf-ult-bandeau{display:inline-block;padding:3px 12px 4px;margin-bottom:8px;
  background:var(--c);color:#07090C;font-weight:700;letter-spacing:.32em;font-size:13px;
  transform:skewX(-10deg);opacity:0}
.tbf-ult.on .tbf-ult-bandeau{animation:tbfUltBandeau var(--d,1.6s) ease-out forwards}
@keyframes tbfUltBandeau{0%{opacity:0;transform:skewX(-10deg) translateX(-40px)}
  15%{opacity:1;transform:skewX(-10deg) translateX(0)}85%{opacity:1}100%{opacity:0}}
.tbf-ult-cri{display:block;font-weight:700;font-size:clamp(34px,11vw,64px);letter-spacing:.01em;
  text-transform:uppercase;text-shadow:0 0 14px var(--c),0 3px 0 #07090C,0 0 2px #07090C;
  opacity:0;overflow-wrap:anywhere}
.tbf-ult.on .tbf-ult-cri{animation:tbfUltCri var(--d,1.6s) cubic-bezier(.2,1.6,.4,1) forwards}
@keyframes tbfUltCri{0%,18%{opacity:0;transform:scale(2.4)}30%{opacity:1;transform:scale(.94)}
  36%{transform:scale(1)}86%{opacity:1}100%{opacity:0;transform:scale(1.05)}}
.tbf-ult[data-grande] .tbf-ult-cri .l{display:inline-block;opacity:0}
.tbf-ult-cri .m{display:inline-block;white-space:nowrap}
.tbf-ult[data-grande].on .tbf-ult-cri{animation:none;opacity:1}
.tbf-ult[data-grande].on .tbf-ult-cri .l{animation:tbfUltLettre .32s cubic-bezier(.2,1.8,.4,1) forwards}
@keyframes tbfUltLettre{0%{opacity:0;transform:translateY(-30px) scale(2)}100%{opacity:1;transform:none}}
.tbf-ult[data-grande].sort .tbf-ult-cri{transition:opacity .3s;opacity:0}
.tbf-ult-nom{display:block;margin-top:8px;font-size:15px;letter-spacing:.12em;opacity:0;color:var(--c)}
.tbf-ult.on .tbf-ult-nom{animation:tbfUltBandeau var(--d,1.6s) ease-out forwards}
.tbf-ult[data-eux] .tbf-ult-bandeau{background:#3C82E8;color:#F2EEE4}
.tbf-ult-eclair{position:absolute;inset:0;background:#fff;opacity:0}
.tbf-ult.on .tbf-ult-eclair{animation:tbfUltEclair .5s ease-out forwards;animation-delay:var(--choc,.42s)}
@keyframes tbfUltEclair{0%{opacity:0}12%{opacity:.85}100%{opacity:0}}
.tbf-ult.calme .tbf-ult-voile{opacity:1}
.tbf-ult.calme .tbf-ult-fz,.tbf-ult.calme .tbf-ult-cri,.tbf-ult.calme .tbf-ult-bandeau,
.tbf-ult.calme .tbf-ult-nom,.tbf-ult.calme .tbf-ult-cri .l{opacity:1;animation:none!important;transform:translateX(-50%)}
.tbf-ult.calme .tbf-ult-cri,.tbf-ult.calme .tbf-ult-bandeau,.tbf-ult.calme .tbf-ult-nom,
.tbf-ult.calme .tbf-ult-cri .l{transform:none}
.tbf-ult.calme .tbf-ult-rayons,.tbf-ult.calme .tbf-ult-vitesse,.tbf-ult.calme .tbf-ult-halo,
.tbf-ult.calme .tbf-ult-eclair{display:none}

/* La grande scène plein cadre : l'image Ultimate du Fanzzy (Artlist, 9:16),
   animée au code. Tout tient sur --d (4,2 s) et le choc à 27 % (1,15 s). */
.tbf-ult[data-plein] .tbf-ult-voile{background:#07090C}
.tbf-ult-secoue{position:absolute;inset:0}
.tbf-ult.choc .tbf-ult-secoue{animation:tbfUltSecoue .48s linear}
@keyframes tbfUltSecoue{0%,100%{transform:none}10%{transform:translate(-9px,6px) rotate(-.6deg)}
  25%{transform:translate(8px,-7px) rotate(.5deg)}40%{transform:translate(-6px,-4px)}
  55%{transform:translate(5px,5px) rotate(-.3deg)}70%{transform:translate(-3px,2px)}85%{transform:translate(2px,-1px)}}
.tbf-ult-plan{position:absolute;inset:0;overflow:hidden;opacity:0;
  clip-path:inset(50% 0 50% 0);will-change:transform,filter,clip-path}
.tbf-ult-plan img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;
  object-position:50% 30%}
.tbf-ult.on .tbf-ult-plan{animation:tbfUltPlan var(--d) cubic-bezier(.3,.7,.3,1) forwards}
@keyframes tbfUltPlan{
  0%{opacity:1;clip-path:inset(50% 0 50% 0);transform:scale(1.42);filter:brightness(.35) saturate(.2) blur(5px)}
  9%{clip-path:inset(47% 0 47% 0)}
  25%{clip-path:inset(0);transform:scale(1.3);filter:brightness(.75) saturate(.75) blur(0)}
  27.4%{transform:scale(1.13);filter:brightness(1.9) saturate(1.4)}
  31%{transform:scale(1.06);filter:brightness(1.1) saturate(1.15)}
  86%{opacity:1;clip-path:inset(0);transform:scale(1) translateY(-1.6%);filter:brightness(1) saturate(1.05)}
  100%{opacity:0;clip-path:inset(0);transform:scale(1.2) translateY(-2%);filter:brightness(2.4) saturate(.6)}}
/* La fente de lumière qui s'ouvre avant l'image, à la couleur de sa famille. */
.tbf-ult-fente{position:absolute;left:0;right:0;top:50%;height:2px;margin-top:-1px;opacity:0;
  background:var(--c);box-shadow:0 0 18px 4px var(--c),0 0 60px 10px var(--c)}
.tbf-ult.on .tbf-ult-fente{animation:tbfUltFente 1.2s ease-out forwards}
@keyframes tbfUltFente{0%{opacity:0;transform:scaleX(0)}12%{opacity:1;transform:scaleX(1)}
  70%{opacity:.9;transform:scaleY(1)}100%{opacity:0;transform:scaleY(60)}}
/* Le dédoublement rouge et bleu du choc : deux copies décalées, un instant. */
.tbf-ult-plan .r,.tbf-ult-plan .b{opacity:0;mix-blend-mode:screen}
.tbf-ult-plan .r{filter:sepia(1) saturate(9) hue-rotate(-45deg) brightness(.8)}
.tbf-ult-plan .b{filter:sepia(1) saturate(9) hue-rotate(160deg) brightness(.8)}
.tbf-ult.choc .tbf-ult-plan .r{animation:tbfUltR .34s ease-out}
.tbf-ult.choc .tbf-ult-plan .b{animation:tbfUltB .34s ease-out}
@keyframes tbfUltR{0%{opacity:.85;transform:translate(-14px,3px)}100%{opacity:0;transform:none}}
@keyframes tbfUltB{0%{opacity:.85;transform:translate(14px,-3px)}100%{opacity:0;transform:none}}
/* Le cœur qui bat : la couleur de la famille qui pulse sur l'image. */
.tbf-ult-pouls{position:absolute;inset:0;opacity:0;mix-blend-mode:screen;
  background:radial-gradient(ellipse 70% 55% at 50% 42%,var(--c),transparent 70%)}
.tbf-ult.on .tbf-ult-pouls{animation:tbfUltPouls .56s ease-out 1.15s 4}
@keyframes tbfUltPouls{0%{opacity:.55}100%{opacity:0}}
.tbf-ult[data-plein] .tbf-ult-rayons{mix-blend-mode:screen;top:42%}
.tbf-ult[data-plein].on .tbf-ult-rayons{animation:tbfUltRayonsPlein var(--d) linear forwards}
@keyframes tbfUltRayonsPlein{0%,24%{opacity:0;transform:rotate(0) scale(.3)}
  28%{opacity:.55;transform:rotate(8deg) scale(1)}80%{opacity:.25}100%{opacity:0;transform:rotate(60deg) scale(1.2)}}
.tbf-ult[data-plein].on .tbf-ult-vitesse{animation:tbfUltVitesse .45s linear 1.15s 3}
/* Les braises qui montent après le choc. */
.tbf-ult-braises{position:absolute;inset:0}
.tbf-ult-braises i{position:absolute;bottom:-12px;width:var(--t);height:var(--t);border-radius:50%;
  background:var(--c);box-shadow:0 0 8px 2px var(--c);opacity:0}
.tbf-ult.on .tbf-ult-braises i{animation:tbfUltBraise var(--v) ease-out var(--r) forwards}
@keyframes tbfUltBraise{0%{opacity:0;transform:translate(0,0)}10%{opacity:1}
  100%{opacity:0;transform:translate(var(--x),-85vh)}}
/* Le bas assombri, pour que le cri se lise sur n'importe quelle image. */
.tbf-ult-bas{position:absolute;left:0;right:0;bottom:0;height:42%;
  background:linear-gradient(transparent,rgba(7,9,12,.88))}
.tbf-ult[data-plein] .tbf-ult-texte{bottom:7%}
.tbf-ult[data-plein].on .tbf-ult-bandeau,.tbf-ult[data-plein].on .tbf-ult-nom{
  animation:tbfUltBandeauPlein var(--d) ease-out forwards}
@keyframes tbfUltBandeauPlein{0%,27%{opacity:0;transform:skewX(-10deg) translateX(-40px)}
  34%{opacity:1;transform:skewX(-10deg) translateX(0)}88%{opacity:1}100%{opacity:0}}
.tbf-ult.calme .tbf-ult-plan{opacity:1;clip-path:none;animation:none!important}
.tbf-ult.calme .tbf-ult-fente,.tbf-ult.calme .tbf-ult-pouls,.tbf-ult.calme .tbf-ult-braises{display:none}
`;

  /* **Les images Ultimate** (Artlist, plein cadre 9:16), par lignée et par
     âge : `<racine>-e<âge>` → fichier dans `public/img/ultime/`. Le script
     `npm run ultime:images` réécrit ce bloc ; un Fanzzy absent garde la
     scène dessinée avec sa carte. */
  /* IMAGES: début */
  const IMAGES = {
    'RP1-e1': 'RP1-e1.f2b92265.webp',
    'RP1-e2': 'RP1-e2.3a3930a4.webp',
    'RP1-e3': 'RP1-e3.802e1807.webp',
    'RP2-e1': 'RP2-e1.9d63ab90.webp',
    'RP2-e2': 'RP2-e2.aee6ef56.webp',
    'RP2-e3': 'RP2-e3.7937b877.webp',
    'RP3-e1': 'RP3-e1.24c02fc6.webp',
    'RP3-e2': 'RP3-e2.f462fac0.webp',
    'RP3-e3': 'RP3-e3.d31f8d52.webp',
    'RP4-e1': 'RP4-e1.bff19edb.webp',
    'RP4-e2': 'RP4-e2.140dbef1.webp',
    'RP4-e3': 'RP4-e3.0914ffcf.webp',
    'RP5-e1': 'RP5-e1.ab1153d1.webp',
    'RP5-e2': 'RP5-e2.34204833.webp',
    'RP5-e3': 'RP5-e3.ddff3c7a.webp',
    'RP6-e1': 'RP6-e1.08e6dd5e.webp',
    'RP6-e2': 'RP6-e2.35137942.webp',
    'RP6-e3': 'RP6-e3.6e9f54c5.webp',
    'RP7-e1': 'RP7-e1.6816dd59.webp',
    'RP7-e2': 'RP7-e2.b4747a5a.webp',
    'RP7-e3': 'RP7-e3.b261cf47.webp',
    'RP8-e1': 'RP8-e1.0e2ec87f.webp',
    'RP8-e2': 'RP8-e2.9f1211de.webp',
    'RP8-e3': 'RP8-e3.451299d1.webp',
    'RP9-e1': 'RP9-e1.132026c6.webp',
    'RP9-e2': 'RP9-e2.9d91dc96.webp',
    'RP9-e3': 'RP9-e3.6a31f7d0.webp',
    'RP10-e1': 'RP10-e1.2dcb831e.webp',
    'RP10-e2': 'RP10-e2.304406e5.webp',
    'RP10-e3': 'RP10-e3.537fb28f.webp',
    'RP11-e1': 'RP11-e1.7574577f.webp',
    'RP11-e2': 'RP11-e2.4dfd1f31.webp',
    'RP11-e3': 'RP11-e3.9a841318.webp',
    'RP12-e1': 'RP12-e1.23d50b0d.webp',
    'RP12-e2': 'RP12-e2.29c929a0.webp',
    'RP12-e3': 'RP12-e3.0e746b41.webp',
    'RP13-e1': 'RP13-e1.c35efcda.webp',
    'RP14-e1': 'RP14-e1.6ee77395.webp',
    'RP15-e1': 'RP15-e1.4a6b15b6.webp',
    'RP16-e1': 'RP16-e1.d7cc3ef2.webp',
    'RP17-e1': 'RP17-e1.3654e758.webp',
    'RP18-e1': 'RP18-e1.c99c9c24.webp',
    'RP18-e2': 'RP18-e2.69bd38e2.webp',
    'RP18-e3': 'RP18-e3.e9602ceb.webp',
    'RP19-e1': 'RP19-e1.011c7cac.webp',
    'RP19-e2': 'RP19-e2.47e89b23.webp',
    'RP19-e3': 'RP19-e3.13a8a0d9.webp',
    'RP20-e1': 'RP20-e1.85a0c991.webp',
    'RP20-e2': 'RP20-e2.2e201977.webp',
    'RP20-e3': 'RP20-e3.d6f7aa42.webp',
    'RP21-e1': 'RP21-e1.27785ce0.webp',
    'RP21-e2': 'RP21-e2.5c4b5799.webp',
    'RP21-e3': 'RP21-e3.2ab653ae.webp',
    'RP22-e1': 'RP22-e1.cd1247f5.webp',
    'RP22-e2': 'RP22-e2.01db7533.webp',
    'RP22-e3': 'RP22-e3.d514bd24.webp',
    'RP23-e1': 'RP23-e1.daa2bece.webp',
    'RP23-e2': 'RP23-e2.df6c6e3c.webp',
    'RP23-e3': 'RP23-e3.b5109010.webp',
    'RP24-e1': 'RP24-e1.01e17cdf.webp',
    'RP24-e2': 'RP24-e2.eaf9e791.webp',
    'RP24-e3': 'RP24-e3.209630e8.webp',
    'RP25-e1': 'RP25-e1.460969e7.webp',
    'RP25-e2': 'RP25-e2.23838eb8.webp',
    'RP25-e3': 'RP25-e3.a296aefc.webp',
    'RP26-e1': 'RP26-e1.8d056a3b.webp',
    'RP26-e2': 'RP26-e2.9ee2ebaa.webp',
    'RP26-e3': 'RP26-e3.ecd4ab5c.webp',
    'RP27-e1': 'RP27-e1.ea10fd33.webp',
    'RP27-e2': 'RP27-e2.d3da3317.webp',
    'RP27-e3': 'RP27-e3.e127ba4d.webp',
    'RP28-e1': 'RP28-e1.fc595365.webp',
    'RP28-e2': 'RP28-e2.1fcc1389.webp',
    'RP28-e3': 'RP28-e3.7c58269c.webp',
    'RP29-e1': 'RP29-e1.7d72dbfc.webp',
    'RP29-e2': 'RP29-e2.795088bf.webp',
    'RP29-e3': 'RP29-e3.fbb571b7.webp',
    'RP30-e1': 'RP30-e1.229b0a68.webp',
    'RP30-e2': 'RP30-e2.1e2e79c5.webp',
    'RP30-e3': 'RP30-e3.4d070bb8.webp',
    'RP31-e1': 'RP31-e1.adab4be9.webp',
    'RP31-e2': 'RP31-e2.2a5f3d68.webp',
    'RP31-e3': 'RP31-e3.6c47f881.webp',
    'RP32-e1': 'RP32-e1.e744ff7f.webp',
    'RP32-e2': 'RP32-e2.7100bdd7.webp',
    'RP32-e3': 'RP32-e3.d7339bba.webp',
    'RP33-e1': 'RP33-e1.de131119.webp',
    'RP33-e2': 'RP33-e2.1e0983a9.webp',
    'RP33-e3': 'RP33-e3.014b38e4.webp',
    'RP34-e1': 'RP34-e1.4eec6467.webp',
    'RP34-e2': 'RP34-e2.8778743a.webp',
    'RP34-e3': 'RP34-e3.e750ce6b.webp',
    'RP35-e1': 'RP35-e1.c6f3c446.webp',
    'RP35-e2': 'RP35-e2.69ff8063.webp',
    'RP35-e3': 'RP35-e3.fb0a6739.webp',
  };
  /* IMAGES: fin */

  /** L'image Ultimate d'une lignée à un âge, ou null. Une légendaire n'a qu'un âge. */
  function image(id, age = 1) {
    // Un âge passé en identifiant (« RP4B ») revient à sa lignée (« RP4 »).
    const racine = String(id ?? '').replace(/^([A-Z]{2}\d+)[B-Z]$/, '$1');
    /* Une légendaire n'a qu'un âge, donc qu'une image : on la prend à tout
       âge. Une lignée à trois âges ne prête jamais l'image d'un autre âge. */
    const seule = !IMAGES[`${racine}-e2`] && !IMAGES[`${racine}-e3`];
    const f = IMAGES[`${racine}-e${Math.max(1, Number(age) || 1)}`] ?? (seule ? IMAGES[`${racine}-e1`] : null);
    return f && racine ? `/img/ultime/${f}` : null;
  }

  /* Charge l'image avant la scène : une scène qui s'ouvre sur du noir puis
     saute à l'image perdrait sa révélation. Trop lente, la scène dessinée la
     remplace. */
  function precharger(src, ms = 700) {
    return new Promise((ok) => {
      const i = new Image();
      let fait = false;
      const finir = (v) => { if (!fait) { fait = true; ok(v); } };
      i.onload = () => (i.decode ? i.decode().catch(() => {}) : Promise.resolve()).then(() => finir(true));
      i.onerror = () => finir(false);
      setTimeout(() => finir(false), ms);
      i.src = src;
    });
  }

  /* Le texte se pose **en texte** : le cri vient du catalogue, le nom d'un
     Fanzzy aussi, et l'un comme l'autre se traduisent (`langue.js`). */
  function poserStyle() {
    if (document.getElementById('tbfUltStyle')) return;
    const s = document.createElement('style');
    s.id = 'tbfUltStyle';
    s.textContent = STYLE;
    document.head.appendChild(s);
  }

  const doux = () => window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    || (document.documentElement.dataset.calme ?? '').split(' ').includes('animations');

  const son = (nom) => { try { window.FX?.son?.(nom); } catch { /* rien */ } };
  /* La règle de `fx.js` (« buzz »), qu'il n'exporte pas : rien sous le calme
     des vibrations, rien avant le premier geste du joueur. */
  const vibrer = (motif) => {
    if ((document.documentElement.dataset.calme ?? '').split(' ').includes('vibrations')) return;
    if (navigator.userActivation?.hasBeenActive === false) return;
    try { navigator.vibrate?.(motif); } catch { /* rien */ }
  };

  let enCours = null;

  /**
   * Joue la scène. Rend une promesse tenue quand elle s'est retirée.
   *
   * @param {object} o
   * @param {string} [o.src]     l'image du Fanzzy (la pose « pousse » si elle existe)
   * @param {string} [o.cri]     le nom de l'Ultimate : le cri de l'âge
   * @param {string} [o.nom]     le nom du Fanzzy à cet âge
   * @param {string} [o.couleur] la couleur de sa famille
   * @param {boolean} [o.grande] la grande scène (la carte Ultimate de cet âge)
   * @param {boolean} [o.eux]    l'Ultimate de la tribune d'en face
   * @param {string} [o.racine]  sa lignée, et
   * @param {number} [o.age]     son âge : la grande scène prend alors son image
   *                             Ultimate plein cadre, s'il en a une
   */
  function scene(o = {}) {
    const fond = o.grande && o.racine ? image(o.racine, o.age) : null;
    if (!fond) return jouer(o, null);
    return precharger(fond).then((pret) => jouer(o, pret ? fond : null));
  }

  function jouer({ src = '', cri = '', nom = '', couleur = '#F5C33B', grande = false, eux = false } = {}, fond) {
    poserStyle();
    // Deux coups fatals à la suite : le second remplace le premier.
    enCours?.couper?.();
    const calme = doux();
    const plein = Boolean(grande && fond);
    const d = plein ? 4200 : grande ? 3400 : 1600;
    const choc = grande ? 1150 : 420;
    const el = document.createElement('div');
    el.className = 'tbf-ult';
    el.setAttribute('aria-hidden', 'true');
    el.style.setProperty('--c', couleur);
    el.style.setProperty('--d', `${d}ms`);
    el.style.setProperty('--choc', `${choc}ms`);
    if (grande) el.dataset.grande = '';
    if (plein) el.dataset.plein = '';
    if (eux) el.dataset.eux = '';
    /* Plein cadre : l'image Ultimate fait toute la scène, le Fanzzy y est
       déjà — pas de carte par-dessus. */
    el.innerHTML = `<div class="tbf-ult-voile"></div>
      <div class="tbf-ult-secoue">
      ${plein ? `<div class="tbf-ult-plan"><img alt="" class="p"><img alt="" class="r"><img alt="" class="b"></div>
        <div class="tbf-ult-fente"></div><div class="tbf-ult-pouls"></div>` : ''}
      ${grande ? '<div class="tbf-ult-rayons"></div><div class="tbf-ult-vitesse"></div>' : ''}
      ${plein ? '<div class="tbf-ult-braises"></div><div class="tbf-ult-bas"></div>' : '<div class="tbf-ult-halo"></div>'}
      ${src && !plein ? '<img class="tbf-ult-fz" alt="" decoding="async">' : ''}
      <div class="tbf-ult-texte"><span class="tbf-ult-bandeau"></span>
        <b class="tbf-ult-cri"></b><span class="tbf-ult-nom"></span></div>
      </div>
      <div class="tbf-ult-eclair"></div>`;
    el.querySelector('.tbf-ult-bandeau').textContent = eux ? 'ULTIMATE ADVERSE' : 'ULTIMATE';
    el.querySelector('.tbf-ult-nom').textContent = nom;
    if (plein) {
      el.querySelectorAll('.tbf-ult-plan img').forEach((i) => { i.src = fond; });
      /* Trente braises, chacune sa taille, sa dérive et son départ : un
         tirage par scène, pour qu'aucune ne se ressemble. */
      const braises = el.querySelector('.tbf-ult-braises');
      for (let k = 0; k < 30; k++) {
        const b = document.createElement('i');
        b.style.left = `${Math.random() * 100}%`;
        b.style.setProperty('--t', `${3 + Math.random() * 5}px`);
        b.style.setProperty('--x', `${Math.round((Math.random() - 0.5) * 120)}px`);
        b.style.setProperty('--v', `${1300 + Math.random() * 1300}ms`);
        b.style.setProperty('--r', `${choc + Math.random() * 1700}ms`);
        braises.appendChild(b);
      }
    }
    const criEl = el.querySelector('.tbf-ult-cri');
    if (grande && !calme) {
      /* Lettre à lettre, chacune avec son retard : le cri tombe comme une
         banderole qu'on déroule. Les espaces restent des espaces. */
      /* Un mot ne se coupe jamais : ses lettres vivent dans un bloc
         insécable, et la ligne ne casse qu'entre deux mots. */
      let i = 0;
      String(cri).split(' ').forEach((mot, k) => {
        if (k) { criEl.append(' '); i++; }
        const m = document.createElement('span');
        m.className = 'm';
        for (const ch of mot) {
          const s = document.createElement('span');
          s.className = 'l';
          s.textContent = ch;
          s.style.animationDelay = `${(plein ? 1350 : 900) + i++ * 45}ms`;
          m.appendChild(s);
        }
        criEl.appendChild(m);
      });
    } else {
      criEl.textContent = cri;
    }
    const img = el.querySelector('.tbf-ult-fz');
    if (img) {
      img.onerror = () => {
        const repli = window.TBF_ETATS?.secours?.(img.src, true);
        if (repli && repli !== img.src) img.src = repli; else img.remove();
      };
      img.src = src;
    }
    document.body.appendChild(el);

    const minuteries = [];
    const plus = (ms, f) => minuteries.push(setTimeout(f, ms));
    return new Promise((tenir) => {
      const fin = () => {
        minuteries.forEach(clearTimeout);
        el.remove();
        if (enCours?.el === el) enCours = null;
        tenir();
      };
      enCours = { el, couper: fin };
      if (calme) {
        el.classList.add('calme', 'on');
        son('gong');
        plus(plein ? 1800 : 1200, fin);
        return;
      }
      requestAnimationFrame(() => el.classList.add('on'));
      if (grande) {
        /* Le son propre à l'Ultimate (`son.js`) : la montée tient jusqu'au
           choc, l'impact tombe avec l'éclair, puis la tribune. */
        son('ultime-montee');
        plus(450, () => son('grondement'));
        plus(choc, () => {
          son('ultime-impact');
          el.classList.add('choc');
          if (!plein) window.FX?.secousse?.(2.2);
          vibrer([60, 40, 140]);
          const x = innerWidth / 2;
          const y = innerHeight * (plein ? 0.42 : 0.45);
          window.FX?.onde?.({ x, y, couleur, taille: Math.max(innerWidth, innerHeight) * 1.2 });
          window.FX?.particules?.({ x, y, n: 90, couleurs: [couleur, '#F5C33B', '#F2EEE4'],
            distance: Math.max(innerWidth, innerHeight) * 0.6, taille: 7, duree: 1400 });
        });
        plus(choc + 520, () => el.classList.remove('choc'));
        plus(choc + 650, () => son(eux ? 'encaisse' : 'ovation'));
        plus(d - 450, () => el.classList.add('sort'));
      } else {
        son('charge');
        plus(choc, () => {
          son('rugissement');
          window.FX?.secousse?.(1.4);
          vibrer([40, 30, 90]);
          window.FX?.onde?.({ x: innerWidth / 2, y: innerHeight * 0.45, couleur, taille: 520 });
        });
      }
      plus(d + 60, fin);
    });
  }

  window.TBF_ULTIME = { scene, image };
})();
