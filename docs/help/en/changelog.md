# What's new (v1.61 – v2.15)

A user-oriented overview of the releases since v1.61.0. The full,
technical notes per version are under
[GitHub Releases](https://github.com/astrapi69/adaptive-learner/releases).

---

## v2.15.0 - Deeper exercises, compact lesson summary

- **Parametric exercises**: a lesson can declare variables whose values are
  drawn fresh for every attempt; numeric answers are graded within a
  tolerance.
- **Three new exercise types**: Hotspot, Parsons and Ordering, all authorable
  in the lesson creator.
- **Explanations after an answer**; when you create a lesson from text, the
  AI can write them for you.
- **Compact lesson summary** (result and XP) unless you have customised the
  summary sections; **Detailed evaluation** opens the full review.
- **Settings reorganised**: labelled sections with a section bar on the
  Learning and Data tabs; the desktop app lists its installed plugins.
- **Refresh** in My content applies every available set update at once,
  except those that would affect your progress; the Content hub has its own
  Create tab.
- Legal notice and privacy policy in German and English; phone fixes for the
  iOS keyboard, crowded headers and the hub tab bars.

## v2.14.0 - Game mode and arcade

- **Optional game mode**: combo streaks, flying points, checkpoints, answer
  physics, hearts and countdown, and its own sound set.
- **Arcade minigames** unlocked with XP (Lern-Memory, Snake, TicTacToe,
  Simon) plus flash rounds at set completion.
- Mascot colour variants; avatar presets and frames tied to level and badge
  unlocks.
- **Set pages** list their lessons with progress, leaving a lesson returns to
  its set, and a set-completion review collects every mistake of the set.
- Settings gain a **Diagnostics & Support** tab.
- Three new extension types from the creation wizard: speak and record,
  audio choice, audio tiles.

## v2.13.0 - Convert exercise types

- **Change an exercise's type in place** in the lesson editor; review history
  is carried over where the content survives, and the AI fills fields a
  conversion leaves empty.
- **Edit as a copy** directly on a downloaded set; your copy is marked as
  your own edit, and re-importing a set keeps the review history of unchanged
  exercises.
- The end-of-lesson correction round records your answers again, and
  read-aloud keeps the screen awake.

## v2.12.0 - Start a set over

- Start a finished set over as a **fresh run** while your spaced-repetition
  history continues.
- Import provider keys from a Topos `.alk` export; **Perplexity** joins the
  AI providers.

## v2.11.0 - Stable progress

- Learning progress is anchored to **stable exercise identities**. A one-time
  local migration on the first start re-keys existing progress, so content
  corrections no longer orphan your review cards.
- Matching exercises redesigned: help sits in the button row, the progress
  counter at the top.

## v2.10.0 - Security: local-only by default

- **Update recommended.** The desktop launcher and the compose file now bind
  the app to `127.0.0.1`. Before, anyone on the same network could open it
  without authentication, including stored AI keys.
- To reach the app from another device on purpose, set
  `ADAPTIVE_LEARNER_BIND_ADDRESS=0.0.0.0` in `.env`, and only in a network you
  trust.

## v2.9.0 - The launcher closes again

- The downloaded launcher quits when you close its window, also on desktops
  without a system tray (for example Ubuntu GNOME). The app keeps running in
  Docker.
- The lesson order you set now drives the learning sequence, and editing
  belongs to the individual lesson.

## v2.7.0–v2.8.2 - Launcher uses a published image

- The desktop launcher **pulls a published, verified image** instead of
  building on your machine (v2.7.0 was tagged but its changes first reached
  users with v2.8.0).
- A recovery notice helps users whose review progress for the corrected
  Japanese, Korean and Chinese A1 lessons was orphaned; it offers a backup
  first and never runs automatically.
- **Security patch v2.8.1/v2.8.2 (update recommended)**: the v2.8.0 image
  showed a white page in image mode, and the bare container no longer starts
  in debug mode.

## v2.6.0–v2.6.1 - New session chat, lessons from books

- The **session chat** is rebuilt on assistant-ui.
- **Create lessons from a book**: upload EPUB, TXT, MD or DOCX, pick the
  chapters, and generate a lesson per selected section.
- The dictation editor accepts audio file uploads; content sets can be hidden
  through their manifest.
- Launcher: context-aware Docker detection and a translated launcher UI.

## v2.5.0 - Full exercise authoring

- Every core exercise type is **editable in the lesson creator**, exercises
  can be added by hand, and multiple choice is authorable with a single or
  multiple answer mode.
- An **extension-authoring wizard** covers categorization, error correction,
  reading comprehension and graded quiz; **audio dictation** joins as an
  extension type.

## v2.4.0 - Authoring upgrade

- Build a knowledge lesson from **pasted textbook text**, edit an existing own
  lesson, combine own lessons into a set, and upload card images.
- Free-text exercises accept **multiple answers** and offer an **AI second
  opinion** on a wrong answer.
- The AI settings tab links straight to key import.

## v2.3.0 - Lesson player rework

- Collapsible options panel, pause control in the footer and a slimmer title
  area.
- **Listen-first audio exercises**.
- More robust lesson and set file import and export.

## v2.2.0 - Extension exercises

- Four **AI-authored extension exercise types** plus native multiple choice.
- A federated **content-repository registry** with a register-a-repo flow.
- Simpler mobile navigation without the bottom tab bar.

## v2.1.0 - Polish after the launch

- Removing a content repository **no longer leaves ghost progress** on the
  Dashboard, in the review queue or in paused lessons.
- Settings reorganised, Learning Path fixes, a discoverable **Ask AI** button
  and more robust content sync.

## v2.0.0 - Public launch

- The first version for a general audience: free and open source (MIT),
  offline-first, no account, spaced repetition, bring your own AI key,
  author and share your own lessons, installs as a PWA.
- A launch milestone, not a technical break: no breaking change against
  v1.99.0.

## v1.99.0 - Mobile hardening

- **Multiple choice as tappable answer buttons**, which fixes tap misfires on
  iPhone.
- Device fixes: iOS focus zoom, the iPhone delete menu and a remembered UI
  language.
- Content-language filter in Discover, multi-select in My content, opt-in
  auto-advance and inline worked examples.

## v1.97.0–v1.98.0 - Content hub redesign

- **My content** shows only downloaded content; import and creation moved to
  the Import tab; list or grid view and a compact search and filter bar.
- Collapsible desktop sidebar and per-set status (active, deferred,
  completed) with delete.
- Vertical desktop navigation and deep links to a single set; cloze
  "select all that apply"; exam answers lengthen review intervals;
  passphrase-encrypted `.alk` export of AI keys.
- Spanish and French translations reviewed.

## v1.95.0–v1.96.0 - Lesson modes

- Play a lesson or set as **Practice, Exam, Timed or Shuffle**, plus
  "train mistakes"; exam mode with delayed feedback, a result view, pass or
  fail and an XP bonus.
- **Reverse and Endless** modes, invitation codes for sharing content and
  moving data from the online to a local install.
- Export a set to a GitHub repository.

## v1.92.0–v1.94.1 - Offline and launcher hardening

- The installed PWA runs in **browser-storage mode** as intended, with fixes
  for the study guide, pronunciation and identity.
- **Desktop launcher**: Docker-first flow with visible progress, configurable
  ports and a single persistent window; the Windows launcher builds again.
- AI content-check dialogs scroll on desktop and show which provider and
  model ran the check.

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
