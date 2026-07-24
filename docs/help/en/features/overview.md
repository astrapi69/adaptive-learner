# Feature overview

This page is the canonical answer to "what can Adaptive Learner actually
do?". It lists every major user-facing capability of the app, grouped by
theme, and is kept current with each release. Other places (README, the
individual help pages) link here instead of maintaining their own copies
of this list.

## Learning core

- **Six learning methods** (deductive, inductive, error-based, dialogic,
  contextual, AI-adaptive) with bespoke AI prompts per method and step.
- **Seven-step session cycle**: input, focus, attempt, feedback, refine,
  transfer, integrate. A dual-prompt evaluator judges every turn and
  decides whether to advance, repeat, skip ahead, or step back.
- **Auto-loop**: when a topic is integrated, the session picks a new
  subtopic and starts a fresh cycle (capped per session).
- **Method switching**: stagnation detection recommends a different
  method when ratings flatline; one-click accept.
- **Placement assessment** (optional, resumable) that computes a
  six-method learning profile; a two-field quick start works without it.

See [Learning sessions](../user-guide/learning-session.md) and
[The learning method](../concept/philosophy.md).

## AI tutor chat

- **Session chat built on assistant-ui**: streaming token-by-token
  replies, markdown rendering, theming, and full localization.
- **Voice**: microphone dictation into the chat, read-aloud for replies,
  and a dedicated pronunciation practice mode.
- **Bring your own key**: Anthropic Claude, OpenAI GPT, and Google
  Gemini as separate provider plugins; live model discovery with a
  recommended/all picker; per-provider key test and a key vault with
  rollback.
- **Imported conversations continue as tutor sessions**, keeping the
  original topic and analysis context.
- **"Ask AI"** on theory blocks and exercises, and AI replies always in
  the learner's UI language.

## Exercise types

Six core types every set can use, plus five extension types a set can
ship:

| Core type | What the learner does |
|---|---|
| Matching | Pair terms across two columns (start from either side) |
| Picture choice | Pick the matching image |
| Free text | Type the answer (typo tolerance, multiple accepted answers, optional AI second opinion) |
| Cloze | Fill blanks by typing, selecting, or multi-select |
| Word tiles | Compose the answer from shuffled tiles (touch drag) |
| Multiple choice | Single or multi answer |

| Extension type | What the learner does |
|---|---|
| Categorization | Sort items into buckets |
| Error correction | Find and fix the mistake in a sentence |
| Reading comprehension | Read a passage, answer questions |
| Graded quiz | A scored mini-quiz |
| Audio dictation | Listen and type what was said |

- Exercises are **direction-aware** (recognize vs. produce), show a
  **per-exercise difficulty indicator**, support **code and formula
  content** with syntax highlighting, and offer **listen-first audio**
  variants.
- Wrong answers get **token-level diff feedback**; hints are staged and
  cost XP.

See [Lessons](../user-guide/lessons.md) for the learner view.

## Lessons and learning mechanics

- **Seven ways to play a lesson or set**: Practice, Exam (delayed
  feedback, pass/fail verdict, XP bonus), Timed, Reverse, Shuffle,
  Endless, and a gated "train errors" mode that replays only what went
  wrong.
- **Spaced repetition (SRS)** on per-element error history: due-review
  queue, direction-aware mastery, exam-mode interval boost, and a
  configurable review-session length.
- **Adaptive lessons** generated on demand from your own error patterns
  (rule-based, offline, no API key needed).
- **Error replay and a correction round** at lesson end drill exactly
  the words you missed.
- **Lesson flow control**: pause, resume at the exact step, autosave,
  and a paused-lessons widget on the dashboard.
- 0-3 star ratings, favorites, next-step suggestions, auto-splitting of
  oversized lessons, and theory back-links from exercises.

## Lesson authoring (Create-Lesson)

- **A no-API-key wizard** builds a complete, shareable lesson: card
  editor with drag-and-drop and CSV import, image upload per card,
  templates, draft autosave, and preview in the real lesson player.
- **Every exercise is editable**: all core types can be edited after
  generation, added by hand, and balanced; an **extension-authoring
  wizard** covers all five extension types, including an audio-file
  upload for dictation.
- **Book-text ingestion**: paste textbook text, or upload a book file
  (EPUB, DOCX, TXT, Markdown) with a chapter picker, multi-select of
  detected sections, an automatic front-/backmatter exclusion heuristic,
  and batch lesson generation per section.
- **AI exercise generation** (bring your own key) with a deterministic
  quality gate, regenerate-with-feedback, and batch generation for a
  whole set.
- **Manage your own lessons**: edit any lesson of a multi-lesson set via
  a lesson picker, combine own lessons into a set, and pick a content
  domain (languages plus knowledge domains).

See [Creating lessons](../content-creation/overview.md).

## Import and analysis

- **Chat-history import** from ChatGPT, Claude, Gemini, and arbitrary
  markdown or pasted text.
- **AI analysis** extracts topic, weaknesses, error patterns, the
  recommended method, vocabulary, and a suggested curriculum.
- One click seeds a **curriculum**, starts a **targeted session**, or
  converts the analysis into a **replayable offline lesson**.

## Content management

- **Content hub** with Discover / My content / Import tabs, list or
  grid view, and a search/filter bar (language, level, domain, trust,
  AI-checked).
- **Downloadable lesson sets** from public GitHub content repositories,
  cached for offline use; sets can be hidden via a manifest visibility
  flag.
- **Federated repositories**: connect multiple own or third-party
  content repos (private repos via token), a recommended-repos section,
  and trust badges per source.
- **Community sharing**: a four-step share wizard opens a real pull
  request against a content repo, with smart placement and duplicate
  detection; invitation codes support private sharing for coaches.
- **Per-set deep links and QR codes**, a learning-path view with
  per-set mastery, book recommendations per domain, and a book
  companion section per set.

See [Content browser](content-browser.md),
[Discover](discover.md), and
[Content repositories](content-repos.md).

## Gamification

- **XP and levels** with a visible XP badge and per-lesson rewards.
- **Tiered badge catalog** (bronze/silver/gold, locked badges stay
  visible with an unlock hint).
- **Streaks** with a heatmap, and **daily missions** (up to three
  adaptive goals per day).
- **Celebrations**: earned, intensity-configurable praise, milestone
  overlays, optional sounds, all reduced-motion-safe.

## Exports and backup

- **Anki**: AI-extracted flashcards reviewed in-app, exported as
  `.apkg` or `.txt`.
- **NotebookLM**: a ZIP with summary, vocabulary, rules, errors,
  flashcards, and sessions, plus active-recall questions and a study
  guide.
- **Learning repository**: per-project markdown artefacts (README,
  stats, cheatsheet, roadmap), downloadable as ZIP or git-committed in
  server mode.
- **Progress reports** as Markdown or PDF; lesson results exportable
  for AI-assisted practice; native share sheet for results.
- **Backups**: `.alb` ZIP backup covering the full data surface,
  save-to-disk, first-run restore, online-to-local migration, and a
  separate passphrase-encrypted `.alk` export for AI keys.

See [Backup and restore](backup.md).

## Platform

- **Progressive Web App**: installable, offline-capable, service-worker
  updates with an update banner, works fully in the browser.
- **Two storage modes**: local-first (everything in browser IndexedDB,
  AI calls go direct to the provider, no server needed) or server mode
  (FastAPI backend with SQLite, multi-device).
- **Local-network sync** between devices with QR-code pairing and
  conflict resolution.
- **Desktop launcher** for Linux, macOS, and Windows: a Docker-based
  one-click self-hosting setup with context-aware Docker detection and
  self-diagnosis.
- **Eleven UI languages**, fully translated, with a searchable language
  picker.
- **Open content format**: lessons are plain JSON validated against a
  published schema; the app consumes the content engine as a package.

See [Installation](../install/launcher.md).

## Accessibility and UX

- **WCAG-AA-verified themes** (light, dark, colored presets, follow-OS
  auto mode), enforced by automated contrast checks.
- **Keyboard-first**: global shortcuts with a help overlay, Enter
  advances lessons, Tab navigates cloze blanks.
- **Screen-reader support**: landmarks, ARIA labels and live regions,
  chart data tables, dialog focus management.
- **Reduced motion** is honored everywhere; read-aloud (TTS) for
  lessons and chat.
- **Context-sensitive in-app help**: the help panel opens the article
  for the current view; every article links to this documentation site.
