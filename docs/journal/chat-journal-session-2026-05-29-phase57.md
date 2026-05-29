# Chat journal — 2026-05-29 — Phase 57 (v1.40.0)

Badge Tiers (bronze/silver/gold) + Badge Gallery — the EXP-010
follow-up deferred from v1.39.0. Plus two exercise-UX bugfixes the
user injected mid-phase.

## Pre-flight

- Baseline green: `make test`, `tsc`, `npm run build`, `npm run test`,
  `make test-dexie-smoke` all exit 0 at v1.39.0 (ddf1676).

## Design decisions (audited before coding)

The plan contained a real internal contradiction (catalog shape: the
Rules said "no breaking change / backfill bronze" but the 57A example
showed a consolidated `lessons_completed` key; "all badges get 3
tiers" vs one-shot badges having no progression). Produced an
audit + status report + decision memos under `docs/audits/2026-05-29-*`
and surfaced the forks to the user. Final model (user-chosen):

- **Keep all 28 keys** — no merge, no removal, no data loss.
- **Static visual tiers**: sibling families (`sessions_10/50/100`,
  `level_5/10/25`, `streak_3/7/30/100`) render as one bronze→silver→
  gold progression; each keeps its own row, tier is a fixed attribute.
- **Dynamic tiers**: siblingless count badges (`lessons_10`,
  `review_master`) climb in place — a high-water mark that never
  demotes — awarding the XP delta per step.
- **`user_badges` sync promoted append-only → MUTABLE** (tier is
  monotonic, so LWW on `updated_at` stays correct).

## Sub-phases (each its own atomic, individually-green commit)

1. **57A** `9dbdd87` — schema + Alembic 0022 + static/dynamic catalog +
   sync mutable + Dexie v21 + seeder + schemas + tests.
2. **Matching bugfix** `b8fe50f` — obvious selected state (border +
   tint + scale + glow + pulse), instructions, flow hint, visible
   column headers (Term/Translation), wrong-pair shake; 8-lang i18n;
   reduced-motion-safe.
3. **57B** `955fe17` — tier evaluation + XP-delta upgrade in both modes
   + cross-language parity golden (`tests/fixtures/badge-tier-parity/`)
   + backend (review_master 50→200→500) + Dexie (lessons_10 10→50)
   integration.
4. **57C** `d2c5107` — tier-coloured SVG generator (~10 glyphs × 4
   palettes, inline data URIs, D-127).
5. **57D** `f20757d` — BadgeGallery drawer (filter/sort/expand, locked
   visible) + `gamification.tier.*`/`gallery.*` i18n in 8 langs +
   Settings entry (F-129).
6. **57E** `dda9068` — tier-upgrade celebrations via the bus
   (silver chime / gold chord + glow, `badge_tier_upgrade` event,
   reduced-motion-safe).
7. **57F** `21e951d` — Dashboard badge widget (recent tier mini-icons +
   next-badge pointer, opens the gallery).
8. **57G** — version bump 1.40.0 (`make sync-versions`, 19 files),
   release notes, CLAUDE.md, this journal; release gates.

## Notable

- **Prettier trap (caught + reverted):** ran `npx prettier --write` on
  the changed frontend files and it reflowed them 4-space → 2-space
  (default config). The repo has **no `.prettierrc` and prettier is not
  a pre-commit/CI gate** — its TS is 4-space. `git checkout`-reverted
  all 7 files and re-applied the edits by hand in 4-space. Lesson:
  do NOT run prettier in this repo; ruff (Python) IS enforced, prettier
  is not. The 57A commit succeeding (pre-commit ran) confirmed prettier
  isn't hooked.
- **EN-passthrough audit (pt):** the Portuguese gallery `locked_hint`
  "Continue aprendendo…" tripped the `continue` marker — rephrased to
  "Siga aprendendo…".
- **Streak key suffix:** the streak badge keys are `streak_7_days`
  (etc.), not `streak_7`; the migration backfill map was corrected
  before landing.

## Baseline after Phase 57

- Backend 1025 + plugins 950 + Vitest 2346 = **4321** (+1 skipped).
  Dexie-smoke 19 green. Build + tsc + ruff + mypy clean.

## Deferred / next

- **Word Tiles drag-to-reorder** bugfix (user: "current phase or next";
  sequenced AFTER v1.40.0). A dnd + keyboard-a11y feature — its own
  commit next.
