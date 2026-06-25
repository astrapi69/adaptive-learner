/**
 * Build-time content bundling (Phase 51D / v1.34.0).
 *
 * Copies the canonical pilot content sets into the Vite build's
 * ``public/content/`` directory so the GH-Pages-shape build ships
 * the pilot lessons as static assets — first-time visitors see
 * lessons immediately, fully offline.
 *
 * Runs as a ``predev`` / ``prebuild`` npm hook, so the dev server +
 * the production build both pick up the latest content with zero
 * manual steps. The destination directory is gitignored.
 *
 * Phase 62 (EXP-018 follow-up): the lesson content NO LONGER lives
 * in the app repo. It is sourced from a checkout of the
 * ``astrapi69/adaptive-learner-content`` repo, resolved as:
 *   1. ``ADAPTIVE_LEARNER_CONTENT_DIR`` env var, if set (CI points
 *      this at a content-repo checkout — see deploy-gh-pages.yml);
 *   2. otherwise the sibling checkout ``../adaptive-learner-content``
 *      next to the app repo (the local-dev convention).
 * When neither resolves (no content checkout present), the script
 * FAILS OPEN — it logs a SKIP and the build proceeds with no
 * bundled content (the deployed site then falls back to fetching
 * sets from GitHub at runtime). This is a deliberate convenience
 * layer, not a hard build dependency.
 *
 * The canonical tree is a single repo (root ``manifest.yaml`` + a
 * source-language ``sets/{src}/{tgt-level}/`` hierarchy). The whole
 * tree is copied to ``public/content/adaptive-learner-content/`` so
 * the bundled source key ``bundled:adaptive-learner-content``
 * resolves to ``/content/adaptive-learner-content/manifest.yaml``
 * (DEFAULT_SOURCES in content-loader-dexie.ts).
 */
import {cpSync, existsSync, mkdirSync, rmSync} from "node:fs";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FRONTEND_ROOT = resolve(__dirname, "..");
const REPO_ROOT = resolve(FRONTEND_ROOT, "..");
// Content repo source: env override first, then the sibling
// checkout next to the app repo. The content lives in
// ``astrapi69/adaptive-learner-content``, NOT in this repo.
const SRC_BASE = process.env.ADAPTIVE_LEARNER_CONTENT_DIR
    ? resolve(process.env.ADAPTIVE_LEARNER_CONTENT_DIR)
    : resolve(REPO_ROOT, "..", "adaptive-learner-content");
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
        log(
            `SKIP: content checkout not found at ${SRC_BASE}. ` +
                `Set ADAPTIVE_LEARNER_CONTENT_DIR or check out ` +
                `adaptive-learner-content next to this repo. ` +
                `Build proceeds without bundled content (runtime GitHub fetch).`,
        );
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

    // Copy the entire tree (root manifest + sets/) verbatim, EXCEPT the
    // content checkout's own ``.git``. A nested ``.git`` inside the published
    // bundle makes a git-based deploy (peaceiris) treat the folder as a
    // SUBMODULE gitlink, which then fails GitHub Pages' submodule checkout
    // ("No url found for submodule path …"). The artifact-based main deploy
    // never hit this; the preview deploy did.
    const dest = join(DEST_BASE, BUNDLED_REPO_KEY);
    cpSync(SRC_BASE, dest, {
        recursive: true,
        filter: (src) => !/(^|[/\\])\.git([/\\]|$)/.test(src),
    });
    log(`copied content tree to public/content/${BUNDLED_REPO_KEY}/`);
    return 0;
}

process.exit(main());
