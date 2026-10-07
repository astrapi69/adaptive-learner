/**
 * Every query parameter the app writes into an internal link is read (#3660).
 *
 * Two parameters were written and never read: ``/curriculum?id=`` went
 * through a redirect that drops the query (#3659), and ``/content?share=``
 * reached a page that ignored it (#3660). Both looked like working links.
 *
 * The gate walks ``frontend/src``, collects every string or template literal
 * of the form ``/path?key=...`` whose path matches an app route in
 * ``App.tsx`` (API paths such as ``/backup/export?user_id=`` match no route
 * and are skipped), and requires per parameter:
 *
 *   - the route is not a fixed ``<Navigate to=...>`` redirect, which drops
 *     every parameter it is handed, and
 *   - some non-test source reads the key (``.get("key")``, ``.has("key")``
 *     or ``.getAll("key")`` on search params).
 *
 * The read check is repo-wide, not per target page: precise enough for the
 * written-but-never-read class, without a route-to-module map that would
 * drift on its own.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = dirname(fileURLToPath(import.meta.url));

interface AppRoute {
  pattern: string;
  redirect: boolean;
}

interface WrittenParam {
  file: string;
  path: string;
  key: string;
}

/** Routes declared in App.tsx, with whether each is a fixed redirect. */
function parseRoutes(appSource: string): AppRoute[] {
  const routes: AppRoute[] = [];
  const re = /<Route\s+path="([^"]+)"\s+element=\{\s*<(\w+)/g;
  for (const m of appSource.matchAll(re)) {
    if (m[1] === "*") continue;
    routes.push({ pattern: m[1], redirect: m[2] === "Navigate" });
  }
  return routes;
}

/** Literal ``/path?key=...`` targets in a source file, one entry per key. */
function writtenParams(file: string, source: string): WrittenParam[] {
  const found: WrittenParam[] = [];
  const re = /[`"'](\/[^`"'\s?]*)\?([^`"'\s]+)/g;
  for (const m of source.matchAll(re)) {
    const path = m[1].replace(/\$\{[^}]*\}/g, ":dyn");
    for (const pair of m[2].replace(/\$\{[^}]*\}/g, "x").split("&")) {
      const key = /^([a-z_]+)=/.exec(pair)?.[1];
      if (key) found.push({ file, path, key });
    }
  }
  return found;
}

/** The route a written path targets, or null when it is not an app route. */
function matchRoute(path: string, routes: AppRoute[]): AppRoute | null {
  const parts = path.split("/");
  return (
    routes.find((route) => {
      const pattern = route.pattern.split("/");
      return (
        pattern.length === parts.length &&
        pattern.every((seg, i) => seg.startsWith(":") || seg === parts[i])
      );
    }) ?? null
  );
}

/**
 * Every key some source reads from search params, either as a literal
 * (``.get("section")``) or through a constant holding it
 * (``const LEARNING_SECTION_PARAM = "section"`` then
 * ``.get(LEARNING_SECTION_PARAM)``).
 */
function readKeys(sources: string[]): Set<string> {
  const constants = new Map<string, string>();
  for (const s of sources) {
    for (const m of s.matchAll(/\bconst\s+([A-Z][A-Z0-9_]*)\s*=\s*["'`]([a-z_]+)["'`]/g)) {
      constants.set(m[1], m[2]);
    }
  }
  const keys = new Set<string>();
  for (const s of sources) {
    for (const m of s.matchAll(/\.(?:get|has|getAll)\(\s*(?:["'`]([a-z_]+)["'`]|([A-Z][A-Z0-9_]*))\s*\)/g)) {
      const key = m[1] ?? constants.get(m[2]);
      if (key) keys.add(key);
    }
  }
  return keys;
}

/** Every unread or dropped parameter, as ``file: /path?key (reason)``. */
function findings(written: WrittenParam[], routes: AppRoute[], sources: string[]): string[] {
  const read = readKeys(sources);
  const out: string[] = [];
  for (const w of written) {
    const route = matchRoute(w.path, routes);
    if (!route) continue;
    if (route.redirect) out.push(`${w.file}: ${w.path}?${w.key} (redirect drops the query)`);
    else if (!read.has(w.key)) out.push(`${w.file}: ${w.path}?${w.key} (never read)`);
  }
  return out;
}

function sourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) files.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) files.push(full);
  }
  return files;
}

const APP = `
  <Route path="/curriculum" element={<Navigate to="/progress?tab=paths" replace />} />
  <Route path="/progress" element={<ProgressHub />} />
  <Route path="/review/:setId" element={<ReviewPage />} />
  <Route path="*" element={<NotFound />} />
`;

describe("nav query-param helpers", () => {
  const routes = parseRoutes(APP);

  it("parses routes and marks the fixed redirects", () => {
    expect(routes).toEqual([
      { pattern: "/curriculum", redirect: true },
      { pattern: "/progress", redirect: false },
      { pattern: "/review/:setId", redirect: false },
    ]);
  });

  it("collects every key of a template target", () => {
    const src = "go(`/progress?tab=paths&curriculum=${encodeURIComponent(id)}`);";
    expect(writtenParams("a.ts", src).map((w) => `${w.path}?${w.key}`)).toEqual([
      "/progress?tab",
      "/progress?curriculum",
    ]);
  });

  it.each([
    ["a redirect target (#3659)", "go(`/curriculum?id=${id}`)", "redirect drops the query"],
    ["an unread key (#3660)", 'navigate("/progress?share=1")', "never read"],
  ])("reports %s", (_label, src, reason) => {
    const out = findings(writtenParams("a.ts", src), routes, ['p.get("tab")']);
    expect(out).toHaveLength(1);
    expect(out[0]).toContain(reason);
  });

  it.each([
    ["a read key", 'navigate("/progress?tab=stats")'],
    ["a dynamic route segment", "navigate(`/review/${id}?quick=1`)"],
    ["an API path that is no app route", "fetch(`/backup/export?user_id=${u}`)"],
    ["a key read through a constant", 'navigate("/progress?section=a")'],
  ])("passes %s", (_label, src) => {
    const sources = [
      'p.get("tab")',
      "params.has('quick')",
      'export const SECTION_PARAM = "section";',
      "searchParams.get(SECTION_PARAM)",
    ];
    expect(findings(writtenParams("a.ts", src), routes, sources)).toEqual([]);
  });
});

describe("internal links only write parameters that are read (#3660)", () => {
  const files = sourceFiles(SRC);
  const sources = files.map((f) => readFileSync(f, "utf8"));
  const routes = parseRoutes(readFileSync(join(SRC, "App.tsx"), "utf8"));
  const written = files.flatMap((f, i) => writtenParams(relative(SRC, f), sources[i]));
  const checked = written.filter((w) => matchRoute(w.path, routes) !== null);

  it("found the routes and the written parameters it checks", () => {
    // Fails closed: an App.tsx the parser no longer understands, or a scan
    // that matched nothing, must not read as a clean tree.
    expect(routes.length).toBeGreaterThan(20);
    expect(checked.length).toBeGreaterThan(20);
  });

  it("every written parameter reaches a page that reads it", () => {
    expect(findings(written, routes, sources)).toEqual([]);
  });
});
