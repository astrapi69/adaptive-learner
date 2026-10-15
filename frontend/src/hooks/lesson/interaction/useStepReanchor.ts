/**
 * useStepReanchor (#3126) - bring the active lesson step to the top of the
 * scrollport after every step change, in an order iOS Safari survives.
 *
 * Two scrolls used to race on a step change: the navigation hook reset
 * ``#root`` to the top and the page smooth-scrolled the step anchor into
 * view. Going from a long step to a short one shrinks ``#root``'s scroll
 * height while the old offset still stands; iOS clamps the stale offset
 * only on the next touch (the #1422 class), so the smooth scroll started
 * from a position that no longer existed and the page settled with the
 * content cut off at the top and the sticky footer mid-screen above an
 * empty lower half.
 *
 * One hook, two ordered moves: first the hard reset (``scrollTop = 0`` on
 * the scroll container plus ``window.scrollTo``), which clamps whatever
 * offset the old layout left behind, then the anchor is scrolled into view.
 *
 * Both run in a layout effect, instantly, before the browser paints the new
 * step (#3752). They used to wait two frames and then scroll smoothly, so
 * the first frame showed the step at the top of the page and the options
 * slid about 165 px over some 250 ms after it: a tap on what the learner
 * saw first landed on the neighbouring option (Oslo tapped, Stockholm
 * recorded). A layout effect reads the committed layout of the new step,
 * which is all the double frame waited for. Sibling of
 * {@link useOrientationReanchor}, which does the same for a device rotation.
 *
 * @example
 * const stepScrollRef = useRef<HTMLDivElement>(null);
 * useStepReanchor(stepScrollRef, currentStepIndex, !showResumePrompt);
 *
 * @param anchorRef - The #959 step anchor rendered just above the progress bar.
 * @param stepIndex - The active step; every change triggers the re-anchor.
 * @param enabled - Gate, e.g. off while the resume overlay owns the screen.
 */
import { useLayoutEffect, type RefObject } from "react";

/** The single scroll container of the app shell (`#root`, see 01-base.css). */
function scrollContainer(): HTMLElement | null {
  return typeof document === "undefined"
    ? null
    : document.getElementById("root");
}

/** Hard-reset the scroll offset; never smooth, never throws in a headless env. */
function resetScroll(): void {
  try {
    const root = scrollContainer();
    if (root) root.scrollTop = 0;
    window.scrollTo({ top: 0 });
  } catch {
    /* no real scroll in this environment */
  }
}

export function useStepReanchor(
  anchorRef: RefObject<HTMLElement | null>,
  stepIndex: number,
  enabled: boolean = true,
): void {
  useLayoutEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    resetScroll();
    anchorRef.current?.scrollIntoView?.({ behavior: "auto", block: "start" });
  }, [anchorRef, stepIndex, enabled]);
}
