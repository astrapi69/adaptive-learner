#!/usr/bin/env node
/**
 * Gate for the Mermaid diagrams in the help pages (#3800).
 *
 * The help pages (``docs/help/{lang}/**.md``) are published only on the
 * MkDocs site (#3798), which renders ```mermaid blocks with the Mermaid
 * script served from the site itself (``extra_javascript`` in mkdocs.yml),
 * never from Material's CDN fallback. This gate fails when
 *
 *   - a ```mermaid block does not parse with exactly that vendored script,
 *   - a block lacks ``accTitle`` or ``accDescr`` (what a screen reader reads,
 *     and the text a learner gets when the diagram does not render),
 *   - the vendored file is not byte-identical to the pinned npm release, or
 *     mkdocs.yml does not reference it (Material would then load Mermaid
 *     from unpkg, a foreign host on a site that runs under the owner's name).
 *
 * A self-test runs first on every invocation: a valid sample must pass, a
 * broken one and one without ``accDescr`` must fail. With no diagram in the
 * pages yet, the gate would otherwise be green for nothing.
 *
 * Mermaid needs a DOM (its sanitizer), so the script runs in a happy-dom
 * window. happy-dom is resolved from ``--happy-dom <dir>`` (CI installs the
 * version pinned in frontend/bun.lock) or from frontend/node_modules.
 *
 * Usage: node scripts/verify_mermaid_blocks.mjs [--happy-dom <dir>]
 * Exit: 0 all good, 1 a finding, 2 the gate itself could not run.
 */

import {createHash} from "node:crypto";
import {readFileSync, readdirSync, statSync, existsSync} from "node:fs";
import {createRequire} from "node:module";
import {dirname, join, relative, resolve} from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const HELP_DIR = join(ROOT, "docs", "help");
const MERMAID_VERSION = "11.17.2";
const MERMAID_FILE = `assets/javascripts/mermaid-${MERMAID_VERSION}.min.js`;
// sha512 of the npm tarball's dist/mermaid.min.js, 11.17.2. The tarball's own
// integrity (registry) is sha512-V6K3C8EBdEsPFZXSKMJe6ppQOENxuHARr9GvHX4hh47lAbhMRD9qf4oEK7LoaRQxULMa80/qt5gHO73aCleBBg==.
const MERMAID_SHA256 = "581ed7d74bd9048d0e3a91363927d72ef22942d7722546b27f7cc29e35390eb8";

const SELF_TEST = {
    valid: "flowchart TD\n  accTitle: Sample\n  accDescr: A leads to B.\n  A --> B",
    broken: "flowchart TD\n  accTitle: Sample\n  accDescr: Broken.\n  A --> ",
    noDescr: "flowchart TD\n  accTitle: Sample\n  A --> B",
};

/** ``text`` as a literal inside a regular expression. */
function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function argValue(name) {
    const index = process.argv.indexOf(name);
    return index >= 0 ? process.argv[index + 1] : undefined;
}

/** Every Markdown file under ``dir``, sorted. */
function markdownFiles(dir) {
    const out = [];
    for (const name of readdirSync(dir).sort()) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) out.push(...markdownFiles(path));
        else if (name.endsWith(".md")) out.push(path);
    }
    return out;
}

/** The ```mermaid blocks of a Markdown text, with their 1-based start line. */
export function mermaidBlocks(text) {
    const blocks = [];
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
        if (!/^\s*```mermaid\s*$/.test(lines[i])) continue;
        const start = i + 1;
        const body = [];
        for (i += 1; i < lines.length && !/^\s*```\s*$/.test(lines[i]); i++) body.push(lines[i]);
        blocks.push({line: start, code: body.join("\n")});
    }
    return blocks;
}

/** What a block lacks of the accessibility pair, as a list of names. */
export function missingAccessibility(code) {
    const missing = [];
    if (!/^\s*accTitle\s*:/m.test(code)) missing.push("accTitle");
    if (!/^\s*accDescr\s*(:|\{)/m.test(code)) missing.push("accDescr");
    return missing;
}

function loadHappyDom() {
    const dir = argValue("--happy-dom") ?? join(ROOT, "frontend", "node_modules", "happy-dom");
    if (!existsSync(dir)) {
        throw new Error(`happy-dom not found at ${dir} (pass --happy-dom <dir> or install the frontend dependencies)`);
    }
    return createRequire(pathToFileURL(join(dir, "package.json")).href)(dir);
}

/** A parse function backed by the vendored Mermaid in a happy-dom window. */
function mermaidParser(source) {
    const {Window} = loadHappyDom();
    const window = new Window({url: "https://docs.local/"});
    // The bundle declares its namespace with a top-level ``var`` and reads it
    // back from ``globalThis``; happy-dom evaluates inside a function scope,
    // so the namespace is created on the window first. The vendored file
    // itself is not changed.
    window.eval(
        "globalThis.__esbuild_esm_mermaid_nm = {};" +
            source.replace(
                /^"use strict";var __esbuild_esm_mermaid_nm;/,
                '"use strict";var __esbuild_esm_mermaid_nm = globalThis.__esbuild_esm_mermaid_nm;',
            ),
    );
    const mermaid = window.mermaid;
    if (!mermaid || typeof mermaid.parse !== "function") throw new Error("the vendored file did not define mermaid.parse");
    return {
        async parse(code) {
            try {
                await mermaid.parse(code);
                return null;
            } catch (error) {
                return String(error?.message ?? error).split("\n")[0];
            }
        },
        close: () => window.happyDOM.close(),
    };
}

/** Findings for one block: a parse error and/or missing accessibility. */
async function checkBlock(parser, code) {
    const findings = [];
    const missing = missingAccessibility(code);
    if (missing.length) findings.push(`missing ${missing.join(" and ")}`);
    const error = await parser.parse(code);
    if (error) findings.push(`does not parse: ${error}`);
    return findings;
}

function checkVendoredFile() {
    const findings = [];
    const path = join(HELP_DIR, MERMAID_FILE);
    if (!existsSync(path)) return [`${relative(ROOT, path)} is missing`];
    const digest = createHash("sha256").update(readFileSync(path)).digest("hex");
    if (digest !== MERMAID_SHA256) {
        findings.push(`${relative(ROOT, path)} is not the pinned mermaid@${MERMAID_VERSION} dist/mermaid.min.js (sha256 ${digest})`);
    }
    const mkdocs = readFileSync(join(ROOT, "mkdocs.yml"), "utf-8");
    const fence = /custom_fences:\s*\n\s*-\s*name:\s*mermaid/.test(mkdocs);
    const script = new RegExp(`^extra_javascript:\\s*\\n(\\s*-\\s*.*\\n)*?\\s*-\\s*${escapeRegExp(MERMAID_FILE)}\\s*$`, "m").test(mkdocs);
    if (!fence) findings.push("mkdocs.yml has no mermaid custom fence in pymdownx.superfences");
    if (!script) findings.push(`mkdocs.yml does not load ${MERMAID_FILE} through extra_javascript (Material would fall back to its CDN)`);
    return findings;
}

async function main() {
    const vendored = checkVendoredFile();
    const source = readFileSync(join(HELP_DIR, MERMAID_FILE), "utf-8");
    const parser = mermaidParser(source);
    try {
        const valid = await checkBlock(parser, SELF_TEST.valid);
        const broken = await checkBlock(parser, SELF_TEST.broken);
        const noDescr = await checkBlock(parser, SELF_TEST.noDescr);
        if (valid.length || !broken.length || !noDescr.length) {
            console.error("verify_mermaid_blocks: the self-test failed, the gate cannot be trusted:");
            console.error(JSON.stringify({valid, broken, noDescr}, null, 2));
            return 2;
        }

        const findings = [...vendored];
        let blocks = 0;
        const pages = markdownFiles(HELP_DIR);
        for (const page of pages) {
            for (const block of mermaidBlocks(readFileSync(page, "utf-8"))) {
                blocks += 1;
                for (const finding of await checkBlock(parser, block.code)) {
                    findings.push(`${relative(ROOT, page)}:${block.line}: ${finding}`);
                }
            }
        }
        const pinned = vendored.length === 0 ? "vendored and referenced" : "NOT vendored or referenced as pinned";
        console.log(
            `verify_mermaid_blocks: self-test ok; ${blocks} block(s) in ${pages.length} page(s); mermaid@${MERMAID_VERSION} ${pinned}`,
        );
        if (findings.length) {
            for (const finding of findings) console.error(`  ${finding}`);
            return 1;
        }
        return 0;
    } finally {
        await parser.close();
    }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main().then(
        (code) => process.exit(code),
        (error) => {
            console.error(`verify_mermaid_blocks: ${error.message}`);
            process.exit(2);
        },
    );
}
