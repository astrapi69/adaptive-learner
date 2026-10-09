/**
 * Night-shift report: catalog keys without a consumer, older than AGE_DAYS (#3444).
 *
 * Run with bun from ``frontend/`` on a full-history checkout of develop:
 *
 *   bun scripts/unused-catalog-keys.ts --out report.md --summary summary.json
 *
 * Exit codes: 0 measured (findings or not; the workflow files them in one
 * issue), 2 the basis is missing (no catalog, no sources, no history): never
 * green on a measurement that did not happen.
 */

import {execFileSync} from "node:child_process";
import {readFileSync, readdirSync, statSync, writeFileSync} from "node:fs";
import {join, resolve} from "node:path";

import {
    extractDataHeldKeys,
    extractDynamicKeyPatterns,
    extractStaticKeys,
    flattenCatalog,
    stripComments,
    type DynamicKeyPattern,
} from "../src/i18n/full-tree-key-coverage";
import {
    AGE_DAYS,
    ReportBasisError,
    agedUnusedKeys,
    findUnusedKeys,
    renderReport,
} from "../src/i18n/unused-catalog-keys";

const REPO = resolve(import.meta.dir, "../..");
const CATALOG = "frontend/src/data/i18n/en.json";
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "__pycache__", ".venv", "tests"]);

function walk(
    dir: string,
    accept: (name: string) => boolean,
    skip: ReadonlySet<string> = SKIP_DIRS,
    out: string[] = [],
): string[] {
    let entries: string[];
    try {
        entries = readdirSync(dir);
    } catch {
        return out;
    }
    for (const name of entries) {
        if (skip.has(name)) continue;
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full, accept, skip, out);
        else if (accept(name)) out.push(full);
    }
    return out;
}

const isAppSource = (name: string) => /\.tsx?$/.test(name) && !/\.test\.tsx?$|\.d\.ts$/.test(name);
const isPython = (name: string) => name.endsWith(".py") && !name.startsWith("test_");
const isYaml = (name: string) => /\.ya?ml$/.test(name);

/** Every file a consumer can live in, by channel. */
function sourceFiles(): {app: string[]; packages: string[]; other: string[]} {
    const app = walk(join(REPO, "frontend/src"), isAppSource);
    const scope = join(REPO, "frontend/node_modules/@astrapi69");
    // Packages ship their code in dist/, which the app walk skips.
    const packages = walk(scope, (name) => /\.m?js$/.test(name), new Set(["node_modules"])).filter((f) =>
        f.includes("/dist/"),
    );
    const other = [
        ...walk(join(REPO, "frontend/src"), (n) => n.endsWith(".json")).filter((f) => !f.includes("/data/i18n/")),
        ...walk(join(REPO, "backend/app"), isPython),
        ...walk(join(REPO, "backend/config"), isYaml).filter((f) => !f.includes("/config/i18n/")),
        ...walk(join(REPO, "plugins"), (n) => isPython(n) || isYaml(n)),
    ];
    return {app, packages, other};
}

function catalogKeysAt(ref: string | null): string[] {
    const text = ref
        ? execFileSync("git", ["-C", REPO, "show", `${ref}:${CATALOG}`], {encoding: "utf-8"})
        : readFileSync(join(REPO, CATALOG), "utf-8");
    return [...flattenCatalog(JSON.parse(text) as Record<string, unknown>).keys()];
}

function commitAgeDaysAgo(): string {
    const ref = execFileSync("git", ["-C", REPO, "rev-list", "-1", `--before=${AGE_DAYS} days ago`, "HEAD"], {
        encoding: "utf-8",
    }).trim();
    if (!ref) throw new ReportBasisError(`no commit older than ${AGE_DAYS} days (shallow clone?)`);
    return ref;
}

function arg(name: string): string | undefined {
    const index = process.argv.indexOf(name);
    return index >= 0 ? process.argv[index + 1] : undefined;
}

function main(): number {
    const files = sourceFiles();
    const namedKeys = new Set<string>();
    const dynamicPatterns: DynamicKeyPattern[] = [];
    const texts: string[] = [];
    for (const file of [...files.app, ...files.packages]) {
        const source = stripComments(readFileSync(file, "utf-8"));
        extractStaticKeys(source).forEach((key) => namedKeys.add(key));
        extractDataHeldKeys(source).forEach((key) => namedKeys.add(key));
        dynamicPatterns.push(...extractDynamicKeyPatterns(source));
        texts.push(source);
    }
    for (const file of files.other) texts.push(readFileSync(file, "utf-8"));

    const keys = catalogKeysAt(null);
    const unused = findUnusedKeys(keys, {namedKeys, dynamicPatterns, texts});
    const oldRef = commitAgeDaysAgo();
    const aged = agedUnusedKeys(unused, new Set(catalogKeysAt(oldRef)));
    const head = execFileSync("git", ["-C", REPO, "rev-parse", "--short", "HEAD"], {encoding: "utf-8"}).trim();
    const counts = {keysChecked: keys.length, filesScanned: texts.length, unused: unused.length, aged: aged.length};

    console.log(
        `unused-catalog-keys: ${counts.keysChecked} keys against ${counts.filesScanned} files ` +
            `(${files.app.length} app, ${files.packages.length} package, ${files.other.length} other); ` +
            `${counts.unused} unused, ${counts.aged} older than ${AGE_DAYS} days (catalog at ${oldRef.slice(0, 9)})`,
    );
    const out = arg("--out");
    if (out) writeFileSync(out, renderReport(aged, counts, head));
    const summary = arg("--summary");
    if (summary) writeFileSync(summary, JSON.stringify({...counts, head, aged}, null, 2));
    return 0;
}

try {
    process.exit(main());
} catch (err) {
    if (err instanceof ReportBasisError) {
        console.error(`unused-catalog-keys: FAIL-CLOSED: ${err.message}`);
        process.exit(2);
    }
    throw err;
}
