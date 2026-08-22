/**
 * CreditsSection (Phase 14B).
 *
 * Author + dependency acknowledgements + tagline. Pure static
 * content; no data fetching. The dependency list mirrors the
 * tech-stack block in CLAUDE.md so the About panel doesn't drift
 * from the project's own description.
 */

const ACKNOWLEDGED_DEPS = [
  "React",
  "FastAPI",
  "PluginForge",
  "Dexie",
  "Recharts",
  "SQLAlchemy",
  "Pydantic",
  "Vite",
  "TypeScript",
];

interface Props {
  t: (key: string, fallback?: string) => string;
}

export default function CreditsSection({ t }: Props) {
  return (
    <article
      data-testid="about-credits-section"
      className="p-4 border border-[var(--border)] rounded-[8px] bg-[var(--surface)]"
    >
      <h3 className="mt-0 mb-3">
        {t("about.credits_heading", "Credits")}
      </h3>
      {/* ``[overflow-wrap:anywhere]`` on the dd values lets the author /
          dependency-list / AI-credit values wrap (and break long tokens only
          when needed) so they don't overflow the viewport at 320px. The other
          About sections use ``break-all`` for path/hash values; word-based
          credit text reads better with overflow-wrap. ``min-w-0`` lets the
          grid's 1fr value track shrink below the content's intrinsic width. */}
      <dl className="grid grid-cols-[minmax(0,max-content)_minmax(0,1fr)] gap-x-4 gap-y-1 text-[0.9rem] m-0">
        <dt>
          <strong>{t("about.author_label", "Author")}</strong>
        </dt>
        <dd
          className="m-0 min-w-0 [overflow-wrap:anywhere]"
          data-testid="about-author"
        >
          Asterios Raptis <span className="opacity-70">(</span>
          <a
            href="https://github.com/astrapi69"
            target="_blank"
            rel="noopener noreferrer"
            data-testid="about-author-github"
          >
            github.com/astrapi69
          </a>
          <span className="opacity-70">)</span>
        </dd>
        <dt>
          <strong>{t("about.dependencies_label", "Built with")}</strong>
        </dt>
        <dd
          className="m-0 min-w-0 [overflow-wrap:anywhere]"
          data-testid="about-deps-list"
        >
          {ACKNOWLEDGED_DEPS.join(" · ")}
        </dd>
        <dt>
          <strong>{t("about.ai_assistance_label", "AI assistance")}</strong>
        </dt>
        <dd
          className="m-0 min-w-0 [overflow-wrap:anywhere]"
          data-testid="about-ai-assistance"
        >
          {t(
            "about.ai_assistance_value",
            "Claude (Anthropic) - Architecture, Code, Content, Documentation",
          )}
        </dd>
      </dl>
      <p
        className="mt-3 mx-0 mb-0 italic opacity-85"
        data-testid="about-tagline"
      >
        {t("about.tagline", "Built for self-directed learners.")}
      </p>
    </article>
  );
}
