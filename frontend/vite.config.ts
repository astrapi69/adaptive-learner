/// <reference types="vitest" />
import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
import {VitePWA} from "vite-plugin-pwa";

import pkg from "./package.json" with {type: "json"};

export default defineConfig({
    define: {
        // Single source of truth: package.json. Replaced at build
        // time (and during vitest runs) by the literal string.
        // Downstream code reads __APP_VERSION__ instead of
        // re-declaring a hardcoded constant.
        __APP_VERSION__: JSON.stringify(pkg.version),
    },
    plugins: [
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
                "icon-512.svg",
            ],
            manifest: {
                name: "Adaptive Learner",
                short_name: "Adaptive Learner",
                description: "Adaptive learning system based on the six-method learning model.",
                theme_color: "#6366f1",
                background_color: "#ffffff",
                display: "standalone",
                orientation: "any",
                start_url: "/",
                scope: "/",
                icons: [
                    // SVG-only set. iOS 15+ + every recent Android /
                    // desktop browser support image/svg+xml for PWA
                    // icons; dropping the .png raster pair removes the
                    // Bibliogon-branded legacy and shrinks the precache
                    // payload. Re-add raster fallbacks only if a real
                    // user reports an older device.
                    {src: "/icon-192.svg", sizes: "192x192", type: "image/svg+xml", purpose: "any"},
                    {src: "/icon-512.svg", sizes: "512x512", type: "image/svg+xml", purpose: "any"},
                ],
            },
            workbox: {
                // Precache static assets, skip API calls
                globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
                navigateFallback: "/index.html",
                runtimeCaching: [
                    {
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
