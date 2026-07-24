# Célébrations et encouragements

Adaptive Learner comprend une couche de retours émotionnels qui rend les
moments de réussite tangibles. Elle est entièrement facultative et peut
être ajustée ou désactivée dans les paramètres.

---

## Ce que vous verrez

**Phrases d'encouragement**

Lors d'une bonne réponse dans un exercice, une courte phrase d'encouragement
apparaît (par ex. « Excellent ! », « Exactement ! », « Parfait ! »). Les
phrases sont cyclées sans répétition pour la même session.

**Animations CSS**

Une pulsation légère ou un flash accompagne les bonnes réponses. Ces
animations utilisent uniquement des transitions CSS (transform + opacity) -
aucune bibliothèque d'animation n'est requise. L'option `prefers-reduced-motion`
du système d'exploitation désactive toutes les animations.

**Confettis**

Sur la page de résumé d'une leçon, si vous obtenez 3 étoiles à votre
premier essai, un burst de confettis CSS s'affiche (30 particules, aucun
canvas ni bibliothèque).

**Superpositions de jalons**

Lors d'événements importants (série de 7/30/100 jours, maîtrise de
50/100/500 éléments, montée de niveau), une superposition s'affiche
brièvement avec un message de félicitations et se ferme automatiquement.
Les superpositions sont mises en file d'attente - elles apparaissent une
par une et ne se chevauchent jamais.

---

## Intensité des retours

Dans **Paramètres → Interface → Intensité des retours**, vous pouvez choisir :

| Niveau | Comportement |
|--------|-------------|
| **Subtil** | Animations minimales, pas de phrases |
| **Normal** | Animations modérées, phrases occasionnelles |
| **Enthousiaste** | Animations complètes, phrases fréquentes |

L'option `prefers-reduced-motion` du système d'exploitation force
toujours **Subtil**, quelle que soit la valeur configurée.

---

## Sons

**Désactivés par défaut.** Activez-les dans **Paramètres → Interface → Sons**.

Les effets sonores sont **synthétisés à l'exécution** via Web Audio API -
aucun fichier audio n'est embarqué dans l'application. L'AudioContext est
créé de manière paresseuse lors du premier son déclenché dans un geste
utilisateur.

Six sons différents couvrent différents événements (bonne réponse,
mauvaise réponse, son de mission, accord de montée de niveau, etc.).

---

## Désactiver les célébrations

Pour une expérience épurée :

1. Réglez l'intensité sur **Subtil** pour les animations/phrases
2. Désactivez **Sons** pour les effets audio
3. Désactivez **Afficher la gamification** dans **Paramètres → Gamification**
   pour masquer XP, badges et séries

La couche de célébrations est supplémentaire et son échec ne brisera
jamais le flux de la leçon.
