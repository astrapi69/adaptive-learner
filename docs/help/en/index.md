# Adaptive Learner

**Learn the way you actually learn.**

Adaptive Learner is an open-source learning companion built
on a research-backed six-method model. You take a 12-question
assessment, the app discovers which methods suit you, then
AI-supported sessions walk you through a seven-step learning
cycle. The app adapts how it teaches based on how you
actually learn. Continuously developed - find the current
version on the [Releases page](https://github.com/astrapi69/adaptive-learner/releases).

[Try it now](https://astrapi69.github.io/adaptive-learner/){ .md-button .md-button--primary }
[GitHub](https://github.com/astrapi69/adaptive-learner){ .md-button }

---

## What makes it different

### Six methods, not one

Most learning apps pick one approach - flashcards, video,
gamified streaks - and assume everyone learns the same way.
Adaptive Learner ships six methods (deductive, inductive,
error-based, dialogic, contextual, AI-adaptive) and helps you
switch between them as you grow.

[The six methods →](concept/six-methods.md)

### A seven-step learning cycle

Each session walks through Input → Attempt → Error →
Feedback → Adapt → Repeat → Integrate. A dual-prompt AI
evaluates per turn whether you're ready to advance,
stay, or step back. No conveyor belt - real cognitive
pacing.

[The seven-step cycle →](concept/seven-steps.md)

### Local-first, AI-powered

Toggle between **Local mode** (everything in your browser,
AI calls direct to Anthropic / OpenAI / Gemini) and
**Server mode** (FastAPI backend). Bring your own AI key.
Install as a PWA - works offline for past sessions and
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
4. **Add your AI API key** (Anthropic, OpenAI, or Gemini -
   free tiers work).
5. **Start your first session** from the Dashboard.

[Full getting-started guide →](user-guide/getting-started.md)

---

## Documentation

- [**User Guide**](user-guide/getting-started.md) - for
  learners using the app.
- [**Concept**](concept/philosophy.md) - the pedagogical
  thinking.
- [**Developer Docs**](developer/architecture.md) - for
  contributors and plugin authors.
- [**API Reference**](api/overview.md) - for integrators.

---

## Status

Active development. The current version and its highlights
live on the [GitHub Releases page](https://github.com/astrapi69/adaptive-learner/releases);
the full history is in
[changelog/releases](https://github.com/astrapi69/adaptive-learner/tree/main/changelog/releases).

- **Thousands of automated tests** across backend, plugins, and
  frontend (Vitest), plus a Playwright smoke + Dexie-mode
  release-gate suite
- **11 UI languages, all fully translated** (DE / EL / EN /
  ES / FR / HI / ID / JA / KO / PT / TR)
- **13 plugins** (assessment / 3 AI providers / session /
  tracking / tools / gamification / anki / notebooklm /
  learning-repo / content-loader / missions)
- **26 bundled content sets** - 424 lessons / 5405 cards
  across 10 content languages and 5 domains
- **30 SQLAlchemy models**, sync surface 30 tables
- **2 storage modes** (Local IndexedDB / FastAPI backend),
  plus the desktop launcher's `secrets.yaml` overlay
- **MIT licensed**

Source code, issues, and contributions:
[github.com/astrapi69/adaptive-learner](https://github.com/astrapi69/adaptive-learner).
