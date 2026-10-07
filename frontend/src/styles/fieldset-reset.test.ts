/**
 * Every JSX fieldset declares its border (#3450).
 *
 * The app ships without Tailwind preflight, so a ``<fieldset>`` keeps the
 * UA 2 px groove border (a colour no theme defines), its padding and its
 * side margins unless something resets it. Most fieldsets carry the
 * ``m-0 border-0 p-0`` reset by hand; two shipped without it and drew
 * grey groove boxes. Same shape as the list guard (#3371): this scan
 * makes the next fieldset decide.
 *
 * A fieldset passes when it is covered by one of:
 *  - a ``border`` utility (``border-0`` / ``border-none`` for the reset,
 *    ``border`` / ``border-<token>`` for an intended, token-backed frame);
 *  - a component class whose CSS sets ``border``.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import { readLegacyCssSum } from "./legacy-css-sum";

const SRC = join(process.cwd(), "src");

interface FieldsetTag {
  loc: string;
  tag: string;
}

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return listFiles(path);
    return path.endsWith(".tsx") && !path.includes(".test.") ? [path] : [];
  });
}

/** The opening ``<fieldset ...>`` tags of a JSX source. */
function extractFieldsetTags(source: string, file: string): FieldsetTag[] {
  const tags: FieldsetTag[] = [];
  for (const match of source.matchAll(/<fieldset(?=[\s>/])/g)) {
    const start = match.index ?? 0;
    const lineStart = source.lastIndexOf("\n", start) + 1;
    const prefix = source.slice(lineStart, start);
    if (/\/\/|^\s*\*|`/.test(prefix)) continue;
    if (source.lastIndexOf("/*", start) > source.lastIndexOf("*/", start)) continue;
    let depth = 0;
    let end = start;
    for (; end < source.length; end += 1) {
      const ch = source[end];
      if (ch === "{") depth += 1;
      else if (ch === "}") depth -= 1;
      else if (ch === ">" && depth === 0) break;
    }
    const line = source.slice(0, start).split("\n").length;
    tags.push({ loc: `${file}:${line}`, tag: source.slice(start, end + 1) });
  }
  return tags;
}

/** Class names whose CSS rule (as the last compound) sets ``border``. */
function borderClasses(css: string): Set<string> {
  const names = new Set<string>();
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const rule of bare.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!/(^|[;\s])border\s*:/.test(rule[2])) continue;
    for (const selector of rule[1].split(",")) {
      const last = selector.trim().split(/\s+/).pop() ?? "";
      for (const cls of last.matchAll(/\.([A-Za-z0-9_-]+)/g)) names.add(cls[1]);
    }
  }
  return names;
}

const BORDER_UTILITY = /(^|[\s"'`])border(-[A-Za-z0-9[\]()-]+)?(?=[\s"'`]|$)/;

function isDeclared(tag: string, cssClasses: Set<string>): boolean {
  const classAttr = tag.match(/className=(?:"([^"]*)"|\{`([^`]*)`\})/);
  const classValue = classAttr?.[1] ?? classAttr?.[2] ?? "";
  if (BORDER_UTILITY.test(` ${classValue} `)) return true;
  return classValue.split(/\s+/).some((cls) => cssClasses.has(cls));
}

function allStyleCss(): string {
  const cssFiles: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (path.endsWith(".css")) cssFiles.push(path);
    }
  };
  walk(SRC);
  return [readLegacyCssSum(), ...cssFiles.map((f) => readFileSync(f, "utf-8"))].join("\n");
}

function scan(): { files: number; tags: FieldsetTag[]; offenders: string[] } {
  const cssClasses = borderClasses(allStyleCss());
  const files = listFiles(SRC);
  const tags = files.flatMap((f) =>
    extractFieldsetTags(readFileSync(f, "utf-8"), relative(SRC, f)),
  );
  const offenders = tags
    .filter((t) => !isDeclared(t.tag, cssClasses))
    .map((t) => `${t.loc}  ${t.tag.replace(/\s+/g, " ").slice(0, 120)}`);
  return { files: files.length, tags, offenders };
}

describe("fieldset reset (#3450)", () => {
  it("every JSX fieldset declares its border", () => {
    const { files, tags, offenders } = scan();
    // #2083 point 4: report what was scanned, and never pass on an empty set.
    expect(files, "no .tsx files scanned").toBeGreaterThan(500);
    expect(tags.length, "suspiciously few fieldsets found").toBeGreaterThan(10);
    expect(offenders, `${tags.length} fieldsets in ${files} files`).toEqual([]);
  });

  it.each([
    ["a classless fieldset", `<fieldset>`, false],
    ["layout classes only", `<fieldset className="flex flex-col gap-2">`, false],
    ["a border-width utility that is not a reset", `<fieldset className="border-x-2">`, true],
    ["the established reset", `<fieldset className="m-0 flex border-0 p-0">`, true],
    ["border-none", `<fieldset className="m-0 border-none p-0">`, true],
    ["a token-backed frame", `<fieldset className="rounded-lg border border-border p-4">`, true],
    ["a component class with border", `<fieldset className="storage-mode-fieldset">`, true],
    ["a border-colour lookalike word", `<fieldset className="has-border-x">`, false],
  ])("classifies %s", (_name, tag, declared) => {
    expect(isDeclared(tag, new Set(["storage-mode-fieldset"]))).toBe(declared);
  });

  it("finds a component class through its CSS border rule", () => {
    const classes = borderClasses(".a-box { display: flex; border: 0; }\n.b { color: red; }");
    expect([...classes]).toEqual(["a-box"]);
  });

  it("skips fieldsets named in comments and reads multi-line tags", () => {
    const source = [
      "// a <fieldset> in a comment",
      "const x = (",
      "  <fieldset",
      '    className="m-0 border-0 p-0"',
      "    data-testid={`g-${id}`}",
      "  >",
    ].join("\n");
    const tags = extractFieldsetTags(source, "x.tsx");
    expect(tags.map((t) => t.loc)).toEqual(["x.tsx:3"]);
    expect(tags[0].tag).toContain('className="m-0 border-0 p-0"');
  });
});
