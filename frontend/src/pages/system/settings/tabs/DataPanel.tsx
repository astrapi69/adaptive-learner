import { Monitor } from "lucide-react";

import IdentitySection from "../../../../components/about/IdentitySection";
import BackupSection from "../../../../components/settings/backup/BackupSection";
import CacheManagementSection from "../../../../components/settings/data/CacheManagementSection";
import OrphanedDataSection from "../../../../components/settings/data/OrphanedDataSection";
import InstallAppSection from "../../../../components/settings/data/InstallAppSection";
import ContentRepoSettingsSection from "../../../../components/settings/integrations/ContentRepoSettingsSection";
import DangerZoneSection from "../../../../components/settings/data/DangerZoneSection";
import ExportSection from "../../../../components/settings/data/ExportSection";
import KeyVaultSection from "../../../../components/settings/data/KeyVaultSection";
import SelectiveExportSection from "../../../../components/settings/data/SelectiveExportSection";
import SyncSection from "../../../../components/sync/SyncSection";
import { Feature } from "@astrapi69/feature-strategy-react";
import { FEATURES } from "../../../../features/featureConfig";
import { useI18n } from "../../../../hooks/ui/useI18n";
import { resolveStorageMode } from "../../../../storage";

interface DataPanelProps {
  /** Whether the Data tab is the active tab (drives ``hidden``). */
  active: boolean;
}

/**
 * Data tab of the Settings page: sync, backup, key vault, selective +
 * full export, identity, content repositories, orphaned-data cleanup,
 * cache management, install, and the danger zone. Extracted verbatim from
 * the Settings god-file (#1447); the panel stays mounted (``hidden`` when
 * inactive) so deep links and ``data-testid`` assertions keep working.
 *
 * @example
 * <DataPanel active={activeTab === "data"} />
 */
export default function DataPanel({ active }: DataPanelProps) {
  const { t } = useI18n();
  return (
    <div
      className="settings-tabpanel"
      role="tabpanel"
      hidden={!active}
      data-testid="settings-panel-data"
    >
      {/* Sync needs a reachable backend (pairing token + sync
          endpoints). In Dexie mode (GitHub Pages / PWA-only) there
          is none, so the controls are replaced by a notice that the
          desktop app carries the feature — visible, not hidden, per
          the feature-state policy (#335, supersedes #51). */}
      <Feature
        id={FEATURES.SYNC}
        whenDisabled={
          <section
            className="settings-section mt-6"
            data-testid="settings-sync-desktop-only"
          >
            <h2 className="settings-section-title">{t("settings.section_sync", "Sync")}</h2>
            <div className="flex items-start gap-2 rounded-app border border-border bg-card px-3 py-2 text-sm text-fg-secondary">
              <Monitor size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
              <span>
                {t("feature.desktop_only", "Only available with the desktop app.")}
              </span>
            </div>
          </section>
        }
      >
        <SyncSection />
      </Feature>
      <BackupSection />
      <KeyVaultSection />
      <Feature id={FEATURES.SELECTIVE_EXPORT}>
        <SelectiveExportSection />
      </Feature>
      <ExportSection />
      {resolveStorageMode() === "api" && <IdentitySection t={t} />}
      <ContentRepoSettingsSection />
      <OrphanedDataSection />
      <CacheManagementSection />
      <InstallAppSection />
      <DangerZoneSection />
    </div>
  );
}
