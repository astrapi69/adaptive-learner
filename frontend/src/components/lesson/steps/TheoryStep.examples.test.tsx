/**
 * Schema v1.5 (#1326) — a theory step renders its optional inline
 * ``examples`` under the body, distinct from the external ``example_url``
 * link. Text and code examples both surface.
 */

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../hooks/ui/useI18n", () => ({
  useI18n: () => ({ t: (_k: string, fb?: string) => fb ?? _k, lang: "en" }),
}));

import TheoryStep from "./TheoryStep";
import type { ReadAloudController } from "../../../hooks/lesson/audio/useReadAloud";

const tts = {
  enabled: false,
  speaking: false,
  activeId: null,
  boundaryIndex: -1,
  speak: vi.fn(),
  stop: vi.fn(),
} as unknown as ReadAloudController;

describe("TheoryStep inline examples (#1326)", () => {
  it("renders text + code examples under the body", () => {
    render(
      <TheoryStep
        body="A component returns JSX."
        stepId="s1"
        tts={tts}
        lessonRewriteFn={(b) => b}
        onAnchorClick={vi.fn()}
        examples={[
          { content: "Bonjour !", title: "Sample sentence" },
          { content: "const x = 1;", language: "javascript" },
        ]}
      />,
    );
    expect(screen.getByTestId("step-examples-theory")).toBeInTheDocument();
    expect(screen.getByText("Bonjour !")).toBeInTheDocument();
    // Code example goes through CodeBlock.
    expect(screen.getByTestId("code-block")).toBeInTheDocument();
  });

  it("renders no examples block when none are supplied", () => {
    render(
      <TheoryStep
        body="No examples here."
        stepId="s1"
        tts={tts}
        lessonRewriteFn={(b) => b}
        onAnchorClick={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("step-examples-theory")).toBeNull();
  });
});
