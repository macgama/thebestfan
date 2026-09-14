-- Les identités que l’amorçage ne sait pas corriger.
--
-- Le catalogue s’amorce en `INSERT IGNORE` depuis `dex.js`, pour ne pas
-- écraser les corrections faites à l’écran d’administration. La contrepartie
-- est rarement énoncée : **changer le nom, l’histoire ou le cri d’une carte
-- existante dans le code ne change rien.** La ligne est déjà là, `IGNORE`
-- l’ignore, et le jeu affiche toujours l’ancienne version — sans erreur et
-- sans trace.
--
-- Ce fichier rattrape 29 carte(s), et elles seulement. Une
-- réécriture en masse du catalogue effacerait les corrections faites à
-- l’écran, qui sont la raison d’être de cette table.
--
-- Produit par scripts/fanzzy-identites.mjs en comparant le code à la base.
-- Ne pas modifier à la main.

START TRANSACTION;

-- MS31B — Bâcheur Nocturne
UPDATE fanzzy SET cri = '{"label":"BÂCHE SURPRISE","gest":"tifo","power":62}'
  WHERE id = 'MS31B';

-- MS31C — Chef Tifo
UPDATE fanzzy SET cri = '{"label":"MOSAÏQUE GÉANTE","gest":"tifo","power":74}'
  WHERE id = 'MS31C';

-- MS32B — Conducteur de car
UPDATE fanzzy SET cri = '{"label":"KLAXONS","gest":"echarpe","power":64}'
  WHERE id = 'MS32B';

-- MS32C — Convoi 4h du Mat
UPDATE fanzzy SET cri = '{"label":"ON EST VENUS POUR ÇA","gest":"echarpe","power":76}'
  WHERE id = 'MS32C';

-- TR37 — Le Faux Départ
UPDATE fanzzy SET nom = 'Le Faux Départ', histoire = 'Il lance le chant trois secondes trop tôt, tout seul, et sa voix retombe dans le silence. Une fois sur dix la tribune part avec lui, et c’est ce soir-là qu’on raconte.', cri = '{"label":"TROP TÔT","gest":"tempo","power":58}'
  WHERE id = 'TR37';

-- TR37B — Le Bon Moment
UPDATE fanzzy SET nom = 'Le Bon Moment', histoire = 'Il a appris à compter jusqu’à trois avant d’ouvrir la bouche. Il lance deux fois moins souvent, et on le suit presque toujours.', cri = '{"label":"LÀ, C’EST LÀ","gest":"tempo","power":70}'
  WHERE id = 'TR37B';

-- TR37C — Le Silence d’Avant
UPDATE fanzzy SET nom = 'Le Silence d’Avant', histoire = 'Il ne lance plus rien : il lève la main, et deux mille personnes se taisent en même temps. Ce silence-là dure ce qu’il veut, et c’est devenu le plus beau moment du match.', cri = '{"label":"QUAND JE LÈVE LA MAIN","gest":"tempo","power":84}'
  WHERE id = 'TR37C';

-- TR39 — Celui Qui Reste
UPDATE fanzzy SET nom = 'Celui Qui Reste', histoire = 'Il est encore assis vingt minutes après le coup de sifflet, seul dans sa rangée, face à une pelouse qu’on arrose déjà. Il n’attend rien. Il n’est juste pas pressé.', cri = '{"label":"ENCORE CINQ MINUTES","gest":"hold","power":58}'
  WHERE id = 'TR39';

-- TR48 — Le Carré à l’Envers
UPDATE fanzzy SET nom = 'Le Carré à l’Envers', histoire = 'Dans chaque mosaïque il y a un carton retourné, et c’est toujours le sien. Le virage a arrêté de lui en vouloir : on le cherche des yeux avant de chercher le dessin.', cri = '{"label":"JE L’AI À L’ENVERS","gest":"mosaique","power":56}'
  WHERE id = 'TR48';

-- TR51 — La Note Qui Casse
UPDATE fanzzy SET nom = 'La Note Qui Casse', histoire = 'Il monte avec tout le monde et sa voix lâche toujours au même endroit. Le virage a fini par attendre ce moment-là, et plus personne ne chante la note juste.', cri = '{"label":"ÇA VA CASSER","gest":"contretemps","power":50}'
  WHERE id = 'TR51';

-- TR52 — Le Râleur du Rang B
UPDATE fanzzy SET cri = '{"label":"RIEN NE VA","gest":"retenue","power":58}'
  WHERE id = 'TR52';

-- IM10 — Le Drapeau Perdu
UPDATE fanzzy SET nom = 'Le Drapeau Perdu', histoire = 'Un drapeau d’un club de troisième division d’un autre pays, agité au coin du virage par quelqu’un que personne ne connaît. Il vient à tous les matchs.', cri = '{"label":"CE N’EST PAS LE BON","gest":"tifo","power":60}'
  WHERE id = 'IM10';

-- IM11 — Le Marteau-Piqueur
UPDATE fanzzy SET nom = 'Le Marteau-Piqueur', histoire = 'Le chantier du parvis n’a jamais fini et il travaille aussi le samedi. À la trente-huitième minute, il est tombé pile sur le tempo du virage, et deux mille personnes ont chanté avec lui.', cri = '{"label":"TAC TAC TAC","gest":"mash","power":47}'
  WHERE id = 'IM11';

-- TR18 — Le Mégaphone
UPDATE fanzzy SET histoire = 'Il lance les chants et il ne les termine jamais : c’est le virage qui les finit. Sa voix tient une mi-temps, pas deux.', cri = '{"label":"TOUS AVEC MOI","gest":"capo","power":71}'
  WHERE id = 'TR18';

-- TR19 — Le Tambour de Guerre
UPDATE fanzzy SET histoire = 'Il frappe avec deux maillets et il frappe fort. Les gens autour de lui n’entendent plus rien pendant deux jours et reviennent quand même.', cri = '{"label":"LE SOL TREMBLE","gest":"crescendo","power":72}'
  WHERE id = 'TR19';

-- MS5 — La Stadière
UPDATE fanzzy SET histoire = 'Elle regarde le virage, pas le terrain, pendant quatre-vingt-dix minutes. Elle sait avant tout le monde quand une tribune va basculer.', cri = '{"label":"ON SE CALME","gest":"tifo","power":60}'
  WHERE id = 'MS5';

-- MS19 — Le Juge de Touche
UPDATE fanzzy SET histoire = 'Il court la ligne depuis vingt ans sans avoir jamais eu raison, selon la tribune. Il lève son drapeau quand même.', cri = '{"label":"HORS-JEU","gest":"mosaique","power":60}'
  WHERE id = 'MS19';

-- BG27 — Les Neuf Minutes
UPDATE fanzzy SET nom = 'Les Neuf Minutes'
  WHERE id = 'BG27';

-- VP1 — Le Chat Person Snob
UPDATE fanzzy SET cri = '{"label":"MOINS FORT, MERCI","gest":"hold","power":44}'
  WHERE id = 'VP1';

-- TR39B — Le Dernier à Sortir
UPDATE fanzzy SET nom = 'Le Dernier à Sortir', histoire = 'Le stadier a arrêté de lui demander de partir : il lui laisse la rangée et va fumer. Ils se disent au revoir, chaque samedi, à la même heure.', cri = '{"label":"ON FERME","gest":"hold","power":71}'
  WHERE id = 'TR39B';

-- TR39C — Le Gardien des Clés
UPDATE fanzzy SET nom = 'Le Gardien des Clés', histoire = 'Le club lui a donné un trousseau, officiellement pour vérifier les portes. C’est surtout pour qu’il puisse rester aussi longtemps qu’il veut, et tout le monde le sait.', cri = '{"label":"LES CLÉS","gest":"hold","power":84}'
  WHERE id = 'TR39C';

-- TR48B — Le Carré Retourné
UPDATE fanzzy SET nom = 'Le Carré Retourné', histoire = 'Il a compris le jour où quelqu’un lui a tenu le poignet avant le déploiement. Son carton est à l’endroit depuis, et la mosaïque est parfaite. Elle est moins drôle.', cri = '{"label":"J’AI COMPRIS","gest":"mosaique","power":69}'
  WHERE id = 'TR48B';

-- TR48C — Celui Qui Distribue
UPDATE fanzzy SET nom = 'Celui Qui Distribue', histoire = 'C’est lui qui pose les cartons rangée par rangée, la veille au soir, tout seul. Il en retourne un exprès, quelque part, et il ne dit jamais lequel.', cri = '{"label":"TOURNEZ-LE","gest":"mosaique","power":82}'
  WHERE id = 'TR48C';

-- TR51B — La Note Placée
UPDATE fanzzy SET nom = 'La Note Placée', histoire = 'Il a trouvé où poser sa voix et il ne casse plus. Trois rangées lui ont demandé de recommencer comme avant.', cri = '{"label":"JE LA TIENS","gest":"contretemps","power":63}'
  WHERE id = 'TR51B';

-- TR51C — La Fausse Note Officielle
UPDATE fanzzy SET nom = 'La Fausse Note Officielle', histoire = 'Le virage casse la note avec lui, tous ensemble, à chaque reprise. C’est devenu la façon dont ce chant se chante ici, et les visiteurs ne comprennent jamais.', cri = '{"label":"CASSEZ-LA AVEC MOI","gest":"contretemps","power":76}'
  WHERE id = 'TR51C';

-- IM10B — Le Drapeau Adopté
UPDATE fanzzy SET nom = 'Le Drapeau Adopté', histoire = 'Le virage a appris le nom du club et le chante une fois par match, au hasard, sans que personne sache pourquoi. Le club en question l’ignore complètement.', cri = '{"label":"ON L’A GARDÉ","gest":"tifo","power":73}'
  WHERE id = 'IM10B';

-- IM10C — Le Drapeau du Virage
UPDATE fanzzy SET nom = 'Le Drapeau du Virage', histoire = 'Il est en tête de cortège depuis quatre ans. Deux clubs se réclament de lui, et il n’appartient toujours à personne.', cri = '{"label":"IL EST DES DEUX","gest":"tifo","power":86}'
  WHERE id = 'IM10C';

-- IM11B — Le Chantier au Rythme
UPDATE fanzzy SET nom = 'Le Chantier au Rythme', histoire = 'Les ouvriers ont compris et ils le font exprès. Ils frappent avec le virage pendant toute la première mi-temps, puis ils s’arrêtent pour regarder le match.', cri = '{"label":"ON SUIT LE RYTHME","gest":"mash","power":60}'
  WHERE id = 'IM11B';

-- IM11C — La Grue Qui Salue
UPDATE fanzzy SET nom = 'La Grue Qui Salue', histoire = 'Le chantier est fini depuis deux ans. La grue est restée : le club l’a rachetée et elle salue le virage avant chaque coup d’envoi.', cri = '{"label":"ON A FINI","gest":"mash","power":73}'
  WHERE id = 'IM11C';

COMMIT;
