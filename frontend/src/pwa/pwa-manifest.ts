/**
 * pwa-manifest — the single source of truth for the Web App Manifest
 * (#604 follow-up). Built by ``vite.config.ts`` at build time and asserted by
 * ``pwa-manifest.test.ts``, so the install-critical fields (``display``,
 * icons, colors) can't silently regress.
 *
 * ``display: "standalone"`` is the deliberate choice: the installed PWA runs
 * without the browser address bar on every platform. ``fullscreen`` is NOT used
 * — it hides the status bar/clock/battery (too aggressive for a learning app)
 * and is ignored by iOS anyway. On iOS the only route to a chrome-less app is
 * adding the standalone PWA to the home screen.
 */

/** A single manifest icon entry. ``any`` and ``maskable`` are kept as separate
 *  entries (never the combined ``"any maskable"``) so Android doesn't crop the
 *  transparent mark in non-maskable contexts. */
export interface PwaIcon {
    src: string;
    sizes: string;
    type: string;
    purpose: "any" | "maskable";
}

export interface PwaManifest {
    name: string;
    short_name: string;
    description: string;
    theme_color: string;
    background_color: string;
    display: "standalone" | "fullscreen" | "minimal-ui" | "browser";
    orientation: string;
    start_url: string;
    scope: string;
    lang: string;
    categories: string[];
    icons: PwaIcon[];
}

/**
 * Build the manifest for a given deployment ``base`` (``/`` locally, ``/<repo>/``
 * on GitHub Pages). ``start_url`` / ``scope`` / icon ``src`` are all prefixed so
 * the installed PWA + service worker point at the right URLs.
 */
export function buildPwaManifest(base: string): PwaManifest {
    return {
        name: "Adaptive Learner",
        // Android recommends ≤12 chars for the home-screen label.
        short_name: "Adaptive",
        description:
            "Adaptive learning system based on the six-method learning model.",
        // Teal brand mark; the OS needs a static color (it can't read a token).
        theme_color: "#0d9488",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "any",
        start_url: base,
        scope: base,
        lang: "en",
        categories: ["education", "productivity"],
        icons: [
            { src: `${base}icon-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
            { src: `${base}icon-512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
            { src: `${base}maskable-icon-512x512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
    };
}
