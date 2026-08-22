/**
 * IdentitySection — Settings > About > Identity panel (Phase 41D).
 *
 * Surfaces the ``~/.config/adaptive_learner/identity.yaml`` recovery
 * file so the user can see at a glance whether they have a survival
 * trace on disk and where it lives. The file itself is written by
 * the backend on user / project / language changes (Phase 41A);
 * this component is a pure read-only diagnostic.
 *
 * API-mode only. Dexie mode has no backend-side identity file -
 * recovery in that mode happens via ``IUsersNamespace.findMostRecent``
 * against IndexedDB (Phase 41B), not via a config-dir YAML. The
 * parent ``AboutTab`` gates the section on ``storageMode === "api"``.
 *
 * No actions in this surface: the Reset button + typed-confirmation
 * Danger Zone lands in Phase 41F.
 */

import {useEffect, useState} from "react";

import {api, ApiError, type IdentityStatusPayload} from "../../api/client";

interface Props {
    t: (key: string, fallback?: string) => string;
}

export default function IdentitySection({t}: Props) {
    const [status, setStatus] = useState<IdentityStatusPayload | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const result = await api.identity.status();
                if (cancelled) return;
                setStatus(result);
            } catch (err) {
                if (cancelled) return;
                const detail =
                    err instanceof ApiError ? err.detail : String(err);
                setError(detail);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    // The identity file is a backend-only diagnostic. If the status can't be
    // read (no backend reachable — e.g. the section mounted in api mode without
    // a running server), don't surface a raw "HTTP 404"; just render nothing
    // (#914). The section is already storage-mode-gated by the caller.
    if (!loading && (error || !status)) return null;

    return (
        <article
            data-testid="about-identity-section"
            className="p-4 border border-[var(--border)] rounded-[8px] bg-[var(--surface)]"
        >
            <h3 className="mt-0 mb-3">
                {t("about.identity_heading", "Identity file")}
            </h3>
            {loading && (
                <p data-testid="about-identity-loading" className="muted">
                    {t("about.identity_loading", "Loading identity status…")}
                </p>
            )}
            {status && (
                <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-[0.9rem] m-0">
                    <dt>
                        <strong>{t("about.identity_path_label", "Path")}</strong>
                    </dt>
                    <dd data-testid="about-identity-path" className="m-0 break-all">
                        <code>{status.path}</code>
                    </dd>
                    <dt>
                        <strong>{t("about.identity_status_label", "Status")}</strong>
                    </dt>
                    <dd data-testid="about-identity-status" className="m-0 break-all">
                        {status.exists ? (
                            <span
                                data-testid="about-identity-status-active"
                                className="text-[var(--success)]"
                            >
                                {t("about.identity_status_active", "Active")}
                            </span>
                        ) : (
                            <span
                                data-testid="about-identity-status-missing"
                                className="muted"
                            >
                                {t("about.identity_status_missing", "Not found")}
                            </span>
                        )}
                    </dd>
                    {status.exists && status.last_seen && (
                        <>
                            <dt>
                                <strong>
                                    {t("about.identity_last_seen_label", "Last updated")}
                                </strong>
                            </dt>
                            <dd
                                data-testid="about-identity-last-seen"
                                className="m-0 break-all"
                            >
                                {formatLastSeen(status.last_seen)}
                            </dd>
                        </>
                    )}
                </dl>
            )}
            <p className="muted mt-3 text-[0.85rem]">
                {t(
                    "about.identity_explainer",
                    "This file is auto-managed by Adaptive Learner. It lets the app recover your user identity after a browser data wipe. Do not edit it manually.",
                )}
            </p>
        </article>
    );
}

/**
 * Format an ISO-8601 timestamp into a locale-aware string. The
 * backend writes ``datetime.now(timezone.utc).isoformat()`` which
 * the browser's ``Date`` constructor parses natively.
 */
function formatLastSeen(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso; // defensive
    return d.toLocaleString();
}
