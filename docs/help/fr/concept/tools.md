# Les trois piliers d'outils

Adaptive Learner s'intègre avec trois outils d'apprentissage complémentaires.
Ensemble, ils couvrent les différentes phases de l'apprentissage - de
l'acquisition initiale à la maîtrise à long terme.

---

## Anki - Répétition espacée

[Anki](https://apps.ankiweb.net/) est le système de flashcards de référence
pour la répétition espacée. Il planifie les révisions au moment optimal
pour lutter contre l'oubli.

**Intégration dans Adaptive Learner :**

- Le plugin Anki extrait des flashcards de vos sessions ou analyses
  de conversation via un appel IA.
- Vous révisez et modifiez les cartes dans l'application, puis les exportez
  en fichier `.apkg` standard importable dans Anki.
- Les concepts importants des sessions alimentent automatiquement votre
  file d'attente Anki.

**Idéal pour :** vocabulaire, formules, règles grammaticales, tout ce qui
nécessite une mémorisation à long terme.

---

## NotebookLM - Questions d'autoévaluation

[NotebookLM](https://notebooklm.google.com/) de Google est un outil
d'apprentissage basé sur vos propres documents. Il génère des questions
d'autoévaluation qui testent votre compréhension.

**Intégration dans Adaptive Learner :**

- Le plugin NotebookLM génère des questions de rappel actif depuis vos
  sessions ou projets.
- Vous exportez un guide d'étude Markdown avec les questions regroupées
  par concept.
- L'exportation ZIP peut être importée directement dans NotebookLM.

**Idéal pour :** consolidation après les sessions, préparation aux examens,
vérification que vous pouvez réexpliquer un concept.

---

## Tuteur IA adaptatif - Apprentissage interactif

La fonctionnalité principale de l'application : un tuteur IA qui adapte
ses explications, ses exercices et son rythme à votre profil d'apprentissage.

**Comment ça fonctionne :**

- Le tuteur utilise votre profil d'apprentissage pour choisir la méthode
  et le style d'explication.
- L'évaluateur à double invite tourne en parallèle pour évaluer votre
  progression en temps réel.
- La matrice d'invites (6 méthodes × 7 étapes) garantit que chaque
  combinaison de méthode et d'étape produit un comportement IA adapté.

**Idéal pour :** tout apprentissage interactif, en particulier lorsque
vous avez besoin d'explications sur mesure ou de retours immédiats.

---

## Recommandations d'outils

Le tableau de bord affiche des **recommandations d'outils personnalisées**
basées sur votre profil d'apprentissage. Les méthodes à pondération élevée
dans votre profil se traduisent par des suggestions d'outils spécifiques.

Exemples :

| Profil dominant | Outil recommandé | Pourquoi |
|-----------------|-------------------|---------|
| Déductif | Anki | Ancrage des règles à long terme |
| Inductive | NotebookLM | Autoévaluation par découverte |
| Basé sur les erreurs | Anki (cartes d'erreurs) | Révision des erreurs typiques |
| Dialogique | Tuteur IA | Conversation continue |
| Contextuel | Sessions IA | Scénarios simulés |

---

## Recommandations espacées

En complément de la répétition espacée par élément, le tableau de bord
affiche des **recommandations de répétition basées sur la récence** pour
l'ensemble des méthodes :

- Si vous n'avez pas utilisé la méthode inductive depuis 7 jours, une
  carte de rappel apparaît.
- Les éléments ayant le score d'oubli le plus élevé sont prioritaires.

Ces recommandations sont distinctes de la file d'attente SRS par élément
qui suit les erreurs dans les leçons de contenu.
