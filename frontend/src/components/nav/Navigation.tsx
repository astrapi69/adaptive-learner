import { HelpCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router";

import { Button } from "@/components/ui/button";
import MenuToggleButton from "../../shared/layout/MenuToggleButton";
import NavGroup from "./NavGroup";
import NavXpBadge from "./NavXpBadge";
import NavReviewsBadge from "./NavReviewsBadge";
import NavAvatar from "./NavAvatar";
import { NavModeBadge, NavThemeToggle } from "./NavIndicators";
import { HELP_TARGET, NAV_GROUPS, navTargetsByGroup } from "./nav-targets";

import { useHelp } from "../../contexts/HelpContext";
import { helpKeyForPath } from "../../lib/help/help-routes";
import { useAppMode } from "../../hooks/settings/useAppMode";
import { useButtonTooltips } from "../../hooks/settings/useButtonTooltips";
import { useDevMode } from "../../hooks/settings/useDevMode";
import { useDialogFocus } from "../../hooks/ui/useDialogFocus";
import { useI18n } from "../../hooks/ui/useI18n";
import { useIsLessonActive } from "../../hooks/lesson/session/useIsLessonActive";
import { useMediaQuery } from "../../hooks/ui/useMediaQuery";
import { useScrollDirection } from "../../hooks/ui/useScrollDirection";
import { useTheme } from "../../hooks/ui/useTheme";
import { isDarkTheme } from "../../lib/theme/themes";

/**
 * The media conditions under which the top bar collapses behind the
 * hamburger drawer (#1390). Mirrors the two global.css blocks that style the
 * drawer: the mobile breakpoint (``max-width: 768px`` — the established
 * top-bar collapse boundary) and the
 * short-landscape phone case. Lesson-compact mode ORs in separately via
 * ``useIsLessonActive`` (any width). Keep in sync with global.css.
 */
export const COMPACT_NAV_MEDIA_QUERY =
  "(max-width: 768px), (orientation: landscape) and (max-height: 600px)";

/**
 * Top navigation bar. Rendered on every authenticated page
 * (Dashboard / Session / Progress / Settings) and hidden on the
 * pre-onboarding routes (Landing, Onboarding, Assessment) so the
 * funnel stays focused.
 *
 * One primary navigation per viewport class (#1390, Option A):
 * - Desktop (above the breakpoint): the horizontal link row is the
 *   primary nav; NO hamburger and NO drawer exist in the DOM.
 * - Mobile (at/below the breakpoint) + lesson-compact + short-landscape:
 *   the hamburger + drawer is the primary nav; the SAME links container
 *   renders as the drawer (CSS drives the layout).
 * Both variants render from the shared {@link NAV_TARGETS} model, so the
 * route set can never diverge (pinned by the parity test).
 *
 * The #891/#1260 desktop sidebar (a second desktop primary nav behind a
 * burger) was removed with #1390 — do not reintroduce a desktop drawer.
 */
export default function Navigation() {
  const { t } = useI18n();
  const tooltipsOn = useButtonTooltips();
  const devMode = useDevMode();
  const { ready: modeReady, mode } = useAppMode();
  const { theme, toggle } = useTheme();
  const { openHelp } = useHelp();
  const HIDE_ON: readonly string[] = ["/", "/onboarding", "/assessment"];
  const { pathname } = useLocation();
  // During an active lesson the nav collapses to a minimal
  // hamburger-only bar (the links live behind the drawer) so the
  // lesson reclaims vertical space. CSS drives the actual layout
  // off the ``is-lesson-compact`` modifier.
  const lessonActive = useIsLessonActive();
  // #1390 — drawer mode is a RENDER gate, not just CSS: at desktop widths
  // (outside lesson-compact) the hamburger + drawer are not in the DOM at
  // all, so the top bar is the only primary navigation.
  const compactViewport = useMediaQuery(COMPACT_NAV_MEDIA_QUERY);
  const drawerNav = compactViewport || lessonActive;
  // Auto-hide the sticky nav while reading a lesson: scrolling DOWN
  // slides it up out of view (more content space), scrolling UP (or
  // reaching the top) reveals it again. Only during active lessons,
  // and never while the menu drawer is open. The slide is a CSS
  // transform transition (``-translate-y-full`` + ``transition-
  // transform``) so it respects ``prefers-reduced-motion``.
  const scrollDir = useScrollDirection();
  const [menuOpen, setMenuOpen] = useState(false);
  const navHidden = lessonActive && !menuOpen && scrollDir === "down";

  // Collapse the drawer whenever the route changes — the back-button
  // backstop. A fresh page should never inherit the previous page's
  // drawer state. NOTE: this alone is NOT enough (#666) — a tap on a
  // link to the route the user is ALREADY on doesn't change ``pathname``,
  // so the drawer would stay open. The per-link onClick below covers it.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // #1390 — leaving drawer mode (viewport grows / lesson ends) resets the
  // open state so it can't leak into the inline variant or a later drawer.
  useEffect(() => {
    if (!drawerNav) setMenuOpen(false);
  }, [drawerNav]);

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

  // #1400 — while the drawer is open it is modal for the keyboard: the
  // shared useDialogFocus hook (#515, same pattern as the Settings mobile
  // menu #546) moves focus to the first drawer entry on open, cycles
  // Tab / Shift+Tab inside the drawer, and restores focus to the burger
  // on close. Gated on drawer mode so the inline desktop row (same DOM
  // node) never traps.
  const linksRef = useRef<HTMLDivElement>(null);
  useDialogFocus(linksRef, { open: menuOpen && drawerNav });

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
                pins margin-left:0 explicitly. The old conflicting
                `.nav-hamburger { margin-left: auto }` in global.css was
                removed in #1583 (dead, since this always-present `ml-0!`
                already won), which let that block wrap into @layer
                legacy. Rendered ONLY in drawer mode (#1390) — on desktop
                it does not exist in the DOM. */}
      {drawerNav && (
        <MenuToggleButton
          open={menuOpen}
          onToggle={() => setMenuOpen((v) => !v)}
          label={t("nav.menu", "Menu")}
          tooltip={tooltipsOn}
          controlsId="app-nav-links"
          className="nav-hamburger ml-0!"
          testId="nav-hamburger"
        />
      )}
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
            "Developer Mode is on - error toasts show full technical detail. Toggle in Settings.",
          )}
          aria-label={t(
            "nav.dev_badge_tooltip",
            "Developer Mode is on - error toasts show full technical detail. Toggle in Settings.",
          )}
        >
          {t("nav.dev_badge", "DEV")}
        </NavLink>
      )}
      {modeReady && <NavModeBadge mode={mode} />}
      {/* One links container, two presentations: inline row on desktop,
          hamburger drawer in drawer mode (CSS keys off the media queries /
          ``is-lesson-compact``; ``data-variant`` exposes the mode to tests).
          The entries come from the shared NAV_TARGETS model — group order
          LERNEN, INHALTE, FORTSCHRITT, then the flat Settings + Help
          utility entries (EXP-037 #850 / #856 / #1129 / #1149). */}
      <div
        id="app-nav-links"
        ref={linksRef}
        className={`nav-links${menuOpen ? " is-open" : ""}`}
        data-testid="nav-links"
        data-variant={drawerNav ? "drawer" : "inline"}
        onClick={closeMenuOnLinkTap}
      >
        {NAV_GROUPS.map((group) => (
          <NavGroup
            key={group.id}
            label={t(group.labelKey, group.labelFallback)}
            testId={`nav-group-${group.id}`}
            hideLabel
          >
            {navTargetsByGroup(group.id).map((target) => (
              <NavLink
                key={target.to}
                to={target.to}
                className={linkClass}
                data-testid={target.testId}
              >
                {t(target.labelKey, target.labelFallback)}
              </NavLink>
            ))}
          </NavGroup>
        ))}
        {navTargetsByGroup("utility").map((target) => (
          <NavLink
            key={target.to}
            to={target.to}
            className={linkClass}
            data-testid={target.testId}
          >
            {t(target.labelKey, target.labelFallback)}
          </NavLink>
        ))}
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
          data-testid={HELP_TARGET.testId}
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
          {t(HELP_TARGET.labelKey, HELP_TARGET.labelFallback)}
        </Button>
      </div>
      <NavReviewsBadge />
      <NavXpBadge />
      <NavAvatar />
      <NavThemeToggle theme={theme} tooltipsOn={tooltipsOn} onToggle={toggle} />
    </nav>
  );
}
