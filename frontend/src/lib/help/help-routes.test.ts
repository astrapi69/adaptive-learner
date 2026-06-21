import { describe, expect, it } from "vitest";

import {
  DEFAULT_HELP_KEY,
  DOCS_BASE_URL,
  docsHomeUrl,
  docsUrlForSlug,
  helpKeyForPath,
} from "./help-routes";

describe("helpKeyForPath", () => {
  it("maps the main views to their glossary entries", () => {
    expect(helpKeyForPath("/dashboard")).toBe("view_dashboard");
    expect(helpKeyForPath("/content")).toBe("view_content_browser");
    expect(helpKeyForPath("/settings")).toBe("view_settings");
    expect(helpKeyForPath("/assessment")).toBe("assessment");
  });

  it("maps the import flow to the conversation-analysis help", () => {
    expect(helpKeyForPath("/import")).toBe("feature_conversation_analysis");
    expect(helpKeyForPath("/import/some-conversation-id")).toBe(
      "feature_conversation_analysis",
    );
  });

  it("matches parameterized lesson-family routes", () => {
    expect(helpKeyForPath("/lesson/de/es-a1/01.json")).toBe("view_lesson");
    expect(helpKeyForPath("/review/some-set")).toBe("view_lesson");
    expect(helpKeyForPath("/adaptive-lesson/some-set")).toBe("view_lesson");
    expect(helpKeyForPath("/error-replay/a/b/c")).toBe("view_lesson");
  });

  it("does not match a prefix that is only a substring of another segment", () => {
    // ``/contentious`` must NOT resolve to the /content view.
    expect(helpKeyForPath("/contentious")).toBe(DEFAULT_HELP_KEY);
  });

  it("falls back to the default key for unmapped routes", () => {
    expect(helpKeyForPath("/")).toBe(DEFAULT_HELP_KEY);
    expect(helpKeyForPath("/anki")).toBe(DEFAULT_HELP_KEY);
  });
});

describe("docsUrlForSlug", () => {
  it("puts the default language (de) at the docs root", () => {
    expect(docsUrlForSlug("features/content-browser", "de")).toBe(
      `${DOCS_BASE_URL}features/content-browser/`,
    );
  });

  it("prefixes every other language with its locale", () => {
    expect(docsUrlForSlug("user-guide/dashboard", "en")).toBe(
      `${DOCS_BASE_URL}en/user-guide/dashboard/`,
    );
    expect(docsUrlForSlug("user-guide/dashboard", "ja")).toBe(
      `${DOCS_BASE_URL}ja/user-guide/dashboard/`,
    );
  });

  it("normalizes region codes to the base language", () => {
    expect(docsUrlForSlug("features/backup", "de-DE")).toBe(
      `${DOCS_BASE_URL}features/backup/`,
    );
    expect(docsUrlForSlug("features/backup", "pt-BR")).toBe(
      `${DOCS_BASE_URL}pt/features/backup/`,
    );
  });

  it("falls back to the English tree for an unbuilt locale", () => {
    expect(docsUrlForSlug("features/backup", "zz")).toBe(
      `${DOCS_BASE_URL}en/features/backup/`,
    );
    // hi / id / ko have no built doc tree -> English, not German root.
    expect(docsUrlForSlug("user-guide/settings", "ko")).toBe(
      `${DOCS_BASE_URL}en/user-guide/settings/`,
    );
  });
});

describe("docsHomeUrl", () => {
  it("puts the default language (de) at the docs root", () => {
    expect(docsHomeUrl("de")).toBe(DOCS_BASE_URL);
    expect(docsHomeUrl("de-DE")).toBe(DOCS_BASE_URL);
  });

  it("prefixes a built locale with its language", () => {
    expect(docsHomeUrl("el")).toBe(`${DOCS_BASE_URL}el/`);
    expect(docsHomeUrl("pt-BR")).toBe(`${DOCS_BASE_URL}pt/`);
  });

  it("falls back to English for an unbuilt locale", () => {
    expect(docsHomeUrl("hi")).toBe(`${DOCS_BASE_URL}en/`);
    expect(docsHomeUrl("id")).toBe(`${DOCS_BASE_URL}en/`);
    expect(docsHomeUrl("ko")).toBe(`${DOCS_BASE_URL}en/`);
  });
});
