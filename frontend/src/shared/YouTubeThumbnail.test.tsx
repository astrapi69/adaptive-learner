import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import YouTubeThumbnail from "./YouTubeThumbnail";

const ID = "aircAruvnKk";

function setOnline(value: boolean): void {
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value,
  });
}

afterEach(() => {
  setOnline(true);
});

describe("YouTubeThumbnail", () => {
  it("renders the static thumbnail image (no iframe) when online with a valid URL", () => {
    setOnline(true);
    render(<YouTubeThumbnail url={`https://youtu.be/${ID}`} title="Nets" />);
    const img = screen.getByTestId("youtube-thumbnail-img");
    expect(img).toHaveAttribute(
      "src",
      `https://img.youtube.com/vi/${ID}/mqdefault.jpg`,
    );
    expect(img).toHaveAttribute("loading", "lazy");
    expect(img).toHaveAttribute("alt", "Nets");
    expect(document.querySelector("iframe")).toBeNull();
  });

  it("falls back to the placeholder for a non-video URL", () => {
    render(
      <YouTubeThumbnail
        url="https://www.youtube.com/@EasyFrench"
        title="Channel"
      />,
    );
    expect(
      screen.getByTestId("youtube-thumbnail-placeholder"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("youtube-thumbnail-img")).toBeNull();
  });

  it("shows the placeholder when offline and does not request the image", () => {
    setOnline(false);
    render(<YouTubeThumbnail url={`https://youtu.be/${ID}`} title="Nets" />);
    expect(
      screen.getByTestId("youtube-thumbnail-placeholder"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("youtube-thumbnail-img")).toBeNull();
  });

  it("falls back to the placeholder when the image fails to load", () => {
    render(<YouTubeThumbnail url={`https://youtu.be/${ID}`} title="Nets" />);
    fireEvent.error(screen.getByTestId("youtube-thumbnail-img"));
    expect(
      screen.getByTestId("youtube-thumbnail-placeholder"),
    ).toBeInTheDocument();
  });
});
