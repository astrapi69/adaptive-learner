/**
 * Runner shell contracts (EXP-052 slice 0, refs #3169).
 *
 * The three things a page hands the shell: where the steps come from
 * (``RunnerSource``), what this kind of run shows and allows
 * (``RunnerPolicy``, pure data) and the two render props that need
 * run-time data only the shell knows (``RunnerSummaryRenderer``,
 * ``RunnerHeaderExtraRenderer``). Slice 0 declares the contracts and
 * the six policy constants (``policies.ts``); no page consumes them yet.
 */

import type { ReactNode } from "react";

import type { EndlessStats } from "../../../hooks/lesson/modes/useEndlessLesson";
import type { LessonMode } from "../../../lib/learning/lessonModePref";
import type {
  ContentLessonCard,
  ContentLessonStep,
  ElementAttempt,
  LessonProgress,
} from "../../../storage/types";

/**
 * The load status every mode hook already reports: the identical union
 * of ``useReviewLesson`` / ``useShuffleLesson`` / ``useEndlessLesson`` /
 * ``useAdaptiveLesson`` (``useLesson`` never reports ``empty``).
 */
export type RunnerSourceStatus = "loading" | "empty" | "not-cached" | "ready" | "error";

/**
 * The normalised step source of a run. A page calls its mode hook as
 * today and maps the result into this shape; the shell never learns
 * which hook produced it.
 *
 * @example
 * const source: RunnerSource = {
 *   status, error, title, step, cards, lessonId, isSummary, goNext, goPrev,
 *   position: { index: currentStepIndex, total: totalSteps },
 *   recordStepAttempts,
 * };
 */
export interface RunnerSource {
  status: RunnerSourceStatus;
  error: string | null;
  title: string;
  subtitle?: string;
  /** The current step, or ``null`` on the summary. */
  step: ContentLessonStep | null;
  cards: ContentLessonCard[];
  /** For the attempt derivation in the dispatcher (Review: the source
   *  ``lesson_id`` embedded in the synthesised step id). */
  lessonId: string;
  /**
   * The content set the run plays. The dispatcher stamps it on every
   * attempt (``set_id``); an empty string is the missing-params screen,
   * exactly as the pages resolve ``!setId`` today (slice 1).
   */
  setId: string;
  /**
   * Identity of the run (slice 1). A NEW value starts a new run: the
   * shell clears hint usage (#594 / #3196) and drops the run-local step
   * results that lock an answered step (#1790). A re-render with the
   * same key touches neither. Review: the set plus a round counter
   * ("another round" is a new run); the lesson (slice 4): source, set
   * and file.
   */
  runKey: string;
  /** Indexed runs carry a position; the Endless stream has none. */
  position: { index: number; total: number } | null;
  isSummary: boolean;
  /**
   * What the summary render prop receives (slice 1). The mode hook owns
   * the numbers, not the shell: Review tallies per ELEMENT with the last
   * outcome winning (#3170), which a per-step sum in the shell could not
   * reproduce.
   */
  tallies: RunnerSummaryTallies;
  goNext: () => void;
  /** Absent when the run cannot go back (Endless: no previous step exists). */
  goPrev?: () => void;
  recordStepAttempts: (attempts: readonly ElementAttempt[]) => Promise<void>;
  /** Only the persisting lesson: the progress row for the reviewed-step lock. */
  progress?: LessonProgress | null;
}

/** The six testid prefixes the pages already carry; they stay (policy). */
export type RunnerTestIdPrefix =
  "lesson" | "review" | "shuffle" | "endless" | "adaptive-lesson" | "error-replay";

/**
 * How the header lets the learner leave the run.
 *
 * - ``"set-link"``: the lesson header's link back to the content set,
 *   no back button.
 * - ``"back-button"``: a back button whose destination the page supplies
 *   at run time. Error Replay returns to the lesson it was opened from,
 *   a parameterised route a constant cannot name.
 * - ``{ backTo }``: a back button to one fixed route. The four session
 *   runners return to the dashboard.
 */
export type RunnerExit = "set-link" | "back-button" | { backTo: string };

/**
 * What a kind of run shows and allows. Pure data, one frozen constant
 * per runner in ``policies.ts``, so a behaviour difference between two
 * runners is a diff in one table instead of a diff in two pages.
 *
 * Deliberately NOT policy columns: the footer look (every runner gets
 * the lesson footer, chevron and check icons included) and the header
 * extension (a render prop on the shell, ``RunnerHeaderExtraRenderer``,
 * because it renders run-time data from the source).
 */
export interface RunnerPolicy {
  testIdPrefix: RunnerTestIdPrefix;
  /** Namespace of the runner's own catalog keys (``review.*`` ...). */
  i18nNamespace: string;
  exit: RunnerExit;
  /**
   * Whether the footer offers a Previous button. ``false`` only for
   * Endless, and STRUCTURALLY so: its source is a stream with
   * ``position: null`` and no ``goPrev``, so there is no previous step
   * to materialise. Not a preference a runner opts out of.
   */
  prevStep: boolean;
  /** Whether the footer carries the pause control (#1642). */
  pause: boolean;
  /** Whether the options bar (favourite, mode toggle, read-aloud) renders. */
  optionsBar: boolean;
  /** Whether the step view offers the theory back-link. */
  theoryLink: boolean;
  /**
   * Literal ``true``: the Enter shortcut is mounted for every runner.
   * Not an opt-out. The adaptive runner's missing Enter (EXP-052) is
   * exactly the drift this literal closes.
   */
  enterShortcut: true;
  /**
   * Literal ``true``: step and orientation re-anchoring (#959, #1422)
   * for every runner. Not an opt-out.
   */
  reanchor: true;
  /**
   * Literal ``true``: hint usage is cleared at the start of every run
   * (#594, #3196). Not an opt-out.
   */
  clearHints: true;
  /** Whether progress persists across sessions (only the lesson). */
  persistProgress: boolean;
  /** The mode the run pins, or ``"inherit"`` for the learner's own choice. */
  mode: LessonMode | "inherit";
  /**
   * Catalog key of the empty-screen body ("all caught up", "needs two
   * lessons", "nothing to adapt yet"): content that explains WHY this run
   * shows nothing, so it stays per runner while the shared chrome reads
   * ``runner.*`` (#3203). ``null`` only for the lesson, whose source never
   * reports ``empty`` (a lesson is a file; missing or not cached, never
   * empty).
   */
  emptyBodyKey: string | null;
  /** Catalog key of the load-failed line; per runner by content (#3203). */
  loadFailedKey: string;
  /**
   * Catalog key of the not-cached body. A key is shared (``runner.*``)
   * when the TRIGGERING CONDITION is identical, not when the sentence
   * looks alike: the five session runners fall into ``not-cached`` when
   * ``listSets()`` has no set with this id (the set is missing, the
   * content browser is the next step); the lesson falls into it when
   * ``getLesson()`` cannot find THIS file inside a set that may well be
   * downloaded, so its text (``lesson.*``) must not send the learner to a
   * set that is already there.
   */
  notCachedBodyKey: string;
  /**
   * Catalog key of the missing-params body: the lesson guards three
   * params (source, set, file), the others one (set). Different missing
   * things, different sentences; same rule as ``notCachedBodyKey``.
   */
  missingParamsKey: string;
}

/** The run-time tallies the shell hands to the summary render prop. */
interface RunnerSummaryTallies {
  correct: number;
  total: number;
  remaining?: number;
  masteredDelta?: number | null;
  stats?: EndlessStats;
}

/**
 * Render prop for the end-of-run summary. The six summary components
 * stay as they are and are hung in through this prop.
 *
 * @example
 * summary={(tallies) => <ReviewSummary {...tallies} onAnotherRound={reload} />}
 */
export type RunnerSummaryRenderer = (tallies: RunnerSummaryTallies) => ReactNode;

/**
 * Render prop for a header extension under the title: the adaptive
 * transparency block, the error-replay countdown ring. A render prop
 * and not a policy column because it draws run-time data from the
 * source; the other four runners simply leave it out.
 *
 * @example
 * headerExtra={(source) => <AdaptiveTransparencyDisplay title={source.title} />}
 */
export type RunnerHeaderExtraRenderer = (source: RunnerSource) => ReactNode;
