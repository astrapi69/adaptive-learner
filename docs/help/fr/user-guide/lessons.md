# Leçons de contenu et révisions

Une **leçon de contenu** est une petite unité d'apprentissage rédigée à la
main (généralement 5 à 10 minutes) téléchargée depuis un ensemble de leçons
public. Elle se déroule dans un lecteur dédié, pas dans la session de chat IA.
Après la leçon, l'application mémorise exactement quels mots, paires ou
phrases vous avez manqués et les planifie pour une session de révision ciblée.

Les leçons constituent un **chemin alternatif** vers l'apprentissage qui ne
nécessite pas de clé API IA — parfait pour essayer l'application ou pour du
contenu où le matériel soigneusement structuré surpasse le chat libre.

---

## D'où viennent les leçons

Les leçons se trouvent dans des **ensembles de contenu** — de petits lots
publiés dans des dépôts GitHub publics. L'**Explorateur d'ensembles** à
`/content` liste tous les ensembles disponibles ; cliquez sur l'un d'eux
pour le télécharger. L'ensemble est mis en cache localement (dans le système
de fichiers si vous lancez avec un backend, dans IndexedDB en déploiement
navigateur uniquement), donc vous pouvez étudier hors ligne après le
premier téléchargement.

---

## Le flux de la leçon

Ouvrez un ensemble, choisissez une leçon, et le **lecteur de leçon** vous
guide à travers chaque carte et exercice étape par étape :

1. **Cartes** présentent le matériel à lire. Cliquez sur « Suivant » quand
   vous êtes prêt.
2. **Exercices** vérifient ce que vous vous rappelez. Quatre types standard :
   - **Matching** — faites glisser les paires (mot ↔ traduction).
   - **Choix d'images** — choisissez l'image correspondant à l'invite.
   - **Texte libre** — tapez la réponse.
   - **Assemblage de mots** — assemblez une phrase à partir de tuiles.

Une barre de progression en haut suit votre avancement dans la leçon. Vous
pouvez partir à tout moment — votre progression est sauvegardée par étape
et reprend là où vous vous êtes arrêté.

### L'écran de résumé

Lorsque le dernier exercice est complété, le **résumé de la leçon**
apparaît :

- Une **note de 0 à 3 étoiles** basée sur votre score :
  - **3 étoiles** ≥ 90 % de bonnes réponses
  - **2 étoiles** ≥ 75 %
  - **1 étoile** ≥ 50 %
  - **0 étoile** en dessous de 50 %
- Une **ventilation par exercice** montrant lesquels vous avez réussis et
  ceux comportant des erreurs (avec la bonne réponse révélée).
- Les boutons **Leçon suivante**, **Recommencer** et **Retour à l'ensemble**
  pour que la prochaine action soit à portée d'un clic.

Obtenez 3 étoiles à votre premier essai et les étoiles jouent une petite
animation de célébration. (Si vous avez activé l'option « Réduire les
animations » du système d'exploitation, l'animation la respecte.)

---

## Suivi des erreurs au niveau des éléments

Chaque mauvaise réponse dans chaque type d'exercice écrit une ligne
associée à l'**élément précis que vous avez manqué** — le mot individuel,
la paire ou la phrase. L'application ne retient pas simplement « vous avez
fait 6/10 à la leçon 3 » ; elle retient « vous avez eu du mal avec *bonjour*
et *merci* spécifiquement ».

Répondez correctement au même élément **3 fois de suite** et il passe à
**maîtrisé** — retiré de la file de révision. Ratez un élément maîtrisé
plus tard et il **revient** dans la file. Un maîtrisé raté est un maîtrisé
oublié.

---

## La file de révision

Lorsque vous avez un ou plusieurs éléments à réviser, la **carte de file
de révision** apparaît sur le tableau de bord. Elle affiche :

- Combien d'éléments sont dus
- Combien sont **en retard** (dépassant leur date de révision)
- Un bouton **Réviser maintenant** qui ouvre une mini-session ciblée
  à `/review/:setId`

La planification utilise trois bandes basées sur le nombre de fois où
vous avez correctement répondu à l'élément de suite :

| Série correcte | Prochaine révision |
|----------------|-------------------|
| 0 | 1 jour plus tard |
| 1 | 3 jours plus tard |
| 2 | 7 jours plus tard |
| 3 (maîtrisé) | retiré de la file |

Dans la file, les éléments sont triés : **en retard en premier**, puis par
**nombre d'erreurs décroissant**, puis par **dernier échec en premier**.
Les éléments les plus difficiles remontent donc en tête.

---

## Sessions de révision

Une session de révision à `/review/:setId` synthétise une **mini-leçon
à la volée** à partir des premiers éléments de votre file. Stratégie
mixte (v1.35.0) :

- Si vous avez raté un mot dans un exercice de **matching** ou de
  **choix d'images**, vous le refaites (avec un nouveau brassage).
- Si vous avez raté quelque chose en **texte libre** ou **assemblage
  de mots**, la révision tente de générer un exercice **cloze**
  (remplissez le vide) ciblant exactement le mot manqué.
- Si la génération de cloze ne peut pas construire un vide propre pour
  cet élément, la révision revient silencieusement à rejouer l'original.

---

## Tour de correction en fin de leçon

Nouveau dans **v1.35.0** : quand vous terminez une leçon avec des erreurs,
la page de résumé affiche un petit **tour de correction** entre votre score
et le bouton « Leçon suivante ». Il reprend jusqu'à cinq erreurs spécifiques
et les propose chacune en nouveau cloze ciblé sur le mot ou l'article manqué.

- **Vous pouvez passer à tout moment.** Le bouton « Leçon suivante » reste
  visible — le tour de correction est une pratique optionnelle, pas un verrou.
- Il **n'apparaît que s'il y a quelque chose à corriger.** Les leçons
  parfaites le sautent entièrement.
- **Chaque cloze complété compte pour la maîtrise** — les mêmes lignes de
  suivi que la leçon principale.

---

## Retour visuel différentiel

Les mauvaises réponses en texte libre et assemblage de mots affichent
désormais un **diff au niveau des tokens** entre ce que vous avez écrit
et la réponse correcte :

- **Rouge barré** — ce que vous avez écrit qui n'appartient pas là (avec
  un marqueur × pour les lecteurs d'écran).
- **Vert** — ce que la réponse correcte inclut mais que vous avez manqué
  (avec un marqueur +).
- **Ambre** avec flèche → — un mot légèrement erroné, affiché comme
  `votre-réponse` → `attendu`.

---

## XP et badges

Chaque leçon terminée génère des XP selon une formule par étoile :

- **30 XP** de base
- **+10 XP par étoile** obtenue (0 → 0, 1 → +10, 2 → +20, 3 → +30)
- **+20 XP de bonus** pour 3 étoiles au premier essai
- Le même **multiplicateur de série quotidienne** que les sessions de chat
  (+25 % par jour consécutif d'activité, plafonné à 7 jours)

Quatre badges se débloquent autour des leçons :

- **Première leçon** — terminez votre première leçon de contenu.
- **10 leçons terminées** — terminez 10 leçons de contenu.
- **Série de 3 étoiles** — obtenez 3 étoiles sur trois leçons d'affilée.
- **Maître de la révision** — maîtrisez 50 éléments via la répétition espacée.

---

## Modes de stockage

Les leçons fonctionnent dans **les deux** modes — API (backend) et Dexie
(navigateur uniquement / GitHub Pages). Le suivi des erreurs au niveau
des éléments et la planification SRS s'exécutent de manière identique dans
les deux modes.
