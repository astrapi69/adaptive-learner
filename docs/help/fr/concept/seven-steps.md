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

L'IA évaluatrice peut aussi proposer de rester sur une étape, d'en sauter
une (par exemple quand votre tentative à l'étape 2 montre que vous avez
déjà compris) ou de revenir en arrière. Sa proposition ne s'applique que
si sa confiance atteint au moins 70 % (voir *Comment l'IA décide*
ci-dessous).

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

## Comment l'IA décide

Après chacun de vos messages et la réponse de l'IA, un second appel à
l'IA lit l'échange et rend un verdict JSON :
`{advance, confidence, reason, suggested_step}`. Si l'IA renvoie un
texte illisible, un repli déterministe avance d'une étape (plafonné à
l'étape 7).

`suggested_step` peut valoir :

- `current + 1` - avancer normalement (le cas le plus fréquent) ;
- `current` - rester ; vous avez besoin de plus de temps ici ;
- un saut en avant (par exemple 1 → 3) - vous avez déjà assimilé
  l'input ;
- un retour en arrière (par exemple 4 → 2) - vous êtes perdu et devez
  réessayer.

La proposition ne s'applique que si `confidence >= 0.7` (la valeur par
défaut de `step_evaluation.confidence_threshold` dans session.yaml). Ce
seuil est le même pour toutes les méthodes ; la méthode change seulement
ce que l'évaluateur regarde. Les verdicts de repli appliquent toujours
l'avance de +1.

---

## Auto-boucle

> Dans la version navigateur, la session reste à l'étape 7 : l'auto-boucle ne fonctionne que dans l'application de bureau. La page de la session l'indique lorsque vous atteignez l'étape 7.

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
