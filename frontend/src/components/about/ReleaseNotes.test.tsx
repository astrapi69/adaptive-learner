import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ReleaseNotes from "./ReleaseNotes";

const t = (_key: string, fallback?: string) => fallback ?? _key;

describe("ReleaseNotes", () => {
  it("renders the notes as Markdown", () => {
    render(<ReleaseNotes notes={"## Neu\n\n- **Fix** im Editor"} t={t} />);
    expect(screen.getByTestId("release-notes").querySelector("strong")).toHaveTextContent(
      "Fix",
    );
  });

  it("offers an image from another host as a link, never loads it (#3803)", () => {
    render(
      <ReleaseNotes notes={"![Screenshot](https://user-images.example/s.png)"} t={t} />,
    );
    expect(screen.getByTestId("release-notes").querySelector("img")).toBeNull();
    expect(screen.getByTestId("markdown-remote-image")).toHaveTextContent("Screenshot");
  });
});
