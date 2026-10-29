/**
 * Waiting for the landing page (#3544).
 *
 * On "/" the app first checks for a returning user and shows "Welcome back…"
 * until that check settles; the landing UI appears at the latest when
 * ``RECOVERY_TIMEOUT_MS`` in ``frontend/src/pages/onboarding/Landing.tsx``
 * fires. The smoke specs used Playwright's default 5 s, shorter than the
 * app's own guarantee. Against the Vite dev server that is not enough on a
 * cold first load: measured on 2026-10-09, the dev server holds every request
 * (proxied ``/api`` calls and static files alike) for about 1.2 s while it
 * transforms the module graph, longer under load, and one run failed with
 * the page still on "Welcome back…" after 5 s.
 *
 * The wait is derived from the app's constant, read from the source (the
 * module cannot be imported here: it pulls React and ``import.meta``), plus
 * a margin for rendering. A renamed constant fails loudly instead of falling
 * back to a guess.
 */

import {readFileSync} from "node:fs";
import {join} from "node:path";

import {expect, type Page} from "@playwright/test";

const LANDING_SOURCE = join(__dirname, "../../frontend/src/pages/onboarding/Landing.tsx");

/** Rendering margin on top of the app's fallback. */
const RENDER_MARGIN_MS = 4000;

function recoveryTimeoutMs(): number {
    const source = readFileSync(LANDING_SOURCE, "utf8");
    const match = /const RECOVERY_TIMEOUT_MS = ([\d_]+);/.exec(source);
    if (!match) {
        throw new Error(`RECOVERY_TIMEOUT_MS not found in ${LANDING_SOURCE}; update e2e/helpers/landing.ts`);
    }
    return Number(match[1].replaceAll("_", ""));
}

/** How long a spec waits for the landing UI: the app's fallback plus a margin. */
export const LANDING_WAIT_MS = recoveryTimeoutMs() + RENDER_MARGIN_MS;

/** Wait for the landing UI as long as the app may legitimately take. */
export async function expectLandingVisible(page: Page): Promise<void> {
    await expect(page.getByTestId("landing")).toBeVisible({timeout: LANDING_WAIT_MS});
}
