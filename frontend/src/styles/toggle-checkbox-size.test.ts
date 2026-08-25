/**
 * #1817 — settings toggle-row checkboxes must render at one fixed size.
 *
 * Every settings toggle row uses the shared toggle-row layout (a
 * `flex items-center justify-between` label) with a bare native
 * ``<input type="checkbox">``. A native checkbox is a flex item with the
 * default ``flex-shrink: 1``, so a row with a wider label/description
 * column squeezes its checkbox and renders it smaller than sibling rows
 * (the visible bug: the Interface panel's "Show button tooltips" and
 * "Developer Mode" checkboxes came out at different sizes). The global
 * ``input {...}`` base rule additionally bleeds text-input padding onto
 * checkboxes, which Firefox/Safari apply to the native control.
 *
 * Historically ONE shared legacy rule
 * (``.form-row-toggle input[type="checkbox"]``) constrained them; the
 * #2735 utility conversion moved that pin onto each checkbox as the
 * utilities ``m-0 size-4 flex-none p-0`` (``flex-none`` stops the
 * shrink, ``size-4`` = the fixed 1rem square, ``p-0``/``m-0`` cancel the
 * inherited input padding — utilities beat @layer base exactly like the
 * legacy rule did).
 *
 * This test pins the utility form: in every non-test .tsx file that
 * renders the toggle-row layout, EVERY native checkbox tag must carry
 * all four pin utilities. It reports the size of the scanned set so an
 * empty scan can never read as a clean one (gate contract #2083 pt. 4).
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, ".."); // styles -> src

const TOGGLE_ROW = 'className="flex items-center justify-between gap-2"';
const PIN_UTILITIES = ["m-0", "size-4", "flex-none", "p-0"] as const;

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, acc);
    } else if (entry.endsWith(".tsx") && !entry.includes(".test.")) {
      acc.push(full);
    }
  }
  return acc;
}

interface CheckboxTag {
  file: string;
  tag: string;
}

/** Every `<input ... type="checkbox" ... >` tag in toggle-row files. */
function collectToggleFileCheckboxes(): {
  toggleFiles: number;
  checkboxes: CheckboxTag[];
} {
  const checkboxes: CheckboxTag[] = [];
  let toggleFiles = 0;
  for (const file of walk(SRC)) {
    const text = readFileSync(file, "utf8");
    if (!text.includes(TOGGLE_ROW)) continue;
    toggleFiles += 1;
    const rel = relative(SRC, file).split("\\").join("/");
    let from = 0;
    for (;;) {
      const at = text.indexOf('type="checkbox"', from);
      if (at === -1) break;
      const open = text.lastIndexOf("<input", at);
      const close = text.indexOf(">", at);
      checkboxes.push({ file: rel, tag: text.slice(open, close + 1) });
      from = close + 1;
    }
  }
  return { toggleFiles, checkboxes };
}

describe("#1817 — toggle-checkbox sizing pin (utility form, #2735)", () => {
  const { toggleFiles, checkboxes } = collectToggleFileCheckboxes();

  it("scanned a non-empty toggle-row surface", () => {
    // Fail closed: the settings toggle rows exist; finding none means the
    // scan (or the toggle-row spelling) broke, not that the class is gone.
    expect(toggleFiles).toBeGreaterThanOrEqual(10);
    expect(checkboxes.length).toBeGreaterThanOrEqual(15);
  });

  it.each(PIN_UTILITIES)(
    "every checkbox in a toggle-row file carries %s",
    (utility) => {
      const missing = checkboxes
        .filter(({ tag }) => !tag.includes(utility))
        .map(({ file }) => file);
      expect(
        missing,
        `Checkbox(es) missing the ${utility} pin utility (the #1817 ` +
          `fixed-size/no-shrink/no-padding pin, carried per-checkbox ` +
          `since #2735): ${missing.join(", ")}`,
      ).toEqual([]);
    },
  );
});
