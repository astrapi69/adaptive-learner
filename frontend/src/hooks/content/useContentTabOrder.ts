/**
 * useContentTabOrder (#1378).
 *
 * Live-reads the configured "Inhalte" tab order. Re-reads when the preference
 * changes in this tab (``CONTENT_TAB_ORDER_CHANGE_EVENT``) or another tab
 * (native ``storage`` event), so the Settings reorder takes effect without a
 * reload.
 */

import { useEffect, useState } from "react";

import {
  CONTENT_TAB_ORDER_CHANGE_EVENT,
  readContentTabOrder,
  type ContentTabId,
} from "../../lib/content/contentTabOrderPref";

export function useContentTabOrder(): ContentTabId[] {
  const [order, setOrder] = useState<ContentTabId[]>(() =>
    readContentTabOrder(),
  );

  useEffect(() => {
    const refresh = () => setOrder(readContentTabOrder());
    window.addEventListener(CONTENT_TAB_ORDER_CHANGE_EVENT, refresh);
    window.addEventListener("storage", refresh);
    refresh();
    return () => {
      window.removeEventListener(CONTENT_TAB_ORDER_CHANGE_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return order;
}
