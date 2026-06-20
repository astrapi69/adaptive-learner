/**
 * ReleaseNotes — renders GitHub release notes (#840).
 *
 * Shared by the desktop "Check for updates" control and the update banner's
 * "What's new" modal so they render notes identically. Markdown via the
 * project's react-markdown + remark-gfm pipeline (already a dependency).
 * Long notes are truncated with a "Read more" link to the release page.
 *
 * Token-backed Tailwind; no hardcoded colours.
 */

import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Translate = (key: string, fallback?: string) => string;

/** Default character cap before truncation. */
export const RELEASE_NOTES_LIMIT = 500;

interface ReleaseNotesProps {
  notes: string;
  /** Release page URL for the "Read more" link when truncated. */
  releaseUrl?: string;
  t: Translate;
  /** Override the truncation length (the modal can pass a larger cap). */
  limit?: number;
}

/** Truncate at a word boundary near ``limit`` without cutting mid-word. */
function truncate(text: string, limit: number): { text: string; truncated: boolean } {
  if (text.length <= limit) return { text, truncated: false };
  const slice = text.slice(0, limit);
  const lastBreak = slice.lastIndexOf("\n");
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastBreak > limit * 0.5 ? lastBreak : lastSpace > 0 ? lastSpace : limit;
  return { text: `${slice.slice(0, cut).trimEnd()}…`, truncated: true };
}

/** Markdown release notes with optional truncation + "Read more". */
export default function ReleaseNotes({
  notes,
  releaseUrl,
  t,
  limit = RELEASE_NOTES_LIMIT,
}: ReleaseNotesProps) {
  const trimmed = notes.trim();
  if (!trimmed) return null;
  const { text, truncated } = truncate(trimmed, limit);
  return (
    <div data-testid="release-notes" className="text-sm text-fg-secondary">
      <div className="prose-sm max-w-none break-words [&_a]:text-accent [&_code]:text-fg-primary">
        <Markdown remarkPlugins={[remarkGfm]}>{text}</Markdown>
      </div>
      {truncated && releaseUrl && (
        <a
          href={releaseUrl}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="release-notes-more"
          className="text-accent underline"
        >
          {t("about.update.read_more", "Read more")}
        </a>
      )}
    </div>
  );
}
