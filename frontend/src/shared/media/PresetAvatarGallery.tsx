/**
 * PresetAvatarGallery (#2848).
 *
 * A row of preset figure avatars the user can pick instead of
 * uploading a photo. Presentational and props-driven: the parent
 * owns persistence (``onSelect`` receives the preset's data URL,
 * the same string shape an upload produces) - see
 * ``GeneralPanel.handleAvatarChange``.
 *
 * The active preset is derived by comparing ``value`` against
 * each preset's deterministic data URL, so an uploaded photo
 * simply leaves every option unpressed.
 *
 * @param value - The current ``UserSettings.avatar`` value.
 * @param onSelect - Called with the chosen preset's data URL.
 * @param title - Localized group heading.
 * @param optionLabels - Localized accessible name per preset id.
 * @param disabled - Blocks selection while a save is in flight.
 *
 * @example
 * <PresetAvatarGallery value={settings.avatar}
 *     onSelect={(dataUrl) => save(dataUrl)} />
 */

import {
    PRESET_AVATARS,
    presetAvatarDataUrl,
} from "../../lib/avatar/preset-avatars";

export interface PresetAvatarGalleryProps {
    value: string | null;
    onSelect: (dataUrl: string) => void;
    title?: string;
    optionLabels?: Partial<Record<string, string>>;
    disabled?: boolean;
}

export default function PresetAvatarGallery({
    value,
    onSelect,
    title,
    optionLabels,
    disabled = false,
}: PresetAvatarGalleryProps) {
    return (
        <div
            className="flex flex-col gap-2"
            data-testid="settings-avatar-presets"
        >
            <span className="text-[0.95rem] font-medium">
                {title ?? "Or pick a figure"}
            </span>
            <div className="flex flex-wrap gap-2">
                {PRESET_AVATARS.map((preset) => {
                    const dataUrl = presetAvatarDataUrl(preset.id);
                    const active = value === dataUrl;
                    const label = optionLabels?.[preset.id] ?? preset.id;
                    return (
                        <button
                            key={preset.id}
                            type="button"
                            aria-pressed={active}
                            aria-label={label}
                            title={label}
                            disabled={disabled}
                            onClick={() => onSelect(dataUrl)}
                            data-testid={`settings-avatar-preset-${preset.id}`}
                            className={`m-0 rounded-full border-2 p-0.5 leading-none transition-colors ${
                                active
                                    ? "border-[var(--accent)]"
                                    : "border-transparent hover:border-[var(--border-strong)]"
                            } ${disabled ? "opacity-60" : "cursor-pointer"}`}
                        >
                            <img
                                src={dataUrl}
                                alt=""
                                aria-hidden="true"
                                className="block size-12 rounded-full"
                            />
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
