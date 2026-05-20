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
per-message timing metrics exposed to the UI.

The full architecture, domain model, plugin catalogue, hook
specifications, mobile/PWA decisions, and roadmap live in
[adaptive-learner-project-reference.md](adaptive-learner-project-reference.md).
