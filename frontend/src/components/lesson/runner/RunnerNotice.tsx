/**
 * RunnerNotice (EXP-052 slice 2, refs #3169).
 *
 * The one-line panel the shell shows in the step slot when there is no
 * step to answer: a paused stream ("Paused - take a breather.", announced
 * as a status) or a stream that has no card right now. Same markup the
 * Endless page rendered inline (``lesson-step`` section, secondary text),
 * so the ``endless-paused`` / ``endless-no-card`` testids keep their DOM.
 *
 * @example
 * <RunnerNotice testId="endless-paused" role="status" text={t("endless.paused")} />
 */

export interface RunnerNoticeProps {
  testId: string;
  text: string;
  /** ``"status"`` for a state change the screen reader should announce. */
  role?: "status";
}

/** A ``lesson-step`` section with one line of secondary text. */
export default function RunnerNotice({ testId, text, role }: RunnerNoticeProps) {
  return (
    <section className="lesson-step" data-testid={testId} role={role}>
      <p className="text-fg-secondary">{text}</p>
    </section>
  );
}
