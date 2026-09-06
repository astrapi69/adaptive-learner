/**
 * useLearningSections - the Learning tab's ``?section=`` state (#2961).
 *
 * Owns three things for {@link ./LearningPanel}: which sections exist
 * right now (the voice cluster only with Web Speech support), which chip
 * is active, and the scroll a section request triggers. The request comes
 * from the URL (``?tab=learning&section=<id>``, validated against the
 * rendered sections - an unknown or absent cluster is ignored) or from a
 * chip click, which writes the same param with replace-state so the
 * browser history does not grow per click. The scroll is deferred
 * (``useDeferredScroll``): the panel may still be ``hidden`` when the
 * request arrives, and the cluster only gets layout once it is visible.
 * Reduced motion turns the smooth scroll into an instant one.
 *
 * @example
 * const { sections, activeSection, openSection } = useLearningSections({ active, speechSupported });
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";

import { useDeferredScroll } from "../../../../hooks/settings/useDeferredScroll";
import { prefersReducedMotion } from "../../../../lib/feedback/feedbackPref";
import {
  LEARNING_SECTIONS,
  LEARNING_SECTION_PARAM,
  isLearningSectionId,
  learningSectionAnchorId,
} from "../../../../lib/settings/learning-sections";
import type { LearningSectionDef, LearningSectionId } from "../../../../lib/settings/learning-sections";

export interface LearningSectionsOptions {
  /** Whether the Learning tab is visible (the scroll waits for it). */
  active: boolean;
  /** Whether the voice cluster is rendered. */
  speechSupported: boolean;
}

export interface LearningSectionsState {
  /** The sections rendered right now, in tab order. */
  sections: readonly LearningSectionDef[];
  /** The chip to mark active: the requested section, or ``null``. */
  activeSection: LearningSectionId | null;
  /** Chip click handler: write ``?section=`` (replace) and scroll there. */
  openSection: (id: string) => void;
}

export function useLearningSections({
  active,
  speechSupported,
}: LearningSectionsOptions): LearningSectionsState {
  const [searchParams, setSearchParams] = useSearchParams();
  const sections = useMemo(
    () => LEARNING_SECTIONS.filter((section) => section.id !== "voice" || speechSupported),
    [speechSupported],
  );

  const rawRequest = searchParams.get(LEARNING_SECTION_PARAM);
  const requested: LearningSectionId | null =
    isLearningSectionId(rawRequest) && sections.some((section) => section.id === rawRequest)
      ? rawRequest
      : null;

  // The scroll in flight; cleared once the target reached the viewport
  // (or the frame budget ran out), re-armed by every new request.
  const [pending, setPending] = useState<LearningSectionId | null>(requested);
  useEffect(() => {
    if (requested !== null) setPending(requested);
  }, [requested]);

  useDeferredScroll({
    active: active && pending !== null,
    target: pending,
    findTarget: (id) => document.getElementById(learningSectionAnchorId(id)),
    onSettled: () => setPending(null),
    behavior: prefersReducedMotion() ? "auto" : "smooth",
  });

  const openSection = useCallback(
    (id: string) => {
      if (!isLearningSectionId(id)) return;
      setSearchParams(
        (prev) => {
          prev.set(LEARNING_SECTION_PARAM, id);
          return prev;
        },
        { replace: true },
      );
      setPending(id);
    },
    [setSearchParams],
  );

  return { sections, activeSection: requested, openSection };
}
