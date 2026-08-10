/**
 * SettingsSidebar — the desktop (>768px) Settings navigation (#546).
 *
 * Pure + presentational: it takes the shared ``SidebarGroup[]`` model
 * plus the active tab and an ``onChange`` callback, and knows nothing
 * about routing or storage. A grouped ``<nav>`` with uppercase muted
 * group headers and full-width 44px buttons; the active item gets the
 * accent colour, bold weight, and ``aria-current="page"``. A
 * ``variant: "danger"`` group renders a divider + danger accent and no
 * header. Token-backed Tailwind throughout (theme-correct).
 *
 * Hidden below the 768px breakpoint (``hidden md:block``) — the mobile
 * surface is {@link SettingsMobileMenu}.
 *
 * @example
 * <SettingsSidebar groups={groups} activeTab={tab} onChange={setTab} />
 */

import { useI18n } from "../../hooks/ui/useI18n";
import type { SettingsNavProps } from "../../lib/settings/sidebar-model";
import { cn } from "@/lib/utils";

export default function SettingsSidebar({ groups, activeTab, onChange }: SettingsNavProps) {
  const { t } = useI18n();
  return (
    <nav
      className="hidden md:block md:sticky md:top-4 md:max-h-[calc(100vh-2rem)] md:overflow-y-auto"
      aria-label={t("settings.nav_aria", "Settings navigation")}
      data-testid="settings-tabs"
    >
      {groups.map((group) => (
        <div
          key={group.key}
          data-testid={`settings-group-${group.key}`}
          className={cn(
            "mb-4",
            group.variant === "danger" && "mt-2 border-t border-border pt-3",
          )}
        >
          {group.label && group.variant !== "danger" ? (
            <h2 className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-fg-secondary">
              {group.label}
            </h2>
          ) : null}
          <ul className="m-0 flex list-none flex-col">
            {group.items.map((item) => {
              const active = item.value === activeTab;
              return (
                <li key={item.value}>
                  <button
                    type="button"
                    onClick={() => onChange(item.value)}
                    aria-current={active ? "page" : undefined}
                    data-testid={item.testId}
                    className={cn(
                      "block w-full min-h-11 rounded-app border-0 py-2 pl-3 pr-2 text-left text-sm",
                      "indent-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                      "hover:bg-card",
                      group.variant === "danger" && "text-destructive",
                      active
                        ? "bg-card font-semibold text-accent"
                        : "text-fg-primary",
                    )}
                  >
                    {item.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
