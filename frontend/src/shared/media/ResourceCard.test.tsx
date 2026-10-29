import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { MediaResource } from "../../lib/content/media/media-loader";
import ResourceCard from "./ResourceCard";

vi.mock("../../hooks/ui/useI18n", () => ({
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

  it("reproduction (#3803): a single YouTube video shows a local placeholder, no thumbnail from img.youtube.com", () => {
    const { container } = render(
      <ResourceCard
        resource={make({
          type: "youtube",
          url: "https://www.youtube.com/watch?v=aircAruvnKk",
        })}
      />,
    );
    const link = screen.getByTestId("resource-card-link");
    expect(
      link.querySelector('[data-testid="youtube-thumbnail-placeholder"]'),
    ).not.toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(container.innerHTML).not.toContain("img.youtube.com");
    // No embedded player either.
    expect(container.querySelector("iframe")).toBeNull();
  });

  it.each([
    ["a watch URL inside a playlist", "https://www.youtube.com/watch?v=a0_lo_GDcFw&list=PLZZWrBYkx7Otcjr3eCLZDCgfpqnxMY29s"],
    ["a youtu.be short link", "https://youtu.be/vo4pMVb0R6M"],
    ["a shorts URL", "https://www.youtube.com/shorts/aircAruvnKk"],
    ["an embed URL on the nocookie host", "https://www.youtube-nocookie.com/embed/aircAruvnKk"],
    ["a channel URL", "https://www.youtube.com/@3blue1brown"],
  ])("%s gets the same placeholder and loads nothing", (_name, url) => {
    const { container } = render(
      <ResourceCard resource={make({ type: "youtube", url })} />,
    );
    expect(screen.getByTestId("youtube-thumbnail-placeholder")).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });

  it("opens the video on YouTube only through the link, in a new tab", () => {
    render(
      <ResourceCard
        resource={make({
          type: "youtube",
          url: "https://www.youtube.com/watch?v=aircAruvnKk",
        })}
      />,
    );
    const link = screen.getByTestId("resource-card-link");
    expect(link).toHaveAttribute("href", "https://www.youtube.com/watch?v=aircAruvnKk");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("shows a type icon, not the video placeholder, for non-youtube resources", () => {
    render(<ResourceCard resource={make({ type: "podcast" })} />);
    expect(screen.queryByTestId("youtube-thumbnail-placeholder")).toBeNull();
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
