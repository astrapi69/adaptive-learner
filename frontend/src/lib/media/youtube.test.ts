import { describe, expect, it } from "vitest";

import {
  extractVideoId,
  getThumbnailUrl,
  isYouTubeUrl,
} from "./youtube";

const ID = "aircAruvnKk"; // 11 chars

describe("extractVideoId", () => {
  it.each([
    [`https://www.youtube.com/watch?v=${ID}`, ID],
    [`https://youtube.com/watch?v=${ID}&t=30s`, ID],
    [`https://youtu.be/${ID}`, ID],
    [`https://youtu.be/${ID}?si=abc`, ID],
    [`https://www.youtube.com/embed/${ID}`, ID],
    [`https://www.youtube.com/shorts/${ID}`, ID],
    [`https://www.youtube.com/v/${ID}`, ID],
    [`https://www.youtube.com/live/${ID}`, ID],
    [`https://m.youtube.com/watch?v=${ID}`, ID],
    [`https://music.youtube.com/watch?v=${ID}`, ID],
  ])("extracts the id from %s", (url, expected) => {
    expect(extractVideoId(url)).toBe(expected);
  });

  it.each([
    "https://www.youtube.com/@EasyFrench",
    "https://www.youtube.com/playlist?list=PLZZ",
    "https://example.com/watch?v=abc",
    "not a url",
    "",
    null,
    undefined,
  ])("returns null for %s", (url) => {
    expect(extractVideoId(url as string)).toBeNull();
  });
});

describe("isYouTubeUrl", () => {
  it("is true for a single-video URL, false otherwise", () => {
    expect(isYouTubeUrl(`https://youtu.be/${ID}`)).toBe(true);
    expect(isYouTubeUrl("https://www.youtube.com/@EasyFrench")).toBe(false);
  });
});

describe("getThumbnailUrl", () => {
  it("builds the mqdefault URL by default", () => {
    expect(getThumbnailUrl(ID)).toBe(
      `https://img.youtube.com/vi/${ID}/mqdefault.jpg`,
    );
  });
  it("supports hqdefault", () => {
    expect(getThumbnailUrl(ID, "hqdefault")).toBe(
      `https://img.youtube.com/vi/${ID}/hqdefault.jpg`,
    );
  });
});
