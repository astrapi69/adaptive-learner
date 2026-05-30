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
 * Phase 60 / v1.44.0: the canonical sample content is now a
 * single repo tree (root ``manifest.yaml`` + a source-language
 * ``sets/{src}/{tgt-level}/`` hierarchy) that mirrors the public
 * ``astrapi69/adaptive-learner-content`` repo 1:1. The whole tree
 * is copied to ``public/content/adaptive-learner-content/`` so
 * the bundled source key ``bundled:adaptive-learner-content``
 * resolves to ``/content/adaptive-learner-content/manifest.yaml``
 * — the GH-Pages build reflects exactly the same tree as the
 * external repo (DEFAULT_SOURCES in content-loader-dexie.ts).
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

// Bundled source key (see DEFAULT_SOURCES in
// content-loader-dexie.ts: ``bundled:adaptive-learner-content``).
// The whole sample-content tree is copied under this directory so
// the loader's bundled URL resolution
// (``/content/<key>/manifest.yaml``) finds the root manifest.
const BUNDLED_REPO_KEY = "adaptive-learner-content";

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

    const rootManifest = join(SRC_BASE, "manifest.yaml");
    if (!existsSync(rootManifest)) {
        log(`SKIP: no root manifest.yaml in ${SRC_BASE}`);
        return 0;
    }

    // Copy the entire tree (root manifest + sets/) verbatim.
    const dest = join(DEST_BASE, BUNDLED_REPO_KEY);
    cpSync(SRC_BASE, dest, {recursive: true});
    log(`copied content tree to public/content/${BUNDLED_REPO_KEY}/`);
    return 0;
}

process.exit(main());
