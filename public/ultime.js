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
/* Dans la colonne du téléphone, sur un ordinateur aussi : l'image plein
   cadre sortait floue, étirée sur toute la fenêtre (27 octobre 2026, voir
   --tbf-cote dans ui.css ; nulle sur un téléphone). */
.tbf-ult{position:fixed;top:0;bottom:0;left:var(--tbf-cote,max(0px,calc(50% - 240px)));
  right:var(--tbf-cote,max(0px,calc(50% - 240px)));z-index:120;pointer-events:none;overflow:hidden;
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
.tbf-ult-plan img,.tbf-ult-plan video{position:absolute;inset:0;width:100%;height:100%;
  object-fit:cover;object-position:50% 30%}
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
    'AN1-e1': 'AN1-e1.1559f314.webp',
    'AN1-e1-prehistorique': 'AN1-e1-prehistorique.bec38034.webp',
    'AN1-e2': 'AN1-e2.0d6eef38.webp',
    'AN1-e3': 'AN1-e3.9a4e11c0.webp',
    'AN2-e1': 'AN2-e1.db4e2d33.webp',
    'AN2-e2': 'AN2-e2.7dd7eb41.webp',
    'AN2-e3': 'AN2-e3.c61592bd.webp',
    'AN3-e1': 'AN3-e1.c1cfed25.webp',
    'AN3-e2': 'AN3-e2.8dd74aab.webp',
    'AN3-e3': 'AN3-e3.cfd5396b.webp',
    'AN4-e1': 'AN4-e1.f9ddb862.webp',
    'AN4-e2': 'AN4-e2.f380f6f6.webp',
    'AN4-e3': 'AN4-e3.c297a8c3.webp',
    'AN5-e1': 'AN5-e1.1cdd73a3.webp',
    'AN5-e2': 'AN5-e2.472ea1c1.webp',
    'AN5-e3': 'AN5-e3.fcd2ef2f.webp',
    'AN6-e1': 'AN6-e1.a53de7bf.webp',
    'AN6-e2': 'AN6-e2.ddbd4695.webp',
    'AN6-e3': 'AN6-e3.ddbafb1b.webp',
    'AN7-e1': 'AN7-e1.31174905.webp',
    'AN7-e2': 'AN7-e2.92a9a57d.webp',
    'AN7-e3': 'AN7-e3.20b28c57.webp',
    'AN8-e1': 'AN8-e1.77161d1b.webp',
    'AN8-e2': 'AN8-e2.3c308c28.webp',
    'AN8-e3': 'AN8-e3.0dade500.webp',
    'AN9-e1': 'AN9-e1.a79e93fa.webp',
    'AN9-e2': 'AN9-e2.8133e6fb.webp',
    'AN9-e3': 'AN9-e3.62afe54e.webp',
    'AN10-e1': 'AN10-e1.c3b6bab9.webp',
    'AN10-e2': 'AN10-e2.2f258b73.webp',
    'AN10-e3': 'AN10-e3.640d2b67.webp',
    'AN11-e1': 'AN11-e1.0188c920.webp',
    'AN11-e2': 'AN11-e2.c2c6b6a5.webp',
    'AN11-e3': 'AN11-e3.15f28a8e.webp',
    'AN12-e1': 'AN12-e1.1c3a8df9.webp',
    'AN12-e2': 'AN12-e2.17695158.webp',
    'AN12-e3': 'AN12-e3.71d4bafd.webp',
    'AN13-e1': 'AN13-e1.b84a7c20.webp',
    'AN13-e2': 'AN13-e2.28509700.webp',
    'AN13-e3': 'AN13-e3.34cf088f.webp',
    'AN14-e1': 'AN14-e1.e99bd2aa.webp',
    'AN14-e2': 'AN14-e2.efb3a355.webp',
    'AN14-e3': 'AN14-e3.2045ecde.webp',
    'AN15-e1': 'AN15-e1.c3fa798b.webp',
    'AN15-e2': 'AN15-e2.5b41f021.webp',
    'AN15-e3': 'AN15-e3.bcca3e0b.webp',
    'AN16-e1': 'AN16-e1.bb5448a0.webp',
    'AN16-e2': 'AN16-e2.f38a7b1e.webp',
    'AN16-e3': 'AN16-e3.1bbf185c.webp',
    'AN17-e1': 'AN17-e1.3321ffe9.webp',
    'AN17-e2': 'AN17-e2.1c037b46.webp',
    'AN17-e3': 'AN17-e3.1e893951.webp',
    'AN18-e1': 'AN18-e1.c560c30e.webp',
    'AN18-e2': 'AN18-e2.1251b83e.webp',
    'AN18-e3': 'AN18-e3.dac3829c.webp',
    'AN19-e1': 'AN19-e1.2d8c6390.webp',
    'AN19-e2': 'AN19-e2.0dbc4ae0.webp',
    'AN19-e3': 'AN19-e3.819cb5e0.webp',
    'AN20-e1': 'AN20-e1.447ff28f.webp',
    'AN20-e2': 'AN20-e2.b28251d0.webp',
    'AN20-e3': 'AN20-e3.bb14eb31.webp',
    'AN21-e1': 'AN21-e1.721439f5.webp',
    'AN21-e2': 'AN21-e2.817506c4.webp',
    'AN21-e3': 'AN21-e3.bf3017af.webp',
    'AN22-e1': 'AN22-e1.e948e78b.webp',
    'AN22-e2': 'AN22-e2.145a083e.webp',
    'AN22-e3': 'AN22-e3.8711571e.webp',
    'AN23-e1': 'AN23-e1.55093881.webp',
    'AN23-e2': 'AN23-e2.6e47fa65.webp',
    'AN23-e3': 'AN23-e3.98a6cdff.webp',
    'AN24-e1': 'AN24-e1.41bede49.webp',
    'AN24-e2': 'AN24-e2.b1d1c303.webp',
    'AN24-e3': 'AN24-e3.23bb35cf.webp',
    'AN25-e1': 'AN25-e1.bbab0f65.webp',
    'AN25-e2': 'AN25-e2.88b93ada.webp',
    'AN25-e3': 'AN25-e3.a71fb38f.webp',
    'AN26-e1': 'AN26-e1.e91fd276.webp',
    'AN26-e2': 'AN26-e2.7e5479cd.webp',
    'AN26-e3': 'AN26-e3.a5a56126.webp',
    'AN27-e1': 'AN27-e1.417bc9ff.webp',
    'AN27-e2': 'AN27-e2.c49a4414.webp',
    'AN27-e3': 'AN27-e3.4e11e1c7.webp',
    'AN28-e1': 'AN28-e1.00c44b59.webp',
    'AN28-e2': 'AN28-e2.cef5deae.webp',
    'AN28-e3': 'AN28-e3.9cdc2b32.webp',
    'AN29-e1': 'AN29-e1.668f07eb.webp',
    'AN29-e2': 'AN29-e2.c0670f21.webp',
    'AN29-e3': 'AN29-e3.05c082d7.webp',
    'AN30-e1': 'AN30-e1.14fd9968.webp',
    'AN30-e2': 'AN30-e2.5abce76d.webp',
    'AN30-e3': 'AN30-e3.73e7c910.webp',
    'AN31-e1': 'AN31-e1.9c7e4837.webp',
    'AN31-e2': 'AN31-e2.2535e96b.webp',
    'AN31-e3': 'AN31-e3.b40bd154.webp',
    'AN32-e1': 'AN32-e1.142ce200.webp',
    'AN32-e2': 'AN32-e2.e1cd9ad4.webp',
    'AN32-e3': 'AN32-e3.d63d1277.webp',
    'AN33-e1': 'AN33-e1.a88db17f.webp',
    'AN33-e2': 'AN33-e2.ad54b7ad.webp',
    'AN33-e3': 'AN33-e3.0062d3b3.webp',
    'AN34-e1': 'AN34-e1.e8fde91e.webp',
    'AN34-e2': 'AN34-e2.bfc69841.webp',
    'AN34-e3': 'AN34-e3.65ae3747.webp',
    'AN35-e1': 'AN35-e1.64633974.webp',
    'AN35-e2': 'AN35-e2.1752493f.webp',
    'AN35-e3': 'AN35-e3.38893076.webp',
    'AN36-e1': 'AN36-e1.2b869a63.webp',
    'AN36-e2': 'AN36-e2.11f370ee.webp',
    'AN36-e3': 'AN36-e3.afd62305.webp',
    'AN37-e1': 'AN37-e1.8c9e4985.webp',
    'AN37-e2': 'AN37-e2.68e25147.webp',
    'AN37-e3': 'AN37-e3.64c551aa.webp',
    'AN38-e1': 'AN38-e1.fa6170f9.webp',
    'AN38-e2': 'AN38-e2.589ebb74.webp',
    'AN38-e3': 'AN38-e3.559d55ef.webp',
    'AN39-e1': 'AN39-e1.f2e7f712.webp',
    'AN39-e2': 'AN39-e2.e22dd851.webp',
    'AN39-e3': 'AN39-e3.8ca533f0.webp',
    'AN40-e1': 'AN40-e1.019b22bf.webp',
    'AN40-e2': 'AN40-e2.ee9052e8.webp',
    'AN40-e3': 'AN40-e3.4bda16b2.webp',
    'AN41-e1': 'AN41-e1.2d19256a.webp',
    'AN41-e2': 'AN41-e2.0628b0f1.webp',
    'AN41-e3': 'AN41-e3.a5cb6197.webp',
    'AN42-e1': 'AN42-e1.3255ca48.webp',
    'AN42-e2': 'AN42-e2.6293da52.webp',
    'AN42-e3': 'AN42-e3.63fff66a.webp',
    'AN43-e1': 'AN43-e1.d09ca4cc.webp',
    'AN43-e2': 'AN43-e2.a7aaf656.webp',
    'AN43-e3': 'AN43-e3.38bdec53.webp',
    'AN44-e1': 'AN44-e1.f529f777.webp',
    'AN44-e2': 'AN44-e2.012dd36c.webp',
    'AN44-e3': 'AN44-e3.c78c2884.webp',
    'AN45-e1': 'AN45-e1.fa347b2a.webp',
    'AN45-e2': 'AN45-e2.34fa93bf.webp',
    'AN45-e3': 'AN45-e3.cb1054a7.webp',
    'AN46-e1': 'AN46-e1.7c9a3644.webp',
    'AN46-e2': 'AN46-e2.d02872cf.webp',
    'AN46-e3': 'AN46-e3.4adf16c1.webp',
    'AN47-e1': 'AN47-e1.c960f6a1.webp',
    'AN47-e2': 'AN47-e2.66f36719.webp',
    'AN47-e3': 'AN47-e3.46a7c987.webp',
    'AN48-e1': 'AN48-e1.f65c15c9.webp',
    'AN48-e2': 'AN48-e2.c4d16d58.webp',
    'AN48-e3': 'AN48-e3.4ef632a2.webp',
    'AN49-e1': 'AN49-e1.ee64577c.webp',
    'AN49-e2': 'AN49-e2.e2c44779.webp',
    'AN49-e3': 'AN49-e3.4e634249.webp',
    'AN50-e1': 'AN50-e1.2fa1c1f7.webp',
    'AN50-e2': 'AN50-e2.04b76143.webp',
    'AN50-e3': 'AN50-e3.cda74331.webp',
    'AN51-e1': 'AN51-e1.e859a7a5.webp',
    'AN51-e2': 'AN51-e2.2a14c0dc.webp',
    'AN51-e3': 'AN51-e3.23d09f2d.webp',
    'AN52-e1': 'AN52-e1.d6ad4869.webp',
    'AN52-e2': 'AN52-e2.1d807832.webp',
    'AN52-e3': 'AN52-e3.ec2a1fdb.webp',
    'AN53-e1': 'AN53-e1.9836df99.webp',
    'AN53-e2': 'AN53-e2.b1ddf37f.webp',
    'AN53-e3': 'AN53-e3.e59e2773.webp',
    'AN54-e1': 'AN54-e1.bfc1ac1a.webp',
    'AN54-e2': 'AN54-e2.2045f321.webp',
    'AN54-e3': 'AN54-e3.68d175ff.webp',
    'AN55-e1': 'AN55-e1.d46992a0.webp',
    'AN55-e2': 'AN55-e2.00ec5227.webp',
    'AN55-e3': 'AN55-e3.c9a8d61f.webp',
    'AN56-e1': 'AN56-e1.38d29e5f.webp',
    'AN56-e2': 'AN56-e2.02d943ac.webp',
    'AN56-e3': 'AN56-e3.8140d911.webp',
    'AN57-e1': 'AN57-e1.1ff21999.webp',
    'AN57-e2': 'AN57-e2.33676339.webp',
    'AN57-e3': 'AN57-e3.917f8072.webp',
    'AN58-e1': 'AN58-e1.eec2ebc6.webp',
    'AN58-e2': 'AN58-e2.9caa8ec1.webp',
    'AN58-e3': 'AN58-e3.f043832c.webp',
    'AN59-e1': 'AN59-e1.bd2f54b7.webp',
    'AN59-e2': 'AN59-e2.82ec5a9b.webp',
    'AN59-e3': 'AN59-e3.041bfc9d.webp',
    'AN60-e1': 'AN60-e1.70d59eba.webp',
    'AN60-e2': 'AN60-e2.ed21ab6f.webp',
    'AN60-e3': 'AN60-e3.3030d36c.webp',
    'AN61-e1': 'AN61-e1.e7ae2323.webp',
    'AN62-e1': 'AN62-e1.7e5558cf.webp',
    'AN63-e1': 'AN63-e1.66f9575f.webp',
    'AN64-e1': 'AN64-e1.e4a986fa.webp',
    'AN65-e1': 'AN65-e1.c52a6b79.webp',
    'AN66-e1': 'AN66-e1.84515ee5.webp',
    'RP1-e1': 'RP1-e1.f2b92265.webp',
    'RP1-e1-prehistorique': 'RP1-e1-prehistorique.a932c5b2.webp',
    'RP1-e2': 'RP1-e2.3a3930a4.webp',
    'RP1-e2-prehistorique': 'RP1-e2-prehistorique.f5a7263b.webp',
    'RP1-e3': 'RP1-e3.802e1807.webp',
    'RP1-e3-prehistorique': 'RP1-e3-prehistorique.e7a50771.webp',
    'RP2-e1': 'RP2-e1.9d63ab90.webp',
    'RP2-e1-prehistorique': 'RP2-e1-prehistorique.9473e06e.webp',
    'RP2-e2': 'RP2-e2.aee6ef56.webp',
    'RP2-e2-prehistorique': 'RP2-e2-prehistorique.57786292.webp',
    'RP2-e3': 'RP2-e3.7937b877.webp',
    'RP2-e3-prehistorique': 'RP2-e3-prehistorique.1bb8a7c9.webp',
    'RP3-e1': 'RP3-e1.24c02fc6.webp',
    'RP3-e1-prehistorique': 'RP3-e1-prehistorique.d50bcf82.webp',
    'RP3-e2': 'RP3-e2.f462fac0.webp',
    'RP3-e2-prehistorique': 'RP3-e2-prehistorique.9b9d4e63.webp',
    'RP3-e3': 'RP3-e3.d31f8d52.webp',
    'RP3-e3-prehistorique': 'RP3-e3-prehistorique.69e32d65.webp',
    'RP4-e1': 'RP4-e1.bff19edb.webp',
    'RP4-e1-halloween': 'RP4-e1-halloween.f50eba92.webp',
    'RP4-e1-prehistorique': 'RP4-e1-prehistorique.2b04f819.webp',
    'RP4-e2': 'RP4-e2.140dbef1.webp',
    'RP4-e2-halloween': 'RP4-e2-halloween.93cb8d10.webp',
    'RP4-e2-prehistorique': 'RP4-e2-prehistorique.fadbf67d.webp',
    'RP4-e3': 'RP4-e3.0914ffcf.webp',
    'RP4-e3-halloween': 'RP4-e3-halloween.d6261027.webp',
    'RP4-e3-prehistorique': 'RP4-e3-prehistorique.b1b65670.webp',
    'RP5-e1': 'RP5-e1.ab1153d1.webp',
    'RP5-e1-prehistorique': 'RP5-e1-prehistorique.b8b830ae.webp',
    'RP5-e2': 'RP5-e2.34204833.webp',
    'RP5-e2-prehistorique': 'RP5-e2-prehistorique.409e7197.webp',
    'RP5-e3': 'RP5-e3.ddff3c7a.webp',
    'RP5-e3-prehistorique': 'RP5-e3-prehistorique.72a480a6.webp',
    'RP6-e1': 'RP6-e1.08e6dd5e.webp',
    'RP6-e1-prehistorique': 'RP6-e1-prehistorique.2350ce1b.webp',
    'RP6-e2': 'RP6-e2.35137942.webp',
    'RP6-e2-prehistorique': 'RP6-e2-prehistorique.b45de75e.webp',
    'RP6-e3': 'RP6-e3.6e9f54c5.webp',
    'RP6-e3-prehistorique': 'RP6-e3-prehistorique.a529b08d.webp',
    'RP7-e1': 'RP7-e1.6816dd59.webp',
    'RP7-e1-prehistorique': 'RP7-e1-prehistorique.c7a4a563.webp',
    'RP7-e2': 'RP7-e2.b4747a5a.webp',
    'RP7-e2-prehistorique': 'RP7-e2-prehistorique.46011890.webp',
    'RP7-e3': 'RP7-e3.b261cf47.webp',
    'RP7-e3-prehistorique': 'RP7-e3-prehistorique.7e041099.webp',
    'RP8-e1': 'RP8-e1.0e2ec87f.webp',
    'RP8-e1-prehistorique': 'RP8-e1-prehistorique.8978dbf3.webp',
    'RP8-e2': 'RP8-e2.9f1211de.webp',
    'RP8-e2-prehistorique': 'RP8-e2-prehistorique.08122b91.webp',
    'RP8-e3': 'RP8-e3.451299d1.webp',
    'RP8-e3-prehistorique': 'RP8-e3-prehistorique.c466773e.webp',
    'RP9-e1': 'RP9-e1.132026c6.webp',
    'RP9-e1-prehistorique': 'RP9-e1-prehistorique.970df697.webp',
    'RP9-e2': 'RP9-e2.9d91dc96.webp',
    'RP9-e2-prehistorique': 'RP9-e2-prehistorique.a8eb396a.webp',
    'RP9-e3': 'RP9-e3.6a31f7d0.webp',
    'RP9-e3-prehistorique': 'RP9-e3-prehistorique.de9cf496.webp',
    'RP10-e1': 'RP10-e1.2dcb831e.webp',
    'RP10-e1-prehistorique': 'RP10-e1-prehistorique.7841dc8c.webp',
    'RP10-e2': 'RP10-e2.304406e5.webp',
    'RP10-e2-prehistorique': 'RP10-e2-prehistorique.d512d67c.webp',
    'RP10-e3': 'RP10-e3.537fb28f.webp',
    'RP10-e3-prehistorique': 'RP10-e3-prehistorique.3bcc5564.webp',
    'RP11-e1': 'RP11-e1.7574577f.webp',
    'RP11-e1-prehistorique': 'RP11-e1-prehistorique.a0789ce6.webp',
    'RP11-e2': 'RP11-e2.4dfd1f31.webp',
    'RP11-e2-prehistorique': 'RP11-e2-prehistorique.78fa6b90.webp',
    'RP11-e3': 'RP11-e3.9a841318.webp',
    'RP11-e3-prehistorique': 'RP11-e3-prehistorique.a1281215.webp',
    'RP12-e1': 'RP12-e1.23d50b0d.webp',
    'RP12-e1-prehistorique': 'RP12-e1-prehistorique.70512d34.webp',
    'RP12-e2': 'RP12-e2.29c929a0.webp',
    'RP12-e2-prehistorique': 'RP12-e2-prehistorique.d5331674.webp',
    'RP12-e3': 'RP12-e3.0e746b41.webp',
    'RP12-e3-prehistorique': 'RP12-e3-prehistorique.bb32a33f.webp',
    'RP13-e1': 'RP13-e1.c35efcda.webp',
    'RP13-e1-prehistorique': 'RP13-e1-prehistorique.c74ffd65.webp',
    'RP14-e1': 'RP14-e1.6ee77395.webp',
    'RP14-e1-prehistorique': 'RP14-e1-prehistorique.fc38cbfb.webp',
    'RP15-e1': 'RP15-e1.4a6b15b6.webp',
    'RP15-e1-prehistorique': 'RP15-e1-prehistorique.e3138394.webp',
    'RP16-e1': 'RP16-e1.d7cc3ef2.webp',
    'RP16-e1-prehistorique': 'RP16-e1-prehistorique.36d4b6d3.webp',
    'RP17-e1': 'RP17-e1.3654e758.webp',
    'RP17-e1-prehistorique': 'RP17-e1-prehistorique.b9e452b7.webp',
    'RP18-e1': 'RP18-e1.c99c9c24.webp',
    'RP18-e1-prehistorique': 'RP18-e1-prehistorique.2c841f1d.webp',
    'RP18-e2': 'RP18-e2.69bd38e2.webp',
    'RP18-e2-prehistorique': 'RP18-e2-prehistorique.5b47fc70.webp',
    'RP18-e3': 'RP18-e3.e9602ceb.webp',
    'RP18-e3-prehistorique': 'RP18-e3-prehistorique.1686948d.webp',
    'RP19-e1': 'RP19-e1.011c7cac.webp',
    'RP19-e1-prehistorique': 'RP19-e1-prehistorique.6960dff7.webp',
    'RP19-e2': 'RP19-e2.47e89b23.webp',
    'RP19-e2-prehistorique': 'RP19-e2-prehistorique.2c1352e9.webp',
    'RP19-e3': 'RP19-e3.13a8a0d9.webp',
    'RP19-e3-prehistorique': 'RP19-e3-prehistorique.c18bfa45.webp',
    'RP20-e1': 'RP20-e1.85a0c991.webp',
    'RP20-e1-prehistorique': 'RP20-e1-prehistorique.74c93fdc.webp',
    'RP20-e2': 'RP20-e2.2e201977.webp',
    'RP20-e2-prehistorique': 'RP20-e2-prehistorique.d0efae8f.webp',
    'RP20-e3': 'RP20-e3.d6f7aa42.webp',
    'RP20-e3-prehistorique': 'RP20-e3-prehistorique.4b4abf35.webp',
    'RP21-e1': 'RP21-e1.27785ce0.webp',
    'RP21-e1-prehistorique': 'RP21-e1-prehistorique.246011c9.webp',
    'RP21-e2': 'RP21-e2.5c4b5799.webp',
    'RP21-e2-prehistorique': 'RP21-e2-prehistorique.8f110832.webp',
    'RP21-e3': 'RP21-e3.2ab653ae.webp',
    'RP21-e3-prehistorique': 'RP21-e3-prehistorique.10e08832.webp',
    'RP22-e1': 'RP22-e1.cd1247f5.webp',
    'RP22-e1-prehistorique': 'RP22-e1-prehistorique.c938ac4a.webp',
    'RP22-e2': 'RP22-e2.01db7533.webp',
    'RP22-e2-prehistorique': 'RP22-e2-prehistorique.460c427c.webp',
    'RP22-e3': 'RP22-e3.d514bd24.webp',
    'RP22-e3-prehistorique': 'RP22-e3-prehistorique.8088e4af.webp',
    'RP23-e1': 'RP23-e1.daa2bece.webp',
    'RP23-e1-prehistorique': 'RP23-e1-prehistorique.df3d0c5f.webp',
    'RP23-e2': 'RP23-e2.df6c6e3c.webp',
    'RP23-e2-prehistorique': 'RP23-e2-prehistorique.0f26b382.webp',
    'RP23-e3': 'RP23-e3.b5109010.webp',
    'RP23-e3-prehistorique': 'RP23-e3-prehistorique.5a433275.webp',
    'RP24-e1': 'RP24-e1.01e17cdf.webp',
    'RP24-e1-prehistorique': 'RP24-e1-prehistorique.f05f07b2.webp',
    'RP24-e2': 'RP24-e2.eaf9e791.webp',
    'RP24-e2-prehistorique': 'RP24-e2-prehistorique.6c7a9691.webp',
    'RP24-e3': 'RP24-e3.209630e8.webp',
    'RP24-e3-prehistorique': 'RP24-e3-prehistorique.cb8c601e.webp',
    'RP25-e1': 'RP25-e1.460969e7.webp',
    'RP25-e1-prehistorique': 'RP25-e1-prehistorique.d36eb1c9.webp',
    'RP25-e2': 'RP25-e2.23838eb8.webp',
    'RP25-e2-prehistorique': 'RP25-e2-prehistorique.036f8c96.webp',
    'RP25-e3': 'RP25-e3.a296aefc.webp',
    'RP25-e3-prehistorique': 'RP25-e3-prehistorique.e0b0a3c5.webp',
    'RP26-e1': 'RP26-e1.8d056a3b.webp',
    'RP26-e1-prehistorique': 'RP26-e1-prehistorique.eedb5162.webp',
    'RP26-e2': 'RP26-e2.9ee2ebaa.webp',
    'RP26-e2-prehistorique': 'RP26-e2-prehistorique.0b6055e4.webp',
    'RP26-e3': 'RP26-e3.ecd4ab5c.webp',
    'RP26-e3-prehistorique': 'RP26-e3-prehistorique.ceb48753.webp',
    'RP27-e1': 'RP27-e1.ea10fd33.webp',
    'RP27-e1-prehistorique': 'RP27-e1-prehistorique.3c9d784a.webp',
    'RP27-e2': 'RP27-e2.d3da3317.webp',
    'RP27-e2-prehistorique': 'RP27-e2-prehistorique.a0099961.webp',
    'RP27-e3': 'RP27-e3.e127ba4d.webp',
    'RP27-e3-prehistorique': 'RP27-e3-prehistorique.74dbaf05.webp',
    'RP28-e1': 'RP28-e1.fc595365.webp',
    'RP28-e1-prehistorique': 'RP28-e1-prehistorique.12448223.webp',
    'RP28-e2': 'RP28-e2.1fcc1389.webp',
    'RP28-e2-prehistorique': 'RP28-e2-prehistorique.a827c54f.webp',
    'RP28-e3': 'RP28-e3.7c58269c.webp',
    'RP28-e3-prehistorique': 'RP28-e3-prehistorique.6a2e2238.webp',
    'RP29-e1': 'RP29-e1.7d72dbfc.webp',
    'RP29-e1-prehistorique': 'RP29-e1-prehistorique.c29a5e95.webp',
    'RP29-e2': 'RP29-e2.795088bf.webp',
    'RP29-e2-prehistorique': 'RP29-e2-prehistorique.0d31f48b.webp',
    'RP29-e3': 'RP29-e3.fbb571b7.webp',
    'RP29-e3-prehistorique': 'RP29-e3-prehistorique.74dcdc6a.webp',
    'RP30-e1': 'RP30-e1.229b0a68.webp',
    'RP30-e1-prehistorique': 'RP30-e1-prehistorique.2576cb57.webp',
    'RP30-e2': 'RP30-e2.1e2e79c5.webp',
    'RP30-e2-prehistorique': 'RP30-e2-prehistorique.17ba137e.webp',
    'RP30-e3': 'RP30-e3.4d070bb8.webp',
    'RP30-e3-prehistorique': 'RP30-e3-prehistorique.bd2fc707.webp',
    'RP31-e1': 'RP31-e1.adab4be9.webp',
    'RP31-e1-prehistorique': 'RP31-e1-prehistorique.536f44af.webp',
    'RP31-e2': 'RP31-e2.2a5f3d68.webp',
    'RP31-e2-prehistorique': 'RP31-e2-prehistorique.a70cb282.webp',
    'RP31-e3': 'RP31-e3.6c47f881.webp',
    'RP31-e3-prehistorique': 'RP31-e3-prehistorique.c73fb0bb.webp',
    'RP32-e1': 'RP32-e1.e744ff7f.webp',
    'RP32-e1-prehistorique': 'RP32-e1-prehistorique.4f94ccc7.webp',
    'RP32-e2': 'RP32-e2.7100bdd7.webp',
    'RP32-e2-prehistorique': 'RP32-e2-prehistorique.5e03637b.webp',
    'RP32-e3': 'RP32-e3.d7339bba.webp',
    'RP32-e3-prehistorique': 'RP32-e3-prehistorique.59bb7195.webp',
    'RP33-e1': 'RP33-e1.de131119.webp',
    'RP33-e1-prehistorique': 'RP33-e1-prehistorique.6ddc48b0.webp',
    'RP33-e2': 'RP33-e2.1e0983a9.webp',
    'RP33-e2-prehistorique': 'RP33-e2-prehistorique.94c82012.webp',
    'RP33-e3': 'RP33-e3.014b38e4.webp',
    'RP33-e3-prehistorique': 'RP33-e3-prehistorique.54813c58.webp',
    'RP34-e1': 'RP34-e1.4eec6467.webp',
    'RP34-e1-prehistorique': 'RP34-e1-prehistorique.1f19792e.webp',
    'RP34-e2': 'RP34-e2.8778743a.webp',
    'RP34-e2-prehistorique': 'RP34-e2-prehistorique.f0a12938.webp',
    'RP34-e3': 'RP34-e3.e750ce6b.webp',
    'RP34-e3-prehistorique': 'RP34-e3-prehistorique.3ccada1e.webp',
    'RP35-e1': 'RP35-e1.c6f3c446.webp',
    'RP35-e1-prehistorique': 'RP35-e1-prehistorique.22d616bb.webp',
    'RP35-e2': 'RP35-e2.69ff8063.webp',
    'RP35-e3': 'RP35-e3.fb0a6739.webp',
    'RP35-e3-prehistorique': 'RP35-e3-prehistorique.83357f1d.webp',
  };
  /* IMAGES: fin */

  /* **Les clips Ultimate** (Artlist, 4 s, 9:16, sans son : le son vient de
     `son.js`), tirés de l'image du même âge : `<racine>-e<âge>` → fichier
     dans `public/img/ultime/`. Même script, même règle : sans clip, l'image
     fixe animée au code. */
  /* CLIPS: début */
  const CLIPS = {
    'AN61-e1': 'AN61-e1.26798fb6.mp4',
    'AN62-e1': 'AN62-e1.d685ddfb.mp4',
    'AN63-e1': 'AN63-e1.a05fc22e.mp4',
    'AN64-e1': 'AN64-e1.f8563524.mp4',
    'AN65-e1': 'AN65-e1.457c7588.mp4',
    'AN66-e1': 'AN66-e1.28aaf43d.mp4',
    'RP1-e1': 'RP1-e1.aac09cdb.mp4',
    'RP1-e2': 'RP1-e2.d353d8e7.mp4',
    'RP1-e3': 'RP1-e3.ffa108e1.mp4',
    'RP2-e1': 'RP2-e1.459bf483.mp4',
    'RP2-e2': 'RP2-e2.00519807.mp4',
    'RP2-e3': 'RP2-e3.998f28e1.mp4',
    'RP3-e1': 'RP3-e1.b893fec6.mp4',
    'RP3-e2': 'RP3-e2.00f34327.mp4',
    'RP3-e3': 'RP3-e3.c284eb74.mp4',
    'RP4-e1': 'RP4-e1.9ead205f.mp4',
    'RP4-e2': 'RP4-e2.7bcf1ebe.mp4',
    'RP4-e3': 'RP4-e3.b8a2096d.mp4',
    'RP5-e1': 'RP5-e1.977ea1d3.mp4',
    'RP5-e2': 'RP5-e2.acec4c98.mp4',
    'RP5-e3': 'RP5-e3.fa9ada23.mp4',
    'RP6-e1': 'RP6-e1.d64226af.mp4',
    'RP6-e2': 'RP6-e2.e75692bd.mp4',
    'RP6-e3': 'RP6-e3.6b34af76.mp4',
    'RP7-e1': 'RP7-e1.af0f9956.mp4',
    'RP7-e2': 'RP7-e2.72843e4e.mp4',
    'RP7-e3': 'RP7-e3.dd121a0a.mp4',
    'RP8-e1': 'RP8-e1.5b86fae8.mp4',
    'RP8-e2': 'RP8-e2.ee4a465f.mp4',
    'RP8-e3': 'RP8-e3.57289ba5.mp4',
    'RP9-e1': 'RP9-e1.94ce116f.mp4',
    'RP9-e2': 'RP9-e2.0ed9a1ed.mp4',
    'RP9-e3': 'RP9-e3.ee139c01.mp4',
    'RP10-e1': 'RP10-e1.09179c16.mp4',
    'RP10-e2': 'RP10-e2.f7cb991c.mp4',
    'RP10-e3': 'RP10-e3.cd2d7bb4.mp4',
    'RP11-e1': 'RP11-e1.26480e4d.mp4',
    'RP11-e2': 'RP11-e2.39b721aa.mp4',
    'RP11-e3': 'RP11-e3.d67f592d.mp4',
    'RP12-e1': 'RP12-e1.ca73ee27.mp4',
    'RP12-e2': 'RP12-e2.1a1d8cb2.mp4',
    'RP12-e3': 'RP12-e3.08f0f6dd.mp4',
    'RP13-e1': 'RP13-e1.7ce9e094.mp4',
    'RP14-e1': 'RP14-e1.66d7b167.mp4',
    'RP15-e1': 'RP15-e1.ff93df7b.mp4',
    'RP16-e1': 'RP16-e1.eb26e6ea.mp4',
    'RP17-e1': 'RP17-e1.c7f868ff.mp4',
    'RP18-e1': 'RP18-e1.2cfc972b.mp4',
    'RP18-e2': 'RP18-e2.394168fe.mp4',
    'RP18-e3': 'RP18-e3.7e8e5a36.mp4',
    'RP19-e1': 'RP19-e1.71c41a14.mp4',
    'RP19-e2': 'RP19-e2.f2ab0fd7.mp4',
    'RP19-e3': 'RP19-e3.d1b5bc14.mp4',
    'RP20-e1': 'RP20-e1.fcc2ebee.mp4',
    'RP20-e2': 'RP20-e2.be34b08a.mp4',
    'RP20-e3': 'RP20-e3.aea67def.mp4',
    'RP21-e1': 'RP21-e1.f94f3dc5.mp4',
    'RP21-e2': 'RP21-e2.eebfafa3.mp4',
    'RP21-e3': 'RP21-e3.639b0017.mp4',
    'RP22-e1': 'RP22-e1.5e0a14a5.mp4',
    'RP22-e2': 'RP22-e2.b5175f49.mp4',
    'RP22-e3': 'RP22-e3.dbfbb668.mp4',
    'RP23-e1': 'RP23-e1.b7f8ec0f.mp4',
    'RP23-e2': 'RP23-e2.e05334e0.mp4',
    'RP23-e3': 'RP23-e3.a54540fc.mp4',
    'RP24-e1': 'RP24-e1.346d43ed.mp4',
    'RP24-e2': 'RP24-e2.63a0187e.mp4',
    'RP24-e3': 'RP24-e3.90c6216d.mp4',
    'RP25-e1': 'RP25-e1.a25cc69c.mp4',
    'RP25-e2': 'RP25-e2.5c32a0eb.mp4',
    'RP25-e3': 'RP25-e3.22d1f4f8.mp4',
    'RP26-e1': 'RP26-e1.904fc1c5.mp4',
    'RP26-e2': 'RP26-e2.eb8ca0c4.mp4',
    'RP26-e3': 'RP26-e3.fffadc37.mp4',
    'RP27-e1': 'RP27-e1.37376f56.mp4',
    'RP27-e2': 'RP27-e2.44510e2f.mp4',
    'RP27-e3': 'RP27-e3.279717fa.mp4',
    'RP28-e1': 'RP28-e1.579c0dcd.mp4',
    'RP28-e2': 'RP28-e2.1758d592.mp4',
    'RP28-e3': 'RP28-e3.e1bd262c.mp4',
    'RP29-e1': 'RP29-e1.4ddadbbd.mp4',
    'RP29-e2': 'RP29-e2.b40aca26.mp4',
    'RP29-e3': 'RP29-e3.08262e71.mp4',
    'RP30-e1': 'RP30-e1.e181e8d4.mp4',
    'RP30-e2': 'RP30-e2.eccc68cb.mp4',
    'RP30-e3': 'RP30-e3.2ae9e2eb.mp4',
    'RP31-e1': 'RP31-e1.83c86a50.mp4',
    'RP31-e2': 'RP31-e2.4fc93994.mp4',
    'RP31-e3': 'RP31-e3.570541a1.mp4',
    'RP32-e1': 'RP32-e1.b3ff3480.mp4',
    'RP32-e2': 'RP32-e2.7ae4f14d.mp4',
    'RP32-e3': 'RP32-e3.e09ebf74.mp4',
    'RP33-e1': 'RP33-e1.11864ff5.mp4',
    'RP33-e2': 'RP33-e2.52ae0bb3.mp4',
    'RP33-e3': 'RP33-e3.a396cfc5.mp4',
    'RP34-e1': 'RP34-e1.89bcc51b.mp4',
    'RP34-e2': 'RP34-e2.095c325b.mp4',
    'RP34-e3': 'RP34-e3.9e5be62a.mp4',
    'RP35-e1': 'RP35-e1.f746921b.mp4',
    'RP35-e2': 'RP35-e2.0e67ecd9.mp4',
    'RP35-e3': 'RP35-e3.59f1cd8a.mp4',
  };
  /* CLIPS: fin */

  /* Le fichier d'une lignée à un âge dans une table, ou null. Une légendaire
     n'a qu'un âge, donc qu'un fichier : on le prend à tout âge. Une lignée à
     trois âges ne prête jamais le fichier d'un autre âge. Une tenue (`skin`)
     a sa propre clé, `<racine>-e<âge>-<tenue>` (« RP4-e2-halloween ») ; sans
     elle, c'est la tenue de base. */
  function chercher(table, id, age, skin) {
    // Un âge passé en identifiant (« RP4B ») revient à sa lignée (« RP4 »).
    const racine = String(id ?? '').replace(/^([A-Z]{2}\d+)[B-Z]$/, '$1');
    const seule = !IMAGES[`${racine}-e2`] && !IMAGES[`${racine}-e3`];
    const fin = skin && skin !== 'base' ? `-${skin}` : '';
    const f = table[`${racine}-e${Math.max(1, Number(age) || 1)}${fin}`] ?? (seule ? table[`${racine}-e1${fin}`] : null);
    return f && racine ? `/img/ultime/${f}` : null;
  }

  /** L'image Ultimate d'une lignée à un âge, dans sa tenue s'il y en a une
      dessinée, sinon dans sa tenue de base ; ou null. */
  const image = (id, age = 1, skin = 'base') => chercher(IMAGES, id, age, skin) ?? chercher(IMAGES, id, age);
  /** Le clip Ultimate d'une lignée à un âge, ou null. Une tenue dessinée sans
      clip n'en prend pas : celui de la base la montrerait en tenue de base. */
  const clip = (id, age = 1, skin = 'base') => chercher(CLIPS, id, age, skin)
    ?? (chercher(IMAGES, id, age, skin) ? null : chercher(CLIPS, id, age));

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

  /* Le clip aussi, prêt à jouer d'un trait : un clip qui hoquette au choc
     ferait pire que l'image fixe. Trop lent, on garde l'image. */
  function prechargerClip(src, ms = 1200) {
    return new Promise((ok) => {
      const v = document.createElement('video');
      let fait = false;
      const finir = (pret) => { if (!fait) { fait = true; ok(pret ? v : null); } };
      v.muted = true;
      v.playsInline = true;
      v.preload = 'auto';
      v.setAttribute('muted', '');
      v.setAttribute('playsinline', '');
      v.oncanplaythrough = () => finir(true);
      v.onerror = () => finir(false);
      setTimeout(() => finir(false), ms);
      v.src = src;
      v.load();
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
   * @param {string} [o.skin]    sa tenue (« halloween ») : son image à elle,
   *                             si elle est dessinée ; la base sinon
   */
  function scene(o = {}) {
    const fond = o.grande && o.racine ? image(o.racine, o.age, o.skin) : null;
    if (!fond) return jouer(o, null);
    // Le clip ne joue pas sous le calme : l'image fixe suffit.
    const film = doux() ? null : clip(o.racine, o.age, o.skin);
    return Promise.all([precharger(fond), film ? prechargerClip(film) : null])
      .then(([pret, video]) => jouer(o, pret ? fond : null, pret ? video : null));
  }

  function jouer({ src = '', cri = '', nom = '', couleur = '#F5C33B', grande = false, eux = false } = {}, fond, video = null) {
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
      /* Le clip se pose sur l'image, qui reste dessous : s'il cale, on voit
         l'image fixe, jamais du noir. */
      if (video && !calme) {
        video.className = 'v';
        el.querySelector('.tbf-ult-plan .p').after(video);
      }
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
      requestAnimationFrame(() => {
        el.classList.add('on');
        el.querySelector('.tbf-ult-plan .v')?.play?.()?.catch?.(() => {});
      });
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

  window.TBF_ULTIME = { scene, image, clip };
})();
