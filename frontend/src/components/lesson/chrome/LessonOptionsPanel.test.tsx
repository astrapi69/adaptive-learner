/**
 * Tests for LessonOptionsPanel (#1625): the collapsible group that bundles
 * the lesson's mode/display settings (favorite, mode toggle, auto
 * read-aloud) so they stop eating vertical space above the exercise.
 *
 * RED-first: default collapsed, toggle opens/closes, summary label shows
 * while collapsed, children stay reachable + functional when expanded, and
 * the disclosure is wired for a11y (aria-expanded + aria-controls).
 */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import LessonOptionsPanel from "./LessonOptionsPanel";

describe("LessonOptionsPanel", () => {
  it("starts collapsed by default (children hidden)", () => {
    render(
      <LessonOptionsPanel summary="Üben">
        <button data-testid="child-control">child</button>
      </LessonOptionsPanel>,
    );
    expect(screen.getByTestId("lesson-options-toggle")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.getByTestId("child-control")).not.toBeVisible();
  });

  it("shows the current-mode summary while collapsed", () => {
    render(
      <LessonOptionsPanel summary="Auf Zeit">
        <span />
      </LessonOptionsPanel>,
    );
    expect(screen.getByTestId("lesson-options-toggle")).toHaveTextContent(
      "Auf Zeit",
    );
  });

  it("expands on click, revealing the controls", () => {
    render(
      <LessonOptionsPanel summary="Üben">
        <button data-testid="child-control">child</button>
      </LessonOptionsPanel>,
    );
    fireEvent.click(screen.getByTestId("lesson-options-toggle"));
    expect(screen.getByTestId("lesson-options-toggle")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByTestId("child-control")).toBeVisible();
  });

  it("collapses again on a second click", () => {
    render(
      <LessonOptionsPanel summary="Üben">
        <button data-testid="child-control">child</button>
      </LessonOptionsPanel>,
    );
    const toggle = screen.getByTestId("lesson-options-toggle");
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByTestId("child-control")).not.toBeVisible();
  });

  it("keeps children reachable + functional when expanded", () => {
    const onClick = vi.fn();
    render(
      <LessonOptionsPanel summary="Üben">
        <button data-testid="child-control" onClick={onClick}>
          child
        </button>
      </LessonOptionsPanel>,
    );
    fireEvent.click(screen.getByTestId("lesson-options-toggle"));
    fireEvent.click(screen.getByTestId("child-control"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("wires the trigger to the body via aria-controls", () => {
    render(
      <LessonOptionsPanel summary="Üben">
        <span />
      </LessonOptionsPanel>,
    );
    const toggle = screen.getByTestId("lesson-options-toggle");
    const body = screen.getByTestId("lesson-options-body");
    expect(body.id).toBeTruthy();
    expect(toggle).toHaveAttribute("aria-controls", body.id);
  });
});
