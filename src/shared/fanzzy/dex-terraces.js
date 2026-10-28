/**
 * LES TERRACES — le foot anglais vu des gradins debout.
 *
 * ## Ce que la série raconte
 *
 * La pluie, le thé, le bord de mer, les pubs, les vieux métiers des villes
 * ouvrières. Chaque Fanzzy porte les couleurs d'un club du championnat anglais
 * de la saison 2026-2027, **et rien d'autre de ce club**. Il vit dans un
 * morceau de culture anglaise à lui — le transat de la promenade, l'enseigne
 * peinte du pub, la péniche des canaux, le bâton de sucre rayé — et son
 * troisième âge garde toujours un détail du premier.
 *
 * Demandée par Gaël le 19 octobre 2026 : un Fanzzy par club, vingt lignées.
 * Le 21 octobre, il en a voulu trois par club — une femme, un homme et une
 * créature (un animal ou un objet vivant de la ville) —, soit soixante
 * lignées. Les fiches (noms, histoires, invites des dessins) sont dans
 * `/mnt/project-files/fanzzy-prompts/AN-les-terraces.md` pour AN1 à AN20, et
 * dans `AN-les-terraces-2.md` pour les quarante autres : AN21 à AN40 le
 * second humain de chaque club, AN41 à AN60 les créatures, dans le même ordre
 * des clubs (`clubs.js`).
 *
 * ## La prudence juridique, et pourquoi elle est écrite ici aussi
 *
 * **Le club de référence n'apparaît nulle part dans le jeu.** Ni son nom, ni
 * son surnom, ni son écusson, ni son stade, ni ses joueurs, ni ses chants, ni
 * ce que l'écusson dessine. Il n'est écrit que dans la ligne « Couleurs » de
 * chaque fiche, pour qui dessine, et il ne doit jamais descendre plus bas.
 *
 * Ce n'est pas une précaution de style. Les couleurs n'appartiennent à
 * personne — une écharpe rouge et blanche n'est à aucun club — mais un nom,
 * un surnom ou un écusson, si. C'est la règle de `VISUELS.md`, et elle vaut
 * pour le texte comme pour l'image : une histoire qui nommerait le stade ou
 * citerait un chant ferait à l'écrit ce que le dessin s'est interdit.
 *
 * D'où les histoires ci-dessous : elles parlent du métier, de la ville, du
 * temps qu'il fait, jamais du club. Qui relit une fiche pour l'enrichir doit
 * garder cette règle — c'est la seule de cette série qui ne se rattrape pas
 * après coup.
 *
 * ## Soixante lignées sur soixante, et pourquoi elle arrive fermée
 *
 * Les soixante (AN1 à AN60) ont leurs dessins : trois cartes en pied et
 * cinq états par âge, en tenue de base (AN17 n'a encore que deux états au
 * deuxième âge et AN38 quatre, AN9, AN22, AN26, AN29 et AN35 quatre au
 * premier ; AN41 au deuxième âge et AN57 au troisième sont passés par une
 * copie dont on a effacé des légendes ou des signes en forme de lettres :
 * toutes ces planches sont à refaire). Elles sont entrées par lots de cinq,
 * à mesure que leurs dessins arrivaient : une lignée sans dessin aurait
 * mis au catalogue une silhouette procédurale.
 *
 * Elle arrive **fermée** : aucune saison lancée ne la nomme, donc aucun
 * booster ni aucun kiosque ne la distribue (`chargerSeries`, dans
 * `src/server/fanzzy/catalogue.js`). Elle s'ouvre le jour où Gaël la coche
 * dans une saison lancée — onglet SAISONS de /admin —, sans livraison.
 *
 * Une installation **sans** saison lancée ouvre tout, celle-ci comprise :
 * c'est le comportement voulu du jeu (« le jeu s'ouvre plutôt que de se fermer
 * à double tour »), et il ne change pas pour elle.
 *
 * ## Aucune légendaire, pour l'instant
 *
 * Aucune n'est dessinée, et la fiche le dit : « pas de légendaire dans cette
 * série pour l'instant ». Le catalogue exige pourtant cinq légendaires par
 * série — avec raison, une série sans sommet donne des boosters qu'on ouvre
 * sans espoir. `catalogue-smoke.mjs` l'exempte donc **nommément**, et
 * l'exemption tombe d'elle-même le jour où la série en compte cinq.
 *
 * ## Le barème, celui des séries voisines
 *
 *   — chaque lignée monte `commune` → `rare` → `epique` ;
 *   — la puissance du cri suit : ~53 / ~66 / ~79, par la règle linéaire de
 *     `ages.js` (+13 par âge) ;
 *   — les modificateurs sont ceux de la famille, un bonus franc et un petit
 *     défaut qui se résorbe en grandissant (`modsAuStade`).
 *
 * Les deuxième et troisième âges ne sont écrits qu'en nom, histoire et cri,
 * dans `dex-ages.js` ; le reste s'en déduit.
 *
 * ## Les familles, et le geste des bâtons de sucre
 *
 * Les six premières lignées ont pris les six familles : la garde (fide), la
 * péniche (depl), le crieur de promenade (voix), le peintre d'enseignes
 * (tifo), la confiseuse (pyro), et la punk du grand boulevard (perc), qui bat
 * la mesure du talon de ses bottes sur le béton des marches. Les quatre
 * suivantes en reprennent quatre, une chacune, pour que la série reste
 * équilibrée : la coursière à vélo (depl), le gamin aux dinosaures de plâtre
 * (tifo), la danseuse aux grelots (perc) et le banlieusard au parapluie
 * (fide). La voix et la pyro passent en tête pour les suivantes.
 *
 * Les cinq d'après les rattrapent d'abord, puis en reprennent trois : la
 * ramendeuse du port (pyro), qui jette son filet pile quand la vague retombe ;
 * la gamine au moulinet (tifo) ; le gamin à la batte (fide), qui tient son
 * guichet sans frapper ; le gamin au cheval-bâton (depl), qui se balance
 * avant chaque haie ; et le petit livreur de lait (voix), qui fait sa tournée
 * au même pas tous les matins. La série compte alors trois lignées en fide,
 * depl et tifo, deux en voix, pyro et perc : ces trois-là passent en tête
 * pour les cinq dernières.
 *
 * Les cinq dernières les rattrapent, et deux familles en prennent une de
 * plus : le gamin aux gants trop grands (perc), qui frappe par séries de
 * quatre comme au sac de sable, d'où les salves ; le gamin au pion (fide),
 * qui joue à la pendule sans jamais la laisser tomber, d'où la tenue ;
 * le gamin à l'arc en bois (pyro), qui bande l'arc et lâche au bon temps,
 * d'où la relance ; le gamin du fauteuil tournant (voix), qui reprend en écho
 * la chanson du salon ; et le gamin aux boutons (tifo), qui coud ses motifs
 * de nacre bouton par bouton, d'où la mosaïque. Les vingt premières finissent
 * à quatre lignées en fide et tifo, trois dans les quatre autres familles.
 *
 * Les seconds humains (AN21 à AN40) commencent par rattraper ces quatre-là :
 * la petite poinçonneuse (voix), qui fait monter toute la file à son signal,
 * d'où le capo ; la gamine à la bague en fer-blanc (pyro), qui vise le
 * moindre reflet à la loupe avant de poser sa goutte d'émail, d'où la
 * visée ; la gamine à la burette (perc), qui tape sur les tuyaux des deux
 * mains l'une après l'autre comme les pistons de la grande pompe, d'où les
 * deux voix ; et le gamin au petit train (depl), qui connaît par cœur chaque
 * arrêt de la ligne du bord de mer, d'où la mémoire. La gamine au ballon rouge
 * (pyro), qui compte jusqu'à trois avant de lâcher la ficelle, d'où le
 * compte, donne une lignée de plus à la Pyro, la famille la plus mince du
 * catalogue. Vingt-cinq lignées : cinq en pyro, quatre dans chacune des cinq
 * autres familles ; les suivantes reprennent par celles-là.
 *
 * Le lot suivant donne donc une lignée à chacune des cinq : le gamin au
 * masque de carton (tifo), qui lève son masque et toute la pièce lève le sien,
 * d'où l'ola ; le gamin à la montre démontée (voix), qui fait le tic-tac
 * lui-même entre les secondes, d'où le contretemps ; la gamine au cierge
 * magique (perc), qui tape du pied de plus en plus vite à chaque étincelle
 * jusqu'au bouquet final, d'où le crescendo ; le petit allumeur (fide), qui
 * tient à deux mains une perche trop grande sans la lâcher, d'où la garde ;
 * et la petite fouilleuse de vase (depl), à qui le fleuve rend à la marée
 * suivante ce qu'il a repris, d'où le miroir. Trente lignées : cinq dans
 * chacune des six familles. Les trois variantes prises étaient les plus
 * minces de leur famille (huit chacune), ce qui laisse de la marge aux lots
 * suivants.
 *
 * L'allumeur, lui, n'avait pas le choix : les Fidélités comptaient
 * quatre-vingt-quatre personnages de premier âge dont quarante-deux à la
 * garde (`hold`), pile la moitié. Un quatre-vingt-cinquième à une variante
 * aurait mis le geste éponyme en minorité, ce que `catalogue:smoke` refuse.
 *
 * Le lot d'après donne encore une lignée à cinq familles sur six, et laisse
 * la Fidélité, déjà la plus grosse du catalogue (quatre-vingt-cinq
 * personnages de premier âge) : le gamin au jeton de manège (perc), qui cogne
 * la barrière à chaque choc des autos-tamponneuses ; le gamin à la truelle
 * (depl), qui se souvient de l'endroit de chaque chose déterrée, d'où la
 * mémoire ; la gamine à la motte d'argile (tifo), qui perce son bol trou par
 * trou jusqu'au motif, d'où la mosaïque ; la choriste de la cave (voix), qui
 * frappe dans ses mains entre les temps, d'où le contretemps ; et la gamine
 * au ruban perforé (pyro), qui compte chaque trou avant de donner la réponse,
 * d'où le compte. Trente-cinq lignées : six dans cinq familles, cinq en
 * fide ; la Fidélité passe en tête pour le lot suivant.
 *
 * Le gamin au jeton n'avait pas le choix de son geste : les Percussions
 * comptaient cinquante personnages de premier âge dont vingt-cinq au
 * martelage (`mash`), pile la moitié. Une cinquante et unième à une variante
 * aurait mis le geste éponyme en minorité ; il cogne donc, et le martelage
 * passe à vingt-six sur cinquante et un. La gamine au ruban laisse les Pyro
 * au même bord (dix-neuf relances sur trente-huit, pile la moitié) : la
 * prochaine Pyro devra relancer.
 *
 * Le lot suivant remet la Fidélité en tête et donne une lignée à quatre des
 * cinq autres familles ; seules les Percussions attendent : la petite
 * bobineuse (fide), qui suit des yeux le fil qui monte et descend sans le
 * lâcher, d'où la jauge — la plus rare des variantes de la Fidélité, onze
 * sur quatre-vingt-cinq, à un cheveu du plancher ; la gamine au pipeau
 * (voix), qui bat la mesure du pied même quand ses notes sont fausses, d'où
 * le tempo ; la gamine à la lampe de poche (depl), qui reprend à l'envers ce
 * que la grotte lui renvoie, d'où le miroir ; la gamine à la bille (pyro),
 * qui retient son souffle et ne lâche qu'au bon moment, d'où la relance ; et
 * la gamine au cerf-volant (tifo), qui sent venir chaque rafale, d'où la
 * ola. Quarante lignées : sept dans quatre familles, six en fide et en perc ;
 * les Percussions passent en tête pour le lot suivant.
 *
 * La gamine à la bille n'avait pas le choix de son geste : une variante de
 * plus aurait mis les Pyro sous la moitié de relances. Elle relance, et la
 * relance passe à vingt sur trente-neuf. Trois familles restent pile au
 * bord après ce lot : la garde à quarante-trois sur quatre-vingt-six,
 * l'écharpe à trente-deux sur soixante-quatre et le tifo à trente et un sur
 * soixante-deux. La prochaine lignée de chacune de ces trois familles devra
 * prendre le geste éponyme.
 *
 * Les créatures (AN41 à AN60) commencent par les Percussions, qui avaient
 * attendu, puis donnent une lignée à la Fidélité et à trois des quatre
 * autres familles ; le Déplacement attend : le petit écureuil roux (perc),
 * qui frappe le sol des deux pattes arrière, chacune à son rythme, d'où les
 * deux voix — la plus rare des variantes des Percussions, sept sur
 * cinquante et un ; la petite boîte aux lettres (fide), qui garde ce qu'on
 * lui confie jusqu'au facteur, d'où la garde ; la petite plume d'acier
 * (tifo), qui trace sa boucle sans lever la pointe, d'où le tifo ; la petite
 * perruche (voix), dont la nuée reprend les cris dans l'ordre, d'où le
 * capo — la plus rare des variantes de la Voix, neuf sur soixante et un ; et
 * le petit galet (pyro), qui attend que la vague se retire et part pile avec
 * elle, d'où la relance. Quarante-cinq lignées : huit en voix, pyro et tifo,
 * sept en perc, fide et depl ; ces trois-là passent en tête pour le lot
 * suivant.
 *
 * La boîte aux lettres et la plume n'avaient pas le choix (voir le lot
 * précédent) : la garde passe à quarante-quatre sur quatre-vingt-sept, le
 * tifo à trente-deux sur soixante-trois. L'écureuil laisse le martelage pile
 * à la moitié, vingt-six sur cinquante-deux : la prochaine Percussion devra
 * marteler. Le galet relance, vingt et une sur quarante ; mais les rouleaux
 * restent à cinq, pile le huitième de quarante : la prochaine Pyro devra
 * lancer des rouleaux. Le Déplacement, qui attend, reste au bord (l'écharpe à
 * trente-deux sur soixante-quatre) : sa prochaine lignée devra encore
 * prendre l'écharpe.
 *
 * Le lot suivant met le Déplacement en tête, puis donne une lignée aux
 * Percussions, à la Fidélité, à la Voix et à la Pyro ; le Tifo attend : le
 * petit chariot de théâtre (depl), qui fait le tour des places de la ville,
 * station après station, et recommence, d'où l'écharpe ; le petit phoque
 * gris (perc), qui claque le sable de ses nageoires aussi vite qu'il peut,
 * d'où le martelage ; la petite théière (fide), qui laisse infuser le temps
 * qu'il faut et pas une seconde de plus, d'où la tenue ; le chaton de
 * concours (voix), qui ronronne en mesure d'un bout à l'autre du jugement,
 * d'où le tempo ; et la petite anguille (pyro), qui se love puis se déroule
 * d'un coup dans le courant, d'où les rouleaux. Cinquante lignées : neuf en
 * voix et pyro, huit dans les quatre autres familles ; le Tifo passe en tête
 * pour le lot suivant.
 *
 * Le chariot, le phoque et l'anguille n'avaient pas le choix (voir le lot
 * précédent) : l'écharpe passe à trente-trois sur soixante-cinq, le
 * martelage à vingt-sept sur cinquante-trois, les rouleaux à six sur
 * quarante et un. La théière prend une variante, la seule chose que la
 * Fidélité pouvait encore se permettre : la garde reste à quarante-quatre,
 * pile la moitié de quatre-vingt-huit, et la prochaine Fidélité devra
 * garder. Le chaton prend le tempo, trente-trois sur soixante-trois.
 * Toutes les variantes restent au-dessus du plancher de `catalogue:smoke`.
 *
 * Le lot suivant met le Tifo en tête, puis donne une lignée à la Fidélité,
 * au Déplacement, aux Percussions et à la Pyro ; la Voix attend : la petite
 * tarte de cantine (tifo), qui saupoudre sa noix de coco en traçant un
 * grand rond sans en perdre un grain, d'où le tifo ; la petite loutre
 * (fide), qui tient un galet plat en équilibre sur sa tête sans jamais le
 * laisser tomber, d'où la garde ; la petite cabine crème (depl), qui
 * apprend par cœur tous les numéros du port, d'où la mémoire ; la petite
 * tige de rhubarbe (perc), qu'on entend pousser dans le noir de la remise,
 * craquement après craquement, de plus en plus vite, d'où le crescendo ; et
 * la petite marmite (pyro), qui mijote longtemps et soulève son couvercle
 * pile quand c'est prêt, d'où la relance. Cinquante-cinq lignées : dix en
 * pyro, neuf dans les cinq autres familles ; la Pyro attend le dernier lot,
 * qui donnera une lignée à chacune des cinq autres.
 *
 * La loutre n'avait pas le choix (voir le lot précédent) : la garde passe à
 * quarante-cinq sur quatre-vingt-neuf. La tarte prend le geste éponyme, le
 * tifo passe à trente-trois sur soixante-quatre. La cabine et la rhubarbe
 * prennent des variantes, la mémoire à quatorze sur soixante-six et le
 * crescendo à dix sur cinquante-quatre ; elles laissent l'écharpe et le
 * martelage pile à la moitié (trente-trois sur soixante-six, vingt-sept sur
 * cinquante-quatre) : la prochaine lignée du Déplacement devra prendre
 * l'écharpe, la prochaine Percussion marteler. La marmite relance, vingt-deux
 * sur quarante-deux. Aucun geste principal ne passe en minorité, et toutes
 * les variantes restent au-dessus du plancher de `catalogue:smoke`.
 *
 * Le dernier lot donne une lignée à chacune des cinq autres familles ; la
 * Pyro, déjà à dix, attend : le petit terrier des filatures (voix), qui
 * aboie dans la grande salle vide et refait coup pour coup ce que l'écho
 * lui renvoie, d'où l'écho ; le petit macareux (perc), qui bat des ailes
 * aussi vite qu'il peut pour repartir de sa falaise, d'où le martelage ; la
 * petite oie (depl), qui marche des jours entiers jusqu'à la grande foire,
 * d'où l'écharpe ; le petit ver du puits (tifo), qu'une vague parcourt
 * anneau après anneau quand il se dresse, d'où l'ola ; et le petit pigeon
 * voyageur (fide), qui corrige son cap au moindre coup de vent, ni trop ni
 * trop peu, d'où la jauge. Soixante lignées : dix dans chacune des six
 * familles.
 *
 * L'oie et le macareux n'avaient pas le choix (voir le lot précédent) :
 * l'écharpe passe à trente-quatre sur soixante-sept, le martelage à
 * vingt-huit sur cinquante-cinq. Le terrier, le ver et le pigeon prennent
 * des variantes : l'écho passe à onze sur soixante-quatre, l'ola à onze sur
 * soixante-cinq, la jauge à treize sur quatre-vingt-dix. Le tempo reste à
 * trente-trois sur soixante-quatre, le tifo à trente-trois sur
 * soixante-cinq, et la garde pile à la moitié, quarante-cinq sur
 * quatre-vingt-dix. Aucun geste principal ne passe en minorité, et toutes
 * les variantes restent au-dessus du plancher de `catalogue:smoke`.
 *
 * La burette n'a pas le choix de son geste. Les Percussions comptaient
 * quarante-huit personnages de premier âge dont six aux `deuxvoix` — pile le
 * huitième. Une quarante-neuvième au geste éponyme aurait fait passer les
 * deux voix sous le plancher de `catalogue:smoke` ; elle les remonte à sept
 * sur quarante-neuf, ce qui laisse la place à une Percussion au martelage
 * dans le lot suivant.
 *
 * Le geste de la confiseuse n'est pas libre. Les Pyro comptaient trente-deux
 * personnages de premier âge dont quatre aux `rouleaux` — pile le huitième que
 * `catalogue:smoke` exige d'une variante. Un trente-troisième Pyro au geste
 * éponyme aurait fait passer les rouleaux sous le plancher. Elle lance donc
 * ses bâtons de sucre par-dessus la rambarde, ce qui est exactement le geste,
 * et les rouleaux remontent à cinq sur trente-trois.
 *
 * Même calcul pour le gamin aux dinosaures : les Tifo comptaient cinquante-six
 * personnages de premier âge dont sept à l'`ola`, pile le huitième. Un
 * cinquante-septième au geste éponyme l'aurait fait passer dessous. Il lève
 * donc la vague — l'échine de plâtre qui se dresse d'un bout à l'autre de la
 * tribune —, et l'ola passe à huit sur cinquante-sept.
 */

/**
 * La série.
 *
 * `AN` comme ANgleterre : deux lettres, comme les treize autres, pour que
 * `racineDe` lise sans hésiter où finit la série et où commence le numéro.
 *
 * Le vert bouteille de la pelouse sous la pluie : c'est la seule couleur que
 * vingt clubs aux couleurs différentes ont en commun. Il reste à distance du
 * vert du Déplacement (`#1E9E6A`), plus clair et plus vif.
 */
export const SET_TERRACES = {
  id: 'AN',
  nom: 'LES TERRACES',
  ligne: 'debout sous le crachin, et le thé a déjà refroidi',
  c1: '#3B7A57',
  c2: '#0F1913',
};

/**
 * Les soixante premiers âges. Leurs suites sont dans `dex-ages.js`.
 *
 * `set` est posé une fois, en bas, comme dans `dex-saison.js` : soixante
 * fois le même mot, ce sont soixante occasions de l'oublier.
 */
const PREMIERS_AGES = [

  /* AN1 — la garde : le gamin qui donne ses miettes au seul corbeau qui ne
     s'envole pas, et qui finit par veiller sur toute la volée. Rouge vif,
     manches blanches. La fidélité tient : elle reste. */
  { id: 'AN1', nom: 'Le Petit Visiteur de la Tour', type: 'fide', stage: 1, rar: 'commune',
    histoire: 'Il était venu visiter la vieille forteresse un jour sans match. Un corbeau '
      + 's’est posé sur son épaule et n’en est plus reparti : depuis, ils vont au stade à '
      + 'deux, avec un sachet de miettes.',
    mods: { holdBonus: 1.16, tempoWindow: 0.92 },
    cri: { label: 'UNE MIETTE CHACUN', gest: 'hold', power: 53 } },

  /* AN2 — le déplacement par les canaux : la péniche peinte de roses et de
     châteaux. Bordeaux et bleu ciel. */
  { id: 'AN2', nom: 'Le Gamin de l’Écluse', type: 'depl', stage: 1, rar: 'commune',
    histoire: 'Assis sur la porte de l’écluse, il regardait passer les péniches peintes en '
      + 'se demandant où elles allaient. Il l’a compris un samedi : à l’extérieur, à six '
      + 'kilomètres à l’heure.',
    mods: { breathBonus: 1.15, parryResist: 0.92 },
    cri: { label: 'ON ATTEND L’ÉCLUSE', gest: 'echarpe', power: 54 } },

  /* AN3 — la voix du bord de mer : le loueur de transats qui crie sa
     marchandise sous la pluie. Rayures rouges et noires. */
  { id: 'AN3', nom: 'Le Loueur de Transats', type: 'voix', stage: 1, rar: 'commune',
    histoire: 'Il loue des transats sur une promenade où il pleut neuf jours sur dix. Il '
      + 'les annonce quand même, à pleine voix, au rythme des vagues — et le dixième jour, '
      + 'il a raison.',
    mods: { tempoWindow: 1.16, refundBonus: 0.92 },
    cri: { label: 'UN TRANSAT, MONSIEUR ?', gest: 'tempo', power: 53 } },

  /* AN4 — le tifo à la main : l'enseigne de pub peinte, sans une lettre.
     Rayures rouges et blanches. */
  { id: 'AN4', nom: 'Le Gamin du Comptoir', type: 'tifo', stage: 1, rar: 'commune',
    histoire: 'Trop jeune pour entrer, il attend sur le trottoir que son père finisse sa '
      + 'pinte. Il regarde l’enseigne peinte grincer au vent, et il la recopie sur tout ce '
      + 'qu’il trouve.',
    mods: { parryBonus: 1.17, mashBonus: 0.91 },
    cri: { label: 'JE LA REPEINDRAI', gest: 'tifo', power: 52 } },

  /* AN5 — la pyro sucrée : le bâton de sucre rayé du front de mer, cuit au
     cuivre et lancé par-dessus la rambarde. Rayures bleues et blanches. Son
     défaut : le sucre coûte, et elle en donne plus qu'elle n'en vend. */
  { id: 'AN5', nom: 'La Gamine au Sucre d’Orge', type: 'pyro', stage: 1, rar: 'commune',
    histoire: 'Sur la plage de galets, elle suce un bâton de sucre rayé plus long que sa '
      + 'main. Au but, elle lance tous ses bonbons par-dessus la rambarde, et elle le '
      + 'regrette jusqu’à la mi-temps.',
    mods: { perfectBonus: 1.18, costPenalty: 1.06 },
    cri: { label: 'ATTENTION, ÇA COLLE', gest: 'rouleaux', power: 54 } },

  /* AN6 — la percussion des bottes : la lycéenne trop sage de la grande rue
     des boutiques, qui finit reine punk, épingles comprises. Bleu roi et
     blanc. Le petit baladeur à cassettes la suit jusqu'au troisième âge. Son
     défaut : elle tape si fort qu'elle s'essouffle avant le refrain. */
  { id: 'AN6', nom: 'La Timide du Grand Boulevard', type: 'perc', stage: 1, rar: 'commune',
    histoire: 'Elle remonte la grande rue des boutiques en uniforme, le blouson de cuir bleu '
      + 'plié sur le bras : elle n’ose pas encore le mettre. Dans son baladeur, une cassette '
      + 'prêtée, et le pied qui bat la mesure sans qu’elle s’en rende compte.',
    mods: { mashBonus: 1.16, breathBonus: 0.92 },
    cri: { label: 'J’OSE PAS ENCORE', gest: 'mash', power: 53 } },

  /* AN7 — le déplacement à vélo : la coursière qui crève sous la pluie et
     finit reine du vélodrome sur une roue géante. Bleu ciel et blanc. La
     petite sonnette de laiton la suit jusqu'au troisième âge. Elle fait
     tourner sa roue comme on fait tourner l'écharpe ; son défaut : elle part
     si vite qu'elle se fait surprendre au premier contre. */
  { id: 'AN7', nom: 'La Coursière à Vélo', type: 'depl', stage: 1, rar: 'commune',
    histoire: 'Elle livre des plis dans toute la ville, sous la pluie, et elle crève toujours '
      + 'au pied des trois clochers. Elle finit le chemin à pied jusqu’au stade, la roue sous '
      + 'le bras, la pompe à la main, et elle sourit quand même.',
    mods: { breathBonus: 1.16, parryResist: 0.92 },
    cri: { label: 'ENCORE UNE CREVAISON', gest: 'echarpe', power: 53 } },

  /* AN8 — le tifo de plâtre : le gamin fasciné par les vieux dinosaures
     sculptés du parc, qui finit par en devenir un. Rayures rouges et bleues.
     Les lunettes rondes restent sur son nez jusqu'au troisième âge. Il lève
     la vague (voir l'en-tête) ; son défaut : il s'émerveille, et il oublie de
     souffler. */
  { id: 'AN8', nom: 'Le Gamin au Dinosaure en Plâtre', type: 'tifo', stage: 1, rar: 'commune',
    histoire: 'Dans le vieux parc embrumé, il connaît chaque monstre de plâtre par son nom. '
      + 'Il garde une petite figurine rayée tout contre ses lunettes, et quand la tribune se '
      + 'lève, il la lève avec elle.',
    mods: { parryBonus: 1.17, breathBonus: 0.92 },
    cri: { label: 'ILS SONT VIVANTS', gest: 'ola', power: 52 } },

  /* AN9 — la percussion des grelots : la danseuse folklorique qu'on
     n'entendait que de loin, et dont les grelots finissent par faire trembler
     la tribune. Bleu et blanc. Le mouchoir blanc reste à sa ceinture jusqu'au
     troisième âge. Elle accélère à chaque refrain, d'où le crescendo ; son
     défaut : elle ne sait pas rester immobile. */
  { id: 'AN9', nom: 'La Danseuse aux Grelots', type: 'perc', stage: 1, rar: 'commune',
    histoire: 'Mouchoirs blancs, grelots aux tibias, baudriers bleus un peu de travers : elle '
      + 'débute dans la troupe de danse du village. On ne l’entend encore que de loin, mais '
      + 'elle accélère à chaque refrain.',
    mods: { mashBonus: 1.15, holdBonus: 0.92 },
    cri: { label: 'ÉCOUTEZ LES GRELOTS', gest: 'crescendo', power: 53 } },

  /* AN10 — la fidélité du parapluie : le monsieur du train de 7 h 42,
     toujours trop poli, qui finit par abriter tout le virage. Blanc et noir.
     La moustache blanche reste impeccable jusqu'au troisième âge. Il tient
     son parapluie sans jamais le lâcher trop tôt, d'où la tenue ; son
     défaut : il ne se presse jamais. */
  { id: 'AN10', nom: 'Le Banlieusard au Parapluie', type: 'fide', stage: 1, rar: 'commune',
    histoire: 'Il prend le train de 7 h 42 depuis trente ans, costume rayé, chapeau melon, '
      + 'parapluie blanc plié au bras. Il s’excuse quand on le bouscule, et il n’a jamais '
      + 'manqué un coup d’envoi.',
    mods: { holdBonus: 1.17, mashBonus: 0.91 },
    cri: { label: 'PARDON, EXCUSEZ-MOI', gest: 'tenue', power: 52 } },
  /* AN11 — la pyro du port : la ramendeuse qui raccommodait les filets sur le
     quai et finit par porter le grand chalut comme un manteau. Ambre et noir.
     Le petit filet noir reste à son bras jusqu'au troisième âge. Elle jette
     son filet à l'instant juste, d'où la visée ; son défaut : chaque maille
     lui coûte. */
  { id: 'AN11', nom: 'La Ramendeuse du Port', type: 'pyro', stage: 1, rar: 'commune',
    histoire: 'Sur le quai mouillé, elle raccommode les filets maille après maille, l’aiguille '
      + 'de bois à la main. Elle ne lève les yeux qu’à l’instant où le bateau passe la jetée, '
      + 'et elle ne s’est jamais trompée d’une seconde.',
    mods: { perfectBonus: 1.17, costPenalty: 1.06 },
    cri: { label: 'MAILLE APRÈS MAILLE', gest: 'visee', power: 53 } },

  /* AN12 — le tifo du vent : la gamine au moulinet de papier qui finit par
     porter un vrai moulin. Bleu et blanc. La farine reste sur sa joue jusqu'au
     troisième âge. Ses ailes dessinent la forme au-dessus de la tribune ; son
     défaut : elle tourne au vent, et elle perd le tempo. */
  { id: 'AN12', nom: 'La Gamine au Moulinet', type: 'tifo', stage: 1, rar: 'commune',
    histoire: 'Elle courait contre le vent dans les champs, un moulinet de papier bleu et blanc '
      + 'tendu à bout de bras, de la farine plein la joue. Les jours de match, elle le fait '
      + 'tourner au-dessus de la tribune, et elle rit avant tout le monde.',
    mods: { parryBonus: 1.16, tempoWindow: 0.92 },
    cri: { label: 'PLUS DE VENT !', gest: 'tifo', power: 53 } },

  /* AN13 — la fidélité du guichet : le gamin qui ratait toutes les balles sur
     la pelouse du village et finit capitaine de tout le comté. Blanc, jaune et
     bleu. La casquette bleue reste dans son casque jusqu'au troisième âge. Il
     tient son guichet sans frapper chaque balle, d'où la retenue ; son
     défaut : il garde son souffle pour plus tard. */
  { id: 'AN13', nom: 'Le Gamin à la Batte', type: 'fide', stage: 1, rar: 'commune',
    histoire: 'Sur la pelouse du village, il rate toutes les balles avec une batte bien trop '
      + 'grande pour lui et une seule jambière. Il reste quand même au guichet jusqu’au soir, '
      + 'sans jamais lâcher, au cas où la prochaine serait la bonne.',
    mods: { holdBonus: 1.16, breathBonus: 0.92 },
    cri: { label: 'ENCORE UNE BALLE', gest: 'retenue', power: 53 } },

  /* AN14 — le déplacement au galop : le gamin au cheval-bâton qui finit dans
     un grand costume de cheval de pantomime. Rouge et blanc. Le petit
     cheval-bâton ne le quitte pas jusqu'au troisième âge. Il se balance
     d'avant en arrière avant chaque haie, d'où la bascule ; son défaut : il ne
     tient pas en place. */
  { id: 'AN14', nom: 'Le Gamin au Cheval-Bâton', type: 'depl', stage: 1, rar: 'commune',
    histoire: 'Il galope dans les rues sur un cheval-bâton à bonnet rouge, une casaque trop '
      + 'grande sur le dos, et il saute chaque bordure de trottoir comme une haie. Les jours '
      + 'de match, il fait tout le chemin jusqu’au stade au petit galop.',
    mods: { breathBonus: 1.15, holdBonus: 0.92 },
    cri: { label: 'HOP, UNE HAIE', gest: 'bascule', power: 54 } },

  /* AN15 — la voix de l'aube : le petit livreur de lait qui finit par porter
     toute la voiture de livraison. Bleu ciel, blanc et un peu de marine. La
     casquette plate reste sous le toit jusqu'au troisième âge. Il fait sa
     tournée au même pas tous les matins, d'où le tempo ; son défaut : il est
     encore à moitié endormi quand il faut frapper. */
  { id: 'AN15', nom: 'Le Petit Livreur de Lait', type: 'voix', stage: 1, rar: 'commune',
    histoire: 'À l’aube, sous la pluie, il dépose quatre bouteilles de lait sur chaque perron, '
      + 'la casquette trempée, à moitié endormi. Il siffle toujours le même air, au même pas, '
      + 'et toute la rue se réveille en mesure.',
    mods: { tempoWindow: 1.16, mashBonus: 0.92 },
    cri: { label: 'LE LAIT, LE LAIT !', gest: 'tempo', power: 53 } },

  /* AN16 — la percussion des poings : le gamin perdu dans des gants trop
     grands qui finit champion à l'ancienne, à la loyale. Rouge, blanc et
     noir. La moustache cirée reste jusqu'au troisième âge. Il frappe par
     séries de quatre, comme au sac de sable, d'où les salves ; son défaut :
     il s'emballe et perd la cadence. */
  { id: 'AN16', nom: 'Le Gamin aux Gants Trop Grands', type: 'perc', stage: 1, rar: 'commune',
    histoire: 'Les gants rouges lui arrivent aux coudes et il a peur de son ombre. Il lève quand '
      + 'même la garde, comme sur les vieilles photos, et il tape quatre fois de suite sur le sac '
      + 'du club de boxe, jamais plus, jamais moins.',
    mods: { mashBonus: 1.16, tempoWindow: 0.92 },
    cri: { label: 'GARDE HAUTE !', gest: 'salves', power: 53 } },

  /* AN17 — la fidélité de l'échiquier : le gamin au pion du jeu d'échecs
     géant du parc, qui finit roi noir et blanc. Rayures noir et blanc. Le
     petit pion blanc pend à sa ceinture jusqu'au troisième âge. Il joue à la
     pendule sans jamais laisser tomber son temps, d'où la tenue ; son défaut :
     il réfléchit avant de frapper. */
  { id: 'AN17', nom: 'Le Gamin au Pion', type: 'fide', stage: 1, rar: 'commune',
    histoire: 'Sous la pluie du parc, il serre contre lui un grand pion blanc du jeu d’échecs '
      + 'géant, le seul qu’on lui laisse jouer. Il attend son tour sans bouger, une heure s’il le '
      + 'faut, et il n’a encore jamais perdu son pion.',
    mods: { holdBonus: 1.16, mashBonus: 0.92 },
    cri: { label: 'À MOI DE JOUER', gest: 'tenue', power: 52 } },

  /* AN18 — la pyro des fanions : le gamin qui jouait au hors-la-loi des
     vieilles ballades, en rouge et pas en vert, et dont les flèches portent
     des fanions au lieu de pointes. Rouge et blanc. La plume blanche reste à
     son capuchon jusqu'au troisième âge. Il bande l'arc, tient, et lâche au
     bon temps, d'où la relance ; son défaut : chaque flèche lui coûte. */
  { id: 'AN18', nom: 'Le Gamin à l’Arc en Bois', type: 'pyro', stage: 1, rar: 'commune',
    histoire: 'Capuchon rouge trop grand, plume blanche, un petit arc de bois et des flèches '
      + 'au bout de feutre rouge : il joue au hors-la-loi des vieilles ballades dans la rue. Il '
      + 'vise longtemps, il rit avant de tirer, et le fanion retombe toujours pile dans le virage.',
    mods: { perfectBonus: 1.17, costPenalty: 1.06 },
    cri: { label: 'TENEZ… ET LÂCHEZ !', gest: 'relance', power: 54 } },

  /* AN19 — la voix du salon : le gamin qui tournait sur le fauteuil du
     barbier en attendant son père et finit maître barbier. Rayures rouge et
     blanc. La moustache cirée reste jusqu'au troisième âge. Au salon, on
     chante à plusieurs voix et chacune reprend la phrase de l'autre, d'où
     l'écho ; son défaut : il rend moins qu'il ne prend. */
  { id: 'AN19', nom: 'Le Gamin du Fauteuil Tournant', type: 'voix', stage: 1, rar: 'commune',
    histoire: 'Il tourne sur le vieux fauteuil du barbier en attendant son père, le petit poteau '
      + 'rayé sur les genoux et un peigne derrière l’oreille. Les clients chantent à plusieurs '
      + 'voix en attendant leur tour, et lui reprend chaque phrase juste après eux.',
    mods: { tempoWindow: 1.16, refundBonus: 0.92 },
    cri: { label: 'ET UN TOUR DE PLUS', gest: 'echo', power: 53 } },

  /* AN20 — le tifo de nacre : le gamin qui cousait des boutons de nacre sur
     sa casquette et finit roi des marchés, couvert de milliers de boutons
     qui brillent. Bleu marine et blanc. Les boutons blancs restent sur sa
     coiffe jusqu'au troisième âge. Il coud ses motifs bouton par bouton,
     d'où la mosaïque ; son défaut : il s'essouffle à la tâche. */
  { id: 'AN20', nom: 'Le Gamin aux Boutons', type: 'tifo', stage: 1, rar: 'commune',
    histoire: 'Dans la rue du marché, il coud des boutons de nacre sur sa casquette marine, un '
      + 'par semaine, avec l’aiguille de sa grand-mère. Il n’en a encore que quatre, mais au '
      + 'soleil ils dessinent déjà une étoile.',
    mods: { parryBonus: 1.16, breathBonus: 0.92 },
    cri: { label: 'ENCORE UN BOUTON', gest: 'mosaique', power: 53 } },
  /* AN21 — la voix de l'impériale : la gamine qui jouait à poinçonner les
     tickets et finit receveuse en chef du bus à impériale, la cloche en main.
     Rouge vif et blanc. Les baskets rouges restent jusqu'au troisième âge.
     Elle fait monter toute la file à son signal, d'où le capo ; son défaut :
     elle ne tient pas en place. */
  { id: 'AN21', nom: 'La Petite Poinçonneuse', type: 'voix', stage: 1, rar: 'commune',
    histoire: 'À l’arrêt de bus, sous la pluie, elle poinçonne des tickets de papier blanc avec '
      + 'sa petite machine rouge en bandoulière. Toute la file attend son signal pour monter, et '
      + 'personne ne monte avant qu’elle l’ait dit.',
    mods: { tempoWindow: 1.16, holdBonus: 0.92 },
    cri: { label: 'TOUT LE MONDE MONTE !', gest: 'capo', power: 53 } },

  /* AN22 — la pyro de l'émail : la gamine à la bague de pacotille qui finit
     reine des émaux du vieux quartier des bijoutiers. Bordeaux et bleu ciel.
     La bague de fer-blanc reste à son doigt jusqu'au troisième âge. Elle vise
     le moindre reflet à la loupe avant de poser sa goutte, d'où la visée ;
     son défaut : chaque goutte lui coûte. */
  { id: 'AN22', nom: 'La Gamine à la Bague en Fer-Blanc', type: 'pyro', stage: 1, rar: 'commune',
    histoire: 'Dans l’atelier encombré du quartier des bijoutiers, elle lève une bague de '
      + 'fer-blanc à la lumière, la petite loupe remontée sur le front. Elle vise longtemps le '
      + 'moindre reflet avant de poser sa goutte d’émail, et elle ne la rate jamais.',
    mods: { perfectBonus: 1.17, costPenalty: 1.06 },
    cri: { label: 'PILE DANS LE SERTI', gest: 'visee', power: 54 } },

  /* AN23 — la pyro du grand ballon : la gamine au ballon rouge de la falaise
     qui finit aéronaute, sa nacelle d'osier autour de la taille. Rayures
     rouge et noir. Les baskets blanches restent jusqu'au troisième âge. Elle
     compte jusqu'à trois avant de lâcher la ficelle, d'où le compte ; son
     défaut : chaque envol lui coûte. */
  { id: 'AN23', nom: 'La Gamine au Ballon Rouge', type: 'pyro', stage: 1, rar: 'commune',
    histoire: 'Sur la falaise, dans le vent, elle serre la ficelle d’un petit ballon rayé rouge '
      + 'et noir. Elle compte jusqu’à trois avant chaque rafale, et le ballon monte toujours pile '
      + 'au bon moment, jamais avant.',
    mods: { perfectBonus: 1.18, costPenalty: 1.06 },
    cri: { label: 'TROIS, DEUX, UN…', gest: 'compte', power: 53 } },

  /* AN24 — la percussion des pistons : la gamine qui graissait tout ce qui
     grince et finit par devenir la grande machine à vapeur du bord du
     fleuve. Rayures rouge et blanc. Le foulard noué reste sur sa tête
     jusqu'au troisième âge. Elle frappe des deux mains l'une après l'autre,
     comme les deux pistons du balancier, d'où les deux voix ; son défaut :
     elle rend moins qu'elle ne prend. */
  { id: 'AN24', nom: 'La Gamine à la Burette', type: 'perc', stage: 1, rar: 'commune',
    histoire: 'Dans l’atelier humide, une trace de suie sur la joue, elle tient à deux mains une '
      + 'petite burette rouge et graisse tout ce qui grince. Puis elle tape sur les vieux tuyaux, '
      + 'une main après l’autre, comme les pistons de la grande pompe.',
    mods: { mashBonus: 1.16, refundBonus: 0.92 },
    cri: { label: 'ÇA NE GRINCE PLUS', gest: 'deuxvoix', power: 53 } },

  /* AN25 — le déplacement du bord de mer : le gamin au petit train de bois
     qui finit par marcher dans les vagues comme le vieux tram sur échasses.
     Rayures bleu et blanc. Les tongs restent à ses pieds jusqu'au troisième
     âge. Il connaît par cœur chaque arrêt de la ligne, d'où la mémoire ; son
     défaut : il frappe sans force. */
  { id: 'AN25', nom: 'Le Gamin au Petit Train', type: 'depl', stage: 1, rar: 'commune',
    histoire: 'Sur la promenade, il fait rouler un petit train de bois dans le sable mouillé, une '
      + 'poignée de conduite au manche bleu dans l’autre main. Il connaît par cœur chaque arrêt de '
      + 'la ligne du bord de mer, et il les annonce tous, dans l’ordre.',
    mods: { breathBonus: 1.16, mashBonus: 0.92 },
    cri: { label: 'PROCHAIN ARRÊT, LA PLAGE', gest: 'memoire', power: 53 } },
  /* AN26 — le tifo du bal masqué : le gamin qui découpait des masques dans
     les boîtes de céréales et finit roi du grand bal costumé des artistes du
     quartier. Bleu roi et blanc. Les mocassins éraflés restent à ses pieds
     jusqu'au troisième âge. Il lève son masque et toute la pièce lève le
     sien, d'où l'ola ; son défaut : il se met en scène et oublie de souffler. */
  { id: 'AN26', nom: 'Le Gamin au Masque de Carton', type: 'tifo', stage: 1, rar: 'commune',
    histoire: 'Dans son petit appartement en désordre, il découpe des masques dans les boîtes de '
      + 'céréales et les peint en bleu roi. Quand il en lève un, tout le monde dans la pièce lève '
      + 'le sien après lui, l’un après l’autre, comme une vague.',
    mods: { parryBonus: 1.16, breathBonus: 0.92 },
    cri: { label: 'TOUT LE MONDE MASQUÉ !', gest: 'ola', power: 52 } },

  /* AN27 — la voix des horlogers : le gamin qui démontait la montre de son
     grand-père sans savoir la remonter et finit couvert de rouages qui
     tournent tous à l'heure. Bleu ciel et blanc. Les petites lunettes rondes
     cerclées de fer restent sur son nez jusqu'au troisième âge. Il fait le
     tic-tac lui-même entre les secondes, d'où le contretemps ; son défaut :
     il s'inquiète, et il ne tient pas la note. */
  { id: 'AN27', nom: 'Le Gamin à la Montre Démontée', type: 'voix', stage: 1, rar: 'commune',
    histoire: 'À la table de la cuisine, il a ouvert la montre de son grand-père et trois petits '
      + 'rouages sont tombés. Il ne sait pas la remonter, alors il fait le tic-tac lui-même, entre '
      + 'les secondes, pour qu’elle ne s’arrête pas.',
    mods: { tempoWindow: 1.15, holdBonus: 0.92 },
    cri: { label: 'TIC… ET TAC', gest: 'contretemps', power: 53 } },

  /* AN28 — la percussion du feu d'artifice : la gamine qui avait peur de son
     cierge magique et finit reine du grand feu d'artifice du parc. Rayures
     rouge et bleu. Le bonnet rouge à pompon reste sur sa tête jusqu'au
     troisième âge. Elle tape du pied de plus en plus vite à chaque étincelle,
     jusqu'au bouquet final, d'où le crescendo ; son défaut : elle tient mal
     la distance. */
  { id: 'AN28', nom: 'La Gamine au Cierge Magique', type: 'perc', stage: 1, rar: 'commune',
    histoire: 'Par un soir de brume, dans le parc, elle tient son cierge magique à bout de bras, '
      + 'morte de peur. Mais à chaque étincelle elle tape du pied un peu plus vite, et quand il '
      + 's’éteint, elle danse.',
    mods: { mashBonus: 1.15, holdBonus: 0.92 },
    cri: { label: 'ENCORE UNE ÉTINCELLE', gest: 'crescendo', power: 53 } },

  /* AN29 — la fidélité des réverbères : le gamin qui courait derrière
     l'allumeur et finit par allumer toutes les lumières de la colline. Bleu
     et blanc. La vieille casquette plate reste sur sa tête jusqu'au troisième
     âge. Il tient à deux mains une perche trop grande sans jamais la lâcher,
     d'où la garde (voir l'en-tête) ; son défaut : il frappe sans force. */
  { id: 'AN29', nom: 'Le Petit Allumeur', type: 'fide', stage: 1, rar: 'commune',
    histoire: 'Sur les pavés, à la tombée du jour, il court derrière l’allumeur de réverbères '
      + 'avec une perche bleue bien trop grande pour lui. Il la tient à deux mains, la petite '
      + 'flamme tremble, mais il ne la lâche pas avant que toute la rue soit allumée.',
    mods: { holdBonus: 1.16, mashBonus: 0.92 },
    cri: { label: 'JE LA TIENS !', gest: 'hold', power: 52 } },

  /* AN30 — le déplacement de la grève : la gamine qui fouillait la vase à
     marée basse et finit reine des trésors que le fleuve rend. Blanc et
     noir. Les bottes de caoutchouc noires restent à ses pieds jusqu'au
     troisième âge. Le fleuve lui rend à la marée suivante ce qu'il a repris,
     d'où le miroir ; son défaut : elle se laisse surprendre au premier
     contre. */
  { id: 'AN30', nom: 'La Petite Fouilleuse de Vase', type: 'depl', stage: 1, rar: 'commune',
    histoire: 'À marée basse, sur la rive boueuse du fleuve, elle remplit son petit seau blanc de '
      + 'ce que l’eau a laissé : un bout de pipe en terre, un bouton, une clé. Le fleuve reprend '
      + 'tout à la marée haute, et le lui rend à la suivante.',
    mods: { breathBonus: 1.16, parryResist: 0.92 },
    cri: { label: 'CE QUE LE FLEUVE REND', gest: 'miroir', power: 53 } },

  /* AN31 — la percussion de la foire : le gamin qui serrait son unique jeton
     devant les autos-tamponneuses et finit roi de la grande foire d'automne.
     Ambre et noir. Le jeton de laiton reste à son cou jusqu'au troisième âge.
     Il cogne la barrière à chaque choc des petites voitures, d'où le
     martelage (voir l'en-tête) ; son défaut : il cogne à côté du temps. */
  { id: 'AN31', nom: 'Le Gamin au Jeton de Manège', type: 'perc', stage: 1, rar: 'commune',
    histoire: 'Devant la piste des autos-tamponneuses, sous le crachin, il serre son unique jeton '
      + 'de laiton. En attendant son tour, il tape du poing sur la barrière à chaque choc des '
      + 'petites voitures, et toute la barrière tremble avec lui.',
    mods: { mashBonus: 1.16, tempoWindow: 0.92 },
    cri: { label: 'ENCORE UN TOUR !', gest: 'mash', power: 53 } },

  /* AN32 — le déplacement du tertre : le gamin qui creusait le champ avec une
     truelle et finit par ressembler au vieux roi trouvé sous la colline. Bleu
     et blanc. Les chaussures de marche boueuses restent à ses pieds jusqu'au
     troisième âge. Il sait où était chaque chose qu'il a déterrée, d'où la
     mémoire ; son défaut : il lâche trop tôt ce qu'il tient. */
  { id: 'AN32', nom: 'Le Gamin à la Truelle', type: 'depl', stage: 1, rar: 'commune',
    histoire: 'Accroupi dans le champ de sable derrière chez lui, il gratte la terre avec une '
      + 'petite truelle au manche bleu. Il n’a trouvé qu’un vieux rivet rouillé, mais il se '
      + 'souvient de l’endroit exact de chaque chose qu’il a déterrée.',
    mods: { breathBonus: 1.15, holdBonus: 0.92 },
    cri: { label: 'ICI, IL Y AVAIT…', gest: 'memoire', power: 53 } },

  /* AN33 — le tifo de la faïence ajourée : la gamine qui pétrissait une motte
     d'argile toute tordue et finit reine de la faïence crème percée de
     dentelles. Blanc, jaune et bleu. Le crayon planté dans son chignon y reste
     jusqu'au troisième âge. Elle perce son bol trou par trou jusqu'à ce que
     les trous fassent un motif, d'où la mosaïque ; son défaut : elle se
     perd dans le détail et rate le temps. */
  { id: 'AN33', nom: 'La Gamine à la Motte d’Argile', type: 'tifo', stage: 1, rar: 'commune',
    histoire: 'Devant un petit tour de potier, elle pétrit une motte d’argile toute tordue, de '
      + 'l’argile jusqu’au bout du nez. Sur l’étagère sèche un bol crème qu’elle a percé de '
      + 'petits trous, un par un, jusqu’à ce qu’ils dessinent une dentelle.',
    mods: { parryBonus: 1.16, tempoWindow: 0.92 },
    cri: { label: 'TROU PAR TROU', gest: 'mosaique', power: 53 } },

  /* AN34 — la voix des caves : la gamine qui chantait en sourdine au fond de
     la cave aux concerts et finit reine de la scène beat. Rouge et blanc. Le
     petit micro rouge de la cave reste dans sa main jusqu'au troisième âge.
     Elle frappe dans ses mains entre les temps, là où tape la batterie, d'où
     le contretemps ; son défaut : elle n'ose pas encore, et rend mal ce
     qu'on lui donne. */
  { id: 'AN34', nom: 'La Choriste de la Cave', type: 'voix', stage: 1, rar: 'commune',
    histoire: 'Tout au fond d’une cave de brique où l’on joue très fort, elle serre contre elle un '
      + 'petit micro rouge et chante en sourdine, la bouche presque fermée. Elle frappe dans ses '
      + 'mains entre les temps, là où tape la batterie, et personne ne l’entend encore.',
    mods: { tempoWindow: 1.16, refundBonus: 0.92 },
    cri: { label: 'SUR LE DEUX ET LE QUATRE', gest: 'contretemps', power: 53 } },

  /* AN35 — la pyro des premières machines : la gamine qui perçait des trous
     dans des rubans de papier et finit reine de la première grande machine à
     calculer de la ville. Bleu ciel et blanc, un peu de marine. Les lunettes à
     monture d'écaille restent sur son nez jusqu'au troisième âge. Elle compte
     chaque trou à voix basse avant de donner la réponse, d'où le compte ;
     son défaut : chaque calcul lui coûte. */
  { id: 'AN35', nom: 'La Gamine au Ruban Perforé', type: 'pyro', stage: 1, rar: 'commune',
    histoire: 'Un jour de pluie, à son bureau, elle perce de petits trous dans un ruban de papier '
      + 'qui sort d’une bobine bleu ciel, un crayon derrière l’oreille. Elle compte chaque trou à '
      + 'voix basse, et au dernier, elle a la réponse.',
    mods: { perfectBonus: 1.17, costPenalty: 1.06 },
    cri: { label: 'UN, DEUX, TROIS… TROUVÉ !', gest: 'compte', power: 54 } },

  /* AN36 — la fidélité des filatures : la gamine qui rattrapait les bobines
     tombées dans l'allée de la filature et finit reine des mille métiers à
     tisser. Rouge, blanc et noir ; ni cornes, ni fourche, ni trident. Le
     foulard de coton rouge reste dans ses cheveux jusqu'au troisième âge.
     Elle suit des yeux le fil qui monte et descend sans jamais le lâcher,
     d'où la jauge (voir l'en-tête) ; son défaut : elle en perd le temps. */
  { id: 'AN36', nom: 'La Petite Bobineuse', type: 'fide', stage: 1, rar: 'commune',
    histoire: 'Dans l’allée poussiéreuse de la filature, elle court ramasser les bobines blanches '
      + 'qui tombent des métiers, la petite navette rouge à la main et du coton plein les '
      + 'cheveux. Quand le fil monte et descend, elle le suit des yeux sans jamais le lâcher.',
    mods: { holdBonus: 1.16, tempoWindow: 0.92 },
    cri: { label: 'LE FIL NE CASSE PAS', gest: 'jauge', power: 53 } },

  /* AN37 — la voix de la petite cornemuse du Nord : la gamine qui soufflait
     faux dans un pipeau en plastique et finit reine des bourdons, ceux qui se
     jouent au soufflet. Noir et blanc. La mèche blanche reste dans ses
     cheveux jusqu'au troisième âge. Ses notes sont fausses mais son pied bat
     juste, d'où le tempo ; son défaut : elle ne sait pas presser. */
  { id: 'AN37', nom: 'La Gamine au Pipeau', type: 'voix', stage: 1, rar: 'commune',
    histoire: 'Sur le quai battu par le vent, elle souffle dans un pipeau en plastique, le petit '
      + 'sac de cornemuse à carreaux coincé sous le bras. Les notes sortent fausses, mais elle '
      + 'bat la mesure du pied, et elle ne la perd jamais.',
    mods: { tempoWindow: 1.16, mashBonus: 0.92 },
    cri: { label: 'UN, DEUX, ET SOUFFLE !', gest: 'tempo', power: 53 } },

  /* AN38 — le déplacement sous la ville : la gamine qui descendait avec une
     lampe de poche dans les grottes creusées sous la ville et finit reine du
     grès rouge. Rouge et blanc. Les vieilles chaussures éraflées restent à
     ses pieds jusqu'au troisième âge. Elle reprend à l'envers ce que la
     grotte lui renvoie, d'où le miroir ; son défaut : elle encaisse mal. */
  { id: 'AN38', nom: 'La Gamine à la Lampe de Poche', type: 'depl', stage: 1, rar: 'commune',
    histoire: 'Sur les vieilles marches de grès qui descendent sous la ville, son casque rouge '
      + 'trop grand de travers, elle braque sa petite lampe de poche dans le noir et chante. La '
      + 'grotte lui renvoie son chant, et elle le reprend à l’envers, pour rire.',
    mods: { breathBonus: 1.16, parryResist: 0.92 },
    cri: { label: 'EH HO… OH HE !', gest: 'miroir', power: 53 } },

  /* AN39 — la pyro des verreries : la gamine qui regardait le monde à
     travers une bille de verre et finit reine du verre soufflé au bord du
     fleuve. Rouge et blanc. Les baskets rouges restent à ses pieds jusqu'au
     troisième âge. Elle retient son souffle et ne lâche la bille qu'au bon
     moment, d'où la relance (voir l'en-tête) ; son défaut : chaque tir lui
     coûte. */
  { id: 'AN39', nom: 'La Gamine à la Bille', type: 'pyro', stage: 1, rar: 'commune',
    histoire: 'Elle regarde le monde à travers une bille de verre rouge et blanche, un œil fermé, '
      + 'une petite bourse de billes à la ceinture. Avant de tirer, elle retient son souffle, '
      + 'longtemps, et ne lâche la bille qu’au tout dernier moment.',
    mods: { perfectBonus: 1.17, costPenalty: 1.06 },
    cri: { label: 'PILE DANS LE ROND !', gest: 'relance', power: 54 } },

  /* AN40 — le tifo de la colline : la gamine dont le cerf-volant finissait
     toujours dans les arbres et qui finit reine des vents au-dessus de la
     ville. Bleu marine et blanc. Le bandeau bleu marine reste dans ses
     cheveux jusqu'au troisième âge. Elle sent venir chaque rafale avant tout
     le monde, d'où la ola ; son défaut : elle s'essouffle à courir après. */
  { id: 'AN40', nom: 'La Gamine au Cerf-Volant', type: 'tifo', stage: 1, rar: 'commune',
    histoire: 'Au sommet de la colline venteuse, elle serre contre elle un petit cerf-volant de '
      + 'papier bleu marine et blanc tout froissé, la ficelle emmêlée au poignet. Il finit '
      + 'toujours dans les arbres, mais elle sent venir chaque rafale avant tout le monde.',
    mods: { parryBonus: 1.16, breathBonus: 0.92 },
    cri: { label: 'LA VOILÀ, LA RAFALE !', gest: 'ola', power: 52 } },

  /* AN41 — la fidélité de la boîte aux lettres de fonte : la petite boîte
     du mur qui avalait les cartes postales des touristes et finit grande
     poste rouge, gardienne de tout le courrier de la ville. Rouge vif et
     blanc ; ni lettres, ni chiffre royal. La carte postale dépasse de sa
     fente jusqu'au troisième âge. Ce qu'on lui confie, elle le garde jusqu'au
     facteur, d'où la garde (voir l'en-tête) ; son défaut : elle ne se presse
     jamais. */
  { id: 'AN41', nom: 'La Petite Boîte aux Lettres', type: 'fide', stage: 1, rar: 'commune',
    histoire: 'Fixée au mur sous la pluie, elle avale une à une les cartes postales des touristes '
      + '; il y en a toujours une qui dépasse de sa fente, et le petit sac postal rouge ne quitte '
      + 'jamais son épaule. Ce qu’on lui confie, elle le garde, et elle ne le rend qu’au facteur.',
    mods: { holdBonus: 1.16, mashBonus: 0.92 },
    cri: { label: 'RIEN NE SE PERD', gest: 'hold', power: 53 } },

  /* AN42 — le tifo des ateliers de plumes : la petite plume d'acier qui
     faisait des pâtés d'encre et finit grande plume, maîtresse de la belle
     écriture, dans la ville qui fabriquait les plumes du monde entier.
     Bordeaux et bleu ciel ; ni lettres ni mots dans ses arabesques. La petite
     tache bordeaux reste au bout de sa pointe jusqu'au troisième âge. Elle
     trace sa boucle sans lever la pointe, d'où le tifo (voir l'en-tête) ;
     son défaut : elle en perd le rythme. */
  { id: 'AN42', nom: 'La Petite Plume d’Acier', type: 'tifo', stage: 1, rar: 'commune',
    histoire: 'Un peu tordue, une grosse tache d’encre bordeaux au bout de la pointe, elle serre '
      + 'contre elle son petit flacon d’encre et fait des pâtés partout. Mais quand elle trace '
      + 'enfin une boucle sans lever la pointe, toute la page s’arrête pour la regarder.',
    mods: { parryBonus: 1.16, tempoWindow: 0.92 },
    cri: { label: 'SANS LEVER LA POINTE !', gest: 'tifo', power: 52 } },

  /* AN43 — la percussion de l'île aux écureuils : le petit écureuil roux
     qui perdait toujours ses noisettes et finit gardien de l'île de la baie,
     où vivent les derniers de son espèce. Rouge et noir ; ni arbres ni
     feuilles. La noisette reste glissée derrière son oreille jusqu'au
     troisième âge. Il frappe le sol des deux pattes arrière, chacune à son
     rythme, d'où les deux voix (voir l'en-tête) ; son défaut : rien ne lui
     revient. */
  { id: 'AN43', nom: 'Le Petit Écureuil Roux', type: 'perc', stage: 1, rar: 'commune',
    histoire: 'Assis sur ses pattes arrière, une noisette serrée entre les pattes de devant, il '
      + 'laisse filer toutes les autres par sa sacoche ouverte. Quand quelque chose bouge, il '
      + 'frappe le sol des deux pattes arrière, chacune à son rythme, et toute l’île l’entend.',
    mods: { mashBonus: 1.16, refundBonus: 0.92 },
    cri: { label: 'TAP… TAP-TAP !', gest: 'deuxvoix', power: 53 } },

  /* AN44 — la voix des perruches sauvages de l'ouest de la ville : la petite
     perruche échappée qui criait sur les toits et finit reine de toutes les
     nuées qui volent au-dessus du fleuve. Rouge et blanc sur plumage vert
     (dessinée sur fond magenta). Le bonnet à pompon rouge et blanc reste sur
     sa tête jusqu'au troisième âge. Elle lance un cri, puis deux, puis trois,
     et la nuée les reprend dans l'ordre, d'où le capo ; son défaut : elle ne
     tient pas en place. */
  { id: 'AN44', nom: 'La Petite Perruche', type: 'voix', stage: 1, rar: 'commune',
    histoire: 'Échappée on ne sait d’où, ébouriffée de froid sur les toits de l’ouest de la ville, '
      + 'le bonnet à pompon rouge et blanc trop grand qui lui glisse sur l’œil, elle crie plus '
      + 'fort que toute la nuée. Elle lance un cri, puis deux, puis trois, et les autres les '
      + 'reprennent dans l’ordre.',
    mods: { tempoWindow: 1.16, holdBonus: 0.92 },
    cri: { label: 'TOUTE LA NUÉE, AVEC MOI !', gest: 'capo', power: 53 } },

  /* AN45 — la pyro de la plage de galets : le petit caillou gris que la mer
     roule sur la plage et qui finit gros rocher poli, piqué de verres de mer.
     Bleu et blanc ; ni algues ni plantes. Le coquillage reste sur le bord de
     son seau jusqu'au troisième âge. Il attend que la vague se retire et
     part pile avec elle, d'où la relance (voir l'en-tête) ; son défaut :
     chaque roulade lui coûte. */
  { id: 'AN45', nom: 'Le Petit Galet', type: 'pyro', stage: 1, rar: 'commune',
    histoire: 'Tout mouillé, un peu bancal sur ses jambes courtes, un flocon d’écume sur la tête, '
      + 'il tient devant lui son petit seau bleu avec un seul coquillage dedans. Il attend que la '
      + 'vague se retire, longtemps, et se laisse rouler avec elle pile au bon moment.',
    mods: { perfectBonus: 1.17, costPenalty: 1.06 },
    cri: { label: 'ATTENDS LA VAGUE…', gest: 'relance', power: 54 } },

  /* AN46 — la fidélité de la porcelaine des anciennes manufactures du
     quartier : la petite théière ébréchée du marché aux puces qui finit
     grande théière bleue, le chef-d'œuvre qui sert le thé à tout le monde.
     Bleu roi et blanc ; des bateaux et des nuages, ni lettres ni marque de
     manufacture. La petite fêlure reste sur son couvercle jusqu'au troisième
     âge. Elle laisse infuser le temps qu'il faut et pas une seconde de plus,
     d'où la tenue (voir l'en-tête) ; son défaut : elle ne suit pas la
     cadence. */
  { id: 'AN46', nom: 'La Petite Théière', type: 'fide', stage: 1, rar: 'commune',
    histoire: 'Achetée pour trois sous au marché aux puces, une petite fêlure sur le couvercle, '
      + 'elle a enfoncé son couvre-théière bleu roi jusqu’aux yeux comme un bonnet. Elle laisse '
      + 'infuser le temps qu’il faut, et pas une seconde de plus : un thé trop infusé, c’est un '
      + 'thé perdu.',
    mods: { holdBonus: 1.16, tempoWindow: 0.92 },
    cri: { label: 'PAS UNE SECONDE DE PLUS', gest: 'tenue', power: 53 } },

  /* AN47 — le déplacement des mystères joués sur des chariots : le petit
     chariot de bois bancal qui servait de scène aux vieux mystères de rue et
     finit grand char de procession, rideaux ouverts. Bleu ciel et blanc ; ni
     texte, ni personne sur la scène. La petite lanterne reste pendue sous son
     toit jusqu'au troisième âge. Il fait le tour des places de la ville,
     station après station, et recommence, d'où l'écharpe (voir l'en-tête) ;
     son défaut : le trac. */
  { id: 'AN47', nom: 'Le Petit Chariot de Théâtre', type: 'depl', stage: 1, rar: 'commune',
    histoire: 'Une roue qui branle, ses petits rideaux bleu ciel bien fermés, une seule lanterne '
      + 'pendue sous son toit : il a le trac avant chaque représentation. Mais une fois parti, il '
      + 'fait le tour de toutes les places de la ville, station après station, et il recommence.',
    mods: { breathBonus: 1.16, parryResist: 0.92 },
    cri: { label: 'ON FAIT LE TOUR DE LA VILLE !', gest: 'echarpe', power: 53 } },

  /* AN48 — la voix de la première exposition féline, au parc : le chaton
     tout ébouriffé qui boudait le jury et finit grand champion couvert de
     rosettes. Rouge et bleu ; une fourrure crème, ni lion ni crinière de
     lion. Le peigne reste coincé dans sa queue jusqu'au troisième âge. Il
     ronronne en mesure d'un bout à l'autre du jugement, d'où le tempo (voir
     l'en-tête) ; son défaut : il boude. */
  { id: 'AN48', nom: 'Le Chaton de Concours', type: 'voix', stage: 1, rar: 'commune',
    histoire: 'Ébouriffé, un peigne coincé dans la queue, la petite rosette rouge et bleue '
      + 'épinglée de travers sur son écharpe, il boude tout le jury. Mais dès qu’on le brosse, il '
      + 'ronronne, toujours à la même mesure, et toute l’exposition se met à son pas.',
    mods: { tempoWindow: 1.16, refundBonus: 0.92 },
    cri: { label: 'RON-RON, EN MESURE', gest: 'tempo', power: 53 } },

  /* AN49 — la percussion des phoques gris de l'estuaire : le petit phoque
     qui pointait le nez entre les bancs de sable et finit gardien des
     marées, une bouée autour du cou. Bleu et blanc ; ni lettres ni nom sur
     la bouée. Les grains de sable restent sur son nez jusqu'au troisième âge.
     Il claque le sable de ses nageoires aussi vite qu'il peut, d'où le
     martelage (voir l'en-tête) ; son défaut : il s'essouffle. */
  { id: 'AN49', nom: 'Le Petit Phoque Gris', type: 'perc', stage: 1, rar: 'commune',
    histoire: 'Encore mouillé, assis sur son banc de sable, la petite bouée bleue et blanche '
      + 'autour de la taille, quelques grains de sable sur le nez. Quand la marée monte, il '
      + 'claque le sable de ses nageoires, aussi vite qu’il peut, et tout l’estuaire l’entend.',
    mods: { mashBonus: 1.16, breathBonus: 0.92 },
    cri: { label: 'CLAC-CLAC-CLAC !', gest: 'mash', power: 53 } },

  /* AN50 — la pyro des anguilles qui remontent le fleuve depuis la mer :
     la petite civelle presque transparente qui finit grande anguille
     d'argent, enroulée sur elle-même. Blanc et noir ; ni hippocampe, ni
     pie, ni château, et le fleuve n'a pas de nom. Le galet du fleuve reste
     dans sa nageoire jusqu'au troisième âge. Elle se love, puis se déroule
     d'un coup, et le courant l'emporte comme un rouleau lancé, d'où les
     rouleaux (voir l'en-tête) ; son défaut : chaque élan lui coûte. */
  { id: 'AN50', nom: 'La Petite Anguille', type: 'pyro', stage: 1, rar: 'commune',
    histoire: 'Presque transparente, lovée sur elle-même, la casquette de marin blanche bien trop '
      + 'grande sur sa petite tête, elle serre un galet du fleuve dans sa nageoire. Elle se love, '
      + 'se love encore, puis se déroule d’un coup, et le courant l’emporte plus loin qu’elle ne '
      + 'l’aurait cru.',
    mods: { perfectBonus: 1.17, costPenalty: 1.06 },
    cri: { label: 'ET JE ME DÉROULE !', gest: 'rouleaux', power: 54 } },

  /* AN51 — le déplacement des cabines téléphoniques crème, les seules du
     pays qui ne soient pas rouges : la petite cabine qui sonnait dans le
     vide au coin du quai et finit par relier tout le port. Ambre et noir ;
     aucune partie rouge, ni lettres ni enseigne sur le toit. La vitre fêlée
     reste dans sa porte jusqu'au troisième âge. Elle apprend par cœur tous
     les numéros du port, d'où la mémoire (voir l'en-tête) ; son défaut :
     elle perd la cadence quand personne ne répond. */
  { id: 'AN51', nom: 'La Petite Cabine Crème', type: 'depl', stage: 1, rar: 'commune',
    histoire: 'Un peu cabossée, une vitre fêlée dans sa porte, le combiné ambre emmêlé dans son '
      + 'fil, elle attend un appel au coin du quai. Personne n’appelle, alors elle apprend par '
      + 'cœur tous les numéros du port, l’un après l’autre, et ne s’en trompe jamais.',
    mods: { breathBonus: 1.16, tempoWindow: 0.92 },
    cri: { label: 'JE CONNAIS CE NUMÉRO !', gest: 'memoire', power: 53 } },

  /* AN52 — la fidélité des loutres revenues dans la rivière et l'estuaire :
     la petite nageuse maladroite qui finit grande loutre qui veille sur les
     eaux, une pile de galets sur la tête. Bleu et blanc ; ni cheval, ni
     tracteur, ni plante. Le galet plat reste au sommet de la pile jusqu'au
     troisième âge. Elle tient son galet en équilibre sans jamais le lâcher,
     d'où la garde (voir l'en-tête) ; son défaut : elle ne frappe pas
     fort. */
  { id: 'AN52', nom: 'La Petite Loutre', type: 'fide', stage: 1, rar: 'commune',
    histoire: 'Toute mouillée sur la berge de vase, la petite lanterne bleue serrée dans les deux '
      + 'pattes, elle a posé un galet plat sur sa tête. Elle peut nager, plonger, se rouler dans '
      + 'la boue : le galet ne tombe jamais.',
    mods: { holdBonus: 1.16, mashBonus: 0.92 },
    cri: { label: 'IL NE TOMBERA PAS !', gest: 'hold', power: 53 } },

  /* AN53 — la percussion de la rhubarbe forcée, poussée dans des remises
     obscures et cueillie à la bougie : la tige pâle qui finit reine rose
     qui éclaire le noir. Blanc, jaune et bleu ; rien de vert, ni rose
     héraldique. Le troisième âge de la fiche porte le nom d'un lieu : le
     jeu ne le dit pas. La petite feuille tombante reste sur sa
     tête jusqu'au troisième âge. Dans la remise, on l'entend pousser,
     craquement après craquement, de plus en plus vite, d'où le crescendo
     (voir l'en-tête) ; son défaut : elle ne tient pas longtemps. */
  { id: 'AN53', nom: 'La Petite Tige de Rhubarbe', type: 'perc', stage: 1, rar: 'commune',
    histoire: 'Poussée dans le noir d’une remise, pâle et un peu courbée, la petite feuille jaune '
      + 'qui lui tombe sur les yeux, elle serre sa lanterne bleue à deux mains. Dans le silence, '
      + 'on l’entend pousser : un craquement, puis un autre, de plus en plus vite.',
    mods: { mashBonus: 1.15, holdBonus: 0.92 },
    cri: { label: 'CRAC… CRAC, CRAC-CRAC !', gest: 'crescendo', power: 53 } },

  /* AN54 — la pyro du ragoût des marins du port, celui qui a donné leur
     surnom aux gens de la ville (le jeu ne dit ni le plat ni le surnom) : la
     petite marmite cabossée qui finit grande marmite fumante qui nourrit
     tout le monde. Rouge et blanc ; aucun oiseau. La bosse reste sur son
     flanc jusqu'au troisième âge. Elle mijote longtemps, puis soulève son
     couvercle pile quand c'est prêt, d'où la relance (voir l'en-tête) ; son
     défaut : chaque fournée lui coûte. */
  { id: 'AN54', nom: 'La Petite Marmite', type: 'pyro', stage: 1, rar: 'commune',
    histoire: 'Cabossée sur le côté, le couvercle de travers, la petite louche rouge à la main, '
      + 'elle laisse échapper un filet de vapeur qui sent le ragoût des marins. Elle mijote '
      + 'longtemps, longtemps, et soulève son couvercle pile quand c’est prêt.',
    mods: { perfectBonus: 1.17, costPenalty: 1.06 },
    cri: { label: 'ÇA MIJOTE… C’EST PRÊT !', gest: 'relance', power: 54 } },

  /* AN55 — le tifo de la tarte de cantine de la ville, confiture, crème
     anglaise et noix de coco : la part écrasée dans la gamelle qui finit
     grand dessert de fête. Bleu ciel et blanc, un liseré bleu marine ; pas
     de cerise. Le petit trou dans la noix de coco reste sur son flanc
     jusqu'au troisième âge. Elle saupoudre sa noix de coco en traçant un
     grand rond sans en perdre un grain, d'où le tifo (voir l'en-tête) ; son
     défaut : elle perd la cadence. */
  { id: 'AN55', nom: 'La Petite Tarte', type: 'tifo', stage: 1, rar: 'commune',
    histoire: 'Une part écrasée assise dans son plat bleu ciel comme dans une baignoire, un peu de '
      + 'noix de coco tombée sur le côté, elle a l’air toute penaude. Mais quand elle saupoudre '
      + 'sa noix de coco, elle trace un grand rond parfait, sans en perdre un grain.',
    mods: { parryBonus: 1.16, tempoWindow: 0.92 },
    cri: { label: 'UN ROND PARFAIT !', gest: 'tifo', power: 52 } },

  /* AN56 — la voix du terrier noir et feu des filatures et des entrepôts :
     le chiot maigre qui chassait les souris entre les métiers et finit fier
     gardien de toute la ville. Rouge, blanc et noir ; ni cornes, ni fourche,
     ni trident, ni navire. L'oreille rabattue reste rabattue jusqu'au
     troisième âge. Il aboie dans la grande salle vide et refait coup pour
     coup ce que l'écho lui renvoie, d'où l'écho (voir l'en-tête) ; son
     défaut : il ne tient pas longtemps. */
  { id: 'AN56', nom: 'Le Petit Terrier', type: 'voix', stage: 1, rar: 'commune',
    histoire: 'Tout maigre, le collier rouge trop grand pour lui, un brin de coton collé à la '
      + 'truffe et une oreille rabattue, il court la filature d’un métier à l’autre. Il aboie '
      + 'dans la grande salle vide, l’écho lui répond, et il refait l’aboiement coup pour coup, '
      + 'sans en manquer un.',
    mods: { tempoWindow: 1.16, holdBonus: 0.92 },
    cri: { label: 'OUAF… OUAF-OUAF !', gest: 'echo', power: 53 } },

  /* AN57 — la percussion des macareux des îles au large de la côte : le
     petit maladroit des falaises qui rate tous ses atterrissages et finit
     grand pêcheur, le bec plein de poissons d'argent. Rayures noir et blanc ;
     ni pie ni hippocampe. Le flotteur blanc cerclé de noir reste avec lui
     jusqu'au troisième âge. Pour décoller, il bat des ailes aussi vite qu'il
     peut, d'où le martelage (voir l'en-tête) ; son défaut : il s'essouffle.
     Les planches du troisième âge portaient des signes lumineux en forme de
     lettres sur les bras et le poitrail : effacés sur une copie, la planche
     est à refaire. */
  { id: 'AN57', nom: 'Le Petit Macareux', type: 'perc', stage: 1, rar: 'commune',
    histoire: 'Tout rond, un peu de travers sur la falaise après un atterrissage raté, le petit '
      + 'flotteur blanc et noir serré sous l’aile et un seul poisson d’argent dans le bec, il a '
      + 'l’air tout étonné. Pour repartir, il bat des ailes aussi vite qu’il peut, si vite qu’on '
      + 'ne les voit plus.',
    mods: { mashBonus: 1.16, breathBonus: 0.92 },
    cri: { label: 'PLUS VITE, LES AILES !', gest: 'mash', power: 53 } },

  /* AN58 — le déplacement des oies menées à pied, des jours durant,
     jusqu'à la grande foire d'octobre de la ville : l'oison perdu qui finit
     reine de tout le troupeau. Rouge et blanc ; ni arbre, ni feuille, ni
     hors-la-loi. Les petits chaussons de toile restent à ses pattes jusqu'au
     troisième âge. Elle marche des jours entiers jusqu'à la foire, d'où
     l'écharpe (voir l'en-tête) ; son défaut : elle cède sous la pression. */
  { id: 'AN58', nom: 'La Petite Oie', type: 'depl', stage: 1, rar: 'commune',
    histoire: 'Encore en duvet, un peu vacillante, le petit bonnet rouge noué sous le bec et de '
      + 'minuscules chaussons de toile aux pattes pour la longue route, elle s’est perdue sur le '
      + 'chemin de la foire. Têtue, elle marche quand même, des jours entiers, un pas après '
      + 'l’autre.',
    mods: { breathBonus: 1.16, parryResist: 0.92 },
    cri: { label: 'ENCORE UN PAS !', gest: 'echarpe', power: 53 } },

  /* AN59 — le tifo du ver géant de la vieille légende du pays : le petit
     ver pêché dans la rivière et jeté au fond d'un puits qui grandit jusqu'à
     s'enrouler sur lui-même, devenu gentil. Rayures rouge et blanc ; ni
     ailes, ni crocs, ni dragon, ni colline, ni monument, ni pont, ni roue de
     mine. La goutte d'eau de rivière reste sur sa tête jusqu'au troisième
     âge. Quand il se dresse, une vague lui parcourt le corps, anneau après
     anneau, d'où l'ola (voir l'en-tête) ; son défaut : il s'essouffle. */
  { id: 'AN59', nom: 'Le Petit Ver du Puits', type: 'tifo', stage: 1, rar: 'commune',
    histoire: 'Tout rose et un peu timide, une goutte d’eau de rivière sur la tête, il tient à la '
      + 'main le petit seau rouge au bord blanc où il a grandi. Quand il se dresse, une vague lui '
      + 'parcourt tout le corps, anneau après anneau, de la queue jusqu’à la tête.',
    mods: { parryBonus: 1.16, breathBonus: 0.92 },
    cri: { label: 'ANNEAU APRÈS ANNEAU !', gest: 'ola', power: 52 } },

  /* AN60 — la fidélité des pigeons voyageurs des colombiers sur les toits
     et de leurs courses : le pigeonneau qui se perd à chaque course et finit
     grand champion, rentré le premier avec tous les messages. Bleu marine
     et blanc ; ni coq, ni ergot, ni ballon sous la patte. Les quelques
     plumes dressées restent sur sa tête jusqu'au troisième âge. En vol, il
     corrige son cap au moindre coup de vent, ni trop ni trop peu, d'où la
     jauge (voir l'en-tête) ; son défaut : il perd la cadence. */
  { id: 'AN60', nom: 'Le Petit Pigeon Voyageur', type: 'fide', stage: 1, rar: 'commune',
    histoire: 'Un peu ébouriffé, quelques plumes dressées sur la tête, le petit tube à message '
      + 'bleu marine à la patte et un papier roulé qui en dépasse, il se tient tout perdu sur un '
      + 'toit. Mais en vol, il garde son cap : au moindre coup de vent, il corrige d’un '
      + 'battement, ni trop ni trop peu.',
    mods: { holdBonus: 1.16, tempoWindow: 0.92 },
    cri: { label: 'JE GARDE LE CAP !', gest: 'jauge', power: 53 } },

  /* **Les six légendaires de la série** (demande de Gaël du 28 octobre
     2026). Un seul âge, comme toutes les légendaires : elles se trouvent,
     elles ne grandissent pas. AN61 à AN63 sont liées aux équipes nationales
     du pays (hommes, femmes, espoirs), AN64 à AN66 au championnat, sans club
     (`clubs.js`, `lienEcrit`). Mêmes interdits que la série, et deux de plus :
     ni lion ni rose pour les sélections, ni le nom, ni le lion, ni la
     couronne, ni le trophée du championnat. La croix rouge sur blanc est le
     drapeau du pays : elle est libre. Fiches et prompts :
     `fanzzy-prompts/AN-legendaires.md`. */
  { id: 'AN61', nom: 'La Dame des Falaises Blanches', type: 'depl', stage: 1, rar: 'legendaire',
    histoire: 'Taillée dans la craie des falaises, sa lanterne à la main, elle guette chaque '
      + 'bateau qui rentre. Elle les a vus partir tous, et elle n’en a jamais laissé un rentrer '
      + 'dans le noir.',
    mods: { breathBonus: 1.36, refundBonus: 1.22, mashBonus: 0.86 },
    cri: { label: 'LA LANTERNE EST ALLUMÉE', gest: 'bascule', power: 80 } },

  { id: 'AN62', nom: 'Le Chevalier à la Croix Rouge', type: 'tifo', stage: 1, rar: 'legendaire',
    histoire: 'On l’a vu descendre du vitrail un soir de qualification. Il a planté le drapeau '
      + 'blanc à croix rouge au premier rang, et il n’est jamais remonté.',
    mods: { parryBonus: 1.5, perfectBonus: 1.22, tempoWindow: 0.86 },
    cri: { label: 'LEVEZ LA CROIX', gest: 'mosaique', power: 82 } },

  { id: 'AN63', nom: 'Le Bouledogue au Grand Tambour', type: 'perc', stage: 1, rar: 'legendaire',
    histoire: 'Coulé dans le bronze, têtu comme tout le pays, il ne sait battre qu’un seul '
      + 'rythme. Il le bat depuis cent ans, dans tous les stades du monde, et il ne compte pas '
      + 'changer.',
    mods: { mashBonus: 1.38, mashTime: 900, holdBonus: 0.86 },
    cri: { label: 'UN SEUL RYTHME', gest: 'crescendo', power: 81 } },

  { id: 'AN64', nom: 'La Tisseuse des Vingt Écharpes', type: 'fide', stage: 1, rar: 'legendaire',
    histoire: 'Personne ne l’a jamais vue tricoter. Mais chaque été, vingt écharpes neuves '
      + 'pendent à son métier, une par tribune, toutes du même fil : quand quelqu’un tire trop '
      + 'fort, c’est toute la saison qui se défait.',
    mods: { holdBonus: 1.42, holdForgive: 3, parryResist: 1.2, tempoInterval: 90 },
    cri: { label: 'TOUS DU MÊME FIL', gest: 'tenue', power: 80 } },

  { id: 'AN65', nom: 'La Voix des Résultats', type: 'voix', stage: 1, rar: 'legendaire',
    histoire: 'Chaque samedi à cinq heures, il lit les scores du pays entier. Il n’a jamais haussé '
      + 'le ton : on entend la victoire à sa façon de dire le nom de la ville.',
    mods: { tempoWindow: 1.3, breathBonus: 1.18, parryResist: 0.84 },
    cri: { label: 'SCORE FINAL', gest: 'echo', power: 83 } },

  { id: 'AN66', nom: 'Le Rouge-Gorge du Lendemain de Noël', type: 'pyro', stage: 1, rar: 'legendaire',
    histoire: 'Il n’arrive qu’au plus froid de l’année, le lendemain de Noël, le ballon orange '
      + 'des matchs sous la neige sous l’aile. Les soirs où il se pose sur le toit de la tribune, '
      + 'personne n’y a froid.',
    mods: { perfectBonus: 1.46, refundBonus: 1.32, backfire: 1.45 },
    cri: { label: 'CHAUD DEVANT', gest: 'compte', power: 82 } },
];

export const DEX_TERRACES = PREMIERS_AGES.map((f) => ({ ...f, set: SET_TERRACES.id }));
