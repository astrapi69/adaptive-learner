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

    return (
        <article
            data-testid="about-identity-section"
            style={sectionStyle}
        >
            <h3 style={{marginTop: 0, marginBottom: 12}}>
                {t("about.identity_heading", "Identity file")}
            </h3>
            {loading && (
                <p data-testid="about-identity-loading" className="muted">
                    {t("about.identity_loading", "Loading identity status…")}
                </p>
            )}
            {error && !status && (
                <p
                    data-testid="about-identity-error"
                    role="alert"
                    style={{color: "var(--danger)"}}
                >
                    {t("about.identity_error", "Could not load identity status:")}{" "}
                    {error}
                </p>
            )}
            {status && (
                <dl style={dlStyle}>
                    <dt>
                        <strong>{t("about.identity_path_label", "Path")}</strong>
                    </dt>
                    <dd data-testid="about-identity-path" style={ddStyle}>
                        <code>{status.path}</code>
                    </dd>
                    <dt>
                        <strong>{t("about.identity_status_label", "Status")}</strong>
                    </dt>
                    <dd data-testid="about-identity-status" style={ddStyle}>
                        {status.exists ? (
                            <span
                                data-testid="about-identity-status-active"
                                style={{color: "var(--success)"}}
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
                                style={ddStyle}
                            >
                                {formatLastSeen(status.last_seen)}
                            </dd>
                        </>
                    )}
                </dl>
            )}
            <p
                className="muted"
                style={{marginTop: 12, fontSize: "0.85rem"}}
            >
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

const sectionStyle: React.CSSProperties = {
    padding: 16,
    border: "1px solid var(--border)",
    borderRadius: 8,
    background: "var(--surface)",
};

const dlStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "max-content 1fr",
    gap: "4px 16px",
    fontSize: "0.9rem",
    margin: 0,
};

const ddStyle: React.CSSProperties = {margin: 0, wordBreak: "break-all"};
