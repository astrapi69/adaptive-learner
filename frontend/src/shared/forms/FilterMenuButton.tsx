/**
 * FilterMenuButton — a single-select filter as ONE expandable menu button
 * (#1386): the trigger shows the active choice in its label
 * ("Status: Aktiv", "Quelle: Alle Quellen"); opening it lists the options
 * as ``menuitemradio`` entries with a check mark on the selected one.
 * Selecting an option applies it, closes the menu, and returns focus to
 * the trigger.
 *
 * Follows the app's menu-button pattern (the {@link SetActionsMenu}
 * mechanics, shared via {@link useMenuButtonBehavior}): portal to
 * ``document.body`` + fixed positioning (survives the ``#root`` clipping
 * container on iOS, #1349), ``aria-haspopup``/``aria-expanded`` on the
 * trigger, Escape/outside-click dismiss, ArrowUp/ArrowDown roving focus,
 * 44px touch targets. Deliberately NOT a native ``<select>`` (iOS tap
 * problem, #1342).
 *
 * Presentational and app-agnostic: options, value, and the change handler
 * come from the caller. Option testids are ``${testId}-${option.value}``
 * so existing per-option selectors keep working when a button group is
 * converted to this component.
 *
 * @example
 * <FilterMenuButton
 *   label={t("content.filter_menu.status", "Status")}
 *   options={[{value: "all", label: t("content.set_status.all", "All")}]}
 *   value="all"
 *   onChange={setStatusFilter}
 *   testId="content-status-filter"
 * />
 */

import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

import { useMenuButtonBehavior } from "../hooks/useMenuButtonBehavior";

export interface FilterMenuOption {
  value: string;
  label: string;
}

export interface FilterMenuButtonProps {
  /** The filter's name, shown before the active choice ("Status"). */
  label: string;
  options: FilterMenuOption[];
  /** The active option value. */
  value: string;
  onChange: (value: string) => void;
  /** Trigger testid; options render as ``${testId}-${value}``. */
  testId: string;
}

export default function FilterMenuButton({
  label,
  options,
  value,
  onChange,
  testId,
}: FilterMenuButtonProps) {
  const menu = useMenuButtonBehavior();
  const active = options.find((option) => option.value === value);

  return (
    <>
      <button
        ref={menu.triggerRef}
        type="button"
        className={`inline-flex min-h-11 items-center gap-1.5 rounded-app border bg-card px-3 text-sm font-medium text-fg-primary transition-colors hover:bg-[var(--bg-elevated)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
          menu.open ? "border-accent" : "border-border"
        }`}
        aria-haspopup="menu"
        aria-expanded={menu.open}
        onClick={(e) => {
          // Never let the tap bubble to surrounding click targets.
          e.stopPropagation();
          menu.toggle();
        }}
        data-testid={testId}
      >
        <span className="text-fg-muted">{label}:</span>
        <span data-testid={`${testId}-label`}>{active?.label ?? value}</span>
        <ChevronDown
          size={14}
          aria-hidden="true"
          className={`text-fg-muted transition-transform duration-150 ${
            menu.open ? "rotate-180" : ""
          }`}
        />
      </button>
      {menu.open &&
        menu.pos &&
        createPortal(
          // ``list-none m-0`` explicitly resets the browser list marker +
          // indent: this project imports Tailwind's utilities WITHOUT
          // preflight (styles/tailwind.css), so an un-reset portalled <ul>
          // otherwise shows disc bullets and a ~40px inline padding (#2498).
          <ul
            ref={menu.menuRef}
            role="menu"
            aria-label={label}
            style={{ position: "fixed", top: menu.pos.top, left: menu.pos.left }}
            className="z-50 m-0 min-w-52 max-w-[calc(100vw-1rem)] list-none rounded-app border border-border bg-card p-1.5 shadow-elevated"
            data-testid={`${testId}-menu`}
          >
            {options.map((option) => {
              const selected = option.value === value;
              return (
                <li key={option.value} role="none">
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={selected}
                    className={`flex min-h-10 w-full items-center gap-2 rounded-[calc(var(--radius-app)-3px)] px-2.5 py-2 text-left text-sm transition-colors focus-visible:outline-none ${
                      selected
                        ? "bg-[var(--bg-elevated)] font-medium text-fg-primary"
                        : "text-fg-primary hover:bg-[var(--bg-elevated)] focus-visible:bg-[var(--bg-elevated)]"
                    }`}
                    onClick={() => menu.choose(() => onChange(option.value))}
                    onKeyDown={menu.onItemKeyDown}
                    data-testid={`${testId}-${option.value}`}
                  >
                    <Check
                      size={15}
                      aria-hidden="true"
                      className={selected ? "text-accent" : "invisible"}
                    />
                    <span className="flex-1">{option.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>,
          document.body,
        )}
    </>
  );
}
