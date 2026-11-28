/**
 * Touch-device visual baselines (#3783).
 *
 * The other two suites render on one desktop Chrome and reach their
 * "mobile" sizes with ``page.setViewportSize``: a narrow desktop, with a
 * Windows user agent, a fine pointer and no touch. Whatever the app renders
 * differently on a phone was in no image.
 *
 * This suite runs in the two touch projects of ``playwright.visual.config.ts``
 * (an Android phone and an iPhone profile) and takes the few surfaces whose
 * rendering depends on the device:
 *
 *   - the dashboard with the install surface of the platform: the Chromium
 *     install banner on Android (``beforeinstallprompt``), the "add to home
 *     screen" card on iOS (user agent);
 *   - Settings > Learning, where the gesture switch defaults to on with touch
 *     and every form field takes the 16 px floor of a coarse pointer;
 *   - Settings > General, which holds the install section.
 *
 * Each test first asserts the device-dependent element it is about, so an
 * image never claims a state the page was not in (#2696: a green compare
 * proves agreement, not content).
 *
 * What stays with the manual device check, because no emulation shows it: a
 * real install, the safe area of real hardware, the standalone window.
 *
 * Baselines: ``{surface}-{project}.png`` beside the others. A touch project
 * renders at a device scale factor of 1 (see the config), so the images are
 * the size of the CSS viewport, not three times it.
 */

import {expect, test, type Page} from "@playwright/test";

import {
    type SurfaceName,
    assertNoExternalRequests,
    assertSurfaceStillReady,
    expandViewportToDocument,
    freezeClock,
    gotoSurface,
    pinContentRegistry,
    pinRandomStreams,
    setTheme,
    settleForScreenshot,
    skipUnlessBaselined,
    surfaceMasks,
} from "./helpers";

/** The touch projects of the visual config, by name. */
type TouchProject = "touch-android" | "touch-ios";

interface TouchShot {
    surface: SurfaceName;
    /** Bring the page into the device state the image is about, and assert
     *  it. Receives the project so one surface can differ per platform. */
    deviceState: (page: Page, project: TouchProject) => Promise<void>;
}

/**
 * Fire the event Chromium sends when the app can be installed. A test
 * browser never sends it by itself (no installability check runs), so the
 * banner that hangs on it would be in no image. The app keeps the event and
 * calls ``prompt()`` only on a click, which no test here does.
 */
async function offerInstall(page: Page): Promise<void> {
    await page.evaluate(() => {
        const offer = Object.assign(new Event("beforeinstallprompt", {cancelable: true}), {
            prompt: () => Promise.resolve(),
            userChoice: Promise.resolve({outcome: "dismissed", platform: "web"}),
        });
        window.dispatchEvent(offer);
    });
}

async function touchIsOn(page: Page): Promise<void> {
    // The premise of every image in this file. A project that lost its
    // device profile would otherwise render a second set of desktop images.
    const state = await page.evaluate(() => ({
        touchPoints: navigator.maxTouchPoints,
        coarse: window.matchMedia("(pointer: coarse)").matches,
    }));
    expect(state.touchPoints, "the project emulates touch").toBeGreaterThan(0);
    expect(state.coarse, "the project emulates a coarse pointer").toBe(true);
}

const SHOTS: readonly TouchShot[] = [
    {
        surface: "dashboard-populated",
        deviceState: async (page, project) => {
            if (project === "touch-android") {
                await offerInstall(page);
                await expect(page.getByTestId("install-prompt")).toBeVisible();
                await expect(page.getByTestId("ios-install-hint")).toHaveCount(0);
            } else {
                await expect(page.getByTestId("ios-install-hint")).toBeVisible();
                await expect(page.getByTestId("install-prompt")).toHaveCount(0);
            }
        },
    },
    {
        surface: "settings-learning",
        deviceState: async (page) => {
            // gesturePref: on by default where the device has touch.
            await expect(page.getByTestId("settings-gestures-toggle")).toBeChecked();
        },
    },
    {
        surface: "settings-general",
        deviceState: async (page, project) => {
            if (project === "touch-android") await offerInstall(page);
        },
    },
];

for (const shot of SHOTS) {
    test(`${shot.surface} renders correctly on a touch device`, async ({page}, testInfo) => {
        const project = testInfo.project.name as TouchProject;
        const name = `${shot.surface}-${project}.png`;

        await freezeClock(page);
        await pinRandomStreams(page);
        await setTheme(page, "light");
        await pinContentRegistry(page);
        const ready = await gotoSurface(page, shot.surface);
        skipUnlessBaselined(ready, name, shot.surface);
        await touchIsOn(page);
        await shot.deviceState(page, project);
        await settleForScreenshot(page);

        const coveredHeight = await expandViewportToDocument(page);
        testInfo.annotations.push({
            type: "covered-height",
            description: `${shot.surface}-${project}: ${coveredHeight}px`,
        });
        const masks = surfaceMasks(page, shot.surface);
        for (const target of masks) {
            await expect(target).toHaveCount(1);
        }
        await assertSurfaceStillReady(page, shot.surface);
        const stopped = assertNoExternalRequests(page);
        testInfo.annotations.push({
            type: "external-requests-stopped",
            description: `${shot.surface}-${project}: ${stopped}`,
        });
        await expect(page).toHaveScreenshot(name, {mask: masks});
        assertNoExternalRequests(page);
    });
}
