/**
 * Runner shell barrel (EXP-052, refs #3169): what a migrated page
 * imports. The barrel carries only the consumed surface (the dead-code
 * ratchet, #2741, counts an unconsumed re-export as a finding): the
 * shell and, per migrated page, its policy. Slices 2 to 4 add
 * ``SHUFFLE_POLICY`` and the rest as their pages consume them; the
 * building blocks (``RunnerHeader``, ``RunnerProgress``, ``RunnerStep``,
 * ``RunnerFooter``, ``RunnerStatusView``, ``useRunStepResults``) and the
 * contracts in ``types.ts`` are composed by ``LessonRunner`` itself.
 */

export { default as LessonRunner } from "./LessonRunner";
export { REVIEW_POLICY } from "./policies";
