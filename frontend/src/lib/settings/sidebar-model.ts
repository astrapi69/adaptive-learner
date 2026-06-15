/**
 * Shared navigation model for the Settings page (#546).
 *
 * One ``SidebarGroup[]`` data model drives BOTH the desktop sidebar
 * ({@link ../../components/settings/SettingsSidebar}) and the mobile
 * hamburger menu ({@link ../../components/settings/SettingsMobileMenu}),
 * so the two surfaces can never drift. Tabs that aren't available are
 * simply absent from the array (conditional presence via spread) — never
 * greyed out (FUNKTION-NICHT-VERFÜGBAR).
 */

/** A single navigable tab. */
export interface SidebarItem {
  /** Tab key, e.g. ``"learning"`` — drives ``?tab=`` + the panel. */
  value: string;
  /** Already-i18n-resolved label. */
  label: string;
  /** ``data-testid`` for the desktop item, e.g. ``settings-tab-learning``. */
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
