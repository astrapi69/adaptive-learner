/// <reference types="vitest" />
import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import {VitePWA} from "vite-plugin-pwa";

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

export default defineConfig({
    base,
    define: {
        // Single source of truth: package.json. Replaced at build
        // time (and during vitest runs) by the literal string.
        // Downstream code reads __APP_VERSION__ instead of
        // re-declaring a hardcoded constant.
        __APP_VERSION__: JSON.stringify(pkg.version),
    },
    plugins: [
        // Tailwind v4 Vite plugin. Must run before the React plugin so
        // the generated utility CSS is available to the module graph.
        // Phase A install is ADDITIVE — see
        // docs/development/tailwind-migration.md.
        tailwindcss(),
        react(),
        VitePWA({
            registerType: "autoUpdate",
            devOptions: {
                enabled: true,
            },
            includeAssets: [
                "favicon.ico",
                "favicon.svg",
                "icon-192.svg",
                "icon-192.png",
                "icon-512.svg",
                "icon-512.png",
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
                theme_color: "#6366f1",
                background_color: "#ffffff",
                display: "standalone",
                orientation: "any",
                start_url: base,
                scope: base,
                lang: "en",
                categories: ["education", "productivity"],
                icons: [
                    // Both SVG + PNG at 192 / 512. iOS 15+ / modern
                    // Android pick the SVG (scales infinitely, no
                    // raster artefacts); older Android + some app
                    // switchers fall back to the PNG. ``maskable``
                    // ensures Android can crop the icon into its
                    // platform shape without losing the network mark.
                    {src: `${base}icon-192.svg`, sizes: "192x192", type: "image/svg+xml", purpose: "any"},
                    {src: `${base}icon-192.png`, sizes: "192x192", type: "image/png", purpose: "any maskable"},
                    {src: `${base}icon-512.svg`, sizes: "512x512", type: "image/svg+xml", purpose: "any"},
                    {src: `${base}icon-512.png`, sizes: "512x512", type: "image/png", purpose: "any maskable"},
                ],
            },
            workbox: {
                // Precache static assets. The offline.html fallback
                // is one of them so the SW can serve it without a
                // network roundtrip.
                globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
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
