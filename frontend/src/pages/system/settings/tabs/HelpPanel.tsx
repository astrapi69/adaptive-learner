import HelpBrowser from "../../../../components/help/HelpBrowser";

interface HelpPanelProps {
  /** Whether the Help tab is the active tab (drives ``hidden``). */
  active: boolean;
}

/**
 * Help tab of the Settings page: the glossary / article browser.
 * Extracted verbatim from the Settings god-file (#1447); the panel stays
 * mounted (``hidden`` when inactive) so deep links and ``data-testid``
 * assertions keep working.
 *
 * @example
 * <HelpPanel active={activeTab === "help"} />
 */
export default function HelpPanel({ active }: HelpPanelProps) {
  return (
    <div
      className="settings-tabpanel"
      role="tabpanel"
      hidden={!active}
      data-testid="settings-panel-help"
    >
      <HelpBrowser />
    </div>
  );
}
