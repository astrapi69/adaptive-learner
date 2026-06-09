# Quoi de neuf (v1.61 – v1.69)

Un aperçu orienté utilisateur des versions depuis la v1.61.0. Les
notes techniques complètes par version se trouvent sous
[GitHub Releases](https://github.com/astrapi69/adaptive-learner/releases).

---

## v1.69.0 — Liens d'exemple + recommandations de livres

- **Liens d'exemple dans la théorie :** une étape de théorie peut
  porter un lien optionnel « Voir l'exemple ».
- **Recommandations de livres par domaine** dans le navigateur de
  contenu
  ([Recommandations de livres](content-creation/books.md)).
- **Raccourci Entrée aussi dans la reprise des erreurs**
  (« Répéter les erreurs »).
- **Correctif de sauvegarde :** le titre de l'ensemble est
  correctement lu depuis le manifeste lors de la restauration.

## v1.68.0 — Export des résultats + liens retour vers la théorie

- **Exporter le résultat de la leçon :** « Copier le résultat » /
  « Enregistrer comme fichier » (rapport Markdown pour les
  assistants IA).
- **Liens retour vers la théorie :** sauter d'un exercice à la
  théorie correspondante et revenir.
- **Exercice d'association remanié :** paires colorées + badges
  numérotés (sûr pour le daltonisme).
- **Contraste en mode sombre** corrigé à plusieurs endroits.

## v1.67.1 — Restauration de sauvegarde + stabilité du déploiement

- Correctif systématique de la **restauration de sauvegarde**.
- Rechargement automatique en cas de fragment de déploiement
  obsolète.
- Peaufinage du filtre par sujet (masqué à ≤ 1 sujet, le plus
  utilisé en premier).

## v1.65.0 — Évaluation reprenable + raccourci Entrée

- **Évaluation reprenable :** interrompre le test et le reprendre
  plus tard là où tu t'es arrêté.
- **Raccourci Entrée :** Entrée vérifie un exercice répondu et
  passe à la suite (commutable dans Paramètres → Apprentissage).
- Exercices d'association plus clairs + passage sur les jetons de
  design.

## v1.64.0 — Refonte de l'intégration

- **Démarrage rapide avec seulement le nom + le sujet** ; le reste
  prend des valeurs par défaut.
- **Assistant d'intégration** optionnel (une question par écran).
- L'**évaluation est désormais optionnelle**
  ([Intégration](user-guide/onboarding.md)).

## v1.63.0 — Préréglages de thèmes WCAG AA

- **6 thèmes recommandés** (Catppuccin Latte/Mocha, Supabase,
  Graphite, Soft Pop, Amethyst Haze), conformes AA par le calcul
  ([Système de thèmes](developer/themes.md)).
- Audit i18n systématique ; filtre du tableau de bord lié à
  l'utilisateur.

## v1.62.0 — Intégrité des sauvegardes + provenance du build

- Renforcement de la **restauration de sauvegarde** (coercition
  des types de données, ordre des FK).
- À propos affiche de vraies infos de build au lieu de « unknown ».

## v1.61.0 — Conformité des boutons + reprise de leçon

- Conformité des boutons shadcn à l'échelle de l'application.
- **Leçon en pause** reprise à l'étape exacte.
- Validation de contenu inter-dépôts.

---

## Grands axes de la période

- **Plusieurs dépôts de contenu (EXP-023) :** connecter ses
  propres dépôts, en gérer plusieurs, partager par lien/QR,
  niveaux de confiance, dépôts recommandés, évaluations locales
  ([Plusieurs dépôts de contenu](features/content-repos.md)).
- **Sauvegarde comme instantané complet** avec import
  inter-identités
  ([Sauvegarde et restauration](features/backup.md)).

---

## Pages connexes

- [Premiers pas](user-guide/getting-started.md)
- [GitHub Releases](https://github.com/astrapi69/adaptive-learner/releases) — notes complètes
