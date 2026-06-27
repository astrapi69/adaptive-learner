/**
 * Dexie-mode release gate (DEXIE-MODE-RELEASE-GATE-01).
 *
 * Walks every nav-reachable route against the GH-Pages-shape
 * build (``VITE_STORAGE_MODE=dexie`` + ``vite preview``, NO
 * backend process). For each route we assert:
 *
 *   1. No uncaught JavaScript errors fire (``pageerror``).
 *   2. No error toast appears (``.Toastify__toast--error``).
 *   3. The page renders — either its expected ``data-testid``
 *      or a known graceful redirect target (Dashboard /
 *      Session redirect to Onboarding when the learner state
 *      is empty; that's the right thing for a first-paint
 *      Dexie-mode visitor).
 *
 * The third assertion is deliberately permissive. The hard
 * regression-pin is the FIRST two: any feature that puts an
 * error toast in front of a first-time GH-Pages visitor would
 * fail this gate.
 *
 * Filed 2026-05-26 after Phase 42 / Learning Repository
 * shipped raw HTTP-404 toasts on every Settings / Dashboard /
 * Learning-Repo view because the components called
 * ``api.pluginSettings.*`` / ``api.learningRepo.*`` directly
 * instead of routing through the storage abstraction.
 */

import {expect, test} from "@playwright/test";
import type {ConsoleMessage, Page} from "@playwright/test";

interface RouteCase {
    /** Display name for the test title. */
    name: string;
    /** Path to ``page.goto``. */
    path: string;
    /**
     * Acceptable testids for the rendered page. The smoke
     * passes when AT LEAST ONE of these is visible — a route
     * that redirects to Onboarding (Dashboard / Session with
     * no learner state) lists both its own primary testid AND
     * ``onboarding`` here.
     */
    expectedTestIds: string[];
}

const ROUTES: RouteCase[] = [
    {name: "Landing", path: "/", expectedTestIds: ["landing"]},
    {
        name: "Onboarding",
        path: "/onboarding",
        expectedTestIds: ["onboarding"],
    },
    {
        name: "Assessment (redirects to Onboarding without projectId)",
        path: "/assessment",
        expectedTestIds: [
            "assessment",
            "assessment-loading",
            "assessment-empty",
            "onboarding",
        ],
    },
    {
        name: "Dashboard (redirects to Onboarding with empty state)",
        path: "/dashboard",
        expectedTestIds: ["dashboard", "dashboard-loading", "onboarding"],
    },
    {
        // #1158 — in Dexie mode without an AI key the tutor chat is gated:
        // /session renders the no-key empty state (``session-no-key``, with a
        // link to the AI settings tab) instead of creating a dead session.
        // With a key / projectId it shows ``session``; with neither it can
        // still fall through to ``onboarding``.
        name: "Session (no-key empty state / Onboarding)",
        path: "/session",
        expectedTestIds: ["session-no-key", "session", "onboarding"],
    },
    {
        // EXP-037 (#850): /curriculum now redirects to /progress?tab=paths,
        // which mounts ProgressHub (synchronous tab bar) + the Curriculum tab.
        name: "Curriculum (redirects to Progress > Meine Pfade tab)",
        path: "/curriculum",
        expectedTestIds: [
            "progress-hub",
            "curriculum",
            "curriculum-loading",
            "curriculum-error",
            "onboarding",
        ],
    },
    {
        // EXP-037 (#850): /statistics redirects to /progress?tab=stats.
        name: "Statistics (redirects to Progress > Statistik tab)",
        path: "/statistics",
        expectedTestIds: [
            "progress-hub",
            "statistics",
            "statistics-loading",
            "onboarding",
        ],
    },
    {
        name: "Progress (hub, Übersicht tab)",
        path: "/progress",
        expectedTestIds: ["progress-hub", "progress", "onboarding"],
    },
    {
        // #856: /import redirects to /content?tab=import, which mounts the
        // ContentHub (synchronous tab bar) + the Import tab.
        name: "Import (redirects to Content > Import tab)",
        path: "/import",
        expectedTestIds: ["content-hub", "page-import"],
    },
    {
        name: "Create Lesson (Phase 65 / EXP-021)",
        path: "/create-lesson",
        expectedTestIds: ["create-lesson-page"],
    },
    {
        name: "Learning Path (Phase 66 / EXP-022)",
        path: "/learning-path",
        expectedTestIds: ["learning-path-page"],
    },
    {
        name: "Anki (redirects to Onboarding without userId)",
        path: "/anki",
        expectedTestIds: ["anki-page", "onboarding"],
    },
    {
        name: "Pronunciation (redirects to Onboarding without project)",
        path: "/pronunciation",
        expectedTestIds: [
            "pronunciation-page",
            "pronunciation-ineligible",
            "onboarding",
        ],
    },
    {
        name: "Settings",
        path: "/settings",
        expectedTestIds: ["settings", "onboarding"],
    },
    {
        name: "Learning Repository (Phase 49G — works in Dexie mode)",
        path: "/projects/smoke-fixture-project/learning-repo",
        // Phase 49G (v1.32.0): the page now renders in Dexie
        // mode via the TS renderer (49B-D + 49E). For this
        // smoke fixture the project doesn't exist in the
        // empty IndexedDB, so the page navigates silently
        // to /dashboard (the 404 path was de-toasted). Either
        // "learning-repo-page-loading" (briefly) or
        // "dashboard" / "onboarding" (after redirect) is the
        // acceptable surface. The hard pin remains "no error
        // toast" (asserted by the wrapping smoke step).
        expectedTestIds: [
            "learning-repo-page-loading",
            "learning-repo-page",
            "dashboard",
            "onboarding",
        ],
    },
    {
        name: "Content (hub, #856 — default Entdecken tab)",
        path: "/content",
        // #856: /content mounts the ContentHub tab bar synchronously
        // (``content-hub``) and defaults to the Entdecken (Discover) tab,
        // which resolves ``discover-loading`` → ``discover-page``. The
        // loader is error-tolerant (per-repo failures resolve to []), so an
        // offline first-visit never crashes or toasts.
        expectedTestIds: ["content-hub", "discover-loading", "discover-page"],
    },
    {
        name: "Content > My content tab (#856)",
        path: "/content?tab=my",
        // The "My content" set browser (Phase 43). ``content-loading`` is
        // the first render; the Dexie fetch then resolves to
        // ``content-page`` (network-reachable upstream OR populated cache)
        // or stays on ``content-empty`` (offline + empty cache). All count
        // as success — the gate pins that the page never crashes or toasts.
        expectedTestIds: [
            "content-hub",
            "content-loading",
            "content-page",
            "content-empty",
        ],
    },
    {
        name: "Discover (redirects to Content > Entdecken tab, #856)",
        path: "/discover",
        // #856: /discover redirects to /content?tab=discover → the
        // ContentHub Entdecken tab (``discover-loading`` → ``discover-page``).
        expectedTestIds: ["content-hub", "discover-loading", "discover-page"],
    },
    {
        name: "Set deep-link (#892, direct URL — GH-Pages fallback)",
        // A direct hit on a set deep-link (the case a shared/QR link
        // produces): GH Pages serves 404.html → index.html and React
        // Router resolves this client-side. A first-visit Dexie user with
        // an empty cache (and offline, no backend) resolves the unknown
        // set to the clean "not found" state — never a crash or a toast.
        path: "/content/set/does-not-exist-892",
        expectedTestIds: [
            "set-deep-link-page",
            "set-deep-link-loading",
            "set-deep-link-not-found",
            "set-deep-link-found",
        ],
    },
    {
        name: "Lesson (viewer, Phase 44, not-cached path)",
        path: "/lesson/astrapi69--adaptive-learner-content/language-fr-a1/01-greetings.json",
        // First-visit GH-Pages users land on the "not cached"
        // shape (no IndexedDB cache yet). Verify the friendly
        // notice renders rather than a 404 crash.
        expectedTestIds: [
            "lesson-loading",
            "lesson-not-cached",
            "lesson-page",
        ],
    },
    {
        name: "Review (Phase 46D SRS session, empty queue path)",
        path: "/review/language-fr-a1",
        // First-visit GH-Pages users have no ElementError
        // rows yet, so the queue is empty. The "all caught up"
        // panel is the right thing to surface. ``review-not-
        // cached`` is the fallback shape when listSets has the
        // set; ``review-loading`` covers the brief async gap.
        expectedTestIds: [
            "review-loading",
            "review-empty",
            "review-not-cached",
        ],
    },
    {
        name: "AdaptiveLesson (Phase 53G adaptive session, empty errors path)",
        path: "/adaptive-lesson/language-fr-a1",
        // First-visit GH-Pages users have no ElementError
        // rows, so the analyzer's active set is empty and the
        // generator can't produce a lesson. The "nothing to
        // adapt yet" empty panel is the right surface. The
        // not-cached fallback covers the case where the set
        // hasn't been downloaded yet, and -loading covers the
        // async fetch gap. ALL three terminal testids are
        // accepted — the race between them is benign.
        expectedTestIds: [
            "adaptive-lesson-loading",
            "adaptive-lesson-empty",
            "adaptive-lesson-not-cached",
        ],
    },
    {
        // Phase 61 C2 — ImportDetail was nav-reachable but unwalked.
        // With no cached conversation it shows its error/empty state
        // (or redirects to the import list) — never an error toast.
        // #856 — canonical detail route is now /content/import/:id.
        name: "ImportDetail (no cached conversation)",
        path: "/content/import/nonexistent-conversation",
        expectedTestIds: [
            "page-import-detail",
            "import-detail-error",
            "page-import",
            "onboarding",
        ],
    },
    {
        name: "NotFound",
        path: "/this-route-does-not-exist",
        expectedTestIds: ["not-found"],
    },
];

/**
 * Install error collectors on the page before navigation.
 * Returns getters the caller invokes after the page has had
 * time to render.
 */
function installCollectors(page: Page) {
    const pageErrors: string[] = [];
    const consoleErrors: ConsoleMessage[] = [];

    page.on("pageerror", (err) => {
        pageErrors.push(`${err.name}: ${err.message}`);
    });
    page.on("console", (msg) => {
        if (msg.type() === "error") {
            consoleErrors.push(msg);
        }
    });

    return {
        pageErrors: () => pageErrors,
        consoleErrors: () =>
            consoleErrors.map((m) => m.text()).filter((text) => {
                // Ignore network errors that are expected in
                // Dexie mode — the SW + a few legacy callers may
                // still try ``/api/...`` once before the user
                // converts to Dexie. The gate cares about
                // user-visible errors, not console noise.
                if (text.includes("Failed to load resource")) return false;
                if (text.includes("net::ERR_")) return false;
                if (text.includes("Workbox")) return false;
                return true;
            }),
    };
}

test.describe("Dexie-mode release gate", () => {
    for (const route of ROUTES) {
        test(`${route.name} renders without error toasts or page errors`, async ({
            page,
        }) => {
            const collectors = installCollectors(page);

            await page.goto(route.path);

            // Wait for either an expected testid or the
            // Toastify error container to appear. The matcher
            // below races them — if an error toast wins the
            // race, we get a clearer failure than a vanilla
            // ``waitForSelector`` timeout.
            const candidates = route.expectedTestIds.map(
                (id) => `[data-testid="${id}"]`,
            );
            await page.waitForSelector(
                [...candidates, ".Toastify__toast--error"].join(", "),
                {timeout: 15_000, state: "visible"},
            );

            // Give async tasks (storage queries, hooks) a tick
            // to finish so any deferred error toast surfaces
            // before we assert.
            await page.waitForTimeout(500);

            // Assertion 1: no error toast at any point during
            // the visit. The Toastify error class is stable
            // (it's the styled toast emitted by ``toast.error``,
            // which now routes through ``notify.error`` and the
            // production-mode friendly mapper).
            const errorToasts = page.locator(".Toastify__toast--error");
            await expect(
                errorToasts,
                `Error toast should never appear on ${route.path} in Dexie mode`,
            ).toHaveCount(0);

            // Assertion 2: at least one of the expected
            // testids is visible.
            const anyExpected = page.locator(
                candidates.join(", "),
            );
            await expect(
                anyExpected.first(),
                `Expected one of [${route.expectedTestIds.join(", ")}] on ${route.path}`,
            ).toBeVisible();

            // Assertion 3: no uncaught JavaScript errors fired
            // during the visit.
            expect(
                collectors.pageErrors(),
                `Uncaught errors on ${route.path}`,
            ).toEqual([]);
        });
    }

    test("no error toast survives a Settings page mount", async ({page}) => {
        // Settings is the page where Phase 42's bug hit hardest
        // (LearningRepoSettingsSection was crashing every visit).
        // Land on Settings, scroll through, and assert no error
        // toast appears at any point.
        const collectors = installCollectors(page);

        await page.goto("/settings");
        // The full Settings layout is long; let render settle
        // for all the lazy-loaded sections.
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(1_000);

        await expect(
            page.locator(".Toastify__toast--error"),
            "Settings page must not emit an error toast in Dexie mode",
        ).toHaveCount(0);

        expect(collectors.pageErrors()).toEqual([]);
    });

    test("the LearningRepo widget is hidden on the Dashboard when no project exists", async ({
        page,
    }) => {
        // Phase 49G (v1.32.0): the widget now renders in BOTH
        // storage modes — Dexie mode no longer hides it.
        // What still gates the widget is the projectId being
        // present in learnerState. The smoke test runs against
        // a fresh build with no seeded learner state, so the
        // assert holds via the project-id gate.
        await page.goto("/dashboard");
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(500);

        await expect(page.getByTestId("learning-repo-widget")).toHaveCount(0);
    });
});
