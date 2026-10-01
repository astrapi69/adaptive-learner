/**
 * Every JSX list declares its marker (#3371).
 *
 * The app ships without Tailwind preflight, so a ``<ul>``/``<ol>`` keeps the
 * UA disc, 40 px padding and 1em margins unless something resets it. Five
 * fixes (#2498, #2545, #2697, #3341, #3354) each pinned one component; this
 * guard scans the tree so the next list cannot ship without a decision.
 *
 * A list passes when it is covered by one of:
 *  - a list utility (``list-none`` / ``list-disc`` / ``list-decimal``);
 *  - a ``flex`` / ``inline-flex`` / ``grid`` class, reset by the base rule
 *    in ``legacy/01-base.css``;
 *  - a component class whose CSS sets ``list-style``;
 *  - an ``ALLOWLIST`` entry (a descendant CSS rule the scan cannot see).
 * The allowlist only shrinks: an entry the scan no longer needs fails.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import { readLegacyCssSum } from "./legacy-css-sum";

const SRC = join(process.cwd(), "src");

/** Lists covered by a descendant rule, path:line of the opening tag. */
const ALLOWLIST: Record<string, string> = {
  "components/settings/backup/BackupCompare.tsx:426": ".backup-compare-section ul sets list-style",
  "components/settings/backup/BackupCompare.tsx:460": ".backup-compare-section ul sets list-style",
};

interface ListTag {
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

/** The opening ``<ul ...>`` / ``<ol ...>`` tags of a JSX source. */
function extractListTags(source: string, file: string): ListTag[] {
  const tags: ListTag[] = [];
  for (const match of source.matchAll(/<(ul|ol)(?=[\s>/])/g)) {
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

/** Class names whose CSS rule (as the last compound) sets ``list-style``. */
function listStyleClasses(css: string): Set<string> {
  const names = new Set<string>();
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const rule of bare.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!/list-style\s*:/.test(rule[2])) continue;
    for (const selector of rule[1].split(",")) {
      const last = selector.trim().split(/\s+/).pop() ?? "";
      for (const cls of last.matchAll(/\.([A-Za-z0-9_-]+)/g)) names.add(cls[1]);
    }
  }
  return names;
}

const UTILITY = /\blist-(none|disc|decimal)\b/;
const LAYOUT = /(^|[\s"'`])(flex|inline-flex|grid)(?=[\s"'`]|$)/;

function isDeclared(tag: string, cssClasses: Set<string>): boolean {
  if (UTILITY.test(tag) || LAYOUT.test(tag)) return true;
  const classAttr = tag.match(/className=(?:"([^"]*)"|\{`([^`]*)`\})/);
  const classes = (classAttr?.[1] ?? classAttr?.[2] ?? "").split(/\s+/);
  return classes.some((cls) => cssClasses.has(cls));
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

function scan(): { files: number; tags: ListTag[]; offenders: string[] } {
  const cssClasses = listStyleClasses(allStyleCss());
  const files = listFiles(SRC);
  const tags = files.flatMap((f) => extractListTags(readFileSync(f, "utf-8"), relative(SRC, f)));
  const offenders = tags
    .filter((t) => !isDeclared(t.tag, cssClasses) && !(t.loc in ALLOWLIST))
    .map((t) => `${t.loc}  ${t.tag.replace(/\s+/g, " ").slice(0, 120)}`);
  return { files: files.length, tags, offenders };
}

describe("list reset (#3371)", () => {
  it("the base layer resets flex and grid lists", () => {
    const css = readLegacyCssSum().replace(/\/\*[\s\S]*?\*\//g, "");
    const block = css.match(
      /:where\(ul,\s*ol\):where\(\.flex,\s*\.inline-flex,\s*\.grid\)\s*\{([^}]*)\}/,
    );
    expect(block, "no flex/grid list reset in the legacy CSS").not.toBeNull();
    expect(block![1]).toMatch(/list-style:\s*none/);
    expect(block![1]).toMatch(/margin:\s*0/);
    expect(block![1]).toMatch(/padding:\s*0/);
  });

  it("every JSX list declares its marker", () => {
    const { files, tags, offenders } = scan();
    // #2083 point 4: report what was scanned, and never pass on an empty set.
    expect(files, "no .tsx files scanned").toBeGreaterThan(500);
    expect(tags.length, "suspiciously few lists found").toBeGreaterThan(100);
    expect(offenders, `${tags.length} lists in ${files} files`).toEqual([]);
  });

  it("every allowlist entry is still needed", () => {
    const { tags } = scan();
    const cssClasses = listStyleClasses(allStyleCss());
    const byLoc = new Map(tags.map((t) => [t.loc, t.tag]));
    const stale = Object.keys(ALLOWLIST).filter(
      (loc) => !byLoc.has(loc) || isDeclared(byLoc.get(loc)!, cssClasses),
    );
    expect(stale).toEqual([]);
  });

  it.each([
    ["a bare spaced list", `<ul className="mt-2 pl-4">`, false],
    ["a classless list", `<ul>`, false],
    ["a flex list", `<ul className="flex flex-col gap-2">`, true],
    ["an explicit reset", `<ol className="m-0 list-none p-0">`, true],
    ["an explicit bullet list", `<ul className="list-disc pl-5">`, true],
    ["a component class with list-style", `<ul className="topic-tree">`, true],
    ["flex-col alone is not flex", `<ul className="flex-col gap-2">`, false],
  ])("classifies %s", (_name, tag, declared) => {
    expect(isDeclared(tag, new Set(["topic-tree"]))).toBe(declared);
  });

  it("skips lists named in comments and reads multi-line tags", () => {
    const source = [
      "// a <ul> in a comment",
      "const x = (",
      "  <ul",
      '    className="flex"',
      "    data-testid={`a-${id}`}",
      "  >",
    ].join("\n");
    const tags = extractListTags(source, "x.tsx");
    expect(tags.map((t) => t.loc)).toEqual(["x.tsx:3"]);
    expect(tags[0].tag).toContain('className="flex"');
  });
});
