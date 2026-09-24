/**
 * Runner shell barrel (EXP-052, refs #3169): what a migrated page
 * imports. The barrel carries only the consumed surface (the dead-code
 * ratchet, #2741, counts an unconsumed re-export as a finding): the
 * shell and, per migrated page, its policy (slice 1 Review, slice 2
 * Shuffle and Endless). Slices 3 and 4 add the rest as their pages
 * consume them; the
 * building blocks (``RunnerHeader``, ``RunnerProgress``, ``RunnerStep``,
 * ``RunnerFooter``, ``RunnerStatusView``, ``useRunStepResults``) and the
 * contracts in ``types.ts`` are composed by ``LessonRunner`` itself.
 */

export { default as LessonRunner } from "./LessonRunner";
export { ENDLESS_POLICY, REVIEW_POLICY, SHUFFLE_POLICY } from "./policies";
