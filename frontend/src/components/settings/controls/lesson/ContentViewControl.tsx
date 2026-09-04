/**
 * ContentViewControl (#1257).
 *
 * Settings > Appearance control for the GLOBAL content-view preference
 * (list / grid). Reads and writes the same {@link useContentViewMode}
 * source as the in-tab quick-toggle, so the two stay in lockstep (a
 * change here flips the in-tab toggle live, and vice-versa, via the
 * pref-change event — no reload). Two mutually-exclusive radio options;
 * default is list (#1257).
 */

import { useContentViewMode } from "../../../../hooks/content/useContentViewMode";
import type { ContentViewMode } from "../../../../lib/content/browse/prefs/viewModePref";
import { useI18n } from "../../../../hooks/ui/useI18n";
import FormHint from "../../../../shared/forms/FormHint";

const MODES: ContentViewMode[] = ["list", "grid"];

export default function ContentViewControl() {
  const { t } = useI18n();
  const [mode, setMode] = useContentViewMode();

  const labelFor = (m: ContentViewMode): string =>
    m === "list"
      ? t("content.view.list", "List view")
      : t("content.view.grid", "Grid view");

  return (
    <fieldset
      className="m-0 flex flex-col gap-2 border-none p-0"
      data-testid="settings-content-view"
    >
      <legend className="text-[0.95rem] font-medium">
        {t("settings.content_view", "Content view")}
      </legend>
      <FormHint as="span">
        {t(
          "settings.content_view_description",
          "How downloaded content is shown across the content tabs. The quick toggle in the content view changes the same setting.",
        )}
      </FormHint>
      <div className="feedback-intensity-options">
        {MODES.map((m) => (
          <label key={m} className="feedback-intensity-option">
            <input
              type="radio"
              name="content-view"
              value={m}
              checked={mode === m}
              onChange={() => setMode(m)}
              data-testid={`settings-content-view-${m}`}
            />
            <span className="feedback-intensity-option-text">
              <span className="text-[0.95rem] font-medium">{labelFor(m)}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
