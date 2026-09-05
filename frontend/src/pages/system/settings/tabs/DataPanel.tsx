import { Monitor } from "lucide-react";

import IdentitySection from "../../../../components/about/IdentitySection";
import BackupSection from "../../../../components/settings/backup/BackupSection";
import CacheManagementSection from "../../../../components/settings/data/CacheManagementSection";
import OrphanedDataSection from "../../../../components/settings/data/OrphanedDataSection";
import ContentRepoSettingsSection from "../../../../components/settings/integrations/ContentRepoSettingsSection";
import RegistrySubmitSection from "../../../../components/settings/integrations/RegistrySubmitSection";
import DangerZoneSection from "../../../../components/settings/data/DangerZoneSection";
import ExportSection from "../../../../components/settings/data/ExportSection";
import { KeyVaultSection } from "@astrapi69/ai-key-vault-react";
import SelectiveExportSection from "../../../../components/settings/data/SelectiveExportSection";
import {
  MaxLessonSizeControl,
  PausedLessonsRetentionControl,
} from "../../../../components/settings/controls";
import SyncSection from "../../../../components/sync/SyncSection";
import { Feature } from "@astrapi69/feature-strategy-react";
import { FEATURES } from "../../../../features/featureConfig";
import { useI18n } from "../../../../hooks/ui/useI18n";
import { resolveStorageMode } from "../../../../storage";
import { SettingsSection } from "../../../../components/settings/SettingsSection";

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
 * 3b. Max lesson size (#2955): how a saved chat analysis becomes offline
 *    lessons - its only reader is ``SaveOfflineLessonModal``, which
 *    splits the analysis into parts of at most this many steps. It sits
 *    right after the cache those lessons land in.
 * 4. Backup / export (securing the work, incl. the read-only identity
 *    recovery-file diagnostic, a recovery concern)
 * 5a. Paused-lesson retention (#2955): the retention policy the
 *    Dashboard's paused-lessons card applies, placed right beside the
 *    cleanup it belongs with.
 * 5. Orphaned-data cleanup (#1445, reversible: only unusable data)
 * 6. Danger zone (delete everything) - irreversible, ALWAYS last, with a
 *    visual top-separation so its severity is obvious.
 *
 * 3b + 5a are the two rare-housekeeping cards #1459 parked on the
 * Learning tab; they are data-lifecycle settings, not lesson-flow ones.
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

      {/* 1b. Register your OWN repo for the federated cross-repo search
          (proposes a PR against the official content directory). */}
      <RegistrySubmitSection />

      {/* 2. Sync belongs with the sources it synchronizes. Needs a
          reachable backend (pairing token + sync endpoints); in Dexie
          mode (GitHub Pages / PWA-only) there is none, so the controls
          are replaced by a notice that the desktop app carries the
          feature - visible, not hidden, per the feature-state policy
          (#335, supersedes #51). */}
      <Feature
        id={FEATURES.SYNC}
        whenDisabled={
          <SettingsSection
            className="mt-6"
            testid="settings-sync-desktop-only"
            title={t("settings.section_sync", "Sync")}
          >
            <div className="flex items-start gap-2 rounded-app border border-border bg-card px-3 py-2 text-sm text-fg-secondary">
              <Monitor size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
              <span>
                {t("feature.desktop_only", "Only available with the desktop app.")}
              </span>
            </div>
          </SettingsSection>
        }
      >
        <SyncSection />
      </Feature>

      {/* 3. What results from the sources: the offline content cache.
          ("Install app" lives in the General tab, #1455.) */}
      <CacheManagementSection />

      {/* 3b. How a saved chat analysis becomes offline lessons (#2955):
          the split size SaveOfflineLessonModal applies. */}
      <MaxLessonSizeControl />

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

      {/* 5a. Retention policy beside the cleanup action (#2955): how long
          paused lessons are kept before they are abandoned. */}
      <PausedLessonsRetentionControl />

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
