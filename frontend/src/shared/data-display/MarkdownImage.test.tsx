import { render, screen } from "@testing-library/react";
import Markdown from "react-markdown";
import { describe, expect, it } from "vitest";

import MarkdownImage from "./MarkdownImage";

function renderMarkdown(source: string) {
  return render(<Markdown components={{ img: MarkdownImage }}>{source}</Markdown>);
}

describe("MarkdownImage (#3803)", () => {
  it("offers an image from another host as a link with its alt text", () => {
    const { container } = renderMarkdown(
      "![Probebild](https://probe-image.example/pixel.png)",
    );
    const link = screen.getByTestId("markdown-remote-image");
    expect(link).toHaveTextContent("Probebild");
    expect(link).toHaveAttribute("href", "https://probe-image.example/pixel.png");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(container.querySelector("img")).toBeNull();
  });

  it.each([
    ["protocol-relative URL", "//probe-image.example/pixel.png"],
    ["upper-case scheme", "HTTPS://PROBE-IMAGE.EXAMPLE/pixel.png"],
  ])("treats a %s as another host", (_name, url) => {
    const { container } = renderMarkdown(`![x](${url})`);
    expect(screen.getByTestId("markdown-remote-image")).toHaveTextContent("x");
    expect(container.querySelector("img")).toBeNull();
  });

  it("names the address when the image has no alt text", () => {
    renderMarkdown("![](https://probe-image.example/pixel.png)");
    expect(screen.getByTestId("markdown-remote-image")).toHaveTextContent(
      "https://probe-image.example/pixel.png",
    );
  });

  it("keeps the author's title on the link", () => {
    renderMarkdown('![x](https://probe-image.example/p.png "Ein Titel")');
    expect(screen.getByTestId("markdown-remote-image")).toHaveAttribute(
      "title",
      "Ein Titel",
    );
  });

  it.each([
    ["relative path", "assets/diagram.png", "assets/diagram.png"],
    ["root-relative path", "/diagram.png", "/diagram.png"],
    [
      "same-origin absolute URL",
      `${window.location.origin}/diagram.png`,
      `${window.location.origin}/diagram.png`,
    ],
  ])("renders a %s as an image, as before", (_name, url, expected) => {
    const { container } = renderMarkdown(`![Diagramm](${url})`);
    const img = container.querySelector("img");
    expect(img).toHaveAttribute("src", expected);
    expect(img).toHaveAttribute("alt", "Diagramm");
    expect(screen.queryByTestId("markdown-remote-image")).toBeNull();
  });

  it.each([
    ["object URL (a downloaded asset)", "blob:http://localhost:3000/0b6e-4f2a"],
    ["embedded data URI", "data:image/png;base64,iVBORw0KGgo="],
  ])("renders an %s as an image", (_name, src) => {
    const { container } = render(<MarkdownImage src={src} alt="Asset" />);
    expect(container.querySelector("img")).toHaveAttribute("src", src);
    expect(screen.queryByTestId("markdown-remote-image")).toBeNull();
  });
});
