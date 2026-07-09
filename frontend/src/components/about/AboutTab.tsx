/**
 * About tab parent (Phase 14B).
 *
 * Composes the five About sub-sections. Single source of system
 * data: fetches ``SystemInfo`` from the storage layer once on
 * mount; the ApiStorage path hits ``/api/system/info`` and the
 * DexieStorage path returns a synthesised payload, so the parent
 * doesn't branch on storage mode beyond the ``storageMode`` prop
 * passed down to ``SystemInfoSection``.
 */

import { useEffect, useState } from "react";

import { ApiError } from "../../api/client";
import { useI18n } from "../../hooks/ui/useI18n";
import { getStorage, resolveStorageMode } from "../../storage";
import type { SystemInfo } from "../../types/domain";

import ContributeSection from "./ContributeSection";
import CreditsSection from "./CreditsSection";
import DonationSection from "./DonationSection";
import ShareAppSection from "./ShareAppSection";
import LicenseResourcesSection from "./LicenseResourcesSection";
import SupportSection from "./SupportSection";
import StrangBadge from "./StrangBadge";
import SystemInfoSection from "./SystemInfoSection";
import VersionSection from "./VersionSection";

export default function AboutTab() {
  const { t, lang } = useI18n();
  const storageMode = resolveStorageMode();
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await getStorage().system.info();
        if (cancelled) return;
        setInfo(result);
      } catch (err) {
        if (cancelled) return;
        const detail = err instanceof ApiError ? err.detail : String(err);
        setError(detail);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section
      className="settings-section"
      data-testid="settings-about"
      style={{ marginTop: "1.5rem" }}
    >
      <h2 className="settings-section-title">
        {t("about.section_heading", "About Adaptive Learner")}
      </h2>
      {loading && (
        <p
          data-testid="about-loading"
          className="muted"
          style={{ padding: "1rem 0" }}
        >
          {t("about.loading", "Loading information…")}
        </p>
      )}
      {error && !info && (
        <p
          data-testid="about-error"
          role="alert"
          style={{ color: "var(--danger)", padding: "1rem 0" }}
        >
          {t("about.load_failed", "Could not load system info:")} {error}
        </p>
      )}
      {info && (
        <div
          data-testid="about-content"
          style={{ display: "flex", flexDirection: "column", gap: 16 }}
        >
          <StrangBadge t={t} />
          <VersionSection info={info} t={t} />
          <SystemInfoSection info={info} storageMode={storageMode} t={t} />
          <CreditsSection t={t} />
          <ShareAppSection t={t} />
          <DonationSection t={t} />
          <ContributeSection t={t} />
          <LicenseResourcesSection info={info} t={t} lang={lang} />
        </div>
      )}
      <SupportSection />
    </section>
  );
}
