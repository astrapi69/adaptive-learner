/**
 * useVisualViewportShell (#1569) — realign the iOS caret/touch hit-test grid
 * with the rendered page while the software keyboard is open.
 *
 * The #1410/#1415 landscape fix sizes the app shell off the DYNAMIC viewport
 * (``html, body, #root { height: 100dvh }``) and scroll-locks the body so
 * ``#root`` is the sole scroll container. That is correct for rotation, but on
 * iOS the software keyboard shrinks only the *visual* viewport — the *layout*
 * viewport stays full height and ``dvh`` does NOT track the keyboard (per spec
 * ``dvh`` reflects browser-UI/address-bar changes, not the on-screen keyboard).
 * With the keyboard up, ``#root`` therefore stays a full ``100dvh`` tall while
 * the visible area is much shorter, and a scroll-locked body of fixed ``dvh``
 * height cannot reconcile the two viewports the way natural document flow does:
 * iOS composites a visual-viewport offset while the caret + touch hit-test grid
 * stay on the un-offset layout coordinates. The result is the reported
 * "caret/touch lands 1-2 lines below the field" desync (text fields AND, once
 * the visual viewport is offset, MC/SC choice tiles).
 *
 * The fix, applied ONCE at the app shell (mounted alongside ``useTheme``, so it
 * covers every route and every exercise type): while the keyboard is open,
 * constrain the shell height to ``visualViewport.height`` via the
 * ``--app-shell-height`` custom property, so the layout and visual viewports
 * coincide and the hit-test grid realigns with the rendering. Keyboard closed →
 * the property is cleared → the shell falls back to ``100dvh`` exactly as
 * #1415 left it (the landscape fix is preserved, declaration order intact).
 *
 * Cross-platform safety: on desktop/Android the visual viewport tracks the
 * layout viewport (Android resizes the layout viewport for its keyboard), so
 * the keyboard inset stays under the threshold and the override never engages —
 * the hook is inert everywhere except an iOS on-screen keyboard. The threshold
 * keeps address-bar-sized shrinks (already handled by ``dvh``) from toggling
 * the override, which would otherwise fight ``dvh`` and flicker the layout.
 *
 * The native hit-test resolution itself is a WebKit compositing behaviour that
 * only manifests on real iOS hardware; the deterministic part pinned in the
 * unit test is the viewport-tracking mechanism (override published on
 * keyboard-open, cleared on close). On-device verification remains mandatory.
 *
 * @example
 * // in App(), app-global:
 * useVisualViewportShell();
 */

import {useEffect} from "react";

/** Minimum layout-vs-visual shrink (px) treated as an open keyboard. iOS
 *  keyboards cover ~250-320px; address-bar / browser-UI changes are well under
 *  this and are already tracked by ``dvh``, so they must not engage the
 *  override. */
const KEYBOARD_MIN_INSET = 150;

const SHELL_HEIGHT_PROP = "--app-shell-height";
const KEYBOARD_MARKER = "data-vv-keyboard";

export function useVisualViewportShell(): void {
    useEffect(() => {
        if (typeof window === "undefined") return;
        const viewport = window.visualViewport;
        if (!viewport) return;

        const root = document.documentElement;

        const clearOverride = () => {
            root.style.removeProperty(SHELL_HEIGHT_PROP);
            root.removeAttribute(KEYBOARD_MARKER);
        };

        const sync = () => {
            const inset = window.innerHeight - viewport.height;
            if (inset > KEYBOARD_MIN_INSET) {
                // Keyboard open: pin the shell to the visible area so the
                // layout viewport stops being taller than what the user sees,
                // realigning the caret + touch hit-test grid.
                root.style.setProperty(
                    SHELL_HEIGHT_PROP,
                    `${Math.round(viewport.height)}px`,
                );
                root.setAttribute(KEYBOARD_MARKER, "open");
            } else {
                clearOverride();
            }
        };

        viewport.addEventListener("resize", sync);
        viewport.addEventListener("scroll", sync);
        sync();

        return () => {
            viewport.removeEventListener("resize", sync);
            viewport.removeEventListener("scroll", sync);
            clearOverride();
        };
    }, []);
}
