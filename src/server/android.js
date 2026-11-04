/**
 * L'appli Android du Play Store (TWA, fabriquée avec Bubblewrap : voir android/).
 *
 * L'appli n'est qu'une coquille qui ouvre thebestfan.online en plein écran.
 * Pour que Chrome la croie et cache la barre d'adresse, le site doit dire
 * « cette appli est à moi » dans `/.well-known/assetlinks.json` (Digital Asset
 * Links). Ce fichier porte le nom du paquet et l'empreinte SHA-256 de la clé
 * qui signe l'appli ; avec le Play Store, c'est la clé de Google, lue dans la
 * Play Console (Intégrité de l'appli › Signature de l'appli).
 *
 * Réglé par l'environnement du serveur, pas par le code, parce que
 * l'empreinte n'est connue qu'une fois l'appli créée dans la Play Console :
 *
 *   ANDROID_PAQUET=online.thebestfan.app
 *   ANDROID_SHA256=AB:CD:...   (plusieurs séparées par des virgules : la clé
 *                               de Google et la clé d'envoi, par exemple)
 *
 * Sans ANDROID_SHA256, la route répond 404 : le site web ne change en rien.
 */
export const PAQUET_PAR_DEFAUT = 'online.thebestfan.app';

const EMPREINTE = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;

export function assetlinks(env = process.env) {
  const empreintes = String(env.ANDROID_SHA256 || '')
    .split(',')
    .map((e) => e.trim().toUpperCase())
    .filter((e) => EMPREINTE.test(e));
  if (!empreintes.length) return null;
  return [{
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: String(env.ANDROID_PAQUET || PAQUET_PAR_DEFAUT).trim(),
      sha256_cert_fingerprints: empreintes,
    },
  }];
}

export function routeAssetlinks(app, env = process.env) {
  app.get('/.well-known/assetlinks.json', (_req, res) => {
    const liens = assetlinks(env);
    if (!liens) return res.status(404).type('text/plain').send('pas d’appli Android');
    res.set('cache-control', 'public, max-age=3600');
    res.json(liens);
  });
}
