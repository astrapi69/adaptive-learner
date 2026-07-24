# Storage-Layer

Der Storage-Layer (`frontend/src/storage/`) gibt dem
Frontend zwei austauschbare Backends hinter einem Interface.
Das Interface umfasst inzwischen 29 Namespaces.

## Verzeichnis-Aufbau

`storage/` enthält im Wurzelverzeichnis die beiden
`IStorageService`-Implementierungen und die Factory, die
portierte Logik ist in zehn fachliche Unterverzeichnisse
gruppiert:

- Wurzel: `api-storage.ts` (ApiStorage), `dexie-storage.ts`
  (DexieStorage), `index.ts` (die `getStorage()`-Factory).
- Unterverzeichnisse: `ai/`, `anki/`, `backup/`, `content/`,
  `dexie/`, `gamification/`, `lessons/`, `services/`, `sync/`,
  `types/` (wobei `types/` selbst in `content/`, `core/`,
  `integrations/`, `learning/` aufgeteilt ist).

## IStorageService

`frontend/src/storage/types/core/service.ts` definiert das
Interface, das jede Storage-Implementierung erfüllen muss. Es
spiegelt die `api.*`-Namespaces aus `api/client.ts` 1:1:

```typescript
export interface IStorageService {
  readonly mode: StorageMode;
  health(): Promise<{ status: string; version: string; debug: boolean }>;
  // Core
  i18n: II18nNamespace;
  users: IUsersNamespace;
  projects: IProjectsNamespace;
  settings: ISettingsNamespace;   // get/set inkl. key_source_*
  assessment: IAssessmentNamespace;
  session: ISessionNamespace;     // inkl. streamMessage()
  tracking: ITrackingNamespace;
  tools: IToolsNamespace;
  curricula: ICurriculaNamespace;
  topics: ITopicsNamespace;
  lessons: ILessonsNamespace;
  plugins: IPluginsNamespace;
  imports: IImportsNamespace;
  system: ISystemNamespace;
  // Backup + Export
  backup: IBackupNamespace;
  export: IExportNamespace;
  // Taxonomie
  subjects: ISubjectsNamespace;
  tags: ITagsNamespace;
  projectTaxonomy: IProjectTaxonomyNamespace;
  // Gamification + Exporte
  gamification: IGamificationNamespace;
  anki: IAnkiNamespace;
  pronunciation: IPronunciationNamespace;
  notebooklm: INotebookLmNamespace;
  // Content + Lernen
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

Jede Seite konsumiert `IStorageService` über die
`getStorage()`-Factory. Seiten importieren nie direkt
`api/client.ts` oder die Dexie-Datenbank.

## ApiStorage

`storage/api-storage.ts` ist ein dünner Durchgriff auf `api.*`.
Jede Methode delegiert 1:1.

## DexieStorage

`storage/dexie-storage.ts` persistiert alles in IndexedDB via
Dexie 4. Das Schema in `storage/dexie/db.ts` spiegelt alle 30
SQLAlchemy-Models 1:1, plus die Assoziations-Tabellen
(`project_subjects` / `project_tags` etc.).

`DexieStorage` ist KEINE God-Datei. Es ist in
Per-Domain-Namespace-Module aufgeteilt, nach Belang gruppiert.
Die Dexie-Engine, die generischen CRUD-Namespaces und die
Schema-Migrationen liegen unter `storage/dexie/`:

| Modul | Zuständigkeit |
|---|---|
| `dexie/db.ts` | Dexie-Datenbank-Engine + Schema-Versionen |
| `dexie/db-migrations.ts` | additive Vorwärts-Migrationen |
| `dexie/db-rows.ts` / `dexie/dexie-rows.ts` | Row-Formen + generisches CRUD |
| `dexie/dexie-users.ts` | users- + projects-Namespaces |
| `dexie/dexie-settings.ts` | settings-Namespace |
| `dexie/dexie-session.ts` | Session-Orchestrierung |
| `dexie/dexie-curricula.ts` | curricula + topics |
| `dexie/dexie-taxonomy.ts` | subjects + tags + projectTaxonomy |
| `dexie/dexie-imports.ts` | imports-Namespace |
| `dexie/dexie-user-data.ts` | Contributions, eigene Lernpfade, Sprach-Redundanz-State |
| `dexie/badges-data.ts` | gebündelter Badge-Seed-Katalog |

Domänenspezifische Dexie-Namespaces liegen bei ihrer
Domänenlogik statt in `dexie/`:

| Modul | Zuständigkeit |
|---|---|
| `gamification/dexie-gamification.ts` | XP / Badges / Streak |
| `gamification/lesson-xp-dexie.ts` | Lektions-XP-Regel |
| `gamification/missions-dexie.ts` | tägliche Missionen |
| `lessons/lesson-progress-dexie.ts` | Lektions-Fortschritt |
| `lessons/element-errors-dexie.ts` | Element-Fehler-Tracking (SRS) |
| `content/content-loader-dexie.ts` | Content-Sets |

Die portierte KI- + Session-Logik liegt unter `storage/ai/`:

| Modul | Zuständigkeit |
|---|---|
| `ai/prompts.ts` | 42-Zellen-Prompt-Matrix |
| `ai/step-evaluator.ts` | Dual-Prompt-Schritt-Bewertung |
| `ai/session-flow.ts` | start + message Orchestrierung |
| `ai/ai-providers.ts` | Anthropic/OpenAI/Gemini HTTP-Clients |

Die Assessment- / Tracking- / Tools-Logik liegt unter
`storage/services/`:

| Modul | Zuständigkeit |
|---|---|
| `services/assessment.ts` | 12-Fragen-Pack + Profil-Rechner |
| `services/tracking.ts` | Aggregator + buildCommitFromSession |
| `services/tools.ts` | rankTools + buildSpacedRecommendations |

Gebündelte Daten leben in `frontend/src/data/`:

- `assessment-questions.json` - wortgetreu aus der Backend-
  `QUESTIONS`-Liste exportiert (12 Fragen, mehrsprachig).
- `session-prompts.json` - wortgetreu aus dem Backend-
  `_PROMPTS`-Dict (6 Methoden × 7 Schritte).

## Dexie-Datenintegrität

IndexedDB ist multi-tab und asynchron, daher verliert ein
naives get-spread-put nebenläufige Updates. DexieStorage nutzt:

- **Atomare Mutation, nie ungeschütztes read-modify-write.**
  `table.modify(...)` für In-Place-Feld-Updates und
  `db.transaction("rw", ...)` als Wrapper um ein
  Full-Replace-`update`.
- **Unique-Indizes als DB-Ebenen-Absicherung** (z. B. `&user_id`
  auf den Singletons, `&key` auf Badges, das zusammengesetzte
  `&[user_id+badge_id]` auf `userBadges`).
- **Additive Vorwärts-Migrationen.** Ein neuer Index oder eine
  neue Tabelle erhöht die Dexie-Schema-Version; das Upgrade
  füllt bestehende Rows nach bzw. dedupliziert sie. Die Stores
  einer bestehenden Version werden nie in-place verändert -
  stattdessen wird eine neue `version(n)` ergänzt.

## Backup-Format

Das Backup ist eine `.alb`-Datei - ein ZIP, kein einzelner
JSON-Dump. Das ZIP trägt neben den Tabellendaten auch einen
localStorage-Snapshot, sodass ein Restore sowohl den
IndexedDB- / SQLite-State als auch die localStorage-gestützten
Einstellungen wiederherstellt. Der Code liegt unter
`storage/backup/`.

## Drittes Storage-Backend hinzufügen

`IStorageService` mit beliebigem Persistenz-Layer
implementieren (Supabase, Firestore, eigene REST-API). In der
Factory von `storage/index.ts` registrieren:

```typescript
if (mode === "supabase") {
  cachedStorage = supabaseStorage;
}
```

Modus im Typ `StorageMode` in
`storage/types/core/service.ts` ergänzen:

```typescript
export type StorageMode = "api" | "dexie" | "supabase";
```

In die Settings-Speicher-Modus-Sektion einbinden. Sonst nichts -
Seiten gehen weiterhin über `getStorage()`.

## Browser-Direkt-KI-Aufrufe

`storage/ai/ai-providers.ts` implementiert drei
Anbieter-Clients:

- **Anthropic** - POST auf `https://api.anthropic.com/v1/messages`
  mit dem Header
  `anthropic-dangerous-direct-browser-access: true`. Das ist
  Anthropics expliziter Opt-in für Browser-Aufrufe; ohne ihn
  weist CORS ab.
- **OpenAI** - POST auf
  `https://api.openai.com/v1/chat/completions` mit
  `Authorization: Bearer ${apiKey}`. CORS standardmäßig offen.
- **Gemini** - POST auf
  `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}`.
  Query-Param-Auth, kein System-Feld; System-Nachrichten
  werden in den ersten User-Turn eingefaltet.

Alle drei normalisieren Fehler zu
`ApiError(status, "Provider: detail")`, sodass der existierende
Frontend-Toast / GitHub-Issue-Flow sie ohne Verzweigung
rendert.

## Warum Klartext-API-Keys im Dexie-Modus?

Im Dexie-Modus liegt der API-Key des Users im Klartext in
IndexedDB (`UserSettings.api_key_{provider}`). Akzeptables
Bedrohungsmodell:

- Die Daten verlassen das Gerät des Users nie.
- Der KI-Anbieter IST der einzige Netzwerk-Endpunkt, der den
  Schlüssel jemals sieht.
- Verschlüsseln in IndexedDB würde entweder einen Passwort-
  Prompt pro Session bedeuten (UX-feindlich) oder einen
  fixen Key in der App (Security-Theater - der Angreifer hat
  das Bundle).

Das Server-Modus-Verhalten ist anders: API-Keys gehen durch
Fernet-Verschlüsselung beim Persistieren
(`ADAPTIVE_LEARNER_SECRET_KEY`). ApiStorage sieht den Klartext
nie.

Beide Modi liefern zusätzlich eine Per-Provider-Quellen-
Zuordnung (`UserSettings.key_source_anthropic | openai |
gemini`), sodass die UI "Key from: secrets.yaml" /
"environment" / "Settings" rendern kann. Im Dexie-Modus
kollabiert die Quelle zu `settings` oder `none`, weil die
Browser-Sandbox keinen Dateisystem-Zugriff hat -
`secrets.yaml` ist ein Desktop- / Server-Modus-Konzept.

## Modus-Auflösung

`storage/index.ts` löst den Modus in dieser Reihenfolge auf:

1. Build-Zeit `VITE_STORAGE_MODE === "dexie"` - ein
   Dexie-Only-Deployment (GH-Pages / installierte PWA) hat kein
   Backend, daher ist dies maßgeblich und gewinnt über jede
   persistierte Präferenz. Eine veraltete persistierte
   `"api"`-Wahl könnte dort nie erfüllt werden und würde jeden
   Request mit 404 quittieren.
2. `localStorage["adaptive-learner.storage_mode"]` - die Wahl
   des Users aus den Einstellungen, nur konsultiert, wenn der
   Build KEIN Dexie-Only-Build ist.
3. `VITE_STORAGE_MODE` (jeder andere Wert) - Build-Zeit-Standard.
4. Fallback: `"api"` (Standard im lokalen Dev).

Das Ergebnis wird für die Lebensdauer der Seite gecached.
Tests können via `_resetStorageCacheForTests()` zurücksetzen.
