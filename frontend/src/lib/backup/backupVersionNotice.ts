/**
 * User-facing texts for a backup's format version (#3827), shared by the
 * Settings restore and the onboarding restore so both say the same thing.
 *
 * @example
 * const result = await readBackupFile(file);
 * if (!result.ok) notify.warning(backupFileErrorText(result, t));
 * const note = newerBackupNotice(summary, t, lang);
 * if (note) notify.warning(note);
 */

import type {RestoreSummary} from "../../types/domain";
import {supportedFormat} from "../../storage/backup/backup-version";
import type {BackupFileResult} from "./validateBackupFile";

/** The i18n lookup: catalog text for ``key``, else ``fallback``. */
export type Translate = (key: string, fallback: string) => string;

type Rejected = Extract<BackupFileResult, {ok: false}>;

/**
 * The warning for a file the restore refused before reading it.
 *
 * @param result - A failed ``readBackupFile`` result.
 * @param t - The i18n lookup.
 */
export function backupFileErrorText(result: Rejected, t: Translate): string {
    switch (result.error) {
        case "too_large":
            return t("backup.too_large", "This backup file is too large (over 100 MB).");
        case "newer_major":
            return t(
                "backup.newer_major_rejected",
                "This backup uses backup format {{version}}, and this version of the app reads format {{supported}}. Update the app, then import the backup again.",
            )
                .replace("{{version}}", result.version ?? "")
                .replace("{{supported}}", supportedFormat());
        case "unknown_version":
            return t(
                "backup.unknown_version_rejected",
                "The format version of this backup cannot be read, so it was not imported.",
            );
        default:
            return t(
                "backup.not_a_backup_file",
                "This file is not a valid backup file. Please choose a file exported with 'Create backup'.",
            );
    }
}

/**
 * The note after restoring a backup from a newer app, or null when the
 * backup is current or older (or the backend predates the fields).
 *
 * @param summary - The restore summary of either storage mode.
 * @param t - The i18n lookup.
 * @param lang - The UI language, for joining the segment names.
 */
export function newerBackupNotice(
    summary: Pick<RestoreSummary, "newer_version" | "skipped_segments">,
    t: Translate,
    lang: string,
): string | null {
    const version = summary.newer_version;
    if (!version) {
        return null;
    }
    const skipped = summary.skipped_segments ?? [];
    if (skipped.length === 0) {
        return t(
            "backup.newer_version_restored",
            "This backup was made by a newer version of the app (backup format {{version}}). Everything in it was restored.",
        ).replace("{{version}}", version);
    }
    return t(
        "backup.newer_version_skipped",
        "This backup was made by a newer version of the app (backup format {{version}}). Everything this version knows was restored; skipped: {{segments}}.",
    )
        .replace("{{version}}", version)
        .replace("{{segments}}", new Intl.ListFormat(lang, {type: "conjunction"}).format(skipped));
}
