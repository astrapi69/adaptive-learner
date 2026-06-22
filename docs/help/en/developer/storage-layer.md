# Storage layer

The storage layer (`frontend/src/storage/`) gives the
frontend two interchangeable backends behind a single
contract. The contract has grown to 29 namespaces.

## Directory layout

`storage/` holds the two `IStorageService` implementations and
the factory at its root, with the ported logic grouped into
ten concern subdirectories:

- Root: `api-storage.ts` (ApiStorage), `dexie-storage.ts`
  (DexieStorage), `index.ts` (the `getStorage()` factory).
- Subdirs: `ai/`, `anki/`, `backup/`, `content/`, `dexie/`,
  `gamification/`, `lessons/`, `services/`, `sync/`, `types/`
  (and `types/` itself splits into `content/`, `core/`,
  `integrations/`, `learning/`).

## IStorageService

`frontend/src/storage/types/core/service.ts` defines the
interface every storage implementation satisfies. It mirrors
the `api.*` namespaces from `api/client.ts` 1:1:

```typescript
export interface IStorageService {
  readonly mode: StorageMode;
  health(): Promise<{ status: string; version: string; debug: boolean }>;
  // Core
  i18n: II18nNamespace;
  users: IUsersNamespace;
  projects: IProjectsNamespace;
  settings: ISettingsNamespace;   // get/set including key_source_*
  assessment: IAssessmentNamespace;
  session: ISessionNamespace;     // includes streamMessage()
  tracking: ITrackingNamespace;
  tools: IToolsNamespace;
  curricula: ICurriculaNamespace;
  topics: ITopicsNamespace;
  lessons: ILessonsNamespace;
  plugins: IPluginsNamespace;
  imports: IImportsNamespace;
  system: ISystemNamespace;
  // Backup + export
  backup: IBackupNamespace;
  export: IExportNamespace;
  // Taxonomy
  subjects: ISubjectsNamespace;
  tags: ITagsNamespace;
  projectTaxonomy: IProjectTaxonomyNamespace;
  // Gamification + exports
  gamification: IGamificationNamespace;
  anki: IAnkiNamespace;
  pronunciation: IPronunciationNamespace;
  notebooklm: INotebookLmNamespace;
  // Content + learning
  contentLoader: IContentLoaderNamespace;
  lessonProgress: ILessonProgressNamespace;
  elementErrors: IElementErrorsNamespace;
  pluginSettings: IPluginSettingsNamespace;
  learningRepo: ILearningRepoNamespace;
  missions: IMissionsNamespace;
  github: IGitHubNamespace;
  reset(confirmation: string): Promise<{ reset: true; tables_cleared: number }>;
}
```

Every page consumes `IStorageService` via the `getStorage()`
factory. Pages never import `api/client.ts` or the Dexie
database directly.

## ApiStorage

`storage/api-storage.ts` is a thin pass-through to `api.*`.
Every method delegates 1:1.

## DexieStorage

`storage/dexie-storage.ts` persists everything to IndexedDB
via Dexie 4. The schema in `storage/dexie/db.ts` mirrors all 30
SQLAlchemy models 1:1, plus the association tables
(`project_subjects` / `project_tags` / etc.).

`DexieStorage` is NOT a god-file. It is split into per-domain
namespace modules grouped by concern. The Dexie engine, the
generic CRUD namespaces, and the schema migrations live under
`storage/dexie/`:

| Module | Responsibility |
|---|---|
| `dexie/db.ts` | Dexie database engine + schema versions |
| `dexie/db-migrations.ts` | additive forward migrations |
| `dexie/db-rows.ts` / `dexie/dexie-rows.ts` | row shapes + generic CRUD |
| `dexie/dexie-users.ts` | users + projects namespaces |
| `dexie/dexie-settings.ts` | settings namespace |
| `dexie/dexie-session.ts` | session orchestration |
| `dexie/dexie-curricula.ts` | curricula + topics |
| `dexie/dexie-taxonomy.ts` | subjects + tags + projectTaxonomy |
| `dexie/dexie-imports.ts` | imports namespace |
| `dexie/dexie-user-data.ts` | contributions, custom learning paths, language-redundancy state |
| `dexie/badges-data.ts` | bundled badge seed catalogue |

Domain-specific Dexie namespaces live with their domain logic
instead of in `dexie/`:

| Module | Responsibility |
|---|---|
| `gamification/dexie-gamification.ts` | XP / badges / streak |
| `gamification/lesson-xp-dexie.ts` | lesson-XP rule |
| `gamification/missions-dexie.ts` | daily missions |
| `lessons/lesson-progress-dexie.ts` | lesson progress |
| `lessons/element-errors-dexie.ts` | element-level error tracking (SRS) |
| `content/content-loader-dexie.ts` | content sets |

The ported AI + session logic lives under `storage/ai/`:

| Module | Responsibility |
|---|---|
| `ai/prompts.ts` | 42-cell system-prompt matrix |
| `ai/step-evaluator.ts` | dual-prompt step-evaluation port |
| `ai/session-flow.ts` | start + message orchestration |
| `ai/ai-providers.ts` | Anthropic/OpenAI/Gemini HTTP clients |

The assessment / tracking / tools logic lives under
`storage/services/`:

| Module | Responsibility |
|---|---|
| `services/assessment.ts` | 12-question pack + profile calculator |
| `services/tracking.ts` | aggregator + buildCommitFromSession |
| `services/tools.ts` | rankTools + buildSpacedRecommendations |

Bundled data lives in `frontend/src/data/`:

- `assessment-questions.json` — exported verbatim from the
  backend's `QUESTIONS` list (12 questions, multilingual).
- `session-prompts.json` — exported verbatim from the backend's
  `_PROMPTS` dict (6 methods × 7 steps).

## Dexie data integrity

IndexedDB is multi-tab and async, so a naive
get-spread-put loses concurrent updates. DexieStorage uses:

- **Atomic mutation, never unguarded read-modify-write.**
  `table.modify(...)` for in-place field updates and
  `db.transaction("rw", ...)` to wrap a full-replace `update`.
- **Unique indexes as the DB-level backstop** (e.g. `&user_id`
  on the singletons, `&key` on badges, the compound
  `&[user_id+badge_id]` on `userBadges`).
- **Additive forward migrations.** A new index or table raises
  the Dexie schema version; the upgrade backfills / dedupes
  existing rows. An existing version's stores are never mutated
  in place — a new `version(n)` is added instead.

## Backup format

The backup is an `.alb` file — a ZIP, not a single JSON dump.
The ZIP carries a localStorage snapshot alongside the table
data, so a restore round-trips both IndexedDB / SQLite state
and the localStorage-backed preferences. Code lives under
`storage/backup/`.

## Adding a third storage backend

Implement `IStorageService` with whatever persistence layer
you like (Supabase, Firestore, a custom REST API). Register it
in `storage/index.ts`'s factory:

```typescript
if (mode === "supabase") {
  cachedStorage = supabaseStorage;
}
```

Add the mode to the `StorageMode` type in
`storage/types/core/service.ts`:

```typescript
export type StorageMode = "api" | "dexie" | "supabase";
```

Wire it into the Settings UI's storage-mode section. No other
file changes — pages still go through `getStorage()`.

## Browser-direct AI calls

`storage/ai/ai-providers.ts` implements three provider clients:

- **Anthropic** — POST to `https://api.anthropic.com/v1/messages`
  with the `anthropic-dangerous-direct-browser-access: true`
  header. This is Anthropic's explicit opt-in for browser
  callers; without it CORS rejects.
- **OpenAI** — POST to `https://api.openai.com/v1/chat/completions`
  with `Authorization: Bearer ${apiKey}`. CORS open by default.
- **Gemini** — POST to
  `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}`.
  Query-param auth, no system field; system messages get
  folded into the first user turn.

All three normalise errors into `ApiError(status, "Provider: detail")`
so the existing frontend toast / GitHub-Issue UX renders them
without branching.

## Why cleartext API keys in Dexie mode?

In Dexie mode the user's API key sits in IndexedDB cleartext
(`UserSettings.api_key_{provider}`). Acceptable threat model:

- The data never leaves the user's own device.
- The AI provider IS the only network endpoint that ever sees
  the key.
- Encrypting in IndexedDB would require either a per-session
  password prompt (UX hostile) or a fixed key bundled in the
  app (security theatre — the attacker has the bundle).

The Server-mode behaviour is different: API keys go through
Fernet encryption at rest (`ADAPTIVE_LEARNER_SECRET_KEY`).
ApiStorage never sees the cleartext.

Both modes also surface a per-provider source attribution
(`UserSettings.key_source_anthropic | openai | gemini`) so
the UI can render "Key from: secrets.yaml" / "environment" /
"Settings". In Dexie mode the source collapses to `settings`
or `none` because the browser sandbox has no filesystem
access — `secrets.yaml` is a desktop / server-mode concept.

## Mode resolution

`storage/index.ts` resolves the mode in this order:

1. Build-time `VITE_STORAGE_MODE === "dexie"` — a Dexie-only
   deployment (GH Pages / installed PWA) has no backend, so this
   is authoritative and wins over any persisted preference. A
   stale persisted `"api"` choice could never be satisfied there
   and would 404 every request.
2. `localStorage["adaptive-learner.storage_mode"]` — the user's
   choice from Settings, consulted only when the build is NOT a
   dexie-only build.
3. `VITE_STORAGE_MODE` (any other value) — build-time default.
4. Fallback: `"api"` (local dev default).

The result is cached for the page's lifetime. Test code can
reset via `_resetStorageCacheForTests()`.
