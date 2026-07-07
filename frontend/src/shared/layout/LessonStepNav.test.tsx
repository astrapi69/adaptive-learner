/**
 * Tests for LessonStepNav — the shared two-phase step-navigation footer
 * (Review + Shuffle players), plus the #1419 dead-class sweep.
 *
 * #1419: the component referenced the ``.lesson-nav*`` CSS classes that the
 * Tailwind Phase B migration deleted (only Lesson.tsx was migrated), so the
 * bar rendered unstyled — not sticky, no safe-area padding. It now carries
 * the same sticky-footer pattern as ``LessonFooterNav`` (#43/#1410), and no
 * ``lesson-nav*`` class may reappear anywhere in ``src/``.
 */

import "@testing-library/jest-dom/vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import LessonStepNav from "./LessonStepNav";

const LABELS = {
  navAria: "Step navigation",
  prev: "Previous",
  check: "Check",
  checkDisabledHint: "Answer the exercise first",
  next: "Next",
  finish: "Finish lesson",
};

const BASE = {
  testIdPrefix: "review",
  isSummary: false,
  isExerciseStep: true,
  checked: false,
  answerable: true,
  isFirstStep: false,
  isLastStep: false,
  onPrev: () => {},
  onNext: () => {},
  onCheck: () => {},
  labels: LABELS,
};

describe("LessonStepNav — two-phase flow", () => {
  it("shows Previous + Check on an unchecked exercise step", () => {
    render(<LessonStepNav {...BASE} />);
    expect(screen.getByTestId("review-prev")).toBeInTheDocument();
    expect(screen.getByTestId("review-check")).toBeInTheDocument();
    expect(screen.queryByTestId("review-next")).not.toBeInTheDocument();
  });

  it("shows Next once checked and fires onNext", () => {
    const onNext = vi.fn();
    render(<LessonStepNav {...BASE} checked onNext={onNext} />);
    const next = screen.getByTestId("review-next");
    fireEvent.click(next);
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("gates Check on answerable and disables Previous on the first step", () => {
    render(<LessonStepNav {...BASE} answerable={false} isFirstStep />);
    expect(screen.getByTestId("review-check")).toBeDisabled();
    expect(screen.getByTestId("review-prev")).toBeDisabled();
  });

  it("hides the trailing button on the summary screen", () => {
    render(<LessonStepNav {...BASE} isSummary />);
    expect(screen.queryByTestId("review-next")).not.toBeInTheDocument();
    expect(screen.queryByTestId("review-check")).not.toBeInTheDocument();
  });
});

describe("LessonStepNav — sticky footer pattern (#1419)", () => {
  it("carries the LessonFooterNav sticky + safe-area pattern, no dead class", () => {
    render(<LessonStepNav {...BASE} />);
    const nav = screen.getByLabelText(LABELS.navAria);
    expect(nav.className).toContain("sticky");
    expect(nav.className).toContain("bottom-0");
    expect(nav.className).toContain("pb-safe");
    expect(nav.className).toContain("pt-3");
    expect(nav.className).not.toContain("lesson-nav");
  });

  it("right-aligns the trailing action button (ml-auto)", () => {
    render(<LessonStepNav {...BASE} />);
    expect(screen.getByTestId("review-check").className).toContain("ml-auto");
  });
});

describe("no lesson-nav* dead class anywhere in src/ (#1419)", () => {
  const HERE = dirname(fileURLToPath(import.meta.url));
  const SRC = join(HERE, "..", "..");

  function tsxFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) return tsxFiles(full);
      if (!/\.tsx?$/.test(name) || /\.test\.tsx?$/.test(name)) return [];
      return [full];
    });
  }

  it("the deleted .lesson-nav* CSS classes are referenced nowhere", () => {
    // The Phase B migration removed the .lesson-nav* rules from global.css
    // ("migrated to Tailwind in Lesson.tsx") but left four lesson-style
    // players referencing them — an unstyled, non-sticky bar. Class names
    // matching lesson-nav (but not e.g. create-lesson-nav, which has live
    // CSS) must not come back.
    const offenders = tsxFiles(SRC).filter((file) =>
      /className="lesson-nav/.test(readFileSync(file, "utf8")),
    );
    expect(offenders).toEqual([]);
  });
});
