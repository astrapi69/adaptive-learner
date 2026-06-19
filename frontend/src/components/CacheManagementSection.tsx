/**
 * S4 (PWA hardening) — offline cache management in Settings > Data.
 *
 * Shows the size + lesson count of the service worker's offline lesson
 * cache and lets the user clear it (two-step inline confirm — no browser
 * dialog). Added as a standalone section so it doesn't restructure the
 * existing Data tab (parallel-safe with the shadcn migration).
 *
 * Auto-cleanup is handled at the SW layer by Workbox ``expiration``
 * (max 500 entries / 90 days, LRU) configured on the S1 route — far more
 * robust than an app-side byte scan, so this surface is read + clear.
 */

import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "../hooks/ui/useI18n";
import {
  clearLessonCache,
  formatMegabytes,
  getCacheInfo,
  type CacheInfo,
} from "../lib/pwa/cache-info";

export default function CacheManagementSection() {
  const { t } = useI18n();
  const [info, setInfo] = useState<CacheInfo | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    void getCacheInfo().then(setInfo);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleClear = useCallback(async () => {
    setBusy(true);
    try {
      await clearLessonCache();
      toast.success(t("pwa.cache_cleared", "Offline cache cleared."));
      setConfirming(false);
      refresh();
    } finally {
      setBusy(false);
    }
  }, [t, refresh]);

  const empty = info !== null && info.lessonCount === 0 && info.bytes === 0;

  return (
    <section
      className="settings-section"
      data-testid="settings-section-cache"
    >
      <h2 className="settings-section-title">
        {t("pwa.cache_heading", "Offline cache")}
      </h2>
      <p className="muted" style={{ marginTop: 0 }} data-testid="cache-summary">
        {info === null
          ? "…"
          : empty
            ? t("pwa.cache_empty", "No offline content cached yet.")
            : t("pwa.cache_summary", "{size} MB · {count} lessons cached")
                .replace("{size}", formatMegabytes(info.bytes))
                .replace("{count}", String(info.lessonCount))}
      </p>

      {!confirming ? (
        <Button
          type="button"
          variant="secondary"
          className="min-h-[44px]"
          onClick={() => setConfirming(true)}
          disabled={empty || info === null}
          data-testid="cache-clear-button"
          aria-label={t("pwa.cache_clear", "Clear cache")}
          title={t("pwa.cache_clear", "Clear cache")}
        >
          <Trash2 className="h-5 w-5" aria-hidden="true" />
          <span className="hidden md:inline">
            {t("pwa.cache_clear", "Clear cache")}
          </span>
        </Button>
      ) : (
        <div
          role="group"
          aria-label={t("pwa.cache_clear_confirm", "Clear the offline cache?")}
          style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}
          data-testid="cache-clear-confirm"
        >
          <span className="muted">
            {t("pwa.cache_clear_confirm", "Clear the offline cache?")}
          </span>
          <Button
            type="button"
            variant="destructive"
            onClick={handleClear}
            disabled={busy}
            data-testid="cache-clear-confirm-button"
          >
            {t("pwa.cache_clear_action", "Yes, clear")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setConfirming(false)}
            disabled={busy}
            data-testid="cache-clear-cancel-button"
          >
            {t("common.cancel", "Cancel")}
          </Button>
        </div>
      )}
    </section>
  );
}
