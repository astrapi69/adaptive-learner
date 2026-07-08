import GitHubIntegrationSection from "../../../../components/settings/integrations/GitHubIntegrationSection";

interface IntegrationsPanelProps {
  /** Whether the Integrations tab is the active tab (drives ``hidden``). */
  active: boolean;
}

/**
 * Integrations tab of the Settings page: the GitHub integration
 * (server-side PAT for community PRs). Extracted verbatim from the
 * Settings god-file (#1447); the panel stays mounted (``hidden`` when
 * inactive) so deep links and ``data-testid`` assertions keep working.
 *
 * @example
 * <IntegrationsPanel active={activeTab === "integrations"} />
 */
export default function IntegrationsPanel({ active }: IntegrationsPanelProps) {
  return (
    <div
      className="settings-tabpanel"
      role="tabpanel"
      hidden={!active}
      data-testid="settings-panel-integrations"
    >
      <GitHubIntegrationSection />
    </div>
  );
}
