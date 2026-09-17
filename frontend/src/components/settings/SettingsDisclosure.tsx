/**
 * SettingsDisclosure (#2959) - a collapsible block inside a Settings card.
 *
 * A shadcn outline button (44px touch target, chevron + title,
 * ``aria-expanded`` / ``aria-controls``) above an optional hint line and
 * a body that is folded with the HTML ``hidden`` attribute. The children
 * stay MOUNTED while collapsed: deep links, ``data-testid`` selectors and
 * DOM-order pins (the #1459 Learning-tab order test walks hidden
 * descendants) keep working, exactly like the tab panels of the Settings
 * page itself.
 *
 * The open state is read once on mount from localStorage under
 * ``storageKey`` (through ``disclosurePref``, so a throwing storage falls
 * back to ``defaultOpen``) and written on every toggle - a per-viewer
 * convenience that survives a reload.
 *
 * Presentational and app-agnostic: no i18n (pass translated ``title`` /
 * ``hint``), no app state; only the shared Button + FormHint primitives.
 *
 * @example
 * <SettingsDisclosure
 *   title={t("settings.playful_details", "Game mode details")}
 *   hint={t("settings.playful_details_hint", "Hearts, countdown, ...")}
 *   storageKey="adaptive-learner.settings.playful_details_open"
 *   testid="settings-playful-details"
 * >
 *   <PlayfulTensionBlock disabled={!playful} />
 * </SettingsDisclosure>
 */

import { useId, useState } from "react";
import type { ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { readDisclosureOpen, writeDisclosureOpen } from "@/lib/settings/disclosurePref";
import FormHint from "@/shared/forms/FormHint";

export interface SettingsDisclosureProps {
  /** Button label (already translated). */
  title: ReactNode;
  /** Optional muted line under the button describing what the fold holds. */
  hint?: ReactNode;
  /** localStorage key the open state is remembered under. */
  storageKey: string;
  /** Initial state when nothing usable is stored. Default: collapsed. */
  defaultOpen?: boolean;
  /** Base ``data-testid``: the button gets ``<testid>-toggle``, the body ``<testid>-body``. */
  testid: string;
  /** The folded content - stays mounted while collapsed. */
  children: ReactNode;
}

export function SettingsDisclosure({
  title,
  hint,
  storageKey,
  defaultOpen = false,
  testid,
  children,
}: SettingsDisclosureProps) {
  const bodyId = useId();
  const [open, setOpen] = useState<boolean>(() => readDisclosureOpen(storageKey, defaultOpen));

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    writeDisclosureOpen(storageKey, next);
  };

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-11 justify-start gap-1.5 self-start px-2 font-medium"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={handleToggle}
        data-testid={`${testid}-toggle`}
      >
        {open ? (
          <ChevronDown aria-hidden="true" className="size-4" />
        ) : (
          <ChevronRight aria-hidden="true" className="size-4" />
        )}
        {title}
      </Button>
      {hint !== undefined && <FormHint>{hint}</FormHint>}
      <div
        id={bodyId}
        hidden={!open}
        className="flex flex-col gap-4"
        data-testid={`${testid}-body`}
      >
        {children}
      </div>
    </div>
  );
}
