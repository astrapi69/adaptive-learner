/**
 * Runner shell barrel (EXP-052, refs #3169): what a migrated page
 * imports. The barrel carries only the consumed surface (the dead-code
 * ratchet, #2741, counts an unconsumed re-export as a finding): the
 * shell and, per migrated page, its policy (slice 1 Review, slice 2
 * Shuffle and Endless, slice 3 Adaptive and Error Replay). Slice 4 adds
 * the lesson's as its page consumes it; the
 * building blocks (``RunnerHeader``, ``RunnerProgress``, ``RunnerStep``,
 * ``RunnerFooter``, ``RunnerStatusView``, ``useRunStepResults``) and the
 * contracts in ``types.ts`` are composed by ``LessonRunner`` itself; the
 * summaries and header extensions are imported by the page that hangs
 * them in.
 */

export { default as LessonRunner } from "./LessonRunner";
export {
  ADAPTIVE_POLICY,
  ENDLESS_POLICY,
  ERROR_REPLAY_POLICY,
  REVIEW_POLICY,
  SHUFFLE_POLICY,
} from "./policies";
