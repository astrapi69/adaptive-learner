import { describe, expect, it } from "vitest";

import { isForeignImageUrl, isRemoteImageUrl } from "./remote-image";

const PAGE = "https://astrapi69.github.io/adaptive-learner/lesson/a/b/01.json";

describe("isRemoteImageUrl", () => {
  it.each([
    ["https URL", "https://example.com/cat.png"],
    ["http URL", "http://example.com/cat.png"],
    ["upper-case scheme", "HTTPS://EXAMPLE.COM/cat.png"],
    ["surrounding whitespace", "  https://example.com/cat.png "],
  ])("treats a %s as remote", (_name, value) => {
    expect(isRemoteImageUrl(value)).toBe(true);
  });

  it.each([
    ["data URI", "data:image/png;base64,AAAA"],
    ["blob URL", "blob:https://astrapi69.github.io/0b6e"],
    ["assets path", "assets/cat.png"],
    ["root-relative path", "/adaptive-learner/cat.png"],
    ["empty string", ""],
  ])("treats a %s as not remote", (_name, value) => {
    expect(isRemoteImageUrl(value)).toBe(false);
  });
});

describe("isForeignImageUrl", () => {
  it("flags an image on another host (#3803)", () => {
    expect(
      isForeignImageUrl("https://probe-image.example/pixel.png", PAGE),
    ).toBe(true);
  });

  it.each([
    ["protocol-relative URL", "//probe-image.example/pixel.png", PAGE],
    [
      "scheme-relative URL on an http page",
      "https:probe-image.example/p.png",
      "http://localhost:4173/lesson",
    ],
    [
      "host that only starts like the page's",
      "https://astrapi69.github.io.evil.example/p.png",
      PAGE,
    ],
    [
      "URL with user info",
      "https://astrapi69.github.io@evil.example/p.png",
      PAGE,
    ],
  ])("resolves a %s the way the browser does", (_name, value, page) => {
    expect(isForeignImageUrl(value, page)).toBe(true);
  });

  it.each([
    ["same-origin absolute URL", "https://astrapi69.github.io/adaptive-learner/a.png"],
    ["root-relative path", "/adaptive-learner/a.png"],
    ["relative path", "assets/a.png"],
    ["data URI", "data:image/png;base64,AAAA"],
    ["blob URL", "blob:https://astrapi69.github.io/0b6e"],
    ["empty source", ""],
    ["source the browser cannot parse", "http://[broken"],
  ])("lets a %s render as before", (_name, value) => {
    expect(isForeignImageUrl(value, PAGE)).toBe(false);
  });

  it("treats the same host on another scheme as foreign", () => {
    expect(
      isForeignImageUrl("http://astrapi69.github.io/a.png", PAGE),
    ).toBe(true);
  });
});
