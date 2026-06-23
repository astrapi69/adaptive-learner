/**
 * Tests for the lesson-header description toggle (#1043): the description
 * renders clamped (line-clamp-2), and the "show more" toggle stays hidden
 * when the text does not overflow two lines. (The overflow path itself is
 * layout-dependent — scrollHeight is 0 under happy-dom — so it is covered by
 * the manual/visual device check, not here.)
 */

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LessonDescription } from "./LessonHeader";

describe("LessonDescription", () => {
  it("renders the description text clamped to two lines", () => {
    render(<LessonDescription text="A short lesson description." />);
    const para = screen.getByTestId("lesson-description");
    expect(para).toHaveTextContent("A short lesson description.");
    expect(para.className).toContain("line-clamp-2");
  });

  it("hides the toggle when the text does not overflow two lines", () => {
    render(<LessonDescription text="Short." />);
    expect(
      screen.queryByTestId("lesson-description-toggle"),
    ).not.toBeInTheDocument();
  });
});
