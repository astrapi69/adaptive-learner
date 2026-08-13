/**
 * #2575 — on-device debug console (eruda) for LAN device debugging
 * (see ``make dev-lan-dexie`` + docs/developer/testing.md "LAN device
 * debugging"). A Linux dev machine has no Safari Web Inspector, so an
 * on-page console is the only way to read errors from an iPhone.
 *
 * Strictly opt-in via ``?debug=1`` (same self-gating pattern as the
 * ``?e2e-hooks=1`` concurrency probe in main.tsx): a normal visit never
 * carries the flag, so eruda's chunk is never fetched. eruda ships as a
 * real ``dependencies`` entry (not dev-only like @axe-core/react) because
 * it must be reachable on the deployed GH-Pages build, not just local dev.
 */
export function shouldLoadDebugConsole(search: string): boolean {
    return new URLSearchParams(search).has("debug");
}

/** Loads and mounts eruda. Call only behind {@link shouldLoadDebugConsole}. */
export async function loadDebugConsole(): Promise<void> {
    const {default: eruda} = await import("eruda");
    eruda.init();
}
