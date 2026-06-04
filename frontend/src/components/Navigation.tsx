import {ArrowLeftRight, Circle, HelpCircle, Menu, Moon, Sun, X} from "lucide-react";
import {useEffect, useState} from "react";
import {NavLink, useLocation} from "react-router-dom";

import {useHelp} from "../contexts/HelpContext";
import {useAppMode} from "../hooks/useAppMode";
import {useButtonTooltips} from "../hooks/useButtonTooltips";
import {useDevMode} from "../hooks/useDevMode";
import {useI18n} from "../hooks/useI18n";
import {useIsLessonActive} from "../hooks/useIsLessonActive";
import {useOnlineStatus} from "../hooks/useOnlineStatus";
import {useScrollDirection} from "../hooks/useScrollDirection";
import {useTheme} from "../hooks/useTheme";
import {readSyncConfig} from "../storage/sync-engine";

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
    const tooltipsOn = useButtonTooltips();
    const devMode = useDevMode();
    const {ready: modeReady, mode} = useAppMode();
    const {theme, toggle} = useTheme();
    const {openHelp} = useHelp();
    const online = useOnlineStatus();
    const HIDE_ON: readonly string[] = ["/", "/onboarding", "/assessment"];
    const {pathname} = useLocation();
    // During an active lesson the nav collapses to a minimal
    // hamburger-only bar (the links live behind the drawer) so the
    // lesson reclaims vertical space. CSS drives the actual layout
    // off the ``is-lesson-compact`` modifier.
    const lessonActive = useIsLessonActive();
    // Auto-hide the sticky nav while reading a lesson: scrolling DOWN
    // slides it up out of view (more content space), scrolling UP (or
    // reaching the top) reveals it again. Only during active lessons,
    // and never while the menu drawer is open. The slide is a CSS
    // transform transition (``-translate-y-full`` + ``transition-
    // transform``) so it respects ``prefers-reduced-motion``.
    const scrollDir = useScrollDirection();
    const [menuOpen, setMenuOpen] = useState(false);
    const navHidden = lessonActive && !menuOpen && scrollDir === "down";
    const [syncPaired, setSyncPaired] = useState<boolean>(
        () => readSyncConfig() !== null,
    );

    useEffect(() => {
        function refresh() {
            setSyncPaired(readSyncConfig() !== null);
        }
        // Refresh the indicator when the user comes back to the
        // tab (pair/unpair may have happened elsewhere) or when
        // the route changes (post-Settings visit).
        window.addEventListener("focus", refresh);
        refresh();
        return () => window.removeEventListener("focus", refresh);
    }, [pathname]);

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
            className={`app-nav transition-transform duration-300 motion-reduce:transition-none${
                menuOpen ? " is-menu-open" : ""
            }${lessonActive ? " is-lesson-compact" : ""}${
                navHidden ? " -translate-y-full" : ""
            }`}
            data-testid="app-nav"
            data-lesson-compact={lessonActive ? "true" : "false"}
            data-nav-hidden={navHidden ? "true" : "false"}
        >
            {/* Hamburger first in the DOM so it sits on the LEFT on
                mobile (primary nav action, thumb-reachable). `ml-0!`
                overrides the global.css `.nav-hamburger { margin-left:
                auto }` (unlayered, so the important modifier is what
                makes the Tailwind utility win). The show/hide across
                mobile / lesson-compact / landscape stays driven by the
                existing global.css media rules. */}
            <button
                type="button"
                className="nav-hamburger ml-0!"
                data-testid="nav-hamburger"
                aria-label={t("nav.menu", "Menu")}
                title={tooltipsOn ? t("nav.menu", "Menu") : undefined}
                aria-expanded={menuOpen}
                aria-controls="app-nav-links"
                onClick={() => setMenuOpen((v) => !v)}
            >
                {menuOpen ? (
                    <X size={20} aria-hidden="true" />
                ) : (
                    <Menu size={20} aria-hidden="true" />
                )}
            </button>
            {/* Brand grows + centres on mobile (between the hamburger and
                the right-hand cluster), reverts to left-aligned and
                natural width from md up. */}
            <NavLink
                to="/dashboard"
                className="nav-brand flex-1 justify-center md:flex-none md:justify-start"
            >
                <img
                    src={`${import.meta.env.BASE_URL}icon-192.svg`}
                    alt=""
                    aria-hidden="true"
                    width={28}
                    height={28}
                />
                <span className="nav-brand-name">{t("app.name", "Adaptive Learner")}</span>
            </NavLink>
            {devMode && (
                <NavLink
                    to="/settings"
                    className="nav-dev-badge"
                    data-testid="nav-dev-badge"
                    title={t(
                        "nav.dev_badge_tooltip",
                        "Developer Mode is on — error toasts show full technical detail. Toggle in Settings.",
                    )}
                    aria-label={t(
                        "nav.dev_badge_tooltip",
                        "Developer Mode is on — error toasts show full technical detail. Toggle in Settings.",
                    )}
                >
                    {t("nav.dev_badge", "DEV")}
                </NavLink>
            )}
            {modeReady && (
                <NavLink
                    to="/content"
                    className={`nav-mode-badge nav-mode-badge-${mode}`}
                    data-testid="nav-mode-badge"
                    data-mode={mode}
                    title={
                        mode === "ai-augmented"
                            ? t(
                                  "nav.mode_badge_tooltip_ai",
                                  "AI provider configured — exercises use AI for distractors + hints. Tap to browse content sets.",
                              )
                            : t(
                                  "nav.mode_badge_tooltip_content",
                                  "No API key configured — using pre-built content only. Add a key in Settings to enable AI features.",
                              )
                    }
                    aria-label={
                        mode === "ai-augmented"
                            ? t(
                                  "nav.mode_badge_label_ai",
                                  "Mode: AI + Content",
                              )
                            : t(
                                  "nav.mode_badge_label_content",
                                  "Mode: Content only",
                              )
                    }
                >
                    {mode === "ai-augmented"
                        ? t("nav.mode_badge_ai", "AI+Content")
                        : t("nav.mode_badge_content", "Content")}
                </NavLink>
            )}
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
                    to="/learning-path"
                    className={linkClass}
                    data-testid="nav-learning-path"
                >
                    {t("nav.learning_path", "Learning Path")}
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
                    to="/anki"
                    className={linkClass}
                    data-testid="nav-anki"
                >
                    {t("nav.anki", "Anki")}
                </NavLink>
                <NavLink
                    to="/content"
                    className={linkClass}
                    data-testid="nav-content"
                >
                    {t("nav.content", "Content")}
                </NavLink>
                <NavLink
                    to="/settings"
                    className={linkClass}
                    data-testid="nav-settings"
                >
                    {t("nav.settings", "Settings")}
                </NavLink>
                {/* Issue 3 — Help menu entry. Opens the
                    HelpDrawer in-place (no route change) on
                    the "learning_project" glossary entry,
                    which is the broadest concept and exposes
                    related-concept links to the rest of the
                    glossary. */}
                <button
                    type="button"
                    className="nav-link nav-link-button"
                    data-testid="nav-help"
                    onClick={() => {
                        openHelp("learning_project");
                        setMenuOpen(false);
                    }}
                >
                    <HelpCircle
                        size={16}
                        aria-hidden="true"
                        style={{
                            verticalAlign: "middle",
                            marginRight: 6,
                        }}
                    />
                    {t("nav.help", "Help")}
                </button>
            </div>
            <NavLink
                to="/settings"
                className={`nav-sync-indicator${syncPaired ? " is-paired" : " is-unpaired"}`}
                data-testid="nav-sync-indicator"
                data-sync-paired={syncPaired ? "true" : "false"}
                title={
                    syncPaired
                        ? t("nav.sync_paired", "Sync: paired (Settings > Sync)")
                        : t("nav.sync_unpaired", "Sync: not paired (Settings > Sync)")
                }
                aria-label={
                    syncPaired
                        ? t("nav.sync_paired", "Sync: paired")
                        : t("nav.sync_unpaired", "Sync: not paired")
                }
            >
                {syncPaired ? (
                    <ArrowLeftRight size={16} aria-hidden="true" />
                ) : (
                    <Circle size={16} aria-hidden="true" />
                )}
            </NavLink>
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
                className="nav-theme-toggle min-h-11 min-w-11"
                data-testid="nav-theme-toggle"
                onClick={toggle}
                aria-label={`Toggle ${theme === "dark" ? "light" : "dark"} theme`}
                title={
                    tooltipsOn
                        ? `Toggle ${theme === "dark" ? "light" : "dark"} theme`
                        : undefined
                }
            >
                {theme === "dark" ? (
                    <Sun size={18} aria-hidden="true" />
                ) : (
                    <Moon size={18} aria-hidden="true" />
                )}
            </button>
        </nav>
    );
}
