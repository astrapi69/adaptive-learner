/**
 * LicenseResourcesSection (Phase 14B).
 *
 * License + repo + docs + issue tracker links. The license string
 * comes from the SystemInfo payload (which reads pyproject.toml in
 * API mode and hardcodes "MIT" in Dexie mode); URLs come from the
 * same payload so they stay aligned with the deployment target.
 */

import {Link} from "react-router";

import type {SystemInfo} from "../../types/domain";
import {docsHomeUrl} from "../../lib/help/help-routes";
import {APP_TUTORIAL_PATH} from "../../lib/content/app-tutorial";

interface Props {
    info: SystemInfo;
    t: (key: string, fallback?: string) => string;
    /** Active UI language, used to pick the localized docs URL. */
    lang: string;
}

export default function LicenseResourcesSection({info, t, lang}: Props) {
    const docsUrl = docsHomeUrl(lang);
    return (
        <article
            data-testid="about-license-section"
            className="p-4 border border-[var(--border)] rounded-[8px] bg-[var(--surface)]"
        >
            <h3 className="mt-0 mb-3">
                {t("about.license_heading", "License & resources")}
            </h3>
            <dl className="grid grid-cols-[minmax(0,max-content)_minmax(0,1fr)] gap-x-4 gap-y-1 text-[0.9rem] m-0">
                <dt>
                    <strong>{t("about.license_label", "License")}</strong>
                </dt>
                <dd data-testid="about-license" className="m-0 min-w-0 break-all">
                    {info.app.license}{" "}
                    <a
                        href={`${info.app.repository_url}/blob/main/LICENSE`}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-testid="about-license-link"
                        className="text-[0.85rem]"
                    >
                        {t("about.license_text_link", "(text)")}
                    </a>
                </dd>
                <dt>
                    <strong>{t("about.repo_label", "Repository")}</strong>
                </dt>
                <dd data-testid="about-repo" className="m-0 min-w-0 break-all">
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
                <dd data-testid="about-docs" className="m-0 min-w-0 break-all">
                    <a
                        href={docsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-testid="about-docs-link"
                    >
                        {docsUrl.replace(/^https?:\/\//, "")}
                    </a>
                </dd>
                <dt>
                    <strong>{t("about.tutorial_label", "App tutorial")}</strong>
                </dt>
                <dd data-testid="about-tutorial" className="m-0 min-w-0 break-all">
                    <Link
                        to={APP_TUTORIAL_PATH}
                        data-testid="about-tutorial-link"
                    >
                        {t("about.tutorial_link", "Open the tutorial")}
                    </Link>
                </dd>
                <dt>
                    <strong>{t("about.issues_label", "Issues")}</strong>
                </dt>
                <dd data-testid="about-issues" className="m-0 min-w-0 break-all">
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
