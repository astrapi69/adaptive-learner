/**
 * ContentTabsOrderControl — Settings → General control to reorder the three
 * "Inhalte" tabs (Entdecken / Meine Inhalte / Importieren) (#1378).
 *
 * A plain ordered list with Up/Down buttons per row (no drag-and-drop framework
 * for three entries — same pattern as the content-repo precedence reorder).
 * The first entry becomes the initial active tab of the Content area. Persists
 * via ``lib/content/contentTabOrderPref`` (typed ordered array, localStorage,
 * both storage modes). Token-backed Tailwind, 44px touch targets.
 */

import { ArrowDown, ArrowUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "../../../../hooks/ui/useI18n";
import FormHint from "../../../../shared/forms/FormHint";
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
  };

  const move = (id: ContentTabId, direction: -1 | 1) => {
    setContentTabOrder(moveContentTab(order, id, direction));
  };

  return (
    <section
      className="settings-section"
      data-testid="settings-section-content-tabs"
    >
      <h2 className="settings-section-title">
        {t("settings.section_content_tabs", "Content tabs order")}
      </h2>
      <FormHint className="mb-2">
        {t(
          "settings.content_tabs_desc",
          "Choose the order of the tabs in the Content area. The first tab opens by default.",
        )}
      </FormHint>
      <ol className="flex flex-col gap-2" data-testid="content-tabs-order-list">
        {order.map((id, index) => (
          <li
            key={id}
            data-testid={`content-tabs-order-item-${id}`}
            className="flex items-center justify-between gap-2 rounded-app border border-border bg-bg-elevated px-3 py-2"
          >
            <span className="text-sm font-medium text-fg-primary">
              <span className="mr-2 text-fg-muted">{index + 1}.</span>
              {labels[id]}
            </span>
            <span className="flex gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11"
                onClick={() => move(id, -1)}
                disabled={index === 0}
                aria-label={t("content_repo.action.move_up", "Move up")}
                title={t("content_repo.action.move_up", "Move up")}
                data-testid={`content-tabs-up-${id}`}
              >
                <ArrowUp className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11"
                onClick={() => move(id, 1)}
                disabled={index === order.length - 1}
                aria-label={t("content_repo.action.move_down", "Move down")}
                title={t("content_repo.action.move_down", "Move down")}
                data-testid={`content-tabs-down-${id}`}
              >
                <ArrowDown className="h-4 w-4" aria-hidden="true" />
              </Button>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
