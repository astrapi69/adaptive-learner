# Adaptive Learner Backlog

State: **post v0.6.0 (Phase 9 / Mobile PWA shipped 2026-05-18).**

Daily-planning view of items outside the phase plan. The
authoritative roadmap lives in [ROADMAP.md](ROADMAP.md); use
this file for granular items + status.

Sort by priority tier (P0 most urgent, P5 most speculative).
BLOCKED items get their own section between P5 and the
archive link.

---

## P0 — Deadline / Blocker / Security

*(none)*

## P1 — Architecture / hygiene debt

- **PWA-001**: `iOS-Safari standalone meta tags` — manifest works
  on iOS but `apple-mobile-web-app-{title, status-bar-style,
  capable}` meta tags aren't wired in `frontend/index.html`.
  Wire if iOS PWA installs show degraded UX. — see ROADMAP > P3.

## P2 — High-value user features

- **PWA-002**: `Auto-loop step 7 → 1 with fresh topic` — when the
  dual-prompt evaluator signals integration, offer to start a new
  cycle on a fresh topic. Deferred from Phase 8 Q2. — see
  ROADMAP > Next phase candidates.

## P3 — Infrastructure / quality

- **PWA-003**: `Per-route SW cache TTL overrides`. Today every GET
  `/api/` is 24h. `/api/users/{id}` could be shorter; tracking data
  could be longer. — see ROADMAP > P3.
- **PWA-004**: `"Force refresh" + "Opt out of offline cache" in
  Settings UI`. Power-user knobs. — see ROADMAP > P3.

## P4 — Roadmap / future phases

- **PWA-005**: `Async dual-call (asyncio.gather)`. ~500ms saved per
  round-trip. Deferred from Phase 8 Q1. — see ROADMAP > Next phase.
- **PWA-006**: `Swipe gestures on Assessment`. Deferred from Phase
  9 Q5. Needs a11y wiring. — see ROADMAP > Next phase.

## P5 — Speculative / nice-to-have

- **PWA-007**: `Push notifications`. SW is registered, foundation is
  there; opt-in + delivery + "next session due" trigger would be
  its own phase. — see ROADMAP > P5.
- **PWA-008**: `Native iOS / Android wrappers` (Capacitor / Tauri
  Mobile). Lower priority than PWA route. — see ROADMAP > P5.

## Blocked / Upstream Wait

*(none)*
