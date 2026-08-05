/**
 * Shared navigation model for the Settings page (#546).
 *
 * One ``SidebarGroup[]`` data model drives BOTH the desktop sidebar
 * ({@link ../../components/settings/SettingsSidebar}) and the mobile
 * hamburger menu ({@link ../../components/settings/SettingsMobileMenu}),
 * so the two surfaces can never drift. Tabs that aren't available are
 * simply absent from the array (conditional presence via spread) — never
 * greyed out (FUNKTION-NICHT-VERFÜGBAR).
 *
 * "Can never drift" is enforced, not asserted: ``settings-nav-parity.test.tsx``
 * (#2344) renders BOTH renderers from one fixture and pins that each exposes
 * the same item ``value`` set (with a non-vacuity guard). The two surfaces do
 * NOT share a testid scheme — desktop uses {@link SidebarItem.testId}, mobile
 * derives ``settings-mobile-tab-${value}`` — so parity is keyed on ``value``,
 * the one field both renderers consume.
 */

/** A single navigable tab. */
export interface SidebarItem {
  /** Tab key, e.g. ``"learning"`` — drives ``?tab=`` + the panel. */
  value: string;
  /** Already-i18n-resolved label. */
  label: string;
  /**
   * ``data-testid`` for the DESKTOP item ({@link
   * ../../components/settings/SettingsSidebar}), e.g. ``settings-tab-learning``.
   * Desktop-only: the mobile menu ({@link
   * ../../components/settings/SettingsMobileMenu}) does NOT read this field — it
   * derives its own ``settings-mobile-tab-${value}`` from {@link value}.
   * Required because the desktop surface needs a stable per-item id; cross-
   * surface parity is keyed on {@link value}, never on this field (#2344).
   */
  testId: string;
}

/** A labelled group of tabs. */
export interface SidebarGroup {
  /** Stable group key (testid, React key). */
  key: string;
  items: SidebarItem[];
  /** Optional group header (uppercase, muted). Danger groups omit it. */
  label?: string;
  /** ``"danger"`` renders a divider + danger accent and no header. */
  variant?: "default" | "danger";
}

/** Props shared by both navigation surfaces. */
export interface SettingsNavProps {
  groups: SidebarGroup[];
  activeTab: string;
  onChange: (next: string) => void;
}
