# Adaptive Learner

**Learn the way you actually learn.**

Adaptive Learner is an open-source learning companion built
on a research-backed six-method model. You take a 12-question
assessment, the app discovers which methods suit you, then
AI-supported sessions walk you through a seven-step learning
cycle. The app adapts how it teaches based on how you
actually learn. **v1.20.0**, 34 development phases shipped.

[Try it now](https://astrapi69.github.io/adaptive-learner/){ .md-button .md-button--primary }
[GitHub](https://github.com/astrapi69/adaptive-learner){ .md-button }

---

## What makes it different

### Six methods, not one

Most learning apps pick one approach — flashcards, video,
gamified streaks — and assume everyone learns the same way.
Adaptive Learner ships six methods (deductive, inductive,
error-based, dialogic, contextual, AI-adaptive) and helps you
switch between them as you grow.

[The six methods →](concept/six-methods.md)

### A seven-step learning cycle

Each session walks through Input → Attempt → Error →
Feedback → Adapt → Repeat → Integrate. A dual-prompt AI
evaluates per turn whether you're ready to advance,
stay, or step back. No conveyor belt — real cognitive
pacing.

[The seven-step cycle →](concept/seven-steps.md)

### Local-first, AI-powered

Toggle between **Local mode** (everything in your browser,
AI calls direct to Anthropic / OpenAI / Gemini) and
**Server mode** (FastAPI backend). Bring your own AI key.
Install as a PWA — works offline for past sessions and
Dashboard.

[Getting started →](user-guide/getting-started.md)

### Git for learning

Sessions are commits. Trends emerge across weeks. Streaks
matter but aren't the point. The point is patterns: which
method works for which topic, where you spend cognitive
time, what method-switch unlocked progress.

[Tracking →](concept/tracking.md)

---

## Quick start

1. **Open the live app** at
   [astrapi69.github.io/adaptive-learner](https://astrapi69.github.io/adaptive-learner/).
2. **Pick your language** + **onboard your learning project**
   (topic, goal, timeframe).
3. **Take the 12-question assessment** (~2 minutes).
4. **Add your AI API key** (Anthropic, OpenAI, or Gemini —
   free tiers work).
5. **Start your first session** from the Dashboard.

[Full getting-started guide →](user-guide/getting-started.md)

---

## Documentation

- [**User Guide**](user-guide/getting-started.md) — for
  learners using the app.
- [**Concept**](concept/philosophy.md) — the pedagogical
  thinking.
- [**Developer Docs**](developer/architecture.md) — for
  contributors and plugin authors.
- [**API Reference**](api/overview.md) — for integrators.

---

## Status

Active development. **v1.20.0 was released 2026-05-22**
with `secrets.yaml` file-based key configuration for the
desktop launcher use case.

- **2634 tests** (786 backend + 615 plugins + 1233 frontend
  Vitest + 16 Playwright smoke spec files)
- **8 languages, all fully translated** (DE / EN / ES / FR /
  EL / PT / TR / JA)
- **10 plugins** (assessment / 3 AI providers / session /
  tracking / tools / gamification / anki / notebooklm)
- **25 SQLAlchemy models**, sync surface 28 tables
- **2 storage modes** (Local IndexedDB / FastAPI backend),
  plus the desktop launcher's `secrets.yaml` overlay
- **MIT licensed**

Source code, issues, and contributions:
[github.com/astrapi69/adaptive-learner](https://github.com/astrapi69/adaptive-learner).
