# Refaire 9 planches AN dans Chrome, gratuitement (accord de Gaël, 2026-10-25, « vas-y »)

GRATUIT SEULEMENT. Aucun crédit ne doit partir.

## Avant de générer
1. Note le solde Artlist (connecteur Artlist, get_balance) avant la première image.
2. Sur toolkit.artlist.io, onglet Image : Nano Banana 2, 2K, 16:9, **une seule variante**, interrupteur **Unlimited activé**.
   - Si Unlimited n'est pas disponible, ou si le bouton Generate affiche un coût en crédits, ne lance rien et préviens-moi.
3. Après la première image, revérifie le solde. S'il a baissé d'un seul crédit, arrête tout de suite et préviens-moi.
   - Revérifie-le ensuite après chaque Fanzzy.

## Les 18 images
Il y a deux demi-planches 16:9 par planche, A puis B. Le prompt est le contenu EXACT du fichier .txt du même nom, ici dans `refaire/`. L'image de référence (à joindre) est la carte de l'âge, dans le dépôt :
- âge 1 : `art/neuves/AN<n>.png`
- âge 2 : `art/neuves/AN<n>B.png`
- âge 3 : `art/neuves/AN<n>C.png`

Si une carte manque dans `art/neuves/`, prends-la dans `public/img/fanzzy/AN<n>/`.

| Fanzzy | Âge | Fichiers | Référence |
|---|---|---|---|
| AN9 | 1 | AN9-pl-e1A, AN9-pl-e1B | AN9.png |
| AN17 | 2 | AN17-pl-e2A, AN17-pl-e2B | AN17B.png |
| AN22 | 1 | AN22-pl-e1A, AN22-pl-e1B | AN22.png |
| AN26 | 1 | AN26-pl-e1A, AN26-pl-e1B | AN26.png |
| AN29 | 1 | AN29-pl-e1A, AN29-pl-e1B | AN29.png |
| AN35 | 1 | AN35-pl-e1A, AN35-pl-e1B | AN35.png |
| AN38 | 2 | AN38-pl-e2A, AN38-pl-e2B | AN38B.png |
| AN41 | 2 | AN41-pl-e2A, AN41-pl-e2B | AN41B.png |
| AN57 | 3 | AN57-pl-e3A, AN57-pl-e3B | AN57C.png (version nettoyée, commitée) |

Vérifie chaque image avant de passer à la suivante : trois figures entières, pas de texte ni de lettres, rien de coupé, fond vert uni. Une image ratée peut être relancée une fois, toujours gratuitement.

## Ensuite
- Télécharge les images (Library, survol, flèche). Copie-les dans `art/AN<n>/_src/` sous ces noms : `AN<n>-e<âge>-base-planche-A.png` et `-B.png`.
- Pousse ces 18 PNG bruts sur une branche orpheline GitHub `sources-refaire`, rangés dans `a-decouper/AN<n>/`. C'est la même méthode que pour les branches sources-an* : le cloud les découpe et les branche.
- Ne touche pas au checkout principal ni à main.
- Rapport court : ce qui est fait, le solde avant et après, et tout incident.
