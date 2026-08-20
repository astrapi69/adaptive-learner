/**
 * useAskAiVisible (#2693).
 *
 * Returns whether the "Ask AI" button (``AskAiPanel``) is shown in
 * lessons, re-reading live when the preference changes in this tab
 * (via ``ASK_AI_VISIBILITY_CHANGE_EVENT``) or another tab (native
 * ``storage`` event). The Settings toggle takes effect without a
 * reload.
 */

import { useEffect, useState } from "react";

import {
  ASK_AI_VISIBILITY_CHANGE_EVENT,
  readAskAiVisible,
} from "../../../lib/lesson/askAiVisibilityPref";

export function useAskAiVisible(): boolean {
  const [visible, setVisible] = useState<boolean>(() => readAskAiVisible());

  useEffect(() => {
    const refresh = () => setVisible(readAskAiVisible());

    window.addEventListener(ASK_AI_VISIBILITY_CHANGE_EVENT, refresh);
    window.addEventListener("storage", refresh);

    // Pick up any change between the initial useState and mount.
    refresh();

    return () => {
      window.removeEventListener(ASK_AI_VISIBILITY_CHANGE_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return visible;
}
