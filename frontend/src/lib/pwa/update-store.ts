/**
 * pwa/update-store — the app's single {@link UpdateStore} instance (#1873).
 *
 * The update mechanism itself now lives in ``@astrapi69/pwa-update``; this
 * module is the thin app binding: it reads the Vite build literals, resolves
 * the deployed manifest URL, and creates the store once.
 *
 * ``storageNamespace: "adaptive-learner"`` is load-bearing, not cosmetic. The
 * package prefixes its keys with it, which reproduces the pre-extraction keys
 * BYTE-FOR-BYTE (``adaptive-learner.update.last_accepted_at`` etc.), so an
 * installed PWA keeps its accepted-update state across the swap instead of
 * re-offering an update the user already applied.
 */

import { createUpdateStore, type VersionManifest } from "@astrapi69/pwa-update";

/** The build this tab is running (build-time literals, see vite.config.ts). */
export const CURRENT_BUILD: VersionManifest = {
    version: typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "unknown",
    buildHash: typeof __BUILD_HASH__ === "string" ? __BUILD_HASH__ : "unknown",
};

/** Absolute URL of the deployed ``version.json`` (respects the Vite base). */
export function versionJsonUrl(): string {
    const base =
        typeof import.meta !== "undefined" && import.meta.env?.BASE_URL
            ? import.meta.env.BASE_URL
            : "/";
    return `${base}version.json`;
}

/**
 * The app-wide update store. A module singleton by design — the update state
 * is a single global fact about this tab, shared by the discreet banner and
 * the About "check for updates" control so the two can never disagree.
 */
export const appUpdateStore = createUpdateStore({
    build: CURRENT_BUILD,
    manifestUrl: versionJsonUrl(),
    storageNamespace: "adaptive-learner",
});
