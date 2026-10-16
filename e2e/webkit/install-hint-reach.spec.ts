/**
 * #3765 - the iOS install hint never covers a control.
 *
 * The hint sat ``fixed`` at the bottom of every page. Whatever ended up at
 * the bottom could not be tapped, not even after scrolling to the end,
 * until the hint was dismissed: on the assessment a new iPhone user did
 * not get past the first question. #3757 only took it off the lesson
 * routes.
 *
 * Every control from the issue's table is probed under the ``iPhone SE``
 * profile with the hint NOT dismissed. The probe is Playwright's trial tap:
 * it scrolls the control into view (in the app's inner scroll container,
 * not ``window``) and fails when another element would receive the tap
 * ("... intercepts pointer events"). It checks that the tap arrives, not
 * that a rectangle looks free.
 *
 * Reaching the dashboard, content and settings runs through the assessment,
 * which the hint blocked before the fix; the setup therefore runs with the
 * hint dismissed and then shows it again (flag cleared, page reloaded), so
 * each page measures its own controls.
 */

import {devices, expect, test, type Locator, type Page} from "@playwright/test";

import {SET_ID, connectMockRepo, mockRepo} from "../helpers/control-lesson";
import {
    completeAssessment,
    completeOnboarding,
    settleMigrationWelcome,
} from "../helpers/onboarding";

const DISMISSED_KEY = "adaptive-learner.ios_install_dismissed";
// defaultBrowserType cannot be set per file; the project already runs WebKit.
const {defaultBrowserType: _webkit, ...IPHONE_SE} = devices["iPhone SE"];

test.use({...IPHONE_SE, serviceWorkers: "block"});
test.describe.configure({timeout: 180_000});

/** Whether a tap on ``control`` reaches it (trial tap: scroll + hit test). */
async function expectTappable(control: Locator, label: string): Promise<void> {
    let error = "";
    try {
        await control.tap({trial: true, timeout: 5_000});
    } catch (caught) {
        error = String(caught).split("\n").find((line) => line.includes("intercepts")) ?? String(caught).split("\n")[0];
    }
    expect.soft(error, `${label} must receive the tap`).toBe("");
}

/** The hint is not dismissed: it would be shown wherever it is mounted. */
async function expectHintNotDismissed(page: Page): Promise<void> {
    expect(await page.evaluate((key) => localStorage.getItem(key), DISMISSED_KEY)).toBeNull();
}

/** Set up with the hint dismissed, then show it again for the probe. */
async function dismissHintForSetup(page: Page): Promise<void> {
    await page.addInitScript((key) => {
        if (!sessionStorage.getItem("probe-phase")) localStorage.setItem(key, "1");
    }, DISMISSED_KEY);
}

async function showHintAgain(page: Page): Promise<void> {
    await page.evaluate((key) => {
        sessionStorage.setItem("probe-phase", "1");
        localStorage.removeItem(key);
    }, DISMISSED_KEY);
    await page.reload();
    await expectHintNotDismissed(page);
}

test("start page: start button and legal links", async ({page}) => {
    await page.goto("/");
    await expect(page.getByTestId("landing")).toBeVisible({timeout: 20_000});
    await expectHintNotDismissed(page);
    await expectTappable(page.getByTestId("landing-start"), "Lernreise beginnen");
    await expectTappable(page.getByTestId("landing-imprint-link"), "Impressum");
    await expectTappable(page.getByTestId("landing-privacy-link"), "Datenschutzerklärung");
});

test("onboarding: create the project, then both invitation choices", async ({page}) => {
    await page.goto("/onboarding");
    await settleMigrationWelcome(page);
    await expectHintNotDismissed(page);
    await page.getByTestId("onboarding-name").fill("Tester");
    await page.getByTestId("onboarding-topic").fill("Spanisch");
    await expectTappable(page.getByTestId("onboarding-submit"), "Projekt anlegen und Assessment starten");
    await page.getByTestId("onboarding-submit").dispatchEvent("click");
    await expect(page.getByTestId("onboarding-invite")).toBeVisible({timeout: 15_000});
    await expectTappable(page.getByTestId("onboarding-invite-setup-profile"), "Profil einrichten");
    await expectTappable(page.getByTestId("onboarding-invite-start-now"), "Direkt loslegen");
});

test("assessment: next question and continue later", async ({page}) => {
    await dismissHintForSetup(page);
    await completeOnboarding(page);
    await showHintAgain(page);
    await expect(page.getByTestId("question-q01-answer-a")).toBeVisible({timeout: 15_000});
    await page.getByTestId("question-q01-answer-a").dispatchEvent("click");
    await expectTappable(page.getByTestId("assessment-next"), "Nächste Frage");
    await expectTappable(page.getByTestId("assessment-exit"), "Später fortsetzen");
});

test("dashboard: learning path and create lesson, with the hint on screen", async ({page}) => {
    await dismissHintForSetup(page);
    await completeOnboarding(page);
    await completeAssessment(page);
    await showHintAgain(page);
    await expect(page.getByTestId("dashboard")).toBeVisible({timeout: 15_000});
    await expect(page.getByTestId("ios-install-hint")).toBeVisible();
    await expectTappable(page.getByTestId("dashboard-learning-path"), "Lernpfad");
    await expectTappable(page.getByTestId("dashboard-create-lesson"), "Lektion erstellen");
});

test("content: the controls of the last set row", async ({page}) => {
    await dismissHintForSetup(page);
    await completeOnboarding(page);
    await completeAssessment(page);
    // A set to download without network: the mocked control repo.
    await mockRepo(page);
    await connectMockRepo(page);
    await page.goto("/content?tab=my");
    await showHintAgain(page);
    // Connecting installs the set, so its download button is disabled; the
    // row's other controls sit at the same place at the bottom of the list.
    await expect(page.getByTestId(`content-set-${SET_ID}-open`)).toBeAttached({timeout: 30_000});
    await expectTappable(page.getByTestId(`content-set-${SET_ID}-open`), "Öffnen (letzte Set-Zeile)");
    await expectTappable(page.getByTestId(`set-actions-${SET_ID}`), "Aktionen (letzte Set-Zeile)");
});

test("settings, learning: reset progress", async ({page}) => {
    await dismissHintForSetup(page);
    await completeOnboarding(page);
    await completeAssessment(page);
    await page.goto("/settings?tab=learning");
    await showHintAgain(page);
    const reset = page.getByTestId("settings-reset-progress-button");
    await expect(reset).toBeAttached({timeout: 15_000});
    await expectTappable(reset, "Fortschritt zurücksetzen");
});
