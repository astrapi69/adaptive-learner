/**
 * The Learning tab's section model (#2961) - pure data, no JSX, no i18n.
 *
 * One entry per ``SettingsCluster`` on Settings > Learning, in the #1459
 * causal order the tab renders them. The section bar renders these as
 * chips, ``?tab=learning&section=<id>`` deep links validate against the
 * id list, and the anchor id mirrors what ``SettingsCluster`` gives its
 * ``<section>`` (``learning-<id>``). Labels are the cluster i18n keys the
 * panel already uses, so a chip and its cluster heading can never say two
 * different things.
 *
 * @example
 * const section = searchParams.get(LEARNING_SECTION_PARAM);
 * if (isLearningSectionId(section)) {
 *   document.getElementById(learningSectionAnchorId(section))?.scrollIntoView();
 * }
 */

/** Query parameter carrying the requested section (``?section=<id>``). */
export const LEARNING_SECTION_PARAM = "section";

/** Section ids in tab order; the ``voice`` cluster is rendered only with Web Speech support. */
export const LEARNING_SECTION_IDS = ["basics", "lessons", "voice", "review", "motivation"] as const;

export type LearningSectionId = (typeof LEARNING_SECTION_IDS)[number];

/** A section bar entry: the cluster id plus its i18n label key and English fallback. */
export interface LearningSectionDef {
  id: LearningSectionId;
  labelKey: string;
  fallback: string;
}

const FALLBACKS: Record<LearningSectionId, string> = {
  basics: "Basics",
  lessons: "In the lesson",
  voice: "Reading aloud and dictation",
  review: "After the lesson",
  motivation: "Motivation and routine",
};

export const LEARNING_SECTIONS: readonly LearningSectionDef[] = LEARNING_SECTION_IDS.map(
  (id) => ({ id, labelKey: `settings.cluster_${id}`, fallback: FALLBACKS[id] }),
);

/** True when ``value`` names one of the Learning sections (an unknown ``?section=`` is ignored). */
export function isLearningSectionId(value: string | null | undefined): value is LearningSectionId {
  return typeof value === "string" && (LEARNING_SECTION_IDS as readonly string[]).includes(value);
}

/** The DOM id ``SettingsCluster`` gives the section ``<section>``: ``learning-<id>``. */
export function learningSectionAnchorId(id: LearningSectionId): string {
  return `learning-${id}`;
}
