/**
 * Noms des groupes et des chants.
 *
 * Ils ne sont pas traduits, et c'est volontaire : ce sont des noms propres de
 * groupes fictifs, comme le sont les noms de clubs. Un supporter allemand lit
 * « Brigade Nord 1987 » exactement comme un français. Seule l'interface autour
 * change de langue.
 */
export const CARD_NAMES: Record<string, { name: string; club: string }> = {
  'VN-001': { name: 'Écharpes du Bloc C', club: 'AS Havreville' },
  'VN-002': { name: 'Tambours de Sallanches', club: 'FC Sallanches' },
  'VN-003': { name: 'Brigade Nord 1987', club: 'AS Havreville' },
  'VN-004': { name: 'Kop du Lac', club: 'Olympique de Verdonne' },
  'VN-005': { name: 'Bâche & Peinture', club: 'FC Sallanches' },
  'VN-006': { name: 'Commando Grillon', club: 'AS Havreville' },
  'VN-007': { name: 'Le Douzième Homme', club: 'Olympique de Verdonne' },
  'VN-008': { name: 'Vieille Garde 1974', club: 'AS Havreville' },
  'VN-009': { name: 'Capo di Curva', club: 'Olympique de Verdonne' },
  'VN-010': { name: 'Virage Nord au complet', club: 'AS Havreville' },
  'NE-001': { name: 'Convoi 4h du Mat', club: 'Racing Bréval' },
  'NE-002': { name: 'Les Cars Bleus', club: 'Racing Bréval' },
  'NE-003': { name: 'Section Cendrée', club: 'Union Portelle' },
  'NE-004': { name: 'Fumigènes de Verdon', club: 'Olympique de Verdonne' },
  'NE-005': { name: 'Mosaïque Populaire', club: 'Union Portelle' },
  'NE-006': { name: 'Grosse Caisse Sud', club: 'Union Portelle' },
  'NE-007': { name: 'Tribune Océane', club: 'Racing Bréval' },
  'NE-008': { name: 'Bâcheurs Nocturnes', club: 'Union Portelle' },
  'NE-009': { name: 'Parcage 400 places', club: 'Racing Bréval' },
  'NE-010': { name: 'La Nuit du 8e de finale', club: 'Racing Bréval' },
};

export const CHANT_NAMES: Record<string, string> = {
  'c-armes': 'Lever les bras', 'c-roulement': 'Roulement', 'c-cadence': 'Cadence',
  'c-craquage': 'Craquage', 'c-reprise': 'Reprise', 'c-deploiement': 'Déploiement',
  'c-nappe': 'Nappe de fumée', 'c-embrasement': 'Embrasement', 'c-ola': 'Ola',
  'c-mur': 'Mur du son', 'c-onetaitla': 'On était là', 'c-cinquante': 'Cinquante ans de tribune',
  'c-megaphone': 'Mégaphone', 'c-toutlevirage': 'Tout le virage', 'c-mosaique': 'Mosaïque géante',
  'c-frisson': 'Frisson', 'c-peage': 'Premier péage', 'c-klaxons': 'Klaxons',
  'c-presents': 'Présents', 'c-torche': 'Torche', 'c-consignes': 'Consignes',
  'c-contretemps': 'Contretemps', 'c-tempo': 'Tempo infernal', 'c-maree': 'Marée',
  'c-houle': 'Grande houle', 'c-surprise': 'Bâche surprise', 'c-toutelatribune': 'Toute la tribune',
  'c-echo': 'Écho du parcage', 'c-venuspourca': 'On est venus pour ça',
  'c-craquagetotal': 'Craquage total', 'c-prolongations': 'Prolongations',
};

export const cardName = (id: string) => CARD_NAMES[id]?.name ?? id;
export const cardClub = (id: string) => CARD_NAMES[id]?.club ?? '';
export const chantName = (id: string) => CHANT_NAMES[id] ?? id;
