# Storage layer

The v0.7.0 storage layer (`frontend/src/storage/`) gives the
frontend two interchangeable backends behind a single
contract.

## IStorageService

`frontend/src/storage/types.ts` defines the interface every
storage implementation satisfies. It mirrors the
`api.*` namespaces from `api/client.ts` 1:1:

```typescript
export interface IStorageService {
  readonly mode: StorageMode;
  health(): Promise<HealthInfo>;
  i18n: II18nNamespace;
  users: IUsersNamespace;
  projects: IProjectsNamespace;
  settings: ISettingsNamespace;
  assessment: IAssessmentNamespace;
  session: ISessionNamespace;
  tracking: ITrackingNamespace;
  tools: IToolsNamespace;
  curricula: ICurriculaNamespace;
  topics: ITopicsNamespace;
  lessons: ILessonsNamespace;
  plugins: IPluginsNamespace;
}
```

Every page consumes `IStorageService` via the `getStorage()`
factory. Pages never import `api/client.ts` or the Dexie
database directly.

## ApiStorage

`storage/api-storage.ts` is a thin pass-through to `api.*`.
Every method delegates 1:1. Behaviour is identical to v0.6.0.

## DexieStorage

`storage/dexie-storage.ts` persists everything to IndexedDB
via Dexie 4.4.2. Schema in `storage/db.ts` mirrors all 14
SQLAlchemy models 1:1 (users, userSettings, learningProjects,
learningProfiles, curricula, learningTopics, lessons,
learningSessions, sessionMessages, sessionRatings,
sessionNotes, progressCommits, methodSwitches,
stepEvaluations).

Sub-modules under `storage/` carry the ported logic:

| Module | Responsibility |
|---|---|
| `assessment.ts` | 12-question pack + profile calculator |
| `prompts.ts` | 42-cell system-prompt matrix |
| `step-evaluator.ts` | Dual-prompt step-evaluation port |
| `session-flow.ts` | start + message orchestration |
| `tracking.ts` | aggregator + buildCommitFromSession |
| `tools.ts` | rankTools + buildSpacedRecommendations |
| `ai-providers.ts` | Anthropic/OpenAI/Gemini HTTP clients |

Bundled data lives in `frontend/src/data/`:

- `assessment-questions.json` — exported verbatim from the
  backend's `QUESTIONS` list (12 questions × 4 answers × 5
  languages).
- `session-prompts.json` — exported verbatim from the backend's
  `_PROMPTS` dict (6 methods × 7 steps × 2 languages).

## Adding a third storage backend

Implement `IStorageService` with whatever persistence layer
you like (Supabase, Firestore, a custom REST API). Register it
in `storage/index.ts`'s factory:

```typescript
if (mode === "supabase") {
  cachedStorage = supabaseStorage;
}
```

Add the mode to `StorageMode` type:

```typescript
export type StorageMode = "api" | "dexie" | "supabase";
```

Wire it into the Settings UI's storage-mode section. No other
file changes — pages still go through `getStorage()`.

## Browser-direct AI calls

`storage/ai-providers.ts` implements three provider clients:

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

## Mode resolution

`storage/index.ts` resolves the mode in this order:

1. `localStorage["adaptive-learner.storage_mode"]` — user
   choice from Settings.
2. `VITE_STORAGE_MODE` — build-time default (GH Pages sets it
   to `"dexie"`).
3. Fallback: `"api"`.

The result is cached for the page's lifetime. Test code can
reset via `_resetStorageCacheForTests()`.
