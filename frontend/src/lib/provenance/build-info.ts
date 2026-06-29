/**
 * Build-info / deployment-strand provenance (#1172).
 *
 * Single source for "which strand is this running instance on?". Reads the
 * Vite-injected build literals (``__BUILD_BRANCH__`` / ``__BUILD_STRANG__``,
 * see frontend/vite.config.ts ``define``) and derives the strand:
 *
 *   - **Haupt** (production): ``main`` -> astrapi69.github.io/adaptive-learner/
 *   - **Latest** (preview/staging): develop/feature/fix ->
 *     astrapi69.github.io/adaptive-learner-content-test/
 *
 * The strand is determined robustly, preferring the explicit deploy-set
 * variable and falling back step by step so a missing build literal is
 * handled as "unknown" rather than guessed:
 *
 *   1. explicit ``__BUILD_STRANG__`` ("haupt" / "latest") — the deploy
 *      workflow sets this; authoritative, ``derivedFromFallback = false``.
 *   2. branch fallback: ``main`` -> Haupt, any other known branch -> Latest.
 *   3. URL fallback: the content-test host -> Latest, the production host ->
 *      Haupt (clearly marked as a heuristic via ``derivedFromFallback``).
 *   4. otherwise "unknown".
 *
 * Pure + app-agnostic: ``resolveStrang`` takes its inputs as a plain object
 * so it is unit-testable without the Vite globals or a DOM. Modus-agnostic:
 * the literals are build-time, identical in API and Dexie builds.
 */

/** The deployment strand a running instance belongs to. */
export type Strang = "haupt" | "latest" | "unknown";

export interface BuildInfo {
    /** App version (canonical: package.json). */
    version: string;
    /** Short commit hash of the built commit, or "unknown". */
    hash: string;
    /** ISO build timestamp, or "unknown". */
    date: string;
    /** Branch that was built, or "unknown". */
    branch: string;
    /** Derived deployment strand. */
    strang: Strang;
    /**
     * True when the strand could NOT be read from the explicit deploy
     * variable and was instead inferred from the branch or the URL. The
     * UI surfaces this so an inferred strand is never shown as authoritative.
     */
    derivedFromFallback: boolean;
}

/** Inputs to {@link resolveStrang}. All optional so callers can omit a layer. */
export interface StrangInputs {
    /** Explicit strand literal from the deploy workflow (``__BUILD_STRANG__``). */
    buildStrang?: string;
    /** Built branch (``__BUILD_BRANCH__``). */
    branch?: string;
    /** Current location href, used only as the last-resort heuristic. */
    href?: string;
}

/** Read a sentinel-or-value literal, normalising the empty/unknown cases. */
function clean(value: string | undefined): string {
    const trimmed = (value ?? "").trim();
    if (!trimmed || trimmed.toLowerCase() === "unknown") return "unknown";
    return trimmed;
}

/**
 * Derive the deployment strand from the available signals, preferring the
 * explicit deploy variable over the branch over the URL.
 */
export function resolveStrang(inputs: StrangInputs): {
    strang: Strang;
    derivedFromFallback: boolean;
} {
    const explicit = clean(inputs.buildStrang).toLowerCase();
    if (explicit === "haupt" || explicit === "main" || explicit === "production") {
        return {strang: "haupt", derivedFromFallback: false};
    }
    if (explicit === "latest" || explicit === "preview" || explicit === "staging") {
        return {strang: "latest", derivedFromFallback: false};
    }

    // Fallback 1: derive from the built branch. ``main`` is the only
    // production branch; any other KNOWN branch is a Latest/preview build.
    const branch = clean(inputs.branch).toLowerCase();
    if (branch !== "unknown") {
        return {
            strang: branch === "main" ? "haupt" : "latest",
            derivedFromFallback: true,
        };
    }

    // Fallback 2: derive from the URL (clearly a heuristic).
    const href = (inputs.href ?? "").toLowerCase();
    if (href.includes("adaptive-learner-content-test")) {
        return {strang: "latest", derivedFromFallback: true};
    }
    if (href.includes("/adaptive-learner/")) {
        return {strang: "haupt", derivedFromFallback: true};
    }

    return {strang: "unknown", derivedFromFallback: true};
}

/** Read the build literal, tolerating the vitest/no-define environment. */
function literal(value: unknown): string {
    return typeof value === "string" && value ? value : "unknown";
}

/**
 * Assemble the {@link BuildInfo} for the running instance from the Vite
 * literals + (last-resort) the current URL. Call with no args in the app;
 * the optional override exists for tests.
 */
export function getBuildInfo(href?: string): BuildInfo {
    const version = literal(
        typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : undefined,
    );
    const hash = literal(
        typeof __BUILD_HASH__ === "string" ? __BUILD_HASH__ : undefined,
    );
    const date = literal(
        typeof __BUILD_DATE__ === "string" ? __BUILD_DATE__ : undefined,
    );
    const branch = literal(
        typeof __BUILD_BRANCH__ === "string" ? __BUILD_BRANCH__ : undefined,
    );
    const buildStrang = literal(
        typeof __BUILD_STRANG__ === "string" ? __BUILD_STRANG__ : undefined,
    );
    const resolvedHref =
        href ?? (typeof window !== "undefined" ? window.location.href : "");
    const {strang, derivedFromFallback} = resolveStrang({
        buildStrang,
        branch,
        href: resolvedHref,
    });
    return {version, hash, date, branch, strang, derivedFromFallback};
}
