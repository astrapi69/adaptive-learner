/**
 * useSetSelection (#1351) — multi-select state for "Meine Inhalte".
 *
 * A small ``Set<string>`` of selection keys (``${source}#${id}``) plus the
 * toggle / select-all / clear operations and a tri-state master value, the
 * same lightweight pattern ``SelectiveExportSection`` uses. Kept generic
 * (keys are opaque strings) so both the list and tile views can drive it.
 */

import { useCallback, useMemo, useState } from "react";

export type MasterState = boolean | "indeterminate";

export interface SetSelection {
  /** The selected keys. */
  selected: Set<string>;
  /** How many are selected. */
  count: number;
  isSelected: (key: string) => boolean;
  toggle: (key: string) => void;
  /** Replace the selection with exactly ``keys`` (e.g. select-all over the
   *  currently visible/filtered set), or clear when already all-selected. */
  selectAll: (keys: string[]) => void;
  clear: () => void;
  /** Tri-state value for a "select all" master checkbox over ``keys``. */
  masterState: (keys: string[]) => MasterState;
}

export function useSetSelection(): SetSelection {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = useCallback((key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const selectAll = useCallback((keys: string[]) => {
    setSelected((prev) => {
      const allChosen = keys.length > 0 && keys.every((k) => prev.has(k));
      return allChosen ? new Set() : new Set(keys);
    });
  }, []);

  const clear = useCallback(() => setSelected(new Set()), []);

  const isSelected = useCallback((key: string) => selected.has(key), [selected]);

  const masterState = useCallback(
    (keys: string[]): MasterState => {
      const chosen = keys.filter((k) => selected.has(k)).length;
      if (chosen === 0) return false;
      if (chosen === keys.length) return true;
      return "indeterminate";
    },
    [selected],
  );

  return useMemo(
    () => ({ selected, count: selected.size, isSelected, toggle, selectAll, clear, masterState }),
    [selected, isSelected, toggle, selectAll, clear, masterState],
  );
}
