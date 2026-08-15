/**
 * #2575 — on-device debug console (eruda) for LAN device debugging
 * (see ``make dev-lan-dexie`` + docs/developer/testing.md "LAN device
 * debugging"). A Linux dev machine has no Safari Web Inspector, so an
 * on-page console is the only way to read errors from an iPhone.
 *
 * #2610 — the console is DEV-ONLY: a debug inspector must never ship in
 * the production image or the public GH-Pages build (attack surface). It
 * is compiled in ONLY for the dev server (``import.meta.env.DEV``) and for
 * the LAN-debug build, which sets ``VITE_DEBUG_CONSOLE=1`` (``make dev-lan``
 * / ``make dev-lan-dexie``). In the shipped build both flags are statically
 * false, so Rollup dead-code-eliminates the ``import("eruda")`` below and no
 * ``eruda-*.js`` chunk is emitted at all — the ``?debug=1`` opt-in then has
 * nothing to load.
 */
export const debugConsoleAvailable: boolean =
    import.meta.env.DEV || import.meta.env.VITE_DEBUG_CONSOLE === "1";

/**
 * True only when the debug console is compiled in AND the caller opted in
 * via ``?debug=1`` (same self-gating pattern as the ``?e2e-hooks=1``
 * concurrency probe in main.tsx).
 */
export function shouldLoadDebugConsole(search: string): boolean {
    return debugConsoleAvailable && new URLSearchParams(search).has("debug");
}

/**
 * Loads and mounts eruda. A no-op in builds where the console is not
 * compiled in; call behind {@link shouldLoadDebugConsole}. The early return
 * on the statically-false flag is what lets Rollup drop the eruda chunk from
 * the shipped bundle.
 */
export async function loadDebugConsole(): Promise<void> {
    if (!debugConsoleAvailable) return;
    const {default: eruda} = await import("eruda");
    eruda.init();
}
