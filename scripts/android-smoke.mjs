/**
 * L'appli Android : /.well-known/assetlinks.json n'existe que si l'empreinte
 * est posée, et dit exactement ce que Chrome attend.
 */
import assert from 'node:assert/strict';
import express from 'express';
import { assetlinks, routeAssetlinks, PAQUET_PAR_DEFAUT, EMPREINTES_PAR_DEFAUT } from '../src/server/android.js';

const E = 'ab:'.repeat(31) + 'cd';
assert.equal(assetlinks({ ANDROID_SHA256: '' }), null, 'empreinte vidée : rien');
assert.equal(assetlinks({})[0].target.sha256_cert_fingerprints[0], EMPREINTES_PAR_DEFAUT[0], 'sans réglage : la clé d’envoi');
assert.equal(assetlinks({ ANDROID_SHA256: 'pas-une-empreinte' }), null, 'empreinte mal formée ignorée');
const l = assetlinks({ ANDROID_SHA256: `${E}, ${E.replace('CD', 'EF')}` });
assert.equal(l[0].target.package_name, PAQUET_PAR_DEFAUT);
assert.deepEqual(l[0].relation, ['delegate_permission/common.handle_all_urls']);
assert.equal(l[0].target.sha256_cert_fingerprints.length, 2);
assert.equal(l[0].target.sha256_cert_fingerprints[0], E.toUpperCase());

async function appeler(env) {
  const app = express();
  routeAssetlinks(app, env);
  const srv = app.listen(0);
  await new Promise((r) => srv.once('listening', r));
  try {
    const r = await fetch(`http://127.0.0.1:${srv.address().port}/.well-known/assetlinks.json`);
    return { statut: r.status, type: r.headers.get('content-type'), corps: await r.text() };
  } finally { srv.close(); }
}
const absent = await appeler({ ANDROID_SHA256: '' });
assert.equal(absent.statut, 404);
const present = await appeler({ ANDROID_SHA256: E, ANDROID_PAQUET: 'online.thebestfan.essai' });
assert.equal(present.statut, 200);
assert.match(present.type, /application\/json/);
assert.equal(JSON.parse(present.corps)[0].target.package_name, 'online.thebestfan.essai');
console.log('android:smoke ok');
