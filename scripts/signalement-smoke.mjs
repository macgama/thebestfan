/**
 * « Signaler un problème » : la route qui envoie le message d'un joueur à
 * Gaël. Sans base ni SMTP : un faux mailer retient ce qu'on lui confie, et une
 * fausse base répond aux comptes administrateurs.
 */
import { createServer } from 'node:http';
import express from 'express';
import { createSignalement, PAR_HEURE } from '../src/server/signalement/index.js';

let fautes = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) fautes += 1; };

const envoyes = [];
const mailer = { sendSignalement: async (m) => { envoyes.push(m); return { delivered: true }; } };
const pool = { execute: async () => [[{ email: 'gael@exemple.ch' }]] };
let connecte = true;
const requireAuth = (req, res, next) => {
  if (!connecte) return res.status(401).json({ error: 'auth.error.unauthenticated' });
  req.user = { id: 'u1', pseudo: 'Testeur', email: 'testeur@exemple.ch', locale: 'fr' };
  next();
};

async function monter(destinataires) {
  const app = express();
  app.use('/api/signalement', createSignalement({ pool, requireAuth, mailer, destinataires }).router);
  const http = createServer(app);
  await new Promise((r) => http.listen(0, r));
  const base = `http://localhost:${http.address().port}`;
  const poster = async (body) => {
    const r = await fetch(`${base}/api/signalement`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return { status: r.status, json: await r.json().catch(() => ({})) };
  };
  return { http, poster };
}

{
  const { http, poster } = await monter('');
  let r = await poster({ texte: 'Le deck ne s’enregistre pas.', page: '/deck', ecran: '384×832 @3',
    navigateur: 'Chrome Android', langue: 'fr', construction: 'abc123' });
  check('un signalement part', r.status === 200 && r.json.ok === true && envoyes.length === 1);
  const m = envoyes[0];
  check('vers les administrateurs, sans SIGNALEMENTS_A', m?.to === 'gael@exemple.ch');
  check('la réponse va au joueur', m?.replyTo === 'testeur@exemple.ch');
  check('le texte est intact', m?.texte === 'Le deck ne s’enregistre pas.');
  check('le contexte dit la page, l’écran, le navigateur et la version',
    /Page : \/deck/.test(m?.contexte) && /384×832/.test(m?.contexte)
    && /Chrome Android/.test(m?.contexte) && /version bêta — .*\(abc123\)/.test(m?.contexte));
  if (!/Page : \/deck/.test(m?.contexte)) console.log('        contexte :', m?.contexte);

  r = await poster({ texte: 'oui' });
  check('un message trop court est refusé', r.status === 400 && r.json.error === 'signalement.error.trop_court');
  r = await poster({ texte: 'x'.repeat(5000) });
  check('un message trop long est coupé à 2000 signes', r.status === 200 && envoyes.at(-1).texte.length === 2000);

  for (let i = envoyes.length; i < PAR_HEURE; i++) await poster({ texte: `message numéro ${i}` });
  r = await poster({ texte: 'un de trop pour cette heure' });
  check(`au-delà de ${PAR_HEURE} par heure, il attend`, r.status === 429 && envoyes.length === PAR_HEURE);

  connecte = false;
  r = await poster({ texte: 'un visiteur qui écrit' });
  check('il faut être connecté', r.status === 401);
  connecte = true;
  await new Promise((res) => http.close(res));
}

{
  envoyes.length = 0;
  const { http, poster } = await monter('a@exemple.ch, b@exemple.ch');
  await poster({ texte: 'Avec des destinataires posés.' });
  check('SIGNALEMENTS_A prime sur les administrateurs', envoyes[0]?.to === 'a@exemple.ch, b@exemple.ch');
  await new Promise((res) => http.close(res));
}

console.log(`\n${fautes ? `${fautes} échec(s)` : 'tout est vert'}`);
process.exit(fautes ? 1 : 0);
