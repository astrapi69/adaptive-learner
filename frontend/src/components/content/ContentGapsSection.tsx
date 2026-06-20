/**
 * ContentGapsSection — Phase 64E encouraging "Missing Lessons" suggestions:
 * the top few gaps in the downloaded library (next-level + missing-pair),
 * each with a "Can you help?" link to the community repo. Renders nothing
 * when there are no gaps. Extracted verbatim from ``Content.tsx`` (#883).
 *
 * Presentational + props-driven: the parent supplies the downloaded sets,
 * the active UI language (for language display names), and the community
 * repo slug.
 */

import { useI18n } from "../../hooks/ui/useI18n";
import { detectGaps } from "../../lib/content/gap-detector";
import { languageDisplayName } from "../../lib/content/language-names";
import type { ContentSetEntry } from "../../storage/types";

export interface ContentGapsSectionProps {
  downloadedSets: ContentSetEntry[];
  lang: string;
  /** Community repo slug, e.g. ``astrapi69/adaptive-learner-content``. */
  repo: string;
}

/** Up-to-5 "Missing Lessons" gap suggestions, or nothing when there are none. */
export default function ContentGapsSection({
  downloadedSets,
  lang,
  repo,
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
              href={`https://github.com/${repo}`}
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
