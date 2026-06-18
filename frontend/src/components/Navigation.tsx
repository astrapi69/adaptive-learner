import { HelpCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";

import { Button } from "@/components/ui/button";
import MenuToggleButton from "../shared/MenuToggleButton";
import NavXpBadge from "./NavXpBadge";
import NavReviewsBadge from "./NavReviewsBadge";
import NavAvatar from "./NavAvatar";
import {
  NavModeBadge,
  NavOnlineIndicator,
  NavSyncIndicator,
  NavThemeToggle,
} from "./NavIndicators";

import { useHelp } from "../contexts/HelpContext";
import { helpKeyForPath } from "../lib/help-routes";
import { useAppMode } from "../hooks/useAppMode";
import { useButtonTooltips } from "../hooks/useButtonTooltips";
import { useDevMode } from "../hooks/useDevMode";
import { useI18n } from "../hooks/useI18n";
import { useIsLessonActive } from "../hooks/useIsLessonActive";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { useSyncQueueSize } from "../hooks/useSyncQueueSize";
import { useScrollDirection } from "../hooks/useScrollDirection";
import { useTheme } from "../hooks/useTheme";
import { isDarkTheme } from "../lib/themes";
import { readSyncConfig } from "../storage/sync-engine";

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
  const { t } = useI18n();
  const tooltipsOn = useButtonTooltips();
  const devMode = useDevMode();
  const { ready: modeReady, mode } = useAppMode();
  const { theme, toggle } = useTheme();
  const { openHelp } = useHelp();
  const online = useOnlineStatus();
  const syncPending = useSyncQueueSize();
  const HIDE_ON: readonly string[] = ["/", "/onboarding", "/assessment"];
  const { pathname } = useLocation();
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

  // Collapse the drawer whenever the route changes — the back-button
  // backstop. A fresh page should never inherit the previous page's
  // drawer state. NOTE: this alone is NOT enough (#666) — a tap on a
  // link to the route the user is ALREADY on doesn't change ``pathname``,
  // so the drawer would stay open. The per-link onClick below covers it.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // #666 — close the drawer on Escape + outside click while it is open.
  // Uses ``pointerdown`` (not ``mousedown``): iOS Safari fires pointer
  // events reliably for touch, so a tap outside closes the drawer on the
  // FIRST touch instead of being swallowed (same fix as #593 for the
  // Settings mobile menu). Tapping the hamburger or a link is INSIDE the
  // ``<nav>`` so the outside-click handler ignores it — the toggle and the
  // per-link onClick own those.
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(e: Event) {
      if (!navRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  // #666 — close the drawer on ANY menu link/button tap, BEFORE navigation.
  // Delegated so every current + future link inherits it without a
  // per-link handler. Covers the same-route case the ``pathname`` effect
  // misses, and makes iOS Safari close the drawer reliably on the tap that
  // navigates. The navigation itself still happens (we don't preventDefault).
  function closeMenuOnLinkTap(e: React.MouseEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest("a, button")) setMenuOpen(false);
  }

  if (HIDE_ON.includes(pathname)) return null;

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `nav-link${isActive ? " is-active" : ""}`;

  return (
    <nav
      ref={navRef}
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
      <MenuToggleButton
        open={menuOpen}
        onToggle={() => setMenuOpen((v) => !v)}
        label={t("nav.menu", "Menu")}
        tooltip={tooltipsOn}
        controlsId="app-nav-links"
        className="nav-hamburger ml-0!"
        testId="nav-hamburger"
      />
      {/* Brand grows + centres on mobile (between the hamburger and
                the right-hand cluster), reverts to left-aligned and
                natural width from md up. */}
      <NavLink
        to="/dashboard"
        className="nav-brand flex-1 justify-center md:flex-none md:justify-start"
        // #622 — the brand word (`.nav-brand-name`) is `display:none` in
        // the lesson-compact nav, which left the brand link with only the
        // decorative (aria-hidden, empty-alt) logo and no accessible name
        // (axe `link-name` on /lesson). A constant aria-label keeps the
        // link named in every nav state.
        aria-label={t("app.name", "Adaptive Learner")}
      >
        <img
          src={`${import.meta.env.BASE_URL}${
            isDarkTheme(theme) ? "icon-192-dark.png" : "icon-192.png"
          }`}
          alt=""
          aria-hidden="true"
          width={28}
          height={28}
        />
        <span className="nav-brand-name">
          {t("app.name", "Adaptive Learner")}
        </span>
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
      {modeReady && <NavModeBadge mode={mode} />}
      <div
        id="app-nav-links"
        className={`nav-links${menuOpen ? " is-open" : ""}`}
        data-testid="nav-links"
        onClick={closeMenuOnLinkTap}
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
        <NavLink to="/session" className={linkClass} data-testid="nav-session">
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
          to="/statistics"
          className={linkClass}
          data-testid="nav-statistics"
        >
          {t("nav.statistics", "Statistics")}
        </NavLink>
        <NavLink to="/import" className={linkClass} data-testid="nav-import">
          {t("nav.import", "Import")}
        </NavLink>
        <NavLink to="/anki" className={linkClass} data-testid="nav-anki">
          {t("nav.anki", "Anki")}
        </NavLink>
        <NavLink to="/content" className={linkClass} data-testid="nav-content">
          {t("nav.content", "Content")}
        </NavLink>
        <NavLink to="/discover" className={linkClass} data-testid="nav-discover">
          {t("nav.discover", "Discover")}
        </NavLink>
        <NavLink
          to="/settings"
          className={linkClass}
          data-testid="nav-settings"
        >
          {t("nav.settings", "Settings")}
        </NavLink>
        {/* Help menu entry. Opens the HelpDrawer
                    in-place (no route change) on the glossary
                    entry that describes the CURRENT view
                    (helpKeyForPath), falling back to the
                    broadest concept when no view-specific entry
                    applies. The opened entry exposes
                    related-concept links to the rest of the
                    glossary. */}
        <Button
          variant="ghost"
          type="button"
          className="nav-link nav-link-button"
          data-testid="nav-help"
          onClick={() => {
            openHelp(helpKeyForPath(pathname));
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
        </Button>
      </div>
      <NavReviewsBadge />
      <NavXpBadge />
      <NavAvatar />
      <NavSyncIndicator paired={syncPaired} pendingCount={syncPending} />
      <NavOnlineIndicator online={online} />
      <NavThemeToggle theme={theme} tooltipsOn={tooltipsOn} onToggle={toggle} />
    </nav>
  );
}
