import { Monitor } from "lucide-react";
import { useRef } from "react";
import type { CSSProperties } from "react";

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
import {
  DATA_SECTIONS,
  dataSectionAnchorId,
  isDataSectionId,
} from "../../../../lib/settings/data-sections";
import type { DataSectionId } from "../../../../lib/settings/data-sections";
import { resolveStorageMode } from "../../../../storage";
import { SettingsCluster } from "../../../../components/settings/SettingsCluster";
import { SettingsSection } from "../../../../components/settings/SettingsSection";
import SettingsSubNav from "../../../../components/settings/SettingsSubNav";
import { useSettingsAnchorOffset } from "./useSettingsAnchorOffset";
import { useTabSections } from "./useTabSections";

interface DataPanelProps {
  /** Whether the Data tab is the active tab (drives ``hidden``). */
  active: boolean;
}

/**
 * Data tab of the Settings page: twelve cards in six labelled clusters
 * (#3122, the Data-tab twin of the Learning tab's #2956/#2961 layout),
 * each a ``SettingsCluster`` landmark, in the FIXED causal order #1451
 * established: source -> what happens with it -> what results -> securing
 * -> reversible cleanup -> irreversible danger zone:
 *
 * 1. Sources: content repositories (the source everything else acts on)
 *    and the registry entry for your own repo.
 * 2. Sync: belongs with the sources it synchronizes. Needs a reachable
 *    backend; in Dexie mode the controls are replaced by a notice that the
 *    desktop app carries the feature - visible, not hidden (#335).
 * 3. Offline content: the lesson cache ("Install app" moved to the General
 *    tab in #1455) and the max lesson size (#2955) that shapes the offline
 *    lessons landing in it.
 * 4. Backup and export: backup, the read-only identity recovery-file
 *    diagnostic (API mode only), the key vault, selective + full export.
 * 5. Housekeeping: the paused-lesson retention policy (#2955) beside the
 *    reversible orphaned-data cleanup (#1445).
 * 6. Danger zone: delete everything - irreversible, ALWAYS last, with a
 *    visual top-separation so its severity is obvious.
 *
 * The order is deliberately not configurable: a fixed position is what
 * makes a settings page citable, and a movable danger zone would be a
 * safety hazard. Cluster membership and in-cluster order are pinned by
 * Settings.test.tsx (#1451, #2955); the panel stays mounted (``hidden``
 * when inactive) so deep links and ``data-testid`` assertions keep
 * working (#1447).
 *
 * A section bar above the clusters (``SettingsSubNav``) jumps between
 * them and mirrors ``?tab=data&section=<id>``: the deep link scrolls the
 * cluster into view once the panel is visible, a chip click writes the
 * param with replace-state, the Settings shell drops the param on a tab
 * switch, and the scroll-spy moves the active chip with the viewport
 * (#2966). The bar is sticky on ``md+`` below the app header; the measured
 * offset of both strips feeds the clusters' ``scroll-margin-top`` through
 * ``--settings-anchor-offset``. The key-vault jumps from the AI tab
 * (``openKeyExport`` / ``openKeyImport``, #1183 / #1773) keep their own
 * deferred scroll in the Settings shell and are unaffected.
 *
 * @example
 * <DataPanel active={activeTab === "data"} />
 */
export default function DataPanel({ active }: DataPanelProps) {
  const { t } = useI18n();
  const subNavRef = useRef<HTMLElement>(null);
  const { stickyTop, anchorOffset } = useSettingsAnchorOffset(subNavRef);
  const { activeSection, openSection } = useTabSections<DataSectionId>({
    active,
    sections: DATA_SECTIONS,
    isSectionId: isDataSectionId,
    anchorId: dataSectionAnchorId,
    topOffset: anchorOffset,
  });
  const cluster = (id: DataSectionId, fallbackTitle: string, fallbackDesc: string) => ({
    id,
    anchorPrefix: "data",
    testid: `settings-cluster-data-${id}`,
    title: t(`settings.cluster_data_${id}`, fallbackTitle),
    description: t(`settings.cluster_data_${id}_desc`, fallbackDesc),
  });

  return (
    <div
      className="settings-tabpanel"
      role="tabpanel"
      hidden={!active}
      data-testid="settings-panel-data"
      style={{ "--settings-anchor-offset": `${anchorOffset}px` } as CSSProperties}
    >
      <SettingsSubNav
        ref={subNavRef}
        items={DATA_SECTIONS.map((section) => ({
          id: section.id,
          label: t(section.labelKey, section.fallback),
        }))}
        activeId={activeSection}
        onSelect={openSection}
        ariaLabel={t("settings.data_nav_aria", "Data sections")}
        stickyTop={stickyTop}
      />

      {/* 1. Source: the content repositories everything else acts on, and
          the registry entry for your OWN repo (federated cross-repo search). */}
      <SettingsCluster
        {...cluster("sources", "Sources", "Content repositories and your entry in the directory.")}
      >
        <ContentRepoSettingsSection />
        <RegistrySubmitSection />
      </SettingsCluster>

      {/* 2. Sync belongs with the sources it synchronizes. In Dexie mode
          (GitHub Pages / PWA-only) there is no backend, so the controls are
          replaced by a notice that the desktop app carries the feature -
          visible, not hidden, per the feature-state policy (#335). */}
      <SettingsCluster {...cluster("sync", "Sync", "Pair devices and keep data in step.")}>
        <Feature
          id={FEATURES.SYNC}
          whenDisabled={
            <SettingsSection
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
      </SettingsCluster>

      {/* 3. What results from the sources: the offline content cache
          ("Install app" lives in the General tab, #1455) and the split size
          SaveOfflineLessonModal applies to a saved chat analysis (#2955). */}
      <SettingsCluster
        {...cluster("offline", "Offline content", "The lesson cache and the size of saved lessons.")}
      >
        <CacheManagementSection />
        <MaxLessonSizeControl />
      </SettingsCluster>

      {/* 4. Securing the work: backup, the identity recovery-file
          diagnostic (a recovery concern, API-mode only), key export,
          selective + full export. */}
      <SettingsCluster
        {...cluster("backup", "Backup and export", "Backup, identity, keys and exports.")}
      >
        <BackupSection />
        {resolveStorageMode() === "api" && <IdentitySection t={t} />}
        <KeyVaultSection />
        <Feature id={FEATURES.SELECTIVE_EXPORT}>
          <SelectiveExportSection />
        </Feature>
        <ExportSection />
      </SettingsCluster>

      {/* 5. Retention policy beside the reversible cleanup (#2955, #1445). */}
      <SettingsCluster
        {...cluster("cleanup", "Housekeeping", "Retention of paused lessons and orphaned data.")}
      >
        <PausedLessonsRetentionControl />
        <OrphanedDataSection />
      </SettingsCluster>

      {/* 6. Irreversible danger zone, always last, visually separated so
          its severity is unmistakable. */}
      <SettingsCluster {...cluster("danger", "Danger zone", "Irreversible: delete everything.")}>
        <div className="mt-8 border-t-2 border-border pt-8">
          <DangerZoneSection />
        </div>
      </SettingsCluster>
    </div>
  );
}
