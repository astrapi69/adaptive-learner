/**
 * ContentTabsOrderControl — Settings → General control to reorder the
 * "Inhalte" tabs (#1378). The tab set itself lives in
 * ``lib/content/contentTabOrderPref``; this control renders whatever is in
 * there rather than a list of its own, so a new tab (#3006 added Erstellen)
 * shows up here without touching this file.
 *
 * A plain ordered list with Up/Down buttons per row (no drag-and-drop framework
 * at this size); the rows are the shared ``ReorderRow`` (#3027), whose arrow
 * pair wraps under the label on a phone instead of squeezing it. The first
 * entry becomes the initial active tab of the Content area. Persists via
 * ``lib/content/contentTabOrderPref`` (typed ordered array, localStorage,
 * both storage modes). Token-backed Tailwind, 44px touch targets.
 */

import { useI18n } from "../../../../hooks/ui/useI18n";
import FormHint from "../../../../shared/forms/FormHint";
import { ReorderList, ReorderRow } from "../../ReorderRow";
import { SettingsSection } from "../../SettingsSection";
import { useContentTabOrder } from "../../../../hooks/content/useContentTabOrder";
import {
  moveContentTab,
  setContentTabOrder,
  type ContentTabId,
} from "../../../../lib/content/contentTabOrderPref";

export default function ContentTabsOrderControl() {
  const { t } = useI18n();
  const order = useContentTabOrder();

  const labels: Record<ContentTabId, string> = {
    discover: t("discover.tab.discover", "Discover"),
    my: t("nav.content", "My content"),
    import: t("discover.tab.import", "Import"),
    create: t("content.tab.create", "Create"),
  };

  const move = (id: ContentTabId, direction: -1 | 1) => {
    setContentTabOrder(moveContentTab(order, id, direction));
  };

  return (
    <SettingsSection
      title={t("settings.section_content_tabs", "Content tabs order")}
      testid="settings-section-content-tabs"
    >
      <FormHint className="mb-2">
        {t(
          "settings.content_tabs_desc",
          "Choose the order of the tabs in the Content area. The first tab opens by default.",
        )}
      </FormHint>
      <ReorderList testid="content-tabs-order-list">
        {order.map((id, index) => (
          <ReorderRow
            key={id}
            index={index}
            count={order.length}
            onMoveUp={() => move(id, -1)}
            onMoveDown={() => move(id, 1)}
            moveUpLabel={t("content_repo.action.move_up", "Move up")}
            moveDownLabel={t("content_repo.action.move_down", "Move down")}
            testids={{
              item: `content-tabs-order-item-${id}`,
              up: `content-tabs-up-${id}`,
              down: `content-tabs-down-${id}`,
            }}
          >
            <span className="mr-1 shrink-0 text-fg-muted">{index + 1}.</span>
            <span className="min-w-0 break-words">{labels[id]}</span>
          </ReorderRow>
        ))}
      </ReorderList>
    </SettingsSection>
  );
}
