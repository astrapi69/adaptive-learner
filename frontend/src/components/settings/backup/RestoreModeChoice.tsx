import type {RestoreMode} from "../../../types/domain";

type Translate = (key: string, fallback?: string) => string;

interface RestoreModeChoiceProps {
    /** The chosen mode. */
    mode: RestoreMode;
    onChange: (mode: RestoreMode) => void;
    /** The backup was made by another learner profile. A reset is then not
     *  offered, and the reason is shown (#3787, decision 2026-11-26). */
    foreignOwner: boolean;
    disabled?: boolean;
    t: Translate;
}

const OPTION_CLASS =
    "flex cursor-pointer items-start gap-2 rounded-md border border-border p-3 has-[:checked]:border-accent has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60";

/**
 * How a backup is applied (#3787): merged, which adds and deletes nothing,
 * or as a reset, after which the device is exactly as in the backup. The
 * merge is the choice a learner gets without doing anything.
 *
 * @example
 * <RestoreModeChoice mode={mode} onChange={setMode} foreignOwner={false} t={t} />
 */
export function RestoreModeChoice({
    mode,
    onChange,
    foreignOwner,
    disabled = false,
    t,
}: RestoreModeChoiceProps) {
    return (
        <fieldset
            className="m-0 flex flex-col gap-2 border-0 p-0"
            data-testid="backup-restore-mode"
        >
            <legend className="mb-1 p-0 text-sm font-semibold text-fg-primary">
                {t("backup.restore_mode_label", "How should the backup be applied?")}
            </legend>
            <label className={OPTION_CLASS}>
                <input
                    type="radio"
                    name="backup-restore-mode"
                    className="mt-1 size-4 shrink-0"
                    checked={mode === "merge"}
                    disabled={disabled}
                    onChange={() => onChange("merge")}
                    data-testid="backup-restore-mode-merge"
                />
                <span className="flex flex-col">
                    <span className="text-sm font-medium text-fg-primary">
                        {t("backup.restore_mode_merge", "Merge")}
                    </span>
                    <span className="text-sm text-fg-secondary">
                        {t(
                            "backup.restore_mode_merge_hint",
                            "Adds what this device lacks and deletes nothing. Something you deleted after the backup comes back.",
                        )}
                    </span>
                </span>
            </label>
            <label className={OPTION_CLASS}>
                <input
                    type="radio"
                    name="backup-restore-mode"
                    className="mt-1 size-4 shrink-0"
                    checked={mode === "reset"}
                    disabled={disabled || foreignOwner}
                    onChange={() => onChange("reset")}
                    data-testid="backup-restore-mode-reset"
                />
                <span className="flex flex-col">
                    <span className="text-sm font-medium text-fg-primary">
                        {t("backup.restore_mode_reset", "Reset to the backup")}
                    </span>
                    <span className="text-sm text-fg-secondary">
                        {t(
                            "backup.restore_mode_reset_hint",
                            "This device ends up exactly as in the backup. Everything newer is removed.",
                        )}
                    </span>
                    {foreignOwner && (
                        <span
                            className="mt-1 text-sm text-warning"
                            data-testid="backup-reset-foreign-unavailable"
                        >
                            {t(
                                "backup.reset_foreign_unavailable",
                                "This backup belongs to another learner profile. A reset would replace everything in the active profile with the other profile's data, so it can only be merged.",
                            )}
                        </span>
                    )}
                </span>
            </label>
        </fieldset>
    );
}
