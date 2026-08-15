/**
 * #2575 — on-device debug console (eruda) for LAN device debugging
 * (see ``make dev-lan-dexie`` + docs/developer/testing.md "LAN device
 * debugging"). A Linux dev machine has no Safari Web Inspector, so an
 * on-page console is the only way to read errors from an iPhone.
 *
 * Dev-only since #2610: the console exists ONLY in local dev and in the
 * LAN-debug build (``VITE_DEBUG_CONSOLE=1``, set by ``make dev-lan`` /
 * ``dev-lan-dexie``). The shipped build (production Docker image, public
 * GH-Pages) carries no eruda chunk at all — a debug console in the
 * deployed artifact is an attack surface, not a convenience. Inside an
 * enabled build it stays opt-in via ``?debug=1`` (same self-gating
 * pattern as the ``?e2e-hooks=1`` concurrency probe in main.tsx).
 *
 * The gate in {@link loadDebugConsole} is written INLINE on
 * ``import.meta.env`` so the bundler statically folds it in a shipped
 * build and dead-code-eliminates ``import("eruda")`` — no ``eruda-*.js``
 * chunk is emitted. Do not extract that condition into a helper call;
 * a function boundary defeats the constant folding.
 */

/** The slice of ``import.meta.env`` the console gate reads. */
export interface DebugConsoleEnv {
    DEV: boolean;
    VITE_DEBUG_CONSOLE?: string;
}

/**
 * True when this build carries the debug console at all: local dev, or
 * a LAN-debug build made with ``VITE_DEBUG_CONSOLE=1``. Shipped builds
 * return false.
 *
 * @param env - injectable for tests; defaults to the real build env.
 */
export function debugConsoleEnabled(
    env: DebugConsoleEnv = import.meta.env,
): boolean {
    return env.DEV || env.VITE_DEBUG_CONSOLE === "1";
}

/**
 * True when the console should mount for this visit: the build carries
 * it AND the visitor opted in via ``?debug=1``.
 *
 * @param search - ``window.location.search``.
 * @param env - injectable for tests; defaults to the real build env.
 */
export function shouldLoadDebugConsole(
    search: string,
    env: DebugConsoleEnv = import.meta.env,
): boolean {
    return debugConsoleEnabled(env) && new URLSearchParams(search).has("debug");
}

/** Loads and mounts eruda. Call only behind {@link shouldLoadDebugConsole}. */
export async function loadDebugConsole(): Promise<void> {
    if (import.meta.env.DEV || import.meta.env.VITE_DEBUG_CONSOLE === "1") {
        const {default: eruda} = await import("eruda");
        eruda.init();
    }
}
