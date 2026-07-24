# What's new (v1.61 – v1.91)

A user-oriented overview of the releases since v1.61.0. The full,
technical notes per version are under
[GitHub Releases](https://github.com/astrapi69/adaptive-learner/releases).

---

## v1.91.0 - Navigation restructuring

- **Primary nav cut from 12+ entries to 7 grouped entries**
  (Dashboard, Lernpfad, Meine Inhalte, Entdecken, Fortschritt,
  Settings, Help) with no loss of function - every page stays
  reachable ([Navigation](user-guide/navigation.md)).
- **Mobile bottom tab bar** (Lernen / Inhalte / Entdecken /
  Fortschritt / Mehr) with a "More" bottom sheet.
- **ProgressHub** (`/progress`) groups Overview / Statistics /
  My paths into tabs; **DiscoverHub** (`/discover`) gains an
  Import tab. Old links keep working via redirects.
- PWA update banner no longer reappears after you accept an update.

## v1.90.0 - AI exercise generation + auto-update

- **AI Exercise Generation pipeline**: generate exercises for a
  theory-only lesson, with a quality gate, type balancing,
  regenerate-with-feedback, and whole-set batch generation
  ([AI exercise generation](features/ai-exercise-generation.md)).
- **Animated pair resolution** in the Matching exercise.
- **Per-provider Test button** in the configured-providers
  overview ([Settings](user-guide/settings.md)).
- **Desktop auto-update checker** via the GitHub Releases API.
- AI session replies now come back in your UI language.

## v1.87.0–v1.88.0 - Content discovery + QR sharing

- **Content discovery (`/discover`)**: a search index over the
  library; per-set download moved here, separate from your local
  "My content" ([Discover](features/discover.md)).
- **QR-code app sharing**: share the app via a scannable QR code
  (copy / download PNG / native share).
- **Curriculum Builder** + daily learning reminders.
- **Korean + Indonesian UI** join the language set (now 11).

## v1.86.0–v1.87.0 - AI content validation + `.alb` backup

- **AI content validation**: set-wide quality checks with a
  report UI, cached report + Markdown export, and an "AI-Checked"
  badge ([AI content check](user-guide/ai-validation.md)).
- **Media integration**: a "Deepen the topic" lesson section.
- **`.alb` ZIP backup format** replaces the single JSON dump and
  now carries a localStorage snapshot too
  ([Backup and restore](features/backup.md)).

## v1.70.0–v1.84.0 - UX, theming, and TipTap 3

- **First-run restore**: an empty install offers "Restore from
  backup" during onboarding.
- **Documentation overhaul** + context-sensitive in-app help.
- **TipTap editor migrated v2 → v3** (whole `@tiptap/*` stack).
- **Feature-strategy gating**: AI features flip between
  active / disabled / hidden without a reload.
- Extensive dark-theme contrast + mobile-layout hardening.

## v1.69.0 - Example links + book recommendations

- **Example links in theory:** A theory step can carry an optional
  "View example" link.
- **Book recommendations per domain** in the Content Browser
  ([Book recommendations](content-creation/books.md)).
- **Enter shortcut also in Error Replay** ("Repeat mistakes").
- **Backup fix:** the set title is now read correctly from the
  manifest on restore.

## v1.68.0 - Result export + theory back-links

- **Export lesson result:** "Copy result" / "Save as file"
  (Markdown report for AI assistants).
- **Theory back-links:** jump from an exercise to the matching
  theory and back.
- **Matching exercise overhauled:** colored pairs + number badges
  (colorblind-safe).
- **Dark-mode contrast** fixed in several places.

## v1.67.1 - Backup restore + deploy stability

- Systematic **backup restore** fix.
- Auto-reload on a stale deploy chunk.
- Subject filter polish (hidden at ≤ 1 subject, most-used first).

## v1.65.0 - Resumable assessment + Enter shortcut

- **Resumable assessment:** abandon the test and continue later
  where you left off.
- **Enter shortcut:** Enter checks an answered exercise and
  advances (toggleable in Settings → Learning).
- Clearer matching exercises + a design-token pass.

## v1.64.0 - Onboarding overhaul

- **Quick start with only name + topic**; the rest take defaults.
- Optional **onboarding wizard** (one question per screen).
- The **assessment is now optional** ([Onboarding](user-guide/onboarding.md)).

## v1.63.0 - WCAG AA theme presets

- **6 recommended themes** (Catppuccin Latte/Mocha, Supabase,
  Graphite, Soft Pop, Amethyst Haze), computationally AA-compliant
  ([Theme system](developer/themes.md)).
- Systematic i18n audit; user-scoped Dashboard filter.

## v1.62.0 - Backup integrity + build provenance

- Hardening of the **backup restore** (data-type coercion, FK
  order).
- About shows real build info instead of "unknown".

## v1.61.0 - Button conformance + lesson resume

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
- [GitHub Releases](https://github.com/astrapi69/adaptive-learner/releases) - full notes
