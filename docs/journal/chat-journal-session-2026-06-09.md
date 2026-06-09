# Chat journal — 2026-06-09

Two releases shipped today from a long, multi-sprint session:
**v1.68.0** (manual-test bug batch + lesson-result export + theory
back-links) and **v1.69.0** (theory example links + book
recommendations + Error-Replay Enter shortcut + a backup-restore title
fix). This entry is the post-release record for both, newest first.

---

## v1.69.0 release

### Summary

Closed two manual-test bugs (#134 backup-restore title, #154
Error-Replay Enter shortcut), folded in Sprint 2 (#153, merged by an
earlier session), fixed a pre-existing content-stats drift, and cut the
release.

### What shipped

- **#134 — restored content sets keep their title + step progress
  (recurrence).** The v1.67.1 fix synthesised a one-set manifest with
  the title at `name:` (root) and `sets[].title` (nested), but the
  Dexie restore (`buildContentSetRow`) read it with a root-level-only
  `/^title:/m` regex — so it never matched and fell back to the raw
  `set_id` (`analysis-<uuid>`), collapsing step progress. Restore now
  parses the manifest with the real YAML parser and recovers the title
  plus the other set fields (languages / level / domain / description /
  lesson_count), preferring the carried Dexie `meta` when present.
  Verified by a **real export→import round-trip** through the actual
  `createDexieBackup`/`restoreDexieBackup` against `fake-indexeddb`. The
  manual browser-UI round-trip (the formal BACKUP-AKZEPTANZTEST gate)
  was deferred to the maintainer post-merge by explicit decision.
- **#154 — Enter-key shortcut in the Error-Replay runner.** "Fehler
  wiederholen" lacked the Enter shortcut the main lesson runner has.
  Extracted the keydown listener into a shared `useLessonEnterKey` hook
  (the pure `decideLessonEnterAction` was already shared), wired it into
  `ErrorReplayLesson`, and refactored `Lesson.tsx` to use the same hook
  so the two runners can't drift. Integration-tested.
- **#153 (Sprint 2, merged earlier) — theory example links (#139) +
  per-domain book recommendations (#141).** A theory step can carry an
  optional `example_url` (+ `example_label`) rendered as a "View
  example" button (content schema 1.3 → 1.4, additive; validators reject
  non-`http(s)`). A maintainer-curated `books.yaml` at the content repo
  root maps a domain to recommended books, shown in the Content Browser
  (both storage modes, no backend).
- **Content-stats drift fixed in the release commit.** The content repo
  had grown 330 → 331 lessons; the README CONTENT-STATS block was stale
  and failing CI on main. Regenerated via
  `validate_bundled_content.py --write-readme`.

### Notable

- **Stacked-PR + squash hazard.** Batch 2 (v1.68.0) was stacked on the
  Sprint-1 branch; deleting the Sprint-1 branch on merge auto-**closed**
  the stacked PR (#151). Recovered by cherry-picking the batch commits
  onto fresh main and opening #152. Lesson: don't `--delete-branch` a
  base branch that still has open stacked PRs against it.
- **GitHub GraphQL hourly limit exhausted** mid-session (heavy `gh`
  use). All issue / PR / merge / release operations switched to the REST
  API (separate 5,000/hr budget): `gh api` for issue create/reopen,
  `pulls`, `pulls/{n}/merge`, and `releases`. Both PRs squash-merged via
  REST; the owner bypassed the (then-failing, now-fixed) content-stats
  check.

### Commits / artefacts

- Release: `e899e0aa chore(release): v1.69.0`; tag `v1.69.0`; GitHub
  Release published.
- Fixes: `987ef9eb` (#154 / #155), `1e616b36` (#134 / #156).

---

## v1.68.0 release (earlier same day)

### Summary

A manual-test bug batch plus two lesson features, across two sprints.

### What shipped

- **#138 — export lesson results.** "Copy result" + "Save as file" on
  the lesson summary build a Markdown report (score, per-exercise
  mistakes with the learner's answer + correct answer, weak areas) for
  pasting into an AI assistant. Pure builder, both storage modes.
- **#140 — re-read theory from an exercise.** A subtle link jumps to
  the nearest preceding theory step; the theory step offers "Back to
  exercise". Runtime-derived; rendered once around the exercise
  dispatcher so all five renderers inherit it.
- **#143 — search icon to the right + uniform matching/word-tile card
  heights.**
- **#145 — matched pairs visually connected.** Both tiles of a pair
  share a distinct color (per-theme `--chart-*` palette, cycled) + a
  matching number badge — colour-blind-safe (not colour alone).
- **#146 / #148 — dark-mode contrast fixes.** `<Button asChild>` +
  router `<Link>` anchors kept their variant text colour (the unlayered
  `a { color: var(--accent) }` was overriding the layered utility →
  accent-on-accent); outline/ghost buttons set an explicit
  `text-foreground` (preflight is off, so colourless buttons fell back
  to UA black on dark surfaces).
- **#147 — read-aloud no longer reflows the theory panel.** It used to
  swap the rendered Markdown for a plain-text follow-along; now it just
  plays audio.
- **#149 — matching adapts to the lesson domain.** Knowledge lessons
  (non-language, or source==target) use neutral Term/Definition labels,
  drop the language names, and a non-translation instruction.
- **About → Credits** now names Claude (Anthropic) for AI assistance
  (architecture, code, content, documentation).

### Notable

- **Prettier-reindent incident.** Running `prettier --write` on
  `Lesson.tsx` reindented the entire 4-space file to 2-space (the repo's
  prettier config is 2-space but the file was authored 4-space and
  prettier isn't enforced for the frontend), producing a spurious
  3,588-line diff. Caught it, restored the clean 4-space file, re-applied
  only the logical change by hand, and amended the commit. Lesson: don't
  `prettier --write` whole files in this frontend; hand-edit to match
  surrounding style.

### Commits / artefacts

- Release: `3877991f chore(release): v1.68.0`; tag `v1.68.0`; GitHub
  Release published. Fixes across PRs #143, #144, #152.

---

## Day statistics

- **2 releases:** v1.68.0, v1.69.0.
- **Issues closed:** #134, #138, #140, #143, #145, #146, #147, #148,
  #149, #154 (plus #139, #141 via #153). Issues filed and deferred:
  #150 (backup restore on first login, P2).
- **Frontend test baseline at v1.69.0:** full Vitest suite green
  (3,833+ at the time of the batch run); new unit/integration tests for
  result-export, theory-link, matching pair badges, matching domain
  wording, button data-slot + variant colours, the TTS no-swap
  contract, the Error-Replay Enter shortcut, and the #134 backup
  round-trip.
- **i18n:** all new strings translated in the eight supported languages.
- **Open follow-up:** the maintainer runs the #134 manual browser-UI
  backup round-trip on `make dev` to formally close BACKUP-AKZEPTANZTEST.
