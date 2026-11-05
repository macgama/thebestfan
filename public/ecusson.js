/* ============================================================ l'écusson du jeu

   Choix de Gaël du 5 novembre 2026 : dans le jeu, un club se montre à ses
   couleurs et à ses initiales, plus avec son logo officiel (une marque du
   club, que la licence d'API-Football ne couvre pas). Les pages « Matchs »
   (matchs du jour, télétexte : résultats et classements réels) gardent le
   logo et ne chargent pas ce fichier.

   Chargé en tête d'une page du jeu, il remplace l'adresse de chaque logo
   d'API-Football par l'écusson que dessine le serveur
   (`src/server/football/ecusson.js`) :

     https://media.api-sports.io/football/teams/42.png   → /api/ecusson/42.svg
     https://media.api-sports.io/football/leagues/39.png → /api/ecusson/ligue/39.svg

   Un seul geste pour toutes les pages, sans toucher à leur code : le
   remplacement suit chaque image ajoutée ou changée (MutationObserver, qui
   passe avant que la page ne se peigne : le logo n'apparaît jamais). */
(function () {
  'use strict';
  var MOTIF = /^https?:\/\/media(?:-\d+)?\.api-sports\.io\/football\/(teams|leagues)\/(\d+)\.(?:png|svg|jpe?g|webp)(?:\?.*)?$/i;

  function adresse(src) {
    var m = MOTIF.exec(String(src || ''));
    if (!m) return null;
    return m[1].toLowerCase() === 'teams' ? '/api/ecusson/' + m[2] + '.svg' : '/api/ecusson/ligue/' + m[2] + '.svg';
  }

  function corriger(img) {
    var src = img.getAttribute('src');
    var neuve = adresse(src);
    if (neuve && neuve !== src) {
      img.setAttribute('src', neuve);
      img.classList.add('tbf-ecusson');
    }
  }

  function parcourir(noeud) {
    if (!noeud || noeud.nodeType !== 1) return;
    if (noeud.tagName === 'IMG') corriger(noeud);
    else if (noeud.querySelectorAll) {
      var imgs = noeud.querySelectorAll('img[src*="api-sports.io"]');
      for (var i = 0; i < imgs.length; i++) corriger(imgs[i]);
    }
  }

  window.TBF_ECUSSON = { adresse: adresse, corriger: parcourir };

  new MutationObserver(function (liste) {
    for (var i = 0; i < liste.length; i++) {
      var m = liste[i];
      if (m.type === 'attributes') parcourir(m.target);
      else for (var j = 0; j < m.addedNodes.length; j++) parcourir(m.addedNodes[j]);
    }
  }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });

  parcourir(document.documentElement);
})();
