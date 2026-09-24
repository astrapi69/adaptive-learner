/**
 * Build-context boundary guard (#3239, the #2559 class).
 *
 * Two production builds compile ``frontend/src``, and they see different
 * parts of the repository:
 *
 * - The GitHub Pages / Dexie build runs in CI with the whole checkout, so
 *   any relative path resolves.
 * - The production image (``docker-compose.prod.yml``, the desktop launcher
 *   and ``install.sh`` path) builds the frontend in the ``frontend-build``
 *   stage of ``backend/Dockerfile``. That stage sees only what it COPYs:
 *   ``frontend/`` to ``/frontend`` and ``schema/`` to ``/schema`` (#2559).
 *
 * ``bun run build`` is ``tsc -b && vite build`` and ``tsc`` covers all of
 * ``src`` including tests, so one test importing a path the stage does not
 * copy breaks the image while every other build stays green. #2559 (the
 * schema mirror, fixed by copying ``schema/``) and #3239 (Vitest importing
 * ``e2e/visual/visual-pins``) are the two instances so far.
 *
 * The guard maps the REAL build context instead of a hardcoded list: it
 * parses the COPY lines of the ``frontend-build`` stage and allows an import
 * only when the file it resolves to in the checkout is placed by one of
 * those copies at exactly the path the same import resolves to inside the
 * image. ``schema-version.test.ts`` importing
 * ``../../../../schema/content-manifest.schema.json`` stays allowed because
 * ``COPY schema/ /schema/`` mirrors the checkout layout next to
 * ``/frontend``; an ``e2e/`` import is rejected because no COPY places it.
 * When the stage, its WORKDIR or its ``frontend/`` copy cannot be read, the
 * guard fails closed: the build changed and the guard must be revisited.
 *
 * Checked specifiers (relative, absolute and alias-prefixed), read from the
 * TypeScript syntax tree so comments and ordinary strings never count:
 * static and type-only ``import`` / ``export ... from``, dynamic
 * ``import()`` and ``typeof import()``, ``import x = require()``,
 * ``/// <reference path>``, the ``vi.mock`` / ``vi.doMock`` /
 * ``vi.importActual`` family and ``import.meta.glob`` patterns. The aliases
 * themselves (tsconfig ``paths``, the Vite ``resolve.alias`` block) must
 * point inside the frontend root. Bare package specifiers resolve into
 * ``frontend/node_modules`` and are out of scope.
 *
 * Not covered: runtime file reads in tests (``readFileSync``,
 * ``new URL(..., import.meta.url)``), which neither tsc nor Vite resolves,
 * and ``.dockerignore`` exclusions inside a copied root.
 *
 * Cadence: the guard reads files through ``fs``, so ``vitest --changed`` on
 * a PR never selects it (the #1620 class). ``ci.yml`` therefore runs it as a
 * fixed step on every frontend PR; it also runs in every full suite
 * (develop push, nightly, ``make test``), and the ``frontend/**`` path
 * filter of ``docker-build-smoke.yml`` builds the real image behind it
 * (#3239).
 *
 * Gate contract (quality-checks.md, #2083): seeded negative controls prove
 * the detection, the run reports how many files and specifiers it checked
 * and fails on an empty scan, and an unreadable Dockerfile stage or alias
 * config fails closed instead of reading as clean.
 */

import {readdirSync, readFileSync, statSync} from "node:fs";
import {join, posix, relative, resolve, sep} from "node:path";

import ts from "typescript";
import {describe, expect, it} from "vitest";

const FRONTEND_ROOT = resolve(__dirname, "../..");
const REPO_ROOT = resolve(FRONTEND_ROOT, "..");
const SRC_ROOT = join(FRONTEND_ROOT, "src");
const DOCKERFILE = join(REPO_ROOT, "backend", "Dockerfile");
const TSCONFIG = join(FRONTEND_ROOT, "tsconfig.json");
const VITE_CONFIG = join(FRONTEND_ROOT, "vite.config.ts");
const BUILD_STAGE = "frontend-build";

/** One COPY instruction of the build stage. */
interface CopyInstruction {
    /** Repo-relative POSIX sources, without trailing slash ("." = context). */
    sources: string[];
    /** Absolute image path, already resolved against the stage WORKDIR. */
    destination: string;
    /** Whether ``destination`` names a directory the sources land in. */
    destinationIsDirectory: boolean;
}

/** The parsed ``frontend-build`` stage. */
interface BuildStage {
    copies: CopyInstruction[];
    /** Image path the checkout's ``frontend/`` directory lands at. */
    frontendImageRoot: string;
}

/**
 * A module alias: ``key`` matches the bare key or ``key/...``, as both
 * Vite and a tsconfig ``key/*`` pattern do.
 */
interface ModuleAlias {
    key: string;
    target: string;
    origin: string;
}

/** An import the image build cannot resolve the way the checkout does. */
interface BoundaryOffender {
    importer: string;
    specifier: string;
    resolvesTo: string;
}

/**
 * Tells whether a repo-relative path names a directory in the checkout.
 *
 * @param repoRelative - POSIX path relative to the repository root.
 * @returns ``true`` for an existing directory.
 */
function isCheckoutDirectory(repoRelative: string): boolean {
    try {
        return statSync(join(REPO_ROOT, repoRelative)).isDirectory();
    } catch {
        return false;
    }
}

/**
 * Splits the instruction arguments of a COPY line into its parts.
 *
 * @param args - Everything after the ``COPY`` keyword.
 * @returns The non-flag tokens, destination last.
 * @throws Error when the exec (JSON) form cannot be parsed.
 */
function copyTokens(args: string): string[] {
    const trimmed = args.trim();
    if (trimmed.startsWith("[")) {
        const parsed: unknown = JSON.parse(trimmed);
        if (!Array.isArray(parsed) || !parsed.every((token) => typeof token === "string")) {
            throw new Error(`unreadable COPY exec form: ${trimmed}`);
        }
        return parsed as string[];
    }
    return trimmed.split(/\s+/).filter((token) => !token.startsWith("--"));
}

/**
 * Reads one COPY line into a {@link CopyInstruction}.
 *
 * @param args - Everything after the ``COPY`` keyword.
 * @param workdir - The stage WORKDIR in effect for this line.
 * @param isDirectory - Tells whether a repo-relative source is a directory.
 * @returns The instruction, or ``null`` for a ``--from`` copy (another stage,
 *   not the build context).
 * @throws Error for a line the guard cannot model (wildcards, too few parts).
 */
function parseCopy(
    args: string,
    workdir: string,
    isDirectory: (repoRelative: string) => boolean,
): CopyInstruction | null {
    if (/(^|\s)--from=/.test(args)) return null;
    const tokens = copyTokens(args);
    if (tokens.length < 2) throw new Error(`COPY without source and destination: COPY ${args}`);
    const destination = tokens[tokens.length - 1];
    const sources = tokens.slice(0, -1).map((source) => {
        if (/[*?[]/.test(source)) {
            throw new Error(`COPY source with a wildcard is not modelled: ${source}`);
        }
        const normalized = posix.normalize(source).replace(/\/+$/, "");
        return normalized === "" ? "." : normalized;
    });
    const destinationIsDirectory =
        destination.endsWith("/") ||
        destination === "." ||
        sources.length > 1 ||
        sources.some((source) => source === "." || isDirectory(source));
    return {
        sources,
        destination: posix.resolve(workdir, destination),
        destinationIsDirectory,
    };
}

/**
 * Parses the named stage of a Dockerfile into its COPY instructions.
 *
 * Fails closed: a missing stage, an ``ADD``, an unmodelled COPY or a stage
 * without a ``frontend/`` directory copy throws, because each of them means
 * the build changed in a way this guard does not understand yet.
 *
 * @param dockerfile - Dockerfile text.
 * @param stageName - The ``AS <name>`` of the stage.
 * @param isDirectory - Tells whether a repo-relative source is a directory.
 * @returns The stage's copies and where ``frontend/`` lands.
 *
 * @example
 * const stage = parseBuildStage(readFileSync(DOCKERFILE, "utf-8"), "frontend-build");
 * stage.frontendImageRoot; // "/frontend"
 */
function parseBuildStage(
    dockerfile: string,
    stageName: string,
    isDirectory: (repoRelative: string) => boolean = isCheckoutDirectory,
): BuildStage {
    const lines = dockerfile
        .replace(/\\\r?\n/g, " ")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line !== "" && !line.startsWith("#"));
    const start = lines.findIndex(
        (line) => /^FROM\s+(?:--\S+\s+)*\S+\s+AS\s+(\S+)$/i.exec(line)?.[1] === stageName,
    );
    if (start < 0) throw new Error(`no "FROM ... AS ${stageName}" stage in the Dockerfile`);

    const copies: CopyInstruction[] = [];
    let workdir = "/";
    for (const line of lines.slice(start + 1)) {
        const [keyword, ...rest] = line.split(/\s+/);
        const args = rest.join(" ");
        const instruction = keyword.toUpperCase();
        if (instruction === "FROM") break;
        if (instruction === "WORKDIR") workdir = posix.resolve(workdir, args);
        if (instruction === "ADD") throw new Error(`ADD in the ${stageName} stage is not modelled`);
        if (instruction === "COPY") {
            const copy = parseCopy(args, workdir, isDirectory);
            if (copy !== null) copies.push(copy);
        }
    }

    const frontendCopy = copies.find(
        (copy) => copy.destinationIsDirectory && copy.sources.includes("frontend"),
    );
    if (frontendCopy === undefined) {
        throw new Error(`the ${stageName} stage has no directory COPY of frontend/`);
    }
    return {copies, frontendImageRoot: frontendCopy.destination};
}

/**
 * Every image path a checkout file lands at through the stage's copies.
 *
 * @param stage - The parsed build stage.
 * @param repoRelative - POSIX path relative to the repository root.
 * @returns Absolute image paths (empty when no COPY carries the file).
 */
function imagePathsOf(stage: BuildStage, repoRelative: string): string[] {
    const placed: string[] = [];
    for (const copy of stage.copies) {
        for (const source of copy.sources) {
            if (source === ".") {
                placed.push(posix.join(copy.destination, repoRelative));
            } else if (repoRelative.startsWith(`${source}/`)) {
                placed.push(posix.join(copy.destination, repoRelative.slice(source.length + 1)));
            } else if (repoRelative === source) {
                placed.push(
                    copy.destinationIsDirectory
                        ? posix.join(copy.destination, posix.basename(source))
                        : copy.destination,
                );
            }
        }
    }
    return placed;
}

/**
 * Human-readable list of the directory roots the stage copies, for the
 * report line (single-file copies are only counted).
 *
 * @param stage - The parsed build stage.
 * @returns E.g. ``"schema/ -> /schema/, frontend/ -> /frontend/ (+2 files)"``.
 */
function describeRoots(stage: BuildStage): string {
    const sources = stage.copies.flatMap((copy) =>
        copy.sources.map((source) => ({source, destination: copy.destination})),
    );
    const roots = sources.filter(({source}) => isCheckoutDirectory(source));
    const files = sources.length - roots.length;
    const listed = roots.map(({source, destination}) => `${source}/ -> ${destination}/`).join(", ");
    return files > 0 ? `${listed} (+${files} files)` : listed;
}

/** ``vi.*`` helpers whose first argument is a module path. */
const VI_PATH_METHODS = new Set([
    "mock",
    "doMock",
    "unmock",
    "doUnmock",
    "importActual",
    "importMock",
]);

/**
 * The text of a plain string literal, or of each one in an array literal.
 *
 * @param node - A call argument, or ``undefined`` when absent.
 * @returns The literal texts (empty for anything computed).
 */
function literalTexts(node: ts.Node | undefined): string[] {
    if (node === undefined) return [];
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return [node.text];
    if (ts.isArrayLiteralExpression(node)) return node.elements.flatMap((element) => literalTexts(element));
    return [];
}

/**
 * Module paths passed to a call: ``import()``, ``require()``,
 * ``vi.mock()`` and its family, ``import.meta.glob()`` (negated patterns
 * included, their ``!`` stripped).
 *
 * @param call - The call expression.
 * @returns The paths it names (empty for any other call).
 */
function callSpecifiers(call: ts.CallExpression): string[] {
    const callee = call.expression;
    const firstArgument = call.arguments[0];
    if (callee.kind === ts.SyntaxKind.ImportKeyword) return literalTexts(firstArgument);
    if (ts.isIdentifier(callee) && callee.text === "require") return literalTexts(firstArgument);
    if (!ts.isPropertyAccessExpression(callee)) return [];
    const method = callee.name.text;
    const target = callee.expression;
    if (ts.isIdentifier(target) && target.text === "vi" && VI_PATH_METHODS.has(method)) {
        return literalTexts(firstArgument);
    }
    if (ts.isMetaProperty(target) && method === "glob") {
        return literalTexts(firstArgument).map((pattern) => pattern.replace(/^!/, ""));
    }
    return [];
}

/**
 * Module paths one AST node names: import / export declarations,
 * ``import x = require()``, ``typeof import()`` types and calls.
 *
 * @param node - Any node of the source file.
 * @returns The paths it names directly (children not included).
 */
function nodeSpecifiers(node: ts.Node): string[] {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
        return literalTexts(node.moduleSpecifier);
    }
    if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
        return literalTexts(node.moduleReference.expression);
    }
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
        return literalTexts(node.argument.literal);
    }
    if (ts.isCallExpression(node)) return callSpecifiers(node);
    return [];
}

/**
 * Module specifiers a source file hands to tsc, Vite or Vitest, read from
 * the file's syntax tree (comments and ordinary strings never count).
 *
 * @param fileName - The file's name (``.tsx`` selects the JSX grammar).
 * @param sourceText - The file's text.
 * @returns Specifiers as written, query and hash suffixes stripped.
 *
 * @example
 * moduleSpecifiers("a.ts", 'import {b} from "../b?raw";'); // ["../b"]
 */
function moduleSpecifiers(fileName: string, sourceText: string): string[] {
    const kind = /\.[cm]?[jt]sx$/.test(fileName) ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const sourceFile = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, false, kind);
    const found = sourceFile.referencedFiles.map((reference) => reference.fileName);
    const visit = (node: ts.Node): void => {
        found.push(...nodeSpecifiers(node));
        ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    return found.map((specifier) => specifier.split(/[?#]/)[0]);
}

/**
 * Where a specifier points, once in the checkout and once in the image.
 *
 * @param specifier - The specifier as written.
 * @param importer - Repo-relative POSIX path of the importing file.
 * @param importerImagePath - Image path of the importing file.
 * @param stage - The parsed build stage.
 * @param aliases - Module aliases of the build.
 * @returns Both targets, or ``null`` for a bare package specifier.
 */
function targetsOf(
    specifier: string,
    importer: string,
    importerImagePath: string,
    stage: BuildStage,
    aliases: ModuleAlias[],
): {checkout: string; image: string} | null {
    if (specifier.startsWith("./") || specifier.startsWith("../") || specifier === "..") {
        return {
            checkout: posix.normalize(posix.join(posix.dirname(importer), specifier)),
            image: posix.resolve(posix.dirname(importerImagePath), specifier),
        };
    }
    if (specifier.startsWith("/")) {
        return {checkout: `<absolute ${specifier}>`, image: specifier};
    }
    const alias = aliases.find(
        (candidate) => specifier === candidate.key || specifier.startsWith(`${candidate.key}/`),
    );
    if (alias === undefined) return null;
    const rest = specifier.slice(alias.key.length + 1);
    const aliasImagePath = imagePathsOf(stage, alias.target)[0] ?? "/<alias target not in the image>";
    return {
        checkout: posix.normalize(posix.join(alias.target, rest)),
        image: posix.resolve(aliasImagePath, rest),
    };
}

/**
 * Specifiers of one file that the image build cannot resolve the way the
 * checkout does.
 *
 * @param importer - Repo-relative POSIX path of the importing file.
 * @param sourceText - The file's text.
 * @param stage - The parsed build stage.
 * @param aliases - Module aliases of the build.
 * @returns The offenders plus how many specifiers were checked.
 */
function boundaryOffenders(
    importer: string,
    sourceText: string,
    stage: BuildStage,
    aliases: ModuleAlias[],
): {offenders: BoundaryOffender[]; checked: number} {
    const importerImagePath = imagePathsOf(stage, importer)[0];
    if (importerImagePath === undefined) {
        throw new Error(`${importer} is not carried into the image by any COPY`);
    }
    const offenders: BoundaryOffender[] = [];
    let checked = 0;
    for (const specifier of moduleSpecifiers(importer, sourceText)) {
        const targets = targetsOf(specifier, importer, importerImagePath, stage, aliases);
        if (targets === null) continue;
        checked += 1;
        if (!imagePathsOf(stage, targets.checkout).includes(targets.image)) {
            offenders.push({importer, specifier, resolvesTo: targets.checkout});
        }
    }
    return {offenders, checked};
}

/**
 * Aliases from tsconfig ``paths`` (each ``<key>/*`` -> ``<dir>/*`` pair).
 *
 * @returns The aliases, targets repo-relative.
 * @throws Error when tsconfig cannot be read or a pattern is not modelled.
 */
function tsconfigAliases(): ModuleAlias[] {
    const read = ts.readConfigFile(TSCONFIG, ts.sys.readFile);
    if (read.error !== undefined) {
        throw new Error(`tsconfig.json unreadable: ${ts.flattenDiagnosticMessageText(read.error.messageText, "\n")}`);
    }
    const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, FRONTEND_ROOT);
    const base = parsed.options.baseUrl ?? parsed.options.pathsBasePath ?? FRONTEND_ROOT;
    const aliases: ModuleAlias[] = [];
    for (const [pattern, targets] of Object.entries(parsed.options.paths ?? {})) {
        for (const target of targets) {
            if (!pattern.endsWith("/*") || !target.endsWith("/*")) {
                throw new Error(`tsconfig paths entry not modelled: ${pattern} -> ${target}`);
            }
            aliases.push({
                key: pattern.slice(0, -2),
                target: toRepoRelative(resolve(String(base), target.slice(0, -2))),
                origin: `tsconfig.json paths "${pattern}"`,
            });
        }
    }
    return aliases;
}

/**
 * Aliases from the ``resolve.alias`` object of ``vite.config.ts``.
 *
 * The config is read as text (importing it would run the whole Vite plugin
 * stack). Every entry must have the form
 * ``"key": fileURLToPath(new URL("<relative>", import.meta.url))``.
 *
 * @param configText - The text of ``vite.config.ts``.
 * @returns The aliases, targets repo-relative.
 * @throws Error for any alias block or entry of another shape.
 */
function viteAliases(configText: string): ModuleAlias[] {
    const withoutComments = configText.replace(/^\s*\/\/.*$/gm, "");
    const aliases: ModuleAlias[] = [];
    for (const match of withoutComments.matchAll(/\balias\s*:\s*/g)) {
        const open = match.index + match[0].length;
        if (withoutComments[open] !== "{") {
            throw new Error("vite.config.ts alias is not an object literal; revisit the guard");
        }
        const close = withoutComments.indexOf("}", open);
        const block = withoutComments.slice(open + 1, close);
        const entry =
            /(["']?)([^"'\s:]+)\1\s*:\s*fileURLToPath\(\s*new URL\(\s*["']([^"']+)["']\s*,\s*import\.meta\.url\s*\)\s*\)/g;
        for (const found of block.matchAll(entry)) {
            aliases.push({
                key: found[2],
                target: toRepoRelative(resolve(FRONTEND_ROOT, found[3])),
                origin: `vite.config.ts alias "${found[2]}"`,
            });
        }
        if (block.replace(entry, "").replace(/[\s,]/g, "") !== "") {
            throw new Error(`vite.config.ts alias entry not modelled: ${block.trim()}`);
        }
    }
    return aliases;
}

/**
 * Converts an absolute checkout path to a repo-relative POSIX path.
 *
 * @param absolutePath - Absolute path in the checkout.
 * @returns E.g. ``"frontend/src"``; starts with ``..`` when outside the repo.
 */
function toRepoRelative(absolutePath: string): string {
    return relative(REPO_ROOT, absolutePath).split(sep).join("/");
}

/** Every ``.ts`` / ``.tsx`` (and JS) file under ``frontend/src``. */
function sourceFiles(): string[] {
    return readdirSync(SRC_ROOT, {recursive: true, encoding: "utf-8"})
        .filter((entry) => /\.(?:[cm]?tsx?|[cm]?jsx?)$/.test(entry))
        .map((entry) => join(SRC_ROOT, entry));
}

describe("frontend build context boundary (#3239)", () => {
    const stage = parseBuildStage(readFileSync(DOCKERFILE, "utf-8"), BUILD_STAGE);
    const aliases = [...tsconfigAliases(), ...viteAliases(readFileSync(VITE_CONFIG, "utf-8"))];
    const files = sourceFiles();
    const results = files.map((file) =>
        boundaryOffenders(toRepoRelative(file), readFileSync(file, "utf-8"), stage, aliases),
    );
    const offenders = results.flatMap((result) => result.offenders);
    const checked = results.reduce((sum, result) => sum + result.checked, 0);

    it("reads the build context from the frontend-build stage of backend/Dockerfile", () => {
        expect(stage.frontendImageRoot).toBe("/frontend");
        expect(imagePathsOf(stage, "schema/content-manifest.schema.json")).toContain(
            "/schema/content-manifest.schema.json",
        );
        console.log(`[build-context-boundary] ${BUILD_STAGE} copies: ${describeRoots(stage)}`);
    });

    it("scans a non-trivial set (an empty scan must not read as clean)", () => {
        expect(SRC_ROOT).toMatch(/[\\/]frontend[\\/]src$/);
        expect(files.length).toBeGreaterThan(1000);
        expect(checked).toBeGreaterThan(1000);
        console.log(
            `[build-context-boundary] scanned ${files.length} files under frontend/src, ` +
                `checked ${checked} relative/absolute/alias specifiers`,
        );
    });

    it("every import in frontend/src resolves inside the image's build context", () => {
        const report = offenders.map(
            (offender) => `${offender.importer}: "${offender.specifier}" -> ${offender.resolvesTo}`,
        );
        expect(
            report,
            "These imports resolve in a full checkout but not in the frontend-build " +
                "stage of backend/Dockerfile, so the production image fails to build. " +
                "Move the imported module under frontend/ (the e2e -> frontend direction " +
                "is fine), or copy its directory into that stage at the same relative " +
                "position.",
        ).toEqual([]);
    });

    it("every module alias points inside the frontend root", () => {
        expect(aliases.length).toBeGreaterThan(0);
        const outside = aliases
            .filter((alias) => !`${alias.target}/`.startsWith("frontend/"))
            .map((alias) => `${alias.origin} -> ${alias.target}`);
        expect(outside).toEqual([]);
    });
});

describe("build context boundary: negative controls", () => {
    const stage = parseBuildStage(readFileSync(DOCKERFILE, "utf-8"), BUILD_STAGE);
    const aliases: ModuleAlias[] = [{key: "@", target: "frontend/src", origin: "test"}];
    const importer = "frontend/src/lib/random/example.test.ts";

    it.each([
        {name: "an e2e import", source: 'import {a} from "../../../../e2e/visual/visual-pins";'},
        {name: "a type-only e2e import", source: 'import type {A} from "../../../../e2e/a";'},
        {name: "a dynamic import of the repo root", source: 'await import("../../../../Makefile");'},
        {name: "a vi.mock path outside", source: 'vi.mock("../../../../e2e/helpers", () => ({}));'},
        {name: "a glob outside", source: 'import.meta.glob<string>("../../../../e2e/*.ts");'},
        {name: "an alias climbing out", source: 'import {a} from "@/../../e2e/visual/visual-pins";'},
        {name: "an absolute path", source: 'import {a} from "/home/user/pins";'},
    ])("rejects $name", ({source}) => {
        expect(boundaryOffenders(importer, source, stage, aliases).offenders).toHaveLength(1);
    });

    it.each([
        {name: "a sibling import", source: 'import {a} from "./pinned-random";'},
        {name: "an import inside frontend/", source: 'import pkg from "../../../package.json";'},
        {name: "the mirrored schema/ copy", source: 'import s from "../../../../schema/content-manifest.schema.json";'},
        {name: "an alias staying inside", source: 'import {a} from "@/lib/random";'},
        {name: "a bare package", source: 'import {describe} from "vitest";'},
        {name: "an outside path in a comment only", source: '// import {a} from "../../../../e2e/x";'},
    ])("allows $name", ({source}) => {
        expect(boundaryOffenders(importer, source, stage, aliases).offenders).toEqual([]);
    });

    it("rejects a schema import once the copy stops mirroring the checkout layout", () => {
        const moved = parseBuildStage(
            "FROM node AS frontend-build\nCOPY schema/ /opt/schema/\nWORKDIR /frontend\nCOPY frontend/ .\n",
            BUILD_STAGE,
        );
        const source = 'import s from "../../../../schema/content-manifest.schema.json";';
        expect(boundaryOffenders(importer, source, moved, aliases).offenders).toHaveLength(1);
    });

    it.each([
        {name: "a missing stage", dockerfile: "FROM node AS other\nCOPY frontend/ /frontend/\n"},
        {name: "a stage without a frontend/ copy", dockerfile: "FROM node AS frontend-build\nCOPY schema/ /schema/\n"},
        {name: "an ADD in the stage", dockerfile: "FROM node AS frontend-build\nADD frontend/ /frontend/\n"},
        {name: "a wildcard COPY", dockerfile: "FROM node AS frontend-build\nCOPY front*/ /frontend/\n"},
    ])("fails closed on $name", ({dockerfile}) => {
        expect(() => parseBuildStage(dockerfile, BUILD_STAGE)).toThrow();
    });

    it("fails closed on a Vite alias it cannot model", () => {
        expect(() => viteAliases('resolve: {alias: [{find: "@", replacement: "/x"}]}')).toThrow();
        expect(() => viteAliases('resolve: {alias: {"@": path.resolve(__dirname, "../e2e")}}')).toThrow();
    });

    it("reads a Vite alias target and reports one outside the frontend root", () => {
        const outside = viteAliases(
            'resolve: {alias: {"@e2e": fileURLToPath(new URL("../e2e", import.meta.url))}}',
        );
        expect(outside).toEqual([
            {key: "@e2e", target: "e2e", origin: 'vite.config.ts alias "@e2e"'},
        ]);
    });
});
