/**
 * Book-companion header for the Content Browser (EXP-025 / AUTH-02).
 *
 * When a connected content repo accompanies a published book (its
 * ``manifest.yaml`` declares a ``book`` block, AUTH-01), this renders a
 * discreet card with the cover / author / edition and a low-key
 * "Zum Buch" link (decision E5: ``rel="noopener noreferrer"``, new tab,
 * no auto-redirect, no in-app purchase). Reuses the shadcn Card styling
 * of the book-recommendations card so the two stay visually consistent.
 *
 * Pure presentational; the {@link BookMetadata} comes from
 * {@link ../../lib/content/book-companion}.
 */

import { BookOpen, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { useI18n } from "../../../hooks/ui/useI18n";
import type { BookMetadata } from "../../../lib/content/media/book-companion";

export interface BookCompanionProps {
  book: BookMetadata;
  /** Owning repo source id, for the section testid. */
  source: string;
}

export default function BookCompanion({ book, source }: BookCompanionProps) {
  const { t } = useI18n();
  return (
    <Card
      className="flex gap-3 p-3"
      data-testid={`book-companion-${source}`}
    >
      {book.coverUrl ? (
        <img
          src={book.coverUrl}
          alt=""
          aria-hidden="true"
          className="h-20 w-14 shrink-0 rounded-md object-cover"
          loading="lazy"
        />
      ) : (
        <div
          className="flex h-20 w-14 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
          aria-hidden="true"
        >
          <BookOpen className="size-6" />
        </div>
      )}
      <CardContent className="flex grow flex-col gap-1 p-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("content.book.companion", "Book companion")}
        </p>
        <p className="font-medium leading-snug" data-testid="book-companion-title">
          {book.title}
        </p>
        {book.subtitle ? (
          <p className="text-sm leading-snug text-muted-foreground">{book.subtitle}</p>
        ) : null}
        <p className="text-sm text-muted-foreground">
          {t("content.book.by_author", "by {author}").replace("{author}", book.author)}
          {book.edition ? ` · ${book.edition}` : ""}
        </p>
        {book.description ? (
          <p className="line-clamp-2 text-sm text-muted-foreground">{book.description}</p>
        ) : null}
        <div className="mt-1">
          <Button asChild variant="outline" size="sm" className="min-h-11 gap-1.5">
            <a
              href={book.url}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="book-companion-link"
            >
              <ExternalLink aria-hidden="true" />
              {t("content.book.view", "To the book")}
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
