/// <reference types="vitest" />
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import {VitePWA} from "vite-plugin-pwa";
import {visualizer} from "rollup-plugin-visualizer";
import {buildVersion} from "@astrapi69/vite-plugin-build-version";

import pkg from "./package.json" with {type: "json"};
import {buildPwaManifest} from "./src/pwa/pwa-manifest";
import {robotsPolicyPlugin} from "./src/deploy/robots-policy";

/**
 * Base path for the public deployment. GH Pages serves the
 * site under ``/<repo>/`` (e.g. ``/adaptive-learner/``) so
 * Vite must prefix every asset URL with that path. CI sets
 * ``VITE_BASE`` from the workflow; local dev + Docker builds
 * leave it empty so the path stays ``/``.
 *
 * Hoisted to a module-level const so the PWA plugin manifest +
 * Workbox config can reference the same value (manifest fields
 * ``start_url``/``scope``/icon ``src`` and Workbox
 * ``navigateFallback`` all need the prefix, otherwise the
 * installed PWA + SW point at the wrong URLs).
 */
const base = (process.env.VITE_BASE as string) || "/";

/**
 * Inject the app version into index.html's JSON-LD at build time (and in dev),
 * replacing the ``{{APP_VERSION}}`` placeholder with package.json's version so
 * the structured-data ``softwareVersion`` never drifts from the canonical pin
 * (#1104). A non-``%``-delimited token so Vite's env replacement leaves it for
 * this transform.
 */
function injectAppVersionHtml() {
    return {
        name: "adaptive-learner:html-app-version",
        transformIndexHtml(html: string) {
            return html.replaceAll("{{APP_VERSION}}", pkg.version);
        },
    };
}

export default defineConfig({
    base,
    resolve: {
        alias: {
            // shadcn/ui import alias. Vite does not read tsconfig
            // ``paths`` on its own, so mirror the ``@/*`` -> ``src/*``
            // mapping here. Applies to the dev server, the build, AND
            // the embedded Vitest config below.
            "@": fileURLToPath(new URL("./src", import.meta.url)),
        },
    },
    plugins: [
        // #2404 — staging deliveries must not be indexable. The preview
        // workflow sets VITE_ROBOTS_POLICY=noindex; the plugin then rewrites
        // every delivered HTML document (SPA shell + static public/ pages)
        // to a noindex robots meta and emits a disallow-all robots.txt.
        // Production builds leave the variable unset and are untouched.
        robotsPolicyPlugin(process.env.VITE_ROBOTS_POLICY),
        // #1873 — emits ``version.json`` into the build root AND defines
        // __APP_VERSION__ / __BUILD_HASH__ / __BUILD_DATE__ (single source of
        // truth: package.json). The running app compares the literals against
        // the deployed manifest to detect a newer build. JSON is intentionally
        // NOT in the Workbox precache globs below (js/css/html/svg/png/ico/
        // woff2), so the manifest is always fetched fresh rather than served
        // from a stale precache.
        //
        // #1172 — the deployment-strand literals ride along as extra defines:
        // the branch that was built and the explicit strand ("haupt"/"latest")
        // the deploy workflow sets. Both default to "unknown" for local/Docker
        // builds where no workflow injects them; the strand resolver
        // (lib/provenance/build-info) then falls back to the branch, and
        // finally the URL.
        buildVersion({
            version: pkg.version,
            buildHash: process.env.VITE_BUILD_HASH,
            buildDate: process.env.VITE_BUILD_DATE,
            extraDefines: {
                __BUILD_BRANCH__: process.env.VITE_BUILD_BRANCH || "unknown",
                __BUILD_STRANG__: process.env.VITE_BUILD_STRANG || "unknown",
            },
        }),
        // Tailwind v4 Vite plugin. Must run before the React plugin so
        // the generated utility CSS is available to the module graph.
        // Phase A install is ADDITIVE — see
        // docs/development/tailwind-migration.md.
        tailwindcss(),
        react(),
        injectAppVersionHtml(),
        VitePWA({
            // #613 — user-driven updates: the SW installs but WAITS instead
            // of auto-reloading the tab. ``useAppUpdate`` detects the
            // waiting worker (+ the version.json mismatch) and the
            // UpdatePromptHost asks the user before applying. The generated
            // SW handles a ``{type: "SKIP_WAITING"}`` message to activate.
            registerType: "prompt",
            devOptions: {
                enabled: true,
            },
            includeAssets: [
                "favicon.ico",
                "favicon-16x16.png",
                "favicon-32x32.png",
                "favicon-16x16-dark.png",
                "favicon-32x32-dark.png",
                "apple-touch-icon.png",
                "icon-192.png",
                "icon-512.png",
                "icon-192-dark.png",
                "icon-512-dark.png",
                "maskable-icon-512x512.png",
                "og-image.png",
                // offline.html is deliberately NOT listed here: the
                // workbox globPatterns "**/*.html" sweep below already
                // precaches it from dist, and a second includeAssets
                // entry produced two manifest rows with conflicting
                // revisions - Workbox then rejects the whole precache
                // list at install time (#2499).
            ],
            // Manifest is the single source of truth in src/pwa/pwa-manifest.ts
            // (asserted by pwa-manifest.test.ts so display/icons/colors can't
            // silently regress). ``display: standalone`` runs the installed PWA
            // without the address bar on every platform.
            manifest: buildPwaManifest(base),
            workbox: {
                // Precache static assets. The offline.html fallback
                // is one of them so the SW can serve it without a
                // network roundtrip.
                globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
                // Purge the previous build's precached chunks when the
                // SW updates, so a stale index can't keep pointing at a
                // hashed chunk this deploy removed (#113 — pairs with
                // the lazyWithReload route wrapper).
                cleanupOutdatedCaches: true,
                // navigateFallback must include the base prefix so it
                // matches the precached index.html entry (which is
                // resolved against the SW's directory). Same with the
                // denylist regex — escape the base for use inside a
                // RegExp.
                navigateFallback: `${base}index.html`,
                navigateFallbackDenylist: [
                    // Don't intercept API endpoints with the SPA
                    // index — let them return real 404/5xx.
                    new RegExp(`^${base.replace(/\//g, "\\/")}api\\/`),
                    // Don't intercept the bundled MkDocs site at
                    // ``${base}docs/...``. The docs subtree is
                    // built into ``frontend/dist/docs/`` by the
                    // deploy workflow AFTER the SW is generated,
                    // so it's not in the precache manifest; without
                    // this denylist entry the SW's NavigationRoute
                    // returns the precached SPA shell for every
                    // ``/docs/*`` navigation and React Router renders
                    // NotFound instead of GH Pages serving the
                    // static MkDocs HTML.
                    new RegExp(`^${base.replace(/\//g, "\\/")}docs\\/`),
                ],
                runtimeCaching: [
                    {
                        // S1 (PWA hardening) — API-mode lesson + asset
                        // caching. In API mode the viewer fetches lessons
                        // per-request from
                        // ``/api/plugins/content-loader/.../lessons/NN.json``
                        // (+ ``/assets/...``); without this they only work
                        // offline if the browser HTTP cache happens to hold
                        // them. StaleWhileRevalidate (not CacheFirst): these
                        // URLs are NOT version-namespaced — the set version is
                        // a response field, not a path segment — so CacheFirst
                        // would pin stale content after a version bump. SWR
                        // serves the cached copy instantly (the offline win)
                        // AND revalidates in the background, so a re-download
                        // / new version is picked up on the next online load.
                        // The stale-version indicator (S1 part 3) surfaces the
                        // update to the user proactively. MUST precede the
                        // generic ``/api/`` NetworkOnly rule below (Workbox
                        // uses first-match) so these content URLs are cached
                        // for offline playback while every other /api/ call
                        // goes straight to the network (#997).
                        // (Bundled / Dexie-mode content is intentionally NOT
                        // matched here — it already lives in IndexedDB, and
                        // intercepting the download fetch would risk serving a
                        // stale copy back into Dexie on re-download.)
                        urlPattern: ({url, request}) =>
                            request.method === "GET" &&
                            url.pathname.includes(
                                "/plugins/content-loader/",
                            ) &&
                            (/\/lessons\/[^/]+\.json$/i.test(url.pathname) ||
                                /\/assets\//i.test(url.pathname)),
                        handler: "StaleWhileRevalidate",
                        options: {
                            cacheName: "adaptive-learner-lessons",
                            expiration: {
                                maxEntries: 500,
                                maxAgeSeconds: 60 * 60 * 24 * 90,
                            },
                            cacheableResponse: {statuses: [0, 200]},
                        },
                    },
                    {
                        // #997 — ALL /api/ calls are NetworkOnly (no SW
                        // caching or interception). The backend is the
                        // authoritative store and /api/ is only ever used in
                        // server (API) mode — Dexie/PWA mode reads IndexedDB
                        // and never touches /api/. The previous Phase 9B
                        // NetworkFirst cache of API GETs served a stale/empty
                        // set list right after a download ("downloaded sets
                        // disappear"), and a slow GET hit the 4s timeout with
                        // no cache entry -> workbox "no-response", so the real
                        // network response/error never reached the app. Letting
                        // every /api/ request go straight to the network fixes
                        // both. (Offline lesson playback is preserved by the
                        // version-aware lesson/asset StaleWhileRevalidate rule
                        // ABOVE, which is content, not mutable API state.)
                        urlPattern: /^\/api\//,
                        handler: "NetworkOnly",
                    },
                ],
            },
        }),
        // Bundle analyzer (#255). Off by default; ``ANALYZE=true npm run
        // build`` emits ``stats.html`` (treemap of the chunk graph). Dev
        // tool only — no CI gate, gitignored output.
        ...(process.env.ANALYZE
            ? [
                  visualizer({
                      filename: "stats.html",
                      template: "treemap",
                      gzipSize: true,
                      brotliSize: true,
                  }),
              ]
            : []),
    ],
    test: {
        environment: "happy-dom",
        globals: true,
        setupFiles: ["./src/test/setup.ts"],
        // #1620/#1665: guard tests read these files via readFileSync, which
        // the module graph behind `vitest --changed` (#615 selective PR CI)
        // cannot see - a change to a read target silently skipped the guard
        // (ios-zoom-guard on index.html in #1614; the matching-pair hue pin
        // on global.css in #1665). Any change to a listed path forces the
        // FULL suite instead. The first two entries are Vitest's defaults,
        // which an override REPLACES rather than extends.
        // The two default patterns end in /** and never match the config
        // FILES themselves (picomatch needs a trailing segment - measured);
        // the two file-form entries below make a package.json / config
        // change actually force the full run.
        forceRerunTriggers: [
            "**/package.json/**",
            "**/{vitest,vite}.config.*/**",
            "**/package.json",
            "**/{vitest,vite}.config.*",
            "**/index.html",
            "**/src/styles/**/*.css",
            "**/src/data/**/*.json",
        ],
    },
    build: {
        // Vite 8 (Rolldown) requires the function form of ``manualChunks``.
        // Skeleton state: only react + react-toastify warrant their own
        // chunks. Re-introduce vendor-tiptap / vendor-ui chunks when the
        // matching deps come back with the new domain.
        rollupOptions: {
            output: {
                manualChunks: (id: string) => {
                    if (!id.includes("node_modules")) return undefined;
                    const chunkMap: Record<string, string[]> = {
                        // #2040 — react-router v8 removed the react-router-dom
                        // package (DOM bindings live in react-router itself),
                        // so match the real package or the router silently
                        // falls out of the vendor-react chunk.
                        "vendor-react": ["react", "react-dom", "react-router"],
                        "vendor-ui": ["react-toastify"],
                        "vendor-charts": ["recharts", "d3-shape", "d3-scale", "d3-array", "d3-path", "d3-color", "d3-interpolate", "d3-format", "d3-time", "d3-time-format"],
                        "vendor-tree": ["tree-model"],
                        // Phase 38 — help-content rendering stack.
                        // react-markdown + remark/rehype + the
                        // Radix surfaces consumed only by the
                        // tooltip + drawer get their own chunk so
                        // the main bundle stays under the PWA
                        // precache limit (2 MiB default).
                        "vendor-markdown": [
                            "react-markdown",
                            "remark-gfm",
                            "rehype-slug",
                            "rehype-autolink-headings",
                            "mdast-util-to-hast",
                            "mdast-util-from-markdown",
                            "micromark",
                        ],
                        "vendor-radix": [
                            "@radix-ui/react-dialog",
                            "@radix-ui/react-popover",
                            "@radix-ui/react-hover-card",
                        ],
                    };
                    for (const [chunkName, pkgs] of Object.entries(chunkMap)) {
                        for (const pkg of pkgs) {
                            if (id.includes(`/node_modules/${pkg}/`)) {
                                return chunkName;
                            }
                        }
                    }
                    return undefined;
                },
            },
        },
    },
    server: {
        // Dev port. Resolution order:
        //   1. ADAPTIVE_LEARNER_FRONTEND_PORT env var (set by `make
        //      dev`, .env.example, Docker compose)
        //   2. 15174 default (non-standard so we coexist with
        //      other projects on :5173)
        port: Number(process.env.ADAPTIVE_LEARNER_FRONTEND_PORT) || 15174,
        open: true,
        proxy: {
            "/api": {
                // Backend target. Resolution order:
                //   1. VITE_API_PROXY_TARGET (Docker Compose sets
                //      this to http://backend:18001 because the
                //      frontend container's localhost is itself)
                //   2. http://localhost:${ADAPTIVE_LEARNER_PORT}
                //      with 18001 fallback (matches the Makefile +
                //      backend defaults)
                target:
                    process.env.VITE_API_PROXY_TARGET ||
                    `http://localhost:${process.env.ADAPTIVE_LEARNER_PORT || 18001}`,
                changeOrigin: true,
            },
        },
    },
    preview: {
        // #2575 — secure-context LAN device debugging (iOS Safari only
        // registers a service worker over https). Both env vars unset
        // (the default) leaves this plain http, matching every other
        // `vite preview` caller (make test-dexie-smoke, make
        // dev-lan-dexie). Generate a LAN-IP cert with mkcert, then set
        // both paths before `make dev-lan-dexie` — see
        // docs/developer/testing.md "LAN device debugging".
        https: (() => {
            const certPath = process.env.ADAPTIVE_LEARNER_LAN_CERT;
            const keyPath = process.env.ADAPTIVE_LEARNER_LAN_KEY;
            if (!certPath || !keyPath) {
                return undefined;
            }
            return {
                cert: readFileSync(certPath),
                key: readFileSync(keyPath),
            };
        })(),
    },
});
