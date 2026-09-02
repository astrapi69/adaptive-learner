/**
 * PresetAvatarPicker (#2862) - the preset-figure gallery plus the
 * photo-safety net around it. Choosing a figure while an UPLOADED
 * photo is active asks first (ConfirmDialog) and parks the photo in
 * the ``avatar-photo-stash``; a "restore photo" action brings it
 * back while the slot is filled. Figure-to-figure switches never
 * ask - only a real photo is worth guarding.
 *
 * The parent owns persistence (``onSave`` receives the avatar value
 * to store, exactly like ``GeneralPanel.handleAvatarChange``) and
 * clears the stash once a real photo is active again; this
 * component re-reads the stash on the profile signal, so both sides
 * stay in sync without prop threading.
 */

import {useEffect, useReducer, useState} from "react";

import {useI18n} from "../../../../hooks/ui/useI18n";
import ConfirmDialog from "../../../../shared/feedback/ConfirmDialog";
import PresetAvatarGallery from "../../../../shared/media/PresetAvatarGallery";
import {Button} from "@/components/ui/button";
import {
    readStashedAvatarPhoto,
    stashAvatarPhoto,
} from "../../../../lib/avatar/avatar-photo-stash";
import {isPresetAvatarDataUrl} from "../../../../lib/avatar/preset-avatars";
import {PROFILE_UPDATED_EVENT} from "../../../../lib/learning/profileSignal";

export interface PresetAvatarPickerProps {
    userId: string;
    /** The current ``UserSettings.avatar`` value. */
    avatar: string | null;
    /** Blocks selection while a save is in flight. */
    busy?: boolean;
    /** Persist the given avatar value (preset data URL or restored photo). */
    onSave: (dataUrl: string) => void;
}

export default function PresetAvatarPicker({
    userId,
    avatar,
    busy = false,
    onSave,
}: PresetAvatarPickerProps) {
    const {t} = useI18n();
    const [pendingPreset, setPendingPreset] = useState<string | null>(null);
    const [, bump] = useReducer((x: number) => x + 1, 0);

    useEffect(() => {
        const refresh = () => bump();
        window.addEventListener(PROFILE_UPDATED_EVENT, refresh);
        return () =>
            window.removeEventListener(PROFILE_UPDATED_EVENT, refresh);
    }, []);

    const stashedPhoto = readStashedAvatarPhoto(userId);
    const hasUploadedPhoto = !!avatar && !isPresetAvatarDataUrl(avatar);

    const handleSelect = (dataUrl: string) => {
        if (hasUploadedPhoto) {
            setPendingPreset(dataUrl);
            return;
        }
        onSave(dataUrl);
    };

    const handleConfirm = () => {
        const preset = pendingPreset;
        setPendingPreset(null);
        if (!preset || !avatar) return;
        stashAvatarPhoto(userId, avatar);
        bump();
        onSave(preset);
    };

    return (
        <>
            <PresetAvatarGallery
                value={avatar}
                title={t("settings.avatar_presets_title", "Or pick a figure")}
                optionLabels={{
                    spark: t("settings.avatar_preset_spark", "Spark"),
                    robot: t("settings.avatar_preset_robot", "Robot"),
                    star: t("settings.avatar_preset_star", "Star"),
                    cat: t("settings.avatar_preset_cat", "Cat"),
                    owl: t("settings.avatar_preset_owl", "Owl"),
                    ghost: t("settings.avatar_preset_ghost", "Ghost"),
                    bolt: t("settings.avatar_preset_bolt", "Lightning"),
                    heart: t("settings.avatar_preset_heart", "Heart"),
                }}
                disabled={busy}
                onSelect={handleSelect}
            />
            {stashedPhoto && stashedPhoto !== avatar && (
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="self-start"
                    disabled={busy}
                    onClick={() => onSave(stashedPhoto)}
                    data-testid="settings-avatar-restore-photo"
                >
                    {t("settings.avatar_restore_photo", "Restore photo")}
                </Button>
            )}
            <ConfirmDialog
                open={pendingPreset !== null}
                title={t(
                    "settings.avatar_replace_photo_title",
                    "Replace your photo?",
                )}
                message={t(
                    "settings.avatar_replace_photo_message",
                    "Your uploaded photo will be replaced by the figure. It stays cached and you can restore it anytime.",
                )}
                confirmLabel={t(
                    "settings.avatar_replace_photo_confirm",
                    "Use figure",
                )}
                cancelLabel={t("common.cancel", "Cancel")}
                onConfirm={handleConfirm}
                onCancel={() => setPendingPreset(null)}
                testId="settings-avatar-replace-dialog"
            />
        </>
    );
}
