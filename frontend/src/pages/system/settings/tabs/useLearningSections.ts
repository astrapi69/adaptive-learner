/**
 * useLearningSections - the Learning tab's ``?section=`` state (#2961).
 *
 * A thin wrapper over the tab-agnostic {@link useTabSections} (#3122):
 * it decides which Learning sections exist right now (the voice cluster
 * only with Web Speech support) and binds the Learning section model
 * (ids, anchors). Everything else - the deferred scroll of a request, the
 * replace-state chip click, the scroll-spy hand-over (#2966) - lives in
 * the shared hook.
 *
 * @example
 * const { sections, activeSection, openSection } = useLearningSections({ active, speechSupported });
 */

import { useMemo } from "react";

import {
  LEARNING_SECTIONS,
  isLearningSectionId,
  learningSectionAnchorId,
} from "../../../../lib/settings/learning-sections";
import type { LearningSectionDef, LearningSectionId } from "../../../../lib/settings/learning-sections";
import { useTabSections } from "./useTabSections";

export interface LearningSectionsOptions {
  /** Whether the Learning tab is visible (the scroll waits for it). */
  active: boolean;
  /** Whether the voice cluster is rendered. */
  speechSupported: boolean;
  /** Sticky chrome height in px; the scroll-spy band starts below it. */
  topOffset?: number;
}

export interface LearningSectionsState {
  /** The sections rendered right now, in tab order. */
  sections: readonly LearningSectionDef[];
  /** The chip to mark active: the in-flight request, else the spied cluster, else the request. */
  activeSection: LearningSectionId | null;
  /** Chip click handler: write ``?section=`` (replace) and scroll there. */
  openSection: (id: string) => void;
}

export function useLearningSections({
  active,
  speechSupported,
  topOffset = 0,
}: LearningSectionsOptions): LearningSectionsState {
  const sections = useMemo(
    () => LEARNING_SECTIONS.filter((section) => section.id !== "voice" || speechSupported),
    [speechSupported],
  );
  const { activeSection, openSection } = useTabSections<LearningSectionId>({
    active,
    sections,
    isSectionId: isLearningSectionId,
    anchorId: learningSectionAnchorId,
    topOffset,
  });
  return { sections, activeSection, openSection };
}
