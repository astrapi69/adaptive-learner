/**
 * content/contentTabOrderPref — the user-configurable order of the three
 * "Inhalte" tabs (Entdecken / Meine Inhalte / Importieren) (#1378).
 *
 * Persisted as ONE typed value — an ordered array of tab IDs — in localStorage
 * (works in both storage modes, same pattern as the other lesson/feedback
 * prefs). Default = today's order, so nothing changes unless the user reorders.
 *
 * Robust by construction: {@link sanitizeContentTabOrder} drops unknown IDs,
 * removes duplicates, and appends any missing known tab at the end, so a stored
 * value written by a future/older build (or hand-edited) can never yield an
 * empty tab bar or a crash — it always resolves to a full, valid order.
 */

export type ContentTabId = "discover" | "my" | "import";

/** The canonical (default) order. */
export const DEFAULT_CONTENT_TAB_ORDER: ContentTabId[] = [
  "discover",
  "my",
  "import",
];

const KEY = "adaptive-learner.content.tab_order";

export const CONTENT_TAB_ORDER_CHANGE_EVENT =
  "adaptive-learner:content-tab-order";

const KNOWN: ReadonlySet<ContentTabId> = new Set(DEFAULT_CONTENT_TAB_ORDER);

function isKnown(value: unknown): value is ContentTabId {
  return typeof value === "string" && KNOWN.has(value as ContentTabId);
}

/**
 * Coerce an arbitrary stored value into a complete, valid tab order:
 * keep known IDs in their stored order (deduped), then append any known tab
 * that was missing, in the default order. A non-array / empty / all-unknown
 * value yields the full default order.
 */
export function sanitizeContentTabOrder(raw: unknown): ContentTabId[] {
  const seen = new Set<ContentTabId>();
  const result: ContentTabId[] = [];
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (isKnown(item) && !seen.has(item)) {
        seen.add(item);
        result.push(item);
      }
    }
  }
  for (const id of DEFAULT_CONTENT_TAB_ORDER) {
    if (!seen.has(id)) result.push(id);
  }
  return result;
}

function notifyChange(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CONTENT_TAB_ORDER_CHANGE_EVENT));
  }
}

/** Read the configured tab order (always a full, valid order). */
export function readContentTabOrder(): ContentTabId[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) return [...DEFAULT_CONTENT_TAB_ORDER];
    return sanitizeContentTabOrder(JSON.parse(raw));
  } catch {
    return [...DEFAULT_CONTENT_TAB_ORDER];
  }
}

/** Persist a tab order (sanitized first) and notify open surfaces. */
export function setContentTabOrder(order: ContentTabId[]): void {
  const clean = sanitizeContentTabOrder(order);
  try {
    localStorage.setItem(KEY, JSON.stringify(clean));
  } catch {
    /* no-op */
  }
  notifyChange();
}

/**
 * Pure helper: return a new order with the tab at ``id`` moved by ``direction``
 * (-1 up, +1 down). Out-of-range moves return the input order unchanged.
 */
export function moveContentTab(
  order: ContentTabId[],
  id: ContentTabId,
  direction: -1 | 1,
): ContentTabId[] {
  const index = order.indexOf(id);
  const target = index + direction;
  if (index === -1 || target < 0 || target >= order.length) return order;
  const next = [...order];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
