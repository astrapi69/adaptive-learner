import {NavLink, useLocation} from "react-router-dom";

import {useI18n} from "../hooks/useI18n";
import {useTheme} from "../hooks/useTheme";

/**
 * Top navigation bar. Rendered on every authenticated page
 * (Dashboard / Session / Progress / Settings) and hidden on the
 * pre-onboarding routes (Landing, Onboarding, Assessment) so the
 * funnel stays focused.
 *
 * Keeps a small set of links (one per main route) plus a theme
 * toggle. Active-route highlighting comes from React Router's
 * NavLink ``isActive`` callback.
 */
export default function Navigation() {
    const {t} = useI18n();
    const {theme, toggle} = useTheme();
    const HIDE_ON: readonly string[] = ["/", "/onboarding", "/assessment"];
    const {pathname} = useLocation();
    if (HIDE_ON.includes(pathname)) return null;

    const linkClass = ({isActive}: {isActive: boolean}) =>
        `nav-link${isActive ? " is-active" : ""}`;

    return (
        <nav className="app-nav" data-testid="app-nav">
            <NavLink to="/dashboard" className="nav-brand">
                <img
                    src="/icon-192.svg"
                    alt=""
                    aria-hidden="true"
                    width={28}
                    height={28}
                />
                <span className="nav-brand-name">{t("app.name", "Adaptive Learner")}</span>
            </NavLink>
            <div className="nav-links">
                <NavLink
                    to="/dashboard"
                    className={linkClass}
                    data-testid="nav-dashboard"
                >
                    {t("nav.dashboard", "Dashboard")}
                </NavLink>
                <NavLink
                    to="/session"
                    className={linkClass}
                    data-testid="nav-session"
                >
                    {t("nav.session", "Session")}
                </NavLink>
                <NavLink
                    to="/progress"
                    className={linkClass}
                    data-testid="nav-progress"
                >
                    {t("nav.progress", "Progress")}
                </NavLink>
                <NavLink
                    to="/settings"
                    className={linkClass}
                    data-testid="nav-settings"
                >
                    {t("nav.settings", "Settings")}
                </NavLink>
            </div>
            <button
                type="button"
                className="nav-theme-toggle"
                data-testid="nav-theme-toggle"
                onClick={toggle}
                aria-label={`Toggle ${theme === "dark" ? "light" : "dark"} theme`}
            >
                {theme === "dark" ? "☀" : "☾"}
            </button>
        </nav>
    );
}
