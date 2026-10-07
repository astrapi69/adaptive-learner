# App Flow

Every screen of Adaptive Learner, how a learner reaches it, and the main
journeys through the app, **as built**. Paths in this document are
relative to `frontend/src/` unless they start with another top-level
directory. The router is the single source: when a route changes, this
document changes in the same PR.

Companion document: [DESIGN-BRIEF.md](DESIGN-BRIEF.md) (audience,
principles, visual system).

## Shell

- All routes are declared in one flat `<Routes>` block in
  `frontend/src/App.tsx`, inside a `BrowserRouter` whose basename is the
  build's base URL (`frontend/src/main.tsx`). There is no nested layout
  route and no route-level guard; each page checks its own preconditions.
- Pages are lazy-loaded; only the landing page is eager. A route error is
  caught per pathname and shows a reload fallback.
- Around the routes the app always renders: the skip link, a localized
  document title per route, the top navigation, the offline indicator,
  the optional bottom tab bar, install prompts, the milestone overlay,
  the help drawer, global keyboard shortcuts, the error-report dialog and
  the toast container.
- The top navigation and the bottom tab bar are hidden on exactly three
  routes: `/`, `/onboarding` and `/assessment`. During any lesson-like
  route (`/lesson/`, `/review/`, `/adaptive-lesson/`, `/shuffle-lesson/`,
  `/endless-lesson/`, `/error-replay/`) the top navigation switches to a
  compact drawer that hides on scroll, and the bottom tab bar is hidden
  (`frontend/src/hooks/lesson/session/useIsLessonActive.ts`).

## Route table

"Precondition" is the page's own check; a page without one renders for
any visitor.

| Route | Page | Parameters | Precondition |
|---|---|---|---|
| `/` | Landing | | A known learner is sent to `/dashboard` |
| `/onboarding` | Onboarding | | None (a direct visit creates a new learner) |
| `/assessment` | Assessment | router state `backTo` | No project: `/onboarding` |
| `/dashboard` | Dashboard | `?tab=overview\|activity\|missions` | No project: `/onboarding` |
| `/session` | AI learning session | `?session=<id>`, `?method=` | No project: `/onboarding`; needs an AI key in browser mode |
| `/progress` | Progress hub | `?tab=overview\|stats\|paths` | Per tab: project or learner |
| `/content` | Content hub | `?tab=discover\|my\|import\|create` | Import tab needs a learner |
| `/content/set/:setId` | Set page | | |
| `/set-summary/:setId` | Set completion review | | |
| `/content/import/:conversationId` | Imported conversation | | |
| `/anki` | Anki flashcards | | No learner: `/onboarding`; AI key in browser mode |
| `/arcade` | Arcade | | Soft gate: game mode and arcade switch, else a notice |
| `/add-repo` | Add a content repository | `?url=`, `?branch=`, `?set=` | |
| `/invite` | Redeem an invitation code | `?code=`, `?repo=`, `?branch=` | |
| `/learning-path` | Learning path | | |
| `/create-lesson/edit/:source/:setId` | Edit an own set | `?lesson=` | |
| `/lesson/:setSlug/:setId/:filename` | Lesson | `#lesson-resources` | None; without a learner a notice explains that progress is not saved |
| `/review/:setId` | Review (spaced repetition) | `?quick=1`, `?from=` | |
| `/adaptive-lesson/:setId` | Adaptive lesson | `?lesson=` | |
| `/shuffle-lesson/:setId` | Shuffle round | `?len=10\|20\|30\|50` | |
| `/endless-lesson/:setId` | Endless round | | |
| `/error-replay/:setSlug/:setId/:filename` | Retry errors | router state (exercises, cards, lesson title, first pass) | Reachable only from the app, never by URL alone |
| `/projects/:projectId/learning-repo` | Learning repository | | |
| `/pronunciation` | Pronunciation | | No learner or project: `/onboarding`; AI key in browser mode |
| `/settings` | Settings | `?tab=`, `&section=` | No learner: `/onboarding` |
| `*` | Not found | | |

`:setSlug` is the content source with `/` replaced by `--`.

### Aliases kept for bookmarks and old links

| Route | Goes to |
|---|---|
| `/curriculum` | `/progress?tab=paths` |
| `/statistics` | `/progress?tab=stats` |
| `/import` | `/content?tab=import` |
| `/discover` | `/content?tab=discover` |
| `/create-lesson` | `/content?tab=create` |
| `/contribute` | `/content` |
| `/import/:conversationId` | same page as `/content/import/:conversationId` |

## Navigation

One target list, `frontend/src/components/nav/nav-targets.ts`, feeds
every navigation surface.

| Group | Entries |
|---|---|
| Learn | Dashboard (`/dashboard`), Learning path (`/learning-path`), Session (`/session`) |
| Content | Content (`/content`) |
| Progress | Progress (`/progress`) |
| Utility | Settings (`/settings`), Help (opens the help drawer for the current route) |

- **Top bar** (`frontend/src/components/nav/Navigation.tsx`): brand link
  to the dashboard, a mode badge ("AI+Content" or "Content") linking to
  content, the grouped entries, Help, then a status cluster: overdue
  reviews (only when something is overdue), content updates (only when
  there are any), XP, avatar (to `/settings?tab=general`) and the theme
  toggle. Below 1280px wide, on short landscape screens and during a
  lesson the entries move into a hamburger drawer.
- **Bottom tab bar** (`frontend/src/components/nav/BottomTabBar.tsx`):
  off by default, enabled in Settings > General > Interface. On phones it
  shows Learn, Content, Learning path, Progress and "More" (Settings,
  Help).
- **Keyboard** (`frontend/src/components/a11y/GlobalShortcuts.tsx`): `?`
  shortcut overview, Ctrl/Cmd+`,` settings, Alt+D dashboard, Alt+S
  settings, Alt+C my content, Alt+P progress. On a lesson summary, Enter
  activates the primary next step.
- **Deep links**: the tab query parameters in the route table, plus
  `section` in Settings (Learning: `basics`, `lessons`, `voice`, `review`,
  `motivation`; Data: `sources`, `sync`, `offline`, `backup`, `cleanup`,
  `danger`). Changing a tab drops the section.

## First start

1. **Landing (`/`)** first checks for an existing learner ("Welcome
   back..."): a stored learner id, or the most recent learner in storage.
   A match goes straight to the dashboard (browser mode also confirms
   "Your learning data is still here."); otherwise, or after a timeout,
   the landing page shows logo, title, introduction, a language choice,
   the single call to action "Start your learning journey" and links to
   the documentation, legal notice and privacy policy.
2. **Onboarding (`/onboarding`)** has three phases:
   - *Form*: name and topic. Submitting creates the learner and a project
     with defaults.
   - *Invite*: "Jump right in" goes to the dashboard; "Set up profile"
     opens the wizard.
   - *Wizard*: five steps, ending at the assessment or the dashboard.
   - On an empty install it also offers to restore a backup file, and in
     API mode to bring data over from the browser version (once per
     device).
3. **Assessment (`/assessment`)**: one question at a time with swipe and
   keyboard navigation and saved progress; the result shows the method
   profile, then continues to the dashboard. It can be resumed later from
   the dashboard's Activity tab.

Content, lesson, learning-path, arcade, add-repo and invite pages work
without onboarding: a visitor can play lessons, and the lesson explains
that progress is not saved and links to onboarding.

## Journey: from a content set to the lesson summary

1. **Find content.** `/content` opens on the first tab of the learner's
   tab order (Discover by default). Discover searches and filters sets
   and downloads them; My content lists downloaded and own sets.
2. **Open a set.** A set row opens its first lesson; the set title opens
   the set page `/content/set/:setId` with the lesson list, a "continue
   here" marker, a flash-round card (game mode) and "Start learning",
   which goes to the current unfinished lesson.
3. **Play the lesson** (`frontend/src/pages/lesson/Lesson.tsx`). Mode is
   practice, exam or timed, chosen before the run starts. Each step is
   theory or an exercise (renderers in
   `frontend/src/components/exercises/renderers/`). The footer offers
   Previous, Check, Next and Finish; exam mode only moves forward. Exit
   asks whether to pause or abandon and returns to the set page.
4. **Summary.** After the last step the lesson summary appears.
   - The **compact view** (default) shows the result and XP, a "Fix
     mistakes (n)" button while mistakes of this run are open, and the
     always-present actions: Mark as complete, Next lesson, Practice
     again, Back to content browser.
   - The **detailed view** ("Detailed evaluation") shows every section:
     answers overview, explanations ("Why you missed these"), export,
     sharing, the correction section and next-step suggestions, with
     each mistake marked corrected or still open. Which sections the
     compact view shows is configurable in Settings > Learning.
5. **Correct mistakes.** "Fix mistakes" opens the correction round inside
   the summary. Exercises that cannot be drilled inline are replayed
   through **Retry errors** (`/error-replay/...`), which replays only the
   failed exercises and writes no lesson progress. After the correction
   round and at the end of Retry errors a correction summary lists what
   was corrected and what is still open.
6. **Next steps.** Cards for the next lesson, an adaptive lesson from the
   learner's errors, a review session, and, after the last lesson of a
   set, the set completion review (`/set-summary/:setId`).

## Journey: review and other practice modes

| Mode | Route | Reached from | Saves lesson progress |
|---|---|---|---|
| Review (spaced repetition) | `/review/:setId` | overdue badge in the nav, dashboard review queue (full or quick 5-card round), continue-learning items, next-step card, reminders, Learning path "Retry errors" | no (updates the error history) |
| Adaptive lesson | `/adaptive-lesson/:setId` | dashboard focus areas, Learning path "Train errors", next-step card | no |
| Shuffle | `/shuffle-lesson/:setId` | Learning path set detail | no |
| Endless | `/endless-lesson/:setId` | Learning path set detail | no |
| Flash round | `/error-replay/...` | set page, game mode only | no |
| Arcade | `/arcade` | dashboard card and summary ticket reward, game mode only | no XP awarded |

All of these run on the shared lesson runner with a mode policy
(`frontend/src/components/lesson/runner/policies.ts`) and end with their own
summary.

## Journey: content import, creation and sharing

- **Import** (`/content?tab=import`): paste or upload an AI chat export,
  then on the conversation page analyze it, create a curriculum (it opens
  under My paths, `/progress?tab=paths&curriculum=<id>`), start an AI
  session or extract flashcards (`/anki`). The tab also redeems
  invitation codes (`/invite`) and lists own lessons with play, edit,
  export, share and delete.
- **Create** (`/content?tab=create`): a four-step wizard (metadata,
  cards, exercise generator, save and share; "Save & share" opens My
  content with the share wizard, `/content?share=<id>`). Own sets are
  edited at `/create-lesson/edit/:source/:setId`.
- **Content repositories** (Settings > Data > Sources): the official
  repository plus user repositories with sync, removal, order, invite
  codes and a QR scan that fills the add form. A share link or QR code
  opens `/add-repo`, which connects the repository and opens the shared
  set.
- **Share**: a set's share button shows a QR code with its `/add-repo`
  link; the share wizard (placement, duplicate scan, quality, pull
  request) contributes a set to a repository; "Share as repository"
  pushes to the learner's own GitHub repository (browser mode only).

## Journey: settings, backup and AI key

- **Settings tabs** (`frontend/src/pages/system/Settings.tsx`), grouped
  in one model rendered as a sidebar on desktop and a drawer on phones
  (`frontend/src/lib/settings/sidebar-model.ts`): General, AI, Learning,
  Plugins, Data, Integrations, Help, Diagnostics, About. An unknown tab
  opens General.
- **Backup** (Settings > Data > Backup): "Create backup" downloads an
  `.alb` file; restore shows the current and incoming data side by side
  before merging; a reminder appears seven days after the last backup.
  Browser mode adds automatic backups. AI keys are exported and imported
  separately, encrypted, in the key vault section.
- **AI key**: without a usable key the dashboard shows an invitation card
  and AI features show a notice, both linking to `/settings?tab=ai`.

## Dashboard, progress and help

- **Dashboard tabs**: Overview (continue learning, AI invitation, review
  queue, XP and level, streak, arcade, paused lessons, focus areas,
  favourites), Activity (review queue, activity trend and streak
  calendar, method profile or assessment prompt, sessions, timeline,
  method distribution, recommendations, learning repository), Missions
  (daily missions, badges). A footer offers quick start, pronunciation
  (when the project fits), create a lesson and learning path.
- **Progress** (`/progress`): Overview (timeline, method distribution,
  step insights, history), Statistics (tiles, heatmap, weak areas), Paths
  (curricula).
- **Learning path** (`/learning-path`): personal path with per-set
  actions, own paths, and a map view.
- **Help** is a slide-over drawer, never a route: the Help entry opens
  the entry for the current route, inline help links open specific
  entries, and Settings > Help lists them all.

## API mode and browser mode

The storage mode is set at build time (`VITE_STORAGE_MODE=dexie` forces
browser mode) or chosen in Settings > General where the build allows it
(`frontend/src/storage/index.ts`). Features are never hidden; a feature
that a mode cannot offer is shown disabled with its reason
(`frontend/src/features/featureConfig.ts`).

| | API mode (server, desktop) | Browser mode (GitHub Pages, PWA) |
|---|---|---|
| AI features (session, analysis, flashcards, pronunciation, study guide) | available | need the learner's own AI key |
| Sync, git persistence, plugin management | available | disabled: "Only available with the desktop app." |
| Share as repository, registry pull request | disabled | available |
| Identity section, migration from the browser version, desktop updates | shown | not shown |
| Automatic backups, app update banner, AI content check, port-change hint | not shown | shown |

## Observations

Found while mapping the flows; recorded here so they are not lost, and
proposed separately rather than changed by this document.

- "Retry errors" means the error-replay round on the lesson summary but
  opens the review session in the learning path's set detail.
- The onboarding form's button says it starts the assessment; it opens
  the invite step first.
- Some pages are reachable only from deep inside the app (for example
  `/set-summary/:setId` only from a next-step card that the compact
  summary does not show).
- Several feature ids are registered without any consumer, and two
  surfaces ship permanently disabled (the learning-path graph view and
  the dashboard project filter).
