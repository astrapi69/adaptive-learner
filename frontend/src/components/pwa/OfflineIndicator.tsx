import { useEffect, useRef, useState } from "react";
import { WifiOff, X } from "lucide-react";

import { useI18n } from "../../hooks/ui/useI18n";
import { useOnlineStatus } from "../../hooks/system/useOnlineStatus";

/**
 * S2 (PWA hardening) — offline status banner.
 *
 * Sits below the nav bar, above page content (mounted in App.tsx). It
 * INFORMS, never blocks: all Dexie-mode content keeps working offline.
 *
 * - Offline: a dismissable amber bar ("You're offline. Saved content is
 *   available.").
 * - Reconnect: a green "Back online!" flash for 2s, then auto-hides.
 *   Going offline again re-shows the bar even if previously dismissed.
 *
 * Colours come from the theme tokens (--warning* / --success*) via
 * inline ``var(...)`` so all 6 themes recolor automatically; layout is
 * Tailwind utilities. ``role="status"`` + ``aria-live="polite"`` so the
 * state change is announced without stealing focus.
 */
const ONLINE_FLASH_MS = 2000;

export default function OfflineIndicator() {
  const { t } = useI18n();
  const online = useOnlineStatus();
  const [dismissed, setDismissed] = useState(false);
  const [showOnlineFlash, setShowOnlineFlash] = useState(false);
  const wasOnline = useRef(online);

  useEffect(() => {
    if (wasOnline.current === false && online === true) {
      // Just reconnected — flash "Back online!" briefly.
      setShowOnlineFlash(true);
      setDismissed(false);
      wasOnline.current = online;
      const timer = window.setTimeout(
        () => setShowOnlineFlash(false),
        ONLINE_FLASH_MS,
      );
      return () => window.clearTimeout(timer);
    }
    if (online === false) {
      // Fresh offline transition — re-show even if previously dismissed.
      setDismissed(false);
    }
    wasOnline.current = online;
  }, [online]);

  if (online) {
    if (!showOnlineFlash) return null;
    return (
      <div
        role="status"
        aria-live="polite"
        data-testid="online-flash"
        className="flex items-center justify-center gap-2 px-4 py-1.5 text-sm font-medium"
        style={{
          background: "var(--success-bg)",
          color: "var(--success)",
          borderBottom: "1px solid var(--success)",
        }}
      >
        {t("pwa.online_message", "Back online!")}
      </div>
    );
  }

  if (dismissed) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="offline-indicator"
      className="flex items-center gap-2 px-4 py-1.5 text-sm"
      style={{
        background: "var(--warning-bg)",
        color: "var(--warning)",
        borderBottom: "1px solid var(--warning)",
      }}
    >
      <WifiOff size={15} aria-hidden="true" className="shrink-0" />
      <span className="flex-1">
        {t(
          "pwa.offline_message",
          "You're offline. Saved content is available.",
        )}
      </span>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label={t("pwa.offline_dismiss", "Dismiss")}
        data-testid="offline-indicator-dismiss"
        className="shrink-0 rounded p-0.5 hover:opacity-70"
        style={{ color: "var(--warning)" }}
      >
        <X size={15} aria-hidden="true" />
      </button>
    </div>
  );
}
