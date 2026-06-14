/**
 * VersionSection (Phase 14B).
 *
 * App version + build hash + build date. In API storage mode the
 * payload comes from ``GET /api/system/info``; in Dexie mode the
 * synthetic browser-only payload (see ``DexieStorage.system.info``)
 * supplies ``unknown`` for the fields it can't determine, and the
 * row renders the sentinel transparently.
 *
 * Build hash links to the GitHub commit when it resolves to a real
 * short-SHA; the ``unknown`` sentinel is rendered as plain text.
 */

import type {SystemInfo} from "../../types/domain";

interface Props {
    info: SystemInfo;
    t: (key: string, fallback?: string) => string;
}

export default function VersionSection({info, t}: Props) {
    const commitUrl =
        info.app.build_hash !== "unknown"
            ? `${info.app.repository_url}/commit/${info.app.build_hash}`
            : null;
    return (
        <article
            data-testid="about-version-section"
            style={{
                padding: 16,
                border: "1px solid var(--border)",
                borderRadius: 8,
                background: "var(--surface)",
            }}
        >
            <h3 style={{marginTop: 0, marginBottom: 12}}>
                {t("about.version_heading", "Version")}
            </h3>
            <dl style={dlStyle}>
                <dt>
                    <strong>{t("about.app_label", "Adaptive Learner")}</strong>
                </dt>
                <dd data-testid="about-app-version" style={ddStyle}>
                    v{info.app.version}
                </dd>
                <dt>
                    <strong>{t("about.build_hash_label", "Build")}</strong>
                </dt>
                <dd data-testid="about-build-hash" style={ddStyle}>
                    {commitUrl ? (
                        <a
                            href={commitUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            data-testid="about-build-hash-link"
                        >
                            {info.app.build_hash}
                        </a>
                    ) : (
                        info.app.build_hash
                    )}
                </dd>
                <dt>
                    <strong>{t("about.build_date_label", "Build date")}</strong>
                </dt>
                <dd data-testid="about-build-date" style={ddStyle}>
                    {info.app.build_date === "unknown"
                        ? info.app.build_date
                        : new Date(info.app.build_date).toLocaleString()}
                </dd>
            </dl>
        </article>
    );
}

const dlStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "minmax(0, max-content) minmax(0, 1fr)",
    gap: "4px 16px",
    fontSize: "0.9rem",
    margin: 0,
};

const ddStyle: React.CSSProperties = {
    margin: 0,
    minWidth: 0,
    wordBreak: "break-all",
};
