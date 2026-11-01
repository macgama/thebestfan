/**
 * Ce que deviennent les personnages.
 *
 * Une entrée par personnage, deux âges chacune : `[nom, histoire, cri]`. Rien
 * d'autre — les modificateurs et la puissance se déduisent du premier âge par
 * les règles de `ages.js`, et ce fichier ne contient donc que ce qu'aucune
 * règle ne peut produire.
 *
 * **La progression suit la famille du personnage**, comme convenu :
 *
 *   - un humain fait une **carrière** : le gamin devient un habitué, l'habitué
 *     devient une institution du virage. Il gagne une place, pas des muscles ;
 *   - un métier monte en **responsabilité** : on passe de celui qui fait à
 *     celui qui décide, puis à celui dont on parle encore quand il n'est plus
 *     là ;
 *   - un revenant monte en **intensité** : il ne fait pas carrière, il devient
 *     plus lui-même ;
 *   - une bête **vieillit**, comme un humain : ce paragraphe disait le
 *     contraire, et les textes déjà écrits le démentaient — le deuxième âge du
 *     Hibou Statisticien parle de soixante-dix ans de feuilles de match. Elle
 *     vieillit dans sa langue, un pelage et des marques plutôt qu'un blouson ;
 *   - un objet **s'use** : neuf, servi, patiné. Jamais cassé — à quarante-huit
 *     pixels, abîmé et vieux se ressemblent, et un objet abîmé se lit comme une
 *     carte moins bonne.
 *
 * La règle d'écriture qui tient tout : **le troisième âge doit rendre le
 * premier plus touchant, pas le renier.** Le Petit Teigneux ne devient pas un
 * héros ; il devient l'homme qui accueille le prochain petit teigneux. C'est ce
 * qui fait qu'on garde la carte au lieu de la remplacer.
 */

export const AGES = {

  /* ============================================================ LA TRIBUNE

     Des gens ordinaires dans les gradins. Ils ne gagnent aucun pouvoir en
     grandissant : ils gagnent une place, une habitude, et à la fin une trace
     que les autres remarquent.                                              */

  TR1: [
    ['Le Teigneux', 'Dix-sept ans, la même parka, les épaules qui ont rattrapé le tissu. '
      + 'Il ne connaît plus les chants avant les paroles : il connaît les paroles avant tout le monde.',
      'ON LÂCHE RIEN'],
    ['Le Vieux Teigneux', 'Quarante ans plus tard, la parka est au musée du club et lui est toujours '
      + 'debout. Il gueule sur un gamin de onze ans qui connaît déjà les chants. Il ne dira jamais '
      + 'que c’est son plus beau souvenir de la saison.', 'C’EST JAMAIS FINI'],
  ],
  TR2: [
    ['L’Échangiste', 'Il a compris que l’album ne se complète pas seul. Il a monté la bourse aux '
      + 'cartes du parvis, et il donne plus qu’il ne prend.', 'JE TE LA DONNE'],
    ['Le Conservateur', 'Sa collection est complète depuis 1993 et elle est exposée dans le hall du '
      + 'stade. Les enfants s’arrêtent devant. Il fait semblant de ne pas les regarder.',
      'ELLE EST À TOUT LE MONDE'],
  ],
  TR3: [
    ['La Banderole Écrite', 'Le bon soir est arrivé un mardi de novembre, et ce qu’il a écrit dessus '
      + 'tenait en trois mots. Personne n’a osé demander pour qui.', 'CE SOIR, OUI'],
    ['La Banderole de Tous', 'Il n’écrit plus la sienne : il coud celles des autres. Trois cents '
      + 'mètres de tissu par saison, une machine à coudre dans un garage, et son nom nulle part.',
      'ELLE EST À VOUS'],
  ],
  TR4: [
    ['Le Casque Autour du Cou', 'Il a arrêté de filmer. Il a compris le soir où il a regardé sa '
      + 'vidéo du but et où il ne s’était pas vu sauter.', 'J’AI COUPÉ'],
    ['Celui Qui Entend Tout', 'Il enregistre le virage, pas le match. Ses bandes sont les seules '
      + 'archives sonores de vingt ans de chants, et il les donne à qui les demande.',
      'ÉCOUTEZ ÇA'],
  ],
  TR5: [
    ['La Cagoule Baissée', 'Il a enlevé la cagoule le jour où sa fille a voulu voir sa tête sur la '
      + 'photo. En dessous, il y avait un monsieur très ordinaire, et un peu gêné.', 'JE DIS UN PEU'],
    ['Le Grand-Père en Peluche', 'Il a rendu la peluche, il en a racheté douze. Il en donne une par '
      + 'match au gamin qui pleure, et il y a toujours un gamin qui pleure.', 'TIENS, PRENDS'],
  ],
  TR6: [
    ['Celui Qui Regarde un Peu', 'Il a baissé l’écharpe à la 88e d’une demi-finale. Il a vu le but. '
      + 'Il n’a pas dormi de la nuit, mais il l’a vu.', 'JE REGARDE, JE REGARDE'],
    ['Celui Qui Raconte', 'Il regarde tout, désormais, et il commente à voix haute pour l’aveugle du '
      + 'rang 12. Il n’a pas manqué une action depuis onze ans, parce que quelqu’un compte dessus.',
      'JE TE DIS TOUT'],
  ],
  TR7: [
    ['Les Deux Mains Croisées', 'Elle a ajouté la deuxième main après le coup franc de 2011. Le '
      + 'rituel s’allonge chaque saison et elle ne l’allégera jamais.', 'PITIÉ, ENCORE UNE'],
    ['La Superstition du Virage', 'Trois cents personnes croisent les doigts avec elle, maintenant. '
      + 'Personne ne sait quand ça a commencé à se transmettre. Elle non plus.', 'TOUS, MAINTENANT'],
  ],
  TR8: [
    ['Le Porteur Debout', 'Le petit ne dort plus : il hurle sur ses épaules et lui tient les '
      + 'oreilles. Il a mal au dos tous les lundis et il ne changerait pour rien au monde.',
      'TIENS-TOI BIEN'],
    ['Les Épaules du Virage', 'Le petit est grand, et c’est lui qui porte son père en fin de match. '
      + 'Le vieux fait semblant de protester. Deux rangées les regardent en souriant.',
      'À TON TOUR'],
  ],
  TR9: [
    ['Les Deux Écharpes', 'Elle en tient une de chaque main, la sienne et celle du siège vide à '
      + 'côté. Elle n’a jamais expliqué le siège vide et personne ne s’assoit dedans.',
      'TOUS LES DEUX'],
    ['La Première Rangée', 'Le virage entier lève l’écharpe quand elle lève la sienne. Elle a mis '
      + 'trente ans à obtenir ça et elle a l’air de trouver ça normal.', 'MAINTENANT'],
  ],
  TR10: [
    ['La Glacière', 'Le paquet de chips est devenu une glacière à roulettes. Il nourrit son rang '
      + 'entier et il tient un carnet de ce qu’on lui doit, qu’il ne réclame jamais.',
      'SERVEZ-VOUS'],
    ['Le Ravitaillement', 'Trois glacières, deux bénévoles, et la moitié du virage qui mange à '
      + 'l’œil. Le club a essayé de l’interdire une fois. Une seule.', 'IL Y EN A POUR TOUS'],
  ],
  TR11: [
    ['Les Six Mètres', 'L’écharpe passe par-dessus quatre rangées et trois personnes la tiennent. '
      + 'Le club n’est toujours pas champion et elle continue de tricoter.', 'ENCORE DEUX RANGS'],
    ['Le Fil du Virage', 'L’écharpe fait le tour du bloc C et elle a arrêté de compter. Elle apprend '
      + 'à tricoter à qui veut, à la buvette, avant les matchs.', 'ON LA FINIRA'],
  ],
  TR13: [
    ['Le Gamin à la Coupe', 'Il sait maintenant ce qu’il a gagné : un tournoi de six équipes, un '
      + 'samedi de juin. Il la lève quand même, et il a raison.', 'C’EST À MOI'],
    ['Le Premier Trophée', 'Il entraîne les poussins et il donne la coupe au meilleur de la saison. '
      + 'Elle revient chaque année, un peu plus cabossée, un peu plus lourde.', 'À TOI DE JOUER'],
  ],
  TR14: [
    ['Le Campement', 'Chaise, glacière, parasol, et deux chaises de plus pour ceux qui arrivent '
      + 'tôt. Il est là quatre heures avant et il n’est jamais seul.', 'ASSIEDS-TOI'],
    ['Le Parvis', 'Il ouvre le parvis avant le club. Vingt personnes viennent boire un café chez lui '
      + 'sur le bitume, et le stade ouvre après.', 'ON VOUS ATTEND'],
  ],
  TR15: [
    ['Le Torse Peint à Trois', 'Ils sont trois torses maintenant, et les lettres s’alignent. Il faut '
      + 'qu’ils restent dans l’ordre toute la mi-temps, ce qui est plus dur que le froid.',
      'ON A PAS FROID'],
    ['La Lettre du Milieu', 'Ils sont onze et il tient la lettre du centre, celle qui ne doit jamais '
      + 'bouger. Il n’a plus vingt ans et il n’a toujours pas de manteau.', 'ON BOUGE PAS'],
  ],
  TR16: [
    ['La Perche Baissée', 'Elle a compris qu’on la regardait, elle, et pas le match. Elle filme '
      + 'les autres depuis, et sa lampe éclaire les bonnes personnes.', 'REGARDEZ-LES'],
    ['La Caméra du Virage', 'Ses images passent sur les écrans du stade à la mi-temps. Le club voulait '
      + 'lui acheter les droits ; elle a dit que c’était déjà à tout le monde.', 'C’EST NOUS, ÇA'],
  ],
  TR17: [
    ['L’Hippopotame Assumé', 'Le pari est prescrit depuis longtemps. Il met le pyjama parce que le '
      + 'virage le cherche des yeux quand il ne le porte pas.', 'NE DEMANDEZ PLUS'],
    ['La Mascotte Non Officielle', 'Le club en a fait une peluche vendue à la boutique. Il n’a rien '
      + 'touché dessus et il trouve ça très drôle.', 'C’EST MOI, ÇA'],
  ],
  TR18: [
    ['La Voix Qui Tient', 'Il termine ses chants, maintenant, et il en lance trois de suite. Sa voix '
      + 'tient tout le match ; ce qui ne tient plus, ce sont ses cordes vocales du mardi.',
      'ENCORE UNE FOIS'],
    ['Le Porte-Voix', 'Il ne chante presque plus : il choisit le chant, lève le bras, et deux mille '
      + 'personnes partent ensemble. Le silence avant, c’est lui aussi.', 'À TROIS'],
  ],
  TR19: [
    ['Les Quatre Maillets', 'Deux tambours, deux mains, et le rang de devant qui a démissionné. Il '
      + 'a appris à s’arrêter net, ce qui est plus impressionnant que de frapper.', 'ÇA TREMBLE'],
    ['Le Cœur du Virage', 'Sa grosse caisse donne le rythme cardiaque de deux mille personnes. Quand '
      + 'elle s’arrête pendant une minute de silence, on entend le stade entier respirer.',
      'ÉCOUTEZ LE SILENCE'],
  ],
  TR20: [
    ['Le Héros du Samedi', 'La cape est mieux cousue, les collants sont à sa taille. Il sait '
      + 'parfaitement que sa présence ne change rien et il vient quand même.', 'ME REVOILÀ'],
    ['Le Héros de Quelqu’un', 'Un enfant du bloc D a la même cape, cousue par sa mère. Il ne le sait '
      + 'pas encore. Ça change quelque chose, finalement.', 'ON EST DEUX'],
  ],
  TR21: [
    ['La Torche Réglée', 'Il craque à la minute prévue, et il a obtenu du club l’autorisation. '
      + 'Trois ans de réunions pour trente secondes de rouge.', 'ROUGE, PARTOUT'],
    ['Le Chef Pyro', 'Il forme les nouveaux, il compte les torches, il paye les amendes de ceux qui '
      + 'ne peuvent pas. Le virage brûle proprement depuis qu’il s’en occupe.', 'À MON SIGNAL'],
  ],
  TR22: [
    ['Celui Qui a Lâché l’Écran', 'Il connaît toujours les statistiques et il ne les sort plus. Il '
      + 'a découvert qu’un mauvais joueur peut faire lever un stade.', 'LES CHIFFRES DISENT RIEN'],
    ['L’Œil', 'Il repère les joueurs six mois avant les recruteurs, à l’œil nu, et il ne le dit à '
      + 'personne. Il a rangé les statistiques dans un tiroir qu’il n’ouvre plus.', 'REGARDE-LE'],
  ],
  TR23: [
    ['La Coupe Cabossée', 'Le trophée de quartier a pris trente coups et perdu une anse. Il le lève '
      + 'toujours à chaque but, et le rang entier lève quelque chose avec lui.', 'ON EST LES PLUS BEAUX'],
    ['La Vraie Coupe', 'Le club en a gagné une, une seule, et c’est lui qu’on a fait monter sur le '
      + 'podium avec les joueurs. Il tenait la sienne dans l’autre main.', 'ON L’A FAIT'],
  ],
  TR24: [
    ['L’Enfant du Rang', 'Cinq ans, il ne comprend toujours rien, mais il connaît le chant du but et '
      + 'il le hurle avec deux mesures de retard.', 'ENCORE'],
    ['L’Abonné', 'Vingt-huit ans, siège 14, rang B. Il ne se souvient pas de son premier match et '
      + 'il n’en a manqué aucun depuis. Sa mère a gardé le ticket.', 'JE SUIS LÀ'],
  ],
  TR25: [
    ['L’Entrée en Jeu', 'Elle est entrée à la 87e d’un match de district, et elle a touché deux '
      + 'ballons. Elle porte le même brassard depuis, mais plus pour la même raison.',
      'JE SUIS PRÊTE'],
    ['La Capitaine', 'Elle joue en équipe première féminine et le virage a repris son nom en chant. '
      + 'Elle regarde les gradins avant chaque coup d’envoi, à l’endroit exact où elle attendait.',
      'ON Y VA'],
  ],
  TR26: [
    ['Les Genoux Propres', 'Elle a gagné, l’après-midi. Elle est venue quand même se salir dans '
      + 'l’herbe du parvis, par habitude et par superstition.', 'MOI J’AI GAGNÉ'],
    ['La Boue Partagée', 'Elle entraîne les U11 le matin et les amène au stade l’après-midi, avec la '
      + 'boue. Trente paires de genoux sales dans le bloc D.', 'ON JOUE TOUS'],
  ],
  TR27: [
    ['Le Pompon à Deux Mains', 'Elle hurle toujours à contretemps et elle a arrêté de s’en excuser. '
      + 'Le rang autour d’elle chante à son rythme, maintenant, ce qui est un exploit.',
      'ALLEZ ALLEZ ALLEZ ALLEZ'],
    ['Celle Qui Donne le Départ', 'C’est son contretemps qui est devenu le tempo du virage. Personne '
      + 'ne sait comment. Le costume de monstre a une doublure, désormais.', 'À MON COMPTE'],
  ],

  /* ============================================================= LES MÉTIERS

     Ceux qui font tourner le stade. Ils montent en responsabilité : de celui
     qui exécute à celui qui décide, puis à celui dont on parle encore quand il
     a rendu son tablier.                                                     */

  MS1: [
    ['La Cheffe de Rang', 'Six cents bières, trois stagiaires, et le prénom de tout le virage. Elle '
      + 'voit toujours six minutes de match par saison et elle sait tout du reste.', 'DEUX MINUTES'],
    ['La Patronne du Bloc', 'Elle tient les quatre buvettes du virage et elle a embauché la moitié '
      + 'du bloc D. Le club lui demande son avis avant de changer les horaires.', 'JE M’EN OCCUPE'],
  ],
  MS2: [
    ['Le Mime de la Tribune', 'On lui a donné un micro à la mi-temps, il a refusé. Il rejoue les '
      + 'actions sur le grand écran, sans un mot, et le stade rit.', '…'],
    ['L’Arbitre Muet', 'La fédération projette ses reconstitutions en formation. Il n’a toujours pas '
      + 'parlé, et son silence fait autorité.', '……'],
  ],
  MS3: [
    ['Le Porteur de Colonne', 'Quinze kilomètres par match, deux mille gobelets, et il connaît le '
      + 'raccourci sous la tribune que même les stadiers ignorent.', 'LAISSEZ PASSER'],
    ['Celui Qui Ramasse', 'Il ramasse plus qu’il ne vend : il a monté le tri du stade tout seul, et '
      + 'le virage repart propre depuis quatre ans.', 'ON LAISSE RIEN'],
  ],
  MS4: [
    ['La Météo du Virage', 'Son carnet fait trois cents pages et le club le consulte avant les coups '
      + 'francs. Elle a prédit onze poteaux, et deux buts.', 'ÇA TOURNE DÉJÀ'],
    ['Celle Qui Sait Avant', 'Elle annonce la pluie vingt minutes avant qu’elle tombe et le virage '
      + 'sort les bâches sans même lever la tête.', 'COUVREZ-VOUS'],
  ],
  MS5: [
    ['La Cheffe Stadière', 'Elle a douze personnes sous ses ordres et elle regarde toujours le '
      + 'virage plutôt que le terrain. Elle a évité quatre bagarres cette saison en levant un doigt.',
      'ÇA VA ALLER'],
    ['La Paix du Virage', 'Elle a fait supprimer les grilles. La direction a dit que c’était '
      + 'imprudent. Il n’y a pas eu un incident depuis, et elle ne l’a jamais rappelé à personne.',
      'ON SE CONNAÎT'],
  ],
  MS6: [
    ['Le Rappel du Dimanche', 'Il descend les baies à la mi-temps, exprès, pour voir la deuxième '
      + 'période à l’endroit. Le club fait semblant de ne pas savoir.', 'JE VOIS TOUT'],
    ['L’Homme Sur le Toit', 'Il regarde le match assis sur la charpente, jambes dans le vide, et il '
      + 'a la plus belle place du stade. Elle ne figure sur aucun plan.', 'D’ICI, C’EST BEAU'],
  ],
  MS7: [
    ['Le Fendeur de Bancs', 'Il a refait les bancs de touche en chêne et il a gravé la date dessous. '
      + 'Personne ne l’a vue, et c’est très bien.', 'ÇA TIENDRA'],
    ['Le Charpentier du Stade', 'La tribune sud est de lui, poutre par poutre. Elle porte deux mille '
      + 'personnes qui sautent en même temps, et elle n’a jamais bougé.', 'ÇA BOUGE PAS'],
  ],
  MS8: [
    ['La Gardienne des Ruches', 'Douze ruches derrière la tribune sud, et le miel a une étiquette aux '
      + 'couleurs du club. Elle demande toujours le silence pendant les corners.', 'CHUT, ELLES SORTENT'],
    ['Le Miel du Virage', 'Le pot se vend au profit du centre de formation. Trois joueurs de '
      + 'l’équipe première ont grandi avec, sans savoir d’où il venait.', 'C’EST POUR EUX'],
  ],
  MS9: [
    ['Le Ramoneur du Virage', 'La file fait cent mètres et il touche toutes les casquettes, une par '
      + 'une, sans en sauter aucune. Ça prend une heure et il arrive à l’heure.', 'ÇA MARCHE, ÇA'],
    ['La Chance du Stade', 'Il ne touche plus personne : il monte sur le toit avant le coup d’envoi '
      + 'et le stade entier lève la tête. Ça n’a jamais fait gagner un match, et alors.',
      'ON EST TOUS COUVERTS'],
  ],
  MS10: [
    ['La Louche', 'Trois cents repas en quinze minutes, quatre bagarres arrêtées, et toujours pas un '
      + 'mot plus haut que l’autre. La louche est accrochée au mur, désormais.', 'ÇA SUFFIT, J’AI DIT'],
    ['La Cantine du Virage', 'Elle nourrit gratuitement quiconque le demande, sans poser de question. '
      + 'Personne ne sait qui paye. Tout le monde s’en doute.', 'ASSIEDS-TOI, MANGE'],
  ],
  MS11: [
    ['Le Chef de Garde', 'Il a écrit le protocole pyro du club avec les ultras, autour d’une table, '
      + 'en trois soirées. Les deux camps y ont perdu quelque chose et le stade y a gagné.',
      'ON A UN ACCORD'],
    ['Celui Qui Laisse Brûler', 'Il regarde le virage rouge en connaissant chaque torche par son '
      + 'numéro. Il n’est jamais intervenu. C’est pour ça que ça se passe bien.', 'JE REGARDE'],
  ],
  MS12: [
    ['Le Gardien du Filet', 'Il recoud les filets à la main entre deux matchs, comme les filets du '
      + 'port. Le club en a acheté des neufs ; ils sont restés dans le carton.', 'ÇA TIENT ENCORE'],
    ['Le Vieux du Port', 'Il ne monte plus les marches. Il salue le terrain depuis le grillage et le '
      + 'stade entier attend qu’il ait fini pour siffler le coup d’envoi.', 'TENEZ BON, LES GARS'],
  ],
  MS13: [
    ['La Cheffe d’Infirmerie', 'Deux lits, un défibrillateur, et la place libre est toujours là. Elle '
      + 'a fini par expliquer pourquoi : c’est celle de son père.', 'RESPIRE, JE SUIS LÀ'],
    ['Celle Qui A Ramené', 'Un homme du bloc B est reparti sur ses jambes, un soir de mars. Il '
      + 'revient chaque année lui apporter des fleurs et elle râle chaque année.', 'TU VOIS, TU RESPIRES'],
  ],
  MS14: [
    ['Le Pain de la Mi-Temps', 'Il ouvre à quatre heures et il apporte deux cents pains au virage. '
      + 'Il repart toujours avant les prolongations et il rate toujours les buts qui comptent.',
      'IL EST ENCORE CHAUD'],
    ['La Fournée du Virage', 'Il a formé deux apprentis pour pouvoir rester jusqu’au bout. Il a vu '
      + 'son premier but à la 93e après trente et un ans d’abonnement.', 'JE RESTE, CE SOIR'],
  ],
  MS16: [
    ['Le Second Carton', 'Il sort le rouge, maintenant, et toujours avant l’arbitre. Il a raison une '
      + 'fois sur trois, ce qui est mieux que la moyenne de la tribune.', 'EXPULSION'],
    ['Le Règlement', 'Il connaît les Lois du Jeu par cœur, les dix-sept, et il les cite avec le '
      + 'numéro d’article. Il a fait annuler un carton en écrivant à la fédération.', 'ARTICLE 12'],
  ],
  MS17: [
    ['La Tournée du Virage', 'Il distribue les programmes et le courrier des supporters entre eux : '
      + 'un mot glissé d’un rang à l’autre, une place échangée, un pardon.', 'PLI URGENT'],
    ['Le Facteur du Bloc', 'Il connaît les absents. Quand un abonné manque deux matchs, il passe chez '
      + 'lui avec le programme. Il en a trouvé trois qui allaient mal.', 'JE PASSAIS'],
  ],
  MS18: [
    ['La Criée', 'Ses bretzels sont toujours mauvais et elle en vend six cents. Le speaker a renoncé '
      + 'à lutter et il attend qu’elle ait fini sa travée.', 'BRETZELS ! ENCORE CHAUDS !'],
    ['La Voix du Parvis', 'On l’entend depuis le parking. Le club a proposé de l’embaucher comme '
      + 'speaker ; elle a répondu qu’elle avait un vrai métier.', 'TOUT LE MONDE M’ENTEND'],
  ],
  MS19: [
    ['Le Drapeau Levé', 'Vingt-cinq ans de ligne de touche, et il a eu raison une fois : un hors-jeu '
      + 'de trois centimètres, confirmé par la vidéo. Il en parle encore.', 'HORS-JEU, J’AI DIT'],
    ['La Ligne', 'Il forme les jeunes arbitres du district. Il leur apprend à lever le drapeau et à '
      + 'encaisser deux mille insultes, dans cet ordre.', 'TIENS TA LIGNE'],
  ],
  MS20: [
    ['Le Manteau à Trente Maillots', 'Il vend le maillot adverse aux nôtres avec le même sourire et '
      + 'personne ne lui en veut. Il a rendu la monnaie à un enfant qui n’avait pas assez.',
      'TOUTES LES TAILLES, TOUS LES CLUBS'],
    ['La Boutique du Trottoir', 'Il a pignon sur rue en face du stade et il vend toujours dehors, à '
      + 'la sauvette, parce que c’est là que les gens s’arrêtent.', 'ENTREZ, C’EST DEHORS'],
  ],
  MS21: [
    ['Le Contrat Signé', 'Le transfert s’est fait et le joueur est resté trois saisons. Il sourit '
      + 'toujours à tout le monde et personne ne lui fait toujours confiance.', 'C’EST FAIT'],
    ['Le Directeur Sportif', 'Il a monté le centre de formation et il n’achète plus personne. Le '
      + 'virage a mis six ans à lui pardonner, et lui a mis six ans à s’en moquer.', 'ILS SONT D’ICI'],
  ],
  MS22: [
    ['Les Trois Notes', 'Il en a appris une troisième. C’est un événement dont le virage parle '
      + 'encore, et le chant a dû être réécrit.', 'TA — TAAA — TAM'],
    ['La Trompette', 'Il joue l’hymne du club seul, avant le coup d’envoi, et vingt mille personnes '
      + 'se taisent. Il n’a jamais pris un cours de sa vie.', 'ÉCOUTEZ'],
  ],
  MS23: [
    ['La Voyante Honnête', 'Elle annonce toujours le score exact et elle affiche maintenant son '
      + 'palmarès : quatre-vingt-onze erreurs sur quatre-vingt-douze. La file s’est allongée.',
      'CETTE FOIS, C’EST SÛR'],
    ['Celle Qui a Eu Raison', 'Elle a annoncé le 3-2 de la finale, minute par minute, et elle a eu '
      + 'raison. Elle a arrêté le lendemain. Elle dit qu’on ne fait pas ça deux fois.',
      'JE L’AVAIS DIT'],
  ],
  MS25: [
    ['Les Trois Grils', 'La fumée monte jusqu’à la tribune d’honneur et la direction s’en plaint '
      + 'chaque année, par écrit. Il encadre les lettres au-dessus du gril.', 'ÇA VA ÊTRE PRÊT'],
    ['L’Odeur du Stade', 'On sent le stade depuis la gare. Des gens viennent pour ça et restent pour '
      + 'le match. Le club a fini par le mettre sur l’affiche.', 'VOUS SENTEZ ?'],
  ],
  MS26: [
    ['Le Carnet Noir', 'Trois internationaux, et il n’a toujours rien dit. Il regarde les '
      + 'remplaçants, les blessés, ceux qui s’échauffent seuls.', 'PAS CELUI-LÀ, L’AUTRE'],
    ['Celui Qui a Vu', 'Un joueur a soulevé une coupe d’Europe. Il était dans les tribunes, très '
      + 'haut, et il n’a rien dit à personne cette fois non plus.', 'JE SAVAIS'],
  ],

  /* ============================================================== LES BÊTES

     Elles ne font pas carrière : elles deviennent plus elles-mêmes. Le pigeon
     ne devient pas chef, il devient une légende du parvis. La progression se
     mesure à l'aplomb, pas au galon.                                         */

  BG1: [
    ['Le Hibou Archiviste', 'Soixante-dix ans de feuilles de match, classées par saison, dans un '
      + 'trou de la charpente. Il lève deux doigts maintenant, ce qui veut dire « et je peux le '
      + 'prouver ».', 'TROISIÈME EN NEUF ANS'],
    ['La Mémoire du Stade', 'Le club lui demande les scores d’avant l’informatique. Il répond en '
      + 'clignant des yeux, une fois par chiffre, et il ne s’est jamais trompé.', 'TOUT EST NOTÉ'],
  ],
  BG2: [
    ['Le Pigeon au Sandwich', 'Il a monté en gamme. Il repère l’assiette avant qu’elle sorte de la '
      + 'buvette et il attend, immobile, pendant tout le temps qu’il faut.', 'ÇA AUSSI'],
    ['Le Roi du Parvis', 'Il ne vole plus rien : quarante pigeons volent pour lui et lui apportent. '
      + 'Il regarde le match depuis la rambarde, la panse pleine, l’air lointain.', 'SERVEZ'],
  ],
  BG3: [
    ['Le Morse à Cinq Sièges', 'Il en occupe cinq et il a fait retirer l’accoudoir. Il ne s’est '
      + 'toujours jamais levé, mais il applaudit maintenant, ce qui secoue la travée.',
      'JE ME LÈVE PAS, MAIS J’APPLAUDIS'],
    ['Le Bloc Nord', 'On a construit une plateforme pour lui. Elle porte son nom sur le plan '
      + 'd’évacuation et elle est devenue le point de rendez-vous du virage.', 'JE SUIS LÀ, VENEZ'],
  ],
  BG4: [
    ['Le Coq du Poteau', 'Il ne dort plus pendant le match : il annonce chaque corner en chantant, '
      + 'et le juge de touche a fini par attendre son signal.', 'DEBOUT, TOUS'],
    ['Le Réveil du Virage', 'Il chante trois fois avant le coup d’envoi et le stade se tait entre '
      + 'chaque. Personne n’a décidé ça. C’est arrivé, voilà tout.', 'C’EST L’HEURE'],
  ],
  BG5: [
    ['Le Crabe Arbitre', 'On lui a donné un drapeau. Il tient la ligne mieux que quiconque et il '
      + 'n’a toujours pas appris à avancer tout droit.', 'DE CÔTÉ, ET ALORS'],
    ['La Pince', 'Deux mille personnes attendent qu’il lève une pince pour hurler au hors-jeu. Il '
      + 'la lève très lentement, et il aime beaucoup ça.', 'ATTENDEZ… VOILÀ'],
  ],
  BG6: [
    ['L’Élan Assis', 'Il a appris à s’asseoir sur les phases arrêtées. Quatre rangées lui ont '
      + 'offert une écharpe pour le remercier, et il la porte sur les bois.', 'JE ME BAISSE'],
    ['Les Bois du Virage', 'Les quatre rangées derrière lui ont fait installer des marches. Ils '
      + 'voient mieux qu’avant et ils ne lui rendront jamais sa place.', 'RESTEZ DERRIÈRE MOI'],
  ],
  BG7: [
    ['Le Hérisson à Deux Écharpes', 'Douze mètres de laine, zéro ballon crevé cette saison. Il a '
      + 'appris à rentrer les piquants et ça lui a coûté beaucoup d’efforts.', 'SERREZ-MOI'],
    ['La Pelote', 'Il est entièrement recouvert de laine tricotée par la moitié du bloc D. On ne '
      + 'voit plus un seul piquant et il n’a jamais été aussi content.', 'VENEZ TOUS'],
  ],
  BG8: [
    ['Le Lama Sélectif', 'Il ne crache plus que sur le parcage adverse, et jamais sur les nôtres. '
      + 'Les stadiers ont classé ça en « animation ».', 'CELUI-LÀ, LÀ'],
    ['Le Crachat Légendaire', 'Il a atteint un dirigeant à trente mètres, en 2019, en pleine '
      + 'interview. Le virage en parle encore et lui n’a plus rien à prouver.', 'JE VISE ENCORE'],
  ],
  BG9: [
    ['Le Raton Honnête', 'Onze portefeuilles rendus, zéro gardé. Il fouille toujours les poubelles '
      + 'mais il a maintenant un badge que le club lui a fabriqué.', 'C’ÉTAIT À QUI ?'],
    ['Les Objets Trouvés', 'Il tient le bureau des objets trouvés du stade. Il rend tout, sauf la '
      + 'nourriture, et personne n’a jamais osé lui en faire le reproche.', 'JE L’AVAIS GARDÉ'],
  ],
  BG10: [
    ['Le Teckel à Deux Rangées', 'Il fait la longueur de deux rangées et il sert de barrière '
      + 'officielle. Sa laisse a été rallongée par décision de la direction.', 'JE PRENDS TOUT LE RANG'],
    ['La Barrière Vivante', 'Il tient la séparation du bloc C au bloc D à lui seul. Il dort tout le '
      + 'match. Personne n’est jamais passé.', 'ON NE PASSE PAS'],
  ],
  BG11: [
    ['Le Manchot en Queue-de-Pie', 'Il a ajouté le haut-de-forme. Il regarde les autres avec une '
      + 'consternation polie et il ne dira jamais rien.', 'UN PEU PLUS DE TENUE'],
    ['Le Protocole', 'Il accueille les délégations à l’entrée d’honneur et il s’incline exactement '
      + 'à la bonne profondeur. Le club l’a mis sur l’organigramme.', 'MESSIEURS'],
  ],
  BG12: [
    ['La Tortue Installée', 'Elle part maintenant deux heures avant, et elle arrive à l’heure. '
      + 'C’est une victoire d’organisation que personne d’autre n’a jamais remportée.', 'ME VOILÀ'],
    ['Celle Qui a Tout Vu', 'Cent quatorze ans, trois stades successifs, deux reléga­tions et un '
      + 'titre. Elle repart toujours la dernière, et le gardien du stade l’attend.', 'J’ÉTAIS DÉJÀ LÀ'],
  ],
  BG13: [
    ['La Fourmi à Trois Caisses', 'Elle en porte trois et elle refuse toujours qu’on l’aide. La '
      + 'buvette entière tient sur son dos, littéralement.', 'JE GÈRE, J’AI DIT'],
    ['La Colonne', 'Quatre cents fourmis marchent derrière elle, chacune avec sa caisse. Elle n’a '
      + 'rien demandé à personne : elles sont venues.', 'SUIVEZ'],
  ],
  BG14: [
    ['La Méduse de Secours', 'Le club l’a inscrite au plan d’évacuation. Elle éclaire les issues, '
      + 'pas le virage, ce qui la vexe un peu.', 'ÇA BRILLE PARTOUT'],
    ['La Lumière du Virage', 'Les projecteurs sont tombés une troisième fois, en finale. Le match '
      + 'est allé au bout à sa seule lumière, et personne n’oubliera cette couleur.', 'JE M’EN OCCUPE'],
  ],
  BG15: [
    ['Le Chat Titulaire', 'Il a sa fiche sur le site du club et son propre chant. Il traverse '
      + 'toujours aussi lentement, mais maintenant on l’attend.', 'C’EST TOUJOURS MON TERRAIN'],
    ['La Légende à Quatre Pattes', 'Le stade porte son nom depuis qu’il est mort. Il est revenu le '
      + 'lendemain de l’inauguration, ce qui a créé un léger malaise administratif.', 'J’Y SUIS ENCORE'],
  ],
  BG16: [
    ['Le Pigeon Doyen', 'Il a cédé la meilleure place et pris celle du coin, à l’ombre. Les jeunes '
      + 'viennent lui demander conseil et il fait semblant de dormir.', 'PRENEZ LA MIENNE'],
    ['Le Toit Nord', 'Trois cents pigeons décollent quand il décolle. C’est le plus beau moment du '
      + 'coup d’envoi et le club a arrêté d’essayer de les chasser.', 'TOUS ENSEMBLE'],
  ],
  BG17: [
    ['Le Paresseux à l’Heure', 'Il applaudit maintenant quarante secondes après le but, contre deux '
      + 'minutes avant. C’est le progrès le plus spectaculaire de sa vie.', 'ATTENDEZ… VOILÀ, BUT'],
    ['Le Deuxième But', 'Le virage a pris l’habitude de rejouer sa joie avec lui, en décalé. Ça fait '
      + 'deux célébrations par but et personne ne veut revenir en arrière.', 'ENCORE UNE FOIS'],
  ],
  BG19: [
    ['Le Capybara du Bloc', 'Six rangées se sentent bien autour de lui, désormais. On vient s’asseoir '
      + 'à côté quand la saison va mal, et ça marche.', 'TOUT VA TRÈS BIEN'],
    ['Le Calme', 'Le club l’installe dans le parcage les soirs de derby. Il n’y a plus eu un '
      + 'incident depuis quatre ans et personne n’ose expliquer pourquoi.', 'RESPIREZ'],
  ],
  BG20: [
    ['L’Abeille au Sifflet', 'On l’écoute maintenant, parce qu’elle a un sifflet et beaucoup de '
      + 'persévérance. Le parvis circule mieux depuis, à sa grande surprise.', 'ON AVANCE, ON AVANCE'],
    ['La Circulation', 'Vingt mille personnes entrent en douze minutes. Le plan est le sien, il est '
      + 'affiché en salle de crise, et il porte son nom.', 'PAR ICI'],
  ],
  BG21: [
    ['L’Orang-outan Debout', 'Il se lève encore moins souvent, ce qui est plus impressionnant. Il '
      + 'connaît le prénom de tous ceux qu’il a un jour empêchés de passer.', 'ON NE PASSE TOUJOURS PAS'],
    ['Le Costume', 'Il n’est plus à la porte : il est dans le bureau. Il a fait supprimer les fouilles '
      + 'systématiques et il répond de tout ce qui arrive.', 'JE RÉPONDS D’EUX'],
  ],
  BG22: [
    ['Le Caméléon Démasqué', 'On l’a pris en photo dans les deux tribunes le même soir. Il a assumé '
      + 'en trois secondes et il a gardé les deux abonnements.', 'J’AI TOUJOURS ÉTÉ AVEC VOUS DEUX'],
    ['Les Deux Couleurs', 'Il a monté le seul club de supporters mixte du pays. Ils boivent ensemble '
      + 'avant, ils s’insultent pendant, ils recommencent après.', 'ON EST DU MÊME BORD'],
  ],
  BG23: [
    ['Le Loup du Long Voyage', 'Neuf cents kilomètres, un ballon, une main en mousse. Il chante en '
      + 'face pendant tout le match et il salue le virage à la fin.', 'ON EST TOUJOURS VENUS'],
    ['Le Respect du Parcage', 'Les deux virages applaudissent quand il entre. C’est une des rares '
      + 'choses dont ce championnat puisse être fier et il n’a rien demandé.', 'ON SE RECONNAÎT'],
  ],

  /* =========================================================== LES REVENANTS

     Ils ne vieillissent pas, ils s'installent. Chaque âge les rend plus
     présents, plus habitués au stade — et le stade plus habitué à eux, ce qui
     est la vraie transformation.                                             */

  RV1: [
    ['La Chose Sortie', 'Elle a quitté le bocal en 2011, un soir de barrage. Personne ne l’a vue '
      + 'sortir, et le bocal est resté sur l’étagère, fermé.', 'TOC — TOC — TOC — TOC'],
    ['La Chose du Virage', 'Elle tape sur les barrières, maintenant, et deux mille personnes '
      + 'répondent. Le bocal est exposé à la buvette, vide, avec une petite plaque.', 'ON TAPE TOUS'],
  ],
  RV3: [
    ['Le Lutin Négociateur', 'Il rend la chaussure contre un morceau de sandwich. Les joueurs ont '
      + 'inscrit la ligne au budget et tout le monde s’y retrouve.', 'DONNE, ET JE RENDS'],
    ['L’Intendant', 'Il range le vestiaire mieux que quiconque et il ne cache plus rien. Il cache '
      + 'toujours une chaussure au vestiaire adverse, par principe.', 'TOUT EST EN ORDRE'],
  ],
  RV4: [
    ['La Vapeur du Virage', 'Elle sort de la théière dès la 45e et elle monte jusqu’au bloc C. Les '
      + 'gens s’assoient plus haut depuis, et ils ne savent pas pourquoi.', 'RESTEZ AU CHAUD'],
    ['Le Souffle Chaud', 'Le virage entier est à quatre degrés de plus que le reste du stade. Le '
      + 'service technique a cherché une fuite pendant six ans.', 'JE M’OCCUPE DE VOUS'],
  ],
  RV5: [
    ['Le Loup-Garou du Vendredi', 'Il perd son costume dès le vendredi soir, désormais. Son '
      + 'employeur n’a rien dit et le virage a gagné une soirée.', 'C’EST DÉJÀ L’HEURE'],
    ['Celui Qui n’a Plus de Costume', 'Il a démissionné un lundi matin. Il est chef de virage à plein '
      + 'temps, il gagne trois fois moins, et il n’a jamais aussi bien dormi.', 'PLUS JAMAIS LUNDI'],
  ],
  RV6: [
    ['Le Recousu Complet', 'Il a récupéré un douzième morceau, en 2014, à la mort d’un abonné du '
      + 'bloc B. Il connaît un chant de plus et il le chante seul.', 'JE ME SOUVIENS D’EUX'],
    ['Le Siècle', 'Il porte les chants de vingt supporters disparus et il les apprend aux vivants. '
      + 'Le virage chante des choses dont personne ne connaît l’origine.', 'ILS CHANTENT AVEC MOI'],
  ],
  RV7: [
    ['L’Abonné à Neuf Doigts', 'Deux saisons de plus, deux doigts de moins. Il tient son écharpe '
      + 'autrement et il n’a manqué aucun match.', 'J’AI PAYÉ D’AVANCE'],
    ['L’Abonnement 2041', 'Il ne reste plus grand-chose de lui et son siège est toujours occupé. Le '
      + 'club a promis de ne jamais le revendre, et il tiendra parole.', 'JUSQU’AU BOUT'],
  ],
  RV8: [
    ['Le Troll Indulgent', 'Il accepte les fredonnements, maintenant. Le tunnel s’est vidé et le '
      + 'pont chante à chaque match, faux mais fort.', 'CHANTE, MÊME MAL'],
    ['Le Pont Qui Chante', 'Trois mille personnes chantent en traversant, tous les samedis, depuis '
      + 'huit ans. Il ne demande plus rien : c’est devenu l’entrée du stade.', 'ON Y VA'],
  ],
  RV9: [
    ['La Sirène du Bassin', 'On lui a construit un bassin derrière la buvette. Elle chante juste et '
      + 'le virage chante faux à côté d’elle, ce qui ne la dérange plus.', 'LA VRAIE, LA VOILÀ'],
    ['La Voix Juste', 'Elle donne le ton avant chaque chant et deux mille personnes se calent '
      + 'dessus. Le virage chante juste depuis quatre ans, ce qui a beaucoup surpris.', 'TOUS SUR MA NOTE'],
  ],
  RV11: [
    ['La Sorcière du Rond-Point', 'Une panne sur huit, désormais. Elle a affiné le sort et elle '
      + 'tient un tableau des résultats affiché à la buvette.', 'QUE ÇA CALE VRAIMENT'],
    ['Le Bus Qui n’Arrive Pas', 'Le club adverse arrive systématiquement avec vingt minutes de '
      + 'retard. Personne n’a jamais rien prouvé et le championnat a renoncé.', 'ILS SONT EN RETARD'],
  ],
  RV13: [
    ['Le Cyclope Consulté', 'L’arbitre vidéo lui demande son avis, officieusement, par un stadier '
      + 'interposé. Il a raison plus souvent que l’écran.', 'JE L’AI BIEN VU'],
    ['L’Œil du Stade', 'Il est projeté sur le grand écran pendant les ralentis et vingt mille '
      + 'personnes regardent son œil plutôt que l’image.', 'REGARDEZ-MOI'],
  ],
  RV14: [
    ['Le Fantôme Régularisé', 'Le club lui a fait un abonnement gratuit et une carte à son nom. Il '
      + 'passe quand même à travers le tourniquet, par habitude.', 'J’AI MA CARTE'],
    ['Le Passe-Muraille', 'Il fait entrer les gamins qui n’ont pas les moyens, en les prenant par '
      + 'la main. Le club a définitivement cessé de compter.', 'VIENS, PASSE AVEC MOI'],
  ],
  RV15: [
    ['Le Dragon Adolescent', 'Il maîtrise à peu près ses étincelles et il a payé la bâche. La '
      + 'nouvelle est ignifugée, ce qui l’a beaucoup vexé.', 'JE FAIS ATTENTION'],
    ['Le Feu du Virage', 'Il allume les torches sur commande, au dixième de seconde. Le club a '
      + 'supprimé son budget pyrotechnique et personne ne s’en plaint.', 'À MON SIGNAL'],
  ],
  RV16: [
    ['La Momie en Déplacement', 'Elle a perdu six bandes en douze voyages et elle continue. Le '
      + 'musée du club a mis une pancarte « en tournée » dans sa vitrine.', 'ÇA FAIT PLUS LONGTEMPS'],
    ['La Dernière Bande', 'Il ne lui reste qu’une bande, celle du poignet, et c’est l’écharpe du '
      + 'club. Elle ne la perdra pas. Elle a arrêté les déplacements pour ça.', 'CELLE-LÀ, JAMAIS'],
  ],
  RV17: [
    ['Le Yéti Redescendu', 'Il est resté après le huitième de finale. Il joue cinq notes maintenant '
      + 'et il loge dans le local à ballons.', 'ÇA S’ENTEND DE PLUS LOIN'],
    ['La Corne de Brume', 'On l’entend depuis la montagne. Les gens du village savent si le club a '
      + 'marqué sans avoir allumé la radio.', 'TOUTE LA VALLÉE M’ENTEND'],
  ],
  RV19: [
    ['Le Vampire Abonné', 'Il a pris l’abonnement européen seul, celui des jeudis soirs. C’est le '
      + 'seul supporter du club à ne rater aucun déplacement à l’étranger.', 'ENFIN JEUDI'],
    ['Celui Qui Fait la Nuit', 'Les matchs de l’après-midi ont été déplacés en nocturne. La '
      + 'fédération invoque le direct télévisé. Il ne dit rien et il sourit.', 'IL FAIT NUIT PARTOUT'],
  ],
  RV21: [
    ['La Plante Nourrie', 'Neuf ballons, trois parapluies et un panneau publicitaire. Le club lui '
      + 'apporte les ballons crevés le lundi, pour éviter les incidents.', 'ENCORE DEUX'],
    ['L’Arbre du Parvis', 'Elle fait douze mètres et le parvis a été redessiné autour d’elle. On se '
      + 'donne rendez-vous sous elle et elle ne mange plus personne.', 'VENEZ À L’OMBRE'],
  ],

  /* ============================================================= LES OBJETS

     Ils ne grandissent pas non plus : ils prennent leur place. Un objet du
     stade devient d'abord utile, puis indispensable, puis inamovible — et
     c'est le stade qui s'organise autour de lui.                             */

  OB1: [
    ['La Main à Deux Doigts', 'Elle a gagné un doigt dans un déplacement et personne ne sait '
      + 'comment. Elle désigne deux coupables à la fois, ce qui double son rendement.', 'NUMÉRO UN, ET UN'],
    ['La Main du Virage', 'Deux mille mains en mousse se lèvent quand elle se lève. L’arbitre a '
      + 'appris à ne pas regarder ce côté du stade.', 'TOUS LES DOIGTS'],
  ],
  OB2: [
    ['Le Siège Debout', 'Il a trouvé une place au fond du bloc C, d’où il voit bien. Il n’a plus '
      + 'de ressort et il ne s’assoit sur personne.', 'JE ME SUIS TROUVÉ UNE PLACE'],
    ['La Place de Tout le Monde', 'Il se met là où quelqu’un n’a pas de place. Il y a toujours '
      + 'quelqu’un qui n’a pas de place, et il n’a plus jamais manqué un match.', 'ASSIEDS-TOI, VAS-Y'],
  ],
  OB3: [
    ['Le Pantin de la 85e', 'On lui a changé le ressort : il tient jusqu’à la 85e. Le virage a dû '
      + 'réapprendre à finir les matchs sept minutes plus tard.', 'TIC — TAC — TIC'],
    ['Le Pantin des Arrêts de Jeu', 'Il tient jusqu’au coup de sifflet final, désormais, et il '
      + 'grince. Personne ne veut le remplacer : c’est ce grincement qui fait peur à l’adversaire.',
      'TIC — TAC — ENCORE'],
  ],
  OB4: [
    ['Le Danseur Réglé', 'Le concessionnaire a réclamé son bien. Le virage a fait une collecte, l’a '
      + 'racheté, et lui a mis une écharpe. Il ne tient toujours aucun rythme.', 'WOOOOOOOOOO'],
    ['Le Danseur du Virage', 'Le club l’a mis à l’entrée du stade. Vingt mille personnes passent '
      + 'devant lui chaque samedi et lui tapent dans le bras.', 'WOOO — WOOO — WOOO'],
  ],
  OB5: [
    ['Le Cône Titulaire', 'Le président a mis six mois à s’apercevoir de sa disparition. Il garde '
      + 'maintenant la place du chef de virage, ce qui est un vrai poste.', 'PLACE RÉSERVÉE, MERCI'],
    ['Le Cône de Tête', 'Trente cônes suivent celui-ci pour délimiter le cortège des déplacements. '
      + 'La police les a inscrits au dispositif officiel.', 'ON PASSE PAR LÀ'],
  ],
  OB6: [
    ['Le Distributeur Honnête', 'Il rend la monnaie deux fois sur trois. C’est un progrès et il en '
      + 'est fier. Il garde toujours le reste, mais il donne l’argent au club.', 'VOILÀ VOTRE MONNAIE'],
    ['La Caisse du Virage', 'Il a financé trois déplacements et une bâche avec ce qu’il gardait '
      + 'depuis 2011. Personne ne lui avait rien demandé.', 'C’ÉTAIT POUR VOUS'],
  ],
  OB7: [
    ['Le Mur à Trois', 'Deux autres épouvantails se sont joints à lui. Ils sautent en même temps et '
      + 'ils ne se trompent jamais de côté, contrairement aux vrais.', 'LE MUR TIENT BON'],
    ['Le Mur', 'Cinq épouvantails, formation en V, et zéro coup franc encaissé à l’entraînement '
      + 'depuis deux ans. L’entraîneur a arrêté de mettre des joueurs.', 'ON NE PASSE PAS AU-DESSUS'],
  ],
  OB8: [
    ['Le Bonhomme d’Avril', 'Il a passé l’hiver et il fond depuis quatre mois. Il refuse toujours de '
      + 'rentrer. Le club lui a offert un ventilateur, qu’il refuse aussi.', 'JE TIENS TOUJOURS'],
    ['La Flaque du Bloc D', 'Il ne reste qu’une écharpe, un bouton et une flaque, et la flaque est à '
      + 'sa place au coup d’envoi. Les enfants le reconstruisent chaque décembre.', 'JE REVIENS L’HIVER'],
  ],
  OB9: [
    ['La Machine du Virage', 'Réformée deux fois, réparée trois fois. Elle sert le thé au virage '
      + 'maintenant, pas à la presse, et elle a demandé sa mutation elle-même.', 'AVEC DEUX SUCRES'],
    ['Le Thé de la Mi-Temps', 'Huit cents tasses en quinze minutes, gratuites, par moins deux '
      + 'degrés. Elle n’a jamais expliqué qui payait le thé.', 'IL Y EN A POUR TOUS'],
  ],
  OB10: [
    ['Le Téléviseur du Parvis', 'Il diffuse les matchs à l’extérieur pour ceux qui n’ont pas de '
      + 'billet. Il a une écharpe, une prise, et deux cents personnes devant lui.', 'EN DIRECT, DEHORS'],
    ['Le Café Rouvert', 'Il a racheté le café qui avait fermé, avec l’argent d’une cagnotte du '
      + 'virage. Il diffuse toujours, et il sert aussi le café.', 'ENTREZ, C’EST OUVERT'],
  ],
  OB11: [
    ['Le Nain Naturalisé', 'Le président adverse a réclamé, puis renoncé, puis pris un abonnement. '
      + 'Le nain a une licence au club et il refuse toujours de bouger.', 'JE RESTE ICI, C’EST TOUT'],
    ['Le Gardien du Rond-Central', 'Il est scellé dans le béton au bord de la pelouse. On le touche '
      + 'avant chaque match. Le club a essayé de l’enlever une fois, pour la pelouse.',
      'ON NE ME DÉPLACE PLUS'],
  ],
  OB12: [
    ['Le Poulet du Penalty', 'Le chant qu’il a inspiré fait maintenant quatre couplets. On le presse '
      + 'aussi sur les coups francs manqués, ce qui l’use.', 'COUIC — COUIC'],
    ['Le Cri du Virage', 'Deux mille poulets en caoutchouc pressés en même temps. Le gardien adverse '
      + 'a demandé une interdiction. Elle a été refusée, et c’est heureux.', 'COUIIIIIC'],
  ],

  /* ============================================================ LES ÉPOQUES

     Ils viennent d'ailleurs dans le temps, et ils ne rentrent pas chez eux :
     ils s'installent au club. Le troisième âge, chez eux, c'est le moment où
     personne ne trouve plus étrange qu'ils soient là.                        */

  EP1: [
    ['L’Homme des Tambours', 'Il a troqué son os contre deux maillets et il n’a rien perdu. Il tape '
      + 'toujours sur des choses pour encourager ceux qui courent.', 'OUGH ! OUGH ! OUGH !'],
    ['Le Premier Supporter', 'Sa fresque est sur le mur du virage : une silhouette qui tape, des '
      + 'bâtons, et onze coureurs. Trente mille ans, et rien n’a changé.', 'ON A TOUJOURS FAIT ÇA'],
  ],
  EP2: [
    ['Le Chambreur', 'Il a un abonnement derrière le banc adverse et le club le lui offre. Aucun '
      + 'entraîneur n’a tenu une saison entière à portée de sa voix.', 'ET TROIS, ET QUATRE'],
    ['La Voix d’en Face', 'Les clubs adverses négocient sa place dans les protocoles d’avant-match. '
      + 'Il a fait craquer deux entraîneurs et il n’a jamais insulté personne.', 'ET ENCORE UN'],
  ],
  EP3: [
    ['L’Aviateur au Sol', 'Il a vendu l’avion et pris un abonnement en tribune haute, le plus haut '
      + 'possible. Il dit qu’il voit presque aussi bien.', 'JE VOIS PRESQUE TOUT'],
    ['La Vue d’en Haut', 'Il commente les schémas tactiques depuis le dernier rang et l’entraîneur '
      + 'monte le voir à la mi-temps. Personne au club ne trouve ça bizarre.', 'REGARDEZ L’ESPACE, LÀ'],
  ],
  EP4: [
    ['La Mousquetaire Suspendue', 'Neuf expulsions, neuf retours. Le club paie les amendes et lui '
      + 'demande seulement de prévenir avant.', 'UN POUR TOUS, ENCORE'],
    ['La Garde', 'Elles sont douze, elles ont un code d’honneur écrit, et elles n’ont plus été '
      + 'expulsées depuis quatre ans. Elles défendent surtout les arbitres, maintenant.',
      'TOUS POUR UN'],
  ],
  EP6: [
    ['La Tortue à Six Boucliers', 'Six légionnaires, six boucliers, et un abri qui couvre deux '
      + 'rangées. Ils s’entraînent le mercredi soir dans un gymnase.', 'EN FORMATION, VITE'],
    ['Le Toit', 'Quarante boucliers couvrent tout le bloc les soirs de grêle. Le club a renoncé à '
      + 'poser une vraie toiture : celle-ci vient d’elle-même.', 'ABRITEZ-VOUS'],
  ],
  EP7: [
    ['La Viking du Clap', 'Elle réclame la paternité du clap lent dans chaque stade d’Europe, très '
      + 'fort, et personne n’a jamais pu prouver le contraire.', 'HU ! HU ! HU ! HU !'],
    ['Celle Qui Lève le Bras', 'Vingt mille personnes attendent son bras. Le clap part quand elle le '
      + 'décide et elle prend son temps, parce qu’elle sait ce qu’elle vaut.', 'ATTENDEZ… MAINTENANT'],
  ],
  EP8: [
    ['Le Crieur au Micro', 'On lui a proposé le micro du stade. Il l’a pris, il l’a éteint, et il a '
      + 'continué à crier. Ça porte plus loin, dit-il.', 'OYEZ, OYEZ, BRAVES GENS'],
    ['La Composition', 'Il annonce les onze titulaires sur le parvis, sans sono, une heure avant. '
      + 'Trois mille personnes viennent l’écouter plutôt que de lire l’écran.', 'ÉCOUTEZ, TOUS'],
  ],
  EP9: [
    ['Le Savant Retrouvé', 'Il a remis la main sur la formule, écrite au dos d’un ticket de buvette. '
      + 'Elle est illisible. Il recommence les calculs avec entrain.', 'ÇA VA MARCHER, CETTE FOIS'],
    ['La Formule', 'Le club a marqué le but parfait un soir de mars, exactement comme il l’avait '
      + 'calculé. Il n’a rien dit à personne, et il a jeté le ticket.', 'JE L’AVAIS TROUVÉE'],
  ],
  EP10: [
    ['Le Cowboy Installé', 'Le cheval a une place au parking et un nom sur le mur. Il a fait les '
      + 'deux mille kilomètres dans l’autre sens une fois, pour vérifier, et il est revenu.',
      'J’AI REFAIT LA ROUTE'],
    ['La Route', 'Il conduit le convoi des déplacements, en tête, au pas du cheval. Ça prend trois '
      + 'jours et il y a une liste d’attente de deux ans.', 'ON PART DEMAIN'],
  ],
  EP11: [
    ['La Pirate à l’Échange', 'Elle a quatre-vingt-six écharpes de quatre-vingt-six clubs et elle '
      + 'les porte toutes le jour du dernier match de la saison.', 'À L’ABORDAGE, ENCORE'],
    ['Le Trésor', 'Sa collection est exposée au musée du club, en prêt. Elle a une écharpe de chaque '
      + 'club du pays et elle en manque une seule, qu’elle ne dira pas.', 'IL M’EN MANQUE UNE'],
  ],
  EP12: [
    ['L’Astronaute Revenue', 'Elle a repris un abonnement au sol, rang 12, et elle regarde les '
      + 'matchs en direct pour la première fois de sa vie.', 'REÇU, SANS DÉCALAGE'],
    ['Les Vingt-Deux Secondes', 'Elle a fait installer un écran dans la station orbitale et trois '
      + 'équipages suivent le club. Le retard est toujours de vingt-deux secondes.',
      'ILS REGARDENT LÀ-HAUT'],
  ],
  EP13: [
    ['Le Scaphandrier au Sec', 'Cent quarante ballons repêchés, et le club a fini par grillager le '
      + 'canal. Il descend quand même, le dimanche, par habitude.', 'JE REDESCENDS QUAND MÊME'],
    ['Le Fond du Canal', 'Il a remonté un ballon de 1954, une pancarte et deux bicyclettes. Le tout '
      + 'est au musée du club, dans une vitrine qui porte son nom.', 'IL Y A TOUT, EN BAS'],
  ],
  EP14: [
    ['Le Chevalier du Blason', 'Le bouclier a été restauré et le problème de date reste entier. Le '
      + 'club a cessé de poser la question, ce qui arrange tout le monde.', 'POUR LE BLASON, ENCORE'],
    ['Le Blason', 'C’est son bouclier qui figure sur l’écusson du club depuis la refonte de 2018. '
      + 'Le graphiste n’a jamais compris pourquoi le dessin lui semblait familier.', 'C’EST LE MIEN'],
  ],
  EP16: [
    ['Le Flottant Patient', 'Le ballon met dix-neuf minutes à retomber, désormais. Il a appris à '
      + 'jongler avec deux, ce qui double l’attente et le plaisir.', 'IL RETOMBE… ATTENDEZ'],
    ['La Mi-Temps', 'Son ballon retombe exactement au coup d’envoi de la seconde période. Il a mis '
      + 'onze ans à régler ça et le stade retient son souffle chaque fois.', 'MAINTENANT'],
  ],

  /* ================================================= LES CARTES « X »

     Les personnages d'avant le grand lot. Ils venaient de trois séries — VIRAGE
     NORD, NUITS EUROPÉENNES, LE VIRAGE IMPOSSIBLE — dont les deux premières ont
     été dissoutes ; ils sont aujourd'hui répartis dans six séries, et leur champ
     `set` est le seul à faire foi. Le bloc reste groupé par numérotation.     */

  TR35: [
    ['Le Lanceur de Ola', 'Il ne la suit plus, il la lance. Il faut trois essais et un peu de honte, '
      + 'et à la troisième vingt mille personnes se lèvent.', 'OLA, ENCORE'],
    ['Le Douzième', 'Le club a retiré le numéro 12 et il l’a donné au virage. C’est lui qui a reçu le '
      + 'maillot, un soir, devant tout le monde, et il n’a rien pu dire.', 'ON EST DOUZE'],
  ],
  MT14: [
    ['Écharpes Nouées', 'Les écharpes ne sont plus levées : elles sont attachées les unes aux autres '
      + 'et elles font le tour du bloc. Personne ne récupère la sienne avant la fin.',
      'ON LES ATTACHE'],
    ['La Voûte', 'Quatre mille écharpes forment un toit au-dessus du virage à l’entrée des joueurs. '
      + 'Ça dure quarante secondes et ça se voit depuis l’autre bout de la ville.', 'LEVEZ TOUT'],
  ],
  TR38: [
    ['Section Debout', 'La section cendrée a obtenu ses places debout, après onze ans de dossiers. '
      + 'Elle a fêté ça en restant assise tout un match, par ironie.', 'TOUJOURS FIDÈLES'],
    ['La Section', 'Elle a soixante ans, deux cents membres et ses propres statuts. Elle survivra au '
      + 'club si le club tombe, et elle le sait.', 'ON SERA ENCORE LÀ'],
  ],
  TR39: [
    ['Le Dernier à Sortir', 'Le stadier a arrêté de lui demander de partir : il lui laisse la rangée et va '
      + 'fumer. Ils se disent au revoir, chaque samedi, à la même heure.',
      'ON FERME'],
    ['Le Gardien des Clés', 'Le club lui a donné un trousseau, officiellement pour vérifier les portes. C’est '
      + 'surtout pour qu’il puisse rester aussi longtemps qu’il veut, et tout le monde le '
      + 'sait.',
      'LES CLÉS'],
  ],
  TR40: [
    ['La Mascotte du Samedi', 'Le costume est à sa taille. Elle fait le tour du terrain avant le '
      + 'coup d’envoi et elle a le droit de toucher le ballon, une fois.', 'LA PELUCHE ARRIVE'],
    ['Le Costume Transmis', 'Elle a passé le costume à un gamin de sept ans et elle l’a aidé à '
      + 'l’enfiler. Elle regarde depuis le bord, les mains dans les poches.', 'À TOI DE COURIR'],
  ],
  TR44: [
    ['Le Deuxième Match', 'Il connaît deux chants et il sait quand se lever. Il regarde encore son '
      + 'voisin, mais moins, et son voisin a commencé à lui parler.', 'PRESQUE COMME LES AUTRES'],
    ['Celui Qui Explique', 'Il est assis à côté de quelqu’un qui vient pour la première fois, et il '
      + 'lui dit quand se lever. Il n’a pas oublié.', 'FAIS COMME MOI'],
  ],
  TR48: [
    ['Le Carré Retourné', 'Il a compris le jour où quelqu’un lui a tenu le poignet avant le déploiement. Son '
      + 'carton est à l’endroit depuis, et la mosaïque est parfaite. Elle est moins drôle.',
      'J’AI COMPRIS'],
    ['Celui Qui Distribue', 'C’est lui qui pose les cartons rangée par rangée, la veille au soir, tout seul. Il '
      + 'en retourne un exprès, quelque part, et il ne dit jamais lequel.',
      'TOURNEZ-LE'],
  ],
  TR49: [
    ['L’Homme Sans le Costume', 'Il a enlevé la tête pour de bon et il a un badge à son nom. Les '
      + 'gens le reconnaissent enfin, et ça lui fait un drôle d’effet.', 'DIX MINUTES'],
    ['Le Visage', 'Il est sur l’affiche de la saison, sans costume, avec la tête de mascotte sous le '
      + 'bras. Vingt-deux ans dedans, et une photo dehors.', 'ME VOILÀ, POUR DE BON'],
  ],
  TR50: [
    ['Le Bob Usé', 'Le bob a trente-quatre ans et deux reprises cousues main. Même place, même '
      + 'sandwich, et il a arrêté de compter il y a longtemps.', 'COMME TOUJOURS'],
    ['Le Bob du Musée', 'Le club a demandé le bob pour la vitrine. Il a dit non. Il a proposé de '
      + 'venir s’asseoir dans la vitrine avec, ce qui a clos la discussion.', 'IL RESTE SUR MA TÊTE'],
  ],
  TR51: [
    ['La Note Placée', 'Il a trouvé où poser sa voix et il ne casse plus. Trois rangées lui ont demandé de '
      + 'recommencer comme avant.',
      'JE LA TIENS'],
    ['La Fausse Note Officielle', 'Le virage casse la note avec lui, tous ensemble, à chaque reprise. C’est devenu la '
      + 'façon dont ce chant se chante ici, et les visiteurs ne comprennent jamais.',
      'CASSEZ-LA AVEC MOI'],
  ],
  TR52: [
    ['Le Râleur Abonné', 'Trente-huitième saison, et rien ne va toujours. Il a commencé à râler sur '
      + 'ceux qui râlent, ce qui l’occupe beaucoup.', 'DE MON TEMPS, DÉJÀ'],
    ['La Mauvaise Foi', 'Le club a mis une plaque à son nom sur son siège, de son vivant. Il a dit '
      + 'que la plaque était mal vissée. Il pleurait un peu.', 'ELLE EST DE TRAVERS'],
  ],
  TR36: [
    ['Mosaïque à Deux Tribunes', 'Le dessin couvre deux virages et il faut quatre mille personnes '
      + 'pour le tenir. Vingt secondes de préparation, six secondes d’image.', 'DÉPLOIEMENT, TOUS'],
    ['La Mosaïque', 'Le stade entier, quatre couleurs, un dessin visible d’avion. La photo a fait le '
      + 'tour de l’Europe et personne ne sait qui l’a conçue.', 'TOUT LE STADE'],
  ],
  VP15: [
    ['L’Agent Qui Connaît Tout le Monde', 'Il connaît vraiment quelqu’un, cette fois, et le transfert '
      + 's’est fait. On lui fait un peu plus confiance, et on a un peu tort.', 'J’AI CE QU’IL FAUT'],
    ['Le Carnet d’Adresses', 'Il a placé quatorze joueurs et il a refusé le poste de directeur '
      + 'sportif. Il préfère la tribune d’honneur et le téléphone.', 'JE M’EN OCCUPE'],
  ],
  MS33: [
    ['Le Siffleur Entendu', 'On l’a entendu, une fois, un soir de coupe, et le stade s’est tu. '
      + 'Personne ne l’a toujours pas vu.', 'DEUX COUPS DE SIFFLET'],
    ['Le Souterrain', 'Le virage siffle avec lui à la 74e, tous les matchs, depuis onze ans. Ceux '
      + 'qui ont commencé ne savent plus pourquoi.', 'ON SIFFLE TOUS'],
  ],
  HC15: [
    ['La Radio du Virage', 'Six mille auditeurs, un banc en plastique, toujours la pluie. Elle a '
      + 'refusé deux fois une place en cabine chauffée.', 'ET IL Y A BUT, ENCORE'],
    ['La Voix du Samedi', 'Trois générations ont appris les buts par sa voix. Le club diffuse son '
      + 'commentaire dans le stade, en direct, sur le but du titre.', 'ET LÀ, ÇA Y EST'],
  ],
  IM10: [
    ['Le Drapeau Adopté', 'Le virage a appris le nom du club et le chante une fois par match, au hasard, sans '
      + 'que personne sache pourquoi. Le club en question l’ignore complètement.',
      'ON L’A GARDÉ'],
    ['Le Drapeau du Virage', 'Il est en tête de cortège depuis quatre ans. Deux clubs se réclament de lui, et il '
      + 'n’appartient toujours à personne.',
      'IL EST DES DEUX'],
  ],
  IM11: [
    ['Le Chantier au Rythme', 'Les ouvriers ont compris et ils le font exprès. Ils frappent avec le virage '
      + 'pendant toute la première mi-temps, puis ils s’arrêtent pour regarder le match.',
      'ON SUIT LE RYTHME'],
    ['La Grue Qui Salue', 'Le chantier est fini depuis deux ans. La grue est restée : le club l’a rachetée et '
      + 'elle salue le virage avant chaque coup d’envoi.',
      'ON A FINI'],
  ],

  /* ================================================================ LES VIP

     Ils sont là pour une autre raison que le match : le buffet, la photo, le
     mandat, le client. La série serait une moquerie si elle s'arrêtait là, et
     une moquerie ne se collectionne pas longtemps.

     Leur progression est donc **une conversion, et elle se paie**. Aucun ne
     devient un ultra ; chacun descend d'un étage et y reste. Le troisième âge
     ne renie pas le premier — le Chat Person trouve toujours que ça fait du
     bruit, il ne partirait simplement plus.                                 */

  VP1: [
    ['Le Voisin de Loge', 'Il a cessé d’applaudir les passes latérales. Il ne sait pas quand ni '
      + 'pourquoi, mais il s’est levé un soir de mars et il est resté debout.', 'JE ME LÈVE'],
    ['Celui Qui a Descendu', 'Il a rendu la loge et pris un abonnement en haut du virage, au prix '
      + 'le plus bas du stade. Il trouve toujours que ça fait du bruit. Il ne partirait pour rien '
      + 'au monde.', 'ÇA FAIT DU BRUIT, OUI'],
  ],
  VP2: [
    ['Celui Qui a Retourné le Téléphone', 'Il a filmé le virage au lieu de sa nuque, une fois, par '
      + 'accident. La vidéo a fait dix fois ses chiffres habituels et il n’a pas compris pourquoi.',
      'REGARDEZ-LES'],
    ['L’Archiviste du Virage', 'Quatre ans de tifos, de bâches et de montées, filmés de face et '
      + 'donnés au club. On ne voit jamais son visage dans ses vidéos. C’était pourtant tout ce '
      + 'qu’il voulait montrer.', 'C’EST PAS MOI, C’EST EUX'],
  ],
  VP3: [
    ['L’Ancien Ministre', 'Il n’est plus en campagne et il vient quand même. Il connaît le nom de '
      + 'l’attaquant depuis trois saisons, maintenant, et il le dit moins fort.', 'JE CONNAIS LE NOM'],
    ['L’Abonné du Rang 14', 'Personne ne se souvient de son mandat. Tout le monde sait qu’il tient '
      + 'la buvette du virage le samedi et qu’il rend la monnaie juste.', 'DEUX CAFÉS ?'],
  ],
  VP4: [
    ['Celui Qui a Demandé', 'Il a fini par demander de quel côté était son équipe. La question a '
      + 'fait rire tout le rang, et le rang lui a expliqué pendant une mi-temps entière.',
      'C’EST CELUI-LÀ ?'],
    ['Le Parrain du Nouveau', 'Il repère à chaque match celui qui n’ose pas demander, et il va '
      + 's’asseoir à côté. Il a offert quatorze écharpes en six ans.', 'TU PEUX DEMANDER'],
  ],
  VP5: [
    ['La Loge Rendue', 'Le club n’a pas trouvé de repreneur et l’a ouverte aux associations. Douze '
      + 'places, douze gamins, un buffet qui ne reste plus intact.', 'ELLE EST PLEINE'],
    ['La Tribune des Gosses', 'Il n’y a plus de buffet, il y a des banderoles collées aux vitres. '
      + 'C’est la seule loge du stade qui chante, et elle chante faux.', 'ON EST LÀ-HAUT'],
  ],
  VP6: [
    ['Celui Qui a Écouté', 'Sa voisine a fini sa phrase, puis elle a fini la sienne. Il a mis onze '
      + 'ans à se taire et une mi-temps à apprendre.', 'JE VOUS ÉCOUTE'],
    ['L’Assesseur', 'Il tient la touche des équipes de jeunes le dimanche matin, mal, et il le '
      + 'sait. Elle est venue le corriger deux fois. Il l’a remerciée les deux fois.',
      'J’AI LEVÉ TROP TÔT'],
  ],
  VP7: [
    ['Le Gamin Qui Redescend', 'Il a trouvé l’escalier qui mène du salon d’honneur au virage. Il '
      + 'fait le trajet à chaque mi-temps et il ne l’a dit à personne.', 'JE REVIENS'],
    ['Le Président Qui Monte à Pied', 'Il a le bureau de son père et il ne s’y assoit pas les soirs '
      + 'de match. On le trouve debout au rang 12, avec le maillot sans floquage.', 'JE SUIS EN HAUT'],
  ],
  VP8: [
    ['Celui Qui a Tourné l’Objectif', 'Il a raté l’action une fois de plus et il a photographié le '
      + 'virage à la place. C’est la photo que le club a mise en une.', 'JE L’AI EUE'],
    ['L’Œil du Virage', 'Vingt ans de tribune populaire, aucune photo de but. Son exposition tient '
      + 'dans le hall et elle ne montre que des gens qui regardent.', 'REGARDEZ-VOUS'],
  ],
  VP9: [
    ['La Table Qui S’Est Levée', 'Un but à la 89e, et douze personnes en costume debout d’un coup, '
      + 'dont deux avec la serviette encore autour du cou.', 'ON S’EST LEVÉS'],
    ['Le Rang des Partenaires', 'Ils ont demandé des places debout et le club a dit oui. La nappe a '
      + 'disparu, le dessert aussi, et personne ne s’en est plaint.', 'ON RESTE DEBOUT'],
  ],

  /* =============================================== LA GASTRONOMIE DE COMPTOIR

     Ce qui se mange et se boit debout. Ce sont des choses, pas des gens : elles
     ne font pas carrière, elles **deviennent plus elles-mêmes**. La merguez ne
     s'améliore pas — elle devient inattaquable.

     Deux entrées font exception et c'est voulu : le thermos et le cornet de
     frites finissent par parler de ceux qui les tiennent. Un objet de virage
     ne vaut que par la main qui le passe au rang d'à côté.                  */

  GC1: [
    ['La Merguez de la Maison', 'Toujours noire dehors et glacée dedans. Le nouveau gérant a voulu '
      + 'la changer. Il a reculé devant une pétition de quatre cents signatures.', 'ON Y TOUCHE PAS'],
    ['La Merguez de 1998', 'Elle a un panneau, une date et une file. Des gens qui ne regardent pas '
      + 'le match viennent la manger. Elle est toujours aussi mauvaise, et c’est le sujet.',
      'TOUJOURS LA MÊME'],
  ],
  GC2: [
    ['La Bière du But', 'Elle ne tombe plus par maladresse : elle tombe à la 92e, et trois rangs ont '
      + 'la nuque mouillée en riant.', 'C’EST POUR LE BUT'],
    ['La Douche du Virage', 'Premier but de la saison, tout le monde lève son gobelet et personne ne '
      + 'le rattrape. Ce n’est écrit nulle part et ça se fait depuis onze ans.', 'LEVEZ-LES'],
  ],
  GC3: [
    ['Le Triangle Sans Date', 'On a arrêté d’imprimer la date. Personne ne l’a demandé, ce qui en '
      + 'dit long sur tout le monde.', 'ON SAIT PAS'],
    ['Le Monument sous Plastique', 'Au menu depuis trente ans, au même prix, et resté exactement '
      + 'aussi mauvais. C’est devenu une forme de loyauté.', 'C’EST TOUJOURS DU THON'],
  ],
  GC4: [
    ['La Frite Qu’On Mange Quand Même', 'Elle plie toujours. On la mange toujours. Deux faits qui ne '
      + 'se sont jamais contredits.', 'ELLE TOMBE ENCORE'],
    ['Le Cornet Partagé', 'Un cornet pour quatre, posé sur un genou, au dernier rang. Elles sont '
      + 'molles, tièdes, et il n’en reste jamais.', 'PRENDS-EN'],
  ],
  GC5: [
    ['Le Gobelet de la Cuisine', 'Il a quitté le stade dans une poche. Il sert au café du matin '
      + 'depuis deux ans, avec le logo du sponsor de la saison 2019.', 'JE L’AI GARDÉ'],
    ['L’Étagère de Gobelets', 'Quarante-trois, rangés par saison, dans une cuisine. C’est la seule '
      + 'collection de la maison que personne n’a le droit de jeter.', 'IL EN MANQUE DEUX'],
  ],
  GC6: [
    ['La Queue Qui Se Parle', 'Douze minutes de file, et on a fini par se dire bonjour. Trois '
      + 'amitiés du virage sont nées entre la caisse et le percolateur.', 'TU ÉTAIS OÙ, TOI ?'],
    ['Le Deuxième Virage', 'On y rate la reprise et on y refait le match d’avant. Certains y vont '
      + 'sans avoir soif.', 'JE PRENDS RIEN'],
  ],
  GC7: [
    ['Le Thermos Qui Fait le Tour', 'Six personnes acceptent maintenant. Le café n’est pas meilleur ; '
      + 'le rang a juste compris ce qu’on lui proposait.', 'À TOI'],
    ['Le Thermos Sans Lui', 'Il n’est plus là. Le thermos est venu quand même, porté par quelqu’un '
      + 'd’autre, et il a fait le tour du rang comme d’habitude.', 'IL EN RESTE'],
  ],
  GC8: [
    ['Le Barbecue du Parking', 'Deux heures avant, trois grilles, et une odeur qui traverse la '
      + 'route. Personne n’a jamais demandé d’autorisation.', 'C’EST PRÊT'],
    ['Le Repas d’Avant-Match', 'Cent vingt personnes, des tables pliantes, et le club qui ferme les '
      + 'yeux depuis quinze ans. La meilleure buvette du stade est dehors.', 'IL Y EN A POUR TOUS'],
  ],
  GC9: [
    ['Le Siège Qu’On Évite', 'Rang 9, place 14. Les habitués savent. Les nouveaux apprennent, une '
      + 'fois.', 'PAS CELUI-LÀ'],
    ['La Relique du Rang 9', 'Le stade a été rénové. Le siège a été gardé, remonté à l’identique, '
      + 'avec ce qu’il y avait dessous. Quelqu’un a décidé que c’était de l’histoire.',
      'IL EST TOUJOURS LÀ'],
  ],

  /* ================================================ LES GALÈRES DE DÉPLACEMENT

     Une galère de déplacement raconte toujours la même chose : on y arrive
     quand même, et on y arrive ensemble. La progression va donc de l'incident
     subi à **l'incident devenu rituel** — le car sans chauffage en a un, et il
     l'a gardé après avoir eu le chauffage. Ce n'était pas le froid.         */

  GD1: [
    ['Le Minibus Réparé', 'Quelqu’un s’y connaissait, finalement, et c’était la personne à qui on '
      + 'n’avait pas demandé. Ils sont arrivés à la 20e.', 'ELLE REPART'],
    ['Le Minibus de Tout le Monde', 'Cent quatre-vingt mille kilomètres et un nom peint sur le '
      + 'flanc. Trois générations de déplacements sont montées dedans. Il tombe encore en panne.',
      'ON MONTE'],
  ],
  GD2: [
    ['Le GPS Qu’On N’Écoute Plus', 'Il annonce toujours vingt minutes. On a pris l’habitude de '
      + 'doubler, et on arrive à l’heure depuis.', 'DIS-EN QUARANTE'],
    ['La Route Qu’On Connaît', 'Personne ne l’allume plus. Quarante déplacements par an et une '
      + 'sortie d’autoroute qu’on prend les yeux fermés, en chantant.', 'TOURNE À DROITE'],
  ],
  GD3: [
    ['Le Péagiste Qui Reconnaît le Car', 'Il ouvre les yeux, maintenant, et il lève la barrière '
      + 'avant qu’on s’arrête. Il n’a jamais dit un mot.', 'IL A OUVERT'],
    ['Celui de la Cabine 4', 'Il a une écharpe accrochée derrière lui et personne ne sait qui la lui '
      + 'a donnée. Le car klaxonne chaque fois. Il lève la main chaque fois.', 'IL A FAIT SIGNE'],
  ],
  GD4: [
    ['La Roue de Secours', 'Elle était bien sous les écharpes. Sept personnes ont déchargé le coffre '
      + 'sur le trottoir, en maillot, sous la pluie, en quatre minutes.', 'ON L’A'],
    ['Les Quatre Minutes', 'C’est le record, et il est affiché dans le local du groupe. Ceux qui ont '
      + 'fait le changement ne se parlaient pas avant ce jour-là.', 'ON L’A FAIT'],
  ],
  GD5: [
    ['L’Aire du Retour', 'Même café tiède, même néon. On y parle, cette fois : il y a eu un but à la '
      + '88e et il faut le raconter quarante fois.', 'RACONTE ENCORE'],
    ['Le Point de Rendez-Vous', 'Trois cars, deux groupes, une aire d’autoroute à quatre heures du '
      + 'matin. Ils ne sont pas du même club. Ils se serrent la main depuis six ans.', 'VOUS AUSSI ?'],
  ],
  GD6: [
    ['Le Car aux Drapeaux', 'On a arrêté d’attendre le chauffage. Les drapeaux servent de '
      + 'couvertures et personne ne les a jamais autant aimés.', 'SERRE-TOI'],
    ['Le Car du Groupe', 'Il a le chauffage, maintenant. Tout le monde dort quand même à quatre sous '
      + 'deux drapeaux. Ce n’était pas le froid, en fait.', 'ON EST SERRÉS'],
  ],
  GD7: [
    ['Le Contrôle Qui Dure', 'Quarante passeports, deux agents, et le coup d’envoi passé. On a '
      + 'écouté le premier but debout dans une file.', 'ON A ENTENDU'],
    ['La File Qui Chante', 'On a fini par chanter dans la file, doucement, à cause des agents. Ils '
      + 'ont laissé faire. Deux d’entre eux connaissaient les paroles.', 'DOUCEMENT'],
  ],
  GD8: [
    ['Le Quai Qui S’Organise', 'Trente personnes, quatre voitures, et un covoiturage monté en onze '
      + 'minutes sur un quai. Il restait deux personnes sans place. Elles ont eu une place.',
      'QUI PREND QUI ?'],
    ['Le Quai 3', 'C’est là qu’on se retrouve maintenant, même quand le train n’est pas supprimé. Le '
      + 'panneau d’affichage a moins d’importance que prévu.', 'ON EST OÙ D’HABITUDE'],
  ],
  GD9: [
    ['L’Escorte Qu’On Salue', 'Du péage au parking sans un arrêt, et une main levée à la fenêtre du '
      + 'dernier car. Le motard a répondu.', 'IL A RÉPONDU'],
    ['Le Convoi', 'Deux cents personnes, quatre cars, gyrophares. On n’est pas importants, on est '
      + 'nombreux, et ce jour-là on n’a pas fait la différence.', 'ON EST NOMBREUX'],
  ],

  GD17: [
    ['La Glacière Pleine', 'Elle tient six heures de route sans rien laisser tiédir, et elle fait le tour '
      + 'du car deux fois. On la garde jusqu’au dernier péage.', 'ENCORE UN TOUR'],
    ['Le Buffet Roulant', 'Le grand buffet des déplacements : des tartes, du pain, des fruits, et tout le '
      + 'virage autour. Elle penche toujours un peu d’un côté.', 'À TABLE, LE VIRAGE'],
  ],

  GD18: [
    ['Le Duvet du Car', 'Toute la rangée dort dessous, serrée, sans un bruit. Il retient le sommeil '
      + 'jusqu’à l’arrivée.', 'ON DORT ENCORE'],
    ['La Yourte', 'Une maison de nomade en feutre, ronde et chaude, où tout le groupe tient. Le '
      + 'vieux sac est roulé à l’entrée.', 'ENTREZ AU CHAUD'],
  ],

  GD19: [
    ['Le Billet Plié', 'Elle plie maintenant chaque billet en quatre et elle se souvient de chaque '
      + 'place. Personne n’entre sans elle.', 'RANG 12, PLACE 4'],
    ['Celle Qui Garde les Billets', 'Gardienne d’une bibliothèque de billets, elle sait par cœur chaque déplacement '
      + 'depuis le premier. Elle en garde un dans sa chaussette, par habitude.', 'JE LES AI TOUS'],
  ],

  GD20: [
    ['Le Chauffeur Qui Chante', 'Il a appris tous les chants à force de les entendre, et il donne le rythme au '
      + 'volant. Le car chante à sa cadence.', 'TOUT LE MONDE CHANTE'],
    ['Le Roi de la Route', 'Roi des grandes routes, il mène un convoi de cars et de camions qui klaxonnent '
      + 'en mesure. Il n’a toujours pas vu un match.', 'LA ROUTE EST À NOUS'],
  ],

  GD21: [
    ['La Valise Réparée', 'Ses roues tournent à nouveau, et elle claque en rafales sur les pavés. Elle '
      + 'porte les souvenirs de tout le monde.', 'CLAC-CLAC-CLAC'],
    ['La Malle aux Trésors', 'Coffre au trésor de tous les voyages, elle déborde de perles et de souvenirs. '
      + 'Une de ses roues racle toujours.', 'OUVREZ LA MALLE'],
  ],

  GD22: [
    ['La Copilote', 'Elle lit la route à voix haute et relance à chaque virage. Les jeunes ont '
      + 'appris à se tenir.', 'À GAUCHE, À FOND'],
    ['La Reine du Rallye', 'Championne des pistes, elle saute les dunes au volant d’une voiture de rallye. '
      + 'Elle a gardé ses lunettes de la petite citadine.', 'PLEIN GAZ'],
  ],

  GD23: [
    ['Le Panneau Qu’On Rate', 'Il change de côté au dernier moment, et le car bascule avec lui. On a fini par '
      + 'l’aimer.', 'DEMI-TOUR'],
    ['Le Grand Carrefour', 'Gardien de tous les carrefours, il tourne ses quatre panneaux vers chaque '
      + 'route. Il fait encore rater la sortie, une fois sur deux.', 'TOUTES LES ROUTES'],
  ],

  GD24: [
    ['La Carte Dépliée', 'Elle se souvient de chaque route prise, et elle les montre à qui veut. Elle ne '
      + 'se replie toujours pas.', 'PAR LÀ'],
    ['L’Atlas', 'Atlas de toutes les routes, ses pages s’ouvrent sur chaque déplacement. Un '
      + 'coin reste toujours froissé.', 'TOUTES LES ROUTES MÈNENT ICI'],
  ],

  GD25: [
    ['Le Scout du Virage', 'Il porte maintenant le sac des autres et il connaît tous les chants. Il lève '
      + 'l’écharpe le premier.', 'ÉCHARPES EN L’AIR'],
    ['L’Explorateur', 'Grand explorateur, il mène l’expédition à travers les jungles et les '
      + 'montagnes. Son sac est toujours trop lourd.', 'EN AVANT'],
  ],

  GD26: [
    ['Le Ferry Qui Chante', 'Il renvoie les chants d’un pont à l’autre, comme un écho sur la mer. Tout le '
      + 'bateau répond.', 'LA MER RÉPOND'],
    ['Le Paquebot', 'Géant des mers, il traverse la nuit avec quatre ponts de fenêtres allumées. '
      + 'Son écho s’entend jusqu’au port.', 'TOUS SUR LE PONT'],
  ],

  GD27: [
    ['La Cuisinière de Nuit', 'Elle fait tourner les poêles et les cafés pour tout le car. Ça sort à la '
      + 'chaîne.', 'UN CAFÉ, DEUX CAFÉS'],
    ['La Reine du Relais', 'Reine de l’auberge des routes, elle accueille tous les voyageurs de la nuit. '
      + 'Elle lance toujours les sandwichs.', 'LE RELAIS EST OUVERT'],
  ],

  GD28: [
    ['Le Ticket Composté', 'Il connaît le rythme de toutes les rames, et il donne la mesure du chant. '
      + 'Composté, mais jamais jeté.', 'STATION SUIVANTE'],
    ['Le Grand Métro', 'Grand chef de toutes les lignes, il fait rouler les rames en cadence sous la '
      + 'ville. Il garde son vieux ticket dans la poche.', 'TOUTES LES LIGNES'],
  ],

  GD29: [
    ['Le Coussin du Retour', 'Il a appris à garder son air, juste ce qu’il faut. Tout le car dort sur lui au '
      + 'retour.', 'JUSTE ASSEZ'],
    ['Le Nuage de Sommeil', 'Nuage de sommeil de tout le car, il berce les supporters jusqu’au matin. Il '
      + 'fuit toujours un peu.', 'DORMEZ, ON GAGNE'],
  ],

  GD30: [
    ['La Routarde', 'Elle fait le chemin dans les deux sens, aller et retour, sans jamais se '
      + 'perdre. Le carton est couvert de routes.', 'ALLER-RETOUR'],
    ['La Nomade', 'Nomade de toutes les routes, elle traverse les déserts et les montagnes. Elle '
      + 'garde son vieux carton sous le bras.', 'LA ROUTE CONTINUE'],
  ],

  GD31: [
    ['Le Klaxon à Trois Tons', 'Il joue trois notes, toujours les mêmes, et le parking entier répond. Les '
      + 'chauffeurs le reconnaissent.', 'TÛT-TÛT-TÛT'],
    ['La Fanfare des Routes', 'Géant des cuivres, il fait sonner mille klaxons comme un orgue. Il est encore '
      + 'enroué.', 'TOUS LES KLAXONS'],
  ],

  GD32: [
    ['Le Bouchon du Retour', 'Il repart au compte à rebours, voiture par voiture. Tout le car compte avec '
      + 'lui.', 'TROIS, DEUX, UN… ON BOUGE'],
    ['Le Dragon d’Autoroute', 'Grand dragon de lumière, il serpente dans la nuit fait de mille voitures '
      + 'allumées. On le regarde passer comme une fête.', 'LE DRAGON PASSE'],
  ],

  GD33: [
    ['La Station-Service', 'Ses lumières dessinent le virage sur le bitume, et le groupe pose devant. '
      + 'C’est la photo de chaque retour.', 'LA PHOTO !'],
    ['Le Phare des Routes', 'Phare lumineux des grandes routes, il guide tous les cars dans la nuit. Il '
      + 'garde sa vieille pompe.', 'SUIVEZ LA LUMIÈRE'],
  ],

  GD34: [
    ['Le Cycliste au Long Cours', 'Il pédale de plus en plus vite à l’approche du stade. Le virage l’entend '
      + 'arriver.', 'PLUS VITE'],
    ['Le Tour du Monde', 'Il a fait le tour du monde des stades à vélo, et il accélère encore. Ses '
      + 'vieilles sacoches sont toujours là.', 'LE TOUR DU MONDE'],
  ],

  GD35: [
    ['La Reporter', 'Elle colle ses photos côte à côte, et elles dessinent tout le virage. Il en '
      + 'manque toujours une.', 'UNE DE PLUS'],
    ['La Grande Reporter', 'Grande reporter couverte de souvenirs, elle fait de chaque voyage une immense '
      + 'mosaïque. Elle a encore son appareil jetable.', 'LA PHOTO DU SIÈCLE'],
  ],

  GD36: [
    ['L’Essuie-Glace Qui Danse', 'Il a fini par danser sur le chant, juste à côté du temps. Le car chante entre '
      + 'deux coups.', 'ENTRE DEUX COUPS'],
    ['Le Métronome', 'Métronome de tout le virage, il bat la mesure d’un grand balancier de cuivre. '
      + 'Il grince encore un peu.', 'TIC, TAC, ON CHANTE'],
  ],

  GD37: [
    ['La Mémoire du Car', 'Elle raconte chaque déplacement comme si c’était hier, et personne ne la '
      + 'coupe. Elle tient jusqu’au bout.', 'JE M’EN SOUVIENS'],
    ['L’Ancêtre des Déplacements', 'Ancêtre de toutes les routes, elle porte mille souvenirs cousus sur sa cape. '
      + 'Son tricot n’est toujours pas fini.', 'ON NE LÂCHE RIEN'],
  ],

  GD38: [
    ['La Contrôleuse Qui Sourit', 'Elle lance les chants d’un wagon à l’autre, et le train entier suit. Elle n’a '
      + 'jamais mis une amende.', 'TOUT LE TRAIN'],
    ['La Gardienne des Rails', 'Gardienne de la grande gare, elle mène tous les trains au signal. Elle garde '
      + 'sa pince à billets.', 'EN VOITURE'],
  ],

  GD39: [
    ['La Tente Qui Tient', 'Elle tient enfin, et on y accroche toutes les écharpes du groupe. On la voit '
      + 'depuis la route.', 'ELLE TIENT !'],
    ['Le Camp de Toile', 'Grand camp de toile, il loge tout le virage sous les étoiles. Un piquet est '
      + 'toujours de travers.', 'TOUT LE CAMP DEBOUT'],
  ],

  GD40: [
    ['Le Steward du Charter', 'Il relance la cabine à chaque trou d’air, et l’avion entier chante. Le retard '
      + 'passe vite.', 'ATTACHEZ VOS CEINTURES'],
    ['Le Commandant de Bord', 'Commandant du grand avion, il fait décoller tout le virage au-dessus des '
      + 'nuages. Il garde son chariot de boissons.', 'DÉCOLLAGE'],
  ],

  GD41: [
    ['La Clé du 12', 'Elle range chaque supporter dans la bonne chambre, au bon étage. Plus personne '
      + 'ne dort dans le couloir.', 'CHACUN SA CHAMBRE'],
    ['Le Grand Hôtel', 'Grand hôtel vivant, ses balcons sont pleins de supporters qui chantent. La clé '
      + 'du 12 se perd encore.', 'TOUS AUX BALCONS'],
  ],

  GD42: [
    ['La Collectionneuse de Stades', 'Elle lance la vague dans chaque stade qu’elle visite, et la vague la suit. Son '
      + 'carnet déborde.', 'LA VAGUE PART'],
    ['L’Atlas des Tribunes', 'Atlas vivant des tribunes, elle porte des dizaines de stades sur sa cape. Elle '
      + 'a gardé son premier carnet.', 'TOUTES LES TRIBUNES'],
  ],

  GD43: [
    ['Le Sac en Papier', 'Il tient maintenant tout le trajet sans broncher, le sac plié dans la poche. '
      + 'Il n’a plus besoin de s’arrêter.', 'JE TIENS'],
    ['Le Marin Aguerri', 'Vieux marin qui ne craint aucune tempête, il tient la barre jusqu’au port. Il '
      + 'garde le sac en papier, au cas où.', 'TENEZ BON'],
  ],

  GD44: [
    ['Le Scooter Chargé', 'Il porte maintenant les sacs de tout le groupe, et il ne tousse plus. Son '
      + 'klaxon tape la mesure.', 'ON CHARGE'],
    ['La Caravane', 'Caravane roulante de tout le voyage, il tire une petite maison derrière lui. '
      + 'Il tousse encore dans les côtes.', 'EN ROUTE'],
  ],

  GD45: [
    ['La Cantatrice des Routes', 'Elle chante comme à l’opéra, et tout le car tient sa mesure. Le micro a '
      + 'changé, pas elle.', 'TOUT LE CAR'],
    ['La Voix de Tout le Convoi', 'Cantatrice de tout le convoi, elle chante d’un car à l’autre. Elle garde le '
      + 'vieux micro.', 'TOUT LE CONVOI'],
  ],

  GD46: [
    ['La Mascotte du Car', 'Il porte une écharpe autour du cou et il suit tous les déplacements. Il monte '
      + 'toujours le premier.', 'IL EST DES NÔTRES'],
    ['Le Chien de Traîneau', 'Chef de la meute des neiges, il tire le traîneau sous les aurores. Il a gardé '
      + 'sa vieille écharpe.', 'EN AVANT, LA MEUTE'],
  ],

  GD47: [
    ['La Mère Qui Va au Travail', 'Elle allume une lanterne pour chacun de ceux qui rentrent, et la ville se '
      + 'dessine. Elle est toujours debout.', 'ON EST RENTRÉS'],
    ['La Veilleuse', 'Gardienne des lanternes, elle veille sur tous ceux qui rentrent de nuit. Elle '
      + 'a toujours les yeux un peu fatigués.', 'LES LANTERNES BRILLENT'],
  ],

  GD48: [
    ['Le Porteur', 'Il porte maintenant le groupe entier, sacs et supporters compris. Il ne lâche '
      + 'jamais.', 'JE PORTE TOUT'],
    ['Le Titan des Bagages', 'Titan qui porte le monde, il tient sur ses épaules un globe de valises. Il a '
      + 'gardé son vieux chariot.', 'LE MONDE SUR LES ÉPAULES'],
  ],

  GD49: [
    ['La Lampe du Tunnel', 'Elle vise juste maintenant, et son faisceau trouve chaque sortie. Le groupe la '
      + 'suit.', 'PAR ICI'],
    ['La Mine', 'Grande lampe des galeries, elle éclaire tous les tunnels sous la montagne. '
      + 'Elle a gardé son vieil élastique.', 'LA LUMIÈRE AU BOUT'],
  ],

  GD50: [
    ['La Carte Envoyée', 'Elle part maintenant de chaque ville, et elle relance l’envie de repartir. La '
      + 'grand-mère les collectionne.', 'ON REPART'],
    ['La Poste du Monde', 'Grand bureau de poste vivant, il envoie des nouvelles dans toutes les villes. '
      + 'La première carte est encore cornée.', 'DES NOUVELLES DE PARTOUT'],
  ],

  GD51: [
    ['Le Wagon-Lit', 'Il compte les gares jusqu’à l’arrivée, et tout le wagon compte avec lui. On '
      + 'dort un peu mieux.', 'PLUS QUE TROIS GARES'],
    ['Le Train des Rêves', 'Grand train qui roule dans les rêves, il traverse les nuages sous la lune. La '
      + 'couchette est toujours trop courte.', 'TOUS À BORD'],
  ],

  GD52: [
    ['Le Triangle du Bas-Côté', 'Il clignote avec les feux de détresse, l’un après l’autre, et les voitures '
      + 'ralentissent. Deux signaux, une seule alerte.', 'DEUX COUPS, ATTENTION'],
    ['La Sentinelle du Bas-Côté', 'Sentinelle des routes de nuit, elle balaie l’ombre de sa grande lumière. Elle '
      + 'a gardé son reflet rouge.', 'RALENTISSEZ'],
  ],

  /* ================================================== LES PHÉNOMÈNES MÉTÉO

     Le vent, la pluie, la grêle : rien de tout cela n'a d'intention, et c'est
     exactement ce qui les rend jouables. Ils montent en **intensité**, puis le
     virage se les approprie — le vent finit sur le plan du stade, la grêle
     finit en chant. Un phénomène devient un personnage le jour où des gens
     décident de faire quelque chose avec.                                   */

  MT1: [
    ['Le Vent de la Seconde Période', 'Il tourne toujours à la mi-temps. Les deux entraîneurs le '
      + 'savent et font semblant de ne pas en tenir compte.', 'IL VA TOURNER'],
    ['Le Vent du Stade', 'Il a un nom dans le club, une direction connue et une statistique. On l’a '
      + 'mis sur le plan du stade, en flèche, à l’entrée du virage.', 'IL EST À NOUS'],
  ],
  MT2: [
    ['La Pluie Qui Reste', 'Quatre-vingt-dix minutes sans une accalmie, et pas un siège libre dans '
      + 'le virage. Les capuches ne servent toujours à rien.', 'ON EST TREMPÉS'],
    ['Le Match de la Pluie', 'On en parle encore. Personne ne se souvient du score, tout le monde se '
      + 'souvient d’être resté debout jusqu’au bout.', 'ON EST RESTÉS'],
  ],
  MT3: [
    ['Le Quart d’Heure Ouest', 'Dix-sept heures pile, et le virage a compris qu’il pouvait s’en '
      + 'servir. Les bâches se lèvent d’un coup à la 62e.', 'MAINTENANT'],
    ['L’Heure du Virage', 'Le club programme les coups d’envoi en fonction. Ce n’est écrit dans '
      + 'aucun règlement et ça se voit dans le calendrier.', 'À DIX-SEPT HEURES'],
  ],
  MT4: [
    ['Le Brouillard Qui Chante', 'On ne voit plus rien, alors on écoute. Le virage a chanté '
      + 'quatre-vingt-dix minutes d’un match qu’il n’a pas vu.', 'ON CHANTE PAREIL'],
    ['Le Match Qu’On a Entendu', 'Le seul match dont personne n’a de photo. Tout le monde raconte le '
      + 'même but, et chacun le raconte différemment.', 'JE L’AI ENTENDU'],
  ],
  MT5: [
    ['La Grêle sur les Bâches', 'Cinq minutes de tambour sur deux cents mètres de plastique tendu. '
      + 'Le virage a suivi le rythme sans se concerter.', 'TAPEZ AVEC'],
    ['Les Cinq Minutes Blanches', 'La pelouse blanche, l’arbitre qui laisse jouer, et un chant né ce '
      + 'soir-là qu’on entend encore. Il dure exactement cinq minutes.', 'ENCORE CINQ'],
  ],
  MT6: [
    ['La Pause Fraîcheur', 'Trente-huit degrés, et le virage est resté debout pendant que la tribune '
      + 's’asseyait. Ce n’était pas malin.', 'ON RESTE DEBOUT'],
    ['L’Ombre Partagée', 'Deux bâches tendues au-dessus du rang, à bout de bras, à tour de rôle. '
      + 'Personne n’a demandé qui tenait quoi.', 'TIENS ÇA'],
  ],
  MT7: [
    ['Le Terrain Praticable', 'Quelqu’un a fini par marcher dessus. Le match s’est joué et trois '
      + 'joueurs sont tombés avant la première minute, comme prévu.', 'ÇA GLISSE ENCORE'],
    ['Les Bénévoles de Sept Heures', 'Quarante personnes, du sel, des bâches, et quatre heures avant '
      + 'le coup d’envoi. Le match a eu lieu. Personne ne l’a su.', 'ON A DÉGAGÉ'],
  ],
  MT8: [
    ['La Bourrasque Attendue', 'Le virage souffle quand le ballon part. Ça ne change rien et ça se '
      + 'fait quand même, à chaque corner, depuis deux saisons.', 'SOUFFLEZ'],
    ['Le Douzième Souffle', 'Trois buts lui sont attribués. Aucun n’est pour le même camp. Le virage '
      + 'souffle quand même, et c’est bien le sujet.', 'ON SOUFFLE TOUS'],
  ],

  MT15: [
    ['La Bruine Fidèle', 'Elle vient à tous les matchs d’automne, une perle d’eau au bout du nez. Elle '
      + 'chante juste à côté du temps, comme la pluie qui tombe entre les gouttes.', 'PERLE PAR PERLE'],
    ['Le Crachin Éternel', 'Couverte de mille perles d’eau qui brillent sous les projecteurs, elle n’a '
      + 'jamais vu un match au sec. Elle ne le regrette pas.', 'IL CRACHINE ENCORE'],
  ],

  MT16: [
    ['L’Arc Qui Revient', 'Il revient à chaque victoire, un peu plus large. Le virage lève les yeux avant '
      + 'même que l’arbitre siffle la fin.', 'IL REVIENT'],
    ['Le Pont des Couleurs', 'Il tient un pont de couleurs au-dessus du stade, et tout le virage passe '
      + 'dessous en chantant. On dit qu’il mène tout droit au match suivant.', 'TOUS SOUS LE PONT'],
  ],

  MT17: [
    ['Le Parapluie Partagé', 'Il a trouvé un parapluie plus grand et il le tend au-dessus de tout le rang. '
      + 'Le rang de derrière demande déjà le même.', 'SERREZ-VOUS'],
    ['Le Toit de Toile', 'Une grande toile peinte tendue au-dessus du virage, et lui dessous, qui tient '
      + 'le mât. Il pleut partout dans le stade, sauf chez nous.', 'LA TOILE TIENT'],
  ],

  MT18: [
    ['Le Nuage Posé', 'Il ne bouge plus de la tribune, quel que soit le vent. Les autres nuages '
      + 'commencent à s’arrêter à côté de lui.', 'ON NE BOUGE PAS'],
    ['Le Plafond du Stade', 'Il mène un troupeau de nuages qui font un plafond au-dessus du stade. Les '
      + 'jours de grand soleil, c’est lui qui fait l’ombre.', 'LE CIEL EST À NOUS'],
  ],

  MT19: [
    ['La Flaque Évitée', 'Les habitués sautent par-dessus sans regarder, les nouveaux tombent dedans. '
      + 'Elle reflète déjà tout le parvis.', 'SAUTE !'],
    ['Le Miroir d’Eau', 'Calme comme un lac, elle renvoie le stade entier à l’envers. Le soir, le '
      + 'virage s’y regarde chanter.', 'REGARDE-TOI'],
  ],

  MT20: [
    ['Le Thermomètre à Zéro', 'Il est descendu à zéro un soir de décembre, et la buvette a battu son record. '
      + 'Il en est encore fier.', 'ZÉRO PILE'],
    ['La Colonne de Mercure', 'Grand savant de verre et d’argent, il mesure la chaleur du virage, pas celle '
      + 'de l’air. Elle monte toujours à la dernière minute.', 'ÇA MONTE'],
  ],

  MT21: [
    ['La Tempête du Déplacement', 'Le car a roulé dans une tempête de sable, et c’est elle qui a guidé le '
      + 'chauffeur. Elle s’est noué l’écharpe sur le visage et n’a rien lâché.', 'SUIVEZ-MOI'],
    ['La Dune Debout', 'Cheffe de caravane, elle mène tout le convoi à travers le désert jusqu’au '
      + 'stade. Il lui reste toujours du sable dans les yeux.', 'LA CARAVANE ARRIVE'],
  ],

  MT22: [
    ['La Gourde Pleine', 'Elle vient avec trois gourdes et une glacière, et personne n’a plus soif '
      + 'autour d’elle. Elle tient jusqu’au coup de sifflet.', 'IL EN RESTE'],
    ['La Source', 'Gardienne d’une oasis fraîche au milieu de la chaleur, elle ne sèche jamais. '
      + 'On dit que le virage boit à sa source.', 'LA SOURCE COULE'],
  ],

  MT23: [
    ['Les Premiers Flocons', 'Il n’est plus seul, et ils tournent ensemble en glissant comme des patineurs. '
      + 'Le match s’arrête pour les regarder.', 'ILS ARRIVENT'],
    ['La Tempête de Neige', 'Roi de la tempête blanche, il fait danser des milliers de flocons autour de '
      + 'lui. Le match continue, et personne ne voit plus le ballon.', 'TOUT EST BLANC'],
  ],

  MT24: [
    ['La Dentelle aux Fenêtres', 'Le givre dessine de la dentelle sur les vitres de la buvette, et elle '
      + 'reconnaît ses points. Elle tricote avec des aiguilles de glace.', 'MAILLE À L’ENVERS'],
    ['La Dentelle de Givre', 'Reine de la dentelle de givre, elle couvre tout le stade de motifs blancs une '
      + 'nuit d’hiver. Elle garde toujours sa pelote du premier jour.', 'LE GIVRE TIENT'],
  ],

  MT25: [
    ['Le Couloir des Vents', 'Il siffle maintenant les chants du virage, en retard d’une seconde. Le couloir '
      + 'les renvoie aux tribunes.', 'ÉCOUTEZ LE COULOIR'],
    ['Le Tunnel des Vents', 'Organiste du vent, il joue sur tous les tunnels du stade comme sur les tuyaux '
      + 'd’un grand orgue. Le chant revient de partout.', 'LE STADE RÉPOND'],
  ],

  MT26: [
    ['L’Éclair Lointain', 'Elle part à la chasse à l’orage après les matchs du soir, l’appareil autour du '
      + 'cou. Cette fois, elle l’a eu.', 'CLIC'],
    ['La Lanterne d’Été', 'Elle garde la foudre dans une lanterne et la ressort pour les grands soirs. Le '
      + 'virage s’allume d’un coup.', 'LA FOUDRE EST À NOUS'],
  ],

  MT27: [
    ['La Pelouse Qui Brille', 'Il range chaque goutte de rosée brin par brin, et la pelouse brille en motifs. '
      + 'Les joueurs n’osent plus marcher dessus.', 'PAS SUR LA PELOUSE'],
    ['Le Jardinier de l’Aube', 'Gardien d’un grand jardin où la rosée ne sèche jamais, il garde son arrosoir '
      + 'du premier jour. Le matin, tout le stade sent l’herbe mouillée.', 'LE JARDIN SE LÈVE'],
  ],

  MT28: [
    ['Le Relevé du Lundi', 'Chaque lundi, il affiche le relevé à la buvette, et tout le monde vient voir. '
      + 'Il donne la mesure du chant comme celle de la pluie.', 'RELEVÉ DU LUNDI'],
    ['La Station Météo', 'Gardien d’une station tout en haut de la montagne, il lit le ciel avant tout '
      + 'le monde. Son carnet n’a jamais sauté un match.', 'IL VA PLEUVOIR'],
  ],

  MT29: [
    ['La Tornade Rangée', 'Il a appris à tourner sans rien renverser, et les gobelets retombent en pile. '
      + 'Plus il tourne, plus il va vite.', 'PLUS VITE'],
    ['Le Tourbillon', 'Grand danseur du vent, il tourne si bien qu’on vient de loin pour le regarder. '
      + 'Le virage tape des mains de plus en plus fort.', 'ON NE S’ARRÊTE PAS'],
  ],

  MT30: [
    ['La Mouette du Toit', 'Elle vit sur le toit de la tribune et suit tous les déplacements. Elle arrive '
      + 'toujours avant le car.', 'ELLE NOUS SUIT'],
    ['L’Albatros', 'Vieil albatros capitaine, il a fait le tour des mers et de tous les stades. Il '
      + 'porte encore la miette du sandwich.', 'LE TOUR DU MONDE'],
  ],

  MT31: [
    ['Le Soleil Bas', 'Elle le suit d’un match à l’autre, le bonnet sur les oreilles. Il est bas, il '
      + 'éblouit, et il revient toujours.', 'IL REVIENT'],
    ['Le Soleil de Minuit', 'Voyageuse du grand Nord, elle a vu le soleil qui ne se couche pas. Elle le '
      + 'ramène dans le virage les soirs d’hiver.', 'IL NE SE COUCHE PAS'],
  ],

  MT32: [
    ['Le Chapeau de Paille', 'Il distribue des chapeaux de paille dans tout le rang, et le rang les lève '
      + 'l’un après l’autre. Ça fait une vague dorée.', 'LEVEZ LES CHAPEAUX'],
    ['L’Ombre de Midi', 'Maître des chapeaux de tout le virage, il porte un chapeau immense dont '
      + 'l’ombre marque l’heure. Il garde son bob dessous.', 'LA VAGUE PASSE'],
  ],

  MT33: [
    ['La Patineuse', 'Elle ne glisse plus, elle patine, et elle vise la marche suivante avant de '
      + 'partir. Elle ne la rate jamais.', 'JE VISE'],
    ['La Patinoire', 'Reine de la piste de glace, elle dessine des figures parfaites sous les '
      + 'lumières. Elle a gardé le bonnet de la première glissade.', 'LA FIGURE PARFAITE'],
  ],

  MT34: [
    ['Les Lunettes Embuées', 'Il passe du froid au chaud toute la mi-temps, et il a appris à voir à travers '
      + 'la buée. Le verre l’a pris d’amitié.', 'DEDANS, DEHORS'],
    ['Le Souffleur de Verre', 'Maître du verre soufflé, il fait des merveilles de cristal d’un seul souffle. '
      + 'Ses lunettes, elles, s’embuent toujours.', 'UN SOUFFLE'],
  ],

  MT35: [
    ['Le Ciel Noir', 'Il gronde maintenant avec le virage, au même rythme que les tambours. Les '
      + 'adversaires lèvent les yeux.', 'ÇA VA TONNER'],
    ['Le Tonnerre du Kop', 'Géant des grands tambours, il frappe le tonnerre au-dessus du kop. Quand il '
      + 'gronde, tout le stade tremble.', 'TONNERRE !'],
  ],

  MT36: [
    ['Le Tapis d’Automne', 'Elle et ses sœurs couvrent les gradins d’un tapis roux, feuille par feuille. '
      + 'Vu d’en haut, ça fait un dessin.', 'FEUILLE PAR FEUILLE'],
    ['La Saison', 'Esprit de toute la forêt d’automne, elle porte des bois de feuillage roux. '
      + 'Chaque saison commence quand elle tombe.', 'LA SAISON COMMENCE'],
  ],

  MT37: [
    ['Le Pollen de Printemps', 'Elle a fait la paix avec les fleurs, et elle en sème partout dans la tribune. '
      + 'Le virage fleurit à chaque printemps.', 'À TES SOUHAITS'],
    ['Le Pré Fleuri', 'Couronnée de prairie, elle porte tout un pré fleuri sur les épaules. Elle '
      + 'garde un mouchoir, au cas où.', 'LE PRÉ EST EN FLEUR'],
  ],

  MT38: [
    ['La Gouttière Réparée', 'Elle ne fuit plus, elle joue : deux gouttes, deux notes, l’une après l’autre. '
      + 'Le siège est enfin sec.', 'PLIC ET PLOC'],
    ['La Cascade du Toit', 'Maître des fontaines, il fait danser l’eau du toit en deux grandes cascades '
      + 'qui se répondent. Il garde sa clé à molette à la ceinture.', 'L’EAU CHANTE'],
  ],

  MT39: [
    ['Le Vent d’Autan', 'Elle joue du vent comme d’un instrument, et le rang chante à son signal. Ses '
      + 'cheveux, eux, n’en font qu’à leur tête.', 'À MON SIGNAL'],
    ['Le Vent du Sud', 'Grande joueuse de cornemuse du vent du sud, elle mène tout le virage derrière '
      + 'elle. Ses cheveux en bataille flottent comme un drapeau.', 'SUIVEZ LE VENT'],
  ],

  MT40: [
    ['L’Averse Fraîche', 'Elle tombe à grosses gouttes, au rythme des tambours. Le virage danse dessous.', 'ENCORE !'],
    ['La Mousson', 'Seigneur des grandes pluies, il fait tomber la mousson en cadence. Ses gouttes '
      + 'frappent les toits comme mille tambours.', 'LA GRANDE PLUIE'],
  ],

  MT41: [
    ['Le Ballon Lâché', 'Il part maintenant au compte à rebours, et monte de plus en plus haut. Il '
      + 'revient toujours au stade.', 'TROIS, DEUX, UN'],
    ['La Montgolfière', 'Grande montgolfière d’aéronaute, il emmène le virage au-dessus des nuages. Il '
      + 'a gardé la ficelle du premier ballon.', 'DÉCOLLAGE'],
  ],

  MT42: [
    ['La Brume du Port', 'Elle guide les supporters perdus dans la brume, de quai en quai jusqu’au '
      + 'stade. Sa lampe est devenue lanterne.', 'PAR ICI'],
    ['Le Phare', 'Gardienne du phare qui guide tout le virage, elle balaie la brume de sa grande '
      + 'lumière. Elle porte encore la lampe du premier jour.', 'SUIVEZ LA LUMIÈRE'],
  ],

  MT43: [
    ['La Pleine Lune', 'Pleine et ronde, elle éclaire le virage mieux que les projecteurs. On chante '
      + 'au rythme de sa montée.', 'PLEINE LUNE'],
    ['La Nuit Claire', 'Astronome de la nuit claire, elle compte les étoiles au-dessus du stade. Elle '
      + 'garde son petit croissant du premier soir.', 'LA NUIT EST CLAIRE'],
  ],

  MT44: [
    ['Le Ciel des Déplacements', 'Il connaît par cœur les étoiles de toutes les routes du championnat. Il dit au '
      + 'chauffeur où on est.', 'ON EST LÀ'],
    ['La Carte du Ciel', 'Navigateur aux étoiles, il tient la carte du ciel de tous les retours. Il n’a '
      + 'jamais oublié la première étoile vue du car.', 'JE CONNAIS LA ROUTE'],
  ],

  MT45: [
    ['Le Lever du Jour', 'Elle réveille tout le car au premier rayon, et elle donne le rythme du retour. '
      + 'Le soleil se lève à son signal.', 'DEBOUT !'],
    ['Le Retour à l’Aube', 'Messagère de l’aube, elle porte le soleil levant entre ses mains. Elle a '
      + 'toujours l’œil un peu fatigué du premier matin.', 'LE JOUR SE LÈVE'],
  ],

  MT46: [
    ['Le Déblayeur', 'Il déblaie plus vite qu’il ne neige, à grands coups de pelle. Les portes '
      + 'ouvrent à l’heure.', 'ON DÉGAGE'],
    ['Le Chasse-Neige', 'Géant chasse-neige, il ouvre la route du stade à travers les congères. Il '
      + 'garde sa vieille pelle sur le dos.', 'LA ROUTE EST OUVERTE'],
  ],

  MT47: [
    ['Le Rhume du Dimanche', 'Elle arrive avec un thermos de bouillon pour tout le rang. Elle tousse, elle '
      + 'chante, elle reste.', 'UN BOUILLON ?'],
    ['Le Grand Bouillon', 'Cuisinière de la grande soupe d’hiver du virage, elle tourne une marmite '
      + 'géante. Elle garde son mouchoir dans la poche du tablier.', 'À LA SOUPE'],
  ],

  MT48: [
    ['La Crème Solaire', 'Il distribue la crème dans tout le rang, et il lance les tubes d’un bout à '
      + 'l’autre. Lui reste rouge.', 'ATTRAPE !'],
    ['Le Marchand de Glaces', 'Géant au chariot de glaces, il lance les boules dans les cornets, une par une, '
      + 'sans jamais en rater. Il a toujours le nez rouge.', 'UNE BOULE, DEUX BOULES'],
  ],

  MT49: [
    ['Le Ciel de Papier', 'Il lance les confettis par grandes rafales, à chaque but. Le ciel du virage '
      + 'devient de papier.', 'RAFALE !'],
    ['La Tempête de Fête', 'Artificier de papier, il tire des fusées de confettis en salves au-dessus du '
      + 'stade. Il en garde toujours un dans les cheveux.', 'FEU D’ARTIFICE'],
  ],

  MT50: [
    ['Le Calme Après l’Orage', 'Elle attend que l’orage passe sans un mot, et tout le rang attend avec elle. '
      + 'Puis elle se lève.', 'ATTENDEZ'],
    ['Le Ciel Lavé', 'Gardienne du ciel bleu, elle veille sur le calme qui revient après la tempête. '
      + 'Elle tient encore son parapluie fermé.', 'LE CIEL EST BLEU'],
  ],

  /* ================================================== LES HÉROS DU CANAPÉ

     Ceux qui ne sont pas au stade, et qui en parlent le plus fort. La série se
     moquerait d'eux facilement, et le jeu n'y gagnerait rien.

     Leur progression est **une descente du volume**. L'expert efface moins,
     le troll garde un seul club, le commentateur du salon baisse le son — et
     ce qu'ils gagnent en se taisant, c'est quelqu'un à qui parler. Le Footix
     finit vieux du rang 7, et il ne se moque jamais de celui qui arrive.    */

  HC1: [
    ['Celui Qui N’Efface Plus', 'Il laisse ses mauvais pronostics en ligne, maintenant. Ses chiffres '
      + 'ont baissé et il dort mieux.', 'JE M’ÉTAIS TROMPÉ'],
    ['L’Analyste du Club', 'Il fait les retours vidéo des équipes de jeunes, gratuitement, le mardi '
      + 'soir. Il n’a plus de compte. Il n’avait jamais eu autant à dire.', 'REGARDE CE DÉCALAGE'],
  ],
  HC2: [
    ['Celui Qui a Choisi', 'Il n’en a gardé qu’un, des six. Celui qui perdait le plus. Il ne sait '
      + 'pas expliquer pourquoi.', 'CELUI-LÀ'],
    ['L’Abonné du Mercredi', 'Il commente toujours après le coup de sifflet, mais depuis la tribune, '
      + 'et seulement pour dire que c’était pas si mal.', 'C’ÉTAIT PAS SI MAL'],
  ],
  HC3: [
    ['Celui Qui a Pris un Abonnement', 'Il connaît les onze noms, maintenant, et deux chants sur '
      + 'trois. Il a payé le déplacement le plus long de la saison, en janvier, pour un 0-3.',
      'JE CONNAIS'],
    ['Le Vieux du Rang 7', 'Personne ne se rappelle qu’il a commencé après une coupe. Lui s’en '
      + 'souvient très bien, et il ne se moque jamais de celui qui arrive.', 'TU VIENS D’OÙ ?'],
  ],
  HC4: [
    ['Celui Qui Baisse le Son', 'Il a coupé la télé et gardé la radio. Il double toujours, mais il a '
      + 'cessé d’être en avance.', 'IL VA TIRER, LÀ'],
    ['La Voix du Salon', 'Il commente pour son père, qui ne voit plus l’écran. Il est légèrement en '
      + 'avance, exprès, pour lui laisser le temps de se lever.', 'IL VA TIRER, PAPA'],
  ],
  HC5: [
    ['Le Débat de Mardi', 'Quatorze angles, six jours, et toujours pas d’accord. Deux camps se sont '
      + 'formés et ils se parlent encore.', 'REGARDE DE LÀ'],
    ['L’Action de la Saison', 'Personne n’a tranché. C’est devenu un point de repère : on dit « avant '
      + 'l’action » et « après l’action », et tout le monde sait.', 'ON SAURA JAMAIS'],
  ],
  HC6: [
    ['Les Trente Secondes', 'Il a compris qu’il vivait chaque but deux fois : par le cri du voisin, '
      + 'puis par l’image. Il a arrêté de s’en plaindre.', 'JE L’AI ENTENDU D’ABORD'],
    ['Le Mur Mitoyen', 'Ils ne se sont jamais rencontrés. Il connaît la voix de son voisin mieux que '
      + 'celle du commentateur, et il tape au mur pour répondre.', 'J’AI TAPÉ AU MUR'],
  ],
  HC7: [
    ['L’Oncle en Majuscules', 'Trente-huit messages sur quarante, et personne ne lui a jamais '
      + 'expliqué la touche. Personne ne le fera.', 'IL ÉCRIT FORT'],
    ['Le Groupe Qui Se Déplace', 'Quatorze ans de messages, et un premier déplacement à douze, en '
      + 'car, l’an dernier. L’oncle a payé les places et n’a rien écrit ce jour-là.',
      'ON Y VA ENSEMBLE'],
  ],
  HC8: [
    ['Celui Qui a Parié le Dimanche', 'Il a annoncé avant, une fois, devant témoins. Il s’est '
      + 'trompé. Il l’a raconté lui-même toute la semaine.', 'J’AI DIT AVANT'],
    ['Le Bulletin du Vendredi', 'Il publie ses pronostics le vendredi, signés, avec son taux de '
      + 'réussite en bas de page. Il est mauvais et il est lu par trois cents personnes.',
      'C’EST ÉCRIT'],
  ],
  HC9: [
    ['Celui Qui S’Est Tu', 'Il avait l’attaquant adverse dans son équipe et il n’a rien dit. Il a '
      + 'même hué un peu, pour la forme. Ça lui a coûté douze points.', 'RIEN DIT'],
    ['Le Sélectionneur du Virage', 'Il a monté la ligue du groupe, quarante équipes, et il s’interdit '
      + 'les joueurs adverses. Il finit dernier chaque saison, exprès.', 'PAS D’ADVERSAIRES'],
  ],
  TR60: [
    ['Le Traducteur Rattrapé', 'Il a arrêté d’expliquer et il chante avec eux. Les nouveaux apprennent en trois '
      + 'matchs au lieu de trois saisons, et personne n’a compris pourquoi.',
      'CHANTE, TU VERRAS'],
    ['Le Livret', 'Il a imprimé les paroles, vingt pages agrafées, distribuées à l’entrée. Le club '
      + 'les réimprime chaque année et son nom n’est écrit nulle part dessus.',
      'C’EST ÉCRIT DEDANS'],
  ],
  TR61: [
    ['Le Prénom Repris', 'Trois rangées crient le prénom avec lui. Le joueur lève la main sans se retourner, '
      + 'et c’est devenu le signe qu’il a entendu.',
      'AVEC MOI : MARCO'],
    ['Celui Qu’ils Connaissent', 'Deux joueurs lui disent bonjour avant l’échauffement. Il ne leur a jamais parlé '
      + 'ailleurs qu’en criant, et il ne compte pas commencer.',
      'IL M’A VU'],
  ],
  TR62: [
    ['Les Deux Sièges', 'Il a trouvé que le siège d’à côté sonne plus grave. Il joue les deux, une main '
      + 'chacun, et le rang entier suit sans savoir qu’il suit.',
      'GRAVE ET AIGU'],
    ['La Rangée Entière', 'Onze sièges vides, onze notes. Le club a renoncé à les remplacer et il a fini par '
      + 'les numéroter à la craie.',
      'ONZE SIÈGES'],
  ],
  TR63: [
    ['Les Mains Rouges', 'Elle a arrêté d’avoir froid il y a deux hivers et elle continue. C’est devenu le '
      + 'moment où le virage sait qu’il reste vingt minutes.',
      'ENCORE DIX'],
    ['Le Quart d’Heure', 'Le virage applaudit à sa place quand elle n’est pas là. Elle l’a appris en '
      + 'revenant après trois mois, et elle n’a rien dit.',
      'ILS L’ONT FAIT SANS MOI'],
  ],
  TR64: [
    ['Le Parapluie Plié', 'Il l’a réparé avec du gaffer et il ne l’ouvre plus. Il le tient fermé, en l’air, '
      + 'et tout le monde a compris ce que ça veut dire.',
      'JE LE GARDE'],
    ['Le Mât', 'Ce n’est plus un parapluie : c’est une hampe de deux mètres avec les couleurs au '
      + 'bout. Les armatures sont d’origine et il le précise toujours.',
      'IL A TENU VINGT ANS'],
  ],
  TR65: [
    ['Le Carnet', 'Il note maintenant, parce que de tête il perdait le fil à la quatre-vingtième. '
      + 'Trois saisons de passes, colonne par colonne, et aucune raison.',
      'C’EST NOTÉ'],
    ['La Statistique', 'Le club lui demande ses chiffres avant la presse. Il les donne, il ne les commente '
      + 'jamais, et il refuse qu’on mette son nom dessus.',
      'DEMANDEZ-MOI'],
  ],
  TR66: [
    ['Le Drap Repeint', 'Deux couches de plus et les poissons ont disparu. Il regrette un peu, et il a '
      + 'gardé une photo d’avant dans sa poche.',
      'ON NE LES VOIT PLUS'],
    ['La Bâche Cousue', 'Six draps assemblés couvrent la moitié du virage. Elle sort deux fois par saison '
      + 'et il faut onze personnes pour la tenir.',
      'À SIX MAINS'],
  ],
  TR67: [
    ['La Torche Sèche', 'Il les garde au chaud sous sa veste depuis un derby raté. Elle part à tous les '
      + 'coups et le virage a perdu quelque chose en route.',
      'CETTE FOIS, SÛR'],
    ['Le Départ du Feu', 'C’est lui qui donne le signal aux douze autres torches. Il attend toujours une '
      + 'seconde de trop, exprès, parce que le silence d’avant vaut le feu.',
      'MAINTENANT, TOUS'],
  ],
  TR68: [
    ['L’Écharpe Nouée Court', 'Il a fait trois tours de cou et elle ne balaie plus personne. Deux rangées ont dit '
      + 'que c’était dommage.',
      'JE LA RACCOURCIS'],
    ['Les Trois Mètres Quarante', 'Sa tante est morte en février et il l’a redéployée entière. Le rang se penche pour '
      + 'la laisser passer, tous les samedis, sans qu’il ait rien demandé.',
      'ELLE ÉTAIT À ELLE'],
  ],

  /* ========================================================== LES TERRACES

     Le foot anglais vu des gradins debout (`dex-terraces.js`). Chaque lignée
     monte dans un vieux métier ou une vieille tradition de son coin — la
     garde de la forteresse, la péniche, la promenade, l'enseigne, la
     confiserie, la grande rue punk, le grand-bi, les dinosaures de plâtre du
     parc, la danse aux grelots, le parapluie du gentleman, les filets du
     port, le moulin, le cricket du village, la course de haies, le laitier
     de l'aube, la boxe d'antan, les échecs du parc, le hors-la-loi des
     ballades, le salon du barbier, les rois de nacre des marchés, le bus à
     impériale, les émaux des bijoutiers, le ballon captif de la falaise, la
     pompe à vapeur du fleuve, le tram du bord de mer, le bal masqué des
     artistes, les horlogers de la ville, le feu d'artifice du parc, les
     réverbères au gaz, les fouilleurs de vase du fleuve, la foire d'automne,
     les tertres du comté, la faïence ajourée, les caves de la musique beat,
     les premières machines à calculer, les filatures de coton, la petite
     cornemuse du Nord, les grottes de grès sous la ville, les verreries du
     fleuve, les cerfs-volants de la colline ; puis, pour les créatures, la
     boîte aux lettres de fonte, les plumes d'acier des ateliers, les
     écureuils roux de l'île, les perruches de l'ouest de la ville, la plage
     de galets, la porcelaine des manufactures, les mystères joués sur des
     chariots, la première exposition féline du parc, les phoques gris de
     l'estuaire, les anguilles qui remontent le fleuve, les cabines
     téléphoniques crème du port, les loutres revenues dans la rivière, la
     rhubarbe forcée des remises obscures, le ragoût des marins, la tarte de
     la cantine, le terrier des filatures, les macareux des îles, les oies
     de la grande foire, le ver de la vieille légende, les pigeons voyageurs
     des colombiers — et le troisième âge en devient la figure, jusqu'à
     porter le décor sur lui.
     **Il garde toujours un détail du premier** : le sachet de miettes, le
     bonnet, le mouchoir noué, le petit pinceau, la dent qui manque, le
     baladeur à cassettes, la sonnette de laiton, les lunettes rondes, le
     mouchoir blanc, la moustache, le petit filet noir, la farine sur la
     joue, la casquette bleue, le cheval-bâton, la casquette plate, la
     moustache cirée, le petit pion blanc, la plume blanche, la fine
     moustache du salon, les boutons de nacre, les baskets rouges, la bague
     de fer-blanc, les baskets blanches, le foulard noué, les tongs, les
     mocassins éraflés, les lunettes cerclées de fer, le bonnet à pompon, la
     vieille casquette plate, les bottes de caoutchouc noires, le jeton de
     laiton, les chaussures de marche boueuses, le crayon dans le chignon, le
     petit micro rouge, les lunettes d'écaille, le foulard de coton rouge, la
     mèche blanche, les vieilles chaussures éraflées, d'autres baskets
     rouges, le bandeau bleu marine, la carte postale dans la fente, la tache
     d'encre bordeaux, la noisette derrière l'oreille, le bonnet à pompon, le
     coquillage sur le bord du seau, la fêlure du couvercle, la petite
     lanterne sous le toit, le peigne dans la queue, les grains de sable sur
     le nez, le galet du fleuve, la vitre fêlée, le galet plat au sommet de
     la pile, la petite feuille tombante, la bosse sur le flanc, le petit
     trou dans la noix de coco, l'oreille rabattue, le flotteur blanc cerclé
     de noir, les petits chaussons de toile, la goutte d'eau de rivière, les
     quelques plumes dressées. C'est la règle de ce fichier, et la fiche
     de chaque dessin la suit aussi.

     Rien ici ne nomme un club, un stade, un joueur ni un chant : voir l'en-tête
     de `dex-terraces.js`.                                                    */

  AN1: [
    ['Le Garde Écarlate', 'Il a troqué le manteau pour la tunique et il veille maintenant sur toute '
      + 'la volée. On dit que la forteresse tombera le jour où les corbeaux partiront : il ne manque '
      + 'plus un match à domicile, au cas où.', 'PERSONNE NE S’ENVOLE'],
    ['Le Maître des Corbeaux', 'Cinq corbeaux sur les épaules, et toute la nuée qui l’écoute. Il garde '
      + 'un sachet de miettes dans la poche, pour le gamin qui viendra visiter un jour sans match.',
      'TANT QU’ILS RESTENT'],
  ],
  AN2: [
    ['Le Batelier des Roses', 'Son bateau est peint de roses et de châteaux, et c’est lui qui emmène '
      + 'le déplacement par les canaux. Il arrive à la mi-temps, toujours, et personne n’a jamais '
      + 'voulu prendre le car à sa place.', 'PAR LE CANAL'],
    ['Le Capitaine du Long Bateau', 'Il porte la cabine comme une armure, et la cheminée fume derrière '
      + 'son épaule. Quand il accoste devant le stade, tout le quai se lève — et il a gardé le bonnet '
      + 'du gamin de l’écluse.', 'PERSONNE NE NOUS DOUBLE'],
  ],
  AN3: [
    ['Le Roi de la Promenade', 'Canotier, veste rayée, cloche de cuivre : toute la promenade marche à '
      + 'sa voix. Les jours de match, il donne le refrain à ceux qui montent au stade, et ils l’ont '
      + 'encore en arrivant.', 'TOUTE LA PROMENADE'],
    ['La Jetée Vivante', 'Il porte le pavillon de la jetée sur les épaules, ampoules allumées, et des '
      + 'cabines de bain aux bras. Quand il entonne, la mer prend la mesure. Le mouchoir est toujours '
      + 'noué sur sa tête.', 'LA MER SUIT'],
  ],
  AN4: [
    ['Le Peintre d’Enseignes', 'Il repeint à la main les enseignes du quartier, une couronne après '
      + 'l’autre. Les soirs de match, il peint la même sur une bâche, et la tribune la lève à son '
      + 'signal.', 'ENCORE UNE COUCHE'],
    ['Le Maître des Quatre Coins', 'Quatre enseignes tournent autour de lui — une couronne, un navire, '
      + 'une cloche, une ancre —, et pas une lettre sur aucune. Le petit pinceau est toujours derrière '
      + 'son oreille.', 'AUX QUATRE COINS'],
  ],
  AN5: [
    ['La Confiseuse du Front de Mer', 'Elle tire le sucre bouillant au chaudron de cuivre, dans une '
      + 'boutique face aux vagues. Les jours de match, elle donne les bâtons cassés à la tribune, qui '
      + 'les lance au bon moment.', 'TOUT CHAUD, TOUT RAYÉ'],
    ['La Reine des Bâtons de Sucre', 'Couronne de sucre, cape de sucre filé, une cartouchière de bâtons '
      + 'à la ceinture. Elle vise juste au coup de sifflet, et elle sourit toujours avec la dent qui '
      + 'manque.', 'SERVEZ-VOUS'],
  ],
  AN6: [
    ['La Punk à Épingles', 'Le blouson, elle le porte maintenant, couvert de clous et d’épingles à '
      + 'nourrice. Elle tape des bottes sur les marches au rythme de sa cassette, et toute la travée '
      + 'finit par taper avec elle.', 'TAPEZ DES PIEDS'],
    ['La Reine du Grand Boulevard', 'Crête bleue, épaulettes cloutées, des épingles grandes comme des '
      + 'sabres. Quand ses semelles frappent le béton, la tribune tremble — et le petit baladeur pend '
      + 'toujours à son cou.', 'TOUT LE BOULEVARD'],
  ],
  AN7: [
    ['La Championne du Grand-Bi', 'Perchée sur sa roue géante, elle boucle les tours de piste en '
      + 'maillot de laine rayé. Les jours de déplacement, elle part la veille à la force des mollets, '
      + 'et elle arrive avant le car.', 'PLACE AU GRAND-BI'],
    ['La Reine du Vélodrome', 'Une armure de cadres et de rayons, une roue lumineuse dans le dos, un '
      + 'casque à ailettes. Elle mène le cortège jusqu’au stade d’en face — et la petite sonnette de '
      + 'laiton tinte toujours à son poignet.', 'DRING, ON ARRIVE'],
  ],
  AN8: [
    ['Le Sculpteur de Monstres', 'Blouse tachée de plâtre, haut-de-forme, maillet à la ceinture : il '
      + 'sculpte des têtes de monstres comme au temps des crinolines. Il en peint une par match, et la '
      + 'tribune la fait passer de main en main, d’un bout à l’autre.', 'FAITES-LA PASSER'],
    ['L’Iguanodon de Plâtre', 'Il porte maintenant le monstre entier, cornes, griffes et rayures '
      + 'peintes, le plâtre craquelé aux coutures. Quand il se dresse, la tribune se lève derrière lui '
      + 'comme une échine — et les lunettes rondes n’ont jamais quitté son nez.', 'TOUTE L’ÉCHINE'],
  ],
  AN9: [
    ['La Danseuse de Mai', 'Chapeau de paille fleuri, rubans bleus et blancs, baudriers couverts de '
      + 'grelots de laiton. Elle frappe le sol du bâton, lentement d’abord, puis de plus en plus vite, '
      + 'et toute la travée prend la cadence.', 'PLUS VITE, PLUS VITE'],
    ['La Reine des Grelots', 'Des centaines de grelots en armure, une coiffe de rubans, un bâton '
      + 'couronné de clochettes. Quand elle danse, la tribune sonne jusqu’à l’estuaire — et le mouchoir '
      + 'blanc dépasse toujours de sa ceinture.', 'QUE TOUT SONNE'],
  ],
  AN10: [
    ['Le Gentleman du Fleuve', 'Redingote noire à liseré blanc, gants blancs, montre de gousset : il '
      + 'regarde passer les avirons sur le fleuve, son parapluie ouvert sur l’épaule. Il ne le referme '
      + 'jamais avant le coup de sifflet final.', 'TENEZ BON, MESSIEURS'],
    ['Le Grand Parapluie', 'Son parapluie abrite maintenant tout le virage, et les gouttes s’allument '
      + 'au bout des baleines. Il reste droit sous l’averse, sans un pli — et la moustache blanche est '
      + 'toujours impeccable.', 'TOUT LE MONDE À L’ABRI'],
  ],
  AN11: [
    ['La Matelote des Filets', 'Ciré ambre, lanterne de laiton à la ceinture, un filet noir jeté sur '
      + 'les épaules avec ses flotteurs de verre. Par gros temps, elle lance le filet d’un seul geste, '
      + 'pile quand la vague retombe.', 'À LA VAGUE, ON JETTE'],
    ['La Reine du Grand Chalut', 'Le grand chalut lui fait un manteau, ses flotteurs de verre luisent '
      + 'comme des fanaux, et l’aiguille de ramendeuse est devenue un sceptre. Elle tient toute la '
      + 'tribune dans ses mailles — et le petit filet noir pend toujours à son bras.',
      'TOUT LE MONDE DANS LE FILET'],
  ],
  AN12: [
    ['La Meunière', 'Tablier blanc de farine, casquette bleue, un sac sur l’épaule et un petit moulin '
      + 'de bois sur le dos dont les ailes tournent toutes seules. Elle moud son grain au lever du '
      + 'jour, et le soir elle déploie ses ailes au-dessus du virage.', 'LES AILES AU VENT'],
    ['Le Moulin Qui Marche', 'Elle porte maintenant le moulin entier, un toit bleu pour casque, quatre '
      + 'grandes ailes dressées dans le dos et une meule pour boucle de ceinture. Quand elle avance, '
      + 'toute la tribune tourne avec elle — et la farine n’a jamais quitté sa joue.',
      'QUE TOUT TOURNE'],
  ],
  AN13: [
    ['Le Batteur du Dimanche', 'Tout en blanc, deux jambières sanglées de bleu et de jaune, la batte '
      + 'polie posée sur l’épaule. Il ne frappe pas tout : il laisse passer les mauvaises balles et il '
      + 'attend la bonne, un après-midi entier s’il le faut.', 'ON LAISSE PASSER'],
    ['Le Grand Capitaine du Comté', 'Une armure de jambières blanches aux coutures lumineuses, une cape '
      + 'de laine torsadée, une batte aussi grande que lui. Il mène tout le comté sans hausser le ton '
      + '— et la casquette bleue du gamin est restée dans son casque.', 'TENEZ LE GUICHET'],
  ],
  AN14: [
    ['Le Jockey des Haies', 'Casaque rouge à manches bouffantes, bombe à pompon blanc, et le '
      + 'cheval-bâton devenu une grande tête rembourrée au bout d’une perche. Il se balance d’avant en '
      + 'arrière avant chaque obstacle, et il le franchit toujours en tête.', 'EN AVANT, PAR-DESSUS'],
    ['Le Cheval de Pantomime', 'Il porte maintenant le cheval tout entier : une tête de tissu rouge, '
      + 'une crinière blanche en cape, des fers à cheval sur les bottes. Il fait le tour du terrain au '
      + 'galop sous les rires — et le petit cheval-bâton ne le quitte jamais.', 'TOUT LE MONDE AU GALOP'],
  ],
  AN15: [
    ['Le Laitier de l’Aube', 'Long manteau blanc à boutons bleu ciel, casquette à visière, une grande '
      + 'caisse de bouteilles lumineuses sur l’épaule. Il annonce chaque rue d’un cri, toujours à la '
      + 'même cadence, et les fenêtres s’allument une à une derrière lui.', 'C’EST L’HEURE DU LAIT'],
    ['Le Grand Chariot de Lait', 'Il porte maintenant toute la voiture de livraison : un toit sur la '
      + 'tête, des phares ronds sur la poitrine, des casiers de bouteilles aux épaules et de petites '
      + 'roues aux bottes. Il ouvre la marche sous l’averse — et la casquette plate est toujours là, '
      + 'sous le toit.', 'TOUT LE MONDE EN TOURNÉE'],
  ],
  AN16: [
    ['Le Boxeur de Foire', 'Culotte longue rayée rouge et noir, bretelles noires, serviette blanche '
      + 'au cou et la moustache cirée en crocs. Sous la tente de la foire, il affronte qui veut, '
      + 'trois rounds à la loyale, et il serre toujours la main d’abord.', 'À LA LOYALE'],
    ['Le Champion des Règles', 'Une ceinture de champion large comme un bouclier, un long peignoir '
      + 'rouge et noir, des gants qui brillent de l’intérieur. Il n’a jamais frappé sous la '
      + 'ceinture ni après la cloche — et la moustache est toujours cirée.', 'SELON LES RÈGLES'],
  ],
  AN17: [
    ['Le Joueur du Parc', 'Long manteau noir, casquette plate, une pendule d’échecs en bois à la '
      + 'ceinture et un grand cavalier blanc sous le bras. Il joue contre tout le parc à la fois, '
      + 'et il ne laisse jamais tomber son drapeau.', 'LA PENDULE TOURNE'],
    ['Le Roi Noir et Blanc', 'Une armure en damier aux cases lumineuses, une cape pliée comme un '
      + 'échiquier, une couronne de roi d’échecs et une grande pièce de roi pour sceptre. Il ne '
      + 'bouge que d’une case à la fois, et personne ne le met en échec — le petit pion blanc pend '
      + 'toujours à sa ceinture.', 'ÉCHEC ET MAT'],
  ],
  AN18: [
    ['L’Archer des Fanions', 'Longue tunique rouge bordée de blanc, pourpoint de cuir, un grand arc '
      + 'dans le dos et un carquois de flèches qui finissent en petits fanions rouges et blancs, '
      + 'jamais en pointe. Il tire par-dessus la tribune et ses fanions retombent en pluie.',
      'LES FANIONS EN L’AIR'],
    ['Le Hors-la-Loi Écarlate', 'Une armure de cuir rouge aux coutures lumineuses, un haut '
      + 'capuchon, un arc immense dressé dans le dos et un carquois plein de longs fanions. Il '
      + 'sonne du cor avant chaque volée et toute la tribune lève les bras — la plume blanche n’a '
      + 'jamais quitté son capuchon.', 'TOUT LE CIEL EN ROUGE'],
  ],
  AN19: [
    ['Le Barbier à l’Enseigne', 'Gilet rayé rouge et blanc sur la blouse blanche, nœud papillon '
      + 'noir, un blaireau et un peigne dans la poche, et l’enseigne rayée qui tourne en lumière '
      + 'sur son épaule. Au salon, il lance la chanson et tous les fauteuils la reprennent.',
      'À QUATRE VOIX'],
    ['Le Maître Barbier', 'Une armure blanche et rouge taillée comme un fauteuil de barbier, '
      + 'leviers chromés et coussins de cuir, une grande enseigne rayée qui tourne dans son dos et '
      + 'un blaireau géant pour sceptre. Il chante, et tout le salon chante derrière lui — la '
      + 'moustache cirée est parfaite.', 'TOUT LE SALON CHANTE'],
  ],
  AN20: [
    ['Le Prince des Boutons', 'Le costume marine est maintenant couvert de motifs de nacre — '
      + 'étoiles, fers à cheval, fleurs —, la casquette entièrement boutonnée, une tirelire de '
      + 'quête à la ceinture. Au marché, chacun lui donne un bouton, et il le coud à sa place.',
      'QUE ÇA BRILLE'],
    ['Le Roi Nacré', 'Des milliers de boutons de nacre lumineux en grandes spirales, une haute '
      + 'coiffe boutonnée couronnée de plumes blanches, une longue cape marine et un bouclier en '
      + 'forme de bouton géant. Quand il lève le bras, toute la tribune scintille — et les premiers '
      + 'boutons de la casquette sont toujours sur sa coiffe.', 'TOUS EN NACRE'],
  ],
  AN21: [
    ['La Receveuse de l’Impériale', 'Veste rouge à liseré blanc, casquette à bande blanche, '
      + 'sacoche de cuir à la hanche et la machine à tickets rouge qui brille sur sa poitrine. '
      + 'Elle tire le cordon de la cloche, et tout l’étage du haut repart en chantant.',
      'DING DING, ON REPART'],
    ['La Reine de la Ligne', 'Un long manteau rouge aux épaulettes en forme de toit d’autobus, '
      + 'une rangée de petites fenêtres lumineuses à l’ourlet, une écharpe de tickets qui '
      + 'brillent et une grosse cloche de laiton à la hanche. Quand elle sonne, toute la ligne '
      + 'chante avec elle — et les baskets rouges sont toujours à ses pieds.',
      'TOUTE LA LIGNE CHANTE'],
  ],
  AN22: [
    ['La Sertisseuse d’Émail', 'Long tablier de cuir bordeaux, loupe vissée sur l’œil, un '
      + 'plateau de broches bordeaux et bleu ciel en bandoulière et une fine pince d’argent à la '
      + 'main. Elle pose chaque goutte d’émail à sa place, et la broche s’allume.',
      'UNE GOUTTE, PAS DEUX'],
    ['La Reine des Émaux', 'Une armure de plaques d’émail bordeaux et bleu ciel serties '
      + 'd’argent, qui brillent comme un vitrail, un haut diadème et une longue cape bordée de '
      + 'petits carreaux. Elle vise à travers sa grande loupe et toute la tribune s’allume d’un '
      + 'coup — la bague de fer-blanc est toujours à son doigt.', 'TOUT S’ALLUME'],
  ],
  AN23: [
    ['L’Aéronaute de la Falaise', 'Blouson d’aviateur au col de mouton, lunettes de laiton sur '
      + 'le front, une corde et un altimètre à la ceinture, et la grande enveloppe rayée rouge et '
      + 'noir sur son dos. Elle compte les secondes avant de lâcher les amarres, jamais une de '
      + 'trop.', 'LARGUEZ LES AMARRES'],
    ['La Reine du Grand Ballon', 'Une nacelle d’osier pour armure, un grand ballon rayé rouge et '
      + 'noir qui s’allume derrière sa tête et un brûleur de laiton qui rougeoie à l’épaule. Elle '
      + 'compte à rebours et toute la tribune s’envole avec elle — les baskets blanches sont '
      + 'toujours à ses pieds.', 'TOUT LE MONDE DÉCOLLE'],
  ],
  AN24: [
    ['La Chauffeuse de la Grande Pompe', 'Bleu de chauffe noir aux poignets rouges, gros gants de '
      + 'cuir, un manomètre de laiton à la ceinture et une pelle de charbon sur l’épaule. Elle '
      + 'charge le foyer d’une main, frappe la cadence de l’autre, et la grande pompe repart.',
      'PLEINE PRESSION'],
    ['La Machine à Vapeur Vivante', 'Des épaules de fer rouge et blanc rivetées de laiton, un '
      + 'grand balancier qui bascule au-dessus d’elle, des pistons pour avant-bras et des '
      + 'manomètres lumineux sur la poitrine. Ses deux pistons frappent l’un après l’autre et '
      + 'toute la tribune bat avec — le foulard noué est toujours sur sa tête.',
      'TOUTE LA VAPEUR'],
  ],
  AN25: [
    ['Le Conducteur du Train des Vagues', 'Veste de chemin de fer bleu marine à liseré blanc et '
      + 'boutons de laiton, casquette bleue, une cloche à la ceinture et des fanions de signal '
      + 'sous le bras. Il conduit le petit train du front de mer et n’oublie jamais un arrêt, ni '
      + 'un visage.', 'EN VOITURE !'],
    ['Le Train sur Échasses', 'Ses jambes sont devenues de hautes échasses de fer à petites '
      + 'roues, son torse une plate-forme de tramway à rambarde blanche, un auvent rayé au-dessus '
      + 'de la tête. Il traverse les vagues sans jamais se tromper de route — et les tongs sont '
      + 'toujours à ses pieds.', 'À TRAVERS LES VAGUES'],
  ],
  AN26: [
    ['Le Costumier du Bal des Arts', 'Queue-de-pie de velours bleu roi à revers de satin blanc, '
      + 'jabot blanc, mètre ruban autour du cou et pelote d’épingles au poignet. Il habille tout '
      + 'le bal à la main, et son masque de soie bleu roi à plumes blanches se lève le premier.',
      'QUE LE BAL COMMENCE'],
    ['Le Roi du Bal Masqué', 'Un manteau de brocart bleu roi brodé de volutes blanches qui '
      + 'brillent, de larges épaulettes de satin blanc, une haute couronne de plumes blanches et '
      + 'de rubans bleus, et le grand masque bleu roi au bout d’un long bâton, qui s’allume de '
      + 'l’intérieur. Quand il le lève, toute la tribune se masque d’un bout à l’autre — et les '
      + 'mocassins éraflés sont toujours à ses pieds.', 'TOUS AU BAL'],
  ],
  AN27: [
    ['L’Horloger de la Ville', 'Longue blouse de travail bleu ciel à passepoil blanc, loupe sur '
      + 'un bandeau, trousse d’outils de cuir à la ceinture et des rouages épinglés en rangs sur '
      + 'la poitrine. Sa montre au cadran bleu ciel pend à une lourde chaîne, et toute la ville se '
      + 'règle sur elle.', 'À L’HEURE PILE'],
    ['Le Grand Rouage', 'Une armure de rouages de laiton et d’émail bleu ciel qui tournent '
      + 'lentement en brillant, un grand cadran sans chiffres sur la poitrine, une crête de '
      + 'ressorts au-dessus des épaules et la montre géante tenue comme un bouclier. Tous ses '
      + 'rouages battent entre les temps, et la tribune avec — les petites lunettes rondes sont '
      + 'toujours sur son nez.', 'TOUT TOURNE ENSEMBLE'],
  ],
  AN28: [
    ['L’Artificière du Parc', 'Long manteau de toile bleue à pièces rouges, aux poches pleines '
      + 'de tubes rayés, gros gants de cuir, lunettes de protection sur le front et une longue '
      + 'lance de laiton à la main. La grande fusée rayée rouge et bleu sur son dos crépite de '
      + 'plus en plus vite avant de partir.', 'MÈCHE ALLUMÉE'],
    ['La Reine du Bouquet Final', 'Une armure de tubes de feu d’artifice rayés rouge et bleu, une '
      + 'haute couronne de petites fusées aux pointes lumineuses, une longue cape bleue doublée '
      + 'd’étoiles rouges et la fusée géante tenue comme un sceptre. Elle lance le bouquet final '
      + 'de plus en plus vite, et toute la tribune s’allume avec — le bonnet rouge à pompon est '
      + 'toujours sur sa tête.', 'LE BOUQUET FINAL'],
  ],
  AN29: [
    ['L’Allumeur de Réverbères', 'Long pardessus de laine bleue à boutons blancs, une petite '
      + 'échelle sur le dos, une lanterne de laiton à la ceinture et la perche bleue au crochet de '
      + 'laiton qui brille. Il fait sa tournée chaque soir, par tous les temps, et pas un '
      + 'réverbère ne reste éteint.', 'PAS UN DANS LE NOIR'],
    ['Le Gardien des Lumières', 'Un long manteau bleu aux épaules en globes de vieux réverbères '
      + 'qui brillent d’un blanc chaud, une crête de petits verres de lampe au-dessus de la tête, '
      + 'une cape de nuit bleue piquée de fenêtres allumées et la perche géante dressée, sa '
      + 'flamme bien haute. Il tient la lumière toute la nuit, et toute la colline avec — la '
      + 'casquette plate est toujours sur sa tête.', 'TOUTE LA COLLINE BRILLE'],
  ],
  AN30: [
    ['La Chercheuse de la Grève', 'Long manteau ciré noir à surpiqûres blanches, gros gants de '
      + 'caoutchouc, une truelle et un tamis à la ceinture, de petits trésors épinglés en rangs '
      + 'sur le manteau et le seau blanc plein de trouvailles qui brillent. Elle descend avec la '
      + 'marée, et remonte avec elle.', 'À MARÉE BASSE'],
    ['La Reine des Trésors de Vase', 'Un long manteau noir et blanc cuirassé de centaines de '
      + 'trouvailles qui brillent — pipes en terre, vieux boutons, tessons, clés, petites '
      + 'bouteilles — cousues en volutes, une haute couronne de pipes blanches et de galets, une '
      + 'cape de soie gris vase et le grand seau blanc qui luit à sa hanche. Le fleuve lui rend '
      + 'tout ce qu’il a pris — et les bottes de caoutchouc noires sont toujours à ses pieds.',
      'LE FLEUVE REND TOUT'],
  ],
  AN31: [
    ['Le Forain des Autos-Tamponneuses', 'Gilet rayé ambre et noir sur une chemise blanche à '
      + 'fixe-manches, bourse de cuir, couronne de jetons de laiton à la ceinture et la haute '
      + 'perche à étincelles d’une auto-tamponneuse tenue comme une canne. Son haut-de-forme '
      + 'ambre brille, et quand il cogne la perche au sol, toute la piste repart.',
      'EN PISTE !'],
    ['Le Roi de la Foire', 'Une cape en chapiteau rayé ambre et noir bordée de rangées d’ampoules '
      + 'qui brillent, des épaulettes en pare-chocs d’autos-tamponneuses, un haut-de-forme géant '
      + 'couronné de petites lumières et la perche devenue un grand bâton lumineux. Quand il '
      + 'frappe, toute la foire s’allume d’un coup — et le jeton de laiton pend toujours à son '
      + 'cou.',
      'TOUTE LA FOIRE TOURNE'],
  ],
  AN32: [
    ['L’Archéologue du Tertre', 'Veste de toile bleue délavée aux poches sans nombre, chapeau à '
      + 'large bord, mètre ruban et pinceaux à la ceinture, jalon de bois dans le dos et petites '
      + 'trouvailles d’argent épinglées sur la poitrine. Sa truelle au manche bleu qui luit ne '
      + 'gratte jamais au hasard : il se souvient de chaque couche.',
      'COUCHE PAR COUCHE'],
    ['Le Roi du Tertre', 'Une armure ancienne de fer et d’argent aux entrelacs gravés qui luisent '
      + 'de bleu, un lourd manteau de laine bleue fermé d’une broche d’argent ronde, un haut '
      + 'casque de fer à crête, visière relevée, et la truelle géante portée droite comme un '
      + 'sceptre. Le vieux roi de la colline se souvient de tout, et la tribune avec lui — et les '
      + 'chaussures de marche boueuses sont toujours à ses pieds.',
      'LA COLLINE SE SOUVIENT'],
  ],
  AN33: [
    ['La Potière du Tour', 'Long tablier de toile crème taché d’émail bleu et jaune, manches '
      + 'retroussées, fil à couper et outils de bois à la ceinture, et le grand bol ajouré posé '
      + 'sur l’avant-bras, qui luit doucement par chacun de ses trous. Elle perce ses motifs un à '
      + 'un, et la dentelle apparaît d’un coup.',
      'LA DENTELLE APPARAÎT'],
    ['La Reine de la Faïence Ajourée', 'Une armure de plaques de faïence crème percées comme de la '
      + 'dentelle, une lumière bleu roi qui passe par chaque trou, des filets d’émail jaune sur '
      + 'les bords, une haute couronne de corbeilles ajourées empilées, une cape d’écailles de '
      + 'porcelaine et le bol géant porté comme un bouclier. Chaque trou s’allume, et toute la '
      + 'tribune dessine avec elle — le crayon est toujours planté dans son chignon.',
      'TOUTE LA DENTELLE BRILLE'],
  ],
  AN34: [
    ['La Chanteuse de Beat', 'Courte robe droite rouge à col blanc, bottes blanches, grands '
      + 'anneaux aux oreilles, une choucroute plus haute que jamais, le micro rouge sur son pied '
      + 'chromé et un tambourin rouge à la hanche. Elle chante entre les temps, et toute la cave '
      + 'frappe dans ses mains avec elle.',
      'TOUT LE MONDE TAPE'],
    ['La Reine du Beat', 'Une robe de paillettes rouges aux panneaux géométriques blancs qui '
      + 'luisent, un haut col de petits projecteurs ronds dressé derrière sa tête, une cape de '
      + 'velours rouge et le micro géant, chromé et rouge, tenu droit comme un sceptre, qui '
      + 's’allume de l’intérieur. Elle lance le contretemps et toute la tribune le prend — et '
      + 'c’est toujours le petit micro rouge de la cave.',
      'ENTRE LES TEMPS'],
  ],
  AN35: [
    ['La Programmeuse des Lampes', 'Longue blouse blanche sur le twin-set marine, planchette sous '
      + 'le bras, câbles à fiches enroulés sur l’épaule et la grande bobine bleu ciel qui tourne '
      + 'lentement à sa taille, son ruban perforé faiblement lumineux. Elle compte les lampes qui '
      + 's’allument une à une, et la machine répond au dernier chiffre.',
      'À LA DERNIÈRE LAMPE'],
    ['La Reine de la Machine', 'Une armure de hautes rangées de lampes de verre qui luisent dans '
      + 'des cadres bleu ciel et blancs, des rangs d’interrupteurs et de voyants qui clignotent '
      + 'sur la poitrine, une coiffe de lampes dressées, une longue cape de ruban perforé et la '
      + 'bobine géante au bras comme un bouclier. Elle compte, la machine calcule, et toute la '
      + 'tribune part au même chiffre — les lunettes d’écaille sont toujours sur son nez.',
      'TOUTE LA MACHINE S’ALLUME'],
  ],
  AN36: [
    ['La Tisserande du Coton', 'Long tablier de coton blanc sur une robe noire, manches rouges '
      + 'retroussées, sabots de bois, ciseaux pendus à un ruban, un rouleau d’étoffe rouge et '
      + 'blanche sur l’épaule et la grande navette rouge polie, son fil blanc lumineux tendu '
      + 'derrière elle. Le fil monte, le fil descend, et elle ne le laisse jamais filer.',
      'TENDU, TOUJOURS'],
    ['La Reine des Mille Navettes', 'Une robe tissée d’étoffe rouge, blanche et noire qui luit, '
      + 'dont les fils courent encore sur sa poitrine comme sur un métier, des ensouples de bois '
      + 'en épaulettes, des rangées de petites navettes rouges sur le corsage, une haute coiffe '
      + 'de bobines blanches et la navette géante tenue comme un sceptre. Mille métiers battent à '
      + 'son rythme — et le foulard de coton rouge est toujours dans ses cheveux.',
      'MILLE MÉTIERS BATTENT'],
  ],
  AN37: [
    ['La Joueuse de Cornemuse du Nord', 'Longue cape de laine noire sur un chemisier blanc, châle '
      + 'à carreaux noirs et blancs épinglé à l’épaule, la cornemuse sous un bras et le petit '
      + 'soufflet de cuir sanglé à l’autre, ses bourdons d’ébène posés sur l’épaule et leurs '
      + 'bagues blanches qui luisent. Elle joue au soufflet, sans souffler, et tout le quai '
      + 'marche à son pas.',
      'AU PAS DU SOUFFLET'],
    ['La Reine des Bourdons', 'Une robe d’armure à carreaux noirs et blancs aux coutures blanches '
      + 'qui luisent, de hauts bourdons d’ébène cerclés d’argent dressés derrière les épaules '
      + 'comme des tuyaux d’orgue, un grand soufflet de cuir en brassard, une longue cape noire '
      + 'et le sac à carreaux géant sous le bras, qui luit de l’intérieur. Ses bourdons tiennent '
      + 'la note et toute la tribune tient le temps — la mèche blanche est toujours dans ses '
      + 'cheveux.',
      'TOUS LES BOURDONS'],
  ],
  AN38: [
    ['La Spéléologue des Grottes', 'Combinaison rouge aux genoux et aux coudes blancs renforcés, '
      + 'rouleau de corde blanche à l’épaule, baudrier à anneaux d’acier, genouillères et le '
      + 'casque rouge bien ajusté, sa lampe frontale qui brille blanc. Elle connaît chaque '
      + 'galerie sous la ville, et chaque écho qui en revient.',
      'L’ÉCHO REVIENT'],
    ['La Reine des Caves de Grès', 'Une armure de plaques de grès rouge sculptées aux veines '
      + 'blanches qui luisent, une haute couronne d’arches de grès comme des entrées de grotte, '
      + 'une cape de corde blanche tressée, le casque rouge géant à la lampe éclatante et un '
      + 'bâton taillé dans un pilier de grès. Toutes les grottes lui répondent, et toute la '
      + 'tribune avec elles — et les vieilles chaussures éraflées sont toujours à ses pieds.',
      'TOUTES LES GROTTES RÉPONDENT'],
  ],
  AN39: [
    ['La Souffleuse de Verre', 'Lourd tablier de cuir sur une chemise blanche aux manches '
      + 'retroussées, épais gants contre la chaleur, lunettes de protection sur le front, la '
      + 'longue canne de souffleur et sa bulle de verre rouge incandescente au bout, et l’orbe à '
      + 'spirales, gros comme un melon, qui luit dans un filet à sa hanche. Elle retient son '
      + 'souffle, puis souffle d’un coup, juste quand le verre est prêt.',
      'QUAND LE VERRE EST PRÊT'],
    ['La Reine du Verre Soufflé', 'Une armure d’épaisses plaques de verre clair aux spirales '
      + 'rouges et blanches qui luisent de l’intérieur, une haute couronne de fines flèches de '
      + 'verre torsadé, une cape de perles de verre claires et l’orbe géant serré à deux bras '
      + 'contre sa poitrine, qui brille comme une lanterne. Elle retient, elle lâche, et toute la '
      + 'tribune s’embrase — et les baskets rouges sont toujours à ses pieds.',
      'TOUT LE VERRE S’ALLUME'],
  ],
  AN40: [
    ['La Lanceuse de Cerfs-Volants', 'Long coupe-vent bleu marine aux bandes blanches sur les '
      + 'manches, mitaines, dévidoir de bois à la ceinture et le grand cerf-volant de soie bleu '
      + 'marine et blanche aux bords lumineux, tenu droit contre elle, sa queue de rubans '
      + 'enroulée au bras. Elle voit la rafale arriver et lève le cerf-volant pile au bon moment.',
      'PILE DANS LE VENT'],
    ['La Reine des Vents', 'Une armure bleu marine et blanche en voiles de cerf-volant pliées, aux '
      + 'baguettes blanches qui luisent, un immense cerf-volant en losange dressé derrière ses '
      + 'épaules comme des ailes, de longues queues de rubans enroulées autour d’elle, une crête '
      + 'de petits cerfs-volants au-dessus de la tête et un dévidoir géant au bras comme un '
      + 'bouclier. Le vent fait le tour du stade et toute la tribune se lève avec lui — le '
      + 'bandeau bleu marine est toujours dans ses cheveux.',
      'TOUTE LA COLLINE SE LÈVE'],
  ],
  AN41: [
    ['La Boîte du Coin de la Rue', 'Plus haute et plus large, un fleuron blanc en couronne sur son '
      + 'chapeau, des bandes d’émail blanc autour du corps, une lanterne de laiton fixée au flanc '
      + 'et le sac postal rouge devenu gros et plein, scellé d’un cordon blanc, qui luit '
      + 'doucement. Elle tient le coin de la rue par tous les temps, et pas une lettre ne '
      + 's’égare.',
      'PAS UNE LETTRE NE S’ÉGARE'],
    ['La Grande Poste Rouge', 'Une colonne de fonte deux fois plus haute, aux épaules massives et '
      + 'aux coutures blanches qui luisent, un haut chapeau cannelé comme un casque, des rangées '
      + 'de fentes lumineuses le long du corps, des enveloppes scellées de cire rouge qui '
      + 'tournent autour d’elle et le sac postal géant sanglé dans le dos. Tout le courrier de la '
      + 'ville passe par elle, et toute la tribune tient avec elle — la carte postale dépasse '
      + 'toujours de sa fente.',
      'TOUT LE COURRIER TIENT'],
  ],
  AN42: [
    ['La Plume Calligraphe', 'Droite et polie, montée sur un porte-plume de bois bordeaux sculpté '
      + 'qui se dresse au-dessus d’elle comme un long chapeau, des volutes bleu ciel gravées le '
      + 'long de son acier, le flacon d’encre bordeaux devenu grand et lumineux à son côté et un '
      + 'ruban d’encre qui s’enroule autour d’elle. Elle trace d’un seul trait, et la page '
      + 'entière suit.',
      'D’UN SEUL TRAIT'],
    ['La Grande Plume d’Acier', 'Immense et étincelante, des épaules d’acier aux volutes gravées '
      + 'qui luisent bleu ciel, un haut porte-plume bordeaux dressé en cimier, le cœur ajouré qui '
      + 'brille de l’intérieur, de larges rubans d’encre bordeaux enroulés autour d’elle comme '
      + 'une cape et le flacon géant porté comme une lanterne. Elle trace, et toute la tribune se '
      + 'dessine avec elle — la petite tache bordeaux est toujours au bout de sa pointe.',
      'TOUTE LA TRIBUNE SE DESSINE'],
  ],
  AN43: [
    ['L’Écureuil de l’Île', 'Plus grand et plus hardi, debout, une courte cape de toile cirée '
      + 'noire doublée de rouge, une petite longue-vue de laiton pendue à un cordon, la sacoche '
      + 'rouge et noire devenue grande, bien bouclée et qui luit doucement, et la queue plus '
      + 'fournie portée haut. Il guette la baie, et ses deux pattes battent chacune leur mesure.',
      'UNE PATTE, PUIS L’AUTRE'],
    ['Le Gardien de l’Île aux Écureuils', 'Immense pour un écureuil, la poitrine large, une énorme '
      + 'queue rousse dressée derrière la tête comme une flamme, une longue cape rayée noir et '
      + 'rouge, un harnais de garde forestier aux anneaux de laiton et la sacoche géante qui luit '
      + 'de rouge de l’intérieur. Ses deux pattes font battre l’île entière, et toute la tribune '
      + 'avec — la noisette est toujours glissée derrière son oreille.',
      'TOUTE L’ÎLE BAT'],
  ],
  AN44: [
    ['La Perruche du Fleuve', 'Plus grande et plus lisse, un court gilet noir aux boutons rouges, '
      + 'une guirlande de fanions rouges et blancs autour des épaules, le bonnet enfin bien '
      + 'ajusté et son pompon qui luit doucement, et de longues plumes de queue portées '
      + 'fièrement. Au-dessus du fleuve, c’est elle qui lance le cri, et toute la nuée le '
      + 'reprend.',
      'LA NUÉE REPREND'],
    ['La Reine des Perruches', 'Immense, les ailes vertes repliées haut sur les épaules comme un '
      + 'manteau, une longue traîne de rubans rouges et blancs lumineux mêlés à ses plumes, une '
      + 'crête de petites plumes rouges et blanches qui jaillit du bonnet, un collier de laque '
      + 'noire aux pierres rouges et le bec toujours rouge corail. Elle crie une fois, et toutes '
      + 'les nuées du fleuve répondent — le bonnet à pompon rouge et blanc est toujours sur sa '
      + 'tête.',
      'TOUTES LES NUÉES RÉPONDENT'],
  ],
  AN45: [
    ['Le Galet Poli', 'Plus gros, plus rond et luisant comme s’il sortait de l’eau, sa veine de '
      + 'quartz blanc qui luit doucement, une ceinture de verres de mer bleus et blancs sertis '
      + 'dans la pierre et le seau bleu devenu grand, plein de verre de mer lumineux. Il laisse '
      + 'passer sept vagues, et part sur la huitième.',
      'SUR LA HUITIÈME'],
    ['Le Rocher de la Plage', 'Un rocher deux fois plus gros, aux épaules de pierre massives et '
      + 'arrondies, des veines de quartz blanc qui luisent en travers du corps, une crête de '
      + 'petits galets empilés en équilibre sur la tête, un manteau de verre de mer bleu et blanc '
      + 'serti le long du dos et le seau géant porté au bras. Il retient la marée, puis la lâche, '
      + 'et toute la tribune déferle — le coquillage est toujours sur le bord du seau.',
      'TOUTE LA MARÉE DÉFERLE'],
  ],
  AN46: [
    ['La Théière de Porcelaine', 'Plus grande et luisante, ses bateaux et ses nuages bleu roi '
      + 'peints avec finesse et qui luisent doucement, une soucoupe blanche portée en collerette '
      + 'autour du cou, une passoire à thé d’argent au bout d’une chaînette et le couvre-théière '
      + 'enfin ajusté, brodé de volutes blanches. Elle sert chaque tasse à point, sans jamais la '
      + 'laisser trop infuser.',
      'CHAQUE TASSE À POINT'],
    ['La Grande Théière Bleue', 'Immense et arrondie, des épaules de porcelaine massives aux '
      + 'motifs bleu roi qui luisent, un haut couvercle couronné de fleurs de porcelaine blanche, '
      + 'une pile de soucoupes bleues et blanches dans le dos, un ruban de vapeur lumineuse '
      + 'enroulé autour du bec, une longue cape bleu roi et le couvre-théière à pompon blanc '
      + 'toujours sur la tête. Elle sert le thé à toute la tribune, et toute la tribune tient '
      + 'jusqu’au bout — la petite fêlure est toujours sur son couvercle.',
      'LE THÉ POUR TOUTE LA TRIBUNE'],
  ],
  AN47: [
    ['Le Chariot des Mystères', 'Plus grand et repeint de frais en blanc et bleu ciel, ses rideaux '
      + 'bleu ciel ouverts sur un petit décor peint de nuages et d’étoiles et une rangée de '
      + 'petites rampes lumineuses le long de la scène. De place en place, il joue la même scène, '
      + 'et toute la rue le suit.',
      'DE PLACE EN PLACE'],
    ['Le Grand Char de la Procession', 'Immense sur ses grandes roues sculptées, deux étages de '
      + 'scène de bois peint aux rideaux bleu ciel lumineux, un haut toit couronné de nuages de '
      + 'bois sculpté et d’une étoile bleu ciel, des bras sculptés aux épaules massives et des '
      + 'rangées de rampes lumineuses le long de ses bords. Il fait le tour de la ville, et toute '
      + 'la tribune tourne avec lui — la petite lanterne pend toujours sous son toit.',
      'TOUTE LA VILLE FAIT LE TOUR'],
  ],
  AN48: [
    ['Le Persan Primé', 'Plus grand, la fourrure brossée en une collerette lustrée, un coussin '
      + 'd’exposition de velours rouge sous la patte, un petit nœud de satin bleu sur une oreille '
      + 'et la rosette rouge et bleue devenue grande, qui luit doucement sur sa poitrine. Il '
      + 'défile devant le jury sans jamais perdre la mesure.',
      'SANS PERDRE LA MESURE'],
    ['Le Grand Champion de l’Exposition', 'Immense et majestueux, une énorme collerette de '
      + 'fourrure crème autour des épaules, une longue cape de velours rouge et bleu, une petite '
      + 'couronne de velours rouge en forme de coussin sur la tête, des dizaines de rosettes '
      + 'rouges et bleues épinglées en rangs sur sa poitrine et la rosette géante qui luit de '
      + 'l’intérieur. Il ronronne, et toute la tribune bat sa mesure — le peigne est toujours '
      + 'coincé dans sa queue.',
      'TOUTE LA TRIBUNE RONRONNE'],
  ],
  AN49: [
    ['Le Phoque du Banc de Sable', 'Plus grand et lisse, un pull de pêcheur bleu marine enfilé sur '
      + 'les épaules, un sifflet de laiton au bout d’un cordon, la bouée devenue grande, portée '
      + 'en bandoulière et qui luit doucement, et de longues moustaches fières. Il veille sur le '
      + 'banc, et ses nageoires battent l’alerte plus vite que la marée.',
      'PLUS VITE QUE LA MARÉE'],
    ['Le Grand Phoque de l’Estuaire', 'Immense et puissant, des épaules massives gris argent sous '
      + 'des épaulières, une longue cape de toile cirée bleue, une crête de coquillages blancs '
      + 'comme de l’écume sur la tête, un lourd rouleau de cordage en travers de la poitrine et '
      + 'la bouée géante portée comme un bouclier, qui luit de l’intérieur. Il frappe, et toute '
      + 'la tribune claque avec lui — quelques grains de sable sont toujours sur son nez.',
      'TOUT L’ESTUAIRE CLAQUE'],
  ],
  AN50: [
    ['L’Anguille du Fleuve', 'Plus longue et argentée, lovée en spirale avec assurance, un court '
      + 'gilet noir aux boutons blancs, une petite boussole de laiton au bout d’une chaînette et '
      + 'la casquette blanche enfin ajustée, dont le bandeau luit doucement. Elle se déroule en '
      + 'travers du courant, et retombe pile où elle voulait.',
      'PILE OÙ JE VOULAIS'],
    ['La Grande Anguille d’Argent', 'Une haute spirale d’argent luisant, aux épaules massives et '
      + 'arrondies, une longue nageoire rayée noir et blanc en crête le long du dos, des lignes '
      + 'blanches lumineuses qui courent sur son corps comme des rides sur l’eau, une cape de '
      + 'soie noire derrière ses anneaux et la casquette géante au bandeau lumineux. Elle se '
      + 'déroule, et toute la tribune part avec le courant — le galet du fleuve est toujours dans '
      + 'sa nageoire.',
      'TOUT LE FLEUVE SE DÉROULE'],
  ],
  AN51: [
    ['La Cabine du Coin', 'Plus grande et repeinte de frais, ses vitres qui luisent d’un ambre '
      + 'chaud de l’intérieur, un monnayeur de laiton sur le ventre, un rouleau de câbles noirs '
      + 'bien enroulé sur l’épaule et le combiné ambre poli, qui luit doucement au bout de son '
      + 'fil. Elle compose chaque numéro du port de mémoire, sans jamais se tromper.',
      'DE MÉMOIRE, SANS ME TROMPER'],
    ['La Grande Cabine Téléphonique', 'Immense, des épaules de fonte crème massives, des rangées '
      + 'de vitres ambre lumineuses le long du corps, un haut toit en dôme couronné de petites '
      + 'lampes ambre, une cape de fils téléphoniques noirs tressés dans le dos et le combiné '
      + 'géant porté comme un sceptre, qui luit de l’intérieur. Elle appelle, et toute la tribune '
      + 'décroche — la vitre fêlée est toujours dans sa porte.',
      'TOUT LE PORT DÉCROCHE'],
  ],
  AN52: [
    ['La Loutre de l’Estuaire', 'Plus grande et lisse, un court pull bleu tricoté aux anneaux '
      + 'blancs, un sac étanche sur le dos, un rouleau de corde sur l’épaule et la lanterne bleue '
      + 'devenue grande, à la lumière blanche, portée haut au bout d’une perche. Elle veille sur '
      + 'l’estuaire toute la nuit, sans jamais baisser sa lanterne.',
      'JE NE LA BAISSE PAS'],
    ['La Grande Loutre du Fleuve', 'Immense et forte, un large poitrail, une longue cape de toile '
      + 'cirée bleue doublée de blanc, une haute pile de galets du fleuve en équilibre sur la '
      + 'tête, un harnais de corde bleue aux anneaux de laiton et la lanterne géante portée comme '
      + 'un phare, qui luit de l’intérieur. Elle veille, et toute la tribune tient avec elle — le '
      + 'galet plat est toujours en haut de la pile.',
      'PAS UN GALET NE TOMBE'],
  ],
  AN53: [
    ['La Rhubarbe de la Remise', 'Plus haute et d’un cramoisi luisant, sa petite feuille jaune '
      + 'dépliée comme un chapeau à plumes, un tablier de récolte blanc à bande bleue noué autour '
      + 'de la tige, un petit panier de tiges roses coupées à la hanche et la lanterne bleue '
      + 'devenue grande, à la flamme jaune qui luit. Elle pousse à la lueur de la bougie, plus '
      + 'vite à chaque craquement.',
      'PLUS VITE À CHAQUE CRAC'],
    ['La Grande Reine Rose', 'Immense et d’un cramoisi éclatant, une gerbe de hautes tiges roses '
      + 'dressées derrière ses épaules comme une couronne de flèches, une large feuille jaune '
      + 'pâle froissée en manteau dans le dos, une ceinture de petites lanternes lumineuses et la '
      + 'lanterne géante portée haut, à la flamme jaune qui luit. Elle pousse, et toute la '
      + 'tribune craque avec elle — la petite feuille tombante est toujours sur sa tête.',
      'TOUTE LA REMISE CRAQUE'],
  ],
  AN54: [
    ['La Marmite du Port', 'Plus grande et polie, un tablier de cuisinier blanc à bande rouge noué '
      + 'autour du ventre, une botte de carottes et un oignon pendus à son côté, un torchon à '
      + 'carreaux rouges et blancs plié sur le couvercle et la louche rouge devenue grande, qui '
      + 'luit doucement. Elle mijote tout l’après-midi, et sert pile à l’heure du coup d’envoi.',
      'PILE AU COUP D’ENVOI'],
    ['La Grande Marmite de Ragoût', 'Immense et ronde, des épaules de fonte massives en forme '
      + 'd’anses, des coutures rouges qui luisent comme des braises le long du corps, un haut '
      + 'couvercle couronné de volutes de vapeur, un torchon à carreaux rouges et blancs en cape '
      + 'dans le dos et la louche géante tenue droite comme un sceptre. Elle soulève son '
      + 'couvercle, et toute la tribune mange à sa faim — la bosse est toujours sur son flanc.',
      'TOUTE LA VILLE À TABLE'],
  ],
  AN55: [
    ['La Tarte de la Cantine', 'Entière, ronde et plus grande, sa noix de coco toute duveteuse qui '
      + 'luit doucement, une coiffe blanche de dame de cantine sur sa croûte, un pot de crème '
      + 'anglaise jaune à la main et le plat bleu ciel désormais sous ses pieds comme une scène. '
      + 'Elle dessine son rond de noix de coco sur chaque part, sans jamais déborder.',
      'SANS JAMAIS DÉBORDER'],
    ['La Grande Tarte', 'Immense et ronde, des épaules massives de croûte dorée déployées comme '
      + 'des ailes, une haute crête de crème fouettée blanche au-dessus de la tête, un ruban de '
      + 'confiture rouge lumineuse enroulé autour d’elle comme une écharpe de cérémonie, des '
      + 'rangées de petits plats bleu ciel en épaulières et le plat géant porté comme un '
      + 'bouclier, qui luit de l’intérieur. Elle dessine, et toute la tribune lève sa part — le '
      + 'petit trou dans la noix de coco est toujours sur son flanc.',
      'TOUTE LA TRIBUNE AU DESSERT'],
  ],
  AN56: [
    ['Le Terrier des Filatures', 'Plus grand, sec et musclé, debout, un court manteau de laine '
      + 'noire bordé de rouge, une petite lanterne de laiton pendue à la ceinture, le collier '
      + 'rouge désormais à sa taille, aux clous de laiton qui luisent, et les deux oreilles bien '
      + 'dressées. Il fait sa ronde dans les entrepôts, et chaque mur lui renvoie son aboiement à '
      + 'la note près.',
      'COUP POUR COUP'],
    ['Le Grand Terrier de la Ville', 'Immense et puissant, des épaules massives au poil noir et '
      + 'feu luisant, une longue cape rouge et noire serrée dans le dos, un haut collier de cuir '
      + 'rouge aux clous de laiton lumineux dressé autour du cou comme un gorgerin, une crête de '
      + 'poil noir entre les oreilles et un harnais de cuir rouge aux anneaux de laiton. Il '
      + 'aboie, et toute la tribune lui répond — l’oreille rabattue est toujours rabattue.',
      'TOUTE LA VILLE RÉPOND'],
  ],
  AN57: [
    ['Le Macareux des Îles', 'Plus grand et lisse, le bec désormais aux couleurs vives, un court '
      + 'pull de pêcheur blanc à bandes noires, une petite longue-vue de laiton au bout d’un '
      + 'cordon, trois poissons d’argent alignés dans le bec et le flotteur devenu grand, qui '
      + 'luit doucement à sa hanche. Il file au ras des vagues, les ailes plus rapides que le '
      + 'vent.',
      'PLUS VITE QUE LE VENT'],
    ['Le Grand Macareux', 'Immense, un large poitrail, ses ailes noires repliées haut sur les '
      + 'épaules comme un manteau, une crête de courtes plumes noires, un énorme bec rayé '
      + 'lumineux qui tient une rangée de poissons d’argent, une longue cape noire et blanche '
      + 'serrée dans le dos et le flotteur géant porté comme un bouclier, qui luit de '
      + 'l’intérieur. Il bat des ailes, et toute la tribune tape avec lui — le flotteur blanc '
      + 'cerclé de noir ne l’a jamais quitté.',
      'TOUTE LA FALAISE BAT'],
  ],
  AN58: [
    ['L’Oie du Chemin de la Foire', 'Plus grande et fière, ses plumes blanches lustrées, un châle '
      + 'de bouvier rouge à franges blanches sur les épaules, une petite clochette au bout d’un '
      + 'ruban, le bonnet rouge devenu large, au liseré qui luit doucement, et les petits '
      + 'chaussons toujours aux pattes. Elle mène le troupeau sur la route de la foire, d’un bout '
      + 'à l’autre, sans jamais s’arrêter.',
      'JUSQU’À LA FOIRE !'],
    ['La Reine des Oies', 'Immense et large, ses ailes blanches repliées haut sur les épaules '
      + 'comme un manteau royal, une longue cape rayée rouge et blanc serrée dans le dos, un haut '
      + 'bonnet rouge couronné de plumes blanches, une lourde chaîne de jetons de cuivre sur la '
      + 'poitrine et une longue houlette portée droite. Elle se met en marche, et toute la '
      + 'tribune la suit — les petits chaussons de toile sont toujours à ses pattes.',
      'TOUT LE TROUPEAU SUIT'],
  ],
  AN59: [
    ['Le Ver de la Rivière', 'Plus grand et long, le corps enroulé debout en trois boucles, une '
      + 'petite casquette de pêcheur rayée rouge et blanc sur la tête, une clochette de laiton au '
      + 'bout d’un cordon et le seau rouge devenu grand, posé à côté de ses anneaux comme un '
      + 'trône, au bord qui luit doucement. Il fait onduler ses boucles, et la vague remonte la '
      + 'rivière.',
      'LA VAGUE REMONTE'],
    ['Le Grand Ver Enroulé', 'Immense spirale d’anneaux gris rosé, le haut du corps large comme '
      + 'des épaules, ses anneaux cerclés de bandes rouges et blanches lumineuses, une crête de '
      + 'galets de rivière blancs sur la tête, une longue cape rouge drapée sur ses boucles et le '
      + 'seau géant tenu comme un bouclier, qui luit de l’intérieur. Il ondule, et toute la '
      + 'tribune se lève en vague — la goutte d’eau de rivière est toujours sur sa tête.',
      'TOUTE LA TRIBUNE ONDULE'],
  ],
  AN60: [
    ['Le Pigeon de Course', 'Plus grand et lisse, ses plumes lustrées, une petite veste de course '
      + 'bleu marine passepoilée de blanc, des lunettes d’aviateur relevées sur la tête, une '
      + 'bague blanche à l’autre patte et le tube à message devenu grand, qui luit doucement. Il '
      + 'file au-dessus des toits, droit sur le colombier, quel que soit le vent.',
      'DROIT SUR LE COLOMBIER'],
    ['Le Grand Champion du Colombier', 'Immense, un large poitrail, ses ailes gris-bleu repliées '
      + 'haut sur les épaules comme un manteau, une crête de plumes blanches dressée sur la tête, '
      + 'une longue cape bleu marine passepoilée de blanc, une bandoulière blanche de champion en '
      + 'travers de la poitrine et le tube géant porté comme un bouclier sur l’avant-bras, qui '
      + 'luit de l’intérieur. Il rentre le premier, et toute la tribune tient le cap avec lui — '
      + 'quelques plumes sont toujours dressées sur sa tête.',
      'TOUS LES MESSAGES RENTRENT'],
  ],
  /* ============================================================ DIE KURVE

     Le foot suisse vu du virage debout (`dex-kurve.js`). Chaque lignée monte
     dans un vieux métier ou une vieille fête de sa ville — le carnaval aux
     lanternes, le bateau à aubes, le guet de la cathédrale, le pont couvert,
     le funiculaire, la broderie, l'horloge fleurie, le glacier, la fête des
     cadets, les timbres, le car des cols, la parade techno, le bac du
     fleuve, les corporations, les vignes en terrasses, la fanfare masquée,
     les marrons chauds, la bibliothèque de l'abbaye, le jet d'eau, la
     raclette, la lutte à la culotte, les pistes, le marché aux oignons, les
     pralines — et ses créatures viennent de la même ville. Le troisième âge
     garde toujours un détail du premier. */
  SU1: [
    ['Le Porteur de Lanterne', 'Un long costume de carnaval en patchwork rouge et bleu, des '
      + 'pompons de feutre, un grand masque au long nez relevé sur la tête et des confettis sur '
      + 'les épaules. Sa lanterne est devenue un grand tambour de papier peint qu’il porte sur '
      + 'une perche, et elle éclaire toute la rue.',
      'LES LANTERNES, LEVEZ-LES'],
    ['La Grande Lanterne du Carnaval', 'Il porte une lanterne géante en armure, ses panneaux '
      + 'peints rouges et bleus allumés de l’intérieur entre les côtes de bois, et une couronne '
      + 'de lanternes au-dessus de la tête. Quand il entre dans le virage, toute la nuit '
      + 's’allume — et le petit lampion pend toujours à sa ceinture.',
      'TOUTE LA NUIT S’ALLUME'],
  ],
  SU2: [
    ['La Matelote du Bateau à Aubes', 'Veste bleu nuit à double rangée de boutons de laiton, '
      + 'casquette blanche de marin, un rouleau de cordage sur l’épaule et un sifflet au cou. Le '
      + 'télégraphe du bateau est devenu grand et poli, sa manette luit, et elle le porte à deux '
      + 'mains jusqu’au stade.',
      'EN AVANT TOUTE'],
    ['La Capitaine du Lac', 'Une armure en forme de coque de vieux bateau à aubes, la grande '
      + 'roue à aubes dans le dos comme un bouclier aux rayons lumineux, une cheminée blanche '
      + 'derrière l’épaule. Elle mène toute la flotte du lac jusqu’au match d’en face — et le '
      + 'petit levier jouet est toujours glissé à sa ceinture.',
      'TOUTE LA FLOTTE SUIT'],
  ],
  SU3: [
    ['Le Guet de la Cathédrale', 'Une longue capote bleu roi à revers blancs, un large chapeau '
      + 'de feutre noir et un porte-voix de laiton au côté. Il lève sa lanterne au bout d’un '
      + 'bâton crochu, et chaque nuit, à chaque heure, il crie l’heure à toute la ville.',
      'IL A SONNÉ L’HEURE'],
    ['Le Grand Guet de la Nuit', 'Une armure bleu roi en forme de haut de tour, des arcs de '
      + 'pierre blanche qui luisent sur la poitrine et un chapeau pointu comme une flèche de '
      + 'cathédrale. Sa voix tombe de si haut que toute la tribune se cale dessus — et il '
      + 'compte encore les marches sur ses doigts.',
      'TOUTE LA VILLE À L’HEURE'],
  ],
  SU4: [
    ['La Fleuriste du Pont Couvert', 'Une robe bleu lac à tablier blanc et manches bouffantes, '
      + 'une couronne de géraniums rouges dans les cheveux et une longue jardinière de fleurs '
      + 'sur la hanche. Son arrosoir est devenu grand et luit doucement : le pont n’a jamais été '
      + 'aussi fleuri.',
      'TOUT LE PONT FLEURIT'],
    ['La Reine du Vieux Pont', 'Une armure de poutres sombres et un toit pointu de bardeaux sur '
      + 'les épaules, des jardinières de géraniums lumineux le long des bras et une petite tour '
      + 'de pierre derrière elle. Elle déploie le pont tout entier au-dessus du virage — et le '
      + 'petit arrosoir bleu pend toujours à son bras.',
      'LE PONT TRAVERSE LE VIRAGE'],
  ],
  SU5: [
    ['Le Conducteur du Funiculaire', 'Uniforme noir passepoilé de blanc, boutons d’argent, '
      + 'casquette blanche et gants blancs. Il porte devant lui un petit pupitre de commande '
      + 'noir et blanc dont le cadran luit, et il ne lâche le frein qu’au dernier chiffre.',
      'DERNIER CHIFFRE, ON PART'],
    ['Le Funiculaire de la Montagne', 'Une armure en cabine de funiculaire à gradins, des rangées '
      + 'de fenêtres lumineuses qui descendent sur sa poitrine comme un escalier et une grande '
      + 'roue de câble dans le dos. Il compte, et toute la tribune monte la montagne d’un seul '
      + 'coup — le petit levier jouet est toujours dans sa poche.',
      'TROIS, DEUX, UN… AU SOMMET'],
  ],
  SU6: [
    ['La Brodeuse', 'Une longue robe verte au col blanc brodé, un tablier aux poches pleines de '
      + 'bobines et une pelote d’épingles au poignet. Son tambour est devenu grand et luit de '
      + 'fines fleurs de dentelle blanche, posées point après point.',
      'UN POINT DE PLUS'],
    ['La Reine de la Broderie', 'Une armure de dentelle blanche brodée sur de la soie verte, des '
      + 'épaulettes de dentelle en éventail et une couronne de fil blanc. Elle brode la tribune '
      + 'entière, motif après motif — et le fil est toujours pris dans ses lunettes.',
      'TOUTE LA TRIBUNE BRODÉE'],
  ],
  SU7: [
    ['Le Jardinier de l’Horloge Fleurie', 'Une salopette grenat sur une chemise blanche, un '
      + 'chapeau de paille, une ceinture d’outils pleine de petits pots de fleurs et une longue '
      + 'aiguille d’horloge en laiton sur l’épaule. Il replante l’horloge du parc à la minute '
      + 'près.',
      'À LA MINUTE PRÈS'],
    ['L’Horloge Fleurie Vivante', 'Un grand cadran de fleurs rouges et blanches en guise de '
      + 'cuirasse, deux aiguilles de laiton lumineuses, une couronne de fleurs ouvertes derrière '
      + 'la tête. Toute la tribune chante à son heure — et il a toujours de la terre sur le '
      + 'nez.',
      'C’EST L’HEURE DE CHANTER'],
  ],
  SU8: [
    ['La Guide de Glacier', 'Veste d’alpinisme rouge et blanche, casque blanc, baudrier et '
      + 'mousquetons, crampons aux pieds et un piolet à manche de bois tenu comme un bâton. La '
      + 'corde rouge est devenue épaisse et luit en travers de sa poitrine.',
      'CORDÉE, EN AVANT'],
    ['La Reine du Glacier', 'Une armure de glace bleue et de neige aux coutures rouges, des '
      + 'épaulettes en pics gelés et une couronne de cristaux. Elle tend la corde, attend que '
      + 'tout le virage soit prêt, et elle lâche — la gourde cabossée pend toujours à sa '
      + 'ceinture.',
      'TOUT LE GLACIER LÂCHE'],
  ],
  SU9: [
    ['Le Bouffon de la Fête', 'Un costume moulant en losanges rouges et blancs, une courte cape '
      + 'de lanières de feutre, des grelots de laiton cousus aux épaules et un masque de bois au '
      + 'gros nez relevé sur la tête. C’est lui qui poursuit les enfants, maintenant, et de plus '
      + 'en plus vite.',
      'ATTRAPEZ-LES TOUS'],
    ['Le Grand Bouffon de la Ville', 'Une armure en losanges rouges et blancs, un immense '
      + 'capuchon à trois pointes aux grelots lumineux et un long bâton à boule rouge. Il '
      + 'accélère et toute la ville court derrière lui — et le masque de carton du gamin est '
      + 'toujours glissé dans sa ceinture.',
      'TOUTE LA VILLE COURT'],
  ],
  SU10: [
    ['La Graveuse de Timbres', 'Une longue blouse d’atelier blanche aux poignets rouges, un '
      + 'foulard de soie rouge, une loupe baissée sur l’œil et des feuilles de timbres blancs '
      + 'épinglées sur la blouse. Son burin est devenu grand et luit : elle perce chaque dent au '
      + 'trou près.',
      'AU TROU PRÈS'],
    ['La Reine des Timbres', 'Une armure de grands timbres rouges et blancs qui se chevauchent, '
      + 'leurs dents lumineuses, des épaulettes perforées et une couronne en rangée de timbres. '
      + 'Rien ne dépasse, rien ne manque — et la petite pince est toujours dans sa poche.',
      'PAS UN DE PLUS'],
  ],
  SU11: [
    ['Le Chauffeur du Car des Cols', 'Uniforme noir passepoilé de jaune, casquette jaune, gants '
      + 'de conduite noirs et sacoche à billets. Son volant est devenu grand et luit d’un jaune '
      + 'citron ; à chaque lacet, il lance ses trois notes, et la vallée les lui renvoie.',
      'LA VALLÉE RÉPOND'],
    ['Le Grand Car des Cols', 'Une armure en avant de car jaune arrondi, deux gros phares '
      + 'allumés sur la poitrine, un pare-chocs noir en ceinture et une galerie à bagages sur '
      + 'les épaules. Ses trois notes partent, et toute la montagne les chante après lui — le '
      + 'petit volant jouet est toujours accroché à sa ceinture.',
      'TOUTE LA MONTAGNE RÉPOND'],
  ],
  SU12: [
    ['La DJ du Char de la Parade', 'Une veste bleu roi brillante à bandes lumineuses, des '
      + 'mitaines blanches, une petite platine portative sanglée devant elle et des bâtons '
      + 'lumineux dans les tresses. Son casque est devenu grand et luit : tout le char danse sur '
      + 'son temps.',
      'TOUT LE CHAR SUR LE TEMPS'],
    ['La Reine de la Parade', 'Une armure en char de parade couvert de haut-parleurs blancs et '
      + 'bleus aux membranes lumineuses, une crête de barres de lumière derrière la tête et une '
      + 'longue cape chatoyante. Elle fait le tour du lac sans perdre un temps — et la petite '
      + 'platine jouet est toujours accrochée à sa ceinture.',
      'TOUT LE LAC DANSE'],
  ],
  SU13: [
    ['La Passeuse du Bac', 'Une épaisse vareuse de laine bleue passepoilée de rouge, un chapeau '
      + 'imperméable rouge à large bord, une longue perche de bois et une poulie sur l’épaule. '
      + 'Sa cloche est devenue grande et polie : elle traverse, revient, et ne lutte jamais '
      + 'contre le courant.',
      'LE COURANT NOUS PORTE'],
    ['La Reine du Bac', 'Une armure en coque de bac de bois rouge et bleu aux coutures '
      + 'lumineuses, un petit toit de cabine sur le dos et un arc de câble au-dessus de la tête, '
      + 'une poulie lumineuse à son sommet. Elle fait passer toute la tribune d’une rive à '
      + 'l’autre — et ses pieds sont toujours mouillés.',
      'TOUTE LA RIVE TRAVERSE'],
  ],
  SU14: [
    ['Le Cavalier de la Corporation', 'Un pourpoint de velours bleu nuit aux manches blanches '
      + 'bouffantes, une fraise blanche et un béret à plume. Il porte la grande bannière de la '
      + 'corporation sur une haute hampe, et tout le cortège règle son pas sur le sien.',
      'AU PAS DE LA BANNIÈRE'],
    ['Le Maître des Corporations', 'Un lourd manteau de cérémonie en velours, d’immenses manches '
      + 'blanches brodées de lignes lumineuses, une chaîne d’argent sur la poitrine et un haut '
      + 'chapeau à plumes. Il lève la bannière géante et toutes les corporations le suivent — '
      + 'et le petit bouquet blanc est toujours à sa boutonnière.',
      'TOUTES LES BANNIÈRES SUIVENT'],
  ],
  SU15: [
    ['La Vendangeuse des Terrasses', 'Une robe de travail bleu roi, un grand chapeau de paille '
      + 'à ruban bleu et un sécateur à la ceinture. Sa hotte est devenue grande et pleine de '
      + 'raisins qui luisent ; quand elle se penche sur une vigne, la terrasse d’en dessous se '
      + 'penche aussi.',
      'TOUTE LA VIGNE SE PENCHE'],
    ['La Reine des Terrasses', 'Une armure de murets de pierre sèche posés en gradins, une '
      + 'couronne de grappes et de feuilles de vigne et la hotte géante débordant de raisins '
      + 'lumineux. Elle se lève, et les terrasses se lèvent l’une après l’autre jusqu’au lac — '
      + 'il lui reste toujours du jus sur le menton.',
      'JUSQU’AU LAC'],
  ],
  SU16: [
    ['Le Tromboniste de la Fanfare Masquée', 'Un costume fou de lanières bleues et blanches et '
      + 'de pompons, un énorme masque de monstre en papier mâché relevé sur la tête. Son trombone '
      + 'est devenu grand et brillant, et il joue toujours entre les temps, avec toute la '
      + 'fanfare.',
      'ENTRE LES TEMPS'],
    ['Le Géant de la Fanfare', 'Des couches de lanières bleues et blanches comme une immense '
      + 'crinière, un masque de monstre géant aux yeux lumineux dressé au-dessus de la tête et '
      + 'un trombone énorme. Il joue faux, à contretemps, et toute la tribune le suit — il a '
      + 'toujours des confettis dans les cheveux.',
      'FAUX, ET TOUS ENSEMBLE'],
  ],
  SU17: [
    ['La Marchande de Marrons Chauds', 'Un long tablier noir sur un chemisier blanc, un foulard '
      + 'blanc, des mitaines noires et un petit brasero de fonte sur roues qui rougeoie à côté '
      + 'd’elle. Sa poêle est devenue grande ; elle lance les marrons de loin, et ils retombent '
      + 'tous dans les cornets.',
      'DANS LE CORNET !'],
    ['La Reine du Brasero', 'Une armure de fonte noire en forme de grand brasero, des rangées de '
      + 'trous qui rougeoient sur la poitrine, une courte cheminée derrière l’épaule et une '
      + 'couronne de marrons grillés. Elle lance, et pas un marron ne tombe à côté — le cornet '
      + 'de papier est toujours sous son bras.',
      'PAS UN À CÔTÉ'],
  ],
  SU18: [
    ['Le Bibliothécaire de l’Abbaye', 'Une longue robe verte aux poignets blancs, une ceinture '
      + 'de corde, une petite lampe de lecture et un trousseau de clés de laiton. Ses patins de '
      + 'feutre sont devenus grands et luisent de blanc ; il range une pile de vieux livres sans '
      + 'jamais se tromper de rayon.',
      'PAS LE MAUVAIS RAYON'],
    ['Le Gardien des Mille Livres', 'Une armure en rayonnages baroques sculptés, des rangées de '
      + 'livres aux dos lumineux sur la poitrine et un grand livre ouvert. Il remet toute la '
      + 'tribune en ordre, rang par rang — et il glisse toujours sur ses patins de feutre.',
      'TOUT EST RANGÉ'],
  ],
  SU19: [
    ['La Gardienne du Jet d’Eau', 'Une combinaison imperméable grenat à bandes blanches, des '
      + 'gants et des bottes blancs, un tuyau enroulé sur l’épaule et un fin arc d’eau au-dessus '
      + 'de sa lance. Sa roue de vanne est devenue grande et luit : elle règle le jet au doigt '
      + 'près.',
      'AU DOIGT PRÈS'],
    ['La Reine du Grand Jet', 'Une armure grenat en forme de bassin de fontaine, une haute '
      + 'colonne d’eau blanche qui jaillit de sa couronne et retombe autour d’elle comme une '
      + 'cape. On voit son jet de toute la ville, ni trop haut, ni trop bas — et le petit '
      + 'pistolet à eau est toujours à sa ceinture.',
      'TOUT LE JET, PAS PLUS'],
  ],
  SU20: [
    ['Le Maître Racleur', 'Une veste de cuisinier blanche aux boutons rouges, un long tablier '
      + 'rouge et un bonnet de feutre rouge. Une demi-meule fond sur son petit support de fer, '
      + 'et son racloir est devenu grand : il sert tout le village à toute vitesse.',
      'TOUT LE VILLAGE EST SERVI'],
    ['Le Seigneur de la Meule', 'Une armure en meule de fromage géante à la croûte qui luit, un '
      + 'casque en demi-meule aux coulures figées en crête et le racloir géant tenu comme un '
      + 'sceptre. Il racle et toute la tribune frappe avec lui — il a toujours du fromage sur le '
      + 'menton.',
      'RACLEZ TOUS ENSEMBLE'],
  ],
  SU21: [
    ['La Lutteuse à la Culotte', 'Une chemise blanche à bord rouge, la solide culotte de toile '
      + 'rouge sur un pantalon sombre, de gros avant-bras et une couronne de fleurs blanches. Dans '
      + 'le rond de sciure, on la pousse, on la tire, et elle reste debout.',
      'TOUJOURS DEBOUT'],
    ['La Reine du Rond de Sciure', 'Des épaules et des bras immenses, des épaulettes de toile '
      + 'rouge roulées comme des culottes de lutte, une grande couronne de fleurs et une cloche '
      + 'd’honneur sur la poitrine. Toute la tribune s’appuie sur elle sans la faire plier — il '
      + 'y a toujours de la sciure dans ses cheveux.',
      'PERSONNE NE NOUS COUCHE'],
  ],
  SU22: [
    ['Le Moniteur de Ski', 'Une combinaison de ski rouge à chevrons blancs, des gants blancs, '
      + 'des skis courts sur l’épaule et des petits fanions rouges et blancs glissés dans la '
      + 'ceinture. Ses lunettes rouges luisent sur son front : il se ramasse et part pile au '
      + 'signal.',
      'AU SIGNAL, PARTEZ'],
    ['Le Roi des Pistes', 'Une armure de neige tassée et de pans de combinaison rouge, des '
      + 'épaulettes en piquets de slalom croisés et une couronne de cristaux de neige. Les grandes '
      + 'lunettes rouges brillent comme une visière, et toute la tribune part avec lui — la petite '
      + 'luge est toujours accrochée dans son dos.',
      'TOUTE LA PISTE S’ÉLANCE'],
  ],
  SU23: [
    ['La Tresseuse du Marché aux Oignons', 'Un long tablier noir sur un chemisier jaune, des '
      + 'mitaines noires et de longues tresses d’oignons dorés sur les épaules comme une étole. '
      + 'Son marteau jaune est devenu grand et luit ; il couine sur toutes les têtes du marché, '
      + 'de plus en plus vite.',
      'TOUT LE MARCHÉ COUINE'],
    ['La Reine des Oignons', 'Un lourd manteau de tresses d’oignons qui luisent, une couronne '
      + 'de petits oignons et de rubans jaunes et noirs, une cape couverte de confettis et le '
      + 'marteau géant qui couine. Elle tape, et toute la tribune tape avec elle — elle a '
      + 'toujours des confettis dans les cheveux.',
      'COUIC POUR TOUT LE MONDE'],
  ],
  SU24: [
    ['Le Chocolatier', 'Une veste de confiseur blanche aux boutons bleu roi, une haute toque, un '
      + 'tablier bleu, une poche à douille à la ceinture et un plateau de pralines brillantes. '
      + 'Sa boîte de pralines est devenue grande et luit : il démoule à la seconde exacte.',
      'À LA SECONDE EXACTE'],
    ['Le Maître des Pralines', 'Une armure de plaques de chocolat noir aux volutes de chocolat '
      + 'blanc, des épaulettes de pralines empilées et une toque immense comme une couronne. Il '
      + 'tient sa boîte géante ouverte comme un bouclier, et il lâche tout au bon moment — il a '
      + 'toujours du chocolat au coin des lèvres.',
      'TOUT EST PRÊT, LÂCHEZ'],
  ],
  SU25: [
    ['Le Poisson du Rhin', 'Bien gonflé et luisant, debout et fier, une rangée de petites '
      + 'nageoires sur le dos et un coin de serviette rayée qui dépasse de son col roulé. Sa '
      + 'bouée bleue est devenue grande et luit : il nage la brasse, une nageoire après l’autre.',
      'UNE NAGEOIRE, PUIS L’AUTRE'],
    ['Le Grand Poisson Flotteur', 'Immense, une armure de grandes écailles rouges et bleues aux '
      + 'coutures lumineuses, une haute nageoire dorsale en crête, son col roulé devenu couronne '
      + 'à boucle brillante et la bouée géante en bouclier. Toute la baignade d’été descend le '
      + 'fleuve derrière lui — il garde une goutte d’eau sur la peau.',
      'TOUT LE FLEUVE NAGE'],
  ],
  SU26: [
    ['Le Bonhomme du Bûcher', 'Plus grand et tout rond, debout sur une petite pile de bûches, '
      + 'le coton plus touffu, une rangée de pétards de papier cousus le long des bras et une '
      + 'collerette de papier sous l’écharpe. Son chapeau haut de forme a grandi, et ses pétards '
      + 'éclatent par trois.',
      'PAN-PAN-PAN, ET ENCORE'],
    ['Le Grand Bonhomme du Printemps', 'Immense, des épaules de coton comme des congères, une '
      + 'couronne d’étincelles inoffensives qui crépite autour du chapeau géant et des rangées de '
      + 'pétards en bandoulière. Il éclate par salves, et toute la tribune éclate avec lui — le '
      + 'petit serpentin dépasse toujours de sa tête.',
      'LE PRINTEMPS ÉCLATE'],
  ],
  SU27: [
    ['La Rame des Pentes', 'Plus longue et plus forte, accrochée à la pente par ses roues '
      + 'solides, ses panneaux blancs à bandes bleu roi bien polis et un phare allumé. Son frein '
      + 'bleu est devenu grand et luit : elle monte la colline sans s’arrêter.',
      'SANS S’ARRÊTER'],
    ['La Grande Rame de la Colline', 'Immense, une armure de panneaux blancs et bleu roi aux '
      + 'coutures lumineuses, un toit arrondi couronné de feux et des rangées de fenêtres '
      + 'allumées. Elle emmène toute la tribune jusqu’en haut de la colline — et la petite bosse '
      + 'inquiète de son pare-chocs est toujours là.',
      'TOUT LE MONDE EN HAUT'],
  ],
  SU28: [
    ['Le Cygne du Quai', 'Devenu blanc et élancé, plus grand, le cou fièrement dressé, un petit '
      + 'col de marin bleu lac rayé de blanc sur les épaules. Sa cloche est devenue grande et luit '
      + 'doucement ; il glisse sur le lac, et son reflet fait exactement la même chose.',
      'LE LAC ME RÉPOND'],
    ['Le Grand Cygne du Lac', 'Immense et le poitrail large, de grandes ailes blanches repliées '
      + 'haut comme un manteau aux bords bleus lumineux, une crête de plumes blanches et la '
      + 'cloche géante sur la poitrine. Toute la tribune refait ses gestes comme le lac — une '
      + 'seule plume grise de duvet est restée sur sa tête.',
      'TOUT LE LAC REFAIT'],
  ],
  SU29: [
    ['La Chèvre des Vallées', 'Plus grande et le pied sûr, debout sur une corniche, les cornes '
      + 'plus longues et polies et une couverture tissée noire et blanche sur le dos. Sa cloche '
      + 'est devenue grande et luit : elle passe de rocher en rocher sans plus jamais tomber.',
      'DE ROCHER EN ROCHER'],
    ['La Grande Chèvre des Cimes', 'Immense, d’énormes cornes noires enroulées en couronne aux '
      + 'lignes lumineuses, un manteau de fourrure noire et une courte cape à carreaux noirs et '
      + 'blancs. Elle mène tout le virage jusqu’au plus haut sommet — et une touffe de foin est '
      + 'toujours prise dans sa barbiche.',
      'TOUT LE MONDE AU SOMMET'],
  ],
  SU30: [
    ['Le Biscuit Brodé', 'Plus grand et plus épais, glacé et brillant, le ventre couvert de '
      + 'fines fleurs de sucre comme une broderie, un napperon de papier en collerette et un '
      + 'ruban vert. Son moule est devenu grand et luit de blanc : son dessin est enfin fini.',
      'LE DESSIN EST FINI'],
    ['Le Grand Biscuit des Fêtes', 'Immense, un corps de pain d’épices brillant cuirassé de '
      + 'broderies de sucre qui luisent, de hautes volutes de glaçage en couronne et le moule '
      + 'géant en bouclier. Il dessine la tribune entière en sucre blanc — et son coin grignoté '
      + 'manque toujours.',
      'TOUTE LA TRIBUNE EN SUCRE'],
  ],
  SU31: [
    ['La Marmite de l’Escalade', 'Plus grande et plus brillante, un ruban de sucre blanc noué '
      + 'd’un nœud grenat autour du ventre, un petit chou en pâte d’amande sur le couvercle. Sa '
      + 'louche est devenue grande et luit ; elle tient bon jusqu’au coup, pas une seconde de '
      + 'moins.',
      'ON TIENT JUSQU’AU COUP'],
    ['La Grande Marmite des Remparts', 'Immense, un corps de chocolat moulé cuirassé de plaques '
      + 'grenat aux coutures de sucre lumineuses, un couvercle crénelé comme le haut des remparts '
      + 'et la louche géante en sceptre. Elle tient la tribune jusqu’à la dernière seconde — sa '
      + 'petite fêlure est toujours sur son flanc.',
      'LES REMPARTS TIENNENT'],
  ],
  SU32: [
    ['La Vache des Alpages', 'Plus grande et massive, plantée sur ses pattes, une couverture '
      + 'brodée rouge et blanche sur le dos et une couronne de fleurs entre les cornes. Sa '
      + 'cloche est devenue grande et polie ; elle pousse, et le troupeau recule.',
      'LE TROUPEAU RECULE'],
    ['La Reine des Alpages', 'Immense et musclée, d’énormes cornes aux lignes lumineuses, une '
      + 'haute couronne de fleurs et de rubans et un lourd manteau brodé rouge. Personne ne fait '
      + 'reculer la tribune derrière elle — la petite pâquerette est toujours sur sa corne.',
      'LA REINE NE RECULE PAS'],
  ],
  SU33: [
    ['Le Bouvier de la Montagne', 'Grand et fort, debout, un harnais de cuir rouge aux coutures '
      + 'blanches et aux boucles de laiton, une courte cape blanche sur le dos. Son bidon rouge '
      + 'est devenu grand et luit : il le porte jusqu’au lac sans jamais le poser.',
      'JUSQU’AU LAC SANS POSER'],
    ['Le Grand Bouvier des Alpages', 'Immense, une épaisse fourrure tricolore comme une crinière '
      + 'de lion, une armure de harnais rouge, une roue de charrette à lait sur chaque épaule et '
      + 'le bidon géant sur la poitrine. Il tire toute la tribune derrière lui — une goutte de lait '
      + 'est toujours sur sa truffe.',
      'TOUTE LA CHARRETTE TIENT'],
  ],
  SU34: [
    ['Le Chamois des Crêtes', 'Plus grand et agile, fièrement debout sur un rocher, une courte '
      + 'cape rouge bordée de blanc et une corde blanche sur l’épaule. Son sac à dos est devenu '
      + 'grand et luit doucement ; il vise la crête d’en face et retombe pile dessus.',
      'PILE SUR LA CRÊTE'],
    ['Le Grand Chamois des Sommets', 'Immense et puissant, de longues cornes crochues aux lignes '
      + 'lumineuses, une épaisse crinière d’hiver et le sac à dos géant sanglé sur la poitrine '
      + 'comme une cuirasse. Il saute de crête en crête sans jamais manquer — un petit caillou est '
      + 'toujours pris dans sa fourrure.',
      'DE CRÊTE EN CRÊTE'],
  ],
  SU35: [
    ['Le Bateau de la Rivière', 'Gonflé à bloc et brillant, plus haut et ferme, un gilet de '
      + 'sauvetage noir sanglé autour du ventre et des poignées noires sur les côtés. Sa pagaie '
      + 'est devenue grande et luit d’un jaune citron ; il pagaie si vite qu’il file droit.',
      'TOUT DROIT, PAGAIE'],
    ['Le Grand Radeau de l’Été', 'Immense, un corps de boudins jaunes gonflés comme des plaques '
      + 'd’armure, une haute crête gonflable, une grosse corde noire en écharpe et la pagaie géante '
      + 'en sceptre. Toute la ville descend la rivière derrière lui — la petite valve dépasse '
      + 'toujours de sa tête.',
      'TOUTE LA RIVIÈRE PAGAIE'],
  ],
  SU36: [
    ['Le Tram de la Ville', 'Plus long et plus fort, ses panneaux bleus et blancs polis, un '
      + 'pantographe brillant sur le toit et des petits rideaux blancs aux fenêtres. Sa cloche '
      + 'est devenue grande et luit ; il annonce chaque arrêt avant même d’y arriver.',
      'JE CONNAIS LA LIGNE'],
    ['Le Grand Tram du Lac', 'Immense, une armure de panneaux bleu roi et blancs aux coutures '
      + 'lumineuses, un haut pantographe en crête et des rangées de fenêtres rondes allumées. Il '
      + 'fait le tour de toutes les lignes sans jamais se tromper d’arrêt — et ses sourcils '
      + 'gardent leur petite inquiétude.',
      'TOUTES LES LIGNES PAR CŒUR'],
  ],
};
