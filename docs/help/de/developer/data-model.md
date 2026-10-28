# Datenmodell

> Generiert von `scripts/generate_er_diagrams.py` aus den SQLAlchemy-Modellen (`backend/app/models/__init__.py`), dem Dexie-Schema (`frontend/src/storage/dexie/db.ts`, Row-Formen in `db-rows.ts`) und der Bereichszuordnung `scripts/data_model_areas.yaml`. Nicht von Hand editieren: eine Quelle oder die Zuordnung ändern, dann `make sync-data-model` ausführen. `make sync-data-model-check` schlägt fehl, wenn diese Seite veraltet ist, wenn eine Tabelle oder ein Store zu keinem Bereich gehört und wenn ein `*_id`-Feld auf nichts verweist.

Die App hält ihre Daten in einer von zwei Datenbanken: der Server-Datenbank (SQLAlchemy auf SQLite) oder, im Browser-Modus, der Browser-Datenbank (Dexie auf IndexedDB). Der [Storage-Layer](storage-layer.md) entscheidet, mit welcher eine Seite spricht. Jeder Bereich unten zeigt beide.

Server-Datenbank: 33 Tabellen, 45 Fremdschlüssel. Browser-Datenbank: 38 Stores, Dexie-Schemaversion 35.

## Die Diagramme lesen

- Eine Entität mit Attributen gehört zum Bereich. Eine Entität ohne Attribute gehört zu einem anderen Bereich: Sie zeigt, wo eine Beziehung den Bereich verlässt; ihre Attribute stehen im Diagramm jenes Bereichs.
- Eine durchgezogene Linie ist ein in der Server-Datenbank deklarierter Fremdschlüssel. Eine gestrichelte Linie ist ein Verweis per Konvention, den die Zuordnungsdatei festhält; die Browser-Datenbank deklariert keine Fremdschlüssel.
- `PK` Primärschlüssel, `FK` Fremdschlüssel, `UK` eindeutig. In den Browser-Diagrammen nennt der Kommentar in Anführungszeichen die Dexie-Indexeinträge, die das Feld enthalten.
- Server-Typen sind die SQLAlchemy-Spaltentypen, Browser-Typen stammen aus den TypeScript-Row-Formen. Tabellen-, Store- und Feldnamen sind Bezeichner und bleiben wie im Code.

## Bereiche

| Bereich | Server-Tabellen | Browser-Stores |
|---|---|---|
| Konto und Einstellungen | 3 | 5 |
| Lernprojekte | 6 | 6 |
| Sitzungen | 5 | 5 |
| Fortschritt | 6 | 6 |
| Inhalte | 3 | 5 |
| Gamification | 6 | 6 |
| Import | 2 | 2 |
| KI | 2 | 3 |

## Konto und Einstellungen

Der Benutzer, seine Einstellungen mit den API-Schlüsseln und der Rollback-Cache funktionierender API-Schlüssel; im Browser außerdem die Plugin-Einstellungen und gerätelokale Benutzerdaten.

### Server-Datenbank

```mermaid
---
config:
  er:
    useMaxWidth: false
---
erDiagram
    accTitle: Datenmodell, Konto und Einstellungen: Server-Datenbank
    accDescr: Tabellen des Bereichs Konto und Einstellungen: users, user_settings, api_key_backups. Beziehungen: anki_card_suggestions.user_id → users, api_key_backups.user_id → users, curriculums.user_id → users, element_errors.user_id → users, imported_conversations.user_id → users, learning_profiles.user_id → users, learning_projects.user_id → users, lesson_progress.user_id → users, set_runs.user_id → users, speech_recordings.user_id → users, study_questions.user_id → users, tags.user_id → users, user_badges.user_id → users, user_missions.user_id → users, user_settings.user_id → users, user_streaks.user_id → users, user_xp.user_id → users, xp_purchases.user_id → users.
    users {
        String id PK
        String name
        String email UK
        String language
        DateTime created_at
        DateTime updated_at
    }
    user_settings {
        String id PK
        String user_id FK, UK
        String active_provider
        Text api_key_anthropic
        Text api_key_openai
        Text api_key_gemini
        Text api_key_perplexity
        String model_override_anthropic
        String model_override_openai
        String model_override_gemini
        String model_override_perplexity
        Text avatar
        DateTime created_at
        DateTime updated_at
    }
    api_key_backups {
        String id PK
        String user_id FK
        String provider
        Text encrypted_key
        DateTime tested_at
        Boolean works
        DateTime created_at
        DateTime updated_at
    }
    users ||--o{ anki_card_suggestions : "user_id"
    users ||--o{ api_key_backups : "user_id"
    users ||--o{ curriculums : "user_id"
    users ||--o{ element_errors : "user_id"
    users ||--o{ imported_conversations : "user_id"
    users ||--o{ learning_profiles : "user_id"
    users ||--o{ learning_projects : "user_id"
    users ||--o{ lesson_progress : "user_id"
    users ||--o{ set_runs : "user_id"
    users ||--o{ speech_recordings : "user_id"
    users ||--o{ study_questions : "user_id"
    users ||--o{ tags : "user_id"
    users ||--o{ user_badges : "user_id"
    users ||--o{ user_missions : "user_id"
    users ||--o| user_settings : "user_id"
    users ||--o| user_streaks : "user_id"
    users ||--o| user_xp : "user_id"
    users ||--o{ xp_purchases : "user_id"
```

### Browser-Datenbank

```mermaid
---
config:
  er:
    useMaxWidth: false
---
erDiagram
    accTitle: Datenmodell, Konto und Einstellungen: Browser-Datenbank
    accDescr: Stores des Bereichs Konto und Einstellungen: users, userSettings, apiKeyBackups, pluginSettings, userData. Beziehungen: userSettings.user_id → users, apiKeyBackups.user_id → users, learningProjects.user_id → users, learningProfiles.user_id → users, tags.user_id → users, lessonProgress.user_id → users, elementErrors.user_id → users, setRuns.user_id → users, speechRecordings.user_id → users, curricula.user_id → users, userXp.user_id → users, xpPurchases.user_id → users, userBadges.user_id → users, userStreaks.user_id → users, userMissions.user_id → users, importedConversations.user_id → users, ankiCards.user_id → users, studyQuestions.user_id → users.
    users {
        string id PK
        string name
        string email "email"
        string language
        string created_at
        string updated_at
    }
    userSettings {
        string id PK
        string user_id UK "&user_id"
        string language
        AIProvider active_provider
        string api_key_anthropic
        string api_key_openai
        string api_key_gemini
        string api_key_perplexity
        string model_override_anthropic
        string model_override_openai
        string model_override_gemini
        string model_override_perplexity
        string avatar
        string created_at
        string updated_at
    }
    apiKeyBackups {
        string id PK
        string user_id "user_id"
        AIProvider provider "provider"
        string key
        string tested_at
        boolean works
    }
    pluginSettings {
        string name PK
        Record settings
        string updated_at
    }
    userData {
        string key PK
        string value
    }
    users ||..o| userSettings : "user_id"
    users ||..o{ apiKeyBackups : "user_id"
    users ||..o{ learningProjects : "user_id"
    users ||..o{ learningProfiles : "user_id"
    users ||..o{ tags : "user_id"
    users ||..o{ lessonProgress : "user_id"
    users ||..o{ elementErrors : "user_id"
    users ||..o{ setRuns : "user_id"
    users ||..o{ speechRecordings : "user_id"
    users ||..o{ curricula : "user_id"
    users ||..o| userXp : "user_id"
    users ||..o{ xpPurchases : "user_id"
    users ||..o{ userBadges : "user_id"
    users ||..o| userStreaks : "user_id"
    users ||..o{ userMissions : "user_id"
    users ||..o{ importedConversations : "user_id"
    users ||..o{ ankiCards : "user_id"
    users ||..o{ studyQuestions : "user_id"
```

| Server-Tabelle | Browser-Store |
|---|---|
| `users` | `users` |
| `user_settings` | `userSettings` |
| `api_key_backups` | `apiKeyBackups` |
| - | `pluginSettings` |
| - | `userData` |

## Lernprojekte

Ein Lernprojekt mit dem Lernprofil aus dem Lerntyp-Test sowie die Fachgebiete und Tags, die Projekte einordnen.

### Server-Datenbank

```mermaid
---
config:
  er:
    useMaxWidth: false
---
erDiagram
    accTitle: Datenmodell, Lernprojekte: Server-Datenbank
    accDescr: Tabellen des Bereichs Lernprojekte: learning_projects, learning_profiles, subjects, tags, project_subjects, project_tags. Beziehungen: anki_card_suggestions.project_id → learning_projects, imported_conversations.project_id → learning_projects, learning_profiles.user_id → users, learning_profiles.project_id → learning_projects, learning_projects.user_id → users, learning_sessions.project_id → learning_projects, method_switches.project_id → learning_projects, progress_commits.project_id → learning_projects, project_subjects.project_id → learning_projects, project_subjects.subject_id → subjects, project_tags.project_id → learning_projects, project_tags.tag_id → tags, study_questions.project_id → learning_projects, subjects.parent_id → subjects, tags.user_id → users.
    learning_projects {
        String id PK
        String user_id FK
        String topic
        Text goal
        String timeframe
        Integer daily_minutes
        Text current_problem
        Boolean active
        String kind
        DateTime created_at
        DateTime updated_at
    }
    learning_profiles {
        String id PK
        String user_id FK
        String project_id FK
        Float deductive
        Float inductive
        Float error_based
        Float dialogic
        Float contextual
        Float ai_adaptive
        DateTime assessed_at
        Integer version
    }
    subjects {
        String id PK
        String parent_id FK
        String name
        Text description
        String icon
        DateTime created_at
        DateTime updated_at
    }
    tags {
        String id PK
        String user_id FK
        String name
        String color
        DateTime created_at
    }
    project_subjects {
        String id PK
        String project_id FK
        String subject_id FK
        DateTime created_at
    }
    project_tags {
        String id PK
        String project_id FK
        String tag_id FK
        DateTime created_at
    }
    learning_projects |o--o{ anki_card_suggestions : "project_id"
    learning_projects |o--o{ imported_conversations : "project_id"
    users ||--o{ learning_profiles : "user_id"
    learning_projects ||--o{ learning_profiles : "project_id"
    users ||--o{ learning_projects : "user_id"
    learning_projects ||--o{ learning_sessions : "project_id"
    learning_projects ||--o{ method_switches : "project_id"
    learning_projects ||--o{ progress_commits : "project_id"
    learning_projects ||--o{ project_subjects : "project_id"
    subjects ||--o{ project_subjects : "subject_id"
    learning_projects ||--o{ project_tags : "project_id"
    tags ||--o{ project_tags : "tag_id"
    learning_projects ||--o{ study_questions : "project_id"
    subjects |o--o{ subjects : "parent_id"
    users ||--o{ tags : "user_id"
```

### Browser-Datenbank

```mermaid
---
config:
  er:
    useMaxWidth: false
---
erDiagram
    accTitle: Datenmodell, Lernprojekte: Browser-Datenbank
    accDescr: Stores des Bereichs Lernprojekte: learningProjects, learningProfiles, subjects, tags, projectSubjects, projectTags. Beziehungen: learningProjects.user_id → users, learningProfiles.user_id → users, learningProfiles.project_id → learningProjects, subjects.parent_id → subjects, tags.user_id → users, projectSubjects.project_id → learningProjects, projectSubjects.subject_id → subjects, projectTags.project_id → learningProjects, projectTags.tag_id → tags, learningSessions.project_id → learningProjects, progressCommits.project_id → learningProjects, methodSwitches.project_id → learningProjects, importedConversations.project_id → learningProjects, ankiCards.project_id → learningProjects, studyQuestions.project_id → learningProjects.
    learningProjects {
        string id PK
        string user_id "user_id"
        string topic
        string goal
        string timeframe
        number daily_minutes
        string current_problem
        boolean active "active"
        string kind
        string created_at
        string updated_at
    }
    learningProfiles {
        string id PK
        string user_id "user_id"
        string project_id "project_id"
        number deductive
        number inductive
        number error_based
        number dialogic
        number contextual
        number ai_adaptive
        string assessed_at "assessed_at"
        number version
    }
    subjects {
        string id PK
        string parent_id "parent_id"
        string name "name"
        string description
        string icon
        string created_at
        string updated_at "updated_at"
    }
    tags {
        string id PK
        string user_id "user_id"
        string name "name"
        string color
        string created_at "created_at"
    }
    projectSubjects {
        string id PK
        string project_id "project_id"
        string subject_id "subject_id"
        string created_at "created_at"
    }
    projectTags {
        string id PK
        string project_id "project_id"
        string tag_id "tag_id"
        string created_at "created_at"
    }
    users ||..o{ learningProjects : "user_id"
    users ||..o{ learningProfiles : "user_id"
    learningProjects ||..o{ learningProfiles : "project_id"
    subjects |o..o{ subjects : "parent_id"
    users ||..o{ tags : "user_id"
    learningProjects ||..o{ projectSubjects : "project_id"
    subjects ||..o{ projectSubjects : "subject_id"
    learningProjects ||..o{ projectTags : "project_id"
    tags ||..o{ projectTags : "tag_id"
    learningProjects ||..o{ learningSessions : "project_id"
    learningProjects ||..o{ progressCommits : "project_id"
    learningProjects ||..o{ methodSwitches : "project_id"
    learningProjects |o..o{ importedConversations : "project_id"
    learningProjects |o..o{ ankiCards : "project_id"
    learningProjects ||..o{ studyQuestions : "project_id"
```

| Server-Tabelle | Browser-Store |
|---|---|
| `learning_projects` | `learningProjects` |
| `learning_profiles` | `learningProfiles` |
| `subjects` | `subjects` |
| `tags` | `tags` |
| `project_subjects` | `projectSubjects` |
| `project_tags` | `projectTags` |

## Sitzungen

Eine Lern-Sitzung mit ihren Nachrichten, Bewertungen, Notizen und Schritt-Auswertungen.

### Server-Datenbank

```mermaid
---
config:
  er:
    useMaxWidth: false
---
erDiagram
    accTitle: Datenmodell, Sitzungen: Server-Datenbank
    accDescr: Tabellen des Bereichs Sitzungen: learning_sessions, session_messages, session_ratings, session_notes, step_evaluations. Beziehungen: anki_card_suggestions.session_id → learning_sessions, learning_sessions.project_id → learning_projects, learning_sessions.imported_conversation_id → imported_conversations, progress_commits.session_id → learning_sessions, session_messages.session_id → learning_sessions, session_notes.session_id → learning_sessions, session_ratings.session_id → learning_sessions, step_evaluations.session_id → learning_sessions, study_questions.session_id → learning_sessions.
    learning_sessions {
        String id PK
        String project_id FK
        String method
        DateTime started_at
        DateTime ended_at
        Integer cycle_step
        String status
        Integer cycle_count
        Text cycle_topics
        String imported_conversation_id FK
    }
    session_messages {
        String id PK
        String session_id FK
        String role
        Text content
        DateTime created_at
    }
    session_ratings {
        String id PK
        String session_id FK
        Integer understanding
        Integer stress
        Integer method_fit
        Text notes
        DateTime created_at
    }
    session_notes {
        String id PK
        String session_id FK
        Text content
        String kind
        DateTime created_at
        DateTime updated_at
    }
    step_evaluations {
        String id PK
        String session_id FK
        Integer from_step
        Integer to_step
        Boolean advance
        Float confidence
        Boolean applied
        Boolean fallback_used
        Text reason
        DateTime evaluated_at
    }
    learning_sessions |o--o{ anki_card_suggestions : "session_id"
    learning_projects ||--o{ learning_sessions : "project_id"
    imported_conversations |o--o{ learning_sessions : "imported_conversation_id"
    learning_sessions ||--o{ progress_commits : "session_id"
    learning_sessions ||--o{ session_messages : "session_id"
    learning_sessions ||--o{ session_notes : "session_id"
    learning_sessions ||--o{ session_ratings : "session_id"
    learning_sessions ||--o{ step_evaluations : "session_id"
    learning_sessions |o--o{ study_questions : "session_id"
```

### Browser-Datenbank

```mermaid
---
config:
  er:
    useMaxWidth: false
---
erDiagram
    accTitle: Datenmodell, Sitzungen: Browser-Datenbank
    accDescr: Stores des Bereichs Sitzungen: learningSessions, sessionMessages, sessionRatings, sessionNotes, stepEvaluations. Beziehungen: learningSessions.project_id → learningProjects, learningSessions.imported_conversation_id → importedConversations, sessionMessages.session_id → learningSessions, sessionRatings.session_id → learningSessions, sessionNotes.session_id → learningSessions, stepEvaluations.session_id → learningSessions, progressCommits.session_id → learningSessions, methodSwitches.session_id → learningSessions, ankiCards.session_id → learningSessions, studyQuestions.session_id → learningSessions.
    learningSessions {
        string id PK
        string project_id "project_id"
        LearningMethod method
        string started_at "started_at"
        string ended_at
        number cycle_step
        SessionStatus status "status"
        string imported_conversation_id "imported_conversation_id"
    }
    sessionMessages {
        string id PK
        string session_id "session_id"
        MessageRole role
        string content
        string created_at "created_at"
    }
    sessionRatings {
        string id PK
        string session_id "session_id"
        number understanding
        number stress
        number method_fit
        string notes
        string created_at "created_at"
    }
    sessionNotes {
        string id PK
        string session_id "session_id"
        string content
        string kind
        string created_at
        string updated_at "updated_at"
    }
    stepEvaluations {
        string id PK
        string session_id "session_id"
        number from_step
        number to_step
        boolean advance
        boolean applied
        number confidence
        string reason
        boolean fallback_used
        number duration_seconds
        string evaluated_at "evaluated_at"
    }
    learningProjects ||..o{ learningSessions : "project_id"
    importedConversations |o..o{ learningSessions : "imported_conversation_id"
    learningSessions ||..o{ sessionMessages : "session_id"
    learningSessions ||..o{ sessionRatings : "session_id"
    learningSessions ||..o{ sessionNotes : "session_id"
    learningSessions ||..o{ stepEvaluations : "session_id"
    learningSessions ||..o{ progressCommits : "session_id"
    learningSessions |o..o{ methodSwitches : "session_id"
    learningSessions |o..o{ ankiCards : "session_id"
    learningSessions |o..o{ studyQuestions : "session_id"
```

| Server-Tabelle | Browser-Store |
|---|---|
| `learning_sessions` | `learningSessions` |
| `session_messages` | `sessionMessages` |
| `session_ratings` | `sessionRatings` |
| `session_notes` | `sessionNotes` |
| `step_evaluations` | `stepEvaluations` |

## Fortschritt

Fortschritts-Commits und Methodenwechsel eines Projekts, Lektionsfortschritt in Content-Sets, Fehler auf Element-Ebene für die verteilte Wiederholung, Set-Durchgänge und Sprachaufnahmen.

### Server-Datenbank

```mermaid
---
config:
  er:
    useMaxWidth: false
---
erDiagram
    accTitle: Datenmodell, Fortschritt: Server-Datenbank
    accDescr: Tabellen des Bereichs Fortschritt: progress_commits, method_switches, lesson_progress, element_errors, set_runs, speech_recordings. Beziehungen: element_errors.user_id → users, lesson_progress.user_id → users, method_switches.project_id → learning_projects, progress_commits.project_id → learning_projects, progress_commits.session_id → learning_sessions, set_runs.user_id → users, speech_recordings.user_id → users, element_errors.run_id → set_runs.
    progress_commits {
        String id PK
        String project_id FK
        String session_id FK
        String method
        Float understanding
        Float stress
        Float error_rate
        Integer duration_minutes
        DateTime committed_at
    }
    method_switches {
        String id PK
        String project_id FK
        String from_method
        String to_method
        Text reason
        DateTime switched_at
    }
    lesson_progress {
        String id PK
        String user_id FK
        String source
        String set_id
        String lesson_filename
        String status
        String lesson_mode
        Text step_results
        Integer score_correct
        Integer score_total
        Integer time_spent_seconds
        Integer run_time_seconds
        Integer current_step
        DateTime started_at
        DateTime updated_at
        DateTime completed_at
        DateTime paused_at
        DateTime abandoned_at
        Integer attempts
        Integer best_score_correct
        Integer best_score_total
        Text attempt_history
        Text recent_steps
    }
    element_errors {
        String id PK
        String user_id FK
        Integer run_id
        String set_id
        String lesson_id
        String exercise_id
        String element_key
        String direction
        String element_type
        Text user_answer
        Text correct_answer
        Integer error_count
        Integer correct_streak
        DateTime last_error_at
        DateTime last_attempt_at
        Boolean mastered
        DateTime mastered_at
        Boolean hint_used
        Integer hint_used_count
        Boolean last_attempt_exam
        Integer attempt_count
        Text attempt_history
        DateTime retired_at
        DateTime created_at
        DateTime updated_at
    }
    set_runs {
        String id PK
        String user_id FK
        String set_id
        Integer run_id
        String content_version_at_start
        DateTime started_at
        DateTime closed_at
        DateTime updated_at
    }
    speech_recordings {
        String id PK
        String user_id FK
        String source
        String set_id
        String lesson_filename
        String exercise_id
        Text audio_base64
        String mime_type
        Integer duration_ms
        DateTime recorded_at
        DateTime updated_at
    }
    users ||--o{ element_errors : "user_id"
    users ||--o{ lesson_progress : "user_id"
    learning_projects ||--o{ method_switches : "project_id"
    learning_projects ||--o{ progress_commits : "project_id"
    learning_sessions ||--o{ progress_commits : "session_id"
    users ||--o{ set_runs : "user_id"
    users ||--o{ speech_recordings : "user_id"
    set_runs ||..o{ element_errors : "run_id"
```

### Browser-Datenbank

```mermaid
---
config:
  er:
    useMaxWidth: false
---
erDiagram
    accTitle: Datenmodell, Fortschritt: Browser-Datenbank
    accDescr: Stores des Bereichs Fortschritt: progressCommits, methodSwitches, lessonProgress, elementErrors, setRuns, speechRecordings. Beziehungen: progressCommits.project_id → learningProjects, progressCommits.session_id → learningSessions, methodSwitches.project_id → learningProjects, methodSwitches.session_id → learningSessions, lessonProgress.user_id → users, elementErrors.user_id → users, elementErrors.run_id → setRuns, setRuns.user_id → users, speechRecordings.user_id → users.
    progressCommits {
        string id PK
        string project_id "project_id"
        string session_id "session_id"
        LearningMethod method
        number understanding
        number stress
        number error_rate
        number duration_minutes
        string committed_at "committed_at"
    }
    methodSwitches {
        string id PK
        string project_id "project_id"
        string session_id
        LearningMethod from_method
        LearningMethod to_method
        string reason
        string switched_at "switched_at"
    }
    lessonProgress {
        string id PK
        string user_id "user_id"
        string source
        string set_id "set_id"
        string lesson_filename
        string status "status"
        string lesson_mode
        Record step_results
        number score_correct
        number score_total
        number time_spent_seconds
        number run_time_seconds
        number current_step
        string started_at
        string updated_at "updated_at"
        string completed_at
        string paused_at
        string abandoned_at
        number attempts
        number best_score_correct
        number best_score_total
        object[] attempt_history
        LessonStepEventStored[] recent_steps
    }
    elementErrors {
        string id PK
        string user_id "user_id, [user_id+set_id]"
        number run_id
        string set_id "[user_id+set_id]"
        string lesson_id
        string exercise_id
        string element_key
        string direction
        string element_type
        string user_answer
        string correct_answer
        number error_count
        number correct_streak
        string last_error_at
        string last_attempt_at
        boolean mastered "mastered"
        string mastered_at
        boolean hint_used
        number hint_used_count
        boolean last_attempt_exam
        number attempt_count
        AttemptRecord[] attempt_history
        string retired_at
        string created_at
        string updated_at "updated_at"
    }
    setRuns {
        string id PK
        string user_id "user_id, [user_id+set_id]"
        string set_id "[user_id+set_id]"
        number run_id
        string content_version_at_start
        string started_at
        string closed_at
        string updated_at
    }
    speechRecordings {
        string id PK
        string user_id "user_id"
        string source
        string set_id "set_id"
        string lesson_filename "lesson_filename"
        string exercise_id
        string audio_base64
        string mime_type
        number duration_ms
        string recorded_at "recorded_at"
        string updated_at
    }
    learningProjects ||..o{ progressCommits : "project_id"
    learningSessions ||..o{ progressCommits : "session_id"
    learningProjects ||..o{ methodSwitches : "project_id"
    learningSessions |o..o{ methodSwitches : "session_id"
    users ||..o{ lessonProgress : "user_id"
    users ||..o{ elementErrors : "user_id"
    setRuns |o..o{ elementErrors : "run_id"
    users ||..o{ setRuns : "user_id"
    users ||..o{ speechRecordings : "user_id"
```

| Server-Tabelle | Browser-Store |
|---|---|
| `progress_commits` | `progressCommits` |
| `method_switches` | `methodSwitches` |
| `lesson_progress` | `lessonProgress` |
| `element_errors` | `elementErrors` |
| `set_runs` | `setRuns` |
| `speech_recordings` | `speechRecordings` |

## Inhalte

Curricula mit ihren Themen und Lektionen; im Browser außerdem der Cache heruntergeladener Content-Sets und ihrer Dateien.

### Server-Datenbank

```mermaid
---
config:
  er:
    useMaxWidth: false
---
erDiagram
    accTitle: Datenmodell, Inhalte: Server-Datenbank
    accDescr: Tabellen des Bereichs Inhalte: curriculums, learning_topics, lessons. Beziehungen: curriculums.user_id → users, curriculums.imported_conversation_id → imported_conversations, learning_topics.curriculum_id → curriculums, learning_topics.parent_id → learning_topics, lessons.curriculum_id → curriculums.
    curriculums {
        String id PK
        String user_id FK
        String title
        Text description
        String language
        String imported_conversation_id FK
        DateTime created_at
        DateTime updated_at
    }
    learning_topics {
        String id PK
        String curriculum_id FK
        String parent_id FK
        String title
        Text description
        Integer order_index
        DateTime created_at
        DateTime updated_at
    }
    lessons {
        String id PK
        String curriculum_id FK
        String title
        Text content
        Integer order_index
        DateTime created_at
        DateTime updated_at
    }
    users ||--o{ curriculums : "user_id"
    imported_conversations |o--o{ curriculums : "imported_conversation_id"
    curriculums ||--o{ learning_topics : "curriculum_id"
    learning_topics |o--o{ learning_topics : "parent_id"
    curriculums ||--o{ lessons : "curriculum_id"
```

### Browser-Datenbank

```mermaid
---
config:
  er:
    useMaxWidth: false
---
erDiagram
    accTitle: Datenmodell, Inhalte: Browser-Datenbank
    accDescr: Stores des Bereichs Inhalte: curricula, learningTopics, lessons, contentSets, contentSetFiles. Beziehungen: curricula.user_id → users, curricula.imported_conversation_id → importedConversations, learningTopics.curriculum_id → curricula, learningTopics.parent_id → learningTopics, lessons.curriculum_id → curricula, contentSetFiles.set_pk → contentSets.
    curricula {
        string id PK
        string user_id "user_id"
        string title
        string description
        string language
        string created_at
        string updated_at
        string imported_conversation_id "imported_conversation_id"
    }
    learningTopics {
        string id PK
        string curriculum_id "curriculum_id"
        string parent_id "parent_id"
        string title
        string description
        number order_index "order_index"
        string created_at
        string updated_at
    }
    lessons {
        string id PK
        string curriculum_id "curriculum_id"
        string title
        string content
        number order_index "order_index"
        string created_at
        string updated_at
    }
    contentSets {
        string id PK
        string source "source"
        string branch
        string set_id "set_id"
        string version "version"
        string title
        string title_native
        string language
        string target_language
        string source_language
        string level
        string domain
        number lesson_count
        string description
        string tags
        string cover_image
        string downloaded_at "downloaded_at"
        SetStatus status
        string manifest_yaml
        ContentSetBook book
        SetAttribution attribution
        ContentSetEntry[visibility] visibility
        ContentSetEntry[review_status] review_status
        ContentSetEntry[evaluation] evaluation
    }
    contentSetFiles {
        string id PK
        string set_pk "set_pk"
        string filename "filename"
        string body
        string encoding
    }
    users ||..o{ curricula : "user_id"
    importedConversations |o..o{ curricula : "imported_conversation_id"
    curricula ||..o{ learningTopics : "curriculum_id"
    learningTopics |o..o{ learningTopics : "parent_id"
    curricula ||..o{ lessons : "curriculum_id"
    contentSets ||..o{ contentSetFiles : "set_pk"
```

| Server-Tabelle | Browser-Store |
|---|---|
| `curriculums` | `curricula` |
| `learning_topics` | `learningTopics` |
| `lessons` | `lessons` |
| - | `contentSets` |
| - | `contentSetFiles` |

## Gamification

XP und XP-Käufe, der Abzeichen-Katalog mit den verdienten Abzeichen, Serien und tägliche Missionen.

### Server-Datenbank

```mermaid
---
config:
  er:
    useMaxWidth: false
---
erDiagram
    accTitle: Datenmodell, Gamification: Server-Datenbank
    accDescr: Tabellen des Bereichs Gamification: user_xp, xp_purchases, badges, user_badges, user_streaks, user_missions. Beziehungen: user_badges.user_id → users, user_badges.badge_id → badges, user_missions.user_id → users, user_streaks.user_id → users, user_xp.user_id → users, xp_purchases.user_id → users.
    user_xp {
        String id PK
        String user_id FK, UK
        Integer total_xp
        Integer level
        DateTime updated_at
    }
    xp_purchases {
        String id PK
        String user_id FK
        String item_kind
        String item_id
        Integer cost
        DateTime purchased_at
    }
    badges {
        String id PK
        String key UK
        String name_key
        String description_key
        String icon
        String category
        String base_tier
        Text tier_thresholds
        DateTime created_at
        DateTime updated_at
    }
    user_badges {
        String id PK
        String user_id FK
        String badge_id FK
        String tier
        DateTime earned_at
        DateTime updated_at
    }
    user_streaks {
        String id PK
        String user_id FK, UK
        Integer freezes_available
        DateTime last_freeze_earned_on
        DateTime last_freeze_used_on
        Boolean weekend_mode
        Integer current_streak_days
        Integer longest_streak_days
        DateTime updated_at
    }
    user_missions {
        String id PK
        String user_id FK
        String template_id
        Date assigned_date
        Integer progress
        Boolean completed
        DateTime completed_at
        Boolean xp_awarded
        DateTime created_at
        DateTime updated_at
    }
    users ||--o{ user_badges : "user_id"
    badges ||--o{ user_badges : "badge_id"
    users ||--o{ user_missions : "user_id"
    users ||--o| user_streaks : "user_id"
    users ||--o| user_xp : "user_id"
    users ||--o{ xp_purchases : "user_id"
```

### Browser-Datenbank

```mermaid
---
config:
  er:
    useMaxWidth: false
---
erDiagram
    accTitle: Datenmodell, Gamification: Browser-Datenbank
    accDescr: Stores des Bereichs Gamification: userXp, xpPurchases, badges, userBadges, userStreaks, userMissions. Beziehungen: userXp.user_id → users, xpPurchases.user_id → users, userBadges.user_id → users, userBadges.badge_id → badges, userStreaks.user_id → users, userMissions.user_id → users.
    userXp {
        string id PK
        string user_id UK "&user_id"
        number total_xp
        number level
        string updated_at "updated_at"
    }
    xpPurchases {
        string id PK
        string user_id "user_id, &[user_id+item_kind+item_id]"
        string item_kind "&[user_id+item_kind+item_id]"
        string item_id "&[user_id+item_kind+item_id]"
        number cost
        string purchased_at
    }
    badges {
        string id PK
        string key UK "&key"
        string name_key
        string description_key
        string icon
        string category "category"
        string base_tier
        Record tier_thresholds
        string created_at
        string updated_at "updated_at"
    }
    userBadges {
        string id PK
        string user_id "user_id, &[user_id+badge_id]"
        string badge_id "badge_id, &[user_id+badge_id]"
        string tier
        string earned_at "earned_at"
        string updated_at
    }
    userStreaks {
        string id PK
        string user_id UK "&user_id"
        number freezes_available
        string last_freeze_earned_on
        string last_freeze_used_on
        boolean weekend_mode
        number current_streak_days
        number longest_streak_days
        string updated_at "updated_at"
    }
    userMissions {
        string id PK
        string user_id "user_id, [user_id+assigned_date]"
        string template_id "template_id"
        string assigned_date "[user_id+assigned_date], assigned_date"
        number progress
        boolean completed
        string completed_at
        boolean xp_awarded
        string created_at
        string updated_at
    }
    users ||..o| userXp : "user_id"
    users ||..o{ xpPurchases : "user_id"
    users ||..o{ userBadges : "user_id"
    badges ||..o{ userBadges : "badge_id"
    users ||..o| userStreaks : "user_id"
    users ||..o{ userMissions : "user_id"
```

| Server-Tabelle | Browser-Store |
|---|---|
| `user_xp` | `userXp` |
| `xp_purchases` | `xpPurchases` |
| `badges` | `badges` |
| `user_badges` | `userBadges` |
| `user_streaks` | `userStreaks` |
| `user_missions` | `userMissions` |

## Import

Importierte Chat-Unterhaltungen und ihre Nachrichten.

### Server-Datenbank

```mermaid
---
config:
  er:
    useMaxWidth: false
---
erDiagram
    accTitle: Datenmodell, Import: Server-Datenbank
    accDescr: Tabellen des Bereichs Import: imported_conversations, imported_messages. Beziehungen: anki_card_suggestions.conversation_id → imported_conversations, curriculums.imported_conversation_id → imported_conversations, imported_conversations.user_id → users, imported_conversations.project_id → learning_projects, imported_messages.conversation_id → imported_conversations, learning_sessions.imported_conversation_id → imported_conversations.
    imported_conversations {
        String id PK
        String user_id FK
        String project_id FK
        String source
        String title
        Integer message_count
        DateTime imported_at
        Boolean analyzed
        Text analysis_result
        String topic_tag
        String model
        DateTime source_created_at
        String content_hash
        String source_language
        String target_language
    }
    imported_messages {
        String id PK
        String conversation_id FK
        String role
        Text content
        DateTime timestamp
        Integer order_index
        DateTime created_at
    }
    imported_conversations |o--o{ anki_card_suggestions : "conversation_id"
    imported_conversations |o--o{ curriculums : "imported_conversation_id"
    users ||--o{ imported_conversations : "user_id"
    learning_projects |o--o{ imported_conversations : "project_id"
    imported_conversations ||--o{ imported_messages : "conversation_id"
    imported_conversations |o--o{ learning_sessions : "imported_conversation_id"
```

### Browser-Datenbank

```mermaid
---
config:
  er:
    useMaxWidth: false
---
erDiagram
    accTitle: Datenmodell, Import: Browser-Datenbank
    accDescr: Stores des Bereichs Import: importedConversations, importedMessages. Beziehungen: learningSessions.imported_conversation_id → importedConversations, curricula.imported_conversation_id → importedConversations, importedConversations.user_id → users, importedConversations.project_id → learningProjects, importedMessages.conversation_id → importedConversations, ankiCards.conversation_id → importedConversations.
    importedConversations {
        string id PK
        string user_id "user_id"
        string project_id "project_id"
        string source "source"
        string title
        number message_count
        string imported_at "imported_at"
        boolean analyzed "analyzed"
        Record analysis_result
        string topic_tag
        string model
        string source_created_at
        string content_hash "content_hash"
        string source_language
        string target_language
    }
    importedMessages {
        string id PK
        string conversation_id "conversation_id"
        MessageRole role
        string content
        string timestamp
        number order_index
        string created_at "created_at"
    }
    importedConversations |o..o{ learningSessions : "imported_conversation_id"
    importedConversations |o..o{ curricula : "imported_conversation_id"
    users ||..o{ importedConversations : "user_id"
    learningProjects |o..o{ importedConversations : "project_id"
    importedConversations ||..o{ importedMessages : "conversation_id"
    importedConversations |o..o{ ankiCards : "conversation_id"
```

| Server-Tabelle | Browser-Store |
|---|---|
| `imported_conversations` | `importedConversations` |
| `imported_messages` | `importedMessages` |

## KI

KI-generierte Anki-Kartenvorschläge und Lernfragen; im Browser außerdem die zwischengespeicherten Berichte der KI-Inhaltsprüfung.

### Server-Datenbank

```mermaid
---
config:
  er:
    useMaxWidth: false
---
erDiagram
    accTitle: Datenmodell, KI: Server-Datenbank
    accDescr: Tabellen des Bereichs KI: anki_card_suggestions, study_questions. Beziehungen: anki_card_suggestions.user_id → users, anki_card_suggestions.session_id → learning_sessions, anki_card_suggestions.conversation_id → imported_conversations, anki_card_suggestions.project_id → learning_projects, study_questions.user_id → users, study_questions.project_id → learning_projects, study_questions.session_id → learning_sessions.
    anki_card_suggestions {
        String id PK
        String user_id FK
        String session_id FK
        String conversation_id FK
        String project_id FK
        String card_type
        Text front
        Text back
        Text tags
        Boolean accepted
        Boolean rejected
        DateTime exported_at
        DateTime created_at
        DateTime updated_at
    }
    study_questions {
        String id PK
        String user_id FK
        String project_id FK
        String session_id FK
        Text question
        Text expected_answer
        String question_type
        String difficulty
        String topic
        Boolean edited
        DateTime created_at
        DateTime updated_at
    }
    users ||--o{ anki_card_suggestions : "user_id"
    learning_sessions |o--o{ anki_card_suggestions : "session_id"
    imported_conversations |o--o{ anki_card_suggestions : "conversation_id"
    learning_projects |o--o{ anki_card_suggestions : "project_id"
    users ||--o{ study_questions : "user_id"
    learning_projects ||--o{ study_questions : "project_id"
    learning_sessions |o--o{ study_questions : "session_id"
```

### Browser-Datenbank

```mermaid
---
config:
  er:
    useMaxWidth: false
---
erDiagram
    accTitle: Datenmodell, KI: Browser-Datenbank
    accDescr: Stores des Bereichs KI: ankiCards, studyQuestions, aiValidationResults. Beziehungen: ankiCards.user_id → users, ankiCards.session_id → learningSessions, ankiCards.conversation_id → importedConversations, ankiCards.project_id → learningProjects, studyQuestions.user_id → users, studyQuestions.project_id → learningProjects, studyQuestions.session_id → learningSessions.
    ankiCards {
        string id PK
        string user_id "user_id"
        string session_id "session_id"
        string conversation_id "conversation_id"
        string project_id "project_id"
        string card_type
        string front
        string back
        string tags
        boolean accepted
        boolean rejected
        string exported_at
        string created_at
        string updated_at "updated_at"
    }
    studyQuestions {
        string id PK
        string user_id "user_id"
        string project_id "project_id"
        string session_id "session_id"
        string question
        string expected_answer
        string question_type
        string difficulty
        string topic
        boolean edited
        string created_at
        string updated_at "updated_at"
    }
    aiValidationResults {
        string id PK
        string source
        string set_id "set_id"
        string set_version
        string content_hash
        ValidationResult[] results
        string[] response_ids
        string provider
        string model
        number card_count
        number issue_count
        string checked_at "checked_at"
        AiValidationSignature signature
    }
    users ||..o{ ankiCards : "user_id"
    learningSessions |o..o{ ankiCards : "session_id"
    importedConversations |o..o{ ankiCards : "conversation_id"
    learningProjects |o..o{ ankiCards : "project_id"
    users ||..o{ studyQuestions : "user_id"
    learningProjects ||..o{ studyQuestions : "project_id"
    learningSessions |o..o{ studyQuestions : "session_id"
```

| Server-Tabelle | Browser-Store |
|---|---|
| `anki_card_suggestions` | `ankiCards` |
| `study_questions` | `studyQuestions` |
| - | `aiValidationResults` |

## Felder, die die Zuordnungsdatei auflöst

Die Browser-Datenbank deklariert keine Fremdschlüssel, und manche Server-Spalten tragen auch keinen. Die Zuordnungsdatei löst jedes solche `*_id`-Feld auf: als Verweis (oben eine gestrichelte Linie), als Hinweis auf etwas außerhalb der Datenbank oder als Bezeichner, der auf nichts verweist. Hier stehen die Felder, für die sie einen Grund angibt; die Gründe stammen wörtlich aus der Zuordnungsdatei und bleiben englisch.

| Datenbank | Feld | Aufgelöst als | Grund |
|---|---|---|---|
| Server | `element_errors.exercise_id` | außerhalb der Datenbank | id of an exercise inside a lesson of a content set |
| Server | `element_errors.lesson_id` | außerhalb der Datenbank | id of a lesson inside a content set, referenced by its string id |
| Server | `element_errors.run_id` | Verweis auf `set_runs` | with user_id and set_id names a run in set_runs (unique per user, set and run); no foreign key because rows from before set runs existed get their set_runs row only when the run is first read or written |
| Server | `element_errors.set_id` | außerhalb der Datenbank | id of a content set from a content repository; the set lives in the content cache on disk, not in the database |
| Server | `lesson_progress.set_id` | außerhalb der Datenbank | id of a content set from a content repository; the set lives in the content cache on disk, not in the database |
| Server | `set_runs.run_id` | kein Verweis | the run's own number within its user and set (1, 2, ...) |
| Server | `set_runs.set_id` | außerhalb der Datenbank | id of a content set from a content repository; the set lives in the content cache on disk, not in the database |
| Server | `speech_recordings.exercise_id` | außerhalb der Datenbank | id of an exercise inside a lesson of a content set |
| Server | `speech_recordings.set_id` | außerhalb der Datenbank | id of a content set from a content repository; the set lives in the content cache on disk, not in the database |
| Server | `user_missions.template_id` | außerhalb der Datenbank | id of a mission template in the missions plugin's catalog (templates.yaml) |
| Server | `xp_purchases.item_id` | außerhalb der Datenbank | id of an avatar frame, mascot variant or arcade game from the frontend shop catalogs; item_kind says which |
| Browser | `aiValidationResults.set_id` | außerhalb der Datenbank | id of the checked content set; the report's id is source#set_id |
| Browser | `contentSets.set_id` | außerhalb der Datenbank | the set's own id from the content repository manifest; with source and version it forms the cache key id |
| Browser | `elementErrors.exercise_id` | außerhalb der Datenbank | id of an exercise inside a lesson of a content set |
| Browser | `elementErrors.lesson_id` | außerhalb der Datenbank | id of a lesson inside a content set, referenced by its string id |
| Browser | `elementErrors.run_id` | Verweis auf `setRuns` | with user_id and set_id names a run in setRuns; the run of a row from before set runs existed is created only when it is first read or written |
| Browser | `elementErrors.set_id` | außerhalb der Datenbank | id of a content set from a content repository; contentSets keys a cached set by source, set_id and version, so set_id alone names no single row |
| Browser | `lessonProgress.set_id` | außerhalb der Datenbank | id of a content set from a content repository; contentSets keys a cached set by source, set_id and version, so set_id alone names no single row |
| Browser | `setRuns.run_id` | kein Verweis | the run's own number within its user and set (1, 2, ...) |
| Browser | `setRuns.set_id` | außerhalb der Datenbank | id of a content set from a content repository; contentSets keys a cached set by source, set_id and version, so set_id alone names no single row |
| Browser | `speechRecordings.exercise_id` | außerhalb der Datenbank | id of an exercise inside a lesson of a content set |
| Browser | `speechRecordings.set_id` | außerhalb der Datenbank | id of a content set from a content repository; contentSets keys a cached set by source, set_id and version, so set_id alone names no single row |
| Browser | `userMissions.template_id` | außerhalb der Datenbank | id of a mission template in the missions plugin's catalog (templates.yaml) |
| Browser | `xpPurchases.item_id` | außerhalb der Datenbank | id of an avatar frame, mascot variant or arcade game from the frontend shop catalogs; item_kind says which |
