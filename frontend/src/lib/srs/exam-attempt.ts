/**
 * srs/exam-attempt — stamp the exam-mode flag onto element attempts
 * (#1040 Exam-Mode SRS boost, Phase 2 of #1007).
 *
 * The lesson runner knows the active {@link LessonMode} (via
 * ``useLessonMode``); the per-element attempts persisted at lesson
 * completion need to carry that signal so the SRS layer can LENGTHEN the
 * review interval for a card answered correctly under exam pressure (the
 * inverse of the #594 hint-economy factor, which shortens it).
 *
 * Mirrors the shape of {@link stampHintUsage}: a pure, storage-agnostic
 * mapper that the ``recordBulk`` call site applies before persisting. The
 * correct-vs-wrong distinction is NOT made here — every exam-mode attempt
 * is stamped ``exam: true`` and the recorder (backend service + Dexie
 * mirror) stores the boost only when the attempt is also correct.
 *
 * @example
 * ```ts
 * const { mode } = useLessonMode();
 * await storage.elementErrors.recordBulk(
 *   userId,
 *   stampExamAttempts(stampHintUsage(attempts), mode === "exam"),
 * );
 * ```
 */

import type { ElementAttempt } from "../../storage/types";

/**
 * Return a copy of ``attempts`` with ``exam`` stamped true on every
 * attempt when ``isExam`` is set. Pure — never mutates the input. When
 * ``isExam`` is false the attempts are returned unchanged.
 *
 * @param attempts - The element attempts to stamp.
 * @param isExam - Whether the lesson is being played in exam mode.
 */
export function stampExamAttempts(
  attempts: readonly ElementAttempt[],
  isExam: boolean,
): ElementAttempt[] {
  if (!isExam) return attempts.map((attempt) => ({ ...attempt }));
  return attempts.map((attempt) => ({ ...attempt, exam: true }));
}
