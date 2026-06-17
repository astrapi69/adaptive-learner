import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import AiCheckedBadge from "./AiCheckedBadge";

const LABELS = {
  verifiedLabel: "AI-checked",
  staleLabel: "AI-check outdated",
  invalidLabel: "AI-check invalid",
};

describe("AiCheckedBadge", () => {
  it("renders nothing when not checked", () => {
    const { container } = render(
      <AiCheckedBadge status="none" {...LABELS} testId="badge" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders a green verified pill", () => {
    render(<AiCheckedBadge status="verified" {...LABELS} testId="badge" />);
    const badge = screen.getByTestId("badge");
    expect(badge).toHaveTextContent("AI-checked");
    expect(badge).toHaveAttribute("data-status", "verified");
    expect(badge.className).toContain("text-success");
  });

  it("renders a warning pill when stale", () => {
    render(<AiCheckedBadge status="stale" {...LABELS} testId="badge" />);
    const badge = screen.getByTestId("badge");
    expect(badge).toHaveTextContent("AI-check outdated");
    expect(badge.className).toContain("text-warning");
  });

  it("renders an error pill when invalid", () => {
    render(<AiCheckedBadge status="invalid" {...LABELS} testId="badge" />);
    const badge = screen.getByTestId("badge");
    expect(badge).toHaveTextContent("AI-check invalid");
    expect(badge.className).toContain("text-error");
  });
});
