# Génération d'exercices par l'IA

Une leçon composée uniquement de théorie (sans exercices) peut être
transformée en leçon praticable en demandant à l'IA de **générer des
exercices** à partir de ses cartes. C'est la pipeline EXP-036. Elle
nécessite une clé IA configurée (Paramètres → IA) ; sans clé, le
bouton est visible mais désactivé, avec la raison dans son infobulle.

<!-- TODO: Screenshot - le bouton « Générer des exercices » sur une leçon purement théorique -->

---

## La pipeline

La génération n'est pas un simple appel à l'IA - c'est une pipeline
**génération → contrôle qualité → équilibrage → retour** :

1. **Générer.** Une invite de génération demande au modèle des
   exercices couvrant les types pris en charge ; un analyseur JSON
   défensif tolère les bizarreries de mise en forme habituelles des
   modèles.
2. **Contrôle qualité.** Un contrôle déterministe rejette les
   exercices mal formés, triviaux ou qui font doublon avec des
   exercices existants - avant même que tu ne les voies.
3. **Équilibrer.** La série d'exercices générée est équilibrée entre
   les types d'exercices, de sorte qu'une leçon ne soit pas
   entièrement d'une seule forme.
4. **Régénérer avec un retour.** Si le résultat ne convient pas, tu
   peux régénérer avec un retour pour orienter la tentative suivante.

---

## Par leçon et par ensemble

- **Leçon unique :** un bouton **« Générer des exercices »** apparaît
  sur les leçons purement théoriques.
- **Ensemble complet :** la génération par lots complète en une seule
  exécution les exercices de toutes les leçons purement théoriques
  d'un ensemble.

---

## Qualité et confiance

Comme le contrôle qualité est déterministe, les exercices générés
atteignent le même seuil minimal que les exercices rédigés par un
auteur (suffisamment d'exercices, plus d'un type, aucune carte vide).
La génération complète le contenu rédigé - elle n'écrase jamais
silencieusement tes exercices existants.

Pour vérifier la qualité du contenu *existant* (rédigé ou généré),
voir [Vérification du contenu par l'IA](../user-guide/ai-validation.md).

---

## Pages connexes

- [Vérification du contenu par l'IA](../user-guide/ai-validation.md) - vérifications de qualité à l'échelle de l'ensemble
- [Créer des leçons](../content-creation/overview.md) - construire des leçons toi-même
- [Leçons et révisions](../user-guide/lessons.md) - les types d'exercices
