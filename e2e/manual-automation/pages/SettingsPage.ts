/**
 * SettingsPage — Page Object for the 7-tab Settings page (#616). Real
 * selectors from ``pages/Settings.tsx`` + ``ThemePicker`` + avatar /
 * username / backup / selective-export controls.
 */

import { expect, type Locator, type Page } from "@playwright/test";

export type SettingsTab =
  | "general"
  | "ai"
  | "learning"
  | "plugins"
  | "data"
  | "help"
  | "about";

/** The panel testid revealed when each tab is active. */
export const SETTINGS_PANELS: Record<SettingsTab, string> = {
  general: "settings-section-appearance",
  ai: "settings-provider",
  learning: "settings-panel-learning",
  plugins: "settings-panel-plugins",
  data: "settings-panel-data",
  help: "settings-panel-help",
  about: "settings-panel-about",
};

export class SettingsPage {
  constructor(private readonly page: Page) {}

  get sidebar(): Locator {
    return this.page.getByTestId("settings-tabs");
  }
  tab(tab: SettingsTab): Locator {
    return this.page.getByTestId(`settings-tab-${tab}`);
  }
  panel(tab: SettingsTab): Locator {
    return this.page.getByTestId(SETTINGS_PANELS[tab]);
  }
  get mobileTrigger(): Locator {
    return this.page.getByTestId("settings-mobile-trigger");
  }
  mobileTab(tab: SettingsTab): Locator {
    return this.page.getByTestId(`settings-mobile-tab-${tab}`);
  }

  // Backup (data tab)
  get backupExport(): Locator {
    return this.page.getByTestId("backup-export");
  }
  get themePicker(): Locator {
    return this.page.getByTestId("settings-theme-picker");
  }
  themeOption(id: string): Locator {
    return this.page.getByTestId(`settings-theme-${id}`);
  }
  /** The clickable theme card (label) wrapping a radio — the radio
   *  itself is sr-only, so interaction must target the label. */
  themeCard(id: string): Locator {
    return this.page
      .locator("label.theme-card")
      .filter({ has: this.themeOption(id) });
  }
  get themeCards(): Locator {
    return this.page.locator("label.theme-card");
  }
  themeGroup(group: "recommended" | "classic"): Locator {
    return this.page.getByTestId(`theme-group-${group}`);
  }
  get usernameInput(): Locator {
    return this.page.getByTestId("settings-username-input");
  }
  get usernameSave(): Locator {
    return this.page.getByTestId("settings-username-save");
  }
  get avatarUpload(): Locator {
    return this.page.getByTestId("avatar-upload-button");
  }
  get avatarFileInput(): Locator {
    return this.page.getByTestId("avatar-file-input");
  }
  get cropConfirm(): Locator {
    return this.page.getByTestId("crop-confirm");
  }
  get avatarPresets(): Locator {
    return this.page.getByTestId("settings-avatar-presets");
  }
  avatarPreset(id: string): Locator {
    return this.page.getByTestId(`settings-avatar-preset-${id}`);
  }
  get avatarFrames(): Locator {
    return this.page.getByTestId("settings-avatar-frames");
  }
  avatarFrame(id: string): Locator {
    return this.page.getByTestId(`settings-avatar-frame-${id}`);
  }
  avatarFrameBuy(id: string): Locator {
    return this.page.getByTestId(`settings-avatar-frame-buy-${id}`);
  }
  get playfulModeToggle(): Locator {
    return this.page.getByTestId("settings-playful-mode-toggle");
  }
  /** The "N of M extras on" status line of the Game Mode card (#2959). */
  get playfulSummary(): Locator {
    return this.page.getByTestId("settings-playful-summary");
  }
  /** The "Game mode details" fold button (#2959); the detail controls
   *  below (hearts, countdown, arcade, mascot, ...) live inside its body. */
  get playfulDetailsToggle(): Locator {
    return this.page.getByTestId("settings-playful-details-toggle");
  }
  get playfulDetailsBody(): Locator {
    return this.page.getByTestId("settings-playful-details-body");
  }
  /** The notice shown inside the fold while the master switch is off. */
  get playfulDetailsOffNotice(): Locator {
    return this.page.getByTestId("settings-playful-details-off-notice");
  }
  get playfulSoundsToggle(): Locator {
    return this.page.getByTestId("settings-playful-sounds-toggle");
  }
  get playfulSoundsOffer(): Locator {
    return this.page.getByTestId("settings-playful-sounds-offer");
  }
  get playfulHeartsToggle(): Locator {
    return this.page.getByTestId("settings-playful-hearts-toggle");
  }
  get playfulHeartsCount(): Locator {
    return this.page.getByTestId("settings-playful-hearts-count");
  }
  get playfulCountdownToggle(): Locator {
    return this.page.getByTestId("settings-playful-countdown-toggle");
  }
  get playfulCountdownSeconds(): Locator {
    return this.page.getByTestId("settings-playful-countdown-seconds");
  }
  get mascotVariants(): Locator {
    return this.page.getByTestId("settings-mascot-variants");
  }
  mascotVariant(id: string): Locator {
    return this.page.getByTestId(`settings-mascot-variant-${id}`);
  }
  mascotVariantBuy(id: string): Locator {
    return this.page.getByTestId(`settings-mascot-variant-buy-${id}`);
  }
  get avatarReplaceDialog(): Locator {
    return this.page.getByTestId("settings-avatar-replace-dialog");
  }
  get avatarReplaceConfirm(): Locator {
    return this.page.getByTestId("settings-avatar-replace-dialog-confirm");
  }
  get avatarRestorePhoto(): Locator {
    return this.page.getByTestId("settings-avatar-restore-photo");
  }
  get selectiveExport(): Locator {
    return this.page.getByTestId("data-export-selective");
  }
  get selectiveSelectAll(): Locator {
    return this.page.getByTestId("data-export-select-all");
  }

  async goto(tab?: SettingsTab): Promise<void> {
    await this.page.goto(tab ? `/settings?tab=${tab}` : "/settings");
  }

  /** Click a desktop sidebar tab and wait for its panel. */
  async openTab(tab: SettingsTab): Promise<void> {
    await this.tab(tab).click();
    await expect(this.tab(tab)).toHaveAttribute("aria-current", "page");
    await expect(this.panel(tab)).toBeVisible();
  }

  /** Unfold "Game mode details" (#2959) when it is collapsed - the fold
   *  is collapsed by default and remembers its state per viewer, so a
   *  spec must never assume either state. Idempotent. */
  async openPlayfulDetails(): Promise<void> {
    await this.playfulDetailsToggle.scrollIntoViewIfNeeded();
    if ((await this.playfulDetailsToggle.getAttribute("aria-expanded")) !== "true") {
      await this.playfulDetailsToggle.click();
    }
    await expect(this.playfulDetailsToggle).toHaveAttribute("aria-expanded", "true");
    await expect(this.playfulDetailsBody).toBeVisible();
  }
}
