import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../hooks/useI18n", () => ({
  useI18n: () => ({ t: (_k: string, fallback: string) => fallback, lang: "en" }),
}));

import CodeBlock from "./CodeBlock";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("CodeBlock", () => {
  it("renders the code, language label, and copy button", () => {
    render(<CodeBlock code="print('hi')" language="python" />);
    expect(screen.getByTestId("code-block")).toBeInTheDocument();
    expect(screen.getByTestId("code-block-lang").textContent).toBe("python");
    expect(screen.getByTestId("code-block-copy")).toBeInTheDocument();
    // Plain-text fallback is shown before/without highlight.js.
    expect(screen.getByTestId("code-block").textContent).toContain(
      "print('hi')",
    );
  });

  it("copies the (trimmed) code to the clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    // happy-dom exposes navigator.clipboard as a getter-only property.
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    render(<CodeBlock code={"print('hi')\n"} language="python" />);
    fireEvent.click(screen.getByTestId("code-block-copy"));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("print('hi')"));
  });

  it("shows the Output block only when output is given", () => {
    const { rerender } = render(
      <CodeBlock code="x=1" language="python" output="1" />,
    );
    expect(screen.getByTestId("code-block-output")).toBeInTheDocument();
    expect(screen.getByTestId("code-block-output").textContent).toContain("1");

    rerender(<CodeBlock code="x=1" language="python" />);
    expect(screen.queryByTestId("code-block-output")).not.toBeInTheDocument();

    rerender(<CodeBlock code="x=1" language="python" output="   " />);
    expect(screen.queryByTestId("code-block-output")).not.toBeInTheDocument();
  });

  it("renders without a language label when none is given", () => {
    render(<CodeBlock code="=SVERWEIS(A2;B:D;3;FALSCH)" />);
    expect(screen.queryByTestId("code-block-lang")).not.toBeInTheDocument();
    expect(screen.getByTestId("code-block").textContent).toContain("SVERWEIS");
  });
});
