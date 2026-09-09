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
 *   - une bête, un revenant ou un objet monte en **intensité** : ils ne font
 *     pas carrière, ils deviennent plus eux-mêmes.
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

  /* ========================================== VIRAGE NORD · NUITS · IMPOSSIBLE

     Les trois premières séries, celles d'avant le grand lot. Elles racontent
     le même virage à des heures différentes, et leurs personnages suivent la
     même règle que les autres.                                               */

  X1: [
    ['Le Lanceur de Ola', 'Il ne la suit plus, il la lance. Il faut trois essais et un peu de honte, '
      + 'et à la troisième vingt mille personnes se lèvent.', 'OLA, ENCORE'],
    ['Le Douzième', 'Le club a retiré le numéro 12 et il l’a donné au virage. C’est lui qui a reçu le '
      + 'maillot, un soir, devant tout le monde, et il n’a rien pu dire.', 'ON EST DOUZE'],
  ],
  X2: [
    ['Écharpes Nouées', 'Les écharpes ne sont plus levées : elles sont attachées les unes aux autres '
      + 'et elles font le tour du bloc. Personne ne récupère la sienne avant la fin.',
      'ON LES ATTACHE'],
    ['La Voûte', 'Quatre mille écharpes forment un toit au-dessus du virage à l’entrée des joueurs. '
      + 'Ça dure quarante secondes et ça se voit depuis l’autre bout de la ville.', 'LEVEZ TOUT'],
  ],
  X6: [
    ['Section Debout', 'La section cendrée a obtenu ses places debout, après onze ans de dossiers. '
      + 'Elle a fêté ça en restant assise tout un match, par ironie.', 'TOUJOURS FIDÈLES'],
    ['La Section', 'Elle a soixante ans, deux cents membres et ses propres statuts. Elle survivra au '
      + 'club si le club tombe, et elle le sait.', 'ON SERA ENCORE LÀ'],
  ],
  X7: [
    ['Le Chercheur des Trois', 'Il en a trouvé deux, en quatre ans, dans une brocante. Il en cherche '
      + 'une, une seule, et il ne dort pas très bien.', 'IL M’EN MANQUE UNE'],
    ['L’Album Complet', 'La dernière carte lui a été donnée par un gamin qui ne savait pas ce qu’elle '
      + 'valait. Il a rendu l’album au club. Il a recommencé une collection le lendemain.',
      'ON A TOUT GARDÉ'],
  ],
  X8: [
    ['La Mascotte du Samedi', 'Le costume est à sa taille. Elle fait le tour du terrain avant le '
      + 'coup d’envoi et elle a le droit de toucher le ballon, une fois.', 'LA PELUCHE ARRIVE'],
    ['Le Costume Transmis', 'Elle a passé le costume à un gamin de sept ans et elle l’a aidé à '
      + 'l’enfiler. Elle regarde depuis le bord, les mains dans les poches.', 'À TOI DE COURIR'],
  ],
  X20: [
    ['Le Deuxième Match', 'Il connaît deux chants et il sait quand se lever. Il regarde encore son '
      + 'voisin, mais moins, et son voisin a commencé à lui parler.', 'PRESQUE COMME LES AUTRES'],
    ['Celui Qui Explique', 'Il est assis à côté de quelqu’un qui vient pour la première fois, et il '
      + 'lui dit quand se lever. Il n’a pas oublié.', 'FAIS COMME MOI'],
  ],
  X39: [
    ['La Cagoule Rangée', 'La cagoule est dans la poche et le lapin rose est sur la table. Il a '
      + 'découvert que personne ne s’en moquait, ce qui l’a beaucoup surpris.', 'PAS MÉCHANT DU TOUT'],
    ['Le Lapin Rose', 'Le virage a fait une bâche avec le lapin dessus. Elle est sortie en derby et '
      + 'elle a fait rire le stade entier, y compris le parcage adverse.', 'C’EST MOI, LE LAPIN'],
  ],
  X41: [
    ['L’Homme Sans le Costume', 'Il a enlevé la tête pour de bon et il a un badge à son nom. Les '
      + 'gens le reconnaissent enfin, et ça lui fait un drôle d’effet.', 'DIX MINUTES'],
    ['Le Visage', 'Il est sur l’affiche de la saison, sans costume, avec la tête de mascotte sous le '
      + 'bras. Vingt-deux ans dedans, et une photo dehors.', 'ME VOILÀ, POUR DE BON'],
  ],
  X47: [
    ['Le Bob Usé', 'Le bob a trente-quatre ans et deux reprises cousues main. Même place, même '
      + 'sandwich, et il a arrêté de compter il y a longtemps.', 'COMME TOUJOURS'],
    ['Le Bob du Musée', 'Le club a demandé le bob pour la vitrine. Il a dit non. Il a proposé de '
      + 'venir s’asseoir dans la vitrine avec, ce qui a clos la discussion.', 'IL RESTE SUR MA TÊTE'],
  ],
  X48: [
    ['Le Gosse Qui a Compris', 'Il a gagné le match d’après. Il fait toujours la tête, parce qu’il '
      + 'a compris qu’il y en aurait toujours un autre.', 'C’EST JAMAIS JUSTE'],
    ['L’Entraîneur des Petits', 'Il coache les U9 et il leur dit que perdre le samedi, ça arrive. Il '
      + 'ne s’en est jamais convaincu lui-même.', 'ON REJOUE SAMEDI'],
  ],
  X49: [
    ['Le Râleur Abonné', 'Trente-huitième saison, et rien ne va toujours. Il a commencé à râler sur '
      + 'ceux qui râlent, ce qui l’occupe beaucoup.', 'DE MON TEMPS, DÉJÀ'],
    ['La Mauvaise Foi', 'Le club a mis une plaque à son nom sur son siège, de son vivant. Il a dit '
      + 'que la plaque était mal vissée. Il pleurait un peu.', 'ELLE EST DE TRAVERS'],
  ],
  X3: [
    ['Mosaïque à Deux Tribunes', 'Le dessin couvre deux virages et il faut quatre mille personnes '
      + 'pour le tenir. Vingt secondes de préparation, six secondes d’image.', 'DÉPLOIEMENT, TOUS'],
    ['La Mosaïque', 'Le stade entier, quatre couleurs, un dessin visible d’avion. La photo a fait le '
      + 'tour de l’Europe et personne ne sait qui l’a conçue.', 'TOUT LE STADE'],
  ],
  X13: [
    ['L’Agent Qui Connaît Tout le Monde', 'Il connaît vraiment quelqu’un, cette fois, et le transfert '
      + 's’est fait. On lui fait un peu plus confiance, et on a un peu tort.', 'J’AI CE QU’IL FAUT'],
    ['Le Carnet d’Adresses', 'Il a placé quatorze joueurs et il a refusé le poste de directeur '
      + 'sportif. Il préfère la tribune d’honneur et le téléphone.', 'JE M’EN OCCUPE'],
  ],
  X14: [
    ['Le Siffleur Entendu', 'On l’a entendu, une fois, un soir de coupe, et le stade s’est tu. '
      + 'Personne ne l’a toujours pas vu.', 'DEUX COUPS DE SIFFLET'],
    ['Le Souterrain', 'Le virage siffle avec lui à la 74e, tous les matchs, depuis onze ans. Ceux '
      + 'qui ont commencé ne savent plus pourquoi.', 'ON SIFFLE TOUS'],
  ],
  X40: [
    ['La Radio du Virage', 'Six mille auditeurs, un banc en plastique, toujours la pluie. Elle a '
      + 'refusé deux fois une place en cabine chauffée.', 'ET IL Y A BUT, ENCORE'],
    ['La Voix du Samedi', 'Trois générations ont appris les buts par sa voix. Le club diffuse son '
      + 'commentaire dans le stade, en direct, sur le but du titre.', 'ET LÀ, ÇA Y EST'],
  ],
  X30: [
    ['Le Videur Assis', 'Il n’a toujours jamais eu à se lever, et maintenant il a une chaise. C’est '
      + 'la promotion la plus discrète de l’histoire du club.', 'TOUJOURS PAS PAR ICI'],
    ['La Porte', 'Il n’est plus là. La porte est ouverte et personne n’essaie de passer, par respect '
      + 'ou par prudence. Ça marche depuis six ans.', 'IL EST PASSÉ QUELQU’UN ?'],
  ],
  X32: [
    ['La Mascotte à Deux Panneaux', 'Elle en porte deux, et personne ne sait toujours ce qu’ils '
      + 'annoncent. Le virage les lit à voix haute et invente la suite.', 'ATTENTION, ENCORE DES TRAVAUX'],
    ['Le Chantier', 'Elle a un gilet, un casque, un plan et une équipe. La nouvelle buvette est '
      + 'd’elle. Elle n’a toujours rien expliqué à personne.', 'C’EST BIENTÔT FINI'],
  ],
};
