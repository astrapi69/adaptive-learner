import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { MediaResource } from "../../lib/content/media-loader";
import SetMediaBadges from "./SetMediaBadges";

vi.mock("../../hooks/ui/useI18n", () => ({
  useI18n: () => ({
    t: (_k: string, fallback: string) => fallback,
    lang: "en",
  }),
}));

function res(type: MediaResource["type"]): MediaResource {
  return { type, title: type, url: "https://example.com/x", domain: "ai" };
}

describe("SetMediaBadges", () => {
  it("renders nothing when there is no media", () => {
    const { container } = render(
      <SetMediaBadges resources={[]} setId="s1" onOpen={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders one badge per present type, in order", () => {
    render(
      <SetMediaBadges
        resources={[res("article"), res("youtube"), res("youtube")]}
        setId="s1"
        onOpen={() => {}}
      />,
    );
    expect(screen.getByTestId("content-set-s1-media-youtube")).toBeInTheDocument();
    expect(screen.getByTestId("content-set-s1-media-article")).toBeInTheDocument();
    // No podcast badge when no podcast media.
    expect(screen.queryByTestId("content-set-s1-media-podcast")).toBeNull();
  });

  it("calls onOpen when a badge is clicked", () => {
    const onOpen = vi.fn();
    render(
      <SetMediaBadges resources={[res("youtube")]} setId="s1" onOpen={onOpen} />,
    );
    fireEvent.click(screen.getByTestId("content-set-s1-media-youtube"));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
