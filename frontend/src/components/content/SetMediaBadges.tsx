/**
 * SetMediaBadges (EXP-029 / MED-06) — small, discreet icon badges on a
 * content-set row signalling which supplementary-media types are available
 * for the set (from ``media.yaml`` by domain and/or lesson ``resources[]``).
 *
 * Renders nothing when no media is available. Each badge is a small button;
 * activating any of them opens the set's first lesson (deep-linked to the
 * "Vertiefe das Thema" section). Lucide icons only — no emojis — and
 * token-backed Tailwind.
 */

import {
  BookOpen,
  FileText,
  Globe,
  GraduationCap,
  Mic,
  Video,
  type LucideIcon,
} from "lucide-react";

import { useI18n } from "../../hooks/ui/useI18n";
import type { MediaResource, MediaType } from "../../lib/content/media/media-loader";

interface SetMediaBadgesProps {
  /** All media available for the set (already filtered to its domain +
   *  any lesson-level resources). */
  resources: MediaResource[];
  /** Stable set id for the testid namespace. */
  setId: string;
  /** Open the set's first lesson (focused on its media section). */
  onOpen: () => void;
}

const TYPE_ICON: Record<MediaType, LucideIcon> = {
  youtube: Video,
  podcast: Mic,
  article: FileText,
  book: BookOpen,
  course: GraduationCap,
  website: Globe,
};

/** Stable display order for the badge row. */
const TYPE_ORDER: MediaType[] = [
  "youtube",
  "podcast",
  "article",
  "book",
  "course",
  "website",
];

export default function SetMediaBadges({
  resources,
  setId,
  onOpen,
}: SetMediaBadgesProps) {
  const { t } = useI18n();
  if (resources.length === 0) return null;

  const present = TYPE_ORDER.filter((type) =>
    resources.some((r) => r.type === type),
  );
  if (present.length === 0) return null;

  return (
    <span
      className="ml-2 inline-flex items-center gap-1"
      data-testid={`content-set-${setId}-media`}
    >
      {present.map((type) => {
        const Icon = TYPE_ICON[type];
        const label = t(`resource.type_${type}`, type);
        return (
          <button
            key={type}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpen();
            }}
            className="inline-flex size-6 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-fg-primary"
            title={label}
            aria-label={label}
            data-testid={`content-set-${setId}-media-${type}`}
          >
            <Icon className="size-4" aria-hidden="true" />
          </button>
        );
      })}
    </span>
  );
}
