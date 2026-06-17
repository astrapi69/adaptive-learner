import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { MediaResource } from "../lib/content/media-loader";
import ResourceCard from "./ResourceCard";

vi.mock("../hooks/useI18n", () => ({
  useI18n: () => ({
    t: (_k: string, fallback: string) => fallback,
    lang: "en",
  }),
}));

function make(overrides: Partial<MediaResource>): MediaResource {
  return {
    type: "article",
    title: "Title",
    url: "https://example.com/x",
    domain: "ai",
    ...overrides,
  };
}

describe("ResourceCard", () => {
  it("renders an external link with target+rel safety attrs", () => {
    render(<ResourceCard resource={make({ title: "Wiki AI" })} />);
    const link = screen.getByTestId("resource-card-link");
    expect(link).toHaveAttribute("href", "https://example.com/x");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByText("Wiki AI")).toBeInTheDocument();
  });

  it("renders a YouTube thumbnail (no iframe) for a youtube resource", () => {
    render(
      <ResourceCard
        resource={make({
          type: "youtube",
          url: "https://www.youtube.com/watch?v=aircAruvnKk",
        })}
      />,
    );
    const img = screen.getByTestId("youtube-thumbnail-img");
    expect(img).toHaveAttribute(
      "src",
      "https://img.youtube.com/vi/aircAruvnKk/mqdefault.jpg",
    );
    expect(img).toHaveAttribute("loading", "lazy");
    // No embedded player.
    expect(document.querySelector("iframe")).toBeNull();
  });

  it("shows a type icon (not a thumbnail) for non-youtube resources", () => {
    render(<ResourceCard resource={make({ type: "podcast" })} />);
    expect(screen.queryByTestId("youtube-thumbnail-img")).toBeNull();
  });

  it("renders language + level badges when present", () => {
    render(
      <ResourceCard
        resource={make({ language: "de", level: "beginner" })}
      />,
    );
    expect(screen.getByTestId("resource-card-language")).toHaveTextContent("DE");
    expect(screen.getByTestId("resource-card-level")).toHaveTextContent(
      "beginner",
    );
  });

  it("shows a Free badge when free=true and a Course badge when free=false", () => {
    const { rerender } = render(
      <ResourceCard resource={make({ free: true })} />,
    );
    expect(screen.getByTestId("resource-card-free")).toBeInTheDocument();
    rerender(<ResourceCard resource={make({ type: "course", free: false })} />);
    expect(screen.getByTestId("resource-card-paid")).toBeInTheDocument();
  });

  it("treats a course with no free flag as paid", () => {
    render(<ResourceCard resource={make({ type: "course", free: null })} />);
    expect(screen.getByTestId("resource-card-paid")).toBeInTheDocument();
  });
});
