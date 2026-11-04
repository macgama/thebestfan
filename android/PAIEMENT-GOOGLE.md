# Le paiement Google dans l'appli Android (à faire, à valider par Gaël)

Choix de Gaël (2026-11-04) : dans l'appli du Play Store, les achats passent par
Google Play ; sur le site, Stripe ne change pas.

## Ce qui est vendu

Seul le PASS de saison se paie en argent réel (`pass-saison`, 7,99 €,
src/shared/boutique.js). Les écharpes ne s'achètent pas. Côté Google, il n'y a
donc qu'un produit « achat unique consommable » `pass_saison` à créer dans la
Play Console (Monétiser › Produits intégrés), au prix équivalent.

## Le parcours

1. La page sait qu'elle tourne dans l'appli si `window.getDigitalGoodsService`
   existe et répond pour `https://play.google.com/billing`. Sinon : Stripe,
   comme aujourd'hui.
2. Bouton « Prendre le PASS » : `PaymentRequest` avec la méthode
   `https://play.google.com/billing` et `sku: 'pass_saison'`. Google affiche
   sa propre feuille de paiement.
3. La page envoie le `purchaseToken` reçu à `POST /api/boutique/google`.
4. Le serveur vérifie le jeton auprès de Google (Google Play Developer API,
   `purchases.products.get`, avec un compte de service), contrôle
   `purchaseState = 0` et le produit, puis livre par la même fonction
   `livrer()` que Stripe (une seule fois par jeton).
5. Le serveur « consomme » l'achat (`purchases.products.consume`) pour qu'un
   PASS de la saison suivante puisse être racheté.
6. Remboursements : notifications temps réel de Google (Pub/Sub) ou relecture
   des achats annulés (`voidedpurchases`), qui retirent le PASS comme le fait
   aujourd'hui un remboursement Stripe.

## Le schéma proposé (à valider avant de coder)

La table `achats` garde tout l'historique ; on y ajoute la provenance plutôt
que de créer une seconde table :

```sql
ALTER TABLE achats
  ADD COLUMN IF NOT EXISTS fournisseur ENUM('stripe','google') NOT NULL DEFAULT 'stripe' AFTER devise,
  ADD COLUMN IF NOT EXISTS google_jeton VARCHAR(1024) NULL AFTER stripe_session,
  ADD COLUMN IF NOT EXISTS google_commande VARCHAR(64) NULL AFTER google_jeton;
```

Pour un achat Google, `stripe_session` reçoit `google:<empreinte SHA-256 du
jeton>` : la clé unique existante empêche alors de livrer deux fois le même
jeton, sans index sur une colonne de 1 024 caractères.

## Ce que Gaël doit fournir

- Le compte développeur Google Play et l'appli créée (voir README.md).
- Le produit `pass_saison` créé et actif dans la Play Console.
- Un compte de service Google Cloud relié à la Play Console (Utilisateurs et
  autorisations › droit « Afficher les données financières, gérer les
  commandes »), sa clé JSON posée sur le serveur (`GOOGLE_PLAY_CLE`), jamais
  dans le dépôt.

Sources : https://developer.chrome.com/docs/android/trusted-web-activity/play-billing ,
https://chromeos.dev/en/publish/pwa-play-billing
