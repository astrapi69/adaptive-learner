# Storage-Layer

Der v0.7.0-Storage-Layer (`frontend/src/storage/`) gibt dem
Frontend zwei austauschbare Backends hinter einem Interface.

## IStorageService

`frontend/src/storage/types.ts` definiert das Interface, das
jede Storage-Implementierung erfüllen muss. Es spiegelt die
`api.*`-Namespaces aus `api/client.ts` 1:1:

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

Jede Seite konsumiert `IStorageService` über die
`getStorage()`-Factory. Seiten importieren nie direkt
`api/client.ts` oder die Dexie-Datenbank.

## ApiStorage

`storage/api-storage.ts` ist ein dünner Durchgriff auf `api.*`.
Jede Methode delegiert 1:1. Verhalten identisch zu v0.6.0.

## DexieStorage

`storage/dexie-storage.ts` persistiert alles in IndexedDB via
Dexie 4.4.2. Das Schema in `storage/db.ts` spiegelt alle 25
SQLAlchemy-Models 1:1, plus die 4 Assoziations-Tabellen
(`project_subjects` / `project_tags` etc.).

Submodule unter `storage/` tragen die portierte Logik:

| Modul | Zuständigkeit |
|---|---|
| `assessment.ts` | 12-Fragen-Pack + Profil-Rechner |
| `prompts.ts` | 42-Zellen-Prompt-Matrix |
| `step-evaluator.ts` | Dual-Prompt-Schritt-Bewertung |
| `session-flow.ts` | start + message Orchestrierung |
| `tracking.ts` | Aggregator + buildCommitFromSession |
| `tools.ts` | rankTools + buildSpacedRecommendations |
| `ai-providers.ts` | Anthropic/OpenAI/Gemini HTTP-Clients |

Gebündelte Daten leben in `frontend/src/data/`:

- `assessment-questions.json` — wortgetreu aus der Backend-
  `QUESTIONS`-Liste exportiert (12 Fragen × 4 Antworten × 5
  Sprachen).
- `session-prompts.json` — wortgetreu aus dem Backend-
  `_PROMPTS`-Dict (6 Methoden × 7 Schritte × 2 Sprachen).

## Drittes Storage-Backend hinzufügen

`IStorageService` mit beliebigem Persistenz-Layer
implementieren (Supabase, Firestore, eigene REST-API). In der
Factory von `storage/index.ts` registrieren:

```typescript
if (mode === "supabase") {
  cachedStorage = supabaseStorage;
}
```

Modus im Typ `StorageMode` ergänzen:

```typescript
export type StorageMode = "api" | "dexie" | "supabase";
```

In die Settings-Speicher-Modus-Sektion einbinden. Sonst nichts
— Seiten gehen weiterhin über `getStorage()`.

## Browser-Direkt-KI-Aufrufe

`storage/ai-providers.ts` implementiert drei Anbieter-Clients:

- **Anthropic** — POST auf `https://api.anthropic.com/v1/messages`
  mit dem Header
  `anthropic-dangerous-direct-browser-access: true`. Das ist
  Anthropics expliziter Opt-in für Browser-Aufrufe; ohne ihn
  weist CORS ab.
- **OpenAI** — POST auf
  `https://api.openai.com/v1/chat/completions` mit
  `Authorization: Bearer ${apiKey}`. CORS standardmäßig offen.
- **Gemini** — POST auf
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
  fixen Key in der App (Security-Theater — der Angreifer hat
  das Bundle).

Das Server-Modus-Verhalten ist anders: API-Keys gehen durch
Fernet-Verschlüsselung beim Persistieren
(`ADAPTIVE_LEARNER_SECRET_KEY`). ApiStorage sieht den Klartext
nie.

## Modus-Auflösung

`storage/index.ts` löst den Modus in dieser Reihenfolge auf:

1. `localStorage["adaptive-learner.storage_mode"]` —
   User-Wahl aus den Einstellungen.
2. `VITE_STORAGE_MODE` — Build-Zeit-Standard (GH-Pages setzt
   auf `"dexie"`).
3. Fallback: `"api"`.

Das Ergebnis wird für die Lebensdauer der Seite gecached.
Tests können via `_resetStorageCacheForTests()` zurücksetzen.
