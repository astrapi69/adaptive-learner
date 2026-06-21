/**
 * "Missing Lessons" gap-suggestion section for the /content page
 * (Phase 64E, extracted from Content.tsx, #896).
 *
 * Detects the top library gaps over the downloaded sets and renders an
 * encouraging "Can you help?" prompt linking to the community repo.
 * Renders nothing when there are no gaps. Presentational + pure: the page
 * passes the downloaded sets, the active UI language, and the repo slug.
 * Behaviour-preserving: identical testids, text, and the same first-5
 * slice over {@link detectGaps}.
 */

import { detectGaps } from "../../../lib/content/validation/gap-detector";
import { languageDisplayName } from "../../../lib/content/language/language-names";
import { useI18n } from "../../../hooks/ui/useI18n";
import type { ContentSetEntry } from "../../../storage/types";

interface ContentGapsSectionProps {
  downloadedSets: ContentSetEntry[];
  lang: string;
  /** Community contribution target repo (manual maintainer review). */
  communityRepo: string;
}

/** The /content "Missing Lessons" section. */
export default function ContentGapsSection({
  downloadedSets,
  lang,
  communityRepo,
}: ContentGapsSectionProps) {
  const { t } = useI18n();
  const gaps = detectGaps(downloadedSets).slice(0, 5);
  if (gaps.length === 0) return null;
  return (
    <section className="content-section content-gaps" data-testid="content-gaps">
      <h2>{t("content.gaps.title", "Missing Lessons")}</h2>
      <p className="content-gaps-intro">
        {t(
          "content.gaps.intro",
          "The community library has a few gaps. Can you help fill one?",
        )}
      </p>
      <ul className="content-gaps-list" data-testid="content-gaps-list">
        {gaps.map((gap, i) => (
          <li
            key={`${gap.kind}-${gap.source}-${gap.target}-${gap.level}-${i}`}
            className="content-gap-row"
          >
            <span>
              {(gap.kind === "next_level"
                ? t(
                    "content.gaps.next_level",
                    "{target} for {source} speakers has lessons, but {level} doesn't exist yet.",
                  )
                : t(
                    "content.gaps.missing_pair",
                    "{target} {level} for {source} speakers doesn't exist yet.",
                  )
              )
                .replace("{target}", languageDisplayName(gap.target, lang))
                .replace("{source}", languageDisplayName(gap.source, lang))
                .replace("{level}", gap.level)}
            </span>{" "}
            <a
              href={`https://github.com/${communityRepo}`}
              target="_blank"
              rel="noopener noreferrer"
              className="content-gap-help"
            >
              {t("content.gaps.help", "Can you help?")}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
