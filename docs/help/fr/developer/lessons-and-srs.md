# Leçons et SRS — fonctionnement interne

Cette page documente la manière dont la pile de fonctionnalités
leçons + SRS (v1.27.0–v1.31.0) est câblée entre le backend, le
frontend et deux plugins. Pour la vue utilisateur, consultez
[`user-guide/lessons.md`](../user-guide/lessons.md).

---

## Architecture générale

```
┌──────────────────────────────────────────────────────────┐
│ Frontend : lecteur de leçons + session de révision       │
│   pages/Lesson.tsx  ──→  ExerciseDispatcher  ──→  l'un   │
│   pages/Review.tsx           ↓               des 4       │
│                              ↓               composants   │
│                              ↓               d'exercice   │
│                   recordStepResult                       │
│                              ↓                           │
│                  elementErrors.recordBulk                │
│                              ↓                           │
└──────────────────────────────────────────────────────────┘
                              ↓
                   Frontière IStorageService
                              ↓
   ┌─────────────────────┐      ┌─────────────────────────┐
   │ ApiStorage          │      │ DexieStorage            │
   │                     │      │                         │
   │ POST /api/users/    │      │ element-errors-dexie.ts │
   │   {id}/element-     │      │   reproduit le service  │
   │   errors            │      │   backend 1:1 contre    │
   │                     │      │   IndexedDB             │
   └─────────────────────┘      └─────────────────────────┘
            ↓
   ┌──────────────────────────────────────────────────────┐
   │ Backend                                              │
   │                                                      │
   │  app/services/element_errors.py                      │
   │    - matrice de transition upsert                    │
   │    - MASTERY_THRESHOLD = 3                           │
   │                                                      │
   │  app/services/element_srs.py                         │
   │    - planificateur à bandes 1j/3j/7j                 │
   │    - tri : en retard → error_count → last_error_at   │
   │                                                      │
   │  app/services/lesson_progress.py                     │
   │    - upsert_progress avec bascule mark_completed     │
   │      déclenchant lesson_session_unification          │
   │                                                      │
   │  app/services/lesson_session_unification.py          │
   │    - find_or_create_content_pseudo_project (paresseux)│
   │    - record_lesson_completion_session                │
   │    - déclenche on_session_complete via manager._pm.hook│
   └──────────────────────────────────────────────────────┘
                              ↓
            ┌─────────────────────────────────┐
            │ Plugin Gamification             │
            │   dispatch on_session_complete  │
            │     method == "content"  →      │
            │       award_xp_for_lesson_      │
            │       session (formule leçon)   │
            │     else →                      │
            │       award_xp_for_session      │
            │       (formule chat, inchangée) │
            │   badge_service.evaluate_user   │
            │     → 4 nouveaux prédicats      │
            └─────────────────────────────────┘
```

---

## Suivi des erreurs au niveau des éléments (v1.30.0 / Phase 46B)

### Modèle

`app/models/__init__.py:ElementError` avec une contrainte UNIQUE
composite sur
`(user_id, set_id, lesson_id, exercise_id, element_key)`.
Clés d'éléments scoped par leçon selon la décision **D2** — le
même mot dans deux leçons différentes produit deux lignes.

```python
class ElementError(Base):
    user_id: str           # FK → users.id (CASCADE)
    set_id: str            # id de l'ensemble de contenu (string, pas FK)
    lesson_id: str         # id de la leçon (string, pas FK)
    exercise_id: str       # id de l'exercice dans la leçon
    element_key: str       # le mot/paire/phrase spécifique
    element_type: str      # "vocabulary" | "grammar_rule"
    user_answer: str
    correct_answer: str
    error_count: int       # incrémenté à chaque tentative incorrecte
    correct_streak: int    # incrémenté si correct, remis à 0 si incorrect
    last_error_at: datetime | None
    last_attempt_at: datetime
    mastered: bool         # True ssi correct_streak ≥ 3
    mastered_at: datetime | None
```

Découplé de `learning_sessions` (pas de FK) par conception — les
leçons de contenu référencent les IDs de l'ensemble et de la leçon
par string, sans jointure relationnelle. La table survit donc aux
évictions du cache indépendamment de toute ligne de session.

### Matrice de transition upsert

`app/services/element_errors.py:upsert_element_error` est le
seul mutateur. Comportement :

| Déclencheur | Action |
|---|---|
| Première occurrence (correct) | INSERT ligne, `correct_streak=1` |
| Première occurrence (incorrect) | INSERT ligne, `error_count=1` |
| Ligne existante, tentative correcte | `correct_streak += 1` ; bascule `mastered=True` si la série atteint `MASTERY_THRESHOLD` (3) |
| Ligne existante, tentative incorrecte sur une ligne non maîtrisée | `error_count += 1`, `correct_streak = 0` |
| Ligne existante, tentative incorrecte sur une ligne **maîtrisée** | rétrogradation : `mastered=False`, `mastered_at=None`, `correct_streak=0`, `error_count += 1` |

Le seuil de maîtrise est une constante au niveau du code
(`MASTERY_THRESHOLD = 3`) ; selon la décision **D4**, il est
intrinsèque à la sémantique SRS et n'est pas un paramètre
configurable.

### Miroir Dexie

`frontend/src/storage/element-errors-dexie.ts` reproduit le
service backend 1:1 contre IndexedDB. Le contrat sur
`IElementErrorsNamespace` est identique dans les deux
implémentations de stockage, de sorte que la porte de sortie
Dexie (`make test-dexie-smoke`) détecte toute dérive.

---

## Planification SRS (v1.30.0 / Phase 46C)

### Politique d'intervalles

`app/services/element_srs.py:next_review_due_at` projette la
prochaine révision d'une ligne non maîtrisée :

| `correct_streak` | Intervalle |
|---|---|
| 0 | 1 jour après `last_attempt_at` |
| 1 | 3 jours |
| 2 | 7 jours |
| ≥ 3 | maîtrisé — exclu de la file |

### Tri par priorité

L'endpoint de la file de révision trie par :

1. **En retard en premier** (`next_review_due_at < now` prime
   sur `next_review_due_at > now`)
2. **Nombre d'erreurs décroissant** (plus d'erreurs = priorité
   plus haute)
3. **Dernière erreur en premier** (l'échec le plus récent prime
   sur les plus anciens, résolution à la microseconde via
   `-last_error_at.timestamp_us`)

Le tuple est clé par `_sort_key` qui retourne
`tuple[int, int, int]`.

### Endpoint

`GET /api/users/{user_id}/element-errors/review-queue`
retourne la file priorisée. Équivalent côté Dexie :
`computeReviewQueueDexie` dans
`element-errors-dexie.ts`. Le widget `<ReviewQueueCard>` du
tableau de bord appelle l'un ou l'autre selon le mode de
stockage configuré et affiche le compte + le badge en retard +
un appel à l'action vers la session de révision.

---

## Unification LessonProgress ↔ LearningSession (v1.31.0 / Phase 46F)

### La décision

Le travail `ElementError` de v1.30.0 s'est intentionnellement
découplé de `LearningSession`. La Phase 46F de v1.31.0 ajoute
la couche d'unification : chaque complétion de leçon de contenu
écrit désormais une ligne `LearningSession` afin que la
mécanique existante de gamification + suivi + séries la capte
sans nouveaux hooks.

Trois décisions déterminent la forme :

- **D1 (pseudo-projet paresseux)** : un `LearningProject`
  « Leçons de contenu » avec `kind="content"` est créé
  automatiquement à la première complétion de leçon (jamais
  initialisé lors de l'onboarding). Un seul par utilisateur.
- **D2 (`method="content"`, 7e valeur)** : ajouté à l'ensemble
  des valeurs valides de `LearningSession.method` spécifiquement
  pour le chemin d'unification. Les six autres méthodes
  (deductive / inductive / error_based / dialogic / contextual /
  ai_adaptive) couvrent les sessions de chat sans changement.
- **D5 (réutiliser, ne pas étendre)** : pas de nouveau hookspec.
  `record_lesson_completion_session` déclenche le hook existant
  `on_session_complete` via `manager._pm.hook`. Les gestionnaires
  existants des plugins de gamification et de suivi s'exécutent
  comme si la leçon était une session de chat, avec dispatch sur
  `method`.

### Changement de schéma

```python
# app/models/__init__.py — Phase 46F.1
LEARNING_PROJECT_KIND_STANDARD = "standard"
LEARNING_PROJECT_KIND_CONTENT = "content"

class LearningProject(Base):
    ...
    kind: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default=LEARNING_PROJECT_KIND_STANDARD,
        server_default=LEARNING_PROJECT_KIND_STANDARD,
    )
```

Alembic `0020_learning_project_kind` ajoute la colonne via
`batch_alter_table` + `add_column` avec `server_default="standard"`
afin que les lignes existantes soient renseignées proprement sous
SQLite. La surface de synchronisation reprend la colonne pour que
l'aller-retour `ApiStorage` ↔ `DexieStorage` fonctionne dans les
deux sens.

### Utilitaire d'unification

`app/services/lesson_session_unification.py` comporte deux
fonctions publiques :

- `find_or_create_content_pseudo_project(db, user_id)` —
  recherche idempotente ; crée uniquement si absent.
- `record_lesson_completion_session(db, *, user_id,
  lesson_progress_id, score_correct, score_total)` —
  écrit la ligne `LearningSession`, effectue le commit, puis
  déclenche `on_session_complete`.

Les deux sont invoquées depuis
`app/services/lesson_progress.py:upsert_progress` quand la
ligne passe de `in_progress` à `completed`. Le chemin de
déclenchement du hook encapsule les exceptions des abonnés —
un plantage de la gamification ne peut pas annuler la leçon que
l'utilisateur a déjà vue sur l'écran de résumé.

### Filtre frontend

`frontend/src/lib/learning-project.ts` expose
`isStandardProject` + `filterStandardProjects`. Trois
consommateurs appliquent ce filtre :

- `DashboardFilterBar.tsx` (le sélecteur de projet du tableau de bord)
- `ExportSection.tsx` (sélecteur d'export)
- `Anki.tsx` (menu déroulant de projet Anki)

L'endpoint backend expose intentionnellement le pseudo-projet
pour qu'une future vue « toute l'activité » puisse l'inclure.
Le filtre est une décision de politique UI, pas du masquage
de données.

---

## Formule XP des leçons (v1.31.0 / Phase 46E.1)

`adaptive_learner_gamification.xp_service` gagne :

- `compute_stars(correct, total)` — de 0 à 3 étoiles selon un
  score, avec des bandes à 50 % / 75 % / 90 %. Reproduit le
  `computeStars` du frontend dans `lib/lesson-summary.ts` afin
  que les deux côtés projettent le même nombre d'étoiles.
- `calculate_lesson_session_xp(*, stars, first_attempt,
  streak_days)` — calculateur pur. 30 de base + 10/étoile +
  20 (première tentative 3 étoiles) + même multiplicateur de
  série +25 %/jour (plafonné à 7) que la formule chat.
- `_is_first_attempt(db, lesson_progress_id)` — lit le JSON
  `LessonProgress.step_results` et retourne True si et
  seulement si chaque ligne de pas a `attempts == 1`.
- `award_xp_for_lesson_session(db, *, session)` — couche de
  persistance qui résout l'user_id à partir de la FK du projet
  et applique la formule.

Le dispatch se produit dans `GamificationPlugin.on_session_complete`
selon `session["method"]`. Les méthodes de chat restent sur
`award_xp_for_session`. La méthode content est routée vers la
formule leçon.

---

## Badges de leçons (v1.31.0 / Phase 46E.2)

Quatre nouveaux prédicats ajoutés à
`adaptive_learner_gamification.badge_service._EVALUATORS` :

| Clé | Prédicat | Utilitaire |
|---|---|---|
| `first_lesson` | `_completed_lesson_count >= 1` | compte les `LessonProgress.status="completed"` (pas via LearningSession — la ligne de leçon fait autorité) |
| `lessons_10` | `_completed_lesson_count >= 10` | idem |
| `three_star_streak` | `_last_n_lessons_all_three_star(n=3)` | lit les 3 derniers `LessonProgress` complétés par `completed_at` desc ; projette chacun via `xp_service.compute_stars` |
| `review_master` | `_mastered_elements_count >= 50` | compte `ElementError.mastered=True` |

Nombre de badges dans le catalogue : **24 → 28** (+1 getting_started
+1 consistency +2 depth). Le test de symétrie existant
(dans `backend/tests/test_gamification_badges_integration.py`)
détecte toute dérive entre les deux listes.

---

## Spécificités selon le mode de stockage

La chaîne de suivi des éléments + SRS fonctionne de manière
identique dans **les deux** modes de stockage — le contrat
`IElementErrorsNamespace` est agnostique au mode et la porte
de sortie Dexie (18 specs incluant la route `/review`) bloque
toute régression.

L'unification leçon-session + les effets secondaires de
gamification sont **limités au mode API**. En mode Dexie, la
complétion de leçon écrit toujours `LessonProgress`, enregistre
toujours les lignes `ElementError`, et alimente toujours la file
de révision — mais l'écriture `LearningSession` + le hook
`on_session_complete` ne se déclenchent jamais (pas de backend,
pas de hook possible). Les utilisateurs Dexie bénéficient de la
boucle de révision complète ; les attributions XP/badges du
chemin chat fonctionnent toujours, mais les complétions de leçons
ne contribuent pas encore à ce total.

---

## Où chercher

- `backend/app/services/element_errors.py` — la matrice de
  transition upsert.
- `backend/app/services/element_srs.py` — le planificateur.
- `backend/app/services/lesson_session_unification.py` —
  le pseudo-projet + le déclenchement du hook.
- `plugins/adaptive-learner-plugin-gamification/
  adaptive_learner_gamification/xp_service.py` —
  `calculate_lesson_session_xp` + dispatch.
- `plugins/adaptive-learner-plugin-gamification/
  adaptive_learner_gamification/badge_service.py` —
  les quatre nouveaux prédicats.
- `frontend/src/lib/learning-project.ts` — l'utilitaire de
  filtre du pseudo-projet.
- `e2e/dexie/dexie-mode.spec.ts` — la porte de sortie qui
  prévient les régressions en mode Dexie (spec leçon sur
  `/lesson/...`, spec révision sur `/review/...`).

---

## Token-diff + exercices Cloze + round de correction (v1.35.0 / Phase 52)

Trois ajouts en couches qui transforment la relecture passive en
apprentissage actif :

**Token-diff + DiffHighlight** — les mauvaises réponses en texte
libre et word-tiles affichent désormais
`<DiffHighlight tokens={tokenDiff(input, canonical)} />` en
ligne sous le paragraphe de résultat. Le résumé de leçon affiche
le même diff pour les exercices texte libre + word-tiles quand le
`user_answer` stocké en v1.35.0+ est disponible (les lignes plus
anciennes replient sur la ligne canonique uniquement). Algorithme
dans `frontend/src/lib/exercises/token-diff.ts` — LCS pur au
niveau des mots, normalisé NFC, sensible à la casse et aux
accents.

**Type d'exercice Cloze (schéma 1.1)** — cinquième ExerciseType :
remplissage avec des marqueurs `___` visibles. Deux modes
d'affichage : `type` (par défaut, `<input>`) et `select`
(`<select>` avec options issues de `distractors`). Suivi SRS
par blanc via `deriveClozeAttempts` — un ElementAttempt par
blanc, permettant un suivi de maîtrise par blanc clair.
Composant dans
`frontend/src/components/exercises/ClozeExercise.tsx` ;
schéma dans
`plugins/adaptive-learner-plugin-content-loader/
adaptive_learner_content_loader/schema.py`.

**Générateur de Cloze** — `generateClozeFromError(error,
sourceExercise, sourceCard)` synthétise une étape Cloze à partir
d'un ElementError. Algorithme :

1. Si `sourceCard.token_roles` contient une entrée dont le
   `token === error.correct_answer`, remplacer ce token par `___`
   dans `sourceCard.front`.
2. Sinon, si `sourceCard.front` contient littéralement
   `error.correct_answer` exactement une fois, mettre `___`.
3. Sinon, si la source est free_text et que son prompt contient
   la réponse exactement une fois, mettre `___`.
4. Sinon, retourner null — l'appelant replie sur la relecture.

Déterministe : mêmes entrées → sortie identique octet à octet.
Pas d'IA, pas d'aléatoire, pas d'async. Les distracteurs portent
`error.user_answer` en premier (quand différent de la bonne
réponse), puis `sourceExercise.distractors` filtrés et dédupliqués.
Code dans `frontend/src/lib/exercises/cloze-generator.ts`.

**Round de correction en fin de leçon** —
`<CorrectionBlock />` se monte dans `LessonSummary` entre le
score/résumé et les boutons d'action. Au montage, il lit les
lignes ElementError de la leçon qui vient de se terminer, génère
un Cloze pour chaque échec non maîtrisé (plafond de 5), et fait
parcourir l'utilisateur. Chaque Cloze complété écrit de nouvelles
lignes ElementAttempt contre le même `element_key` que celui de
l'échec original, afin que la série SRS et la maîtrise avancent.
Se masque automatiquement en cas de score parfait / aucune erreur
/ aucun Cloze constructible. Code dans
`frontend/src/components/exercises/CorrectionBlock.tsx`.

**Cloze dans les sessions de révision (Phase 52G)** —
la branche par élément de `synthesizeReviewLesson`
(`_buildReviewStep`) choisit désormais :

- source free_text ou word_tiles → essayer Cloze, replier sur
  relecture
- matching, picture_choice, cloze → toujours relecture

**Rôles de tokens sur les cartes (Phase 52I)** — annotation
optionnelle `token_roles: list[{token, role}]` sur Card avec
un ensemble fermé de rôles grammaticaux (article / verb / noun
/ adjective / preposition / gender_marker / tense_marker). Le
générateur s'en sert pour choisir un blanc sémantiquement
significatif au lieu de se fier à la correspondance par
sous-chaîne. Ajouter un rôle est un bump mineur de
`schema_version` — garder l'ensemble fermé.
