/**
 * Partager un lien — vers un Grand Virage, vers un duel qui attend du monde.
 *
 * ## Pourquoi ce n'est pas qu'un bouton
 *
 * Un jeu de tribunes se joue à plusieurs, et il n'a aucun moyen de faire venir
 * quelqu'un. Le seul canal qui marche vraiment, c'est celui que les gens
 * emploient déjà : « viens, je suis là », envoyé sur WhatsApp ou par message.
 * Le navigateur sait faire exactement ça — `navigator.share` ouvre la feuille
 * de partage du téléphone, avec toutes ses applications dedans.
 *
 * ## Les trois cas, parce qu'il y en a trois
 *
 *   1. **Le téléphone sait partager.** La feuille s'ouvre, le joueur choisit
 *      son application. C'est le cas qui compte : c'est là que les gens sont.
 *
 *   2. **L'ordinateur ne sait pas**, ou refuse hors d'un geste direct. On
 *      copie le lien dans le presse-papiers et on le dit. Ce n'est pas un
 *      repli honteux : coller un lien dans une conversation est le geste
 *      naturel sur un clavier.
 *
 *   3. **Ni l'un ni l'autre** — un vieux navigateur, une page non sécurisée.
 *      On rend `null`, et la page n'affiche simplement pas le bouton. Un
 *      bouton qui ne fait rien est pire que pas de bouton.
 *
 * `navigator.share` **lève** quand le joueur ferme la feuille sans choisir.
 * Ce n'est pas une erreur, c'est un refus : on le distingue, sinon la page
 * annoncerait une panne à quelqu'un qui a simplement changé d'avis.
 */
window.TBF_PARTAGE = (() => {
  const peutPartager = typeof navigator.share === 'function';
  const peutCopier = typeof navigator.clipboard?.writeText === 'function';

  /**
   * Envoie un lien. Rend ce qui s'est passé, pour que la page le dise :
   * `'partage'`, `'copie'`, `'annule'`, ou `null` si rien n'était possible.
   */
  async function envoyer({ titre = 'thebestfan', texte = '', url }) {
    const lien = new URL(url, location.origin).href;

    if (peutPartager) {
      try {
        await navigator.share({ title: titre, text: texte, url: lien });
        return 'partage';
      } catch (e) {
        // `AbortError` : le joueur a fermé la feuille. Il n'y a rien à dire.
        if (e?.name === 'AbortError') return 'annule';
        // Tout le reste — refus de permission, plate-forme capricieuse — se
        // rattrape par le presse-papiers plutôt que de ne rien faire.
      }
    }

    if (peutCopier) {
      try {
        await navigator.clipboard.writeText(lien);
        return 'copie';
      } catch { /* refusé : on tombe sur le rien ci-dessous */ }
    }

    return null;
  }

  return { possible: peutPartager || peutCopier, peutPartager, envoyer };
})();
