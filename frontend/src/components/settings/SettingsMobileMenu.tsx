/**
 * SettingsMobileMenu — the mobile (≤768px) Settings navigation (#546).
 *
 * A custom hamburger control (AL has no Radix): a trigger showing a menu
 * icon + the active tab label, opening an anchored popover (not a
 * fullscreen overlay / drawer) listing the same shared ``SidebarGroup[]``
 * model the desktop sidebar uses. The popover closes on item select,
 * outside click, and Escape; the active item carries a check icon;
 * focus is trapped via the shared {@link useDialogFocus} hook and
 * returns to the trigger on close. Token-backed Tailwind, CSS fade-in,
 * shown only below the 768px breakpoint (``md:hidden``).
 *
 * @example
 * <SettingsMobileMenu groups={groups} activeTab={tab} onChange={setTab} />
 */

import { useEffect, useRef, useState } from "react";
import { Check, Menu } from "lucide-react";

import { useI18n } from "../../hooks/useI18n";
import { useDialogFocus } from "../../hooks/useDialogFocus";
import type { SettingsNavProps } from "../../lib/settings/sidebar-model";
import { cn } from "@/lib/utils";

export default function SettingsMobileMenu({ groups, activeTab, onChange }: SettingsNavProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useDialogFocus(popoverRef, { open });

  const activeLabel =
    groups.flatMap((g) => g.items).find((i) => i.value === activeTab)?.label ??
    t("settings.title", "Settings");

  // Fade-in: mount at opacity-0, flip on the next frame.
  useEffect(() => {
    if (!open) {
      setVisible(false);
      return;
    }
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, [open]);

  // Close on outside click + Escape while open. Uses ``pointerdown``
  // (not ``mousedown``): iOS Safari fires pointer events reliably for
  // touch, so a tap on the header closes the menu on the FIRST touch
  // instead of the tap being swallowed (#593).
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: Event) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function select(value: string) {
    onChange(value);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative mb-4 md:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        data-testid="settings-mobile-trigger"
        className="flex w-full min-h-11 items-center gap-2 rounded-app border border-border bg-card px-3 py-2 text-left text-sm font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <Menu size={18} aria-hidden="true" />
        <span className="text-fg-secondary">{t("settings.nav_aria", "Settings navigation")}:</span>
        <span className="font-semibold">{activeLabel}</span>
      </button>

      {open ? (
        <div
          ref={popoverRef}
          role="menu"
          aria-label={t("settings.nav_aria", "Settings navigation")}
          data-testid="settings-mobile-menu"
          className={cn(
            "absolute left-0 right-0 top-full z-[2100] mt-1 max-h-[70vh] overflow-y-auto",
            "rounded-app border border-border bg-card p-2 shadow-lg",
            "transition-opacity duration-100 ease-out",
            visible ? "opacity-100" : "opacity-0",
          )}
        >
          {groups.map((group, gi) => (
            <div
              key={group.key}
              className={cn(gi > 0 && "mt-1 border-t border-border pt-1")}
            >
              {group.label && group.variant !== "danger" ? (
                <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-fg-secondary">
                  {group.label}
                </p>
              ) : null}
              {group.items.map((item) => {
                const active = item.value === activeTab;
                return (
                  <button
                    key={item.value}
                    type="button"
                    role="menuitem"
                    onClick={() => select(item.value)}
                    aria-current={active ? "page" : undefined}
                    data-testid={`settings-mobile-tab-${item.value}`}
                    className={cn(
                      "flex w-full min-h-11 items-center gap-2 rounded-app px-2 py-2 text-left text-sm",
                      "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring hover:bg-bg-elevated",
                      group.variant === "danger" && "text-destructive",
                      active ? "font-semibold text-accent" : "text-fg-primary",
                    )}
                  >
                    <Check
                      size={16}
                      aria-hidden="true"
                      className={active ? "opacity-100" : "opacity-0"}
                    />
                    {item.label}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
