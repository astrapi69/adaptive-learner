/**
 * ThemePicker (Phase 58E).
 *
 * Settings > General > Appearance control. A radiogroup of preview
 * cards — one per theme plus an "Auto (System)" option that follows
 * the OS prefers-color-scheme. Switching is instant (CSS variable swap
 * via data-theme; no reload). The choice is persisted by useTheme
 * under ``adaptive-learner.theme``.
 *
 * Built on native same-name radios (like FeedbackIntensityControl) so
 * arrow-key navigation, group semantics, and focus are accessible for
 * free; the visible card is the radio's label. Preview swatch colors
 * come from the themes registry (data), not from hardcoded literals.
 */

import {useI18n} from "../hooks/useI18n";
import {useTheme} from "../hooks/useTheme";
import {THEMES, type ThemeChoice} from "../lib/themes";

/** Mini "dashboard" preview rendered inside each card. */
function ThemeSwatch({
    bg,
    surface,
    accent,
    fg,
}: {
    bg: string;
    surface: string;
    accent: string;
    fg: string;
}) {
    return (
        <span
            className="theme-card-preview"
            aria-hidden="true"
            style={{background: bg}}
        >
            <span className="theme-card-mini" style={{background: surface}}>
                <span className="theme-card-accent" style={{background: accent}} />
                <span className="theme-card-line" style={{background: fg}} />
                <span
                    className="theme-card-line theme-card-line-short"
                    style={{background: fg}}
                />
            </span>
        </span>
    );
}

export default function ThemePicker() {
    const {t} = useI18n();
    const {choice, setChoice} = useTheme();
    const light = THEMES[0].swatch;
    const dark = THEMES[1].swatch;

    const renderCard = (
        id: ThemeChoice,
        label: string,
        preview: React.ReactNode,
    ) => (
        <label
            key={id}
            className="theme-card"
            data-active={choice === id ? "true" : undefined}
        >
            <input
                type="radio"
                name="app-theme"
                className="sr-only"
                value={id}
                checked={choice === id}
                onChange={() => setChoice(id)}
                data-testid={`settings-theme-${id}`}
            />
            {preview}
            <span className="theme-card-label">{label}</span>
        </label>
    );

    return (
        <fieldset
            className="form-row form-row-fieldset"
            data-testid="settings-theme-picker"
        >
            <legend className="form-label">{t("settings.theme", "Theme")}</legend>
            <span className="form-hint">
                {t(
                    "settings.theme_description",
                    "Choose how the app looks. Auto follows your system light/dark setting.",
                )}
            </span>
            <div className="theme-picker-grid" role="presentation">
                {renderCard(
                    "auto",
                    t("ui.themes.auto", "Auto (System)"),
                    <span
                        className="theme-card-preview theme-card-preview-split"
                        aria-hidden="true"
                    >
                        <span style={{background: light.bg}} />
                        <span style={{background: dark.bg}} />
                    </span>,
                )}
                {THEMES.map((meta) =>
                    renderCard(
                        meta.id,
                        t(`ui.themes.${meta.id}`, meta.label),
                        <ThemeSwatch {...meta.swatch} />,
                    ),
                )}
            </div>
        </fieldset>
    );
}
