/** Les noms abîmés par l'API (« MartÃ­nez ») et ceux qu'il ne faut pas toucher. */
import { reparerTexte } from '../src/shared/texte-repare.js';

let echecs = 0;
const egal = (entree, attendu) => {
  const vu = reparerTexte(entree);
  const ok = vu === attendu;
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${JSON.stringify(entree)} → ${JSON.stringify(vu)}`);
  if (!ok) echecs++;
};

egal('Dani MartÃ­nez', 'Dani Martínez');
egal('Ã\u0081lex Baena', 'Álex Baena');
egal('JoÃ£o Cancelo', 'João Cancelo');
egal('FranÃ§ois', 'François');
egal('Dani Martínez', 'Dani Martínez');
egal('W. Szczęsny', 'W. Szczęsny');
egal('D. Livaković', 'D. Livaković');
egal('Ãlvarez', 'Ãlvarez');
egal('', '');
egal(null, null);
egal(undefined, undefined);

console.log(`\n${echecs ? `${echecs} échec(s)` : 'tout est vert'}`);
process.exit(echecs ? 1 : 0);
