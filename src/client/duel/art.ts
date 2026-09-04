import type { Ambiance, CardDef } from '../../shared/duel/protocol.js';

/**
 * Illustrations générées, pas dessinées.
 *
 * Chaque carte produit toujours la même image : la graine vient de son
 * identifiant. Aucune ressource à télécharger, aucun crédit consommé, et un
 * rendu net à toutes les tailles. Les visuels définitifs les remplaceront
 * carte par carte sans rien changer au reste.
 */

export const AMBIANCE: Record<Ambiance, { color: string; label: string; icon: string }> = {
  pyro: { color: '#E0402C', label: 'Pyro', icon: 'M12 2c1 4-3 5-3 9a3 3 0 0 0 6 0c0-2-1-3-1-4 2 1 4 3 4 6a6 6 0 0 1-12 0c0-5 6-7 6-11z' },
  voix: { color: '#F5C33B', label: 'Voix', icon: 'M4 9v6h4l5 4V5L8 9H4zm12.5-1a5 5 0 0 1 0 8' },
  tifo: { color: '#8257DA', label: 'Tifo', icon: 'M4 4h16v12l-8-3-8 3V4z' },
  perc: { color: '#3C82E8', label: 'Percussion', icon: 'M12 6c5 0 8 1.5 8 3.5S17 13 12 13 4 11.5 4 9.5 7 6 12 6zm-8 4v5c0 2 3.5 3.5 8 3.5s8-1.5 8-3.5v-5' },
  depl: { color: '#1E9E6A', label: 'Déplacement', icon: 'M4 7h16v8H4zM4 15v3h3v-3m10 0v3h3v-3M6 10h12' },
  fide: { color: '#C2CAD6', label: 'Fidélité', icon: 'M12 21s-7-4.4-7-9.5A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 3.5C19 16.6 12 21 12 21z' },
};

/** Ambiance d'un coût : 'any' est un souffle incolore. */
export const costColor = (c: string) => (c === 'any' ? '#B9B2A0' : AMBIANCE[c as Ambiance].color);

function seeded(str: string) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

const MOTIFS = ['smoke', 'banner', 'drums', 'bus', 'mosaic', 'scarf', 'flares', 'night'] as const;
let uid = 0;

export function cardArt(card: CardDef): string {
  const r = seeded(card.id);
  const tc = AMBIANCE[card.type].color;
  const u = 'a' + uid++;
  const motif = MOTIFS[Math.floor(r() * MOTIFS.length)];

  let s = `<svg viewBox="0 0 128 100" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="sky${u}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#16202C"/><stop offset="1" stop-color="#05080C"/></linearGradient>
    <radialGradient id="halo${u}"><stop offset="0" stop-color="${tc}" stop-opacity=".5"/>
      <stop offset="1" stop-color="${tc}" stop-opacity="0"/></radialGradient>
    <filter id="bl${u}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3.2"/></filter>
  </defs>
  <rect width="128" height="100" fill="url(#sky${u})"/>
  <g opacity=".5">
    <polygon points="16,-4 30,-4 58,66 4,66" fill="#F5C33B" opacity=".10"/>
    <polygon points="98,-4 112,-4 124,66 70,66" fill="#F5C33B" opacity=".10"/>
    <circle cx="23" cy="2" r="7" fill="#F5C33B" opacity=".5" filter="url(#bl${u})"/>
    <circle cx="105" cy="2" r="7" fill="#F5C33B" opacity=".5" filter="url(#bl${u})"/></g>
  <circle cx="64" cy="86" r="52" fill="url(#halo${u})" opacity=".7"/>`;

  if (motif === 'mosaic') {
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 16; x++) {
        const on = Math.abs(x - 7.5) < 2 + y * 0.9 && y < 4;
        s += `<rect x="${x * 8}" y="${18 + y * 7}" width="7" height="6" fill="${on ? tc : '#E8E3D6'}" opacity="${(0.35 + r() * 0.5).toFixed(2)}"/>`;
      }
    }
  }
  if (motif === 'banner') {
    const ini = card.id.replace('-', '');
    s += `<g transform="translate(64,44) rotate(-1.5)">
      <rect x="-46" y="-15" width="92" height="30" fill="#E9E3D4" stroke="#1A1F27" stroke-width="1.2"/>
      <text x="0" y="7" text-anchor="middle" font-family="Oswald,Impact,sans-serif" font-size="17"
        fill="${tc}" letter-spacing="2">${ini}</text></g>`;
  }
  if (motif === 'drums') {
    for (let i = 0; i < 3; i++) {
      const cx = 34 + i * 30;
      const cy = 48 + (r() * 6 - 3);
      s += `<ellipse cx="${cx}" cy="${cy.toFixed(1)}" rx="13" ry="12" fill="#E9E3D4" stroke="${tc}" stroke-width="2.4"/>
        <path d="M${cx - 13} ${cy.toFixed(1)}h26M${cx} ${(cy - 12).toFixed(1)}v24" stroke="${tc}" stroke-width="1.4" opacity=".7"/>`;
    }
  }
  if (motif === 'bus') {
    s += `<g transform="translate(20,40)"><rect x="0" y="0" width="88" height="30" rx="4" fill="#12202F" stroke="${tc}" stroke-width="1.6"/>`;
    for (let i = 0; i < 7; i++) {
      s += `<rect x="${6 + i * 11}" y="6" width="8" height="9" fill="#F5C33B" opacity="${(0.35 + r() * 0.6).toFixed(2)}"/>`;
    }
    s += `<circle cx="18" cy="31" r="5" fill="#05080C"/><circle cx="72" cy="31" r="5" fill="#05080C"/></g>`;
  }

  // Tribune en gradins, puis la foule.
  let steps = 'M0 100';
  for (let i = 0; i < 9; i++) {
    steps += `L${(i * 14.5).toFixed(1)} ${(100 - i * 4.4).toFixed(1)}L${((i + 1) * 14.5).toFixed(1)} ${(100 - i * 4.4).toFixed(1)}`;
  }
  s += `<path d="${steps}L128 100Z" fill="#080B10" opacity=".92"/>`;

  for (let row = 0; row < 4; row++) {
    const y = 92 - row * 8;
    for (let i = 0; i < 15; i++) {
      const x = 4 + i * 8.6 + r() * 3;
      s += `<circle cx="${x.toFixed(1)}" cy="${y}" r="${(2.1 + r() * 0.7).toFixed(1)}" fill="${r() > 0.9 ? tc : '#1C2530'}"/>`;
      if (r() > 0.55) {
        s += `<path d="M${(x - 2).toFixed(1)} ${y} l-1.5 -5 M${(x + 2).toFixed(1)} ${y} l1.5 -5" stroke="#1C2530" stroke-width="1.4" stroke-linecap="round"/>`;
      }
    }
  }

  if (motif === 'scarf') {
    for (let i = 0; i < 11; i++) {
      const x = 6 + i * 11 + r() * 4;
      const y = 64 + r() * 14;
      s += `<path d="M${(x - 8).toFixed(1)} ${y.toFixed(1)} q8 -6 16 0" stroke="${tc}" stroke-width="3" fill="none" opacity="${(0.55 + r() * 0.45).toFixed(2)}" stroke-linecap="round"/>`;
    }
  }
  if (motif === 'smoke' || motif === 'flares') {
    const n = motif === 'flares' ? 7 : 4;
    for (let i = 0; i < n; i++) {
      s += `<ellipse cx="${(12 + r() * 104).toFixed(1)}" cy="${(52 + r() * 34).toFixed(1)}" rx="${(10 + r() * 16).toFixed(1)}" ry="${(8 + r() * 12).toFixed(1)}" fill="${tc}" opacity="${(0.16 + r() * 0.24).toFixed(2)}" filter="url(#bl${u})"/>`;
    }
    for (let i = 0; i < (motif === 'flares' ? 5 : 2); i++) {
      const x = (16 + r() * 96).toFixed(1);
      const y = (74 + r() * 16).toFixed(1);
      s += `<circle cx="${x}" cy="${y}" r="2.6" fill="#FFF3D0"/><circle cx="${x}" cy="${y}" r="7" fill="${tc}" opacity=".55" filter="url(#bl${u})"/>`;
    }
  }
  if (motif === 'night') {
    for (let i = 0; i < 26; i++) {
      const x = (r() * 128).toFixed(1);
      const y = (r() * 100).toFixed(1);
      s += `<line x1="${x}" y1="${y}" x2="${(Number(x) - 2).toFixed(1)}" y2="${(Number(y) + 7).toFixed(1)}" stroke="#9FB4C8" stroke-width=".7" opacity=".35"/>`;
    }
  }

  return s + `<rect width="128" height="100" fill="#000" opacity=".08"/></svg>`;
}
