/**
 * A heading that sets its bottom margin also decides its top margin (#3434).
 *
 * The app ships without Tailwind preflight, so ``h1``-``h4`` keep the UA
 * ``margin-block-start``. A heading styled with only ``mb-*`` therefore sits
 * an uncontrolled distance below its card edge: the dashboard's "Weitermachen"
 * heading started about 45 px below the card top against 28 px in the card
 * beneath it. This scan makes the next such heading decide.
 *
 * A heading passes when its class list carries a top-margin utility
 * (``mt-*``, ``my-*``, ``m-*``) whenever it carries ``mb-*``.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

const SRC = join(process.cwd(), "src");

interface HeadingTag {
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

/** The opening ``<h1 ...>`` .. ``<h6 ...>`` tags of a JSX source. */
function extractHeadingTags(source: string, file: string): HeadingTag[] {
  const tags: HeadingTag[] = [];
  for (const match of source.matchAll(/<h[1-6](?=[\s>/])/g)) {
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

/** Every class token in the tag's className, from string literals only. */
function classTokens(tag: string): string[] {
  const attr = tag.match(/className=("[^"]*"|\{[\s\S]*\})/);
  if (!attr) return [];
  const literals = [...attr[1].matchAll(/"([^"]*)"|`([^`$]*)`|'([^']*)'/g)];
  return literals.flatMap((m) => (m[1] ?? m[2] ?? m[3] ?? "").split(/\s+/)).filter(Boolean);
}

function decidesTopMargin(tag: string): boolean {
  const tokens = classTokens(tag);
  const setsBottom = tokens.some((t) => /^([a-z0-9]+:)*mb-/.test(t));
  const setsTop = tokens.some((t) => /^([a-z0-9]+:)*(mt|my|m)-/.test(t));
  return !setsBottom || setsTop;
}

function scan(): { files: number; tags: HeadingTag[]; offenders: string[] } {
  const files = listFiles(SRC);
  const tags = files.flatMap((f) => extractHeadingTags(readFileSync(f, "utf-8"), relative(SRC, f)));
  const offenders = tags
    .filter((t) => !decidesTopMargin(t.tag))
    .map((t) => `${t.loc}  ${t.tag.replace(/\s+/g, " ").slice(0, 120)}`);
  return { files: files.length, tags, offenders };
}

describe("heading top margin (#3434)", () => {
  it("every JSX heading with a bottom margin decides its top margin", () => {
    const { files, tags, offenders } = scan();
    // #2083 point 4: report what was scanned, and never pass on an empty set.
    expect(files, "no .tsx files scanned").toBeGreaterThan(500);
    expect(tags.length, "suspiciously few headings found").toBeGreaterThan(100);
    expect(offenders, `${tags.length} headings in ${files} files`).toEqual([]);
  });

  it.each([
    ["only a bottom margin", `<h2 className="mb-2 text-lg">`, false],
    ["a bottom and a top margin", `<h2 className="mt-0 mb-2 text-lg">`, true],
    ["a vertical margin", `<h3 className="my-2">`, true],
    ["an all-sides margin", `<h3 className="m-0 mb-1">`, true],
    ["no margin at all", `<h2 className="text-lg">`, true],
    ["a responsive bottom margin only", `<h2 className="md:mb-4">`, false],
    ["a cn() call with both", `<h2 className={cn("mt-0", "mb-1")}>`, true],
    ["no className", `<h2>`, true],
  ])("classifies %s", (_name, tag, decided) => {
    expect(decidesTopMargin(tag)).toBe(decided);
  });
});
