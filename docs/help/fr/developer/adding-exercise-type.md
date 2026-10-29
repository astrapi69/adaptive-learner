# Ajouter un nouveau type d'exercice

Le modèle canonique n'est **pas** étendu par anticipation. Un nouveau type
d'exercice n'est ajouté que lorsqu'un contenu concret en a besoin, et alors
sous la forme d'une seule petite PR additive. Voici la recette obligatoire,
tirée du travail réel sur le choix multiple `cloze`/`select` (#1342) et du
pipeline de schéma EXP-039.

Avant de commencer, vérifiez qu'il s'agit bien d'un véritable nouveau
**type**, et non d'une présentation ou d'une convention déjà couverte par le
[catalogue des types d'exercice](authoring-content.md#exercise-type-catalog-status)
(choix multiple textuel, Vrai/Faux, liste déroulante/bouton radio/case à
cocher ne sont **pas** de nouveaux types). Il doit être **notable en SRS de
façon binaire** (un seul résultat correct/incorrect par élément) : c'est la
limite que trace la liste « délibérément exclus » du catalogue.

## Étapes

1. **Entrée EXP / justification.** Consignez le besoin, la sémantique de
   notation binaire et la délimitation par rapport aux types existants dans
   l'exploration concernée (`docs/explorations/EXP-041-*` pour l'adéquation
   des types d'exercice, ou une nouvelle EXP). Pas de type sans raison
   documentée.
2. **Étendre le format dans le moteur.** Le foyer canonique du format de
   leçon est le paquet
   [learn-content-engine](https://github.com/astrapi69/learn-content-engine) :
   ajoutez le type à son schéma, à sa couche sémantique écrite à la main
   (`src/rules.ts`) et à sa
   [référence de format](https://github.com/astrapi69/learn-content-engine/blob/main/docs/lesson-format.md),
   puis publiez le moteur. Un changement de format **commence dans le
   moteur** : le `schema/*.json` de l'application est un miroir octet par
   octet de la version épinglée, avec exactement un seul rédacteur
   (`scripts/sync_schema_mirror_from_engine.py`, #2265).
3. **Monter l'épinglage, lancer la synchronisation.** Relevez l'épinglage
   `learn-content-engine` dans `frontend/package.json`, puis lancez
   `make sync-schema` dans la **même PR** : la commande rafraîchit le miroir
   `schema/*.json` depuis le paquet installé et régénère chaque artefact
   dérivé, à savoir la couche structurelle Pydantic
   (`plugins/adaptive-learner-plugin-content-loader/adaptive_learner_content_loader/schema_generated.py`
   via `scripts/generate_pydantic_models.py`), le miroir du schéma ajv
   côté navigateur (`frontend/src/lib/content/validation/lesson.schema.generated.json`)
   avec son validateur autonome, et la
   documentation de référence du format. **Ne modifiez jamais à la main** un
   artefact miroir ou généré ; la porte de dérive `make sync-schema-check`
   échoue si vous le faites.
4. **Version du schéma.** Gardez `CURRENT_SCHEMA_VERSION` dans `models.py`
   aligné sur la version de schéma du moteur épinglé (**mineure** = additive ;
   l'ancien contenu reste valide grâce à la correspondance de version
   majeure). N'ajoutez pas de règles inter-champs côté application dans
   `plugins/adaptive-learner-plugin-content-loader/adaptive_learner_content_loader/schema.py` :
   les règles sémantiques appartiennent au moteur et s'exécutent au moment de
   la rédaction et dans le frontend avant l'enregistrement d'un set
   utilisateur (#3245) ; le backend ne fait que stocker et servir la leçon.
5. **Enregistrer le moteur de rendu.** Ajoutez la branche et le type à
   `SUPPORTED_EXERCISE_TYPES` dans
   `frontend/src/components/exercises/shell/ExerciseDispatcher.tsx`. Le
   **registre doit être égal à l'énumération** : un test de parité l'impose,
   donc un type sans rendu fait échouer la CI (l'invariant qui empêche le
   schéma mort).
6. **Câbler la notation / le SRS.** Émettez un `ExerciseScored` depuis le
   moteur de rendu via `useControlledExercise` ; le chemin partagé
   `onComplete` → `recordStepResult` dans `LessonStepView.tsx` répartit déjà
   chaque tentative via `getStorage().elementErrors.recordBulk`. Réutilisez-le,
   n'ajoutez pas de second chemin d'enregistrement.
7. **Validation du dépôt de contenu.** Étendez le validateur client
   (`frontend/src/lib/content/validation/content-validator.ts`). Les minimums
   de qualité vivent dans le `quality-rules.json` du moteur (mis en miroir dans
   `schema/quality-rules.json`) ; si le type les affecte, étendez-les dans le
   moteur, pas dans l'application.
8. **Documentation de rédaction.** Ajoutez le type au
   [tableau du catalogue](authoring-content.md#exercise-type-catalog-status) et
   un bloc de référence `### <type>` avec un exemple JSON (EN + DE).
9. **Tests.** Le schéma accepte un exemple valide et rejette un exemple
   invalide (champ obligatoire manquant / clé en trop) ; le moteur de rendu
   affiche et note correct/faux ; la tentative SRS est enregistrée ; ajoutez
   une référence visuelle mobile si l'apparence du contrôle est nouvelle.
10. **Suivi (pas dans cette PR).** Les dépôts de contenu
    (`adaptive-learner-content`) adoptent le nouveau type lorsqu'ils
    réépinglent leur version du moteur ; notez-le, sans vous bloquer dessus.

## Pourquoi cela reste petit

Parce que le format est mis en miroir depuis la version épinglée du moteur et
que chaque artefact de l'application dérive de ce miroir (étape 3), et que le
test de parité du dispatcher impose registre égal à énumération (étape 5), un
nouveau type est un changement additif à la forme fixe : moteur → épinglage →
génération → rendu → notation → docs → tests. Aucune copie parallèle
maintenue à la main ne peut dériver, et aucun type ne peut être livré sans
moteur de rendu.
