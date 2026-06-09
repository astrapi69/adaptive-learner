/**
 * First-run restore (#150).
 *
 * A brand-new install (empty DB) has no user, so the regular
 * Settings > Data > Import flow can't help: Settings redirects to
 * onboarding without a user, and a restore is scoped to the CURRENT
 * user id — a backup from another device carries a different id, so
 * every row would be dropped.
 *
 * The onboarding screen instead offers a self-contained restore that
 * ADOPTS the backup's identity: read the owning user id out of the
 * backup, seed it into localStorage, then run ``backup.import`` with
 * that id so the user-scoping matches and the data actually lands.
 *
 * This module holds the two pure pieces — empty-install detection and
 * identity extraction — so the orchestration in ``Onboarding.tsx``
 * stays thin and both pieces are unit-testable without a DOM.
 */

import type {IStorageService} from "../storage/types";
import type {BackupPayload} from "../types/domain";

/** Identity to seed before importing a first-run backup. */
export interface AdoptedIdentity {
    /** Owning user id from the backup; empty when unresolvable. */
    userId: string;
    /** Active (or first) project id, when the backup carries one. */
    projectId: string | null;
    /** Preferred UI language from the user / settings row. */
    language: string | null;
}

type Row = Record<string, unknown>;

function rows(payload: BackupPayload, table: string): Row[] {
    const segment = payload.data?.[table];
    return Array.isArray(segment) ? (segment as Row[]) : [];
}

function asString(value: unknown): string | null {
    return typeof value === "string" && value !== "" ? value : null;
}

/**
 * Resolve the identity to adopt from a backup payload.
 *
 * The owning user id is taken from the top-level ``user_id`` (always
 * present in a well-formed backup) with the first ``users`` row as a
 * fallback. The project is the active one (``active === true``) or the
 * first one belonging to that user; the language comes from the user
 * row, then the user-settings row.
 *
 * @param payload - Parsed backup payload.
 * @returns The adopted identity; ``userId`` is "" when the payload
 *   carries no resolvable user (the caller treats that as invalid).
 */
export function pickAdoptedIdentity(payload: BackupPayload): AdoptedIdentity {
    const userRows = rows(payload, "users");
    const userId =
        asString(payload.user_id) ??
        (userRows.length > 0 ? asString(userRows[0].id) : null) ??
        "";

    const projectRows = rows(payload, "learning_projects").filter(
        (row) => userId === "" || row.user_id === userId,
    );
    const activeProject =
        projectRows.find((row) => row.active === true) ?? projectRows[0];
    const projectId = activeProject ? asString(activeProject.id) : null;

    const ownerUser =
        userRows.find((row) => row.id === userId) ?? userRows[0];
    const settingsRow =
        rows(payload, "user_settings").find((row) => row.user_id === userId) ??
        rows(payload, "user_settings")[0];
    const language =
        (ownerUser ? asString(ownerUser.language) : null) ??
        (settingsRow ? asString(settingsRow.language) : null);

    return {userId, projectId, language};
}

/**
 * Decide whether the install is empty enough to offer a first-run
 * restore: no recoverable user, or a user with no projects and no
 * lesson progress. Assessment progress is project-scoped, so "no
 * projects" already implies "no assessment progress".
 *
 * Failures fall back to ``true`` (offer the restore) — the restore is
 * a non-destructive merge, so a stray false positive is harmless,
 * whereas hiding the only recovery affordance is not.
 *
 * @param storage - Storage service (injected for testability).
 * @param persistedUserId - ``readLearnerState().userId`` (or null).
 */
export async function isEmptyInstall(
    storage: Pick<IStorageService, "users" | "lessonProgress">,
    persistedUserId: string | null,
): Promise<boolean> {
    let userId = persistedUserId;
    if (!userId) {
        try {
            const hint = await storage.users.findMostRecent();
            userId = hint?.userId ?? null;
        } catch {
            userId = null;
        }
    }
    if (!userId) return true;

    try {
        const projects = await storage.users.projects.list(userId);
        if (projects.length > 0) return false;
        const progress = await storage.lessonProgress.list(userId);
        if (progress.length > 0) return false;
    } catch {
        return true;
    }
    return true;
}
