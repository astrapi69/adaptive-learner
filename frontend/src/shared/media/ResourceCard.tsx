/**
 * ResourceCard (EXP-029 / MED-04) — a reusable, props-driven card for one
 * supplementary-media {@link MediaResource}.
 *
 * Renders type-appropriate chrome:
 *   - ``youtube``: a static thumbnail (NO embed, NO iframe — privacy) +
 *     title + duration. Falls back to a video-icon placeholder offline or
 *     when the thumbnail fails to load.
 *   - ``podcast`` / ``article`` / ``book`` / ``course`` / ``website``: a
 *     Lucide type icon + title.
 *
 * Every card is a single external link (``target="_blank"`` +
 * ``rel="noopener noreferrer"``). It shows a language badge, a level badge
 * (when present), and a free/paid badge. Token-backed Tailwind only; the
 * tap target stays >= 44px.
 *
 * App-agnostic: all data + the optional click hook come in through props; it
 * imports no app state.
 *
 * @example
 * <ResourceCard resource={{ type: "youtube", title: "…", url: "…", domain: "ai" }} />
 */

import {
  BookOpen,
  ExternalLink,
  FileText,
  Globe,
  GraduationCap,
  Mic,
  Video,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useI18n } from "../../hooks/ui/useI18n";
import YouTubeThumbnail from "./YouTubeThumbnail";

/** Media kinds this card knows how to render. Local (no app import) so the
 *  component stays app-agnostic; the app's ``MediaType`` is the same union
 *  and is structurally assignable (#1021). */
export type ResourceMediaType =
  | "youtube"
  | "podcast"
  | "article"
  | "book"
  | "course"
  | "website";

/** The minimal structural shape this card renders. The app's richer
 *  ``MediaResource`` is structurally assignable; the generic ``T`` flows
 *  the real type through ``onClick`` unchanged. */
export interface DisplayResource {
  type: ResourceMediaType;
  title: string;
  url: string;
  description?: string | null;
  duration?: string | null;
  language?: string | null;
  level?: string | null;
  free?: boolean | null;
  paid?: boolean | null;
}

interface ResourceCardProps<T extends DisplayResource = DisplayResource> {
  resource: T;
  /** Optional click hook (analytics / tracking). The default navigation
   *  happens through the anchor regardless. */
  onClick?: (resource: T) => void;
}

const TYPE_ICON: Record<ResourceMediaType, LucideIcon> = {
  youtube: Video,
  podcast: Mic,
  article: FileText,
  book: BookOpen,
  course: GraduationCap,
  website: Globe,
};

/** Uppercase a 2-letter language code for the badge (``en`` -> ``EN``). */
function languageBadge(language: string | null | undefined): string | null {
  if (!language) return null;
  return language.length <= 3 ? language.toUpperCase() : language;
}

export default function ResourceCard<T extends DisplayResource>({
  resource,
  onClick,
}: ResourceCardProps<T>) {
  const { t } = useI18n();
  const Icon = TYPE_ICON[resource.type] ?? Globe;
  const lang = languageBadge(resource.language);
  const isYouTube = resource.type === "youtube";

  return (
    <Card className="overflow-hidden" data-testid="resource-card">
      <a
        href={resource.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => onClick?.(resource)}
        className="flex min-h-11 gap-3 p-3 no-underline text-fg-primary hover:bg-muted/50"
        data-testid="resource-card-link"
        data-type={resource.type}
      >
        {isYouTube ? (
          <YouTubeThumbnail
            url={resource.url}
            title={resource.title}
            className="h-[72px] w-32 shrink-0 rounded-md"
          />
        ) : (
          <div
            className="flex size-12 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
            aria-hidden="true"
          >
            <Icon className="size-6" />
          </div>
        )}

        <div className="flex min-w-0 grow flex-col gap-1">
          <div className="flex items-start gap-2">
            <p className="grow font-medium leading-snug">{resource.title}</p>
            <ExternalLink
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
          </div>

          {resource.description ? (
            <p className="line-clamp-2 text-sm text-muted-foreground">
              {resource.description}
            </p>
          ) : null}

          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            {lang ? (
              <Badge variant="secondary" data-testid="resource-card-language">
                {lang}
              </Badge>
            ) : null}
            {resource.level ? (
              <Badge variant="outline" data-testid="resource-card-level">
                {resource.level}
              </Badge>
            ) : null}
            {resource.duration ? (
              <span
                className="text-xs text-muted-foreground"
                data-testid="resource-card-duration"
              >
                {resource.duration}
              </span>
            ) : null}
            {/* Free / paid hint (MED-04): course defaults to paid when
                ``free`` is unset; otherwise only render when explicit. */}
            {resource.free === true ? (
              <Badge variant="outline" data-testid="resource-card-free">
                {t("resource.free", "Free")}
              </Badge>
            ) : resource.free === false ||
              (resource.type === "course" && resource.free == null) ? (
              <Badge variant="secondary" data-testid="resource-card-paid">
                {t("resource.paid", "Course")}
              </Badge>
            ) : null}
          </div>
        </div>
      </a>
    </Card>
  );
}
