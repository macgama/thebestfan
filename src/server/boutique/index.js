/**
 * La boutique : Stripe Checkout, webhook, et livraison.
 *
 * ## Les trois règles, dans l'ordre d'importance
 *
 * **1. Le prix ne vient jamais du client.** La commande ne porte qu'un
 * identifiant d'article ; le montant est lu dans `CATALOGUE`, côté serveur.
 * Sans cela, il suffit de modifier un champ dans le navigateur pour s'acheter
 * douze boosters à un centime.
 *
 * **2. La livraison se fait dans le webhook, pas au retour du joueur.** La
 * page de retour est une politesse : elle dit merci. Elle n'est pas fiable —
 * on ferme l'onglet, on perd le réseau, on paie depuis un autre appareil. Le
 * seul événement qui dit « cet argent est arrivé » est celui que Stripe envoie
 * à notre serveur. Livrer au retour, c'est ne pas livrer à qui a fermé la page
 * et livrer deux fois à qui a rechargé.
 *
 * **3. Le webhook est rejoué, et il faut que ça ne change rien.** Stripe
 * renvoie le même événement jusqu'à ce qu'on réponde 200, et parfois même
 * après. La protection est une contrainte d'unicité en base sur
 * `stripe_session` — pas un `if` en JavaScript, que deux requêtes simultanées
 * franchissent toutes les deux.
 *
 * ## La signature, et pourquoi elle a besoin du corps brut
 *
 * Stripe signe **les octets qu'il a envoyés**. `express.json()` les transforme
 * en objet et les jette ; il ne reste plus rien à vérifier, et l'on accepte
 * alors n'importe quel appel prétendant venir de Stripe — c'est-à-dire qu'on
 * offre des boosters à qui connaît l'adresse. La route du webhook est donc
 * montée **avant** tout analyseur de corps, avec `express.raw`.
 *
 * ## Sans clés
 *
 * Tout fonctionne sauf le paiement : le catalogue se lit, la boutique
 * s'affiche, et la commande est refusée avec un code qui le dit. C'est voulu —
 * un écran qui s'écroule parce qu'une variable d'environnement manque est plus
 * dur à diagnostiquer qu'un refus nommé.
 */
import express from 'express';
import crypto from 'node:crypto';
import { CATALOGUE, ARTICLE_PAR_ID, LIVRAISONS_PAYANTES, MONNAIE, RAYONS, enEuros }
  from '../../shared/boutique.js';
import { etalStuff, etalTenues, prixDe } from '../../shared/etal.js';
import { STUFF_BY_ID } from '../../shared/fanzzy/inventaire.js';
import { tenuesPubliees } from '../fanzzy/tenues.js';

const API = 'https://api.stripe.com/v1';

export function createBoutique({ pool, requireAuth, fanzzy, site, abonnement = null }) {
  const q = (sql, args) => pool.query(sql, args).then(([r]) => r);

  const cle = () => process.env.STRIPE_SECRET_KEY || '';
  const secretHook = () => process.env.STRIPE_WEBHOOK_SECRET || '';
  /* L'adresse publique du site, pour les retours de Stripe. En développement
     elle vaut localhost ; en ligne, elle doit être écrite — une redirection
     vers localhost après paiement est un client perdu.

     **Et c'est exactement ce qui serait arrivé.** Cette ligne ne lisait que
     SITE_URL, que la procédure de déploiement ne demande nulle part : elle
     fait poser PUBLIC_ORIGIN. Une installation faite selon la documentation
     laissait donc SITE_URL vide et renvoyait les clients payants vers
     localhost:3000, c'est-à-dire vers leur propre téléphone, après avoir
     encaissé. Le garde-fou décrit deux lignes plus haut ne se déclenchait
     pas, puisqu'il surveillait la mauvaise variable.

     C'est la même faute, au mot près, que celle qu'on a corrigée sur
     l'en-tête HSTS dans server.js — voir son commentaire : « deux noms pour
     la même chose finissent toujours par se contredire ». On lit donc d'abord
     celui que tout le monde emploie, et l'autre reste accepté pour les
     installations qui l'ont déjà posé. */
  const racine = () => process.env.PUBLIC_ORIGIN || process.env.SITE_URL
    || site || 'http://localhost:3000';

  const configure = () => Boolean(cle() && secretHook());

  /**
   * Un appel à Stripe, en formulaire encodé — c'est le seul format que son API
   * accepte. On n'ajoute pas la bibliothèque officielle pour trois requêtes :
   * elle pèse plus que ce fichier, et la signature se vérifie en six lignes.
   */
  async function stripe(chemin, champs) {
    const corps = new URLSearchParams(champs).toString();
    const r = await fetch(API + chemin, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cle()}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: corps,
    });
    const json = await r.json();
    if (!r.ok) {
      // Le message de Stripe est nommé et utile ; le perdre oblige à deviner.
      const e = new Error(json?.error?.message || 'stripe');
      e.stripe = json?.error;
      throw e;
    }
    return json;
  }

  /**
   * La signature d'un webhook Stripe.
   *
   * L'en-tête vaut `t=1700000000,v1=abc…`. On recompose `t.corps`, on en prend
   * le HMAC-SHA256 avec le secret, et on compare — **en temps constant**, avec
   * `timingSafeEqual` : une comparaison ordinaire fuit la bonne signature octet
   * par octet, et c'est exactement le genre de fuite qu'on ne voit jamais dans
   * les journaux.
   *
   * La tolérance de cinq minutes écarte le rejeu d'un événement capté hier.
   */
  function signatureValide(brut, entete) {
    const parts = Object.fromEntries(String(entete || '').split(',')
      .map((p) => p.split('=')).filter((p) => p.length === 2));
    if (!parts.t || !parts.v1) return false;
    if (Math.abs(Date.now() / 1000 - Number(parts.t)) > 300) return false;

    const attendu = crypto.createHmac('sha256', secretHook())
      .update(`${parts.t}.${brut}`).digest('hex');
    const a = Buffer.from(attendu);
    const b = Buffer.from(parts.v1);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  /* ------------------------------------------------------- la livraison */

  /**
   * Remettre ce qui a été payé.
   *
   * Elle est appelée **dans la transaction** qui marque la commande livrée :
   * si la remise échoue, la commande reste « payée » et repassera au rejeu
   * suivant. L'inverse — marquer livré puis remettre — perd la marchandise au
   * premier hoquet, et personne ne le sait.
   */
  /* Injecté, et facultatif. Depuis que les billets n'existent plus, une
     installation sans `sql/abonnement.sql` n'a **rien** à vendre : la boutique
     se monte quand même, son catalogue est vide, et l'écran le dit. Ce qu'elle
     ne fait dans aucun cas, c'est encaisser un abonnement sans savoir le
     poser — voir `livrer`. */
  async function livrer(conn, userId, article) {
    const l = article.livraison;

    /* Un seul type, et c'est la moitié du sujet. **L'argent réel n'achète que
       l'abonnement** : pas de booster, pas d'écharpe, et plus de billets non
       plus. Une écharpe achète un booster à quarante-cinq ; vendre de la monnaie
       de jeu, sous n'importe quel nom, reviendrait à vendre un coffre aléatoire
       avec une étape de plus.

       La condition n'est pas écrite en dur mais lue dans `LIVRAISONS_PAYANTES`,
       pour qu'il n'existe **qu'un seul endroit** où l'on décide ce que l'argent
       peut acheter. Une seconde liste finirait par contredire la première. */
    if (!LIVRAISONS_PAYANTES.has(l.type)) {
      throw new Error('boutique.error.livraison_interdite');
    }

    /* L'abonnement ne se pose pas ici : il a son module, et lui seul sait ce
       qu'un renouvellement fait à une échéance — il la **pousse** plus loin au
       lieu de la remplacer, sans quoi renouveler trois jours avant le terme
       perdrait ces trois jours. Recopier ce calcul ici en ferait une seconde
       version, qui divergerait.

       Sans module monté, on refuse plutôt que d'encaisser : une commande qui
       échoue est rejouée par Stripe, un paiement pris sans contrepartie ne se
       rattrape pas tout seul. */
    if (l.type === 'abonnement') {
      if (!abonnement) throw new Error('boutique.error.abonnement_absent');
      /* `conn` : on écrit **dans** la transaction de l'encaissement. Sans
         elle, un abonnement posé survivrait au `rollback` de l'achat qui l'a
         payé — et six encaissements simultanés s'attendraient sur le verrou de
         la même ligne jusqu'au `Lock wait timeout`. */
      await abonnement.accorder(userId, {
        formule: l.formule, jours: l.jours, source: 'stripe', conn,
      });
      return { abonnement: l.formule };
    }

    throw new Error('boutique.error.livraison_inconnue');
  }

  /**
   * Encaisser une session payée, une seule fois.
   *
   * ## On **réclame** la commande avant de livrer
   *
   * Le premier geste est un `UPDATE … WHERE etat <> 'livre'`, et l'on regarde
   * combien de lignes il a touchées. Une seule transaction peut en toucher une :
   * les autres en touchent zéro et repartent sans rien remettre. La livraison
   * ne se fait qu'après cette prise.
   *
   * C'est plus solide que de lire puis d'écrire, même sous `FOR UPDATE`. Une
   * lecture verrouillée protège si les verrous s'ordonnent comme on l'imagine ;
   * cette écriture-ci protège parce qu'elle est **atomique**, et le nombre de
   * lignes touchées est un fait, pas une hypothèse sur l'isolation.
   *
   * Et c'est éprouvable : retirer le `AND etat <> 'livre'` fait rougir la suite,
   * ce qu'aucune course fabriquée n'obtenait de façon fiable.
   *
   * Si la remise échoue après la prise, tout est annulé — la commande redevient
   * payée et non livrée, et le prochain rejeu la reprendra.
   */
  async function encaisser(sessionId) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [prise] = await conn.query(
        `UPDATE achats
            SET etat = 'livre', paye_le = COALESCE(paye_le, NOW(3)), livre_le = NOW(3)
          WHERE stripe_session = ? AND etat <> 'livre'`, [sessionId]);

      if (!prise.affectedRows) {
        /* Déjà livrée, ou inconnue. Les deux se répondent pareil — un 200 sans
           rien faire — et c'est ce qui rend le rejeu de Stripe inoffensif. */
        await conn.rollback();
        return { deja: true };
      }

      const [[cmd]] = await conn.query(
        `SELECT id, user_id, article FROM achats WHERE stripe_session = ?`, [sessionId]);

      const article = ARTICLE_PAR_ID.get(cmd.article);
      if (!article) {
        /* L'article a quitté le catalogue entre la commande et le paiement. On
           ne devine pas ce qu'il contenait : on annule la prise, la commande
           reste payée et non livrée, et quelqu'un devra la regarder. Livrer au
           hasard serait pire que ne rien livrer. */
        await conn.rollback();
        await q(`UPDATE achats SET etat = 'paye', paye_le = COALESCE(paye_le, NOW(3))
                  WHERE stripe_session = ?`, [sessionId]);
        return { article_retire: true };
      }

      const remis = await livrer(conn, cmd.user_id, article);
      await conn.query(`UPDATE achats SET livraison = ? WHERE id = ?`,
        [JSON.stringify(remis), cmd.id]);
      await conn.commit();
      return { livre: remis, userId: cmd.user_id };
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }

  /* ------------------------------------------------------------ le webhook

     Monté à part, et **avant** tout analyseur de corps : voir la note de tête.
     C'est un routeur distinct pour que personne ne puisse ajouter un
     `express.json()` au-dessus de lui sans s'en rendre compte. */

  const webhook = express.Router();
  webhook.post('/webhook', express.raw({ type: 'application/json', limit: '64kb' }),
    async (req, res) => {
      if (!configure()) return res.status(503).json({ error: 'boutique.error.non_configuree' });

      const brut = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
      if (!signatureValide(brut, req.get('stripe-signature'))) {
        // On ne dit pas *pourquoi* : un attaquant n'a pas à savoir s'il a raté
        // l'horodatage ou la clé.
        return res.status(400).json({ error: 'boutique.error.signature' });
      }

      let evt;
      try { evt = JSON.parse(brut); } catch { return res.status(400).end(); }

      try {
        if (evt.type === 'checkout.session.completed'
            || evt.type === 'checkout.session.async_payment_succeeded') {
          const s = evt.data?.object;
          // `payment_status` et non `status` : une session peut être complète
          // et impayée — un virement en attente, par exemple.
          if (s?.payment_status === 'paid') await encaisser(s.id);
        }
        if (evt.type === 'checkout.session.expired') {
          await q(`UPDATE achats SET etat = 'abandonne'
                    WHERE stripe_session = ? AND etat = 'en_attente'`,
            [evt.data?.object?.id]);
        }

        /* ================================ un abonnement vit après son premier jour

           C'est ce qui le distingue d'un achat, et c'est la moitié qu'on oublie.
           `checkout.session.completed` ne dit que le **premier** paiement.
           Sans les deux événements qui suivent, un abonné perdrait l'accès au
           bout d'un mois pendant que Stripe continue de le débiter — la panne la
           plus coûteuse qu'on puisse écrire dans ce fichier, et celle qu'on ne
           découvre qu'en lisant un message de réclamation.

           **La fin de période vient de Stripe**, pas de notre calendrier :
           c'est lui qui sait quand le mois s'arrête, et recopier « trente et un
           jours » finirait par décaler d'un jour à chaque renouvellement. Le
           repli sur `jours` ne sert que si la facture n'en dit rien. */
        if (evt.type === 'invoice.paid' && abonnement) {
          const inv = evt.data?.object;
          const ref = inv?.subscription ?? null;
          const fin = inv?.lines?.data?.[0]?.period?.end ?? null;
          if (ref) await abonnement.renouveler(ref, fin ? new Date(fin * 1000) : null);
        }

        /* Résilié, ou impayé. On **ne supprime pas la ligne** : l'abonnement
           court jusqu'au terme déjà payé, et le couper le jour de la résiliation
           reprendrait au joueur ce qu'il a réglé. Stripe garde la même
           distinction — `cancel_at_period_end` — et on la suit. */
        if (evt.type === 'customer.subscription.deleted' && abonnement) {
          const sub = evt.data?.object;
          const fin = sub?.current_period_end ?? null;
          if (sub?.id) {
            await abonnement.renouveler(sub.id, fin ? new Date(fin * 1000) : new Date());
          }
        }
        res.json({ recu: true });
      } catch (e) {
        /* On répond 500 exprès : Stripe **rejouera**, et le rejeu est sûr.
           Répondre 200 sur une erreur ferait taire Stripe et perdrait la
           livraison pour de bon. */
        console.error('[boutique] webhook', e.message);
        res.status(500).json({ error: 'boutique.error.serveur' });
      }
    });

  /* -------------------------------------------------------- la boutique */

  const router = express.Router();
  router.use(express.json({ limit: '8kb' }));

  /** Le catalogue. Ouvert : on peut regarder la vitrine sans être connecté. */
  router.get('/catalogue', (_req, res) => {
    res.json({
      /* Les rayons voyagent avec les articles, et le prix part **déjà mis en
         forme**. La page pourrait diviser par cent elle-même ; elle le ferait
         alors à sa façon, et le jour où l on vendra en francs suisses il y
         aurait deux endroits à corriger. */
      rayons: RAYONS,
      articles: CATALOGUE.map(({ livraison, prix, ...reste }) =>
        ({ ...reste, prix, prixTexte: enEuros(prix) })),
      // La page a besoin de savoir si le paiement est branché, pour dire
      // « bientôt » plutôt que de lancer une commande qui sera refusée.
      ouvert: configure(),
    });
  });

  /* -------------------------------------------------------------- l'étal

     Ce que les **écharpes** achètent, en dehors des boosters. Rien n'y est
     tiré au sort : on n'achète pas « une pièce d'équipement », on achète le
     mégaphone.

     Il se payait en billets, la monnaie que l'argent réel achetait. Les billets
     n'existent plus : la chaîne euro → tirage n'est plus coupée par une
     séparation qu'il fallait tenir, elle est coupée à la racine — il n'y a plus
     de monnaie achetable du tout. */
  router.get('/etal', requireAuth, async (req, res) => {
    const ont = await q('SELECT stuff_id FROM user_stuff WHERE user_id = ?', [req.user.id]);
    const [bourse] = await q(
      'SELECT scarves FROM user_wallet WHERE user_id = ?', [req.user.id]);
    res.json({
      monnaie: MONNAIE,
      /* `echarpes` et non `billets` : le nom du champ dit la monnaie, et le
         garder aurait fait une page qui affiche des écharpes sous une étiquette
         qui n'existe plus. */
      echarpes: bourse?.scarves ?? 0,
      stuff: etalStuff(new Set(ont.map((o) => o.stuff_id))),
      tenues: etalTenues(tenuesPubliees()),
    });
  });

  /**
   * Dépenser des **écharpes** sur un objet nommé.
   *
   * Le corps ne porte **que** ce qu'on veut : le prix est relu ici, dans le
   * registre, et jamais dans ce que la page a envoyé. C'est la même règle que
   * pour les euros, pour la même raison.
   *
   * Tout tient dans une transaction, et c'est **elle** qui protège : si la
   * remise échoue après le débit, le `rollback` rend les écharpes. Une mutation
   * qui échange les deux blocs ne casse donc rien — ce qui est la preuve que
   * l'ordre n'est pas ce qui tient la propriété. Retirer le `rollback`, lui,
   * fait rougir un contrôle.
   *
   * On garde quand même l'ordre « remettre puis débiter » : il est plus lisible,
   * et il resterait juste le jour où ce code sortirait d'une transaction. Mais
   * ce n'est pas là qu'il faut regarder pour comprendre pourquoi rien ne se
   * perd.
   *
   * Le débit est une **réclamation** : `SET scarves = scarves - ? WHERE
   * scarves >= ?`, dont on lit le nombre de lignes touchées. Deux requêtes
   * simultanées ne peuvent pas débiter deux fois le même solde, et c'est
   * éprouvable — à la différence d'un verrou, qu'aucune course fabriquée ne
   * fait rougir.
   */
  router.post('/depenser', requireAuth, async (req, res) => {
    const type = String(req.body?.type ?? '');
    const id = String(req.body?.id ?? '');
    const prix = prixDe(type, id, tenuesPubliees());
    if (prix === null) return res.status(400).json({ error: 'boutique.error.objet_inconnu' });

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const rendu = type === 'stuff'
        ? await fanzzy.remettreStuff(conn, req.user.id, id)
        : await fanzzy.remettreTenue(conn, req.user.id, {
          tenue: id, fanzzy: String(req.body?.fanzzy ?? ''), stage: req.body?.stage,
        });

      const [debit] = await conn.query(
        'UPDATE user_wallet SET scarves = scarves - ? WHERE user_id = ? AND scarves >= ?',
        [prix, req.user.id, prix]);
      if (!debit.affectedRows) {
        await conn.rollback();
        return res.status(400).json({ error: 'boutique.error.echarpes_insuffisantes' });
      }

      await conn.commit();
      const [bourse] = await q(
        'SELECT scarves FROM user_wallet WHERE user_id = ?', [req.user.id]);
      return res.json({ ok: true, paye: prix, echarpes: bourse?.scarves ?? 0, rendu });
    } catch (e) {
      await conn.rollback().catch(() => {});
      /* Les refus de `remettre` portent leur code : « tu ne possèdes pas ce
         Fanzzy » et « tu l'as déjà habillé ainsi » ne se cherchent pas au même
         endroit. Un « impossible » les confondrait. */
      return res.status(400).json({ error: e.code ?? 'boutique.error.depense_impossible' });
    } finally {
      conn.release();
    }
  });

  /** Ce que j'ai acheté. Sert à répondre « où est ma commande ». */
  router.get('/mes-achats', requireAuth, async (req, res) => {
    res.json({
      achats: await q(
        `SELECT article, montant, devise, etat, livraison,
                UNIX_TIMESTAMP(cree_le) * 1000 AS creeLe
           FROM achats WHERE user_id = ? ORDER BY cree_le DESC LIMIT 40`,
        [req.user.id]),
    });
  });

  /**
   * Ouvrir une commande, et rendre l'adresse où payer.
   *
   * Le corps ne porte **que** l'identifiant de l'article. Pas de montant, pas
   * de quantité, pas de devise : tout le reste est décidé ici.
   */
  router.post('/commander', requireAuth, async (req, res) => {
    if (!configure()) return res.status(503).json({ error: 'boutique.error.non_configuree' });

    const article = ARTICLE_PAR_ID.get(String(req.body?.article ?? ''));
    if (!article) return res.status(400).json({ error: 'boutique.error.article_inconnu' });

    try {
      /* **Deux modes, et c'est l'article qui décide.** `recurrence` porte
         l'intervalle Stripe — `month` ou `year` — et sa seule présence fait
         basculer la session en abonnement. Ouvrir un abonnement en
         `mode: 'payment'` prendrait l'argent une fois et ne renouvellerait
         jamais : le joueur perdrait l'accès au bout d'un mois sans que rien ne
         le dise, et c'est la panne la plus coûteuse qu'on puisse écrire ici.

         La page de retour change aussi : on revient sur l'écran de
         l'abonnement, qui sait dire jusqu'à quand il court, et non sur la
         boutique, qui n'en sait rien. */
      const abonne = Boolean(article.recurrence);
      const retour = abonne ? '/abonnement' : '/boutique';
      const session = await stripe('/checkout/sessions', {
        mode: abonne ? 'subscription' : 'payment',
        success_url: `${racine()}${retour}?paye=1`,
        cancel_url: `${racine()}${retour}?annule=1`,
        'line_items[0][quantity]': '1',
        'line_items[0][price_data][currency]': 'eur',
        'line_items[0][price_data][unit_amount]': String(article.prix),
        ...(abonne
          ? { 'line_items[0][price_data][recurring][interval]': article.recurrence }
          : {}),
        'line_items[0][price_data][product_data][name]': article.nom,
        'line_items[0][price_data][product_data][description]': article.texte,
        /* Le joueur voyage dans les métadonnées **et** dans notre table. La
           table fait foi ; les métadonnées servent à retrouver une commande
           depuis le tableau de bord de Stripe, un jour où quelque chose aura
           mal tourné. */
        'metadata[user_id]': String(req.user.id),
        'metadata[article]': article.id,
        client_reference_id: String(req.user.id),
      });

      await q(
        `INSERT INTO achats (user_id, article, montant, devise, stripe_session)
         VALUES (?, ?, ?, 'eur', ?)`,
        [req.user.id, article.id, article.prix, session.id]);

      res.json({ url: session.url });
    } catch (e) {
      console.error('[boutique] commande', e.message);
      res.status(502).json({ error: 'boutique.error.paiement_indisponible' });
    }
  });

  /*  `livrer` est exporté pour être éprouvé directement.

     La règle « l argent réel n achète que l abonnement » vit dans une liste, et
     une liste ne se tient que si quelque chose la lit. Sans cet export, on ne
     pourrait éprouver la règle qu à travers le catalogue — c est-à-dire
     vérifier que le catalogue est conforme, jamais que le moteur refuserait
     un article qui ne le serait pas. */
  return { router, webhook, encaisser, livrer, signatureValide, configure };
}
