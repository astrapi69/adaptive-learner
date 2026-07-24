# Le cycle en sept étapes

Chaque session d'apprentissage dans Adaptive Learner suit un cycle
structuré en sept étapes. Ce cycle est issu de la recherche sur
l'apprentissage efficace et est adapté dynamiquement à votre progression.

---

## Vue d'ensemble du cycle

```
1. Input      → Vous recevez du nouveau matériel
2. Attempt    → Vous essayez de l'appliquer
3. Error      → Une erreur ou un malentendu devient visible
4. Feedback   → L'IA explique ce qui a fonctionné ou pas
5. Adapt      → Vous ajustez votre stratégie
6. Repeat     → Vous pratiquez avec des variations
7. Integrate  → Vous reliez à des connaissances existantes
```

Les étapes 3 et 4 ne sont atteintes **que si** votre tentative à l'étape 2
ne passe pas le seuil de confiance. En cas de haute confiance, le cycle
passe directement à l'étape 5.

---

## L'évaluateur à double invite

Chaque session fait tourner **deux instances IA en parallèle** :

1. **IA enseignante** - génère les explications, les exemples et les
   exercices selon la méthode choisie.
2. **IA évaluatrice** - lit vos réponses et attribue un score de confiance
   (0-100 %). Elle décide si le cycle peut avancer ou si une étape doit
   être répétée.

L'IA évaluatrice n'est jamais visible directement, mais ses décisions
déterminent le rythme de la session.

---

## Seuils de confiance

| Méthode | Seuil pour avancer |
|---------|--------------------|
| Déductive | 70 % |
| Inductive | 70 % |
| Basée sur les erreurs | 75 % |
| Dialogique | 50 % (plus tolérant - exploration) |
| Contextuelle | 65 % |
| IA adaptative | Variable selon l'historique |

---

## Auto-boucle

Après l'étape 7, une **nouvelle boucle** peut démarrer automatiquement
avec le sujet suivant de votre curriculum. L'auto-boucle continue jusqu'à
ce que vous l'arrêtiez ou que le nombre maximum de cycles soit atteint
(par défaut : 5).

Vous pouvez interrompre l'auto-boucle à tout moment via :

- Le bouton **Terminer la session**
- La soumission d'une évaluation après un cycle
- L'acceptation d'une recommandation de changement de méthode

---

## La matrice d'invites

Le système IA utilise une **matrice 42 cellules** (6 méthodes × 7 étapes)
de modèles d'invites. Chaque cellule adapte le rôle de l'IA, la posture
pédagogique et les attentes de sortie à la combinaison méthode/étape précise.

Cela signifie que « l'étape 2 en méthode déductive » et « l'étape 2 en
méthode contextuelle » produisent des exercices fondamentalement différents -
même si les deux sont des étapes « Attempt ».
