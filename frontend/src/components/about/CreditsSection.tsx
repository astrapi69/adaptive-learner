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
    <article data-testid="about-credits-section" style={sectionStyle}>
      <h3 style={{ marginTop: 0, marginBottom: 12 }}>
        {t("about.credits_heading", "Credits")}
      </h3>
      <dl style={dlStyle}>
        <dt>
          <strong>{t("about.author_label", "Author")}</strong>
        </dt>
        <dd style={ddStyle} data-testid="about-author">
          Asterios Raptis <span style={{ opacity: 0.7 }}>(</span>
          <a
            href="https://github.com/astrapi69"
            target="_blank"
            rel="noopener noreferrer"
            data-testid="about-author-github"
          >
            github.com/astrapi69
          </a>
          <span style={{ opacity: 0.7 }}>)</span>
        </dd>
        <dt>
          <strong>{t("about.dependencies_label", "Built with")}</strong>
        </dt>
        <dd style={ddStyle} data-testid="about-deps-list">
          {ACKNOWLEDGED_DEPS.join(" · ")}
        </dd>
        <dt>
          <strong>{t("about.ai_assistance_label", "AI assistance")}</strong>
        </dt>
        <dd style={ddStyle} data-testid="about-ai-assistance">
          {t(
            "about.ai_assistance_value",
            "Claude (Anthropic) - Architecture, Code, Content, Documentation",
          )}
        </dd>
      </dl>
      <p
        style={{
          margin: "12px 0 0",
          fontStyle: "italic",
          opacity: 0.85,
        }}
        data-testid="about-tagline"
      >
        {t("about.tagline", "Built for self-directed learners.")}
      </p>
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

// ``overflowWrap: anywhere`` lets the author / dependency-list /
// AI-credit values wrap (and break long tokens only when needed) so
// they don't overflow the viewport at 320px. The other About sections
// use ``wordBreak: break-all`` for path/hash values; word-based credit
// text reads better with overflow-wrap. ``minWidth: 0`` lets the grid's
// 1fr value track shrink below the content's intrinsic width.
const ddStyle: React.CSSProperties = {
  margin: 0,
  minWidth: 0,
  overflowWrap: "anywhere",
};
