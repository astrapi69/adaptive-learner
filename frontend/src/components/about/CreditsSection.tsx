/**
 * CreditsSection (Phase 14B).
 *
 * Author + dependency acknowledgements + tagline. Pure static
 * content; no data fetching. The dependency list mirrors the
 * tech-stack block in CLAUDE.md so the About panel doesn't drift
 * from the project's own description.
 */

import {ABOUT_LABEL_CLASS, ABOUT_LIST_CLASS, ABOUT_VALUE_CLASS} from "./about-definition-list";

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
      {/* Layout shared by the About cards (#3340): stacked on phones, two
          columns from sm, values wrap between words. */}
      <dl className={ABOUT_LIST_CLASS}>
        <dt className={ABOUT_LABEL_CLASS}>
          <strong>{t("about.author_label", "Author")}</strong>
        </dt>
        <dd
          className={ABOUT_VALUE_CLASS}
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
        <dt className={ABOUT_LABEL_CLASS}>
          <strong>{t("about.dependencies_label", "Built with")}</strong>
        </dt>
        <dd
          className={ABOUT_VALUE_CLASS}
          data-testid="about-deps-list"
        >
          {ACKNOWLEDGED_DEPS.join(" · ")}
        </dd>
        <dt className={ABOUT_LABEL_CLASS}>
          <strong>{t("about.ai_assistance_label", "AI assistance")}</strong>
        </dt>
        <dd
          className={ABOUT_VALUE_CLASS}
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
