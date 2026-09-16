/**
 * useTabSections - the ``?section=`` state of one Settings tab's section
 * bar (#3122), the tab-agnostic core behind {@link useLearningSections}
 * (#2961) and the Data tab (#3122).
 *
 * Owns three things for a panel: which sections exist right now (the
 * caller passes the rendered subset), which chip is active, and the
 * scroll a section request triggers. The request comes from the URL
 * (``?tab=<tab>&section=<id>``, validated against the rendered sections;
 * an unknown or absent cluster is ignored) or from a chip click, which
 * writes the same param with replace-state so the browser history does
 * not grow per click. The scroll is deferred (``useDeferredScroll``): the
 * panel may still be ``hidden`` when the request arrives, and the cluster
 * only gets layout once it is visible. Reduced motion turns the smooth
 * scroll into an instant one.
 *
 * The active chip (#2966) is the request while its scroll is in flight;
 * once the scroll reports the cluster in view, the scroll-spy
 * (``useScrollSpy``) takes over and the chip follows whatever cluster the
 * viewport shows. Where no observer exists the request stays active.
 *
 * @example
 * const { activeSection, openSection } = useTabSections({
 *   active,
 *   sections: DATA_SECTIONS,
 *   isSectionId: isDataSectionId,
 *   anchorId: dataSectionAnchorId,
 * });
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";

import { useDeferredScroll } from "../../../../hooks/ui/useDeferredScroll";
import { useScrollSpy } from "../../../../hooks/ui/useScrollSpy";
import { prefersReducedMotion } from "../../../../lib/feedback/feedbackPref";
import type { TabSectionDef } from "../../../../lib/settings/tab-sections";

/** The query parameter every tab's section bar reads and writes. */
const TAB_SECTION_PARAM = "section";

export interface TabSectionsOptions<Id extends string> {
  /** Whether the tab is visible (the scroll waits for it). */
  active: boolean;
  /** The sections rendered right now, in tab order. */
  sections: readonly TabSectionDef<Id>[];
  /** Type guard for the tab's section ids. */
  isSectionId: (value: string | null | undefined) => value is Id;
  /** The DOM id of a section's cluster anchor. */
  anchorId: (id: Id) => string;
  /** Sticky chrome height in px; the scroll-spy band starts below it. */
  topOffset?: number;
}

export interface TabSectionsState<Id extends string> {
  /** The chip to mark active: the in-flight request, else the spied cluster, else the request. */
  activeSection: Id | null;
  /** Chip click handler: write ``?section=`` (replace) and scroll there. */
  openSection: (id: string) => void;
}

export function useTabSections<Id extends string>({
  active,
  sections,
  isSectionId,
  anchorId,
  topOffset = 0,
}: TabSectionsOptions<Id>): TabSectionsState<Id> {
  const [searchParams, setSearchParams] = useSearchParams();

  const rawRequest = searchParams.get(TAB_SECTION_PARAM);
  const requested: Id | null =
    isSectionId(rawRequest) && sections.some((section) => section.id === rawRequest)
      ? rawRequest
      : null;

  // The scroll in flight; cleared once the target reached the viewport
  // (or the frame budget ran out), re-armed by every new request.
  const [pending, setPending] = useState<Id | null>(requested);
  useEffect(() => {
    if (requested !== null) setPending(requested);
  }, [requested]);

  useDeferredScroll({
    active: active && pending !== null,
    target: pending,
    findTarget: (id) => document.getElementById(anchorId(id)),
    onSettled: () => setPending(null),
    behavior: prefersReducedMotion() ? "auto" : "smooth",
  });

  const spied = useScrollSpy(
    useMemo(() => sections.map((section) => section.id), [sections]),
    {
      enabled: active,
      resolve: (id) => document.getElementById(anchorId(id)),
      topOffset,
    },
  );

  const openSection = useCallback(
    (id: string) => {
      if (!isSectionId(id)) return;
      setSearchParams(
        (prev) => {
          prev.set(TAB_SECTION_PARAM, id);
          return prev;
        },
        { replace: true },
      );
      setPending(id);
    },
    [isSectionId, setSearchParams],
  );

  return { activeSection: pending ?? spied ?? requested, openSection };
}
