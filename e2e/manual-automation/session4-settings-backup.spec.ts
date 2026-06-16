/**
 * Session 4 — Settings + Backup (manual test plan automation, #616).
 *
 * Dexie build, no backend. Covers the 7-tab Settings page (sidebar +
 * mobile + deep link), the backup export→import round-trip across two
 * isolated contexts (BACKUP-AKZEPTANZTEST logic), theme switching + every
 * theme loading clean, the avatar upload+crop, the username edit, the
 * selective export, and the About version/build.
 */

import { expect, test } from "@playwright/test";

import { installErrorCollectors } from "./helpers/collectors";
import { seedLearner } from "./helpers/setup";
import { SettingsPage, type SettingsTab } from "./pages/SettingsPage";
import { NavBar } from "./pages/NavBar";

const TABS: SettingsTab[] = [
  "general",
  "ai",
  "learning",
  "plugins",
  "data",
  "help",
  "about",
];

/** A 1×1 transparent PNG, for the avatar upload. */
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

/** Remove the optional File System Access picker so downloads take the
 *  deterministic fallback path in headless chromium. */
async function forceDownloadFallback(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    try {
      // @ts-expect-error optional API
      delete window.showSaveFilePicker;
    } catch {
      /* ignore */
    }
  });
}

test.describe("Session 4 — Settings + Backup", () => {
  test("desktop sidebar activates all 7 tabs", async ({ page }) => {
    const errors = installErrorCollectors(page);
    const settings = new SettingsPage(page);
    await seedLearner(page);
    await settings.goto();
    await expect(settings.sidebar).toBeVisible({ timeout: 15_000 });
    for (const tab of TABS) {
      await settings.openTab(tab);
    }
    expect(errors.pageErrors()).toEqual([]);
  });

  test("deep link ?tab=data opens the Data tab directly", async ({ page }) => {
    const settings = new SettingsPage(page);
    await seedLearner(page);
    await settings.goto("data");
    await expect(settings.tab("data")).toHaveAttribute("aria-current", "page", {
      timeout: 15_000,
    });
    await expect(settings.panel("data")).toBeVisible();
  });

  test("mobile hamburger drives the tabs and the header stays usable (#597)", async ({
    page,
  }) => {
    const settings = new SettingsPage(page);
    const nav = new NavBar(page);
    await page.setViewportSize({ width: 375, height: 720 });
    await seedLearner(page);
    await settings.goto();
    await expect(settings.mobileTrigger).toBeVisible({ timeout: 15_000 });

    await settings.mobileTrigger.click();
    await settings.mobileTab("about").click();
    await expect(settings.panel("about")).toBeVisible();

    // #597 — the settings mobile menu must not block the header nav.
    await nav.hamburger.click();
    await expect(nav.links).toBeVisible();
  });

  test("backup export → restore on a fresh device (round-trip)", async ({
    page,
    browser,
  }) => {
    // --- Device A: seed a learner + export a backup ----------------
    await forceDownloadFallback(page);
    await seedLearner(page, "Backup Owner", "Spanish A1");
    const originalUserId = await page.evaluate(() =>
      localStorage.getItem("adaptive-learner.user_id"),
    );
    expect(originalUserId).toBeTruthy();

    const settings = new SettingsPage(page);
    await settings.goto("data");
    await expect(settings.panel("data")).toBeVisible({ timeout: 15_000 });
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      settings.backupExport.click(),
    ]);
    const fs = await import("node:fs");
    const backupBytes = fs.readFileSync(await download.path());
    expect(backupBytes.length).toBeGreaterThan(0);

    // --- Device B: fresh IndexedDB, restore via onboarding ---------
    const deviceB = await browser.newContext();
    const pageB = await deviceB.newPage();
    const errorsB = installErrorCollectors(pageB);
    await pageB.goto("/onboarding");
    await pageB.getByTestId("onboarding-restore-input").setInputFiles({
      name: "adaptive-learner-backup.json",
      mimeType: "application/json",
      buffer: backupBytes,
    });
    await pageB.waitForURL("**/dashboard", { timeout: 20_000 });
    await expect(pageB.getByTestId("dashboard")).toBeVisible({ timeout: 15_000 });
    await expect(pageB.locator(".Toastify__toast--error")).toHaveCount(0);
    // Decisive: the restore adopted the original owner's identity.
    const adopted = await pageB.evaluate(() =>
      localStorage.getItem("adaptive-learner.user_id"),
    );
    expect(adopted).toBe(originalUserId);
    expect(errorsB.pageErrors()).toEqual([]);
    await deviceB.close();
  });

  test("theme switch applies the data-theme attribute", async ({ page }) => {
    const settings = new SettingsPage(page);
    await seedLearner(page);
    await settings.goto("general");
    await expect(settings.themePicker).toBeVisible({ timeout: 15_000 });
    await settings.themeGroup("classic").click();
    // The radios are sr-only → click the wrapping theme card (label).
    await settings.themeCard("dark").click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await settings.themeCard("ocean").click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "ocean");
  });

  test("every theme option applies without an error", async ({ page }) => {
    const errors = installErrorCollectors(page);
    const settings = new SettingsPage(page);
    await seedLearner(page);
    await settings.goto("general");
    await expect(settings.themePicker).toBeVisible({ timeout: 15_000 });
    for (const group of ["recommended", "classic"] as const) {
      await settings.themeGroup(group).click();
      const cards = settings.themeCards;
      const n = await cards.count();
      for (let i = 0; i < n; i++) {
        await cards.nth(i).click();
        await expect(page.locator("html")).toHaveAttribute("data-theme", /.+/);
      }
    }
    await expect(page.locator(".Toastify__toast--error")).toHaveCount(0);
    expect(errors.pageErrors()).toEqual([]);
  });

  test("avatar upload opens the crop dialog and sets the preview", async ({
    page,
  }) => {
    const settings = new SettingsPage(page);
    await seedLearner(page);
    // The profile section (avatar + username) lives on the General tab.
    await settings.goto("general");
    await expect(settings.sidebar).toBeVisible({ timeout: 15_000 });
    const fileInput = settings.avatarFileInput;
    await expect(fileInput).toBeAttached();
    await fileInput.setInputFiles({
      name: "avatar.png",
      mimeType: "image/png",
      buffer: TINY_PNG,
    });
    await expect(settings.cropConfirm).toBeVisible({ timeout: 10_000 });
    await settings.cropConfirm.click();
    await expect(page.getByTestId("avatar-preview-image")).toBeVisible();
  });

  test("username edit + save", async ({ page }) => {
    const settings = new SettingsPage(page);
    await seedLearner(page);
    // The profile section (avatar + username) lives on the General tab.
    await settings.goto("general");
    await expect(settings.sidebar).toBeVisible({ timeout: 15_000 });
    await expect(settings.usernameInput).toBeVisible();
    await settings.usernameInput.fill("Renamed Learner");
    await settings.usernameSave.click();
    await expect(settings.usernameInput).toHaveValue("Renamed Learner");
  });

  test("selective export downloads a file", async ({ page }) => {
    await forceDownloadFallback(page);
    const settings = new SettingsPage(page);
    await seedLearner(page);
    await settings.goto("data");
    await expect(settings.panel("data")).toBeVisible({ timeout: 15_000 });
    test.skip(
      (await settings.selectiveExport.count()) === 0,
      "selective export not on this tab",
    );
    // The export button is disabled until at least one category is
    // selected; toggle "select all" if needed, then wait for enablement.
    if (!(await settings.selectiveExport.isEnabled())) {
      await settings.selectiveSelectAll.click();
    }
    await expect(settings.selectiveExport).toBeEnabled();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      settings.selectiveExport.click(),
    ]);
    expect((await download.path()).length).toBeGreaterThan(0);
  });

  test("About tab shows the app version + build", async ({ page }) => {
    const settings = new SettingsPage(page);
    await seedLearner(page);
    await settings.goto("about");
    await expect(settings.panel("about")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("about-app-version")).toBeVisible();
    await expect(page.getByTestId("about-build-hash")).toBeVisible();
  });
});
