import LearningRepoSettingsSection from "../../../../components/settings/integrations/LearningRepoSettingsSection";

interface PluginsPanelProps {
  /** Whether the Plugins tab is the active tab (drives ``hidden``). */
  active: boolean;
}

/**
 * Plugins tab of the Settings page: the Learning-Repository plugin
 * settings. Extracted verbatim from the Settings god-file (#1447); the
 * gamification card moved into the Learning tab's motivation cluster
 * (#2962). Every panel stays mounted (``hidden`` when inactive) so deep
 * links and ``data-testid`` assertions keep working.
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
      <LearningRepoSettingsSection />
    </div>
  );
}
