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
 * Les fiches (noms, histoires, invites des dessins) sont dans
 * `/mnt/project-files/fanzzy-prompts/AN-les-terraces.md`.
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
 * ## Cinq lignées sur vingt, et pourquoi elle arrive fermée
 *
 * Les cinq premières (AN1 à AN5) ont leurs dessins : trois cartes en pied et
 * cinq états par âge, en tenue de base. Les quinze autres arriveront avec les
 * leurs ; les écrire maintenant mettrait au catalogue quinze silhouettes
 * procédurales, et une série dont les trois quarts ne sont pas dessinés.
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
 * Cinq lignées, cinq familles : la garde (fide), la péniche (depl), le crieur
 * de promenade (voix), le peintre d'enseignes (tifo), la confiseuse (pyro).
 * La percussion attendra une des quinze suivantes.
 *
 * Le geste de la confiseuse n'est pas libre. Les Pyro comptaient trente-deux
 * personnages de premier âge dont quatre aux `rouleaux` — pile le huitième que
 * `catalogue:smoke` exige d'une variante. Un trente-troisième Pyro au geste
 * éponyme aurait fait passer les rouleaux sous le plancher. Elle lance donc
 * ses bâtons de sucre par-dessus la rambarde, ce qui est exactement le geste,
 * et les rouleaux remontent à cinq sur trente-trois.
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
 * Les cinq premiers âges. Leurs suites sont dans `dex-ages.js`.
 *
 * `set` est posé une fois, en bas, comme dans `dex-saison.js` : cinq fois le
 * même mot, ce sont cinq occasions de l'oublier.
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
];

export const DEX_TERRACES = PREMIERS_AGES.map((f) => ({ ...f, set: SET_TERRACES.id }));
