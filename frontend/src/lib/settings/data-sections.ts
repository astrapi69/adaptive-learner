/**
 * The Data tab's section model (#3122) - pure data, no JSX, no i18n; the
 * Data-tab twin of ``learning-sections.ts`` (#2961).
 *
 * One entry per ``SettingsCluster`` on Settings > Data, in the #1451 causal
 * order the tab renders them (source -> sync -> what results -> securing ->
 * cleanup -> danger). The section bar renders these as chips,
 * ``?tab=data&section=<id>`` deep links validate against the id list, and
 * the anchor id mirrors what ``SettingsCluster`` gives its ``<section>``
 * (``data-<id>``). Labels are the cluster i18n keys the panel uses, so a
 * chip and its cluster heading can never say two different things.
 *
 * @example
 * const section = searchParams.get(DATA_SECTION_PARAM);
 * if (isDataSectionId(section)) {
 *   document.getElementById(dataSectionAnchorId(section))?.scrollIntoView();
 * }
 */

import type { TabSectionDef } from "./tab-sections";

/** Query parameter carrying the requested section (shared with the Learning tab). */
export const DATA_SECTION_PARAM = "section";

/** Section ids in the #1451 tab order; the danger zone stays last. */
export const DATA_SECTION_IDS = [
  "sources",
  "sync",
  "offline",
  "backup",
  "cleanup",
  "danger",
] as const;

export type DataSectionId = (typeof DATA_SECTION_IDS)[number];

/** A section bar entry: the cluster id plus its i18n label key and English fallback. */
export type DataSectionDef = TabSectionDef<DataSectionId>;

const FALLBACKS: Record<DataSectionId, string> = {
  sources: "Sources",
  sync: "Sync",
  offline: "Offline content",
  backup: "Backup and export",
  cleanup: "Housekeeping",
  danger: "Danger zone",
};

export const DATA_SECTIONS: readonly DataSectionDef[] = DATA_SECTION_IDS.map((id) => ({
  id,
  labelKey: `settings.cluster_data_${id}`,
  fallback: FALLBACKS[id],
}));

/** True when ``value`` names one of the Data sections (an unknown ``?section=`` is ignored). */
export function isDataSectionId(value: string | null | undefined): value is DataSectionId {
  return typeof value === "string" && (DATA_SECTION_IDS as readonly string[]).includes(value);
}

/** The DOM id ``SettingsCluster`` gives the section ``<section>``: ``data-<id>``. */
export function dataSectionAnchorId(id: DataSectionId): string {
  return `data-${id}`;
}
