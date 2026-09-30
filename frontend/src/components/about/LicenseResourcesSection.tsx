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
import {docsHomeUrl, docsUrlForSlug} from "../../lib/help/help-routes";
import {APP_TUTORIAL_PATH} from "../../lib/content/app-tutorial";
import {ABOUT_LABEL_CLASS, ABOUT_LIST_CLASS, ABOUT_VALUE_CLASS} from "./about-definition-list";

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
            <dl className={ABOUT_LIST_CLASS}>
                <dt className={ABOUT_LABEL_CLASS}>
                    <strong>{t("about.license_label", "License")}</strong>
                </dt>
                <dd data-testid="about-license" className={ABOUT_VALUE_CLASS}>
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
                <dt className={ABOUT_LABEL_CLASS}>
                    <strong>{t("about.repo_label", "Repository")}</strong>
                </dt>
                <dd data-testid="about-repo" className={ABOUT_VALUE_CLASS}>
                    <a
                        href={info.app.repository_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-testid="about-repo-link"
                    >
                        {info.app.repository_url.replace(/^https?:\/\//, "")}
                    </a>
                </dd>
                <dt className={ABOUT_LABEL_CLASS}>
                    <strong>{t("about.docs_label", "Documentation")}</strong>
                </dt>
                <dd data-testid="about-docs" className={ABOUT_VALUE_CLASS}>
                    <a
                        href={docsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-testid="about-docs-link"
                    >
                        {docsUrl.replace(/^https?:\/\//, "")}
                    </a>
                </dd>
                <dt className={ABOUT_LABEL_CLASS}>
                    <strong>{t("about.tutorial_label", "App tutorial")}</strong>
                </dt>
                <dd data-testid="about-tutorial" className={ABOUT_VALUE_CLASS}>
                    <Link
                        to={APP_TUTORIAL_PATH}
                        data-testid="about-tutorial-link"
                    >
                        {t("about.tutorial_link", "Open the tutorial")}
                    </Link>
                </dd>
                <dt className={ABOUT_LABEL_CLASS}>
                    <strong>{t("about.issues_label", "Issues")}</strong>
                </dt>
                <dd data-testid="about-issues" className={ABOUT_VALUE_CLASS}>
                    <a
                        href={info.app.issues_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-testid="about-issues-link"
                    >
                        {info.app.issues_url.replace(/^https?:\/\//, "")}
                    </a>
                </dd>
                {/* #3113 - the legal pages live on the docs site (one source
                    for the app help, the docs site and every locale). */}
                <dt className={ABOUT_LABEL_CLASS}>
                    <strong>{t("about.imprint_label", "Legal notice")}</strong>
                </dt>
                <dd data-testid="about-imprint" className={ABOUT_VALUE_CLASS}>
                    <a
                        href={docsUrlForSlug("legal/imprint", lang)}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-testid="about-imprint-link"
                    >
                        {t("about.imprint_label", "Legal notice")}
                    </a>
                </dd>
                <dt className={ABOUT_LABEL_CLASS}>
                    <strong>{t("about.privacy_label", "Privacy policy")}</strong>
                </dt>
                <dd data-testid="about-privacy" className={ABOUT_VALUE_CLASS}>
                    <a
                        href={docsUrlForSlug("legal/privacy", lang)}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-testid="about-privacy-link"
                    >
                        {t("about.privacy_label", "Privacy policy")}
                    </a>
                </dd>
            </dl>
        </article>
    );
}
