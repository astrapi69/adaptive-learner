/**
 * MenuToggleButton — a generic hamburger / close icon button for a
 * collapsible menu or drawer.
 *
 * Fully presentational and app-agnostic: the open state, the accessible
 * label, and the optional `aria-controls` target all come via props, and
 * it imports nothing app-specific (only the shared `Button` primitive).
 * Renders the "close" icon (✕) when `open`, the "menu" icon (☰)
 * otherwise. Reusable in any responsive nav / sidebar / drawer.
 *
 * @example
 * const [open, setOpen] = useState(false);
 * <MenuToggleButton
 *   open={open}
 *   onToggle={() => setOpen((v) => !v)}
 *   label="Menu"
 *   controlsId="app-nav-links"
 *   testId="nav-hamburger"
 * />
 */

import { Menu, X } from "lucide-react";

import { Button } from "@/components/ui/button";

export interface MenuToggleButtonProps {
  /** Whether the controlled menu/drawer is currently open. */
  open: boolean;
  /** Toggle handler (the caller owns the open state). */
  onToggle: () => void;
  /** Accessible name; also the hover tooltip when `tooltip` is true. */
  label: string;
  /** Show `label` as a hover `title` tooltip. Defaults to false. */
  tooltip?: boolean;
  /** id of the element this button expands, for `aria-controls`. */
  controlsId?: string;
  /** Extra classes merged onto the button. */
  className?: string;
  /** `data-testid` for the button. */
  testId?: string;
}

/** Hamburger / close toggle for a collapsible menu or drawer. */
export default function MenuToggleButton({
  open,
  onToggle,
  label,
  tooltip = false,
  controlsId,
  className,
  testId,
}: MenuToggleButtonProps) {
  return (
    <Button
      variant="ghost"
      size="icon"
      type="button"
      className={className}
      data-testid={testId}
      aria-label={label}
      title={tooltip ? label : undefined}
      aria-expanded={open}
      aria-controls={controlsId}
      onClick={onToggle}
    >
      {open ? (
        <X size={20} aria-hidden="true" />
      ) : (
        <Menu size={20} aria-hidden="true" />
      )}
    </Button>
  );
}
