import { Monitor } from "lucide-react";

import IdentitySection from "../../../../components/about/IdentitySection";
import BackupSection from "../../../../components/settings/backup/BackupSection";
import CacheManagementSection from "../../../../components/settings/data/CacheManagementSection";
import OrphanedDataSection from "../../../../components/settings/data/OrphanedDataSection";
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
 * Data tab of the Settings page.
 *
 * The sections follow a FIXED causal order (#1451), not the historical
 * grab-bag: source -> what happens with it -> what results -> securing ->
 * reversible cleanup -> irreversible danger zone:
 *
 * 1. Content repositories (the source that everything else acts on)
 * 2. Sync (belongs with the sources it synchronizes)
 * 3. Offline cache (what results from the sources; "Install app" moved
 *    to the General tab in #1455 - it configures HOW the app runs, not
 *    WHAT it stores)
 * 4. Backup / export (securing the work, incl. the read-only identity
 *    recovery-file diagnostic, a recovery concern)
 * 5. Orphaned-data cleanup (#1445, reversible: only unusable data)
 * 6. Danger zone (delete everything) - irreversible, ALWAYS last, with a
 *    visual top-separation so its severity is obvious.
 *
 * The order is deliberately not configurable: a fixed position is what
 * makes a settings page citable, and a movable danger zone would be a
 * safety hazard. The panel stays mounted (``hidden`` when inactive) so
 * deep links and ``data-testid`` assertions keep working (#1447).
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
      {/* 1. Source: the content repositories everything else acts on. */}
      <ContentRepoSettingsSection />

      {/* 2. Sync belongs with the sources it synchronizes. Needs a
          reachable backend (pairing token + sync endpoints); in Dexie
          mode (GitHub Pages / PWA-only) there is none, so the controls
          are replaced by a notice that the desktop app carries the
          feature - visible, not hidden, per the feature-state policy
          (#335, supersedes #51). */}
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

      {/* 3. What results from the sources: the offline content cache.
          ("Install app" lives in the General tab, #1455.) */}
      <CacheManagementSection />

      {/* 4. Securing the work: backup, the identity recovery-file
          diagnostic (a recovery concern, API-mode only), key export,
          selective + full export. */}
      <BackupSection />
      {resolveStorageMode() === "api" && <IdentitySection t={t} />}
      <KeyVaultSection />
      <Feature id={FEATURES.SELECTIVE_EXPORT}>
        <SelectiveExportSection />
      </Feature>
      <ExportSection />

      {/* 5. Reversible cleanup: orphaned progress from removed repos (#1445). */}
      <OrphanedDataSection />

      {/* 6. Irreversible danger zone, always last, visually separated so
          its severity is unmistakable. */}
      <div className="mt-8 border-t-2 border-border pt-8">
        <DangerZoneSection />
      </div>
    </div>
  );
}
