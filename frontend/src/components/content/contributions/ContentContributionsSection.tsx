/**
 * "My Contributions" section on /content — the learner's local sharing
 * history (Phase 64D). Extracted from Content.tsx (#541) so the page
 * component stays under the complexity gate; renders nothing when there
 * are no contributions.
 */

import { useI18n } from "../../../hooks/ui/useI18n";
import {
  CONTRIBUTOR_THRESHOLD,
  type SharedContribution,
} from "../../../lib/content/placement/contribution-history";

interface ContentContributionsSectionProps {
  contributions: SharedContribution[];
}

export default function ContentContributionsSection({
  contributions,
}: ContentContributionsSectionProps) {
  const { t } = useI18n();
  if (contributions.length === 0) return null;

  return (
    <section
      className="content-section content-my-contributions flex flex-col gap-3"
      data-testid="content-my-contributions"
    >
      <h2>{t("content.contributions.title", "My Contributions")}</h2>
      <p data-testid="content-contributions-count">
        {t(
          "content.contributions.count",
          "You've contributed {n} lesson(s) to the community.",
        ).replace("{n}", String(contributions.length))}
      </p>
      {contributions.length >= CONTRIBUTOR_THRESHOLD && (
        <p
          className="content-contributor-badge inline-block rounded-full bg-muted px-3 py-1 text-sm font-medium"
          data-testid="content-contributor-badge"
        >
          {t(
            "content.contributions.contributor",
            "Community Contributor — {n} lessons shared!",
          ).replace("{n}", String(contributions.length))}
        </p>
      )}
      <ul
        className="content-contributions-list flex flex-col gap-2"
        data-testid="content-contributions-list"
      >
        {contributions.map((c) => (
          <li
            key={c.github_url}
            className="content-contribution-row flex flex-wrap items-center gap-3 rounded-md border border-border bg-card p-3"
          >
            <span className="content-contribution-title font-medium">{c.title}</span>
            <span className="content-contribution-date text-sm text-muted-foreground">
              {c.shared_at.slice(0, 10)}
            </span>
            <span className="content-contribution-status text-sm text-fg-secondary">
              {t(`content.contributions.status_${c.status}`, c.status)}
            </span>
            <a
              href={c.github_url}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto text-sm text-accent hover:underline"
            >
              {t("content.contributions.view", "View")}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
