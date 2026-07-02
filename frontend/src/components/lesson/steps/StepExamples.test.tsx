/**
 * Schema v1.5 (#1326) — inline worked examples renderer. Text examples
 * render as plain blocks; code examples (``language`` set) render through
 * the shared CodeBlock. Both theory (context="theory") and exercise
 * (context="exercise") surfaces reuse this component.
 */

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../hooks/ui/useI18n", () => ({
  useI18n: () => ({ t: (_k: string, fb?: string) => fb ?? _k, lang: "en" }),
}));

import StepExamples from "./StepExamples";
import type { ContentLessonExample } from "../../../storage/types";

describe("StepExamples (#1326)", () => {
  it("renders a text example as a plain block (no code block)", () => {
    const examples: ContentLessonExample[] = [
      { content: "Bonjour tout le monde !", title: "Greeting" },
    ];
    render(<StepExamples examples={examples} context="theory" />);
    expect(screen.getByText("Bonjour tout le monde !")).toBeInTheDocument();
    // The eyebrow label + title show.
    expect(screen.getByText(/Example: Greeting/)).toBeInTheDocument();
    // No code block for a text example.
    expect(screen.queryByTestId("code-block")).toBeNull();
  });

  it("renders a code example via the shared CodeBlock", () => {
    const examples: ContentLessonExample[] = [
      { content: "function App() {\n  return <h1>Hi</h1>;\n}", language: "jsx" },
    ];
    render(<StepExamples examples={examples} context="exercise" />);
    expect(screen.getByTestId("code-block")).toBeInTheDocument();
    expect(screen.getByTestId("step-examples-exercise")).toBeInTheDocument();
  });

  it("renders nothing for an empty list", () => {
    const { container } = render(
      <StepExamples examples={[]} context="theory" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("carries a context-specific test id", () => {
    render(
      <StepExamples examples={[{ content: "x" }]} context="theory" />,
    );
    expect(screen.getByTestId("step-examples-theory")).toBeInTheDocument();
  });
});
