/**
 * The shape one Settings-tab section bar entry has (#3122): a cluster id
 * plus the i18n key and English fallback of its heading. Shared by the
 * Learning (#2961) and Data (#3122) section models so the generic
 * ``useTabSections`` hook can drive both bars.
 */
export interface TabSectionDef<Id extends string = string> {
  id: Id;
  labelKey: string;
  fallback: string;
}
