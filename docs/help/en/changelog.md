# What's new (v1.61 – v1.69)

A user-oriented overview of the releases since v1.61.0. The full,
technical notes per version are under
[GitHub Releases](https://github.com/astrapi69/adaptive-learner/releases).

---

## v1.69.0 — Example links + book recommendations

- **Example links in theory:** A theory step can carry an optional
  "View example" link.
- **Book recommendations per domain** in the Content Browser
  ([Book recommendations](content-creation/books.md)).
- **Enter shortcut also in Error Replay** ("Repeat mistakes").
- **Backup fix:** the set title is now read correctly from the
  manifest on restore.

## v1.68.0 — Result export + theory back-links

- **Export lesson result:** "Copy result" / "Save as file"
  (Markdown report for AI assistants).
- **Theory back-links:** jump from an exercise to the matching
  theory and back.
- **Matching exercise overhauled:** colored pairs + number badges
  (colorblind-safe).
- **Dark-mode contrast** fixed in several places.

## v1.67.1 — Backup restore + deploy stability

- Systematic **backup restore** fix.
- Auto-reload on a stale deploy chunk.
- Subject filter polish (hidden at ≤ 1 subject, most-used first).

## v1.65.0 — Resumable assessment + Enter shortcut

- **Resumable assessment:** abandon the test and continue later
  where you left off.
- **Enter shortcut:** Enter checks an answered exercise and
  advances (toggleable in Settings → Learning).
- Clearer matching exercises + a design-token pass.

## v1.64.0 — Onboarding overhaul

- **Quick start with only name + topic**; the rest take defaults.
- Optional **onboarding wizard** (one question per screen).
- The **assessment is now optional** ([Onboarding](user-guide/onboarding.md)).

## v1.63.0 — WCAG AA theme presets

- **6 recommended themes** (Catppuccin Latte/Mocha, Supabase,
  Graphite, Soft Pop, Amethyst Haze), computationally AA-compliant
  ([Theme system](developer/themes.md)).
- Systematic i18n audit; user-scoped Dashboard filter.

## v1.62.0 — Backup integrity + build provenance

- Hardening of the **backup restore** (data-type coercion, FK
  order).
- About shows real build info instead of "unknown".

## v1.61.0 — Button conformance + lesson resume

- App-wide shadcn button conformance.
- **Paused lessons** resume at the exact step.
- Cross-repo content validation.

---

## Larger threads in the period

- **Multiple content repositories (EXP-023):** connect your own
  repos, manage several, share via link/QR, trust levels,
  recommended repos, local ratings
  ([Multiple content repositories](features/content-repos.md)).
- **Backup as a complete snapshot** with cross-identity import
  ([Backup and restore](features/backup.md)).

---

## Related pages

- [Getting started](user-guide/getting-started.md)
- [GitHub Releases](https://github.com/astrapi69/adaptive-learner/releases) — full notes
