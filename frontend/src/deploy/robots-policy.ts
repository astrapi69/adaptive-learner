/**
 * Robots policy for non-production deliveries (#2404, EXP-049).
 *
 * The preview deployment (deploy-preview.yml, push on develop) is a
 * staging copy of the production app. It used to ship production's
 * `robots index, follow` meta and allow-all robots.txt, making the
 * staging copy indexable - a real defect: the canonical link mitigates
 * duplicate indexing but does not keep the copy out of the index.
 *
 * The fix is a build-time policy switch: when the workflow sets
 * ``VITE_ROBOTS_POLICY=noindex``, this plugin rewrites EVERY delivered
 * HTML document in the bundle output (the SPA shell AND the static
 * pages copied from ``public/``, e.g. the landing page) to a
 * ``noindex, nofollow`` robots meta, and replaces ``robots.txt`` with a
 * disallow-all file. Production builds do not set the variable and are
 * untouched.
 */

import {readdirSync, readFileSync, statSync, writeFileSync} from "node:fs";
import {join} from "node:path";

const NOINDEX_META = '<meta name="robots" content="noindex, nofollow"/>';

/** Disallow-all robots.txt for staging deliveries. */
export const NOINDEX_ROBOTS_TXT = "User-agent: *\nDisallow: /\n";

/**
 * Force a ``noindex, nofollow`` robots meta on one HTML document.
 *
 * Replaces every existing robots meta; documents without one get the
 * meta injected right after ``<head>``. Idempotent. The regex is
 * created per call - a shared global regex would carry ``lastIndex``
 * state between calls and silently skip matches.
 */
export function rewriteRobotsMeta(html: string): string {
    const robotsMeta = /<meta\s+name="robots"\s+content="[^"]*"\s*\/?>/g;
    if (robotsMeta.test(html)) {
        robotsMeta.lastIndex = 0;
        return html.replace(robotsMeta, NOINDEX_META);
    }
    return html.replace(/<head([^>]*)>/, `<head$1>${NOINDEX_META}`);
}

function htmlFilesUnder(dir: string): string[] {
    const found: string[] = [];
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
            found.push(...htmlFilesUnder(full));
        } else if (entry.endsWith(".html")) {
            found.push(full);
        }
    }
    return found;
}

interface RobotsPolicyPlugin {
    name: string;
    /** True only when the explicit noindex policy is set (pinned by tests). */
    active: boolean;
    apply: "build";
    configResolved(config: {build: {outDir: string}; root: string}): void;
    closeBundle(): void;
}

/**
 * Vite plugin: apply the robots policy to the finished bundle.
 *
 * @param policy - ``import.meta.env`` / ``process.env`` value of
 *   ``VITE_ROBOTS_POLICY``; only the literal ``"noindex"`` arms the
 *   plugin (explicit beats inferred - the preview workflow states its
 *   intent instead of the plugin guessing from VITE_BASE).
 */
export function robotsPolicyPlugin(policy: string | undefined): RobotsPolicyPlugin {
    // Closure state, NOT ``this``: Rollup invokes hooks with the plugin
    // CONTEXT as ``this``, so ``this.active`` inside closeBundle would be
    // undefined and the plugin would silently never fire (fail-open).
    const active = policy === "noindex";
    let outDir = "dist";
    return {
        name: "robots-policy",
        active,
        apply: "build",
        configResolved(config) {
            outDir = join(config.root, config.build.outDir);
        },
        closeBundle() {
            if (!active) return;
            const htmlFiles = htmlFilesUnder(outDir);
            for (const file of htmlFiles) {
                writeFileSync(file, rewriteRobotsMeta(readFileSync(file, "utf-8")), "utf-8");
            }
            writeFileSync(join(outDir, "robots.txt"), NOINDEX_ROBOTS_TXT, "utf-8");
            // console.warn, not log: the ESLint no-console rule allows only
            // warn/error, and a delivery-changing rewrite deserves loudness.
            console.warn(
                `[robots-policy] noindex applied to ${htmlFiles.length} HTML file(s) + robots.txt disallow-all`,
            );
        },
    };
}
