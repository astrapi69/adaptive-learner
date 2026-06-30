import { expect, type Page } from "@playwright/test";

/**
 * Lesson-step container testids across the three playthrough surfaces. Each
 * page mounts exactly ONE step container at a time, under its own prefix:
 *   - the main lesson viewer (Lesson.tsx)      -> ``lesson-step-<id>``
 *   - the Error Replay lesson (ErrorReplayLesson) -> ``error-replay-step-<id>``
 *   - the Adaptive lesson (AdaptiveLesson)      -> ``adaptive-step-<id>``
 * The prefixes are disjoint, so a union selector auto-detects the active one.
 */
const STEP_CONTAINER_SELECTOR =
  '[data-testid^="lesson-step-"], [data-testid^="error-replay-step-"], [data-testid^="adaptive-step-"]';

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
