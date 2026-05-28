/**
 * Build-time content bundling (Phase 51D / v1.34.0).
 *
 * Copies the canonical pilot content sets under
 * ``docs/explorations/sample-content/`` into the Vite build's
 * ``public/content/`` directory so the GH-Pages-shape build
 * ships the pilot lessons as static assets. No external repo
 * required — first-time visitors see lessons immediately.
 *
 * Runs as a ``predev`` / ``prebuild`` npm hook, so the dev
 * server + the production build both pick up the latest
 * content with zero manual steps. The destination directory
 * is gitignored — the canonical source stays in
 * ``docs/explorations/``.
 *
 * Sources are read from a constant below; adding a new set
 * is a one-line PR here + creating the directory under
 * ``docs/explorations/sample-content/``.
 */
import {cpSync, existsSync, mkdirSync, rmSync} from "node:fs";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FRONTEND_ROOT = resolve(__dirname, "..");
const REPO_ROOT = resolve(FRONTEND_ROOT, "..");
const SRC_BASE = resolve(REPO_ROOT, "docs", "explorations", "sample-content");
const DEST_BASE = resolve(FRONTEND_ROOT, "public", "content");

const BUNDLED_SETS = ["fr-a1", "es-a1"];

function log(msg) {
    console.log(`[copy-bundled-content] ${msg}`);
}

function main() {
    if (!existsSync(SRC_BASE)) {
        log(`SKIP: ${SRC_BASE} not found (expected during isolated frontend tests).`);
        return 0;
    }

    // Wipe + recreate the destination so removed sets don't
    // linger from a prior build.
    if (existsSync(DEST_BASE)) {
        rmSync(DEST_BASE, {recursive: true, force: true});
    }
    mkdirSync(DEST_BASE, {recursive: true});

    let copied = 0;
    for (const setKey of BUNDLED_SETS) {
        const src = join(SRC_BASE, setKey);
        const dest = join(DEST_BASE, setKey);
        if (!existsSync(src)) {
            log(`SKIP: ${setKey} (not in source tree)`);
            continue;
        }
        cpSync(src, dest, {recursive: true});
        copied += 1;
        log(`copied: ${setKey}/`);
    }
    log(`done: ${copied}/${BUNDLED_SETS.length} sets bundled to public/content/`);
    return 0;
}

process.exit(main());
