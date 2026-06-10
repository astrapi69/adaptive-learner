/**
 * Per-domain book recommendations section for the Content Browser (#141).
 *
 * A discreet, collapsible "Recommended books" block shown under a domain's
 * sets. Each book is a shadcn Card with a Book-icon placeholder, title +
 * author + a short description, and a direct "View on Amazon" link (new
 * tab, ``rel="noopener noreferrer"``). Renders nothing when the domain has
 * no recommendations — a function not available is not offered.
 *
 * Recommendations, not advertising: direct Amazon URLs only, no affiliate
 * links, low-key styling.
 */

import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Book } from "../../lib/content/book-recommendations";
import { useI18n } from "../../hooks/useI18n";

interface BookRecommendationsProps {
  /** The domain these books belong to (drives the section testid). */
  domain: string;
  /** Books to show. The section renders nothing when empty. */
  books: Book[];
}

/** One book card. */
function BookCard({ book }: { book: Book }) {
  const { t } = useI18n();
  return (
    <Card className="flex gap-3 p-3" data-testid="book-card">
      <div
        className="flex size-12 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
        aria-hidden="true"
      >
        <BookOpen className="size-6" />
      </div>
      <CardContent className="flex grow flex-col gap-1 p-0">
        <p className="font-medium leading-snug">{book.title}</p>
        {book.subtitle ? (
          <p className="text-sm text-muted-foreground leading-snug">
            {book.subtitle}
          </p>
        ) : null}
        <p className="text-sm text-muted-foreground">{book.author}</p>
        {book.description ? (
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {book.description}
          </p>
        ) : null}
        <div className="mt-1">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="min-h-11 gap-1.5"
          >
            <a
              href={book.url}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="book-amazon-link"
            >
              <ExternalLink aria-hidden="true" />
              {t("content.books.view_on_amazon", "View on Amazon")}
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Collapsible "Recommended books" section for one domain. Open by default
 * so the recommendations are visible without an extra click, but
 * collapsible to stay out of the way.
 */
export default function BookRecommendations({
  domain,
  books,
}: BookRecommendationsProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(true);

  if (books.length === 0) return null;

  return (
    <section className="mt-2" data-testid={`book-recommendations-${domain}`}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-11 gap-1.5 px-2 font-medium"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        data-testid="book-recommendations-toggle"
      >
        {open ? (
          <ChevronDown aria-hidden="true" />
        ) : (
          <ChevronRight aria-hidden="true" />
        )}
        <BookOpen aria-hidden="true" className="size-4" />
        {t("content.books.title", "Recommended books")}
        <span className="text-muted-foreground">({books.length})</span>
      </Button>
      {open ? (
        <div className="mt-2 flex flex-col gap-2">
          {books.map((book, i) => (
            <BookCard key={`${book.url}-${i}`} book={book} />
          ))}
        </div>
      ) : null}
    </section>
  );
}
