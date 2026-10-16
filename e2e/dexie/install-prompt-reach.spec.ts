/**
 * #3782 - the install banner never covers a control.
 *
 * ``InstallPrompt`` is the Chromium sibling of the iOS hint that #3765 took
 * out of its fixed position: ``.install-prompt`` sat ``position: fixed`` at
 * the bottom of every page (z-index 100, from 769 px a card bottom right),
 * shown as soon as the browser fires ``beforeinstallprompt``. No visual
 * baseline renders it (no such event in the visual suite), so whether it
 * covers anything had never been measured.
 *
 * The seven surfaces of ``e2e/webkit/install-hint-reach.spec.ts`` are probed
 * in two profiles, a ``Pixel 7`` phone and a 1440 x 900 desktop, with the
 * banner shown and not dismissed. The banner is shown by a synthetic
 * ``beforeinstallprompt`` dispatched after the app mounted (the listener
 * hangs in a ``useEffect``), and asserted visible before anything is
 * measured: a green measurement without a visible banner says nothing.
 *
 * The probe is Playwright's trial action (``tap`` on the phone, ``click`` on
 * the desktop): it scrolls the control into view in the app's inner scroll
 * container and fails when another element would receive the input
 * ("... intercepts pointer events"). It checks that the input arrives, not
 * that a rectangle looks free.
 *
 * Before the fix (24d41ef55) the banner was asserted visible on every
 * surface; the fix (#3782) moved it onto the dashboard, where it is still
 * asserted visible, and every other surface asserts it absent.
 *
 * Setup runs with the banner dismissed (should Chromium fire a real
 * ``beforeinstallprompt``), then the dismissal is cleared, the page
 * reloaded and the event dispatched, so each page measures its own controls.
 */

import {devices, expect, test, type Locator, type Page} from "@playwright/test";

import {SET_ID, connectMockRepo, mockRepo} from "../helpers/control-lesson";
import {
    completeAssessment,
    completeOnboarding,
    settleMigrationWelcome,
} from "../helpers/onboarding";

const DISMISSED_KEY = "adaptive-learner.install_dismissed";
// defaultBrowserType cannot be set per describe; the project runs Chromium.
const {defaultBrowserType: _chromium, ...PIXEL_7} = devices["Pixel 7"];

const PROFILES = [
    {name: "Pixel 7", use: PIXEL_7, phone: true},
    {name: "Desktop 1440x900", use: {viewport: {width: 1440, height: 900}}, phone: false},
] as const;

/**
 * Offer the install: a synthetic ``beforeinstallprompt`` after mount. Since
 * the fix the banner is a card on the dashboard only, so it is asserted
 * visible there and absent everywhere else (it cannot cover those pages).
 */
async function showBanner(page: Page, onThisPage = false): Promise<void> {
    await page.evaluate(() => {
        const event = new Event("beforeinstallprompt", {cancelable: true});
        Object.assign(event, {
            prompt: async () => {},
            userChoice: Promise.resolve({outcome: "dismissed"}),
        });
        window.dispatchEvent(event);
    });
    const banner = page.getByTestId("install-prompt");
    if (onThisPage) await expect(banner, "the banner is shown").toBeVisible();
    else await expect(banner, "the banner lives on the dashboard only").toHaveCount(0);
    expect(await page.evaluate((key) => localStorage.getItem(key), DISMISSED_KEY)).toBeNull();
}

/** Set up with the banner dismissed, then show it again for the probe. */
async function dismissBannerForSetup(page: Page): Promise<void> {
    await page.addInitScript((key) => {
        if (!sessionStorage.getItem("probe-phase")) localStorage.setItem(key, String(Date.now()));
    }, DISMISSED_KEY);
}

async function reloadWithBanner(page: Page, ready: Locator, onThisPage = false): Promise<void> {
    await page.evaluate((key) => {
        sessionStorage.setItem("probe-phase", "1");
        localStorage.removeItem(key);
    }, DISMISSED_KEY);
    await page.reload();
    await expect(ready).toBeAttached({timeout: 30_000});
    await showBanner(page, onThisPage);
}

for (const profile of PROFILES) {
    test.describe(`#3782 install banner, ${profile.name}`, () => {
        test.use({...profile.use, serviceWorkers: "block"});
        test.describe.configure({timeout: 180_000});

        /** Whether the input reaches ``control`` (trial action: scroll + hit test). */
        async function expectReachable(control: Locator, label: string): Promise<void> {
            let error = "";
            try {
                if (profile.phone) await control.tap({trial: true, timeout: 5_000});
                else await control.click({trial: true, timeout: 5_000});
            } catch (caught) {
                const lines = String(caught).split("\n");
                error = lines.find((line) => line.includes("intercepts")) ?? lines[0];
            }
            expect.soft(error, `${profile.name}: ${label} must receive the input`).toBe("");
        }

        test("start page: start button and legal links", async ({page}) => {
            await page.goto("/");
            await expect(page.getByTestId("landing")).toBeVisible({timeout: 20_000});
            await showBanner(page);
            await expectReachable(page.getByTestId("landing-start"), "Lernreise beginnen");
            await expectReachable(page.getByTestId("landing-imprint-link"), "Impressum");
            await expectReachable(page.getByTestId("landing-privacy-link"), "Datenschutzerklärung");
        });

        test("onboarding: create the project, then both invitation choices", async ({page}) => {
            await page.goto("/onboarding");
            await settleMigrationWelcome(page);
            await showBanner(page);
            await page.getByTestId("onboarding-name").fill("Tester");
            await page.getByTestId("onboarding-topic").fill("Spanisch");
            await expectReachable(page.getByTestId("onboarding-submit"), "Projekt anlegen");
            await page.getByTestId("onboarding-submit").dispatchEvent("click");
            await expect(page.getByTestId("onboarding-invite")).toBeVisible({timeout: 15_000});
            await expect(page.getByTestId("install-prompt")).toHaveCount(0);
            await expectReachable(page.getByTestId("onboarding-invite-setup-profile"), "Profil einrichten");
            await expectReachable(page.getByTestId("onboarding-invite-start-now"), "Direkt loslegen");
        });

        test("assessment: next question and continue later", async ({page}) => {
            await dismissBannerForSetup(page);
            await completeOnboarding(page);
            await reloadWithBanner(page, page.getByTestId("question-q01-answer-a"));
            await page.getByTestId("question-q01-answer-a").dispatchEvent("click");
            await expectReachable(page.getByTestId("assessment-next"), "Nächste Frage");
            await expectReachable(page.getByTestId("assessment-exit"), "Später fortsetzen");
        });

        test("dashboard: learning path and create lesson", async ({page}) => {
            await dismissBannerForSetup(page);
            await completeOnboarding(page);
            await completeAssessment(page);
            await reloadWithBanner(page, page.getByTestId("dashboard"), true);
            await expectReachable(page.getByTestId("dashboard-learning-path"), "Lernpfad");
            await expectReachable(page.getByTestId("dashboard-create-lesson"), "Lektion erstellen");
        });

        test("content: the controls of the last set row", async ({page}) => {
            await dismissBannerForSetup(page);
            await completeOnboarding(page);
            await completeAssessment(page);
            // A set without network: the mocked control repo. Connecting
            // installs it, so its download button is disabled; the row's
            // other controls sit at the same place.
            await mockRepo(page);
            await connectMockRepo(page);
            await page.goto("/content?tab=my");
            await reloadWithBanner(page, page.getByTestId(`content-set-${SET_ID}-open`));
            await expectReachable(page.getByTestId(`content-set-${SET_ID}-open`), "Öffnen (letzte Set-Zeile)");
            await expectReachable(page.getByTestId(`set-actions-${SET_ID}`), "Aktionen (letzte Set-Zeile)");
        });

        test("settings, learning: reset progress", async ({page}) => {
            await dismissBannerForSetup(page);
            await completeOnboarding(page);
            await completeAssessment(page);
            await page.goto("/settings?tab=learning");
            await reloadWithBanner(page, page.getByTestId("settings-reset-progress-button"));
            await expectReachable(page.getByTestId("settings-reset-progress-button"), "Fortschritt zurücksetzen");
        });
    });
}
