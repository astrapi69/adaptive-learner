/**
 * Tests for RepoCategoryBadge (#1319). Pins that each unified category renders
 * its localized label, its ``data-category`` marker, and the given test id.
 */

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import RepoCategoryBadge from "./RepoCategoryBadge";
import type { RepoCategory } from "../../lib/content/repos/content-repos";

const t = (_k: string, fallback?: string) => fallback ?? _k;

describe("RepoCategoryBadge", () => {
  const cases: Array<[RepoCategory, string]> = [
    ["official", "Official"],
    ["private", "Private"],
    ["validated", "Validated"],
    ["unverified", "Unverified"],
  ];

  it.each(cases)("renders the %s category label + marker", (category, label) => {
    render(<RepoCategoryBadge category={category} t={t} />);
    const badge = screen.getByTestId("repo-category-badge");
    expect(badge).toHaveTextContent(label);
    expect(badge).toHaveAttribute("data-category", category);
  });

  it("honours a custom testId", () => {
    render(
      <RepoCategoryBadge category="private" t={t} testId="content-repo-category-a-b" />,
    );
    expect(screen.getByTestId("content-repo-category-a-b")).toBeInTheDocument();
  });
});
