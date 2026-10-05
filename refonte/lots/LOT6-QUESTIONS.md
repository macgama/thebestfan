# Lot 6 — ce qui revient à Gaël

*3 octobre 2026. Les décisions que le lot des arènes et la vague 2 du serveur
ne peuvent pas prendre seuls. Pour chacune : la question, ce qui se passe sans
réponse, ma recommandation et ce qu'elle coûte. Les quatre premières sont à
trancher **avant** le lancement : elles changent ce que le serveur écrit ou ce
que l'écran affirme. Les autres peuvent l'être pendant le lot.*

Rappel de ce qui est déjà tranché et ne se rouvre pas : les faces vives
foncées, le kraft `#E4D3B5` à l'encre noire pure, l'or seulement en grand texte
ou en face, une seule série (LA REPRISE) en production en saison 1, les doubles
mouvement réduit et calme, « une ligne sans donnée disparaît, jamais un
tiret », aucune image avec texte, logo, écusson, maillot identifiable ou
personne réelle.

---

## Avant le lancement

### Q1. L'XP du Virage

**La question.** Le Grand Virage, cœur du jeu, ne rapporte aucune XP ; seules
les missions le paient. La proposition du chantier (`SERVEUR.md` § 11.2) :
**15 XP par match poussé, versés par le bilan de tribune**. C'est une règle,
pas un montant : il faut dire ce qu'est un « match poussé », et pour qui.

**Sans réponse.** Le bilan se construit sans ligne d'XP ; le Virage reste la
seule façon de jouer qui ne fait pas monter de niveau.

**Recommandation.**
- 15 XP par match, **une fois** par match, versés au premier bilan (à la
  sortie ou au coup de sifflet), et en filet au départ de la tribune si la
  page n'a pas demandé son bilan ;
- un match est « poussé » à partir de **10 chants acceptés** par le serveur
  dans ce match (une à deux minutes de jeu) ;
- **trois matchs par jour au plus**, le même plafond pour tous ;
- **ni le club, ni l'abonnement, ni la neutralité, ni le classement n'y
  changent rien.** L'XP mesure le temps passé à jouer (`ETAT.md` § 3 : « l'XP
  ne double pas pour son club ») ; et le drapeau `classe` dépend du plafond de
  Virages comptés, que l'abonnement lève — lier l'XP au classement ferait
  acheter de l'XP.

Les trois nombres sont réglables dans `/admin` (`xp.virage`,
`xp.virage_chants`, `xp.virage_matchs_jour`).

**Coût.** Une journée de serveur dans la vague 2 (le grand livre fait déjà le
plus dur). Effet : de 15 à 45 XP par jour pour un joueur du Virage, contre 120
pour les trois missions ; à 45 XP, un niveau de plus environ toutes les deux
semaines au milieu de la courbe. Le plafond borne ce qu'un client automatisé
peut en tirer (45 XP par jour, un peu plus du tiers des 120 des missions).

### Q2. La présence : visible ou cachée par défaut, et « REJOINDRE »

**La question.** La présence (en ligne, au Virage, en duel) est la donnée la
plus sensible du chantier (`RISQUES.md` V3), et le jeu est ouvert aux mineurs
sans barrière (L5). Trois choix :
1. **qui la voit** — les amis mutuels seulement, ou plus ;
2. **par défaut**, visible ou cachée ;
3. **« REJOINDRE »** — dire à un ami *quel match* on pousse, pour qu'il vienne.

**Sans réponse.** La vague 2 livre la présence **éteinte**
(`presence.actif` à faux) : aucun écran n'en montre, rien n'est servi, et la
politique de confidentialité n'a rien de neuf à dire.

**Recommandation.**
- les **amis mutuels seulement** (une amitié est déjà un double consentement) ;
- **trois états grossiers**, sans match ni heure, et **rien d'écrit en base** ;
- **visible par défaut** pour ces seuls amis, avec l'interrupteur
  « apparaître hors ligne » au pied du tiroir, à côté du mode calme ;
- **pas de « REJOINDRE » pour l'instant** : dire quel match, c'est la phrase
  que le module des amis refuse depuis le début (« je sais où tu vas le
  week-end »). Dans la tribune même, « 2 AMIS ICI » ne révèle rien : on y est
  tous les deux.
- allumer seulement après la mise en ligne de la nouvelle
  `CONFIDENTIALITE.md`, et poser la question au juriste (dossier L5).

**Coût.** Une journée et demie de serveur, une demi-journée d'écrans (la
pastille de `/amis`, le sticker de la tribune, l'interrupteur). « REJOINDRE »
ajouterait une demi-journée, une lecture de plus sur `/api/virage/live` (la
route la plus chère du jeu) et la question juridique la plus nette du lot.

### Q3. Une seule échelle de verdict

**La question.** Le même geste ne reçoit pas le même mot selon l'écran. Au
Virage, PARFAIT au-dessus de 0,9, puis BON, MOYEN, RATÉ ; dans la salle de
répétition, PARFAIT seulement à 0,95, puis TRÈS BIEN, ÇA VIENT, À REPRENDRE,
RATÉ ; au duel, des seuils écrits pour le son. Un 0,92 est PARFAIT au Virage
et TRÈS BIEN à la répétition. Le serveur va compter les PARFAITS (bilan,
série, combo) : il lui faut une échelle.

**Sans réponse.** Le serveur prend celle du Virage (au-dessus de 0,9 ; c'est
aussi le seuil de `perfectBonus` dans `gestures.js`) pour le Virage et le duel,
et la répétition garde ses mots.

**Recommandation.** **Une échelle, quatre mots, partout** : PARFAIT au-dessus
de 0,9, BON au-dessus de 0,7, MOYEN au-dessus de 0,4, RATÉ en dessous, en
tampons vert, bleu, or et rouge. La répétition garde sa note chiffrée et son
record — c'est ce qui la rend utile —, mais son mot devient celui de l'arène :
on s'entraîne pour le PARFAIT qu'on verra en tribune. Le Cri du Fanzzy reste
réservé aux gestes au-dessus de 0,95 : c'est une récompense, pas un verdict.

**Coût.** Un module partagé (déjà prévu), le mot servi par la route de
répétition, une retouche de `/repetition`. Les seuils ne sont pas réglables :
ils sont dessinés.

### Q4. La ferveur arrondie à zéro, que le bilan va afficher

**La question.** Dans une tribune de plus de 34 personnes environ (67 pour un
supporter du club), la ferveur d'un chant s'arrondit à zéro (`SERVEUR.md`
§ 11.4). C'était invisible tant que personne ne regardait sa ferveur d'un
match. Le lot 6 la met au centre : la jauge à paliers du HUD (« 12ᵉ → TOP
10 »), et le bilan (« 1 240 de ferveur, 12ᵉ sur 298 »). Dans une grande
tribune, **tout le monde aurait 0, et le rang « 1 + ceux qui font mieux » dirait
« 1ᵉʳ » à chacun**.

**Sans réponse.** Le lot départage le rang du bilan par les chants puis les
PARFAITS quand la ferveur est égale — ce qui évite le « 1ᵉʳ pour tous » —, mais
la ferveur affichée reste zéro, et les divisions de saison, qui s'en
nourrissent, ne bougent pas pour qui joue dans une grande tribune.

**Recommandation.** **Un plancher : un chant accepté, noté au moins MOYEN,
rapporte au moins 1 de ferveur.** Une ligne dans le calcul du crédit, chants
seulement (pas les cartes). Les petites tribunes ne changent pas ; une grande
tribune récolte de l'ordre d'un point par bon chant, ce qui garde un classement
lisible ; aucun seuil de division n'est à toucher (Capo, à 300 000, reste hors
de portée d'un plancher). Et le départage par les chants, en plus.

**Coût.** Une demi-journée avec ses tests — dont un à reprendre : le contrôle
de proportion du Virage (« dix fois plus de monde, dix fois moins par tête »)
doit se mesurer sur des tribunes où le plancher ne mord pas, sans quoi il
rougirait à raison.

---

## Pendant le lot

### Q5. Le stade ou la photo de tribune, au fond de l'arène

**La question.** La maquette pose la photo de tribune assombrie au fond de
l'arène du Virage. Le jeu y dessine aujourd'hui **le stade de la rencontre** :
il appartient au match, ses effets s'appliquent aux deux camps, et ses
tribunes s'allument aux couleurs des clubs selon la corde.

**Recommandation.** **Garder le stade.** Il porte une règle du jeu (le lieu et
ses effets), la photo n'en porte aucune ; la maquette l'employait faute de
mieux. La photo garde le voile de choix (le tunnel, en attendant son image).

**Coût.** Aucun. Le contraire coûterait l'information du lieu et le travail de
`stade-art.js`.

### Q6. Le voile des arènes (hypothèse H6)

**La question.** Les arènes gardent le voile du mur à 75 %, quand le hub est à
60 % et que la direction voulait les arènes « vives ». C'est un effet de
`nav.js`, qui pose `.dense` sur tout écran qu'il décore.

**Recommandation.** **Lever H6** : `nav.js` ne pose plus `.dense` sur les deux
écrans de jeu. Leur colonne est opaque et peint sa propre scène (le stade, la
fumée) ; le mur ne se voit qu'au-delà de 900 px de large, et c'est là qu'il
doit ressembler au hub.

**Coût.** Une ligne, et une mesure de l'audit à 768 × 1024 et au-delà.

### Q7. Le supporter d'en face, aux couleurs de l'adversaire

**La question.** La direction met, de l'autre côté de la corde, « un supporter
anonyme aux couleurs d'en face » qui tire. L'image existante
(`img/supporter/push`) porte un maillot rayé rouge et blanc, fixe, et ne tire
pas de corde : elle ne se teint pas. Il faudrait une image neuve, neutre, à
teinter.

**Recommandation.** **Ne pas la faire au lot 6.** La foule au pochoir, teintée
au camp et qui pousse quand le camp chante, dit déjà qui est en face. La
produire au lot 7 seulement si la critique trouve l'arène vide.

**Coût.** Au lot 7 : deux à quatre générations (130 crédits Artlist chacune),
un détourage, et la chaîne `npm run ecrans` à écrire (`IMAGES.md`).

### Q8. La rumeur : synthétisée ou enregistrée

**La question.** Le son de tribune est entièrement synthétisé, par règle
(`son.js` : un son téléchargé se joue en retard la première fois). Artlist est
maintenant autorisé pour les sons. Une vraie rumeur de stade enregistrée
sonnerait plus juste qu'un bruit filtré.

**Recommandation.** **Garder la synthèse au lot 6** : le lot branche le son sur
le match (chants calés sur la pulsation, rumeur qui suit la partie), et le
banc mesure tout. Essayer au lot 7 **une seule boucle enregistrée, pour le bus
d'ambiance seulement** — jamais pour les gestes, où la latence compte —, sans
air reconnaissable ni chant de club, chargée après le premier geste.

**Coût.** Au lot 7 : une règle de `son.js` à amender (« aucun fichier audio »
devient « aucun fichier audio pour ce qui doit tomber pile »), un fichier
d'environ 200 Ko, `son:smoke` et `son:banc` à étendre.

### Q9. Les missions de qualité, maintenant que les compteurs existent

**La question.** La vague 2 compte les PARFAITS et la meilleure série. Les
missions « réussis 8 PARFAITS », « enchaîne 3 PARFAITS » deviennent possibles.

**Recommandation.** **Les laisser en réserve.** Payer la qualité du geste pousse
à l'automatiser (`RISQUES.md` T6), et le moteur n'a pour défense que la cadence
et le refus des gestes trop réguliers. Le bilan montre les PARFAITS ; il ne les
paie pas.

**Coût.** Aucun. Les brancher plus tard : deux lignes de catalogue et deux
bascules.

### Q10. La sortie du Virage passe par le bilan

**La question.** Aujourd'hui, la flèche et le menu demandent « QUITTER LA
TRIBUNE ? ». Le lot pose à la place la page kraft du bilan, avec RESTER et
SORTIR : un écran plein au lieu d'une boîte, à chaque sortie.

**Recommandation.** **Oui, mais seulement si l'on a poussé pendant ce match.**
Sans un chant, on sort tout de suite, sans question : il n'y a rien à dire, et
une confirmation qui ne dit rien apprend à passer outre.

**Coût.** Inclus dans le lot. `virage:ui` vérifie aujourd'hui la boîte : le
contrôle suit, avec le même sens.

### Q11. La tribune se vide cinq minutes après le coup de sifflet

**La question.** Pour corriger une fuite de l'enveloppe d'API (`SERVEUR-VAGUE2.md`
§ 5, D1 : une page restée ouverte sur un Virage fini coûte jusqu'à 1 440 appels
par jour), une salle finie cesse d'être relevée, et se vide quelques minutes
après la fin. Le joueur garde son bilan à l'écran, mais la tribune ne vit plus.

**Recommandation.** **Cinq minutes**, réglables (`virage.bilan_min`).

**Coût.** Inclus dans la vague 2.

### Q12. Au duel : ce qui est en jeu, et « +3 places »

**La question.** La direction écrit « +40 écharpes en jeu » sous ENTRER EN FILE,
et « 1 240 → 1 262 · +3 places » au bilan. Le barème du duel est écrit en dur
dans le serveur et n'est servi nulle part ; le rang des duellistes avant et
après n'est pas calculé.

**Recommandation.** **Servir ce qui est en jeu** (par match et par format, prime
et double du club compris — le serveur compte, l'écran nomme) ; **ne pas
servir « +3 places »** : ce serait une lecture du classement à chaque fin de
duel, pour un chiffre que `/classement` montre déjà. La cote, servie depuis la
vague 1, suffit au bilan.

**Coût.** Une demi-journée de serveur pour « en jeu » ; rien pour l'autre.
Rendre le barème du duel réglable dans `/admin` serait une étape de plus, non
proposée ici.

### Q13. Le lot 7 : l'ordre des images, et le Fanzzy vivant

**La question.** Ce que le lot 6 emploie en repli attend ses images
(`IMAGES.md`) : le tunnel, le foulard, la corde, les silhouettes, et le sachet
de LA REPRISE que le kiosque attend depuis les lots 3 et 5. Le Fanzzy vivant
(boucles vidéo des grands moments) était prévu après le lot 6.

**Recommandation.** Dans cet ordre : **le sachet de LA REPRISE** (c'est
l'écran d'achat, au centre, en repli depuis deux lots), **le tunnel** (le
rideau de l'accueil et le voile du Virage), **le foulard** ; la corde et les
silhouettes se dessinent à la main, sans crédit. Pour le Fanzzy vivant, **un
pilote sur RP1 seulement**, quatre boucles (but, pousse, victoire, défaite),
avant d'engager les trente-quatre autres.

**Coût.** Environ 1 500 à 2 500 crédits Artlist pour les images (régénérations
comprises, le tunnel étant le plus risqué) ; 2 000 à 3 000 pour le pilote vidéo
(480 à 750 crédits la boucle). Une chaîne de publication à écrire
(`npm run ecrans`), et une seconde pour les vidéos.
