/**
 * useMenuButtonBehavior — the shared mechanics of the app's WAI-ARIA
 * menu-button pattern (#1386), extracted from {@link SetActionsMenu} (#1300 /
 * #1349) so every menu button shares ONE implementation instead of copies:
 *
 *  - open state + a ``fixed`` position anchored to the trigger's rect (the
 *    menu is rendered through a portal to ``document.body`` — ``#root`` is a
 *    deliberate clipping/scroll container, so a non-portal absolute overlay
 *    is clipped / mis-positioned on iOS, see #1349);
 *  - re-anchoring on scroll/resize while open;
 *  - dismiss on an outside pointer-down and on Escape (which restores focus
 *    to the trigger);
 *  - ArrowUp/ArrowDown roving focus across the rendered menu items.
 *
 * App-agnostic and render-free: the consumer renders its own trigger + menu
 * (any item roles — ``menuitem`` / ``menuitemradio``) and wires the returned
 * refs/handlers. NEVER a native ``<select>`` — the documented iOS tap
 * problem behind the menu-button pattern (#1342).
 *
 * @example
 * const menu = useMenuButtonBehavior();
 * <button ref={menu.triggerRef} aria-haspopup="menu" aria-expanded={menu.open}
 *         onClick={menu.toggle}>…</button>
 * {menu.open && menu.pos && createPortal(
 *   <ul ref={menu.menuRef} role="menu"
 *       style={{position: "fixed", top: menu.pos.top, left: menu.pos.left}}>
 *     <li role="none"><button role="menuitemradio"
 *       onKeyDown={menu.onItemKeyDown} onClick={() => menu.choose(apply)} /></li>
 *   </ul>, document.body)}
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

/** The trigger-anchored fixed position of the open menu. */
export interface MenuButtonPosition {
  top: number;
  /** Distance from the LEFT viewport edge (left-aligned menus). */
  left: number;
  /** Distance from the RIGHT viewport edge (right-aligned menus). */
  right: number;
}

export interface MenuButtonBehavior {
  open: boolean;
  /** ``null`` until the first layout pass after opening. */
  pos: MenuButtonPosition | null;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  menuRef: React.RefObject<HTMLUListElement | null>;
  /** Toggle from the trigger's onClick. */
  toggle: () => void;
  /** Close without choosing (e.g. after a caller-side dismiss). */
  close: () => void;
  /** Run a menu item's action and close the menu. */
  choose: (action: () => void) => void;
  /** ArrowUp/ArrowDown roving focus for ``role="menuitem*"`` buttons. */
  onItemKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>) => void;
}

/** Shared open/position/dismiss/keyboard behaviour of a menu button. */
export function useMenuButtonBehavior(): MenuButtonBehavior {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<MenuButtonPosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);

  const reposition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPos({
      top: rect.bottom + 4,
      left: Math.max(8, rect.left),
      right: Math.max(8, window.innerWidth - rect.right),
    });
  }, []);

  useLayoutEffect(() => {
    if (open) reposition();
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return;
    // Dismiss on a pointer outside BOTH the trigger and the portalled menu
    // (the menu is not a DOM descendant of the trigger's container).
    const onDocPointer = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    // Keep the menu anchored to the trigger while the page scrolls/resizes.
    const onReflow = () => reposition();
    document.addEventListener("mousedown", onDocPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onReflow, true);
    window.addEventListener("resize", onReflow);
    return () => {
      document.removeEventListener("mousedown", onDocPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onReflow, true);
      window.removeEventListener("resize", onReflow);
    };
  }, [open, reposition]);

  const onItemKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      const items = Array.from(
        menuRef.current?.querySelectorAll<HTMLButtonElement>(
          '[role^="menuitem"]',
        ) ?? [],
      );
      const i = items.indexOf(e.currentTarget);
      if (e.key === "ArrowDown") {
        e.preventDefault();
        items[(i + 1) % items.length]?.focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        items[(i - 1 + items.length) % items.length]?.focus();
      }
    },
    [],
  );

  const toggle = useCallback(() => setOpen((v) => !v), []);
  const close = useCallback(() => setOpen(false), []);
  const choose = useCallback((action: () => void) => {
    setOpen(false);
    action();
  }, []);

  return { open, pos, triggerRef, menuRef, toggle, close, choose, onItemKeyDown };
}
