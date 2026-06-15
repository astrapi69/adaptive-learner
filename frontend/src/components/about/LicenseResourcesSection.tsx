/**
 * LicenseResourcesSection (Phase 14B).
 *
 * License + repo + docs + issue tracker links. The license string
 * comes from the SystemInfo payload (which reads pyproject.toml in
 * API mode and hardcodes "MIT" in Dexie mode); URLs come from the
 * same payload so they stay aligned with the deployment target.
 */

import type {SystemInfo} from "../../types/domain";

interface Props {
    info: SystemInfo;
    t: (key: string, fallback?: string) => string;
}

export default function LicenseResourcesSection({info, t}: Props) {
    return (
        <article
            data-testid="about-license-section"
            style={sectionStyle}
        >
            <h3 style={{marginTop: 0, marginBottom: 12}}>
                {t("about.license_heading", "License & resources")}
            </h3>
            <dl style={dlStyle}>
                <dt>
                    <strong>{t("about.license_label", "License")}</strong>
                </dt>
                <dd data-testid="about-license" style={ddStyle}>
                    {info.app.license}{" "}
                    <a
                        href={`${info.app.repository_url}/blob/main/LICENSE`}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-testid="about-license-link"
                        style={{fontSize: "0.85rem"}}
                    >
                        {t("about.license_text_link", "(text)")}
                    </a>
                </dd>
                <dt>
                    <strong>{t("about.repo_label", "Repository")}</strong>
                </dt>
                <dd data-testid="about-repo" style={ddStyle}>
                    <a
                        href={info.app.repository_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-testid="about-repo-link"
                    >
                        {info.app.repository_url.replace(/^https?:\/\//, "")}
                    </a>
                </dd>
                <dt>
                    <strong>{t("about.docs_label", "Documentation")}</strong>
                </dt>
                <dd data-testid="about-docs" style={ddStyle}>
                    <a
                        href={info.app.docs_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-testid="about-docs-link"
                    >
                        {info.app.docs_url.replace(/^https?:\/\//, "")}
                    </a>
                </dd>
                <dt>
                    <strong>{t("about.issues_label", "Issues")}</strong>
                </dt>
                <dd data-testid="about-issues" style={ddStyle}>
                    <a
                        href={info.app.issues_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-testid="about-issues-link"
                    >
                        {info.app.issues_url.replace(/^https?:\/\//, "")}
                    </a>
                </dd>
            </dl>
        </article>
    );
}

const sectionStyle: React.CSSProperties = {
    padding: 16,
    border: "1px solid var(--border)",
    borderRadius: 8,
    background: "var(--surface)",
};

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
