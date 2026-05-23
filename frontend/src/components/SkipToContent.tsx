import {useI18n} from "../hooks/useI18n";

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
        >
            {t("ui.a11y.skip_to_content", "Skip to main content")}
        </a>
    );
}
