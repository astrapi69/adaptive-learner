/**
 * The six runner policies (EXP-052 slice 0, refs #3169).
 *
 * The behaviour matrix the owner ratified on 2026-09-23, as data. A row
 * per runner, a column per ``RunnerPolicy`` field; the table test in
 * ``policies.test.ts`` pins every cell. Nothing consumes these constants
 * yet: slices 1 to 4 wire one page each.
 *
 * @example
 * <LessonRunner source={source} policy={REVIEW_POLICY} summary={renderSummary} />
 */

import type { RunnerExit, RunnerPolicy, RunnerTestIdPrefix } from "./types";

/** The four session runners leave to the dashboard, as their headers do today. */
const DASHBOARD_EXIT: RunnerExit = Object.freeze({ backTo: "/dashboard" });

/** The learner's lesson: persisted progress, the learner's mode, full chrome. */
export const LESSON_POLICY: RunnerPolicy = Object.freeze({
  testIdPrefix: "lesson",
  i18nNamespace: "lesson",
  exit: "set-link",
  prevStep: true,
  pause: true,
  optionsBar: true,
  theoryLink: true,
  enterShortcut: true,
  reanchor: true,
  clearHints: true,
  persistProgress: true,
  mode: "inherit",
});

/** Review session synthesised from the SRS queue. */
export const REVIEW_POLICY: RunnerPolicy = Object.freeze({
  testIdPrefix: "review",
  i18nNamespace: "review",
  exit: DASHBOARD_EXIT,
  prevStep: true,
  pause: false,
  optionsBar: false,
  theoryLink: false,
  enterShortcut: true,
  reanchor: true,
  clearHints: true,
  persistProgress: false,
  mode: "practice",
});

/** Shuffle across the lessons of a set. */
export const SHUFFLE_POLICY: RunnerPolicy = Object.freeze({
  testIdPrefix: "shuffle",
  i18nNamespace: "shuffle",
  exit: DASHBOARD_EXIT,
  prevStep: true,
  pause: false,
  optionsBar: false,
  theoryLink: false,
  enterShortcut: true,
  reanchor: true,
  clearHints: true,
  persistProgress: false,
  mode: "practice",
});

/**
 * The Endless stream. ``prevStep: false`` is structural, not a
 * preference: the source has ``position: null`` and no ``goPrev``.
 * The pause control moves from the stat line into the footer.
 */
export const ENDLESS_POLICY: RunnerPolicy = Object.freeze({
  testIdPrefix: "endless",
  i18nNamespace: "endless",
  exit: DASHBOARD_EXIT,
  prevStep: false,
  pause: true,
  optionsBar: false,
  theoryLink: false,
  enterShortcut: true,
  reanchor: true,
  clearHints: true,
  persistProgress: false,
  mode: "practice",
});

/** Adaptive lesson generated from the learner's errors; the transparency
 *  block arrives through the ``headerExtra`` render prop. */
export const ADAPTIVE_POLICY: RunnerPolicy = Object.freeze({
  testIdPrefix: "adaptive-lesson",
  i18nNamespace: "adaptive",
  exit: DASHBOARD_EXIT,
  prevStep: true,
  pause: false,
  optionsBar: false,
  theoryLink: false,
  enterShortcut: true,
  reanchor: true,
  clearHints: true,
  persistProgress: false,
  mode: "practice",
});

/** Error replay opened from a lesson summary; ``"back-button"`` returns
 *  to that lesson (a route only the page knows), the countdown ring
 *  arrives through ``headerExtra``. */
export const ERROR_REPLAY_POLICY: RunnerPolicy = Object.freeze({
  testIdPrefix: "error-replay",
  i18nNamespace: "lesson.error_replay",
  exit: "back-button",
  prevStep: true,
  pause: false,
  optionsBar: false,
  theoryLink: false,
  enterShortcut: true,
  reanchor: true,
  clearHints: true,
  persistProgress: false,
  mode: "practice",
});

/** All six, keyed by testid prefix (the table the tests iterate). */
export const RUNNER_POLICIES: Readonly<Record<RunnerTestIdPrefix, RunnerPolicy>> = Object.freeze({
  lesson: LESSON_POLICY,
  review: REVIEW_POLICY,
  shuffle: SHUFFLE_POLICY,
  endless: ENDLESS_POLICY,
  "adaptive-lesson": ADAPTIVE_POLICY,
  "error-replay": ERROR_REPLAY_POLICY,
});
