# Adaptive Learner Roadmap

Current state: **v0.7.0 released (Phase 10 / Dexie parallel storage + GH Pages shipped 2026-05-19).**

## Phase history (completed)

| Phase | Release | Headline |
|---|---|---|
| 1 | v0.1.0 | Skeleton strip + domain models + core routers + plugin hookspecs |
| 2-4 | v0.1.0 | Backend domain wiring + 7 plugins + frontend pages |
| 5 | v0.2.0 | Multi-provider AI (Anthropic / OpenAI / Gemini), server-side orchestration |
| 6 | v0.3.0 | Per-(method, step) prompt matrix, Lesson CRUD, Playwright smoke specs |
| 7 | v0.4.0 | Cycle-step advance, Dashboard polish, model picker, spaced recommendations |
| 7-extras | v0.4.1 | Skip-button hoist, favicon `.ico` fallback, CI Release Gate fix |
| 8 | v0.5.0 | Dual-prompt AI cycle transitions, StepEvaluation persistence, tracking aggregates |
| 9 | v0.6.0 | Mobile PWA — responsive UI, service worker, install prompt, offline indicator |
| **10** | **v0.7.0** | **Dexie parallel storage + GitHub Pages deploy — IStorageService, browser-direct AI, public site** |

Annotated tags + GitHub Releases ship same-day; see `git tag` for the full list.

---

## Next phase (planned)

**Phase 11 candidates** (no commitment yet — surface user signal first):

- **v0.7.x — Sync between Dexie ↔ API modes.** Out of scope for
  v0.7.0 per Phase 10 spec. Real users with content in both
  modes will need a one-way or two-way sync flow eventually;
  defer until someone hits the friction.
- **v0.8.x — Async dual-call.** Convert `/message` from sync to
  async `asyncio.gather` so learning + evaluator fire in
  parallel. Saves ~500ms per round-trip. Same story for Dexie
  mode: kick off the AI completion and the step evaluator
  simultaneously. Revisit when users report latency.
- **v0.8.x — Auto-loop step 7 → 1.** When the dual-prompt
  evaluator signals integration (step 7 + high confidence +
  repeat suggestion), offer to start a new cycle on a fresh
  topic. Requires a topic-selection prompt + UX. (Deferred from
  Phase 8, Q2.)
- **v0.8.x — Swipe gestures on Assessment.** Deferred from
  Phase 9, Q5. Needs accessibility wiring (keyboard, reduced-
  motion, screen-reader). Real touch-event handling.
- **v0.8.x — Switch recommendation in Dexie.** Port the
  stagnation-based `switching.py` heuristic to TS so the local
  mode surfaces method-switch hints too. Out of scope for
  v0.7.0 (placeholder returns `{recommended:false}`).

---

## P3 — Cleanup follow-ups

- **iOS-Safari `apple-mobile-web-app-*` meta tags.** Manifest is
  standard-compliant; iOS PWA install works but the
  iOS-specific status-bar / title meta tags aren't wired. Add
  if iOS users report degraded standalone UX.
- **Per-route SW cache TTL overrides.** Today everything under
  `/api/` is 24h LRU. `/api/users/{id}` might want shorter; the
  per-project tracking data might want longer. Defer until usage
  pattern shows a real need.
- **"Force refresh" + "Opt out of offline cache" in Settings UI.**
  Power-user knobs for the SW cache. Defer until a user asks.

---

## P5 — Speculative

- **Push notifications.** SW is registered, foundation is there;
  notification opt-in + delivery + a "next session due" trigger
  would be its own phase.
- **Native iOS / Android wrappers.** Capacitor / Tauri Mobile.
  Lower priority than the PWA route since installable PWA covers
  most use cases.

---

## Open backlog

See [backlog.md](backlog.md) for items outside the phase plan.

Archive: [docs/roadmap-archive/](roadmap-archive/) (not yet populated;
phase completions are recorded in `changelog/releases/v*.md`).
