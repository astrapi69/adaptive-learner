import {useEffect, useRef, useState} from "react";

export type ScrollDirection = "up" | "down" | "top";

/**
 * Track the vertical scroll direction within the app's scroll
 * container. ``html``/``body`` are overflow-locked (see global.css);
 * ``#root`` provides the actual vertical scroll, so that is the default
 * container the hook observes.
 *
 * Returns:
 *   - ``"top"``  while at / near the top (``scrollTop <= threshold``),
 *   - ``"down"`` after scrolling down past the threshold,
 *   - ``"up"``   after scrolling up past the threshold.
 *
 * The ``threshold`` (px) ignores sub-pixel jitter and micro-scrolls so
 * the result doesn't flap on a trackpad nudge. When the container is
 * absent (e.g. a component mounted in isolation in a test) the hook is a
 * no-op and stays at ``"top"``.
 *
 * Consumers translate the direction into UI: e.g. hide a sticky header
 * on ``"down"`` and reveal it on ``"up"`` / ``"top"``.
 */
export function useScrollDirection(
    threshold = 10,
    containerSelector = "#root",
): ScrollDirection {
    const [direction, setDirection] = useState<ScrollDirection>("top");
    const lastScrollY = useRef(0);

    useEffect(() => {
        const container =
            document.querySelector<HTMLElement>(containerSelector);
        if (!container) return;

        const handleScroll = () => {
            const currentY = container.scrollTop;
            if (currentY <= threshold) {
                setDirection("top");
            } else if (currentY > lastScrollY.current + threshold) {
                setDirection("down");
            } else if (currentY < lastScrollY.current - threshold) {
                setDirection("up");
            }
            lastScrollY.current = currentY;
        };

        // Reconcile against the initial scroll position on mount (a
        // remounted lesson view may already be scrolled down).
        handleScroll();
        container.addEventListener("scroll", handleScroll, {passive: true});
        return () => container.removeEventListener("scroll", handleScroll);
    }, [threshold, containerSelector]);

    return direction;
}
