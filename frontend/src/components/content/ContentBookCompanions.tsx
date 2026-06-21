/**
 * "Book companion" cards on /content (EXP-025 / AUTH-02): one discreet
 * card per connected source that declares a `book` block. Extracted from
 * Content.tsx (#541) so the page component stays under the complexity
 * gate; renders nothing when no source has a companion book.
 */

import type { BookMetadata } from "../../lib/content/media/book-companion";
import BookCompanion from "./BookCompanion";

interface ContentBookCompanionsProps {
  companions: Record<string, BookMetadata>;
}

export default function ContentBookCompanions({
  companions,
}: ContentBookCompanionsProps) {
  const entries = Object.entries(companions);
  if (entries.length === 0) return null;

  return (
    <section className="mb-4 flex flex-col gap-2" data-testid="content-book-companions">
      {entries.map(([source, book]) => (
        <BookCompanion key={source} book={book} source={source} />
      ))}
    </section>
  );
}
