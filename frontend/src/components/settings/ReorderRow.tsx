/**
 * ReorderRow / ReorderList - the numbered Up/Down list used by the Settings
 * reorder controls (lesson-summary sections, content tabs; #3027).
 *
 * One row layout for every reorder list, so the narrow-viewport behaviour
 * is decided once: the row is a wrapping flex line whose body slot claims a
 * minimum width (`basis-40`, 10rem) and grows into the rest; when the arrow
 * pair no longer fits beside it on a phone, the pair wraps under the body,
 * right-aligned, and the label keeps the full row width. Before #3027 the
 * label was squeezed into the leftover 60-100 px next to checkbox, number
 * and two 44 px buttons and `break-words` split every word. The arrows keep
 * their 44 px touch target in both arrangements.
 *
 * `ReorderList` is the `<ol>` shell: the app ships without Tailwind
 * preflight, so a bare `<ol>` carries the user-agent 40 px indent; the shell
 * resets it because the rows render their own numbering.
 *
 * Presentational and props-driven: no app imports besides the shared
 * `Button`, no i18n inside (the caller passes the translated button names),
 * token-backed Tailwind utilities only.
 */
import { ArrowDown, ArrowUp } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

export interface ReorderListProps {
  /** `data-testid` on the `<ol>`. */
  testid: string;
  /** The `ReorderRow`s, in display order. */
  children: ReactNode;
}

/**
 * The `<ol>` shell of a reorder list: vertical flex column, list indent and
 * markers removed (the rows carry their own numbers).
 *
 * @example
 * ```tsx
 * <ReorderList testid="content-tabs-order-list">
 *   {order.map((id, index) => (
 *     <ReorderRow key={id} index={index} count={order.length} ... />
 *   ))}
 * </ReorderList>
 * ```
 */
export function ReorderList({ testid, children }: ReorderListProps) {
  return (
    <ol className="m-0 flex list-none flex-col gap-2 pl-0" data-testid={testid}>
      {children}
    </ol>
  );
}

export interface ReorderRowProps {
  /** Zero-based position of the row in its list. */
  index: number;
  /** Number of rows; Up is disabled at 0, Down at `count - 1`. */
  count: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  /** Accessible name + tooltip of the Up arrow (already translated). */
  moveUpLabel: string;
  /** Accessible name + tooltip of the Down arrow (already translated). */
  moveDownLabel: string;
  /** `data-testid`s for the `<li>` and the two arrow buttons. */
  testids: { item: string; up: string; down: string };
  /** Dimmed look for a row that is listed but switched off. */
  muted?: boolean;
  /** Row content: number, label, an optional checkbox - the body slot. */
  children: ReactNode;
}

/**
 * One row of a reorder list: a wrapping flex line with the body slot first
 * and the Up/Down arrow pair last.
 *
 * @example
 * ```tsx
 * <ReorderRow
 *   index={index}
 *   count={order.length}
 *   onMoveUp={() => move(id, -1)}
 *   onMoveDown={() => move(id, 1)}
 *   moveUpLabel={t("content_repo.action.move_up", "Move up")}
 *   moveDownLabel={t("content_repo.action.move_down", "Move down")}
 *   testids={{ item: `row-${id}`, up: `up-${id}`, down: `down-${id}` }}
 * >
 *   <span className="text-fg-muted">{index + 1}.</span>
 *   {label}
 * </ReorderRow>
 * ```
 */
export function ReorderRow({
  index,
  count,
  onMoveUp,
  onMoveDown,
  moveUpLabel,
  moveDownLabel,
  testids,
  muted = false,
  children,
}: ReorderRowProps) {
  return (
    <li
      data-testid={testids.item}
      className={`flex flex-wrap items-center gap-2 rounded-app border border-border bg-bg-elevated px-3 py-2${
        muted ? " opacity-60" : ""
      }`}
    >
      <div className="flex min-h-11 min-w-0 flex-1 basis-40 items-center gap-2 text-sm font-medium text-fg-primary">
        {children}
      </div>
      <span className="ml-auto flex shrink-0 gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11"
          onClick={onMoveUp}
          disabled={index === 0}
          aria-label={moveUpLabel}
          title={moveUpLabel}
          data-testid={testids.up}
        >
          <ArrowUp className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11"
          onClick={onMoveDown}
          disabled={index === count - 1}
          aria-label={moveDownLabel}
          title={moveDownLabel}
          data-testid={testids.down}
        >
          <ArrowDown className="h-4 w-4" aria-hidden="true" />
        </Button>
      </span>
    </li>
  );
}
