import type {MouseEvent} from "react";

import {useI18n} from "../../hooks/ui/useI18n";

/**
 * WCAG 2.1 SC 2.4.1 (Bypass Blocks). First focusable element on
 * every page; visually hidden until it receives focus, then
 * appears top-left. Activating it jumps focus past the nav into
 * ``#main`` (every page wraps its primary content in
 * ``<main id="main">``).
 */
export default function SkipToContent() {
    const {t} = useI18n();
    return (
        <a
            href="#main"
            className="skip-to-content"
            data-testid="skip-to-content"
            onClick={focusMain}
        >
            {t("ui.a11y.skip_to_content", "Skip to main content")}
        </a>
    );
}

/**
 * Move keyboard focus into the ``#main`` landmark.
 *
 * A bare ``href="#main"`` only SCROLLS to the target; a ``<main>``
 * landmark is not natively focusable, so keyboard focus would stay on
 * the nav and the bypass-blocks mechanism would do nothing (#514). The
 * gov.uk-frontend pattern: make ``#main`` programmatically focusable
 * with ``tabindex="-1"`` just long enough to focus it, then drop the
 * attribute on blur so it never lingers in the tab order. Falls
 * through to the default anchor behaviour when ``#main`` is absent.
 */
function focusMain(event: MouseEvent<HTMLAnchorElement>): void {
    const main = document.getElementById("main");
    if (!main) return;
    event.preventDefault();
    main.setAttribute("tabindex", "-1");
    main.addEventListener("blur", () => main.removeAttribute("tabindex"), {
        once: true,
    });
    main.focus();
    main.scrollIntoView();
}
