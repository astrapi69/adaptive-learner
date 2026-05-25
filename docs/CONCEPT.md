# Concept

Adaptive Learner is an adaptive learning system based on the six-method
learning model described in Asterios Raptis' Medium article series
*Von Theorie zur Praxis* (German). The system identifies the user's
preferred learning style via a 12-question assessment, runs
AI-supported learning sessions through a seven-step cycle, and lets a
dual-prompt AI (v0.5.0) decide when the learner is ready to advance.
A second AI call per round-trip judges readiness and may suggest
advancing, repeating, skipping ahead, or moving backward when the
learner's last turn shows regression.

Since v0.6.0 the frontend is a **Progressive Web App** —
installable on mobile or desktop, with offline read access to past
sessions and the Dashboard. Sessions themselves need network
because the AI provider lives outside the browser; the app surfaces
this clearly via an online/offline indicator in the nav and a
graceful inline message on `/session` when offline.

Since v0.7.0 the frontend also ships a **local-first storage mode**.
A storage abstraction layer routes through either the FastAPI
backend or a Dexie-backed IndexedDB store; in local mode AI calls
fire direct from the browser (Anthropic, OpenAI, or Gemini). A
public Dexie build is deployed to GitHub Pages so anyone with an
AI API key can try AdaptiveLearner without standing up a backend
first. The user can switch between modes in Settings.

Since v0.9.0 the system imports existing chat history (ChatGPT,
Claude, Gemini transcripts) and extracts structured learning
insights: topic, strengths, weaknesses, error patterns, and a
recommended method to continue. v1.0.0 added bidirectional
WiFi-local sync between devices with AI-escalated conflict
resolution. v1.2.0 shipped backup + restore with auto-rotation,
and v1.3.0 added PDF + Markdown progress exports.

Since v1.4.0 sessions no longer cap at step 7 — once the
learner integrates the topic, a topic-transition AI call picks
a natural next subtopic and the cycle resets to step 1 within
the same session (hard cap of 5 cycles per session prevents
runaway). v1.5.0 made the cycle-boundary AI roundtrip parallel
(step-evaluation + topic-transition fire concurrently), with
per-message timing metrics exposed to the UI. v1.6.0 added an
SSE streaming path so AI replies render token-by-token in both
storage modes.

Since v1.7.0 sync pairing uses the camera (html5-qrcode QR
scanner with file-upload fallback). v1.8.0 closed the sync
surface to the full 28-table mirror (step_evaluations,
session_notes, imported conversations + messages, i18n
catalogs). v1.9.0 added a global Subjects + Tags taxonomy
(80+ pre-seeded subjects across 8 categories, dashboard
filter bar, project taxonomy editor). v1.10.0 added swipe
gestures (Assessment paging, Session cycle peek, Curriculum
topic actions) with reduced-motion respect and a Settings
opt-out. v1.11.0 replaced hardcoded model dropdowns with a
live provider-API ModelPicker (Anthropic / OpenAI / Gemini
`/v1/models`, 1-hour cache, offline fallback). v1.12.0
shipped a client-side backup-diff engine with field-level
per-table reports + a Markdown exporter. v1.13.0 replaced
the EN-passthrough PT / TR / JA i18n catalogs with native
translations.

Since v1.14.0 session-rating notes, curriculum descriptions,
and lesson content use TipTap (StarterKit + 15 extensions:
lowlight code blocks in 11 languages, task lists, links,
character count). v1.15.0 grew the Playwright smoke suite
from 6 to 16 spec files. v1.16.0 added gamification: an XP
singleton with an exponential level curve, 24 badges in 5
categories, a streak tracker with freeze stockpile + weekend
mode + GitHub-style heatmap. v1.17.0 added Anki `.apkg`
export (client-side sql.js + JSZip, AI-extracted card
suggestions from sessions and conversations, byte-compatible
vocabulary transform shared by backend + frontend). v1.18.0
added Web Speech voice (TTS button on AI replies, STT mic on
session input) and a pronunciation-practice plugin gated to
the Languages subject. v1.19.0 added a NotebookLM
integration: AI-generated active-recall `StudyQuestion`
items, a one-shot study-guide generator (~30 K-char context),
and a client-side NotebookLM-optimised ZIP export.

Since v1.20.0 AI provider keys resolve through a three-layer
chain: environment > `~/.config/adaptive_learner/secrets.yaml`
> Fernet-encrypted DB column. The Settings UI shows the
per-provider source ("Key from: secrets.yaml" / "environment"
/ "Settings") and disables the input when the key is
externally managed. v1.22.0 added an actionable failure path:
5xx error toasts carry a "Report Issue" button that opens a
Radix dialog with a pre-filled GitHub issue URL (error,
optional environment info, opt-in sanitised action history).
v1.23.0 added an in-app contextual help system — 22 glossary
entries surfaced as dotted-underline tooltips with a
slide-over drawer for full Markdown articles. v1.24.0
completed a WCAG 2.1 Level AA accessibility audit + the
remediation work it surfaced. v1.25.0 added identity
persistence to the config directory (the app survives a full
browser-data wipe in API mode by re-reading
`~/.config/adaptive_learner/identity.yaml`) and pairs it with
a Settings > Danger Zone three-step typed-confirm reset
(`POST /api/reset` truncates every table and scrubs `ai.*`
from `secrets.yaml` while preserving the Fernet
`secret_key`).

The full architecture, domain model, plugin catalogue, hook
specifications, mobile/PWA decisions, and roadmap live in
[adaptive-learner-project-reference.md](adaptive-learner-project-reference.md).
