import AboutTab from "../../../../components/about/AboutTab";

interface AboutPanelProps {
  /** Whether the About tab is the active tab (drives ``hidden``). */
  active: boolean;
}

/**
 * About tab of the Settings page: version / system / credits / license.
 * Extracted verbatim from the Settings god-file (#1447); the panel stays
 * mounted (``hidden`` when inactive) so deep links and ``data-testid``
 * assertions keep working.
 *
 * @example
 * <AboutPanel active={activeTab === "about"} />
 */
export default function AboutPanel({ active }: AboutPanelProps) {
  return (
    <div
      className="settings-tabpanel"
      role="tabpanel"
      hidden={!active}
      data-testid="settings-panel-about"
    >
      <AboutTab />
    </div>
  );
}
