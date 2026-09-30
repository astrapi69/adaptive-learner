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

/**
 * Row label. Below `sm` the list is a single column (#3340), so each
 * label after the first gets a top margin that separates the pairs; from
 * `sm` up the labels sit in their own column and need none.
 */
const LABEL_CLASS = "mt-2 first:mt-0 sm:mt-0";

/**
 * Row value. `break-words` wraps a long URL only where it does not fit,
 * instead of `break-all` splitting every word ("Impre/ssum") (#3340).
 */
const VALUE_CLASS = "m-0 min-w-0 break-words";

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
            <dl className="grid grid-cols-1 sm:grid-cols-[minmax(0,max-content)_minmax(0,1fr)] gap-x-4 gap-y-1 text-[0.9rem] m-0">
                <dt className={LABEL_CLASS}>
                    <strong>{t("about.license_label", "License")}</strong>
                </dt>
                <dd data-testid="about-license" className={VALUE_CLASS}>
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
                <dt className={LABEL_CLASS}>
                    <strong>{t("about.repo_label", "Repository")}</strong>
                </dt>
                <dd data-testid="about-repo" className={VALUE_CLASS}>
                    <a
                        href={info.app.repository_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-testid="about-repo-link"
                    >
                        {info.app.repository_url.replace(/^https?:\/\//, "")}
                    </a>
                </dd>
                <dt className={LABEL_CLASS}>
                    <strong>{t("about.docs_label", "Documentation")}</strong>
                </dt>
                <dd data-testid="about-docs" className={VALUE_CLASS}>
                    <a
                        href={docsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-testid="about-docs-link"
                    >
                        {docsUrl.replace(/^https?:\/\//, "")}
                    </a>
                </dd>
                <dt className={LABEL_CLASS}>
                    <strong>{t("about.tutorial_label", "App tutorial")}</strong>
                </dt>
                <dd data-testid="about-tutorial" className={VALUE_CLASS}>
                    <Link
                        to={APP_TUTORIAL_PATH}
                        data-testid="about-tutorial-link"
                    >
                        {t("about.tutorial_link", "Open the tutorial")}
                    </Link>
                </dd>
                <dt className={LABEL_CLASS}>
                    <strong>{t("about.issues_label", "Issues")}</strong>
                </dt>
                <dd data-testid="about-issues" className={VALUE_CLASS}>
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
                <dt className={LABEL_CLASS}>
                    <strong>{t("about.imprint_label", "Legal notice")}</strong>
                </dt>
                <dd data-testid="about-imprint" className={VALUE_CLASS}>
                    <a
                        href={docsUrlForSlug("legal/imprint", lang)}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-testid="about-imprint-link"
                    >
                        {t("about.imprint_label", "Legal notice")}
                    </a>
                </dd>
                <dt className={LABEL_CLASS}>
                    <strong>{t("about.privacy_label", "Privacy policy")}</strong>
                </dt>
                <dd data-testid="about-privacy" className={VALUE_CLASS}>
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
