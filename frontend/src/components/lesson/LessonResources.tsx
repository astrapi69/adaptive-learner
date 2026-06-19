/**
 * LessonResources (EXP-029 / MED-04 + MED-05) — the "Vertiefe das Thema"
 * section shown after a lesson's summary.
 *
 * Two sources, with a fallback chain:
 *   1. Lesson-specific ``resources[]`` from the content JSON (MED-05),
 *      validated through {@link parseLessonResources}.
 *   2. Domain-level entries from the official ``media.yaml`` (MED-01),
 *      filtered to the set's domain.
 *
 * Layout:
 *   - lesson-specific only -> shown under the main heading;
 *   - domain-level only    -> shown under the main heading;
 *   - both                 -> lesson-specific first, domain-level below a
 *     "Mehr zum Thema {domain}" sub-heading (deduped by URL);
 *   - neither              -> nothing renders (no empty block).
 *
 * Each group is grouped by media type (Videos / Podcasts / Articles / …) and
 * rendered with the shared {@link ResourceCard}. Token-backed Tailwind;
 * cards stack on mobile and form two columns from ``sm`` up.
 */

import { useEffect, useMemo, useRef, useState } from "react";

import { useI18n } from "../../hooks/useI18n";
import {
  bookToMediaResource,
  effectiveMediaPriority,
  fetchMediaResources,
  mediaForDomain,
  parseLessonResources,
  type MediaResource,
  type MediaType,
} from "../../lib/content/media-loader";
import ResourceCard from "../../shared/media/ResourceCard";
import type { ContentLesson, ContentSetBook } from "../../storage/types";

interface LessonResourcesProps {
  lesson: ContentLesson;
  /** The set's domain, used when ``lesson.domain`` is absent. */
  setDomain?: string | null;
  /** #769 — the set's manifest book; auto-inserted as the first media
   *  item (priority 0) when present. */
  setBook?: ContentSetBook | null;
}

/** Tiebreak order of media-type groups at equal priority; only non-empty
 *  groups appear. */
const TYPE_ORDER: MediaType[] = [
  "youtube",
  "podcast",
  "article",
  "book",
  "course",
  "website",
];

/**
 * Group resources by type. Groups are ordered ascending by their minimum
 * effective priority (#769 — a priority-0 set book makes the "book" group
 * lead), with {@link TYPE_ORDER} as the tiebreak; items within a group are
 * sorted ascending by priority (stable for equal priorities).
 */
function groupByType(
  resources: MediaResource[],
): Array<{ type: MediaType; items: MediaResource[] }> {
  const groups = TYPE_ORDER.map((type) => ({
    type,
    items: resources
      .map((r, i) => ({ r, i }))
      .filter((x) => x.r.type === type)
      .sort(
        (a, b) =>
          effectiveMediaPriority(a.r) - effectiveMediaPriority(b.r) ||
          a.i - b.i,
      )
      .map((x) => x.r),
  })).filter((group) => group.items.length > 0);
  const minPriority = (items: MediaResource[]) =>
    Math.min(...items.map(effectiveMediaPriority));
  return groups
    .map((group, i) => ({ group, i }))
    .sort(
      (a, b) =>
        minPriority(a.group.items) - minPriority(b.group.items) || a.i - b.i,
    )
    .map((x) => x.group);
}

/** A localized, human-readable domain label for the "Mehr zum Thema" line. */
function useDomainLabel(domain: string): string {
  const { t } = useI18n();
  const capitalized = domain.charAt(0).toUpperCase() + domain.slice(1);
  return t(`content.tree.domain_${domain}`, capitalized);
}

/** One grouped block (a list of type-sections) under a heading. */
function ResourceGroups({ resources }: { resources: MediaResource[] }) {
  const { t } = useI18n();
  const groups = useMemo(() => groupByType(resources), [resources]);
  return (
    <>
      {groups.map((group) => (
        <div
          key={group.type}
          className="flex flex-col gap-2"
          data-testid={`lesson-resources-group-${group.type}`}
        >
          <h4 className="text-sm font-semibold text-muted-foreground">
            {t(`resource.type_${group.type}`, group.type)}
          </h4>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {group.items.map((resource, i) => (
              <ResourceCard key={`${resource.url}-${i}`} resource={resource} />
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

export default function LessonResources({
  lesson,
  setDomain,
  setBook,
}: LessonResourcesProps) {
  const { t } = useI18n();
  const domain = lesson.domain ?? setDomain ?? "";
  const domainLabel = useDomainLabel(domain);

  // #769 — the set's manifest book leads the section as a priority-0 book.
  const bookResource = useMemo(
    () => bookToMediaResource(setBook, domain),
    [setBook, domain],
  );

  const [domainMedia, setDomainMedia] = useState<MediaResource[]>([]);
  useEffect(() => {
    if (!domain) {
      setDomainMedia([]);
      return;
    }
    let cancelled = false;
    void fetchMediaResources().then((all) => {
      if (!cancelled) setDomainMedia(mediaForDomain(all, domain));
    });
    return () => {
      cancelled = true;
    };
  }, [domain]);

  const lessonResources = useMemo(
    () => parseLessonResources(lesson.resources, domain),
    [lesson.resources, domain],
  );

  // Fallback chain: lesson-specific is primary when present; otherwise the
  // domain media is primary. When both exist, domain media is the secondary
  // "more on this topic" block, deduped against the primary by URL.
  const hasLesson = lessonResources.length > 0;
  const basePrimary = hasLesson ? lessonResources : domainMedia;
  // Prepend the set book (deduped by URL) so it leads the section.
  const primary = useMemo(() => {
    if (!bookResource) return basePrimary;
    if (basePrimary.some((r) => r.url === bookResource.url)) return basePrimary;
    return [bookResource, ...basePrimary];
  }, [bookResource, basePrimary]);
  const primaryUrls = useMemo(
    () => new Set(primary.map((r) => r.url)),
    [primary],
  );
  const secondary = hasLesson
    ? domainMedia.filter((r) => !primaryUrls.has(r.url))
    : [];

  const hasContent = primary.length > 0 || secondary.length > 0;

  // EXP-029 / MED-06 — when opened from a content-browser media badge
  // (deep link ``#lesson-resources``), scroll the section into view.
  const sectionRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!hasContent) return;
    if (window.location.hash === "#lesson-resources") {
      sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [hasContent]);

  if (!hasContent) return null;

  return (
    <section
      ref={sectionRef}
      id="lesson-resources"
      className="lesson-resources mt-4 flex flex-col gap-3"
      data-testid="lesson-resources"
      aria-label={t("lesson.resources_title", "Explore further")}
    >
      <h3 className="text-lg font-semibold">
        {t("lesson.resources_title", "Explore further")}
      </h3>
      <ResourceGroups resources={primary} />

      {secondary.length > 0 && (
        <div
          className="mt-2 flex flex-col gap-3"
          data-testid="lesson-resources-domain"
        >
          <h4 className="text-base font-semibold">
            {t("lesson.resources_domain", "More on {domain}").replace(
              "{domain}",
              domainLabel,
            )}
          </h4>
          <ResourceGroups resources={secondary} />
        </div>
      )}
    </section>
  );
}
