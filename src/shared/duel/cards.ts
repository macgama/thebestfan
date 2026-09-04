import type { CardDef } from './protocol.js';

/**
 * Catalogue mécanique. Aucun libellé ici : les noms, clubs et textes de chants
 * sont dans src/shared/i18n/duel.json sous les clés `card.<id>.name`,
 * `card.<id>.club` et `chant.<chantId>.name` / `.text`.
 *
 * À terme ce tableau est chargé depuis la table `cards` (MariaDB) au démarrage
 * du serveur. Il reste ici pour que le moteur soit testable hors base.
 */
export const CARDS: CardDef[] = [
  { id: 'VN-001', set: 'VN', type: 'fide', frv: 60, retreat: 1, weakness: 'pyro', rarity: 'd1',
    chants: [{ id: 'c-armes', cost: ['fide'], power: 20 }] },
  { id: 'VN-002', set: 'VN', type: 'perc', frv: 70, retreat: 2, weakness: 'voix', rarity: 'd1',
    chants: [{ id: 'c-roulement', cost: ['perc'], power: 20 },
             { id: 'c-cadence', cost: ['perc', 'any'], power: 40 }] },
  { id: 'VN-003', set: 'VN', type: 'pyro', frv: 70, retreat: 1, weakness: 'depl', rarity: 'd1',
    chants: [{ id: 'c-craquage', cost: ['pyro'], power: 30, effect: { kind: 'self_damage', amount: 10 } }] },
  { id: 'VN-004', set: 'VN', type: 'voix', frv: 60, retreat: 1, weakness: 'tifo', rarity: 'd1',
    chants: [{ id: 'c-reprise', cost: ['voix'], power: 20 }] },
  { id: 'VN-005', set: 'VN', type: 'tifo', frv: 50, retreat: 1, weakness: 'pyro', rarity: 'd1',
    chants: [{ id: 'c-deploiement', cost: ['tifo'], power: 10, effect: { kind: 'shield', amount: 20 } }] },
  { id: 'VN-006', set: 'VN', type: 'pyro', frv: 110, retreat: 2, weakness: 'depl', rarity: 'd2',
    chants: [{ id: 'c-nappe', cost: ['pyro', 'any'], power: 40, effect: { kind: 'block_retreat' } },
             { id: 'c-embrasement', cost: ['pyro', 'pyro', 'any'], power: 90 }] },
  { id: 'VN-007', set: 'VN', type: 'voix', frv: 120, retreat: 2, weakness: 'tifo', rarity: 'd2',
    chants: [{ id: 'c-ola', cost: ['voix'], power: 30 },
             { id: 'c-mur', cost: ['voix', 'voix', 'any'], power: 80, effect: { kind: 'bonus_if_leading', amount: 20 } }] },
  { id: 'VN-008', set: 'VN', type: 'fide', frv: 150, retreat: 3, weakness: 'pyro', rarity: 'd3',
    chants: [{ id: 'c-onetaitla', cost: ['fide', 'any'], power: 50, effect: { kind: 'heal', amount: 20 } },
             { id: 'c-cinquante', cost: ['fide', 'fide', 'any'], power: 110 }] },
  { id: 'VN-009', set: 'VN', type: 'voix', frv: 140, retreat: 2, weakness: 'tifo', rarity: 'star',
    chants: [{ id: 'c-megaphone', cost: ['voix', 'any'], power: 50 },
             { id: 'c-toutlevirage', cost: ['voix', 'voix', 'any'], power: 120 }] },
  { id: 'VN-010', set: 'VN', type: 'tifo', frv: 180, retreat: 3, weakness: 'pyro', rarity: 'crown',
    chants: [{ id: 'c-mosaique', cost: ['tifo', 'tifo'], power: 60, effect: { kind: 'shield', amount: 30 } },
             { id: 'c-frisson', cost: ['tifo', 'tifo', 'any'], power: 140 }] },

  { id: 'NE-001', set: 'NE', type: 'depl', frv: 60, retreat: 1, weakness: 'perc', rarity: 'd1',
    chants: [{ id: 'c-peage', cost: ['depl'], power: 20 }] },
  { id: 'NE-002', set: 'NE', type: 'depl', frv: 70, retreat: 2, weakness: 'perc', rarity: 'd1',
    chants: [{ id: 'c-klaxons', cost: ['depl', 'any'], power: 30 }] },
  { id: 'NE-003', set: 'NE', type: 'fide', frv: 60, retreat: 1, weakness: 'pyro', rarity: 'd1',
    chants: [{ id: 'c-presents', cost: ['fide'], power: 20 }] },
  { id: 'NE-004', set: 'NE', type: 'pyro', frv: 70, retreat: 1, weakness: 'depl', rarity: 'd1',
    chants: [{ id: 'c-torche', cost: ['pyro'], power: 30, effect: { kind: 'self_damage', amount: 10 } }] },
  { id: 'NE-005', set: 'NE', type: 'tifo', frv: 50, retreat: 1, weakness: 'pyro', rarity: 'd1',
    chants: [{ id: 'c-consignes', cost: ['tifo'], power: 10, effect: { kind: 'shield', amount: 20 } }] },
  { id: 'NE-006', set: 'NE', type: 'perc', frv: 100, retreat: 2, weakness: 'voix', rarity: 'd2',
    chants: [{ id: 'c-contretemps', cost: ['perc', 'any'], power: 40 },
             { id: 'c-tempo', cost: ['perc', 'perc', 'any'], power: 90, effect: { kind: 'block_retreat' } }] },
  { id: 'NE-007', set: 'NE', type: 'voix', frv: 110, retreat: 2, weakness: 'tifo', rarity: 'd2',
    chants: [{ id: 'c-maree', cost: ['voix'], power: 30 },
             { id: 'c-houle', cost: ['voix', 'voix'], power: 70 }] },
  { id: 'NE-008', set: 'NE', type: 'tifo', frv: 140, retreat: 3, weakness: 'pyro', rarity: 'd3',
    chants: [{ id: 'c-surprise', cost: ['tifo', 'any'], power: 50 },
             { id: 'c-toutelatribune', cost: ['tifo', 'tifo', 'any'], power: 100 }] },
  { id: 'NE-009', set: 'NE', type: 'depl', frv: 130, retreat: 2, weakness: 'perc', rarity: 'star',
    chants: [{ id: 'c-echo', cost: ['depl', 'any'], power: 50, effect: { kind: 'shield', amount: 20 } },
             { id: 'c-venuspourca', cost: ['depl', 'depl', 'any'], power: 110 }] },
  { id: 'NE-010', set: 'NE', type: 'pyro', frv: 190, retreat: 3, weakness: 'depl', rarity: 'crown',
    chants: [{ id: 'c-craquagetotal', cost: ['pyro', 'pyro'], power: 70, effect: { kind: 'self_damage', amount: 20 } },
             { id: 'c-prolongations', cost: ['pyro', 'pyro', 'any'], power: 150, effect: { kind: 'bonus_late', amount: 40, fromMinute: 75 } }] },
];

export const CARD_BY_ID = new Map(CARDS.map((c) => [c.id, c]));

export function cardDef(id: string): CardDef {
  const c = CARD_BY_ID.get(id);
  if (!c) throw new Error(`carte inconnue: ${id}`);
  return c;
}
