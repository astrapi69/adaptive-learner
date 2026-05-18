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

The full architecture, domain model, plugin catalogue, hook
specifications, mobile/PWA decisions, and roadmap live in
[adaptive-learner-project-reference.md](adaptive-learner-project-reference.md).
