/**
 * Payer par Google Play, dans l'appli Android du Play Store.
 *
 * Dans l'appli (une TWA), Chrome offre la Digital Goods API : c'est à elle
 * qu'on reconnaît qu'on y est. Sur le site, dans un onglet ou depuis l'icône,
 * elle n'existe pas : `disponible()` répond faux et la page paie par Stripe,
 * comme avant. Rien ne change donc pour le web.
 *
 *   TBF_GOOGLE.disponible()            → Promise<boolean>
 *   TBF_GOOGLE.acheter(article, saison) → Promise<{ ok } | { annule } | { erreur }>
 *
 * Le serveur décide de tout (voir src/server/boutique/index.js, « payer par
 * Google Play ») : la page n'envoie que l'article et, après paiement, le jeton
 * que Google lui a rendu.
 */
(function () {
  const METHODE = 'https://play.google.com/billing';
  let service; // Promise<DigitalGoodsService|null>

  function lireService() {
    if (service) return service;
    service = (async () => {
      if (typeof window.getDigitalGoodsService !== 'function' || !window.PaymentRequest) return null;
      try {
        return (await window.getDigitalGoodsService(METHODE)) || null;
      } catch {
        return null;
      }
    })();
    return service;
  }

  async function poster(url, corps) {
    const r = await fetch(url, {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corps),
    });
    const j = await r.json().catch(() => ({}));
    return { statut: r.status, ok: r.ok, ...j };
  }

  async function acheter(article, saison = null) {
    const dg = await lireService();
    if (!dg) return { erreur: 'boutique.error.non_configuree' };
    const base = saison ? { article, saison } : { article };

    /* 1. Le serveur refuse d'abord ce qu'il refuserait après : on ne fait pas
          payer un PASS qu'on ne pourrait pas livrer. */
    const avant = await poster('/api/boutique/google/avant', base);
    if (avant.statut === 401) return { connexion: true };
    if (!avant.ok || !avant.produit) return { erreur: avant.error || 'boutique.error.paiement_indisponible' };

    /* 2. La feuille de paiement de Google. */
    let reponse;
    try {
      const demande = new PaymentRequest(
        [{ supportedMethods: METHODE, data: { sku: avant.produit } }],
        { total: { label: 'Total', amount: { currency: 'EUR', value: '0' } } });
      reponse = await demande.show();
    } catch {
      return { annule: true };
    }
    const jeton = reponse?.details?.purchaseToken || reponse?.details?.token;
    if (!jeton) {
      await reponse?.complete?.('fail').catch(() => {});
      return { erreur: 'boutique.error.google_jeton' };
    }

    /* 3. Le serveur fait vérifier le jeton par Google, livre et consomme. */
    let fin;
    try {
      fin = await poster('/api/boutique/google', { ...base, jeton });
    } catch {
      fin = { ok: false, error: 'boutique.error.paiement_indisponible' };
    }
    await reponse.complete?.(fin.ok || fin.en_attente ? 'success' : 'fail').catch(() => {});
    if (fin.en_attente) return { en_attente: true };
    if (!fin.ok) return { erreur: fin.error || 'boutique.error.paiement_indisponible' };
    return { ok: true, livre: fin.livre };
  }

  window.TBF_GOOGLE = {
    disponible: () => lireService().then(Boolean),
    acheter,
  };
})();
