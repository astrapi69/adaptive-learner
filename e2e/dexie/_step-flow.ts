import { expect, type Page } from "@playwright/test";

/**
 * Lesson-step container testids across the three playthrough surfaces. Each
 * page mounts exactly ONE step container at a time, under its own prefix:
 *   - the main lesson viewer (Lesson.tsx)      -> ``lesson-step-<id>``
 *   - the Error Replay lesson (ErrorReplayLesson) -> ``error-replay-step-<id>``
 *   - the Adaptive lesson (AdaptiveLesson)      -> ``adaptive-lesson-step-<id>``
 * The prefixes are disjoint, so a union selector auto-detects the active one.
 *
 * The runner shell (EXP-052, #3169) renders the Adaptive and Error Replay
 * steps under the page's testid prefix (the adaptive step moved from
 * ``adaptive-step-`` onto ``adaptive-lesson-step-`` with slice 3) and puts a
 * scroll anchor ``<prefix>-step-anchor`` BEFORE the step. The anchor shares
 * the prefix but never unmounts, so it is excluded: picked first, it would
 * turn every ``waitForStepAdvance`` into a 5s timeout.
 */
const NOT_ANCHOR = ':not([data-testid$="-step-anchor"])';
const STEP_CONTAINER_SELECTOR = ["lesson-step-", "error-replay-step-", "adaptive-lesson-step-"]
  .map((prefix) => `[data-testid^="${prefix}"]${NOT_ANCHOR}`)
  .join(", ");

/**
 * Read the currently-mounted lesson step container's testid, or null when no
 * step is mounted (e.g. once the summary has replaced the step). Capture this
 * BEFORE clicking the advance button so {@link waitForStepAdvance} can wait
 * for exactly that step to unmount.
 */
export async function currentStepTestId(page: Page): Promise<string | null> {
  const container = page.locator(STEP_CONTAINER_SELECTOR).first();
  if (!(await container.count())) return null;
  return container.getAttribute("data-testid");
}

/**
 * Deterministic replacement for a fixed ``waitForTimeout`` settle after
 * advancing a lesson step: wait for the previously-mounted step container to
 * unmount, which only happens once React has swapped in the next step (or the
 * summary). ``beforeStepTestId`` is the value captured by
 * {@link currentStepTestId} before the advance click; pass null when no advance
 * happened (e.g. the Next button was absent) so this is a no-op rather than a
 * spurious 5s wait on a step that never leaves.
 */
export async function waitForStepAdvance(
  page: Page,
  beforeStepTestId: string | null,
): Promise<void> {
  if (!beforeStepTestId) return;
  await expect(
    page.locator(`[data-testid="${beforeStepTestId}"]`),
  ).toHaveCount(0, { timeout: 5000 });
}
