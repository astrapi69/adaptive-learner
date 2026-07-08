import GamificationSettingsSection from "../../../../components/settings/controls/motivation/GamificationSettingsSection";
import LearningRepoSettingsSection from "../../../../components/settings/integrations/LearningRepoSettingsSection";

interface PluginsPanelProps {
  /** Whether the Plugins tab is the active tab (drives ``hidden``). */
  active: boolean;
}

/**
 * Plugins tab of the Settings page: gamification + Learning-Repository
 * plugin settings. Extracted verbatim from the Settings god-file (#1447);
 * every panel stays mounted (``hidden`` when inactive) so deep links and
 * ``data-testid`` assertions keep working.
 *
 * @example
 * <PluginsPanel active={activeTab === "plugins"} />
 */
export default function PluginsPanel({ active }: PluginsPanelProps) {
  return (
    <div
      className="settings-tabpanel"
      role="tabpanel"
      hidden={!active}
      data-testid="settings-panel-plugins"
    >
      <GamificationSettingsSection />
      <LearningRepoSettingsSection />
    </div>
  );
}
