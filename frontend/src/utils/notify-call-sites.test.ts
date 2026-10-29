/**
 * Guard (#3374): no ``notify.error`` call appends raw error text.
 *
 * A toast is what a production user reads. Appending ``err.message``,
 * ``String(err)`` or a variable derived from them showed TypeErrors,
 * Pydantic ``loc`` lists, uuids and absolute paths to users. The
 * contract is ``notify.error(t(KEY, FB), {error: err})``: the prefix is
 * the visible text, the error travels to the report dialog and the
 * event recorder, and its text shows only in dev mode.
 *
 * The scan reads every non-test ``.ts`` / ``.tsx`` file under
 * ``src/``, extracts each ``notify.error(...)`` argument list with
 * balanced parentheses (multi-line), and flags it when it contains
 * ``.message``, ``.detail`` (an ``ApiError``'s backend text, #3374
 * second slice), ``String(err``/``String(error``/``String(e)``, or an
 * identifier assigned from such an expression in the preceding
 * ``TAINT_WINDOW`` lines of the same file.
 */

import {readdirSync, readFileSync, statSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {dirname, join, relative} from "node:path";
import {describe, expect, it} from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "..");
const TAINT_WINDOW = 25;
const RAW_TEXT = /\.message\b|\.detail\b|String\(\s*(?:err\b|error\b|e\))/;

/**
 * Sites whose argument matches the raw-text pattern but is a friendly,
 * localized message built by own code. ``file:identifier`` -> reason.
 */
const ALLOWLIST: Record<string, string> = {};

interface Finding {
    location: string;
    reason: string;
}

function listSourceFiles(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
            listSourceFiles(full, out);
        } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) && !entry.endsWith(".d.ts")) {
            out.push(full);
        }
    }
    return out;
}

/** Argument text of the call whose ``(`` sits at ``open``, or null if unbalanced. */
function argumentText(source: string, open: number): string | null {
    let depth = 0;
    let quote: string | null = null;
    for (let i = open; i < source.length; i++) {
        const ch = source[i];
        if (quote) {
            if (ch === "\\") i++;
            else if (ch === quote) quote = null;
            continue;
        }
        if (ch === '"' || ch === "'") quote = ch;
        else if (ch === "(") depth++;
        else if (ch === ")" && --depth === 0) return source.slice(open + 1, i);
    }
    return null;
}

function lineOf(source: string, index: number): number {
    return source.slice(0, index).split("\n").length;
}

/** Identifiers assigned from raw error text within the window before ``line``. */
function taintedIdentifiers(lines: string[], line: number): Set<string> {
    const start = Math.max(0, line - 1 - TAINT_WINDOW);
    const window = lines.slice(start, line - 1).join("\n");
    const tainted = new Set<string>();
    const assignment = /\b([A-Za-z_$][\w$]*)\s*=(?!=)([^;]*)/g;
    for (const match of window.matchAll(assignment)) {
        if (RAW_TEXT.test(match[2])) tainted.add(match[1]);
    }
    return tainted;
}

function scanFile(file: string, findings: Finding[]): number {
    const source = readFileSync(file, "utf8");
    const lines = source.split("\n");
    const rel = relative(SRC, file);
    let calls = 0;
    for (const match of source.matchAll(/\bnotify\.error\s*\(/g)) {
        const open = (match.index ?? 0) + match[0].length - 1;
        const args = argumentText(source, open);
        const line = lineOf(source, match.index ?? 0);
        const location = `${rel}:${line}`;
        calls++;
        if (args === null) {
            findings.push({location, reason: "unbalanced parentheses, cannot check"});
            continue;
        }
        if (RAW_TEXT.test(args)) {
            findings.push({location, reason: "argument contains raw error text"});
            continue;
        }
        const tokens = new Set(args.match(/[A-Za-z_$][\w$]*/g) ?? []);
        for (const ident of taintedIdentifiers(lines, line)) {
            if (!tokens.has(ident) || ALLOWLIST[`${rel}:${ident}`]) continue;
            findings.push({location, reason: `\`${ident}\` holds raw error text`});
        }
    }
    return calls;
}

function scanTree(): {calls: number; files: number; findings: Finding[]} {
    const findings: Finding[] = [];
    const files = listSourceFiles(SRC);
    let calls = 0;
    for (const file of files) calls += scanFile(file, findings);
    return {calls, files: files.length, findings};
}

describe("notify.error call sites (#3374)", () => {
    const result = scanTree();

    it(`scanned ${result.calls} notify.error calls in ${result.files} files (fails closed on an empty scan)`, () => {
        expect(result.files).toBeGreaterThan(0);
        expect(result.calls).toBeGreaterThan(100);
    });

    it("no call appends raw error text to the toast", () => {
        const report = result.findings.map((f) => `${f.location}  ${f.reason}`);
        expect(report, `${report.length} of ${result.calls} notify.error calls append raw error text; pass {error: err} instead`).toEqual([]);
    });

    it("every allowlist entry still names a real file", () => {
        const stale = Object.keys(ALLOWLIST).filter((key) => {
            const file = join(SRC, key.slice(0, key.lastIndexOf(":")));
            try {
                return !statSync(file).isFile();
            } catch {
                return true;
            }
        });
        expect(stale).toEqual([]);
    });
});

describe("notify.error call-site scanner", () => {
    it("detects .message, String(err) and tainted identifiers", () => {
        expect(RAW_TEXT.test("err.message")).toBe(true);
        expect(RAW_TEXT.test("String(err)")).toBe(true);
        expect(RAW_TEXT.test("String(e)")).toBe(true);
        expect(RAW_TEXT.test("err instanceof ApiError ? err.detail : fallback")).toBe(true);
        expect(RAW_TEXT.test('t("x", "y"), {error: err}')).toBe(false);
        const lines = ['const detail = err instanceof Error ? err.message : "";', "", "x"];
        expect(taintedIdentifiers(lines, 3).has("detail")).toBe(true);
        const apiLines = ['const msg = err instanceof ApiError ? err.detail : t("k");', "", "x"];
        expect(taintedIdentifiers(apiLines, 3).has("msg")).toBe(true);
    });

    it("extracts balanced multi-line arguments", () => {
        const source = 'notify.error(\n  t("a (b", "c"),\n  {error: f(x)},\n);';
        expect(argumentText(source, source.indexOf("("))).toBe('\n  t("a (b", "c"),\n  {error: f(x)},\n');
    });
});
