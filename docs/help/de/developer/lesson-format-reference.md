# Lektionsformat-Referenz

> **Generiert** aus dem kanonischen `learn-content-engine`-Schemaspiegel (`schema/lesson.schema.json`, ein Byte-Spiegel des gepinnten Engine-Release) via `make sync-schema` (EXP-039). Die strukturelle Pydantic-Schicht der App wird aus diesem Spiegel regeneriert; nur die semantischen Validatoren sind handgeschrieben. Nicht von Hand editieren; eine Formatänderung beginnt in der Engine, dann wird der Pin erhöht und der Generator läuft erneut.

Schema-Version: **1.6** (JSON Schema 2020-12). Das maschinenlesbare Schema liegt unter `schema/lesson.schema.json`; referenziere es aus einer Lektions-`.json` via `"$schema"` fuer IDE-Autocomplete + Validierung.

Die Feldbeschreibungen stammen woertlich aus den Modelldefinitionen (englisch).


## Modelle

### `Lesson`

One lesson in a content set (Phase 43 / 2B-lesson).

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `cards` | `Card[]` | no | - |
| `contributed_at` | `string | null` | no | - |
| `contributed_by` | `string | null` | no | - |
| `description` | `string | null` | no | - |
| `domain` | `string | null` | no | - |
| `estimated_minutes` | `number` | no | min=1, max=240 |
| `id` | `string` | yes | minLen=1, maxLen=120 |
| `requires_extensions` | `string[]` | no | - |
| `resources` | `LessonResource[] | null` | no | - |
| `source_language` | `string | null` | no | - |
| `steps` | `LessonStep[]` | yes | minItems=1 |
| `target_language` | `string | null` | no | - |
| `title` | `string` | yes | minLen=1, maxLen=200 |
| `variation_note` | `string | null` | no | - |
| `variation_of` | `string | null` | no | - |


### `Card`

The smallest learnable unit (Phase 43 / 2B-lesson).

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `audio` | `string | null` | no | - |
| `back` | `string` | yes | minLen=1, maxLen=500 |
| `code_language` | `string | null` | no | - |
| `code_snippet` | `string | null` | no | - |
| `difficulty` | `number | null` | no | - |
| `expected_output` | `string | null` | no | - |
| `front` | `string` | yes | minLen=1, maxLen=500 |
| `hint` | `string | null` | no | - |
| `id` | `string` | yes | minLen=1, maxLen=120 |
| `image` | `string | null` | no | - |
| `media_type` | `"text" | "code" | "formula" | "diagram" | null` | no | - |
| `notes` | `string | null` | no | - |
| `tags` | `string[]` | no | maxItems=20 |
| `token_roles` | `CardTokenRole[] | null` | no | - |


### `CardTokenRole`

One ``token → role`` annotation on a card.

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `role` | `TokenRole` | yes | - |
| `token` | `string` | yes | minLen=1, maxLen=120 |


### `ClozeBlank`

One blank inside a cloze exercise's ``sentence`` (Phase 52D / v1.35.0 / P-127).

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `accept` | `string[]` | yes | minItems=1 |
| `hint` | `string | null` | no | - |
| `placeholder` | `string | null` | no | - |


### `Exercise`

One exercise step. Type-tagged via ``type``.

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `accept` | `string[] | null` | no | - |
| `accept_orderings` | `number[][] | null` | no | - |
| `blanks` | `ClozeBlank[] | null` | no | - |
| `card_ids` | `string[]` | no | maxItems=50 |
| `cloze_mode` | `"type" | "select" | "multiselect" | null` | no | - |
| `direction` | `"source_to_target" | "target_to_source" | "both" | "random"` | no | - |
| `distractors` | `string[]` | no | maxItems=20 |
| `examples` | `InlineExample[] | null` | no | - |
| `ext_payload` | `object` | no | - |
| `from_cards` | `boolean` | no | - |
| `hint` | `string | null` | no | - |
| `id` | `string` | yes | minLen=1, maxLen=120 |
| `images` | `PictureImage[] | null` | no | - |
| `multiple` | `boolean` | no | - |
| `options` | `MultipleChoiceOption[] | null` | no | - |
| `pairs` | `Pair[] | null` | no | - |
| `prompt` | `string` | yes | minLen=1, maxLen=1000 |
| `sentence` | `string | null` | no | - |
| `tiles` | `string[] | null` | no | - |
| `type` | `ExerciseType | ExtExerciseType` | yes | - |


### `ExerciseType` (enum)

`matching` · `picture_choice` · `free_text` · `word_tiles` · `cloze` · `multiple_choice`

### `InlineExample`

One inline worked example on a theory step or exercise (schema v1.5).

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `content` | `string` | yes | minLen=1, maxLen=5000 |
| `language` | `string | null` | no | - |
| `title` | `string | null` | no | - |


### `LessonResource`

One lesson-level supplementary-media entry (EXP-029 / MED-05).

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `author` | `string | null` | no | - |
| `description` | `string | null` | no | - |
| `duration` | `string | null` | no | - |
| `free` | `boolean | null` | no | - |
| `language` | `string | null` | no | - |
| `level` | `string | null` | no | - |
| `partnership` | `boolean | null` | no | - |
| `tags` | `string[] | null` | no | - |
| `title` | `string` | yes | minLen=1, maxLen=300 |
| `type` | `string` | yes | minLen=1, maxLen=40 |
| `url` | `string` | yes | minLen=1, maxLen=2000 |


### `LessonStep`

One step in the lesson sequence.

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `body` | `string | null` | no | - |
| `example_label` | `string | null` | no | - |
| `example_url` | `string | null` | no | - |
| `examples` | `InlineExample[] | null` | no | - |
| `exercise` | `Exercise | null` | no | - |
| `id` | `string` | yes | minLen=1, maxLen=120 |
| `review_lesson_id` | `string | null` | no | - |
| `theory_ref` | `string | null` | no | - |
| `title` | `string | null` | no | - |
| `type` | `StepType` | yes | - |


### `MultipleChoiceOption`

One answer option in a MULTIPLE_CHOICE exercise (schema v1.6).

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `correct` | `boolean` | no | - |
| `text` | `string` | yes | minLen=1, maxLen=500 |


### `Pair`

One left↔right pair in a MATCHING exercise.

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `left` | `string` | yes | minLen=1, maxLen=500 |
| `right` | `string` | yes | minLen=1, maxLen=500 |


### `PictureImage`

One image option in a PICTURE_CHOICE exercise.

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `is_correct` | `string | null` | no | - |
| `label` | `string` | yes | minLen=1, maxLen=500 |
| `src` | `string` | yes | minLen=1, maxLen=500 |


### `StepType` (enum)

`theory` · `exercise`

### `TokenRole` (enum)

`article` · `verb` · `noun` · `adjective` · `preposition` · `gender_marker` · `tense_marker`
