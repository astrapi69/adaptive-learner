# Επίπεδο αποθήκευσης

Το επίπεδο αποθήκευσης v0.7.0 (`frontend/src/storage/`) δίνει στο
frontend δύο εναλλάξιμα backends πίσω από ένα ενιαίο συμβόλαιο.
Το συμβόλαιο έχει αναπτυχθεί σε 22 namespaces κατά τις Phases 7–34.

## IStorageService

Το `frontend/src/storage/types.ts` ορίζει τη διεπαφή που κάθε
υλοποίηση αποθήκευσης ικανοποιεί. Αντικατοπτρίζει τα namespaces
`api.*` από το `api/client.ts` 1:1:

```typescript
export interface IStorageService {
  readonly mode: StorageMode;
  health(): Promise<HealthInfo>;
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
  system: ISystemNamespace;
  // Phase 12+
  backup: IBackupNamespace;
  export: IExportNamespace;
  imports: IImportsNamespace;
  // Phase 22 - taxonomy
  subjects: ISubjectsNamespace;
  tags: ITagsNamespace;
  projectTaxonomy: IProjectTaxonomyNamespace;
  // Phase 29-32 - gamification + exports
  gamification: IGamificationNamespace;
  anki: IAnkiNamespace;
  notebooklm: INotebookLmNamespace;
  pronunciation: IPronunciationNamespace;
}
```

Κάθε σελίδα καταναλώνει `IStorageService` μέσω του factory
`getStorage()`. Οι σελίδες δεν εισάγουν ποτέ απευθείας το
`api/client.ts` ή τη βάση δεδομένων Dexie.

## ApiStorage

Το `storage/api-storage.ts` είναι λεπτό pass-through στο `api.*`.
Κάθε μέθοδος αναθέτει 1:1. Η συμπεριφορά είναι πανομοιότυπη με
αυτή του v0.6.0.

## DexieStorage

Το `storage/dexie-storage.ts` αποθηκεύει τα πάντα στο IndexedDB
μέσω Dexie 4.4.2. Το σχήμα στο `storage/db.ts` αντικατοπτρίζει
και τα 25 μοντέλα SQLAlchemy 1:1, συν τους 4 πίνακες σύνδεσης
(project_subjects / project_tags / κ.λπ.).

Υπο-modules στο `storage/` φέρουν τη μεταφερμένη λογική:

| Module | Αρμοδιότητα |
|---|---|
| `assessment.ts` | Πακέτο 12 ερωτήσεων + υπολογιστής προφίλ |
| `prompts.ts` | Πίνακας system-prompt 42 κελιών |
| `step-evaluator.ts` | Θύρα αξιολόγησης βήματος διπλής προτροπής |
| `session-flow.ts` | Ενορχήστρωση έναρξης + μηνύματος |
| `tracking.ts` | Αθροιστής + buildCommitFromSession |
| `tools.ts` | rankTools + buildSpacedRecommendations |
| `ai-providers.ts` | HTTP clients Anthropic/OpenAI/Gemini |

Δεδομένα bundle βρίσκονται στο `frontend/src/data/`:

- `assessment-questions.json` - εξαγόμενο αυτούσιο από τη λίστα
  `QUESTIONS` του backend (12 ερωτήσεις × 4 απαντήσεις × 5 γλώσσες).
- `session-prompts.json` - εξαγόμενο αυτούσιο από το dict `_PROMPTS`
  του backend (6 μέθοδοι × 7 βήματα × 2 γλώσσες).

## Προσθήκη τρίτου storage backend

Υλοποίησε `IStorageService` με όποιο επίπεδο επιμονής θέλεις
(Supabase, Firestore, custom REST API). Καταχώρισέ το στο factory
του `storage/index.ts`:

```typescript
if (mode === "supabase") {
  cachedStorage = supabaseStorage;
}
```

Πρόσθεσε τη λειτουργία στον τύπο `StorageMode`:

```typescript
export type StorageMode = "api" | "dexie" | "supabase";
```

Σύνδεσέ το στο τμήμα storage-mode του UI Ρυθμίσεων. Χωρίς άλλες
αλλαγές αρχείων - οι σελίδες εξακολουθούν να χρησιμοποιούν το
`getStorage()`.

## Άμεσες κλήσεις ΤΝ από browser

Το `storage/ai-providers.ts` υλοποιεί τρεις clients παρόχων:

- **Anthropic** - POST στο `https://api.anthropic.com/v1/messages`
  με την επικεφαλίδα `anthropic-dangerous-direct-browser-access: true`.
  Αυτή είναι η ρητή δυνατότητα opt-in του Anthropic για κλήσεις
  από browser· χωρίς αυτή το CORS απορρίπτει.
- **OpenAI** - POST στο `https://api.openai.com/v1/chat/completions`
  με `Authorization: Bearer ${apiKey}`. Το CORS είναι ανοιχτό
  από προεπιλογή.
- **Gemini** - POST στο
  `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}`.
  Πιστοποίηση με query-param· χωρίς πεδίο system· τα system messages
  ενσωματώνονται στην πρώτη σειρά χρήστη.

Και οι τρεις κανονικοποιούν τα σφάλματα σε `ApiError(status, "Provider: detail")`
ώστε το υπάρχον frontend toast / GitHub-Issue UX να τα αποδίδει
χωρίς διακλαδώσεις.

## Γιατί cleartext API keys στη λειτουργία Dexie;

Στη λειτουργία Dexie το API key του χρήστη βρίσκεται στο IndexedDB
σε cleartext (`UserSettings.api_key_{provider}`). Αποδεκτό μοντέλο
απειλής:

- Τα δεδομένα δεν εγκαταλείπουν ποτέ τη συσκευή του χρήστη.
- Ο πάροχος ΤΝ ΕΙΝΑΙ το μόνο endpoint δικτύου που βλέπει ποτέ
  το κλειδί.
- Η κρυπτογράφηση στο IndexedDB θα απαιτούσε είτε προτροπή
  κωδικού ανά συνεδρία (εχθρικό UX) είτε σταθερό κλειδί
  ενσωματωμένο στην εφαρμογή (θέατρο ασφαλείας - ο εισβολέας
  έχει το bundle).

Η συμπεριφορά Server-mode είναι διαφορετική: τα API keys περνούν
από κρυπτογράφηση Fernet σε ηρεμία (`ADAPTIVE_LEARNER_SECRET_KEY`).
Το ApiStorage δεν βλέπει ποτέ το cleartext.

Από v1.20.0 / Phase 34, και οι δύο λειτουργίες εκθέτουν επίσης
μια απόδοση πηγής ανά πάροχο
(`UserSettings.key_source_anthropic | openai | gemini`) ώστε το UI
να αποδίδει "Key from: secrets.yaml" / "environment" / "Settings".
Στη λειτουργία Dexie η πηγή καταρρέει σε `settings` ή `none`
επειδή το sandbox browser δεν έχει πρόσβαση στο filesystem -
το `secrets.yaml` είναι έννοια desktop / server-mode.

## Επίλυση λειτουργίας

Το `storage/index.ts` επιλύει τη λειτουργία με αυτή τη σειρά:

1. `localStorage["adaptive-learner.storage_mode"]` - επιλογή
   χρήστη από Ρυθμίσεις.
2. `VITE_STORAGE_MODE` - προεπιλογή χρόνου build (το GH Pages
   το ορίζει σε `"dexie"`).
3. Εναλλακτική: `"api"`.

Το αποτέλεσμα αποθηκεύεται για τη διάρκεια ζωής της σελίδας.
Ο κώδικας τεστ μπορεί να επαναφέρει μέσω `_resetStorageCacheForTests()`.
