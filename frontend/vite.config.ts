/// <reference types="vitest" />
import {fileURLToPath} from "node:url";
import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import {VitePWA} from "vite-plugin-pwa";
import {visualizer} from "rollup-plugin-visualizer";

import pkg from "./package.json" with {type: "json"};

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
 * #613 — emit a static ``version.json`` (``{version, buildHash}``) into
 * the build root so the running app can fetch it (``cache: "no-store"``)
 * and detect when a newer build is deployed. JSON is intentionally NOT in
 * the Workbox precache globs (which only match js/css/html/svg/png/ico/
 * woff2), so it is always fetched fresh rather than served from a stale
 * precache.
 */
function emitVersionJson() {
    return {
        name: "adaptive-learner:emit-version-json",
        generateBundle() {
            // eslint-disable-next-line @typescript-eslint/no-invalid-this
            (this as {emitFile: (f: unknown) => void}).emitFile({
                type: "asset",
                fileName: "version.json",
                source: JSON.stringify({
                    version: pkg.version,
                    buildHash: process.env.VITE_BUILD_HASH || "unknown",
                }),
            });
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
    define: {
        // Single source of truth: package.json. Replaced at build
        // time (and during vitest runs) by the literal string.
        // Downstream code reads __APP_VERSION__ instead of
        // re-declaring a hardcoded constant.
        __APP_VERSION__: JSON.stringify(pkg.version),
        __BUILD_HASH__: JSON.stringify(process.env.VITE_BUILD_HASH || "unknown"),
        __BUILD_DATE__: JSON.stringify(process.env.VITE_BUILD_DATE || "unknown"),
    },
    plugins: [
        // Tailwind v4 Vite plugin. Must run before the React plugin so
        // the generated utility CSS is available to the module graph.
        // Phase A install is ADDITIVE — see
        // docs/development/tailwind-migration.md.
        tailwindcss(),
        react(),
        emitVersionJson(),
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
                "apple-touch-icon.png",
                "icon-192.png",
                "icon-512.png",
                "maskable-icon-512x512.png",
                "og-image.png",
                "offline.html",
            ],
            manifest: {
                name: "Adaptive Learner",
                // Phase 9B — short_name is what appears under the
                // home-screen icon. Android recommends ≤12 chars;
                // "Adaptive" fits comfortably and reads as a clear
                // app identity. The longer ``name`` still shows in
                // the app switcher.
                short_name: "Adaptive",
                description:
                    "Adaptive learning system based on the six-method " +
                    "learning model.",
                theme_color: "#0d9488",
                background_color: "#ffffff",
                display: "standalone",
                orientation: "any",
                start_url: base,
                scope: base,
                lang: "en",
                categories: ["education", "productivity"],
                icons: [
                    // The brand mark is a raster PNG (the teal "leaf /
                    // dispersing-dots" mark), regenerated by
                    // ``scripts/generate-icons.mjs``. The ``any`` icons
                    // carry the transparent mark; ``maskable`` is a
                    // separate dedicated asset with the mark on a white
                    // tile inside the inner safe zone. Keeping ``any`` and
                    // ``maskable`` as SEPARATE entries (never the combined
                    // ``"any maskable"``) stops Android from cropping the
                    // transparent icon in non-maskable contexts.
                    {src: `${base}icon-192.png`, sizes: "192x192", type: "image/png", purpose: "any"},
                    {src: `${base}icon-512.png`, sizes: "512x512", type: "image/png", purpose: "any"},
                    {src: `${base}maskable-icon-512x512.png`, sizes: "512x512", type: "image/png", purpose: "maskable"},
                ],
            },
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
                        // generic ``/api/`` NetworkFirst rule below (Workbox
                        // uses first-match) so these URLs hit this route.
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
                        // Phase 9B — network-first for API GETs so
                        // returning users see cached read responses
                        // when offline. POST / PATCH / DELETE still
                        // need network (NetworkOnly via the fallback
                        // entry below).
                        urlPattern: ({url, request}) =>
                            url.pathname.startsWith("/api/") &&
                            request.method === "GET",
                        handler: "NetworkFirst",
                        options: {
                            cacheName: "adaptive-learner-api",
                            networkTimeoutSeconds: 4,
                            expiration: {
                                maxEntries: 60,
                                maxAgeSeconds: 60 * 60 * 24,
                            },
                            cacheableResponse: {statuses: [0, 200]},
                        },
                    },
                    {
                        // Mutating API calls — never cache.
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
                        "vendor-react": ["react", "react-dom", "react-router-dom"],
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
});
