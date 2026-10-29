import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { APP_TITLE, PAGE_TITLE_KEYS, formatDocumentTitle, pageTitleFor } from "./page-title";

const CATALOG_DIR = join(process.cwd(), "src", "data", "i18n");

function lookup(catalog: unknown, key: string): unknown {
  return key
    .split(".")
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === "object" ? (node as Record<string, unknown>)[part] : undefined,
      catalog,
    );
}

describe("pageTitleFor (#3431)", () => {
  it.each([
    ["the settings page", "/settings", "settings.title"],
    ["a lesson deep link", "/lesson/fr-a1/set-1/01.json", "lesson.page_title"],
    ["a review run", "/review/set-1", "review.page_title"],
    ["a set inside the content hub", "/content/set/set-1", "nav.tab.content"],
    ["the learning repository of a project", "/projects/p1/learning-repo", "repo.page.title"],
    ["a trailing slash", "/dashboard/", "dashboard.title"],
  ])("maps %s to its heading key", (_label, path, key) => {
    expect(pageTitleFor(path)?.key).toBe(key);
  });

  it.each([
    ["the landing page", "/"],
    ["an unknown path", "/no-such-page"],
    ["an empty path", ""],
  ])("leaves %s without a page name", (_label, path) => {
    expect(pageTitleFor(path)).toBeNull();
  });

  it("covers every route segment App.tsx declares", () => {
    const app = readFileSync(join(process.cwd(), "src", "App.tsx"), "utf-8");
    const segments = [...app.matchAll(/path="\/([^/":*]+)/g)].map((m) => m[1]);
    // #2083 point 4: never pass on an empty set.
    expect(segments.length, "no routes parsed from App.tsx").toBeGreaterThan(20);
    const untitled = [...new Set(segments)].filter((s) => pageTitleFor(`/${s}`) === null);
    expect(untitled).toEqual([]);
  });
});

describe("formatDocumentTitle (#3431)", () => {
  it.each([
    ["a page name", "Einstellungen", `Einstellungen - ${APP_TITLE}`],
    ["no page name", null, APP_TITLE],
    ["a blank page name", "  ", APP_TITLE],
  ])("formats %s", (_label, page, expected) => {
    expect(formatDocumentTitle(page)).toBe(expected);
  });
});

describe("page title keys exist in every catalog (#3431)", () => {
  const catalogs = readdirSync(CATALOG_DIR).filter((f) => f.endsWith(".json"));

  it("reads all catalogs", () => {
    expect(catalogs.length).toBeGreaterThanOrEqual(11);
    expect(PAGE_TITLE_KEYS.length).toBeGreaterThan(20);
  });

  it.each(catalogs)("%s has a plain string for every title key", (file) => {
    const catalog = JSON.parse(readFileSync(join(CATALOG_DIR, file), "utf-8"));
    const broken = PAGE_TITLE_KEYS.filter((key) => {
      const value = lookup(catalog, key);
      return typeof value !== "string" || value.trim() === "" || /\{[a-z_]+\}/.test(value);
    });
    expect(broken).toEqual([]);
  });
});
