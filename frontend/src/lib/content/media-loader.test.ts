import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchMediaResources,
  isAffiliateUrl,
  mediaForDomain,
  parseLessonResources,
  parseMediaYaml,
  projectMediaResource,
} from "./media-loader";

const YAML = `
language:
  - title: "Easy French"
    type: youtube
    url: "https://www.youtube.com/@EasyFrench"
    language: en
    level: beginner
    description: "Authentic everyday French."
  - title: "Duolingo Spanish Podcast"
    type: podcast
    url: "https://podcast.duolingo.com/spanish"
    language: en
    duration: "20min"
  - title: "No URL entry"
    type: article
  - title: "Bad scheme"
    type: article
    url: "ftp://nope"
  - title: "Unknown type"
    type: tiktok
    url: "https://example.com/x"
ai:
  - title: "Neural networks"
    type: youtube
    url: "https://www.youtube.com/watch?v=aircAruvnKk"
    language: en
    duration: "19min"
`;

function mockFetch(body: string, ok = true): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok, text: async () => body }) as unknown as Response),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("parseMediaYaml", () => {
  it("parses a flat domain map into resources, dropping invalid entries", () => {
    const resources = parseMediaYaml(YAML);
    // language: youtube + podcast survive (no-url, bad-scheme, unknown-type dropped).
    // ai: one youtube.
    expect(resources).toHaveLength(3);
    const titles = resources.map((r) => r.title).sort();
    expect(titles).toEqual([
      "Duolingo Spanish Podcast",
      "Easy French",
      "Neural networks",
    ]);
  });

  it("stamps each resource with its domain", () => {
    const resources = parseMediaYaml(YAML);
    expect(mediaForDomain(resources, "language")).toHaveLength(2);
    expect(mediaForDomain(resources, "ai")).toHaveLength(1);
    expect(mediaForDomain(resources, "psychology")).toEqual([]);
    expect(mediaForDomain(resources, null)).toEqual([]);
  });

  it("carries optional metadata when present", () => {
    const resources = parseMediaYaml(YAML);
    const podcast = resources.find((r) => r.type === "podcast");
    expect(podcast?.duration).toBe("20min");
    expect(podcast?.language).toBe("en");
  });

  it("returns [] for malformed YAML", () => {
    expect(parseMediaYaml(": : : not yaml :")).toEqual([]);
  });

  it("supports a books.yaml-style domains: wrapper", () => {
    const wrapped = `
domains:
  ai:
    media:
      - title: "Crash Course AI"
        type: youtube
        url: "https://www.youtube.com/watch?v=a0_lo_GDcFw"
`;
    const resources = parseMediaYaml(wrapped);
    expect(resources).toHaveLength(1);
    expect(resources[0].domain).toBe("ai");
  });
});

describe("reciprocity gate (MED-02)", () => {
  it("drops course/website entries without partnership: true", () => {
    const yaml = `
language:
  - title: "Paid course no partnership"
    type: course
    url: "https://teacher.example/course"
  - title: "Website no partnership"
    type: website
    url: "https://teacher.example/"
`;
    expect(parseMediaYaml(yaml)).toEqual([]);
  });

  it("keeps course/website entries with partnership: true", () => {
    const yaml = `
language:
  - title: "Partner course"
    type: course
    url: "https://teacher.example/course"
    partnership: true
    free: false
`;
    const resources = parseMediaYaml(yaml);
    expect(resources).toHaveLength(1);
    expect(resources[0].type).toBe("course");
    expect(resources[0].partnership).toBe(true);
    expect(resources[0].free).toBe(false);
  });
});

describe("isAffiliateUrl", () => {
  it("flags Amazon affiliate and generic referral params", () => {
    expect(isAffiliateUrl("https://www.amazon.de/dp/3868943234/?tag=aff-21")).toBe(
      true,
    );
    expect(isAffiliateUrl("https://shop.example/x?affiliate_id=42")).toBe(true);
    expect(isAffiliateUrl("https://partner.example/?partner_id=7")).toBe(true);
  });

  it("passes clean URLs", () => {
    expect(isAffiliateUrl("https://www.amazon.de/dp/3868943234/")).toBe(false);
    expect(isAffiliateUrl("https://www.youtube.com/watch?v=aircAruvnKk")).toBe(
      false,
    );
  });

  it("drops affiliate URLs from the parse", () => {
    const yaml = `
language:
  - title: "Affiliate book"
    type: book
    url: "https://www.amazon.de/dp/3868943234/?tag=aff-21"
`;
    expect(parseMediaYaml(yaml)).toEqual([]);
  });
});

describe("projectMediaResource", () => {
  it("returns null for non-object / missing required fields", () => {
    expect(projectMediaResource(null, "ai")).toBeNull();
    expect(projectMediaResource("x", "ai")).toBeNull();
    expect(projectMediaResource({ type: "youtube" }, "ai")).toBeNull();
  });
});

describe("parseLessonResources (MED-05)", () => {
  it("parses a lesson resources[] array, inheriting the domain", () => {
    const raw = [
      {
        type: "youtube",
        title: "Lesson video",
        url: "https://www.youtube.com/watch?v=abc123",
      },
      { type: "tiktok", title: "bad", url: "https://x.example" },
    ];
    const resources = parseLessonResources(raw, "language");
    expect(resources).toHaveLength(1);
    expect(resources[0].domain).toBe("language");
    expect(resources[0].title).toBe("Lesson video");
  });

  it("returns [] for missing / non-array input", () => {
    expect(parseLessonResources(undefined)).toEqual([]);
    expect(parseLessonResources(null)).toEqual([]);
    expect(parseLessonResources("nope")).toEqual([]);
  });
});

describe("fetchMediaResources", () => {
  it("fetches and parses media.yaml", async () => {
    mockFetch(YAML);
    const resources = await fetchMediaResources();
    expect(resources).toHaveLength(3);
  });

  it("returns [] on a failed fetch with no cache", async () => {
    mockFetch("", false);
    expect(await fetchMediaResources()).toEqual([]);
  });

  it("falls back to the cached catalogue when the network fails", async () => {
    mockFetch(YAML);
    await fetchMediaResources(); // populates the cache
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    const resources = await fetchMediaResources();
    expect(resources).toHaveLength(3);
  });
});
