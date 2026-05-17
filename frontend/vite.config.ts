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
            includeAssets: ["icon-192.png", "icon-512.png", "icon-192.svg", "icon-512.svg"],
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
                    {src: "/icon-192.png", sizes: "192x192", type: "image/png"},
                    {src: "/icon-512.png", sizes: "512x512", type: "image/png"},
                    {src: "/icon-192.svg", sizes: "192x192", type: "image/svg+xml", purpose: "any"},
                    {src: "/icon-512.svg", sizes: "512x512", type: "image/svg+xml", purpose: "any"},
                ],
            },
            workbox: {
                // Precache static assets, skip API calls
                globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
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
        port: 5173,
        open: true,
        proxy: {
            "/api": {
                // Default targets the backend on the host (the
                // `make dev` flow). Inside Docker Compose,
                // ``localhost`` resolves to the frontend container
                // itself, not the backend service - so override
                // via VITE_API_PROXY_TARGET=http://backend:8000 in
                // docker-compose.yml. The env var is read by Node
                // when vite.config.ts is evaluated; no client-side
                // exposure (so the VITE_ prefix is incidental, not
                // required).
                target: process.env.VITE_API_PROXY_TARGET || "http://localhost:8000",
                changeOrigin: true,
            },
        },
    },
});
