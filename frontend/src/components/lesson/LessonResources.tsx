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

import { useEffect, useMemo, useState } from "react";

import { useI18n } from "../../hooks/useI18n";
import {
  fetchMediaResources,
  mediaForDomain,
  parseLessonResources,
  type MediaResource,
  type MediaType,
} from "../../lib/content/media-loader";
import ResourceCard from "../../shared/ResourceCard";
import type { ContentLesson } from "../../storage/types";

interface LessonResourcesProps {
  lesson: ContentLesson;
  /** The set's domain, used when ``lesson.domain`` is absent. */
  setDomain?: string | null;
}

/** Render order of media-type groups; only non-empty groups appear. */
const TYPE_ORDER: MediaType[] = [
  "youtube",
  "podcast",
  "article",
  "book",
  "course",
  "website",
];

/** Group resources by type, preserving {@link TYPE_ORDER}. */
function groupByType(
  resources: MediaResource[],
): Array<{ type: MediaType; items: MediaResource[] }> {
  return TYPE_ORDER.map((type) => ({
    type,
    items: resources.filter((r) => r.type === type),
  })).filter((group) => group.items.length > 0);
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
}: LessonResourcesProps) {
  const { t } = useI18n();
  const domain = lesson.domain ?? setDomain ?? "";
  const domainLabel = useDomainLabel(domain);

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
  const primary = hasLesson ? lessonResources : domainMedia;
  const primaryUrls = useMemo(
    () => new Set(primary.map((r) => r.url)),
    [primary],
  );
  const secondary = hasLesson
    ? domainMedia.filter((r) => !primaryUrls.has(r.url))
    : [];

  if (primary.length === 0 && secondary.length === 0) return null;

  return (
    <section
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
