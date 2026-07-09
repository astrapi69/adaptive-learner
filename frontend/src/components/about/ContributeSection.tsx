/**
 * ContributeSection (#1504).
 *
 * A compact, STATIC "help the content library grow" block for
 * Settings > About. It replaces the dynamic per-learner gap suggestions
 * that briefly lived on /content (#1494): those recommended language pairs
 * unrelated to the learner ("English for Hindi speakers, B1 missing") —
 * the same irrelevant-mass-content problem as an unfiltered browse tab.
 * Whoever wants to contribute finds the how here; nobody gets unsolicited
 * suggestions.
 *
 * Pure static content: no gap detection, no list, no counter. Two links —
 * the community content repository (where lessons live) and the content-set
 * template repository (a scaffold for a new set). Card shell + link styling
 * match the sibling About sections (e.g. {@link DonationSection},
 * {@link ShareAppSection}).
 */

interface Props {
  t: (key: string, fallback?: string) => string;
}

/** Community content repository — the published lesson library. */
const CONTENT_REPO_URL =
  "https://github.com/astrapi69/adaptive-learner-content";
/** Content-set template repository — a scaffold for a new set. */
const CONTENT_TEMPLATE_REPO_URL =
  "https://github.com/astrapi69/adaptive-learner-content-template";

export default function ContributeSection({ t }: Props) {
  return (
    <article
      data-testid="about-contribute-section"
      className="rounded-lg border border-border bg-bg-surface p-4"
    >
      <h3 className="mb-2 mt-0">
        {t("about.contribute_heading", "Contribute content")}
      </h3>
      <p className="mb-3 mt-0 text-sm text-fg-secondary">
        {t(
          "about.contribute_intro",
          "The content library grows through community contributions. If you would like to add lessons, start here.",
        )}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={CONTENT_REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium text-fg-secondary hover:bg-muted"
          data-testid="about-contribute-repo-link"
        >
          {t("about.contribute_repo", "Content repository")}
        </a>
        <a
          href={CONTENT_TEMPLATE_REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium text-fg-secondary hover:bg-muted"
          data-testid="about-contribute-template-link"
        >
          {t("about.contribute_template", "Content set template")}
        </a>
      </div>
    </article>
  );
}
