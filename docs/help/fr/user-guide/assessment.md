# Test d'évaluation

Le test d'évaluation produit votre **profil d'apprentissage** — un vecteur
pondéré sur les six méthodes qui guide les recommandations de session.

---

## Les 12 questions

Le test comporte 12 questions portant sur vos préférences d'apprentissage,
votre comportement face aux erreurs, votre niveau de confort dans différents
types de tâches et votre style d'interaction préféré avec l'IA.

Les questions sont du type :

- Choix multiple (sélection unique)
- Choix multiple (sélection multiple)

Il n'y a pas de « bonnes » ou « mauvaises » réponses. Le test mesure votre
profil, non vos connaissances.

**Durée estimée :** 3-5 minutes.

---

## Calcul du profil

Chaque réponse porte des pondérations pour une ou plusieurs méthodes.
Le calcul final normalise les sommes de sorte que les six pondérations
donnent ensemble 1,0.

Exemple de résultat :

```json
{
  "deductive": 0.42,
  "inductive": 0.18,
  "error_based": 0.08,
  "dialogic": 0.08,
  "contextual": 0.08,
  "ai_adaptive": 0.15,
  "dominant_method": "deductive"
}
```

---

## Diagramme radar

Après le test, votre profil est affiché sous forme de **diagramme radar**
sur le tableau de bord. Chaque axe représente une méthode ; la surface
couverte montre visuellement votre répartition.

---

## Repasser le test

Vous pouvez repasser le test à tout moment depuis **Paramètres → Apprentissage**.
Un nouveau profil remplace l'ancien — les sessions passées ne sont pas
affectées.

**Quand repasser le test :**

- Après un changement majeur de sujet d'apprentissage
- Si vous constatez que le profil actuel ne reflète plus vos préférences
- Tous les 3 à 6 mois environ pour tenir compte de votre évolution

---

## Profil vs. sélection manuelle

Le profil est une **recommandation**, pas une contrainte. Vous pouvez
choisir n'importe quelle méthode manuellement lors du démarrage de chaque
session, quelle que soit votre pondération. Si vous choisissez souvent
une méthode différente de celle recommandée, c'est un signal pour repasser
le test.
