# Design Brief

What Adaptive Learner's interface is for, who it serves, and the design
decisions the app already embodies. This describes the app **as built**;
every statement points at the file that defines it. Where the repository
is silent or contradicts itself, the point is listed under
[Open questions](#open-questions) instead of being decided here.

Companion document: [APP-FLOW.md](APP-FLOW.md) (screens, routes and
journeys). Token mechanics: [DESIGN-TOKENS.md](../policies/DESIGN-TOKENS.md).

## Product

Adaptive Learner is a free, open-source (MIT) learning app built on a
six-method learning model: the learner takes a 12-question assessment,
the app weights six methods (deductive, inductive, error-based, dialogic,
contextual, AI-adaptive) for them, and sessions follow a seven-step cycle
(input, attempt, error, feedback, adapt, repeat, integrate). Sources:
`README.md`, `docs/reference/CONCEPT.md`, `docs/help/en/index.md`.

Positioning statements the app already makes:

- "Learn the way you actually learn." (`docs/help/en/index.md`)
- "Learning that adapts to you." (landing subtitle, `landing.subtitle` in
  `frontend/src/data/i18n/en.json`)
- Six methods instead of one approach; cognitive pacing instead of a
  conveyor belt; streaks matter but are not the point
  (`docs/help/en/index.md`).
- Local-first and private: no account, no email, no analytics, no
  telemetry in local mode; the chosen AI provider sees the messages sent
  to it (`docs/help/en/user-guide/onboarding.md`).
- Bring your own AI key (Anthropic, OpenAI, Gemini); adaptive lessons
  from the learner's own errors are rule-based and need no key
  (`docs/help/en/features/overview.md`).

## Audience

The repository names "learners" in general and, for private sharing,
coaches (`docs/help/en/features/overview.md`). In practice the shipped
surfaces serve:

- **Self-directed learners** working through bundled or downloaded
  content sets, mostly language learning (`README.md` lists the bundled
  sets).
- **Learners who already study with an AI chat** and import those
  conversations into lessons (Import pages).
- **Authors and coaches** who create lessons and share sets as
  repositories (lesson creator, content repos).

No persona or priority order is defined; see
[Open questions](#open-questions).

## The learning model the UI serves

- **Methods** have fixed identity colours that are the same in every
  theme (`frontend/src/lib/constants.ts`, `--method-*` in
  `frontend/src/styles/legacy/00-head.css`).
- **The seven-step cycle** is visible as step progress and the reason
  for each step (session components under
  `frontend/src/components/session/`).
- **Spaced repetition** drives a review queue; mistakes become review
  items, and the lesson summary offers to correct them.
- **Gamification is optional support, not the goal.** XP, levels,
  badges, streaks and daily missions exist, but missions state that the
  app works the same without them, game mode is off by default
  (`frontend/src/lib/learning/playful/playfulModePref.ts`), and
  celebration intensity is presentation only, never changing the
  algorithms (`frontend/src/lib/feedback/feedbackPref.ts`).

## Design principles

These are the principles the code already enforces or consistently
applies.

1. **Calm by default, louder on request.** Celebrations have three
   intensities (subtle, normal, enthusiastic), sound is off by default,
   and reduced motion forces the subtle level
   (`frontend/src/lib/feedback/feedbackPref.ts`,
   `frontend/src/hooks/settings/useFeedbackIntensity.ts`).
2. **One phone screen for the moment that matters.** The default lesson
   summary shows only result and XP so the continue actions stay above
   the fold on a phone; everything else is behind "Detailed evaluation"
   or a settings toggle (`frontend/src/lib/learning/summarySectionsPref.ts`).
   Completion navigation is always rendered, so a summary is never a
   dead end.
3. **Nothing the user owns is hidden.** A feature is either active or
   disabled with a localized reason; a disabled section keeps its header
   and shows a notice card, a disabled button carries the reason as its
   tooltip (`.claude/rules/architecture.md`, "SYNC-UI-GATE";
   `frontend/src/features/featureConfig.ts`). Settings that change
   behaviour must be visible and editable.
4. **Themeable everywhere, hardcoded nowhere.** Every colour, shadow,
   radius and spacing value is a token; components never carry colour
   literals, enforced by tests (`docs/policies/DESIGN-TOKENS.md`,
   `.claude/rules/design-tokens.md`).
5. **Touch first in controls.** Every button size variant is at least
   44px high (`frontend/src/components/ui/button.tsx`), on every
   viewport.
6. **Same app, two storage modes.** Every feature works in API mode and
   in the browser (Dexie) mode, or degrades with a friendly notice; a
   raw HTTP error never reaches a visitor
   (`.claude/rules/lessons/content-storage.md`).
7. **Errors say what happened and what to do.** "Your AI provider
   rejected the key. Check the key in Settings > AI." rather than
   "Something went wrong"; server errors offer a "Report issue" link
   (`.claude/rules/code-hygiene.md`).

## Visual system

- **Tokens.** Per-theme semantic tokens (backgrounds, text, borders,
  accent, status, exercise feedback, charts, shadows) plus theme-agnostic
  tokens for spacing, radii, fonts and fixed palettes
  (`docs/policies/DESIGN-TOKENS.md`,
  `frontend/src/styles/legacy/00-head.css`). Spacing runs on a
  `--space-*` scale, radii on `--radius-sm` / `-md` / `-lg`.
- **Themes.** One CSS file per theme in `frontend/src/styles/themes/`,
  registered in `frontend/src/lib/theme/themes.ts`, grouped as
  "recommended" (shadcn presets, WCAG AA verified) and "classic". The
  default is `soft-pop`, a dark theme; "auto" follows the operating
  system. All themes define the same token set.
- **Tailwind and shadcn/ui.** New UI uses Tailwind v4 utilities mapped
  onto the tokens through `@theme inline` in
  `frontend/src/styles/tailwind.css` (Preflight deliberately not
  imported). Primitives come from shadcn/ui ("new-york" style,
  `frontend/components.json`) under `frontend/src/components/ui/`, on
  Radix. Legacy CSS is migrated when a component is touched, never in a
  big-bang rewrite.
- **Icons.** Lucide only.
- **Typography.** The system font stack (`--font-sans`, `--font-mono`),
  with script-specific stacks for Hangul and Devanagari
  (`frontend/src/styles/fonts-hangul.css`,
  `frontend/src/styles/fonts-devanagari.css`) and no web-font CDN. There
  is no type-scale token set; sizes are set per component.
- **Matching pairs** use a palette without red, orange or green, and are
  never distinguished by colour alone (a number badge repeats the
  pairing) (`frontend/src/styles/legacy/00-head.css`).

## Layout and responsiveness

- The app shell is a full-height viewport with `#root` as the single
  scroll container (`frontend/src/styles/legacy/01-base.css`).
- Navigation collapses into a drawer below 1280px wide and on short
  landscape screens (`frontend/src/components/nav/Navigation.tsx`); an
  optional bottom tab bar exists for phones, off by default
  (`frontend/src/components/nav/BottomTabBar.tsx`).
- Visual tests cover desktop 1920x1080, laptop 1024x768, tablet
  768x1024 and phone 375x667 (`e2e/visual/helpers.ts`).
- Installed as a PWA the app runs `standalone`; fullscreen was rejected
  as too aggressive for a learning app
  (`frontend/src/pwa/pwa-manifest.ts`).

## Accessibility commitments

- **Contrast:** WCAG 2.1 AA for every theme, asserted by
  `frontend/src/styles/contrast.test.ts` (text at least 4.5:1, UI and
  exercise feedback at least 3:1); a high-contrast theme and
  `forced-colors` handling exist.
- **Keyboard:** skip link to `#main`, a visible focus ring on every
  interactive element, global shortcuts (`?` for help, Ctrl/Cmd+, for
  settings) with a shortcut help dialog
  (`frontend/src/components/a11y/`).
- **Screen readers:** a localized document title per route, live regions
  for status and alerts, `aria-current` on the active navigation entry.
- **Motion:** a global reduced-motion catch-all
  (`frontend/src/styles/legacy/39-motion-catchall.css`) plus
  per-feature handling of animations and confetti.

## Voice and tone

- Second person, plain and friendly; German uses "du".
- Encouraging without pressure: "No worries - nothing is lost, everything
  you solved stays saved." Celebration copy uses exclamation marks
  sparingly ("Perfect score!", "Level up!").
- Errors name the cause and the fix; generic failure messages are
  forbidden (`.claude/rules/code-hygiene.md`).
- No hard time promises for work that scales with input
  (`.claude/rules/lessons/docs-i18n.md`).
- No em dash, no emoji, real UTF-8 characters in every language
  (`.claude/rules/text-formatting.md`).
- Help pages describe current behaviour without version provenance.

## Constraints and rejected options

- MUI (too opinionated) and Ant Design (too heavy) were rejected
  (`.claude/rules/architecture.md`).
- No colour literals in components, no fixed-palette Tailwind classes;
  theme files may not add or drop tokens.
- No new hand-written rules in `global.css`; new UI uses utilities.
- Global state, if ever needed, is Zustand, not Redux.

## Open questions

Points the repository leaves open or contradicts. Each needs an owner
decision before it can become a principle.

1. **Brand colour.** The PWA manifest uses teal `#0d9488` ("teal brand
   mark", `frontend/src/pwa/pwa-manifest.ts`), the project reference names
   indigo `#6366f1`, the default theme's accent is indigo, and the method
   palette is described as brand identity. Which one is the brand?
2. **Logo usage.** Only the app icons exist; no rules on clear space,
   minimum size or light and dark variants.
3. **Primary audience.** Language learners, AI-chat learners, authors and
   coaches are all served; which one does a design trade-off favour?
4. **Commercial direction.** The public launch says free and open source;
   `docs/adaptive-learner-project-reference.md` names a commercial SaaS
   with paid premium plugins as the long-term goal. This changes tone
   and positioning.
5. **Typography.** `frontend/public/fonts/` ships woff2 files (Inter,
   DM Sans, Lora, Crimson Pro, JetBrains Mono, Source Serif Pro) that no
   stylesheet loads; the app renders in the system stack. Is the system
   stack the official choice, and should the unused files go?
6. **Reference look.** The default theme is dark (`soft-pop`), the
   critical-surface visual baselines use `light`. Which one is the
   reference for design review?
7. **Breakpoints.** No canonical breakpoint scale; stylesheets use many
   different widths. Mobile priority is evident in recent decisions but
   was explicitly declined in an earlier phase.
8. **English variant.** The English catalog uses British spelling; no
   policy says so.
9. **Mascot.** Game mode has a mascot ("Lernfunke") with no guidance on
   its role.
10. **Stale design references in the repo.** "6 themes" in
    `frontend/src/styles/tailwind.css`, `frontend/src/styles/contrast.test.ts`
    and `.claude/rules/architecture.md`; the stepped-modal example
    `CreateProjectModal` and the Radix packages the stepped-modal and
    split-button patterns name are not in the frontend.
