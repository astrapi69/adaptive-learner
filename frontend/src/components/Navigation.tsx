import {useEffect, useState} from "react";
import {NavLink, useLocation} from "react-router-dom";

import {useI18n} from "../hooks/useI18n";
import {useOnlineStatus} from "../hooks/useOnlineStatus";
import {useTheme} from "../hooks/useTheme";

/**
 * Top navigation bar. Rendered on every authenticated page
 * (Dashboard / Session / Progress / Settings) and hidden on the
 * pre-onboarding routes (Landing, Onboarding, Assessment) so the
 * funnel stays focused.
 *
 * v0.6.0 — mobile responsive. Desktop keeps the horizontal nav
 * exactly as before. On viewports <=768px the links collapse
 * behind a hamburger toggle that opens a drawer-style menu;
 * the brand + theme toggle stay visible. Drawer closes on
 * route change so a tap on a link doesn't leave a half-open
 * menu behind.
 */
export default function Navigation() {
    const {t} = useI18n();
    const {theme, toggle} = useTheme();
    const online = useOnlineStatus();
    const HIDE_ON: readonly string[] = ["/", "/onboarding", "/assessment"];
    const {pathname} = useLocation();
    const [menuOpen, setMenuOpen] = useState(false);

    // Collapse the drawer whenever the route changes — a fresh
    // page should never inherit the previous page's drawer state.
    useEffect(() => {
        setMenuOpen(false);
    }, [pathname]);

    if (HIDE_ON.includes(pathname)) return null;

    const linkClass = ({isActive}: {isActive: boolean}) =>
        `nav-link${isActive ? " is-active" : ""}`;

    return (
        <nav
            className={`app-nav${menuOpen ? " is-menu-open" : ""}`}
            data-testid="app-nav"
        >
            <NavLink to="/dashboard" className="nav-brand">
                <img
                    src={`${import.meta.env.BASE_URL}icon-192.svg`}
                    alt=""
                    aria-hidden="true"
                    width={28}
                    height={28}
                />
                <span className="nav-brand-name">{t("app.name", "Adaptive Learner")}</span>
            </NavLink>
            <button
                type="button"
                className="nav-hamburger"
                data-testid="nav-hamburger"
                aria-label={t("nav.menu", "Menu")}
                aria-expanded={menuOpen}
                aria-controls="app-nav-links"
                onClick={() => setMenuOpen((v) => !v)}
            >
                <span aria-hidden="true">{menuOpen ? "✕" : "☰"}</span>
            </button>
            <div
                id="app-nav-links"
                className={`nav-links${menuOpen ? " is-open" : ""}`}
                data-testid="nav-links"
            >
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
                    to="/curriculum"
                    className={linkClass}
                    data-testid="nav-curriculum"
                >
                    {t("nav.curriculum", "Curriculum")}
                </NavLink>
                <NavLink
                    to="/progress"
                    className={linkClass}
                    data-testid="nav-progress"
                >
                    {t("nav.progress", "Progress")}
                </NavLink>
                <NavLink
                    to="/import"
                    className={linkClass}
                    data-testid="nav-import"
                >
                    {t("nav.import", "Import")}
                </NavLink>
                <NavLink
                    to="/settings"
                    className={linkClass}
                    data-testid="nav-settings"
                >
                    {t("nav.settings", "Settings")}
                </NavLink>
            </div>
            <span
                className={`nav-online-indicator${online ? " is-online" : " is-offline"}`}
                data-testid="nav-online-indicator"
                data-online={online ? "true" : "false"}
                role="status"
                aria-live="polite"
                title={
                    online
                        ? t("nav.online", "Online")
                        : t("nav.offline", "Offline — past sessions stay readable")
                }
            >
                <span className="nav-online-dot" aria-hidden="true" />
                <span className="nav-online-label">
                    {online ? t("nav.online", "Online") : t("nav.offline", "Offline")}
                </span>
            </span>
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
